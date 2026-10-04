// Troll Forces — the first-person life of the Peacemakers (revolvers.js):
// both guns, every frame.
//
// game.js poses the pair's root like any gun (hip, bob, sway, sprint,
// turn lag); this moves each gun inside it:
//   - the shot: that gun flips up round the trigger finger, its hammer
//     falls and is thumbed back, the cylinder turns a chamber
//   - the reload: the guns roll in, the cylinders swing out, the muzzles go
//     up and the brass falls out, the muzzles come down and two
//     speedloaders drop in, a flick of the wrists swings the cylinders shut
//     spinning, and a twirl back to the hip
//   - the inspect ("admire"): a double twirl, up crossed in front of the
//     face, blow the smoke off, toss them both up spinning and catch, and
//     a holster spin home
// Plus the brass falling away and gunsmoke, from small pools made once.
// Nothing here adds a light (light-pool.js).

import * as THREE from "three";
import { CYL } from "./revolvers.js?v=rv2";

const TAU = Math.PI * 2;
const COCK = 0.55;              // hammer back
export const AKIMBO_INSPECT_TIME = 3.6;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (v) => { v = clamp01(v); return v * v * (3 - 2 * v); };
const ease = (a, b, t) => smooth((t - a) / (b - a));
const bell = (a, b, t) => Math.sin(clamp01((t - a) / (b - a)) * Math.PI);

/* Catmull-Rom keyframes, rows [t, v...] (the same sampler game.js uses for
   the long-gun inspect). */
function sampleKeys(keys, t, out) {
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const k1 = keys[i], k2 = keys[i + 1];
  const k0 = keys[i - 1], k3 = keys[i + 2];
  const span = k2[0] - k1[0];
  const u = clamp01((t - k1[0]) / span);
  const u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  for (let j = 1; j < k1.length; j++) {
    const m1 = k0 ? (k2[j] - k0[j]) / (k2[0] - k0[0]) * span : 0;
    const m2 = k3 ? (k3[j] - k1[j]) / (k3[0] - k1[0]) * span : 0;
    out[j - 1] = h00 * k1[j] + h10 * m1 + h01 * k2[j] + h11 * m2;
  }
  return out;
}

/* The hand (side) through the reload, per gun, mirrored on the left:
   [t, in, up, back, pitch(muzzle up), yaw(muzzle in), roll(top in)] */
const RELOAD_SIDE = [
  [0.00, 0.000, 0.000, 0.000, 0.00, 0.00, 0.00],
  [0.10, 0.030, 0.030, 0.020, 0.18, 0.14, 0.55],
  [0.18, 0.040, 0.040, 0.020, 0.30, 0.18, 0.80],
  [0.26, 0.045, 0.085, 0.040, 1.25, 0.10, 0.55],
  [0.36, 0.045, 0.090, 0.040, 1.30, 0.08, 0.50],
  [0.44, 0.050, -0.010, -0.020, -0.70, 0.12, 0.85],
  [0.58, 0.050, -0.020, -0.020, -0.80, 0.10, 0.90],
  [0.66, 0.035, 0.010, 0.000, -0.10, 0.10, 0.70],
  [0.72, 0.020, 0.030, 0.010, 0.15, 0.06, -0.15],
  [0.80, 0.010, 0.010, 0.000, 0.05, 0.02, 0.05],
  [1.00, 0.000, 0.000, 0.000, 0.00, 0.00, 0.00],
];

/* The hand through the inspect: [t, in, up, back, pitch, yaw, roll]. */
const INSPECT_SIDE = [
  [0.00, 0.000, 0.000, 0.000, 0.00, 0.00, 0.00],
  [0.06, 0.010, 0.030, -0.010, 0.10, 0.00, 0.00],
  [0.24, 0.010, 0.040, -0.010, 0.10, 0.00, 0.00],
  [0.34, 0.170, 0.110, -0.060, 0.85, 0.50, -1.15],
  [0.46, 0.175, 0.120, -0.055, 0.95, 0.55, -1.20],
  [0.56, 0.165, 0.105, -0.065, 0.80, 0.50, -1.10],
  [0.62, 0.020, 0.030, 0.000, 0.15, 0.05, 0.00],
  [0.84, 0.010, 0.020, 0.000, 0.10, 0.00, 0.00],
  [1.00, 0.000, 0.000, 0.000, 0.00, 0.00, 0.00],
];

