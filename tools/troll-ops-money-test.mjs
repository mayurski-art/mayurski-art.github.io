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
// on the floor's south edge, looking across it
await page.evaluate(() => {
  const T = window.__trollOps;
  T.move.pos.set(-22, 0, 8.5); if (T.move.velocity) T.move.velocity.set(0, 0, 0);
  T.look.yaw = Math.atan2(0, -(15 - 8.5)); T.look.pitch = 0.12;
});
const money = () => page.evaluate(() => {
  const d = window.__trollOps.builtMap().map.debug().money;
  return d && { drops: d.drops, thrown: d.thrown, landed: d.landed, spots: d.spots, air: d.air, lying: d.lying.length };
});
let m0 = await money();
check("the club has money to throw and notes on the floor to land on", !!m0 && m0.spots >= 20, JSON.stringify(m0));
// the club's own clock may have thrown already: wait for the floor to be quiet
for (let t = 0; t < 80 && (m0.air || m0.lying); t++) { await wait(500); m0 = await money(); }

await page.evaluate(() => window.__trollOps.builtMap().map.debug().money.force());
await wait(700);
const m1 = await money();
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
await wait(2500);
const m3 = await money();
check("and then they're gone (the baked note where each lay)", m3.lying === 0 || m3.drops > m2.drops, JSON.stringify(m3));

// the club's own track: a drop at the top of each 8-bar phrase (15 s at 128)
let m4 = m3;
for (let t = 0; t < 40 && m4.drops === m3.drops; t++) { await wait(500); m4 = await money(); }
check("the club's clock throws again at the top of a phrase", m4.drops > m3.drops, JSON.stringify(m4));

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
