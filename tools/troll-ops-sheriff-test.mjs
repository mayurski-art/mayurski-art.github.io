// Troll Forces Socialize, Troll City: a player sheriff (TROLL-CITY-RP2.md,
// phase 2b; modes/social-sheriff.js, modes/social-jail.js).
//
// Tabs share the QSOC room over BroadcastChannel (Supabase blocked):
//   1. A takes the badge off the desk: A is the sheriff, Sheriff Grimes
//      steps off on both tabs, B sees the hat, the desk's badge is gone.
//   2. A cuffs B: B's hands go behind the back, B's own keys do nothing,
//      and B follows A on the leash.
//   3. At a cell door A locks B up: B is walked in, the door shuts on both
//      tabs, and B can't walk out of the back of the cell.
//   4. C (troll_runner) joins mid-sentence and sees the door shut.
//   5. B's time is up: free, door open everywhere; a fresh cuff is refused.
//   6. Nobody cuffs the owner (C).
//   7. The wanted board: A posts B; B's chip, C's poster; badge down clears it.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-sheriff-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, "tools", ".sheriff-shots");
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

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist",
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
  await page.waitForFunction(() => !!window.__trollOps && !!window.__trollSheriff, null, { timeout: 420000 });
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
const pos = (page) => page.evaluate(() => { const p = window.__trollOps.move.pos; return { x: p.x, y: p.y, z: p.z }; });
/* This tab's view of the sheriff business. */
const sh = (page) => page.evaluate(() => {
  const T = window.__trollOps, S = window.__trollSheriff, J = T.builtMap().map.rp.jail();
  return {
    role: T.rp().role, cuffed: !!S.sheriff.cuffed, jail: S.jailed.me ? S.jailed.me.ci : -1, walking: !!S.jailed.walk,
    netCuff: T.net.cuff, netJail: T.net.jail, doors: J.cells.map((c) => !!c.shut),
    badgeOn: T.builtMap().map.rp.sheriff.badgeOn, board: S.boardList().map((w) => w.id),
    chip: [...document.querySelectorAll("div")].find((d) => !d.hidden && /^(Cuffed|In the cells|You're wanted)/.test(d.textContent))?.textContent || null,
  };
});
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

const A = await open("A", "sheriff_a");
const B = await open("B", "outlaw_b");
await join(A);
await join(B);
await pumpAll([A, B], 5000);
const [idA, idB] = await Promise.all([A, B].map((p) => p.evaluate(() => window.__trollOps.net.id)));

// ── 1. The badge ─────────────────────────────────────────────────────────
const S = await A.evaluate(() => { const s = window.__trollOps.builtMap().map.rp.sheriff; return { badge: s.badge, board: s.board }; });
await putAt(A, S.badge.x - 0.9, S.badge.z, S.badge.floor, -Math.PI / 2);
await pumpAll([A], 400);
let s = await rp(A);
check("at the desk: take the badge", /take the badge/i.test(s.prompt || ""), s.prompt);
await holdRp(A, [B], async () => (await rp(A)).role === "sheriff");
check("holding X there makes A the sheriff", (await rp(A)).role === "sheriff");
await pumpAll([A, B], 1200);
const grimes = await Promise.all([A, B].map((p) => p.evaluate(() => window.__trollOps.townNpcs().list.find((n) => n.c.name === "Sheriff Grimes")?.rig.root.visible)));
check("Sheriff Grimes steps off, on both tabs", grimes[0] === false && grimes[1] === false, JSON.stringify(grimes));
const hatB = await B.evaluate((id) => {
  const T = window.__trollOps;
  return { role: T.net.peers.get(id)?.role, hat: T.remotes.byId.get(id)?.rig.jobHatKind, badge: T.builtMap().map.rp.sheriff.badgeOn };
}, idA);
check("B sees A as the sheriff, hat on, badge gone from the desk", hatB.role === "sheriff" && hatB.hat === "sheriff" && hatB.badge === false, JSON.stringify(hatB));
check("A wears the hat too", (await A.evaluate(() => window.__trollOps.localRig.jobHatKind)) === "sheriff");

// ── 2. Cuffs and the leash ───────────────────────────────────────────────
// Out in the courthouse's main room, B a step in front of A.
await putAt(A, 46.0, 4.0, S.badge.floor, 0);
await putAt(B, 46.0, 3.0, S.badge.floor, Math.PI);
await pumpAll([A, B], 1200);
s = await rp(A);
check("next to B: cuff them", /cuff outlaw_b/i.test(s.prompt || ""), s.prompt);
await holdRp(A, [B], async () => (await sh(B)).cuffed);
await pumpAll([A, B], 600);
let b = await sh(B);
check("B is cuffed (and says so on the wire)", b.cuffed && b.netCuff === 1, JSON.stringify(b));
check("B's chip says cuffed", /^Cuffed/.test(b.chip || ""), b.chip);
const cuffSeen = await A.evaluate((id) => window.__trollOps.net.peers.get(id)?.cuffed, idB);
check("A sees B cuffed", (cuffSeen | 0) === 1, String(cuffSeen));
// B's keys do nothing: W for a second, B stays put (A is right there).
const b0 = await pos(B);
await B.keyboard.down("s");
await pumpAll([A, B], 1000);
await B.keyboard.up("s");
check("B's own keys do nothing while cuffed", dist(await pos(B), b0) < 0.6, `${dist(await pos(B), b0).toFixed(2)} m`);
// A walks off north: B comes along.
const a0 = await pos(A);
await A.keyboard.down("w");
await pumpAll([A, B], 3500);
await A.keyboard.up("w");
await pumpAll([A, B], 1500);
const a1 = await pos(A), b1 = await pos(B);
check("A walked a fair way", dist(a1, a0) > 4, `${dist(a1, a0).toFixed(1)} m`);
check("B followed on the leash", dist(b1, b0) > 3 && dist(a1, b1) < 2.5, `B moved ${dist(b1, b0).toFixed(1)} m, ${dist(a1, b1).toFixed(2)} m behind A`);
await A.screenshot({ path: path.join(SHOTS, "1-leash.png") });

// ── 3. Into a cell ───────────────────────────────────────────────────────
const cell = await A.evaluate(() => { const c = window.__trollOps.builtMap().map.rp.jail().cells[0]; return { out: c.out, box: c.box, y: c.y }; });
await putAt(A, cell.out.x - 0.3, cell.out.z, cell.y, -Math.PI / 2);
await putAt(B, cell.out.x - 1.5, cell.out.z, cell.y, -Math.PI / 2);
await pumpAll([A, B], 1200);
s = await rp(A);
check("at the cell door with B in tow: lock B up", /lock outlaw_b up/i.test(s.prompt || ""), s.prompt);
await holdRp(A, [B], async () => (await sh(B)).jail >= 0);
await pumpAll([A, B], 2500);   // walked in
b = await sh(B);
const a = await sh(A);
check("B is in cell 1, cuffs off, on the wire", b.jail === 0 && !b.cuffed && b.netJail === 1 && !b.walking, JSON.stringify(b));
check("B's chip: in the cells", /^In the cells/.test(b.chip || ""), b.chip);
check("the door's shut on both tabs", a.doors[0] && b.doors[0] && !a.doors[1] && !b.doors[1], JSON.stringify({ a: a.doors, b: b.doors }));
const inBox = (p) => p.x > cell.box.x0 - 0.3 && p.x < cell.box.x1 + 0.3 && p.z > cell.box.z0 - 0.3 && p.z < cell.box.z1 + 0.3;
check("B was walked inside", inBox(await pos(B)), JSON.stringify(await pos(B)));
// try every way out: east (D) into the back corner, then west (A) at the door
await B.evaluate(() => { window.__trollOps.look.yaw = 0; });
for (const k of ["d", "s", "a", "w"]) { await B.keyboard.down(k); await pumpAll([B, A], 900); await B.keyboard.up(k); }
b = await sh(B);
check("B can't walk out (bars and the back corner)", b.jail === 0 && inBox(await pos(B)), JSON.stringify(await pos(B)));
await A.screenshot({ path: path.join(SHOTS, "2-cell.png") });

// ── 4. A late joiner sees the door shut ──────────────────────────────────
const C = await open("C", "troll_runner");
await join(C);
await pumpAll([A, B, C], 3000);
const c = await sh(C);
check("C (joined late) sees cell 1 shut", c.doors[0] === true, JSON.stringify(c.doors));

// ── 5. Time's up; the cooldown ───────────────────────────────────────────
await B.evaluate(() => { window.__trollSheriff.jailed.me.left = 0.5; });
await pumpAll([A, B, C], 2000);
b = await sh(B);
const doorsAll = await Promise.all([A, B, C].map(async (p) => (await sh(p)).doors[0]));
check("B is free", b.jail === -1 && b.netJail === 0, JSON.stringify(b));
check("the door's open on every tab", doorsAll.every((d) => !d), JSON.stringify(doorsAll));
const bp = await pos(B);
await putAt(A, bp.x - 1, bp.z, bp.y, -Math.PI / 2);
await pumpAll([A, B], 1200);
await holdRp(A, [B], async () => false, 2200);   // the cuff goes out; B's client refuses it
await pumpAll([A, B], 600);
check("just let out: a fresh cuff is refused", !(await sh(B)).cuffed);

// ── 6. Nobody cuffs the owner ────────────────────────────────────────────
await putAt(C, 46.0, 3.0, S.badge.floor, Math.PI);
await putAt(A, 46.0, 4.0, S.badge.floor, 0);
await putAt(B, 44.0, 6.0, S.badge.floor, 0);
await pumpAll([A, B, C], 1500);
s = await rp(A);
check("by troll_runner the prompt says no", /nobody cuffs/i.test(s.prompt || ""), s.prompt);
const idC = await C.evaluate(() => window.__trollOps.net.id);
await A.evaluate((to) => window.__trollOps.net.publishRp({ k: "sheriff", e: "cuff", to }), idC);   // forced
await pumpAll([A, C], 800);
check("a cuff sent anyway is refused by the owner's tab", !(await sh(C)).cuffed);

// ── 7. The wanted board ──────────────────────────────────────────────────
await putAt(A, S.board.x + 0.9, S.board.z, S.board.floor, Math.PI / 2);
await pumpAll([A], 400);
s = await rp(A);
check("at the board: the wanted board", /wanted board/i.test(s.prompt || ""), s.prompt);
await holdRp(A, [B, C], async () => A.evaluate(() => window.__trollSheriff.board.isOpen()));
check("the board's panel opens", await A.evaluate(() => window.__trollSheriff.board.isOpen()));
await A.click(`.sheriff-board button[data-id="${idB}"]`);
await A.screenshot({ path: path.join(SHOTS, "3-board-panel.png") });
await A.keyboard.press("Escape");
await pumpAll([A, B, C], 1500);
b = await sh(B);
const cB = await sh(C);
check("B's on the board on B's and C's tabs", b.board.includes(idB) && cB.board.includes(idB), JSON.stringify({ b: b.board, c: cB.board }));
check("B's chip: wanted", /^You're wanted/.test(b.chip || ""), b.chip);
const posterUp = () => C.evaluate(() => { const p = window.__trollOps.builtMap().map.rp.sheriff.posters[0]; return !!p && p.mesh.material !== p.def; });
check("C sees B's poster up", await posterUp());
await putAt(C, S.board.x + 2.6, S.board.z, S.board.floor, Math.PI / 2);
await pumpAll([C], 800);
await C.screenshot({ path: path.join(SHOTS, "4-poster.png") });
// badge down: the board clears
await putAt(A, S.badge.x - 0.9, S.badge.z, S.badge.floor, -Math.PI / 2);
await pumpAll([A], 400);
await holdRp(A, [B, C], async () => (await rp(A)).role !== "sheriff");
await pumpAll([A, B, C], 1500);
b = await sh(B);
const cC = await sh(C);
check("badge down: A's off duty, the badge back on the desk", (await rp(A)).role !== "sheriff" && cC.badgeOn === true, JSON.stringify({ badge: cC.badgeOn }));
check("badge down: the board's cleared and B's chip gone", !cC.board.length && !b.board.length && !/wanted/.test(b.chip || ""), JSON.stringify({ c: cC.board, chip: b.chip }));
check("and C's poster is back to the town's own", !(await posterUp()));
const grimesBack = await C.evaluate(() => window.__trollOps.townNpcs().list.find((n) => n.c.name === "Sheriff Grimes")?.rig.root.visible);
check("Sheriff Grimes is back", grimesBack === true);

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(failures ? `${failures} failed` : "all passed");
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
