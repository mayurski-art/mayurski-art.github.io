// Troll City back from Roblox Studio (doc "Troll City redesign in Roblox
// Studio"). Listens for tools/troll-ops-map-from-studio.luau, run in the
// Studio place over the MCP, then rebuilds the town from what it sends:
//
//   every Part with a piece number P, and every MeshPart with a mesh number,
//   is that piece of the code-built town (captured fresh by
//   tools/troll-ops-map-capture.mjs) moved, turned and scaled the way
//   Studio has it now: the game's own geometry, so an untouched town comes
//   back exactly as it was. A piece missing in Studio was deleted.
//   Colliders come back as the game's AABBs; markers as where they stand.
//   Each model's move (what most of its pieces did) goes in the layout, so
//   what the code still draws in it (the badge, the cell doors, the lamps)
//   and its RP spots go with it; a marker moved there has the last word.
//
//   node tools/troll-ops-map-from-studio.mjs            check: print what
//        Studio changed (no edits)
//   node tools/troll-ops-map-from-studio.mjs --write    write
//        models/tc-town.glb and maps/trollcity-layout.js, then bump
//        trollcity-layout.js's ?v= tag yourself
//   [--port 5297] [--map trollcity]
//
// A Part made in Studio is drawn with the town's own surfaces (its Roblox
// material picks the family, its colour the nearest of the town's materials
// in it), and is a collider too if it's CanCollide. A MeshPart made in
// Studio (generate_mesh) comes back as itself: its mesh, and its texture
// (at most 512 px, JPEG, in the GLB as the material "gen:<hash>"), a
// collider too if it's CanCollide.
//
// --map kabukigrin (doc "Kabukigrin"): a map laid out in Studio from other
// maps' pieces. Its `sources` are captured, and each part is rebuilt from
// the capture its Map attribute names (a Trolling Loud booth dragged into
// Kabukigrin_Live comes back as that booth); pieces of a `library` source
// left in the library aren't "deleted", just unused. Its layout file holds
// every collider, every marker by name and every light, and no `moves`:
// nothing of the code's moves with a model there, the statics are all
// Studio's. A GLB-built source's chunks keep their light-map UVs and paint
// (TEXCOORD_1, COLOR_0) under the material "glb:<model>:<material>".

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { ROOT, captureMap } from "./troll-ops-map-capture.mjs";

const THREE = await import(pathToFileURL(path.join(ROOT, "assets/vendor/three.module.min.js")).href);
const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const pi = args.indexOf("--port");
const PORT = pi >= 0 ? +args[pi + 1] : 5297;
const mi = args.indexOf("--map");
const MAP = mi >= 0 ? args[mi + 1] : "trollcity";
const OUTS = {
  trollcity: { sources: ["trollcity"], library: [], glb: "tc-town", layout: "maps/trollcity-layout.js", name: "TC_LAYOUT", moves: true },
  kabukigrin: { sources: ["grinjuku", "trollingloud"], library: ["trollingloud"], glb: "kb-town", layout: "maps/kabukigrin-layout.js", name: "KB_LAYOUT", moves: false, newMats: "glb" },
};
const OUTCFG = OUTS[MAP];
if (!OUTCFG) { console.error(`no such map: ${MAP} (${Object.keys(OUTS).join(", ")})`); process.exit(1); }
const K = 3;   // studs per metre
const GLB = path.join(ROOT, `assets/games/troll-ops/models/${OUTCFG.glb}.glb`);
const LAYOUT = path.join(ROOT, "assets/games/troll-ops/" + OUTCFG.layout);
const r4 = (v) => Math.round(v * 1e4) / 1e4;

/* ------------------------------------------------------------ receive */
// --save f.json keeps what Studio sent; --replay f.json runs on it with no Studio
const argOf = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const SAVE = argOf("--save"), REPLAY = argOf("--replay");
const got = { parts: [], colliders: null, markers: null, lights: [], genMesh: new Map(), genTex: new Map() };
if (REPLAY) {
  const j = JSON.parse(fs.readFileSync(REPLAY, "utf8"));
  Object.assign(got, j, { genMesh: new Map(j.genMesh), genTex: new Map(j.genTex) });
} else await new Promise((done) => {
  const server = http.createServer((req, res) => {
    if (req.method !== "POST") { res.writeHead(404); return res.end(); }
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      const what = req.url.slice(1);
      const v = JSON.parse(body);
      if (what === "parts") got.parts.push(...v);
      else if (what === "colliders") got.colliders = v;
      else if (what === "markers") got.markers = v;
      else if (what === "lights") got.lights = v;
      else if (what === "gen-mesh") got.genMesh.set(v.id, v);
      else if (what === "gen-tex") {
        const t = got.genTex.get(v.id) || { w: v.w, h: v.h, parts: [] };
        t.parts[v.i - 1] = v.b64;
        got.genTex.set(v.id, t);
      }
      res.writeHead(200, { "content-type": "text/plain" });
      res.end(what === "end" ? "rebuilding the town (see the terminal)" : "ok");
      if (what === "end") { server.close(); done(); }
    });
  });
  server.listen(PORT, "127.0.0.1", () => console.log(`waiting for Studio on http://127.0.0.1:${PORT}`));
});
if (SAVE) fs.writeFileSync(SAVE, JSON.stringify({ ...got, genMesh: [...got.genMesh], genTex: [...got.genTex] }));
console.log(`from Studio: ${got.parts.length} parts, ${got.colliders.length} colliders, ${got.markers.length} markers, ${got.lights.length} lights`);

