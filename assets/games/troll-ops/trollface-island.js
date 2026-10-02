// Troll Forces — Trollface Island, Troll Royale's map (GREY BOX).
//
// The floating island from the trollface.io world map, about 400 x 300 m.
// Everything is placed where that map has it: its outline, the L-shaped
// shallow lake with the river that pours off the south cliff, the north road
// and the sand path round the south and east, the tree clumps, and eleven
// landmarks (Meme Lab portal ring, Troll City, the Observatory, the Portal,
// the Skate Bowl, Troll Peak, the Cave, the Dock and its tree, the Boat, the
// Gallery pyramid, the U Mad Bro Shop, the Marketplace). Positions are
// written in % of that map's land frame and scaled by P(). Grey boxes sized
// for play, to walk before any art goes in.
//
// No falling off: `edge` (the coastline) keeps everyone on the island, and
// `wade` (the lake) slows you to a wade (both in edge.js). Geometry that
// shares a material is merged into one mesh (GreyKit.flush), so the whole
// island costs a few dozen draws; colliders are plain AABBs laid by the same
// helpers. North is -z.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { insidePolygon } from "./edge.js";
import { SURFACES } from "./surface-textures.js";
import { mapModel } from "./map-models.js";

const BOUNDS = { minX: -205, maxX: 205, minZ: -155, maxZ: 155 };

// % of the world map's land frame -> metres. The map is drawn tilted, so its
// depth is squashed; SZ stretches it back to a roughly 4:3 island.
const SX = 4.54, SZ = 3.62;
const P = (px, py) => [+((px - 50) * SX).toFixed(1), +((py - 47) * SZ).toFixed(1)];
const polyP = (pts) => pts.map(([px, py]) => P(px, py));

// Traced off the map: the top of the island, and the lake with its river.
export const ISLAND_EDGE = polyP([[27.8, 5.6], [64.7, 6.6], [72.5, 9.1], [79.4, 13.6], [83.4, 21.2], [89.1, 26.3], [90.6, 29.3],
  [90.6, 33.3], [88.8, 37.4], [88.1, 42.9], [90.3, 58.1], [93.8, 72.2], [93.8, 76.3], [92.2, 80.8], [85.9, 86.9], [81.3, 86.9],
  [79.7, 88.4], [74.1, 87.9], [73.4, 86.4], [67.8, 86.4], [65.9, 84.8], [55.3, 82.8], [53.4, 81.3], [51.6, 81.3], [48.4, 78.8],
  [45.6, 78.3], [45.3, 77.3], [38.8, 72.7], [31.3, 69.7], [29.1, 67.2], [26.6, 67.2], [21.3, 61.1], [19.4, 60.1], [16.6, 56.1],
  [15.9, 53], [13.1, 48], [13.1, 46.5], [9.4, 41.4], [9.4, 39.9], [8.1, 38.9], [5.6, 34.8], [5.6, 33.8], [6.9, 32.3], [7.2, 29.3],
  [8.8, 26.8], [12.2, 23.2], [14.1, 22.7], [15, 19.7], [20.6, 11.1], [23.4, 8.1]]);
const LAKE_PCT = [[22.8, 35.9], [24.1, 35.9], [27.5, 37.9], [31.3, 38.4], [41.3, 44.4], [44.1, 44.4], [46.9, 46.5], [56.6, 48.5],
  [67.8, 46.5], [71.9, 46.5], [75.6, 44.4], [78.1, 40.9], [78.4, 39.4], [80.3, 38.4], [81.3, 39.9], [81.9, 44.4], [83.4, 48],
  [84.1, 54], [83.4, 58.1], [80.3, 62.1], [70.3, 64.1], [68.8, 65.2], [56.6, 64.1], [50.3, 64.6], [47.8, 70.2], [45.6, 77.3],
  [45, 77.3], [37.2, 72.2], [37.2, 70.7], [39.4, 67.2], [40.9, 63.1], [39.1, 60.1], [33.1, 56.6], [32.5, 54.5], [30.6, 53.5],
  [25, 48], [24.1, 44.9], [24.1, 43.4], [24.7, 42.4], [22.8, 38.9], [22.5, 36.4]];
export const ISLAND_LAKE = polyP(LAKE_PCT);
const RIVER_MOUTH = [P(37.2, 72.2), P(45.6, 77.3)];   // where the river goes over the cliff

// The winding road across the north (Meme Lab to the Observatory), its
// switchback down to the city, and the sand path round the south and east.
const NORTH_ROAD = polyP([[24, 17], [27.5, 14.5], [31.3, 10.1], [41.3, 8.1], [56.3, 7.7], [67.5, 9.1], [69, 12.1], [67.8, 15.2]]);
const SWITCHBACK = polyP([[29.4, 19.2], [30.6, 14.1], [37.5, 11.7], [43.1, 12.5], [41.3, 15.1], [35.6, 16.1], [32.8, 19.2], [36.3, 24.2]]);
const SOUTH_WEST_PATH = polyP([[27, 57], [32.5, 62], [37, 66.5], [37.6, 68.5]]);
const SOUTH_EAST_PATH = polyP([[49.9, 68.5], [55, 72.2], [65, 72.4], [74, 68.5], [79.5, 62.5], [85.6, 52.8], [86.4, 43.3], [85, 38.8], [82, 36.6]]);
const ROADS = [NORTH_ROAD, SWITCHBACK, SOUTH_WEST_PATH, SOUTH_EAST_PATH];

// The landmarks, where the map draws them, and how much room each keeps clear
// of scattered cover and landing spots.
const lm = (px, py, r, name) => { const [x, z] = P(px, py); return { x, z, r, name }; };
export const LANDMARKS = {
  memelab: lm(22, 15.5, 14, "Meme Lab"),
  city: lm(42, 23, 40, "Troll City"),
  observatory: lm(68, 19.5, 13, "The Observatory"),
  portal: lm(76.6, 19.2, 19, "The Portal"),      // nudged in off the cliff
  skate: lm(79, 30, 36, "Skate Bowl"),
  peak: lm(62.5, 35, 33, "Troll Peak"),
  cave: lm(48, 38, 17, "The Cave"),
  dock: lm(27, 37.5, 7, "The Dock"),
  tree: lm(33.6, 34.2, 8, "Old Tree"),
  boat: lm(72, 51.5, 9, "The Boat"),
  gallery: lm(28.2, 59.5, 19, "The Gallery"),    // nudged in off the cliff
  shop: lm(58.5, 68.5, 19, "U Mad Bro Shop"),
  market: lm(82, 74, 26, "The Marketplace"),
  bridge: lm(43.7, 68.5, 6, "The Bridge"),
};

// Tree clumps off the map's tree layers: [px, base py, size].
const TREE_CLUMPS = [[55.4, 21.8, 111], [19.8, 25.2, 31], [22.8, 25.2, 36], [16.7, 25.2, 23], [28.5, 29.8, 37], [40.7, 29.8, 20],
  [37.7, 31.9, 14], [72.6, 37.8, 29], [76, 38.2, 26], [87.1, 39.5, 25], [15.9, 42, 40], [52.7, 74.8, 59], [60.8, 76.5, 75],
  [53.1, 16.4, 69], [59.8, 16, 48], [58.8, 21.8, 11], [74.9, 22.7, 14], [71.5, 23.9, 10], [68.2, 25.6, 9], [14.7, 26.9, 14],
  [33.2, 26.9, 13], [66.1, 26.9, 12], [12.8, 27.7, 13], [26.2, 29.8, 77], [11.2, 31.5, 14], [39.5, 31.5, 13], [11.4, 35.7, 52],
  [14, 36.6, 13], [85.3, 38.2, 16], [13.2, 42.9, 40], [30.6, 66.8, 29], [33.1, 67.6, 48], [56.5, 76.5, 114], [34.4, 27.7, 12],
  [39.3, 29, 10], [78.1, 22.7, 8], [81, 22.7, 9], [57.7, 16.4, 9]];

const CLIFF_DEPTH = 46;
const WATER_Y = 0.34;       // the lake's surface; its floor is the island top (y 0)
const RISE = 0.33;          // stair steps: under movement.js STEP_UP (0.36)

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

