import { WORLD, type Difficulty } from '../config/balance.ts';
import { COLORS, FONT, hex, readable } from '../config/theme.ts';
import { setBackHandler } from '../platform/native.ts';
import { load } from '../storage.ts';
import { formatClock, label, makeButton } from '../render/ui.ts';
import { digits, mo, mx, setLocale, t } from '../i18n/index.ts';

interface Row {
  id: number;
  name: string;
  color: number;
  isHuman: boolean;
  placement: number;
  survival: number;
  saves: number;
}

export interface ResultsData {
  summary: Row[];
  winnerId: number;
  localId: number | undefined;
  matchTime: number;
  opts: { humans: number; difficulty: Difficulty };
}

export class ResultsScene extends Phaser.Scene {
  constructor() {
    super('Results');
  }

  create(data: ResultsData): void {
    setLocale(load().locale);
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.add.image(WORLD.w / 2, WORLD.h / 2, 'starfield').setDisplaySize(WORLD.w, WORLD.h).setDepth(-2);
    setBackHandler(() => {
      this.scene.start('Menu');
      return 'handled';
    });

    const { summary, winnerId, localId } = data;
    const local = summary.find((r) => r.id === localId);
    const won = local ? local.id === winnerId : false;
    const headline = !local
      ? t('someoneWins', { name: summary[0].name })
      : won
        ? t('youWin')
        : t('placeOf', { n: local.placement, total: summary.length });

    this.add
      .text(WORLD.w / 2, 128, headline, {
        fontFamily: FONT,
        fontSize: won ? '80px' : '68px',
        color: hex(won ? COLORS.accent : COLORS.text),
        shadow: won ? { color: hex(COLORS.accent), blur: 26, fill: true } : undefined,
      })
      .setOrigin(0.5);

    label(
      this,
      WORLD.w / 2,
      194,
      local
        ? t('survivedFor', { time: digits(formatClock(local.survival)), saves: digits(local.saves) })
        : t('matchLength', { time: digits(formatClock(data.matchTime)) }),
      22,
      COLORS.accent,
    );

    // --- leaderboard -------------------------------------------------------
    const top = 300;
    const rowH = 66;
    label(this, mx(200), top - 40, t('colPlayer'), 16, COLORS.textFaint, mo(0));
    label(this, mx(WORLD.w - 300), top - 40, t('colSurvived'), 16, COLORS.textFaint, mo(0));
    label(this, mx(WORLD.w - 120), top - 40, t('colSaves'), 16, COLORS.textFaint, mo(1));

    summary.forEach((r, i) => {
      const y = top + i * rowH;
      const isLocal = r.id === localId;

      const g = this.add.graphics();
      g.fillStyle(r.color, isLocal ? 0.16 : 0.05);
      g.fillRoundedRect(72, y - rowH / 2 + 5, WORLD.w - 144, rowH - 10, 10);
      if (isLocal) {
        g.lineStyle(2, r.color, 0.8);
        g.strokeRoundedRect(72, y - rowH / 2 + 5, WORLD.w - 144, rowH - 10, 10);
      }

      const ink = readable(r.color);
      label(this, mx(120), y, digits(r.placement), 28, ink, mo(0));
      label(this, mx(200), y, r.name, 26, isLocal ? COLORS.text : ink, mo(0));
      label(this, mx(WORLD.w - 300), y, digits(formatClock(r.survival)), 22, COLORS.textDim, mo(0));
      label(this, mx(WORLD.w - 120), y, digits(r.saves), 22, COLORS.textDim, mo(1));
    });

    const rec = load();
    label(
      this,
      WORLD.w / 2,
      WORLD.h - 250,
      `${t('bestRun')} ${digits(formatClock(rec.bestTime))}   ·   ${t('wins')} ${digits(rec.wins)}/${digits(rec.played)}`,
      19,
      COLORS.textDim,
    );

    makeButton(this, WORLD.w / 2, WORLD.h - 160, t('rematch'), () => this.scene.start('Game', data.opts), {
      width: 340,
      height: 88,
      fontSize: 36,
      color: COLORS.good,
    });
    makeButton(this, WORLD.w / 2, WORLD.h - 62, t('menu'), () => this.scene.start('Menu'), {
      width: 240,
      height: 58,
      fontSize: 24,
      color: COLORS.textDim,
    });
  }
}
