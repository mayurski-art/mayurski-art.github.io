// Troll Forces — trace a gun's side outline off a side-on reference image,
// for weapon-traced.js specs (weapon-smgs.js, weapon-snipers.js,
// weapon-ars.js).
//
// It masks the gun off its background (alpha, or distance from the border
// colour, or darkness), wipes boxes you name (optics, grips, slings,
// labels), keeps the biggest piece, fills specks, and walks the edge with
// marching squares into closed outlines simplified by Douglas-Peucker.
// Every coordinate it prints is a pixel of the prepared reference it saves
// (after --scale, --rotate and --crop), so the spec and the compare tool
// (troll-ops-gun-compare.mjs) work in the same pixels.
//
// Usage:
//   NODE_PATH=<main checkout>/node_modules node tools/troll-ops-trace.mjs <image> --out <dir/name>
//     [--mode auto|alpha|bg|dark] [--t 40] [--alpha 128] [--scale 2] [--rotate -3.5]
//     [--crop x0,y0,x1,y1] [--wipe x0,y0,x1,y1 | --wipe "x,y x,y x,y ..."]...
//     [--cut box|poly]...   (removed from the body only, e.g. the mag)
//     [--part name=box|poly]...   (traced on its own: the mag, furniture)
//     [--close 1] [--min-hole 30] [--eps 1.2] [--grid 50]
//     [--persp 1.3,1 [--persp-y 230]]   (undo a render's perspective: the
//       near end shows magnified by 1.3 at the left edge, 1 at the right,
//       about the bore line; both length and height are scaled back)
// Writes <name>-ref.png (the prepared reference), <name>-grid.png (outlines
// and a labelled grid over it) and <name>.json (outer, holes, parts, pxLen).

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

/* ---------------------------------------------------------------- args */

const argv = process.argv.slice(2);
const opt = { debugMask: 0, mode: "auto", t: 40, alpha: 128, persp: null, perspY: null, scale: 1, rotate: 0, crop: null, wipe: [], cut: [], part: [], close: 0, minHole: 30, eps: 1.2, grid: 50, out: null };
let image = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith("--")) { image = a; continue; }
  const k = a.slice(2).replace(/-(\w)/g, (_, c) => c.toUpperCase());
  const v = argv[++i];
  if (k === "wipe" || k === "cut") opt[k].push(shape(v));
  else if (k === "part") { const [n, s] = v.split("="); opt.part.push({ name: n, shape: shape(s) }); }
  else if (k === "crop" || k === "persp") opt[k] = v.split(",").map(Number);
  else if (k === "mode" || k === "out") opt[k] = v;
  else opt[k] = Number(v);
}
if (!image || !opt.out) { console.error("usage: troll-ops-trace.mjs <image> --out <dir/name> [options]"); process.exit(2); }

/* A box "x0,y0,x1,y1" or a polygon "x,y x,y x,y ...". */
function shape(s) {
  const pts = s.trim().split(/\s+/).map((p) => p.split(",").map(Number));
  if (pts.length === 1 && pts[0].length === 4) { const [x0, y0, x1, y1] = pts[0]; return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; }
  return pts;
}

/* ----------------------------------------------------- decode in a page */

const browser = await chromium.launch();
const page = await browser.newPage();
const ext = path.extname(image).toLowerCase();
const head = fs.readFileSync(image).subarray(0, 12).toString("latin1");
const mime = head.includes("WEBP") ? "image/webp" : head.includes("PNG") ? "image/png" : ext === ".gif" ? "image/gif" : "image/jpeg";
const dataUrl = `data:${mime};base64,${fs.readFileSync(image).toString("base64")}`;
const prepared = await page.evaluate(async ({ dataUrl, scale, rotate, crop }) => {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const w0 = img.naturalWidth * scale, h0 = img.naturalHeight * scale;
  const r = (rotate * Math.PI) / 180, c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r));
  const W = Math.round(w0 * c + h0 * s), H = Math.round(w0 * s + h0 * c);
  const a = document.createElement("canvas");
  a.width = W; a.height = H;
  const g = a.getContext("2d");
  g.imageSmoothingQuality = "high";
  g.translate(W / 2, H / 2); g.rotate(r); g.drawImage(img, -w0 / 2, -h0 / 2, w0, h0);
  let [x0, y0, x1, y1] = crop || [0, 0, W, H];
  const b = document.createElement("canvas");
  b.width = x1 - x0; b.height = y1 - y0;
  b.getContext("2d").drawImage(a, -x0, -y0);
  const d = b.getContext("2d").getImageData(0, 0, b.width, b.height).data;
  let bin = "";
  for (let i = 0; i < d.length; i += 8192) bin += String.fromCharCode.apply(null, d.subarray(i, i + 8192));
  return { w: b.width, h: b.height, rgba: btoa(bin), png: b.toDataURL("image/png") };
}, { dataUrl, scale: opt.scale, rotate: opt.rotate, crop: opt.crop });
let { w: W, h: H } = prepared;
let px = Buffer.from(prepared.rgba, "base64");

