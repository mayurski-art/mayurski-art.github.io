// The first-person weapon scene: its camera, lights and studio reflections,
// the gun, melee and streak meshes in hand, the muzzle flash, akimbo and hellfire.

import * as THREE from "three";
import { setWeaponEnvMap, preloadWeaponModels, hasDetailedModel, buildWeaponMesh } from "../weapon-model.js?v=p5-em1-wst-hf1-wb1-ar1";
import { setSaberEnvMap, preloadTrollsaber } from "../trollsaber.js?v=ts4-ig1";
import { setHalloweenEnvMap, preloadHalloweenMelee } from "../melee-models.js?v=hw2";
import { setHeroEnvMap } from "../hero-bodies.js?v=umb3g-nf-wst-ig1-soc1c2f1m1u";
import { showSumGun, charInspector, inspectorLive, inspector } from "../menu/lobby.js?v=lb1-si1-gj1-if1-fu1b7b7dc2-wb1m1c4-cup1";
import { restoreMeleeHands } from "./weapon-view.js?v=wv1-si1-gj1-if1-fu1b7b7dc2-wb1m1c4-cup1";
import { buildMeleeMesh } from "../gear.js?v=to-hb1kb3-bk1-wst-ig1";
import { buildStreakDevice, buildMarkerDevice } from "../streak-device.js?v=to-df1";
import { loadModel } from "../battlefield-props.js";
import { makeMuzzleFlashMaterial } from "../shaders.js";
import { createAkimboView } from "../akimbo-view.js?v=ak1-wst";
import { HellfireFx } from "../soul-blazer.js?v=sb1";
import { game } from "../core/state.js?v=st1";

// Rendered in a separate scene/camera overlay so the tiny gun mesh never
// suffers near-plane distortion or scale mismatch with the world FOV.

export const weaponScene = new THREE.Scene();
export const weaponCamera = new THREE.PerspectiveCamera(58, 16 / 9, 0.01, 10);
export const weaponRig = new THREE.Group();

const weaponKeyLight = new THREE.DirectionalLight(0xfff2d8, 3.2);
const weaponRimLight = new THREE.DirectionalLight(0x8fb0ff, 1.8);
const weaponFillLight = new THREE.AmbientLight(0xaab8ff, 1.1);

export let weaponEnvTex = null;


// Only the equipped weapon is built, and it's rebuilt whenever the loadout
// changes, because attachments alter the geometry.
export let activeWeaponMesh = null;
let activeWeaponDef = null;

export function setActiveWeaponMesh(def) {
  activeWeaponDef = def;
  if (activeWeaponMesh) {
    weaponRig.remove(activeWeaponMesh);
    activeWeaponMesh.traverse((o) => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      if (o.material) o.material.dispose?.();
    });
  }
  activeWeaponMesh = buildWeaponMesh(def);
  // No first-person hands on guns (user call, 2026-09-25): the gun on
  // screen should look exactly like it does in the skin editor, and the
  // block hands sat right on the skin art. Melee and the streak device keep
  // theirs. The meshes stay (tagged userData.hand) for anything that reads
  // their positions; they just don't draw.
  activeWeaponMesh.traverse((o) => { if (o.userData.hand) o.visible = false; });
  weaponRig.add(activeWeaponMesh);
}

export let activeMeleeMesh = null;

export function setActiveMeleeMesh(def) {
  if (activeMeleeMesh) {
    restoreMeleeHands(activeMeleeMesh);
    weaponRig.remove(activeMeleeMesh);
    activeMeleeMesh.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose?.();
    });
  }
  activeMeleeMesh = buildMeleeMesh(def);
  activeMeleeMesh.visible = false;
  weaponRig.add(activeMeleeMesh);
}

/* Streak-call device (DESIGN-ARMS.md Phase 5) — built once, unlike the
   weapon/melee meshes, since it never changes per-loadout the way a gun's
   attachments or a melee weapon choice do. */
export const activeStreakMesh = buildStreakDevice();
// The care package marker, held up ready to throw.
export const activeMarkerMesh = buildMarkerDevice();
// The hunter-killer itself, held before it's tossed (the model streams in).
export const activeDroneMesh = new THREE.Group();

// muzzle flash sprite
export const muzzleMat = makeMuzzleFlashMaterial();
export const muzzleFlash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), muzzleMat);
// The Peacemakers' two guns, their brass and their smoke (akimbo-view.js).
export let akimboView;

// muzzle point light for dynamic illumination on each shot. Intensity stays
// small because the light sits centimetres from the gun mesh in the weapon
// overlay — anything near the old 3.2 blew the whole screen out to white
// under ACES tone mapping at this range.
export const muzzleLight = new THREE.PointLight(0xffcf8a, 0, 1.2, 2);

