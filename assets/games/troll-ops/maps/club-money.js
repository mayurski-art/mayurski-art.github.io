// Troll Forces — money in the air: the notes thrown over a club's dance
// floor on the beat drops, the ones the crowd throws (town-npcs.js), the
// ones a Make it rain money gun sprays (weapons/money-gun.js). Doc:
// docs/MONEY-RAIN.md.
//
// One pool of instanced quads per scene, one draw: the club's (moneyRain,
// built with the map, ticked from club-live.js) or, on a map without a
// club, one made on the first bill (ticked by its own draw hook). The pool's
// size goes by the graphics tier (POOLS) so a phone never pushes more than
// 48 notes; when it's full the oldest note lying down is reused, then the
// oldest in the air.
//
// A note goes up and over (gravity, a little drag), then flutters down,
// swaying. One thrown by a drop is aimed at a note the build left lying on
// the floor (the baked scatter, kabukigrin-props.js) and swaps into it
// where it lands, so the floor looks the same after as before. Any other
// note (a hand's, a gun's) falls onto whatever is under it, read off the
// map's colliders once as it starts to flutter: the floor, the stage, the
// bar top, the mezzanine. It lies there a moment and fades out (a
// per-instance alpha, aFade).
//
// Who emits: emitMoney(origin, dir, n) from anywhere; the drop keeps its
// own anonymous throw unless a crowd has registered to throw instead
// (onMoneyDrop).

import * as THREE from "three";
import { groundHeightAt } from "../core/movement.js?v=umb2-sb2-gj1b7-or1-gf1-tg1-rfx1-hb4";

export const POOLS = { high: 160, medium: 96, low: 48 };   // notes in the air at most, per tier
/* How many notes a second a money gun sprays, per tier (money-gun.js). */
export const SPRAY_RATE = { high: 14, medium: 10, low: 7 };
const THROW = 22;         // notes a drop throws
const NOTE = [0.16, 0.076];
const LIE_SPOT = 1.4;     // on a baked note: lies in its pose, then gone
const LIE = 2.5, FADE = 0.6;   // anywhere else: lies, then fades out
const RANGE = 30;         // nothing is emitted further than this from the eye
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _qf = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _d = new THREE.Vector3();
// lying flat on the floor turned ry about the world's up, as kb_club.py's flat() lays them
const flatPose = (q, ry) => q.setFromEuler(_e.set(-Math.PI / 2, ry, 0, "YXZ"));

// the scene the bills fall in: set by match-start.js before the map builds
const WORLD = { scene: null, colliders: null, tier: "medium", eye: null };
let ACTIVE = null;      // the club's money, while its map is up
let FALLBACK = null;    // a map without a club: made on the first bill
const DROP_LISTENERS = [];

/* The world the bills live in: `scene`, the map's `colliders` (the live
   array game.js keeps; what a note lands on), the graphics `tier` (the
   pool's size) and `eye()` (the camera's position: nothing is thrown out
   of sight). Before loadMap, so the club's pool is sized right. */
export function setMoneyWorld(scene, colliders, tier, eye) {
  Object.assign(WORLD, { scene, colliders, tier: POOLS[tier] ? tier : "medium", eye });
  if (FALLBACK) { FALLBACK.mesh.parent?.remove(FALLBACK.mesh); FALLBACK = null; }
}
export const moneyTier = () => WORLD.tier;
/* A crowd that throws on the drops instead of the anonymous hands over the
   floor (town-npcs.js). Returns the unsubscribe. */
export function onMoneyDrop(fn) {
  DROP_LISTENERS.push(fn);
  return () => { const i = DROP_LISTENERS.indexOf(fn); if (i >= 0) DROP_LISTENERS.splice(i, 1); };
}

