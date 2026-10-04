// Troll Forces — flow-field navigation for the interior maps.
//
// Straight-line steering is fine on an open arena: there is nothing to get
// stuck on. The Pentagrin is rooms off corridors, and a zombie that walks at
// the player walks into a wall and stays there, so anything chasing you
// indoors needs to know the way round.
//
// A flow field rather than per-agent A*: every zombie on a floor is chasing
// the same target, so one breadth-first sweep out from the player gives all
// of them their next step, and it costs one pass over a ~3k-cell grid.

import * as THREE from "three";

const CELL = 1.1;

/* A collider only blocks a walker if it is tall enough to stop one. Knee-high
   decking, desks and the pit tiers are stepped over by both the movement
   controller and the enemies, so treating them as walls would seal off rooms
   that are perfectly walkable. */
function blocks(c, floorY, step = 1.0) {
  return c.max.y > floorY + step && c.min.y < floorY + 2.2;
}

/* Does the segment (x0,z0)-(x1,z1) pass through the box's footprint?
   A start already inside it doesn't count: a point standing in furniture
   still has to get out somewhere. */
function segmentHitsBox(x0, z0, x1, z1, bx0, bx1, bz0, bz1) {
  if (x0 > bx0 && x0 < bx1 && z0 > bz0 && z0 < bz1) return false;
  let t0 = 0, t1 = 1;
  const dx = x1 - x0, dz = z1 - z0;
  for (const [p, d, lo, hi] of [[x0, dx, bx0, bx1], [z0, dz, bz0, bz1]]) {
    if (Math.abs(d) < 1e-9) { if (p <= lo || p >= hi) return false; continue; }
    let a = (lo - p) / d, b = (hi - p) / d;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    if (t0 >= t1) return false;
  }
  return true;
}

