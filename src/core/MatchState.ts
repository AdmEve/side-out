import {
  ARENA,
  BALL,
  BOTS,
  ESCALATION,
  HAZARD,
  MATCH,
  PADDLE,
  POWERUP,
  type Difficulty,
} from '../config/balance.ts';
import { PLAYER_COLORS, PLAYER_NAMES } from '../config/theme.ts';
import { Arena, type Wall } from './Arena.ts';
import { Ball } from './Ball.ts';
import { BotBrain } from './BotBrain.ts';
import type { Controller } from './Controller.ts';
import { type Hazard, collideHazards, tickHazards } from './Hazards.ts';
import { Player, type HazardKind } from './Player.ts';
import { paddleSegment, stepPaddle } from './Paddle.ts';
import {
  POWER_KINDS,
  type PowerKind,
  type PowerUp,
  applyPower,
} from './PowerUps.ts';
import {
  type Vec,
  TAU,
  clamp,
  dot,
  easeInOut,
  gauss,
  makeRng,
  norm,
  projectOnSegment,
  reflect,
  sub,
} from './geometry.ts';

export type GameEvent =
  | { type: 'paddleHit'; player: number; pos: Vec; speed: number }
  | { type: 'wallHit'; pos: Vec }
  | { type: 'hazardHit'; pos: Vec; kind: HazardKind }
  | { type: 'miss'; player: number; pos: Vec; livesLeft: number; shielded: boolean }
  | { type: 'eliminated'; player: number; a: Vec; b: Vec; placement: number }
  | { type: 'ballSpawn'; pos: Vec; count: number }
  | { type: 'powerup'; player: number; kind: PowerKind; pos: Vec }
  | { type: 'hazardPlaced'; kind: HazardKind; pos: Vec; owner: number }
  | { type: 'win'; player: number };

/** One seat: name and colour. Missing entries fall back to the default roster. */
export interface SeatConfig {
  name: string;
  color: number;
}

export interface MatchOptions {
  /** Humans sharing the device, 1..4. They are seated evenly around the ring. */
  humans: number;
  difficulty: Difficulty;
  seed?: number;
  playerCount?: number;
  /** Name/colour per seat. Missing entries fall back to the default roster. */
  seats?: readonly SeatConfig[];
}

export type Phase = 'countdown' | 'playing' | 'over';

/**
 * Which seats the humans occupy — spread as evenly around the ring as the
 * count allows, so people sharing a device face each other rather than sitting
 * side by side. Exported because the scene needs it to hand out seats.
 */
export function humanSeats(humans: number, count: number): number[] {
  const seats: number[] = [];
  for (let i = 0; i < humans; i++) {
    const seat = Math.round((i * count) / humans) % count;
    if (!seats.includes(seat)) seats.push(seat);
  }
  return seats;
}

export class MatchState {
  readonly players: Player[] = [];
  readonly humanIds: number[] = [];
  readonly arena: Arena;
  readonly balls: Ball[] = [];
  readonly hazards: Hazard[] = [];
  readonly powerups: PowerUp[] = [];
  readonly controllers = new Map<number, Controller>();

  /** Events produced this step; the presentation layer drains this each frame. */
  events: GameEvent[] = [];

  phase: Phase = 'countdown';
  countdown: number = MATCH.countdown;
  time = 0;
  winner: number | null = null;

  /** Match time until which every ball is slowed by the SLOW power-up. */
  slowUntil = 0;

  private rng: () => number;
  private nextId = 1;
  private nextExtraBall = 0;
  private nextPowerupAt: number = POWERUP.firstAt;
  private readonly difficulty: Difficulty;

