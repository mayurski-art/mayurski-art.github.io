// Troll Forces — do the bots use the whole map? (HANDOFF "Small known gaps":
// bots stayed on the ground floor on every map and rarely visited
// Hollowgrin's far districts.)
//
// Bot matches run headless, by the bots' own logic (bots.js + maps.js in a
// bare page, stepped at 20 Hz without rendering, the way
// troll-ops-bot-stairs-test.mjs runs them): ten bots, five a side, team
// deathmatch with real shots (sight, hits, deaths, respawns at the map's
// ground spawns, as game.js botSpawn). Every map in the versus pool, a few
// minutes each. Measured over every living bot-second:
//   - the share spent off the ground floor (feet 1.5 m+ up, stair treads
//     included only once past that), on maps that have an upper floor;
//   - the share in each district (the map cut into ~30 m squares that have
//     floor in them; Hollowgrin also by name: the park, the chapel, the
//     witch's hollow, the creek, Trick-or-Treat Lane...), and how many
//     districts got next to nothing;
//   - kills (the bots still find each other and fight), and the sim's cost
//     per bot per second (nav and all), so a smarter bot isn't a slower one.
//
// Usage: node tools/troll-ops-bot-floors-test.mjs [--report] [--secs=N] [--seeds=N] [map ...]
//   ROOT_DIR=<checkout> to measure another build (e.g. a worktree of main).
//   --report: print the numbers, no pass/fail.

import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const args = process.argv.slice(2);
const REPORT = args.includes("--report");
const SECS = +(args.find((a) => a.startsWith("--secs="))?.slice(7) || 120);
const SEEDS = +(args.find((a) => a.startsWith("--seeds="))?.slice(8) || 3);
const ONLY_MAPS = args.filter((a) => !a.startsWith("--"));

// ROOT_DIR=<another checkout>: measure that build instead (a worktree of
// main, for before and after).
const ROOT = process.env.ROOT_DIR ? path.resolve(process.env.ROOT_DIR) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".gif": "image/gif" };
const SIM_PAGE = `<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{"three":"/assets/vendor/three.module.min.js","three/addons/":"/assets/vendor/addons/"}}</script><body>bot floors sim</body>`;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__bot-floors-sim.html") { res.writeHead(200, { "content-type": "text/html" }); return res.end(SIM_PAGE); }
  const p = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

