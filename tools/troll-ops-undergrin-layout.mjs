// Dumps Undergrin's playable layout, the contract the Blender build draws to
// and never moves (doc "Troll Forces: Undergrin in Blender"), to
// assets/games/troll-ops/models/undergrin-layout.json for
// models/build_undergrin.blender.py: every collider (built exactly as the
// game builds them, maps/undergrin.js through maps.js buildMap), every
// stairs link, the spawns, the sites and the bounds. A hash of
// maps/undergrin.js goes with it: the build records the hash it drew from
// and refuses to export when the file has moved on since.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-undergrin-layout.mjs [--out file]
//
// Re-run after every layout change, then re-run the Blender build.
import { createRequire } from "node:module";
import { ROOT, serve } from "./troll-ops-map-capture.mjs";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const DIR = path.join(ROOT, "assets/games/troll-ops");
const OUT = opt("--out") || path.join(DIR, "models/undergrin-layout.json");
const SOURCE = "maps/undergrin.js";
const srcPath = path.join(DIR, SOURCE);
// before the move (phase 0's baseline) the layout lived in maps.js itself
const hashed = fs.existsSync(srcPath) ? SOURCE : "maps/maps.js";
const HASH = crypto.createHash("sha1").update(fs.readFileSync(path.join(DIR, hashed))).digest("hex").slice(0, 12);

const mapsTag = fs.readFileSync(path.join(DIR, "game.js"), "utf8").match(/"\.\/maps\/maps\.js\?v=([^"]+)"/)[1];
const server = await serve(0, undefined, "none");
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route(/supabase/, (r) => r.abort());
await page.goto(`http://127.0.0.1:${server.address().port}/__export.html`);
const data = await page.evaluate(async (tag) => {
  const { buildMap, MAPS } = await import(`/assets/games/troll-ops/maps/maps.js?v=${tag}`);
  const colliders = [];
  const arena = {};
  const built = buildMap("undergrin", { colliders, arena });
  // the Blender props' colliders (maps/undergrin-props.js, written by the
  // build) come last: the build's own output, so not part of its input
  const { UG_PROPS } = await import("/assets/games/troll-ops/maps/undergrin-props.js");
  const props = UG_PROPS.colliders.length;
  const layout = props ? colliders.slice(0, colliders.length - props) : colliders;
  const r = (v) => Math.round(v * 1000) / 1000;
  const m = MAPS.undergrin;
  return {
    bounds: m.bounds,
    levels: { track: 0, platform: 0.95, concourse: 6.0, slab: 5.6 },
    spawns: m.spawns,
    playerSpawn: m.playerSpawn,
    bombSites: m.bombSites,
    // [x0, y0, z0, x1, y1, z1, pen]: the game's own boxes, in build order
    props,
    colliders: layout.map((c) => [r(c.min.x), r(c.min.y), r(c.min.z), r(c.max.x), r(c.max.y), r(c.max.z), c.pen]),
    // every flight's foot and top (api.stairs, plus the flights findStairs
    // found): what the bots plan on
    stairs: built.stairs.map((s) => ({ a: [r(s.a.x), r(s.a.y), r(s.a.z)], b: [r(s.b.x), r(s.b.y), r(s.b.z)], found: !!s.found })),
  };
}, mapsTag);
await browser.close(); server.close();
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
const out = { hash: HASH, source: hashed, ...data };
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(`wrote ${path.relative(ROOT, OUT)}: ${data.colliders.length} colliders (+${data.props} props'), ${data.stairs.length} stairs links, ${data.spawns.length} spawns, hash ${HASH} (${hashed})`);
