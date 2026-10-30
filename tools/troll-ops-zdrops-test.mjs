// Troll Forces zombies power-up drops check (design doc phase M1,
// modes/zombies/drops.js). Solo, no network:
//   1. A forced drop falls where a kill was, as a glowing trollface; walking
//      into it takes it (banner, gone from the floor).
//   2. Each of the five does its job: Kaboom drops every zombie on its feet
//      and pays $400; One Tap makes a scratch kill; Double Cash doubles a
//      kill's pay; Rebuild tops a deployable up; Fire Sale halves the price.
//   3. The timed ones show a chip each under the wave and run out; a boss
//      kill always drops; an ignored drop fades.
//   4. Co-op, two tabs on a PRIVATE code (never a public room): the host's
//      drop shows on B's screen; B walks into it and both get it, once; the
//      host's Kaboom clears B's screen and pays B.
// Text-overlap scan on the HUD with the chips up.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-zdrops-test.mjs [mapId]
//   SHOTS_DIR=<dir>; PHONE=1 for a landscape phone
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
import { textClash as scanText } from "./troll-ops-text-scan.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOTS_DIR || os.tmpdir();
const TAG = process.env.PHONE ? "-phone" : "";
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
const ctx = await browser.newContext(process.env.PHONE
  ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
  : { viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const map = process.argv[2] || "hollowgrin";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const page = await ctx.newPage();
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
  if (!T.els.pause.hidden) T.closePauseMenu();
}, map);
await page.waitForFunction(() => !!window.__trollOps.zdir() && window.__trollOps.zdir().round >= 1, null, { timeout: 120000 });

const R = (fn, arg) => page.evaluate(fn, arg);
const waitAlive = (n) => page.waitForFunction((n) => window.__trollOps.zdir().zombies.filter((q) => q.alive && !q.dying).length >= n, n, { timeout: 120000 }).then(() => true).catch(() => false);
const until = (fn, arg, ms = 8000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }).then(() => true).catch(() => false);
const killOne = (dmg = 1e7) => R((dmg) => {
  const T = window.__trollOps;
  const z = T.zdir().zombies.find((q) => q.alive && !q.dying && !q.type.boss);
  if (!z) return null;
  const point = z.mesh.position.clone(); point.y += 1.5;
  T.onBulletActorHit(z, { damage: dmg, isHead: false, point, dir: new T.THREE.Vector3(0, 0, -1) });
  return { dying: z.dying, at: [z.mesh.position.x, z.mesh.position.y, z.mesh.position.z] };
}, dmg);
const floor = () => R(() => [...window.__trollOps.zrun().drops.drops.values()].map((d) => d.kind));
/* A drop of `kind` at our feet, taken. */
async function take(kind) {
  await R((kind) => {
    const T = window.__trollOps, p = T.move.pos;
    T.zrun().drops.spawn(kind, p.x + 3, p.y, p.z);
  }, kind);
  await sleep(200);
  await R(() => { const T = window.__trollOps; const d = [...T.zrun().drops.drops.values()].pop(); if (d) T.move.pos.set(d.mesh.position.x, T.move.pos.y, d.mesh.position.z); });
  return until(() => window.__trollOps.zrun().drops.drops.size === 0);
}

// ---- 1. a kill drops one
await waitAlive(2);
await R(() => window.__trollOps.zrun().drops.force("double", 1));
const k = await killOne();
check(!!k?.dying, "a kill");
check(await until(() => window.__trollOps.zrun().drops.drops.size === 1), "the kill dropped one", JSON.stringify(await floor()));
const sprite = await R(() => { const d = [...window.__trollOps.zrun().drops.drops.values()][0]; return d ? { kind: d.kind, onScene: !!d.mesh.parent, face: !!d.mesh.userData.face?.material?.map } : null; });
check(sprite?.kind === "double" && sprite.onScene && sprite.face, "it stands where the kill was, a trollface", JSON.stringify(sprite));
await R(() => { const T = window.__trollOps; const d = [...T.zrun().drops.drops.values()][0]; T.move.pos.set(d.mesh.position.x + 2.5, T.move.pos.y, d.mesh.position.z + 2.5); T.look.yaw = Math.atan2(2.5, 2.5); T.look.pitch = -0.25; });
await sleep(700);
await page.screenshot({ path: path.join(SHOTS, `zdrops-floor${TAG}.png`) });
// the per-wave cap: one on wave 1, however lucky
await waitAlive(1);
await killOne();
await sleep(300);
check((await floor()).length === 1, "wave 1: no second drop (the cap)", JSON.stringify(await floor()));
await R(() => { const T = window.__trollOps; const d = [...T.zrun().drops.drops.values()][0]; T.move.pos.set(d.mesh.position.x, T.move.pos.y, d.mesh.position.z); });
check(await until(() => window.__trollOps.zrun().drops.drops.size === 0), "walking into it takes it");
const banner = await R(() => document.querySelector(".zh-banner")?.textContent || "");
check(/Double Cash/.test(banner), "its banner", banner);
await R(() => window.__trollOps.zrun().drops.force(null, 0));

