import type { Correction, Level } from './types.js';

export const LEVEL_LABEL: Record<Level, string> = { beginner: 'Anfänger', intermediate: 'Mittel', advanced: 'Fortgeschritten' };
export const CORRECTION_LABEL: Record<Correction, string> = { off: 'Aus', low: 'Wenig', normal: 'Normal', high: 'Viel' };

const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced'];
const CORRECTIONS: Correction[] = ['off', 'low', 'normal', 'high'];

function step<T>(list: T[], value: T, by: number): T {
  return list[Math.min(list.length - 1, Math.max(0, list.indexOf(value) + by))];
}

export const stepLevel = (level: Level, by: number): Level => step(LEVELS, level, by);
export const stepCorrection = (c: Correction, by: number): Correction => step(CORRECTIONS, c, by);

/** Seconds of silence after the partner spoke before it offers help. Null: never. */
export const STUCK_SECONDS: Record<Level, number | null> = { beginner: 12, intermediate: 20, advanced: null };
