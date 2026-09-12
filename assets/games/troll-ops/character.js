// Troll Ops — articulated humanoid characters.
//
// One rig serves every operator/enemy on screen (PvP operators, horde
// grunts, zombies, and the lobby locker viewer): a hub where thin stick
// limbs meet, a head that carries the real trollface artwork, two arms
// and two legs, each on its own pivot so they can be posed and animated.
// The caller supplies the material for the LIMBS (so grunts can drive
// them through their dissolve shader) - the head always uses the real
// trollface texture, never a per-caller material, matching the
// site-wide mascot rule (assets/images/wallpaper/trollface transparent.png,
// the same "Trollge" stick-figure look built for the shared Blender/Godot
// rig in trollface-characters/tools/build_trollface_character.py).
//
// The root sits at the FEET and is rotated by yaw, matching how positions are
// tracked everywhere else in the game.

import * as THREE from "three";

const DARK = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
const HAND_MAT = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.6 });
// Feet get their own darker tone (a "shoe") distinct from the pale mitten
// hands - sharing one light color meant a hand caught mid-swing near the
// hip, at a glance, read as a third foot next to the real two.
const FOOT_MAT = new THREE.MeshStandardMaterial({ color: 0x2c2c2e, roughness: 0.7 });

// One texture load, one material, shared by every head in the game -
// loaded once at module scope rather than per-rig.
const TEXTURE_LOADER = new THREE.TextureLoader();
const TROLLFACE_TEXTURE = TEXTURE_LOADER.load(
  new URL("../../images/wallpaper/trollface%20transparent.png", import.meta.url).href,
);
TROLLFACE_TEXTURE.colorSpace = THREE.SRGBColorSpace;
const TROLLFACE_HEAD_MAT = new THREE.MeshStandardMaterial({
  map: TROLLFACE_TEXTURE,
  transparent: true,
  alphaTest: 0.3,
  side: THREE.DoubleSide,
  roughness: 0.7,
});

/* A thin stick limb from `from` to `to`, capped with spheres so the joint
   where it meets another limb doesn't show a hard seam. */
function stick(from, to, radius, mat) {
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const mid = start.clone().add(end).multiplyScalar(0.5);
  const length = start.distanceTo(end);

  const group = new THREE.Group();
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 8), mat);
  const capTop = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), mat);
  const capBottom = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), mat);
  capTop.position.y = length / 2;
  capBottom.position.y = -length / 2;
  cyl.add(capTop, capBottom);
  cyl.castShadow = true;
  group.add(cyl);

  group.position.copy(mid);
  group.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    end.clone().sub(start).normalize(),
  );
  return group;
}

/* Build a humanoid `height` metres tall. Returns the root plus every part the
   animator needs to pose. Contract kept identical to the previous blocky rig
   (same `parts` keys, same pose semantics) so remote-players.js, enemies.js,
   zombies.js and char-inspector.js need no changes - only the geometry
   underneath is now the stick-figure trollface look. */
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

  const limbRadius = 0.032 * s * w;

  // --- torso: a single thin spine stick, hip to shoulder. Kept as its own
  // pivot (poseHumanoid rotates it for lean/crouch) even though visually
  // it is now just another stick, not a capsule + box.
  const torso = stick([0, 0, 0], [0, 0.48 * s, 0], limbRadius * 1.15, material);
  torso.castShadow = true;
  hips.add(torso);

  // `chest` no longer needs its own mesh - the stick-figure look has no
  // torso mass distinct from the spine - but poseHumanoid still rotates
  // it for the crouch lean, so it stays as an empty pivot group at the
  // same height so that rotation still visibly bends the upper spine.
  const chest = new THREE.Group();
  chest.position.y = 0.48 * s;
  hips.add(chest);

  // --- neck: a short visible stick between chest and head, matching the
  // Blender/Godot rig's Neck bone (trollface-characters/tools/
  // build_trollface_character.py). Its own pivot so poseHumanoid can lead
  // a head-turn/idle sway with the neck slightly ahead of the full head
  // pitch, instead of the head just floating on the chest with no joint.
  const neckLen = 0.09 * s;
  const neckPivot = new THREE.Group();
  chest.add(neckPivot);
  const neck = stick([0, 0, 0], [0, neckLen, 0], limbRadius * 0.9, material);
  neck.castShadow = true;
  neckPivot.add(neck);

  // --- head, on its own group so it can look up and down. The head
  // itself is the flat trollface board (see build_trollface_character.py
  // for the Blender/Godot equivalent) - a thin plane carrying the real
  // artwork, not a modeled face.
  const headPivot = new THREE.Group();
  headPivot.position.y = neckLen;
  neckPivot.add(headPivot);

  const headW = 0.34 * s;
  const headH = 0.32 * s;
  const head = new THREE.Mesh(
    new THREE.PlaneGeometry(headW, headH),
    TROLLFACE_HEAD_MAT,
  );
  head.position.y = headH * 0.5 + 0.03 * s;
  head.castShadow = true;
  head.userData.isHead = true;
  headPivot.add(head);

  if (face === "pepe") {
    // Bulging eyes set high and wide, with a broad flat frog mouth -
    // this face variant predates the trollface-board head and still
    // draws its own procedural features rather than a texture.
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
    head.visible = false;
  }

  // --- arms, pivoting at the shoulders. Thin sticks meeting near the
  // spine top, flat mitten hands - the "Trollge" silhouette.
  const mkArm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.05 * s * w, 0.48 * s, 0);
    const arm = stick([0, 0, 0], [side * 0.30 * s * w, -0.62 * s, 0], limbRadius, material);
    arm.castShadow = true;
    const hand = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.06 * s, 0.03 * s, 10), HAND_MAT);
    hand.position.set(side * 0.30 * s * w, -0.62 * s, 0);
    hand.rotation.x = Math.PI / 2;
    pivot.add(arm, hand);
    hips.add(pivot);
    return pivot;
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);

  // --- legs, pivoting at the hips. Same thin-stick treatment as the
  // arms, with a small flat foot stub.
  const mkLeg = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.02 * s * w, 0, 0);
    const leg = stick([0, 0, 0], [side * 0.16 * s * w, -0.86 * s, 0], limbRadius, material);
    leg.castShadow = true;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.07 * s * w, 0.05 * s, 0.16 * s), FOOT_MAT);
    foot.position.set(side * 0.16 * s * w, -0.86 * s, 0.03 * s);
    pivot.add(leg, foot);
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
    gunMesh.position.set(0.30 * s * w, -0.62 * s - 0.12 * s, -0.12 * s);
    armR.add(gunMesh);
  }

  return {
    root,
    parts: { hips, torso, chest, neckPivot, headPivot, head, armL, armR, legL, legR, gun: gunMesh },
    scale: s,
    hipY,
  };
}

