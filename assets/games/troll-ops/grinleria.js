// Troll Forces — "The Grinleria", a Houston mall map.
//
// The Galleria, trolled: a two-level mall round an ice rink under a glass
// barrel vault. Escalators at both ends of the atrium climb to the end
// decks; the upper concourses ring the vault, joined by a bridge over the
// ice. Twenty shopfronts (parody names), service corridors behind them,
// Neiman Narcus anchoring the west wing, the food court round Trollface
// Falls (the trollface carved in stone over a waterfall) in the east, the valet drive outside to the north and the
// garage's ground level to the south. Teams spawn in the wings and out by
// their street doors. 112 x 80 m.
//
// The shape lives in grinleria-layout.js, shared with
// models/build_grinleria.blender.py: every collider here is a solid there,
// drawn by the gl-*.glb models. This file lays the colliders and adds what
// a static model can't be: glass, the painted ice, the signs (one canvas
// atlas), the waterfall and the lights. Lights are all made here at
// load; nothing adds one at runtime (see light-pool.js).

import * as THREE from "three";
import { GL, STORES, WINGS, STALLS, KIOSKS, grinleriaLayout } from "./grinleria-layout.js";
import { mapModel } from "./map-models.js?v=hg6c";
import { palmTrees } from "./map-dressing.js?v=hg6c";

const TROLLFACE_URL = new URL("../../images/wallpaper/trollface%20transparent.png", import.meta.url).href;

/* ================================================================ helpers */

/* A mesh that runs `fn` every frame it's drawn (never culled). */
function ticker(fn) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.001, 0.001), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  m.frustumCulled = false;
  m.onBeforeRender = fn;
  return m;
}

/* Collects quads into one BufferGeometry (for glass: one draw for all). */
class QuadBatch {
  constructor() { this.pos = []; this.uv = []; }
  quad(a, b, c, d, uv = [[0, 0], [1, 0], [1, 1], [0, 1]]) {
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const p = [a, b, c, d][i];
      this.pos.push(p[0], p[1], p[2]);
      this.uv.push(...uv[i]);
    }
  }
  /* Upright rectangle from (x0, z0) to (x1, z1), y0 .. y1. */
  wall(x0, z0, x1, z1, y0, y1) {
    this.quad([x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0]);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeVertexNormals();
    return g;
  }
}

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/* =================================================================== ice */

/* The rink's surface: white ice, red centre line, blue lines, face-off
   circles and the trollface at centre ice. Painted on a canvas once per page. */
