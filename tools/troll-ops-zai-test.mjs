// Troll Forces zombies AI + map checks (the 2026-10-31 zombie behaviour
// list). Solo, no network (Supabase blocked), so never a public room.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-zai-test.mjs <section> [maps]
//
// Sections, each its own system:
//   rebuild   the Rebuild drop only falls while a deployable is hurt, and
//             its banner says what it did
//   hud       the "N zombies left" counter counts down and hides in the break
//   hp        the health curve per wave, before and after (numbers only)
//   ai        a wave on each map: zombies spread out (no conga line), keep
//             up their speed, reach the player on every floor; crawlers
//             climb the stairs
//   turret    a turret shoots what is about to hurt you, never into a wall
//   perch     every spot a player can stand on: can a zombie get to them?
//   spawns    each map's entry points: out of sight, spread round the map
// SHOTS_DIR=<dir> for the screenshots.
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOTS_DIR || os.tmpdir();
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg", ".ktx2": "image/ktx2", ".wasm": "application/wasm" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const section = process.argv[2] || "hud";
const MAPS = (process.argv[3] || "pentagrin,hollowgrin,trollcity").split(",");
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(map) {
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/frame-ancestors|ERR_FAILED|supabase/i.test(m.text())) errors.push(m.text()); });
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
  await page.evaluate(async (map) => {
    const T = window.__trollOps;
    T.setMode("zombies");
    T.loadout.poolMapId = map;
    await T.startGame();
    if (T.isStaging?.()) T.endStaging();
    if (!T.els.pause.hidden) T.closePauseMenu();
  }, map);
  await page.waitForFunction(() => !!window.__trollOps.zdir() && window.__trollOps.zdir().round >= 1, null, { timeout: 120000 });
  // nobody gets hurt while we look (the checks drive the horde themselves)
  await page.evaluate(() => { const T = window.__trollOps; T.player.maxHp = T.player.hp = 1e9; });
  page.errors = errors;
  return page;
}
const R = (page, fn, arg) => page.evaluate(fn, arg);

/* ---------------------------------------------------------------- rebuild */
async function rebuild() {
  const page = await open(MAPS[0]);
  // no deployables hurt: a forced roll never comes up Rebuild
  const kinds = await R(page, async () => {
    const T = window.__trollOps, run = T.zrun(), D = run.drops;
    const p = T.move.pos;
    run.spawn("barricade", p.x + 5, p.y - 1.6, p.z, 0);
    const out = new Set();
    // pickKind via a forced drop on each kill: odds 1, kind left to the roll
    D.force(null, 1);
    for (let i = 0; i < 60; i++) {
      D.state.rolled = 0;
      const before = new Set(D.drops.keys());
      const z = T.zdir().summonAround({ x: p.x + 9, y: p.y - 1.6, z: p.z }, 1)[0];
      z.riseT = 0;
      z.takeDamage(z.hp + 1e6, false);
      for (let k = 0; k < 100 && !z.dropRolled; k++) await new Promise((r) => setTimeout(r, 20));
      for (const [n, d] of D.drops) if (!before.has(n)) out.add(d.kind);
      for (const n of [...D.drops.keys()]) D.drops.get(n).t = 0;
      await new Promise((r) => setTimeout(r, 20));
    }
    D.force(null, null);
    return [...out];
  });
  check(kinds.length >= 3 && !kinds.includes("rebuild"), "no hurt deployable: Rebuild never drops", kinds.join(","));
  const kinds2 = await R(page, async () => {
    const T = window.__trollOps, run = T.zrun(), D = run.drops;
    for (const e of run.dep.list) e.hp = 5;
    const out = new Set();
    D.force(null, 1);
    const p = T.move.pos;
    for (let i = 0; i < 60 && !out.has("rebuild"); i++) {
      D.state.rolled = 0;
      const before = new Set(D.drops.keys());
      const z = T.zdir().summonAround({ x: p.x + 9, y: p.y - 1.6, z: p.z }, 1)[0];
      z.riseT = 0;
      z.takeDamage(z.hp + 1e6, false);
      for (let k = 0; k < 100 && !z.dropRolled; k++) await new Promise((r) => setTimeout(r, 20));
      for (const [n, d] of D.drops) if (!before.has(n)) out.add(d.kind);
      await new Promise((r) => setTimeout(r, 20));
    }
    D.force(null, null);
    return [...out];
  });
  check(kinds2.includes("rebuild"), "a hurt barricade: Rebuild can drop", kinds2.join(","));
  // taking it: the banner says what it did
  await R(page, () => { const T = window.__trollOps, p = T.move.pos; T.zrun().drops.spawn("rebuild", p.x, p.y - 1.6, p.z); });
  await page.waitForFunction(() => /Deployables repaired/.test(document.querySelector(".zh-banner")?.textContent || ""), null, { timeout: 15000 }).catch(() => {});
  const banner = await R(page, () => document.querySelector(".zh-banner")?.textContent || "");
  check(/Rebuild! Deployables repaired/.test(banner), "the Rebuild banner says what it did", banner);
  const hp = await R(page, () => window.__trollOps.zrun().dep.list.map((e) => [e.hp, e.maxHp]));
  check(hp.every(([h, m]) => h === m), "and the barricade is back to full", JSON.stringify(hp));
  check(!page.errors.length, "no page errors", page.errors.slice(0, 3).join(" | "));
}

