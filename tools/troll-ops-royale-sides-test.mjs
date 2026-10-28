// Troll Royale: Two Worlds, phase 2: a match starts on either side of the
// island, and a room plays its host's side. Two tabs in one private room
// (Supabase blocked, BroadcastChannel carries it): A, the host, tosses the
// underside (Hollowgrin), B tosses the top; B must land on A's side, with the
// same zone and loot, Hollowgrin's Royale rules and the island round it.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-royale-sides-test.mjs

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
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 640, height: 400 } });
await ctx.route(/supabase/, (r) => r.abort());
const ROOM = "SID" + Math.floor(Math.random() * 90 + 10);
const errors = [];

async function open(label, side) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  // what this tab would toss on its own (royale.js pickSide reads it on a test page)
  await page.addInitScript((s) => { window.__royaleSide = s; }, side);
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`);
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
  await page.evaluate(async (room) => {
    const T = window.__trollOps;
    T.composer && (T.composer.render = () => {});
    T.DROP.enabled = false;
    T.setMode("royale");
    if (T.els.noBots) T.els.noBots.checked = true;
    T.els.room.value = room;
    T.els.room.dispatchEvent(new Event("input"));
    await T.startGame();
  }, ROOM);
  return page;
}
const A = await open("A", "hollowgrin");
await sleep(2500);   // A is the room's host before B shows up
const B = await open("B", "trollface");
await Promise.all([A, B].map((p) => p.waitForFunction(() => window.__trollOps.state() === "playing" && !!window.__trollOps.royale(), null, { timeout: 240000 })));
await sleep(8000);   // the island's scenery streams in

const look = (p) => p.evaluate(() => {
  const T = window.__trollOps, r = T.royale(), map = T.builtMap().map;
  let island = 0;
  T.scene.getObjectByName("hg-island")?.traverse((n) => { if (n.isMesh) island++; });
  return { map: map.name, line: map.royale?.dropLine || "", seed: r.seed, zone: JSON.stringify(r.zone.circles), n: r.loot.items.size, island };
});
const la = await look(A), lb = await look(B);
check("the host lands on the side it tossed: the underside, Hollowgrin", la.map === "Hollowgrin", la.map);
check("the other tab takes the host's side, not its own toss", lb.map === la.map, `${lb.map}`);
check("both build the same zone and loot", la.seed === lb.seed && la.zone === lb.zone && la.n === lb.n, JSON.stringify({ a: la.seed, b: lb.seed, na: la.n, nb: lb.n }));
check("Hollowgrin Island stands round the village for both", la.island > 0 && lb.island > 0, `${la.island}, ${lb.island}`);
check("the drop's banner names the underside", la.line.includes("Hollowgrin"), la.line);
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
