// Troll Ops — procedural viewmodel hand.
//
// One low-poly fist+forearm, built the same box()/cyl() way as
// weapon-model.js, meant to be added as a CHILD of the weapon/melee mesh at
// its existing grip anchor. It rides along for free: no new per-frame
// transform code, because the parent mesh is already being animated.
// See DESIGN-ARMS.md Phase 1.

import * as THREE from "three";

const SKIN = 0xd98a5f;
const SKIN_DARK = 0xb56e49;

function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function cyl(rt, rb, h, mat, seg = 8) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); }

/* Builds a fist gripping the +Z axis (the grip's local forward), forearm
   trailing off toward the player (+Z, toward camera). `styleHint` is
   reserved for a future left/support hand or glove variant — Phase 1 only
   needs the one trigger-hand shape. */
export function buildGripHand(styleHint) {
  const group = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.65, metalness: 0.02 });
  const skinDarkMat = new THREE.MeshStandardMaterial({ color: SKIN_DARK, roughness: 0.65, metalness: 0.02 });

  // Forearm: trails back from the grip toward the player.
  const forearmLen = 0.16;
  const forearm = cyl(0.028, 0.034, forearmLen, skinMat, 8);
  forearm.rotation.x = Math.PI / 2;
  forearm.position.set(0, -0.01, forearmLen * 0.5 + 0.02);
  group.add(forearm);

  // Fist: a squarish block wrapping the grip axis at the origin.
  const fist = box(0.052, 0.05, 0.06, skinMat);
  fist.position.set(0, 0, 0);
  group.add(fist);

  // Three knuckle ridges across the top of the fist, plus a thumb wedge —
  // enough to read as a hand at viewmodel scale without per-finger rigging.
  for (const x of [-0.014, 0, 0.014]) {
    const knuckle = box(0.012, 0.014, 0.05, skinDarkMat);
    knuckle.position.set(x, 0.028, -0.002);
    group.add(knuckle);
  }
  const thumb = box(0.018, 0.018, 0.032, skinMat);
  thumb.position.set(0.032, -0.006, 0.024);
  thumb.rotation.y = 0.5;
  group.add(thumb);

  group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return group;
}
