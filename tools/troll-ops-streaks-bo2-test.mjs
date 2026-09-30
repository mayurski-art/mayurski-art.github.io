// The three Black Ops 2 top-tier streaks: K9 Unit, VTOL Warship and Swarm.
// A TDM with bots; each streak is granted, called, and has to actually do
// its job: the dogs come out, run at the enemy and bite (and get shot by
// bots); the warship puts you in its gunner seat over the map, both guns
// fire and land, and you're back on your feet when it's over; the swarm
// sends drone after drone down out of the sky onto the enemy.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-streaks-bo2-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOT_DIR || null;
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.setMode("tdm");
  T.els.noBots.checked = false;
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.isStaging(), null, { timeout: 120000 });
await page.waitForFunction(() => window.__trollOps.bots.bots.filter((b) => b.alive).length >= 4, null, { timeout: 60000 });
// The caller can't die mid-test: that would end the warship ride early.
await page.evaluate(() => {
  const T = window.__trollOps;
  setInterval(() => { if (T.player.alive) T.player.hp = T.player.maxHp; T.player.spawnGuard = 0; }, 50);
  T.streaks.setSelected(["k9", "warship", "swarm"]);
});
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }); };

// ---- the streak defs
const defs = await page.evaluate(() => {
  const T = window.__trollOps;
  return { ids: T.streakSlotIds(), names: T.streakSlotIds().map((id) => T.STREAK_DEFS?.[id]?.name) };
});
check("K9 Unit, VTOL Warship and Swarm slot in cheapest to dearest", defs.ids.join() === "k9,warship,swarm", defs.ids.join());

// ---- K9 Unit
await page.evaluate(() => { const T = window.__trollOps; T.streaks.grant("k9"); T.callStreak("k9"); });
await page.waitForFunction(() => { const T = window.__trollOps; const p = [...T.streakEntities.values()].find((e) => e instanceof T.K9Pack); return p && p.dogs.filter((d) => d?.parts).length === 6; }, null, { timeout: 20000 }).catch(() => {});
const k9a = await page.evaluate(() => {
  const T = window.__trollOps;
  const pack = [...T.streakEntities.values()].find((e) => e instanceof T.K9Pack);
  return pack ? { dogs: pack.dogs.filter(Boolean).length, model: pack.dogs.filter((d) => d?.parts).length,
    meshes: pack.hitMeshes().length } : null;
});
check("six dogs come out", k9a?.dogs === 6, JSON.stringify(k9a));
check("the dog model loads (legs, head, jaw, tail)", k9a?.model === 6, `${k9a?.model} posed`);
// Watch the pack hunt for a while: bots lose health to "k9" bites.
const k9b = await page.evaluate(async () => {
  const T = window.__trollOps;
  const pack = [...T.streakEntities.values()].find((e) => e instanceof T.K9Pack);
  let bites = 0;
  const orig = T.bots.applyHit.bind(T.bots);
  T.bots.applyHit = (id, dmg, o) => { if (dmg === T.K9.bite) bites++; return orig(id, dmg, o); };
  const start = pack.dogs.map((d) => d.pos.clone());
  let chasing = 0, dogHp = 0;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    chasing = Math.max(chasing, pack.dogs.filter((d) => d.alive && d.targetId).length);
    if (bites >= 2) break;
  }
  dogHp = pack.dogs.reduce((s, d) => s + Math.max(0, d.hp), 0);
  const moved = Math.max(...pack.dogs.map((d, i) => d.pos.distanceTo(start[i])));
  T.bots.applyHit = orig;
  return { bites, chasing, moved, dogHp, full: T.K9.hp * 6 };
});
check("the dogs pick targets and run at them", k9b.chasing >= 3 && k9b.moved > 5, JSON.stringify(k9b));
check("the dogs bite bots", k9b.bites >= 1, `${k9b.bites} bites`);
await shot("k9");
// Bots shoot back, and so do the dogs' own damage paths.
const k9c = await page.evaluate(() => {
  const T = window.__trollOps;
  const pack = [...T.streakEntities.values()].find((e) => e instanceof T.K9Pack);
  const hasDogTargets = !!pack;
  const d = pack.dogs.find((x) => x.alive);
  const killed = T.damageDog(pack, d.i, 500, "bot-x");
  return { killed, alive: pack.alive.length, hasDogTargets };
});
check("a dog can be killed", k9c.killed && k9c.alive <= 5, JSON.stringify(k9c));
await page.evaluate(() => {
  const T = window.__trollOps;
  const pack = [...T.streakEntities.values()].find((e) => e instanceof T.K9Pack);
  pack.duration = pack.age + 0.5;
});
await sleep(1500);
const k9d = await page.evaluate(() => [...window.__trollOps.streakEntities.values()].some((e) => e instanceof window.__trollOps.K9Pack));
check("the pack is called off when its time is up", !k9d);

