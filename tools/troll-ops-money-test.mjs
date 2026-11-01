// Kabukigrin's money over the dance floor (maps/club-money.js; "Kabukigrin
// in Blender" phase 1). One headless player in View mode on the floor:
//
//   1. the club has notes to throw and floor notes for them to land on
//   2. a drop (forced, as the DJ's scratch landing does) throws a handful
//   3. they go up, come down and every one lands on a floor note, then goes
//   4. the club's own clock throws again at the top of the next phrase
//   5. no page errors
//
// OUT=<dir> also saves a shot of the notes in the air.
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-money-test.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png",
  ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream", "cache-control": "no-store" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
// no Supabase: never the live public room
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let fails = 0;
const check = (name, ok, info = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? `  (${info})` : ""}`); if (!ok) fails++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto(`http://127.0.0.1:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  // View mode: no bots, a solo match on the map
  window.TrollrunnerAccounts = window.TrollrunnerAccounts || {};
  window.TrollrunnerAccounts.getCachedProfile = () => ({ username: "troll_runner" });
  window.dispatchEvent(new Event("trollrunner:auth-changed"));
  T.settings.viewMode = true; T.setMode("ops"); T.loadout.mapId = "kabukigrin";
  await T.startGame(); if (T.isStaging()) T.endStaging();
  T.player.maxHp = T.player.hp = 1e9;
});
await wait(15000);
// the club is underground (maps/kabukigrin-under.js): B2, the dance floor, at
// FL; B1, the balcony, at B1
const FL = -7.5, B1 = -3.6;
// on B2 at the floor's north edge, looking across it
await page.evaluate((FL) => {
  const T = window.__trollOps;
  T.move.pos.set(-21.5, FL, 9.5); if (T.move.velocity) T.move.velocity.set(0, 0, 0);
  T.look.yaw = Math.PI; T.look.pitch = 0.12;
}, FL);
const money = () => page.evaluate(() => {
  const d = window.__trollOps.builtMap().map.debug().money;
  return d && { drops: d.drops, thrown: d.thrown, landed: d.landed, spots: d.spots, air: d.air, lying: d.lying.length };
});
let m0 = await money();
check("the club has money to throw and notes on the floor to land on", !!m0 && m0.spots >= 20, JSON.stringify(m0));
// the club's own clock may have thrown already: wait for the floor to be quiet
for (let t = 0; t < 80 && (m0.air || m0.lying); t++) { await wait(500); m0 = await money(); }

await page.evaluate(() => window.__trollOps.builtMap().map.debug().money.force());
let m1 = await money();
for (let t = 0; t < 10 && m1.drops === m0.drops; t++) { await wait(300); m1 = await money(); }   // the club's tick picks it up
const batch = m1.thrown - m0.thrown;
check("a drop throws a handful", m1.drops > m0.drops && batch >= 20, JSON.stringify(m1));
check("and they're in the air", m1.air > 0, JSON.stringify(m1));
if (process.env.OUT) await page.screenshot({ path: path.join(process.env.OUT, "money-air.jpg"), type: "jpeg", quality: 85 });

// up, over, a slow flutter down from ~4 m: every one down within 30 s (the
// club clamps its step at 0.1 s, so at a headless 4 fps it runs at 0.4x)
let m2 = m1;
for (let t = 0; t < 60 && m2.landed - m0.landed < batch; t++) { await wait(500); m2 = await money(); }
check("every note lands (on a floor note: their targets are the floor's own)", m2.landed - m0.landed >= batch, JSON.stringify(m2));
if (process.env.OUT) await page.screenshot({ path: path.join(process.env.OUT, "money-landed.jpg"), type: "jpeg", quality: 85 });
// each lies 1.4 s in its note's pose, then goes (a new drop meanwhile: skip)
// (the club's own clock can throw again meanwhile: then new notes keep landing)
let m3 = await money();
for (let t = 0; t < 20 && m3.lying && m3.drops === m2.drops; t++) { await wait(500); m3 = await money(); }
check("and then they're gone (the baked note where each lay)", m3.lying === 0 || m3.drops > m2.drops, JSON.stringify(m3));

// the club's own track: a drop at the top of each 8-bar phrase (15 s at 128)
let m4 = m3;
for (let t = 0; t < 40 && m4.drops === m3.drops; t++) { await wait(500); m4 = await money(); }
check("the club's clock throws again at the top of a phrase", m4.drops > m3.drops, JSON.stringify(m4));

