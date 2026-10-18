// Listening and speaking, either with the browser's built-in speech services
// (free, no key) or with Azure Speech (better voices, needs a key).
import type * as SDK from 'microsoft-cognitiveservices-speech-sdk';
import { EXPLANATION_VOICE, LANGUAGES } from '../shared/languages.js';
import type { LanguageCode } from '../shared/types.js';

declare const SpeechSDK: typeof SDK;

export interface ListenerEvents {
  partial(text: string): void;
  final(text: string): void;
  error(message: string): void;
}

export interface Listener {
  start(): Promise<void>;
  stop(): void;
}

/** One sentence ready to be spoken. Synthesis may start before play() is called. */
export interface Clip {
  play(): Promise<void>;
  stop(): void;
}

export interface Speaker {
  prepare(text: string, lang: 'target' | 'en', rate: number): Clip;
  stopAll(): void;
  close(): void;
}

// ---- Browser built-in -------------------------------------------------------

interface BrowserRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => BrowserRecognition;

function recognitionCtor(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function browserSpeechSupported(): boolean {
  return Boolean(recognitionCtor()) && 'speechSynthesis' in window;
}

export function browserListener(language: LanguageCode, on: ListenerEvents): Listener {
  const Ctor = recognitionCtor();
  let rec: BrowserRecognition | null = null;
  let running = false;
  return {
    async start() {
      if (!Ctor) throw new Error('Dieser Browser kann keine Sprache erkennen. Bitte Chrome oder Edge benutzen.');
      running = true;
      rec = new Ctor();
      rec.lang = language;
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i];
          const text = result[0].transcript.trim();
          if (result.isFinal) {
            if (text) on.final(text);
          } else {
            interim += `${text} `;
          }
        }
        on.partial(interim.trim());
      };
      rec.onerror = (e) => {
        if (e.error === 'no-speech' || e.error === 'aborted') return;
        running = false;
        on.error(e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? 'Kein Zugriff aufs Mikrofon. Bitte im Browser das Mikrofon für diese Seite erlauben.'
          : `Spracherkennung unterbrochen (${e.error}). Ende drücken und neu starten.`);
      };
      // Browsers end recognition after a while of silence; start it again.
      rec.onend = () => {
        if (running) setTimeout(() => running && rec?.start(), 250);
      };
      rec.start();
    },
    stop() {
      running = false;
      rec?.stop();
    },
  };
}

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.replace('_', '-').toLowerCase() === lang.toLowerCase());
  // Natural and online voices sound far better than the old offline ones.
  return voices.find((v) => /natural/i.test(v.name)) ?? voices.find((v) => /online|google/i.test(v.name)) ?? voices[0];
}

export function browserSpeaker(language: LanguageCode): Speaker {
  speechSynthesis.getVoices(); // starts loading the voice list
  let current: (() => void) | null = null;
  return {
    prepare(text, lang, rate) {
      let stopped = false;
      return {
        play() {
          if (stopped) return Promise.resolve();
          return new Promise<void>((resolve) => {
            const code = lang === 'en' ? 'en-GB' : language;
            const u = new SpeechSynthesisUtterance(text);
            u.lang = code;
            const voice = pickVoice(code);
            if (voice) u.voice = voice;
            u.rate = lang === 'en' ? 1 : rate;
            u.onend = () => resolve();
            u.onerror = () => resolve();
            current = resolve;
            speechSynthesis.speak(u);
          });
        },
        stop() {
          stopped = true;
        },
      };
    },
    stopAll() {
      speechSynthesis.cancel();
      current?.();
      current = null;
    },
    close() {
      speechSynthesis.cancel();
    },
  };
}

// ---- Azure ------------------------------------------------------------------

