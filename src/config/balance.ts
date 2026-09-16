/**
 * Every tunable number in the game lives here. Nothing in core/ hard-codes a
 * magic value, so balancing the whole game is editing this one file.
 * All distances are in design-space units (the world is 900 x 1500).
 */

export const WORLD = { w: 900, h: 1500 } as const;

export const ARENA = {
  cx: 450,
  cy: 872,
  radius: 408,
  /** Arena radius multiplier once the walls have fully closed in. */
  minRadiusScale: 0.74,
  /** Seconds into the match when the walls start closing. */
  shrinkStart: 70,
  /** How long the close-in takes, in seconds. */
  shrinkDuration: 75,
  /** Duration of the polygon re-shape tween after an elimination, in seconds. */
  morphTime: 0.65,
  /** Final-duel rectangle, as fractions of the current arena radius. */
  duelHalfW: 0.82,
  duelHalfH: 1.0,
} as const;

export const BALL = {
  radius: 13,
  baseSpeed: 540,
  maxSpeed: 1320,
  /** Multiplier applied to ball speed on every successful return. */
  speedUp: 1.038,
  /** How far past a wall plane the ball must travel to count as a miss. */
  outMargin: 30,
  /** Pause before a ball re-enters play after a point, in seconds. */
  respawnDelay: 0.85,
  maxTrail: 10,
} as const;

export const PADDLE = {
  /** Paddle length as a fraction of the wall it slides along. */
  lengthFrac: 0.28,
  wideFrac: 0.46,
  thickness: 15,
  /** Human paddle travel speed, in wall-lengths per second. */
  humanSpeed: 2.9,
  /** How strongly the hit offset bends the outgoing ball direction. */
  angleInfluence: 0.7,
  /** Minimum |dot(dir, wallNormal)| after a bounce, to stop endless grazing. */
  minNormalComponent: 0.3,
  /** Extra sideways kick from a moving paddle. */
  english: 0.22,
} as const;

export const LIVES = { start: 2, max: 3 } as const;

export const ESCALATION = {
  /** Match time (seconds) at which each extra ball joins. */
  extraBallTimes: [28, 55, 85, 120, 160],
  maxBalls: 5,
} as const;

export const HAZARD = {
  /** Seconds an eliminated player must wait between drops. */
  cooldown: 8,
  /** Seconds a hazard stays on the field. */
  lifetime: 22,
  maxOnField: 10,
  pegRadius: 16,
  wellRadius: 135,
  /** Sideways acceleration applied inside a gravity well (units/s^2). */
  wellStrength: 1100,
  barLength: 130,
  barThickness: 10,
  barSpin: 1.7,
  /** Hazards may not be dropped closer than this to the arena edge. */
  edgeMargin: 90,
} as const;

export const POWERUP = {
  firstAt: 18,
  interval: 22,
  radius: 24,
  maxOnField: 2,
  wideDuration: 10,
  slowDuration: 6,
  slowFactor: 0.62,
} as const;

export type Difficulty = 'easy' | 'normal' | 'hard';

export const BOTS: Record<
  Difficulty,
  { reaction: number; speed: number; error: number; bounces: number; idleDrift: number }
> = {
  easy: { reaction: 0.28, speed: 1.25, error: 0.2, bounces: 1, idleDrift: 0.35 },
  normal: { reaction: 0.16, speed: 1.85, error: 0.125, bounces: 2, idleDrift: 0.6 },
  hard: { reaction: 0.08, speed: 2.55, error: 0.06, bounces: 2, idleDrift: 0.85 },
};

export const MATCH = {
  playerCount: 8,
  countdown: 3,
  /** Physics runs at a fixed step; the renderer just draws whatever state exists. */
  fixedStep: 1 / 120,
  maxStepsPerFrame: 8,
} as const;
