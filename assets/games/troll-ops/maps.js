// Troll Ops — data-driven maps.
//
// Each map states its bounds, palette and layout; `buildMap` turns that into
// geometry, colliders and spawn points. Verticality is built from stepped
// boxes rather than sloped surfaces because collision is AABB-only — a 0.3m
// rise is under the movement controller's step height, so stairs are walked
// up for free.

import * as THREE from "three";
import { makeGroundMaterial } from "./shaders.js";
import { PENTAGRIN } from "./pentagrin.js";

/* ------------------------------------------------------------ build helpers */

function makeApi(root, colliders) {
  const matCache = new Map();
  const mat = (color, rough = 0.85, metal = 0.05) => {
    const key = `${color}|${rough}|${metal}`;
    if (!matCache.has(key)) {
      matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
    }
    return matCache.get(key);
  };

  const api = {
    /* Solid box sitting on `y`, centred on (x,z). Collides and blocks bullets. */
    box(x, z, w, d, h, { color = 0x5c6b4a, y = 0, pen = 0.9, rough = 0.85, metal = 0.05 } = {}) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, rough, metal));
      mesh.position.set(x, y + h / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
      colliders.push({
        min: new THREE.Vector3(x - w / 2, y, z - d / 2),
        max: new THREE.Vector3(x + w / 2, y + h, z + d / 2),
        pen,
      });
      return mesh;
    },

    /* Decorative only — no collider, bullets pass through. */
    prop(mesh) { mesh.castShadow = true; root.add(mesh); return mesh; },

    cylinder(x, z, r, h, { color = 0x3a4530, y = 0, solid = true, pen = 4 } = {}) {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), mat(color, 0.7, 0.3));
      mesh.position.set(x, y + h / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
      if (solid) {
        colliders.push({
          min: new THREE.Vector3(x - r, y, z - r),
          max: new THREE.Vector3(x + r, y + h, z + r),
          pen,
        });
      }
      return mesh;
    },

    /* Stepped run the player can simply walk up. `dir` is "+x"|"-x"|"+z"|"-z". */
    stairs(x, z, width, steps, rise, run, dir, opts = {}) {
      const along = dir[1] === "x" ? "x" : "z";
      const sign = dir[0] === "+" ? 1 : -1;
      for (let i = 0; i < steps; i++) {
        const h = rise * (i + 1);
        const off = sign * (run * (i + 0.5));
        const px = along === "x" ? x + off : x;
        const pz = along === "z" ? z + off : z;
        const w = along === "x" ? run : width;
        const d = along === "z" ? run : width;
        api.box(px, pz, w, d, h, { pen: 6, ...opts });
      }
    },

    /* Rectangular room shell with an optional gap for a doorway per side.
       `y` lifts the whole shell, so upper floors can reuse it. */
    walls(cx, cz, w, d, h, thickness, { color = 0x3a4530, pen = 8, gaps = {}, y = 0 } = {}) {
      const half = thickness / 2;
      const sides = [
        ["n", cx, cz - d / 2 + half, w, thickness, "x"],
        ["s", cx, cz + d / 2 - half, w, thickness, "x"],
        ["w", cx - w / 2 + half, cz, thickness, d, "z"],
        ["e", cx + w / 2 - half, cz, thickness, d, "z"],
      ];
      for (const [side, sx, sz, sw, sd, axis] of sides) {
        const gap = gaps[side];
        if (!gap) { api.box(sx, sz, sw, sd, h, { color, pen, y }); continue; }
        // split the wall around a centred opening of width `gap`
        const span = axis === "x" ? sw : sd;
        const seg = (span - gap) / 2;
        if (seg <= 0.05) continue;
        for (const s of [-1, 1]) {
          const off = s * (gap / 2 + seg / 2);
          api.box(
            axis === "x" ? sx + off : sx,
            axis === "z" ? sz + off : sz,
            axis === "x" ? seg : sw,
            axis === "z" ? seg : sd,
            h, { color, pen, y },
          );
        }
      }
    },

    /* Floodlight mast — decorative pole plus a real spot light. */
    floodlight(x, z, aimAt = new THREE.Vector3(0, 0, 0), color = 0xfff0c0) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 9, 8), mat(0x2a2e26, 0.6, 0.4));
      pole.position.set(x, 4.5, z);
      root.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.6), mat(0x15170f, 0.5, 0.5));
      head.position.set(x, 9, z);
      head.lookAt(aimAt);
      root.add(head);
      const spot = new THREE.SpotLight(color, 55, 60, Math.PI / 5, 0.5, 1.2);
      spot.position.set(x, 9, z);
      spot.target.position.copy(aimAt);
      root.add(spot, spot.target);
    },

    lamp(x, y, z, color = 0xffd9a0, intensity = 12, distance = 18) {
      const l = new THREE.PointLight(color, intensity, distance, 2);
      l.position.set(x, y, z);
      root.add(l);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color }));
      bulb.position.set(x, y, z);
      root.add(bulb);
    },

    mat,
  };
  return api;
}

