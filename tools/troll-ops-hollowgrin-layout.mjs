// Dumps Hollowgrin's playable layout, the contract the Blender build draws
// to and never moves (doc "Troll Forces: Hollowgrin in Blender"), to
// assets/games/troll-ops/models/hollowgrin-layout.json: the bounds, every
// collider (min, max, pen), the team spawns, the wade polygon, the floors
// and the zombie layout (stair links, entry points, nav settings). The JS
// (maps/hollowgrin*.js) stays the source of all of it; the hash is of the
// data itself, so a JS edit that moves nothing playable keeps it.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-hollowgrin-layout.mjs [--check]
//
// --check rebuilds the layout and fails (exit 1) when it differs from the
// committed file, naming the first colliders that moved; when it matches it
// only refreshes the file's source hash (the JS changed, the layout didn't).
// Every Hollowgrin phase runs it; only a layout change the user approved in
// the doc re-runs it without --check.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "assets/games/troll-ops/models/hollowgrin-layout.json");
const CHECK = process.argv.includes("--check");
// the JS the layout comes from: the Blender build refuses to draw when these
// changed since the layout file was written (re-run this tool first)
const SOURCES = ["maps/hollowgrin.js", "maps/hollowgrin-chapel.js", "maps/hollowgrin-mannequins.js"];
const srcHash = crypto.createHash("sha1");
// line endings dropped: a CRLF checkout and an LF one hash the same
for (const f of SOURCES) srcHash.update(fs.readFileSync(path.join(ROOT, "assets/games/troll-ops", f), "utf8").replace(/\r\n/g, "\n"));
const SOURCE_HASH = srcHash.digest("hex").slice(0, 12);

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch();
const page = await browser.newPage();
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
const data = await page.evaluate(async () => {
  const M = await import("/assets/games/troll-ops/maps/maps.js");
  const colliders = [], arena = {};
  const built = M.buildMap("hollowgrin", { colliders, arena });
  const map = built.map;
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const pt = (p) => (Array.isArray(p) ? p.map(r3) : { x: r3(p.x), z: r3(p.z) });
  const z = map.zombieLayout();
  return {
    bounds: { minX: arena.minX, maxX: arena.maxX, minZ: arena.minZ, maxZ: arena.maxZ },
    playerSpawn: pt(map.playerSpawn),
    spawns: map.spawns.map(pt),
    wade: map.wade.map((p) => (Array.isArray(p) ? p.map(r3) : pt(p))),
    floors: z.floors,
    zombie: {
      links: z.links,
      windows: z.windows.map((w) => Object.fromEntries(Object.entries(w).map(([k, v]) => [k, typeof v === "number" ? r3(v) : v]))),
      navCell: z.navCell, navPad: z.navPad, navStep: z.navStep, preferDist: z.preferDist,
    },
    colliders: colliders.map((c) => [r3(c.min.x), r3(c.min.y), r3(c.min.z), r3(c.max.x), r3(c.max.y), r3(c.max.z), c.pen ?? null]),
  };
});
await browser.close();
server.close();
if (errors.length) { console.log("page errors:\n  " + errors.join("\n  ")); process.exit(1); }

const body = JSON.stringify(data);
const hash = crypto.createHash("sha1").update(body).digest("hex").slice(0, 12);
const out = { map: "hollowgrin", hash, sources: SOURCES, sourceHash: SOURCE_HASH, ...data };
// any array of plain numbers on one line (a collider, a point): readable
// diffs when a phase changes one
const text = JSON.stringify(out, null, 1).replace(/\[[\s\d.,null-]+\]/g, (m) => m.replace(/\s+/g, " ").replace("[ ", "[").replace(" ]", "]")) + "\n";

if (!CHECK) {
  fs.writeFileSync(OUT, text);
  console.log(`wrote ${path.relative(ROOT, OUT)}: hash ${hash}, ${data.colliders.length} colliders, ${data.spawns.length} spawns, ${data.zombie.windows.length} zombie entries, ${data.zombie.links.length} links`);
  process.exit(0);
}
const old = JSON.parse(fs.readFileSync(OUT, "utf8"));
if (old.hash === hash) {
  // same layout: keep the file's source hash current, so the build can tell
  // a JS edit that moved nothing from one never checked
  if (old.sourceHash !== SOURCE_HASH) fs.writeFileSync(OUT, text);
  console.log(`PASS  hollowgrin layout unchanged (hash ${hash}, ${data.colliders.length} colliders${old.sourceHash !== SOURCE_HASH ? ", source hash refreshed" : ""})`);
  process.exit(0);
}
console.log(`FAIL  hollowgrin layout changed: ${old.hash} -> ${hash}`);
for (const k of ["bounds", "playerSpawn", "spawns", "wade", "floors", "zombie"]) if (JSON.stringify(old[k]) !== JSON.stringify(data[k])) console.log(`  ${k} differs`);
const key = (c) => c.join(",");
const was = new Set(old.colliders.map(key)), now = new Set(data.colliders.map(key));
const gone = old.colliders.filter((c) => !now.has(key(c))), added = data.colliders.filter((c) => !was.has(key(c)));
console.log(`  colliders: ${old.colliders.length} -> ${data.colliders.length}, ${gone.length} gone, ${added.length} new`);
for (const c of gone.slice(0, 8)) console.log("  - " + key(c));
for (const c of added.slice(0, 8)) console.log("  + " + key(c));
process.exit(1);
