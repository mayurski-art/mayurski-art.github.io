// Troll Forces — "Grinjuku": Shinjuku at night, after VALORANT's Split.
// Three lanes, two sites, a Heaven over each and ropes up to them.
//
// The shape lives in grinjuku-layout.js (shared with the Blender build);
// this file turns it into colliders, stairs and ropes, and holds the map's
// sky and lighting. Everything you see is models/build_grinjuku.blender.py.

import { GJ, grinjukuLayout } from "./grinjuku-layout.js?v=gj1";
import { mapModel } from "./map-models.js?v=hg6e";

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
}

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
  // S&D plants here instead of at pickBombSites' guess (modes/match-start.js)
  bombSites: LAYOUT.sites,
  spawns: LAYOUT.spawns,
  debug: () => ({ ropes: LAYOUT.ropes.map((r) => ({ ...r })), sites: LAYOUT.sites.map((s) => ({ ...s })) }),
};
