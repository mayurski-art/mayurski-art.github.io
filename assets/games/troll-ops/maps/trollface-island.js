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
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { insidePolygon, clampInsidePolygon } from "./edge.js?v=or1";
import { SURFACES } from "./surface-textures.js?v=hg6e-sr1-or1-tx1-sp1-kbt1-pm1-ss1-ss2-ss3";
import { lakeWaterMaterial, fallsTexture } from "./lake-water.js?v=wf2";
import { loadBake } from "./battlefield-props.js?v=sr1-or1-tx1-sp1-kbt1-gb1-pm1-kbk2-tfp7-tfb8-ss1-ss2-ss3";
import { mapModel } from "./map-models.js?v=hg6e-sr1-or1-tx1-sp1-kbt1-gb1-kbb2-kbs1-pm1-kbk2-tfp7-tfb8-ss1-ss2-ss3";
import { ISLAND_SOLIDS } from "./trollface-island-colliders.js?v=is1-ip1-mg1-sp1-tfp1-tfp2-tfp3-tfp4-tfp7-tfb8";
import { ISLAND_GROUND } from "./trollface-island-ground.js?v=tg1-tfp1-tfp3-tfp4-tfp7-tfb8";
import { ISLAND_PROPS } from "./trollface-island-props.js?v=ip1-mg1-sp1-tfp3-tfp7-tfb8";
import { TF_BUILT } from "./trollface-island-built.js?v=tfb1-tfp1-tfp2-tfp3-tfp4-tfp7-tfb8";
import { buildIslandSigns } from "./trollface-island-signs.js?v=tfs1-tfp1";
import { buildIslandProps } from "./island-props.js?v=ip1-mg1-tx1-sp1-kbt1-pm1-ss1-ss2-ss3";
import { sampleField } from "../core/ground-field.js?v=gf1-tg1";
import { Boat, BOAT_ARCHES } from "./trollface-boat.js?v=tfb1-tfb8-ss1-ss2-ss3";
import { animateIslandModel } from "./trollface-anim.js?v=ta1";

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
export { BOAT_ARCHES };   // the layout tool hands them to the builder (the boardwalks' arches)
const RIVER_MOUTH = [P(37.2, 72.2), P(45.6, 77.3)];   // where the river goes over the cliff
const LAKE_FACE = [92, 30];                         // the lake bed's trollface, centred in the main basin

// The 6 m road network (doc "Trollface Island in Blender", phase 3; metres,
// x east, z south), drawn as asphalt by tf-roads-p4 (models/tf_roads.py) and
// flattened under (tools/troll-ops-island-ground-flatten.mjs): the north
// road from Meme Lab past the city and the Problem Plant to the Observatory,
// down between the Peak and the Skate Bowl, round the east past Lighthouse
// Point, the Market, Grin Gas and the Shop to the Bridge; the shore road
// from the Ranch past the Dock, under Old Tree, past the Cave's mouth and
// the Peak's foot (it leaves the west arm north of the Ranch, so the
// two never run side by side); the west arm to the Ranch and Lulz Lodge; the city
// road down to its west entrance; the Gallery's spur off the Bridge.
export const ROAD_NET = {
  north: [[-122, -128], [-112, -128], [-100, -124], [-80, -131], [-40, -136], [29, -138], [75, -135], [84, -126], [90, -112], [97, -100], [97, -37], [140, -37], [160, -36], [167, -20], [167, 0], [166, 20], [164, 36], [158, 50], [150, 62], [135, 68], [110, 70], [92, 72], [95, 92], [88, 112], [60, 112], [40, 100], [12, 92], [10, 78], [1.2, 78]],
  west: [[-100, -124], [-110, -110], [-125, -95], [-150, -75], [-170, -58], [-180, -45], [-172, -30], [-160, -12], [-145, 5], [-135, 10], [-118, 16], [-106, 16]],
  shore: [[-170, -58], [-150, -58], [-125, -56], [-104, -56], [-90, -57], [-70, -57], [-55, -50], [-45, -41], [-36, -29], [-30, -18], [-20, -12], [-5, -9], [20, -5], [45, -8], [80, -8], [97, -12], [97, -37]],
  city: [[-100, -124], [-92, -108], [-86, -96], [-84, -87], [-84, -57]],
  cityin: [[-84, -87], [-64, -87]],
  gallery: [[-58, 78], [-72, 74], [-86, 69], [-96, 66]],
};
// Parking spots for the vehicles doc: [x, z, yaw (deg, the nose)], a bay
// 5 x 2.6 m beside the road; painted by tf-roads-p4.
export const PARKING = [
  [-80, -92, 90], [-80, -82, 90],              // the city's west entrance
  [101.5, -60, 0], [101.5, -66, 0],            // the Skate Bowl's west door
  [161.5, 20, 0],                              // Lighthouse Point
  [140, 63.5, 240], [130, 72.5, 60],           // the Marketplace
  [84, 116.5, 180], [78, 116.5, 180],          // Grin Gas
  [40, 95.5, 180],                             // the Shop, by the road
  [43.6, 88.8, 90], [46.4, 88.8, 90], [49.2, 88.8, 90], [52, 88.8, 90],   // the Shop's car park (tf_mid.py SHOP_BAYS)
  [-88, 73.5, 110],                            // the Gallery's spur
  [-140, 12.5, 290],                           // Lulz Lodge
  [-163, -52.1, 90],                           // Rage Ranch, beside the shore road west of the barn
  [-104, -51.5, 270],                          // the Dock
];
const NORTH_ROAD = ROAD_NET.north;
const SOUTH_WEST_PATH = polyP([[27, 57], [32.5, 62], [37, 66.5], [37.6, 68.5]]);
const SOUTH_EAST_PATH = polyP([[49.9, 68.5], [55, 72.2], [65, 72.4], [74, 68.5], [79.5, 62.5], [85.6, 52.8], [86.4, 43.3], [85, 38.8], [82, 36.6]]);
// The road network replaces the old sand paths (the Bridge spur and the east
// road run where they did); the billboard still stands by the old east path.
export const ROADS = Object.values(ROAD_NET);
void SOUTH_WEST_PATH;

