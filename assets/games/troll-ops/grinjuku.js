// Troll Forces — "Grinjuku": Shinjuku at night, after VALORANT's Split.
// Three lanes, two sites, a Heaven over each and ropes up to them.
//
// The shape lives in grinjuku-layout.js (shared with the Blender build);
// this file turns it into colliders, stairs and ropes, and holds the map's
// sky and lighting. Until the models land the solids draw as plain boxes.

import { GJ, grinjukuLayout } from "./grinjuku-layout.js?v=gj1";

const LAYOUT = grinjukuLayout();

/* Blockout colours by kind: buildings dark, cover warm, the Heavens'
   decks pale so the high ground reads at a glance. */
const COLOR = {
  block: 0x3a3848, _edge: 0x2e2c3a, sewer: 0x46424a, vent: 0x4a4e58, pier: 0x55525c,
  mailwall: 0xb8463a, _lintel: 0xb8463a, _mailroof: 0x8a3a32,
  terrace: 0x9a96a4, heavenwall: 0x6a6878, parapet: 0xc8c4d0, _rail: 0xc8c4d0,
  deck: 0x8a7a5a, stall: 0xd8783a, kiosk: 0x5a7a8a, vending: 0xe0e4ea, crates: 0x9a7a4a,
  bikes: 0x3a6a9a, truck: 0xe8e8e0, planter: 0x5a7a4a, torii: 0xd8342a, _torii: 0xd8342a,
  tank: 0x8a9aa8, acunit: 0xb0b4b8, konbini: 0x3a9a6a, koban: 0xe8e4d8, shelter: 0x6a7a8a,
  counter: 0x8a6a48, sorting: 0x6a5a48, parcels: 0xb08a5a,
};

function buildGrinjuku(api) {
  const { solids, stairs, ropes } = LAYOUT;
  for (const s of solids) {
    api.box(s.x, s.z, s.w, s.d, s.h, { y: s.y, pen: s.pen, color: COLOR[s.k] ?? 0x777777, rough: 0.85 });
  }
  for (const st of stairs) {
    api.stairs(st.x, st.z, st.width, st.steps, st.rise, st.run, st.dir, { color: 0x8a8692 });
  }
  if (api.rope) for (const r of ropes) api.rope(r.x, r.z, r.y0, r.y1, { dir: r.dir });
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