/* ------------------------------------------------------------ rebuild */
// every source map, captured fresh; a record names its map (an older place
// made for one map has no Map attributes: the first source)
const caps = {};
for (const m of OUTCFG.sources) { console.log(`capturing ${m}...`); caps[m] = await captureMap({ map: m, geometry: true }); }
const capOf = (s) => caps[s.map] || caps[OUTCFG.sources[0]];
const cap = caps[OUTCFG.sources[0]];
const { pieces, meshes, index } = cap;
// the materials of every source, for new Parts
const allMats = OUTCFG.sources.flatMap((m) => caps[m].index.mats);

// Studio's CFrame (studs: x y z, then the rotation's rows) and size, as a
// matrix taking a unit-sized local frame to world metres.
const studio = (cf, s) => {
  const m = new THREE.Matrix4().set(
    cf[3], cf[4], cf[5], cf[0] / K,
    cf[6], cf[7], cf[8], cf[1] / K,
    cf[9], cf[10], cf[11], cf[2] / K,
    0, 0, 0, 1);
  return m.multiply(new THREE.Matrix4().makeScale(s[0] / K, s[1] / K, s[2] / K));
};
// the same for a piece as the capture placed it (prim: centre, axes, size, metres)
const original = (prim) => {
  const f = prim.f;
  return new THREE.Matrix4().set(
    f[0], f[3], f[6], prim.p[0],
    f[1], f[4], f[7], prim.p[1],
    f[2], f[5], f[8], prim.p[2],
    0, 0, 0, 1).multiply(new THREE.Matrix4().makeScale(...prim.s.map((v) => v || 1e-6)));
};
const meshMid = (C, g) => {
  const v = C.meshes[g].v;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < v.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[i + k] * K); hi[k] = Math.max(hi[k], v[i + k] * K); }
  return { mid: lo.map((l, k) => (l + hi[k]) / 2 / K), size: lo.map((l, k) => hi[k] - l) };
};

const out = new Map();   // "key|tint|shadow" -> { flat: [], smooth: [] } of placed geometries
const put = (piece, m) => {
  // (a new Part on a GLB-built map: "|n", its own colour on its GLB material)
  const name = `${piece.key}|${piece.tint}|${piece.shadow ? 1 : 0}${piece.fresh ? "|n" : ""}`;
  // (a picture and a GLB chunk keep their UVs; a GLB chunk its paint and light-map UVs too)
  if (!out.has(name)) out.set(name, { flat: [], smooth: [], pictured: piece.pictured, uv: !!(piece.pictured || piece.glb || piece.fresh), extra: !!piece.glb });
  out.get(name)[piece.geo.n ? "smooth" : "flat"].push({ geo: piece.geo, m });
};
// Untouched in Studio: within a millimetre and a milliradian of where it
// was put (Studio keeps 32-bit numbers, the capture 4 decimals), so the
// piece keeps the game's own geometry exactly.
const still = (cf, s, pos, axes, size) =>
  Math.hypot(cf[0] / K - pos[0], cf[1] / K - pos[1], cf[2] / K - pos[2]) < 1e-3 &&
  // cf's rows hold the rotation; axes are its columns (right, up, back)
  [0, 1, 2].every((c) => [0, 1, 2].every((r) => Math.abs(cf[3 + r * 3 + c] - axes[c * 3 + r]) < 1e-3)) &&
  [0, 1, 2].every((k) => Math.abs(s[k] / K - size[k]) < 1e-3);
let moved = 0, kept = 0, fresh = 0;
const made = [];   // Parts made in Studio
const gens = [];   // MeshParts made in Studio (generate_mesh)
const seen = new Set();         // "<map>:<piece>"
const delta = new Map();        // piece -> its move (null: where it was); the first source's
const mapName = (s) => (caps[s.map] ? s.map : OUTCFG.sources[0]);
for (const s of got.parts) {
  if (s.new) { fresh++; made.push(s); continue; }
  if (s.gen) { gens.push(s); continue; }
  const C = capOf(s), mn = mapName(s);
  if (s.p != null) {
    const piece = C.pieces[s.p];
    if (!piece || !piece.prim || piece.live) continue;
    if (still(s.cf, s.s, piece.prim.p, piece.prim.f, piece.prim.s)) { put(piece, null); kept++; if (C === cap) delta.set(piece.i, null); }
    else { const m = studio(s.cf, s.s).multiply(original(piece.prim).invert()); put(piece, m); moved++; if (C === cap) delta.set(piece.i, m); }
    seen.add(`${mn}:${s.p}`);
  } else if (s.g != null) {
    const { mid, size } = meshMid(C, s.g);
    // a MeshPart is its mesh centred on its box, at Size0 for scale 1
    const m = new THREE.Matrix4().set(
      s.cf[3], s.cf[4], s.cf[5], s.cf[0] / K,
      s.cf[6], s.cf[7], s.cf[8], s.cf[1] / K,
      s.cf[9], s.cf[10], s.cf[11], s.cf[2] / K,
      0, 0, 0, 1)
      .multiply(new THREE.Matrix4().makeScale(s.s[0] / s.s0[0], s.s[1] / s.s0[1], s.s[2] / s.s0[2]))
      .multiply(new THREE.Matrix4().makeTranslation(-mid[0], -mid[1], -mid[2]));
    const same = still(s.cf, s.s.map((v, k) => v / s.s0[k] * size[k]), mid, [1, 0, 0, 0, 1, 0, 0, 0, 1], size.map((v) => v / K));
    for (const piece of C.pieces) {
      if (piece.g !== s.g || piece.live) continue;
      put(piece, same ? null : m);
      if (C === cap) delta.set(piece.i, same ? null : m);
      seen.add(`${mn}:${piece.i}`);
      same ? kept++ : moved++;
    }
  }
}
let deleted = 0, unused = 0;
for (const m of OUTCFG.sources) {
  const n = caps[m].pieces.filter((p) => !p.live && !seen.has(`${m}:${p.i}`)).length;
  if (OUTCFG.library.includes(m)) unused += n; else deleted += n;
}
console.log(`pieces: ${kept} as they were, ${moved} moved, ${deleted} deleted, ${fresh} new Parts${unused ? `, ${unused} library pieces unused` : ""}`);

