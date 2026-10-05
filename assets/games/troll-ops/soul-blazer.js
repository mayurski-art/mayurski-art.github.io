// Troll Forces — the Soul Blazer (weapons.js `soulblazer`), the Hellseeker
// shotgun: "It feeds on the dead. And spits fire."
//
// It shoots like a shotgun; everything here is how it looks and sounds
// doing it. weapon-model.js builds the Blender model
// (models/build_soulblazer.blender.py) and hands it to rigSoulBlazer, which
// makes the gun alive:
//   - the skull and blade charms under the barrels hang on pendulums and
//     swing from the gun's real motion (your walking, turning, recoil, the
//     pump), in first person, in third person and on other players;
//   - the muzzle skull's jaw snaps open on every shot;
//   - the cracks breathe with ember light that flows toward the muzzle, and
//     the six skulls down each flank are the shell counter: their eyes burn
//     while their shell is in the tube. Fire the last shell and the gun goes
//     out until it is fed again.
// All of that is driven from timestamps on `mesh.userData.sb` and runs in
// the meshes' own onBeforeRender, so any copy of the gun animates itself.
//
// HellfireFx is the fire: one pooled, instanced billboard system (one draw
// call for the flames, one for the smoke) for the muzzle burst, the burning
// pellets, the flame licks where they land and the kill burst. The flame
// frames are drawn once onto a canvas: soft shapes, no per-pixel noise.
//
// Also here: the bespoke admire (SB_INSPECT_KEYS + soulBlazerInspectCues)
// and the two reloads (soulBlazerReloadPose): "feeding the skulls" and,
// from empty, "relight it": a shell dropped into the open port and the
// pump slammed home, which reignites the gun.

import * as THREE from "three";

const SLOTS = 6;
const JAW_MAX = 0.52;          // radians the jaw drops at full open
const CHARM_LEN = 0.12;        // simulated pendulum length (m): slower, heavier swing than the real 3 cm
const CHARM_MAX = 1.15;        // radians off the gun's down axis
const MUZZLE_Z = -0.66;
const STOCK_Z = 0.35;

const _m = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const DOWN = new THREE.Vector3(0, -1, 0);
const now = () => performance.now();

/* ---------------------------------------------------------------- the rig */

/* Called once per built gun. `root` holds the model's nodes (charms and
   the jaw already flattened onto it by weapon-model.js, each mesh with
   userData.rest = its matrix at rest and userData.pivot = where it turns). */
