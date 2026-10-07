// Troll Forces — bot accuracy by tier, and misses you can see.
//
// 1. Sim (bots.js alone in a bare page, stepped at 20 Hz, no rendering): one
//    bot per tier, fully on a target standing still at NEAR_RANGE, hip-fire,
//    4000 rounds through the real firing code. Hits land at the tier's
//    DIFFICULTY.hit (recruit 28%, regular 37%, veteran 55%), within 3 points.
// 2. In the game, on Grinsite (unless --sim-only): a hosted bot's miss is
//    pushed through combat/bot-fire.js onBotShoot with the impact fx stubbed.
//    Every miss at a target standing in front of a wall draws one impact on
//    that wall, at least 0.4 m from the target, with the tracer sent along
//    the same line; a hit draws none.
//
// Usage: node tools/troll-ops-bot-aim-test.mjs [--sim-only]

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const SIM_ONLY = process.argv.includes("--sim-only");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".gif": "image/gif" };
// A bare page with the game's import map, for the headless sim.
const SIM_PAGE = `<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{"three":"/assets/vendor/three.module.min.js","three/addons/":"/assets/vendor/addons/"}}</script><body>bot aim sim</body>`;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__bot-aim-sim.html") { res.writeHead(200, { "content-type": "text/html" }); return res.end(SIM_PAGE); }
  const p = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

// The same ?v= tags game.js imports them with, so this runs what ships.
const gameSrc = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/game.js"), "utf8");
const tag = (mod) => gameSrc.match(new RegExp(`\\./${mod.replace(/\//g, "\\/")}\\.js(\\?v=[^"']*)?["']`))?.[1] || "";
const mods = { bots: `/assets/games/troll-ops/bots.js${tag("bots")}`, state: `/assets/games/troll-ops/core/state.js${tag("core/state")}` };

const EXPECTED = { recruit: 0.28, regular: 0.37, veteran: 0.55 };
// 4000 rounds puts 3 points at ~4 sigma; at 2000 a tier strayed past 3
// points about one run in thirty, which is a flaky gate, not a bot.
const SHOTS = 4000;
const TOLERANCE = 0.03;

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });

