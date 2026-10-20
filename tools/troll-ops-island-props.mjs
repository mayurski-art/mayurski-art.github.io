// Trollface Island's trees, rocks and cover (doc "Troll Royale map in Roblox
// Studio", phase 4): lays them out by rule and writes
//   assets/games/troll-ops/studio/trollface-island/props.json   for Studio
//        (props.luau places one model per prop; from-studio.luau sends them
//        back, and from then on Studio's layout is the truth)
//   --write  also maps/trollface-island-props.js, the game's copy (only
//        before the first Studio edit: after that the Studio export writes it)
//
// The rules: today's trees and boulders stay where they are; forests grow
// where a noise field says so and round the old clumps; then the open ground
// is walked on a grid and anywhere with no cover within COVER_GAP m gets a
// piece (crates and barrels near the places, walls and boulders on the
// hills, hay in the meadows, logs by the woods); bushes last. Nothing goes
// on a path, in the lake, inside a place's ring, on a spawn, on a collider,
// or off a cliff.
//
//   node tools/troll-ops-island-props.mjs [--write]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GAME = path.join(ROOT, "assets/games/troll-ops");
const DIR = path.join(GAME, "studio/trollface-island");
const D = JSON.parse(fs.readFileSync(path.join(DIR, "island.json"), "utf8"));
const { ISLAND_GROUND: G } = await import(pathToFileURL(path.join(GAME, "maps/trollface-island-ground.js")));
const { ISLAND_SOLIDS } = await import(pathToFileURL(path.join(GAME, "maps/trollface-island-colliders.js")));
const WRITE = process.argv.includes("--write");

const KINDS = ["oak", "pine", "bush", "boulder", "rockwall", "crates", "hay", "logs", "barrels", "sandbags"];
const K = Object.fromEntries(KINDS.map((k, i) => [k, i]));
// Footprint radius at scale 1 (m), and whether it stops bullets (counts as cover).
const FOOT = { oak: 0.5, pine: 0.4, bush: 1, boulder: 2, rockwall: 2.1, crates: 1.3, hay: 1.7, logs: 2.1, barrels: 1, sandbags: 1.6 };
const COVER = new Set(["boulder", "rockwall", "crates", "hay", "logs", "barrels", "sandbags"]);
const COVER_GAP = 10;          // m: no open ground further than this from cover
const FLAT_KINDS = new Set(["rockwall", "crates", "hay", "logs", "sandbags", "barrels"]);

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r = rng(0x4f00d);
function noise(cell, seed) {
  const h = (x, z) => { let n = (x * 374761393 + z * 668265263 + seed * 2147483647) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  return (x, z) => {
    const u = x / cell, v = z / cell, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
    const s = (t) => t * t * (3 - 2 * t), a = s(fu), c = s(fv);
    const top = h(i, j) + (h(i + 1, j) - h(i, j)) * a, bot = h(i, j + 1) + (h(i + 1, j + 1) - h(i, j + 1)) * a;
    return top + (bot - top) * c;
  };
}

// ---- the ground: height and the paint mask
const bin = Buffer.from(G.heights, "base64");
const hAt = (x, z) => {
  const u = (x - G.minX) / G.cell, v = (z - G.minZ) / G.cell;
  if (u < 0 || v < 0 || u > G.w - 1 || v > G.h - 1) return 0;
  const i = Math.min(G.w - 2, Math.floor(u)), j = Math.min(G.h - 2, Math.floor(v)), fu = u - i, fv = v - j;
  const H = (ii, jj) => bin.readInt16LE(2 * (jj * G.w + ii)) / 100;
  const a = H(i, j) + (H(i + 1, j) - H(i, j)) * fu, b = H(i, j + 1) + (H(i + 1, j + 1) - H(i, j + 1)) * fu;
  return a + (b - a) * fv;
};
const M = D.mask, b = D.bounds;
const paintOver = new Map((G.paint || []).map(([i, j, c]) => [j * M.w + i, String(c)]));
const cellAt = (x, z) => {
  const i = Math.floor((x - b.minX) / M.res), j = Math.floor((z - b.minZ) / M.res);
  if (i < 0 || j < 0 || i >= M.w || j >= M.h) return "0";
  return paintOver.get(j * M.w + i) || M.cells[j * M.w + i];
};
function inside(poly, x, z) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
const segD = (x, z, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - ax - t * dx, z - az - t * dz); };
const polyDist = (poly, x, z) => { let d = Infinity; for (let a = 0, c = poly.length - 1; a < poly.length; c = a++) d = Math.min(d, segD(x, z, ...poly[c], ...poly[a])); return d; };

