// Troll Forces Socialize: Kabukigrin's candle lines, v2 at the security
// room's desk (docs/KB-SECURITY-ROOM.md 5; maps/kabukigrin-lines.js,
// modes/social-lines.js, view/stonks-fx.js). Tabs share a room, Supabase
// blocked (never a live room); the rush is shortened
// (window.__trollStonksTune), the cooldown and Lurk's timer too
// (window.__trollLinesTune).
//   1. The station's props sit on the desk's glass, under the monitor
//      wall's lower edge; the tatami tables have none any more.
//   2. In the chair as a VIP (the VIP band opens the office now): "Pull a
//      candle"; hold X; the camera turns to the chart, the candle comes out
//      of it, the bottle rolls, the card chops and flies, the face goes down,
//      STONKS (the rush) as it comes up, then up through the roof (35 m),
//      back down behind the desk, over it, on your feet; the arm's green;
//      the cooldown prompt; then the rug pull and back to normal.
//   3. Get up mid-line: it stops, the powder stays ("Finish the line").
//   4. Two tabs: B sees A's line, A's flight on the wire.
//   5. Lurk does one on his own when the room's clock says so, and goes
//      back to his spot after.
//   Screenshots in tools/.lines-shots: each beat first person, the body third
//   person, the flight, the climb, B's view, Lurk.
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
    window.__trollStonksTune = { rush: 12, rug: 3, out: 0.6 };
    window.__trollLinesTune = { cooldownSecs: 25, npcFirst: 9999, npcEvery: 9999 };
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
  // out of the club's line, a VIP band on (the office opens to it)
  await page.evaluate(() => {
    const C = window.__trollClub; if (C && C.club.phase !== "none") C.leave();
    C.club.band = C.BAND.vip; C.club.room = window.__trollOps.net?.room ?? "solo";
    window.__trollOps.els.pause.hidden = true;
  });
}
const rp = (page) => page.evaluate(() => window.__trollOps.rp());
const LS = (page) => page.evaluate(() => window.__trollLines.state());
const SS = (page) => page.evaluate(() => window.__trollStonks.state());
const ST = (page) => page.evaluate(() => window.__trollLines.station());
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
// to the chair: stand behind it, hold X to sit
async function sit(page, others = []) {
  const s = await ST(page);
  await putAt(page, s.seat.x, s.seat.z + 0.7, 3, 0, 0);
  await pumpAll([page, ...others], 400);
  const p = await rp(page);
  await holdRp(page, others, async () => (await LS(page)).inChair, 4000);
  return p.prompt;
}

const A = await open("A", "liner_a");
await join(A);
await pumpAll([A], 2000);

// ── 1. The station ───────────────────────────────────────────────────────
const S0 = await ST(A);
check("the line's station is at the security desk", !!S0 && Math.abs(S0.x + 9.75) < 0.05 && Math.abs(S0.top - 3.756) < 0.02, JSON.stringify(S0));
const boxes = await A.evaluate(() => window.__trollLines.boxes());
const onGlass = boxes.every((b) => b[1] >= 3.74 && b[4] <= 4.4 && b[0] >= -10.65 && b[3] <= -8.95 && b[2] >= 19.45 && b[5] <= 20.12);
check("rule 9: every prop at rest lies on the desk's glass, under the monitor wall (4.55)", onGlass && boxes.length >= 1, JSON.stringify(boxes.filter((b) => !(b[1] >= 3.74 && b[4] <= 4.4)).slice(0, 3)));

// ── 2. A line ────────────────────────────────────────────────────────────
const sitPrompt = await sit(A);
let l = await LS(A);
check("the VIP band gets into the office and the chair (Sit down)", l.inChair, `${sitPrompt} ${JSON.stringify(l.pos)}`);
let s = await rp(A);
check("in the chair: Pull a candle", /pull a candle/i.test(s.prompt || ""), s.prompt);
await shot(A, "00-chair");
await holdRp(A, [], async () => (await LS(A)).phase === "line");
l = await LS(A);
check("hold X: on a line", l.phase === "line", JSON.stringify(l));
// sampled every frame: the screenshots are too slow to land in the window
for (let n = 0; n < 200; n++) { l = await LS(A); if (l.t > 0.7) break; await A.waitForTimeout(16); }
check("leaning in: the camera turns to the chart (left, down)", l.cam.yaw > 0.2, JSON.stringify(l.cam));
// each beat in order (never back past the launch: getting up before the plant stops it)
const beatShots = [["01-reach", 0.95], ["02-pull", 1.5], ["03-roll", 2.45], ["08-body-roll-3p", 2.55, true], ["04-chop", 3.45], ["05-flick", 4.05],
  ["09-body-plant-3p", 4.35, true], ["06-plant", 4.45], ["07-snap", 4.95]];
