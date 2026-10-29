// Troll Forces: Black Ops 2's reloads, one per gun (the rifles, then the
// SMGs, LMGs and pistols), taken from first-person BO2 footage frame by
// frame (refs/pf-reloads, local).
//
// A BO2 reload is a few big held poses, not a dip: the rifle swings up and
// stands on end so the mag well faces the left hand, the hand strips the mag
// (an empty one is let fall, a tactical one goes down with the hand), comes
// back up with a fresh one, seats it with a shove, and on an empty reload
// the gun tips over for the charging handle or the bolt catch. Each rifle
// has its own pose, side and finish (FAL: over the top to rack it; M27:
// slap the catch; AN-94: across to the right-side handle; SMR: the gun
// swung left and the work done low on the right, at the bullpup's tail).
//
// Every pose is absolute, in the weapon camera's space: where the mag well
// sits, which way the muzzle points, which way the top of the gun faces.
// The view blends from its hip pose into them and back. The magazine and
// the left hand get their own keys; the arms (rods, or the TROLLS body's
// block arms laid over them) follow the hand.

import * as THREE from "three";
import { smoothstep } from "../characters/anim-curves.js?v=or1";

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* A pose from where the well sits and which way the muzzle and the top of
   the gun point (camera space; the camera looks down -Z). */
function pose(well, muzzle, top) {
  const z = V(...muzzle).normalize().negate();          // the gun's +Z is its tail
  const y = V(...top);
  y.addScaledVector(z, -y.dot(z)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  return { well: V(...well), q: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)) };
}
/* The same pose turned about the view axis by `roll` (radians, + = the
   top toward the left) and nudged: the gun giving to the hand's pulls. */
const lean = (p, roll, dx = 0, dy = 0) => ({
  well: p.well.clone().add(V(dx, dy, 0)),
  q: p.q.clone().premultiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), roll)),
});
const bump = (p, dy, pitch = 0) => {
  const out = { well: p.well.clone().add(V(0, dy, 0)), q: p.q.clone() };
  if (pitch) out.q.premultiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), pitch));
  return out;
};

/* The timeline of one reload from a rifle's spec. Keys:
     pose  [t, pose | null]                        null = the hip pose
     mag   [t, { gun?, cam?, hide?, tilt? }]       gun: offset from the seat
                                                   along the gun; cam: camera-
                                                   space offset on top of it
                                                   (or the position, with no
                                                   gun); hide: unseen from here
                                                   to the next key
     hand  [t, { at: "guard" | "mag" | "gun" | "cam", v? }]
     beats [t, sound]                              audio.rifleBeat */
