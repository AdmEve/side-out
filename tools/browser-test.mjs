/**
 * Loads the built game in a real browser, plays it, and reports console errors
 * plus frame timing. Captures screenshots at each stage of the arena's life so
 * the octagon → duel progression can be eyeballed.
 *
 *   node tools/browser-test.mjs [--desktop]
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const DIST = resolve('dist');
const SHOTS = resolve('shots');
mkdirSync(SHOTS, { recursive: true });

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  try {
    const url = req.url.split('?')[0];
    const file = join(DIST, url === '/' ? 'index.html' : url);
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const desktop = process.argv.includes('--desktop');
const viewport = desktop ? { width: 1440, height: 900 } : { width: 390, height: 844 };

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({
  viewport,
  deviceScaleFactor: 2,
  hasTouch: !desktop,
  isMobile: !desktop,
});

const errors = [];
const logs = [];
page.on('console', (msg) => {
  const text = `${msg.type()}: ${msg.text()}`;
  logs.push(text);
  if (msg.type() === 'error') errors.push(text);
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('response', (r) => {
  if (r.status() >= 400) errors.push(`http ${r.status()} ${r.url()}`);
});

await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
await page.waitForFunction(
  () => !!window.__game && window.__game.scene.getScene('Menu')?.scene.isActive(),
  { timeout: 30000 },
);
await page.waitForTimeout(800);
await page.screenshot({ path: join(SHOTS, `1-menu-${desktop ? 'desktop' : 'phone'}.png`) });

// Reach into the running game so the test can drive it deterministically.
const hook = async (fn, ...args) =>
  page.evaluate(
    ({ src, args }) => {
      const game = window.__game;
      // eslint-disable-next-line no-new-func
      return new Function('game', 'args', `return (${src})(game, ...args)`)(game, args);
    },
    { src: fn.toString(), args },
  );

const started = await hook((game) => {
  const menu = game.scene.getScene('Menu');
  if (!menu) return false;
  game.scene.start('Game', { humans: 1, difficulty: 'normal' });
  return true;
});
if (!started) errors.push('could not start the Game scene');

await page.waitForFunction(() => !!window.__game.scene.getScene('Game')?.match, { timeout: 20000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: join(SHOTS, `2-octagon-${desktop ? 'desktop' : 'phone'}.png`) });

// Wait out the 3-2-1 countdown: paddles are frozen until the match starts.
await page.waitForFunction(
  () => window.__game.scene.getScene('Game')?.match?.phase === 'playing',
  { timeout: 20000 },
);

// Does input actually move the local paddle? Pointer first, then keyboard.
const readT = () => hook((game) => game.scene.getScene('Game').match.player(0).t);
const before = await readT();
await page.mouse.move(viewport.width * 0.5, viewport.height * 0.72);
await page.mouse.down();
for (let i = 0; i <= 10; i++) {
  await page.mouse.move(
    viewport.width * (0.5 + 0.04 * i),
    viewport.height * 0.72,
  );
  await page.waitForTimeout(30);
}
await page.mouse.up();
await page.waitForTimeout(200);
const afterPointer = await readT();
const pointerMoved = Math.abs(afterPointer - before) > 0.02;
if (!pointerMoved) errors.push(`pointer did not move the paddle (t ${before} -> ${afterPointer})`);

await page.click('canvas', { position: { x: 40, y: 40 } }); // give the canvas focus
await page.keyboard.down('ArrowLeft');
await page.waitForTimeout(450);
await page.keyboard.up('ArrowLeft');
await page.waitForTimeout(150);
const afterKeys = await readT();
const keysMoved = Math.abs(afterKeys - afterPointer) > 0.02;
if (!keysMoved) errors.push(`arrow keys did not move the paddle (t ${afterPointer} -> ${afterKeys})`);

// Fast-forward the match by stepping the simulation directly, sampling frame
// cost as we go. This exercises eliminations, the morph and the duel arena.
const report = await hook(async (game) => {
  const scene = game.scene.getScene('Game');
  const m = scene.match;
  const samples = [];
  const marks = {};
  const step = 1 / 120;

  for (let i = 0; i < 120 * 260 && m.phase !== 'over'; i++) {
    const t0 = performance.now();
    m.step(step);
    samples.push(performance.now() - t0);
    const alive = m.aliveCount;
    if (marks[alive] === undefined) marks[alive] = Number(m.time.toFixed(1));
  }
  samples.sort((a, b) => a - b);
  return {
    phase: m.phase,
    winner: m.winner,
    time: Number(m.time.toFixed(1)),
    aliveMarks: marks,
    stepMedianMs: Number(samples[Math.floor(samples.length / 2)].toFixed(4)),
    stepP99Ms: Number(samples[Math.floor(samples.length * 0.99)].toFixed(4)),
    hazards: m.hazards.length,
    mode: m.arena.mode,
  };
});

await page.waitForTimeout(400);
await page.screenshot({ path: join(SHOTS, `3-endgame-${desktop ? 'desktop' : 'phone'}.png`) });
await page.waitForTimeout(2200);
await page.screenshot({ path: join(SHOTS, `4-results-${desktop ? 'desktop' : 'phone'}.png`) });

// Measure real rendered frame rate over a fresh match.
await hook((game) => game.scene.start('Game', { humans: 2, difficulty: 'hard' }));
await page.waitForTimeout(1200);
const fps = await page.evaluate(
  () =>
    new Promise((resolve) => {
      let frames = 0;
      const t0 = performance.now();
      const tick = () => {
        frames++;
        if (performance.now() - t0 < 2000) requestAnimationFrame(tick);
        else resolve(Math.round((frames * 1000) / (performance.now() - t0)));
      };
      requestAnimationFrame(tick);
    }),
);
await page.screenshot({ path: join(SHOTS, `5-hotseat-${desktop ? 'desktop' : 'phone'}.png`) });

const drawCost = await hook((game) => {
  const scene = game.scene.getScene('Game');
  const samples = [];
  for (let i = 0; i < 240; i++) {
    const t0 = performance.now();
    scene.arenaGfx.draw(scene.match, i / 60);
    scene.hud.update(scene.match);
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  return {
    n: samples.length,
    median: Number(samples[120].toFixed(3)),
    p99: Number(samples[237].toFixed(3)),
  };
});

console.log(`\nbrowser test — ${desktop ? 'desktop 1440x900' : 'phone 390x844'}`);
console.log('='.repeat(52));
console.log(JSON.stringify(report, null, 2));
console.log(`rendered fps       ${fps}`);
console.log(`pointer input      ${pointerMoved ? 'responds' : 'DEAD'}`);
console.log(`keyboard input     ${keysMoved ? 'responds' : 'DEAD'}`);
console.log(`draw cost          median ${drawCost.median}ms  p99 ${drawCost.p99}ms over ${drawCost.n} frames`);
console.log(`console errors     ${errors.length}`);
for (const e of errors.slice(0, 10)) console.log('  ' + e);

await browser.close();
server.close();
process.exit(errors.length ? 1 : 0);