export function azureListener(
  key: string,
  region: string,
  language: LanguageCode,
  silenceMs: number,
  stream: MediaStream,
  on: ListenerEvents,
): Listener {
  let recognizer: SDK.SpeechRecognizer | null = null;
  return {
    async start() {
      const config = SpeechSDK.SpeechConfig.fromSubscription(key, region);
      config.speechRecognitionLanguage = language;
      config.setProperty(SpeechSDK.PropertyId.Speech_SegmentationSilenceTimeoutMs, String(silenceMs));
      config.setProfanity(SpeechSDK.ProfanityOption.Raw);
      recognizer = new SpeechSDK.SpeechRecognizer(config, SpeechSDK.AudioConfig.fromStreamInput(stream));
      recognizer.recognizing = (_s, e) => on.partial(e.result.text);
      recognizer.recognized = (_s, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech && e.result.text.trim()) on.final(e.result.text.trim());
        else on.partial('');
      };
      recognizer.canceled = (_s, e) => {
        if (e.reason === SpeechSDK.CancellationReason.Error) {
          on.error(`Azure-Spracherkennung unterbrochen: ${e.errorDetails}. Ende drücken und neu starten.`);
        }
      };
      await new Promise<void>((resolve, reject) =>
        recognizer!.startContinuousRecognitionAsync(resolve, (err) => reject(new Error(`Azure-Spracherkennung startet nicht: ${err}`))),
      );
    },
    stop() {
      recognizer?.stopContinuousRecognitionAsync(() => recognizer?.close());
    },
  };
}

function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
}

export function azureSpeaker(key: string, region: string, language: LanguageCode): Speaker {
  const config = SpeechSDK.SpeechConfig.fromSubscription(key, region);
  config.speechSynthesisOutputFormat = SpeechSDK.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;
  // null: give us the audio instead of playing it, so we control the order.
  const synth = new SpeechSDK.SpeechSynthesizer(config, null);
  const voice = LANGUAGES.find((l) => l.code === language)?.voice ?? LANGUAGES[0].voice;
  const playing = new Set<HTMLAudioElement>();

  return {
    prepare(text, lang, rate) {
      const name = lang === 'en' ? EXPLANATION_VOICE : voice;
      const pct = Math.round(((lang === 'en' ? 1 : rate) - 1) * 100);
      const ssml =
        `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${name.slice(0, 5)}">` +
        `<voice name="${name}"><prosody rate="${pct >= 0 ? '+' : ''}${pct}%">${escapeXml(text)}</prosody></voice></speak>`;
      const audio = new Promise<ArrayBuffer | null>((resolve) =>
        synth.speakSsmlAsync(
          ssml,
          (r) => resolve(r.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted ? r.audioData : null),
          () => resolve(null),
        ),
      );
      let stopped = false;
      let el: HTMLAudioElement | null = null;
      return {
        async play() {
          const data = await audio;
          if (stopped || !data) return;
          el = new Audio(URL.createObjectURL(new Blob([data], { type: 'audio/mpeg' })));
          playing.add(el);
          await new Promise<void>((resolve) => {
            const done = () => {
              playing.delete(el!);
              URL.revokeObjectURL(el!.src);
              resolve();
            };
            el!.onended = done;
            el!.onerror = done;
            el!.onpause = done;
            el!.play().catch(done);
          });
        },
        stop() {
          stopped = true;
          el?.pause();
        },
      };
    },
    stopAll() {
      for (const el of playing) el.pause();
    },
    close() {
      synth.close();
    },
  };
}

/** Quick check that the Azure key and region work: synthesizes one word. */
export function testAzure(key: string, region: string): Promise<void> {
  const config = SpeechSDK.SpeechConfig.fromSubscription(key, region);
  const synth = new SpeechSDK.SpeechSynthesizer(config, null);
  return new Promise((resolve, reject) =>
    synth.speakTextAsync(
      'OK',
      (r) => {
        synth.close();
        if (r.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) resolve();
        else reject(new Error(r.errorDetails?.includes('401') ? 'Azure lehnt den Schlüssel ab. Schlüssel und Region prüfen.' : `Azure-Fehler: ${r.errorDetails}`));
      },
      (err) => {
        synth.close();
        reject(new Error(`Azure-Fehler: ${err}`));
      },
    ),
  );
}
