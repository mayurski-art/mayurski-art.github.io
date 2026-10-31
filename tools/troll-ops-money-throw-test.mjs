// Kabukigrin's crowd throwing money (maps/town-npcs.js throwPose, doc
// MONEY-RAIN.md 2). One headless player in Socialize on the map, Supabase
// blocked (never a live room):
//
//   1. the cast flags a dozen-odd throwers (kabukigrin-social.js `throws`)
//   2. a thrower started by hand raises the arm and lets bills go on its
//      flicks (club-money.js emitted grows)
//   3. a mezzanine guest's bills fall to the hall floor below
//   4. a beat drop (forced) makes two to four of the crowd throw, not the
//      anonymous hands over the floor
//   5. no page errors
//
// OUT=<dir> also saves a shot of a bar throw.
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-money-throw-test.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png",
  ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream", "cache-control": "no-store" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let fails = 0;
const check = (name, ok, info = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? `  (${info})` : ""}`); if (!ok) fails++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto(`http://127.0.0.1:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  window.TrollrunnerAccounts = window.TrollrunnerAccounts || {};
  window.TrollrunnerAccounts.getCachedProfile = () => ({ username: "troll_runner" });
  window.dispatchEvent(new Event("trollrunner:auth-changed"));
  T.setMode("social"); T.loadout.mapId = "kabukigrin";
  if (T.els.noBots) T.els.noBots.checked = true;
  T.els.room.value = "PV" + Math.random().toString(36).slice(2, 5).toUpperCase();   // a private room
  T.els.room.dispatchEvent(new Event("input"));
  await T.startGame(); if (T.isStaging()) T.endStaging();
  T.player.maxHp = T.player.hp = 1e9;
});
await page.waitForFunction(() => !!window.__trollOps.townNpcs?.()?.list?.length, null, { timeout: 240000 });
await wait(6000);
// the crowd (town-npcs.js) and the money (the club's debug)
const crowd = () => page.evaluate(() => {
  const N = window.__trollOps.townNpcs();
  return N && { throwers: N.throwers.map((i) => ({ i, name: N.list[i].c.name, role: N.list[i].c.role, x: +N.list[i].x.toFixed(1), y: N.list[i].c.y ?? 0, z: +N.list[i].z.toFixed(1), throwing: N.list[i].throwT != null })) };
});
const money = () => page.evaluate(() => {
  const d = window.__trollOps.builtMap().map.debug().money;
  return d && { drops: d.drops, thrown: d.thrown, emitted: d.emitted, air: d.air, lying: d.lying };
});
const c0 = await crowd();
check("the cast flags the throwers (ravers, booths, the glass, the bar)", !!c0 && c0.throwers.length >= 12 && c0.throwers.some((t) => t.role === "Barfly") && c0.throwers.some((t) => t.y === 3),
  c0 && `${c0.throwers.length}: ${[...new Set(c0.throwers.map((t) => t.role))].join(", ")}`);
let m0 = await money();
for (let t = 0; t < 60 && (m0.air || m0.lying.length); t++) { await wait(500); m0 = await money(); }

