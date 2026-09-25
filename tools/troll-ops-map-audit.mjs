// Troll Ops map check: builds every map headlessly and audits its colliders.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-map-audit.mjs [mapId ...]
//
// Fails (exit 1) on:
//   - floating solids: a collider off the ground with nothing under or beside it
//   - blocked spawns: a spawn inside a collider or without head room
//   - traps: somewhere a player can get to (walking, stepping, jumping,
//     dropping) but can't get back to a spawn from
// Reports, without failing:
//   - floors you can see but can't reach (fine for roofs and car tops)
//   - solids overlapping by more than OVERLAP m on every axis
//
// Movement model (movement.js): step up <= 0.36 m for free, jump/vault up to
// JUMP m, drop any height (carrying up to 1.5 m forward off a 1 m+ ledge),
// 1.75 m of head room, 0.35 m body radius. Walkable levels are sampled on a
// GRID m grid, so gaps thinner than that can be missed.
//
// Checked against planted faults: a floating slab and a pen you can drop
// into but not climb out of are both caught. Not for pentagrin (the zombies
// map links its floors with elevators, which read as traps here).
//
// Debug: AUDIT_AT="x,z" prints the walkable levels round a point, "R" marking
// the ones reachable from a spawn.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GRID = 0.5, STEP = 0.36, JUMP = 1.1, HEAD = 1.75, RADIUS = 0.3, OVERLAP = 0.2;

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("page error:", e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 90000 });

const wanted = process.argv.slice(2);
const maps = await page.evaluate(async (wanted) => {
  const M = await import("/assets/games/troll-ops/maps.js");
  const ids = wanted.length ? wanted : M.MAP_IDS;
  return ids.map((id) => {
    const colliders = [], arena = {};
    const built = M.buildMap(id, { colliders, arena });
    return {
      id,
      bounds: { ...arena },
      spawns: built.spawnPoints.map((v) => [v.x, v.z]).concat(built.playerSpawn ? [[built.playerSpawn.x, built.playerSpawn.z]] : []),
      boxes: colliders.map((c) => [c.min.x, c.min.y, c.min.z, c.max.x, c.max.y, c.max.z]),
    };
  });
}, wanted);
await browser.close();
server.close();

