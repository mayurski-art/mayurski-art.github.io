// Trollface Island: every staircase climbs smoothly (user: "its hard to climb
// up stairs in the map regardless of if its wood or cement material").
//
// Finds every flight in the live colliders (three or more same-sized boxes
// stepping up evenly: the Boat's stern steps and companionway, the concrete
// flights of Troll City, the Peak, the Plant, the Shop, the Lighthouse, ...),
// stands the player a metre short of the bottom step and drives the movement
// controller at a fixed 60 Hz up it, walking and sprinting, down the middle
// and off to each side. Each climb must reach the top step, and in about the
// time the same distance takes on the flat (a stair that snags shows up as a
// slow climb or a stall).
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-island-stairs-test.mjs
// (a private room code, no bots, no drop; Supabase is blocked)

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  // a private room, never the public one
  T.els.room.value = "ST" + Math.random().toString(36).slice(2, 5).toUpperCase();
  T.els.room.dispatchEvent(new Event("input"));
  T.DROP.enabled = false;
  if (T.els.noBots) T.els.noBots.checked = true;
  T.setMode("royale");
  T.loadout.mapId = "trollface";
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.isStaging() && window.__trollOps.royale()?.live, null, { timeout: 150000 });

const result = await page.evaluate(() => {
  const T = window.__trollOps;
  T.player.spawnGuard = 1e9; T.player.maxHp = T.player.hp = 1e9;
  const boat = T.builtMap()?.map?.boat?.();
  if (boat) { boat.hold = 0; boat.update(0); }
  const cs = T.colliders.filter((c) => c.max.y - c.min.y > 0.05);
  const B = cs.map((c) => ({ c, x: (c.min.x + c.max.x) / 2, z: (c.min.z + c.max.z) / 2, w: c.max.x - c.min.x, d: c.max.z - c.min.z, top: c.max.y, y: c.min.y }));
  const same = (a, b) => Math.abs(a.w - b.w) < 0.02 && Math.abs(a.d - b.d) < 0.02;
  const used = new Set(), flights = [];
  // grid for neighbour lookups
  const cell = (x, z) => `${Math.floor(x)},${Math.floor(z)}`;
  const grid = new Map();
  B.forEach((b, i) => { const k = cell(b.x, b.z); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); });
  const near = (x, z) => { const out = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) out.push(...(grid.get(cell(x + i, z + j)) || [])); return out; };
  const find = (x, z, top, ref, skip) => near(x, z).find((k) => !skip.includes(k) && same(B[k], ref) && Math.abs(B[k].x - x) < 0.03 && Math.abs(B[k].z - z) < 0.03 && Math.abs(B[k].top - top) < 0.03);
  for (let i = 0; i < B.length; i++) {
    if (used.has(i)) continue;
    const a = B[i];
    if (Math.min(a.w, a.d) > 0.8 || Math.max(a.w, a.d) < 0.9) continue;   // a tread: shallow and wide
    for (const j of near(a.x, a.z)) {
      if (j === i || used.has(j) || !same(a, B[j])) continue;
      const b = B[j], dx = b.x - a.x, dz = b.z - a.z, dist = Math.hypot(dx, dz), dt = b.top - a.top;
      if (dist < 0.2 || dist > 0.8 || dt < 0.1 || dt > 0.6) continue;
      // the step runs across the tread's short side
      const along = Math.abs(dx) > Math.abs(dz) ? "x" : "z";
      if ((along === "x" ? a.w : a.d) > 0.8) continue;
      const chain = [i, j];
      for (let cur = b, k; (k = find(cur.x + dx, cur.z + dz, cur.top + dt, a, chain)) != null; cur = B[k]) chain.push(k);
      for (let cur = a, k; (k = find(cur.x - dx, cur.z - dz, cur.top - dt, a, chain)) != null; cur = B[k]) chain.unshift(k);
      if (chain.length < 3) continue;
      chain.forEach((k) => used.add(k));
      flights.push({ chain, dx, dz, dt, tread: dist });
      break;
    }
  }
  // merge the Boat's split treads (pieces side by side): keep one per flight line
  const seen = new Set();
  const list = [];
  for (const f of flights) {
    const first = B[f.chain[0]], last = B[f.chain.at(-1)];
    const key = `${(Math.round(first.top * 10))}:${Math.round(last.top * 10)}:${Math.round((first.x + last.x) * (f.dx ? 0 : 1))}:${Math.round((first.z + last.z) * (f.dz ? 0 : 1))}`;
    const ux = f.dx / f.tread, uz = f.dz / f.tread;
    const width = Math.abs(ux) > 0.5 ? first.d : first.w;
    list.push({ first, last, ux, uz, width, n: f.chain.length, rise: f.dt, tread: f.tread, key, moving: !!first.c.moving });
  }
  // where to stand: on the floor the flight rises from, up to a metre short
  // of its first step (some flights start straight off a landing's edge)
  const startOf = (fl, lateral) => {
    const px = -fl.uz, pz = fl.ux;                 // across the flight
    const floor = fl.first.top - fl.rise;
    for (const gap of [1.0, 0.7, 0.45]) {
      const back = fl.tread / 2 + gap;
      const sx = fl.first.x - fl.ux * back + px * lateral, sz = fl.first.z - fl.uz * back + pz * lateral;
      if (Math.abs(T.move.groundHeightAt(sx, sz, floor + 0.05) - floor) < 0.06) return { sx, sz, back, floor };
    }
    // a flight that starts at a floor's very edge (you come at it from the
    // side): from its first step
    return { sx: fl.first.x + px * lateral, sz: fl.first.z + pz * lateral, back: 0, floor: fl.first.top };
  };
  const climb = (fl, lateral, sprint, dt) => {
    const s = startOf(fl, lateral);
    if (!s) return { skip: true };
    const { sx, sz, back, floor } = s;
    T.move.reset(sx, sz, floor);
    const y0 = T.move.pos.y;
    const yaw = Math.atan2(-fl.ux, -fl.uz);
    const goal = fl.last.top - 0.05;
    const run = Math.hypot(fl.last.x - fl.first.x, fl.last.z - fl.first.z) + back + fl.tread / 2;
    const speed = 5.2 * (sprint ? 1.35 * 1.25 : 1);
    let t = 0, reached = null, stuck = 0, last = { x: sx, z: sz };
    for (let i = 0; i < 12 / dt && reached == null; i++) {
      T.move.update(dt, { forward: 1, strafe: 0, sprint, yaw, speedMult: 1, sprintMult: 1.35 * 1.25 });
      t += dt;
      if (T.move.pos.y >= goal) reached = t;
      const moved = Math.hypot(T.move.pos.x - last.x, T.move.pos.z - last.z);
      last = { x: T.move.pos.x, z: T.move.pos.z };
      stuck = moved < 0.25 * dt ? stuck + 1 : 0;
      if (stuck > 0.5 / dt) break;
    }
    return { y0: +y0.toFixed(2), y: +T.move.pos.y.toFixed(2), goal: +goal.toFixed(2), t: reached, flat: run / speed, at: [+T.move.pos.x.toFixed(2), +T.move.pos.z.toFixed(2)] };
  };
  const out = [];
  const done = new Set();
  for (const fl of list) {
    if (done.has(fl.key)) continue;
    done.add(fl.key);
    const runs = [];
    // 60 fps, 30 fps, and the 20 fps the game clamps a slow frame to (game.js dt <= 0.05)
    for (const dt of [1 / 60, 1 / 30, 1 / 20]) for (const sprint of [false, true]) for (const lat of [0, -0.3, 0.3]) {
      const off = lat * Math.max(0, fl.width - 0.7);
      const r = climb(fl, off, sprint, dt);
      if (!r.skip) runs.push({ sprint, lat: off, fps: Math.round(1 / dt), ...r });
    }
    out.push({ name: fl.first.c.name || "", from: [+fl.first.x.toFixed(2), +fl.first.z.toFixed(2)], top: +fl.last.top.toFixed(2), n: fl.n, rise: +fl.rise.toFixed(3), tread: +fl.tread.toFixed(2), width: +fl.width.toFixed(2), moving: fl.moving, runs });
  }
  return out;
});

let fails = 0;
for (const f of result) {
  if (!f.runs.length) { fails++; console.log(`FAIL  flight at (${f.from}) -> top ${f.top}: no floor found before its first step`); continue; }
  const bad = f.runs.filter((r) => r.t == null || r.t > r.flat * 1.3 + 0.2);
  const worst = Math.max(...f.runs.map((r) => (r.t ?? 99) / r.flat));
  const ok = bad.length === 0;
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${f.moving ? "boat " : ""}flight at (${f.from}) n=${f.n} rise ${f.rise} tread ${f.tread} w ${f.width} -> top ${f.top}  worst ${worst.toFixed(2)}x flat time (${f.runs.length} climbs)`);
  for (const r of bad) console.log(`        ${r.fps} fps ${r.sprint ? "sprint" : "walk  "} lat ${r.lat.toFixed(2)}: ${r.t == null ? `stalled at y ${r.y} (from ${r.y0}, goal ${r.goal}) at ${r.at}` : `${r.t.toFixed(2)} s vs ${r.flat.toFixed(2)} s on the flat`}`);
}
console.log(`\n${result.length} flights`);
if (errors.length) console.log("page errors:", errors.slice(0, 5));
console.log(fails ? `${fails} FAILED` : "ALL PASS");
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
