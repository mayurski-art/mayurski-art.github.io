// The gun's own mechanism in your hands, every frame (DESIGN-ARSENAL.md #4):
// one entry for what moves on a shot and through a reload.
//  - Arsenal v2 guns (models/bake_kit.py; weapon-model.js userData.gunParts):
//    the carrier runs back 30 ms and home 40 ms on each shot and stays back
//    on the last round until the empty reload's catch or charge beat; the
//    dust cover pops open on the first shot and stays open; the trigger
//    pulls; the bolt catch rises when it locks and goes down under the
//    slap; the charging handle rides the hand back (ar-reload.js partState);
//    the selector shows the fire mode.
//  - The pistols' slides (pistol-action.js) and the bolt rifles' bolts
//    (rifle-action.js), which keep their own timing.
// Returns what the view plays: { release, boltBeat, eject }.

import { smoothstep } from "../characters/anim-curves.js?v=or1";
import { placePistolSlide } from "./pistol-action.js?v=ps1-wb1-br1-or1";
import { placeBolt } from "./rifle-action.js?v=ra1-wb1-or1-sbolt1-ars1";
import { arSlideAt, arPartState } from "./ar-reload.js?v=ar1-br1-or1-ars1";

export const CARRIER_BACK = 0.03, CARRIER_HOME = 0.04;
const TRIGGER_HOLD = 0.05, TRIGGER_BACK = 0.08;   // after a shot: held, then forward
const COVER_OPEN = 0.07;                           // the dust cover's swing, seconds
const SLAM = 0.03;                                 // carrier home off the catch

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
  let catchUp = 0;
  const empty = w.ammoInMag <= 0;
  if (arT >= 0 && w.reloadWasEmpty) {
    // held back on the catch till the hand releases it, then slammed home
    const ps = arPartState(w, arT);
    const rel = ps.releaseAt ?? 0.8;
    back = arT < rel ? 1 : Math.max(ps.charge, 1 - smoothstep(Math.min(1, (arT - rel) / SLAM)));
    catchUp = arT < rel ? 1 - ps.press : 0;
    setPart(P.Charge, ps.charge);
  } else {
    if (empty && !w.reloading && a.t >= CARRIER_BACK) { back = 1; catchUp = 1; }
    if (arT >= 0) setPart(P.Charge, arPartState(w, arT).charge);
    else setPart(P.Charge, 0);
  }
  setPart(P.Carrier, back);
  setPart(P.Bolt, back);
  setPart(P.Catch, catchUp);
  if (a.opened) a.cover = Math.min(1, a.cover + dt / COVER_OPEN);
  // a little overshoot as it slaps open
  setPart(P.DustCover, a.cover < 1 ? smoothstep(a.cover) * 1.08 : 1);
  setPart(P.Trigger, a.t < TRIGGER_HOLD ? 1 : 1 - smoothstep(Math.min(1, (a.t - TRIGGER_HOLD) / TRIGGER_BACK)));
  setPart(P.Selector, w.def.fireMode === "auto" ? 1 : w.def.fireMode === "burst" ? 0.75 : 0.5);
}

/* A part `k` (0..1) of the way along its travel. */
function setPart(p, k) {
  if (!p) return;
  const v = p.travel * k;
  if (p.kind === "hinge") p.node.rotation[p.axis] = p.rot[p.axis] + v;
  else p.node.position[p.axis] = p.pos[p.axis] + v;
}

/* The mechanism back at rest (a new gun in hand, a test). */
export function resetGunAction(mesh) {
  const u = mesh?.userData;
  if (!u?.gunParts) return;
  u.gunAction = null;
  for (const p of Object.values(u.gunParts)) setPart(p, 0);
}
