// One map per room: everyone in a versus room plays the host's map (the
// room's oldest player), whatever they picked themselves.
//
// Three tabs in one headless browser share a private room over
// BroadcastChannel (Supabase blocked), each with a different map picked:
//   1. A and B start together: B follows A's map during the countdown.
//   2. C joins once the match is running: C loads A's map, not its own.
//   3. A never moves off its own pick.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-room-map-test.mjs

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
const ROOM = "MAP" + Math.floor(Math.random() * 90 + 10);
const errors = [];

async function open(label) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
  return page;
}
async function start(page, mapId) {
  await page.evaluate(async ({ room, mapId }) => {
    const T = window.__trollOps;
    T.composer.render = () => {};
    T.setMode("tdm");
    if (T.els.noBots) T.els.noBots.checked = true;
    T.els.room.value = room;
    T.els.room.dispatchEvent(new Event("input"));
    T.loadout.mapId = mapId;
    await T.startGame();
  }, { room: ROOM, mapId });
}
const mapOf = (page) => page.evaluate(() => window.__trollOps.builtMap()?.map?.name || null);

const a = await open("A"), b = await open("B"), c = await open("C");
await Promise.all([start(a, "grinsite"), sleep(300).then(() => start(b, "dustbowl"))]);
await sleep(12000);
const [ma, mb] = [await mapOf(a), await mapOf(b)];
check("A (host) keeps its own map", ma === "Grin Site", ma);
check("B, starting together, follows the host", mb === ma, `B on ${mb}`);

await start(c, "depot");
await sleep(8000);
const mc = await mapOf(c);
check("C, joining a running match, loads the host's map", mc === ma, `C on ${mc}`);
check("A still on its map", (await mapOf(a)) === "Grin Site");
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
