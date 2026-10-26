// Dumps Trollface Island's playable layout, the contract the Blender build
// draws to and never moves (doc "Troll Forces: Trollface Island in Blender"),
// to assets/games/troll-ops/models/trollface-island-layout.json for
// models/build_trollface_island.blender.py: the bounds, the coast and lake
// polygons, the 14 places (centre, radius, tier), the roads, the spawns, the
// deck loot, the colliders by landmark, the ground field and the props as
// data. A hash of the four source files goes with it: the build records the
// hash it drew from, so art and colliders can't part without a rebuild.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-island-layout.mjs
//
// Re-run after every layout change, then re-run the Blender build. Loads the
// map module in a bare page (no game, no room).

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "assets/games/troll-ops");
const OUT = path.join(DIR, "models/trollface-island-layout.json");
const SOURCES = ["maps/trollface-island.js", "maps/trollface-island-colliders.js", "maps/trollface-island-ground.js", "maps/trollface-island-props.js"];
const hash = crypto.createHash("sha1");
for (const f of SOURCES) hash.update(fs.readFileSync(path.join(DIR, f)));
const HASH = hash.digest("hex").slice(0, 12);

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };
const PAGE = `<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{"three":"/assets/vendor/r186/three.module.js","three/addons/":"/assets/vendor/r186/addons/"}}</script>`;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (u === "/__layout.html") { res.writeHead(200, { "content-type": "text/html" }); return res.end(PAGE); }
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
await page.goto(`http://localhost:${server.address().port}/__layout.html`);
const data = await page.evaluate(async () => {
  const t = Date.now();
  const m = await import(`/assets/games/troll-ops/maps/trollface-island.js?t=${t}`);
  const { ISLAND_SOLIDS } = await import(`/assets/games/troll-ops/maps/trollface-island-colliders.js?t=${t}`);
  const { ISLAND_GROUND } = await import(`/assets/games/troll-ops/maps/trollface-island-ground.js?t=${t}`);
  const { ISLAND_PROPS } = await import(`/assets/games/troll-ops/maps/trollface-island-props.js?t=${t}`);
  const I = m.TROLLFACE_ISLAND;
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const poly = (p) => p.map(([x, z]) => [r3(x), r3(z)]);
  const places = {};
  for (const [k, p] of Object.entries(m.LANDMARKS)) places[k] = { name: p.name, x: r3(p.x), z: r3(p.z), r: p.r, tier: p.tier };
  return {
    bounds: I.bounds,
    edge: poly(m.ISLAND_EDGE),
    lake: poly(m.ISLAND_LAKE),
    places,
    roads: (m.ROADS || []).map(poly),
    parking: (m.PARKING || []).map(([x, z, yaw]) => [r3(x), r3(z), yaw]),
    spawns: I.spawns.map(([x, z]) => [r3(x), r3(z)]),
    lootExtra: I.royale.lootExtra,
    royale: { players: I.royale.players, lootPerSqM: I.royale.lootPerSqM, chests: I.royale.chests, phases: I.royale.phases },
    colliders: ISLAND_SOLIDS,
    ground: ISLAND_GROUND,
    props: ISLAND_PROPS,
  };
});
await browser.close(); server.close();
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
const out = { hash: HASH, sources: SOURCES, ...data };
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
const byLandmark = {};
for (const c of data.colliders) byLandmark[c.n] = (byLandmark[c.n] || 0) + 1;
console.log(`wrote ${path.relative(ROOT, OUT)}: ${Object.keys(data.places).length} places, ${data.colliders.length} colliders (${Object.entries(byLandmark).map(([k, n]) => `${k} ${n}`).join(", ")}), ${data.spawns.length} spawns, ${data.roads.length} roads, ${data.props.items.length} props, ground ${data.ground.w}x${data.ground.h}, hash ${HASH}`);
