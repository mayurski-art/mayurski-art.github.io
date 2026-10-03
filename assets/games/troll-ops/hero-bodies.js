// Troll Forces — U Mad Bro? hero bodies (phase 3).
//
// A hero model (models/build_hero_<id>.blender.py -> hero-<id>.glb) is a set
// of rigid pieces named "<joint>__<piece>", authored on the stick rig's REST
// pose. Each piece is re-parented here to that joint of a live rig, keeping
// its rest-pose offset, so every pose, emote, dance and death the stick
// figure does, the hero does too. Hitboxes are untouched (character.js
// hitboxMeshes ride the same joints).
//
// Per rig: pieces are merged per joint + material (a few dozen draw calls,
// not hundreds), each joint gets one ink outline (inverted hull, like the
// art's black lines), the stick limbs, mitt hands and the flat face board
// are hidden, and the head's front takes the board's own material every
// frame, so face cosmetics and the sad emote still work.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { buildHumanoid } from "./character.js?v=to-hb4";
import { buildMeleeMesh, MELEE_DEFS } from "./gear.js?v=to-hb1";

/* Which heroes have a body so far. The rest keep the stick figure. */
export const HERO_BODIES = { knight: "hero-knight.glb?v=hk3" };
const BASE = new URL("./models/", import.meta.url).href;   // works from any page

const OUTLINE = 0.0085;   // metres the ink hull sits outside the surface

let envMap = null;
export function setHeroEnvMap(tex) { envMap = tex; }

/* ------------------------------------------------------------------ rest pose */
let restRig = null;
function jointOf(rig, name) {
  const p = rig.parts;
  if (name === "thighL") return p.kneeL?.parent || null;
  if (name === "thighR") return p.kneeR?.parent || null;
  return p[name] || null;
}
const _inv = new THREE.Matrix4();
function restMatrix(name) {
  if (!restRig) {
    restRig = buildHumanoid(new THREE.MeshBasicMaterial(), { height: 1.8, gun: false });
    restRig.root.updateMatrixWorld(true);
  }
  const j = jointOf(restRig, name);
  return j ? j.matrixWorld : null;
}

/* ------------------------------------------------------------------ ink */
const inkMat = new THREE.MeshBasicMaterial({ color: 0x060606, side: THREE.BackSide });
inkMat.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader.replace(
    "#include <begin_vertex>",
    `#include <begin_vertex>\n  transformed += normalize(normal) * ${OUTLINE.toFixed(4)};`,
  );
};
inkMat.userData.shared = true;

/* ------------------------------------------------------------------ templates */
// id -> Promise<[{ joint, geo, mat, face }]>: merged per joint + material,
// already moved into the joint's rest frame. Built once, shared by every rig.
const templates = new Map();

function dressMaterial(m) {
  const out = m.clone();
  // glTF metals render near-black without reflections; keep them modest
  // and give them the weapons' studio map.
  out.metalness = Math.min(out.metalness ?? 0, 0.3);
  if (envMap) { out.envMap = envMap; out.envMapIntensity = 0.55; }
  out.userData.shared = true;
  return out;
}

function loadTemplate(id) {
  if (templates.has(id)) return templates.get(id);
  const url = HERO_BODIES[id];
  const p = new GLTFLoader().loadAsync(BASE + url).then((gltf) => {
    gltf.scene.updateMatrixWorld(true);
    const groups = new Map();   // "joint|matName" -> { joint, geos, mat, face }
    const mats = new Map();
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      // A multi-material piece arrives as a group of meshes; the name with
      // "__" is on the node or its parent.
      const named = o.name.includes("__") ? o : o.parent;
      const joint = named?.name.split("__")[0];
      const rest = joint && restMatrix(joint);
      if (!rest) return;
      const geo = o.geometry.clone();
      _inv.copy(rest).invert();
      geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(_inv, o.matrixWorld));
      for (const k of Object.keys(geo.attributes)) if (!["position", "normal", "uv"].includes(k)) geo.deleteAttribute(k);
      if (!geo.attributes.uv) geo.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
      const face = o.material.name === "trollface";
      // glTF stores V flipped (top-left origin); the board's face texture is
      // a normal flipY texture, so flip the head's V back or the face is
      // upside down.
      if (face) {
        const uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
      }
      const mname = o.material.name || "m";
      if (!mats.has(mname)) mats.set(mname, face ? null : dressMaterial(o.material));
      const key = `${joint}|${mname}`;
      if (!groups.has(key)) groups.set(key, { joint, geos: [], mat: mats.get(mname), face });
      groups.get(key).geos.push(geo);
    });
    const out = [];
    const perJoint = new Map();
    for (const g of groups.values()) {
      const geo = g.geos.length > 1 ? mergeGeometries(g.geos.map((x) => x.index ? x.toNonIndexed() : x), false) : g.geos[0];
      geo.computeBoundingSphere();
      geo.userData.shared = true;
      out.push({ joint: g.joint, geo, mat: g.mat, face: g.face });
      if (!perJoint.has(g.joint)) perJoint.set(g.joint, []);
      perJoint.get(g.joint).push(geo);
    }
    // One ink hull per joint, from everything on it.
    for (const [joint, geos] of perJoint) {
      const merged = mergeGeometries(geos.map((x) => {
        const c = (x.index ? x.toNonIndexed() : x.clone());
        c.deleteAttribute("uv");
        return c;
      }), false);
      merged.userData.shared = true;
      out.push({ joint, geo: merged, mat: inkMat, outline: true });
    }
    return out;
  }).catch((err) => {
    console.warn("[hero-bodies] couldn't load", id, err);
    templates.delete(id);
    return null;
  });
  templates.set(id, p);
  return p;
}

