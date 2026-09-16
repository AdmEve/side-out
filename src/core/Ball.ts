import { BALL } from '../config/balance.ts';
import type { Vec } from './geometry.ts';

export class Ball {
  readonly id: number;
  pos: Vec;
  vel: Vec;
  speed: number;
  radius = BALL.radius;
  /** Last player to return this ball — power-ups are credited to them. */
  lastToucher: number | null = null;
  /** False while waiting to re-enter play after a point. */
  active = true;
  respawnIn = 0;
  /** Recent positions, newest last, for the render trail. */
  trail: Vec[] = [];

  constructor(id: number, pos: Vec, dir: Vec, speed: number) {
    this.id = id;
    this.pos = { x: pos.x, y: pos.y };
    this.speed = speed;
    this.vel = { x: dir.x * speed, y: dir.y * speed };
  }

  setDirection(dir: Vec, speed = this.speed): void {
    this.speed = speed;
    this.vel.x = dir.x * speed;
    this.vel.y = dir.y * speed;
  }

  pushTrail(): void {
    this.trail.push({ x: this.pos.x, y: this.pos.y });
    if (this.trail.length > BALL.maxTrail) this.trail.shift();
  }
}