// ---- what's already there: the old trees and boulders become props; every
// other collider is a building, a fence, a sign, and props keep off it
const isTrunk = (c) => c.pen === 4 && (c.w === 0.48 || c.w === 0.528);
const isBoulder = (c) => c.pen === 6 && Math.abs(c.w / c.d - 1.222) < 0.01 && Math.abs(c.h / c.w - 0.545) < 0.01;
const solids = ISLAND_SOLIDS.filter((c) => !isTrunk(c) && !isBoulder(c));
const props = [];
const add = (kind, x, z, yaw, s) => props.push({ kind, x: +x.toFixed(1), z: +z.toFixed(1), yaw: Math.round(yaw) % 360, s: +s.toFixed(2) });
for (const c of ISLAND_SOLIDS) {
  if (isTrunk(c)) add(c.w === 0.48 ? "pine" : "oak", c.x, c.z, r() * 360, Math.min(1.25, Math.max(0.8, c.h / (c.w === 0.48 ? 2.6 : 3.2))));
  else if (isBoulder(c)) add("boulder", c.x, c.z, r() * 360, Math.min(1.6, Math.max(0.5, c.w / 2.2 / 1.5)));
}
const kept = props.length;

// ---- the placement test
const L = Object.values(D.landmarks);
const keepOut = [...D.spawns.map(([x, z]) => [x, z, 5]), ...D.lootExtra.map((l) => [l.x, l.z, 3])];
function ok(kind, x, z, s = 1, own = null) {
  const f = FOOT[kind] * s;
  if (!inside(D.edge, x, z) || polyDist(D.edge, x, z) < 4 + f) return false;
  if (inside(D.lake, x, z) || polyDist(D.lake, x, z) < 2 + f) return false;
  for (const l of L) if (Math.hypot(x - l.x, z - l.z) < l.r + 2 + f) return false;
  for (const [kx, kz, kr] of keepOut) if (Math.hypot(x - kx, z - kz) < kr + f) return false;
  // Off the paths (the mask's 2 m cells, round the footprint).
  const R = f + 1.5;
  for (let dz = -R; dz <= R; dz += 1) for (let dx = -R; dx <= R; dx += 1) {
    if (dx * dx + dz * dz > R * R) continue;
    const c = cellAt(x + dx, z + dz);
    if (c === "3" || c === "0" || c === "5") return false;
  }
  for (const c of solids) if (Math.abs(x - c.x) < c.w / 2 + f + 1.5 && Math.abs(z - c.z) < c.d / 2 + f + 1.5) return false;
  for (const p of props) {
    if (p === own) continue;
    const gap = (kind === "oak" || kind === "pine") && (p.kind === "oak" || p.kind === "pine") ? 3.2 : 0.8;
    if (Math.hypot(x - p.x, z - p.z) < f + FOOT[p.kind] * p.s + gap) return false;
  }
  if (FLAT_KINDS.has(kind)) {
    const hs = [[0, 0], [f, 0], [-f, 0], [0, f], [0, -f]].map(([dx, dz]) => hAt(x + dx, z + dz));
    if (Math.max(...hs) - Math.min(...hs) > 0.45) return false;
  }
  return true;
}
const tree = (x, z) => (hAt(x, z) > 1.2 || z < -70 || r() < 0.25 ? "pine" : "oak");

// ---- forests: round each old tree, and where the noise is high
const forest = noise(55, 41);
for (const p of props.slice(0, kept).filter((p) => p.kind !== "boulder")) {
  for (let k = 0, tries = 0; k < 3 && tries < 16; tries++) {
    const a = r() * Math.PI * 2, d = 3.5 + r() * 5, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
    const kind = tree(x, z), s = 0.85 + r() * 0.35;
    if (ok(kind, x, z, s)) { add(kind, x, z, r() * 360, s); k++; }
  }
}
for (let z = b.minZ; z <= b.maxZ; z += 5) for (let x = b.minX; x <= b.maxX; x += 5) {
  const n = forest(x, z);
  if (n < 0.58 || r() > (n - 0.52) * 2.4) continue;
  const jx = x + (r() - 0.5) * 4, jz = z + (r() - 0.5) * 4, kind = tree(jx, jz), s = 0.8 + r() * 0.45;
  if (ok(kind, jx, jz, s)) add(kind, jx, jz, r() * 360, s);
}
const trees = props.length - kept;

