// Troll Forces — Knuckle Grinners: a pair of polished brass knuckle
// dusters, one on each fist, each wearing a cast trollface on its striking
// plate (gear.js `knuckles`).
//
// First person (buildKnucklePair with hands): a root that stays at the
// guard, two fists inside it that do the punching, and two hand anchors
// (userData.hand) that copy the fists every frame so game.js wraps the
// the PF rods to them. A swing alternates a left jab and a
// right hook; the inspect brings the fists together, cracks the knuckles
// and turns them over to flash the trollface plates. pose() runs it all.
// Menus show the pair side by side; a third-person body wears one.

import * as THREE from "three";

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (v) => { v = clamp01(v); return v * v * (3 - 2 * v); };
const bell = (a, b, t) => Math.sin(clamp01((t - a) / (b - a)) * Math.PI);

export const KNUCKLE_JAB = 0.38, KNUCKLE_HOOK = 0.46;
export const KNUCKLE_JAB_WINDOW = { open: 0.12, close: 0.2 };
export const KNUCKLE_HOOK_WINDOW = { open: 0.17, close: 0.26 };
export const KNUCKLE_REST = { pos: new THREE.Vector3(0, -0.175, -0.42), quat: new THREE.Quaternion() };
const FIST_REST = [new THREE.Vector3(0.155, 0, 0.0), new THREE.Vector3(-0.15, 0.025, 0.04)];
const FIST_REST_ROT = [new THREE.Euler(0.35, -0.12, 0.2), new THREE.Euler(0.35, 0.12, -0.2)];
const SCALE = 1.35;

/* ---------------------------------------------------------------- textures */

const TROLL_URL = new URL("../../images/wallpaper/trollface%20transparent.png", import.meta.url).href;
let reliefTex = null;
/* The trollface cast into the plate: the ink lines as a bump map (they sink
   in) and darkened in the colour, everything else bare brass. */
function trollRelief() {
  if (reliefTex) return reliefTex;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, 256, 256);
  reliefTex = new THREE.CanvasTexture(c);
  reliefTex.colorSpace = THREE.SRGBColorSpace;
  const img = new Image();
  img.onload = () => {
    const s = Math.min(236 / img.width, 236 / img.height);
    g.drawImage(img, (256 - img.width * s) / 2, (256 - img.height * s) / 2, img.width * s, img.height * s);
    reliefTex.needsUpdate = true;
  };
  img.src = TROLL_URL;
  return reliefTex;
}

/* A little studio to reflect, so polished brass never reads flat. */
let studio = null;
function brassStudio() {
  if (studio) return studio;
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const g = c.getContext("2d");
  const sky = g.createLinearGradient(0, 0, 0, 128);
  sky.addColorStop(0, "#6a5a48"); sky.addColorStop(0.5, "#1e1a16"); sky.addColorStop(1, "#0a0806");
  g.fillStyle = sky; g.fillRect(0, 0, 256, 128);
  g.fillStyle = "rgba(255,240,210,.95)";
  g.fillRect(40, 20, 26, 40); g.fillRect(170, 26, 18, 34);
  g.fillStyle = "rgba(255,230,190,.4)";
  g.fillRect(0, 44, 256, 6);
  studio = new THREE.CanvasTexture(c);
  studio.mapping = THREE.EquirectangularReflectionMapping;
  studio.colorSpace = THREE.SRGBColorSpace;
  return studio;
}

function materials() {
  const env = brassStudio();
  const relief = trollRelief();
  return {
    brass: new THREE.MeshStandardMaterial({ color: 0xd9a944, roughness: 0.2, metalness: 1, envMap: env, envMapIntensity: 1.5 }),
    brassDark: new THREE.MeshStandardMaterial({ color: 0x8a6420, roughness: 0.35, metalness: 1, envMap: env, envMapIntensity: 1.1 }),
    plate: new THREE.MeshStandardMaterial({
      color: 0xe2b452, map: relief, bumpMap: relief, bumpScale: 0.004,
      roughness: 0.22, metalness: 1, envMap: env, envMapIntensity: 1.5, emissive: 0x000000,
    }),
  };
}

/* ------------------------------------------------------------- one duster */

/* One knuckle duster, worn on a fist: four finger rings in a row across
   the fist (local X), the striking plate across their front (-Z) with the
   trollface cast in it, and the palm bar under them. Its origin is the
   middle of the rings. */
