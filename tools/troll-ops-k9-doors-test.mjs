// Troll Forces — K9 dogs, bots and doors (user, 2026-10-07: "dogs should
// learn to go through doors instead of continuously running towards the
// walls"; "bots should be smart too and not run into walls").
// On Troll City, the bots stood down except where a case needs one:
//   1. You stand in the Rusty Grin Saloon, six metres in from its back wall.
//      An enemy pack is let loose in the back lot behind that wall. The back
//      doors are 1.2 m wide, too narrow for the old grid; every dog has to
//      find one and come through it to you, without grinding on the wall.
//   2. You stand in a courthouse jail cell with the bars closed (an extra
//      collider across the open door). The dogs can't get in. They mustn't
//      spend their time pushing at the bars: they give you up and heel.
//   3. Case 1 again with an enemy bot in the back lot instead of the pack,
//      unable to see you: it has to come in through a back door too.
//
// Usage: node tools/troll-ops-k9-doors-test.mjs [shot dir]

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2] || null;
if (OUT) fs.mkdirSync(OUT, { recursive: true });
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

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.loadout.mapId = "trollcity";
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = false;
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 120000 });
await page.waitForFunction(() => window.__trollOps.bots.bots.some((b) => b.alive && b.team !== window.__trollOps.net.team), null, { timeout: 60000 });
await page.evaluate(() => {
  const T = window.__trollOps;
  T.closePauseMenu(); if (T.isStaging()) T.endStaging();
  setInterval(() => { if (T.player.alive) T.player.hp = T.player.maxHp; T.player.spawnGuard = 0; }, 50);
  // Every bot stands down; case 3 wakes one. Nobody can see anybody.
  for (const b of T.bots.bots) { b.alive = false; b.respawnT = 1e9; }
  const orig = T.bots.update.bind(T.bots);
  T.bots.update = (dt, ctx) => orig(dt, { ...ctx, sightBlocked: () => true, onThrow: null });
});

/* Let a pack loose at `at` (facing `yaw`, the dogs fan out behind) with you
   held at `me`, and watch it for `seconds`: when each dog first got within
   `reach` of you, how long each spent pushing at something and getting
   nowhere, and how often each had to turn round. */
const run = (name, me, at, yaw, seconds, reach) => page.evaluate(async ({ name, me, at, yaw, seconds, reach }) => {
  const T = window.__trollOps;
  T.move.reset(me.x, me.z, me.y);
  const enemy = T.net.team === "ghost" ? "phantom" : "ghost";
  const pack = T.spawnK9({ id: `k9-doors-${name}`, owned: true, team: enemy, ownerId: "bot-test", x: at.x, y: at.y, z: at.z, yaw });
  pack.botId = "bot-test"; pack.botTeam = enemy;
  const t0 = performance.now();
  const reached = {};
  let closest = Infinity;
  while (performance.now() - t0 < seconds * 1000) {
    await new Promise((r) => setTimeout(r, 100));
    T.move.pos.set(me.x, me.y, me.z);   // hold still
    for (const d of pack.dogs) {
      if (!d?.alive) continue;
      const dist = Math.hypot(d.pos.x - me.x, d.pos.z - me.z);
      closest = Math.min(closest, dist);
      if (dist <= reach && reached[d.i] == null) reached[d.i] = Math.round((performance.now() - t0) / 100) / 10;
    }
    if (Object.keys(reached).length === pack.count) break;
  }
  const dogs = pack.dogs.map((d) => d && {
    at: [+d.pos.x.toFixed(1), +d.pos.y.toFixed(2), +d.pos.z.toFixed(1)], alive: d.alive,
    reached: reached[d.i] ?? null, grind: +(d.grindT || 0).toFixed(2), stuck: d.stuckTotal || 0,
    target: d.targetId, gaveUp: !!(d.giveUp && pack.age < d.giveUp.until),
  });
  pack.duration = 0;   // called off; the next frame disposes it
  return { count: pack.count, reached: Object.keys(reached).length, closest: +closest.toFixed(2), dogs };
}, { name, me, at, yaw, seconds, reach });

