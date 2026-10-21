#!/usr/bin/env node
// Troll Forces: a Roblox Studio body (generate_mesh, exported as OBJ + PNG
// per part) cut into the blocky body's kit pieces, written as two GLBs the
// game loads like its Blender kits (characters/blocky-body.js KITS):
//
//   legs-<id>.glb   thighL/R__rbx (hip to knee), kneeL/R__rbx (knee to the
//                   ankle, the boot shaft with it), ankleL/R__rbx (the foot)
//   torso-<id>.glb  chest__rbx (on the chest joint) and torso__rbx (on the
//                   hips), like torso-muscle.glb
//
// The arms stay the garment's Blender ones: the Studio arms' fine bumps
// speckled their ink, and their open hands read badly (user, 2026-10-17).
// Every piece keeps its Studio texture (one per part) as the glTF material's
// base colour map, palette-quantized to 256 colours so a body stays near 2 MB.
// Design: "Troll Forces: Roblox bodies for NFT characters" (2026-10-17).
//
//   node tools/troll-ops-roblox-body.mjs <export dir> <id> [--out <dir>] [--tex 1024]
//        [--joints shoulderY,hipY,legX]  (studs; default the #989 export's)
//        [--no-logos]                    (a design without emblems: no badge decals)
//        [--neck 0.12]                   (metres the torso keeps above the shoulders: lower cuts a skin neck off)
//        [--across 0.28]                 (metres per stud across the torso: wider fills the shoulders)
//        [--leg-across k]                (metres per stud across the legs; default from the hips' spacing)
//        [--muscle q,c]                  (quads and calves swollen by that fraction: a runner's legs)
//        [--arms]                        (also arms-<id>.glb: the Studio arms cut at the elbow and the
//                                           wrist, for Studio hands; --joints takes a 4th, shoulderX)
//        [--arm-across 0.26]             (metres per stud across the arms)
//        [--arm-hands]                   (with --arms: the Studio arm's own hands too, handL/R__rbx)
//        [--reach r]                     (the arms r of the rig's length: the Studio body's own, at one scale;
//                                           the kit's fit.reach, blocky-body.js)
//        [--build b --legs l]            (the rig's reshapeRig build and legs the kit fits it with, default
//                                           the block body's 0.25 and 0.67: the joints' places follow)
//        [--whole]                       (each limb whole, bent by the game at its joints (a skinned mesh,
//                                           blocky-body.js skinnedLimb) instead of cut into pieces; the torso
//                                           one piece: the Studio body exactly, at one scale)
//        [--hands]                       (instead: <dir>/hand_open + hand_fist, a Studio right hand open and
//                                           clenched, -> hands-<id>.glb, white, in the game fist's frame)
//        [--print art.png --print-at y,w]  (a print across the chest front: centred y studs up, w studs wide;
//                                           Studio can't spell, so lettering goes on as a decal)
//
// The export dir holds torso.obj/.png, left_arm, right_arm, left_leg,
// right_leg (Studio studs, feet at y 0, facing -Z, the character's right +X).
// Pure Node, no dependencies.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args.splice(i, 2)[1]; };
const OUT = opt("--out", "assets/games/troll-ops/models/blocky");
const TEX = +opt("--tex", "1024");
const JOINTS = opt("--joints", "");
const NECK = opt("--neck", "");
const ACROSS = +opt("--across", "0.28");
const LEG_ACROSS = +opt("--leg-across", "0");
const [QUAD, CALF] = (opt("--muscle", "0,0")).split(",").map(Number);
const PRINT = opt("--print", "");
const ARMS = args.includes("--arms") && !!args.splice(args.indexOf("--arms"), 1);
const ARM_ACROSS = +opt("--arm-across", "0.26");
const REACH = +opt("--reach", "1");
const BUILD = +opt("--build", "0.25"), LEGS = +opt("--legs", "0.67");
const WHOLE = args.includes("--whole") && !!args.splice(args.indexOf("--whole"), 1);
const STUDIO_HAND = args.includes("--arm-hands") && !!args.splice(args.indexOf("--arm-hands"), 1);
const HANDS = args.includes("--hands") && !!args.splice(args.indexOf("--hands"), 1);
const PRINT_AT = opt("--print-at", "").split(",").map(Number);
const NO_LOGOS = args.includes("--no-logos") && !!args.splice(args.indexOf("--no-logos"), 1);
const [SRC, ID] = args;
if (!SRC || !ID) { console.error("usage: troll-ops-roblox-body.mjs <export dir> <id> [--out dir] [--tex 1024]"); process.exit(1); }

/* ---------------------------------------------------------------- rig */
// The blocky rig at scale 1 (character.js reshapeRig build 0.25 legs 0.67,
// blocky-body.js LEG_BONES): metres.
const RIG = {
  thigh: 0.30, shin: 0.295, sole: 0.012,
  chestToHips: 0.48,
  ankle: 0.07,         // the foot piece reaches this high: the ankle, so the boot shaft rides the shin with the cuff
                       // (at the boot top, 0.16, the cuff tilted with the shin over a level boot: user, 2026-10-17)
  arm: 0.30, fore: 0.325, fistBack: -0.058, fistLen: 0.125,   // blocky-body ARM_BONES, FIST_BACK, the fist's length
  neckClip: 0.12,      // the torso stops this far above the shoulders, round the collar: its neck stump
                       // ran up under the chin (user, 2026-10-17: the head mustn't touch the torso)
};
// Where the Studio body's joints are, in studs (measured on the #989 export,
// 2026-10-17: the shoulders, the hips at the leg tops' pivots)
const SRC_JOINTS = { shoulderY: 4.01, hipY: 2.48, legX: 0.54 };
// another body's (measured the same way: shoulder height where the arms
// join, the hips a little under the trousers' tops, the legs' mean x)
if (JOINTS) [SRC_JOINTS.shoulderY, SRC_JOINTS.hipY, SRC_JOINTS.legX, SRC_JOINTS.shoulderX = 0.5] = JOINTS.split(",").map(Number);
if (NECK) RIG.neckClip = +NECK;
// the rig as character.js reshapeRig(build, legs) lays it out, the arm
// `reach` of its length: the elbow at 0.48 of the arm, the hand point (the
// palm's centre) at its end; the legs' bones
{
  const L = Math.hypot(0.30 * BUILD, 0.62) * REACH;
  RIG.arm = 0.48 * L; RIG.fore = 0.52 * L;
  RIG.fistBack *= REACH; RIG.fistLen *= REACH;
  RIG.thigh = 0.45 * LEGS; RIG.shin = 0.45 * LEGS - 0.032 * BUILD;
}
const LEG_TUCK = 0.025;  // the shin's share: 6 cm poked out of a swollen thigh as a jagged band at the knee
const OVERLAP = 0.02;   // metres an upper piece runs down past its seam
const TUCK = 0.06;      // metres a lower piece runs up inside the one above, so a bent knee shows no gap (the Blender forearm: 3.5 cm)

