/**
 * Generates every texture the game uses. There are no image assets: a soft
 * spark for particles, a shard for wall debris, and a starfield/nebula
 * backdrop, all drawn at boot.
 */
import { WORLD } from '../config/balance.ts';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.makeSpark();
    this.makeShard();
    this.makeStarfield();
    this.makeNebula();
    this.scene.start('Menu');
  }

  /**
   * The void behind the arena, baked once into a texture.
   *
   * Phaser's Graphics is immediate mode — it replays its whole command list
   * every frame — so a few thousand stars drawn live would cost more fill rate
   * than the entire rest of the game. As a texture it is one quad.
   */
  private makeStarfield(): void {
    if (this.textures.exists('starfield')) return;
    const w = WORLD.w;
    const h = WORLD.h;
    const tex = this.textures.createCanvas('starfield', w, h);
    const ctx = tex?.getContext();
    if (!tex || !ctx) return;

    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, w, h);

    let seed = 90210;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    // Three depth layers: distant dust, mid stars, a few bright foreground
    // points. Density and brightness both fall off with "distance" so the
    // field reads as depth rather than noise.
    const layers: [number, number, number][] = [
      [900, 0.6, 0.22],
      [340, 1.1, 0.42],
      [90, 1.8, 0.85],
    ];
    for (const [count, size, alpha] of layers) {
      for (let i = 0; i < count; i++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const r = size * (0.5 + rnd());
        const a = alpha * (0.4 + rnd() * 0.6);
        ctx.globalAlpha = a;
        ctx.fillStyle = rnd() > 0.85 ? '#bcd4ff' : '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // A handful of faint hairline streaks — distant motion, not clutter.
    ctx.strokeStyle = 'rgba(180, 200, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const len = 30 + rnd() * 70;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len * 0.15, y + len);
      ctx.stroke();
    }

    tex.refresh();
  }

  /**
   * Soft colour wash behind the arena — cyan and violet nebula glow pooling
   * low and to the sides, so the void has depth without competing with the
   * gameplay glow drawn on top every frame.
   */
  private makeNebula(): void {
    if (this.textures.exists('nebula')) return;
    const w = WORLD.w;
    const h = WORLD.h;
    const tex = this.textures.createCanvas('nebula', w, h);
    const ctx = tex?.getContext();
    if (!tex || !ctx) return;

    const blobs: [number, number, number, string][] = [
      [w * 0.18, h * 0.32, w * 0.55, 'rgba(57,243,255,0.10)'],
      [w * 0.86, h * 0.68, w * 0.6, 'rgba(181,107,255,0.11)'],
      [w * 0.5, h * 0.92, w * 0.7, 'rgba(57,243,255,0.06)'],
    ];
    for (const [x, y, r, color] of blobs) {
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    tex.refresh();
  }

  private makeSpark(): void {
    if (this.textures.exists('spark')) return;
    const size = 32;
    const tex = this.textures.createCanvas('spark', size, size);
    const ctx = tex?.getContext();
    if (!tex || !ctx) return;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    tex.refresh();
  }

  private makeShard(): void {
    if (this.textures.exists('shard')) return;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 18, 6);
    g.generateTexture('shard', 18, 6);
    g.destroy();
  }
}
