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
// Hands and feet match the rest of the limbs - black, matching the
// classic trollface stick-figure look - rather than the old pale mitten
// hands, which stood out as a lighter patch against the black arms/legs.
const HAND_MAT = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.6 });
const FOOT_MAT = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.7 });

// Shared by every invisible hit-proxy primitive (see buildHumanoid below).
// Never rendered, just needs to be a real material so raycasting works.
const HIT_PROXY_MAT = new THREE.MeshBasicMaterial({ visible: false });

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
  // A PlaneGeometry's default face normal is +Z, but the game's forward
  // convention (movement.js's forwardVec, root.rotation.y = yaw everywhere
  // this rig is placed) is -Z at yaw 0 — without this the trollface pointed
  // backward relative to the direction the character actually walks/aims.
  head.rotation.y = Math.PI;
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

  // --- hit proxies: invisible, generously-sized primitives used ONLY for
  // bullet raycasts. The visible rig above is a deliberately thin stick
  // figure (limbs a few cm across, head a flat plane) - true to the look,
  // but a needle-thin true hitbox makes the rig nearly unhittable at range
  // or with imprecise (controller) aim. These proxies are never rendered
  // (visible=false, no shadows) and follow the same bones the real limbs
  // do, so they track poseHumanoid for free.
  const makeHitProxy = (geo, parent, isHead) => {
    const m = new THREE.Mesh(geo, HIT_PROXY_MAT);
    m.visible = false;
    m.userData.isHitProxy = true;
    if (isHead) m.userData.isHead = true;
    parent.add(m);
    return m;
  };

  const hitHead = makeHitProxy(new THREE.SphereGeometry(0.19 * s, 8, 6), headPivot, true);
  hitHead.position.y = headH * 0.5 + 0.03 * s;

  const hitTorso = makeHitProxy(new THREE.CapsuleGeometry(0.16 * s * w, 0.42 * s, 4, 8), chest, false);
  hitTorso.position.y = 0.24 * s;

  const hitHips = makeHitProxy(new THREE.SphereGeometry(0.15 * s * w, 8, 6), hips, false);

  // Arm/leg sticks run from the pivot origin to [side*reach*s*w, -drop*s, 0];
  // the proxy capsule is centered on that stick's midpoint, matching mkArm/mkLeg above.
  const hitArmL = makeHitProxy(new THREE.CapsuleGeometry(0.075 * s * w, 0.5 * s, 4, 6), armL, false);
  hitArmL.position.set(-0.15 * s * w, -0.31 * s, 0);
  const hitArmR = makeHitProxy(new THREE.CapsuleGeometry(0.075 * s * w, 0.5 * s, 4, 6), armR, false);
  hitArmR.position.set(0.15 * s * w, -0.31 * s, 0);

  const hitLegL = makeHitProxy(new THREE.CapsuleGeometry(0.08 * s * w, 0.7 * s, 4, 6), legL, false);
  hitLegL.position.set(-0.08 * s * w, -0.43 * s, 0);
  const hitLegR = makeHitProxy(new THREE.CapsuleGeometry(0.08 * s * w, 0.7 * s, 4, 6), legR, false);
  hitLegR.position.set(0.08 * s * w, -0.43 * s, 0);

  const hitboxMeshes = [hitHead, hitTorso, hitHips, hitArmL, hitArmR, hitLegL, hitLegR];

  return {
    root,
    parts: { hips, torso, chest, neckPivot, headPivot, head, armL, armR, legL, legR, gun: gunMesh },
    hitboxMeshes,
    scale: s,
    hipY,
  };
}

/* Pose the rig. `phase` advances with movement; `lower` is 0..1 how far the
   body is crouched (1 = prone). `strafe` is -1..1, the mover's LOCAL
   sideways velocity component (negative = moving left, positive = right,
   0 = pure forward/back or standing still) - it drives the lean/splay that
   makes strafing read differently from walking straight ahead. `speed` is
   0..1, how fast the mover is going relative to a full sprint (1 = sprint,
   ~0.35-0.5 = a jog/walk) - it scales the whole cycle (stride length, arm
   swing, forward lean, vertical bob) so a walk and a sprint are visibly
   different gaits rather than the same animation just replayed faster.
   Callers that only ever move at one speed (enemies.js, zombies.js) can
   omit it; it defaults to a full-intensity cycle whenever `moving` is true,
   matching the old fixed-amplitude behavior. */
