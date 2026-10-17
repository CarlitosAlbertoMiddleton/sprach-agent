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
