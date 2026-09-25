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
import { SURFACES } from "./surface-textures.js";
import { crateStack, barrel, sandbagWall, chainBarricade, shippingContainer } from "./battlefield-props.js";
import {
  portrait, picketFence, mailbox, kiddiePool, houseExterior,
  toyCar, gardenGnome, trashCan, tireSwing, streetlamp,
} from "./house-props.js";

/* ------------------------------------------------------------ surface PBR */
// SURFACES (the CC0 tileable texture sets) now lives in surface-textures.js,
// shared with house-props.js and battlefield-props.js so modelled houses
// and cover props can be retextured the same way as procedural geometry.

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

  // Tinted, textured material for a box of world-space size (w,h,d): tiles
  // the surface's maps at roughly 1 repeat per `tileSize` metres so bricks
  // and boards read at a consistent real-world scale across every box that
  // uses them, then multiplies in `color` so each map keeps its palette.
  // `color` here still carries the old flat-color values (often quite dark,
  // tuned for a solid fill), and MeshStandardMaterial's color multiplies
  // straight into the texture — applied at full strength it crushes the
  // photo texture down to near-black. Blending 55% toward white keeps the
  // hue and the map's mood while leaving the texture's own contrast visible.
  const surfMatCache = new Map();
  const tint = new THREE.Color();
  const surf = (surface, color, w, h, tileSize = 2) => {
    const s = SURFACES[surface];
    if (!s) return mat(color);
    const rx = Math.max(1, Math.round(w / tileSize));
    const ry = Math.max(1, Math.round(h / tileSize));
    const key = `${surface}|${color}|${rx}|${ry}`;
    if (surfMatCache.has(key)) return surfMatCache.get(key);
    tint.set(color).lerp(new THREE.Color(0xffffff), 0.55);
    const opts = {
      color: tint.getHex(),
      map: s.color.clone(),
      normalMap: s.normal.clone(),
      roughnessMap: s.rough.clone(),
      roughness: 1,
      metalness: surface === "metal" ? 0.7 : 0.05,
    };
    if (s.ao) opts.aoMap = s.ao.clone();
    if (s.metal) opts.metalnessMap = s.metal.clone();
    const m = new THREE.MeshStandardMaterial(opts);
    for (const map of [m.map, m.normalMap, m.roughnessMap, m.aoMap, m.metalnessMap]) {
      if (!map) continue;
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(rx, ry);
      map.needsUpdate = true;
    }
    surfMatCache.set(key, m);
    return m;
  };

  const api = {
    /* Solid box sitting on `y`, centred on (x,z). Collides and blocks bullets.
       `surface` picks a PBR material from SURFACES (tinted by `color`)
       instead of the flat-color fallback; `tile` overrides the metres-per-
       repeat used to compute that surface's UV tiling for this box. */
    box(x, z, w, d, h, { color = 0x5c6b4a, y = 0, pen = 0.9, rough = 0.85, metal = 0.05, surface = null, tile = 2 } = {}) {
      const material = surface ? surf(surface, color, w, h, tile) : mat(color, rough, metal);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
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

    /* Collider only, no mesh — for GLTF-modelled props whose visible shape
       comes from a loaded model rather than a generated box. */
    ghostBox(x, z, w, d, h, { y = 0, pen = 0.9 } = {}) {
      colliders.push({
        min: new THREE.Vector3(x - w / 2, y, z - d / 2),
        max: new THREE.Vector3(x + w / 2, y + h, z + d / 2),
        pen,
      });
    },

    cylinder(x, z, r, h, { color = 0x3a4530, y = 0, solid = true, pen = 4, surface = null, tile = 1.5 } = {}) {
      const material = surface ? surf(surface, color, r * 2, h, tile) : mat(color, 0.7, 0.3);
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), material);
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
    walls(cx, cz, w, d, h, thickness, { color = 0x3a4530, pen = 8, gaps = {}, y = 0, surface = null, tile = 2 } = {}) {
      const half = thickness / 2;
      const boxOpts = { color, pen, y, surface, tile };
      const sides = [
        ["n", cx, cz - d / 2 + half, w, thickness, "x"],
        ["s", cx, cz + d / 2 - half, w, thickness, "x"],
        ["w", cx - w / 2 + half, cz, thickness, d, "z"],
        ["e", cx + w / 2 - half, cz, thickness, d, "z"],
      ];
      for (const [side, sx, sz, sw, sd, axis] of sides) {
        const gap = gaps[side];
        if (!gap) { api.box(sx, sz, sw, sd, h, boxOpts); continue; }
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
            h, boxOpts,
          );
        }
      }
    },

    /* Collider-only room shell — same door-gap geometry as walls(), but
       with no visible boxes, for pairing with a modelled house exterior
       (house-props.js's houseExterior) instead of procedural walls. */
    ghostWalls(cx, cz, w, d, h, thickness, { pen = 8, gaps = {}, y = 0 } = {}) {
      const half = thickness / 2;
      const sides = [
        ["n", cx, cz - d / 2 + half, w, thickness, "x"],
        ["s", cx, cz + d / 2 - half, w, thickness, "x"],
        ["w", cx - w / 2 + half, cz, thickness, d, "z"],
        ["e", cx + w / 2 - half, cz, thickness, d, "z"],
      ];
      for (const [side, sx, sz, sw, sd, axis] of sides) {
        const gap = gaps[side];
        if (!gap) { api.ghostBox(sx, sz, sw, sd, h, { y, pen }); continue; }
        const span = axis === "x" ? sw : sd;
        const seg = (span - gap) / 2;
        if (seg <= 0.05) continue;
        for (const s of [-1, 1]) {
          const off = s * (gap / 2 + seg / 2);
          api.ghostBox(
            axis === "x" ? sx + off : sx,
            axis === "z" ? sz + off : sz,
            axis === "x" ? seg : sw,
            axis === "z" ? seg : sd,
            h, { y, pen },
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
      api.walls(0, 0, 68, 68, 6, 1.4, { surface: "concrete" });
      // central half-finished tower with stairs up two storeys
      api.box(0, 0, 12, 12, 0.4, { color: 0x6a6a60, pen: 6, surface: "concrete" });
      api.box(-4, -4, 4, 4, 3.2, { color: 0x59614a, surface: "concrete" });
      api.box(4, 4, 4, 4, 3.2, { color: 0x59614a, surface: "concrete" });
      // lands on the block's south edge (z 1.5) rather than running into it
      api.stairs(-2, 8.5, 5, 10, 0.32, 0.7, "-z", { color: 0x6a6a60, surface: "concrete", tile: 1 });
      api.box(0, -1, 12, 5, 3.4, { color: 0x6a6a60, pen: 6, surface: "concrete" });
      // stacked container blocks
      const containers = [
        [-16, -12, 6, 2.6, 2.6, 0x8a5a3a],
        [15, -14, 6, 2.6, 2.6, 0x3a6a7a], [-20, 12, 6, 2.6, 2.6, 0x7a6a3a],
        [18, 13, 6, 2.6, 2.6, 0x6a3a4a],
      ];
      for (const [x, z, w, d, h, c] of containers) {
        api.box(x, z, w, d, h, { color: c, pen: 3, surface: "metal", tile: 1.3 });
        api.box(x + 1.4, z, w * 0.8, d, h, { color: c, y: h, pen: 3, surface: "metal", tile: 1.3 });
      }
      // scaffold towers
      for (const [x, z] of [[-24, -24], [24, -24], [-24, 24], [24, 24]]) {
        api.box(x, z, 5, 5, 0.35, { color: 0x6a6a60, pen: 6 });
        api.box(x, z, 5, 5, 0.35, { color: 0x6a6a60, y: 3.2, pen: 6 });
        // Posts hold the deck up, and the stair climbs from the map side and
        // lands on the deck's edge. It used to run underneath the deck, so the
        // top of the flight was a dead end under a 0.3m ceiling.
        for (const [px, pz] of [[-2.3, -2.3], [2.3, -2.3], [-2.3, 2.3], [2.3, 2.3]]) {
          api.cylinder(x + px, z + pz, 0.14, 2.85, { color: 0x555b48, y: 0.35, pen: 3 });
        }
        const inward = z > 0 ? -1 : 1;             // toward the middle of the map
        const edge = z + inward * 2.5;             // the deck edge facing the middle
        api.stairs(x, edge + inward * 11 * 0.62, 3.5, 11, 0.323, 0.62, inward > 0 ? "-z" : "+z", { color: 0x555b48 });
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
      api.walls(0, 0, 26, 64, 7, 1.5, { color: 0x2b2f36, surface: "concrete" });
      // ceiling so it reads as underground
      const ceil = new THREE.Mesh(new THREE.BoxGeometry(26, 0.6, 64), api.mat(0x1e2127, 0.9));
      ceil.position.set(0, 7, 0);
      api.prop(ceil);
      // raised platforms either side of a sunken track
      api.box(-8.5, 0, 9, 62, 1.1, { color: 0x3a3f47, pen: 8, surface: "concrete", tile: 3 });
      api.box(8.5, 0, 9, 62, 1.1, { color: 0x3a3f47, pen: 8, surface: "concrete", tile: 3 });
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
      // Steps from the track up to each platform, twice per side. They sit in
      // the track and land on the platform edge: the old pair was buried
      // inside the platforms, so a player who dropped onto the track was stuck.
      for (const z of [3.25, -22.75]) api.stairs(-1.6, z, 5, 4, 0.275, 0.6, "-x", { color: 0x3f444c });
      for (const z of [-3.25, 22.75]) api.stairs(1.6, z, 5, 4, 0.275, 0.6, "+x", { color: 0x3f444c });
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
      api.walls(0, 0, 90, 90, 5, 1.6, { color: 0x8a7346, surface: "brick", tile: 2.5 });
      // ruined compound in the middle
      api.walls(0, 0, 22, 18, 4, 1, { color: 0xad8d5c, gaps: { n: 5, s: 5, w: 4, e: 4 }, surface: "brick", tile: 2.5 });
      api.box(0, 0, 7, 6, 3.2, { color: 0x94794e, surface: "brick", tile: 2.5 });
      // climbs from the south doorway and lands on the block's roof edge (z 3)
      api.stairs(0, 9.2, 5, 10, 0.32, 0.62, "-z", { color: 0x94794e });
      // outlying ruins
      for (const [cx, cz] of [[-26, -20], [24, -22], [-24, 24], [26, 22]]) {
        api.walls(cx, cz, 12, 10, 3.4, 0.9, { color: 0xad8d5c, gaps: { n: 3.5, e: 3 }, surface: "brick", tile: 2.5 });
        api.box(cx, cz, 3, 3, 1.6, { color: 0x7f6a44, surface: "brick", tile: 2.5 });
      }
      // rock cover scattered along the open lanes
      for (const [x, z, r, h] of [[-12, -34, 2.2, 2.0], [14, -32, 2.6, 2.4], [-16, 8, 2.0, 1.8],
        [18, 10, 2.4, 2.2], [-34, 2, 2.8, 2.6], [34, -4, 2.4, 2.2], [6, 30, 2.2, 1.9], [-8, 32, 2.6, 2.3]]) {
        api.cylinder(x, z, r, h, { color: 0x6f5d3c, pen: 3, surface: "rock", tile: 2 });
      }
      // low walls giving sniper lanes something to break up
      // (the other two lanes get sandbag walls below, on the same lines)
      for (const [x, z, w, d] of [[20, 6, 14, 1], [-6, 18, 1, 12]]) {
        api.box(x, z, w, d, 1.2, { color: 0x94794e, pen: 4 });
      }
      // sandbag emplacements and dropped supply barrels along the lanes
      sandbagWall(api, { x: -20, z: -6, w: 14, rot: 0 });
      sandbagWall(api, { x: 6, z: -18, w: 12, rot: Math.PI / 2 });
      for (const [x, z] of [[-30, -10], [30, 12], [-4, 26], [4, -26]]) {
        barrel(api, { x, z });
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
      api.walls(0, 0, 56, 44, 9, 1.5, { color: 0x2f343a, surface: "concrete" });
      const ceil = new THREE.Mesh(new THREE.BoxGeometry(56, 0.6, 44), api.mat(0x22262b, 0.9));
      ceil.position.set(0, 9, 0);
      api.prop(ceil);

      // shelving rows — the main sightline breakers
      for (const rowZ of [-11, 0, 11]) {
        for (const x of [-18, -6, 6, 18]) {
          api.box(x, rowZ, 8, 3, 2.6, { color: 0x93794a, pen: 2.2, surface: "wood", tile: 1.5 });
          api.box(x, rowZ, 8, 3, 2.2, { color: 0xa88b56, y: 2.6, pen: 2.2, surface: "wood", tile: 1.5 });
        }
      }
      // catwalk ring at height, reached by stairs in two corners
      const CAT_Y = 4.6;
      for (const [x, z, w, d] of [[0, -19, 54, 3], [0, 19, 54, 3], [-25.5, 0, 3, 38], [25.5, 0, 3, 38]]) {
        api.box(x, z, w, d, 0.4, { color: 0x4b5158, y: CAT_Y, pen: 6, surface: "metal", tile: 2 });
      }
      // Stair runs in the 2m gap between the wall catwalks and the racking,
      // landing on the north and south catwalks. The old runs climbed up
      // under the top shelf and stopped there.
      api.stairs(-23, 17.5 - 15 * 0.62, 2, 15, 0.334, 0.62, "+z", { color: 0x4b5158 });
      api.stairs(23, -17.5 + 15 * 0.62, 2, 15, 0.334, 0.62, "-z", { color: 0x4b5158 });
      // Columns under the catwalk's inner edge, so the ring isn't floating.
      for (const x of [-22, -11, 0, 11, 22]) {
        for (const z of [-17.8, 17.8]) api.cylinder(x, z, 0.2, CAT_Y, { color: 0x3d4248, pen: 6 });
      }
      for (const z of [-11, 0, 11]) {
        for (const x of [-24.3, 24.3]) api.cylinder(x, z, 0.2, CAT_Y, { color: 0x3d4248, pen: 6 });
      }
      // loose crate stacks on the floor
      for (const [x, z, size] of [[-12, -15, 2.0], [11, 16, 2.2], [-2, 6, 1.4],
        [4.2, -6, 1.4], [-20, 6, 2.2], [20, -6, 2.2]]) {
        crateStack(api, { x, z, size });
      }
      // a shipping container athwart the aisle between shelving rows
      shippingContainer(api, { x: 0, z: -5.5, rot: 0, len: 5 });
      for (const [x, z] of [[-18, -14], [0, -14], [18, -14], [-18, 0], [0, 0], [18, 0],
        [-18, 14], [0, 14], [18, 14]]) api.lamp(x, 8.2, z, 0xffe0b0, 28, 30);
    },
    spawns: [[-25, -19], [25, -19], [-25, 19], [25, 19], [0, -20], [0, 20], [-26, 0], [26, 0]],
  },

  range: {
    name: "The Grinnery",
    blurb: "Covered range. Fixed distances, targets that stand back up.",
    bounds: { minX: -22, maxX: 22, minZ: -34, maxZ: 30 },
    playerSpawn: { x: 0, z: 26 },
    sky: { top: 0x243044, horizon: 0x53637a, bottom: 0x2b3340 },
    fog: { color: 0x39424f, density: 0.006 },
    ground: { colorA: 0x4d5348, colorB: 0x3c4239, grid: 0x77836a },
    sun: { color: 0xfff2d8, intensity: 1.5, pos: [18, 40, 30] },
    hemi: { sky: 0xb9d4ff, ground: 0x39432c, intensity: 1.0 },
    ambient: { color: 0xffffff, intensity: 0.7 },
    build(api) {
      const WALL = 0x59604f;
      const BAY = 0x6d7462;

      // outer shell, high enough that stray rounds stay inside
      api.walls(0, -2, 44, 64, 8, 1.2, { color: WALL, pen: 14, surface: "concrete" });

      // firing line: a low bench you shoot over, with three bays
      api.box(0, 27.2, 44, 0.6, 1.05, { color: BAY, pen: 6 });
      for (const x of [-7, 7]) api.box(x, 28.6, 0.5, 3.2, 2.4, { color: BAY, pen: 6 });

      // roof over the firing line only — the lane itself stays open to the sky
      api.box(0, 28.4, 44, 5.2, 0.4, { color: 0x4a5044, y: 4.2, pen: 10 });
      for (const x of [-20, -7, 7, 20]) {
        api.box(x, 30.4, 0.5, 0.5, 4.2, { color: 0x3e443a, pen: 8 });
      }

      // distance boards down the left wall, one per marked range
      const board = (dz, label) => {
        const z = 26 - dz;
        api.box(-20.6, z, 0.4, 2.4, 0.9, { color: 0x2b3128, y: 1.6, pen: 4 });
        api.lamp(-19.4, 2.6, z, 0xffe2b0, 5, 9);
        // a stripe on the deck so the distance reads from the firing line too
        api.box(0, z, 40, 0.35, 0.06, { color: label % 2 ? 0x8f9a80 : 0xb9c2a8, pen: 0.4 });
      };
      board(10, 1); board(25, 2); board(40, 3); board(55, 4);

      // cover blocks mid-lane: something to lean out of and bounce nades off
      for (const [x, z, w, d, h] of [[-11, 8, 3, 3, 1.5], [11, 8, 3, 3, 1.5],
        [-6, -2, 2.4, 6, 1.2], [6, -2, 2.4, 6, 1.2], [0, 14, 5, 1.6, 1.1]]) {
        api.box(x, z, w, d, h, { color: 0x545c48, pen: 2.5 });
      }

      // a short flight up to a raised platform, for testing angles and vaults
      api.stairs(16, 20, 4, 8, 0.34, 0.7, "-z", { color: 0x5e6553 });
      api.box(16, 10, 6, 10, 2.7, { color: 0x5e6553, pen: 8 });

      // penetration wall: three thicknesses of the same material, side by side
      api.box(-14, -14, 3, 0.4, 2.4, { color: 0x7a7268, pen: 1, surface: "brick", tile: 1.5 });
      api.box(-9, -14, 3, 1.0, 2.4, { color: 0x7a7268, pen: 1, surface: "brick", tile: 1.5 });
      api.box(-4, -14, 3, 1.8, 2.4, { color: 0x7a7268, pen: 1, surface: "brick", tile: 1.5 });

      for (const [x, z] of [[-16, 24], [16, 24], [-16, -6], [16, -6]]) {
        api.lamp(x, 5, z, 0xfff0d0, 14, 26);
      }
    },
    spawns: [[0, 26], [-8, 26], [8, 26], [0, 22], [-8, 22], [8, 22], [-14, 24], [14, 24]],
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
      api.walls(0, 0, 68, 60, 6, 1.4, { color: 0x3c4436, surface: "concrete" });
      // road down the middle
      const roadMat = new THREE.MeshStandardMaterial({
        color: 0x8a8a8c,
        map: SURFACES.asphalt.color.clone(),
        normalMap: SURFACES.asphalt.normal.clone(),
        roughnessMap: SURFACES.asphalt.rough.clone(),
        roughness: 1,
      });
      for (const t of [roadMat.map, roadMat.normalMap, roadMat.roughnessMap]) {
        t.repeat.set(4, 20);
        t.needsUpdate = true;
      }
      const road = new THREE.Mesh(new THREE.PlaneGeometry(12, 58), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0.02, 0);
      road.receiveShadow = true;
      api.prop(road);

      // houses either side, each enterable with a doorway facing the street.
      // Exteriors are real modelled meshes (models/build_houses.blender.py —
      // pitched roof, porch, windows, chimney) instead of a flat-roofed
      // procedural box; ghostWalls() gives them the same door-gap collider
      // shape the old api.walls() box had, sized to match each model's
      // true footprint exactly. Mirrored across the road (same z, same
      // size) so the map keeps the symmetry that makes a Nuketown-style
      // layout learnable by callout, while still looking like six
      // different houses rather than one copy-pasted six times.
      const houses = [
        { x: -18, z: -18, door: "e", w: 12, d: 10, variant: "terracotta", hue: 15 },
        { x: -18, z: 0, door: "e", w: 14, d: 12, variant: "sage-attic", hue: 130, attic: true },
        { x: -18, z: 18, door: "e", w: 11, d: 11, variant: "violet", hue: 260 },
        { x: 18, z: -18, door: "w", w: 11, d: 11, variant: "violet", hue: 260 },
        { x: 18, z: 0, door: "w", w: 14, d: 12, variant: "sage", hue: 130 },
        { x: 18, z: 18, door: "w", w: 12, d: 10, variant: "terracotta-attic", hue: 15, attic: true },
      ];
      for (const { x, z, door, w, d, variant, hue, attic } of houses) {
        const gaps = { [door]: 3 };
        // thickness/door-gap match build_houses.blender.py's WALL_T/door_w
        // exactly (0.35/3.0) so the invisible collider lines up with the
        // modelled wall instead of the old guessed 0.7 slab
        api.ghostWalls(x, z, w, d, 3.2, 0.35, { gaps });
        houseExterior(api, { x, z, door, variant });
        // interior cover
        const inX = door === "e" ? -1 : 1;
        api.box(x + inX * (w / 2 - 4), z + 3, 3, 2, 1.2, { color: 0x8a7358, pen: 1.5 });
        api.lamp(x, 3.2, z, 0xffcf9a, 8, 12);
        // a portrait on the back interior wall, facing the doorway, plus a
        // second on a side wall so there's something to see from most angles
        const backWallX = x + (door === "e" ? w / 2 - 0.4 : -(w / 2 - 0.4));
        portrait(api, { x: backWallX, y: 2, z, facing: door === "e" ? "w" : "e", hue });
        portrait(api, { x, y: 2, z: z - d / 2 + 0.4, facing: "s", hue: hue + 40 });
        // yard: mailbox by the street-facing doorway, low picket fence
        // along the same front edge (a soft, see-through yard boundary,
        // not a wall to hide behind)
        const streetX = x + (door === "e" ? (w / 2 + 2) : -(w / 2 + 2));
        mailbox(api, { x: streetX, z: z + d / 2 - 1, hue });
        picketFence(api, { x: x + (door === "e" ? w / 2 + 1.2 : -(w / 2 + 1.2)), z, w: d - 2, rot: Math.PI / 2 });
        // lawn clutter — a different little scene per house so all six
        // read as distinct homes, not six repaints of one lawn
        const lawnX = x + (door === "e" ? (w / 2 + 3.2) : -(w / 2 + 3.2));
        if (variant.startsWith("terracotta")) {
          toyCar(api, { x: lawnX, z: z - d / 2 + 1.5, rot: door === "e" ? 0.3 : Math.PI + 0.3 });
          gardenGnome(api, { x: lawnX + 0.6, z: z - d / 2 + 3, rot: Math.random() * Math.PI });
        } else if (variant.startsWith("sage")) {
          tireSwing(api, { x: lawnX, z: z - d / 2 + 2, rot: 0 });
          trashCan(api, { x: lawnX - 0.4, z: z + d / 2 - 1.5 });
        } else {
          gardenGnome(api, { x: lawnX, z: z - d / 2 + 2, rot: Math.random() * Math.PI });
          trashCan(api, { x: lawnX, z: z + d / 2 - 1.5 });
        }

        // Attic sniper perch — a real floor above the ground floor, matched
        // to house-sage-attic.glb's attic box (inset 1m from each wall,
        // 2.2m tall, dormer window facing +z i.e. street-side for this
        // house's orientation) and reached by an interior stair against
        // the wall opposite the door, out of the way of the ground-floor
        // cover box. The stair's own boxes are solid (api.stairs default
        // pen), so a bullet lands on them same as any other cover — the
        // perch has to be climbed, not just seen through.
        if (attic) {
          const ATTIC_Y = 3.2;
          // stair run hugs the back (non-door) wall, well clear of the
          // ground-floor cover box which sits closer to the door side
          // The stair sits just inside the attic's own wall (inset 1m + 0.28m)
          // and the attic floor has a stairwell cut over it. It used to climb
          // into the underside of a solid floor, so the perch was unreachable.
          const sgn = door === "e" ? -1 : 1;          // back wall side
          const sOuter = x + sgn * (w / 2 - 1.3);     // stair edge by the wall
          const sInner = sOuter - sgn * 2;
          const stairX = (sOuter + sInner) / 2;
          const HOLE_Z0 = z - 3.6, HOLE_Z1 = z - 3.6 + 12 * 0.45;
          api.stairs(stairX, HOLE_Z0, 2, 12, 0.27, 0.45, "+z", { color: 0x8a7358 });
          // attic floor, in pieces around the stairwell: solid so the player
          // can stand on it, sized to the model's inset attic room (w-2 by d-2,
          // per build_houses.blender.py)
          const ax0 = x - (w - 2) / 2, ax1 = x + (w - 2) / 2;
          const az0 = z - (d - 2) / 2, az1 = z + (d - 2) / 2;
          const hx0 = Math.min(sOuter, sInner), hx1 = Math.max(sOuter, sInner);
          const floorPiece = (x0, x1, z0, z1) => {
            if (x1 - x0 < 0.05 || z1 - z0 < 0.05) return;
            api.box((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, 0.15, { color: 0x9a8a72, y: ATTIC_Y, pen: 6 });
          };
          floorPiece(ax0, hx0, az0, az1);
          floorPiece(hx1, ax1, az0, az1);
          floorPiece(hx0, hx1, az0, Math.max(az0, HOLE_Z0));
          floorPiece(hx0, hx1, Math.min(az1, HOLE_Z1), az1);
          api.lamp(x, ATTIC_Y + 1.6, z, 0xffe6b8, 7, 11);
          // attic walls had no collider at all — the perch's own room shell
          // (build_house_attic: inset w-2 by d-2, ATTIC_WALL_T=0.28, one
          // long side open for the dormer window per ATTIC_VARIANTS'
          // dormer_side) was visible but walkable/shootable through on
          // every side. Blender's Y-up export maps +y -> three.js +z, i.e.
          // this file's "s" side; sage-attic's dormer_side="+y" -> "s",
          // terracotta-attic's "-y" -> "n".
          const dormerGap = variant === "sage-attic" ? "s" : "n";
          api.ghostWalls(x, z, w - 2, d - 2, 2.2, 0.28, { y: ATTIC_Y + 0.15, gaps: { [dormerGap]: 1.6 } });
        }
      }
      // backyard pool, Nuketown-style centrepiece — tucked behind the
      // middle house rather than the road itself (already busy with the
      // checkpoint barricade), giving the flank route a hazard to duck behind
      kiddiePool(api, { x: -27, z: 5.5, r: 1.8 });
      // street furniture
      for (const [x, z, w, d, h] of [[-7, -10, 2, 4, 1.4], [7, 10, 2, 4, 1.4],
        [-7, 14, 2.4, 2.4, 1.6], [7, -14, 2.4, 2.4, 1.6]]) {
        api.box(x, z, w, d, h, { color: 0x54604a, pen: 2 });
      }
      // a checkpoint barricade thrown across the road, mid-street
      chainBarricade(api, { x: 0, z: 0, w: 5, rot: Math.PI / 2 });
      barrel(api, { x: -2.6, z: 1.2 });
      barrel(api, { x: 2.8, z: -1 });
      // hedges — soft cover, bullets punch through
      for (const [x, z, w, d] of [[-10, 24, 14, 1.2], [10, -24, 14, 1.2], [-10, -24, 14, 1.2], [10, 24, 14, 1.2]]) {
        api.box(x, z, w, d, 1.5, { color: 0x3f6b3a, pen: 0.5 });
      }
      for (const [x, z] of [[-6, -26], [6, 26]]) api.floodlight(x, z, new THREE.Vector3(0, 0, 0), 0xffe2b0);
      // real streetlamps down the road, alternating sides like an actual
      // suburban street — replaces bare point-light bulbs with a modelled
      // fixture (models/build_houses.blender.py's build_streetlamp)
      for (const [x, z, rot] of [[-6.5, -9, Math.PI / 2], [6.5, 0, -Math.PI / 2], [-6.5, 9, Math.PI / 2]]) {
        streetlamp(api, { x, z, rot });
      }
    },
    spawns: [[-30, -26], [30, -26], [-30, 26], [30, 26], [0, -28], [0, 28], [-31, 0], [31, 0]],
  },

  grinbeach: {
    name: "Grin Beach",
    blurb: "Pier, sand and boardwalk. The high ground smells like fryer oil.",
    // Laid out like the strip it's cribbed from: ocean at -Z, then wet sand,
    // dry sand, the boardwalk, and a parking lot at +Z. The three lanes run
    // east-west across that band — pier (long sightlines, almost no cover),
    // sand (open, scattered low cover) and boardwalk (tight, roofed, the
    // flanking route) — and every spawn sits a few seconds from all three.
    bounds: { minX: -40, maxX: 40, minZ: -44, maxZ: 32 },
    playerSpawn: { x: 0, z: 28 },
    // Late-afternoon Pacific: the sun is low out over the water, so the pier
    // pilings and lifeguard towers throw long shadows back up the sand.
    //
    // That low sun (about 25° up) is also why hemi and ambient run high here
    // rather than at the 0.5-0.9 the inland maps use. At this elevation an
    // up-facing deck only takes ~0.42 of the directional term and a vertical
    // face — railings, shack walls, the shaded side of a lifeguard tower —
    // takes almost none, so those faces are lit almost entirely by the
    // hemisphere. Measured on the pier, the shaded railing sat at luma 26
    // (black on screen) against 72 for the deck beside it; raising hemi to
    // 2.6 brings it to 42 while leaving the deck at 80, so the lane keeps
    // its contrast without any face going to mud. That is also roughly what
    // open-beach bounce light does in reality.
    sky: { top: 0x2f6ea8, horizon: 0xf2c68e, bottom: 0xc6dae2 },
    fog: { color: 0xcad2cc, density: 0.0055 },
    ground: { colorA: 0xd6c194, colorB: 0xbfa97c, grid: 0xe6d6ae },
    sun: { color: 0xffe2b4, intensity: 2.4, pos: [-22, 26, -52] },
    hemi: { sky: 0xcce8ff, ground: 0xc4b087, intensity: 2.6 },
    ambient: { color: 0xfff0dd, intensity: 0.75 },
    build(api) {
      // The shell only closes three sides. -Z is open ocean, held by a low
      // seawall instead of a 6m box, so the horizon reads as water rather
      // than a wall the player happens to be standing in front of.
      api.box(0, 31.3, 80, 1.4, 6, { color: 0x8a7d62, surface: "concrete" });
      api.box(-39.3, -6, 1.4, 76, 6, { color: 0x8a7d62, surface: "concrete" });
      api.box(39.3, -6, 1.4, 76, 6, { color: 0x8a7d62, surface: "concrete" });

      /* --------------------------------------------------------- the ocean */
      // buildMap's shared ground plane is centred on `bounds` and overhangs
      // them by 12m on every side, so sand would otherwise run out past the
      // shoreline and hang over the sea. The water is therefore laid *over*
      // that overhang (slightly proud of it) and run out far enough to meet
      // the fog, which hides its far edge.
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(260, 200),
        new THREE.MeshStandardMaterial({ color: 0x2f7fa8, roughness: 0.16, metalness: 0.5 }),
      );
      water.rotation.x = -Math.PI / 2;
      water.position.set(0, 0.05, -122);
      api.prop(water);
      // wet sand then a foam line at the tideline, so the sand meets the sea
      // as a gradient rather than one hard seam
      const wet = new THREE.Mesh(
        new THREE.PlaneGeometry(260, 6),
        new THREE.MeshStandardMaterial({ color: 0xa48f66, roughness: 0.5 }),
      );
      wet.rotation.x = -Math.PI / 2;
      wet.position.set(0, 0.04, -25);
      api.prop(wet);
      const foam = new THREE.Mesh(
        new THREE.PlaneGeometry(260, 2.4),
        new THREE.MeshStandardMaterial({ color: 0xeef6f4, roughness: 0.6 }),
      );
      foam.rotation.x = -Math.PI / 2;
      foam.position.set(0, 0.06, -22.2);
      api.prop(foam);
      // Knee-high seawall at the tideline. Deliberately low: it marks the
      // edge of play and gives prone cover, but anything taller turns the
      // ocean — the thing that makes this read as a beach at all — into a
      // grey stripe above a wall. The real edge of the arena is `bounds`,
      // which the movement controller clamps to regardless.
      api.box(0, -21, 80, 0.8, 0.75, { color: 0xb4ab98, pen: 5, surface: "concrete", tile: 2.5 });
      /* ----------------------------------------------------------- the pier */
      // The long lane. A raised deck running out over the water, high enough
      // to look back down the whole beach. A bait shack partway out keeps the
      // far half from being a pure no-cover shooting gallery, and two ramps at
      // different z let it be contested from both flanks instead of being a
      // single-entry camp.
      const PIER_Y = 2.6;
      const PIER_X = -13;
      // Sun-bleached planking. These run bright on purpose: the sun sits low
      // out to sea behind the pier, so every deck and railing face the player
      // sees is backlit, and surf()'s tint multiplies straight into an
      // already-dark wood photo — a mid-brown here renders near-black.
      const DECK = 0xd8c09a;
      const PILING = 0xa08a6a;
      // Deck, laid as 6m sections rather than one 42m slab. surf() derives
      // its UV tiling from a box's width and *height* only (see makeApi) —
      // depth is never sampled — so a single long, flat deck box gets one
      // texture repeat smeared down its whole length. Sectioning it means
      // each piece is close to square in the sampled axes and the planking
      // reads at a consistent scale instead of blurring out.
      for (let z = -6; z >= -44; z -= 6) {
        api.box(PIER_X, z - 3, 10, 6, 0.5, { color: DECK, y: PIER_Y, pen: 2.5, surface: "wood", tile: 2 });
      }
      // pilings under the deck, marching out into the water
      for (let z = -8; z >= -42; z -= 6) {
        for (const dx of [-4.2, 4.2]) {
          api.cylinder(PIER_X + dx, z, 0.42, PIER_Y, { color: PILING, pen: 3, surface: "wood", tile: 1.2 });
        }
      }
      // Deck railings — waist-high cover along both edges of the lane,
      // sectioned for the same UV reason as the deck itself.
      for (const dx of [-5.2, 5.2]) {
        for (let z = -6; z >= -44; z -= 6) {
          api.box(PIER_X + dx, z - 3, 0.3, 6, 1.1, {
            color: 0xe0cbaa, y: PIER_Y + 0.5, pen: 1.2, surface: "wood", tile: 1.2,
          });
        }
      }
      // ramps up from the sand, one per side at different z so the pier has
      // two contested entrances rather than one defensible mouth
      api.stairs(PIER_X - 6.8, -6, 3.4, 10, 0.31, 0.62, "-z", { color: DECK, surface: "wood", tile: 1.2 });
      api.stairs(PIER_X + 6.8, -14, 3.4, 10, 0.31, 0.62, "-z", { color: DECK, surface: "wood", tile: 1.2 });
      // bait shack out on the deck: breaks the sightline and gives the pier
      // its own piece of hard cover
      api.walls(PIER_X, -33, 7, 6, 3, 0.4, {
        color: 0xc9ae86, y: PIER_Y + 0.5, gaps: { n: 2.4, s: 2.4 }, surface: "wood", tile: 1.5,
      });
      api.box(PIER_X, -33, 7.6, 6.6, 0.3, { color: 0x9c7f5c, y: PIER_Y + 3.5, pen: 2, surface: "wood", tile: 1.5 });
      // The shack roofs itself over, so nothing but this lamp lights the
      // inside — the sun is low and behind it. Bright and wide enough that
      // someone standing in there is visible from both doorways rather than
      // being a silhouette in a black box.
      api.lamp(PIER_X, PIER_Y + 3, -33, 0xffe2b4, 14, 16);

      /* ------------------------------------------------------------ the sand */
      // Middle lane: open, fast, and deliberately thin on hard cover so it
      // stays a crossing rather than a place to sit. Everything here is
      // low — lifeguard towers are the only thing worth climbing.
      const TOWER = 0xd8452f;
      // Lifeguard towers, the sand lane's only vertical cover. Stilted hut
      // with a ramp, so holding one costs you the ground floor.
      for (const [tx, tz] of [[14, -16], [-30, -12], [26, 2]]) {
        const TY = 2.1;
        for (const [dx, dz] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) {
          api.cylinder(tx + dx, tz + dz, 0.22, TY, { color: 0x8a6a4a, pen: 2 });
        }
        api.box(tx, tz, 4.6, 4.6, 0.3, { color: TOWER, y: TY, pen: 2.5, surface: "wood", tile: 1.2 });
        // Waist-high sides and a roof on corner posts, 2.3m up: the old roof
        // sat 1.5m over the floor, too low to stand under.
        api.walls(tx, tz, 4.6, 4.6, 1.1, 0.25, {
          color: TOWER, y: TY + 0.3, gaps: { n: 2.6, s: 2.6 }, surface: "wood", tile: 1.2,
        });
        for (const [dx, dz] of [[-2.15, -2.15], [2.15, -2.15], [-2.15, 2.15], [2.15, 2.15]]) {
          api.cylinder(tx + dx, tz + dz, 0.1, 2.3, { color: 0x8a6a4a, y: TY + 0.3, pen: 2 });
        }
        api.box(tx, tz, 5, 5, 0.22, { color: 0xb8391f, y: TY + 2.6, pen: 2, surface: "wood", tile: 1.2 });
        // The stair lands on the deck at the south doorway; it used to run
        // underneath the deck and stop against it.
        api.stairs(tx, tz + 2.3 + 8 * 0.5, 2.4, 8, 0.3, 0.5, "-z", { color: 0xc07a4a });
      }
      // beach volleyball net — soft cover mid-sand, bullets go through
      for (const px of [-2, 8]) {
        api.cylinder(px, -12, 0.12, 2.6, { color: 0x6d5b41, pen: 1 });
      }
      api.box(3, -12, 10, 0.1, 0.9, { color: 0xe8e4d8, y: 1.5, pen: 0.3 });
      // beach umbrellas: pure decoration overhead, a thin pole at ground level
      for (const [ux, uz, hue] of [[-24, -18, 8], [4, -20, 190], [32, -14, 45], [-6, -4, 320]]) {
        api.cylinder(ux, uz, 0.09, 2.2, { color: 0x9a9a92, pen: 0.5 });
        const canopy = new THREE.Mesh(
          new THREE.ConeGeometry(2.1, 0.7, 12),
          api.mat(`hsl(${hue}, 62%, 58%)`, 0.75),
        );
        canopy.position.set(ux, 2.5, uz);
        api.prop(canopy);
      }
      // Concrete fire rings — squat, dark, and small enough to read as a pit
      // rather than a table. Each gets a low ember light so the sand has
      // something warm in it after the sun drops behind the pier.
      for (const [x, z] of [[-20, -6], [20, -20], [10, 8]]) {
        api.cylinder(x, z, 1.15, 0.45, { color: 0x6a6660, pen: 4, surface: "concrete", tile: 0.8 });
        const embers = new THREE.Mesh(
          new THREE.CylinderGeometry(0.85, 0.85, 0.04, 14),
          new THREE.MeshStandardMaterial({
            color: 0x2a1a14, emissive: 0xc2481a, emissiveIntensity: 0.7, roughness: 0.9,
          }),
        );
        embers.position.set(x, 0.46, z);
        api.prop(embers);
        api.lamp(x, 0.8, z, 0xff7a2a, 4, 7);
      }
      for (const [x, z] of [[-33, -20], [34, -24], [-16, 4], [18, -8]]) barrel(api, { x, z });
      // driftwood logs, long and low — the sand lane's prone cover
      for (const [x, z, w, d] of [[-8, -26, 7, 1], [24, -30, 1, 6], [-28, 2, 6, 1]]) {
        api.box(x, z, w, d, 0.8, { color: 0xc2b08c, pen: 1.5, surface: "wood", tile: 1.2 });
      }

      /* ------------------------------------------------------- the boardwalk */
      // Third lane: a raised plank walk fronting a row of shops. Tight,
      // roofed, and parallel to the shoreline, so it is the flank route
      // between the two sand-side spawns. Every shop is enterable and open
      // at the back onto the parking lot, so nothing here is a dead end.
      const WALK_Y = 0.45;
      const PLANK = 0xd2b98c;
      // Sectioned along x for the same reason as the pier deck: surf() tiles
      // from width and height, so one 76m slab 0.45m tall stretches a single
      // repeat across the whole walk.
      for (let x = -38; x < 38; x += 8) {
        api.box(x + 4, 12, 8, 7, WALK_Y, { color: PLANK, pen: 3, surface: "wood", tile: 2 });
      }
      // low rail on the sand side, with gaps at the two stair runs
      for (const [rx, rw] of [[-27, 22], [0, 14], [27, 22]]) {
        api.box(rx, 8.7, rw, 0.25, 1, { color: PLANK, y: WALK_Y, pen: 1, surface: "wood", tile: 1.5 });
      }
      api.stairs(-15, 7.6, 5, 2, 0.25, 0.6, "+z", { color: PLANK, surface: "wood", tile: 1 });
      api.stairs(15, 7.6, 5, 2, 0.25, 0.6, "+z", { color: PLANK, surface: "wood", tile: 1 });

      // Shop row. Each unit is a room with a storefront gap onto the
      // boardwalk (s) and a back door onto the lot (n), so the whole row is
      // a series of two-way cut-throughs rather than a wall of closets.
      // `stucco` is the unit's own painted facade — beachfront shops are
      // each a different pastel, and a uniform grey row read as one long
      // office block rather than four separate storefronts.
      const shops = [
        { x: -28, w: 12, sign: 0xe8574a, stucco: 0xf0d8c8 },
        { x: -12, w: 10, sign: 0x2fa8b8, stucco: 0xd8ece8 },
        { x: 4, w: 11, sign: 0xf2b134, stucco: 0xf4e6c4 },
        { x: 22, w: 13, sign: 0x8a5ad8, stucco: 0xe2d8ee },
      ];
      for (const { x, w, sign, stucco } of shops) {
        api.walls(x, 19, w, 9, 3.4, 0.45, {
          color: stucco, gaps: { s: 3.4, n: 2.8 }, surface: "concrete", tile: 2,
        });
        // flat roof — reachable from the lot-side containers, and low enough
        // that holding it trades cover for exposure to the pier
        api.box(x, 19, w + 1, 10, 0.3, { color: 0xc8bfae, y: 3.4, pen: 4, surface: "concrete", tile: 2 });
        // awning over the storefront, and a lit sign board above it
        api.box(x, 13.6, w, 2.4, 0.2, { color: sign, y: 3, pen: 1.2 });
        const board = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 1, 0.2), api.mat(sign, 0.5, 0.2));
        board.position.set(x, 4.2, 14.2);
        api.prop(board);
        api.lamp(x, 3.9, 14.6, sign, 6, 9);
        // interior counter — cover inside each unit so a doorway trade is
        // not automatically won by whoever peeks first
        api.box(x, 21, w - 4, 1.2, 1.15, { color: 0x8a7358, pen: 1.8, surface: "wood", tile: 1.2 });
        api.lamp(x, 3, 19, 0xffe8c8, 7, 11);
      }

      /* ----------------------------------------------------- the parking lot */
      // Back lane behind the shops: asphalt, a few parked containers and
      // dumpsters for cover, and the routes back through the shop row. It
      // is the safest ground on the map, which is why the spawns sit here
      // and on the far sand rather than anywhere near the pier.
      const lotMat = new THREE.MeshStandardMaterial({
        color: 0x8a8a8c,
        map: SURFACES.asphalt.color.clone(),
        normalMap: SURFACES.asphalt.normal.clone(),
        roughnessMap: SURFACES.asphalt.rough.clone(),
        roughness: 1,
      });
      for (const t of [lotMat.map, lotMat.normalMap, lotMat.roughnessMap]) {
        t.repeat.set(16, 3);
        t.needsUpdate = true;
      }
      const lot = new THREE.Mesh(new THREE.PlaneGeometry(76, 7), lotMat);
      lot.rotation.x = -Math.PI / 2;
      lot.position.set(0, 0.02, 27.5);
      lot.receiveShadow = true;
      api.prop(lot);
      // parking stripes
      for (let x = -34; x <= 34; x += 5) {
        const stripe = new THREE.Mesh(
          new THREE.PlaneGeometry(0.18, 5),
          new THREE.MeshStandardMaterial({ color: 0xe6e2d4, roughness: 0.8 }),
        );
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(x, 0.03, 27.5);
        api.prop(stripe);
      }
      // shipping containers parked along the lot — the hard cover on this side
      shippingContainer(api, { x: -20, z: 26, rot: 0 });
      shippingContainer(api, { x: 14, z: 26, rot: 0 });
      for (const [x, z] of [[-33, 25], [33, 25], [0, 26]]) crateStack(api, { x, z });
      for (const [x, z] of [[-6, 24.5], [28, 24.5]]) trashCan(api, { x, z });

      // Service stairs up to the shop roofs, at the two ends of the row.
      // A stacked container is 2.6m and the roof deck sits at 3.4m — an 0.8m
      // lip, well over the movement controller's 0.36m step height — so
      // roof access has to be a real stair run, not "climb the crate".
      // Putting them at the ends means the roof is a committed flank from
      // the lot, not a shortcut anyone falls into mid-fight.
      // Stair runs climb northward up the back of the row and land level
      // with the roof deck (11 x 0.32 = 3.52m, just proud of the 3.4m roof).
      for (const sx of [-36, 36]) {
        api.stairs(sx, 25.5, 3, 11, 0.32, 0.5, "-z", { color: 0x9a9184, surface: "concrete", tile: 1.2 });
      }
      // Plank bridges over the alleys between units. The roofs are deep
      // enough in z on their own, but there's a 4-6m gap in x between each
      // shop, so without these the "roof" is four islands you can't cross.
      // (roof spans in x are -34.5..-21.5, -17.5..-6.5, -2..10 and 15..29,
      // so these are centred on the three alleys plus one run out to each
      // end stair, each overlapping both lips rather than just meeting them)
      for (const [bx, bw] of [[-19.5, 5], [-4.25, 5.5], [12.5, 6], [-35.5, 4], [32, 7.5]]) {
        api.box(bx, 19, bw, 3, 0.25, { color: 0xc9ae86, y: 3.4, pen: 2, surface: "wood", tile: 1.5 });
      }

      /* -------------------------------------------------------------- polish */
      // Palms along the boardwalk's sand edge — decorative canopies on thin
      // trunks, so they frame the lane without blocking shots through it.
      for (const [px, pz] of [[-34, 7], [-20, 7], [-6, 7], [8, 7], [22, 7], [35, 7]]) {
        api.cylinder(px, pz, 0.32, 5.5, { color: 0x7a6748, pen: 2, surface: "wood", tile: 1.5 });
        for (let i = 0; i < 6; i++) {
          const frond = new THREE.Mesh(
            new THREE.BoxGeometry(3.2, 0.12, 0.7),
            api.mat(0x3f7a3a, 0.8),
          );
          const a = (i / 6) * Math.PI * 2;
          frond.position.set(px + Math.cos(a) * 1.5, 5.6, pz + Math.sin(a) * 1.5);
          frond.rotation.set(0, -a, -0.35);
          api.prop(frond);
        }
      }
      // streetlamps down the lot, and floodlights at the far corners so the
      // sand does not go flat at its edges
      for (const [x, z] of [[-24, 23.5], [0, 23.5], [24, 23.5]]) streetlamp(api, { x, z, rot: 0 });
      for (const [x, z] of [[-36, -20], [36, -20]]) {
        api.floodlight(x, z, new THREE.Vector3(0, 0, -8), 0xffe2b0);
      }
    },
    // Spawns hug the lot and the two far sand corners — never the pier,
    // which is the contested lane, and never inside a shop.
    spawns: [[-34, 28], [34, 28], [0, 29], [-36, -18], [36, -18], [-20, 24], [20, 28], [0, -14]],
  },
  grinsite_wip: {
    name: "Grin Site (blockout)",
    blurb: "Work-in-progress blockout of the Grin Site rebuild.",
    bounds: { minX: -34, maxX: 34, minZ: -34, maxZ: 34 },
    playerSpawn: { x: 0, z: 26 },
    sky: { top: 0x1a2e4a, horizon: 0x6b8a5e, bottom: 0x2a3324 },
    fog: { color: 0x3a4a38, density: 0.009 },
    ground: { colorA: 0x4a5240, colorB: 0x363f2e, grid: 0x8fae6e },
    sun: { color: 0xfff2d8, intensity: 2.2, pos: [30, 45, -20] },
    hemi: { sky: 0xb9d4ff, ground: 0x39432c, intensity: 1.1 },
    ambient: { color: 0xffffff, intensity: 0.55 },
    build(api) {
      const CONC = 0x9a9a92, SLAB = 0x86867e, BLOCK = 0x7d7a70, RAIL = 0xd8a03a;
      api.walls(0, 0, 68, 68, 6, 1.4, { surface: "concrete" });

      /* ---- centre: two-storey concrete frame (x -8.3..8.3, z -6.3..6.3) */
      const L1 = 3.5, L2 = 6.7;
      api.box(0, 0, 17, 13, 0.2, { color: SLAB, pen: 6 });                       // foundation
      const colX = [-7.7, -2.6, 2.6, 7.7], colZ = [-5.7, 0, 5.7];
      for (const cx of colX) for (const cz of colZ) {
        api.box(cx, cz, 0.6, 0.6, 3.0, { color: CONC, y: 0.2, pen: 8 });           // ground-floor columns
        // above L1: full columns under L2 (west half), rebar stubs east
        api.box(cx, cz, 0.6, 0.6, cx < 0 ? 2.9 : 3.8, { color: CONC, y: L1, pen: 8 });
      }
      api.box(0, 0, 16.6, 12.6, 0.3, { color: SLAB, y: 3.2, pen: 10 });           // level 1
      api.box(-3, 0, 10.6, 12.6, 0.3, { color: SLAB, y: 6.4, pen: 10 });          // level 2 (west half)
      // ground-floor block walls, half built
      api.box(-5.5, -2.2, 5, 0.3, 2.4, { color: BLOCK, y: 0.2, pen: 4 });
      api.box(3.5, -3.5, 0.3, 5, 2.4, { color: BLOCK, y: 0.2, pen: 4 });
      api.box(-3.5, 4, 0.3, 4, 2.4, { color: BLOCK, y: 0.2, pen: 4 });
      // flight A: ground -> level 1, lands on the south edge
      api.stairs(0, 6.3 + 11 * 0.64, 3, 11, 0.318, 0.64, "-z", { color: CONC });
      // flight B: level 1 -> level 2, on the level 1 deck, lands on L2's east edge
      api.stairs(7.8, -4, 2.5, 10, 0.32, 0.55, "-x", { color: CONC, y: L1 });
      // level 1 edges: block parapet north + west, rails east + south (gap for flight A)
      api.box(0, -6.15, 16.6, 0.3, 1.0, { color: BLOCK, y: L1, pen: 4 });
      api.box(-8.15, 0, 0.3, 12.6, 1.0, { color: BLOCK, y: L1, pen: 4 });
      api.box(8.25, 0, 0.1, 12.6, 1.0, { color: RAIL, y: L1, pen: 0.3 });
      api.box(-4.9, 6.25, 6.8, 0.1, 1.0, { color: RAIL, y: L1, pen: 0.3 });
      api.box(4.9, 6.25, 6.8, 0.1, 1.0, { color: RAIL, y: L1, pen: 0.3 });
      // level 2 edges: low parapet north + west, rails south + east (gap for flight B)
      api.box(-3, -6.15, 10.6, 0.3, 0.6, { color: BLOCK, y: L2, pen: 4 });
      api.box(-8.15, 0, 0.3, 12.6, 0.6, { color: BLOCK, y: L2, pen: 4 });
      api.box(-3, 6.25, 10.6, 0.1, 1.0, { color: RAIL, y: L2, pen: 0.3 });
      api.box(2.25, -5.8, 0.1, 1.0, 1.0, { color: RAIL, y: L2, pen: 0.3 });
      api.box(2.25, 1.75, 0.1, 9.1, 1.0, { color: RAIL, y: L2, pen: 0.3 });

      /* ---- east: container yard */
      shippingContainer(api, { x: 18, z: -15, rot: 0 });
      shippingContainer(api, { x: 18, z: -15, rot: 0, y: 2.6 });
      shippingContainer(api, { x: 26, z: -9, rot: 0 });
      shippingContainer(api, { x: 17, z: -3, rot: Math.PI / 2 });
      shippingContainer(api, { x: 26, z: 9, rot: 0 });
      shippingContainer(api, { x: 26, z: 9, rot: 0, y: 2.6 });
      shippingContainer(api, { x: 17, z: 12, rot: Math.PI / 2 });
      // walk-through container: open both ends
      api.walls(24.5, 1, 6, 2.5, 2.5, 0.12, { color: 0x3a6a7a, gaps: { w: 2.26, e: 2.26 }, pen: 3 });
      api.box(24.5, 1, 6, 2.5, 0.12, { color: 0x3a6a7a, y: 2.5, pen: 3 });
      // steps up onto the single container at (26,-9)
      api.stairs(28, -7.75 + 8 * 0.6, 2, 8, 0.325, 0.6, "-z", { color: RAIL });
      api.box(19.5, 19, 1.4, 2.6, 2.2, { color: 0xd8a03a, pen: 4 });               // forklift
      for (const [x, z] of [[29, 15], [13.5, -8], [30, -18]]) api.box(x, z, 1.2, 1.2, 1.0, { color: 0xa0523a, pen: 2 }); // brick pallets

      /* ---- west: raised foundation slab with formwork */
      api.box(-23, 0, 14, 24, 1.2, { color: SLAB, pen: 10 });
      for (const z of [-8, 8]) api.stairs(-16 + 4 * 0.6, z, 3, 4, 0.3, 0.6, "-x", { color: CONC });
      api.stairs(-27, -12 - 4 * 0.6, 3, 4, 0.3, 0.6, "+z", { color: CONC });
      api.box(-26, -4, 0.3, 6, 1.4, { color: 0x8a6a44, y: 1.2, pen: 1.5 });          // formwork
      api.box(-20, 4, 6, 0.3, 1.4, { color: 0x8a6a44, y: 1.2, pen: 1.5 });
      api.box(-27, 7, 1.2, 1.2, 2.2, { color: 0x6a4a3a, y: 1.2, pen: 0.4 });         // rebar cage
      api.box(-19, -9, 1.6, 1.6, 1.8, { color: 0xc8b048, y: 1.2, pen: 3 });          // cement mixer

      /* ---- north: site office, toilets, crane base */
      api.walls(-4, -22, 8, 3.2, 2.6, 0.15, { color: 0xd8d0b0, gaps: { s: 1.4 }, pen: 3 });
      api.box(-4, -22, 8.2, 3.4, 0.2, { color: 0xc8c0a0, y: 2.6, pen: 3 });
      for (const x of [5, 6.4]) api.box(x, -26, 1.2, 1.2, 2.3, { color: 0x3a7ad8, pen: 2 });
      api.box(-28, -28, 3, 3, 1.5, { color: CONC, pen: 10 });                          // crane counterweight base
      const crane = new THREE.Mesh(new THREE.BoxGeometry(1, 26, 1), api.mat(0xd8a03a, 0.6, 0.4));
      crane.position.set(-28, 14.5, -28);
      api.prop(crane);
      const jib = new THREE.Mesh(new THREE.BoxGeometry(30, 0.8, 0.8), api.mat(0xd8a03a, 0.6, 0.4));
      jib.position.set(-14, 26.5, -28);
      api.prop(jib);

      /* ---- corner scaffolds (as fixed on the live map) */
      for (const [x, z] of [[-24, -24], [24, -24], [-24, 24], [24, 24]]) {
        api.box(x, z, 5, 5, 0.35, { color: 0x6a6a60, pen: 6 });
        api.box(x, z, 5, 5, 0.35, { color: 0x6a6a60, y: 3.2, pen: 6 });
        for (const [px, pz] of [[-2.3, -2.3], [2.3, -2.3], [-2.3, 2.3], [2.3, 2.3]]) {
          api.cylinder(x + px, z + pz, 0.14, 2.85, { color: 0x555b48, y: 0.35, pen: 3 });
        }
        const inward = z > 0 ? -1 : 1;
        const edge = z + inward * 2.5;
        api.stairs(x, edge + inward * 11 * 0.62, 3.5, 11, 0.323, 0.62, inward > 0 ? "-z" : "+z", { color: 0x555b48 });
      }

      /* ---- south + loose cover */
      api.box(8, 22, 4, 2, 1.6, { color: 0x8a5a2a, pen: 4 });                       // skip
      for (const [x, z, w, d, h] of [[8, -18, 3, 3, 1.4], [-9, 18, 4, 2.5, 1.5], [12, 6, 3, 3, 1.6]]) {
        api.box(x, z, w, d, h, { color: 0x5c6b4a });
      }
      for (const [x, z] of [[-30, -30], [30, -30], [-30, 30], [30, 30]]) api.floodlight(x, z);
    },
    spawns: [[-30, -30], [30, -30], [-30, 30], [30, 30], [0, -31], [0, 31], [-31, 0], [31, 0]],
  },
};

// Zombies-only, so it's registered for buildMap but kept out of the PvP picker.
MAPS.pentagrin = PENTAGRIN;

// Neither the zombies map nor the range is a place you pick to fight in.
export const MAP_IDS = Object.keys(MAPS).filter((id) => id !== "pentagrin" && id !== "range" && !id.endsWith("_wip"));

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