// ---- cover: walk the open ground, fill every gap
const near = (x, z, R, test) => props.some((p) => test(p) && Math.hypot(x - p.x, z - p.z) < R);
const nearPlace = (x, z) => L.some((l) => Math.hypot(x - l.x, z - l.z) < l.r + 22);
const grid = [];
for (let z = b.minZ; z <= b.maxZ; z += 4) for (let x = b.minX; x <= b.maxX; x += 4) if (inside(D.edge, x, z) && !inside(D.lake, x, z)) grid.push([x, z]);
for (let i = grid.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [grid[i], grid[j]] = [grid[j], grid[i]]; }
const coverStart = props.length;
for (const [gx, gz] of grid) {
  if (L.some((l) => Math.hypot(gx - l.x, gz - l.z) < l.r)) continue;
  if (near(gx, gz, COVER_GAP, (p) => COVER.has(p.kind))) continue;
  const pool = nearPlace(gx, gz) ? ["crates", "barrels", "sandbags", "crates"]
    : hAt(gx, gz) > 1 ? ["rockwall", "boulder", "boulder"]
    : near(gx, gz, 10, (p) => p.kind === "oak" || p.kind === "pine") ? ["logs", "boulder", "rockwall"]
    : ["hay", "rockwall", "boulder", "hay"];
  for (let tries = 0; tries < 10; tries++) {
    const kind = pool[Math.floor(r() * pool.length)];
    const x = gx + (r() - 0.5) * 6, z = gz + (r() - 0.5) * 6;
    const s = kind === "boulder" ? 0.7 + r() * 0.7 : 0.95 + r() * 0.15;
    if (ok(kind, x, z, s)) { add(kind, x, z, Math.round(r() * 24) * 15, s); break; }
  }
}
const cover = props.length - coverStart;

// ---- bushes: by the trees, by the cover, a few anywhere
const anchors = props.slice();
let bushes = 0;
for (let tries = 0; tries < 12000 && bushes < 520; tries++) {
  let x, z;
  if (r() < 0.85) {
    const a = anchors[Math.floor(r() * anchors.length)], ang = r() * Math.PI * 2, d = FOOT[a.kind] * a.s + 1.4 + r() * 3;
    x = a.x + Math.cos(ang) * d; z = a.z + Math.sin(ang) * d;
  } else { x = b.minX + r() * (b.maxX - b.minX); z = b.minZ + r() * (b.maxZ - b.minZ); }
  const s = 0.5 + r() * 0.7;
  if (ok("bush", x, z, s)) { add("bush", x, z, r() * 360, s); bushes++; }
}

// ---- how open is it now: the widest gap from any open ground to cover
let worst = 0, uncovered = 0, open = 0;
for (let z = b.minZ; z <= b.maxZ; z += 4) for (let x = b.minX; x <= b.maxX; x += 4) {
  if (!inside(D.edge, x, z) || inside(D.lake, x, z) || L.some((l) => Math.hypot(x - l.x, z - l.z) < l.r) || polyDist(D.edge, x, z) < 8) continue;
  open++;
  let d = Infinity;
  for (const p of props) if (COVER.has(p.kind) || p.kind === "oak" || p.kind === "pine") d = Math.min(d, Math.hypot(x - p.x, z - p.z));
  worst = Math.max(worst, d);
  if (d > COVER_GAP + 4) uncovered++;
}

const out = { kinds: KINDS, items: props.map((p) => [K[p.kind], Math.round(p.x * 10), Math.round(p.z * 10), p.yaw, Math.round(p.s * 100)]) };
fs.writeFileSync(path.join(DIR, "props.json"), JSON.stringify(out));
const count = {};
for (const p of props) count[p.kind] = (count[p.kind] || 0) + 1;
console.log(`props.json: ${props.length} props (kept ${kept} old trees and boulders, +${trees} trees, +${cover} cover, +${bushes} bushes)`, JSON.stringify(count));
console.log(`open ground: ${open} points, ${(100 * uncovered / open).toFixed(1)}% more than ${COVER_GAP + 4} m from cover or a tree, worst ${worst.toFixed(1)} m`);
if (WRITE) {
  const rows = [];
  for (let i = 0; i < out.items.length; i += 12) rows.push("    " + out.items.slice(i, i + 12).map((it) => JSON.stringify(it)).join(",") + ",");
  fs.writeFileSync(path.join(GAME, "maps/trollface-island-props.js"),
    "// Trollface Island's trees, rocks and cover: [kind, x*10, z*10, yaw deg,\n" +
    "// scale*100] (doc \"Troll Royale map in Roblox Studio\", phase 4). Written by\n" +
    "// the Studio export (tools/troll-ops-island-from-studio.mjs --write), first\n" +
    "// laid out by tools/troll-ops-island-props.mjs; maps/island-props.js draws them.\n" +
    `export const ISLAND_PROPS = {\n  kinds: ${JSON.stringify(KINDS)},\n  items: [\n${rows.join("\n")}\n  ],\n};\n`);
  console.log("wrote maps/trollface-island-props.js");
}