function build(s, empty) {
  const pullOut = s.pullOut ?? [0, -0.1, 0.01];         // stripped down out of the well
  const under = s.under ?? [0, -0.075, 0];              // the new one lined up under it
  const T = empty
    ? { up: 0.11, grab: 0.15, pull: 0.22, gone: 0.33, back: 0.45, line: 0.53, seat: 0.59, fin: 0.66, reach: 0.70, work: 0.77, done: 0.82, home: 0.88 }
    : { up: 0.13, grab: 0.18, pull: 0.26, gone: 0.38, back: 0.50, line: 0.60, seat: 0.66, home: 0.74 };
  const k = { pose: [], mag: [], hand: [], beats: [] };
  // The gun.
  // It gives to the hand: tips toward it on the strip, rides back while the
  // hand is away, and leans in again to meet the new mag.
  const side = s.fetch[0] < 0 ? 1 : -1;     // which way the hand works
  const seatPose = lean(s.up, side * 0.05, -side * 0.008);
  k.pose.push([0, null], [T.up, s.up], [T.pull, lean(s.up, side * 0.08, -side * 0.012, -0.012)],
    [T.gone, lean(s.up, side * 0.02)], [T.back, lean(s.up, -side * 0.02, 0, 0.006)], [T.line, seatPose]);
  k.pose.push([T.seat, bump(seatPose, 0.02, 0.05)], [T.seat + 0.05, seatPose]);
  if (empty) {
    k.pose.push([T.reach, s.finish.pose], [T.work, s.finish.pose], [T.done, bump(s.finish.pose, -0.015, -0.06)], [T.home, s.finish.pose]);
  }
  k.pose.push([1, null]);
  // The magazine.
  k.mag.push([0, {}], [T.grab, {}], [T.pull, { gun: pullOut }]);
  if (empty) {
    // let go: it falls away under the gun and is gone
    k.mag.push([T.pull + 0.02, { gun: pullOut }], [T.gone - 0.02, { gun: pullOut, cam: [-0.04, -0.75, 0.05], tilt: [0.6, 0.4] }]);
    k.mag.push([T.gone - 0.01, { cam: s.fetch, hide: true }]);
  } else {
    k.mag.push([T.gone, { cam: s.fetch, tilt: [0.3, 0.2], hide: true }]);
  }
  k.mag.push([T.gone + 0.02, { cam: s.fetch, tilt: [0.3, 0.2] }], [T.back, { cam: s.present, tilt: s.presentTilt ?? [0.25, 0] }]);
  k.mag.push([T.line, { gun: under, tilt: s.rockIn ? [0.35, 0] : [0, 0] }], [T.seat, {}], [1, {}]);
  // The left hand.
  k.hand.push([0, { at: "guard" }], [T.up, { at: "guard" }], [T.grab, { at: "mag" }], [T.pull, { at: "mag" }]);
  if (empty) k.hand.push([T.gone, { at: "cam", v: s.fetch }]);
  else k.hand.push([T.gone, { at: "mag" }]);
  k.hand.push([T.gone + 0.02, { at: "mag" }], [T.seat, { at: "mag" }], [T.seat + 0.03, { at: "mag" }]);
  if (empty) {
    const f = s.finish;
    // v2 (DESIGN-ARSENAL.md #6): finish.part "charge" | "catch" sends the
    // hand to the gun's own P_ChargeHand / P_CatchHand point and works the
    // part (gun-action.js reads partState); handle / pull stay the fallback
    // for a gun without the points.
    const at = (v, pull) => (f.part ? { at: "part", part: f.part, v, pull } : { at: "gun", v });
    k.hand.push([T.reach, at(f.handle, 0)], [T.work - 0.02, at(f.handle, 0)],
      [T.work + 0.02, at(f.pull, 1)], [T.done, at(f.handle, 0)], [T.home, { at: "guard" }]);
    if (f.sound) k.beats.push([T.work, f.sound]);   // (a pistol's is its slide: arSlideAt)
    k.slideAt = T.work + 0.02;
    // a charging handle comes back with the hand and the carrier rides
    // home when it's let go; a catch drops the carrier under the slap
    k.part = { name: f.part ?? (f.sound === "slap" ? "catch" : "charge"), grab: T.work - 0.02, pull: T.work + 0.02, done: T.done,
      releaseAt: f.part === "charge" || (!f.part && f.sound === "rack") ? T.done : T.work };
  } else {
    k.hand.push([T.home, { at: "guard" }]);
  }
  k.hand.push([1, { at: "guard" }]);
  k.beats.push([T.pull - 0.03, "release"], [T.seat - 0.02, "insert"]);
  return k;
}

/* Keyed by model.build (weapons.js), or id. Optional: pullOut / under (the
   mag's way out of the well and in, gun-local, when it isn't straight down)
   and palm "top". Wells and points are in the
   weapon camera's space; handles are gun-local (the traced models: the
   bore runs down -Z, the grip near z 0.02, the top of the receiver
   around y 0.06-0.1). */
