import { WORLD } from './config/balance.ts';
import { initNative, keepAwake } from './platform/native.ts';
import { COLORS } from './config/theme.ts';
import { BootScene } from './scenes/BootScene.ts';
import { MenuScene } from './scenes/MenuScene.ts';
import { GameScene } from './scenes/GameScene.ts';
import { ResultsScene } from './scenes/ResultsScene.ts';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: COLORS.bg,
  // One portrait design space, letterboxed to fit whatever screen it lands on.
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: WORLD.w,
    height: WORLD.h,
  },
  render: {
    antialias: true,
    powerPreference: 'high-performance',
  },
  // The simulation runs on a fixed step and catches up using the real elapsed
  // time, so Phaser's delta smoothing only gets in the way: on a slow frame it
  // under-reports how much time passed and the match runs in slow motion.
  fps: { target: 60, min: 10, smoothStep: false },
  input: { activePointers: 5 },
  scene: [BootScene, MenuScene, GameScene, ResultsScene],
};

initNative();
void keepAwake();

/**
 * Phaser draws text straight to canvas with whatever font is resolved at that
 * moment, and it does not re-render when a webfont arrives later. Persian in a
 * fallback face is unreadable, so the game waits for Vazirmatn — but never for
 * more than a moment, because a game that will not start is worse than a game
 * in the wrong face.
 */
async function waitForFonts(): Promise<void> {
  try {
    if (!document.fonts) return;
    await Promise.race([
      Promise.all([
        document.fonts.load('400 20px Vazirmatn', 'بازیکن'),
        document.fonts.load('700 20px Vazirmatn', 'بازیکن'),
        document.fonts.load('900 20px Vazirmatn', 'بازیکن'),
      ]),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch {
    /* fall back to the system stack */
  }
}

let game: Phaser.Game;
void waitForFonts().then(() => {
  game = new Phaser.Game(config);
  (window as unknown as { __game: Phaser.Game }).__game = game;
});
