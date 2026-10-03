// Troll Forces — "Hollowgrin", the Halloween map.
//
// A village on the night of the full moon. Grinmoor Manor looms over the
// north edge (two floors, a grand stair, a balcony over the porch, a turret
// against the moon); the square in the middle is a dead oak, a well and the
// pumpkin market; the graveyard fills the west, the corn and the pumpkin
// patch the east; the candy shop and the barn sit by the south road.
//
// Round the village (the map doubled in area, 72 x 64 -> 102 x 90 m, and the park
// took it to 138 x 90): the
// chapel of St. Grinsworth past the graveyard's west gate, the
// witch's hollow and her pond in the north-west, the broken glasshouse
// behind the manor, the old midway down the east side (a carousel, game
// booths) and beyond its fence the Grinmoor Fair park (a pumpkin fountain
// plaza, the Ferris wheel, the midway stalls), Trick-or-Treat Lane
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
import { SURFACES, retexture } from "./surface-textures.js?v=hg6e";
import { portrait } from "./house-props.js?v=hg6e";
import { mapModel, RETEXTURE } from "./map-models.js?v=hg6e";
import { loadModel } from "./battlefield-props.js";
import { buildChapel } from "./hollowgrin-chapel.js?v=hg6tc";
import { placeMannequins } from "./hollowgrin-mannequins.js?v=hg6h";

export const HG_FLOORS = { ground: 0, upper: 3.6, loft: 2.4, wheel: 6.0, mansion: 4.2, brake: 9.0 };
// The barn's loft (x 17.35..20.4 over the west end) is its own floor: by
// height alone a zombie would take it for the manor's upstairs. So is the
// Ferris wheel's lamp deck, and its stair counts as ground until the top.
const BARN_LOFT = { x0: 17.35, x1: 20.4, z0: 20.35, z1: 28.65, y: 2.4 };
export function hgFloorOf(y, x, z) {
  if (x !== undefined) {
    if (y >= 1.6 && x > 17 && x < 29 && z > 20 && z < 29) return "loft";
    if (x > 73.5 && x < 78.5 && z > -9.3 && z < 1) return y >= 4.6 && z < -5 ? "wheel" : "ground";
    if (x > 61 && x < 78 && z > 17.9 && z < 31) return y >= 2.5 ? "mansion" : "ground";
    if (x > 80 && x < 83.4 && z > -37.4 && z < -20.5) return y >= 4.6 && z < -30 ? "brake" : "ground";
  }
  return y >= 2.2 ? "upper" : "ground";
}

const BOUNDS = { minX: -51, maxX: 87, minZ: -45, maxZ: 45 };

// The Grinmoor Fair park (phase 6b on): the strip east of the old midway,
// x 51..87, behind a brick-and-iron fence. Shared with
// models/build_grinmoor.blender.py: change a size there, change it here.
const PARK_X = 51;
const GATE = { z0: 0, z1: 5 };
const PLAZA = { x: 63, z: 2.5, r: 9 };
const FERRIS = { x: 80, z: 2.5, r: 11, hub: 13.2 };
const WHEEL_STAIR = { x0: 76.6, x1: 77.8, zFoot: 0.6, steps: 20, rise: 0.3, run: 0.3 };
const WHEEL_DECK = { x0: 74.0, x1: 78.0, z0: -8.8, z1: -5.4, y: 6.0 };
const BOARDING = { x0: 78.0, x1: 82.4, z0: 0.4, z1: 4.6, y: 0.6 };
const SHACK = { x0: 74.4, x1: 77.0, z0: -8.4, z1: -5.9, h: 2.6 };
const PODIUM = { x: 75.2, z: 5.2 };
const STALL_Z = { back: -11.2, front: -8.2 };
const STALLS = [[53.4, 56.9], [56.9, 60.4], [62.9, 66.4], [66.4, 69.9], [69.9, 73.4]];
// U Mad Mansion (6c): shared with build_grinmoor.blender.py build_mansion.
// Spans are relative to its floor (0.4: under a zombie's 0.45 m step, or
// the flow field would shut the whole house).
const MANSION = { x0: 62, x1: 77, z0: 20.5, z1: 30.5, t: 0.3, floor: 0.4, slab: 3.9, up: 4.2, ceil: 7.6, eave: 7.9 };
const MANSION_GALLERY = { x0: 61.4, x1: 77.6, z0: 18.2, z1: 20.5 };
const MANSION_COLS = [61.6, 63.85, 66.1, 68.35, 70.65, 72.9, 75.15, 77.4];
const MANSION_HOLES = (() => {
  const F = MANSION.floor, W = [0.9, 2.6], D = [0, 2.8], UW = [4.5 - F, 6.1 - F], UD = [4.2 - F, 6.6 - F];
  const h = (c, w, spans) => ({ c, w, spans });
  // one opening per column, both storeys stacked in its spans: wall()
  // can't take openings that overlap along the wall
  return {
    front: [h(63.9, 1.4, [W, UD]), h(66.9, 1.1, [W, UW]), h(69.5, 1.8, [D, UD]), h(72.1, 1.1, [W, UW]), h(75.1, 1.4, [W, UD])],
    back: [h(64.5, 1.1, [UW]), h(68.0, 1.1, [W, UW]), h(71.0, 1.1, [W, UW]), h(75.4, 1.7, [[0, 2.5], UW])],
    west: [h(26.3, 1.1, [W]), h(23.0, 1.1, [UW]), h(27.5, 1.1, [UW])],
    east: [h(22.8, 1.1, [W, UW]), h(27.5, 1.1, [UW])],
  };
})();
// (doorways >= 1.7 m: the zombies' flow field needs a whole free cell through)
const MANSION_PARTS = [["z", 66.0, 20.8, 25.2, [{ c: 21.75, w: 1.7, spans: [[0, 2.4]] }]],
  ["x", 25.2, 62.3, 76.7, [{ c: 63.25, w: 1.8, spans: [[0, 2.4]] }]],
  ["z", 73.0, 25.3, 30.2, [{ c: 26.2, w: 1.7, spans: [[0, 2.4]] }]]];
const MANSION_CLOSET = [64.2, 65.9, 22.7, 25.1];
const MANSION_STAIR = { xFoot: 67.7, z: 28.2, w: 1.2, steps: 14, rise: (4.2 - 0.4) / 14, run: 0.27 };
const MANSION_HOLE = [64.2, 66.4, 27.6, 28.8];
const MANSION_MAZE = [["x", 27.4, 73.1, 74.9], ["x", 28.8, 74.9, 76.7]];
const MANSION_SCARECROW = [59.4, 21.5];
const MANSION_SHEETS = [[64.0, 22.5, 1.8, 1.0, 0.9], [71.5, 23.0, 1.2, 1.3, 1.2], [73.8, 28.6, 2.0, 0.9, 1.0], [68.0, 29.2, 1.6, 1.6, 0.8], [66.6, 29.5, 0.9, 1.1, 0.9]];
const MANSION_TRUNKS = [[66.8, 26.0], [75.6, 21.6], [62.9, 23.0]];
// Skull Mountain + the moat (6d): shared with build_grinmoor.blender.py.
// Rock solids [x0, x1, z0, z1, y0, h] (the last two are the cave path's
// ceilings); the path itself; the waterway's arms, pool, curbs, bridges.
const MOUNT_SOLIDS = [[72.7, 74.0, 30.6, 34.0, 0, 9], [76.2, 80.4, 30.6, 36.2, 0, 11], [80.4, 83.6, 31.6, 36.2, 0, 11],
  [83.6, 87.0, 30.6, 36.2, 0, 10], [72.7, 87.0, 36.2, 45.5, 0, 12], [72.7, 76.2, 34.0, 36.2, 3.2, 7.5], [74.0, 76.2, 30.6, 34.0, 3.2, 6.5]];
// the rock's height: 15 m at the peak, 1.35 m lower per metre out, never
// under 3.2 (4.6 over the cave path, so it keeps a roof); one column per cell
const MOUNT_PEAK = [80.5, 39.5, 15];
const MOUNT_CELL = 1.8;
function mountainH(x, z, ceiling) {
  return Math.max(ceiling ? 4.6 : 3.2, MOUNT_PEAK[2] - 1.35 * Math.hypot(x - MOUNT_PEAK[0], z - MOUNT_PEAK[1]));
}
function mountainCells() {
  const out = [];
  for (const [x0, x1, z0, z1, y0] of MOUNT_SOLIDS) {
    const nx = Math.max(1, Math.round((x1 - x0) / MOUNT_CELL)), nz = Math.max(1, Math.round((z1 - z0) / MOUNT_CELL));
    for (let i = 0; i < nx; i++) {
      for (let k = 0; k < nz; k++) {
        const cx = x0 + ((x1 - x0) * (i + 0.5)) / nx, cz = z0 + ((z1 - z0) * (k + 0.5)) / nz;
        out.push([cx, cz, (x1 - x0) / nx, (z1 - z0) / nz, y0, mountainH(cx, cz, y0 > 0)]);
      }
    }
  }
  return out;
}
const MOUNT_TUNNEL = [[72.7, 76.2, 34.0, 36.2], [74.0, 76.2, 30.6, 34.0]];
const MOUNT_CHUTE = [[74.6, 7.6, 41.1], [70.6, 0.3, 41.1]];
const MOUNT_SKULL = [79.6, 11.6, 38.4, Math.atan2(-0.55, -0.85)];
const MOAT_ARMS = [[54.0, 83.6, 13.5, 16.7], [54.0, 57.2, 16.7, 42.7], [57.2, 64.6, 39.5, 42.7], [80.4, 83.6, 16.7, 31.6]];
const MOAT_POOL = [67.5, 41.1, 3.2];
const MOAT_BRIDGES = [["z", 69.5, 13.5, 16.7, 3.6], ["x", 35.0, 54.0, 57.2, 3.2], ["x", 21.7, 80.4, 83.6, 2.8]];
const MOAT_DECK_Y = 0.55;
const MOAT_CURBS = [["x", 13.375, 53.75, 83.85, [[67.7, 71.3]]], ["z", 53.875, 13.5, 42.95, [[33.4, 36.6]]],
  ["x", 42.825, 54.0, 64.6, []], ["z", 83.725, 13.5, 31.6, [[20.3, 23.1]]],
  ["x", 16.825, 57.2, 80.4, [[67.7, 71.3]]], ["z", 57.325, 16.7, 39.5, [[33.4, 36.6]]],
  ["x", 39.375, 57.2, 64.6, []], ["z", 80.275, 16.7, 30.6, [[20.3, 23.1]]]];
// the water you wade through: the U of the channel and the pool
const MOAT_WADE = [[54, 13.5], [83.6, 13.5], [83.6, 31.6], [80.4, 31.6], [80.4, 16.7], [57.2, 16.7], [57.2, 39.5], [64.6, 39.5],
  [65.4, 38.2], [67.5, 37.9], [69.6, 38.2], [70.5, 39.2], [70.7, 41.1], [70.5, 43.0], [69.6, 44.0], [67.5, 44.3], [65.4, 44.0], [64.6, 42.7], [54, 42.7]];
// The Grinder (6e): its brake deck at 9 m and the stair up to it; the drop tower.
const COASTER_DECK = { x0: 80.2, x1: 83.2, z0: -37.2, z1: -30.4, y: 9.0 };
const COASTER_STAIR = { x0: 81.6, x1: 82.8, zFoot: -21.4, steps: 30, rise: 0.3, run: 0.3 };
const COASTER_TOWER = [85, -43.5];
// shots that land on the map, for things that react to them (the tin trolls)
const SHOT_HOOKS = [];
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

/* ============================================================ the night look */

/* Ground fog: the scene fog thickens near the ground, so the graveyard,
   the patch and the low ground sit in a haze with the tops clear. One
   shared uniform: (strength, base y, falloff metres, build-up per metre of
   view distance), so it costs one line per fragment and no layers.
   Colour wash (`material.userData.wash`: { color, top, strength }): a
   coloured glow, strongest at a surface's foot and gone by `top` metres up,
   like a flood lamp on the ground aimed up. No real lights: the map keeps
   its few (see light-pool.js on why). */
const GROUND_FOG = { value: new THREE.Vector4(0.5, 0.0, 1.5, 0.05) };