/* ------------------------------------------------------------ colliders */
const newCols = [];   // solid Parts made in Studio (below)
const before = OUTCFG.sources.filter((m) => !OUTCFG.library.includes(m)).flatMap((m) => caps[m].colliders.filter((c) => !c.live));
// in the game's own order, new ones after, so a diff of the file reads
got.colliders.sort((a, b) => (a.c ?? Infinity) - (b.c ?? Infinity));
const colWas = (c) => {
  const o = c.c != null ? capOf(c).colliders.find((k) => k.i === c.c) : null;
  return o ? { o, was: [(o.min[0] + o.max[0]) / 2, (o.min[2] + o.max[2]) / 2, o.max[0] - o.min[0], o.max[2] - o.min[2], o.max[1] - o.min[1], o.min[1]] } : null;
};
const cols = got.colliders.map((c) => {
  const w = colWas(c);
  // left where it was (Studio keeps 32-bit numbers): the game's own numbers
  if (w && [c.x, c.z, c.w, c.d, c.h, c.y].every((v, k) => Math.abs(v - w.was[k]) < 1e-3)) return [...w.was, w.o.pen].map(r4);
  return [c.x, c.z, c.w, c.d, c.h, c.y, c.pen].map(r4);
});
{
  let changed = 0;
  for (const c of got.colliders) {
    const w = colWas(c);
    if (!w) { changed++; continue; }
    const now = [c.x, c.z, c.w, c.d, c.h, c.y];
    if (Math.max(...now.map((v, k) => Math.abs(v - w.was[k]))) > 0.01) changed++;
  }
  console.log(`colliders: ${got.colliders.length} from Studio (the game had ${before.length} still ones): ${changed} changed or new, ${Math.max(0, before.length - got.colliders.length)} fewer`);
}