// The landmarks, where the map draws them, and how much room each keeps clear
// of scattered cover and landing spots. `tier` is Troll Royale's (royale.js
// POI_TIERS, ROYALE-ISLAND.md): hot places hold more and better loot.
const lm = (px, py, r, name, tier) => { const [x, z] = P(px, py); return { x, z, r, name, tier }; };
export const LANDMARKS = {
  memelab: lm(22, 15.5, 14, "Meme Lab", "mid"),
  city: lm(42, 23, 40, "Troll City", "hot"),
  observatory: lm(68, 19.5, 13, "The Observatory", "mid"),
  portal: lm(76.6, 19.2, 19, "The Portal", "hot"),      // nudged in off the cliff
  skate: lm(79, 30, 36, "Skate Bowl", "hot"),
  peak: lm(62.5, 35, 33, "Troll Peak", "hot"),
  cave: lm(48, 38, 17, "The Cave", "mid"),
  dock: lm(27, 37.5, 7, "The Dock", "minor"),
  tree: lm(33.6, 34.2, 8, "Old Tree", "minor"),
  boat: lm(72, 51.5, 9, "The Boat", "mid"),
  gallery: lm(28.2, 59.5, 19, "The Gallery", "mid"),    // nudged in off the cliff
  shop: lm(58.5, 68.5, 19, "U Mad Bro Shop", "mid"),
  market: lm(82, 74, 26, "The Marketplace", "mid"),
  bridge: lm(43.7, 68.5, 6, "The Bridge", "minor"),
  // phase 5 of the Blender doc: the five new places (centres in metres, the 2026-10-19 redesign's)
  ranch: { x: -180, z: -45, r: 39, name: "Rage Ranch", tier: "mid" },
  lodge: { x: -145, z: 5, r: 31, name: "Lulz Lodge", tier: "minor" },
  light: { x: 160, z: 20, r: 18, name: "Lighthouse Point", tier: "minor" },
  plant: { x: 35, z: -130, r: 30, name: "Problem Plant", tier: "mid" },
  gas: { x: 85, z: 125, r: 21, name: "Grin Gas", tier: "mid" },
};
// Floor loot the nav grid can't place: up on the Bridge (`y` is the deck:
// the bots' grid is ground floor only, so bots leave these). The Boat's deck
// and hold loot is its build's (TF_BUILT.boat.loot), and sails with it.
const BRIDGE_MID = (P(37.6, 0)[0] + P(49.9, 0)[0]) / 2;
const LOOT_EXTRA = [
  { x: BRIDGE_MID - 14, z: LANDMARKS.bridge.z, y: 0.66 },
  { x: BRIDGE_MID + 6, z: LANDMARKS.bridge.z, y: 0.66 },
  // the rebuilt places' floors, roofs and balconies (the Blender build's)
  ...Object.values(TF_BUILT).flatMap((p) => p.loot),
];

/* The ground's hills, sculpted in Studio (phase 3 of the doc "Troll Royale
   map in Roblox Studio"): cm as Int16 in base64, read once into metres. The
   coast, lake, paths, POI floors and every collider's footing are y 0. */
const GROUND_FIELD = (() => {
  const g = ISLAND_GROUND, bin = atob(g.heights), n = g.w * g.h, heights = new Float32Array(n);
  for (let k = 0; k < n; k++) heights[k] = (((bin.charCodeAt(2 * k) | (bin.charCodeAt(2 * k + 1) << 8)) << 16) >> 16) / 100;
  return { minX: g.minX, minZ: g.minZ, cell: g.cell, w: g.w, h: g.h, heights };
})();
const groundY = (x, z) => sampleField(GROUND_FIELD, x, z);

let BOAT = null;            // the Boat, sailing (built with the map)
const CLIFF_DEPTH = 46;
// the ground bake's square [x0, z0, size] (bake_map_ground.blender.py prints it)
const GROUND_BAKE_RECT = [-220, -220, 440];
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
    // On a hill, stood on the ground under its middle (on flat ground: 0).
    geo.computeBoundingBox();
    const bb = geo.boundingBox, dy = groundY((bb.min.x + bb.max.x) / 2, (bb.min.z + bb.max.z) / 2);
    if (dy) geo.translate(0, dy, 0);
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

