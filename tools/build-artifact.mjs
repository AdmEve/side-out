/**
 * Packs dist/ into a single publishable Artifact page.
 *
 * The Artifact host wraps whatever we write in its own <!doctype>/<head>/<body>,
 * so this emits page *content* only — no document tags. Phaser ships alongside
 * as a supporting file rather than from a CDN, so the page works regardless of
 * what any third-party host is serving that day.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const game = await readFile(resolve('dist/game.js'), 'utf8');

const page = `<title>Side Out</title>
<style>
  @font-face {
    font-family: 'Vazirmatn';
    src: url('fonts/Vazirmatn-Regular.woff2') format('woff2');
    font-weight: 400;
    font-display: block;
  }
  @font-face {
    font-family: 'Vazirmatn';
    src: url('fonts/Vazirmatn-Bold.woff2') format('woff2');
    font-weight: 700;
    font-display: block;
  }
  @font-face {
    font-family: 'Vazirmatn';
    src: url('fonts/Vazirmatn-Black.woff2') format('woff2');
    font-weight: 900;
    font-display: block;
  }
  html, body {
    height: 100%;
    background: #05060f;
    overflow: hidden;
    overscroll-behavior: none;
    font-family: Vazirmatn, ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  }
  #game {
    position: fixed;
    inset: 0;
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  #game canvas { display: block; touch-action: none; }
  #boot {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    color: #39f3ff;
    font: 16px Vazirmatn, ui-monospace, "SF Mono", Menlo, monospace;
    letter-spacing: 0.1em;
  }
</style>

<div id="game"></div>
<div id="boot" dir="rtl">میدان بازمانده…</div>

<script src="phaser.min.js"></script>
<script>
${game}
document.getElementById('boot')?.remove();
</script>
`;

await mkdir(resolve('artifact'), { recursive: true });
await writeFile(resolve('artifact/index.html'), page);
console.log(`artifact/index.html written — ${(page.length / 1024).toFixed(0)} KB of page`);