export function poseHumanoid(rig, { phase = 0, moving = false, pitch = 0, lower = 0, strafe = 0, forward = 1, speed = 1, dt = 0.016, zombie = false, gait: gaitTuning, hasGun = false }) {
  const p = rig.parts;
  const s = rig.scale;
  const str = Math.max(-1, Math.min(1, strafe));
  // Signed fore/aft component of actual travel relative to facing: 1 =
  // running forward, -1 = full backpedal, 0 = a pure sideways strafe.
  const fwd = Math.max(-1, Math.min(1, forward));
  const spd = moving ? Math.max(0.28, Math.min(1, speed)) : 0;

  // Optional live-tunable leg-gait constants (movement-lab.html only —
  // every other caller omits `gait` and gets these exact defaults, so
  // behavior elsewhere is unchanged).
  const gt = {
    swingBase: 0.55, swingSpeed: 0.45,
    sideStepBase: 0.35, sideStepSpeed: 0.3,
    liftBase: 0.15, liftSpeed: 0.2,
    splay: 0.22,
    ...gaitTuning,
  };

  // `gait` is the sign to swing the legs in: +1 running forward, -1
  // backpedaling. `fwdAmt` is how much of the cycle is fore/aft swing at
  // all - it fades toward 0 as travel becomes a pure sideways strafe, so
  // a strafing character steps side-to-side instead of still swinging its
  // legs through a full forward-jog arc with just a static lean/splay
  // bolted on top (the tangled, criss-crossing legs the old cycle produced
  // whenever real movement had a lateral component).
  const gaitSign = fwd < 0 ? -1 : 1;
  const fwdAmt = Math.min(1, Math.abs(fwd));
  const swing = moving ? Math.sin(phase) * (gt.swingBase + spd * gt.swingSpeed) * gaitSign * fwdAmt : 0;
  // The portion of the cycle that isn't fore/aft swing becomes a lateral
  // side-step: legs alternate stepping apart sideways instead of just
  // leaning into the strafe while standing square.
  const sideStep = moving ? Math.sin(phase) * (gt.sideStepBase + spd * gt.sideStepSpeed) * str * (1 - fwdAmt) : 0;
  const lift = moving ? Math.abs(Math.cos(phase)) * (gt.liftBase + spd * gt.liftSpeed) : 0;

  // poseDeath is the only other place that touches hips.rotation.x (it
  // pitches the whole body forward onto the ground as a kill collapses).
  // poseHumanoid must explicitly zero it back out on every frame, or a
  // rig that respawns after dying keeps that ~90° forward pitch forever -
  // walking and running upright from the waist down while the hips (and
  // everything stacked on them) stay tipped flat, legs trailing up behind
  // like it's still mid-collapse.
  p.hips.rotation.x = 0;

  p.legL.rotation.x = swing;
  p.legR.rotation.x = -swing;

  // Strafing splays the lead leg out to the side it's stepping toward
  // instead of just swinging fore/aft - a sideways shuffle reads very
  // differently from a forward jog even at the same leg-swing speed.
  p.legL.rotation.z = str * gt.splay + sideStep;
  p.legR.rotation.z = str * gt.splay - sideStep;

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

  // The gun arm holds a raised, level "ready" carry (barrel roughly
  // horizontal, across the body) instead of dangling down at the old
  // -1.02 rad angle - that read as the weapon pointing at the ground any
  // time the body leaned forward into a run. Pitch still nudges it for
  // aim legibility, clamped well short of vertical, and a small
  // counter-swing tied to footfall keeps the carry from looking welded
  // in place mid-stride.
  const carrySwing = moving ? Math.sin(phase) * 0.04 * spd * gaitSign * fwdAmt : 0;
  p.armR.rotation.x = -1.35 - pitch * 0.32 + carrySwing;
  p.armR.rotation.z = -0.15;

  if (hasGun) {
    // Support hand: a two-handed weapon is gripped, not swung, so armL
    // drops the run-cycle counter-pump and instead holds a fixed forward
    // reach toward the handguard — matched to where weapon-model.js's
    // buildSupportHand actually sits on the mesh armR carries. The same
    // small footfall-tied sway armR gets keeps the carry from reading as
    // welded in place mid-stride, just softer since a support grip moves
    // less than a free-swinging arm.
    p.armL.rotation.x = -1.28 - pitch * 0.28 + carrySwing * 0.6;
    p.armL.rotation.z = 0.18;
  } else {
    // Off-hand counter-swings opposite the legs, like a real running arm
    // pump: it's forward when the same-side leg is back, and vice versa.
    // Amplitude grows with speed - a walk barely swings the arms, a sprint
    // pumps them hard - and stays shy of hip height (peaks well short of
    // the legs' reach) so it doesn't read as a third leg from a low angle.
    p.armL.rotation.x = swing * (0.5 + spd * 0.55) - 0.15;
    p.armL.rotation.z = 0.04 + spd * 0.05;
  }

  // crouching drops the hips and folds the knees
  const crouch = Math.max(0, Math.min(1, lower));
  p.hips.position.y = rig.hipY * (1 - crouch * 0.55) + lift * 0.02 * s;
  p.legL.rotation.x += crouch * 0.9;
  p.legR.rotation.x += crouch * 0.9;

  // Body lean: forward while moving ahead (more at a sprint than a walk),
  // backward when backpedaling, banked into the strafe direction - a real
  // body committing sideways tips into the turn rather than sliding like
  // a statue on rails, and a body backpedaling leans away from travel
  // rather than diving face-first into the direction it's actually moving
  // away from.
  const moveLean = moving ? (0.05 + spd * 0.13) * gaitSign * fwdAmt : 0;
  p.torso.rotation.x = crouch * 0.35 + moveLean;
  p.torso.rotation.z = str * -0.16;
  p.chest.rotation.x = crouch * 0.35 + moveLean * 0.6;
  p.chest.rotation.z = str * -0.10;

  _poseNeckAndHead(rig, { pitch, sway: 0, dt, lead: str });
}

