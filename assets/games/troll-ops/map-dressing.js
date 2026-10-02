// Troll Forces — map dressing (map detail pass, phase 5: the PvP second pass).
//
// Ground decals and loose clutter, laid over a finished map. A map opts in
// with a `dress` spec; buildMap calls dressMap once the map has built, so the
// scatter can read every collider and keep clear of walls, cover and spawns.
//
// Everything here is decoration: no colliders, nothing taller than a shin,
// so gameplay, sight lines and spawns don't move. It's cheap too:
//   - every decal on a map is ONE merged mesh off one canvas atlas;
//   - every clutter kind is ONE InstancedMesh, thinned by graphics tier
//     (userData.clutter, game.js applyClutter), and casts no shadow.
//
// Spec (all optional):
//   dress: {
//     seed: 7,
//     spawnPad: 3,                  // metres kept clear round each spawn
//     areas: { name: [x0, z0, x1, z1, y?] },   // scatter rects (y = floor height, default 0)
//     avoid: [[x0, z0, x1, z1], ...],          // never scatter in these
//     decals: [{ cell, n, area?, size: [min, max], stretch?, color?, colors?, alpha? }],
//     place:  [{ cell, x, z, y?, size | w + d, rot?, color?, alpha?, wall? }],
//     clutter: [{ kind, n, area?, size: [min, max], colors?, pad? }],
//   }
// `area` names an entry in `areas` (or an array of names); none = the whole
// map. `wall: yaw` stands a placed decal upright, facing yaw (0 = +z).

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/* ------------------------------------------------------------- the atlas */
// 4 x 4 cells of 256 px. Most are drawn white on clear so each decal is
// tinted by its vertex colour; leaves and the paint splats carry their own.
export const DECAL = {
  crack: 0, oil: 1, tyre: 2, scorch: 3,
  grin: 4, puddle: 5, dirt: 6, leaves: 7,
  steps: 8, ripples: 9, splat: 10, drain: 11,
  stripe: 12, wrack: 13, streak: 14, tag: 15,
};

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