// The Soul Blazer's hellfire (soul-blazer.js): one system in the weapon
// scene for the fire out of the skull in your hands, one in the world for
// everyone else's shots, the burning pellets, where they land and the kill.
export const hellfireView = new HellfireFx(weaponScene, { scale: 0.5, max: 300 });
export let hellfire;
export const _sbPos = new THREE.Vector3();
export const _sbDir = new THREE.Vector3();
export const _sbView = new THREE.Matrix4();

/* What used to run at load in game.js: called from game.js where this code was. */
export function initViewmodels() {
  weaponScene.add(weaponRig);
  weaponKeyLight.position.set(0.5, 1.2, 1);
  weaponScene.add(weaponKeyLight);
  weaponRimLight.position.set(-0.6, 0.4, -1);
  weaponScene.add(weaponRimLight);
  weaponScene.add(weaponFillLight);
  /* A small studio for the detailed guns' reflections (the Green Candles'
     brass and steel): a dark floor, a grey horizon, a bright ceiling and
     three softboxes, baked once into a PMREM map. Only materials that ask
     for it use it (weapon-model.js), so no other gun or the world changes. */
  (() => {
    const env = new THREE.Scene();
    const geo = new THREE.SphereGeometry(10, 32, 16);
    const cols = [];
    const pos = geo.attributes.position;
    const c = new THREE.Color();
    const top = new THREE.Color(0.85, 0.87, 0.9), floor = new THREE.Color(0.05, 0.05, 0.055);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 10;
      c.setRGB(0.32, 0.34, 0.37).lerp(y > 0 ? top : floor, y > 0 ? Math.pow(y, 0.8) : Math.pow(-y, 0.5));
      cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    env.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const panel = new THREE.MeshBasicMaterial({ color: 0xffffff });
    panel.color.setScalar(4);
    for (const [x, y, z, w, h] of [[5, 5, 3, 5, 3], [-6, 3, -2, 3, 4], [0, 7, -6, 8, 1.2]]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), panel);
      p.position.set(x, y, z);
      p.lookAt(0, 0, 0);
      env.add(p);
    }
    const pmrem = new THREE.PMREMGenerator(game.renderer);
    weaponEnvTex = pmrem.fromScene(env, 0.04).texture;
    setWeaponEnvMap(weaponEnvTex);
    setSaberEnvMap(weaponEnvTex);
    setHalloweenEnvMap(weaponEnvTex);
    setHeroEnvMap(weaponEnvTex);
    pmrem.dispose();
  })();

  game.scene.add(game.camera);

  // The Trollsaber's hilt streams in too; its builder swaps the model into
  // any saber already built (trollsaber.js), so nothing to rebuild here.
  preloadTrollsaber();
  // The Chainsaw and the Reaper's Grin stream in the same way (melee-models.js).
  preloadHalloweenMelee();

  // Detailed models stream in; rebuild the gun in hand once they land.
  preloadWeaponModels().then((ok) => {
    if (!ok) return;
    if (hasDetailedModel(activeWeaponDef)) setActiveWeaponMesh(activeWeaponDef);
    // The menu previews snapshot the gun once; redraw them with the real model.
    if (hasDetailedModel(game.loadout.resolved)) {
      game.sumGunKey = null;
      showSumGun();
      charInspector?.setWeapon(game.loadout.resolved);
      if (inspectorLive) inspector?.show(game.loadout.resolved);
    }
  });
  activeStreakMesh.visible = false;
  weaponRig.add(activeStreakMesh);
  activeMarkerMesh.visible = false;
  weaponRig.add(activeMarkerMesh);
  activeDroneMesh.visible = false;
  weaponRig.add(activeDroneMesh);
  // Both hands cup it from underneath, one either side of the body.
  activeDroneMesh.userData.anchors = (() => {
    const right = new THREE.Object3D(), left = new THREE.Object3D();
    right.position.set(0.075, -0.035, 0.01);
    left.position.set(-0.075, -0.035, 0.01);
    activeDroneMesh.add(right, left);
    return { right, left };
  })();
  loadModel("hunter-drone").then((obj) => {
    obj.scale.setScalar(0.32);
    obj.traverse((n) => { if (n.isMesh) n.castShadow = false; });
    activeDroneMesh.add(obj);
    activeDroneMesh.userData.rotors = [];
    obj.traverse((n) => { if (n.name?.startsWith("DroneRotor")) activeDroneMesh.userData.rotors.push(n); });
  }).catch(() => {});
  muzzleFlash.rotation.z = Math.random() * Math.PI;
  weaponRig.add(muzzleFlash);
  // The Peacemakers' two guns, their brass and their smoke (akimbo-view.js).
  akimboView = createAkimboView({ weaponRig, audio: game.audio });
  weaponRig.add(muzzleLight);
  hellfire = new HellfireFx(game.scene, { scale: 1, max: 900, gain: 0.85, additive: false, hot: 0.5 });
}