/* ---------------------------------------------------------------- hud */
async function hud() {
  const page = await open(MAPS[0]);
  await page.waitForFunction(() => !document.querySelector(".zh-count")?.hidden && /left/.test(document.querySelector(".zh-count")?.textContent || ""), null, { timeout: 20000 }).catch(() => {});
  const a = await R(page, () => ({ txt: document.querySelector(".zh-count")?.textContent, rem: window.__trollOps.zdir().remaining }));
  check(a.txt === `${a.rem} zombies left`, "the counter shows the wave's remaining", JSON.stringify(a));
  await page.screenshot({ path: path.join(SHOTS, "zai-hud-count.png") });
  // the top line must not overflow or overlap: measure the four boxes
  const boxes = await R(page, () => [...document.querySelectorAll(".zh-top > *")].filter((e) => !e.hidden && e.offsetWidth).map((e) => { const r = e.getBoundingClientRect(); return [e.className, Math.round(r.left), Math.round(r.right)]; }));
  const overlap = boxes.some((b, i) => i && b[1] < boxes[i - 1][2]);
  check(!overlap && boxes.every((b) => b[1] >= 0 && b[2] <= 1280), "the top line fits, nothing overlaps", JSON.stringify(boxes));
  // kill two: it counts down
  const b = await R(page, async () => {
    const T = window.__trollOps, zd = T.zdir();
    await new Promise((r) => { const w = () => (zd.aliveCount >= 2 ? r() : setTimeout(w, 100)); w(); });
    const before = zd.remaining;
    for (const z of zd.zombies.filter((q) => q.alive && !q.dying).slice(0, 2)) z.takeDamage(z.hp + 1e6, false);
    await new Promise((r) => setTimeout(r, 400));
    return { before, after: zd.remaining, txt: document.querySelector(".zh-count").textContent };
  });
  check(b.after === b.before - 2 && b.txt === `${b.after} ${b.after === 1 ? "zombie" : "zombies"} left`, "two kills: it counts down", JSON.stringify(b));
  // clear the wave: hidden in the break
  await R(page, async () => {
    const zd = window.__trollOps.zdir();
    zd.toSpawn = 0;
    for (const z of zd.zombies) if (z.alive && !z.dying) z.takeDamage(z.hp + 1e6, false);
  });
  await page.waitForFunction(() => window.__trollOps.zdir().state === "between", null, { timeout: 15000 }).catch(() => {});
  await sleep(300);
  const c = await R(page, () => ({ hidden: document.querySelector(".zh-count").hidden, state: window.__trollOps.zdir().state }));
  check(c.state === "between" && c.hidden, "in the break the counter is hidden", JSON.stringify(c));
  // phone size: still fits
  await page.setViewportSize({ width: 844, height: 390 });
  await R(page, () => window.__trollOps.zdir().skipBreak());
  await page.waitForFunction(() => !document.querySelector(".zh-count").hidden, null, { timeout: 20000 }).catch(() => {});
  await sleep(300);
  const pb = await R(page, () => [...document.querySelectorAll(".zh-top > *")].filter((e) => !e.hidden && e.offsetWidth).map((e) => { const r = e.getBoundingClientRect(); return [e.className, Math.round(r.left), Math.round(r.right)]; }));
  check(!pb.some((q, i) => i && q[1] < pb[i - 1][2]) && pb.every((q) => q[1] >= 0 && q[2] <= 844), "phone landscape: the top line fits", JSON.stringify(pb));
  await page.screenshot({ path: path.join(SHOTS, "zai-hud-count-phone.png") });
  check(!page.errors.length, "no page errors", page.errors.slice(0, 3).join(" | "));
}

/* ---------------------------------------------------------------- hp */
async function hp() {
  const page = await open(MAPS[0]);
  const t = await R(page, async () => {
    const url = new URL("assets/games/troll-ops/modes/zombies/horde.js", location.href).href;
    const boss = new URL("assets/games/troll-ops/modes/zombies/boss.js", location.href).href;
    const H = await import(url), B = await import(boss);
    const old = (r) => (r <= 9 ? 150 + (r - 1) * 100 : Math.round(950 * Math.pow(1.1, r - 9)));
    const rows = [];
    for (let r = 1; r <= 30; r++) rows.push([r, old(r), H.healthForRound(r), B.bossHealth("mini", r), H.countForRound(r)]);
    // the live horde: a wave-20 walker's health
    const zd = window.__trollOps.zdir();
    zd.round = 20;
    const z = zd.summonAround({ x: 0, y: 0, z: 0 }, 1)[0];
    const live = z.maxHp;
    z.takeDamage(z.hp + 1e6, false);
    return { rows, live };
  });
  console.log("wave  before  after  mini-boss  count");
  for (const [r, a, b, m, c] of t.rows) console.log(`${String(r).padStart(4)}  ${String(a).padStart(6)}  ${String(b).padStart(5)}  ${String(m).padStart(9)}  ${String(c).padStart(5)}`);
  const at = (r) => t.rows[r - 1];
  check(at(1)[2] === 150, "wave 1 unchanged at 150");
  check(t.rows.every((r, i) => !i || r[2] >= t.rows[i - 1][2]), "the curve never drops");
  check(at(30)[2] <= at(30)[1] * 0.4 && at(20)[2] <= at(20)[1] * 0.55, "late waves well under the old curve", `w20 ${at(20)[1]}->${at(20)[2]}, w30 ${at(30)[1]}->${at(30)[2]}`);
  check(at(30)[2] / at(1)[2] < 16, "wave 30 under 16x wave 1 (was 47x)", (at(30)[2] / at(1)[2]).toFixed(1) + "x");
  check(Math.abs(at(20)[3] / at(20)[1] - at(10)[3] / at(10)[1]) < 0.01, "bosses keep the classic curve", `mini w10 ${at(10)[3]}, w20 ${at(20)[3]}`);
  check(t.live === at(20)[2], "a live wave-20 walker spawns on the new curve", String(t.live));
  check(!page.errors.length, "no page errors", page.errors.slice(0, 3).join(" | "));
}

