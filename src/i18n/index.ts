import { WORLD } from '../config/balance.ts';
import { STRINGS, type Locale, type StringKey } from './strings.ts';

export type { Locale, StringKey };

let current: Locale = 'fa';

export function setLocale(next: Locale): void {
  current = next;
}

export function getLocale(): Locale {
  return current;
}

export function isRtl(): boolean {
  return current === 'fa';
}

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/** Persian readers expect Persian digits; English readers expect Latin ones. */
export function digits(value: string | number): string {
  const s = String(value);
  if (current !== 'fa') return s;
  return s.replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

/**
 * Look up a string, substitute {placeholders}, and localise any digits in the
 * result in one pass — so no call site has to remember to do it.
 */
export function t(key: StringKey, vars?: Record<string, string | number>): string {
  let out: string = STRINGS[key][current];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replaceAll(`{${k}}`, String(v));
    }
  }
  return digits(out);
}

/**
 * Mirror an x coordinate for right-to-left layouts. Anything anchored to an
 * edge — the two corner HUD readouts, the leaderboard columns — passes its
 * left-to-right position through this and lands on the correct side.
 */
export function mx(x: number): number {
  return isRtl() ? WORLD.w - x : x;
}

/** Mirror a horizontal origin (0 = left edge, 1 = right edge). */
export function mo(origin: number): number {
  return isRtl() ? 1 - origin : origin;
}

export function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return digits(`${m}:${String(s).padStart(2, '0')}`);
}