const LEFT_HAND = [-0.34, -0.62, -0.42];    // off the bottom left, where a fresh mag comes from
const RIGHT_LOW = [0.4, -0.62, -0.45];      // ...and bottom right, for the guns worked on that side
const SPECS = {
  // SWAT-556: the clearest of them, the family the others vary. Stood on
  // end at the right, well to the left hand; empty: tipped over left and
  // the bolt catch slapped.
  lmao: {
    up: pose([0.25, -0.13, -0.8], [0.12, 1, -0.25], [1, 0, 0.25]),
    fetch: LEFT_HAND, present: [0.02, -0.26, -0.78],
    finish: { pose: pose([0.17, -0.12, -0.8], [-0.62, 0.75, -0.25], [0.75, 0.6, 0.2]), handle: [-0.035, 0.03, -0.05], pull: [-0.04, 0.03, 0.03], sound: "slap" },
  },
  // M27: the same stand, a touch more upright; the hand comes over the top
  // to slap the catch above the well, the gun barely tipping.
  heh: {
    up: pose([0.23, -0.1, -0.8], [0.06, 1, -0.2], [1, 0, 0.2]),
    fetch: LEFT_HAND, present: [0.0, -0.24, -0.78],
    finish: { pose: pose([0.2, -0.11, -0.8], [-0.3, 0.92, -0.25], [0.95, 0.3, 0.2]), handle: [-0.04, -0.03, -0.1], pull: [-0.045, -0.04, -0.06], sound: "slap" },
  },
  // FAL OSW: the old mag drops free, the new one rocks in front first, and
  // empty, the left hand goes over the top to rack the handle on the left.
  rofl: {
    up: pose([0.24, -0.12, -0.8], [0.1, 1, -0.22], [1, 0, 0.3]), rockIn: true,
    fetch: LEFT_HAND, present: [-0.02, -0.24, -0.78],
    finish: { pose: pose([0.18, -0.1, -0.8], [-0.2, 0.95, -0.3], [0.7, 0.3, 0.65]), handle: [-0.05, 0.07, -0.2], pull: [-0.05, 0.07, -0.08], sound: "rack" },
  },
  // SCAR-H: kept lower and less rolled; the hand comes up high on the left
  // for the side charging handle, well forward.
  mald: {
    up: pose([0.22, -0.18, -0.76], [0.35, 0.82, -0.5], [0.95, -0.1, 0.3]),
    fetch: LEFT_HAND, present: [-0.02, -0.3, -0.76],
    finish: { pose: pose([0.18, -0.14, -0.78], [-0.1, 0.85, -0.55], [0.8, 0.2, 0.55]), handle: [-0.055, 0.06, -0.26], pull: [-0.055, 0.06, -0.1], sound: "rack" },
  },
  // M8A1: leans up and left rather than standing on end; empty, the hand
  // runs up the left side to the forward handle.
  ratio: {
    up: pose([0.18, -0.14, -0.78], [-0.38, 0.9, -0.25], [0.9, 0.38, 0.25]),
    fetch: LEFT_HAND, present: [-0.06, -0.27, -0.76],
    finish: { pose: pose([0.15, -0.12, -0.78], [-0.5, 0.82, -0.3], [0.85, 0.5, 0.2]), handle: [-0.05, 0.08, -0.24], pull: [-0.05, 0.08, -0.12], sound: "rack" },
  },
  // AN-94: up centre-left, rolled the other way so its right side faces
  // you; the curved mag rocks in from the bottom right, and empty, the hand
  // reaches across for the right-side handle, AK style.
  coalface: {
    up: pose([0.08, -0.15, -0.76], [-0.12, 1, -0.28], [-1, 0, 0.25]), rockIn: true,
    fetch: RIGHT_LOW, present: [0.2, -0.28, -0.76],
    finish: { pose: pose([0.05, -0.13, -0.76], [-0.3, 0.92, -0.3], [-0.95, -0.3, 0.2]), handle: [0.05, 0.04, -0.02], pull: [0.05, 0.04, 0.08], sound: "rack" },
  },
  // MTAR (bullpup): up on the right but nowhere near vertical; the mag goes
  // in behind the grip, and empty, the hand goes over the top to the handle
  // on the left under the rail.
  kek: {
    up: pose([0.2, -0.2, -0.72], [0.18, 0.85, -0.5], [1, 0.1, 0.35]),
    fetch: LEFT_HAND, present: [-0.02, -0.32, -0.72],
    finish: { pose: pose([0.18, -0.16, -0.74], [-0.15, 0.85, -0.5], [0.85, 0.2, 0.5]), handle: [-0.05, 0.03, -0.14], pull: [-0.05, 0.03, -0.03], sound: "rack" },
  },
  // Type 25 (bullpup): stood all the way up on the right; empty, tipped away
  // and the catch above the mag slapped.
  lol: {
    up: pose([0.25, -0.16, -0.8], [0.04, 1, -0.1], [1, 0, 0.3]),
    fetch: LEFT_HAND, present: [0.0, -0.3, -0.78],
    finish: { pose: pose([0.23, -0.14, -0.8], [0.15, 0.95, -0.35], [0.9, 0, 0.45]), handle: [-0.045, 0.03, 0.1], pull: [-0.05, 0.02, 0.13], sound: "slap" },
  },
  // SMR (bullpup): the odd one, swung over to the LEFT of the screen, muzzle
  // up-left, its right side to you, and the work done low on the right at
  // the tail.
  salt: {
    up: pose([-0.02, -0.2, -0.74], [-0.45, 0.85, -0.3], [-0.85, -0.45, 0.25]),
    fetch: RIGHT_LOW, present: [0.18, -0.34, -0.74],
    finish: { pose: pose([0.0, -0.17, -0.76], [-0.35, 0.88, -0.35], [-0.9, -0.3, 0.3]), handle: [0.05, 0.03, 0.08], pull: [0.05, 0.02, 0.13], sound: "slap" },
  },

  // ---- SMGs (BO2's SMG reload video, the same channel). Shorter guns,
  // held closer.
  // MP7: stood straight up at the right, big in the frame; the mag comes
  // down out of the pistol grip and the new one goes up into it. Empty:
  // tipped over left and the T-handle at the very back pulled.
  snicker: {
    up: pose([-0.02, -0.24, -0.68], [0.06, 1, -0.15], [1, 0, 0.2]),
    fetch: LEFT_HAND, present: [-0.16, -0.36, -0.66],
    finish: { pose: pose([0.0, -0.22, -0.7], [-0.5, 0.82, -0.25], [0.8, 0.55, 0.2]), handle: [0, 0.09, 0.24], pull: [0, 0.09, 0.31], sound: "rack" },
  },
  // Vector K10: leans up and left for the swap from below (the M8A1's
  // family); empty, it stands up at the right and the hand pulls the
  // handle on its left side.
  cope: {
    up: pose([0.06, -0.22, -0.72], [-0.4, 0.88, -0.25], [0.88, 0.4, 0.25]),
    fetch: LEFT_HAND, present: [-0.12, -0.34, -0.7],
    finish: { pose: pose([0.08, -0.2, -0.74], [0.05, 1, -0.15], [1, 0, 0.25]), handle: [-0.035, 0.06, -0.06], pull: [-0.035, 0.06, 0.04], sound: "rack" },
  },
  // PDW-57: tipped up at the right and rolled so the top-loading mag faces
  // the hand; it is lifted off forward, the new one laid on and palmed
  // down. Empty: the hand runs to the front side handle and pulls it back.
  seethe: {
    up: pose([0.12, -0.12, -0.7], [0.15, 0.9, -0.4], [-0.8, 0.1, 0.55]),
    fetch: LEFT_HAND, present: [-0.02, -0.2, -0.7], palm: "top",
    pullOut: [0, 0.075, -0.05], under: [0, 0.06, 0],
    finish: { pose: pose([0.2, -0.15, -0.74], [0.1, 0.85, -0.5], [-0.6, 0.3, 0.6]), handle: [-0.035, -0.01, -0.22], pull: [-0.035, -0.01, -0.12], sound: "rack" },
  },

  // ---- LMGs (BO2's LMG video). Ours aren't BO2's, so each wears the
  // nearest BO2 reload; keyed by id (no traced build).
  // The Colt LMG as the HAMR (AR-based, drum-fed): up at the right, muzzle
  // up-left, the big drum shown off in the hand; empty, over the top to
  // the handle at the back of the receiver.
  coltlmg: {
    up: pose([0.2, -0.2, -0.85], [-0.35, 0.82, -0.45], [0.85, 0.4, 0.3]),
    fetch: LEFT_HAND, present: [-0.05, -0.27, -0.76],
    finish: { pose: pose([0.18, -0.18, -0.85], [-0.25, 0.8, -0.5], [0.7, 0.4, 0.6]), handle: [0, 0.06, 0.2], pull: [0, 0.06, 0.27], sound: "rack" },
  },
  // The M60 as the Mk 48 / LSAT (the belt guns): raised at the right,
  // muzzle up-left, barely rolled, the box swapped from below; empty, the
  // hand slaps the top cover shut.
  bellylaugh: {
    up: pose([0.22, -0.22, -0.85], [-0.25, 0.65, -0.72], [0.55, 0.6, 0.55]),
    fetch: LEFT_HAND, present: [-0.04, -0.3, -0.78],
    finish: { pose: pose([0.2, -0.2, -0.86], [-0.2, 0.6, -0.78], [0.4, 0.75, 0.5]), handle: [0, 0.1, -0.06], pull: [0, 0.06, -0.06], sound: "slap" },
  },
  // The RPK as the QBB LSW (the 75-round drum): stood up close and worked
  // from the right, the drum rocked in; empty, across to the right-side
  // handle, AK style.
  cackle: {
    up: pose([0.08, -0.18, -0.8], [-0.15, 1, -0.3], [-1, 0, 0.25]), rockIn: true,
    fetch: RIGHT_LOW, present: [0.2, -0.3, -0.78],
    finish: { pose: pose([0.05, -0.15, -0.8], [-0.3, 0.92, -0.3], [-0.95, -0.3, 0.2]), handle: [0.045, 0.03, -0.05], pull: [0.045, 0.03, 0.05], sound: "rack" },
  },

  // ---- Pistols (BO2's pistols video). The hand that cups the grip leaves
  // it; the empty reload ends on the hand racking the slide (the slide
  // drops then: weapon-view.js / pistol-action.js, no beat of its own).
  // Five-seven: turned up, muzzle up and right, the grip toward the hand;
  // the mag drops out, the new one goes up the grip; empty, the gun comes
  // upright and the hand pulls the slide over the top.
  sixtynine: {
    up: pose([0.05, -0.15, -0.55], [0.35, 0.85, -0.4], [-0.85, 0.35, 0.35]),
    fetch: LEFT_HAND, present: [-0.1, -0.25, -0.53],
    finish: { pose: pose([0.06, -0.13, -0.55], [0.1, 0.95, -0.3], [-0.95, 0.1, 0.3]), handle: [0, 0.012, 0.06], pull: [0, 0.012, 0.1], sound: null },
  },
  // KAP-40: tipped the other way, muzzle up-left, the mag from below;
  // empty, turned muzzle-up and the slide pulled.
  true69: {
    up: pose([0.04, -0.15, -0.55], [-0.35, 0.85, -0.4], [0.85, 0.35, 0.35]),
    fetch: LEFT_HAND, present: [-0.1, -0.25, -0.53],
    finish: { pose: pose([0.06, -0.13, -0.55], [0.15, 0.95, -0.25], [0.95, -0.1, 0.3]), handle: [0, 0.014, 0.07], pull: [0, 0.014, 0.1], sound: null },
  },
  // Problem 416 (arsenal v2, models/build_problem416.blender.py): the M4
  // family's stand; the empty reload ends on a palm slap of its P_Catch.
  problem416: { template: "ar" },
};