/* Perspective undone: a three-quarter render magnifies the near end. With
   m(x) running linearly from mL (left edge) to mR (right edge), the true
   length to x is the integral of 1/m, and heights about the bore line
   shrink by 1/m(x). Resampled bilinearly into a new image. */
if (opt.persp) {
  const [mL, mR] = opt.persp, cy = opt.perspY ?? H / 2, dm = mR - mL;
  const m = (x) => mL + (dm * x) / W;
  const u = (x) => (Math.abs(dm) < 1e-6 ? x / mL : (W / dm) * Math.log(m(x) / mL));
  const xOf = (uu) => (Math.abs(dm) < 1e-6 ? uu * mL : ((mL * Math.exp((uu * dm) / W) - mL) * W) / dm);
  const Wn = Math.round(u(W)), out = Buffer.alloc(Wn * H * 4);
  const sample = (x, y, c) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const g = (xx, yy) => (xx < 0 || yy < 0 || xx >= W || yy >= H ? 0 : px[(yy * W + xx) * 4 + c]);
    return g(x0, y0) * (1 - fx) * (1 - fy) + g(x0 + 1, y0) * fx * (1 - fy) + g(x0, y0 + 1) * (1 - fx) * fy + g(x0 + 1, y0 + 1) * fx * fy;
  };
  for (let v = 0; v < H; v++) for (let uu = 0; uu < Wn; uu++) {
    const x = xOf(uu + 0.5) - 0.5, y = cy + (v + 0.5 - cy) * m(x + 0.5) - 0.5;
    for (let c = 0; c < 4; c++) out[(v * Wn + uu) * 4 + c] = Math.round(sample(x, y, c));
  }
  W = Wn; px = out;
  prepared.png = await page.evaluate(({ b64, W, H }) => {
    const bin = atob(b64), a = new Uint8ClampedArray(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    c.getContext("2d").putImageData(new ImageData(a, W, H), 0, 0);
    return c.toDataURL("image/png");
  }, { b64: px.toString("base64"), W, H });
}
fs.mkdirSync(path.dirname(opt.out), { recursive: true });
fs.writeFileSync(`${opt.out}-ref.png`, Buffer.from(prepared.png.split(",")[1], "base64"));

/* ---------------------------------------------------------------- mask */

const idx = (x, y) => y * W + x;
let mode = opt.mode;
const border = [];
for (let x = 0; x < W; x++) border.push(idx(x, 0), idx(x, H - 1));
for (let y = 0; y < H; y++) border.push(idx(0, y), idx(W - 1, y));
if (mode === "auto") mode = border.filter((i) => px[i * 4 + 3] < 250).length > border.length * 0.5 ? "alpha" : "bg";
const med = (arr) => { const s = [...arr].sort((a, b) => a - b); return s[s.length >> 1]; };
const bg = [0, 1, 2].map((c) => med(border.map((i) => px[i * 4 + c])));
let mask = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) {
  const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2], al = px[i * 4 + 3];
  if (mode === "alpha") mask[i] = al > opt.alpha ? 1 : 0;
  else if (mode === "dark") mask[i] = al > 128 && 0.299 * r + 0.587 * g + 0.114 * b < opt.t ? 1 : 0;
  else mask[i] = al > 128 && Math.hypot(r - bg[0], g - bg[1], b - bg[2]) > opt.t ? 1 : 0;
}

function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function paint(m, poly, v) {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(H - 1, Math.ceil(Math.max(...ys))); y++)
    for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(W - 1, Math.ceil(Math.max(...xs))); x++)
      if (inPoly(x + 0.5, y + 0.5, poly)) m[idx(x, y)] = v;
}
for (const p of opt.wipe) paint(mask, p, 0);

/* square max/min filter: dilate then erode closes cracks and specks */
function morph(m, r, dilate) {
  const out = new Uint8Array(m.length), tmp = new Uint8Array(m.length);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = dilate ? 0 : 1;
    for (let k = -r; k <= r; k++) { const xx = Math.min(W - 1, Math.max(0, x + k)); v = dilate ? v | m[idx(xx, y)] : v & m[idx(xx, y)]; }
    tmp[idx(x, y)] = v;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = dilate ? 0 : 1;
    for (let k = -r; k <= r; k++) { const yy = Math.min(H - 1, Math.max(0, y + k)); v = dilate ? v | tmp[idx(x, yy)] : v & tmp[idx(x, yy)]; }
    out[idx(x, y)] = v;
  }
  return out;
}
if (opt.close > 0) mask = morph(morph(mask, opt.close, true), opt.close, false);

