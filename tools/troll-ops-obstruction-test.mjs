// Nothing blocks anything (CLAUDE.md Troll Forces rule 9): builds a map
// headless and casts rays from a grid of standing eye points to a grid on
// every face its Blender builder registered (models/<map>-faces.json:
// screens, signs, the LED wall, the bottle wall, doorways, windows, lit
// prop faces), and fails when the first thing a ray meets is a registered
// prop standing in front of that face: inside the face's frontal box (its
// rectangle pushed out along its normal, DEPTH m: in front of it, not
// across the room from it), not the face's own prop.
// See-through materials (glass, light beams) don't block.
//
// "known" in the faces file lists pairs left for the user to decide (never a
// Blender prop): printed as KNOWN, not failed.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-obstruction-test.mjs [mapId]
//        [--views out.json]   also write head-on and two-angle views of every
//                             face for tools/troll-ops-map-shots.mjs
//
// The faces file also lists the eye regions ({rect: [x0, x1, z0, z1], y}:
// floors a player stands on); an eye inside a collider is skipped.
import { createRequire } from "node:module";
import { ROOT, serve } from "./troll-ops-map-capture.mjs";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith("--") && !a.endsWith(".json")) || "kabukigrin";
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const DEPTH = 3;
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, `assets/games/troll-ops/models/${id}-faces.json`), "utf8"));