/* Archetypes (DESIGN-ARSENAL.md #6): a gun's spec can be { template, ...
   overrides } and lists only what differs (finish merges key by key).
   Each is the BO2 family above it was drawn from. The pump and tube guns
   load shell by shell (weapons.js shellReload, weapon-view.js) and the bolt
   guns chamber on rifle-action.js's cycle, so their templates here cover
   only a detachable-mag variant (the bolt sniper's mag swap). */
const TEMPLATES = {
  ar: { ...SPECS.lmao, finish: { ...SPECS.lmao.finish, part: "catch" } },                    // M4 family: slap the catch
  bullpup: { ...SPECS.kek, finish: { ...SPECS.kek.finish, part: "charge" } },                // forward handle, mag at the tail
  akRock: { ...SPECS.coalface, finish: { ...SPECS.coalface.finish, part: "charge" } },       // rocked in, racked across
  battle: { ...SPECS.mald, finish: { ...SPECS.mald.finish, part: "charge" } },               // SCAR / FAL side handle
  smg: { ...SPECS.snicker, finish: { ...SPECS.snicker.finish, part: "charge" } },
  beltLmg: { ...SPECS.bellylaugh },
  drumLmg: { ...SPECS.coltlmg, finish: { ...SPECS.coltlmg.finish, part: "charge" } },
  pistol: { ...SPECS.sixtynine },
  semiSniper: { ...SPECS.mald, finish: { ...SPECS.mald.finish, part: "charge" } },          // rack the handle on empty
  boltMag: { ...SPECS.lmao, finish: { ...SPECS.lmao.finish, part: null, sound: null } },    // the bolt does the rest
};
function resolve(s) {
  if (!s.template) return s;
  const t = TEMPLATES[s.template];
  if (!t) throw new Error(`ar-reload: no template ${s.template}`);
  return { ...t, ...s, finish: { ...t.finish, ...(s.finish ?? {}) } };
}

