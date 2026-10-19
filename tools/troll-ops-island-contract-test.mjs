// Trollface Island's contracts (doc "Troll Royale map in Roblox Studio",
// "Contracts that must keep working"): what Troll Royale's code reads off the
// map, checked after every Studio export so new art can't break the mode.
//
//   node tools/troll-ops-island-contract-test.mjs              check
//   node tools/troll-ops-island-contract-test.mjs --baseline   freeze today's
//        coast, lake, bounds, POIs and Royale rules into
//        assets/games/troll-ops/studio/trollface-island/contract.json (once,
//        before the first Studio edit)
//
// Loads Troll Royale headless (Supabase blocked, never a public room) and
// checks: coast, lake and bounds unchanged; the 14 POIs (position, radius,
// tier) and the Royale rules unchanged; every collider in the data file is
// in the game and each landmark's sits by its ring; every spawn on open dry
// land; every POI reachable from every other on the bots' 2 m grid; the
// island's files at 8 MB or less. Frame rate is checked by hand at phone
// size (a headless GPU says nothing about a phone).

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = path.join(ROOT, "assets/games/troll-ops/studio/trollface-island/contract.json");
const BASELINE = process.argv.includes("--baseline");
const BUDGET = 8 * 1024 * 1024;
// The game's own movement.js instance (it reads the live ground field).
const MOVEMENT_TAG = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/game.js"), "utf8").match(/core\/movement\.js\?v=([^"']+)/)[1];
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
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 120000 });
await page.evaluate(async () => { const T = window.__trollOps; T.DROP.enabled = false; T.setMode("royale"); await T.startGame(); });
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.isStaging(), null, { timeout: 120000 });

const got = await page.evaluate(async (MOVEMENT_TAG) => {
  const T = window.__trollOps;
  const { game } = await import("/assets/games/troll-ops/core/state.js?v=st1");
  const m = await import("/assets/games/troll-ops/maps/trollface-island.js?v=ti3");
  const { ISLAND_SOLIDS } = await import("/assets/games/troll-ops/maps/trollface-island-colliders.js?v=is1");
  const { insidePolygon } = await import("/assets/games/troll-ops/maps/edge.js?v=or1");
  const { FlowField } = await import("/assets/games/troll-ops/bots/nav.js");
  const { groundHeightAt } = await import(`/assets/games/troll-ops/core/movement.js?v=${MOVEMENT_TAG}`);
  const I = m.TROLLFACE_ISLAND;
  const cols = game.colliders;
  // Each data-file collider present in the game (same AABB to 1 cm).
  const key = (x0, y0, z0, x1, y1, z1) => [x0, y0, z0, x1, y1, z1].map((v) => Math.round(v * 100)).join(",");
  const inGame = new Set(cols.map((c) => key(c.min.x, c.min.y, c.min.z, c.max.x, c.max.y, c.max.z)));
  const missing = ISLAND_SOLIDS.filter((c) => !inGame.has(key(c.x - c.w / 2, c.y, c.z - c.d / 2, c.x + c.w / 2, c.y + c.h, c.z + c.d / 2))).length;
  // A landmark's colliders sit by its ring (centre within r + 6 m).
  const strays = ISLAND_SOLIDS.filter((c) => c.n !== "ground" && m.LANDMARKS[c.n] && Math.hypot(c.x - m.LANDMARKS[c.n].x, c.z - m.LANDMARKS[c.n].z) > m.LANDMARKS[c.n].r + 6)
    .map((c) => c.n);
  // Spawns on open dry land: in the coast, out of the lake, not in a
  // collider a troll can't step over.
  const blocked = (x, z) => cols.some((c) => x > c.min.x && x < c.max.x && z > c.min.z && z < c.max.z && c.max.y > 0.36 && c.min.y < 2);
  const badSpawns = I.spawns.filter(([x, z]) => !insidePolygon(I.edge, x, z) || insidePolygon(I.wade, x, z) || blocked(x, z)).length;
  // Every POI reachable from every other on the bots' grid (navCell 2 m).
  const field = new FlowField(cols, I.bounds, 0, { cell: I.navCell || 2 });
  const pois = Object.entries(m.LANDMARKS);
  // The ground (phase 3): its slope, and flat wherever gameplay stands.
  const F = I.groundField, Hh = F ? F.heights : new Float32Array(0);
  let steep = 0;
  if (F) for (let j = 0; j < F.h; j++) for (let i = 0; i < F.w; i++) {
    const k = j * F.w + i;
    if (i < F.w - 1) steep = Math.max(steep, Math.abs(Hh[k + 1] - Hh[k]));
    if (j < F.h - 1) steep = Math.max(steep, Math.abs(Hh[k + F.w] - Hh[k]));
  }
  const gy = (x, z) => groundHeightAt([], x, z, 1e3);   // the ground alone, no colliders
  const hiIn = (pts) => pts.reduce((m, [x, z]) => Math.max(m, gy(x, z)), 0);
  const ringPts = (l, f) => { const out = []; for (let a = 0; a < 6.28; a += 0.3) for (const k of [0, 0.5, 1]) out.push([l.x + Math.cos(a) * l.r * f * k, l.z + Math.sin(a) * l.r * f * k]); return out; };
  const ground = {
    field: !!F, steep, top: Hh.reduce((m, v) => Math.max(m, v), 0),
    poi: Math.max(...pois.map(([, l]) => hiIn(ringPts(l, 0.8)))),
    under: Math.max(...ISLAND_SOLIDS.map((c) => hiIn([[c.x, c.z], [c.x - c.w / 2, c.z - c.d / 2], [c.x + c.w / 2, c.z - c.d / 2], [c.x - c.w / 2, c.z + c.d / 2], [c.x + c.w / 2, c.z + c.d / 2]]))),
    coastLake: Math.max(hiIn(I.edge), hiIn(I.wade)),
    spawns: hiIn(I.spawns),
  };
  const cut = [];
  // A POI counts as reached when any open cell inside its ring is: its
  // centre is often in a building or up on a deck.
  const ringCells = (l) => {
    const out = [];
    for (let iz = 0; iz < field.h; iz++) for (let ix = 0; ix < field.w; ix++) {
      const x = field.minX + (ix + 0.5) * field.cell, z = field.minZ + (iz + 0.5) * field.cell;
      if (Math.hypot(x - l.x, z - l.z) <= l.r && insidePolygon(I.edge, x, z)) { const i = iz * field.w + ix; if (!field.blocked[i]) out.push([i, x, z]); }
    }
    return out;
  };
  const rings = pois.map(([k, l]) => [k, ringCells(l)]);
  const [, from] = rings.find(([k]) => k === "city");
  field.compute(from[0][1], from[0][2]);
  for (const [k, cells] of rings) if (!cells.some(([i]) => field.dist[i])) cut.push(k);
  return {
    map: T.loadedMapId(),
    contract: {
      edge: I.edge, lake: I.wade, bounds: I.bounds,
      pois: Object.fromEntries(pois.map(([k, l]) => [k, { x: l.x, z: l.z, r: l.r, tier: l.tier }])),
      royale: { players: I.royale.players, lootPerSqM: I.royale.lootPerSqM, lootExtra: I.royale.lootExtra, phases: I.royale.phases },
    },
    solids: ISLAND_SOLIDS.length, missing, strays, spawns: I.spawns.length, badSpawns, cut, ground,
  };
}, MOVEMENT_TAG);
await browser.close();
server.close();