/* ---------------------------------------------------------------- input */
function readObj(file) {
  const v = [], vt = [], tris = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const p = line.trim().split(/\s+/);
    if (p[0] === "v") v.push(p.slice(1, 4).map(Number));
    else if (p[0] === "vt") vt.push(p.slice(1, 3).map(Number));
    else if (p[0] === "f") {
      const c = p.slice(1).map((s) => s.split("/").map((x) => (x ? +x - 1 : -1)));
      for (let i = 1; i + 1 < c.length; i++) tris.push([c[0], c[i], c[i + 1]].map(([a, b]) => [a, b]));
    }
  }
  return { v, vt, tris };
}
function readPng(file) {
  const b = fs.readFileSync(file);
  let w = 0, h = 0, type = 0, idat = [];
  for (let o = 8; o < b.length;) {
    const len = b.readUInt32BE(o), t = b.toString("ascii", o + 4, o + 8), d = b.subarray(o + 8, o + 8 + len);
    if (t === "IHDR") { w = d.readUInt32BE(0); h = d.readUInt32BE(4); type = d[9]; if (d[8] !== 8) throw new Error("8-bit PNG only"); }
    else if (t === "IDAT") idat.push(d);
    o += 12 + len;
  }
  const bpp = type === 6 ? 4 : type === 2 ? 3 : 0;
  if (!bpp) throw new Error(`${file}: RGB or RGBA PNG only`);
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(w * h * 4);
  const prev = Buffer.alloc(stride), cur = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    raw.copy(cur, 0, y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, up = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      const pa = Math.abs(up - c), pb = Math.abs(a - c), pc = Math.abs(a + up - 2 * c);
      cur[i] = (cur[i] + [0, a, up, (a + up) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? up : c][f]) & 255;
    }
    for (let x = 0; x < w; x++) for (let k = 0; k < 4; k++) out[(y * w + x) * 4 + k] = k < bpp ? cur[x * bpp + k] : 255;
    cur.copy(prev);
  }
  return { w, h, rgba: out };
}