/* ---- 1. the saloon: in through the back door */
// The saloon is x -23..-5, z -21.6 (back) .. -9.6 (front), its floor 0.3 up;
// back doors at x -20 and -9.5, 1.2 m wide. You stand mid-room, 6 m in from
// the back wall; the pack starts 3 m out in the back lot behind it.
const saloon = await run("saloon", { x: -14, y: 0.3, z: -15.6 }, { x: -14, y: 0, z: -24.6 }, Math.PI, 25, 1.9);
console.log(JSON.stringify(saloon));
if (OUT) await page.screenshot({ path: path.join(OUT, "k9-doors-saloon.png") });
check("saloon: every dog comes in through a back door and reaches you", saloon.reached === saloon.count, `${saloon.reached}/${saloon.count}, closest ${saloon.closest}`);
check("saloon: no dog had to turn round more than twice", saloon.dogs.every((d) => d && d.stuck <= 2), JSON.stringify(saloon.dogs.map((d) => d?.stuck)));
check("saloon: none of them spent long pushing at the wall", saloon.dogs.every((d) => d && d.grind < 1.5), JSON.stringify(saloon.dogs.map((d) => d?.grind)));

/* ---- 2. the jail: nothing to be done, so don't try */
// The courthouse's middle cell is x 51.2..55.7, z -3.4..3.4, behind bars at
// x 51.2 with a 1 m door at z 1.2 standing open; a collider across that
// door shuts you in. The pack starts in the sheriff's office through the
// partition door (x 49, z 0, 1.4 m wide).
await page.evaluate(() => {
  const T = window.__trollOps, THREE = T.THREE;
  T.colliders.push({ min: new THREE.Vector3(51.15, 0, 0.6), max: new THREE.Vector3(51.25, 3.0, 1.8), pen: 0.3, k9DoorsTest: true });
});
const jail = await run("jail", { x: 53.5, y: 0.3, z: 0.3 }, { x: 45.5, y: 0.3, z: 1.5 }, -Math.PI / 2, 12, 1.9);
console.log(JSON.stringify(jail));
if (OUT) await page.screenshot({ path: path.join(OUT, "k9-doors-jail.png") });
check("jail: no dog gets in to you", jail.reached === 0, `closest ${jail.closest}`);
check("jail: each dog spends under 1.5 s pushing at the bars", jail.dogs.every((d) => d && d.grind < 1.5), JSON.stringify(jail.dogs.map((d) => d?.grind)));
check("jail: they give you up (heel, or hold off) instead of grinding", jail.dogs.every((d) => d && (d.gaveUp || d.target == null)), JSON.stringify(jail.dogs.map((d) => d && [d.target, d.gaveUp])));
await page.evaluate(() => {
  const T = window.__trollOps;
  const i = T.colliders.findIndex((c) => c.k9DoorsTest);
  if (i >= 0) T.colliders.splice(i, 1);
});

/* ---- 3. the saloon again, a bot this time */
const bot = await page.evaluate(async ({ me, at, seconds, reach }) => {
  const T = window.__trollOps;
  T.move.reset(me.x, me.z, me.y);
  const b = T.bots.bots.find((x) => x.team !== T.net.team);
  b.respawn({ x: at.x, z: at.z });
  b.pos.set(at.x, at.y, at.z); b.groundY = at.y; b.hopY = 0; b.perchT = 1e9;
  const t0 = performance.now();
  let closest = Infinity, reached = null;
  while (performance.now() - t0 < seconds * 1000) {
    await new Promise((r) => setTimeout(r, 100));
    T.move.pos.set(me.x, me.y, me.z);
    if (!b.alive) break;
    const d = Math.hypot(b.pos.x - me.x, b.pos.z - me.z);
    closest = Math.min(closest, d);
    if (d <= reach) { reached = Math.round((performance.now() - t0) / 100) / 10; break; }
  }
  const out = { reached, closest: +closest.toFixed(2), stuck: b.stuckTotal || 0, alive: b.alive, at: [+b.pos.x.toFixed(1), +b.groundY.toFixed(2), +b.pos.z.toFixed(1)] };
  b.alive = false; b.respawnT = 1e9;
  return out;
}, { me: { x: -14, y: 0.3, z: -15.6 }, at: { x: -14, y: 0, z: -24.6 }, seconds: 25, reach: 2.5 });
console.log(JSON.stringify(bot));
if (OUT) await page.screenshot({ path: path.join(OUT, "k9-doors-bot.png") });
check("saloon: a bot comes in through a back door and reaches you", bot.reached != null, JSON.stringify(bot));
check("saloon: the bot got stuck twice at most on the way", bot.stuck <= 2, `stuck ${bot.stuck}`);

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