export function rigSoulBlazer(root, { glowTexture, slotZ, eyes = [], mouth }) {
  const zs = [...slotZ].sort((a, b) => b - a);          // rear to front
  const U = {
    uTime: { value: 0 }, uHeat: { value: 1 }, uWave: { value: -99 }, uFlare: { value: 0 },
    uJaw: { value: 0 }, uLit: { value: new Array(SLOTS).fill(1) }, uCharm: { value: 0 },
    uSlotZ0: { value: zs[0] }, uSlotDZ: { value: zs.length > 1 ? (zs[0] - zs[zs.length - 1]) / (zs.length - 1) : 0.031 },
  };
  const sb = {
    U,
    lastShot: -1e9,          // ms: a shot (jaw snap, flare, charm kick)
    ammo: SLOTS, mag: SLOTS, // shell counter inputs (first person sets these)
    ignite: -1e9,            // ms: the gun relit (ember wave, roar)
    kick: -1e9, kickAmt: 1,  // ms: a jolt for the charms (pump, rattle)
    jawHold: 0,              // 0..1 held open (admire, reload)
    waveAt: null,            // a wave position the admire sets directly
    charmGlow: 0,            // the charms' eyes, 0..1
    view: null,              // first person: weapon scene -> true world
    heat: 1, jaw: 0, lit: new Array(SLOTS).fill(1), lastTick: 0,
    halos: [],
  };
  root.userData.sb = sb;
  sb.slotZ = zs;

  // Shaders: emissive driven by the gun's state. vSbPos is object space,
  // which is gun space for every body mesh (and stays so when a remote
  // player's copy is merged).
  const hook = (m, key, body) => {
    m.customProgramCacheKey = () => key;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = "varying vec3 vSbPos;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vSbPos = position;");
      sh.fragmentShader = `uniform float uTime, uHeat, uWave, uFlare, uJaw, uCharm, uSlotZ0, uSlotDZ;
uniform float uLit[${SLOTS}];
varying vec3 vSbPos;
` + sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n" + body);
    };
  };
  const WAVE = "float sbWave = uWave > -9.0 ? exp(-pow((vSbPos.z - uWave) * 16.0, 2.0)) : 0.0;\n";
  const FLICK = "float sbFlick = 0.86 + 0.14 * sin(uTime * 9.0 + vSbPos.x * 300.0) * sin(uTime * 13.7 + vSbPos.y * 200.0);\n";
  root.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material;
    if (m.userData.sbHooked) return;
    m.userData.sbHooked = true;
    switch (m.name) {
      case "SB_Ember":
      case "SB_Rune":
        // Molten light flowing toward the muzzle; out when the gun is dead.
        hook(m, "sb-ember", WAVE + `
  float sbFlow = 0.62 + 0.38 * sin(uTime * 3.4 + vSbPos.z * 70.0) * sin(uTime * 1.9 + vSbPos.z * 23.0 + vSbPos.y * 90.0);
  float sbLit = clamp(uHeat * sbFlow + sbWave * 2.6 + uFlare * 1.4, 0.0, 4.0);
  totalEmissiveRadiance *= sbLit;
  diffuseColor.rgb *= mix(0.12, 1.0, clamp(uHeat + sbWave, 0.0, 1.0));`);
        break;
      case "SB_Eye":
        hook(m, "sb-eye", WAVE + FLICK + `
  totalEmissiveRadiance *= uHeat * sbFlick + uFlare * 2.2 + sbWave * 3.0;
  diffuseColor.rgb *= mix(0.1, 1.0, clamp(uHeat + sbWave, 0.0, 1.0));`);
        break;
      case "SB_Throat":
        hook(m, "sb-throat", FLICK + `
  totalEmissiveRadiance *= 0.18 * uHeat * sbFlick + uFlare * 3.0 + uJaw * 1.6 * max(uHeat, 0.25);
  diffuseColor.rgb *= mix(0.08, 1.0, clamp(uHeat + uFlare, 0.0, 1.0));`);
        break;
      case "SB_SlotEye":
        // One shell per skull: which skull this fragment belongs to comes
        // from where it sits along the gun.
        hook(m, "sb-slot", WAVE + FLICK + `
  int sbI = int(clamp(floor((uSlotZ0 - vSbPos.z) / uSlotDZ + 0.5), 0.0, ${SLOTS - 1}.0));
  float sbL = uLit[sbI];
  totalEmissiveRadiance *= sbL * sbFlick + sbWave * 2.5;
  diffuseColor.rgb *= mix(0.12, 1.0, clamp(sbL + sbWave, 0.0, 1.0));`);
        break;
      case "SB_CharmEye":
        hook(m, "sb-charm", FLICK + `
  totalEmissiveRadiance *= 0.25 * uHeat * sbFlick + uCharm * 2.5 + uFlare * 0.8;`);
        break;
      default:
    }
  });

  // Charms and jaw: the meshes weapon-model.js flattened onto the root.
  const charms = new Map();
  const jaw = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.userData.charm != null) {
      const id = o.userData.charm;
      if (!charms.has(id)) charms.set(id, newCharm(id, o.userData.pivot));
      const c = charms.get(id);
      o.onBeforeRender = () => { tick(sb, root); stepCharm(c, sb, o.parent); placeAbout(o, c.q); };
      o.matrixAutoUpdate = false;
    } else if (o.userData.jaw) {
      jaw.push(o);
      o.onBeforeRender = () => { tick(sb, root); placeJaw(o, sb); };
      o.matrixAutoUpdate = false;
    }
  });
  sb.charms = [...charms.values()];
  sb.jawMeshes = jaw;

  // The view model has no bloom: soft halos sell the glow (dropped from a
  // remote player's merged copy, which keeps only meshes).
  const halo = (pos, size, opacity, color) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity,
    }));
    s.position.copy(pos);
    s.scale.setScalar(size);
    s.renderOrder = 4;
    s.userData.base = { size, opacity };
    root.add(s);
    sb.halos.push(s);
    return s;
  };
  for (const e of eyes) halo(e, 0.03, 0.55, 0xff6a18);
  if (mouth) sb.mouthHalo = halo(mouth.clone().add(new THREE.Vector3(0, 0, 0.01)), 0.06, 0.0, 0xff5a10);
  sb.mouth = mouth?.clone() || new THREE.Vector3(0, 0, MUZZLE_Z);
  return sb;
}

function newCharm(id, pivot) {
  return {
    id, pivot: pivot.clone(), q: new THREE.Quaternion(),
    bob: null, prev: null, pw: new THREE.Vector3(), last: 0, kickSeen: 0, shotSeen: 0,
    // a little different each, so they never swing in step
    damp: 1.1 + (id % 3) * 0.35, len: CHARM_LEN * (0.85 + (id % 4) * 0.1), spin: 0, spinV: 0,
  };
}

/* One state update per frame for the whole gun (whichever of its meshes
   draws first runs it): the shader uniforms, the jaw, the halos. */