/* ---------------------------------------------------------------- texture */
// Box-filter down to `size`, then median-cut to 256 colours, written as an
// indexed PNG.
function shrink({ w, h, rgba }, size) {
  if (w <= size) return { w, h, rgba };
  const f = w / size, out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const s = [0, 0, 0, 0]; let n = 0;
    for (let yy = Math.floor(y * f); yy < Math.floor((y + 1) * f); yy++)
      for (let xx = Math.floor(x * f); xx < Math.floor((x + 1) * f); xx++) { for (let k = 0; k < 4; k++) s[k] += rgba[(yy * w + xx) * 4 + k]; n++; }
    for (let k = 0; k < 4; k++) out[(y * size + x) * 4 + k] = Math.round(s[k] / n);
  }
  return { w: size, h: size, rgba: out };
}
function quantize({ w, h, rgba }) {
  const n = w * h, idx = new Uint32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  const boxes = [{ lo: 0, hi: n }];
  const ch = (i, k) => rgba[i * 4 + k];
  const range = (b) => {
    let best = 0, axis = 0;
    for (let k = 0; k < 3; k++) {
      let mn = 255, mx = 0;
      for (let j = b.lo; j < b.hi; j += 7) { const c = ch(idx[j], k); if (c < mn) mn = c; if (c > mx) mx = c; }
      if (mx - mn > best) { best = mx - mn; axis = k; }
    }
    return { best, axis };
  };
  while (boxes.length < 256) {
    let pick = -1, pr = null, score = 0;
    boxes.forEach((b, i) => { if (b.hi - b.lo < 2) return; const r = range(b); const s = r.best * Math.sqrt(b.hi - b.lo); if (s > score) { score = s; pick = i; pr = r; } });
    if (pick < 0) break;
    const b = boxes[pick];
    const sub = Array.from(idx.subarray(b.lo, b.hi)).sort((a, c) => ch(a, pr.axis) - ch(c, pr.axis));
    idx.set(sub, b.lo);
    const mid = (b.lo + b.hi) >> 1;
    boxes.splice(pick, 1, { lo: b.lo, hi: mid }, { lo: mid, hi: b.hi });
  }
  const pal = Buffer.alloc(256 * 3), map = new Uint8Array(n);
  boxes.forEach((b, p) => {
    const s = [0, 0, 0];
    for (let j = b.lo; j < b.hi; j++) for (let k = 0; k < 3; k++) s[k] += ch(idx[j], k);
    for (let k = 0; k < 3; k++) pal[p * 3 + k] = Math.round(s[k] / (b.hi - b.lo));
    for (let j = b.lo; j < b.hi; j++) map[idx[j]] = p;
  });
  return { w, h, pal, map, colours: boxes.length };
}
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(t, d) {
  const l = Buffer.alloc(4); l.writeUInt32BE(d.length);
  const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([l, td, c]);
}
function indexedPng({ w, h, pal, map }) {
  const rows = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) { rows[y * (w + 1)] = 0; for (let x = 0; x < w; x++) rows[y * (w + 1) + 1 + x] = map[y * w + x]; }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 3;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("PLTE", pal),
    chunk("IDAT", zlib.deflateSync(rows, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

/* ---------------------------------------------------------------- geometry */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(...a);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = len(a); return [a[0] / l, a[1] / l, a[2] / l]; };
// The rotation (a 3x3, rows) turning unit vector `a` onto unit vector `b`
function rotOnto(a, b) {
  const v = cross(a, b), c = dot(a, b), k = 1 / (1 + c);
  return [
    [v[0] * v[0] * k + c, v[0] * v[1] * k - v[2], v[0] * v[2] * k + v[1]],
    [v[1] * v[0] * k + v[2], v[1] * v[1] * k + c, v[1] * v[2] * k - v[0]],
    [v[2] * v[0] * k - v[1], v[2] * v[1] * k + v[0], v[2] * v[2] * k + c],
  ];
}
const apply = (m, p) => [dot(m[0], p), dot(m[1], p), dot(m[2], p)];

/* A piece: the surface between `lo` and `hi` along `coord` (studs ->
   metres down the limb), its triangles clipped exactly at those two planes
   (a straight cut, like a hem, not a ragged edge along triangles), every
   corner put through `xf` (studs -> the joint's frame, metres), welded by
   position + uv, smooth normals. */
function piece(obj, coord, lo, hi, xf) {
  const pos = [], uv = [], index = [], seen = new Map();
  const corner = (vi, ti) => {
    const p = obj.v[vi], t = ti >= 0 ? obj.vt[ti] : [0, 0];
    return { key: vi + "/" + ti, p, t, c: coord(p) };
  };
  // the point where edge a-b crosses the plane at `at`: the same numbers
  // from both triangles sharing the edge (ends in a fixed order), so the cut
  // welds and its loop closes
  const cut = (a, b, at, plane) => {
    if (a.key > b.key) [a, b] = [b, a];
    const f = (at - a.c) / (b.c - a.c), mix = (x, y) => x.map((v, i) => v + (y[i] - v) * f);
    return { key: `${a.key}~${b.key}@${plane}`, p: mix(a.p, b.p), t: mix(a.t, b.t), c: at };
  };
  const clip = (poly, inside, at, plane) => {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      if (inside(a)) out.push(a);
      if (inside(a) !== inside(b)) out.push(cut(a, b, at, plane));
    }
    return out;
  };
  const vert = (q) => {
    if (!seen.has(q.key)) {
      seen.set(q.key, pos.length / 3);
      pos.push(...xf(q.p));
      uv.push(q.t[0], 1 - q.t[1]);     // OBJ v up -> glTF v down
    }
    return seen.get(q.key);
  };
  for (const tri of obj.tris) {
    let poly = tri.map(([vi, ti]) => corner(vi, ti));
    if (poly.every((q) => q.c < lo) || poly.every((q) => q.c > hi)) continue;
    if (lo > -Infinity) poly = clip(poly, (q) => q.c >= lo, lo, "lo");
    if (hi < Infinity) poly = clip(poly, (q) => q.c <= hi, hi, "hi");
    for (let i = 1; i + 1 < poly.length; i++) index.push(vert(poly[0]), vert(poly[i]), vert(poly[i + 1]));
  }
  const pkey = (i) => pos.slice(i * 3, i * 3 + 3).map((x) => Math.round(x * 1e5)).join(",");
  // Close every open edge loop (the cuts, the clipped neck) with a fan to
  // its centre, wound like the surface, in the colour at the loop's first
  // corner: a bent knee or elbow shows a solid end, and the ink shell built
  // on this (blocky-body.js loadPieces) is closed, so no black inside shows.
  const edges = new Map();   // "a|b" by position -> [index a, index b], one per triangle side
  for (let t = 0; t < index.length; t += 3) for (let e = 0; e < 3; e++) {
    const i = index[t + e], j = index[t + (e + 1) % 3], a = pkey(i), b = pkey(j);
    const back = `${b}|${a}`;
    if (edges.has(back)) edges.delete(back); else edges.set(`${a}|${b}`, [i, j, a, b]);
  }
  const next = new Map();    // the open edges, walked from their start
  for (const [i, j, a, b] of edges.values()) next.set(a, [i, j, b]);
  let caps = 0;
  while (next.size) {
    const [start] = next.keys();
    const loop = [];
    for (let k = start; next.has(k);) { const [i, , b] = next.get(k); next.delete(k); loop.push(i); k = b; }
    if (loop.length < 3) continue;
    const c = [0, 0, 0];
    for (const i of loop) for (let d = 0; d < 3; d++) c[d] += pos[i * 3 + d] / loop.length;
    const u = [uv[loop[0] * 2], uv[loop[0] * 2 + 1]];
    const ci = pos.length / 3;
    pos.push(...c); uv.push(...u);
    const rim = loop.map((i) => { pos.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); uv.push(...u); return pos.length / 3 - 1; });
    for (let k = 0; k < rim.length; k++) index.push(rim[(k + 1) % rim.length], rim[k], ci);
    caps++;
  }
  // smooth normals over corners at the same place (the uv seams too)
  const at = new Map(), nrm = new Float32Array(pos.length);
  const acc = new Map();
  for (let t = 0; t < index.length; t += 3) {
    const [a, b, c] = [index[t], index[t + 1], index[t + 2]].map((i) => pos.slice(i * 3, i * 3 + 3));
    const n = cross(sub(b, a), sub(c, a));
    for (const i of [index[t], index[t + 1], index[t + 2]]) {
      const k = pkey(i); const s = acc.get(k) || [0, 0, 0];
      acc.set(k, [s[0] + n[0], s[1] + n[1], s[2] + n[2]]);
    }
  }
  for (let i = 0; i < pos.length / 3; i++) {
    const n = acc.get(pkey(i)); const l = len(n) || 1;
    nrm.set([n[0] / l, n[1] / l, n[2] / l], i * 3);
  }
  void at;
  return { pos: new Float32Array(pos), uv: new Float32Array(uv), nrm, index: new Uint32Array(index), caps };
}

