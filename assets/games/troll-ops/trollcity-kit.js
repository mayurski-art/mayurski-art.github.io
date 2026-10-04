// Troll Forces — the toolkit behind "Troll City", the frontier boomtown map
// (trollcity.js). Batching, materials, canvas textures and the town's props:
// everything here is procedural, nothing loads a model.
//
// The batching (Kit) and the wall/roof builders follow hollowgrin.js: every
// piece that shares a material merges into one mesh at the end, and every
// collider is laid by the same call that draws its box, so the two can't
// drift apart.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { SURFACES } from "./surface-textures.js?v=hg6e";

/* ================================================================ utilities */

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function canvasTex(w, h, draw, { srgb = true, repeat = false } = {}) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/* Made once per page, shared by every build (maps dispose geometry and
   materials, never these). */
const TEX = {};
export function tex(name, make) { return TEX[name] ??= make(); }

const TROLL_URL = new URL("../../images/wallpaper/trollface%20transparent.png", import.meta.url).href;
let trollImg = null;
const trollWaiters = [];
/* The trollface artwork (white face, black ink), loaded once; `then` runs
   when it's ready (at once if it already is). */
function withTroll(then) {
  if (trollImg?.complete && trollImg.naturalWidth) return then(trollImg);
  trollWaiters.push(then);
  if (trollImg) return;
  trollImg = new Image();
  trollImg.onload = () => { for (const f of trollWaiters.splice(0)) f(trollImg); };
  trollImg.src = TROLL_URL;
}

/* A canvas texture drawn twice: once now (without the trollface) and again
   when the artwork has loaded. `draw(g, w, h, img|null)`. */
function trollCanvas(name, w, h, draw, opts = {}) {
  return tex(name, () => {
    const t = canvasTex(w, h, (g) => draw(g, w, h, null), opts);
    withTroll((img) => {
      const g = t.image.getContext("2d");
      g.clearRect(0, 0, w, h);
      draw(g, w, h, img);
      t.needsUpdate = true;
    });
    return t;
  });
}

/* Draw the trollface fitted into a box, optionally tinted (multiply). */
function drawTroll(g, img, x, y, w, h, { tint = null, alpha = 1 } = {}) {
  if (!img) return;
  const s = Math.min(w / img.width, h / img.height);
  const dw = img.width * s, dh = img.height * s;
  g.save();
  g.globalAlpha = alpha;
  g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  if (tint) {
    g.globalCompositeOperation = "multiply";
    g.fillStyle = tint;
    g.fillRect(x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    g.globalCompositeOperation = "destination-in";
    g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }
  g.restore();
}

/* ======================================================= materials + batching */

/* A material from one of the PBR sets, tinted; `tile` is metres per repeat
   (the kit rewrites UVs in world metres for these). */
export function surfMat(surface, color, { mix = 0.45, tile = 2, rough = 1, bounce = 0 } = {}) {
  const s = SURFACES[surface];
  const tint = new THREE.Color(color).lerp(new THREE.Color(0xffffff), mix);
  const m = new THREE.MeshStandardMaterial({
    color: tint, map: s.color.clone(), normalMap: s.normal.clone(), roughnessMap: s.rough.clone(),
    roughness: rough, metalness: 0.02,
  });
  if (s.ao) m.aoMap = s.ao.clone();
  if (bounce) {
    m.emissive = tint.clone().multiplyScalar(bounce);
    m.emissiveMap = m.map;
  }
  for (const t of [m.map, m.normalMap, m.roughnessMap, m.aoMap]) {
    if (!t) continue;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
  }
  m.userData.tile = tile;
  return m;
}

/* A material on one of our canvas textures, UVs in world metres when
   `tile` is set. `bump` uses the colour map as a bump map too (planks). */
export function texMat(map, { color = 0xffffff, tile = 0, rough = 0.9, metal = 0, alphaTest = 0, side = THREE.FrontSide, bump = 0, emissive = 0x000000, emissiveMap = null, bounce = 0 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, map, roughness: rough, metalness: metal, alphaTest, side, emissive, emissiveMap });
  if (bump) { m.bumpMap = map; m.bumpScale = bump; }
  if (bounce) {
    m.emissive = new THREE.Color(color).multiplyScalar(bounce);
    m.emissiveMap = map;
  }
  if (tile) m.userData.tile = tile;
  return m;
}

/* World-metre UVs (as maps.js's metreUVs): each triangle samples along the
   two axes its face normal doesn't point down. `rotY` swaps u/v on the
   vertical faces whose boards should run the other way. */
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
function metreUVs(geo, tile, vertical = false) {
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i + 2 < pos.count; i += 3) {
    _a.fromBufferAttribute(pos, i);
    _b.fromBufferAttribute(pos, i + 1).sub(_a);
    _c.fromBufferAttribute(pos, i + 2).sub(_a);
    _b.cross(_c);
    const ax = Math.abs(_b.x), ay = Math.abs(_b.y), az = Math.abs(_b.z);
    for (let k = i; k < i + 3; k++) {
      const px = pos.getX(k), py = pos.getY(k), pz = pos.getZ(k);
      let u, v;
      if (ay >= ax && ay >= az) { u = px; v = pz; }
      else if (ax >= az) { u = pz; v = py; }
      else { u = px; v = py; }
      if (vertical && !(ay >= ax && ay >= az)) uv.setXY(k, v / tile, u / tile);
      else uv.setXY(k, u / tile, v / tile);
    }
  }
  uv.needsUpdate = true;
}

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

/* Place a geometry: rotate (x, y, z order), scale, translate. */
export function place(geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  _m4.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
  geo.applyMatrix4(_m4);
  return geo;
}

/* Everything drawn on the map goes through a Kit: pieces are grouped by
   material and merged into one mesh each at flush(). */
export class Kit {
  constructor(api, root) {
    this.api = api;
    this.root = root;
    this.lists = new Map();
  }

  add(mat, geo, { shadow = true, color = null } = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    const n = g.attributes.position.count;
    for (const k of Object.keys(g.attributes)) {
      if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k);
    }
    g.morphAttributes = {};
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    if (mat.vertexColors) {
      const c = new THREE.Color(color ?? 0xffffff);
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
      g.setAttribute("color", new THREE.Float32BufferAttribute(arr, 3));
    }
    g.clearGroups();
    if (mat.userData.tile) metreUVs(g, mat.userData.tile, mat.userData.vertical);
    let l = this.lists.get(mat);
    if (!l) this.lists.set(mat, (l = { geos: [], shadow: false }));
    l.shadow ||= shadow;
    l.geos.push(g);
    return g;
  }

  /* A visible box, no collider. `y` is its bottom. */
  box(mat, x, y, z, w, h, d, rot = {}, opts) {
    return this.add(mat, place(new THREE.BoxGeometry(w, h, d), { x, y: y + h / 2, z, ...rot }), opts);
  }

  cyl(mat, x, y, z, r0, r1, h, seg = 12, rot = {}, opts) {
    return this.add(mat, place(new THREE.CylinderGeometry(r1, r0, h, seg), { x, y: y + h / 2, z, ...rot }), opts);
  }

  /* A collider and (with `mat`) the box that shows it. */
  solid(x, z, w, d, h, { y = 0, pen = 8, mat = null } = {}) {
    this.api.ghostBox(x, z, w, d, h, { y, pen });
    if (mat) this.box(mat, x, y, z, w, h, d);
  }

  flush() {
    for (const [mat, l] of this.lists) {
      const merged = mergeGeometries(l.geos, false);
      for (const g of l.geos) g.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = l.shadow && !mat.transparent;
      mesh.receiveShadow = !(mat instanceof THREE.MeshBasicMaterial);
      this.root.add(mesh);
    }
    this.lists.clear();
  }
}

