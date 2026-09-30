// Troll Forces — tactical gloved hands for the first-person gun view.
//
// models/build_gloves.blender.py exports one skinned glove (bones Hand,
// F{i}_{k}, T0..T2) and a jacket sleeve. The glove shares hand-model.js's
// frame and joint layout (wrist +Z, fingers -Z, palm -Y, thumb -X on a right
// hand), so the same pose data drives it: each joint rotation, given in the
// hand frame the way poseHumanHand applies it, is carried into the bone's own
// rest frame here (bone = W⁻¹·R·W on top of its rest rotation).
//
// Three r160 ships no SkeletonUtils, so each hand parses its own copy of the
// .glb from one cached download (only two ever exist in the view model).

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HAND_POSES } from "./hand-model.js?v=to-grip2";

const URL_GLB = new URL("./models/gloves.glb?v=gl3", import.meta.url).href;
let bufferP = null;

export function loadGloveData() {
  if (!bufferP) bufferP = fetch(URL_GLB).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).catch(() => null);
  return bufferP;
}

/* Extra grip poses for guns (radians per joint, as HAND_POSES). */
export const GLOVE_POSES = {
  // Pistol grip: three fingers wrapped, index along the trigger.
  trigger: { curl: [[0.35, 0.75, 0.45], [1.3, 1.45, 0.85], [1.35, 1.5, 0.9], [1.3, 1.45, 0.9]], spread: 0.02, thumb: [0.35, 1.0, 0.45, 0.3] },
  // Under a handguard: fingers curled up round the far side.
  support: { curl: [[0.85, 0.9, 0.5], [0.9, 0.95, 0.5], [0.95, 1.0, 0.55], [1.0, 1.05, 0.6]], spread: 0.03, thumb: [0.6, 0.55, 0.3, 0.2] },
  // Round a vertical foregrip: a fist.
  foregrip: { curl: [[1.35, 1.45, 0.9], [1.4, 1.5, 0.9], [1.4, 1.5, 0.9], [1.35, 1.45, 0.9]], spread: 0.01, thumb: [0.3, 0.95, 0.45, 0.35] },
};

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _qi = new THREE.Quaternion();

/* Build one gloved hand (+ its sleeve) from the downloaded bytes. `side` -1
   mirrors it into a left hand. Resolves null if the model isn't there. */
export async function buildGlove(side = 1, envMap = null) {
  const buf = await loadGloveData();
  if (!buf) return null;
  const gltf = await new GLTFLoader().parseAsync(buf.slice(0), "");
  const scene = gltf.scene;
  const root = new THREE.Group();          // the hand frame (placeHand drives this)
  const inner = new THREE.Group();
  inner.scale.x = side;                    // mirror for the left hand
  root.add(inner);

  let sleeve = null;
  const bones = {};
  scene.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
    if (o.isMesh) {
      o.frustumCulled = false;
      o.castShadow = o.receiveShadow = false;
      // Blender's sheen / coat export as MeshPhysicalMaterial, the priciest
      // shader three has (and a white sheen that turned the black leather
      // grey). The sleeves fill a lot of screen right by the camera, so
      // per-pixel cost matters: plain standard materials, like the guns.
      const src = o.material;
      const m = src?.isMeshPhysicalMaterial
        ? new THREE.MeshStandardMaterial({ name: src.name, color: src.color, roughness: src.roughness, metalness: src.metalness })
        : src;
      if (m !== src) { src.dispose(); o.material = m; }
      if (m?.isMeshStandardMaterial) m.roughness = Math.max(m.roughness, 0.55);
      if (m?.isMeshStandardMaterial && envMap) { m.envMap = envMap; m.envMapIntensity = 0.25; }
      // Charcoal accents so the hand reads against dark guns: the knuckle
      // guard, cuff and stitching lighter than the black leather.
      const ACCENT = { GL_Rubber: 0x34373b, GL_Neoprene: 0x26282b, GL_Stitch: 0x7a7d82, GL_Velcro: 0x2e3033 };
      if (m && ACCENT[m.name] != null) m.color.setHex(ACCENT[m.name]);
    }
  });
  scene.traverse((o) => { if (o.name === "GL_Sleeve") sleeve = o; });
  if (sleeve) sleeve.removeFromParent();
  inner.add(scene);

  // Rest frames: W (a bone's rest orientation in the hand frame) for every
  // bone, so a hand-frame rotation R becomes W⁻¹·R·W in bone space.
  scene.updateMatrixWorld(true);
  const rest = {};
  const rootInv = new THREE.Matrix4().copy(scene.matrixWorld).invert();
  for (const [name, b] of Object.entries(bones)) {
    const m = new THREE.Matrix4().multiplyMatrices(rootInv, b.matrixWorld);
    const W = new THREE.Quaternion().setFromRotationMatrix(m);
    rest[name] = { local: b.quaternion.clone(), W, Wi: W.clone().invert() };
  }

  const sleeveRoot = new THREE.Group();
  if (sleeve) {
    const s = new THREE.Group();
    // A touch slimmer than modelled: seen end-on from the camera, the
    // forearm reads fat.
    s.scale.set(side * 0.72, 0.72, 1);
    s.add(sleeve);
    sleeve.position.set(0, 0, 0);
    sleeveRoot.add(s);
    // The view model's blue ambient lifts dark fabric to grey: darker here.
    sleeve.traverse((o) => {
      if (!o.isMesh) return;
      if (o.material.name === "GL_Sleeve") o.material.color.setHex(0x0f110e);
      if (o.material.name === "GL_SleeveCuff") o.material.color.setHex(0x0a0b09);
    });
  }

  // Baked copies: the pose only changes a handful of times (grip, clamp,
  // holding a mag), so each change is skinned once on the CPU into plain
  // meshes and the skinned ones never draw. Per-frame GPU skinning cost
  // nothing on a desktop GPU but crawled on software rendering (and weak
  // phones), and the hands are on screen all match.
  const skins = [];
  scene.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const g = new THREE.BufferGeometry();
    g.setIndex(o.geometry.index);
    for (const [k, a] of Object.entries(o.geometry.attributes)) {
      if (k === "skinIndex" || k === "skinWeight") continue;
      g.setAttribute(k, k === "position" || k === "normal" ? a.clone() : a);
    }
    const baked = new THREE.Mesh(g, o.material);
    baked.frustumCulled = false;
    o.parent.add(baked);
    baked.position.copy(o.position);
    baked.quaternion.copy(o.quaternion);
    baked.scale.copy(o.scale);
    skins.push({ src: o, baked });
  });
  for (const k of skins) k.src.visible = false;

  const glove = { root, sleeve: sleeveRoot, bones, rest, side, skins, pose: null };
  poseGlove(glove, "relaxed");
  return glove;
}