/* ------------------------------------------------------------------ 1. sim */
{
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/__bot-aim-sim.html`);
  const res = await page.evaluate(async ({ mods, tiers, shots }) => {
    const THREE = await import("three");
    const { BotManager } = await import(mods.bots);
    const arena = { minX: -30, maxX: 30, minZ: -30, maxZ: 30 };
    const out = {};
    for (const tier of tiers) {
      const mgr = new BotManager();
      mgr.difficulty = tier;
      mgr.rebuildNav([], arena, 0);
      mgr.fill(1, 0, () => ({ x: 0, z: 0 }), true);
      const b = mgr.bots[0];
      b.team = "phantom";
      // Standing still 5 m off: under NEAR_RANGE (no falloff), under
      // ADS_MIN_RANGE (hip), past melee reach.
      const target = { id: "target", team: "ghost", alive: true, pos: new THREE.Vector3(5, 0, 0), groundY: 0 };
      let fired = 0, hits = 0, counting = false;
      const ctx = { colliders: [], arena, ffa: false, targets: [target], spawnFor: () => ({ x: 0, z: 0 }),
        sightBlocked: () => false, noRespawn: true,
        onShoot(bot, t, dmg, head, hit) { if (!counting) return; fired++; if (hit) hits++; } };
      const DT = 0.05;
      for (let i = 0; i < 20000 && fired < shots; i++) {
        // Pinned in place with a full magazine and the trigger ready: one
        // round per step, all at the same range.
        b.pos.set(0, 0, 0); b.groundY = 0; b.hopY = 0; b.slideT = 0; b.stunT = 0;
        b.fireT = 0; b.reloadT = 0; b.ammo = 26; b.holdingSecondary = false;
        counting = b.acquireT >= 0.9;    // ACQUIRE_TIME: fully on target
        mgr.update(DT, ctx);
      }
      out[tier] = { fired, hits, rate: fired ? hits / fired : 0, hit: b.diff.hit, missSpread: b.diff.missSpread };
    }
    return out;
  }, { mods, tiers: Object.keys(EXPECTED), shots: SHOTS });
  for (const [tier, want] of Object.entries(EXPECTED)) {
    const r = res[tier];
    check(`sim: ${tier} DIFFICULTY.hit is ${want}`, r.hit === want, `${r.hit}`);
    check(`sim: ${tier} lands ${Math.round(want * 100)}% of ${SHOTS} rounds, within ${TOLERANCE * 100} points`,
      r.fired === SHOTS && Math.abs(r.rate - want) <= TOLERANCE, `${r.hits}/${r.fired} = ${(r.rate * 100).toFixed(1)}%`);
    check(`sim: ${tier} has a missSpread [min, max] in metres`,
      Array.isArray(r.missSpread) && r.missSpread.length === 2 && r.missSpread[0] > 0 && r.missSpread[1] > r.missSpread[0], JSON.stringify(r.missSpread));
  }
  check("sim: recruit misses wider than regular, regular wider than veteran",
    res.recruit.missSpread[1] > res.regular.missSpread[1] && res.regular.missSpread[1] > res.veteran.missSpread[1]);
  check("sim: no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await page.close();
}

/* -------------------------------------------------------------- 2. in game */
if (!SIM_ONLY) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await page.route(/supabase/, (r) => r.abort());
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
  await page.evaluate(async () => {
    const T = window.__trollOps;
    T.loadout.mapId = "grinsite";
    T.setMode("tdm");
    // A private room, never the public one (Supabase is blocked anyway).
    if (T.els.room) { T.els.room.value = "BAIM"; T.els.room.dispatchEvent(new Event("input")); }
    if (T.els.noBots) T.els.noBots.checked = false;
    await T.startGame();
  });
  await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 120000 });
  await page.waitForFunction(() => window.__trollOps.bots.bots.some((b) => b.alive), null, { timeout: 60000 });

  const res = await page.evaluate(async ({ mods }) => {
    const T = window.__trollOps;
    const { game } = await import(mods.state);
    T.closePauseMenu(); if (T.isStaging()) T.endStaging();
    // The bots freeze where they stand; the shots below are ours to call.
    const onShoot = await new Promise((resolve) => {
      T.bots.update = (dt, ctx) => { resolve(ctx.onShoot); T.bots.update = () => {}; };
    });
    const bot = T.bots.bots.find((b) => b.alive);
    const skills = await import(mods.bots);

    // A wall to shoot at: tall and wide, with 10 m of clear air in front of
    // its -z face, found by casting the game's own ray.
    const RAY = T.raycastWorld;
    const muzzleY = 1.45;
    let spot = null;
    for (const c of T.colliders) {
      const w = c.max.x - c.min.x;
      if (w < 7 || c.max.y < 3 || c.min.y > 0.3) continue;
      const x = (c.min.x + c.max.x) / 2, zWall = c.min.z;
      const from = new T.THREE.Vector3(x, muzzleY, zWall - 10);
      const d = RAY(T.colliders, from, new T.THREE.Vector3(0, 0, 1), 20);
      if (Math.abs(d - 10) > 0.05) continue;
      // The misses go up to 2.4 m to either side: that air has to be clear too.
      let clear = true;
      for (const dx of [-3.2, 3.2]) {
        const f2 = new T.THREE.Vector3(x + dx, muzzleY, zWall - 10);
        if (Math.abs(RAY(T.colliders, f2, new T.THREE.Vector3(0, 0, 1), 20) - 10) > 0.05) clear = false;
      }
      if (!clear) continue;
      spot = { x, zWall };
      break;
    }
    if (!spot) return { noWall: true };

    const target = { id: "aim-dummy", team: bot.team === "phantom" ? "ghost" : "phantom", alive: true,
      pos: new T.THREE.Vector3(spot.x, 0, spot.zWall - 1.5), groundY: 0 };
    // 10 m back from the wall, facing +z, at it.
    const place = () => { bot.pos.set(spot.x, 0, spot.zWall - 10); bot.groundY = 0; bot.hopY = 0; bot.yaw = Math.PI; bot.pitch = 0; };

    const impacts = [];
    const fx = game.impactFx;
    const origHit = fx.hit;
    fx.hit = (point, opts) => { impacts.push({ x: point.x, y: point.y, z: point.z, surface: opts?.surface }); };
    const origSpawn = T.bullets.spawn.bind(T.bullets);
    const tracers = [];
    T.bullets.spawn = (o) => { tracers.push({ range: o.range || 0, dir: [o.dir.x, o.dir.y, o.dir.z] }); return origSpawn(o); };
    // The miss is aimed that far to the side of the target; by the wall,
    // 1.5 m further on, the round has drifted a touch wider.
    const grow = 9.5 / 8;

    const perTier = {};
    for (const tier of skills.DIFFICULTY_IDS) {
      bot.skill = tier;
      // Through the bot's own diff: fill() builds bots on the manager's
      // difficulty, so swap the table entry under this one.
      const probe = new skills.BotManager(); probe.difficulty = tier; probe.rebuildNav([], { minX: -1, maxX: 1, minZ: -1, maxZ: 1 }, 0);
      probe.fill(1, 0, () => ({ x: 0, z: 0 }), true);
      bot.diff = probe.bots[0].diff;
      place();
      impacts.length = 0; tracers.length = 0;
      const N = 150;
      for (let i = 0; i < N; i++) onShoot(bot, target, 0, false, false, 8.5);
      const missImpacts = impacts.length;
      const farEnough = impacts.filter((p) => Math.hypot(p.x - target.pos.x, p.z - target.pos.z) >= 0.4).length;
      const onWall = impacts.filter((p) => Math.abs(p.z - spot.zWall) < 0.1).length;
      const sideways = impacts.map((p) => Math.abs(p.x - target.pos.x));
      const ranged = tracers.filter((t) => t.range > 0).length;
      // Hits draw no impact of their own (the body takes it).
      impacts.length = 0; tracers.length = 0;
      for (let i = 0; i < 20; i++) onShoot(bot, target, 0.0001, false, true, 8.5);
      const hitImpacts = impacts.length, hitRanged = tracers.filter((t) => t.range > 0).length;
      perTier[tier] = { N, missImpacts, farEnough, onWall, ranged, hitImpacts, hitRanged,
        spread: [Math.min(...sideways), Math.max(...sideways)].map((v) => +v.toFixed(2)),
        missSpread: bot.diff.missSpread, want: bot.diff.missSpread.map((v) => +(v * grow).toFixed(2)) };
    }
    fx.hit = origHit; T.bullets.spawn = origSpawn;
    return { spot, perTier };
  }, { mods });

  if (res.noWall) {
    check("in game: a wall to shoot at on Grinsite", false, "none found");
  } else {
    for (const [tier, r] of Object.entries(res.perTier)) {
      check(`in game: every ${tier} miss draws one impact on the wall`, r.missImpacts === r.N && r.onWall === r.N, `${r.missImpacts} impacts, ${r.onWall} on the wall, of ${r.N} misses`);
      check(`in game: every ${tier} miss lands at least 0.4 m from the target`, r.farEnough === r.N, `${r.farEnough}/${r.N}`);
      check(`in game: ${tier} misses land the tier's missSpread [${r.missSpread}] to the side (on the wall: [${r.want}])`,
        r.spread[0] >= r.want[0] - 0.15 && r.spread[1] <= r.want[1] + 0.15, `saw ${r.spread}`);
      check(`in game: every ${tier} miss's tracer ends at its impact (range set)`, r.ranged === r.N, `${r.ranged}/${r.N}`);
      check(`in game: a ${tier} hit draws no wall impact and its tracer runs free`, r.hitImpacts === 0 && r.hitRanged === 0, `${r.hitImpacts} impacts, ${r.hitRanged} ranged`);
    }
  }
  check("in game: no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await page.close();
}

await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