let atlasTex = null;
function decalAtlas() {
  if (atlasTex) return atlasTex;
  const C = 256;
  const c = document.createElement("canvas");
  c.width = c.height = C * 4;
  const g = c.getContext("2d");
  const r = rng(4242);
  const cell = (i, draw) => {
    g.save();
    g.translate((i % 4) * C, Math.floor(i / 4) * C);
    g.beginPath(); g.rect(0, 0, C, C); g.clip();
    draw();
    g.restore();
  };
  const blot = (cx, cy, rad, alpha, lobes = 9, rough = 0.35) => {
    // an irregular soft-edged blob
    const grd = g.createRadialGradient(cx, cy, rad * 0.15, cx, cy, rad);
    grd.addColorStop(0, `rgba(255,255,255,${alpha})`);
    grd.addColorStop(0.7, `rgba(255,255,255,${alpha * 0.75})`);
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.beginPath();
    const ph = r() * 6;
    for (let k = 0; k <= 48; k++) {
      const a = (k / 48) * Math.PI * 2;
      const w = 1 + rough * (Math.sin(a * lobes * 0.5 + ph) * 0.5 + Math.sin(a * lobes + ph * 2) * 0.3 + (r() - 0.5) * 0.25);
      const x = cx + Math.cos(a) * rad * w, y = cy + Math.sin(a) * rad * w;
      k ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.fill();
  };
  const W = (a) => `rgba(255,255,255,${a})`;

  // 0 crack: a branching hairline
  cell(DECAL.crack, () => {
    g.strokeStyle = W(0.95); g.lineCap = "round";
    const branch = (x, y, a, len, w, depth) => {
      let px = x, py = y;
      const steps = 6 + Math.floor(r() * 4);
      for (let s = 0; s < steps; s++) {
        a += (r() - 0.5) * 0.9;
        const nx = px + Math.cos(a) * len / steps, ny = py + Math.sin(a) * len / steps;
        g.lineWidth = Math.max(0.8, w * (1 - s / steps));
        g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
        if (depth < 2 && r() < 0.28) branch(nx, ny, a + (r() < 0.5 ? 1 : -1) * (0.6 + r() * 0.6), len * 0.45, w * 0.6, depth + 1);
        px = nx; py = ny;
      }
    };
    branch(128, 128, r() * 6, 120, 4, 0);
    branch(128, 128, r() * 6 + Math.PI, 110, 3.5, 0);
  });
  // 1 oil: a dark stain with a darker core and a few drips
  cell(DECAL.oil, () => {
    blot(128, 128, 100, 0.55, 7, 0.4);
    blot(122, 132, 56, 0.6, 5, 0.5);
    for (let k = 0; k < 6; k++) blot(40 + r() * 176, 40 + r() * 176, 8 + r() * 10, 0.6, 5, 0.3);
  });
  // 2 tyre: two tread strips running the cell's length (stretch it along z)
  cell(DECAL.tyre, () => {
    for (const x0 of [56, 168]) {
      for (let y = 0; y < 256; y += 9) {
        const a = 0.5 + 0.35 * Math.sin(y * 0.03 + x0);
        g.fillStyle = W(a);
        g.fillRect(x0 - 16, y, 32, 5);
        g.fillStyle = W(a * 0.6);
        g.fillRect(x0 - 16, y + 5, 32, 4);
      }
    }
    // fade both ends so a strip doesn't stop dead
    g.globalCompositeOperation = "destination-in";
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, "rgba(0,0,0,0)"); grd.addColorStop(0.2, "rgba(0,0,0,1)");
    grd.addColorStop(0.8, "rgba(0,0,0,1)"); grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    g.globalCompositeOperation = "source-over";
  });
  // 3 scorch: a burn with a sooty ring and splash marks
  cell(DECAL.scorch, () => {
    blot(128, 128, 112, 0.5, 11, 0.3);
    blot(128, 128, 70, 0.75, 9, 0.35);
    for (let k = 0; k < 14; k++) {
      const a = r() * 6.28, d = 70 + r() * 40;
      g.strokeStyle = W(0.4); g.lineWidth = 2 + r() * 4;
      g.beginPath(); g.moveTo(128 + Math.cos(a) * 50, 128 + Math.sin(a) * 50);
      g.lineTo(128 + Math.cos(a) * d, 128 + Math.sin(a) * d); g.stroke();
    }
  });
  // 4 grin: the trollface sprayed (same marks as the island's plazas)
  cell(DECAL.grin, () => {
    g.strokeStyle = W(0.92); g.lineCap = "round"; g.lineJoin = "round";
    g.lineWidth = 9;
    g.beginPath(); g.ellipse(128, 132, 104, 96, 0, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 8;
    g.beginPath(); g.moveTo(52, 140); g.quadraticCurveTo(128, 236, 206, 132); g.lineTo(52, 140); g.stroke();
    for (let k = 0; k < 7; k++) { const x = 70 + k * 19; g.beginPath(); g.moveTo(x, 142); g.lineTo(x + 2, 168 + Math.sin(k / 6 * Math.PI) * 16); g.stroke(); }
    g.lineWidth = 7;
    for (const ex of [88, 168]) { g.beginPath(); g.ellipse(ex, 92, 20, 10, ex < 128 ? 0.25 : -0.25, 0, Math.PI * 2); g.stroke(); }
    g.beginPath(); g.moveTo(62, 66); g.lineTo(108, 76); g.moveTo(194, 66); g.lineTo(148, 76); g.stroke();
    // overspray drips
    for (let k = 0; k < 9; k++) { const x = 40 + r() * 176; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 200 + r() * 20); g.lineTo(x, 214 + r() * 34); g.stroke(); }
  });
  // 5 puddle: a smooth dark wet patch
  cell(DECAL.puddle, () => { blot(128, 128, 108, 0.7, 5, 0.28); blot(150, 110, 50, 0.4, 4, 0.3); });
  // 6 dirt: blotchy muck, speckled
  cell(DECAL.dirt, () => {
    for (let k = 0; k < 7; k++) blot(60 + r() * 136, 60 + r() * 136, 30 + r() * 50, 0.35, 6, 0.45);
    for (let k = 0; k < 260; k++) { g.fillStyle = W(0.2 + r() * 0.5); const d = 1 + r() * 3; g.fillRect(20 + r() * 216, 20 + r() * 216, d, d); }
  });
  // 7 leaves: a drift of autumn leaves (coloured; tint white)
  cell(DECAL.leaves, () => {
    for (let k = 0; k < 70; k++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * 100;
      const x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d;
      g.save(); g.translate(x, y); g.rotate(r() * 6.28);
      g.fillStyle = `hsl(${12 + r() * 38}, ${55 + r() * 30}%, ${30 + r() * 25}%)`;
      g.beginPath(); g.ellipse(0, 0, 9 + r() * 5, 4 + r() * 2, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "rgba(60,30,10,0.6)"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-10, 0); g.lineTo(10, 0); g.stroke();
      g.restore();
    }
  });
  // 8 steps: a trail of footprints up the cell (stretch it along z)
  cell(DECAL.steps, () => {
    for (let k = 0; k < 6; k++) {
      const y = 228 - k * 42, x = 128 + (k % 2 ? 22 : -22) + (r() - 0.5) * 6;
      g.fillStyle = W(0.65);
      g.beginPath(); g.ellipse(x, y, 11, 17, (r() - 0.5) * 0.3, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(x, y + 22, 8, 9, 0, 0, Math.PI * 2); g.fill();
    }
  });
  // 9 ripples: wind ripples in sand, wavy bands
  cell(DECAL.ripples, () => {
    for (let y = 8; y < 256; y += 14) {
      g.strokeStyle = W(0.55); g.lineWidth = 4;
      g.beginPath();
      for (let x = 0; x <= 256; x += 8) {
        const yy = y + Math.sin(x * 0.045 + y * 0.3) * 5 + Math.sin(x * 0.11) * 2;
        x ? g.lineTo(x, yy) : g.moveTo(x, yy);
      }
      g.stroke();
    }
    g.globalCompositeOperation = "destination-in";
    const grd = g.createRadialGradient(128, 128, 30, 128, 128, 128);
    grd.addColorStop(0, "rgba(0,0,0,1)"); grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    g.globalCompositeOperation = "source-over";
  });
  // 10 splat: a spray-paint splat in three colours (tint white)
  cell(DECAL.splat, () => {
    const hues = [[255, 70, 140], [70, 220, 120], [80, 170, 255]];
    hues.forEach(([R, G, B], i) => {
      const cx = 80 + i * 48 + (r() - 0.5) * 20, cy = 100 + (r() - 0.5) * 60;
      g.fillStyle = `rgba(${R},${G},${B},0.85)`;
      g.beginPath(); g.arc(cx, cy, 26 + r() * 14, 0, 6.28); g.fill();
      for (let k = 0; k < 12; k++) { const a = r() * 6.28, d = 30 + r() * 40; g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 2 + r() * 6, 0, 6.28); g.fill(); }
    });
  });
  // 11 drain: a round grate
  cell(DECAL.drain, () => {
    g.fillStyle = W(0.9); g.beginPath(); g.arc(128, 128, 110, 0, 6.28); g.fill();
    g.globalCompositeOperation = "destination-out";
    g.fillStyle = "rgba(0,0,0,0.75)";
    for (let k = -4; k <= 4; k++) g.fillRect(128 + k * 20 - 5, 50, 10, 156);
    g.globalCompositeOperation = "source-over";
    g.strokeStyle = W(1); g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 104, 0, 6.28); g.stroke();
  });
  // 12 stripe: worn road paint (stretch it along z)
  cell(DECAL.stripe, () => {
    g.fillStyle = W(0.9); g.fillRect(84, 0, 88, 256);
    g.globalCompositeOperation = "destination-out";
    for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(0,0,0,${0.3 + r() * 0.7})`; const d = 2 + r() * 7; g.fillRect(84 + r() * 88, r() * 256, d, d); }
    g.globalCompositeOperation = "source-over";
  });
  // 13 wrack: a tideline of seaweed bits and shell grit (stretch it along x)
  cell(DECAL.wrack, () => {
    for (let k = 0; k < 160; k++) {
      const x = r() * 256, y = 128 + (r() - 0.5) * 60 * (0.4 + r());
      g.save(); g.translate(x, y); g.rotate((r() - 0.5) * 1.2);
      g.fillStyle = W(0.5 + r() * 0.45);
      g.beginPath(); g.ellipse(0, 0, 4 + r() * 12, 1.5 + r() * 3, 0, 0, 6.28); g.fill();
      g.restore();
    }
  });
  // 14 streak: a long soft water/rust streak (for walls)
  cell(DECAL.streak, () => {
    for (let k = 0; k < 7; k++) {
      const x = 70 + r() * 116, w = 6 + r() * 18;
      const grd = g.createLinearGradient(0, 0, 0, 256);
      grd.addColorStop(0, W(0.6)); grd.addColorStop(1, W(0));
      g.fillStyle = grd; g.fillRect(x, 0, w, 120 + r() * 136);
    }
  });
  // 15 tag: a scrawled graffiti tag (for walls)
  cell(DECAL.tag, () => {
    g.strokeStyle = W(0.95); g.lineCap = "round"; g.lineJoin = "round"; g.lineWidth = 11;
    // "lol" in bubble-ish strokes, then an underline swoosh
    g.beginPath(); g.moveTo(40, 70); g.lineTo(46, 170); g.lineTo(84, 166); g.stroke();
    g.beginPath(); g.ellipse(128, 136, 30, 36, 0.1, 0, 6.28); g.stroke();
    g.beginPath(); g.moveTo(180, 64); g.lineTo(188, 170); g.lineTo(222, 164); g.stroke();
    g.lineWidth = 7;
    g.beginPath(); g.moveTo(30, 200); g.bezierCurveTo(90, 230, 170, 180, 232, 206); g.stroke();
    for (const x of [62, 140, 210]) { g.lineWidth = 3; g.beginPath(); g.moveTo(x, 172); g.lineTo(x + 1, 190 + r() * 20); g.stroke(); }
  });

  atlasTex = new THREE.CanvasTexture(c);
  atlasTex.colorSpace = THREE.SRGBColorSpace;
  atlasTex.anisotropy = 4;
  return atlasTex;
}

/* ------------------------------------------------------------ clutter kinds */
// Each kind: a geometry, lying on y = 0 at unit size, and a material (shared
// across maps). Instance colour carries the per-map palette.

function lumpy(g, r, amt) {
  const p = g.attributes.position, seen = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!seen.has(k)) seen.set(k, 1 + (r() - 0.5) * amt);
    const s = seen.get(k);
    p.setXYZ(i, p.getX(i) * s, p.getY(i) * s, p.getZ(i) * s);
  }
  g.computeVertexNormals();
  return g;
}

const flat = (g) => (g.index ? g.toNonIndexed() : g);
const merge = (parts) => mergeGeometries(parts.map((p) => { const q = flat(p); q.deleteAttribute("uv"); return q; }), false);

let tuftTex = null;
function tuftTexture() {
  if (tuftTex) return tuftTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const r = rng(78);
  for (let k = 0; k < 22; k++) {
    const x = 6 + r() * 52, lean = (r() - 0.5) * 18, h = 26 + r() * 34;
    const l = 60 + r() * 40;
    g.strokeStyle = `rgb(${l * 2.2},${l * 2.4},${l * 2.1})`;
    g.lineWidth = 2 + r() * 2;
    g.beginPath(); g.moveTo(x, 64); g.quadraticCurveTo(x + lean * 0.3, 64 - h * 0.6, x + lean, 64 - h); g.stroke();
  }
  tuftTex = new THREE.CanvasTexture(c);
  tuftTex.colorSpace = THREE.SRGBColorSpace;
  return tuftTex;
}

let towelTex = null;
function towelTexture() {
  if (towelTex) return towelTex;
  const c = document.createElement("canvas");
  c.width = 32; c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, 32, 128);
  g.fillStyle = "#c8c8c8";
  for (let y = 10; y < 128; y += 22) g.fillRect(0, y, 32, 8);
  g.fillStyle = "#f4f4f4"; g.fillRect(0, 0, 32, 4); g.fillRect(0, 124, 32, 4);
  towelTex = new THREE.CanvasTexture(c);
  towelTex.colorSpace = THREE.SRGBColorSpace;
  return towelTex;
}

const KIND_CACHE = new Map();
function kind(name) {
  if (KIND_CACHE.has(name)) return KIND_CACHE.get(name);
  const r = rng(name.length * 97 + name.charCodeAt(0));
  const lambert = (o = {}) => new THREE.MeshLambertMaterial(o);
  let geo, mat, tilt = 0, sink = 0;
  switch (name) {
    case "pebble": {          // a lumpy stone, 1 m across at size 1
      geo = lumpy(new THREE.IcosahedronGeometry(0.5, 0), r, 0.45);
      geo.scale(1, 0.55, 0.8); geo.translate(0, 0.12, 0);
      mat = lambert({ flatShading: true }); sink = 0.06; tilt = 0.3;
      break;
    }
    case "rubble": {          // a few broken concrete chunks
      const parts = [];
      for (let k = 0; k < 4; k++) {
        const b = new THREE.BoxGeometry(0.3 + r() * 0.25, 0.12 + r() * 0.12, 0.25 + r() * 0.2);
        b.rotateY(r() * 3); b.rotateZ((r() - 0.5) * 0.5);
        b.translate((r() - 0.5) * 0.6, 0.06, (r() - 0.5) * 0.6);
        parts.push(b);
      }
      geo = merge(parts); mat = lambert({ flatShading: true });
      break;
    }
    case "can": {             // a crushed drink can on its side
      geo = new THREE.CylinderGeometry(0.033, 0.033, 0.12, 8);
      geo.scale(1, 1, 0.75); geo.rotateZ(Math.PI / 2); geo.translate(0, 0.026, 0);
      mat = lambert();
      break;
    }
    case "bottle": {
      const body = new THREE.CylinderGeometry(0.035, 0.035, 0.2, 8); body.translate(0, 0, 0);
      const neck = new THREE.CylinderGeometry(0.012, 0.03, 0.09, 8); neck.translate(0, 0.14, 0);
      geo = merge([body, neck]); geo.rotateZ(Math.PI / 2); geo.translate(0, 0.035, 0);
      mat = new THREE.MeshStandardMaterial({ roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.8 });
      break;
    }
    case "paper": {           // a sheet of litter, a little crumpled
      geo = new THREE.PlaneGeometry(0.24, 0.3, 2, 2);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, (r() - 0.3) * 0.04);
      geo.rotateX(-Math.PI / 2); geo.translate(0, 0.012, 0); geo.computeVertexNormals();
      mat = lambert({ side: THREE.DoubleSide });
      break;
    }
    case "plank": {           // a timber offcut
      geo = new THREE.BoxGeometry(0.09, 0.04, 1); geo.translate(0, 0.02, 0);
      mat = lambert();
      break;
    }
    case "rebar": {           // a bent bar
      const a = new THREE.CylinderGeometry(0.012, 0.012, 1.1, 5); a.rotateZ(Math.PI / 2); a.translate(0, 0.012, 0);
      const b = new THREE.CylinderGeometry(0.012, 0.012, 0.35, 5); b.rotateZ(Math.PI / 2); b.rotateY(0.7); b.translate(0.62, 0.012, 0.12);
      geo = merge([a, b]); mat = lambert();
      break;
    }
    case "cone": {            // a traffic cone, 0.5 m
      const base = new THREE.BoxGeometry(0.36, 0.04, 0.36); base.translate(0, 0.02, 0);
      const body = new THREE.CylinderGeometry(0.03, 0.13, 0.46, 12); body.translate(0, 0.27, 0);
      geo = merge([base, body]); mat = lambert();
      break;
    }
    case "tuft": case "weed": {   // crossed blades; weed = dry and taller
      geo = mergeGeometries([0, 1, 2].map((k) => {
        const g = new THREE.PlaneGeometry(0.7, 0.5); g.translate(0, 0.25, 0); g.rotateY((k / 3) * Math.PI); return g;
      }), false);
      if (name === "weed") geo.scale(1.2, 1.4, 1.2);
      mat = lambert({ map: tuftTexture(), alphaTest: 0.45, side: THREE.DoubleSide });
      break;
    }
    case "shrub": {           // a scrubby desert bush
      const parts = [];
      for (let k = 0; k < 3; k++) {
        const b = lumpy(new THREE.IcosahedronGeometry(0.28, 1), r, 0.5);
        b.scale(1, 0.7, 1); b.translate((r() - 0.5) * 0.4, 0.17, (r() - 0.5) * 0.4); parts.push(b);
      }
      geo = merge(parts); mat = lambert({ flatShading: true });
      break;
    }
    case "jar": {             // a clay pot
      const pts = [[0, 0], [0.16, 0.01], [0.24, 0.12], [0.25, 0.26], [0.17, 0.42], [0.11, 0.48], [0.13, 0.52], [0.1, 0.53]]
        .map(([x, y]) => new THREE.Vector2(x, y));
      geo = new THREE.LatheGeometry(pts, 12); mat = lambert({ side: THREE.DoubleSide });
      break;
    }
    case "basket": {
      const b = new THREE.CylinderGeometry(0.24, 0.19, 0.22, 10, 1, true); b.translate(0, 0.11, 0);
      const f = new THREE.CircleGeometry(0.19, 10); f.rotateX(-Math.PI / 2); f.translate(0, 0.01, 0);
      geo = merge([b, f]); mat = lambert({ side: THREE.DoubleSide });
      break;
    }
    case "cardboard": {       // a closed box, flaps a little proud
      const b = new THREE.BoxGeometry(0.5, 0.36, 0.4); b.translate(0, 0.18, 0);
      const t = new THREE.BoxGeometry(0.52, 0.015, 0.06); t.translate(0, 0.365, 0);
      geo = merge([b, t]); mat = lambert();
      break;
    }
    case "pallet": {          // an empty pallet lying flat
      const parts = [];
      for (const x of [-0.5, 0, 0.5]) { const s = new THREE.BoxGeometry(0.1, 0.08, 1); s.translate(x, 0.04, 0); parts.push(s); }
      for (let k = 0; k < 5; k++) { const t = new THREE.BoxGeometry(1.2, 0.025, 0.14); t.translate(0, 0.093, -0.42 + k * 0.21); parts.push(t); }
      geo = merge(parts); mat = lambert();
      break;
    }
    case "shell": {
      geo = new THREE.SphereGeometry(0.06, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2);
      geo.scale(1, 0.45, 0.8); mat = lambert({ side: THREE.DoubleSide });
      break;
    }
    case "seaweed": {         // a washed-up clump of kelp: flat, ragged fronds
      const parts = [];
      for (let k = 0; k < 6; k++) {
        const b = lumpy(new THREE.IcosahedronGeometry(0.12, 0), r, 0.5);
        b.scale(1.1 + r() * 0.8, 0.16, 0.6); b.rotateY(r() * 6);
        b.translate((r() - 0.5) * 0.35, 0.02, (r() - 0.5) * 0.35); parts.push(b);
      }
      geo = merge(parts); mat = lambert({ flatShading: true });
      break;
    }
    case "towel": {           // a beach towel, 0.9 x 1.8, striped
      geo = new THREE.PlaneGeometry(0.9, 1.8); geo.rotateX(-Math.PI / 2); geo.translate(0, 0.015, 0);
      mat = lambert({ map: towelTexture() });
      break;
    }
    case "bucket": {          // a sand bucket and its spade
      const b = new THREE.CylinderGeometry(0.11, 0.08, 0.18, 10); b.translate(0, 0.09, 0);
      const h = new THREE.TorusGeometry(0.1, 0.008, 4, 10, Math.PI); h.translate(0, 0.18, 0);
      const s = new THREE.BoxGeometry(0.08, 0.01, 0.3); s.rotateX(0.2); s.translate(0.22, 0.03, 0);
      geo = merge([b, h, s]); mat = lambert();
      break;
    }
    case "castle": {          // a sandcastle: a keep and four turrets
      const parts = [];
      const keep = new THREE.CylinderGeometry(0.22, 0.28, 0.3, 8); keep.translate(0, 0.15, 0); parts.push(keep);
      for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
        const t = new THREE.CylinderGeometry(0.09, 0.11, 0.22, 7); t.translate(x, 0.11, z); parts.push(t);
        const c = new THREE.ConeGeometry(0.1, 0.12, 7); c.translate(x, 0.28, z); parts.push(c);
      }
      const wall = new THREE.TorusGeometry(0.42, 0.05, 4, 16); wall.rotateX(Math.PI / 2); wall.translate(0, 0.03, 0); parts.push(wall);
      geo = merge(parts); mat = lambert({ flatShading: true });
      break;
    }
    case "ball": {            // a beach ball
      geo = new THREE.SphereGeometry(0.2, 12, 8);
      const col = [], p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const seg = Math.floor(((Math.atan2(p.getZ(i), p.getX(i)) + Math.PI) / (Math.PI * 2)) * 6) % 2;
        const c = seg ? 1 : 0.35;
        col.push(c, c, c);
      }
      geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      geo.translate(0, 0.2, 0);
      mat = lambert({ vertexColors: true });
      break;
    }
    case "leafpile": {        // a heap of raked leaves
      geo = lumpy(new THREE.SphereGeometry(0.5, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), r, 0.35);
      geo.scale(1, 0.35, 0.8); mat = lambert({ flatShading: true });
      break;
    }
    case "hose": {            // a coiled garden hose
      const parts = [];
      for (let k = 0; k < 4; k++) { const t = new THREE.TorusGeometry(0.22 + k * 0.035, 0.016, 4, 16); t.rotateX(Math.PI / 2); t.translate(0, 0.016 + k * 0.002, 0); parts.push(t); }
      geo = merge(parts); mat = lambert();
      break;
    }
    case "ticket": {          // a dropped ticket / flyer, small
      geo = new THREE.PlaneGeometry(0.08, 0.05); geo.rotateX(-Math.PI / 2); geo.translate(0, 0.005, 0);
      mat = lambert({ side: THREE.DoubleSide });
      break;
    }
    default: throw new Error(`map-dressing: no clutter kind "${name}"`);
  }
  geo.computeBoundingSphere();
  const out = { geo, mat, tilt, sink };
  KIND_CACHE.set(name, out);
  return out;
}

/* ------------------------------------------------------------------ dress */

// How much clutter each graphics tier keeps (ultra keeps it all).
const CLUTTER_SHARE = { low: 0.4, medium: 0.7, high: 1 };

export function dressMap(root, colliders, map) {
  const spec = map.dress;
  if (!spec) return;
  const r = rng(spec.seed ?? 11);
  const B = map.bounds;
  const spawnPad = spec.spawnPad ?? 3;
  const spawns = (map.spawns || []).map(([x, z]) => [x, z]);
  const avoid = spec.avoid || [];
  const areas = spec.areas || {};
  const whole = [B.minX + 1, B.minZ + 1, B.maxX - 1, B.maxZ - 1, 0];

  // Is (x, z) at floor height y clear of every collider (padded), spawn and
  // avoid rect? A collider topping out at or below the floor is the floor
  // itself (a platform, a deck) and doesn't count.
  const clear = (x, z, y, pad) => {
    if (x < B.minX + pad || x > B.maxX - pad || z < B.minZ + pad || z > B.maxZ - pad) return false;
    for (const [ax, az, bx, bz] of avoid) if (x > ax - pad && x < bx + pad && z > az - pad && z < bz + pad) return false;
    for (const [sx, sz] of spawns) if ((x - sx) ** 2 + (z - sz) ** 2 < spawnPad * spawnPad) return false;
    for (const c of colliders) {
      if (c.max.y <= y + 0.05 || c.min.y > y + 0.9) continue;
      if (x > c.min.x - pad && x < c.max.x + pad && z > c.min.z - pad && z < c.max.z + pad) return false;
    }
    return true;
  };
  const rectsOf = (area) => {
    if (!area) return [whole];
    return [].concat(area).map((a) => {
      const rr = areas[a];
      if (!rr) throw new Error(`map-dressing: no area "${a}"`);
      return [rr[0], rr[1], rr[2], rr[3], rr[4] ?? 0];
    });
  };
  // n spots, spread across the area's rects by their size
  const scatter = (n, area, pad) => {
    const rects = rectsOf(area);
    const wts = rects.map(([ax, az, bx, bz]) => Math.max(0, bx - ax) * Math.max(0, bz - az));
    const tot = wts.reduce((a, b) => a + b, 0) || 1;
    const out = [];
    for (let tries = 0; tries < n * 40 && out.length < n; tries++) {
      let pick = r() * tot, k = 0;
      while (k < rects.length - 1 && pick > wts[k]) { pick -= wts[k]; k++; }
      const [ax, az, bx, bz, y] = rects[k];
      const x = ax + r() * (bx - ax), z = az + r() * (bz - az);
      if (clear(x, z, y, pad)) out.push([x, y, z]);
    }
    return out;
  };

  /* ---- decals: one merged mesh */
  const quads = [];
  const col = new THREE.Color();
  const quad = (cellIdx, x, y, z, w, d, rot, color, alpha, wall) => {
    const g = new THREE.PlaneGeometry(w, d);
    const u0 = (cellIdx % 4) / 4, v0 = 1 - (Math.floor(cellIdx / 4) + 1) / 4;
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * 0.25, v0 + uv.getY(i) * 0.25);
    if (wall == null) { g.rotateX(-Math.PI / 2); g.rotateY(rot); } else { g.rotateZ(rot); g.rotateY(wall); }
    g.translate(x, y, z);
    col.set(color ?? 0x000000);
    const n = g.attributes.position.count, cols = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) cols.set([col.r, col.g, col.b, alpha ?? 1], i * 4);
    g.setAttribute("color", new THREE.BufferAttribute(cols, 4));
    quads.push(g);
  };
  for (const d of spec.decals || []) {
    const cellIdx = typeof d.cell === "number" ? d.cell : DECAL[d.cell];
    const [s0, s1] = d.size || [1, 2];
    const pad = d.pad ?? 0.2;
    for (const [x, y, z] of scatter(d.n, d.area, pad)) {
      const s = s0 + r() * (s1 - s0);
      const colour = d.colors ? d.colors[Math.floor(r() * d.colors.length)] : d.color;
      const a = (d.alpha ?? 0.6) * (0.75 + r() * 0.25);
      quad(cellIdx, x, y + 0.025 + r() * 0.01, z, s, s * (d.stretch ?? 1), d.rot ?? r() * Math.PI * 2, colour, a, null);
    }
  }
  for (const p of spec.place || []) {
    const cellIdx = typeof p.cell === "number" ? p.cell : DECAL[p.cell];
    const w = p.w ?? p.size ?? 2, d = p.d ?? p.size ?? 2;
    quad(cellIdx, p.x, (p.y ?? 0) + (p.wall == null ? 0.03 : 0), p.z, w, d, p.rot ?? 0, p.color, p.alpha ?? 0.8, p.wall);
  }
  if (quads.length) {
    const mesh = new THREE.Mesh(mergeGeometries(quads, false), new THREE.MeshStandardMaterial({
      map: decalAtlas(), vertexColors: true, transparent: true, depthWrite: false, roughness: 0.95, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
    mesh.receiveShadow = true;
    mesh.renderOrder = 1;
    mesh.name = "dress-decals";
    root.add(mesh);
  }

  /* ---- clutter: one InstancedMesh a kind */
  const dummy = new THREE.Object3D();
  for (const c of spec.clutter || []) {
    const k = kind(c.kind);
    const spots = scatter(c.n, c.area, c.pad ?? 0.4);
    if (!spots.length) continue;
    const mesh = new THREE.InstancedMesh(k.geo, k.mat, spots.length);
    const [s0, s1] = c.size || [1, 1];
    const palette = c.colors || [0xffffff];
    spots.forEach(([x, y, z], i) => {
      const s = s0 + r() * (s1 - s0);
      dummy.position.set(x, y - k.sink * s, z);
      dummy.rotation.set((r() - 0.5) * k.tilt, r() * Math.PI * 2, (r() - 0.5) * k.tilt);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, col.set(palette[Math.floor(r() * palette.length)]).offsetHSL(0, 0, (r() - 0.5) * 0.06));
    });
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData.clutter = spots.length;   // game.js applyClutter thins this by graphics tier,
    mesh.userData.clutterShare = CLUTTER_SHARE;   // by these shares (spots are in random order)
    mesh.computeBoundingSphere();
    mesh.name = `dress-${c.kind}`;
    root.add(mesh);
  }
}

/* ------------------------------------------------------------ beach water */
// A cheap animated sea for Grin Beach: a lit MeshStandardMaterial (so fog,
// sun and shadows behave) whose colour runs turquoise in the shallows to deep
// blue offshore, with wave normals summed from a few travelling sines (faded
// with distance so they don't shimmer) and a foam line washing up and back at
// the shore. `shore` is the water's z edge; the sea lies toward -z.
export function beachWaterMaterial({ shore = -21, shallow = 0x48c8c0, deep = 0x1d5f8f, foam = 0xf4fbfa } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.12, metalness: 0.25 });
  const uniforms = {
    uTime: { value: 0 },
    uShore: { value: shore },
    uShallow: { value: new THREE.Color(shallow) },
    uDeep: { value: new THREE.Color(deep) },
    uFoam: { value: new THREE.Color(foam) },
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSeaPos;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvSeaPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
        varying vec3 vSeaPos;
        uniform float uTime, uShore;
        uniform vec3 uShallow, uDeep, uFoam;
        float seaHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float seaNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(seaHash(i), seaHash(i + vec2(1, 0)), f.x), mix(seaHash(i + vec2(0, 1)), seaHash(i + vec2(1, 1)), f.x), f.y);
        }
        // slope of the summed waves at p (d/dx, d/dz)
        vec2 seaSlope(vec2 p, float t) {
          vec2 s = vec2(0.0);
          vec4 W[4];
          W[0] = vec4(0.10, 0.99, 0.55, 0.9);   // dir.xy, freq, speed: the swell rolls in (+z)
          W[1] = vec4(-0.45, 0.89, 1.30, 1.6);
          W[2] = vec4(0.70, 0.71, 2.10, 2.3);
          W[3] = vec4(-0.85, 0.52, 3.40, 3.1);
          float A[4]; A[0] = 0.10; A[1] = 0.05; A[2] = 0.028; A[3] = 0.016;
          for (int k = 0; k < 4; k++) {
            vec2 d = normalize(W[k].xy);
            float ph = dot(d, p) * W[k].z - t * W[k].w;
            s += d * (A[k] * W[k].z * cos(ph));
          }
          return s;
        }`)
      .replace("#include <color_fragment>", `#include <color_fragment>
        float seaDz = uShore - vSeaPos.z;                         // metres out from the shore
        float seaDepth = smoothstep(0.0, 28.0, seaDz);
        vec3 seaCol = mix(uShallow, uDeep, seaDepth);
        // sand showing through the first metre or two
        seaCol = mix(vec3(0.78, 0.70, 0.52), seaCol, smoothstep(0.0, 2.2, seaDz));
        // the swash: a foam edge running up and back, broken by noise
        float t = uTime;
        float wash = 1.4 + 1.0 * sin(t * 0.55 + vSeaPos.x * 0.04) + 0.3 * sin(t * 1.3 + vSeaPos.x * 0.17);
        float edge = smoothstep(0.55, 0.0, abs(seaDz - wash)) * (0.55 + 0.45 * seaNoise(vSeaPos.xz * vec2(0.9, 2.0) + t * 0.3));
        float behind = smoothstep(wash + 0.2, wash - 0.6, seaDz) * 0.35;  // the wet film behind it
        // a second, broken line of breakers further out
        float bz = 7.0 + 1.2 * sin(t * 0.4 + vSeaPos.x * 0.06);
        float brk = smoothstep(0.9, 0.0, abs(seaDz - bz)) * smoothstep(0.45, 0.8, seaNoise(vSeaPos.xz * vec2(0.35, 1.2) + vec2(t * 0.2, 0.0)));
        float foamAmt = clamp(edge + behind + brk * 0.7, 0.0, 1.0) * step(0.0, seaDz);
        diffuseColor.rgb = mix(seaCol, uFoam, foamAmt);`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.85, foamAmt);`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        {
          float fade = 1.0 - smoothstep(25.0, 120.0, distance(cameraPosition, vSeaPos));
          vec2 sl = seaSlope(vSeaPos.xz, uTime) * fade * (1.0 - foamAmt * 0.7);
          vec3 nW = normalize(vec3(-sl.x, 1.0, -sl.y));
          normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
        }`);
  };
  m.userData.seaUniforms = uniforms;
  m.customProgramCacheKey = () => "troll-beach-sea";
  return m;
}

