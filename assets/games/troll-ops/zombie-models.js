// Troll Forces — the realistic zombie bodies (models/zombie-<look>.glb).
//
// models/build_zombies.blender.py exports one GLB per look: a MakeHuman body
// on the "game_engine" rig (UE-style bone names) with its rotted skin baked
// to colour + normal maps, clothes with baked colour + alpha tears, teeth,
// milky eyes, and six in-place clips: walk, run, idle, attack, die, rise
// (clawing out of a grave). The leaper's set swaps walk/run for lope,
// crouch and leap.
//
// Each GLB is fetched and parsed once. Every zombie is a skinned clone that
// shares the geometry, textures and (apart from a skin tint) the materials,
// with its own bones, mixer and invisible hitboxes riding those bones.
// three r160 ships no SkeletonUtils, so cloneSkinned() does that job.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const LOOKS = {
  walker: new URL("./models/zombie-walker.glb?v=zr2", import.meta.url).href,
  runner: new URL("./models/zombie-runner.glb?v=zr2", import.meta.url).href,
  woman: new URL("./models/zombie-woman.glb?v=zr2", import.meta.url).href,
  worker: new URL("./models/zombie-worker.glb?v=zr2", import.meta.url).href,
  // the rare one: a rubber mask of the real trollface art (zombies.js
  // picks it about 1 in 40)
  trollmask: new URL("./models/zombie-trollmask.glb?v=zr2", import.meta.url).href,
  // the leaper's own gaunt, long-armed body and clip set (idle, lope,
  // crouch, leap, attack, die, rise)
  leaper: new URL("./models/zombie-leaper.glb?v=zr3", import.meta.url).href,
};
export const ZOMBIE_LOOKS = Object.keys(LOOKS);
export const RARE_LOOKS = { trollmask: 1 / 40 };
// a type that always wears its own look (and no other type does)
export const TYPE_LOOKS = { leaper: "leaper" };
const DEDICATED = new Set(Object.values(TYPE_LOOKS));

// Ground speed (m/s) each clip's stride covers at timeScale 1, so the feet
// keep pace with the body instead of skating.
export const CLIP_SPEED = { walk: 0.95, run: 3.4, lope: 4.0 };

// clips that play once and hold their last frame
export const ONE_SHOTS = new Set(["attack", "die", "rise", "crouch", "leap"]);

const templates = new Map();   // look -> { scene, clips } once loaded
const pending = new Map();     // look -> Promise
let failed = false;

function prepTemplate(gltf) {
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    // skinned bounds are the bind pose's; a lunging arm leaves them
    o.frustumCulled = false;
    const m = o.material;
    if (m.transparent) {
      // torn clothes and hair: clipped, not blended, so they sort and
      // shadow like solid cloth
      m.transparent = false;
      m.alphaTest = 0.5;
      m.depthWrite = true;
      m.side = THREE.DoubleSide;
    }
    if (m.name === "ZB_Eye") {
      // milky eyes catch a little light in the dark
      m.emissive = new THREE.Color(0x9aa49c);
      m.emissiveIntensity = 0.35;
    }
  });
  return { scene: gltf.scene, clips: gltf.animations };
}

export function loadZombieLook(look) {
  if (!pending.has(look)) {
    pending.set(look, new GLTFLoader().loadAsync(LOOKS[look])
      .then((g) => { templates.set(look, prepTemplate(g)); })
      .catch((e) => { failed = true; console.warn("zombie model failed", look, e); }));
  }
  return pending.get(look);
}

export function preloadZombieModels() {
  return Promise.all(ZOMBIE_LOOKS.map(loadZombieLook));
}

/* True once at least one look is ready (zombies can spawn as real bodies);
   false while loading; null if loading failed (fall back to the stick rig). */
export function zombieModelsReady() {
  if (templates.size) return true;
  return failed && pending.size === ZOMBIE_LOOKS.length ? null : false;
}

export function readyLooks() {
  return ZOMBIE_LOOKS.filter((l) => templates.has(l));
}

export function lookReady(look) {
  return templates.has(look);
}

/* A look for a new zombie of `type`: its own look if it has one, else each
   rare one at its odds, else any common one. */
export function pickLook(type = null) {
  const own = TYPE_LOOKS[type];
  if (own && templates.has(own)) return own;
  const ready = readyLooks().filter((l) => !DEDICATED.has(l));
  for (const [look, odds] of Object.entries(RARE_LOOKS)) {
    if (ready.includes(look) && Math.random() < odds) return look;
  }
  const common = ready.filter((l) => !(l in RARE_LOOKS));
  return common.length ? common[Math.floor(Math.random() * common.length)] : ready[0] ?? null;
}

