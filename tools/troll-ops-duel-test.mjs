// Troll Forces Socialize: fist fights with Troll City's townsfolk
// (modes/social-duel.js), seen by the whole room.
//
// Two tabs in one headless browser share the QSOC room on Troll City over
// BroadcastChannel (Supabase blocked), with the waits shortened
// (window.__trollDuelTune):
//   1. A bumps a townsperson: a warning (again, still a warning); then a
//      second townsperson: he squares up and challenges A.
//   2. A doesn't take it: A's put in a courthouse cell, its door shut (B
//      sees the door shut too), and let out when the time's up.
//   3. A challenges one and wins with three punches: he's down on A's
//      screen and on B's (B's copy was driven the whole fight).
//   4. A fight where he pulls the gun: A's shot, bleeds out (B sees A
//      down), Doc Grin comes over, A wakes up on the exam table.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-duel-test.mjs


import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/* Headless pages only draw (and so only send state and tick clocks) when
   something asks for a frame: screenshots ask, for `ms`. */
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

// The GPU, not SwiftShader: held-X timers and walkers run on frame time.
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
await ctx.route(/supabase/, (r) => r.abort());
const errors = [];

async function open(label, username) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await page.addInitScript((name) => {
    const fake = { getCachedProfile: () => ({ username: name, tags: [] }) };
    Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => fake, set: () => {} });
    window.__trollDuelTune = { jailSecs: 4, challengeSecs: 2, bleedSecs: 3, gunOdds: 0 };
  }, username);
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 420000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 420000 });
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
/* Hold X until `done(rp state)`, pumping frames, then let go. */
async function holdRp(page, done, ms = 20000) {
  await page.keyboard.down("x");
  const t0 = Date.now();
  let s = await rp(page);
  while (Date.now() - t0 < ms && !done(s)) { await pump(page, 250); s = await rp(page); }
  await page.keyboard.up("x");
  await pump(page, 150);
  return rp(page);
}
const putAt = (page, x, z, y, yaw = 0) => page.evaluate(({ x, z, y, yaw }) => {
  const T = window.__trollOps;
  T.move.reset(x, z, y); T.look.yaw = yaw;
}, { x, z, y, yaw });
const fire = async (page) => {
  await page.evaluate(() => window.__trollOps.setTrigger(true));
  await pump(page, 200);
  await page.evaluate(() => window.__trollOps.setTrigger(false));
  await pump(page, 300);
};

// (neither is the owner: the owner keeps his guns in Socialize)
const A = await open("A", "duel_a");
const B = await open("B", "duel_b");
await join(A);
await join(B);
await pumpBoth(A, B, 3000);
const ids = await Promise.all([A, B].map((p) => p.evaluate(() => window.__trollOps.net.id)));

const D = (page) => page.evaluate(() => {
  const d = window.__trollDuel.duel;
  return { phase: d.phase, i: d.i, hp: d.hp, npcHp: d.npcHp, act: d.act, jail: d.jail && { ci: d.jail.ci, left: d.jail.left }, seated: window.__trollOps.rp().seated?.kind || null,
    pos: (({ x, y, z }) => ({ x, y, z }))(window.__trollOps.move.pos) };
});
const cellShut = (page, ci) => page.evaluate((ci) => !!window.__trollOps.builtMap().map.rp.jail().cells[ci].shut, ci);
/* B's copy of townsperson i: driven by A's fight, and what he's doing. */
const bSees = (i) => B.evaluate((i) => {
  const n = window.__trollOps.townNpcs().list[i], r = window.__trollDuel.remote.get(i);
  return { driven: !!n.override, act: r?.act || null, x: n.x, z: n.z };
}, i);
const until = async (page, pred, ms) => {
  const t0 = Date.now();
  let s = await D(page);
  while (Date.now() - t0 < ms && !pred(s)) { await pumpBoth(A, B, 250); s = await D(page); }
  return s;
};

const extras = await A.evaluate(() => window.__trollDuel.extras());
check("Troll City has townsfolk to fight", extras.length >= 3, `${extras.length}`);
const e0 = extras[0];