// ---- doc MONEY-RAIN.md 1: bills from anywhere (emitMoney), landing on
// what's under them, lying a moment and fading; the pool by tier
const full = () => page.evaluate(() => {
  const d = window.__trollOps.builtMap().map.debug().money;
  return { emitted: d.emitted, air: d.air, pool: d.pool, tier: d.tier, stepMs: +d.stepMs.toFixed(3), fading: d.fading, lying: d.lying };
});
for (let t = 0; t < 60; t++) { const m = await full(); if (!m.air && !m.lying.length) break; await wait(500); }
const m5 = await full();
check("the pool is sized by the graphics tier", { high: 160, medium: 96, low: 48 }[m5.tier] === m5.pool, `${m5.tier}: ${m5.pool}`);
// three handfuls: over the main bar's counter (under the east arm, x -8.1,
// its top FL + 1.15), over the balcony's deck (B1) and over the dance floor
const deck = await page.evaluate((B1) => {
  // a clear spot on the north arm: the highest collider top under it, below
  // a hand's height over B1, is the deck itself
  const cols = window.__trollOps.colliders;
  const topAt = (x, z) => cols.reduce((b, c) => (c.max.y <= B1 + 1.3 && x >= c.min.x - 0.05 && x <= c.max.x + 0.05 && z >= c.min.z - 0.05 && z <= c.max.z + 0.05 && c.max.y > b ? c.max.y : b), -99);
  for (let z = 6; z < 11.5; z += 0.5) for (let x = -24; x < -12; x += 0.5) if (Math.abs(topAt(x, z) - B1) < 0.05) return [x, z];
  return null;
}, B1);
check("the balcony's deck is in the colliders", !!deck, JSON.stringify(deck));
// back on B2 by the floor (nothing is thrown more than 30 m from the camera:
// club-money.js RANGE), and say where the camera is
const eye = await page.evaluate((FL) => {
  const T = window.__trollOps;
  T.move.pos.set(-21.5, FL, 9.5); if (T.move.velocity) T.move.velocity.set(0, 0, 0);
  T.look.yaw = Math.PI; T.look.pitch = 0.12;
  return null;
}, FL);
await wait(800);
const cam = await page.evaluate(() => window.__trollOps.camera.position.toArray().map((v) => +v.toFixed(1)));
console.log(`INFO  camera at ${cam.join(", ")}`);
// the bar counter's own collider (kabukigrin-under.js ghostBox, top FL + 1.15)
const barTop = await page.evaluate((FL) => window.__trollOps.colliders.some((c) => -8.1 >= c.min.x && -8.1 <= c.max.x && 17 >= c.min.z && 17 <= c.max.z && Math.abs(c.max.y - (FL + 1.15)) < 0.05), FL);
if (!barTop) console.log("INFO  the main bar's counter has no collider in this build: bills over it fall to B2 (kabukigrin-under.js)");
await page.evaluate(({ deck, FL, B1 }) => {
  const d = window.__trollOps.builtMap().map.debug().money;
  d.emit(-8.1, FL + 1.9, 17, 0, 0.2, 0, 6, { speed: 0.3, spread: 0.1, up: 0 });
  d.emit(deck[0], B1 + 1.2, deck[1], 0, 0.3, 0, 6, { speed: 0.4, spread: 0.2 });
  d.emit(-21.5, FL + 2.0, 17, 0, 0.5, 0, 6, { speed: 0.8 });
}, { deck: deck || [-18, 8], FL, B1 });
await wait(400);
const m6 = await full();
check("emitMoney throws from a point", m6.emitted - m5.emitted === 18 && m6.air >= 12, JSON.stringify({ emitted: m6.emitted - m5.emitted, air: m6.air }));
let m7 = m6;
for (let t = 0; t < 60 && m7.lying.filter((l) => !l.spot).length < 14; t++) { await wait(500); m7 = await full(); }
const ys = m7.lying.filter((l) => !l.spot).map((l) => +l.y.toFixed(2));
check("they land on what's under them: the bar top, the balcony, the dance floor",
  (!barTop || ys.some((y) => Math.abs(y - (FL + 1.15)) < 0.1)) && ys.some((y) => Math.abs(y - B1) < 0.1) && ys.some((y) => y < FL + 0.1), ys.sort((a, b) => a - b).join(" "));
if (process.env.OUT) await page.screenshot({ path: path.join(process.env.OUT, "money-landed-anywhere.jpg"), type: "jpeg", quality: 85 });
let m8 = m7;
for (let t = 0; t < 40 && !m8.fading; t++) { await wait(500); m8 = await full(); }
check("then they fade", m8.fading > 0, `fading ${m8.fading}`);
for (let t = 0; t < 40 && m8.lying.length; t++) { await wait(500); m8 = await full(); }
check("and they're gone", m8.lying.length === 0 && m8.air === 0, JSON.stringify({ lying: m8.lying.length, air: m8.air }));
// the pool: more than it holds reuses the oldest, nothing breaks
await page.evaluate(() => window.__trollOps.builtMap().map.debug().money.emit(-21.5, -4.5, 17, 0, 1, 0, 400, { speed: 2 }));   // over B2
await wait(600);
const m9 = await full();
check("a full pool reuses notes instead of growing", m9.air <= m9.pool && m9.air >= m9.pool * 0.8, `${m9.air} of ${m9.pool} in the air`);
check(`a full pool's step stays cheap (${m9.stepMs} ms)`, m9.stepMs < 1.0, `${m9.stepMs} ms`);
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
