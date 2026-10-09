// Troll Forces — outfits for the townsfolk (Socialize): clothes on the stick
// figure, so a crowd reads as people out for the night instead of a field
// of identical sticks. Trolling Loud's guests wear them (user, 2026-10-08:
// "the NPCs that are enjoying the club, not the club workers, should have
// various outfits on"); the staff keep the plain figure.
//
// Every piece is a simple solid riding one joint of the rig (character.js
// buildHumanoid), laid along the bone to the next joint, so every pose,
// dance and sit the figure does, the clothes do too. Flat colour with an
// ink rim (the edges darken to black where they turn away), like the art's
// outlines, with no extra draw calls for an outline hull. Pieces share
// geometry per rig scale and materials per colour.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/* ------------------------------------------------------------- materials */

const MATS = new Map();
function cloth(hex, { shine = 0 } = {}) {
  const key = `${hex}:${shine}`;
  let m = MATS.get(key);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({
    color: hex, roughness: shine ? 0.3 : 0.8, metalness: shine ? 0.85 : 0,
    emissive: hex, emissiveIntensity: shine ? 0.35 : 0.28,
  });
  // The ink rim: where the surface turns edge-on to the eye it goes black.
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      "#include <dithering_fragment>",
      `#include <dithering_fragment>
  gl_FragColor.rgb *= smoothstep(0.16, 0.36, abs(dot(normal, normalize(vViewPosition))));`,
    );
  };
  m.customProgramCacheKey = () => "outfit-ink";
  MATS.set(key, m);
  return m;
}

/* ------------------------------------------------------------- the pieces */

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const GEO = new Map();
function geo(key, make) {
  let g = GEO.get(key);
  if (!g) { g = make(); g.userData.shared = true; GEO.set(key, g); }
  return g;
}

/* A tapered tube on `joint` from `from` to `to` (its own space), radius r0
   at `from` and r1 at `to`, squashed front to back by `flat`. */
function tube(rig, joint, from, to, r0, r1, mat, { flat = 1, open = false, seg = 12 } = {}) {
  _d.subVectors(to, from);
  const len = _d.length();
  const k = (v) => Math.round(v * 1000);
  const g = geo(`t${k(len)}:${k(r0)}:${k(r1)}:${open}:${seg}`, () => new THREE.CylinderGeometry(r1, r0, len, seg, 1, open));
  const m = new THREE.Mesh(g, mat);
  m.position.addVectors(from, to).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(_up, _d.normalize());
  if (flat !== 1) {
    // flatten across the body's front-back axis (the joint's z), not the tube's own
    const s = new THREE.Group();
    s.position.copy(m.position);
    s.scale.set(1, 1, flat);
    m.position.set(0, 0, 0);
    s.add(m);
    joint.add(s);
    rig.outfit.push(s);
    return m;
  }
  joint.add(m);
  rig.outfit.push(m);
  return m;
}
/* A ball on `joint` at `at` (fills a bend: the waist, the shoulders). */
function ball(rig, joint, at, r, mat, { sy = 1, sz = 1 } = {}) {
  const m = new THREE.Mesh(geo(`b${Math.round(r * 1000)}`, () => new THREE.SphereGeometry(r, 14, 10)), mat);
  m.position.copy(at);
  m.scale.set(1, sy, sz);
  joint.add(m);
  rig.outfit.push(m);
  return m;
}
/* A flat drawn piece on the head board (a hat, shades): the art's own look,
   a canvas in ink and colour, on both sides of the board. */