/* ------------------------------------------------------------ new Parts */
{
  // Roblox material -> the families of the town's materials (capture's rbxOf)
  const FAMILY = {
    WoodPlanks: ["WoodPlanks"], Wood: ["WoodPlanks"], Brick: ["Brick"], Slate: ["Slate"], Rock: ["Slate"], Cobblestone: ["Slate"],
    Granite: ["Slate"], Pebble: ["Slate"], Basalt: ["Slate"], Sandstone: ["Slate"], Limestone: ["Slate", "Plaster"],
    Concrete: ["Plaster", "Slate"], Plaster: ["Plaster"], Marble: ["Plaster", "Slate"], CorrugatedSteel: ["CorrugatedSteel"],
    DiamondPlate: ["Metal"], Metal: ["Metal"], Foil: ["Foil"], RoofShingles: ["RoofShingles"], Sand: ["Sand"], Ground: ["Sand"],
    Mud: ["Sand"], Grass: ["Grass"], LeafyGrass: ["Grass"], Fabric: ["Fabric"], Carpet: ["Fabric"], Glass: ["Glass"], Neon: ["Neon"],
    SmoothPlastic: ["SmoothPlastic"], Plastic: ["SmoothPlastic"],
  };
  // (a GLB-built map's new Parts take its GLB materials: the textures and
  // glow the game already draws it with)
  const pool = allMats.filter((m) => m.key && !m.pictured && !m.cutout && (m.alpha === 1 || m.rbx === "Glass") &&
    (OUTCFG.newMats !== "glb" || m.key.startsWith("glb:")));
  const pick = (rbx, c) => {
    for (const fam of [FAMILY[rbx], null]) {
      const list = pool.filter((m) => (fam ? fam.includes(m.rbx) : m.rbx !== "Neon" && m.rbx !== "Glass"));
      let best = null, d0 = Infinity;
      for (const m of list) {
        const d = 0.3 * (m.color[0] - c[0]) ** 2 + 0.59 * (m.color[1] - c[1]) ** 2 + 0.11 * (m.color[2] - c[2]) ** 2;
        if (d < d0) { d0 = d; best = m; }
      }
      if (best) return best;
    }
    return null;
  };
  // a unit shape, centred, Roblox's axes (a cylinder lies along x, a wedge
  // rises to the back, +z); round ones get fewer sides the smaller they are
  // (d: the round part's width in metres)
  const unit = (shape, d) => {
    const n = d < 0.4 ? 8 : d < 1.5 ? 12 : 20;
    if (/^(Block|Part|TrussPart|Seat|SpawnLocation)$/.test(shape)) return { g: new THREE.BoxGeometry(1, 1, 1), smooth: false };
    if (shape === "Cylinder") return { g: new THREE.CylinderGeometry(0.5, 0.5, 1, n).rotateZ(-Math.PI / 2), smooth: true };
    if (shape === "Ball") return { g: new THREE.SphereGeometry(0.5, n, Math.max(6, Math.round(n * 0.7))), smooth: true };
    if (shape === "Wedge" || shape === "WedgePart") {
      const P = [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5]];
      const T = [[0, 1, 2], [1, 3, 2], [2, 3, 4], [3, 5, 4], [0, 4, 1], [1, 4, 5], [0, 2, 4], [1, 5, 3]];   // facing out
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(T.flat().flatMap((i) => P[i]), 3));
      return { g, smooth: false };
    }
    return null;
  };
  let drawn = 0, solid = 0;
  const skipped = new Map();
  for (const s of made) {
    const m = studio(s.cf, s.s);
    if (s.solid && !(s.path || "").includes("Colliders")) {
      // its box, axis-aligned, in metres
      const box = new THREE.Box3();
      for (let i = 0; i < 8; i++) box.expandByPoint(new THREE.Vector3(i & 1 ? 0.5 : -0.5, i & 2 ? 0.5 : -0.5, i & 4 ? 0.5 : -0.5).applyMatrix4(m));
      const c = box.getCenter(new THREE.Vector3()), z = box.getSize(new THREE.Vector3());
      newCols.push([c.x, c.z, z.x, z.z, z.y, box.min.y, s.pen ?? 8].map(r4));
      solid++;
    }
    if (s.alpha <= 0.02) continue;
    const u = unit(s.new, Math.max(s.s[1], s.s[2]) / K);
    const mat = u && pick(s.mat, s.color);
    if (!u || !mat) { skipped.set(s.new, (skipped.get(s.new) || 0) + 1); continue; }
    const g = u.g.index ? u.g.toNonIndexed() : u.g;
    if (OUTCFG.newMats === "glb") {
      // in world metres, with metre UVs (a GLB material's texture repeats
      // per metre) projected off each face's main axis, in its own colour
      g.applyMatrix4(m);
      if (!u.smooth) g.computeVertexNormals();
      const P = g.attributes.position.array, N = g.attributes.normal.array, uv = [];
      for (let t = 0; t < P.length; t += 9) {
        const nx = Math.abs(N[t]), ny = Math.abs(N[t + 1]), nz = Math.abs(N[t + 2]);
        for (let v = t; v < t + 9; v += 3) {
          if (ny >= nx && ny >= nz) uv.push(P[v], P[v + 2]);
          else if (nx >= nz) uv.push(P[v + 2], P[v + 1]);
          else uv.push(P[v], P[v + 1]);
        }
      }
      const hex = s.color.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, "0")).join("");
      put({ key: mat.key, tint: hex, shadow: true, pictured: false, fresh: true, geo: { p: Array.from(P), n: Array.from(N), uv } }, null);
      drawn++;
      continue;
    }
    const geo = { p: Array.from(g.attributes.position.array) };
    if (u.smooth) geo.n = Array.from(g.attributes.normal.array);
    put({ key: mat.key, tint: mat.tint, shadow: true, pictured: false, geo }, m);
    drawn++;
  }
  if (made.length) console.log(`new Parts: ${drawn} drawn, ${solid} solid${skipped.size ? `; not drawn (no shape for them yet): ${[...skipped].map(([k, n]) => `${n} ${k}`).join(", ")}` : ""}`);
}

