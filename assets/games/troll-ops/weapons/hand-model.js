// Troll Forces — procedural viewmodel hand.
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


/* ------------------------------------------------------------------------
   Trollface hands (user call, 2026-09-27): drawn like the mascot art —
   white fill, black ink outline — and shaped like actual hands: a palm,
   four fingers of three rounded segments each, a two-joint thumb and
   nails, all posable. Shared by every first-person arm (game.js streak and
   inspect arms) and the grip/support hands below, so they never drift.
   ------------------------------------------------------------------------ */
export const HAND_WHITE = 0xf4f4f0;
export const HAND_SHADE = 0xe4e4de;
export const HAND_INK = 0x0a0a0a;
export const SLEEVE_BLACK = 0x161616;

let inkMat = null;
function ink() {
  if (!inkMat) inkMat = new THREE.MeshBasicMaterial({ color: HAND_INK, side: THREE.BackSide });
  return inkMat;
}

/* The black line work: a back-face shell just outside every mesh under
   `root` (the inverted-hull trick — one extra draw per part, no post pass).
   `thickness` is metres, applied per axis so a thin finger gets the same
   line weight as the palm. Meshes tagged userData.noInk (nails) skip it. */
export function inkOutline(root, thickness = 0.0034) {
  const meshes = [];
  root.traverse((o) => { if (o.isMesh && !o.userData.ink && !o.userData.noInk) meshes.push(o); });
  for (const m of meshes) {
    const g = m.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const size = g.boundingBox.getSize(new THREE.Vector3());
    const shell = new THREE.Mesh(g, ink());
    shell.userData.ink = true;
    shell.castShadow = false;
    shell.frustumCulled = m.frustumCulled;
    shell.scale.set(
      1 + (2 * thickness) / Math.max(1e-4, size.x),
      1 + (2 * thickness) / Math.max(1e-4, size.y),
      1 + (2 * thickness) / Math.max(1e-4, size.z),
    );
    m.add(shell);
  }
  return root;
}

export function handMaterials() {
  return {
    skin: new THREE.MeshStandardMaterial({ color: HAND_WHITE, roughness: 0.78, metalness: 0 }),
    shade: new THREE.MeshStandardMaterial({ color: HAND_SHADE, roughness: 0.78, metalness: 0 }),
    sleeve: new THREE.MeshStandardMaterial({ color: SLEEVE_BLACK, roughness: 0.9, metalness: 0 }),
    cuff: new THREE.MeshStandardMaterial({ color: HAND_WHITE, roughness: 0.85, metalness: 0 }),
    nail: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0 }),
  };
}

/* A rounded segment lying along -Z from its joint, `len` long. */
function segment(r, len, mat) {
  // Body length len - r: the rounded ends overlap the neighbouring segment
  // by r, so a finger reads as one continuous digit, not a bead chain.
  const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len - r), 4, 12);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, -len / 2);
  return new THREE.Mesh(g, mat);
}

/* Hand frame: the wrist is at +Z, fingers run toward -Z, the palm faces -Y
   (back of the hand +Y). A right hand's thumb is on -X; `side` -1 builds
   the left hand as a mirror. */
const FINGERS = [
  // x at the knuckle, segment lengths (proximal, middle, tip), radius
  { x: -0.0225, lens: [0.034, 0.023, 0.02], r: 0.0074 },   // index
  { x: -0.0075, lens: [0.037, 0.025, 0.021], r: 0.0077 },  // middle
  { x: 0.0075, lens: [0.035, 0.023, 0.02], r: 0.0073 },    // ring
  { x: 0.0215, lens: [0.028, 0.018, 0.017], r: 0.0064 },   // pinky
];
const PALM = { w: 0.066, l: 0.07, t: 0.024 };