// ── 1. A bump is a warning; the next citizen bumped squares up ────────────
const eW = extras[2];
await putAt(A, e0.x + 1.5, e0.z, 0);
await A.evaluate((i) => { window.__trollDuel.bump(i); }, eW.i);
let s = await D(A);
const warned = await A.evaluate(() => document.body.innerText.includes("don't troll the citizens"));
check("one bump is a warning", s.phase === null && warned, JSON.stringify(s));
await pump(A, 1700);
await A.evaluate((i) => { window.__trollDuel.bump(i); }, eW.i);
s = await D(A);
check("the same one again: still only a warning", s.phase === null, JSON.stringify(s));
await pump(A, 400);
await A.evaluate((i) => { window.__trollDuel.bump(i); }, e0.i);
s = await D(A);
check("a second citizen straight after: he challenges A", s.phase === "challenge" && s.i === e0.i, JSON.stringify(s));
await pumpBoth(A, B, 500);
check("B sees him squared up to A", (await bSees(e0.i)).driven === true);

// ── 2. Not taken: the cells ───────────────────────────────────────────────
s = await until(A, (s) => !!s.jail, 6000);
check("not taking it puts A in a cell", !!s.jail && s.pos.x > 51.2 && s.phase === null, JSON.stringify(s));
await pumpBoth(A, B, 500);
check("its door is shut", await cellShut(A, s.jail.ci));
check("B sees the door shut", await cellShut(B, s.jail.ci));
check("he's back to his business", (await bSees(e0.i)).driven === false);
// walking out through the bars doesn't work
const cell = s.jail.ci;
await A.keyboard.down("w");
await pump(A, 800);
await A.keyboard.up("w");
s = await D(A);
check("the bars hold A in", s.pos.x > 51.2, s.pos.x.toFixed(2));
s = await until(A, (s) => !s.jail, 8000);
await pumpBoth(A, B, 500);
check("let out when the time's up", !s.jail && !(await cellShut(A, cell)) && !(await cellShut(B, cell)));

// ── 3. A challenges one and wins ──────────────────────────────────────────
const e1 = (await A.evaluate(() => window.__trollDuel.extras()))[1];
await putAt(A, e1.x + 1.3, e1.z, 0, Math.PI / 2);   // facing -x, at him
await pump(A, 200);
await A.evaluate((i) => window.__trollDuel.startFight(i), e1.i);
await pumpBoth(A, B, 600);
s = await D(A);
check("a fight's on", s.phase === "fight" && s.npcHp === 3, JSON.stringify(s));
check("B's copy of him is in it", (await bSees(e1.i)).driven === true);
for (let k = 0; k < 3; k++) {
  // keep facing him, punch, let it land
  await A.evaluate((i) => {
    const T = window.__trollOps, n = T.townNpcs().list[i], p = T.move.pos;
    T.look.yaw = Math.atan2(-(n.x - p.x), -(n.z - p.z));
    window.__trollDuel.punch();
  }, e1.i);
  await pumpBoth(A, B, 650);
}
s = await D(A);
check("three punches put him down", s.npcHp === 0 && s.act === "down", JSON.stringify(s));
await pumpBoth(A, B, 600);
check("B sees him go down", (await bSees(e1.i)).act === "down", JSON.stringify(await bSees(e1.i)));
s = await until(A, (s) => s.phase === null, 12000);
await pumpBoth(A, B, 800);
check("he gets up and it's over", s.phase === null && (await bSees(e1.i)).driven === false);

// ── 4. He pulls a gun ─────────────────────────────────────────────────────
const e2 = (await A.evaluate(() => window.__trollDuel.extras()))[2];
await putAt(A, e2.x + 1.3, e2.z, 0, Math.PI / 2);
await A.evaluate((i) => { const d = window.__trollDuel; d.DUEL.forceGun = "npc"; d.DUEL.gunAt = 0.6; d.startFight(i); }, e2.i);
s = await until(A, (s) => s.phase === "bleed", 5000);
check("he draws and shoots: A's bleeding out", s.phase === "bleed", JSON.stringify(s));
await pumpBoth(A, B, 500);
const downSeen = await B.evaluate((id) => !!window.__trollOps.net.peers.get(id)?.duelDown, ids[0]);
check("B sees A down", downSeen);
s = await until(A, (s) => s.phase === null, 9000);
check("A wakes on Doc Grin's exam table", s.seated === "exam", JSON.stringify(s));
await pumpBoth(A, B, 500);
const upSeen = await B.evaluate((id) => !window.__trollOps.net.peers.get(id)?.duelDown, ids[0]);
check("and B sees A up again", upSeen);

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(failures ? `${failures} FAILED` : "all passed");
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