/* ------------------------------------------------------------------- maps */

export const MAPS = {
  grinsite: {
    name: "Grin Site",
    blurb: "Half-built and wide open above. Watch the girders.",
    bounds: { minX: -34, maxX: 34, minZ: -34, maxZ: 34 },
    playerSpawn: { x: 0, z: 26 },
    sky: { top: 0x1a2e4a, horizon: 0x6b8a5e, bottom: 0x2a3324 },
    fog: { color: 0x3a4a38, density: 0.009 },
    ground: { colorA: 0x4a5240, colorB: 0x363f2e, grid: 0x8fae6e },
    sun: { color: 0xfff2d8, intensity: 2.2, pos: [30, 45, -20] },
    hemi: { sky: 0xb9d4ff, ground: 0x39432c, intensity: 1.1 },
    ambient: { color: 0xffffff, intensity: 0.55 },
    build(api) {
      api.walls(0, 0, 68, 68, 6, 1.4);
      // central half-finished tower with stairs up two storeys
      api.box(0, 0, 12, 12, 0.4, { color: 0x6a6a60, pen: 6 });
      api.box(-4, -4, 4, 4, 3.2, { color: 0x59614a });
      api.box(4, 4, 4, 4, 3.2, { color: 0x59614a });
      api.stairs(-2, 8, 5, 10, 0.32, 0.7, "-z", { color: 0x6a6a60 });
      api.box(0, -1, 12, 5, 3.4, { color: 0x6a6a60, pen: 6 });
      // stacked container blocks
      const containers = [
        [-16, -12, 6, 2.6, 2.6, 0x8a5a3a], [-16, -12, 6, 2.6, 2.6, 0x8a5a3a],
        [15, -14, 6, 2.6, 2.6, 0x3a6a7a], [-20, 12, 6, 2.6, 2.6, 0x7a6a3a],
        [18, 13, 6, 2.6, 2.6, 0x6a3a4a],
      ];
      for (const [x, z, w, d, h, c] of containers) {
        api.box(x, z, w, d, h, { color: c, pen: 3 });
        api.box(x + 1.4, z, w * 0.8, d, h, { color: c, y: h, pen: 3 });
      }
      // scaffold towers
      for (const [x, z] of [[-24, -24], [24, -24], [-24, 24], [24, 24]]) {
        api.box(x, z, 5, 5, 0.35, { color: 0x6a6a60, pen: 6 });
        api.box(x, z, 5, 5, 0.35, { color: 0x6a6a60, y: 3.2, pen: 6 });
        api.stairs(x, z + 3.4, 3.5, 10, 0.32, 0.62, "-z", { color: 0x555b48 });
      }
      // loose cover
      for (const [x, z, w, d, h] of [[8, -18, 3, 3, 1.4], [-9, 18, 4, 2.5, 1.5],
        [-11, -2, 2.6, 2.6, 1.2], [12, 6, 3, 3, 1.6], [0, 20, 5, 2, 1.3], [0, -22, 5, 2, 1.3]]) {
        api.box(x, z, w, d, h, { color: 0x5c6b4a });
      }
      // crane mast, decorative
      const crane = new THREE.Mesh(new THREE.BoxGeometry(1, 26, 1), api.mat(0xd8a03a, 0.6, 0.4));
      crane.position.set(-28, 13, -28);
      api.prop(crane);
      const jib = new THREE.Mesh(new THREE.BoxGeometry(30, 0.8, 0.8), api.mat(0xd8a03a, 0.6, 0.4));
      jib.position.set(-14, 25, -28);
      api.prop(jib);
      for (const [x, z] of [[-30, -30], [30, -30], [-30, 30], [30, 30]]) api.floodlight(x, z);
    },
    spawns: [[-30, -30], [30, -30], [-30, 30], [30, 30], [0, -31], [0, 31], [-31, 0], [31, 0]],
  },

  undergrin: {
    name: "Undergrin",
    blurb: "Two platforms, one tunnel. Nowhere to be far away.",
    bounds: { minX: -13, maxX: 13, minZ: -32, maxZ: 32 },
    playerSpawn: { x: 0, z: 26 },
    sky: { top: 0x05070a, horizon: 0x0d1015, bottom: 0x05070a },
    fog: { color: 0x0c1014, density: 0.035 },
    ground: { colorA: 0x2e3038, colorB: 0x24262c, grid: 0x4a5566 },
    sun: { color: 0x6a7a99, intensity: 0.25, pos: [10, 30, 10] },
    hemi: { sky: 0x3a4658, ground: 0x14161a, intensity: 0.5 },
    ambient: { color: 0x8899bb, intensity: 0.35 },
    build(api) {
      api.walls(0, 0, 26, 64, 7, 1.5, { color: 0x2b2f36 });
      // ceiling so it reads as underground
      const ceil = new THREE.Mesh(new THREE.BoxGeometry(26, 0.6, 64), api.mat(0x1e2127, 0.9));
      ceil.position.set(0, 7, 0);
      api.prop(ceil);
      // raised platforms either side of a sunken track
      api.box(-8.5, 0, 9, 62, 1.1, { color: 0x3a3f47, pen: 8 });
      api.box(8.5, 0, 9, 62, 1.1, { color: 0x3a3f47, pen: 8 });
      // support pillars
      for (let z = -26; z <= 26; z += 6.5) {
        api.cylinder(-4.2, z, 0.55, 6, { color: 0x33373e });
        api.cylinder(4.2, z, 0.55, 6, { color: 0x33373e });
      }
      // benches and kiosks as cover on the platforms
      for (const [x, z, w, d, h] of [[-10, -14, 2.2, 4, 1.0], [10, 8, 2.2, 4, 1.0],
        [-10, 12, 2.4, 3, 1.8], [10, -10, 2.4, 3, 1.8], [-9, 22, 3, 3, 1.5], [9, -22, 3, 3, 1.5]]) {
        api.box(x, z, w, d, h, { color: 0x454b55, y: 1.1 });
      }
      // stairs from the track up to each platform, mid-map
      api.stairs(-4.6, 2, 5, 4, 0.3, 0.6, "-x", { color: 0x3f444c });
      api.stairs(4.6, -2, 5, 4, 0.3, 0.6, "+x", { color: 0x3f444c });
      for (let z = -28; z <= 28; z += 7) api.lamp(0, 6.2, z, 0xbcd8ff, 9, 16);
    },
    spawns: [[0, -30], [0, 30], [-9, -28], [9, -28], [-9, 28], [9, 28], [0, -20], [0, 20]],
  },

  dustbowl: {
    name: "Dust Bowl",
    blurb: "Long sightlines and thin cover. Bring glass.",
    bounds: { minX: -45, maxX: 45, minZ: -45, maxZ: 45 },
    playerSpawn: { x: 0, z: 36 },
    sky: { top: 0x3b6ea5, horizon: 0xd9b271, bottom: 0x94764a },
    // Ambient and hemi stay low here: the first pass lit everything so evenly
    // that the sand geometry had no shading and the map read as a flat wash.
    fog: { color: 0xc0a473, density: 0.0032 },
    ground: { colorA: 0x9c8555, colorB: 0x836e42, grid: 0xb8a271 },
    sun: { color: 0xfff0cf, intensity: 2.6, pos: [40, 55, 25] },
    hemi: { sky: 0xffe6bb, ground: 0x6a5730, intensity: 0.62 },
    ambient: { color: 0xfff2dd, intensity: 0.26 },
    build(api) {
      api.walls(0, 0, 90, 90, 5, 1.6, { color: 0x8a7346 });
      // ruined compound in the middle
      api.walls(0, 0, 22, 18, 4, 1, { color: 0xad8d5c, gaps: { n: 5, s: 5, w: 4, e: 4 } });
      api.box(0, 0, 7, 6, 3.2, { color: 0x94794e });
      api.stairs(0, 5, 5, 9, 0.34, 0.62, "-z", { color: 0x94794e });
      // outlying ruins
      for (const [cx, cz] of [[-26, -20], [24, -22], [-24, 24], [26, 22]]) {
        api.walls(cx, cz, 12, 10, 3.4, 0.9, { color: 0xad8d5c, gaps: { n: 3.5, e: 3 } });
        api.box(cx, cz, 3, 3, 1.6, { color: 0x7f6a44 });
      }
      // rock cover scattered along the open lanes
      for (const [x, z, r, h] of [[-12, -34, 2.2, 2.0], [14, -32, 2.6, 2.4], [-16, 8, 2.0, 1.8],
        [18, 10, 2.4, 2.2], [-34, 2, 2.8, 2.6], [34, -4, 2.4, 2.2], [6, 30, 2.2, 1.9], [-8, 32, 2.6, 2.3]]) {
        api.cylinder(x, z, r, h, { color: 0x6f5d3c, pen: 3 });
      }
      // low walls giving sniper lanes something to break up
      for (const [x, z, w, d] of [[-20, -6, 14, 1], [20, 6, 14, 1], [-6, 18, 1, 12], [6, -18, 1, 12]]) {
        api.box(x, z, w, d, 1.2, { color: 0x94794e, pen: 4 });
      }
    },
    spawns: [[-40, -40], [40, -40], [-40, 40], [40, 40], [0, -42], [0, 42], [-42, 0], [42, 0]],
  },

  depot: {
    name: "The Depot",
    blurb: "Crates, catwalks, and someone always behind you.",
    bounds: { minX: -28, maxX: 28, minZ: -22, maxZ: 22 },
    playerSpawn: { x: 0, z: 17 },
    sky: { top: 0x0a0d12, horizon: 0x161b22, bottom: 0x0a0d12 },
    fog: { color: 0x161b1e, density: 0.02 },
    ground: { colorA: 0x4a4e56, colorB: 0x3d4147, grid: 0x76828a },
    // The ceiling seals the sun out entirely, so the interior lives on
    // ambient plus the lamp grid — both have to carry more than usual.
    sun: { color: 0xbfd0e0, intensity: 0.5, pos: [10, 40, -10] },
    hemi: { sky: 0x7c8ea8, ground: 0x2a2f36, intensity: 0.85 },
    ambient: { color: 0xccd8e6, intensity: 0.8 },
    build(api) {
      api.walls(0, 0, 56, 44, 9, 1.5, { color: 0x2f343a });
      const ceil = new THREE.Mesh(new THREE.BoxGeometry(56, 0.6, 44), api.mat(0x22262b, 0.9));
      ceil.position.set(0, 9, 0);
      api.prop(ceil);

      // shelving rows — the main sightline breakers
      for (const rowZ of [-11, 0, 11]) {
        for (const x of [-18, -6, 6, 18]) {
          api.box(x, rowZ, 8, 3, 2.6, { color: 0x93794a, pen: 2.2 });
          api.box(x, rowZ, 8, 3, 2.2, { color: 0xa88b56, y: 2.6, pen: 2.2 });
        }
      }
      // catwalk ring at height, reached by stairs in two corners
      const CAT_Y = 4.6;
      for (const [x, z, w, d] of [[0, -19, 54, 3], [0, 19, 54, 3], [-25.5, 0, 3, 38], [25.5, 0, 3, 38]]) {
        api.box(x, z, w, d, 0.4, { color: 0x4b5158, y: CAT_Y, pen: 6 });
      }
      api.stairs(-21, 14, 4, 14, 0.33, 0.62, "-z", { color: 0x4b5158 });
      api.stairs(21, -14, 4, 14, 0.33, 0.62, "+z", { color: 0x4b5158 });
      // loose crates on the floor
      for (const [x, z, s, h] of [[-12, -17, 2.4, 1.6], [11, 16, 2.6, 1.8], [-2, 6, 2.2, 1.4],
        [2, -6, 2.2, 1.4], [-20, 6, 2.6, 2.0], [20, -6, 2.6, 2.0]]) {
        api.box(x, z, s, s, h, { color: 0x93794a, pen: 2 });
      }
      for (const [x, z] of [[-18, -14], [0, -14], [18, -14], [-18, 0], [0, 0], [18, 0],
        [-18, 14], [0, 14], [18, 14]]) api.lamp(x, 8.2, z, 0xffe0b0, 28, 30);
    },
    spawns: [[-25, -19], [25, -19], [-25, 19], [25, 19], [0, -20], [0, 20], [-26, 0], [26, 0]],
  },

  culdegrin: {
    name: "Cul-de-Grin",
    blurb: "Quiet street. Every window is a problem.",
    bounds: { minX: -34, maxX: 34, minZ: -30, maxZ: 30 },
    playerSpawn: { x: 0, z: 24 },
    sky: { top: 0x24406b, horizon: 0xd88a5a, bottom: 0x3a3040 },
    fog: { color: 0x6a5a55, density: 0.012 },
    ground: { colorA: 0x4e5442, colorB: 0x3e4436, grid: 0x7d8a63 },
    sun: { color: 0xffc898, intensity: 1.6, pos: [-35, 22, 30] },
    hemi: { sky: 0x8aa2cc, ground: 0x2e3326, intensity: 0.9 },
    ambient: { color: 0xffe0cc, intensity: 0.5 },
    build(api) {
      api.walls(0, 0, 68, 60, 6, 1.4, { color: 0x3c4436 });
      // road down the middle
      const road = new THREE.Mesh(new THREE.PlaneGeometry(12, 58), api.mat(0x3a3a3c, 0.95));
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0.02, 0);
      road.receiveShadow = true;
      api.prop(road);

      // houses either side, each enterable with a doorway facing the street
      const houses = [
        [-18, -18, "e"], [-18, 0, "e"], [-18, 18, "e"],
        [18, -18, "w"], [18, 0, "w"], [18, 18, "w"],
      ];
      for (const [x, z, door] of houses) {
        const gaps = { [door]: 3 };
        api.walls(x, z, 14, 12, 3.6, 0.7, { color: 0xa8896a, gaps });
        // roof, decorative so you can still shoot in through the doorway
        const roof = new THREE.Mesh(new THREE.BoxGeometry(15, 0.5, 13), api.mat(0x6b4436, 0.9));
        roof.position.set(x, 3.85, z);
        api.prop(roof);
        // interior cover
        api.box(x + (door === "e" ? -3 : 3), z + 3, 3, 2, 1.2, { color: 0x8a7358, pen: 1.5 });
        api.lamp(x, 3.2, z, 0xffcf9a, 8, 12);
      }
      // street furniture
      for (const [x, z, w, d, h] of [[-7, -10, 2, 4, 1.4], [7, 10, 2, 4, 1.4],
        [-7, 14, 2.4, 2.4, 1.6], [7, -14, 2.4, 2.4, 1.6], [0, 0, 3, 3, 1.1]]) {
        api.box(x, z, w, d, h, { color: 0x54604a, pen: 2 });
      }
      // hedges — soft cover, bullets punch through
      for (const [x, z, w, d] of [[-10, 24, 14, 1.2], [10, -24, 14, 1.2], [-10, -24, 14, 1.2], [10, 24, 14, 1.2]]) {
        api.box(x, z, w, d, 1.5, { color: 0x3f6b3a, pen: 0.5 });
      }
      for (const [x, z] of [[-6, -26], [6, 26]]) api.floodlight(x, z, new THREE.Vector3(0, 0, 0), 0xffe2b0);
    },
    spawns: [[-30, -26], [30, -26], [-30, 26], [30, 26], [0, -28], [0, 28], [-31, 0], [31, 0]],
  },
};