// a banknote in the build's note colour (kb_club.py KBF_Note, so the swap
// to the floor's own note on landing doesn't show): a darker border, a
// portrait oval, the corners' numerals
function noteTexture() {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "#b3a476"; g.fillRect(0, 0, 128, 64);
  g.strokeStyle = "#8a7e58"; g.lineWidth = 5; g.strokeRect(4, 4, 120, 56);
  g.fillStyle = "#a39668"; g.beginPath(); g.ellipse(84, 32, 17, 21, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#7a6e4c"; g.font = "bold 15px sans-serif"; g.fillText("1000", 12, 24); g.fillText("1000", 12, 52);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* One pool of notes under `root`. */
function makeMoney(root, pool, { spots = [], area = null, hand = 1.9 } = {}) {
  const mat = new THREE.MeshLambertMaterial({ map: noteTexture(), side: THREE.DoubleSide, transparent: true });
  // the fade: one alpha per instance, multiplied into the fragment
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aFade;\nvarying float vFade;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFade = aFade;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vFade;")
      .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.a *= vFade;");
  };
  const geo = new THREE.PlaneGeometry(NOTE[0], NOTE[1]);
  const fade = new THREE.InstancedBufferAttribute(new Float32Array(pool).fill(1), 1);
  fade.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("aFade", fade);
  const mesh = new THREE.InstancedMesh(geo, mat, pool);
  mesh.name = "club-money";
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  // the two notes the build lays (kb_club.py: note 0xb3a476, note_b 0x7f8fa6)
  const tints = [new THREE.Color(0xffffff), new THREE.Color(0x7f8fa6).multiply(new THREE.Color(1 / 0.70, 1 / 0.64, 1 / 0.46))];
  const notes = [];
  for (let i = 0; i < pool; i++) {
    notes.push({ on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), rx: 0, ry: 0, rz: 0, spin: 0, to: null, spot: false, landed: 0, born: 0, lift: 0, seed: Math.random() * 10 });
    mesh.setColorAt(i, tints[i % 4 === 3 ? 1 : 0]);
    mesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
  }
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  root.add(mesh);
  return { mesh, fade, notes, pool, spots, area, hand, now: 0, phrase: -1, quiet: 0, drops: 0, thrown: 0, emitted: 0, landed: 0, lastDrop: 0, force: false, wasLive: false, stepMs: 0 };
}

/* The notes for one club: `spots` the floor's notes [x, y, z, ry] that the
   drop's land on (the ones round the dance floor), `area` {x0, x1, z0,
   z1} where the throwers stand, `hand` the height they throw from. */
export function moneyRain(root, S, { spots, area, hand = 1.9 }) {
  if (!spots?.length) return null;
  const M = makeMoney(root, POOLS[WORLD.tier], { spots, area, hand });
  S.money = M;
  ACTIVE = M;
  return M.mesh;
}

// the club's money while its map is in the scene, else the fallback pool
function moneyFor() {
  if (ACTIVE) {
    let o = ACTIVE.mesh;
    while (o.parent) o = o.parent;
    if (o === ACTIVE.mesh || (WORLD.scene && o !== WORLD.scene)) ACTIVE = null;
    else return ACTIVE;
  }
  if (!WORLD.scene) return null;
  if (!FALLBACK) {
    const M = FALLBACK = makeMoney(WORLD.scene, POOLS[WORLD.tier]);
    // ticked by its own draw (frustumCulled off: it draws every frame)
    let last = 0;
    M.mesh.onBeforeRender = () => {
      const now = performance.now() / 1000;
      const dt = last ? Math.min(0.1, now - last) : 0;
      last = now;
      stepNotes(M, now, dt);
    };
  }
  return FALLBACK;
}

// a free note, else the oldest lying one, else the oldest in the air
function takeNote(M) {
  let best = null, bk = Infinity;
  for (const N of M.notes) {
    if (!N.on) return N;
    const k = N.landed ? N.landed - 1e6 : N.born;
    if (k < bk) { bk = k; best = N; }
  }
  return best;
}

function launch(M, N, x, y, z, vx, vy, vz) {
  N.on = true; N.spot = false; N.to = null; N.landed = 0; N.born = M.now;
  N.p.set(x, y, z);
  N.v.set(vx, vy, vz);
  N.rx = Math.random() * 6; N.ry = Math.random() * 6; N.rz = Math.random() * 6;
  N.spin = 4 + Math.random() * 6;
  N.lift = Math.random() * 0.012;
}

