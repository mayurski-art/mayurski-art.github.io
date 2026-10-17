// Troll Forces — the saloon band's guitar and trumpet (BAND.md): the models,
// a body holding one, and the playing poses. Used by the townsfolk (Six-String
// Cisco, Trumpet Tex: town-npcs.js), the player who takes one (modes/
// social-band.js), and everyone else's view of that player (remote-players.js
// peerPosers). First person has its own copy in the view (fpInstrument).
//
// The guitar is built along +X (body at the origin, the neck out to +X, its
// top facing +Z); the trumpet from its mouthpiece at the origin out along -Z,
// the valves up. Held, both sit in the chest's frame (character.js
// reachHand's space: +X the right side, -Z forward) and the hands are
// reached onto them: the left on the neck / round the valves, the right
// strumming over the soundhole / on the valve caps.

import * as THREE from "three";
import { reachHand, setHandPose } from "./character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1m1u-gt1-gt2-bk1-cw1-zr10-bf1-sr1-or1-nf2-em2-lh1-fg2";

/* ------------------------------------------------------------- materials */

let MATS = null;
function mats() {
  if (MATS) return MATS;
  const std = (color, rough, metal = 0, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
    m.userData.shared = true;   // one set for every instrument: never disposed with a rig
    return m;
  };
  MATS = {
    body: std(0x8a4a1c, 0.55),          // the sides and back: a warm brown
    top: std(0xd9a066, 0.6),            // spruce top
    neck: std(0x4a2a12, 0.6),
    board: std(0x1e1008, 0.7),          // rosewood fretboard
    hole: std(0x0b0603, 0.9),
    string: std(0xe8e0d0, 0.3, 0.6),
    brass: std(0xd9a441, 0.32, 0.75, { emissive: 0x2a1800, emissiveIntensity: 0.6 }),
    brassDark: std(0x9a6e22, 0.4, 0.7),
    pearl: std(0xf3ead8, 0.35),
  };
  return MATS;
}
const shareGeo = (g) => { g.userData.shared = true; return g; };
function mesh(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(shareGeo(geo), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  return m;
}

/* -------------------------------------------------------------- models */

/* An acoustic guitar, ~0.9 m: two bouts, a soundhole, bridge, neck,
   fretboard with frets, headstock with tuning pegs, six strings. */
export function buildGuitar() {
  const M = mats();
  const g = new THREE.Group();
  g.name = "guitar";
  const D = 0.09;   // body depth
  for (const [x, r] of [[-0.08, 0.185], [0.15, 0.145]]) {
    g.add(mesh(new THREE.CylinderGeometry(r, r, D, 28), M.body, x, 0, 0, Math.PI / 2));
    g.add(mesh(new THREE.CircleGeometry(r - 0.004, 28), M.top, x, 0, D / 2 + 0.001));
  }
  g.add(mesh(new THREE.BoxGeometry(0.08, 0.2, D), M.body, 0.04, 0, 0));          // the waist, filled
  g.add(mesh(new THREE.BoxGeometry(0.08, 0.2, 0.002), M.top, 0.04, 0, D / 2 + 0.001));
  g.add(mesh(new THREE.CircleGeometry(0.046, 24), M.hole, 0.1, 0, D / 2 + 0.003));
  g.add(mesh(new THREE.RingGeometry(0.046, 0.056, 24), M.board, 0.1, 0, D / 2 + 0.003));
  g.add(mesh(new THREE.BoxGeometry(0.03, 0.15, 0.012), M.board, -0.13, 0, D / 2 + 0.006));   // bridge
  // the neck, its fretboard and frets
  g.add(mesh(new THREE.BoxGeometry(0.46, 0.05, 0.03), M.neck, 0.48, 0, 0.022));
  g.add(mesh(new THREE.BoxGeometry(0.46, 0.054, 0.006), M.board, 0.48, 0, 0.04));
  for (let i = 0; i < 12; i++) g.add(mesh(new THREE.BoxGeometry(0.003, 0.054, 0.004), M.string, 0.27 + i * 0.034, 0, 0.044));
  // headstock, angled back a touch, six pegs
  const head = new THREE.Group();
  head.position.set(0.72, 0, 0.026);
  head.rotation.y = 0.18;
  head.add(mesh(new THREE.BoxGeometry(0.18, 0.075, 0.02), M.neck, 0.09, 0, 0));
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) head.add(mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.03, 8), M.pearl, 0.04 + i * 0.05, s * 0.05, 0));
  g.add(head);
  // six strings from the bridge to the nut
  for (let i = 0; i < 6; i++) {
    const y0 = (i - 2.5) * 0.012, y1 = (i - 2.5) * 0.008;
    const len = 0.84, s = mesh(new THREE.BoxGeometry(len, 0.0018, 0.0018), M.string, -0.13 + len / 2, (y0 + y1) / 2, 0.05);
    s.rotation.z = Math.atan2(y1 - y0, len);
    s.castShadow = false;
    g.add(s);
  }
  g.userData.kind = "guitar";
  return g;
}

