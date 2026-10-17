import type { LanguageCode } from './types.js';

export interface LanguageInfo {
  code: LanguageCode;
  name: string;
  /** Default Azure neural voice; can be changed later in settings. */
  voice: string;
}

/** MVP languages in the order Carlos wants to learn them. */
export const LANGUAGES: LanguageInfo[] = [
  { code: 'fr-FR', name: 'Français', voice: 'fr-FR-DeniseNeural' },
  { code: 'en-GB', name: 'English (UK)', voice: 'en-GB-SoniaNeural' },
  { code: 'de-DE', name: 'Deutsch', voice: 'de-DE-KatjaNeural' },
  { code: 'it-IT', name: 'Italiano', voice: 'it-IT-ElsaNeural' },
];
