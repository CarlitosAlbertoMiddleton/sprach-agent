export type LanguageCode = 'fr-FR' | 'en-GB' | 'de-DE' | 'it-IT';
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type Correction = 'off' | 'low' | 'normal' | 'high';
export type AudioMode = 'headphones' | 'speakers';
export type ConversationMode = 'free' | 'roleplay' | 'topic';

/** Everything chosen in the quick-start window before a session. */
export interface SessionOptions {
  language: LanguageCode;
  level: Level;
  expressionCorrection: Correction;
  accentCorrection: Correction;
  audio: AudioMode;
  mode: ConversationMode;
  /** Roleplay scene or topic, free text. Empty for free conversation. */
  topic: string;
}

export interface Preferences {
  lastSession: SessionOptions;
  hotkey: string;
  azureRegion: string;
  /** Claude model for the conversation. */
  model: string;
}

export type SecretName = 'anthropicKey' | 'azureSpeechKey';

export interface KeyStatus {
  anthropicKey: boolean;
  azureSpeechKey: boolean;
}

export interface TestResult {
  ok: boolean;
  message: string;
}

/** API exposed to the renderer windows by the preload script. */
export interface SprachApi {
  getPreferences(): Promise<Preferences>;
  savePreferences(prefs: Partial<Preferences>): Promise<Preferences>;
  getKeyStatus(): Promise<KeyStatus>;
  saveSecret(name: SecretName, value: string): Promise<KeyStatus>;
  testAnthropic(): Promise<TestResult>;
  testAzure(): Promise<TestResult>;
  startSession(options: SessionOptions): Promise<void>;
  stopSession(): Promise<void>;
  openSettings(): Promise<void>;
  closeWindow(): Promise<void>;
}

export interface SpeechToken {
  token: string;
  region: string;
}

/** One speakable piece of the partner's reply, with its synthesized audio (MP3). */
export interface SegmentEvent {
  turn: number;
  index: number;
  text: string;
  lang: 'target' | 'en';
  audio: Uint8Array | null;
}

export interface TurnDoneEvent {
  turn: number;
  /** Set when the turn failed; a message the learner can act on. */
  error?: string;
}

/** API for the session window that runs the conversation. */
export interface SessionApi {
  getOptions(): Promise<SessionOptions>;
  getSpeechToken(): Promise<SpeechToken>;
  /** Sends the learner's words (or the session start) and returns the turn number. */
  sendTurn(text: string | null, rate: number): Promise<number>;
  cancelTurn(): Promise<void>;
  endSession(): Promise<void>;
  onSegment(handler: (e: SegmentEvent) => void): void;
  onTurnDone(handler: (e: TurnDoneEvent) => void): void;
}