/* the biggest 8-connected piece of `m`, with background specks smaller than
   minHole filled in */
function mainPiece(m) {
  const lab = new Int32Array(W * H), stack = [];
  let best = 0, bestN = 0, n = 0;
  for (let s = 0; s < W * H; s++) {
    if (!m[s] || lab[s]) continue;
    n++; let count = 0; stack.push(s); lab[s] = n;
    while (stack.length) {
      const i = stack.pop(); count++;
      const x = i % W, y = (i / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = idx(xx, yy);
        if (m[j] && !lab[j]) { lab[j] = n; stack.push(j); }
      }
    }
    if (count > bestN) { bestN = count; best = n; }
  }
  const out = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) out[i] = lab[i] === best ? 1 : 0;
  // background pieces (4-connected) that don't reach the edge and are small
  const seen = new Uint8Array(W * H);
  for (let s = 0; s < W * H; s++) {
    if (out[s] || seen[s]) continue;
    const comp = []; let edge = false; stack.push(s); seen[s] = 1;
    while (stack.length) {
      const i = stack.pop(); comp.push(i);
      const x = i % W, y = (i / W) | 0;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) edge = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = idx(xx, yy);
        if (!out[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
      }
    }
    if (!edge && comp.length < opt.minHole) for (const i of comp) out[i] = 1;
  }
  return out;
}

/* marching squares over a 0/1 mask: every closed outline, in image pixels */
function outlines(m) {
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : m[idx(x, y)]);
  const adj = new Map();
  const key = (a, b) => a * 100003 + b;
  const link = (p, q) => {
    const kp = key(...p), kq = key(...q);
    if (!adj.has(kp)) adj.set(kp, { p, n: [] });
    if (!adj.has(kq)) adj.set(kq, { p: q, n: [] });
    adj.get(kp).n.push(kq); adj.get(kq).n.push(kp);
  };
  for (let y = -1; y < H; y++) for (let x = -1; x < W; x++) {
    const tl = at(x, y), tr = at(x + 1, y), br = at(x + 1, y + 1), bl = at(x, y + 1);
    const c = tl * 8 + tr * 4 + br * 2 + bl;
    if (c === 0 || c === 15) continue;
    // edge midpoints between pixel centres, in doubled pixel units
    const T = [2 * x + 2, 2 * y + 1], B = [2 * x + 2, 2 * y + 3], L = [2 * x + 1, 2 * y + 2], R = [2 * x + 3, 2 * y + 2];
    const segs = { 1: [[L, B]], 2: [[B, R]], 3: [[L, R]], 4: [[T, R]], 5: [[L, T], [R, B]], 6: [[T, B]], 7: [[T, L]],
      8: [[T, L]], 9: [[T, B]], 10: [[T, R], [L, B]], 11: [[T, R]], 12: [[L, R]], 13: [[R, B]], 14: [[L, B]] }[c];
    for (const [p, q] of segs) link(p, q);
  }
  const loops = [], used = new Set();
  for (const [k0] of adj) {
    if (used.has(k0)) continue;
    const loop = []; let prev = null, k = k0;
    while (k !== undefined && !used.has(k)) {
      used.add(k);
      const node = adj.get(k);
      loop.push([node.p[0] / 2, node.p[1] / 2]);
      const next = node.n.find((q) => q !== prev && !used.has(q));
      prev = k; k = next;
    }
    if (loop.length > 2) loops.push(loop);
  }
  return loops;
}
const area = (l) => { let a = 0; for (let i = 0; i < l.length; i++) { const [x0, y0] = l[i], [x1, y1] = l[(i + 1) % l.length]; a += x0 * y1 - x1 * y0; } return Math.abs(a / 2); };

function dp(pts, eps) {
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  const len = Math.hypot(bx - ax, by - ay) || 1;
  let far = 0, fi = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / len;
    if (d > far) { far = d; fi = i; }
  }
  if (far <= eps) return [pts[0], pts[pts.length - 1]];
  return [...dp(pts.slice(0, fi + 1), eps).slice(0, -1), ...dp(pts.slice(fi), eps)];
}
function simplify(loop) {
  let fi = 0, far = 0;
  for (let i = 1; i < loop.length; i++) { const d = Math.hypot(loop[i][0] - loop[0][0], loop[i][1] - loop[0][1]); if (d > far) { far = d; fi = i; } }
  const a = dp(loop.slice(0, fi + 1), opt.eps), b = dp([...loop.slice(fi), loop[0]], opt.eps);
  const out = [...a.slice(0, -1), ...b.slice(0, -1)].map(([x, y]) => [Math.round(x), Math.round(y)]);
  return out.filter((p, i) => i === 0 || p[0] !== out[i - 1][0] || p[1] !== out[i - 1][1]);
}
const str = (l) => l.map((p) => p.join(",")).join(" ");