export function buildHumanHand(side = 1, mats = handMaterials()) {
  const hand = new THREE.Group();
  const inner = new THREE.Group();
  inner.scale.x = side;               // mirror for the left hand
  hand.add(inner);

  // Palm: a flattened ellipsoid (no hard box edges), a little wider at the
  // knuckles than the wrist, with a knuckle bump at each finger root.
  const pg = new THREE.SphereGeometry(1, 20, 14);
  const pos = pg.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    pos.setX(i, pos.getX(i) * (1 - z * 0.12));        // -z (knuckle end) wider
  }
  pg.computeVertexNormals();
  const palm = new THREE.Mesh(pg, mats.skin);
  palm.scale.set(PALM.w / 2, PALM.t / 2, PALM.l / 2);
  inner.add(palm);
  for (const f of FINGERS) {
    const k = new THREE.Mesh(new THREE.SphereGeometry(f.r * 1.15, 12, 8), mats.skin);
    k.position.set(f.x, 0.004, -PALM.l / 2 + 0.008);
    inner.add(k);
  }

  const fingers = [];
  for (const f of FINGERS) {
    const joints = [];
    let parent = inner;
    let at = new THREE.Vector3(f.x, 0.002, -PALM.l / 2 + 0.008);
    for (let k = 0; k < 3; k++) {
      const j = new THREE.Group();
      j.position.copy(at);
      parent.add(j);
      const seg = segment(f.r * (1 - k * 0.07), f.lens[k], k === 0 ? mats.skin : mats.shade);
      j.add(seg);
      if (k === 2) {
        const nail = new THREE.Mesh(new THREE.BoxGeometry(f.r * 1.3, 0.002, f.lens[2] * 0.5), mats.nail);
        nail.position.set(0, f.r * 0.86, -f.lens[2] * 0.6);
        nail.userData.noInk = true;
        j.add(nail);
      }
      joints.push(j);
      parent = j;
      at = new THREE.Vector3(0, 0, -f.lens[k]);
    }
    fingers.push(joints);
  }

  // Thumb: a pivot on the palm's thumb side, a fat base and two joints.
  const thumbBase = new THREE.Group();
  thumbBase.position.set(-PALM.w / 2 + 0.004, -0.004, 0.012);
  inner.add(thumbBase);
  const tb = segment(0.0115, 0.03, mats.skin);
  thumbBase.add(tb);
  const t1 = new THREE.Group();
  t1.position.set(0, 0, -0.03);
  thumbBase.add(t1);
  t1.add(segment(0.0098, 0.024, mats.skin));
  const t2 = new THREE.Group();
  t2.position.set(0, 0, -0.024);
  t1.add(t2);
  t2.add(segment(0.0092, 0.021, mats.shade));
  const tnail = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.002, 0.011), mats.nail);
  tnail.position.set(0, 0.0086, -0.013);
  tnail.userData.noInk = true;
  t2.add(tnail);

  inkOutline(inner);
  inner.traverse((o) => { if (o.isMesh) o.castShadow = false; });

  hand.userData.rig = { fingers, thumb: [thumbBase, t1, t2], side };
  return hand;
}

/* Pose presets. Finger curls are radians per joint (positive curls toward
   the palm); `spread` fans the fingers; thumb is [yaw out from the palm,
   pitch down, joint 1, joint 2]. */
export const HAND_POSES = {
  relaxed: { curl: [[0.25, 0.3, 0.2], [0.28, 0.32, 0.2], [0.3, 0.35, 0.22], [0.35, 0.4, 0.25]], spread: 0.06, thumb: [0.55, 0.3, 0.15, 0.15] },
  fist: { curl: [[1.45, 1.55, 1.0], [1.5, 1.6, 1.0], [1.5, 1.6, 1.0], [1.45, 1.55, 1.0]], spread: 0, thumb: [0.25, 0.9, 0.5, 0.4] },
  // Hold a tablet by its side: fingers wrap round behind it, the thumb lies
  // in across the front bezel (how you really carry one; the thumb is what
  // taps CONFIRM).
  grip: { curl: [[1.2, 1.2, 0.6], [1.2, 1.2, 0.6], [1.2, 1.2, 0.6], [1.2, 1.2, 0.6]], spread: 0.02, thumb: [0.7, 0.7, 0.3, 0.2] },
  // Palm up under the drone, fingers lightly curled up its sides.
  cup: { curl: [[0.55, 0.45, 0.25], [0.55, 0.45, 0.25], [0.6, 0.45, 0.25], [0.65, 0.5, 0.3]], spread: 0.1, thumb: [0.7, 0.2, 0.25, 0.2] },
};

/* Apply a pose (optionally blending thumb joint 1/2 extra curl, for a
   press). Cheap: a few dozen Euler writes. */
