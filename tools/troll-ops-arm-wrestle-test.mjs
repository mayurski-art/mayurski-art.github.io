// Troll Forces Socialize: arm wrestling (modes/arm-wrestle.js; the
// tf-parallel plan, phase 4). Tabs share a room, Supabase blocked; the bout
// is shortened (window.__trollAwTune):
//   1. Troll City has an arm table, two chairs facing across it.
//   2. Sit, call a townsperson over: he walks over and sits; tapping in the
//      green pins him; winner stays, he goes back to his business.
//   3. Do nothing and he pins you; the loser gets up.
//   4. Jump mid-bout: a forfeit, up and out, he is released.
//   5. Two players: A waits, B sits opposite; one drives, the count and the
//      bout run on both tabs; B mashes, B wins on both; A sees B in it.
//   6. Trolling Loud has a table too.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-arm-wrestle-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, "tools", ".arm-wrestle-shots");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };
async function pumpAll(pages, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) for (const p of pages) await p.screenshot({ type: "jpeg", quality: 10 }).catch(() => {});
}
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
await ctx.route(/supabase/, (r) => r.abort());
const errors = [];

async function open(label, username, skewMs = 0) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await page.addInitScript(() => { window.__trollAwTune = { countSecs: 1, boutSecs: 8, endSecs: 1.5, callSecs: 8 }; });
  await page.addInitScript(({ name, skewMs }) => {
    const fake = { getCachedProfile: () => ({ username: name, tags: [] }) };
    Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => fake, set: () => {} });
    const real = Date.now.bind(Date);
    window.__realNow = real;
    if (skewMs) Date.now = () => real() + skewMs;   // this device's clock is off
  }, { name: username, skewMs });
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 420000 });
  await page.waitForFunction(() => !!window.__trollOps && !!window.__trollAw, null, { timeout: 420000 });
  await page.evaluate(() => window.__trollOps.setLoadWaitMax(8));
  return page;
}
async function join(page) {
  await page.evaluate(async () => {
    const T = window.__trollOps;
    T.setMode("social");
    T.loadout.mapId = "trollcity";
    await T.startGame();
  });
  await page.waitForFunction(() => !window.__trollOps.loadState().open, null, { timeout: 420000 });
  await page.evaluate(() => { window.__trollOps.els.pause.hidden = true;  });   // as a click would
}
const rp = (page) => page.evaluate(() => window.__trollOps.rp());
const B_ = (page) => page.evaluate(() => window.__trollBand.state());
async function holdRp(page, others, done, ms = 15000) {
  await page.keyboard.down("x");
  const t0 = Date.now();
  while (Date.now() - t0 < ms && !(await done())) await pumpAll([page, ...others], 250);
  await page.keyboard.up("x");
  await pumpAll([page, ...others], 150);
}
const putAt = (page, x, z, y, yaw = 0) => page.evaluate(({ x, z, y, yaw }) => {
  const T = window.__trollOps;
  T.move.reset(x, z, y); T.look.yaw = yaw;
}, { x, z, y, yaw });
/* The song's beat from room time alone (no listener lag), on this tab. */
const rawBeat = (page) => page.evaluate(() => {
  const S = window.__trollBand.band.song;
  return S ? ((window.__trollConductor.roomNow() - S.at) / 1000) / S.spb : null;
});
const npcVisible = (page, name) => page.evaluate((name) => window.__trollOps.townNpcs().list.find((n) => n.c.name === name)?.rig.root.visible, name);


const W = (page) => page.evaluate(() => window.__trollAw.state());
const taps = async (page, others, n, sweet, every = 110) => { for (let i = 0; i < n; i++) { await page.evaluate((s) => window.__trollAw.tap(s), sweet); await pumpAll([page, ...others], every); } };
const until = async (pages, f, ms = 12000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f()) return true; await pumpAll(pages, 200); } return false; };
const npcOf = (page, i) => page.evaluate((i) => { const n = window.__trollOps.townNpcs().list[i]; return n ? { name: n.c.name, over: !!n.override, x: n.x, z: n.z } : null; }, i);

