import { ARENA } from '../config/balance.ts';
import {
  type Vec,
  clone,
  easeInOut,
  lerpVec,
  norm,
  regularPolygon,
  rotationForBottomSide,
  sub,
} from './geometry.ts';

export interface Wall {
  /** Player defending this wall, or null for a solid (unowned) wall. */
  owner: number | null;
  a: Vec;
  b: Vec;
  mid: Vec;
  /** Unit normal pointing into the arena. */
  normal: Vec;
  /** Unit vector from a to b. */
  tangent: Vec;
  length: number;
}

/**
 * The playfield: a convex ring of walls, one per surviving player.
 *
 * Eliminating a player collapses their wall's two corners into one and tweens
 * every vertex to the next regular polygon, so the arena visibly "closes the
 * gap". The final two players get a rectangle instead of a degenerate 2-gon:
 * two paddles facing each other, two solid side walls.
 */
export class Arena {
  readonly cx: number;
  readonly cy: number;
  readonly baseRadius: number;

  /** Shrinks toward ARENA.minRadiusScale once the walls start closing in. */
  radiusScale = 1;

  mode: 'poly' | 'duel' = 'poly';
  owners: (number | null)[] = [];
  verts: Vec[] = [];
  walls: Wall[] = [];

  /** Player kept at the bottom of the screen (the local human, when alive). */
  anchor: number | null = null;

  private morphFrom: Vec[] | null = null;
  private morphElapsed = 0;

  constructor(cx: number, cy: number, radius: number, aliveIds: number[], anchor: number | null) {
    this.cx = cx;
    this.cy = cy;
    this.baseRadius = radius;
    this.owners = aliveIds.slice();
    this.anchor = anchor;
    this.verts = this.targetVerts();
    this.rebuildWalls();
  }

  get radius(): number {
    return this.baseRadius * this.radiusScale;
  }

  get morphing(): boolean {
    return this.morphFrom !== null;
  }

  /** Ordered list of living player ids (skips the solid walls of the duel arena). */
  get livingOwners(): number[] {
    return this.owners.filter((o): o is number => o !== null);
  }

  wallOf(playerId: number): Wall | undefined {
    return this.walls.find((w) => w.owner === playerId);
  }

  setAnchor(id: number | null): void {
    this.anchor = id;
  }

  /** Remove a player's wall and start the re-shape tween. */
  eliminate(playerId: number): void {
    const e = this.owners.indexOf(playerId);
    if (e < 0) return;
    const n = this.owners.length;
    const remaining = this.livingOwners.length - 1;

    if (remaining >= 3) {
      this.morphFrom = collapseVertex(this.verts, e);
      this.owners = this.owners.filter((_, i) => i !== e);
    } else if (remaining === 2 && this.mode === 'poly' && n === 3) {
      // Triangle → duel rectangle. The dead wall becomes a solid side wall and a
      // zero-length wall opens up into the other one.
      const V = this.verts;
      const o = this.owners;
      const i1 = (e + 1) % 3;
      const i2 = (e + 2) % 3;
      this.morphFrom = [clone(V[i1]), clone(V[i2]), clone(V[i2]), clone(V[e])];
      this.owners = [o[i1], null, o[i2], null];
      this.mode = 'duel';
    } else {
      // Nothing sensible left to morph into (someone won).
      this.owners = this.owners.filter((_, i) => i !== e);
      this.morphFrom = null;
      return;
    }

    this.morphElapsed = 0;
    // Adopt the collapsed shape immediately. Without this the walls still
    // describe the previous ring for the remainder of this step, and a ball
    // can slip through a wall whose owner no longer exists.
    this.verts = this.morphFrom;
    this.rebuildWalls();
  }

  update(dt: number): void {
    const target = this.targetVerts();
    if (this.morphFrom) {
      this.morphElapsed += dt;
      const t = this.morphElapsed / ARENA.morphTime;
      if (t >= 1) {
        this.verts = target;
        this.morphFrom = null;
      } else {
        const k = easeInOut(t);
        this.verts = this.morphFrom.map((from, i) => lerpVec(from, target[i], k));
      }
    } else {
      this.verts = target;
    }
    this.rebuildWalls();
  }

  /** The layout the arena is settling toward right now. */
  private targetVerts(): Vec[] {
    const m = this.owners.length;
    if (this.mode === 'duel') {
      const hw = this.radius * ARENA.duelHalfW;
      const hh = this.radius * ARENA.duelHalfH;
      // Same winding as the polygon case: bottom edge runs right → left.
      const corners: Vec[] = [
        { x: this.cx + hw, y: this.cy + hh },
        { x: this.cx - hw, y: this.cy + hh },
        { x: this.cx - hw, y: this.cy - hh },
        { x: this.cx + hw, y: this.cy - hh },
      ];
      let bottomIdx = 0;
      if (this.anchor !== null) {
        const ai = this.owners.indexOf(this.anchor);
        if (ai === 0 || ai === 2) bottomIdx = ai;
      }
      const out: Vec[] = new Array(4);
      for (let k = 0; k < 4; k++) out[(bottomIdx + k) % 4] = corners[k];
      return out;
    }

    let anchorIdx = this.anchor === null ? 0 : this.owners.indexOf(this.anchor);
    if (anchorIdx < 0) anchorIdx = 0;
    return regularPolygon(m, this.cx, this.cy, this.radius, rotationForBottomSide(m, anchorIdx));
  }

  private rebuildWalls(): void {
    const n = this.verts.length;
    if (this.walls.length !== n) this.walls = new Array(n);
    for (let i = 0; i < n; i++) {
      const a = this.verts[i];
      const b = this.verts[(i + 1) % n];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const d = sub(b, a);
      const length = Math.hypot(d.x, d.y);
      const tangent = length > 1e-6 ? { x: d.x / length, y: d.y / length } : { x: 1, y: 0 };
      // Inward normal: straight from the wall's midpoint toward the centre.
      // Robust regardless of winding, and correct for any convex shape.
      const normal = norm({ x: this.cx - mid.x, y: this.cy - mid.y });
      this.walls[i] = { owner: this.owners[i] ?? null, a, b, mid, normal, tangent, length };
    }
  }
}

/**
 * Merge the two endpoints of wall `e` into their midpoint, producing a vertex
 * list one shorter whose wall order still lines up with `owners` minus `e`.
 */
function collapseVertex(verts: Vec[], e: number): Vec[] {
  const n = verts.length;
  const a = verts[e];
  const b = verts[(e + 1) % n];
  const merged: Vec = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  if (e === n - 1) {
    // Wrap-around wall: the merged corner becomes the new vertex 0.
    return [merged, ...verts.slice(1, n - 1).map(clone)];
  }
  return [...verts.slice(0, e).map(clone), merged, ...verts.slice(e + 2).map(clone)];
}