/* ---------------------------------------------------------------- the sim */
/* A second director on the loaded map, stepped by hand at 30 Hz with no
   rendering (the live one is stood down). `run({ points, type, n, secs,
   crawl, round, player })`: n zombies of `type` in at the given entry
   points (or the director's own pick), the player standing at `player`
   (feet) or walking a loop through `walk`; back come, per zombie, when it
   got into reach and its speed, plus the horde's bunching. */
async function installSim(page) {
  await R(page, async () => {
    const T = window.__trollOps;
    const url = performance.getEntriesByType("resource").map((e) => e.name).find((n) => /modes\/zombies\/horde\.js/.test(n));
    const H = await import(url);
    const THREE = T.THREE;
    const live = T.zdir();
    const layout = T.builtMap().map.zombieLayout();
    const stand = () => { live.clear(); live.state = "idle"; };
    stand();
    window.__zsim = {
      H, layout, live,
      floors: layout.floors || { ground: 0 },
      floorOf: (y, x, z) => (layout.floorOf || (() => "ground"))(y, x, z),
      ground: (x, z, y) => H.groundHeightAt ? H.groundHeightAt(live.colliders, x, z, y + 0.6, 0.3) : y,
      async run({ points = null, type = "walker", n = 12, secs = 40, crawl = false, round = 5, player, walk = null, stagger = 0.5, trace = 0 }) {
        const traces = [];
        stand();
        const dir = new H.ZombieDirector(new THREE.Scene(), live.arena, live.colliders, layout);
        dir.round = round;
        dir._caps(true);   // the noStand caps, as a wave puts them up
        dir.state = "fighting";
        const feet = { x: player.x, y: player.y, z: player.z };
        const eye = new THREE.Vector3(feet.x, feet.y + 1.6, feet.z);
        const queue = [];
        for (let i = 0; i < n; i++) {
          const w = points ? points[i % points.length] : dir.spawnPointFor({ x: feet.x, y: feet.y + 0.2, z: feet.z });
          queue.push(w);
        }
        const stats = [];
        let hits = 0, bunchN = 0, bunchHit = 0, t = 0, spawnT = 0;
        const dt = 1 / 30;
        const reachOf = (z) => z.type.attackRange + 0.35;
        let wi = 0;
        while (t < secs) {
          if (queue.length && (spawnT -= dt) <= 0) {
            spawnT = stagger;
            const w = queue.shift();
            const z = new H.Zombie(type, new THREE.Vector3(w.x + (Math.random() - 0.5) * 0.6, w.y, w.z + (Math.random() - 0.5) * 0.6), dir.scene, round, {});
            if (crawl) { z.makeCrawler(); if (!z.crawling) { z.crawling = true; z.speed *= H.SPECIALS_CRAWL ?? 0.42; } }
            z.hp = z.maxHp = 1e9;
            dir.zombies.push(z);
            stats.push({ z, born: t, at: null, dist: 0, moveT: 0, from: { x: w.x, z: w.z }, last: { x: w.x, z: w.z }, stillT: 0, stuck: false, angle: null });
          }
          if (walk) {
            const tgt = walk[wi % walk.length];
            const dx = tgt.x - feet.x, dz = tgt.z - feet.z, d = Math.hypot(dx, dz);
            if (d < 0.3) wi++;
            else { const s = Math.min(d, 3.0 * dt); feet.x += dx / d * s; feet.z += dz / d * s; feet.y += (tgt.y - feet.y) * Math.min(1, s / Math.max(d, 0.01)); }
            eye.set(feet.x, feet.y + 1.6, feet.z);
          }
          dir.update(dt, eye, () => { hits++; }, feet.y);
          const moving = [];
          for (const s of stats) {
            const z = s.z, p = z.mesh.position;
            const d = Math.hypot(p.x - feet.x, p.z - feet.z);
            const near = d <= reachOf(z) && Math.abs(z.groundY - feet.y) < 1.3;
            if (near && s.at == null) { s.at = t - s.born; s.angle = Math.atan2(p.z - feet.z, p.x - feet.x); }
            if (!near) {
              const step = Math.hypot(p.x - s.last.x, p.z - s.last.z);
              s.dist += step; s.moveT += dt;
              moving.push(z);
              s.stillT = step < 0.6 * dt ? s.stillT + dt : 0;   // under 0.6 m/s
              if (s.stillT > 6) s.stuck = true;
            } else s.stillT = 0;
            s.last = { x: p.x, z: p.z };
          }
          for (const a of moving) {
            let nd = Infinity;
            for (const b of moving) if (a !== b) nd = Math.min(nd, Math.hypot(a.mesh.position.x - b.mesh.position.x, a.mesh.position.z - b.mesh.position.z));
            if (nd < Infinity) { bunchN++; if (nd < 0.8) bunchHit++; }
          }
          if (trace && Math.abs(t - Math.round(t)) < dt / 2) traces.push(stats.slice(0, trace).map((s) => { const q = s.z.mesh.position; return [Math.round(t), +q.x.toFixed(1), +s.z.groundY.toFixed(1), +q.z.toFixed(1), s.z.climb ? "C" : "", s.at != null ? "R" : ""].join(","); }).join(" | "));
          t += dt;
          if (((t / dt) | 0) % 60 === 0) await new Promise((r) => setTimeout(r, 0));
        }
        const out = stats.map((s) => ({ at: s.at == null ? null : +s.at.toFixed(1), speed: +(s.dist / Math.max(s.moveT, 0.01)).toFixed(2), stuck: s.stuck, angle: s.angle, end: { x: +s.z.mesh.position.x.toFixed(1), y: +s.z.groundY.toFixed(2), z: +s.z.mesh.position.z.toFixed(1) }, base: +s.z.speed.toFixed(2) }));
        for (const z of dir.zombies) z.dispose(dir.scene);
        dir._caps(false);
        const sectors = new Set(out.filter((o) => o.angle != null).map((o) => Math.floor(((o.angle + Math.PI) / (Math.PI * 2)) * 8) % 8)).size;
        return { traces, zs: out, bunch: bunchN ? +(bunchHit / bunchN).toFixed(2) : 0, hits, sectors };
      },
    };
  });
}

