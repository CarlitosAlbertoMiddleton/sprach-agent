import type { SessionOptions } from '../shared/types.js';

export type SpeechEngine = 'browser' | 'azure';

/** Everything the browser version remembers. Lives only in this browser's local storage. */
export interface WebSettings {
  anthropicKey: string;
  azureKey: string;
  azureRegion: string;
  /** Which service listens and speaks: the browser's built-in one, or Azure. */
  speech: SpeechEngine;
  model: string;
  lastSession: SessionOptions;
}

const KEY = 'sprach-agent';

export const DEFAULTS: WebSettings = {
  anthropicKey: '',
  azureKey: '',
  azureRegion: 'westeurope',
  speech: 'browser',
  model: 'claude-opus-5-5',
  lastSession: {
    language: 'fr-FR',
    level: 'beginner',
    expressionCorrection: 'normal',
    accentCorrection: 'normal',
    audio: 'headphones',
    mode: 'free',
    topic: '',
  },
};

export function loadSettings(): WebSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<WebSettings>;
    return { ...DEFAULTS, ...stored, lastSession: { ...DEFAULTS.lastSession, ...stored.lastSession } };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function saveSettings(update: Partial<WebSettings>): WebSettings {
  const merged = { ...loadSettings(), ...update };
  try {
    localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    // Private windows can refuse storage; the settings then last for this visit only.
  }
  return merged;
}
