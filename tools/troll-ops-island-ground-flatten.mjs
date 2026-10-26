// Trollface Island: flatten the ground field under a rebuilt place (doc
// "Troll Forces: Trollface Island in Blender", phase 1). The Studio sculpt
// (tools/troll-ops-island-from-studio.mjs) kept only 0.8 of each place's ring
// flat; a place rebuilt out to its ring (Troll City's block, square to the
// ring) needs its whole footprint at y 0, or the hills come up through the
// back walls. Each zone in ZONES is cut to 0 inside its radius (`square`:
// the Chebyshev radius) and eased back to the sculpt over EASE m (smoothstep,
// under the 1.5 m per 2 m cap), the file rewritten in place with its line
// endings kept. Then: node tools/troll-ops-island-layout.mjs, and the
// contract test ("every collider stands on flat ground").
//
//   node tools/troll-ops-island-ground-flatten.mjs            apply
//   node tools/troll-ops-island-ground-flatten.mjs --dry      report only
// Run it once per change: it scales the heights it finds, so a second run
// eases the slopes round each zone a little more (--dry shows how much).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "assets/games/troll-ops/maps/trollface-island-ground.js");
const DRY = process.argv.includes("--dry");
// the rebuilt places (LANDMARKS in maps/trollface-island.js): centre, the flat radius, square or round
const ZONES = [
  { name: "city", x: -36.3, z: -86.9, r: 41, square: true },     // phase 1: the block's pavements reach 40 m each way
  { name: "peak", x: 56.8, z: -43.4, r: 33 },                    // phase 1: the pines on the skirts
  { name: "dock", x: -102, z: -45, r: 13 },                      // phase 3: the bait shop and the boat shed on the shore
  { name: "market", x: 145.3, z: 97.7, r: 27 },                 // phase 4: the hall, the quay and the square (the sculpt had a 3 m hill here)
  { name: "ranch", x: -160, z: -38, r: 26, square: true },       // phase 5: the barn, the farmhouse, the field east of the junction
  { name: "lodge", x: -137, z: 0, r: 25 },                       // phase 5: the cabins round the pit, the tents
  { name: "light", x: 160, z: 22, r: 15 },                       // phase 5: the tower's plinth, the keeper's house
  { name: "plant", x: 37, z: -119, r: 27, square: true },        // phase 5: the towers, the hall, the pond
  { name: "gas", x: 85, z: 126, r: 22, square: true },           // phase 5: the forecourt, the diner, the car wash
];
const EASE = 10;
// The roads (phase 3): every road in the layout is flat for ROAD_HW each side
// of its centreline, eased the same way (the asphalt ribbon is a flat mesh).
const ROAD_HW = 4;
// And every collider in the colliders file stands on flat ground (the
// contract), COL_PAD round its footprint, eased the same way.
const COL_PAD = 1.5;
const solidsSrc = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/maps/trollface-island-colliders.js"), "utf8");
const SOLIDS = new Function(`return ${solidsSrc.slice(solidsSrc.indexOf("["), solidsSrc.lastIndexOf("]") + 1)}`)();
const colDist = (x, z) => {
  let best = Infinity;
  for (const c of SOLIDS) {
    const dx = Math.max(0, Math.abs(x - c.x) - c.w / 2), dz = Math.max(0, Math.abs(z - c.z) - c.d / 2);
    if (dx < 12 && dz < 12) best = Math.min(best, Math.hypot(dx, dz));
  }
  return best;
};
const LAYOUT = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/models/trollface-island-layout.json"), "utf8"));
const segDist = (px, pz, ax, az, bx, bz) => {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
};
const roadDist = (x, z) => {
  let best = Infinity;
  for (const road of LAYOUT.roads) for (let i = 1; i < road.length; i++) best = Math.min(best, segDist(x, z, ...road[i - 1], ...road[i]));
  return best;
};

let src = fs.readFileSync(FILE, "utf8");
const m = src.match(/export const ISLAND_GROUND = (\{.*?\});/s);
const g = JSON.parse(m[1]);
const buf = Buffer.from(g.heights, "base64");
let changed = 0, top = 0;
for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) {
  const x = g.minX + i * g.cell, z = g.minZ + j * g.cell;
  const k = 2 * (j * g.w + i);
  const h = buf.readInt16LE(k);
  if (!h) continue;
  let keep = 1;
  for (const Z of ZONES) {
    const d = Z.square ? Math.max(Math.abs(x - Z.x), Math.abs(z - Z.z)) : Math.hypot(x - Z.x, z - Z.z);
    const t = Math.max(0, Math.min(1, (d - Z.r) / EASE));     // 0 inside the zone .. 1 past the easing
    keep = Math.min(keep, t * t * (3 - 2 * t));
  }
  {
    const t = Math.max(0, Math.min(1, (roadDist(x, z) - ROAD_HW) / EASE));
    keep = Math.min(keep, t * t * (3 - 2 * t));
  }
  if (keep > 0) {
    const t = Math.max(0, Math.min(1, (colDist(x, z) - COL_PAD) / EASE));
    keep = Math.min(keep, t * t * (3 - 2 * t));
  }
  if (keep < 1) {
    const nh = Math.round(h * keep);
    if (nh !== h) { changed++; top = Math.max(top, h - nh); buf.writeInt16LE(nh, k); }
  }
}
console.log(`${DRY ? "[dry] " : ""}${changed} grid points cut inside ${ZONES.map((z) => `${z.name} r ${z.r}${z.square ? " (square)" : ""}`).join(", ")} and ${LAYOUT.roads.length} roads (${ROAD_HW} m each side) and under ${SOLIDS.length} colliders (${COL_PAD} m round), ${EASE} m easing, the biggest cut ${(top / 100).toFixed(2)} m`);
if (!DRY && changed) {
  g.heights = buf.toString("base64");
  fs.writeFileSync(FILE, src.replace(m[1], JSON.stringify(g)));
  console.log(`wrote ${path.relative(ROOT, FILE)}`);
}
