// Troll Forces zombies late-wave threats check (design doc phase M2,
// modes/zombies/specials.js). Solo on Hollowgrin, no network:
//   1. Each spawns in its own body: the spitter's and the bloater's GLBs, the
//      armoured walker with its helmet and vest pinned on.
//   2. The spitter, ten metres off with a clear line, rears back and lobs a
//      glob that splashes where you stood (you're hurt) and leaves a pool.
//   3. The bloater bursts when it dies: you're hurt within its radius and a
//      barricade beside it is wrecked; walking up to you, it bursts by itself.
//   4. The armoured: a headshot is mostly stopped until the helmet flies off,
//      then a headshot lands in full; a body shot is cut by the vest.
//   5. A heavy hit that leaves a walker badly hurt can take its legs: it
//      crawls (the crawl clip, the legs gone).
//   6. Co-op, two tabs on a PRIVATE code (never a public room): the host's
//      spit flies on B's screen, its crawler crawls there, its helmet comes
//      off there, its bloater bursts there.
// Close-up screenshots of each for a look.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-zenemies-test.mjs
//   SHOTS_DIR=<dir>
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// zombie-models.js at the tag horde.js imports it by (the game's own copy)
const ZM_TAG = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/modes/zombies/horde.js"), "utf8").match(/zombie-models\.js\?v=([^"]+)"/)[1];
const SHOTS = process.env.SHOTS_DIR || os.tmpdir();
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];

async function open(label, room = "", { end = true } = {}) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/frame-ancestors|ERR_FAILED|supabase/i.test(m.text())) errors.push(`${label}: ${m.text()}`); });
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
  await page.evaluate(async ({ room, quiet }) => {
    const T = window.__trollOps;
    if (quiet) T.composer.render = () => {};
    T.setMode("zombies");
    if (room) { T.els.room.value = room; T.els.room.dispatchEvent(new Event("input")); }
    T.loadout.poolMapId = "hollowgrin";
    await T.startGame();
  }, { room, quiet: label === "A" });
  const t0 = Date.now();
  while (Date.now() - t0 < 240000 && await page.evaluate(() => window.__trollOps.loadState().open)) await sleep(250);
  if (end) await page.evaluate(() => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); if (!T.els.pause.hidden) T.closePauseMenu(); });
  return page;
}
const R = (p, fn, arg) => p.evaluate(fn, arg);
const until = (p, fn, arg, ms = 15000) => p.waitForFunction(fn, arg, { timeout: ms, polling: 100 }).then(() => true).catch(() => false);

/* Bring one of `type` in: the director spawns it; we stand it `d` metres in
   front of us (on the open lawn) and hand back its id. */
async function bring(p, type, d = 4, freeze = false) {
  // (a cleared wave spawns nothing: keep this one going)
  await R(p, (type) => { const z = window.__trollOps.zdir(); z.forceType = type; z.toSpawn = Math.max(z.toSpawn, 4); if (z.state === "between") { z.state = "fighting"; } }, type);
  const ok = await until(p, (type) => window.__trollOps.zdir().zombies.some((q) => q.type.id === type && q.alive && !q.dying && q.riseT <= 0 && !q.placed), type, 60000);
  return R(p, ([type, d, freeze]) => {
    const T = window.__trollOps, zd = T.zdir();
    zd.forceType = null;
    const z = zd.zombies.find((q) => q.type.id === type && q.alive && !q.dying && q.riseT <= 0 && !q.placed);
    if (!z) return null;
    z.placed = true;
    const pos = T.move.pos;
    z.mesh.position.set(pos.x, z.groundY, pos.z - d);
    if (freeze) z.speed = 0;   // stood still for a look (a bloater would walk up and burst)
    return z.id;
  }, [type, d, freeze]).then((id) => (ok ? id : null));
}
const zom = (p, id, fn) => R(p, ([id, src]) => { const z = window.__trollOps.zdir().zombies.find((q) => q.id === id); return z ? new Function("z", "T", src)(z, window.__trollOps) : null; }, [id, fn]);
/* Everyone else out of the way (and no new ones), so a check is about one. */
const clearOthers = (p, keep = []) => R(p, (keep) => {
  const zd = window.__trollOps.zdir();
  zd.toSpawn = 0;
  for (const z of zd.zombies) if (!keep.includes(z.id) && z.alive && !z.dying) { z.killCash = 0; z.takeDamage(z.hp + 1e6, false); }
}, keep);
/* A close-up of zombie `id`, lit by a fill light at the camera (the night
   maps are too dark to judge a body by), then the light goes. */
