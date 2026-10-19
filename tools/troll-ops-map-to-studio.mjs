// A Troll Forces map, as the game builds it, into Roblox Studio (for now:
// Troll City, the one built by trollcity-kit.js's Kit).
//
// The live map is captured piece by piece (tools/troll-ops-map-capture.mjs:
// every piece knows the builder call that drew it), so Studio gets one
// Model per building and per prop instead of one mesh per material.
//
// What Studio gets (tools/troll-ops-map-to-studio.luau builds it):
//   parts    boxes, round cylinders and balls as real Parts (saved with
//            the place, editable like any Part), each with its piece
//            number P, so tools/troll-ops-map-from-studio.mjs rebuilds it
//            from the game's own geometry wherever it was moved
//   meshes   everything else (tubes, rings, lathes, signs, posters) as
//            EditableMesh MeshParts, merged per model and material; their
//            data is kept in the place, so TC_Lib.restore() rebuilds them
//            after the place is reopened
//   colliders the game's collision boxes, and markers: every RP spot, each
//            inside the model it belongs to (spawns and zombie windows at
//            the top), so they move with it
//   live     what the game draws in code (the train, the board, the jail
//            doors, the lamps): shown locked, for reference
// 1 m = 3 studs. Same axes as three.js (y up, -z north).
//
//   node tools/troll-ops-map-to-studio.mjs [--map trollcity] [--port 5299] [--out .claude/roblox-export/trollcity]
//
// Writes the export to --out, then serves it on 127.0.0.1 until Studio
// fetches /done (or 30 minutes pass).
import fs from "node:fs";
import path from "node:path";
import { ROOT, serve, captureMap } from "./troll-ops-map-capture.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MAP = arg("--map", "trollcity");
const PORT = +arg("--port", 5299);
const OUT = path.resolve(ROOT, arg("--out", `.claude/roblox-export/${MAP}`));
const NO_SERVE = process.argv.includes("--no-serve");

const data = await captureMap({ map: MAP });
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.rmSync(path.join(OUT, f));
const CHUNK = 1500;
data.index.partChunks = Math.ceil(data.parts.length / CHUNK);
for (let i = 0; i < data.index.partChunks; i++) fs.writeFileSync(path.join(OUT, `parts-${i}.json`), JSON.stringify(data.parts.slice(i * CHUNK, (i + 1) * CHUNK)));
data.meshes.forEach((m, i) => fs.writeFileSync(path.join(OUT, `mesh-${i}.json`), JSON.stringify(m)));
data.images.forEach((b, i) => fs.writeFileSync(path.join(OUT, `img-${i}.b64`), b));
fs.writeFileSync(path.join(OUT, "colliders.json"), JSON.stringify(data.colliders));
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(data.index));
const st = data.index.stats, tris = data.index.meshes.reduce((s, m) => s + m.tris, 0);
console.log(`${data.index.name}: ${data.index.parts} parts (${st.box} boxes, ${st.cyl} cylinders, ${st.ball} balls), ` +
  `${data.index.meshes.length} meshes (${tris} tris), ${st.live} live pieces + ${st.other} live objects, ${data.index.images.length} images, ` +
  `${data.index.colliders} colliders, ${data.index.markers.length} markers, ${data.index.lights.length} lights, ${data.index.paths.length} models -> ${path.relative(ROOT, OUT)}`);
if (NO_SERVE) process.exit(0);

// the export, a slice at a time (?from=&len=): Studio's HttpService answers cap out at a few MB
await serve(PORT, (url, res) => {
  const send = (code, body) => { res.writeHead(code, { "content-type": "text/plain" }); res.end(body); };
  if (url.pathname === "/done") { send(200, "bye"); console.log("Studio is done: closing"); setTimeout(() => process.exit(0), 200); return true; }
  if (!url.pathname.startsWith("/x/")) return false;
  const p = path.join(OUT, path.basename(url.pathname));
  if (!fs.existsSync(p)) { send(404, ""); return true; }
  const t = fs.readFileSync(p, "utf8");
  const from = +(url.searchParams.get("from") || 0), len = +(url.searchParams.get("len") || t.length);
  send(200, t.slice(from, from + len));
  return true;
});
console.log(`serving on http://127.0.0.1:${PORT}: run tools/troll-ops-map-to-studio.luau in Studio`);
setTimeout(() => { console.log("30 minutes: closing"); process.exit(0); }, 30 * 60 * 1000);