/* Pose the rig. `phase` advances with movement; `lower` is 0..1 how far the
   body is crouched (1 = prone). `strafe` is -1..1, the mover's LOCAL
   sideways velocity component (negative = moving left, positive = right,
   0 = pure forward/back or standing still) - it drives the lean/splay that
   makes strafing read differently from walking straight ahead. Callers
   that only ever move straight at a target (enemies.js, zombies.js) can
   omit it and get the old forward-only cycle for free. */
export function poseHumanoid(rig, { phase = 0, moving = false, pitch = 0, lower = 0, strafe = 0, dt = 0.016, zombie = false }) {
  const p = rig.parts;
  const s = rig.scale;
  const str = Math.max(-1, Math.min(1, strafe));

  const swing = moving ? Math.sin(phase) * 0.75 : 0;
  const lift = moving ? Math.abs(Math.cos(phase)) * 0.25 : 0;

  p.legL.rotation.x = swing;
  p.legR.rotation.x = -swing;

  // Strafing splays the lead leg out to the side it's stepping toward
  // instead of just swinging fore/aft - a sideways shuffle reads very
  // differently from a forward jog even at the same leg-swing speed.
  p.legL.rotation.z = str * 0.22;
  p.legR.rotation.z = str * 0.22;

  if (zombie) {
    // both arms out front, with a lopsided shamble
    p.armL.rotation.x = -1.5 + Math.sin(phase * 0.5) * 0.12;
    p.armR.rotation.x = -1.42 + Math.cos(phase * 0.5) * 0.12;
    p.armL.rotation.z = 0.12;
    p.armR.rotation.z = -0.18;
    p.torso.rotation.x = 0.14;
    p.chest.rotation.x = 0.14;
    p.hips.position.y = rig.hipY - Math.abs(Math.sin(phase)) * 0.045 * s;
    _poseNeckAndHead(rig, { pitch: 0.16, sway: Math.sin(phase * 0.5) * 0.09, dt, lead: 0 });
    return;
  }

  // Kept shy of hip height (peaks around -0.5 rad, well short of the legs'
  // reach) - swung further, the off-hand drops into the same screen space
  // as the legs and, sharing their thin-stick silhouette, reads as a third
  // leg from a low, close viewing angle.
  p.armL.rotation.x = -swing * 0.35 - 0.15;

  // the shooting arm stays up and tracks the aim
  p.armR.rotation.x = -1.25 - pitch * 0.7;
  p.armR.rotation.z = -0.15;

  // crouching drops the hips and folds the knees
  const crouch = Math.max(0, Math.min(1, lower));
  p.hips.position.y = rig.hipY * (1 - crouch * 0.55) + lift * 0.02 * s;
  p.legL.rotation.x += crouch * 0.9;
  p.legR.rotation.x += crouch * 0.9;

  // Body lean: forward while moving, banked into the strafe direction -
  // a real body committing sideways tips into the turn rather than
  // sliding like a statue on rails.
  const moveLean = moving ? 0.12 : 0;
  p.torso.rotation.x = crouch * 0.35 + moveLean;
  p.torso.rotation.z = str * -0.16;
  p.chest.rotation.x = crouch * 0.35 + moveLean * 0.6;
  p.chest.rotation.z = str * -0.10;
  p.hips.rotation.z = str * 0.08;

  _poseNeckAndHead(rig, { pitch, sway: 0, dt, lead: str });
}

/* Neck + head sub-pose, shared by the zombie and normal paths. The neck
   leans a little further into the strafe/idle sway than the head does
   ("lead") so a turn or idle shift visibly starts at the neck before the
   head settles into its final look angle a frame or two later - a head
   that moves in perfect lockstep with the neck/torso reads as one rigid
   piece instead of a jointed figure. */
function _poseNeckAndHead(rig, { pitch, sway, dt, lead }) {
  const p = rig.parts;
  p.neckPivot.rotation.x = -pitch * 0.15 + sway * 0.4;
  p.neckPivot.rotation.z = lead * 0.10;
  p.headPivot.rotation.x = -pitch * 0.55 + sway;
  p.headPivot.rotation.z = lead * 0.05;
}
