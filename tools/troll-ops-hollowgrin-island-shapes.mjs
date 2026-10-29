// Troll Royale: Two Worlds — Hollowgrin Island's shapes, from the approved
// blueprint (2026-10-28, .claude/map-shots-hq/hollowgrin-island-blueprint-FINAL.png):
// Trollface Island's own coast seen from underneath, a Halloween pumpkin.
// Its lake is the pumpkin's mouth (witch's brew), a closed pool (no river:
// the user dropped it, 2026-10-28), the eyes and the nose brew pools, the stem on the north
// coast, and Hollowgrin, the play area, in the forehead.
//
// The blueprint drew it in the island's frame; this writes it in
// Hollowgrin's (the island's coords + OFFSET) to
// assets/games/troll-ops/models/hollowgrin-island.json, which
// models/hg_island.py builds from and maps/hollowgrin-island.js reads.
//
// Usage: node tools/troll-ops-hollowgrin-island-shapes.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OFFSET = [9, 87];
const PLAY = [-51, 87, -45, 45];   // Hollowgrin's bounds (maps/hollowgrin.js BOUNDS): minX, maxX, minZ, maxZ, its own coords   // the blueprint's Hollowgrin box (x -60..78, z -132..-42) onto its bounds (-51..87, -45..45)

// the coast: maps/trollface-island.js ISLAND_EDGE, its % points into metres
const src = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/maps/trollface-island.js"), "utf8");
const pct = JSON.parse(src.match(/ISLAND_EDGE = polyP\((\[[\s\S]*?\]\])\);/)[1]);
const coast = pct.map(([px, py]) => [(px - 50) * 4.54, (py - 47) * 3.62]);

// the mouth: a thick crescent, deepest right of centre, the right end a
// little higher, seven sawtooth teeth along each lip (the blueprint's)
const mouth = (() => {
  const x0 = -132, x1 = 152, n = 7;
  const bend = (t) => Math.sin(Math.PI * Math.pow(t, 0.85));
  const zc = (t) => -30 + 6 * t + 58 * bend(t);
  const h = (t) => 8 + 60 * Math.pow(bend(t), 0.75);
  const top = [], bot = [], N = 2 * n;
  for (let i = 0; i <= N; i++) {
    const t = i / N, x = x0 + (x1 - x0) * t, base = zc(t) - h(t) / 2;
    top.push([x, base + (i % 2 && i < N ? 0.55 * h(t) : 0)]);
  }
  for (let i = 0; i <= N; i++) {
    const t = (i + 0.5) / (N + 1), x = x0 + (x1 - x0) * t, base = zc(t) + h(t) / 2;
    bot.push([x, base - (i % 2 === 0 ? 0.45 * h(t) : 0)]);
  }
  return [[x0, zc(0)], ...top.slice(1), [x1, zc(1)], ...bot.reverse()];
})();
const eyes = [
  [[-130, -64], [-98, -86], [-66, -76], [-63, -46], [-88, -36], [-124, -40]],
  [[82, -76], [116, -90], [150, -74], [148, -46], [118, -38], [84, -50]],
];
const nose = [[10, -36], [-2, -10], [24, -10]];
const stem = [-24, -150];

const mv = ([x, z]) => [+(x + OFFSET[0]).toFixed(2), +(z + OFFSET[1]).toFixed(2)];
const out = {
  note: "Hollowgrin Island (Troll Royale: Two Worlds), in Hollowgrin's map metres; tools/troll-ops-hollowgrin-island-shapes.mjs",
  offset: OFFSET,
  play: PLAY,
  coast: coast.map(mv),
  mouth: mouth.map(mv),
  eyes: eyes.map((e) => e.map(mv)),
  nose: nose.map(mv),
  stem: mv(stem),
};
const file = path.join(ROOT, "assets/games/troll-ops/models/hollowgrin-island.json");
fs.writeFileSync(file, JSON.stringify(out) + "\n");
const xs = out.coast.map((p) => p[0]), zs = out.coast.map((p) => p[1]);
console.log(`wrote ${path.relative(ROOT, file)}: coast ${out.coast.length} pts (x ${Math.min(...xs).toFixed(0)}..${Math.max(...xs).toFixed(0)}, z ${Math.min(...zs).toFixed(0)}..${Math.max(...zs).toFixed(0)}), mouth ${out.mouth.length} pts`);
