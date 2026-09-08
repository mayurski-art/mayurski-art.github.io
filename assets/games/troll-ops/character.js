// Troll Ops — articulated humanoid characters.
//
// One rig serves both the PvP operators and the horde grunts: hips, torso,
// shoulders, a head that carries the grin, two arms and two legs, each on its
// own pivot so they can be posed and animated. The caller supplies the
// material, so grunts can drive the same rig through their dissolve shader.
//
// The root sits at the FEET and is rotated by yaw, matching how positions are
// tracked everywhere else in the game.

import * as THREE from "three";

const DARK = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });

function capsule(r, len, mat) {
  return new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat);
}

/* Build a humanoid `height` metres tall. Returns the root plus every part the
   animator needs to pose. */
export function buildHumanoid(material, { height = 1.8, build = 1, gun = true, face = "grin" } = {}) {
  const s = height / 1.8;
  const w = build;

  const root = new THREE.Group();

  // Hip height is exactly the leg chain's reach, so the feet land on y = 0 and
  // the head crown sits at `height`.
  const hipY = 0.9 * s;
  const hips = new THREE.Group();
  hips.position.y = hipY;
  root.add(hips);

  // --- torso
  const torso = capsule(0.17 * s * w, 0.26 * s, material);
  torso.position.y = 0.27 * s;
  torso.castShadow = true;
  hips.add(torso);

  const chest = new THREE.Mesh(
    new THREE.BoxGeometry(0.44 * s * w, 0.16 * s, 0.23 * s * w),
    material,
  );
  chest.position.y = 0.48 * s;
  chest.castShadow = true;
  hips.add(chest);

  // --- head, on its own group so it can look up and down
  const headPivot = new THREE.Group();
  headPivot.position.y = 0.56 * s;
  hips.add(headPivot);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17 * s, 16, 14), material);
  head.position.y = 0.17 * s;
  head.castShadow = true;
  head.userData.isHead = true;
  headPivot.add(head);

  if (face === "pepe") {
    // Bulging eyes set high and wide, with a broad flat frog mouth.
    const white = new THREE.MeshBasicMaterial({ color: 0xf2f4ee });
    const eyeGeo = new THREE.SphereGeometry(0.062 * s, 10, 10);
    const pupilGeo = new THREE.SphereGeometry(0.026 * s, 8, 8);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, white);
      eye.position.set(side * 0.085 * s, 0.255 * s, 0.115 * s);
      const pupil = new THREE.Mesh(pupilGeo, DARK);
      pupil.position.set(side * 0.095 * s, 0.25 * s, 0.163 * s);
      headPivot.add(eye, pupil);
    }
    const lips = new THREE.Mesh(
      new THREE.TorusGeometry(0.115 * s, 0.019 * s, 6, 18, Math.PI * 0.85),
      DARK,
    );
    lips.rotation.x = Math.PI;
    lips.rotation.z = -Math.PI * 0.075;
    lips.position.set(0, 0.14 * s, 0.125 * s);
    headPivot.add(lips);
  } else {
    // grin — the mascot is the artwork, never the emoji
    const eyeGeo = new THREE.SphereGeometry(0.028 * s, 7, 7);
    const eyeL = new THREE.Mesh(eyeGeo, DARK);
    const eyeR = new THREE.Mesh(eyeGeo, DARK);
    eyeL.position.set(-0.055 * s, 0.205 * s, 0.145 * s);
    eyeR.position.set(0.055 * s, 0.205 * s, 0.145 * s);
    const mouth = new THREE.Mesh(
      new THREE.TorusGeometry(0.075 * s, 0.016 * s, 6, 14, Math.PI),
      DARK,
    );
    mouth.rotation.x = Math.PI;
    mouth.position.set(0, 0.155 * s, 0.15 * s);
    headPivot.add(eyeL, eyeR, mouth);
  }

  // --- arms, pivoting at the shoulders
  const mkArm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.24 * s * w, 0.48 * s, 0);
    const upper = capsule(0.055 * s * w, 0.2 * s, material);
    upper.position.y = -0.14 * s;
    upper.castShadow = true;
    const fore = capsule(0.05 * s * w, 0.18 * s, material);
    fore.position.y = -0.36 * s;
    fore.castShadow = true;
    pivot.add(upper, fore);
    hips.add(pivot);
    return pivot;
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);

  // --- legs, pivoting at the hips
  const mkLeg = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.11 * s * w, 0, 0);
    const thigh = capsule(0.08 * s * w, 0.22 * s, material);
    thigh.position.y = -0.22 * s;
    thigh.castShadow = true;
    const shin = capsule(0.065 * s * w, 0.24 * s, material);
    shin.position.y = -0.6 * s;
    shin.castShadow = true;
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.12 * s * w, 0.08 * s, 0.22 * s),
      material,
    );
    foot.position.set(0, -0.86 * s, 0.05 * s);
    foot.castShadow = true;
    pivot.add(thigh, shin, foot);
    hips.add(pivot);
    return pivot;
  };
  const legL = mkLeg(-1);
  const legR = mkLeg(1);

  // --- weapon, carried in the right hand
  let gunMesh = null;
  if (gun) {
    gunMesh = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a2c28, roughness: 0.5, metalness: 0.6 });
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.07 * s, 0.1 * s, 0.44 * s), bodyMat);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016 * s, 0.016 * s, 0.3 * s, 8), bodyMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = -0.34 * s;
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04 * s, 0.15 * s, 0.06 * s), bodyMat);
    mag.position.set(0, -0.11 * s, -0.02 * s);
    gunMesh.add(receiver, barrel, mag);
    gunMesh.position.set(0, -0.44 * s, -0.12 * s);
    armR.add(gunMesh);
  }

  return {
    root,
    parts: { hips, torso, chest, headPivot, head, armL, armR, legL, legR, gun: gunMesh },
    scale: s,
    hipY,
  };
}