const mapsTag = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/game.js"), "utf8").match(/"\.\/maps\/maps\.js\?v=([^"]+)"/)[1];
const server = await serve(0, undefined, "none");
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
await page.route(/supabase/, (r) => r.abort());
await page.goto(`http://127.0.0.1:${server.address().port}/__export.html`);
const res = await page.evaluate(async ([tag, id, spec, DEPTH]) => {
  const THREE = await import("three");
  const { buildMap } = await import(`/assets/games/troll-ops/maps/maps.js?v=${tag}`);
  const colliders = [];
  const built = buildMap(id, { colliders, arena: {} });
  // wait for the models to stream in
  const count = () => { let n = 0; built.root.traverse((o) => { if (o.isMesh) n++; }); return n; };
  const t0 = performance.now();
  let last = count(), quiet = 0;
  while (performance.now() - t0 < 60000) {
    await new Promise((r) => setTimeout(r, 500));
    const n = count();
    if (n === last) { if ((quiet += 500) >= 4000) break; } else { last = n; quiet = 0; }
  }
  built.root.updateMatrixWorld(true);
  const solid = [];
  built.root.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const ms = [].concat(o.material);
    // see-through and additive things don't hide anything
    if (ms.every((m) => m.transparent && (m.opacity < 0.6 || m.blending === THREE.AdditiveBlending || m.depthWrite === false))) return;
    if (/^dress_/.test(o.name || o.parent?.name || "")) return;
    solid.push(o);
  });
  // A uniform grid over the region the eyes and faces span: every solid
  // triangle there, by the cells its bounds touch; rays walk it cell by cell
  // (three's Raycaster would test every triangle of the town's big meshes).
  const R0 = [Infinity, Infinity, Infinity], R1 = [-Infinity, -Infinity, -Infinity];
  for (const { rect: [x0, x1, z0, z1], y } of spec.eyes) {
    R0[0] = Math.min(R0[0], x0); R1[0] = Math.max(R1[0], x1); R0[2] = Math.min(R0[2], z0); R1[2] = Math.max(R1[2], z1);
    R0[1] = Math.min(R0[1], y); R1[1] = Math.max(R1[1], y + 2);
  }
  for (const f of spec.faces) for (let a = 0; a < 3; a++) { R0[a] = Math.min(R0[a], f.c[a] - 4); R1[a] = Math.max(R1[a], f.c[a] + 4); }
  const CELL = 0.75, G = [0, 1, 2].map((a) => Math.ceil((R1[a] - R0[a]) / CELL));
  const cells = new Map();
  const tri = [];   // flat: 9 floats per triangle
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
  for (const o of solid) {
    const pos = o.geometry.attributes.position, idx = o.geometry.index;
    const n = idx ? idx.count : pos.count;
    for (let t = 0; t < n; t += 3) {
      const ia = idx ? idx.getX(t) : t, ib = idx ? idx.getX(t + 1) : t + 1, ic = idx ? idx.getX(t + 2) : t + 2;
      va.fromBufferAttribute(pos, ia).applyMatrix4(o.matrixWorld);
      vb.fromBufferAttribute(pos, ib).applyMatrix4(o.matrixWorld);
      vc.fromBufferAttribute(pos, ic).applyMatrix4(o.matrixWorld);
      const lo = [Math.min(va.x, vb.x, vc.x), Math.min(va.y, vb.y, vc.y), Math.min(va.z, vb.z, vc.z)];
      const hi = [Math.max(va.x, vb.x, vc.x), Math.max(va.y, vb.y, vc.y), Math.max(va.z, vb.z, vc.z)];
      if (lo.some((v, a) => v > R1[a]) || hi.some((v, a) => v < R0[a])) continue;
      const k = tri.length / 9;
      tri.push(va.x, va.y, va.z, vb.x, vb.y, vb.z, vc.x, vc.y, vc.z);
      const c0 = lo.map((v, a) => Math.max(0, Math.floor((v - R0[a]) / CELL))), c1 = hi.map((v, a) => Math.min(G[a] - 1, Math.floor((v - R0[a]) / CELL)));
      for (let i = c0[0]; i <= c1[0]; i++) for (let j = c0[1]; j <= c1[1]; j++) for (let l = c0[2]; l <= c1[2]; l++) {
        const key = (i * G[1] + j) * G[2] + l;
        let list = cells.get(key);
        if (!list) cells.set(key, (list = []));
        list.push(k);
      }
    }
  }
  const T = new Float32Array(tri);
  // Moller-Trumbore, t along the unit ray
  const hitTri = (k, o, d) => {
    const b = k * 9;
    const e1x = T[b + 3] - T[b], e1y = T[b + 4] - T[b + 1], e1z = T[b + 5] - T[b + 2];
    const e2x = T[b + 6] - T[b], e2y = T[b + 7] - T[b + 1], e2z = T[b + 8] - T[b + 2];
    const px = d.y * e2z - d.z * e2y, py = d.z * e2x - d.x * e2z, pz = d.x * e2y - d.y * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-9) return Infinity;
    const inv = 1 / det, tx = o.x - T[b], ty = o.y - T[b + 1], tz = o.z - T[b + 2];
    const u = (tx * px + ty * py + tz * pz) * inv;
    if (u < 0 || u > 1) return Infinity;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
    const v = (d.x * qx + d.y * qy + d.z * qz) * inv;
    if (v < 0 || u + v > 1) return Infinity;
    const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
    return t > 1e-4 ? t : Infinity;
  };
  // the first hit along o + t d, t < far (Amanatides-Woo through the grid)
  const cast = (o, d, far) => {
    const p = [o.x, o.y, o.z], D = [d.x, d.y, d.z];
    const c = p.map((v, a) => Math.floor((v - R0[a]) / CELL));
    if (c.some((v, a) => v < 0 || v >= G[a])) return null;
    const step = D.map((v) => (v > 0 ? 1 : -1));
    const tMax = D.map((v, a) => (v === 0 ? Infinity : ((R0[a] + (c[a] + (v > 0 ? 1 : 0)) * CELL) - p[a]) / v));
    const tDelta = D.map((v) => (v === 0 ? Infinity : CELL / Math.abs(v)));
    let best = Infinity;
    const tested = new Set();
    for (;;) {
      const list = cells.get((c[0] * G[1] + c[1]) * G[2] + c[2]);
      if (list) for (const k of list) { if (tested.has(k)) continue; tested.add(k); const t = hitTri(k, o, d); if (t < best) best = t; }
      const a = tMax[0] < tMax[1] ? (tMax[0] < tMax[2] ? 0 : 2) : (tMax[1] < tMax[2] ? 1 : 2);
      if (best <= tMax[a] || tMax[a] > far) break;
      c[a] += step[a];
      if (c[a] < 0 || c[a] >= G[a]) break;
      tMax[a] += tDelta[a];
    }
    return best < far ? o.clone().addScaledVector(d, best) : null;
  };
  const inside =(p, c, pad = 0) => p.x > c.min.x - pad && p.x < c.max.x + pad && p.y > c.min.y - pad && p.y < c.max.y + pad && p.z > c.min.z - pad && p.z < c.max.z + pad;
  // the eyes: a 1 m grid over each floor, 1.6 m up, none inside a collider
  const eyes = [];
  for (const { rect: [x0, x1, z0, z1], y } of spec.eyes) {
    for (let x = x0 + 0.5; x < x1; x += 1) for (let z = z0 + 0.5; z < z1; z += 1) {
      const e = new THREE.Vector3(x, y + 1.6, z);
      const feet = new THREE.Vector3(x, y + 0.3, z);
      if (colliders.some((c) => inside(e, c, 0.05) || inside(feet, c, 0.05))) continue;
      eyes.push(e);
    }
  }
  // occluders: the registered props (the floor's scatter and the wall slats
  // are surfaces, not things standing in front)
  const props = spec.props.filter((p) => !/^(cash-|floor-|slats-|ceiling-grid)/.test(p.id))
    .map((p) => ({ id: p.id, on: p.on, min: new THREE.Vector3(...p.lo), max: new THREE.Vector3(...p.hi) }));
  // nobody stands inside a prop (a curtain, a table): those eyes go too
  for (let i = eyes.length - 1; i >= 0; i--) {
    const e = eyes[i], feet = new THREE.Vector3(e.x, e.y - 1.3, e.z);
    if (props.some((p) => inside(e, p, 0.1) || inside(feet, p, 0.1))) eyes.splice(i, 1);
  }
  const family = (owner) => {
    const out = new Set([owner]);
    for (const p of props) if (p.on === owner || p.id.startsWith(owner + "-")) out.add(p.id);
    return out;
  };
  const report = [];
  for (const f of spec.faces) {
    const c = new THREE.Vector3(...f.c), n = new THREE.Vector3(...f.n).normalize(), u = new THREE.Vector3(...f.u).normalize();
    const mine = family(f.owner);
    const samples = [];
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) {
      const a = (i / 4 - 0.5) * f.w * 0.9, b = (j / 3 - 0.5) * f.h * 0.9;
      samples.push(c.clone().addScaledVector(u, a).add(new THREE.Vector3(0, b, 0)).addScaledVector(n, 0.01));
    }
    let seen = 0;
    const blocked = new Map();
    for (const e of eyes) {
      const to = e.clone().sub(c);
      const dist = to.length();
      // in front of the face, within 70 degrees of its normal, and in reach
      if (to.dot(n) < Math.cos((70 * Math.PI) / 180) * dist || dist > 30) continue;
      for (const s of samples) {
        const dir = s.clone().sub(e), d = dir.length();
        dir.normalize();
        const point = cast(e, dir, d - 0.03);
        if (!point) { seen++; continue; }
        const hit = { point };
        // in the face's frontal box?
        const r = hit.point.clone().sub(c);
        const depth = r.dot(n), along = r.dot(u), up = hit.point.y - c.y;
        if (depth <= 0.005 || depth > DEPTH || Math.abs(along) > f.w / 2 || Math.abs(up) > f.h / 2) continue;
        const p = props.find((q) => !mine.has(q.id) && inside(hit.point, q, 0.02));
        if (!p) continue;
        const k = p.id;
        const b = blocked.get(k) || { n: 0, eye: null, at: null };
        b.n++;
        if (!b.eye) { b.eye = [e.x, e.y - 1.6, e.z].map((v) => +v.toFixed(2)); b.at = [hit.point.x, hit.point.y, hit.point.z].map((v) => +v.toFixed(2)); }
        blocked.set(k, b);
      }
    }
    report.push({ id: f.id, seen, blocked: [...blocked.entries()].map(([prop, b]) => ({ prop, ...b })) });
  }
  return { eyes: eyes.length, tris: T.length / 9, faces: report };
}, [mapsTag, id, spec, DEPTH]);
await browser.close();
server.close();