/* ---------------------------------------------------------------- the cuts */
/* --arms: each Studio arm as the upper arm (shoulder to elbow, on the arm
   joint) and the forearm (elbow to the wrist, on the elbow), each segment
   straightened down its own bone (user, 2026-10-17: "not have the arms so
   curvy"), its shoulder meeting the torso; the Studio hand is cut off (the
   Studio hands, --hands, open and close in its place: user, 2026-10-20). */
function arms(src) {
  const out = [];
  if (WHOLE) return wholeArms(src);
  for (const [side, file, sx] of [["L", "left_arm", -1], ["R", "right_arm", 1]]) {
    const obj = readObj(path.join(src, `${file}.obj`));
    let top = -Infinity;
    for (const v of obj.v) top = Math.max(top, v[1]);
    // the shoulder: at its height and x, the arm's own middle in z
    let z = 0, n = 0;
    for (const v of obj.v) if (v[1] > top - 0.35) { z += v[2]; n++; }
    const S = [sx * SRC_JOINTS.shoulderX, SRC_JOINTS.shoulderY, z / n];
    // the bone: from the shoulder to the vertex farthest from it (the fingertips)
    let tip = S, far = 0;
    for (const v of obj.v) { const d = len(sub(v, S)); if (d > far) { far = d; tip = v; } }
    const d = norm(sub(tip, S));
    const k = (RIG.arm + RIG.fore + RIG.fistBack + RIG.fistLen) / far;   // studs -> metres along the whole arm
    const along = (p) => dot(sub(p, S), d) * k;                   // metres down the bone
    const cutElbow = RIG.arm, cutHand = RIG.arm + RIG.fore + RIG.fistBack;
    const middle = (at) => {
      const c = [0, 0, 0]; let m = 0;
      for (const v of obj.v) if (Math.abs(along(v) - at) < 0.025) { c[0] += v[0]; c[1] += v[1]; c[2] += v[2]; m++; }
      return m ? c.map((x) => x / m) : null;
    };
    const E = middle(cutElbow), W = middle(cutHand);
    // across the arm: its own scale; along it: fitted to the bone
    const seg = (from, to, boneLen) => {
      const ax = sub(to, from), R = rotOnto(norm(ax), [0, -1, 0]), kk = boneLen / len(ax);
      return (p) => { const q = apply(R, sub(p, from)); return [q[0] * ARM_ACROSS, q[1] * kk, q[2] * ARM_ACROSS]; };
    };
    out.push({ name: `arm${side}__rbx`, tex: file, ...piece(obj, along, -Infinity, cutElbow + OVERLAP, seg(S, E, RIG.arm)) });
    out.push({ name: `elbow${side}__rbx`, tex: file, ...piece(obj, along, cutElbow - TUCK, cutHand + OVERLAP, seg(E, W, cutHand - cutElbow)) });
    // the Studio hand itself, from the wrist on, in the fist's frame (blocky-body.js muscleArms:
    // hung FIST_BACK down the forearm, along it), at the forearm's scale so it carries straight on
    if (STUDIO_HAND) {
      const R = rotOnto(norm(sub(W, E)), [0, -1, 0]), kk = (cutHand - cutElbow) / len(sub(W, E));
      out.push({ name: `hand${side}__rbx`, tex: file, ...piece(obj, along, cutHand - TUCK, Infinity, (p) => { const q = apply(R, sub(p, W)); return [q[0] * ARM_ACROSS, q[1] * kk, q[2] * ARM_ACROSS]; }) });
    }
    console.log(`  arm ${side}: ${far.toFixed(2)} studs long, ${k.toFixed(3)} m/stud, bone ${d.map((x) => x.toFixed(2)).join(",")}`);
  }
  return out;
}
/* --whole: the arm in one piece in the upper arm's frame (the shoulder at
   the origin, the bone down -Y, one scale), the forearm and hand turned
   straight onto the rig's forearm at the elbow with a short blend, so the
   game's skinning bends one surface there. The rig's hand point is the
   palm's centre: --reach should put it there (the arm's wrist and palm
   are printed, in studs down the bone, to set it by). */
