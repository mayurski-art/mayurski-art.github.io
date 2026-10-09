// Troll Forces Socialize: Trolling Loud's door (modes/club-entry.js,
// CLUB-ENTRY.md), phases 1-3, solo: the flow, the look (the rope, the
// bouncers, bands on wrists, security's hand up at VIP), and the kick-out.
//
// Three tabs, one at a time, Supabase blocked (never a live room):
//   1. Signed in: spawn in the line with 1-7 clubgoers ahead (a line of
//      6-7); the line moves up; at a lane your ID (the HAWAII licence, view/club-id-card.js) shows, then the
//      18+ question; "Yeah" puts a guest band on and walks you into the
//      lobby. Before the band the lobby is fenced off; after it the main
//      floor is open and VIP and back of house aren't.
//   2. Guest: no card, straight to the question; "No" plays the kick-out
//      (carried off, tossed on the curb) and leaves you sat there, locked
//      out; once it's up, X puts you back in the line.
//   3. troll_runner: in the lobby with the owner band; VIP and back open.
// Shots: scratch PNGs in tools/.club-shots (not committed).
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-club-entry-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, "tools", ".club-shots");
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
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });

/* A Socialize tab on Trolling Loud as `user` (null = a guest). */
async function open(user) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.addInitScript((user) => {
    const fake = { getCachedProfile: () => (user ? { username: user, tags: [] } : null) };
    Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => fake, set: () => {} });
  }, user);
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 420000 });
  await page.waitForFunction(() => !!window.__trollOps && !!window.__trollClub, null, { timeout: 420000 });
  await page.evaluate(() => {
    window.__trollOps.setLoadWaitMax(8);
    Object.assign(window.__trollClub.T, { checkSecs: 0.5, idSecs: 0.8, bandSecs: 0.4, lockSecs: 3 });
  });
  await page.evaluate(async () => {
    const T = window.__trollOps;
    T.setMode("social");
    T.loadout.mapId = "trollingloud";
    await T.startGame();
  });
  await page.waitForFunction(() => !window.__trollOps.loadState().open, null, { timeout: 420000 });
  await page.evaluate(() => { window.__trollOps.els.pause.hidden = true; });
  await pump(page, 600);
  return page;
}
const S = (page) => page.evaluate(() => {
  const T = window.__trollOps, C = window.__trollClub, c = C.club, p = T.move.pos;
  const d = T.builtMap().map.rp.door;
  return {
    phase: c.phase, band: C.band(), ahead: c.queue.findIndex((e) => e.me), lineNpcs: c.queue.filter((e) => !e.me).length,
    want: c.want, lineish: c.npcs.filter((e) => ["line", "lane", "door", "arrive"].includes(e.state)).length, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), zone: d.zoneOf(p.x, p.y + 0.1, p.z),
    card: !!document.querySelector(".club-card:not([hidden]) .club-id"), cardText: document.querySelector(".club-card")?.textContent || "",
    ask: !!document.querySelector(".club-ask:not([hidden])"), chip: document.querySelector(".club-chip:not([hidden])")?.textContent || "",
    paused: !T.els.pause.hidden,
    rope: C.rope(), rigBand: T.localRig.band || 0, bandMesh: !!T.localRig.bandMesh?.parent,
    bouncers: c.lanes.filter((l) => l.b?.override).length, blocks: c.blocks.length,
    npcBands: c.npcs.filter((e) => e.n.rig.band === 1).length,
    kick: C.kick(), cine: document.body.classList.contains("club-cine-on"),
    cap: document.querySelector(".club-cine-cap")?.textContent || "", stamp: !!document.querySelector(".club-cine-stamp.is-on"),
    lie: +T.localRig.root.rotation.x.toFixed(2), sit: c.sit, eyeY: +T.camera.position.y.toFixed(2),
    held: c.lanes.filter((l) => l.b && Math.hypot(l.b.x - p.x, l.b.z - p.z) < 0.9).length,
  };
});
const until = async (page, pred, ms) => {
  const t0 = Date.now();
  let s = await S(page);
  while (Date.now() - t0 < ms && !pred(s)) { await pump(page, 250); s = await S(page); }
  return s;
};
/* Try to walk into a spot: put us there for a frame and see where we end up. */
const poke = (page, x, y, z) => page.evaluate(({ x, y, z }) => { window.__trollOps.move.pos.set(x, y, z); }, { x, y, z });

