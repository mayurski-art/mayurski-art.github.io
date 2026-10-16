// Troll Forces — the C-130's cargo hold, Troll Royale's drop plane (PLANES.md).
//
// Two Blender models (models/build_c130.blender.py, build_c130_hold.blender.py):
//   c130.glb       the airframe: C130_Hull > C130_Liner, C130_Ramp, C130_Door,
//                  C130_Prop_1..4
//   c130-hold.glb  the inside: C130_Hold > Hold_Seat_0..8
// Both share one frame: the origin is the middle of the cargo floor, -z is
// the nose, the hold runs z -6.25 (the flight deck's wall) .. +6.25 (the
// ramp's hinge) and the ramp lowers to reach z +9.35.
//
// The "ghost hold": riders walk a STATIC, axis-aligned copy of the hold
// made of ordinary colliders parked in the sky at `origin`. Nothing in
// movement or the colliders knows the plane moves; royale-planes.js draws
// the hold (and the bodies in it, and the camera) through the plane's
// matrix instead. Ghost point -> plane-local = ghost - origin.

import * as THREE from "three";
import { loadModel } from "../battlefield-props.js?v=sr1";

export const HOLD = {
  halfW: 1.56,          // the walls at the floor
  ceiling: 2.74,
  fwd: -6.25,           // the flight deck's wall (local z)
  hinge: 6.25,          // the ramp's hinge
  rampLen: 3.1,
  rampShut: -25 * Math.PI / 180,   // C130_Ramp rotation.x shut (0 = level)
  doorOpen: 64 * Math.PI / 180,    // C130_Door rotation.x open (0 = shut): up into the tail
  seats: 9,
};
export const RAMP_END = HOLD.hinge + HOLD.rampLen;
/* The nine seats' pans (plane-local x, z): build_c130_hold.blender.py
   SEATS, five down the port wall, four down the starboard. The glb's
   Hold_Seat_N empties say the same; this copy is for before it loads. */
export const SEAT_SPOTS = [[-1, 4.3], [1, 3.4], [-1, 2.5], [1, 1.6], [-1, 0.7], [1, -0.2], [-1, -1.1], [1, -2.0], [-1, -2.9]]
  .map(([side, y]) => ({ x: side * 1.3, z: -y }));

/* Both models (loadModel fetches once and hands out clones). */
export function preloadPlane() {
  return Promise.all([loadModel("c130"), loadModel("c130-hold")]);
}

const LIGHTS = { red: 0xff2a14, green: 0x2aff5a };

/* Inside, the hull keeps most of the sun out, but it can't cast a shadow
   up here (the sun's shadow camera covers the island, not the sky), so
   the hold's materials damp the direct light themselves: the inside reads
   as a dim bay lit by its lamps, brighter once the ramp is open. */
const HOLD_SUN = { value: 0.14 };
function damped(m) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uHoldSun = HOLD_SUN;
    sh.fragmentShader = "uniform float uHoldSun;\n" + sh.fragmentShader.replace("#include <lights_fragment_begin>",
      THREE.ShaderChunk.lights_fragment_begin.replace("getDirectionalLightInfo( directionalLight, directLight );",
        "getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= uHoldSun;"));
  };
  m.customProgramCacheKey = () => "royale-hold";
}
/* How much of the sun gets in, 0..1. */
export function holdDaylight(k) { HOLD_SUN.value = k; }

/* The hold as built from the models: the airframe you ride (liner hidden:
   the hold is drawn instead) with the inside in it, all in `group`
   (plane-local, origin the floor's middle), and its ghost colliders in
   `colliders` at `origin` (world). Resolves once both models are in.
   ctx: { scene, colliders } (the map's collider list). */
export class Hold {
  constructor(ctx, origin) {
    this.ctx = ctx;
    this.origin = origin.clone();
    this.group = new THREE.Group();
    this.group.name = "c130-ridden";
    this.colliders = [];
    this.lip = null;          // the shut ramp's collider across the hinge
    this.seats = [];          // { x, y, z (ghost, world), yaw, local }
    this.ramp = null;
    this.door = null;
    this.props = [];
    this.mats = { red: [], green: [], glow: [] };
    this.rampK = 0;
    this.doorK = 0;
    this.light = "off";
    this.layColliders();
    this.ready = preloadPlane().then(([plane, inside]) => {
      this.fit(plane, inside);
      return this;
    });
  }

  /* ---- the ghost: colliders at origin --------------------------------- */

  layColliders() {
    const { colliders } = this.ctx;
    const o = this.origin, W = HOLD.halfW;
    const push = (x0, x1, y0, y1, z0, z1) => {
      const c = { min: new THREE.Vector3(o.x + x0, o.y + y0, o.z + z0), max: new THREE.Vector3(o.x + x1, o.y + y1, o.z + z1), pen: 99 };
      colliders.push(c);
      this.colliders.push(c);
      return c;
    };
    push(-W, W, -1, 0, HOLD.fwd, HOLD.hinge);                 // the floor
    this.rampFloor = null;                                     // the lowered ramp's deck, laid at green
    push(-W - 1, -W, 0, 3.2, HOLD.fwd - 1, RAMP_END);         // the walls, the ramp's sides too
    push(W, W + 1, 0, 3.2, HOLD.fwd - 1, RAMP_END);
    push(-W - 1, W + 1, HOLD.ceiling, HOLD.ceiling + 1, HOLD.fwd - 1, RAMP_END);   // the roof
    push(-W - 1, W + 1, 0, 3.2, HOLD.fwd - 1, HOLD.fwd);      // the flight deck's wall
    push(-0.43, 0.43, 0, 0.98, -4.65, -2.1);                  // the pallet: the crate, the cans on it
    push(0.85, W, 0, 0.5, -6.25, -5.2);                       // the cans in the forward corner
    push(0.2, 0.75, 0, 0.5, -6.25, -5.75);                    // ...and the jerry cans
    push(-1.3, -0.5, 0, 1.0, -6.25, -5.1);                    // the steps up to the crew hatch
    this.lip = push(-W, W, 0, 3.2, HOLD.hinge, HOLD.hinge + 0.4);   // the shut ramp
  }