/* Test spots per map: where the player spawns, each stair top, and a few
   far corners of the ground the horde must find a way to. */
async function spotsFor(page) {
  return R(page, () => {
    const T = window.__trollOps, S = window.__zsim;
    const out = [];
    const p = T.move.pos;   // the feet
    out.push({ name: "spawn", x: p.x, y: p.y, z: p.z });
    (S.layout.links || []).forEach((l, i) => out.push({ name: `stair${i} top (${l.to})`, x: l.b.x, y: S.floors[l.to] ?? 0, z: l.b.z }));
    return out.map((s) => ({ ...s, x: +s.x.toFixed(2), y: +s.y.toFixed(2), z: +s.z.toFixed(2) }));
  });
}

/* ---------------------------------------------------------------- ai */
async function ai() {
  const summary = [];
  for (const map of MAPS) {
    const page = await open(map);
    await installSim(page);
    const spots = await spotsFor(page);
    for (const spot of spots) {
      for (const [type, round, crawl] of [["walker", 3, false], ["walker", 15, false], ["walker", 8, true]]) {
        const r = await R(page, (a) => window.__zsim.run(a), { player: spot, type, round, crawl, n: crawl ? 4 : 12, secs: +(process.env.SECS || (crawl ? 120 : 90)) });
        const got = r.zs.filter((z) => z.at != null);
        const ts = got.map((z) => z.at).sort((a, b) => a - b);
        const med = ts.length ? ts[ts.length >> 1] : null;
        const sp = r.zs.map((z) => z.speed).sort((a, b) => a - b);
        const row = { map, spot: spot.name, kind: crawl ? "crawler" : `${type} w${round}`, reached: `${got.length}/${r.zs.length}`, medianS: med, speed: sp[sp.length >> 1], base: r.zs[0]?.base, bunch: r.bunch, sectors: r.sectors, stuck: r.zs.filter((z) => z.stuck).length };
        summary.push(row);
        console.log(JSON.stringify(row));
        const lost = r.zs.filter((z) => z.at == null);
        if (lost.length) console.log("   not there:", JSON.stringify(lost.slice(0, 4).map((z) => z.end)));
        check(got.length === r.zs.length, `${map} ${spot.name} ${row.kind}: every zombie gets to the player`, row.reached);
        if (!crawl) check(r.bunch <= 0.35, `${map} ${spot.name} ${row.kind}: no conga line`, `bunched ${r.bunch}`);
        if (!crawl) check(row.speed >= r.zs[0].base * 0.7, `${map} ${spot.name} ${row.kind}: keeps up its speed`, `${row.speed} of ${row.base} m/s`);
      }
    }
    check(!page.errors.length, `${map}: no page errors`, page.errors.slice(0, 3).join(" | "));
    await page.close();
  }
  fs.writeFileSync(path.join(SHOTS, `zai-ai-${process.env.TAG || "run"}.json`), JSON.stringify(summary, null, 1));
}

