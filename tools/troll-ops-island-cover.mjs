// Trollface Island's cover between the places (doc "Trollface Island in
// Blender", phase 3: "no dry spot more than 15 m from hard cover, measured by
// script"). Measures, on a 2 m grid over the dry island, how far each spot is
// from hard cover (a collider at least 1 m high and 0.6 m thick, or a cover
// prop: boulder, rock wall, crates, hay, logs, barrels, sandbags), and with
// --write fills the worst gaps one piece at a time with cover that belongs to
// the neighbourhood (hay and logs by the Ranch and the Lodge, sandbags and
// barrels on the shores and by the Dock and the Market, boulders and walls on
// the Peak's and the Cave's skirts, walls and boulders in the open), turned
// across the nearest road so they break its sight lines; then lines the lake
// banks with bushes and the odd oak. Writes maps/trollface-island-props.js
// in place (its format and line endings kept).
//
//   node tools/troll-ops-island-cover.mjs            report
//   node tools/troll-ops-island-cover.mjs --write    fill, then report
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GAME = path.join(ROOT, "assets/games/troll-ops");
const FILE = path.join(GAME, "maps/trollface-island-props.js");
const WRITE = process.argv.includes("--write");
const L = JSON.parse(fs.readFileSync(path.join(GAME, "models/trollface-island-layout.json"), "utf8"));
const GAP = 15, TARGET = 14.0, CELL = 2;
const FOOT = { oak: 0.5, pine: 0.4, bush: 1, boulder: 2, rockwall: 2.1, crates: 1.3, hay: 1.7, logs: 2.1, barrels: 1, sandbags: 1.6 };
const COVER = new Set(["boulder", "rockwall", "crates", "hay", "logs", "barrels", "sandbags"]);
const FLAT = new Set(["rockwall", "crates", "hay", "logs", "sandbags", "barrels"]);
const BOARDWALKS = [[[-6, -5.5], [-2, 62]], [[76, -5], [82, 62]]];

// ---- the ground
const gsrc = fs.readFileSync(path.join(GAME, "maps/trollface-island-ground.js"), "utf8");
const G = JSON.parse(gsrc.slice(gsrc.indexOf("{"), gsrc.lastIndexOf("}") + 1));
const gbuf = Buffer.from(G.heights, "base64");
const gh = (i, j) => (i < 0 || j < 0 || i >= G.w || j >= G.h) ? 0 : gbuf.readInt16LE((j * G.w + i) * 2) / 100;
const groundAt = (x, z) => {
  const fx = (x - G.minX) / G.cell, fz = (z - G.minZ) / G.cell, i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
  return (gh(i, j) * (1 - tx) + gh(i + 1, j) * tx) * (1 - tz) + (gh(i, j + 1) * (1 - tx) + gh(i + 1, j + 1) * tx) * tz;
};

// ---- geometry helpers
const inside = (poly, x, z) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };
const segD = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az; const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
const ringD = (poly, x, z) => { let b = Infinity; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) b = Math.min(b, segD(x, z, ...poly[j], ...poly[i])); return b; };
const linesD = (lines, x, z) => { let b = Infinity; for (const l of lines) for (let i = 1; i < l.length; i++) b = Math.min(b, segD(x, z, ...l[i - 1], ...l[i])); return b; };
const nearestRoadDir = (x, z) => {
  let best = Infinity, dir = null;
  for (const l of L.roads) for (let i = 1; i < l.length; i++) {
    const d = segD(x, z, ...l[i - 1], ...l[i]);
    if (d < best) { best = d; dir = [l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]]; }
  }
  return { d: best, dir };
};

// ---- the props file
const src = fs.readFileSync(FILE, "utf8");
const eol = src.includes("\r\n") ? "\r\n" : "\n";
const m = src.match(/export const ISLAND_PROPS = (\{[\s\S]*?\n\});/);
const data = new Function(`return ${m[1]}`)();
const kindIdx = (k) => data.kinds.indexOf(k);