// a Barfly at the bar: stand across from them and watch
const bar = c0.throwers.find((t) => t.role === "Barfly");
await page.evaluate(({ x, z }) => {
  const T = window.__trollOps;
  T.move.pos.set(x - 2.6, 0, z + 1.2); if (T.move.velocity) T.move.velocity.set(0, 0, 0);
  T.look.yaw = Math.atan2(-(x - (x - 2.6)), -(z - (z + 1.2))); T.look.pitch = -0.25;
}, bar);
// (the crowd's own schedule and the drops are held off while one NPC is
// driven by hand, so the count is that NPC's alone)
await page.evaluate(() => { const N = window.__trollOps.townNpcs(); N._sched = N.scheduleThrows; N._drop = N.dropThrow; N.scheduleThrows = () => {}; N.dropThrow = () => {}; });
const startOne = async (i) => { for (let t = 0; t < 30; t++) { if (await page.evaluate((i) => window.__trollOps.townNpcs().startThrow(i), i)) return true; await wait(500); } return false; };
const flicks = (i) => page.evaluate((i) => { const n = window.__trollOps.townNpcs().list[i]; return { flick: n.flick, bills: n.bills || 0, throwing: n.throwT != null, armR: +n.rig.parts.armR.rotation.x.toFixed(2) }; }, i);
check("a thrower can be started", await startOne(bar.i));
await wait(1800);
const f1 = await flicks(bar.i);
const m1 = await money();
check("the arm's up and bills leave the hand on the flicks", f1.throwing && f1.armR > 1.5 && f1.flick >= 1 && f1.bills >= 3, JSON.stringify({ ...f1, emitted: m1.emitted - m0.emitted, air: m1.air }));
let f2 = f1, m2 = m1;
if (process.env.OUT) {
  // the shot once the second flick's bills are up: the room, and the thrower close
  for (let t = 0; t < 20 && f2.throwing && f2.flick < 2; t++) { await wait(300); f2 = await flicks(bar.i); }
  await page.screenshot({ path: path.join(process.env.OUT, "money-throw-bar.jpg"), type: "jpeg", quality: 85 });
  await page.screenshot({ path: path.join(process.env.OUT, "money-throw-bar-close.jpg"), type: "jpeg", quality: 85, clip: { x: 440, y: 60, width: 500, height: 420 } });
}
for (let t = 0; t < 30 && f2.throwing; t++) { await wait(500); f2 = await flicks(bar.i); m2 = await money(); }
check("a throw flicks four times, a dozen-odd bills, and ends", f2.flick === 4 && !f2.throwing && f2.bills >= 12 && f2.bills <= 20, `${f2.flick} flicks, ${f2.bills} bills (${m2.emitted - m0.emitted} in all)`);
check("and nobody else threw meanwhile", m2.emitted - m0.emitted === f2.bills, `${m2.emitted - m0.emitted} vs ${f2.bills}`);

// a guest on the mezzanine glass: the bills go over it and down to the floor
const mezz = c0.throwers.find((t) => t.y === 3);
for (let t = 0; t < 60; t++) { const m = await money(); if (!m.air && !m.lying.length) break; await wait(500); }
const m3 = await money();
check("a mezzanine guest can be started", await startOne(mezz.i));
let m4 = m3;
for (let t = 0; t < 80 && m4.lying.length < 6; t++) { await wait(500); m4 = await money(); }
const theirs = m4.lying.filter((l) => Math.abs(l.z - mezz.z) < 3.5 && l.x < -13.4);
const lowest = theirs.length ? Math.min(...theirs.map((l) => l.y)) : NaN;
check("a mezzanine guest's bills fall to the hall floor", m4.emitted > m3.emitted && lowest < 0.5, `lowest landed at y ${lowest.toFixed(2)} of ${theirs.length} (${m4.lying.length} lying)`);
await page.evaluate(() => { const N = window.__trollOps.townNpcs(); N.scheduleThrows = N._sched; N.dropThrow = N._drop; });

// a drop: the crowd throws, not the anonymous hands
for (let t = 0; t < 60; t++) { const m = await money(); if (!m.air && !m.lying.length) break; await wait(500); }
const m5 = await money();
await page.evaluate(() => window.__trollOps.builtMap().map.debug().money.force());
await wait(700);
const c2 = await crowd();
const m6 = await money();
const going = c2.throwers.filter((t) => t.throwing).length;
check("a beat drop sends two to four of the crowd throwing", m6.drops > m5.drops && going >= 2 && going <= 4, `${going} throwing`);
check("and no anonymous notes over the floor", m6.thrown === m5.thrown, `thrown ${m6.thrown - m5.thrown}`);

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