const DRAWN = new Map();
function drawn(key, w, h, paint) {
  let mat = DRAWN.get(key);
  if (!mat) {
    const c = document.createElement("canvas");
    c.width = Math.round(w * 600); c.height = Math.round(h * 600);
    const g = c.getContext("2d");
    g.lineJoin = g.lineCap = "round";
    paint(g, c.width, c.height);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    // a touch under full white, or a white hat blooms like a lamp
    mat = new THREE.MeshBasicMaterial({ map: tex, color: 0xb8b8b8, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
    DRAWN.set(key, mat);
  }
  return mat;
}
function onHead(rig, mat, w, h, y, x = 0) {
  const s = rig.scale;
  const m = new THREE.Mesh(geo(`p${Math.round(w * s * 1000)}:${Math.round(h * s * 1000)}`, () => new THREE.PlaneGeometry(w * s, h * s)), mat);
  // in front of the face board (which faces -z), a hair off it
  m.position.set(x * s, y * s, -0.004 * s);
  m.rotation.y = Math.PI;
  m.renderOrder = 2;
  rig.parts.headPivot.add(m);
  rig.outfit.push(m);
  return m;
}

const css = (hex) => `#${hex.toString(16).padStart(6, "0")}`;
function inkPath(g, lw, fill, draw) {
  g.beginPath();
  draw();
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = lw;
  g.strokeStyle = "#060606";
  g.stroke();
}

/* ------------------------------------------------------------- garments */

/* Where the rig's bones run, in each joint's own space (character.js). */
function bones(rig) {
  const p = rig.parts;
  return {
    spine: p.spine.position.clone(),          // torso -> mid-back
    chest: p.chest.position.clone(),          // mid-back -> chest
    elbowL: p.elbowL.position.clone(), elbowR: p.elbowR.position.clone(),
    // the forearm runs on the same line, 52/48 of the upper arm
    handL: p.elbowL.position.clone().multiplyScalar(0.52 / 0.48),
    handR: p.elbowR.position.clone().multiplyScalar(0.52 / 0.48),
    knee: p.kneeL.position.clone(), ankle: p.ankleL.position.clone(),
  };
}

function wearTop(rig, kind, mat) {
  const p = rig.parts, s = rig.scale, w = rig.build ?? 1, B = bones(rig);
  const r = (v) => v * s * w;
  const O = new THREE.Vector3();
  // the body: hips to mid-back, mid-back to the shoulders, a cap over them
  tube(rig, p.torso, O, B.spine, r(0.088), r(0.096), mat, { flat: 0.72 });
  ball(rig, p.spine, O, r(0.096), mat, { sz: 0.72 });
  tube(rig, p.spine, O, B.chest, r(0.096), r(0.108), mat, { flat: 0.72 });
  ball(rig, p.chest, O, r(0.108), mat, { sy: kind === "tank" || kind === "dress" ? 0.35 : 0.55, sz: 0.72 });
  if (kind === "tank" || kind === "dress") return;
  // sleeves down the arms: to mid upper arm, or to the wrist
  for (const [arm, el, hand] of [[p.armL, B.elbowL, B.handL], [p.armR, B.elbowR, B.handR]]) {
    const long = kind === "long" || kind === "hoodie" || kind === "jacket" || kind === "suit";
    tube(rig, arm, O, _a.copy(el).multiplyScalar(long ? 1 : 0.55), r(0.052), r(long ? 0.044 : 0.048), mat);
    if (long) {
      ball(rig, el === B.elbowL ? p.elbowL : p.elbowR, O, r(0.044), mat);
      tube(rig, el === B.elbowL ? p.elbowL : p.elbowR, O, _b.copy(hand).multiplyScalar(0.82), r(0.044), r(0.04), mat);
    }
  }
  // a hood bunched at the back of the neck
  if (kind === "hoodie") ball(rig, p.chest, new THREE.Vector3(0, r(0.02), r(0.07)), r(0.075), mat, { sy: 0.7 });
}

function wearBottom(rig, kind, mat) {
  const p = rig.parts, s = rig.scale, w = rig.build ?? 1, B = bones(rig);
  const r = (v) => v * s * w;
  const O = new THREE.Vector3();
  if (kind === "skirt" || kind === "dress") {
    // a flare from the waist to above the knee
    tube(rig, p.hips, new THREE.Vector3(0, r(0.06), 0), new THREE.Vector3(0, -0.3 * s, 0), r(0.09), 0.2 * s, mat, { flat: 0.8, open: true, seg: 16 });
    return;
  }
  // the seat, then each leg: to the knee (shorts) or the ankle
  tube(rig, p.hips, new THREE.Vector3(0, r(0.07), 0), new THREE.Vector3(0, -r(0.07), 0), r(0.09), r(0.1), mat, { flat: 0.75 });
  for (const knee of [p.kneeL, p.kneeR]) {
    const thigh = knee.parent;
    tube(rig, thigh, O, _a.copy(B.knee).multiplyScalar(kind === "shorts" ? 0.72 : 1), r(0.066), r(kind === "shorts" ? 0.06 : 0.054), mat);
    if (kind === "shorts") continue;
    ball(rig, knee, O, r(0.054), mat);
    tube(rig, knee, O, _b.copy(B.ankle).multiplyScalar(0.9), r(0.054), r(0.05), mat);
  }
}

/* Hats and shades: drawn flat on the face board, like the art. */
const HAT_Y = 0.47;   // the board's top edge, over the head pivot (s = 1)
function wearHat(rig, kind, hex) {
  const fill = css(hex);
  if (kind === "cap") {
    onHead(rig, drawn(`cap${hex}`, 0.42, 0.2, (g, W, H) => {
      const lw = W * 0.035;
      inkPath(g, lw, fill, () => { g.moveTo(W * 0.14, H * 0.82); g.bezierCurveTo(W * 0.14, H * 0.05, W * 0.86, H * 0.05, W * 0.86, H * 0.82); g.closePath(); });
      inkPath(g, lw, fill, () => { g.moveTo(W * 0.06, H * 0.8); g.lineTo(W * 0.97, H * 0.72); g.lineTo(W * 0.97, H * 0.93); g.lineTo(W * 0.06, H * 0.95); g.closePath(); });
      inkPath(g, lw * 0.6, "#ffffff", () => { g.arc(W * 0.5, H * 0.18, W * 0.025, 0, Math.PI * 2); });
    }), 0.42, 0.2, HAT_Y + 0.04);
  } else if (kind === "beanie") {
    onHead(rig, drawn(`beanie${hex}`, 0.4, 0.2, (g, W, H) => {
      const lw = W * 0.035;
      inkPath(g, lw, fill, () => { g.moveTo(W * 0.1, H * 0.78); g.bezierCurveTo(W * 0.1, H * 0.02, W * 0.9, H * 0.02, W * 0.9, H * 0.78); g.closePath(); });
      inkPath(g, lw, fill, () => { g.rect(W * 0.07, H * 0.66, W * 0.86, H * 0.28); });
      g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = lw * 0.5;
      for (let i = 1; i < 9; i++) { g.beginPath(); g.moveTo(W * (0.07 + i * 0.0955), H * 0.68); g.lineTo(W * (0.07 + i * 0.0955), H * 0.92); g.stroke(); }
    }), 0.4, 0.2, HAT_Y + 0.03);
  } else if (kind === "bucket") {
    onHead(rig, drawn(`bucket${hex}`, 0.5, 0.2, (g, W, H) => {
      const lw = W * 0.03;
      inkPath(g, lw, fill, () => { g.moveTo(W * 0.24, H * 0.62); g.lineTo(W * 0.3, H * 0.1); g.lineTo(W * 0.7, H * 0.1); g.lineTo(W * 0.76, H * 0.62); g.closePath(); });
      inkPath(g, lw, fill, () => { g.moveTo(W * 0.04, H * 0.9); g.lineTo(W * 0.22, H * 0.58); g.lineTo(W * 0.78, H * 0.58); g.lineTo(W * 0.96, H * 0.9); g.closePath(); });
    }), 0.5, 0.2, HAT_Y + 0.03);
  } else if (kind === "conductor") {
    // the Grin Express's cap: a flat-topped pillbox, a brass band and
    // badge, a black visor
    onHead(rig, drawn(`conductor${hex}`, 0.42, 0.22, (g, W, H) => {
      const lw = W * 0.035;
      inkPath(g, lw, fill, () => { g.moveTo(W * 0.18, H * 0.8); g.lineTo(W * 0.21, H * 0.1); g.lineTo(W * 0.79, H * 0.1); g.lineTo(W * 0.82, H * 0.8); g.closePath(); });
      inkPath(g, lw * 0.6, "#d4a63a", () => { g.rect(W * 0.2, H * 0.55, W * 0.6, H * 0.14); });
      inkPath(g, lw * 0.5, "#f0d27a", () => { g.arc(W * 0.5, H * 0.33, W * 0.055, 0, Math.PI * 2); });
      inkPath(g, lw, "#0c0c10", () => { g.moveTo(W * 0.1, H * 0.8); g.lineTo(W * 0.9, H * 0.8); g.lineTo(W * 0.8, H * 0.96); g.lineTo(W * 0.2, H * 0.96); g.closePath(); });
    }), 0.42, 0.22, HAT_Y + 0.05);
  }
}

/* A job's hat (Troll City roleplay: the conductor's cap), on anyone; null
   takes it off. Kept apart from the outfit, so a job never undresses
   anyone and their own hat comes back after. Cheap to call every frame. */
const JOB_HATS = { conductor: 0x1c2a4a };
export function wearJobHat(rig, kind) {
  kind = JOB_HATS[kind] != null ? kind : null;
  if (!rig || (rig.jobHatKind ?? null) === kind) return;
  rig.jobHat?.parent?.remove(rig.jobHat);
  rig.jobHat = null;
  rig.jobHatKind = kind;
  for (const o of rig.outfit || []) if (o.userData.hat) o.visible = !kind;   // one hat at a time
  if (!kind) return;
  const keep = rig.outfit;
  rig.outfit = [];
  wearHat(rig, kind, JOB_HATS[kind]);
  rig.jobHat = rig.outfit[0] || null;
  rig.outfit = keep;
  if (rig.jobHat) {
    rig.jobHat.userData.outfit = true;
    rig.jobHat.castShadow = false;
    // cached for everyone who wears it: a leaving peer's dispose
    // (remote-players.js) must leave them be
    rig.jobHat.geometry.userData.shared = true;
    rig.jobHat.material.userData.shared = true;
  }
}
function wearShades(rig, hex) {
  // across the eyes (the grin's eyes sit about a third of the way down)
  onHead(rig, drawn(`shades${hex}`, 0.4, 0.1, (g, W, H) => {
    const lw = W * 0.03;
    g.fillStyle = "#060606";
    g.fillRect(W * 0.1, H * 0.18, W * 0.8, H * 0.12);
    for (const x of [0.12, 0.54]) {
      inkPath(g, lw, "#0d0d12", () => { g.moveTo(W * x, H * 0.2); g.lineTo(W * (x + 0.34), H * 0.2); g.lineTo(W * (x + 0.3), H * 0.88); g.lineTo(W * (x + 0.04), H * 0.88); g.closePath(); });
      g.fillStyle = css(hex); g.globalAlpha = 0.55;
      g.fillRect(W * (x + 0.06), H * 0.3, W * 0.06, H * 0.2);
      g.globalAlpha = 1;
    }
  }), 0.4, 0.1, 0.31, 0.01);
}
function wearChain(rig) {
  const s = rig.scale, w = rig.build ?? 1;
  const gold = cloth(0xe8b83a, { shine: 1 });
  const g = geo(`chain${Math.round(s * w * 1000)}`, () => new THREE.TorusGeometry(0.085 * s * w, 0.011 * s, 6, 24));
  const m = new THREE.Mesh(g, gold);
  // hung round the neck, lying on the chest
  m.position.set(0, -0.06 * s, -0.045 * s * w);
  m.rotation.x = Math.PI / 2 - 0.35;
  m.scale.set(1, 1.25, 1);
  rig.parts.chest.add(m);
  rig.outfit.push(m);
}

/* ------------------------------------------------------------- outfits */

/* Put `spec` on a rig (taking off whatever it wore):
   { top: [kind, hex], bottom: [kind, hex], hat: [kind, hex] | null, shades: hex | null, chain: bool }
   top: tee tank long hoodie jacket suit dress; bottom: pants shorts skirt
   (a dress brings its own). */
export function wearOutfit(rig, spec) {
  takeOff(rig);
  if (!spec) return;
  rig.outfit = [];
  // User, 2026-10-08: "what are these torso outfits people are wearing. i
  // dont want these" — "all clothing except head and facial". The body
  // stays the plain stick figure; only the hats and shades on the face
  // board are worn. (wearTop/wearBottom/wearChain are kept, unused, in
  // case clothes come back in another style.)
  if (spec.hat) { wearHat(rig, spec.hat[0], spec.hat[1]); rig.outfit[rig.outfit.length - 1].userData.hat = true; }
  if (spec.shades) wearShades(rig, spec.shades);
  bake(rig);
  for (const o of rig.outfit) o.traverse((m) => { if (m.isMesh) { m.castShadow = false; m.userData.outfit = true; } });
}
export function takeOff(rig) {
  for (const o of rig.outfit || []) { o.parent?.remove(o); if (o.isSkinnedMesh) { o.geometry.dispose(); o.skeleton.dispose(); } }
  rig.outfit = null;
}

/* A dozen pieces on a dozen joints would be a dozen draw calls per guest,
   and a full dance floor doubled the club's (measured 829 -> 1488). So the
   solid pieces are merged, one mesh per material, into a skinned mesh whose
   bones are the rig's own joints (every vertex rides its joint fully): the
   same motion, two or three draw calls. The drawn hats and shades stay as
   they are. */
const _rootInv = new THREE.Matrix4(), _m = new THREE.Matrix4();
function bake(rig) {
  const root = rig.root;
  root.updateMatrixWorld(true);
  _rootInv.copy(root.matrixWorld).invert();
  const byMat = new Map(), keep = [];
  for (const o of rig.outfit) {
    const mesh = o.isMesh ? o : o.children[0];
    if (!mesh?.isMesh || mesh.material.map) { keep.push(o); continue; }
    if (!byMat.has(mesh.material)) byMat.set(mesh.material, []);
    byMat.get(mesh.material).push({ o, mesh, joint: o.parent });
  }
  const out = [...keep];
  for (const [mat, list] of byMat) {
    const bones = [], geos = [];
    for (const { mesh, joint } of list) {
      let bi = bones.indexOf(joint);
      if (bi < 0) { bi = bones.length; bones.push(joint); }
      // the piece where it sits now (the rig at rest), in the rig's own space
      const g = mesh.geometry.clone().applyMatrix4(_m.multiplyMatrices(_rootInv, mesh.matrixWorld));
      const n = g.attributes.position.count;
      g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(new Uint16Array(n * 4).fill(0).map((_, i) => (i % 4 ? 0 : bi)), 4));
      g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 ? 0 : 1)), 4));
      geos.push(g);
    }
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    const skinned = new THREE.SkinnedMesh(merged, mat);
    root.add(skinned);
    skinned.updateMatrixWorld(true);
    skinned.bind(new THREE.Skeleton(bones), skinned.matrixWorld);
    // culled as the whole body: any pose stays inside this, round the rig
    skinned.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.95 * rig.scale, 0), 1.5 * rig.scale);
    out.push(skinned);
    for (const { o } of list) o.parent?.remove(o);
  }
  rig.outfit = out;
}

