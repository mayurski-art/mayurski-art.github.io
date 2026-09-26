// Troll Forces — first-person streak-call device (DESIGN-ARMS.md Phase 5).
//
// A small wrist/tablet unit the player raises when calling in a UAV or
// lining up an airstrike marker, built the same box()/cyl() way as
// weapon-model.js so it matches the viewmodel's blocky low-poly vocabulary.
// The Phase 1 grip hand attaches to it the same child-mesh way it attaches
// to a gun/melee grip.

import * as THREE from "three";
import { buildGripHand } from "./hand-model.js";

const MATS = {
  body: () => new THREE.MeshStandardMaterial({ color: 0x2a2c28, roughness: 0.5, metalness: 0.4 }),
  band: () => new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.7, metalness: 0.1 }),
  screen: () => new THREE.MeshBasicMaterial({ color: 0x4ee62f }),
};

function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }

/* Builds the device held in-hand, grip axis along +Z matching every other
   viewmodel mesh's convention (weapon-model.js, gear.js). */
export function buildStreakDevice() {
  const group = new THREE.Group();

  const body = box(0.09, 0.14, 0.02, MATS.body());
  body.position.set(0, 0, -0.05);
  group.add(body);

  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.1), MATS.screen());
  screen.position.set(0, 0, -0.04);
  group.add(screen);

  // Wrist strap, wraps under the grip toward the player.
  const strap = box(0.03, 0.11, 0.14, MATS.band());
  strap.position.set(0, -0.02, 0.05);
  group.add(strap);

  const devicePoint = new THREE.Vector3(0, -0.02, 0.05);
  const hand = buildGripHand(0.85);
  hand.position.copy(devicePoint);
  hand.rotation.x = 0.2;
  group.add(hand);

  group.userData.devicePoint = devicePoint;
  group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return group;
}

/* The care package's smoke marker, held up ready to throw (BO2 calls a care
   package by throwing one). A stubby olive canister with a red cap and a
   strobe that blinks while it's in the hand. Same +Z grip convention. */
export function buildMarkerDevice() {
  const group = new THREE.Group();
  const can = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.13, 12),
    new THREE.MeshStandardMaterial({ color: 0x3b4034, roughness: 0.6, metalness: 0.2 }),
  );
  can.position.set(0, 0.03, -0.02);
  group.add(can);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.033, 0.033, 0.03, 12),
    new THREE.MeshStandardMaterial({ color: 0xc8321f, roughness: 0.5, emissive: 0x3a0804 }),
  );
  cap.position.set(0, 0.11, -0.02);
  group.add(cap);
  const strobe = new THREE.Mesh(
    new THREE.SphereGeometry(0.012, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff3322 }),
  );
  strobe.position.set(0, 0.13, -0.02);
  group.add(strobe);
  group.userData.strobe = strobe;

  const hand = buildGripHand(0.85);
  hand.position.set(0, -0.02, 0.03);
  hand.rotation.x = 0.2;
  group.add(hand);
  group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return group;
}