// Zombies-only, so it's registered for buildMap but kept out of the PvP picker.
MAPS.pentagrin = PENTAGRIN;

export const MAP_IDS = Object.keys(MAPS).filter((id) => id !== "pentagrin");

/* ------------------------------------------------------------------ builder */

/* Fills `colliders` and `arena` in place — the movement controller holds
   references to both, so they must be mutated rather than replaced. */
export function buildMap(id, { colliders, arena }) {
  const map = MAPS[id] || MAPS.grinsite;
  const root = new THREE.Group();

  colliders.length = 0;
  Object.assign(arena, map.bounds);

  const g = map.ground;
  const w = map.bounds.maxX - map.bounds.minX + 24;
  const d = map.bounds.maxZ - map.bounds.minZ + 24;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 1, 1), makeGroundMaterial(g));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  map.build(makeApi(root, colliders));

  return {
    root,
    map,
    spawnPoints: map.spawns.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    playerSpawn: map.playerSpawn,
  };
}

/* Top-down schematic of a map, for the lobby's map cards.

   It builds the map into a throwaway group, keeps the ground-level collider
   footprints and drops the geometry again. Cheaper than holding five arenas
   alive just to draw five thumbnails, and — unlike a hand-drawn preview — it
   can't drift away from the layout you actually spawn into. */
const schematics = new Map();

export function mapSchematic(id) {
  if (schematics.has(id)) return schematics.get(id);
  const colliders = [];
  const arena = {};
  const built = buildMap(id, { colliders, arena });
  const out = {
    bounds: { ...arena },
    rects: colliders
      .filter((c) => c.min.y < 1.6)          // overhead structures aren't walls
      .map((c) => ({ x0: c.min.x, z0: c.min.z, x1: c.max.x, z1: c.max.z })),
  };
  built.root.traverse((o) => {
    o.geometry?.dispose?.();
    if (o.material) for (const m of [].concat(o.material)) m.dispose?.();
  });
  schematics.set(id, out);
  return out;
}

export function disposeMap(built, scene) {
  if (!built) return;
  scene.remove(built.root);
  built.root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose?.();
  });
}
