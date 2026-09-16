import type { MatchState } from '../core/MatchState.ts';
import { clamp, lineParam } from '../core/geometry.ts';

interface KeyPair {
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
}

/**
 * Turns fingers and keys into paddle targets.
 *
 * Touch is multi-pointer: on touch-down a pointer binds to the nearest human
 * wall and drives that paddle until it lifts, which is what makes 2–4 players
 * on one phone work. Keyboard seats get their own left/right pair.
 */
export class InputManager {
  private readonly keys: KeyPair[] = [];
  /** pointer id → player id */
  private readonly bound = new Map<number, number>();
  private readonly singleHuman: boolean;
  private mouseMoved = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly humanIds: number[],
  ) {
    this.singleHuman = humanIds.length === 1;
    const kb = scene.input.keyboard;
    if (kb) {
      const C = Phaser.Input.Keyboard.KeyCodes;
      const layouts: [number, number][] = [
        [C.LEFT, C.RIGHT],
        [C.A, C.D],
        [C.J, C.L],
        [C.NUMPAD_FOUR, C.NUMPAD_SIX],
      ];
      for (let i = 0; i < humanIds.length; i++) {
        const [l, r] = layouts[i % layouts.length];
        this.keys.push({ left: kb.addKey(l, true, true), right: kb.addKey(r, true, true) });
      }
    }
    // Four simultaneous touches: enough for four players sharing a screen.
    scene.input.addPointer(3);
    // A mouse only takes over once it has actually moved — otherwise a cursor
    // parked over the arena would drag a keyboard player's paddle to it.
    scene.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!ptr.wasTouch) this.mouseMoved = true;
    });
  }

  /** Refresh pointer→player bindings. Call once per frame before stepping. */
  update(m: MatchState): void {
    const pointers = this.scene.input.manager.pointers;

    for (const ptr of pointers) {
      const isMouseHover = this.singleHuman && this.mouseMoved && !ptr.wasTouch && ptr.id === 0;
      if (!ptr.isDown && !isMouseHover) {
        this.bound.delete(ptr.id);
        continue;
      }
      if (this.bound.has(ptr.id)) continue;

      const taken = new Set(this.bound.values());
      let bestId: number | null = null;
      let bestDist = Infinity;
      for (const id of this.humanIds) {
        if (taken.has(id)) continue;
        const p = m.player(id);
        if (!p.alive) continue;
        const wall = m.arena.wallOf(id);
        if (!wall) continue;
        const d = Math.hypot(ptr.worldX - wall.mid.x, ptr.worldY - wall.mid.y);
        if (d < bestDist) {
          bestDist = d;
          bestId = id;
        }
      }
      if (bestId !== null) this.bound.set(ptr.id, bestId);
    }
  }

  /** Desired paddle position (0..1) for one player this frame. */
  targetFor(playerId: number, m: MatchState): number {
    const p = m.player(playerId);
    const wall = m.arena.wallOf(playerId);
    if (!wall || wall.length < 1) return p.t;

    // Keys win while they are held, so a resting mouse cursor can't pin the
    // paddle in place for a player who is using the keyboard.
    const seat = this.humanIds.indexOf(playerId);
    const keys = this.keys[seat];
    if (keys && (keys.left.isDown || keys.right.isDown)) {
      // "Left" means left on screen, whichever way this wall happens to run.
      const horizontal = Math.abs(wall.tangent.x) >= Math.abs(wall.tangent.y);
      const forward = horizontal ? wall.tangent.x > 0 : wall.tangent.y > 0;
      if (keys.left.isDown) return forward ? 0 : 1;
      return forward ? 1 : 0;
    }

    for (const [pointerId, boundPlayer] of this.bound) {
      if (boundPlayer !== playerId) continue;
      const ptr = this.scene.input.manager.pointers.find((q) => q.id === pointerId);
      if (!ptr) continue;
      return clamp(lineParam({ x: ptr.worldX, y: ptr.worldY }, wall.a, wall.b), 0, 1);
    }

    return p.t;
  }

  destroy(): void {
    for (const k of this.keys) {
      k.left.destroy();
      k.right.destroy();
    }
    this.bound.clear();
  }
}
