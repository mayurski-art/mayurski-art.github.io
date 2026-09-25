// Troll Ops map helper (see assets/games/troll-ops/HANDOFF.md). Usage: NODE_PATH=<checkout>/node_modules node tools/troll-ops-map-walk.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url); // run with NODE_PATH=<checkout>/node_modules
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
await ctx.route(/supabase/, (r) => r.abort());
const MAP = process.argv[2] || "grinsite_wip";
// [x, y, z, faceDX, faceDZ, secs, label, check(r) -> bool]
const RUNS = [
  [0, 0, 14.2, 0, -1, 4, "flight A -> level 1", (r) => r.maxY >= 3.4],
  [7.7, 3.5, -4, -1, 0, 4, "flight B -> level 2", (r) => r.maxY >= 6.6],
  [-24, 0, -14.2, 0, -1, 4, "NW scaffold stair", (r) => r.maxY >= 3.45],
  [24, 0, 14.2, 0, 1, 4, "SE scaffold stair", (r) => r.maxY >= 3.45],
  [-24, 0, 14.2, 0, 1, 4, "SW scaffold stair", (r) => r.maxY >= 3.45],
  [28, 0, -2.5, 0, -1, 3.5, "container stair", (r) => r.maxY >= 2.5],
  [-13.2, 0, 8, -1, 0, 2.5, "foundation east steps", (r) => r.maxY >= 1.1],
  [-27, 0, -14.8, 0, 1, 2.5, "foundation north steps", (r) => r.maxY >= 1.1],
  [20.8, 0, 1, 1, 0, 2.5, "through the open container", (r) => r.end[0] > 27.5],
  [-4, 0, -19, 0, -1, 1.5, "into the site office", (r) => r.end[2] < -21.5],
  [24, 3.55, -24, 1, 0, 2, "scaffold side rail holds", (r) => r.end[0] < 26.2 && r.end[1] > 3.4],
  [24, 3.55, -24, 0, -1, 2, "scaffold back rail holds", (r) => r.end[2] > -26.2 && r.end[1] > 3.4],
];
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("ERR", e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
await page.evaluate(async (map) => {
  const T = window.__trollOps; T.setMode("ops"); T.loadout.mapId = map;
  await T.startGame(); if (T.isStaging()) T.endStaging();
  T.player.maxHp = T.player.hp = 1e9;
}, MAP);
await new Promise((r) => setTimeout(r, 1500));
let fails = 0;
for (const [x, y, z, fx, fz, secs, label, check] of RUNS) {
  const r = await page.evaluate(async ([x, y, z, fx, fz, secs]) => {
    const T = window.__trollOps;
    T.keys.clear();
    T.move.pos.set(x, y, z); T.move.velocity?.set(0, 0, 0);
    await new Promise((r) => setTimeout(r, 400));
    T.look.yaw = Math.atan2(-fx, -fz); T.look.pitch = 0;
    const startY = T.move.pos.y;
    T.keys.add("KeyW");
    let maxY = startY;
    const t0 = performance.now();
    while (performance.now() - t0 < secs * 1000) {
      T.look.yaw = Math.atan2(-fx, -fz);
      maxY = Math.max(maxY, T.move.pos.y);
      await new Promise((r) => setTimeout(r, 50));
    }
    T.keys.delete("KeyW");
    return { startY: +startY.toFixed(2), maxY: +maxY.toFixed(2), end: [+T.move.pos.x.toFixed(1), +T.move.pos.y.toFixed(2), +T.move.pos.z.toFixed(1)] };
  }, [x, y, z, fx, fz, secs]);
  const ok = check(r);
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label.padEnd(30)} start y ${r.startY} max y ${r.maxY} end ${JSON.stringify(r.end)}`);
}
console.log(fails ? `${fails} FAILED` : "ALL PASS");
await browser.close(); server.close();
