// Trollface Island: nobody goes through a wall (user: "make sure players are
// not able to go through walls in the boat or in any parts of the map").
//
// Takes every wall in the live colliders (a box at least 1.8 m tall and 1 m
// long: the Boat's hull, bulwarks and wheelhouse, every building's walls, the
// fences and the props), stands the player 1.6 m off the middle of each face
// on the floor there, and drives the movement controller into it, head on and
// 40 degrees either way, at a sprint and at a slide's / dive's speed, at 60,
// 30 and 20 fps (game.js clamps a slow frame to 0.05 s). The player must
// never end up past the wall's middle while still in front of it. The Boat
// is swept moored and again turned 45 degrees on its loop (its pieces' boxes
// grow as it turns).
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-island-walls-test.mjs
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
  T.els.room.value = "WL" + Math.random().toString(36).slice(2, 5).toUpperCase();
  T.els.room.dispatchEvent(new Event("input"));
  T.DROP.enabled = false;
  if (T.els.noBots) T.els.noBots.checked = true;
  T.setMode("royale");
  T.loadout.mapId = "trollface";
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.isStaging() && window.__trollOps.royale()?.live, null, { timeout: 150000 });

const sweep = (boatOnly, boatHeadingAt) => page.evaluate(([boatOnly, boatHeadingAt]) => {
  const T = window.__trollOps;
  T.player.spawnGuard = 1e9; T.player.maxHp = T.player.hp = 1e9;
  const boat = T.builtMap()?.map?.boat?.();
  if (boat) {
    // moored (t 0), or wherever on its loop it heads `boatHeadingAt` (rad)
    let t = 0;
    if (boatHeadingAt != null) {
      for (let s = 0; s < boat.path.total; s += 0.5) {
        const h = boat.path.at(s).heading;
        if (Math.abs(Math.atan2(Math.sin(h - boatHeadingAt), Math.cos(h - boatHeadingAt))) < 0.02) {
          const ds = ((s - boat.start) % boat.path.total + boat.path.total) % boat.path.total;
          t = ds / 3.5 + 2.5;
          break;
        }
      }
    }
    boat.hold = t;
    boat.update(t);
  }
  const Move = T.move.constructor;
  const all = T.colliders;
  const RADIUS = 0.35;
  const walls = all.filter((c) => {
    if (boatOnly !== !!c.moving) return false;
    const w = c.max.x - c.min.x, d = c.max.z - c.min.z, h = c.max.y - c.min.y;
    return h >= 1.8 && Math.max(w, d) >= 1.0;
  });
  const fails = [];
  let runs = 0;
  for (const c of walls) {
    const w = c.max.x - c.min.x, d = c.max.z - c.min.z;
    const cx = (c.min.x + c.max.x) / 2, cz = (c.min.z + c.max.z) / 2;
    const local = all.filter((o) => o.max.x > cx - Math.max(w, d) / 2 - 8 && o.min.x < cx + Math.max(w, d) / 2 + 8 && o.max.z > cz - Math.max(w, d) / 2 - 8 && o.min.z < cz + Math.max(w, d) / 2 + 8);
    // the faces along its long sides (and its ends, if they're 1 m too)
    const faces = [];
    if (w >= 1.0) faces.push([0, -1], [0, 1]);
    if (d >= 1.0) faces.push([-1, 0], [1, 0]);
    for (const [nx, nz] of faces) {
      const half = nx ? d / 2 : w / 2;              // the face's half-length
      const fx = nx ? (nx < 0 ? c.min.x : c.max.x) : cx, fz = nz ? (nz < 0 ? c.min.z : c.max.z) : cz;
      const sx = fx + nx * 1.6, sz = fz + nz * 1.6;
      // stand on a floor in front of it, below the wall's top
      const m = new Move({ colliders: local, arena: T.move.arena });
      const floor = m.groundHeightAt(sx, sz, c.max.y - 1.8);
      if (floor < c.min.y - 0.4 || floor > c.max.y - 1.8) continue;
      // nothing else in the way between the spot and the face
      const blocked = local.some((o) => o !== c && o.max.y > floor + 0.36 && o.min.y < floor + 1.68
        && Math.min(sx, fx) - RADIUS < o.max.x && Math.max(sx, fx) + RADIUS > o.min.x && Math.min(sz, fz) - RADIUS < o.max.z && Math.max(sz, fz) + RADIUS > o.min.z);
      if (blocked) continue;
      const mid = nx ? cx : cz;                     // the wall's middle plane
      for (const ang of [0, 0.7, -0.7]) {
        const dx = -nx * Math.cos(ang) - nz * Math.sin(ang), dz = -nz * Math.cos(ang) + nx * Math.sin(ang);
        const yaw = Math.atan2(-dx, -dz);
        for (const dt of [1 / 60, 1 / 30, 1 / 20]) for (const mult of [1, 1.6]) {
          runs++;
          m.reset(sx, sz, floor);
          let through = null;
          for (let i = 0; i < 1.2 / dt && !through; i++) {
            m.update(dt, { forward: 1, strafe: 0, sprint: true, yaw, speedMult: mult, sprintMult: 1.35 * 1.25 });
            const p = m.pos;
            const along = nx ? p.z - cz : p.x - cx;
            const across = (nx ? p.x : p.z) - mid;
            if (Math.abs(along) < half - RADIUS && p.y < c.max.y && p.y + 1.68 > c.min.y && across * (nx || nz) < 0) through = [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)];
          }
          if (through) fails.push({ wall: [+cx.toFixed(2), +cz.toFixed(2), +w.toFixed(2), +d.toFixed(2), +c.min.y.toFixed(2), +c.max.y.toFixed(2)], face: [nx, nz], ang, fps: Math.round(1 / dt), speed: +(5.2 * 1.35 * 1.25 * mult).toFixed(1), at: through });
        }
      }
    }
  }
  return { walls: walls.length, runs, fails };
}, [boatOnly, boatHeadingAt]);

let failed = 0;
for (const [label, boatOnly, heading] of [["island walls", false, null], ["Boat, moored", true, null], ["Boat, turned 45 deg", true, -Math.PI / 4], ["Boat, turned 120 deg", true, Math.PI * 2 / 3]]) {
  const r = await sweep(boatOnly, heading);
  const walls = new Map();
  for (const f of r.fails) walls.set(f.wall.join(","), f);
  console.log(`${r.fails.length ? "FAIL" : "PASS"}  ${label}: ${r.walls} walls, ${r.runs} runs, ${r.fails.length} went through (${walls.size} walls)`);
  for (const f of [...walls.values()].slice(0, 25)) console.log(`        wall ${f.wall} face ${f.face} ${f.fps} fps ${f.speed} m/s turn ${f.ang}: centre at ${f.at}`);
  if (r.fails.length) failed++;
}
if (errors.length) console.log("page errors:", errors.slice(0, 5));
console.log(failed ? `${failed} FAILED` : "ALL PASS");
await browser.close(); server.close();
process.exit(failed ? 1 : 0);
