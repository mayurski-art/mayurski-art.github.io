// Troll Forces — Trollface Island, Troll Royale's map (phase 3: GREY BOX).
//
// The floating island from the site's World page, about 400 x 300 m: a
// boomerang-shaped shallow lake in the middle that pours off the south cliff
// as a waterfall, a ring road round the lake and a loop through the north,
// and ten landmarks. The layout was approved from the plan in the Battle
// Royale design doc (HANDOFF.md has the link); this is its blockout, grey
// boxes sized for play, to walk before any art goes in.
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

// The plan's outlines, in metres ([x, z], north = -z).
export const ISLAND_EDGE = [[-200, -35], [-189, -66], [-163, -97], [-126, -129], [-97, -146], [-29, -150], [40, -148], [111, -136],
  [169, -105], [189, -62], [191, -16], [198, 39], [198, 90], [189, 132], [149, 148], [69, 150], [-17, 132], [-40, 132], [-63, 125],
  [-97, 109], [-151, 70], [-183, 31], [-200, -8]];
export const ISLAND_LAKE = [[-123, -23], [-97, -12], [-46, -4], [11, 8], [69, 8], [126, -16], [143, -16], [150, 20], [146, 58],
  [111, 70], [40, 74], [-6, 80], [-17, 109], [-17, 132], [-40, 132], [-40, 109], [-46, 78], [-74, 55], [-111, 23], [-123, -8]];
const RING_ROAD = [[-172, -20], [-160, -65], [-115, -82], [-60, -78], [-5, -30], [60, -25], [120, -45], [170, -40], [182, 20],
  [175, 80], [130, 112], [60, 100], [0, 98], [-50, 100], [-100, 88], [-150, 55], [-172, -20]];
const NORTH_ROAD = [[-60, -78], [-70, -115], [-40, -138], [40, -140], [100, -125], [110, -95], [80, -70], [60, -25]];

// The landmarks and how much room each keeps clear of scattered cover.
export const LANDMARKS = {
  finances: { x: -151, z: -80, r: 16, name: "Finances vault" },
  terminal: { x: -140, z: 16, r: 14, name: "Terminal" },
  dock: { x: -113, z: -19, r: 12, name: "The Dock" },
  hub: { x: -3, z: -52, r: 18, name: "The Hub" },
  videos: { x: 54, z: -105, r: 20, name: "Videos studio" },
  stickers: { x: 172, z: 47, r: 18, name: "Stickers booth" },
  track: { x: -15, z: -105, r: 30, name: "Track field" },
  ferris: { x: 75, z: 124, r: 20, name: "Ferris wheel" },
  fitness: { x: 150, z: -66, r: 20, name: "Fitness gym" },
  lighthouse: { x: -150, z: 76, r: 12, name: "Lighthouse" },
};

const CLIFF_DEPTH = 46;
const WATER_Y = 0.34;       // the lake's surface; its floor is the island top (y 0)

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
    this.parts.get(mat).push(geo);
  }
  /* An AABB block, base at y; `collide` false for decoration. */
  box(x, z, w, d, h, mat, { y = 0, collide = true, pen = 0.9, rotY = 0 } = {}) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rotY) g.rotateY(rotY);
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
      mesh.castShadow = true;
      mesh.receiveShadow = true;
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
  const merged = mergeGeometries(geos.map((g) => g.index ? g.toNonIndexed() : g), false);
  return merged;
}

