// Troll Ops — procedural viewmodel hand.
//
// Two low-poly fist+forearm builders, built the same box()/cyl() way as
// weapon-model.js, meant to be added as a CHILD of the weapon/melee mesh at
// an existing grip anchor. Either rides along for free: no new per-frame
// transform code, because the parent mesh is already being animated.
// See DESIGN-ARMS.md Phase 1.
//
// buildGripHand() is the trigger hand (Phase 1). buildSupportHand() is the
// second, forward hand two-handed weapons/melee need on the foregrip or
// guard — a flatter palm that wraps a horizontal rail from above/the side,
// instead of curling around a vertical pistol grip.

import * as THREE from "three";

const SKIN = 0xd98a5f;
const SKIN_DARK = 0xb56e49;

function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function cyl(rt, rb, h, mat, seg = 8) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); }

/* Builds a fist wrapping around the +Z grip axis (fingers curl around the
   grip, which passes through the fist on its own — the fist reads as a
   closed hand around the existing grip box, not a block that replaces it),
   forearm trailing off toward the player (+Z, toward camera). `scale` sizes
   the whole hand relative to the grip box it's wrapping — tuned against
   `scale = 1` on the standard rifle grip box (0.05 wide, `weapon-model.js`);
   callers on a sidearm or the tank launcher pass a smaller scale so the
   hand doesn't dwarf a small gun. `styleHint` is reserved for a future
   left/support hand or glove variant — Phase 1 only needs the one
   trigger-hand shape. */
export function buildGripHand(scale = 1, styleHint) {
  const group = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.65, metalness: 0.02 });
  const skinDarkMat = new THREE.MeshStandardMaterial({ color: SKIN_DARK, roughness: 0.65, metalness: 0.02 });
  const s = scale;

  // Fist: four curled-finger boxes wrapping the front of the grip (-Y, the
  // side facing away from the trigger guard) plus a palm slab behind them.
  // Kept as a thin shell around the grip rather than one solid block, so it
  // reads as fingers gripping a handle instead of a fist-shaped growth
  // bigger than the gun itself.
  const palm = box(0.026 * s, 0.05 * s, 0.05 * s, skinMat);
  palm.position.set(0.02 * s, 0, 0);
  group.add(palm);

  for (let i = 0; i < 3; i++) {
    const finger = box(0.018 * s, 0.014 * s, 0.014 * s, skinDarkMat);
    finger.position.set(-0.006 * s, 0.016 * s - i * 0.015 * s, 0.012 * s);
    group.add(finger);
  }

  const thumb = box(0.014 * s, 0.014 * s, 0.024 * s, skinMat);
  thumb.position.set(0.014 * s, 0.03 * s, -0.014 * s);
  thumb.rotation.y = 0.4;
  group.add(thumb);

  // Forearm: trails back from the grip toward the player, thin enough not
  // to read as a second gun body.
  const forearmLen = 0.09 * s;
  const forearm = cyl(0.016 * s, 0.02 * s, forearmLen, skinMat, 8);
  forearm.rotation.x = Math.PI / 2;
  forearm.position.set(0.018 * s, -0.006 * s, forearmLen * 0.5 + 0.03 * s);
  group.add(forearm);

  group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return group;
}

/* Builds a claw wrapping DOWN over a horizontal rail directly below the
   group's own origin — local -Y reaches down onto the rail, local Z runs
   along the rail's length. Four long, clearly-separated finger slats hang
   from a small knuckle bar and bend partway down (a two-segment joint) so
   the silhouette reads as a hand gripping from above even at a distance —
   deliberately simple (no forearm, no thumb) so nothing can balloon into
   the frame and swallow the read the way a bulky forearm cylinder did on
   the first two passes at this shape. `scale` follows the same convention
   as buildGripHand: 1 = tuned against the standard rifle handguard width
   in weapon-model.js. */
export function buildSupportHand(scale = 1) {
  const group = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.65, metalness: 0.02 });
  const skinDarkMat = new THREE.MeshStandardMaterial({ color: SKIN_DARK, roughness: 0.65, metalness: 0.02 });
  const s = scale;

  // Knuckle bar sits at the group origin, the four fingers' shared root.
  const knuckle = box(0.062 * s, 0.02 * s, 0.024 * s, skinMat);
  group.add(knuckle);

  // Four fingers, evenly spread across X, each a two-segment claw: a
  // short top joint angled down from the knuckle, then a longer lower
  // joint curling further under the rail — the bend is what reads as a
  // gripping finger instead of a straight peg.
  const fingerXs = [-0.021, -0.007, 0.007, 0.021];
  for (const fx of fingerXs) {
    const finger = new THREE.Group();
    finger.position.set(fx * s, -0.006 * s, 0);
    group.add(finger);

    const upper = box(0.012 * s, 0.024 * s, 0.011 * s, skinDarkMat);
    upper.position.set(0, -0.012 * s, 0);
    upper.rotation.x = 0.45;
    finger.add(upper);

    const lower = box(0.011 * s, 0.02 * s, 0.010 * s, skinDarkMat);
    lower.position.set(0, -0.032 * s, 0.014 * s);
    lower.rotation.x = 1.3;
    finger.add(lower);
  }

  group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return group;
}
