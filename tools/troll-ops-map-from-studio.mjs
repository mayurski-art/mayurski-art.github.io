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
//   [--port 5297]
//
// New Parts made in Studio are counted but not drawn yet (phase 2).

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { ROOT, captureMap } from "./troll-ops-map-capture.mjs";

const THREE = await import(pathToFileURL(path.join(ROOT, "assets/vendor/three.module.min.js")).href);
const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const pi = args.indexOf("--port");
const PORT = pi >= 0 ? +args[pi + 1] : 5297;
const K = 3;   // studs per metre
const GLB = path.join(ROOT, "assets/games/troll-ops/models/tc-town.glb");
const LAYOUT = path.join(ROOT, "assets/games/troll-ops/maps/trollcity-layout.js");
const r4 = (v) => Math.round(v * 1e4) / 1e4;

/* ------------------------------------------------------------ receive */
const got = { parts: [], colliders: null, markers: null };
await new Promise((done) => {
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
      res.writeHead(200, { "content-type": "text/plain" });
      res.end(what === "end" ? "rebuilding the town (see the terminal)" : "ok");
      if (what === "end") { server.close(); done(); }
    });
  });
  server.listen(PORT, "127.0.0.1", () => console.log(`waiting for Studio on http://127.0.0.1:${PORT}`));
});
console.log(`from Studio: ${got.parts.length} parts, ${got.colliders.length} colliders, ${got.markers.length} markers`);

/* ------------------------------------------------------------ rebuild */
const cap = await captureMap({ geometry: true });
const { pieces, meshes, index } = cap;

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
const meshMid = (g) => {
  const v = meshes[g].v;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < v.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[i + k] * K); hi[k] = Math.max(hi[k], v[i + k] * K); }
  return { mid: lo.map((l, k) => (l + hi[k]) / 2 / K), size: lo.map((l, k) => hi[k] - l) };
};