const TRACKS = {};
function addTrack(key, spec) {
  const s = resolve(spec);
  TRACKS[key] = { tac: build(s, false), empty: build(s, true), palm: s.palm ?? "base", slide: s.finish.sound == null && !s.finish.part };
}
for (const [id, s] of Object.entries(SPECS)) addTrack(id, s);

/* A gun session's reload added at run time (or a test's): keyed like SPECS
   (model.build or id). */
export function registerArReload(key, spec) { addTrack(key, spec); }

/* A gun's reload: the traced BO2 guns by model.build, the rest by id. */
const trackOf = (def) => TRACKS[def?.model?.build] ?? TRACKS[def?.id];
export const hasArReload = (def) => !!trackOf(def);

/* The empty reload's mechanism at progress `t`: how far the charging
   handle is pulled (0..1), how far the catch is pressed (0..1), and when
   the carrier is let go home. Zeros outside an empty reload. */
const _ps = { charge: 0, press: 0, releaseAt: null };
export function arPartState(w, t) {
  _ps.charge = _ps.press = 0;
  _ps.releaseAt = null;
  const p = w.reloadWasEmpty ? trackOf(w.def)?.empty.part : null;
  if (!p || t < 0) return _ps;
  _ps.releaseAt = p.releaseAt;
  const k = t < p.grab ? 0 : t < p.pull ? smoothstep((t - p.grab) / (p.pull - p.grab)) : t < p.done ? 1 - smoothstep((t - p.pull) / (p.done - p.pull)) : 0;
  if (p.name === "charge") _ps.charge = k;
  else _ps.press = t >= p.grab ? Math.min(1, (t - p.grab) / (p.pull - p.grab)) : 0;
  return _ps;
}

