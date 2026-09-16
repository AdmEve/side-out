import { LIVES, PADDLE } from '../config/balance.ts';

export type HazardKind = 'peg' | 'well' | 'bar';

export class Player {
  readonly id: number;
  readonly isHuman: boolean;
  /** Display name for this seat. */
  readonly name: string;
  /** Seat colour — drives every bit of UI and render tied to this player. */
  readonly color: number;
  /** Seat 0 human gets the on-screen sabotage controls; everyone else auto-drops. */
  manualSabotage = false;

  alive = true;
  lives: number = LIVES.start;

  /** Paddle centre along its wall, 0..1. */
  t = 0.5;
  target = 0.5;
  /** Signed movement in wall-widths per second, used for lean/tilt effects. */
  paddleVel = 0;
  /** Travel speed limit in wall-widths per second. */
  baseSpeed: number;

  /** Match time until which the paddle is widened by a pickup; 0 = never. */
  wideUntil = 0;
  shield = false;

  hits = 0;
  /** Finishing position: 1 is the winner, 8 the first player out. */
  placement = 0;
  eliminatedAt = 0;

  /** Seconds until this (eliminated) player may drop another hazard. */
  hazardCooldown = 0;
  hazardKind: HazardKind = 'peg';

  constructor(id: number, name: string, isHuman: boolean, color: number, baseSpeed: number) {
    this.id = id;
    this.name = name;
    this.isHuman = isHuman;
    this.color = color;
    this.baseSpeed = baseSpeed;
  }

  /** How much of the wall this paddle covers right now. */
  lengthFrac(now: number): number {
    return now < this.wideUntil ? PADDLE.wideFrac : PADDLE.lengthFrac;
  }

  /** How fast this paddle can cross its wall right now. */
  speedNow(_now: number): number {
    return this.baseSpeed;
  }
}
