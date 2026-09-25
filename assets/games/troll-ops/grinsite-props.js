// Troll Ops — modelled props for Grin Site (the construction site).
//
// The models come from models/build_grinsite.blender.py (gs-*.glb). Their
// UVs are in metres, so the repeat values below are tiles per metre:
// 0.5 means one texture tile every 2 m, on every face, at every size.
//
// Colliders stay in maps.js, copied from the approved blockout, so the
// layout plays exactly as it was walk-tested. These helpers only draw.

import { placeModel } from "./battlefield-props.js";

/* Blender material name -> [surface, tiles per metre]. Painted metal,
   glass, signs and tyres stay flat: a photo texture on them reads as dirt,
   and the "metal" set renders near-black here (no environment map). */
export const GS_RETEXTURE = {
  GS_Concrete: ["cast", 0.4],
  GS_Slab: ["cast", 0.3],
  GS_Block: ["concrete", 0.45],
  GS_Plank: ["wood", 1],
  GS_Timber: ["wood", 0.8],
  GS_Ply: ["wood", 0.6],
  GS_Brick: ["brick", 1.1],
  GS_Rubble: ["rock", 1.2],
  GS_Precast: ["cast", 0.3],
};

/* Drops gs-<name>.glb at (x, y, z), turned `rot` radians about y. */
export function gsModel(api, name, { x, z, y = 0, rot = 0 }) {
  placeModel(api, `gs-${name}`, { x, z, y, rot, mapping: GS_RETEXTURE });
}
