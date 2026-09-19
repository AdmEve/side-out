import { COLORS, FONT } from '../config/theme.ts';

/**
 * Particles, ripples, shatters and shake. Everything here is decoration —
 * removing it would not change a single simulation outcome.
 */
interface Ripple {
  x: number;
  y: number;
  color: number;
  fromR: number;
  toR: number;
  duration: number;
  elapsed: number;
}

export class Fx {
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly shards: Phaser.GameObjects.Particles.ParticleEmitter;
  // A ripple used to be its own Graphics object plus its own tween. Fine for
  // one at a time, but a burst of hits/misses from several fast balls could
  // have a dozen of them alive together, each independently cleared and
  // redrawn every frame. Batched onto one shared Graphics object and stepped
  // by hand instead, the cost stays flat no matter how many are in flight.
  private readonly rippleGfx: Phaser.GameObjects.Graphics;
  private readonly ripples: Ripple[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    this.rippleGfx = scene.add.graphics().setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
    this.sparks = scene.add
      .particles(0, 0, 'spark', {
        speed: { min: 60, max: 320 },
        lifespan: { min: 180, max: 480 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 1, end: 0 },
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(6);

    this.shards = scene.add
      .particles(0, 0, 'shard', {
        speed: { min: 120, max: 520 },
        lifespan: { min: 500, max: 1100 },
        scale: { start: 1.1, end: 0.2 },
        alpha: { start: 1, end: 0 },
        rotate: { min: -220, max: 220 },
        gravityY: 240,
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(6);
  }

  hit(x: number, y: number, color: number, power = 1): void {
    this.sparks.setParticleTint(color);
    this.sparks.emitParticleAt(x, y, Math.round(5 + power * 7));
  }

  pickup(x: number, y: number): void {
    this.sparks.setParticleTint(COLORS.powerup);
    this.sparks.emitParticleAt(x, y, 22);
    this.ripple(x, y, COLORS.powerup, 90, 380);
  }

  hazard(x: number, y: number): void {
    this.sparks.setParticleTint(COLORS.hazard);
    this.sparks.emitParticleAt(x, y, 6);
  }

  miss(x: number, y: number, color: number): void {
    this.sparks.setParticleTint(color);
    this.sparks.emitParticleAt(x, y, 16);
    this.ripple(x, y, color, 120, 460);
    this.scene.cameras.main.shake(140, 0.004);
  }

  /** A player's wall breaking apart — the big moment of every elimination. */
  shatter(ax: number, ay: number, bx: number, by: number, color: number): void {
    this.shards.setParticleTint(color);
    const pieces = 14;
    for (let i = 0; i <= pieces; i++) {
      const t = i / pieces;
      this.shards.emitParticleAt(ax + (bx - ax) * t, ay + (by - ay) * t, 2);
    }
    this.scene.cameras.main.shake(420, 0.012);
    this.scene.cameras.main.flash(120, 40, 44, 72);
  }

  ripple(x: number, y: number, color: number, radius = 100, duration = 420): void {
    this.ripples.push({ x, y, color, fromR: 6, toR: radius, duration, elapsed: 0 });
  }

  /** Steps and redraws every live ripple in one pass. Call once per frame. */
  update(deltaMs: number): void {
    if (this.ripples.length === 0) return;
    const g = this.rippleGfx;
    g.clear();
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.elapsed += deltaMs;
      const t = Math.min(1, r.elapsed / r.duration);
      if (t >= 1) {
        this.ripples.splice(i, 1);
        continue;
      }
      const eased = 1 - (1 - t) ** 3; // Cubic.easeOut
      const radius = r.fromR + (r.toR - r.fromR) * eased;
      g.lineStyle(3, r.color, 0.8 * (1 - t));
      g.strokeCircle(r.x, r.y, radius);
    }
  }

  private current?: Phaser.GameObjects.Text;

  /** Big centred callout: the countdown, a new ball, a player going out. */
  announce(text: string, color: number, y = 620, size = 54): void {
    // Only ever one of these on screen. Two callouts landing together — a
    // knockout and a new ball in the same second — used to overlap into mush.
    this.current?.destroy();

    const t = this.scene.add
      .text(450, y, text, {
        fontFamily: FONT,
        fontSize: `${size}px`,
        color: '#' + color.toString(16).padStart(6, '0'),
        // Phaser's canvas text measurement clips ascenders/descenders tight
        // to the glyph metrics without a little breathing room.
        padding: { top: Math.round(size * 0.12), bottom: Math.round(size * 0.3) },
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setAlpha(0)
      .setScale(0.7);
    this.current = t;

    this.scene.tweens.add({
      targets: t,
      alpha: 1,
      scale: 1,
      duration: 160,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: t,
          alpha: 0,
          y: y - 40,
          delay: 620,
          duration: 320,
          onComplete: () => {
            if (this.current === t) this.current = undefined;
            t.destroy();
          },
        });
      },
    });
  }

  destroy(): void {
    this.sparks.destroy();
    this.shards.destroy();
    this.rippleGfx.destroy();
  }
}
