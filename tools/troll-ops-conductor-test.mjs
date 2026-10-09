// Troll Forces Socialize, Troll City: the conductor and the synced Grin
// Express (TROLL-CITY-RP2.md, phase 2d; modes/social-conductor.js,
// modes/room-clock.js, modes/social-train.js).
//
// Two tabs share the QSOC room over BroadcastChannel (Supabase blocked).
// B's device clock runs 1.5 s fast:
//   1. The room clock: B's train runs on A's (the keeper's) time.
//   2. A takes the cap off its stand: A is the conductor, Conductor Choo
//      steps off on both tabs, B sees the cap on A's head.
//   3. The train standing, 8 s to go: A calls "all aboard" from the
//      platform: both tabs' trains wait the same extra time; a second
//      hold that stop is refused.
//   4. A in the cab pulls the whistle: B hears it.
//   5. Both aboard car 1: A punches B's ticket.
//   6. The train pulls out: on B's screen A rides on the deck where A
//      really is, not trailing off the back.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-conductor-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, "tools", ".conductor-shots");
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
async function pump(page, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) await page.screenshot({ type: "jpeg", quality: 10 }).catch(() => {});
}
async function pumpBoth(a, b, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    await a.screenshot({ type: "jpeg", quality: 10 }).catch(() => {});
    await b.screenshot({ type: "jpeg", quality: 10 }).catch(() => {});
  }
}
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
await ctx.route(/supabase/, (r) => r.abort());
const errors = [];

async function open(label, username, skewMs = 0) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await page.addInitScript(({ name, skewMs }) => {
    const fake = { getCachedProfile: () => ({ username: name, tags: [] }) };
    Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => fake, set: () => {} });
    const real = Date.now.bind(Date);
    window.__realNow = real;
    if (skewMs) Date.now = () => real() + skewMs;   // this device's clock is off
  }, { name: username, skewMs });
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 420000 });
  await page.waitForFunction(() => !!window.__trollOps && !!window.__trollConductor, null, { timeout: 420000 });
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
  await page.evaluate(() => { window.__trollOps.els.pause.hidden = true; });
}
const rp = (page) => page.evaluate(() => window.__trollOps.rp());
async function holdRp(page, done, ms = 20000) {
  await page.keyboard.down("x");
  const t0 = Date.now();
  let s = await rp(page);
  while (Date.now() - t0 < ms && !(await done(s))) { await pump(page, 250); s = await rp(page); }
  await page.keyboard.up("x");
  await pump(page, 150);
  return rp(page);
}
const putAt = (page, x, z, y, yaw = 0) => page.evaluate(({ x, z, y, yaw }) => {
  const T = window.__trollOps;
  T.move.reset(x, z, y); T.look.yaw = yaw;
}, { x, z, y, yaw });
/* The train as this tab has it, and the room clock against real time. */
const tr = (page) => page.evaluate(() => {
  const T = window.__trollOps, t = T.builtMap().map.rp.train(), C = window.__trollConductor;
  return { s: t.state.s, v: t.state.v, leaveIn: t.state.leaveIn, period: t.state.period, offset: t.offset, aboard: !!t.aboard,
    clockOff: C.roomNow() - window.__realNow(), tro: C.clock.tro, hseq: C.clock.hseq, heard: { ...C.cond.heard },
    cars: t.cars.map((c) => ({ ...c.pose })) };
});
/* Put both tabs' trains `u` seconds into the timetable (the same offset:
   they share the room clock). */
async function setClock(a, b, u) {
  const off = await a.evaluate((u) => {
    const t = window.__trollOps.builtMap().map.rp.train(), C = window.__trollConductor;
    const base = C.roomNow() / 1000 + C.clock.tro, P = t.state.period;
    return u - (((base % P) + P) % P);
  }, u);
  for (const p of [a, b]) await p.evaluate((o) => { window.__trollOps.builtMap().map.rp.train().offset = o; }, off);
}
/* A car-local spot (on `car`'s deck at height y) in the world, on this tab. */
const deckSpot = (page, car, lx, lz) => page.evaluate(({ car, lx, lz }) => {
  const c = window.__trollOps.builtMap().map.rp.train().cars[car].pose, cs = Math.cos(c.ry), sn = Math.sin(c.ry);
  return { x: c.x + lx * cs + lz * sn, z: c.z - lx * sn + lz * cs };
}, { car, lx, lz });

const A = await open("A", "conductor_a");
const B = await open("B", "rider_b", 1500);
await join(A);
await join(B);
await pumpBoth(A, B, 5000);
const [idA, idB] = await Promise.all([A, B].map((p) => p.evaluate(() => window.__trollOps.net.id)));

// ── 1. The room clock ────────────────────────────────────────────────────
let a = await tr(A), b = await tr(B);
check("A (oldest in the room) keeps the clock: its room time is its own", Math.abs(a.clockOff) < 150, `${a.clockOff.toFixed(0)} ms`);
check("B's device runs 1.5 s fast, but its room time is A's", Math.abs(b.clockOff) < 250, `${b.clockOff.toFixed(0)} ms off real time`);

