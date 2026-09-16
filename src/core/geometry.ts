/**
 * Pure 2D helpers. No Phaser, no DOM — this file is the reason the whole
 * simulation can be replayed headlessly in Node.
 */

export interface Vec {
  x: number;
  y: number;
}

export const TAU = Math.PI * 2;

export const v = (x: number, y: number): Vec => ({ x, y });
export const clone = (a: Vec): Vec => ({ x: a.x, y: a.y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;
export const cross = (a: Vec, b: Vec): number => a.x * b.y - a.y * b.x;
export const len = (a: Vec): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
export const dist2 = (a: Vec, b: Vec): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

export function norm(a: Vec): Vec {
  const l = Math.hypot(a.x, a.y);
  return l > 1e-9 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 };
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpVec(a: Vec, b: Vec, t: number): Vec {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** Reflect a vector about a unit normal. */
export function reflect(d: Vec, n: Vec): Vec {
  const k = 2 * dot(d, n);
  return { x: d.x - k * n.x, y: d.y - k * n.y };
}

export function rotate(a: Vec, ang: number): Vec {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
}

/** Perpendicular (90° CCW in a y-down space). */
export function perp(a: Vec): Vec {
  return { x: -a.y, y: a.x };
}

export interface Projection {
  /** Parameter along the segment, clamped to [0,1]. */
  t: number;
  /** Closest point on the segment. */
  point: Vec;
  /** Distance from p to that point. */
  distance: number;
}

/** Closest point on segment a→b to point p. Safe for degenerate (zero-length) segments. */
export function projectOnSegment(p: Vec, a: Vec, b: Vec): Projection {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const l2 = abx * abx + aby * aby;
  let t = 0;
  if (l2 > 1e-9) {
    t = clamp(((p.x - a.x) * abx + (p.y - a.y) * aby) / l2, 0, 1);
  }
  const point = { x: a.x + abx * t, y: a.y + aby * t };
  return { t, point, distance: Math.hypot(p.x - point.x, p.y - point.y) };
}

/** Unclamped parameter along the infinite line a→b. */
export function lineParam(p: Vec, a: Vec, b: Vec): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const l2 = abx * abx + aby * aby;
  if (l2 <= 1e-9) return 0;
  return ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2;
}

/** Vertices of a regular polygon, vertex k at angle `rotation + k * TAU / n`. */
export function regularPolygon(n: number, cx: number, cy: number, r: number, rotation: number): Vec[] {
  const out: Vec[] = [];
  for (let k = 0; k < n; k++) {
    const a = rotation + (k * TAU) / n;
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return out;
}

/**
 * Rotation that puts the midpoint of side `sideIndex` at screen-bottom
 * (angle +π/2 in a y-down coordinate space).
 */
export function rotationForBottomSide(n: number, sideIndex: number): number {
  return Math.PI / 2 - ((sideIndex + 0.5) * TAU) / n;
}

/** Is a point inside a convex polygon given in consistent winding order? */
export function insideConvex(p: Vec, verts: Vec[]): boolean {
  let sign = 0;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    const c = cross(sub(b, a), sub(p, a));
    if (Math.abs(c) < 1e-9) continue;
    const s = c > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** Smootherstep easing, used for the polygon morph. */
export function easeInOut(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/** Deterministic RNG so headless simulations are reproducible. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Approximately normal-distributed noise in roughly [-1, 1]. */
export function gauss(rng: () => number): number {
  return (rng() + rng() + rng() - 1.5) / 1.5;
}