// ---- 2. each one
// Double Cash: a kill pays twice
await waitAlive(1);
const c0 = await R(() => window.__trollOps.zrun().econ.cash);
await killOne();
await sleep(150);
const c1 = await R(() => window.__trollOps.zrun().econ.cash);
check(c1 - c0 > 0 && (c1 - c0) % 2 === 0 && c1 - c0 >= 2 * (await R(() => window.__trollOps.zrun().drops.state.base ?? 0)), "Double Cash: a kill pays double", `+${c1 - c0}`);
// the chips, under the wave
const chips = await R(() => [...document.querySelectorAll(".zh-fx-c")].map((c) => c.innerText.replace(/\s+/g, " ")));
check(chips.length === 1 && /Double Cash/.test(chips[0]), "a chip for it under the wave", JSON.stringify(chips));
// One Tap: a scratch kills
check(await take("onetap"), "One Tap taken");
await waitAlive(1);
const tap = await killOne(1);
check(!!tap?.dying, "One Tap: 1 damage kills");
check(await R(() => document.querySelectorAll(".zh-fx-c").length) === 2, "two chips now");
await sleep(1600);   // the kill's floating numbers fade (this scan is for the chips)
await scanText(page, check, "the HUD with two power-ups");
await page.screenshot({ path: path.join(SHOTS, `zdrops-chips${TAG}.png`) });
// Fire Sale: half price
const full = await R(() => window.__trollOps.zrun().deployOffers().map((o) => o.price));
check(await take("firesale"), "Fire Sale taken");
const half = await R(() => window.__trollOps.zrun().deployOffers().map((o) => o.price));
check(full.every((p, i) => Math.abs(half[i] - p / 2) <= 5), "Fire Sale: deployables half price", `${full} -> ${half}`);
// Rebuild: a hurt deployable back to full
await R(() => { const T = window.__trollOps, p = T.move.pos; const e = T.zrun().spawn("barricade", p.x + 5, p.y - 1.6, p.z, 0); e.hp = 20; });
check(await take("rebuild"), "Rebuild taken");
const dep = await R(() => window.__trollOps.zrun().dep.list.map((e) => [e.hp, e.maxHp]));
check(dep.length && dep.every(([h, m]) => h === m), "Rebuild: every deployable at full", JSON.stringify(dep));
// Kaboom: the field drops, +$400
await waitAlive(3);
const before = await R(() => ({ up: window.__trollOps.zdir().zombies.filter((q) => q.alive && !q.dying).length, cash: window.__trollOps.zrun().econ.cash, x2: window.__trollOps.zrun().drops.dropFx.double > 0 }));
check(await take("kaboom"), "Kaboom taken");
await sleep(150);
const after = await R(() => ({ up: window.__trollOps.zdir().zombies.filter((q) => q.alive && !q.dying && !q.type.boss).length, cash: window.__trollOps.zrun().econ.cash }));
check(before.up >= 3 && after.up === 0, "Kaboom: every zombie on its feet drops", `${before.up} -> ${after.up}`);
// (clearing the field can clear the wave too: its bonus rides along)
const mult = before.x2 ? 2 : 1, wave = await R(() => window.__trollOps.zdir().round);
const got = after.cash - before.cash;
check(got === 400 * mult || got === (400 + 50 + 10 * wave) * mult, "Kaboom pays $400 (doubled under Double Cash)", `+${got}`);