/* The lake's hole in the island top. The lake runs out over the cliff at
   the river mouth, past the coast; a hole crossing its outline broke the
   top's triangulation, and ~9000 m2 of grass came out twice, some of it
   over the U Mad Bro Shop's paving (the flicker there). The hole stops
   just inside the coast; the water and its bed keep the full shape. */
const LAKE_HOLE = ISLAND_LAKE.map(([x, z]) => {
  const p = { x, z };
  clampInsidePolygon(p, ISLAND_EDGE, 0.4);
  return [p.x, p.z];
});

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
// The twenty are the contract's (studio/trollface-island/contract.json): spread
// once over the open ground of the old paths, frozen when phase 3 laid the
// road network over the island (spreading again on the new roads moved them).
const SPAWNS = [[17, -113], [161, 133], [-187, -41], [-49, 73], [173, -47], [-109, -137], [59, 1], [-67, -35], [53, 115], [113, -119],
  [-133, 37], [155, 43], [-127, -71], [5, -47], [95, -53], [95, 67], [-43, -131], [11, 67], [-121, -17], [107, 121]];
void spreadSpawns;

/* ======================================================================
   Map detail pass, phase 2 (2026-10-01): the island's ground and dressing.
   - One ground shader: grass, sand, packed-earth paths and rock patches,
     blended by a mask baked here at build time (2 m a texel: shore and
     coast sand, the roads, worn rings round the landmarks, rock outcrops,
     and a noise channel for colour variation), the textures sampled in
     world space at two scales so the tiling doesn't show.
   - Instanced grass tufts / flowers (no colliders; game.js applyClutter
     thins them on lower graphics tiers); the trees, bushes, boulders and
     cover are data since phase 4 of the Studio doc (island-props.js),
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

/* R sand, G path / worn earth, B rock, A colour noise. Exported for
   tools/troll-ops-island-to-studio.mjs, which paints Studio terrain from it. */
