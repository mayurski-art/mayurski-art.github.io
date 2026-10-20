// Troll Forces Socialize, Troll City: horses to ride (TROLL-CITY-RP2.md 2c;
// modes/social-horses.js, view/horse-model.js). Two tabs, Supabase blocked:
//   1. Six rideable horses, four saddled, at home.
//   2. A mounts the black horse: the eye up at the saddle; turns, gallops
//      down the street; B sees the horse under A, galloping.
//   3. A gallops at the corral and jumps the rail; gets off with C: the
//      horse parked, A on foot.
//   4. After the (test-short) wait it walks home.
//   5. A takes the spare saddle (horsekeeper; Hay Jay steps off): saddles
//      the dun by the trough, B sees it saddled and rides it; A whistles a
//      horse over; brushes it (both tabs).
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-horse-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, "tools", ".horse-shots");
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
  await page.addInitScript(() => { window.__trollHorseTune = { home: 2 }; });
  await page.addInitScript(({ name, skewMs }) => {
    const fake = { getCachedProfile: () => ({ username: name, tags: [] }) };
    Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => fake, set: () => {} });
    const real = Date.now.bind(Date);
    window.__realNow = real;
    if (skewMs) Date.now = () => real() + skewMs;   // this device's clock is off
  }, { name: username, skewMs });
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 420000 });
  await page.waitForFunction(() => !!window.__trollOps && !!window.__trollHorses, null, { timeout: 420000 });
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


const A = await open("A", "rider_a");
const B = await open("B", "watcher_b");
await join(A);
await join(B);
await pumpAll([A, B], 5000);
const [idA, idB] = await Promise.all([A, B].map((p) => p.evaluate(() => window.__trollOps.net.id)));
const H = (page) => page.evaluate(() => window.__trollHorses.state());
const tune = (page, f) => page.evaluate(f);
const hold = async (page, others, ms) => { await page.keyboard.down("x"); await pumpAll([page, ...others], ms); await page.keyboard.up("x"); await pumpAll([page, ...others], 200); };
const dist = (h, x, z) => Math.hypot(h.x - x, h.z - z);

// ── 1. The horses ────────────────────────────────────────────────────────
let a = await H(A);
check("six rideable horses, four saddled", a.list.length === 6 && a.list.filter((h) => h.saddled).length === 4, JSON.stringify(a.list.map((h) => h.saddled)));
check("all at home, nobody on them", a.list.every((h) => h.rider == null && dist(h, h.home.x, h.home.z) < 0.1));

// ── 2. Mount, turn, gallop ───────────────────────────────────────────────
const h0 = a.list[0];
await putAt(A, h0.x + 0.2, h0.z + 1.6, 0, 0);
await pumpAll([A], 500);
let s = await rp(A);
check("by the black horse: mount it", /mount the black horse/i.test(s.prompt || ""), s.prompt);
await hold(A, [B], 800);
a = await H(A);
check("A's on it, the eye up at the saddle", a.mine === 0 && a.eye > 2.3, JSON.stringify({ mine: a.mine, eye: a.eye }));
// it faces the rail: back off a step, then turn to face east down the street
await A.keyboard.down("s"); await pumpAll([A, B], 700); await A.keyboard.up("s");
await A.keyboard.down("d");
for (let i = 0; i < 20 && (await H(A)).list[0].yaw > -1.5; i++) await pumpAll([A, B], 150);
await A.keyboard.up("d");
await pumpAll([A], 200);
a = await H(A);
const turned = a.list[0].yaw;
check("D turns it to the right (to face east)", turned < -1.4, String(turned));
const x0 = a.list[0].x, z0 = a.list[0].z;
await A.keyboard.down("ShiftLeft"); await A.keyboard.down("w");
await pumpAll([A, B], 2500);
const bSeen = await B.evaluate((id) => {
  const T = window.__trollOps, Hs = window.__trollHorses.horses, rp = T.remotes.byId.get(id), h = Hs.list[0];
  return { ho: T.net.peers.get(id)?.horse, rider: h.rider === id, gait: h.gait, off: rp ? Math.hypot(h.model.group.position.x - rp.pos.x, h.model.group.position.z - rp.pos.z) : 99 };
}, idA);
await A.screenshot({ path: path.join(SHOTS, "t-fp-gallop.png") });
await pumpAll([A, B], 1500);
await A.keyboard.up("w"); await A.keyboard.up("ShiftLeft");
await pumpAll([A, B], 1200);
a = await H(A);
check("a gallop down the street (> 20 m)", dist(a.list[0], x0, z0) > 20, `${dist(a.list[0], x0, z0).toFixed(1)} m`);
check("B sees the horse under A, galloping", bSeen.ho === 1 && bSeen.rider && bSeen.gait === 3 && bSeen.off < 0.6, JSON.stringify(bSeen));
await B.screenshot({ path: path.join(SHOTS, "t-b-sees-rider.png") });

// ── 3. Off on the street; home again ───────────────────────────────────
await A.keyboard.press("KeyC");
await pumpAll([A, B], 600);
a = await H(A);
for (let i = 0; i < 8 && a.eye >= 2; i++) { await pumpAll([A, B], 300); a = await H(A); }   // the eye eases down
check("C gets off: on foot beside it, the horse parked", a.mine === -1 && a.eye < 2 && a.list[0].parked && a.list[0].rider == null, JSON.stringify({ mine: a.mine, eye: a.eye, h: a.list[0] }));
check("B sees A off and the horse standing", (await B.evaluate((id) => window.__trollOps.net.peers.get(id)?.horse, idA)) === 0 && (await H(B)).list[0].rider == null);
const before = dist(a.list[0], h0.home.x, h0.home.z);
// home: 2 s (tuned), then it walks back up the street (headless frames run slow: poll)
let after = before;
for (let i = 0; i < 12 && !(after < before - 5 || after < 0.5); i++) {
  await pumpAll([A, B], 1000);
  a = await H(A);
  after = dist(a.list[0], h0.home.x, h0.home.z);
}
check("parked a while, it walks home", after < before - 5 || after < 0.5, `${before.toFixed(1)} -> ${after.toFixed(1)} m from home`);