function wholeArms(src) {
  const out = [];
  for (const [side, file, sx] of [["L", "left_arm", -1], ["R", "right_arm", 1]]) {
    const obj = readObj(path.join(src, `${file}.obj`));
    let top = -Infinity;
    for (const v of obj.v) top = Math.max(top, v[1]);
    let z = 0, n = 0;
    for (const v of obj.v) if (v[1] > top - 0.35) { z += v[2]; n++; }
    const S = [sx * SRC_JOINTS.shoulderX, SRC_JOINTS.shoulderY, z / n];
    let tip = S, far = 0;
    for (const v of obj.v) { const d = len(sub(v, S)); if (d > far) { far = d; tip = v; } }
    const d = norm(sub(tip, S));
    const K = ARM_ACROSS;
    const along = (p) => dot(sub(p, S), d) * K;
    const middle = (at) => {
      const c = [0, 0, 0]; let m = 0;
      for (const v of obj.v) if (Math.abs(along(v) - at) < 0.025) { c[0] += v[0]; c[1] += v[1]; c[2] += v[2]; m++; }
      return m ? c.map((x) => x / m) : null;
    };
    // the wrist: the arm's narrowest girth in its last stud; the palm half
    // way from it to the fingertips
    let wrist = far * K, least = Infinity;
    for (let a = (far - 1) * K; a < far * K - 0.1; a += 0.01) {
      const c = middle(a); if (!c) continue;
      let r = 0, m = 0;
      for (const v of obj.v) if (Math.abs(along(v) - a) < 0.01) { r += len(sub(v, c)); m++; }
      if (m && r / m < least) { least = r / m; wrist = a; }
    }
    const cutElbow = RIG.arm, hand = RIG.arm + RIG.fore;
    const E = middle(cutElbow), W = middle(hand) || middle(wrist);
    const Rup = rotOnto(norm(sub(E, S)), [0, -1, 0]), Rfo = rotOnto(norm(sub(W, E)), [0, -1, 0]);
    const Eq = apply(Rup, sub(E, S)).map((x) => x * K);
    const BLEND = 0.04;
    const xf = (p) => {
      const up = apply(Rup, sub(p, S)).map((x) => x * K);
      const fo = apply(Rfo, sub(p, E)).map((x, i) => x * K + Eq[i]);
      let f = (along(p) - cutElbow + BLEND) / (2 * BLEND);
      f = Math.min(1, Math.max(0, f)); f = f * f * (3 - 2 * f);
      return up.map((x, i) => x + (fo[i] - x) * f);
    };
    out.push({ name: `arm${side}__whole`, tex: file, ...piece(obj, along, -Infinity, Infinity, xf) });
    console.log(`  arm ${side}: ${(far).toFixed(2)} studs to the fingertips, wrist at ${(wrist / K).toFixed(2)}, palm at ${((wrist + far * K) / 2 / K).toFixed(2)}; the rig's hand point at ${(hand / K).toFixed(2)}, elbow at ${(cutElbow / K).toFixed(2)}`);
  }
  return out;
}
function legs(src) {
  const out = [];
  if (WHOLE) return wholeLegs(src);
  // one scale down the leg: hip to the sole is the rig's thigh + shin + sole
  const ky = (RIG.thigh + RIG.shin + RIG.sole) / SRC_JOINTS.hipY;
  const kx = LEG_ACROSS || 0.10 / SRC_JOINTS.legX;    // the rig's hips are 0.10 m apart from the middle (blocky-body setHips)
  const kneeY = RIG.shin + RIG.sole, bootY = RIG.ankle;   // metres above the floor
  for (const [side, file, sx] of [["L", "left_leg", -1], ["R", "right_leg", 1]]) {
    const obj = readObj(path.join(src, `${file}.obj`));
    const cx = sx * SRC_JOINTS.legX;
    // metres above the floor, counted down the leg (the cuts' coordinate)
    const down = (p) => -p[1] * ky;
    const swell = muscles(obj, cx, ky);
    const at = (y0) => (p) => { const [x, z] = swell(p); return [(x - cx) * kx, p[1] * ky - y0, z * kx]; };
    // the thigh's last 3 cm drawn in a little, so its edge (and its ink)
    // tucks inside the shin instead of lying on it as a ring round the knee
    let zc = 0;
    for (const p of obj.v) zc += p[2] / obj.v.length;
    const thighAt = at(SRC_JOINTS.hipY * ky), hem = 0.03;
    const thighXf = (p) => {
      const q = thighAt(p), h = p[1] * ky, t = Math.min(1, Math.max(0, (h - (kneeY - OVERLAP)) / (hem + OVERLAP)));
      const k = 1 - 0.12 * (1 - t) ** 2, z0 = zc * kx;
      return [q[0] * k, q[1], z0 + (q[2] - z0) * k];
    };
    out.push({ name: `thigh${side}__rbx`, tex: file, ...piece(obj, down, -Infinity, -(kneeY - OVERLAP), thighXf) });
    out.push({ name: `knee${side}__rbx`, tex: file, ...piece(obj, down, -(kneeY + LEG_TUCK), -(bootY - OVERLAP), at(kneeY)) });
    out.push({ name: `ankle${side}__rbx`, tex: file, ...piece(obj, down, -(bootY + 0.025), Infinity, at(RIG.sole)) });
  }
  console.log(`  legs: ${ky.toFixed(3)} m/stud tall, ${kx.toFixed(3)} across`);
  return out;
}
/* --whole: the leg in one piece in the thigh's frame (the hip at the
   origin, down -Y), one scale across and down (--leg-across; the rig's
   hip height, (thigh + shin + sole) with --legs, must be that scale times
   the Studio hips' height or the feet float or sink). */
function wholeLegs(src) {
  const out = [];
  const K = LEG_ACROSS || 0.10 / SRC_JOINTS.legX;
  const ky = (RIG.thigh + RIG.shin + RIG.sole) / SRC_JOINTS.hipY;
  if (Math.abs(ky / K - 1) > 0.02) console.log(`  WARNING: the rig's legs are ${ky.toFixed(3)} m/stud tall but the scale is ${K}: --legs ${(SRC_JOINTS.hipY * K / 0.45 / 1.0).toFixed(3)} would fit (thigh + shin + sole = 0.45 legs x 2 - 0.032 build + sole)`);
  for (const [side, file, sx] of [["L", "left_leg", -1], ["R", "right_leg", 1]]) {
    const obj = readObj(path.join(src, `${file}.obj`));
    const cx = sx * SRC_JOINTS.legX;
    const xf = (p) => [(p[0] - cx) * K, (p[1] - SRC_JOINTS.hipY) * K, p[2] * K];
    out.push({ name: `thigh${side}__whole`, tex: file, ...piece(obj, (p) => -p[1], -Infinity, Infinity, xf) });
  }
  console.log(`  legs: ${K} m/stud, whole`);
  return out;
}
/* --muscle: the quads (front of the thigh, above the knee) and the calves
   (back of the shin, below it) pushed out from the leg's own middle at that
   height, easing to nothing at the knee, the shorts and the ankle. */