const _k = new Array(6).fill(0);
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _back = new THREE.Vector3();

function smokeTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  r.addColorStop(0, "rgba(235,230,220,.75)");
  r.addColorStop(0.5, "rgba(210,205,195,.35)");
  r.addColorStop(1, "rgba(200,195,185,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createAkimboView({ weaponRig, audio }) {
  // brass that falls out of the cylinders, twelve at a time
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd8a848, roughness: 0.3, metalness: 0.9 });
  const caseGeo = new THREE.CylinderGeometry(0.0058, 0.0058, 0.038, 8);
  const casings = [];
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(caseGeo, brassMat);
    m.visible = false;
    m.userData = { vel: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0 };
    weaponRig.add(m);
    casings.push(m);
  }
  // gunsmoke
  const smokeMat = new THREE.MeshBasicMaterial({ map: smokeTexture(), transparent: true, depthWrite: false, opacity: 0.6 });
  const smokeGeo = new THREE.PlaneGeometry(1, 1);
  const puffs = [];
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(smokeGeo, smokeMat.clone());
    m.visible = false;
    m.renderOrder = 5;
    m.userData = { vel: new THREE.Vector3(), life: 0, max: 1, size: 0.03, grow: 0.12 };
    weaponRig.add(m);
    puffs.push(m);
  }
  let nextCase = 0, nextPuff = 0;

  const rigLocal = (o, out) => {
    o.getWorldPosition(out);
    return weaponRig.worldToLocal(out);
  };

  function puff(at, vel, { size = 0.025, grow = 0.1, life = 0.8, alpha = 0.55 } = {}) {
    const m = puffs[nextPuff++ % puffs.length];
    m.position.copy(at);
    m.userData.vel.copy(vel);
    m.userData.life = m.userData.max = life;
    m.userData.size = size;
    m.userData.grow = grow;
    m.userData.alpha = alpha;
    m.rotation.z = Math.random() * TAU;
    m.visible = true;
  }

  function state(w) {
    return w._ak ??= {
      kick: [0, 0], hammer: [1, 1], index: [0, 0], shown: [0, 0], spin: [0, 0],
      fired: new Set(), wasReloading: false, blew: false, inspectWas: false,
    };
  }

  /* A shot from `side` (0 right, 1 left). */
  function onShot(mesh, w, side, fan = false) {
    const st = state(w);
    st.kick[side] = fan ? 0.75 : 1;
    st.hammer[side] = 0;
    st.index[side] += 1;
    const sd = mesh?.userData.sides?.[side];
    if (!sd) return;
    rigLocal(sd.muzzle, _v);
    puff(_v, new THREE.Vector3((Math.random() - 0.5) * 0.04, 0.05, -0.03), { size: 0.03, grow: 0.16, life: 0.7, alpha: 0.4 });
  }

  /* Where `side`'s muzzle is in the rig (the flash goes there). */
  function muzzleLocal(mesh, side, out) {
    const sd = mesh?.userData.sides?.[side];
    if (!sd) return out;
    mesh.updateMatrixWorld(true);
    return rigLocal(sd.muzzle, out);
  }

  function dumpBrass(sd) {
    sd.gun.updateMatrixWorld(true);
    // "back" out of the cylinder, in the rig: the gun's +Z
    sd.gun.getWorldQuaternion(_q);
    _back.set(0, 0, 1).applyQuaternion(_q);
    for (const r of sd.roundList) {
      const c = casings[nextCase++ % casings.length];
      rigLocal(r, c.position);
      r.getWorldQuaternion(c.quaternion);
      c.quaternion.multiply(_q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
      c.userData.vel.copy(_back).multiplyScalar(0.35 + Math.random() * 0.2);
      c.userData.vel.x += (Math.random() - 0.5) * 0.25;
      c.userData.vel.y += 0.05 + Math.random() * 0.1;
      c.userData.spin.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
      c.userData.life = 1.1;
      c.visible = true;
    }
  }

  /* Every frame while the pair is the gun in hand. `reload` is 0..1 through
     a reload (or -1), `inspect` 0..1 through the admire (or -1). */
  function update(mesh, w, dt, { reload = -1, inspect = -1 } = {}) {
    const u = mesh.userData;
    if (!u.sides) return;
    const st = state(w);

    // reload beats, once each
    if (reload >= 0) {
      if (!st.wasReloading) { st.fired.clear(); st.wasReloading = true; }
      const beat = (name, at, fn) => { if (reload >= at && !st.fired.has(name)) { st.fired.add(name); fn(); } };
      beat("out", 0.13, () => audio.cylinderOut?.());
      beat("eject", 0.27, () => { for (const sd of u.sides) dumpBrass(sd); audio.brassTinkle?.(12); });
      beat("load", 0.55, () => audio.speedloader?.());
      beat("shut", 0.7, () => { audio.cylinderSpin?.(); st.spin[0] = st.spin[1] = 1; });
    } else if (st.wasReloading) {
      st.wasReloading = false;
      st.index[0] = st.index[1] = Math.round(st.index[0]);
    }
    if (inspect < 0) st.blew = false;

    for (let i = 0; i < 2; i++) {
      const sd = u.sides[i];
      const s = sd.s;
      // decaying recoil, the hammer coming back, the cylinder catching up
      st.kick[i] = Math.max(0, st.kick[i] - dt * 7);
      st.hammer[i] = Math.min(1, st.hammer[i] + dt / 0.2);
      st.shown[i] += (st.index[i] - st.shown[i]) * Math.min(1, dt * 18);
      st.spin[i] = Math.max(0, st.spin[i] - dt * 1.4);

      // rest pose
      sd.side.position.copy(sd.restPos);
      sd.side.rotation.copy(sd.restRot);
      sd.pivot.rotation.set(0, 0, 0);
      sd.pivot.position.copy(sd.pivotRest ??= sd.pivot.position.clone());
      let crane = 0, roundsZ = 0, loaderZ = 0.0075, loaderOn = false, roundsOn = true;

      // the hand's track (reload or inspect), mirrored for the left gun
      let track = null, tt = 0;
      if (reload >= 0) { track = RELOAD_SIDE; tt = reload; }
      else if (inspect >= 0) { track = INSPECT_SIDE; tt = inspect; }
      if (track) {
        const [inw, up, back, pitch, yaw, roll] = sampleKeys(track, tt, _k);
        sd.side.position.x -= s * inw;
        sd.side.position.y += up;
        sd.side.position.z += back;
        sd.side.rotation.x += pitch;
        sd.side.rotation.y += s * yaw;
        sd.side.rotation.z += s * roll;
      }

      if (reload >= 0) {
        const r = reload;
        crane = ease(0.12, 0.17, r) * (1 - ease(0.69, 0.725, r));
        // the ejector's shove, then empty chambers until the loaders land
        roundsZ = r < 0.27 ? 0.012 * ease(0.24, 0.27, r) : 0;
        roundsOn = !(r >= 0.27 && r < 0.42);
        if (r >= 0.42 && r < 0.7) {
          loaderOn = true;
          // the rounds ride the loader down into the chambers...
          roundsZ = 0.32 * (1 - ease(0.42, 0.55, r));
          // ...and the loader is pulled away once they're in
          loaderZ = 0.0075 + 0.25 * ease(0.58, 0.68, r);
          if (r > 0.67) loaderOn = false;
        }
        // the wrist flick spins the cylinder as it shuts; the twirl home
        sd.pivot.rotation.x -= TAU * ease(0.8, 0.97, r + (i ? 0.015 : 0));
      }
      if (inspect >= 0) {
        const q = inspect;
        const lag = i ? 0.035 : 0;
        // two forward spins round the trigger finger, left a beat behind
        sd.pivot.rotation.x -= 2 * TAU * ease(0.04 + lag, 0.24 + lag, q);
        // crossed: muzzles up by the face; the right gun's barrel gets
        // blown clean
        if (i === 0 && q > 0.45 && !st.blew) {
          st.blew = true;
          rigLocal(sd.muzzle, _v);
          for (let k = 0; k < 4; k++) puff(_v.clone().add(new THREE.Vector3(0, k * 0.01, 0)), new THREE.Vector3(0.12 + k * 0.03, 0.06, -0.02), { size: 0.025, grow: 0.22, life: 0.9, alpha: 0.5 });
        }
        // the toss: each gun leaves the hand, backflips, comes down into it
        const tu = clamp01((q - (0.6 + lag)) / 0.2);
        if (tu > 0 && tu < 1) {
          sd.pivot.position.y += 0.2 * Math.sin(tu * Math.PI);
          sd.pivot.position.z -= 0.04 * Math.sin(tu * Math.PI);
          sd.pivot.rotation.x += TAU * smooth(tu);
          sd.pivot.rotation.z += s * 0.4 * Math.sin(tu * Math.PI);
        }
        // the holster spin, slowing into the hip
        sd.pivot.rotation.x -= TAU * (1 - Math.pow(1 - clamp01((q - 0.84 - lag * 0.5) / 0.15), 2.2));
      }
      // the shot: muzzle flips up round the trigger, the hand rides back
      const k = st.kick[i] * st.kick[i];
      sd.pivot.rotation.x += k * 0.6;
      sd.side.position.z += k * 0.035;
      sd.side.position.y += k * 0.012;
      sd.side.rotation.z += s * k * 0.08;

      // the gun's own moving parts
      sd.crane.rotation.z = crane * 1.5;
      const spinA = st.spin[i] * st.spin[i] * TAU * 2.2;
      sd.cyl.rotation.z = (st.shown[i] * Math.PI) / 3 + spinA;
      sd.hammer.rotation.x = COCK * smooth((st.hammer[i] - 0.25) / 0.75);
      sd.rounds.position.z = roundsZ;
      sd.rounds.visible = roundsOn;
      sd.loader.visible = loaderOn;
      sd.loader.position.z = loaderZ;
    }

    // brass falling away, smoke drifting up
    for (const c of casings) {
      if (!c.visible) continue;
      const d = c.userData;
      d.life -= dt;
      if (d.life <= 0) { c.visible = false; continue; }
      d.vel.y -= 3.2 * dt;
      c.position.addScaledVector(d.vel, dt);
      c.rotation.x += d.spin.x * dt;
      c.rotation.y += d.spin.y * dt;
      c.rotation.z += d.spin.z * dt;
    }
    for (const p of puffs) {
      if (!p.visible) continue;
      const d = p.userData;
      d.life -= dt;
      if (d.life <= 0) { p.visible = false; continue; }
      const age = 1 - d.life / d.max;
      p.position.addScaledVector(d.vel, dt);
      d.vel.multiplyScalar(Math.max(0, 1 - dt * 1.5));
      p.scale.setScalar(d.size + d.grow * age);
      p.material.opacity = d.alpha * (1 - age) * Math.min(1, age * 8);
      p.rotation.z += dt * 0.4;
    }
  }

  /* Off the pair (swap, death): nothing left hanging in the air. */
  function hideFx() {
    for (const c of casings) c.visible = false;
    for (const p of puffs) p.visible = false;
  }

  return { onShot, update, muzzleLocal, hideFx };
}

export { CYL };
