/* Throwing a grenade, as you see it and as everyone else sees you.
   User, 2026-10-08: "there to be animations of when users and bots throw
   throwables like grenades. like you know how you should see someones
   hand/arm when throwing a grenade. the pin being pulled too"; "the
   throwable animation should be quick like you know how tomahawk throws and
   grenade throws are quick" (Black Ops 2); with one in your hand you can't
   fire, aim, reload, swap or melee.

   The timeline from the key going down:
     draw  0 - 0.12 s   the gun drops away, the right hand brings the grenade up
     pin   0.12 - 0.30  the left hand hooks the ring and yanks it; the pin flies
     hold  until the key comes up: arm cocked back, the other arm out ahead,
           the fuse burning (it starts when the pin comes out, not before)
     throw 0.22 s       a short wind-back and the overhand whip; the spoon
                        pings off; the grenade leaves the hand
     raise 0.25 s       the rods drop away and the gun comes back up
   A tap (let go before the pin is out) throws the moment it is: about 0.6 s
   from press to the gun back up, BO2's pace.

   The physics doesn't wait on any of this: the grenade is spawned exactly
   when releaseCook() runs, as before, so the wire and every test keep their
   contract. Only the key-up from a player is held back until the pin is out
   (throwRequestRelease). For its first moment the flying grenade is drawn
   from the hand toward where it really is (GrenadeSystem `drawFrom`).

   Others see it through the `ck` state field: the phase and how long into
   it (`throwWire` / `parseThrowWire`), posed on their body by poseThrowBody;
   the existing `nade` message still marks the release. */

import * as THREE from "three";
import { reachHand, setHandPose } from "../character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1m1u";
import { buildThrowable, buildPin, modelKind } from "./throwable-models.js?v=tm1";
import { game } from "../core/state.js?v=st1";

export const THROW = { DRAW: 0.12, PIN: 0.3, WIND: 0.08, WHIP: 0.14, RAISE: 0.25 };
const THROW_END = THROW.WIND + THROW.WHIP;
const FP_SCALE = 0.72;   // the first-person grenade (it's held right under the lens)

/* our own throw */
export const throwState = {
  phase: null,     // "draw" | "pin" | "hold" | "throw" | "raise" | null
  t: 0,            // seconds since the key went down
  tRel: 0,         // seconds since the release
  def: null, armed: false, want: false,
};

/* the key went down (combat/throwables.js startCook) */
export function throwStart(def) {
  Object.assign(throwState, { phase: "draw", t: 0, tRel: 0, def, armed: false, want: false });
  fp.reset(def);
}
/* the throw went out (releaseCook, after the grenade was spawned) */
export function throwReleased() {
  if (!throwState.phase) throwStart(game.cooking?.def || throwState.def);
  throwState.phase = "throw";
  throwState.tRel = 0;
  throwState.armed = true;
}
/* put away unthrown (cancelCook) or spent in the hand (a cook-off) */
export function throwCancel() {
  throwState.phase = null;
  throwState.def = null;
  fp.hide();
}
/* A player's key-up: throw now if the pin is out, else as soon as it is. */
export function throwRequestRelease() {
  if (!game.cooking?.def) return;
  if (throwState.armed || !throwState.phase) game.releaseCook();
  else throwState.want = true;
}
/* The fuse only burns once the pin is out. */
export function throwArmed() { return !throwState.phase || throwState.armed; }
/* A grenade is in the hand (or leaving it): no fire, aim, reload, swap or melee. */
export function throwBusy() { return throwState.phase === "draw" || throwState.phase === "pin" || throwState.phase === "hold" || throwState.phase === "throw"; }

export function updateThrow(dt) {
  const s = throwState;
  if (!s.phase) return;
  s.t += dt;
  if (s.phase === "draw" && s.t >= THROW.DRAW) s.phase = "pin";
  if (s.phase === "pin" && s.t >= THROW.PIN) {
    s.phase = "hold";
    s.armed = true;
    game.audio?.pinPull?.();
    if (s.want) { s.want = false; game.releaseCook(); }
  }
  if (s.phase === "throw" || s.phase === "raise") {
    s.tRel += dt;
    if (s.phase === "throw" && s.tRel >= THROW_END) s.phase = "raise";
    if (s.phase === "raise" && s.tRel >= THROW_END + THROW.RAISE) { s.phase = null; fp.hide(); }
  }
}