/* ------------------------------------------------------------ generated props */
// Each is its mesh (mesh space: Roblox centres a MeshPart on the mesh's box,
// at MeshSize for a scale of 1) where Studio has it; its texture, once,
// as a JPEG (the headless browser encodes it), its material "gen:<hash>".
const genImages = new Map();   // material key -> { jpeg: Buffer }
{
  const texKey = new Map();
  if (got.genTex.size) {
    const { chromium } = createRequire(import.meta.url)("playwright");   // NODE_PATH: the main checkout's node_modules
    const browser = await chromium.launch();
    const page = await browser.newPage();
    for (const [id, t] of got.genTex) {
      const b64 = t.parts.join("");
      const jpeg = Buffer.from((await page.evaluate(({ w, h, b64 }) => {
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const bin = atob(b64), px = new Uint8ClampedArray(bin.length);
        for (let i = 0; i < bin.length; i++) px[i] = bin.charCodeAt(i);
        c.getContext("2d").putImageData(new ImageData(px, w, h), 0, 0);
        return c.toDataURL("image/jpeg", 0.85).split(",")[1];
      }, { w: t.w, h: t.h, b64 })), "base64");
      const key = "gen:" + crypto.createHash("sha1").update(jpeg).digest("hex").slice(0, 8);
      texKey.set(id, key);
      genImages.set(key, { jpeg });
    }
    await browser.close();
  }
  let drawn = 0, solid = 0, tris = 0;
  const missing = new Set();
  for (const s of gens) {
    const m = studio(s.cf, s.s);
    if (s.solid) {
      const box = new THREE.Box3();
      for (let i = 0; i < 8; i++) box.expandByPoint(new THREE.Vector3(i & 1 ? 0.5 : -0.5, i & 2 ? 0.5 : -0.5, i & 4 ? 0.5 : -0.5).applyMatrix4(m));
      const c = box.getCenter(new THREE.Vector3()), z = box.getSize(new THREE.Vector3());
      newCols.push([c.x, c.z, z.x, z.z, z.y, box.min.y, s.pen ?? 6].map(r4));
      solid++;
    }
    const g = got.genMesh.get(s.gen);
    if (!g) { missing.add(s.name); continue; }
    // mesh space to the unit box: centre on its box, divide by MeshSize
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < g.p.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], g.p[i + k]); hi[k] = Math.max(hi[k], g.p[i + k]); }
    const mid = lo.map((l, k) => (l + hi[k]) / 2);
    const unitM = m.clone().multiply(new THREE.Matrix4().makeScale(1 / s.ms[0], 1 / s.ms[1], 1 / s.ms[2])).multiply(new THREE.Matrix4().makeTranslation(-mid[0], -mid[1], -mid[2]));
    const key = (s.tex && texKey.get(s.tex)) || null;
    const tint = key ? "" : s.color.map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("");
    put({ key: key || "gen:plain", tint, shadow: true, pictured: true, geo: { p: g.p, n: g.n, uv: g.uv } }, unitM);
    drawn++; tris += g.p.length / 9;
  }
  if (gens.length) console.log(`generated props: ${drawn} drawn (${Math.round(tris)} triangles, ${genImages.size} textures), ${solid} solid${missing.size ? `; no mesh for ${[...missing].join(", ")}` : ""}`);
}

/* ------------------------------------------------------------ moves */
// Each model's box as the code built it (its still pieces), and its move:
// what most of its pieces did in Studio. A building dragged whole moves;
// one with a window nudged stays put. trollcity-studio.js moves what the
// code still draws by the smallest box round it, so a model left be beside
// a moved one goes in the list too (as staying put).
const moves = [];
const I4 = new THREE.Matrix4();
if (OUTCFG.moves) {
  const box = new Map();
  for (const p of pieces) {
    if (p.live || !p.geo || !p.path) continue;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < p.geo.p.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p.geo.p[i + k]); hi[k] = Math.max(hi[k], p.geo.p[i + k]); }
    const parts = p.path.split("/");
    for (let d = 2; d <= parts.length; d++) {
      const path = parts.slice(0, d).join("/");
      if (/\/Ground_\d+$/.test(path)) continue;   // a yard: too broad to stand in
      if (!box.has(path)) box.set(path, { lo: [...lo], hi: [...hi], votes: [] });
      const b = box.get(path);
      for (let k = 0; k < 3; k++) { b.lo[k] = Math.min(b.lo[k], lo[k]); b.hi[k] = Math.max(b.hi[k], hi[k]); }
      if (!delta.has(p.i)) continue;   // deleted in Studio: no say
      // (pieces moved together agree to a millimetre, a milliradian)
      const m = delta.get(p.i) || I4;
      let v = b.votes.find((q) => q.m.elements.every((e, i) => Math.abs(e - m.elements[i]) < 2e-3));
      if (!v) b.votes.push((v = { n: 0, m }));
      v.n++;
    }
  }
  const rows = (m) => { const e = m.elements; return [e[0], e[4], e[8], e[12], e[1], e[5], e[9], e[13], e[2], e[6], e[10], e[14]].map((x) => Math.round(x * 1e5) / 1e5); };
  const near = (m) => m.elements.every((x, i) => Math.abs(x - I4.elements[i]) < 1e-3);
  const went = [], mixed = [];
  for (const [path, b] of box) {
    const votes = [...b.votes].sort((a, c) => c.n - a.n);
    if (!votes.length) continue;
    const total = votes.reduce((a, v) => a + v.n, 0);
    if (!near(votes[0].m)) {
      went.push({ path, b, m: votes[0].m });
      if (votes[0].n < total * 0.9) mixed.push(`${path} (${votes[0].n}/${total})`);
    }
  }
  const pad = (b) => [b.lo[0] - 0.25, b.lo[2] - 0.25, b.hi[0] + 0.25, b.hi[2] + 0.25];
  const touches = (a, c) => { const A = pad(a), C = pad(c); return A[0] <= C[2] && C[0] <= A[2] && A[1] <= C[3] && C[1] <= A[3]; };
  for (const [path, b] of box) {
    const w = went.find((x) => x.path === path);
    if (w) moves.push([...b.lo, ...b.hi].map(r4).concat([rows(w.m)]));
    else if (went.some((x) => touches(x.b, b))) moves.push([...b.lo, ...b.hi].map(r4).concat([0]));
  }
  console.log(`models: ${went.length} moved${went.length ? `: ${went.slice(0, 8).map((x) => x.path).join(", ")}${went.length > 8 ? " ..." : ""}` : ""}`);
  if (mixed.length) console.log(`  moved, but not all their pieces with them (the most did): ${mixed.join(", ")}`);
}