/* `n` notes out of `origin` along `dir` (unit-ish), fanned by `spread`
   (radians-ish, as a sideways share of the speed) at `speed` m/s with a
   little `up`. The count actually thrown (0 out of range, or with no scene). */
export function emitMoney(origin, dir, n, { spread = 0.35, speed = 5, up = 0.4 } = {}) {
  const M = moneyFor();
  if (!M) return 0;
  const eye = WORLD.eye?.();
  if (eye && eye.distanceTo(origin) > RANGE) return 0;
  _d.copy(dir).normalize();
  let k = 0;
  for (; k < n; k++) {
    const N = takeNote(M);
    if (!N) break;
    const s = speed * (0.8 + Math.random() * 0.4);
    launch(M, N,
      origin.x + (Math.random() - 0.5) * 0.04, origin.y + (Math.random() - 0.5) * 0.04, origin.z + (Math.random() - 0.5) * 0.04,
      _d.x * s + (Math.random() - 0.5) * spread * s, _d.y * s + up + Math.random() * 0.6, _d.z * s + (Math.random() - 0.5) * spread * s);
  }
  M.emitted += k;
  return k;
}

// a drop's anonymous throw: hands over the floor, each note aimed at a
// baked floor note, the nearer the likelier
function throwNotes(M, now) {
  M.drops++;
  M.lastDrop = now;
  if (DROP_LISTENERS.length) { for (const fn of DROP_LISTENERS) fn(M); return; }   // the crowd throws instead
  let left = THROW;
  while (left > 0) {
    const hx = M.area.x0 + 0.6 + Math.random() * (M.area.x1 - M.area.x0 - 1.2);
    const hz = M.area.z0 + 0.6 + Math.random() * (M.area.z1 - M.area.z0 - 1.2);
    const n = Math.min(left, 4 + Math.floor(Math.random() * 4));
    left -= n;
    for (let k = 0; k < n; k++) {
      const N = takeNote(M);
      if (!N) return;
      let best = null, bd = 1e9;
      for (let t = 0; t < 6; t++) {
        const s = M.spots[Math.floor(Math.random() * M.spots.length)];
        const d = Math.hypot(s[0] - hx, s[2] - hz);
        if (d < bd) { bd = d; best = s; }
      }
      launch(M, N, hx + (Math.random() - 0.5) * 0.3, M.hand + Math.random() * 0.3, hz + (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 1.6, 2.6 + Math.random() * 2.2, (Math.random() - 0.5) * 1.6);
      N.spot = true; N.to = best;
      M.thrown++;
    }
  }
}

// what's under a note as it starts to flutter: the highest collider top
// below it (a table, the stage, a deck), else the floor
function floorUnder(x, z, fromY) {
  return WORLD.colliders ? groundHeightAt(WORLD.colliders, x, z, fromY + 0.02, 0.04) : 0;
}

/* Every frame (club-live.js's tick): `bp` the beat position (bars land on
   whole multiples of 4), `songLevel` the song grid's level this beat (0..1,
   null without a song). */
export function moneyTick(S, now, dt, bp, songLevel) {
  const M = S.money;
  if (!M) return;
  // the drops
  let drop = M.force;
  M.force = false;
  if (S.dropUntil && S.dropUntil <= now && S.dropUntil > now - dt - 0.05) drop = true;   // the scratch lands
  if (songLevel !== null) {
    if (songLevel < 0.35) M.quiet = now;
    else if (songLevel > 0.7 && now - M.quiet < 2.5 && now - M.lastDrop > 6) drop = true;
  } else {
    const phrase = Math.floor(bp / 32);
    if (M.phrase >= 0 && phrase !== M.phrase) drop = true;
    M.phrase = phrase;
  }
  if (drop && now - M.lastDrop > 1.5) throwNotes(M, now);
  stepNotes(M, now, dt);
}

/* The notes' motion, one frame. */
function stepNotes(M, now, dt) {
  M.now = now;
  const t0 = performance.now();
  let live = false;
  M.notes.forEach((N, i) => {
    if (!N.on) return;
    live = true;
    if (N.landed) {
      const age = now - N.landed;
      if (N.spot) {
        // lying on the floor's own note, in its pose, a moment; then gone,
        // the baked note where it lay
        if (age > LIE_SPOT) { N.on = false; M.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0)); return; }
        _p.set(N.to[0], N.to[1] + 0.003, N.to[2]);
      } else {
        // lying where it fell, then fading out
        if (age > LIE + FADE) { N.on = false; M.fade.setX(i, 1); M.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0)); return; }
        if (age > LIE) M.fade.setX(i, 1 - (age - LIE) / FADE);
        _p.set(N.to[0], N.to[1] + 0.004 + N.lift, N.to[2]);
      }
      M.mesh.setMatrixAt(i, _m.compose(_p, flatPose(_q, N.to[3]), _s.setScalar(1)));
      return;
    }
    const t = now + N.seed;
    if (N.v.y > -0.6) {
      // thrown: up and over, gravity, the air slowing a fast flat note
      N.v.y -= 9.8 * dt;
      const drag = Math.max(0, 1 - dt * 2.2);
      N.v.x *= drag; N.v.z *= drag;
      N.p.addScaledVector(N.v, dt);
      if (N.v.y <= -0.6 && !N.to) {
        // over: where it'll lie, on whatever is under it now
        const y = floorUnder(N.p.x, N.p.z, N.p.y);
        N.to = [N.p.x + (Math.random() - 0.5) * 0.3, y, N.p.z + (Math.random() - 0.5) * 0.3, Math.random() * Math.PI * 2];
      }
    } else {
      // fluttering: a slow fall, swaying, steered toward its spot
      const dx = N.to[0] - N.p.x, dz = N.to[2] - N.p.z;
      const tLeft = Math.max(0.25, (N.p.y - N.to[1]) / 0.75);
      N.v.x += ((dx / tLeft) - N.v.x) * Math.min(1, dt * 2.5);
      N.v.z += ((dz / tLeft) - N.v.z) * Math.min(1, dt * 2.5);
      N.v.y = -0.75;
      N.p.x += (N.v.x + Math.sin(t * 5.1) * 0.35) * dt;
      N.p.z += (N.v.z + Math.cos(t * 4.3) * 0.35) * dt;
      N.p.y += N.v.y * dt;
      // settling: the last few centimetres it lies down on its spot
      if (N.p.y <= N.to[1] + 0.06) {
        N.landed = now;
        M.landed++;
        return;
      }
    }
    N.rx += N.spin * dt; N.rz += N.spin * 0.7 * dt; N.ry += dt;
    // flattening out as it nears the floor
    const lie = N.to ? Math.min(1, Math.max(0, 1 - (N.p.y - N.to[1]) / 0.6)) : 0;
    _q.setFromEuler(_e.set(N.rx, N.ry, N.rz, "XYZ"));
    if (lie > 0) _q.slerp(flatPose(_qf, N.to[3]), lie);
    M.mesh.setMatrixAt(i, _m.compose(N.p, _q, _s.setScalar(1)));
  });
  if (live || M.wasLive) { M.mesh.instanceMatrix.needsUpdate = true; M.fade.needsUpdate = true; }
  M.wasLive = live;
  if (live) M.stepMs = M.stepMs * 0.9 + (performance.now() - t0) * 0.1;
}

/* For the tests: what the notes are doing. */
export function moneyDebug(S) {
  const M = S?.money ?? moneyFor();
  if (!M) return null;
  return {
    drops: M.drops, thrown: M.thrown, emitted: M.emitted, landed: M.landed, spots: M.spots.length, pool: M.pool, tier: WORLD.tier, stepMs: M.stepMs,
    air: M.notes.filter((n) => n.on && !n.landed).length,
    lying: M.notes.filter((n) => n.on && n.landed).map((n) => ({ x: n.to[0], y: n.to[1], z: n.to[2], spot: n.spot })),
    fading: M.notes.filter((n) => n.on && n.landed && !n.spot && M.now - n.landed > LIE).length,
    force: () => { M.force = true; },
    emit: (x, y, z, dx, dy, dz, n, opts) => emitMoney(_p.set(x, y, z), _d.set(dx, dy, dz), n, opts),
  };
}
