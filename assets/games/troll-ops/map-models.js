// Troll Forces — modelled map props (every map rebuilt in Blender).
//
// Models come from models/build_<map>.blender.py (shared kit: map_kit.py):
// gs-* Grin Site, db-* Dust Bowl, dp-* The Depot, ug-* Undergrin, gl-* The Grinleria,
// tf-* Trollface Island. Their UVs
// are in metres, so the repeat values below are tiles per metre: 0.5 means
// one texture tile every 2 m, on every face, at every size.
//
// Colliders stay in maps.js, copied from each approved blockout, so a layout
// plays exactly as it was walk-tested. These helpers only draw.

import { placeModel } from "./battlefield-props.js";

/* Blender material name -> [surface, tiles per metre]. Must match TEXTURED
   in models/map_kit.py: anything else was merged into flat vertex-coloured
   paint at export. The "metal" set is never used here: with no environment
   map it renders near-black. */
export const RETEXTURE = {
  GS_Concrete: ["cast", 0.4],
  GS_Slab: ["cast", 0.3],
  GS_Block: ["concrete", 0.45],
  GS_Plank: ["wood", 1],
  GS_Timber: ["wood", 0.8],
  GS_Ply: ["wood", 0.6],
  GS_Brick: ["brick", 1.1],
  GS_Rubble: ["rock", 1.2],
  GS_Precast: ["cast", 0.3],
  GS_Plaster: ["plaster", 0.4],
  GS_PlasterDark: ["plaster", 0.4],
  GS_PlasterLight: ["plaster", 0.4],
  GS_Rock: ["plaster", 0.6],
  GS_Stone: ["rock", 0.9],
  GS_Tile: ["tile", 1],
  GS_FloorConc: ["cast", 0.25],
  GS_Ballast: ["rock", 1.6],
  GS_Grass: ["grass", 0.25],
  GS_Pavement: ["cast", 0.5],
  // The Grinleria (gl-*): 2 m polished slabs, the store floors' boards
  GS_Marble: ["marble", 0.25],
  GS_MarbleUp: ["marble", 0.25],
  GS_WoodFloor: ["wood", 0.7],
  GS_Asphalt: ["asphalt", 0.25],
  // Grin Beach (gb-*): the shops' painted stucco, driftwood, the sandstone
  // bluffs, the boardwalk's boards
  GS_StuccoA: ["plaster", 0.45],
  GS_StuccoB: ["plaster", 0.45],
  GS_StuccoC: ["plaster", 0.45],
  GS_StuccoD: ["plaster", 0.45],
  GS_StuccoE: ["plaster", 0.45],
  GS_Driftwood: ["wood", 0.9],
  GS_Sandstone: ["rock", 0.35],
  GS_Deck: ["wood", 0.8],
  // Hollowgrin (hg-*): granite tombs, a red barn, the candy shop. A third
  // value is how far the paint is lifted toward white (default 0.55): the
  // barn red and the shop purple stay strong at 0.2-0.3. Painted boards use
  // the plaster photo: under paint the dark wood one read black at night.
  HG_Granite: ["rock", 0.8, 0.5],
  HG_GraniteDark: ["rock", 0.8, 0.35],
  HG_BarnRed: ["plaster", 0.9, 0.22],
  HG_BarnWood: ["wood", 0.9, 0.35],
  HG_Clapboard: ["plaster", 1.0, 0.3],
  HG_Brick: ["brick", 1.1, 0.45],
  HG_Floorboards: ["wood", 0.9, 0.3],
};

/* Drops models/<file>.glb at (x, y, z), turned `rot` radians about y.
   `scale` is a number or [sx, sy, sz] (a negative axis mirrors).
   `castShadow: false` suits maps under a roof: the sun can't reach inside,
   and casting still draws every mesh a second time in the shadow pass. */
export function mapModel(api, file, { x, z, y = 0, rot = 0, scale = 1, castShadow = true }) {
  placeModel(api, file, { x, z, y, rot, scale, castShadow, mapping: RETEXTURE });
}

/* Grin Site's models are gs-<name>. */
export const gsModel = (api, name, opts) => mapModel(api, `gs-${name}`, opts);