let failed = false;
for (const map of maps) {
  const { id, bounds: B, boxes } = map;
  const errors = [], notes = [];

  // spatial hash on a 2 m grid
  const H = 2, hash = new Map();
  boxes.forEach((b, i) => {
    for (let gx = Math.floor((b[0] - RADIUS) / H); gx <= Math.floor((b[3] + RADIUS) / H); gx++) {
      for (let gz = Math.floor((b[2] - RADIUS) / H); gz <= Math.floor((b[5] + RADIUS) / H); gz++) {
        const k = gx + "," + gz;
        if (!hash.has(k)) hash.set(k, []);
        hash.get(k).push(i);
      }
    }
  });
  const near = (x, z) => hash.get(Math.floor(x / H) + "," + Math.floor(z / H)) || [];
  const inside = (b, x, z, m = 0) => x > b[0] - m && x < b[3] + m && z > b[2] - m && z < b[5] + m;
  // is the body column at (x,z) between y0 and y1 free (within the body radius)?
  const free = (x, z, y0, y1) => !near(x, z).some((i) => {
    const b = boxes[i];
    return inside(b, x, z, RADIUS) && b[1] < y1 && b[4] > y0;
  });

  // walkable levels per grid cell
  const nx = Math.floor((B.maxX - B.minX) / GRID), nz = Math.floor((B.maxZ - B.minZ) / GRID);
  const cx = (i) => B.minX + (i + 0.5) * GRID, cz = (j) => B.minZ + (j + 0.5) * GRID;
  const levels = new Map();          // "i,j" -> [heights]
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const x = cx(i), z = cz(j);
      const tops = [0];
      for (const k of near(x, z)) if (inside(boxes[k], x, z)) tops.push(boxes[k][4]);
      const ok = [...new Set(tops.map((t) => +t.toFixed(3)))].filter((t) => free(x, z, t + STEP, t + HEAD))   // anything lower is stepped onto, not blocked by;
      if (ok.length) levels.set(i + "," + j, ok);
    }
  }
  const node = (i, j, h) => `${i},${j},${h}`;
  const moves = (i, j, h) => {
    const out = [];
    // one cell, or two when the body clears the cell between (a hop or a
    // drop off something low: the cells hugging it have no standing room)
    // (and three when dropping a metre or more: you carry forward off a ledge)
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2], [3, 0], [-3, 0], [0, 3], [0, -3]]) {
      const L = levels.get((i + di) + "," + (j + dj));
      if (!L) continue;
      for (const t of L) {
        const up = t - h;
        if (up > JUMP) continue;
        if (Math.abs(di) + Math.abs(dj) === 3 && up > -1.0) continue;
        const top = Math.max(t, h);
        const y0 = top + (up > STEP ? 0.05 : STEP), y1 = top + HEAD;
        // the path itself must be clear at body height (catches thin rails)
        const steps = Math.abs(di) + Math.abs(dj);
        let clear = true;
        for (let k = 1; k < 2 * steps && clear; k++) {
          const f = k / (2 * steps);
          clear = free(cx(i) + di * GRID * f, cz(j) + dj * GRID * f, y0, y1);
        }
        if (clear) out.push([i + di, j + dj, t]);
      }
    }
    return out;
  };

  // spawns
  const starts = [];
  for (const [sx, sz] of map.spawns) {
    // the game drops a spawn onto the highest surface under it
    let ground = 0;
    for (const k of near(sx, sz)) if (inside(boxes[k], sx, sz) && boxes[k][4] > ground) ground = boxes[k][4];
    ground = +ground.toFixed(3);
    if (!free(sx, sz, ground + 0.05, ground + HEAD)) { errors.push(`spawn (${sx}, ${sz}) is blocked or has no head room`); continue; }
    const i0 = Math.floor((sx - B.minX) / GRID), j0 = Math.floor((sz - B.minZ) / GRID);
    let best = null;
    for (let di = -1; di <= 1 && !best; di++) for (let dj = -1; dj <= 1 && !best; dj++) {
      if ((levels.get((i0 + di) + "," + (j0 + dj)) || []).includes(ground)) best = [i0 + di, j0 + dj, ground];
    }
    if (best) starts.push(best);
    else errors.push(`spawn (${sx}, ${sz}) has no walkable grid spot next to it`);
  }

  // forward reach from spawns, and which nodes can get back to a spawn
  const reach = new Set(), q = [...starts], rev = new Map();
  for (const s of starts) reach.add(node(...s));
  while (q.length) {
    const [i, j, h] = q.pop();
    const from = node(i, j, h);
    for (const m of moves(i, j, h)) {
      const k = node(...m);
      if (!rev.has(k)) rev.set(k, []);
      rev.get(k).push(from);
      if (!reach.has(k)) { reach.add(k); q.push(m); }
    }
  }
  // walk the recorded edges backwards from the spawns
  const back = new Set(starts.map((s) => node(...s))), bq = [...back];
  while (bq.length) {
    for (const p of rev.get(bq.pop()) || []) if (!back.has(p)) { back.add(p); bq.push(p); }
  }
  const reachList = [...reach].map((k) => k.split(",").map(Number));
  if (process.env.AUDIT_AT) {
    const [dx, dz] = process.env.AUDIT_AT.split(",").map(Number);
    const i0 = Math.floor((dx - B.minX) / GRID), j0 = Math.floor((dz - B.minZ) / GRID);
    for (let j = j0 - 2; j <= j0 + 2; j++) {
      const row = [];
      for (let i = i0 - 2; i <= i0 + 2; i++) {
        const L = levels.get(i + "," + j) || [];
        row.push(`(${cx(i)},${cz(j)}):` + L.map((h) => h + (reach.has(node(i, j, h)) ? "R" : "")).join("/"));
      }
      console.log("   " + row.join("  "));
    }
  }
  const traps = reachList.filter((n) => !back.has(node(...n)));
  if (traps.length) {
    const ex = traps.slice(0, 4).map(([i, j, h]) => `(${cx(i).toFixed(1)}, ${cz(j).toFixed(1)}, y ${h})`).join(" ");
    errors.push(`${traps.length} grid spots you can reach but not get back out of, e.g. ${ex}`);
  }

  // floating solids: off the ground with nothing under or beside them
  boxes.forEach((b, i) => {
    if (b[1] < 0.05) return;
    const held = near((b[0] + b[3]) / 2, (b[2] + b[5]) / 2).concat(near(b[0], b[2]), near(b[3], b[5]), near(b[0], b[5]), near(b[3], b[2])).some((k) => {
      if (k === i) return false;
      const c = boxes[k], e = 0.06;
      const touchXZ = c[0] <= b[3] + e && c[3] >= b[0] - e && c[2] <= b[5] + e && c[5] >= b[2] - e;
      return touchXZ && c[1] <= b[1] + e && c[4] >= b[1] - e;
    });
    if (!held) errors.push(`floating solid at (${((b[0] + b[3]) / 2).toFixed(1)}, ${b[1].toFixed(2)}, ${((b[2] + b[5]) / 2).toFixed(1)})`);
  });

  // unreachable floors (info) and overlaps (warning)
  let unreachable = 0;
  const unreachEx = [];
  boxes.forEach((b) => {
    if (b[4] < 0.45 || (b[3] - b[0]) * (b[5] - b[2]) < 0.8) return;
    let standable = false, reached = false;
    for (let i = Math.floor((b[0] - B.minX) / GRID); i <= Math.floor((b[3] - B.minX) / GRID); i++) {
      for (let j = Math.floor((b[2] - B.minZ) / GRID); j <= Math.floor((b[5] - B.minZ) / GRID); j++) {
        const L = levels.get(i + "," + j);
        if (!L || !L.includes(+b[4].toFixed(3)) || !inside(b, cx(i), cz(j))) continue;
        standable = true;
        if (reach.has(node(i, j, +b[4].toFixed(3)))) reached = true;
      }
    }
    if (standable && !reached) {
      unreachable++;
      if (unreachEx.length < 4) unreachEx.push(`(${((b[0] + b[3]) / 2).toFixed(1)}, ${b[4].toFixed(2)}, ${((b[2] + b[5]) / 2).toFixed(1)})`);
    }
  });
  if (unreachable) notes.push(`${unreachable} floors/tops nobody can reach (roofs, car tops...) e.g. ${unreachEx.join(" ")}`);
  let overlaps = 0;
  for (let a = 0; a < boxes.length; a++) {
    for (let c = a + 1; c < boxes.length; c++) {
      const p = boxes[a], r = boxes[c];
      const ox = Math.min(p[3], r[3]) - Math.max(p[0], r[0]);
      const oy = Math.min(p[4], r[4]) - Math.max(p[1], r[1]);
      const oz = Math.min(p[5], r[5]) - Math.max(p[2], r[2]);
      if (ox > OVERLAP && oy > OVERLAP && oz > OVERLAP) overlaps++;
    }
  }
  if (overlaps) notes.push(`${overlaps} pairs of solids overlap by more than ${OVERLAP} m (usually wall corners)`);

  const walkable = reachList.length;
  console.log(`\n${errors.length ? "FAIL" : "PASS"}  ${id}  (${boxes.length} colliders, ${walkable} reachable spots)`);
  for (const e of errors.slice(0, 12)) console.log("   x " + e);
  if (errors.length > 12) console.log(`   x ...and ${errors.length - 12} more`);
  for (const n of notes) console.log("   - " + n);
  if (errors.length) failed = true;
}
process.exit(failed ? 1 : 0);
