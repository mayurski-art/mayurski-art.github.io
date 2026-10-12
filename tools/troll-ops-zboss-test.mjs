// Troll Forces zombies bosses check (Zombie Rush P3): the brute (bigger,
// red, four times the health, a hit doesn't stop it, pays $60), the wave-10
// mini-boss walking in partway through with its name called and its bar in
// the top line, its slam (wind-up, then you're hurt and thrown back, and a
// deployable in the ring takes it), its kill paying $500, and the final
// boss opening wave 30 with its summons, the run won once everything's
// down. Text-overlap scans with a boss up. Solo, no network.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-zboss-test.mjs [mapId]
//   PHONE=1 for a landscape phone; SHOTS_DIR=<dir> for the screenshots
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { textClash as scanText } from "./troll-ops-text-scan.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOTS_DIR || os.tmpdir();
const PHONE = !!process.env.PHONE;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext(PHONE
  ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
  : { viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const map = process.argv[2] || "hollowgrin";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await ctx.newPage();
const shot = (name) => page.screenshot({ path: path.join(SHOTS, `zboss-${name}${PHONE ? "-phone" : ""}.png`) });
const textClash = (when) => scanText(page, check, when);
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !/frame-ancestors|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
await page.evaluate(async (map) => {
  const T = window.__trollOps;
  T.setMode("zombies");
  T.loadout.poolMapId = map;
  await T.startGame();
  if (T.isStaging?.()) T.endStaging();
}, map);
await page.waitForFunction(() => !!window.__trollOps.zdir() && window.__trollOps.zdir().round >= 1, null, { timeout: 180000 });
await page.evaluate(() => { const T = window.__trollOps; T.player.hp = 1e9; });

/* Everyone down, the director idle on a long break. */
const quiet = () => page.evaluate(() => {
  const zd = window.__trollOps.zdir();
  zd.zombies.forEach((z) => z.dispose(zd.scene)); zd.zombies = []; zd.toSpawn = 0; zd.state = "between"; zd.breakT = 9999; zd.breakLen = 9999;
});
await quiet();

// ---- the brute
const brute = await page.evaluate(async () => {
  const T = window.__trollOps; const zd = T.zdir();
  zd.round = 12;
  zd.forceType = "brute"; zd.toSpawn = 1; zd.state = "fighting"; zd.spawnCd = 0;
  const t0 = performance.now();
  while (!zd.zombies.some((q) => q.alive) && performance.now() - t0 < 20000) await new Promise((r) => setTimeout(r, 50));
  const z = zd.zombies.find((q) => q.alive);
  zd.forceType = null;
  if (!z) return null;
  z.riseT = 0;
  const walkerHp = Math.round(window.__trollOps.zdir().constructor && z.maxHp / 4);
  const hit = z.takeDamage(10, false);
  const out = { type: z.type.id, scale: z.mesh.scale.x, maxHp: z.maxHp, stagger: z.staggerT, radius: z.radius, walkerHp };
  const cash0 = T.zrun().econ.cash;
  T.onBulletActorHit(z, { damage: 1e9, isHead: false, point: z.mesh.position.clone().setY(z.mesh.position.y + 1.5), dir: new T.THREE.Vector3(0, 0, -1) });
  out.paid = T.zrun().econ.cash - cash0;
  return out;
});
check(brute?.type === "brute", "a brute spawns");
check(brute && Math.abs(brute.scale - 1.25) < 1e-6, "it's a size up", String(brute?.scale));
check(brute && brute.stagger === 0, "a hit doesn't stagger it");
check(brute?.paid === 60, "it pays $60", String(brute?.paid));
await quiet();

// ---- wave 10: the mini-boss walks in once half the wave is out
await page.evaluate(() => { const T = window.__trollOps; T.zrun().forceWave(10); T.zdir().breakLen = 9999; });
await sleep(400);
const before = await page.evaluate(() => window.__trollOps.zrun().bossState.spawned);
check(before === false, "no boss at the start of wave 10");
await page.evaluate(() => { const T = window.__trollOps; const zd = T.zdir(); zd.toSpawn = Math.floor(T.zrun().bossState.waveTotal * 0.4); });
const arrived = await page.waitForFunction(() => window.__trollOps.zrun().bossState.spawned, null, { timeout: 10000 }).then(() => true).catch(() => false);
check(arrived, "the mini-boss arrives when half the wave is out");
const mini = await page.evaluate(() => {
  const T = window.__trollOps; const b = T.zrun().bossState.boss;
  return { type: b?.type.id, hp: b?.maxHp, scale: b?.mesh.scale.x, banner: document.querySelector(".zh-banner").textContent };
});
check(mini.type === "mini" && mini.hp === 10450, "Meatwagon: 10x a wave-10 zombie's health", String(mini.hp));
check(mini.banner === "Meatwagon", "its name is called", mini.banner);
// the rest of the wave out of the way, so it's just the boss
await page.evaluate(() => {
  const T = window.__trollOps; const zd = T.zdir();
  zd.toSpawn = 0;
  for (const z of zd.zombies) if (!z.type.boss) { z.dispose(zd.scene); }
  zd.zombies = zd.zombies.filter((z) => z.type.boss);
});
await sleep(300);
const bar = await page.evaluate(() => ({
  shown: !document.querySelector(".zh-boss").hidden,
  name: document.querySelector(".zh-boss-n").textContent,
  left: document.querySelector(".zh-left").hidden,
}));
check(bar.shown && bar.name === "Meatwagon" && bar.left, "its bar takes the top line's place", JSON.stringify(bar));
await textClash("a boss bar up");

// half its health off: the bar follows
await page.evaluate(() => { const b = window.__trollOps.zrun().bossState.boss; b.takeDamage(b.maxHp / 2, false); });
await sleep(400);
const half = await page.evaluate(() => {
  const i = document.querySelector(".zh-boss-bar i");
  return parseFloat((i.style.transform.match(/scaleX\(([\d.]+)\)/) || [])[1]);
});
check(Math.abs(half - 0.5) < 0.02, "the bar reads half", String(half));

// ---- the slam: stand close, with a barricade beside it
const slam = await page.evaluate(async () => {
  const T = window.__trollOps; const R = T.zrun(); const b = R.bossState.boss;
  const me = T.move.pos;
  const yaw = T.look.yaw;
  b.mesh.position.set(me.x - Math.sin(yaw) * 2.6, me.y, me.z - Math.cos(yaw) * 2.6);
  b.groundY = me.y;
  b.slamCd = 0;
  const wall = R.spawn("barricade", b.mesh.position.x + Math.cos(yaw) * 2.2, me.y, b.mesh.position.z - Math.sin(yaw) * 2.2, yaw);
  T.player.maxHp = 100; T.player.hp = 100;
  const from = { x: me.x, z: me.z };
  const t0 = performance.now();
  let wound = false;
  while (performance.now() - t0 < 6000) {
    await new Promise((r) => setTimeout(r, 30));
    if (b.slamT > 0) wound = true;
    if (T.player.hp < 100) break;
  }
  await new Promise((r) => setTimeout(r, 450));
  const out = { wound, hp: T.player.hp, moved: Math.hypot(me.x - from.x, me.z - from.z), wallHp: wall.hp, wallMax: wall.maxHp, wallAlive: wall.alive, rings: R.bossState.rings.length };
  T.player.hp = 1e9; T.player.maxHp = 1e9;
  return out;
});
check(slam.wound, "it plants and winds up first (the tell)");
check(slam.hp < 100, "the slam hurts", String(slam.hp));
check(slam.moved > 0.8, "and throws you back", slam.moved.toFixed(2) + " m");
check(!slam.wallAlive || slam.wallHp < slam.wallMax, "the barricade in the ring takes it");
await shot("mini");

// ---- its kill pays $500 and the bar goes
const miniKill = await page.evaluate(async () => {
  const T = window.__trollOps; const R = T.zrun(); const b = R.bossState.boss;
  const cash0 = R.econ.cash;
  T.onBulletActorHit(b, { damage: 1e9, isHead: false, point: b.mesh.position.clone().setY(b.mesh.position.y + 2), dir: new T.THREE.Vector3(0, 0, -1) });
  await new Promise((r) => setTimeout(r, 300));
  return { paid: R.econ.cash - cash0, bar: document.querySelector(".zh-boss").hidden, left: !document.querySelector(".zh-left").hidden };
});
check(miniKill.paid >= 500, "the mini-boss pays $500", `+$${miniKill.paid}`);
check(miniKill.bar && miniKill.left, "its bar goes, \"in N waves\" is back");
await page.evaluate(() => window.__trollOps.zrun().dep.list.forEach((e) => e.remove()));
await quiet();

// ---- wave 30: the final boss opens it, and calls up the dead
await page.evaluate(() => { window.__trollOps.zrun().forceWave(30); });
const fin = await page.waitForFunction(() => window.__trollOps.zrun().bossState.boss?.type.id === "boss", null, { timeout: 10000 }).then(() => true).catch(() => false);
check(fin, "the final boss opens wave 30");
await page.evaluate(() => { const zd = window.__trollOps.zdir(); zd.toSpawn = 0; for (const z of zd.zombies) if (!z.type.boss) z.dispose(zd.scene); zd.zombies = zd.zombies.filter((z) => z.type.boss); });
const grin = await page.evaluate(() => {
  const b = window.__trollOps.zrun().bossState.boss;
  return { hp: b.maxHp, name: document.querySelector(".zh-boss-n").textContent, final: document.querySelector(".zh-boss").classList.contains("is-final") };
});
check(grin.name === "The Grinlord" && grin.final, "The Grinlord, in the final bar", grin.name);
check(grin.hp > 80000, "with the most health of anything", String(grin.hp));
const summoned = await page.evaluate(async () => {
  const T = window.__trollOps; const b = T.zrun().bossState.boss;
  const n0 = T.zdir().zombies.filter((z) => z.alive && !z.type.boss).length;
  b.summonT = 0.01;
  await new Promise((r) => setTimeout(r, 300));
  return T.zdir().zombies.filter((z) => z.alive && !z.type.boss).length - n0;
});
check(summoned === 3, "it calls up three", String(summoned));
await sleep(1200);
await shot("final");
await textClash("the final boss");

// everything down: the run is won
await page.evaluate(() => {
  const T = window.__trollOps;
  setInterval(() => { for (const z of T.zdir()?.zombies || []) if (z.alive && !z.dying) z.takeDamage(1e9, false); }, 200);
});
const won = await page.waitForFunction(() => window.__trollOps.state() === "gameover", null, { timeout: 30000 }).then(() => true).catch(() => false);
const title = await page.evaluate(() => document.getElementById("to-go-title")?.textContent || "");
check(won && /survived/i.test(title), "the final boss down and the wave clear: won", title);

check(errors.length === 0, "no page errors", errors.slice(0, 3).join(" | "));
console.log(fails ? `${fails} FAILED` : "ALL PASS", "· shots in", SHOTS);
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