// ---- the cover index: buckets of 16 m, each cover an AABB or a circle
const BUCKET = 16;
const buckets = new Map();
const bkey = (i, j) => i * 100003 + j;
function addCover(c) {
  const [x0, z0, x1, z1] = c.box;
  for (let i = Math.floor(x0 / BUCKET); i <= Math.floor(x1 / BUCKET); i++) {
    for (let j = Math.floor(z0 / BUCKET); j <= Math.floor(z1 / BUCKET); j++) {
      const k = bkey(i, j);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(c);
    }
  }
}
const coverDist = (x, z, reach = 24) => {
  let best = reach;
  const i0 = Math.floor((x - reach) / BUCKET), i1 = Math.floor((x + reach) / BUCKET), j0 = Math.floor((z - reach) / BUCKET), j1 = Math.floor((z + reach) / BUCKET);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (const c of buckets.get(bkey(i, j)) || []) {
    const [x0, z0, x1, z1] = c.box;
    const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1);
    best = Math.min(best, Math.hypot(dx, dz));
  }
  return best;
};
const solids = [];
for (const c of L.colliders) {
  const box = [c.x - c.w / 2, c.z - c.d / 2, c.x + c.w / 2, c.z + c.d / 2];
  solids.push(box);
  if (c.h >= 1.0 && Math.min(c.w, c.d) >= 0.6) addCover({ box });
}
const propCover = (k, x, z, s) => { const r = FOOT[k] * s * 0.8; return { box: [x - r, z - r, x + r, z + r] }; };
for (const [k, x10, z10, , s100] of data.items) {
  const kind = data.kinds[k];
  if (COVER.has(kind)) addCover(propCover(kind, x10 / 10, z10 / 10, s100 / 100));
}

// ---- the dry grid
const dry = [];
for (let x = L.bounds.minX; x <= L.bounds.maxX; x += CELL) {
  for (let z = L.bounds.minZ; z <= L.bounds.maxZ; z += CELL) {
    if (!inside(L.edge, x, z) || inside(L.lake, x, z) || ringD(L.edge, x, z) < 1) continue;
    if (solids.some(([x0, z0, x1, z1]) => x > x0 && x < x1 && z > z0 && z < z1)) continue;
    dry.push([x, z]);
  }
}
function measure() {
  let worst = 0, over = 0, at = null;
  const gaps = [];
  for (const [x, z] of dry) {
    const d = coverDist(x, z);
    if (d > worst) { worst = d; at = [x, z]; }
    if (d > GAP) over++;
    gaps.push(d);
  }
  return { worst, over, at, gaps };
}

// ---- placement
const keepOut = [...L.spawns.map(([x, z]) => [x, z, 6]), ...(L.lootExtra || []).map((l) => [l.x, l.z, 3]), ...(L.parking || []).map(([x, z]) => [x, z, 4])];
const zone = (x, z) => {
  const near = (px, pz, r) => Math.hypot(x - px, z - pz) < r;
  if (near(-180, -45, 50) || near(-145, 5, 38)) return ["hay", "logs", "hay"];
  if (near(-104, -34, 30) || near(145, 98, 40) || ringD(L.lake, x, z) < 10 || ringD(L.edge, x, z) < 14) return ["sandbags", "barrels", "sandbags"];
  if (near(56.8, -43.4, 55) || near(-9, -33, 32)) return ["boulder", "rockwall", "boulder"];
  return ["rockwall", "boulder", "logs", "crates"];
};
let seed = 0x5eed;
const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
function fits(kind, x, z, s) {
  const r = FOOT[kind] * s;
  if (!inside(L.edge, x, z) || ringD(L.edge, x, z) < r + 3) return false;
  if (inside(L.lake, x, z) || (!inside(L.lake, x, z) && ringD(L.lake, x, z) < r + 1.5)) return false;
  if (linesD(L.roads, x, z) < Math.max(4.6, 3.2 + r)) return false;
  if (linesD(BOARDWALKS, x, z) < 1.8 + r) return false;
  // the ground mask's path ring round each place (maps/trollface-island.js groundMask)
  if (Object.values(L.places).some((p) => Math.abs(Math.hypot(x - p.x, z - p.z) - p.r * 0.85) < 3 + r * 0.5)) return false;
  if (keepOut.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr + r)) return false;
  if (solids.some(([x0, z0, x1, z1]) => x + r + 1.2 > x0 && x - r - 1.2 < x1 && z + r + 1.2 > z0 && z - r - 1.2 < z1)) return false;
  if (data.items.some(([k, x10, z10, , s100]) => Math.hypot(x - x10 / 10, z - z10 / 10) < r + FOOT[data.kinds[k]] * s100 / 100 + 0.8)) return false;
  // hills: the flat kinds want the ground level under them (within 0.25 m)
  const hs = [];
  for (const [ox, oz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) hs.push(groundAt(x + ox, z + oz));
  const spread = Math.max(...hs) - Math.min(...hs);
  if (FLAT.has(kind) && spread > 0.25) return false;
  if (spread > 1.2) return false;
  return true;
}
const added = {};
function place(x, z) {
  const kinds = zone(x, z);
  const offsets = [[0, 0]];
  for (const rr of [2.5, 4.5, 6.5]) for (let a = 0; a < 8; a++) offsets.push([Math.cos(a * Math.PI / 4) * rr, Math.sin(a * Math.PI / 4) * rr]);
  for (const [ox, oz] of offsets) {
    for (let t = 0; t < kinds.length + 1; t++) {
      const kind = t < kinds.length ? kinds[(t + Math.floor(rnd() * kinds.length)) % kinds.length] : "boulder";
      const s = kind === "boulder" ? 0.8 + rnd() * 0.4 : 0.95 + rnd() * 0.25;
      const px = x + ox, pz = z + oz;
      if (!fits(kind, px, pz, s)) continue;
      // across the nearest road (a sight-breaker), else any way
      const { d, dir } = nearestRoadDir(px, pz);
      let yaw = rnd() * 360;
      if (d < 45 && dir) yaw = (Math.atan2(dir[0], dir[1]) * 180) / Math.PI + 90 + (rnd() - 0.5) * 30;
      data.items.push([kindIdx(kind), Math.round(px * 10), Math.round(pz * 10), Math.round(((yaw % 360) + 360) % 360), Math.round(s * 100)]);
      addCover(propCover(kind, px, pz, s));
      added[kind] = (added[kind] || 0) + 1;
      return true;
    }
  }
  return false;
}

