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
];
const EASE = 10;

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
  if (keep < 1) {
    const nh = Math.round(h * keep);
    if (nh !== h) { changed++; top = Math.max(top, h - nh); buf.writeInt16LE(nh, k); }
  }
}
console.log(`${DRY ? "[dry] " : ""}${changed} grid points cut inside ${ZONES.map((z) => `${z.name} r ${z.r}${z.square ? " (square)" : ""}`).join(", ")}, ${EASE} m easing, the biggest cut ${(top / 100).toFixed(2)} m`);
if (!DRY && changed) {
  g.heights = buf.toString("base64");
  fs.writeFileSync(FILE, src.replace(m[1], JSON.stringify(g)));
  console.log(`wrote ${path.relative(ROOT, FILE)}`);
}
