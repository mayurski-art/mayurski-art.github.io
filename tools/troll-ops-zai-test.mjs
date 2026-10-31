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

const SECTIONS = { rebuild, hud };
if (!SECTIONS[section]) { console.log(`unknown section ${section}: ${Object.keys(SECTIONS).join(" ")}`); process.exit(2); }
try { await SECTIONS[section](); } catch (e) { check(false, "threw", String(e?.stack || e)); }
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