check("Troll Royale plays on Trollface Island", got.map === "trollface", got.map);
if (BASELINE) {
  fs.mkdirSync(path.dirname(BASE), { recursive: true });
  fs.writeFileSync(BASE, JSON.stringify(got.contract, null, 1) + "\n");
  console.log(`froze the contract into ${path.relative(ROOT, BASE)}`);
}
const base = JSON.parse(fs.readFileSync(BASE, "utf8"));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
check("the coastline is unchanged", same(got.contract.edge, base.edge), `${got.contract.edge.length} points`);
check("the lake is unchanged", same(got.contract.lake, base.lake), `${got.contract.lake.length} points`);
check("the play bounds are unchanged", same(got.contract.bounds, base.bounds), JSON.stringify(got.contract.bounds));
check("the 14 POIs keep their place, radius and tier", same(got.contract.pois, base.pois), `${Object.keys(got.contract.pois).length} POIs`);
check("Royale's loot, players and zone phases are unchanged", same(got.contract.royale, base.royale));
check("every collider in the data file is in the game", got.missing === 0, `${got.missing} of ${got.solids} missing`);
check("each landmark's colliders sit by its ring", got.strays.length === 0, got.strays.slice(0, 5).join(", "));
check("every spawn is on open dry land", got.badSpawns === 0, `${got.badSpawns} of ${got.spawns} blocked or wet`);
check("every POI is reachable from every other (bots' grid)", got.cut.length === 0, got.cut.join(", "));
const g = got.ground;
check("the island has its Studio ground", g.field, `top ${g.top.toFixed(2)} m`);
check("no slope over 1.5 m per 2 m (bots and the nav grid)", g.steep <= 1.5, `steepest ${g.steep.toFixed(2)} m`);
check("POI floors are flat", g.poi < 0.05, `highest ${g.poi.toFixed(3)} m inside 0.8 of a ring`);
check("every collider stands on flat ground", g.under < 0.05, `highest ${g.under.toFixed(3)} m under one`);
// (the lake's water is at 0.34 m: its shore just has to stay under it)
check("the coast and the lake's shore stay low (under 0.25 m)", g.coastLake < 0.25, `${g.coastLake.toFixed(3)} m`);
check("every spawn is on flat ground", g.spawns < 0.05, `${g.spawns.toFixed(3)} m`);

// Download: the island's landmark models (tf-*.glb, not the sky lobby's bus
// and skybox) and its data files.
const MODELS = path.join(ROOT, "assets/games/troll-ops/models");
const files = fs.readdirSync(MODELS).filter((f) => /^tf-.*\.(glb|webp|png)$/.test(f) && !/^tf-(bus|busface|skybox)\./.test(f)).map((f) => path.join(MODELS, f));
files.push(path.join(ROOT, "assets/games/troll-ops/maps/trollface-island-colliders.js"), path.join(ROOT, "assets/games/troll-ops/maps/trollface-island-ground.js"));
const bytes = files.reduce((s, f) => s + fs.statSync(f).size, 0);
check("the island's files are 8 MB or less", bytes <= BUDGET, `${(bytes / 1048576).toFixed(2)} MB in ${files.length} files`);
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