function tick(sb, root) {
  const t = now();
  if (t - sb.lastTick < 2) return;
  const dt = Math.min(0.1, (t - (sb.lastTick || t)) / 1000);
  sb.lastTick = t;
  const U = sb.U;
  U.uTime.value = (t / 1000) % 1000;

  const since = (t - sb.lastShot) / 1000;
  const flare = since >= 0 ? Math.exp(-since / 0.09) : 0;
  U.uFlare.value = flare;

  const frac = sb.mag > 0 ? Math.max(0, Math.min(1, sb.ammo / sb.mag)) : 1;
  const litN = sb.ammo > 0 ? Math.max(1, Math.round(frac * SLOTS)) : 0;
  const ig = (t - sb.ignite) / 1000;
  const hot = sb.ammo > 0 ? 1 : 0;
  // Out over 0.4 s; back on with the ignition wave.
  sb.heat += (hot - sb.heat) * Math.min(1, dt * (hot > sb.heat ? (ig < 0.8 ? 6 : 3) : 2.5));
  U.uHeat.value = sb.heat;
  for (let i = 0; i < SLOTS; i++) {
    const want = i < litN ? 1 : 0;
    sb.lit[i] += (want - sb.lit[i]) * Math.min(1, dt * (want > sb.lit[i] ? 7 : 10));
    U.uLit.value[i] = sb.lit[i];
  }
  // The ember wave: the admire sets it; an ignition runs it stock to muzzle.
  if (sb.waveAt != null) U.uWave.value = sb.waveAt;
  else if (ig >= 0 && ig < 0.55) U.uWave.value = STOCK_Z * 0.2 + (MUZZLE_Z - STOCK_Z * 0.2) * (ig / 0.5);
  else U.uWave.value = -99;

  // Jaw: snaps open on a shot, held open by the admire / reload.
  let shotJaw = 0;
  if (since >= 0 && since < 0.45) shotJaw = since < 0.035 ? since / 0.035 : since < 0.09 ? 1 : Math.max(0, 1 - (since - 0.09) / 0.3) ** 2;
  // the relight's roar: dropped wide for half a second
  const roarJaw = ig >= 0 && ig < 0.75 ? (ig < 0.06 ? ig / 0.06 : ig < 0.4 ? 1 : 1 - (ig - 0.4) / 0.35) : 0;
  const want = Math.max(shotJaw, sb.jawHold || 0, roarJaw);
  sb.jaw += (want - sb.jaw) * Math.min(1, dt * (want > sb.jaw ? 40 : 14));
  U.uJaw.value = sb.jaw;
  U.uCharm.value = sb.charmGlow || 0;

  for (let i = 0; i < sb.halos.length; i++) {
    const h = sb.halos[i];
    const b = h.userData.base;
    if (h === sb.mouthHalo) {
      const k = Math.max(flare * 1.4, sb.jaw * 0.7 * Math.max(0.3, sb.heat));
      h.material.opacity = Math.min(1, k);
      h.scale.setScalar(b.size * (0.7 + 0.8 * k));
    } else {
      const flick = 0.85 + 0.15 * Math.sin(t * 0.011 + i) * Math.sin(t * 0.017);
      const wave = U.uWave.value > -9 ? Math.exp(-(((h.position.z - U.uWave.value) * 16) ** 2)) : 0;
      h.material.opacity = Math.min(1, b.opacity * (sb.heat * flick + flare * 1.2 + wave * 1.5));
      h.scale.setScalar(b.size * (1 + flare * 0.5 + wave * 0.6));
    }
  }
}

/* A charm is a bob on a string: Verlet in true world space (gravity down,
   the pivot carried by the gun), the string kept to length, then turned
   back into a rotation about the pivot in gun space. In first person the
   gun lives in the weapon scene, so sb.view maps it into the real world
   and the charms feel your running and turning. */
function stepCharm(c, sb, parent) {
  const t = now();
  // world matrix of the gun root
  _m.copy(parent.matrixWorld);
  if (sb.view) _m.premultiply(sb.view);
  const pw = _v.copy(c.pivot).applyMatrix4(_m);
  if (!c.bob || t - c.last > 400 || pw.distanceTo(c.pw) > 1.5) {
    // (Re)hang at rest: straight down in the world.
    c.bob = pw.clone().addScaledVector(DOWN, c.len);
    c.prev = c.bob.clone();
    c.pw.copy(pw);
    c.last = t;
    c.kickSeen = sb.kick;
    c.shotSeen = sb.lastShot;
    return;
  }
  let dt = Math.min(1 / 20, (t - c.last) / 1000);
  c.last = t;
  if (dt <= 0) return;
  const rot = _q.setFromRotationMatrix(_m2.extractRotation(_m));
  // Jolts: each shot throws them forward and up, the pump and the rattle
  // shake them, a little different for each charm.
  const jolt = (amt, seed) => {
    _v2.set((Math.sin(seed * 12.9 + c.id * 7.1)) * 0.35, 0.35 + 0.2 * Math.sin(c.id * 3.3 + seed), -1).normalize()
      .applyQuaternion(rot).multiplyScalar(amt * c.len * 0.9);
    c.prev.sub(_v2);
  };
  if (sb.lastShot > c.shotSeen) { c.shotSeen = sb.lastShot; jolt(0.35 + 0.1 * (c.id % 3), sb.lastShot); }
  if (sb.kick > c.kickSeen) { c.kickSeen = sb.kick; jolt(0.22 * (sb.kickAmt || 1), sb.kick + c.id); }

  const vel = _v2.subVectors(c.bob, c.prev);
  const keep = Math.exp(-dt * c.damp);
  c.prev.copy(c.bob);
  c.bob.addScaledVector(vel, keep).addScaledVector(DOWN, 9.8 * dt * dt);
  // the string
  const d = _v2.subVectors(c.bob, pw);
  const len = d.length() || 1;
  c.bob.copy(pw).addScaledVector(d, c.len / len);
  c.pw.copy(pw);

  // world direction -> gun space, kept off the barrels
  const dir = _v2.subVectors(c.bob, pw).normalize().applyQuaternion(rot.invert());
  const ang = dir.angleTo(DOWN);
  if (ang > CHARM_MAX) {
    const axis = _v.crossVectors(DOWN, dir).normalize();
    if (axis.lengthSq() > 1e-6) dir.copy(DOWN).applyAxisAngle(axis, CHARM_MAX);
  }
  // a slow twist on the chain from sideways swing
  c.spinV += (-dir.x * 6 - c.spin * 4) * dt;
  c.spinV *= Math.exp(-dt * 2);
  c.spin += c.spinV * dt;
  c.q.setFromUnitVectors(DOWN, dir).multiply(_q.setFromAxisAngle(DOWN, c.spin));
}

