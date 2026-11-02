// Troll Forces Socialize: Kabukigrin's candle lines (docs/CANDLE-LINES.md;
// maps/kabukigrin-lines.js, modes/social-lines.js, view/stonks-fx.js).
// Tabs share a room, Supabase blocked (never a live room); the rush is
// shortened (window.__trollStonksTune), the cooldown and the VIPs' timer
// too (window.__trollLinesTune).
//   1. The tatami room's three tables have their props; rule 9: from a grid
//      of eye points in the room, nothing on the tables stands between an
//      eye and the koi tank, the noren, the lattice window or the doors;
//      every prop sits on a table top, inside its footprint.
//   2. By table 1 as a VIP: "Cut a line"; hold X; the eye goes down over
//      the mirror, the props run, the body leans (third person); at the end
//      the rush is on: faster, the chart up, STONKS; then the rug pull:
//      slower, RUGGED; then back to normal; the cooldown prompt.
//   3. Move mid-line: it stops, the powder stays ("Finish the line"); hold X
//      finishes it.
//   4. Two tabs: B sees A's line on the same table and A's body on it.
//   5. A VIP does a line on his own when the room's clock says so.
//   Screenshots in tools/.lines-shots: the props at each beat, the hands,
//   the body, the rush and the rug pull.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-lines-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, "tools", ".lines-shots");
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
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());
const errors = [];

async function open(label, username) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await page.addInitScript(() => {
    window.__trollStonksTune = { rush: 7, rug: 3, out: 0.6 };
    window.__trollLinesTune = { cooldownSecs: 6, npcFirst: 9999, npcEvery: 9999 };
  });
  await page.addInitScript((name) => {
    const fake = { getCachedProfile: () => ({ username: name, tags: [] }) };
    Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => fake, set: () => {} });
  }, username);
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 480000 });
  await page.waitForFunction(() => !!window.__trollOps && !!window.__trollLines && !!window.__trollStonks, null, { timeout: 480000 });
  await page.evaluate(() => window.__trollOps.setLoadWaitMax(8));
  return page;
}
async function join(page) {
  await page.evaluate(async () => {
    const T = window.__trollOps;
    T.setMode("social");
    T.loadout.mapId = "kabukigrin";
    await T.startGame();
    if (T.isStaging?.()) T.endStaging();
    T.player.maxHp = T.player.hp = 1e9;
  });
  await page.waitForFunction(() => !window.__trollOps.loadState().open, null, { timeout: 480000 });
  await pumpAll([page], 2500);
  // out of the club's line, a VIP band on (the tatami room is guarded)
  await page.evaluate(() => {
    const C = window.__trollClub; if (C && C.club.phase !== "none") C.leave();
    C.club.band = C.BAND.vip; C.club.room = window.__trollOps.net?.room ?? "solo";
    window.__trollOps.els.pause.hidden = true;
  });
}
const rp = (page) => page.evaluate(() => window.__trollOps.rp());
const LS = (page) => page.evaluate(() => window.__trollLines.state());
const SS = (page) => page.evaluate(() => window.__trollStonks.state());
const tables = (page) => page.evaluate(() => window.__trollLines.tables());
async function holdRp(page, others, done, ms = 6000) {
  await page.keyboard.down("x");
  const t0 = Date.now();
  while (Date.now() - t0 < ms && !(await done())) await pumpAll([page, ...others], 150);
  await page.keyboard.up("x");
  await pumpAll([page, ...others], 120);
}
const putAt = (page, x, z, y, yaw = 0, pitch = 0) => page.evaluate(({ x, z, y, yaw, pitch }) => {
  const T = window.__trollOps;
  T.move.reset(x, z, y); T.look.yaw = yaw; T.look.pitch = pitch;
}, { x, z, y, yaw, pitch });
const until = async (pages, f, ms = 12000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f()) return true; await pumpAll(pages, 150); } return false; };
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });

const A = await open("A", "liner_a");
await join(A);
await pumpAll([A], 2000);