// ── 1. Signed in ─────────────────────────────────────────────────────────
let A = await open("club_tester");
let s = await S(A);
check("signed in: you start in the line", s.phase === "queued" && s.zone === "street", JSON.stringify(s));
const spawnAhead = await A.evaluate(() => window.__trollClub.club.spawnAhead);
check("with 1-7 clubgoers ahead of you", spawnAhead >= 1 && spawnAhead <= 7, `${spawnAhead} ahead at spawn`);
check("the velvet rope's up across the door, both bouncers working the lanes", s.rope.on && s.rope.k === 0 && s.bouncers === 2, JSON.stringify({ rope: s.rope, bouncers: s.bouncers }));
// (with the waits shortened the front ones may already be at a lane)
check("in a line of 6-7", (s.want === 6 || s.want === 7) && s.lineish >= s.want - 1, `want ${s.want}, ${s.lineish} in line or at a lane now`);
await A.screenshot({ path: path.join(SHOTS, "1-line.png") });
// pinned: the keys don't move you out of your place
const before = { x: s.x, z: s.z };
await A.keyboard.down("w"); await pump(A, 700); await A.keyboard.up("w");
s = await S(A);
check("the line holds you in your place (or walks you up it)", s.phase !== "queued" || (Math.abs(s.z - before.z) < 0.2 && s.x >= before.x - 0.05), JSON.stringify(s));
// the line moves up and a lane takes you
s = await until(A, (s) => s.phase === "id" || s.phase === "ask", 60000);
check("the line moves up to a lane, and your ID comes out", s.phase === "id" && s.card && /club_tester/.test(s.cardText), JSON.stringify({ ...s, cardText: s.cardText.slice(0, 40) }));
await A.screenshot({ path: path.join(SHOTS, "2-card.png") });
s = await until(A, (s) => s.phase === "ask", 5000);
check("then the 18+ question", s.ask && !s.card, JSON.stringify(s));
check("the question frees the mouse without pausing", !s.paused);
await A.screenshot({ path: path.join(SHOTS, "3-ask.png") });
// fenced off before the band
await A.keyboard.press("Digit1");
let ropeMax = 0;
s = await until(A, (s) => { ropeMax = Math.max(ropeMax, s.rope.k); return s.phase === "in"; }, 15000);
check("Big Lulz takes the rope off its hook to let you in", ropeMax > 0.85, `rope k max ${ropeMax.toFixed(2)}`);
check("the band's on your right wrist", s.rigBand === 1 && s.bandMesh, JSON.stringify({ rigBand: s.rigBand, bandMesh: s.bandMesh }));
check("clubgoers checked in ahead of you wear theirs", s.npcBands >= 1, `${s.npcBands} banded`);
check("'Yeah': a guest band, walked into the lobby", s.phase === "in" && s.band === 1 && s.zone === "main", JSON.stringify(s));
await A.screenshot({ path: path.join(SHOTS, "4-lobby.png") });
await poke(A, -22, 0.3, 3); await pump(A, 300); s = await S(A);
check("the guest band doesn't open VIP", s.zone !== "vip", JSON.stringify(s));
check("and security puts a hand up", s.blocks === 1, JSON.stringify({ blocks: s.blocks }));
await poke(A, 0, 0.3, -20); await pump(A, 300); s = await S(A);
check("or back of house", s.zone !== "back", JSON.stringify(s));
await poke(A, 0, 0, 27); await pump(A, 300); s = await S(A);
check("out on the street with it", s.zone === "street", JSON.stringify(s));
await poke(A, 24, 0.3, 17); await pump(A, 300); s = await S(A);
check("and back in by a side door, no line", s.zone === "main", JSON.stringify(s));
check("signed in: no page errors", A.errors.length === 0, A.errors.slice(0, 3).join(" | "));
await A.context().close();

