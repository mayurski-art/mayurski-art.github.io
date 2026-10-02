// Troll Forces — "Hollowgrin", the Halloween map.
//
// A village on the night of the full moon. Grinmoor Manor looms over the
// north edge (two floors, a grand stair, a balcony over the porch, a turret
// against the moon); the square in the middle is a dead oak, a well and the
// pumpkin market; the graveyard fills the west, the corn and the pumpkin
// patch the east; the candy shop and the barn sit by the south road.
//
// Round the village (the map doubled in area, 72 x 64 -> 102 x 90 m): the
// ruined chapel of St. Grinsworth past the graveyard's west gate, the
// witch's hollow and her pond in the north-west, the broken glasshouse
// behind the manor, the Grinmoor Fair down the east side (a carousel, game
// stalls, the Ferris wheel turning beyond the woods), Trick-or-Treat Lane
// along the south with the Troll House and its Meme Gallery, and a creek
// under a covered bridge in the south-west. String lights, ground fog,
// fireflies and will-o'-wisps everywhere.
//
// It plays both ways. Versus: team spawns north and south, three lanes
// (graveyard, square, corn), the manor's balcony over the middle, and the
// flanks round the outside (chapel, fair). Zombies: they claw up out of the
// open graves and the pumpkin patch, walk in out of the woods, and climb in
// through the manor's upstairs windows; a zombie left downstairs walks to
// the grand stair and comes up after you (zombieLayout below; routing in
// zombies.js).
//
// Everything is procedural and batched: every piece of geometry that shares
// a material is merged into one mesh (Kit.flush), so the whole village costs
// a few dozen draws. Colliders are plain AABBs through api.ghostBox, laid by
// the same helpers that lay the visible pieces, so the two can't drift.
// Light is mostly emissive (carved pumpkins, candles, windows, bulbs) with
// twelve real point lights, all built here at load: nothing adds a light at
// runtime (see light-pool.js for why that matters). The glows (bulb halos,
// fireflies, wisps) are one Points draw, animated in its vertex shader.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { SURFACES } from "./surface-textures.js";
import { portrait } from "./house-props.js";
import { mapModel } from "./map-models.js";

export const HG_FLOORS = { ground: 0, upper: 3.6 };
export function hgFloorOf(y) { return y >= 2.2 ? "upper" : "ground"; }

const BOUNDS = { minX: -51, maxX: 51, minZ: -45, maxZ: 45 };

// The outskirts (see the districts below).
const CHAPEL = { x0: -49.5, x1: -39, z0: -3, z1: 7, h: 6.4 };
const FERRIS = { x: 60, z: 2, r: 11, hub: 13.2 };
const CAROUSEL = { x: 44.5, z: -4, r: 4.5 };
const LANE = { z0: 33.4, z1: 36.6 };
const BRIDGE = { x0: -40.4, x1: -34.4 };   // the deck; steps either end
// The creek's centre line, from the west edge to the south edge, and the
// pond's outline: one `wade` polygon for both (see wadePolygon).
const CREEK = [[-54, 18.5], [-49, 21.5], [-44.5, 25.5], [-40.6, 30], [-37.8, 34.5], [-37, 39], [-36.4, 48]];
const CREEK_W = 3.4;
const POND = { x: -46, z: -20, rx: 5.2, rz: 4.2 };

// Grinmoor Manor's footprint and storeys.
const MANOR = { x0: -13, x1: 13, z0: -28, z1: -12 };
const WALL_T = 0.4;
const SLAB_Y = 3.3;          // underside of the upstairs floor
const UP = HG_FLOORS.upper;  // walking height upstairs
const CEIL = 6.6;            // underside of the manor ceiling
const WALL_H = 6.9;          // outer walls run to the roof line
const STAIR = { x: 0, z: -14.8, width: 3, steps: 12, rise: 0.3, run: 0.5 };
const HOLE = { x0: -1.6, x1: 1.6, z0: STAIR.z - STAIR.steps * STAIR.run, z1: STAIR.z };

// Where zombies come from, filled by build() (it runs more than once: the
// lobby's schematic builds a throwaway copy).
const ZSPAWNS = [];

/* ================================================================ utilities */

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TIME = { value: 0 };   // shared clock for every flicker shader
const tickTime = () => { TIME.value = performance.now() / 1000; };

function canvasTex(w, h, draw, { srgb = true, repeat = false } = {}) {
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

/* Textures are made once per page and shared by every build: the maps get
   disposed (geometry and materials), never their textures. */
const TEX = {};
function tex(name, make) { return TEX[name] ??= make(); }

/* The carved face: the real trollface artwork, its ink lines cut through
   the skin so they glow. Everything that isn't ink is left transparent,
   so the pumpkin shows round the cuts. */
function carveTexture() {
  return tex("carve", () => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const img = new Image();
    img.onload = () => {
      const g = c.getContext("2d");
      const s = Math.min(236 / img.width, 236 / img.height);
      const w = img.width * s, h = img.height * s;
      g.drawImage(img, (256 - w) / 2, (256 - h) / 2 + 6, w, h);
      const d = g.getImageData(0, 0, 256, 256);
      const px = d.data;
      for (let i = 0; i < px.length; i += 4) {
        const lum = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
        const ink = px[i + 3] > 100 && lum < 110;
        px[i] = 255; px[i + 1] = 214; px[i + 2] = 120;
        px[i + 3] = ink ? 255 : 0;
      }
      g.putImageData(d, 0, 0);
      t.needsUpdate = true;
    };
    img.src = new URL("../../images/wallpaper/trollface%20transparent.png", import.meta.url).href;
    return t;
  });
}

function glowTexture() {
  return tex("glow", () => canvasTex(128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, "rgba(255,255,255,1)");
    r.addColorStop(0.25, "rgba(255,255,255,.55)");
    r.addColorStop(0.6, "rgba(255,255,255,.14)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
  }, { srgb: false }));
}

function flameTexture() {
  return tex("flame", () => canvasTex(64, 128, (g) => {
    // teardrop: white-hot core low down, orange tongue, soft edges
    for (let y = 0; y < 128; y++) {
      const t = y / 127;                      // 0 top .. 1 bottom
      const half = 30 * Math.pow(Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.55), 1.3) * (t < 0.92 ? 1 : (1 - t) / 0.08);
      for (let x = 0; x < 64; x++) {
        const dx = Math.abs(x - 32) / Math.max(1, half);
        if (dx > 1) continue;
        const a = Math.pow(1 - dx, 0.8) * Math.min(1, t * 1.6);
        const core = Math.max(0, 1 - dx * 1.6) * Math.max(0, t - 0.45) * 1.8;
        const r = 255, gg = Math.min(255, 120 + 135 * core + 40 * t), b = Math.min(255, 30 + 200 * core);
        g.fillStyle = `rgba(${r},${gg | 0},${b | 0},${a.toFixed(3)})`;
        g.fillRect(x, y, 1, 1);
      }
    }
  }));
}

function moonTexture() {
  return tex("moon", () => canvasTex(256, 256, (g) => {
    const R = rng(7);
    const grd = g.createRadialGradient(118, 112, 10, 128, 128, 128);
    grd.addColorStop(0, "#fffbea");
    grd.addColorStop(0.8, "#efe6c8");
    grd.addColorStop(1, "#d8cda8");
    g.fillStyle = grd;
    g.beginPath(); g.arc(128, 128, 127, 0, Math.PI * 2); g.fill();
    // maria: big soft grey patches, then craters
    for (const [x, y, r, a] of [[92, 96, 44, 0.16], [150, 80, 30, 0.13], [160, 150, 50, 0.12], [100, 170, 26, 0.1]]) {
      const m = g.createRadialGradient(x, y, 0, x, y, r);
      m.addColorStop(0, `rgba(120,112,98,${a})`);
      m.addColorStop(1, "rgba(120,112,98,0)");
      g.fillStyle = m;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 26; i++) {
      const x = 30 + R() * 196, y = 30 + R() * 196, r = 2 + R() * 7;
      if (Math.hypot(x - 128, y - 128) > 118 - r) continue;
      g.fillStyle = "rgba(110,100,86,.22)";
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(255,255,240,.25)";
      g.beginPath(); g.arc(x - r * 0.25, y - r * 0.25, r * 0.55, 0, Math.PI * 2); g.fill();
    }
  }));
}

/* Slate shingles for the manor roof, staggered rows, each slate a touch
   different. */
function shingleTexture() {
  return tex("shingle", () => canvasTex(256, 256, (g) => {
    const R = rng(11);
    g.fillStyle = "#1c1e27";
    g.fillRect(0, 0, 256, 256);
    const rowH = 32, slateW = 42;
    for (let row = 0; row < 8; row++) {
      const off = (row % 2) * slateW / 2;
      for (let x = -slateW; x < 256 + slateW; x += slateW) {
        const v = 44 + R() * 22;
        g.fillStyle = `rgb(${v | 0},${(v + 3) | 0},${(v + 12) | 0})`;
        g.fillRect(x + off + 1, row * rowH + 1, slateW - 2, rowH - 2);
        const shade = g.createLinearGradient(0, row * rowH, 0, row * rowH + rowH);
        shade.addColorStop(0, "rgba(0,0,0,0)");
        shade.addColorStop(1, "rgba(0,0,0,.45)");
        g.fillStyle = shade;
        g.fillRect(x + off + 1, row * rowH + 1, slateW - 2, rowH - 2);
      }
    }
  }, { repeat: true }));
}

/* Dried corn: three or four tan stalks with drooping leaves and the odd ear,
   on a transparent sheet for crossed billboards. */
function cornTexture() {
  return tex("corn", () => canvasTex(256, 512, (g) => {
    const R = rng(5);
    for (let s = 0; s < 4; s++) {
      const x0 = 40 + s * 56 + (R() - 0.5) * 20;
      const lean = (R() - 0.5) * 24;
      const shade = 150 + R() * 40;
      g.strokeStyle = `rgb(${shade | 0},${(shade * 0.82) | 0},${(shade * 0.5) | 0})`;
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(x0, 512);
      g.quadraticCurveTo(x0 + lean * 0.3, 260, x0 + lean, 30 + R() * 40);
      g.stroke();
      // leaves: long curved blades, drooping
      for (let k = 0; k < 7; k++) {
        const y = 470 - k * 58 - R() * 20;
        const dir = k % 2 ? 1 : -1;
        const len = 60 + R() * 60;
        const lx = x0 + lean * (1 - y / 512);
        const c = 120 + R() * 60;
        g.strokeStyle = `rgb(${c | 0},${(c * 0.85) | 0},${(c * 0.5) | 0})`;
        g.lineWidth = 9 - k * 0.6;
        g.beginPath();
        g.moveTo(lx, y);
        g.quadraticCurveTo(lx + dir * len * 0.6, y - 40, lx + dir * len, y + 20 + R() * 30);
        g.stroke();
      }
      if (R() < 0.8) {
        const y = 220 + R() * 90;
        g.fillStyle = "#b58a3a";
        g.beginPath();
        g.ellipse(x0 + lean * 0.5 + 10, y, 9, 34, 0.35, 0, Math.PI * 2);
        g.fill();
      }
    }
  }));
}

function hayTexture() {
  return tex("hay", () => canvasTex(256, 256, (g) => {
    const R = rng(3);
    g.fillStyle = "#9c7c3a";
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1400; i++) {
      const x = R() * 256, y = R() * 256, l = 8 + R() * 22, a = (R() - 0.5) * 0.7;
      const c = 150 + R() * 90;
      g.strokeStyle = `rgba(${c | 0},${(c * 0.8) | 0},${(c * 0.4) | 0},.8)`;
      g.lineWidth = 1 + R() * 1.4;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    // the twine
    g.fillStyle = "rgba(60,40,20,.8)";
    g.fillRect(0, 70, 256, 5);
    g.fillRect(0, 180, 256, 5);
  }, { repeat: true }));
}

/* Epitaphs, cut into the headstones: an atlas of eight, 4 x 2. */
const EPITAPHS = ["U MAD?", "PROBLEM?", "GG NO RE", "RIP NORMIE", "BRB", "TROLOLOL", "AFK 4EVER", "LAGGED OUT"];
function epitaphTexture() {
  return tex("epitaph", () => canvasTex(1024, 512, (g) => {
    g.textAlign = "center";
    g.textBaseline = "middle";
    EPITAPHS.forEach((text, i) => {
      const cx = (i % 4) * 256 + 128, cy = Math.floor(i / 4) * 256 + 128;
      g.font = "700 30px Georgia, serif";
      g.fillStyle = "rgba(20,20,24,.85)";
      g.fillText("HERE LIES", cx, cy - 46);
      const size = text.length > 8 ? 34 : 42;
      g.font = `700 ${size}px Georgia, serif`;
      g.fillStyle = "rgba(235,235,225,.35)";   // a lit lower lip on the cut
      g.fillText(text, cx + 1, cy + 11);
      g.fillStyle = "rgba(14,14,18,.92)";
      g.fillText(text, cx, cy + 8);
      g.font = "600 22px Georgia, serif";
      g.fillStyle = "rgba(20,20,24,.8)";
      g.fillText("2010 - 2026", cx, cy + 58);
    });
  }));
}

function signTexture(lines, { w = 1024, h = 192, bg = "#2a1a12", fg = "#ffb347", edge = "#6b2d8f", font = "Georgia, serif" } = {}) {
  return tex(`sign-${lines.join("|")}-${w}x${h}`, () => canvasTex(w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = edge;
    g.lineWidth = 10;
    g.strokeRect(8, 8, w - 16, h - 16);
    g.textAlign = "center";
    g.textBaseline = "middle";
    const size = Math.floor(h * 0.52 / lines.length);
    g.font = `800 ${size}px ${font}`;
    lines.forEach((t, i) => {
      const y = h / 2 + (i - (lines.length - 1) / 2) * size * 1.15;
      g.shadowColor = fg;
      g.shadowBlur = 18;
      g.fillStyle = fg;
      g.fillText(t, w / 2, y);
    });
  }));
}

/* A mesh that draws nothing, only there for its onBeforeRender hook. */
function ticker(fn, mat) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(9), 3));
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  m.onBeforeRender = fn;
  return m;
}

function booksTexture() {
  return tex("books", () => canvasTex(256, 256, (g) => {
    const R = rng(21);
    g.fillStyle = "#1a120c";
    g.fillRect(0, 0, 256, 256);
    for (let shelf = 0; shelf < 4; shelf++) {
      let x = 2;
      const y1 = shelf * 64 + 60;
      while (x < 252) {
        const bw = 6 + R() * 12, bh = 34 + R() * 20;
        const hue = [0, 20, 110, 200, 270, 35][Math.floor(R() * 6)];
        g.fillStyle = `hsl(${hue}, ${30 + R() * 30}%, ${16 + R() * 18}%)`;
        g.fillRect(x, y1 - bh, bw, bh);
        g.fillStyle = "rgba(200,170,90,.5)";
        g.fillRect(x + 1, y1 - bh + 6, bw - 2, 2);
        x += bw + 1;
      }
      g.fillStyle = "#3a2616";
      g.fillRect(0, y1, 256, 4);
    }
  }, { repeat: true }));
}

function stripesTexture(a = "#e0661f", b = "#1a1216") {
  return tex(`stripes-${a}-${b}`, () => canvasTex(128, 32, (g) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? b : a;
      g.fillRect(i * 16, 0, 16, 32);
    }
  }, { repeat: true }));
}

function leavesTexture() {
  return tex("leaves", () => canvasTex(256, 256, (g) => {
    const R = rng(9);
    for (let i = 0; i < 26; i++) {
      const x = 30 + R() * 196, y = 30 + R() * 196, s = 14 + R() * 20, a = R() * Math.PI;
      const c = 40 + R() * 40;
      g.fillStyle = `rgb(${(c * 0.7) | 0},${(c + 20) | 0},${(c * 0.4) | 0})`;
      g.save();
      g.translate(x, y);
      g.rotate(a);
      g.beginPath();
      g.ellipse(0, 0, s, s * 0.8, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    // vine tendrils
    g.strokeStyle = "rgba(60,80,30,.9)";
    g.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.moveTo(R() * 256, R() * 256);
      g.bezierCurveTo(R() * 256, R() * 256, R() * 256, R() * 256, R() * 256, R() * 256);
      g.stroke();
    }
  }));
}

function windowGlowTexture() {
  return tex("winglow", () => canvasTex(64, 96, (g) => {
    const grd = g.createLinearGradient(0, 0, 0, 96);
    grd.addColorStop(0, "#ffcf7a");
    grd.addColorStop(1, "#ff8f3a");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 96);
    // mullions and a figure's silhouette in one pane, for the ones who look
    g.fillStyle = "#2a160c";
    g.fillRect(30, 0, 4, 96);
    g.fillRect(0, 46, 64, 4);
    g.fillRect(0, 0, 64, 3);
    g.fillRect(0, 93, 64, 3);
    g.fillRect(0, 0, 3, 96);
    g.fillRect(61, 0, 3, 96);
  }));
}

/* ======================================================= materials + batching */

/* A material from one of the PBR sets, tinted. `mix` pulls the tint toward
   white (the textures carry their own contrast). `tile` is metres per
   repeat: the kit rewrites UVs in world metres for these. */
function surfMat(surface, color, { mix = 0.45, tile = 2, rough = 1, emissive = 0x000000, bounce = 0 } = {}) {
  const s = SURFACES[surface];
  const tint = new THREE.Color(color).lerp(new THREE.Color(0xffffff), mix);
  const m = new THREE.MeshStandardMaterial({
    color: tint, map: s.color.clone(), normalMap: s.normal.clone(), roughnessMap: s.rough.clone(),
    roughness: rough, metalness: 0.02, emissive,
  });
  if (s.ao) m.aoMap = s.ao.clone();
  // Indoors the moon can't reach and the hemisphere light is thin, so
  // interior surfaces glow a little with their own texture: fake bounce
  // light from the lamps, without paying for another real light.
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

function texMat(map, { color = 0xffffff, tile = 0, rough = 0.9, alphaTest = 0, side = THREE.FrontSide, emissive = 0x000000, emissiveMap = null } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, map, roughness: rough, metalness: 0, alphaTest, side, emissive, emissiveMap });
  if (tile) m.userData.tile = tile;
  return m;
}

/* An unlit, flickering material: every vertex carries a phase (aPhase), so
   one merged mesh of forty lanterns still flickers forty different ways. */
