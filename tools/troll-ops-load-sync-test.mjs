// Map loading screen + "nobody starts until everyone has loaded".
//
// Three tabs in one headless browser share a private room over
// BroadcastChannel (Supabase blocked):
//   1. A (host) and B start together with different maps picked. B's map
//      files are held back for a while, so B loads slowly.
//   2. A finishes first and must sit on the loading screen, waiting, until
//      B is done; B must switch to A's map; then both come off it together
//      and the countdown runs.
//   3. C joins once the match is on: C gets its own loading screen, then is
//      let in, and A's match is never paused for it.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-load-sync-test.mjs

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

const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 320, height: 200 } });
await ctx.route(/supabase/, (r) => r.abort());
const ROOM = "LDS" + Math.floor(Math.random() * 90 + 10);
const errors = [];

async function open(label) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
  return page;
}
function start(page, mapId) {
  // Not awaited past startGame's return: the load runs on its own.
  return page.evaluate(async ({ room, mapId }) => {
    const T = window.__trollOps;
    T.setMode("tdm");
    if (T.els.noBots) T.els.noBots.checked = true;
    T.els.room.value = room;
    T.els.room.dispatchEvent(new Event("input"));
    T.loadout.mapId = mapId;
    await T.startGame();
  }, { room: ROOM, mapId });
}
const st = (page) => page.evaluate(() => window.__trollOps.loadState());
const mapOf = (page) => page.evaluate(() => window.__trollOps.builtMap()?.map?.name || null);
async function until(page, fn, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const s = await st(page); if (fn(s)) return s; await sleep(250); }
  return st(page);
}

const a = await open("A"), b = await open("B"), c = await open("C");

// B's map models (Grin Site, the host's) answer slowly: B finishes well after A.
let holdB = true;
await b.route(/models\/gs-.*\.glb/, async (r) => { while (holdB) await sleep(200); r.continue(); });

await start(a, "grinsite");
await sleep(300);
await start(b, "dustbowl");

// A finishes loading and waits for B.
const aw = await until(a, (s) => s.warm, 240000);
check("A loads and warms its map under the loading screen", aw.open && aw.warm, JSON.stringify(aw));
await sleep(3000);
const aw2 = await st(a), bw = await st(b);
check("A keeps waiting while B is still loading", aw2.open && aw2.hold, aw2.status);
check("A says who it's waiting on", /Waiting for players 1\/2/.test(aw2.status), aw2.status);
check("B is still on its loading screen", bw.open, JSON.stringify(bw));
check("B switched to the host's map", bw.target === "grinsite" || (await mapOf(b)) === "Grin Site", `B target ${bw.target}`);

// Let B finish: both should come off the screen and count down together.
holdB = false;
const bDone = await until(b, (s) => !s.open, 240000);
const aDone = await until(a, (s) => !s.open, 20000);
check("B comes off the loading screen once loaded", !bDone.open, JSON.stringify(bDone));
check("A comes off it too", !aDone.open, JSON.stringify(aDone));
check("both are on the host's map", (await mapOf(a)) === "Grin Site" && (await mapOf(b)) === "Grin Site", `${await mapOf(a)} / ${await mapOf(b)}`);
check("the countdown runs after loading", aDone.staging || bDone.staging, `A stageT ${aDone.stageT}, B stageT ${bDone.stageT}`);

// C joins the running match.
await until(a, (s) => !s.staging, 30000);
await start(c, "depot");
const cDone = await until(c, (s) => !s.open, 240000);
const aMid = await st(a);
check("C is let in after its own loading screen", !cDone.open, JSON.stringify(cDone));
check("C loaded the host's map", (await mapOf(c)) === "Grin Site", await mapOf(c));
check("A's match never went back to loading for C", !aMid.open && !aMid.hold, JSON.stringify(aMid));

// The wait has a time limit (user, 2026-10-04): in a fresh room, E's map
// files stall well past it. D (host) starts without E once it runs out,
// shows the countdown meanwhile, and E is let in when it does finish.
for (const p of [a, b, c]) await p.close();
const ROOM2 = "LDT" + Math.floor(Math.random() * 90 + 10);
const d = await open("D"), e = await open("E");
let holdE = true;
await e.route(/models\/gs-.*\.glb/, async (r) => { while (holdE) await sleep(200); r.continue(); });
const WAIT = 6;
await d.evaluate((s) => window.__trollOps.setLoadWaitMax(s), WAIT);
const start2 = (page, mapId) => page.evaluate(async ({ room, mapId }) => {
  const T = window.__trollOps;
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  T.els.room.value = room;
  T.els.room.dispatchEvent(new Event("input"));
  T.loadout.mapId = mapId;
  await T.startGame();
}, { room: ROOM2, mapId });
await start2(d, "grinsite");
await sleep(300);
await start2(e, "grinsite");
const dw = await until(d, (s) => s.warm, 240000);
const dWaiting = await until(d, (s) => /starting in \d+s/.test(s.status), 10000);
check("the host shows how long it will wait", /Waiting for players 1\/2 · starting in \d+s/.test(dWaiting.status), dWaiting.status);
const t0 = Date.now();
const dOff = await until(d, (s) => !s.open, (WAIT + 20) * 1000);
const waited = (Date.now() - t0) / 1000;
const eStill = await st(e);
check("the host stops waiting for a stuck player after the limit", dw.warm && !dOff.open, `${waited.toFixed(1)}s, ${dOff.status}`);
check("the stuck player is still loading meanwhile", eStill.open, JSON.stringify(eStill));
holdE = false;
const eDone = await until(e, (s) => !s.open, 240000);
check("the stuck player is let in once it finishes", !eDone.open, JSON.stringify(eDone));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
