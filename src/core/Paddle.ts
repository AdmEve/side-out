import { clamp, lerpVec, type Vec } from './geometry.ts';
import type { Wall } from './Arena.ts';
import type { Player } from './Player.ts';

/** The two endpoints of a player's paddle, in world space. */
export function paddleSegment(p: Player, wall: Wall, now: number): [Vec, Vec] {
  const half = p.lengthFrac(now) / 2;
  const t = clamp(p.t, half, 1 - half);
  return [lerpVec(wall.a, wall.b, t - half), lerpVec(wall.a, wall.b, t + half)];
}

/** Move a paddle toward its target, respecting its speed limit and wall bounds. */
export function stepPaddle(p: Player, dt: number, now: number): void {
  const half = p.lengthFrac(now) / 2;
  const lo = half;
  const hi = 1 - half;
  const target = clamp(p.target, lo, hi);
  const maxDelta = p.speedNow(now) * dt;
  const prev = p.t;
  const delta = clamp(target - p.t, -maxDelta, maxDelta);
  p.t = clamp(p.t + delta, lo, hi);
  p.paddleVel = dt > 0 ? clamp((p.t - prev) / dt / Math.max(0.01, p.speedNow(now)), -1, 1) : 0;
}