function nightFx(mat) {
  if (!mat || mat.userData.nightFx || mat.isShaderMaterial || mat.isPointsMaterial || mat.isSpriteMaterial) return;
  if (mat.blending === THREE.AdditiveBlending || mat.fog === false) return;
  mat.userData.nightFx = true;
  const wash = mat.isMeshBasicMaterial ? null : mat.userData.wash;
  const prev = mat.onBeforeCompile;
  const own = mat.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey;
  const prevKey = own ? mat.customProgramCacheKey() : prev ? prev.toString() : "";
  const c = wash ? new THREE.Color(wash.color) : null;
  const washKey = wash ? `${wash.color}-${wash.top}-${wash.strength}` : "";
  const f = (v) => v.toFixed(4);
  mat.onBeforeCompile = function (sh, r) {
    prev?.call(this, sh, r);
    sh.uniforms.uGroundFog = GROUND_FOG;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vHgY;")
      .replace("#include <project_vertex>", `#include <project_vertex>
        { vec4 hgW = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          hgW = instanceMatrix * hgW;
        #endif
          vHgY = ( modelMatrix * hgW ).y; }`);
    let fs = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vHgY;\nuniform vec4 uGroundFog;")
      .replace("#include <fog_fragment>", `#ifdef USE_FOG
        #ifdef FOG_EXP2
          float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
        #else
          float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
        #endif
          float hgLow = uGroundFog.x * exp( - max( vHgY - uGroundFog.y, 0.0 ) / uGroundFog.z ) * ( 1.0 - exp( - vFogDepth * uGroundFog.w ) );
          fogFactor = 1.0 - ( 1.0 - fogFactor ) * ( 1.0 - hgLow );
          gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
        #endif`);
    if (wash) {
      fs = fs.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3( ${f(c.r)}, ${f(c.g)}, ${f(c.b)} ) * ${f(wash.strength)} * ( 1.0 - smoothstep( ${f(wash.base ?? 0)}, ${f(wash.top)}, vHgY ) );`);
    }
    sh.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => `${prevKey}|hgfx${washKey}`;
  mat.needsUpdate = true;
}

/* A modelled building (models/build_hollowgrin.blender.py), in map
   coordinates. `wash` tints its materials; `bounce` lifts the named
   (Blender) materials' own texture, for interiors the moon can't reach. */
function hgModel(api, name, { wash = null, bounce = {}, parent = null, then = null } = {}) {
  return loadModel(name, {}).then((obj) => {
    obj.traverse((n) => { if (n.isMesh) n.userData.blenderMat = n.material.name; });
    retexture(obj, RETEXTURE);
    obj.traverse((n) => {
      if (!n.isMesh) return;
      const m = n.material;
      const b = bounce[n.userData.blenderMat];
      if (b && m.map) {
        m.emissive = m.color.clone().multiplyScalar(b);
        m.emissiveMap = m.map;
      }
      if (wash) m.userData.wash = wash;
      nightFx(m);
    });
    if (parent) parent.add(obj);
    else api.prop(obj);
    then?.(obj);
    return obj;
  });
}

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
      g.fillText(t, w / 2, y, w - 64);   // squeezed to fit inside the frame
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

/* An iron candle lantern standing at (x, y, z), or hanging `hang` metres
   under a hook. Its light is all fake: a lit glass, a candle flame, a halo
   and a warm pool on the floor at `floor`. Decoration only: no collider. */
function lantern(K, M, x, y, z, { hang = 0, floor = 0, seed = 1, pool = 2.4 } = {}) {
  const phase = rng(seed)();
  K.box(M.iron, x, y, z, 0.2, 0.03, 0.2);
  for (const [dx, dz] of [[-0.085, -0.085], [0.085, -0.085], [-0.085, 0.085], [0.085, 0.085]]) K.box(M.iron, x + dx, y, z + dz, 0.02, 0.28, 0.02);
  K.box(M.lampGlass, x, y + 0.03, z, 0.15, 0.22, 0.15, {}, { shadow: false });
  K.cyl(M.iron, x, y + 0.28, z, 0.14, 0.03, 0.12, 4, { ry: Math.PI / 4 });
  K.add(M.iron, place(new THREE.TorusGeometry(0.05, 0.01, 4, 10), { x, y: y + 0.44, z }));
  if (hang) K.cyl(M.iron, x, y + 0.48, z, 0.006, 0.006, hang - 0.48, 4);
  for (const ry of [0, Math.PI / 2]) K.add(M.flame, place(new THREE.PlaneGeometry(0.06, 0.12), { x, y: y + 0.13, z, ry }), { phase, shadow: false });
  K.sparks?.add(x, y + 0.14, z, 0xffb86a, { size: 0.65, blink: 0.06 });
  if (pool) K.add(M.lanternPool, place(new THREE.PlaneGeometry(pool, pool), { x, y: floor + 0.03, z, rx: -Math.PI / 2 }), { shadow: false, phase });
}

/* A few candles of different heights melted onto a grave or a step, with a
   small warm pool round them. */
function candleCluster(K, M, x, y, z, { n = 4, seed = 1 } = {}) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, d = 0.06 + R() * 0.16;
    candle(K, M, x + Math.cos(a) * d, y, z + Math.sin(a) * d, { h: 0.1 + R() * 0.22, r: 0.03 + R() * 0.02, seed: seed * 7 + i });
  }
  K.add(M.lanternPool, place(new THREE.PlaneGeometry(1.4, 1.4), { x, y: y + 0.02, z, rx: -Math.PI / 2 }), { shadow: false, phase: R() });
  K.sparks?.add(x, y + 0.3, z, 0xffb060, { size: 0.7, blink: 0.1 });
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
    // out round the south of the map to the moat and back the same way: a
    // doubled edge cancels under even-odd, so the two shapes stay separate
    [W, 47], [MOAT_WADE[0][0], 47], ...MOAT_WADE, MOAT_WADE[0], [MOAT_WADE[0][0], 47], [W, 47], [W, ring[0][1] + 0.02],
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

/* The mausoleum's arched window: diamond quarries of coloured glass in
   lead, a trollface in amber in the middle. Transparent round the arch. */
function stainedTexture() {
  return tex("stained", () => {
    const W = 256, H = 432, c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    const R = rng(66);
    const r = W / 2;
    const arch = () => { g.beginPath(); g.moveTo(0, H); g.lineTo(0, r); g.arc(r, r, r, Math.PI, 0); g.lineTo(W, H); g.closePath(); };
    g.save();
    arch();
    g.clip();
    const glass = ["#3a1f6a", "#1f5a3a", "#6a2a8a", "#2a3a7a", "#7a1a2a", "#245a4a", "#5a3a8a"];
    const s = 36;
    for (let y = -s; y < H + s; y += s / 2) {
      for (let x = -s; x < W + s; x += s) {
        const ox = ((y / (s / 2)) % 2) ? s / 2 : 0;
        g.fillStyle = glass[Math.floor(R() * glass.length)];
        g.beginPath();
        g.moveTo(x + ox, y - s / 2); g.lineTo(x + ox + s / 2, y); g.lineTo(x + ox, y + s / 2); g.lineTo(x + ox - s / 2, y);
        g.closePath(); g.fill();
        g.strokeStyle = "#0b0a0c"; g.lineWidth = 4; g.stroke();
      }
    }
    g.fillStyle = "#1c0c2a";
    g.beginPath(); g.arc(W / 2, H * 0.48, 82, 0, Math.PI * 2); g.fill();
    g.lineWidth = 8; g.strokeStyle = "#0b0a0c"; g.stroke();
    g.restore();
    arch();
    g.lineWidth = 10; g.strokeStyle = "#0b0a0c"; g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const img = new Image();
    img.onload = () => {
      const k = document.createElement("canvas");
      k.width = k.height = 150;
      const kg = k.getContext("2d");
      const sc = Math.min(140 / img.width, 140 / img.height);
      kg.drawImage(img, (150 - img.width * sc) / 2, (150 - img.height * sc) / 2, img.width * sc, img.height * sc);
      const d = kg.getImageData(0, 0, 150, 150), px = d.data;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] < 100) { px[i + 3] = 0; continue; }
        const lum = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
        if (lum < 110) { px[i] = 12; px[i + 1] = 10; px[i + 2] = 12; } else { px[i] = 255; px[i + 1] = 214; px[i + 2] = 130; }
        px[i + 3] = 255;
      }
      kg.putImageData(d, 0, 0);
      g.drawImage(k, W / 2 - 75, H * 0.48 - 75);
      t.needsUpdate = true;
    };
    img.src = new URL("../../images/wallpaper/trollface%20transparent.png", import.meta.url).href;
    return t;
  });
}

/* A cobweb strung across a corner: spokes and a sagging spiral. */
function webTexture() {
  return tex("web", () => canvasTex(256, 180, (g, W, H) => {
    g.strokeStyle = "rgba(230,230,240,.55)";
    g.lineWidth = 1.4;
    const cx = W / 2, cy = 8;
    const spokes = 9;
    for (let i = 0; i <= spokes; i++) {
      const a = Math.PI * (0.04 + 0.92 * i / spokes);
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 200, cy + Math.sin(a) * 200); g.stroke();
    }
    for (let ring = 1; ring < 9; ring++) {
      const rr = ring * 19;
      g.beginPath();
      for (let i = 0; i <= spokes; i++) {
        const a = Math.PI * (0.04 + 0.92 * i / spokes);
        const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
        if (i === 0) g.moveTo(px, py);
        else {
          const ap = Math.PI * (0.04 + 0.92 * (i - 0.5) / spokes);
          g.quadraticCurveTo(cx + Math.cos(ap) * rr * 0.86, cy + Math.sin(ap) * rr * 0.86, px, py);
        }
      }
      g.stroke();
    }
  }));
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


/* Everything round the old village: the chapel, the witch's hollow, the
   glasshouse, the old midway and its carousel, Trick-or-Treat Lane with the
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

  /* ------------------------------------------- St. Grinsworth's chapel (hollowgrin-chapel.js) */
  buildChapel(api, K, M, SP, root, lights, { place, wall, rodGeo, prismGeo, candle, jack, headstoneGeo, signTexture, surfMat, texMat, flickerMat, rng, ZSPAWNS });

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
      // the still parts (drum, canopy, rounding boards) and the turning deck
      // are modelled (models/build_grinmoor.blender.py); the bulbs are ours
      hgModel(api, "hg-carousel", { wash: { color: 0xff5a3a, top: 2.5, strength: 0.08 } });
      for (const [n, y, rr] of [[32, 4.7, r + 0.66], [32, 3.8, r + 0.64]]) {
        for (let i = 0; i < n; i++) {
          const a = ((i + (y < 4 ? 0.5 : 0)) / n) * Math.PI * 2, x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
          const col = BULBS[i % BULBS.length];
          K.add(M.bulb, place(new THREE.OctahedronGeometry(0.06), { x, y, z }), { color: col, shadow: false });
          SP.add(x, y, z, col, { size: 0.45, blink: 0.25 });
        }
      }
      // the turning part: deck, poles and pumpkin coaches in one model, the
      // eight horses instanced off another and bobbing on their poles
      const spin = new THREE.Group();
      spin.position.set(cx, 0, cz);
      root.add(spin);
      hgModel(api, "hg-carousel-ride", { parent: spin });
      let horses = null;
      loadModel("hg-horse", {}).then((obj) => {
        let src = null;
        obj.traverse((n) => { if (n.isMesh && !src) src = n; });
        if (!src) return;
        nightFx(src.material);
        horses = new THREE.InstancedMesh(src.geometry, src.material, 8);
        horses.castShadow = true;
        horses.frustumCulled = false;
        spin.add(horses);
      });
      spin.add(ticker(() => {
        const t = performance.now() / 1000;
        spin.rotation.y = -t * 0.35;
        if (!horses) return;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          _e.set(0, -a - Math.PI / 2, 0);
          _q.setFromEuler(_e);
          _m4.compose(_p.set(Math.cos(a) * 3.3, 1.35 + 0.28 * Math.sin(t * 2.2 + i * 1.7), Math.sin(a) * 3.3), _q, _s.set(1, 1, 1));
          horses.setMatrixAt(i, _m4);
        }
        horses.instanceMatrix.needsUpdate = true;
      }, M.iron));
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

/* ================================================== the Grinmoor Fair park */

/* Granite setts, four courses to the texture, each a row of stones of
   uneven length that wraps left to right; laid in rings round the fountain
   (settsRing) and in straight runs (settsRect). One course is 0.42 m. */
function settsTexture() {
  return tex("setts", () => canvasTex(512, 512, (g, w, h) => {
    const R = rng(77);
    g.fillStyle = "#1e1b1a";
    g.fillRect(0, 0, w, h);
    const rh = h / 4;
    for (let r = 0; r < 4; r++) {
      let x = R() * 60;
      const x0 = x;
      while (x < x0 + w - 30) {
        const len = Math.min(52 + R() * 34, x0 + w - x);
        const l = 92 + R() * 46, warm = R() * 10;
        for (const ox of [0, -w]) {
          const sx = x + ox + 3, sy = r * rh + 3, sw = len - 6, sh = rh - 6;
          g.fillStyle = `rgb(${l + warm | 0},${l + 2 | 0},${l + 8 - warm | 0})`;
          g.beginPath();
          g.roundRect(sx, sy, sw, sh, 9);
          g.fill();
          g.fillStyle = "rgba(255,255,255,.08)";
          g.fillRect(sx + 4, sy + 3, sw - 8, 4);
          g.fillStyle = "rgba(0,0,0,.18)";
          g.fillRect(sx + 4, sy + sh - 7, sw - 8, 5);
          for (let k = 0; k < 14; k++) {
            g.fillStyle = R() < 0.5 ? "rgba(0,0,0,.14)" : "rgba(255,255,255,.07)";
            g.fillRect(sx + R() * sw, sy + R() * sh, 2 + R() * 3, 2 + R() * 3);
          }
        }
        x += len;
      }
    }
  }, { repeat: true }));
}

/* Rings of setts from r0 out to r1 round (cx, cz), each course its own ring
   with a whole number of texture repeats round it, so it closes cleanly. */
function settsRing(K, mat, cx, cz, r0, r1, { y = 0.016 } = {}) {
  const pos = [], uv = [], nrm = [];
  const band = 0.42;
  for (let k = 0; r0 + k * band < r1 - 0.01; k++) {
    const ri = r0 + k * band, ro = Math.min(r1, ri + band);
    const reps = Math.max(1, Math.round((2 * Math.PI * (ri + ro) / 2) / 3.4));
    const seg = Math.max(24, Math.ceil((2 * Math.PI * ro) / 0.5));
    const v0 = (k % 4) / 4, v1 = v0 + (ro - ri) / band / 4;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const u0 = (i / seg) * reps, u1 = ((i + 1) / seg) * reps;
      const P = (r, a) => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
      const quad = [[P(ri, a0), u0, v0], [P(ri, a1), u1, v0], [P(ro, a1), u1, v1], [P(ri, a0), u0, v0], [P(ro, a1), u1, v1], [P(ro, a0), u0, v1]];
      for (const [p, u, v] of quad) { pos.push(...p); uv.push(u, v); nrm.push(0, 1, 0); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  K.add(mat, g, { shadow: false });
}

/* A straight run of setts, courses along x. */
function settsRect(K, mat, x0, x1, z0, z1, { y = 0.017 } = {}) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  const uv = g.attributes.uv.array, pos = g.attributes.position.array;
  for (let i = 0; i < uv.length / 2; i++) {
    uv[i * 2] = (pos[i * 3] + (x0 + x1) / 2) / 3.4;
    uv[i * 2 + 1] = (pos[i * 3 + 1] - (z0 + z1) / 2) / 1.68;
  }
  K.add(mat, place(g, { x: (x0 + x1) / 2, y, z: (z0 + z1) / 2, rx: -Math.PI / 2 }), { shadow: false });
}

/* Soft rings of light on black: the fountain water's moving sparkle. */
function rippleTexture() {
  return tex("ripple", () => canvasTex(256, 256, (g, w, h) => {
    const R = rng(13);
    g.fillStyle = "#000";
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 60; i++) {
      const x = R() * w, y = R() * h, r = 6 + R() * 30;
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
        g.strokeStyle = `rgba(255,255,255,${0.05 + R() * 0.12})`;
        g.lineWidth = 1 + R() * 2.5;
        g.beginPath();
        g.ellipse(x + ox, y + oy, r, r * 0.8, 0, 0, Math.PI * 2);
        g.stroke();
      }
    }
  }, { repeat: true }));
}

/* The moat's glow: a lit teal-grey base with brighter rings drifting on it. */
function glowRippleTexture() {
  return tex("glowRipple", () => canvasTex(256, 256, (g, w, h) => {
    const R = rng(17);
    g.fillStyle = "#4a4a4a";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const x = R() * w, y = R() * h, r = 6 + R() * 28;
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
        g.strokeStyle = `rgba(255,255,255,${0.12 + R() * 0.25})`;
        g.lineWidth = 1 + R() * 3;
        g.beginPath();
        g.ellipse(x + ox, y + oy, r, r * 0.7, 0, 0, Math.PI * 2);
        g.stroke();
      }
    }
  }, { repeat: true }));
}

/* Falling water: thin bright streaks on black, for additive sheets. */
function streamTexture() {
  return tex("stream", () => canvasTex(128, 256, (g, w, h) => {
    const R = rng(29);
    g.fillStyle = "#000";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const x = R() * w, a = 0.15 + R() * 0.5, len = 40 + R() * 160, y = R() * h;
      const grad = g.createLinearGradient(0, y, 0, y + len);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(0.5, `rgba(255,255,255,${a})`);
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      for (const oy of [-h, 0]) g.fillRect(x, y + oy, 1 + R() * 2, len);
    }
  }, { repeat: true }));
}

/* A round footprint as AABB colliders: the disc cut into horizontal bands,
   each band as wide as the circle at its inner edge plus a hair. */
function discCollider(api, x, z, r, h, { y = 0, pen = 4 } = {}) {
  const cuts = [0, 0.38, 0.68, 0.88, 1];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i] * r, b = cuts[i + 1] * r;
    const half = Math.sqrt(Math.max(r * r - a * a, 0)) + 0.02;
    if (i === 0) api.ghostBox(x, z, half * 2, b * 2, h, { y, pen });
    else for (const s of [-1, 1]) api.ghostBox(x, z + s * (a + b) / 2, half * 2, b - a, h, { y, pen });
  }
}

/* The park's fence, along x = PARK_X: brick piers about every 6 m with
   stone caps (a pumpkin on every other one), a low brick wall between them
   and black iron bars with gold spear tips above it. Bodies stop at it;
   bullets go through the bars but not the brick. */
function parkFence(K, M, z0, z1, gaps) {
  const x = PARK_X;
  let pier = 0;
  const pierAt = (z) => {
    K.solid(x, z, 0.7, 0.7, 2.6, { mat: M.brick, pen: 8 });
    K.box(M.stone, x, 0, z, 0.82, 0.3, 0.82);
    K.box(M.stone, x, 2.6, z, 0.86, 0.12, 0.86);
    K.box(M.stone, x, 2.72, z, 0.64, 0.08, 0.64);
    if (pier++ % 2) jack(K, M, x, 2.8, z, { r: 0.24, face: -Math.PI / 2, seed: 6100 + pier, glow: false });
    else K.add(M.stone, place(new THREE.SphereGeometry(0.18, 10, 8), { x, y: 2.98, z }));
  };
  for (const [a, b] of runs(z0, z1, gaps)) {
    const len = b - a;
    if (len < 0.8) continue;
    const n = Math.max(1, Math.round(len / 6));
    const ps = [];
    for (let i = 0; i <= n; i++) ps.push(Math.min(b - 0.35, Math.max(a + 0.35, a + (len * i) / n)));
    for (const p of ps) pierAt(p);
    for (let i = 0; i < n; i++) {
      const s = ps[i] + 0.35, e = ps[i + 1] - 0.35, c = (s + e) / 2, L = e - s;
      if (L < 0.1) continue;
      K.solid(x, c, 0.4, L, 0.6, { mat: M.brick, pen: 8 });
      K.box(M.stone, x, 0.6, c, 0.5, 0.08, L);
      K.api.ghostBox(x, c, 0.12, L, 1.75, { y: 0.68, pen: 0.25 });
      for (const ry of [0.86, 2.18]) K.box(M.iron, x, ry, c, 0.05, 0.05, L, {}, { shadow: false });
      const bars = Math.round(L / 0.13);
      for (let k = 0; k <= bars; k++) {
        const z = s + (L * k) / bars;
        K.box(M.iron, x, 0.68, z, 0.025, 1.72, 0.025, {}, { shadow: false });
        K.cyl(M.gold, x, 2.4, z, 0.035, 0, 0.12, 4, {}, { shadow: false });
      }
    }
  }
}

/* The park east of the old midway: the fence and its main gate, the plaza
   with the pumpkin fountain, the Ferris wheel behind it and the midway
   stalls along the plaza's north side. The modelled pieces are in
   models/build_grinmoor.blender.py; colliders, glow and motion are here. */
function buildPark(api, K, M, SP, root, lights) {
  const sign = (lines, o) => new THREE.MeshBasicMaterial({ map: signTexture(lines, o), color: 0xffffff });

  /* ------------------------------------------- the fence and the gates */
  const gaps = [[-40, -37.5], [GATE.z0 - 1.1, GATE.z1 + 1.1], [LANE.z0 - 0.4, LANE.z1 + 0.4]];
  parkFence(K, M, BOUNDS.minZ - 0.2, BOUNDS.maxZ + 0.2, gaps);
  {
    const x = PARK_X, gz = (GATE.z0 + GATE.z1) / 2;
    // two tall piers with lanterns on brackets and big jacks on top
    for (const [z, k] of [[GATE.z0 - 0.55, 0], [GATE.z1 + 0.55, 1]]) {
      K.solid(x, z, 1.1, 1.1, 4.0, { mat: M.brick, pen: 10 });
      K.box(M.stone, x, 0, z, 1.26, 0.4, 1.26);
      K.box(M.stone, x, 1.9, z, 1.18, 0.1, 1.18);
      K.box(M.stone, x, 4.0, z, 1.3, 0.16, 1.3);
      K.box(M.stone, x, 4.16, z, 1.0, 0.1, 1.0);
      jack(K, M, x, 4.26, z, { r: 0.42, face: -Math.PI / 2, seed: 6200 + k, glow: false });
      for (const s of [-1, 1]) {
        K.box(M.iron, x + s * 0.7, 2.75, z, 0.3, 0.04, 0.04);
        lantern(K, M, x + s * 0.86, 2.3, z, { hang: 0.45, floor: 0, seed: 6210 + k * 2 + s, pool: 3.2 });
      }
    }
    // the iron arch over the opening, with the sign and a string of bulbs
    const za = GATE.z0, zb = GATE.z1, n = 14;
    const arch = (lift) => Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n;
      return [x, 4.05 + lift + 1.15 * Math.sin(Math.PI * t), za + (zb - za) * t];
    });
    const inner = arch(0), outer = arch(0.55);
    for (const line of [inner, outer]) {
      for (let i = 0; i < n; i++) K.add(M.iron, rodGeo(line[i], line[i + 1], 0.045, 5));
    }
    for (let i = 1; i < n; i += 1) K.add(M.iron, rodGeo(inner[i], outer[i], 0.02, 4), { shadow: false });
    const title = sign(["GRINMOOR FAIR"], { bg: "#1a0c14", fg: "#ffcf5a", edge: "#c0283a" });
    for (const [ox, ry] of [[-0.06, -Math.PI / 2], [0.06, Math.PI / 2]]) {
      K.add(title, place(new THREE.PlaneGeometry(4.4, 0.78), { x: x + ox, y: 5.05, z: gz, ry }), { shadow: false });
    }
    K.box(M.iron, x, 4.62, gz, 0.08, 0.06, 4.6);
    K.box(M.iron, x, 5.46, gz, 0.08, 0.06, 4.6);
    festoon(K, M, SP, outer.map(([px, py, pz]) => [px - 0.02, py + 0.08, pz]), { sag: 0, every: 0.36, seed: 61 });
    // the gate leaves, swung right open against the inside of the opening
    for (const z of [GATE.z0 + 0.1, GATE.z1 - 0.1]) {
      const x0 = x + 0.62, x1 = x + 3.0;
      K.api.ghostBox((x0 + x1) / 2, z, x1 - x0, 0.1, 2.3, { pen: 0.25 });
      for (const y of [0.15, 1.1, 2.1]) K.box(M.iron, (x0 + x1) / 2, y, z, x1 - x0, 0.06, 0.05);
      for (let k = 0; k <= 18; k++) {
        const bx = x0 + ((x1 - x0) * k) / 18;
        const top = 2.1 + 0.25 * Math.sin((Math.PI * k) / 18);
        K.box(M.iron, bx, 0.15, z, 0.025, top - 0.15, 0.025, {}, { shadow: false });
        K.cyl(M.gold, bx, top, z, 0.03, 0, 0.1, 4, {}, { shadow: false });
      }
      K.add(M.gold, place(new THREE.TorusGeometry(0.28, 0.025, 5, 16), { x: (x0 + x1) / 2, y: 1.6, z }), { shadow: false });
    }
    // the way in from the old midway, paved from the gate to the plaza
    flat(K, M.dirt, 45.7, gz, 9.6, 3.2, { y: 0.013 });
    settsRect(K, M.setts, x - 0.6, PLAZA.x - PLAZA.r + 0.4, GATE.z0 - 0.2, GATE.z1 + 0.2);
    K.add(sign(["STAFF ONLY"], { w: 512, h: 128, bg: "#e8dcc0", fg: "#8a1a1a", edge: "#8a1a1a" }),
      place(new THREE.PlaneGeometry(0.9, 0.24), { x: x - 0.37, y: 1.6, z: -37.15, ry: -Math.PI / 2 }), { shadow: false });
  }

  /* ------------------------------------------- the plaza and its fountain */
  {
    const { x: fx, z: fz, r } = PLAZA;
    settsRing(K, M.setts, fx, fz, 3.6, r);
    // a paved way on to the wheel's boarding steps, and to the stalls' alley
    settsRect(K, M.setts, fx + r - 0.5, BOARDING.x0 - 1.2, GATE.z0 + 0.4, GATE.z1 - 0.4);
    flat(K, M.dirt, 61.65, -8.6, 2.5, 6.2, { y: 0.013 });

    hgModel(api, "hg-fountain", { wash: { color: 0xff7a5a, top: 1.6, strength: 0.07 } });
    discCollider(api, fx, fz, 3.75, 1.12, { pen: 0.4 });   // the curb and its fence
    discCollider(api, fx, fz, 2.1, 1.8, { pen: 6 });       // the first bowl
    K.solid(fx, fz, 0.9, 0.9, 5.6, { pen: 10 });           // the column and the troll
    // water: the pool, three bowls, and the sheets falling between them
    for (const [y, rr] of [[0.36, 3.31], [1.66, 1.92], [2.94, 1.24], [3.66, 0.64]]) {
      K.add(M.fountainWater, place(new THREE.CircleGeometry(rr, 40), { x: fx, y, z: fz, rx: -Math.PI / 2 }), { shadow: false });
    }
    for (const [r0, r1, y0, y1] of [[2.13, 2.32, 1.74, 0.36], [1.38, 1.5, 3.0, 1.66], [0.76, 0.86, 3.72, 2.94]]) {
      K.add(M.fall, place(new THREE.CylinderGeometry(r0, r1, y0 - y1, 40, 1, true), { x: fx, y: (y0 + y1) / 2, z: fz }), { shadow: false });
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        SP.add(fx + Math.cos(a) * r1, y1 + 0.06, fz + Math.sin(a) * r1, 0xc8f4ff, { size: 0.32, wander: 0.08, blink: 0.7 });
      }
    }
    root.add(ticker(() => {
      const t = performance.now() / 1000;
      M.fall.map.offset.y = t * 0.9;
      M.fountainWater.emissiveMap.offset.set(t * 0.03, t * 0.05);
    }, M.iron));
    // the bronze troll's face, and the lantern it holds up
    K.add(M.bronzeFace, place(new THREE.PlaneGeometry(0.4, 0.4), { x: fx - 0.225, y: 5.39, z: fz, ry: -Math.PI / 2 }), { shadow: false });
    SP.add(fx - 0.08, 5.8, fz + 0.52, 0xffc27a, { size: 1.6, blink: 0.06 });
    // five giant jack-o'-lanterns round the curb, grinning outward
    for (const [deg, k] of [[180, 0], [108, 1], [252, 2], [36, 3], [324, 4]]) {
      const a = THREE.MathUtils.degToRad(deg), x = fx + Math.cos(a) * 4.5, z = fz + Math.sin(a) * 4.5;
      jack(K, M, x, 0, z, { r: k ? 0.55 : 0.68, face: Math.atan2(Math.cos(a), Math.sin(a)), seed: 6300 + k });
      K.api.ghostBox(x, z, k ? 1.0 : 1.2, k ? 1.0 : 1.2, k ? 0.85 : 1.05, { pen: 2 });
    }
    const l = new THREE.PointLight(0xff8a5a, 7, 15, 2);
    l.position.set(fx - 1.5, 2.6, fz);
    lights.push(l);

    // benches facing the fountain, lamp posts with banners
    hgModel(api, "hg-plaza");
    for (const deg of [40, 90, 140, 220, 270, 320]) {
      const t = THREE.MathUtils.degToRad(deg), x = fx + Math.cos(t) * 7.3, z = fz + Math.sin(t) * 7.3;
      const ry = Math.atan2(Math.cos(t), Math.sin(t)) + Math.PI;
      for (const o of [-0.65, 0, 0.65]) K.api.ghostBox(x + Math.cos(ry) * o, z - Math.sin(ry) * o, 0.5, 0.5, 0.46, { pen: 1 });
    }
    for (let i = 0; i < 8; i++) {
      const t = ((i + 0.5) / 8) * Math.PI * 2, x = fx + Math.cos(t) * 8.3, z = fz + Math.sin(t) * 8.3;
      K.api.ghostBox(x, z, 0.32, 0.32, 3.6, { pen: 3 });
      const f = t + Math.PI / 2;
      for (const s of [-1, 1]) SP.add(x + Math.cos(f) * 0.5 * s, 3.27, z + Math.sin(f) * 0.5 * s, 0xffc27a, { size: 1.1, blink: 0.05 });
      K.add(M.lanternPool, place(new THREE.PlaneGeometry(4.4, 4.4), { x, y: 0.03, z, rx: -Math.PI / 2 }), { shadow: false, phase: i * 0.13 });
    }
  }

  /* ------------------------------------------- the Ferris wheel */
  {
    const { x: fx, z: fz, r, hub } = FERRIS;
    hgModel(api, "hg-wheelbase", { wash: { color: 0x9a6aff, top: 3, strength: 0.06 } });
    for (const s of [-1, 1]) {
      for (const dz of [-1, 1]) {
        K.solid(fx + s * 1.6, fz + dz * 5, 0.8, 0.8, 0.35, { pen: 8 });
        K.solid(fx + s * 1.53, fz + dz * 4.7, 0.4, 0.6, 2.2, { pen: 10 });
      }
    }
    K.solid(fx + 2.6, fz, 1.6, 2.0, 1.5, { pen: 8 });                 // the motor house
    // the boarding deck and its two steps
    const B = BOARDING, bz = (B.z0 + B.z1) / 2;
    K.solid((B.x0 + B.x1) / 2, bz, B.x1 - B.x0, B.z1 - B.z0, B.y, { pen: 8 });
    // (z 2.0..4.2: clear of the stair's foot, where zombies step off the climb)
    for (const k of [0, 1]) K.api.ghostBox(B.x0 - 0.3 - 0.6 * (1 - k), 3.1, 0.6, 2.2, 0.2 * (k + 1), { pen: 4 });
    for (const z of [B.z0 + 0.05, B.z1 - 0.05]) K.api.ghostBox((B.x0 + 1.2 + B.x1) / 2, z, B.x1 - B.x0 - 1.2, 0.08, 1.0, { y: B.y, pen: 0.3 });
    K.api.ghostBox(B.x1 - 0.05, bz, 0.08, B.z1 - B.z0, 1.0, { y: B.y, pen: 0.3 });
    // the stair up to the lamp deck (solid to the ground: lattice under it)
    const S = WHEEL_STAIR;
    api.stairs((S.x0 + S.x1) / 2, S.zFoot, S.x1 - S.x0, S.steps, S.rise, S.run, "-z", { ghost: true });
    // the deck, its posts and rails; the operator's shack under it, boxed
    // in up to the deck with lattice so there's no roof to hide on
    const D = WHEEL_DECK, dcx = (D.x0 + D.x1) / 2, dcz = (D.z0 + D.z1) / 2;
    K.solid(dcx, dcz, D.x1 - D.x0, D.z1 - D.z0, 0.25, { y: D.y - 0.25, pen: 6 });
    for (const x of [D.x0 + 0.15, D.x1 - 0.15]) for (const z of [D.z0 + 0.15, D.z1 - 0.15]) K.solid(x, z, 0.22, 0.22, D.y - 0.25, { pen: 8 });
    const rail = { y: D.y, pen: 0.3 };
    K.api.ghostBox(dcx, D.z0 + 0.03, D.x1 - D.x0, 0.08, 1.05, rail);
    K.api.ghostBox(D.x0 + 0.03, dcz, 0.08, D.z1 - D.z0, 1.05, rail);
    K.api.ghostBox(D.x1 - 0.03, dcz, 0.08, D.z1 - D.z0, 1.05, rail);
    K.api.ghostBox((D.x0 + S.x0) / 2, D.z1 - 0.03, S.x0 - D.x0, 0.08, 1.05, rail);
    const H = SHACK;
    K.solid((H.x0 + H.x1) / 2, (H.z0 + H.z1) / 2, H.x1 - H.x0, H.z1 - H.z0, D.y - 0.25, { pen: 8 });
    K.api.ghostBox((H.x0 + H.x1) / 2 + 0.2, H.z1 + 0.25, 0.6, 0.4, 1.0, { pen: 4 });
    K.solid(PODIUM.x, PODIUM.z, 0.9, 0.7, 1.1, { pen: 4 });
    K.add(sign(["RIDE THE", "GRIN WHEEL"], { w: 512, h: 256, bg: "#1a0c14", fg: "#ffcf5a", edge: "#9a6aff" }),
      place(new THREE.PlaneGeometry(0.8, 0.4), { x: PODIUM.x + 0.4, y: 2.45, z: PODIUM.z - 0.3, ry: -Math.PI / 2 }), { shadow: false });
    for (const s of [-1, 1]) SP.add(D.x1 - 0.35 + 0.45 * s, D.y + 3.06, D.z0 + 0.62, 0xfff0c8, { size: 1.8, blink: 0.02 });
    lantern(K, M, (H.x0 + H.x1) / 2 - 0.3, 2.2, H.z1 + 0.18, { hang: 0.3, floor: 0, seed: 6400, pool: 3 });

    // the wheel itself: rims, spokes, bulbs, turning; the cabins hang level
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

  /* ------------------------------------------- the midway stalls */
  {
    hgModel(api, "hg-stalls", { wash: { color: 0xff5a3a, top: 1.2, strength: 0.04 } });
    const { back: zb, front: zf } = STALL_Z, zm = (zb + zf) / 2;
    const looks = [["BALLOON POP", "#ffcf5a", "#c0283a"], ["SHOOTING GALLERY", "#7affe0", "#2a8a86"], ["HOOK-A-PEPE", "#b8ff6a", "#2e5a3a"],
      ["COTTON CANDY", "#ffb0e0", "#a03a8a"], ["CORN DOGS", "#ffb347", "#e0762a"]];
    STALLS.forEach(([x0, x1], i) => {
      const cx = (x0 + x1) / 2, w = x1 - x0, cw = w - 1.0;
      K.solid(cx, zb + 0.1, w, 0.2, 3.0, { pen: 8 });
      for (const x of [x0 + 0.1, x1 - 0.1]) K.solid(x, zm, 0.2, zf - zb, 2.9, { pen: 6 });
      K.solid(x0 + 0.1 + cw / 2, zf - 0.25, cw, 0.5, 1.03, { pen: 4 });
      K.solid(cx, zm, w + 0.2, zf - zb + 0.2, 0.1, { y: 3.0, pen: 4 });
      K.api.ghostBox(cx, zf - 0.04, w, 0.08, 0.7, { y: 2.95, pen: 3 });
      const [title, fg, edge] = looks[i];
      K.add(sign([title], { bg: "#140a12", fg, edge }), place(new THREE.PlaneGeometry(w - 0.3, 0.56), { x: cx, y: 3.3, z: zf + 0.006 }), { shadow: false });
      festoon(K, M, SP, [[x0 + 0.05, 2.22, zf + 1.04], [x1 - 0.05, 2.22, zf + 1.04]], { sag: 0.12, every: 0.42, seed: 40 + i });
      K.add(M.lanternPool, place(new THREE.PlaneGeometry(w + 0.8, 3.4), { x: cx, y: 0.03, z: zf + 0.3, rx: -Math.PI / 2 }), { shadow: false, phase: i * 0.3 });
      // the prizes: trollface plushies along the shelf
      for (let k = 0; k < 5; k++) {
        K.add(M.trollLit, place(new THREE.PlaneGeometry(0.34, 0.34), { x: x0 + 0.55 + (k * (w - 1.1)) / 4, y: 2.4, z: zb + 0.36 }), { shadow: false });
      }
    });
    // what's in them
    {
      const [a, b] = STALLS[2], c = (a + b) / 2;
      K.api.ghostBox(c - 0.2, zm + 0.2, 2.6, 1.0, 0.75, { pen: 3 });
      const [a3, b3] = STALLS[3];
      K.api.ghostBox((a3 + b3) / 2, zm, 0.9, 0.7, 1.1, { pen: 3 });
      const [a4, b4] = STALLS[4];
      K.api.ghostBox((a4 + b4) / 2 - 0.5, zb + 0.55, 1.4, 0.7, 0.95, { pen: 4 });
    }
    // the shooting gallery: two rows of tin trolls riding along on chains;
    // one you hit flips back on its hinge and pops up again a moment later
    {
      const [x0, x1] = STALLS[1], cx = (x0 + x1) / 2, span = 2.8, z = zb + 0.45, N = 6;
      const rows = [[1.24, 1], [1.76, -1]];   // hinge height, direction
      const geo = mergeGeometries([
        new THREE.PlaneGeometry(0.34, 0.34).translate(0, 0.2, 0).toNonIndexed(),
        new THREE.BoxGeometry(0.03, 0.06, 0.01).translate(0, 0.03, 0).toNonIndexed(),
      ], false);
      const tins = new THREE.InstancedMesh(geo, M.tinTroll, N * 2);
      tins.frustumCulled = false;
      root.add(tins);
      const st = Array.from({ length: N * 2 }, () => ({ x: 0, y: 0, at: -9, until: -9 }));
      tins.onBeforeRender = () => {
        const t = performance.now() / 1000;
        for (let i = 0; i < N * 2; i++) {
          const [hy, dir] = rows[i < N ? 0 : 1];
          let u = ((i % N) / N + dir * t * 0.11) % 1;
          if (u < 0) u += 1;
          const s = st[i];
          s.x = cx - span / 2 + u * span;
          s.y = hy + 0.2;
          let k = 0;
          if (t < s.until) k = Math.min(1, (t - s.at) / 0.12);
          else if (t < s.until + 0.3) k = 1 - (t - s.until) / 0.3;
          const edge = Math.min(1, u / 0.06, (1 - u) / 0.06);
          _e.set(-k * Math.PI * 0.5, 0, 0);
          _q.setFromEuler(_e);
          _m4.compose(_p.set(s.x, hy, z), _q, _s.set(edge, edge, edge));
          tins.setMatrixAt(i, _m4);
        }
        tins.instanceMatrix.needsUpdate = true;
      };
      tins.onBeforeRender();
      SHOT_HOOKS.push((p) => {
        if (p.x < x0 + 0.2 || p.x > x1 - 0.2 || p.z < zb - 0.05 || p.z > zb + 0.7 || p.y < 1.2 || p.y > 2.25) return;
        const t = performance.now() / 1000;
        let best = null, bd = 0.24;
        for (const s of st) {
          if (t < s.until + 0.3) continue;
          const d = Math.hypot(p.x - s.x, p.y - s.y);
          if (d < bd) { bd = d; best = s; }
        }
        if (best) { best.at = t; best.until = t + 3; }
      });
    }
  }
}

/* ------------------------------------------------ U Mad Mansion (6c) */

/* Cast-iron lace: scrolls and rings between two rails, white on clear (the
   material tints it green); tiles along a panel's length. */
function laceTexture() {
  return tex("lace", () => canvasTex(256, 128, (g, w, h) => {
    g.strokeStyle = "#fff";
    g.fillStyle = "#fff";
    g.lineCap = "round";
    g.lineWidth = 9;
    g.beginPath(); g.moveTo(0, 8); g.lineTo(w, 8); g.moveTo(0, h - 8); g.lineTo(w, h - 8); g.stroke();
    g.lineWidth = 6;
    for (const cx of [0, w / 2, w]) {
      g.beginPath(); g.moveTo(cx, 8); g.lineTo(cx, h - 8); g.stroke();
    }
    for (const cx of [w / 4, (3 * w) / 4]) {
      g.lineWidth = 6;
      g.beginPath(); g.arc(cx, h / 2, 26, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 4;
      g.beginPath(); g.arc(cx, h / 2, 11, 0, Math.PI * 2); g.stroke();
      for (const s of [-1, 1]) {
        // S-scrolls out to the posts
        g.beginPath();
        g.moveTo(cx + s * 26, h / 2);
        g.bezierCurveTo(cx + s * 44, h / 2 - 34, cx + s * 64, h / 2 - 30, cx + s * 60, h / 2 - 10);
        g.stroke();
        g.beginPath();
        g.moveTo(cx + s * 26, h / 2);
        g.bezierCurveTo(cx + s * 44, h / 2 + 34, cx + s * 64, h / 2 + 30, cx + s * 60, h / 2 + 10);
        g.stroke();
        g.beginPath(); g.arc(cx + s * 52, h / 2 - 16, 6, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(cx + s * 52, h / 2 + 16, 6, 0, Math.PI * 2); g.fill();
      }
      // a fleur up top and a drop below
      g.beginPath(); g.moveTo(cx, h / 2 - 26); g.lineTo(cx - 9, 14); g.lineTo(cx + 9, 14); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(cx, h / 2 + 26); g.lineTo(cx - 7, h - 14); g.lineTo(cx + 7, h - 14); g.closePath(); g.fill();
    }
  }, { repeat: true }));
}

/* The endless hallway, painted on the wall at the corridor's end: doors and
   sconces marching off to a dark point, with something waiting there. */
function endlessHallTexture() {
  return tex("endless", () => canvasTex(512, 1024, (g, w, h) => {
    const vx = w / 2, vy = h * 0.47;
    g.fillStyle = "#08060a";
    g.fillRect(0, 0, w, h);
    const frame = (k) => {
      const s = Math.pow(0.78, k);
      return { x0: vx - (w / 2) * s, x1: vx + (w / 2) * s, y0: vy - vy * s, y1: vy + (h - vy) * s, s };
    };
    for (let k = 0; k < 22; k++) {
      const a = frame(k), b = frame(k + 1);
      const fade = Math.pow(0.84, k);
      const wall = (r, gg, bb) => `rgb(${r * fade | 0},${gg * fade | 0},${bb * fade | 0})`;
      // floor, ceiling, walls of this slice
      g.fillStyle = wall(70, 46, 30);
      g.beginPath(); g.moveTo(a.x0, a.y1); g.lineTo(a.x1, a.y1); g.lineTo(b.x1, b.y1); g.lineTo(b.x0, b.y1); g.fill();
      g.fillStyle = wall(40, 34, 32);
      g.beginPath(); g.moveTo(a.x0, a.y0); g.lineTo(a.x1, a.y0); g.lineTo(b.x1, b.y0); g.lineTo(b.x0, b.y0); g.fill();
      for (const side of [0, 1]) {
        const ax = side ? a.x1 : a.x0, bx = side ? b.x1 : b.x0;
        g.fillStyle = wall(92, 28, 40);
        g.beginPath(); g.moveTo(ax, a.y0); g.lineTo(bx, b.y0); g.lineTo(bx, b.y1); g.lineTo(ax, a.y1); g.fill();
        if (k % 2 === 0) {
          // a door on every other slice, a sconce between
          const t0 = 0.25, t1 = 0.75;
          const px = (t) => ax + (bx - ax) * t, py = (t, f) => (a.y0 + (b.y0 - a.y0) * t) + ((a.y1 + (b.y1 - a.y1) * t) - (a.y0 + (b.y0 - a.y0) * t)) * f;
          g.fillStyle = wall(28, 16, 12);
          g.beginPath(); g.moveTo(px(t0), py(t0, 0.32)); g.lineTo(px(t1), py(t1, 0.32)); g.lineTo(px(t1), py(t1, 1)); g.lineTo(px(t0), py(t0, 1)); g.fill();
        } else {
          const px = ax + (bx - ax) * 0.5, py = (a.y0 + b.y0) / 2 + ((a.y1 + b.y1) / 2 - (a.y0 + b.y0) / 2) * 0.35;
          const r = 30 * a.s;
          const gr = g.createRadialGradient(px, py, 0, px, py, r);
          gr.addColorStop(0, `rgba(255,190,110,${0.9 * fade})`);
          gr.addColorStop(1, "rgba(255,190,110,0)");
          g.fillStyle = gr;
          g.fillRect(px - r, py - r, r * 2, r * 2);
        }
      }
      // the slice's edges
      g.strokeStyle = `rgba(0,0,0,${0.5 * fade})`;
      g.lineWidth = 2;
      g.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    }
    // something pale standing at the far end
    g.fillStyle = "rgba(220,230,240,0.55)";
    g.beginPath(); g.ellipse(vx, vy + 6, 5, 12, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(vx, vy - 9, 4, 0, Math.PI * 2); g.fill();
  }));
}

/* A long checkerboard of cream and black marble for the ballroom. */
function checkerTexture() {
  return tex("checker", () => canvasTex(256, 256, (g, w, h) => {
    const R = rng(8);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const dark = (i + j) % 2;
        g.fillStyle = dark ? "#18161a" : "#d8cfbe";
        g.fillRect(i * 64, j * 64, 64, 64);
        g.strokeStyle = dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.08)";
        for (let k = 0; k < 4; k++) {
          g.beginPath();
          g.moveTo(i * 64 + R() * 64, j * 64);
          g.bezierCurveTo(i * 64 + R() * 64, j * 64 + 20, i * 64 + R() * 64, j * 64 + 44, i * 64 + R() * 64, j * 64 + 64);
          g.stroke();
        }
      }
    }
  }, { repeat: true }));
}

/* Mirror glass: a dim, streaky silver that reads as reflective at night. */
function mirrorTexture() {
  return tex("mirror", () => canvasTex(256, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, "#4a525c");
    gr.addColorStop(0.45, "#2a2e34");
    gr.addColorStop(0.55, "#5c646e");
    gr.addColorStop(1, "#24272c");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.08;
    for (let i = 0; i < 3; i++) {
      g.fillStyle = "#fff";
      g.save();
      g.translate(w * (0.1 + i * 0.17), 0);
      g.rotate(0.35);
      g.fillRect(0, -40, 6 + (i % 3) * 5, h * 1.3);
      g.restore();
    }
  }));
}

/* The troll's naughty list, a parchment scroll. */
function scrollTexture() {
  return tex("scroll", () => canvasTex(256, 768, (g, w, h) => {
    g.fillStyle = "#d8c8a0";
    g.fillRect(0, 0, w, h);
    const R = rng(4);
    for (let i = 0; i < 300; i++) {
      g.fillStyle = `rgba(90,60,30,${R() * 0.12})`;
      g.fillRect(R() * w, R() * h, 3 + R() * 8, 2 + R() * 6);
    }
    g.fillStyle = "#3a1a10";
    g.textAlign = "center";
    g.font = "800 34px Georgia, serif";
    g.fillText("NAUGHTY", w / 2, 70);
    g.fillText("LIST", w / 2, 110);
    g.font = "italic 24px Georgia, serif";
    ["U MAD", "PROBLEM?", "GG NO RE", "RAGE QUIT", "AFK 4EVER", "CAMPER", "NOOB TUBE", "LAG SWITCH", "TEAMKILLER"].forEach((t, i) => {
      g.fillText(t, w / 2, 170 + i * 58);
      g.fillRect(40, 182 + i * 58, w - 80, 1);
    });
    g.fillStyle = "#6a1a1a";
    g.font = "800 22px Georgia, serif";
    g.fillText("— the Troll", w / 2, h - 30);
  }));
}

/* Opaque at the top, gone at the bottom: a ghost's robe trailing away. */
function ghostFadeTexture() {
  return tex("ghostFade", () => canvasTex(4, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#fff");
    gr.addColorStop(0.45, "#888");
    gr.addColorStop(1, "#000");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  }, { srgb: false }));
}

/* A ghost troll: robe, head, a faint trollface; see-through. */
function ghostTroll(M, body = M.ghostly, faceMat = M.ghostFace) {
  const g = new THREE.Group();
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.36, 1.35, 12, 1, true), body);
  robe.position.y = 0.75;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), body);
  head.position.y = 1.55;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), faceMat);
  face.position.set(0, 1.56, 0.2);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.6, 6), body);
    arm.position.set(s * 0.32, 1.12, 0.14);
    arm.rotation.set(-0.9, 0, s * 0.6);
    g.add(arm);
  }
  g.add(robe, head, face);
  return g;
}

/* The scare sting: a shriek sweeping down over a burst of hiss, played
   through the game's own mixer (attachAudio), only for whoever set it off. */
let AUDIO = null;
function scareSting() {
  const ctx = AUDIO?.ctx, out = AUDIO?.master;
  if (!ctx || !out) return;
  const t = ctx.currentTime;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.32, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  g.connect(out);
  for (const det of [0, 13, -9]) {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(1500 + det * 20, t);
    o.frequency.exponentialRampToValueAtTime(180 + det, t + 0.8);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.9);
  }
  const len = Math.floor(ctx.sampleRate * 0.5);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const n = ctx.createBufferSource();
  n.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(3000, t);
  bp.frequency.exponentialRampToValueAtTime(400, t + 0.5);
  n.connect(bp);
  bp.connect(g);
  n.start(t);
}

/* A lace panel from a to b along `axis` at `at`, y..y+h, tiling the lace
   every 2h along its length. */
function lacePanel(K, M, axis, at, a, b, y, h) {
  const len = b - a;
  if (len < 0.05) return;
  const geo = new THREE.PlaneGeometry(len, h);
  const uv = geo.attributes.uv.array;
  for (let i = 0; i < uv.length; i += 2) uv[i] *= len / (h * 2);
  const c = (a + b) / 2;
  K.add(M.lace, place(geo, axis === "x" ? { x: c, y: y + h / 2, z: at } : { x: at, y: y + h / 2, z: c, ry: Math.PI / 2 }), { shadow: false });
}

function buildMansion(api, K, M, SP, root, lights) {
  const sign = (lines, o) => new THREE.MeshBasicMaterial({ map: signTexture(lines, o), color: 0xffffff });
  const Mn = MANSION, F = Mn.floor;
  const { x0, x1, z0, z1, t } = Mn;
  hgModel(api, "hg-mansion", { wash: { color: 0x9a8aff, top: 2.6, strength: 0.07 } });

  /* ---- the shell: foundation, walls, floors, roof */
  K.solid((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, F, { pen: 10 });
  K.solid((MANSION_GALLERY.x0 + MANSION_GALLERY.x1) / 2, (MANSION_GALLERY.z0 + z0) / 2, MANSION_GALLERY.x1 - MANSION_GALLERY.x0, z0 - MANSION_GALLERY.z0, F, { pen: 10 });
  const H = Mn.ceil - F;
  const outer = [["x", z0 + t / 2, x0, x1, MANSION_HOLES.front], ["x", z1 - t / 2, x0, x1, MANSION_HOLES.back],
    ["z", x0 + t / 2, z0 + t, z1 - t, MANSION_HOLES.west], ["z", x1 - t / 2, z0 + t, z1 - t, MANSION_HOLES.east]];
  for (const [axis, at, a, b, holes] of outer) {
    wall(K, { axis, at, a, b, y: F, h: H, t, holes, pen: 8 });
    // glass in the windows: stops a body, barely slows a bullet
    for (const hole of holes) {
      for (const [lo, hi] of hole.spans) {
        if (lo < 0.05 || Math.abs(lo - (MANSION.up - MANSION.floor)) < 0.01) continue;   // doors, the gallery doors
        K.api.ghostBox(axis === "x" ? hole.c : at, axis === "x" ? at : hole.c, axis === "x" ? hole.w : 0.06, axis === "x" ? 0.06 : hole.w, hi - lo, { y: F + lo, pen: 0.3 });
      }
    }
  }
  for (const [axis, at, a, b, holes] of MANSION_PARTS) wall(K, { axis, at, a, b, y: F, h: Mn.slab - F, t: 0.2, holes, pen: 6 });
  {
    const [a0, a1, c0, c1] = MANSION_CLOSET;
    K.solid((a0 + a1) / 2, (c0 + c1) / 2, a1 - a0, c1 - c0, Mn.slab - F, { y: F, pen: 6 });
  }
  const [hx0, hx1, hz0, hz1] = MANSION_HOLE;
  slabWithHole(K, { x0: x0 + t, x1: x1 - t, z0: z0 + t, z1: z1 - t, y: Mn.slab, h: Mn.up - Mn.slab, hole: { x0: hx0, x1: hx1, z0: hz0, z1: hz1 }, pen: 8 });
  K.solid((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, 0.3, { y: Mn.ceil, pen: 8 });
  K.solid((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0 + 0.8, z1 - z0 + 0.8, 2.4, { y: Mn.eave, pen: 8 });
  const S = MANSION_STAIR;
  api.stairs(S.xFoot, S.z, S.w, S.steps, S.rise, S.run, "-x", { ghost: true, y: F });
  const rail = { y: Mn.up, pen: 0.3 };
  K.api.ghostBox((hx0 + hx1) / 2, hz0 - 0.05, hx1 - hx0, 0.08, 1.05, rail);
  K.api.ghostBox((hx0 + hx1) / 2, hz1 + 0.05, hx1 - hx0, 0.08, 1.05, rail);
  K.api.ghostBox(hx1 + 0.05, (hz0 + hz1) / 2, 0.08, hz1 - hz0, 1.05, rail);

  /* ---- the gallery: decks, columns, lace, steps */
  const G = MANSION_GALLERY, gcx = (G.x0 + G.x1) / 2, gcz = (G.z0 + G.z1) / 2;
  K.solid(gcx, gcz, G.x1 - G.x0, G.z1 - G.z0, 0.26, { y: Mn.up - 0.26, pen: 6 });
  K.solid(gcx, gcz - 0.1, G.x1 - G.x0 + 0.3, G.z1 - G.z0 + 0.4, 0.22, { y: Mn.eave, pen: 6 });
  for (const x of MANSION_COLS) K.solid(x, 18.4, 0.4, 0.4, Mn.eave - F, { y: F, pen: 6 });
  K.api.ghostBox(gcx, 18.25, G.x1 - G.x0, 0.08, 1.05, rail);
  for (const x of [G.x0 + 0.05, G.x1 - 0.05]) K.api.ghostBox(x, gcz, 0.08, G.z1 - G.z0, 1.05, rail);
  // the downstairs porch rail, open in the middle bay over the steps
  for (const [a, b] of [[G.x0, 68.35], [70.65, G.x1]]) K.api.ghostBox((a + b) / 2, 18.25, b - a, 0.08, 0.9, { y: F, pen: 0.3 });
  K.api.ghostBox(69.5, 18.0, 3.6, 0.4, 0.2, { pen: 4 });
  K.api.ghostBox(75.4, 30.7, 1.6, 0.4, 0.2, { pen: 4 });
  for (let i = 0; i < MANSION_COLS.length - 1; i++) {
    const a = MANSION_COLS[i] + 0.2, b = MANSION_COLS[i + 1] - 0.2;
    lacePanel(K, M, "x", 18.4, a, b, Mn.up - 0.78, 0.5);            // frieze under the upper deck
    lacePanel(K, M, "x", 18.4, a, b, Mn.eave - 0.62, 0.5);          // frieze under the roof
    lacePanel(K, M, "x", 18.25, a, b, Mn.up + 0.06, 0.88);          // upstairs railing
    if (i !== 3) lacePanel(K, M, "x", 18.25, a, b, F + 0.05, 0.78); // downstairs railing
  }
  for (const x of [G.x0 + 0.05, G.x1 - 0.05]) {
    lacePanel(K, M, "z", x, G.z0 + 0.2, G.z1, Mn.up + 0.06, 0.88);
    lacePanel(K, M, "z", x, G.z0 + 0.2, G.z1, F + 0.05, 0.78);
  }
  // jack-o'-lanterns all along the gallery roof's edge
  for (let i = 0; i < 8; i++) jack(K, M, G.x0 + 0.5 + i * ((G.x1 - G.x0 - 1) / 7), Mn.eave + 0.22, 18.0, { r: 0.24, face: Math.PI, seed: 7000 + i, glow: false });
  // candelabras either side of the front door, the naughty list hung out front
  for (const x of [67.9, 71.1]) {
    K.cyl(M.iron, x, F, 20.15, 0.12, 0.04, 1.25, 8);
    K.box(M.iron, x, F + 1.25, 20.15, 0.46, 0.03, 0.05);
    for (const dx of [-0.2, 0, 0.2]) candle(K, M, x + dx, F + 1.28, 20.15, { h: 0.22, seed: Math.round(x * 10 + dx * 10) });
    SP.add(x, F + 1.6, 20.15, 0xffb860, { size: 1.2, blink: 0.08 });
    K.add(M.lanternPool, place(new THREE.PlaneGeometry(2.6, 2.6), { x, y: F + 0.02, z: 19.8, rx: -Math.PI / 2 }), { shadow: false, phase: x });
  }
  K.add(M.scroll, place(new THREE.PlaneGeometry(0.85, 2.6), { x: 67.25, y: 5.95, z: 18.13, ry: Math.PI }), { shadow: false });
  K.add(M.scrollBack, place(new THREE.PlaneGeometry(0.85, 2.6), { x: 67.25, y: 5.95, z: 18.15 }), { shadow: false });
  K.box(M.gold, 67.25, 7.25, 18.14, 1.0, 0.06, 0.06);
  K.box(M.gold, 67.25, 4.62, 18.14, 1.0, 0.06, 0.06);
  // the planters, their rail and the arch over the way in, with its sign
  for (const [a, b] of [[G.x0, 67.5], [71.5, G.x1]]) {
    K.solid((a + b) / 2, 17.25, b - a, 0.5, 0.74, { pen: 8 });
    K.api.ghostBox((a + b) / 2, 17.25, b - a, 0.1, 1.0, { y: 0.74, pen: 0.3 });
  }
  for (const x of [67.45, 71.55]) K.solid(x, 17.25, 0.16, 0.16, 3.3, { pen: 3 });
  const title = sign(["U MAD MANSION"], { bg: "#0e0a14", fg: "#c8f0d8", edge: "#3a7a5a" });
  K.add(title, place(new THREE.PlaneGeometry(3.9, 0.56), { x: 69.5, y: 2.66, z: 17.17, ry: Math.PI }), { shadow: false });
  K.add(title, place(new THREE.PlaneGeometry(3.9, 0.56), { x: 69.5, y: 2.66, z: 17.33 }), { shadow: false });
  for (const x of [67.45, 71.55]) lantern(K, M, x, 3.6, 17.25, { floor: 0, seed: Math.round(x), pool: 3 });

  /* ---- the scarecrow */
  {
    const [sx, sz] = MANSION_SCARECROW;
    K.solid(sx, sz, 0.45, 0.45, 5.3, { pen: 6 });
    K.api.ghostBox(sx, sz, 1.1, 0.62, 2.1, { y: 2.6, pen: 1 });
    jack(K, M, sx, 4.75, sz, { r: 0.9, face: Math.PI, seed: 7100 });
    SP.add(sx, 5.4, sz - 0.9, 0xffa040, { size: 3.2, blink: 0.1 });
  }

  /* ---- inside: the stretching room (foyer) */
  {
    const tall = (x, z, ry) => {
      K.add(M.portraitBg, place(new THREE.PlaneGeometry(1.0, 2.7), { x, y: F + 2.0, z, ry }), { shadow: false });
      const off = 0.012, ox = Math.sin(ry) * off, oz = Math.cos(ry) * off;
      K.add(M.portraitFace, place(new THREE.PlaneGeometry(0.86, 2.4), { x: x + ox, y: F + 2.0, z: z + oz, ry }), { shadow: false });
      for (const [dy, w, h] of [[1.38, 1.16, 0.1], [-1.38, 1.16, 0.1]]) {
        K.box(M.gold, x + ox * 2, F + 2.0 + dy - h / 2, z + oz * 2, Math.abs(Math.cos(ry)) > 0.5 ? w : 0.05, h, Math.abs(Math.cos(ry)) > 0.5 ? 0.05 : w);
      }
      for (const s of [-1, 1]) {
        const lx = Math.cos(ry) * 0.53 * s, lz = -Math.sin(ry) * 0.53 * s;
        K.box(M.gold, x + lx + ox * 2, F + 0.62, z + lz + oz * 2, Math.abs(Math.cos(ry)) > 0.5 ? 0.1 : 0.05, 2.76, Math.abs(Math.cos(ry)) > 0.5 ? 0.05 : 0.1);
      }
    };
    tall(67.6, 25.08, Math.PI);
    tall(73.0, 25.08, Math.PI);
    tall(75.4, 25.08, Math.PI);
    tall(76.68, 21.6, -Math.PI / 2);
    tall(66.12, 23.6, Math.PI / 2);
    candleCluster(K, M, 71.4, F + 0.52, 23.0, { n: 5, seed: 7200 });
    lantern(K, M, 71.4, 2.6, 23.0, { hang: 1.0, floor: F, seed: 7201, pool: 4 });
  }

  /* ---- the endless hallway, and what lives at the end of it */
  K.add(M.endless, place(new THREE.PlaneGeometry(1.9, Mn.slab - F), { x: x0 + t + 0.01, y: (F + Mn.slab) / 2, z: 21.75, ry: Math.PI / 2 }), { shadow: false });
  for (const x of [63.4, 65.0]) {
    K.box(M.gold, x, 2.4, 20.82, 0.12, 0.2, 0.08);
    SP.add(x, 2.6, 20.9, 0xffb860, { size: 0.9, blink: 0.1 });
  }
  {
    // its own materials: it fades, the ballroom's dancers don't
    const body = M.ghostly.clone(), faceMat = M.ghostFace.clone();
    const ghost = ghostTroll(M, body, faceMat);
    ghost.visible = false;
    root.add(ghost);
    let at = -99, cool = 0;
    root.add(ticker((renderer, scene, camera) => {
      const now = performance.now() / 1000;
      const p = camera.position;
      if (now > cool && p.x > x0 && p.x < 65.6 && p.z > 20.8 && p.z < 22.7 && p.y < 3.5) {
        at = now;
        cool = now + 25;
        scareSting();
      }
      const k = now - at;
      if (k > 1.1) { ghost.visible = false; return; }
      ghost.visible = true;
      const rush = Math.min(1, k / 0.32);
      ghost.position.set(62.6 + rush * 2.2, F + 0.2 + Math.sin(k * 20) * 0.04, 21.75);
      ghost.rotation.y = Math.PI / 2;
      ghost.scale.setScalar(0.9 + rush * 0.35);
      body.opacity = k < 0.5 ? 0.6 : 0.6 * Math.max(0, 1 - (k - 0.5) / 0.6);
      faceMat.opacity = body.opacity * 1.4;
    }, M.iron));
  }

  /* ---- the ballroom: checkered floor, a chandelier, ghosts waltzing */
  {
    const geo = new THREE.PlaneGeometry(72.9 - 62.3, 30.2 - 25.3);
    const uv = geo.attributes.uv.array;
    for (let i = 0; i < uv.length; i += 2) { uv[i] *= (72.9 - 62.3) / 2; uv[i + 1] *= (30.2 - 25.3) / 2; }
    K.add(M.checker, place(geo, { x: (62.3 + 72.9) / 2, y: F + 0.005, z: (25.3 + 30.2) / 2, rx: -Math.PI / 2 }), { shadow: false });
    const cx = 70.3, cz = 27.7;   // east of the stair's foot
    K.cyl(M.iron, cx, 3.1, cz, 0.01, 0.01, Mn.slab - 3.1, 4);
    K.add(M.gold, place(new THREE.TorusGeometry(0.75, 0.03, 6, 28), { x: cx, y: 3.05, z: cz, rx: Math.PI / 2 }));
    K.add(M.gold, place(new THREE.TorusGeometry(0.4, 0.025, 6, 20), { x: cx, y: 3.25, z: cz, rx: Math.PI / 2 }));
    K.add(M.gold, place(new THREE.SphereGeometry(0.16, 10, 8), { x: cx, y: 2.95, z: cz }));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      candle(K, M, cx + Math.cos(a) * 0.75, 3.07, cz + Math.sin(a) * 0.75, { h: 0.14, seed: 7300 + i });
      SP.add(cx + Math.cos(a) * 0.75, 3.3, cz + Math.sin(a) * 0.75, 0xffc070, { size: 0.7, blink: 0.1 });
    }
    const l = new THREE.PointLight(0xffd0a0, 6, 12, 2);
    l.position.set(cx, 2.8, cz);
    l.userData.flicker = 1.3;
    lights.push(l);
    K.add(M.ember, place(new THREE.PlaneGeometry(0.9, 0.55), { x: 69.5, y: F + 0.3, z: 25.84 }), { shadow: false });
    K.add(M.glow, place(new THREE.PlaneGeometry(2.8, 2.8), { x: 69.5, y: F + 0.02, z: 26.6, rx: -Math.PI / 2 }), { shadow: false, phase: 0.6 });
    const dancers = [];
    for (let i = 0; i < 6; i++) {
      const gh = ghostTroll(M);
      root.add(gh);
      dancers.push(gh);
    }
    root.add(ticker(() => {
      const now = performance.now() / 1000;
      dancers.forEach((gh, i) => {
        const pair = Math.floor(i / 2), side = i % 2 ? 1 : -1;
        const a = now * 0.35 + (pair / 3) * Math.PI * 2;
        const px = cx + Math.cos(a) * 1.9, pz = cz + Math.sin(a) * 1.5;
        const spin = now * 2.2 + pair;
        gh.position.set(px + Math.cos(spin) * 0.3 * side, F + 0.12 + Math.sin(now * 2 + i) * 0.06, pz + Math.sin(spin) * 0.3 * side);
        gh.rotation.y = -spin + (side > 0 ? Math.PI : 0) + Math.PI / 2;
      });
    }, M.iron));
  }

  /* ---- the mirror maze */
  {
    for (const [axis, at, a, b] of MANSION_MAZE) {
      K.api.ghostBox(axis === "x" ? (a + b) / 2 : at, axis === "x" ? at : (a + b) / 2, axis === "x" ? b - a : 0.08, axis === "x" ? 0.08 : b - a, 2.7, { y: F, pen: 1 });
      for (const s of [-1, 1]) {
        K.add(M.mirror, place(new THREE.PlaneGeometry(b - a - 0.1, 2.5), { x: (a + b) / 2, y: F + 1.35, z: at + s * 0.045, ry: s < 0 ? Math.PI : 0 }), { shadow: false });
      }
      for (const y of [F + 0.08, F + 2.62]) K.box(M.gold, (a + b) / 2, y, at, b - a, 0.08, 0.12);
    }
    K.add(M.mirror, place(new THREE.PlaneGeometry(4.6, 2.5), { x: 76.69, y: F + 1.35, z: 27.75, ry: -Math.PI / 2 }), { shadow: false });
    K.add(M.mirror, place(new THREE.PlaneGeometry(3.0, 2.5), { x: 73.11, y: F + 1.35, z: 28.3, ry: Math.PI / 2 }), { shadow: false });
    for (const [x, z] of [[74.2, 26.0], [76.0, 29.6]]) SP.add(x, 2.6, z, 0x9ad8ff, { size: 0.8, blink: 0.4 });
    lantern(K, M, 74.9, 2.5, 27.75, { hang: 1.2, floor: F, seed: 7400, pool: 3 });
  }

  /* ---- the attic upstairs */
  {
    const U = Mn.up;
    for (const [ax, az, w, h, d] of MANSION_SHEETS) K.api.ghostBox(ax, az, w * 0.9, d * 0.9, h, { y: U, pen: 2 });
    for (const [ax, az] of MANSION_TRUNKS) K.api.ghostBox(ax, az, 1.0, 0.7, 0.55, { y: U, pen: 3 });
    candleCluster(K, M, 66.8, U + 0.55, 26.0, { n: 4, seed: 7500 });
    candleCluster(K, M, 75.6, U + 0.55, 21.6, { n: 3, seed: 7501 });
    lantern(K, M, 69.5, 6.6, 25.5, { hang: 0.8, floor: U, seed: 7502, pool: 5 });
    for (const [cx, cz, ry] of [[x0 + t + 0.4, z0 + t + 0.4, Math.PI / 4], [x1 - t - 0.4, z1 - t - 0.4, -3 * Math.PI / 4], [x0 + t + 0.4, z1 - t - 0.4, 3 * Math.PI / 4]]) {
      K.add(M.web, place(new THREE.PlaneGeometry(1.3, 1.3), { x: cx, y: Mn.ceil - 0.6, z: cz, ry }), { shadow: false });
    }
  }

  /* ---- out the back: the pet cemetery */
  {
    const pets = [[64.0, 31.9], [65.6, 32.3], [67.4, 31.8], [69.6, 32.2], [71.6, 31.9], [73.2, 32.3]];
    pets.forEach(([x, z], i) => {
      K.add(M.trim, place(headstoneGeo(0.36, 0.48, 0.07), { x, z, ry: (i % 3 - 1) * 0.12, rz: (i % 2 ? 1 : -1) * 0.05 }));
      K.add(M.epitaph, place(new THREE.PlaneGeometry(0.3, 0.16), { x, y: 0.3, z: z - 0.04, ry: Math.PI }), { shadow: false });
      K.api.ghostBox(x, z, 0.4, 0.12, 0.5, { pen: 2 });
      if (i % 2) candleCluster(K, M, x + 0.3, 0, z - 0.2, { n: 3, seed: 7600 + i });
    });
    K.add(sign(["REST IN PIXELS"], { w: 512, h: 128, bg: "#2a2420", fg: "#d8d0c0", edge: "#4a3a2a" }), place(new THREE.PlaneGeometry(1.4, 0.35), { x: 66.4, y: 1.0, z: 31.0, ry: Math.PI }), { shadow: false });
    K.solid(66.4, 31.05, 0.08, 0.08, 1.2, { pen: 1 });
  }
}

/* ------------------------------------------------ Skull Mountain + the moat (6d) */

/* The logs' loop: out of the splash pool, round the island and into the
   mountain by the east arm; then (unseen) up inside and down the chute. */
const LOG_PATH = [[67.5, 41.1], [55.6, 41.1], [55.6, 15.1], [82.0, 15.1], [82.0, 31.2]];

function buildMountain(api, K, M, SP, root, lights) {
  hgModel(api, "hg-mountain", { wash: { color: 0x3a6aff, top: 9, strength: 0.13 } });
  hgModel(api, "hg-moat");

  /* ---- the rock and the cave path through it */
  for (const [cx, cz, w, d, y0, top] of mountainCells()) K.api.ghostBox(cx, cz, w, d, top - y0, { y: y0, pen: 12 });
  for (const [x0, x1, z0, z1] of MOUNT_TUNNEL) flat(K, M.dirt, (x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, { y: 0.014 });
  lantern(K, M, 74.4, 2.3, 35.1, { hang: 0.8, floor: 0, seed: 8000, pool: 3 });
  lantern(K, M, 75.1, 2.3, 31.6, { hang: 0.8, floor: 0, seed: 8001, pool: 3 });
  K.add(M.greenGlow, place(new THREE.PlaneGeometry(3, 3), { x: 75.1, y: 0.03, z: 33.6, rx: -Math.PI / 2 }), { shadow: false, phase: 0.3 });
  SP.swarm(6, 74.6, 33.5, 2, 4, 0.5, 2.6, 0x7affd0, { size: 0.25, wander: 0.6, blink: 0.5 });
  for (const [x, z, ry] of [[72.9, 34.3, Math.PI / 2], [76.0, 30.9, Math.PI], [76.0, 35.9, -Math.PI / 2]]) {
    K.add(M.web, place(new THREE.PlaneGeometry(1.2, 1.2), { x, y: 2.6, z, ry }), { shadow: false });
  }

  /* ---- the skull's eyes, pulsing red */
  {
    const [sx, sy, sz, yaw] = MOUNT_SKULL;
    const S = (lx, ly, lz) => [sx + lx * Math.cos(yaw) + lz * Math.sin(yaw), sy + ly, sz - lx * Math.sin(yaw) + lz * Math.cos(yaw)];
    for (const s of [-1, 1]) {
      const [x, y, z] = S(s * 0.95, 1.5, 2.0);
      K.add(M.skullEye, place(new THREE.SphereGeometry(0.34, 14, 10), { x, y, z }), { shadow: false, phase: s * 0.1 });
      SP.add(x, y, z, 0xff2a1a, { size: 5, blink: 0.35 });
    }
  }

  /* ---- the waterway: one glowing teal sheet, the pool a little higher */
  {
    const parts = MOAT_ARMS.map(([x0, x1, z0, z1]) => place(new THREE.PlaneGeometry(x1 - x0, z1 - z0), { x: (x0 + x1) / 2, y: 0.04, z: (z0 + z1) / 2, rx: -Math.PI / 2 }));
    const [px, pz, pr] = MOAT_POOL;
    parts.push(place(new THREE.CircleGeometry(pr, 32), { x: px, y: 0.045, z: pz, rx: -Math.PI / 2 }));
    for (const g of parts) {
      // world-metre UVs, so the ripples run at one scale everywhere
      const p = g.attributes.position.array, uv = g.attributes.uv.array;
      for (let i = 0; i < uv.length / 2; i++) { uv[i * 2] = p[i * 3] / 4; uv[i * 2 + 1] = p[i * 3 + 2] / 4; }
      K.add(M.moatWater, g, { shadow: false });
    }
    // the chute's water, a sheet down the trough
    const [[ax, ay, az], [cx, cy, cz]] = MOUNT_CHUTE;
    const len = Math.hypot(ax - cx, ay - cy), ang = Math.atan2(ay - cy, ax - cx);
    K.add(M.moatWater, new THREE.PlaneGeometry(len, 1.15).rotateX(-Math.PI / 2).rotateZ(ang).translate((ax + cx) / 2, (ay + cy) / 2 + 0.1, az), { shadow: false });
    root.add(ticker(() => {
      const t = performance.now() / 1000;
      M.moatWater.emissiveMap.offset.set(t * 0.05, -t * 0.12);
    }, M.iron));
    // the curbs: knee-low, stepped over (bodies, not bullets, care)
    for (const [axis, at, a, b, gaps] of MOAT_CURBS) {
      for (const [s, e] of runs(a, b, gaps)) {
        if (axis === "x") K.api.ghostBox((s + e) / 2, at, e - s, 0.25, 0.2, { pen: 4 });
        else K.api.ghostBox(at, (s + e) / 2, 0.25, e - s, 0.2, { pen: 4 });
      }
    }
    // the footbridges: deck at 0.55 (dry: wading stops at 0.5), a step each end, rails
    for (const [axis, c, a0, a1, w] of MOAT_BRIDGES) {
      const box = (along0, along1, h, y = 0, across = w, off = 0, pen = 6) => {
        const m = (along0 + along1) / 2, L = along1 - along0;
        if (axis === "x") K.api.ghostBox(m, c + off, L, across, h, { y, pen });
        else K.api.ghostBox(c + off, m, across, L, h, { y, pen });
      };
      box(a0 - 0.3, a1 + 0.3, MOAT_DECK_Y);
      box(a0 - 0.9, a0 - 0.3, 0.27);
      box(a1 + 0.3, a1 + 0.9, 0.27);
      for (const s of [-1, 1]) box(a0 - 0.3, a1 + 0.3, 1.0, MOAT_DECK_Y, 0.08, s * (w / 2 - 0.05), 0.3);
    }
    // the lane carries on over its bridge to the mountain\x27s cave
    flat(K, M.dirt, (57.8 + 72.7) / 2, 35, 72.7 - 57.8, 3.2, { y: 0.014 });
  }

  /* ---- posts along the banks: corn husks, a pumpkin, a lantern glow */
  {
    const posts = [[59.2, 17.25], [64.6, 17.25], [74.2, 17.25], [79.2, 17.25], [57.75, 21], [57.75, 26.5], [57.75, 31.2], [57.75, 38.6],
      [56.5, 13.0], [61.5, 13.0], [76.0, 13.0], [81.0, 13.0], [84.1, 18], [84.1, 26.5], [53.4, 24], [53.4, 40]];
    posts.forEach(([x, z], i) => {
      K.solid(x, z, 0.22, 0.22, 1.5, { mat: M.stairWood, pen: 4 });
      for (const ry of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
        K.add(M.corn, place(new THREE.PlaneGeometry(0.6, 1.3), { x, y: 0.75, z, ry }), { shadow: false });
      }
      jack(K, M, x, 1.5, z, { r: 0.22, face: Math.atan2(63 - x, 2.5 - z), seed: 8100 + i, glow: false });
      K.add(M.lanternPool, place(new THREE.PlaneGeometry(2.6, 2.6), { x, y: 0.05, z, rx: -Math.PI / 2 }), { shadow: false, phase: i * 0.21 });
      SP.add(x, 1.75, z, 0xffa040, { size: 1.1, blink: 0.08 });
    });
  }

  /* ---- the logs: round the loop, into the mountain, down the chute */
  {
    const segs = [];
    let total = 0;
    for (let i = 1; i < LOG_PATH.length; i++) {
      const [ax, az] = LOG_PATH[i - 1], [bx, bz] = LOG_PATH[i];
      const L = Math.hypot(bx - ax, bz - az);
      segs.push({ ax, az, bx, bz, L, from: total });
      total += L;
    }
    const SPEED = 1.8, RIDE = total / SPEED, INSIDE = 6, DROP = 1.1, CYCLE = RIDE + INSIDE + DROP, N = 6;
    const [[tx, ty, tz], [bx, by, bz]] = MOUNT_CHUTE;
    const parts = [
      new THREE.CylinderGeometry(0.48, 0.48, 2.3, 12, 1, true, Math.PI, Math.PI).rotateZ(Math.PI / 2).toNonIndexed(),
      new THREE.CircleGeometry(0.48, 12, Math.PI, Math.PI).rotateY(Math.PI / 2).translate(1.15, 0, 0).toNonIndexed(),
      new THREE.CircleGeometry(0.48, 12, Math.PI, Math.PI).rotateY(-Math.PI / 2).translate(-1.15, 0, 0).toNonIndexed(),
      new THREE.BoxGeometry(0.12, 0.08, 0.8).translate(0.2, -0.15, 0).toNonIndexed(),
    ];
    const logs = new THREE.InstancedMesh(mergeGeometries(parts, false), M.log, N);
    parts.forEach((p) => p.dispose());
    logs.frustumCulled = false;
    logs.castShadow = true;
    root.add(logs);
    // the splash: a white crown in the pool when a log lands
    const splash = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.5, 1.4, 20, 1, true), M.fall);
    splash.position.set(bx - 1.6, 0.6, bz);
    splash.visible = false;
    root.add(splash);
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    logs.onBeforeRender = () => {
      const now = performance.now() / 1000;
      let lastLand = 99;
      for (let i = 0; i < N; i++) {
        const t = (now + (i * CYCLE) / N) % CYCLE;
        if (t < DROP) {
          // down the chute, nose first, gathering speed
          const k = (t / DROP) ** 1.6;
          _p.set(tx + (bx - tx) * k, ty + (by - ty) * k + 0.25, tz + (bz - tz) * k);
          _e.set(0, 0, Math.atan2(ty - by, tx - bx));
          _q.setFromEuler(_e);
          _m4.compose(_p, _q, _s.set(1, 1, 1));
          logs.setMatrixAt(i, _m4);
          continue;
        }
        lastLand = Math.min(lastLand, t - DROP);
        const ride = t - DROP;
        if (ride > RIDE) { logs.setMatrixAt(i, hidden); continue; }
        const d = ride * SPEED;
        const sg = segs.find((g) => d <= g.from + g.L) || segs[segs.length - 1];
        const k = (d - sg.from) / sg.L;
        _p.set(sg.ax + (sg.bx - sg.ax) * k, 0.18 + Math.sin(now * 2 + i) * 0.03, sg.az + (sg.bz - sg.az) * k);
        _e.set(Math.sin(now * 1.3 + i) * 0.04, -Math.atan2(sg.bz - sg.az, sg.bx - sg.ax), 0);
        _q.setFromEuler(_e);
        _m4.compose(_p, _q, _s.set(1, 1, 1));
        logs.setMatrixAt(i, _m4);
      }
      logs.instanceMatrix.needsUpdate = true;
      splash.visible = lastLand < 0.7;
      if (splash.visible) splash.scale.set(0.6 + lastLand * 1.4, 1 - lastLand, 0.6 + lastLand * 1.4);
    };
    logs.onBeforeRender();
  }
}

/* ------------------------------------------------ The Grinder + the drop tower (6e) */

/* The coaster's centre line, in ride order (a closed loop): out of the
   station east, round and up the lift hill north, over the crest and down
   the big drop west, through the vertical loop heading south, east through
   the corkscrew, up to the brake run beside the deck, round the east side
   and back along the stalls into the station. */
function coasterPoints() {
  const P = [];
  const add = (x, y, z) => P.push(new THREE.Vector3(x, y, z));
  add(57, 1.45, -18.5); add(62, 1.45, -18.5); add(66.5, 1.45, -18.5);
  add(70.5, 1.9, -19.3); add(73.2, 2.8, -21.2);
  add(74, 5.5, -24); add(74, 12, -30); add(74, 18.5, -36); add(73.4, 20.8, -39.3);
  add(71, 21.2, -41.6); add(67.5, 20.2, -42.4);
  add(63.5, 12, -42); add(60.5, 4.6, -41); add(57.2, 3.2, -38.6); add(55, 3.1, -35);
  // the vertical loop: a circle in the y-z plane drifting 1.4 m east
  for (let i = 0; i <= 8; i++) {
    const f = i / 8, a = f * Math.PI * 2;
    add(54.8 + 1.4 * f, 9 - 5.8 * Math.cos(a), -31 + 5.8 * Math.sin(a));
  }
  add(56.6, 3.4, -25.5); add(58.6, 3.6, -22.6);
  // the corkscrew: one roll round an axis along x at z -26, y 7.5
  for (let i = 0; i <= 8; i++) {
    const f = i / 8, a = f * Math.PI * 2;
    add(61.2 + 9.6 * f, 7.5 - 3.6 * Math.cos(a), -26 - 3.6 * Math.sin(a));
  }
  add(73.6, 4.6, -26.2); add(76.8, 7.2, -28.4); add(78.9, 9, -31.4);
  add(78.9, 9, -34.4); add(78.9, 9, -37.2);
  add(80.6, 8.6, -40.2); add(84, 7.4, -39.8); add(85.3, 6.2, -35.5);
  add(85.4, 4.8, -27); add(85.2, 3.6, -19); add(83.4, 3.2, -14.2);
  add(78, 3.2, -13.2); add(68, 3.2, -13.2); add(58, 3.2, -13.2); add(53.6, 2.8, -14.6);
  add(53.0, 2.2, -16.9); add(54.6, 1.6, -18.5);
  return P;
}

/* Up vectors along the track by parallel transport from "straight up" at
   the station, the leftover twist spread round the loop so it closes. */
function transportUps(tangents) {
  const n = tangents.length, ups = [];
  let u = new THREE.Vector3(0, 1, 0);
  u.addScaledVector(tangents[0], -u.dot(tangents[0])).normalize();
  ups.push(u.clone());
  const q = new THREE.Quaternion();
  for (let i = 1; i < n; i++) {
    q.setFromUnitVectors(tangents[i - 1], tangents[i]);
    u = u.clone().applyQuaternion(q);
    u.addScaledVector(tangents[i], -u.dot(tangents[i])).normalize();
    ups.push(u);
  }
  // close it: rotate each frame about its tangent by a share of the mismatch
  const end = ups[n - 1].clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(tangents[n - 1], tangents[0]));
  const side0 = new THREE.Vector3().crossVectors(tangents[0], ups[0]);
  const twist = Math.atan2(end.dot(side0), end.dot(ups[0]));
  for (let i = 0; i < n; i++) ups[i].applyAxisAngle(tangents[i], (-twist * i) / n);
  return ups;
}

/* Rings of `seg` points round a path (offset by `off(i)` from it), joined
   into one tube; frames from the track. */
function trackTube(pts, ups, tans, off, r, seg = 6) {
  const pos = [];
  const ring = (i) => {
    const t = tans[i], u = ups[i], sd = new THREE.Vector3().crossVectors(t, u);
    const c = pts[i].clone().add(off(sd, u));
    const out = [];
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      out.push(c.clone().addScaledVector(u, Math.cos(a) * r).addScaledVector(sd, Math.sin(a) * r));
    }
    return out;
  };
  let prev = ring(0);
  for (let i = 1; i <= pts.length; i++) {
    const cur = ring(i % pts.length);
    for (let k = 0; k < seg; k++) {
      const j = (k + 1) % seg;
      for (const p of [prev[k], cur[k], cur[j], prev[k], cur[j], prev[j]]) pos.push(p.x, p.y, p.z);
    }
    prev = cur;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function buildCoaster(api, K, M, SP, root, lights) {
  const sign = (lines, o) => new THREE.MeshBasicMaterial({ map: signTexture(lines, o), color: 0xffffff });
  const curve = new THREE.CatmullRomCurve3(coasterPoints(), true, "centripetal");
  const L = curve.getLength();
  const N = Math.round(L / 0.5);
  const pts = [], tans = [];
  for (let i = 0; i < N; i++) {
    pts.push(curve.getPointAt(i / N));
    tans.push(curve.getTangentAt(i / N).normalize());
  }
  const ups = transportUps(tans);

  /* ---- the track: two rails, a teal box spine under them, ties */
  K.add(M.track, trackTube(pts, ups, tans, (sd, u) => sd.clone().multiplyScalar(0.55), 0.07));
  K.add(M.track, trackTube(pts, ups, tans, (sd, u) => sd.clone().multiplyScalar(-0.55), 0.07));
  K.add(M.track, trackTube(pts, ups, tans, (sd, u) => u.clone().multiplyScalar(-0.42), 0.2, 8));
  for (let i = 0; i < N; i += 3) {
    const t = tans[i], u = ups[i], sd = new THREE.Vector3().crossVectors(t, u), p = pts[i];
    for (const s of [-1, 1]) {
      K.add(M.track, rodGeo([p.x + sd.x * s * 0.55, p.y + sd.y * s * 0.55, p.z + sd.z * s * 0.55], [p.x - u.x * 0.42, p.y - u.y * 0.42, p.z - u.z * 0.42], 0.035, 4), { shadow: false });
    }
  }
  // chain dogs up the lift hill, a catwalk beside it
  for (let i = 0; i < N; i++) {
    const p = pts[i];
    if (!(p.x > 73 && p.x < 75 && p.z < -22 && p.z > -38.5) || i % 2) continue;
    K.box(M.iron, p.x, p.y - 0.1, p.z, 0.16, 0.05, 0.16, {}, { shadow: false });
  }

  /* ---- supports: tan tubular columns wherever the track rides upright */
  {
    const spawns = HOLLOWGRIN.spawns.map(([x, z]) => [x, z]);
    let last = -99;
    for (let i = 0; i < N; i++) {
      const p = pts[i], u = ups[i];
      if (i - last < 9 || u.y < 0.8 || p.y < 2.4) continue;
      if (p.x > 55.4 && p.x < 68.6 && p.z > -21.4 && p.z < -15.6) continue;   // the station carries itself
      if (p.x > 55 && p.x < 69 && p.z > -26 && p.z < -21.4) continue;          // keep the queue lanes clear
      if (spawns.some(([x, z]) => Math.hypot(x - p.x, z - p.z) < 1.8)) continue;
      last = i;
      const top = p.y - 0.62;
      K.cyl(M.support, p.x, 0, p.z, 0.2, 0.16, top, 8);
      K.cyl(M.concrete, p.x, 0, p.z, 0.42, 0.42, 0.25, 8);
      if (top > 8) {
        const sd = new THREE.Vector3().crossVectors(tans[i], u).setY(0).normalize();
        for (const s of [-1, 1]) {
          K.add(M.support, rodGeo([p.x + sd.x * s * 1.6, 0, p.z + sd.z * s * 1.6], [p.x, top * 0.7, p.z], 0.12, 6));
          K.api.ghostBox(p.x + sd.x * s * 1.6, p.z + sd.z * s * 1.6, 0.4, 0.4, 2.0, { pen: 0.6 });
        }
      }
      K.api.ghostBox(p.x, p.z, 0.4, 0.4, top, { pen: 0.6 });
    }
    // low track outside the station: a body-height barrier under it
    for (let i = 0; i < N; i += 2) {
      const p = pts[i];
      if (p.y > 2.6) continue;
      if (p.x > 51 && p.x < 72 && p.z > -22 && p.z < -12) continue;   // round the station: walk under it
      K.api.ghostBox(p.x, p.z, 0.9, 0.9, p.y + 0.3, { pen: 0.5 });
    }
  }

  /* ---- the station: two platforms either side of the track, a roof */
  {
    // 2 m clear of the stalls' backs, so there's a walkway between
    const st = { x0: 55.5, x1: 68.5, zN: -20.9, zS: -16.1, y: 1.2 };
    const cx = (st.x0 + st.x1) / 2, w = st.x1 - st.x0;
    K.solid(cx, -20.15, w, 1.5, st.y, { mat: M.stationDeck, pen: 8 });
    K.solid(cx, -16.85, w, 1.5, st.y, { mat: M.stationDeck, pen: 8 });
    for (const z of [-20.9, -16.1]) {
      for (const x of [st.x0 + 0.2, cx, st.x1 - 0.2]) K.solid(x, z, 0.25, 0.25, 4.2, { mat: M.support, pen: 6 });
    }
    K.solid(cx, -18.5, w + 0.6, 5.6, 0.25, { y: 4.2, mat: M.stationRoof, pen: 6 });
    K.box(M.track, cx, 4.45, -18.5, w + 0.7, 0.35, 5.7);
    // steps up to each platform from the west end, a gate rail on the track side
    for (const z of [-20.15, -16.85]) {
      for (let k = 0; k < 3; k++) K.solid(st.x0 - 0.2 - (2 - k) * 0.4, z, 0.4, 1.5, 0.3 * (k + 1), { mat: M.stationDeck, pen: 6 });   // 0.3 m rises
    }
    for (const z of [-19.45, -17.55]) {
      K.api.ghostBox(cx, z, w, 0.08, 1.0, { y: st.y, pen: 0.3 });
      K.box(M.gold, cx, st.y + 0.95, z, w, 0.06, 0.06);
      for (let x = st.x0 + 0.5; x < st.x1; x += 1.3) K.box(M.gold, x, st.y, z, 0.05, 0.95, 0.05, {}, { shadow: false });
    }
    const title = sign(["THE GRINDER"], { bg: "#0a1a1c", fg: "#7affe0", edge: "#ffb347" });
    for (const [z, ry] of [[-21.32, Math.PI], [-15.68, 0]]) K.add(title, place(new THREE.PlaneGeometry(6.4, 0.8), { x: cx, y: 5.2, z, ry }), { shadow: false });
    for (const z of [-21.36, -15.64]) K.box(M.track, cx, 4.75, z, 6.8, 0.95, 0.06);
    // the queue maze north of it: switchback rails, posts with bulbs
    for (const [z, a, b] of [[-22.6, 57.5, 68.5], [-24.0, 55.5, 66.5], [-25.4, 57.5, 68.5]]) {
      K.api.ghostBox((a + b) / 2, z, b - a, 0.08, 1.0, { pen: 0.3 });
      for (const y of [0.5, 0.95]) K.box(M.iron, (a + b) / 2, y, z, b - a, 0.05, 0.05, {}, { shadow: false });
      for (let x = a; x <= b + 0.01; x += 2.2) {
        K.box(M.iron, x, 0, z, 0.08, 1.05, 0.08);
        K.add(M.bulb, place(new THREE.OctahedronGeometry(0.06), { x, y: 1.12, z }), { color: BULBS[Math.round(x) % 4], shadow: false });
      }
    }
    lantern(K, M, cx - 3, 3.6, -18.5, { hang: 0.5, floor: st.y, seed: 9000, pool: 4 });
    lantern(K, M, cx + 3, 3.6, -18.5, { hang: 0.5, floor: st.y, seed: 9001, pool: 4 });
    festoon(K, M, SP, [[st.x0, 4.15, -21.0], [st.x1, 4.15, -21.0]], { sag: 0.2, every: 0.5, seed: 90 });
  }

  /* ---- the brake deck at 9 m beside the brake run, its stair */
  {
    const D = COASTER_DECK, S = COASTER_STAIR;
    const dcx = (D.x0 + D.x1) / 2, dcz = (D.z0 + D.z1) / 2;
    K.solid(dcx, dcz, D.x1 - D.x0, D.z1 - D.z0, 0.25, { y: D.y - 0.25, mat: M.stationDeck, pen: 6 });
    for (const x of [D.x0 + 0.15, D.x1 - 0.15]) for (const z of [D.z0 + 0.15, D.z1 - 0.15]) K.solid(x, z, 0.24, 0.24, D.y - 0.25, { mat: M.support, pen: 6 });
    const rail = { y: D.y, pen: 0.3 };
    K.api.ghostBox(dcx, D.z0 + 0.03, D.x1 - D.x0, 0.08, 1.05, rail);
    K.api.ghostBox(D.x0 + 0.03, dcz, 0.08, D.z1 - D.z0, 1.05, rail);
    K.api.ghostBox(D.x1 - 0.03, dcz, 0.08, D.z1 - D.z0, 1.05, rail);
    for (const [a, b] of [[D.x0, S.x0], [S.x1, D.x1]]) K.api.ghostBox((a + b) / 2, D.z1 - 0.03, b - a, 0.08, 1.05, rail);
    for (const [ax, az, bx, bz] of [[D.x0, D.z0, D.x1, D.z0], [D.x0, D.z0, D.x0, D.z1], [D.x1, D.z0, D.x1, D.z1], [D.x0, D.z1, S.x0, D.z1], [S.x1, D.z1, D.x1, D.z1]]) {
      const len = Math.hypot(bx - ax, bz - az), cxx = (ax + bx) / 2, czz = (az + bz) / 2;
      for (const y of [0.5, 1.0]) K.box(M.yellow, cxx, D.y + y, czz, Math.max(0.05, Math.abs(bx - ax)), 0.05, Math.max(0.05, Math.abs(bz - az)), {}, { shadow: false });
      for (let k = 0; k <= Math.round(len); k++) {
        K.box(M.yellow, ax + ((bx - ax) * k) / Math.max(1, Math.round(len)), D.y, az + ((bz - az) * k) / Math.max(1, Math.round(len)), 0.06, 1.05, 0.06, {}, { shadow: false });
      }
    }
    api.stairs((S.x0 + S.x1) / 2, S.zFoot, S.x1 - S.x0, S.steps, S.rise, S.run, "-z", { ghost: true });
    for (let i = 0; i < S.steps; i++) {
      const top = S.rise * (i + 1), zc = S.zFoot - S.run * (i + 0.5);
      K.box(M.stationDeck, (S.x0 + S.x1) / 2, top - 0.06, zc, S.x1 - S.x0, 0.06, S.run + 0.02, {}, { shadow: false });
    }
    for (const x of [S.x0, S.x1]) {
      K.add(M.support, rodGeo([x, 0, S.zFoot + 0.1], [x, S.rise * S.steps, S.zFoot - S.run * S.steps], 0.05, 4));
      K.add(M.yellow, rodGeo([x, 1.0, S.zFoot], [x, S.rise * S.steps + 1.0, S.zFoot - S.run * S.steps], 0.025, 4), { shadow: false });
    }
    K.box(M.track, (S.x0 + S.x1) / 2, 0, (S.zFoot + S.zFoot - S.run * S.steps) / 2, S.x1 - S.x0 - 0.1, 0.02, S.run * S.steps, {}, { shadow: false });
    // a flood lamp on the deck and a warning sign
    K.cyl(M.support, D.x1 - 0.3, D.y, D.z0 + 0.3, 0.06, 0.05, 2.6, 6);
    K.box(M.lampGlass, D.x1 - 0.3, D.y + 2.6, D.z0 + 0.5, 0.4, 0.3, 0.08, {}, { shadow: false });
    SP.add(D.x1 - 0.3, D.y + 2.75, D.z0 + 0.55, 0xfff0c8, { size: 2.2, blink: 0.02 });
    K.add(sign(["STAFF ONLY", "BRAKE RUN"], { w: 512, h: 256, bg: "#e8dcc0", fg: "#8a1a1a", edge: "#8a1a1a" }),
      place(new THREE.PlaneGeometry(0.8, 0.4), { x: (S.x0 + S.x1) / 2, y: 1.6, z: S.zFoot + 0.25 }), { shadow: false });
  }

  /* ---- the train: four cars riding the curve; slow up the lift, a pause
     in the station, gravity everywhere else */
  {
    const TOP = 21.6;
    const speed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const p = pts[i], t = tans[i];
      if (p.x > 55.5 && p.x < 68.5 && p.z > -20 && p.z < -17 && p.y < 2) speed[i] = 2.2;
      else if (t.y > 0.3 && p.x > 72.8 && p.x < 75.2) speed[i] = 3.2;           // the chain lift
      else if (p.x > 78 && p.x < 80 && p.z < -30 && p.z > -38) speed[i] = 4.0;  // the brakes
      else speed[i] = Math.max(4, Math.sqrt(2 * 9.8 * 0.82 * Math.max(0, TOP - p.y)));
    }
    const step = L / N, times = new Float32Array(N + 1);
    const DWELL = 5, dwellAt = pts.findIndex((p) => p.x > 61.5 && p.y < 2);
    for (let i = 0; i < N; i++) times[i + 1] = times[i] + step / speed[i] + (i === dwellAt ? DWELL : 0);
    const CYCLE = times[N];
    const sAt = (t) => {
      let lo = 0, hi = N;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (times[m] <= t) lo = m; else hi = m; }
      const span = times[lo + 1] - times[lo];
      const f = lo === dwellAt ? Math.max(0, (t - times[lo] - DWELL) / (span - DWELL)) : (t - times[lo]) / span;
      return (lo + Math.min(1, Math.max(0, f))) * step;
    };
    const car = mergeGeometries([
      new THREE.BoxGeometry(1.7, 0.55, 1.15).translate(0, 0.35, 0).toNonIndexed(),
      new THREE.BoxGeometry(0.15, 0.6, 1.1).translate(0.55, 0.85, 0).toNonIndexed(),
      new THREE.BoxGeometry(0.15, 0.6, 1.1).translate(-0.2, 0.85, 0).toNonIndexed(),
      new THREE.BoxGeometry(0.3, 0.35, 1.2).translate(0.85, 0.3, 0).toNonIndexed(),
    ], false);
    const cars = new THREE.InstancedMesh(car, M.coasterCar, 4);
    cars.frustumCulled = false;
    cars.castShadow = true;
    root.add(cars);
    const m3 = new THREE.Matrix4(), side = new THREE.Vector3(), tv = new THREE.Vector3(), uv = new THREE.Vector3();
    const frameAt = (s) => {
      const u = ((s % L) + L) % L / L;
      const i = Math.floor(u * N) % N;
      _p.copy(curve.getPointAt(u));
      tv.copy(tans[i]);
      uv.copy(ups[i]);
      side.crossVectors(tv, uv);
      m3.makeBasis(tv, uv, side);
      _q.setFromRotationMatrix(m3);
      _p.addScaledVector(uv, -0.05);
    };
    cars.onBeforeRender = () => {
      const t = (performance.now() / 1000) % CYCLE;
      const head = sAt(t);
      for (let k = 0; k < 4; k++) {
        frameAt(head - k * 1.95);
        _m4.compose(_p, _q, _s.set(1, 1, 1));
        cars.setMatrixAt(k, _m4);
      }
      cars.instanceMatrix.needsUpdate = true;
    };
    cars.onBeforeRender();
  }

  /* ---- the drop tower: a lattice mast, a ring of seats that creeps up
     then falls */
  {
    const [tx, tz] = COASTER_TOWER, H = 30;
    K.solid(tx, tz, 3.2, 3.2, 1.0, { mat: M.concrete, pen: 10 });
    K.api.ghostBox(tx, tz, 1.6, 1.6, H, { y: 1.0, pen: 1.2 });
    for (const [dx, dz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) K.cyl(M.support, tx + dx, 1.0, tz + dz, 0.12, 0.1, H - 1, 6);
    for (let y = 2; y < H; y += 2) {
      for (const [ax, az, bx, bz] of [[-0.7, -0.7, 0.7, -0.7], [0.7, -0.7, 0.7, 0.7], [0.7, 0.7, -0.7, 0.7], [-0.7, 0.7, -0.7, -0.7]]) {
        K.add(M.support, rodGeo([tx + ax, y, tz + az], [tx + bx, y + 2, tz + bz], 0.04, 4), { shadow: false });
      }
    }
    K.box(M.track, tx, H, tz, 2.6, 0.6, 2.6);
    K.cyl(M.track, tx, H + 0.6, tz, 0.9, 0.2, 1.6, 8);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, x = tx + Math.cos(a) * 1.4, z = tz + Math.sin(a) * 1.4;
      K.add(M.bulb, place(new THREE.OctahedronGeometry(0.08), { x, y: H + 0.3, z }), { color: BULBS[i % 4], shadow: false });
      SP.add(x, H + 0.3, z, BULBS[i % 4], { size: 0.9, blink: 0.4 });
    }
    K.add(sign(["DROP OF DOOM"], { bg: "#1a0c14", fg: "#ff5a6a", edge: "#ffd23a" }), place(new THREE.PlaneGeometry(2.4, 0.5), { x: tx, y: H - 1.4, z: tz + 1.32 }), { shadow: false });
    const ringGeo = mergeGeometries([
      new THREE.CylinderGeometry(1.9, 1.9, 0.5, 20, 1, true).toNonIndexed(),
      ...Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return new THREE.BoxGeometry(0.5, 0.9, 0.45).translate(Math.cos(a) * 2.1, -0.35, Math.sin(a) * 2.1).toNonIndexed();
      }),
    ], false);
    const ring = new THREE.Mesh(ringGeo, M.awningRed);
    ring.castShadow = true;
    root.add(ring);
    ring.position.set(tx, 2.2, tz);
    ring.onBeforeRender = () => {
      // 14 s cycle: 8 s creeping up, 2 s hanging at the top, a 1.4 s fall, 2.6 s settling
      const t = (performance.now() / 1000) % 14;
      let y;
      if (t < 8) y = 2.2 + (H - 4.2) * (t / 8);
      else if (t < 10) y = H - 2 + Math.sin(t * 9) * 0.03;
      else if (t < 11.4) { const k = (t - 10) / 1.4; y = H - 2 - (H - 4.2) * k * k; }
      else y = 2.2 + Math.sin((t - 11.4) * 6) * 0.25 * Math.exp(-(t - 11.4) * 2);
      ring.position.y = y;
      ring.rotation.y = t * 0.2;
    };
  }
}

/* ===================================================================== map */

function buildHollowgrin(api) {
  ZSPAWNS.length = 0;
  SHOT_HOOKS.length = 0;
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
    gold: new THREE.MeshStandardMaterial({ color: 0xd8b050, roughness: 0.3, metalness: 0.6, emissive: 0x2a1c06 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xc8ccd6, roughness: 0.45, metalness: 0.3 }),
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
    // phase 6a: the mausoleum's relief, stained window and cobwebs
    relief: new THREE.MeshStandardMaterial({ map: trollTexture(), alphaTest: 0.5, color: 0x8a8a94, roughness: 0.95 }),
    stained: new THREE.MeshBasicMaterial({ map: stainedTexture(), alphaTest: 0.5, color: new THREE.Color(0xffffff).multiplyScalar(1.5) }),
    stainedOut: new THREE.MeshBasicMaterial({ map: stainedTexture(), alphaTest: 0.5, color: new THREE.Color(0xffffff).multiplyScalar(0.9) }),
    lanternPool: flickerMat({ map: glowTexture(), color: new THREE.Color(0xffa04a).multiplyScalar(0.26), additive: true, strength: 0.8 }),
    web: new THREE.MeshBasicMaterial({ map: webTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide, color: 0x9a9aa8 }),
    // phase 6c: the mansion
    lace: new THREE.MeshStandardMaterial({ map: laceTexture(), alphaTest: 0.5, side: THREE.DoubleSide, color: 0x3a7a58, roughness: 0.6, metalness: 0.2, emissive: 0x0c2418 }),
    endless: new THREE.MeshBasicMaterial({ map: endlessHallTexture(), color: 0xffffff }),
    checker: new THREE.MeshStandardMaterial({ map: checkerTexture(), roughness: 0.25, metalness: 0.1 }),
    mirror: new THREE.MeshStandardMaterial({ map: mirrorTexture(), roughness: 0.1, metalness: 0.2, emissive: 0x30343a, emissiveMap: mirrorTexture() }),
    scroll: new THREE.MeshStandardMaterial({ map: scrollTexture(), roughness: 0.9, emissive: 0x2a2014 }),
    scrollBack: new THREE.MeshStandardMaterial({ color: 0xb8a880, roughness: 0.95 }),
    portraitBg: new THREE.MeshStandardMaterial({ color: 0x1c2a24, roughness: 0.8 }),
    portraitFace: new THREE.MeshStandardMaterial({ map: trollTexture(), alphaTest: 0.5, color: 0xd8cfb8, roughness: 0.7, emissive: 0x2a2620, emissiveMap: trollTexture() }),
    ghostly: new THREE.MeshBasicMaterial({ alphaMap: ghostFadeTexture(), color: 0x7aaad0, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    // phase 6e: the coaster and the drop tower
    track: new THREE.MeshStandardMaterial({ color: 0x1a8a86, roughness: 0.4, metalness: 0.3, emissive: 0x06201e }),
    support: new THREE.MeshStandardMaterial({ color: 0xc8a878, roughness: 0.55, metalness: 0.2 }),
    concrete: surfMat("cast", 0x8a8a8e, { mix: 0.4, tile: 1.2 }),
    stationDeck: surfMat("wood", 0x6a4a30, { mix: 0.35, tile: 1, bounce: 0.15 }),
    stationRoof: new THREE.MeshStandardMaterial({ color: 0x23302f, roughness: 0.7 }),
    coasterCar: new THREE.MeshStandardMaterial({ color: 0xd8402a, roughness: 0.35, metalness: 0.3, emissive: 0x2a0806 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xd8b02a, roughness: 0.5 }),
    // phase 6d: the moat, the logs, the skull's eyes
    moatWater: new THREE.MeshStandardMaterial({ color: 0x062a2c, roughness: 0.06, metalness: 0.4, emissive: 0x1ab89e, emissiveMap: glowRippleTexture(), emissiveIntensity: 0.8 }),
    log: surfMat("wood", 0x6a4a30, { mix: 0.3, tile: 1 }),
    skullEye: flickerMat({ color: new THREE.Color(0xff2a14).multiplyScalar(2.2), strength: 1.2, speed: 0.35 }),
    ghostFace: new THREE.MeshBasicMaterial({ map: trollTexture(), color: 0xcfefff, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    // phase 6b: the park
    setts: new THREE.MeshStandardMaterial({ map: settsTexture(), color: 0x9a96a0, roughness: 0.92 }),
    fountainWater: new THREE.MeshStandardMaterial({ color: 0x08262a, roughness: 0.08, metalness: 0.45, emissive: 0x3ab8b0, emissiveMap: rippleTexture(), emissiveIntensity: 0.9 }),
    fall: new THREE.MeshBasicMaterial({ map: streamTexture(), color: new THREE.Color(0x9fe8ff).multiplyScalar(0.8), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
    bronzeFace: new THREE.MeshStandardMaterial({ map: trollTexture(), alphaTest: 0.5, color: 0xa8c0a0, roughness: 0.5, metalness: 0.2, emissive: 0x3a4a3a, emissiveMap: trollTexture() }),
    tinTroll: new THREE.MeshStandardMaterial({ map: trollTexture(), alphaTest: 0.5, side: THREE.DoubleSide, color: 0xe8e0c8, roughness: 0.45, metalness: 0.3, emissive: 0x6a6050, emissiveMap: trollTexture() }),
  };
  M.fountainWater.emissiveMap.repeat.set(3, 3);
  M.fall.map.repeat.set(10, 1);
  M.log.side = THREE.DoubleSide;
  // the coaster's steel washed green from below, like the photo
  M.track.userData.wash = { color: 0x3aff8a, top: 6, strength: 0.07 };
  M.support.userData.wash = { color: 0x3aff8a, top: 6, strength: 0.08 };

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
  api.ghostWalls((BOUNDS.minX + BOUNDS.maxX) / 2, (BOUNDS.minZ + BOUNDS.maxZ) / 2, BOUNDS.maxX - BOUNDS.minX + 2.8, BOUNDS.maxZ - BOUNDS.minZ + 2.8, 8, 1.4);
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
    run("z", BOUNDS.minX - 0.6, BOUNDS.minZ, BOUNDS.maxZ, [lane, [16.5, 23.5], [-1.6, 5.6]]);   // the chapel's apse
    run("z", BOUNDS.maxX + 0.6, BOUNDS.minZ, BOUNDS.maxZ);

    // The woods: four tree shapes, instanced round the outside.
    const variants = [11, 23, 37, 51].map((s, i) => treeGeo(s, { height: 7 + i, r: 0.28 + i * 0.03, levels: 3 }));
    for (const v of variants) metreUVs(v, M.bark.userData.tile);
    const spots = [];
    const T = rng(99);
    for (let i = 0; i < 185; i++) {
      // walk the perimeter, pushed out 1.5-13 m
      const t = T() * 4;
      const out = 1.6 + Math.pow(T(), 0.7) * 12;
      let x, z;
      if (t < 1) { x = THREE.MathUtils.lerp(BOUNDS.minX - 10, BOUNDS.maxX + 10, t); z = BOUNDS.minZ - out; }
      else if (t < 2) { x = THREE.MathUtils.lerp(BOUNDS.minX - 10, BOUNDS.maxX + 10, t - 1); z = BOUNDS.maxZ + out; }
      else if (t < 3) { z = THREE.MathUtils.lerp(BOUNDS.minZ, BOUNDS.maxZ, t - 2); x = BOUNDS.minX - out; }
      else { z = THREE.MathUtils.lerp(BOUNDS.minZ, BOUNDS.maxZ, t - 3); x = BOUNDS.maxX + out; }
      const keep = [T() * 6.28, 0.85 + T() * 0.5, Math.floor(T() * 4)];
      // clear the lane's west end and the creek's bed
      if (x < BOUNDS.minX && z > LANE.z0 - 1.5 && z < LANE.z1 + 1.5) continue;
      if (creekDist(x, z) < CREEK_W) continue;
      if (x < BOUNDS.minX && x > BOUNDS.minX - 6 && z > -3 && z < 7) continue;   // behind the chapel's apse
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

    // a lantern hung in the gate's arch; candles left burning on graves
    lantern(K, M, -16, 3.45, 2, { hang: 0.95, seed: 73, pool: 3.0 });
    let cs = 80;
    for (const [gx, gz] of [[-33.4, 5], [-30.4, -2], [-22.6, 12.5], [-19.6, 7.5], [-27.2, -4.5], [-33.4, 12.5], [-19.6, -2], [-30.4, 15]]) {
      candleCluster(K, M, gx + 0.4, 0, gz + 0.15, { n: 3 + (cs % 3), seed: cs++ });
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

    // the mausoleum: a granite Greek-revival tomb (models/build_hollowgrin
    // .blender.py: hg-mausoleum) over these colliders; one door east, a
    // sarcophagus, a stained window and a green glow
    const mx0 = -31, mx1 = -25, mz0 = 8, mz1 = 14, mh = 3.2;
    wall(K, { axis: "x", at: mz0 + 0.25, a: mx0, b: mx1, h: mh, t: 0.5 });
    wall(K, { axis: "x", at: mz1 - 0.25, a: mx0, b: mx1, h: mh, t: 0.5 });
    wall(K, { axis: "z", at: mx0 + 0.25, a: mz0 + 0.5, b: mz1 - 0.5, h: mh, t: 0.5 });
    wall(K, { axis: "z", at: mx1 - 0.25, a: mz0 + 0.5, b: mz1 - 0.5, h: mh, t: 0.5,
      holes: [{ c: 11, w: 1.8, spans: [[0, 2.5]] }] });
    K.solid(-28, 11, 6.8, 6.8, 0.35, { y: mh, pen: 10 });
    for (const cz of [9.3, 12.7]) K.solid(-24.55, cz, 0.44, 0.44, mh, { pen: 8 });
    K.solid(-24.4, 11, 1.2, 4.2, 0.18, { pen: 6 });
    hgModel(api, "hg-mausoleum", { wash: { color: 0x2a8a52, top: 2.2, strength: 0.16 } });
    lantern(K, M, -23.55, 0, 8.7, { seed: 71, pool: 2.0 });
    lantern(K, M, -23.55, 0, 13.3, { seed: 72, pool: 2.0 });
    // the trollface carved in the east pediment
    K.add(M.relief, place(new THREE.PlaneGeometry(0.95, 0.95), { x: -24.13, y: 4.03, z: 11, ry: Math.PI / 2 }), { shadow: false });
    // the stained window, lit from inside, on both faces of the west wall
    K.add(M.stained, place(new THREE.PlaneGeometry(1.1, 1.85), { x: -30.47, y: 2.12, z: 11, ry: Math.PI / 2 }), { shadow: false });
    K.add(M.stainedOut, place(new THREE.PlaneGeometry(1.1, 1.85), { x: -31.04, y: 2.12, z: 11, ry: -Math.PI / 2 }), { shadow: false });
    // cobwebs strung across the top corners
    for (const [cx, cz] of [[mx0 + 0.5, mz0 + 0.5], [mx0 + 0.5, mz1 - 0.5], [mx1 - 0.5, mz0 + 0.5], [mx1 - 0.5, mz1 - 0.5]]) {
      // across the corner, facing the middle of the room
      const ry = Math.atan2(-28 - cx, 11 - cz);
      K.add(M.web, place(new THREE.PlaneGeometry(1.3, 0.9), { x: cx + Math.sign(-28 - cx) * 0.18, y: 2.55, z: cz + Math.sign(11 - cz) * 0.18, ry }), { shadow: false });
    }
    const plaque = new THREE.MeshBasicMaterial({ map: signTexture(["TROLL"], { w: 512, h: 128, bg: "#3a3a40", fg: "#141418", edge: "#55555c" }), color: 0xb0b0b8 });
    K.add(plaque, place(new THREE.PlaneGeometry(1.8, 0.45), { x: -24.74, y: 2.85, z: 11, ry: Math.PI / 2 }), { shadow: false });
    K.solid(-28.4, 11, 1.1, 2.3, 0.95, { pen: 10 });
    for (const [cx, cz] of [[-27.6, 9.6], [-27.6, 12.4], [-29.8, 9.2], [-29.8, 12.8]]) candle(K, M, cx, 0, cz, { seed: 500 + cx, h: 0.3, r: 0.05 });
    K.add(M.greenGlow, place(new THREE.PlaneGeometry(4.5, 4.5), { x: -28, y: 0.04, z: 11, rx: -Math.PI / 2 }), { shadow: false, phase: 0.3 });
    const ml = new THREE.PointLight(0x5dff8a, 4.5, 10, 2);
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
    // lanterns set on the hedge ends either side of each way in
    let ls = 90;
    for (const s of [-1, 1]) {
      for (const g of [-1.35, 1.35]) {
        lantern(K, M, cx + g, 1.35, cz + s * half, { seed: ls++, floor: 0, pool: 2.6 });
        lantern(K, M, cx + s * half, 1.35, cz + g, { seed: ls++, floor: 0, pool: 2.6 });
      }
    }
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
    // brick sides, a clapboard Victorian front with a bay window and a false
    // front (hg-candyshop) over these colliders
    const sx0 = -11, sx1 = -1, sz0 = 21, sz1 = 27.5, sh = 3.4;
    const S = { pen: 8 };
    wall(K, { axis: "x", at: sz0 + 0.2, a: sx0, b: sx1, h: sh, out: -1, ...S,
      holes: [{ c: -6, w: 1.8, spans: [[0, 2.5]] }, { c: -9, w: 2.2, spans: [[0.9, 2.3]] }, { c: -2.9, w: 1.8, spans: [[0.9, 2.3]] }] });
    wall(K, { axis: "x", at: sz1 - 0.2, a: sx0, b: sx1, h: sh, out: 1, ...S,
      holes: [{ c: -3.5, w: 1.6, spans: [[0, 2.4]] }, { c: -8.5, w: 1.4, spans: [[1.0, 2.2]] }] });
    wall(K, { axis: "z", at: sx0 + 0.2, a: sz0 + 0.4, b: sz1 - 0.4, h: sh, out: -1, ...S, holes: [{ c: 24.2, w: 1.6, spans: [[1.0, 2.3]] }] });
    wall(K, { axis: "z", at: sx1 - 0.2, a: sz0 + 0.4, b: sz1 - 0.4, h: sh, out: 1, ...S, holes: [{ c: 24.2, w: 1.4, spans: [[1.0, 2.3]] }] });
    K.solid(-6, 24.25, 10.6, 7.1, 0.3, { y: sh, pen: 8 });
    // the bay window's knee wall
    K.api.ghostBox(-9, 20.72, 2.0, 0.55, 0.9, { pen: 4 });
    hgModel(api, "hg-candyshop", { bounce: { HG_Floorboards: 0.1 } });
    // the sign on the false front's panel
    const sign = new THREE.MeshBasicMaterial({ map: signTexture(["TROLL & TREAT"], { fg: "#ffb347", edge: "#8e4dcf", bg: "#1c1024" }), color: 0xffffff });
    K.add(sign, place(new THREE.PlaneGeometry(7.4, 1.35), { x: -6, y: sh + 0.9, z: sz0 - 0.2, ry: Math.PI }), { shadow: false });
    // striped awnings over the windows, the left one clear of the bay's cap
    for (const [ax, aw] of [[-9, 2.8], [-2.9, 2.4]]) {
      K.box(M.awningPurple, ax, 2.78, sz0 - 0.45, aw, 0.04, 1.0, { rx: -0.35 });
    }
    // inside: counter, shelves of jars, a cauldron of candy
    K.solid(-8.4, 25.1, 2.8, 0.8, 1.05, { pen: 1.8 });
    K.solid(-7.6, 27.0, 4.6, 0.5, 2.2, { pen: 2 });
    const C = rng(31);
    for (let shelf = 0; shelf < 3; shelf++) {
      for (let i = 0; i < 9; i++) {
        const hue = new THREE.Color().setHSL(C(), 0.75, 0.55);
        const jarX = -9.6 + i * 0.5, jarY = 0.45 + shelf * 0.62;
        K.add(M.candy, place(new THREE.CylinderGeometry(0.13, 0.13, 0.32, 10), { x: jarX, y: jarY + 0.16, z: 26.9 }), { color: hue.getHex(), shadow: false });
      }
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
    // a lantern on a bracket by the back door
    lantern(K, M, -2.45, 2.2, 27.88, { hang: 0.5, seed: 77, pool: 2.2 });
    K.box(M.iron, -2.45, 2.72, 27.7, 0.03, 0.03, 0.4);
  }

  /* ------------------------------------------------ the barn (SE) */
  {
    // board-and-batten red barn, gambrel roof, cupola, sliding doors
    // (hg-barn) over these colliders. The west door is 2.2 tall so the
    // loft over it can have a window onto the south road.
    const bx0 = 17, bx1 = 29, bz0 = 20, bz1 = 29, bh = 4.4, t = 0.35;
    const B = { t };
    wall(K, { axis: "x", at: bz0 + t / 2, a: bx0, b: bx1, h: bh, out: -1, ...B, holes: [{ c: 23, w: 4, spans: [[0, 3.6]] }] });
    wall(K, { axis: "x", at: bz1 - t / 2, a: bx0, b: bx1, h: bh, out: 1, ...B, holes: [{ c: 20, w: 1.2, spans: [[1.8, 2.8]] }, { c: 26, w: 1.2, spans: [[1.8, 2.8]] }] });
    wall(K, { axis: "z", at: bx0 + t / 2, a: bz0 + t, b: bz1 - t, h: bh, out: -1, ...B, holes: [{ c: 24.5, w: 3, spans: [[0, 2.2]] }, { c: 22, w: 1.4, spans: [[3.0, 4.25]] }] });
    wall(K, { axis: "z", at: bx1 - t / 2, a: bz0 + t, b: bz1 - t, h: bh, out: 1, ...B, holes: [{ c: 26, w: 1.6, spans: [[0, 2.4]] }, { c: 22.5, w: 1.2, spans: [[1.8, 2.8]] }] });
    K.solid(23, 24.5, 12.4, 9.4, 0.3, { y: bh, pen: 8 });
    hgModel(api, "hg-barn", { wash: { color: 0xff7a2a, top: 1.2, strength: 0.07 }, bounce: { HG_BarnWood: 0.32 } });
    K.add(M.hay, place(new THREE.PlaneGeometry(11.2, 8.2), { x: 23, y: 0.02, z: 24.5, rx: -Math.PI / 2 }), { shadow: false });
    // the vane's little troll head
    K.add(M.trollLit, place(new THREE.PlaneGeometry(0.26, 0.26), { x: 22.95, y: 10.25, z: 24.5 - 0.012 }), { shadow: false });
    // the loft over the west end (zombies: its own floor, BARN_LOFT), a
    // steep plank stair up its east edge, a rail with a gap at the top
    const LOFT = BARN_LOFT;
    K.solid((LOFT.x0 + LOFT.x1) / 2, (LOFT.z0 + LOFT.z1) / 2, LOFT.x1 - LOFT.x0, LOFT.z1 - LOFT.z0, 0.15, { y: LOFT.y - 0.15, pen: 3 });
    for (const pz of [LOFT.z0 + 0.12, LOFT.z1 - 0.12]) K.solid(LOFT.x1 - 0.1, pz, 0.2, 0.2, LOFT.y - 0.15, { pen: 4 });
    // The stair climbs west, straight at the loft's edge (no rail beside
    // it: a zombie walking up it must not have one between it and you).
    api.stairs(24.4, 27.7, 1.0, 8, 0.3, 0.42, "-x", { ghost: true });
    K.api.ghostBox(20.72, 27.7, 0.64, 1.0, LOFT.y, { pen: 6 });
    K.api.ghostBox(LOFT.x1 - 0.04, (LOFT.z0 + 27.1) / 2, 0.1, 27.1 - LOFT.z0, 1.05, { y: LOFT.y, pen: 0.3 });
    hayBale(K, M, 19.4, 20.85, { y: LOFT.y });
    hayBale(K, M, 18.3, 27.6, { y: LOFT.y, ry: 0.1 });
    hayBale(K, M, 18.3, 27.6, { y: LOFT.y + 0.75, ry: -0.08, collide: false });
    // a lantern hung over the loft, another by the west door
    lantern(K, M, 18.9, 3.25, 24.5, { hang: 1.1, floor: LOFT.y, seed: 75, pool: 2.4 });
    lantern(K, M, 16.62, 2.3, 22.6, { hang: 0.55, seed: 76, pool: 2.2 });
    K.box(M.iron, 16.75, 2.83, 22.6, 0.3, 0.03, 0.03);
    // stall partitions along the east wall
    for (const pz of [23.3, 24.9]) K.api.ghostBox(27.75, pz, 2.0, 0.1, 1.05, { pen: 1.5 });
    // hay stacks under the loft, a wagon
    K.solid(18.6, 27.4, 2.6, 2.2, 1.5, { pen: 1.5 });
    for (let i = 0; i < 4; i++) hayBale(K, M, 18.0 + (i % 2) * 1.3, 26.9 + Math.floor(i / 2) * 0.9, { y: 0, collide: false });
    for (let i = 0; i < 2; i++) hayBale(K, M, 18.6, 27.35, { y: 0.75, ry: i * 0.1, collide: false });
    hayBale(K, M, 27, 21.6, { ry: Math.PI / 2 });
    hayBale(K, M, 27, 21.6, { y: 0.75, ry: Math.PI / 2 + 0.1 });
    hayBale(K, M, 27.6, 27.9, {});
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
  buildPark(api, K, M, SP, root, lights);
  buildMansion(api, K, M, SP, root, lights);
  buildMountain(api, K, M, SP, root, lights);
  buildCoaster(api, K, M, SP, root, lights);
  placeMannequins(api, { nightFx });

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

  // the night look on everything built so far, the ground plane too (it is
  // maps.js's, beside our root); models patch themselves as they stream in
  (root.parent || root).traverse((n) => {
    if (n.isMesh) for (const m of [].concat(n.material)) nightFx(m);
  });

  /* ------------------------------------------------ zombie entry points */
  // out of the woods, all round the edge (south: between the lane's houses)
  for (const [x, z] of [
    [-40, -44.3], [-24, -44.3], [-12, -44.3], [12, -44.3], [24, -44.3], [40, -44.3],
    [54, -44.3], [66, -44.3], [78, -44.3], [58, 44.3],
    [86.2, -38], [86.2, -24], [86.2, -10], [86.2, 14], [86.2, 27],
    [-50.2, -32], [-50.2, -8], [-50.2, 10], [-50.2, 35],
    [-41, 44.3], [-21.7, 44.3], [-9, 44.3], [9, 44.3], [21.7, 44.3], [35, 44.3],
  ]) ZSPAWNS.push({ x, y: 0, z });
  // the park (6f): they claw up in front of the pet cemetery, out of the
  // splash pool, in the cave under Skull Mountain and under the coaster
  for (const [x, z] of [[65.6, 33.1], [70.6, 33.1], [65.2, 41.1], [75.1, 33.0], [57, -26], [64, -36]]) {
    ZSPAWNS.push({ x, y: 0, z, rise: true });
  }
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
  sun: { color: 0xb4c4ff, intensity: 1.75, pos: [-30, 40, -60] },
  hemi: { sky: 0x6c78c0, ground: 0x3a2a24, intensity: 1.25 },
  ambient: { color: 0x6a5a8a, intensity: 0.35 },
  build: buildHollowgrin,
  onShot: (p) => { for (const f of SHOT_HOOKS) f(p); },
  // the game's mixer, for the mansion's scare sting
  attachAudio: (a) => { AUDIO = a; },
  // Team spawns: six along the north edge and one in the park's north
  // end; six on Trick-or-Treat Lane and one in the park's south end.
  spawns: [[-31, -42.5], [-20, -42], [-12.5, -36.5], [12.5, -36.5], [20, -42], [31, -42.5], [70, -41],
    [-30, 35], [-18, 35], [-6.5, 35], [6.5, 35], [18, 35], [30, 35], [60.5, 38.2]],
  // the pond and the creek: wade through them
  wade: wadePolygon(),

  // For zombies.js: graves and woods on the ground, the manor's upstairs
  // windows, and the grand stair joining the two floors.
  zombieLayout: () => ({
    windows: ZSPAWNS.map((w) => ({ ...w })),
    floorOf: hgFloorOf,
    floors: HG_FLOORS,
    links: [{ from: "ground", to: "upper", a: { x: STAIR.x, z: STAIR.z + 0.9 }, b: { x: STAIR.x, z: HOLE.z0 - 1.0 } },
      // the barn loft's stair: straight up it from the foot to the landing
      // (its foot is 0.9 m east of the first step, 1.3 m in from the south
      // wall: a zombie outside the wall can't start climbing through it)
      { from: "ground", to: "loft", a: { x: 25.3, z: 27.7 }, b: { x: 19.6, z: 27.7 } },
      // the Ferris wheel's lamp deck: up its stair from 1.3 m short of the foot
      { from: "ground", to: "wheel", a: { x: 77.2, z: 1.9 }, b: { x: 77.2, z: -6.6 } },
      // the mansion's stair, up the ballroom's west end to the attic
      { from: "ground", to: "mansion", a: { x: 69.0, z: 28.2 }, b: { x: 63.4, z: 28.2 } },
      // the coaster's brake deck: up the maintenance stair
      { from: "ground", to: "brake", a: { x: 82.2, z: -20.1 }, b: { x: 82.2, z: -33.0 } }],
    support: true,
    preferDist: 17,
    navCell: 0.55,
    navPad: 0.3,
    navStep: 0.45,   // what a zombie steps over (zombies.js resolveCircle: 0.5)
  }),
};
