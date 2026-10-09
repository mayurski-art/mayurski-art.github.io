// Troll Forces — a horse you can ride (TROLL-CITY-RP2.md 2c). The same
// boxes and coats as Troll City's standing horses (trollcity-kit.js horse()),
// but its own Group with joints: four legs swung from the hips, a neck that
// nods and grazes, a tail, a real saddle on top (seat at y 1.62), reins.
//
// Built along +X (head that way), feet at y 0; `group.rotation.y = ry`
// faces it the kit's way (look yaw + π/2). pose(t, dt) walks / trots /
// gallops from st.gait (0 stand, 1 walk, 2 trot, 3 gallop) and st.v, and
// grazes when it's been stood a while.

import * as THREE from "three";

export const SEAT_Y = 1.62;      // the saddle's top, where a rider sits
export const GAITS = [
  { name: "stand", hz: 0, swing: 0 },
  { name: "walk", hz: 1.8, swing: 0.32 },
  { name: "trot", hz: 2.6, swing: 0.5 },
  { name: "gallop", hz: 3.2, swing: 0.78 },
];
// each leg's place in the stride (front-left, front-right, hind-left, hind-right)
const ORDER = [
  [0.25, 0.75, 0, 0.5],      // walk: four beats
  [0, 0.5, 0.5, 0],          // trot: the diagonals together
  [0.4, 0.5, 0, 0.1],        // gallop: hinds, then fronts
];

const shared = (m) => { m.userData.shared = true; return m; };
function box(mat, w, h, d, x, y, z, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.userData.shared = true;
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  m.rotation.z = rz;
  m.castShadow = true;
  return m;
}

/* One horse. M: the map's materials (horse_<coat>, horseDark, eye, leather,
   blanket). opts: { coat, saddled }. */
