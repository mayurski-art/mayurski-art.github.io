// Troll Ops — generic battlefield cover objects for the PvP maps.
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
import { retexture } from "./surface-textures.js";

const MODEL_BASE = new URL("./models/", import.meta.url).href;
const loader = new GLTFLoader();
const cache = new Map();

/* Blender material name -> [surface, repeat] (models/build_props.blender.py's
   make_material calls). Rims/bands/trim/mesh/sandbag cloth are left flat —
   thin metal edges and fabric don't have a matching texture set here and
   read worse tiled than solid. */
const PROP_RETEXTURE = {
  CrateWood: ["wood", 1.5],
  BarrelBody: ["metal", 1],
  BarricadeFrame: ["metal", 1],
  ContainerBody: ["metal", 3],
  ContainerRib: ["metal", 1],
  ContainerDoor: ["metal", 1.5],
};

/* Fetches (once) and returns a clone of the named model's root object.
   Callers get their own independent Object3D, safe to position/rotate.

   Exported because the scorestreak entities (care package, drone, gunship)
   need the same cache-and-clone loader without the static map-placement
   helpers below — they position themselves at runtime instead. */
export function loadModel(name) {
  if (!cache.has(name)) {
    cache.set(name, loader.loadAsync(`${MODEL_BASE}${name}.glb`).then((gltf) => {
      const scene = gltf.scene;
      scene.traverse((n) => { if (n.isMesh) n.castShadow = true; });
      return scene;
    }));
  }
  return cache.get(name).then((scene) => {
    const clone = scene.clone(true);
    clone.traverse((n) => {
      if (n.isMesh) {
        n.material = n.material.clone();
        n.castShadow = true;
      }
    });
    retexture(clone, PROP_RETEXTURE);
    return clone;
  });
}

/* Drops a loaded clone into the scene once it resolves. Placement happens
   the instant the promise settles, so the collider (added synchronously,
   below) is live well before the visible mesh streams in. */
function placeModel(api, name, { x, z, y = 0, rot = 0, scale = 1 }) {
  loadModel(name).then((obj) => {
    obj.position.set(x, y, z);
    obj.rotation.y = rot;
    if (scale !== 1) obj.scale.setScalar(scale);
    api.prop(obj);
  });
}

/* Stacked wooden crates. Footprint ~1.4x1.4, standing ~1.9 tall. */
export function crateStack(api, { x, z, y = 0, rot = 0, size = 1.4 }) {
  const s = size, h = s * 0.72 * 2;
  api.ghostBox(x, z, s, s, h, { y, pen: 2 });
  placeModel(api, "crate-stack", { x, z, y, rot, scale: size / 1.4 });
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

/* Shipping container — long-sightline cover. `rot=0` runs along x. */
export function shippingContainer(api, { x, z, rot = 0, y = 0, len = 6 }) {
  const w = 2.5, h = 2.6;
  const along = Math.abs(Math.sin(rot)) < 0.5 ? "x" : "z";
  const dx = along === "x" ? len : w;
  const dz = along === "x" ? w : len;
  api.ghostBox(x, z, dx, dz, h, { y, pen: 8 });
  placeModel(api, "shipping-container", { x, z, y, rot, scale: len / 6 });
  return h;
}