const NEON = [0xff3fb4, 0x3ff0ff, 0x9dff3a, 0xb35cff, 0xfff03a, 0xff7a2a];
const STREET = [0x111114, 0xf2f2f2, 0x2a3f8a, 0x8a1a2a, 0x3a5a3a, 0x6a6a72, 0xd8c8a8, 0x1c2a4a];
const DENIM = [0x2d4a7a, 0x1e2f52, 0x3c5f94, 0x111114, 0x2a2a30];
const LUX = [0x111114, 0xf2efe6, 0x8a0c1e, 0xd9a93c, 0x20203a];

/* An outfit for a guest of `role` (Clubgoer, Raver, VIP), from a 0..1 seed:
   ravers in neon, clubgoers in street clothes, VIPs dressed up. */
export function pickOutfit(role, seed) {
  let x = Math.floor(seed * 4294967295) >>> 0;
  const r = () => { x = (Math.imul(x ^ (x >>> 15), 2246822519) + 0x9e3779b9) >>> 0; return x / 4294967296; };
  const of = (a) => a[Math.floor(r() * a.length)];
  if (role === "VIP") {
    if (r() < 0.45) return { top: ["dress", of([0x111114, 0xd9a93c, 0x8a0c1e, 0xf2efe6, 0xb35cff])], shades: r() < 0.4 ? 0xd9a93c : null, chain: r() < 0.5 };
    const jacket = of(LUX);
    return { top: [r() < 0.6 ? "suit" : "jacket", jacket], bottom: ["pants", jacket === 0xf2efe6 ? 0xf2efe6 : 0x111114], shades: r() < 0.55 ? 0xd9a93c : null, chain: r() < 0.7 };
  }
  if (role === "Raver") {
    const top = of(["tank", "tee", "tank", "tee", "hoodie"]);
    return {
      top: [top, of(NEON)], bottom: [of(["shorts", "pants", "skirt", "shorts"]), of([...NEON, 0x111114, 0x111114])],
      hat: r() < 0.3 ? [of(["bucket", "cap"]), of(NEON)] : null, shades: r() < 0.35 ? of(NEON) : null, chain: false,
    };
  }
  // clubgoers
  if (r() < 0.25) return { top: ["dress", of([...STREET, 0xff3fb4, 0xb35cff])], hat: null, shades: r() < 0.2 ? of(NEON) : null, chain: r() < 0.2 };
  return {
    top: [of(["tee", "tee", "long", "hoodie", "jacket", "tank"]), of([...STREET, ...NEON.slice(0, 3)])],
    bottom: [of(["pants", "pants", "pants", "shorts", "skirt"]), of(DENIM)],
    hat: r() < 0.3 ? [of(["cap", "beanie", "bucket", "cap"]), of(STREET)] : null,
    shades: r() < 0.2 ? of(NEON) : null, chain: r() < 0.25,
  };
}
