// Troll Forces Socialize: Trolling Loud's door with the room in it
// (modes/club-entry.js phase 4, CLUB-ENTRY.md "Multiplayer").
//
// Three tabs in one headless browser share a Socialize room over
// BroadcastChannel (Supabase blocked, never a live room), joining one after
// another, so their tickets run A < B < C:
//   1. Every tab's line has the three humans in ticket order.
//   2. Each human's own tab sends them to a podium; the others see them at
//      that lane (their copy of the bouncer checking them), never two humans
//      on one lane; A's card shows in A's hand on the other tabs.
//   3. A says yes: the others see A's band on A's wrist.
//   4. B says no: C watches B carried off and thrown (B's body lies back on
//      C's screen), then sat on the curb.
//   5. C doesn't answer while B is back in the line: C goes to the back.
// Shots: scratch PNGs in tools/.club-shots (not committed).
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-club-room-test.mjs

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
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
await ctx.route(/supabase/, (r) => r.abort());
const errors = [];
const pages = [];

/* Headless pages only draw (and so only send state and tick clocks) when
   something asks for a frame: screenshots ask, round the tabs. */
async function pump(ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) for (const p of pages) await p.screenshot({ type: "jpeg", quality: 10 }).catch(() => {});
}

async function open(label, user) {
  const page = await ctx.newPage();
  page.label = label;
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await page.addInitScript((user) => {
    const fake = { getCachedProfile: () => (user ? { username: user, tags: [] } : null) };
    Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => fake, set: () => {} });
    // Background tabs here count as hidden, and a hidden tab at the front
    // with others waiting goes to the back (that's case 5, by the clock).
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  }, user);
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 420000 });
  await page.waitForFunction(() => !!window.__trollOps && !!window.__trollClub, null, { timeout: 420000 });
  // Long enough at each step to see from the other tabs; the lockout short.
  await page.evaluate(() => {
    window.__trollOps.setLoadWaitMax(8);
    Object.assign(window.__trollClub.T, { checkSecs: 0.6, idSecs: 2.0, bandSecs: 1.6, lockSecs: 2, afkSecs: 600 });
  });
  await page.evaluate(async () => {
    const T = window.__trollOps;
    T.setMode("social");
    T.loadout.mapId = "trollingloud";
    await T.startGame();
  });
  await page.waitForFunction(() => !window.__trollOps.loadState().open, null, { timeout: 420000 });
  // The podiums take nobody till all three are in (released below).
  await page.evaluate(() => { window.__trollOps.els.pause.hidden = true; window.__trollClub.club.lanes.forEach((l) => { l.hold = true; }); });
  pages.push(page);
  await pump(400);
  if (process.env.DBG) console.log(label, await Promise.all(pages.map((p) => p.evaluate(() => [window.__trollClub.club.phase, window.__trollClub.club.ticket, Date.now(), window.__trollOps.djLulz?.skew]))));
  return page;
}
const R = (page) => page.evaluate(() => ({ phase: window.__trollClub.club.phase, ...window.__trollClub.room() }));
/* Pump every tab until `pred(states)` (one state per tab) or `ms`. */
async function until(pred, ms) {
  const t0 = Date.now();
  let s = await Promise.all(pages.map(R));
  while (Date.now() - t0 < ms && !pred(s)) { await pump(200); s = await Promise.all(pages.map(R)); }
  return s;
}

// The tabs already in keep drawing (and sending) while the next one loads.
let bg = true;
const bgPump = (async () => { while (bg) { if (pages.length) await pump(300); else await new Promise((r) => setTimeout(r, 200)); } })();
const A = await open("A", "club_a");
const B = await open("B", null);
const C = await open("C", null);
bg = false;
await bgPump;
await pump(1200);
const spawns = await Promise.all(pages.map((p) => p.evaluate(() => window.__trollClub.club.spawns)));
check("each tab spawned once", spawns.every((n) => n === 1), spawns.join());
let s = await Promise.all(pages.map(R));
const [a, b, c] = s;
const id = { A: a.me, B: b.me, C: c.me };
check("tickets in join order", a.ticket > 0 && a.ticket <= b.ticket && b.ticket <= c.ticket, `${a.ticket} ${b.ticket} ${c.ticket}`);

// 1. The line, on every tab: the humans in ticket order.
const order = (st) => st.line.map((e) => (e === "me" ? st.me : e)).filter((e) => e !== "npc");
s = await until((ss) => ss.every((st) => { const o = order(st).filter((x) => [id.A, id.B, id.C].includes(x)); return o.length >= 2; }), 6000);
for (const [k, st] of s.entries()) {
  const o = order(st).filter((x) => [id.A, id.B, id.C].includes(x));
  const ok = o.every((x, i) => i === 0 || [id.A, id.B, id.C].indexOf(o[i - 1]) < [id.A, id.B, id.C].indexOf(x));
  check(`${pages[k].label}'s line keeps the humans in ticket order`, ok && o.length >= 2, JSON.stringify(st.line));
}

