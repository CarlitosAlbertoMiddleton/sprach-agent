import { buildSystemPrompt, SESSION_START } from '../shared/prompt.js';
import { SentenceSplitter, type Segment } from '../shared/sentences.js';
import type { SessionOptions } from '../shared/types.js';
import { streamReply, type ChatMessage } from './claude.js';

export interface TurnSink {
  /** One sentence of the reply, in order, as soon as it is complete. */
  segment(seg: Segment): void;
  done(error?: string): void;
}

/**
 * One practice session with Claude, kept in the page. Each turn streams a reply
 * and hands it on sentence by sentence, so speaking starts before it is complete.
 */
export class Conversation {
  private system: string;
  private readonly messages: ChatMessage[] = [];
  private current: { abort: AbortController; spokenText: string } | null = null;

  constructor(options: SessionOptions, private readonly key: string, private readonly model: string) {
    this.system = buildSystemPrompt(options);
  }

  /** New level or corrections mid-session; applies from the next turn. */
  update(options: SessionOptions): void {
    this.system = buildSystemPrompt(options);
  }

  send(text: string | null, sink: TurnSink): void {
    this.cancel();
    this.messages.push({ role: 'user', content: text ?? SESSION_START });
    const current = { abort: new AbortController(), spokenText: '' };
    this.current = current;
    void this.run(current, sink);
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

  private async run(current: { abort: AbortController; spokenText: string }, sink: TurnSink): Promise<void> {
    const signal = current.abort.signal;
    const splitter = new SentenceSplitter();
    let full = '';
    const deliver = (seg: Segment) => {
      if (signal.aborted) return;
      current.spokenText += (seg.lang === 'en' ? '\nEN: ' : seg.lang === 'fix' ? '\nFIX: ' : ' ') + seg.text;
      sink.segment(seg);
    };
    try {
      const stopReason = await streamReply({
        key: this.key,
        model: this.model,
        system: this.system,
        messages: this.messages,
        signal,
        onText: (delta) => {
          full += delta;
          splitter.feed(delta).forEach(deliver);
        },
      });
      splitter.flush().forEach(deliver);
      if (signal.aborted) return;
      this.current = null;
      if (full.trim()) this.messages.push({ role: 'assistant', content: full });
      sink.done(stopReason === 'refusal' ? 'Claude hat diese Antwort abgelehnt. Versuch es anders zu formulieren.' : undefined);
    } catch (err) {
      if (signal.aborted) return;
      if (this.current === current) this.current = null;
      sink.done((err as Error).message);
    }
  }
}
