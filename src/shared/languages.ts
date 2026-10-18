import type { LanguageCode } from './types';

export interface LanguageInfo {
  code: LanguageCode;
  /** Name in the language itself, shown in the UI. */
  name: string;
  englishName: string;
  /** Azure neural voice for the target language. */
  voice: string;
}

/** MVP languages in the order Carlos wants to learn them. */
export const LANGUAGES: LanguageInfo[] = [
  { code: 'fr-FR', name: 'Français', englishName: 'French', voice: 'fr-FR-DeniseNeural' },
  { code: 'en-GB', name: 'English (UK)', englishName: 'British English', voice: 'en-GB-SoniaNeural' },
  { code: 'de-DE', name: 'Deutsch', englishName: 'German', voice: 'de-DE-KatjaNeural' },
  { code: 'it-IT', name: 'Italiano', englishName: 'Italian', voice: 'it-IT-ElsaNeural' },
];

/** Voice for the English explanation lines. */
export const EXPLANATION_VOICE = 'en-GB-RyanNeural';