const _pv = new THREE.Vector3();
function placeAbout(o, q) {
  const p = o.userData.pivot;
  _m.makeTranslation(p.x, p.y, p.z);
  _m2.makeRotationFromQuaternion(q);
  _m.multiply(_m2);
  _m2.makeTranslation(-p.x, -p.y, -p.z);
  _m.multiply(_m2);
  o.matrix.multiplyMatrices(_m, o.userData.rest);
  o.matrixWorld.multiplyMatrices(o.parent.matrixWorld, o.matrix);
}

function placeJaw(o, sb) {
  _q.setFromAxisAngle(_pv.set(1, 0, 0), -sb.jaw * JAW_MAX);
  placeAbout(o, _q);
}

/* ------------------------------------------------- per-frame (first person) */

/* game.js calls this for the gun in hand: what only the shooter knows. */
export function updateSoulBlazerView(mesh, w, view) {
  const sb = mesh?.userData.sb;
  if (!sb) return;
  sb.ammo = w.ammoInMag;
  sb.mag = w.def.magSize;
  sb.view = view;
}

export function soulBlazerShot(mesh) {
  const sb = mesh?.userData.sb;
  if (sb) sb.lastShot = now();
}

export function soulBlazerKick(mesh, amt = 1) {
  const sb = mesh?.userData.sb;
  if (!sb) return;
  sb.kick = now();
  sb.kickAmt = amt;
}

export function soulBlazerIgnite(mesh) {
  const sb = mesh?.userData.sb;
  if (!sb) return;
  sb.ignite = now();
  sb.heat = Math.max(sb.heat, 0.2);
  soulBlazerKick(mesh, 1.6);
}

/* Where the fire comes out, in world space, and which way the gun points. */
export function soulBlazerMouth(mesh, outPos, outDir) {
  const sb = mesh?.userData.sb;
  mesh.updateMatrixWorld(true);
  outPos.copy(sb?.mouth || _v.set(0, 0, MUZZLE_Z)).applyMatrix4(mesh.matrixWorld);
  outDir.set(0, 0, -1).transformDirection(mesh.matrixWorld);
}

/* ----------------------------------------------------------- the admire */

/* [t, yaw°, twist°, tilt°, x, y, dz], read by game.js applyGunInspect.
   Beats: raise (0-.10), the awakening drift along the left side while the
   ember wave runs stock to muzzle (.10-.32), face to face with the skull
   (.34-.52), the roll through muzzle-away (.52-.65), right side on with the
   charms rattled twice (.65-.86), back to the hip. */
export const SB_INSPECT_TIME = 6.5;
export const SB_INSPECT_KEYS = [
  [0.00, 58, 26, -10, 0.07, -0.13, 0.08],
  [0.10, 86, 12, 2, 0.0, -0.035, 0.0],
  [0.20, 80, 6, 5, -0.01, -0.03, -0.02],
  [0.30, 85, 10, 3, 0.005, -0.032, -0.03],
  [0.36, 128, 2, 4, 0.11, -0.04, 0.02],
  [0.42, 146, -4, 8, 0.16, -0.05, -0.015],
  [0.50, 144, -2, 6, 0.15, -0.055, -0.015],
  [0.56, 60, 110, 0, 0.02, -0.03, 0.06],
  [0.61, -20, 250, 0, 0.0, -0.03, 0.08],
  [0.66, -86, 345, 2, 0.0, -0.035, 0.0],
  [0.71, -80, 340, 8, 0.01, -0.03, 0.0],
  [0.735, -85, 346, 11, 0.012, -0.021, 0.0],
  [0.75, -78, 338, 5, 0.008, -0.041, 0.0],
  [0.765, -85, 346, 11, 0.012, -0.021, 0.0],
  [0.78, -79, 339, 6, 0.008, -0.039, 0.0],
  [0.81, -82, 343, 7, 0.01, -0.03, 0.0],
  [0.86, -87, 343, 2, -0.004, -0.04, 0.0],
  [1.00, -48, 334, -10, 0.09, -0.14, 0.08],
];

/* The admire's cues, in order: game.js plays each once as t passes it. */
export const SB_INSPECT_CUES = [
  [0.12, "pentagram"],
  [0.30, "eyes"],
  [0.38, "growl"],
  [0.445, "tongue"],
  [0.49, "clack"],
  [0.495, "smoke"],
  [0.54, "roll"],
  [0.735, "rattle"],
  [0.765, "rattle"],
];

/* The admire's continuous part: the ember wave, the jaw, the charms' eyes.
   t < 0 hands everything back. `dead` (empty gun) skips the fire. */
export function soulBlazerInspect(mesh, t, dead) {
  const sb = mesh?.userData.sb;
  if (!sb) return;
  if (t < 0) { sb.waveAt = null; sb.jawHold = 0; sb.charmGlow = 0; return; }
  const ss = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  sb.waveAt = !dead && t > 0.12 && t < 0.33 ? STOCK_Z + (MUZZLE_Z - 0.02 - STOCK_Z) * ss(0.12, 0.32, t) : null;
  // slowly open (0.38-0.47), hold, snap shut at 0.49
  sb.jawHold = t < 0.38 ? 0 : t < 0.47 ? 0.85 * ss(0.38, 0.47, t) : t < 0.49 ? 0.85 : 0;
  sb.charmGlow = (t > 0.72 && t < 0.84 ? Math.sin((t - 0.72) / 0.12 * Math.PI) : 0) * (dead ? 0.3 : 1);
}

/* --------------------------------------------------------------- reloads */