/* ------------------------------------------------------------ markers */
// An RP marker that moved (on its own or with its model) is that spot:
// [x, y, z, yaw|null, w|null, d|null] by its name in the RP spec.
const rpOut = {};
// Every marker as it stands, by name, for a map whose layout is Studio's
// (kabukigrin): { kind, p, yaw, size?, top?, dir?, to?, label?, team? }
const markersOut = {};
const lightsOut = got.lights.map((l) => [...l.p.map(r4), "#" + l.color.map((c) => Math.round(Math.min(1, c) * 255).toString(16).padStart(2, "0")).join(""), r4(l.power), r4(l.range)]);
if (!OUTCFG.moves) {
  const dup = new Set();
  for (const mk of got.markers) {
    if (!mk.name) continue;
    if (markersOut[mk.name]) dup.add(mk.name);
    const o = { kind: mk.kind || "rp", p: mk.p.map(r4) };
    if (typeof mk.yaw === "number" && mk.kind !== "spawn" && mk.kind !== "site") o.yaw = r4(mk.yaw);
    if (mk.size) o.size = [r4(mk.size[0]), r4(mk.size[2])];
    for (const k of ["top", "dir", "label", "team"]) if (mk[k] != null) o[k] = typeof mk[k] === "number" ? r4(mk[k]) : mk[k];
    if (mk.to) o.to = mk.to.map(r4);
    markersOut[mk.name] = o;
  }
  const kinds = {};
  for (const o of Object.values(markersOut)) kinds[o.kind] = (kinds[o.kind] || 0) + 1;
  console.log(`markers: ${Object.keys(markersOut).length} by name (${Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(", ")}); lights: ${lightsOut.length}${dup.size ? `; NAMED TWICE (the last wins): ${[...dup].join(", ")}` : ""}`);
} else {
  let movedM = 0, other = 0;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  // by name first: a new RP spot in the game renumbers every marker after it,
  // but the names (rp.seats.12, ...) stay put; M is the fallback
  const byName = new Map(index.markers.map((o) => [o.name, o]));
  for (const mk of got.markers) {
    const o = (mk.name && byName.get(mk.name)) || index.markers[mk.m];
    if (!o) continue;
    const off = Math.hypot(mk.p[0] - o.p[0], mk.p[1] - o.p[1], mk.p[2] - o.p[2]);
    const turned = typeof o.yaw === "number" && Math.abs(wrap(mk.yaw - o.yaw)) > 0.01;
    let size = null;
    if (o.zone && mk.size) {
      size = Math.abs(Math.sin(mk.yaw || 0)) > 0.7 ? [mk.size[2], mk.size[0]] : [mk.size[0], mk.size[2]];
      if (Math.abs(size[0] - o.zone[0]) < 0.01 && Math.abs(size[1] - o.zone[1]) < 0.01) size = null;
    }
    if (off < 0.01 && !turned && !size) continue;
    if (o.kind !== "rp") { other++; continue; }
    movedM++;
    rpOut[o.name] = [...mk.p.map(r4), typeof o.yaw === "number" ? r4(mk.yaw) : null, size ? r4(size[0]) : null, size ? r4(size[1]) : null];
  }
  console.log(`markers: ${got.markers.length} (the game has ${index.markers.length}), ${movedM} RP spots moved${other ? `, ${other} spawns or zombie windows moved (phase 3: not carried yet)` : ""}`);
}

/* ------------------------------------------------------------ the GLB */
function bake(list, withNormals, withUV, withExtra = false) {
  const P = [], N = [], U = [], U2 = [], C = [], I = [];
  const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const { geo, m } of list) {
    const base = P.length / 3;
    if (m) nm.getNormalMatrix(m);
    const flip = m && m.determinant() < 0;
    for (let i = 0; i < geo.p.length; i += 3) {
      v.set(geo.p[i], geo.p[i + 1], geo.p[i + 2]);
      if (m) v.applyMatrix4(m);
      P.push(v.x, v.y, v.z);
      if (withNormals) {
        v.set(geo.n[i], geo.n[i + 1], geo.n[i + 2]);
        if (m) v.applyMatrix3(nm).normalize();
        N.push(v.x, v.y, v.z);
      }
    }
    const nv = geo.p.length / 3;
    if (withUV) for (let i = 0; i < nv; i++) U.push(geo.uv ? geo.uv[i * 2] : 0, geo.uv ? geo.uv[i * 2 + 1] : 0);
    // a GLB chunk's light-map UVs and paint (white, opaque where it has none)
    if (withExtra) for (let i = 0; i < nv; i++) {
      U2.push(geo.uv2 ? geo.uv2[i * 2] : 0, geo.uv2 ? geo.uv2[i * 2 + 1] : 0);
      if (geo.c && geo.c.length === nv * 4) C.push(geo.c[i * 4], geo.c[i * 4 + 1], geo.c[i * 4 + 2]);
      else if (geo.c) C.push(geo.c[i * 3], geo.c[i * 3 + 1], geo.c[i * 3 + 2]);
      else C.push(1, 1, 1);
    }
    const idx = geo.idx || Array.from({ length: nv }, (_, i) => i);
    for (let t = 0; t < idx.length; t += 3) {
      if (flip) I.push(base + idx[t], base + idx[t + 2], base + idx[t + 1]);
      else I.push(base + idx[t], base + idx[t + 1], base + idx[t + 2]);
    }
  }
  // a GLB chunk comes in a corner per triangle corner: corners that agree on
  // everything are welded into one (a third of the size, the same mesh)
  if (withExtra) return weld({ P, N, U, U2, C, I });
  return { P, N, U, U2, C, I };
}