async function debug() {
  const page = await open(MAPS[0]);
  await installSim(page);
  if (process.env.BOX) {
    const [x0, x1, z0, z1] = process.env.BOX.split(",").map(Number);
    const cs = await R(page, (b) => window.__zsim.live.colliders.filter((c) => c.max.x > b[0] && c.min.x < b[1] && c.max.z > b[2] && c.min.z < b[3] && c.max.y > -0.5)
      .map((c) => [c.min.x, c.max.x, c.min.y, c.max.y, c.min.z, c.max.z].map((v) => +v.toFixed(2)).join(" ")), [x0, x1, z0, z1]);
    console.log(cs.join("\n"));
    return;
  }
  const spots = await spotsFor(page);
  const which = (process.env.SPOTS || '1').split(',').map(Number);
  for (const i of which) {
    const r = await R(page, (a) => window.__zsim.run(a), { player: spots[i], n: 3, secs: +(process.env.SECS || 40), trace: 3, crawl: !!process.env.CRAWL });
    console.log(spots[i].name, JSON.stringify(spots[i]));
    console.log(r.traces.join("\n"));
  }
}
/* ---------------------------------------------------------------- turret */
/* On each map, on the live horde (stood down, its zombies planted with
   holdT so they stay put): a turret between two zombies goes for the one
   by the player, not the one by itself; aims low at a crawler; and never
   fires at one behind a wall. */
async function turret() {
  for (const map of MAPS) {
    const page = await open(map);
    const r = await R(page, async () => {
      const T = window.__trollOps, zd = T.zdir(), run = T.zrun();
      zd.clear(); zd.state = "idle";
      const sleep = (ms) => new Promise((q) => setTimeout(q, ms));
      const f = T.move.pos;
      const ground = f.y;
      // the open side: the direction with the longest clear run from the player
      const H = await import(performance.getEntriesByType("resource").map((e) => e.name).find((n) => /modes\/zombies\/horde\.js/.test(n)));
      let ang = 0, bestRun = -1;
      for (let a = 0; a < 16; a++) {
        const th = (a / 16) * Math.PI * 2;
        let k = 0;
        while (k < 14 && H.lineClear(zd.colliders, f, { x: f.x + Math.cos(th) * (k + 1), z: f.z + Math.sin(th) * (k + 1) }, ground)) k++;
        if (k > bestRun) { bestRun = k; ang = th; }
      }
      const ux = Math.cos(ang), uz = Math.sin(ang);
      const at = (d, side = 0) => ({ x: f.x + ux * d - uz * side, z: f.z + uz * d + ux * side });
      const put = (p, crawl = false) => {
        const z = new H.Zombie("walker", new T.THREE.Vector3(p.x, ground, p.z), T.scene, 5, {});
        z.hp = z.maxHp = 1e7; z.holdT = 1e9;
        if (crawl) z.makeCrawler();
        zd.zombies.push(z);
        return z;
      };
      // turret 4 m out; A beside the turret (6.5 m from the player), B 1.6 m from the player
      const tp = at(4, 0.8);
      const tur = run.spawn("turret", tp.x, ground, tp.z, 0);
      const until = async (fn, ms) => { const t = performance.now(); while (!fn() && performance.now() - t < ms) await sleep(100); return fn(); };
      await until(() => tur.armed, 15000);
      const A = put(at(6.5, 0.8));
      const B = put(at(1.6, -0.9));
      let onB = 0, onA = 0;
      for (let i = 0; i < 40; i++) { if (tur.target === B) onB++; else if (tur.target === A) onA++; await sleep(80); }
      const pick1 = { onB, onA, shots: tur.shots };
      // a crawler: aimed low
      A.dispose(T.scene); B.dispose(T.scene); zd.zombies = [];
      const C = put(at(2.4, 0.8), true);
      await until(() => tur.target === C, 8000);
      const aimY = tur.target === C ? +(tur.aimPoint(C).y - ground).toFixed(2) : null;
      const crawling = !!C.crawling;
      C.dispose(T.scene); zd.zombies = [];
      // a real wave on the move: every shot checked against the map's boxes
      // on its own (a 3D segment-box test), so none goes into a wall
      const boxes = zd.colliders.filter((c) => !c.deploy);
      const blocked = (a, b) => {
        for (const c of boxes) {
          const inA = a.x > c.min.x && a.x < c.max.x && a.y > c.min.y && a.y < c.max.y && a.z > c.min.z && a.z < c.max.z;
          const inB = b.x > c.min.x && b.x < c.max.x && b.y > c.min.y && b.y < c.max.y && b.z > c.min.z && b.z < c.max.z;
          if (inA || inB) continue;
          let t0 = 0, t1 = 1, ok = true;
          for (const k of ["x", "y", "z"]) {
            const d = b[k] - a[k];
            if (Math.abs(d) < 1e-9) { if (a[k] < c.min[k] || a[k] > c.max[k]) { ok = false; break; } continue; }
            let u = (c.min[k] - a[k]) / d, v = (c.max[k] - a[k]) / d;
            if (u > v) [u, v] = [v, u];
            t0 = Math.max(t0, u); t1 = Math.min(t1, v);
            if (t0 > t1) { ok = false; break; }
          }
          // a hit only counts well short of the target (its own feet's box aside)
          if (ok && t0 < 0.93) return true;
        }
        return false;
      };
      let wallShots = 0, waveShots = 0;
      const fire = tur.fire.bind(tur);
      tur.fire = () => {
        waveShots++;
        if (blocked(tur.muzzle, tur.aimPoint(tur.target).clone())) wallShots++;
        fire();
      };
      zd.startRound(8);
      await sleep(15000);
      zd.clear(); zd.state = "idle";
      const hiddenTarget = false;
      return { pick1, aimY, crawling, wallShots, waveShots, run: bestRun };
    });
    console.log(map, JSON.stringify(r));
    check(r.pick1.onB > r.pick1.onA * 3 && r.pick1.shots > 0, `${map}: the turret shoots the one by the player, not the one by itself`, JSON.stringify(r.pick1));
    check(r.aimY != null && r.aimY < 0.6, `${map}: a crawler is aimed at low`, `aim ${r.aimY} m up`);
    check(r.waveShots > 0 && r.wallShots === 0, `${map}: a wave on the move, no shot into a wall`, `${r.wallShots} of ${r.waveShots} shots blocked`);
    await page.screenshot({ path: path.join(SHOTS, `zai-turret-${map}.png`) });
    check(!page.errors.length, `${map}: no page errors`, page.errors.slice(0, 3).join(" | "));
    await page.close();
  }
}