function buildTrollfaceIsland(api) {
  const root = new THREE.Group();
  api.prop(root);
  const K = new GreyKit(api, root);
  const M = {
    grass: new THREE.MeshStandardMaterial({ color: 0x67bd58, roughness: 0.95 }),
    cliff: new THREE.MeshStandardMaterial({ color: 0x3b404b, roughness: 0.9 }),
    sand: new THREE.MeshStandardMaterial({ color: 0xe9dbab, roughness: 0.95 }),
    lakebed: new THREE.MeshStandardMaterial({ color: 0xc9c08e, roughness: 1 }),
    water: new THREE.MeshStandardMaterial({ color: 0x3cb7ff, roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.72, depthWrite: false }),
    falls: new THREE.MeshBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
    grey: new THREE.MeshStandardMaterial({ color: 0xb8bbc2, roughness: 0.85 }),
    greyDark: new THREE.MeshStandardMaterial({ color: 0x8b8f98, roughness: 0.85 }),
    greyLight: new THREE.MeshStandardMaterial({ color: 0xd4d6da, roughness: 0.85 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x9a7b55, roughness: 0.9 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.9 }),
    leaves: new THREE.MeshStandardMaterial({ color: 0x2f7d3a, roughness: 0.9 }),
    rock: new THREE.MeshStandardMaterial({ color: 0x8a8d93, roughness: 0.95, flatShading: true }),
    track: new THREE.MeshStandardMaterial({ color: 0xc0573e, roughness: 0.95 }),
    accent: new THREE.MeshStandardMaterial({ color: 0xff6a3d, roughness: 0.8 }),
  };

  /* ---- the island: grass top, cliff sides, lake, waterfall -------------- */
  const slab = new THREE.ExtrudeGeometry(shapeOf(ISLAND_EDGE), { depth: CLIFF_DEPTH, bevelEnabled: false, curveSegments: 1 });
  slab.rotateX(-Math.PI / 2);
  slab.translate(0, -CLIFF_DEPTH, 0);
  const island = new THREE.Mesh(slab, [M.grass, M.cliff]);
  island.receiveShadow = true;
  root.add(island);
  // The underside tapers to a rocky point, like the World art.
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
  // The waterfall: a sheet off the south cliff where the channel meets it.
  const falls = new THREE.PlaneGeometry(23, CLIFF_DEPTH + 40);
  falls.translate(-28.5, -(CLIFF_DEPTH + 40) / 2 + WATER_Y, 132.3);
  root.add(new THREE.Mesh(falls, M.falls));

  /* ---- roads ------------------------------------------------------------ */
  root.add(Object.assign(new THREE.Mesh(ribbon(RING_ROAD, 6, 0.03), M.sand), { receiveShadow: true }));
  root.add(Object.assign(new THREE.Mesh(ribbon(NORTH_ROAD, 5, 0.03), M.sand), { receiveShadow: true }));
  // Bridges over the waterfall channel and the narrow west end of the lake.
  K.box(-28.5, 101, 30, 7, 0.45, M.wood);
  K.box(-115, 5, 7, 34, 0.45, M.wood);

  /* ---- landmarks (grey boxes, sized for play) ---------------------------- */
  const L = LANDMARKS;

  // Finances vault: one way in (south), the vault itself deep inside.
  K.room(L.finances.x, L.finances.z, 18, 14, 6, M.grey, [["s", 0, 3.2]]);
  K.box(L.finances.x, L.finances.z, 18.6, 14.6, 0.6, M.greyDark, { y: 6 });
  K.box(L.finances.x, L.finances.z - 3, 6, 3.4, 3, M.accent);
  K.box(L.finances.x - 5, L.finances.z + 2, 2.4, 1.2, 1.1, M.greyLight);
  K.box(L.finances.x + 5, L.finances.z + 2, 2.4, 1.2, 1.1, M.greyLight);

  // Terminal: a low server bunker by the shore, racks for cover inside.
  K.room(L.terminal.x, L.terminal.z, 16, 11, 3.6, M.greyDark, [["e", -2, 3], ["n", 3, 2.6]]);
  K.box(L.terminal.x, L.terminal.z, 16.4, 11.4, 0.5, M.grey, { y: 3.6 });
  for (let i = 0; i < 3; i++) K.box(L.terminal.x - 4.5 + i * 4.5, L.terminal.z + 1.5, 1.2, 4, 2.4, M.accent);

  // The Dock: two piers out into the lake and a boathouse on the shore.
  K.box(L.dock.x + 9, L.dock.z - 2, 20, 3, 0.5, M.wood);
  K.box(L.dock.x + 7, L.dock.z + 6, 16, 3, 0.5, M.wood);
  K.room(L.dock.x - 5, L.dock.z + 1, 8, 7, 3.4, M.wood, [["e", 0, 3]]);
  K.box(L.dock.x - 5, L.dock.z + 1, 8.6, 7.6, 0.4, M.greyDark, { y: 3.4 });
  K.box(L.dock.x + 14, L.dock.z + 1.5, 4, 1.6, 1, M.greyLight);   // a boat

  // The Hub: the tavern, two floors (the upper one open to the balcony).
  const H = L.hub;
  K.room(H.x, H.z, 22, 16, 7.4, M.wood, [["s", -3, 3.2], ["e", 2, 2.6], ["w", -3, 2.6]]);
  K.box(H.x + 3, H.z - 2, 16, 12, 0.35, M.greyDark, { y: 3.6 });               // upper floor
  K.box(H.x, H.z, 22.6, 16.6, 0.5, M.greyDark, { y: 7.4 });                    // roof
  for (let s = 0; s < 12; s++) K.box(H.x - 8, H.z - 5 + s * 0.5, 2.4, 0.5, 0.3 * (s + 1), M.grey);   // stairs
  K.box(H.x + 3, H.z + 10, 16, 4, 0.35, M.greyDark, { y: 3.6 });              // balcony over the door
  K.box(H.x + 3, H.z + 11.8, 16, 0.3, 1.1, M.wood, { y: 3.95 });
  K.box(H.x - 2, H.z + 2, 7, 1.4, 1.1, M.grey);                                  // the bar

  // Videos studio: two sound stages with big doors, light rigs outside.
  K.room(L.videos.x - 10, L.videos.z, 16, 14, 8, M.grey, [["s", 0, 6], ["e", 0, 3]]);
  K.room(L.videos.x + 10, L.videos.z, 16, 14, 8, M.grey, [["s", 0, 6], ["w", 0, 3]]);
  K.box(L.videos.x - 10, L.videos.z, 16.6, 14.6, 0.5, M.greyDark, { y: 8 });
  K.box(L.videos.x + 10, L.videos.z, 16.6, 14.6, 0.5, M.greyDark, { y: 8 });
  for (const [dx, dz] of [[-16, 11], [0, 12], [16, 11]]) K.box(L.videos.x + dx, L.videos.z + dz, 0.6, 0.6, 6, M.greyDark);
  K.box(L.videos.x, L.videos.z + 16, 8, 3, 2.2, M.accent);   // the camera truck

  // Stickers booth: a market street, stalls down both sides, two shops.
  const S = L.stickers;
  for (let i = 0; i < 4; i++) {
    K.box(S.x - 6, S.z - 12 + i * 7, 3.4, 2.4, 1.2, M.wood);
    K.box(S.x - 6, S.z - 12 + i * 7, 3.8, 2.8, 0.2, M.accent, { y: 2.6, collide: false });
    K.box(S.x + 6, S.z - 9 + i * 7, 3.4, 2.4, 1.2, M.wood);
    K.box(S.x + 6, S.z - 9 + i * 7, 3.8, 2.8, 0.2, M.accent, { y: 2.6, collide: false });
  }
  K.room(S.x - 12, S.z + 18, 10, 8, 4, M.grey, [["e", 0, 2.6]]);
  K.room(S.x + 6, S.z + 20, 10, 8, 4, M.grey, [["w", 0, 2.6]]);

  // Track field: the oval (flat), stands along the north side, the podium.
  const T = L.track;
  const oval = new THREE.RingGeometry(18, 24, 48, 1);
  oval.rotateX(-Math.PI / 2);
  oval.scale(1.5, 1, 0.8);
  oval.translate(T.x, 0.04, T.z);
  root.add(Object.assign(new THREE.Mesh(oval, M.track), { receiveShadow: true }));
  for (let tier = 0; tier < 3; tier++) K.box(T.x, T.z - 23 - tier * 1.6, 44, 1.6, 0.8 * (tier + 1), M.greyLight);
  K.box(T.x, T.z, 3, 2, 1, M.accent);
  K.box(T.x - 2.6, T.z, 2.2, 2, 0.7, M.grey);
  K.box(T.x + 2.6, T.z, 2.2, 2, 0.5, M.grey);

  // Ferris wheel: the wheel (decoration, stood on its legs) and a fairground.
  const F = L.ferris;
  const wheel = new THREE.TorusGeometry(14, 0.5, 8, 48);
  wheel.translate(F.x, 16, F.z);
  K.add(wheel, M.accent);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const spoke = new THREE.BoxGeometry(0.3, 14, 0.3);
    spoke.translate(0, 7, 0);
    spoke.rotateZ(a);
    spoke.translate(F.x, 16, F.z);
    K.add(spoke, M.greyDark);
    K.box(F.x + Math.cos(a) * 14, F.z, 1.6, 1.6, 1.4, M.greyLight, { y: 16 + Math.sin(a) * 14 - 1.4, collide: false });
  }
  K.box(F.x - 5, F.z, 0.8, 1.2, 16, M.greyDark, { rotY: 0 });
  K.box(F.x + 5, F.z, 0.8, 1.2, 16, M.greyDark);
  for (const [dx, dz] of [[-14, -8], [14, -8], [-12, 9], [12, 9]]) {
    K.box(F.x + dx, F.z + dz, 4, 3, 2.4, M.wood);
    K.box(F.x + dx, F.z + dz, 4.6, 3.6, 0.2, M.accent, { y: 2.8, collide: false });
  }

  // Fitness gym: the gym with a car park in front.
  const G = L.fitness;
  K.room(G.x, G.z - 4, 22, 14, 6, M.grey, [["s", -5, 3.4], ["w", 0, 2.6]]);
  K.box(G.x, G.z - 4, 22.6, 14.6, 0.5, M.greyDark, { y: 6 });
  for (let i = 0; i < 4; i++) K.box(G.x - 6 + i * 4, G.z - 4, 1.6, 3, 1.2, M.accent);
  for (let i = 0; i < 5; i++) K.box(G.x - 10 + i * 5, G.z + 11, 2, 4.4, 1.4, i % 2 ? M.greyLight : M.greyDark);

  // Lighthouse (Maps): the tower on the south-west cliff and the keeper's hut.
  K.cyl(L.lighthouse.x, L.lighthouse.z, 3.2, 20, M.greyLight, { rTop: 2.4, segs: 18 });
  K.cyl(L.lighthouse.x, L.lighthouse.z, 3, 2.4, M.accent, { y: 20, collide: false, segs: 18 });
  K.room(L.lighthouse.x + 8, L.lighthouse.z - 4, 8, 6, 3.4, M.grey, [["n", 0, 2.4]]);

  /* ---- cover: trees and rocks where nothing else is ---------------------- */
  const r = rng(0x7a011f);
  const nearRoad = (x, z) => [RING_ROAD, NORTH_ROAD].some((road) => road.some((p, i) => {
    if (!i) return false;
    const [ax, az] = road[i - 1], [bx, bz] = p;
    const ex = bx - ax, ez = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez)));
    return Math.hypot(x - (ax + ex * t), z - (az + ez * t)) < 5;
  }));
  const clear = (x, z, pad) => insidePolygon(ISLAND_EDGE, x, z) && !insidePolygon(ISLAND_LAKE, x, z)
    && edgeDistance(x, z) > pad && Object.values(L).every((l) => Math.hypot(x - l.x, z - l.z) > l.r) && !nearRoad(x, z);
  let trees = 0, rocks = 0;
  for (let tries = 0; tries < 4000 && (trees < 90 || rocks < 50); tries++) {
    const x = BOUNDS.minX + r() * (BOUNDS.maxX - BOUNDS.minX), z = BOUNDS.minZ + r() * (BOUNDS.maxZ - BOUNDS.minZ);
    if (!clear(x, z, 5)) continue;
    if (trees < 90 && r() < 0.65) {
      const h = 2.6 + r() * 1.6, s = 2 + r() * 1.2;
      K.cyl(x, z, 0.35, h, M.trunk, { segs: 7 });
      const crown = new THREE.IcosahedronGeometry(s, 0);
      crown.scale(1, 0.85, 1);
      crown.translate(x, h + s * 0.6, z);
      K.add(crown, M.leaves);
      trees++;
    } else if (rocks < 50) {
      const s = 0.9 + r() * 1.1;
      const g = new THREE.DodecahedronGeometry(s, 0);
      g.scale(1.3, 0.75, 1);
      g.translate(x, s * 0.5, z);
      K.add(g, M.rock);
      api.ghostBox(x, z, s * 2.2, s * 1.8, s * 1.2, { pen: 6 });
      rocks++;
    }
  }

  K.flush();
}

