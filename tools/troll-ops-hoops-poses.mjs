// Troll Forces, Troll Beach 5d: the court clips' keyframes, as data.
//
// Each clip is { length, loop, meta, keys: [{ t, markers?, ease?, pose }] },
// a pose being { joint: [x, y, z] degrees (Euler XYZ, the joint's local
// turn, as CFrame.Angles takes it) | { r: [x, y, z], p: [x, y, z] } (hips:
// a slide in metres) }. Joints a pose leaves out stay at rest.
//
// The rig faces -z, its right is +x. On an arm or a leg, +x swings it
// forward; on the right arm +z raises it out to the side (the left, -z);
// on the torso, -x leans forward; on a knee, -x bends it.
//
// They're authored here and built in Roblox Studio on TF_Rig ("Troll Forces
// Anims (edit).rbxlx": tools/troll-ops-hoops-clips.mjs writes the Luau that
// makes each KeyframeSequence), then exported through
// tools/troll-ops-roblox-anim.mjs as usual. toClipJson() makes the same clip
// straight from the table, for the pose lab (tools/troll-ops-pose-lab.mjs).

const D = Math.PI / 180;

/* Euler XYZ (degrees) -> quaternion [x, y, z, w], three's order. */
export function quat([ax, ay, az]) {
  const c1 = Math.cos(ax * D / 2), c2 = Math.cos(ay * D / 2), c3 = Math.cos(az * D / 2);
  const s1 = Math.sin(ax * D / 2), s2 = Math.sin(ay * D / 2), s3 = Math.sin(az * D / 2);
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3,
    c1 * c2 * c3 - s1 * s2 * s3,
  ].map((v) => +v.toFixed(5));
}

const EASE = { linear: 0, constant: 3, in: 6, out: 7, inout: 8 };

/* A clip table -> the game's clip JSON (characters/clips/<name>.json). */
export function toClipJson(name, C) {
  const joints = new Set();
  for (const k of C.keys) for (const j in k.pose) joints.add(j);
  const out = {};
  for (const j of joints) {
    const q = [], p = [], ease = [];
    let slides = false;
    for (const k of C.keys) {
      const v = k.pose[j];
      const r = !v ? [0, 0, 0] : Array.isArray(v) ? v : v.r || [0, 0, 0];
      q.push(...quat(r));
      const pp = v && !Array.isArray(v) && v.p ? v.p : [0, 0, 0];
      if (v && !Array.isArray(v) && v.p) slides = true;
      p.push(...pp);
      ease.push(EASE[k.ease || "inout"]);
    }
    out[j] = { q, ...(slides ? { p } : {}), ease };
  }
  const markers = [];
  for (const k of C.keys) for (const m of k.markers || []) markers.push({ name: m, t: k.t });
  return {
    name, source: `tools/troll-ops-hoops-poses.mjs ${name}`, meta: C.meta || "", length: C.length, loop: !!C.loop,
    times: C.keys.map((k) => k.t), markers, joints: out,
  };
}

/* ------------------------------------------------------------ helpers */

const add = (...ps) => Object.assign({}, ...ps);
/* A pose mirrored left for right: names swapped, y and z turns negated, a
   slide's x negated. */
const SWAP = { R: "L", L: "R" };
function mirrorPose(p) {
  const o = {};
  for (const [j, v] of Object.entries(p)) {
    const m = j.replace(/[RL]$/, (c) => SWAP[c]);
    const flip = (r) => [r[0], -r[1], -r[2]];
    o[m] = Array.isArray(v) ? flip(v) : { r: flip(v.r || [0, 0, 0]), ...(v.p ? { p: [-v.p[0], v.p[1], v.p[2]] } : {}) };
  }
  return o;
}
const mirror = (C) => ({ ...C, meta: `${C.meta} (mirrored)`, keys: C.keys.map((k) => ({ ...k, pose: mirrorPose(k.pose) })) });

/* The legs and trunk of a basketball stance: knees bent, chest over the
   toes, eyes up the floor. `low` 0..1 sinks it. */
function stance(low = 0.5, lean = -12) {
  const h = 18 + 30 * low, k = -(30 + 50 * low);
  return {
    hips: { r: [0, 0, 0], p: [0, -(0.03 + 0.12 * low), 0] },
    torso: [lean, 0, 0], chest: [-4, 0, 0], headPivot: [-lean * 0.8, 0, 0],
    hipR: [h, 0, 6], hipL: [h, 0, -6], kneeR: [k, 0, 0], kneeL: [k, 0, 0], ankleR: [-(h + k), 0, 0], ankleL: [-(h + k), 0, 0],
  };
}
/* The off arm up as a bar, guarding the ball. */
const GUARD_L = { armL: [46, 0, -10], elbowL: [44, 0, 20], wristL: [0, 0, 0] };
/* The ball hand: at the top of the bounce (waist, forearm level), or
   pushing it down (arm long, toward the floor by the right foot). */
