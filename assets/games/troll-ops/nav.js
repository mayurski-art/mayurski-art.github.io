// Troll Ops — flow-field navigation for the interior maps.
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
function blocks(c, floorY) {
  return c.max.y > floorY + 1.0 && c.min.y < floorY + 2.2;
}

export class FlowField {
  constructor(colliders, bounds, floorY) {
    this.floorY = floorY;
    this.minX = bounds.minX;
    this.minZ = bounds.minZ;
    this.w = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / CELL));
    this.h = Math.max(1, Math.ceil((bounds.maxZ - bounds.minZ) / CELL));
    this.blocked = new Uint8Array(this.w * this.h);
    this.dist = new Int32Array(this.w * this.h);
    this.queue = new Int32Array(this.w * this.h);
    this.targetIdx = -1;

    // A cell is blocked if any tall collider overlaps it. The half-cell
    // margin keeps walkers from clipping corners they can't actually fit.
    const pad = 0.35;
    for (const c of colliders) {
      if (!blocks(c, floorY)) continue;
      const x0 = Math.floor((c.min.x - pad - this.minX) / CELL);
      const x1 = Math.ceil((c.max.x + pad - this.minX) / CELL);
      const z0 = Math.floor((c.min.z - pad - this.minZ) / CELL);
      const z1 = Math.ceil((c.max.z + pad - this.minZ) / CELL);
      for (let iz = Math.max(0, z0); iz < Math.min(this.h, z1); iz++) {
        for (let ix = Math.max(0, x0); ix < Math.min(this.w, x1); ix++) {
          this.blocked[iz * this.w + ix] = 1;
        }
      }
    }
  }

  index(x, z) {
    const ix = Math.floor((x - this.minX) / CELL);
    const iz = Math.floor((z - this.minZ) / CELL);
    if (ix < 0 || iz < 0 || ix >= this.w || iz >= this.h) return -1;
    return iz * this.w + ix;
  }

  /* Nearest open cell to a point, so a target standing in a doorway or half
     inside furniture still produces a usable field. */
  openIndex(x, z) {
    const start = this.index(x, z);
    if (start < 0) return -1;
    if (!this.blocked[start]) return start;
    const sx = start % this.w, sz = (start / this.w) | 0;
    for (let r = 1; r <= 4; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          const ix = sx + dx, iz = sz + dz;
          if (ix < 0 || iz < 0 || ix >= this.w || iz >= this.h) continue;
          const i = iz * this.w + ix;
          if (!this.blocked[i]) return i;
        }
      }
    }
    return -1;
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
    const cx = this.minX + (ix + bx + 0.5) * CELL;
    const cz = this.minZ + (iz + bz + 0.5) * CELL;
    return out.set(cx - x, 0, cz - z).normalize();
  }
}