/* ---------------------------------------------------------------- spawns */
/* Each map's entry points, picked 40 times from each test spot by the
   director, against the old pick (four random draws, farthest past 6 m):
   how many land in the player's sight within 18 m, the nearest, and how
   many different points get used. */
async function spawns() {
  for (const map of MAPS) {
    const page = await open(map);
    await installSim(page);
    const spots = await spotsFor(page);
    const r = await R(page, (spots) => {
      const S = window.__zsim, H = S.H, live = S.live;
      const dir = new H.ZombieDirector(new window.__trollOps.THREE.Scene(), live.arena, live.colliders, S.layout);
      const old = (feet) => {
        const floor = dir.floorOf(feet.y, feet.x, feet.z);
        const here = dir.windows.filter((w) => dir.floorOf(w.y + 0.2, w.x, w.z) === floor);
        const pool = here.length ? here : dir.windows;
        const ideal = S.layout.preferDist || 0;
        let best = null, bs = -Infinity;
        for (let i = 0; i < (ideal ? 6 : 4); i++) {
          const w = pool[Math.floor(Math.random() * pool.length)];
          const d = Math.hypot(w.x - feet.x, w.z - feet.z);
          const sc = ideal ? (d < 7 ? d - 100 : -Math.abs(d - ideal)) : (d > 6 ? d : -d);
          if (sc > bs) { bs = sc; best = w; }
        }
        return best;
      };
      const rate = (pick, feet) => {
        let seen = 0, near = Infinity, repeat = 0, last = null;
        const used = new Set();
        for (let i = 0; i < 40; i++) {
          const w = pick(feet);
          const d = Math.hypot(w.x - feet.x, w.z - feet.z);
          near = Math.min(near, d);
          if (d < 18 && H.lineClear(live.colliders, feet, w, Math.min(feet.y, w.y))) seen++;
          if (w === last) repeat++;
          last = w;
          used.add(w);
        }
        return { seen, near: +near.toFixed(1), used: used.size, repeat };
      };
      return { total: dir.windows.length, rows: spots.map((sp) => {
        const feet = { x: sp.x, y: sp.y + 0.2, z: sp.z };
        dir.recentSpawns = [];
        return { spot: sp.name, before: rate(old, feet), after: rate((f) => dir.spawnPointFor(f), feet) };
      }) };
    }, spots);
    console.log(`${map}: ${r.total} entry points`);
    for (const row of r.rows) {
      console.log(`  ${row.spot.padEnd(22)} before ${JSON.stringify(row.before)}  after ${JSON.stringify(row.after)}`);
      check(row.after.seen <= row.before.seen && row.after.seen <= 4, `${map} ${row.spot}: spawns out of sight (in sight ${row.before.seen}/40 -> ${row.after.seen}/40)`);
      check(row.after.near >= 6, `${map} ${row.spot}: none on top of the player`, `nearest ${row.after.near} m`);
      check(row.after.repeat <= 2, `${map} ${row.spot}: not the same point twice running`, `repeats ${row.before.repeat} -> ${row.after.repeat}`);
    }
    check(!page.errors.length, `${map}: no page errors`, page.errors.slice(0, 3).join(" | "));
    await page.close();
  }
}

/* ---------------------------------------------------------------- perch */
/* Every top a player can stand on (room for a body, headroom over it) and
   get up onto (mantles of at most 1.55 m, chained from the floors: a
   zombies run measures them from the ground, movement.js mantleFromGround),
   then the worst of them by height and size: the player stood in the
   middle, four walkers 4-6 m off, with the old horde (no climbing) and the
   new. Each must end with a zombie in swiping reach. PERCH_N per map. */