/* ---------------------------------------------------------- on the wire */

const CODES = { draw: 1, pin: 2, hold: 3, throw: 4 };
const NAMES = [null, "draw", "pin", "hold", "throw"];
/* "phase:deciseconds:kind" or 0 (state packet `ck`) */
export function throwWire() {
  const s = throwState;
  if (!s.phase || s.phase === "raise") return 0;
  const t = s.phase === "throw" ? s.tRel : s.t;
  return `${CODES[s.phase]}:${Math.round(t * 10)}:${modelKind(s.def)}`;
}
export function parseThrowWire(v) {
  if (!v || typeof v !== "string") return null;
  const [c, t, kind] = v.split(":");
  const phase = NAMES[c | 0];
  return phase ? { phase, t: (Number(t) || 0) / 10, kind: kind || "frag" } : null;
}

/* ------------------------------------------------------ first person */

/* Viewmodel space: the camera at the origin looking down -Z (as emotes.js).
   Right-hand spots through the throw, and the left hand's. */
// Held out at arm's length, low right (BO2's cook): close in, a grenade fills the corner.
const R_LOW = [0.22, -0.5, -0.4], R_HOLD = [0.17, -0.2, -0.48], R_COCK = [0.21, -0.12, -0.44];
const R_WHIP = [0.06, -0.02, -0.62], R_FOLLOW = [-0.06, -0.42, -0.5];
const L_OUT = [-0.16, -0.2, -0.5], L_LOW = [-0.24, -0.55, -0.36];
const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const clamp01 = (k) => Math.max(0, Math.min(1, k));

const fp = {
  model: null, kind: null, pin: null, pinVel: new THREE.Vector3(), pinFree: false, pinT: 0,
  spoon: null, spoonVel: new THREE.Vector3(), spoonFree: false, spoonT: 0,
  reset(def) {
    const kind = modelKind(def);
    const root = game.streakArms;
    if (!root) return;
    if (this.kind !== kind) {
      this.model?.parent?.remove(this.model);
      this.model = buildThrowable(kind, { pin: true });
      this.kind = kind;
      this.model.scale.setScalar(FP_SCALE);
      this.model.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.renderOrder = 2; } });
    }
    root.add(this.model);
    // the pin and spoon go back on for this throw
    const u = this.model.userData;
    for (const [part, key] of [[u.pin, "pin"], [u.spoon, "spoon"]]) {
      if (!part) continue;
      if (part.parent !== this.model) this.model.add(part);
      part.position.copy(part.userData.home ??= part.position.clone());
      part.rotation.set(0, 0, 0);
      part.visible = true;
      this[key + "Free"] = false;
    }
    this.model.visible = true;
  },
  hide() { if (this.model) this.model.visible = false; if (this.model?.userData.pin) this.model.userData.pin.visible = false; if (this.model?.userData.spoon) this.model.userData.spoon.visible = false; },
  /* let a part go: it keeps flying in the viewmodel's space and falls */
  release(key, vel) {
    const part = this.model?.userData[key];
    if (!part || this[key + "Free"]) return;
    const root = game.streakArms;
    root.attach(part);
    this[key + "Free"] = true;
    if (key === "spoon") game.audio?.spoonPing?.();
    this[key + "Vel"].set(...vel);
    this[key + "T"] = 0;
  },
  fly(key, dt) {
    if (!this[key + "Free"]) return;
    const part = this.model.userData[key];
    this[key + "T"] += dt;
    this[key + "Vel"].y -= 2.6 * dt;
    part.position.addScaledVector(this[key + "Vel"], dt);
    part.rotation.x += dt * 14; part.rotation.z += dt * 9;
    part.visible = this[key + "T"] < 0.7 && part.position.y > -0.7;
  },
};

/* The first-person grenade model (tests). */
export function throwModel() { return fp.model; }

