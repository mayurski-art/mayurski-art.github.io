// The spawn field: Black Ops 2 maps carry 40-60 respawn points; ours were
// authored with 8, so a camped corner often left nowhere safe to come in.
// This generates the rest from the map itself, for every map, existing and
// future, with nothing to author: open, reachable ground spread evenly over
// the floor plan. The authored points stay what they were (each team's start
// spawns, S&D sites, hill points); the field is what mid-match respawns score.

import { FlowField } from "../nav.js?v=ti1-bs1";
import { groundHeightAt } from "../movement.js?v=umb2-sb2";
import { insidePolygon } from "../edge.js";

const CLEAR = 1.0;        // metres of open floor all round a point (the spread rings need it)
const MIN_GAP = 5;        // no two points closer than this
const PER_POINT = 55;     // square metres of walkable floor per point...
const MIN_POINTS = 24, MAX_POINTS = 64;   // ...within these

/* Points to respawn at: the authored starts first (flagged `start`), then
   farthest-point picks from every reachable cell with room to stand, until
   the floor is covered or the cap is reached. One walk grid per floor the
   starts stand on (Undergrin's are on 1.1 m platforms, most maps' on the
   ground); nothing upstairs, as bots' spawns already were: an upstairs room
   opens far from the fight. */
export function buildSpawnField(colliders, arena, starts) {
  const levels = [...new Set(starts.filter((s) => (s.y || 0) < 3).map((s) => Math.round((s.y || 0) * 4) / 4))];
  const cand = [];
  let area = 0;
  for (const L of levels) area += floorCells(colliders, arena, starts, L, cand);
  const out = starts.map((s) => ({ x: s.x, y: s.y || 0, z: s.z, start: true }));
  const target = out.length + Math.max(MIN_POINTS, Math.min(MAX_POINTS, Math.round(area / PER_POINT)));
  const gap = cand.map((c) => Math.min(...out.map((o) => Math.hypot(o.x - c.x, o.z - c.z)), Infinity));
  while (out.length < target) {
    let best = -1;
    for (let i = 0; i < cand.length; i++) if (best < 0 || gap[i] > gap[best]) best = i;
    if (best < 0 || gap[best] < MIN_GAP) break;
    const p = cand[best];
    out.push(p);
    for (let i = 0; i < cand.length; i++) gap[i] = Math.min(gap[i], Math.hypot(cand[i].x - p.x, cand[i].z - p.z));
  }
  return out;
}

/* Every reachable cell on floor L (swept from the starts standing on it)
   with CLEAR metres of open floor round it, standing within a step of L: not
   on a table or a crate, not in water or off the map's edge. Pushes the
   candidates, returns the floor's walkable area in square metres. */
function floorCells(colliders, arena, starts, L, cand) {
  const field = new FlowField(colliders, arena, L, { needSupport: L > 0.05 });
  const n = field.w * field.h;
  const reach = new Uint8Array(n);
  for (const s of starts) {
    if (Math.abs((s.y || 0) - L) > 0.2 || !field.compute(s.x, s.z)) continue;
    for (let i = 0; i < n; i++) if (field.dist[i] > 0) reach[i] = 1;
  }
  const cell = field.cell, ring = Math.ceil(CLEAR / cell);
  const roomy = (ix, iz) => {
    for (let dz = -ring; dz <= ring; dz++) {
      for (let dx = -ring; dx <= ring; dx++) {
        const jx = ix + dx, jz = iz + dz;
        if (jx < 0 || jz < 0 || jx >= field.w || jz >= field.h || field.blocked[jz * field.w + jx]) return false;
      }
    }
    return true;
  };
  let floor = 0;
  for (let iz = 0; iz < field.h; iz++) {
    for (let ix = 0; ix < field.w; ix++) {
      if (!reach[iz * field.w + ix]) continue;
      floor++;
      if (!roomy(ix, iz)) continue;
      const x = field.minX + (ix + 0.5) * cell, z = field.minZ + (iz + 0.5) * cell;
      if (arena.edge && !insidePolygon(arena.edge, x, z)) continue;
      if (arena.wade && insidePolygon(arena.wade, x, z)) continue;
      const y = groundHeightAt(colliders, x, z, L + 1.0, 0.3);
      if (Math.abs(y - L) > 0.4) continue;
      cand.push({ x, y, z, start: false });
    }
  }
  return floor * cell * cell;
}