const A = await open("A", "wrestler_a");
await join(A);
await pumpAll([A], 3000);

// ── 1. The table ─────────────────────────────────────────────────────────
const T = (await A.evaluate(() => window.__trollAw.tables()))[0];
check("Troll City has an arm-wrestling table, two seats facing", !!T && T.seats.length === 2, JSON.stringify(T));
const seats = await A.evaluate((T) => T.seats.map((i) => { const s = window.__trollOps.builtMap().map.rp.seats()[i]; return { x: s.x, z: s.z, yaw: s.yaw }; }), T);
check("the chairs face each other across it", Math.abs(Math.abs(seats[0].yaw - seats[1].yaw) - Math.PI) < 0.01, JSON.stringify(seats));

// ── 2. Sit, call a townsperson over, win ─────────────────────────────────
await putAt(A, T.x - 1.4, T.z, 0, -Math.PI / 2);
await pumpAll([A], 400);
let s = await rp(A);
check("by the table: arm wrestle", /^arm wrestle$/i.test(s.prompt || ""), s.prompt);
await holdRp(A, [], async () => (await W(A)).phase === "wait");
let w = await W(A);
check("sat at it, waiting for a challenger", w.phase === "wait" && T.seats.includes(w.seat), JSON.stringify(w));
s = await rp(A);
check("sat there: call someone over", /call someone over/i.test(s.prompt || ""), s.prompt);
await holdRp(A, [], async () => (await W(A)).phase === "call");
w = await W(A);
const who = w.npc ? await npcOf(A, w.npc.i) : null;
check("a townsperson comes over", w.phase === "call" && !!who && who.over, JSON.stringify({ w, who }));
const sat = await until([A], async () => ["count", "bout"].includes((await W(A)).phase), 15000);
w = await W(A);
const oppSeat = seats[1 - w.side];
check("he sits opposite and the count starts", sat && w.npc?.sat && Math.hypot(w.npc.x - oppSeat.x, w.npc.z - oppSeat.z) < 0.05, JSON.stringify(w));
await until([A], async () => (await W(A)).phase === "bout", 6000);
await A.screenshot({ path: path.join(SHOTS, "aw-fp.png") });
await A.evaluate(() => window.__trollOps.toggleThirdPerson?.());
await taps(A, [], 4, true);
await A.screenshot({ path: path.join(SHOTS, "aw-3p.png") });
let maxMe = 0;
for (let i = 0; i < 60 && (await W(A)).phase === "bout"; i++) {
  // a quick hand: two taps per (slow, headless) frame pump, about 8-10 a second
  await A.evaluate(() => { window.__trollAw.tap(true); setTimeout(() => window.__trollAw.tap(true), 60); });
  await pumpAll([A], 100);
  const q = await W(A);
  maxMe = Math.max(maxMe, q.side === 0 ? q.m : -q.m);
}
w = await W(A);
check("tapping in the green pins him", w.w === w.side && maxMe > 0, JSON.stringify({ w: w.w, side: w.side, maxMe }));
await A.screenshot({ path: path.join(SHOTS, "aw-win.png") });
await until([A], async () => (await W(A)).phase === "wait", 8000);
w = await W(A);
check("winner stays (still sat, waiting); he goes back to his business", w.phase === "wait" && w.seat >= 0 && !w.npc, JSON.stringify(w));
const released = await A.evaluate((name) => !window.__trollOps.townNpcs().list.find((n) => n.c.name === name)?.override, who?.name);
check("the townsperson is released", released);

// ── 3. Idle: he pins you, and you get up ─────────────────────────────────
await holdRp(A, [], async () => (await W(A)).phase === "call");
await until([A], async () => (await W(A)).phase === "bout", 20000);
await until([A], async () => (await W(A)).phase !== "bout", 20000);
w = await W(A);
check("doing nothing: he pins you", w.phase === "end" && w.w === 1 - w.side, JSON.stringify(w));
await until([A], async () => (await W(A)).phase !== "end", 8000);
w = await W(A);
check("the loser gets up", w.seat === -1 && w.phase === null, JSON.stringify(w));

