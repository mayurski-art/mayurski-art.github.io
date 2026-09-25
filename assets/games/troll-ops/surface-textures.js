// Troll Ops — shared tileable PBR texture sets, one colour/normal/roughness
// (/ao/metal) set per surface family. Each image loads the first time
// anything asks for it and is shared from then on, so a map only downloads
// the sets it uses.

import * as THREE from "three";

const TEX_LOADER = new THREE.TextureLoader();
const TEX_BASE = new URL("./textures/", import.meta.url);
function loadTex(name, srgb) {
  const t = TEX_LOADER.load(new URL(name, TEX_BASE).href);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* A surface set whose textures load on first access. `extra` lists the
   optional maps it has ("ao", "metal"); the rest read as undefined. */
function lazySet(name, extra = []) {
  const cache = {};
  const set = {};
  for (const [key, srgb] of [["color", true], ["normal", false], ["rough", false], ...extra.map((k) => [k, false])]) {
    Object.defineProperty(set, key, {
      enumerable: true,
      get: () => (cache[key] ??= loadTex(`${name}_${key}.jpg`, srgb)),
    });
  }
  return set;
}

export const SURFACES = {
  // ambientCG (CC0). "concrete" is actually a split-face block wall.
  concrete: lazySet("concrete"),
  brick: lazySet("brick", ["ao"]),
  metal: lazySet("metal", ["metal"]),
  wood: lazySet("wood"),
  asphalt: lazySet("asphalt"),
  rock: lazySet("rock", ["ao"]),
  // baked in Blender from procedural noise (models/bake_surfaces.blender.py)
  dirt: lazySet("dirt"),
  cast: lazySet("cast"),
  sand: lazySet("sand"),
  plaster: lazySet("plaster"),
  tile: lazySet("tile"),
};

/* Builds one tinted, textured MeshStandardMaterial from a SURFACES entry,
   blending 55% toward white before multiplying in `color` — same ratio
   maps.js uses — so a dark flat-color value doesn't crush the photo
   texture down to near-black. `repeat` sets how many times the 1K texture
   tiles across the mesh's face; small props want a small repeat (a crate
   lid is not a wall) so this is per-material rather than derived from a
   box size like maps.js's `surf()` can do.

   `bakedLightMap` carries over a per-instance baked lightmap (see
   applyBakedLightMap below) from the material this one replaces — the
   procedural surface swap must not silently drop a real Blender AO/light
   bake in favor of the flat runtime aoMap tiling, since the two textures
   answer different questions (bake = this exact mesh's real occlusion,
   aoMap = generic tiled photo texture) and read fine layered together. */
function buildSurfaceMaterial(surface, color, repeat = 1, bakedLightMap = null) {
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
  if (bakedLightMap) opts.lightMap = bakedLightMap;
  const m = new THREE.MeshStandardMaterial(opts);
  for (const map of [m.map, m.normalMap, m.roughnessMap, m.aoMap, m.metalnessMap]) {
    if (!map) continue;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(repeat, repeat);
    map.needsUpdate = true;
  }
  return m;
}

/* Wires up a baked lightmap on one mesh, if its geometry actually has the
   second UV channel a bake needs. GLTFLoader puts a glTF mesh's second
   TEXCOORD set on geometry.attributes.uv1; three.js's lightMap sampler
   reads uv2 by default, so this copies uv1 -> uv2 rather than requiring
   every Blender export to duplicate the channel itself. No-ops (returns
   false) for any model without a baked second UV set — i.e. every model
   exported before a Blender lightmap-baking pass exists — so this is
   inert until that pass starts shipping real bakes; nothing to update
   here to bring the baking online, `bake` just has to be truthy and named
   right. `bake` is a THREE.Texture already loaded from e.g. a
   "<name>-bake.jpg" beside the model's .glb; caller decides whether one
   exists for this model. */
export function applyBakedLightMap(mesh, bake) {
  const geo = mesh.geometry;
  if (!bake || !geo || !geo.attributes.uv1) return false;
  if (!geo.attributes.uv2) geo.setAttribute("uv2", geo.attributes.uv1);
  bake.colorSpace = THREE.SRGBColorSpace;
  mesh.material.lightMap = bake;
  // The bake carries a full directional-diffuse + AO pass, but the game
  // already lights every mesh dynamically (sun + ambient + point lamps) —
  // at full strength the two multiply and crush indoor faces that get no
  // direct sun to near-black (confirmed in-game: house interiors read as
  // solid black at intensity 1). Dialed down so the bake reads as a subtle
  // AO/shadow tint on top of the real-time lighting instead of replacing it.
  mesh.material.lightMapIntensity = 0.3;
  mesh.material.needsUpdate = true;
  return true;
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
    const textured = buildSurfaceMaterial(surface, color, repeat, n.material.lightMap || null);
    if (textured) n.material = textured;
  });
}
