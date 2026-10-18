import { app } from 'electron';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Preferences } from '../shared/types';

const DEFAULTS: Preferences = {
  lastSession: {
    language: 'fr-FR',
    level: 'beginner',
    expressionCorrection: 'normal',
    accentCorrection: 'normal',
    audio: 'headphones',
    mode: 'free',
    topic: '',
  },
  hotkey: 'Control+Alt+S',
  azureRegion: 'westeurope',
  model: 'claude-opus-5-5',
};

function file(): string {
  return join(app.getPath('userData'), 'preferences.json');
}

export function loadPreferences(): Preferences {
  try {
    const stored = JSON.parse(readFileSync(file(), 'utf8')) as Partial<Preferences>;
    return { ...DEFAULTS, ...stored, lastSession: { ...DEFAULTS.lastSession, ...stored.lastSession } };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function savePreferences(update: Partial<Preferences>): Preferences {
  const merged = { ...loadPreferences(), ...update };
  mkdirSync(dirname(file()), { recursive: true });
  writeFileSync(file(), JSON.stringify(merged, null, 2));
  return merged;
}