function edgeDistance(x, z) {
  let best = Infinity;
  for (let i = 0, j = ISLAND_EDGE.length - 1; i < ISLAND_EDGE.length; j = i++) {
    const [ax, az] = ISLAND_EDGE[j], [bx, bz] = ISLAND_EDGE[i];
    const ex = bx - ax, ez = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez)));
    best = Math.min(best, Math.hypot(x - (ax + ex * t), z - (az + ez * t)));
  }
  return best;
}

// Twenty landing spots round the ring road, until the plane drops people in.
function ringSpawns(n) {
  const segs = [];
  let total = 0;
  for (let i = 1; i < RING_ROAD.length; i++) {
    const [ax, az] = RING_ROAD[i - 1], [bx, bz] = RING_ROAD[i];
    const len = Math.hypot(bx - ax, bz - az);
    segs.push({ ax, az, bx, bz, len, at: total });
    total += len;
  }
  const out = [];
  for (let k = 0; k < n; k++) {
    const d = (k / n) * total;
    const s = segs.find((g) => d >= g.at && d < g.at + g.len) || segs[segs.length - 1];
    const t = (d - s.at) / s.len;
    out.push([+(s.ax + (s.bx - s.ax) * t).toFixed(1), +(s.az + (s.bz - s.az) * t).toFixed(1)]);
  }
  return out;
}

export const TROLLFACE_ISLAND = {
  name: "Trollface Island",
  blurb: "The island from the World page, floating over nothing. Grey box: layout first, art later.",
  bounds: { ...BOUNDS },
  playerSpawn: { x: -3, z: -30 },
  sky: { top: 0x2f7fd6, horizon: 0xcdeaff, bottom: 0x9fd0f5 },
  fog: { color: 0xc4e2f5, density: 0.0032 },
  ground: { colorA: 0x67bd58, colorB: 0x5aa84d, grid: 0x74c864 },
  sun: { color: 0xfff1d6, intensity: 2.2, pos: [-60, 90, -40] },
  hemi: { sky: 0xd6ecff, ground: 0x6a8a55, intensity: 1.9 },
  ambient: { color: 0xffffff, intensity: 0.55 },
  build: buildTrollfaceIsland,
  spawns: ringSpawns(20),
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