// ── 4. The corral rail ───────────────────────────────────────────────────
// the bay this time, from inside the corral (the Studio town moved it to
// x -68..-52, z 44..58) at a gallop's speed, south over its rail at z 44
const h1 = a.list[1];
await putAt(A, h1.x + 0.2, h1.z + 1.6, 0, 0);
await pumpAll([A], 500);
await hold(A, [B], 800);
check("A's on the bay", (await H(A)).mine === 1);
await tune(A, () => { const Hs = window.__trollHorses.horses, h = Hs.list[Hs.mine]; h.x = -60; h.z = 51; h.y = 0; h.v = 10; h.yaw = 0; window.__trollOps.look.yaw = h.yaw; });
await pumpAll([A], 200);
await A.keyboard.down("ShiftLeft"); await A.keyboard.down("w");
let maxY = 0;
for (let i = 0; i < 30; i++) { await pumpAll([A], 100); const q = (await H(A)).list[1]; maxY = Math.max(maxY, q.y); if (i === 9) await A.screenshot({ path: path.join(SHOTS, "t-hop.png") }); if (q.z < 41) break; }
await A.keyboard.up("w"); await A.keyboard.up("ShiftLeft");
await pumpAll([A], 900);
a = await H(A);
check("a gallop clears the corral rail by itself", a.list[1].z < 43.5 && maxY > 0.6, JSON.stringify({ z: a.list[1].z, maxY }));
await A.keyboard.press("KeyC");
await pumpAll([A, B], 600);
check("and off again", (await H(A)).mine === -1);

// ── 5. The horsekeeper ───────────────────────────────────────────────────
const peg = await A.evaluate(() => window.__trollOps.builtMap().map.rp.horses().peg);
await putAt(A, peg.x + 0.8, peg.z, 0, Math.PI / 2);
await pumpAll([A], 500);
s = await rp(A);
check("at the peg: take the spare saddle", /spare saddle/i.test(s.prompt || ""), s.prompt);
await hold(A, [B], 900);
await pumpAll([A, B], 900);
check("A keeps the horses; Hay Jay steps off on both tabs", (await rp(A)).role === "horsekeeper" && (await npcVisible(A, "Hay Jay")) === false && (await npcVisible(B, "Hay Jay")) === false);
const h4 = (await H(A)).list[4];
await putAt(A, h4.x + 1.4, h4.z, 0, Math.PI / 2);
await pumpAll([A], 500);
s = await rp(A);
check("by the dun with no saddle: saddle it", /saddle the dun by the trough/i.test(s.prompt || ""), s.prompt);
// held till it's done (1.5 s of game time; a slow headless frame rate stretches it)
await holdRp(A, [B], async () => (await H(A)).list[4].saddled, 8000);
await pumpAll([A, B], 900);
check("saddled, on both tabs", (await H(A)).list[4].saddled && (await H(B)).list[4].saddled);
await putAt(B, h4.x - 1.4, h4.z, 0, -Math.PI / 2);
await pumpAll([B], 500);
s = await rp(B);
check("B can mount it now", /mount the dun by the trough/i.test(s.prompt || ""), s.prompt);
await holdRp(B, [A], async () => (await H(B)).mine === 4, 6000);
check("B rides it", (await H(B)).mine === 4);
await B.keyboard.press("KeyC"); await pumpAll([B, A], 500);
// a whistle: away from the horses
await putAt(A, -30, 0, 0, 0);
await pumpAll([A], 500);
s = await rp(A);
check("away from them: whistle one over", /whistle .* over/i.test(s.prompt || ""), s.prompt);
await hold(A, [B], 800);
await pumpAll([A, B], 600);
const called = (await H(A)).list.findIndex((h) => h.called);
check("a horse answers, on both tabs", called >= 0 && (await H(B)).list[called]?.called, JSON.stringify({ called, heardA: await A.evaluate(() => window.__trollHorses.horses.heard), list: (await H(A)).list.map((h) => [h.id, h.rider, h.called, h.parked]) }));
const hb = (await H(A)).list[called];
const d0 = hb ? Math.hypot(hb.x + 30, hb.z) : 0;
await pumpAll([A, B], 5000);
const hc = (await H(A)).list[called];
check("it comes to A (ends beside them)", hc && Math.hypot(hc.x + 30, hc.z) < 3.5, hc ? `${d0.toFixed(1)} -> ${Math.hypot(hc.x + 30, hc.z).toFixed(1)} m` : "none");
// brush it
if (hc) {
  await putAt(A, hc.x + 1.5, hc.z, 0, Math.PI / 2);
  await pumpAll([A], 400);
  s = await rp(A);
  check("by it: brush it down", /brush .* down/i.test(s.prompt || ""), s.prompt);
  await hold(A, [B], 2600);
  let both = false;
  for (let i = 0; i < 8 && !both; i++) {
    await pumpAll([A, B], 400);
    both = (await H(A)).list[called].brushed && (await H(B)).list[called].brushed;
  }
  check("brushed, on both tabs", both, JSON.stringify({ a: (await H(A)).list[called].brushed, b: (await H(B)).list[called].brushed, heardB: await B.evaluate(() => window.__trollHorses.horses.heard) }));
}

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(failures ? `${failures} failed` : "all passed");
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
