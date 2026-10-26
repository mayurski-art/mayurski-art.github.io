// Troll Forces — Troll Royale's drop: a squadron of C-130s (PLANES.md).
//
// Twelve planes, nine trolls each. Every plane's flight is a pure function
// of the match seed and the drop clock `t` (seconds; negative before the
// green light, so the countdown's -90 .. 0, then the run after), so every
// client draws the same sky and nothing about it goes over the wire.
//
//   inbound  from far out on its own bearing to its slot on the holding
//            circle, arriving one every arriveEvery seconds
//   orbit    round the island in the circle, the twelve slots 30° apart
//   break    at breakAt, a curve off the circle onto its drop run
//   run      straight across the island; green at t 0, red past the coast
//   climb    on and up and away; gone by `gone`
//
// The plane you ride draws the hold (royale-hold.js) inside its airframe;
// the other eleven are instanced, one InstancedMesh per part.

import * as THREE from "three";
import { insidePolygon } from "../maps/edge.js?v=or1";
import { seededRng } from "./royale-zone.js?v=p5-wst-bs1-sb2-fu1b7d-wb1-ar1-ar2-cl1-fj1-zr10-zc1-zc2-pi1-fl1-or1-rt1-ut1-gf1-tg1-rb4-hp1-bx1-mg1-sp1-zw1-tfb8";
import { loadModel } from "../maps/battlefield-props.js?v=sr1-or1-tx1-sp1-kbt1-gb1-pm1-kbk2-tfp7-tfb8-ss1-ss2-ss3-tfm2";
import { Hold, HOLD, RAMP_END, holdDaylight } from "./royale-hold.js?v=pl1-pl2-sr1-or1-rr1-tx1-sp1-kbt1-gb1-pm1-kbk2-tfp7-tfb8-ss1-ss2-ss3-tfm2";

export const PLANES = {
  count: 8,           // 8 x 9 = 72 seats for Trollface Island's 69 (user 2026-10-25; 12 for 100 before)
  seats: 9,
  speed: 40,          // m/s
  runSpeed: 20,       // m/s on the drop run (runDist): slow enough to be over land for the whole look down
  orbitR: 420,        // the holding circle, round the island's middle (its corners are ~260 m out)
  baseAlt: 330,
  altStep: 20,        // each slot higher than the last: crossing runs pass well clear
  fan: 120,           // the runs' lanes spread this far either side of the middle
  firstArrive: -85,   // the first plane joins the circle (s, drop clock)
  arriveEvery: 3.5,
  inbound: 600,       // how far out they start (m beyond the circle)
  doorAt: -40,        // the upper door swings up
  breakAt: -8,        // off the circle onto the run
  redAt: -21,         // the red light (the drop cinematic's mask on)
  rampAt: -9.2,        // the ramp starts down (open by the green)
  rampTime: 2.2,      // the ramp lowering after the green
  // ...then it slides back in under the floor, and the hold ends at the
  // hinge over open air: a clear look straight down at the island before
  // you go (user, 2026-10-18: "the hanger door should open and then be
  // retracted inward ... briefly look down to see the island").
  retractAt: -6.8,   // (the drop cinematic looks down through it, royale-cine.js lookStanding)
  retractTime: 0.8,
  stickEvery: 0.6,    // bots out one after another
  climb: 5,           // m/s up after the run
  gone: 45,           // the squadron is out of sight
  bank: 0.55,         // how much of a real coordinated turn's bank to show
};
if (typeof window !== "undefined" && window.__trollPlanesTune) Object.assign(PLANES, window.__trollPlanesTune);

