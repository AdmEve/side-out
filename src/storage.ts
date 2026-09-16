import type { Difficulty } from './config/balance.ts';
import type { Locale } from './i18n/strings.ts';

export interface SaveData {
  // settings
  humans: number;
  difficulty: Difficulty;
  sound: boolean;
  locale: Locale;

  // career
  bestTime: number;
  wins: number;
  played: number;
}

const KEY = 'sideout.v1';

const DEFAULTS: SaveData = {
  humans: 1,
  difficulty: 'normal',
  sound: true,
  locale: 'fa',
  bestTime: 0,
  wins: 0,
  played: 0,
};

/**
 * Everything here is best-effort: private windows, blocked site data and
 * screenshot contexts all make localStorage throw or come back empty, so the
 * game has to run identically when it does.
 */
export function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function save(patch: Partial<SaveData>): SaveData {
  const next = { ...load(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* nothing we can do, and nothing that should break the game */
  }
  return next;
}