/* An empty pistol reload: when (reload progress) the hand racks the slide
   and it drops home. null for anything else. */
export function arSlideAt(w) {
  const tr = trackOf(w.def);
  return tr?.slide && w.reloadWasEmpty ? tr.empty.slideAt : null;
}

/* Where in `keys` time `t` falls: [k0, k1, eased 0..1]. */
function seg(keys, t) {
  let i = 0;
  while (i < keys.length - 2 && t >= keys[i + 1][0]) i++;
  const a = keys[i], b = keys[i + 1];
  const f = b[0] > a[0] ? Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0]))) : 1;
  return [a, b, smoothstep(f)];
}
/* The pose keys with every null (hip) filled from its nearest real key, so
   a blend toward the hip only changes the weight. */
function poseAt(keys, t, out) {
  const [a, b, f] = seg(keys, t);
  const pa = a[1] ?? b[1] ?? nearest(keys, a[0]), pb = b[1] ?? a[1] ?? nearest(keys, b[0]);
  out.well.lerpVectors(pa.well, pb.well, f);
  out.q.slerpQuaternions(pa.q, pb.q, f);
  out.w = (a[1] ? 1 : 0) * (1 - f) + (b[1] ? 1 : 0) * f;
  return out;
}
function nearest(keys, t) {
  let best = null, d = Infinity;
  for (const k of keys) if (k[1] && Math.abs(k[0] - t) < d) { d = Math.abs(k[0] - t); best = k[1]; }
  return best;
}