// ── 2. The cap ───────────────────────────────────────────────────────────
const stand = await A.evaluate(() => window.__trollOps.builtMap().map.rp.conductor.stand);
await putAt(A, stand.x, stand.z - 0.7, stand.floor, Math.PI);
await pump(A, 400);
let s = await rp(A);
check("at the stand: take the conductor's cap", /conductor's cap/i.test(s.prompt || ""), s.prompt);
s = await holdRp(A, (s) => s.role === "conductor");
check("holding X there makes A the conductor", s.role === "conductor", JSON.stringify(s.role));
await pumpBoth(A, B, 1200);
const choo = await Promise.all([A, B].map((p) => p.evaluate(() => window.__trollOps.townNpcs().list.find((n) => n.c.role === "Conductor")?.rig.root.visible)));
check("Conductor Choo steps off, on both tabs", choo[0] === false && choo[1] === false, JSON.stringify(choo));
const capA = await A.evaluate(() => ({ head: window.__trollOps.localRig.jobHatKind, stand: window.__trollOps.builtMap().map.rp.conductor.capOn }));
check("A wears the cap; it's off its stand", capA.head === "conductor" && capA.stand === false, JSON.stringify(capA));
const capB = await B.evaluate((id) => {
  const T = window.__trollOps, r = T.remotes.byId.get(id);
  return { role: T.net.peers.get(id)?.role, head: r?.rig.jobHatKind, stand: T.builtMap().map.rp.conductor.capOn };
}, idA);
check("B sees A in the job with the cap on, and the stand empty", capB.role === "conductor" && capB.head === "conductor" && capB.stand === false, JSON.stringify(capB));

// ── 3. All aboard: the hold ──────────────────────────────────────────────
await setClock(A, B, 17);   // 8 s till it leaves
await putAt(A, -10, -26.3, 0.3, 0);
await pumpBoth(A, B, 500);
s = await rp(A);
check("on the platform, 8 s to go: call all aboard", /all aboard/i.test(s.prompt || ""), s.prompt);
const before = (await tr(A)).leaveIn;
s = await holdRp(A, async () => (await tr(A)).hseq >= 1);
await pumpBoth(A, B, 800);
a = await tr(A); b = await tr(B);
check("the train waits longer (A)", a.leaveIn > before + 10, `${before.toFixed(1)} -> ${a.leaveIn.toFixed(1)}`);
check("B heard the hold: same count, same slide", b.hseq === 1 && Math.abs(b.tro - a.tro) < 0.01 && b.heard.hold === 1, JSON.stringify({ a: a.tro, b: b.tro, hseq: b.hseq }));
check("both trains leave at the same moment", Math.abs(a.leaveIn - b.leaveIn) < 0.6, `${a.leaveIn.toFixed(2)} vs ${b.leaveIn.toFixed(2)}`);
s = await rp(A);
check("a second hold that stop is refused", !/all aboard/i.test(s.prompt || "") && (await A.evaluate(() => window.__trollConductor.holdable())) === 0, s.prompt);
await pumpBoth(A, B, 2500);   // the keeper's next time check keeps the hold
b = await tr(B);
check("after the keeper's next time check B still has the hold", b.hseq === 1 && Math.abs(b.tro - a.tro) < 0.01, JSON.stringify({ tro: b.tro }));

// ── 4. The whistle ───────────────────────────────────────────────────────
let w = await deckSpot(A, 0, 3.3, 0);
await putAt(A, w.x, w.z, 1.15, Math.PI / 2);
await pump(A, 600);
s = await rp(A);
check("in the cab: pull the whistle", /whistle/i.test(s.prompt || ""), s.prompt);
s = await holdRp(A, async () => (await tr(B)).heard.whistle >= 1, 6000);
await pumpBoth(A, B, 400);
check("B hears the whistle", (await tr(B)).heard.whistle >= 1);

// ── 5. A ticket ──────────────────────────────────────────────────────────
w = await deckSpot(A, 1, 1.0, 0);
await putAt(B, w.x, w.z, 0.9, Math.PI / 2);
w = await deckSpot(A, 1, -0.2, 0);
await putAt(A, w.x, w.z, 0.9, -Math.PI / 2);
await pumpBoth(A, B, 1200);
s = await rp(A);
check("beside B aboard: punch B's ticket", /punch .*ticket/i.test(s.prompt || ""), s.prompt);
s = await holdRp(A, async () => (await tr(B)).heard.punch >= 1, 6000);
await pumpBoth(A, B, 300);
check("B's ticket is punched", (await tr(B)).heard.punch >= 1);
await A.screenshot({ path: path.join(SHOTS, "1-punch.png") });

// ── 6. Riding: A on the deck on B's screen ───────────────────────────────
// Away it goes (both stay where they stand on car 1).
await setClock(A, B, 24.5);
let maxOff = 0, samples = 0, moved = 0;
const t0 = Date.now();
let first = null;
while (Date.now() - t0 < 12000) {
  await pumpBoth(A, B, 300);
  const r = await B.evaluate((id) => {
    const T = window.__trollOps, rr = T.remotes.byId.get(id), t = T.builtMap().map.rp.train(), c = t.cars[1].pose;
    const dx = rr.pos.x - c.x, dz = rr.pos.z - c.z, cs = Math.cos(c.ry), sn = Math.sin(c.ry);
    return { v: t.state.v, lx: dx * cs - dz * sn, lz: dx * sn + dz * cs, at: T.net.peers.get(id)?.trainAt, x: c.x, z: c.z };
  }, idA);
  if (!first) first = r;
  moved = Math.hypot(r.x - first.x, r.z - first.z);
  if (r.v > 4) { samples++; maxOff = Math.max(maxOff, Math.hypot(r.lx - -0.2, r.lz)); }
}
check("the train pulls out with both aboard", moved > 20 && samples > 5, `${moved.toFixed(1)} m, ${samples} fast samples`);
check("on B's screen A stays where A stands on the car (< 0.6 m)", maxOff < 0.6, `${maxOff.toFixed(2)} m off at worst`);
await B.screenshot({ path: path.join(SHOTS, "2-b-sees-a-riding.png") });
a = await tr(A); b = await tr(B);
check("both still aboard", a.aboard && b.aboard, JSON.stringify({ a: a.aboard, b: b.aboard }));

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(failures ? `${failures} failed` : "all passed");
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
