import { BALL, HAZARD, PADDLE, POWERUP, WORLD } from '../config/balance.ts';
import { COLORS, mix, readable } from '../config/theme.ts';
import { barEndpoints } from '../core/Hazards.ts';
import type { MatchState } from '../core/MatchState.ts';
import { paddleSegment } from '../core/Paddle.ts';
import type { PowerKind } from '../core/PowerUps.ts';
import type { Vec } from '../core/geometry.ts';

/**
 * Draws the match as a survival arena floating in the void.
 *
 * A starfield and nebula wash sit behind everything, drawn once as textures.
 * On top of that: a faint structural floor, then walls, paddles, hazards,
 * pickups and balls, each rendered with the same three-pass neon stroke so
 * the whole arena reads as one consistent material — light on dark, nothing
 * solid or opaque except the glow itself.
 */
export class ArenaRenderer {
  private readonly glow: Phaser.GameObjects.Graphics;
  private readonly core: Phaser.GameObjects.Graphics;
  private readonly floor: Phaser.GameObjects.Graphics;
  private readonly nebula: Phaser.GameObjects.Image;
  private readonly stars: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    this.stars = scene.add
      .image(WORLD.w / 2, WORLD.h / 2, 'starfield')
      .setDisplaySize(WORLD.w, WORLD.h)
      .setDepth(-2);
    this.nebula = scene.add
      .image(WORLD.w / 2, WORLD.h / 2, 'nebula')
      .setDisplaySize(WORLD.w, WORLD.h)
      .setDepth(-1)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.floor = scene.add.graphics().setDepth(1);
    this.glow = scene.add.graphics().setDepth(2).setBlendMode(Phaser.BlendModes.ADD);
    this.core = scene.add.graphics().setDepth(3);
  }

  destroy(): void {
    this.stars.destroy();
    this.nebula.destroy();
    this.floor.destroy();
    this.glow.destroy();
    this.core.destroy();
  }

  draw(m: MatchState, now: number): void {
    const g = this.glow;
    const c = this.core;
    const f = this.floor;
    g.clear();
    c.clear();
    f.clear();

    const arena = m.arena;
    const verts = arena.verts;
    if (verts.length < 3) return;

    // How far the arena has closed in: 0 at full size, 1 fully shrunk.
    const danger = Math.min(1, Math.max(0, 1 - (arena.radiusScale - 0.74) / 0.26));

    this.drawFloor(m, f, danger, now);

    for (const wall of arena.walls) {
      if (wall.length < 1) continue;
      if (wall.owner === null) {
        // Boarding around the final duel — solid, and obviously not a seat.
        const col = mix(COLORS.textDim, COLORS.warn, danger * 0.5);
        this.neon(wall.a, wall.b, col, 7, 0.85);
        continue;
      }
      this.drawSeatWall(m, wall, now, danger);
    }

    this.drawPaddles(m, now);
    this.drawHazards(m, now);
    this.drawPowerups(m, now);
    this.drawBalls(m);
  }

  // ------------------------------------------------------------------ floor

  private drawFloor(m: MatchState, f: Phaser.GameObjects.Graphics, danger: number, now: number): void {
    const arena = m.arena;

    // A faint fill so the arena reads as a place, not just an outline.
    f.fillStyle(mix(COLORS.bgRaised, COLORS.warn, danger * 0.12), 0.55);
    f.fillPoints(arena.verts as Phaser.Types.Math.Vector2Like[], true);

    // Concentric rings, the innermost pulsing gently — the reactor at the
    // centre of the arena, quiet enough to sit under the play.
    const rings = 3;
    for (let i = 1; i <= rings; i++) {
      const r = arena.radius * (i / rings) * 0.9;
      f.lineStyle(1, COLORS.grid, 0.35);
      f.strokeCircle(arena.cx, arena.cy, r);
    }
    const pulse = 0.5 + 0.5 * Math.sin(now * 1.6);
    f.lineStyle(2, COLORS.accent, 0.12 + 0.1 * pulse);
    f.strokeCircle(arena.cx, arena.cy, arena.radius * 0.16 + pulse * 4);

    // Radial spokes toward each surviving wall — a HUD-grid feel rather than
    // a sports-pitch marking.
    f.lineStyle(1, COLORS.gridDim, 0.5);
    f.beginPath();
    for (const wall of arena.walls) {
      if (wall.length < 1) continue;
      f.moveTo(arena.cx, arena.cy);
      f.lineTo(wall.mid.x, wall.mid.y);
    }
    f.strokePath();
  }

  // --------------------------------------------------------------- seat wall

  private drawSeatWall(
    m: MatchState,
    wall: { a: Vec; b: Vec; mid: Vec; normal: Vec; tangent: Vec; length: number; owner: number | null },
    now: number,
    danger: number,
  ): void {
    const p = m.player(wall.owner as number);
    const g = this.glow;
    const c = this.core;
    const col = readable(p.color);

    // On the last life the wall turns red and pulses — visible even far from
    // the ball, which matters during a fast rally.
    const lastLife = p.alive && p.lives <= 1;
    const pulse = lastLife ? 0.6 + 0.4 * Math.sin(now * 7 + p.id) : 0;
    const lineCol = lastLife ? mix(col, COLORS.warn, 0.85) : mix(col, COLORS.warn, danger * 0.35);
    const lineAlpha = p.alive ? (lastLife ? 0.4 + 0.45 * pulse : 0.55) : 0.14;

    this.neon(wall.a, wall.b, lineCol, lastLife ? 5 : 3, lineAlpha);

    // End caps: a small bright node at each corner, like a terminal on a
    // circuit board.
    const capCol = p.alive ? col : COLORS.textFaint;
    for (const cap of [wall.a, wall.b]) {
      g.fillStyle(capCol, 0.3);
      g.fillCircle(cap.x, cap.y, 11);
      c.fillStyle(capCol, 0.95);
      c.fillCircle(cap.x, cap.y, 5);
    }
  }

  // ---------------------------------------------------------------- paddles

  private drawPaddles(m: MatchState, now: number): void {
    const g = this.glow;

    for (const p of m.players) {
      if (!p.alive) continue;
      const wall = m.arena.wallOf(p.id);
      if (!wall || wall.length < 1) continue;
      const [a, b] = paddleSegment(p, wall, m.time);
      const col = readable(p.color);

      // The paddle itself: a bright bar riding the wall, always brighter than
      // the wall line behind it so it reads as the thing you're moving.
      this.neon(a, b, col, PADDLE.thickness, 1);

      if (m.time < p.wideUntil) {
        const flick = 0.1 + 0.06 * Math.sin(now * 9);
        g.lineStyle(PADDLE.thickness * 4.5, col, flick);
        g.beginPath();
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
        g.strokePath();
      }

      if (p.shield) {
        // A second bar floating just off the line — one hit to burn through.
        const off = 14;
        const sa = { x: a.x + wall.normal.x * off, y: a.y + wall.normal.y * off };
        const sb = { x: b.x + wall.normal.x * off, y: b.y + wall.normal.y * off };
        this.neon(sa, sb, COLORS.gold, 4, 0.9);
      }
    }
  }

  // ---------------------------------------------------------------- hazards

  private drawHazards(m: MatchState, now: number): void {
    const g = this.glow;
    const c = this.core;

    for (const h of m.hazards) {
      const fade = Math.min(1, h.life / 2) * h.arm;
      if (h.kind === 'peg') {
        const r = HAZARD.pegRadius;
        g.fillStyle(COLORS.hazard, 0.22 * fade);
        g.fillCircle(h.pos.x, h.pos.y, r * 1.8);
        c.fillStyle(COLORS.hazard, 0.9 * fade);
        c.fillCircle(h.pos.x, h.pos.y, r);
        c.lineStyle(2, 0xffffff, 0.55 * fade);
        c.strokeCircle(h.pos.x, h.pos.y, r);
      } else if (h.kind === 'well') {
        const pulse = 0.7 + 0.3 * Math.sin(now * 4 + h.id);
        // The pull field reaches out to the full wellRadius, but painting a
        // fill that wide is the single most expensive thing on screen once a
        // few wells are live at once (each one a ~130px-radius additive
        // disc). A much smaller core plus the ring/arc strokes below reads
        // the same "gravity well" without the overdraw.
        g.fillStyle(COLORS.wind, 0.16 * fade * pulse);
        g.fillCircle(h.pos.x, h.pos.y, HAZARD.wellRadius * 0.4 * h.arm);
        c.lineStyle(2, COLORS.wind, 0.4 * fade);
        c.strokeCircle(h.pos.x, h.pos.y, HAZARD.wellRadius * h.arm);
        for (let k = 0; k < 3; k++) {
          const r = HAZARD.wellRadius * (0.25 + k * 0.22) * h.arm;
          c.lineStyle(2, COLORS.wind, (0.8 - k * 0.2) * fade);
          c.beginPath();
          c.arc(h.pos.x, h.pos.y, r, now * (1.6 + k * 0.6), now * (1.6 + k * 0.6) + 2.1);
          c.strokePath();
        }
      } else {
        const [a, b] = barEndpoints(h);
        this.neon(a, b, COLORS.hazard, HAZARD.barThickness * h.arm, 0.95 * fade);
        c.fillStyle(COLORS.hazard, fade);
        c.fillCircle(h.pos.x, h.pos.y, 5);
      }
    }
  }

  // --------------------------------------------------------------- pickups

  private drawPowerups(m: MatchState, now: number): void {
    const g = this.glow;
    const c = this.core;

    for (const pu of m.powerups) {
      const bob = Math.sin(now * 3 + pu.id) * 4;
      const r = POWERUP.radius * pu.arm;
      const x = pu.pos.x;
      const y = pu.pos.y + bob;

      g.fillStyle(COLORS.powerup, 0.16);
      g.fillCircle(x, y, r * 2.2);
      c.lineStyle(3, COLORS.powerup, 0.95);
      c.strokeCircle(x, y, r);
      this.drawPowerIcon(c, pu.kind, x, y, r * 0.55);
    }
  }

  /** Drawn, not written — the icon reads the same regardless of language. */
  private drawPowerIcon(
    c: Phaser.GameObjects.Graphics,
    kind: PowerKind,
    x: number,
    y: number,
    s: number,
  ): void {
    c.lineStyle(3, COLORS.powerup, 1);
    if (kind === 'wide') {
      c.beginPath();
      c.moveTo(x - s, y);
      c.lineTo(x + s, y);
      c.moveTo(x - s, y);
      c.lineTo(x - s * 0.45, y - s * 0.5);
      c.moveTo(x - s, y);
      c.lineTo(x - s * 0.45, y + s * 0.5);
      c.moveTo(x + s, y);
      c.lineTo(x + s * 0.45, y - s * 0.5);
      c.moveTo(x + s, y);
      c.lineTo(x + s * 0.45, y + s * 0.5);
      c.strokePath();
    } else if (kind === 'shield') {
      c.beginPath();
      c.moveTo(x, y - s);
      c.lineTo(x + s * 0.8, y - s * 0.4);
      c.lineTo(x + s * 0.55, y + s * 0.8);
      c.lineTo(x, y + s);
      c.lineTo(x - s * 0.55, y + s * 0.8);
      c.lineTo(x - s * 0.8, y - s * 0.4);
      c.closePath();
      c.strokePath();
    } else if (kind === 'slow') {
      c.strokeCircle(x, y, s);
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x, y - s * 0.6);
      c.moveTo(x, y);
      c.lineTo(x + s * 0.45, y + s * 0.2);
      c.strokePath();
    } else {
      c.beginPath();
      c.moveTo(x - s, y);
      c.lineTo(x + s, y);
      c.moveTo(x, y - s);
      c.lineTo(x, y + s);
      c.strokePath();
    }
  }

  // ------------------------------------------------------------------ balls

  private drawBalls(m: MatchState): void {
    const g = this.glow;
    const c = this.core;

    const activeBalls = m.balls.reduce((n, b) => (b.active ? n + 1 : n), 0);
    // Every ball's trail is a handful of additive strokes; fine for one or
    // two balls, but it's pure overdraw once a full escalation's worth are
    // bouncing around together. Fewer bands per ball as the field gets
    // busier keeps the total draw cost roughly flat instead of scaling with
    // ball count on top of everything else in play.
    const bands = activeBalls >= 4 ? 1 : activeBalls >= 2 ? 2 : 3;

    for (const ball of m.balls) {
      if (!ball.active) continue;
      const tint = ball.lastToucher === null ? 0xffffff : m.player(ball.lastToucher).color;

      this.drawTrail(ball.trail, tint, bands);

      g.fillStyle(tint, 0.25);
      g.fillCircle(ball.pos.x, ball.pos.y, BALL.radius * 2.2);
      g.fillStyle(tint, 0.4);
      g.fillCircle(ball.pos.x, ball.pos.y, BALL.radius * 1.4);

      c.fillStyle(0xffffff, 1);
      c.fillCircle(ball.pos.x, ball.pos.y, BALL.radius);
      c.fillStyle(tint, 0.85);
      c.fillCircle(ball.pos.x, ball.pos.y, BALL.radius * 0.5);
    }
  }

  /**
   * A trail point per frame of history used to mean a stroke call per point
   * — up to a dozen `lineStyle`+`strokePath` pairs per ball, per frame, for
   * every ball on the field. Banding the trail into a handful of continuous
   * polylines keeps the same taper (thin/dim near the tail, thick/bright at
   * the head) for a fraction of the draw calls.
   */
  private drawTrail(trail: Vec[], tint: number, bands: number): void {
    const g = this.glow;
    const n = trail.length;
    if (n < 2) return;
    for (let band = 0; band < bands; band++) {
      const lo = Math.floor((band / bands) * (n - 1));
      const hi = Math.floor(((band + 1) / bands) * (n - 1));
      if (hi <= lo) continue;
      const t = (lo + hi) / 2 / (n - 1);
      g.lineStyle(BALL.radius * 1.6 * t, tint, 0.18 * t);
      g.beginPath();
      g.moveTo(trail[lo].x, trail[lo].y);
      for (let i = lo + 1; i <= hi; i++) g.lineTo(trail[i].x, trail[i].y);
      g.strokePath();
    }
  }

  /** Two-pass neon stroke: one soft glow pass, then a bright core, rounded ends. */
  private neon(a: Vec, b: Vec, color: number, width: number, alpha: number): void {
    const g = this.glow;
    const c = this.core;

    const mult = 2.6;
    const a0 = 0.13;
    g.lineStyle(width * mult, color, a0 * alpha);
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.strokePath();
    g.fillStyle(color, a0 * alpha);
    g.fillCircle(a.x, a.y, (width * mult) / 2);
    g.fillCircle(b.x, b.y, (width * mult) / 2);

    c.lineStyle(width, color, alpha);
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.strokePath();
    c.fillStyle(color, alpha);
    c.fillCircle(a.x, a.y, width / 2);
    c.fillCircle(b.x, b.y, width / 2);
  }
}
