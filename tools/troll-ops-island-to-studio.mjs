// Trollface Island into Roblox Studio (doc "Troll Royale map in Roblox Studio",
// phase 1): writes assets/games/troll-ops/studio/trollface-island/island.json,
// everything studio/trollface-island/build-island.luau needs to lay the island
// out in a Studio place: the coast and lake, the ground paint as one material
// per 2 m cell, the colliders, and the markers gameplay depends on (POI rings,
// spawns, deck loot, play bounds).
//
//   node tools/troll-ops-island-to-studio.mjs
//
// Then serve the checkout (node tools/static-serve.mjs 5192) and run
// build-island.luau in the place's Edit datamodel over the Studio MCP.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "assets/games/troll-ops/studio/trollface-island/island.json");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary" };
const PAGE = `<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{"three":"/assets/vendor/three.module.min.js","three/addons/":"/assets/vendor/addons/"}}</script>`;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (u === "/__island.html") { res.writeHead(200, { "content-type": "text/html" }); return res.end(PAGE); }
  const p = path.join(ROOT, u);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/__island.html`);
const data = await page.evaluate(async () => {
  const m = await import(`/assets/games/troll-ops/maps/trollface-island.js?t=${Date.now()}`);
  const { insidePolygon } = await import("/assets/games/troll-ops/maps/edge.js");
  const { ISLAND_SOLIDS } = await import(`/assets/games/troll-ops/maps/trollface-island-colliders.js?t=${Date.now()}`);
  const I = m.TROLLFACE_ISLAND, b = I.bounds;
  // One material per mask cell (2 m): the strongest of the map's own paint.
  // 0 off the island, 1 grass, 2 sand, 3 path, 4 rock, 5 lake (sand bed, water over).
  const tex = m.groundMask(), { width: W, height: H, data: px } = tex.image;
  const RES = (b.maxX - b.minX) / W;
  let cells = "";
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = b.minX + (i + 0.5) * RES, z = b.minZ + (j + 0.5) * RES, o = (j * W + i) * 4;
    let c = 1;
    if (!insidePolygon(I.edge, x, z)) c = 0;
    else if (insidePolygon(I.wade, x, z)) c = 5;
    else {
      const [sand, pathK, rock] = [px[o], px[o + 1], px[o + 2]];
      const top = Math.max(sand, pathK, rock);
      if (top >= 128) c = top === rock ? 4 : top === pathK ? 3 : 2;
    }
    cells += c;
  }
  return {
    studsPerM: 3,
    bounds: b,
    edge: I.edge,
    lake: I.wade,
    waterY: 0.34,
    landmarks: Object.fromEntries(Object.entries(m.LANDMARKS)),
    spawns: I.spawns,
    lootExtra: I.royale.lootExtra,
    mask: { res: RES, w: W, h: H, cells },
    colliders: ISLAND_SOLIDS,
  };
});
await browser.close();
server.close();
if (errors.length) { console.error("page errors:", errors); process.exit(1); }

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(data));
const counts = {};
for (const ch of data.mask.cells) counts[ch] = (counts[ch] || 0) + 1;
console.log(`wrote ${path.relative(ROOT, OUT)}: ${data.colliders.length} colliders, ${Object.keys(data.landmarks).length} landmarks, ${data.spawns.length} spawns, mask ${data.mask.w}x${data.mask.h}`, JSON.stringify(counts));