let iceTex = null;
function iceTexture() {
  if (iceTex) return iceTex;
  const R = GL.rink, W = 2048, H = Math.round(W * (R.z1 - R.z0) / (R.x1 - R.x0));
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const m = W / (R.x1 - R.x0);                    // px per metre
  const X = (x) => (x - R.x0) * m, Z = (z) => (z - R.z0) * m;
  const draw = (face) => {
    g.fillStyle = "#eef4f8";
    g.fillRect(0, 0, W, H);
    // skate scuffs: faint arcs
    g.globalAlpha = 0.08;
    g.strokeStyle = "#9fb4c4";
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 260; i++) {
      g.lineWidth = 1 + rnd() * 2;
      g.beginPath();
      const r = 20 + rnd() * 160;
      const cx = rnd() * W, cy = rnd() * H, a = rnd() * 6.28;
      g.arc(cx, cy, r, a, a + 0.4 + rnd() * 1.2);
      g.stroke();
    }
    g.globalAlpha = 1;
    // lines
    g.fillStyle = "#c8202a";
    g.fillRect(X(-0.15), 0, 0.3 * m, H);
    g.fillStyle = "#1f5fb8";
    for (const x of [-4.4, 4.4]) g.fillRect(X(x) - 0.15 * m, 0, 0.3 * m, H);
    g.fillStyle = "#c8202a";
    for (const x of [-11.2, 11.2]) g.fillRect(X(x) - 0.03 * m, Z(-5.4), 0.06 * m, 10.8 * m);
    g.lineWidth = 0.06 * m;
    g.strokeStyle = "#c8202a";
    for (const [x, z] of [[-8, -3], [-8, 3], [8, -3], [8, 3]]) {
      g.beginPath(); g.arc(X(x), Z(z), 1.8 * m, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "#c8202a";
      g.beginPath(); g.arc(X(x), Z(z), 0.18 * m, 0, Math.PI * 2); g.fill();
    }
    // goal creases
    g.fillStyle = "rgba(90,150,220,.55)";
    for (const x of [-11.2, 11.2]) {
      g.beginPath();
      g.arc(X(x), Z(0), 1.2 * m, x < 0 ? -Math.PI / 2 : Math.PI / 2, x < 0 ? Math.PI / 2 : Math.PI * 1.5);
      g.fill();
    }
    // centre circle with the trollface
    g.strokeStyle = "#1f5fb8";
    g.lineWidth = 0.08 * m;
    g.beginPath(); g.arc(X(0), Z(0), 2.6 * m, 0, Math.PI * 2); g.stroke();
    if (face) {
      const sz = 4.4 * m, ar = face.width / face.height;
      g.globalAlpha = 0.9;
      g.drawImage(face, X(0) - (sz * ar) / 2, Z(0) - sz / 2, sz * ar, sz);
      g.globalAlpha = 1;
    }
    g.fillStyle = "#1f5fb8";
    g.font = `700 ${Math.round(0.7 * m)}px Oswald, Impact, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("THE GRINLERIA", X(0), Z(3.4));
    g.save();
    g.translate(X(0), Z(-3.4));
    g.rotate(Math.PI);
    g.fillText("HOUSTON · TX", 0, 0);
    g.restore();
  };
  draw(null);
  iceTex = new THREE.CanvasTexture(c);
  iceTex.colorSpace = THREE.SRGBColorSpace;
  iceTex.anisotropy = 8;
  loadImage(TROLLFACE_URL).then((img) => { if (img) { draw(img); iceTex.needsUpdate = true; } });
  return iceTex;
}

/* ================================================================= signs */

/* Every sign on the map is a rectangle cut from one canvas atlas: one
   texture, one material, a couple of draws for all of them. */
const ATLAS = 2048;
const PX_PER_M = 80;

function signSpecs() {
  const out = [];
  const U = GL.up;
  // shopfronts: on the fascia, facing the concourse
  for (const st of STORES) {
    const row = st.row, cx = (st.x0 + st.x1) / 2;
    const unit = Math.min(st.x1 - st.x0, 12.8);
    const y = st.lvl === "g" ? 3.6 : U + 3.75;
    out.push({ ...st, w: Math.min(unit - 2.4, 8.4), h: st.lvl === "g" ? 0.9 : 1.1, x: cx, y, z: row * (GL.front - 0.03), ry: row < 0 ? 0 : Math.PI });
  }
  // the wings' names over their entrances (wing side), the mall's own
  // name over the end decks (atrium side)
  for (const s of [-1, 1]) {
    const W = s < 0 ? WINGS.west : WINGS.east;
    out.push({ ...W, w: 12, h: 2.0, x: s * (GL.endX + 0.4), y: 6.8, z: 0, ry: s < 0 ? -Math.PI / 2 : Math.PI / 2, big: true });
    out.push({ name: "THE GRINLERIA", sub: "HOUSTON · TEXAS", style: "serif-spaced", bg: "#f3ead6", fg: "#3a2a1c", w: 11, h: 1.8, x: s * (GL.endX - 0.02), y: 7.1, z: 0, ry: s < 0 ? Math.PI / 2 : -Math.PI / 2, big: true });
  }
  // food court menus
  for (const st of STALLS) {
    const cx = (st.x0 + st.x1) / 2;
    out.push({ ...st, sub: "ORDER HERE · NO REFUNDS", style: "bold", w: st.x1 - st.x0 - 0.8, h: 0.9, x: cx, y: 3.05, z: st.row * (28.05 - 0.05), ry: st.row < 0 ? 0 : Math.PI });
  }
  // kiosk headers, both faces
  for (const k of KIOSKS) {
    for (const face of [0, Math.PI]) {
      out.push({ ...k, style: "bold", w: 2.4, h: 0.5, x: k.x + 0, y: 2.78, z: k.z + (face === 0 ? 0.01 : -0.01), ry: face });
    }
  }
  // outside: the monument, the valet canopies, the building's name, the garage
  for (const face of [0, Math.PI]) {
    out.push({ name: "THE GRINLERIA", sub: "HOUSTON · UPTOWN", style: "serif-spaced", bg: "#2f2822", fg: "#e8d3a6", w: 4.4, h: 1.4, x: -13, y: 1.35, z: -34.4 + (face === 0 ? 0.41 : -0.41), ry: face });
  }
  for (const cx of [-46.9, 46.9]) {
    out.push({ name: "VALET", sub: "PARKING", style: "serif-spaced", bg: "#2f2822", fg: "#f3ead6", w: 3.2, h: 0.42, x: cx, y: 4.85, z: -39.42, ry: Math.PI });
    out.push({ ...(cx < 0 ? WINGS.west : WINGS.east), w: 7, h: 1.3, x: cx, y: 4.0, z: -(GL.bldZ + 0.53), ry: Math.PI });
    out.push({ ...(cx < 0 ? WINGS.east : WINGS.west), w: 7, h: 1.3, x: cx, y: 4.0, z: GL.bldZ + 0.53, ry: 0 });
  }
  out.push({ name: "THE GRINLERIA", sub: "", style: "serif-spaced", bg: "#d9ccb0", fg: "#3a2a1c", w: 22, h: 2.4, x: 0, y: 6.4, z: -(GL.bldZ + 0.56), ry: Math.PI, big: true });
  for (const face of [0, Math.PI]) {
    out.push({ name: "LEVEL P1", sub: "VISITOR PARKING · U MAD?", style: "bold", bg: "#1f5fb8", fg: "#ffffff", w: 4.6, h: 0.85, x: 13, y: 1.0 + 0.45, z: 34.4 + (face === 0 ? 0.41 : -0.41), ry: face });
  }
  // service corridors
  for (const row of [-1, 1]) {
    for (const s of [-1, 1]) {
      out.push({ name: "EMPLOYEES ONLY", sub: "NO TROLLING BEYOND THIS POINT", style: "bold", bg: "#f2c200", fg: "#111111", w: 2.4, h: 0.5, x: s * (GL.endX - 0.02), y: 2.6, z: row * 30.15, ry: s < 0 ? Math.PI / 2 : -Math.PI / 2 });
    }
  }
  // department hangers in Neiman Narcus
  for (const [z, name] of [[-10, "WOMEN'S"], [10, "SHOES · HANDBAGS"]]) {
    for (const s of [-1, 1]) {
      out.push({ name, sub: "", style: "serif-spaced", bg: "#2f2822", fg: "#f3ead6", w: 5.8, h: 1.2, x: -44 + s * 0.04, y: GL.roof - 2.3, z, ry: s < 0 ? -Math.PI / 2 : Math.PI / 2 });
    }
  }
  // dasher board ads, on the boards' outer faces
  const ads = [["TROLLBUCKS", "#0b3d2c", "#e9f3ee"], ["GAMESTONK", "#d8202a", "#ffffff"], ["TRAPPLE", "#f4f4f2", "#1d1d1f"], ["GRAND LULZ", "#2b1a12", "#f3c46b"],
    ["H-TOWN THREADS", "#11223f", "#f2a900"], ["BRICK PROBLEM", "#f6c700", "#d01012"], ["TROLL LOCKER", "#111111", "#ffffff"], ["SEPHTROLL", "#111111", "#ffffff"]];
  let i = 0;
  for (const row of [-1, 1]) {
    for (const x of [-9, -4.5, 4.5, 9]) {
      const [name, bg, fg] = ads[i++ % ads.length];
      out.push({ name, sub: "", style: "bold", bg, fg, w: 3.4, h: 0.6, x, y: 0.62, z: row * (GL.rink.z1 + GL.rink.t / 2 + 0.012), ry: row < 0 ? Math.PI : 0 });
    }
  }
  return out;
}

/* Banners hanging under the vault: drawn on the atlas, shown both sides. */
function bannerSpecs() {
  const out = [];
  const designs = [
    { kind: "texas" },
    { name: "THE GRINLERIA", sub: "EST. 2026", style: "serif-spaced", bg: "#14284a", fg: "#f3ead6", vertical: true },
    { name: "U MAD?", sub: "HOUSTON", style: "bold", bg: "#c8202a", fg: "#ffffff", vertical: true },
    { kind: "texas" },
  ];
  [-16, -6, 6, 16].forEach((x, i) => {
    out.push({ ...designs[i], w: 1.6, h: 4.2, x, y: 10.4, z: 0, ry: 0, banner: true });
  });
  return out;
}

function font(style, px) {
  switch (style) {
    case "serif": return `600 ${px}px Georgia, "Times New Roman", serif`;
    case "serif-spaced": return `500 ${px}px Georgia, "Times New Roman", serif`;
    case "script": return `italic 700 ${px}px "Brush Script MT", "Segoe Script", Georgia, cursive`;
    case "spaced": return `600 ${px}px "DM Sans", Helvetica, Arial, sans-serif`;
    case "round": return `700 ${px}px "DM Sans", Helvetica, Arial, sans-serif`;
    case "logo": return `600 ${px}px "DM Sans", Helvetica, Arial, sans-serif`;
    default: return `700 ${px}px Oswald, Impact, "Arial Narrow", sans-serif`;
  }
}

function spacing(style) {
  return style === "serif-spaced" || style === "spaced" ? 0.28 : style === "logo" ? 0.04 : 0.03;
}

/* Text that fits the box, letter-spaced, centred on (cx, cy). */
function fitText(g, text, style, cx, cy, maxW, maxH) {
  let px = Math.floor(maxH);
  const sp = spacing(style);
  const measure = () => {
    g.font = font(style, px);
    return g.measureText(text).width + sp * px * (text.length - 1);
  };
  while (px > 6 && measure() > maxW) px--;
  g.font = font(style, px);
  g.textBaseline = "middle";
  g.textAlign = "left";
  let x = cx - measure() / 2;
  for (const ch of text) {
    g.fillText(ch, x, cy);
    x += g.measureText(ch).width + sp * px;
  }
  return px;
}

function drawTexas(g, x, y, w, h) {
  // the Lone Star flag, hung vertically: blue band on top, white/red below
  g.fillStyle = "#002868";
  g.fillRect(x, y, w, h / 3);
  g.fillStyle = "#ffffff";
  g.fillRect(x, y + h / 3, w / 2, (h * 2) / 3);
  g.fillStyle = "#bf0a30";
  g.fillRect(x + w / 2, y + h / 3, w / 2, (h * 2) / 3);
  const cx = x + w / 2, cy = y + h / 6, r = Math.min(w, h / 3) * 0.33;
  g.fillStyle = "#ffffff";
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.4 : r;
    g[k ? "lineTo" : "moveTo"](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

function drawSign(g, sp, x, y, w, h, face) {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  if (sp.kind === "texas") { drawTexas(g, x, y, w, h); g.restore(); return; }
  g.fillStyle = sp.bg || "#222";
  g.fillRect(x, y, w, h);
  const fg = sp.fg || "#fff";
  // style furniture
  if (sp.style === "bold-stripe") {
    g.fillStyle = sp.stripe || "#e2231a";
    for (let i = 0; i < w; i += h * 0.5) g.fillRect(x + i, y + h * 0.84, h * 0.25, h * 0.16);
  }
  if (sp.stripes) {
    g.fillStyle = "#ffffff";
    for (const f of [0.08, 0.86]) g.fillRect(x, y + h * f, w, h * 0.05);
  }
  if (sp.style === "grunge") {
    g.fillStyle = "rgba(255,255,255,.05)";
    for (let i = 0; i < 40; i++) g.fillRect(x + Math.random() * w, y + Math.random() * h, w * 0.08, 2);
  }
  g.fillStyle = fg;
  let lx = x, lw = w;
  // logos: Trapple's bitten apple (with a grin), Trollbucks' green roundel
  if (sp.style === "logo" || sp.style === "round") {
    const r = h * 0.36, cx = x + h * 0.55, cy = y + h / 2;
    if (sp.style === "logo") {
      g.beginPath(); g.arc(cx, cy + r * 0.08, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = sp.bg; g.beginPath(); g.arc(cx + r * 1.05, cy, r * 0.42, 0, Math.PI * 2); g.fill();
      g.fillStyle = fg; g.beginPath(); g.ellipse(cx + r * 0.15, cy - r * 1.15, r * 0.18, r * 0.35, 0.6, 0, Math.PI * 2); g.fill();
      g.strokeStyle = sp.bg; g.lineWidth = r * 0.12; g.beginPath(); g.arc(cx - r * 0.1, cy + r * 0.05, r * 0.5, 0.15, Math.PI - 0.3); g.stroke();
    } else {
      g.fillStyle = "#e9f3ee"; g.beginPath(); g.arc(cx, cy, r * 1.15, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#0b3d2c"; g.beginPath(); g.arc(cx, cy, r * 1.0, 0, Math.PI * 2); g.fill();
      if (face) {
        g.save(); g.beginPath(); g.arc(cx, cy, r * 0.9, 0, Math.PI * 2); g.clip();
        g.fillStyle = "#e9f3ee"; g.fillRect(cx - r, cy - r, r * 2, r * 2);
        const ar = face.width / face.height;
        g.drawImage(face, cx - r * 0.85 * ar, cy - r * 0.85, r * 1.7 * ar, r * 1.7);
        g.restore();
      }
    }
    g.fillStyle = fg;
    lx = x + h * 1.1;
    lw = w - h * 1.2;
  }
  if (sp.vertical) {
    g.save();
    g.translate(x + w / 2, y + h / 2);
    g.rotate(-Math.PI / 2);
    fitText(g, sp.name, sp.style, 0, -w * 0.1, h * 0.86, w * 0.42);
    if (sp.sub) { g.globalAlpha = 0.85; fitText(g, sp.sub, "spaced", 0, w * 0.3, h * 0.6, w * 0.16); }
    g.restore();
    g.restore();
    return;
  }
  const hasSub = !!sp.sub;
  const mainH = hasSub ? h * 0.52 : h * 0.66;
  fitText(g, sp.name, sp.style, lx + lw / 2, y + (hasSub ? h * 0.4 : h * 0.52), lw * 0.9, mainH);
  if (hasSub) {
    g.globalAlpha = 0.8;
    fitText(g, sp.sub, "spaced", lx + lw / 2, y + h * 0.8, lw * 0.8, h * 0.17);
    g.globalAlpha = 1;
  }
  g.restore();
}

/* Packs every sign into the atlas (shelves), returns the texture and each
   sign's UV rectangle. Redrawn once the fonts and the trollface load. */
function buildAtlas(specs) {
  const c = document.createElement("canvas");
  c.width = c.height = ATLAS;
  const g = c.getContext("2d");
  let x = 0, y = 0, shelf = 0;
  const pad = 4;
  for (const sp of specs) {
    let pw = Math.round(sp.w * PX_PER_M), ph = Math.round(sp.h * PX_PER_M);
    const cap = sp.big ? 1100 : 640;
    if (pw > cap) { ph = Math.round(ph * cap / pw); pw = cap; }
    sp.size = [pw, ph];
  }
  // tallest first, so each shelf wastes little height
  for (const sp of [...specs].sort((a, b) => b.size[1] - a.size[1])) {
    const [pw, ph] = sp.size;
    if (x + pw > ATLAS) { x = 0; y += shelf + pad; shelf = 0; }
    sp.px = [x, y, pw, ph];
    x += pw + pad;
    shelf = Math.max(shelf, ph);
  }
  if (y + shelf > ATLAS) console.warn("grinleria: sign atlas overflow");
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const paint = (face) => {
    g.clearRect(0, 0, ATLAS, ATLAS);
    for (const sp of specs) drawSign(g, sp, ...sp.px, face);
    tex.needsUpdate = true;
  };
  paint(null);
  Promise.all([document.fonts?.ready ?? Promise.resolve(), loadImage(TROLLFACE_URL)]).then(([, face]) => paint(face));
  return tex;
}

function signMesh(specs, tex, side = THREE.FrontSide) {
  const q = new QuadBatch();
  for (const sp of specs) {
    const [px, py, pw, ph] = sp.px;
    const u0 = px / ATLAS, u1 = (px + pw) / ATLAS, v1 = 1 - py / ATLAS, v0 = 1 - (py + ph) / ATLAS;
    const c = Math.cos(sp.ry), s = Math.sin(sp.ry);
    const P = (lx, ly) => [sp.x + lx * c, sp.y + ly, sp.z - lx * s];
    const hw = sp.w / 2, hh = sp.h / 2;
    q.quad(P(-hw, -hh), P(hw, -hh), P(hw, hh), P(-hw, hh), [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
  }
  const mesh = new THREE.Mesh(q.geometry(), new THREE.MeshBasicMaterial({ map: tex, side, toneMapped: false }));
  mesh.material.color.setScalar(0.92);
  return mesh;
}

/* ================================================================= glass */

function buildGlass(root, solids, escalators) {
  const q = new QuadBatch();
  const U = GL.up;
  for (const s of solids) {
    if (s.k === "_front") {
      const a = s.x - s.w / 2, b = s.x + s.w / 2, z = s.z;
      q.wall(a, z, b, z, s.y + 0.25, s.y + 3.0);
    } else if (s.k === "_rail") {
      const alongX = s.w > s.d;
      if (alongX) q.wall(s.x - s.w / 2, s.z, s.x + s.w / 2, s.z, s.y + 0.1, s.y + s.h - 0.04);
      else q.wall(s.x, s.z - s.d / 2, s.x, s.z + s.d / 2, s.y + 0.1, s.y + s.h - 0.04);
    } else if (s.k === "_board") {
      const alongX = s.w > s.d;
      if (alongX) q.wall(s.x - s.w / 2, s.z, s.x + s.w / 2, s.z, s.h, s.h + 0.9);
      else q.wall(s.x, s.z - s.d / 2, s.x, s.z + s.d / 2, s.h, s.h + 0.9);
    }
  }
  // escalator balustrades: along the slope on both sides
  for (const e of escalators) {
    const x1 = e.x0 + e.dir * e.run * e.steps, top = e.rise * e.steps;
    for (const side of [-1, 1]) {
      const z = e.z + side * (e.width / 2 - 0.08);
      q.quad([e.x0, 0.42, z], [x1, top + 0.27, z], [x1, top + 0.96, z], [e.x0, 1.12, z]);
      q.quad([e.x0 - e.dir * 0.9, 0.18, z], [e.x0, 0.42, z], [e.x0, 1.12, z], [e.x0 - e.dir * 0.9, 0.92, z]);
      q.quad([x1, top + 0.27, z], [x1 + e.dir * 0.8, top + 0.15, z], [x1 + e.dir * 0.8, top + 0.92, z], [x1, top + 0.96, z]);
    }
  }
  void U;
  const glass = new THREE.MeshStandardMaterial({
    color: 0xcfe6ee, roughness: 0.04, metalness: 0.0, transparent: true, opacity: 0.16,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(q.geometry(), glass);
  mesh.renderOrder = 2;
  root.add(mesh);

  // the vault's glazing and the food court skylight: thinner, no shadows,
  // so the sun lands on the ice in stripes between the ribs
  const v = new QuadBatch();
  const Z = 10, spring = GL.roof, crown = GL.vaultTop, x0 = -26, x1 = 26, N = 24;
  const vy = (z) => spring + (crown - spring) * Math.sqrt(Math.max(0, 1 - (z / Z) ** 2));
  const zs = [];
  for (let i = 0; i <= N; i++) zs.push(Z * Math.cos((Math.PI * i) / N));
  for (let i = 0; i < N; i++) {
    const za = zs[i], zb = zs[i + 1];
    v.quad([x0, vy(za), za], [x1, vy(za), za], [x1, vy(zb), zb], [x0, vy(zb), zb]);
  }
  for (const x of [x0, x1]) {
    for (let i = 0; i < N; i++) {
      const za = zs[i], zb = zs[i + 1];
      v.quad([x, spring, za], [x, spring, zb], [x, vy(zb), zb], [x, vy(za), za]);
    }
  }
  v.quad([40, 10.2, -4], [48, 10.2, -4], [48, 10.2, 4], [40, 10.2, 4]);
  const vaultMat = new THREE.MeshStandardMaterial({
    color: 0xdff2ff, roughness: 0.02, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide,
  });
  const vault = new THREE.Mesh(v.geometry(), vaultMat);
  vault.renderOrder = 1;
  root.add(vault);
}

/* ======================================================= Trollface Falls */

/* Falling water: soft vertical streaks, white over a pale blue, tiled
   down the sheet and scrolled each frame. */
let fallTex = null;
function fallTexture() {
  if (fallTex) return fallTex;
  const c = document.createElement("canvas");
  c.width = 128; c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(200,232,248,0.55)";
  g.fillRect(0, 0, 128, 512);
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) {
    const x = rnd() * 128, w = 1 + rnd() * 5, y = rnd() * 512, h = 60 + rnd() * 260;
    const grad = g.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.5, `rgba(255,255,255,${0.35 + rnd() * 0.5})`);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    for (const dy of [0, -512, 512]) g.fillRect(x, y + dy, w, h);   // wraps vertically
  }
  fallTex = new THREE.CanvasTexture(c);
  fallTex.wrapS = fallTex.wrapT = THREE.RepeatWrapping;
  fallTex.colorSpace = THREE.SRGBColorSpace;
  return fallTex;
}

let puffTex = null;
function puffTexture() {
  if (puffTex) return puffTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,255,255,0.9)");
  r.addColorStop(0.4, "rgba(255,255,255,0.35)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  puffTex = new THREE.CanvasTexture(c);
  return puffTex;
}

/* One scrolling copy of the streak texture per waterfall layer (each layer
   scrolls at its own speed), made once per page. */
const fallLayers = new Map();
function fallLayerTexture(key) {
  if (!fallLayers.has(key)) {
    const t = fallTexture().clone();
    t.needsUpdate = true;
    fallLayers.set(key, t);
  }
  return fallLayers.get(key);
}

let ringTexture = null;

/* The waterfall out of the cleft beside the carved head: a curved sheet
   that leaves the stone lip and falls into the pool, two layers scrolling
   at different speeds, foam where it lands, a little mist, ripples. */
function buildFalls(root) {
  const lip = { x: 44.05, y: 3.02, z: -1.5 }, pool = 0.43, W = 0.95;
  const sheet = (width, out, speed, opacity) => {
    const segs = 14, pos = [], uv = [], idx = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      // leaves the lip moving outward, then drops: a short parabola
      const x = lip.x - out * Math.sqrt(t) - 0.05 * t;
      const y = lip.y + 0.04 - (lip.y + 0.04 - pool) * t * t * 0.35 - (lip.y - pool) * 0.65 * t;
      for (const side of [-1, 1]) {
        pos.push(x, y, lip.z + side * (width / 2) * (1 + 0.15 * t));
        uv.push(side < 0 ? 0 : 1, 1 - t * 3);
      }
      if (i < segs) {
        const a = i * 2;
        idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const tex = fallLayerTexture(speed);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, color: 0xf2fbff,
    }));
    m.renderOrder = 3;
    m.userData.speed = speed;
    root.add(m);
    return m;
  };
  const layers = [sheet(W, 0.32, 1.25, 0.9), sheet(W * 0.8, 0.38, 1.7, 0.55)];

  // foam and spray where it lands, mist hanging over the pool
  const puff = (size, opacity, additive) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: puffTexture(), transparent: true, opacity, depthWrite: false, color: 0xffffff,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
    sp.scale.setScalar(size);
    root.add(sp);
    return sp;
  };
  const foamX = lip.x - 0.42;
  const foam = [0, 1, 2, 3].map((k) => {
    const sp = puff(0.7, 0.55, false);
    sp.userData = { k, ox: (k - 1.5) * 0.25 };
    return sp;
  });
  const mist = puff(2.6, 0.12, false);
  mist.position.set(foamX - 0.2, pool + 0.9, lip.z);

  // ripples spreading out over the pool
  const ringTex = ringTexture ??= (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    g.strokeStyle = "rgba(255,255,255,0.8)";
    g.lineWidth = 5;
    g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.stroke();
    return new THREE.CanvasTexture(c);
  })();
  const rings = [0, 1, 2].map((k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, opacity: 0.4 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(foamX, pool + 0.012, lip.z);
    m.userData.k = k;
    root.add(m);
    return m;
  });

  const t0 = performance.now();
  root.add(ticker(() => {
    const t = (performance.now() - t0) / 1000;
    for (const m of layers) m.material.map.offset.y = (t * m.userData.speed) % 1;
    for (const sp of foam) {
      const k = sp.userData.k;
      const p = (t * 1.3 + k * 0.25) % 1;
      sp.position.set(foamX + Math.sin(k * 2.1 + t) * 0.12, pool + 0.08 + p * 0.45, lip.z + sp.userData.ox);
      sp.material.opacity = 0.6 * (1 - p);
      sp.scale.setScalar(0.5 + p * 0.7);
    }
    mist.material.opacity = 0.1 + 0.04 * Math.sin(t * 0.7);
    for (const r of rings) {
      const p = (t * 0.45 + r.userData.k / 3) % 1;
      r.scale.setScalar(0.6 + p * 3.2);
      r.material.opacity = 0.35 * (1 - p);
    }
  }));
}

/* ================================================================= build */

let atlas = null;

function buildGrinleria(api) {
  const { solids, escalators, lights } = grinleriaLayout();
  for (const s of solids) api.ghostBox(s.x, s.z, s.w, s.d, s.h, { y: s.y, pen: s.pen });

  // the models (models/build_grinleria.blender.py). Under a roof the sun
  // only matters through the vault: the shops and the wings don't cast.
  mapModel(api, "gl-shell", { x: 0, z: 0 });
  mapModel(api, "gl-atrium", { x: 0, z: 0 });
  mapModel(api, "gl-shops", { x: 0, z: 0, castShadow: false });
  mapModel(api, "gl-wings", { x: 0, z: 0, castShadow: false });
  mapModel(api, "gl-outside", { x: 0, z: 0 });
  // palms in the planters (map-dressing.js palmTrees; the models no longer draw them)
  const palmSpots = [];
  for (const s of solids) {
    if (s.k === "palmplanter") palmSpots.push([s.x, s.z, 6.5, s.y + s.h]);
    else if (s.k === "palmbed") palmSpots.push([s.x, s.z, 5.2, s.y + s.h], [s.x + 0.2, s.z + 1.0, 4.0, s.y + s.h]);
  }
  if (palmSpots.length) {
    const palmRoot = new THREE.Group();
    api.prop(palmRoot);
    palmTrees(palmRoot, palmSpots, { seed: 41 });
  }
  // Trollface Falls, under the food court's skylight: the grotto and the
  // trollface carved in stone (gl-trollhead, made from the artwork itself)
  mapModel(api, "gl-falls", { x: 0, z: 0 });
  mapModel(api, "gl-trollhead", { x: 0, z: 0 });

  const root = new THREE.Group();
  api.prop(root);

  // the ice
  const R = GL.rink;
  const ice = new THREE.Mesh(
    new THREE.PlaneGeometry(R.x1 - R.x0, R.z1 - R.z0),
    new THREE.MeshStandardMaterial({ map: iceTexture(), roughness: 0.12, metalness: 0.0, color: 0xffffff }),
  );
  ice.rotation.x = -Math.PI / 2;
  ice.position.set((R.x0 + R.x1) / 2, 0.014, (R.z0 + R.z1) / 2);
  ice.receiveShadow = true;
  root.add(ice);

  buildGlass(root, solids, escalators);

  // signs (one side) and the vault banners (both sides). The atlas is
  // painted once per page: maps get disposed (geometry, materials), never
  // their textures, so a new one per match would pile up on the GPU.
  atlas ??= (() => {
    const signs = signSpecs(), banners = bannerSpecs();
    return { signs, banners, tex: buildAtlas([...signs, ...banners]) };
  })();
  const { signs, banners, tex } = atlas;
  root.add(signMesh(signs, tex));
  root.add(signMesh(banners, tex, THREE.DoubleSide));
  // banner poles
  const pole = new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 0.5 });
  for (const b of banners) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, b.w + 0.3, 6), pole);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(b.x, b.y + b.h / 2 + 0.05, b.z);
    root.add(bar);
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, GL.vaultTop - (b.y + b.h / 2), 4), pole);
    wire.position.set(b.x, (GL.vaultTop + b.y + b.h / 2) / 2, b.z);
    root.add(wire);
  }

  buildFalls(root);

  // point lights: the ground concourses (under the slab), the service
  // corridors, the wings, the garage
  for (const L of lights) {
    const wing = Math.abs(L.x) > GL.endX + 1;
    const garage = L.z > GL.bldZ;
    const corridor = !wing && !garage && Math.abs(L.z) > GL.back;
    const accent = Math.abs(L.x - 41.6) < 0.1;
    const color = garage || corridor ? 0xe6f0ff : accent ? 0xffd9a8 : 0xfff0d8;
    const [intensity, distance] = accent ? [14, 10] : wing ? [34, 32] : garage ? [10, 18] : corridor ? [9, 16] : [16, 22];
    const light = new THREE.PointLight(color, intensity, distance, 2);
    light.position.set(L.x, L.y, L.z);
    light.castShadow = false;
    root.add(light);
  }
}

const LAYOUT = grinleriaLayout();

export const GRINLERIA = {
  name: "The Grinleria",
  blurb: "Houston's finest mall. Ice rink in the middle, no refunds.",
  bounds: { ...GL.bounds },
  playerSpawn: { x: -51, z: 0 },
  // A bright Houston afternoon: the sun comes down through the vault onto
  // the ice; the skyline sits in a light haze.
  sky: { top: 0x2f6fc4, horizon: 0xc6dcef, bottom: 0x9ab0c4, sun: 1.0, haze: 0.5, clouds: 0.4, cloudColor: 0xffffff, cloudShade: 0x98a8bc },
  fog: { color: 0xcfdbe6, density: 0.0026 },
  viewFar: 420,
  // The mall draws its own floors (marble inside, pavement and the garage
  // outside, a city's worth of ground under the skyline): no ground plane.
  noGroundPlane: true,
  ground: { colorA: 0xffffff, colorB: 0xffffff, grid: 0xc8bca4, surface: "marble", tile: 4 },
  sun: { color: 0xfff1d8, intensity: 2.3, pos: [22, 60, 14] },
  hemi: { sky: 0xeaf2ff, ground: 0x9a8e78, intensity: 1.25 },
  ambient: { color: 0xfff8ee, intensity: 0.75 },
  build: buildGrinleria,
  spawns: LAYOUT.spawns,
};