function muscles(obj, cx, ky) {
  if (!QUAD && !CALF) return (p) => [p[0], p[2]];
  // the leg's middle (x, z) per 0.05-stud band, averaged over the bands
  // either side and blended between them (it leans: knee forward, calf
  // back; raw bands jumped, and the swell came out jagged)
  const bands = new Map();
  for (const p of obj.v) { const b = Math.round(p[1] / 0.05), a = bands.get(b) || [0, 0, 0]; bands.set(b, [a[0] + p[0], a[1] + p[2], a[2] + 1]); }
  const smooth = (b) => { let x = 0, z = 0, n = 0; for (let k = b - 3; k <= b + 3; k++) { const a = bands.get(k); if (a) { x += a[0]; z += a[1]; n += a[2]; } } return n ? [x / n, z / n] : [cx, 0]; };
  const mid = (y) => { const t = y / 0.05, b = Math.floor(t), f = t - b, m0 = smooth(b), m1 = smooth(b + 1); return [m0[0] + (m1[0] - m0[0]) * f, m0[1] + (m1[1] - m0[1]) * f]; };
  const bump = (y, c, w) => { const t = (y - c) / w; return Math.abs(t) >= 1 ? 0 : (1 - t * t) ** 2; };
  const knee = (RIG.shin + RIG.sole) / ky, hip = SRC_JOINTS.hipY, ankle = RIG.ankle / ky;
  const quadY = knee + (hip - knee) * 0.3, quadW = (hip - knee) * 0.4;   // low on the thigh: the shorts cover the rest
  const calfY = knee - (knee - ankle) * 0.3, calfW = (knee - ankle) * 0.4;
  return (p) => {
    const [xc, zc] = mid(p[1]), dx = p[0] - xc, dz = p[2] - zc, d = Math.hypot(dx, dz) || 1;
    const front = Math.max(0, -dz / d), back = Math.max(0, dz / d);
    const k = 1 + QUAD * bump(p[1], quadY, quadW) * (0.45 + 0.55 * front) + CALF * bump(p[1], calfY, calfW) * (0.3 + 0.7 * back);
    return [xc + dx * k, zc + dz * k];
  };
}
function torso(src) {
  const obj = readObj(path.join(src, "torso.obj"));
  // (--whole: one scale down as across, the Studio torso's own height)
  const ky = WHOLE ? ACROSS : RIG.chestToHips / (SRC_JOINTS.shoulderY - SRC_JOINTS.hipY);
  const kx = ACROSS;
  const chestY = SRC_JOINTS.shoulderY, hipsY = SRC_JOINTS.hipY;
  const waist = (chestY + hipsY) / 2;     // studs: the chest half above, the hips half below
  const top = chestY + RIG.neckClip / ky;
  const down = (p) => -p[1];   // studs, counted down the body
  const ov = OVERLAP / ky;
  const at = (y0) => (p) => [p[0] * kx, (p[1] - y0) * ky, p[2] * kx];
  console.log(`  torso: ${ky.toFixed(3)} m/stud tall, ${kx} across, neck clipped above ${top.toFixed(2)} studs`);
  const out = WHOLE ? [{ name: "chest__whole", tex: "torso", ...piece(obj, down, -top, Infinity, at(chestY)) }] : [
    { name: "chest__rbx", tex: "torso", ...piece(obj, down, -top, -(waist - ov), at(chestY)) },
    { name: "torso__rbx", tex: "torso", ...piece(obj, down, -(waist + ov), Infinity, at(hipsY)) },
  ];
  const img = readPng(path.join(src, "torso.png"));
  for (const logo of NO_LOGOS ? [] : LOGOS) {
    const found = findLogo(obj, img, logo.at);
    if (!found) { console.log(`  ${logo.name}: no logo found`); continue; }
    found.r = Math.min(found.r * logo.grow, logo.max ?? Infinity);
    // whole below the collar, where the torso is cut
    found.c[1] = Math.min(found.c[1], top - found.r * 1.05);
    console.log(`  ${logo.name}: at ${found.c.map((x) => x.toFixed(2)).join(",")} r ${found.r.toFixed(2)} studs (${found.n} black)`);
    out.push({ name: logo.name, tex: "badge", ...decal(obj, found, logo.back, top, at(chestY)) });
  }
  if (PRINT) {
    const art = readPng(PRINT), [y, w] = PRINT_AT;
    const found = { c: [0, y, 0], r: w / 2, ry: (w / 2) * (art.h / art.w), rect: true };
    console.log(`  chest__print: ${path.basename(PRINT)} at ${y} studs, ${w} wide`);
    out.push({ name: "chest__print", tex: "print", ...decal(obj, found, false, top, at(chestY)) });
  }
  return out;
}

/* ---------------------------------------------------------------- glb */
function writeGlb(file, pieces, images) {
  const bufs = [], views = [], accessors = [], meshes = [], nodes = [], materials = [], textures = [], imgs = [];
  let off = 0;
  const view = (b, target) => {
    const pad = (4 - (b.length % 4)) % 4;
    views.push({ buffer: 0, byteOffset: off, byteLength: b.length, ...(target ? { target } : {}) });
    bufs.push(b, Buffer.alloc(pad)); off += b.length + pad;
    return views.length - 1;
  };
  const texOf = new Map();
  for (const [name, png] of images) {
    imgs.push({ bufferView: view(png), mimeType: "image/png", name });
    textures.push({ source: imgs.length - 1, sampler: 0 });
    materials.push({ name: `rbx-${name}`, pbrMetallicRoughness: { baseColorTexture: { index: textures.length - 1 }, metallicFactor: 0, roughnessFactor: 1 },
      ...(name === "badge" || name === "print" ? { alphaMode: "MASK", alphaCutoff: 0.5 } : {}) });
    texOf.set(name, materials.length - 1);
  }
  for (const p of pieces) {
    const acc = (arr, type, comp, target, minmax) => {
      const v = view(Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength), target);
      const n = type === "SCALAR" ? arr.length : arr.length / (type === "VEC3" ? 3 : 2);
      const a = { bufferView: v, componentType: comp, count: n, type };
      if (minmax) {
        const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < arr.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], arr[i + k]); mx[k] = Math.max(mx[k], arr[i + k]); }
        a.min = mn; a.max = mx;
      }
      accessors.push(a);
      return accessors.length - 1;
    };
    const POSITION = acc(p.pos, "VEC3", 5126, 34962, true);
    const NORMAL = acc(p.nrm, "VEC3", 5126, 34962);
    const TEXCOORD_0 = acc(p.uv, "VEC2", 5126, 34962);
    const indices = acc(p.index, "SCALAR", 5125, 34963);
    meshes.push({ name: p.name, primitives: [{ attributes: { POSITION, NORMAL, TEXCOORD_0 }, indices, material: texOf.get(p.tex) }] });
    nodes.push({ name: p.name, mesh: meshes.length - 1 });
  }
  const json = {
    asset: { version: "2.0", generator: "troll-ops-roblox-body.mjs" },
    scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes, meshes, materials, textures, images: imgs,
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }],
    accessors, bufferViews: views, buffers: [{ byteLength: off }],
  };
  let js = Buffer.from(JSON.stringify(json));
  js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const bin = Buffer.concat(bufs);
  const head = Buffer.alloc(12); head.write("glTF", 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const cj = Buffer.alloc(8); cj.writeUInt32LE(js.length, 0); cj.write("JSON", 4);
  const cb = Buffer.alloc(8); cb.writeUInt32LE(bin.length, 0); cb.write("BIN\0", 4);
  fs.writeFileSync(file, Buffer.concat([head, cj, js, cb, bin]));
  return fs.statSync(file).size;
}