  constructor(opts: MatchOptions) {
    const count = opts.playerCount ?? MATCH.playerCount;
    const humans = clamp(opts.humans, 0, count);
    this.difficulty = opts.difficulty;
    this.rng = makeRng(opts.seed ?? 0x5eed1234);

    const seatedHumans = new Set(humanSeats(humans, count));

    const cfg = BOTS[opts.difficulty];
    for (let i = 0; i < count; i++) {
      const isHuman = seatedHumans.has(i);
      const seat = opts.seats?.[i];
      const name = seat?.name ?? PLAYER_NAMES[i % PLAYER_NAMES.length];
      const color = seat?.color ?? PLAYER_COLORS[i % PLAYER_COLORS.length];
      const baseSpeed = isHuman ? PADDLE.humanSpeed : cfg.speed;
      const p = new Player(i, name, isHuman, color, baseSpeed);
      if (isHuman) {
        this.humanIds.push(i);
        p.manualSabotage = this.humanIds.length === 1;
      } else {
        const botSeed = ((opts.seed ?? 1) * 0x9e3779b1 + (i + 1) * 0x85ebca6b) >>> 0;
        this.controllers.set(i, new BotBrain(cfg, makeRng(botSeed)));
      }
      this.players.push(p);
    }

    this.arena = new Arena(
      ARENA.cx,
      ARENA.cy,
      ARENA.radius,
      this.players.map((p) => p.id),
      this.humanIds.length ? this.humanIds[0] : null,
    );
    this.spawnBall();
  }

  // ---------------------------------------------------------------- queries

  get aliveCount(): number {
    return this.players.reduce((n, p) => (p.alive ? n + 1 : n), 0);
  }

  get center(): Vec {
    return { x: this.arena.cx, y: this.arena.cy };
  }

  player(id: number): Player {
    return this.players[id];
  }

  wallFor(id: number): Wall | undefined {
    return this.arena.wallOf(id);
  }

  /** Seconds of survival, for the results screen. */
  survivalOf(p: Player): number {
    return p.alive ? this.time : p.eliminatedAt;
  }

  get slowFactor(): number {
    return this.time < this.slowUntil ? POWERUP.slowFactor : 1;
  }

  // ------------------------------------------------------------------- loop

  /** Advance the whole simulation by a fixed timestep. */
  step(dt: number): void {
    if (this.phase === 'over') return;

    if (this.phase === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.countdown = 0;
        this.phase = 'playing';
      }
      return;
    }

