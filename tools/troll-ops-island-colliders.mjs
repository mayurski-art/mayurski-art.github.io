// Trollface Island's colliders as data (doc "Troll Royale map in Roblox
// Studio", phase 1). The map's build lays its colliders in code; with
// islandCollidersFromCode set it still does, and this tool records them.
//
//   node tools/troll-ops-island-colliders.mjs           check: the game's build
//        (from maps/trollface-island-colliders.js) gives the same colliders as
//        the code, to within 1 cm
//   node tools/troll-ops-island-colliders.mjs --write   write that file from
//        the code (only before the first Studio edit: after that, Studio's
//        export is the truth and the code's copy is out of date)
//
// Each collider is { n, x, z, w, d, h, y, pen }: centre x/z, size w (x) d (z)
// h, base y, and how much a bullet loses going through. `n` names the
// landmark it sits in (nearest ring), or "ground".

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "assets/games/troll-ops/maps/trollface-island-colliders.js");
const WRITE = process.argv.includes("--write");
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
// Build the island twice against a stub map api that only records ghostBox:
// once from the code, once as the game does it (from the data file).
const { code, game, landmarks } = await page.evaluate(async () => {
  const m = await import(`/assets/games/troll-ops/maps/trollface-island.js?t=${Date.now()}`);
  const run = (fromCode) => {
    const got = [];
    const api = new Proxy({}, {
      get(_, k) {
        if (k === "islandCollidersFromCode") return fromCode;
        if (k === "ghostBox") return (x, z, w, d, h, { y = 0, pen = 0.9 } = {}) => { got.push({ x, z, w, d, h, y, pen }); return {}; };
        return () => ({});
      },
    });
    m.TROLLFACE_ISLAND.build(api);
    return got;
  };
  return { code: run(true), game: run(false), landmarks: m.LANDMARKS };
});
await browser.close();
server.close();

const r4 = (v) => Math.round(v * 1e4) / 1e4;
const named = code.map((c) => {
  let n = "ground", best = Infinity;
  for (const [key, l] of Object.entries(landmarks)) {
    const d = Math.hypot(c.x - l.x, c.z - l.z);
    if (d <= l.r + 6 && d < best) { best = d; n = key; }
  }
  return { n, x: r4(c.x), z: r4(c.z), w: r4(c.w), d: r4(c.d), h: r4(c.h), y: r4(c.y), pen: r4(c.pen) };
});

if (errors.length) { console.error("page errors:", errors); process.exit(1); }
if (WRITE) {
  const rows = named.map((c) => "  " + JSON.stringify(c)).join(",\n");
  fs.writeFileSync(OUT, `// Trollface Island's colliders: AABBs, centre x/z, size w d h, base y, bullet
// pen, n = the landmark (doc "Troll Royale map in Roblox Studio"). Written by
// tools/troll-ops-island-colliders.mjs --write from the map's code, and from
// here on by the Studio export; maps/trollface-island.js lays these.
export const ISLAND_SOLIDS = [
${rows},
];
`);
  console.log(`wrote ${named.length} colliders to ${path.relative(ROOT, OUT)}`);
  process.exit(0);
}

// Check: the game's build matches the code to within 1 cm, in order.
let bad = 0;
if (game.length !== code.length) { console.log(`FAIL count: game ${game.length}, code ${code.length}`); bad++; }
for (let i = 0; i < Math.min(game.length, code.length); i++) {
  const a = game[i], b = code[i];
  const off = Math.max(...["x", "z", "w", "d", "h", "y"].map((k) => Math.abs(a[k] - b[k])));
  if (off > 0.01 || a.pen !== b.pen) { if (bad++ < 5) console.log(`FAIL #${i}: game ${JSON.stringify(a)} code ${JSON.stringify(b)}`); }
}
const byName = {};
for (const c of named) byName[c.n] = (byName[c.n] || 0) + 1;
console.log(`${code.length} colliders`, JSON.stringify(byName));
console.log(bad ? `${bad} FAILED` : "PASS the game's colliders match the code's to within 1 cm");
process.exit(bad ? 1 : 0);
