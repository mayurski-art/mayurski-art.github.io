// Troll Forces Socialize roleplay, phase 2: seats, the piano, the doctor.
//
// Two tabs in one headless browser share the QSOC room on Troll City over
// BroadcastChannel (Supabase blocked):
//   1. Troll City lists its seats; townsfolk sat down hold theirs.
//   2. A sits on a free chair (hold X), B sees A seated; moving gets A up.
//   3. A sits at the piano: A is the pianist, Piano Pete steps off, fire
//      plays a tune that B hears; fire again stops; getting up ends it.
//   4. A takes the doctor's bag, gives tipsy B a check-up: B is sober. A
//      tonic at the shelf takes the edge off.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-rp-test.mjs


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

const A = await open("A", "troll_runner");
const B = await open("B", "someone_else");
await join(A);
await join(B);
await pumpBoth(A, B, 3000);
const ids = await Promise.all([A, B].map((p) => p.evaluate(() => window.__trollOps.net.id)));

// ── 1. The seats ──────────────────────────────────────────────────────────
const seats = await A.evaluate(() => window.__trollOps.rpSeats());
const kinds = new Set(seats.map((s) => s.kind));
check("Troll City lists its seats", seats.length >= 50, `${seats.length}`);
check("chairs, stools, benches, the piano and the exam table", ["chair", "stool", "bench", "piano", "exam"].every((k) => kinds.has(k)), [...kinds].join(","));
const taken = await A.evaluate(() => window.__trollOps.rpSeats().map((s, i) => window.__trollOps.seatTaken(i)));
const stoolTaken = seats.map((s, i) => [s, i]).filter(([s, i]) => s.kind === "stool" && taken[i]).length;
check("the barflies' stools are taken", stoolTaken === 3, `${stoolTaken}`);
// a free chair upstairs (the card table there has nobody at it)
const chairI = seats.findIndex((s, i) => s.kind === "chair" && s.floor > 2 && !taken[i]);
check("a free chair upstairs", chairI >= 0);

// ── 2. Sit, be seen, get up ───────────────────────────────────────────────
const chair = seats[chairI];
await putAt(A, chair.x + 0.3, chair.z, chair.floor);
await pump(A, 400);
let s = await rp(A);
check("a chair offers a seat", /sit down/i.test(s.prompt || ""), s.prompt);
s = await holdRp(A, (s) => !!s.seated);
check("holding X sits down", s.seated?.idx === chairI, JSON.stringify(s.seated));
await pump(A, 800);
s = await rp(A);
check("eyes drop to seated height", s.seated && s.seated.eye < 1.35, s.seated?.eye?.toFixed(2));
await pumpBoth(A, B, 1500);
const seen = await B.evaluate(({ id, y }) => {
  const r = window.__trollOps.remotes.byId.get(id);
  return r ? { seat: r.peer.seat, rootY: r.rig.root.position.y, hips: r.rig.parts.hips.getWorldPosition(new r.rig.root.position.constructor()).y, y } : null;
}, { id: ids[0], y: chair.y });
check("the other tab sees A sat on that chair", seen?.seat === chairI + 1 && Math.abs(seen.hips - (chair.y + 0.08)) < 0.12, JSON.stringify(seen));
// The ink body is redrawn bent (user, 2026-10-07: "my legs are going through
// the wooden stool"): the drawn legs stop short of the floor, none of it
// inside the seat.
const drawn = await B.evaluate(({ id, s }) => {
  const r = window.__trollOps.remotes.byId.get(id);
  const mesh = r?.rig.parts.body;
  if (!mesh) return null;
  mesh.updateMatrixWorld(true);
  const a = mesh.geometry.attributes.position, v = new r.rig.root.position.constructor();
  let minY = Infinity, inSeat = 0;
  for (let i = 0; i < a.count; i++) {
    v.fromBufferAttribute(a, i).applyMatrix4(mesh.matrixWorld);
    minY = Math.min(minY, v.y);
    if (Math.hypot(v.x - s.x, v.z - s.z) < 0.2 && v.y < s.y - 0.005 && v.y > s.y - 0.07) inSeat++;
  }
  return { aboveFloor: +(minY - s.floor).toFixed(2), inSeat };
}, { id: ids[0], s: chair });
check("A's drawn legs are bent on the chair, not through it", drawn && drawn.aboveFloor > 0.04 && drawn.inSeat === 0, JSON.stringify(drawn));
await A.keyboard.down("w");
await pump(A, 300);
await A.keyboard.up("w");
s = await rp(A);
check("moving gets A up", !s.seated);

