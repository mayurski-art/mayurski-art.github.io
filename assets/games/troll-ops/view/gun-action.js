// The gun's own mechanism in your hands, every frame (DESIGN-ARSENAL.md #4):
// one entry for what moves on a shot and through a reload.
//  - Arsenal v2 guns (models/bake_kit.py; weapon-model.js userData.gunParts):
//    the carrier runs back 30 ms and home 40 ms on each shot and stays back
//    on the last round until the empty reload's catch or charge beat; the
//    dust cover pops open on the first shot and stays open; the trigger
//    pulls; the bolt catch rises when it locks and goes down under the
//    slap; the charging handle rides the hand back (ar-reload.js partState);
//    the selector shows the fire mode; a see-through mag's brass stack
//    (MT_Rounds, tf_rounds extras) rises a round a shot, so its windows
//    empty as you fire.
//  - The bipod (docs/PRONE.md): legs down while prone, still and aiming,
//    folded otherwise (updateBipod; any gun exporting BipodL / BipodR).
//  - The pistols' slides (pistol-action.js) and the bolt rifles' bolts
//    (rifle-action.js), which keep their own timing.
// Returns what the view plays: { release, boltBeat, eject }.

import { smoothstep } from "../characters/anim-curves.js?v=or1";
import { placePistolSlide } from "./pistol-action.js?v=ps1-wb1-br1-or1";
import { placeBolt } from "./rifle-action.js?v=ra1-wb1-or1-sbolt1-ars1-p416";
import { arSlideAt, arPartState, LET_GO } from "./ar-reload.js?v=ar1-br1-or1-ars1-p416-mt2";

export const CARRIER_BACK = 0.03, CARRIER_HOME = 0.04;
const TRIGGER_HOLD = 0.05, TRIGGER_BACK = 0.08;   // after a shot: held, then forward
const COVER_OPEN = 0.07;                           // the dust cover's swing, seconds
const SLAM = LET_GO;                               // carrier home off the catch or a let-go handle

const _out = { release: false, boltBeat: null, eject: false };

/* How far back the carrier is (0..1) `t` seconds after a shot. */
export function carrierCurve(t) {
  if (t < CARRIER_BACK) return smoothstep(t / CARRIER_BACK);
  return 1 - smoothstep(Math.min(1, (t - CARRIER_BACK) / CARRIER_HOME));
}

/* `rl` is weapon-view.js's reloadPose (magT, arT), `admire` the inspect's
   progress (-1 when not admiring). */
export function updateGunAction(mesh, w, dt, rl, admire = -1) {
  const o = _out;
  o.release = false; o.boltBeat = null; o.eject = false;
  const u = mesh?.userData;
  if (!u) return o;
  // pistols: the slide (an empty BO2 reload drops it as the hand racks it)
  if (u.pistolAction) {
    const arSlide = rl.arT >= 0 ? arSlideAt(w) : null;
    o.release = placePistolSlide(mesh, w, arSlide != null ? rl.arT : (rl.magT ?? -1), admire, arSlide ?? undefined) === "release";
  }
  // bolt rifles: the bolt after each shot
  o.boltBeat = placeBolt(mesh, w, rl.magT ?? -1);
  if (u.gunParts) placeParts(mesh, w, dt, rl.arT ?? -1, o);
  return o;
}