export function prismGeo(points, depth) {
  const s = new THREE.Shape(points.map(([a, b]) => new THREE.Vector2(a, b)));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return g;
}

/* The open runs of [a, b] once the `gaps` ([lo, hi]) are taken out. */
export function runs(a, b, gaps = []) {
  const out = [];
  let s = a;
  for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) {
    if (g0 > s) out.push([s, Math.min(g0, b)]);
    s = Math.max(s, g1);
  }
  if (b > s) out.push([s, b]);
  return out;
}

/* A flat patch on the ground (planes turn with rz after rx). */
export function flat(K, mat, x, z, w, d, { y = 0.012, rz = 0 } = {}) {
  K.add(mat, place(new THREE.PlaneGeometry(w, d), { x, y, z, rx: -Math.PI / 2, rz }), { shadow: false });
}

/* ================================================================= textures */

/* Painted or bare boards, light enough that a material colour tints them:
   vertical boards with dark seams, grain streaks, knots and nail heads.
   `worn` scuffs the paint back to grey wood in patches. */
export function boardsTexture({ boards = 8, worn = 0.25, seed = 3, horizontal = false } = {}) {
  return tex(`boards-${boards}-${worn}-${seed}-${horizontal}`, () => canvasTex(512, 512, (g, W, H) => {
    const R = rng(seed);
    const bw = W / boards;
    for (let i = 0; i < boards; i++) {
      const v = 200 + R() * 40;
      g.fillStyle = `rgb(${v | 0},${(v - 4) | 0},${(v - 12) | 0})`;
      g.fillRect(i * bw, 0, bw, H);
      // grain: long wavy streaks down each board
      for (let s = 0; s < 22; s++) {
        const x = i * bw + R() * bw, a = 0.05 + R() * 0.12;
        g.strokeStyle = `rgba(60,40,24,${a.toFixed(3)})`;
        g.lineWidth = 0.6 + R() * 1.6;
        g.beginPath();
        g.moveTo(x, 0);
        for (let y = 0; y <= H; y += 32) g.lineTo(x + Math.sin(y * 0.02 + s) * (1 + R() * 2.5), y);
        g.stroke();
      }
      // a knot or two
      for (let k = 0; k < (R() < 0.5 ? 1 : 2); k++) {
        const kx = i * bw + bw * (0.3 + R() * 0.4), ky = R() * H;
        const r = g.createRadialGradient(kx, ky, 0, kx, ky, 6 + R() * 5);
        r.addColorStop(0, "rgba(70,44,24,.7)");
        r.addColorStop(1, "rgba(70,44,24,0)");
        g.fillStyle = r;
        g.beginPath();
        g.ellipse(kx, ky, 5 + R() * 4, 9 + R() * 6, 0, 0, Math.PI * 2);
        g.fill();
      }
      // butt joints, offset per board
      const jy = R() * H;
      g.fillStyle = "rgba(30,20,12,.65)";
      g.fillRect(i * bw, jy, bw, 2);
      // nails each side of the joints and at the top
      g.fillStyle = "rgba(40,36,34,.8)";
      for (const ny of [jy - 6, jy + 8, 10, H - 10]) {
        g.fillRect(i * bw + 6, ny, 3, 3);
        g.fillRect(i * bw + bw - 9, ny, 3, 3);
      }
      // seam: a dark gap and a lit edge
      g.fillStyle = "rgba(24,16,10,.9)";
      g.fillRect(i * bw, 0, 3, H);
      g.fillStyle = "rgba(255,255,255,.18)";
      g.fillRect(i * bw + 3, 0, 1.5, H);
    }
    // weathering: pale scuffs where the paint wore off, dirt low down
    for (let i = 0; i < 70 * worn; i++) {
      const x = R() * W, y = R() * H;
      g.fillStyle = `rgba(235,228,214,${(0.08 + R() * 0.14).toFixed(3)})`;
      g.beginPath();
      g.ellipse(x, y, 4 + R() * 16, 14 + R() * 40, 0, 0, Math.PI * 2);
      g.fill();
    }
    if (horizontal) {
      // rotate the whole sheet a quarter turn
      const copy = document.createElement("canvas");
      copy.width = W;
      copy.height = H;
      copy.getContext("2d").drawImage(g.canvas, 0, 0);
      g.save();
      g.translate(W / 2, H / 2);
      g.rotate(Math.PI / 2);
      g.drawImage(copy, -W / 2, -H / 2);
      g.restore();
    }
  }, { repeat: true }));
}

/* Corrugated tin: ridges, rust bleeding down from the seams. */
export function tinTexture() {
  return tex("tin", () => canvasTex(256, 256, (g, W, H) => {
    const R = rng(17);
    for (let x = 0; x < W; x++) {
      const k = 0.5 + 0.5 * Math.sin((x / W) * Math.PI * 2 * 12);
      const v = 120 + k * 80;
      g.fillStyle = `rgb(${v | 0},${(v + 2) | 0},${(v + 6) | 0})`;
      g.fillRect(x, 0, 1, H);
    }
    for (let i = 0; i < 40; i++) {
      const x = R() * W, y = R() * H * 0.6;
      const grd = g.createLinearGradient(0, y, 0, y + 30 + R() * 80);
      grd.addColorStop(0, "rgba(140,60,20,.55)");
      grd.addColorStop(1, "rgba(140,60,20,0)");
      g.fillStyle = grd;
      g.fillRect(x, y, 3 + R() * 10, 110);
    }
    g.fillStyle = "rgba(40,30,24,.6)";
    g.fillRect(0, 0, W, 3);
  }, { repeat: true }));
}

/* Wood shingles in staggered rows. */
export function shingleTexture() {
  return tex("shingle-west", () => canvasTex(256, 256, (g) => {
    const R = rng(23);
    g.fillStyle = "#3a2c22";
    g.fillRect(0, 0, 256, 256);
    const rowH = 28;
    for (let row = 0; row < 10; row++) {
      let x = (row % 2) * -14;
      while (x < 256) {
        const w = 22 + R() * 18, v = 120 + R() * 50;
        g.fillStyle = `rgb(${v | 0},${(v * 0.82) | 0},${(v * 0.62) | 0})`;
        g.fillRect(x + 1, row * rowH + 1, w - 2, rowH - 1);
        const sh = g.createLinearGradient(0, row * rowH, 0, row * rowH + rowH);
        sh.addColorStop(0, "rgba(0,0,0,0)");
        sh.addColorStop(1, "rgba(0,0,0,.4)");
        g.fillStyle = sh;
        g.fillRect(x + 1, row * rowH + 1, w - 2, rowH - 1);
        x += w;
      }
    }
  }, { repeat: true }));
}

/* Damask wallpaper (the saloon's): a cream ground and paler ornament. */
export function damaskTexture(bg = "#efe3b8", ink = "#d9c78e") {
  return tex(`damask-${bg}-${ink}`, () => canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    const motif = (cx, cy, s) => {
      g.save();
      g.translate(cx, cy);
      g.scale(s, s);
      g.fillStyle = ink;
      g.strokeStyle = ink;
      g.lineWidth = 3;
      // the central bud
      g.beginPath();
      g.moveTo(0, -46);
      g.bezierCurveTo(18, -26, 18, 6, 0, 26);
      g.bezierCurveTo(-18, 6, -18, -26, 0, -46);
      g.fill();
      // scrolls either side, mirrored
      for (const sx of [-1, 1]) {
        g.save();
        g.scale(sx, 1);
        g.beginPath();
        g.moveTo(6, 22);
        g.bezierCurveTo(40, 30, 50, -6, 30, -20);
        g.bezierCurveTo(18, -28, 10, -14, 22, -8);
        g.stroke();
        g.beginPath();
        g.moveTo(4, -30);
        g.bezierCurveTo(26, -50, 46, -40, 40, -26);
        g.stroke();
        g.beginPath();
        g.ellipse(34, 18, 6, 10, 0.6, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      // stem and base leaf
      g.fillRect(-2, 26, 4, 16);
      g.beginPath();
      g.moveTo(-16, 46);
      g.quadraticCurveTo(0, 30, 16, 46);
      g.quadraticCurveTo(0, 40, -16, 46);
      g.fill();
      g.restore();
    };
    for (const [x, y] of [[64, 64], [192, 192], [192, -64], [-64, 192], [192, 320], [320, 192]]) motif(x, y, 0.9);
    for (const [x, y] of [[192, 64], [64, 192], [-64, 64], [64, 320], [320, 64], [64, -64]]) motif(x, y, 0.45);
  }, { repeat: true }));
}