if (opt.debugMask) {   // --debug-mask 1: the mask as a black-on-white PNG
  const b64 = Buffer.from(mask.map((v) => (v ? 0 : 255))).toString("base64");
  const png = await page.evaluate(({ b64, W, H }) => {
    const bin = atob(b64), a = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) { const v = bin.charCodeAt(i); a[i * 4] = a[i * 4 + 1] = a[i * 4 + 2] = v; a[i * 4 + 3] = 255; }
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    c.getContext("2d").putImageData(new ImageData(a, W, H), 0, 0);
    return c.toDataURL("image/png");
  }, { b64, W, H });
  fs.writeFileSync(`${opt.out}-mask.png`, Buffer.from(png.split(",")[1], "base64"));
}

/* ---------------------------------------------------------------- trace */

const body = mask.slice();
for (const p of opt.cut) paint(body, p, 0);
const bodyMain = mainPiece(body);
const loops = outlines(bodyMain).sort((a, b) => area(b) - area(a));
const outer = simplify(loops[0]);
const holes = loops.slice(1).filter((l) => area(l) >= opt.minHole).map(simplify).filter((l) => l.length >= 3);
const parts = {};
for (const { name, shape: s } of opt.part) {
  const region = new Uint8Array(W * H);
  paint(region, s, 1);
  const m = mask.map((v, i) => v & region[i]);
  const pl = outlines(mainPiece(m)).sort((a, b) => area(b) - area(a));
  if (pl.length) parts[name] = str(simplify(pl[0]));
}
const xs = outer.map((p) => p[0]), ys = outer.map((p) => p[1]);
const result = { image: path.basename(image), width: W, height: H, mode, bg, pxLen: [Math.min(...xs), Math.max(...xs)],
  bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], points: outer.length,
  outer: str(outer), holes: holes.map(str), parts };
fs.writeFileSync(`${opt.out}.json`, JSON.stringify(result, null, 1));

/* ----------------------------------------------------- the grid picture */

const grid = await page.evaluate(async ({ png, W, H, outer, holes, parts, wipe, cut, step }) => {
  const img = new Image(); img.src = png; await img.decode();
  const k = Math.max(1, Math.round(1400 / W));   // blow small references up so the labels read
  const c = document.createElement("canvas"); c.width = W * k; c.height = H * k;
  const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  g.imageSmoothingEnabled = false;
  g.drawImage(img, 0, 0, W * k, H * k);
  g.lineWidth = 1;
  for (let x = 0; x <= W; x += step / 5) { g.strokeStyle = x % step ? "rgba(0,120,255,0.12)" : "rgba(0,120,255,0.45)"; g.beginPath(); g.moveTo(x * k, 0); g.lineTo(x * k, H * k); g.stroke(); }
  for (let y = 0; y <= H; y += step / 5) { g.strokeStyle = y % step ? "rgba(0,120,255,0.12)" : "rgba(0,120,255,0.45)"; g.beginPath(); g.moveTo(0, y * k); g.lineTo(W * k, y * k); g.stroke(); }
  g.font = `${11}px monospace`; g.fillStyle = "#0057d9";
  for (let x = 0; x <= W; x += step) g.fillText(String(x), x * k + 2, 11);
  for (let y = step; y <= H; y += step) g.fillText(String(y), 2, y * k - 2);
  const poly = (s, color, w = 1.5, dash = []) => {
    const pts = s.trim().split(/\s+/).map((p) => p.split(",").map(Number));
    g.strokeStyle = color; g.lineWidth = w; g.setLineDash(dash); g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k)));
    g.closePath(); g.stroke(); g.setLineDash([]);
  };
  poly(outer, "#ff2d55", 2);
  holes.forEach((h) => poly(h, "#007aff", 2));
  Object.values(parts).forEach((p) => poly(p, "#34c759", 2));
  wipe.forEach((p) => poly(p.map((q) => q.join(",")).join(" "), "#ff9500", 1, [4, 3]));
  cut.forEach((p) => poly(p.map((q) => q.join(",")).join(" "), "#5856d6", 1, [4, 3]));
  return c.toDataURL("image/png");
}, { png: prepared.png, W, H, outer: result.outer, holes: result.holes, parts, wipe: opt.wipe, cut: opt.cut, step: opt.grid });
fs.writeFileSync(`${opt.out}-grid.png`, Buffer.from(grid.split(",")[1], "base64"));
await browser.close();
console.log(`${opt.out}: ${W}x${H} ${mode} bg=${bg.join(",")} outer ${outer.length} pts, ${holes.length} holes, parts ${Object.keys(parts).join(",") || "-"}, pxLen ${result.pxLen.join("-")}, bbox ${result.bbox.join(",")}`);
