import { WORLD, type Difficulty } from '../config/balance.ts';
import { COLORS, FONT, PLAYER_COLORS, hex, mix } from '../config/theme.ts';
import { regularPolygon } from '../core/geometry.ts';
import { sfx } from '../audio/sfx.ts';
import { setBackHandler } from '../platform/native.ts';
import { load, save } from '../storage.ts';
import { formatClock, label, makeButton, makeChoiceRow } from '../render/ui.ts';
import { digits, getLocale, mo, mx, setLocale, t } from '../i18n/index.ts';

/** A small dot bullet, used ahead of every section label. */
function bullet(scene: Phaser.Scene, x: number, y: number, color: number): void {
  scene.add.circle(x, y, 3, color, 1).setAlpha(0.9);
}

export class MenuScene extends Phaser.Scene {
  private humans = 1;
  private difficulty: Difficulty = 'normal';
  private soundOn = true;
  private spin = 0;
  private preview!: Phaser.GameObjects.Graphics;
  private controlsHint!: Phaser.GameObjects.Text;
  private drift!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super('Menu');
  }

  create(): void {
    const saved = load();
    this.humans = saved.humans;
    this.difficulty = saved.difficulty;
    this.soundOn = saved.sound;
    setLocale(saved.locale);
    sfx.enabled = this.soundOn;

    this.cameras.main.setBackgroundColor(COLORS.bg);
    setBackHandler(() => 'exit'); // back from the menu really does leave

    // --- backdrop ------------------------------------------------------
    this.add.image(WORLD.w / 2, WORLD.h / 2, 'starfield').setDisplaySize(WORLD.w, WORLD.h);
    this.add
      .image(WORLD.w / 2, WORLD.h / 2, 'nebula')
      .setDisplaySize(WORLD.w, WORLD.h)
      .setBlendMode(Phaser.BlendModes.ADD);

    // A handful of slow-drifting motes for a sense of depth without motion
    // that competes with the UI.
    this.drift = this.add.particles(0, 0, 'spark', {
      x: { min: 0, max: WORLD.w },
      y: WORLD.h + 20,
      lifespan: 9000,
      speedY: { min: -34, max: -14 },
      speedX: { min: -6, max: 6 },
      scale: { start: 0.55, end: 0 },
      alpha: { start: 0.28, end: 0 },
      frequency: 380,
      blendMode: Phaser.BlendModes.ADD,
      tint: [COLORS.accent, COLORS.accent2, 0xffffff],
    });

    this.preview = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.95);

    // --- language toggle -------------------------------------------------
    makeButton(
      this,
      mx(64),
      40,
      getLocale() === 'fa' ? 'EN' : 'فا',
      () => {
        const next = getLocale() === 'fa' ? 'en' : 'fa';
        setLocale(next);
        save({ locale: next });
        this.scene.restart();
      },
      { width: 84, height: 44, fontSize: 18, color: COLORS.textDim },
    ).container.setDepth(5);

    // --- title -----------------------------------------------------------
    label(this, WORLD.w / 2, 78, t('survivalArena'), 15, COLORS.accent)
      .setAlpha(0.75)
      .setLetterSpacing(6);

    const title = this.add
      .text(WORLD.w / 2, 168, 'SIDE OUT', {
        fontFamily: FONT,
        fontSize: '112px',
        fontStyle: 'bold',
        color: hex(COLORS.text),
        padding: { top: 14, bottom: 24 },
        shadow: { color: hex(COLORS.accent), blur: 34, fill: true },
      })
      .setOrigin(0.5)
      .setLetterSpacing(2);
    this.tweens.add({
      targets: title,
      alpha: { from: 0.86, to: 1 },
      duration: 1900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    label(this, WORLD.w / 2, 254, t('gameTagline'), 25, COLORS.accent);
    label(this, WORLD.w / 2, 288, t('gameRule'), 15, COLORS.textDim);

    // --- live arena preview -----------------------------------------------
    // A turning octagon behind nothing but the void — the match, in miniature,
    // and the first thing that tells a new player what kind of game this is.
    this.add.circle(WORLD.w / 2, 540, 232, COLORS.accent, 0.035);

    // --- setup card ---------------------------------------------------
    const cardX = 72;
    const cardY = 800;
    const cardW = WORLD.w - cardX * 2;
    const cardH = 372;
    const card = this.add.graphics();
    card.fillStyle(COLORS.bgRaised, 0.55);
    card.fillRoundedRect(cardX, cardY, cardW, cardH, 22);
    card.lineStyle(1, COLORS.grid, 0.9);
    card.strokeRoundedRect(cardX, cardY, cardW, cardH, 22);

    bullet(this, mx(cardX + 34), cardY + 46, COLORS.accent);
    label(this, mx(cardX + 50), cardY + 46, t('playersOnDevice'), 18, COLORS.textDim, mo(0));
    makeChoiceRow(
      this,
      WORLD.w / 2,
      cardY + 104,
      [1, 2, 3, 4],
      [digits(1), digits(2), digits(3), digits(4)],
      this.humans,
      (v) => {
        this.humans = v;
        save({ humans: v });
        this.refreshControlsHint();
      },
      { width: 148, height: 62, color: COLORS.accent },
    );

    bullet(this, mx(cardX + 34), cardY + 190, COLORS.accent2);
    label(this, mx(cardX + 50), cardY + 190, t('difficulty'), 18, COLORS.textDim, mo(0));
    makeChoiceRow(
      this,
      WORLD.w / 2,
      cardY + 248,
      ['easy', 'normal', 'hard'] as const,
      [t('easy'), t('normal'), t('hard')],
      this.difficulty,
      (v) => {
        this.difficulty = v;
        save({ difficulty: v });
      },
      { width: 224, height: 62, color: COLORS.accent2 },
    );

    this.controlsHint = label(this, WORLD.w / 2, cardY + 330, '', 16, COLORS.textFaint);
    this.refreshControlsHint();

    // --- play CTA -----------------------------------------------------
    const playY = cardY + cardH + 92;
    const glow = this.add.circle(WORLD.w / 2, playY, 150, COLORS.good, 0.08);
    this.tweens.add({
      targets: glow,
      scale: { from: 1, to: 1.14 },
      alpha: { from: 0.08, to: 0.02 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    makeButton(
      this,
      WORLD.w / 2,
      playY,
      t('play'),
      () => {
        sfx.unlock();
        this.scene.start('Game', { humans: this.humans, difficulty: this.difficulty });
      },
      { width: 380, height: 104, fontSize: 42, color: COLORS.good, filled: true },
    );

    // --- footer ---------------------------------------------------------
    const soundBtn = makeButton(
      this,
      WORLD.w / 2,
      playY + 116,
      this.soundOn ? t('soundOn') : t('soundOff'),
      () => {
        this.soundOn = !this.soundOn;
        sfx.enabled = this.soundOn;
        save({ sound: this.soundOn });
        soundBtn.setLabel(this.soundOn ? t('soundOn') : t('soundOff'));
      },
      { width: 240, height: 50, fontSize: 20, color: COLORS.textDim },
    );

    label(
      this,
      WORLD.w / 2,
      playY + 178,
      saved.bestTime > 0
        ? `${t('bestRun')} ${digits(formatClock(saved.bestTime))}   ·   ${t('wins')} ${digits(saved.wins)}/${digits(saved.played)}`
        : t('noRunsYet'),
      17,
      COLORS.textFaint,
    );

    label(this, WORLD.w / 2, WORLD.h - 34, t('footerTag'), 13, COLORS.textFaint).setAlpha(0.6);

    this.input.once('pointerdown', () => sfx.unlock());

    this.events.once('shutdown', () => this.drift.destroy());
  }

  private refreshControlsHint(): void {
    const schemes = [t('schemeTouch'), t('schemeAD'), t('schemeJL'), t('schemeNumpad')];
    this.controlsHint.setText(
      schemes
        .slice(0, this.humans)
        .map((s, i) => `${digits(i + 1)} — ${s}`)
        .join('     '),
    );
  }

  update(_time: number, delta: number): void {
    this.spin += delta * 0.00011;
    const g = this.preview;
    const cx = WORLD.w / 2;
    const cy = 540;
    const r = 218;
    g.clear();

    const verts = regularPolygon(8, cx, cy, r, this.spin);
    g.lineStyle(1, COLORS.grid, 0.4);
    g.strokeCircle(cx, cy, r * 0.3);

    for (let i = 0; i < 8; i++) {
      const a = verts[i];
      const b = verts[(i + 1) % 8];
      const col = PLAYER_COLORS[i];
      g.lineStyle(2, mix(col, COLORS.textDim, 0.25), 0.3);
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.strokePath();

      const phase = (Math.sin(this.spin * 9 + i * 1.7) + 1) / 2;
      const t0 = 0.2 + phase * 0.44;
      const pa = { x: a.x + (b.x - a.x) * t0, y: a.y + (b.y - a.y) * t0 };
      const pb = { x: a.x + (b.x - a.x) * (t0 + 0.16), y: a.y + (b.y - a.y) * (t0 + 0.16) };
      g.lineStyle(9, col, 0.95);
      g.beginPath();
      g.moveTo(pa.x, pa.y);
      g.lineTo(pb.x, pb.y);
      g.strokePath();
    }

    const bx = cx + Math.cos(this.spin * 5.3) * 108;
    const by = cy + Math.sin(this.spin * 7.1) * 108;
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(bx, by, 9);
    g.fillStyle(0xffffff, 0.2);
    g.fillCircle(bx, by, 24);
  }
}
