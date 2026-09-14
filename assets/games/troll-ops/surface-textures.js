// Troll Ops — shared CC0 tileable PBR texture sets (ambientCG), one
// diffuse/normal/roughness(/ao/metal) triplet per surface family. Loaded
// once at module scope so maps.js, house-props.js and battlefield-props.js
// all reuse the same decoded images instead of fetching them three times.

import * as THREE from "three";

const TEX_LOADER = new THREE.TextureLoader();
const TEX_BASE = new URL("./textures/", import.meta.url);
function loadTex(name, srgb) {
  const t = TEX_LOADER.load(new URL(name, TEX_BASE).href);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const SURFACES = {
  concrete: { color: loadTex("concrete_color.jpg", true), normal: loadTex("concrete_normal.jpg"), rough: loadTex("concrete_rough.jpg") },
  brick: { color: loadTex("brick_color.jpg", true), normal: loadTex("brick_normal.jpg"), rough: loadTex("brick_rough.jpg"), ao: loadTex("brick_ao.jpg") },
  metal: { color: loadTex("metal_color.jpg", true), normal: loadTex("metal_normal.jpg"), rough: loadTex("metal_rough.jpg"), metal: loadTex("metal_metal.jpg") },
  wood: { color: loadTex("wood_color.jpg", true), normal: loadTex("wood_normal.jpg"), rough: loadTex("wood_rough.jpg") },
  asphalt: { color: loadTex("asphalt_color.jpg", true), normal: loadTex("asphalt_normal.jpg"), rough: loadTex("asphalt_rough.jpg") },
  rock: { color: loadTex("rock_color.jpg", true), normal: loadTex("rock_normal.jpg"), rough: loadTex("rock_rough.jpg"), ao: loadTex("rock_ao.jpg") },
};

/* Builds one tinted, textured MeshStandardMaterial from a SURFACES entry,
   blending 55% toward white before multiplying in `color` — same ratio
   maps.js uses — so a dark flat-color value doesn't crush the photo
   texture down to near-black. `repeat` sets how many times the 1K texture
   tiles across the mesh's face; small props want a small repeat (a crate
   lid is not a wall) so this is per-material rather than derived from a
   box size like maps.js's `surf()` can do. */
function buildSurfaceMaterial(surface, color, repeat = 1) {
  const s = SURFACES[surface];
  if (!s) return null;
  const tint = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.55);
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
    map.repeat.set(repeat, repeat);
    map.needsUpdate = true;
  }
  return m;
}

/* Swaps flat-color materials on a loaded (already-cloned) GLTF object for
   textured ones, matched by the Blender-exported material name (e.g.
   "Wall", "CrateWood", "BarrelBody" — see models/build_*.blender.py's
   make_material calls). `mapping` is { materialName: [surface, repeat] }.
   Meshes whose material name isn't in `mapping` are left exactly as
   exported (glass, chrome trim, the hand-painted portrait canvas, etc.
   read better flat than tiled with a photo texture at this scale).
   Caches built materials per (name, surface, repeat) on `obj` isn't
   needed — each call already operates on a fresh per-placement clone, so
   there's one small material built per mesh per prop instance, which is
   cheap next to the model load itself. */
export function retexture(obj, mapping) {
  obj.traverse((n) => {
    if (!n.isMesh || !n.material) return;
    const rule = mapping[n.material.name];
    if (!rule) return;
    const [surface, repeat] = rule;
    const color = n.material.color ? n.material.color.getHex() : 0xffffff;
    const textured = buildSurfaceMaterial(surface, color, repeat);
    if (textured) n.material = textured;
  });
}