const TOP_R = { armR: [22, 0, 14], elbowR: [58, 0, 0], wristR: [-20, 0, 0] };
const PUSH_R = { armR: [10, 0, 16], elbowR: [14, 0, 0], wristR: [-35, 0, 0] };
/* Both hands on the ball at the chest (the gather, the triple threat). */
const CHEST = { armR: [48, 0, -6], elbowR: [86, 0, -20], armL: [48, 0, 6], elbowL: [86, 0, 20], wristR: [0, 0, 0], wristL: [0, 0, 0] };
/* The shooting pocket: ball up over the right eye, elbow under it, the
   guide hand on its side. */
const SET_POINT = { armR: [108, 0, 8], elbowR: [76, 0, 0], wristR: [-55, 0, 0], armL: [100, 0, -18], elbowL: [70, 0, 30] };

const DRIBBLE_R = {
  length: 0.5, loop: true, meta: "loop 0.5 s; one bounce, right hand: top, push (bounce at 0.2), catch",
  keys: [
    { t: 0, pose: add(stance(0.55), TOP_R, GUARD_L) },
    { t: 0.18, markers: ["push"], pose: add(stance(0.6), PUSH_R, GUARD_L) },
    { t: 0.5, pose: add(stance(0.55), TOP_R, GUARD_L) },
  ],
};
const DRIBBLE_L = mirror(DRIBBLE_R);
DRIBBLE_L.meta = "loop 0.5 s; one bounce, left hand";

