// Troll Forces: z-fighting scan. Builds a map in the real game, headless,
// and lists every pair of surfaces drawn in the same place (coplanar within
// a few mm and overlapping): the flicker that reads as "glitchy" walls.
//   - same-facing coplanar triangles from two different meshes (or two
//     materials of one mesh), or back to back when either side is double-
//     sided or see-through
//   - grouped per mesh pair, biggest overlap first, with a spot to look at
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-zfight-scan.mjs [mapId] [--mode social] [--write]
//   EPS=0.004 (m, plane gap that still fights), MIN=0.02 (m², overlap to report)
// Exit 1 when anything fights.
//
// --write (Kabukigrin): the fights between two named parts of the Blender
// models are settled at load, not rebuilt: each pair gets a winner (a lit
// piece over an unlit one, else the smaller part, the detail, over the
// bigger) and the winner a polygon offset one step nearer than the loser
// (maps/kabukigrin-zfix.js, read by kabukigrin.js's settleFights). Pairs
// from earlier runs (another mode shows other parts) are kept and merged.
// A pair whose two materials already carry different polygon offsets is
// settled: counted, not reported.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const MAP = args.find((a) => !a.startsWith("--")) || "kabukigrin";
const MODE = args.includes("--mode") ? args[args.indexOf("--mode") + 1] : "social";
const WRITE = args.includes("--write");
const ZFIX = path.join(ROOT, "assets/games/troll-ops/maps/kabukigrin-zfix.js");
const EPS = +(process.env.EPS || 0.004), MIN = +(process.env.MIN || 0.02);
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
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
await ctx.route(/supabase/, (r) => r.abort());   // never a public room
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror", String(e).slice(0, 200)));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
await page.evaluate(async ([mode, map]) => {
  const T = window.__trollOps;
  T.setMode(mode);
  if (T.els.noBots) T.els.noBots.checked = true;
  T.loadout.mapId = map;
  await T.startGame();
  if (T.isStaging?.()) T.endStaging();
}, [MODE, MAP]);
await page.waitForFunction(() => !!window.__trollOps.builtMap()?.map, null, { timeout: 240000 });
await new Promise((r) => setTimeout(r, 6000));

