// Troll Forces — "Grinjuku": Shinjuku at night, after VALORANT's Split.
// Three lanes, two sites, a Heaven over each and ropes up to them.
//
// The shape lives in grinjuku-layout.js (shared with the Blender build);
// this file turns it into colliders, stairs and ropes, and holds the map's
// sky and lighting. Everything you see is models/build_grinjuku.blender.py.

import { GJ, grinjukuLayout } from "./grinjuku-layout.js?v=gj1-or1";
import { mapModel } from "./map-models.js?v=hg6e-sr1-or1-tx1-sp1-kbt1-gb1-kbb2-kbs1-pm1-kbk2-tfp7-tfb8-ss1-ss2";

const LAYOUT = grinjukuLayout();

function buildGrinjuku(api) {
  const { solids, stairs, ropes } = LAYOUT;
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
  // The layout's 12 fill lights are baked into the models' light maps
  // (build_grinjuku.blender.py, lamps=40), not made here: 12 fewer lights in
  // every lit shader on the map.
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
  // The models' light maps carry half the sky now, and the neon's glow on
  // the walls and road (stylised realism, REALISM.md; build_grinjuku bakes
  // with gj-neon standing in the street).
  groundBake: { file: "grinjuku-ground", rect: [-56, -56, 112] },
  hemi: { sky: 0x6a5aa8, ground: 0x2a1a2a, intensity: 1.1 },
  ambient: { color: 0x4a3a6a, intensity: 0.22 },
  // neon night: indigo shade, a magenta lift in the highs, more punch
  grade: { shadows: 0x1a1440, shadowsAmt: 0.1, highlights: 0xff60c0, highlightsAmt: 0.06, sat: 1.12, contrast: 1.08 },
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
      { cell: "puddle", n: 26, area: ["aMain", "bMain", "midTop", "backs", "station"], size: [1.0, 2.6], color: 0x0c0e14, alpha: 0.75, shiny: true },
      { cell: "puddle", n: 10, area: ["aSite", "bSite", "midBot"], size: [0.8, 1.8], color: 0x0c0e14, alpha: 0.7, shiny: true },
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
