// Troll Forces — "Grinjuku": Shinjuku at night, after VALORANT's Split.
// Three lanes, two sites, a Heaven over each and ropes up to them.
//
// The shape lives in grinjuku-layout.js (shared with the Blender build);
// this file turns it into colliders, stairs and ropes, and holds the map's
// sky and lighting. Everything you see is models/build_grinjuku.blender.py.

import * as THREE from "three";
import { GJ, grinjukuLayout } from "./grinjuku-layout.js?v=gj1";
import { mapModel } from "./map-models.js?v=hg6e";

const LAYOUT = grinjukuLayout();

function buildGrinjuku(api) {
  const { solids, stairs, ropes, lights } = LAYOUT;
  for (const s of solids) api.ghostBox(s.x, s.z, s.w, s.d, s.h, { y: s.y, pen: s.pen });
  for (const st of stairs) {
    api.stairs(st.x, st.z, st.width, st.steps, st.rise, st.run, st.dir, { ghost: true });
  }
  for (const r of ropes) api.rope(r.x, r.z, r.y0, r.y1, { dir: r.dir, ghost: true });

  // the models: what glows and the far city cast no shadows
  mapModel(api, "gj-shell", { x: 0, z: 0 });
  mapModel(api, "gj-props", { x: 0, z: 0 });
  mapModel(api, "gj-neon", { x: 0, z: 0, castShadow: false });
  mapModel(api, "gj-skyline", { x: 0, z: 0, castShadow: false });

  // 12 point lights, all made here (never at runtime): the neon carries the
  // rest through bloom
  const root = new THREE.Group();
  api.prop(root);
  for (const L of lights) {
    const light = new THREE.PointLight(L.color, L.intensity, L.distance, 2);
    light.position.set(L.x, L.y, L.z);
    light.castShadow = false;
    root.add(light);
  }
}

const SOOT = 0x0e0e12;

export const GRINJUKU = {
  name: "Grinjuku",
  blurb: "Neon alleys, vending machines and two sites a rope apart.",
  bounds: { ...GJ.bounds },
  playerSpawn: { x: 0, z: -37.5 },
  // Shinjuku after dark: a violet sky lit magenta off the city, a dim moon.
  sky: { top: 0x070612, horizon: 0x3a1a4a, bottom: 0x0c0814, haze: 0.4, clouds: 0.25, cloudColor: 0x3a2a4a, cloudShade: 0x0a0812 },
  fog: { color: 0x1a1024, density: 0.009 },
  exposure: 1.3,
  bloom: { threshold: 0.8, strength: 0.75, radius: 0.55 },
  ground: { colorA: 0x2a2a30, colorB: 0x26262c, grid: 0x3a3a44, surface: "asphalt", tile: 4 },
  sun: { color: 0x8a98ff, intensity: 0.6, pos: [-30, 60, 40] },
  hemi: { sky: 0x6a5aa8, ground: 0x2a1a2a, intensity: 2.2 },
  ambient: { color: 0x4a3a6a, intensity: 0.35 },
  viewFar: 420,
  build: buildGrinjuku,
  // Rain-slick asphalt: puddles to catch the neon, oil, tyre marks; flyers
  // and cans in the gutters (map-dressing.js keeps it all off the colliders).
  dress: {
    seed: 2049,
    areas: {
      aMain: [-31.4, -31.6, -23.3, 3.6], bMain: [23.3, -31.6, 31.4, 3.6], midTop: [-6.6, -31.6, 6.6, -8.4],
      aSite: [-31.4, 4.4, -14.4, 23.6], bSite: [14.4, 4.4, 31.4, 23.6], midBot: [-5.6, 4.4, 5.6, 23.6],
      backs: [-31.4, 24.4, 31.4, 41.4], station: [-31.4, -41.4, 31.4, -32.4],
    },
    decals: [
      { cell: "puddle", n: 26, area: ["aMain", "bMain", "midTop", "backs", "station"], size: [1.0, 2.6], color: 0x0c0e14, alpha: 0.6 },
      { cell: "puddle", n: 10, area: ["aSite", "bSite", "midBot"], size: [0.8, 1.8], color: 0x0c0e14, alpha: 0.5 },
      { cell: "oil", n: 14, area: ["aMain", "bMain", "backs", "station"], size: [0.8, 1.8], color: SOOT, alpha: 0.55 },
      { cell: "tyre", n: 10, area: ["aMain", "bMain", "backs"], size: [1.4, 1.8], stretch: 3, rot: 0.05, color: 0x0a0a0c, alpha: 0.35 },
      { cell: "crack", n: 18, size: [1.2, 2.5], color: 0x1a1a1e, alpha: 0.6 },
    ],
    clutter: [
      { kind: "can", n: 16, size: [1, 1], colors: [0xd8302a, 0x2a6ad8, 0xe8e8e8, 0xf2c232] },
      { kind: "ticket", n: 26, size: [0.8, 1.2], colors: [0xff7ad0, 0xf2efe6, 0x7ad8ff, 0xf2c232] },
      { kind: "paper", n: 12, size: [0.8, 1.2], colors: [0xf2efe6, 0xe8e0c8] },
      { kind: "bottle", n: 8, area: ["aMain", "bMain", "backs"], size: [1, 1], colors: [0x5a7a3a, 0x7a4a2a, 0xc8b890] },
    ],
  },
  // S&D plants here instead of at pickBombSites' guess (modes/match-start.js)
  bombSites: LAYOUT.sites,
  spawns: LAYOUT.spawns,
  debug: () => ({ ropes: LAYOUT.ropes.map((r) => ({ ...r })), sites: LAYOUT.sites.map((s) => ({ ...s })) }),
};