let failures = 0;
function check(name, ok, detail = "") {
  if (REPORT) return;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

/* Hollowgrin's districts by name (hollowgrin.js's header and its layout
   constants: the manor MANOR, the chapel CHAPEL, the witch's pond POND, the
   creek CREEK, the park east of PARK_X), first match wins. The far ones,
   with the least share each has to get: the bots never went to them. */
const HG_DISTRICTS = {
  chapel: [-51, -36, -6, 10], hollow: [-51, -34, -32, -10], creek: [-51, -30, 14, 45],
  park: [51, 87, -45, 45], manor: [-14, 14, -30, -10], north: [-51, 51, -45, -30],
  square: [-14, 14, -10, 14], graveyard: [-36, -14, -32, 14], corn: [14, 51, -30, 14],
  lane: [-30, 51, 14, 45],
};
// (main before the fix, 3 x 120 s: chapel 0, hollow 0, creek 0, park 5.3%)
const HG_FAR = { chapel: 0.1, hollow: 0.1, creek: 0.3, park: 15, lane: 8 };

const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/__bot-floors-sim.html`);
// The same ?v= tags game.js imports them with, so this runs what ships.
const gameSrc = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/game.js"), "utf8");
const tag = (mod) => gameSrc.match(new RegExp(`\\./${mod}\\.js(\\?v=[^"']*)?["']`))?.[1] || "";
const mods = { maps: `/assets/games/troll-ops/maps.js${tag("maps")}`, bots: `/assets/games/troll-ops/bots/bots.js${tag("bots/bots")}`,
  ballistics: `/assets/games/troll-ops/weapons/ballistics.js${tag("weapons/ballistics")}`, movement: `/assets/games/troll-ops/core/movement.js${tag("core/movement")}` };
const mapIds = await page.evaluate(async (mods) => (await import(mods.maps)).MAP_IDS, mods);

const results = [];
for (const id of mapIds) {
  if (ONLY_MAPS.length && !ONLY_MAPS.includes(id)) continue;
  const res = await page.evaluate(async ({ id, mods, SECS, SEEDS, HG }) => {
    const THREE = await import("three");
    const { buildMap } = await import(mods.maps);
    const { BotManager } = await import(mods.bots);
    const { groundHeightAt } = await import(mods.movement);
    const colliders = [], arena = {};
    const bm = buildMap(id, { colliders, arena });
    // What game.js (k9Stairs) hands the bots.
    const stairs = [...(bm.stairs || [])];
    const zl = bm.map.zombieLayout?.();
    for (const l of zl?.links || []) {
      const fy = (k) => zl.floors?.[k] ?? 0;
      stairs.push({ a: { x: l.a.x, y: fy(l.from), z: l.a.z }, b: { x: l.b.x, y: fy(l.to), z: l.b.z } });
    }
    const hasUpper = stairs.some((s) => Math.max(s.a.y, s.b.y) >= 1.5);

    // Districts: ~30 m squares over the bounds, kept if a fair share of the
    // square is open ground (a bot could stand there).
    const W = arena.maxX - arena.minX, D = arena.maxZ - arena.minZ;
    const nx = Math.max(1, Math.round(W / 30)), nz = Math.max(1, Math.round(D / 30));
    const cellOf = (x, z) => Math.min(nx - 1, Math.max(0, Math.floor((x - arena.minX) / W * nx)))
      + nx * Math.min(nz - 1, Math.max(0, Math.floor((z - arena.minZ) / D * nz)));
    const open = new Array(nx * nz).fill(0), tried = new Array(nx * nz).fill(0);
    for (let x = arena.minX + 0.5; x < arena.maxX; x += 1.5) {
      for (let z = arena.minZ + 0.5; z < arena.maxZ; z += 1.5) {
        const k = cellOf(x, z);
        tried[k]++;
        let free = true;
        for (const c of colliders) {
          if (c.max.y <= 0.45 || c.min.y >= 1.7) continue;
          if (x > c.min.x - 0.36 && x < c.max.x + 0.36 && z > c.min.z - 0.36 && z < c.max.z + 0.36) { free = false; break; }
        }
        if (free) open[k]++;
      }
    }
    const live = open.map((n, k) => n / tried[k] > 0.25 && n > 40);

    const ground = bm.spawnPoints.filter((p) => (p.y || 0) < 0.5);
    const spawnPts = ground.length ? ground : bm.spawnPoints;
    let mgr0Places = null;
    let totals = { t: 0, up: 0, cells: new Array(nx * nz).fill(0), named: {}, kills: 0, ms: 0, levels: {}, upPerBot: [], posts: { up: 0, upArrived: 0, ground: 0, groundArrived: 0, failed: {}, died: 0, byNamed: {} }, fighting: 0 };
    const namedOf = (x, z) => { for (const [n, [x0, x1, z0, z1]] of Object.entries(HG || {})) if (x >= x0 && x < x1 && z >= z0 && z < z1) return n; return "?"; };
    const tally = (p, k) => { if (id !== "hollowgrin") return; const n = namedOf(p.x, p.z); const e = totals.posts.byNamed[n] || (totals.posts.byNamed[n] = [0, 0]); e[k]++; };
    for (let seed = 0; seed < SEEDS; seed++) {
      const mgr = new BotManager();
      mgr.rebuildNav(colliders, arena, 0);
      mgr.prepPlaces?.(stairs);   // as game.js does at map load
      const spawnFor = (team, botId) => {
        // a ground spawn away from the other side, like game.js botSpawn
        const foes = mgr.bots.filter((b) => b.alive && b.team !== team && b.id !== botId);
        let best = null, bestS = -Infinity;
        for (let k = 0; k < 4; k++) {
          const p = spawnPts[Math.floor(Math.random() * spawnPts.length)];
          let s = Infinity;
          for (const f of foes) s = Math.min(s, Math.hypot(f.pos.x - p.x, f.pos.z - p.z));
          if (s > bestS) { bestS = s; best = p; }
        }
        const a = Math.random() * Math.PI * 2;
        return new THREE.Vector3(best.x + Math.cos(a) * 1.2, best.y || 0, best.z + Math.sin(a) * 1.2);
      };
      mgr.fill(10, 0, spawnFor, false, { phantom: 0, ghost: 0 });
      for (const b of mgr.bots) { const s = spawnFor(b.team, b.id); b.pos.copy(s); b.groundY = s.y; }
      const ctx = { colliders, arena, ffa: false, targets: mgr.bots, stairs, spawnFor,
        onShoot(bot, target, dmg) {
          if (!dmg) return;
          const r = mgr.applyHit(target.id, dmg);
          if (r.killed) { bot.kills++; totals.kills++; }
        } };
      const DT = 0.05;
      const upT = new Map(), lastPerch = new Map();
      for (let t = 0; t < SECS; t += DT) {
        const t0 = performance.now();
        mgr.update(DT, ctx);
        const tickMs = performance.now() - t0;
        totals.ms += tickMs;
        totals.maxTick = Math.max(totals.maxTick || 0, tickMs);
        // Posts picked, reached, given up on (bots.js updatePerch / pickPost).
        for (const b of mgr.bots) {
          const was = lastPerch.get(b.id), p = b.perch;
          if (p && (!was || was.p !== p)) {
            if (p.y >= 1.5) totals.posts.up++; else totals.posts.ground++;
            tally(p, 0);
            lastPerch.set(b.id, { p, arrived: false, deaths: b.deaths });
          } else if (!p && was) {
            if (b.deaths !== was.deaths) totals.posts.died++;
            else if (!was.arrived) totals.posts.failed[was.p.id] = (totals.posts.failed[was.p.id] || 0) + 1;
            lastPerch.delete(b.id);
          }
          const cur = lastPerch.get(b.id);
          if (cur && p?.arrived && !cur.arrived) { cur.arrived = true; tally(p, 1); if (p.y >= 1.5) totals.posts.upArrived++; else totals.posts.groundArrived++; }
        }
        if (t < 5) continue;     // the walk out of spawn
        for (const b of mgr.bots) {
          if (!b.alive) continue;
          totals.t += DT;
          if (b.seenId) totals.fighting += DT;
          if (b.groundY >= 1.5) {
            totals.up += DT;
            upT.set(b.id, (upT.get(b.id) || 0) + DT);
            const lv = (Math.round(b.groundY * 2) / 2).toFixed(1);
            totals.levels[lv] = (totals.levels[lv] || 0) + DT;
          }
          totals.cells[cellOf(b.pos.x, b.pos.z)] += DT;
          if (HG && id === "hollowgrin") {
            for (const [n, [x0, x1, z0, z1]] of Object.entries(HG)) {
              if (b.pos.x >= x0 && b.pos.x < x1 && b.pos.z >= z0 && b.pos.z < z1) { totals.named[n] = (totals.named[n] || 0) + DT; break; }
            }
          }
        }
      }
      mgr0Places = mgr.places;
      totals.upPerBot.push(...mgr.bots.map((b) => upT.get(b.id) || 0));
    }
    const share = (v) => +(100 * v / Math.max(1e-6, totals.t)).toFixed(1);
    const liveShares = totals.cells.map((v, k) => (live[k] ? share(v) : null));
    return {
      id, hasUpper, flights: stairs.length,
      upShare: share(totals.up),
      botsUp: totals.upPerBot.filter((v) => v > 3).length + "/" + totals.upPerBot.length,
      levels: Object.fromEntries(Object.entries(totals.levels).sort((a, b) => a[0] - b[0]).map(([k, v]) => [k, share(v)])),
      grid: `${nx}x${nz}`, districts: liveShares,
      named: Object.fromEntries(Object.entries(totals.named).map(([k, v]) => [k, share(v)])),
      kills: totals.kills,
      places: mgr0Places && { upper: mgr0Places.upper.length, ground: mgr0Places.ground.length, ms: +(mgr0Places.buildMs || 0).toFixed(1) },
      posts: totals.posts, fighting: share(totals.fighting),
      maxTickMs: +(totals.maxTick || 0).toFixed(1),
      msPerBotSec: +(totals.ms / (SECS * SEEDS * 10)).toFixed(3),
    };
  }, { id, mods, SECS, SEEDS, HG: HG_DISTRICTS });
  results.push(res);

  const live = res.districts.filter((v) => v != null);
  const even = 100 / Math.max(1, live.length);
  const empty = live.filter((v) => v < even * 0.15).length;
  const minD = Math.min(...live);
  console.log(`${id.padEnd(13)} up ${String(res.upShare).padStart(5)}%  bots-up ${res.botsUp.padStart(5)}  levels ${JSON.stringify(res.levels)}`);
  console.log(`${"".padEnd(13)} districts ${res.grid} ${JSON.stringify(res.districts)}  near-empty ${empty}/${live.length}  kills ${res.kills}  ${res.msPerBotSec} ms/bot-s  slowest tick ${res.maxTickMs} ms`);
  const ps = res.posts;
  console.log(`${"".padEnd(13)} posts ${JSON.stringify(res.places)}  up ${ps.upArrived}/${ps.up} reached, ground ${ps.groundArrived}/${ps.ground}  died on the way ${ps.died}  in sight of a foe ${res.fighting}%  failed ${JSON.stringify(Object.entries(ps.failed).sort((a, b) => b[1] - a[1]).slice(0, 6))}`);
  if (id === "hollowgrin") console.log(`${"".padEnd(13)} posts picked/reached by district ${JSON.stringify(res.posts.byNamed)}`);
  if (id === "hollowgrin") console.log(`${"".padEnd(13)} named ${JSON.stringify(res.named)}`);

  if (res.hasUpper) {
    // (main before the fix: 0-8%, most maps under 1%; now 9-43%)
    check(`${id}: bots spend time off the ground floor (>= 5% of bot-time)`, res.upShare >= 5, `${res.upShare}%`);
    check(`${id}: most bots go up at some point (>= 40%)`, +res.botsUp.split("/")[0] >= +res.botsUp.split("/")[1] * 0.4, res.botsUp);
  }
  // (main before the fix: Hollowgrin 5 of 15, Troll City 3 of 12, Grin Beach 3 of 9)
  check(`${id}: at most one district left near-empty (under 15% of an even share)`, empty <= 1, `${empty}, min ${minD}% vs even ${even.toFixed(1)}%`);
  // (main before the fix: 54-110 kills in 360 s; now about a fifth fewer, the bots no longer all run at the nearest enemy)
  check(`${id}: the bots still fight (kills)`, res.kills >= SECS * SEEDS / 10, `${res.kills} in ${SECS * SEEDS} s`);
  if (id === "hollowgrin") {
    for (const [n, min] of Object.entries(HG_FAR)) check(`hollowgrin: bots visit the ${n} (>= ${min}%)`, (res.named[n] || 0) >= min, `${res.named[n] || 0}%`);
  }
}
check("sim: no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
if (REPORT) console.log(errors.length ? `page errors: ${errors.slice(0, 3).join(" | ")}` : "");
fs.writeFileSync(path.join(os.tmpdir(), "troll-ops-bot-floors.json"), JSON.stringify(results, null, 1));

await browser.close();
server.close();
if (!REPORT) console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(!REPORT && failures ? 1 : 0);
