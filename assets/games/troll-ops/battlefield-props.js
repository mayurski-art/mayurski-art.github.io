// Troll Forces — generic battlefield cover objects for the PvP maps.
//
// These five are map-agnostic: any PvP map can drop them in for detailed
// cover instead of a plain api.box() crate. Geometry is authored in Blender
// (see assets/games/troll-ops/models/README.md) and exported to .glb —
// loaded here through Three's GLTFLoader, cached per-model, and cloned for
// every placement so the file is only fetched and parsed once per map.
//
// Each helper takes the map builder `api`. The model supplies the look;
// api.ghostBox supplies the real collider, sized to match the model's
// footprint, since GLTFLoader meshes carry no collision data of their own
// and the model itself is dropped in as a decorative api.prop once it loads.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { retexture, applyBakedLightMap, applyGroundLightMap, groundLightAt, applyLightAt } from "./surface-textures.js?v=hg6e";

const MODEL_BASE = new URL("./models/", import.meta.url).href;
const loader = new GLTFLoader();
const cache = new Map();
const bakeCache = new Map();

/* Baked light maps (stylised realism, REALISM.md): models/<name>-bake.webp,
   made by the model's Blender builder (models/bake_kit.py), for the models
   listed here with their light-map strength. Only those are asked for: a
   request per model was a 404 each on every map load. A strength of PI
   matches Blender: three divides a light map's light by PI as it does every
   light's, the Cycles light-only bake doesn't. */
const BAKED = new Map([...[
  // Cul-de-Grin's houses (build_cg_houses.blender.py) and the furniture
  // in them (build_culdegrin.blender.py)
  ...["terracotta", "sage", "violet"].flatMap((v) => [`house-${v}`, `house-${v}-attic`]),
  "cg-lounge", "cg-kitchen",
  // Grin Site (build_grinsite.blender.py)
  ...["perimeter", "hoarding", "tower", "foundation", "scaffold", "cabin", "toilet", "crane", "forklift", "mixer",
    "brick-pallet", "rebar-cage", "formwork", "jersey", "skip", "van", "block-stack", "timber-stack", "pipe-stack",
    "container-stair", "light-tower", "container-open", "container-red", "container-blue", "container-green",
    "container-grey"].map((n) => `gs-${n}`),
  // Dust Bowl (build_dustbowl.blender.py)
  ...["walls", "north", "centre", "market", "south"].map((n) => `db-${n}`),
  // Grin Beach (build_grinbeach.blender.py)
  ...["pier", "foodtruck", "shops", "towers", "beach", "bluffs", "boardwalk"].map((n) => `gb-${n}`),
  // Grinjuku (build_grinjuku.blender.py; gj-neon is the light, not baked)
  "gj-shell", "gj-props", "gj-skyline",
  // the Depot (build_depot.blender.py)
  ...["shell", "racks", "catwalk", "office", "bay"].map((n) => `dp-${n}`),
].map((n) => [n, Math.PI]),
  // the Grinleria (build_grinleria.blender.py): its 15 lamps in a closed
  // white mall bake hot, so a quarter down
  ...["shell", "outside", "atrium", "falls", "wings", "trollhead", "shops"].map((n) => [`gl-${n}`, Math.PI * 0.75]),
]);
/* models/<name>-bake.webp, fetched once (null if it's missing). */
export function loadBake(name) {
  if (!bakeCache.has(name)) {
    bakeCache.set(name, new Promise((resolve) => {
      new THREE.TextureLoader().load(
        `${MODEL_BASE}${name}-bake.webp`,
        (tex) => resolve(tex),
        undefined,
        () => resolve(null),
      );
    }));
  }
  return bakeCache.get(name);
}
const loadBakeTexture = (name) => (BAKED.has(name) ? loadBake(name) : Promise.resolve(null));

/* Lights a placed flat mesh (or every mesh under an object) with a map's
   ground bake: groundBake = { file, rect } (maps.js), strength as BAKED's.
   at = [x, z, r] lights it all with the ground's average light round that
   spot instead (a prop standing on the ground; its materials must be its
   own, as an unbaked loadModel copy's are). intensity defaults to BAKED's. */
export function groundLight(obj, groundBake, at = null, intensity = Math.PI) {
  if (!groundBake) return;
  loadBake(groundBake.file).then((tex) => {
    const spot = at && groundLightAt(tex, groundBake.rect, at);
    obj.traverse((n) => {
      if (!n.isMesh) return;
      if (at) applyLightAt(n, spot, intensity);
      else applyGroundLightMap(n, tex, groundBake.rect, intensity);
    });
  });
}

/* Blender material name -> [surface, repeat] (models/build_props.blender.py's
   make_material calls). Rims/bands/trim/mesh/sandbag cloth are left flat —
   thin metal edges and fabric don't have a matching texture set here and
   read worse tiled than solid. Barrels and barricade frames keep their flat
   Blender paint (the "metal" set, which reflects the sky, is unused here). */
const PROP_RETEXTURE = {
  CrateWood: ["wood", 1.5],
};

/* Fetches (once) and returns a clone of the named model's root object.
   Callers get their own independent Object3D, safe to position/rotate.

   Exported because the scorestreak entities (care package, drone, gunship)
   need the same cache-and-clone loader without the static map-placement
   helpers below — they position themselves at runtime instead.

   `mapping` is the material-name -> [surface, repeat] table handed to
   retexture(); map-specific model sets (map-models.js) pass their own. */
