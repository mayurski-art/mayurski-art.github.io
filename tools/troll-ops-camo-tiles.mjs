// Troll Warfare camo tiles (docs/DESIGN-SKINS.md §3.3): every camo is a
// seamless 512² tile, R = tone index (4 bands, 0/85/170/255), G = detail
// (fibre, speckle, seams: roughness and the mastery sheen), B unused, plus
// a palette of four colours per camo in characters/skins.js CAMOS. The
// tiles are drawn on a torus (every noise lattice wraps, every stamp is
// drawn nine times), so they repeat without a seam. One tile = 12 cm on
// the gun by default (0.23 mm a pixel).
//
// Writes assets/games/troll-ops/skins/tiles/<id>.png (lossless: the tone channel is stepped) and, with
// SHEET=<file>, a coloured swatch sheet of every camo for review.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-camo-tiles.mjs
//        [SHEET=assets/games/troll-ops/docs/skins/camo-swatches.webp] [ONLY=a,b]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TILES = path.join(ROOT, "assets/games/troll-ops/skins/tiles");
fs.mkdirSync(TILES, { recursive: true });
// the mascot's line art for Grinwrap (never the Unicode glyph)
const GRIN = `data:image/png;base64,${fs.readFileSync(path.join(ROOT, "assets/images/icons/favicon/grin.png")).toString("base64")}`;

// id, name, level, pattern (+ its knobs), palette (tone 0..3), feel
export const CAMOS = [
  { id: "grinwood", name: "Grinwood", level: 4, pattern: "blotch", seed: 11,
    palette: ["#55633b", "#a2906a", "#6a553a", "#1f2119"] },
  { id: "dustlip", name: "Dust Lip", level: 8, pattern: "digital", seed: 23,
    palette: ["#c6b083", "#d9d2bf", "#a48c61", "#86704f"] },
  { id: "concretejaw", name: "Concrete Jaw", level: 12, pattern: "blotch", seed: 37, scale: 0.8,
    palette: ["#8a8b86", "#b4b5b0", "#5c5e5a", "#262726"] },
  { id: "tigertooth", name: "Tiger Tooth", level: 16, pattern: "stripe", seed: 41,
    palette: ["#b5642a", "#cf8a47", "#6b3d1b", "#1a1411"] },
  { id: "nightcap", name: "Nightcap", level: 20, pattern: "digital", seed: 53, scale: 1.3,
    palette: ["#141516", "#2c2e31", "#1d1f22", "#3d4248"] },
  { id: "hexgrin", name: "Hex Grin", level: 24, pattern: "hex", seed: 67,
    palette: ["#1e3858", "#3b6a9d", "#27507c", "#0b0e13"] },
  { id: "snowblind", name: "Snowblind", level: 28, pattern: "blotch", seed: 71, scale: 1.1,
    palette: ["#eef0f1", "#c5cbd0", "#a7c6da", "#dde4e8"] },
  { id: "grinwrap", name: "Grinwrap", level: 30, pattern: "grin", seed: 83, size: 1024,
    palette: ["#0e0e10", "#f3f3f0", "#8a8a88", "#0e0e10"] },
];