function placeParts(mesh, w, dt, arT, o) {
  const u = mesh.userData, P = u.gunParts;
  const a = u.gunAction ??= { ammo: w.ammoInMag, t: 1e3, cover: 0, opened: false, ejected: true };
  // A shot is a round gone that a reload didn't take (several in one frame
  // read as one: the carrier can't show more than that anyway).
  if (w.ammoInMag < a.ammo && !w.reloading) { a.t = 0; a.opened = true; a.ejected = false; }
  a.ammo = w.ammoInMag;
  a.t = a.hold ?? a.t + dt;               // hold: a test freezes the cycle there
  if (!a.ejected && a.t >= CARRIER_BACK * 0.6) { a.ejected = true; o.eject = true; }

  let back = carrierCurve(a.t);
  let catchUp = 0, charge = 0;
  const empty = w.ammoInMag <= 0;
  if (arT >= 0 && w.reloadWasEmpty) {
    // held back on the catch till the hand releases it, then slammed home,
    // speeding up as it goes (a let-go handle keeps the same pace)
    const ps = arPartState(w, arT);
    const rel = ps.releaseAt ?? 0.8;
    back = arT < rel ? 1 : Math.max(ps.charge, 1 - Math.min(1, (arT - rel) / SLAM) ** 2);
    catchUp = arT < rel ? 1 - ps.press : 0;
    charge = ps.charge;
  } else {
    if (empty && !w.reloading && a.t >= CARRIER_BACK) { back = 1; catchUp = 1; }
    if (arT >= 0) charge = arPartState(w, arT).charge;
  }
  // a reciprocating handle (tf_follow) rides back with the carrier on each
  // shot and sits back with it when it locks
  if (P.Charge?.follow === "Carrier" && P.Carrier) charge = Math.max(charge, back * P.Carrier.travel / P.Charge.travel);
  setPart(P.Charge, charge);
  setPart(P.Carrier, back);
  if (!u.boltAction) setPart(P.Bolt, back);   // a bolt gun's bolt is rifle-action.js's
  setPart(P.Catch, catchUp);
  if (a.opened) a.cover = Math.min(1, a.cover + dt / COVER_OPEN);
  // a little overshoot as it slaps open
  setPart(P.DustCover, a.cover < 1 ? smoothstep(a.cover) * 1.08 : 1);
  setPart(P.Trigger, a.t < TRIGGER_HOLD ? 1 : 1 - smoothstep(Math.min(1, (a.t - TRIGGER_HOLD) / TRIGGER_BACK)));
  setPart(P.Selector, w.def.fireMode === "auto" ? 1 : w.def.fireMode === "burst" ? 0.75 : 0.5);
  placeRounds(mesh, w, arT);
}

/* A see-through mag's brass stack (a child of P_Mag with tf_rounds extras:
   the builder's round pitch and how far the stack may rise before it would
   show above the shell). The follower pushes it up a round a shot, so the
   windows empty from the bottom; the fresh mag of a reload comes in full. */
function placeRounds(mesh, w, arT) {
  const u = mesh.userData;
  if (u.gunRounds === undefined) {
    let r = null;
    mesh.traverse((o) => { if (o.userData.tf_rounds) r = { node: o, y: o.position.y, pitch: o.userData.tf_rounds_pitch, max: o.userData.tf_rounds_max }; });
    u.gunRounds = r;
  }
  const r = u.gunRounds;
  if (!r) return;
  const gone = w.reloading && arT > 0.35 ? 0 : Math.max(0, w.def.magSize - w.ammoInMag);
  r.node.position.y = r.y + Math.min(gone * r.pitch, r.max);
}

/* A part `k` (0..1) of the way along its travel. */
function setPart(p, k) {
  if (!p) return;
  const v = p.travel * k;
  if (p.kind === "hinge") p.node.rotation[p.axis] = p.rot[p.axis] + v;
  else p.node.position[p.axis] = p.pos[p.axis] + v;
}

/* The bipod's legs: down over BIPOD_DOWN s while `want` (prone, still,
   aiming: weapon-view.js), folded over BIPOD_UP s otherwise. Sets
   userData.bipodK (0..1, how far down: the mounted steadiness reads it)
   and returns "down" on the frame the legs lock, for the click. */
const BIPOD_DOWN = 0.25, BIPOD_UP = 0.2;
export function updateBipod(mesh, want, dt) {
  const u = mesh?.userData, P = u?.gunParts;
  if (!P?.BipodL && !P?.BipodR) { if (u) u.bipodK = 0; return null; }
  const t0 = u.bipodT ?? 0;
  const t = want ? Math.min(1, t0 + dt / BIPOD_DOWN) : Math.max(0, t0 - dt / BIPOD_UP);
  u.bipodT = t;
  u.bipodK = smoothstep(t);
  setPart(P.BipodL, u.bipodK);
  setPart(P.BipodR, u.bipodK);
  return t0 < 1 && t >= 1 ? "down" : null;
}

/* The mechanism back at rest (a new gun in hand, a test). */
export function resetGunAction(mesh) {
  const u = mesh?.userData;
  if (!u?.gunParts) return;
  u.gunAction = null;
  u.bipodT = u.bipodK = 0;
  for (const p of Object.values(u.gunParts)) setPart(p, 0);
}