/* Pose the rig. `phase` advances with movement; `lower` is 0..1 how far the
   body is crouched (1 = prone). */
export function poseHumanoid(rig, { phase = 0, moving = false, pitch = 0, lower = 0, dt = 0.016, zombie = false }) {
  const p = rig.parts;
  const s = rig.scale;

  const swing = moving ? Math.sin(phase) * 0.75 : 0;
  const lift = moving ? Math.abs(Math.cos(phase)) * 0.25 : 0;

  p.legL.rotation.x = swing;
  p.legR.rotation.x = -swing;

  if (zombie) {
    // both arms out front, with a lopsided shamble
    p.armL.rotation.x = -1.5 + Math.sin(phase * 0.5) * 0.12;
    p.armR.rotation.x = -1.42 + Math.cos(phase * 0.5) * 0.12;
    p.armL.rotation.z = 0.12;
    p.armR.rotation.z = -0.18;
    p.headPivot.rotation.x = 0.16;
    p.headPivot.rotation.z = Math.sin(phase * 0.5) * 0.09;
    p.torso.rotation.x = 0.14;
    p.chest.rotation.x = 0.14;
    p.hips.position.y = rig.hipY - Math.abs(Math.sin(phase)) * 0.045 * s;
    return;
  }

  p.armL.rotation.x = -swing * 0.55 - 0.15;

  // the shooting arm stays up and tracks the aim
  p.armR.rotation.x = -1.25 - pitch * 0.7;
  p.armR.rotation.z = -0.15;

  p.headPivot.rotation.x = -pitch * 0.55;

  // crouching drops the hips and folds the knees
  const crouch = Math.max(0, Math.min(1, lower));
  p.hips.position.y = rig.hipY * (1 - crouch * 0.55) + lift * 0.02 * s;
  p.legL.rotation.x += crouch * 0.9;
  p.legR.rotation.x += crouch * 0.9;
  p.torso.rotation.x = crouch * 0.35;
  p.chest.rotation.x = crouch * 0.35;
}