// ── 3. The piano ──────────────────────────────────────────────────────────
const pianoI = seats.findIndex((s) => s.kind === "piano");
const pn = seats[pianoI];
await putAt(A, pn.stand.x, pn.stand.z + 0.4, pn.floor);
await pump(A, 400);
s = await rp(A);
check("the piano stool is free for a player (Pete gets up)", /sit at the piano/i.test(s.prompt || ""), s.prompt);
s = await holdRp(A, (s) => !!s.seated);
check("sitting at the piano makes A the pianist", s.seated?.kind === "piano" && s.role === "pianist", JSON.stringify(s));
await pump(A, 300);
const pete = await A.evaluate(() => window.__trollOps.townNpcs().list.find((n) => n.c.role === "Pianist")?.rig.root.visible);
check("Piano Pete steps off", pete === false);
// the keys and the sheet music (menu/piano-panel.js)
let k = (await rp(A)).piano.keys;
check("sitting at the piano opens its keys", k?.open === true, JSON.stringify(k));
check("not the pause menu (the keys free the mouse on purpose)", await A.evaluate(() => window.__trollOps.els.pause.hidden));
const heard0 = (await rp(B)).piano.heard;
await A.keyboard.press("q");
await pumpBoth(A, B, 800);
k = (await rp(A)).piano.keys;
check("a key plays a note", k.hits === 1, JSON.stringify(k));
check("the other tab hears A's key", (await rp(B)).piano.heard === heard0 + 1, `${heard0} -> ${(await rp(B)).piano.heard}`);
check("the keys don't move A off the stool", (await rp(A)).seated?.kind === "piano");
const piece = () => A.evaluate(() => {
  [...document.querySelectorAll(".to-piano [data-level]")].find((b) => b.dataset.level === "Easy")?.click();
  [...document.querySelectorAll(".to-piano [data-sheet]")].find((b) => /hot cross buns/i.test(b.textContent))?.click();
});
await piece();
k = (await rp(A)).piano.keys;
check("an easy sheet opens", k.sheet === "Hot Cross Buns" && k.cursor === 0 && k.length === 17, JSON.stringify(k));
await A.keyboard.press("w");     // D4: not the first note
await pump(A, 200);
k = (await rp(A)).piano.keys;
check("a wrong key doesn't move the cursor", k.cursor === 0, JSON.stringify(k));
await A.keyboard.press("e");     // E4: the first note
await A.keyboard.press("w");     // D4: the second
await pump(A, 200);
k = (await rp(A)).piano.keys;
check("the right keys walk it on", k.cursor === 2, JSON.stringify(k));
const hard = await A.evaluate(() => {
  document.querySelector('.to-piano [data-a="sheets"]')?.click();
  [...document.querySelectorAll(".to-piano [data-level]")].find((b) => b.dataset.level === "Hard")?.click();
  return [...document.querySelectorAll(".to-piano [data-sheet]")].map((b) => b.textContent);
});
check("the hard sheets are there", hard.some((t) => /für elise/i.test(t)) && hard.some((t) => /entertainer/i.test(t)), hard.join(" / "));
await A.keyboard.press("Escape");
await pump(A, 300);
s = await rp(A);
check("Esc puts the keys away, A still sat", s.piano.keys.open === false && s.seated?.kind === "piano", JSON.stringify(s.piano.keys));
check("and hold X gets them out again", /play the keys/i.test(s.prompt || ""), s.prompt);
await fire(A);
s = await rp(A);
check("fire plays a tune", s.piano.playing && s.piano.voices.includes("me"), JSON.stringify(s.piano));
await pumpBoth(A, B, 1500);
const heard = await B.evaluate((id) => ({ tune: window.__trollOps.net.peers.get(id)?.piano, voices: window.__trollOps.rp().piano.voices }), ids[0]);
check("the other tab hears A's piano", heard.tune === 1 && heard.voices.includes(ids[0]), JSON.stringify(heard));
await fire(A);
s = await rp(A);
check("fire again stops it", !s.piano.playing && !s.piano.voices.includes("me"));
await fire(A);
s = await rp(A);
check("the next start is the next tune", s.piano.playing && s.piano.tune === 1, JSON.stringify(s.piano));
await A.keyboard.down("Space");
await pump(A, 300);
await A.keyboard.up("Space");
await pump(A, 300);
s = await rp(A);
check("getting up ends the job and the tune", !s.seated && !s.role && !s.piano.playing, JSON.stringify(s));
await pump(A, 300);
const pete2 = await A.evaluate(() => window.__trollOps.townNpcs().list.find((n) => n.c.role === "Pianist")?.rig.root.visible);
check("Pete's back at the keys", pete2 === true);

// ── 4. The doctor ─────────────────────────────────────────────────────────
const D = await A.evaluate(() => window.__trollOps.docSpots());
await putAt(A, D.bag.x, D.bag.z - 0.8, D.floorY);
await pump(A, 400);
s = await rp(A);
check("the doctor's bag is on the desk", /doctor's bag/i.test(s.prompt || ""), s.prompt);
s = await holdRp(A, (s) => s.role === "doctor");
check("taking the bag makes A the doctor", s.role === "doctor");
await pump(A, 300);
const doc = await A.evaluate(() => window.__trollOps.townNpcs().list.find((n) => n.c.role === "Doctor")?.rig.root.visible);
check("Doc Grin steps off", doc === false);
await B.evaluate(() => { window.__trollOps.barState.tipsy = 4; });
await putAt(B, D.bag.x - 1.2, D.bag.z - 0.8, D.floorY);
await pumpBoth(A, B, 1500);
s = await rp(A);
check("the doctor is offered a check-up", /check-up/i.test(s.prompt || ""), s.prompt);
await A.keyboard.down("x");
await pumpBoth(A, B, 3000);
await A.keyboard.up("x");
await pumpBoth(A, B, 1000);
const bt = (await rp(B)).tipsy;
check("the check-up sobers B up", bt === 0, bt?.toFixed(2));
await B.evaluate(() => { window.__trollOps.barState.tipsy = 3; });
await putAt(B, D.tonic.x - 0.5, D.tonic.z, D.floorY);
await pump(B, 400);
const tb = await holdRp(B, (s) => s.tipsy < 2);
check("a tonic at the shelf takes the edge off", tb.tipsy < 1.5 && tb.tipsy >= 0.5, tb.tipsy.toFixed(2));
await pumpBoth(A, B, 1200);
const docSeen = await B.evaluate((id) => window.__trollOps.net.peers.get(id)?.role, ids[0]);
check("the other tab knows A is the doctor", docSeen === "doctor", String(docSeen));

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(failures ? `${failures} FAILED` : "all passed");
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