function weld({ P, N, U, U2, C, I }) {
  const out = { P: [], N: [], U: [], U2: [], C: [], I: [] }, at = new Map(), q = (x) => Math.round(x * 1e5);
  const nv = P.length / 3, map = new Int32Array(nv);
  for (let i = 0; i < nv; i++) {
    const k = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2], ...(N.length ? [N[i * 3], N[i * 3 + 1], N[i * 3 + 2]] : []),
      ...(U.length ? [U[i * 2], U[i * 2 + 1]] : []), U2[i * 2], U2[i * 2 + 1], C[i * 3], C[i * 3 + 1], C[i * 3 + 2]].map(q).join(",");
    let j = at.get(k);
    if (j == null) {
      j = out.P.length / 3; at.set(k, j);
      out.P.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
      if (N.length) out.N.push(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]);
      if (U.length) out.U.push(U[i * 2], U[i * 2 + 1]);
      out.U2.push(U2[i * 2], U2[i * 2 + 1]);
      out.C.push(C[i * 3], C[i * 3 + 1], C[i * 3 + 2]);
    }
    map[i] = j;
  }
  for (const i of I) out.I.push(map[i]);
  return out;
}

function writeGLB(groups) {
  const chunks = [], views = [], accessors = [], meshesOut = [], nodes = [];
  const images = [], textures = [], materials = [], matOf = new Map();
  let offset = 0;
  const view = (typed, target) => {
    const buf = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
    const pad = (4 - (buf.length % 4)) % 4;
    chunks.push(buf, Buffer.alloc(pad));
    views.push({ buffer: 0, byteOffset: offset, byteLength: buf.length, ...(target ? { target } : {}) });
    offset += buf.length + pad;
    return views.length - 1;
  };
  const acc = (typed, type, comp, count, extra = {}) => {
    accessors.push({ bufferView: view(typed, type === "SCALAR" ? 34963 : 34962), componentType: comp, count, type, ...extra });
    return accessors.length - 1;
  };
  // a generated prop's material: its JPEG (gen:plain has none: tinted in the game)
  const genMat = (key) => {
    if (matOf.has(key)) return matOf.get(key);
    const img = genImages.get(key);
    const mat = { name: key, pbrMetallicRoughness: { metallicFactor: 0, roughnessFactor: 0.85 } };
    if (img) {
      images.push({ bufferView: view(new Uint8Array(img.jpeg), 0), mimeType: "image/jpeg" });
      textures.push({ source: images.length - 1, sampler: 0 });
      mat.pbrMetallicRoughness.baseColorTexture = { index: textures.length - 1 };
    }
    materials.push(mat);
    matOf.set(key, materials.length - 1);
    return materials.length - 1;
  };
  // a GLB chunk's material: the source GLB's own (colour, roughness, glow),
  // under the chunk's key; the game lights and retextures it as that GLB
  const srcMats = new Map(), exts = new Set();
  const glbMat = (key, tint = null) => {
    const id = tint ? `${key}|${tint}` : key;
    if (matOf.has(id)) return matOf.get(id);
    const [, file, name] = key.split(":");
    if (!srcMats.has(file)) {
      let list = [];
      try {
        const b = fs.readFileSync(path.join(ROOT, `assets/games/troll-ops/models/${file}.glb`));
        list = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString()).materials || [];
      } catch {}
      srcMats.set(file, new Map(list.map((m) => [m.name.replace(/[^\w]+/g, "_"), m])));
    }
    const src = srcMats.get(file).get(name);
    const mat = src ? JSON.parse(JSON.stringify(src)) : { pbrMetallicRoughness: { metallicFactor: 0, roughnessFactor: 0.9 } };
    // (no textures: the Blender GLBs have none)
    if (mat.pbrMetallicRoughness) { delete mat.pbrMetallicRoughness.baseColorTexture; delete mat.pbrMetallicRoughness.metallicRoughnessTexture; }
    delete mat.normalTexture; delete mat.emissiveTexture; delete mat.occlusionTexture;
    for (const e of Object.keys(mat.extensions || {})) exts.add(e);
    mat.name = key;
    if (tint) {
      // the Part's colour, as glTF wants it (linear)
      const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      const rgb = [0, 2, 4].map((i) => lin(parseInt(tint.slice(i, i + 2), 16) / 255));
      mat.pbrMetallicRoughness = { ...(mat.pbrMetallicRoughness || {}), baseColorFactor: [...rgb, 1] };
    }
    materials.push(mat);
    matOf.set(id, materials.length - 1);
    return materials.length - 1;
  };
  let tris = 0;
  for (const [name, g] of groups) {
    const prims = [];
    const gm = name.startsWith("gen:") ? genMat(name.split("|")[0]) : name.startsWith("glb:") ? glbMat(name.split("|")[0], name.endsWith("|n") ? name.split("|")[1] : null) : null;
    for (const [kind, list] of [["flat", g.flat], ["smooth", g.smooth]]) {
      if (!list.length) continue;
      const { P, N, U, U2, C, I } = bake(list, kind === "smooth", g.uv ?? g.pictured, g.extra);
      const pos = new Float32Array(P);
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], pos[i + k]); hi[k] = Math.max(hi[k], pos[i + k]); }
      const attributes = { POSITION: acc(pos, "VEC3", 5126, pos.length / 3, { min: lo, max: hi }) };
      if (N.length) attributes.NORMAL = acc(new Float32Array(N), "VEC3", 5126, N.length / 3);
      if (U.length) attributes.TEXCOORD_0 = acc(new Float32Array(U), "VEC2", 5126, U.length / 2);
      if (U2.length) attributes.TEXCOORD_1 = acc(new Float32Array(U2), "VEC2", 5126, U2.length / 2);
      if (C.length) attributes.COLOR_0 = acc(new Float32Array(C), "VEC3", 5126, C.length / 3);
      const big = pos.length / 3 > 65535;
      const indices = acc(big ? new Uint32Array(I) : new Uint16Array(I), "SCALAR", big ? 5125 : 5123, I.length);
      prims.push({ attributes, indices, mode: 4, ...(gm != null ? { material: gm } : {}) });
      tris += I.length / 3;
    }
    // (the name in extras too: GLTFLoader rewrites names with spaces or ":")
    meshesOut.push({ name, primitives: prims, extras: { tc: name } });
    nodes.push({ name, mesh: meshesOut.length - 1, extras: { tc: name } });
  }
  const bin = Buffer.concat(chunks);
  const json = { asset: { version: "2.0", generator: "troll-ops-map-from-studio" }, scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }],
    nodes, meshes: meshesOut, accessors, bufferViews: views, buffers: [{ byteLength: bin.length }], ...(exts.size ? { extensionsUsed: [...exts] } : {}),
    ...(materials.length ? { materials, ...(images.length ? { images, textures, samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }] } : {}) } : {}) };
  let js = Buffer.from(JSON.stringify(json));
  js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
  head.write("glTF", 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  jh.writeUInt32LE(js.length, 0); jh.write("JSON", 4);
  bh.writeUInt32LE(bin.length, 0); bh.write("BIN\0", 4);
  return { glb: Buffer.concat([head, jh, js, bh, bin]), tris };
}

