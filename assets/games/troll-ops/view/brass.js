// Spent brass out of the port (DESIGN-ARSENAL.md #5): one pooled
// InstancedMesh of 24 casings in the weapon camera's space (the gun's
// parent), so a case leaves the gun and flies on its own. Thrown right, up
// and a little back, spinning, falling, shrunk away after 0.6 s. A case per
// class (weapon-model.js userData.brass); rate-limited so a 900 rpm gun
// doesn't empty the pool. First person only: third person and other
// players never throw any.

import * as THREE from "three";

const POOL = 24;
const LIFE = 0.6, FADE = 0.15;
const GAP = 0.04;                                  // seconds between cases at most
const GRAVITY = -7;                                // camera-space y, m/s^2
// radius, length (metres), colour, and a neck or not
export const CASINGS = {
  "556":  { r: 0.0029, len: 0.045, color: 0xc89b45 },
  "762":  { r: 0.0056, len: 0.039, color: 0xc89b45 },
  "338":  { r: 0.0074, len: 0.069, color: 0xc89b45 },
  "12ga": { r: 0.0101, len: 0.07, color: 0xb3261e },
  "9mm":  { r: 0.0049, len: 0.019, color: 0xc89b45 },
};

let mesh = null;
const slots = [];
let next = 0, since = 1e3;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _right = new THREE.Vector3(), _up = new THREE.Vector3(), _back = new THREE.Vector3(), _c = new THREE.Color();
const _axis = new THREE.Vector3(), _dq = new THREE.Quaternion();

function build() {
  // a unit case along +y (rim, body, shoulder, neck); scaled per instance
  const prof = [[0, 0], [1.05, 0], [1.05, 0.04], [0.92, 0.06], [1, 0.08], [1, 0.74], [0.74, 0.84], [0.72, 1], [0, 1]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(prof, 10);
  geo.translate(0, -0.5, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.85, roughness: 0.32 });
  mesh = new THREE.InstancedMesh(geo, mat, POOL);
  mesh.name = "brass";
  mesh.frustumCulled = false;
  mesh.userData.shared = true;
  for (let i = 0; i < POOL; i++) {
    slots.push({ t: LIFE, p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Vector3(), r: 0, len: 0 });
    mesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
    mesh.setColorAt(i, _c.set(0xffffff));
  }
  mesh.count = POOL;
}

/* Throw a case out of `gun`'s eject point (gun-local), `kind` a CASINGS key. */
export function ejectBrass(gun, kind = "556", envMap = null) {
  const pt = gun?.userData.gunPoints?.eject;
  if (!pt || !gun.parent || since < GAP) return false;
  if (!mesh) build();
  if (mesh.parent !== gun.parent) gun.parent.add(mesh);
  if (envMap && mesh.material.envMap !== envMap) { mesh.material.envMap = envMap; mesh.material.needsUpdate = true; }
  since = 0;
  const c = CASINGS[kind] ?? CASINGS["556"];
  const s = slots[next];
  next = (next + 1) % POOL;
  gun.updateMatrix();
  s.p.copy(pt).applyMatrix4(gun.matrix);                 // gun-local -> camera space
  _right.set(1, 0, 0).applyQuaternion(gun.quaternion);
  _up.set(0, 1, 0).applyQuaternion(gun.quaternion);
  _back.set(0, 0, 1).applyQuaternion(gun.quaternion);
  s.v.copy(_right).multiplyScalar(1.5 + Math.random() * 0.5)
    .addScaledVector(_up, 0.9 + Math.random() * 0.4)
    .addScaledVector(_back, 0.25 + Math.random() * 0.3);
  // lying across the port, nose forward, tumbling end over end
  s.q.copy(gun.quaternion).multiply(_dq.setFromAxisAngle(_axis.set(1, 0, 0), -Math.PI / 2));
  s.w.set(Math.random() - 0.5, Math.random() - 0.5, 2.5 + Math.random()).normalize().multiplyScalar(18 + Math.random() * 10);
  s.t = 0;
  s.r = c.r;
  s.len = c.len;
  mesh.setColorAt(slots.indexOf(s), _c.set(c.color));
  mesh.instanceColor.needsUpdate = true;
  return true;
}

/* Every frame: fly, spin, fall, shrink away. */
export function updateBrass(dt) {
  since += dt;
  if (!mesh) return;
  let live = 0;
  for (let i = 0; i < POOL; i++) {
    const s = slots[i];
    if (s.t >= LIFE) { mesh.setMatrixAt(i, _m.makeScale(0, 0, 0)); continue; }
    live++;
    s.t += dt;
    s.v.y += GRAVITY * dt;
    s.p.addScaledVector(s.v, dt);
    const ang = s.w.length() * dt;
    if (ang > 0) s.q.premultiply(_dq.setFromAxisAngle(_axis.copy(s.w).normalize(), ang));
    const k = s.t > LIFE - FADE ? Math.max(0, (LIFE - s.t) / FADE) : 1;
    _s.set(s.r * k, s.len * k, s.r * k);
    mesh.setMatrixAt(i, _m.compose(s.p, s.q, _s));
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.visible = live > 0;
}

/* How many cases are in the air (tests). */
export function liveBrass() {
  return slots.reduce((n, s) => n + (s.t < LIFE ? 1 : 0), 0);
}