// ── 1. The tables, and rule 9 ───────────────────────────────────────────
const TB = await tables(A);
check("the tatami room has three line tables", TB?.length === 3, JSON.stringify(TB?.map((t) => [t.x, t.z])));
const boxes = await A.evaluate(() => window.__trollLines.boxes());
check("the props are built (boxes)", boxes.length > 30, `${boxes.length} boxes`);
// every prop on a table top, inside its footprint, under 9 cm
const TABLES = [[-29.9, 25.9, 1.2, 0.8], [-29.9, 28.3, 1.2, 0.8], [-24.9, 27.0, 0.9, 1.2]];
const onTable = boxes.every((b) => b[1] >= 0.745 && b[4] <= 0.75 + 0.09 && TABLES.some(([x, z, w, d]) => b[0] >= x - w / 2 - 0.01 && b[3] <= x + w / 2 + 0.01 && b[2] >= z - d / 2 - 0.01 && b[5] <= z + d / 2 + 0.01));
check("rule 9: every prop sits on a table top, inside it, under 9 cm", onTable, JSON.stringify(boxes.filter((b) => !(b[1] >= 0.745 && b[4] <= 0.84)).slice(0, 3)));
// segment vs box: nothing between the eyes and the room's faces
function segHitsBox(a, b, B) {
  let t0 = 0, t1 = 1;
  for (let i = 0; i < 3; i++) {
    const d = b[i] - a[i], lo = B[i], hi = B[i + 3];
    if (Math.abs(d) < 1e-9) { if (a[i] < lo || a[i] > hi) return false; continue; }
    let u0 = (lo - a[i]) / d, u1 = (hi - a[i]) / d;
    if (u0 > u1) [u0, u1] = [u1, u0];
    t0 = Math.max(t0, u0); t1 = Math.min(t1, u1);
    if (t0 > t1) return false;
  }
  return true;
}
// eye points: anywhere in the room a player can be (not over a table); a
// ray the table itself blocks says nothing about the props on it
// (a ray skimming within 2 cm of a table top is the table's own grazing view, not a prop's)
const tableBox = ([x, z, w, d]) => [x - w / 2, 0.3, z - d / 2, x + w / 2, 0.77, z + d / 2];
const overTable = (x, z) => TABLES.some(([tx, tz, w, d]) => Math.abs(x - tx) < w / 2 + 0.25 && Math.abs(z - tz) < d / 2 + 0.25);
const eyes = [];
for (let x = -31.3; x <= -24.4; x += 0.45) for (let z = 24.5; z <= 29.6; z += 0.45) for (const h of [0.62, 0.95, 1.6]) if (!overTable(x, z)) eyes.push([x, 0.3 + h, z]);
const faces = [];
const grid = (f, n = 7) => { for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) faces.push(f(i / n, j / n)); };
grid((u, v) => [-31.2, 0.8 + 1.5 * v, 24.7 + 4.8 * u]);        // the koi tank
grid((u, v) => [-28.2 + 2.4 * u, 1.9 + 0.7 * v, 29.78]);       // the noren
grid((u, v) => [-31.7 + 3.5 * u, 1.5 + 1.0 * v, 24.0]);        // the lattice window
grid((u, v) => [-28.2 + 2.4 * u, 0.2 + 2.6 * v, 24.21]);       // the hall door
grid((u, v) => [-28.2 + 2.4 * u, 0.2 + 2.4 * v, 29.84]);       // the kitchen door
let blocked = 0, rays = 0, sample = null;
for (const e of eyes) for (const f of faces) {
  if (TABLES.some((T) => segHitsBox(e, f, tableBox(T)))) continue;
  rays++;
  for (const B of boxes) if (segHitsBox(e, f, B)) { blocked++; sample ??= { e, f, B }; break; }
}
check("rule 9: no prop between any eye point and the tank, noren, window or doors", blocked === 0, `${blocked} of ${rays} rays, e.g. ${JSON.stringify(sample)}`);