/* A looping victory/idle dance - the locker screen's answer to Fortnite's
   emote preview. `t` is seconds elapsed, runs forever (no start/end, just
   feed a growing clock). Built from a handful of layered sine waves at
   different rates rather than one single beat, so the loop doesn't read
   as a metronome: hips carry the main beat (bounce + side-to-side sway),
   shoulders/arms pump on the same beat with a bigger swing than any real
   footstep gait would use (a dance reads as looser and bigger than a
   walk), the head bobs slightly out of phase with the hips (a real
   dancer's head lags the hip snap by a beat), and the knees bend on the
   downbeat so the bounce comes from the whole body, not just the hips
   sliding up and down on rails. */
export function poseDance(rig, t) {
  const p = rig.parts;
  const s = rig.scale;
  const beat = t * Math.PI * 2 * 1.8; // ~1.8 bounces/second

  const bounce = Math.abs(Math.sin(beat)); // 0..1, snaps down on every beat
  const sway = Math.sin(beat * 0.5); // one full side-to-side per two bounces

  p.hips.position.y = rig.hipY - bounce * 0.09 * s;
  p.hips.rotation.z = sway * 0.16;
  p.hips.rotation.y = Math.sin(beat * 0.5 + Math.PI / 2) * 0.12;

  p.torso.rotation.z = sway * -0.12;
  p.torso.rotation.x = 0.06 + bounce * 0.04;
  p.chest.rotation.z = sway * -0.08;
  p.chest.rotation.x = 0.05 + bounce * 0.03;

  // Knees bend on the downbeat (both together, not alternating like a
  // walk cycle) so the bounce visibly comes from the legs, not just the
  // hips sliding vertically.
  const kneeBend = bounce * 0.5;
  p.legL.rotation.x = kneeBend;
  p.legR.rotation.x = kneeBend;
  p.legL.rotation.z = sway * 0.10;
  p.legR.rotation.z = sway * 0.10;

  // Arms swing big and opposite the hip sway, elbows-out disco-pump
  // rather than the tight, low running counter-swing poseHumanoid uses.
  const armSwing = Math.sin(beat * 0.5 + Math.PI);
  p.armL.rotation.x = -0.9 + armSwing * 0.5;
  p.armR.rotation.x = -0.9 - armSwing * 0.5;
  p.armL.rotation.z = 0.35 + bounce * 0.15;
  p.armR.rotation.z = -0.35 - bounce * 0.15;

  // Head bob trails the hip beat slightly (a fixed phase offset rather
  // than perfect lockstep) so the head reads as following the body's
  // motion instead of everything moving as one rigid block.
  const headBob = Math.sin(beat - 0.35);
  _poseNeckAndHead(rig, { pitch: -headBob * 0.12, sway: sway * 0.15, dt: 0, lead: sway * 0.3 });
}

/* Floss: hips swing one way, both arms swing the opposite way and cross in
   front on the offbeat — the actual shape of the dance, just built from the
   same single-segment arm bones as the rest of the rig instead of a real
   elbow. Faster than the disco bounce above; almost no vertical bob, all
   the motion is lateral. */
export function poseDanceFloss(rig, t) {
  const p = rig.parts;
  const beat = t * Math.PI * 2 * 2.2;
  const hipSway = Math.sin(beat);
  const armSway = Math.sin(beat + Math.PI); // opposite phase to the hips

  p.hips.rotation.z = hipSway * 0.22;
  p.hips.rotation.y = Math.sin(beat * 2) * 0.05;
  p.hips.position.y = rig.hipY - Math.abs(Math.sin(beat * 2)) * 0.02 * rig.scale;

  p.torso.rotation.z = hipSway * -0.14;
  p.chest.rotation.z = hipSway * -0.10;

  // Both arms swing together, low and wide, crossing the body — the
  // "floss" itself — rather than the opposite-arm-swing a walk cycle uses.
  p.armL.rotation.x = -0.3;
  p.armR.rotation.x = -0.3;
  p.armL.rotation.z = 0.5 + armSway * 0.55;
  p.armR.rotation.z = -0.5 + armSway * 0.55;

  p.legL.rotation.z = hipSway * 0.06;
  p.legR.rotation.z = hipSway * 0.06;

  _poseNeckAndHead(rig, { pitch: 0.04, sway: hipSway * 0.22, dt: 0, lead: hipSway * 0.2 });
}

