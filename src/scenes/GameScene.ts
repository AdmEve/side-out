import { ARENA, MATCH, WORLD, type Difficulty } from '../config/balance.ts';
import { COLORS, FONT, PLAYER_COLORS, PLAYER_NAMES, hex } from '../config/theme.ts';
import { sfx } from '../audio/sfx.ts';
import { HumanController } from '../controllers/HumanController.ts';
import { InputManager } from '../controllers/InputManager.ts';
import { MatchState, type SeatConfig } from '../core/MatchState.ts';
import type { HazardKind } from '../core/Player.ts';
import { ArenaRenderer } from '../render/ArenaRenderer.ts';
import { Fx } from '../render/Fx.ts';
import { Hud } from '../render/Hud.ts';
import { label, makeButton } from '../render/ui.ts';
import { buzz, setBackHandler } from '../platform/native.ts';
import { load, save } from '../storage.ts';
import { digits, setLocale, t } from '../i18n/index.ts';

export interface GameSceneData {
  humans: number;
  difficulty: Difficulty;
}

export class GameScene extends Phaser.Scene {
  private match!: MatchState;
  private arenaGfx!: ArenaRenderer;
  private fx!: Fx;
  private hud!: Hud;
  private im!: InputManager;

  private opts: GameSceneData = { humans: 1, difficulty: 'normal' };
  private accumulator = 0;
  private lastCount = -1;
  private isPaused = false;
  private finished = false;
  private pauseLayer?: Phaser.GameObjects.Container;

  constructor() {
    super('Game');
  }