async function perch() {
  const N = +(process.env.PERCH_N || 14);
  for (const map of MAPS) {
    const page = await open(map);
    await installSim(page);
    const found = await R(page, () => {
      const S = window.__zsim, cols = S.live.colliders.filter((c) => !c.deploy && !c.moving);
      const floors = Object.values(S.floors);
      const A = S.live.arena;
      const tops = [];
      for (const c of cols) {
        const w = c.max.x - c.min.x, d = c.max.z - c.min.z, y = c.max.y;
        if (w < 0.7 || d < 0.7 || w * d > 120) continue;                 // a slab that big is a floor
        if (c.min.x < A.minX || c.max.x > A.maxX || c.min.z < A.minZ || c.max.z > A.maxZ) continue;
        if (floors.some((f) => Math.abs(y - f) < 0.35)) continue;          // a floor (or a step on one)
        const cx = (c.min.x + c.max.x) / 2, cz = (c.min.z + c.max.z) / 2;
        const blocked = cols.some((o) => o !== c && o.min.y < y + 1.7 && o.max.y > y + 0.05 && cx > o.min.x - 0.3 && cx < o.max.x + 0.3 && cz > o.min.z - 0.3 && cz < o.max.z + 0.3);
        if (blocked) continue;
        // capped for the run (layout.noStand): nobody stands there
        if ((S.layout.noStand || []).some((b) => cx > b.x0 && cx < b.x1 && cz > b.z0 && cz < b.z1 && Math.abs(y - b.y) < 0.05)) continue;
        tops.push({ c, x: cx, z: cz, y, w, d, ok: false });
      }
      // reach: from a floor (a floor height under it), then top to top
      const gap = (a, b) => Math.max(0, a.c.min.x - b.c.max.x, b.c.min.x - a.c.max.x) + Math.max(0, a.c.min.z - b.c.max.z, b.c.min.z - a.c.max.z);
      for (const t of tops) {
        // the floor right under it: the highest floor-height top below its middle
        const under = cols.reduce((m, c) => (c.max.y < t.y - 0.3 && c.max.y > m && floors.some((f) => Math.abs(c.max.y - f) < 0.35)
          && t.x > c.min.x && t.x < c.max.x && t.z > c.min.z && t.z < c.max.z ? c.max.y : m), 0);
        t.under = under;
        t.rise = t.y - under;
        t.ok = t.rise <= 1.55;
      }
      for (let pass = 0, more = true; more && pass < 8; pass++) {
        more = false;
        for (const t of tops) {
          if (t.ok) continue;
          // up a mantle, or down a drop of the same, never through a floor between
          const through = (u) => floors.some((f) => f > Math.min(t.y, u.y) + 0.1 && f < Math.max(t.y, u.y) - 0.1);
          if (tops.some((u) => u.ok && Math.abs(t.y - u.y) <= 1.55 && gap(t, u) <= 0.9 && !through(u))) { t.ok = true; more = true; }
        }
      }
      // the camping spots: the middle is out of a floor zombie's swipe
      const camp = tops.filter((t) => t.ok && (t.rise > 1.3 || Math.min(t.w, t.d) / 2 > 1.0));
      camp.sort((a, b) => b.rise * Math.min(b.w, b.d) - a.rise * Math.min(a.w, a.d));
      const pick = [];
      for (const t of camp) if (!pick.some((q) => Math.hypot(q.x - t.x, q.z - t.z) < 3)) pick.push(t);
      return { tops: tops.length, reach: tops.filter((t) => t.ok).length, camp: camp.length, pick: pick.map((t) => ({ x: +t.x.toFixed(2), y: +t.y.toFixed(2), z: +t.z.toFixed(2), rise: +t.rise.toFixed(2), under: +t.under.toFixed(2), w: +t.w.toFixed(1), d: +t.d.toFixed(1) })) };
    });
    const caps = await R(page, async () => {
      const T = window.__trollOps, S = window.__zsim, m = T.move;
      const dir = new S.H.ZombieDirector(new T.THREE.Scene(), S.live.arena, S.live.colliders, S.layout);
      dir._caps(true);
      const out = [];
      const save = m.pos.clone(), g = m.grounded;
      for (const b of S.layout.noStand || []) {
        const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
        let any = 0;
        // from each side, 0.5 m off, facing in, on the ground and mid-jump
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const x = dx ? (dx > 0 ? b.x1 + 0.5 : b.x0 - 0.5) : cx, z = dz ? (dz > 0 ? b.z1 + 0.5 : b.z0 - 0.5) : cz;
          for (const air of [0, 1.1]) {
            m.pos.set(x, air, z); m.grounded = !air;
            if (m.findVault(new T.THREE.Vector3(-dx, 0, -dz))) any++;
          }
        }
        out.push(any);
      }
      m.pos.copy(save); m.grounded = g;
      dir._caps(false);
      return out;
    });
    caps.forEach((n, i) => check(n === 0, `${map}: capped top ${i}: no mantle onto it from any side`, `${n} of 8 tries`));
    console.log(`${map}: ${found.tops} standable tops, ${found.reach} a player can reach, ${found.camp} out of a floor zombie's swipe; trying ${Math.min(N, found.pick.length)}`);
    let before = 0, after = 0, tried = 0;
    for (const t of found.pick.slice(0, N)) {
      const res = await R(page, async (t) => {
        const S = window.__zsim, H = S.H, cols = S.live.colliders;
        // four walkers on open floor 4-6 m round it, each with a clear line in
        const pts = [];
        const under = t.under;
        for (let a = 0; a < 48 && pts.length < 4; a++) {
          const th = (a * 2.39996) % (Math.PI * 2), r = 4 + (a % 3);
          const x = t.x + Math.cos(th) * r, z = t.z + Math.sin(th) * r;
          const gy = cols.reduce((m, c) => (c.max.y <= under + 0.5 && x > c.min.x && x < c.max.x && z > c.min.z && z < c.max.z ? Math.max(m, c.max.y) : m), under);
          if (Math.abs(gy - under) > 0.35) continue;
          if (cols.some((c) => c.min.y < gy + 1.7 && c.max.y > gy + 0.4 && x > c.min.x - 0.4 && x < c.max.x + 0.4 && z > c.min.z - 0.4 && z < c.max.z + 0.4)) continue;
          pts.push({ x, y: gy, z });
        }
        if (pts.length < 2) return null;
        const out = {};
        for (const climb of [false, true]) {
          H.HORDE_FX.noClimb = !climb;
          const r = await S.run({ points: pts, n: 4, secs: 30, player: { x: t.x, y: t.y, z: t.z }, stagger: 0.3 });
          out[climb ? "after" : "before"] = r.zs.filter((q) => q.at != null).length;
        }
        H.HORDE_FX.noClimb = false;
        return out;
      }, t);
      if (!res) { console.log(`   ${JSON.stringify(t)}  no open floor round it, skipped`); continue; }
      tried++;
      if (res.before) before++;
      if (res.after) after++;
      console.log(`   ${JSON.stringify(t)}  zombies in reach: old ${res.before}/4, new ${res.after}/4`);
      check(res.after > 0, `${map} perch (${t.x}, ${t.y}, ${t.z}) rise ${t.rise} m: a zombie gets to you`);
    }
    console.log(`${map}: perches a zombie gets to: old ${before}/${tried}, new ${after}/${tried}`);
    check(!page.errors.length, `${map}: no page errors`, page.errors.slice(0, 3).join(" | "));
    await page.close();
  }
}

