// Troll Forces Socialize, Grin Beach 5c: surfing (modes/social-surf.js,
// models/gb-surfboard.glb, characters/clips/surf-*.json). Two tabs,
// Supabase blocked:
//   1. At a rack: grab a board; it's under your arm; B sees it.
//   2. Wade past the seawall: on the board, paddling (eye low); W paddles;
//      B sees the paddle under A.
//   3. On a swell's face heading in: Space pops up, then rides; angled down
//      the line it carries you a fair way; B sees A riding.
//   4. C slides off: standing in the water, the board under the arm.
//   5. Back at the rack: put it back, no board.
//   Shots in tools/.surf-shots (third person) to judge the poses.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-surf-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, "tools", ".surf-shots");
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

async function open(label, username) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await page.addInitScript(({ name }) => {
    const fake = { getCachedProfile: () => ({ username: name, tags: [] }) };
    Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => fake, set: () => {} });
  }, { name: username });
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 420000 });
  await page.waitForFunction(() => !!window.__trollOps && !!window.__trollSurf, null, { timeout: 420000 });
  await page.evaluate(() => window.__trollOps.setLoadWaitMax(8));
  return page;
}
async function join(page) {
  await page.evaluate(async () => {
    const T = window.__trollOps;
    T.setMode("social");
    T.loadout.mapId = "grinbeach";
    await T.startGame();
  });
  await page.waitForFunction(() => !window.__trollOps.loadState().open, null, { timeout: 420000 });
  await page.evaluate(() => { window.__trollOps.els.pause.hidden = true; });
}
const rp = (page) => page.evaluate(() => window.__trollOps.rp());
const S = (page) => page.evaluate(() => window.__trollSurf.state());
const putAt = (page, x, z, y, yaw = 0) => page.evaluate(({ x, z, y, yaw }) => {
  const T = window.__trollOps;
  T.move.reset(x, z, y); T.look.yaw = yaw;
}, { x, z, y, yaw });
const hold = async (page, others, key, ms) => { await page.keyboard.down(key); await pumpAll([page, ...others], ms); await page.keyboard.up(key); await pumpAll([page, ...others], 200); };
/* What B draws of A: their surf state and whether a board sits under them. */
const seen = (page, id) => page.evaluate((id) => {
  const T = window.__trollOps, p = T.net.peers.get(id), b = window.__trollSurf.boards.get(id);
  const r = T.remotes.byId.get(id);
  // the board's middle from where A is drawn (A's head end, paddling)
  return { surf: p?.surf | 0, board: !!b?.mesh.parent, by: b ? +b.mesh.position.y.toFixed(2) : null,
    gap: b && r ? +Math.hypot(b.mesh.position.x - r.pos.x, b.mesh.position.z - r.pos.z).toFixed(2) : null };
}, id);
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
/* A third-person camera at a fixed spot looking at a point (the game's own
   camera placement is skipped for the frame by moving it after the render
   loop's update: take the shot right after). */
const camShot = async (page, name, from, at) => {
  // B stands at `from` (in the shallows or the surf) looking at `at`
  await page.evaluate(({ from, at }) => {
    const T = window.__trollOps;
    T.move.reset(from[0], from[2], 0);
    T.look.yaw = Math.atan2(-(at[0] - from[0]), -(at[2] - from[2]));
    T.look.pitch = -0.12;
  }, { from, at });
  await pumpAll([page], 400);
  await shot(page, name);
};

const A = await open("A", "surfer_a");
const B = await open("B", "watcher_b");
await join(A);
await join(B);
for (const p of [A, B]) {
  await p.evaluate(() => {
    // the scratch camera, after the game's own (the sky follows it too)
    const T = window.__trollOps;
    const r = T.renderer || null;
    const cam = T.camera;
    const orig = cam.updateMatrixWorld.bind(cam);
    cam.updateMatrixWorld = (f) => {
      const c = window.__surfCam;
      if (c) { cam.position.set(...c.from); cam.lookAt(...c.at); }
      return orig(f);
    };
  });
}
await pumpAll([A, B], 4000);
const [idA] = await Promise.all([A].map((p) => p.evaluate(() => window.__trollOps.net.id)));

// ── 1. A board from the rack ─────────────────────────────────────────────
const [rx, rz] = await A.evaluate(() => window.__trollOps.builtMap().map.rp.surf().racks[1]).catch(async () => [10, -19.4]);
await putAt(A, rx, rz - 1.6, 0, 0);
await pumpAll([A], 600);
let r = await rp(A);
check("by the rack: grab a surfboard", /grab a surfboard/i.test(r.prompt || ""), r.prompt);
await hold(A, [B], "x", 1100);
let s = await S(A);
check("carrying a board", s.state === 1 && s.board, JSON.stringify(s));
await pumpAll([A, B], 1500);
let b = await seen(B, idA);
check("B sees the board under A's arm", b.surf === 1 && b.board, JSON.stringify(b));
await A.evaluate(() => window.__trollOps.toggleThirdPerson?.());
await pumpAll([A], 500);
await camShot(B, "1-carry", [rx + 2.5, 1.6, rz - 4.5], [rx, 0.9, rz - 1.6]);