/* The frame for view/fp-emote.js (null when there's no throw). */
let lastT = 0;
export function throwFrame() {
  const s = throwState;
  if (!s.phase || !game.player?.alive) return null;
  const now = performance.now() / 1000, dt = Math.min(0.05, Math.max(0, now - (lastT || now)));
  lastT = now;
  let R, L = null, cam = { pitch: 0, yaw: 0 };
  const bob = Math.sin(now * 2.2) * 0.004;
  const gripRot = (pitch) => [pitch, 0.15, -Math.PI / 2];
  if (s.phase === "draw" || s.phase === "pin" || s.phase === "hold") {
    const up = ease(s.t / THROW.DRAW);
    const cock = ease((s.t - THROW.PIN) / 0.12);
    R = { pos: lerp3(lerp3(R_LOW, R_HOLD, up), R_COCK, cock), rot: gripRot(-0.15 - cock * 0.5), pose: "grip" };
    R.pos[1] += bob * cock;
    if (s.t >= THROW.DRAW * 0.6 && s.t < THROW.PIN + 0.12) {
      // the left hand to the ring, then a yank down and out
      const k = clamp01((s.t - THROW.DRAW * 0.6) / (THROW.PIN - THROW.DRAW * 0.6));
      const ring = ringInView(_ring);
      const yank = ease((k - 0.6) / 0.4);
      const reach = lerp3(L_LOW, ring || R.pos, ease(k / 0.6));
      L = { pos: [reach[0] - yank * 0.12, reach[1] - yank * 0.1, reach[2] + yank * 0.04], rot: [0.2, -0.2, Math.PI / 2], pose: "grip" };
      if (yank > 0.3) fp.release("pin", [-0.9, -0.2, 0.3]);
    } else if (s.phase === "hold") {
      // the other arm out ahead, as in BO2's cook
      const out = ease((s.t - THROW.PIN - 0.08) / 0.15);
      L = { pos: lerp3(L_LOW, L_OUT, out), rot: [0.5, -0.1, Math.PI / 2], pose: "relaxed" };
    }
  } else {
    const w = ease(s.tRel / THROW.WIND), whip = ease((s.tRel - THROW.WIND) / THROW.WHIP);
    const fol = ease((s.tRel - THROW_END) / THROW.RAISE);
    const back = lerp3(R_COCK, [R_COCK[0] + 0.03, R_COCK[1] + 0.04, R_COCK[2] + 0.06], w);
    R = { pos: lerp3(lerp3(back, R_WHIP, whip), R_FOLLOW, fol), rot: gripRot(-0.65 + whip * 1.5), pose: whip > 0.55 ? "relaxed" : "grip" };
    L = fol < 1 ? { pos: lerp3(L_OUT, L_LOW, Math.max(whip, fol)), rot: [0.5, -0.1, Math.PI / 2], pose: "relaxed" } : null;
    cam = { pitch: Math.sin(whip * Math.PI) * 0.015, yaw: 0 };
    if (whip > 0.5) {
      fp.release("spoon", [0.6, 0.7, 0.1]);
      if (fp.model) fp.model.visible = false;
    }
  }
  fp.fly("pin", dt);
  fp.fly("spoon", dt);
  return { R, L, gun: false, cam, throwing: true };
}

/* After poseFreeArms: the grenade in the right hand (standing in the fist,
   the spoon under the fingers, the ring toward the left hand). */
const _ring = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _off = new THREE.Vector3();
export function placeThrowInHand() {
  const m = fp.model, arms = game.streakArms?.userData.arms;
  if (!m || !m.visible || !arms) return;
  const hand = arms[0].hand;
  _off.set(0.045, -0.055, -0.04).multiplyScalar(FP_SCALE).applyQuaternion(hand.quaternion);
  m.position.copy(hand.position).add(_off);
  _q.setFromEuler(_e.set(0, 0, Math.PI / 2));
  m.quaternion.copy(hand.quaternion).multiply(_q);
}
function ringInView(out) {
  const pin = fp.model?.userData.pin;
  if (!pin || fp.pinFree || !fp.model.visible) return null;
  fp.model.updateMatrixWorld(true);
  pin.getWorldPosition(out);
  game.streakArms.worldToLocal(out);
  return [out.x - 0.02, out.y, out.z];
}