const TAU = Math.PI * 2;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* Cubic Hermite between p0 (tangent m0) and p1 (tangent m1), u in 0..1. */
function hermite(out, p0, m0, p1, m1, u) {
  const u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  return out.set(
    h00 * p0.x + h10 * m0.x + h01 * p1.x + h11 * m1.x,
    h00 * p0.y + h10 * m0.y + h01 * p1.y + h11 * m1.y,
    h00 * p0.z + h10 * m0.z + h01 * p1.z + h11 * m1.z);
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const _f = new THREE.Vector3(), _up = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3();
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _one = new THREE.Vector3(1, 1, 1);
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

const LOOK_AT = 3.9;   // s before the green: the middle of the look down (royale-cine.js CINE.lookDown)
const LAND_LEFT = 6;   // s over the island after the green, at least (nine out at stickEvery, and room)
const LOOK_IN = 150;   // m over land mid look down through the ramp (LOOK_AT): looking aft,
                       // most of the island is behind and below you
/* The run slows for the drop, the way jump planes do (40 m/s easing to
   runSpeed), so the island takes ~15 s to cross: time to be well over it at
   the look down and still have it under you for the jump. Metres along the
   run at run-time t (smooth into the break's 40 m/s at t 0). */
function runDist(t) {
  if (t <= 0) return PLANES.speed * t;
  const vr = PLANES.runSpeed, tau = 1.6;
  return vr * t + (PLANES.speed - vr) * tau * (1 - Math.exp(-t / tau));
}

/* The twelve flights, from the seed. `centre` {x, z}; `edge` the island
   outline (the run's over-land window comes from it). */
export function planFlights(seed, centre, edge) {
  const rng = seededRng((seed ^ 0xc130) >>> 0);
  const P = PLANES, w = P.speed / P.orbitR;
  // Which slot of the circle each plane takes: arriving in order, they come
  // in from all round the compass. Of a few seeded shuffles, the one that
  // leaves the smallest hole in the compass.
  const rot0 = rng() * TAU;
  const shuffle = () => {
    const a = [...Array(P.count).keys()];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const entry = (k, i) => rot0 + (TAU * k) / P.count + w * (P.firstArrive + i * P.arriveEvery + 90);
  const hole = (sl) => {
    const b = sl.map((k, i) => ((entry(k, i) % TAU) + TAU) % TAU).sort((x, y) => x - y);
    let g = 0;
    for (let i = 0; i < b.length; i++) g = Math.max(g, ((b[(i + 1) % b.length] - b[i]) + TAU) % TAU || TAU);
    return g;
  };
  let slots = shuffle();
  for (let n = 0; n < 24; n++) { const s2 = shuffle(); if (hole(s2) < hole(slots)) slots = s2; }
  // The runs fan out across the island, one lane each, so they don't all
  // pass over the middle together (and each flies its own height).
  const lanes = shuffle();
  const flights = [];
  for (let i = 0; i < P.count; i++) {
    const k = slots[i];
    const tA = P.firstArrive + i * P.arriveEvery;
    const alt = P.baseAlt + P.altStep * k;
    // The slot's angle at time t: every slot turns at w together.
    const slotAngle = (t) => rot0 + (TAU * k) / P.count + w * (t + 90);
    const th = slotAngle(tA);
    const E = new THREE.Vector3(centre.x + Math.cos(th) * P.orbitR, alt, centre.z + Math.sin(th) * P.orbitR);
    const T = new THREE.Vector3(-Math.sin(th), 0, Math.cos(th));   // the circle's way round (+angle)
    // Inbound from behind the slot and well out, a little lower.
    const beta = th - 0.9 - rng() * 0.3;
    const S = new THREE.Vector3(centre.x + Math.cos(beta) * (P.orbitR + P.inbound), alt - 25, centre.z + Math.sin(beta) * (P.orbitR + P.inbound));
    const inLen = S.distanceTo(E) * 1.12;
    const inDur = inLen / P.speed;
    const m0 = E.clone().sub(S).normalize().multiplyScalar(inLen);
    const m1 = T.clone().multiplyScalar(inLen);
    // The break: off the circle at breakAt toward a point near the middle.
    const phB = slotAngle(P.breakAt);
    const B = new THREE.Vector3(centre.x + Math.cos(phB) * P.orbitR, alt, centre.z + Math.sin(phB) * P.orbitR);
    const TB = new THREE.Vector3(-Math.sin(phB), 0, Math.cos(phB));
    const brk = -P.breakAt;   // seconds the break takes (to t 0)
    const toMid = new THREE.Vector3(centre.x - B.x, 0, centre.z - B.z).normalize();
    const lateral = ((lanes[i] + 0.5) / P.count - 0.5) * 2 * P.fan;
    const K = new THREE.Vector3(centre.x - toMid.z * lateral, alt, centre.z + toMid.x * lateral);
    const d0 = K.clone().sub(B).normalize();
    const Q = B.clone().addScaledVector(TB, P.speed * brk * 0.35).addScaledVector(d0, P.speed * brk * 0.6);
    Q.y = alt;
    const dir = K.clone().sub(Q).setY(0).normalize();
    const brkLen = P.speed * brk;
    const f = {
      i, slot: k, tA, alt, cx: centre.x, cz: centre.z, S, E, m0, m1, inDur, slotAngle, B, TB, Q, dir, brkLen,
      mb0: TB.clone().multiplyScalar(brkLen), mb1: dir.clone().multiplyScalar(brkLen),
      tIn: 0, tOut: 0, over: false,
    };
    // Over land: sample the run for the window it's over the island.
    if (edge) {
      let tin = -1, tout = -1;
      let deep = -1;
      for (let t = 0; t < 40; t += 0.1) {
        const d = runDist(t), x = Q.x + dir.x * d, z = Q.z + dir.z * d;
        const on = insidePolygon(edge, x, z);
        if (on && tin < 0) tin = t;
        if (on && deep < 0 && d - runDist(tin) >= LOOK_IN) deep = t;
        if (!on && tin >= 0) { tout = t; break; }
      }
      f.over = tin >= 0;
      const end = tout > 0 ? tout : tin >= 0 ? 30 : 8;
      // Each plane runs `lead` seconds ahead of the drop clock, so it's
      // already over land when you look down through the open ramp before
      // the green (user, 2026-10-18: see the island, then jump): LOOK_IN m
      // in at the look (T-2), but never so far in that less than LAND_LEFT
      // s over the island is left after the green for everyone to go.
      f.lead = f.over ? Math.max(0, Math.min((deep >= 0 ? deep : tin) + LOOK_AT, end - LAND_LEFT)) : 0;
      f.tIn = Math.max(0, tin - f.lead);
      f.tOut = end - f.lead;
    } else { f.over = true; f.lead = 0; f.tIn = 0; f.tOut = 8; }
    flights.push(f);
  }
  return flights;
}

/* Where flight f is at time t (the floor's middle, world). */
export function flightPos(f, t, out = new THREE.Vector3()) {
  const P = PLANES;
  t += f.lead || 0;   // run-time: the plane's own clock (planFlights)
  if (t < f.tA) {
    const u = 1 - Math.min(1, (f.tA - t) / f.inDur);
    if (f.tA - t > f.inDur) {
      // further out than the curve: on the line in toward it
      return out.copy(f.S).addScaledVector(f.m0, -((f.tA - t) - f.inDur) / f.inDur);
    }
    return hermite(out, f.S, f.m0, f.E, f.m1, u);
  }
  if (t < P.breakAt) {
    const a = f.slotAngle(t);
    return out.set(f.cx + Math.cos(a) * P.orbitR, f.alt, f.cz + Math.sin(a) * P.orbitR);
  }
  if (t < 0) return hermite(out, f.B, f.mb0, f.Q, f.mb1, (t - P.breakAt) / -P.breakAt);
  out.copy(f.Q).addScaledVector(f.dir, runDist(t));
  const climbFrom = f.tOut + (f.lead || 0) + 2;
  if (t > climbFrom) out.y += (t - climbFrom) * P.climb;
  return out;
}

/* Position and attitude (nose -z, banked into turns) as a matrix. */
export function flightMatrix(f, t, out = new THREE.Matrix4()) {
  const p = flightPos(f, t, _a);
  flightPos(f, t - 0.25, _b);
  flightPos(f, t + 0.25, _c);
  _f.copy(_c).sub(_b).normalize();
  // the turn: sideways acceleration -> a bank
  const ax = (_c.x - 2 * p.x + _b.x) / 0.0625, az = (_c.z - 2 * p.z + _b.z) / 0.0625;
  _x.set(-_f.z, 0, _f.x).normalize();   // right of the nose (flat)
  const lateral = ax * _x.x + az * _x.z;
  const bank = Math.atan2(lateral, 9.8) * PLANES.bank;
  _up.set(0, 1, 0).applyAxisAngle(_f, -bank);
  _x.crossVectors(_f, _up).normalize();
  _y.crossVectors(_x, _f).normalize();
  out.makeBasis(_x, _y, _f.negate());
  out.setPosition(p);
  return out;
}

/* The plane's velocity at t (m/s, world). */
export function flightVel(f, t, out = new THREE.Vector3()) {
  flightPos(f, t + 0.1, out);
  return out.sub(flightPos(f, t - 0.1, _b)).multiplyScalar(5);
}

/* The squadron: the instanced eleven, the one you ride, the lights. */
export class Squadron {
  /* ctx: { scene, colliders, edge, centre {x, z} } */
  constructor(ctx, seed) {
    this.ctx = ctx;
    this.seed = seed;
    this.flights = planFlights(seed, ctx.centre, ctx.edge);
    this.t = -90;
    this.ridden = -1;
    this.hold = null;
    this.parts = [];         // { mesh: InstancedMesh, local: Matrix4 per instance-kind }
    this.template = null;
    this.planeM = this.flights.map(() => new THREE.Matrix4());
    this.root = new THREE.Group();
    this.root.name = "c130-squadron";
    ctx.scene.add(this.root);
    this.ready = loadModel("c130").then((tpl) => { if (!this.disposed) this.buildFleet(tpl); });
  }

  /* One InstancedMesh per part of the airframe; the four props share one
     (48 instances). */
  buildFleet(tpl) {
    this.template = tpl;
    tpl.updateMatrixWorld(true);
    const n = this.flights.length;
    const props = [];
    tpl.traverse((o) => { if (/^C130_Prop_\d$/.test(o.name)) props.push(o); });
    props.sort((a, b) => a.name.localeCompare(b.name));
    this.props = props;
    const underProp = (m) => { for (let p = m; p; p = p.parent) if (props.includes(p)) return p; return null; };
    tpl.traverse((m) => {
      if (!m.isMesh) return;
      const prop = underProp(m);
      if (prop && prop !== props[0]) return;   // the first prop's meshes stand for all four
      const count = prop ? n * props.length : n;
      const mat = m.material.clone();
      const inst = new THREE.InstancedMesh(m.geometry, mat, count);
      inst.castShadow = false;
      inst.receiveShadow = false;
      inst.frustumCulled = false;
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      inst.userData.shared = true;
      const rel = new THREE.Matrix4();
      if (prop) rel.copy(prop.matrixWorld).invert().multiply(m.matrixWorld);
      this.parts.push({ inst, src: m, prop: !!prop, rel });
      this.root.add(inst);
    });
  }

  /* You ride flight i: its hold is built, its instances hidden. `origin`
     is where the ghost hold's colliders go (world). */
  ride(i, origin) {
    this.ridden = i;
    this.hold?.dispose();
    this.hold = new Hold(this.ctx, origin);
    this.root.add(this.hold.group);
    this.hold.group.matrixAutoUpdate = false;
    return this.hold;
  }

  /* Ghost point (world, in the hold's colliders) -> where it is in the sky now. */
  ghostToWorld(v, out = new THREE.Vector3()) {
    if (!this.hold || this.ridden < 0) return out.copy(v);
    return this.hold.toLocal(v, out).applyMatrix4(this.planeM[this.ridden]);
  }

  /* The ridden plane's attitude (to turn the camera and the bodies by). */
  riddenQuat(out = new THREE.Quaternion()) {
    if (this.ridden < 0) return out.identity();
    return out.setFromRotationMatrix(this.planeM[this.ridden]);
  }

  riddenFlight() { return this.ridden >= 0 ? this.flights[this.ridden] : null; }

  /* Where flight i is at t (the floor's middle, world). */
  posAt(i, t, out = new THREE.Vector3()) { return flightPos(this.flights[i], t, out); }

  /* The lights by the ramp for flight f at t. */
  lightAt(f, t) {
    if (t < PLANES.redAt) return "off";
    if (t < 0) return "red";
    return t < f.tOut - 1 ? "green" : "red";
  }

  doorK(t) { return smooth(PLANES.doorAt, PLANES.doorAt + 4, t); }
  rampK(t) { return smooth(PLANES.rampAt, PLANES.rampAt + PLANES.rampTime, t); }
  retractK(t) { return smooth(PLANES.retractAt, PLANES.retractAt + PLANES.retractTime, t); }

  update(t, dt) {
    this.t = t;
    const P = PLANES;
    this.root.visible = t < P.gone;
    if (!this.root.visible) return;
    for (let i = 0; i < this.flights.length; i++) flightMatrix(this.flights[i], t, this.planeM[i]);
    const door = this.doorK(t), ramp = this.rampK(t), retract = this.retractK(t);
    if (this.template) {
      for (const p of this.props) p.rotation.z += 31 * dt;
      this.template.traverse((o) => {
        if (o.name === "C130_Ramp") rampPose(o, ramp, retract);
        if (o.name === "C130_Door") o.rotation.x = HOLD.doorOpen * door;
      });
      this.template.updateMatrixWorld(true);
      for (const part of this.parts) {
        const { inst, src, prop, rel } = part;
        if (prop) {
          let k = 0;
          for (let i = 0; i < this.flights.length; i++) {
            for (const pn of this.props) {
              inst.setMatrixAt(k++, i === this.ridden ? HIDDEN : _m.multiplyMatrices(this.planeM[i], _m2.multiplyMatrices(pn.matrixWorld, rel)));
            }
          }
        } else {
          for (let i = 0; i < this.flights.length; i++) {
            inst.setMatrixAt(i, i === this.ridden ? HIDDEN : _m.multiplyMatrices(this.planeM[i], src.matrixWorld));
          }
        }
        inst.instanceMatrix.needsUpdate = true;
      }
    }
    if (this.hold && this.ridden >= 0) {
      const f = this.flights[this.ridden];
      this.hold.group.matrix.copy(this.planeM[this.ridden]);
      this.hold.group.matrixWorldNeedsUpdate = true;
      this.hold.spin(dt);
      this.hold.setDoor(door);
      this.hold.setRamp(ramp, retract);
      const light = this.lightAt(f, t);
      if (light !== this.hold.light) this.hold.setLight(light);
      holdDaylight(0.14 + 0.3 * Math.max(ramp, door * 0.4));
    }
  }

  /* The ramp is open to walk off (its deck laid, the lip gone). */
  rampOpen(t) { return this.rampK(t) > 0.85; }

  /* Seats: which flight and seat slot n (humans by join time, then bots) gets. */
  static seatOf(n) {
    const per = PLANES.seats, count = PLANES.count;
    return { plane: Math.min(count - 1, Math.floor(n / per)), seat: n % per };
  }

  /* When every plane is past its island (the zone can go live). */
  lastOut() { return Math.max(...this.flights.map((f) => f.tOut)); }

  dispose() {
    this.disposed = true;
    this.hold?.dispose();
    this.hold = null;
    for (const { inst } of this.parts) { inst.material.dispose(); inst.dispose(); }
    this.parts = [];
    this.root.removeFromParent();
  }
}

export { RAMP_END, HOLD };
/* The ramp: lowered (k 0 shut .. 1 level), then slid in under the floor
   (r 0 .. 1 all the way in). */
export function rampPose(o, k, r = 0) {
  const home = o.userData.home ??= o.position.clone();
  o.rotation.x = HOLD.rampShut * (1 - k);
  o.position.set(home.x, home.y - 0.25 * Math.min(1, r * 4), home.z - HOLD.rampLen * r);
}