export function loadModel(name, mapping = PROP_RETEXTURE) {
  if (!cache.has(name)) {
    cache.set(name, Promise.all([loader.loadAsync(`${MODEL_BASE}${name}.glb`), loadBakeTexture(name)]).then(([gltf, bake]) => {
      const scene = gltf.scene;
      scene.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.geometry.userData.shared = true; } });
      // A baked model is light-mapped and retextured once, here, and every
      // placement shares its materials (16 houses were ~300 materials).
      // Baked models are Cul-de-Grin's only: no other map patches them.
      if (bake) {
        scene.traverse((n) => { if (n.isMesh) { n.receiveShadow = true; applyBakedLightMap(n, bake, BAKED.get(name)); } });
        retexture(scene, mapping);
        scene.traverse((n) => { if (n.isMesh) n.material.userData.shared = true; });
        scene.userData.baked = true;
      }
      return scene;
    }));
  }
  return cache.get(name).then((scene) => {
    const clone = scene.clone(true);
    // which model this is: tools/troll-ops-map-placements.mjs reads it off
    // the built map for the ground bakes
    clone.userData.model = name;
    if (scene.userData.baked) return clone;
    clone.traverse((n) => {
      if (n.isMesh) {
        n.material = n.material.clone();
        n.castShadow = true;
        n.receiveShadow = true;
      }
    });
    retexture(clone, mapping);
    return clone;
  });
}

/* Drops a loaded clone into the scene once it resolves. Placement happens
   the instant the promise settles, so the collider (added synchronously,
   below) is live well before the visible mesh streams in. */
export function placeModel(api, name, { x, z, y = 0, rot = 0, scale = 1, mapping, castShadow = true, groundBake = null, groundAt = null }) {
  loadModel(name, mapping).then((obj) => {
    obj.position.set(x, y, z);
    obj.rotation.y = rot;
    if (Array.isArray(scale)) obj.scale.set(...scale);
    else if (scale !== 1) obj.scale.setScalar(scale);
    api.prop(obj);
    if (!castShadow) obj.traverse((n) => { n.castShadow = false; });
    groundLight(obj, groundBake, groundAt);
  });
}

/* Stacked wooden crates. Footprint ~1.4x1.4, standing ~1.9 tall. */
export function crateStack(api, { x, z, y = 0, rot = 0, size = 1.4, groundBake = null }) {
  const s = size, h = s * 0.72 * 2;
  api.ghostBox(x, z, s, s, h, { y, pen: 2 });
  // on a baked floor: lit by the floor's light round it (the lamps it lost)
  placeModel(api, "crate-stack", { x, z, y, rot, scale: size / 1.4, groundBake, groundAt: [x, z, s / 2 + 0.8] });
  return h;
}

/* Steel drum barrel. Radius 0.55, height 1.15. */
export function barrel(api, { x, z, y = 0, r = 0.55, h = 1.15 }) {
  api.ghostBox(x, z, r * 1.7, r * 1.7, h, { y, pen: 3 });
  placeModel(api, "barrel", { x, z, y, scale: r / 0.55 });
  return h;
}

/* Sandbag wall, ~4m long by default, chest-high. `rot` in radians. */
export function sandbagWall(api, { x, z, w = 4, rot = 0, y = 0, h = 1.0 }) {
  const along = Math.abs(Math.sin(rot)) < 0.5 ? "x" : "z";
  api.ghostBox(x, z, along === "x" ? w : 0.9, along === "z" ? w : 0.9, h, { y, pen: 3 });
  placeModel(api, "sandbag-wall", { x, z, y, rot, scale: w / 4 });
  return h;
}

/* Chain-link barricade: blocks movement and bullets on the frame, but the
   mesh panel is visually see-through. */
export function chainBarricade(api, { x, z, w = 2.4, h = 1.8, rot = 0, y = 0 }) {
  const along = Math.abs(Math.sin(rot)) < 0.5 ? "x" : "z";
  const d = along === "x" ? 0.14 : w;
  const ww = along === "x" ? w : 0.14;
  api.ghostBox(x, z, ww, d, h, { y, pen: 0.6 });
  placeModel(api, "chain-barricade", { x, z, y, rot, scale: w / 2.4 });
  return h;
}

const CONTAINER_PAINTS = ["red", "blue", "green", "grey"];

/* Shipping container — long-sightline cover. `rot=0` runs along x. */
export function shippingContainer(api, { x, z, rot = 0, y = 0, len = 6 }) {
  const w = 2.5, h = 2.6;
  const along = Math.abs(Math.sin(rot)) < 0.5 ? "x" : "z";
  const dx = along === "x" ? len : w;
  const dz = along === "x" ? w : len;
  api.ghostBox(x, z, dx, dz, h, { y, pen: 8 });
  // Grin Site's painted containers (same 6 x 2.5 x 2.6 box). The old
  // shipping-container.glb was retextured with the metal set, which renders
  // near-black with no environment map. Colour follows the spot, so a map
  // looks the same every load.
  const paint = CONTAINER_PAINTS[Math.abs(Math.round(x * 7 + z * 13)) % CONTAINER_PAINTS.length];
  placeModel(api, `gs-container-${paint}`, { x, z, y, rot, scale: [len / 6, 1, 1] });
  return h;
}
