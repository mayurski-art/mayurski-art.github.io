// Troll Forces — the money gun, for the Make it rain emote (emotes.js
// poseMoneyGunTP / moneyGunFp; doc docs/MONEY-RAIN.md 3). A prop, not a
// weapon: it never goes on the arsenal rack.
//
// Shaped like the real Cash Cannon (refs/arms/money-gun/NOTES.md): a long
// glossy red box of a body with rounded corners, the bill tray down its
// top between two lips, a wide flat mouth at the front with the black
// roller showing in it, a curved pistol grip leaning back under the rear
// with a round trigger guard and a black trigger, the battery door flaring
// the grip's base. Rectangular only where the real one is (the body, the
// tray); the grip, the guard, the trigger and every edge get their curves
// (CLAUDE.md rule 10).
//
// Local frame: the grip's axis is +Y (origin at the grip's base, up into
// the body), the mouth points -Z. MoneyGunKit puts one on whichever hand
// it's given, first person (the streak-arm hands) or a body (the right
// fist), and sprays bills out of the mouth off the emote clock
// (club-money.js emitMoney), so a remote's rig sprays in step with the
// packet without anything more on the wire.

import * as THREE from "three";
import { emitMoney, SPRAY_RATE, moneyTier } from "../maps/club-money.js?v=mn2-kbc1-mn3-kbc2";

export const MONEY_GUN = {
  seconds: 4.5,
  sprayFrom: 0.6, sprayTo: 4.1,   // the gun's up by then; stops before the arm comes down
};

// the body: length along -Z from the rear, height, width
const BODY = { rear: 0.04, nose: -0.15, y0: 0.082, y1: 0.128, w: 0.06 };
const MUZZLE = new THREE.Vector3(0, 0.113, BODY.nose - 0.006);
const MUZZLE_DIR = new THREE.Vector3(0, 0.12, -1).normalize();

const MATS = {};
const mat = (k, c, rough, metal) => MATS[k] ??= new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });
const red = () => mat("red", 0xd0201c, 0.32, 0.12);
const black = () => mat("black", 0x151515, 0.6, 0.1);
const rubber = () => mat("rubber", 0x222222, 0.9, 0);
const note = () => mat("note", 0xb3a476, 0.8, 0);
const noteEdge = () => mat("noteEdge", 0x8a7e58, 0.8, 0);

/* A side profile (u along the gun's Z, v its Y) extruded across its width:
   the shape's X is the gun's Z, its extrusion the gun's X. `bevel` rounds
   every edge. */
function profile(shape, width, bevel, material, segments = 3) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - 2 * bevel, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: segments, curveSegments: 10 });
  const m = new THREE.Mesh(g, material);
  m.rotation.y = -Math.PI / 2;    // shape X -> gun +Z, extrusion -> gun -X
  m.position.x = width / 2 - bevel;
  return m;
}
function roundedRect(x0, y0, x1, y1, r) {
  const s = new THREE.Shape();
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r);
  s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1);
  s.lineTo(x0 + r, y1); s.quadraticCurveTo(x0, y1, x0, y1 - r);
  s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}
const box = (w, h, d, material, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); m.position.set(x, y, z); return m; };