/* A trumpet in C, ~0.48 m: mouthpiece, lead pipe, three valves with
   pearl caps, the tuning-slide loop, and the bell. */
export function buildTrumpet() {
  const M = mats();
  const g = new THREE.Group();
  g.name = "trumpet";
  const pipe = (r, z0, z1, y = 0, mat = M.brass) => mesh(new THREE.CylinderGeometry(r, r, Math.abs(z1 - z0), 10), mat, 0, y, (z0 + z1) / 2, Math.PI / 2);
  g.add(mesh(new THREE.CylinderGeometry(0.009, 0.014, 0.05, 12), M.brass, 0, 0, -0.025, Math.PI / 2));   // mouthpiece
  g.add(pipe(0.0065, -0.05, -0.32));                     // the lead pipe, on top
  g.add(pipe(0.0065, -0.09, -0.32, -0.042));             // the lower pipe
  for (const z of [-0.07, -0.33]) {                      // the bends joining them
    const bend = mesh(new THREE.TorusGeometry(0.021, 0.0065, 8, 14, Math.PI), M.brass, 0, -0.021, z, 0, Math.PI / 2, 0);
    bend.rotation.set(0, Math.PI / 2, z < -0.2 ? -Math.PI / 2 : Math.PI / 2);
    g.add(bend);
  }
  // the valves: three casings standing up through both pipes, pearl caps
  for (let i = 0; i < 3; i++) {
    const z = -0.17 - i * 0.026;
    g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 12), M.brassDark, 0, 0.0, z));
    g.add(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 6), M.brass, 0, 0.065, z));
    g.add(mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.006, 12), M.pearl, 0, 0.082, z));
  }
  // the bell: flaring out ahead
  const bell = mesh(new THREE.CylinderGeometry(0.062, 0.009, 0.2, 24, 1, true), M.brass, 0, 0, -0.42, -Math.PI / 2);
  bell.material = M.brass;
  g.add(bell);
  g.add(mesh(new THREE.TorusGeometry(0.062, 0.003, 6, 24), M.brass, 0, 0, -0.52));   // the rim
  g.userData.kind = "trumpet";
  return g;
}

export const buildInstrument = (kind) => (kind === "guitar" ? buildGuitar() : kind === "trumpet" ? buildTrumpet() : null);

/* --------------------------------------------------------------- holding */

/* Put `kind` ("guitar" | "trumpet" | null) in this body's hands. Cheap to
   call every frame. The mesh rides the chest. */
export function holdInstrument(rig, kind) {
  kind = kind === "guitar" || kind === "trumpet" ? kind : null;
  if ((rig.instrument?.userData.kind || null) === kind) return rig.instrument;
  rig.instrument?.parent?.remove(rig.instrument);
  rig.instrument = null;
  if (!kind || !rig.parts?.chest) return null;
  const m = buildInstrument(kind);
  m.scale.setScalar(1.15 * (rig.scale || 1));
  rig.parts.chest.add(m);
  rig.instrument = m;
  return m;
}

