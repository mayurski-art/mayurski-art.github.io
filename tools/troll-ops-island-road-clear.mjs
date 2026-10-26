// Trollface Island's props off the roads (doc "Trollface Island in Blender",
// phase 3). The trees, rocks and cover in maps/trollface-island-props.js were
// scattered before the road network and the lake boardwalks existed; this
// drops every prop whose footprint reaches a road's asphalt (3.2 m each side
// of the centrelines in trollface-island-layout.json), a parking bay or a
// boardwalk, and rewrites the file in place (same format, same line endings).
//
//   node tools/troll-ops-island-road-clear.mjs [--dry]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GAME = path.join(ROOT, "assets/games/troll-ops");
const FILE = path.join(GAME, "maps/trollface-island-props.js");
const DRY = process.argv.includes("--dry");
const LAYOUT = JSON.parse(fs.readFileSync(path.join(GAME, "models/trollface-island-layout.json"), "utf8"));
// The boardwalks' centrelines (models/tf_roads.py BOARDWALKS) and half width.
const BOARDWALKS = [[[-6, -5.5], [-2, 62]], [[76, -5], [82, 62]]];
const ROAD_HW = 3.2, WALK_HW = 1.8, BAY_R = 3.6;
// The ground mask paints a road as path out to ~4.4 m of its centreline (2 m
// texels), and the island contract keeps every prop's centre off the path.
const PATH_R = 4.6;
// Footprint radius at scale 1 (tools/troll-ops-island-props.mjs FOOT).
const FOOT = { oak: 0.5, pine: 0.4, bush: 1, boulder: 2, rockwall: 2.1, crates: 1.3, hay: 1.7, logs: 2.1, barrels: 1, sandbags: 1.6 };

const src = fs.readFileSync(FILE, "utf8");
const eol = src.includes("\r\n") ? "\r\n" : "\n";
const m = src.match(/export const ISLAND_PROPS = (\{[\s\S]*?\n\});/);
if (!m) throw new Error("ISLAND_PROPS not found");
const data = new Function(`return ${m[1]}`)();
const segDist = (px, pz, ax, az, bx, bz) => {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
};
const polyDist = (lines, x, z) => {
  let best = Infinity;
  for (const line of lines) for (let i = 1; i < line.length; i++) best = Math.min(best, segDist(x, z, ...line[i - 1], ...line[i]));
  return best;
};
const kept = [], dropped = {};
for (const it of data.items) {
  const [k, x10, z10, , s100] = it;
  const kind = data.kinds[k], x = x10 / 10, z = z10 / 10, foot = (FOOT[kind] || 1) * (s100 / 100);
  const rd = polyDist(LAYOUT.roads, x, z);
  const onRoad = rd < ROAD_HW + foot || rd < PATH_R
    || polyDist(BOARDWALKS, x, z) < WALK_HW + foot
    || (LAYOUT.parking || []).some(([bx, bz]) => Math.hypot(x - bx, z - bz) < BAY_R + foot);
  if (onRoad) dropped[kind] = (dropped[kind] || 0) + 1;
  else kept.push(it);
}
const n = data.items.length - kept.length;
console.log(`${DRY ? "[dry] " : ""}${n} of ${data.items.length} props on the roads, bays and boardwalks (${Object.entries(dropped).map(([k, v]) => `${k} ${v}`).join(", ") || "none"}), ${kept.length} kept`);
if (!DRY && n) {
  const rows = [];
  for (let i = 0; i < kept.length; i += 8) rows.push("    " + kept.slice(i, i + 8).map((it) => `[${it.join(",")}]`).join(","));
  const body = `{${eol}  kinds: ${JSON.stringify(data.kinds)},${eol}  items: [${eol}${rows.join("," + eol)},${eol}  ],${eol}}`;
  fs.writeFileSync(FILE, src.replace(m[1], body));
  console.log(`wrote ${path.relative(ROOT, FILE)}`);
}