/* A painted sign board: a flat ground, a pinstripe border, the lettering
   with a drop shadow, and the paint weathered. `sub` is a smaller second
   line. */
export function signTexture(text, { sub = "", w = 1024, h = 256, bg = "#e9dcc0", fg = "#3a1e12", edge = "#3a1e12", shade = "rgba(0,0,0,.25)", font = "Rockwell, 'Rockwell Extra Bold', Georgia, serif", seed = 5 } = {}) {
  return tex(`sign-${text}|${sub}|${w}x${h}|${bg}|${fg}`, () => canvasTex(w, h, (g) => {
    const R = rng(seed);
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    // grain under the paint
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(0,0,0,${(0.02 + R() * 0.04).toFixed(3)})`;
      g.fillRect(0, R() * h, w, 1 + R() * 2);
    }
    g.strokeStyle = edge;
    g.lineWidth = h * 0.035;
    g.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h * 0.88);
    g.lineWidth = h * 0.012;
    g.strokeRect(h * 0.11, h * 0.11, w - h * 0.22, h * 0.78);
    g.textAlign = "center";
    g.textBaseline = "middle";
    const big = Math.floor(h * (sub ? 0.4 : 0.52));
    const y0 = sub ? h * 0.42 : h * 0.52;
    g.font = `900 ${big}px ${font}`;
    g.fillStyle = shade;
    g.fillText(text, w / 2 + h * 0.02, y0 + h * 0.02, w - h * 0.4);
    g.fillStyle = fg;
    g.fillText(text, w / 2, y0, w - h * 0.4);
    if (sub) {
      g.font = `italic 700 ${Math.floor(h * 0.17)}px Georgia, serif`;
      g.fillText(sub, w / 2, h * 0.74, w - h * 0.4);
    }
    // flaked paint
    for (let i = 0; i < 160; i++) {
      g.fillStyle = `rgba(255,250,235,${(0.05 + R() * 0.2).toFixed(3)})`;
      g.fillRect(R() * w, R() * h, 1 + R() * 5, 1 + R() * 3);
    }
  }));
}

/* WANTED: the trollface, dead or alive. Aged paper, torn corner. */
export function wantedTexture(variant = 0) {
  const crimes = ["FOR TROLLING", "FOR U MAD BRO", "FOR PROBLEM?", "FOR RICKROLLING"];
  const reward = ["$1,000,000", "$420", "$69,000", "ONE (1) COOKIE"];
  return trollCanvas(`wanted-${variant}`, 256, 384, (g, W, H, img) => {
    const grd = g.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 260);
    grd.addColorStop(0, "#efe0b6");
    grd.addColorStop(1, "#b89a62");
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#2a1a10";
    g.textAlign = "center";
    g.font = "900 58px Rockwell, Georgia, serif";
    g.fillText("WANTED", W / 2, 66);
    g.font = "700 18px Georgia, serif";
    g.fillText("DEAD OR ALIVE", W / 2, 92);
    g.fillStyle = "#f6ecd2";
    g.fillRect(36, 106, W - 72, 168);
    g.strokeStyle = "#2a1a10";
    g.lineWidth = 3;
    g.strokeRect(36, 106, W - 72, 168);
    drawTroll(g, img, 44, 112, W - 88, 156);
    g.fillStyle = "#2a1a10";
    g.font = "800 22px Georgia, serif";
    g.fillText(crimes[variant % 4], W / 2, 304);
    g.font = "900 30px Rockwell, Georgia, serif";
    g.fillText(reward[variant % 4], W / 2, 342);
    g.font = "italic 13px Georgia, serif";
    g.fillText("REWARD", W / 2, 362);
    // stains and a torn corner
    const R = rng(variant + 9);
    for (let i = 0; i < 12; i++) {
      g.fillStyle = `rgba(110,70,30,${(0.05 + R() * 0.1).toFixed(3)})`;
      g.beginPath();
      g.arc(R() * W, R() * H, 6 + R() * 24, 0, Math.PI * 2);
      g.fill();
    }
    g.clearRect(W - 30, 0, 30, 30);
    g.fillStyle = "#c8ac72";
    g.beginPath();
    g.moveTo(W - 30, 0);
    g.lineTo(W - 30, 30);
    g.lineTo(W, 30);
    g.fill();
  });
}

/* Rows of bottles on a back-bar shelf, cut out (alpha), with a lit
   window glow behind them. */
export function bottlesTexture() {
  return tex("bottles", () => canvasTex(512, 128, (g, W, H) => {
    const R = rng(41);
    g.clearRect(0, 0, W, H);
    let x = 4;
    const cols = ["#5a7a3a", "#7a4a2a", "#4a6a5a", "#8a6a3a", "#3a4a2a", "#a07a4a", "#6a3a2a", "#c8b890"];
    while (x < W - 14) {
      const bw = 12 + R() * 8, bh = 60 + R() * 52, neck = bw * 0.36;
      const c = cols[Math.floor(R() * cols.length)];
      g.fillStyle = c;
      g.fillRect(x, H - bh * 0.62, bw, bh * 0.62);
      g.beginPath();
      g.moveTo(x, H - bh * 0.62);
      g.quadraticCurveTo(x + bw / 2, H - bh * 0.78, x + bw / 2 - neck / 2, H - bh * 0.84);
      g.lineTo(x + bw / 2 + neck / 2, H - bh * 0.84);
      g.quadraticCurveTo(x + bw / 2, H - bh * 0.78, x + bw, H - bh * 0.62);
      g.fill();
      g.fillRect(x + bw / 2 - neck / 2, H - bh, neck, bh * 0.17);
      // label and a highlight
      if (R() < 0.7) {
        g.fillStyle = R() < 0.5 ? "#e8dcc0" : "#d8b878";
        g.fillRect(x + 1, H - bh * 0.42, bw - 2, bh * 0.16);
      }
      g.fillStyle = "rgba(255,255,255,.35)";
      g.fillRect(x + 2, H - bh * 0.6, 2, bh * 0.5);
      x += bw + 2 + R() * 4;
    }
  }));
}

/* Tins, boxes and jars crowding a general-store shelf (alpha). */
export function goodsTexture(seed = 7) {
  return tex(`goods-${seed}`, () => canvasTex(512, 128, (g, W, H) => {
    const R = rng(seed);
    let x = 2;
    const cols = ["#b8342a", "#e0c060", "#3a6a9a", "#e8e0c8", "#5a8a3a", "#c87a2a", "#6a4a8a", "#d8d0b0", "#8a3a2a"];
    while (x < W - 10) {
      const kind = R();
      const c = cols[Math.floor(R() * cols.length)];
      if (kind < 0.4) {          // tins
        const w = 20 + R() * 10, h = 30 + R() * 30;
        g.fillStyle = c;
        g.fillRect(x, H - h, w, h);
        g.fillStyle = "#e8e0c8";
        g.fillRect(x, H - h * 0.66, w, h * 0.3);
        g.fillStyle = "rgba(255,255,255,.3)";
        g.fillRect(x + 3, H - h, 3, h);
        x += w + 2;
      } else if (kind < 0.75) {  // boxes
        const w = 34 + R() * 30, h = 40 + R() * 60;
        g.fillStyle = c;
        g.fillRect(x, H - h, w, h);
        g.fillStyle = "rgba(0,0,0,.2)";
        g.fillRect(x + w - 6, H - h, 6, h);
        g.fillStyle = "#f2ead6";
        g.font = "700 10px Georgia";
        g.fillText(["SOAP", "OATS", "TEA", "KEK", "LOL"][Math.floor(R() * 5)], x + 4, H - h * 0.5);
        x += w + 2;
      } else {                    // jars
        const w = 22 + R() * 8, h = 34 + R() * 22;
        g.fillStyle = "rgba(200,220,210,.85)";
        g.fillRect(x, H - h, w, h);
        g.fillStyle = c;
        g.fillRect(x + 2, H - h * 0.8, w - 4, h * 0.78);
        g.fillStyle = "#3a3a3a";
        g.fillRect(x - 1, H - h - 5, w + 2, 6);
        x += w + 3;
      }
    }
  }, { repeat: true }));
}

/* A framed painting: a desert at sunset with the trollface as the sun, or
   the trollface's portrait. */
export function paintingTexture(kind = "desert") {
  return trollCanvas(`paint-${kind}`, 256, 192, (g, W, H, img) => {
    if (kind === "desert") {
      const sky = g.createLinearGradient(0, 0, 0, H * 0.7);
      sky.addColorStop(0, "#5a7ac8");
      sky.addColorStop(1, "#f0a860");
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
      g.save();
      g.globalAlpha = 0.95;
      drawTroll(g, img, W * 0.56, H * 0.12, W * 0.3, H * 0.4, { tint: "#ffcf6a" });
      g.restore();
      g.fillStyle = "#b8643a";
      g.beginPath();
      g.moveTo(0, H * 0.62);
      g.lineTo(W * 0.12, H * 0.62);
      g.lineTo(W * 0.16, H * 0.46);
      g.lineTo(W * 0.36, H * 0.46);
      g.lineTo(W * 0.4, H * 0.64);
      g.lineTo(W, H * 0.66);
      g.lineTo(W, H);
      g.lineTo(0, H);
      g.fill();
      g.fillStyle = "#d8a060";
      g.fillRect(0, H * 0.74, W, H * 0.26);
      g.fillStyle = "#3a6a3a";
      g.fillRect(W * 0.2, H * 0.58, 8, 40);
      g.fillRect(W * 0.2 - 12, H * 0.64, 12, 6);
      g.fillRect(W * 0.2 - 12, H * 0.58, 6, 10);
      g.fillRect(W * 0.2 + 8, H * 0.66, 10, 6);
      g.fillRect(W * 0.2 + 13, H * 0.6, 6, 10);
    } else {
      g.fillStyle = "#3a2a22";
      g.fillRect(0, 0, W, H);
      const r = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, 140);
      r.addColorStop(0, "#8a6a4a");
      r.addColorStop(1, "#2a1a14");
      g.fillStyle = r;
      g.fillRect(0, 0, W, H);
      drawTroll(g, img, W * 0.18, H * 0.08, W * 0.64, H * 0.84, { tint: "#f0dcb0" });
    }
  });
}

/* The courthouse clock: a white dial, Roman numerals, and the trollface
   grinning in the middle (the hands read ten past ten). */
export function clockTexture() {
  return trollCanvas("clock", 256, 256, (g, W, H, img) => {
    g.fillStyle = "#2a2a2a";
    g.beginPath();
    g.arc(128, 128, 127, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#f4efe2";
    g.beginPath();
    g.arc(128, 128, 116, 0, Math.PI * 2);
    g.fill();
    drawTroll(g, img, 62, 62, 132, 132, { alpha: 0.9 });
    g.fillStyle = "#1a1a1a";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "700 22px Georgia, serif";
    const nums = ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
    nums.forEach((n, i) => {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      g.fillText(n, 128 + Math.cos(a) * 96, 128 + Math.sin(a) * 96);
    });
    g.strokeStyle = "#1a1a1a";
    g.lineCap = "round";
    const hand = (a, len, w) => {
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(128, 128);
      g.lineTo(128 + Math.cos(a - Math.PI / 2) * len, 128 + Math.sin(a - Math.PI / 2) * len);
      g.stroke();
    };
    hand((10.17 / 12) * Math.PI * 2, 56, 6);
    hand((2 / 12) * Math.PI * 2, 80, 4);
  }, { srgb: true });
}

/* The water tower's painted trollface, and every other big painted face:
   the artwork on transparent, tinted like weathered paint. */
export function trollPaintTexture(tint = "#f2ead6") {
  return trollCanvas(`trollpaint-${tint}`, 512, 512, (g, W, H, img) => {
    g.clearRect(0, 0, W, H);
    drawTroll(g, img, 0, 0, W, H, { tint });
  });
}

/* Shop window glass: dark with a sky reflection streak (seen from outside;
   the room behind still shows through where it's thin). */
export function glassTexture() {
  return tex("glass-west", () => canvasTex(128, 128, (g, W, H) => {
    g.fillStyle = "rgba(40,52,60,.55)";
    g.fillRect(0, 0, W, H);
    const s = g.createLinearGradient(0, 0, W, H);
    s.addColorStop(0, "rgba(255,255,255,0)");
    s.addColorStop(0.42, "rgba(255,255,255,0)");
    s.addColorStop(0.5, "rgba(230,240,255,.45)");
    s.addColorStop(0.58, "rgba(255,255,255,0)");
    s.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = s;
    g.fillRect(0, 0, W, H);
  }));
}

/* Red velvet curtain folds (the piano stage). */
export function curtainTexture() {
  return tex("curtain", () => canvasTex(256, 64, (g, W, H) => {
    for (let x = 0; x < W; x++) {
      const k = 0.5 + 0.5 * Math.sin((x / W) * Math.PI * 2 * 9);
      const v = 110 + k * 90;
      g.fillStyle = `rgb(${v | 0},${(v * 0.12) | 0},${(v * 0.14) | 0})`;
      g.fillRect(x, 0, 1, H);
    }
  }, { repeat: true }));
}

/* A soft round glow (lamp halos, the forge). */
export function glowTexture() {
  return tex("glow-west", () => canvasTex(128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, "rgba(255,255,255,1)");
    r.addColorStop(0.3, "rgba(255,255,255,.5)");
    r.addColorStop(0.7, "rgba(255,255,255,.1)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
  }, { srgb: false }));
}

/* A horse's hide: the base colour with a darker dorsal shade and dapples. */
export function piebaldTexture(base, patch) {
  return tex(`hide-${base}-${patch}`, () => canvasTex(128, 128, (g, W, H) => {
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);
    if (!patch) return;
    const R = rng(base.length * 31 + patch.length);
    g.fillStyle = patch;
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      g.ellipse(R() * W, R() * H, 10 + R() * 22, 8 + R() * 18, R() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }));
}

/* Cast-iron jail bars for a cell front, alpha-cut. */
export function barsTexture() {
  return tex("bars", () => canvasTex(256, 256, (g, W, H) => {
    g.clearRect(0, 0, W, H);
    g.fillStyle = "#2a2a2c";
    for (let x = 8; x < W; x += 32) g.fillRect(x, 0, 10, H);
    g.fillRect(0, 20, W, 12);
    g.fillRect(0, H - 32, W, 12);
  }));
}

/* ==================================================================== props */

/* A barrel: staves, two iron hoops, a lid. Collides as a box. */
export function barrel(K, M, x, z, { y = 0, r = 0.36, h = 0.95, collide = true, lie = false, ry = 0 } = {}) {
  if (lie) {
    if (collide) K.api.ghostBox(x, z, Math.abs(Math.cos(ry)) * h + Math.abs(Math.sin(ry)) * r * 2, Math.abs(Math.sin(ry)) * h + Math.abs(Math.cos(ry)) * r * 2, r * 2, { y, pen: 2 });
    K.add(M.barrel, place(new THREE.CylinderGeometry(r * 0.92, r * 0.92, h, 12), { x, y: y + r * 0.92, z, rz: Math.PI / 2, ry }));
    for (const s of [-0.32, 0.32]) {
      K.add(M.iron, place(new THREE.CylinderGeometry(r * 0.95, r * 0.95, 0.05, 12), { x: x + Math.cos(ry) * s * h, y: y + r * 0.92, z: z - Math.sin(ry) * s * h, rz: Math.PI / 2, ry }));
    }
    return;
  }
  if (collide) K.api.ghostBox(x, z, r * 2, r * 2, h, { y, pen: 2 });
  // bulged staves: a lathe profile
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push(new THREE.Vector2(r * (0.86 + 0.14 * Math.sin(t * Math.PI)), t * h));
  }
  K.add(M.barrel, place(new THREE.LatheGeometry(pts, 14), { x, y, z }));
  K.add(M.barrelTop, place(new THREE.CircleGeometry(r * 0.86, 14), { x, y: y + h - 0.02, z, rx: -Math.PI / 2 }));
  for (const t of [0.18, 0.82]) {
    const rr = r * (0.86 + 0.14 * Math.sin(t * Math.PI)) + 0.012;
    K.add(M.iron, place(new THREE.CylinderGeometry(rr, rr, 0.05, 14, 1, true), { x, y: y + t * h, z }));
  }
}

/* A crate with plank faces and an X brace. */
export function crate(K, M, x, z, { y = 0, s = 0.9, ry = 0, collide = true } = {}) {
  if (collide) {
    const e = s * (Math.abs(Math.cos(ry)) + Math.abs(Math.sin(ry)));
    K.api.ghostBox(x, z, e, e, s, { y, pen: 2.5 });
  }
  K.box(M.crate, x, y, z, s, s, s, { ry });
  const c = Math.cos(ry), sn = Math.sin(ry);
  for (const side of [-1, 1]) {
    // a frame and a brace on the two faces that show most
    const fx = x + sn * side * (s / 2 + 0.01), fz = z + c * side * (s / 2 + 0.01);
    K.box(M.crateTrim, fx, y + 0.02, fz, s * 0.98, 0.1, 0.03, { ry });
    K.box(M.crateTrim, fx, y + s - 0.12, fz, s * 0.98, 0.1, 0.03, { ry });
    K.box(M.crateTrim, fx, y + s * 0.5 - 0.05, fz, s * 1.2, 0.1, 0.03, { ry, rz: Math.PI / 4 * side });
  }
}

/* Crates stacked like they were unloaded off the wagon. */
export function crateStack(K, M, x, z, R, { ry = 0 } = {}) {
  crate(K, M, x, z, { s: 0.95, ry });
  crate(K, M, x + Math.cos(ry) * 1.0, z - Math.sin(ry) * 1.0, { s: 0.85, ry: ry + 0.1 });
  if (R() < 0.7) crate(K, M, x + 0.05, z, { y: 0.95, s: 0.75, ry: ry - 0.2, collide: false });
}

/* A water trough on legs. */
export function trough(K, M, x, z, { ry = 0, len = 2.0 } = {}) {
  const along = Math.abs(Math.sin(ry)) > 0.5;
  K.api.ghostBox(x, z, along ? 0.7 : len, along ? len : 0.7, 0.7, { pen: 3 });
  const dx = along ? 0 : len, dz = along ? len : 0;
  K.box(M.weathered, x, 0.12, z, (dx || 0.7), 0.58, (dz || 0.7));
  K.box(M.water, x, 0.6, z, (dx || 0.7) - 0.12, 0.03, (dz || 0.7) - 0.12, {}, { shadow: false });
}

/* A hitching rail: two posts and a bar. */
export function hitchRail(K, M, x, z, { len = 2.6, axis = "x" } = {}) {
  const ax = axis === "x";
  K.api.ghostBox(x, z, ax ? len : 0.12, ax ? 0.12 : len, 1.0, { pen: 0.5 });
  for (const s of [-len / 2 + 0.1, len / 2 - 0.1]) K.box(M.post, x + (ax ? s : 0), 0, z + (ax ? 0 : s), 0.13, 1.05, 0.13);
  K.box(M.post, x, 0.92, z, ax ? len : 0.09, 0.09, ax ? 0.09 : len);
}

/* A black iron bollard with a ball top (Main Street's kerbs). */
export function bollard(K, M, x, z, { y = 0 } = {}) {
  K.api.ghostBox(x, z, 0.3, 0.3, 0.95, { y, pen: 8 });
  const pts = [[0.17, 0], [0.17, 0.08], [0.12, 0.12], [0.11, 0.62], [0.14, 0.66], [0.14, 0.7], [0.06, 0.74], [0.0, 0.74]].map(([a, b]) => new THREE.Vector2(a, b));
  K.add(M.blackIron, place(new THREE.LatheGeometry(pts, 12), { x, y, z }));
  K.add(M.blackIron, place(new THREE.SphereGeometry(0.11, 12, 8), { x, y: y + 0.84, z }));
}

/* A telegraph pole with two crossarms and glass insulators. Returns the
   insulator positions, for the wires. */
export function telegraphPole(K, M, x, z, { h = 7.2, ry = 0 } = {}) {
  K.api.ghostBox(x, z, 0.3, 0.3, h, { pen: 4 });
  K.cyl(M.pole, x, 0, z, 0.15, 0.11, h, 8);
  const tops = [];
  const c = Math.cos(ry), s = Math.sin(ry);
  for (const [yy, w] of [[h - 0.35, 1.9], [h - 1.0, 1.5]]) {
    K.box(M.pole, x, yy, z, 0.12 + Math.abs(c) * w, 0.12, 0.12 + Math.abs(s) * w);
    for (const k of [-0.42, -0.22, 0.22, 0.42]) {
      const ix = x + c * k * w, iz = z - s * k * w;
      K.cyl(M.insulator, ix, yy + 0.12, iz, 0.05, 0.035, 0.12, 6, {}, { shadow: false });
      tops.push(new THREE.Vector3(ix, yy + 0.22, iz));
    }
  }
  // a brace under the top arm
  K.box(M.pole, x + c * 0.25, h - 0.85, z - s * 0.25, 0.06, 0.6, 0.06, { rz: c ? 0.7 : 0, rx: s ? -0.7 : 0 });
  return tops;
}

/* A wire sagging between two points (a thin tube on a catenary-ish curve). */
export function wire(K, M, a, b, sag = 0.5) {
  const mid = a.clone().lerp(b, 0.5);
  mid.y -= sag;
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  K.add(M.wire, new THREE.TubeGeometry(curve, 14, 0.012, 3, false), { shadow: false });
}

/* An old gas street lamp on a fluted post, glass lit warm. */
export function streetLamp(K, M, x, z, { lights = null, y = 0 } = {}) {
  K.api.ghostBox(x, z, 0.24, 0.24, 3.3, { y, pen: 3 });
  K.cyl(M.blackIron, x, y, z, 0.16, 0.13, 0.5, 10);
  K.cyl(M.blackIron, x, y + 0.5, z, 0.07, 0.055, 2.6, 8);
  K.add(M.blackIron, place(new THREE.TorusGeometry(0.09, 0.02, 5, 10), { x, y: y + 2.95, z, rx: Math.PI / 2 }));
  // the lantern: a four-sided glass box under a cap
  K.box(M.blackIron, x, y + 3.0, z, 0.36, 0.05, 0.36);
  K.box(M.lampGlass, x, y + 3.05, z, 0.28, 0.42, 0.28, {}, { shadow: false });
  for (const [dx, dz] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) K.box(M.blackIron, x + dx, y + 3.05, z + dz, 0.03, 0.44, 0.03);
  K.cyl(M.blackIron, x, y + 3.47, z, 0.26, 0.04, 0.24, 4, { ry: Math.PI / 4 });
  K.add(M.blackIron, place(new THREE.SphereGeometry(0.05, 6, 4), { x, y: y + 3.74, z }));
  if (lights) {
    const l = new THREE.PointLight(0xffb86a, 6, 12, 2);
    l.position.set(x, y + 3.2, z);
    lights.push(l);
  }
}

/* A spoked wagon wheel standing in the plane `ry` (centre at y). */
export function wheel(K, M, x, y, z, { r = 0.6, ry = 0, rx = 0, rz = 0, spokes = 12 } = {}) {
  const g = [];
  g.push(new THREE.TorusGeometry(r, r * 0.06, 6, 20));
  g.push(new THREE.CylinderGeometry(r * 0.13, r * 0.13, r * 0.28, 10).rotateX(Math.PI / 2));
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    const s = new THREE.CylinderGeometry(r * 0.025, r * 0.035, r * 0.9, 4);
    s.translate(0, r * 0.5, 0);
    s.rotateZ(a);
    g.push(s);
  }
  for (const p of g) K.add(M.wheel, place(p, { x, y, z, rx, ry, rz }));
}

/* A freight wagon: a plank bed on four wheels, the tongue down in the dirt.
   `cover` adds the canvas bonnet of a prairie schooner. */
export function wagon(K, M, x, z, { ry = 0, cover = false, load = 0 } = {}) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const L = 3.4, W = 1.5;
  const ex = Math.abs(c) * L + Math.abs(s) * W, ez = Math.abs(s) * L + Math.abs(c) * W;
  K.api.ghostBox(x, z, ex, ez, cover ? 2.7 : 1.35, { pen: 2.5 });
  const at = (u, v) => [x + c * u + s * v, z - s * u + c * v];
  // bed and sides
  {
    const [bx, bz] = at(0, 0);
    K.box(M.wagonBed, bx, 0.75, bz, L, 0.12, W, { ry });
    for (const side of [-1, 1]) {
      const [sx, sz] = at(0, side * (W / 2 - 0.04));
      K.box(M.wagonSide, sx, 0.87, sz, L, 0.48, 0.08, { ry });
    }
    for (const end of [-1, 1]) {
      const [sx, sz] = at(end * (L / 2 - 0.04), 0);
      K.box(M.wagonSide, sx, 0.87, sz, 0.08, 0.48, W, { ry });
    }
  }
  // wheels: big at the back, smaller at the front
  for (const [u, r] of [[-1.05, 0.62], [1.05, 0.5]]) {
    for (const side of [-1, 1]) {
      const [wx, wz] = at(u, side * (W / 2 + 0.12));
      wheel(K, M, wx, r, wz, { r, ry: ry });
    }
    const [ax, az] = at(u, 0);
    K.box(M.iron, ax, r - 0.05, az, 0.1, 0.1, W + 0.3, { ry });
  }
  // tongue, resting on the ground
  {
    const [tx, tz] = at(L / 2 + 1.0, 0);
    K.box(M.wagonSide, tx, 0.28, tz, 2.2, 0.09, 0.09, { ry, rz: 0 });
  }
  if (cover) {
    const [cx, cz] = at(0, 0);
    const g = new THREE.CylinderGeometry(W * 0.62, W * 0.62, L * 0.92, 14, 1, true, -Math.PI / 2, Math.PI);
    K.add(M.canvasCloth, place(g, { x: cx, y: 1.32, z: cz, rz: Math.PI / 2, ry }), {});
    for (const u of [-1.2, 0, 1.2]) {
      const [hx, hz] = at(u, 0);
      K.add(M.wagonSide, place(new THREE.TorusGeometry(W * 0.63, 0.025, 4, 12, Math.PI), { x: hx, y: 1.32, z: hz, ry: ry + Math.PI / 2 }));
    }
  }
  for (let i = 0; i < load; i++) {
    const [lx, lz] = at(-1 + i * 0.95, 0);
    crate(K, M, lx, lz, { y: 0.87, s: 0.62, ry: ry + i * 0.2, collide: false });
  }
}

/* A cartoon horse, square-cut like the town (the reference's Roblox
   horses): barrel body, four legs, arched neck, a long head, mane and
   tail. Faces +x before `ry`. Collides as a box. */
export function horse(K, M, x, z, { ry = 0, coat = "bay", saddle = false, graze = false } = {}) {
  const c = Math.cos(ry), s = Math.sin(ry);
  K.api.ghostBox(x, z, Math.abs(c) * 2.3 + Math.abs(s) * 0.7, Math.abs(s) * 2.3 + Math.abs(c) * 0.7, 1.7, { pen: 2 });
  const hide = M[`horse_${coat}`] || M.horse_bay;
  const dark = M.horseDark;
  const at = (u, v) => [x + c * u + s * v, z - s * u + c * v];
  const B = (mat, u, y, v, w, h, d, rot = {}) => { const [px, pz] = at(u, v); K.box(mat, px, y, pz, w, h, d, { ry, ...rot }); };
  // body (a rounded box, two overlapping)
  B(hide, 0, 0.95, 0, 1.55, 0.62, 0.6);
  B(hide, 0.02, 1.0, 0, 1.75, 0.5, 0.52);
  // legs with dark socks and hooves
  for (const [u, v] of [[0.62, -0.18], [0.62, 0.18], [-0.62, -0.18], [-0.62, 0.18]]) {
    B(hide, u, 0.18, v, 0.16, 0.82, 0.16);
    B(dark, u, 0.0, v, 0.19, 0.2, 0.19);
  }
  // neck up and forward, head angled down (lower when grazing)
  const nk = graze ? -0.7 : 0.75;
  {
    const [px, pz] = at(0.95, 0);
    K.add(hide, place(new THREE.BoxGeometry(0.75, 0.36, 0.34), { x: px, y: graze ? 1.05 : 1.45, z: pz, ry, rz: nk }));
    const hu = graze ? 1.38 : 1.28, hy = graze ? 0.45 : 1.72;
    const [hx, hz] = at(hu, 0);
    K.add(hide, place(new THREE.BoxGeometry(0.62, 0.26, 0.26), { x: hx, y: hy, z: hz, ry, rz: graze ? -1.2 : -0.5 }));
    // ears and the mane down the neck
    for (const v of [-0.08, 0.08]) {
      const [ex, ez] = at(hu - 0.2, v);
      K.box(hide, ex, hy + (graze ? 0.2 : 0.18), ez, 0.06, 0.16, 0.06, { ry });
    }
    const [mx, mz] = at(0.88, 0);
    K.add(dark, place(new THREE.BoxGeometry(0.78, 0.12, 0.1), { x: mx, y: graze ? 1.18 : 1.6, z: mz, ry, rz: nk }));
    // eyes
    for (const v of [-0.135, 0.135]) {
      const [ex, ez] = at(hu - 0.08, v);
      K.box(M.eye, ex, hy + (graze ? -0.02 : 0.06), ez, 0.06, 0.06, 0.01, { ry });
    }
  }
  // tail
  {
    const [tx, tz] = at(-0.95, 0);
    K.add(dark, place(new THREE.BoxGeometry(0.14, 0.8, 0.14), { x: tx, y: 0.85, z: tz, ry, rz: -0.25 }));
  }
  if (saddle) {
    B(M.leather, 0.05, 1.25, 0, 0.6, 0.08, 0.64);
    B(M.leather, 0.3, 1.3, 0, 0.12, 0.14, 0.2);
    B(M.blanket, 0.05, 1.2, 0, 0.75, 0.06, 0.66);
    for (const v of [-0.33, 0.33]) B(M.leather, 0.05, 0.75, v, 0.08, 0.5, 0.03);
  }
}

/* A saguaro: ribbed trunk and arms that turn up. */
export function cactus(K, M, x, z, { h = 3.2, seed = 1, collide = true } = {}) {
  const R = rng(seed);
  if (collide) K.api.ghostBox(x, z, 0.5, 0.5, h, { pen: 2 });
  const rib = (r0, r1, len) => {
    const g = new THREE.CylinderGeometry(r1, r0, len, 10, 4);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const k = 1 + 0.09 * Math.cos(a * 10);
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    return g;
  };
  const r = 0.22;
  K.add(M.cactus, place(rib(r, r, h - r), { x, y: (h - r) / 2, z }));
  K.add(M.cactus, place(new THREE.SphereGeometry(r * 1.02, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), { x, y: h - r, z }));
  const arms = 1 + Math.floor(R() * 2.4);
  for (let i = 0; i < arms; i++) {
    const a = R() * Math.PI * 2, y0 = h * (0.35 + R() * 0.25), out = 0.55 + R() * 0.2, up = 0.7 + R() * 0.8;
    const ar = r * 0.72;
    const ox = Math.cos(a), oz = Math.sin(a);
    K.add(M.cactus, place(rib(ar, ar, out), { x: x + ox * out / 2, y: y0, z: z + oz * out / 2, rz: Math.PI / 2, ry: -a }));
    K.add(M.cactus, place(new THREE.SphereGeometry(ar, 8, 6), { x: x + ox * out, y: y0, z: z + oz * out }));
    K.add(M.cactus, place(rib(ar, ar, up), { x: x + ox * out, y: y0 + up / 2, z: z + oz * out }));
    K.add(M.cactus, place(new THREE.SphereGeometry(ar, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), { x: x + ox * out, y: y0 + up, z: z + oz * out }));
  }
}

/* A bleached steer skull with long horns (on a wall: `wall` turns it). */
export function steerSkull(K, M, x, y, z, { ry = 0, s = 1 } = {}) {
  const c = Math.cos(ry), sn = Math.sin(ry);
  K.add(M.bone, place(new THREE.SphereGeometry(0.16 * s, 10, 8), { x, y, z, ry, sx: 1, sy: 1.1, sz: 0.8 }));
  K.add(M.bone, place(new THREE.BoxGeometry(0.16 * s, 0.32 * s, 0.14 * s), { x: x + sn * 0.05 * s, y: y - 0.22 * s, z: z + c * 0.05 * s, ry, rx: 0.25 }));
  for (const side of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.12, 0.04, 0),
      new THREE.Vector3(side * 0.4, 0.08, 0.04),
      new THREE.Vector3(side * 0.62, 0.22, 0.02),
      new THREE.Vector3(side * 0.7, 0.4, -0.02),
    ].map((v) => v.multiplyScalar(s)));
    const g = new THREE.TubeGeometry(curve, 10, 0.045 * s, 6, false);
    // taper: shrink toward the tip
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = Math.floor(i / 7) / 10;
      const k = 1 - t * 0.7;
      const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
      const cp = curve.getPoint(Math.min(1, t));
      v.sub(cp).multiplyScalar(k).add(cp);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    K.add(M.horn, place(g, { x, y, z, ry }));
  }
  for (const side of [-1, 1]) K.box(M.eyeSocket, x + c * side * 0.07 * s + sn * 0.12 * s, y - 0.02, z - sn * side * 0.07 * s + c * 0.12 * s, 0.06 * s, 0.07 * s, 0.03 * s, { ry });
}

/* A boulder: a noisy icosahedron. */
export function rock(K, M, x, z, { s = 1, seed = 1, collide = true, y = 0, squash = 0.7 } = {}) {
  const R = rng(seed);
  const g = new THREE.IcosahedronGeometry(s, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = 0.78 + R() * 0.4;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * squash, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  K.add(M.rock, place(g, { x, y: y + s * squash * 0.55, z, ry: R() * 6 }));
  if (collide) K.api.ghostBox(x, z, s * 1.5, s * 1.5, s * squash * 1.4, { y, pen: 10 });
}

/* A round saloon table on a pedestal with four chairs about it. */
export function tableSet(K, M, x, y, z, { chairs = 4, r = 0.55, seed = 1, cards = false } = {}) {
  K.api.ghostBox(x, z, r * 1.6, r * 1.6, 0.78, { y, pen: 1.2 });
  K.cyl(M.furniture, x, y + 0.72, z, r, r, 0.05, 16);
  K.cyl(M.furniture, x, y + 0.08, z, 0.06, 0.06, 0.64, 8);
  K.cyl(M.furniture, x, y, z, 0.28, 0.22, 0.08, 10);
  const R = rng(seed);
  for (let i = 0; i < chairs; i++) {
    const a = (i / chairs) * Math.PI * 2 + R() * 0.4;
    chair(K, M, x + Math.cos(a) * (r + 0.35), y, z + Math.sin(a) * (r + 0.35), { ry: -a - Math.PI / 2 + (R() - 0.5) * 0.5 });
  }
  if (cards) {
    for (let i = 0; i < 5; i++) K.box(M.cards, x + (R() - 0.5) * 0.5, y + 0.775, z + (R() - 0.5) * 0.5, 0.07, 0.004, 0.1, { ry: R() * 3 }, { shadow: false });
    K.cyl(M.chips, x + 0.15, y + 0.775, z - 0.1, 0.025, 0.025, 0.06, 8);
    K.cyl(M.whiskey, x - 0.2, y + 0.775, z + 0.15, 0.035, 0.03, 0.22, 8);
  }
}

/* A spindle-back chair facing `ry` (0 = facing -z). Decoration only. */
export function chair(K, M, x, y, z, { ry = 0 } = {}) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const at = (u, v) => [x + c * u + s * v, z - s * u + c * v];
  K.box(M.chair, x, y + 0.44, z, 0.42, 0.05, 0.42, { ry });
  for (const [u, v] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
    const [px, pz] = at(u, v);
    K.box(M.chair, px, y, pz, 0.04, 0.44, 0.04, { ry });
  }
  const [bx, bz] = at(0, 0.19);
  K.box(M.chair, bx, y + 0.49, bz, 0.42, 0.06, 0.04, { ry });
  K.box(M.chair, bx, y + 0.86, bz, 0.42, 0.08, 0.04, { ry });
  for (const u of [-0.18, -0.06, 0.06, 0.18]) {
    const [sx, sz] = at(u, 0.19);
    K.box(M.chair, sx, y + 0.49, sz, 0.035, 0.38, 0.03, { ry });
  }
}

/* A bar stool. */
export function stool(K, M, x, y, z) {
  K.cyl(M.iron, x, y, z, 0.16, 0.12, 0.04, 10);
  K.cyl(M.iron, x, y, z, 0.03, 0.03, 0.72, 6);
  K.cyl(M.chair, x, y + 0.72, z, 0.19, 0.19, 0.06, 8);
}

/* An upright piano facing `ry` (0 = keys toward +z). */
export function piano(K, M, x, y, z, { ry = 0 } = {}) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const at = (u, v) => [x + c * u + s * v, z - s * u + c * v];
  const ex = Math.abs(c) * 1.55 + Math.abs(s) * 0.62, ez = Math.abs(s) * 1.55 + Math.abs(c) * 0.62;
  K.api.ghostBox(x, z, ex, ez, 1.3, { y, pen: 3 });
  K.box(M.pianoWood, x, y, z, 1.55, 1.3, 0.55, { ry });
  const [kx, kz] = at(0, 0.38);
  K.box(M.pianoWood, kx, y + 0.68, kz, 1.4, 0.06, 0.26, { ry });
  const [wx, wz] = at(0, 0.4);
  K.box(M.keysWhite, wx, y + 0.74, wz, 1.3, 0.03, 0.17, { ry });
  for (let i = 0; i < 18; i++) {
    if ([2, 6, 9, 13, 16].includes(i)) continue;
    const [bx, bz] = at(-0.62 + i * 0.073, 0.36);
    K.box(M.keysBlack, bx, y + 0.765, bz, 0.035, 0.03, 0.1, { ry });
  }
  const [mx, mz] = at(0, 0.29);
  K.box(M.sheetMusic, mx, y + 0.95, mz, 0.42, 0.28, 0.01, { ry, rx: -0.2 });
  // the stool
  const [sx, sz] = at(0, 0.85);
  K.cyl(M.pianoWood, sx, y, sz, 0.05, 0.05, 0.5, 6);
  K.cyl(M.velvet, sx, y + 0.5, sz, 0.2, 0.2, 0.08, 10);
}

/* A wagon-wheel chandelier hung on chains, glass lamps round the rim.
   One real light (the caller's `lights`). */
export function chandelier(K, M, x, y, z, { r = 0.9, lights = null, power = 10, range = 13 } = {}) {
  wheel(K, M, x, y, z, { r, rx: Math.PI / 2, spokes: 8 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const chain = new THREE.Vector3(x + Math.cos(a) * r * 0.9, y, z + Math.sin(a) * r * 0.9);
    const top = new THREE.Vector3(x, y + 1.0, z);
    const g = new THREE.CylinderGeometry(0.01, 0.01, chain.distanceTo(top), 3);
    g.translate(0, chain.distanceTo(top) / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(chain).normalize()));
    g.translate(chain.x, chain.y, chain.z);
    K.add(M.iron, g, { shadow: false });
  }
  K.cyl(M.iron, x, y + 1.0, z, 0.012, 0.012, 2.0, 3, {}, { shadow: false });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const lx = x + Math.cos(a) * r, lz = z + Math.sin(a) * r;
    K.cyl(M.brass, lx, y + 0.04, lz, 0.06, 0.04, 0.05, 8);
    K.cyl(M.lampGlass, lx, y + 0.09, lz, 0.05, 0.06, 0.18, 8, {}, { shadow: false });
  }
  if (lights) {
    const l = new THREE.PointLight(0xffc27a, power, range, 1.6);
    l.position.set(x, y - 0.2, z);
    lights.push(l);
  }
}

/* A brass wall sconce with a lit glass chimney; `ry` faces it out from
   the wall. */
export function sconce(K, M, x, y, z, { ry = 0 } = {}) {
  const c = Math.cos(ry), s = Math.sin(ry);
  K.box(M.furniture, x, y - 0.18, z, 0.16, 0.32, 0.04, { ry });
  K.box(M.brass, x + s * 0.1, y - 0.04, z + c * 0.1, 0.04, 0.04, 0.2, { ry });
  K.cyl(M.brass, x + s * 0.18, y, z + c * 0.18, 0.07, 0.05, 0.04, 8);
  K.cyl(M.lampGlass, x + s * 0.18, y + 0.04, z + c * 0.18, 0.045, 0.055, 0.16, 8, {}, { shadow: false });
}

/* A split-rail fence along `axis` at `at` from a to b (gaps are runs left
   out). Stops bodies, barely slows a bullet. */
export function railFence(K, M, { axis, at, a, b, gaps = [], h = 1.15 }) {
  const ax = axis === "x";
  for (const [s, e] of runs(a, b, gaps)) {
    const len = e - s, c = (s + e) / 2;
    if (len < 0.3) continue;
    K.api.ghostBox(ax ? c : at, ax ? at : c, ax ? len : 0.14, ax ? 0.14 : len, h, { pen: 0.4 });
    const n = Math.max(1, Math.round(len / 2.4));
    for (let i = 0; i <= n; i++) {
      const p = s + (len * i) / n;
      K.box(M.post, ax ? p : at, 0, ax ? at : p, 0.13, h + 0.08, 0.13);
    }
    for (const y of [0.42, 0.88]) K.box(M.rail, ax ? c : at, y, ax ? at : c, ax ? len : 0.08, 0.09, ax ? 0.08 : len);
  }
}

/* A picket fence (the houses' front yards), whitewashed. */
export function picketFence(K, M, { axis, at, a, b, gaps = [] }) {
  const ax = axis === "x";
  for (const [s, e] of runs(a, b, gaps)) {
    const len = e - s, c = (s + e) / 2;
    if (len < 0.2) continue;
    K.api.ghostBox(ax ? c : at, ax ? at : c, ax ? len : 0.1, ax ? 0.1 : len, 0.95, { pen: 0.3 });
    for (const y of [0.3, 0.68]) K.box(M.picket, ax ? c : at, y, ax ? at : c, ax ? len : 0.03, 0.07, ax ? 0.03 : len);
    for (let p = s + 0.08; p < e; p += 0.17) {
      K.box(M.picket, ax ? p : at, 0, ax ? at : p, ax ? 0.08 : 0.025, 0.86, ax ? 0.025 : 0.08, {}, { shadow: false });
    }
  }
}

/* A hay bale. */
export function hayBale(K, M, x, z, { y = 0, ry = 0, collide = true } = {}) {
  const w = 1.2, h = 0.6, d = 0.75;
  if (collide) {
    const along = Math.abs(Math.sin(ry)) > 0.5;
    K.api.ghostBox(x, z, along ? d : w, along ? w : d, h, { y, pen: 1.4 });
  }
  K.box(M.hay, x, y, z, w, h, d, { ry });
  for (const u of [-0.3, 0.3]) K.box(M.twine, x + Math.cos(ry) * u, y - 0.005, z - Math.sin(ry) * u, 0.03, h + 0.01, d + 0.01, { ry }, { shadow: false });
}

/* A log, lying along `ry`. */
export function log(K, M, x, y, z, { r = 0.22, len = 4, ry = 0 } = {}) {
  K.add(M.bark, place(new THREE.CylinderGeometry(r, r * 1.05, len, 9), { x, y: y + r, z, rz: Math.PI / 2, ry }));
  for (const end of [-1, 1]) {
    K.add(M.logEnd, place(new THREE.CircleGeometry(r * 0.98, 9), { x: x + Math.cos(ry) * end * (len / 2 + 0.005), y: y + r, z: z - Math.sin(ry) * end * (len / 2 + 0.005), ry: ry + end * Math.PI / 2 }), { shadow: false });
  }
}

/* A coffin standing on end or lying down (the undertaker's). */
export function coffin(K, M, x, y, z, { ry = 0, stand = false, open = false } = {}) {
  const shape = [[-0.24, 0], [0.24, 0], [0.34, 1.45], [0.22, 1.9], [-0.22, 1.9], [-0.34, 1.45]];
  const g = prismGeo(shape, 0.36);
  if (stand) K.add(M.coffin, place(g, { x, y, z, ry }));
  else K.add(M.coffin, place(g, { x, y: y + 0.18, z, ry, rx: -Math.PI / 2 }));
  if (open && stand) {
    const lid = prismGeo(shape, 0.05);
    K.add(M.coffinLid, place(lid, { x: x + Math.cos(ry) * 0.35, y, z: z - Math.sin(ry) * 0.35 + 0.25, ry: ry - 1.2 }));
  }
}