/* ------------------------------------------------------------------ palms */
// Coconut palms (Grin Beach): a leaning, tapered, ringed trunk, a crown of
// drooping feathered fronds (leaflets on a canvas, alpha-tested, with a
// fold down the rachis) and a cluster of coconuts. All the palms on a map
// share three merged meshes. Decoration only: the map keeps its own trunk
// colliders at each base.
let frondTex = null;
function frondTexture() {
  if (frondTex) return frondTex;
  const c = document.createElement("canvas");
  c.width = 128; c.height = 512;
  const g = c.getContext("2d");
  const r = rng(91);
  // leaflets: from the rachis out to both edges, swept toward the tip (v = 1 at the top)
  for (let y = 500; y > 8; y -= 7) {
    const t = 1 - y / 512;
    for (const side of [-1, 1]) {
      if (r() < 0.08) continue;   // the odd gap, like a wind-torn frond
      const len = 58 * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.15))) * (0.85 + r() * 0.3);
      const l = 20 + r() * 14, h = 88 + r() * 22;
      g.strokeStyle = `hsl(${h}, ${38 + r() * 14}%, ${l}%)`;
      g.lineWidth = 4 + r() * 2;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(64, y);
      g.quadraticCurveTo(64 + side * len * 0.5, y - 10, 64 + side * len, y - 22 - r() * 10);
      g.stroke();
    }
  }
  g.strokeStyle = "#6a6a2a"; g.lineWidth = 5;
  g.beginPath(); g.moveTo(64, 512); g.lineTo(64, 4); g.stroke();
  frondTex = new THREE.CanvasTexture(c);
  frondTex.colorSpace = THREE.SRGBColorSpace;
  frondTex.anisotropy = 4;
  return frondTex;
}