const _C = new THREE.Vector3(), _n = new THREE.Vector3(), _f = new THREE.Vector3(), _y = new THREE.Vector3(), _x = new THREE.Vector3();
const _t = new THREE.Vector3(), _m4 = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0);
const _poleL = new THREE.Vector3(), _poleR = new THREE.Vector3();

/* The frame a held instrument sits in: origin, its +X (neck / right), +Y
   and +Z, chest space. `play` 0..1: how hard it's being played. */
function guitarFrame(k, play, out) {
  out.C.set(0.1 * k, -0.42 * k, -0.2 * k);
  out.x.set(-0.9, 0.42, -0.14).normalize();                           // the neck: up to the left
  out.z.set(0.12, 0.05, -1).addScaledVector(out.x, -0.12 * 0.9).normalize();   // the top: facing out
  out.z.addScaledVector(out.x, -out.z.dot(out.x)).normalize();
  out.y.crossVectors(out.z, out.x);
  return out;
}
function trumpetFrame(k, blow, out) {
  out.C.set(0.0, 0.2 * k, -0.07 * k);                                 // the mouthpiece at the grin
  _t.set(0, -0.16 + 0.12 * blow, -1).normalize();                     // pointing out, the bell up a little when blown
  out.z.copy(_t).negate();                                            // the trumpet runs down its -Z
  out.y.copy(_up).addScaledVector(out.z, -_up.dot(out.z)).normalize();
  out.x.crossVectors(out.y, out.z);
  return out;
}
const _F = { C: new THREE.Vector3(), x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3() };
function placeIn(mesh, F) {
  _m4.makeBasis(F.x, F.y, F.z);
  mesh.quaternion.setFromRotationMatrix(_m4);
  mesh.position.copy(F.C);
}

/* After the body's pose: the arms play what's held. `t` seconds (the
   strum's / the fingers' clock), `play` 0..1 how busy (0 idle: still held,
   barely moving). Redraws the ink body. */
export function poseInstrument(rig, t, play = 0) {
  const inst = rig.instrument;
  if (!inst) return;
  const k = rig.scale || 1, s = inst.scale.x;
  const kind = inst.userData.kind;
  if (kind === "guitar") {
    const F = guitarFrame(k, play, _F);
    placeIn(inst, F);
    // the left hand on the neck, sliding a little between chords
    const slide = 0.46 + Math.sin(t * 0.9) * 0.04 * play;
    _t.copy(F.C).addScaledVector(F.x, slide * s).addScaledVector(F.y, -0.035 * s).addScaledVector(F.z, -0.01 * s);
    reachHand(rig, -1, _t, _poleL.set(-0.6, -1, 0.5));
    setHandPose(rig, -1, "fist");
    // the right hand over the soundhole, strumming across the strings
    const strum = Math.sin(t * (6 + 3 * play)) * (0.012 + 0.06 * play);
    _t.copy(F.C).addScaledVector(F.x, 0.04 * s).addScaledVector(F.y, strum * s).addScaledVector(F.z, 0.085 * s);
    reachHand(rig, 1, _t, _poleR.set(1, -0.4, 0.6));
    setHandPose(rig, 1, "fist");
    rig.parts.chest.rotation.z += Math.sin(t * 1.3) * 0.03 * (0.3 + play);
  } else if (kind === "trumpet") {
    const blow = Math.max(0, Math.min(1, play));
    const F = trumpetFrame(k, blow, _F);
    placeIn(inst, F);
    // the right hand's fingers on the caps (a little press while playing)
    const press = Math.max(0, Math.sin(t * 9)) * 0.01 * blow;
    _t.copy(F.C).addScaledVector(F.z, -0.2 * s).addScaledVector(F.y, (0.1 - press) * s).addScaledVector(F.x, 0.02 * s);
    reachHand(rig, 1, _t, _poleR.set(1, -0.5, 0.2));
    setHandPose(rig, 1, "fist");
    // the left round the valve casings, from the side
    _t.copy(F.C).addScaledVector(F.z, -0.215 * s).addScaledVector(F.x, -0.04 * s).addScaledVector(F.y, -0.01 * s);
    reachHand(rig, -1, _t, _poleL.set(-1, -0.5, 0.2));
    setHandPose(rig, -1, "fist");
    // a lean back into a long note
    rig.parts.chest.rotation.x -= 0.06 * blow;
  }
  rig.body?.update?.();
}