  /* Opening the ramp lays its deck and drops the lip (and the reverse). */
  setRampOpen(open) {
    const { colliders } = this.ctx;
    const drop = (c) => { const i = colliders.indexOf(c); if (i >= 0) colliders.splice(i, 1); const j = this.colliders.indexOf(c); if (j >= 0) this.colliders.splice(j, 1); };
    const o = this.origin, W = HOLD.halfW;
    if (open && this.lip) {
      drop(this.lip);
      this.lip = null;
      const c = { min: new THREE.Vector3(o.x - W, o.y - 1, o.z + HOLD.hinge), max: new THREE.Vector3(o.x + W, o.y, o.z + RAMP_END), pen: 99 };
      colliders.push(c);
      this.colliders.push(c);
      this.rampFloor = c;
    } else if (!open && !this.lip) {
      if (this.rampFloor) { drop(this.rampFloor); this.rampFloor = null; }
      const c = { min: new THREE.Vector3(o.x - W, o.y, o.z + HOLD.hinge), max: new THREE.Vector3(o.x + W, o.y + 3.2, o.z + HOLD.hinge + 0.4), pen: 99 };
      colliders.push(c);
      this.colliders.push(c);
      this.lip = c;
    }
  }

  /* Ghost (world) point -> plane-local, and back. */
  toLocal(v, out = new THREE.Vector3()) { return out.copy(v).sub(this.origin); }
  toGhost(v, out = new THREE.Vector3()) { return out.copy(v).add(this.origin); }

  /* Inside the ghost hold (or on its ramp), with a little slack overhead. */
  contains(v, pad = 0.5) {
    const x = v.x - this.origin.x, y = v.y - this.origin.y, z = v.z - this.origin.z;
    return Math.abs(x) <= HOLD.halfW + pad && y > -1.5 && y < HOLD.ceiling + pad && z >= HOLD.fwd - pad && z <= RAMP_END + pad;
  }

  /* ---- the models --------------------------------------------------- */

  fit(plane, inside) {
    plane.traverse((n) => {
      if (n.isMesh) { n.castShadow = false; n.receiveShadow = false; }
      if (n.name === "C130_Liner") n.visible = false;
      if (n.name === "C130_Ramp") this.ramp = n;
      if (n.name === "C130_Door") this.door = n;
      // the ramp's deck and the door's inside are seen from the hold: damped like it
      if (n.isMesh && /^C130_(Ramp|Door)/.test(n.parent?.name + n.name)) damped(n.material);
      if (/^C130_Prop_\d$/.test(n.name)) this.props.push(n);
    });
    inside.traverse((n) => {
      if (n.isMesh) {
        n.castShadow = false;
        n.receiveShadow = false;
        for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
          damped(m);
          const key = m.name === "H_JumpRed" ? "red" : m.name === "H_JumpGreen" ? "green" : m.name === "H_Glow" ? "glow" : null;
          if (key) this.mats[key].push(m);
        }
      }
      const s = /^Hold_Seat_(\d)$/.exec(n.name);
      if (s) {
        const local = n.position.clone();
        // a seat on the port wall (x < 0) faces +x (yaw -PI/2), starboard faces -x
        this.seats[+s[1]] = { local, yaw: local.x < 0 ? -Math.PI / 2 : Math.PI / 2, ghost: local.clone().add(this.origin) };
      }
    });
    for (const m of this.mats.glow) { m.emissive = new THREE.Color(0xfff1d8); m.emissiveIntensity = 1.6; }
    this.group.add(plane, inside);
    this.plane = plane;
    this.inside = inside;
    this.setRamp(this.rampK);
    this.setDoor(this.doorK);
    this.setLight(this.light);
  }

  /* 0 shut .. 1 level with the floor. */
  setRamp(k) {
    this.rampK = k;
    if (this.ramp) this.ramp.rotation.x = HOLD.rampShut * (1 - k);
  }

  /* 0 shut .. 1 up in the tail. */
  setDoor(k) {
    this.doorK = k;
    if (this.door) this.door.rotation.x = HOLD.doorOpen * k;
  }

  /* "off" | "red" | "green": the jump lights by the ramp. */
  setLight(mode) {
    this.light = mode;
    for (const key of ["red", "green"]) {
      for (const m of this.mats[key]) {
        m.emissive = new THREE.Color(mode === key ? LIGHTS[key] : 0x000000);
        m.emissiveIntensity = mode === key ? (key === "green" ? 1.4 : 2.4) : 0;
      }
    }
  }

  /* Props spin (the rate is what reads as a turboprop at 30-60 fps, not the real 1020 rpm). */
  spin(dt, rate = 31) {
    for (const p of this.props) p.rotation.z += rate * dt;
  }

  dispose() {
    const { colliders } = this.ctx;
    for (const c of this.colliders) { const i = colliders.indexOf(c); if (i >= 0) colliders.splice(i, 1); }
    this.colliders = [];
    this.group.removeFromParent();
    // geometry is the loader's cache (shared); the cloned materials are ours
    this.group.traverse((n) => { if (n.isMesh) for (const m of Array.isArray(n.material) ? n.material : [n.material]) m.dispose(); });
  }
}