  create(data: GameSceneData): void {
    this.opts = { humans: data?.humans ?? 1, difficulty: data?.difficulty ?? 'normal' };
    this.accumulator = 0;
    this.lastCount = -1;
    this.isPaused = false;
    this.finished = false;
    const saved = load();
    sfx.enabled = saved.sound;
    setLocale(saved.locale);

    this.cameras.main.setBackgroundColor(COLORS.bg);
    // ArenaRenderer already adds the starfield/nebula backdrop — a second
    // full-screen image here was pure waste, redrawn every frame for nothing.

    this.match = new MatchState({
      humans: this.opts.humans,
      difficulty: this.opts.difficulty,
      seed: (Math.random() * 0xffffff) >>> 0,
      seats: buildSeats(),
    });

    this.im = new InputManager(this, this.match.humanIds);
    const human = new HumanController(this.im);
    for (const id of this.match.humanIds) this.match.controllers.set(id, human);

    this.arenaGfx = new ArenaRenderer(this);
    this.fx = new Fx(this);
    this.hud = new Hud(this, this.match, {
      onPause: () => this.togglePause(),
      onHazardKind: (k) => this.setHazardKind(k),
    });
    this.hud.setHint(this.opts.humans > 1 ? t('hotseatHint') : t('slideHint'));

    this.input.keyboard?.on('keydown-ESC', () => this.togglePause());
    this.input.keyboard?.on('keydown-P', () => this.togglePause());
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      sfx.unlock();
      this.tryDropHazard(p);
    });

    // Android's back button pauses rather than quitting; the pause menu is
    // where "leave the match" actually lives.
    setBackHandler(() => {
      if (this.finished) return 'handled';
      if (!this.isPaused) this.togglePause();
      else this.scene.start('Menu');
      return 'handled';
    });
    const onBackground = () => {
      if (!this.isPaused && !this.finished) this.togglePause();
    };
    window.addEventListener('sideout:background', onBackground);

    this.events.once('shutdown', () => {
      setBackHandler(null);
      window.removeEventListener('sideout:background', onBackground);
      this.im.destroy();
      this.arenaGfx.destroy();
      this.fx.destroy();
    });
  }

  update(time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.2);

    if (!this.isPaused && !this.finished) {
      this.accumulator += dt;
      let steps = 0;
      const maxSteps = MATCH.maxStepsPerFrame * 3;
      while (this.accumulator >= MATCH.fixedStep && steps < maxSteps) {
        this.im.update(this.match);
        this.match.step(MATCH.fixedStep);
        this.accumulator -= MATCH.fixedStep;
        steps++;
      }
      if (steps >= maxSteps) this.accumulator = 0; // don't spiral after a stall
      this.drainEvents();
      this.tickCountdown();
      // Belt and braces: end the match on state, not only on the event, so a
      // dropped event can never strand the player on a finished board.
      if (this.match.phase === 'over' && this.match.winner !== null) {
        this.endMatch(this.match.winner);
      }
    }

    this.arenaGfx.draw(this.match, time / 1000);
    this.hud.update(this.match);
  }

  // ------------------------------------------------------------------ events

  private tickCountdown(): void {
    if (this.match.phase !== 'countdown') {
      if (this.lastCount === 0) return;
      if (this.lastCount > 0) {
        this.lastCount = 0;
        this.fx.announce(t('go'), COLORS.good, ARENA.cy, 72);
        sfx.count(true);
      }
      return;
    }
    const n = Math.ceil(this.match.countdown);
    if (n !== this.lastCount) {
      this.lastCount = n;
      this.fx.announce(digits(n), COLORS.accent, ARENA.cy, 96);
      sfx.count(false);
    }
  }

  private drainEvents(): void {
    for (const e of this.match.events) {
      switch (e.type) {
        case 'paddleHit': {
          const col = this.match.player(e.player).color;
          this.fx.hit(e.pos.x, e.pos.y, col, Math.min(1, e.speed / 1100));
          sfx.paddle(e.speed);
          if (this.match.player(e.player).isHuman) buzz(8);
          break;
        }
        case 'wallHit':
          this.fx.hit(e.pos.x, e.pos.y, 0x9fb0dd, 0.4);
          sfx.wall();
          break;
        case 'hazardHit':
          this.fx.hazard(e.pos.x, e.pos.y);
          sfx.hazard();
          break;
        case 'miss': {
          const col = this.match.player(e.player).color;
          const mine = this.match.player(e.player).isHuman;
          if (e.shielded) {
            this.fx.ripple(e.pos.x, e.pos.y, 0xffffff, 140, 420);
            sfx.shielded();
            if (mine) buzz(20);
          } else {
            this.fx.miss(e.pos.x, e.pos.y, col);
            sfx.miss();
            if (mine) buzz(60);
          }
          break;
        }
        case 'eliminated': {
          const p = this.match.player(e.player);
          this.fx.shatter(e.a.x, e.a.y, e.b.x, e.b.y, p.color);
          sfx.shatter();
          if (p.isHuman) buzz([50, 60, 120]);
          this.fx.announce(
            p.manualSabotage ? t('youreOut') : t('isOut', { name: p.name }),
            p.color,
            ARENA.cy - 40,
            52,
          );
          break;
        }
        case 'ballSpawn':
          if (e.count > 1) {
            this.fx.announce(t('ballNumber', { n: e.count }), COLORS.accent, ARENA.cy - 120, 42);
          }
          this.fx.ripple(e.pos.x, e.pos.y, COLORS.accent, 110, 380);
          sfx.spawn();
          break;
        case 'powerup': {
          const p = this.match.player(e.player);
          this.fx.pickup(e.pos.x, e.pos.y);
          sfx.powerup();
          if (p.isHuman) {
            const names = {
              wide: t('powerWide'),
              shield: t('powerShield'),
              slow: t('powerSlow'),
              life: t('powerLife'),
            } as const;
            this.fx.announce(names[e.kind], COLORS.powerup, ARENA.cy - 180, 38);
          }
          break;
        }
        case 'hazardPlaced':
          this.fx.ripple(e.pos.x, e.pos.y, COLORS.hazard, 80, 320);
          sfx.drop();
          break;
        case 'win':
          this.endMatch(e.player);
          break;
      }
    }
    this.match.events.length = 0;
  }

  private endMatch(winnerId: number): void {
    if (this.finished) return;
    this.finished = true;

    const localId = this.match.humanIds[0];
    const local = localId !== undefined ? this.match.player(localId) : undefined;
    const won = local ? local.id === winnerId : false;
    const survived = local ? this.match.survivalOf(local) : this.match.time;

    if (local) {
      const rec = load();
      save({
        played: rec.played + 1,
        wins: rec.wins + (won ? 1 : 0),
        bestTime: Math.max(rec.bestTime, survived),
      });
    }
    won ? sfx.win() : sfx.lose();

    const summary = this.match.players
      .map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        isHuman: p.isHuman,
        placement: p.placement,
        survival: this.match.survivalOf(p),
        saves: p.hits,
      }))
      .sort((a, b) => a.placement - b.placement);

    this.time.delayedCall(1500, () => {
      this.scene.start('Results', {
        summary,
        winnerId,
        localId,
        matchTime: this.match.time,
        opts: this.opts,
      });
    });
  }

  // ----------------------------------------------------------------- actions

  private setHazardKind(kind: HazardKind): void {
    for (const p of this.match.players) if (p.manualSabotage) p.hazardKind = kind;
    this.hud.setHazardKind(kind);
  }

  /** Eliminated local player tapping inside the arena drops their hazard. */
  private tryDropHazard(pointer: Phaser.Input.Pointer): void {
    if (this.isPaused || this.finished) return;
    const p = this.match.players.find((x) => x.manualSabotage);
    if (!p || p.alive) return;
    if (pointer.worldY > WORLD.h - 205) return; // that's the button strip
    const pos = { x: pointer.worldX, y: pointer.worldY };
    if (!this.match.requestHazard(p.id, p.hazardKind, pos)) {
      if (p.hazardCooldown > 0) {
        this.fx.announce(t('readySoon'), COLORS.warn, ARENA.cy + 240, 32);
      } else {
        this.fx.announce(t('tooCloseToWall'), COLORS.warn, ARENA.cy + 240, 28);
      }
    }
  }

  private togglePause(): void {
    if (this.finished) return;
    this.isPaused = !this.isPaused;
    if (!this.isPaused) {
      this.pauseLayer?.destroy();
      this.pauseLayer = undefined;
      this.accumulator = 0;
      return;
    }

    const layer = this.add.container(0, 0).setDepth(40);
    const shade = this.add.graphics();
    shade.fillStyle(0x05060f, 0.86);
    shade.fillRect(0, 0, WORLD.w, WORLD.h);
    const title = this.add
      .text(WORLD.w / 2, 560, t('paused'), {
        fontFamily: FONT,
        fontSize: '64px',
        color: hex(COLORS.text),
      })
      .setOrigin(0.5);
    layer.add([shade, title]);
    layer.add(
      makeButton(this, WORLD.w / 2, 720, t('resume'), () => this.togglePause(), {
        width: 320,
        height: 86,
        fontSize: 34,
        color: COLORS.good,
      }).container,
    );
    layer.add(
      makeButton(this, WORLD.w / 2, 830, t('quitToMenu'), () => this.scene.start('Menu'), {
        width: 320,
        height: 72,
        fontSize: 26,
        color: COLORS.warn,
      }).container,
    );
    layer.add(label(this, WORLD.w / 2, 930, t('resumeHint'), 18, COLORS.textDim));
    this.pauseLayer = layer;
  }
}

/**
 * Hand out names/colours for a match: seat 0 is always "YOU" in the player
 * colour, and the rest of the roster fills the other seats in order.
 */
function buildSeats(): SeatConfig[] {
  const seats: SeatConfig[] = [];
  for (let i = 0; i < 8; i++) {
    seats.push({ name: i === 0 ? t('you') : PLAYER_NAMES[i], color: PLAYER_COLORS[i] });
  }
  return seats;
}
