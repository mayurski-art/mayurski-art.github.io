// Troll Forces — bots on stairs.
//
// 1. In the game, on Grinsite: you stand at the top of a staircase; one enemy
//    bot starts on the ground away from its foot, unable to see you (sight is
//    blocked for the test, so it has to hunt rather than shoot from below).
//    It has to find the stair, climb it and come to you. Then the other way:
//    you on the ground, the bot up top, and it has to come back down.
// 2. Every map, by the bots' own logic run headless (bots.js + maps.js in a
//    bare page, stepped at 20 Hz without rendering, far faster than the
//    game under SwiftShader): for every flight of stairs on the map
//    (maps.js api.stairs + findStairs, plus a zombies map's links, exactly
//    what game.js hands the bots), a bot on the floor below hunts a target
//    standing at its top, then a bot up there hunts a target down below.
//    Any route counts, not just that flight. Plus: a bot with nobody to
//    see goes up a stair to perch on its own, and comes back down after.
//
// Usage: node tools/troll-ops-bot-stairs-test.mjs [--sim-only] [map ...]

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const args = process.argv.slice(2);
const SIM_ONLY = args.includes("--sim-only");
const ONLY_MAPS = args.filter((a) => !a.startsWith("--"));

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".gif": "image/gif" };
// A bare page with the game's import map, for the headless sim.
const NAV_PAGE = `<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{"three":"/assets/vendor/three.module.min.js","three/addons/":"/assets/vendor/addons/"}}</script><body>bot stairs sim</body>`;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__bot-stairs-sim.html") { res.writeHead(200, { "content-type": "text/html" }); return res.end(NAV_PAGE); }
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

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });

/* ------------------------------------------------------------ 1. in game */
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
    if (T.els.noBots) T.els.noBots.checked = false;
    await T.startGame();
  });
  await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 120000 });
  await page.waitForFunction(() => window.__trollOps.bots.bots.some((b) => b.alive && b.team !== window.__trollOps.net.team), null, { timeout: 60000 });
  await page.evaluate(() => {
    const T = window.__trollOps;
    T.closePauseMenu(); if (T.isStaging()) T.endStaging();
    setInterval(() => { if (T.player.alive) T.player.hp = T.player.maxHp; T.player.spawnGuard = 0; }, 50);
    // One enemy bot; the rest stand down. Nobody can see anybody.
    const enemy = T.bots.bots.find((b) => b.alive && b.team !== T.net.team);
    for (const b of T.bots.bots) if (b !== enemy) { b.alive = false; b.respawnT = 1e9; }
    const orig = T.bots.update.bind(T.bots);
    T.bots.update = (dt, ctx) => {
      enemy.perchT = 1e9; enemy.perch = null;   // hunting you, not off holding a stair top of its own
      return orig(dt, { ...ctx, sightBlocked: () => true, onThrow: null });
    };
    window.__bs = { enemy };
  });

  const run = (botUp) => page.evaluate(async (botUp) => {
    const T = window.__trollOps, b = window.__bs.enemy;
    const stairs = T.builtMap().stairs || [];
    const s = stairs.filter((x) => x.a.y < 0.2 && x.b.y > 2.5).sort((p, q) => q.b.y - p.b.y)[0];
    const dx = s.b.x - s.a.x, dz = s.b.z - s.a.z, l = Math.hypot(dx, dz);
    const top = { x: s.b.x + dx / l * 0.8, y: s.b.y, z: s.b.z + dz / l * 0.8 };
    const px = -dz / l, pz = dx / l;
    const ground = { x: s.a.x - dx / l * 8 + px * 9, y: 0, z: s.a.z - dz / l * 8 + pz * 9 };
    const me = botUp ? ground : top, it = botUp ? top : ground;
    b.pos.set(it.x, it.y, it.z); b.groundY = it.y; b.hopY = 0; b.climb = null; b.stairPlan = null;
    const t0 = performance.now();
    let best = Infinity, reached = null, maxY = 0, minY = 99;
    while (performance.now() - t0 < 45000) {
      await new Promise((r) => setTimeout(r, 200));
      T.move.pos.set(me.x, me.y, me.z);
      if (!b.alive) break;
      maxY = Math.max(maxY, b.groundY); minY = Math.min(minY, b.groundY);
      const d = Math.hypot(b.pos.x - me.x, b.pos.z - me.z);
      if (Math.abs(b.groundY - me.y) < 0.6) best = Math.min(best, d);
      if (best < 3) { reached = Math.round((performance.now() - t0) / 100) / 10; break; }
    }
    return { best: +best.toFixed(1), reached, maxY: +maxY.toFixed(2), minY: +minY.toFixed(2), alive: b.alive, top: top.y };
  }, botUp);

  const up = await run(false);
  check("in game: a bot on the ground finds the stairs and comes up to you", up.reached != null && up.maxY > up.top - 0.5, JSON.stringify(up));
  const down = await run(true);
  check("in game: a bot upstairs comes back down to you on the ground", down.reached != null && down.minY < 0.3, JSON.stringify(down));
  check("in game: no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await page.close();
}

