import { detectCommand } from '../shared/commands.js';
import { LANGUAGES } from '../shared/languages.js';
import type { Segment } from '../shared/sentences.js';
import type { Level, SessionOptions } from '../shared/types.js';
import { testKey } from './claude.js';
import { Conversation } from './conversation.js';
import {
  azureListener,
  azureSpeaker,
  browserListener,
  browserSpeaker,
  browserSpeechSupported,
  testAzure,
  type Clip,
  type Listener,
  type Speaker,
} from './speech.js';
import { loadSettings, saveSettings, type SpeechEngine } from './store.js';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

type View = 'setup' | 'start' | 'session';

function show(view: View): void {
  for (const v of ['setup', 'start', 'session'] as View[]) $(v).hidden = v !== view;
  document.body.dataset.view = view;
}

// ---- Setup ------------------------------------------------------------------

const anthropicKey = $<HTMLInputElement>('anthropicKey');
const azureKey = $<HTMLInputElement>('azureKey');
const azureRegion = $<HTMLInputElement>('azureRegion');
const azureRows = $<HTMLDivElement>('azureRows');

function engine(): SpeechEngine {
  return (document.querySelector('input[name="speech"]:checked') as HTMLInputElement).value as SpeechEngine;
}

function setStatus(id: string, ok: boolean | null, message: string): void {
  const el = $(id);
  el.className = `status${ok === null ? '' : ok ? ' ok' : ' err'}`;
  el.textContent = message;
}

function openSetup(): void {
  const s = loadSettings();
  anthropicKey.value = s.anthropicKey;
  azureKey.value = s.azureKey;
  azureRegion.value = s.azureRegion;
  (document.querySelector(`input[name="speech"][value="${s.speech}"]`) as HTMLInputElement).checked = true;
  azureRows.hidden = s.speech !== 'azure';
  setStatus('anthropicStatus', null, '');
  setStatus('azureStatus', null, '');
  setStatus('setupStatus', null, '');
  show('setup');
}

$('setupForm').addEventListener('change', () => (azureRows.hidden = engine() !== 'azure'));

$('testAnthropic').addEventListener('click', async () => {
  setStatus('anthropicStatus', null, 'Prüfe…');
  try {
    await testKey(anthropicKey.value.trim());
    setStatus('anthropicStatus', true, 'Schlüssel funktioniert.');
  } catch (err) {
    setStatus('anthropicStatus', false, (err as Error).message);
  }
});

$('testAzure').addEventListener('click', async () => {
  setStatus('azureStatus', null, 'Prüfe…');
  try {
    await testAzure(azureKey.value.trim(), azureRegion.value.trim());
    setStatus('azureStatus', true, 'Schlüssel funktioniert.');
  } catch (err) {
    setStatus('azureStatus', false, (err as Error).message);
  }
});

$('setupForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const speech = engine();
  if (!anthropicKey.value.trim()) {
    setStatus('setupStatus', false, 'Bitte zuerst den Anthropic-Schlüssel eintragen.');
    return;
  }
  if (speech === 'azure' && !azureKey.value.trim()) {
    setStatus('setupStatus', false, 'Für Azure brauchst du einen Azure-Schlüssel, oder wähle „Browser“.');
    return;
  }
  saveSettings({
    anthropicKey: anthropicKey.value.trim(),
    azureKey: azureKey.value.trim(),
    azureRegion: azureRegion.value.trim() || 'westeurope',
    speech,
  });
  openStart();
});

$('forget').addEventListener('click', () => {
  saveSettings({ anthropicKey: '', azureKey: '' });
  anthropicKey.value = '';
  azureKey.value = '';
  setStatus('setupStatus', true, 'Schlüssel aus diesem Browser gelöscht.');
});

// ---- Quick start -------------------------------------------------------------

type Field = Exclude<keyof SessionOptions, 'topic'>;

const OPTIONS: Record<Field, [string, string][]> = {
  language: LANGUAGES.map((l) => [l.code, l.name]),
  level: [['beginner', 'Anfänger'], ['intermediate', 'Mittel'], ['advanced', 'Fortgeschritten']],
  expressionCorrection: [['off', 'Aus'], ['low', 'Wenig'], ['normal', 'Normal'], ['high', 'Viel']],
  accentCorrection: [['off', 'Aus'], ['low', 'Wenig'], ['normal', 'Normal'], ['high', 'Viel']],
  audio: [['headphones', 'Kopfhörer'], ['speakers', 'Lautsprecher']],
  mode: [['free', 'Freies Gespräch'], ['roleplay', 'Rollenspiel'], ['topic', 'Thema']],
};

const startForm = $<HTMLFormElement>('startForm');
const topic = $<HTMLInputElement>('topic');

function selected(field: Field): string {
  return (startForm.querySelector(`input[name="${field}"]:checked`) as HTMLInputElement).value;
}