// ---- VTOL Warship
await page.evaluate(() => {
  const T = window.__trollOps;
  T.STREAK_DEFS_warshipDuration = null;
  T.streaks.grant("warship");
  T.callStreak("warship");
});
await page.waitForFunction(() => window.__trollOps.warshipView(), null, { timeout: 20000 });
await sleep(500);   // the camera moves up on the next frame
const ws1 = await page.evaluate(() => {
  const T = window.__trollOps;
  return { camY: T.camera.position.y, footY: T.move.pos.y, filter: T.renderer.domElement.style.filter,
    hud: !document.querySelector(".to-ws").hidden };
});
check("you're in the gunner seat, high over the map", ws1.camY > ws1.footY + 40, JSON.stringify(ws1));
check("thermal view and the gunner HUD are up", ws1.filter.includes("grayscale") && ws1.hud);
// On station: aim at a bot and fire the chain gun, then the cannon.
await page.waitForFunction(() => window.__trollOps.warship()?.onStation, null, { timeout: 20000 });
const fireAt = async (gun, ms) => page.evaluate(async ({ gun, ms }) => {
  const T = window.__trollOps;
  if (T.warshipGun() !== gun) T.switchWeapon("secondary");
  let landed = 0, dealt = 0;
  const ws = T.warship();
  const origUpd = ws.update.bind(ws);
  ws.update = (dt, out) => { const n = out ? out.length : 0; const r = origUpd(dt, out); if (out) landed += out.length - n; return r; };
  const orig = T.bots.applyHit.bind(T.bots);
  T.bots.applyHit = (id, dmg, o) => { dealt += dmg; return orig(id, dmg, o); };
  const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    // keep the crosshair on the nearest bot
    const cam = T.camera.position;
    const bot = T.bots.bots.filter((b) => b.alive).sort((a, b) => a.pos.distanceTo(cam) - b.pos.distanceTo(cam))[0];
    if (bot) {
      const dx = bot.pos.x - cam.x, dy = bot.pos.y + 0.9 - cam.y, dz = bot.pos.z - cam.z;
      T.look.yaw = Math.atan2(-dx, -dz);
      T.look.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    }
    T.setTrigger(true);
    await new Promise((r) => setTimeout(r, 50));
  }
  T.setTrigger(false);
  await new Promise((r) => setTimeout(r, 1200));
  ws.update = origUpd;
  T.bots.applyHit = orig;
  return { gun: T.warshipGun(), landed, dealt: Math.round(dealt) };
}, { gun, ms });
const chain = await fireAt("chain", 2500);
await shot("warship-chain");
check("the 25 mm chain gun fires and its rounds land", chain.gun === "chain" && chain.landed >= 5, JSON.stringify(chain));
const cannon = await fireAt("cannon", 5000);
await shot("warship-cannon");
check("swap to the 105 mm cannon; its shells land", cannon.gun === "cannon" && cannon.landed >= 1, JSON.stringify(cannon));
check("the warship's guns hurt the enemy", chain.dealt + cannon.dealt > 0, `${chain.dealt + cannon.dealt} damage`);
const walked = await page.evaluate(async () => {
  const T = window.__trollOps; const x0 = T.move.pos.x, z0 = T.move.pos.z;
  T.keys.add("KeyW"); await new Promise((r) => setTimeout(r, 600)); T.keys.delete("KeyW");
  return Math.hypot(T.move.pos.x - x0, T.move.pos.z - z0);
});
check("your body stays put while you're up there", walked < 0.05, `${walked.toFixed(2)} m`);
// End the ride early and check you're back.
await page.evaluate(() => { const ws = window.__trollOps.warship(); ws.duration = ws.age + 0.2; });
await sleep(1200);
const ws2 = await page.evaluate(() => {
  const T = window.__trollOps;
  return { view: T.warshipView(), camY: T.camera.position.y, footY: T.move.pos.y, filter: T.renderer.domElement.style.filter };
});
check("back on your feet when it's over", !ws2.view && Math.abs(ws2.camY - ws2.footY) < 3 && !ws2.filter, JSON.stringify(ws2));

// ---- Swarm
await page.evaluate(() => {
  const T = window.__trollOps;
  T.streaks.grant("swarm");
  T.callStreak("swarm");
});
const sw = await page.evaluate(async () => {
  const T = window.__trollOps;
  let maxAlive = 0, launched = new Set(), hits = 0;
  const orig = T.bots.applyHit.bind(T.bots);
  T.bots.applyHit = (id, dmg, o) => { hits++; return orig(id, dmg, o); };
  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const drones = [...T.streakEntities.values()].filter((e) => e instanceof T.HunterDroneClass && e.sky);
    drones.forEach((d) => launched.add(d.id));
    maxAlive = Math.max(maxAlive, drones.length);
  }
  T.bots.applyHit = orig;
  return { launched: launched.size, maxAlive, hits, run: T.swarmRuns.length };
});
await shot("swarm");
check("the swarm keeps sending drones", sw.launched >= 6, JSON.stringify(sw));
check("never more than six in the air at once", sw.maxAlive <= 6);
check("the swarm's drones hit the enemy", sw.hits >= 1, `${sw.hits} hits`);

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
