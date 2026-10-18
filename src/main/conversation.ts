import Anthropic from '@anthropic-ai/sdk';
import type { SegmentEvent, SessionOptions, TurnDoneEvent } from '../shared/types';
import { EXPLANATION_VOICE, LANGUAGES } from '../shared/languages';
import { buildSystemPrompt, SESSION_START } from '../shared/prompt';
import { SentenceSplitter, type Segment } from '../shared/sentences';
import { readSecret } from './secrets';
import { synthesize } from './speech';

interface Sink {
  segment(e: SegmentEvent): void;
  done(e: TurnDoneEvent): void;
}

/**
 * One practice session with Claude. Each learner turn streams a reply, cuts it
 * into sentences, and synthesizes each sentence as soon as it is complete, so
 * the partner starts speaking while the rest of the answer is still arriving.
 */
export class Conversation {
  private readonly client: Anthropic;
  private readonly system: string;
  private readonly voice: string;
  private readonly messages: Anthropic.Beta.BetaMessageParam[] = [];
  private turn = 0;
  private current: { abort: AbortController; spokenText: string } | null = null;

  constructor(
    private readonly options: SessionOptions,
    private readonly model: string,
    private readonly region: string,
    private readonly sink: Sink,
  ) {
    const apiKey = readSecret('anthropicKey');
    if (!apiKey) throw new Error('Kein Anthropic-Schlüssel gespeichert. Bitte in den Einstellungen eintragen.');
    this.client = new Anthropic({ apiKey });
    this.system = buildSystemPrompt(options);
    this.voice = LANGUAGES.find((l) => l.code === options.language)?.voice ?? LANGUAGES[0].voice;
  }

  /** Starts a turn and returns its number; results arrive through the sink. */
  send(text: string | null, rate: number): number {
    this.cancel();
    const turn = ++this.turn;
    this.messages.push({ role: 'user', content: text ?? SESSION_START });
    const current = { abort: new AbortController(), spokenText: '' };
    this.current = current;
    void this.run(turn, rate, current);
    return turn;
  }

  /** Stops the current reply, e.g. when the learner starts talking over it. */
  cancel(): void {
    const current = this.current;
    if (!current) return;
    this.current = null;
    current.abort.abort();
    // Keep what was already said so the partner knows where it was cut off.
    const said = current.spokenText.trim();
    if (said) this.messages.push({ role: 'assistant', content: `${said} [interrupted by the learner]` });
  }

  private async run(turn: number, rate: number, current: { abort: AbortController; spokenText: string }): Promise<void> {
    const signal = current.abort.signal;
    const splitter = new SentenceSplitter();
    let index = 0;
    // Audio is synthesized in parallel but delivered in order.
    let delivery = Promise.resolve();
    const deliver = (seg: Segment) => {
      // A correction is heard as the better phrasing in the target voice, then the reason in English.
      if (seg.fix) {
        current.spokenText += `\nFIX: ${seg.text}`;
        say({ text: seg.fix.right, lang: 'target' });
        if (seg.fix.why) say({ text: seg.fix.why, lang: 'en' });
        return;
      }
      current.spokenText += (seg.lang === 'en' ? '\nEN: ' : ' ') + seg.text;
      say(seg as { text: string; lang: 'target' | 'en' });
    };
    const say = (seg: { text: string; lang: 'target' | 'en' }) => {
      const i = index++;
      const audio = synthesize(this.region, seg.text, seg.lang === 'en' ? EXPLANATION_VOICE : this.voice, seg.lang === 'en' ? 1 : rate)
        .catch((err: Error) => { console.error(err); return null; });
      delivery = delivery.then(async () => {
        const data = await audio;
        if (!signal.aborted) this.sink.segment({ turn, index: i, text: seg.text, lang: seg.lang, audio: data });
      });
    };

    try {
      const stream = this.client.beta.messages.stream(
        {
          model: this.model,
          max_tokens: 4000,
          system: this.system,
          messages: this.messages,
          output_config: { effort: 'low' },
          cache_control: { type: 'ephemeral' },
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
        },
        { signal },
      );
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          splitter.feed(event.delta.text).forEach(deliver);
        }
      }
      splitter.flush().forEach(deliver);
      const final = await stream.finalMessage();
      if (signal.aborted) return;
      this.current = null;
      this.messages.push({ role: 'assistant', content: final.content });
      await delivery;
      if (final.stop_reason === 'refusal') {
        this.sink.done({ turn, error: 'Claude hat diese Antwort abgelehnt. Versuch es anders zu formulieren.' });
      } else {
        this.sink.done({ turn });
      }
    } catch (err) {
      if (signal.aborted) return;
      if (this.current === current) this.current = null;
      this.sink.done({ turn, error: describe(err) });
    }
  }
}

function describe(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return 'Anthropic lehnt den Schlüssel ab. Bitte in den Einstellungen prüfen.';
  if (err instanceof Anthropic.RateLimitError) return 'Zu viele Anfragen an Claude. Kurz warten und weitersprechen.';
  if (err instanceof Anthropic.APIConnectionError) return 'Keine Verbindung zu Claude. Internet prüfen.';
  if (err instanceof Anthropic.APIError) return `Claude-Fehler ${err.status}: ${err.message}`;
  return `Fehler: ${(err as Error).message}`;
}