function renderChoices(field: Field, value: string): void {
  const container = $(field);
  container.replaceChildren();
  for (const [v, label] of OPTIONS[field]) {
    const el = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = field;
    input.value = v;
    input.id = `${field}-${v}`;
    input.checked = v === value;
    el.append(input, label);
    container.append(el);
  }
}

function openStart(): void {
  const s = loadSettings();
  if (!s.anthropicKey) return openSetup();
  for (const field of Object.keys(OPTIONS) as Field[]) renderChoices(field, s.lastSession[field]);
  topic.value = s.lastSession.topic;
  $('topicRow').hidden = selected('mode') === 'free';
  $('engineNote').textContent = s.speech === 'azure'
    ? 'Stimmen: Azure Speech.'
    : 'Stimmen: kostenlos vom Browser. Am besten klingt es in Microsoft Edge.';
  $('browserWarning').hidden = s.speech !== 'browser' || browserSpeechSupported();
  show('start');
}

startForm.addEventListener('change', () => ($('topicRow').hidden = selected('mode') === 'free'));
$('openSetup').addEventListener('click', openSetup);

startForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const options = {
    language: selected('language'),
    level: selected('level'),
    expressionCorrection: selected('expressionCorrection'),
    accentCorrection: selected('accentCorrection'),
    audio: selected('audio'),
    mode: selected('mode'),
    topic: selected('mode') === 'free' ? '' : topic.value.trim(),
  } as SessionOptions;
  saveSettings({ lastSession: options });
  void startSession(options);
});

// ---- Session -----------------------------------------------------------------

type State = 'starting' | 'listening' | 'thinking' | 'speaking' | 'paused' | 'error';

const STATE_LABEL: Record<State, string> = {
  starting: 'Starte…',
  listening: 'Ich höre zu',
  thinking: 'Denke nach…',
  speaking: 'Spreche',
  paused: 'Pausiert, sag „Weiter“',
  error: 'Problem',
};

const BASE_RATE: Record<Level, number> = { beginner: 0.8, intermediate: 0.9, advanced: 1 };
// How long a pause ends your turn (Azure only). Beginners get more time to think.
const SILENCE_MS: Record<Level, number> = { beginner: 1400, intermediate: 1000, advanced: 800 };
// Words you must say over the partner before it stops talking. Higher with
// speakers, so its own voice coming back through the microphone does not count.
const BARGE_IN_WORDS = { headphones: 2, speakers: 4 };

const transcript = $<HTMLElement>('transcript');
const partialEl = $<HTMLParagraphElement>('partial');
const errorEl = $<HTMLParagraphElement>('error');
const stateEl = $<HTMLDivElement>('state');
const pauseBtn = $<HTMLButtonElement>('pause');

interface Item { seg: Segment; clip: Clip }

let options: SessionOptions;
let state: State = 'starting';
let rate = 1;
let conversation: Conversation | null = null;
let listener: Listener | null = null;
let speaker: Speaker | null = null;
let micStream: MediaStream | null = null;
let wakeLock: { release(): Promise<void> } | null = null;
let turnDone = true;
let queue: Item[] = [];
let playing: Item | null = null;
let pumping = false;
let lastReply: Segment[] = [];
let meterFrame = 0;

function setState(next: State): void {
  state = next;
  stateEl.dataset.state = next;
  $('stateLabel').textContent = STATE_LABEL[next];
  pauseBtn.textContent = next === 'paused' ? 'Weiter' : 'Pause';
}

function showError(message: string | null): void {
  errorEl.hidden = !message;
  errorEl.textContent = message ?? '';
}

function addLine(kind: 'me' | 'agent' | 'en' | 'note', text: string): void {
  const p = document.createElement('p');
  p.className = `line ${kind}`;
  p.textContent = text;
  transcript.append(p);
  transcript.scrollTop = transcript.scrollHeight;
}

function words(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function stopAudio(): void {
  for (const item of queue) item.clip.stop();
  queue = [];
  playing?.clip.stop();
  speaker?.stopAll();
}

async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  while (queue.length) {
    playing = queue.shift()!;
    setState('speaking');
    await playing.clip.play();
    playing = null;
  }
  pumping = false;
  if (turnDone && state === 'speaking') setState('listening');
}

function enqueue(seg: Segment, show = true): void {
  if (!speaker) return;
  if (show) addLine(seg.lang === 'en' ? 'en' : 'agent', seg.text);
  queue.push({ seg, clip: speaker.prepare(seg.text, seg.lang, rate) });
  void pump();
}

function send(text: string | null): void {
  if (!conversation) return;
  stopAudio();
  turnDone = false;
  lastReply = [];
  showError(null);
  setState('thinking');
  conversation.send(text, {
    segment(seg) {
      if (state === 'paused') return;
      lastReply.push(seg);
      enqueue(seg);
    },
    done(error) {
      turnDone = true;
      if (error) {
        showError(error);
        addLine('note', 'Sprich einfach weiter, dann versuche ich es nochmal.');
      }
      if (!pumping && state !== 'paused') setState('listening');
    },
  });
}

