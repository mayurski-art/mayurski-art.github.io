// How much of Undergrin's plant room floor (the KOTH hill) a player at the
// light well's rail can see (doc "Troll Forces: Undergrin in Blender",
// phase 3: "the plant-room floor seen from the light well's rail is the same
// fraction as today"). Builds the map headless, stands eyes 1.6 m up just
// outside the rail on all four sides of the well (every 0.5 m), and casts a
// ray from each to a 0.25 m grid on the plant room floor: a floor point is
// seen when some eye reaches it unblocked. Prints the fraction seen and the
// mean share per eye; --base N fails when the fraction falls more than
// 0.5 points under N (a percentage from an earlier run).
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-undergrin-hill-view.mjs [--base 37.2]

import { createRequire } from "node:module";
import { serve } from "./troll-ops-map-capture.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const bi = args.indexOf("--base");
const BASE = bi >= 0 ? +args[bi + 1] : null;

const mapsTag = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/game.js"), "utf8").match(/"\.\/maps\/maps\.js\?v=([^"]+)"/)[1];
const server = await serve(0, undefined, "none");
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
await page.route(/supabase/, (r) => r.abort());
await page.goto(`http://127.0.0.1:${server.address().port}/__export.html`);
const res = await page.evaluate(async (tag) => {
  const THREE = await import("three");
  const { buildMap } = await import(`/assets/games/troll-ops/maps/maps.js?v=${tag}`);
  const built = buildMap("undergrin", { colliders: [], arena: {} });
  const count = () => { let n = 0; built.root.traverse((o) => { if (o.isMesh) n++; }); return n; };
  const t0 = performance.now();
  let last = count(), quiet = 0;
  while (performance.now() - t0 < 60000) {
    await new Promise((r) => setTimeout(r, 500));
    const n = count();
    if (n === last) { if ((quiet += 500) >= 4000) break; } else { last = n; quiet = 0; }
  }
  built.root.updateMatrixWorld(true);
  // the room, the well and the concourse round it
  const R0 = [-10.5, -0.5, -9], R1 = [10.5, 8.5, 9];
  const CELL = 0.5, G = [0, 1, 2].map((a) => Math.ceil((R1[a] - R0[a]) / CELL));
  const cells = new Map(), tri = [];
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
  built.root.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const ms = [].concat(o.material);
    if (ms.every((m) => m.transparent && (m.opacity < 0.6 || m.blending === THREE.AdditiveBlending || m.depthWrite === false))) return;
    const pos = o.geometry.attributes.position, idx = o.geometry.index;
    const n = idx ? idx.count : pos.count;
    for (let t = 0; t < n; t += 3) {
      va.fromBufferAttribute(pos, idx ? idx.getX(t) : t).applyMatrix4(o.matrixWorld);
      vb.fromBufferAttribute(pos, idx ? idx.getX(t + 1) : t + 1).applyMatrix4(o.matrixWorld);
      vc.fromBufferAttribute(pos, idx ? idx.getX(t + 2) : t + 2).applyMatrix4(o.matrixWorld);
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
  });
  const T = new Float32Array(tri);
  const hitTri = (k, o, d) => {
    const b = k * 9;
    const e1x = T[b + 3] - T[b], e1y = T[b + 4] - T[b + 1], e1z = T[b + 5] - T[b + 2];
    const e2x = T[b + 6] - T[b], e2y = T[b + 7] - T[b + 1], e2z = T[b + 8] - T[b + 2];
    const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-9) return Infinity;
    const inv = 1 / det, tx = o[0] - T[b], ty = o[1] - T[b + 1], tz = o[2] - T[b + 2];
    const u = (tx * px + ty * py + tz * pz) * inv;
    if (u < 0 || u > 1) return Infinity;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
    const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv;
    if (v < 0 || u + v > 1) return Infinity;
    const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
    return t > 1e-4 ? t : Infinity;
  };
  // blocked before `far` along o + t d? (Amanatides-Woo through the grid)
  const blocked = (o, d, far) => {
    const c = o.map((v, a) => Math.floor((v - R0[a]) / CELL));
    if (c.some((v, a) => v < 0 || v >= G[a])) return false;
    const step = d.map((v) => (v > 0 ? 1 : -1));
    const tMax = d.map((v, a) => (v === 0 ? Infinity : ((R0[a] + (c[a] + (v > 0 ? 1 : 0)) * CELL) - o[a]) / v));
    const tDelta = d.map((v) => (v === 0 ? Infinity : CELL / Math.abs(v)));
    const tested = new Set();
    for (;;) {
      const list = cells.get((c[0] * G[1] + c[1]) * G[2] + c[2]);
      if (list) for (const k of list) { if (tested.has(k)) continue; tested.add(k); if (hitTri(k, o, d) < far) return true; }
      const a = tMax[0] < tMax[1] ? (tMax[0] < tMax[2] ? 0 : 2) : (tMax[1] < tMax[2] ? 1 : 2);
      if (tMax[a] > far) return false;
      c[a] += step[a];
      if (c[a] < 0 || c[a] >= G[a]) return false;
      tMax[a] += tDelta[a];
    }
  };
  // eyes just outside the rail (the well is x, z -4..4), 1.6 up from the concourse
  const eyes = [];
  for (let k = -4; k <= 4.001; k += 0.5) {
    eyes.push([k, 7.6, -4.35], [k, 7.6, 4.35], [-4.35, 7.6, k], [4.35, 7.6, k]);
  }
  // the floor (x -9.75..9.75, z -8..8), 3 cm up
  const pts = [];
  for (let x = -9.625; x < 9.75; x += 0.25) for (let z = -7.875; z < 8; z += 0.25) pts.push([x, 0.03, z]);
  const seen = new Uint8Array(pts.length);
  let pairs = 0, clear = 0;
  for (const e of eyes) {
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], d = [p[0] - e[0], p[1] - e[1], p[2] - e[2]];
      const L = Math.hypot(...d);
      d[0] /= L; d[1] /= L; d[2] /= L;
      pairs++;
      if (!blocked(e, d, L - 0.05)) { clear++; seen[i] = 1; }
    }
  }
  let meshes = 0; built.root.traverse((o) => { if (o.isMesh) meshes++; });
  return { meshes, eyes: eyes.length, pts: pts.length, tris: T.length / 9, seen: seen.reduce((a, b) => a + b, 0), perEye: clear / pairs };
}, mapsTag);
await browser.close();
server.close();

const frac = (100 * res.seen) / res.pts;
console.log(`undergrin hill view (${res.meshes} meshes): ${res.eyes} eyes at the well rail, ${res.pts} floor points, ${res.tris} triangles`);
console.log(`  floor seen from the rail: ${frac.toFixed(2)}%   (mean per eye ${(100 * res.perEye).toFixed(2)}%)`);
if (BASE != null) {
  const ok = frac >= BASE - 0.5;
  console.log(`${ok ? "PASS" : "FAIL"}  against the base ${BASE}% (allowed 0.5 under)`);
  process.exit(ok ? 0 : 1);
}
