// Troll City geometry audit: builds the real map in Node (no browser) and
// reports the two kinds of glitch the user keeps seeing.
//
//   node tools/troll-ops-trollcity-audit.mjs [--all]
//
// 1. Pictures and signs hung over a window or door (or its trim).
// 2. Visible z-fighting: two different materials with faces in the same
//    plane, facing the same way, overlapping in area, and not buried inside
//    a third box.
//
// It loads trollcity.js through module hooks that map "three" to the vendor
// build, stub the canvas/Image the textures draw with, and add one recording
// call to wall(), wallPic(), signBoard() and framedPicture() (same line, so
// line numbers in the report match the file). Exit code 1 if anything is
// found; --all prints every coplanar pair instead of the first 40.

import { registerHooks } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VENDOR = path.join(ROOT, "assets/vendor");
const SHOW_ALL = process.argv.includes("--all");

registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "three") return { url: pathToFileURL(path.join(VENDOR, "three.module.min.js")).href, shortCircuit: true };
    if (spec.startsWith("three/addons/")) return { url: pathToFileURL(path.join(VENDOR, "addons", spec.slice(13))).href, shortCircuit: true };
    return next(spec, ctx);
  },
  load(url, ctx, next) {
    const r = next(url, { ...ctx, format: "module" });
    const file = url.split("?")[0];
    let src = String(r.source);
    const tap = (re, call) => { src = src.replace(re, (m) => `${m} ${call}`); };
    if (file.endsWith("/trollcity.js")) {
      tap(/^function wall\(K, M, \{[^\n]*\{$/m, "globalThis.__tc.wall(arguments[2]);");
      tap(/^function wallPic\(K, mat, \{[^\n]*\{$/m, "globalThis.__tc.pic('wallPic', arguments[2]);");
      tap(/^function signBoard\(K, mat, frame, \{[^\n]*\{$/m, "globalThis.__tc.pic('signBoard', arguments[3]);");
      src = src.replace(/^  return M;$/m, "  globalThis.__tc.mats(M); return M;");
    }
    if (file.endsWith("/trollcity-kit.js")) {
      tap(/^export function framedPicture\(K, M, \{[^\n]*\{$/m, "globalThis.__tc.pic('framedPicture', arguments[2]);");
    }
    return { ...r, format: "module", source: src, shortCircuit: true };
  },
});

// ---- browser stubs: enough for canvas textures and the trollface image
const ctx2d = new Proxy({}, {
  get: (_, k) => (k === "measureText" ? () => ({ width: 10 }) : k === "getImageData" || k === "createImageData"
    ? () => ({ data: new Uint8ClampedArray(4) }) : k === "createLinearGradient" || k === "createRadialGradient" || k === "createPattern"
    ? () => ({ addColorStop() {} }) : () => {}),
  set: () => true,
});
const el = () => ({ width: 1, height: 1, getContext: () => ctx2d, style: {}, addEventListener() {}, removeEventListener() {}, setAttribute() {} });
globalThis.document = { createElement: el, createElementNS: el };
globalThis.Image = class { constructor() { this.complete = false; this.naturalWidth = 0; } set src(_) {} };
globalThis.window ??= globalThis;

// ---- recording
const walls = [], pics = [], pieces = [];
let matName = new Map();
globalThis.__tc = {
  wall: (a) => walls.push({ ...a, line: callerLine(3) }),
  pic: (kind, a) => pics.push({ kind, ...a, line: callerLine(3) }),
  mats: (M) => {
    for (const [k, v] of Object.entries(M)) {
      if (Array.isArray(v)) v.forEach((m, i) => matName.set(m, `${k}[${i}]`));
      else matName.set(v, k);
    }
  },
};
function callerLine(skip) {
  // the first frame in trollcity.js (the map's own call), else the kit's
  // (past the small helpers at the top of trollcity.js, lines 124-263:
  // wall, room, wallPic, signBoard..., to the line that called them)
  const lines = new Error().stack.split("\n").slice(skip);
  let kit = null, helper = null;
  for (const l of lines) {
    const m = l.match(/(trollcity(?:-kit)?\.js)\S*:(\d+):\d+/);
    if (!m) continue;
    const n = Number(m[2]);
    if (m[1] === "trollcity.js") {
      if (n >= 124 && n <= 263) { helper ??= `${m[1]}:${n}`; continue; }
      return helper ? `${m[1]}:${n} (via ${helper.split(":")[1]})` : `${m[1]}:${n}`;
    }
    if (!kit && n > 240) kit = `${m[1]}:${n}`;   // past Kit's own box/solid/add
  }
  return helper || kit || "?";
}

const THREE = await import("three");
const kitMod = await import(pathToFileURL(path.join(ROOT, "assets/games/troll-ops/trollcity-kit.js")).href + "?v=tc2-wst");
const { TROLLCITY } = await import(pathToFileURL(path.join(ROOT, "assets/games/troll-ops/trollcity.js")).href);

// Every piece the Kit is handed: its world box, material, and where from.
const origAdd = kitMod.Kit.prototype.add;
kitMod.Kit.prototype.add = function (mat, geo, opts) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox.clone();
  const p = geo.parameters || {};
  const size = bb.getSize(new THREE.Vector3());
  let kind = "other";
  if (geo.type === "BoxGeometry") {
    // axis-aligned if the box's own volume matches its world box
    const vol = p.width * p.height * p.depth;
    if (Math.abs(size.x * size.y * size.z - vol) < 1e-6 + vol * 1e-3) kind = "box";
  } else if (geo.type === "PlaneGeometry" || geo.type === "CircleGeometry") {
    const n = geo.attributes.normal;
    if (n) {
      const v = new THREE.Vector3(n.getX(0), n.getY(0), n.getZ(0));
      const ax = ["x", "y", "z"].find((a) => Math.abs(Math.abs(v[a]) - 1) < 1e-3);
      if (ax) kind = { plane: ax, dir: Math.sign(v[ax]) };
    }
  }
  // the town's own Kit only: the train cars are built in their own frames
  if (this.root === mainRoot) pieces.push({ mat, name: matName.get(mat) || mat.name || "?", bb, kind, line: callerLine(3) });
  return origAdd.call(this, mat, geo, opts);
};

const colliders = [];
let mainRoot = null;
const api = {
  prop(o) { mainRoot ??= o; }, add() {},
  ghostBox(x, z, w, d, h, o = {}) {
    const c = { min: new THREE.Vector3(x - w / 2, o.y || 0, z - d / 2), max: new THREE.Vector3(x + w / 2, (o.y || 0) + h, z + d / 2) };
    colliders.push(c);
    return c;
  },
};
api.box = api.ghostBox;
api.solid = api.ghostBox;
TROLLCITY.build(new Proxy(api, { get: (t, k) => t[k] ?? (() => ({ min: new THREE.Vector3(), max: new THREE.Vector3() })) }));

// ---------------------------------------------------- 1. pictures on holes
const T = 0.3;
const found = [];
for (const p of pics) {
  const X = (p.axis || "x") === "x";
  const along = X ? p.x : p.z, plane = X ? p.z : p.x;
  // frames reach a little past the picture
  const pad = p.kind === "signBoard" ? 0.08 : 0.07;
  const pa0 = along - p.w / 2 - pad, pa1 = along + p.w / 2 + pad;
  const py0 = p.y - p.h / 2 - pad, py1 = p.y + p.h / 2 + pad;
  for (const w of walls) {
    if ((w.axis === "x") !== X) continue;
    const t = w.t ?? T;
    if (Math.abs(w.at - plane) > t / 2 + 0.2) continue;
    if (along < Math.min(w.a, w.b) - 1 || along > Math.max(w.a, w.b) + 1) continue;
    for (const hole of w.holes || []) {
      for (const [lo, hi] of hole.spans) {
        // the opening plus its trim (0.12 round the sides, 0.17 on top, the sill below)
        const h0 = hole.c - hole.w / 2 - 0.12, h1 = hole.c + hole.w / 2 + 0.12;
        const y0 = (w.y || 0) + lo - (lo < 0.05 ? 0 : 0.08), y1 = (w.y || 0) + hi + 0.17;
        const oa = Math.min(pa1, h1) - Math.max(pa0, h0), oy = Math.min(py1, y1) - Math.max(py0, y0);
        if (oa > 0.01 && oy > 0.01) found.push({ p, w, hole, lo, hi, oa, oy });
      }
    }
  }
}

// -------------------------------------------------- 2. coplanar overlaps
const faces = [];
const AX = ["x", "y", "z"];
for (const pc of pieces) {
  if (pc.kind === "box") {
    for (const a of AX) {
      for (const dir of [-1, 1]) {
        const at = dir > 0 ? pc.bb.max[a] : pc.bb.min[a];
        if (a === "y" && dir < 0 && at < 0.01) continue;   // an underside on the ground: never seen
        faces.push({ pc, a, dir, at });
      }
    }
  } else if (pc.kind && pc.kind.plane) {
    faces.push({ pc, a: pc.kind.plane, dir: pc.kind.dir, at: pc.bb.min[pc.kind.plane] });
  }
}
const boxes = pieces.filter((p) => p.kind === "box" && !p.mat.transparent);
const buckets = new Map();
for (const f of faces) {
  const k = `${f.a}${f.dir}:${Math.round(f.at * 500)}`;
  if (!buckets.has(k)) buckets.set(k, []);
  buckets.get(k).push(f);
}
const others = (a) => AX.filter((b) => b !== a);
const inside = (pt, skip) => boxes.some((b) => !skip.includes(b) && b.bb.min.x < pt.x && pt.x < b.bb.max.x
  && b.bb.min.y < pt.y && pt.y < b.bb.max.y && b.bb.min.z < pt.z && pt.z < b.bb.max.z);
const pairs = [];
const seen = new Set();
for (const [k, list] of buckets) {
  const [ax, dir] = [list[0].a, list[0].dir];
  const near = [...list, ...(buckets.get(`${ax}${dir}:${Number(k.split(":")[1]) + 1}`) || []), ...(buckets.get(`${ax}${dir}:${Number(k.split(":")[1]) - 1}`) || [])];
  for (const f of list) {
    for (const g of near) {
      if (f === g || f.pc === g.pc || f.pc.mat === g.pc.mat) continue;
      if (Math.abs(f.at - g.at) > 0.002) continue;
      const key = [pieces.indexOf(f.pc), pieces.indexOf(g.pc)].sort().join(",") + ax + dir;
      if (seen.has(key)) continue;
      seen.add(key);
      const [u, v] = others(ax);
      const u0 = Math.max(f.pc.bb.min[u], g.pc.bb.min[u]), u1 = Math.min(f.pc.bb.max[u], g.pc.bb.max[u]);
      const v0 = Math.max(f.pc.bb.min[v], g.pc.bb.min[v]), v1 = Math.min(f.pc.bb.max[v], g.pc.bb.max[v]);
      if (u1 - u0 < 0.005 || v1 - v0 < 0.005) continue;
      // hidden if a third box covers the shared patch just outside the face
      let hidden = true;
      for (const su of [0.1, 0.5, 0.9]) {
        for (const sv of [0.1, 0.5, 0.9]) {
          const pt = new THREE.Vector3();
          pt[ax] = f.at + dir * 0.004;
          pt[u] = u0 + (u1 - u0) * su;
          pt[v] = v0 + (v1 - v0) * sv;
          if (!inside(pt, [f.pc, g.pc])) { hidden = false; break; }
        }
        if (!hidden) break;
      }
      if (hidden) continue;
      pairs.push({ f, g, ax, dir, area: (u1 - u0) * (v1 - v0) });
    }
  }
}
pairs.sort((a, b) => b.area - a.area);

// ------------------------------------- 3. signs and pictures cut by a box
// A picture/sign plane with a solid box passing through it (a cornice
// bracket through a shop sign): the box pokes out of the board's face.
const cuts = [];
// (window glass has its glazing bars through it on purpose)
const planes = pieces.filter((p) => p.kind?.plane && p.kind.plane !== "y" && !/glass|bars/i.test(p.name));
for (const pl of planes) {
  const ax = pl.kind.plane, at = pl.bb.min[ax];
  const [u, v] = others(ax);
  for (const b of boxes) {
    if (b.bb.min[ax] > at - 0.003 || b.bb.max[ax] < at + 0.003) continue;
    const ou = Math.min(pl.bb.max[u], b.bb.max[u]) - Math.max(pl.bb.min[u], b.bb.min[u]);
    const ov = Math.min(pl.bb.max[v], b.bb.max[v]) - Math.max(pl.bb.min[v], b.bb.min[v]);
    if (ou > 0.005 && ov > 0.005) cuts.push({ pl, b, ou, ov });
  }
}

// ------------------------------------------------------------- the report
const fmt = (n) => n.toFixed(2);
console.log(`Troll City audit: ${walls.length} walls, ${pics.length} pictures/signs, ${pieces.length} pieces, ${faces.length} faces`);
console.log(`\n1. Pictures over openings: ${found.length}`);
for (const { p, w, hole, lo, hi, oa, oy } of found) {
  console.log(`  ${p.kind} at ${p.line} (${fmt(p.x)}, ${fmt(p.y)}, ${fmt(p.z)} ${p.w}x${p.h}) over the ${lo < 0.05 ? "door" : "window"} c ${hole.c} w ${hole.w} [${lo}, ${hi}] of the wall at ${w.line}: ${fmt(oa)} x ${fmt(oy)} m`);
}
console.log(`\n2. Visible coplanar faces: ${pairs.length} pairs`);
for (const { f, g, ax, dir, area } of pairs.slice(0, SHOW_ALL ? pairs.length : 40)) {
  console.log(`  ${ax}${dir > 0 ? "+" : "-"} @ ${fmt(f.at)}  ${f.pc.name} (${f.pc.line}) vs ${g.pc.name} (${g.pc.line})  ${area.toFixed(3)} m²`);
}
if (!SHOW_ALL && pairs.length > 40) console.log(`  ... ${pairs.length - 40} more (--all)`);
// where they come from, by the pair of source lines
const bySrc = new Map();
for (const { f, g, area } of pairs) {
  const k = [f.pc.line, g.pc.line].sort().join(" vs ");
  const e = bySrc.get(k) || { n: 0, area: 0 };
  e.n++; e.area += area;
  bySrc.set(k, e);
}
console.log("\n   by source (pairs, total m²):");
for (const [k, e] of [...bySrc].sort((a, b) => b[1].area - a[1].area).slice(0, SHOW_ALL ? 999 : 30)) console.log(`   ${String(e.n).padStart(4)}  ${e.area.toFixed(2).padStart(7)}  ${k}`);
console.log(`\n3. Pictures and signs cut by a box: ${cuts.length}`);
for (const { pl, b, ou, ov } of cuts.slice(0, SHOW_ALL ? cuts.length : 40)) {
  console.log(`  ${pl.name} (${pl.line}) cut by ${b.name} (${b.line}): ${fmt(ou)} x ${fmt(ov)} m`);
}
// Slivers under 1 cm² of overlap can't be seen; anything bigger fails.
const bad = found.length + pairs.filter((p) => p.area >= 0.01).length + cuts.filter((c) => c.ou * c.ov >= 0.01).length;
console.log(bad ? `\nFAIL: ${bad} visible problem(s)` : "\nPASS: nothing visible (slivers under 0.01 m² ignored)");
process.exit(bad ? 1 : 0);