// ---- 3. timers, bosses, fading
await R(() => { const fx = window.__trollOps.zrun().drops.dropFx; for (const k of Object.keys(fx)) if (fx[k] > 0) fx[k] = 0.2; });
check(await until(() => !document.querySelector(".zh-fx-c")), "the chips run out");
const prices = await R(() => window.__trollOps.zrun().deployOffers().map((o) => o.price));
check(prices.every((p, i) => p >= full[i]), "Fire Sale over: full price again", `${prices}`);
await R(() => window.__trollOps.zrun().spawnBoss("mini"));
await sleep(400);
await R(() => { const z = window.__trollOps.zdir().zombies.find((q) => q.type.boss && q.alive); z.takeDamage(z.hp + 1, false); });
check(await until(() => window.__trollOps.zrun().drops.drops.size === 1), "a boss always drops one");
await R(() => { for (const d of window.__trollOps.zrun().drops.drops.values()) d.t = 0.3; });
check(await until(() => window.__trollOps.zrun().drops.drops.size === 0), "an ignored drop fades");

// ---- 4. co-op
const ROOM = "ZD" + String(Math.floor(Math.random() * 900 + 100));
async function open(label) {
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await p.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await p.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
  await p.evaluate(async ({ room, map, quiet }) => {
    const T = window.__trollOps;
    if (quiet) T.composer.render = () => {};
    T.setMode("zombies");
    T.els.room.value = room;
    T.els.room.dispatchEvent(new Event("input"));
    T.loadout.poolMapId = map;
    await T.startGame();
  }, { room: ROOM, map, quiet: label === "A" });
  return p;
}
await page.close();
const A = await open("A");
await sleep(400);
const B = await open("B");
const Rp = (p, fn, arg) => p.evaluate(fn, arg);
for (const p of [A, B]) {
  const t0 = Date.now();
  while (Date.now() - t0 < 240000 && await Rp(p, () => window.__trollOps.loadState().open)) await sleep(250);
}
await Rp(A, () => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); });
await sleep(1500);
await Rp(B, () => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); if (!T.els.pause.hidden) T.closePauseMenu(); });
const hostOk = await Rp(A, () => window.__trollOps.zrun().coop.coop.host) && !(await Rp(B, () => window.__trollOps.zrun().coop.coop.host));
check(hostOk, "co-op: A hosts, B doesn't");
// a drop the host rolled, three metres from B
const bAt = await Rp(B, () => { const p = window.__trollOps.move.pos; return [p.x, p.y, p.z]; });
await Rp(A, (at) => window.__trollOps.zrun().drops.spawn("double", at[0] + 3, at[1], at[2]), bAt);
const seen = await B.waitForFunction(() => window.__trollOps.zrun().drops.drops.size === 1, null, { timeout: 8000, polling: 100 }).then(() => true).catch(() => false);
check(seen, "co-op: the host's drop shows on B's screen");
await B.bringToFront();
await Rp(B, (at) => { const T = window.__trollOps; T.move.pos.set(at[0] + 3, T.move.pos.y, at[2]); }, bAt);
const gotB = await B.waitForFunction(() => window.__trollOps.zrun().drops.dropFx.double > 0, null, { timeout: 8000, polling: 100 }).then(() => true).catch(() => false);
const gotA = await A.waitForFunction(() => window.__trollOps.zrun().drops.dropFx.double > 0 && window.__trollOps.zrun().drops.drops.size === 0, null, { timeout: 8000, polling: 100 }).then(() => true).catch(() => false);
check(gotB && gotA, "co-op: B walks into it, both get Double Cash, it's gone on the host");
const bannerB = await Rp(B, () => document.querySelector(".zh-banner")?.textContent || "");
check(/Double Cash/.test(bannerB), "co-op: B's banner", bannerB);
// the host's Kaboom: B's mirrored horde goes down, B is paid
await B.waitForFunction(() => window.__trollOps.zdir().zombies.filter((q) => q.alive && !q.dying).length >= 2, null, { timeout: 120000 }).catch(() => {});
const cashB0 = await Rp(B, () => window.__trollOps.zrun().econ.cash);
const aAt = await Rp(A, () => { const p = window.__trollOps.move.pos; return [p.x, p.y, p.z]; });
await Rp(A, (at) => { const T = window.__trollOps; T.zrun().drops.spawn("kaboom", at[0], at[1] - 1.6, at[2]); }, aAt);
const cleared = await B.waitForFunction(() => window.__trollOps.zdir().zombies.filter((q) => q.alive && !q.dying && !q.type.boss).length === 0, null, { timeout: 10000, polling: 100 }).then(() => true).catch(() => false);
const cashB1 = await Rp(B, () => window.__trollOps.zrun().econ.cash);
check(cleared, "co-op: the host's Kaboom clears B's screen");
check(cashB1 - cashB0 >= 800, "co-op: and pays B (doubled)", `+${cashB1 - cashB0}`);

check(!errors.length, "no page errors", errors.slice(0, 3).join(" | "));
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