export function poseHumanHand(hand, pose, thumbPress = 0) {
  const rig = hand.userData.rig;
  const p = HAND_POSES[pose] || HAND_POSES.relaxed;
  for (let i = 0; i < 4; i++) {
    const [a, b, c] = p.curl[i];
    const js = rig.fingers[i];
    js[0].rotation.set(-a, (1.5 - i) * p.spread, 0);
    js[1].rotation.set(-b, 0, 0);
    js[2].rotation.set(-c, 0, 0);
  }
  const [yaw, pitch, c1, c2] = p.thumb;
  const tp = p.press === "index" ? 0 : thumbPress;
  rig.thumb[0].rotation.set(-pitch, yaw, 0, "YXZ");
  rig.thumb[1].rotation.set(-(c1 + tp * 0.5), 0, 0);
  rig.thumb[2].rotation.set(-(c2 + tp * 0.6), 0, 0);
  if (p.press === "index" && thumbPress > 0) {
    // A tap: the index lifts off the bezel and comes back down on it.
    const lift = Math.sin(Math.min(1, thumbPress) * Math.PI);
    rig.fingers[0][0].rotation.x += lift * 0.35;
    rig.fingers[0][1].rotation.x += lift * 0.45;
  }
}

const SKIN = HAND_WHITE;
const SKIN_DARK = HAND_SHADE;

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

  inkOutline(group, 0.0022 * s);
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

  inkOutline(group, 0.0022 * s);
  group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return group;
}

/* Where a hand sits on a streak device, per grip style, in the device
   anchor's frame (right hand; the left mirrors across X). Given as "the
   fingers point this way, the palm faces that way" because that's how you
   reason about a grip; placeHand() turns it into a rotation. */
export const HAND_GRIPS = {
  // Tablet edge, low on the side: palm against the edge, fingers up and
  // round the back, thumb across the front bezel.
  side: { pose: "grip", finger: [0, 0.7, -0.7], palm: [-1, 0, 0], pos: [0.035, -0.07, -0.02] },
  // Drone: palm up under the body, fingers forward and a little out.
  cup: { pose: "cup", finger: [0.3, 0.15, -1], palm: [0, 1, 0], pos: [0.0, -0.014, 0.022] },
  // Marker: a fist round the upright can from behind, thumb on top.
  wrap: { pose: "fist", finger: [1, 0, -0.3], palm: [-0.6, 0.2, -1], pos: [0.004, -0.01, 0.03] },
};

const _gf = new THREE.Vector3(), _gp = new THREE.Vector3(), _gx = new THREE.Vector3();
const _gm = new THREE.Matrix4(), _gq = new THREE.Quaternion(), _ga = new THREE.Quaternion();
const _gpos = new THREE.Vector3();

/* Pose `hand` (a buildHumanHand) onto `anchor` for `style`. Both live under
   the same identity-transformed viewmodel rig, so world space is rig space. */
export function placeHand(hand, anchor, style, side = 1, thumbPress = 0) {
  const g = HAND_GRIPS[style];
  _gf.set(g.finger[0] * side, g.finger[1], g.finger[2]).normalize();
  _gp.set(g.palm[0] * side, g.palm[1], g.palm[2]);
  _gp.addScaledVector(_gf, -_gp.dot(_gf)).normalize();       // palm ⟂ fingers
  const z = _gf.clone().negate(), y = _gp.clone().negate();
  _gx.crossVectors(y, z);
  // Mirroring the grip vectors for the left hand flips this cross product
  // too, which lands on the mirrored hand's thumb side, as it should.
  _gm.makeBasis(_gx, y, z);
  _gq.setFromRotationMatrix(_gm);
  anchor.getWorldQuaternion(_ga);
  anchor.getWorldPosition(hand.position);
  _gpos.set(g.pos[0] * side, g.pos[1], g.pos[2]).applyQuaternion(_ga);
  hand.position.add(_gpos);
  hand.quaternion.copy(_ga).multiply(_gq);
  poseHumanHand(hand, g.pose, thumbPress);
}

/* The wrist end of a placed hand, in rig space — where the forearm starts. */
export function handWrist(hand, out) {
  return out.set(0, 0, PALM.l / 2 + 0.006).applyQuaternion(hand.quaternion).add(hand.position);
}
