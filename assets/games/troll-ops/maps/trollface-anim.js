/* Trollface Island's moving parts (user, 2026-10-26: "the observatory should
   animate the telescope ... building lights flashing"), set up on each place
   model as it loads (maps/trollface-island.js passes every model through):

   - the Observatory's telescope tilts slowly up and down in the dome's slit:
     its tube's triangles are lifted out of tf-observatory-p4 into their own
     mesh on a pivot at the trunnions (same vertices, so the light map still
     fits);
   - the red beacons on the tall buildings and the warning lights blink, the
     marquee bulbs chase, the screens and LEDs flicker and pulse, the
     lighthouse lamp breathes.

   All on performance.now, each light's phase from where it stands, so no two
   blink together. Nothing here is a collider. */

import * as THREE from "three";

const now = () => performance.now() / 1000;

// how each lit material moves: its emissive intensity, 0..1+ of what it was built with
const BLINK = (t, ph) => ((t * 0.62 + ph) % 1 < 0.16 ? 1 : 0.06);                 // aviation beacon
const PATTERNS = {
  TF_Beacon: BLINK,
  TF_WarnLight: (t, ph) => ((t * 0.9 + ph) % 1 < 0.5 ? 1 : 0.15),
  TF_Bulb: (t, ph) => ((t * 1.6 + ph) % 1 < 0.6 ? 1 : 0.35),
  // screens: a slow breath, not a flicker (a fast one read as a glitch)
  TF_ArcadeScreen: (t, ph) => 0.9 + 0.1 * Math.sin(t * 1.4 + ph * 40),
  TF_VendScreen: (t, ph) => 0.92 + 0.08 * Math.sin(t * 1.1 + ph * 30),
  TF_MonitorGlow: (t, ph) => 0.9 + 0.1 * Math.sin(t * 1.2 + ph * 30),
  TF_ObsScreen: (t, ph) => 0.8 + 0.2 * Math.sin(t * 1.7 + ph * 20),
  TF_DJLed: (t, ph) => 0.4 + 0.6 * Math.abs(Math.sin(t * 3.2 + ph * 10)),
  TF_ServerLed: (t, ph) => ((t * 3.7 + ph) % 1 < 0.5 ? 1 : 0.3),
  TF_LabArc: (t, ph) => 0.5 + 0.5 * Math.abs(Math.sin(t * 9 + ph * 7) * Math.sin(t * 2.1)),
  TF_CoilGlow: (t, ph) => 0.6 + 0.4 * Math.sin(t * 2.4 + ph * 10),
  TF_Rune: (t, ph) => 0.55 + 0.45 * Math.sin(t * 1.3 + ph * 10),
  TF_LabOrbCore: (t, ph) => 0.7 + 0.3 * Math.sin(t * 2 + ph * 10),
  TF_LighthouseLamp: (t) => 0.55 + 0.45 * Math.max(0, Math.sin(t * 1.6)) ** 3,
};

const _w = new THREE.Vector3();
function animateLights(obj) {
  obj.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    const m = o.material, f = PATTERNS[m.name];
    if (!f) return;
    // its own copy, so the same light elsewhere keeps its own phase
    o.material = m.clone();
    const mat = o.material, base = m.emissiveIntensity;
    o.getWorldPosition(_w);
    const ph = Math.abs(Math.sin(_w.x * 12.9898 + _w.z * 78.233) * 43758.5453) % 1;
    o.onBeforeRender = () => { mat.emissiveIntensity = base * f(now(), ph); };
  });
}

/* The telescope (models/tf_mid.py, "telescope"): the tube on the line
   PIVOT + DIR * t, t from the eyepiece (-2.9) to the lens (4.86), its
   radius tapering 1.0 to 1.1 and the dew cap 1.25 to 1.38. Model coordinates. */
const PIVOT = new THREE.Vector3(-1.4, 7.6, 0);
const DIR = new THREE.Vector3(Math.sin(0.9), Math.cos(0.9), 0);
const tubeR = (t) => (t < 2.0 ? 1.0 + 0.1 * (t + 2.4) / 4.6 : t < 2.35 ? 1.2 : 1.38) + 0.02;
const PIER = [-2.56, -1.04, 6.56, 0.76];   // x0, x1, top, half-depth: its bevel stays put
// the tube out past the trunnions drawn half as long again (user: "that
// telescope isnt long enough"): the lens end 7.3 m out, well clear of the dome
const STRETCH = 1.5;

function telescope(obj) {
  obj.updateMatrixWorld(true);
  const inv = obj.matrixWorld.clone().invert();
  const meshes = [];
  obj.traverse((o) => { if (o.isMesh && o.geometry.index) meshes.push(o); });
  const pivot = new THREE.Group();
  pivot.position.copy(PIVOT);
  obj.add(pivot);
  const v = new THREE.Vector3();
  for (const mesh of meshes) {
    const g = mesh.geometry, pos = g.attributes.position, idx = g.index.array;
    const M = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld);   // mesh -> model
    const inTube = (i) => {
      v.fromBufferAttribute(pos, i).applyMatrix4(M);
      if (v.x > PIER[0] && v.x < PIER[1] && v.y < PIER[2] && Math.abs(v.z) < PIER[3]) return false;
      v.sub(PIVOT);
      const t = v.dot(DIR);
      return t > -2.95 && t < 4.95 && Math.sqrt(Math.max(0, v.lengthSq() - t * t)) <= tubeR(t);
    };
    const keep = [], take = [];
    for (let k = 0; k < idx.length; k += 3) {
      (inTube(idx[k]) && inTube(idx[k + 1]) && inTube(idx[k + 2]) ? take : keep).push(idx[k], idx[k + 1], idx[k + 2]);
    }
    if (!take.length) continue;
    g.setIndex(keep);
    const tg = new THREE.BufferGeometry();
    for (const [k, a] of Object.entries(g.attributes)) tg.setAttribute(k, a);
    // its own positions: the part out past the trunnions drawn longer
    const P = pos.clone(), back = M.clone().invert(), moved = new Set();
    for (const i of take) {
      if (moved.has(i)) continue;
      moved.add(i);
      v.fromBufferAttribute(P, i).applyMatrix4(M);
      const t = v.clone().sub(PIVOT).dot(DIR);
      if (t > 0) v.addScaledVector(DIR, t * (STRETCH - 1));
      v.applyMatrix4(back);
      P.setXYZ(i, v.x, v.y, v.z);
    }
    tg.setAttribute("position", P);
    tg.setIndex(take);
    const tube = new THREE.Mesh(tg, mesh.material);
    tube.castShadow = mesh.castShadow;
    tube.receiveShadow = mesh.receiveShadow;
    tube.matrixAutoUpdate = false;
    tube.matrix.makeTranslation(-PIVOT.x, -PIVOT.y, -PIVOT.z).multiply(M);
    tube.onBeforeRender = () => {
      const t = now();
      pivot.rotation.z = 0.11 * Math.sin(t * 0.31) + 0.035 * Math.sin(t * 0.83 + 1);   // sweeping the sky
      pivot.updateMatrixWorld(true);
    };
    pivot.add(tube);
  }
}

/* Every place model, as it's placed. */
export function animateIslandModel(obj) {
  animateLights(obj);
  if (obj.userData.model === "tf-observatory-p4") telescope(obj);
}
