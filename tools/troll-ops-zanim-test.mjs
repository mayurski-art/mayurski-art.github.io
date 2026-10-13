// Troll Forces Zombies animation pass check (Zombie Rush P7). One headless
// tab, a SOLO run (no room code: never a public room), Supabase blocked.
//   1. The bite: a zombie in reach swings, and the hit lands when the claw
//      does (at least 0.4 s after the swing starts), not with the swing.
//   2. Out of reach in time: back off as it swings and the hit misses.
//   3. Turning: a zombie facing away from where it walks turns round over a
//      few frames, not in one.
//   4. A heavy hit (a quarter of its health) staggers it back along the
//      shot; a second one straight after is only a flinch.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-zanim-test.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const errors = [];
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !/frame-ancestors|ERR_FAILED|supabase/i.test(m.text())) errors.push(m.text()); });
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.els.room.value = "";
  T.setMode("zombies");
  T.loadout.poolMapId = "pentagrin";
  await T.startGame();
  if (T.isStaging?.()) T.endStaging();
});
await page.waitForFunction(() => window.__trollOps.zdir()?.zombies.some((z) => z.alive && !z.dying && z.riseT <= 0 && z.body), null, { timeout: 180000 });

/* One zombie in front of the player, the rest frozen out of it; then watch
   when its swing starts and when the hit lands. `dodge`: step away the
   moment it swings. */
const bite = (dodge) => page.evaluate(async (dodge) => {
  const T = window.__trollOps;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const zs = T.zdir().zombies.filter((z) => z.alive && !z.dying);
  const z = zs.find((q) => q.body && q.riseT <= 0);
  for (const o of zs) if (o !== z) o.stunT = 999;
  T.player.hp = T.player.maxHp = 1000;
  const p = T.move.pos;
  z.mesh.position.set(p.x + 1, z.groundY, p.z);
  z.velocity.set(0, 0, 0);
  z.attackCdT = 0; z.bite = null; z.stunT = 0; z.staggerT = 0;
  const hp0 = T.player.hp;
  const t0 = performance.now();
  let swungAt = null, hitAt = null;
  while (performance.now() - t0 < 4000) {
    if (swungAt == null && z.bite) {
      swungAt = performance.now();
      if (dodge) T.move.pos.set(p.x - 5, p.y, p.z);
    }
    if (hitAt == null && T.player.hp < hp0) hitAt = performance.now();
    if (hitAt != null || (swungAt != null && performance.now() - swungAt > 1500)) break;
    // keep it from walking after us when we step away
    if (dodge && swungAt != null) z.stunT = 0;
    await wait(10);
  }
  for (const o of zs) if (o !== z) o.stunT = 0;
  return { swung: swungAt != null, delay: hitAt != null && swungAt != null ? (hitAt - swungAt) / 1000 : null, hit: hitAt != null };
}, dodge);

const a = await bite(false);
check(a.swung && a.hit && a.delay >= 0.38, "the bite lands when the claw does (>= 0.4 s after the swing)", JSON.stringify(a));
const b = await bite(true);
check(b.swung && !b.hit, "backing out of a swing dodges it", JSON.stringify(b));

/* 3. turn a walking zombie to face away from its way; watch it come round */
const turn = await page.evaluate(async () => {
  const T = window.__trollOps;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const z = T.zdir().zombies.find((q) => q.alive && !q.dying && q.body && q.riseT <= 0);
  const p = T.move.pos;
  z.mesh.position.set(p.x + 9, z.groundY, p.z);
  z.stunT = 0; z.staggerT = 0; z.bite = null;
  await wait(400);   // walking at us
  const way = () => Math.atan2(-z.velocity.x, -z.velocity.z);
  const off = () => { const d = z.mesh.rotation.y - way(); return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))); };
  z.mesh.rotation.y = way() + Math.PI;
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
  const early = off();
  await wait(1000);
  return { early, late: off() };
});
check(turn.early > 0.6 && turn.late < 0.35, "zombies turn round, they don't snap", JSON.stringify(turn));

/* 4. a heavy hit, the way combat/weapons.js lands one: takeDamage, then the flinch */
const stag = await page.evaluate(async () => {
  const T = window.__trollOps;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const z = T.zdir().zombies.find((q) => q.alive && !q.dying && q.body && q.riseT <= 0 && !q.type.noStagger);
  const p = T.move.pos;
  z.mesh.position.set(p.x + 6, z.groundY, p.z);
  z.stunT = 0; z.bite = null; z.heavyAt = -Infinity;
  await wait(300);
  const d0 = Math.hypot(z.mesh.position.x - p.x, z.mesh.position.z - p.z);
  const dir = { x: z.mesh.position.x - p.x, y: 0, z: z.mesh.position.z - p.z };
  z.hp = z.maxHp;
  z.takeDamage(z.maxHp * 0.3, false);
  z.flinchFrom(dir, 0.5);
  const first = z.staggerT;
  await wait(250);
  const d1 = Math.hypot(z.mesh.position.x - p.x, z.mesh.position.z - p.z);
  z.hp = z.maxHp;
  z.takeDamage(z.maxHp * 0.3, false);
  const second = z.staggerT;
  return { first, second, d0, d1 };
});
check(stag.first > 0.3 && stag.d1 > stag.d0, "a heavy hit staggers it back", JSON.stringify(stag));
check(stag.second < 0.1, "a second heavy hit straight after is only a flinch", JSON.stringify(stag));

check(!errors.length, "no page errors", errors.slice(0, 4).join(" | "));
await browser.close();
server.close();
console.log(fails ? `${fails} failed` : "all passed");
process.exit(fails ? 1 : 0);
