/**
 * Visual identity: a survival match lit entirely by itself — no floor, no sky,
 * just a dark void and the glow every wall, ball and hazard throws off.
 *
 * The darkness is not neutral black — it carries a faint indigo bias, so the
 * void reads as deep space rather than an empty canvas. Everything bright on
 * top of that is signal: a player's colour, a warning, a pickup.
 */

export const COLORS = {
  /** The void. */
  bg: 0x05060f,
  /** Just off the void — panel fills, the arena floor. */
  bgRaised: 0x0a0c1c,
  /** Faint structural lines: the floor grid, panel borders. */
  grid: 0x181e3d,
  gridDim: 0x10142a,

  text: 0xf1f4ff,
  textDim: 0x8892c4,
  textFaint: 0x4a5080,

  /** Primary brand glow — electric cyan. Used for the CTA and confirmations. */
  accent: 0x39f3ff,
  /** Secondary brand glow — violet, paired with cyan for depth and gradients. */
  accent2: 0xb56bff,
  warn: 0xff4d6d,
  good: 0x5cff9d,
  gold: 0xffe066,

  hazard: 0xff9f1c,
  wind: 0xb56bff,
  powerup: 0xffe066,
} as const;

/**
 * The eight seat colours. Loud and separable at a glance — eight players on
 * one small screen need that more than they need good taste.
 */
export const PLAYER_COLORS = [
  0x39f3ff, 0xff4d6d, 0x5cff9d, 0xffe066, 0xb56bff, 0xff9f1c, 0x4d8bff, 0xff5cf0,
] as const;

export const PLAYER_NAMES = ['YOU', 'AZZA', 'VEX', 'KILO', 'NOVA', 'RUST', 'ECHO', 'ZEN'] as const;

export function hex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}

/** Blend two packed RGB colours. */
export function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff,
    ag = (a >> 8) & 0xff,
    ab = a & 0xff;
  const br = (b >> 16) & 0xff,
    bg = (b >> 8) & 0xff,
    bb = b & 0xff;
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  );
}

/**
 * Lift a colour until it is legible on the dark ground. Every seat colour is
 * already bright, but this stays as a safety net for anything computed
 * (blends, tints) that might drift dark.
 */
export function readable(color: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (luma >= 0.32) return color;
  return mix(color, 0xffffff, 0.32 + (0.32 - luma));
}

/**
 * One family for both scripts. Vazirmatn covers Persian and Latin with the
 * same proportions and weights, so switching language never shifts the
 * layout — and it ships with the app, so the APK needs no network to render
 * its own UI. The monospace stack is the fallback before the font loads and
 * for any context that can't wait for it.
 */
export const FONT = 'Vazirmatn, ui-monospace, "SF Mono", Menlo, Consolas, monospace';