function bargeIn(): void {
  stopAudio();
  conversation?.cancel();
  turnDone = true;
  setState('listening');
}

function handleCommand(command: NonNullable<ReturnType<typeof detectCommand>>): void {
  switch (command) {
    case 'end':
      endSession();
      return;
    case 'pause':
      bargeIn();
      setState('paused');
      return;
    case 'resume':
      if (state === 'paused') setState('listening');
      return;
    case 'repeat':
      if (lastReply.length) {
        stopAudio();
        lastReply.forEach((seg) => enqueue(seg, false));
      }
      return;
    case 'slower':
    case 'faster':
      rate = Math.min(1.2, Math.max(0.6, rate + (command === 'slower' ? -0.1 : 0.1)));
      addLine('note', `Sprechtempo ab der nächsten Antwort: ${Math.round(rate * 100)} %`);
      return;
  }
}

function onHeard(text: string): void {
  partialEl.textContent = '';
  const command = detectCommand(text);
  if (command) {
    addLine('note', `Befehl: ${text}`);
    handleCommand(command);
    return;
  }
  if (state === 'paused' || state === 'error' || state === 'starting') return;
  // With speakers, a final result while the partner is talking is most likely
  // its own voice. Real interruptions are caught earlier by onPartial.
  if (state === 'speaking' && options.audio === 'speakers') return;
  addLine('me', text);
  send(text);
}

function onPartial(text: string): void {
  if (state === 'paused') return;
  partialEl.textContent = text;
  if (state === 'speaking' && words(text) >= BARGE_IN_WORDS[options.audio]) bargeIn();
}

function startLevelMeter(stream: MediaStream): void {
  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const data = new Uint8Array(analyser.fftSize);
  const bar = $<HTMLSpanElement>('micLevel');
  const tick = () => {
    analyser.getByteTimeDomainData(data);
    let peak = 0;
    for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
    bar.style.width = `${Math.min(100, (peak / 64) * 100)}%`;
    meterFrame = requestAnimationFrame(tick);
  };
  tick();
}

function renderChips(): void {
  const s = loadSettings();
  const language = LANGUAGES.find((l) => l.code === options.language)?.name ?? options.language;
  const level = { beginner: 'Anfänger', intermediate: 'Mittel', advanced: 'Fortgeschritten' }[options.level];
  const chips = $('chips');
  chips.replaceChildren();
  for (const text of [language, level, options.audio === 'headphones' ? 'Kopfhörer' : 'Lautsprecher', s.speech === 'azure' ? 'Azure' : 'Browser']) {
    const span = document.createElement('span');
    span.className = 'chip';
    span.textContent = text;
    chips.append(span);
  }
}

async function startSession(chosen: SessionOptions): Promise<void> {
  const s = loadSettings();
  options = chosen;
  rate = BASE_RATE[options.level];
  transcript.replaceChildren();
  partialEl.textContent = '';
  showError(null);
  setState('starting');
  renderChips();
  show('session');

  try {
    // Ask for the microphone first, so the browser shows its permission prompt now.
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const events = { partial: onPartial, final: onHeard, error: (m: string) => { setState('error'); showError(m); } };
    if (s.speech === 'azure') {
      startLevelMeter(micStream);
      speaker = azureSpeaker(s.azureKey, s.azureRegion, options.language);
      listener = azureListener(s.azureKey, s.azureRegion, options.language, SILENCE_MS[options.level], micStream, events);
    } else {
      // The browser's recognizer opens the microphone itself.
      micStream.getTracks().forEach((t) => t.stop());
      micStream = null;
      speaker = browserSpeaker(options.language);
      listener = browserListener(options.language, events);
    }
    $('meter').hidden = s.speech !== 'azure';
    await listener.start();
    conversation = new Conversation(options, s.anthropicKey, s.model);
  } catch (err) {
    setState('error');
    const name = err instanceof DOMException ? err.name : '';
    showError(name === 'NotAllowedError' || name === 'NotFoundError'
      ? 'Kein Zugriff aufs Mikrofon. Bitte im Browser das Mikrofon für diese Seite erlauben (Schloss-Symbol neben der Adresse).'
      : (err as Error).message);
    return;
  }
  try {
    wakeLock = await (navigator as unknown as { wakeLock: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock.request('screen');
  } catch {
    // Optional: keeps the screen on during the session where allowed.
  }
  send(null);
}

function endSession(): void {
  stopAudio();
  conversation?.cancel();
  conversation = null;
  listener?.stop();
  listener = null;
  speaker?.close();
  speaker = null;
  micStream?.getTracks().forEach((t) => t.stop());
  micStream = null;
  cancelAnimationFrame(meterFrame);
  void wakeLock?.release().catch(() => undefined);
  wakeLock = null;
  openStart();
}

pauseBtn.addEventListener('click', () => handleCommand(state === 'paused' ? 'resume' : 'pause'));
$('end').addEventListener('click', endSession);

openStart();