async function closeUp(p, id, name) {
  await zom(p, id, "const T2 = T.THREE, sc = z.mesh.parent, c = T.camera; const l = new T2.PointLight(0xfff1dd, 30, 9, 1.5); l.name = 'testFill'; c.getWorldPosition(l.position); l.position.y += 0.4; sc.add(l); const h = new T2.HemisphereLight(0xdfe8ff, 0x403830, 1.2); h.name = 'testFill'; sc.add(h); return 1");
  await sleep(500);
  await p.screenshot({ path: path.join(SHOTS, `zenemies-${name}.png`) });
  await zom(p, id, "const sc = z.mesh.parent; for (const o of sc.children.filter((q) => q.name === 'testFill')) sc.remove(o); return 1");
}
const heal = (p) => R(p, () => { const T = window.__trollOps; T.player.hp = T.player.maxHp; });

// ---- solo (COOP_ONLY=1 skips it)
if (!process.env.COOP_ONLY) {
const page = await open("solo");
// the late waves (14 +), clear of the opening wave
await R(page, () => window.__trollOps.zrun().forceWave(20));
// the late waves' bodies load as the run nears them: wait for them (the
// game's own spawns do; a forced type doesn't)
await R(page, async (tag) => { const zm = await import(`/assets/games/troll-ops/characters/zombie-models.js?v=${tag}`); await zm.preloadLateLooks(); }, ZM_TAG);
await sleep(500);
await R(page, () => { const T = window.__trollOps; T.move.pos.set(-4, T.move.pos.y, 18); T.look.yaw = 0; T.look.pitch = 0; });
await sleep(300);

// 1 + 2: the spitter
let sp = await bring(page, "spitter", 10);
check(!!sp, "a spitter comes in");
await clearOthers(page, [sp]);
const spLook = await zom(page, sp, "return z.look");
check(spLook === "spitter", "in its own body", spLook);
await heal(page);
const hp0 = await R(page, () => window.__trollOps.player.hp);
const spat = await until(page, () => window.__trollOps.zrun().specials.globs.length > 0, null, 12000);
check(spat, "it spits a glob from ten metres");
const stayed = await zom(page, sp, "const p = T.move.pos; return Math.hypot(z.mesh.position.x - p.x, z.mesh.position.z - p.z)");
check(stayed > 4.5, "and keeps its distance doing it", `${stayed?.toFixed?.(1)} m`);
await sleep(250);
await page.screenshot({ path: path.join(SHOTS, "zenemies-spitter-spit.png") });
const pooled = await until(page, () => window.__trollOps.zrun().specials.pools.length > 0, null, 5000);
check(pooled, "the glob splashes down and leaves a pool");
const hp1 = await R(page, () => window.__trollOps.player.hp);
check(hp1 < hp0, "where you stood: you're hurt", `${hp0} -> ${hp1}`);
await R(page, () => { const T = window.__trollOps; T.look.pitch = -0.6; });
await sleep(300);
await page.screenshot({ path: path.join(SHOTS, "zenemies-acid-pool.png") });
await zom(page, sp, "T.move.pos.set(z.mesh.position.x, T.move.pos.y, z.mesh.position.z + 2.2); T.look.yaw = 0; T.look.pitch = 0.05; z.placed = true; z.spitCd = 99; return 1");
await closeUp(page, sp, "spitter");
await zom(page, sp, "z.takeDamage(z.hp + 1, false); return 1");

// 3: the bloater
await heal(page);
let bl = await bring(page, "bloater", 3.2, true);
check(!!bl, "a bloater comes in");
await clearOthers(page, [bl]);
check(await zom(page, bl, "return z.look") === "bloater", "in its own body");
await zom(page, bl, "T.move.pos.set(z.mesh.position.x, T.move.pos.y, z.mesh.position.z + 2.6); T.look.yaw = 0; T.look.pitch = 0.05; return 1");
await closeUp(page, bl, "bloater");
const barr = await R(page, () => { const T = window.__trollOps, z = T.zdir().zombies.find((q) => q.type.id === "bloater" && q.alive); const e = T.zrun().spawn("barricade", z.mesh.position.x + 2, z.groundY, z.mesh.position.z, 0); return e.did ?? e.hp; });
const hpB0 = await R(page, () => window.__trollOps.player.hp);
await zom(page, bl, "z.takeDamage(z.hp + 1, false); return 1");
await sleep(400);
await page.screenshot({ path: path.join(SHOTS, "zenemies-bloater-burst.png") });
const hpB1 = await R(page, () => window.__trollOps.player.hp);
check(hpB1 < hpB0, "it bursts when it dies: you're hurt beside it", `${hpB0} -> ${hpB1}`);
const depB = await R(page, () => window.__trollOps.zrun().dep.list.map((e) => [e.alive, e.hp, e.maxHp]));
check(depB.length && depB.every(([alive, h, m]) => !alive || h < m), "and the barricade by it is wrecked", JSON.stringify(depB));
// walking up to you, it goes up by itself
await heal(page);
bl = await bring(page, "bloater", 6);
await clearOthers(page, [bl]);
const popped = await until(page, () => !window.__trollOps.zdir().zombies.some((q) => q.type.id === "bloater" && q.alive && !q.dying), null, 20000);
check(popped, "reaching you, it bursts by itself");

// 4: the armoured
await heal(page);
let ar = await bring(page, "armoured", 3);
check(!!ar, "an armoured one comes in");
await clearOthers(page, [ar]);
const kit = await until(page, (id) => { const z = window.__trollOps.zdir().zombies.find((q) => q.id === id); return !!(z?.helmet && z?.vest); }, ar, 15000);
check(kit, "helmet and vest on");
check(await zom(page, ar, "return z.look") === "walker", "on the walker's body");
await zom(page, ar, "z.speed = 0; T.move.pos.set(z.mesh.position.x + 1.2, T.move.pos.y, z.mesh.position.z + 1.8); T.look.yaw = Math.atan2(1.2, 1.8); T.look.pitch = 0.08; return 1");
await closeUp(page, ar, "armoured");
const head1 = await zom(page, ar, "const h0 = z.hp; z.takeDamage(100, true); return h0 - z.hp");
check(head1 > 0 && head1 <= 20, "a headshot is mostly stopped by the helmet", `-${head1}`);
const body1 = await zom(page, ar, "const h0 = z.hp; z.takeDamage(100, false); return h0 - z.hp");
check(Math.abs(body1 - 60) < 1, "a body shot is cut by the vest", `-${body1}`);
await zom(page, ar, "z.takeDamage(z.helmetHp + 1, true); return 1");
check(await zom(page, ar, "return !z.helmet && z.helmetHp <= 0"), "enough headshots knock the helmet off");
check(await R(page, () => window.__trollOps.zrun().specials.debris.length > 0), "it flies off");
await sleep(250);
await page.screenshot({ path: path.join(SHOTS, "zenemies-helmet-off.png") });
const head2 = await zom(page, ar, "z.hp = z.maxHp; const h0 = z.hp; z.takeDamage(100, true); return h0 - z.hp");
check(Math.abs(head2 - 100) < 1, "then a headshot lands in full", `-${head2}`);
await zom(page, ar, "z.takeDamage(z.hp + 1, false); return 1");

// 5: the crawler
await R(page, () => { window.__trollOps.zrun().specials.SPECIALS.crawl.odds = 1; });
const wk = await bring(page, "walker", 3);
await clearOthers(page, [wk]);
await zom(page, wk, "z.takeDamage(z.maxHp * 0.7, false); return 1");
const crawl = await zom(page, wk, "return { on: !!z.crawling, clip: z.animName, legs: z.body.bones.thigh_l.scale.x }");
check(crawl?.on && crawl.clip === "crawl", "a heavy hit takes its legs: it crawls", JSON.stringify(crawl));
await sleep(500);
check(await zom(page, wk, "return z.body.bones.thigh_l.scale.x < 0.01"), "the legs are gone");
await zom(page, wk, "T.move.pos.set(z.mesh.position.x + 1.5, T.move.pos.y, z.mesh.position.z + 2); T.look.yaw = Math.atan2(1.5, 2); T.look.pitch = -0.35; return 1");
await closeUp(page, wk, "crawler");
await R(page, () => { window.__trollOps.zrun().specials.SPECIALS.crawl.odds = 0.35; });
await page.close();
}