for (const p of pages) await p.evaluate(() => window.__trollClub.club.lanes.forEach((l) => { l.hold = false; }));

// 2. A at a podium: the others see A there, their bouncer checking A, A's card out.
s = await until((ss) => ss[0].phase === "id" && ss[1].remotes.some((r) => r.id === id.A && r.ph === "id"), 60000);
const aOnB = s[1].remotes.find((r) => r.id === id.A);
check("A shows their ID at a podium", s[0].phase === "id", s[0].phase);
check("B sees A at the same lane, checked by B's copy of the bouncer",
  aOnB?.lane >= 0 && s[1].lanes[aOnB.lane].who === id.A && s[1].lanes[aOnB.lane].act === "check", JSON.stringify(s[1].lanes));
await pump(500);
s = await Promise.all(pages.map(R));
check("A's gold card in A's hand on C's screen", !!s[2].remotes.find((r) => r.id === id.A)?.card, JSON.stringify(s[2].remotes));
await B.screenshot({ path: path.join(SHOTS, "room-1-a-id-seen-by-b.png") });

// 3. A says yes: the band, seen.
s = await until((ss) => ss[0].phase === "ask", 15000);
await A.evaluate(() => window.__trollClub.answer(true));
s = await until((ss) => ss[1].remotes.find((r) => r.id === id.A)?.bandMesh && ss[2].remotes.find((r) => r.id === id.A)?.bandMesh, 15000);
check("B and C see A's band on A's wrist", s[1].remotes.find((r) => r.id === id.A)?.band === 1 && s[2].remotes.find((r) => r.id === id.A)?.bandMesh,
  JSON.stringify(s.map((st) => st.remotes.find((r) => r.id === id.A))));
check("A's wire says band 1, out of the line", s[0].wire.wb === 1 && !s[0].wire.cq, JSON.stringify(s[0].wire));

// Never two humans on one lane, on any tab, the whole way through.
let shared = 0;
const lanesOk = (ss) => { for (const st of ss) { const w = st.lanes.map((l) => l.who).filter((x) => x && x !== "npc"); if (new Set(w).size !== w.length) shared++; } };

// 4. B says no: thrown out, on C's screen too.
s = await until((ss) => (lanesOk(ss), ss[1].phase === "ask"), 60000);
check("B gets to a podium and the question", s[1].phase === "ask", s[1].phase);
await B.evaluate(() => window.__trollClub.answer(false));
s = await until((ss) => ss[2].remotes.find((r) => r.id === id.B)?.kick > 0.5, 8000);
const bOnC = () => s[2].remotes.find((r) => r.id === id.B);
check("C plays B's throw-out", bOnC()?.kick > 0 && bOnC()?.ph === "kick", JSON.stringify(bOnC()));
s = await until((ss) => ss[2].remotes.find((r) => r.id === id.B)?.lie > 1.2, 8000);
check("B lands on their back on C's screen", bOnC()?.lie > 1.2, JSON.stringify(bOnC()));
await C.screenshot({ path: path.join(SHOTS, "room-2-b-thrown-seen-by-c.png") });
s = await until((ss) => ss[2].remotes.find((r) => r.id === id.B)?.ph === "sit", 10000);
check("then sat on the curb", bOnC()?.ph === "sit" && bOnC()?.y < 0.2, JSON.stringify(bOnC()));
await C.screenshot({ path: path.join(SHOTS, "room-3-b-on-the-curb.png") });

// 5. C at the question, not answering; B back in line: C to the back.
s = await until((ss) => (lanesOk(ss), ss[2].phase === "ask"), 60000);
check("C gets to the question", s[2].phase === "ask", s[2].phase);
await C.evaluate(() => { window.__trollClub.T.afkSecs = 3; });
s = await until((ss) => ss[1].phase === "lockout" && !ss[1].wire.ce?.startsWith("kick"), 10000);
await pump(2500);   // the lockout runs out
await B.evaluate(() => window.__trollClub.join());
s = await until((ss) => ss[2].phase === "queued", 12000);
check("C, slow at the front with B waiting, goes to the back of the line", s[2].phase === "queued", s[2].phase);
const cLine = order(s[2]).filter((x) => [id.B, id.C].includes(x));
check("behind B (a new ticket)", cLine.join() === [id.B, id.C].join() && s[2].ticket > s[1].ticket, JSON.stringify({ line: s[2].line, cT: s[2].ticket, bT: s[1].ticket }));
check("never two humans at one lane", shared === 0, `${shared} frames`);

check("no page errors", errors.length === 0, errors.slice(0, 4).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASSED");
process.exit(failures ? 1 : 0);