/* Where the hand is in the world right now (the flying grenade starts its
   draw from here): the viewmodel's hand carried into the world camera. */
export function throwHandWorld(out) {
  const arms = game.streakArms?.userData.arms;
  if (!arms || !game.camera) return null;
  out.copy(arms[0].hand.position);
  return game.camera.localToWorld(out);
}

/* ------------------------------------------------------ on a body */

/* A body in a throw (yours in third person, another player's or a bot's):
   phase/t as throwState or a parsed `ck`. After poseHumanoid. The gun is put
   away for it (`rig.held` hidden by the caller). The grenade rides the right
   palm until the whip. */
const _tR = new THREE.Vector3(), _tL = new THREE.Vector3(), _poleR = new THREE.Vector3(1, -1, 0.3), _poleL = new THREE.Vector3(-1, -1, 0.3);
const _pa = new THREE.Vector3(), _pe = new THREE.Vector3();
export function poseThrowBody(rig, ph, t, kind = "frag") {
  const k = rig.scale || 1, p = rig.parts;
  let r, l = null, showNade = true;
  if (ph === "draw" || ph === "pin" || ph === "hold") {
    const up = ease(t / THROW.DRAW), cock = ph === "hold" ? ease(Math.min(1, t / 0.12)) : 0;
    r = lerp3([0.2, -0.45, -0.1], [0.12, -0.12, -0.28], up);
    r = lerp3(r, [0.24, 0.16, 0.06], cock);
    if (ph === "pin") { const kk = clamp01((t - THROW.DRAW) / (THROW.PIN - THROW.DRAW)); l = lerp3([0.05, -0.12, -0.3], [-0.12, -0.25, -0.32], ease((kk - 0.5) * 2)); }
    else if (ph === "hold") l = lerp3([-0.2, -0.4, -0.1], [-0.18, 0.02, -0.46], cock);
  } else {
    const whip = ease((t - THROW.WIND) / THROW.WHIP), fol = ease((t - THROW_END) / 0.2);
    r = lerp3(lerp3([0.24, 0.2, 0.1], [0.06, 0.22, -0.5], whip), [0.0, -0.25, -0.42], fol);
    l = lerp3([-0.18, 0.02, -0.46], [-0.22, -0.4, -0.12], Math.max(whip, fol));
    showNade = whip < 0.5;
  }
  reachHand(rig, 1, _tR.set(r[0] * k, r[1] * k, r[2] * k), _poleR);
  setHandPose(rig, 1, "fist");
  if (l) { reachHand(rig, -1, _tL.set(l[0] * k, l[1] * k, l[2] * k), _poleL); setHandPose(rig, -1, ph === "pin" ? "fist" : "open"); }
  rig.body?.update?.();
  // the grenade in the right palm
  if (!rig.throwModel || rig.throwModel.userData.kind !== kind) {
    rig.throwModel?.parent?.remove(rig.throwModel);
    rig.throwModel = buildThrowable(kind, { pin: true });
  }
  const m = rig.throwModel;
  if (m.parent !== rig.root) rig.root.add(m);
  m.visible = showNade;
  if (m.userData.pin) m.userData.pin.visible = ph === "draw" || (ph === "pin" && t < (THROW.DRAW + THROW.PIN) / 2);
  if (!showNade) return;
  rig.root.updateMatrixWorld(true);
  p.elbowR.getWorldPosition(_pe); p.handR.getWorldPosition(_pa);
  rig.root.worldToLocal(_pe); rig.root.worldToLocal(_pa);
  _pe.subVectors(_pa, _pe).normalize();
  _pa.addScaledVector(_pe, 0.07 * k);
  m.position.set(_pa.x, _pa.y - (m.userData.height || 0.1) * 0.45 * 1.5 * k, _pa.z);
  m.rotation.set(0, 0, 0);
  m.scale.setScalar(k * 1.5);   // read at range, like the flying one (gear.js)
}
/* Put a body's grenade away (no throw on). */
export function clearThrowBody(rig) {
  if (rig?.throwModel) rig.throwModel.visible = false;
}
