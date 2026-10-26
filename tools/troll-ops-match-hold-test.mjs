// No auto-start: when a room match ends, the map vote runs its 20 s and then
// waits on the winner (user: "dont auto start another match after one has
// ended"). Only Drop in again starts the next match.
//
// One headless tab in a private room (BroadcastChannel, Supabase blocked):
//   1. end a TDM match: the vote is up, the state is "gameover"
//   2. run the vote clock out: still "gameover", the next map held, the room
//      still sending (net.update keeps running)
//   3. press Drop in again: the held map loads and the match runs
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-match-hold-test.mjs

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

const browser = await chromium.launch({ args: ["--use-angle=d3d11",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 480, height: 300 } });
await ctx.route(/supabase/, (r) => r.abort());
const ROOM = "HLD" + Math.floor(Math.random() * 90 + 10);
const errors = [];

const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
const loaded = async (ms = 240000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms && await page.evaluate(() => window.__trollOps.loadState().open)) await sleep(250);
};
await page.evaluate(async (room) => {
  const T = window.__trollOps;
  T.composer.render = () => {};
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  T.els.room.value = room;
  T.els.room.dispatchEvent(new Event("input"));
  T.loadout.mapId = "grinsite";
  await T.startGame();
}, ROOM);
await loaded();
check("in a private room", await page.evaluate(() => window.__trollOps.net.active && window.__trollOps.net.room) === ROOM);

await page.evaluate(() => window.__trollOps.endMatch("Match over"));
await sleep(500);
let s = await page.evaluate(() => ({ st: window.__trollOps.state(), t: window.__trollOps.intermissionT(), vis: !document.getElementById("to-intermission").hidden }));
check("match end opens the vote", s.st === "gameover" && s.t > 0 && s.vis, JSON.stringify(s));

// Run the clock out (the frame loop ticks it), then give it a few seconds
// where the old code would already have loaded the next map.
await page.evaluate(() => { const T = window.__trollOps; T.updateIntermission(T.intermissionT() + 0.01); });
await sleep(4000);
s = await page.evaluate(() => {
  const T = window.__trollOps;
  return { st: T.state(), held: T.matchHeld(), opts: T.voteOptions(), head: document.querySelector(".to-vote-head")?.textContent,
    load: T.loadState().open, vis: !document.getElementById("to-intermission").hidden, net: T.net.active };
});
check("vote ends without starting a match", s.st === "gameover" && !s.load, JSON.stringify(s));
check("the next map is held and shown", s.held && s.opts.length === 1 && /Next map — \S/.test(s.head || "") && s.vis, JSON.stringify(s));
check("room still up while held", s.net);
const heldMap = s.opts[0];

await page.evaluate(() => document.getElementById("to-retry-btn").click());
await sleep(500);
await loaded();
await sleep(1500);
s = await page.evaluate(() => ({ st: window.__trollOps.state(), held: window.__trollOps.matchHeld(), map: window.__trollOps.loadout.mapId }));
check("Drop in again starts the held map", s.st === "playing" && !s.held && s.map === heldMap, JSON.stringify(s));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
