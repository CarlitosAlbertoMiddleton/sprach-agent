import type * as SDK from 'microsoft-cognitiveservices-speech-sdk';
import { LANGUAGES } from '../shared/languages.js';
import { detectCommand } from '../shared/commands.js';
import type { Level, SegmentEvent, SessionOptions, TurnDoneEvent } from '../shared/types.js';

declare const SpeechSDK: typeof SDK;

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
// How long a pause ends your turn. Beginners get more time to think mid-sentence.
const SILENCE_MS: Record<Level, number> = { beginner: 1400, intermediate: 1000, advanced: 800 };
// Words you must say over the partner before it stops talking. Higher with
// speakers, so its own voice coming back through the microphone does not count.
const BARGE_IN_WORDS = { headphones: 2, speakers: 4 };

const api = window.sprachSession;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const transcript = $<HTMLElement>('transcript');
const partialEl = $<HTMLParagraphElement>('partial');
const errorEl = $<HTMLParagraphElement>('error');
const stateEl = $<HTMLDivElement>('state');
const pauseBtn = $<HTMLButtonElement>('pause');

let options: SessionOptions;
let state: State = 'starting';
let rate = 1;
let currentTurn = 0;
let turnDone = true;
let queue: SegmentEvent[] = [];
let lastReply: SegmentEvent[] = [];
let playing: HTMLAudioElement | null = null;
let recognizer: SDK.SpeechRecognizer | null = null;

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

// ---- Playback ---------------------------------------------------------------

function stopAudio(): void {
  queue = [];
  if (playing) {
    playing.pause();
    URL.revokeObjectURL(playing.src);
    playing = null;
  }
}

function playNext(): void {
  const seg = queue.shift();
  if (!seg) {
    playing = null;
    if (turnDone && state === 'speaking') setState('listening');
    return;
  }
  setState('speaking');
  if (!seg.audio) {
    playNext();
    return;
  }
  const audio = new Audio(URL.createObjectURL(new Blob([seg.audio as BlobPart], { type: 'audio/mpeg' })));
  playing = audio;
  const next = () => {
    if (playing !== audio) return;
    URL.revokeObjectURL(audio.src);
    playNext();
  };
  audio.onended = next;
  audio.onerror = next;
  audio.play().catch(next);
}

function enqueue(seg: SegmentEvent, show = true): void {
  if (show) addLine(seg.lang === 'en' ? 'en' : 'agent', seg.text);
  queue.push(seg);
  if (!playing) playNext();
}

// ---- Turns -------------------------------------------------------------------

async function send(text: string | null): Promise<void> {
  stopAudio();
  turnDone = false;
  lastReply = [];
  setState('thinking');
  try {
    currentTurn = await api.sendTurn(text, rate);
  } catch (err) {
    turnDone = true;
    setState('error');
    showError(cleanError(err));
  }
}

function bargeIn(): void {
  stopAudio();
  void api.cancelTurn();
  turnDone = true;
  setState('listening');
}

api.onSegment((seg) => {
  if (seg.turn !== currentTurn || state === 'paused') return;
  lastReply.push(seg);
  enqueue(seg);
});

api.onTurnDone((e: TurnDoneEvent) => {
  if (e.turn !== currentTurn) return;
  turnDone = true;
  if (e.error) {
    showError(e.error);
    addLine('note', 'Sprich einfach weiter, dann versuche ich es nochmal.');
  }
  if (!playing && state !== 'paused') setState('listening');
});

function handleCommand(command: NonNullable<ReturnType<typeof detectCommand>>): void {
  switch (command) {
    case 'end':
      void api.endSession();
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
  if (state === 'paused') return;
  // With speakers, a final result while the partner is talking is most likely
  // its own voice. Real interruptions are caught earlier by bargeIn().
  if (state === 'speaking' && options.audio === 'speakers') return;
  addLine('me', text);
  void send(text);
}

// ---- Microphone and recognition ---------------------------------------------

function startLevelMeter(stream: MediaStream): void {
  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const data = new Uint8Array(analyser.fftSize);
  const bar = $<HTMLSpanElement>('level');
  const tick = () => {
    analyser.getByteTimeDomainData(data);
    let peak = 0;
    for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
    bar.style.width = `${Math.min(100, (peak / 64) * 100)}%`;
    requestAnimationFrame(tick);
  };
  tick();
}

async function startRecognition(): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  startLevelMeter(stream);

  const { token, region } = await api.getSpeechToken();
  const config = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
  config.speechRecognitionLanguage = options.language;
  config.setProperty(SpeechSDK.PropertyId.Speech_SegmentationSilenceTimeoutMs, String(SILENCE_MS[options.level]));
  config.setProfanity(SpeechSDK.ProfanityOption.Raw);
  const audioConfig = SpeechSDK.AudioConfig.fromStreamInput(stream);
  recognizer = new SpeechSDK.SpeechRecognizer(config, audioConfig);

  const threshold = BARGE_IN_WORDS[options.audio];
  recognizer.recognizing = (_s, e) => {
    if (state === 'paused') return;
    partialEl.textContent = e.result.text;
    if (state === 'speaking' && words(e.result.text) >= threshold) bargeIn();
  };
  recognizer.recognized = (_s, e) => {
    if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech && e.result.text.trim()) onHeard(e.result.text.trim());
    else partialEl.textContent = '';
  };
  recognizer.canceled = (_s, e) => {
    if (e.reason === SpeechSDK.CancellationReason.Error) {
      setState('error');
      showError(`Spracherkennung unterbrochen: ${e.errorDetails}. Ende drücken und neu starten.`);
    }
  };
  recognizer.startContinuousRecognitionAsync(undefined, (err) => {
    setState('error');
    showError(`Spracherkennung startet nicht: ${err}`);
  });

  // Azure tokens expire after 10 minutes.
  setInterval(async () => {
    try {
      if (recognizer) recognizer.authorizationToken = (await api.getSpeechToken()).token;
    } catch (err) {
      showError(cleanError(err));
    }
  }, 7 * 60 * 1000);
}

function cleanError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  // ipcRenderer.invoke wraps errors from the main process in a long prefix.
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}

// ---- Start -------------------------------------------------------------------

pauseBtn.addEventListener('click', () => handleCommand(state === 'paused' ? 'resume' : 'pause'));
$('end').addEventListener('click', () => void api.endSession());

async function init(): Promise<void> {
  options = await api.getOptions();
  rate = BASE_RATE[options.level];
  const language = LANGUAGES.find((l) => l.code === options.language)?.name ?? options.language;
  const level = { beginner: 'Anfänger', intermediate: 'Mittel', advanced: 'Fortgeschritten' }[options.level];
  const chips = $('chips');
  for (const text of [language, level, options.audio === 'headphones' ? 'Kopfhörer' : 'Lautsprecher']) {
    const span = document.createElement('span');
    span.className = 'chip';
    span.textContent = text;
    chips.append(span);
  }
  try {
    await startRecognition();
  } catch (err) {
    setState('error');
    const name = err instanceof DOMException ? err.name : '';
    showError(name === 'NotAllowedError' || name === 'NotFoundError'
      ? 'Kein Zugriff aufs Mikrofon. Windows-Einstellungen → Datenschutz → Mikrofon: Zugriff für Desktop-Apps erlauben.'
      : cleanError(err));
    return;
  }
  await send(null);
}

void init();