// ── 2. Into the surf: paddling ───────────────────────────────────────────
await putAt(A, 20, -22.0, 0, Math.PI);
await pumpAll([A], 300);
await putAt(A, 20, -23.5, 0, 0);   // out past the wall, facing the sea
await pumpAll([A], 600);
s = await S(A);
check("past the wall: on the board, paddling", s.state === 2, JSON.stringify(s));
check("eye low over the deck", s.eye < 0.7, String(s.eye));
const z0 = s.z;
await hold(A, [B], "w", 3000);
s = await S(A);
check("W paddles out", s.z < z0 - 2.5, `${z0.toFixed(1)} -> ${s.z}`);
b = await seen(B, idA);
check("B sees A paddling, on a board", b.surf === 2 && b.board && b.gap > 0.5 && b.gap < 1.2, JSON.stringify(b));
await camShot(B, "2-paddle", [s.x + 3.5, 0, s.z + 2.5], [s.x, 0, s.z]);

// ── 3. Catch a wave, pop up, ride ────────────────────────────────────────
// on the face of the next set, 14 m out, heading in, already paddling
let caught = false;
for (let tries = 0; tries < 6 && !caught; tries++) {
  await A.evaluate(() => {
    const H = window.__trollSurf, T = window.__trollOps;
    const now = (Date.now() % 120000) / 1000;
    const x = 22;
    let z = -21 - 14;
    // shift z so we sit 2 m ahead of the crest (it comes up behind us), 9-19 m out
    const o = H.crestOffset(x, z, now);
    z += 2.0 - o;
    while (-21 - z > 19) z += 26;
    while (-21 - z < 9) z -= 26;
    if (H.surf.state !== 2) H.toPaddle();
    Object.assign(H.surf, { x, z, yaw: Math.PI, s: 1.8 });
    T.look.yaw = Math.PI;
  });
  await A.keyboard.down("w");
  await pumpAll([A], 120);
  await A.keyboard.down("Space");
  await pumpAll([A], 200);
  await A.keyboard.up("Space");
  s = await S(A);
  caught = s.state === 3 || s.state === 4;
  if (!caught) { await A.keyboard.up("w"); await pumpAll([A], 1500); }
}
check("Space on the face: popped up", caught, JSON.stringify(s));
// angle down the line: mostly along the wave, a little shoreward
await A.evaluate(() => { window.__trollOps.look.yaw = Math.PI - 1.0; });
let maxRide = 0, rodeState = false, eyes = [];
const tR = Date.now();
let shotRide = false;
while (Date.now() - tR < 6000) {
  await pumpAll([A, B], 250);
  s = await S(A);
  if (s.state === 4) { rodeState = true; eyes.push(s.eye); }
  if (s.ride) maxRide = Math.max(maxRide, s.ride.dist);
  if (s.state === 4 && !shotRide && Date.now() - tR > 1500) {
    shotRide = true;
    b = await seen(B, idA);
    check("B sees A riding", b.surf === 4 && b.board, JSON.stringify(b));
    await camShot(B, "3-ride", [s.x - 6, 0, s.z + 3], [s.x, 0, s.z]);
  }
  if (!s.ride && s.last) maxRide = Math.max(maxRide, s.last.dist);
  if (s.state !== 3 && s.state !== 4) break;
}
await A.keyboard.up("w");
check("stood up and rode", rodeState && eyes.every((e) => e > 1.1), JSON.stringify(eyes.slice(0, 3)));
check("a ride of 10 m or more", maxRide >= 10, `${maxRide.toFixed?.(1) ?? maxRide} m, last ${JSON.stringify(s.last)}`);
check("the board stays on the water", Math.abs(s.y - 0.04) < 1.2, String(s.y));

// ── 4. Slide off ─────────────────────────────────────────────────────────
s = await S(A);
if (s.state !== 2) {
  await A.evaluate(() => { const H = window.__trollSurf; H.toPaddle(); });
  await pumpAll([A], 300);
}
await A.keyboard.press("c");
await pumpAll([A], 500);
s = await S(A);
check("C slides off: standing, the board under the arm", s.state === 1 && s.eye > 1.2, JSON.stringify(s));

// ── 5. Back on the rack ──────────────────────────────────────────────────
await putAt(A, rx, rz - 1.6, 0, 0);
await pumpAll([A], 600);
r = await rp(A);
check("at the rack: put it back", /put the board back/i.test(r.prompt || ""), r.prompt);
await hold(A, [B], "x", 900);
s = await S(A);
check("racked: no board", s.state === 0 && !s.board, JSON.stringify(s));
await pumpAll([A, B], 1200);
b = await seen(B, idA);
check("B sees no board", b.surf === 0 && !b.board, JSON.stringify(b));

const npc = await B.evaluate(async () => {
  const T = window.__trollOps, H = window.__trollSurf;
  const list = T.townNpcs().list.map((n, i) => ({ n, i })).filter(({ n }) => n.c.act === "surf");
  const states = list.map(({ n }) => H.npcSurfAt(n.c, (Date.now() % 120000) / 1000).state);
  return { count: list.length, driven: list.filter(({ n }) => !!n.override).length, boards: list.filter(({ i }) => H.boards.get(`npc${i}`)?.mesh.parent).length, states };
});
check("the lineup surfers are on boards, driven", npc.count === 4 && npc.driven === 4 && npc.boards === 4, JSON.stringify(npc));
check("no page errors", !errors.length, errors.slice(0, 3).join(" | "));
console.log(failures ? `FAIL (${failures})` : "PASS");
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
