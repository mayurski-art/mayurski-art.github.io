// Troll Forces — the ground's height where a map has hills (doc "Troll Royale
// map in Roblox Studio", phase 2). Every map's floor was y 0; a map can now
// give a heightfield (`groundField` on its definition: Trollface Island's
// comes from the Studio terrain export), and everything that stands on the
// floor reads it from here: walking (movement.js groundHeightAt), the bots and
// their grid, loot, the parachute landing, bullets and line of sight.
//
// With no field set (every map today) floorAt is 0 and terrainHit is
// Infinity, so nothing behaves any differently.
//
// A field: { minX, minZ, cell, w, h, heights } — heights a Float32Array of
// w * h samples at the grid's points (x = minX + i * cell, z = minZ + j *
// cell), read between them bilinearly. Off the grid the floor is 0.

let F = null;

export function setGroundField(field) {
  F = field && field.heights?.length === field.w * field.h ? field : null;
}
export function groundField() { return F; }

/* The ground's height at (x, z). */
export function floorAt(x, z) { return F ? sampleField(F, x, z) : 0; }

/* A field's height at (x, z), set or not (a map reads its own while it
   builds, before it goes live). */
export function sampleField(F, x, z) {
  const u = (x - F.minX) / F.cell, v = (z - F.minZ) / F.cell;
  if (u < 0 || v < 0 || u > F.w - 1 || v > F.h - 1) return 0;
  const i = Math.min(F.w - 2, Math.floor(u)), j = Math.min(F.h - 2, Math.floor(v));
  const fu = u - i, fv = v - j, H = F.heights, k = j * F.w + i;
  const a = H[k] + (H[k + 1] - H[k]) * fu;
  const b = H[k + F.w] + (H[k + F.w + 1] - H[k + F.w]) * fu;
  return a + (b - a) * fv;
}

/* How far along a ray (unit `dir`) it first goes into the ground, or
   Infinity within `len`. Marched in half-cell steps, then the crossing
   found between the last two. */
export function terrainHit(origin, dir, len) {
  if (!F) return Infinity;
  const step = F.cell * 0.5;
  let prevT = 0, prevD = origin.y - floorAt(origin.x, origin.z);
  if (prevD < 0) return 0;
  for (let t = Math.min(step, len); ; t = Math.min(t + step, len)) {
    const d = origin.y + dir.y * t - floorAt(origin.x + dir.x * t, origin.z + dir.z * t);
    if (d < 0) return prevT + (t - prevT) * (prevD / (prevD - d));
    if (t >= len) return Infinity;
    prevT = t; prevD = d;
  }
}