/* ---------------------------------------------------------------- look */
/* The sentry gun 3 m in front of the camera with a walker beside it, for
   a look at its size and its barrels spinning (two screenshots per map). */
async function look() {
  for (const map of MAPS) {
    const page = await open(map);
    const r = await R(page, async () => {
      const T = window.__trollOps, zd = T.zdir(), run = T.zrun();
      zd.clear(); zd.state = "idle";
      const sleep = (ms) => new Promise((q) => setTimeout(q, ms));
      const H = await import(performance.getEntriesByType("resource").map((e) => e.name).find((n) => n.includes("modes/zombies/horde.js")));
      const f = T.move.pos;
      const d = new T.THREE.Vector3();
      T.camera.getWorldDirection(d); d.y = 0; d.normalize();
      const at = (k, side) => ({ x: f.x + d.x * k - d.z * side, z: f.z + d.z * k + d.x * side });
      const tp = at(3, 0.4);
      const tur = run.spawn("turret", tp.x, f.y, tp.z, Math.atan2(d.x, d.z));
      const zp = at(3.4, -0.9);
      const z = new H.Zombie("walker", new T.THREE.Vector3(zp.x, f.y, zp.z), T.scene, 3, {});
      z.hp = z.maxHp = 1e7; z.holdT = 1e9;
      zd.zombies.push(z);
      const t0 = performance.now();
      while (!tur.armed && performance.now() - t0 < 15000) await sleep(100);
      // something to shoot at, off to the side, so the barrels spin
      const tgt = at(9, 3.5);
      const y = new H.Zombie("walker", new T.THREE.Vector3(tgt.x, f.y, tgt.z), T.scene, 3, {});
      y.hp = y.maxHp = 1e7; y.holdT = 1e9;
      zd.zombies.push(y);
      await sleep(2500);
      return { spin: +tur.spinV.toFixed(1), barrels: !!tur.barrels, h: +(new T.THREE.Box3().setFromObject(tur.root).max.y - f.y).toFixed(2) };
    });
    console.log(map, JSON.stringify(r));
    check(r.barrels && r.spin > 10, `${map}: the barrels spin while it fires`, `${r.spin} rad/s`);
    check(r.h > 1.15 && r.h < 1.45, `${map}: BO2 size, about 1.3 m to the camera`, `${r.h} m`);
    await page.screenshot({ path: path.join(SHOTS, `zai-sentry-${map}.png`) });
    await page.close();
  }
}

const SECTIONS = { rebuild, hud, hp, ai, debug, turret, spawns, perch, look };
if (!SECTIONS[section]) { console.log(`unknown section ${section}: ${Object.keys(SECTIONS).join(" ")}`); process.exit(2); }
try { await SECTIONS[section](); } catch (e) { check(false, "threw", String(e?.stack || e)); }
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
