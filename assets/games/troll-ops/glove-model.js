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
import { HAND_POSES } from "./hand-model.js";

const URL_GLB = new URL("./models/gloves.glb?v=gl1", import.meta.url).href;
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
      const m = o.material;
      // Blender's sheen exports as a white sheen colour: under the view
      // model's lights it turned the black leather grey-white.
      if (m?.isMeshPhysicalMaterial) { m.sheen = 0; m.clearcoat = Math.min(m.clearcoat || 0, 0.12); m.clearcoatRoughness = 0.5; }
      if (m?.isMeshStandardMaterial) m.roughness = Math.max(m.roughness, 0.55);
      if (m?.isMeshStandardMaterial && envMap) { m.envMap = envMap; m.envMapIntensity = 0.25; }
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
    s.scale.set(side * 0.82, 0.82, 1);
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

  const glove = { root, sleeve: sleeveRoot, bones, rest, side };
  poseGlove(glove, "relaxed");
  return glove;
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
}

/* The wrist, in the glove root's parent space. */
const _w = new THREE.Vector3();
export function gloveWrist(glove, out = _w) {
  return out.set(0, 0, 0.05).applyQuaternion(glove.root.quaternion).add(glove.root.position);
}