/* ---------------------------------------------------------------- logos */
// Studio draws its own scribbled emblems where the NFT has the trollface
// badge (user, 2026-10-17: "fix the logos"). Each is found on the mesh (the
// black texels on the front left chest, and between the shoulders, in 3D:
// the texture splits a logo across islands) and covered by a decal: the
// torso's own surface there, pushed out a hair, wearing the badge the live
// sensei kit draws (traits/src/clothes-sensei.block.svg: an off-white disc,
// a black ring, the trollface across it). Material "rbx-badge", alpha-masked.
const BADGE_ART = "assets/images/wallpaper/trollface transparent.png";
const LOGOS = [
  // studs: the character's left is -X, its front -Z
  { name: "chest__badge", back: false, at: (c) => c[2] < -0.2 && c[0] < 0 && c[1] > 3.3 && c[1] < 4.5, grow: 1.4 },
  { name: "chest__badge-back", back: true, at: (c) => c[2] > 0.2 && c[1] > 3.6 && c[1] < 4.6, grow: 1.4, max: 0.4 },
];
const mid3 = (ps) => [0, 1, 2].map((k) => (ps[0][k] + ps[1][k] + ps[2][k]) / 3);
function findLogo(obj, img, at) {
  const { w, h, rgba } = img, pts = [];
  const black = (u, v) => {
    const x = Math.min(w - 1, Math.max(0, Math.round(u * w))), y = Math.min(h - 1, Math.max(0, Math.round((1 - v) * h)));
    const i = (y * w + x) * 4;
    // black in every channel: the navy undershirt is dark too, but blue
    return Math.max(rgba[i], rgba[i + 1], rgba[i + 2]) < 50;
  };
  for (const tri of obj.tris) {
    if (tri.some(([, ti]) => ti < 0)) continue;
    const c = mid3(tri.map(([vi]) => obj.v[vi]));
    if (!at(c)) continue;
    const uv = mid3(tri.map(([, ti]) => [...obj.vt[ti], 0]));
    if (black(uv[0], uv[1])) pts.push(c);
  }
  if (pts.length < 4) return null;
  const med = [0, 1, 2].map((k) => pts.map((p) => p[k]).sort((x, y) => x - y)[pts.length >> 1]);
  const near = pts.filter((p) => Math.hypot(p[0] - med[0], p[1] - med[1]) < 0.5);
  const c = [0, 1, 2].map((k) => near.reduce((t, p) => t + p[k], 0) / near.length);
  const ds = near.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1])).sort((x, y) => x - y);
  return { c, r: Math.max(ds[Math.floor(ds.length * 0.9)] || 0, 0.1), n: near.length };
}
/* The decal: the surface's triangles round `logo` (within its radius, on
   its side; `ry` for one taller or shorter than wide), out along the
   smoothed normals, uv a flat projection of the art seen from that side,
   through `xf` like the torso. */
