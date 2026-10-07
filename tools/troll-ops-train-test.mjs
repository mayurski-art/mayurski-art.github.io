// Troll Forces Socialize: ride the Grin Express round Troll City (train.js,
// modes/social-train.js).
//
// One tab on Troll City (Socialize, Supabase blocked so no live room):
//   1. The train is three cars standing at the platform.
//   2. Step onto a car before it leaves: you're aboard.
//   3. It pulls out and takes you with it: 10 s later you've gone 50+ m,
//      still on the deck, and out past the map's edge with it.
//   4. Jumped on to its arrival (the clock moved), still aboard; it stops
//      at the station and you step off onto the platform, the map's edge
//      back in force.
// Shots: scratch PNGs in tools/.train-shots (not committed).
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-train-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, "tools", ".train-shots");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };
async function pump(page, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) await page.screenshot({ type: "jpeg", quality: 10 }).catch(() => {});
}

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
await ctx.route(/supabase/, (r) => r.abort());
const errors = [];
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  const fake = { getCachedProfile: () => ({ username: "troll_runner", tags: [] }) };
  Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => fake, set: () => {} });
});
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 420000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 420000 });
await page.evaluate(() => window.__trollOps.setLoadWaitMax(8));
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.setMode("social");
  T.loadout.mapId = "trollcity";
  await T.startGame();
});
await page.waitForFunction(() => !window.__trollOps.loadState().open, null, { timeout: 420000 });
await page.evaluate(() => { window.__trollOps.els.pause.hidden = true; });

fs.mkdirSync(SHOTS, { recursive: true });
const shot = (name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
// The train and us: where it is, how fast, whether we're on it.
const st = () => page.evaluate(() => {
  const T = window.__trollOps, tr = T.builtMap().map.rp.train();
  const c = tr.cars[1].pose, p = T.move.pos;
  const dx = p.x - c.x, dz = p.z - c.z, cs = Math.cos(c.ry), sn = Math.sin(c.ry);
  return { cars: tr.cars.length, s: tr.state.s, v: tr.state.v, leaveIn: tr.state.leaveIn, arriveIn: tr.state.arriveIn, period: tr.state.period,
    aboard: !!tr.aboard, riding: !!T.move.riding, x: p.x, y: p.y, z: p.z, lx: dx * cs - dz * sn, lz: dx * sn + dz * cs, car: { x: c.x, z: c.z } };
});
/* Move the train's clock so it's `u` seconds into its timetable. */
const setClock = (u) => page.evaluate((u) => {
  const tr = window.__trollOps.builtMap().map.rp.train();
  const now = Date.now() / 1000, P = tr.state.period;
  tr.offset = u - (now % P);
}, u);

let s = await st();
check("the Grin Express is three cars", s.cars === 3, `${s.cars}`);
check("it runs in Socialize (it has a timetable)", s.period > 100 && s.period < 120, s.period?.toFixed(1));

// Standing at the platform with 12 s to go: step onto the first car.
await setClock(13);
await pump(page, 300);
s = await st();
check("it's standing at the station", s.v === 0 && s.leaveIn > 8, `v ${s.v} leaves in ${s.leaveIn?.toFixed(1)}`);
await page.evaluate(({ x, z }) => { const T = window.__trollOps; T.move.reset(x, z, 0.9); T.look.yaw = 0; T.look.pitch = -0.1; }, s.car);
await pump(page, 800);
s = await st();
check("on its deck you're aboard", s.aboard && Math.abs(s.y - 0.9) < 0.15, JSON.stringify({ aboard: s.aboard, y: s.y }));

// It pulls out: ride it.
const t0 = Date.now();
while (Date.now() - t0 < 20000) { await pump(page, 250); s = await st(); if (s.v > 0) break; }
check("it pulls out", s.v > 0, `v ${s.v}`);
const from = { x: s.x, z: s.z };
let offDeck = 0;
const t1 = Date.now();
while (Date.now() - t1 < 10000) {
  await pump(page, 300);
  s = await st();
  if (!s.aboard || Math.abs(s.y - 0.9) > 0.2 || Math.abs(s.lx) > 4.6 || Math.abs(s.lz) > 1.35) offDeck++;
}
const went = Math.hypot(s.x - from.x, s.z - from.z);
check("10 s on, it's taken you 50+ m", went > 50, `${went.toFixed(1)} m`);
check("and you're still on the deck", offDeck === 0, `${offDeck} samples off`);
await shot("riding");

// On round the loop: the south straight, then in to the station.
await setClock(70);
await pump(page, 800);
s = await st();
check("across the south plain, out past the map's edge, still aboard", s.aboard && s.z > 50 && s.v > 7, `${s.x.toFixed(1)}, ${s.z.toFixed(1)} v ${s.v.toFixed(1)}`);
await shot("south-plain");
await setClock(s.period - 4);
const t2 = Date.now();
while (Date.now() - t2 < 15000) { await pump(page, 300); s = await st(); if (s.v === 0) break; }
check("it pulls into the station, you on it", s.v === 0 && s.aboard && Math.abs(s.x - (s.car.x + s.lx)) < 30, JSON.stringify({ v: s.v, aboard: s.aboard, x: s.x, z: s.z }));
check("the car is back at the platform", Math.abs(s.car.z + 29.8) < 0.3 && Math.abs(s.car.x - 1.5) < 0.6, JSON.stringify(s.car));
await shot("arrived");

// Step off onto the platform.
await page.evaluate(() => { const T = window.__trollOps; T.move.reset(1.5, -26.0, 0.3); });
await pump(page, 600);
s = await st();
check("off on the platform you're not aboard", !s.aboard && !s.riding, JSON.stringify({ aboard: s.aboard, riding: s.riding }));

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(failures ? `${failures} FAILED` : "all passed");
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