export function buildKnuckleDuster(M = materials()) {
  const g = new THREE.Group();
  const ringR = 0.0115, tube = 0.0042, step = 0.0215;
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * step;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(ringR, tube, 10, 22), M.brass);
    ring.position.set(x, 0, 0);
    // the bigger rings in the middle, like a real casting
    ring.scale.setScalar(i === 1 || i === 2 ? 1.06 : 0.96);
    g.add(ring);
    // the web joining each ring to the next
    if (i < 3) {
      const web = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.012, 0.009), M.brass);
      web.position.set(x + step / 2, -0.006, 0);
      g.add(web);
    }
  }
  // the striking plate: a rounded bar across the front of the rings, the
  // trollface on its face
  const plateShape = new THREE.Shape();
  const w = step * 4 + 0.004, h = 0.03, r = 0.012;
  plateShape.moveTo(-w / 2 + r, -h / 2);
  plateShape.lineTo(w / 2 - r, -h / 2);
  plateShape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  plateShape.lineTo(w / 2, h / 2 - r);
  plateShape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  plateShape.lineTo(-w / 2 + r, h / 2);
  plateShape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  plateShape.lineTo(-w / 2, -h / 2 + r);
  plateShape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const plateGeo = new THREE.ExtrudeGeometry(plateShape, { depth: 0.007, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 6 });
  plateGeo.translate(0, 0, -0.0035);
  const plate = new THREE.Mesh(plateGeo, M.brassDark);
  plate.position.set(0, 0.012, -0.0165);
  g.add(plate);
  // the face, on the plate's front
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.034, 0.034), M.plate);
  face.position.set(0, 0.012, -0.0225);
  face.rotation.y = Math.PI;
  g.add(face);
  // studs along the plate either side of the face
  for (const x of [-0.034, -0.022, 0.022, 0.034]) {
    const stud = new THREE.Mesh(new THREE.SphereGeometry(0.0042, 10, 8), M.brass);
    stud.position.set(x, 0.012, -0.022);
    g.add(stud);
  }
  // the palm bar, curving under the rings and back into the palm
  const bar = new THREE.Mesh(new THREE.CapsuleGeometry(0.0075, w - 0.03, 4, 10), M.brass);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, -0.024, 0.012);
  g.add(bar);
  for (const x of [-w / 2 + 0.012, w / 2 - 0.012]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.02, 0.012), M.brass);
    strut.position.set(x, -0.015, 0.005);
    strut.rotation.x = -0.5;
    g.add(strut);
  }
  g.userData.plate = face;
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}

/* -------------------------------------------------------------- the pair */

/* `hands` (the view model) adds the two hand anchors the arms follow.
   `single` is the third-person body's: one duster on the right fist. */
export function buildKnucklePair({ hands = true, single = false } = {}) {
  const M = materials();
  const root = new THREE.Group();
  root.userData.kind = "knuckles";
  if (single) {
    const d = buildKnuckleDuster(M);
    d.scale.setScalar(1.15);
    d.rotation.set(-Math.PI / 2, 0, 0);
    d.position.set(0, -0.01, -0.03);
    root.add(d);
    return root;
  }
  const fists = [], anchors = [];
  for (let i = 0; i < 2; i++) {
    const fist = new THREE.Group();
    fist.position.copy(FIST_REST[i]);
    fist.rotation.copy(FIST_REST_ROT[i]);
    const d = buildKnuckleDuster(M);
    d.scale.setScalar(SCALE);
    fist.add(d);
    root.add(fist);
    fists.push(fist);
  }
  if (hands) {
    for (let i = 0; i < 2; i++) {
      // the arm's hand: on the palm bar, the grip axis across the fist,
      // signed so both fists close palm down, thumbs toward the middle
      // (the grip's axis in the hand's frame)
      const a = new THREE.Object3D();
      a.userData.hand = true;
      a.userData.gripAxis = new THREE.Vector3(i === 0 ? -1 : 1, 0, 0);
      root.add(a);
      anchors.push(a);
    }
  } else {
    // a menu preview: side by side, plates out
    fists[0].position.set(0.06, 0, 0);
    fists[1].position.set(-0.06, 0, 0);
    for (const f of fists) f.rotation.set(0, 0, 0);
  }
  root.userData.knuckles = { fists, anchors, M, lastIdx: -1, crackT: [] };
  return root;
}

/* ---------------------------------------------------------------- posing */

/* Per frame: where both fists are. `t` seconds into the swing (0 = none),
   `index` the swing number (even = left jab, odd = right hook), `inspect`
   0..1 through the admire or -1. Returns the crack beats that just passed
   (the caller plays the sound). */
