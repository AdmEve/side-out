import { LIVES, POWERUP } from '../config/balance.ts';
import type { Vec } from './geometry.ts';
import type { Player } from './Player.ts';

export type PowerKind = 'wide' | 'shield' | 'slow' | 'life';

export const POWER_KINDS: PowerKind[] = ['wide', 'shield', 'slow', 'life'];

export const POWER_LABEL: Record<PowerKind, string> = {
  wide: 'WIDE',
  shield: 'SHIELD',
  slow: 'SLOW',
  life: 'LIFE',
};

export interface PowerUp {
  id: number;
  kind: PowerKind;
  pos: Vec;
  /** Grows 0 → 1 on spawn, used for the pop-in animation. */
  arm: number;
}

export interface PowerResult {
  /** Set when the effect is global rather than per-player. */
  slowUntil?: number;
}

/** Apply a power-up to the player who last touched the ball. */
export function applyPower(kind: PowerKind, p: Player, now: number): PowerResult {
  switch (kind) {
    case 'wide':
      p.wideUntil = Math.max(p.wideUntil, now) + POWERUP.wideDuration;
      return {};
    case 'shield':
      p.shield = true;
      return {};
    case 'life':
      p.lives = Math.min(LIVES.max, p.lives + 1);
      return {};
    case 'slow':
      return { slowUntil: now + POWERUP.slowDuration };
  }
}
