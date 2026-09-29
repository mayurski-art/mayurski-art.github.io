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
  add(geo, mat) {
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

function buildTrollfaceIsland(api) {
  const root = new THREE.Group();
  api.prop(root);
  const K = new GreyKit(api, root);
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...o });
  const M = {
    grass: std(0x3fbf62, { roughness: 0.95 }),
    cliff: std(0x3b404b),
    sand: std(0xecd08e, { roughness: 0.95 }),
    road: std(0xd9c79a, { roughness: 0.95 }),
    concrete: std(0xcfd0d2),
    lakebed: std(0x49b8d8, { roughness: 1 }),
    water: new THREE.MeshStandardMaterial({ color: 0x3cc8ff, roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.7, depthWrite: false }),
    falls: new THREE.MeshBasicMaterial({ color: 0xa6e6ff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
    grey: std(0xb8bbc2, { roughness: 0.85 }),
    greyDark: std(0x8b8f98, { roughness: 0.85 }),
    white: std(0xf1f1ee, { roughness: 0.7 }),
    black: std(0x1b1b1f, { roughness: 0.6 }),
    tower: std(0x6f9fe0, { roughness: 0.6 }),
    towerYellow: std(0xf2cf4a, { roughness: 0.7 }),
    rock: std(0x7d8088, { roughness: 0.95, flatShading: true }),
    peakRock: std(0x6a5fc0, { roughness: 0.95, flatShading: true }),
    caveRock: std(0x4f9a82, { roughness: 0.95, flatShading: true }),
    caveDark: std(0x16261f, { roughness: 1 }),
    snow: std(0xf4f6fb, { roughness: 0.8 }),
    wood: std(0x9a7b55),
    trunk: std(0x6b4a2e),
    leaves: std(0x1f7a3a),
    glass: new THREE.MeshStandardMaterial({ color: 0x9fdcff, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
    portalBlue: new THREE.MeshBasicMaterial({ color: 0x38d8ff, side: THREE.DoubleSide }),
    portalGreen: new THREE.MeshBasicMaterial({ color: 0x49ff6a, side: THREE.DoubleSide }),
    neon: new THREE.MeshBasicMaterial({ color: 0x57ff4f }),
    bulb: new THREE.MeshBasicMaterial({ color: 0xffe36b }),
    sail: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide }),
    red: std(0xe8412f), yellow: std(0xf6d23a), blue: std(0x2f63e0), green: std(0x3dbb4a),
  };
  const L = LANDMARKS;

  /* ---- the island: grass top, cliff sides, lake, river, waterfall ------- */
  const slab = new THREE.ExtrudeGeometry(shapeOf(ISLAND_EDGE), { depth: CLIFF_DEPTH, bevelEnabled: false, curveSegments: 1 });
  slab.rotateX(-Math.PI / 2);
  slab.translate(0, -CLIFF_DEPTH, 0);
  const island = new THREE.Mesh(slab, [M.grass, M.cliff]);
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
  root.add(Object.assign(new THREE.Mesh(ribbon(shore, 16, 0.02), M.sand), { receiveShadow: true }));

  /* ---- roads, paths and paved ground ----------------------------------- */
  for (const road of ROADS) root.add(Object.assign(new THREE.Mesh(ribbon(road, 5, 0.03), M.road), { receiveShadow: true }));
  const paved = [
    patch(L.city.x, L.city.z, 76, 46, 0.025),
    patch(L.skate.x, L.skate.z, 62, 38, 0.025),
    patch(L.gallery.x, L.gallery.z, 34, 32, 0.025),
    patch(L.shop.x, L.shop.z + 2, 40, 24, 0.025),
  ];
  root.add(Object.assign(new THREE.Mesh(mergeGeometries(paved, false), M.concrete), { receiveShadow: true }));
  const sandy = [patch(L.portal.x, L.portal.z, 30, 24, 0.022), patch(L.tree.x, L.tree.z, 18, 14, 0.022)];
  root.add(Object.assign(new THREE.Mesh(mergeGeometries(sandy, false), M.sand), { receiveShadow: true }));

  /* ---- landmarks (grey boxes, sized for play) ---------------------------- */

  // Meme Lab: the blue ring portal on its platform, with the solar panel.
  {
    const { x, z } = L.memelab;
    K.box(x, z, 18, 12, 1.32, M.grey);
    K.stairs(x, z + 6, 0, 1, 0, 1.32, 4, M.greyDark);
    K.stairs(x + 9, z, 1, 0, 0, 1.32, 4, M.greyDark);
    const ring = new THREE.TorusGeometry(6, 0.7, 10, 40);
    ring.rotateY(-0.6);
    ring.translate(x - 2, 1.32 + 6.7, z - 1);
    K.add(ring, M.greyDark);
    const swirl = new THREE.CircleGeometry(5.3, 32);
    swirl.rotateY(-0.6);
    swirl.translate(x - 2, 1.32 + 6.7, z - 1);
    K.add(swirl, M.portalBlue);
    K.box(x - 2, z - 1, 2.4, 1.6, 1.4, M.greyDark, { y: 1.32 });           // the ring's foot
    for (let i = 0; i < 6; i++) {                                           // the orbiting lights
      const a = (i / 6) * Math.PI * 2, b = new THREE.SphereGeometry(0.45, 10, 8);
      b.translate(x - 2 + Math.cos(a) * 7.6 * Math.cos(0.6), 1.32 + 6.7 + Math.sin(a) * 7.6, z - 1 + Math.cos(a) * 7.6 * Math.sin(0.6));
      K.add(b, M.bulb);
    }
    const panel = new THREE.BoxGeometry(7, 0.2, 4.4);
    panel.rotateX(-0.35);
    panel.translate(x + 5, 2.6, z + 1.5);
    K.add(panel, M.tower);
    K.box(x + 5, z + 1.5, 1, 1, 1.4, M.greyDark, { y: 1.32 });
  }

  // Troll City: the black trollface dome among blue and yellow towers, some
  // with a lobby you can run through.
  {
    const { x, z } = L.city;
    K.disc(x, z, 11, 5, M.black);                                           // the dome's drum...
    const dome = new THREE.SphereGeometry(11, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.translate(x, 5, z);
    K.add(dome, M.black);
    K.disc(x, z, 8, 5.5, M.black, { y: 5, visual: false });                 // ...and its crown
    const tower = (dx, dz, w, d, h, mat, doors) => {
      if (doors) {
        K.room(x + dx, z + dz, w, d, 4, mat, doors);
        K.box(x + dx, z + dz, w, d, h - 4, mat, { y: 4 });
        K.box(x + dx - w / 4, z + dz, 1, 1, 4, M.greyDark);                // a pillar for cover inside
      } else K.box(x + dx, z + dz, w, d, h, mat);
    };
    tower(-24, -2, 9, 9, 18, M.tower, [["e", 0, 3], ["s", 0, 3]]);
    tower(-22, 11, 8, 8, 12, M.tower);
    tower(-33, 6, 8, 10, 24, M.tower, [["n", 0, 3], ["e", 1, 2.6]]);
    tower(4, -17, 10, 8, 22, M.towerYellow, [["s", 0, 3], ["w", 0, 2.6]]);
    tower(15, -15, 5, 5, 40, M.towerYellow);
    tower(-6, -18, 8, 7, 16, M.towerYellow);
    tower(22, 4, 9, 9, 20, M.tower, [["w", 0, 3], ["s", 2, 2.6]]);
    tower(31, -5, 8, 8, 14, M.tower);
    tower(27, 14, 8, 8, 10, M.tower, [["n", 0, 3]]);
    K.cyl(x + 15, z - 15, 0.25, 8, M.greyDark, { y: 40, collide: false, segs: 6 });   // the aerial
  }

  // The Observatory: a white drum with a dome and the telescope out of it.
  {
    const { x, z } = L.observatory;
    K.room(x, z, 14, 14, 6, M.white, [["s", 0, 3], ["n", 2, 2.6]]);
    K.box(x, z, 14.6, 14.6, 0.5, M.grey, { y: 6 });
    const dome = new THREE.SphereGeometry(6.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.translate(x, 6.5, z);
    K.add(dome, M.white);
    K.disc(x, z, 5.4, 5, M.white, { y: 6.5, visual: false });
    const scope = new THREE.CylinderGeometry(1.1, 1.4, 9, 14);
    scope.rotateZ(-0.9);
    scope.translate(x + 4.5, 11, z);
    K.add(scope, M.greyDark);
    K.box(x - 2, z - 2, 3, 3, 1.2, M.greyDark);                             // the mount, inside
  }

  // The Portal: the green door on a sandy rock plateau.
  {
    const { x, z } = L.portal;
    K.box(x, z, 26, 20, 2.31, M.rock);
    K.stairs(x - 4, z + 10, 0, 1, 0, 2.31, 4, M.rock);
    K.stairs(x - 13, z + 4, -1, 0, 0, 2.31, 4, M.rock);
    K.box(x + 2, z - 5, 12, 7, 4.62, M.rock, { y: 0 });
    K.stairs(x + 2, z - 1.5, 0, 1, 2.31, 4.62, 3.4, M.rock);
    K.box(x - 1.5, z - 5, 1, 1, 8, M.wood, { y: 4.62 });
    K.box(x + 5.5, z - 5, 1, 1, 8, M.wood, { y: 4.62 });
    K.box(x + 2, z - 5, 8, 1, 1, M.wood, { y: 12.62 });
    K.box(x + 2, z - 5, 6, 0.2, 8, M.portalGreen, { y: 4.62, collide: false });
    for (const [dx, dz, s] of [[-10, -7, 2.2], [9, 6, 1.8], [11, -8, 2.6], [-7, 7, 1.5]]) {
      const g = new THREE.DodecahedronGeometry(s, 0);
      g.translate(x + dx, 2.31 + s * 0.4, z + dz);
      K.add(g, M.rock);
      api.ghostBox(x + dx, z + dz, s * 1.6, s * 1.6, s * 1.2, { y: 2.31, pen: 6 });
    }
  }

  // Skate Bowl: a walled concrete park, ramps, rails and ledges inside, a
  // little stand on the north rim.
  {
    const { x, z } = L.skate;
    K.room(x, z, 60, 36, 1.1, M.concrete, [["s", -12, 6], ["w", 4, 6], ["e", 0, 6], ["n", 16, 5]]);
    // Two funboxes: stairs up both ends of a raised deck.
    for (const [dx, dz] of [[-14, -4], [12, 6]]) {
      K.box(x + dx, z + dz, 10, 5, 1.65, M.concrete);
      K.stairs(x + dx - 5, z + dz, -1, 0, 0, 1.65, 5, M.greyDark);
      K.stairs(x + dx + 5, z + dz, 1, 0, 0, 1.65, 5, M.greyDark);
    }
    K.box(x + 2, z - 8, 12, 0.4, 0.7, M.greyDark);                           // rails
    K.box(x - 4, z + 10, 10, 0.4, 0.7, M.greyDark);
    K.box(x + 20, z - 8, 6, 3, 1, M.concrete);                               // ledges
    K.box(x - 22, z + 9, 3, 7, 1, M.concrete);
    for (let t = 0; t < 3; t++) K.box(x - 6, z - 19.5 - t * 1.4, 26, 1.4, 0.66 * (t + 1), M.grey);
  }

  // Troll Peak: a terraced purple mountain, stairs round it from terrace to
  // terrace, and a snowy summit with the flag you can't climb.
  {
    const { x, z } = L.peak;
    // Terraces: [radius, top]. Each ring is as wide as the flight up to the
    // next is long (0.5 m a step), so no flight overhangs the ring below.
    const tiers = [[22, 4.62], [15, 8.58], [9, 12.21]];
    let base = 0;
    tiers.forEach(([rad, top], i) => {
      // The visible tier leans in; its collider sits at the mid radius.
      K.cyl(x, z, rad, top - base, i < 2 ? M.peakRock : M.snow, { y: base, rTop: rad - 1.2, segs: 11, collide: false });
      K.disc(x, z, rad - 0.6, top, null, { visual: false });
      base = top;
    });
    const summit = new THREE.ConeGeometry(8.4, 26, 11);
    summit.translate(x, 12.21 + 13, z);
    K.add(summit, M.snow);
    K.disc(x, z, 7.6, 26, null, { y: 12.21, visual: false });
    K.stairs(x, z + 21.4, 0, 1, 0, 4.62, 4, M.rock);
    K.stairs(x + 14.4, z, 1, 0, 4.62, 8.58, 4, M.rock);
    K.stairs(x, z - 8.4, 0, -1, 8.58, 12.21, 4, M.rock);
    K.cyl(x, z, 0.15, 4, M.greyDark, { y: 38.2, collide: false, segs: 6 });
    K.box(x + 1.2, z, 2.2, 0.1, 1.4, M.red, { y: 40.7, collide: false });
  }

  // The Cave: a rock mound with a tunnel through it (in from the south), and
  // a side chamber off the tunnel.
  {
    const { x, z } = L.cave;
    K.box(x - 6.5, z, 8, 22, 6, M.caveRock);                                     // west
    K.box(x + 6.5, z - 7, 8, 8, 6, M.caveRock);                                  // east, split
    K.box(x + 6.5, z + 7, 8, 8, 6, M.caveRock);
    K.box(x + 9.25, z, 2.5, 6, 6, M.caveRock);
    K.box(x, z, 5, 22, 2.8, M.caveRock, { y: 3.2 });                             // roofs
    K.box(x + 5.25, z, 5.5, 6, 2.8, M.caveRock, { y: 3.2 });
    for (const [dx, dz, s] of [[-5, -5, 5.2], [5, 4, 4.6], [-5, 6, 4.4], [4, -6, 4.8], [0, 0, 5.6], [8, 0, 3.6]]) {
      const g = new THREE.DodecahedronGeometry(s, 0);
      g.scale(1.2, 0.5, 1.2);
      g.translate(x + dx, 5.4 + s * 0.3, z + dz);
      K.add(g, M.caveRock);
    }
    // Dark lining inside, so the tunnel mouth reads as a hole from outside.
    for (const [bx, bz, bw, bd, bh, by] of [[-2.4, 0, 0.2, 22, 3.2, 0], [2.4, -7, 0.2, 8, 3.2, 0], [2.4, 7, 0.2, 8, 3.2, 0],
      [0, 0, 5, 22, 0.1, 3.08], [5.25, 0, 5.5, 6, 0.1, 3.08], [8, 0, 0.2, 6, 3.2, 0]]) {
      K.box(x + bx, z + bz, bw, bd, bh, M.caveDark, { y: by, collide: false });
    }
    K.box(x + 3.6, z + 12.5, 0.2, 0.2, 2.4, M.greyDark, { collide: false });   // the warning sign
    K.box(x + 3.6, z + 12.5, 1.2, 0.1, 1.1, M.yellow, { y: 2.2, collide: false });
  }

  // The Dock: a jetty out into the lake, turning east.
  {
    const [x0] = P(27, 0), [, z0] = P(0, 36), [, z1] = P(0, 42), [x1] = P(33, 0);
    K.box(x0, z0 - 0.5, 3.6, 1, 0.33, M.wood);
    K.box(x0, (z0 + z1) / 2, 3.6, z1 - z0, 0.66, M.wood);
    K.box((x0 + x1) / 2 + 1.8, z1 + 1.8 - 1.8, x1 - x0, 3.6, 0.66, M.wood);
    for (let t = 0; t < 5; t++) K.cyl(x0 + 2, z0 + 3 + t * 4.5, 0.2, 1.6, M.trunk, { segs: 6, collide: false });
    K.box(x1 - 2, z1, 1.4, 1.4, 1.1, M.wood, { y: 0.66 });                    // a crate
  }

  // Old Tree: the big one on the sand by the dock.
  {
    const { x, z } = L.tree;
    K.cyl(x, z, 0.8, 5, M.trunk, { segs: 8 });
    const crown = new THREE.IcosahedronGeometry(4.6, 1);
    crown.scale(1.5, 0.55, 1.2);
    crown.translate(x + 1, 6.2, z);
    K.add(crown, M.leaves);
  }

  // The Boat: a sailboat on the lake; steps up the stern, a cabin on deck.
  {
    const { x, z } = L.boat;
    K.box(x, z, 17, 5.6, 1.32, M.white);
    K.box(x, z, 17.2, 5.8, 0.5, M.greyDark, { collide: false });             // the waterline
    const tip = new THREE.Shape();                                             // the pointed bow
    tip.moveTo(0, -2.8); tip.lineTo(4.4, 0); tip.lineTo(0, 2.8); tip.closePath();
    const bow = new THREE.ExtrudeGeometry(tip, { depth: 1.32, bevelEnabled: false });
    bow.rotateX(-Math.PI / 2);
    bow.translate(x + 8.5, 0, z);
    K.add(bow, M.white);
    api.ghostBox(x + 10, z, 3, 3.2, 1.32, { pen: 1.2 });
    K.stairs(x - 8.5, z, -1, 0, 0, 1.32, 2.4, M.wood);
    K.box(x + 3, z, 5, 3.6, 1.9, M.white, { y: 1.32 });                     // the cabin
    K.cyl(x - 1, z, 0.25, 18, M.greyDark, { y: 1.32, segs: 8 });
    const sail = new THREE.Shape();
    sail.moveTo(0, 0); sail.lineTo(0, 17); sail.lineTo(-8.5, 0.8); sail.closePath();
    const jib = new THREE.Shape();
    jib.moveTo(0, 0); jib.lineTo(0, 15); jib.lineTo(9.5, 0.6); jib.closePath();
    for (const [shape, dx] of [[sail, -1.3], [jib, -0.7]]) {
      const sg = new THREE.ShapeGeometry(shape);
      sg.translate(x + dx, 2.4, z);
      K.add(sg, M.sail);
    }
    const logo = new THREE.CircleGeometry(1.4, 16);                          // the blue mark on the sail
    logo.translate(x - 4, 6.5, z + 0.03);
    K.add(logo, M.blue);
  }

  // The Gallery: a glass pyramid over a plinth, doors north and south.
  {
    const { x, z } = L.gallery;
    K.room(x, z, 26, 26, 3.4, M.grey, [["s", 0, 3.4], ["n", 0, 3.4]]);
    const pyr = new THREE.ConeGeometry(26 / Math.SQRT2, 16, 4, 1, true);
    pyr.rotateY(Math.PI / 4);
    pyr.translate(x, 8, z);
    K.add(pyr, M.glass);
    const ridge = Math.hypot(13 * Math.SQRT2, 16);
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const g = new THREE.CylinderGeometry(0.22, 0.22, ridge, 5);
      g.rotateZ(Math.atan2(13 * Math.SQRT2, 16));
      g.rotateY(Math.atan2(-sz, sx));
      g.translate(x + sx * 6.5, 8, z + sz * 6.5);
      K.add(g, M.white);
    }
    for (const h of [3.4, 7, 10.6]) {
      const half = 13 * (1 - h / 16) + 0.1;
      for (const [w, d, dx, dz] of [[half * 2, 0.3, 0, -half], [half * 2, 0.3, 0, half], [0.3, half * 2, -half, 0], [0.3, half * 2, half, 0]]) {
        K.box(x + dx, z + dz, w, d, 0.3, M.white, { y: h, collide: false });
      }
    }
    for (const [dx, dz] of [[-6, -5], [6, -5], [0, 4], [-7, 7], [7, 7]]) K.box(x + dx, z + dz, 1.6, 1.6, 1.3, M.white);   // plinths
  }

  // The U Mad Bro Shop: a big store with its sign lit up on the roof.
  {
    const { x, z } = L.shop;
    K.room(x, z, 26, 14, 6.5, M.white, [["s", 0, 4], ["n", -6, 3], ["e", 0, 2.6]]);
    K.box(x, z, 26.6, 14.6, 0.5, M.grey, { y: 6.5 });
    K.box(x, z - 2, 16, 0.6, 5, M.neon, { y: 7, collide: false });
    for (let i = 0; i < 18; i++) {
      const b = new THREE.SphereGeometry(0.3, 8, 6);
      const t = i / 17;
      b.translate(x - 8 + t * 16, i % 2 ? 12.2 : 6.8 + 0.3, z - 1.6);
      K.add(b, M.bulb);
    }
    for (let i = 0; i < 3; i++) K.box(x - 7 + i * 7, z - 2, 4.5, 1.2, 1.8, M.greyDark);   // shelves
    K.box(x + 8, z + 3.5, 5, 1.4, 1.1, M.wood);                              // the counter
  }

  // The Marketplace: a line of stalls under striped canopies.
  {
    const { x, z } = L.market;
    const awnings = [M.red, M.yellow, M.blue, M.green];
    for (let t = 0; t < 6; t++) {
      const sx = x - 20 + t * 8, sz = z + 12 - t * 5;
      K.box(sx, sz, 4.4, 2, 1.1, M.wood);
      for (const [dx, dz] of [[-2.2, -1.6], [2.2, -1.6], [-2.2, 1.6], [2.2, 1.6]]) K.box(sx + dx, sz + dz, 0.2, 0.2, 2.8, M.greyDark, { collide: false });
      K.box(sx, sz, 5.2, 3.8, 0.25, awnings[t % 4], { y: 2.8, collide: false });
    }
  }

  // The Bridge: over the river on the south path, rails both sides.
  {
    const [xa] = P(37.6, 0), [xb] = P(49.9, 0), { z } = L.bridge;
    const len = xb - xa, mid = (xa + xb) / 2;
    K.box(xa - 0.5, z, 1, 5, 0.33, M.wood);
    K.box(xb + 0.5, z, 1, 5, 0.33, M.wood);
    K.box(mid, z, len, 5, 0.66, M.wood);
    K.box(mid, z - 2.4, len, 0.2, 0.9, M.wood, { y: 0.66 });
    K.box(mid, z + 2.4, len, 0.2, 0.9, M.wood, { y: 0.66 });
  }

  /* ---- cover: the map's tree clumps, and rocks where nothing else is ----- */
  const r = rng(0x7a011f);
  const spawnClear = (x, z) => SPAWNS.every(([sx, sz]) => Math.hypot(x - sx, z - sz) > 4);
  const clear = (x, z, pad) => openGround(x, z, pad) && spawnClear(x, z);
  const tree = (x, z) => {
    const h = 2.6 + r() * 1.6, s = 2 + r() * 1.2;
    K.cyl(x, z, 0.35, h, M.trunk, { segs: 7 });
    const crown = new THREE.IcosahedronGeometry(s, 0);
    crown.scale(1, 0.85, 1);
    crown.translate(x, h + s * 0.6, z);
    K.add(crown, M.leaves);
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
  let rocks = 0;
  for (let tries = 0; tries < 3000 && rocks < 45; tries++) {
    const x = BOUNDS.minX + r() * (BOUNDS.maxX - BOUNDS.minX), z = BOUNDS.minZ + r() * (BOUNDS.maxZ - BOUNDS.minZ);
    if (!clear(x, z, 5)) continue;
    const s = 0.9 + r() * 1.1;
    const g = new THREE.DodecahedronGeometry(s, 0);
    g.scale(1.3, 0.75, 1);
    g.translate(x, s * 0.5, z);
    K.add(g, M.rock);
    api.ghostBox(x, z, s * 2.2, s * 1.8, s * 1.2, { pen: 6 });
    rocks++;
  }

  K.flush();
}

export const TROLLFACE_ISLAND = {
  name: "Trollface Island",
  blurb: "The trollface.io island, floating over nothing. Grey box: layout first, art later.",
  bounds: { ...BOUNDS },
  playerSpawn: { x: SPAWNS[0][0], z: SPAWNS[0][1] },
  sky: { top: 0x2f7fd6, horizon: 0xcdeaff, bottom: 0x9fd0f5 },
  fog: { color: 0xb4d8f2, density: 0.0018 },
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
  viewFar: 480,   // the island is 400 m across (game.js applyEnvironment)
  // Troll Royale on the full island: the design doc's players and timings.
  royale: {
    players: 20,
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