/* Batches geometry per material, lays colliders beside it. */
class GreyKit {
  constructor(api, root) { this.api = api; this.root = root; this.parts = new Map(); }
  /* mat null = collider only: a Blender model draws that part. */
  add(geo, mat) {
    if (!mat) { geo.dispose(); return; }
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(geo.index ? geo.toNonIndexed() : geo);
  }
  /* An AABB block, base at y; `collide` false for decoration. */
  box(x, z, w, d, h, mat, { y = 0, collide = true, pen = 0.9 } = {}) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y + h / 2, z);
    this.add(g, mat);
    if (collide) this.api.ghostBox(x, z, w, d, h, { y, pen });
  }
  cyl(x, z, r, h, mat, { y = 0, collide = true, segs = 14, rTop = r } = {}) {
    const g = new THREE.CylinderGeometry(rTop, r, h, segs);
    g.translate(x, y + h / 2, z);
    this.add(g, mat);
    if (collide) this.api.ghostBox(x, z, r * 1.6, r * 1.6, h, { y, pen: 4 });
  }
  /* A round solid (a mountain tier, a dome's drum): the visual cylinder and
     colliders in 3 m strips that follow the circle. */
  disc(x, z, r, h, mat, { y = 0, rTop = r, segs = 28, visual = true } = {}) {
    if (visual) this.cyl(x, z, r, h, mat, { y, rTop, segs, collide: false });
    const n = Math.max(1, Math.ceil((2 * r) / 3)), step = (2 * r) / n;
    for (let i = 0; i < n; i++) {
      const zm = -r + (i + 0.5) * step;
      const hw = Math.sqrt(Math.max(0, r * r - zm * zm));
      if (hw > 0.4) this.api.ghostBox(x, z + zm, hw * 2, step, h, { y, pen: 1.2 });
    }
  }
  /* Stairs down from a platform edge at (x, z), top at `toY`, stepping out
     along (dx, dz) to `fromY`. */
  stairs(x, z, dx, dz, fromY, toY, w, mat) {
    const n = Math.ceil((toY - fromY) / RISE);
    for (let i = 0; i < n; i++) {
      const h = toY - fromY - i * ((toY - fromY) / n);
      const along = (i + 0.5) * 0.5;
      const sx = dx ? 0.5 : w, sz = dz ? 0.5 : w;
      this.box(x + dx * along, z + dz * along, sx, sz, h, mat, { y: fromY });
    }
  }
  /* A room: four walls of thickness t, with door gaps. `doors`: [side, at,
     width] where side is n/s/e/w and `at` is the gap's centre along that
     wall, from the room's centre. */
  room(cx, cz, w, d, h, mat, doors = [], { t = 0.5, y = 0 } = {}) {
    const side = (s, x0, z0, x1, z1) => {
      const along = s === "n" || s === "s" ? "x" : "z";
      const len = along === "x" ? x1 - x0 : z1 - z0;
      const gaps = doors.filter((dr) => dr[0] === s).map(([, at, gw]) => [len / 2 + at - gw / 2, len / 2 + at + gw / 2]).sort((a, b) => a[0] - b[0]);
      let from = 0;
      for (const [g0, g1] of [...gaps, [len, len]]) {
        if (g0 > from + 0.05) {
          const mid = (from + g0) / 2, seg = g0 - from;
          if (along === "x") this.box(x0 + mid, z0, seg, t, h, mat, { y });
          else this.box(x0, z0 + mid, t, seg, h, mat, { y });
        }
        from = g1;
      }
    };
    side("n", cx - w / 2, cz - d / 2, cx + w / 2, cz - d / 2);
    side("s", cx - w / 2, cz + d / 2, cx + w / 2, cz + d / 2);
    side("w", cx - w / 2, cz - d / 2 + t / 2, cx - w / 2, cz + d / 2 - t / 2);
    side("e", cx + w / 2, cz - d / 2 + t / 2, cx + w / 2, cz + d / 2 - t / 2);
  }
  flush() {
    for (const [mat, geos] of this.parts) {
      const mesh = new THREE.Mesh(geos.length === 1 ? geos[0] : mergeGeometries(geos, false), mat);
      mesh.castShadow = !mat.transparent;
      mesh.receiveShadow = true;
      if (mat.transparent) mesh.renderOrder = 3;
      this.root.add(mesh);
      if (geos.length > 1) for (const g of geos) g.dispose();
    }
    this.parts.clear();
  }
}

const shapeOf = (poly) => {
  const s = new THREE.Shape();
  poly.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
  s.closePath();
  return s;
};

/* A flat ribbon along a polyline, `w` wide, just above the grass. */
function ribbon(points, w, y) {
  const geos = [];
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i];
    const len = Math.hypot(bx - ax, bz - az);
    const g = new THREE.PlaneGeometry(w, len);
    g.rotateX(-Math.PI / 2);
    g.rotateY(-Math.atan2(bz - az, bx - ax) + Math.PI / 2);
    g.translate((ax + bx) / 2, y, (az + bz) / 2);
    geos.push(g);
    const c = new THREE.CircleGeometry(w / 2, 16);
    c.rotateX(-Math.PI / 2);
    c.translate(bx, y + 0.002, bz);
    geos.push(c);
  }
  return mergeGeometries(geos.map((g) => g.index ? g.toNonIndexed() : g), false);
}

/* A flat patch (plaza, concrete, sand) `w` x `d` centred on (x, z). */
function patch(x, z, w, d, y) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

function segDist(x, z, ax, az, bx, bz) {
  const ex = bx - ax, ez = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez)));
  return Math.hypot(x - (ax + ex * t), z - (az + ez * t));
}
function edgeDistance(x, z) {
  let best = Infinity;
  for (let i = 0, j = ISLAND_EDGE.length - 1; i < ISLAND_EDGE.length; j = i++) {
    best = Math.min(best, segDist(x, z, ...ISLAND_EDGE[j], ...ISLAND_EDGE[i]));
  }
  return best;
}
const nearRoad = (x, z, pad) => ROADS.some((road) => road.some((p, i) => i && segDist(x, z, ...road[i - 1], ...p) < pad));
// Open ground: on the island, dry, off the roads, clear of every landmark.
const openGround = (x, z, pad) => insidePolygon(ISLAND_EDGE, x, z) && !insidePolygon(ISLAND_LAKE, x, z)
  && edgeDistance(x, z) > pad && !nearRoad(x, z, 4) && Object.values(LANDMARKS).every((l) => Math.hypot(x - l.x, z - l.z) > l.r);

// Twenty landing spots spread over open ground (farthest-point picks from a
// seeded grid), until the plane drops people in.
function spreadSpawns(n) {
  const cand = [];
  for (let x = BOUNDS.minX; x <= BOUNDS.maxX; x += 6) {
    for (let z = BOUNDS.minZ; z <= BOUNDS.maxZ; z += 6) if (openGround(x, z, 8)) cand.push([x, z]);
  }
  const out = [cand[Math.floor(cand.length / 2)]];
  while (out.length < n && out.length < cand.length) {
    let best = null, bestD = -1;
    for (const c of cand) {
      const d = Math.min(...out.map((o) => Math.hypot(c[0] - o[0], c[1] - o[1])));
      if (d > bestD) { bestD = d; best = c; }
    }
    out.push(best);
  }
  return out;
}
const SPAWNS = spreadSpawns(20);

/* ======================================================================
   Map detail pass, phase 2 (2026-10-01): the island's ground and dressing.
   - One ground shader: grass, sand, packed-earth paths and rock patches,
     blended by a mask baked here at build time (2 m a texel: shore and
     coast sand, the roads, worn rings round the landmarks, rock outcrops,
     and a noise channel for colour variation), the textures sampled in
     world space at two scales so the tiling doesn't show.
   - Trees in two kinds (broadleaf, pine) with per-tree tints, textured
     boulder clusters, instanced bushes / grass tufts / flowers (no
     colliders; game.js applyClutter thins them on lower graphics tiers),
     two fenced paddocks, signposts, billboards, grin graffiti.
   ====================================================================== */