// Runs in the page: draws one camo into a 512² ImageData (tone, detail) and
// returns the tile and a coloured swatch as data URLs.
const PAGE = `<!doctype html><meta charset="utf-8"><canvas id="t" width="512" height="512"></canvas><canvas id="s"></canvas>
<script>
let N = 512;                                 // a camo may draw finer (size: 1024)
// a lattice hash that wraps at period P
function hash(ix, iy, seed, P) {
  ix = ((ix % P) + P) % P; iy = ((iy % P) + P) % P;
  let h = (ix * 374761393 + iy * 668265263 + seed * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const sm = (t) => t * t * (3 - 2 * t);
// value noise with period P pixels (P divides N), 0..1
function vnoise(x, y, P, seed) {
  const cell = N / P;                       // P lattice cells across the tile
  const fx = x / cell, fy = y / cell;
  const ix = Math.floor(fx), iy = Math.floor(fy);
  const tx = sm(fx - ix), ty = sm(fy - iy);
  const a = hash(ix, iy, seed, P), b = hash(ix + 1, iy, seed, P), c = hash(ix, iy + 1, seed, P), d = hash(ix + 1, iy + 1, seed, P);
  return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
}
// fbm: lattice cells across the tile double each octave; 0..1 centred on 0.5
function fbm(x, y, cells, oct, seed, gain = 0.5) {
  let v = 0, amp = 1, sum = 0, p = cells;
  // (whole cell counts only: a fractional lattice would not wrap)
  for (let i = 0; i < oct; i++) { v += amp * vnoise(x, y, Math.max(1, Math.round(p)), seed + i * 7); sum += amp; amp *= gain; p *= 2; }
  return v / sum;
}
// fine detail for G: fibre grain + a few speckles
function detail(x, y, seed) {
  const g = fbm(x, y, 64, 3, seed + 900);
  const sp = hash(x, y, seed + 901, N) > 0.993 ? 1 : 0;
  return Math.min(1, 0.35 + (g - 0.5) * 1.6 + sp * 0.6);
}

// blotch: three layers of organic blobs over a base tone, each a thresholded
// fbm; the layer order puts the small dark blobs on top (woodland reads that way)
function blotch(x, y, s, scale) {
  const c = 4 * scale;                       // ~4 big blobs across: 3-5 cm at 12 cm a tile
  let tone = 0;
  if (fbm(x, y, c, 3, s + 1) > 0.56) tone = 1;        // light, large
  if (fbm(x, y, c * 1.5, 3, s + 20) > 0.58) tone = 2;  // mid
  if (fbm(x, y, c * 2, 3, s + 40) > 0.6) tone = 3;     // dark, small
  return tone;
}
// digital: the blotch field read at the centre of 8 px cells (2 mm), with a
// per-cell jitter so the blob edges break into a pixel fringe
function digital(x, y, s, scale) {
  const C = 8;
  const cx = Math.floor(x / C) * C + C / 2, cy = Math.floor(y / C) * C + C / 2;
  const j = (hash(cx, cy, s + 500, N) - 0.5) * 0.12;
  const c = 3 * scale;
  let tone = 0;
  if (fbm(cx, cy, c, 2, s + 1) + j > 0.55) tone = 1;
  if (fbm(cx, cy, c * 1.6, 2, s + 20) + j > 0.57) tone = 2;
  if (fbm(cx, cy, c * 2.2, 2, s + 40) - j > 0.6) tone = 3;
  return tone;
}
// stripe: torn tiger stripes, 1.5 cm wide, running at a slant and wobbling,
// breaking where a noise field says the brush lifted; a secondary soft blotch
function stripe(x, y, s) {
  const W = 56;                                              // stripe pitch, px
  const wob = (fbm(x, y, 4, 3, s + 3) - 0.5) * 70;
  const t = (y + x * 0.35 + wob) / W;
  const band = t - Math.floor(t);
  const lift = fbm(x, y, 6, 2, s + 9);                       // where stripes thin and break
  const duty = 0.22 + (lift - 0.5) * 0.5;
  let tone = fbm(x, y, 3, 2, s + 30) > 0.57 ? 1 : 0;         // light blotches on the base
  if (fbm(x, y, 5, 2, s + 31) > 0.62) tone = 2;              // brown
  const edge = fbm(x, y, 48, 2, s + 12) - 0.5;               // jagged stripe edge
  if (Math.abs(band - 0.5) < duty / 2 + edge * 0.12) tone = 3;
  return tone;
}
// hex: pointy-top cells about 5 mm across; tone from a smooth field plus a
// per-cell flip, a dark seam between cells (also into the detail channel)
const HX = 24, HY = 28;                                      // cells across, rows (wraps at N)
function hexOf(x, y) {
  const w = N / HX, vp = N / HY, h = vp / 0.75;
  const row = Math.floor(y / vp);
  const off = (row % 2) ? w / 2 : 0;
  // nearest of the two candidate centres (this row's column and the row above/below)
  let best = null;
  for (let r = row - 1; r <= row + 1; r++) {
    const o = (((r % 2) + 2) % 2) ? w / 2 : 0;
    const col = Math.round((x - o) / w);
    const cx = col * w + o, cy = r * vp;
    const dx = x - cx, dy = (y - cy) * (w / h) * (2 / 1.732);
    const d = Math.hypot(dx, dy);
    if (!best || d < best.d) best = { d, cx, cy, r, col, dx, dy };
  }
  return { ...best, w };
}
function hex(x, y, s) {
  const c = hexOf(x, y);
  // hex edge distance (pointy top): max over the three axes
  const ax = Math.abs(c.dx), ay = Math.abs(c.dy);
  const e = Math.max(ax, ax * 0.5 + ay * 0.866) / (c.w / 2);
  const seam = e > 0.86;
  const f = fbm(c.cx, c.cy, 3, 2, s + 1) + (hash(c.col, c.r, s + 77, 4096) - 0.5) * 0.25;
  let tone = f > 0.56 ? 1 : f > 0.47 ? 2 : 0;
  if (seam) tone = 3;
  return { tone, seam };
}

async function draw(camo) {
  N = camo.size || 512;
  const s = camo.seed, scale = camo.scale || 1;
  const tc = document.getElementById("t"), tg = tc.getContext("2d");
  tc.width = tc.height = N;
  const img = tg.createImageData(N, N), d = img.data;
  let grinMask = null;
  if (camo.pattern === "grin") {
    // the mascot's outline, stamped at random spots and angles, nine times
    // each so it wraps; two sizes (3 cm and 2 cm), ink only
    const im = new Image(); im.src = GRIN; await im.decode();
    const c2 = document.createElement("canvas"); c2.width = N; c2.height = N;
    const g = c2.getContext("2d");
    const stamps = [];
    for (let i = 0; i < 14; i++) {
      const size = (i < 6 ? 128 : 86) * N / 512;
      let p, tries = 0;
      do { p = [hash(i, 1, s, 997) * N, hash(i, 2, s, 997) * N]; tries++; }
      while (tries < 20 && stamps.some((q) => Math.hypot(((p[0] - q[0] + N * 1.5) % N) - N / 2, ((p[1] - q[1] + N * 1.5) % N) - N / 2) < (size + q[2]) * 0.42));
      stamps.push([p[0], p[1], size, (hash(i, 3, s, 997) - 0.5) * 1.6]);
    }
    for (const [x, y, size, rot] of stamps) for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      g.save(); g.translate(x + ox * N, y + oy * N); g.rotate(rot);
      g.drawImage(im, -size / 2, -size / 2, size, size); g.restore();
    }
    const px = g.getImageData(0, 0, N, N).data;
    // ink = the dark pixels of the art where it was drawn (alpha); the face's
    // white fill and the untouched tile both stay tone 0, so only the line
    // art shows (the canvas starts transparent on purpose)
    grinMask = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) grinMask[i] = px[i * 4 + 3] > 40 && (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) < 330 ? 1 : 0;
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let tone, det = detail(x, y, s);
    if (camo.pattern === "blotch") tone = blotch(x, y, s, scale);
    else if (camo.pattern === "digital") tone = digital(x, y, s, scale);
    else if (camo.pattern === "stripe") tone = stripe(x, y, s);
    else if (camo.pattern === "hex") { const h = hex(x, y, s); tone = h.tone; if (h.seam) det = 0.05; }
    else tone = grinMask[y * N + x];
    const i = (y * N + x) * 4;
    d[i] = tone * 85; d[i + 1] = Math.round(det * 255); d[i + 2] = 0; d[i + 3] = 255;
  }
  tg.putImageData(img, 0, 0);
  // the coloured swatch: palette by tone, the detail channel as a faint grain,
  // 1.5 tiles across so the wrap shows
  const S = 384, sc = document.getElementById("s"); sc.width = S; sc.height = S;
  const sg = sc.getContext("2d"), sw = sg.createImageData(S, S), e = sw.data;
  const pal = camo.palette.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const tx = Math.floor(x * 1.5 * N / 512) % N, ty = Math.floor(y * 1.5 * N / 512) % N;
    const i = (ty * N + tx) * 4, o = (y * S + x) * 4;
    const tone = Math.round(d[i] / 85), g = 0.92 + (d[i + 1] / 255 - 0.35) * 0.16;
    e[o] = pal[tone][0] * g; e[o + 1] = pal[tone][1] * g; e[o + 2] = pal[tone][2] * g; e[o + 3] = 255;
  }
  sg.putImageData(sw, 0, 0);
  // png: the tone channel is stepped and a lossy webp would ring at the steps
  return { tile: tc.toDataURL("image/png"), swatch: sc.toDataURL("image/png") };
}
window.draw = draw;
</script>`;

