// Troll Ops walk test: holds W from set spots on each map and checks where
// the player ends up (stairs climbed, doors passed, rails holding).
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-map-walk.mjs [mapId ...]
//
// Each run: [x, feetY, z, faceX, faceZ, seconds, label, check(result)], where
// result = { startY, maxY, end: [x, y, z] }. Every map starts with a warm-up
// walk: the first run after a map loads crawls while models stream in, and
// used to fail for that reason alone. Headless Chrome with the real GPU
// (--use-angle=d3d11); the sim runs slower than real time, so runs are long.

import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };

const RUNS = {
  grinsite: [  [0, 0, 14.2, 0, -1, 4, "flight A -> level 1", (r) => r.maxY >= 3.4],
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
  ],
  dustbowl: [  [-3.5, 0, -0.5, 0, -1, 4, "house stair -> roof", (r) => r.maxY >= 3.4],
  [-30, 0, 23, 0, -1, 2.5, "channel -> north bank (W)", (r) => r.maxY >= 1.1],
  [30, 0, 14.2, 0, 1, 2.5, "street -> north bank (E)", (r) => r.maxY >= 1.1],
  [-10, 0, 27.2, 0, 1, 2.5, "channel -> south bank", (r) => r.maxY >= 1.1],
  [12, 0, 27.2, 0, 1, 2.5, "channel -> south bank (E)", (r) => r.maxY >= 1.1],
  [0, 1.2, 17.5, 0, 1, 2.5, "north bank -> footbridge", (r) => r.end[2] > 21 && r.end[1] > 1.1],
  [-7, 0, 10, 0, 1, 2.5, "cut-through house", (r) => r.end[2] > 17],
  [-16, 0, 6, 0, -1, 2.5, "through north house", (r) => r.end[2] < -2.5],
  [-27, 0, -20, 0, -1, 2.5, "into courtyard (S gate)", (r) => r.end[2] < -24],
  [0, 0, 1.5, 0, -1, 2, "into centre house (S door)", (r) => r.end[2] < -1],
  ],
  depot: [  [-23, 0, 7.6, 0, 1, 4, "west stair -> south catwalk", (r) => r.maxY >= 4.9],
  [23, 0, -7.6, 0, -1, 4, "east stair -> north catwalk", (r) => r.maxY >= 4.9],
  [25.5, 5.0, -12, 0, 1, 3, "east catwalk -> into office", (r) => r.end[2] > -5 && r.end[1] > 4.9],
  [-12, 0, 5, 0, -1, 3, "aisle run between racks", (r) => r.end[2] < -3],
  [0, 5.0, 19, 0, -1, 1.5, "south catwalk rail holds", (r) => r.end[2] > 17 && r.end[1] > 4.9],
  [22, 5.0, 0, -1, 0, 2, "office glass holds", (r) => r.end[0] > 16.2],
  ],
  undergrin: [  [0.3, 0, 22.75, -1, 0, 4, "track (N) -> west platform", (r) => r.maxY >= 1.05],
  [-0.3, 0, -22.75, 1, 0, 2.5, "track (S) -> east platform", (r) => r.maxY >= 1.05],
  [-8.5, 1.1, -20.9, 0, -1, 3.5, "platform -> south mezzanine", (r) => r.maxY >= 3.7],
  [8.5, 1.1, 20.9, 0, 1, 3.5, "platform -> north mezzanine", (r) => r.maxY >= 3.7],
  [0, 1.1, -8, 0, 1, 3, "along inside the train", (r) => r.end[2] > 5],
  [-8, 1.1, 3, 1, 0, 5, "west platform -> through train -> east", (r) => r.end[0] > 5 && r.end[1] > 1.0],
  [2, 3.8, -28, 0, 1, 1.5, "mezzanine rail holds", (r) => r.end[2] < -26.5 && r.end[1] > 3.7],
  ],
  culdegrin: [  [-10.4, 0, 0, -1, 0, 2.5, "into west-middle house", (r) => r.end[0] < -14],
  [10.4, 0, 0, 1, 0, 2.5, "into east-middle house", (r) => r.end[0] > 14],
  [-22.7, 0, -4.2, 0, 1, 4, "sage-attic stair", (r) => r.maxY >= 3.2],
  [21.7, 0, 13.9, 0, 1, 4, "terracotta-attic stair", (r) => r.maxY >= 3.2],
  [-11.3, 0, -18, -1, 0, 2.5, "into west-north house", (r) => r.end[0] < -14],
  [11.3, 0, 18, 1, 0, 2.5, "into east-south house", (r) => r.end[0] > 14],
  [0, 0, 26, 0, -1, 6, "down the street", (r) => r.end[2] < 3],
  ],
  grinbeach: [  [-19.8, 0, -5.4, 0, -1, 3.5, "west ramp up", (r) => r.maxY >= 3.0],
  [-19.8, 3.1, -11.9, 1, 0, 2, "west ramp top -> onto deck", (r) => r.end[0] > -17 && r.end[1] > 3],
  [-6.2, 0, -13.4, 0, -1, 3.5, "east ramp up", (r) => r.maxY >= 3.0],
  [-6.2, 3.1, -19.9, -1, 0, 2, "east ramp top -> onto deck", (r) => r.end[0] < -9 && r.end[1] > 3],
  [-13, 3.1, -8, 0, -1, 8, "deck run to the end", (r) => r.end[2] < -40 && r.end[2] > -44.1 && r.end[1] > 3],
  ],
};

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
const maps = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(RUNS);
let fails = 0;
for (const map of maps) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("ERR", e.message));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
  await page.evaluate(async (map) => {
    const T = window.__trollOps; T.setMode("ops"); T.loadout.mapId = map;
    await T.startGame(); if (T.isStaging()) T.endStaging();
    T.player.maxHp = T.player.hp = 1e9;
  }, map);
  await new Promise((r) => setTimeout(r, 6000));
  console.log(`\n${map}`);
  for (const [x, y, z, fx, fz, secs, label, check] of [[0, 0, 0, 0, 1, 1.5, "warm-up", () => true], ...RUNS[map]]) {
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
    if (label === "warm-up") continue;
    const ok = check(r);
    if (!ok) fails++;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(40)} max y ${r.maxY}  end ${JSON.stringify(r.end)}`);
  }
  await page.close();
}
console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
