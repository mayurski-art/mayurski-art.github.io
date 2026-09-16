// Troll Ops — suburban set-dressing for Cul-de-Grin (and any future
// house-based map). Portraits are drawn to a canvas texture rather than
// loaded from a file, so there's no new art-pipeline dependency and no
// risk of the mascot mark drifting into the banned emoji — the grin here
// is hand-drawn with canvas arcs, same as the rest of the procedural set.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { retexture, applyBakedLightMap } from "./surface-textures.js";

const portraitCache = new Map();
const MODEL_BASE = new URL("./models/", import.meta.url).href;
const houseLoader = new GLTFLoader();
const houseCache = new Map();
const bakeCache = new Map();

/* Optional per-model baked lightmap: models/<name>-bake.jpg, if a Blender
   bake pass has produced one. Missing file just means no bake yet (this
   loader has nothing to opt into until a Blender pass exports one — see
   applyBakedLightMap's comment for why it's an inert no-op until then),
   so a failed fetch resolves to null rather than throwing. */
function loadBakeTexture(name) {
  if (!bakeCache.has(name)) {
    bakeCache.set(name, new Promise((resolve) => {
      new THREE.TextureLoader().load(
        `${MODEL_BASE}${name}-bake.jpg`,
        (tex) => resolve(tex),
        undefined,
        () => resolve(null),
      );
    }));
  }
  return bakeCache.get(name);
}

/* Blender material name -> [surface, repeat]. concrete's texture set is a
   visible cinder-block pattern (color AND normal) — right for bunker walls
   elsewhere on the maps, wrong for a suburban house, so walls use wood's
   subtler plank grain as clapboard siding instead, at a wider tile than
   the roof so the two don't read as the same material up close. Chimney
   is small enough that brick's texture scale still tiles convincingly.
   Trim/Glass/Canvas are left flat — a photo texture on thin bright trim
   or the hand-painted portrait canvas reads worse than the plain color. */
const HOUSE_RETEXTURE = {
  Wall: ["wood", 5],
  Roof: ["wood", 10],
  Chimney: ["brick", 1],
};

/* Fetches (once) and returns a clone of the named house model — same
   cache-then-clone shape as battlefield-props.js's loadModel, kept as a
   separate cache since houses are much larger meshes than crates/barrels
   and there's no reason to share the map with unrelated props. */
function loadHouseModel(name) {
  if (!houseCache.has(name)) {
    houseCache.set(name, houseLoader.loadAsync(`${MODEL_BASE}${name}.glb`).then((gltf) => {
      const scene = gltf.scene;
      scene.traverse((n) => { if (n.isMesh) n.castShadow = true; });
      return scene;
    }));
  }
  return Promise.all([houseCache.get(name), loadBakeTexture(name)]).then(([scene, bake]) => {
    const clone = scene.clone(true);
    clone.traverse((n) => {
      if (n.isMesh) {
        n.material = n.material.clone();
        n.castShadow = true;
        n.receiveShadow = true;
        if (bake) applyBakedLightMap(n, bake);
      }
    });
    retexture(clone, HOUSE_RETEXTURE);
    return clone;
  });
}

/* Modelled house exterior (pitched roof, porch, windows, chimney) built by
   models/build_houses.blender.py. The model's own door gap always faces
   +X in model space; `door: "e"` places it as-is, `door: "w"` spins it
   180° so the gap faces -X instead. The wall/door COLLIDERS still come
   from api.walls() in maps.js exactly as before — this only swaps what
   the player sees for what used to be a flat-roofed procedural box, so
   the doorway-gap logic driving spawn/nav logic elsewhere is untouched. */
export function houseExterior(api, { x, z, door = "e", variant = "terracotta" }) {
  const rot = door === "e" ? 0 : Math.PI;
  loadHouseModel(`house-${variant}`).then((obj) => {
    obj.position.set(x, 0, z);
    obj.rotation.y = rot;
    api.prop(obj);
  });
}

/* Framed painting of a grinning face, done in a flat "bad thrift-store
   portrait" style. `hue` shifts the background/frame so each house's art
   reads as a distinct little joke rather than a copy-pasted decal. */