export const CLIPS = {
  "hoop-dribble-r": DRIBBLE_R,
  "hoop-dribble-l": DRIBBLE_L,

  // the crossover: right hand drags it low across the front to the left;
  // the shoulders dip and the hips swing with it
  "hoop-cross": { length: 0.34, meta: "one shot 0.34 s: right to left, low; bounce at 0.14", keys: [
    { t: 0, pose: add(stance(0.55), TOP_R, GUARD_L) },
    { t: 0.14, markers: ["bounce"], pose: add(stance(0.75, -18), { torso: [-18, 12, -6] }, { armR: [18, 0, -14], elbowR: [26, 0, -30], wristR: [-30, 0, 0] }, { armL: [16, 0, -18], elbowL: [30, 0, 0] }) },
    { t: 0.34, pose: add(stance(0.6), mirrorPose(TOP_R), mirrorPose(GUARD_L)) },
  ] },

  // behind the back: the right hand swings it round the hips to the left
  "hoop-behind": { length: 0.42, meta: "one shot 0.42 s: right to left behind the back; bounce at 0.22", keys: [
    { t: 0, pose: add(stance(0.55), TOP_R, GUARD_L) },
    { t: 0.12, pose: add(stance(0.6, -20), { armR: [-30, 0, 18], elbowR: [40, 0, 0], wristR: [-20, 0, 0] }, GUARD_L) },
    { t: 0.22, markers: ["bounce"], pose: add(stance(0.65, -22), { torso: [-22, -10, 0] }, { armR: [-48, -20, -20], elbowR: [70, 0, -40] }, { armL: [10, 0, -30], elbowL: [30, 0, 0] }) },
    { t: 0.42, pose: add(stance(0.6), mirrorPose(TOP_R), mirrorPose(GUARD_L)) },
  ] },

  // the hesitation: rise up as if done dribbling, eyes to the rim, then go
  "hoop-hesi": { length: 0.5, meta: "one shot 0.5 s: stand up, sell it, drop and burst; bounce at 0.2", keys: [
    { t: 0, pose: add(stance(0.55), TOP_R, GUARD_L) },
    { t: 0.2, markers: ["bounce"], pose: add(stance(0.15, -2), { headPivot: [-6, 0, 0] }, { armR: [16, 0, 24], elbowR: [40, 0, 0], wristR: [-25, 0, 0] }, { armL: [10, 0, -16], elbowL: [30, 0, 0] }) },
    { t: 0.32, pose: add(stance(0.2, -4), TOP_R, { armL: [10, 0, -16], elbowL: [30, 0, 0] }) },
    { t: 0.5, ease: "in", pose: add(stance(0.8, -26), TOP_R, GUARD_L) },
  ] },

  // the spin: the game turns the body round; the clip tucks the ball to the
  // hip and swings the free arm through, and it comes out on the left
  "hoop-spin": { length: 0.5, meta: "one shot 0.5 s: tuck, spin (the body's yaw is the game's), out left; the hips turn -360 over 0.08-0.42", keys: [
    { t: 0, pose: add(stance(0.55), TOP_R, GUARD_L) },
    { t: 0.08, pose: add(stance(0.6, -16), { hips: { r: [0, 0, 0], p: [0, -0.1, 0] } }, { armR: [30, 0, 6], elbowR: [100, 0, -30] }, { armL: [30, 0, -60], elbowL: [40, 0, 0] }) },
    { t: 0.2, pose: add(stance(0.6, -16), { hips: { r: [0, -110, 0], p: [0, -0.1, 0] } }, { armR: [30, 0, 6], elbowR: [100, 0, -30] }, { armL: [10, 0, -70], elbowL: [30, 0, 0] }) },
    { t: 0.31, pose: add(stance(0.6, -16), { hips: { r: [0, -220, 0], p: [0, -0.1, 0] } }, { armR: [30, 0, 6], elbowR: [100, 0, -30] }, { armL: [10, 0, -70], elbowL: [30, 0, 0] }) },
    { t: 0.42, pose: add(stance(0.6, -16), { hips: { r: [0, -330, 0], p: [0, -0.1, 0] } }, mirrorPose(PUSH_R), { armR: [30, 0, 40], elbowR: [40, 0, 0] }) },
    { t: 0.5, pose: add(stance(0.6), mirrorPose(TOP_R), mirrorPose(GUARD_L)) },
  ] },

  // the step-back: a hop back off the front foot, the ball gathered to the
  // chest, landing balanced (the game moves the body back)
  "hoop-stepback": { length: 0.46, meta: "one shot 0.46 s: push off, hop back, gather, land square (plant at 0.4)", keys: [
    { t: 0, pose: add(stance(0.55), TOP_R, GUARD_L) },
    { t: 0.12, pose: add(stance(0.4, -20), { hipR: [50, 0, 6], kneeR: [-40, 0, 0], hipL: [-10, 0, -6], kneeL: [-30, 0, 0] }, TOP_R, GUARD_L) },
    { t: 0.26, pose: add(stance(0.2, 6), { hipR: [30, 0, 8], kneeR: [-60, 0, 0], hipL: [10, 0, -8], kneeL: [-50, 0, 0] }, CHEST) },
    { t: 0.4, markers: ["plant"], pose: add(stance(0.6, -6), CHEST) },
    { t: 0.46, pose: add(stance(0.5, -6), CHEST) },
  ] },

  // the jumper: dip, rise into the set point, release at the top, hold the
  // follow-through (the game lifts the body)
  "hoop-jumper": { length: 0.95, meta: "one shot 0.95 s: dip 0.14, rise, set point 0.34, release 0.44, follow-through to 0.95", keys: [
    { t: 0, pose: add(stance(0.45, -6), CHEST) },
    { t: 0.14, pose: add(stance(0.85, -10), { armR: [60, 0, -4], elbowR: [100, 0, -10], armL: [60, 0, 4], elbowL: [100, 0, 10] }) },
    { t: 0.34, pose: add(stance(0.05, 0), { ankleR: [30, 0, 0], ankleL: [30, 0, 0] }, SET_POINT) },
    { t: 0.44, markers: ["release"], ease: "out", pose: add(stance(0, 2), { ankleR: [35, 0, 0], ankleL: [35, 0, 0], kneeR: [-12, 0, 0], kneeL: [-20, 0, 0] }, { armR: [172, 0, 4], elbowR: [8, 0, 0], wristR: [70, 0, 0], armL: [140, 0, -20], elbowL: [30, 0, 20] }) },
    { t: 0.78, pose: add(stance(0.2, 0), { armR: [168, 0, 4], elbowR: [10, 0, 0], wristR: [80, 0, 0], armL: [120, 0, -24], elbowL: [30, 0, 0] }) },
    { t: 0.95, pose: add(stance(0.45, -4), { armR: [90, 0, 10], elbowR: [30, 0, 0], armL: [40, 0, -14], elbowL: [30, 0, 0] }) },
  ] },

  // the layup: off the right foot, the left knee drives, the right hand
  // lays it up
  "hoop-layup": { length: 0.8, meta: "one shot 0.8 s: gather, left knee up, right hand up, release 0.46", keys: [
    { t: 0, pose: add(stance(0.5, -14), CHEST) },
    { t: 0.16, pose: add(stance(0.6, -10), { hipL: [30, 0, -6], kneeL: [-70, 0, 0] }, CHEST) },
    { t: 0.36, pose: add(stance(0.1, 0), { hipL: [85, 0, -8], kneeL: [-95, 0, 0], hipR: [-8, 0, 6], kneeR: [-10, 0, 0], ankleR: [30, 0, 0] }, { armR: [150, 0, 6], elbowR: [40, 0, 0], wristR: [30, 0, 0], armL: [110, 0, -10], elbowL: [50, 0, 20] }) },
    { t: 0.46, markers: ["release"], ease: "out", pose: add(stance(0.05, 4), { hipL: [80, 0, -8], kneeL: [-90, 0, 0], hipR: [-6, 0, 6], kneeR: [-8, 0, 0], ankleR: [32, 0, 0] }, { armR: [176, 0, 4], elbowR: [6, 0, 0], wristR: [50, 0, 0], armL: [80, 0, -24], elbowL: [40, 0, 0] }) },
    { t: 0.8, pose: add(stance(0.5, -6), { armR: [60, 0, 10], elbowR: [30, 0, 0], armL: [30, 0, -14], elbowL: [30, 0, 0] }) },
  ] },

  // the dunk: up with both hands, hammer it through, hang on the rim, drop
  "hoop-dunk": { length: 1.0, meta: "one shot 1.0 s: load, both hands up 0.32, slam 0.5 (release), hang to 0.8, drop", keys: [
    { t: 0, pose: add(stance(0.55, -16), CHEST) },
    { t: 0.12, pose: add(stance(0.95, -20), { armR: [20, 0, 10], elbowR: [70, 0, 0], armL: [20, 0, -10], elbowL: [70, 0, 0] }) },
    { t: 0.32, pose: add(stance(0.05, 6), { hipL: [40, 0, -8], kneeL: [-80, 0, 0], kneeR: [-30, 0, 0], ankleR: [40, 0, 0], ankleL: [40, 0, 0] }, { armR: [178, 0, 12], elbowR: [30, 0, 0], wristR: [-30, 0, 0], armL: [178, 0, -12], elbowL: [30, 0, 0], wristL: [-30, 0, 0] }) },
    { t: 0.5, markers: ["release"], ease: "out", pose: add(stance(0.1, -10), { kneeR: [-60, 0, 0], kneeL: [-60, 0, 0], hipR: [30, 0, 10], hipL: [30, 0, -10] }, { armR: [150, 0, 8], elbowR: [10, 0, 0], wristR: [60, 0, 0], armL: [150, 0, -8], elbowL: [10, 0, 0], wristL: [60, 0, 0] }) },
    { t: 0.8, pose: add(stance(0.1, 4), { kneeR: [-70, 0, 0], kneeL: [-70, 0, 0], hipR: [20, 0, 10], hipL: [20, 0, -10] }, { armR: [176, 0, 10], elbowR: [5, 0, 0], armL: [176, 0, -10], elbowL: [5, 0, 0] }) },
    { t: 1.0, pose: add(stance(0.7, -10), { armR: [40, 0, 20], elbowR: [30, 0, 0], armL: [40, 0, -20], elbowL: [30, 0, 0] }) },
  ] },

  // the chest pass: step in, push it out with both thumbs down
  "hoop-pass": { length: 0.4, meta: "one shot 0.4 s: chest, push, release 0.18", keys: [
    { t: 0, pose: add(stance(0.4, -8), CHEST) },
    { t: 0.18, markers: ["release"], ease: "out", pose: add(stance(0.45, -16), { hipR: [40, 0, 6], kneeR: [-50, 0, 0] }, { armR: [84, 0, -6], elbowR: [6, 0, 0], wristR: [30, 0, 0], armL: [84, 0, 6], elbowL: [6, 0, 0], wristL: [30, 0, 0] }) },
    { t: 0.4, pose: add(stance(0.45, -8), { armR: [50, 0, 10], elbowR: [30, 0, 0], armL: [50, 0, -10], elbowL: [30, 0, 0] }) },
  ] },

  // on defence: low and wide, arms out, a little bounce on the toes
  "hoop-stance": { length: 0.8, loop: true, meta: "loop 0.8 s: low, wide, hands out", keys: [
    { t: 0, pose: add(stance(0.85, -18), { hipR: [44, 0, 18], hipL: [44, 0, -18] }, { armR: [26, 0, 36], elbowR: [34, 0, 0], armL: [26, 0, -36], elbowL: [34, 0, 0], wristR: [-20, 0, 0], wristL: [-20, 0, 0] }) },
    { t: 0.4, pose: add(stance(0.75, -18), { hipR: [40, 0, 18], hipL: [40, 0, -18] }, { armR: [32, 0, 33], elbowR: [30, 0, 0], armL: [32, 0, -33], elbowL: [30, 0, 0], wristR: [-20, 0, 0], wristL: [-20, 0, 0] }) },
    { t: 0.8, pose: add(stance(0.85, -18), { hipR: [44, 0, 18], hipL: [44, 0, -18] }, { armR: [26, 0, 36], elbowR: [34, 0, 0], armL: [26, 0, -36], elbowL: [34, 0, 0], wristR: [-20, 0, 0], wristL: [-20, 0, 0] }) },
  ] },

  // the poke: the right hand stabs low and forward at the ball
  "hoop-steal": { length: 0.4, meta: "one shot 0.4 s: reach low, poke at 0.16, recover", keys: [
    { t: 0, pose: add(stance(0.8, -18), { armR: [26, 0, 36], elbowR: [34, 0, 0], armL: [26, 0, -36], elbowL: [34, 0, 0] }) },
    { t: 0.16, markers: ["poke"], ease: "out", pose: add(stance(0.9, -34), { hipR: [62, 0, 10], kneeR: [-70, 0, 0] }, { armR: [70, 0, -8], elbowR: [6, 0, 0], wristR: [-10, 0, 0], armL: [20, 0, -50], elbowL: [40, 0, 0] }) },
    { t: 0.4, pose: add(stance(0.8, -18), { armR: [26, 0, 36], elbowR: [34, 0, 0], armL: [26, 0, -36], elbowL: [34, 0, 0] }) },
  ] },

  // the block: both hands straight up, then down to land
  "hoop-block": { length: 0.7, meta: "one shot 0.7 s: load, hands up 0.28 (block 0.2-0.45), land", keys: [
    { t: 0, pose: add(stance(0.7, -12), { armR: [30, 0, 40], elbowR: [40, 0, 0], armL: [30, 0, -40], elbowL: [40, 0, 0] }) },
    { t: 0.1, pose: add(stance(0.9, -14), { armR: [60, 0, 20], elbowR: [60, 0, 0], armL: [60, 0, -20], elbowL: [60, 0, 0] }) },
    { t: 0.28, markers: ["block"], ease: "out", pose: add(stance(0, 0), { ankleR: [35, 0, 0], ankleL: [35, 0, 0] }, { armR: [176, 0, 6], elbowR: [4, 0, 0], wristR: [10, 0, 0], armL: [176, 0, -6], elbowL: [4, 0, 0], wristL: [10, 0, 0] }) },
    { t: 0.5, pose: add(stance(0.1, 0), { armR: [170, 0, 10], elbowR: [10, 0, 0], armL: [170, 0, -10], elbowL: [10, 0, 0] }) },
    { t: 0.7, pose: add(stance(0.7, -12), { armR: [40, 0, 30], elbowR: [40, 0, 0], armL: [40, 0, -30], elbowL: [40, 0, 0] }) },
  ] },

  // the rebound: up with both hands, snatch it, chin it
  "hoop-grab": { length: 0.6, meta: "one shot 0.6 s: reach up both hands, catch 0.26, pull it to the chin", keys: [
    { t: 0, pose: add(stance(0.7, -10), { armR: [60, 0, 20], elbowR: [60, 0, 0], armL: [60, 0, -20], elbowL: [60, 0, 0] }) },
    { t: 0.26, markers: ["catch"], ease: "out", pose: add(stance(0.05, 0), { ankleR: [30, 0, 0], ankleL: [30, 0, 0] }, { armR: [168, 0, -4], elbowR: [20, 0, -20], armL: [168, 0, 4], elbowL: [20, 0, 20] }) },
    { t: 0.6, pose: add(stance(0.65, -14), { armR: [70, 0, -8], elbowR: [110, 0, -20], armL: [70, 0, 8], elbowL: [110, 0, 20] }) },
  ] },

  // the triple threat: both hands on it at the right hip, ready
  "hoop-hold": { length: 1.0, loop: true, meta: "loop 1 s: ball at the right hip, both hands, a slight sway", keys: [
    { t: 0, pose: add(stance(0.5, -10), { armR: [28, 0, -2], elbowR: [70, 0, -12], armL: [56, 0, 30], elbowL: [80, 0, 40] }) },
    { t: 0.5, pose: add(stance(0.55, -11), { armR: [30, 0, -2], elbowR: [72, 0, -12], armL: [58, 0, 30], elbowL: [80, 0, 40] }) },
    { t: 1.0, pose: add(stance(0.5, -10), { armR: [28, 0, -2], elbowR: [70, 0, -12], armL: [56, 0, 30], elbowL: [80, 0, 40] }) },
  ] },

  // ---------------------------------------------------------- tennis
  // Right-handed, facing the net (-z). Contacts are marked; the game puts
  // the strike on the marker so the strings meet the ball on the frame.

  // the ready position: split step, racket across the front in both hands
  "tn-ready": { length: 0.8, loop: true, meta: "loop 0.8 s: split step, racket in both hands at the waist", keys: [
    { t: 0, pose: add(stance(0.45, -10), { armR: [42, 0, -4], elbowR: [72, 0, -18], wristR: [10, 0, 0], armL: [46, 0, 14], elbowL: [80, 0, 30] }) },
    { t: 0.4, pose: add(stance(0.6, -12), { armR: [44, 0, -4], elbowR: [74, 0, -18], wristR: [10, 0, 0], armL: [48, 0, 14], elbowL: [80, 0, 30] }) },
    { t: 0.8, pose: add(stance(0.45, -10), { armR: [42, 0, -4], elbowR: [72, 0, -18], wristR: [10, 0, 0], armL: [46, 0, 14], elbowL: [80, 0, 30] }) },
  ] },
  // the forehand: unit turn, racket back, low to high through contact,
  // finish over the left shoulder
  "tn-fh": { length: 0.75, meta: "one shot 0.75 s: turn 0.18, contact 0.34, finish 0.6", keys: [
    { t: 0, pose: add(stance(0.45, -10), { armR: [42, 0, -4], elbowR: [72, 0, -18], armL: [46, 0, 14], elbowL: [80, 0, 30] }) },
    { t: 0.18, pose: add(stance(0.6, -8), { torso: [-8, -55, 0], hipR: [20, 0, 10], kneeR: [-50, 0, 0] }, { armR: [-15, 0, 55], elbowR: [45, 0, 0], wristR: [-30, 0, 0], armL: [70, 0, -20], elbowL: [10, 0, 0] }) },
    { t: 0.34, markers: ["contact"], ease: "out", pose: add(stance(0.5, -10), { torso: [-10, 10, 0] }, { armR: [50, 0, 45], elbowR: [18, 0, 0], wristR: [0, 0, 0], armL: [40, 0, -40], elbowL: [40, 0, 0] }) },
    { t: 0.6, pose: add(stance(0.4, -6), { torso: [-6, 55, 0] }, { armR: [120, 0, -30], elbowR: [95, 0, 0], wristR: [20, 0, 0], armL: [30, 0, -30], elbowL: [60, 0, 0] }) },
    { t: 0.75, pose: add(stance(0.45, -10), { armR: [42, 0, -4], elbowR: [72, 0, -18], armL: [46, 0, 14], elbowL: [80, 0, 30] }) },
  ] },
  // the two-handed backhand: turn left, both hands back at the left hip,
  // through, finish over the right shoulder
  "tn-bh": { length: 0.75, meta: "one shot 0.75 s: turn 0.18, contact 0.34, finish 0.6 (two hands)", keys: [
    { t: 0, pose: add(stance(0.45, -10), { armR: [42, 0, -4], elbowR: [72, 0, -18], armL: [46, 0, 14], elbowL: [80, 0, 30] }) },
    { t: 0.18, pose: add(stance(0.6, -8), { torso: [-8, 58, 0], hipL: [20, 0, -10], kneeL: [-50, 0, 0] }, { armR: [18, 0, -42], elbowR: [40, 0, -20], wristR: [-20, 0, 0], armL: [10, 0, -20], elbowL: [55, 0, 30] }) },
    { t: 0.34, markers: ["contact"], ease: "out", pose: add(stance(0.5, -10), { torso: [-10, -5, 0] }, { armR: [58, 0, -18], elbowR: [10, 0, -10], armL: [55, 0, -6], elbowL: [30, 0, 20] }) },
    { t: 0.6, pose: add(stance(0.4, -6), { torso: [-6, -50, 0] }, { armR: [130, 0, 22], elbowR: [80, 0, 0], armL: [120, 0, 30], elbowL: [90, 0, 20] }) },
    { t: 0.75, pose: add(stance(0.45, -10), { armR: [42, 0, -4], elbowR: [72, 0, -18], armL: [46, 0, 14], elbowL: [80, 0, 30] }) },
  ] },
  // the forehand slice: racket up high and back, chopping down and through
  "tn-fh-slice": { length: 0.7, meta: "one shot 0.7 s: high take-back 0.18, contact 0.32, short low finish", keys: [
    { t: 0, pose: add(stance(0.45, -10), { armR: [42, 0, -4], elbowR: [72, 0, -18], armL: [46, 0, 14], elbowL: [80, 0, 30] }) },
    { t: 0.18, pose: add(stance(0.55, -8), { torso: [-6, -45, 0] }, { armR: [40, 0, 62], elbowR: [100, 0, 0], wristR: [20, 0, 0], armL: [60, 0, -20], elbowL: [20, 0, 0] }) },
    { t: 0.32, markers: ["contact"], ease: "out", pose: add(stance(0.6, -12), { torso: [-12, 5, 0] }, { armR: [52, 0, 22], elbowR: [20, 0, 0], wristR: [-10, 0, 0], armL: [30, 0, -40], elbowL: [30, 0, 0] }) },
    { t: 0.55, pose: add(stance(0.55, -12), { torso: [-12, 25, 0] }, { armR: [72, 0, -20], elbowR: [20, 0, 0], armL: [20, 0, -35], elbowL: [30, 0, 0] }) },
    { t: 0.7, pose: add(stance(0.45, -10), { armR: [42, 0, -4], elbowR: [72, 0, -18], armL: [46, 0, 14], elbowL: [80, 0, 30] }) },
  ] },
  // the one-handed backhand slice: racket up by the left shoulder, down
  // and across, the left arm opening behind for balance
  "tn-bh-slice": { length: 0.7, meta: "one shot 0.7 s: take-back by the left shoulder 0.18, contact 0.32, open finish", keys: [
    { t: 0, pose: add(stance(0.45, -10), { armR: [42, 0, -4], elbowR: [72, 0, -18], armL: [46, 0, 14], elbowL: [80, 0, 30] }) },
    { t: 0.18, pose: add(stance(0.55, -8), { torso: [-6, 55, 0] }, { armR: [70, 0, -55], elbowR: [110, 0, -20], wristR: [10, 0, 0], armL: [50, 0, 10], elbowL: [80, 0, 30] }) },
    { t: 0.32, markers: ["contact"], ease: "out", pose: add(stance(0.6, -12), { torso: [-12, 10, 0] }, { armR: [50, 0, -12], elbowR: [12, 0, 0], armL: [-10, 0, -40], elbowL: [10, 0, 0] }) },
    { t: 0.55, pose: add(stance(0.55, -12), { torso: [-12, -15, 0] }, { armR: [80, 0, 40], elbowR: [10, 0, 0], armL: [-20, 0, -45], elbowL: [10, 0, 0] }) },
    { t: 0.7, pose: add(stance(0.45, -10), { armR: [42, 0, -4], elbowR: [72, 0, -18], armL: [46, 0, 14], elbowL: [80, 0, 30] }) },
  ] },
  // the volley: no swing, a short punch out in front
  "tn-volley": { length: 0.45, meta: "one shot 0.45 s: set 0.08, punch contact 0.16", keys: [
    { t: 0, pose: add(stance(0.55, -12), { armR: [42, 0, -4], elbowR: [72, 0, -18], armL: [46, 0, 14], elbowL: [80, 0, 30] }) },
    { t: 0.08, pose: add(stance(0.65, -14), { torso: [-14, -20, 0] }, { armR: [62, 0, 40], elbowR: [70, 0, 0], wristR: [-30, 0, 0], armL: [60, 0, -20], elbowL: [40, 0, 0] }) },
    { t: 0.16, markers: ["contact"], ease: "out", pose: add(stance(0.65, -16), { torso: [-16, 0, 0], hipL: [50, 0, -6], kneeL: [-50, 0, 0] }, { armR: [76, 0, 24], elbowR: [30, 0, 0], wristR: [-20, 0, 0], armL: [50, 0, -30], elbowL: [30, 0, 0] }) },
    { t: 0.45, pose: add(stance(0.55, -12), { armR: [42, 0, -4], elbowR: [72, 0, -18], armL: [46, 0, 14], elbowL: [80, 0, 30] }) },
  ] },
  // the smash: the left hand points at the ball, the racket drops behind
  // the head, up and through
  "tn-smash": { length: 0.85, meta: "one shot 0.85 s: trophy 0.3, contact 0.42, through", keys: [
    { t: 0, pose: add(stance(0.45, -6), { armR: [42, 0, -4], elbowR: [72, 0, -18], armL: [46, 0, 14], elbowL: [80, 0, 30] }) },
    { t: 0.3, pose: add(stance(0.5, 8), { torso: [8, -35, 0] }, { armL: [165, 0, -10], elbowL: [10, 0, 0], armR: [150, 0, 45], elbowR: [135, 0, 0], wristR: [-30, 0, 0] }) },
    { t: 0.42, markers: ["contact"], ease: "out", pose: add(stance(0.1, -4), { torso: [-4, 10, 0] }, { armL: [80, 0, -20], elbowL: [40, 0, 0], armR: [176, 0, 5], elbowR: [4, 0, 0], wristR: [40, 0, 0] }) },
    { t: 0.65, pose: add(stance(0.35, -20), { torso: [-20, 30, 0] }, { armL: [30, 0, -20], elbowL: [40, 0, 0], armR: [40, 0, -30], elbowR: [20, 0, 0] }) },
    { t: 0.85, pose: add(stance(0.45, -10), { armR: [42, 0, -4], elbowR: [72, 0, -18], armL: [46, 0, 14], elbowL: [80, 0, 30] }) },
  ] },
  // the serve: side on, toss with the left, trophy, up on the toes to
  // contact, through and across
  "tn-serve": { length: 1.25, meta: "one shot 1.25 s: toss 0.32 (the ball leaves the hand), trophy 0.58, contact 0.74, follow-through", keys: [
    { t: 0, pose: add(stance(0.2, -4), { torso: [-4, -40, 0] }, { armR: [30, 0, 10], elbowR: [40, 0, 0], armL: [40, 0, 10], elbowL: [30, 0, 0] }) },
    { t: 0.32, markers: ["toss"], pose: add(stance(0.3, 4), { torso: [4, -45, 0] }, { armL: [172, 0, -6], elbowL: [4, 0, 0], armR: [-30, 0, 58], elbowR: [30, 0, 0] }) },
    { t: 0.58, pose: add(stance(0.65, 10), { torso: [10, -40, 0] }, { armL: [160, 0, -10], elbowL: [10, 0, 0], armR: [150, 0, 50], elbowR: [135, 0, 0], wristR: [-35, 0, 0] }) },
    { t: 0.74, markers: ["contact"], ease: "out", pose: add(stance(0, -4), { torso: [-4, 5, 0], ankleR: [40, 0, 0], ankleL: [40, 0, 0] }, { armL: [60, 0, -30], elbowL: [40, 0, 0], armR: [178, 0, 2], elbowR: [3, 0, 0], wristR: [45, 0, 0] }) },
    { t: 1.0, pose: add(stance(0.35, -24), { torso: [-24, 35, 0], hipR: [-20, 0, 6], kneeR: [-60, 0, 0] }, { armL: [20, 0, -20], elbowL: [40, 0, 0], armR: [45, 0, -40], elbowR: [25, 0, 0] }) },
    { t: 1.25, pose: add(stance(0.45, -10), { armR: [42, 0, -4], elbowR: [72, 0, -18], armL: [46, 0, 14], elbowL: [80, 0, 30] }) },
  ] },
  // the lob: open face, low to high, the finish straight up
  "tn-lob": { length: 0.75, meta: "one shot 0.75 s: low take-back 0.18, contact 0.34, high finish", keys: [
    { t: 0, pose: add(stance(0.45, -10), { armR: [42, 0, -4], elbowR: [72, 0, -18], armL: [46, 0, 14], elbowL: [80, 0, 30] }) },
    { t: 0.18, pose: add(stance(0.75, -6), { torso: [-6, -45, 0] }, { armR: [-25, 0, 40], elbowR: [20, 0, 0], wristR: [20, 0, 0], armL: [60, 0, -20], elbowL: [20, 0, 0] }) },
    { t: 0.34, markers: ["contact"], ease: "out", pose: add(stance(0.55, -2), { torso: [-2, 5, 0] }, { armR: [45, 0, 35], elbowR: [12, 0, 0], wristR: [30, 0, 0], armL: [40, 0, -30], elbowL: [40, 0, 0] }) },
    { t: 0.6, pose: add(stance(0.3, 4), { torso: [4, 25, 0] }, { armR: [165, 0, 10], elbowR: [20, 0, 0], armL: [40, 0, -30], elbowL: [40, 0, 0] }) },
    { t: 0.75, pose: add(stance(0.45, -10), { armR: [42, 0, -4], elbowR: [72, 0, -18], armL: [46, 0, 14], elbowL: [80, 0, 30] }) },
  ] },

  // the axis probe, for checking which way a joint turns
  probe: { length: 1, meta: "axis probe", keys: [
    { t: 0, pose: { armR: [90, 0, 0], armL: [0, 0, 90] } },
    { t: 1, pose: { armR: [0, 0, 90], armL: [-60, 0, 0], elbowR: [90, 0, 0], torso: [20, 0, 0] } },
  ] },
};
