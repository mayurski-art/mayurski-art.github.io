// Troll Forces — shared tileable PBR texture sets, one colour/normal/roughness
// (/ao/metal) set per surface family. Each image loads the first time
// anything asks for it and is shared from then on, so a map only downloads
// the sets it uses.

import * as THREE from "three";
import { useWorldEnv } from "../view/environment.js?v=sr1-ss1-ss2";
import { shrinkTexture } from "../view/texture-budget.js?v=pm1";

const TEX_LOADER = new THREE.TextureLoader();
const TEX_BASE = new URL("../textures/", import.meta.url);
function loadTex(name, srgb) {
  // (on a phone drawn down to 512 when it lands: view/texture-budget.js)
  const t = TEX_LOADER.load(new URL(name, TEX_BASE).href, shrinkTexture);
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
  grass: lazySet("grass"),
  marble: lazySet("marble"),
  // Poly Haven (CC0), 1k: dry_ground_01 (colour lifted to the sand set's
  // brightness) and weathered_brown_planks (colour made grey so a material's
  // paint tints it, as the code-drawn boards were)
  dryground: lazySet("dryground", ["ao"]),
  wplanks: lazySet("wplanks", ["ao"]),
  // Poly Haven (CC0), 1k, for Kabukigrin (user, 2026-10-23: "like how we
  // made the changes in troll city"; set B of two tried): clean_asphalt,
  // interlocking_concrete_pavers, grey_plaster_02, terrazzo_tiles. The
  // fronts' and floors' colour made grey so the paint under them still
  // decides the colour.
  kbasph: lazySet("kbasph", ["ao"]),
  kbpave: lazySet("kbpave", ["ao"]),
  kbfront: lazySet("kbfront", ["ao"]),
  kbfloor: lazySet("kbfloor", ["ao"]),
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
function buildSurfaceMaterial(surface, color, repeat = 1, bakedLightMap = null, mix = 0.55) {
  const s = SURFACES[surface];
  if (!s) return null;
  const tint = new THREE.Color(color).lerp(new THREE.Color(0xffffff), mix);
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
  // metal is mostly what it reflects: the map's sky (it read black with none)
  if (surface === "metal") useWorldEnv(m);
  for (const map of [m.map, m.normalMap, m.roughnessMap, m.aoMap, m.metalnessMap]) {
    if (!map) continue;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(repeat, repeat);
    map.needsUpdate = true;
  }
  return m;
}

/* Wires up a baked lightmap on one mesh, if its geometry has the second UV
   channel a bake needs. GLTFLoader puts a glTF mesh's TEXCOORD_1 on
   geometry.attributes.uv1, and three r160 picks a map's UV set by
   texture.channel (0 = the metre UVs every surface texture tiles on), so the
   bake reads channel 1. glTF UVs start top-left: flipY off.
   No-op (false) for a model without that channel. `bake` is the
   "<name>-bake.webp" beside the model's .glb (battlefield-props.js BAKED).
   The bakes are light only (models/bake_kit.py: sky, bounce and lamps, no
   colour), and three ADDS a light map to the indirect light, so a baked map
   turns its hemisphere and ambient down instead (REALISM.md). */
export function applyBakedLightMap(mesh, bake, intensity = 1) {
  const geo = mesh.geometry;
  if (!bake || !geo || !geo.attributes.uv1) return false;
  bake.colorSpace = THREE.SRGBColorSpace;
  bake.channel = 1;
  bake.flipY = false;
  mesh.material.lightMap = bake;
  mesh.material.lightMapIntensity = intensity;
  mesh.material.needsUpdate = true;
  return true;
}

/* A map's ground light map (models/bake_kit.py bake_ground): the light on
   its ground seen from above over rect [x0, z0, size], put on a flat mesh
   by its world x/z, so the mesh needs no light-map UVs of its own. Call it
   once the mesh is placed in the scene. */
export function applyGroundLightMap(mesh, bake, [x0, z0, size], intensity = 1) {
  let geo = mesh.geometry;
  const pos = geo?.attributes.position;
  if (!bake || !pos) return false;
  // a loaded model's copies share its geometry: these UVs are this copy's own
  if (geo.userData.shared) {
    geo = mesh.geometry = geo.clone();
    geo.userData = {};
  }
  mesh.updateWorldMatrix(true, false);
  const v = new THREE.Vector3(), uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    uv[2 * i] = (v.x - x0) / size;
    uv[2 * i + 1] = (v.z - z0) / size;
  }
  geo.setAttribute("uv1", new THREE.BufferAttribute(uv, 2));
  return applyBakedLightMap(mesh, bake, intensity);
}

/* The ground bake's light round one spot, as a 1x1 light map: the average
   over the square [x - r, x + r] x [z - r, z + r]. For a prop standing on
   the ground (a crate stack), which the top-down projection above would
   paint with its own shadow. Put it on with applyLightAt. */
let sampler = null;
export function groundLightAt(bake, [x0, z0, size], [x, z, r]) {
  const img = bake?.image;
  if (!img?.width) return null;
  const k = img.width / size;
  const sx = Math.max(0, Math.floor((x - r - x0) * k)), sy = Math.max(0, Math.floor((z - r - z0) * k));
  const w = Math.max(1, Math.min(img.width - sx, Math.ceil(2 * r * k))), h = Math.max(1, Math.min(img.height - sy, Math.ceil(2 * r * k)));
  sampler = sampler || document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  sampler.canvas.width = w; sampler.canvas.height = h;
  sampler.drawImage(img, sx, sy, w, h, 0, 0, w, h);   // flipY off: row 0 is z0
  const px = sampler.getImageData(0, 0, w, h).data, sum = [0, 0, 0];
  for (let i = 0; i < px.length; i += 4) for (let c = 0; c < 3; c++) sum[c] += px[i + c];
  const n = px.length / 4;
  const tex = new THREE.DataTexture(new Uint8Array([sum[0] / n, sum[1] / n, sum[2] / n, 255]), 1, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
export function applyLightAt(mesh, tex, intensity = 1) {
  if (!tex || !mesh.material) return false;
  mesh.material.lightMap = tex;   // one texel: any UV channel reads it
  mesh.material.lightMapIntensity = intensity;
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
    const [surface, repeat, mix] = rule;
    const color = n.material.color ? n.material.color.getHex() : 0xffffff;
    const textured = buildSurfaceMaterial(surface, color, repeat, n.material.lightMap || null, mix);
    if (!textured) return;
    textured.lightMapIntensity = n.material.lightMapIntensity;
    // a vertex-painted material (Grinjuku's GS_Paint) keeps its paint
    textured.vertexColors = !!n.material.vertexColors;
    n.material = textured;
  });
}