// ── 2. A line, the rush, the rug pull ───────────────────────────────────
const T0 = TB[0];
await putAt(A, T0.at.x, T0.at.z, 0.3, T0.at.yaw, 0.25);
await pumpAll([A], 500);
let s = await rp(A);
check("by table 1: Cut a line", /cut a line/i.test(s.prompt || ""), s.prompt);
await shot(A, "01-prompt");
await putAt(A, T0.at.x, T0.at.z, 0.3, T0.at.yaw, -0.62);
await pumpAll([A], 400);
await shot(A, "00-tray");
await putAt(A, T0.at.x, T0.at.z, 0.3, T0.at.yaw, 0.0);
await pumpAll([A], 300);
await holdRp(A, [], async () => (await LS(A)).phase === "line");
let l = await LS(A);
check("hold X: on a line at table 1", l.phase === "line" && l.tb === 0, JSON.stringify(l));
const eye0 = l.eye;
await until([A], async () => (await LS(A)).t > 0.7, 3000);
l = await LS(A);
check("leaning in: the eye drops and the camera pitches down at the mirror", l.eye < 1.2 && l.cam.pitch < -0.6, JSON.stringify({ eye0, eye: l.eye, cam: l.cam }));
const tb0 = (await tables(A))[0];
check("the table's props run for the line (started, by me, hand hidden in first person)", !!tb0.st.start && tb0.st.by === "me" && tb0.st.hideHand, JSON.stringify(tb0.st));
const beatShots = [["02-candle", 1.0], ["03-crush", 1.75], ["04-cut", 3.3], ["05-bill", 4.15]];
for (const [name, t] of beatShots) {
  await A.evaluate((t) => window.__trollLines.setT(t), t);
  await pumpAll([A], 350);
  await shot(A, name);
}
console.log("fp arms:", JSON.stringify(await A.evaluate(() => { const T = window.__trollOps; const a = T.streakArms.userData.arms; return { ...T.socialArms(), vis: T.streakArms.visible, rods: a.map((x) => x.rod.visible), hands: a.map((x) => x.hand.position.toArray().map((v) => +v.toFixed(2))) }; })));
// the body in third person, mid-cut
await A.evaluate(() => { window.__trollLines.setT(2.6); window.__trollOps.toggleThirdPerson(); });
await pumpAll([A], 200);
await A.evaluate(() => window.__trollLines.setT(2.9));
await pumpAll([A], 120);
await shot(A, "08-body-3p");
await A.evaluate(() => { window.__trollLines.setT(4.4); });
await pumpAll([A], 120);
await shot(A, "09-body-3p-snort");
await A.evaluate(() => window.__trollOps.toggleThirdPerson());
await A.evaluate(() => window.__trollLines.setT(4.7));
await pumpAll([A], 200);
await shot(A, "06-snort");
await A.evaluate(() => window.__trollLines.setT(5.15));
await pumpAll([A], 150);
await shot(A, "07-snap");
await A.evaluate(() => window.__trollLines.setT(5.7));
await until([A], async () => (await LS(A)).done >= 1, 4000);
l = await LS(A);
let st = await SS(A);
check("the line's done: the rush is on", l.done === 1 && l.phase === null && st.on && st.phase === 1, JSON.stringify({ l, st }));
s = await rp(A);
check("the cooldown prompt", /market's closed/i.test(s.prompt || ""), s.prompt);
await pumpAll([A], 900);
st = await SS(A);
check("the rush: faster, saturated, the chart up, STONKS", st.speed > 1.2 && st.sat > 1.3 && st.candles > 2 && st.stamp === "STONKS" && st.lineFx === 1, JSON.stringify(st));
await shot(A, "10-rush");
await A.evaluate(() => window.__trollOps.toggleThirdPerson());
await pumpAll([A], 300);
await shot(A, "11-rush-3p-nose");
await A.evaluate(() => window.__trollOps.toggleThirdPerson());
await until([A], async () => (await SS(A)).phase === 2, 8000);
await pumpAll([A], 1300);
st = await SS(A);
check("the rug pull: slower, drained, RUGGED", st.phase === 2 && st.speed < 0.9 && st.sat < 0.9 && st.stamp === "RUGGED" && st.lineFx === 2, JSON.stringify(st));
await shot(A, "12-rug");
await until([A], async () => !(await SS(A)).on, 8000);
st = await SS(A);
check("then back to normal", !st.on && Math.abs(st.speed - 1) < 0.01 && st.lineFx === 0 && Math.abs(st.sat - 1) < 0.2, JSON.stringify(st));
const tb0b = (await tables(A))[0];
check("the table's clear again", !tb0b.st.start, JSON.stringify(tb0b.st));

// ── 3. Stop mid-line, finish it ─────────────────────────────────────────
await until([A], async () => (await LS(A)).cd === 0, 9000);
const T1 = TB[1];
await putAt(A, T1.at.x, T1.at.z, 0.3, T1.at.yaw, 0.25);
await pumpAll([A], 400);
await holdRp(A, [], async () => (await LS(A)).phase === "line");
await until([A], async () => (await LS(A)).t > 2.1, 4000);
await A.keyboard.down("w");
await pumpAll([A], 400);
await A.keyboard.up("w");
l = await LS(A);
let tb1 = (await tables(A))[1];
check("moving mid-line stops it; the powder stays on the mirror", l.phase === null && l.cancelAt > 1.5 && tb1.st.cancelAt > 1.5, JSON.stringify({ l, st: tb1.st }));
await shot(A, "13-leftover");
await putAt(A, T1.at.x, T1.at.z, 0.3, T1.at.yaw, 0.25);
await pumpAll([A], 400);
s = await rp(A);
check("by it again: Finish the line", /finish the line/i.test(s.prompt || ""), s.prompt);
await holdRp(A, [], async () => (await LS(A)).phase === "line");
l = await LS(A);
check("finishing picks up at the bill", l.phase === "line" && l.t >= 3.4, JSON.stringify(l));
await until([A], async () => (await LS(A)).done >= 2, 6000);
l = await LS(A);
check("...and ends in a second rush", l.done === 2, JSON.stringify(l));
await A.evaluate(() => window.__trollStonks.end());

// ── 4. Two tabs ─────────────────────────────────────────────────────────
const B = await open("B", "liner_b");
await join(B);
await pumpAll([A, B], 4000);
await until([A], async () => !(await SS(A)).on && (await LS(A)).cd === 0, 6000);
const T2 = TB[2];
await putAt(B, T2.x - 0.3, T2.z - 1.7, 0.3, Math.PI + 0.25, -0.15);
await putAt(A, T2.at.x, T2.at.z, 0.3, T2.at.yaw, 0.25);
await pumpAll([A, B], 600);
await holdRp(A, [B], async () => (await LS(A)).phase === "line");
const seen = await until([A, B], async () => (await LS(B)).peers.some((p) => p.tb === 2), 5000);
const lb = await LS(B), tbB = (await tables(B))[2];
check("B sees A's line on table 3 (the message, the table's props run)", seen && tbB.st.start > 0 && tbB.st.by && tbB.st.by !== "me", JSON.stringify({ peers: lb.peers, st: tbB.st }));
await pumpAll([A, B], 1200);
await shot(B, "14-peer-body");
await until([A, B], async () => (await LS(A)).done >= 3, 8000);
await pumpAll([A, B], 1200);
const tbB2 = (await tables(B))[2];
check("B's copy clears when it's over", !tbB2.st.start, JSON.stringify(tbB2.st));
const fxSeen = await until([A, B], async () => (await B.evaluate(() => [...window.__trollOps.net.peers.values()].some((p) => p.lineFx === 1))), 4000);
check("B sees A's rush on the wire (the dusted nose)", fxSeen);
await A.evaluate(() => window.__trollStonks.end());

// ── 5. A VIP does one ───────────────────────────────────────────────────
await A.evaluate(() => window.__trollLines.npcNow());
const npcOn = await until([A, B], async () => (await LS(A)).npcs.length > 0, 5000);
const la = await LS(A);
const npcTb = la.npcs[0]?.tb;
const npc = la.npcs[0] ? await A.evaluate((i) => { const n = window.__trollOps.townNpcs().list[i]; return { name: n.c.name, role: n.c.role, over: !!n.override }; }, la.npcs[0].i) : null;
check("a VIP at a table does a line (taken over, the table running)", npcOn && npc?.role === "VIP" && npc.over, JSON.stringify({ npcs: la.npcs, npc }));
await putAt(A, -27.2, 27.0, 0.3, Math.PI / 2 + (npcTb === 1 ? -0.4 : 0.4), 0.15);
await pumpAll([A, B], 1500);
await shot(A, "15-vip-line");
const bSees = await until([B], async () => (await LS(B)).npcs.length > 0, 3000);
check("B runs the same VIP from the message", bSees);
await until([A], async () => (await LS(A)).npcs.length === 0, 9000);
const released = la.npcs[0] ? await A.evaluate((i) => !window.__trollOps.townNpcs().list[i].override, la.npcs[0].i) : false;
check("...and goes back to his drink after", released);

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