const _anchorOff = new THREE.Vector3();
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
export function poseKnuckles(root, { t = 0, index = 0, inspect = -1, time = 0 } = {}) {
  const K = root.userData.knuckles;
  if (!K) return 0;
  let cracks = 0;
  for (let i = 0; i < 2; i++) {
    const f = K.fists[i];
    const s = i === 0 ? 1 : -1;
    f.position.copy(FIST_REST[i]);
    _e.copy(FIST_REST_ROT[i]);
    // guard: a slow boxer's bounce, the fists out of step
    f.position.y += Math.sin(time * 3.1 + i * 1.7) * 0.006;
    f.position.x += Math.sin(time * 1.9 + i) * 0.003;

    if (t > 0) {
      const jab = index % 2 === 0;
      if (jab) {
        const L = KNUCKLE_JAB, k = t / L;
        if (i === 1) {
          // the left jab: a short chamber, snapped straight down the centre
          // line turning the fist over, and pulled straight back
          const out = k < 0.18 ? -0.3 * smooth(k / 0.18) : k < 0.36 ? -0.3 + 1.3 * smooth((k - 0.18) / 0.18) : 1 - smooth((k - 0.5) / 0.5);
          f.position.x += 0.1 * Math.max(0, out);
          f.position.y += 0.06 * Math.max(0, out);
          f.position.z -= 0.36 * out;
          _e.z += -0.4 * Math.max(0, out);
          _e.x += -0.25 * Math.max(0, out);
        } else {
          // the right hand tucks in to guard the chin
          const g = bell(0, 1, k);
          f.position.x -= 0.03 * g;
          f.position.y += 0.03 * g;
          f.position.z += 0.04 * g;
        }
      } else {
        const L = KNUCKLE_HOOK, k = t / L;
        if (i === 0) {
          // the right hook: dropped and wound out, then whipped round across
          // the face of the target, elbow up, and back to guard
          const wind = bell(0, 0.35, k);
          const sweep = k < 0.22 ? 0 : k < 0.58 ? smooth((k - 0.22) / 0.36) : 1;
          const back = smooth((k - 0.62) / 0.38);
          const a = sweep * (1 - back);
          f.position.x += 0.06 * wind - 0.27 * a;
          f.position.y += -0.03 * wind + 0.09 * a;
          f.position.z += 0.04 * wind - 0.3 * Math.sin(Math.min(1, sweep) * Math.PI) * (1 - back) - 0.08 * a;
          _e.y += 0.35 * wind + 1.1 * a;
          _e.z += 0.4 * wind - 1.25 * a;
          _e.x += -0.3 * a;
        } else {
          const g = bell(0, 1, k);
          f.position.x += 0.03 * g;
          f.position.y += 0.03 * g;
          f.position.z += 0.05 * g;
        }
      }
    } else if (inspect >= 0) {
      const q = inspect;
      // fists together in the middle, knuckles touching...
      const together = smooth(q / 0.16) * (1 - smooth((q - 0.88) / 0.12));
      f.position.x += (-FIST_REST[i].x + s * 0.06) * together;
      f.position.y += 0.07 * together;
      f.position.z += -0.06 * together;
      // ...the crack: two jerks as one presses into the other
      const c1 = bell(0.2, 0.27, q), c2 = bell(0.3, 0.37, q);
      f.position.x -= s * 0.012 * (c1 + c2);
      _e.y += s * 0.25 * (c1 + c2);
      // then both turn over to show the plates: the trollface to camera
      const show = smooth((q - 0.42) / 0.12) * (1 - smooth((q - 0.78) / 0.12));
      _e.y += s * Math.PI * 0.92 * show;
      _e.x += -0.25 * show;
      f.position.y += 0.03 * show;
      f.position.z += 0.05 * show;
      f.position.x += s * 0.025 * show;
      // a glint running across the plate while it's shown
      const glint = bell(0.52 + i * 0.06, 0.62 + i * 0.06, q);
      K.M.plate.emissive.setRGB(glint * 0.22, glint * 0.16, glint * 0.06);
      if (i === 0) {
        for (const [beat, at] of [["c1", 0.215], ["c2", 0.315]]) {
          if (q >= at && !K.crackT.includes(beat)) { K.crackT.push(beat); cracks++; }
        }
      }
    }
    f.quaternion.setFromEuler(_e);
    // the arm's hand sits on the palm bar, behind the rings
    if (K.anchors[i]) {
      _anchorOff.set(0, -0.026, 0.045).applyQuaternion(f.quaternion);
      K.anchors[i].position.copy(f.position).add(_anchorOff);
      K.anchors[i].quaternion.copy(f.quaternion);
    }
  }
  if (inspect < 0) {
    K.crackT.length = 0;
    K.M.plate.emissive.setRGB(0, 0, 0);
  }
  return cracks;
}