export function groundMask() {
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
      let place = 0;                     // inside a place's ring: built-on ground, no bare rock (phase 4: the Market's old hill)
      for (const l of Object.values(L)) {
        const d = Math.hypot(x - l.x, z - l.z) - l.r * 0.85;
        path = Math.max(path, smooth(7, 0, Math.abs(d)) * 0.55);
        place = Math.max(place, smooth(l.r * 1.15, l.r * 0.9, Math.hypot(x - l.x, z - l.z)));
      }
      const nb = big(x, z), ns = small(x, z);
      const rock = smooth(0.66, 0.8, nb) * (1 - path) * (1 - place) * smooth(8, 16, edgeDistance(x, z)) * (inLake ? 0 : 1);
      data[o] = Math.round(sand * 255);
      data[o + 1] = Math.round(path * 255);
      data[o + 2] = Math.round(rock * 255);
      data[o + 3] = Math.round((ns * 0.6 + nb * 0.4) * 255);
    }
  }
  // Cells repainted in Studio: 1 grass, 2 sand, 3 path, 4 rock.
  for (const [i, j, code] of ISLAND_GROUND.paint) {
    const o = (j * W + i) * 4;
    data[o] = code === 2 ? 255 : 0; data[o + 1] = code === 3 ? 255 : 0; data[o + 2] = code === 4 ? 255 : 0;
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/* The island top: four textures blended by the mask, in world space. */
/* The hills' mesh: each 2 m grid square on dry land with a corner off the
   ground, at the field's heights. null on a flat island. */
function hillGeometry() {
  const F = GROUND_FIELD, H = F.heights, pos = [];
  for (let j = 0; j < F.h - 1; j++) for (let i = 0; i < F.w - 1; i++) {
    const k = j * F.w + i, a = H[k], b = H[k + 1], c = H[k + F.w], d = H[k + F.w + 1];
    if (Math.max(a, b, c, d) < 0.005) continue;
    const x = F.minX + i * F.cell, z = F.minZ + j * F.cell, x1 = x + F.cell, z1 = z + F.cell;
    if (!insidePolygon(ISLAND_EDGE, x + F.cell / 2, z + F.cell / 2) || insidePolygon(ISLAND_LAKE, x + F.cell / 2, z + F.cell / 2)) continue;
    pos.push(x, a, z, x, c, z1, x1, b, z, x1, b, z, x, c, z1, x1, d, z1);
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  const merged = mergeVertices(g);
  merged.computeVertexNormals();
  return merged;
}

function groundMaterial(mask) {
  const S = SURFACES;
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
  m.userData.mask = mask;
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

/* Ground under things: pushed back in depth so anything resting on it wins. */
const SINK = { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 4 };

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

/* The real trollface art (never a hand-drawn stand-in: user, 2026-10-26,
   "Its not actually the trollface"), for the Peak hut's window and the
   blue tower's mosaic. */
function trollfaceArt() {
  const t = new THREE.TextureLoader().load(new URL("../../../images/wallpaper/trollface%20transparent.png", import.meta.url).href);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildTrollfaceIsland(mapApi) {
  // The colliders come from trollface-island-colliders.js, the file the
  // Roblox Studio round trip writes (doc "Troll Royale map in Roblox
  // Studio"). The helpers below still lay them in code, but only for
  // tools/troll-ops-island-colliders.mjs (islandCollidersFromCode), which
  // turns that into the file; in the game their calls go nowhere.
  const fromCode = !!mapApi.islandCollidersFromCode;
  // (every place model goes through trollface-anim.js as it is placed: the
  // telescope, the blinking beacons and the lit screens move)
  const api = fromCode ? mapApi : Object.assign(Object.create(mapApi), {
    ghostBox() { return null; },
    prop(o) { mapApi.prop(o); animateIslandModel(o); },
  });
  const root = new THREE.Group();
  api.prop(root);
  const K = new GreyKit(api, root);
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...o });
  const M = {
    lakebed: std(0xb8a878, { roughness: 1 }),   // sand, under the shallows' see-through water
    falls: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
    greyDark: std(0x8b8f98, { roughness: 0.85 }),
    wood: std(0x9a7b55),
    trunk: std(0x6b4a2e),
    glass: new THREE.MeshStandardMaterial({ color: 0x9fdcff, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
  };
  const L = LANDMARKS;

  /* ---- the island: grass top, cliff sides, lake, river, waterfall ------- */
  // The lake is a hole in the top: its bed 12 mm over the grass flickered in
  // stripes from the plane (closer than the depth buffer can tell apart).
  const top = shapeOf(ISLAND_EDGE);
  top.holes.push(shapeOf([...LAKE_HOLE].reverse()));
  // The plazas too (paved below): no grass under them to fight with.
  const PLAZAS = [[L.city.x, L.city.z, 80, 80], [L.skate.x, L.skate.z, 62, 38], [L.gallery.x, L.gallery.z, 34, 32], [L.shop.x, L.shop.z + 2, 40, 24]];
  for (const [x, z, w, d] of PLAZAS) top.holes.push(shapeOf([[x - w / 2, z - d / 2], [x - w / 2, z + d / 2], [x + w / 2, z + d / 2], [x + w / 2, z - d / 2]]));
  const slab = new THREE.ExtrudeGeometry(top, { depth: CLIFF_DEPTH, bevelEnabled: false, curveSegments: 1 });
  slab.rotateX(-Math.PI / 2);
  slab.translate(0, -CLIFF_DEPTH, 0);
  // Phase 2: the textured, blended ground and rock cliffs (UVs are metres).
  const ground = groundMaterial(groundMask());
  // The buildings' floors sit 2-3 cm over the ground and the paving; from
  // 130 m out (or the plane) the depth buffer can't tell them apart and the
  // ground flickered up through every floor. Both now lose any tie.
  Object.assign(ground, SINK);
  const cliffRock = texMaterial("rock", 0xd2d6e0, 9);
  const island = new THREE.Mesh(slab, [ground, cliffRock]);
  island.receiveShadow = true;
  root.add(island);
  // The hills: a 2 m grid over the slab wherever the ground rises, painted
  // the same (world-space mask); the slab is sunk in depth, so where a
  // hill meets it at y 0 the hill wins.
  const hills = hillGeometry();
  const hillMesh = hills && Object.assign(new THREE.Mesh(hills, groundMaterial(ground.userData.mask)), { receiveShadow: true });
  if (hillMesh) root.add(hillMesh);
  // Phase 6: the ground's light map (models/bake_map_ground.blender.py
  // trollface: the sky on the meadow round every place, seen from above),
  // projected onto the slab and the hills by world x/z
  loadBake("trollface-ground").then((tex) => {
    if (!tex) return;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.channel = 1;
    tex.flipY = false;
    const [x0, z0, size] = GROUND_BAKE_RECT;
    for (const mesh of [island, hillMesh]) {
      if (!mesh) continue;
      const pos = mesh.geometry.attributes.position, uv = new Float32Array(pos.count * 2), v = new THREE.Vector3();
      mesh.updateWorldMatrix(true, false);
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
        uv[2 * i] = (v.x - x0) / size;
        uv[2 * i + 1] = (v.z - z0) / size;
      }
      mesh.geometry.setAttribute("uv1", new THREE.BufferAttribute(uv, 2));
      const m = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      m.lightMap = tex;
      m.lightMapIntensity = Math.PI;
      m.needsUpdate = true;
    }
  });
  // (no rock cone under the island: its flat dark faces stuck out past the
  // cliffs, user 2026-10-26 "not that dark slab"; the slab's own floor closes it)

  const bed = new THREE.ShapeGeometry(shapeOf(ISLAND_LAKE));
  bed.rotateX(-Math.PI / 2);
  bed.translate(0, 0.012, 0);
  root.add(Object.assign(new THREE.Mesh(bed, M.lakebed), { receiveShadow: true }));
  const water = new THREE.ShapeGeometry(shapeOf(ISLAND_LAKE));
  water.rotateX(-Math.PI / 2);
  water.translate(0, WATER_Y, 0);
  // Shallows over the sand, deep blue in the middle, a foam line and a
  // chop that moves (lake-water.js; it was one flat cyan, user 2026-10-18).
  const lakeWater = lakeWaterMaterial(ISLAND_LAKE);
  const waterMesh = new THREE.Mesh(water, lakeWater);
  waterMesh.renderOrder = 2;
  waterMesh.onBeforeRender = lakeWater.userData.tick;
  root.add(waterMesh);
  // The trollface in the lake (the overview art): the real artwork's ink as
  // pale sand-bar lines on the water over the main basin, the face 58 m wide.
  {
    const img = new Image();
    img.onload = () => {
      const W = 512, H = Math.round(512 * img.height / img.width);
      const c = document.createElement("canvas");
      c.width = W; c.height = H;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0, W, H);
      const px = g.getImageData(0, 0, W, H), d = px.data;
      for (let k = 0; k < d.length; k += 4) {
        const lum = (d[k] * 0.3 + d[k + 1] * 0.59 + d[k + 2] * 0.11) / 255;
        const ink = d[k + 3] > 128 ? Math.max(0, Math.min(1, (0.6 - lum) / 0.45)) : 0;
        d[k] = 214; d[k + 1] = 238; d[k + 2] = 226;
        d[k + 3] = Math.round(ink * 150 + (d[k + 3] > 128 ? 18 : 0));
      }
      g.putImageData(px, 0, 0);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const fw = 58, fh = fw * H / W;
      const geo = new THREE.PlaneGeometry(fw, fh);
      geo.rotateX(-Math.PI / 2);
      geo.translate(LAKE_FACE[0], WATER_Y + 0.015, LAKE_FACE[1]);
      const face = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.9 }));
      face.renderOrder = 3;
      root.add(face);
    };
    img.src = new URL("../../../images/wallpaper/trollface%20transparent.png", import.meta.url).href;
  }
  // The waterfall: a sheet hanging off the cliff where the river meets it,
  // its streaks pouring down.
  {
    const [[ax, az], [bx, bz]] = RIVER_MOUTH;
    const len = Math.hypot(bx - ax, bz - az), hgt = CLIFF_DEPTH + 60;
    const g = new THREE.PlaneGeometry(len + 2, hgt);
    g.rotateY(-Math.atan2(bz - az, bx - ax));
    const nx = -(bz - az) / len, nz = (bx - ax) / len;   // outward: away from the lake
    g.translate((ax + bx) / 2 + nx * 0.8, WATER_Y - hgt / 2, (az + bz) / 2 + nz * 0.8);
    const streaks = fallsTexture();
    streaks.repeat.set((len + 2) / 8, hgt / 16);
    M.falls.map = streaks;
    M.falls.opacity = 1;
    const falls = new THREE.Mesh(g, M.falls);
    falls.onBeforeRender = () => { streaks.offset.y = (performance.now() / 1000) * 0.9 % 1; };
    root.add(falls);
  }
  // The beach all round the shore (not over the waterfall's lip).
  const mouth = LAKE_PCT.findIndex(([px, py]) => px === 37.2 && py === 72.2);
  const shore = [...ISLAND_LAKE.slice(mouth), ...ISLAND_LAKE.slice(0, mouth - 1)];
  void shore;   // (the beach is in the ground mask now: phase 2)

  /* ---- roads, paths and paved ground ----------------------------------- */
  // Roads and paths are in the ground mask (phase 2); plazas are textured.
  // Each fills its hole in the island top (PLAZAS, above).
  const paved = PLAZAS.map(([x, z, w, d]) => patch(x, z, w, d, 0));
  const plaza = texMaterial("cast", 0xe6e3dc, 5, SINK);
  root.add(Object.assign(new THREE.Mesh(mergeGeometries(paved.map(worldUV), false), plaza), { receiveShadow: true }));

  /* ---- landmarks (grey boxes, sized for play) ---------------------------- */

  // A place a tf_<area>.py module rebuilt (models/build_trollface_island.blender.py)
  // brings its own colliders, in trollface-island-built.js: laid here for the
  // colliders tool, as the kit's are (in the game the data file has them).
  const built = (key) => { for (const [bx, bz, w, d, h, y, pen] of TF_BUILT[key].colliders) api.ghostBox(bx, bz, w, d, h, { y, pen }); };
  // Glass a rebuilt place's build wrote (TF_BUILT[key].glass: centre, width,
  // height, its outward normal): drawn here, as the GLBs have no alpha.
  const panes = (key) => {
    for (const [cx, cy, cz, w, h, nx, nz] of TF_BUILT[key].glass || []) {
      const g = new THREE.PlaneGeometry(w, h);
      g.rotateY(Math.atan2(nx, nz));
      g.translate(cx, cy, cz);
      K.add(g, M.glass);
    }
  };

  // Meme Lab: the blue portal ring on its deck, turned to the road, and the
  // two-floor glass lab beside it. Drawn by tf-memelab-p4 (models/tf_mid.py),
  // its colliders the build's; the swirl is a canvas where the build put the
  // ring (TF_BUILT.memelab.swirl: centre x, y, z, radius, its turn).
  {
    const { x, z } = L.memelab;
    built("memelab");
    panes("memelab");
    const [sx, sy, sz, sr, sry] = TF_BUILT.memelab.swirl;
    const swirl = new THREE.CircleGeometry(sr, 48);
    swirl.rotateY(sry);
    swirl.translate(sx, sy, sz);
    K.add(swirl, new THREE.MeshBasicMaterial({ map: swirlTexture(), side: THREE.DoubleSide }));
    mapModel(api, "tf-memelab-p4", { x, z });
  }

  // Troll City: the black trollface dome in a square, the main street round
  // it, eight shops you can walk into and two towers behind. Drawn by
  // tf-city-p1 (models/tf_city.py; a rebuilt place's GLB gets a new name a
  // phase, since the asset service worker re-checks art daily) + tf-cityface.
  {
    const { x, z } = L.city;
    built("city");
    mapModel(api, "tf-city-p1", { x, z });
    mapModel(api, "tf-cityface", { x, z });
  }

  // The Observatory: the house with the chart desk, the steel stair up its
  // west wall to the catwalk round the dome, the dome you walk into with the
  // yellow telescope out of its slit, the radio mast. Drawn by
  // tf-observatory-p4 (models/tf_mid.py), its colliders the build's.
  {
    const { x, z } = L.observatory;
    built("observatory");
    mapModel(api, "tf-observatory-p4", { x, z });
  }

  // The Portal: the sandy rock with the lab bunker inside it (a blast door
  // in its west face), the stone arch on its dais with the trollface carved
  // over the door. Drawn by tf-portal-p2 and tf-portalface (models/tf_portal.py),
  // its colliders the build's; the green door is a canvas where the build
  // put it (TF_BUILT.portal.door: centre x, y, z, width, height).
  {
    const { x, z } = L.portal;
    built("portal");
    const [dx, dy, dz, dw, dh] = TF_BUILT.portal.door;
    const door = new THREE.PlaneGeometry(dw, dh);
    door.translate(dx, dy, dz);
    K.add(door, new THREE.MeshBasicMaterial({ map: portalDoorTexture(), side: THREE.DoubleSide }));
    mapModel(api, "tf-portal-p2", { x, z });
    mapModel(api, "tf-portalface", { x, z });
  }

  // Skate Bowl: the walled park with the big and the small bowl, the
  // half-pipe, the quarter pipe, the funbox, rails and ledges, the snack
  // shack on the north rim. Drawn by tf-skate-p2 (models/tf_skate.py), its
  // colliders the build's.
  {
    const { x, z } = L.skate;
    built("skate");
    mapModel(api, "tf-skate-p2", { x, z });
  }

  // Troll Peak: a terraced purple mountain, stairs round it from terrace to
  // terrace, and a snowy summit with the flag you can't climb.
  // Terraces [22, 4.62], [15, 8.58], [9, 12.21] with their three flights,
  // then the summit's three bands with switchback flights up to the hut at
  // 30 m. Drawn by tf-peak-p1 (models/tf_peak.py), its colliders the build's.
  {
    const { x, z } = L.peak;
    built("peak");
    mapModel(api, "tf-peak-p1", { x, z });
  }

  // The coast: rock outcrops hung on the cliff all round, sand shelves where
  // the art has beach, tall crags under the Portal and the Gallery. Drawn by
  // tf-coast-p3 (models/tf_coast.py) at the island's origin; all of it below
  // the rim and outside the edge, so no colliders.
  mapModel(api, "tf-coast-p3", { x: 0, z: 0 });

  // The roads: the asphalt, its paint and the parking bays, mile posts,
  // power poles along the north road, two wrecks, the bus shelter at the
  // Market, and the two lake boardwalks. Drawn by tf-roads-p4
  // (models/tf_roads.py) at the island's origin, its colliders the build's.
  {
    built("roads");
    mapModel(api, "tf-roads-p4", { x: 0, z: 0 });
  }

  // The Cave: the teal rock mound with the tunnel north to south through it
  // and the back chamber east of it (the pool, the campfire, the carts).
  // Drawn by tf-cave-p3 (models/tf_lake.py), its colliders the build's.
  {
    const { x, z } = L.cave;
    built("cave");
    mapModel(api, "tf-cave-p3", { x, z });
  }

  // The Dock: the jetty out into the lake turning east, the bait shop and
  // the boat shed on the shore, the slipway, boats tied up. Drawn by
  // tf-dock-p3 (its origin is the jetty's shore end, x0 z0).
  {
    const [x0] = P(27, 0), [, z0] = P(0, 36);
    built("dock");
    mapModel(api, "tf-dock-p3", { x: x0, z: z0 });
  }

  // Old Tree: grown big, the plank stair round the trunk up to the
  // treehouse, the tyre swing, the picnic table. Drawn by tf-tree-p3.
  {
    const { x, z } = L.tree;
    built("tree");
    mapModel(api, "tf-tree-p3", { x, z });
  }

  // The Boat: a sailing smack, the deck 2.7 m up by the stern steps, the
  // wheelhouse and the hold you go down into. Drawn by tf-boat-p3,
  // tf-boatface (the figurehead) and its folding rig. In a match it sails
  // round the lake (trollface-boat.js, modes/royale-boat.js), its colliders
  // with it; built from code (the tools) it stays where it was built.
  BOAT = null;
  if (fromCode) {
    const { x, z } = L.boat;
    built("boat");
    mapModel(api, "tf-boat-p3", { x, z });
    mapModel(api, "tf-boatface", { x, z });
  } else BOAT = new Boat(root, mapApi, L.boat, TF_BUILT.boat.colliders);

  // The Gallery: the glass pyramid (the lobby: the ticket desk, the gift
  // shop, the white trollface bust), a hall either side with framed memes and
  // busts, the sculpture court north. Drawn by tf-gallery-p4 (models/tf_mid.py),
  // its colliders the build's; the band's glass and the pyramid cone are
  // here, the busts hg-trollbust (Hollowgrin's carving) where the build put
  // their plinths (TF_BUILT.gallery.busts: x, y, z, turn, scale).
  {
    const { x, z } = L.gallery;
    built("gallery");
    panes("gallery");
    const pyr = new THREE.ConeGeometry(26 / Math.SQRT2, 14.6, 4, 1, true);   // base on the band, apex at 18
    pyr.rotateY(Math.PI / 4);
    pyr.translate(x, 3.4 + 7.3, z);
    K.add(pyr, M.glass);
    mapModel(api, "tf-gallery-p4", { x, z });
    for (const [bx, by, bz, rot, scale] of TF_BUILT.gallery.busts) mapModel(api, "hg-trollbust", { x: bx, z: bz, y: by, rot, scale });
  }

  // The U Mad Bro Shop: the big store, its car park, the loading bay, the
  // stair to the roof. Drawn by tf-shop-p4 (models/tf_mid.py), its colliders
  // the build's; the sign's neon lettering is a canvas on its black board
  // (TF_BUILT.shop.neon: centre x, y, z, width, height).
  {
    const { x, z } = L.shop;
    built("shop");
    mapModel(api, "tf-shop-p4", { x, z });
    const [nx, ny, nz, nw, nh] = TF_BUILT.shop.neon;
    const sign = new THREE.PlaneGeometry(nw, nh);
    sign.translate(nx, ny, nz);
    K.add(sign, new THREE.MeshBasicMaterial({ map: neonSignTexture(), transparent: true, depthWrite: false }));
  }

  // The Marketplace: the covered hall with its stalls, canopy stalls in the
  // square, the fountain, the noodle cart, and the fish market up on the
  // quay. Drawn by tf-market-p4 (models/tf_mid.py), its colliders the build's.
  {
    const { x, z } = L.market;
    built("market");
    mapModel(api, "tf-market-p4", { x, z });
  }

  // The five new places (phase 5): Rage Ranch, Lulz Lodge, Lighthouse Point,
  // Problem Plant, Grin Gas. Drawn by tf-<place>-p5 (models/tf_new.py), their
  // colliders the build's; the lamp room's and the diner's glass the map's,
  // the Ranch's scarecrow wears the trollface (TF_BUILT.ranch.face: x, y, z, size, turn).
  for (const k of ["ranch", "lodge", "light", "plant", "gas"]) {
    const { x, z } = L[k];
    built(k);
    panes(k);
    mapModel(api, `tf-${k}-p5`, { x, z });
  }
  {
    const [fx, fy, fz, fs, fry] = TF_BUILT.ranch.face;
    const face = new THREE.PlaneGeometry(fs, fs);
    face.rotateY(fry);
    face.translate(fx, fy, fz);
    const tex = new THREE.TextureLoader().load(new URL("../../../images/wallpaper/trollface%20transparent.png", import.meta.url).href);
    tex.colorSpace = THREE.SRGBColorSpace;
    root.add(new THREE.Mesh(face, new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide })));
  }

  // The Bridge: the plank bridge over the river roofed over, a toll booth
  // at each end. Drawn by tf-bridge-p3 (its origin is the deck's middle).
  {
    const [xa] = P(37.6, 0), [xb] = P(49.9, 0), { z } = L.bridge;
    built("bridge");
    mapModel(api, "tf-bridge-p3", { x: (xa + xb) / 2, z });
  }

  /* ---- cover: trees, bushes, boulders, walls, crates, hay, logs, barrels,
     sandbags. Data since phase 4 of the Studio doc: Studio's layout (first
     laid out by tools/troll-ops-island-props.mjs), drawn by island-props.js
     with their own colliders (not in ISLAND_SOLIDS). ------------------------ */
  const r = rng(0x7a011f);
  const spawnClear = (x, z) => SPAWNS.every(([sx, sz]) => Math.hypot(x - sx, z - sz) > 4);
  const clear = (x, z, pad) => openGround(x, z, pad) && spawnClear(x, z);
  buildIslandProps(root, fromCode ? null : mapApi, ISLAND_PROPS, groundY);

  dressIsland(api, root, K, M, r, clear);
  K.flush();
  // (the Boat's are laid by the Boat, in pieces it moves)
  if (!fromCode) for (const c of ISLAND_SOLIDS) if (c.n !== "boat") mapApi.ghostBox(c.x, c.z, c.w, c.d, c.h, { y: c.y, pen: c.pen });
}

