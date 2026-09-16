import { PADDLE, type BOTS } from '../config/balance.ts';
import type { Controller } from './Controller.ts';
import type { MatchState } from './MatchState.ts';
import type { Ball } from './Ball.ts';
import type { HazardKind } from './Player.ts';
import {
  type Vec,
  clamp,
  dot,
  gauss,
  lineParam,
  norm,
  reflect,
  sub,
} from './geometry.ts';

type BotConfig = (typeof BOTS)['normal'];

/**
 * Bot AI. Ray-traces the incoming ball through a couple of bounces to find
 * where it will cross this bot's wall, then tracks that point — late, and with
 * a little error, according to difficulty. Deliberately blind to hazards, so
 * saboteurs actually accomplish something.
 */
export class BotBrain implements Controller {
  private targetT = 0.5;
  private timer = 0;

  constructor(
    private readonly cfg: BotConfig,
    private readonly rng: () => number,
  ) {}

  update(dt: number, m: MatchState, id: number): number {
    this.timer -= dt;
    if (this.timer > 0) return this.targetT;
    this.timer = this.cfg.reaction;

    const solution = this.bestIntercept(m, id);
    if (solution === null) {
      // Nothing coming: ease back toward the middle of the wall.
      this.targetT = this.targetT + (0.5 - this.targetT) * this.cfg.idleDrift;
      return this.targetT;
    }

    const half = PADDLE.lengthFrac / 2;
    this.targetT = clamp(solution + gauss(this.rng) * this.cfg.error, half, 1 - half);
    return this.targetT;
  }

  sabotage(_dt: number, m: MatchState, _id: number): { kind: HazardKind; pos: Vec } | null {
    // Bots drop something every few seconds, aimed at a survivor's half of the field.
    if (this.rng() > 0.015) return null;
    const living = m.arena.livingOwners;
    if (!living.length) return null;
    const victim = living[Math.floor(this.rng() * living.length)];
    const wall = m.wallFor(victim);
    if (!wall) return null;

    const towards = sub(wall.mid, m.center);
    const reach = 0.45 + this.rng() * 0.3;
    const pos: Vec = {
      x: m.center.x + towards.x * reach + gauss(this.rng) * 40,
      y: m.center.y + towards.y * reach + gauss(this.rng) * 40,
    };
    if (!m.canPlaceAt(pos)) return null;

    const kinds: HazardKind[] = ['peg', 'peg', 'bar', 'well'];
    return { kind: kinds[Math.floor(this.rng() * kinds.length)], pos };
  }

  /** Soonest arrival of any ball at this bot's wall, as a 0..1 wall parameter. */
  private bestIntercept(m: MatchState, id: number): number | null {
    let bestTime = Infinity;
    let bestParam: number | null = null;

    for (const ball of m.balls) {
      if (!ball.active) continue;
      const hit = this.trace(m, ball, id);
      if (hit && hit.time < bestTime) {
        bestTime = hit.time;
        bestParam = hit.param;
      }
    }
    return bestParam;
  }

  private trace(m: MatchState, ball: Ball, id: number): { time: number; param: number } | null {
    const walls = m.arena.walls;
    const speed = Math.max(1, ball.speed);
    let pos: Vec = { x: ball.pos.x, y: ball.pos.y };
    let dir = norm(ball.vel);
    let travelled = 0;

    for (let bounce = 0; bounce <= this.cfg.bounces; bounce++) {
      let bestT = Infinity;
      let bestIdx = -1;
      let bestPoint: Vec = pos;
      let bestParam = 0;

      for (let i = 0; i < walls.length; i++) {
        const w = walls[i];
        if (w.length < 1e-3) continue;
        const denom = dot(dir, w.normal);
        if (denom > -1e-6) continue; // moving away from this wall
        const inside = dot(sub(pos, w.mid), w.normal);
        const t = inside / -denom;
        if (t < 1e-3 || t >= bestT) continue;
        const point: Vec = { x: pos.x + dir.x * t, y: pos.y + dir.y * t };
        const param = lineParam(point, w.a, w.b);
        if (param < -0.08 || param > 1.08) continue;
        bestT = t;
        bestIdx = i;
        bestPoint = point;
        bestParam = param;
      }

      if (bestIdx < 0) return null;
      travelled += bestT;

      if (walls[bestIdx].owner === id) {
        return { time: travelled / speed, param: clamp(bestParam, 0, 1) };
      }

      dir = norm(reflect(dir, walls[bestIdx].normal));
      pos = { x: bestPoint.x + dir.x * 0.75, y: bestPoint.y + dir.y * 0.75 };
    }

    return null;
  }
}