const out = await page.evaluate(([EPS, MIN]) => {
  const T = window.__trollOps, scene = T.scene;
  scene.updateMatrixWorld(true);
  const tris = [];   // [nx, ny, nz, d, ax, ay, az, bx, by, bz, cx, cy, cz, owner, two]
  const owners = [];
  // a name, or for an unnamed (code-built) mesh its geometry, world box and colour
  const name = (o) => {
    const n = []; for (let p = o; p && p !== scene && n.length < 3; p = p.parent) if (p.name) n.push(p.name);
    if (n.length) return n.join(" < ");
    const g = o.geometry; g.computeBoundingBox();
    const b = g.boundingBox.clone().applyMatrix4(o.matrixWorld), f = (x) => x.toFixed(2);
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    return `${g.type} x ${f(b.min.x)}..${f(b.max.x)} y ${f(b.min.y)}..${f(b.max.y)} z ${f(b.min.z)}..${f(b.max.z)} #${m?.color?.getHexString?.() || "?"}`;
  };
  const v = [0, 0, 0];
  scene.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || !o.geometry?.attributes?.position) return;
    for (let p = o; p; p = p.parent) if (!p.visible) return;
    const g = o.geometry, pos = g.attributes.position, idx = g.index, e = o.matrixWorld.elements;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const groups = g.groups.length ? g.groups : [{ start: 0, count: idx ? idx.count : pos.count, materialIndex: 0 }];
    for (const gr of groups) {
      const m = mats[gr.materialIndex] || mats[0];
      if (!m || m.visible === false || m.colorWrite === false || (m.opacity === 0 && m.transparent)) continue;
      const owner = owners.length;
      let inGlb = false; for (let p = o.parent; p; p = p.parent) if (p.name === "Scene") inGlb = true;
      const lit = m.isMeshBasicMaterial || !!m.emissiveMap || (m.emissive && m.emissive.getHex() !== 0 && (m.emissiveIntensity ?? 1) > 0)
        || /lightbox|window|lit|light|lantern|glow|screen|menu|paper|amber|neon|sign/i.test(m.name || "");
      owners.push({ name: name(o), mat: m.name || m.type, two: m.side === 2 || m.transparent, part: inGlb ? `${o.name || o.parent?.name}#${m.name}` : null, nodepth: m.depthWrite === false, lit, area: 0,
        po: m.polygonOffset ? (m.polygonOffsetUnits || 0) + 4 * (m.polygonOffsetFactor || 0) : 0 });
      const W = (i) => { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        return [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]; };
      for (let k = gr.start; k + 2 < gr.start + gr.count; k += 3) {
        const a = W(idx ? idx.getX(k) : k), b = W(idx ? idx.getX(k + 1) : k + 1), c = W(idx ? idx.getX(k + 2) : k + 2);
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
        let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
        const L = Math.hypot(nx, ny, nz);
        if (L / 2 < 0.004) continue;   // slivers and degenerate faces
        nx /= L; ny /= L; nz /= L;
        owners[owner].area += L / 2;
        tris.push([nx, ny, nz, nx * a[0] + ny * a[1] + nz * a[2], ...a, ...b, ...c, owner]);
      }
    }
  });
  // bucket by plane: the unsigned normal (so back-to-back pairs meet) and d
  const key = (t, dd) => { let s = 1; if (t[0] < -1e-3 || (Math.abs(t[0]) <= 1e-3 && (t[1] < -1e-3 || (Math.abs(t[1]) <= 1e-3 && t[2] < 0)))) s = -1;
    return `${Math.round(t[0] * s * 200)},${Math.round(t[1] * s * 200)},${Math.round(t[2] * s * 200)},${Math.round((t[3] * s) / (EPS * 2)) + dd}`; };
  const B = new Map();
  tris.forEach((t, i) => { const k = key(t, 0); (B.get(k) || B.set(k, []).get(k)).push(i); });
  // 2D overlap of two triangles in their shared plane: clip one by the other
  const basis = (n) => { const a = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const u = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]], L = Math.hypot(...u);
    const uu = u.map((x) => x / L); return [uu, [n[1] * uu[2] - n[2] * uu[1], n[2] * uu[0] - n[0] * uu[2], n[0] * uu[1] - n[1] * uu[0]]]; };
  const P2 = (t, u, w) => [0, 1, 2].map((j) => { const p = [t[4 + j * 3], t[5 + j * 3], t[6 + j * 3]]; return [p[0] * u[0] + p[1] * u[1] + p[2] * u[2], p[0] * w[0] + p[1] * w[1] + p[2] * w[2]]; });
  const area = (poly) => { let s = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; s += a[0] * b[1] - a[1] * b[0]; } return s / 2; };
  const clip = (subject, clipPoly) => {
    let outP = subject;
    const ccw = area(clipPoly) > 0 ? 1 : -1;
    for (let i = 0; i < clipPoly.length && outP.length; i++) {
      const A = clipPoly[i], Bp = clipPoly[(i + 1) % clipPoly.length];
      const side = (p) => ccw * ((Bp[0] - A[0]) * (p[1] - A[1]) - (Bp[1] - A[1]) * (p[0] - A[0]));
      const inp = outP; outP = [];
      for (let j = 0; j < inp.length; j++) {
        const P = inp[j], Q = inp[(j + 1) % inp.length], sp = side(P), sq = side(Q);
        if (sp >= 0) outP.push(P);
        if ((sp >= 0) !== (sq >= 0)) { const k = sp / (sp - sq); outP.push([P[0] + (Q[0] - P[0]) * k, P[1] + (Q[1] - P[1]) * k]); }
      }
    }
    return outP.length >= 3 ? Math.abs(area(outP)) : 0;
  };
  const pairs = new Map(), settled = new Set();
  for (const [k, list] of B) {
    const [a, b, c, d] = k.split(",").map(Number);
    const near = [...list, ...(B.get(`${a},${b},${c},${d + 1}`) || [])];
    if (near.length < 2) continue;
    for (let i = 0; i < list.length; i++) for (let j = 0; j < near.length; j++) {
      const ti = tris[list[i]], tj = tris[near[j]];
      if (list[i] >= near[j] && j < list.length) continue;
      if (ti[13] === tj[13]) continue;
      const dot = ti[0] * tj[0] + ti[1] * tj[1] + ti[2] * tj[2];
      if (Math.abs(dot) < 0.9995) continue;
      if (Math.abs(ti[3] - dot * tj[3]) > EPS) continue;
      const oi = owners[ti[13]], oj = owners[tj[13]];
      if (dot < 0 && !oi.two && !oj.two) continue;
      if (oi.nodepth && oj.nodepth) continue;   // neither writes depth: drawn in order, never a fight   // back to back, both one-sided: never both drawn
      // quick reject on the 3D boxes
      let sep = false;
      for (let ax = 0; ax < 3 && !sep; ax++) {
        const mi = Math.min(ti[4 + ax], ti[7 + ax], ti[10 + ax]), Mi = Math.max(ti[4 + ax], ti[7 + ax], ti[10 + ax]);
        const mj = Math.min(tj[4 + ax], tj[7 + ax], tj[10 + ax]), Mj = Math.max(tj[4 + ax], tj[7 + ax], tj[10 + ax]);
        if (mi > Mj + EPS || mj > Mi + EPS) sep = true;
      }
      if (sep) continue;
      const [u, w] = basis([ti[0], ti[1], ti[2]]);
      const ov = clip(P2(ti, u, w), P2(tj, u, w));
      if (ov < 1e-4) continue;
      if (oi.po !== oj.po) { settled.add(ti[13] < tj[13] ? `${ti[13]}|${tj[13]}` : `${tj[13]}|${ti[13]}`); continue; }
      const pk = ti[13] < tj[13] ? `${ti[13]}|${tj[13]}` : `${tj[13]}|${ti[13]}`;
      const e = pairs.get(pk) || { a: oi, b: oj, area: 0, at: null, n: [ti[0], ti[1], ti[2]], gap: 0, down: ti[1] < -0.9 };
      e.area += ov;
      e.gap = Math.max(e.gap, Math.abs(ti[3] - dot * tj[3]));
      if (!e.at) e.at = [(ti[4] + ti[7] + ti[10]) / 3, (ti[5] + ti[8] + ti[11]) / 3, (ti[6] + ti[9] + ti[12]) / 3];
      pairs.set(pk, e);
    }
  }
  const r3 = (a) => a.map((x) => +x.toFixed(2));
  // the model-part pairs and who should win (a lit piece, else the smaller part)
  const info = new Map();
  for (const o of owners) if (o.part) { const e = info.get(o.part) || { lit: false, area: 0, po: 0 }; e.lit ||= o.lit; e.area += o.area; e.po = Math.min(e.po, o.po); info.set(o.part, e); }
  const parts = [...pairs.values()].filter((p) => p.a.part && p.b.part && p.a.part !== p.b.part && p.area >= MIN && !(p.down && Math.abs(p.at[1]) < 0.3)).map((p) => {
    // (decided per part, not per material: a part with a lit and an unlit
    // material gave the same two parts opposite winners, a loop)
    const A = info.get(p.a.part), Bi = info.get(p.b.part);
    const aWins = A.lit !== Bi.lit ? A.lit : A.area !== Bi.area ? A.area < Bi.area : p.a.part < p.b.part;
    return aWins ? [p.a.part, p.b.part, A.po, Bi.po] : [p.b.part, p.a.part, Bi.po, A.po];
  });
  return { tris: tris.length, owners: owners.length, settled: settled.size, parts, pairs: [...pairs.values()].filter((p) => p.area >= MIN).sort((x, y) => y.area - x.area)
    .map((p) => ({ area: +p.area.toFixed(3), gap: +(p.gap * 1000).toFixed(1), at: r3(p.at), n: r3(p.n), a: `${p.a.name} [${p.a.mat}]`, b: `${p.b.name} [${p.b.mat}]` })) };
}, [EPS, MIN]);

