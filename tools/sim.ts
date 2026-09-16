/**
 * Headless match runner — the main correctness net for the game.
 *
 * Because src/core never imports Phaser, the entire simulation runs in plain
 * Node. This plays hundreds of all-bot matches and asserts the invariants that
 * matter: matches terminate, nobody escapes the arena, nothing becomes NaN, and
 * exactly seven players get eliminated before a winner is declared.
 *
 *   npx tsx tools/sim.ts [matches] [difficulty]
 */
import { MATCH, type Difficulty } from '../src/config/balance.ts';
import { MatchState } from '../src/core/MatchState.ts';
import { dot, sub } from '../src/core/geometry.ts';

const matches = Number(process.argv[2] ?? 200);
const difficulty = (process.argv[3] ?? 'normal') as Difficulty;
const STEP = MATCH.fixedStep;
const MAX_SECONDS = 900;

interface Failure {
  seed: number;
  reason: string;
}

const failures: Failure[] = [];
let totalSteps = 0;
let totalTime = 0;
let worstEscape = 0;
const durations: number[] = [];
const winners = new Map<number, number>();
const firstEliminations: number[] = [];
let hazardsDropped = 0;
let powerupsTaken = 0;

const t0 = Date.now();

for (let i = 0; i < matches; i++) {
  const seed = 0x1000 + i * 7919;
  const m = new MatchState({ humans: 0, difficulty, seed });
  let eliminations = 0;
  let guard = Math.ceil(MAX_SECONDS / STEP);
  let failed = false;

  const fail = (reason: string) => {
    if (!failed) failures.push({ seed, reason });
    failed = true;
  };

  while (m.phase !== 'over' && guard-- > 0) {
    m.step(STEP);
    totalSteps++;

    for (const e of m.events) {
      if (e.type === 'eliminated') {
        eliminations++;
        if (eliminations === 1) firstEliminations.push(m.time);
      }
      if (e.type === 'hazardPlaced') hazardsDropped++;
      if (e.type === 'powerup') powerupsTaken++;
    }
    m.events.length = 0;

    if (m.phase !== 'playing') continue;

    for (const ball of m.balls) {
      if (!ball.active) continue;
      if (!Number.isFinite(ball.pos.x) || !Number.isFinite(ball.pos.y)) {
        fail('ball position became non-finite');
        break;
      }
      if (!Number.isFinite(ball.vel.x) || !Number.isFinite(ball.vel.y)) {
        fail('ball velocity became non-finite');
        break;
      }
      // How far outside the polygon is it? A small overshoot is the normal
      // "about to be scored" state; a big one means it slipped through.
      let worst = 0;
      for (const w of m.arena.walls) {
        if (w.length < 1e-3) continue;
        const d = dot(sub(ball.pos, w.mid), w.normal);
        if (d < worst) worst = d;
      }
      const escape = -worst;
      if (escape > worstEscape) worstEscape = escape;
      if (escape > 40) fail(`ball escaped the arena by ${escape.toFixed(1)} units`);
    }

    for (const p of m.players) {
      if (!Number.isFinite(p.t) || p.t < -0.01 || p.t > 1.01) {
        fail(`paddle parameter out of range (${p.t})`);
      }
    }
    if (failed) break;
  }

  if (failed) continue;
  if (m.phase !== 'over') {
    failures.push({ seed, reason: `match did not finish within ${MAX_SECONDS}s` });
    continue;
  }
  if (m.winner === null) {
    failures.push({ seed, reason: 'match ended with no winner' });
    continue;
  }
  if (eliminations !== m.players.length - 1) {
    failures.push({ seed, reason: `expected 7 eliminations, saw ${eliminations}` });
    continue;
  }
  const placements = m.players.map((p) => p.placement).sort((a, b) => a - b);
  const expected = m.players.map((_, k) => k + 1);
  if (placements.join(',') !== expected.join(',')) {
    failures.push({ seed, reason: `placements were ${placements.join(',')}` });
    continue;
  }

  durations.push(m.time);
  totalTime += m.time;
  winners.set(m.winner, (winners.get(m.winner) ?? 0) + 1);
}

const wall = ((Date.now() - t0) / 1000).toFixed(1);
durations.sort((a, b) => a - b);
const pct = (p: number) => durations[Math.floor((durations.length - 1) * p)] ?? 0;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

console.log(`\nSIDE OUT — headless simulation (${difficulty})`);
console.log('='.repeat(52));
console.log(`matches            ${matches}`);
console.log(`failures           ${failures.length}`);
console.log(`sim steps          ${totalSteps.toLocaleString()} in ${wall}s wall clock`);
console.log(
  `match length       min ${fmt(pct(0))}  median ${fmt(pct(0.5))}  p90 ${fmt(pct(0.9))}  max ${fmt(pct(1))}`,
);
console.log(`avg match time     ${fmt(totalTime / Math.max(1, durations.length))}`);
const avgFirst =
  firstEliminations.reduce((a, b) => a + b, 0) / Math.max(1, firstEliminations.length);
console.log(`first elimination  ${avgFirst.toFixed(1)}s on average`);
console.log(`max overshoot      ${worstEscape.toFixed(1)} units past a wall`);
console.log(`hazards dropped    ${hazardsDropped}`);
console.log(`power-ups taken    ${powerupsTaken}`);

const spread = [...winners.entries()].sort((a, b) => b[1] - a[1]);
console.log(
  `winner by seat     ${spread.map(([id, n]) => `#${id}:${n}`).join('  ')}`,
);

if (failures.length) {
  console.log('\nFAILURES');
  for (const f of failures.slice(0, 12)) console.log(`  seed ${f.seed}: ${f.reason}`);
  if (failures.length > 12) console.log(`  ... and ${failures.length - 12} more`);
  process.exit(1);
}
console.log('\nAll invariants held.\n');