const _m = new THREE.Matrix4();
const _mm = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
/* CPU-skin every skinned part into its baked twin at the current pose
   (three's own formula: bindMatrixInverse · Σ wᵢ·boneMatrixᵢ · bindMatrix). */
function bakeGlove(glove) {
  glove.root.updateMatrixWorld(true);
  for (const { src, baked } of glove.skins) {
    const sk = src.skeleton;
    sk.update();
    const bm = sk.boneMatrices;
    const pos0 = src.geometry.attributes.position, nor0 = src.geometry.attributes.normal;
    const si = src.geometry.attributes.skinIndex, sw = src.geometry.attributes.skinWeight;
    const pos = baked.geometry.attributes.position, nor = baked.geometry.attributes.normal;
    const e = _m.elements;
    for (let i = 0; i < pos0.count; i++) {
      e.fill(0);
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k);
        if (w === 0) continue;
        const o = si.getComponent(i, k) * 16;
        for (let c = 0; c < 16; c++) e[c] += bm[o + c] * w;
      }
      _mm.multiplyMatrices(src.bindMatrixInverse, _m).multiply(src.bindMatrix);
      _v.fromBufferAttribute(pos0, i).applyMatrix4(_mm);
      pos.setXYZ(i, _v.x, _v.y, _v.z);
      if (nor0) {
        _n.fromBufferAttribute(nor0, i).transformDirection(_mm);
        nor.setXYZ(i, _n.x, _n.y, _n.z);
      }
    }
    pos.needsUpdate = true;
    if (nor) nor.needsUpdate = true;
    baked.geometry.computeBoundingSphere();
  }
}

function setJoint(glove, name, x, y, order = "XYZ") {
  const b = glove.bones[name], r = glove.rest[name];
  if (!b || !r) return;
  _q.setFromEuler(_e.set(x, y, 0, order));
  // W⁻¹·R·W, then on top of the rest rotation.
  _qi.copy(r.Wi).multiply(_q).multiply(r.W);
  b.quaternion.copy(r.local).multiply(_qi);
}

/* Same pose data and conventions as hand-model.js poseHumanHand. */
export function poseGlove(glove, pose, thumbPress = 0) {
  // Same pose as last frame: nothing to redo (the bake is the costly part).
  const key = pose + ":" + thumbPress;
  if (glove.pose === key) return;
  glove.pose = key;
  const p = GLOVE_POSES[pose] || HAND_POSES[pose] || HAND_POSES.relaxed;
  for (let i = 0; i < 4; i++) {
    const [a, b, c] = p.curl[i];
    setJoint(glove, `F${i}_0`, -a, (1.5 - i) * p.spread);
    setJoint(glove, `F${i}_1`, -b, 0);
    setJoint(glove, `F${i}_2`, -c, 0);
  }
  const [yaw, pitch, c1, c2] = p.thumb;
  setJoint(glove, "T0", -pitch, yaw, "YXZ");
  setJoint(glove, "T1", -(c1 + thumbPress * 0.5), 0);
  setJoint(glove, "T2", -(c2 + thumbPress * 0.6), 0);
  if (glove.skins) bakeGlove(glove);
}

/* The wrist, in the glove root's parent space. */
const _w = new THREE.Vector3();
export function gloveWrist(glove, out = _w) {
  return out.set(0, 0, 0.018).applyQuaternion(glove.root.quaternion).add(glove.root.position);   // the sleeve hem overlaps the cuff
}
