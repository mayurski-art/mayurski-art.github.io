// Bots that stop moving (user, 2026-10-04: "seems like the bots are stuck").
// Plays a TDM match with bots on each map, the player parked out of the
// fight, and watches every bot: one that stays inside a small circle for
// STALL sim-seconds without anyone in sight is stuck.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-bot-stuck-test.mjs [mapId ...]
// SIM_SECONDS (default 60) per map.

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

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SIM = +(process.env.SIM_SECONDS || 60);
const STALL = 8;      // sim seconds
const RADIUS = 1.5;   // metres

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });

let maps = process.argv.slice(2);
if (!maps.length) maps = await page.evaluate(async () => (await import("./assets/games/troll-ops/maps.js")).MAP_IDS).catch(() => []);
if (!maps.length) maps = ["trollcity"];

for (const mapId of maps) {
  await page.evaluate(async ([mapId, natural]) => {
    const T = window.__trollOps;
    if (T.state() !== "menu" && T.endMatch) { try { T.endMatch(); } catch {} }
    T.settings.botSkill = "veteran";
    T.bots.difficulty = "veteran";
    T.setMode("tdm");
    if (T.els.noBots) T.els.noBots.checked = false;
    T.loadout.mapId = mapId;
    await T.startGame();
    if (!natural && T.isStaging()) T.endStaging();
    T.player.maxHp = T.player.hp = 1e9;
    // Sim clock and per-bot tracks, sampled inside the bot update itself so
    // a slow renderer doesn't matter.
    const W = window.__stuck = { sim: 0, tracks: new Map(), events: [] };
    if (!T.bots.__orig) T.bots.__orig = T.bots.update.bind(T.bots);
    T.bots.update = (dt, ctx) => {
      T.bots.__orig(dt, ctx);
      W.sim += dt;
      for (const b of T.bots.bots) {
        let t = W.tracks.get(b.id);
        if (!t || !b.alive) { W.tracks.set(b.id, { x: b.pos.x, z: b.pos.z, since: W.sim, flagged: false }); continue; }
        // A fight resets the window: strafing on the spot is fine.
        if (b.seenId || Math.hypot(b.pos.x - t.x, b.pos.z - t.z) > 1.5) { t.x = b.pos.x; t.z = b.pos.z; t.since = W.sim; t.flagged = false; continue; }
        if (!t.flagged && W.sim - t.since > 8) {
          t.flagged = true;
          W.events.push({ id: b.id, x: +b.pos.x.toFixed(1), y: +b.groundY.toFixed(2), z: +b.pos.z.toFixed(1), at: +W.sim.toFixed(1),
            perch: !!b.perch, climb: !!b.climb, crate: !!b.crate,
            pilot: !!b.piloting, gunner: !!b.gunning, stun: b.stunT > 0, vel: +Math.hypot(b.vel.x, b.vel.z).toFixed(2), unstick: b.stuckHops || 0, lastSeen: b.lastSeen && +b.lastSeen.age.toFixed(1) });
        }
      }
    };
  }, [mapId, !!process.env.NATURAL]);
  const t0 = Date.now();
  let sim = 0;
  while (sim < SIM && Date.now() - t0 < 240000) {
    sim = await page.evaluate(() => { window.__trollOps.player.hp = 1e9; return window.__stuck.sim; });
    await sleep(500);
  }
  const r = await page.evaluate(() => ({ sim: window.__stuck.sim, events: window.__stuck.events, n: window.__trollOps.bots.bots.length,
    staging: window.__trollOps.isStaging(), state: window.__trollOps.state(),
    pos: window.__trollOps.bots.bots.map((b) => [+b.pos.x.toFixed(1), +b.pos.z.toFixed(1), b.alive ? 1 : 0]) }));
  console.log(`  ${mapId}: state=${r.state} staging=${r.staging} bots=${JSON.stringify(r.pos)}`);
  check(`${mapId}: no bot stands still ${STALL}s with nobody in sight`, r.events.length === 0,
    `${r.n} bots, ${r.sim.toFixed(0)}s sim, ${r.events.length} stalls ${JSON.stringify(r.events.slice(0, 8))}`);
}

// The care package (the main culprit): a bot that calls one goes about its
// business while the heli is inbound, then fetches and claims it once down.
await page.evaluate(() => {
  const T = window.__trollOps;
  const b = T.bots.bots.find((x) => x.alive);
  b.hp = b.maxHp = 1e9;
  T.botStreakState(b).ready.push("carepackage");
  window.__crate = { id: b.id, called: false, inboundSamples: 0, inboundStill: 0, claimed: false, startSim: window.__stuck.sim };
  const W = window.__crate;
  const upd = T.bots.update;
  T.bots.update = (dt, ctx) => {
    upd(dt, ctx);
    const bot = T.bots.byId(W.id);
    if (!bot) return;
    bot.hp = 1e9;
    if (bot.crate) W.called = true;
    const e = bot.crate && T.streakEntities.get(bot.crate.eid);
    if (e && e.constructor.name === "CarePackage" && !e.landed) {
      W.inboundSamples++;
      if (!bot.seenId && Math.hypot(bot.vel.x, bot.vel.z) < 0.3) W.inboundStill++;
      W.obj = !!T.botObjective(bot);
    }
    if (W.called && !bot.crate && !W.claimed) { W.claimed = true; W.claimSim = window.__stuck.sim - W.startSim; }
  };
});
{
  const t0 = Date.now();
  let c;
  while (Date.now() - t0 < 300000) {
    c = await page.evaluate(() => ({ ...window.__crate, sim: window.__stuck.sim - window.__crate.startSim }));
    if (c.claimed || c.sim > 60) break;
    await sleep(500);
  }
  check("a bot calls its care package", c.called, JSON.stringify(c));
  check("no package objective while the heli is inbound", c.inboundSamples > 0 && c.obj === false, `${c.inboundSamples} samples`);
  check("it doesn't stand still waiting for the drop", c.inboundSamples > 0 && c.inboundStill / c.inboundSamples < 0.5, `${c.inboundStill}/${c.inboundSamples} still`);
  check("it fetches and claims it (or gives up) once down", c.claimed, `after ${c.claimSim?.toFixed?.(1)}s sim`);
}

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
