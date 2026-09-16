import type { Controller } from '../core/Controller.ts';
import type { MatchState } from '../core/MatchState.ts';
import type { InputManager } from './InputManager.ts';

/** Adapter that lets a person occupy the same slot a bot would. */
export class HumanController implements Controller {
  constructor(private readonly input: InputManager) {}

  update(_dt: number, m: MatchState, playerId: number): number {
    return this.input.targetFor(playerId, m);
  }
}