const _p = { well: new THREE.Vector3(), q: new THREE.Quaternion(), w: 0 };
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _down = new THREE.Vector3();
const _seatA = new THREE.Vector3(), _seatB = new THREE.Vector3();

/* Gun-local <-> the weapon camera's space (the gun's parent). */
const gunToCam = (mesh, v) => mesh.parent.worldToLocal(mesh.localToWorld(v));
const camToGun = (mesh, v) => mesh.worldToLocal(mesh.parent.localToWorld(v));

/* A mag key's position in camera space, the gun posed as it is now. */
function magKeyPos(mesh, key, out) {
  if (key.gun || !key.cam) {
    out.copy(mesh.userData.magazinePoint);
    if (key.gun) out.add(_seatA.set(...key.gun));
    gunToCam(mesh, out);
    if (key.cam) out.add(_seatB.set(...key.cam));
  } else out.set(...key.cam);
  return out;
}

/* The last reload pose, so a reload cut short (the trigger cuts a tactical
   one) eases back to the hip over CUT_EASE instead of jumping there. */
const CUT_EASE = 0.14;
const _last = { mesh: null, pos: new THREE.Vector3(), q: new THREE.Quaternion(), k: 0 };
export function easeCutReload(mesh, dt, cutNow) {
  if (cutNow && _last.mesh === mesh) _last.k = 1;
  if (_last.k <= 0 || _last.mesh !== mesh) { _last.k = 0; return; }
  _last.k = Math.max(0, _last.k - dt / CUT_EASE);
  const f = smoothstep(_last.k);
  mesh.position.lerp(_last.pos, f);
  mesh.quaternion.slerp(_last.q, f);
}

/* Pose the gun, its magazine and the left hand for reload progress `t`
   (0..1). Call after the hip pose is on the mesh. Returns the hand target
   (world space) and how far the hand is on it, or null. */
