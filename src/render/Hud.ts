import { ARENA, ESCALATION, HAZARD, WORLD } from '../config/balance.ts';
import { COLORS, FONT, hex, readable } from '../config/theme.ts';
import type { MatchState } from '../core/MatchState.ts';
import type { HazardKind, Player } from '../core/Player.ts';
import { digits, mo, mx, t } from '../i18n/index.ts';
import { type Button, formatClock, label, makeButton } from './ui.ts';

const SEAT_Y = 250;
const SEAT_W = 92;
const SEAT_GAP = 12;

function seatX(index: number, count: number): number {
  const total = count * SEAT_W + (count - 1) * SEAT_GAP;
  return (WORLD.w - total) / 2 + SEAT_W / 2 + index * (SEAT_W + SEAT_GAP);
}

/** The single line that says what the match is about to throw at you. */
function escalation(m: MatchState): { text: string; color: number } {
  if (m.arena.mode === 'duel') return { text: t('finalDuel'), color: COLORS.warn };
  if (m.arena.radiusScale < 0.999) {
    return m.arena.radiusScale > ARENA.minRadiusScale + 0.005
      ? { text: t('arenaClosing'), color: COLORS.hazard }
      : { text: t('arenaClosed'), color: COLORS.hazard };
  }
  const live = m.balls.length;
  const next = ESCALATION.extraBallTimes[live - 1];
  if (next !== undefined && live < ESCALATION.maxBalls) {
    return {
      text: t('ballIn', { n: live + 1, s: Math.max(0, Math.ceil(next - m.time)) }),
      color: COLORS.textDim,
    };
  }
  return { text: '', color: COLORS.textDim };
}

export interface HudCallbacks {
  onPause: () => void;
  onHazardKind: (kind: HazardKind) => void;
}

/** Everything outside the arena: the clock, the seat board, the sabotage bar. */
export class Hud {
  private readonly clockText: Phaser.GameObjects.Text;
  private readonly aliveText: Phaser.GameObjects.Text;
  private readonly ballsText: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly status: Phaser.GameObjects.Text;
  private readonly seatGfx: Phaser.GameObjects.Graphics;
  private readonly seatNames: Phaser.GameObjects.Text[] = [];
  private readonly sabotage: Phaser.GameObjects.Container;
  private readonly sabotageBar: Phaser.GameObjects.Graphics;
  private readonly sabotageHint: Phaser.GameObjects.Text;
  private readonly hazardButtons: { kind: HazardKind; button: Button }[] = [];

  // --- perf readout ----------------------------------------------------
  // A visible FPS/frame-time counter, on by default while we're chasing the
  // "many balls, many hazards" frame-drop reports — cheap enough to leave
  // running, and it turns "it feels choppy" into a number and a timestamp.
  // Remove or gate behind a settings toggle once we're done tuning.
  private readonly perfText: Phaser.GameObjects.Text;
  private readonly stutterText: Phaser.GameObjects.Text;
  private readonly scene: Phaser.Scene;
  private minFps = Infinity;
  private minFpsWindowStart = 0;

