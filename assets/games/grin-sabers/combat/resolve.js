// Grin Sabers — what a swing does when it meets someone.
//
// The DEFENDER decides (design doc, "Online and spectator"): `resolveSwing`
// only needs the attacker's swing (direction, heavy, counter) and the
// defender's own state (guard zone and timing, flick, dodge), so online
// it runs in the defender's browser. In a local duel it just runs here.
//
// Contact is geometric: the blade, swept from last frame's position to
// this frame's, against the defender's body capsule (and against the other
// blade, for clashes).

import * as THREE from "three";
import { HEAVY_MULT, blockCost } from "./forms.js?v=gs2";
import { zoneFor } from "./swings.js?v=gs2";

const BODY_R = 0.27, BODY_Y0 = 0.25, BODY_Y1 = 1.72;
const CLASH_TIME = 1.5;
export const COUNTER_WINDOW = 0.35;
const PERFECT_TOUCH_WINDOW = 0.3;
const DISARM_WINDOW = 0.18;

/* Closest distance between segments p1-q1 and p2-q2; writes the closest
   point on the first into `out`. (Ericson, Real-Time Collision Detection.) */
const _d1 = new THREE.Vector3(), _d2 = new THREE.Vector3(), _r = new THREE.Vector3();
const _c1 = new THREE.Vector3(), _c2 = new THREE.Vector3();
export function segSegDist(p1, q1, p2, q2, out = null) {
  _d1.subVectors(q1, p1); _d2.subVectors(q2, p2); _r.subVectors(p1, p2);
  const a = _d1.dot(_d1), e = _d2.dot(_d2), f = _d2.dot(_r);
  let s, t;
  if (a <= 1e-9 && e <= 1e-9) { s = t = 0; }
  else if (a <= 1e-9) { s = 0; t = Math.min(1, Math.max(0, f / e)); }
  else {
    const c = _d1.dot(_r);
    if (e <= 1e-9) { t = 0; s = Math.min(1, Math.max(0, -c / a)); }
    else {
      const b = _d1.dot(_d2), den = a * e - b * b;
      s = den !== 0 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); }
      else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
    }
  }
  _c1.copy(p1).addScaledVector(_d1, s);
  _c2.copy(p2).addScaledVector(_d2, t);
  if (out) out.copy(_c1);
  return _c1.distanceTo(_c2);
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _ra = new THREE.Vector3(), _ta = new THREE.Vector3();
const _rb = new THREE.Vector3(), _tb = new THREE.Vector3(), _hit = new THREE.Vector3();
const STEPS = 5;

/* Did a's blade cross b's body this frame? Returns the contact point or null. */
export function bladeHitsBody(a, b) {
  _a.set(b.pos.x, b.pos.y + BODY_Y0, b.pos.z);
  _b.set(b.pos.x, b.pos.y + BODY_Y1, b.pos.z);
  for (let i = 0; i <= STEPS; i++) {
    const k = i / STEPS;
    _ra.lerpVectors(a.root0, a.root1, k);
    _ta.lerpVectors(a.tip0, a.tip1, k);
    if (segSegDist(_ra, _ta, _a, _b, _hit) < BODY_R) return _hit.clone();
  }
  return null;
}

/* Did the two blades cross this frame? */
export function bladesCross(a, b) {
  for (let i = 0; i <= STEPS; i++) {
    const k = i / STEPS;
    _ra.lerpVectors(a.root0, a.root1, k); _ta.lerpVectors(a.tip0, a.tip1, k);
    _rb.lerpVectors(b.root0, b.root1, k); _tb.lerpVectors(b.tip0, b.tip1, k);
    if (segSegDist(_ra, _ta, _rb, _tb, _hit) < 0.07) return _hit.clone();
  }
  return null;
}

function frontal(def, att) {
  const f = def.forward();
  const dx = att.pos.x - def.pos.x, dz = att.pos.z - def.pos.z;
  const d = Math.hypot(dx, dz) || 1;
  return (f.x * dx + f.z * dz) / d > Math.cos(80 * Math.PI / 180);
}

function flickAgainst(zone, fl) {
  if (zone === "left") return fl.x > 0.5;
  if (zone === "right") return fl.x < -0.5;
  if (zone === "high") return fl.y < -0.5;
  return Math.hypot(fl.x, fl.y) > 0.6;
}