// ── 2. Guest ─────────────────────────────────────────────────────────────
A = await open(null);
s = await S(A);
check("guest: in the line", s.phase === "queued", JSON.stringify(s));
// out of the line (X), then try the front door and a side door
await A.evaluate(() => window.__trollClub.leave());
await pump(A, 200);
await poke(A, 0, 0.3, 18); await pump(A, 300); s = await S(A);
check("no band: the lobby's fenced off", s.zone === "street" && s.phase === "none", JSON.stringify(s));
await poke(A, 24, 0.3, 17); await pump(A, 300); s = await S(A);
check("and so is every side door", s.zone === "street", JSON.stringify(s));
await A.evaluate(() => window.__trollClub.join());
s = await until(A, (s) => s.phase === "id" || s.phase === "ask", 60000);
check("guest: no card, straight to the question", s.phase === "ask" && !s.card, JSON.stringify(s));
await A.keyboard.press("Digit2");
// The kick-out plays in full (never shortened, not even here).
s = await until(A, (s) => s.kick > 0.5, 3000);
check("'No': the kick-out starts, letterboxed", s.phase === "kick" && s.cine && s.cap === "Nah.", JSON.stringify(s));
s = await until(A, (s) => s.kick > 3.0, 6000);
check("both bouncers carry you, off your feet", s.held === 2 && s.y > 0.25, JSON.stringify(s));
await A.screenshot({ path: path.join(SHOTS, "5a-carried.png") });
s = await until(A, (s) => s.kick > 5.1, 6000);
check("tossed on your back by the curb, caption and stamp up", s.lie > 1.3 && s.z > 27 && /18/.test(s.cap) && s.stamp, JSON.stringify(s));
await A.screenshot({ path: path.join(SHOTS, "5b-tossed.png") });
s = await until(A, (s) => s.phase !== "kick" && s.chip, 6000);   // (the chip is up the frame after)
check("'No': out on the curb, locked out", s.phase === "lockout" && s.band === 0 && s.zone === "street" && /Bounced/.test(s.chip) && !s.cine, JSON.stringify(s));
check("sat on the curb, eye low", s.sit > 0.5 && s.eyeY < 1.1 && s.lie === 0, JSON.stringify(s));
await A.screenshot({ path: path.join(SHOTS, "5-bounced.png") });
s = await until(A, (s) => /Hold X/.test(s.chip), 6000);
check("when the lockout's up, X gets you back in line", /Hold X/.test(s.chip), s.chip);
await A.evaluate(() => window.__trollClub.join());
s = await S(A);
check("back in the line", s.phase === "queued" && s.ahead >= 0, JSON.stringify(s));
check("guest: no page errors", A.errors.length === 0, A.errors.slice(0, 3).join(" | "));
await A.context().close();

// ── 3. The owner ─────────────────────────────────────────────────────────
A = await open("troll_runner");
s = await S(A);
check("troll_runner: in the lobby with the owner band", s.phase === "in" && s.band === 2 && s.zone === "main", JSON.stringify(s));
check("the black and gold owner band on his wrist", s.rigBand === 2 && s.bandMesh, JSON.stringify({ rigBand: s.rigBand, bandMesh: s.bandMesh }));
await poke(A, -22, 0.3, 3); await pump(A, 300); s = await S(A);
check("VIP's open to him", s.zone === "vip", JSON.stringify(s));
await poke(A, 0, 0.3, -20); await pump(A, 300); s = await S(A);
check("so is back of house", s.zone === "back", JSON.stringify(s));
check("owner: no page errors", A.errors.length === 0, A.errors.slice(0, 3).join(" | "));
await A.context().close();

await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