const _hand = { pos: new THREE.Vector3(), w: 0 };
export function applyArReload(mesh, w, t) {
  const gun = trackOf(w.def), tr = gun?.[w.reloadWasEmpty ? "empty" : "tac"];
  if (!tr || !mesh) return null;
  const mag = mesh.userData.magMesh;
  const seat = mesh.userData.magazinePoint;
  // The gun: from the hip into the held poses and back.
  poseAt(tr.pose, t, _p);
  if (_p.w > 0) {
    _a.copy(seat).multiply(mesh.scale).applyQuaternion(_p.q);
    _b.copy(_p.well).sub(_a);
    mesh.position.lerp(_b, _p.w);
    mesh.quaternion.slerp(_p.q, _p.w);
  }
  _last.mesh = mesh;
  _last.pos.copy(mesh.position);
  _last.q.copy(mesh.quaternion);
  mesh.updateMatrixWorld(true);
  // The magazine (a child of the gun, so camera space back into its frame).
  if (mag && seat) {
    if (mag.userData.restRotX == null) mag.userData.restRotX = mag.rotation.x;
    const restX = mesh.userData.magRestRotationX ?? mag.userData.restRotX;
    const restZ = mesh.userData.magRestRotationZ ?? 0;   // a drum's roll
    const [a, b, f] = seg(tr.mag, t);
    magKeyPos(mesh, a[1], _a);
    magKeyPos(mesh, b[1], _b);
    _a.lerp(_b, f);
    // camera space -> the gun's own space
    mag.position.copy(camToGun(mesh, _a));
    const ta = a[1].tilt ?? [0, 0], tb = b[1].tilt ?? [0, 0];
    mag.rotation.set(restX + ta[0] + (tb[0] - ta[0]) * f, 0, restZ + ta[1] + (tb[1] - ta[1]) * f);
    mag.visible = !a[1].hide;
    mag.userData.arTilted = true;   // weapon-view.js squares it again after
  }
  // The left hand.
  const [ha, hb, hf] = seg(tr.hand, t);
  const wa = ha[1].at === "guard" ? 0 : 1, wb = hb[1].at === "guard" ? 0 : 1;
  handPoint(mesh, mag, ha[1].at === "guard" ? hb[1] : ha[1], _a, gun.palm);
  handPoint(mesh, mag, hb[1].at === "guard" ? ha[1] : hb[1], _b, gun.palm);
  _hand.pos.lerpVectors(_a, _b, hf);
  _hand.w = wa + (wb - wa) * hf;
  if (_hand.w <= 0) return null;
  mesh.parent?.localToWorld(_hand.pos);
  return _hand;
}

/* Where a hand key puts the hand, camera space. On the mag it palms the
   base (BO2's hand does; and the TROLLS body's big block fist would hide
   the whole mag if it held the middle), or the top of one that loads from
   above (palm "top": the PDW-57's). */
const _magBox = new THREE.Box3();
function handPoint(mesh, mag, key, out, palm) {
  if (key.at === "mag" && mag) {
    if (mag.userData.arBase == null) {
      _magBox.makeEmpty();
      mag.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(mag.matrixWorld).invert();
      mag.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.computeBoundingBox();
        _magBox.union(o.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)));
      });
      mag.userData.arBase = _magBox.isEmpty() ? -0.1 : _magBox.min.y;
      mag.userData.arTop = _magBox.isEmpty() ? 0.03 : _magBox.max.y;
    }
    mesh.parent.worldToLocal(mag.localToWorld(out.set(0, (palm === "top" ? mag.userData.arTop : mag.userData.arBase) * 0.92, 0)));
    return out;
  }
  if (key.at === "part") {
    // the gun's own hand point, moved with the part it works (the charging
    // handle comes back under the hand; a catch takes a press)
    const pt = mesh.userData.gunPoints?.[key.part];
    if (!pt) return key.v ? gunToCam(mesh, out.set(...key.v)) : out.copy(mesh.position);
    out.copy(pt);
    if (key.pull) {
      const ch = mesh.userData.gunParts?.Charge;
      if (key.part === "charge" && ch?.kind === "slide") out[ch.axis] += ch.travel;
      else if (key.part === "catch") out.y -= 0.006;
    }
    return gunToCam(mesh, out);
  }
  if (key.at === "gun" && key.v) return gunToCam(mesh, out.set(...key.v));
  if (key.at === "cam" && key.v) return out.set(...key.v);
  return out.copy(mesh.position);
}

/* The beats crossed between `t0` and `t1` (audio.rifleBeat). */
export function arReloadBeats(w, t0, t1) {
  const tr = trackOf(w.def)?.[w.reloadWasEmpty ? "empty" : "tac"];
  if (!tr) return [];
  return tr.beats.filter(([at]) => t0 < at && t1 >= at).map(([, s]) => s);
}