for (const [name, t, tp] of beatShots) {
  await A.evaluate(({ t, tp }) => { const T = window.__trollOps; if (!!tp !== !!T.isThirdPerson?.() && tp) T.toggleThirdPerson(); window.__trollLines.setT(t); }, { t, tp });
  await pumpAll([A], 120);
  // (pinned again: the screenshots are slow, the act mustn't run on meanwhile)
  await A.evaluate((t) => window.__trollLines.setT(t), t);
  await shot(A, name);
  await A.evaluate((t) => window.__trollLines.setT(t), t);
  if (tp) await A.evaluate(() => window.__trollOps.toggleThirdPerson());
}
l = await LS(A);
check("the rush starts as the head comes up (STONKS)", l.done === 1 && (await SS(A)).on, JSON.stringify({ l, st: await SS(A) }));
check("...and the arm's green", l.green > 0.9, String(l.green));
// the launch
await A.evaluate(() => window.__trollLines.setT(5.6));
await pumpAll([A], 300);
l = await LS(A);
check("the launch: out of the chair and straight up", l.stood && !l.inChair && l.pos[1] > 3 + 15, JSON.stringify(l.pos));
await shot(A, "10-launch");
await A.evaluate(() => { window.__trollOps.toggleThirdPerson(); window.__trollLines.setT(5.95); });
await pumpAll([A], 150);
await shot(A, "12-apex-3p");
await A.evaluate(() => window.__trollOps.toggleThirdPerson());
// the rest of the flight in real time, sampled every frame (screenshots are
// too slow to land on a beat): the highest point, the pitch there, and
// the first sample back on the floor
await A.evaluate(() => window.__trollLines.setT(5.7));
let top = { y: 0 }, low = null, shotApex = false;
for (let n = 0; n < 400; n++) {
  const q = await LS(A);
  if (q.pos[1] > top.y) top = { y: q.pos[1], pitch: q.cam.pitch, t: q.t };
  if (!shotApex && q.t > 6.1) { shotApex = true; await shot(A, "11-apex"); }
  if (q.t > 7.15 && q.t < 7.6 && !low) { low = { y: q.pos[1], z: q.pos[2], eye: q.eye, t: q.t }; await shot(A, "13-grab"); }
  if (q.t > 7.7 || q.phase === null) break;
  await A.waitForTimeout(16);
}
check("...about 35 m up at the apex, looking down on Kabukigrin", top.y > 3 + 30 && top.pitch < -0.6, JSON.stringify(top));
check("back down behind the desk, crouched", !!low && Math.abs(low.y - 3) < 0.05 && low.z > 20.2 && low.z < 20.7 && low.eye < 1.0, JSON.stringify(low));