const before = measure();
console.log(`before: ${dry.length} dry spots, the worst ${before.worst.toFixed(1)} m from hard cover at ${before.at}, ${before.over} (${(100 * before.over / dry.length).toFixed(1)}%) over ${GAP} m`);
if (WRITE) {
  const tried = new Set();
  for (let n = 0; n < 600; n++) {
    // the worst spot not yet given up on
    let worst = 0, at = null;
    for (const [x, z] of dry) {
      if (tried.has(`${x},${z}`)) continue;
      const d = coverDist(x, z);
      if (d > worst) { worst = d; at = [x, z]; }
    }
    if (!at || worst <= TARGET) break;
    if (!place(at[0], at[1])) tried.add(`${at[0]},${at[1]}`);
  }
  // the banks: a bush every ~7 m along the lake's shore, 3 to 6 m back, the odd oak
  let bushes = 0, oaks = 0;
  const lake = L.lake;
  for (let i = 0; i < lake.length; i++) {
    const [ax, az] = lake[i], [bx, bz] = lake[(i + 1) % lake.length];
    const len = Math.hypot(bx - ax, bz - az);
    for (let s = 3; s < len; s += 7) {
      const t = s / len, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      const nx = -(bz - az) / len, nz = (bx - ax) / len;
      for (const side of [1, -1]) {
        const back = 3 + rnd() * 3, px = x + nx * side * back, pz = z + nz * side * back;
        if (inside(lake, px, pz)) continue;
        const kind = rnd() < 0.14 ? "oak" : "bush", sc = kind === "oak" ? 0.85 + rnd() * 0.3 : 0.6 + rnd() * 0.5;
        if (!fits(kind, px, pz, sc)) break;
        data.items.push([kindIdx(kind), Math.round(px * 10), Math.round(pz * 10), Math.round(rnd() * 360), Math.round(sc * 100)]);
        if (kind === "oak") oaks++; else bushes++;
        break;
      }
    }
  }
  console.log(`added ${Object.entries(added).map(([k, v]) => `${k} ${v}`).join(", ") || "no cover"}; ${bushes} bushes and ${oaks} oaks on the banks; ${data.items.length} props`);
  const rows = [];
  for (let i = 0; i < data.items.length; i += 8) rows.push("    " + data.items.slice(i, i + 8).map((it) => `[${it.join(",")}]`).join(","));
  const body = `{${eol}  kinds: ${JSON.stringify(data.kinds)},${eol}  items: [${eol}${rows.join("," + eol)},${eol}  ],${eol}}`;
  fs.writeFileSync(FILE, src.replace(m[1], body));
  const after = measure();
  console.log(`after: the worst ${after.worst.toFixed(1)} m from hard cover at ${after.at}, ${after.over} (${(100 * after.over / dry.length).toFixed(1)}%) over ${GAP} m`);
  if (after.over) process.exitCode = 0;
}