console.log(`${MAP} (${MODE}): ${out.tris} triangles, ${out.owners} mesh/material parts`);
for (const p of out.pairs) console.log(`FIGHT ${String(p.area).padStart(7)} m²  gap ${p.gap} mm  at [${p.at}]  n [${p.n}]\n    ${p.a}\n    ${p.b}`);
if (out.settled) console.log(`(${out.settled} pairs already settled by polygon offsets)`);
console.log(out.pairs.length ? `${out.pairs.length} fighting pairs` : "PASS nothing fights");
if (WRITE) {
  // merge with the table's earlier pairs, then give every winner an offset a
  // step nearer than its loser's (on top of what the materials carry: clubOnTop)
  const prev = fs.existsSync(ZFIX) ? fs.readFileSync(ZFIX, "utf8").match(/\/\* pairs (\[[\s\S]*?\]) \*\//) : null;
  const old = prev ? JSON.parse(prev[1]) : [];
  const seen = new Set(old.map((p) => p.slice(0, 2).join("|")));
  const all = [...old, ...out.parts.filter((p) => !seen.has(p.slice(0, 2).join("|")))];
  const rank = {};
  for (let round = 0; round < 64; round++) {
    let moved = false;
    for (const [w, l, pw, pl] of all) {
      const want = Math.max(-32, Math.min(rank[w] ?? 0, (rank[l] ?? 0) + pl - pw - 1));
      if (want < (rank[w] ?? 0)) { rank[w] = want; moved = true; }
    }
    if (!moved) break;
  }
  const keys = Object.keys(rank).sort();
  fs.writeFileSync(ZFIX, [
    "// Kabukigrin: the Blender models' z-fights, settled at load (kabukigrin.js",
    "// settleFights). Each model part listed draws its depth this many polygon-",
    "// offset units nearer, so of two faces drawn in the same place the same one",
    "// always wins (a lit sign over its wall, a detail over the surface it sits",
    "// on) instead of the two taking turns: the flicker. Written by",
    "// tools/troll-ops-zfight-scan.mjs kabukigrin --write; don't edit by hand.",
    `/* pairs ${JSON.stringify(all)} */`,
    "export const KB_ZFIX = {",
    ...keys.map((k) => `  ${JSON.stringify(k)}: ${rank[k]},`),
    "};",
    "",
  ].join("\n"));
  console.log(`wrote ${path.relative(ROOT, ZFIX)}: ${keys.length} parts from ${all.length} pairs`);
}
await browser.close();
server.close();
process.exit(out.pairs.length ? 1 : 0);