export function preloadHeroBodies() {
  for (const id of Object.keys(HERO_BODIES)) loadTemplate(id);
}

/* ------------------------------------------------------------------ per rig */
function clearBody(rig) {
  for (const m of rig.heroPieces || []) m.parent?.remove(m);
  rig.heroPieces = [];
  rig.heroFace = [];
  if (rig.heroSword) { rig.heroSword.parent?.remove(rig.heroSword); rig.heroSword = null; }
  const p = rig.parts;
  if (p.body) p.body.visible = true;
  if (p.head) p.head.visible = true;
  if (p.handL) p.handL.visible = true;
  if (p.handR) p.handR.visible = true;
}

/* Put hero `id` (wire form: "metamorph!" = the brute) on `rig`, or take it
   off (null / a hero with no body yet). Cheap to call every frame. */
export function applyHeroBody(rig, wireId) {
  const id = wireId ? String(wireId).replace(/!$/, "") : null;
  const want = id && HERO_BODIES[id] ? id : null;
  if (rig.heroBodyId === want) return;
  rig.heroBodyId = want;
  clearBody(rig);
  if (!want) return;
  loadTemplate(want).then((parts) => {
    if (!parts || rig.heroBodyId !== want) return;
    for (const t of parts) {
      const joint = jointOf(rig, t.joint);
      if (!joint) continue;
      const mesh = new THREE.Mesh(t.geo, t.face ? rig.parts.head?.material : t.mat);
      mesh.castShadow = !t.outline;
      mesh.frustumCulled = false;   // joints move a lot; a few dozen meshes
      mesh.userData.heroPiece = true;
      joint.add(mesh);
      rig.heroPieces.push(mesh);
      if (t.face) rig.heroFace.push(mesh);
    }
    // The Knight carries the keyboard greatsword across his back while his
    // hands are busy with a gun (the game's own model, gear.js).
    if (want === "knight" && rig.parts.chest) {
      const sword = buildMeleeMesh(MELEE_DEFS.keyboard, false);
      // Grip over the right shoulder, blade down across the back to the
      // left hip (the mesh's blade runs along -Z from the grip).
      sword.position.set(0.17, 0.1, 0.23);
      sword.rotation.order = "ZYX";
      sword.rotation.set(-Math.PI / 2, Math.PI / 2, -0.55);   // y: keys facing out
      sword.scale.setScalar(1.1);
      rig.parts.chest.add(sword);
      rig.heroSword = sword;
    }
    const p = rig.parts;
    if (p.body) p.body.visible = false;
    if (p.head) p.head.visible = false;
    if (p.handL) p.handL.visible = false;
    if (p.handR) p.handR.visible = false;
  });
}

/* Every frame after posing: the face follows the board's material (face
   cosmetics, the sad emote), the back sword hides while the sword is out. */
export function syncHeroBody(rig) {
  if (!rig.heroBodyId) return;
  const faceMat = rig.parts.head?.material;
  for (const m of rig.heroFace) if (m.material !== faceMat) m.material = faceMat;
  // poseHumanoid can flip the board back on; keep it off.
  if (rig.parts.head?.visible) rig.parts.head.visible = false;
  if (rig.parts.body?.visible) rig.parts.body.visible = false;
  if (rig.heroSword) {
    const grip = rig.parts.gripR;
    let held = false;
    if (grip) for (const c of grip.children) if (c.visible) { held = true; break; }
    rig.heroSword.visible = !held;
  }
}