export class FlowField {
  /* `needSupport`: only cells with a floor under them at floorY are open.
     The ground floor never needs it (the world plane is everywhere), but an
     upper storey does, or the field routes walkers out of a window and
     across thin air. */
  /* `step`: the tallest thing a walker gets over. 1 m by default (bots
     vault); a zombie only steps about half that, so a hay bale is a wall. */
  /* `template`: another field on the same map: its blocked grid is copied
     instead of being worked out again from every collider. */
  constructor(colliders, bounds, floorY, { needSupport = false, cell = CELL, pad = 0.35, step = 1.0, template = null } = {}) {
    if (template) {
      this.cell = template.cell;
      this.floorY = template.floorY;
      this.minX = template.minX;
      this.minZ = template.minZ;
      this.w = template.w;
      this.h = template.h;
      this.blocked = template.blocked.slice();
      this.walls = template.walls;
      this.dist = new Int32Array(this.w * this.h);
      this.queue = new Int32Array(this.w * this.h);
      this.targetIdx = -1;
      return;
    }
    this.cell = cell;
    this.floorY = floorY;
    this.minX = bounds.minX;
    this.minZ = bounds.minZ;
    this.w = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / this.cell));
    this.h = Math.max(1, Math.ceil((bounds.maxZ - bounds.minZ) / this.cell));
    this.blocked = new Uint8Array(this.w * this.h);
    this.dist = new Int32Array(this.w * this.h);
    this.queue = new Int32Array(this.w * this.h);
    this.targetIdx = -1;

    if (needSupport) {
      // Start everything blocked, then open the cells a floor top covers.
      // Cells are opened by their centre, so a slab's ragged edge stays shut.
      this.blocked.fill(1);
      for (const c of colliders) {
        if (Math.abs(c.max.y - floorY) > 0.45) continue;
        const x0 = Math.ceil((c.min.x - this.minX) / this.cell - 0.5);
        const x1 = Math.floor((c.max.x - this.minX) / this.cell - 0.5);
        const z0 = Math.ceil((c.min.z - this.minZ) / this.cell - 0.5);
        const z1 = Math.floor((c.max.z - this.minZ) / this.cell - 0.5);
        for (let iz = Math.max(0, z0); iz <= Math.min(this.h - 1, z1); iz++) {
          for (let ix = Math.max(0, x0); ix <= Math.min(this.w - 1, x1); ix++) {
            this.blocked[iz * this.w + ix] = 0;
          }
        }
      }
    }

    // A cell is blocked if any tall collider overlaps it. The half-cell
    // margin keeps walkers from clipping corners they can't actually fit.
    // (`pad` is that margin, 0.35 m unless a map asks for a finer grid.)
    // The blockers' own footprints (unpadded) are kept too, for openIndex.
    const walls = [];
    for (const c of colliders) {
      if (!blocks(c, floorY, step)) continue;
      walls.push(c.min.x, c.max.x, c.min.z, c.max.z);
      const x0 = Math.floor((c.min.x - pad - this.minX) / this.cell);
      const x1 = Math.ceil((c.max.x + pad - this.minX) / this.cell);
      const z0 = Math.floor((c.min.z - pad - this.minZ) / this.cell);
      const z1 = Math.ceil((c.max.z + pad - this.minZ) / this.cell);
      for (let iz = Math.max(0, z0); iz < Math.min(this.h, z1); iz++) {
        for (let ix = Math.max(0, x0); ix < Math.min(this.w, x1); ix++) {
          this.blocked[iz * this.w + ix] = 1;
        }
      }
    }
    this.walls = new Float32Array(walls);
  }

  index(x, z) {
    const ix = Math.floor((x - this.minX) / this.cell);
    const iz = Math.floor((z - this.minZ) / this.cell);
    if (ix < 0 || iz < 0 || ix >= this.w || iz >= this.h) return -1;
    return iz * this.w + ix;
  }

  /* Nearest open cell to a point, so a target standing in a doorway or half
     inside furniture still produces a usable field. Nearest by distance, and
     one it can walk to in a straight line: the first open cell in scan order
     could be through a wall (user, 2026-10-04: "the bots are stuck"). Troll
     City's stair foot, in a pocket a metre wide, snapped to the street
     outside the saloon, so bots went out there and ground on the wall. */
  openIndex(x, z) {
    const start = this.index(x, z);
    if (start < 0) return -1;
    if (!this.blocked[start]) return start;
    const sx = start % this.w, sz = (start / this.w) | 0, R = 4;
    const cand = [];
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        const ix = sx + dx, iz = sz + dz;
        if (ix < 0 || iz < 0 || ix >= this.w || iz >= this.h) continue;
        const i = iz * this.w + ix;
        if (this.blocked[i]) continue;
        const cx = this.minX + (ix + 0.5) * this.cell, cz = this.minZ + (iz + 0.5) * this.cell;
        cand.push({ i, cx, cz, d: (cx - x) ** 2 + (cz - z) ** 2 });
      }
    }
    if (!cand.length) return -1;
    cand.sort((a, b) => a.d - b.d);
    const walls = this.walls;
    if (!walls?.length) return cand[0].i;
    // Only the blockers near here can be in the way.
    const reach = (R + 1) * this.cell;
    const near = [];
    for (let k = 0; k < walls.length; k += 4) {
      if (walls[k] > x + reach || walls[k + 1] < x - reach || walls[k + 2] > z + reach || walls[k + 3] < z - reach) continue;
      near.push(k);
    }
    for (const c of cand) {
      let clear = true;
      for (const k of near) {
        if (segmentHitsBox(x, z, c.cx, c.cz, walls[k], walls[k + 1], walls[k + 2], walls[k + 3])) { clear = false; break; }
      }
      if (clear) return c.i;
    }
    return cand[0].i;
  }

  /* Breadth-first sweep out from the target. `dist` ends up holding the step
     count to reach it, or 0 for unreachable. */
  compute(x, z) {
    const start = this.openIndex(x, z);
    if (start < 0) return false;
    if (start === this.targetIdx) return true;   // already current
    this.targetIdx = start;
    this.dist.fill(0);
    this.dist[start] = 1;
    let head = 0, tail = 0;
    this.queue[tail++] = start;
    while (head < tail) {
      const i = this.queue[head++];
      const ix = i % this.w, iz = (i / this.w) | 0;
      const d = this.dist[i];
      for (let n = 0; n < 4; n++) {
        const jx = ix + (n === 0 ? 1 : n === 1 ? -1 : 0);
        const jz = iz + (n === 2 ? 1 : n === 3 ? -1 : 0);
        if (jx < 0 || jz < 0 || jx >= this.w || jz >= this.h) continue;
        const j = jz * this.w + jx;
        if (this.blocked[j] || this.dist[j]) continue;
        this.dist[j] = d + 1;
        this.queue[tail++] = j;
      }
    }
    return true;
  }

  /* Unit direction toward the target from a world position, or null when
     this spot has no route (outside the grid, or walled off). */
  steer(x, z, out = new THREE.Vector3()) {
    const i = this.openIndex(x, z);
    if (i < 0 || !this.dist[i]) return null;
    const ix = i % this.w, iz = (i / this.w) | 0;
    let best = this.dist[i], bx = 0, bz = 0;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const jx = ix + dx, jz = iz + dz;
        if (jx < 0 || jz < 0 || jx >= this.w || jz >= this.h) continue;
        const j = jz * this.w + jx;
        if (this.blocked[j] || !this.dist[j]) continue;
        // A diagonal step is only legal if both orthogonals are open, or
        // walkers cut through the corner of a wall.
        if (dx && dz) {
          if (this.blocked[iz * this.w + jx] || this.blocked[jz * this.w + ix]) continue;
        }
        if (this.dist[j] < best) { best = this.dist[j]; bx = dx; bz = dz; }
      }
    }
    if (!bx && !bz) return null;
    // Aim at the middle of the chosen cell rather than along the axis, so a
    // walker follows a smooth line instead of stair-stepping.
    const cx = this.minX + (ix + bx + 0.5) * this.cell;
    const cz = this.minZ + (iz + bz + 0.5) * this.cell;
    return out.set(cx - x, 0, cz - z).normalize();
  }
}
