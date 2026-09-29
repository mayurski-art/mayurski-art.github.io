// Troll Royale on Trollface Island: 20 trolls, loot and zone circles only on
// dry land, the invisible wall at the cliff edge holds, and the lake is a
// slow wade.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-royale-island-test.mjs

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

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`);
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
// The sky lobby and the bus have their own test (troll-ops-royale-drop-test.mjs).
await page.evaluate(async () => { const T = window.__trollOps; T.DROP.enabled = false; T.setMode("royale"); await T.startGame(); });
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.isStaging(), null, { timeout: 120000 });

const info = await page.evaluate(async () => {
  const T = window.__trollOps, r = T.royale();
  const { ISLAND_EDGE, ISLAND_LAKE } = await import("/assets/games/troll-ops/trollface-island.js?v=ti3");
  const { insidePolygon } = await import("/assets/games/troll-ops/edge.js");
  const items = [...r.loot.items.values()];
  return {
    map: T.loadedMapId(), alive: T.royaleAliveList().length, loot: items.length,
    offIsland: items.filter((it) => !insidePolygon(ISLAND_EDGE, it.x, it.z)).length,
    inLake: items.filter((it) => insidePolygon(ISLAND_LAKE, it.x, it.z)).length,
    wetCircles: r.zone.circles.filter((c) => !insidePolygon(ISLAND_EDGE, c.x, c.z) || insidePolygon(ISLAND_LAKE, c.x, c.z)).length,
    circles: r.zone.circles.length, edge0: ISLAND_EDGE[0],
  };
});
check("Troll Royale plays on Trollface Island", info.map === "trollface", info.map);
check("20 trolls land", info.alive === 20, `${info.alive}`);
check("the island is stocked", info.loot >= 250, `${info.loot} items`);
check("no loot in the sea or the lake", info.offIsland === 0 && info.inLake === 0, JSON.stringify({ off: info.offIsland, lake: info.inLake }));
check("every zone circle is centred on dry land", info.wetCircles === 0, `${info.wetCircles} of ${info.circles} wet`);

// Nobody shoots, nobody hurts: this is about walking.
await page.evaluate(() => { const T = window.__trollOps; T.bots.update = () => {}; T.player.spawnGuard = 1e9; });

// Hold W from (x, z) towards (fx, fz) for `ms`; where did it end up?
const walk = (x, z, fx, fz, ms) => page.evaluate(async ({ x, z, fx, fz, ms }) => {
  const T = window.__trollOps;
  T.move.pos.set(x, 1.2, z); T.move.velocity?.set(0, 0, 0);
  T.look.yaw = Math.atan2(-fx, -fz); T.look.pitch = 0;
  await new Promise((r) => setTimeout(r, 600));   // settle onto the ground
  const s = { x: T.move.pos.x, z: T.move.pos.z };
  T.keys.add("KeyW");
  // Peak speed, not distance: a rock in the way shortens a walk, not its pace.
  let top = 0;
  const t0 = performance.now();
  await new Promise((res) => { const tick = () => {
    const v = T.move.velocity;
    if (v) top = Math.max(top, Math.hypot(v.x, v.z));
    if (performance.now() - t0 < ms) requestAnimationFrame(tick); else res();
  }; requestAnimationFrame(tick); });
  T.keys.delete("KeyW");
  return { dist: Math.hypot(T.move.pos.x - s.x, T.move.pos.z - s.z), top, end: [T.move.pos.x, T.move.pos.z] };
}, { x, z, fx, fz, ms });

// The wall: start just inside the first edge vertex and walk straight out.
const [ex, ez] = info.edge0;
const len = Math.hypot(ex, ez);
const out = await walk(ex - (ex / len) * 4, ez - (ez / len) * 4, ex / len, ez / len, 3000);
const held = await page.evaluate(async (p) => {
  const { ISLAND_EDGE } = await import("/assets/games/troll-ops/trollface-island.js?v=ti3");
  const { insidePolygon } = await import("/assets/games/troll-ops/edge.js");
  return insidePolygon(ISLAND_EDGE, p[0], p[1]) && window.__trollOps.player.alive;
}, out.end);
check("the cliff edge holds you (invisible wall)", held, JSON.stringify(out.end.map((v) => +v.toFixed(1))));

// Wading: the same walk along the south-east path and across the middle of
// the lake.
const dry = await walk(68, 92, 1, -0.43, 2000);
const wet = await walk(60, 40, 1, 0, 2000);
check("the lake is a slow wade", wet.dist > 0.5 && wet.top < dry.top * 0.7,
  JSON.stringify({ dryTop: +dry.top.toFixed(2), wetTop: +wet.top.toFixed(2), dry: +dry.dist.toFixed(1), wet: +wet.dist.toFixed(1) }));

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
