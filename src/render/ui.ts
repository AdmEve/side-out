import { COLORS, FONT, hex } from '../config/theme.ts';
import { sfx } from '../audio/sfx.ts';

export interface ButtonOptions {
  width?: number;
  height?: number;
  color?: number;
  fontSize?: number;
  filled?: boolean;
}

export interface Button {
  container: Phaser.GameObjects.Container;
  setSelected(on: boolean): void;
  setLabel(text: string): void;
  setEnabled(on: boolean): void;
}

/** A neon-outlined button. Used for every tappable thing outside the arena. */
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: ButtonOptions = {},
): Button {
  const w = opts.width ?? 260;
  const h = opts.height ?? 78;
  const color = opts.color ?? COLORS.accent;
  const fontSize = opts.fontSize ?? 30;

  const container = scene.add.container(x, y);
  const bg = scene.add.graphics();
  const text = scene.add
    .text(0, 0, label, {
      fontFamily: FONT,
      fontSize: `${fontSize}px`,
      color: '#ffffff',
      padding: { left: 10, right: 10, top: 8, bottom: 8 },
    })
    .setOrigin(0.5);

  container.add([bg, text]);
  container.setSize(w, h);

  let selected = !!opts.filled;
  let enabled = true;
  let hover = false;

  const redraw = () => {
    bg.clear();
    const alpha = enabled ? 1 : 0.35;
    // Hover always has to move the needle, even on a button that's already
    // "selected" (PLAY, or the active choice-row pill) — otherwise those
    // buttons look dead under the pointer even though they work fine.
    const fill = selected ? (hover ? 1 : 0.9) : hover ? 0.24 : 0.1;
    const fillMul = selected ? (hover ? 0.28 : 0.22) : 1;
    bg.fillStyle(color, fill * alpha * fillMul);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    const strokeW = selected ? (hover ? 4 : 3) : hover ? 3 : 2;
    const strokeA = (selected ? (hover ? 1 : 1) : hover ? 0.85 : 0.55) * alpha;
    bg.lineStyle(strokeW, color, strokeA);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    if (selected) {
      bg.lineStyle(10, color, (hover ? 0.2 : 0.12) * alpha);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    } else if (hover) {
      bg.lineStyle(8, color, 0.1 * alpha);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    }
    text.setColor(selected ? '#ffffff' : enabled ? (hover ? '#ffffff' : '#cfd8ff') : '#6b7499');
    if (hover && enabled) {
      text.setScale(1.03);
    } else {
      text.setScale(1);
    }
  };
  redraw();

  // Phaser always adds a Container's displayOrigin (fixed at width/2,
  // height/2 — see Container.js, "do not change this value") to the pointer's
  // local coordinates before testing the hit area. A hit area centred on the
  // container's own origin (-w/2..w/2) therefore gets that offset added a
  // second time, shifting the region that actually responds to taps into the
  // button's top-left quadrant. The hit area must be specified in the same
  // top-left-anchored space Phaser tests against: (0, 0, w, h).
  container
    .setInteractive({
      hitArea: new Phaser.Geom.Rectangle(0, 0, w, h),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      cursor: 'pointer',
    })
    .on('pointerover', () => {
      hover = true;
      redraw();
    })
    .on('pointerout', () => {
      hover = false;
      redraw();
    })
    .on('pointerdown', () => {
      if (!enabled) return;
      sfx.unlock();
      sfx.ui();
      scene.tweens.add({ targets: container, scale: 0.94, duration: 70, yoyo: true });
      onClick();
    });

  return {
    container,
    setSelected(on: boolean) {
      selected = on;
      redraw();
    },
    setLabel(t: string) {
      text.setText(t);
    },
    setEnabled(on: boolean) {
      enabled = on;
      redraw();
    },
  };
}

/** A row of buttons where exactly one is selected. */
export function makeChoiceRow<T extends string | number>(
  scene: Phaser.Scene,
  x: number,
  y: number,
  values: readonly T[],
  labels: readonly string[],
  initial: T,
  onChange: (value: T) => void,
  opts: { width?: number; height?: number; gap?: number; color?: number; fontSize?: number } = {},
): void {
  const w = opts.width ?? 120;
  const h = opts.height ?? 62;
  const gap = opts.gap ?? 14;
  const total = values.length * w + (values.length - 1) * gap;
  const buttons: Button[] = [];

  values.forEach((value, i) => {
    const bx = x - total / 2 + w / 2 + i * (w + gap);
    const b = makeButton(
      scene,
      bx,
      y,
      labels[i],
      () => {
        buttons.forEach((other, j) => other.setSelected(values[j] === value));
        onChange(value);
      },
      { width: w, height: h, color: opts.color, fontSize: opts.fontSize ?? 26 },
    );
    b.setSelected(value === initial);
    buttons.push(b);
  });
}

export function label(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size = 22,
  color: number = COLORS.textDim,
  origin = 0.5,
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      color: hex(color),
      padding: { left: 6, right: 6, top: 4, bottom: 4 },
    })
    .setOrigin(origin, 0.5);
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds * 100) % 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
