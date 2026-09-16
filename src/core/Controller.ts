import type { Vec } from './geometry.ts';
import type { HazardKind } from './Player.ts';
import type { MatchState } from './MatchState.ts';

/**
 * Anything that can drive a paddle: a human's fingers, a bot's prediction, or
 * some day a remote player's inputs arriving over the wire.
 */
export interface Controller {
  /** Returns the desired paddle centre along the wall, 0..1. */
  update(dt: number, match: MatchState, playerId: number): number;
  /** Called while eliminated. Return a drop request, or null to hold fire. */
  sabotage?(dt: number, match: MatchState, playerId: number): { kind: HazardKind; pos: Vec } | null;
}