/* Instanced clutter, paddocks, signposts, billboards, graffiti (phase 2). */
function dressIsland(api, root, K, M, r, clear) {
  const L = LANDMARKS;
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const scatter = (n, pad) => {
    const out = [];
    for (let tries = 0; tries < n * 30 && out.length < n; tries++) {
      const x = BOUNDS.minX + r() * (BOUNDS.maxX - BOUNDS.minX);
      const z = BOUNDS.minZ + r() * (BOUNDS.maxZ - BOUNDS.minZ);
      if (clear(x, z, pad)) out.push([x, z]);
    }
    return out;
  };
  const instanced = (geo, mat, spots, place, palette) => {
    const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
    spots.forEach(([x, z], i) => {
      place(dummy, x, z);
      dummy.position.y += groundY(x, z);   // on a hill
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
  const art = (file) => { const t = loader.load(new URL(`../ui/${file}`, import.meta.url).href); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const billboards = [[NORTH_ROAD, 4, "troll-forces-key-art.jpg", 7.5, 4.2], [SOUTH_EAST_PATH, 3, "trollface-sad.png", 4.5, 4.5], [ROAD_NET.west, 2, "troll-forces-key-art.jpg", 7.5, 4.2]];
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

  const grinMat = new THREE.MeshBasicMaterial({ map: trollfaceArt(), transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const grins = [];
  // the trollface where the doc puts it (the hand-drawn grins sprayed on
  // the plazas are gone: user, 2026-10-26): the Peak hut's round window
  // (lit from inside, the grin on the glass) and a mosaic on the blue
  // tower's north wall, facing the square (tf_city.py leaves that face bare)
  {
    const [wx, wy, wz] = TF_BUILT.peak.window;
    const g = new THREE.PlaneGeometry(1.15, 1.15);
    g.translate(wx, wy, wz);
    grins.push(g);
    const m = new THREE.PlaneGeometry(5, 5);
    m.rotateY(Math.PI);
    m.translate(L.city.x - 12, 5.2, L.city.z + 28.5 - 0.06);
    grins.push(m);
  }
  const gm = new THREE.Mesh(mergeGeometries(grins, false), grinMat);
  gm.renderOrder = 1;
  root.add(gm);

  // the rebuilt places' sign boards, lettered (trollface-island-signs.js)
  root.add(buildIslandSigns(Object.values(TF_BUILT).flatMap((p) => p.signs)));
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
  // the sky is in the light maps now (phase 6): the hemisphere at about half
  hemi: { sky: 0xcfe6ff, ground: 0x4f7a45, intensity: 0.4 },
  ambient: { color: 0xffffff, intensity: 0.28 },   // kept: the rooms the sky can't reach have only this
  // stylised realism (view/grade-pass.js): hard sun in space: cold shade, clean highs
  grade: { shadows: 0x101a40, shadowsAmt: 0.08, highlights: 0xfff0d0, highlightsAmt: 0.05, sat: 1.08, contrast: 1.05 },
  build: buildTrollfaceIsland,
  boat: () => BOAT,           // modes/royale-boat.js sails it
  groundField: GROUND_FIELD,   // the hills (core/ground-field.js reads it while the map is live)
  spawns: SPAWNS,
  edge: ISLAND_EDGE,
  wade: ISLAND_LAKE,
  navCell: 2,
  noGroundPlane: true,
  viewFar: 1000,  // 400 m across, and seen from the sky lobby 330 m up (game.js applyEnvironment)
  // Troll Royale on the full island: the design doc's players and timings.
  royale: {
    players: 69,          // real players each take one bot's place (user 2026-10-25: 69, was 100)
    lootPerSqM: 1 / 233,   // ~220 items: per m2 of open ground (1 / 175 before the chests took a quarter of it; the props cover a sixth)
    chests: true,          // ~60 gold chests a match at the places (modes/royale-chests.js)
    // Where the loot gathers, and the extra spots up on decks (ROYALE-ISLAND.md).
    pois: Object.values(LANDMARKS),
    lootExtra: LOOT_EXTRA,
    // the rebuilt places' doorways: no chest or floor loot stands in one
    keepClear: Object.values(TF_BUILT).flatMap((p) => p.clear || []),
    phases: [
      // ~14 min to the last circle (user, 2026-10-18: a solo match against
      // 99 bots done inside 15 minutes, the killing gradual)
      { wait: 200, close: 75, frac: 0.6, dps: 1 },
      { wait: 140, close: 65, frac: 0.35, dps: 2 },
      { wait: 100, close: 55, frac: 0.2, dps: 4 },
      { wait: 70, close: 45, frac: 0.1, dps: 7 },
      { wait: 40, close: 40, frac: 0, dps: 12 },
    ],
  },
};