export function buildMoneyGun() {
  const g = new THREE.Group();
  g.name = "money-gun";
  const B = BODY;

  // the body: a rounded box, its top lipped either side of the tray
  g.add(profile(roundedRect(B.nose, B.y0, B.rear, B.y1, 0.007), B.w, 0.004, red()));
  for (const x of [-1, 1]) g.add(box(0.006, 0.012, B.rear - B.nose - 0.016, red(), x * (B.w / 2 - 0.004), B.y1 + 0.004, (B.rear + B.nose) / 2));
  // the tray down the top between the lips, the stack of bills lying in it
  g.add(box(B.w - 0.016, 0.003, B.rear - B.nose - 0.02, black(), 0, B.y1 - 0.0005, (B.rear + B.nose) / 2 - 0.004));
  const stack = new THREE.Group();
  stack.add(box(0.044, 0.011, 0.118, note(), 0, 0.0055, 0));
  stack.add(box(0.0445, 0.0115, 0.004, noteEdge(), 0, 0.0055, 0.057));
  stack.add(box(0.0445, 0.0115, 0.004, noteEdge(), 0, 0.0055, -0.057));
  stack.position.set(0, B.y1 - 0.0025, -0.05);
  stack.rotation.x = 0.03;
  g.add(stack);
  // the mouth: a dark slot across the top of the nose, the roller in it
  g.add(box(B.w - 0.014, 0.018, 0.006, black(), 0, 0.112, B.nose - 0.001));
  const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.0105, B.w - 0.018, 18), rubber());
  roller.rotation.z = Math.PI / 2;
  roller.position.set(0, 0.109, B.nose + 0.004);
  g.add(roller);

  // the grip, leaning back under the rear: a straight front strap, a
  // curved backstrap, a rounded base flaring into the battery door
  // (slim: about 3 cm front to back, as the photos show, the edges rounded
  // but the sides flat)
  const gs = new THREE.Shape();
  gs.moveTo(0.004, B.y0 + 0.004);
  gs.quadraticCurveTo(0.012, 0.045, 0.024, 0.012);
  gs.quadraticCurveTo(0.028, 0.002, 0.04, 0.001);
  gs.quadraticCurveTo(0.055, 0.0, 0.056, 0.012);
  gs.quadraticCurveTo(0.05, 0.05, 0.038, B.y0 + 0.004);
  gs.closePath();
  g.add(profile(gs, 0.03, 0.005, red(), 4));
  // the battery door: a shallow plate on the grip's left face
  g.add(box(0.003, 0.028, 0.018, red(), -0.0155, 0.02, 0.04));
  // the trigger guard, a round loop under the body ahead of the grip
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.003, 10, 28), red());
  guard.rotation.y = Math.PI / 2;
  guard.position.set(0, B.y0 + 0.002, -0.018);
  g.add(guard);
  // the trigger, a curved black blade inside the guard
  const trig = new THREE.Mesh(new THREE.CapsuleGeometry(0.003, 0.015, 4, 10), black());
  trig.rotation.x = 0.35;
  trig.position.set(0, 0.069, -0.016);
  g.add(trig);

  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  g.userData.muzzle = MUZZLE;
  g.userData.muzzleDir = MUZZLE_DIR;
  return g;
}

/* The wheel's picture of it (emote-wheel.js draws an emote's `icon`). */
export const MONEY_GUN_ICON = '<svg viewBox="0 0 40 12" aria-hidden="true"><rect x="2" y="1.5" width="22" height="5.6" rx="1.6" fill="#d0201c" stroke="#111" stroke-width=".6"/><rect x="5" y="0.6" width="12" height="1.6" rx=".5" fill="#b3a476"/><path d="M18 7l1.6 4.4h3.6L21.2 7z" fill="#d0201c" stroke="#111" stroke-width=".6"/><rect x="22.6" y="2.6" width="1.6" height="2.6" fill="#111"/><g fill="#8fc98a" stroke="#2f6b2f" stroke-width=".4"><rect x="27" y="2" width="4" height="2" transform="rotate(-20 29 3)"/><rect x="32" y="5" width="4" height="2" transform="rotate(25 34 6)"/><rect x="30" y="8.5" width="4" height="2" transform="rotate(-50 32 9.5)"/><rect x="35.5" y="1" width="4" height="2" transform="rotate(60 37.5 2)"/></g></svg>';

/* Where the fist sits on the grip, in the hand's own frame (palm -Y,
   fingers -Z, the grip standing along X: lean-cup.js GRIP): the grip's
   axis passes through (y, z), the hand `h` up it, the grip's half-depth
   `r` where the rod touches. */
export const GRIP_FIT = { y: -0.038, z: -0.02, h: 0.045, r: 0.016 };
const ROD_TIP = 0.0065;
const _off = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0), _ax = new THREE.Vector3();
const _mz = new THREE.Vector3(), _md = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();

export class MoneyGunKit {
  constructor() {
    this.gun = buildMoneyGun();
    this.gun.visible = false;
    this.count = 0;     // bills this emote has sprayed
    this.lastT = 0;
    // Whatever a body does after the emote, a gun nobody has placed lately
    // puts itself away the next time it'd draw (lean-cup.js does the same).
    this.seen = 0;
    const stale = () => { if (performance.now() - this.seen > 250) this.hide(); };
    this.gun.children[0].onBeforeRender = stale;
  }
  hide() { this.gun.visible = false; }
  dispose() { this.gun.parent?.remove(this.gun); }

