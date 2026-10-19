// Trollface Island's hills (doc "Troll Royale map in Roblox Studio", phase
// 3). Reads studio/trollface-island/island.json (troll-ops-island-to-studio)
// and writes studio/trollface-island/sculpt.json:
//   keep     how much a 2 m grid point may rise, 0..1: 0 on and near
//            everything gameplay stands on (the coast, the lake, the paths,
//            each POI ring, every collider, the spawns), easing to 1 in the
//            open. The Studio export multiplies the sculpt by it, so no edit
//            can lift a landmark, a path or a box off the ground.
//   heights  a first sculpt: rolling meadows up to MAX m, in cm
// Grid points are x = minX + i * cell, z = minZ + j * cell (w x h of them).
//
//   node tools/troll-ops-island-sculpt.mjs
// then run studio/trollface-island/sculpt.luau in the Studio place.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "assets/games/troll-ops/studio/trollface-island");
const D = JSON.parse(fs.readFileSync(path.join(DIR, "island.json"), "utf8"));

const CELL = 2;
const MAX = 3.5;                 // m: the tallest meadow rise
const FLAT = 1.5, EASE = 10;       // m from anything kept flat: 0 up to FLAT, full height by EASE
const b = D.bounds;
const W = Math.round((b.maxX - b.minX) / CELL) + 1, H = Math.round((b.maxZ - b.minZ) / CELL) + 1;
const px = (i) => b.minX + i * CELL, pz = (j) => b.minZ + j * CELL;

function inside(poly, x, z) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
const M = D.mask;
const cellAt = (x, z) => {
  const i = Math.floor((x - b.minX) / M.res), j = Math.floor((z - b.minZ) / M.res);
  if (i < 0 || j < 0 || i >= M.w || j >= M.h) return "0";
  return M.cells[j * M.w + i];
};

// What stays flat.
const flat = new Uint8Array(W * H);
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  const x = px(i), z = pz(j), c = cellAt(x, z);
  if (!inside(D.edge, x, z) || inside(D.lake, x, z) || c === "0" || c === "5" || c === "3") flat[j * W + i] = 1;
}
const mark = (x0, x1, z0, z1) => {
  for (let j = Math.max(0, Math.floor((z0 - b.minZ) / CELL)); j <= Math.min(H - 1, Math.ceil((z1 - b.minZ) / CELL)); j++)
    for (let i = Math.max(0, Math.floor((x0 - b.minX) / CELL)); i <= Math.min(W - 1, Math.ceil((x1 - b.minX) / CELL)); i++) flat[j * W + i] = 1;
};
for (const c of D.colliders) mark(c.x - c.w / 2 - 1.5, c.x + c.w / 2 + 1.5, c.z - c.d / 2 - 1.5, c.z + c.d / 2 + 1.5);
for (const l of Object.values(D.landmarks)) {
  const R = l.r * 0.8 + 2;   // its buildings keep their own margin (colliders)
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (Math.hypot(px(i) - l.x, pz(j) - l.z) <= R) flat[j * W + i] = 1;
}
for (const [x, z] of D.spawns) mark(x - 3, x + 3, z - 3, z + 3);
// The coast: an 8 m flat margin inside it, so the hills ease out before the
// cliff edge (the slab's top there is y 0; a hill reaching it left a step).
const segD = (x, z, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - ax - t * dx, z - az - t * dz); };
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  const k = j * W + i; if (flat[k]) continue;
  for (let a = 0, b = D.edge.length - 1; a < D.edge.length; b = a++) if (segD(px(i), pz(j), ...D.edge[b], ...D.edge[a]) < 8) { flat[k] = 1; break; }
}
for (const l of D.lootExtra) mark(l.x - 3, l.x + 3, l.z - 3, l.z + 3);

// Distance from the flat set (two-pass chamfer, metres).
const dist = new Float32Array(W * H).fill(1e9);
for (let k = 0; k < W * H; k++) if (flat[k]) dist[k] = 0;
const D1 = CELL, D2 = CELL * Math.SQRT2;
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  const k = j * W + i; let d = dist[k];
  if (i > 0) d = Math.min(d, dist[k - 1] + D1);
  if (j > 0) { d = Math.min(d, dist[k - W] + D1); if (i > 0) d = Math.min(d, dist[k - W - 1] + D2); if (i < W - 1) d = Math.min(d, dist[k - W + 1] + D2); }
  dist[k] = d;
}
for (let j = H - 1; j >= 0; j--) for (let i = W - 1; i >= 0; i--) {
  const k = j * W + i; let d = dist[k];
  if (i < W - 1) d = Math.min(d, dist[k + 1] + D1);
  if (j < H - 1) { d = Math.min(d, dist[k + W] + D1); if (i < W - 1) d = Math.min(d, dist[k + W + 1] + D2); if (i > 0) d = Math.min(d, dist[k + W - 1] + D2); }
  dist[k] = d;
}
const smooth = (e0, e1, v) => { const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// Smooth value noise for the meadows.
function noise(cell, seed) {
  const h = (x, z) => { let n = (x * 374761393 + z * 668265263 + seed * 2147483647) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  return (x, z) => {
    const u = x / cell, v = z / cell, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
    const s = (t) => t * t * (3 - 2 * t), a = s(fu), c = s(fv);
    const top = h(i, j) + (h(i + 1, j) - h(i, j)) * a, bot = h(i, j + 1) + (h(i + 1, j + 1) - h(i, j + 1)) * a;
    return top + (bot - top) * c;
  };
}
const big = noise(70, 31), mid = noise(28, 32);
const keep = new Uint8Array(W * H), heights = new Int16Array(W * H);
let top = 0, rising = 0;
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  const k = j * W + i, x = px(i), z = pz(j);
  const w = smooth(FLAT, EASE, dist[k]);
  keep[k] = Math.round(w * 255);
  const n = big(x, z) * 0.65 + mid(x, z) * 0.35;
  const hm = MAX * smooth(0.22, 0.8, n) * w;
  heights[k] = Math.round(hm * 100);
  top = Math.max(top, hm);
  if (hm > 0.05) rising++;
}

// The steepest rise between neighbours (the contract caps it at 1.5 m per 2 m).
let steep = 0;
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  const k = j * W + i;
  if (i < W - 1) steep = Math.max(steep, Math.abs(heights[k + 1] - heights[k]) / 100);
  if (j < H - 1) steep = Math.max(steep, Math.abs(heights[k + W] - heights[k]) / 100);
}
fs.writeFileSync(path.join(DIR, "sculpt.json"), JSON.stringify({
  minX: b.minX, minZ: b.minZ, cell: CELL, w: W, h: H,
  keep: Buffer.from(keep).toString("base64"),
  heights: Array.from(heights),
}));
let land = 0, open = 0; for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { if (inside(D.edge, px(i), pz(j))) { land++; if (keep[j * W + i] > 128) open++; } }
console.log(`land ${land}, open (keep > 0.5) ${(100 * open / land).toFixed(0)}% of land`);
console.log(`sculpt.json: ${W}x${H} points, ${rising} rise (${(100 * rising / (W * H)).toFixed(0)}%), top ${top.toFixed(2)} m, steepest ${steep.toFixed(2)} m per ${CELL} m`);
