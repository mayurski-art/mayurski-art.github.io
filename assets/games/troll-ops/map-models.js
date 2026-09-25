// Troll Ops — modelled map props (every map rebuilt in Blender).
//
// Models come from models/build_<map>.blender.py (shared kit: map_kit.py):
// gs-* Grin Site, db-* Dust Bowl, dp-* The Depot, ug-* Undergrin. Their UVs
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
};

/* Drops models/<file>.glb at (x, y, z), turned `rot` radians about y.
   `scale` is a number or [sx, sy, sz] (a negative axis mirrors). */
export function mapModel(api, file, { x, z, y = 0, rot = 0, scale = 1 }) {
  placeModel(api, file, { x, z, y, rot, scale, mapping: RETEXTURE });
}

/* Grin Site's models are gs-<name>. */
export const gsModel = (api, name, opts) => mapModel(api, `gs-${name}`, opts);