/* ------------------------------------------------------ 2. every map, sim */
{
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/__bot-stairs-sim.html`);
  // The same ?v= tags game.js imports them with, so this runs what ships.
  const gameSrc = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/game.js"), "utf8");
  const tag = (mod) => gameSrc.match(new RegExp(`\\./${mod}\\.js(\\?v=[^"']*)?["']`))?.[1] || "";
  const mods = { maps: `/assets/games/troll-ops/maps.js${tag("maps")}`, bots: `/assets/games/troll-ops/bots.js${tag("bots")}`,
    nav: `/assets/games/troll-ops/nav.js${tag("nav")}`, movement: `/assets/games/troll-ops/movement.js${tag("movement")}` };
  const mapIds = await page.evaluate(async (mods) => Object.keys((await import(mods.maps)).MAPS), mods);

  for (const id of mapIds) {
    if (ONLY_MAPS.length && !ONLY_MAPS.includes(id)) continue;
    const res = await page.evaluate(async ({ id, mods }) => {
      const THREE = await import("three");
      const { buildMap } = await import(mods.maps);
      const { BotManager } = await import(mods.bots);
      const { FlowField } = await import(mods.nav);
      const { groundHeightAt } = await import(mods.movement);
      const colliders = [], arena = {};
      const bm = buildMap(id, { colliders, arena });
      // What game.js (k9Stairs) hands the bots: the map's flights plus a
      // zombies map's own links.
      const stairs = [...(bm.stairs || [])];
      const zl = bm.map.zombieLayout?.();
      for (const l of zl?.links || []) {
        const fy = (k) => zl.floors?.[k] ?? 0;
        stairs.push({ a: { x: l.a.x, y: fy(l.from), z: l.a.z }, b: { x: l.b.x, y: fy(l.to), z: l.b.z } });
      }
      const flights = stairs.map((s) => (s.a.y <= s.b.y ? s : { a: s.b, b: s.a, found: s.found })).filter((s) => s.b.y - s.a.y >= 1.2);
      if (!flights.length) return { id, flights: 0 };

      const blocked = (x, y, z) => colliders.some((c) => c.max.y > y + 0.45 && c.min.y < y + 1.7
        && x > c.min.x - 0.36 && x < c.max.x + 0.36 && z > c.min.z - 0.36 && z < c.max.z + 0.36);
      const standable = (x, y, z) => Math.abs(groundHeightAt(colliders, x, z, y + 0.4, 0.29) - y) < 0.2 && !blocked(x, y, z)
        && x > arena.minX + 1 && x < arena.maxX - 1 && z > arena.minZ + 1 && z < arena.maxZ - 1;
      const fieldAt = new Map();
      const levelField = (y) => {
        const level = Math.max(0, Math.round(y * 2) / 2);
        if (!fieldAt.has(level)) fieldAt.set(level, new FlowField(colliders, arena, level, { ...(arena.navCell ? { cell: arena.navCell } : {}), needSupport: level > 0.5 }));
        return fieldAt.get(level);
      };
      // A spot on p's level, about `r` metres off, that walks to p on that level.
      const spotNear = (p, r) => {
        const f = levelField(p.y);
        f.targetIdx = -1;
        f.compute(p.x, p.z);
        for (const rr of [r, r * 0.6, r * 0.35, 2]) {
          for (let k = 0; k < 24; k++) {
            const a = (k / 24) * Math.PI * 2 + 0.3;
            const x = p.x + Math.cos(a) * rr, z = p.z + Math.sin(a) * rr;
            if (!standable(x, p.y, z)) continue;
            const i = f.index(x, z);     // its own cell open: a spot the grid can stand a bot on
            if (i >= 0 && !f.blocked[i] && f.dist[i]) return { x, y: p.y, z };
          }
        }
        return null;
      };
      // The top: a step on past the stair onto the floor, if there's floor.
      const topSpot = (s) => {
        const dx = s.b.x - s.a.x, dz = s.b.z - s.a.z, l = Math.hypot(dx, dz) || 1;
        for (const k of [1.2, 0.6, 0]) {
          const p = { x: s.b.x + dx / l * k, y: s.b.y, z: s.b.z + dz / l * k };
          if (standable(p.x, p.y, p.z)) return p;
        }
        return { ...s.b };
      };

      const mgr = new BotManager();
      mgr.rebuildNav(colliders, arena, 0);
      const DT = 0.05;
      const hunt = (from, to, limit) => {
        mgr.clear();
        mgr.fill(1, 0, () => ({ x: from.x, z: from.z }), true);
        const b = mgr.bots[0];
        b.team = "phantom";
        b.pos.set(from.x, from.y, from.z); b.groundY = from.y; b.perchT = 1e9;
        const target = { id: "target", team: "ghost", alive: true, pos: new THREE.Vector3(to.x, to.y, to.z), groundY: to.y };
        const ctx = { colliders, arena, ffa: false, targets: [target], onShoot() {}, spawnFor: () => from,
          sightBlocked: () => true, stairs, noRespawn: true };
        let maxY = from.y, minY = from.y, roped = 0;
        for (let t = 0; t < limit; t += DT) {
          mgr.update(DT, ctx);
          maxY = Math.max(maxY, b.groundY); minY = Math.min(minY, b.groundY);
          if (b.stance === "rope") roped++;
          if (Math.abs(b.groundY - to.y) < 0.6 && Math.hypot(b.pos.x - to.x, b.pos.z - to.z) < 2.5) {
            return { ok: true, t: +t.toFixed(1), roped };
          }
        }
        return { ok: false, from: [from.x, from.y, from.z].map((v) => +v.toFixed(1)), to: [to.x, to.y, to.z].map((v) => +v.toFixed(1)),
          at: [b.pos.x, b.groundY, b.pos.z].map((v) => +v.toFixed(1)), maxY: +maxY.toFixed(2), minY: +minY.toFixed(2),
          climb: !!b.climb, plan: b.stairPlan?.key || null };
      };

      const out = { id, flights: flights.length, results: [] };
      for (const s of flights) {
        const top = topSpot(s);
        // A rope's bot starts at its foot, so the rope is the way up (12 m
        // out, another route can be shorter, and is rightly taken).
        const below = spotNear(s.a, s.rope ? 3 : 12);
        const name = `[${[s.a.x, s.a.y, s.a.z].map((v) => +v.toFixed(1))}] -> [${[s.b.x, s.b.y, s.b.z].map((v) => +v.toFixed(1))}]${s.found ? " (found)" : ""}`;
        if (!below) { out.results.push({ name, skip: "no floor near its foot" }); continue; }
        // Time enough to walk the long way round a big map.
        const limit = 60 + Math.hypot(top.x - below.x, top.z - below.z) * 0.5;
        out.results.push({ name, rope: !!s.rope, up: hunt(below, top, limit), down: hunt(top, below, limit) });
      }

      // On its own: nobody in sight, an enemy away on the ground, and a bot
      // that decides to take the high ground has to get up there, hold it,
      // and come back down to hunt again.
      {
        mgr.clear();
        const s = flights.find((f) => f.a.y < 0.3) || flights[0];
        const start = spotNear(s.a, 6) || s.a;
        const far = spotNear(s.a, 25) || start;
        mgr.fill(1, 0, () => ({ x: start.x, z: start.z }), true);
        const b = mgr.bots[0];
        b.team = "phantom";
        b.pos.set(start.x, start.y, start.z); b.groundY = start.y; b.perchT = 0;
        const target = { id: "target", team: "ghost", alive: true, pos: new THREE.Vector3(far.x, far.y, far.z), groundY: far.y };
        const ctx = { colliders, arena, ffa: false, targets: [target], onShoot() {}, spawnFor: () => start,
          sightBlocked: () => true, stairs, noRespawn: true };
        const rnd = Math.random;
        Math.random = () => 0.01;          // this time it does go
        mgr.update(DT, ctx);
        Math.random = rnd;
        const perch = b.perch && { ...b.perch };
        let up = null, down = null;
        for (let t = 0; t < 120 && down == null; t += DT) {
          mgr.update(DT, ctx);
          if (up == null && perch && Math.abs(b.groundY - perch.y) < 0.6 && Math.hypot(b.pos.x - perch.x, b.pos.z - perch.z) < 2) up = +t.toFixed(1);
          if (up != null && Math.abs(b.groundY - far.y) < 0.6 && Math.hypot(b.pos.x - far.x, b.pos.z - far.z) < 2.5) down = +t.toFixed(1);
        }
        out.perch = { picked: perch ? [perch.x, perch.y, perch.z].map((v) => +v.toFixed(1)) : null, up, down,
          at: [b.pos.x, b.groundY, b.pos.z].map((v) => +v.toFixed(1)) };
      }
      return out;
    }, { id, mods });

    if (!res.flights) { console.log(`--    ${id}: no upper floors`); continue; }
    let pass = 0, total = 0;
    for (const r of res.results) {
      if (r.skip) { console.log(`--    ${id} ${r.name}: skipped, ${r.skip}`); continue; }
      total += 2;
      if (r.up.ok) pass++; else check(`${id}: a bot below goes up ${r.name}`, false, JSON.stringify(r.up));
      if (r.down.ok) pass++; else check(`${id}: a bot up top comes down ${r.name}`, false, JSON.stringify(r.down));
    }
    check(`${id}: bots go up and come back down every flight (${res.flights})`, pass === total && total > 0, `${pass}/${total}`);
    // Ropes (maps.js api.rope): the bot actually climbed one, both ways.
    const ropes = res.results.filter((r) => r.rope && !r.skip);
    if (ropes.length) {
      const used = ropes.filter((r) => r.up.roped > 0 && r.down.roped > 0);
      check(`${id}: bots climb the ropes up and down (${ropes.length})`, used.length === ropes.length,
        JSON.stringify(ropes.map((r) => [r.name, r.up.roped || 0, r.down.roped || 0, r.up.t, r.down.t])));
    }
    check(`${id}: a bot takes the high ground on its own, then comes back down`, res.perch.up != null && res.perch.down != null, JSON.stringify(res.perch));
  }
  check("sim: no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await page.close();
}

await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