function flickerMat({ map = null, color = 0xffffff, additive = false, alphaTest = 0, strength = 1, speed = 1 } = {}) {
  const m = new THREE.MeshBasicMaterial({
    map, color, alphaTest,
    transparent: additive,
    depthWrite: !additive,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: additive ? THREE.DoubleSide : THREE.FrontSide,
  });
  m.userData.phase = true;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = TIME;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aPhase;\nuniform float uTime;\nvarying float vFlick;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        float ft = uTime * ${(9 * speed).toFixed(2)} + aPhase * 6.283;
        vFlick = 1.0 - ${(0.22 * strength).toFixed(3)} * (0.5 + 0.5 * sin(ft)) * (0.6 + 0.4 * sin(ft * 2.3 + 1.7))
                     - ${(0.1 * strength).toFixed(3)} * step(0.93, fract(sin(floor(uTime * 7.0) + aPhase * 91.0) * 43758.5));`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vFlick;")
      .replace("vec4 diffuseColor = vec4( diffuse, opacity );", "vec4 diffuseColor = vec4( diffuse * vFlick, opacity );");
  };
  m.customProgramCacheKey = () => `hg-flicker-${additive}-${strength}-${speed}`;
  return m;
}

/* World-metre UVs, the same rule as maps.js's metreUVs: each face samples
   along its own two axes, so every surface tiles at the same real scale.
   The axis is picked per TRIANGLE from its face normal (geometry here is
   always non-indexed): smooth vertex normals on a low-poly cylinder point
   at its corners, and picking per vertex smears one repeat across a face. */
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
function metreUVs(geo, tile) {
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
      uv.setXY(k, u / tile, v / tile);
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
function place(geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  _m4.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
  geo.applyMatrix4(_m4);
  return geo;
}

/* Everything drawn on the map goes through a Kit: pieces are grouped by
   material and merged into one mesh each at the end. */
class Kit {
  constructor(api, root) {
    this.api = api;
    this.root = root;
    this.lists = new Map();
  }

  add(mat, geo, { shadow = true, phase = null, color = null } = {}) {
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
    if (mat.userData.phase) {
      g.setAttribute("aPhase", new THREE.Float32BufferAttribute(new Float32Array(n).fill(phase ?? 0), 1));
    }
    g.clearGroups();
    if (mat.userData.tile) metreUVs(g, mat.userData.tile);
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

  /* A collider and the box that shows it. */
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
      if (mat.userData.phase) mesh.onBeforeRender = tickTime;
      this.root.add(mesh);
    }
    this.lists.clear();
  }
}

/* ================================================================== shapes */

/* A pumpkin: a sphere pulled into ribs, squashed, dimpled at the stem. */
function pumpkinGeo(r, { ribs = 10, squash = 0.78, seg = 18 } = {}) {
  const g = new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7));
  ribPumpkin(g, r, ribs, squash);
  return g;
}

function ribPumpkin(g, r, ribs, squash, grow = 1) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const k = Math.pow(Math.abs(Math.sin(a * ribs / 2)), 0.45);
    const sc = (0.9 + 0.1 * k) * grow;
    x *= sc; z *= sc;
    y *= squash;
    const d = Math.hypot(x, z) / r;
    if (y > 0) y -= r * 0.16 * Math.exp(-d * d * 9);
    else y += r * 0.08 * Math.exp(-d * d * 9);
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
}

/* The carved front of a jack-o'-lantern: a patch of the same ribbed shell,
   a hair proud of it, UV-mapped 0..1 across the face. */
function carvePatchGeo(r, ribs, squash) {
  const g = new THREE.SphereGeometry(r, 16, 12, Math.PI / 2 - 1.0, 2.0, Math.PI * 0.22, Math.PI * 0.56);
  ribPumpkin(g, r, ribs, squash, 1.018);
  return g;
}

/* A dead tree: crooked branches that fork and thin out. */
function treeGeo(seed, { height = 6, r = 0.3, levels = 3, spread = 0.75, lean = 0.12 } = {}) {
  const R = rng(seed);
  const parts = [];
  const up = new THREE.Vector3(0, 1, 0);
  const seg = (a, b, r0, r1) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const geo = new THREE.CylinderGeometry(r1, r0, len, r0 > 0.08 ? 7 : 5, 1, true);
    geo.translate(0, len / 2, 0);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir.normalize()));
    geo.translate(a.x, a.y, a.z);
    parts.push(geo);
  };
  const grow = (p, dir, len, rad, depth) => {
    let cur = p.clone();
    const d = dir.clone();
    const n = depth === levels ? 4 : 3;
    for (let i = 0; i < n; i++) {
      d.add(new THREE.Vector3((R() - 0.5) * 0.55, (R() - 0.35) * 0.3, (R() - 0.5) * 0.55)).normalize();
      const nxt = cur.clone().addScaledVector(d, len / n);
      seg(cur, nxt, rad * (1 - (i / n) * 0.5), rad * (1 - ((i + 1) / n) * 0.5));
      cur = nxt;
      // a side shoot partway up the thick limbs
      if (depth >= 2 && i === 1 && R() < 0.6) {
        const side = randomSide(d, 0.9 + R() * 0.5, R);
        grow(cur, side, len * 0.45, rad * 0.45, depth - 2);
      }
    }
    if (depth <= 0) return;
    const kids = depth === levels ? 3 : 2 + (R() < 0.4 ? 1 : 0);
    for (let k = 0; k < kids; k++) {
      grow(cur, randomSide(d, spread * (0.6 + R() * 0.7), R), len * (0.58 + R() * 0.2), rad * 0.52, depth - 1);
    }
  };
  const trunkDir = new THREE.Vector3((R() - 0.5) * lean * 2, 1, (R() - 0.5) * lean * 2).normalize();
  grow(new THREE.Vector3(0, -0.3, 0), trunkDir, height * 0.45, r, levels);
  // roots flaring into the ground
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + R();
    seg(new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(Math.cos(a) * r * 3, -0.1, Math.sin(a) * r * 3), r * 0.7, r * 0.15);
  }
  const g = mergeGeometries(parts.map((q) => q.toNonIndexed()), false);
  parts.forEach((q) => q.dispose());
  return g;
}

function randomSide(d, tilt, R) {
  const a = R() * Math.PI * 2;
  const perp = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
  perp.addScaledVector(d, -perp.dot(d)).normalize();
  const out = d.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(perp, Math.sin(tilt));
  if (out.y < -0.15) out.y = -0.15;
  return out.normalize();
}

/* A headstone with a rounded top, as an extruded outline. */
function headstoneGeo(w, h, t) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, h - w / 2);
  s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false);
  s.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: 10 });
  g.translate(0, 0, -t / 2);
  return g;
}

function prismGeo(points, depth) {
  const s = new THREE.Shape(points.map(([a, b]) => new THREE.Vector2(a, b)));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return g;
}

/* ================================================================= builders */

/* An axis-aligned wall of thickness `t`: `axis` "x" runs west-east at
   z = `at`, "z" runs north-south at x = `at`, from `a` to `b`. `holes`
   cut doors and windows: [{ c, w, spans: [[lo, hi], ...] }] with heights
   relative to `y`. Frames and shutters are drawn round each opening; `out`
   (+1/-1) says which side is outdoors. */
function wall(K, { axis, at, a, b, y = 0, h, t = WALL_T, mat, pen = 8, holes = [], trim = null, out = 0, shutter = null }) {
  const piece = (s, e, lo, hi) => {
    if (e - s < 0.02 || hi - lo < 0.02) return;
    const c = (s + e) / 2, len = e - s;
    K.solid(axis === "x" ? c : at, axis === "x" ? at : c, axis === "x" ? len : t, axis === "x" ? t : len, hi - lo, { y: y + lo, pen, mat });
  };
  const at2 = (along, perp) => (axis === "x" ? [along, perp] : [perp, along]);
  let cur = a;
  for (const hole of [...holes].sort((p, q) => p.c - q.c)) {
    const s = hole.c - hole.w / 2, e = hole.c + hole.w / 2;
    piece(cur, s, 0, h);
    let lo = 0;
    const spans = [...hole.spans].sort((p, q) => p[0] - q[0]);
    for (const [sLo, sHi] of spans) { piece(s, e, lo, sLo); lo = sHi; }
    piece(s, e, lo, h);
    cur = e;
    if (!trim) continue;
    for (const [sLo, sHi] of spans) {
      const door = sLo < 0.05;
      const fw = 0.12, depth = t + 0.1;
      // jambs, head, and a sill on windows
      for (const side of [-1, 1]) {
        const [x, z] = at2(hole.c + side * (hole.w / 2 + fw / 2 - 0.02), at);
        K.box(trim, x, y + sLo, z, axis === "x" ? fw : depth, sHi - sLo + fw, axis === "x" ? depth : fw);
      }
      {
        const [x, z] = at2(hole.c, at);
        K.box(trim, x, y + sHi, z, axis === "x" ? hole.w + fw * 2 : depth, fw, axis === "x" ? depth : hole.w + fw * 2);
        if (!door) {
          const [sx, sz] = at2(hole.c, at + out * 0.06);
          K.box(trim, sx, y + sLo - 0.08, sz, axis === "x" ? hole.w + 0.3 : depth + 0.12, 0.08, axis === "x" ? depth + 0.12 : hole.w + 0.3);
        }
      }
      // shutters hang open either side of the outside face, one askew
      if (!door && shutter && out) {
        const sh = sHi - sLo, sw = hole.w * 0.5;
        for (const side of [-1, 1]) {
          const along = hole.c + side * (hole.w / 2 + fw + sw / 2 + 0.02);
          const [x, z] = at2(along, at + out * (t / 2 + 0.04));
          const askew = (Math.round(hole.c * 7 + sLo * 3) % 5 === 0 && side > 0) ? 0.22 : 0;
          K.box(shutter, x, y + sLo + (askew ? -0.15 : 0), z, axis === "x" ? sw : 0.05, sh, axis === "x" ? 0.05 : sw, { rz: axis === "x" ? askew : 0, rx: axis === "z" ? askew : 0 });
        }
      }
    }
  }
  piece(cur, b, 0, h);
}

/* A flat slab covering a rectangle, with one rectangular hole. */
function slabWithHole(K, { x0, x1, z0, z1, y, h, hole, mat, pen = 8 }) {
  const put = (a0, a1, b0, b1) => {
    if (a1 - a0 < 0.05 || b1 - b0 < 0.05) return;
    K.solid((a0 + a1) / 2, (b0 + b1) / 2, a1 - a0, b1 - b0, h, { y, pen, mat });
  };
  put(x0, hole.x0, z0, z1);
  put(hole.x1, x1, z0, z1);
  put(hole.x0, hole.x1, z0, hole.z0);
  put(hole.x0, hole.x1, hole.z1, z1);
}

/* A railing: thin collider that stops bodies and barely slows a bullet,
   drawn as a handrail on balusters. */
function railing(K, M, { axis, at, a, b, y }) {
  const len = b - a, c = (a + b) / 2;
  const x = axis === "x" ? c : at, z = axis === "x" ? at : c;
  K.api.ghostBox(x, z, axis === "x" ? len : 0.1, axis === "x" ? 0.1 : len, 1.05, { y, pen: 0.3 });
  K.box(M.trimDark, x, y + 0.95, z, axis === "x" ? len : 0.1, 0.08, axis === "x" ? 0.1 : len);
  K.box(M.trimDark, x, y + 0.02, z, axis === "x" ? len : 0.08, 0.06, axis === "x" ? 0.08 : len);
  const n = Math.max(2, Math.round(len / 0.28));
  for (let i = 0; i <= n; i++) {
    const s = a + (len * i) / n;
    K.box(M.trimDark, axis === "x" ? s : at, y, axis === "x" ? at : s, 0.05, 0.95, 0.05);
  }
}

/* A jack-o'-lantern: ribbed body and stem, and when carved, the trollface
   glowing out of the front with a warm pool on the ground under it. */
function jack(K, M, x, y, z, { r = 0.3, face = 0, carved = true, seed = 1, glow = true } = {}) {
  const R = rng(seed * 97 + 13);
  const ribs = 9 + Math.floor(R() * 3), squash = 0.72 + R() * 0.12;
  const hue = [0xd8641c, 0xe07423, 0xcf5a17, 0xe8842c][Math.floor(R() * 4)];
  const body = pumpkinGeo(r, { ribs, squash });
  K.add(M.pumpkin, place(body, { x, y: y + r * squash * 0.95, z, ry: R() * 6 }), { color: hue });
  const stem = new THREE.CylinderGeometry(r * 0.08, r * 0.13, r * 0.45, 6);
  K.add(M.stem, place(stem, { x, y: y + r * squash * 1.75, z, rz: (R() - 0.5) * 0.6, rx: (R() - 0.5) * 0.6 }));
  if (!carved) return;
  const phase = R();
  K.add(M.carve, place(carvePatchGeo(r, ribs, squash), { x, y: y + r * squash * 0.95, z, ry: face }), { phase, shadow: false });
  if (glow) {
    const gr = r * 5.5;
    const pool = new THREE.PlaneGeometry(gr, gr);
    K.add(M.glow, place(pool, { x: x + Math.sin(face) * r, y: y + 0.03, z: z + Math.cos(face) * r, rx: -Math.PI / 2 }), { phase, shadow: false });
  }
}

/* A candle with a flickering flame (crossed quads, always face-ish on). */
function candle(K, M, x, y, z, { h = 0.18, r = 0.035, seed = 1 } = {}) {
  K.cyl(M.wax, x, y, z, r, r * 0.92, h, 8);
  const phase = rng(seed)();
  for (const ry of [0, Math.PI / 2]) {
    K.add(M.flame, place(new THREE.PlaneGeometry(0.07, 0.14), { x, y: y + h + 0.07, z, ry }), { phase, shadow: false });
  }
}

function hayBale(K, M, x, z, { y = 0, ry = 0, collide = true } = {}) {
  const w = 1.3, h = 0.75, d = 0.85;
  if (collide) {
    const along = Math.abs(Math.sin(ry)) > 0.5;
    K.api.ghostBox(x, z, along ? d : w, along ? w : d, h, { y, pen: 1.4 });
  }
  K.box(M.hay, x, y, z, w, h, d, { ry });
}

/* A gas lamp on a post; `light` adds a real one (there are only two). */
function gasLamp(K, M, x, z, { lights = null } = {}) {
  K.solid(x, z, 0.24, 0.24, 3.0, { pen: 3 });
  K.cyl(M.iron, x, 0, z, 0.14, 0.09, 3.0, 8);
  K.cyl(M.iron, x, 0, z, 0.22, 0.2, 0.4, 8);
  K.box(M.iron, x, 3.0, z, 0.42, 0.06, 0.42);
  K.box(M.iron, x, 3.62, z, 0.46, 0.06, 0.46);
  K.cyl(M.iron, x, 3.68, z, 0.2, 0.02, 0.28, 4, { ry: Math.PI / 4 });
  K.box(M.lampGlass, x, 3.06, z, 0.34, 0.56, 0.34, {}, { shadow: false });
  if (lights) {
    const l = new THREE.PointLight(0xffb86a, 9, 16, 2);
    l.position.set(x, 3.3, z);
    lights.push(l);
  }
  K.sparks?.add(x, 3.3, z, 0xffb86a, { size: 1.4, blink: 0.05 });
}

/* Crooked iron fence with spear-top bars: `len` along `axis` from (x, z).
   Collider-wise it stops bodies and barely touches a bullet. */
function ironFence(K, M, { axis, at, a, b, h = 1.9 }) {
  const len = b - a;
  if (len < 0.1) return;
  const c = (a + b) / 2;
  const cx = axis === "x" ? c : at, cz = axis === "x" ? at : c;
  K.api.ghostBox(cx, cz, axis === "x" ? len : 0.12, axis === "x" ? 0.12 : len, h, { pen: 0.25 });
  const pos = (s) => (axis === "x" ? [s, at] : [at, s]);
  for (const ry of [0.35, h - 0.3]) {
    const [x, z] = pos(c);
    K.box(M.iron, x, ry, z, axis === "x" ? len : 0.05, 0.05, axis === "x" ? 0.05 : len);
  }
  const bars = Math.round(len / 0.16);
  for (let i = 0; i <= bars; i++) {
    const s = a + (len * i) / bars;
    const [x, z] = pos(s);
    const lean = Math.sin(s * 1.7) * 0.025;
    K.box(M.iron, x, 0, z, 0.025, h, 0.025, { rx: axis === "x" ? lean : 0, rz: axis === "z" ? lean : 0 }, { shadow: false });
    K.cyl(M.iron, x, h, z, 0.035, 0.0, 0.14, 4, {}, { shadow: false });
  }
  const posts = Math.max(1, Math.round(len / 2.5));
  for (let i = 0; i <= posts; i++) {
    const [x, z] = pos(a + (len * i) / posts);
    K.box(M.iron, x, 0, z, 0.1, h + 0.12, 0.1);
    K.add(M.iron, place(new THREE.SphereGeometry(0.07, 6, 4), { x, y: h + 0.2, z }));
  }
}

/* ============================================================ the outskirts */

/* Distance from (x, z) to the creek's centre line. */
function creekDist(x, z) {
  let best = Infinity;
  for (let i = 1; i < CREEK.length; i++) {
    const [ax, az] = CREEK[i - 1], [bx, bz] = CREEK[i];
    const ex = bx - ax, ez = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez)));
    best = Math.min(best, Math.hypot(x - ax - ex * t, z - az - ez * t));
  }
  return best;
}

/* The creek's two banks: offset the centre line `half` each way. */
function creekBanks(half = CREEK_W / 2) {
  const left = [], right = [];
  for (let i = 0; i < CREEK.length; i++) {
    const [px, pz] = CREEK[Math.max(0, i - 1)], [nx, nz] = CREEK[Math.min(CREEK.length - 1, i + 1)];
    let dx = nx - px, dz = nz - pz;
    const l = Math.hypot(dx, dz);
    dx /= l; dz /= l;
    const [x, z] = CREEK[i];
    left.push([x + dz * half, z - dx * half]);
    right.push([x - dz * half, z + dx * half]);
  }
  return { left, right };
}

function pondOutline(n = 28, grow = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const wob = 1 + 0.08 * Math.sin(a * 3 + 1) + 0.05 * Math.sin(a * 5 + 2);
    pts.push([POND.x + Math.cos(a) * (POND.rx + grow) * wob, POND.z + Math.sin(a) * (POND.rz + grow) * wob]);
  }
  return pts;
}

/* The pond and the creek as ONE polygon (edge.js's insidePolygon is
   even-odd over a single outline): the pond, out to the west wall, down
   the outside of the wall to the creek and round it, and back up the same
   line, which encloses nothing. */
function wadePolygon() {
  const W = BOUNDS.minX - 1.5;
  const pond = pondOutline(28, -0.3);
  // start the pond at its westmost point, so the run to the wall is short
  let wi = 0;
  pond.forEach((p, i) => { if (p[0] < pond[wi][0]) wi = i; });
  const ring = [...pond.slice(wi), ...pond.slice(0, wi), pond[wi]];
  const { left, right } = creekBanks(CREEK_W / 2 - 0.15);
  return [
    [W, ring[0][1]], ...ring, [W, ring[0][1] + 0.01],
    [W, right[0][1]], ...right, ...left.reverse(), [W, left[left.length - 1][1]],
    [W, ring[0][1] + 0.02],
  ];
}

const _up = new THREE.Vector3(0, 1, 0);
/* A thin open cylinder from a to b ([x, y, z]). */
function rodGeo(a, b, r, seg = 4) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const dir = B.clone().sub(A);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1, true);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_up, dir.normalize()));
  g.translate(A.x, A.y, A.z);
  return g;
}

function imageTex(file) {
  return tex(`img-${file}`, () => {
    const t = new THREE.TextureLoader().load(new URL(file, import.meta.url).href);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  });
}

/* A painting: the picture lights itself a little, so it reads in the dark. */
function paintMat(file) {
  const t = imageTex(file);
  return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0x555555, roughness: 0.6 });
}

/* The trollface artwork as it is: white face, black ink. */
const trollTexture = () => imageTex("../../images/wallpaper/trollface%20transparent.png");

/* St. Grinsworth's rose window: twelve wedges of coloured glass in lead,
   and the trollface grinning out of the middle in pale amber glass. */
function roseTexture() {
  return tex("rose", () => {
    const S = 512, c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d");
    const glass = ["#7a2fd0", "#2fae5a", "#e08a1e", "#2a5ad8", "#c0243c", "#2fae5a"];
    g.fillStyle = "#000";
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * Math.PI * 2, a1 = ((i + 1) / 12) * Math.PI * 2;
      g.fillStyle = glass[i % glass.length];
      g.beginPath(); g.moveTo(S / 2, S / 2); g.arc(S / 2, S / 2, S / 2 - 6, a0, a1); g.closePath(); g.fill();
      // petals of a lighter shade on each wedge
      g.fillStyle = "rgba(255,255,255,.18)";
      const am = (a0 + a1) / 2;
      g.beginPath(); g.arc(S / 2 + Math.cos(am) * 200, S / 2 + Math.sin(am) * 200, 34, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = "#0b0a0c";
    g.lineWidth = 9;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath(); g.moveTo(S / 2 + Math.cos(a) * 150, S / 2 + Math.sin(a) * 150); g.lineTo(S / 2 + Math.cos(a) * 252, S / 2 + Math.sin(a) * 252); g.stroke();
    }
    for (const r of [150, 252]) { g.beginPath(); g.arc(S / 2, S / 2, r, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = "#5a2a8a";
    g.beginPath(); g.arc(S / 2, S / 2, 148, 0, Math.PI * 2); g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const img = new Image();
    img.onload = () => {
      const k = document.createElement("canvas");
      k.width = k.height = 260;
      const kg = k.getContext("2d");
      const s = Math.min(250 / img.width, 250 / img.height);
      kg.drawImage(img, (260 - img.width * s) / 2, (260 - img.height * s) / 2, img.width * s, img.height * s);
      const d = kg.getImageData(0, 0, 260, 260), px = d.data;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] < 100) { px[i + 3] = 0; continue; }
        const lum = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
        if (lum < 110) { px[i] = 12; px[i + 1] = 10; px[i + 2] = 12; }        // the lead
        else { px[i] = 255; px[i + 1] = 222; px[i + 2] = 150; }               // amber glass
        px[i + 3] = 255;
      }
      kg.putImageData(d, 0, 0);
      g.drawImage(k, S / 2 - 130, S / 2 - 130);
      t.needsUpdate = true;
    };
    img.src = new URL("../../images/wallpaper/trollface%20transparent.png", import.meta.url).href;
    return t;
  });
}

/* Ground mist: soft white blobs on transparent, tiling. */
function mistTexture() {
  return tex("mist", () => canvasTex(256, 256, (g) => {
    const R = rng(77);
    for (let i = 0; i < 70; i++) {
      const x = R() * 256, y = R() * 256, r = 18 + R() * 46, a = 0.05 + R() * 0.12;
      for (const [ox, oy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
        const m = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        m.addColorStop(0, `rgba(255,255,255,${a})`);
        m.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = m;
        g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
  }, { srgb: false, repeat: true }));
}

/* An opaque white-to-black radial fade, for alphaMap (it reads green). */
function fadeTexture() {
  return tex("fade", () => canvasTex(128, 128, (g) => {
    g.fillStyle = "#000";
    g.fillRect(0, 0, 128, 128);
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, "#fff");
    r.addColorStop(0.55, "#bbb");
    r.addColorStop(1, "#000");
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
  }, { srgb: false }));
}

/* Glowing points: bulb halos, fireflies, will-o'-wisps. One draw for all
   of them; each point carries its own size, wander (how far it drifts),
   blink and phase, and the vertex shader moves it. Additive, so the fog
   dims it rather than tinting it. */
function sparkMaterial() {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uMap: { value: null }, uScale: { value: 600 } }]),
    vertexShader: `
      attribute float aPhase;
      attribute float aSize;
      attribute float aWander;
      attribute float aBlink;
      uniform float uTime;
      uniform float uScale;
      varying vec3 vColor;
      varying float vAlpha;
      #include <fog_pars_vertex>
      void main() {
        float t = uTime * (0.22 + 0.25 * fract(aPhase * 7.13)) + aPhase * 6.283;
        vec3 p = position + aWander * vec3(sin(t) + 0.5 * sin(t * 2.3 + 1.0), 0.4 * sin(t * 1.7 + 2.0), cos(t * 0.9) + 0.5 * sin(t * 1.9));
        float b = 0.5 + 0.5 * sin(uTime * (1.3 + aPhase * 1.7) + aPhase * 40.0);
        vAlpha = mix(1.0, smoothstep(0.35, 0.95, b), aBlink);
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = aSize * uScale / max(0.5, -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform sampler2D uMap;
      varying vec3 vColor;
      varying float vAlpha;
      #include <fog_pars_fragment>
      void main() {
        float k = texture2D(uMap, gl_PointCoord).a;
        gl_FragColor = vec4(vColor * k * vAlpha, 1.0);
        #ifdef USE_FOG
          #ifdef FOG_EXP2
            float ff = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
          #else
            float ff = smoothstep(fogNear, fogFar, vFogDepth);
          #endif
          gl_FragColor.rgb *= 1.0 - ff;
        #endif
      }`,
    fog: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
  });
  m.uniforms.uTime = TIME;
  m.uniforms.uMap.value = glowTexture();
  return m;
}

/* Collects the glowing points as they're laid, then makes them one Points. */
class Sparks {
  constructor() { this.a = { position: [], color: [], aSize: [], aWander: [], aBlink: [], aPhase: [] }; this.R = rng(321); }
  add(x, y, z, color, { size = 0.6, wander = 0, blink = 0, phase = null } = {}) {
    const c = new THREE.Color(color);
    this.a.position.push(x, y, z);
    this.a.color.push(c.r, c.g, c.b);
    this.a.aSize.push(size);
    this.a.aWander.push(wander);
    this.a.aBlink.push(blink);
    this.a.aPhase.push(phase ?? this.R());
  }
  /* A swarm: n points scattered in a box round (x, z), y0..y1 high. */
  swarm(n, x, z, w, d, y0, y1, color, opts = {}) {
    for (let i = 0; i < n; i++) {
      this.add(x + (this.R() - 0.5) * w, y0 + this.R() * (y1 - y0), z + (this.R() - 0.5) * d, color, opts);
    }
  }
  points(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.a.position, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.a.color, 3));
    for (const k of ["aSize", "aWander", "aBlink", "aPhase"]) g.setAttribute(k, new THREE.Float32BufferAttribute(this.a[k], 1));
    const p = new THREE.Points(g, mat);
    p.frustumCulled = false;
    p.renderOrder = 2;
    p.onBeforeRender = (renderer, scene, camera) => {
      tickTime();
      const h = renderer.getDrawingBufferSize(_v2).y;
      mat.uniforms.uScale.value = h / (2 * Math.tan(THREE.MathUtils.degToRad((camera.fov || 70) / 2)));
    };
    return p;
  }
}
const _v2 = new THREE.Vector2();

const BULBS = [0xffa040, 0xb070ff, 0x8cff5a, 0xffd27a];

/* A string of festoon lights hung through `pts` ([x, y, z] anchors),
   sagging between them: a wire, a bulb every `every` metres, and a halo
   on each bulb. */
function festoon(K, M, SP, pts, { sag = 0.55, every = 0.75, seed = 1 } = {}) {
  let k = seed;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const at = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * (len / 8) * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t];
    const n = Math.max(2, Math.ceil(len / 0.6));
    for (let j = 0; j < n; j++) K.add(M.iron, rodGeo(at(j / n), at((j + 1) / n), 0.009, 3), { shadow: false });
    const nb = Math.max(1, Math.round(len / every));
    for (let j = 0; j < nb; j++) {
      const [x, y, z] = at((j + 0.5) / nb);
      const col = BULBS[k++ % BULBS.length];
      K.add(M.bulb, place(new THREE.OctahedronGeometry(0.06), { x, y: y - 0.07, z }), { color: col, shadow: false });
      SP.add(x, y - 0.07, z, col, { size: 0.55, blink: 0.12 });
    }
  }
}

/* A plain wooden pole for the strings to hang from. */
function pole(K, M, x, z, h = 4.2) {
  K.solid(x, z, 0.2, 0.2, h, { pen: 3 });
  K.cyl(M.stairWood, x, 0, z, 0.09, 0.07, h, 6);
  K.box(M.stairWood, x, h - 0.4, z, 0.6, 0.06, 0.06);
}

/* A flat patch on the ground (planes turn with rz after rx). */
function flat(K, mat, x, z, w, d, { y = 0.012, rz = 0 } = {}) {
  K.add(mat, place(new THREE.PlaneGeometry(w, d), { x, y, z, rx: -Math.PI / 2, rz }), { shadow: false });
}

/* The open runs of [a, b] once the `gaps` ([lo, hi]) are taken out. */
function runs(a, b, gaps = []) {
  const out = [];
  let s = a;
  for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) {
    if (g0 > s) out.push([s, Math.min(g0, b)]);
    s = Math.max(s, g1);
  }
  if (b > s) out.push([s, b]);
  return out;
}

/* A gable roof with its ridge along x over the rectangle, eaves at `y`. */
function gableRoof(K, roof, end, { x0, x1, z0, z1, y, rise, over = 0.35, endT = 0.3, ridge = null }) {
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, half = (z1 - z0) / 2 + over;
  const len = Math.hypot(half, rise), ang = Math.atan2(rise, half);
  K.box(roof, mx, y + rise / 2 - 0.12, mz - half / 2, x1 - x0 + over * 2, 0.2, len, { rx: -ang });
  K.box(roof, mx, y + rise / 2 - 0.12, mz + half / 2, x1 - x0 + over * 2, 0.2, len, { rx: ang });
  if (ridge) K.box(ridge, mx, y + rise - 0.06, mz, x1 - x0 + over * 2 + 0.1, 0.18, 0.26);
  if (!end) return;
  for (const gx of [x0 + endT / 2, x1 - endT / 2]) {
    K.add(end, place(prismGeo([[-(z1 - z0) / 2, 0], [(z1 - z0) / 2, 0], [0, rise]], endT), { x: gx, y, z: mz, ry: Math.PI / 2 }));
  }
}

/* A picket fence along x at `z` from a to b, with gaps. Stops bodies only. */
function picketFence(K, M, z, a, b, gaps = []) {
  for (const [s, e] of runs(a, b, gaps)) {
    const len = e - s, c = (s + e) / 2;
    if (len < 0.2) continue;
    K.api.ghostBox(c, z, len, 0.1, 0.95, { pen: 0.3 });
    for (const y of [0.3, 0.68]) K.box(M.picket, c, y, z + 0.03, len, 0.07, 0.03);
    for (let x = s + 0.08; x < e; x += 0.17) {
      K.box(M.picket, x, 0, z, 0.08, 0.86, 0.025, {}, { shadow: false });
      K.cyl(M.picket, x, 0.86, z, 0.04, 0, 0.09, 4, { ry: Math.PI / 4 }, { shadow: false });
    }
  }
}

/* A carousel horse, nose along +x, legs mid-gallop. */
function horseGeo() {
  const parts = [
    place(new THREE.BoxGeometry(1.0, 0.4, 0.3), {}),
    place(new THREE.BoxGeometry(0.2, 0.5, 0.2), { x: 0.46, y: 0.3, rz: -0.5 }),
    place(new THREE.BoxGeometry(0.42, 0.18, 0.18), { x: 0.68, y: 0.52, rz: -0.3 }),
    place(new THREE.BoxGeometry(0.1, 0.36, 0.08), { x: 0.52, y: 0.62, rz: 0.4 }),
    place(new THREE.BoxGeometry(0.4, 0.08, 0.06), { x: -0.6, y: 0.05, rz: 0.8 }),
    place(new THREE.BoxGeometry(0.3, 0.06, 0.34), { x: -0.05, y: 0.22 }),
  ];
  for (const [lx, lz, r] of [[0.38, 0.1, -0.6], [0.38, -0.1, -0.4], [-0.38, 0.1, 0.6], [-0.38, -0.1, 0.4]]) {
    parts.push(place(new THREE.BoxGeometry(0.08, 0.5, 0.08), { x: lx, y: -0.36, z: lz, rz: r }));
  }
  const g = mergeGeometries(parts.map((p) => p.toNonIndexed()), false);
  parts.forEach((p) => p.dispose());
  return g;
}

/* Everything round the old village: the chapel, the witch's hollow, the
   glasshouse, the fair and its Ferris wheel, Trick-or-Treat Lane with the
   Troll House, the creek and the covered bridge, and the mist. */
function buildOutskirts(api, K, M, SP, root, lights) {
  const sign = (lines, o) => new THREE.MeshBasicMaterial({ map: signTexture(lines, o), color: 0xffffff });
  const R = rng(2026);

  /* ------------------------------------------- graveyard west gate */
  ironFence(K, M, { axis: "z", at: -35.6, a: -6, b: 0.4 });
  ironFence(K, M, { axis: "z", at: -35.6, a: 3.6, b: 20 });
  for (const gz of [0.1, 3.9]) {
    K.solid(-35.6, gz, 0.6, 0.6, 2.3, { mat: M.stone, pen: 10 });
    K.box(M.stoneDark, -35.6, 2.3, gz, 0.75, 0.15, 0.75);
    jack(K, M, -35.6, 2.45, gz, { r: 0.24, face: -Math.PI / 2, seed: 3000 + gz * 10, glow: false });
  }
  flat(K, M.dirt, -37.2, 2, 4.4, 2.6);

  /* ------------------------------------------- St. Grinsworth's chapel */
  {
    const C = CHAPEL, t = 0.6, cz = (C.z0 + C.z1) / 2;
    flat(K, M.stoneDark, (C.x0 + C.x1) / 2, cz, C.x1 - C.x0 - 1, C.z1 - C.z0 - 1, { y: 0.016 });
    const win = (c) => ({ c, w: 1.1, spans: [[1.8, 4.6]] });
    wall(K, { axis: "x", at: C.z0 + t / 2, a: C.x0, b: C.x1, h: C.h, t, mat: M.stone, trim: M.stoneDark, out: -1, holes: [-47, -44.2, -41.4].map(win) });
    // the south wall is broken through between x -45 and -42.2
    wall(K, { axis: "x", at: C.z1 - t / 2, a: C.x0, b: C.x1, h: C.h, t, mat: M.stone, trim: M.stoneDark, out: 1,
      holes: [win(-47.2), win(-40.4), { c: -43.6, w: 2.8, spans: [[0, 3.7]] }] });
    wall(K, { axis: "z", at: C.x0 + t / 2, a: C.z0 + t, b: C.z1 - t, h: C.h, t, mat: M.stone });
    wall(K, { axis: "z", at: C.x1 - t / 2, a: C.z0 + t, b: C.z1 - t, h: C.h, t, mat: M.stone, trim: M.stoneDark, out: 1,
      holes: [{ c: 2, w: 2.2, spans: [[0, 3.3]] }] });
    // jagged stone hanging over the breach, rubble either side of it
    for (let i = 0; i < 6; i++) {
      const x = -44.9 + i * 0.52;
      K.box(M.stone, x, 3.2 + (i % 3) * 0.12, C.z1 - 0.3, 0.5, 0.6, 0.55, { rz: (R() - 0.5) * 0.6 });
    }
    for (const [x, z, w, d] of [[-44.8, 5.5, 0.7, 0.8], [-42.5, 7.9, 0.75, 0.9]]) {
      K.api.ghostBox(x, z, w, d, 0.45, { pen: 4 });
      for (let i = 0; i < 4; i++) {
        K.add(M.stone, place(new THREE.DodecahedronGeometry(0.22 + R() * 0.14), { x: x + (R() - 0.5) * w, y: 0.15, z: z + (R() - 0.5) * d, ry: R() * 6, sy: 0.7 }));
      }
    }
    // buttresses
    for (const [x, z] of [[-45.6, C.z0 - 0.35], [-42.6, C.z0 - 0.35], [-46.0, C.z1 + 0.35], [-39.9, C.z1 + 0.35]]) {
      K.solid(x, z, 0.7, 0.7, 4.6, { mat: M.stone, pen: 10 });
      K.box(M.stoneDark, x, 4.6, z, 0.8, 0.2, 0.8, { rx: 0.3 });
    }
    // roof: the west half is whole, the east half bare rafters
    const rise = 3.5, half = (C.z1 - C.z0) / 2 + 0.4;
    const len = Math.hypot(half, rise), ang = Math.atan2(rise, half);
    for (const s of [-1, 1]) K.box(M.roof, -47.05, C.h + rise / 2 - 0.12, cz + s * half / 2, 5.6, 0.2, len, { rx: s * ang });
    for (let x = -44.0; x < C.x1 - 0.2; x += 0.9) {
      for (const s of [-1, 1]) K.add(M.stairWood, rodGeo([x, C.h, cz + s * half], [x, C.h + rise, cz], 0.07, 4));
    }
    K.box(M.stairWood, -44.25, C.h + rise - 0.1, cz, C.x1 - C.x0 + 0.6, 0.2, 0.2);
    K.box(M.roof, -43.7, C.h + 1.2, cz - 3.2, 1.6, 0.16, 1.2, { rx: -0.9, rz: 0.3 });   // a slab hanging loose
    for (const gx of [C.x0 + t / 2, C.x1 - t / 2]) {
      K.add(M.stone, place(prismGeo([[-(C.z1 - C.z0) / 2, 0], [(C.z1 - C.z0) / 2, 0], [0, rise]], t), { x: gx, y: C.h, z: cz, ry: Math.PI / 2 }));
    }
    // the rose window, both faces of the west wall
    for (const [x, ry] of [[C.x0 + t + 0.01, Math.PI / 2], [C.x0 - 0.01, -Math.PI / 2]]) {
      K.add(M.rose, place(new THREE.CircleGeometry(1.5, 36), { x, y: 4.3, z: cz, ry }), { shadow: false });
      K.add(M.stoneDark, place(new THREE.TorusGeometry(1.56, 0.12, 6, 32), { x, y: 4.3, z: cz, ry }));
    }
    // the bell tower over the east gable
    {
      const tx = -40, tz = cz, y0 = C.h;
      K.box(M.stone, tx, y0, tz, 2, 3.6, 2);
      for (const [dx, dz] of [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]]) K.box(M.stone, tx + dx, y0 + 3.6, tz + dz, 0.3, 2.6, 0.3);
      K.box(M.stoneDark, tx, y0 + 6.2, tz, 2.3, 0.35, 2.3);
      K.add(M.roof, place(new THREE.ConeGeometry(1.6, 3.4, 4), { x: tx, y: y0 + 6.55 + 1.7, z: tz, ry: Math.PI / 4 }));
      K.cyl(M.iron, tx, y0 + 9.9, tz, 0.04, 0.02, 0.9, 4);
      K.box(M.iron, tx, y0 + 10.4, tz, 0.05, 0.05, 0.5);
      K.add(M.gold, place(new THREE.CylinderGeometry(0.22, 0.55, 0.8, 14, 1, true), { x: tx, y: y0 + 4.6, z: tz }));
      K.cyl(M.iron, tx, y0 + 4.95, tz, 0.05, 0.05, 1.2, 4);
      K.box(M.burlap, tx - 0.1, 1.2, tz + 0.6, 0.03, y0 + 3.6 - 1.2, 0.03, {}, { shadow: false });
    }
    // inside: the dais, the altar, the pews (the south side's mostly smashed)
    K.solid(-47.8, cz, 2.2, C.z1 - C.z0 - 1.2, 0.3, { mat: M.stoneDark, pen: 8 });
    K.solid(-48.3, cz, 0.9, 2.2, 1.0, { y: 0.3, mat: M.stone, pen: 8 });
    K.box(M.fabric, -48.3, 1.3, cz, 1.0, 0.02, 2.4, {}, { shadow: false });
    K.box(M.fabric, -47.83, 0.75, cz, 0.02, 0.56, 1.1, {}, { shadow: false });
    for (let i = 0; i < 5; i++) candle(K, M, -48.3, 1.31, cz - 0.8 + i * 0.4, { seed: 3100 + i, h: 0.14 + (i % 2) * 0.1 });
    for (const dz of [-1.6, 1.6]) {
      K.cyl(M.iron, -47.3, 0.3, cz + dz, 0.12, 0.04, 1.2, 6);
      for (const k of [-0.15, 0, 0.15]) candle(K, M, -47.3 + k, 1.5, cz + dz, { seed: 3120 + dz * 10 + k * 10 });
    }
    const pew = (x, zc, l) => {
      K.api.ghostBox(x, zc, 0.55, l, 0.95, { pen: 1.5 });
      K.box(M.stairWood, x, 0.42, zc, 0.46, 0.06, l);
      K.box(M.stairWood, x + 0.22, 0.42, zc, 0.06, 0.55, l);
      for (const e of [-1, 1]) K.box(M.stairWood, x, 0, zc + e * (l / 2 - 0.04), 0.5, 0.95, 0.08);
    };
    for (const x of [-46, -44.6, -43.2, -41.8, -40.4]) pew(x, -0.6, 2.8);
    for (const x of [-46, -41.8, -40.4]) pew(x, 4.6, 2.8);
    for (const x of [-44.6, -43.2]) {
      for (let i = 0; i < 4; i++) K.box(M.stairWood, x + (R() - 0.5) * 0.8, 0.03, 4.4 + (R() - 0.5) * 2, 0.4, 0.05, 1 + R(), { ry: R() * 2, rz: (R() - 0.5) * 0.3 });
    }
    K.add(sign(["ST. GRINSWORTH'S"], { bg: "#141018", fg: "#c9a6ff", edge: "#3a2a4a" }), place(new THREE.PlaneGeometry(3.4, 0.62), { x: C.x1 + 0.02, y: 4.0, z: cz, ry: Math.PI / 2 }), { shadow: false });
    const l = new THREE.PointLight(0xb070ff, 10, 16, 2);
    l.position.set(-44.5, 4.2, cz);
    lights.push(l);
    SP.swarm(10, -44, cz, 8, 8, 1, 5, 0xb48cff, { size: 0.3, wander: 1.4, blink: 0.4 });

    // the churchyard, out through the breach
    for (const [x, z] of [[-47.8, 10.4], [-45.6, 10.2], [-40.4, 10.6], [-48.2, 13.6], [-44.2, 14.2], [-39.8, 13.8]]) {
      const w = 0.6 + R() * 0.2, h = 0.8 + R() * 0.3;
      K.api.ghostBox(x, z, w, 0.3, h, { pen: 3 });
      K.add(R() < 0.5 ? M.stone : M.stoneDark, place(headstoneGeo(w, h, 0.18), { x, z, ry: (R() - 0.5) * 0.2 }));
    }
    for (const [x, z] of [[-46.4, 12.4], [-42.2, 12.0]]) {
      K.box(M.dirt, x, 0, z, 0.8, 0.08, 1.7, {}, { shadow: false });
      K.add(M.dirt, place(new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), { x: x + 0.85, y: 0, z, sx: 0.7, sy: 0.5, sz: 1.6 }));
      ZSPAWNS.push({ x, y: 0, z, rise: true });
    }
    jack(K, M, -43.6, 0, 9.4, { r: 0.26, face: Math.PI, seed: 3200 });
  }

  /* ------------------------------------------- the witch's hollow */
  {
    // the pond: water, a mud bank, stones, reeds, lily pads
    const shape = (pts) => new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    K.add(M.pond, place(new THREE.ShapeGeometry(shape(pondOutline(28, 0))), { y: 0.04, rx: -Math.PI / 2 }), { shadow: false });
    const bank = shape(pondOutline(28, 1.1));
    bank.holes.push(new THREE.Path(pondOutline(28, -0.1).map(([x, z]) => new THREE.Vector2(x, -z))));
    K.add(M.dirt, place(new THREE.ShapeGeometry(bank), { y: 0.022, rx: -Math.PI / 2 }), { shadow: false });
    for (const [i, [x, z]] of pondOutline(22, 0.6).entries()) {
      if (i % 2) K.add(M.stoneDark, place(new THREE.DodecahedronGeometry(0.18 + R() * 0.2), { x, y: 0.08, z, sy: 0.6, ry: R() * 6 }));
      else for (let k = 0; k < 6; k++) K.box(M.stem, x + (R() - 0.5) * 0.5, 0, z + (R() - 0.5) * 0.5, 0.025, 0.7 + R() * 0.6, 0.025, { rz: (R() - 0.5) * 0.3, rx: (R() - 0.5) * 0.3 }, { shadow: false });
    }
    for (const [x, z, r] of [[-44, -21.5, 0.4], [-48.6, -18.4, 0.35], [-43.2, -18.6, 0.3], [-45.4, -17.4, 0.32], [-47.5, -19.3, 0.6]]) {
      K.add(M.lily, place(new THREE.CircleGeometry(r, 14, 0.3, Math.PI * 2 - 0.6), { x, y: 0.05, z, rx: -Math.PI / 2, rz: R() * 6 }), { shadow: false });
    }
    // the easter egg: Pepe, sitting on the big pad, looking east
    mapModel(api, "hg-pepe", { x: -47.5, z: -19.3, y: 0.06, rot: Math.PI / 2, scale: 0.3 });
    SP.swarm(14, POND.x, POND.z, 12, 10, 0.4, 2, 0xd8ff6a, { size: 0.12, wander: 0.9, blink: 1 });
    ZSPAWNS.push({ x: -43, y: 0, z: -19.5, rise: true });

    // paths: from the hedge garden's west gap, and from the pond to the hut
    flat(K, M.dirt, -35.5, -19, 10, 2.2);
    flat(K, M.dirt, -44.6, -31, 2, 13);

    // the hut, crooked, with a thatch roof
    const hx0 = -47.5, hx1 = -42, hz0 = -42.5, hz1 = -37.5, hh = 2.8, ht = 0.25;
    const HW = { mat: M.witchWood, trim: M.trimDark, shutter: M.shutter, t: ht, h: hh };
    wall(K, { axis: "x", at: hz0 + ht / 2, a: hx0, b: hx1, out: -1, ...HW, holes: [{ c: -45.5, w: 0.8, spans: [[1.0, 1.8]] }] });
    wall(K, { axis: "x", at: hz1 - ht / 2, a: hx0, b: hx1, out: 1, ...HW, holes: [{ c: -44.6, w: 1.2, spans: [[0, 2.1]] }, { c: -46.6, w: 0.8, spans: [[1.0, 1.8]] }] });
    wall(K, { axis: "z", at: hx0 + ht / 2, a: hz0 + ht, b: hz1 - ht, out: -1, ...HW, holes: [{ c: -40, w: 0.8, spans: [[1.0, 1.8]] }] });
    wall(K, { axis: "z", at: hx1 - ht / 2, a: hz0 + ht, b: hz1 - ht, out: 1, ...HW, holes: [{ c: -41.4, w: 1.2, spans: [[0, 2.1]] }] });
    K.api.ghostBox((hx0 + hx1) / 2, (hz0 + hz1) / 2, 6, 5.5, 0.3, { y: hh, pen: 6 });
    K.add(M.thatch, place(new THREE.ConeGeometry(4.3, 3.2, 4, 1, true), { x: (hx0 + hx1) / 2, y: hh + 1.5, z: (hz0 + hz1) / 2, ry: Math.PI / 4 + 0.08, rz: 0.06 }));
    K.cyl(M.brick, -43, hh, -41.6, 0.25, 0.2, 2.6, 6, { rz: -0.1 });
    flat(K, M.floor, (hx0 + hx1) / 2, (hz0 + hz1) / 2, 5, 4.5, { y: 0.018 });
    // potion shelves along the west wall, glowing
    for (let s = 0; s < 3; s++) {
      K.box(M.stairWood, hx0 + 0.45, 0.6 + s * 0.55, -40, 0.35, 0.04, 3.2);
      for (let i = 0; i < 9; i++) {
        const col = [0x6aff8c, 0xb070ff, 0xffa040, 0x5ac8ff][(i + s) % 4];
        const h = 0.16 + R() * 0.14;
        K.add(M.bulb, place(new THREE.CylinderGeometry(0.06, 0.08, h, 8), { x: hx0 + 0.45, y: 0.64 + s * 0.55 + h / 2, z: -41.4 + i * 0.35 }), { color: col, shadow: false });
        if (i % 3 === 0) SP.add(hx0 + 0.5, 0.75 + s * 0.55, -41.4 + i * 0.35, col, { size: 0.3, blink: 0.2 });
      }
    }
    K.api.ghostBox(hx0 + 0.45, -40, 0.4, 3.3, 2.0, { pen: 2 });
    K.solid(-45.6, -41.4, 1.2, 0.8, 0.8, { mat: M.stairWood, pen: 1.5 });
    candle(K, M, -45.8, 0.8, -41.4, { seed: 3300 });
    // the cauldron, bubbling green over a fire
    {
      const cx = -40.5, cz = -33.5;
      K.api.ghostBox(cx, cz, 1.5, 1.5, 0.95, { pen: 6 });
      K.add(M.iron, place(new THREE.SphereGeometry(0.7, 16, 10, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65), { x: cx, y: 0.85, z: cz }));
      K.add(M.iron, place(new THREE.TorusGeometry(0.62, 0.05, 6, 20), { x: cx, y: 0.9, z: cz, rx: Math.PI / 2 }));
      K.add(M.brew, place(new THREE.CircleGeometry(0.6, 20), { x: cx, y: 0.84, z: cz, rx: -Math.PI / 2 }), { shadow: false, phase: 0.2 });
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        K.box(M.iron, cx + Math.cos(a) * 0.5, 0, cz + Math.sin(a) * 0.5, 0.07, 0.4, 0.07);
      }
      for (let i = 0; i < 5; i++) K.cyl(M.bark, cx + (R() - 0.5) * 0.4, 0.04, cz + (R() - 0.5) * 0.4, 0.06, 0.05, 0.8, 5, { rz: Math.PI / 2, ry: R() * 3 });
      for (const ry of [0, Math.PI / 3, (2 * Math.PI) / 3]) K.add(M.flame, place(new THREE.PlaneGeometry(0.7, 0.5), { x: cx, y: 0.28, z: cz, ry }), { phase: 0.6, shadow: false });
      K.add(M.greenGlow, place(new THREE.PlaneGeometry(5, 5), { x: cx, y: 0.04, z: cz, rx: -Math.PI / 2 }), { shadow: false, phase: 0.7 });
      SP.swarm(8, cx, cz, 0.8, 0.8, 1.0, 2.4, 0x8cff6a, { size: 0.16, wander: 0.4, blink: 0.8 });
    }
    // the toadstool fairy ring
    {
      const fx = -36.5, fz = -40;
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2, r = 2.2 + (R() - 0.5) * 0.3, s = 0.6 + R() * 0.6;
        const x = fx + Math.cos(a) * r, z = fz + Math.sin(a) * r;
        K.cyl(M.picket, x, 0, z, 0.06 * s, 0.05 * s, 0.35 * s, 6);
        K.add(M.toadCap, place(new THREE.SphereGeometry(0.2 * s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), { x, y: 0.33 * s, z, sy: 0.7 }));
      }
      K.add(M.purpleGlow, place(new THREE.PlaneGeometry(6, 6), { x: fx, y: 0.04, z: fz, rx: -Math.PI / 2 }), { shadow: false, phase: 0.1 });
      SP.swarm(9, fx, fz, 4, 4, 0.3, 1.6, 0xd08cff, { size: 0.2, wander: 0.6, blink: 0.6 });
      ZSPAWNS.push({ x: fx, y: 0, z: fz, rise: true });
    }
    // dead trees
    for (const [x, z, seed] of [[-49, -30, 4001], [-38.4, -26.5, 4002], [-49.2, -43.2, 4003], [-33.5, -33, 4004]]) {
      K.add(M.bark, place(treeGeo(seed, { height: 6 + (seed % 3), r: 0.28, levels: 3 }), { x, z, ry: seed }));
      K.api.ghostBox(x, z, 0.6, 0.6, 4, { pen: 6 });
    }
    SP.swarm(12, -42, -36, 14, 12, 0.6, 3, 0x7affd0, { size: 0.3, wander: 1.6, blink: 0.4 });
  }

  /* ------------------------------------------- the glasshouse */
  {
    const gx0 = -9, gx1 = 9, gz0 = -43, gz1 = -34, eave = 3, ridgeY = 5.2, gcz = (gz0 + gz1) / 2;
    const G = { t: 0.12, h: eave, mat: null, pen: 0.6 };
    const sDoors = [{ c: -6.5, w: 1.4, spans: [[0, 2.4]] }, { c: 6.5, w: 1.4, spans: [[0, 2.4]] }];
    const nDoors = [{ c: 0, w: 1.6, spans: [[0, 2.4]] }];
    const ewDoor = [{ c: -38.5, w: 1.4, spans: [[0, 2.4]] }];
    wall(K, { axis: "x", at: gz1, a: gx0, b: gx1, ...G, holes: sDoors });
    wall(K, { axis: "x", at: gz0, a: gx0, b: gx1, ...G, holes: nDoors });
    wall(K, { axis: "z", at: gx0, a: gz0, b: gz1, ...G, holes: ewDoor });
    wall(K, { axis: "z", at: gx1, a: gz0, b: gz1, ...G, holes: ewDoor });
    const holesOf = (hs) => hs.map((h) => [h.c - h.w / 2, h.c + h.w / 2]);
    const side = (axis, at, a, b, holes) => {
      const gaps = holesOf(holes);
      const pos = (s, w, d) => (axis === "x" ? [s, at, w, d] : [at, s, d, w]);
      for (const [s, e] of runs(a, b, gaps)) {
        const [x, z, w, d] = pos((s + e) / 2, e - s, 0.24);
        K.box(M.brick, x, 0, z, w, 0.7, d);
      }
      // mullions every 1.5 m, panes between (some smashed), a transom over doors
      for (let s = a; s <= b + 0.01; s += 1.5) {
        const [x, z] = pos(s, 0, 0);
        K.box(M.iron, x, 0.7, z, 0.07, eave - 0.7, 0.07);
      }
      for (let s = a; s < b - 0.01; s += 1.5) {
        const e = Math.min(b, s + 1.5), c = (s + e) / 2;
        const door = gaps.some(([g0, g1]) => c > g0 - 0.4 && c < g1 + 0.4);
        if (!door && R() < 0.25) continue;
        const [x, z, w, d] = pos(c, e - s - 0.07, 0.02);
        if (door) K.box(M.glass, x, 2.45, z, w, eave - 2.45, d, {}, { shadow: false });
        else K.box(M.glass, x, 0.7, z, w, eave - 0.7, d, {}, { shadow: false });
      }
      const [x, z, w, d] = pos((a + b) / 2, b - a, 0.1);
      K.box(M.iron, x, eave - 0.06, z, w, 0.08, d);
    };
    side("x", gz1, gx0, gx1, sDoors);
    side("x", gz0, gx0, gx1, nDoors);
    side("z", gx0, gz0, gz1, ewDoor);
    side("z", gx1, gz0, gz1, ewDoor);
    // the glass roof on iron rafters
    const half = (gz1 - gz0) / 2, rise = ridgeY - eave;
    const len = Math.hypot(half, rise), ang = Math.atan2(rise, half);
    for (let x = gx0; x <= gx1 + 0.01; x += 1.5) {
      for (const s of [-1, 1]) K.add(M.iron, rodGeo([x, eave, gcz + s * half], [x, ridgeY, gcz], 0.04, 4));
    }
    for (let x = gx0; x < gx1 - 0.01; x += 1.5) {
      for (const s of [-1, 1]) {
        if (R() < 0.2) continue;
        K.box(M.glass, x + 0.75, eave + rise / 2 - 0.01, gcz + s * half / 2, 1.43, 0.02, len, { rx: s * ang }, { shadow: false });
      }
    }
    K.box(M.iron, 0, ridgeY - 0.05, gcz, gx1 - gx0, 0.1, 0.1);
    for (const x of [gx0, gx1]) K.add(M.glass, place(prismGeo([[-half, 0], [half, 0], [0, rise]], 0.02), { x, y: eave, z: gcz, ry: Math.PI / 2 }), { shadow: false });
    flat(K, M.stoneDark, 0, gcz, gx1 - gx0 - 0.2, gz1 - gz0 - 0.2, { y: 0.016 });
    // raised beds of glowing plants
    for (const [x, z, w, d] of [[-4.7, -40.8, 7, 1.6], [4.7, -40.8, 7, 1.6], [0, -36.3, 10.8, 1.4]]) {
      K.solid(x, z, w, d, 0.6, { mat: M.brick, pen: 3 });
      flat(K, M.dirt, x, z, w - 0.2, d - 0.2, { y: 0.61 });
      for (let i = 0; i < Math.round(w * 1.6); i++) {
        const px = x - w / 2 + 0.3 + R() * (w - 0.6), pz = z + (R() - 0.5) * (d - 0.4);
        K.add(M.leaf, place(new THREE.PlaneGeometry(0.6, 0.6), { x: px, y: 0.9, z: pz, ry: R() * 3 }), { shadow: false });
        if (i % 3 === 0) {
          const col = [0x6aff8c, 0xb070ff, 0xffd27a][i % 3 === 0 ? (i / 3) % 3 : 0];
          K.add(M.bulb, place(new THREE.SphereGeometry(0.07, 6, 4), { x: px, y: 1.15, z: pz }), { color: col, shadow: false });
          SP.add(px, 1.15, pz, col, { size: 0.35, blink: 0.3 });
        }
      }
    }
    festoon(K, M, SP, [[gx0 + 0.5, ridgeY - 0.4, gcz], [gx1 - 0.5, ridgeY - 0.4, gcz]], { sag: 0.35, seed: 7 });
    SP.swarm(10, 0, gcz, 16, 7, 0.8, 2.6, 0xd8ff6a, { size: 0.12, wander: 0.8, blink: 1 });
    K.add(M.greenGlow, place(new THREE.PlaneGeometry(16, 8), { x: 0, y: 0.03, z: gcz, rx: -Math.PI / 2 }), { shadow: false, phase: 0.5 });
    ZSPAWNS.push({ x: 4.2, y: 0, z: -38.5, rise: true });
    // paths from the manor's back doors
    for (const s of [-1, 1]) flat(K, M.dirt, s * 7.25, -31, 2, 6.2);
  }

  /* ------------------------------------------- Grinmoor Fair (east) */
  {
    flat(K, M.dirt, 39.2, -3.5, 3.4, 73);
    flat(K, M.dirt, 28.6, 4.1, 17.4, 1.8);
    // the entrance arch
    for (const z of [2.3, 5.9]) {
      K.solid(37.3, z, 0.4, 0.4, 4.2, { mat: M.barn, pen: 6 });
      K.add(M.gold, place(new THREE.SphereGeometry(0.22, 10, 8), { x: 37.3, y: 4.4, z }));
    }
    K.box(M.barn, 37.3, 3.5, 4.1, 0.2, 0.85, 4.2);
    const fairSign = sign(["GRINMOOR FAIR"], { bg: "#1a0c14", fg: "#ffcf5a", edge: "#c0283a" });
    for (const [x, ry] of [[37.18, -Math.PI / 2], [37.42, Math.PI / 2]]) K.add(fairSign, place(new THREE.PlaneGeometry(3.9, 0.72), { x, y: 3.92, z: 4.1, ry }), { shadow: false });
    festoon(K, M, SP, [[37.3, 4.5, 2.3], [37.3, 4.5, 5.9]], { sag: 0.25, every: 0.4, seed: 3 });

    // the carousel
    {
      const { x: cx, z: cz, r } = CAROUSEL;
      K.api.ghostBox(cx, cz, r * 2, r * 1.25, 0.3, { pen: 6 });
      K.api.ghostBox(cx, cz, r * 1.25, r * 2, 0.3, { pen: 6 });
      K.solid(cx, cz, 1.3, 1.3, 4.6, { pen: 10 });
      K.cyl(M.gold, cx, 0.3, cz, 0.62, 0.62, 4.3, 16);
      K.add(M.awningRed, place(new THREE.ConeGeometry(r + 0.6, 1.8, 24, 1, true), { x: cx, y: 4.6 + 0.9, z: cz }));
      K.add(M.awningRed, place(new THREE.CylinderGeometry(r + 0.6, r + 0.6, 0.5, 24, 1, true), { x: cx, y: 4.35, z: cz }));
      K.add(M.gold, place(new THREE.TorusGeometry(r + 0.6, 0.06, 6, 32), { x: cx, y: 4.1, z: cz, rx: Math.PI / 2 }));
      K.cyl(M.gold, cx, 6.4, cz, 0.12, 0.02, 0.8, 8);
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2, x = cx + Math.cos(a) * (r + 0.62), z = cz + Math.sin(a) * (r + 0.62);
        const col = BULBS[i % BULBS.length];
        K.add(M.bulb, place(new THREE.OctahedronGeometry(0.07), { x, y: 4.08, z }), { color: col, shadow: false });
        SP.add(x, 4.08, z, col, { size: 0.5, blink: 0.25 });
      }
      // the turning part: platform, poles, horses and pumpkin coaches
      const spin = new THREE.Group();
      spin.position.set(cx, 0, cz);
      root.add(spin);
      const plat = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.3, 32), M.stairWood);
      plat.position.y = 0.15;
      plat.receiveShadow = true;
      spin.add(plat);
      const poleParts = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        poleParts.push(new THREE.CylinderGeometry(0.035, 0.035, 4.0, 6).translate(Math.cos(a) * 3.3, 2.3, Math.sin(a) * 3.3));
      }
      const poles = new THREE.Mesh(mergeGeometries(poleParts), M.gold);
      poleParts.forEach((p) => p.dispose());
      spin.add(poles);
      const horses = new THREE.InstancedMesh(horseGeo(), M.horse, 8);
      const coaches = new THREE.InstancedMesh(pumpkinGeo(0.6, { ribs: 10, squash: 0.85 }), M.pumpkinSolid, 4);
      horses.castShadow = coaches.castShadow = true;
      horses.frustumCulled = coaches.frustumCulled = false;
      spin.add(horses, coaches);
      for (let i = 0; i < 4; i++) {
        const a = ((i + 0.5) / 4) * Math.PI * 2;
        _e.set(0, -a, 0);
        _q.setFromEuler(_e);
        _m4.compose(_p.set(Math.cos(a) * 1.9, 0.82, Math.sin(a) * 1.9), _q, _s.set(1, 1, 1));
        coaches.setMatrixAt(i, _m4);
      }
      plat.onBeforeRender = () => {
        const t = performance.now() / 1000;
        spin.rotation.y = -t * 0.35;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          _e.set(0, -a - Math.PI / 2, 0);
          _q.setFromEuler(_e);
          _m4.compose(_p.set(Math.cos(a) * 3.3, 1.35 + 0.28 * Math.sin(t * 2.2 + i * 1.7), Math.sin(a) * 3.3), _q, _s.set(1, 1, 1));
          horses.setMatrixAt(i, _m4);
        }
        horses.instanceMatrix.needsUpdate = true;
      };
      plat.onBeforeRender();
      const l = new THREE.PointLight(0xffc070, 10, 16, 2);
      l.position.set(cx, 3.4, cz);
      lights.push(l);
    }

    // the game booths, facing west onto the midway
    const booth = (z0, z1, title, stripes) => {
      const mz = (z0 + z1) / 2, d = z1 - z0;
      K.solid(49.5, mz, 0.2, d, 3, { mat: M.stairWood, pen: 8 });
      for (const z of [z0 + 0.1, z1 - 0.1]) K.solid(47.8, z, 3.6, 0.2, 2.6, { mat: M.stairWood, pen: 8 });
      K.solid(46.25, mz, 0.5, d - 0.4, 1.0, { mat: M.barn, pen: 2 });
      K.box(stripes, 47.7, 2.6, mz, 4.0, 0.05, d + 0.3, { rz: -0.14 });
      K.add(stripes, place(new THREE.PlaneGeometry(d + 0.3, 0.45), { x: 45.75, y: 2.45, z: mz, ry: -Math.PI / 2 }), { shadow: false });
      K.add(sign([title], { bg: "#1a0c14", fg: "#ffcf5a", edge: "#7a2ab8" }), place(new THREE.PlaneGeometry(d - 0.8, 0.6), { x: 45.7, y: 3.1, z: mz, ry: -Math.PI / 2 }), { shadow: false });
      festoon(K, M, SP, [[45.8, 2.75, z0 + 0.2], [45.8, 2.75, z1 - 0.2]], { sag: 0.15, every: 0.45, seed: Math.round(z0) });
      K.box(M.lampGlass, 47.6, 2.35, mz, 0.08, 0.05, d - 0.8, {}, { shadow: false });
      K.add(M.glow, place(new THREE.PlaneGeometry(3.4, d), { x: 47.8, y: 0.03, z: mz, rx: -Math.PI / 2 }), { shadow: false, phase: 0.2 });
    };
    booth(6.8, 11.2, "WHACK-A-TROLL", M.awningRed);
    booth(14.4, 18.8, "RING TOSS", M.awningPurple);
    // whack-a-troll: the mole board, and troll heads popping out of it
    K.box(M.trimDark, 47.8, 0, 9, 1.2, 0.95, 3.6);
    const heads = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.42, 0.42), M.trollLit, 6);
    root.add(heads);
    heads.frustumCulled = false;
    heads.onBeforeRender = () => {
      const t = performance.now() / 1000;
      for (let i = 0; i < 6; i++) {
        const k = Math.max(0, Math.sin(t * (1.6 + i * 0.37) + i * 2.1));
        _e.set(0, -Math.PI / 2, 0);
        _q.setFromEuler(_e);
        _m4.compose(_p.set(47.15, 0.98 + 0.45 * k, 7.6 + i * 0.56), _q, _s.set(1, 1, 1));
        heads.setMatrixAt(i, _m4);
      }
      heads.instanceMatrix.needsUpdate = true;
    };
    heads.onBeforeRender();
    K.box(M.barn, 46.9, 1.0, 9, 0.12, 0.3, 3.6);
    // ring toss: bottles on tiers, rings on the counter
    for (let tier = 0; tier < 3; tier++) {
      K.box(M.stairWood, 48.2 + tier * 0.4, 0, 16.6, 0.4, 0.9 + tier * 0.3, 3.4);
      for (let i = 0; i < 8; i++) {
        const col = new THREE.Color().setHSL(R(), 0.7, 0.45).getHex();
        K.add(M.candy, place(new THREE.CylinderGeometry(0.05, 0.09, 0.32, 8), { x: 48.2 + tier * 0.4, y: 0.9 + tier * 0.3 + 0.16, z: 15.2 + i * 0.4 }), { color: col, shadow: false });
      }
    }
    for (let i = 0; i < 5; i++) K.add(M.candy, place(new THREE.TorusGeometry(0.12, 0.02, 4, 12), { x: 46.25 + (R() - 0.5) * 0.2, y: 1.02, z: 15.4 + i * 0.5, rx: Math.PI / 2 }), { color: [0xff3a5a, 0xffd23a, 0x3ad0ff][i % 3], shadow: false });

    // the candy-apple cart
    {
      const x = 43.2, z = 24;
      K.api.ghostBox(x, z, 1.8, 1.0, 1.0, { pen: 2 });
      K.box(M.barn, x, 0.35, z, 1.8, 0.65, 1.0);
      for (const dz of [-0.55, 0.55]) K.add(M.trimDark, place(new THREE.TorusGeometry(0.3, 0.04, 6, 14), { x: x - 0.4, y: 0.3, z: z + dz }));
      for (let i = 0; i < 12; i++) {
        const ax = x - 0.7 + (i % 6) * 0.28, az = z - 0.2 + Math.floor(i / 6) * 0.4;
        K.add(M.candy, place(new THREE.SphereGeometry(0.09, 8, 6), { x: ax, y: 1.09, z: az }), { color: 0xb8101e, shadow: false });
        K.box(M.stairWood, ax, 1.15, az, 0.015, 0.16, 0.015, {}, { shadow: false });
      }
      for (const [dx, dz] of [[-0.85, -0.45], [0.85, -0.45], [-0.85, 0.45], [0.85, 0.45]]) K.box(M.iron, x + dx, 1.0, z + dz, 0.04, 1.2, 0.04);
      K.box(M.awningRed, x, 2.2, z, 2.1, 0.04, 1.3);
      SP.add(x, 2.0, z, 0xffd27a, { size: 0.8, blink: 0.1 });
    }
    // the ticket booth, with the second easter egg on its north side
    {
      const x = 36.2, z = 7.6;
      K.solid(x, z, 1.6, 1.6, 2.4, { mat: M.barn, pen: 8 });
      K.add(M.roof, place(new THREE.ConeGeometry(1.4, 1.1, 4), { x, y: 2.95, z, ry: Math.PI / 4 }));
      K.add(M.winGlow, place(new THREE.PlaneGeometry(0.8, 0.6), { x: x - 0.81, y: 1.4, z, ry: -Math.PI / 2 }), { shadow: false });
      K.add(sign(["TICKETS"], { w: 512, h: 128, bg: "#1a0c14", fg: "#ffcf5a", edge: "#c0283a" }), place(new THREE.PlaneGeometry(1.2, 0.3), { x: x - 0.82, y: 2.0, z, ry: -Math.PI / 2 }), { shadow: false });
      K.add(M.posterPaint, place(new THREE.PlaneGeometry(1.42, 0.8), { x, y: 1.35, z: z - 0.82, ry: Math.PI }), { shadow: false });
      K.box(M.gold, x, 0.91, z - 0.81, 1.56, 0.07, 0.04);
      K.box(M.gold, x, 1.74, z - 0.81, 1.56, 0.07, 0.04);
    }
    // the high striker
    {
      const x = 42.5, z = -17;
      K.solid(x, z, 1.2, 1.2, 0.3, { mat: M.stairWood, pen: 6 });
      K.solid(x, z, 0.35, 0.35, 5.6, { y: 0.3, pen: 6 });
      K.box(M.awningRed, x - 0.18, 0.3, z, 0.02, 5.3, 0.3, {}, { shadow: false });
      K.box(M.barnTrim, x, 0.3, z, 0.3, 5.3, 0.25);
      K.add(M.gold, place(new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), { x, y: 5.75, z, rx: Math.PI }));
      K.box(M.candy, x - 0.2, 1.6, z, 0.12, 0.12, 0.16, {}, { color: 0xff3a3a });
      K.add(sign(["TEST YOUR LULZ"], { bg: "#1a0c14", fg: "#ff5a6a", edge: "#ffd23a" }), place(new THREE.PlaneGeometry(2.6, 0.5), { x: x - 0.2, y: 6.3, z, ry: -Math.PI / 2 }), { shadow: false });
      K.box(M.stairWood, x - 0.9, 0, z + 0.7, 0.07, 1.1, 0.07, { rz: 0.35 });
      K.box(M.stairWood, x - 1.08, 1.02, z + 0.7, 0.32, 0.2, 0.2, { rz: 0.35 });
      SP.add(x, 5.6, z, 0xffd27a, { size: 0.9, blink: 0.3 });
    }
    // Madame Lulz's fortune tent
    {
      const x = 45.5, z = -30, r = 2.4;
      K.add(M.awningPurple, place(new THREE.CylinderGeometry(r, r, 2.2, 14, 1, true, Math.PI * 1.5 + 0.32, Math.PI * 2 - 0.64), { x, y: 1.1, z }));
      K.add(M.awningPurple, place(new THREE.ConeGeometry(r + 0.25, 2.0, 14, 1, true), { x, y: 3.2, z }));
      K.add(M.gold, place(new THREE.SphereGeometry(0.15, 8, 6), { x, y: 4.3, z }));
      K.api.ghostBox(x, z - r, r * 2, 0.2, 2.2, { pen: 1 });
      K.api.ghostBox(x, z + r, r * 2, 0.2, 2.2, { pen: 1 });
      K.api.ghostBox(x + r, z, 0.2, r * 2, 2.2, { pen: 1 });
      for (const s of [-1, 1]) K.api.ghostBox(x - r, z + s * 1.5, 0.2, 1.8, 2.2, { pen: 1 });
      K.solid(x + 0.6, z, 1.0, 1.0, 0.8, { mat: M.fabric, pen: 1.5 });
      K.add(M.bulb, place(new THREE.SphereGeometry(0.2, 14, 10), { x: x + 0.6, y: 1.0, z }), { color: 0xc89aff, shadow: false });
      K.add(M.purpleGlow, place(new THREE.PlaneGeometry(4, 4), { x, y: 0.04, z, rx: -Math.PI / 2 }), { shadow: false, phase: 0.4 });
      SP.add(x + 0.6, 1.0, z, 0xb070ff, { size: 1.4, blink: 0.3 });
      K.add(sign(["MADAME LULZ"], { bg: "#140a1c", fg: "#d8a6ff", edge: "#ffcf5a" }), place(new THREE.PlaneGeometry(2.2, 0.45), { x: x - r - 0.05, y: 2.45, z, ry: -Math.PI / 2 }), { shadow: false });
    }
    // string lights zig-zagging down the midway
    const fpts = [[37.6, -36], [41.4, -30], [37.6, -24], [41.4, -18], [37.6, -12], [37.6, 0], [41.4, 12], [37.6, 24], [41.4, 30]];
    for (const [x, z] of fpts) pole(K, M, x, z);
    festoon(K, M, SP, fpts.map(([x, z]) => [x, 4.0, z]), { seed: 11 });

    // the Ferris wheel, out past the wall (art only)
    {
      const { x: fx, z: fz, r, hub } = FERRIS;
      for (const s of [-1, 1]) {
        for (const dz of [-5, 5]) K.add(M.steel, rodGeo([fx + s * 1.6, 0, fz + dz], [fx + s * 0.7, hub, fz], 0.16, 6));
        K.box(M.steel, fx + s * 1.6, 0, fz, 0.3, 0.3, 10.4);
      }
      K.add(M.steel, rodGeo([fx - 1.0, hub, fz], [fx + 1.0, hub, fz], 0.3, 10));
      const wheel = new THREE.Group();
      wheel.position.set(fx, hub, fz);
      root.add(wheel);
      const KW = new Kit(api, wheel);
      const WS = new Sparks();
      for (const s of [-0.5, 0.5]) {
        KW.add(M.steel, place(new THREE.TorusGeometry(r, 0.11, 6, 64), { x: s, ry: Math.PI / 2 }));
        KW.add(M.steel, place(new THREE.TorusGeometry(r * 0.55, 0.07, 6, 48), { x: s, ry: Math.PI / 2 }));
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          KW.add(M.steel, rodGeo([s * 0.3, 0, 0], [s, Math.cos(a) * r, Math.sin(a) * r], 0.05, 4));
        }
        for (let i = 0; i < 48; i++) {
          const a = (i / 48) * Math.PI * 2, y = Math.cos(a) * (r + 0.15), z = Math.sin(a) * (r + 0.15);
          const col = BULBS[i % BULBS.length];
          KW.add(M.bulb, place(new THREE.OctahedronGeometry(0.11), { x: s, y, z }), { color: col, shadow: false });
          WS.add(s, y, z, col, { size: 0.8, blink: 0.15 });
        }
      }
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        KW.add(M.steel, rodGeo([-0.5, Math.cos(a) * r, Math.sin(a) * r], [0.5, Math.cos(a) * r, Math.sin(a) * r], 0.05, 4));
      }
      KW.flush();
      wheel.add(WS.points(sparkMaterial()));
      const cabin = mergeGeometries([
        new THREE.BoxGeometry(1.1, 0.9, 1.0).translate(0, -1.0, 0).toNonIndexed(),
        new THREE.ConeGeometry(0.8, 0.4, 4).rotateY(Math.PI / 4).translate(0, -0.35, 0).toNonIndexed(),
      ], false);
      const cabins = new THREE.InstancedMesh(cabin, M.awningRed, 16);
      cabins.frustumCulled = false;
      root.add(cabins);
      cabins.onBeforeRender = () => {
        const t = performance.now() / 1000, th = t * 0.12;
        wheel.rotation.x = th;
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2 + th;
          _m4.makeTranslation(fx, hub + Math.cos(a) * r, fz + Math.sin(a) * r);
          cabins.setMatrixAt(i, _m4);
        }
        cabins.instanceMatrix.needsUpdate = true;
      };
      cabins.onBeforeRender();
    }
  }

  /* ------------------------------------------- Trick-or-Treat Lane */
  {
    flat(K, M.dirt, 0, 35, 112, 3.2, { y: 0.014 });
    flat(K, M.dirt, 0, 32.6, 4.4, 1.8, { y: 0.013 });
    const sidings = [M.sidingA, M.sidingB, M.sidingC];
    const houses = [[-49.5, -42.5], [-31, -24], [-19.5, -12.5], [12.5, 19.5], [24, 31], [39, 46]];
    houses.forEach(([xa, xb], i) => {
      const mid = (xa + xb) / 2, w = xb - xa, zf = 39.8, zb = 44.6, h = 5.4, sid = sidings[i % 3];
      K.solid(mid, (zf + zb) / 2, w, zb - zf, h, { mat: sid, pen: 8 });
      K.box(M.foundation, mid, 0, (zf + zb) / 2, w + 0.2, 0.5, zb - zf + 0.2);
      gableRoof(K, M.roof, sid, { x0: xa, x1: xb, z0: zf, z1: zb, y: h, rise: 2.4, ridge: M.trimDark });
      for (const dx of [-w * 0.3, w * 0.3]) {
        for (const y of [1.1, 3.6]) {
          const lit = R() < 0.55;
          K.add(lit ? M.winGlow : M.glassDark, place(new THREE.PlaneGeometry(1.0, 1.3), { x: mid + dx, y: y + 0.65, z: zf - 0.01, ry: Math.PI }), { shadow: false });
          K.box(M.trim, mid + dx, y - 0.08, zf - 0.06, 1.25, 0.08, 0.14);
          K.box(M.trim, mid + dx, y + 1.3, zf - 0.04, 1.2, 0.1, 0.08);
          if (lit) SP.add(mid + dx, y + 0.65, zf - 0.4, 0xffb060, { size: 1.2, blink: 0 });
        }
      }
      K.box(M.trimDark, mid, 0.3, zf - 0.03, 1.1, 2.2, 0.06);
      // the porch: deck, posts, a little roof, a lantern
      K.solid(mid, 39.1, 4.2, 1.4, 0.3, { mat: M.stairWood, pen: 4 });
      for (const s of [-1, 1]) K.solid(mid + s * 1.95, 38.55, 0.14, 0.14, 2.3, { y: 0.3, mat: M.trim, pen: 2 });
      K.box(M.roof, mid, 2.55, 39.0, 4.6, 0.12, 1.9, { rx: 0.14 });
      K.box(M.lampGlass, mid + 0.85, 1.9, zf - 0.08, 0.16, 0.26, 0.12, {}, { shadow: false });
      SP.add(mid + 0.85, 2.03, zf - 0.2, 0xffb86a, { size: 0.9, blink: 0.05 });
      jack(K, M, mid - 1.4, 0.3, 38.7, { r: 0.26, face: Math.PI, seed: 5000 + i * 3 });
      jack(K, M, mid + 1.5, 0.3, 38.8, { r: 0.21, face: Math.PI, seed: 5001 + i * 3, glow: false });
      flat(K, M.dirt, mid, 37.7, 1.1, 1.4, { y: 0.013 });
      picketFence(K, M, 36.95, xa - 0.4, xb + 0.4, [[mid - 0.6, mid + 0.6]]);
      // decor, house by house
      if (i % 3 === 0) {
        for (const s of [-1, 1]) {
          const gx = mid + s * 1.1;
          K.add(M.ghost, place(new THREE.ConeGeometry(0.34, 0.95, 10, 1, true), { x: gx, y: 1.85, z: 38.6 }), { shadow: false });
          K.add(M.ghost, place(new THREE.SphereGeometry(0.2, 10, 8), { x: gx, y: 2.25, z: 38.6 }), { shadow: false });
          K.box(M.trimDark, gx, 2.35, 38.6, 0.01, 0.2, 0.01, {}, { shadow: false });
        }
      } else if (i % 3 === 1) {
        for (const [dx, dz] of [[-2.4, 37.8], [-1.6, 38.1], [2.1, 37.7]]) {
          K.add(M.trim, place(headstoneGeo(0.5, 0.65, 0.08), { x: mid + dx, z: dz, ry: (R() - 0.5) * 0.4, rz: (R() - 0.5) * 0.2 }));
        }
      } else {
        const sx = mid + 1.2, sy = h + 1.1, sz = zf + 0.7;
        K.add(M.car, place(new THREE.SphereGeometry(0.6, 12, 8), { x: sx, y: sy, z: sz, sz: 1.3 }));
        K.add(M.car, place(new THREE.SphereGeometry(0.35, 10, 8), { x: sx, y: sy - 0.2, z: sz - 0.8 }));
        for (let k = 0; k < 8; k++) {
          const side = k < 4 ? -1 : 1, j = (k % 4) - 1.5;
          const kx = sx + side * 0.5, kz = sz - 0.3 + j * 0.35;
          const ex = sx + side * 1.6, ez = sz - 0.3 + j * 0.7;
          K.add(M.car, rodGeo([kx, sy, kz], [(kx + ex) / 2, sy + 0.6, (kz + ez) / 2], 0.05, 4));
          K.add(M.car, rodGeo([(kx + ex) / 2, sy + 0.6, (kz + ez) / 2], [ex, sy - 0.9, ez], 0.04, 4));
        }
        for (const s of [-1, 1]) K.add(M.bulb, place(new THREE.SphereGeometry(0.06, 6, 4), { x: sx + s * 0.12, y: sy - 0.15, z: sz - 1.12 }), { color: 0xff2a2a, shadow: false });
      }
    });
    // string lights on the north verge (none over the bridge)
    const verge = [-32, -18, -8, 8, 18, 30, 45];
    for (const x of [-44, ...verge]) pole(K, M, x, 32.7);
    festoon(K, M, SP, verge.map((x) => [x, 4.0, 32.7]), { seed: 17 });
    festoon(K, M, SP, [[-44, 4.0, 32.7], [-46, 2.6, 38.5]], { seed: 23 });
    for (const x of [-48, -25, 36]) gasLamp(K, M, x, 32.7);
    gasLamp(K, M, 11.5, 32.7);

    // the Troll House
    {
      const tx0 = -6, tx1 = 6, tz0 = 39.6, tz1 = 44.7, th = 3.4, t = 0.3;
      const TW = { mat: M.sidingC, trim: M.trim, shutter: M.shutter, t, h: th };
      wall(K, { axis: "x", at: tz0 + t / 2, a: tx0, b: tx1, out: -1, ...TW,
        holes: [{ c: 0, w: 1.4, spans: [[0, 2.4]] }, { c: -3.6, w: 2.0, spans: [[0.9, 2.3]] }, { c: 3.6, w: 2.0, spans: [[0.9, 2.3]] }] });
      wall(K, { axis: "x", at: tz1 - t / 2, a: tx0, b: tx1, out: 1, ...TW });
      wall(K, { axis: "z", at: tx0 + t / 2, a: tz0 + t, b: tz1 - t, out: -1, ...TW, holes: [{ c: 42.2, w: 1.2, spans: [[0.9, 2.2]] }] });
      wall(K, { axis: "z", at: tx1 - t / 2, a: tz0 + t, b: tz1 - t, out: 1, ...TW, holes: [{ c: 42.6, w: 1.1, spans: [[0, 2.3]] }] });
      K.solid(0, (tz0 + tz1) / 2, 12, 5.1, 0.25, { y: th, mat: M.floor, pen: 8 });
      gableRoof(K, M.roof, M.sidingC, { x0: tx0, x1: tx1, z0: tz0, z1: tz1, y: th + 0.25, rise: 2.2, ridge: M.trimDark });
      K.solid(0, (tz0 + tz1) / 2, 12.2, 5.3, 0.35, { mat: M.foundation, pen: 8 });
      K.add(M.floor, place(new THREE.PlaneGeometry(11.4, 4.5), { x: 0, y: 0.36, z: (tz0 + tz1) / 2, rx: -Math.PI / 2 }), { shadow: false });
      // the paintings, in gold frames, each with a little lamp over it
      for (const [x, mat] of [[-3.15, M.posterPaint], [3.15, M.galleryPaint]]) {
        const zf = tz1 - t - 0.03;
        K.add(mat, place(new THREE.PlaneGeometry(2.08, 1.17), { x, y: 1.75, z: zf, ry: Math.PI }), { shadow: false });
        for (const [dx, dy, w, h] of [[0, 0.64, 2.3, 0.11], [0, -0.64, 2.3, 0.11], [-1.1, 0, 0.11, 1.39], [1.1, 0, 0.11, 1.39]]) {
          K.box(M.gold, x + dx, 1.75 + dy - h / 2, zf - 0.03, w, h, 0.06);
        }
        K.box(M.gold, x, 2.48, zf - 0.12, 0.6, 0.05, 0.08);
        K.box(M.lampGlass, x, 2.44, zf - 0.16, 0.5, 0.03, 0.03, {}, { shadow: false });
        SP.add(x, 2.4, zf - 0.2, 0xffe0a0, { size: 0.7, blink: 0 });
      }
      // fireplace, sofa, armchairs, bookcase
      K.solid(0, tz1 - t - 0.3, 1.6, 0.6, 1.2, { y: 0.35, mat: M.brick, pen: 8 });
      K.box(M.stoneDark, 0, 1.55, tz1 - t - 0.35, 1.9, 0.1, 0.75);
      K.box(M.brick, 0, 1.65, tz1 - t - 0.2, 1.1, th - 1.65, 0.4);
      K.box(M.ember, 0, 0.4, tz1 - t - 0.62, 0.9, 0.5, 0.02, {}, { shadow: false });
      K.add(M.glow, place(new THREE.PlaneGeometry(3, 3), { x: 0, y: 0.38, z: tz1 - t - 1.3, rx: -Math.PI / 2 }), { shadow: false, phase: 0.3 });
      for (const k of [-0.6, 0.6]) candle(K, M, k, 1.65, tz1 - t - 0.35, { seed: 5100 + k * 10 });
      K.solid(0, 42.0, 2.4, 0.8, 0.85, { y: 0.35, pen: 1.5 });
      K.box(M.fabric, 0, 0.35, 42.0, 2.4, 0.45, 0.8);
      K.box(M.fabric, 0, 0.8, 41.68, 2.4, 0.5, 0.18);
      for (const s of [-1, 1]) {
        K.solid(s * 3.4, 42.6, 0.85, 0.85, 0.85, { y: 0.35, pen: 1.5 });
        K.box(M.fabricDark, s * 3.4, 0.35, 42.6, 0.85, 0.45, 0.85);
        K.box(M.fabricDark, s * 3.4, 0.8, 42.25, 0.85, 0.5, 0.15);
      }
      K.solid(-5.45, 40.7, 0.5, 1.4, 2.2, { y: 0.35, pen: 3 });
      K.box(M.books, -5.45, 0.35, 40.7, 0.5, 2.2, 1.4);
      K.box(M.fabricDark, 0, 0.36, 42.0, 4, 0.01, 2.6, {}, { shadow: false });
      // out front: the sign, the doormat
      K.add(sign(["THE TROLL HOUSE"], { bg: "#120c10", fg: "#ffffff", edge: "#e0662f" }), place(new THREE.PlaneGeometry(3.2, 0.55), { x: 0, y: 2.85, z: tz0 - 0.02, ry: Math.PI }), { shadow: false });
      K.add(sign(["U MAD?"], { w: 512, h: 256, bg: "#6a4a2c", fg: "#1a120c", edge: "#3a2614" }), place(new THREE.PlaneGeometry(1.2, 0.6), { x: 0, y: 0.02, z: tz0 - 0.55, rx: -Math.PI / 2, rz: Math.PI }), { shadow: false });
      K.solid(0, tz0 - 0.4, 1.8, 0.5, 0.18, { mat: M.stairWood, pen: 4 });
      const l = new THREE.PointLight(0xffb070, 8, 12, 2);
      l.position.set(0, 2.9, 42.2);
      lights.push(l);
    }
    // the Meme Gallery in its front yard
    {
      for (const [x, model] of [[-3.3, "hg-trollbust"], [3.3, "hg-pepe"]]) {
        K.add(M.purpleDisc, place(new THREE.CircleGeometry(1.25, 28), { x, y: 0.015, z: 38.3, rx: -Math.PI / 2 }), { shadow: false });
        K.solid(x, 38.3, 1.1, 0.9, 1.0, { mat: M.plinth, pen: 8 });
        K.add(sign(["MEME GALLERY"], { w: 512, h: 128, bg: "#08080a", fg: "#ff3ad0", edge: "#08080a" }), place(new THREE.PlaneGeometry(0.9, 0.22), { x, y: 0.7, z: 37.84, ry: Math.PI }), { shadow: false });
        mapModel(api, model, { x, z: 38.3, y: 1.0, rot: Math.PI, scale: 0.95 });
        K.api.ghostBox(x, 38.3, 1.0, 0.8, 1.1, { y: 1.0, pen: 4 });
        K.add(M.purpleGlow, place(new THREE.PlaneGeometry(3.4, 3.4), { x, y: 0.03, z: 38.3, rx: -Math.PI / 2 }), { shadow: false, phase: x });
        for (const s of [-1, 1]) SP.add(x + s * 0.55, 0.2, 37.7, 0xc040ff, { size: 1.0, blink: 0.1 });
      }
      picketFence(K, M, 36.95, -6.4, 6.4, [[-0.7, 0.7]]);
      const banner = sign(["MEME GALLERY"], { w: 1024, h: 256, bg: "#050506", fg: "#ff3ad0", edge: "#050506" });
      for (const x of [-3.4, 3.4]) K.add(banner, place(new THREE.PlaneGeometry(2.4, 0.6), { x, y: 0.5, z: 36.9, ry: Math.PI }), { shadow: false });
    }
  }

  /* ------------------------------------------- the creek + the covered bridge */
  {
    const { left, right } = creekBanks();
    const pos = [];
    for (let i = 1; i < CREEK.length; i++) {
      const a = left[i - 1], b = right[i - 1], c = left[i], d = right[i];
      pos.push(a[0], 0.035, a[1], b[0], 0.035, b[1], c[0], 0.035, c[1], b[0], 0.035, b[1], d[0], 0.035, d[1], c[0], 0.035, c[1]);
    }
    const water = new THREE.BufferGeometry();
    water.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    water.computeVertexNormals();
    K.add(M.pond, water, { shadow: false });
    const mud = creekBanks(CREEK_W / 2 + 0.7);
    const mpos = [];
    for (const [inner, outer] of [[left, mud.left], [right, mud.right]]) {
      for (let i = 1; i < CREEK.length; i++) {
        const a = inner[i - 1], b = outer[i - 1], c = inner[i], d = outer[i];
        mpos.push(a[0], 0.02, a[1], b[0], 0.02, b[1], c[0], 0.02, c[1], b[0], 0.02, b[1], d[0], 0.02, d[1], c[0], 0.02, c[1]);
      }
    }
    const mg = new THREE.BufferGeometry();
    mg.setAttribute("position", new THREE.Float32BufferAttribute(mpos, 3));
    mg.computeVertexNormals();
    K.add(M.dirt, mg, { shadow: false });
    // stones and reeds along the banks, kept off the bridge
    for (const bank of [mud.left, mud.right]) {
      for (let i = 1; i < bank.length; i++) {
        const [ax, az] = bank[i - 1], [bx, bz] = bank[i];
        const n = Math.round(Math.hypot(bx - ax, bz - az) / 1.3);
        for (let k = 0; k < n; k++) {
          const x = ax + ((bx - ax) * (k + R())) / n, z = az + ((bz - az) * (k + R())) / n;
          if (x > -42 && x < -33 && z > 32.4 && z < 37.6) continue;
          if (R() < 0.5) K.add(M.stoneDark, place(new THREE.DodecahedronGeometry(0.15 + R() * 0.2), { x, y: 0.06, z, sy: 0.6, ry: R() * 6 }));
          else for (let j = 0; j < 5; j++) K.box(M.stem, x + (R() - 0.5) * 0.4, 0, z + (R() - 0.5) * 0.4, 0.025, 0.6 + R() * 0.6, 0.025, { rz: (R() - 0.5) * 0.3 }, { shadow: false });
        }
      }
    }
    SP.swarm(12, -43, 27, 10, 14, 0.4, 2, 0xd8ff6a, { size: 0.12, wander: 0.9, blink: 1 });

    // the covered bridge: a deck with steps either end, barn-red walls and a roof
    const { x0: bx0, x1: bx1 } = BRIDGE, bz0 = 33.2, bz1 = 36.8, deck = 0.54, bmid = (bx0 + bx1) / 2;
    K.api.ghostBox(bmid, (bz0 + bz1) / 2, bx1 - bx0, bz1 - bz0, deck, { pen: 8 });
    for (const s of [-1, 1]) {
      const edge = s < 0 ? bx0 : bx1;
      K.solid(edge + s * 0.3, (bz0 + bz1) / 2, 0.6, bz1 - bz0 - 0.4, 0.36, { mat: M.stairWood, pen: 6 });
      K.solid(edge + s * 0.9, (bz0 + bz1) / 2, 0.6, bz1 - bz0 - 0.4, 0.18, { mat: M.stairWood, pen: 6 });
    }
    K.box(M.stairWood, bmid, 0.4, (bz0 + bz1) / 2, bx1 - bx0, 0.14, bz1 - bz0);
    K.box(M.iron, bmid, 0, (bz0 + bz1) / 2, bx1 - bx0 - 0.2, 0.4, bz1 - bz0 - 0.8);
    for (const x of [bx0 + 0.3, bmid, bx1 - 0.3]) for (const z of [bz0 + 0.2, bz1 - 0.2]) K.box(M.bark, x, 0, z, 0.25, 0.42, 0.25);
    // something lives under it
    K.add(M.trollLit, place(new THREE.PlaneGeometry(0.36, 0.36), { x: -38.6, y: 0.18, z: bz0 + 0.12, ry: Math.PI }), { shadow: false });
    for (const z of [bz0 + 0.1, bz1 - 0.1]) {
      wall(K, { axis: "x", at: z, a: bx0, b: bx1, y: deck, h: 2.4, t: 0.16, mat: M.barn, trim: M.barnTrim, out: z < 35 ? -1 : 1,
        holes: [{ c: bmid - 1.6, w: 1.0, spans: [[1.0, 1.6]] }, { c: bmid + 1.6, w: 1.0, spans: [[1.0, 1.6]] }] });
    }
    gableRoof(K, M.roof, null, { x0: bx0 - 0.2, x1: bx1 + 0.2, z0: bz0, z1: bz1, y: deck + 2.4, rise: 1.3, ridge: M.trimDark });
    for (const x of [bx0 + 0.05, bx1 - 0.05]) {
      K.add(M.barn, place(prismGeo([[-(bz1 - bz0) / 2 - 0.1, 0], [(bz1 - bz0) / 2 + 0.1, 0], [0, 1.3]], 0.1), { x, y: deck + 2.4, z: (bz0 + bz1) / 2, ry: Math.PI / 2 }));
      K.box(M.barn, x, deck + 2.15, (bz0 + bz1) / 2, 0.1, 0.25, bz1 - bz0);
    }
    const bridgeSign = sign(["TROLL BRIDGE"], { bg: "#2a120c", fg: "#ffd27a", edge: "#cfc6b4" });
    for (const [x, ry] of [[bx0 - 0.02, -Math.PI / 2], [bx1 + 0.02, Math.PI / 2]]) {
      K.add(bridgeSign, place(new THREE.PlaneGeometry(2.4, 0.5), { x, y: deck + 2.85, z: (bz0 + bz1) / 2, ry }), { shadow: false });
    }
    K.solid(-42.2, 32.6, 0.15, 0.15, 1.6, { mat: M.stairWood, pen: 2 });
    K.add(sign(["TOLL: 1 LULZ"], { w: 512, h: 160, bg: "#3a2416", fg: "#f0e6d6", edge: "#1a120c" }), place(new THREE.PlaneGeometry(0.9, 0.3), { x: -42.2, y: 1.45, z: 32.5, ry: Math.PI }), { shadow: false });
  }

  /* ------------------------------------------- halos, fireflies, wisps, mist */
  for (const lx of [-1.6, 1.6]) SP.add(lx, 2.3, MANOR.z1 + 0.2, 0xffb86a, { size: 1.2, blink: 0.05 });
  SP.swarm(16, -24, -19, 12, 12, 0.4, 2.2, 0xd8ff6a, { size: 0.12, wander: 0.9, blink: 1 });
  SP.swarm(16, 26.5, -3, 10, 12, 0.6, 2.6, 0xd8ff6a, { size: 0.12, wander: 0.9, blink: 1 });
  SP.swarm(18, -26, 7, 18, 24, 0.5, 2.5, 0x7affd0, { size: 0.3, wander: 1.6, blink: 0.4 });
  {
    const pos = [], uv = [], uv1 = [];
    for (const [x, z, w, d] of [[-25.8, 7, 20, 27], [25, 4, 22, 25], [POND.x, POND.z, 15, 13], [-42, -36, 17, 15], [-42.5, 27, 14, 18], [-44, 12.2, 12, 7]]) {
      for (const [y, sc] of [[0.45, 0.1]]) {
        const c = [[0, 0], [0, 1], [1, 1], [0, 0], [1, 1], [1, 0]];   // wound to face up
        for (const [i, j] of c) {
          const px = x - w / 2 + i * w, pz = z - d / 2 + j * d;
          pos.push(px, y, pz);
          uv.push(px * sc + y * 3, pz * sc);
          uv1.push(i, j);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute("uv1", new THREE.Float32BufferAttribute(uv1, 2));
    const map = mistTexture().clone();
    map.needsUpdate = true;
    const fade = fadeTexture();
    fade.channel = 1;
    const mat = new THREE.MeshBasicMaterial({ map, alphaMap: fade, color: 0x9a8cc0, transparent: true, opacity: 0.75, depthWrite: false });
    const mist = new THREE.Mesh(g, mat);
    mist.renderOrder = 1;
    mist.onBeforeRender = () => {
      const t = performance.now() / 1000;
      map.offset.set(t * 0.012, t * 0.006);
    };
    root.add(mist);
  }
}

/* ===================================================================== map */

function buildHollowgrin(api) {
  ZSPAWNS.length = 0;
  const root = new THREE.Group();
  api.prop(root);
  root.castShadow = false;
  const K = new Kit(api, root);
  const lights = [];
  const SP = new Sparks();
  K.sparks = SP;

  /* ---------------------------------------------------------- materials */
  const M = {
    siding: surfMat("wood", 0x4a4452, { mix: 0.2, tile: 1.6 }),
    sidingInner: surfMat("wood", 0x6c5240, { mix: 0.35, tile: 1.6, bounce: 0.2 }),
    floor: surfMat("wood", 0x7a5a3c, { mix: 0.4, tile: 1.2, bounce: 0.22 }),
    stairWood: surfMat("wood", 0x6a4a30, { mix: 0.35, tile: 1, bounce: 0.18 }),
    foundation: surfMat("rock", 0x6a6670, { mix: 0.35, tile: 1.4 }),
    stone: surfMat("rock", 0x7c7a80, { mix: 0.45, tile: 1.1 }),
    stoneDark: surfMat("rock", 0x55545c, { mix: 0.35, tile: 1.1 }),
    brick: surfMat("brick", 0x6a3a30, { mix: 0.35, tile: 1.2 }),
    roof: texMat(shingleTexture(), { color: 0x9a9cb0, tile: 1.3, rough: 0.8 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x8c8478, roughness: 0.8 }),
    trimDark: new THREE.MeshStandardMaterial({ color: 0x2b2420, roughness: 0.7 }),
    shutter: new THREE.MeshStandardMaterial({ color: 0x1f2a24, roughness: 0.85 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x1b1b21, roughness: 0.55, metalness: 0.35 }),
    bark: surfMat("wood", 0x2e2620, { mix: 0.12, tile: 0.8 }),
    dirt: surfMat("dirt", 0x4a3a2c, { mix: 0.08, tile: 2.5 }),
    hay: texMat(hayTexture(), { color: 0xd8c08a, rough: 1 }),
    pumpkin: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, color: 0xffffff }),
    stem: new THREE.MeshStandardMaterial({ color: 0x4a4a22, roughness: 0.9 }),
    leaf: texMat(leavesTexture(), { alphaTest: 0.5, side: THREE.DoubleSide, rough: 1 }),
    corn: texMat(cornTexture(), { alphaTest: 0.45, side: THREE.DoubleSide, rough: 1, color: 0xc9b98f }),
    carve: flickerMat({ map: carveTexture(), color: new THREE.Color(0xffb24a).multiplyScalar(2.2), alphaTest: 0.5, strength: 1 }),
    glow: flickerMat({ map: glowTexture(), color: new THREE.Color(0xff7a1a).multiplyScalar(0.55), additive: true, strength: 1.2 }),
    flame: flickerMat({ map: flameTexture(), color: new THREE.Color(0xffc070).multiplyScalar(2.0), additive: true, strength: 1.4, speed: 1.6 }),
    greenGlow: flickerMat({ map: glowTexture(), color: new THREE.Color(0x3dff7a).multiplyScalar(0.45), additive: true, strength: 0.6 }),
    wax: new THREE.MeshStandardMaterial({ color: 0xe9e0c8, roughness: 0.6, emissive: 0x3a2a10 }),
    winGlow: new THREE.MeshBasicMaterial({ map: windowGlowTexture(), color: new THREE.Color(0xffffff).multiplyScalar(1.5) }),
    lampGlass: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc27a).multiplyScalar(2.4) }),
    ember: flickerMat({ color: new THREE.Color(0xff5a14).multiplyScalar(1.8), strength: 0.8, speed: 0.5 }),
    epitaph: texMat(epitaphTexture(), { alphaTest: 0.3, rough: 1, color: 0xffffff }),
    books: texMat(booksTexture(), { tile: 1.4, rough: 0.9 }),
    fabric: new THREE.MeshStandardMaterial({ color: 0x5a2446, roughness: 0.95, emissive: 0x1c0a16 }),
    fabricDark: new THREE.MeshStandardMaterial({ color: 0x3a1c32, roughness: 0.95, emissive: 0x12060e }),
    burlap: new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 1, side: THREE.DoubleSide }),
    awningOrange: texMat(stripesTexture(), { rough: 0.9, side: THREE.DoubleSide }),
    awningPurple: texMat(stripesTexture("#6d3a9c", "#e8d8f0"), { rough: 0.9, side: THREE.DoubleSide }),
    barn: surfMat("wood", 0x7a2a22, { mix: 0.25, tile: 1.8 }),
    barnTrim: new THREE.MeshStandardMaterial({ color: 0xcfc6b4, roughness: 0.85 }),
    shop: surfMat("plaster", 0x5b3a6e, { mix: 0.35, tile: 2 }),
    shopTrim: new THREE.MeshStandardMaterial({ color: 0xe0762a, roughness: 0.7 }),
    hedge: surfMat("grass", 0x1f3a1c, { mix: 0.15, tile: 1.2 }),
    water: new THREE.MeshStandardMaterial({ color: 0x0a1a1c, roughness: 0.15, metalness: 0.4 }),
    car: new THREE.MeshStandardMaterial({ color: 0x0d0d10, roughness: 0.35, metalness: 0.3 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.3, metalness: 0.6 }),
    glassDark: new THREE.MeshStandardMaterial({ color: 0x141a24, roughness: 0.1, metalness: 0.3 }),
    candy: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, emissive: 0x220a18 }),
    moss: surfMat("grass", 0x2c3a24, { mix: 0.2, tile: 1 }),
    // the outskirts
    glass: new THREE.MeshBasicMaterial({ color: 0x5a7a86, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }),
    pond: new THREE.MeshStandardMaterial({ color: 0x06121a, roughness: 0.08, metalness: 0.5, side: THREE.DoubleSide }),
    bulb: new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(0xffffff).multiplyScalar(1.6) }),
    rose: new THREE.MeshBasicMaterial({ map: roseTexture(), color: new THREE.Color(0xffffff).multiplyScalar(1.25) }),
    trollLit: new THREE.MeshBasicMaterial({ map: trollTexture(), alphaTest: 0.5, side: THREE.DoubleSide, color: 0xd8d8d0 }),
    purpleGlow: flickerMat({ map: glowTexture(), color: new THREE.Color(0xa040ff).multiplyScalar(0.5), additive: true, strength: 0.7 }),
    brew: flickerMat({ color: new THREE.Color(0x5aff6a).multiplyScalar(1.4), strength: 0.8, speed: 0.4 }),
    horse: new THREE.MeshStandardMaterial({ color: 0xf0e6d6, roughness: 0.4, emissive: 0x2a2018 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd8b050, roughness: 0.3, metalness: 0.6, emissive: 0x2a1c06 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xc8ccd6, roughness: 0.45, metalness: 0.3 }),
    pumpkinSolid: new THREE.MeshStandardMaterial({ color: 0xe07423, roughness: 0.5, emissive: 0x2a0e02 }),
    awningRed: texMat(stripesTexture("#b8242c", "#f0e6d6"), { rough: 0.9, side: THREE.DoubleSide }),
    purpleDisc: new THREE.MeshStandardMaterial({ color: 0x6a2aa8, roughness: 0.6, emissive: 0x3a0f6a }),
    plinth: new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.35 }),
    posterPaint: paintMat("ui/easter/poster-dark-planetoid.jpg"),
    galleryPaint: paintMat("ui/easter/meme-gallery.jpg"),
    sidingA: surfMat("wood", 0x3c4a5a, { mix: 0.25, tile: 1.6 }),
    sidingB: surfMat("wood", 0x5a4a3a, { mix: 0.25, tile: 1.6 }),
    sidingC: surfMat("wood", 0x4a3a52, { mix: 0.25, tile: 1.6 }),
    witchWood: surfMat("wood", 0x3a3026, { mix: 0.15, tile: 1.2 }),
    thatch: texMat(hayTexture(), { color: 0x8a7a50, tile: 1.2, rough: 1, side: THREE.DoubleSide }),
    toadCap: new THREE.MeshStandardMaterial({ color: 0xc0283a, roughness: 0.5, emissive: 0x3a0610 }),
    picket: new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.8 }),
    ghost: new THREE.MeshStandardMaterial({ color: 0xeeeef4, roughness: 0.9, emissive: 0x3a3a48, side: THREE.DoubleSide }),
    lily: new THREE.MeshStandardMaterial({ color: 0x2f5a2a, roughness: 0.6, side: THREE.DoubleSide }),
  };

  /* --------------------------------------------------------- the ground */
  // Dirt paths and the square laid over the grass, a hair above it.
  const dirtPlane = (x, z, w, d, ry = 0) => {
    const g = new THREE.PlaneGeometry(w, d);
    K.add(M.dirt, place(g, { x, y: 0.012, z, rx: -Math.PI / 2, ry }), { shadow: false });
  };
  {
    const sq = new THREE.CircleGeometry(12.5, 40);
    K.add(M.dirt, place(sq, { x: 0, y: 0.01, z: 1, rx: -Math.PI / 2 }), { shadow: false });
  }
  dirtPlane(0, 22, 4.4, 20);           // south road
  dirtPlane(0, -10, 3.6, 3.2);         // up to the porch
  dirtPlane(-14.5, 2, 5, 3.2);         // west road to the graveyard gate
  dirtPlane(15.5, 2, 9, 3.4);          // east road to the patch
  dirtPlane(-24, 7, 1.8, 26);          // graveyard aisle
  dirtPlane(-25, 2, 18, 2.6);          // graveyard lane
  dirtPlane(-24, -19, 2.4, 12);        // garden paths
  dirtPlane(-24, -19, 12, 2.4);

  /* ------------------------------------------------------- boundary */
  api.ghostWalls(0, 0, BOUNDS.maxX - BOUNDS.minX + 2.8, BOUNDS.maxZ - BOUNDS.minZ + 2.8, 8, 1.4);
  // A crumbling field-stone wall just outside the line, then the woods.
  {
    const R = rng(4);
    // gaps where the lane runs out east and west and the creek in and out
    const lane = [LANE.z0 - 0.4, LANE.z1 + 0.4];
    const run = (axis, at, a, b, gaps = []) => {
      let s = a;
      while (s < b) {
        const len = Math.min(b - s, 2 + R() * 3.5);
        const open = gaps.some(([g0, g1]) => s < g1 && s + len > g0);
        if (R() > 0.12 && !open) {
          const h = 0.7 + R() * 0.6;
          const c = s + len / 2;
          const x = axis === "x" ? c : at, z = axis === "x" ? at : c;
          K.box(M.stoneDark, x, 0, z, axis === "x" ? len : 0.7, h, axis === "x" ? 0.7 : len, { ry: (R() - 0.5) * 0.04 });
        }
        s += len + 0.05;
      }
    };
    run("x", BOUNDS.minZ - 0.6, BOUNDS.minX - 1, BOUNDS.maxX + 1);
    run("x", BOUNDS.maxZ + 0.6, BOUNDS.minX - 1, BOUNDS.maxX + 1, [[-38.9, -33.6]]);
    run("z", BOUNDS.minX - 0.6, BOUNDS.minZ, BOUNDS.maxZ, [lane, [16.5, 23.5]]);
    run("z", BOUNDS.maxX + 0.6, BOUNDS.minZ, BOUNDS.maxZ, [lane]);

    // The woods: four tree shapes, instanced round the outside.
    const variants = [11, 23, 37, 51].map((s, i) => treeGeo(s, { height: 7 + i, r: 0.28 + i * 0.03, levels: 3 }));
    for (const v of variants) metreUVs(v, M.bark.userData.tile);
    const spots = [];
    const T = rng(99);
    for (let i = 0; i < 150; i++) {
      // walk the perimeter, pushed out 1.5-13 m
      const t = T() * 4;
      const out = 1.6 + Math.pow(T(), 0.7) * 12;
      let x, z;
      if (t < 1) { x = THREE.MathUtils.lerp(BOUNDS.minX - 10, BOUNDS.maxX + 10, t); z = BOUNDS.minZ - out; }
      else if (t < 2) { x = THREE.MathUtils.lerp(BOUNDS.minX - 10, BOUNDS.maxX + 10, t - 1); z = BOUNDS.maxZ + out; }
      else if (t < 3) { z = THREE.MathUtils.lerp(BOUNDS.minZ, BOUNDS.maxZ, t - 2); x = BOUNDS.minX - out; }
      else { z = THREE.MathUtils.lerp(BOUNDS.minZ, BOUNDS.maxZ, t - 3); x = BOUNDS.maxX + out; }
      const keep = [T() * 6.28, 0.85 + T() * 0.5, Math.floor(T() * 4)];
      // clear the Ferris wheel's field, the lane's ends and the creek's bed
      if (x > BOUNDS.maxX && Math.abs(z - FERRIS.z) < FERRIS.r + 4) continue;
      if (Math.abs(x) > BOUNDS.maxX && z > LANE.z0 - 1.5 && z < LANE.z1 + 1.5) continue;
      if (creekDist(x, z) < CREEK_W) continue;
      spots.push([x, z, ...keep]);
    }
    variants.forEach((geo, vi) => {
      const mine = spots.filter((s) => s[4] === vi);
      const inst = new THREE.InstancedMesh(geo, M.bark, mine.length);
      mine.forEach(([x, z, ry, sc], i) => {
        _e.set(0, ry, 0);
        _q.setFromEuler(_e);
        _m4.compose(_p.set(x, 0, z), _q, _s.set(sc, sc * (0.9 + (i % 3) * 0.1), sc));
        inst.setMatrixAt(i, _m4);
      });
      inst.castShadow = false;   // outside the bounds: their shadows cost more than they show
      inst.receiveShadow = true;
      root.add(inst);
    });
  }

  /* ------------------------------------------------ Grinmoor Manor */
  const { x0, x1, z0, z1 } = MANOR;
  const midX = (x0 + x1) / 2, midZ = (z0 + z1) / 2;
  const W = { mat: M.siding, trim: M.trim, shutter: M.shutter };
  // south face: front door + balcony door stacked, windows either side
  wall(K, {
    axis: "x", at: z1 - WALL_T / 2, a: x0, b: x1, h: WALL_H, out: 1, ...W,
    holes: [
      { c: 0, w: 2.2, spans: [[0, 2.7], [UP, UP + 2.4]] },
      { c: -3.6, w: 1.4, spans: [[1.0, 2.5]] },
      { c: 3.6, w: 1.4, spans: [[1.0, 2.5]] },
      { c: -9.5, w: 1.6, spans: [[1.0, 2.5], [4.5, 5.9]] },
      { c: 9.5, w: 1.6, spans: [[1.0, 2.5], [4.5, 5.9]] },
    ],
  });
  // north face: two back doors, windows over them and between
  wall(K, {
    axis: "x", at: z0 + WALL_T / 2, a: x0, b: x1, h: WALL_H, out: -1, ...W,
    holes: [
      { c: -8, w: 1.8, spans: [[0, 2.4], [4.5, 5.9]] },
      { c: 8, w: 1.8, spans: [[0, 2.4], [4.5, 5.9]] },
      { c: -3, w: 1.4, spans: [[1.0, 2.5], [4.5, 5.9]] },
      { c: 3, w: 1.4, spans: [[1.0, 2.5], [4.5, 5.9]] },
    ],
  });
  // west and east faces: side doors, windows
  for (const side of [-1, 1]) {
    wall(K, {
      axis: "z", at: side < 0 ? x0 + WALL_T / 2 : x1 - WALL_T / 2, a: z0 + WALL_T, b: z1 - WALL_T, h: WALL_H, out: side, ...W,
      holes: [
        { c: -20, w: 2.0, spans: [[0, 2.5], [4.5, 5.9]] },
        { c: -15.5, w: 1.4, spans: [[1.0, 2.5], [4.5, 5.9]] },
        ...(side > 0 ? [{ c: -23.4, w: 1.2, spans: [[1.0, 2.4]] }] : []),
      ],
    });
  }
  // stone foundation band and corner boards
  for (const [x, z, w, d] of [[midX, z1 - 0.2, 26.3, 0.5], [midX, z0 + 0.2, 26.3, 0.5], [x0 + 0.2, midZ, 0.5, 16.3], [x1 - 0.2, midZ, 0.5, 16.3]]) {
    K.box(M.foundation, x, 0, z, w, 0.55, d);
  }
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) K.box(M.trim, x, 0, z, 0.5, WALL_H, 0.5);
  // band course between the storeys
  K.box(M.trim, midX, SLAB_Y, z1 + 0.02, 26.4, 0.18, 0.12);
  K.box(M.trim, midX, SLAB_Y, z0 - 0.02, 26.4, 0.18, 0.12);
  K.box(M.trim, x0 - 0.02, SLAB_Y, midZ, 0.12, 0.18, 16.4);
  K.box(M.trim, x1 + 0.02, SLAB_Y, midZ, 0.12, 0.18, 16.4);

  // interior partitions, both floors: parlour | foyer | dining, and above,
  // bedroom | gallery | library
  for (const px of [-5, 5]) {
    wall(K, { axis: "z", at: px, a: z0 + WALL_T, b: z1 - WALL_T, h: SLAB_Y, t: 0.25, mat: M.sidingInner, trim: M.trimDark,
      holes: [{ c: -16.5, w: 1.8, spans: [[0, 2.4]] }, { c: -24.5, w: 1.8, spans: [[0, 2.4]] }] });
    wall(K, { axis: "z", at: px, a: z0 + WALL_T, b: z1 - WALL_T, y: UP, h: CEIL - UP, t: 0.25, mat: M.sidingInner, trim: M.trimDark,
      holes: [{ c: -16.5, w: 1.8, spans: [[0, 2.3]] }, { c: -24.5, w: 1.8, spans: [[0, 2.3]] }] });
  }
  // ground-floor boards (visual; the world ground is the floor)
  K.add(M.floor, place(new THREE.PlaneGeometry(25.2, 15.2), { x: midX, y: 0.02, z: midZ, rx: -Math.PI / 2 }), { shadow: false });
  // upstairs floor with the stairwell cut out of it, and the ceiling
  slabWithHole(K, { x0: x0 + WALL_T, x1: x1 - WALL_T, z0: z0 + WALL_T, z1: z1 - WALL_T, y: SLAB_Y, h: UP - SLAB_Y, hole: HOLE, mat: M.floor });
  K.solid(midX, midZ, 25.2, 15.2, 0.3, { y: CEIL, mat: M.floor, pen: 10 });

  // the grand stair: solid steps, a carpet runner, banisters
  for (let i = 0; i < STAIR.steps; i++) {
    const zc = STAIR.z - STAIR.run * (i + 0.5);
    const h = STAIR.rise * (i + 1);
    K.solid(STAIR.x, zc, STAIR.width, STAIR.run, h, { mat: M.stairWood, pen: 8 });
    K.box(M.fabric, STAIR.x, h, zc, 1.6, 0.012, STAIR.run + 0.01, {}, { shadow: false });
  }
  {
    const len = Math.hypot(STAIR.steps * STAIR.run, STAIR.steps * STAIR.rise);
    const ang = Math.atan2(STAIR.rise, STAIR.run);
    const zc = STAIR.z - (STAIR.steps * STAIR.run) / 2;
    for (const side of [-1, 1]) {
      const x = STAIR.x + side * (STAIR.width / 2 - 0.05);
      K.box(M.trimDark, x, (STAIR.steps * STAIR.rise) / 2 + 0.55, zc, 0.08, 0.08, len, { rx: ang });
      for (let i = 0; i < STAIR.steps; i += 2) {
        K.box(M.trimDark, x, STAIR.rise * (i + 1), STAIR.z - STAIR.run * (i + 0.5), 0.05, 0.9, 0.05);
      }
      K.box(M.trimDark, x, 0, STAIR.z - 0.15, 0.2, 1.25, 0.2);     // newel post
    }
  }
  // upstairs: rails round the stairwell, open at the top of the stair
  railing(K, M, { axis: "z", at: HOLE.x0 - 0.05, a: HOLE.z0, b: HOLE.z1, y: UP });
  railing(K, M, { axis: "z", at: HOLE.x1 + 0.05, a: HOLE.z0, b: HOLE.z1, y: UP });
  railing(K, M, { axis: "x", at: HOLE.z1 + 0.05, a: HOLE.x0 - 0.1, b: HOLE.x1 + 0.1, y: UP });

  // porch deck, balcony over it, columns, balcony rails
  K.solid(0, -10.2, 10.8, 3.6, 0.25, { mat: M.stairWood, pen: 6 });
  K.solid(0, -10.2, 10.8, 3.6, UP - SLAB_Y, { y: SLAB_Y, mat: M.floor, pen: 6 });
  K.box(M.trim, 0, SLAB_Y - 0.12, -8.42, 10.9, 0.16, 0.16);
  for (const cx of [-4.8, 4.8]) {
    K.solid(cx, -8.8, 0.36, 0.36, SLAB_Y - 0.25, { y: 0.25, pen: 6 });
    K.cyl(M.trim, cx, 0.25, -8.8, 0.2, 0.16, SLAB_Y - 0.25, 10);
  }
  railing(K, M, { axis: "x", at: -8.45, a: -5.4, b: 5.4, y: UP });
  railing(K, M, { axis: "z", at: -5.35, a: -12.0, b: -8.4, y: UP });
  railing(K, M, { axis: "z", at: 5.35, a: -12.0, b: -8.4, y: UP });

  // roof: main gable along x, a cross gable over the entrance
  {
    const eave = WALL_H, rise = 4, half = (z1 - z0) / 2 + 0.5;
    const len = Math.hypot(half, rise), ang = Math.atan2(rise, half);
    K.box(M.roof, midX, eave + rise / 2 - 0.12, z0 - 0.5 + half / 2, x1 - x0 + 1.2, 0.24, len, { rx: -ang });
    K.box(M.roof, midX, eave + rise / 2 - 0.12, z1 + 0.5 - half / 2, x1 - x0 + 1.2, 0.24, len, { rx: ang });
    K.box(M.trimDark, midX, eave + rise - 0.05, midZ, x1 - x0 + 1.3, 0.22, 0.3);
    for (const gx of [x0 + 0.2, x1 - 0.2]) {
      const tri = prismGeo([[-(z1 - z0) / 2, 0], [(z1 - z0) / 2, 0], [0, rise]], 0.4);
      K.add(M.siding, place(tri, { x: gx, y: eave, z: midZ, ry: Math.PI / 2 }));
    }
    // the cross gable
    const cw = 5.6, crise = 3;
    const clen = Math.hypot(cw, crise), cang = Math.atan2(crise, cw);
    const cz0 = -20, cz1 = z1 + 0.5;
    for (const side of [-1, 1]) {
      K.box(M.roof, side * cw / 2, eave + crise / 2 - 0.12, (cz0 + cz1) / 2, clen, 0.24, cz1 - cz0, { rz: -side * cang });
    }
    const ctri = prismGeo([[-cw + 0.3, 0], [cw - 0.3, 0], [0, crise - 0.15]], 0.4);
    K.add(M.siding, place(ctri, { x: 0, y: eave, z: z1 - 0.2 }));
    // round attic window, lit
    K.add(M.winGlow, place(new THREE.CircleGeometry(0.55, 20), { x: 0, y: eave + 1.2, z: z1 + 0.02 }), { shadow: false });
    K.add(M.trim, place(new THREE.TorusGeometry(0.58, 0.07, 6, 20), { x: 0, y: eave + 1.2, z: z1 + 0.03 }));
    // chimneys
    K.solid(x0 - 0.45, -25, 0.9, 2, 12.4, { mat: M.brick, pen: 10 });
    K.box(M.brick, x0 - 0.45, 12.4, -25, 1.1, 0.25, 2.2);
    K.box(M.brick, 6, eave + 2.2, -20, 1.2, 3.6, 1.2);
    K.box(M.stoneDark, 6, eave + 5.8, -20, 1.4, 0.25, 1.4);
  }

  // the turret, NE corner: the silhouette against the moon
  {
    const tx = 12.5, tz = -27.5, tr = 2.4, th = 11;
    // a round tower as two crossed boxes: close to the curve, even where
    // it bulges into the corner rooms
    K.api.ghostBox(tx, tz, tr * 2, tr * 1.2, th, { pen: 10 });
    K.api.ghostBox(tx, tz, tr * 1.2, tr * 2, th, { pen: 10 });
    K.cyl(M.siding, tx, 0, tz, tr, tr, th, 20);
    K.cyl(M.foundation, tx, 0, tz, tr + 0.08, tr + 0.08, 0.55, 20);
    K.cyl(M.trim, tx, th - 0.2, tz, tr + 0.2, tr + 0.2, 0.25, 20);
    K.add(M.roof, place(new THREE.ConeGeometry(tr + 0.6, 5.5, 20, 1, true), { x: tx, y: th + 2.75, z: tz }));
    K.cyl(M.iron, tx, th + 5.4, tz, 0.05, 0.02, 1.4, 6);
    // lit windows round it (the ones facing town)
    for (const [a, y] of [[0.5, 4.6], [1.6, 4.6], [1.05, 8.2], [2.4, 8.2]]) {
      const wx = tx + Math.sin(a) * (tr + 0.02), wz = tz + Math.cos(a) * (tr + 0.02);
      K.add(M.winGlow, place(new THREE.PlaneGeometry(0.7, 1.2), { x: wx, y, z: wz, ry: a }), { shadow: false });
      K.box(M.trim, wx, y - 0.68, wz, 0.9, 0.1, 0.18, { ry: a });
    }
  }

  // --- inside the manor
  {
    // chandelier hanging through the stairwell
    const cy = 4.9, cz = -17.8;
    K.cyl(M.iron, 0, cy + 0.2, cz, 0.012, 0.012, CEIL - cy - 0.2, 4);
    K.add(M.iron, place(new THREE.TorusGeometry(0.75, 0.035, 6, 24), { x: 0, y: cy, z: cz, rx: Math.PI / 2 }));
    K.add(M.iron, place(new THREE.TorusGeometry(0.4, 0.03, 6, 18), { x: 0, y: cy + 0.35, z: cz, rx: Math.PI / 2 }));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      candle(K, M, Math.cos(a) * 0.75, cy + 0.02, cz + Math.sin(a) * 0.75, { seed: 40 + i });
    }
    const l = new THREE.PointLight(0xffb070, 16, 20, 2);
    l.position.set(0, cy - 0.3, cz);
    lights.push(l);

    // parlour: fireplace on the west wall, sofa, armchair, rug
    const fx = x0 + WALL_T + 0.35, fz = -25;
    K.solid(fx, fz, 0.7, 2.4, 1.5, { mat: M.brick, pen: 8 });
    K.box(M.stoneDark, fx + 0.05, 1.5, fz, 0.9, 0.14, 2.7);
    K.box(M.brick, fx - 0.05, 1.64, fz, 0.6, SLAB_Y - 1.64, 1.8);
    K.box(M.ember, fx + 0.36, 0.1, fz, 0.02, 0.6, 1.3, {}, { shadow: false });
    const fl = new THREE.PointLight(0xff6a1f, 5, 9, 2);
    fl.position.set(fx + 1.0, 0.8, fz);
    fl.userData.flicker = 1;
    lights.push(fl);
    K.solid(-8.6, -21.2, 2.4, 0.9, 0.85, { pen: 1.5 });
    K.box(M.fabric, -8.6, 0, -21.2, 2.4, 0.5, 0.9);
    K.box(M.fabric, -8.6, 0.5, -20.85, 2.4, 0.5, 0.2);
    K.box(M.fabricDark, -8.6, -0.001, -23.2, 3.2, 0.02, 2.2, {}, { shadow: false });
    K.solid(-11.2, -18, 0.9, 0.9, 0.9, { pen: 1.5 });
    K.box(M.fabricDark, -11.2, 0, -18, 0.9, 0.5, 0.9);
    K.box(M.fabricDark, -11.55, 0.5, -18, 0.2, 0.55, 0.9);
    portrait(api, { x: -5.2, y: 2.0, z: -21, facing: "w", hue: 280 });

    // foyer: grandfather clock, a side table with a candelabra
    K.solid(-3.8, -27.1, 0.6, 0.45, 2.3, { mat: M.stairWood, pen: 3 });
    K.add(M.trim, place(new THREE.CircleGeometry(0.2, 16), { x: -3.8, y: 1.9, z: -26.86 }), { shadow: false });
    K.solid(3.6, -26.9, 1.4, 0.6, 0.85, { mat: M.stairWood, pen: 1.5 });
    for (const dx of [-0.2, 0, 0.2]) candle(K, M, 3.6 + dx, 0.85, -26.9, { seed: 60 + dx * 10 });
    portrait(api, { x: 0, y: 2.1, z: z0 + WALL_T + 0.05, facing: "s", hue: 20 });

    // dining: the long table, chairs, candelabras
    K.solid(9, -20, 1.4, 5.2, 0.82, { mat: M.stairWood, pen: 1.6 });
    for (let i = -2; i <= 2; i++) {
      for (const sx of [-1, 1]) {
        const cx = 9 + sx * 1.1, cz = -20 + i * 1.0;
        K.box(M.trimDark, cx, 0, cz, 0.45, 0.48, 0.45);
        K.box(M.trimDark, cx + sx * 0.2, 0.48, cz, 0.06, 0.6, 0.45);
      }
    }
    for (const cz of [-21.6, -18.4]) {
      K.cyl(M.iron, 9, 0.82, cz, 0.08, 0.03, 0.3, 6);
      for (const dx of [-0.18, 0, 0.18]) candle(K, M, 9 + dx, 1.12, cz, { seed: 70 + cz + dx * 10 });
    }
    portrait(api, { x: 12.35, y: 2.0, z: -17.9, facing: "w", hue: 120 });

    // upstairs west: the bedroom
    K.solid(-9.2, -24.6, 2.0, 2.4, 0.6, { mat: M.stairWood, y: UP, pen: 1.5 });
    K.box(M.fabric, -9.2, UP + 0.6, -24.4, 1.9, 0.14, 2.1);
    K.box(M.stairWood, -9.2, UP, -25.9, 2.1, 1.5, 0.12);
    K.solid(-11.9, -22.4, 0.8, 1.6, 2.3, { mat: M.stairWood, y: UP, pen: 4 });
    // a coffin on trestles, lid off, where the gallery meets the bedroom
    K.solid(-3.2, -25.6, 0.9, 2.2, 0.8, { y: UP, pen: 2 });
    K.add(M.trimDark, place(prismGeo([[-0.35, -1.1], [0.35, -1.1], [0.45, 0.45], [0, 1.1], [-0.45, 0.45]], 0.5), { x: -3.2, y: UP + 0.55, z: -25.6, rx: Math.PI / 2 }));
    K.box(M.fabric, -3.2, UP + 0.79, -25.6, 0.7, 0.02, 1.9, {}, { shadow: false });
    K.box(M.trimDark, -4.2, UP, -25.2, 0.08, 1.9, 0.9, { rz: 0.25 });

    // upstairs east: the library
    for (const [bx, bz, w, d] of [[5.4, -20.6, 0.5, 4.4], [12.25, -22.5, 0.5, 2.4]]) {
      K.solid(bx, bz, w, d, 2.6, { y: UP, pen: 3 });
      K.box(M.books, bx, UP, bz, w, 2.6, d);
    }
    K.solid(8.8, -20.6, 1.8, 0.9, 0.8, { mat: M.stairWood, y: UP, pen: 1.5 });
    candle(K, M, 8.4, UP + 0.8, -20.6, { seed: 91 });
    K.box(M.fabricDark, 8.8, UP, -22.2, 0.7, 0.5, 0.7);
  }

  // porch dressing: lanterns by the door, pumpkins on the deck and steps
  {
    for (const lx of [-1.6, 1.6]) {
      K.box(M.iron, lx, 2.1, z1 + 0.08, 0.26, 0.42, 0.26);
      K.box(M.lampGlass, lx, 2.14, z1 + 0.08, 0.2, 0.32, 0.2, {}, { shadow: false });
    }
    const pl = new THREE.PointLight(0xffa860, 8, 12, 2);
    pl.position.set(0, 2.8, -10.4);
    lights.push(pl);
    let s = 1;
    for (const [x, z, r] of [[-2.1, -9.0, 0.3], [2.3, -9.1, 0.34], [-3.6, -11.2, 0.26], [3.9, -11.3, 0.28], [-4.4, -8.9, 0.22]]) {
      jack(K, M, x, 0.25, z, { r, face: 0, seed: s++ });
    }
    for (const [x, z, r] of [[-4.6, -9.1, 0.26], [4.7, -9.2, 0.22], [-2.8, -11.8, 0.24]]) {
      jack(K, M, x, UP, z, { r, face: 0, seed: s++, glow: false });
    }
  }

  // manor zombie windows (upstairs), and the stair they come up by
  for (const [x, z] of [[-11.3, -15.5], [-11.3, -20], [11.3, -15.5], [11.3, -20], [3, -26.4], [-7.4, -26.5], [8, -26.4]]) {
    ZSPAWNS.push({ x, y: UP, z });
  }

  /* ------------------------------------------------ the square */
  {
    // the dead oak
    K.solid(0, 1, 1.4, 1.4, 6, { pen: 10 });
    const oak = treeGeo(1234, { height: 12, r: 0.62, levels: 4, spread: 0.85, lean: 0.06 });
    K.add(M.bark, place(oak, { x: 0, y: 0, z: 1 }));
    // a noose-free swing: one rope, one plank, somebody's idea of a joke
    K.box(M.burlap, 1.9, 1.1, 2.1, 0.03, 3.8, 0.03);
    K.box(M.burlap, 2.5, 1.1, 2.1, 0.03, 3.8, 0.03);
    K.box(M.stairWood, 2.2, 1.05, 2.1, 0.8, 0.05, 0.28);
    // lanterns round its roots
    let s = 20;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      jack(K, M, Math.cos(a) * 1.35, 0, 1 + Math.sin(a) * 1.35, { r: 0.22 + (i % 3) * 0.05, face: Math.atan2(Math.cos(a), Math.sin(a)), seed: s++ });
    }

    // the well
    const wx = -8, wz = 6;
    K.api.ghostBox(wx, wz, 2.3, 1.4, 0.95, { pen: 8 });
    K.api.ghostBox(wx, wz, 1.4, 2.3, 0.95, { pen: 8 });
    K.add(M.stone, place(new THREE.CylinderGeometry(1.15, 1.2, 0.95, 18, 1, true), { x: wx, y: 0.475, z: wz }));
    K.add(M.stone, place(new THREE.CylinderGeometry(0.95, 0.95, 0.95, 18, 1, true), { x: wx, y: 0.475, z: wz }));
    K.add(M.stoneDark, place(new THREE.RingGeometry(0.95, 1.15, 18), { x: wx, y: 0.96, z: wz, rx: -Math.PI / 2 }));
    K.add(M.water, place(new THREE.CircleGeometry(0.95, 18), { x: wx, y: 0.2, z: wz, rx: -Math.PI / 2 }), { shadow: false });
    for (const dz of [-1.05, 1.05]) K.box(M.stairWood, wx, 0.9, wz + dz, 0.14, 1.5, 0.14);
    K.box(M.stairWood, wx, 2.2, wz, 0.08, 0.08, 2.3);
    K.box(M.roof, wx - 0.55, 2.35, wz, 1.3, 0.08, 2.6, { rz: 0.55 });
    K.box(M.roof, wx + 0.55, 2.35, wz, 1.3, 0.08, 2.6, { rz: -0.55 });
    K.box(M.stairWood, wx, 1.45, wz, 0.3, 0.3, 0.3);

    // the pumpkin stall
    const sx = 8, sz = -4.3;
    K.solid(sx, sz + 0.3, 3.2, 1.0, 1.0, { mat: M.stairWood, pen: 1.8 });
    for (const [dx, dz] of [[-1.7, -0.9], [1.7, -0.9], [-1.7, 0.9], [1.7, 0.9]]) {
      K.solid(sx + dx, sz + dz, 0.14, 0.14, 2.7, { mat: M.stairWood, pen: 2 });
    }
    K.box(M.awningOrange, sx, 2.6, sz, 3.8, 0.04, 2.3, { rx: 0.18 });
    K.box(M.awningOrange, sx, 2.25, sz + 1.2, 3.8, 0.4, 0.02, { rx: 0.1 }, { shadow: false });
    for (let i = 0; i < 5; i++) jack(K, M, sx - 1.2 + i * 0.6, 1.0, sz + 0.3, { r: 0.2 + (i % 2) * 0.04, carved: i % 2 === 0, face: Math.PI, seed: 200 + i, glow: false });
    for (let i = 0; i < 6; i++) jack(K, M, sx - 1.5 + (i % 3) * 0.55, 0, sz + 1.25 + Math.floor(i / 3) * 0.5, { r: 0.24, carved: false, seed: 220 + i });
    // crates by it
    K.solid(sx + 2.6, sz - 0.2, 0.9, 0.9, 0.9, { mat: M.stairWood, pen: 1.8 });
    K.solid(sx + 2.6, sz - 0.2, 0.7, 0.7, 0.6, { y: 0.9, mat: M.stairWood, pen: 1.8 });

    // hay: cover round the square
    hayBale(K, M, -6.5, -5, {});
    hayBale(K, M, -6.5, -5, { y: 0.75, ry: 0.05 });
    hayBale(K, M, -5.2, -5.2, { ry: Math.PI / 2 });
    hayBale(K, M, 5.5, 8.6, {});
    hayBale(K, M, -3.8, 12.5, { ry: Math.PI / 2 });
    hayBale(K, M, -3.8, 13.8, { ry: Math.PI / 2 });
    hayBale(K, M, 12.2, -3.6, {});
    hayBale(K, M, 12.2, -3.6, { y: 0.75, ry: -0.08 });
    jack(K, M, 12.2, 1.5, -3.6, { r: 0.3, face: -Math.PI / 2 + 0.3, seed: 240 });
    jack(K, M, 5.5, 0.75, 8.6, { r: 0.27, face: Math.PI, seed: 241 });
    jack(K, M, -6.5, 1.5, -5, { r: 0.28, face: 0.6, seed: 242 });

    // the cart, full of pumpkins
    const cx = 8.8, cz = 9.2;
    K.api.ghostBox(cx, cz, 3.4, 1.7, 1.25, { pen: 2 });
    K.box(M.stairWood, cx, 0.55, cz, 3.4, 0.12, 1.7);
    for (const dz of [-0.82, 0.82]) K.box(M.stairWood, cx, 0.67, cz + dz, 3.4, 0.55, 0.06);
    for (const dx of [-1.67, 1.67]) K.box(M.stairWood, cx + dx, 0.67, cz, 0.06, 0.55, 1.7);
    for (const dz of [-0.95, 0.95]) {
      K.add(M.trimDark, place(new THREE.TorusGeometry(0.5, 0.06, 6, 16), { x: cx - 0.6, y: 0.5, z: cz + dz }));
      K.box(M.trimDark, cx - 0.6, 0.47, cz + dz, 0.06, 0.06, 0.1);
    }
    K.box(M.stairWood, cx + 2.4, 0.55, cz - 0.3, 1.6, 0.08, 0.08, { rz: -0.25 });
    K.box(M.stairWood, cx + 2.4, 0.55, cz + 0.3, 1.6, 0.08, 0.08, { rz: -0.25 });
    for (let i = 0; i < 7; i++) jack(K, M, cx - 1.2 + (i % 4) * 0.8, 0.68, cz - 0.4 + Math.floor(i / 4) * 0.8, { r: 0.3, carved: i === 2, face: Math.PI, seed: 260 + i, glow: false });

    gasLamp(K, M, -11, -8, { lights });
    gasLamp(K, M, 11, 10.5, { lights });
    gasLamp(K, M, -11, 11);
    gasLamp(K, M, 11, -8.5);
  }

  /* ------------------------------------------------ the graveyard */
  {
    // fence: north, east, south, west, with gates
    ironFence(K, M, { axis: "x", at: -6, a: -35.6, b: -26.6 });
    ironFence(K, M, { axis: "x", at: -6, a: -23.4, b: -16 });
    ironFence(K, M, { axis: "x", at: 20, a: -35.6, b: -23.6 });
    ironFence(K, M, { axis: "x", at: 20, a: -20.4, b: -16 });
    ironFence(K, M, { axis: "z", at: -16, a: -6, b: 0.4 });
    ironFence(K, M, { axis: "z", at: -16, a: 3.6, b: 12.4 });
    ironFence(K, M, { axis: "z", at: -16, a: 15.6, b: 20 });
    // (the west side, with its gate out to the chapel, is in buildOutskirts)
    // the main gate: stone pillars, an iron arch, and a sign
    for (const gz of [0.1, 3.9]) {
      K.solid(-16, gz, 0.6, 0.6, 2.5, { mat: M.stone, pen: 10 });
      K.box(M.stoneDark, -16, 2.5, gz, 0.75, 0.15, 0.75);
      K.add(M.stone, place(new THREE.SphereGeometry(0.22, 10, 8), { x: -16, y: 2.8, z: gz }));
    }
    K.add(M.iron, place(new THREE.TorusGeometry(1.9, 0.05, 6, 24, Math.PI), { x: -16, y: 2.5, z: 2, ry: Math.PI / 2 }));
    const gateSign = new THREE.MeshBasicMaterial({ map: signTexture(["REST IN PEPE"], { bg: "#121014", fg: "#9dff7a", edge: "#2a3a24" }), color: 0xd8ffd0 });
    for (const ry of [Math.PI / 2, -Math.PI / 2]) {
      K.add(gateSign, place(new THREE.PlaneGeometry(2.6, 0.5), { x: -16 + (ry > 0 ? 0.04 : -0.04), y: 3.1, z: 2, ry }), { shadow: false });
    }
    // open gate leaves swung in against the fence
    for (const [gz, dir] of [[0.4, -1], [3.6, 1]]) {
      K.box(M.iron, -16.9, 0.1, gz + dir * 0.05, 1.6, 0.05, 0.04);
      K.box(M.iron, -16.9, 1.7, gz + dir * 0.05, 1.6, 0.05, 0.04);
      for (let i = 0; i < 9; i++) K.box(M.iron, -16.2 - i * 0.18, 0.1, gz + dir * 0.05, 0.025, 1.7, 0.025);
    }

    // headstones in rows, graves running east of each stone
    const R = rng(66);
    const zs = [-4.5, -2.0, 5.0, 7.5, 10.0, 12.5, 15.0, 17.5];
    const rows = [-33.4, -30.4, -27.2, -22.6, -19.6];
    const open = new Set(["-33.4,-2", "-30.4,-4.5", "-27.2,17.5", "-22.6,10", "-19.6,-4.5", "-19.6,15", "-22.6,5", "-33.4,17.5"]);
    const decals = [];
    let k = 0;
    for (const x of rows) {
      for (const z of zs) {
        if (x > -31.5 && x < -24.5 && z > 6 && z < 15) continue;     // the mausoleum
        k++;
        const kind = R();
        const tilt = (R() - 0.5) * 0.14, twist = (R() - 0.5) * 0.12;
        if (kind < 0.62) {
          const w = 0.62 + R() * 0.2, h = 0.8 + R() * 0.35;
          K.api.ghostBox(x, z, 0.3, w, h, { pen: 3 });
          K.add(R() < 0.5 ? M.stone : M.stoneDark, place(headstoneGeo(w, h, 0.18), { x, y: 0, z, ry: Math.PI / 2 + twist, rz: 0, rx: 0, sx: 1 }));
          // tilt by leaning: done as a second rotation pass would skew UVs, so
          // a gentle lean is folded into the twist instead
          if (k % 2 === 0) decals.push({ x: x + 0.1, z, w, h, cell: k % EPITAPHS.length, twist });
        } else if (kind < 0.84) {
          K.api.ghostBox(x, z, 0.3, 0.7, 1.3, { pen: 3 });
          K.box(M.stone, x, 0, z, 0.16, 1.3, 0.16, { ry: twist, rz: tilt });
          K.box(M.stone, x, 0.8, z, 0.16, 0.14, 0.7, { ry: twist, rz: tilt });
          K.box(M.stoneDark, x, 0, z, 0.4, 0.14, 0.5);
        } else {
          K.api.ghostBox(x, z, 0.45, 0.45, 1.5, { pen: 4 });
          K.box(M.stoneDark, x, 0, z, 0.55, 0.3, 0.55);
          K.cyl(M.stone, x, 0.3, z, 0.2, 0.12, 1.1, 4, { ry: Math.PI / 4 });
          K.cyl(M.stone, x, 1.4, z, 0.12, 0, 0.25, 4, { ry: Math.PI / 4 });
        }
        // the grave itself: a low curb, or freshly dug and open
        const gx = x + 1.05;
        if (open.has(`${x},${z}`)) {
          K.box(M.dirt, gx, 0, z, 1.7, 0.08, 0.8, {}, { shadow: false });
          const mound = new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
          K.add(M.dirt, place(mound, { x: gx + 0.2, y: 0, z: z + 0.85, sx: 1.6, sy: 0.5, sz: 0.7 }));
          ZSPAWNS.push({ x: gx, y: 0, z, rise: true });
        } else if (R() < 0.6) {
          K.box(M.stoneDark, gx, 0, z - 0.42, 1.8, 0.12, 0.08, {}, { shadow: false });
          K.box(M.stoneDark, gx, 0, z + 0.42, 1.8, 0.12, 0.08, {}, { shadow: false });
          K.box(M.stoneDark, gx + 0.86, 0, z, 0.08, 0.12, 0.84, {}, { shadow: false });
        }
        if (R() < 0.3) candle(K, M, x + 0.3, 0, z + 0.25, { seed: 300 + k, h: 0.14 });
      }
    }
    // epitaphs on the east face of the round-topped stones
    for (const d of decals) {
      const g = new THREE.PlaneGeometry(d.w * 0.86, d.w * 0.86 * 0.9);
      const u0 = (d.cell % 4) / 4, v0 = 1 - (Math.floor(d.cell / 4) + 1) / 2;
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * 0.25, v0 + uv.getY(i) * 0.5);
      K.add(M.epitaph, place(g, { x: d.x + 0.03, y: d.h * 0.52, z: d.z, ry: Math.PI / 2 + d.twist }), { shadow: false });
    }

    // the monument where the aisle crosses the lane
    K.solid(-24, 2, 1.3, 1.3, 0.5, { mat: M.stoneDark, pen: 10 });
    K.solid(-24, 2, 0.8, 0.8, 3.4, { y: 0.5, pen: 10 });
    K.cyl(M.stone, -24, 0.5, 2, 0.5, 0.3, 3.2, 4, { ry: Math.PI / 4 });
    K.cyl(M.stone, -24, 3.7, 2, 0.32, 0, 0.7, 4, { ry: Math.PI / 4 });
    for (let i = 0; i < 4; i++) candle(K, M, -24 + [-0.5, 0.5, -0.5, 0.5][i], 0.5, 2 + [-0.5, -0.5, 0.5, 0.5][i], { seed: 400 + i, h: 0.22, r: 0.05 });

    // the mausoleum: stone, one door east, a sarcophagus and a green glow
    const mx0 = -31, mx1 = -25, mz0 = 8, mz1 = 14, mh = 3.2;
    wall(K, { axis: "x", at: mz0 + 0.25, a: mx0, b: mx1, h: mh, t: 0.5, mat: M.stone });
    wall(K, { axis: "x", at: mz1 - 0.25, a: mx0, b: mx1, h: mh, t: 0.5, mat: M.stone });
    wall(K, { axis: "z", at: mx0 + 0.25, a: mz0 + 0.5, b: mz1 - 0.5, h: mh, t: 0.5, mat: M.stone });
    wall(K, { axis: "z", at: mx1 - 0.25, a: mz0 + 0.5, b: mz1 - 0.5, h: mh, t: 0.5, mat: M.stone,
      holes: [{ c: 11, w: 1.8, spans: [[0, 2.5]] }], trim: M.stoneDark, out: 1 });
    K.solid(-28, 11, 6.8, 6.8, 0.35, { y: mh, mat: M.stoneDark, pen: 10 });
    K.add(M.stone, place(prismGeo([[-3.4, 0], [3.4, 0], [0, 1.3]], 6.6), { x: -28, y: mh + 0.35, z: 11, ry: Math.PI / 2 }));
    for (const cz of [9.3, 12.7]) {
      K.solid(-24.55, cz, 0.44, 0.44, mh, { pen: 8 });
      K.cyl(M.stone, -24.55, 0, cz, 0.24, 0.2, mh, 12);
    }
    K.solid(-24.4, 11, 1.2, 4.2, 0.18, { mat: M.stoneDark, pen: 6 });
    const plaque = new THREE.MeshBasicMaterial({ map: signTexture(["TROLL"], { w: 512, h: 128, bg: "#3a3a40", fg: "#141418", edge: "#55555c" }), color: 0xb0b0b8 });
    K.add(plaque, place(new THREE.PlaneGeometry(1.8, 0.45), { x: -24.74, y: 2.85, z: 11, ry: Math.PI / 2 }), { shadow: false });
    K.solid(-28.4, 11, 1.1, 2.3, 0.95, { mat: M.stoneDark, pen: 10 });
    K.box(M.stone, -28.4, 0.95, 11, 1.2, 0.15, 2.4);
    for (const [cx, cz] of [[-27.6, 9.6], [-27.6, 12.4], [-29.8, 9.2], [-29.8, 12.8]]) candle(K, M, cx, 0, cz, { seed: 500 + cx, h: 0.3, r: 0.05 });
    K.add(M.greenGlow, place(new THREE.PlaneGeometry(4.5, 4.5), { x: -28, y: 0.04, z: 11, rx: -Math.PI / 2 }), { shadow: false, phase: 0.3 });
    const ml = new THREE.PointLight(0x5dff8a, 6, 10, 2);
    ml.position.set(-28, 2.4, 11);
    lights.push(ml);

    // dead trees inside the fence
    const t1 = treeGeo(777, { height: 7, r: 0.3, levels: 3 });
    K.add(M.bark, place(t1, { x: -34.2, z: 6.2 }));
    K.api.ghostBox(-34.2, 6.2, 0.6, 0.6, 4, { pen: 6 });
    const t2 = treeGeo(778, { height: 6, r: 0.26, levels: 3 });
    K.add(M.bark, place(t2, { x: -16.9, z: 8.8, ry: 1.3 }));
    K.api.ghostBox(-16.9, 8.8, 0.5, 0.5, 4, { pen: 6 });
  }

  /* ------------------------------------------------ the hedge garden (NW) */
  {
    const hedge = (x, z, w, d) => K.solid(x, z, w, d, 1.35, { mat: M.hedge, pen: 0.6 });
    const cx = -24, cz = -19, half = 6;
    for (const s of [-1, 1]) {
      // north + south runs, each split by a path
      hedge(cx - 3.6, cz + s * half, 4.8, 1.0);
      hedge(cx + 3.6, cz + s * half, 4.8, 1.0);
      // west + east runs
      hedge(cx + s * half, cz - 3.6, 1.0, 4.8);
      hedge(cx + s * half, cz + 3.6, 1.0, 4.8);
    }
    // the fountain
    K.api.ghostBox(cx, cz, 4.4, 2.6, 0.7, { pen: 8 });
    K.api.ghostBox(cx, cz, 2.6, 4.4, 0.7, { pen: 8 });
    K.add(M.stone, place(new THREE.CylinderGeometry(2.2, 2.3, 0.7, 24, 1, true), { x: cx, y: 0.35, z: cz }));
    K.add(M.stone, place(new THREE.CylinderGeometry(1.95, 1.95, 0.7, 24, 1, true), { x: cx, y: 0.35, z: cz }));
    K.add(M.stoneDark, place(new THREE.RingGeometry(1.95, 2.2, 24), { x: cx, y: 0.71, z: cz, rx: -Math.PI / 2 }));
    K.add(M.water, place(new THREE.CircleGeometry(1.95, 24), { x: cx, y: 0.5, z: cz, rx: -Math.PI / 2 }), { shadow: false });
    K.solid(cx, cz, 0.5, 0.5, 1.6, { pen: 8 });
    K.cyl(M.stone, cx, 0, cz, 0.3, 0.2, 1.6, 10);
    K.add(M.stone, place(new THREE.CylinderGeometry(0.9, 0.3, 0.3, 16), { x: cx, y: 1.7, z: cz }));
    jack(K, M, cx, 1.85, cz, { r: 0.34, face: Math.PI * 0.1, seed: 600 });
    // stone benches on the paths
    for (const [bx, bz] of [[-27.6, -15.2], [-20.4, -22.8]]) {
      K.solid(bx, bz, 1.8, 0.5, 0.5, { mat: M.stone, pen: 6 });
    }
    const t3 = treeGeo(901, { height: 8, r: 0.34, levels: 3 });
    K.add(M.bark, place(t3, { x: -33, z: -12 }));
    K.api.ghostBox(-33, -12, 0.7, 0.7, 4, { pen: 6 });
    const t4 = treeGeo(902, { height: 7, r: 0.3, levels: 3 });
    K.add(M.bark, place(t4, { x: -16.5, z: -29.5, ry: 2 }));
    K.api.ghostBox(-16.5, -29.5, 0.6, 0.6, 4, { pen: 6 });
  }

  /* ------------------------------------------------ corn + pumpkin patch (E) */
  {
    // corn rows: tall and see-nothing, but a bullet goes straight through
    const rows = [
      [22, [[-9.5, -4.8], [-2.8, 3]]],
      [25, [[-7.5, 3]]],
      [28, [[-9.5, -1.2], [0.8, 3]]],
      [31, [[-9.5, -5.5], [-3.5, 3]]],
    ];
    const R = rng(808);
    for (const [x, segs] of rows) {
      for (const [a, b] of segs) {
        K.api.ghostBox(x, (a + b) / 2, 1.3, b - a, 2.5, { pen: 0.35 });
        K.box(M.dirt, x, 0, (a + b) / 2, 1.5, 0.12, b - a + 0.2, {}, { shadow: false });
        for (let z = a + 0.3; z < b; z += 0.55) {
          for (const dx of [-0.35, 0.35]) {
            const px = x + dx + (R() - 0.5) * 0.2, pz = z + (R() - 0.5) * 0.25;
            const h = 2.3 + R() * 0.5, ry = R() * Math.PI;
            for (const extra of [0, Math.PI / 2]) {
              K.add(M.corn, place(new THREE.PlaneGeometry(1.0, h), { x: px, y: h / 2, z: pz, ry: ry + extra }));
            }
          }
        }
      }
    }
    // rail fence along the north edge of the field, with gaps
    for (const [a, b] of [[15, 20.5], [23, 29.5], [32, 36]]) {
      const c = (a + b) / 2;
      K.api.ghostBox(c, -12.5, b - a, 0.12, 1.1, { pen: 0.4 });
      for (const y of [0.45, 0.95]) K.box(M.stairWood, c, y, -12.5, b - a, 0.1, 0.06);
      for (let x = a; x <= b + 0.01; x += 1.8) K.box(M.stairWood, x, 0, -12.5, 0.12, 1.15, 0.12);
    }

    // the patch: pumpkins on vines, three giants you can hide behind
    // the big one's carved, grinning back toward town
    const giants = [[20, 7.5, 0.95], [30.5, 11, 1.15], [25, 16, 0.9]];
    for (const [x, z, r] of giants) {
      K.api.ghostBox(x, z, r * 1.7, r * 1.7, r * 1.45, { pen: 3 });
      jack(K, M, x, 0, z, { r, face: -Math.PI / 2, carved: r > 1, seed: Math.round(x * 13 + z) });
    }
    const P = rng(4242);
    const avoid = [[17.8, 12.8, 3.4], [26, 8, 1.2], ...giants.map(([x, z, r]) => [x, z, r + 0.8])];
    for (let i = 0; i < 70; i++) {
      const x = 14.5 + P() * 20.5, z = 5.2 + P() * 12.3;
      if (avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar)) continue;
      const r = 0.18 + P() * 0.22;
      const carved = P() < 0.12;
      jack(K, M, x, 0, z, { r, carved, face: -Math.PI / 2 + (P() - 0.5), seed: 700 + i, glow: carved });
      if (P() < 0.6) {
        K.add(M.leaf, place(new THREE.PlaneGeometry(1.2, 1.2), { x: x + (P() - 0.5), y: 0.03 + i * 0.0004, z: z + (P() - 0.5), rx: -Math.PI / 2, rz: P() * 6 }), { shadow: false });
      }
    }
    ZSPAWNS.push({ x: 23, y: 0, z: 11, rise: true }, { x: 32.5, y: 0, z: 15.5, rise: true }, { x: 16.6, y: 0, z: 7.4, rise: true });

    // the scarecrow: a post, a cross-bar, a burlap coat, a lantern for a head
    const sx = 26, sz = 8;
    K.solid(sx, sz, 0.25, 0.25, 2.6, { pen: 2 });
    K.box(M.stairWood, sx, 0, sz, 0.14, 2.3, 0.14);
    K.box(M.stairWood, sx, 1.75, sz, 0.1, 0.1, 2.0);
    K.add(M.burlap, place(prismGeo([[-0.45, 0], [0.45, 0], [0.3, 0.85], [-0.3, 0.85]], 0.35), { x: sx, y: 1.0, z: sz, ry: Math.PI / 2 }));
    for (const s of [-1, 1]) K.add(M.burlap, place(new THREE.PlaneGeometry(0.9, 0.35), { x: sx, y: 1.72, z: sz + s * 0.55, ry: Math.PI / 2, rz: s * 0.1 }));
    jack(K, M, sx, 2.02, sz, { r: 0.3, face: -Math.PI / 2, seed: 999, glow: false });
    K.add(M.trimDark, place(new THREE.ConeGeometry(0.45, 0.5, 12), { x: sx, y: 2.72, z: sz }));
    K.add(M.trimDark, place(new THREE.CylinderGeometry(0.62, 0.62, 0.03, 16), { x: sx, y: 2.5, z: sz }));

    // the bonfire, with bales round it to sit on
    const bx = 17.8, bz = 12.8;
    K.api.ghostBox(bx, bz, 2.0, 2.0, 0.45, { pen: 8 });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      K.add(M.stoneDark, place(new THREE.DodecahedronGeometry(0.28), { x: bx + Math.cos(a) * 0.95, y: 0.2, z: bz + Math.sin(a) * 0.95, sy: 0.75, ry: a }));
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      K.cyl(M.bark, bx + Math.cos(a) * 0.3, 0.05, bz + Math.sin(a) * 0.3, 0.09, 0.07, 1.1, 6, { rx: Math.cos(a + 1.57) * 0.9, rz: -Math.sin(a + 1.57) * 0.9, ry: 0 });
    }
    K.box(M.ember, bx, 0.02, bz, 0.9, 0.12, 0.9, { ry: 0.4 }, { shadow: false });
    for (let i = 0; i < 5; i++) {
      const s = 1 - i * 0.12;
      for (const ry of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
        K.add(M.flame, place(new THREE.PlaneGeometry(1.1 * s, 1.9 * s), { x: bx + (i - 2) * 0.12, y: 0.9 * s + 0.1, z: bz + ((i * 7) % 3 - 1) * 0.1, ry: ry + i }), { phase: i * 0.21, shadow: false });
      }
    }
    K.add(M.glow, place(new THREE.PlaneGeometry(9, 9), { x: bx, y: 0.04, z: bz, rx: -Math.PI / 2 }), { phase: 0.5, shadow: false });
    const bl = new THREE.PointLight(0xff7b2e, 16, 18, 2);
    bl.position.set(bx, 1.6, bz);
    bl.userData.flicker = 2;
    lights.push(bl);
    for (const [dx, dz, ry] of [[-2.6, 0, Math.PI / 2], [2.6, 0.2, Math.PI / 2], [0, 2.7, 0], [0.3, -2.6, 0]]) {
      hayBale(K, M, bx + dx, bz + dz, { ry });
    }
  }

  /* ------------------------------------------------ the windmill (NE) */
  {
    const wx = 28, wz = -22;
    K.solid(wx, wz, 4, 4, 7, { pen: 10 });
    K.add(M.siding, place(new THREE.CylinderGeometry(1.7, 2.6, 7, 8), { x: wx, y: 3.5, z: wz, ry: Math.PI / 8 }));
    K.add(M.roof, place(new THREE.ConeGeometry(2.1, 2.4, 8), { x: wx, y: 8.2, z: wz, ry: Math.PI / 8 }));
    K.box(M.trimDark, wx, 0, wz + 2.35, 1.2, 2.2, 0.2);
    K.add(M.winGlow, place(new THREE.PlaneGeometry(0.5, 0.8), { x: wx, y: 5, z: wz + 2.02, rx: -0.12 }), { shadow: false });
    // the sails turn, slowly, on their own mesh
    const sails = new THREE.Group();
    const sailMat = M.stairWood;
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group();
      arm.rotation.z = (i * Math.PI) / 2;
      const spar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.8, 0.12), sailMat);
      spar.position.y = 2.4;
      arm.add(spar);
      const lattice = new THREE.Mesh(new THREE.BoxGeometry(1.0, 3.4, 0.04), M.burlap);
      lattice.position.set(0.55, 3.0, 0);
      arm.add(lattice);
      sails.add(arm);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 10), M.iron);
    hub.rotation.x = Math.PI / 2;
    sails.add(hub);
    sails.position.set(wx, 7.6, wz + 2.3);
    sails.rotation.x = -0.12;
    sails.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    hub.onBeforeRender = () => { sails.rotation.z = -performance.now() / 1000 * 0.35; };
    root.add(sails);
    for (const [dx, dz] of [[-3.4, 1.4], [-3.2, 2.6], [3.5, -1.2]]) hayBale(K, M, wx + dx, wz + dz, { ry: dx * 0.2 });
  }

  /* ------------------------------------------------ the candy shop (S) */
  {
    const sx0 = -11, sx1 = -1, sz0 = 21, sz1 = 27.5, sh = 3.4;
    const S = { mat: M.shop, trim: M.shopTrim, pen: 8 };
    wall(K, { axis: "x", at: sz0 + 0.2, a: sx0, b: sx1, h: sh, out: -1, ...S,
      holes: [{ c: -6, w: 1.8, spans: [[0, 2.5]] }, { c: -9, w: 2.2, spans: [[0.9, 2.3]] }, { c: -2.9, w: 1.8, spans: [[0.9, 2.3]] }] });
    wall(K, { axis: "x", at: sz1 - 0.2, a: sx0, b: sx1, h: sh, out: 1, ...S,
      holes: [{ c: -3.5, w: 1.6, spans: [[0, 2.4]] }, { c: -8.5, w: 1.4, spans: [[1.0, 2.2]] }] });
    wall(K, { axis: "z", at: sx0 + 0.2, a: sz0 + 0.4, b: sz1 - 0.4, h: sh, out: -1, ...S, holes: [{ c: 24.2, w: 1.6, spans: [[1.0, 2.3]] }] });
    wall(K, { axis: "z", at: sx1 - 0.2, a: sz0 + 0.4, b: sz1 - 0.4, h: sh, out: 1, ...S, holes: [{ c: 24.2, w: 1.4, spans: [[1.0, 2.3]] }] });
    K.solid(-6, 24.25, 10.6, 7.1, 0.3, { y: sh, mat: M.trimDark, pen: 8 });
    K.add(M.floor, place(new THREE.PlaneGeometry(9.6, 6.1), { x: -6, y: 0.02, z: 24.25, rx: -Math.PI / 2 }), { shadow: false });
    // false front with the sign
    K.box(M.shop, -6, sh, sz0 + 0.1, 10.2, 1.8, 0.3);
    K.box(M.shopTrim, -6, sh + 1.8, sz0 + 0.1, 10.6, 0.16, 0.45);
    const sign = new THREE.MeshBasicMaterial({ map: signTexture(["TROLL & TREAT"], { fg: "#ffb347", edge: "#8e4dcf", bg: "#1c1024" }), color: 0xffffff });
    K.add(sign, place(new THREE.PlaneGeometry(7.4, 1.35), { x: -6, y: sh + 0.9, z: sz0 - 0.07, ry: Math.PI }), { shadow: false });
    // striped awnings over the windows
    for (const [ax, aw] of [[-9, 2.8], [-2.9, 2.4]]) {
      K.box(M.awningPurple, ax, 2.55, sz0 - 0.45, aw, 0.04, 1.0, { rx: -0.35 });
    }
    // inside: counter, shelves of jars, a cauldron of candy
    K.solid(-8.4, 25.1, 2.8, 0.8, 1.05, { mat: M.stairWood, pen: 1.8 });
    K.solid(-7.6, 27.0, 4.6, 0.5, 2.2, { mat: M.stairWood, pen: 2 });
    const C = rng(31);
    for (let shelf = 0; shelf < 3; shelf++) {
      for (let i = 0; i < 9; i++) {
        const hue = new THREE.Color().setHSL(C(), 0.75, 0.55);
        const jarX = -9.6 + i * 0.5, jarY = 0.5 + shelf * 0.62;
        K.add(M.candy, place(new THREE.CylinderGeometry(0.13, 0.13, 0.32, 10), { x: jarX, y: jarY + 0.16, z: 26.75 }), { color: hue.getHex(), shadow: false });
      }
      K.box(M.trimDark, -7.6, 0.45 + shelf * 0.62, 26.72, 4.6, 0.05, 0.4, {}, { shadow: false });
    }
    K.api.ghostBox(-3, 23.6, 1.3, 1.3, 0.8, { pen: 6 });
    K.add(M.iron, place(new THREE.SphereGeometry(0.65, 16, 10, 0, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.6), { x: -3, y: 0.65, z: 23.6 }));
    for (let i = 0; i < 14; i++) {
      const hue = new THREE.Color().setHSL(C(), 0.8, 0.55);
      K.add(M.candy, place(new THREE.SphereGeometry(0.08, 6, 4), { x: -3 + (C() - 0.5) * 0.8, y: 0.62 + C() * 0.08, z: 23.6 + (C() - 0.5) * 0.8 }), { color: hue.getHex(), shadow: false });
    }
    const cl = new THREE.PointLight(0xff9a6a, 7, 11, 2);
    cl.position.set(-6, 2.7, 24.3);
    lights.push(cl);
    let s = 1100;
    for (const [x, z, r] of [[-7.2, 20.4, 0.3], [-4.8, 20.3, 0.25], [-10.6, 20.4, 0.28], [-1.4, 20.5, 0.22]]) jack(K, M, x, 0, z, { r, face: Math.PI, seed: s++ });
  }

  /* ------------------------------------------------ the barn (SE) */
  {
    const bx0 = 17, bx1 = 29, bz0 = 20, bz1 = 29, bh = 4.4, t = 0.35;
    const B = { mat: M.barn, trim: M.barnTrim, t };
    wall(K, { axis: "x", at: bz0 + t / 2, a: bx0, b: bx1, h: bh, out: -1, ...B, holes: [{ c: 23, w: 4, spans: [[0, 3.6]] }] });
    wall(K, { axis: "x", at: bz1 - t / 2, a: bx0, b: bx1, h: bh, out: 1, ...B, holes: [{ c: 20, w: 1.2, spans: [[1.8, 2.8]] }, { c: 26, w: 1.2, spans: [[1.8, 2.8]] }] });
    wall(K, { axis: "z", at: bx0 + t / 2, a: bz0 + t, b: bz1 - t, h: bh, out: -1, ...B, holes: [{ c: 24.5, w: 3, spans: [[0, 3.2]] }] });
    wall(K, { axis: "z", at: bx1 - t / 2, a: bz0 + t, b: bz1 - t, h: bh, out: 1, ...B, holes: [{ c: 26, w: 1.6, spans: [[0, 2.4]] }, { c: 22.5, w: 1.2, spans: [[1.8, 2.8]] }] });
    K.solid(23, 24.5, 12.4, 9.4, 0.3, { y: bh, mat: M.stairWood, pen: 8 });
    K.add(M.hay, place(new THREE.PlaneGeometry(11.2, 8.2), { x: 23, y: 0.02, z: 24.5, rx: -Math.PI / 2 }), { shadow: false });
    // gambrel roof along x
    const half = (bz1 - bz0) / 2 + 0.4;
    const lowRun = half - 3, lowRise = 2.0, upRun = 3, upRise = 1.3;
    const ridge = (bz0 + bz1) / 2;
    for (const s of [-1, 1]) {
      const lLen = Math.hypot(lowRun, lowRise), lAng = Math.atan2(lowRise, lowRun);
      K.box(M.roof, 23, bh + lowRise / 2 - 0.1, ridge + s * (3 + lowRun / 2), 12.8, 0.2, lLen, { rx: s * lAng });
      const uLen = Math.hypot(upRun, upRise), uAng = Math.atan2(upRise, upRun);
      K.box(M.roof, 23, bh + lowRise + upRise / 2 - 0.1, ridge + s * (upRun / 2), 12.8, 0.2, uLen, { rx: s * uAng });
    }
    const gable = [[-half + 0.4, 0], [half - 0.4, 0], [3, lowRise], [0, lowRise + upRise], [-3, lowRise]];
    for (const gx of [bx0 + 0.18, bx1 - 0.18]) K.add(M.barn, place(prismGeo(gable, 0.35), { x: gx, y: bh, z: ridge, ry: Math.PI / 2 }));
    // big door leaves swung flat against the wall, with the white X
    for (const s of [-1, 1]) {
      const dx = 23 + s * 3.05;
      K.box(M.barn, dx, 0, bz0 - 0.1, 2.0, 3.5, 0.08);
      K.box(M.barnTrim, dx, 1.72, bz0 - 0.16, 2.1, 0.12, 0.04);
      K.box(M.barnTrim, dx, 0, bz0 - 0.16, 2.0, 3.5, 0.04, {}, { shadow: false });
      for (const r of [0.97, -0.97]) K.box(M.barn, dx, 0.1, bz0 - 0.18, 0.14, 3.9, 0.04, { rz: r * 0.5 });
    }
    // hayloft (just the look of one: out of reach), hay stacks, a wagon
    K.box(M.stairWood, 18.5, 3.0, 24.5, 2.6, 0.15, 8.2);
    K.solid(18.6, 27.4, 2.6, 2.2, 1.5, { pen: 1.5 });
    for (let i = 0; i < 4; i++) hayBale(K, M, 18.0 + (i % 2) * 1.3, 26.9 + Math.floor(i / 2) * 0.9, { y: 0, collide: false });
    for (let i = 0; i < 2; i++) hayBale(K, M, 18.6, 27.35, { y: 0.75, ry: i * 0.1, collide: false });
    hayBale(K, M, 27, 21.6, { ry: Math.PI / 2 });
    hayBale(K, M, 27, 21.6, { y: 0.75, ry: Math.PI / 2 + 0.1 });
    hayBale(K, M, 25.4, 27.5, {});
    const cw = { x: 23.6, z: 25.2 };
    K.api.ghostBox(cw.x, cw.z, 3.2, 1.6, 1.3, { pen: 2 });
    K.box(M.stairWood, cw.x, 0.55, cw.z, 3.2, 0.12, 1.6);
    for (const dz of [-0.77, 0.77]) K.box(M.stairWood, cw.x, 0.67, cw.z + dz, 3.2, 0.5, 0.06);
    for (const [wx, wz] of [[-1, -0.9], [1, -0.9], [-1, 0.9], [1, 0.9]]) {
      K.add(M.trimDark, place(new THREE.TorusGeometry(0.45, 0.05, 6, 14), { x: cw.x + wx, y: 0.45, z: cw.z + wz }));
    }
    for (let i = 0; i < 3; i++) hayBale(K, M, cw.x - 0.9 + i * 0.9, cw.z, { y: 0.67, ry: Math.PI / 2, collide: false });
    const bl = new THREE.PointLight(0xffb070, 8, 14, 2);
    bl.position.set(23, 3.8, 24.5);
    lights.push(bl);
    K.cyl(M.iron, 23, 3.9, 24.5, 0.01, 0.01, 0.5, 4);
    K.box(M.lampGlass, 23, 3.55, 24.5, 0.2, 0.3, 0.2, {}, { shadow: false });
    jack(K, M, 20.6, 0, 19.4, { r: 0.33, face: Math.PI, seed: 1200 });
    jack(K, M, 25.5, 0, 19.3, { r: 0.28, face: Math.PI, seed: 1201 });
  }

  /* ------------------------------------------------ the south road */
  {
    // the hearse, nose north, back hatch open with a coffin sliding out
    const hx = 6.4, hz = 18.2;
    K.api.ghostBox(hx, hz, 2.0, 5.4, 1.55, { pen: 3 });
    K.box(M.car, hx, 0.35, hz, 1.95, 0.7, 5.4);
    K.box(M.car, hx, 1.05, hz + 0.6, 1.8, 0.75, 3.9);
    K.box(M.glassDark, hx, 1.12, hz - 1.43, 1.7, 0.55, 0.05, { rx: 0.35 });
    for (const s of [-1, 1]) {
      K.box(M.glassDark, hx + s * 0.905, 1.15, hz - 0.6, 0.02, 0.5, 1.1);
      K.box(M.fabric, hx + s * 0.905, 1.12, hz + 1.2, 0.02, 0.55, 2.2);
      K.box(M.chrome, hx + s * 0.91, 1.1, hz + 1.2, 0.03, 0.05, 2.4);
      for (const wz of [-1.8, 1.8]) K.add(M.trimDark, place(new THREE.CylinderGeometry(0.38, 0.38, 0.25, 14), { x: hx + s * 0.92, y: 0.38, z: hz + wz, rz: Math.PI / 2 }));
    }
    K.box(M.chrome, hx, 0.35, hz - 2.72, 1.9, 0.18, 0.06);
    K.box(M.lampGlass, hx - 0.7, 0.62, hz - 2.72, 0.3, 0.12, 0.03, {}, { shadow: false });
    K.box(M.lampGlass, hx + 0.7, 0.62, hz - 2.72, 0.3, 0.12, 0.03, {}, { shadow: false });
    K.box(M.car, hx, 1.8, hz + 2.95, 1.8, 0.06, 1.0, { rx: -1.1 });
    K.add(M.stairWood, place(prismGeo([[-0.3, -1.0], [0.3, -1.0], [0.4, 0.4], [0, 1.0], [-0.4, 0.4]], 0.45), { x: hx, y: 0.95, z: hz + 2.6, rx: Math.PI / 2 - 0.18 }));
    jack(K, M, hx - 0.4, 1.8, hz + 1.4, { r: 0.26, face: -Math.PI / 2, seed: 1300 });

    // road gate at the south edge
    for (const gx of [-3, 3]) {
      K.solid(gx, 31.2, 0.8, 0.8, 2.4, { mat: M.stone, pen: 10 });
      K.add(M.stone, place(new THREE.SphereGeometry(0.3, 10, 8), { x: gx, y: 2.65, z: 31.2 }));
      jack(K, M, gx, 2.4, 31.2, { r: 0.3, face: Math.PI, seed: 1310 + gx, glow: false });
    }
    // low stone walls and a toolshed for the south-west corner
    K.solid(-18, 24, 0.7, 5, 1.0, { mat: M.stone, pen: 8 });
    K.solid(13.4, 23.6, 0.7, 4, 1.0, { mat: M.stone, pen: 8 });
    K.solid(-27, 26, 4, 3, 2.6, { mat: M.siding, pen: 8 });
    K.box(M.roof, -27, 2.6, 26, 4.5, 0.18, 3.5, { rx: 0.15 });
    K.box(M.trimDark, -27, 0, 24.47, 1.1, 2.0, 0.05);
    hayBale(K, M, -21, 28.6, {});
    hayBale(K, M, -21, 28.6, { y: 0.75, ry: 0.1 });
    jack(K, M, -21, 1.5, 28.6, { r: 0.28, face: Math.PI, seed: 1400 });
    hayBale(K, M, 9.5, 27.5, { ry: Math.PI / 2 });
    // lamps down the road (bulbs only)
    gasLamp(K, M, 3.2, 15.5);
    gasLamp(K, M, -3.2, 26);
    // lanterns lining the road
    let s = 1500;
    for (const z of [13, 17, 21, 25, 29]) {
      jack(K, M, -2.6, 0, z, { r: 0.2 + (s % 3) * 0.03, face: Math.PI / 2, seed: s++ });
      jack(K, M, 2.6, 0, z + 1.5, { r: 0.2 + (s % 3) * 0.03, face: -Math.PI / 2, seed: s++ });
    }
  }

  buildOutskirts(api, K, M, SP, root, lights);

  /* ------------------------------------------------ the sky: a full moon */
  {
    const dir = new THREE.Vector3(...HOLLOWGRIN.sun.pos).normalize();
    const moon = new THREE.Mesh(
      new THREE.CircleGeometry(12, 48),
      new THREE.MeshBasicMaterial({ map: moonTexture(), color: new THREE.Color(0xfff4d8).multiplyScalar(1.6), fog: false, transparent: true, depthWrite: false }),
    );
    moon.position.copy(dir).multiplyScalar(200);
    moon.lookAt(0, 0, 0);
    moon.renderOrder = -1;
    root.add(moon);
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(95, 95),
      new THREE.MeshBasicMaterial({ map: glowTexture(), color: new THREE.Color(0x8fa4ff).multiplyScalar(0.55), fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    halo.position.copy(dir).multiplyScalar(205);
    halo.lookAt(0, 0, 0);
    halo.renderOrder = -2;
    root.add(halo);

    // bats circling the turret
    const batMat = new THREE.MeshBasicMaterial({ color: 0x0b0a10, side: THREE.DoubleSide });
    const wingGeo = new THREE.BufferGeometry();
    wingGeo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0.35, 0.02, -0.12, 0.3, 0, 0.12, 0, 0, 0, 0.3, 0, 0.12, 0.08, 0, 0.18], 3));
    wingGeo.computeVertexNormals();
    const bats = [];
    for (let i = 0; i < 9; i++) {
      const b = new THREE.Group();
      const l = new THREE.Mesh(wingGeo, batMat);
      const r = new THREE.Mesh(wingGeo, batMat);
      r.scale.x = -1;
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 4), batMat);
      body.scale.z = 2;
      b.add(l, r, body);
      b.userData = { l, r, a: (i / 9) * Math.PI * 2, rad: 5 + (i % 3) * 2.2, h: 12 + (i % 4) * 1.4, sp: 0.5 + (i % 5) * 0.08 };
      b.scale.setScalar(1.6);
      root.add(b);
      bats.push(b);
    }
    root.add(ticker(() => {
      const t = performance.now() / 1000;
      for (const b of bats) {
        const u = b.userData;
        const a = u.a + t * u.sp;
        b.position.set(12.5 + Math.cos(a) * u.rad, u.h + Math.sin(t * 1.3 + u.a) * 0.8, -27.5 + Math.sin(a) * u.rad);
        b.rotation.y = -a;
        const w = Math.sin(t * 14 + u.a * 3) * 0.9;
        u.l.rotation.z = w;
        u.r.rotation.z = -w;
      }
    }, batMat));
  }

  K.flush();
  root.add(SP.points(sparkMaterial()));

  // lights: a flickering few, the rest steady
  const flickers = lights.filter((l) => l.userData.flicker);
  for (const l of lights) {
    l.castShadow = false;
    l.userData.base = l.intensity;
    root.add(l);
  }
  if (flickers.length) {
    root.add(ticker(() => {
      const t = performance.now() / 1000;
      for (const l of flickers) {
        const k = l.userData.flicker;
        l.intensity = l.userData.base * (0.82 + 0.12 * Math.sin(t * 9 * k) * Math.sin(t * 5.3 + k) + 0.06 * Math.sin(t * 23 + k * 2));
      }
    }, M.iron));
  }

  /* ------------------------------------------------ zombie entry points */
  // out of the woods, all round the edge (south: between the lane's houses)
  for (const [x, z] of [
    [-40, -44.3], [-24, -44.3], [-12, -44.3], [12, -44.3], [24, -44.3], [40, -44.3],
    [50.2, -40], [50.2, -20], [50.2, 1.5], [50.2, 26], [50.2, 35],
    [-50.2, -32], [-50.2, -8], [-50.2, 10], [-50.2, 35],
    [-41, 44.3], [-21.7, 44.3], [-9, 44.3], [9, 44.3], [21.7, 44.3], [35, 44.3],
  ]) ZSPAWNS.push({ x, y: 0, z });
}

/* ================================================================ the map */

export const HOLLOWGRIN = {
  name: "Hollowgrin",
  blurb: "Full moon, fresh graves. Even the pumpkins are grinning.",
  bounds: { ...BOUNDS },
  playerSpawn: { x: 0, z: 8 },
  // Midnight with a full moon: violet sky, the moon high behind the manor.
  // No sun disc (the moon is its own mesh); thin, moonlit cloud drifting.
  sky: { top: 0x05060f, horizon: 0x2a1838, bottom: 0x0a0710, haze: 0.2, clouds: 0.28, cloudColor: 0x4a4466, cloudShade: 0x0c0a16 },
  fog: { color: 0x1c1428, density: 0.016 },
  ground: { colorA: 0x4a5634, colorB: 0x3a4428, grid: 0x5a6a44, surface: "grass", tile: 4 },
  sun: { color: 0xa8b8ff, intensity: 1.5, pos: [-26, 48, -58] },
  hemi: { sky: 0x6c78c0, ground: 0x3a2a24, intensity: 1.35 },
  ambient: { color: 0x6a5a8a, intensity: 0.35 },
  build: buildHollowgrin,
  // Team spawns: six along the north edge, six on Trick-or-Treat Lane.
  spawns: [[-31, -42.5], [-20, -42], [-12.5, -36.5], [12.5, -36.5], [20, -42], [31, -42.5],
    [-30, 35], [-18, 35], [-6.5, 35], [6.5, 35], [18, 35], [30, 35]],
  // the pond and the creek: wade through them
  wade: wadePolygon(),

  // For zombies.js: graves and woods on the ground, the manor's upstairs
  // windows, and the grand stair joining the two floors.
  zombieLayout: () => ({
    windows: ZSPAWNS.map((w) => ({ ...w })),
    floorOf: hgFloorOf,
    floors: HG_FLOORS,
    links: [{ from: "ground", to: "upper", a: { x: STAIR.x, z: STAIR.z + 0.9 }, b: { x: STAIR.x, z: HOLE.z0 - 1.0 } }],
    support: true,
    preferDist: 17,
    navCell: 0.55,
    navPad: 0.3,
    navStep: 0.45,   // what a zombie steps over (zombies.js resolveCircle: 0.5)
  }),
};