/* The pose for both reloads, filling game.js's reload pose `p` the way
   shellReloadPose does. Driven by WeaponState's shell stages, so the pose
   can't drift from the ammo count. Also returns p.pumpBack (the pump's
   travel during the port load) and p.portShell (0..1 for the shell that
   drops into the open port, or -1). */
export function soulBlazerReloadPose(w, p) {
  const sr = w.def.shellReload;
  const c01 = (v) => Math.max(0, Math.min(1, v));
  const ss = (a, b, x) => { const k = c01((x - a) / (b - a)); return k * k * (3 - 2 * k); };
  const k = 1 - Math.max(0, w.shellT) / Math.max(0.001, w.shellDur);
  p.shellT = p.rack = p.magT = -1;
  p.pumpBack = null;
  p.portShell = -1;
  p.magHold = 0;
  if (w.shellStage === "port") {
    // Relight it: rolled ejection-port up, pump racked open and held, a
    // shell dropped in, the pump slammed home (ignition at k = 0.62), then
    // over into the feeding pose for the rest.
    const roll = ss(0, 0.16, k) * (1 - ss(0.66, 0.95, k));
    const over = ss(0.66, 0.95, k);
    p.x = -0.03 * roll - 0.035 * over;
    p.y = -0.03 * roll - 0.05 * over;
    p.z = 0.03 * roll + 0.02 * over;
    p.pitch = 0.16 * roll + 0.28 * over;
    p.yaw = 0.1 * roll + 0.06 * over;
    p.roll = 0.95 * roll - 0.7 * over;      // ejection port (right flank) up, then over onto the left
    p.pumpBack = k < 0.1 ? ss(0.02, 0.1, k) : k < 0.56 ? 1 : k < 0.62 ? 1 - ss(0.56, 0.62, k) : 0;
    p.portShell = k > 0.16 && k < 0.5 ? (k - 0.16) / 0.34 : -1;
    p.magHold = k < 0.56 ? Math.sin(c01(k / 0.56) * Math.PI) * 0.9 : 0;
    // The slam shoves the gun forward a touch.
    const slam = k > 0.56 && k < 0.7 ? Math.sin((k - 0.56) / 0.14 * Math.PI) : 0;
    p.z -= slam * 0.025;
    p.pitch -= slam * 0.06;
    return p;
  }
  // Feeding the skulls: rolled over so the left flank and the port face
  // you, muzzle up; each shell thumbed home with a shove.
  let env = 1;
  if (w.shellStage === "start") env = ss(0, 1, k);
  else if (w.shellStage === "end") env = ss(0, 1, c01(Math.max(0, w.shellT) / sr.end));
  let shove = 0;
  if (w.shellStage === "shell") {
    p.shellT = k;
    shove = Math.sin(c01((k - 0.62) / 0.38) * Math.PI);
  }
  p.x = -env * 0.02;
  p.y = -env * 0.05 + shove * 0.006;
  p.z = env * 0.02 - shove * 0.02;
  p.pitch = env * 0.28;
  p.yaw = env * 0.06;
  p.roll = -env * 0.7;          // left flank to you: watch each skull light as its shell goes in
  p.magHold = p.shellT < 0 ? 0 : Math.sin(c01(p.shellT / 0.85) * Math.PI) * 0.9;
  if (w.shellStage === "end" && w.shellDur > sr.end + 1e-4 && w.shellT > sr.end) {
    p.rack = 1 - (w.shellT - sr.end) / sr.rack;
  }
  return p;
}

/* ------------------------------------------------------------ hellfire FX */

let _atlas = null;
/* 4x4 frames: 0-13 a flame from birth to burn-out, 14 a soft puff (smoke,
   heat), 15 a spark (embers). Greyscale intensity; the shader colours it. */