function portraitTexture(hue) {
  if (portraitCache.has(hue)) return portraitCache.get(hue);
  const c = document.createElement("canvas");
  c.width = 128; c.height = 160;
  const g = c.getContext("2d");

  // frame
  g.fillStyle = `hsl(${hue}, 35%, 22%)`;
  g.fillRect(0, 0, 128, 160);
  g.fillStyle = `hsl(${hue}, 55%, 78%)`;
  g.fillRect(10, 10, 108, 140);

  // face
  g.fillStyle = "#e8c99a";
  g.beginPath();
  g.ellipse(64, 88, 34, 40, 0, 0, Math.PI * 2);
  g.fill();

  // eyes
  g.fillStyle = "#1c1c1e";
  g.beginPath(); g.ellipse(50, 76, 5, 6, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(78, 76, 5, 6, 0, 0, Math.PI * 2); g.fill();

  // big cheeky grin
  g.strokeStyle = "#1c1c1e";
  g.lineWidth = 4;
  g.beginPath();
  g.arc(64, 92, 22, 0.15 * Math.PI, 0.85 * Math.PI);
  g.stroke();
  g.fillStyle = "#fff";
  g.beginPath();
  g.arc(64, 92, 20, 0.2 * Math.PI, 0.8 * Math.PI);
  g.fill();

  // nameplate
  g.fillStyle = `hsl(${hue}, 40%, 30%)`;
  g.fillRect(24, 138, 80, 10);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  portraitCache.set(hue, tex);
  return tex;
}

/* Framed wall portrait — a real modelled picture frame (beveled wooden
   border + recessed depth, models/build_houses.blender.py's
   build_portrait_frame) rather than a bare plane, with the same
   canvas-texture grin art dropped onto its "Canvas" child mesh. `facing`
   is the direction the wall faces (the room's interior), one of
   "n"|"s"|"e"|"w"; the frame is rotated to hang flat against it. */
export function portrait(api, { x, y, z, facing = "s", hue = 20 }) {
  const rot = { n: Math.PI, s: 0, e: -Math.PI / 2, w: Math.PI / 2 }[facing];
  loadHouseModel("portrait-frame").then((obj) => {
    obj.position.set(x, y, z);
    obj.rotation.y = rot;
    const canvas = obj.getObjectByName("Canvas");
    if (canvas) canvas.material = new THREE.MeshStandardMaterial({ map: portraitTexture(hue), roughness: 0.85 });
    api.prop(obj);
  });
}

/* Low picket fence, `w` long, gapless — soft yard boundary. Bullets punch
   through like the hedges elsewhere on the map; it's a sightline nudge,
   not real cover. */
export function picketFence(api, { x, z, w = 8, rot = 0, h = 0.9 }) {
  const along = Math.abs(Math.sin(rot)) < 0.5 ? "x" : "z";
  api.box(x, z, along === "x" ? w : 0.15, along === "z" ? w : 0.15, h,
    { color: 0xd8d0c0, pen: 0.4 });
  return h;
}

/* Mailbox on a post — small yard prop, no collider (too thin to matter). */
export function mailbox(api, { x, z, hue = 20 }) {
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), api.mat(0x5a5348, 0.8));
  post.position.set(x, 0.45, z);
  api.prop(post);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.2), api.mat(`hsl(${hue}, 40%, 45%)`, 0.6, 0.2));
  box.position.set(x, 0.95, z);
  api.prop(box);
}

/* Kiddie pool — a Nuketown-style centrepiece hazard: low, bright, and
   just tall enough to block grazing fire without stopping a grenade. */
export function kiddiePool(api, { x, z, r = 2.2 }) {
  api.cylinder(x, z, r, 0.5, { color: 0x3aa0c8, pen: 1.2 });
  const water = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r * 0.85, 0.02, 20),
    new THREE.MeshStandardMaterial({ color: 0x2a7ea8, roughness: 0.15, metalness: 0.4 }));
  water.position.set(x, 0.42, z);
  api.prop(water);
}

/* Yard clutter — small modelled props (models/build_houses.blender.py)
   that turn six empty lawns into six lived-in ones. All decorative
   (no collider) except trashCan, which is tall enough to actually block
   a low shot and gets a matching ghostBox. */
export function toyCar(api, { x, z, rot = 0 }) {
  loadHouseModel("toy-car").then((obj) => { obj.position.set(x, 0, z); obj.rotation.y = rot; api.prop(obj); });
}

export function gardenGnome(api, { x, z, rot = 0 }) {
  loadHouseModel("garden-gnome").then((obj) => { obj.position.set(x, 0, z); obj.rotation.y = rot; api.prop(obj); });
}

export function trashCan(api, { x, z }) {
  api.ghostBox(x, z, 0.6, 0.6, 0.84, { pen: 1 });
  loadHouseModel("trash-can").then((obj) => { obj.position.set(x, 0, z); api.prop(obj); });
}

/* Full A-frame swing set (models/build_houses.blender.py's build_tire_swing) —
   stands on its own from the ground now, so this places it the same way as
   every other ground prop here instead of floating the whole model at the
   tire's hang height. */
export function tireSwing(api, { x, z, rot = 0 }) {
  loadHouseModel("tire-swing").then((obj) => { obj.position.set(x, 0, z); obj.rotation.y = rot; api.prop(obj); });
}

/* Real modelled streetlamp — pole, curved arm, lit head — replacing the
   bare bulb-on-nothing floodlight look on residential streets. Keeps the
   same warm PointLight the old lamp() used so illumination is unchanged,
   just paired with an actual fixture instead of a floating sphere. */
export function streetlamp(api, { x, z, rot = 0 }) {
  loadHouseModel("streetlamp").then((obj) => {
    obj.position.set(x, 0, z);
    obj.rotation.y = rot;
    api.prop(obj);
  });
  // the lit point sits near the pole top rather than precisely under the
  // model's lamp head — close enough for a soft-radius PointLight, and
  // avoids depending on which world axis the model's export mapped its
  // local +X arm onto
  api.lamp(x, 5.7, z, 0xffd9a0, 13, 20);
}