/* A clone of a skinned scene: shared geometry and materials, fresh bones,
   each SkinnedMesh re-bound to its own copies of them. */
function cloneSkinned(source) {
  const clone = source.clone(true);
  const map = new Map();
  const walk = (a, b) => {
    map.set(a, b);
    for (let i = 0; i < a.children.length; i++) walk(a.children[i], b.children[i]);
  };
  walk(source, clone);
  source.traverse((src) => {
    if (!src.isSkinnedMesh) return;
    const dst = map.get(src);
    const bones = src.skeleton.bones.map((b) => map.get(b));
    dst.bind(new THREE.Skeleton(bones, src.skeleton.boneInverses), src.bindMatrix);
  });
  return clone;
}

const HIT_PROXY_MAT = new THREE.MeshBasicMaterial({ visible: false });
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);

/* An invisible hit proxy on `bone`, placed in MODEL space at rest: a sphere
   at `a`, or a capsule from `a` to `b`. Converted into the bone's frame, so
   it follows every pose whatever the bone's local axes are. */
function proxy(bone, geo, a, b = null, isHead = false) {
  const m = new THREE.Mesh(geo, HIT_PROXY_MAT);
  m.visible = false;
  m.userData.isHitProxy = true;
  if (isHead) m.userData.isHead = true;
  const center = b ? _a.copy(a).add(b).multiplyScalar(0.5) : _a.copy(a);
  bone.updateWorldMatrix(true, false);
  m.position.copy(bone.worldToLocal(center.clone()));
  if (b) {
    _q.setFromUnitVectors(_up, _b.copy(b).sub(a).normalize());
    const boneQ = new THREE.Quaternion();
    bone.getWorldQuaternion(boneQ);
    m.quaternion.copy(boneQ.invert().multiply(_q));
  }
  bone.add(m);
  return m;
}

function capsule(r, a, b) {
  return new THREE.CapsuleGeometry(r, Math.max(0.01, a.distanceTo(b) - r), 4, 8);
}

/* One zombie body: { root, mixer, actions, bones, hitboxMeshes, dispose }.
   `root` stands at the feet facing -Z (the game's forward). */
export function createZombieBody(look, { tint = null, build = 1 } = {}) {
  const t = templates.get(look);
  if (!t) return null;
  const model = cloneSkinned(t.scene);
  // glTF forward is +Z (Blender's -Y); the game's is -Z
  model.rotation.y = Math.PI;
  const root = new THREE.Group();
  root.add(model);
  if (build !== 1) model.scale.set(build, 1, build);

  const own = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    if (tint && o.material.name.endsWith("_skin")) {
      o.material = o.material.clone();
      o.material.color.copy(tint);
      own.push(o.material);
    }
  });

  const bones = {};
  model.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  root.updateMatrixWorld(true);
  const P = (name) => bones[name].getWorldPosition(new THREE.Vector3());
  // hitboxes at rest, in root space (root sits at the origin here)
  const head = P("head"), neck = P("neck_01"), pelvis = P("pelvis"), sp1 = P("spine_01");
  const hb = [];
  hb.push(proxy(bones.head, new THREE.SphereGeometry(0.15, 10, 8), head.clone().add(new THREE.Vector3(0, 0.08, -0.01)), null, true));
  hb.push(proxy(bones.spine_02, capsule(0.17 * build, sp1, neck), sp1, neck));
  hb.push(proxy(bones.pelvis, new THREE.SphereGeometry(0.16 * build, 8, 6), pelvis));
  for (const s of ["l", "r"]) {
    const ua = P(`upperarm_${s}`), la = P(`lowerarm_${s}`), hd = P(`hand_${s}`);
    hb.push(proxy(bones[`upperarm_${s}`], capsule(0.065, ua, la), ua, la));
    hb.push(proxy(bones[`lowerarm_${s}`], capsule(0.055, la, hd), la, hd));
    const th = P(`thigh_${s}`), ca = P(`calf_${s}`), ft = P(`foot_${s}`);
    hb.push(proxy(bones[`thigh_${s}`], capsule(0.085 * build, th, ca), th, ca));
    hb.push(proxy(bones[`calf_${s}`], capsule(0.065, ca, ft), ca, ft));
  }

  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const clip of t.clips) {
    const a = mixer.clipAction(clip);
    if (ONE_SHOTS.has(clip.name)) {
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
    }
    actions[clip.name] = a;
  }

  return {
    root, model, mixer, actions, bones, hitboxMeshes: hb,
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
      for (const m of own) m.dispose();
      for (const h of hb) h.geometry.dispose();
    },
  };
}