const only = process.env.ONLY?.split(",");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
await page.setContent(PAGE.replace("let N = 512;", `const GRIN = "${GRIN}";\nlet N = 512;`));
const swatches = [];
for (const camo of CAMOS) {
  if (only && !only.includes(camo.id)) continue;
  const { tile, swatch } = await page.evaluate((c) => window.draw(c), camo);
  const f = path.join(TILES, `${camo.id}.png`);
  fs.writeFileSync(f, Buffer.from(tile.split(",")[1], "base64"));
  console.log(`${camo.id.padEnd(12)} ${(fs.statSync(f).size / 1024).toFixed(0)} KB`);
  swatches.push([camo, swatch]);
}
if (process.env.SHEET) {
  const url = await page.evaluate(async (rows) => {
    const S = 384, COLS = 4, ROWS = Math.ceil(rows.length / COLS), PAD = 14, LBL = 46;
    const c = document.createElement("canvas");
    c.width = COLS * (S + PAD) + PAD; c.height = ROWS * (S + LBL + PAD) + PAD;
    const g = c.getContext("2d");
    g.fillStyle = "#1c1c1e"; g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < rows.length; i++) {
      const [camo, src] = rows[i];
      const im = new Image(); im.src = src; await im.decode();
      const x = PAD + (i % COLS) * (S + PAD), y = PAD + Math.floor(i / COLS) * (S + LBL + PAD);
      g.drawImage(im, x, y, S, S);
      g.fillStyle = "#f5f5f7"; g.font = "600 18px system-ui"; g.fillText(camo.name, x, y + S + 22);
      g.fillStyle = "#9a9a9e"; g.font = "14px system-ui";
      g.fillText(`${camo.level === 30 ? "Mastery, level 30" : "Weapon level " + camo.level}  ·  ${camo.pattern}  ·  1.5 tiles across (12 cm a tile)`, x, y + S + 40);
      for (let k = 0; k < 4; k++) { g.fillStyle = camo.palette[k]; g.fillRect(x + S - 4 * 22 + k * 22, y + S + 8, 18, 18); }
    }
    return c.toDataURL("image/webp", 0.9);
  }, swatches);
  fs.writeFileSync(path.join(ROOT, process.env.SHEET), Buffer.from(url.split(",")[1], "base64"));
  console.log("sheet:", process.env.SHEET);
}
await browser.close();
