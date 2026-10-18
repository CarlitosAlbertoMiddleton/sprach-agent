// Talks to the Claude API straight from the browser. There is no server of our
// own, so the key goes from this browser to Anthropic and nowhere else.

const API = 'https://api.anthropic.com/v1';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class ClaudeError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

function headers(key: string): Record<string, string> {
  return {
    'x-api-key': key,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
    'content-type': 'application/json',
  };
}

function describe(status: number, message: string): string {
  if (status === 401) return 'Anthropic lehnt den Schlüssel ab. Bitte in der Einrichtung prüfen.';
  if (status === 402 || /credit balance/i.test(message)) return 'Dein Anthropic-Guthaben ist leer. Bitte in der Anthropic-Konsole aufladen.';
  if (status === 429) return 'Zu viele Anfragen an Claude. Kurz warten und weitersprechen.';
  if (status === 529) return 'Claude ist gerade überlastet. Kurz warten und weitersprechen.';
  return `Claude-Fehler ${status}: ${message}`;
}

async function fail(res: Response): Promise<never> {
  let message = res.statusText;
  try {
    message = ((await res.json()) as { error?: { message?: string } }).error?.message ?? message;
  } catch {
    // Not JSON; keep the status text.
  }
  throw new ClaudeError(describe(res.status, message), res.status);
}

function offline(err: unknown): never {
  if (err instanceof ClaudeError || (err as Error).name === 'AbortError') throw err;
  throw new ClaudeError('Keine Verbindung zu Claude. Internet prüfen.');
}

export async function testKey(key: string): Promise<void> {
  const res = await fetch(`${API}/models?limit=1`, { headers: headers(key) }).catch(offline);
  if (!res.ok) await fail(res);
}

export interface StreamRequest {
  key: string;
  model: string;
  system: string;
  messages: ChatMessage[];
  signal: AbortSignal;
  onText(delta: string): void;
}

/** Streams one reply. Resolves with the stop reason once the reply is complete. */
export async function streamReply(req: StreamRequest): Promise<string | null> {
  const res = await fetch(`${API}/messages`, {
    method: 'POST',
    signal: req.signal,
    headers: { ...headers(req.key), 'anthropic-beta': 'server-side-fallback-2026-07-01' },
    body: JSON.stringify({
      model: req.model,
      max_tokens: 4000,
      system: req.system,
      messages: req.messages,
      output_config: { effort: 'low' },
      cache_control: { type: 'ephemeral' },
      fallbacks: 'default',
      stream: true,
    }),
  }).catch(offline);
  if (!res.ok || !res.body) await fail(res);

  let stopReason: string | null = null;
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read().catch(offline);
    if (done) break;
    buffer += value;
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const raw of events) {
      const data = raw.split('\n').find((line) => line.startsWith('data:'));
      if (!data) continue;
      const event = JSON.parse(data.slice(5)) as {
        type: string;
        delta?: { type?: string; text?: string; stop_reason?: string };
        error?: { type?: string; message?: string };
      };
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
        req.onText(event.delta.text);
      } else if (event.type === 'message_delta' && event.delta?.stop_reason) {
        stopReason = event.delta.stop_reason;
      } else if (event.type === 'error') {
        const status = event.error?.type === 'overloaded_error' ? 529 : 500;
        throw new ClaudeError(describe(status, event.error?.message ?? 'unbekannt'), status);
      }
    }
  }
  return stopReason;
}