function decal(obj, { c, r, ry = r, rect = false }, back, top, xf) {
  const pos = [], uv = [], index = [], seen = new Map();
  // a round badge takes a disc of surface, a print (rect) its whole box
  const inside = (m) => rect ? Math.abs(m[0] - c[0]) < r * 1.5 && Math.abs(m[1] - c[1]) < ry * 2.5
    : Math.hypot((m[0] - c[0]) / r, (m[1] - c[1]) / ry) < 1.3;
  const pk = (p) => p.map((x) => Math.round(x * 1e4)).join(",");
  const acc = new Map();
  const tris = obj.tris.filter((tri) => {
    const m = mid3(tri.map(([vi]) => obj.v[vi]));
    return (back ? m[2] > 0 : m[2] < 0) && m[1] < top && inside(m);
  });
  for (const tri of tris) {
    const ps = tri.map(([vi]) => obj.v[vi]), n = cross(sub(ps[1], ps[0]), sub(ps[2], ps[0]));
    for (const p of ps) { const k = pk(p), a = acc.get(k) || [0, 0, 0]; acc.set(k, [a[0] + n[0], a[1] + n[1], a[2] + n[2]]); }
  }
  for (const tri of tris) for (const [vi] of tri) {
    const p = obj.v[vi], k = pk(p);
    if (!seen.has(k)) {
      seen.set(k, pos.length / 3);
      const n = acc.get(k), l = len(n) || 1;
      pos.push(...xf([p[0] + n[0] / l * 0.012, p[1] + n[1] / l * 0.012, p[2] + n[2] / l * 0.012]));
      // seen from the front (-Z) the character's left (-X) is on the right
      uv.push((back ? 1 : -1) * (p[0] - c[0]) / (2 * r) + 0.5, 0.5 - (p[1] - c[1]) / (2 * ry));
    }
    index.push(seen.get(k));
  }
  const nrm = new Float32Array(pos.length);
  for (const [k, i] of seen) { const n = acc.get(k), l = len(n) || 1; const q = xf([n[0] / l, n[1] / l, n[2] / l]), o = xf([0, 0, 0]); const d = sub(q, o), dl = len(d) || 1; nrm.set([d[0] / dl, d[1] / dl, d[2] / dl], i * 3); }
  return { pos: new Float32Array(pos), uv: new Float32Array(uv), nrm, index: new Uint32Array(index), caps: 0 };
}
/* The badge drawing, RGBA, see-through outside the disc. */
function badgeImage(size = 256) {
  const A = readPng(BADGE_ART), rgba = Buffer.alloc(size * size * 4);
  const cx = size / 2, r = size / 2 - 2, ring = r * 0.2, iw = r * 1.6, ih = iw * (A.h / A.w);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cx), i = (y * size + x) * 4;
    let col = d > r - ring ? [6, 6, 6] : [246, 244, 238];
    const ax = ((x - cx) / iw + 0.5) * A.w, ay = ((y - cx) / ih + 0.5) * A.h;
    if (d <= r - ring && ax >= 0 && ay >= 0 && ax < A.w && ay < A.h) {
      const j = (Math.floor(ay) * A.w + Math.floor(ax)) * 4, al = A.rgba[j + 3] / 255;
      col = col.map((v, k) => v * (1 - al) + A.rgba[j + k] * al);
    }
    rgba.set([...col.map(Math.round), d <= r ? 255 : 0], i);
  }
  return rgbaPng(size, size, rgba);
}
function rgbaPng(w, h, rgba) {
  const rows = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(rows, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih),
    chunk("IDAT", zlib.deflateSync(rows, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

/* ---------------------------------------------------------------- run */
/* ---------------------------------------------------------------- hands */
// A Studio hand (generate_mesh, one piece, wrist at the bottom, fingers up)
// as the game's hand: the fist's frame (build_blocky_arms fist: the wrist at
// the origin, down -Y, the back of the hand out +X on the right, the thumb
// to the front -Z), the trolls' white (no face or skin colours: user,
// 2026-10-08). `back`: the side the export shows the back of the hand on
// (-1: -Z, toward the export's front camera). `cut`: studs off the bottom
// (the open hand's glove cuff).
const HAND_K = 0.165;   // metres per stud: a cartoon hand a little bigger than the block fist (it starts inside the forearm, FIST_BACK)
const HAND_PARTS = [
  { name: "handR__open", file: "hand_open", back: 1, cut: 0.13 },
  { name: "handR__fist", file: "hand_fist", back: -1, cut: 0.12 },
];
function hands(src) {
  return HAND_PARTS.map(({ name, file, back, cut }) => {
    const obj = readObj(path.join(src, `${file}.obj`));
    let y0 = Infinity, cx = 0, cz = 0;
    for (const p of obj.v) y0 = Math.min(y0, p[1]);
    const wrist = obj.v.filter((p) => p[1] < y0 + cut + 0.05);
    for (const p of wrist) { cx += p[0] / wrist.length; cz += p[2] / wrist.length; }
    // fingers down, the back of the hand turned to +X
    const xf = (p) => {
      const x = p[0] - cx, y = p[1] - (y0 + cut), z = p[2] - cz;
      return [z * back * HAND_K, -y * HAND_K, x * back * HAND_K];   // a turn, not a mirror
    };
    console.log(`  ${name}: ${file}, wrist cut ${cut} studs up`);
    return { name, tex: file, ...piece(obj, (p) => p[1], y0 + cut, Infinity, xf) };
  });
}
// a Studio hand's skin made the trolls' white, its shading kept
function whiten({ w, h, rgba }) {
  const lum = (i) => 0.3 * rgba[i] + 0.59 * rgba[i + 1] + 0.11 * rgba[i + 2];
  const ls = [];
  for (let i = 0; i < rgba.length; i += 4 * 7) if (rgba[i + 3] > 128) ls.push(lum(i));
  ls.sort((a, b) => a - b);
  const ref = ls[Math.floor(ls.length * 0.85)] || 255, out = Buffer.from(rgba);
  for (let i = 0; i < rgba.length; i += 4) { const v = Math.round(Math.min(1, lum(i) / ref) * 244); out[i] = out[i + 1] = out[i + 2] = v; }
  return { w, h, rgba: out };
}

const texture = (name) => {
  if (name === "badge") return [name, badgeImage()];
  if (name.startsWith("hand_")) return [name, indexedPng(quantize(shrink(whiten(readPng(path.join(SRC, `${name}.png`))), 512)))];
  if (name === "print") { const a = readPng(PRINT); return [name, rgbaPng(a.w, a.h, a.rgba)]; }
  const q = quantize(shrink(readPng(path.join(SRC, `${name}.png`)), TEX));
  return [name, indexedPng(q)];
};
fs.mkdirSync(OUT, { recursive: true });
let total = 0;
for (const [kind, build, texNames] of HANDS ? [["hands", hands, HAND_PARTS.map((h) => h.file)]] : [
  ...(ARMS ? [["arms", arms, ["left_arm", "right_arm"]]] : []),
  ["legs", legs, ["left_leg", "right_leg"]],
  ["torso", torso, [...(NO_LOGOS ? ["torso"] : ["torso", "badge"]), ...(PRINT ? ["print"] : [])]],
]) {
  console.log(`${kind}:`);
  const pieces = build(SRC);
  const file = path.join(OUT, `${kind}-${ID}.glb`);
  const size = writeGlb(file, pieces, texNames.map(texture));
  total += size;
  for (const p of pieces) console.log(`    ${p.name.padEnd(14)} ${(p.index.length / 3).toString().padStart(5)} tris, ${p.caps} capped`);
  console.log(`  -> ${file} ${(size / 1024).toFixed(0)} KB`);
}
console.log(`total ${(total / 1024 / 1024).toFixed(2)} MB`);