const { glb, tris } = writeGLB([...out].sort(([a], [b]) => (a < b ? -1 : 1)));
const v = crypto.createHash("sha1").update(glb).digest("hex").slice(0, 8);
console.log(`${MAP}: ${out.size} meshes, ${tris} triangles, ${(glb.length / 1024 / 1024).toFixed(2)} MB (GLB ${v})`);
if (!WRITE) { console.log(`check only: --write to write models/${OUTCFG.glb}.glb and ${OUTCFG.layout}`); process.exit(0); }

fs.writeFileSync(GLB, glb);
const nl = "\n";
const rows = (list) => list.map((c) => `    ${JSON.stringify(c)},`).join(nl);
if (OUTCFG.moves) {
  fs.writeFileSync(LAYOUT, `// Troll City's Studio town (doc "Troll City redesign in Roblox Studio"),${nl}` +
    `// written by tools/troll-ops-map-from-studio.mjs --write. trollcity-studio.js${nl}` +
    `// draws models/<glb>.glb and lays these still colliders: [x, z, w, d, h, y, pen];${nl}` +
    `// moves and rp: what Studio moved (see trollcity-studio.js).${nl}` +
    `export const TC_LAYOUT = {${nl}  glb: "tc-town", v: "${v}",${nl}  colliders: [${nl}` +
    rows([...cols, ...newCols]) + `${nl}  ],${nl}  moves: [${nl}` +
    rows(moves) + `${nl}  ],${nl}  rp: {${nl}` +
    Object.entries(rpOut).map(([k, r]) => `    ${JSON.stringify(k)}: ${JSON.stringify(r)},`).join(nl) + `${nl}  },${nl}};${nl}`);
} else {
  fs.writeFileSync(LAYOUT, `// ${MAP}'s Studio layout (doc "Kabukigrin"), written by${nl}` +
    `// tools/troll-ops-map-from-studio.mjs --map ${MAP} --write. The map draws${nl}` +
    `// models/<glb>.glb and lays these colliders: [x, z, w, d, h, y, pen];${nl}` +
    `// markers: every Studio marker by name ({ kind, p: [x, y, z], yaw?, size?,${nl}` +
    `// top?, dir?, to?, label?, team? }); lights: [x, y, z, "#rrggbb", power, range].${nl}` +
    `export const ${OUTCFG.name} = {${nl}  glb: "${OUTCFG.glb}", v: "${v}",${nl}  colliders: [${nl}` +
    rows([...cols, ...newCols]) + `${nl}  ],${nl}  markers: {${nl}` +
    Object.entries(markersOut).map(([k, r]) => `    ${JSON.stringify(k)}: ${JSON.stringify(r)},`).join(nl) + `${nl}  },${nl}  lights: [${nl}` +
    rows(lightsOut) + `${nl}  ],${nl}};${nl}`);
}
console.log(`wrote ${path.relative(ROOT, GLB)} and ${path.relative(ROOT, LAYOUT)}`);
console.log(`now bump: node tools/troll-ops-bump-tags.mjs <suffix> assets/games/troll-ops/${OUTCFG.layout} --write`);