await A.evaluate(() => { window.__trollOps.toggleThirdPerson(); window.__trollLines.setT(7.7); });
await pumpAll([A], 250);
await shot(A, "14-climb-3p");
await A.evaluate(() => window.__trollOps.toggleThirdPerson());
await until([A], async () => (await LS(A)).phase === null, 4000);
l = await LS(A);
check("over the desk, on your feet", l.phase === null && l.eye > 1.5 && !l.inChair, JSON.stringify({ eye: l.eye, pos: l.pos }));
let st = await SS(A);
check("the rush: faster, saturated, STONKS", st.speed > 1.2 && st.sat > 1.3 && st.lineFx === 1, JSON.stringify(st));
await shot(A, "15-rush");
await sit(A);
s = await rp(A);
check("back in the chair: the cooldown prompt", /market's closed/i.test(s.prompt || ""), s.prompt);
await until([A], async () => (await SS(A)).phase === 2, 25000);
await pumpAll([A], 1200);
st = await SS(A);
check("the rug pull: slower, drained, RUGGED", st.phase === 2 && st.speed < 0.95 && st.stamp === "RUGGED" && st.lineFx === 2, JSON.stringify(st));
await until([A], async () => !(await SS(A)).on, 20000);
check("then back to normal", !(await SS(A)).on);
await until([A], async () => (await LS(A)).green === 0, 6000);
check("...the arm's its own colour again", (await LS(A)).green === 0);

// ── 3. Get up mid-line, finish it ───────────────────────────────────────
await until([A], async () => (await LS(A)).cd === 0, 30000);
const done0 = (await LS(A)).done;
await holdRp(A, [], async () => (await LS(A)).phase === "line");
await until([A], async () => (await LS(A)).t > 2.7, 4000);
await A.keyboard.down("w");
await pumpAll([A], 400);
await A.keyboard.up("w");
l = await LS(A);
let stn = await ST(A);
check("getting up mid-line stops it; the powder stays on the glass", l.phase === null && l.cancelAt > 2.4 && stn.st.cancelAt > 2.4, JSON.stringify({ l, st: stn.st }));
await shot(A, "16-leftover");
await sit(A);
s = await rp(A);
check("back in the chair: Finish the line", /finish the line/i.test(s.prompt || ""), s.prompt);
await holdRp(A, [], async () => (await LS(A)).phase === "line");
l = await LS(A);
check("finishing picks up at the drag", l.phase === "line" && l.t >= 3.6, JSON.stringify(l));
await until([A], async () => (await LS(A)).phase === null, 8000);
l = await LS(A);
check("...and ends in a second rush, on your feet", l.done === done0 + 1 && !l.inChair, JSON.stringify(l));
await A.evaluate(() => window.__trollStonks.end());

// ── 4. Two tabs ─────────────────────────────────────────────────────────
const B = await open("B", "liner_b");
await join(B);
await pumpAll([A, B], 4000);
await until([A], async () => (await LS(A)).cd === 0, 30000);
await putAt(B, -12.4, 22.9, 3, -0.9, -0.05);
await sit(A, [B]);
await holdRp(A, [B], async () => (await LS(A)).phase === "line");
const seen = await until([A, B], async () => (await LS(B)).peers.length > 0, 5000);
const sb = await ST(B);
check("B sees A's line (the message, the props run)", seen && sb.st.start > 0 && sb.st.by && sb.st.by !== "me", JSON.stringify(sb.st));
await pumpAll([A, B], 1800);
await shot(B, "17-peer-roll");
await A.evaluate(() => window.__trollLines.setT(5.9));
const flew = await until([A, B], async () => (await B.evaluate(() => [...window.__trollOps.net.peers.values()].some((p) => p.snaps?.some((q) => q.y > 15)))), 4000);
check("B sees A go up (the flight is A's position)", flew);
await until([A, B], async () => (await LS(A)).phase === null, 6000);
await pumpAll([A, B], 1200);
check("B's copy clears when it's over", !(await ST(B)).st.start);
await A.evaluate(() => window.__trollStonks.end());

// ── 5. Lurk does one ────────────────────────────────────────────────────
await A.keyboard.down("w"); await pumpAll([A, B], 300); await A.keyboard.up("w");
await putAt(A, -11.6, 22.9, 3, -0.7, -0.1);
await pumpAll([A, B], 500);
await A.evaluate(() => window.__trollLines.npcNow());
const npcOn = await until([A, B], async () => (await LS(A)).npcs.length > 0, 5000);
const la = await LS(A);
const npc = la.npcs[0] ? await A.evaluate((i) => { const n = window.__trollOps.townNpcs().list[i]; return { name: n.c.name, role: n.c.role, over: !!n.override }; }, la.npcs[0].i) : null;
const bSees = await until([B], async () => (await LS(B)).npcs.length > 0 || !!(await ST(B)).st.start, 3000);
check("B runs the same Lurk from the message", bSees);
check("Lurk does a line (taken over, the station running)", npcOn && npc?.name === "Lurk" && npc.over, JSON.stringify({ npcs: la.npcs, npc }));
await pumpAll([A, B], 2200);
await shot(A, "18-lurk-roll");
await until([A], async () => A.evaluate(() => { const s = window.__trollLines.station().st; return !!s.start && (performance.now() - s.start) / 1000 > 6.0; }), 6000);
await shot(A, "19-lurk-up");
await until([A], async () => (await LS(A)).npcs.length === 0, 9000);
const released = la.npcs[0] ? await A.evaluate((i) => !window.__trollOps.townNpcs().list[i].override, la.npcs[0].i) : false;
check("...and goes back to watching the monitors after", released);

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