const MASK_RES = 2;   // metres a mask texel

function roadDistance(x, z) {
  let best = Infinity;
  for (const road of ROADS) for (let i = 1; i < road.length; i++) best = Math.min(best, segDist(x, z, ...road[i - 1], ...road[i]));
  return best;
}
function lakeEdgeDistance(x, z) {
  let best = Infinity;
  for (let i = 0, j = ISLAND_LAKE.length - 1; i < ISLAND_LAKE.length; j = i++) best = Math.min(best, segDist(x, z, ...ISLAND_LAKE[j], ...ISLAND_LAKE[i]));
  return best;
}
const smooth = (e0, e1, v) => { const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/* Smooth value noise on a lattice of `cell` metres. */
function valueNoise(cell, seed) {
  const r = rng(seed);
  const nx = Math.ceil((BOUNDS.maxX - BOUNDS.minX) / cell) + 2, nz = Math.ceil((BOUNDS.maxZ - BOUNDS.minZ) / cell) + 2;
  const v = Float32Array.from({ length: nx * nz }, () => r());
  return (x, z) => {
    const fx = (x - BOUNDS.minX) / cell, fz = (z - BOUNDS.minZ) / cell;
    const ix = Math.floor(fx), iz = Math.floor(fz);
    const tx = smooth(0, 1, fx - ix), tz = smooth(0, 1, fz - iz);
    const at = (a, b) => v[Math.min(nz - 1, b) * nx + Math.min(nx - 1, a)];
    const top = at(ix, iz) + (at(ix + 1, iz) - at(ix, iz)) * tx;
    const bot = at(ix, iz + 1) + (at(ix + 1, iz + 1) - at(ix, iz + 1)) * tx;
    return top + (bot - top) * tz;
  };
}

/* R sand, G path / worn earth, B rock, A colour noise. */
function groundMask() {
  const W = Math.ceil((BOUNDS.maxX - BOUNDS.minX) / MASK_RES), H = Math.ceil((BOUNDS.maxZ - BOUNDS.minZ) / MASK_RES);
  const data = new Uint8Array(W * H * 4);
  const big = valueNoise(34, 11), small = valueNoise(9, 12);
  const L = LANDMARKS;
  const sandy = [[L.portal.x, L.portal.z, 15, 12], [L.tree.x, L.tree.z, 9, 7]];
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = BOUNDS.minX + (i + 0.5) * MASK_RES, z = BOUNDS.minZ + (j + 0.5) * MASK_RES;
      const o = (j * W + i) * 4;
      if (!insidePolygon(ISLAND_EDGE, x, z)) { data[o] = 255; continue; }
      const inLake = insidePolygon(ISLAND_LAKE, x, z);
      let sand = Math.max(smooth(13, 5, edgeDistance(x, z)), inLake ? 1 : smooth(11, 4, lakeEdgeDistance(x, z)));
      for (const [sx, sz, hw, hd] of sandy) {
        const dx = Math.abs(x - sx) - hw, dz = Math.abs(z - sz) - hd;
        sand = Math.max(sand, smooth(3, -1, Math.max(dx, dz)));
      }
      let path = smooth(4.4, 1.8, roadDistance(x, z));
      for (const l of Object.values(L)) {
        const d = Math.hypot(x - l.x, z - l.z) - l.r * 0.85;
        path = Math.max(path, smooth(7, 0, Math.abs(d)) * 0.55);
      }
      const nb = big(x, z), ns = small(x, z);
      const rock = smooth(0.66, 0.8, nb) * (1 - path) * smooth(8, 16, edgeDistance(x, z)) * (inLake ? 0 : 1);
      data[o] = Math.round(sand * 255);
      data[o + 1] = Math.round(path * 255);
      data[o + 2] = Math.round(rock * 255);
      data[o + 3] = Math.round((ns * 0.6 + nb * 0.4) * 255);
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/* The island top: four textures blended by the mask, in world space. */
function groundMaterial(mask) {
  const S = SURFACES;
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, {
      tGrass: { value: S.grass.color }, tSand: { value: S.sand.color }, tDirt: { value: S.dirt.color },
      tRock: { value: S.rock.color }, tMask: { value: mask },
      uBounds: { value: new THREE.Vector4(BOUNDS.minX, BOUNDS.minZ, 1 / (BOUNDS.maxX - BOUNDS.minX), 1 / (BOUNDS.maxZ - BOUNDS.minZ)) },
    });
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vWXZ;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvWXZ = (modelMatrix * vec4(transformed, 1.0)).xz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
varying vec2 vWXZ;
uniform sampler2D tGrass, tSand, tDirt, tRock, tMask;
uniform vec4 uBounds;`)
      .replace("#include <map_fragment>", `
// Grass everywhere; sand, earth and rock only sampled where the mask asks
// for them (most of the island is plain meadow, so most pixels pay for two
// texture reads). The mask's noise channel breaks up the tiling.
vec2 wuv = vWXZ / 7.0;
vec4 mk = texture2D(tMask, (vWXZ - uBounds.xy) * uBounds.zw);
vec3 g1 = texture2D(tGrass, wuv + mk.a * 0.6).rgb;
vec3 col = g1 * mix(vec3(1.0, 1.32, 0.82), vec3(1.42, 1.36, 0.74), mk.a);
float jit = (g1.g - 0.3) * 0.8;
float wr = smoothstep(0.35, 0.65, mk.b + jit);
float wg = smoothstep(0.3, 0.62, mk.g + jit * 0.7);
float ws = smoothstep(0.3, 0.62, mk.r + jit * 0.7);
if (wr > 0.003) col = mix(col, texture2D(tRock, wuv * 0.6).rgb * vec3(1.15, 1.18, 1.2), wr);
if (wg + ws > 0.003) {
  vec3 sandC = texture2D(tSand, wuv * 0.9).rgb * vec3(1.2, 1.12, 1.0);
  if (wg > 0.003) col = mix(col, mix(texture2D(tDirt, wuv).rgb * vec3(1.45, 1.3, 1.1), sandC, 0.5), wg);
  col = mix(col, sandC, ws);
}
diffuseColor.rgb *= col;`);
  };
  m.customProgramCacheKey = () => "tfi-ground-2";
  return m;
}

/* A tileable texture set as a material with a fixed repeat (UVs in metres). */
function texMaterial(surface, color, metresPerTile, o = {}) {
  const s = SURFACES[surface];
  const tint = new THREE.Color(color);
  const mk = (t) => { const c = t.clone(); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(1 / metresPerTile, 1 / metresPerTile); c.needsUpdate = true; return c; };
  return new THREE.MeshStandardMaterial({ color: tint, map: mk(s.color), normalMap: mk(s.normal), roughnessMap: mk(s.rough), roughness: 1, ...o });
}

/* UVs from world x/z in metres (for flat patches merged into one mesh). */
function worldUV(g) {
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i), p.getZ(i));
  return g;
}

/* Give a geometry one vertex colour (for tinting merged trees). */
function tinted(g, hex) {
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(a, 3));
  return g;
}

/* Lumpy: push each vertex out or in a little (same vertex, same push). */
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

/* A canvas texture of grass blades, for the tufts. */
function tuftTexture() {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 64;
  const g = c.getContext("2d");
  const r = rng(77);
  for (let k = 0; k < 22; k++) {
    const x = 6 + r() * 52, lean = (r() - 0.5) * 16, h = 30 + r() * 30;
    g.strokeStyle = `hsl(${100 + r() * 30}, ${55 + r() * 20}%, ${38 + r() * 22}%)`;
    g.lineWidth = 2 + r() * 2;
    g.beginPath();
    g.moveTo(x, 64);
    g.quadraticCurveTo(x + lean * 0.3, 64 - h * 0.6, x + lean, 64 - h);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* The signposts' boards: one canvas atlas, a row a name. */
function signAtlas(names) {
  const c = document.createElement("canvas");
  const rowH = 64;
  c.width = 512; c.height = rowH * names.length;
  const g = c.getContext("2d");
  names.forEach((name, i) => {
    const y = i * rowH;
    g.fillStyle = "#e9d8a6"; g.fillRect(0, y, 512, rowH);
    g.fillStyle = "#c9b27a"; for (let k = 0; k < 4; k++) g.fillRect(0, y + 8 + k * 14, 512, 2);
    g.strokeStyle = "#5a4224"; g.lineWidth = 6; g.strokeRect(3, y + 3, 506, rowH - 6);
    g.fillStyle = "#2b2116";
    g.font = "bold 34px Impact, 'Arial Black', sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(name.toUpperCase(), 256, y + rowH / 2 + 2);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return { tex: t, rows: names.length };
}

/* The U Mad Bro Shop's neon lettering, glow and all, on a clear canvas (the
   board and its bulbs are the model). Made once a page: maps dispose their
   materials on unload, never textures. */
let neonTex = null;
function neonSignTexture() {
  if (neonTex) return neonTex;
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 408;
  const g = c.getContext("2d");
  g.textAlign = "center"; g.textBaseline = "middle";
  const line = (text, y, size) => {
    g.font = `900 ${size}px Impact, 'Arial Black', sans-serif`;
    g.lineJoin = "round";
    for (const [blur, col] of [[38, "rgba(80,255,60,0.9)"], [16, "rgba(120,255,90,0.9)"]]) {
      g.shadowColor = col; g.shadowBlur = blur;
      g.fillStyle = "#5dff48"; g.fillText(text, 512, y);
    }
    g.shadowBlur = 0;
    g.lineWidth = 5; g.strokeStyle = "#1d7a12"; g.strokeText(text, 512, y);
    g.fillStyle = "#b9ff9e"; g.fillText(text, 512, y);
  };
  line("U MAD BRO", 118, 132);
  line("SHOP", 290, 190);
  neonTex = new THREE.CanvasTexture(c);
  neonTex.colorSpace = THREE.SRGBColorSpace;
  neonTex.anisotropy = 4;
  return neonTex;
}

/* Meme Lab's portal: a white crayon spiral on electric blue (the art's
   swirl), drawn once a page. */
let swirlTex = null;
function swirlTexture() {
  if (swirlTex) return swirlTex;
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  const r = rng(0x5717);
  const grad = g.createRadialGradient(256, 256, 20, 256, 256, 256);
  grad.addColorStop(0, "#9ff4ff"); grad.addColorStop(0.55, "#2fd4ff"); grad.addColorStop(1, "#1aa8f0");
  g.fillStyle = grad; g.fillRect(0, 0, 512, 512);
  g.lineCap = "round"; g.lineJoin = "round";
  // a few loose passes of the spiral, like the art's crayon strokes
  for (let pass = 0; pass < 5; pass++) {
    g.strokeStyle = `rgba(255,255,255,${0.55 + r() * 0.4})`;
    g.lineWidth = 16 + r() * 14;
    g.beginPath();
    for (let a = 0.6; a < Math.PI * 6.6; a += 0.05) {
      const rad = 12 + a * 12.8 + (r() - 0.5) * 6;
      const px = 256 + Math.cos(a + pass * 0.08) * rad, py = 256 + Math.sin(a + pass * 0.08) * rad;
      if (a === 0.6) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.stroke();
  }
  for (let k = 0; k < 900; k++) {                                   // crayon grain
    g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.35)" : "rgba(20,150,220,0.35)";
    g.fillRect(r() * 512, r() * 512, 2 + r() * 4, 2);
  }
  swirlTex = new THREE.CanvasTexture(c);
  swirlTex.colorSpace = THREE.SRGBColorSpace;
  swirlTex.anisotropy = 4;
  return swirlTex;
}

/* The Portal's door: lime green with pale rounded rings, like the art. */
let doorTex = null;
function portalDoorTexture() {
  if (doorTex) return doorTex;
  const c = document.createElement("canvas");
  c.width = 384; c.height = 512;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(192, 256, 30, 192, 256, 300);
  grad.addColorStop(0, "#c6ff7a"); grad.addColorStop(0.6, "#7dff3a"); grad.addColorStop(1, "#4fe024");
  g.fillStyle = grad; g.fillRect(0, 0, 384, 512);
  g.strokeStyle = "#f2ffd0"; g.lineWidth = 14; g.strokeRect(7, 7, 370, 498);
  g.lineCap = "round";
  const rr = (w, h, rad) => {
    const x = 192 - w / 2, y = 256 - h / 2;
    g.beginPath(); g.roundRect(x, y, w, h, rad);
  };
  for (const [w, h, dash] of [[250, 360, [70, 26]], [160, 240, [46, 22]], [80, 130, [30, 18]]]) {
    g.strokeStyle = "rgba(236,255,200,0.9)"; g.lineWidth = 9; g.setLineDash(dash);
    rr(w, h, w * 0.4); g.stroke();
  }
  g.setLineDash([]);
  doorTex = new THREE.CanvasTexture(c);
  doorTex.colorSpace = THREE.SRGBColorSpace;
  doorTex.anisotropy = 4;
  return doorTex;
}

/* A trollface grin sprayed on the ground (decal texture). */
function grinTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.strokeStyle = "rgba(255,255,255,0.92)"; g.lineCap = "round"; g.lineJoin = "round";
  g.lineWidth = 9;
  g.beginPath(); g.ellipse(128, 132, 104, 96, 0, 0, Math.PI * 2); g.stroke();             // face
  g.lineWidth = 8;
  g.beginPath(); g.moveTo(52, 140); g.quadraticCurveTo(128, 236, 206, 132); g.lineTo(52, 140); g.stroke();   // the grin
  for (let k = 0; k < 7; k++) { const x = 70 + k * 19; g.beginPath(); g.moveTo(x, 142); g.lineTo(x + 2, 168 + Math.sin(k / 6 * Math.PI) * 16); g.stroke(); }
  g.lineWidth = 7;
  for (const ex of [88, 168]) { g.beginPath(); g.ellipse(ex, 92, 20, 10, ex < 128 ? 0.25 : -0.25, 0, Math.PI * 2); g.stroke(); }
  g.beginPath(); g.moveTo(62, 66); g.lineTo(108, 76); g.moveTo(194, 66); g.lineTo(148, 76); g.stroke();      // brows
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildTrollfaceIsland(api) {
  const root = new THREE.Group();
  api.prop(root);
  const K = new GreyKit(api, root);
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...o });
  const M = {
    cliff: std(0x3b404b),
    lakebed: std(0x49b8d8, { roughness: 1 }),
    water: new THREE.MeshStandardMaterial({ color: 0x3cc8ff, roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.7, depthWrite: false }),
    falls: new THREE.MeshBasicMaterial({ color: 0xa6e6ff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
    greyDark: std(0x8b8f98, { roughness: 0.85 }),
    wood: std(0x9a7b55),
    trunk: std(0x6b4a2e),
    glass: new THREE.MeshStandardMaterial({ color: 0x9fdcff, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
  };
  const L = LANDMARKS;

  /* ---- the island: grass top, cliff sides, lake, river, waterfall ------- */
  const slab = new THREE.ExtrudeGeometry(shapeOf(ISLAND_EDGE), { depth: CLIFF_DEPTH, bevelEnabled: false, curveSegments: 1 });
  slab.rotateX(-Math.PI / 2);
  slab.translate(0, -CLIFF_DEPTH, 0);
  // Phase 2: the textured, blended ground and rock cliffs (UVs are metres).
  const ground = groundMaterial(groundMask());
  const cliffRock = texMaterial("rock", 0xd2d6e0, 9);
  const island = new THREE.Mesh(slab, [ground, cliffRock]);
  island.receiveShadow = true;
  root.add(island);
  const under = new THREE.ConeGeometry(150, 70, 9);
  under.rotateX(Math.PI);
  under.scale(1.25, 1, 0.9);
  under.translate(0, -CLIFF_DEPTH - 35, 0);
  root.add(new THREE.Mesh(under, M.cliff));

  const bed = new THREE.ShapeGeometry(shapeOf(ISLAND_LAKE));
  bed.rotateX(-Math.PI / 2);
  bed.translate(0, 0.012, 0);
  root.add(Object.assign(new THREE.Mesh(bed, M.lakebed), { receiveShadow: true }));
  const water = new THREE.ShapeGeometry(shapeOf(ISLAND_LAKE));
  water.rotateX(-Math.PI / 2);
  water.translate(0, WATER_Y, 0);
  const waterMesh = new THREE.Mesh(water, M.water);
  waterMesh.renderOrder = 2;
  root.add(waterMesh);
  // The waterfall: a sheet hanging off the cliff where the river meets it.
  {
    const [[ax, az], [bx, bz]] = RIVER_MOUTH;
    const len = Math.hypot(bx - ax, bz - az), hgt = CLIFF_DEPTH + 60;
    const g = new THREE.PlaneGeometry(len + 2, hgt);
    g.rotateY(-Math.atan2(bz - az, bx - ax));
    const nx = -(bz - az) / len, nz = (bx - ax) / len;   // outward: away from the lake
    g.translate((ax + bx) / 2 + nx * 0.8, WATER_Y - hgt / 2, (az + bz) / 2 + nz * 0.8);
    root.add(new THREE.Mesh(g, M.falls));
  }
  // The beach all round the shore (not over the waterfall's lip).
  const mouth = LAKE_PCT.findIndex(([px, py]) => px === 37.2 && py === 72.2);
  const shore = [...ISLAND_LAKE.slice(mouth), ...ISLAND_LAKE.slice(0, mouth - 1)];
  void shore;   // (the beach is in the ground mask now: phase 2)

  /* ---- roads, paths and paved ground ----------------------------------- */
  // Roads and paths are in the ground mask (phase 2); plazas are textured.
  const paved = [
    patch(L.city.x, L.city.z, 76, 46, 0.025),
    patch(L.skate.x, L.skate.z, 62, 38, 0.025),
    patch(L.gallery.x, L.gallery.z, 34, 32, 0.025),
    patch(L.shop.x, L.shop.z + 2, 40, 24, 0.025),
  ];
  const plaza = texMaterial("cast", 0xe6e3dc, 5, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  root.add(Object.assign(new THREE.Mesh(mergeGeometries(paved.map(worldUV), false), plaza), { receiveShadow: true }));

  /* ---- landmarks (grey boxes, sized for play) ---------------------------- */

  // Meme Lab: the blue ring portal on its platform, with the solar panel.
  // Drawn by tf-memelab (models/build_island.blender.py); the swirl is a
  // canvas.
  {
    const { x, z } = L.memelab;
    K.box(x, z, 18, 12, 1.32, null);
    K.stairs(x, z + 6, 0, 1, 0, 1.32, 4, null);
    K.stairs(x + 9, z, 1, 0, 0, 1.32, 4, null);
    const swirl = new THREE.CircleGeometry(5.3, 48);
    swirl.rotateY(-0.6);
    swirl.translate(x - 2, 1.32 + 6.7, z - 1);
    K.add(swirl, new THREE.MeshBasicMaterial({ map: swirlTexture(), side: THREE.DoubleSide }));
    K.box(x - 2, z - 1, 2.4, 1.6, 1.4, null, { y: 1.32 });                  // the ring's foot
    K.box(x + 5, z + 1.5, 1, 1, 1.4, null, { y: 1.32 });                    // the panel's stand
    mapModel(api, "tf-memelab", { x, z });
  }

  // Troll City: the black trollface dome among blue and yellow towers, some
  // with a lobby you can run through. Drawn by tf-city + tf-cityface
  // (models/build_island.blender.py, its TOWERS list copies these numbers).
  {
    const { x, z } = L.city;
    K.disc(x, z, 11, 5, null);                                              // the dome's drum...
    K.disc(x, z, 8, 5.5, null, { y: 5 });                                   // ...and its crown
    const tower = (dx, dz, w, d, h, doors) => {
      if (doors) {
        K.room(x + dx, z + dz, w, d, 4, null, doors);
        K.box(x + dx, z + dz, w, d, h - 4, null, { y: 4 });
        K.box(x + dx - w / 4, z + dz, 1, 1, 4, null);                      // a pillar for cover inside
      } else K.box(x + dx, z + dz, w, d, h, null);
    };
    tower(-24, -2, 9, 9, 18, [["e", 0, 3], ["s", 0, 3]]);
    tower(-22, 11, 8, 8, 12);
    tower(-33, 6, 8, 10, 24, [["n", 0, 3], ["e", 1, 2.6]]);
    tower(4, -17, 10, 8, 22, [["s", 0, 3], ["w", 0, 2.6]]);
    tower(15, -15, 5, 5, 40);
    tower(-6, -18, 8, 7, 16);
    tower(22, 4, 9, 9, 20, [["w", 0, 3], ["s", 2, 2.6]]);
    tower(31, -5, 8, 8, 14);
    tower(27, 14, 8, 8, 10, [["n", 0, 3]]);
    mapModel(api, "tf-city", { x, z });
    mapModel(api, "tf-cityface", { x, z });
  }

  // The Observatory: a grey-blue house under a white dome, the telescope out
  // of it. Drawn by tf-observatory.
  {
    const { x, z } = L.observatory;
    K.room(x, z, 14, 14, 6, null, [["s", 0, 3], ["n", 2, 2.6]]);
    K.box(x, z, 14.6, 14.6, 0.5, null, { y: 6 });
    K.disc(x, z, 5.4, 5, null, { y: 6.5, visual: false });
    K.box(x - 2, z - 2, 3, 3, 1.2, null);                                   // the mount, inside
    mapModel(api, "tf-observatory", { x, z });
  }

  // The Portal: the stone gateway on a sandy rock plateau. Drawn by
  // tf-portal; the green door is a canvas.
  {
    const { x, z } = L.portal;
    K.box(x, z, 26, 20, 2.31, null);
    K.stairs(x - 4, z + 10, 0, 1, 0, 2.31, 4, null);
    K.stairs(x - 13, z + 4, -1, 0, 0, 2.31, 4, null);
    K.box(x + 2, z - 5, 12, 7, 4.62, null, { y: 0 });
    K.stairs(x + 2, z - 1.5, 0, 1, 2.31, 4.62, 3.4, null);
    K.box(x - 1.5, z - 5, 1, 1, 8, null, { y: 4.62 });
    K.box(x + 5.5, z - 5, 1, 1, 8, null, { y: 4.62 });
    K.box(x + 2, z - 5, 8, 1, 1, null, { y: 12.62 });
    const door = new THREE.PlaneGeometry(6, 8);
    door.translate(x + 2, 4.62 + 4, z - 5);
    K.add(door, new THREE.MeshBasicMaterial({ map: portalDoorTexture(), side: THREE.DoubleSide }));
    for (const [dx, dz, s] of [[-10, -7, 2.2], [9, 6, 1.8], [11, -8, 2.6], [-7, 7, 1.5]]) {
      api.ghostBox(x + dx, z + dz, s * 1.6, s * 1.6, s * 1.2, { y: 2.31, pen: 6 });
    }
    mapModel(api, "tf-portal", { x, z });
  }

  // Skate Bowl: a walled concrete park, ramps, rails and ledges inside, a
  // little stand on the north rim. Drawn by tf-skate.
  {
    const { x, z } = L.skate;
    K.room(x, z, 60, 36, 1.1, null, [["s", -12, 6], ["w", 4, 6], ["e", 0, 6], ["n", 16, 5]]);
    // Two funboxes: stairs up both ends of a raised deck.
    for (const [dx, dz] of [[-14, -4], [12, 6]]) {
      K.box(x + dx, z + dz, 10, 5, 1.65, null);
      K.stairs(x + dx - 5, z + dz, -1, 0, 0, 1.65, 5, null);
      K.stairs(x + dx + 5, z + dz, 1, 0, 0, 1.65, 5, null);
    }
    K.box(x + 2, z - 8, 12, 0.4, 0.7, null);                                 // rails
    K.box(x - 4, z + 10, 10, 0.4, 0.7, null);
    K.box(x + 20, z - 8, 6, 3, 1, null);                                     // ledges
    K.box(x - 22, z + 9, 3, 7, 1, null);
    for (let t = 0; t < 3; t++) K.box(x - 6, z - 19.5 - t * 1.4, 26, 1.4, 0.66 * (t + 1), null);
    mapModel(api, "tf-skate", { x, z });
  }

  // Troll Peak: a terraced purple mountain, stairs round it from terrace to
  // terrace, and a snowy summit with the flag you can't climb.
  {
    const { x, z } = L.peak;
    // Terraces: [radius, top]. Each ring is as wide as the flight up to the
    // next is long (0.5 m a step), so no flight overhangs the ring below.
    const tiers = [[22, 4.62], [15, 8.58], [9, 12.21]];
    // Drawn by tf-peak (models/build_island.blender.py: TIERS, the summit,
    // the flag and these three flights step for step).
    for (const [rad, top] of tiers) K.disc(x, z, rad - 0.6, top, null, { visual: false });
    K.disc(x, z, 7.6, 26, null, { y: 12.21, visual: false });
    K.stairs(x, z + 21.4, 0, 1, 0, 4.62, 4, null);
    K.stairs(x + 14.4, z, 1, 0, 4.62, 8.58, 4, null);
    K.stairs(x, z - 8.4, 0, -1, 8.58, 12.21, 4, null);
    mapModel(api, "tf-peak", { x, z });
  }

  // The Cave: a rock mound with a tunnel through it (in from the south), and
  // a side chamber off the tunnel. Drawn by tf-cave.
  {
    const { x, z } = L.cave;
    K.box(x - 6.5, z, 8, 22, 6, null);                                           // west
    K.box(x + 6.5, z - 7, 8, 8, 6, null);                                        // east, split
    K.box(x + 6.5, z + 7, 8, 8, 6, null);
    K.box(x + 9.25, z, 2.5, 6, 6, null);
    K.box(x, z, 5, 22, 2.8, null, { y: 3.2 });                                   // roofs
    K.box(x + 5.25, z, 5.5, 6, 2.8, null, { y: 3.2 });
    mapModel(api, "tf-cave", { x, z });
  }

  // The Dock: a jetty out into the lake, turning east. Drawn by tf-dock (its
  // origin is the jetty's shore end, x0 z0).
  {
    const [x0] = P(27, 0), [, z0] = P(0, 36), [, z1] = P(0, 42), [x1] = P(33, 0);
    K.box(x0, z0 - 0.5, 3.6, 1, 0.33, null);
    K.box(x0, (z0 + z1) / 2, 3.6, z1 - z0, 0.66, null);
    K.box((x0 + x1) / 2 + 1.8, z1 + 1.8 - 1.8, x1 - x0, 3.6, 0.66, null);
    K.box(x1 - 2, z1, 1.4, 1.4, 1.1, null, { y: 0.66 });                      // a crate
    mapModel(api, "tf-dock", { x: x0, z: z0 });
  }

  // Old Tree: the big one on the sand by the dock, a tyre swing off its long
  // branch. Drawn by tf-tree.
  {
    const { x, z } = L.tree;
    K.cyl(x, z, 0.8, 5, null, { segs: 8 });
    mapModel(api, "tf-tree", { x, z });
  }

  // The Boat: a sailboat on the lake; steps up the stern, a cabin on deck.
  // Drawn by tf-boat.
  {
    const { x, z } = L.boat;
    K.box(x, z, 17, 5.6, 1.32, null);
    api.ghostBox(x + 10, z, 3, 3.2, 1.32, { pen: 1.2 });                      // the pointed bow
    K.stairs(x - 8.5, z, -1, 0, 0, 1.32, 2.4, null);
    K.box(x + 3, z, 5, 3.6, 1.9, null, { y: 1.32 });                         // the cabin
    K.cyl(x - 1, z, 0.25, 18, null, { y: 1.32, segs: 8 });
    mapModel(api, "tf-boat", { x, z });
  }

  // The Gallery: a glass pyramid over a plinth, doors north and south.
  {
    const { x, z } = L.gallery;
    // Glass here (the walls are its colliders); frames, floor, plinths, art,
    // ropes and spotlights are tf-gallery (models/build_island.blender.py).
    K.room(x, z, 26, 26, 3.4, M.glass, [["s", 0, 3.4], ["n", 0, 3.4]]);
    const pyr = new THREE.ConeGeometry(26 / Math.SQRT2, 14.6, 4, 1, true);   // base on the walls, apex at 18
    pyr.rotateY(Math.PI / 4);
    pyr.translate(x, 3.4 + 7.3, z);
    K.add(pyr, M.glass);
    for (const [dx, dz] of [[-6, -5], [6, -5], [0, 4], [-7, 7], [7, 7]]) K.box(x + dx, z + dz, 1.6, 1.6, 1.3, null);   // plinths
    mapModel(api, "tf-gallery", { x, z });
    // the centrepiece: the white trollface bust (Hollowgrin's Meme Gallery
    // carving) on the middle plinth, facing the south door
    mapModel(api, "hg-trollbust", { x, z: z + 4, y: 1.3, scale: 0.9 });
  }

  // The U Mad Bro Shop: a big store with its sign lit up on the roof.
  {
    const { x, z } = L.shop;
    // Drawn by tf-shop (models/build_island.blender.py); the sign's neon
    // lettering is a canvas on its black board, over the front doors.
    K.room(x, z, 26, 14, 6.5, null, [["s", 0, 4], ["n", -6, 3], ["e", 0, 2.6]]);
    K.box(x, z, 26.6, 14.6, 0.5, null, { y: 6.5 });
    for (let i = 0; i < 3; i++) K.box(x - 7 + i * 7, z - 2, 4.5, 1.2, 1.8, null);   // shelves
    K.box(x + 8, z + 3.5, 5, 1.4, 1.1, null);                                // the counter
    mapModel(api, "tf-shop", { x, z });
    const sign = new THREE.PlaneGeometry(13.6, 5.4);
    sign.translate(x, 8.1, z + 7.6);
    K.add(sign, new THREE.MeshBasicMaterial({ map: neonSignTexture(), transparent: true, depthWrite: false }));
  }

  // The Marketplace: a line of stalls under bright canopies and fairy lights.
  // Drawn by tf-market.
  {
    const { x, z } = L.market;
    for (let t = 0; t < 6; t++) K.box(x - 20 + t * 8, z + 12 - t * 5, 4.4, 2, 1.1, null);
    mapModel(api, "tf-market", { x, z });
  }

  // The Bridge: over the river on the south path, rails both sides. Drawn by
  // tf-bridge (its origin is the deck's middle).
  {
    const [xa] = P(37.6, 0), [xb] = P(49.9, 0), { z } = L.bridge;
    const len = xb - xa, mid = (xa + xb) / 2;
    K.box(xa - 0.5, z, 1, 5, 0.33, null);
    K.box(xb + 0.5, z, 1, 5, 0.33, null);
    K.box(mid, z, len, 5, 0.66, null);
    K.box(mid, z - 2.4, len, 0.2, 0.9, null, { y: 0.66 });
    K.box(mid, z + 2.4, len, 0.2, 0.9, null, { y: 0.66 });
    mapModel(api, "tf-bridge", { x: mid, z });
  }

  /* ---- cover: the map's tree clumps, and rocks where nothing else is ----- */
  const r = rng(0x7a011f);
  const spawnClear = (x, z) => SPAWNS.every(([sx, sz]) => Math.hypot(x - sx, z - sz) > 4);
  const clear = (x, z, pad) => openGround(x, z, pad) && spawnClear(x, z);
  // Two kinds of tree, each crown its own shade (vertex colours, so they
  // all still merge into one mesh).
  const leaf = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  const LEAF = [0x2f9e44, 0x3fbf62, 0x2a8a3c, 0x58c46a, 0x4caf50, 0x7bc95a];
  const PINE = [0x1f6b45, 0x26805a, 0x1d5c3f, 0x2e7d4f];
  const tree = (x, z) => {
    if (r() < 0.3) {
      const h = 1.6 + r() * 0.8, s = 2.2 + r() * 0.9;
      K.cyl(x, z, 0.3, h + 0.6, M.trunk, { segs: 7 });
      const col = PINE[Math.floor(r() * PINE.length)];
      for (let k = 0; k < 3; k++) {
        const g = new THREE.ConeGeometry(s * (1 - k * 0.24), 2.6, 8);
        g.rotateY(r() * 6);
        g.translate(x, h + 1.1 + k * 1.45, z);
        K.add(tinted(g, new THREE.Color(col).offsetHSL(0, 0, (r() - 0.5) * 0.06).getHex()), leaf);
      }
    } else {
      const h = 2.4 + r() * 1.4, s = 1.7 + r() * 1.0;
      K.cyl(x, z, 0.33, h, M.trunk, { segs: 7, rTop: 0.24 });
      const col = LEAF[Math.floor(r() * LEAF.length)];
      for (let k = 0; k < 3; k++) {
        const ss = s * (0.65 + r() * 0.35);
        const g = lumpy(new THREE.IcosahedronGeometry(ss, 1), r, 0.22);
        g.scale(1, 0.8, 1);
        const a = (k / 3) * Math.PI * 2 + r();
        g.translate(x + Math.cos(a) * s * 0.45, h + ss * 0.55 + k * 0.35, z + Math.sin(a) * s * 0.45);
        K.add(tinted(g, new THREE.Color(col).offsetHSL((r() - 0.5) * 0.02, 0, (r() - 0.5) * 0.08).getHex()), leaf);
      }
    }
  };
  for (const [px, py, n] of TREE_CLUMPS) {
    const [cx, cz] = P(px, py - 1);
    const count = Math.min(6, 2 + Math.floor(n / 25)), spread = 2.5 + Math.sqrt(n) * 0.5;
    for (let k = 0, tries = 0; k < count && tries < 30; tries++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * spread;
      const tx = cx + Math.cos(a) * d, tz = cz + Math.sin(a) * d;
      if (!clear(tx, tz, 4)) continue;
      tree(tx, tz);
      k++;
    }
  }
  // Boulders: textured, each with a couple of smaller stones at its foot.
  const boulder = texMaterial("rock", 0xf4f2ee, 2.2, { flatShading: true });
  let rocks = 0;
  for (let tries = 0; tries < 3000 && rocks < 45; tries++) {
    const x = BOUNDS.minX + r() * (BOUNDS.maxX - BOUNDS.minX), z = BOUNDS.minZ + r() * (BOUNDS.maxZ - BOUNDS.minZ);
    if (!clear(x, z, 5)) continue;
    const s = 0.9 + r() * 1.1;
    const g = lumpy(new THREE.DodecahedronGeometry(s, 1), r, 0.3);
    g.scale(1.3, 0.75, 1);
    g.rotateY(r() * 6);
    g.translate(x, s * 0.42, z);
    K.add(g, boulder);
    api.ghostBox(x, z, s * 2.2, s * 1.8, s * 1.2, { pen: 6 });
    for (let k = 0; k < 2; k++) {
      const ss = 0.25 + r() * 0.3, a = r() * 6;
      const sg = lumpy(new THREE.DodecahedronGeometry(ss, 0), r, 0.3);
      sg.translate(x + Math.cos(a) * s * 1.5, ss * 0.35, z + Math.sin(a) * s * 1.2);
      K.add(sg, boulder);
    }
    rocks++;
  }

  dressIsland(api, root, K, M, r, clear);
  K.flush();
}

/* Instanced clutter, paddocks, signposts, billboards, graffiti (phase 2). */
function dressIsland(api, root, K, M, r, clear) {
  const L = LANDMARKS;
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const scatter = (n, pad, near = null) => {
    const out = [];
    for (let tries = 0; tries < n * 30 && out.length < n; tries++) {
      let x, z;
      if (near && r() < 0.6) {
        const [px, py, size] = near[Math.floor(r() * near.length)];
        const [cx, cz] = P(px, py - 1);
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (4 + Math.sqrt(size));
        x = cx + Math.cos(a) * d; z = cz + Math.sin(a) * d;
      } else {
        x = BOUNDS.minX + r() * (BOUNDS.maxX - BOUNDS.minX);
        z = BOUNDS.minZ + r() * (BOUNDS.maxZ - BOUNDS.minZ);
      }
      if (clear(x, z, pad)) out.push([x, z]);
    }
    return out;
  };
  const instanced = (geo, mat, spots, place, palette) => {
    const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
    spots.forEach(([x, z], i) => {
      place(dummy, x, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (palette) mesh.setColorAt(i, col.set(palette[Math.floor(r() * palette.length)]).offsetHSL(0, 0, (r() - 0.5) * 0.08));
    });
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.userData.clutter = spots.length;    // game.js applyClutter thins this by graphics tier
    mesh.computeBoundingSphere();
    root.add(mesh);
    return mesh;
  };

  // bushes, mostly round the tree clumps
  const bushGeo = lumpy(new THREE.IcosahedronGeometry(1, 1), r, 0.25);
  bushGeo.scale(1, 0.7, 1);
  instanced(bushGeo, new THREE.MeshLambertMaterial({ flatShading: true }), scatter(360, 2.5, TREE_CLUMPS),
    (d, x, z) => { const s = 0.45 + r() * 0.65; d.position.set(x, s * 0.35, z); d.rotation.set(0, r() * 6, 0); d.scale.set(s, s * (0.8 + r() * 0.4), s); },
    [0x2f9e44, 0x3a9d3a, 0x4caf50, 0x2a7a3c, 0x5fae4a]);

  // grass tufts all over the open ground
  const tuftGeo = mergeGeometries([0, 1].map((k) => {
    const g = new THREE.PlaneGeometry(0.9, 0.6);
    g.translate(0, 0.3, 0);
    g.rotateY((k / 2) * Math.PI);
    return g;
  }), false);
  instanced(tuftGeo, new THREE.MeshLambertMaterial({ map: tuftTexture(), alphaTest: 0.45, side: THREE.DoubleSide }), scatter(1800, 1.5),
    (d, x, z) => { const s = 0.7 + r() * 0.7; d.position.set(x, 0, z); d.rotation.set(0, r() * 6, 0); d.scale.set(s, s * (0.8 + r() * 0.5), s); },
    [0xffffff, 0xeaffd8, 0xf6ffc8, 0xd8f0c0]);

  // flowers in loose drifts
  const petal = new THREE.CircleGeometry(0.16, 5);
  petal.rotateX(-Math.PI / 2);
  petal.translate(0, 0.32, 0);
  const stem = new THREE.PlaneGeometry(0.03, 0.32);
  stem.translate(0, 0.16, 0);
  const flowerGeo = mergeGeometries([petal, stem], false);
  const drifts = scatter(40, 3).map(([x, z]) => [x, z]);
  const flowerSpots = [];
  for (const [cx, cz] of drifts) {
    for (let k = 0; k < 18; k++) {
      const a = r() * 6, d = Math.sqrt(r()) * 4;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (clear(x, z, 1)) flowerSpots.push([x, z]);
    }
  }
  instanced(flowerGeo, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, emissive: 0x111111 }), flowerSpots,
    (d, x, z) => { const s = 0.8 + r() * 0.6; d.position.set(x, 0, z); d.rotation.set(0, r() * 6, 0); d.scale.set(s, s, s); },
    [0xffffff, 0xffe14a, 0xff7ab8, 0xb084ff, 0xff9a3a]);

  // two fenced paddocks (gates on the road side), out in open meadow
  const fence = (cx, cz, w, d, gateSide) => {
    const sides = [["n", cx, cz - d / 2, w, "x"], ["s", cx, cz + d / 2, w, "x"], ["w", cx - w / 2, cz, d, "z"], ["e", cx + w / 2, cz, d, "z"]];
    for (const [side, sx, sz, len, axis] of sides) {
      const gate = side === gateSide ? 3 : 0;
      for (const half of gate ? [-1, 1] : [0]) {
        const seg = gate ? (len - gate) / 2 : len;
        const off = gate ? half * (gate / 2 + seg / 2) : 0;
        const mx = axis === "x" ? sx + off : sx, mz = axis === "z" ? sz + off : sz;
        const n = Math.max(1, Math.round(seg / 2.4));
        for (let k = 0; k <= n; k++) {
          const t = -seg / 2 + (k / n) * seg;
          K.box(axis === "x" ? mx + t : mx, axis === "z" ? mz + t : mz, 0.16, 0.16, 1.15, M.wood, { collide: false });
        }
        for (const ry of [0.45, 0.85]) K.box(mx, mz, axis === "x" ? seg : 0.08, axis === "z" ? seg : 0.08, 0.1, M.wood, { y: ry, collide: false });
        api.ghostBox(mx, mz, axis === "x" ? seg : 0.2, axis === "z" ? seg : 0.2, 1.0, { pen: 0.6 });
      }
    }
  };
  for (const [px, py, w, d, gate] of [[36, 46, 16, 11, "n"], [70, 60, 14, 12, "w"]]) {
    const [cx, cz] = P(px, py);
    if (clear(cx, cz, Math.max(w, d) / 2 + 2)) fence(cx, cz, w, d, gate);
  }

  // signposts: a board a landmark, on the road nearest it, pointing at it
  const signed = ["city", "portal", "skate", "peak", "gallery", "shop", "market", "memelab", "cave", "observatory"];
  const atlas = signAtlas(signed.map((k) => L[k].name));
  const boardMat = new THREE.MeshStandardMaterial({ map: atlas.tex, roughness: 0.8, side: THREE.DoubleSide });
  const boards = [];
  signed.forEach((key, row) => {
    const l = L[key];
    // nearest road point to the landmark, then a few metres off the road
    let best = null, bestD = Infinity;
    for (const road of ROADS) for (const [x, z] of road) { const dd = Math.hypot(x - l.x, z - l.z); if (dd < bestD) { bestD = dd; best = [x, z]; } }
    if (!best || bestD > 90 || bestD < 8) return;
    const dirx = (l.x - best[0]) / bestD, dirz = (l.z - best[1]) / bestD;
    const px = best[0] - dirz * 3.6, pz = best[1] + dirx * 3.6;
    if (!insidePolygon(ISLAND_EDGE, px, pz) || insidePolygon(ISLAND_LAKE, px, pz)) return;
    K.cyl(px, pz, 0.09, 2.6, M.wood, { segs: 6 });
    const g = new THREE.PlaneGeometry(2.4, 0.5);
    const v0 = 1 - (row + 1) / atlas.rows, v1 = 1 - row / atlas.rows;
    g.setAttribute("uv", new THREE.Float32BufferAttribute([0, v1, 1, v1, 0, v0, 1, v0], 2));
    g.translate(1.2, 0, 0);            // hinged at the post, pointing along +x
    g.rotateY(-Math.atan2(dirz, dirx));
    g.translate(px, 2.15, pz);
    boards.push(g);
    const tip = new THREE.CircleGeometry(0.3, 3);
    tip.translate(2.5, 0, 0);
    tip.rotateY(-Math.atan2(dirz, dirx));
    tip.translate(px, 2.15, pz);
    K.add(tip, M.wood);
  });
  if (boards.length) {
    const mesh = new THREE.Mesh(mergeGeometries(boards, false), boardMat);
    mesh.castShadow = true;
    root.add(mesh);
  }

  // billboards by the roads: the key art, the sad troll, the key art again
  const loader = new THREE.TextureLoader();
  const art = (file) => { const t = loader.load(new URL(`./ui/${file}`, import.meta.url).href); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const billboards = [[NORTH_ROAD, 4, "troll-forces-key-art.jpg", 7.5, 4.2], [SOUTH_EAST_PATH, 3, "trollface-sad.png", 4.5, 4.5], [SWITCHBACK, 2, "troll-forces-key-art.jpg", 7.5, 4.2]];
  for (const [road, idx, file, w, h] of billboards) {
    const [ax, az] = road[idx], [bx, bz] = road[idx + 1];
    const len = Math.hypot(bx - ax, bz - az), tx = (bx - ax) / len, tz = (bz - az) / len;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    // 8 m off whichever side of the road has room, facing the road
    let spot = null;
    for (const side of [1, -1]) {
      const x = mx + side * tz * 8, z = mz - side * tx * 8;
      if (clear(x, z, 2) && clear(x + tx * w / 2, z + tz * w / 2, 1) && clear(x - tx * w / 2, z - tz * w / 2, 1)) { spot = [x, z, -side * tz, side * tx]; break; }
    }
    if (!spot) continue;
    const [x, z, fx, fz] = spot;
    const th = Math.atan2(fx, fz);                // plane +z -> (fx, fz)
    const ux = Math.cos(th), uz = -Math.sin(th);  // along the board
    for (const sd of [-1, 1]) K.cyl(x + ux * sd * (w / 2 - 0.4), z + uz * sd * (w / 2 - 0.4), 0.14, 2.6 + h, M.greyDark, { segs: 8 });
    const back = new THREE.BoxGeometry(w + 0.3, h + 0.3, 0.2);
    back.rotateY(th);
    back.translate(x, 2.6 + h / 2, z);
    K.add(back, M.greyDark);
    const face = new THREE.PlaneGeometry(w, h);
    face.rotateY(th);
    face.translate(x + fx * 0.11, 2.6 + h / 2, z + fz * 0.11);
    root.add(new THREE.Mesh(face, new THREE.MeshStandardMaterial({ map: art(file), roughness: 0.6 })));
  }

  // grin graffiti sprayed on the plazas
  const grinMat = new THREE.MeshBasicMaterial({ map: grinTexture(), transparent: true, depthWrite: false, opacity: 0.85,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const grins = [];
  for (const [l, dx, dz, s] of [[L.city, 14, 12, 7], [L.skate, -18, 10, 6], [L.gallery, 8, -9, 5], [L.shop, -12, 6, 5]]) {
    const g = new THREE.PlaneGeometry(s, s);
    g.rotateX(-Math.PI / 2);
    g.rotateY(r() * 6);
    g.translate(l.x + dx, 0.05, l.z + dz);
    grins.push(g);
  }
  const gm = new THREE.Mesh(mergeGeometries(grins, false), grinMat);
  gm.renderOrder = 1;
  root.add(gm);
}

export const TROLLFACE_ISLAND = {
  name: "Trollface Island",
  blurb: "The trollface.io island, floating over nothing: meadows, beaches and the landmarks, art coming in.",
  bounds: { ...BOUNDS },
  playerSpawn: { x: SPAWNS[0][0], z: SPAWNS[0][1] },
  // The island floats in space (the trollface.io look): a black-blue sky
  // with stars, and dark fog so the far side fades into it.
  sky: { top: 0x02030a, horizon: 0x101c3f, bottom: 0x02030a, sun: 1.4, sunSize: 0.035 },   // a hard sun in black space, no cloud
  stars: true,
  fog: { color: 0x0b1330, density: 0.0011 },
  ground: { colorA: 0x6fd490, colorB: 0x5aa84d, grid: 0x74c864 },
  sun: { color: 0xfff1d6, intensity: 2.5, pos: [-60, 90, -40] },
  hemi: { sky: 0xcfe6ff, ground: 0x4f7a45, intensity: 0.75 },
  ambient: { color: 0xffffff, intensity: 0.28 },
  build: buildTrollfaceIsland,
  spawns: SPAWNS,
  edge: ISLAND_EDGE,
  wade: ISLAND_LAKE,
  navCell: 2,
  noGroundPlane: true,
  viewFar: 1000,  // 400 m across, and seen from the sky lobby 330 m up (game.js applyEnvironment)
  // Troll Royale on the full island: the design doc's players and timings.
  royale: {
    players: 100,         // real players each take one bot's place
    lootPerSqM: 1 / 210,   // ~330 items: thinner than the small maps, still a gun every ~20 m
    phases: [
      { wait: 150, close: 60, frac: 0.6, dps: 1 },
      { wait: 90, close: 50, frac: 0.35, dps: 2 },
      { wait: 60, close: 40, frac: 0.2, dps: 4 },
      { wait: 45, close: 30, frac: 0.1, dps: 7 },
      { wait: 30, close: 30, frac: 0, dps: 12 },
    ],
  },
};
