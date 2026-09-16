/** One-off diagnostic: reproduce an escape and dump the arena state around it. */
import { MATCH } from '../src/config/balance.ts';
import { MatchState } from '../src/core/MatchState.ts';
import { dot, sub } from '../src/core/geometry.ts';

const seed = Number(process.argv[2] ?? 12015);
const m = new MatchState({ humans: 0, difficulty: 'normal', seed });
const STEP = MATCH.fixedStep;
let reported = 0;

for (let i = 0; i < 900 / STEP && m.phase !== 'over'; i++) {
  const morphingBefore = m.arena.morphing;
  m.step(STEP);
  m.events.length = 0;
  if (m.phase !== 'playing') continue;

  for (const ball of m.balls) {
    if (!ball.active) continue;
    let worst = 0;
    let worstIdx = -1;
    m.arena.walls.forEach((w, idx) => {
      if (w.length < 1e-3) return;
      const d = dot(sub(ball.pos, w.mid), w.normal);
      if (d < worst) {
        worst = d;
        worstIdx = idx;
      }
    });
    if (-worst > 70 && reported < 6) {
      reported++;
      const w = m.arena.walls[worstIdx];
      console.log(`t=${m.time.toFixed(2)}s  depth=${(-worst).toFixed(1)}`);
      console.log(
        `  arena mode=${m.arena.mode} morphing=${morphingBefore}->${m.arena.morphing} walls=${m.arena.walls.length} alive=${m.aliveCount}`,
      );
      console.log(
        `  worst wall #${worstIdx} owner=${w?.owner} len=${w?.length.toFixed(1)} speed=${ball.speed.toFixed(0)}`,
      );
      console.log(
        `  wall lengths: ${m.arena.walls.map((x) => x.length.toFixed(0)).join(', ')}`,
      );
      console.log(
        `  owners: ${m.arena.owners.map((o) => (o === null ? '-' : o)).join(', ')}  lives: ${m.players.map((p) => (p.alive ? p.lives : 'x')).join(',')}`,
      );
    }
  }
}
console.log(`done. phase=${m.phase} winner=${m.winner} reports=${reported}`);
