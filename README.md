# SIDE OUT

Eight players, one arena, one wall each, two misses and you shatter. Your wall
breaks, the arena closes the gap and becomes a smaller shape — octagon,
heptagon, hexagon, down to a two-paddle duel. The ball speeds up on every
return, more balls join as the match goes on, and past a point the walls
themselves start closing in. Players who are knocked out don't leave: they
drop pegs, gravity wells and spinning bars on the survivors.

A neon-space survival Pong for the web, wrapped for Android with Capacitor.
Inspired by *SIDE OUT* by marcopoloTW.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production bundle in dist/
```

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Production bundle into `dist/` |
| `npm run typecheck` | `tsc --noEmit` over `src/` and `tools/` |
| `npm run sim` | Headless match simulation — the main correctness test |
| `npm run browser-test` | Loads the built game in Chromium, checks input and console |
| `npm run android` | Build, sync and open the Android project |

Android build instructions are in [ANDROID.md](./ANDROID.md).

## Controls

| | |
|---|---|
| Player 1 | Touch, mouse, or ← → |
| Player 2 | A / D |
| Player 3 | J / L |
| Player 4 | Numpad 4 / 6 |
| Pause | P or Esc, the button, or Android's back |

Touch is multi-pointer, so 2–4 people can share one phone — each finger binds to
the nearest human wall on touch-down and drives that paddle until it lifts.

Once you're knocked out the sabotage bar appears: pick a hazard, tap the arena to
drop it, then wait out the 8-second cooldown. Knocked-out bots do the same thing
automatically.

## How the code is laid out

```
src/
  config/      balance.ts — every tunable; theme.ts — every colour and the seat roster
  core/        the simulation. NO PHASER IMPORTS ANYWHERE IN HERE.
  controllers/ input → paddle target (human and bot share one interface)
  render/      arena/wall/paddle drawing, particles, HUD
  scenes/      Boot → Menu → Game → Results
  audio/       runtime-synthesised sound, no asset files
  platform/    the Android shell bridge (no-ops in a browser)
tools/         sim.ts (headless matches), browser-test.mjs, diag.ts,
               build-artifact.mjs (packs dist/ into one publishable page)
```

One rule shapes the whole thing:

> **`src/core/` never imports Phaser.**

Geometry, collision, match flow and bot AI are plain TypeScript. That's what lets
`npm run sim` play hundreds of complete matches in seconds with no browser, and
it's why online multiplayer later means running the same `core/` on a server
rather than rewriting the game.

Phaser handles scenes, input plumbing, drawing, tweens, particles and scaling —
but not physics. Neither Arcade nor Matter deals well with paddles sliding along
the edges of a rotating, morphing polygon, so collision is exact segment maths in
`core/geometry.ts` instead: about 120 lines, deterministic, testable without a
renderer.

### The interesting part: reshaping the arena

Walls are derived from a vertex ring, and each one belongs to a player. When
someone is knocked out, their wall's two corners merge into a single point and
every vertex tweens to its place in the next regular polygon — so the ring
stays closed the whole way and the ball never has a gap to escape through. The
final two are the exception: a 2-sided polygon is degenerate, so the arena
becomes a rectangle with the survivors facing each other and the dead walls
turned into solid boarding. See `core/Arena.ts`.

## Look and feel

`src/config/theme.ts` holds the whole palette: a deep-indigo void (`COLORS.bg`),
cyan/violet brand glow (`accent`/`accent2`), and the eight `PLAYER_COLORS` /
`PLAYER_NAMES` every seat is drawn from. `render/ArenaRenderer.ts` draws
everything with one technique — a three-pass neon stroke (wide haze, mid halo,
bright core) — so walls, paddles, hazards and the ball all read as the same
glowing material. The starfield and nebula backdrop are baked once to a canvas
texture in `BootScene.ts` rather than drawn live, which is what keeps the frame
budget flat even with five balls and a field of hazards on screen.

`scenes/MenuScene.ts` is the most visually deliberate file in the game: the
title glows via canvas shadow-blur rather than a stack of duplicate sprites, the
octagon preview behind it is the real match geometry (`core/geometry.ts`'s
`regularPolygon`) turning at a slow, hypnotic rate, and the setup controls live
in one card so the eye has a single place to rest below the header.

## Testing

```bash
npm run sim 500            # 500 all-bot matches, asserts the invariants
npm run sim 200 hard       # a specific difficulty
npm run browser-test       # real Chromium: input, console errors, screenshots
```

The simulation asserts that every match terminates with exactly one winner, that
all seven knockouts happen, that placements are a clean 1–8, that no ball ever
ends up meaningfully outside the arena, and that nothing becomes NaN. Screenshots
land in `shots/`.

## Tuning

`src/config/balance.ts` — ball speed and its per-return multiplier, paddle length
and travel speed, when extra balls join, when the walls start closing in, hazard
cooldowns, power-up durations, and the three bot difficulty profiles. Change a
number, run `npm run sim`, and the new match-length distribution comes back in
seconds.

## Publishing as a single page

```bash
npm run build
node tools/build-artifact.mjs   # writes artifact/index.html
```

That file bundles the built game (Phaser ships alongside it, not from a CDN) into
one self-contained page — no document shell of its own, so it's ready to hand to
any host that wraps page content in its own `<!doctype>`/`<head>`/`<body>`.