const known = (face, prop) => (spec.known || []).find((k) => k.face === face && k.prop === prop);
let bad = 0;
console.log(`${id}: ${res.eyes} eye points, ${res.faces.length} faces, ${res.tris} triangles round them`);
for (const f of res.faces) {
  const fresh = f.blocked.filter((b) => !known(f.id, b.prop));
  for (const b of f.blocked.filter((b) => known(f.id, b.prop))) console.log(`KNOWN ${f.id}: ${b.prop} (${b.n} rays). ${known(f.id, b.prop).why}`);
  if (!fresh.length) { console.log(`ok   ${f.id.padEnd(18)} ${f.seen} clear sightlines`); continue; }
  bad++;
  console.log(`FAIL ${f.id.padEnd(18)} ${f.seen} clear; in front of it:`);
  for (const b of fresh) console.log(`       ${b.prop} (${b.n} rays; e.g. from feet ${b.eye}, hit at ${b.at})`);
}
// head-on and two angles of every face, for the shot tool
const out = opt("--views");
if (out) {
  const views = [];
  for (const f of spec.faces) {
    const [cx, cy, cz] = f.c, [nx, , nz] = f.n;
    const dist = Math.min(6, Math.max(2.5, Math.max(f.w, f.h) * 1.1));
    for (const [tag, a] of [["head", 0], ["left", 0.6], ["right", -0.6]]) {
      const dx = nx * Math.cos(a) - nz * Math.sin(a), dz = nx * Math.sin(a) + nz * Math.cos(a);
      const ex = cx + dx * dist, ez = cz + dz * dist;
      // stand on the floor the eye is over (the eye regions in the faces file)
      const floor = (spec.eyes.find(({ rect: [x0, x1, z0, z1] }) => ex >= x0 && ex <= x1 && ez >= z0 && ez <= z1) || { y: 0 }).y;
      views.push([+ex.toFixed(2), floor, +ez.toFixed(2), cx, cy, cz, `face-${f.id}-${tag}`]);
    }
  }
  fs.writeFileSync(out, JSON.stringify({ [id]: views }, null, 1));
  console.log(`wrote ${views.length} views to ${out}`);
}
console.log(bad ? `FAIL: ${bad} face(s) with a prop in front` : "PASS");
process.exit(bad ? 1 : 0);