// ── 4. Forfeit: jump mid-bout ────────────────────────────────────────────
await putAt(A, T.x - 1.4, T.z, 0, -Math.PI / 2);
await pumpAll([A], 300);
await holdRp(A, [], async () => (await W(A)).phase === "wait");
await holdRp(A, [], async () => (await W(A)).phase === "call");
await until([A], async () => (await W(A)).phase === "bout", 20000);
await A.keyboard.press("Space");
await pumpAll([A], 600);
w = await W(A);
const freed = await A.evaluate(() => !window.__trollOps.townNpcs().list.some((n) => n.override));
check("jump mid-bout: you let go, up and out, he's released", w.seat === -1 && w.phase === null && freed, JSON.stringify(w));

// ── 5. Two players ───────────────────────────────────────────────────────
const B = await open("B", "wrestler_b");
await join(B);
await pumpAll([A, B], 4000);
await putAt(A, T.x - 1.4, T.z, 0, -Math.PI / 2);
await pumpAll([A, B], 300);
await holdRp(A, [B], async () => (await W(A)).phase === "wait");
await putAt(B, T.x + 1.4, T.z, 0, Math.PI / 2);
await pumpAll([B, A], 800);
s = await rp(B);
check("B by the table: arm wrestle wrestler_a", /arm wrestle wrestler_a/i.test(s.prompt || ""), s.prompt);
await holdRp(B, [A], async () => (await W(B)).seat >= 0);
const both = await until([A, B], async () => (await W(A)).phase === "bout" && (await W(B)).phase === "bout", 12000);
const [wa, wb] = [await W(A), await W(B)];
check("both sat; one drives; the count, then the bout on both tabs", both && wa.driver !== wb.driver && wa.foe?.name === "wrestler_b" && wb.foe?.name === "wrestler_a", JSON.stringify({ wa, wb }));
const driver = wa.driver ? A : B, follower = wa.driver ? B : A;
// the follower mashes in the green; the driver does nothing
let gap = 0, spect = [];
for (let i = 0; i < 50 && (await W(driver)).phase === "bout"; i++) {
  await follower.evaluate(() => window.__trollAw.tap(true));
  await pumpAll([follower, driver], 100);
  const [d, f] = [await W(driver), await W(follower)];
  if (d.phase === "bout" && f.phase === "bout") gap = Math.max(gap, Math.abs(d.m - f.m));
  if (!spect.length) spect = await driver.evaluate(() => window.__trollAw.state().peers.filter((q) => q.ph === "bout"));
}
await until([A, B], async () => (await W(driver)).phase === "end" && (await W(follower)).phase === "end", 4000);
const [dE, fE] = [await W(driver), await W(follower)];
check("the other player's pushes reach the driver: they win", dE.w === fE.side && fE.w === fE.side, JSON.stringify({ dE, fE }));
check("the meter on both tabs agrees (within 0.35 while it moves)", gap < 0.35, gap.toFixed(3));
check("the driver poses the other player's body in the bout too (peer aw stamp)", spect.length >= 1, JSON.stringify(spect));
await until([A, B], async () => (await W(driver)).seat === -1, 8000);
check("the loser (the driver) gets up, the winner stays", (await W(driver)).seat === -1 && (await W(follower)).seat >= 0, JSON.stringify({ d: await W(driver), f: await W(follower) }));

// ── 6. Trolling Loud's table ─────────────────────────────────────────────
await B.close();
await A.evaluate(async () => { const T = window.__trollOps; T.setMode("social"); T.loadout.mapId = "trollingloud"; await T.startGame(); });
await A.waitForFunction(() => !window.__trollOps.loadState().open, null, { timeout: 420000 });
await pumpAll([A], 3000);
const TL = (await A.evaluate(() => window.__trollAw.tables()))[0];
check("Trolling Loud has one too (the high-top by the coat check)", !!TL && Math.abs(TL.x - 17.2) < 0.01, JSON.stringify(TL));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(failures ? `${failures} failed` : "all passed");
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