  /* Bills out of the mouth, as many as the emote clock says are owed. */
  spray(t) {
    if (t < this.lastT) this.count = 0;   // a new emote
    this.lastT = t;
    const owed = Math.floor(Math.max(0, Math.min(MONEY_GUN.sprayTo, t) - MONEY_GUN.sprayFrom) * SPRAY_RATE[moneyTier()]);
    if (owed <= this.count) return;
    this.gun.updateMatrixWorld(true);
    this.gun.localToWorld(_mz.copy(MUZZLE));
    this.gun.localToWorld(_md.copy(MUZZLE).add(MUZZLE_DIR)).sub(_mz);
    emitMoney(_mz, _md, owed - this.count, { speed: 6.5, spread: 0.22, up: 0.5 });
    this.count = owed;
  }

  /* First person: `parent` holds the hands (streak arms, viewmodel space);
     the gun's grip in the right fist, a little wrist sweep as it sprays. */
  fp(parent, handR, handL, t) {
    this.seen = performance.now();
    if (this.gun.parent !== parent) parent.add(this.gun);
    this.gun.visible = true;
    this.gun.scale.setScalar(1);
    _off.set(GRIP_FIT.h, GRIP_FIT.y, GRIP_FIT.z).applyQuaternion(handR.quaternion);
    this.gun.position.copy(handR.position).add(_off);
    _q.setFromUnitVectors(_up, _ax.set(-1, 0, 0));
    this.gun.quaternion.copy(handR.quaternion).multiply(_q);
    this.spray(t);
  }

  /* A body (emotes.js poseMoneyGunTP): the gun hangs on the right fist
     (gripR, a tool's frame: it points -Z out of the fist), scaled to the
     body. `up` 0..1 is how far up the arm is: it fades in with it. */
  tp(rig, t, up) {
    this.seen = performance.now();
    const k = rig.scale || 1;
    this.gun.visible = up > 0.05;
    this.gun.scale.setScalar(1.25 * k * (0.7 + 0.3 * Math.min(1, up * 1.5)));
    this.gun.position.set(0, -0.01 * k, 0.03 * k);
    this.gun.rotation.set(-Math.PI / 2, 0, 0);
    if (this.gun.visible) this.spray(t);
  }

  /* Where arm `side`'s rod (the bare first-person arm, no hand) should end
     so its tip just touches the grip, coming in from the hand's side;
     null for the left. Same space as fp()'s `parent`. */
  rodTip(side, from, hand, out, pad = 0) {
    if (side < 0 || !this.gun.visible || !this.gun.parent) return null;
    const s = this.gun.scale.x, rr = GRIP_FIT.r * s + ROD_TIP + pad;
    const axis = _ax.set(0, 1, 0).applyQuaternion(this.gun.quaternion);
    const p = _a.copy(axis).multiplyScalar(GRIP_FIT.h * s).add(this.gun.position);
    _b.subVectors(hand, p);
    _b.addScaledVector(axis, -_b.dot(axis));
    if (_b.lengthSq() < 1e-8) _b.subVectors(from, p).addScaledVector(axis, -_b.dot(axis));
    return out.copy(_b.normalize()).multiplyScalar(rr).add(p);
  }
}

/* Our own hands (emotes.js `fp`): the right hand up and out at about 40°,
   fist round the grip, sweeping slowly as it sprays; a little kick in the
   camera on each burst. */
export function moneyGunFp(t) {
  const ease = (v) => { const x = Math.max(0, Math.min(1, v)); return x * x * (3 - 2 * x); };
  const up = t < 0.5 ? ease(t / 0.5) : t < MONEY_GUN.seconds - 0.45 ? 1 : 1 - ease((t - (MONEY_GUN.seconds - 0.45)) / 0.45);
  const spraying = t > MONEY_GUN.sprayFrom && t < MONEY_GUN.sprayTo;
  const sweep = Math.sin(t * 2.6) * 0.14 * up;
  const kick = spraying ? Math.max(0, Math.sin(t * 30)) * 0.012 * up : 0;
  return {
    R: { pos: [0.19 - sweep * 0.3, -0.42 + 0.25 * up + kick, -0.48], rot: [0.62 * up + kick * 4, -0.15 * up + sweep, -0.12], pose: "relaxed" },
    L: null,
    gun: false,
    cam: { pitch: -0.02 * up + kick * 0.6, yaw: sweep * 0.1 },
  };
}