export function palmTrees(root, spots, { seed = 5 } = {}) {
  const r = rng(seed);
  const trunks = [], fronds = [], nuts = [];
  const col = new THREE.Color();
  const v = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (const [x, z, h0] of spots) {
    const H = h0 ?? 5.4 + r() * 1.2;
    const lean = r() * Math.PI * 2, leanAmt = 0.4 + r() * 0.7;
    const lx = Math.cos(lean), lz = Math.sin(lean);
    // trunk centreline: a gentle curve, leaning out then rising
    const at = (t) => new THREE.Vector3(x + lx * leanAmt * (t * t * 0.6 + t * 0.4), H * t, z + lz * leanAmt * (t * t * 0.6 + t * 0.4));
    const RINGS = 22, SEG = 9;
    const pos = [], cols = [], idx = [];
    for (let i = 0; i <= RINGS; i++) {
      const t = i / RINGS, c = at(t);
      const rad = (0.3 - 0.11 * t + (i === 0 ? 0.08 : 0)) * (i % 2 ? 1 : 1.07);   // leaf-scar rings
      const shade = (i % 2 ? 0.88 : 1) * (0.9 + r() * 0.1);
      col.setHSL(0.075, 0.3, 0.1 * shade + t * 0.02);   // linear: these read about 2x lighter on screen
      for (let k = 0; k <= SEG; k++) {
        const a = (k / SEG) * Math.PI * 2;
        pos.push(c.x + Math.cos(a) * rad, c.y, c.z + Math.sin(a) * rad);
        cols.push(col.r, col.g, col.b);
      }
    }
    for (let i = 0; i < RINGS; i++) for (let k = 0; k < SEG; k++) {
      const a = i * (SEG + 1) + k, b = a + SEG + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    tg.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    tg.setIndex(idx);
    tg.computeVertexNormals();
    trunks.push(tg.toNonIndexed());

    // the crown
    const top = at(1);
    const N = 9 + Math.floor(r() * 3);
    for (let f = 0; f < N + 3; f++) {
      const young = f >= N;                      // a few short ones still standing up
      const az = (f / N) * Math.PI * 2 + r() * 0.5;
      const L = young ? 1.6 + r() * 0.6 : 3.2 + r() * 1.1;
      const rise = young ? 1.1 : 0.55 + r() * 0.3, droop = young ? 0.5 : 0.95 + r() * 0.35;
      const dir = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
      side.crossVectors(up, dir).normalize();
      const STEPS = 10, fp = [], fu = [], fi = [];
      for (let s = 0; s <= STEPS; s++) {
        const t = s / STEPS;
        const spine = v.copy(top).addScaledVector(dir, L * t * (young ? 0.5 : 1));
        spine.y += L * (rise * t - droop * t * t);
        const w = 0.75 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05)), 0.6) + 0.04;
        for (const u of [-1, 0, 1]) {
          const fold = u === 0 ? 0.08 * w : -0.14 * w;   // a V down the rachis
          fp.push(spine.x + side.x * w * u, spine.y + fold, spine.z + side.z * w * u);
          fu.push((u + 1) / 2, t);
        }
      }
      for (let s = 0; s < STEPS; s++) for (let k = 0; k < 2; k++) {
        const a = s * 3 + k, b = a + 3;
        fi.push(a, b, a + 1, b, b + 1, a + 1);
      }
      const fg = new THREE.BufferGeometry();
      fg.setAttribute("position", new THREE.Float32BufferAttribute(fp, 3));
      fg.setAttribute("uv", new THREE.Float32BufferAttribute(fu, 2));
      fg.setIndex(fi);
      fg.computeVertexNormals();
      fronds.push(fg.toNonIndexed());
    }
    // coconuts tucked under the crown
    const n = 3 + Math.floor(r() * 4);
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2;
      const s = new THREE.SphereGeometry(0.15 + r() * 0.03, 8, 6);
      s.scale(1, 1.15, 1);
      s.translate(top.x + Math.cos(a) * 0.3, top.y - 0.22 - r() * 0.15, top.z + Math.sin(a) * 0.3);
      s.deleteAttribute("uv");
      nuts.push(s.toNonIndexed());
    }
  }
  const trunkMesh = new THREE.Mesh(mergeGeometries(trunks, false),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
  const frondMesh = new THREE.Mesh(mergeGeometries(fronds, false),
    new THREE.MeshStandardMaterial({ map: frondTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8, metalness: 0 }));
  const nutMesh = new THREE.Mesh(mergeGeometries(nuts, false),
    new THREE.MeshStandardMaterial({ color: 0x5a3a1c, roughness: 0.7, metalness: 0 }));
  for (const m of [trunkMesh, frondMesh, nutMesh]) { m.castShadow = true; m.receiveShadow = true; root.add(m); }
  frondMesh.name = "palm-fronds";
}
