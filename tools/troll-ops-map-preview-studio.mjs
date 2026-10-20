// What the game draws in code (the chapel, the town hall, the east shops:
// built after the Studio town, so Studio never sees them) into Roblox
// Studio as a locked preview, to watch and to place things against.
//
// Captures the map as the game builds it (tools/troll-ops-map-capture.mjs),
// keeps the live pieces inside --box, and serves them; then in Studio run
// tools/troll-ops-map-preview-studio.luau (it GETs /preview.json). Studio
// builds them into workspace.TC_Preview.<name>: Parts and MeshParts, every
// one locked, outside TrollCity_Live, so the export never sees them. A new
// preview of the same name replaces the old.
//
//   node tools/troll-ops-map-preview-studio.mjs --box x0,z0,x1,z1 --name East [--map trollcity] [--port 5298]

import { serve, captureMap } from "./troll-ops-map-capture.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MAP = arg("--map", "trollcity");
const PORT = +arg("--port", 5298);
const NAME = arg("--name", "Preview");
const [x0, z0, x1, z1] = arg("--box", "").split(",").map(Number);
if (![x0, z0, x1, z1].every(Number.isFinite)) { console.error("usage: --box x0,z0,x1,z1 --name Name"); process.exit(2); }
const inBox = (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1;

const data = await captureMap({ map: MAP });
const { mats } = data.index;
const parts = data.parts.filter((p) => p.live && p.path !== "Ground" && inBox(p.p[0], p.p[2]));
const meshes = data.meshes.filter((m) => {
  if (!m.live || !m.v.length) return false;
  let sx = 0, sz = 0;
  const n = m.v.length / 3;
  for (let i = 0; i < n; i++) { sx += m.v[i * 3]; sz += m.v[i * 3 + 2]; }
  return inBox(sx / n, sz / n);
});
const imgs = [...new Set(meshes.map((m) => mats[m.mat].img).filter((i) => i >= 0))];
const out = JSON.stringify({ name: NAME, mats, parts, meshes: meshes.map(({ v, n, uv, tri, mat }) => ({ v, n, uv, tri, mat })),
  images: imgs.map((i) => ({ i, ...data.index.images[i] })) });
console.log(`${NAME}: ${parts.length} parts, ${meshes.length} meshes, ${imgs.length} images in [${x0}, ${z0}] .. [${x1}, ${z1}] (${(out.length / 1e6).toFixed(1)} MB): serving on ${PORT}`);

await serve(PORT, (url, res) => {
  const send = (code, body) => { res.writeHead(code, { "content-type": "text/plain" }); res.end(body); };
  const slice = (s) => {
    const from = +(url.searchParams.get("from") || 0), len = +(url.searchParams.get("len") || s.length);
    return s.slice(from, from + len);
  };
  if (url.pathname === "/preview.json") { send(200, slice(out)); return true; }
  const m = url.pathname.match(/^\/img-(\d+)$/);
  if (m) { const b = data.images[+m[1]]; if (b == null) send(404, ""); else send(200, slice(b)); return true; }
  if (url.pathname === "/done") { send(200, "bye"); console.log("Studio is done"); setTimeout(() => process.exit(0), 200); return true; }
  return false;
});
setTimeout(() => process.exit(0), 20 * 60 * 1000);