    this.time += dt;
    this.updateEscalation();
    this.updateControllers(dt);
    this.arena.update(dt);
    tickHazards(this.hazards, dt);
    this.updatePowerups(dt);
    this.updateBalls(dt);
    this.updateSabotage(dt);
    this.checkVictory();
  }

  private updateEscalation(): void {
    // The walls start closing in late in the match.
    if (this.time > ARENA.shrinkStart) {
      const k = clamp((this.time - ARENA.shrinkStart) / ARENA.shrinkDuration, 0, 1);
      this.arena.radiusScale = 1 + (ARENA.minRadiusScale - 1) * easeInOut(k);
    }

    while (
      this.nextExtraBall < ESCALATION.extraBallTimes.length &&
      this.time >= ESCALATION.extraBallTimes[this.nextExtraBall]
    ) {
      this.nextExtraBall++;
      if (this.balls.length < ESCALATION.maxBalls) this.spawnBall();
    }
  }

  private updateControllers(dt: number): void {
    for (const p of this.players) {
      if (!p.alive) continue;
      const c = this.controllers.get(p.id);
      if (c) p.target = c.update(dt, this, p.id);
      stepPaddle(p, dt, this.time);
    }
  }

  private updateSabotage(dt: number): void {
    for (const p of this.players) {
      if (p.alive) continue;
      if (p.hazardCooldown > 0) p.hazardCooldown -= dt;
      if (p.manualSabotage) continue; // driven by the on-screen controls instead
      if (p.hazardCooldown > 0) continue;
      const c = this.controllers.get(p.id);
      const req = c?.sabotage?.(dt, this, p.id) ?? this.autoSabotage();
      if (req) this.requestHazard(p.id, req.kind, req.pos);
    }
  }

  /** Fallback saboteur behaviour: drop something random in the live area. */
  private autoSabotage(): { kind: HazardKind; pos: Vec } | null {
    if (this.rng() > 0.02) return null; // roughly once every couple of seconds
    const kinds: HazardKind[] = ['peg', 'peg', 'well', 'bar'];
    const kind = kinds[Math.floor(this.rng() * kinds.length)];
    const r = this.arena.radius * (0.15 + this.rng() * 0.55);
    const a = this.rng() * TAU;
    return { kind, pos: { x: this.arena.cx + Math.cos(a) * r, y: this.arena.cy + Math.sin(a) * r } };
  }

  // ----------------------------------------------------------------- balls

  private spawnBall(): void {
    const a = this.rng() * TAU;
    const ball = new Ball(
      this.nextId++,
      this.center,
      { x: Math.cos(a), y: Math.sin(a) },
      BALL.baseSpeed,
    );
    this.balls.push(ball);
    this.events.push({ type: 'ballSpawn', pos: this.center, count: this.balls.length });
  }

  private resetBall(ball: Ball): void {
    ball.active = false;
    ball.respawnIn = BALL.respawnDelay;
    ball.lastToucher = null;
    ball.trail.length = 0;
    ball.speed = BALL.baseSpeed;
    ball.pos = this.center;
  }

  private updateBalls(dt: number): void {
    const slow = this.slowFactor;

    for (const ball of this.balls) {
      if (!ball.active) {
        ball.respawnIn -= dt;
        if (ball.respawnIn <= 0) {
          const a = this.rng() * TAU;
          ball.pos = this.center;
          ball.setDirection({ x: Math.cos(a), y: Math.sin(a) }, BALL.baseSpeed);
          ball.active = true;
          this.events.push({ type: 'ballSpawn', pos: this.center, count: this.balls.length });
        }
        continue;
      }

      ball.pos.x += ball.vel.x * dt * slow;
      ball.pos.y += ball.vel.y * dt * slow;
      ball.pushTrail();

      const haz = collideHazards(ball, this.hazards, dt * slow);
      if (haz) this.events.push({ type: 'hazardHit', pos: { ...ball.pos }, kind: haz.kind });

      this.collideWalls(ball);
      this.containBall(ball);
      this.collidePowerups(ball);

      // Safety net: a ball that ends up far outside is returned to play.
      const dcx = ball.pos.x - this.arena.cx;
      const dcy = ball.pos.y - this.arena.cy;
      if (Math.hypot(dcx, dcy) > this.arena.radius * 2 || !Number.isFinite(ball.pos.x)) {
        this.resetBall(ball);
      }
    }
  }

  /**
   * Last line of defence. The arena reshapes itself while balls are in flight,
   * and a ball can end up on the wrong side of a wall that was somewhere else a
   * moment ago. If one is deep outside and still in play, it goes back into
   * play — as a point against the wall it is behind, if that wall has a living
   * owner, and otherwise simply returned to the centre.
   */
  private containBall(ball: Ball): void {
    if (!ball.active) return;
    let worst = 0;
    let wallOwner: number | null = null;
    for (const w of this.arena.walls) {
      if (w.length < 1e-3) continue;
      const signed = dot(sub(ball.pos, w.mid), w.normal);
      if (signed < worst) {
        worst = signed;
        wallOwner = w.owner;
      }
    }
    if (worst > -BALL.outMargin) return;

    const pos = { ...ball.pos };
    this.resetBall(ball);
    if (wallOwner !== null && this.players[wallOwner]?.alive) this.concede(wallOwner, pos);
  }

  private collideWalls(ball: Ball): void {
    const walls = this.arena.walls;

    // Pass 1 — has the ball already gone out? Near a corner it can be behind two
    // walls at once, so the point goes to the wall it is furthest past. This runs
    // before any bounce so a solid wall shoving the ball back in can never hide a
    // miss that already happened on the owned wall beside it.
    let worstDepth = 0;
    let culprit: number | null = null;
    for (const wall of walls) {
      if (wall.length < 1e-3 || wall.owner === null) continue;
      const owner = this.players[wall.owner];
      if (!owner || !owner.alive) continue;
      const signed = dot(sub(ball.pos, wall.mid), wall.normal);
      if (signed < -BALL.outMargin && signed < worstDepth) {
        worstDepth = signed;
        culprit = owner.id;
      }
    }
    if (culprit !== null) {
      const pos = { ...ball.pos };
      this.resetBall(ball);
      this.concede(culprit, pos);
      return;
    }

    // Pass 2 — bounces.
    for (let i = 0; i < walls.length; i++) {
      const wall = walls[i];
      if (wall.length < 1e-3) continue;

      if (wall.owner === null) {
        // Solid wall (the duel arena's sides). Tested against the wall's plane
        // rather than its segment so it also contains a ball that the morphing
        // arena left stranded outside — a solid wall never lets anything past.
        const signed = dot(sub(ball.pos, wall.mid), wall.normal);
        if (signed < ball.radius) {
          if (dot(ball.vel, wall.normal) < 0) {
            const r = reflect(ball.vel, wall.normal);
            ball.vel.x = r.x;
            ball.vel.y = r.y;
            this.events.push({ type: 'wallHit', pos: { ...ball.pos } });
          }
          const push = ball.radius - signed + 0.5;
          ball.pos.x += wall.normal.x * push;
          ball.pos.y += wall.normal.y * push;
          return;
        }
        continue;
      }

      const owner = this.players[wall.owner];
      if (!owner || !owner.alive) continue;

      const [pa, pb] = paddleSegment(owner, wall, this.time);
      const proj = projectOnSegment(ball.pos, pa, pb);
      const reach = ball.radius + PADDLE.thickness / 2;
      if (proj.distance < reach && dot(ball.vel, wall.normal) < 0) {
        this.returnBall(ball, wall, owner.id, proj.t);
        return;
      }
    }
  }

  private returnBall(ball: Ball, wall: Wall, playerId: number, hitT: number): void {
    const p = this.players[playerId];
    p.hits++;
    ball.lastToucher = playerId;

    const dir = norm(reflect(ball.vel, wall.normal));
    // Where on the paddle it landed bends the shot; a moving paddle adds english.
    const offset = (hitT - 0.5) * 2;
    let out = norm({
      x: dir.x + wall.tangent.x * (offset * PADDLE.angleInfluence + p.paddleVel * PADDLE.english),
      y: dir.y + wall.tangent.y * (offset * PADDLE.angleInfluence + p.paddleVel * PADDLE.english),
    });

    // Never let a return graze along the wall forever.
    const c = dot(out, wall.normal);
    if (c < PADDLE.minNormalComponent) {
      const side = dot(out, wall.tangent) >= 0 ? 1 : -1;
      const tComp = Math.sqrt(Math.max(0, 1 - PADDLE.minNormalComponent ** 2)) * side;
      out = norm({
        x: wall.normal.x * PADDLE.minNormalComponent + wall.tangent.x * tComp,
        y: wall.normal.y * PADDLE.minNormalComponent + wall.tangent.y * tComp,
      });
    }

    const speed = Math.min(ball.speed * BALL.speedUp, BALL.maxSpeed);
    ball.setDirection(out, speed);

    // Lift the ball clear of the paddle so it can't re-trigger next step.
    const push = ball.radius + PADDLE.thickness / 2 + 1;
    const back = projectOnSegment(ball.pos, wall.a, wall.b).point;
    ball.pos.x = back.x + wall.normal.x * push;
    ball.pos.y = back.y + wall.normal.y * push;

    this.events.push({ type: 'paddleHit', player: playerId, pos: { ...ball.pos }, speed });
  }

  private concede(playerId: number, pos: Vec): void {
    const p = this.players[playerId];
    if (!p.alive) return;

    if (p.shield) {
      p.shield = false;
      this.events.push({ type: 'miss', player: playerId, pos, livesLeft: p.lives, shielded: true });
      return;
    }

    p.lives--;
    this.events.push({ type: 'miss', player: playerId, pos, livesLeft: p.lives, shielded: false });
    if (p.lives > 0) return;

    // Wall shatters — they're out.
    const wall = this.arena.wallOf(playerId);
    const a = wall ? { ...wall.a } : pos;
    const b = wall ? { ...wall.b } : pos;

    p.alive = false;
    p.eliminatedAt = this.time;
    p.placement = this.aliveCount + 1; // aliveCount already excludes them
    p.hazardCooldown = HAZARD.cooldown * 0.4;

    this.arena.eliminate(playerId);
    this.gatherBalls();
    if (this.arena.anchor === playerId) {
      const nextHuman = this.humanIds.find((id) => this.players[id].alive);
      this.arena.setAnchor(nextHuman ?? null);
    }

    this.events.push({ type: 'eliminated', player: playerId, a, b, placement: p.placement });
  }

  /**
   * Pull live balls in toward the centre when the arena is about to re-shape,
   * so nothing is left stranded in the corner that is closing up.
   */
  private gatherBalls(): void {
    // Measure the shape the arena has *right now* — the collapsed ring, which
    // is tighter than the regular polygon it is about to tween into. Using the
    // target shape here leaves balls stranded in the corner that is closing.
    let inradius = Infinity;
    for (const w of this.arena.walls) {
      if (w.length < 1e-3) continue;
      inradius = Math.min(inradius, Math.hypot(w.mid.x - this.arena.cx, w.mid.y - this.arena.cy));
    }
    if (!Number.isFinite(inradius)) return;
    const safe = Math.max(40, inradius - BALL.radius - 12);

    for (const ball of this.balls) {
      if (!ball.active) continue;
      const dx = ball.pos.x - this.arena.cx;
      const dy = ball.pos.y - this.arena.cy;
      const d = Math.hypot(dx, dy);
      if (d <= safe || d < 1e-6) continue;
      ball.pos.x = this.arena.cx + (dx / d) * safe;
      ball.pos.y = this.arena.cy + (dy / d) * safe;
      ball.trail.length = 0;
    }
  }

  private checkVictory(): void {
    if (this.aliveCount > 1) return;
    const last = this.players.find((p) => p.alive);
    if (last) {
      last.placement = 1;
      this.winner = last.id;
      this.events.push({ type: 'win', player: last.id });
    }
    this.phase = 'over';
  }

  // -------------------------------------------------------------- pickups

  private updatePowerups(dt: number): void {
    for (const pu of this.powerups) pu.arm = Math.min(1, pu.arm + dt * 3);

    if (this.time < this.nextPowerupAt) return;
    this.nextPowerupAt = this.time + POWERUP.interval;
    if (this.powerups.length >= POWERUP.maxOnField) return;

    const kind = POWER_KINDS[Math.floor(this.rng() * POWER_KINDS.length)];
    const r = this.arena.radius * (0.25 + this.rng() * 0.4);
    const a = this.rng() * TAU;
    this.powerups.push({
      id: this.nextId++,
      kind,
      pos: { x: this.arena.cx + Math.cos(a) * r, y: this.arena.cy + Math.sin(a) * r },
      arm: 0,
    });
  }

  private collidePowerups(ball: Ball): void {
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pu = this.powerups[i];
      if (pu.arm < 1) continue;
      const d = Math.hypot(ball.pos.x - pu.pos.x, ball.pos.y - pu.pos.y);
      if (d > ball.radius + POWERUP.radius) continue;
      if (ball.lastToucher === null) continue;
      const p = this.players[ball.lastToucher];
      if (!p.alive) continue;

      const res = applyPower(pu.kind, p, this.time);
      if (res.slowUntil) this.slowUntil = res.slowUntil;
      this.events.push({ type: 'powerup', player: p.id, kind: pu.kind, pos: { ...pu.pos } });
      this.powerups.splice(i, 1);
    }
  }

  // -------------------------------------------------------------- sabotage

  /** Valid drop spot? Must be inside the arena and clear of the walls. */
  canPlaceAt(pos: Vec): boolean {
    for (const w of this.arena.walls) {
      if (w.length < 1e-3) continue;
      if (dot(sub(pos, w.mid), w.normal) < HAZARD.edgeMargin) return false;
    }
    return true;
  }

  /** Drop a hazard on behalf of an eliminated player. Returns true if it landed. */
  requestHazard(playerId: number, kind: HazardKind, pos: Vec): boolean {
    const p = this.players[playerId];
    if (!p || p.alive || p.hazardCooldown > 0) return false;
    if (this.phase !== 'playing') return false;
    if (!this.canPlaceAt(pos)) return false;

    if (this.hazards.length >= HAZARD.maxOnField) this.hazards.shift();
    this.hazards.push({
      id: this.nextId++,
      kind,
      pos: { ...pos },
      angle: this.rng() * TAU,
      life: HAZARD.lifetime,
      owner: playerId,
      arm: 0,
    });
    p.hazardCooldown = HAZARD.cooldown;
    this.events.push({ type: 'hazardPlaced', kind, pos: { ...pos }, owner: playerId });
    return true;
  }

  /** Random noise source shared with presentation code that wants determinism. */
  noise(): number {
    return gauss(this.rng);
  }
}