  constructor(scene: Phaser.Scene, m: MatchState, cb: HudCallbacks) {
    this.scene = scene;
    this.clockText = scene.add
      .text(WORLD.w / 2, 78, '0:00', {
        fontFamily: FONT,
        fontSize: '62px',
        color: hex(COLORS.text),
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.aliveText = label(scene, mx(44), 78, '', 22, COLORS.textDim, mo(0)).setDepth(10);
    this.ballsText = label(scene, mx(WORLD.w - 44), 78, '', 22, COLORS.textDim, mo(1)).setDepth(10);
    this.perfText = label(scene, mx(44), 108, '', 13, COLORS.textFaint, mo(0)).setDepth(10);
    this.stutterText = label(scene, mx(44), 126, '', 13, COLORS.warn, mo(0)).setDepth(10).setAlpha(0.85);

    makeButton(scene, WORLD.w / 2, 156, t('pause'), cb.onPause, {
      width: 170,
      height: 46,
      fontSize: 20,
      color: COLORS.textDim,
    }).container.setDepth(10);

    this.hint = label(scene, WORLD.w / 2, WORLD.h - 22, '', 15, COLORS.textFaint).setDepth(10);

    // Seat board: who is still in, and how close they are to going out.
    this.seatGfx = scene.add.graphics().setDepth(10);
    for (const p of m.players) {
      this.seatNames.push(
        scene.add
          .text(seatX(p.id, m.players.length), SEAT_Y - 15, p.name, {
            fontFamily: FONT,
            fontSize: '15px',
            color: hex(readable(p.color)),
          })
          .setOrigin(0.5)
          .setDepth(11),
      );
    }
    this.status = label(scene, WORLD.w / 2, SEAT_Y + 66, '', 21, COLORS.textDim).setDepth(10);

    // --- sabotage panel, hidden until the local player is knocked out ------
    this.sabotage = scene.add.container(0, 0).setDepth(12).setVisible(false);
    const panelY = WORLD.h - 118;
    const title = label(scene, WORLD.w / 2, panelY - 66, t('sabotageTitle'), 21, COLORS.hazard);
    this.sabotageHint = label(scene, WORLD.w / 2, panelY + 76, t('ready'), 19, COLORS.textDim);
    this.sabotageBar = scene.add.graphics();
    this.sabotage.add([title, this.sabotageHint, this.sabotageBar]);

    const kinds: { kind: HazardKind; text: string }[] = [
      { kind: 'peg', text: t('hazardPeg') },
      { kind: 'well', text: t('hazardWell') },
      { kind: 'bar', text: t('hazardBar') },
    ];
    kinds.forEach((k, i) => {
      const b = makeButton(
        scene,
        WORLD.w / 2 + (i - 1) * 190,
        panelY,
        k.text,
        () => cb.onHazardKind(k.kind),
        {
          width: 170,
          height: 58,
          fontSize: 23,
          color: k.kind === 'well' ? COLORS.wind : COLORS.hazard,
        },
      );
      b.setSelected(i === 0);
      this.sabotage.add(b.container);
      this.hazardButtons.push({ kind: k.kind, button: b });
    });
  }

  update(m: MatchState, stutter = ''): void {
    this.clockText.setText(digits(formatClock(m.time)));
    this.aliveText.setText(`${t('left')} ${digits(m.aliveCount)}/${digits(m.players.length)}`);
    this.ballsText.setText(`${t('balls')} ${digits(m.balls.filter((b) => b.active).length)}`);
    this.updatePerf(m, stutter);

    const esc = escalation(m);
    this.status.setText(esc.text).setColor(hex(esc.color));
    this.drawSeats(m);

    const local = m.players.find((p) => p.manualSabotage);
    if (local && !local.alive && m.phase === 'playing') {
      this.sabotage.setVisible(true);
      this.drawCooldown(local);
      this.hint.setText('');
    } else {
      this.sabotage.setVisible(false);
    }
  }

  /**
   * "It feels choppy" isn't a bug report. This turns it into one: the
   * current FPS, the worst FPS seen in roughly the last 2 seconds (so a
   * single bad frame doesn't get averaged away), and exactly how much is on
   * screen right now, so a drop can be tied to the moment it happened.
   */
  private updatePerf(m: MatchState, stutter: string): void {
    const fps = this.scene.game.loop.actualFps;
    if (m.time - this.minFpsWindowStart > 2) {
      this.minFps = fps;
      this.minFpsWindowStart = m.time;
    } else {
      this.minFps = Math.min(this.minFps, fps);
    }
    const balls = m.balls.filter((b) => b.active).length;
    this.perfText.setText(
      `${Math.round(fps)} fps (min ${Math.round(this.minFps)}) · ${balls}b/${m.hazards.length}h/${m.powerups.length}p`,
    );
    // Sticky — stays on screen after the hitch passes so there's time to
    // actually read it, rather than flashing by in the same frame it fired.
    if (stutter) this.stutterText.setText(`last stutter: ${stutter}`);
  }

  setHint(text: string): void {
    this.hint.setText(text);
  }

  setHazardKind(kind: HazardKind): void {
    for (const h of this.hazardButtons) h.button.setSelected(h.kind === kind);
  }

  /** One chip per seat: colour, name, and a life pip per remaining miss. */
  private drawSeats(m: MatchState): void {
    const g = this.seatGfx;
    g.clear();
    const n = m.players.length;

    for (const p of m.players) {
      const x = seatX(p.id, n);
      const a = p.alive ? 1 : 0.22;
      const ink = readable(p.color);

      g.fillStyle(ink, 0.08 * a);
      g.fillRoundedRect(x - SEAT_W / 2, SEAT_Y - 34, SEAT_W, 66, 8);
      g.lineStyle(2, ink, 0.45 * a);
      g.strokeRoundedRect(x - SEAT_W / 2, SEAT_Y - 34, SEAT_W, 66, 8);
      this.seatNames[p.id].setAlpha(p.alive ? 1 : 0.3);

      if (!p.alive) {
        g.lineStyle(2, ink, 0.35);
        g.beginPath();
        g.moveTo(x - 20, SEAT_Y + 13);
        g.lineTo(x + 20, SEAT_Y + 13);
        g.strokePath();
        continue;
      }

      const total = Math.max(2, p.lives);
      for (let i = 0; i < total; i++) {
        const px = x + (i - (total - 1) / 2) * 16;
        if (i < p.lives) {
          g.fillStyle(ink, 0.95);
          g.fillCircle(px, SEAT_Y + 13, 5);
        } else {
          g.lineStyle(1.5, ink, 0.35);
          g.strokeCircle(px, SEAT_Y + 13, 5);
        }
      }
    }
  }

  private drawCooldown(p: Player): void {
    const w = 420;
    const x = WORLD.w / 2 - w / 2;
    const y = WORLD.h - 82;
    const ready = p.hazardCooldown <= 0;
    const k = ready ? 1 : 1 - p.hazardCooldown / HAZARD.cooldown;

    this.sabotageBar.clear();
    this.sabotageBar.fillStyle(COLORS.grid, 1);
    this.sabotageBar.fillRoundedRect(x, y, w, 10, 5);
    this.sabotageBar.fillStyle(ready ? COLORS.good : COLORS.hazard, 1);
    this.sabotageBar.fillRoundedRect(x, y, Math.max(6, w * k), 10, 5);
    this.sabotageHint.setText(ready ? t('ready') : t('recharging', { s: p.hazardCooldown.toFixed(1) }));
  }
}