const out = new Map();   // "key|tint|shadow" -> { flat: [], smooth: [] } of placed geometries
const put = (piece, m) => {
  const name = `${piece.key}|${piece.tint}|${piece.shadow ? 1 : 0}`;
  if (!out.has(name)) out.set(name, { flat: [], smooth: [], pictured: piece.pictured });
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
const seen = new Set();
const delta = new Map();   // piece -> its move (null: where it was)
for (const s of got.parts) {
  if (s.new) { fresh++; continue; }
  if (s.p != null) {
    const piece = pieces[s.p];
    if (!piece || !piece.prim || piece.live) continue;
    if (still(s.cf, s.s, piece.prim.p, piece.prim.f, piece.prim.s)) { put(piece, null); kept++; delta.set(piece.i, null); }
    else { const m = studio(s.cf, s.s).multiply(original(piece.prim).invert()); put(piece, m); moved++; delta.set(piece.i, m); }
    seen.add(s.p);
  } else if (s.g != null) {
    const { mid, size } = meshMid(s.g);
    // a MeshPart is its mesh centred on its box, at Size0 for scale 1
    const m = new THREE.Matrix4().set(
      s.cf[3], s.cf[4], s.cf[5], s.cf[0] / K,
      s.cf[6], s.cf[7], s.cf[8], s.cf[1] / K,
      s.cf[9], s.cf[10], s.cf[11], s.cf[2] / K,
      0, 0, 0, 1)
      .multiply(new THREE.Matrix4().makeScale(s.s[0] / s.s0[0], s.s[1] / s.s0[1], s.s[2] / s.s0[2]))
      .multiply(new THREE.Matrix4().makeTranslation(-mid[0], -mid[1], -mid[2]));
    const same = still(s.cf, s.s.map((v, k) => v / s.s0[k] * size[k]), mid, [1, 0, 0, 0, 1, 0, 0, 0, 1], size.map((v) => v / K));
    for (const piece of pieces) {
      if (piece.g !== s.g || piece.live) continue;
      put(piece, same ? null : m);
      delta.set(piece.i, same ? null : m);
      seen.add(piece.i);
      same ? kept++ : moved++;
    }
  }
}
const deleted = pieces.filter((p) => !p.live && !seen.has(p.i)).length;
console.log(`pieces: ${kept} as they were, ${moved} moved, ${deleted} deleted, ${fresh} new Parts (not drawn yet)`);

/* ------------------------------------------------------------ colliders */
const before = cap.colliders.filter((c) => !c.live);
// in the game's own order, new ones after, so a diff of the file reads
got.colliders.sort((a, b) => (a.c ?? Infinity) - (b.c ?? Infinity));
const cols = got.colliders.map((c) => {
  const o = cap.colliders.find((k) => k.i === c.c);
  if (o) {
    const was = [(o.min[0] + o.max[0]) / 2, (o.min[2] + o.max[2]) / 2, o.max[0] - o.min[0], o.max[2] - o.min[2], o.max[1] - o.min[1], o.min[1]];
    // left where it was (Studio keeps 32-bit numbers): the game's own numbers
    if ([c.x, c.z, c.w, c.d, c.h, c.y].every((v, k) => Math.abs(v - was[k]) < 1e-3)) return [...was, o.pen].map(r4);
  }
  return [c.x, c.z, c.w, c.d, c.h, c.y, c.pen].map(r4);
});
{
  const byI = new Map(cap.colliders.map((c) => [c.i, c]));
  let changed = 0;
  for (const c of got.colliders) {
    const o = byI.get(c.c);
    if (!o) { changed++; continue; }
    const was = [(o.min[0] + o.max[0]) / 2, (o.min[2] + o.max[2]) / 2, o.max[0] - o.min[0], o.max[2] - o.min[2], o.max[1] - o.min[1], o.min[1]];
    const now = [c.x, c.z, c.w, c.d, c.h, c.y];
    if (Math.max(...now.map((v, k) => Math.abs(v - was[k]))) > 0.01) changed++;
  }
  console.log(`colliders: ${got.colliders.length} from Studio (the game had ${before.length} still ones): ${changed} changed or new, ${Math.max(0, before.length - got.colliders.length)} fewer`);
}

/* ------------------------------------------------------------ moves */
// Each model's box as the code built it (its still pieces), and its move:
// what most of its pieces did in Studio. A building dragged whole moves;
// one with a window nudged stays put. trollcity-studio.js moves what the
// code still draws by the smallest box round it, so a model left be beside
// a moved one goes in the list too (as staying put).
const moves = [];
const I4 = new THREE.Matrix4();
{
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
{
  let movedM = 0, other = 0;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  for (const mk of got.markers) {
    const o = index.markers[mk.m];
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
function bake(list, withNormals, withUV) {
  const P = [], N = [], U = [], I = [];
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
    if (withUV) for (let i = 0; i < geo.p.length / 3; i++) U.push(geo.uv ? geo.uv[i * 2] : 0, geo.uv ? geo.uv[i * 2 + 1] : 0);
    const idx = geo.idx || Array.from({ length: geo.p.length / 3 }, (_, i) => i);
    for (let t = 0; t < idx.length; t += 3) {
      if (flip) I.push(base + idx[t], base + idx[t + 2], base + idx[t + 1]);
      else I.push(base + idx[t], base + idx[t + 1], base + idx[t + 2]);
    }
  }
  return { P, N, U, I };
}

function writeGLB(groups) {
  const chunks = [], views = [], accessors = [], meshesOut = [], nodes = [];
  let offset = 0;
  const view = (typed, target) => {
    const buf = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
    const pad = (4 - (buf.length % 4)) % 4;
    chunks.push(buf, Buffer.alloc(pad));
    views.push({ buffer: 0, byteOffset: offset, byteLength: buf.length, target });
    offset += buf.length + pad;
    return views.length - 1;
  };
  const acc = (typed, type, comp, count, extra = {}) => {
    accessors.push({ bufferView: view(typed, type === "SCALAR" ? 34963 : 34962), componentType: comp, count, type, ...extra });
    return accessors.length - 1;
  };
  let tris = 0;
  for (const [name, g] of groups) {
    const prims = [];
    for (const [kind, list] of [["flat", g.flat], ["smooth", g.smooth]]) {
      if (!list.length) continue;
      const { P, N, U, I } = bake(list, kind === "smooth", g.pictured);
      const pos = new Float32Array(P);
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], pos[i + k]); hi[k] = Math.max(hi[k], pos[i + k]); }
      const attributes = { POSITION: acc(pos, "VEC3", 5126, pos.length / 3, { min: lo, max: hi }) };
      if (N.length) attributes.NORMAL = acc(new Float32Array(N), "VEC3", 5126, N.length / 3);
      if (U.length) attributes.TEXCOORD_0 = acc(new Float32Array(U), "VEC2", 5126, U.length / 2);
      const big = pos.length / 3 > 65535;
      const indices = acc(big ? new Uint32Array(I) : new Uint16Array(I), "SCALAR", big ? 5125 : 5123, I.length);
      prims.push({ attributes, indices, mode: 4 });
      tris += I.length / 3;
    }
    // (the name in extras too: GLTFLoader rewrites names with spaces or ":")
    meshesOut.push({ name, primitives: prims, extras: { tc: name } });
    nodes.push({ name, mesh: meshesOut.length - 1, extras: { tc: name } });
  }
  const bin = Buffer.concat(chunks);
  const json = { asset: { version: "2.0", generator: "troll-ops-map-from-studio" }, scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }],
    nodes, meshes: meshesOut, accessors, bufferViews: views, buffers: [{ byteLength: bin.length }] };
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
console.log(`town: ${out.size} meshes, ${tris} triangles, ${(glb.length / 1024 / 1024).toFixed(2)} MB (GLB ${v})`);
if (!WRITE) { console.log("check only: --write to write models/tc-town.glb and maps/trollcity-layout.js"); process.exit(0); }

fs.writeFileSync(GLB, glb);
const nl = "\n";
fs.writeFileSync(LAYOUT, `// Troll City's Studio town (doc "Troll City redesign in Roblox Studio"),${nl}` +
  `// written by tools/troll-ops-map-from-studio.mjs --write. trollcity-studio.js${nl}` +
  `// draws models/<glb>.glb and lays these still colliders: [x, z, w, d, h, y, pen];${nl}` +
  `// moves and rp: what Studio moved (see trollcity-studio.js).${nl}` +
  `export const TC_LAYOUT = {${nl}  glb: "tc-town", v: "${v}",${nl}  colliders: [${nl}` +
  cols.map((c) => `    ${JSON.stringify(c)},`).join(nl) + `${nl}  ],${nl}  moves: [${nl}` +
  moves.map((m) => `    ${JSON.stringify(m)},`).join(nl) + `${nl}  ],${nl}  rp: {${nl}` +
  Object.entries(rpOut).map(([k, r]) => `    ${JSON.stringify(k)}: ${JSON.stringify(r)},`).join(nl) + `${nl}  },${nl}};${nl}`);
console.log(`wrote ${path.relative(ROOT, GLB)} and ${path.relative(ROOT, LAYOUT)}`);
console.log("now bump: node tools/troll-ops-bump-tags.mjs <suffix> assets/games/troll-ops/maps/trollcity-layout.js --write");
