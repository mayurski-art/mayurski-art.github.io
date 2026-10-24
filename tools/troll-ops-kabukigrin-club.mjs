// One-off (Kabukigrin in Blender, phase 0): pulls the club's Studio parts out
// of models/kb-town.glb (the last Studio export) into
// models/kabukigrin-club.json for build_kabukigrin.blender.py:
//   boxes:  the new Parts ("|n" meshes; Studio writes each Part as 12
//           triangles, every one an axis-aligned box): centre-bottom and size,
//           the Grinjuku material it took, its tint, roughness, metalness and
//           glow; a box within 2 cm of a collider takes the collider's numbers
//           (the colliders are the truth) and its index
//   heroes: the generate_mesh pieces ("gen:"), as their bounding boxes (the
//          meshes come back as OBJ through Blender in a later phase); their
//          textures go to models/kb-hero/<key>.jpg (the build tints each
//          box with its texture's average colour)
//
//   node tools/troll-ops-kabukigrin-club.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const M = path.join(ROOT, "assets/games/troll-ops/models");
const NT = { 5120: [1, 127, "getInt8"], 5121: [1, 255, "getUint8"], 5122: [2, 32767, "getInt16"], 5123: [2, 65535, "getUint16"], 5125: [4, 1, "getUint32"], 5126: [4, 1, "getFloat32"] };
const CT = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const read = (file) => {
  const b = fs.readFileSync(file), jl = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + jl).toString()), bin = b.subarray(20 + jl + 8);
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const acc = (i) => {
    const a = j.accessors[i], bv = j.bufferViews[a.bufferView], [sz, mx, get] = NT[a.componentType], n = CT[a.type];
    const stride = bv.byteStride || sz * n, off = (bv.byteOffset || 0) + (a.byteOffset || 0), out = [];
    for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) {
      let v = dv[get](off + k * stride + c * sz, true);
      if (a.normalized) v = Math.max(v / mx, -1);
      out.push(v);
    }
    return out;
  };
  return { j, acc };
};
const { j, acc } = read(path.join(M, "kb-town.glb"));
const srcMat = {};
for (const f of ["gj-shell", "gj-props", "gj-neon"]) srcMat[f] = Object.fromEntries((read(path.join(M, f + ".glb")).j.materials || []).map((m) => [m.name, m]));
const r3 = (v) => Math.round(v * 1000) / 1000;
// the vertex sets of a mesh's pieces: triangles that share a corner (by position)
function pieces(P, tri) {
  const key = (i) => `${P[i * 3]},${P[i * 3 + 1]},${P[i * 3 + 2]}`;
  const id = new Map(), par = [];
  const at = (i) => { const k = key(i); if (!id.has(k)) { id.set(k, par.length); par.push(par.length); } return id.get(k); };
  const find = (x) => (par[x] === x ? x : (par[x] = find(par[x])));
  for (let t = 0; t < tri.length; t += 3) { const a = find(at(tri[t])); for (let k = 1; k < 3; k++) par[find(at(tri[t + k]))] = a; }
  const out = new Map();
  for (let t = 0; t < tri.length; t += 3) {
    const r = find(at(tri[t]));
    if (!out.has(r)) out.set(r, Object.assign(new Set(), { tris: 0 }));
    const s = out.get(r); s.tris++;
    for (let k = 0; k < 3; k++) s.add(tri[t + k]);
  }
  return [...out.values()];
}
const L = (await import(`data:text/javascript;base64,${Buffer.from(fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/maps/kabukigrin-layout.js"))).toString("base64")}`)).KB_LAYOUT;
const boxes = [], heroes = [];
for (const nd of j.nodes) {
  if (nd.mesh === undefined) continue;
  const name = nd.extras?.tc || nd.name;
  const isPart = name.endsWith("|n"), isHero = name.startsWith("gen:");
  if (!isPart && !isHero) continue;
  const P = [], tri = [];
  for (const p of j.meshes[nd.mesh].primitives) {
    const pos = acc(p.attributes.POSITION), idx = p.indices !== undefined ? acc(p.indices) : Array.from({ length: pos.length / 3 }, (_, i) => i);
    const base = P.length / 3;
    for (const v of pos) P.push(r3(v));
    for (const i of idx) tri.push(base + i);
  }
  if (isHero) {
    // one mesh per texture: split it into its pieces (triangles sharing a
    // corner), each piece its bounding box
    for (const piece of pieces(P, tri)) {
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (const i of piece) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], P[i * 3 + a]); hi[a] = Math.max(hi[a], P[i * 3 + a]); }
      heroes.push({ key: name.split("|")[0], lo: lo.map(r3), hi: hi.map(r3), tris: piece.tris });
    }
    continue;
  }
  const [key, tint, shadow] = name.split("|");
  const [, file, mat] = key.split(":");
  const s = srcMat[file]?.[mat] || {};
  const pbr = s.pbrMetallicRoughness || {};
  const look = {
    file, mat, tint, shadow: shadow !== "0",
    rough: pbr.roughnessFactor ?? 0.9, metal: pbr.metallicFactor ?? 0,
    emit: s.emissiveFactor || null, emitStrength: s.extensions?.KHR_materials_emissive_strength?.emissiveStrength ?? 1,
  };
  for (let t = 0; t < tri.length; t += 36) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let k = 0; k < 36; k++) for (let a = 0; a < 3; a++) { const v = P[tri[t + k] * 3 + a]; lo[a] = Math.min(lo[a], v); hi[a] = Math.max(hi[a], v); }
    let b = [(lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2, hi[0] - lo[0], hi[2] - lo[2], hi[1] - lo[1], lo[1]];
    const ci = L.colliders.findIndex((c) => c.every((v, i) => i > 5 || Math.abs(v - b[i]) < 0.02));
    if (ci >= 0) b = L.colliders[ci].slice(0, 6);
    // [x, z, w, d, h, y] like a collider
    boxes.push({ ...look, b: b.map(r3), collider: ci >= 0 ? ci : null });
  }
}
// the generated pieces' textures
fs.mkdirSync(path.join(M, "kb-hero"), { recursive: true });
const { j: kj } = read(path.join(M, "kb-town.glb"));
{
  const b = fs.readFileSync(path.join(M, "kb-town.glb")), jl = b.readUInt32LE(12), bin = b.subarray(20 + jl + 8);
  for (const m of kj.materials || []) {
    const ti = m.pbrMetallicRoughness?.baseColorTexture?.index;
    if (!m.name.startsWith("gen:") || ti === undefined) continue;
    const bv = kj.bufferViews[kj.images[kj.textures[ti].source].bufferView];
    fs.writeFileSync(path.join(M, "kb-hero", m.name.slice(4) + ".jpg"), bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength));
  }
}
const out = path.join(M, "kabukigrin-club.json");
fs.writeFileSync(out, JSON.stringify({ from: "kb-town.glb", boxes, heroes }, null, 1));
console.log(`wrote ${path.relative(ROOT, out)}: ${boxes.length} boxes (${boxes.filter((b) => b.collider !== null).length} on a collider), ${heroes.length} hero pieces`, (fs.statSync(out).size / 1024).toFixed(0), "KB");
