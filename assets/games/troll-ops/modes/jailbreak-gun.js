// Troll Forces — Troll City's jailbreak: the hand cannon taped under the
// bunk (modes/social-jailbreak.js). A .50 that fires like the arsenal's
// pistols: the muzzle flash, the kick up and back, the screen jolt, the
// dust off the brick. Socialize has no guns, so it's only ever a prop in
// the hand and under the bunks: the round is judged by social-jailbreak.js,
// never a bullet that could hit anyone.

import * as THREE from "three";
import { makeMuzzleFlashMaterial } from "../view/shaders.js?v=or1";

const steel = new THREE.MeshStandardMaterial({ color: 0x2b2d31, metalness: 0.8, roughness: 0.34 });
const satin = new THREE.MeshStandardMaterial({ color: 0x8d9096, metalness: 0.85, roughness: 0.28 });
const rubber = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.85 });
const bore = new THREE.MeshBasicMaterial({ color: 0x050505 });

/* The gun, real size (0.27 m long), muzzle along -z, the grip down and back
   at +z like the fist fight's revolver, so the same hand pose holds it. */
export function makeHandCannon() {
  const g = new THREE.Group();
  const box = (mat, w, h, d, x, y, z, rx = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.rotation.x = rx;
    g.add(m);
    return m;
  };
  box(satin, 0.036, 0.042, 0.255, 0, 0.048, -0.085);          // the slide, long and flat-topped
  box(steel, 0.03, 0.012, 0.25, 0, 0.074, -0.085);            // its top rib
  box(steel, 0.032, 0.03, 0.175, 0, 0.014, -0.12);            // the frame under the barrel
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.004, 10), bore);
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0, 0.05, -0.2135);
  g.add(muzzle);
  box(steel, 0.006, 0.012, 0.01, 0, 0.086, -0.2);             // the front sight
  box(steel, 0.024, 0.01, 0.01, 0, 0.084, 0.03);              // the rear sight
  box(steel, 0.012, 0.022, 0.014, 0, 0.07, 0.05, -0.4);       // the hammer
  box(steel, 0.026, 0.006, 0.06, 0, -0.024, -0.04);           // the trigger guard, under
  box(steel, 0.026, 0.032, 0.006, 0, -0.01, -0.07);           // ...and its front
  box(steel, 0.006, 0.02, 0.006, 0, -0.008, -0.035, 0.3);     // the trigger
  box(rubber, 0.034, 0.12, 0.054, 0, -0.045, 0.03, -0.3);     // the grip
  box(steel, 0.03, 0.012, 0.05, 0, -0.105, 0.048, -0.3);      // its base plate
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), makeMuzzleFlashMaterial());
  flash.position.set(0, 0.05, -0.25);
  flash.rotation.z = Math.random() * Math.PI;
  flash.renderOrder = 3;   // always drawn, dark till a shot lights uIntensity: no shader compile on the first shot
  g.add(flash);
  g.userData.flash = flash;
  g.userData.muzzle = muzzle;
  return g;
}
