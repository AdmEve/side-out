import { HAZARD } from '../config/balance.ts';
import type { HazardKind } from './Player.ts';
import { type Vec, norm, projectOnSegment, reflect } from './geometry.ts';
import type { Ball } from './Ball.ts';

export interface Hazard {
  id: number;
  kind: HazardKind;
  pos: Vec;
  /** Current rotation of a spinning bar, radians. */
  angle: number;
  /** Seconds remaining before it fades out. */
  life: number;
  /** Eliminated player who dropped it. */
  owner: number;
  /** Ramps 0 → 1 as it materialises, so it can't teleport onto a ball. */
  arm: number;
}

export function tickHazards(hazards: Hazard[], dt: number): void {
  for (let i = hazards.length - 1; i >= 0; i--) {
    const h = hazards[i];
    h.life -= dt;
    h.arm = Math.min(1, h.arm + dt * 2.5);
    if (h.kind === 'bar') h.angle += HAZARD.barSpin * dt;
    if (h.life <= 0) hazards.splice(i, 1);
  }
}

export function barEndpoints(h: Hazard): [Vec, Vec] {
  const hx = (Math.cos(h.angle) * HAZARD.barLength) / 2;
  const hy = (Math.sin(h.angle) * HAZARD.barLength) / 2;
  return [
    { x: h.pos.x - hx, y: h.pos.y - hy },
    { x: h.pos.x + hx, y: h.pos.y + hy },
  ];
}

/**
 * Resolve a ball against every hazard. Gravity wells bend the path without
 * changing speed; pegs and bars bounce. Returns the hazard that was struck,
 * or null.
 */
export function collideHazards(ball: Ball, hazards: Hazard[], dt: number): Hazard | null {
  let hit: Hazard | null = null;

  for (const h of hazards) {
    if (h.arm < 1) continue;

    if (h.kind === 'well') {
      const dx = h.pos.x - ball.pos.x;
      const dy = h.pos.y - ball.pos.y;
      const d = Math.hypot(dx, dy);
      if (d > 1e-3 && d < HAZARD.wellRadius) {
        const falloff = 1 - d / HAZARD.wellRadius;
        const a = HAZARD.wellStrength * falloff * falloff * dt;
        ball.vel.x += (dx / d) * a;
        ball.vel.y += (dy / d) * a;
        // Preserve speed: a well curves the ball, it never accelerates it.
        const s = Math.hypot(ball.vel.x, ball.vel.y);
        if (s > 1e-6) {
          ball.vel.x = (ball.vel.x / s) * ball.speed;
          ball.vel.y = (ball.vel.y / s) * ball.speed;
        }
      }
      continue;
    }

    if (h.kind === 'peg') {
      const dx = ball.pos.x - h.pos.x;
      const dy = ball.pos.y - h.pos.y;
      const d = Math.hypot(dx, dy);
      const minD = ball.radius + HAZARD.pegRadius;
      if (d < minD && d > 1e-6) {
        const n = { x: dx / d, y: dy / d };
        if (n.x * ball.vel.x + n.y * ball.vel.y < 0) {
          const r = reflect(ball.vel, n);
          ball.vel.x = r.x;
          ball.vel.y = r.y;
          hit = h;
        }
        ball.pos.x = h.pos.x + n.x * (minD + 0.5);
        ball.pos.y = h.pos.y + n.y * (minD + 0.5);
      }
      continue;
    }

    // Spinning bar: capsule collision plus a tangential kick from the spin.
    const [a, b] = barEndpoints(h);
    const proj = projectOnSegment(ball.pos, a, b);
    const minD = ball.radius + HAZARD.barThickness / 2;
    if (proj.distance < minD) {
      let n = norm({ x: ball.pos.x - proj.point.x, y: ball.pos.y - proj.point.y });
      if (n.x === 0 && n.y === 0) n = { x: 0, y: -1 };
      if (n.x * ball.vel.x + n.y * ball.vel.y < 0) {
        const r = reflect(ball.vel, n);
        // Tangential contribution from the bar sweeping through the contact point.
        const rx = proj.point.x - h.pos.x;
        const ry = proj.point.y - h.pos.y;
        const kick = HAZARD.barSpin * 0.35;
        const vx = r.x - ry * kick;
        const vy = r.y + rx * kick;
        const s = Math.hypot(vx, vy);
        ball.vel.x = (vx / s) * ball.speed;
        ball.vel.y = (vy / s) * ball.speed;
        hit = h;
      }
      ball.pos.x = proj.point.x + n.x * (minD + 0.5);
      ball.pos.y = proj.point.y + n.y * (minD + 0.5);
    }
  }

  return hit;
}