// ---- 6. co-op
const ROOM = "ZE" + String(Math.floor(Math.random() * 900 + 100));
// A first and past its countdown, then B joins its run
const A = await open("A", ROOM);
await sleep(1500);
const B = await open("B", ROOM);
await until(B, () => window.__trollOps.zdir().round >= 1, null, 30000);
// the roles settle once both have heard each other
const settled = await until(B, () => !window.__trollOps.zrun().coop.coop.host, null, 30000);
const role = (p) => R(p, () => { const T = window.__trollOps, c = T.zrun().coop.coop; return { on: c.on, host: c.host, id: T.net.id, hostId: T.net.hostId?.(), room: T.net.room, conn: T.net.connected }; });
const ra = await role(A), rb = await role(B);
check(settled && ra.host && !rb.host, "co-op: A hosts, B doesn't", JSON.stringify({ ra, rb }));
await R(A, () => window.__trollOps.zrun().forceWave(20));
await B.bringToFront();
// the host's spit flies on B's screen
const sA = await bring(A, "spitter", 10);
await clearOthers(A, [sA]);
const spitB = await until(B, () => window.__trollOps.zrun().specials.globs.length > 0 || window.__trollOps.zrun().specials.pools.length > 0, null, 20000);
check(spitB, "co-op: the host's spitter's glob shows on B's screen");
// its crawler crawls on B's screen
await R(A, () => { window.__trollOps.zrun().specials.SPECIALS.crawl.odds = 1; });
const wA = await bring(A, "walker", 4);
await clearOthers(A, [wA]);
const nid = await zom(A, wA, "z.takeDamage(z.maxHp * 0.7, false); return z.nid");
check(await until(B, (nid) => window.__trollOps.zdir().zombies.some((q) => q.nid === nid && q.crawling), nid, 8000), "co-op: its crawler crawls on B's screen");
// a helmet knocked off on the host comes off on B
const aA = await bring(A, "armoured", 4);
await clearOthers(A, [aA]);
const anid = await zom(A, aA, "return z.nid");
await until(B, (nid) => !!window.__trollOps.zdir().zombies.find((q) => q.nid === nid)?.helmet, anid, 15000);
await zom(A, aA, "z.takeDamage(z.helmetHp + 1, true); return 1");
check(await until(B, (nid) => { const z = window.__trollOps.zdir().zombies.find((q) => q.nid === nid); return z && !z.helmet; }, anid, 8000), "co-op: the helmet comes off on B's screen");
// its bloater bursts on B's screen
const bA = await bring(A, "bloater", 5);
await clearOthers(A, [bA]);
const bnid = await zom(A, bA, "return z.nid");
await until(B, (nid) => window.__trollOps.zdir().zombies.some((q) => q.nid === nid), bnid, 8000);
await zom(A, bA, "z.takeDamage(z.hp + 1, false); return 1");
check(await until(B, (nid) => window.__trollOps.zdir().zombies.find((q) => q.nid === nid)?.burst === true, bnid, 8000), "co-op: the bloater bursts on B's screen");

check(!errors.length, "no page errors", errors.slice(0, 4).join(" | "));
console.log(fails ? `\n${fails} FAILED · shots in ${SHOTS}` : `\nall passed · shots in ${SHOTS}`);
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