function flameAtlas() {
  if (_atlas) return _atlas;
  const N = 128, c = document.createElement("canvas");
  c.width = c.height = N * 4;
  const g = c.getContext("2d");
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const blob = (x, y, rx, ry, a) => {
    g.save();
    g.translate(x, y);
    g.scale(1, ry / rx);
    const r = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    r.addColorStop(0, `rgba(255,255,255,${a})`);
    r.addColorStop(0.45, `rgba(255,255,255,${a * 0.55})`);
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.beginPath();
    g.arc(0, 0, rx, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  for (let f = 0; f < 14; f++) {
    const p = f / 13;
    const cx = (f % 4) * N + N / 2, cy = Math.floor(f / 4) * N + N / 2;
    g.save();
    g.beginPath();
    g.rect(cx - N / 2, cy - N / 2, N, N);
    g.clip();
    g.globalCompositeOperation = "lighter";
    // the body: a teardrop of overlapping soft blobs, rising
    const tongues = 6 + Math.floor(rnd() * 3);
    for (let i = 0; i < tongues; i++) {
      const u = i / (tongues - 1);
      const sway = (rnd() - 0.5) * N * (0.08 + 0.18 * p);
      const y = cy + N * 0.22 - u * N * (0.42 + 0.12 * p);
      const rx = N * (0.24 - 0.14 * u) * (1 - 0.25 * p);
      blob(cx + sway * u, y, rx, rx * (1.5 + 0.6 * u), (0.55 - 0.3 * u) * (1 - 0.6 * p));
    }
    // the hot core, fading as it burns out
    blob(cx, cy + N * 0.12, N * 0.14 * (1 - 0.5 * p), N * 0.2 * (1 - 0.4 * p), 0.9 * (1 - p) ** 1.5);
    // broken licks off the top later in its life
    for (let i = 0; i < Math.floor(p * 5); i++) {
      blob(cx + (rnd() - 0.5) * N * 0.5, cy - N * (0.1 + rnd() * 0.3), N * 0.05, N * 0.09, 0.35 * (1 - p * 0.5));
    }
    g.restore();
  }
  // 14: soft puff
  blob(2 * N + N / 2, 3 * N + N / 2, N * 0.46, N * 0.46, 0.85);
  // 15: spark
  blob(3 * N + N / 2, 3 * N + N / 2, N * 0.2, N * 0.2, 1.0);
  blob(3 * N + N / 2, 3 * N + N / 2, N * 0.07, N * 0.07, 1.0);
  _atlas = new THREE.CanvasTexture(c);
  _atlas.colorSpace = THREE.NoColorSpace;
  return _atlas;
}

const FLAME_VS = `
attribute vec4 iPos;    // xyz, size
attribute vec4 iData;   // rotation, frame, alpha, heat
varying vec2 vUv;
varying float vAlpha;
varying float vHeat;
void main() {
  vec4 mv = modelViewMatrix * vec4(iPos.xyz, 1.0);
  float c = cos(iData.x), s = sin(iData.x);
  vec2 q = position.xy;
  mv.xy += vec2(c * q.x - s * q.y, s * q.x + c * q.y) * iPos.w;
  gl_Position = projectionMatrix * mv;
  float f = floor(iData.y + 0.5);
  vec2 cell = vec2(mod(f, 4.0), 3.0 - floor(f / 4.0));
  vUv = (cell + uv) / 4.0;
  vAlpha = iData.z;
  vHeat = iData.w;
}`;
const FIRE_FS = `
uniform sampler2D uMap;
uniform float uGain, uHot;
varying vec2 vUv;
varying float vAlpha;
varying float vHeat;
void main() {
  float a = texture2D(uMap, vUv).r;
  float i = a * vHeat * uHot;
  vec3 col = mix(vec3(0.6, 0.05, 0.0), vec3(1.0, 0.34, 0.04), smoothstep(0.05, 0.45, i));
  col = mix(col, vec3(1.0, 0.68, 0.22), smoothstep(0.5, 0.82, i));
  col = mix(col, vec3(1.0, 0.93, 0.75), smoothstep(0.9, 1.15, i));
  gl_FragColor = vec4(col * uGain, clamp(a * 1.8, 0.0, 1.0) * vAlpha);
}`;
const SMOKE_FS = `
uniform sampler2D uMap;
varying vec2 vUv;
varying float vAlpha;
varying float vHeat;
void main() {
  float a = texture2D(uMap, vUv).r;
  gl_FragColor = vec4(vec3(0.09, 0.08, 0.075) + vHeat * vec3(0.25, 0.06, 0.0), a * vAlpha);
}`;

class Layer {
  constructor(max, fs, blending, gain, hot = 1) {
    this.max = max;
    this.n = 0;
    this.p = [];      // particle structs
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.attributes.position = base.attributes.position;
    geo.attributes.uv = base.attributes.uv;
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    this.aData = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    this.aPos.setUsage(THREE.DynamicDrawUsage);
    this.aData.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("iPos", this.aPos);
    geo.setAttribute("iData", this.aData);
    geo.instanceCount = 0;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: flameAtlas() }, uGain: { value: gain }, uHot: { value: hot } },
      vertexShader: FLAME_VS, fragmentShader: fs,
      transparent: true, depthWrite: false, blending,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.geo = geo;
  }
  add(o) {
    if (this.p.length >= this.max) this.p.shift();
    this.p.push(o);
  }
  update(dt) {
    const P = this.p, pos = this.aPos.array, dat = this.aData.array;
    let n = 0;
    for (let i = 0; i < P.length; i++) {
      const q = P[i];
      q.age += dt;
      if (q.age >= q.life) continue;
      const k = q.age / q.life;
      const drag = Math.exp(-dt * q.drag);
      q.vx *= drag; q.vy = q.vy * drag + q.grav * dt; q.vz *= drag;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      q.rot += q.spin * dt;
      const fadeIn = Math.min(1, q.age / (q.inT || 0.03));
      pos[n * 4] = q.x; pos[n * 4 + 1] = q.y; pos[n * 4 + 2] = q.z;
      pos[n * 4 + 3] = q.s0 + (q.s1 - q.s0) * Math.sqrt(k);
      dat[n * 4] = q.rot;
      dat[n * 4 + 1] = q.f0 + (q.f1 - q.f0) * k;
      dat[n * 4 + 2] = q.a * fadeIn * (1 - k) ** (q.fade || 1);
      dat[n * 4 + 3] = q.h0 + (q.h1 - q.h0) * k;
      P[n++] = q;
    }
    P.length = n;
    this.geo.instanceCount = n;
    this.aPos.needsUpdate = this.aData.needsUpdate = n > 0;
    this.aPos.addUpdateRange?.(0, n * 4);
    this.aData.addUpdateRange?.(0, n * 4);
  }
  clear() { this.p.length = 0; this.geo.instanceCount = 0; }
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const rr = (a, b) => a + Math.random() * (b - a);

/* A random direction in a cone round `dir` (unit), half-angle `spread`. */
function cone(dir, spread, out) {
  _a.set(1, 0, 0);
  if (Math.abs(dir.x) > 0.9) _a.set(0, 1, 0);
  _b.crossVectors(dir, _a).normalize();
  _c.crossVectors(dir, _b);
  const ang = Math.random() * Math.PI * 2, r = Math.tan(spread) * Math.sqrt(Math.random());
  return out.copy(dir).addScaledVector(_b, Math.cos(ang) * r).addScaledVector(_c, Math.sin(ang) * r).normalize();
}

export class HellfireFx {
  /* `scale` sizes everything: 1 in the world, smaller in the weapon scene
     where the gun is a metre long and half a metre from the eye. `gain` is
     the fire's brightness. In the world it is drawn `additive: false`:
     added onto a bright sky a whole burst sums to white, painted on it
     keeps its colour. `hot` < 1 holds it in the orange (no cream core).  */
  constructor(parent, { scale = 1, max = 700, gain = 1.3, additive = true, hot = 1 } = {}) {
    this.scale = scale;
    this.fire = new Layer(max, FIRE_FS, additive ? THREE.AdditiveBlending : THREE.NormalBlending, gain, hot);
    this.timeScale = 1;   // tests freeze the fire at an age
    this.smoke = new Layer(Math.floor(max / 3), SMOKE_FS, THREE.NormalBlending, 1);
    this.smoke.mesh.renderOrder = 5;
    parent.add(this.smoke.mesh, this.fire.mesh);
  }

  flame(pos, vel, o = {}) {
    const s = this.scale;
    this.fire.add({
      x: pos.x, y: pos.y, z: pos.z, vx: vel.x, vy: vel.y, vz: vel.z,
      age: 0, life: o.life ?? rr(0.22, 0.38), drag: o.drag ?? 5, grav: (o.rise ?? 1.6) * s,
      s0: (o.s0 ?? 0.05) * s, s1: (o.s1 ?? 0.22) * s, rot: rr(-0.5, 0.5), spin: rr(-3, 3),
      f0: o.f0 ?? 0, f1: o.f1 ?? 13, a: o.a ?? 1, h0: o.h0 ?? 1.2, h1: o.h1 ?? 0.35, fade: o.fade ?? 1.2, inT: 0.02,
    });
  }

  ember(pos, vel, o = {}) {
    const s = this.scale;
    this.fire.add({
      x: pos.x, y: pos.y, z: pos.z, vx: vel.x, vy: vel.y, vz: vel.z,
      age: 0, life: o.life ?? rr(0.5, 1.1), drag: o.drag ?? 1.8, grav: (o.grav ?? -2.5) * s,
      s0: (o.size ?? 0.016) * s, s1: (o.size ?? 0.016) * s * 0.4, rot: 0, spin: 0,
      f0: 15, f1: 15, a: 1, h0: 1.3, h1: 0.5, fade: 0.7, inT: 0.01,
    });
  }

  puff(pos, vel, o = {}) {
    const s = this.scale;
    this.smoke.add({
      x: pos.x, y: pos.y, z: pos.z, vx: vel.x, vy: vel.y, vz: vel.z,
      age: 0, life: o.life ?? rr(0.8, 1.4), drag: 2.2, grav: (o.rise ?? 0.5) * s,
      s0: (o.s0 ?? 0.06) * s, s1: (o.s1 ?? 0.3) * s, rot: rr(0, 6.28), spin: rr(-0.8, 0.8),
      f0: 14, f1: 14, a: o.a ?? 0.32, h0: o.heat ?? 0.4, h1: 0, fade: 1.4, inT: 0.08,
    });
  }

  /* The shot: a cone of flame out of the skull's mouth, embers, smoke. */
  burst(origin, dir, power = 1) {
    const s = this.scale;
    const v = new THREE.Vector3();
    // the jet: fast and narrow down the line, then billowing wider and slower
    for (let i = 0; i < 14 * power; i++) {
      cone(dir, 0.16, v).multiplyScalar(rr(4.5, 8.5) * s * power);
      this.flame(origin, v, { s0: rr(0.06, 0.1), s1: rr(0.3, 0.5) * power, life: rr(0.22, 0.38), f1: 13, drag: 6 });
    }
    for (let i = 0; i < 12 * power; i++) {
      cone(dir, 0.55, v).multiplyScalar(rr(1.2, 3.2) * s * power);
      this.flame(origin, v, { s0: rr(0.08, 0.12), s1: rr(0.35, 0.6) * power, life: rr(0.3, 0.5), f1: 13, rise: 2.4 });
    }
    // the hot heart that stays at the jaws a beat
    this.flame(origin, v.copy(dir).multiplyScalar(0.8 * s), { s0: 0.16, s1: 0.34, life: 0.16, h0: 1.7, h1: 1, f1: 6 });
    for (let i = 0; i < 14 * power; i++) {
      cone(dir, 0.6, v).multiplyScalar(rr(1.5, 4.5) * s);
      this.ember(origin, v, { size: rr(0.008, 0.016) });
    }
    // soot behind the fire: on a bright map it is what makes the flame read
    for (let i = 0; i < 5; i++) {
      cone(dir, 0.45, v).multiplyScalar(rr(0.8, 2.2) * s);
      this.puff(origin, v, { s0: 0.08, s1: rr(0.26, 0.42), life: rr(0.5, 1.0), a: 0.42, heat: 0.25, rise: 0.8 });
    }
  }

  /* The dead gun's cough: no flame, a wisp of smoke and a few sparks. */
  cough(origin, dir) {
    const v = new THREE.Vector3();
    for (let i = 0; i < 4; i++) {
      cone(dir, 0.6, v).multiplyScalar(rr(0.2, 0.6) * this.scale);
      this.puff(origin, v, { s0: 0.03, s1: 0.18, a: 0.28, heat: 0.15 });
    }
    for (let i = 0; i < 5; i++) {
      cone(dir, 0.8, v).multiplyScalar(rr(0.6, 1.8) * this.scale);
      this.ember(origin, v, { size: 0.008, life: rr(0.2, 0.5) });
    }
  }

  /* A burning pellet's path this frame, from `a` to `b`. */
  trail(a, b) {
    const v = new THREE.Vector3();
    const d = _a.subVectors(b, a);
    const len = d.length();
    const n = Math.min(5, Math.max(1, Math.round(len / 1.4)));
    for (let i = 0; i < n; i++) {
      const p = _b.copy(a).addScaledVector(d, (i + Math.random()) / n);
      v.set(rr(-0.3, 0.3), rr(0.1, 0.6), rr(-0.3, 0.3));
      this.flame(p, v, { s0: rr(0.05, 0.08), s1: rr(0.1, 0.16), life: rr(0.08, 0.16), h0: 1.1, h1: 0.5, f0: 2, f1: 12, rise: 1 });
    }
  }

  /* Where a burning pellet lands: a lick of flame and embers off the surface. */
  lick(point, normal) {
    const v = new THREE.Vector3();
    const up = normal || _c.set(0, 1, 0);
    for (let i = 0; i < 5; i++) {
      cone(up, 0.5, v).multiplyScalar(rr(0.4, 1.1));
      v.y += 0.5;
      this.flame(point, v, { s0: 0.06, s1: rr(0.16, 0.28), life: rr(0.35, 0.65), h0: 1.1, h1: 0.3, rise: 2.2 });
    }
    for (let i = 0; i < 6; i++) {
      cone(up, 0.9, v).multiplyScalar(rr(1, 3));
      this.ember(point, v, { size: rr(0.012, 0.022) });
    }
    this.puff(point, v.copy(up).multiplyScalar(0.4), { s0: 0.1, s1: 0.45, a: 0.18, heat: 0.3 });
  }

  /* A kill with it: the body goes up in a column of hellfire. */
  killBurst(pos) {
    const v = new THREE.Vector3();
    const p = new THREE.Vector3();
    for (let i = 0; i < 34; i++) {
      p.set(pos.x + rr(-0.3, 0.3), pos.y + rr(0, 1.5), pos.z + rr(-0.3, 0.3));
      v.set(rr(-0.4, 0.4), rr(1.0, 3.2), rr(-0.4, 0.4));
      this.flame(p, v, { s0: rr(0.15, 0.25), s1: rr(0.45, 0.8), life: rr(0.45, 0.9), h0: 1.25, h1: 0.3, rise: 2.5, drag: 2 });
    }
    for (let i = 0; i < 40; i++) {
      p.set(pos.x + rr(-0.3, 0.3), pos.y + rr(0.2, 1.6), pos.z + rr(-0.3, 0.3));
      v.set(rr(-2, 2), rr(1, 5), rr(-2, 2));
      this.ember(p, v, { size: rr(0.02, 0.04), life: rr(0.8, 1.6), grav: -3 });
    }
    for (let i = 0; i < 8; i++) {
      p.set(pos.x + rr(-0.3, 0.3), pos.y + rr(0.5, 1.8), pos.z + rr(-0.3, 0.3));
      this.puff(p, v.set(rr(-0.3, 0.3), rr(0.6, 1.4), rr(-0.3, 0.3)), { s0: 0.3, s1: 1.1, a: 0.3, heat: 0.5, life: rr(1.2, 2) });
    }
  }

  /* Admire: one small tongue of flame and heat embers from the jaws. */
  tongue(origin, dir) {
    const v = new THREE.Vector3();
    for (let i = 0; i < 6; i++) {
      cone(dir, 0.18, v).multiplyScalar(rr(0.5, 1.2) * this.scale);
      this.flame(origin, v, { s0: 0.025, s1: rr(0.07, 0.11), life: rr(0.3, 0.45), rise: 2.5, h0: 1.1 });
    }
    for (let i = 0; i < 8; i++) {
      v.set(rr(-0.2, 0.2), rr(0.3, 0.9), rr(-0.2, 0.2)).multiplyScalar(this.scale);
      this.ember(origin, v, { size: 0.006, life: rr(0.6, 1.2), grav: -0.6 });
    }
  }

  /* Smoke curling from a point (the eye sockets, a dead mouth). */
  wisp(origin, amt = 1) {
    const v = new THREE.Vector3();
    for (let i = 0; i < 3 * amt; i++) {
      v.set(rr(-0.05, 0.05), rr(0.12, 0.3), rr(-0.05, 0.05)).multiplyScalar(this.scale);
      this.puff(origin, v, { s0: 0.012, s1: rr(0.06, 0.1), a: 0.3, heat: 0.2, rise: 0.15, life: rr(0.8, 1.3) });
    }
  }

  /* The relight: a belch of flame from the jaws. */
  roar(origin, dir) {
    this.burst(origin, dir, 0.7);
    this.tongue(origin, dir);
  }

  update(dt) {
    this.fire.update(dt * this.timeScale);
    this.smoke.update(dt * this.timeScale);
  }

  clear() { this.fire.clear(); this.smoke.clear(); }
}