/* The defender's call. Returns the outcome; applies it to both fighters. */
export function resolveSwing(att, def, at, now, ctx) {
  const s = att.swing;
  if (!s || s.hitDone) return null;
  if (def.iframes) { return "dodged"; }
  s.hitDone = true;
  const zone = zoneFor(s.dir);
  const front = frontal(def, att);

  if (def.state === "guard" && front) {
    const perfect = def.touchGuard ? now - def.guardSince < PERFECT_TOUCH_WINDOW : def.guardZone === zone;
    if (perfect) {
      if (now - def.flickAt < DISARM_WINDOW && flickAgainst(zone, def.flick)) {
        att.disarm(def.pos);
        def.counterUntil = now + COUNTER_WINDOW;
        def.stats.disarms++;
        ctx.emit("disarm", { att, def, at });
        return "disarm";
      }
      att.rebound(true);
      def.counterUntil = now + COUNTER_WINDOW;
      def.stats.perfects++;
      ctx.emit("perfect", { att, def, at });
      return "perfect";
    }
    if (s.heavy) {
      def.bp = Math.max(0, def.bp - 25);
      def.stagger(0.9);
      att.rebound(false);
      ctx.emit("guardbreak", { att, def, at });
      return "guardbreak";
    }
    def.bp -= blockCost(def.form, att.form.damage);
    att.rebound(false);
    if (def.bp <= 0) {
      def.bp = 0;
      def.stagger(1.0);
      ctx.emit("guardbreak", { att, def, at });
      return "guardbreak";
    }
    ctx.emit("block", { att, def, at });
    return "block";
  }

  // A clean hit.
  let dmg = att.form.damage * (s.heavy ? HEAVY_MULT : 1);
  if (s.counter) dmg *= 1.3;
  if (s.air) dmg *= 1.2;
  dmg = Math.round(dmg);
  def.hp = Math.max(0, def.hp - dmg);
  def.lastHitAt = now;
  att.stats.hits++;
  att.stats.dmg += dmg;
  // knocked back along the swing
  const fx = def.pos.x - att.pos.x, fz = def.pos.z - att.pos.z, fl = Math.hypot(fx, fz) || 1;
  const kb = s.heavy ? 4.5 : 2.4;
  def.vel.x += (fx / fl) * kb; def.vel.z += (fz / fl) * kb;
  ctx.flinch(def, fx / fl, fz / fl, s.heavy ? 1 : 0.6);
  if (def.hp <= 0) {
    def.ko(att);
    ctx.emit("ko", { att, def, at, dmg });
    return "ko";
  }
  if (def.state === "swing" || def.state === "guard" || def.state === "idle" || def.state === "rebound") def.stagger(s.heavy ? 0.55 : 0.28);
  ctx.emit("hit", { att, def, at, dmg, heavy: s.heavy, counter: s.counter });
  return "hit";
}

/* Both mid-strike and the blades meet: lock them. */
export function startClash(a, b, at, ctx) {
  for (const f of [a, b]) {
    f.state = "clash";
    f.t = 0;
    f.swing = null;
    f.combo = 0;
    f.vel.set(0, f.vel.y, 0);
  }
  const clash = { t: 0, dur: CLASH_TIME, a, b, mashA: 0, mashB: 0, at };
  a.clash = b.clash = clash;
  ctx.emit("clash", clash);
  return clash;
}

export function updateClash(clash, dt, now, ctx) {
  clash.t += dt;
  if (clash.a.intent.mash) clash.mashA++;
  if (clash.b.intent.mash) clash.mashB++;
  if (clash.t < clash.dur) return false;
  const { a, b } = clash;
  a.clash = b.clash = null;
  if (clash.mashA === clash.mashB) {
    a.rebound(false); b.rebound(false);
    ctx.emit("clashEnd", { winner: null, clash });
  } else {
    const [w, l] = clash.mashA > clash.mashB ? [a, b] : [b, a];
    l.stagger(0.85);
    w.state = "idle";
    w.counterUntil = now + COUNTER_WINDOW + 0.3;
    ctx.emit("clashEnd", { winner: w, loser: l, clash });
  }
  return true;
}

/* Run every contact check for the frame. */
export function resolveFrame(a, b, now, ctx) {
  if (a.state === "clash" || b.state === "clash") return;
  // blade on blade, both striking: a clash
  if (a.striking && b.striking) {
    const at = bladesCross(a, b);
    if (at) { startClash(a, b, at, ctx); return; }
  }
  for (const [att, def] of [[a, b], [b, a]]) {
    if (!att.striking || att.swing.hitDone || !def.alive) continue;
    const k = att.swing.t / att.swing.strike;
    if (k < 0.08) continue;
    const at = bladeHitsBody(att, def);
    if (!at) continue;
    // swinging into their swing from the front also locks blades
    if (def.striking && !def.swing.hitDone && frontal(def, att)) { startClash(att, def, at, ctx); return; }
    resolveSwing(att, def, at, now, ctx);
  }
}