/* ------------------------------------------------------------ first person */

/* First person: the instrument in the view (viewmodel space: +X right, +Y
   up, -Z forward) and where the two streak-arm hands go. Returns
   { R, L } hand targets for fp-emote's poseFreeArms, or null. The mesh is
   placed under `parent` (the arms' own parent). */
const fp = { mesh: null };
export function fpInstrument(kind, parent, t, play = 0) {
  if ((fp.mesh?.userData.kind || null) !== (kind || null)) {
    fp.mesh?.parent?.remove(fp.mesh);
    fp.mesh = kind ? buildInstrument(kind) : null;
    if (fp.mesh) fp.mesh.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  }
  if (!fp.mesh) return null;
  if (fp.mesh.parent !== parent) parent.add(fp.mesh);
  const s = kind === "trumpet" ? 0.78 : 0.9;
  fp.mesh.scale.setScalar(s);
  const F = _F;
  if (kind === "guitar") {
    // held low: you see the neck rising to the upper left, your fretting
    // hand on it, the body below the view, the strumming hand at the edge
    F.C.set(0.12, -0.44, -0.42);
    F.x.set(-0.82, 0.34, -0.46).normalize();
    F.z.set(0.05, 0.6, -0.8);
    F.z.addScaledVector(F.x, -F.z.dot(F.x)).normalize();
    F.y.crossVectors(F.z, F.x);
    placeIn(fp.mesh, F);
    const slide = 0.46 + Math.sin(t * 0.9) * 0.04 * play;
    const L = _t.copy(F.C).addScaledVector(F.x, slide * s).addScaledVector(F.y, -0.035 * s).toArray();
    const strum = Math.sin(t * (6 + 3 * play)) * (0.012 + 0.06 * play);
    const R = _t.copy(F.C).addScaledVector(F.x, 0.04 * s).addScaledVector(F.y, strum * s).addScaledVector(F.z, 0.085 * s).toArray();
    return { R: { pos: R, rot: [0.3, 0, -Math.PI / 2], pose: "fist" }, L: { pos: L, rot: [0.6, 0, Math.PI / 2], pose: "fist" } };
  }
  // the trumpet up to your lips, the bell out ahead below the crosshair
  const blow = Math.max(0, Math.min(1, play));
  // low enough that the bell sits under the crosshair, not on it
  F.C.set(0.01, -0.13, -0.05);
  _t.set(0, -0.24 + 0.08 * blow, -1).normalize();
  F.z.copy(_t).negate();
  F.y.copy(_up).addScaledVector(F.z, -_up.dot(F.z)).normalize();
  F.x.crossVectors(F.y, F.z);
  placeIn(fp.mesh, F);
  const press = Math.max(0, Math.sin(t * 9)) * 0.01 * blow;
  const R = _t.copy(F.C).addScaledVector(F.z, -0.2 * s).addScaledVector(F.y, (0.1 - press) * s).addScaledVector(F.x, 0.02 * s).toArray();
  const L = _t.copy(F.C).addScaledVector(F.z, -0.215 * s).addScaledVector(F.x, -0.045 * s).toArray();
  return { R: { pos: R, rot: [0.2, 0, -Math.PI / 2], pose: "fist" }, L: { pos: L, rot: [0.2, 0, Math.PI / 2], pose: "fist" } };
}
export function hideFpInstrument() {
  if (fp.mesh?.parent) fp.mesh.parent.remove(fp.mesh);
}