/* Headbang: almost all the motion is the head and chest, hips barely move —
   the opposite weighting from the floss/disco moves above, so cycling
   between them reads as different dances rather than the same skeleton
   playing back faster or slower. */
export function poseDanceHeadbang(rig, t) {
  const p = rig.parts;
  const beat = t * Math.PI * 2 * 2.6;
  const nod = Math.max(0, Math.sin(beat)); // snaps down, eases up

  p.hips.position.y = rig.hipY - nod * 0.03 * rig.scale;
  p.torso.rotation.x = 0.1 + nod * 0.22;
  p.chest.rotation.x = 0.08 + nod * 0.3;

  const armPump = Math.sin(beat * 0.5);
  p.armL.rotation.x = -0.6 + armPump * 0.3;
  p.armR.rotation.x = -0.6 - armPump * 0.3;
  p.armL.rotation.z = 0.2;
  p.armR.rotation.z = -0.2;

  p.legL.rotation.x = nod * 0.12;
  p.legR.rotation.x = nod * 0.12;

  _poseNeckAndHead(rig, { pitch: -nod * 0.5, sway: Math.sin(beat * 0.5) * 0.08, dt: 0, lead: 0 });
}

/* Arm-wave: one arm raised and circling overhead while the hips sway low
   and slow underneath — reads as a completely different silhouette from
   the other three (raised arm) rather than another variation on a bounce. */
export function poseDanceWave(rig, t) {
  const p = rig.parts;
  const beat = t * Math.PI * 2 * 1.1;
  const sway = Math.sin(beat * 0.6);
  const circle = beat * 1.4;

  p.hips.position.y = rig.hipY - Math.abs(Math.sin(beat * 1.2)) * 0.03 * rig.scale;
  p.hips.rotation.z = sway * 0.1;
  p.torso.rotation.z = sway * -0.08;
  p.chest.rotation.z = sway * -0.06;

  // Raised arm sweeps a small circle overhead — capped near straight-up
  // (-PI/2) rather than past vertical, so the hand stays within the
  // character's own silhouette instead of pushing the reach higher than
  // the head and widening the frame the hero shot has to fit.
  p.armR.rotation.x = -1.7 + Math.sin(circle) * 0.3;
  p.armR.rotation.z = -0.3 + Math.cos(circle) * 0.3;
  // Other arm keeps a loose, low sway so it doesn't read as frozen.
  p.armL.rotation.x = -0.35 + sway * 0.15;
  p.armL.rotation.z = 0.3;

  p.legL.rotation.z = sway * 0.07;
  p.legR.rotation.z = sway * 0.07;

  _poseNeckAndHead(rig, { pitch: -0.05, sway: sway * 0.18, dt: 0, lead: sway * 0.15 });
}

/* Every available locker emote, in the order the inspector cycles them. */
export const DANCES = [poseDance, poseDanceFloss, poseDanceHeadbang, poseDanceWave];

/* Collapse the rig into a fallen heap. `t` is 0 (moment of death) to 1
   (fully down); callers drive it up over ~0.5-0.6s then hide the rig. Tips
   the whole body over sideways onto the ground and folds the limbs rather
   than just freezing the last standing pose or popping out of existence —
   a body that stays upright or vanishes instantly reads as a UI toggle,
   not a kill. */
export function poseDeath(rig, t) {
  const p = rig.parts;
  const k = Math.max(0, Math.min(1, t));
  const ease = 1 - Math.pow(1 - k, 3);

  p.hips.rotation.x = ease * (Math.PI / 2);
  p.hips.rotation.z = 0.35 * ease;
  p.hips.position.y = rig.hipY * (1 - ease * 0.92);

  p.torso.rotation.x = ease * 0.3;
  p.chest.rotation.x = ease * 0.2;

  p.legL.rotation.x = ease * 0.5;
  p.legR.rotation.x = -ease * 0.3;
  p.legL.rotation.z = ease * 0.2;
  p.legR.rotation.z = -ease * 0.15;

  p.armL.rotation.x = -0.2 - ease * 0.9;
  p.armR.rotation.x = -0.2 - ease * 0.7;
  p.armL.rotation.z = ease * 0.4;
  p.armR.rotation.z = -ease * 0.3;

  p.neckPivot.rotation.x = ease * 0.6;
  p.headPivot.rotation.x = ease * 0.4;
  p.headPivot.rotation.z = ease * 0.5;
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