export function buildHorse(M, { coat = "bay", saddled = true } = {}) {
  const hide = shared(M[`horse_${coat}`] || M.horse_bay), dark = shared(M.horseDark), eye = shared(M.eye);
  const leather = shared(M.leather), blanket = shared(M.blanket);
  const group = new THREE.Group();
  group.name = `horse-${coat}`;
  // the body rides on its own node (the gallop rocks it)
  const body = new THREE.Group();
  group.add(body);
  body.add(box(hide, 1.55, 0.62, 0.6, 0, 1.26, 0));
  body.add(box(hide, 1.75, 0.5, 0.52, 0.02, 1.25, 0));
  // legs: hip pivots at y 1.0, the leg hanging to a dark hoof at the ground
  const legs = [];
  for (const [u, v] of [[0.62, -0.18], [0.62, 0.18], [-0.62, -0.18], [-0.62, 0.18]]) {
    const hip = new THREE.Group();
    hip.position.set(u, 1.0, v);
    hip.add(box(hide, 0.16, 0.82, 0.16, 0, -0.41, 0));
    hip.add(box(dark, 0.19, 0.2, 0.19, 0, -0.9, 0));
    body.add(hip);
    legs.push(hip);
  }
  // the neck from the withers, the head on its end
  const neck = new THREE.Group();
  neck.position.set(0.72, 1.35, 0);
  neck.add(box(hide, 0.75, 0.36, 0.34, 0.24, 0.1, 0, 0.75));
  const mane = box(dark, 0.78, 0.12, 0.1, 0.17, 0.25, 0, 0.75);
  neck.add(mane);
  const head = new THREE.Group();
  head.position.set(0.5, 0.33, 0);
  head.add(box(hide, 0.62, 0.26, 0.26, 0.06, 0.04, 0, -0.5));
  for (const v of [-0.08, 0.08]) head.add(box(hide, 0.06, 0.16, 0.06, -0.14, 0.22, v));            // ears
  for (const v of [-0.135, 0.135]) head.add(box(eye, 0.06, 0.06, 0.01, -0.02, 0.1, v));            // eyes
  neck.add(head);
  body.add(neck);
  // the tail
  const tail = new THREE.Group();
  tail.position.set(-0.86, 1.4, 0);
  tail.add(box(dark, 0.14, 0.8, 0.14, -0.08, -0.38, 0, -0.25));
  body.add(tail);
  // the saddle: on top of the back now (the kit's sat inside it), a horn,
  // a cantle, the blanket under, fenders and stirrups down the flanks
  const saddle = new THREE.Group();
  saddle.position.set(0.05, 1.57, 0);
  saddle.add(box(blanket, 0.78, 0.04, 0.66, 0, 0.0, 0));
  saddle.add(box(leather, 0.6, 0.07, 0.6, 0, 0.05, 0));
  saddle.add(box(leather, 0.1, 0.16, 0.12, 0.27, 0.12, 0));      // horn
  saddle.add(box(leather, 0.08, 0.12, 0.42, -0.26, 0.1, 0));     // cantle
  for (const v of [-0.33, 0.33]) {
    saddle.add(box(leather, 0.14, 0.5, 0.03, 0.04, -0.3, v));
    saddle.add(box(dark, 0.12, 0.04, 0.1, 0.04, -0.57, v * 1.05));   // the stirrup
  }
  body.add(saddle);
  saddle.visible = saddled;
  // reins: the bit to the horn
  const reinGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const reins = new THREE.Line(reinGeo, shared(new THREE.LineBasicMaterial({ color: 0x2a1608 })));
  reins.visible = saddled;
  group.add(reins);
  const st = { gait: 0, v: 0, phase: 0, stood: 0, nod: 0, graze: 0, sparkle: 0 };
  const model = { group, body, legs, neck, head, tail, saddle, reins, st };
  model.setSaddled = (on) => { saddle.visible = on; reins.visible = on; };
  model.pose = (t, dt) => poseHorse(model, t, dt);
  return model;
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3();
function poseHorse(m, t, dt) {
  const st = m.st;
  const G = GAITS[st.gait] || GAITS[0];
  // the stride clock runs with the speed (a slow walk steps slowly)
  const hz = G.hz * (st.gait ? Math.max(0.5, Math.min(1.25, st.v / [1, 3, 6, 11][st.gait])) : 0);
  st.phase = (st.phase + hz * dt) % 1;
  st.stood = st.gait ? 0 : st.stood + dt;
  const order = ORDER[Math.max(0, st.gait - 1)] || ORDER[0];
  m.legs.forEach((leg, i) => {
    const p = (st.phase + order[i]) % 1;
    // forward on the swing (first part), back on the stance
    const a = st.gait ? Math.sin(p * Math.PI * 2) * G.swing : 0;
    leg.rotation.z = THREE.MathUtils.damp(leg.rotation.z, a, 18, dt);
  });
  // the gallop rocks the body; the walk nods the head
  const bob = st.gait === 3 ? Math.sin(st.phase * Math.PI * 2) * 0.06 : st.gait === 2 ? Math.abs(Math.sin(st.phase * Math.PI * 2)) * 0.03 : 0;
  m.body.position.y = bob;
  m.body.rotation.z = st.gait === 3 ? Math.sin(st.phase * Math.PI * 2 + 1.2) * 0.07 : 0;
  // grazing after ten seconds stood still, head up again when it moves
  st.graze = THREE.MathUtils.damp(st.graze, st.stood > 10 ? 1 : 0, 2, dt);
  const nod = st.gait === 1 ? Math.sin(st.phase * Math.PI * 4) * 0.08 : st.gait === 3 ? Math.sin(st.phase * Math.PI * 2) * 0.12 : 0;
  m.neck.rotation.z = -1.35 * st.graze + nod + (st.gait === 3 ? -0.18 : 0);
  m.head.rotation.z = -0.6 * st.graze;
  // the tail: a swish standing, streaming out at a gallop
  m.tail.rotation.z = st.gait === 3 ? 0.9 : Math.sin(t * 1.7) * 0.18;
  m.tail.rotation.x = Math.sin(t * 2.3) * 0.25 * (st.gait ? 0.3 : 1);
  // the reins from the bit to the horn
  if (m.reins.visible) {
    m.group.updateMatrixWorld(true);
    m.head.localToWorld(_a.set(0.3, -0.06, 0));
    m.saddle.localToWorld(_b.set(0.27, 0.14, 0));
    m.group.worldToLocal(_a); m.group.worldToLocal(_b);
    const pos = m.reins.geometry.attributes.position;
    pos.setXYZ(0, _a.x, _a.y, _a.z); pos.setXYZ(1, _b.x, _b.y, _b.z);
    pos.needsUpdate = true;
  }
  // brushed: a little shine (the coat's emissive would be shared, so a scale pulse instead)
  if (st.sparkle > 0) { st.sparkle = Math.max(0, st.sparkle - dt); m.body.scale.setScalar(1 + Math.sin(st.sparkle * 12) * 0.01); }
  else m.body.scale.setScalar(1);
}
