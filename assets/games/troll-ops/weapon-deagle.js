// Troll Forces — the Desert Eagle Mark XIX (.50 AE), after Phantom Forces'.
// Builds the Wide Deagle and, under its gold finish, the Golden Grin
// (weapons.js model.deagle; weapon-model.js routes them here).
//
// Real metres, bore on y = 0, muzzle toward -z. The parts that move are
// their own nodes so the view model can work them:
//
//   root
//    ├─ barrel      fixed: the triangular Mark XIX barrel, its rail, the front blade
//    ├─ slide       rides back on every shot, locks back on an empty gun
//    │   └─ brass   the chambered round, seen through the ejection port
//    ├─ hammer      cocks as the slide comes back
//    ├─ frame       dust cover, squared guard, grip straps, stippled panels
//    └─ mag         single stack; the reload pulls it out of the grip
//
// Colours are spread in lightness (stainless slide, a darker barrel, a dark
// frame, black grips) so a metal finish on top (the Golden Grin) keeps its
// depth: applyFinish picks a tone per part from its paint.

import * as THREE from "three";
import { buildGripHand } from "./hand-model.js";
import { OPTIC_BUILDERS, BARREL_BUILDERS, UNDER_BUILDERS, railSection } from "./attachment-models.js?v=fg1-wst";

export const DEAGLE_MUZZLE_Z = -0.198;
export const SLIDE_TRAVEL = 0.027;   // how far the slide runs back
const BARREL_TOP = 0.016;
const SIGHT_Y = 0.0245;              // front blade top = rear notch floor: one sight line
const GRIP_RAKE = 0.29;              // the grip's lean (butt toward the shooter)
const MAG_POINT = new THREE.Vector3(0, -0.088, 0.042);
export const HAMMER_COCKED = 0.62;
const RAIL_SCALE = 0.4;               // a low rail: the irons see over it
const RAIL_Y = BARREL_TOP + 0.004 * RAIL_SCALE;

/* ---------------------------------------------------------------- textures */

const TEX = {};
function canvasTex(key, w, h, draw, repeat = 1) {
  if (TEX[key]) return TEX[key];
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  t.userData.shared = true;
  return (TEX[key] = t);
}

/* Brushed stainless: fine streaks running along the gun (the extrusions'
   UVs are in metres, so `repeat` is tiles per metre). */
function brushedTexture() {
  return canvasTex("brushed", 256, 256, (g, W, H) => {
    g.fillStyle = "#808080";
    g.fillRect(0, 0, W, H);
    let s = 11;
    const R = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 520; i++) {
      const y = R() * H, v = 100 + R() * 70;
      g.strokeStyle = `rgba(${v},${v},${v},${0.25 + R() * 0.35})`;
      g.lineWidth = 0.6 + R();
      g.beginPath();
      g.moveTo(R() * W * 0.3 - 30, y);
      g.lineTo(W * (0.7 + R() * 0.6), y + (R() - 0.5) * 1.5);
      g.stroke();
    }
  }, 14);
}

/* Stippled grip: a dense field of raised dots. */
function stippleTexture() {
  return canvasTex("stipple", 128, 128, (g, W, H) => {
    g.fillStyle = "#000";
    g.fillRect(0, 0, W, H);
    let s = 5;
    const R = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 1400; i++) {
      const v = 120 + R() * 135;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.beginPath();
      g.arc(R() * W, R() * H, 0.8 + R() * 1.3, 0, Math.PI * 2);
      g.fill();
    }
  }, 60);
}

/* A roll mark for the barrel's flank. */
function rollMarkTexture(text) {
  const key = `roll:${text}`;
  if (TEX[key]) return TEX[key];
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(24,24,28,0.92)";
  g.font = "600 34px 'DM Mono', monospace";
  g.textBaseline = "middle";
  g.fillText(text, 6, 33);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.userData.shared = true;
  return (TEX[key] = t);
}

/* The trollface medallion set in each grip panel, in black ink. */
const TROLL_URL = new URL("../../images/wallpaper/trollface%20transparent.png", import.meta.url).href;
function medallionTexture() {
  if (TEX.medal) return TEX.medal;
  const S = 128;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const draw = (img) => {
    const g = c.getContext("2d");
    g.fillStyle = "#c9ccd1";
    g.fillRect(0, 0, S, S);
    if (!img) return;
    const k = Math.min(S / img.width, S / img.height) * 0.8;
    const dw = img.width * k, dh = img.height * k;
    g.globalCompositeOperation = "multiply";
    g.drawImage(img, (S - dw) / 2, (S - dh) / 2, dw, dh);
    g.globalCompositeOperation = "source-over";
  };
  draw(null);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.userData.shared = true;
  const img = new Image();
  img.onload = () => { draw(img); t.needsUpdate = true; };
  img.src = TROLL_URL;
  return (TEX.medal = t);
}

/* --------------------------------------------------------------- materials */

function materials(env) {
  const brushed = brushedTexture();
  const std = (o) => new THREE.MeshStandardMaterial({ envMap: env, ...o });
  return {
    slide: std({ color: 0xaeb2b8, metalness: 1, roughness: 0.33, roughnessMap: brushed, bumpMap: brushed, bumpScale: 0.00025, envMapIntensity: 1.1 }),
    barrel: std({ color: 0x8e9299, metalness: 1, roughness: 0.28, roughnessMap: brushed, bumpMap: brushed, bumpScale: 0.0002, envMapIntensity: 1.05 }),
    cut: std({ color: 0x6a6e75, metalness: 0.95, roughness: 0.4, envMapIntensity: 1.0 }),
    frame: std({ color: 0x4e5157, metalness: 0.8, roughness: 0.44, envMapIntensity: 0.8 }),
    black: std({ color: 0x1d1e21, metalness: 0.7, roughness: 0.38, envMapIntensity: 0.7 }),
    grip: std({ color: 0x151517, metalness: 0.05, roughness: 0.86, bumpMap: stippleTexture(), bumpScale: 0.0009, envMapIntensity: 0.35 }),
    medal: std({ map: medallionTexture(), metalness: 0.85, roughness: 0.3, envMapIntensity: 1.0 }),
    brass: std({ color: 0xd9a84e, metalness: 0.95, roughness: 0.24, envMapIntensity: 1.2 }),
    bore: new THREE.MeshBasicMaterial({ color: 0x050505 }),
    dot: new THREE.MeshBasicMaterial({ color: 0xf2f2f2 }),
  };
}

/* ------------------------------------------------------------------ shapes */

const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
function cylZ(r, len, mat, seg = 18) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  m.rotation.x = Math.PI / 2;
  return m;
}
const shapeOf = (pts) => new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b)));

/* A side profile [z, y] extruded `width` across x, centred. */
function extrudeX(pts, width, mat, { bevel = 0.0012, holes = [] } = {}) {
  const s = shapeOf(pts);
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([a, b]) => new THREE.Vector2(a, b))));
  const g = new THREE.ExtrudeGeometry(s, {
    depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: 2, curveSegments: 8,
  });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.rotateY(-Math.PI / 2);     // shape x -> gun z, depth -> across x
  return new THREE.Mesh(g, mat);
}

/* A cross-section [x, y] run along z from z0 (front) to z1 (back). */
function extrudeZ(pts, z0, z1, mat, bevel = 0.0008) {
  const g = new THREE.ExtrudeGeometry(shapeOf(pts), {
    depth: z1 - z0 - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: 2,
  });
  g.translate(0, 0, z0 + bevel);
  return new THREE.Mesh(g, mat);
}

/* One .50 AE round lying along z, its base at z = 0. */
function round(M) {
  const g = new THREE.Group();
  const body = cylZ(0.0068, 0.03, M.brass, 14);
  body.position.z = -0.015;
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.0062, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.brass);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -0.03;
  g.add(body, nose);
  return g;
}

/* ------------------------------------------------------------------ parts */

function buildBarrel(M, label) {
  const g = new THREE.Group();
  // The triangular profile: a flat top carrying the rail, flanks sloping
  // out to the slide, a lug under it inside the slide.
  const section = [[-0.0078, BARREL_TOP], [0.0078, BARREL_TOP], [0.0156, -0.0015], [0.0156, -0.012], [-0.0156, -0.012], [-0.0156, -0.0015]];
  g.add(extrudeZ(section, DEAGLE_MUZZLE_Z, -0.02, M.barrel));
  // The crown: a dark ring round the bore in the flat muzzle face.
  const crown = new THREE.Mesh(new THREE.RingGeometry(0.0066, 0.0088, 24), M.cut);
  crown.rotation.y = Math.PI;
  crown.position.set(0, 0, DEAGLE_MUZZLE_Z - 0.0002);
  const bore = new THREE.Mesh(new THREE.CircleGeometry(0.0066, 24), M.bore);
  bore.rotation.y = Math.PI;
  bore.position.set(0, 0, DEAGLE_MUZZLE_Z - 0.0001);
  g.add(crown, bore);
  // Front blade dovetailed into the barrel top, a white dot facing you.
  const blade = box(0.0034, SIGHT_Y - BARREL_TOP, 0.011, M.black);
  blade.position.set(0, (SIGHT_Y + BARREL_TOP) / 2, -0.186);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0011, 10), M.dot);
  dot.position.set(0, SIGHT_Y - 0.0022, -0.1804);
  g.add(blade, dot);
  g.userData.irons = [blade, dot];
  // The integral rail along the top, low so the irons see over it.
  const rail = railSection(0.1, 0.0145, M.barrel);
  rail.scale.y = RAIL_SCALE;
  rail.position.set(0, RAIL_Y, -0.098);
  g.add(rail);
  // Roll marks on both flanks, laid on the slope.
  const a = Math.atan2(0.0078, BARREL_TOP + 0.0015);   // the flank's lean from vertical
  for (const side of [1, -1]) {
    const mat = new THREE.MeshStandardMaterial({
      map: rollMarkTexture(side < 0 ? label : "MARK XIX   .50 A.E."), transparent: true, opacity: 0.9, depthWrite: false, metalness: 0.5, roughness: 0.6,
    });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.094, 0.094 / 8), mat);
    const n = new THREE.Vector3(side * Math.cos(a), Math.sin(a), 0);
    const up = new THREE.Vector3(-side * Math.sin(a), Math.cos(a), 0);
    plate.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -side), up, n));
    plate.position.set(side * 0.0117, (BARREL_TOP - 0.0015) / 2, -0.11).addScaledVector(n, 0.0003);
    g.add(plate);
  }
  return g;
}

function buildSlide(M) {
  const g = new THREE.Group();
  // Rear block (level with the barrel top) and the long lower band that
  // wraps under the barrel to just short of the muzzle.
  g.add(extrudeX([[0.074, -0.017], [0.074, 0.011], [0.069, BARREL_TOP], [-0.03, BARREL_TOP], [-0.034, 0.0105],
    [-0.04, -0.0015], [-0.184, -0.0015], [-0.189, -0.006], [-0.189, -0.017]], 0.032, M.slide, { bevel: 0.002 }));
  // Rear serrations: slanted cuts on both flanks.
  for (let i = 0; i < 10; i++) {
    for (const x of [-1, 1]) {
      const cut = box(0.0012, 0.022, 0.0016, M.cut);
      cut.position.set(x * 0.0158, 0.0005, 0.035 + i * 0.0035);
      cut.rotation.x = -0.18;
      g.add(cut);
    }
  }
  // Ejection port on the right, the chambered round showing in it.
  const port = box(0.0016, 0.011, 0.024, M.bore);
  port.position.set(0.0155, 0.007, -0.016);
  const brass = cylZ(0.0068, 0.02, M.brass, 16);
  brass.position.set(0.0099, 0.007, -0.016);
  g.add(port, brass);
  // Rear sight: a square notch between two ears, a white dot on each.
  const rearBody = box(0.024, SIGHT_Y - BARREL_TOP, 0.009, M.black);
  rearBody.position.set(0, (SIGHT_Y + BARREL_TOP) / 2, 0.064);
  g.add(rearBody);
  for (const x of [-1, 1]) {
    const ear = box(0.0095, 0.003, 0.009, M.black);
    ear.position.set(x * 0.00725, SIGHT_Y + 0.0015, 0.064);
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.0011, 10), M.dot);
    d.position.set(x * 0.0075, SIGHT_Y - 0.0018, 0.0687);
    g.add(ear, d);
  }
  // Ambidextrous safety levers at the back of the slide.
  for (const x of [-1, 1]) {
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.004, 14), M.black);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(x * 0.0175, 0.003, 0.061);
    const paddle = box(0.0035, 0.0045, 0.014, M.black);
    paddle.position.set(x * 0.0182, 0.0005, 0.067);
    paddle.rotation.x = 0.35;
    g.add(hub, paddle);
  }
  const extractor = box(0.0014, 0.004, 0.016, M.cut);
  extractor.position.set(0.0161, 0.0125, 0.006);
  g.add(extractor);
  g.userData.brass = brass;
  return g;
}

function buildFrame(M) {
  const g = new THREE.Group();
  // Dust cover, trigger guard (a squared, hooked front with the hole through
  // it) and the top of the grip with the beavertail, as one profile.
  g.add(extrudeX([
    [0.06, -0.017], [-0.152, -0.017], [-0.158, -0.024], [-0.152, -0.031], [-0.077, -0.031],
    [-0.077, -0.058], [-0.083, -0.061], [-0.081, -0.066], [-0.071, -0.068], [-0.004, -0.068],
    [0.012, -0.058], [0.04, -0.06], [0.07, -0.04], [0.083, -0.022], [0.079, -0.015], [0.07, -0.017],
  ], 0.029, M.frame, {
    holes: [[[-0.069, -0.036], [-0.069, -0.06], [-0.006, -0.06], [0.004, -0.051], [0.004, -0.036]]],
  }));
  // The grip frame: front and back straps raked back toward the butt.
  g.add(extrudeX([[0.006, -0.05], [0.029, -0.128], [0.034, -0.133], [0.083, -0.131], [0.086, -0.125], [0.068, -0.04], [0.058, -0.034]], 0.026, M.frame));
  // Trigger: a curved blade.
  g.add(extrudeX([[-0.036, -0.036], [-0.042, -0.046], [-0.041, -0.055], [-0.036, -0.058], [-0.033, -0.055], [-0.035, -0.046], [-0.031, -0.036]], 0.0065, M.black, { bevel: 0.0006 }));
  // Slide stop on the left, takedown lever ahead of the guard, a cross pin.
  const stop = box(0.0022, 0.004, 0.042, M.black);
  stop.position.set(-0.0158, -0.021, -0.018);
  const stopTab = box(0.003, 0.008, 0.008, M.black);
  stopTab.position.set(-0.0162, -0.025, 0.0);
  const takedown = box(0.0022, 0.005, 0.014, M.black);
  takedown.position.set(-0.0158, -0.025, -0.064);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.0024, 0.0024, 0.0305, 10), M.cut);
  pin.rotation.z = Math.PI / 2;
  pin.position.set(0, -0.024, -0.11);
  g.add(stop, stopTab, takedown, pin);
  // Grip panels: stippled black, standing proud of the frame, each with a
  // trollface medallion where the eagle would be.
  g.add(extrudeX([[0.012, -0.056], [0.032, -0.122], [0.079, -0.12], [0.065, -0.042], [0.04, -0.042]], 0.033, M.grip, { bevel: 0.0016 }));
  for (const x of [-1, 1]) {
    const med = new THREE.Mesh(new THREE.CircleGeometry(0.0085, 24), M.medal);
    med.position.set(x * 0.0168, -0.078, 0.045);
    med.rotation.y = x * Math.PI / 2;
    g.add(med);
  }
  return g;
}

function buildHammer(M) {
  // Pivot at the back of the frame; the ring spur stands behind the slide.
  const g = new THREE.Group();
  g.position.set(0, -0.006, 0.072);
  const body = box(0.006, 0.016, 0.007, M.black);
  body.position.set(0, 0.007, 0.001);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0048, 0.0016, 8, 18), M.black);
  ring.rotation.y = Math.PI / 2;
  ring.position.set(0, 0.018, 0.003);
  g.add(body, ring);
  g.rotation.x = HAMMER_COCKED;
  return g;
}

function buildMag(M) {
  // Origin at MAG_POINT, upright in its own frame; the root tilts it.
  const g = new THREE.Group();
  const tube = box(0.019, 0.094, 0.038, M.black);
  tube.position.y = -0.002;
  const slot = box(0.0006, 0.05, 0.004, M.bore);
  slot.position.set(0.0098, 0.002, 0.004);
  const plate = box(0.027, 0.008, 0.05, M.black);
  plate.position.set(0, -0.049, 0.004);
  const top = round(M);
  top.position.set(0, 0.043, 0.016);
  g.add(tube, slot, plate, top);
  return g;
}

/* Showcase admire: [t, yaw°, twist°, tilt°, x, y, dz], as weapon-view.js
   GUN_INSPECT_KEYS. Up side-on (left flank, the roll mark), a press-check
   while it's there, a turn to the right flank (the port), home. */
export const DEAGLE_INSPECT_KEYS = [
  [0.00,  50,  24, -8,  0.08, -0.12, 0.06],
  [0.16,  82,  12,  6,  0.00, -0.03, 0],
  [0.34,  78,   6, 10, -0.01, -0.024, 0],
  [0.48,  84,  14,  4,  0.004, -0.03, 0],
  [0.58,  20, -26, -2,  0.00, -0.012, 0.05],
  [0.68, -82, -12,  6,  0.00, -0.03, 0],
  [0.84, -78,  -6,  9,  0.01, -0.024, 0],
  [1.00, -44, -22, -8,  0.09, -0.13, 0.06],
];

/* ------------------------------------------------------------------ build */

export function buildDeagle(def, { env = null } = {}) {
  const M = materials(env);
  const root = new THREE.Group();
  const u = root.userData;

  const barrel = buildBarrel(M, (def.name || "Wide Deagle").toUpperCase());
  const slide = buildSlide(M);
  const hammer = buildHammer(M);
  root.add(barrel, slide, hammer, buildFrame(M));

  const mag = buildMag(M);
  mag.position.copy(MAG_POINT);
  mag.rotation.x = -GRIP_RAKE;
  root.add(mag);
  u.magMesh = mag;
  u.magazinePoint = MAG_POINT.clone();
  u.magRestRotationX = -GRIP_RAKE;

  // The trigger hand's anchor (hidden: the PF rod ends here).
  const hand = buildGripHand(1.03);
  hand.userData.hand = true;
  hand.position.set(0, -0.078, 0.045);
  hand.rotation.x = 0.32;
  root.add(hand);
  u.gripPos = hand.position.clone();
  u.pistol = true;

  // An optic clamps to the barrel's rail (it doesn't ride the slide) and
  // the irons come off. The optic builders assume a full-height rail, so
  // measure from where that rail's origin would sit under these low teeth.
  const railTeeth = RAIL_Y + 0.0107 * RAIL_SCALE;
  const opticKey = def.attachments?.optic || (def.sight === "scope" ? "acog" : def.sight === "reddot" ? "reflex" : "iron");
  const opticBuild = OPTIC_BUILDERS[opticKey];
  const sight = new THREE.Group();
  let aimY = SIGHT_Y, aimZ = 0, optic = null;
  if (opticBuild) {
    optic = opticBuild();
    sight.add(optic);
    aimY = railTeeth - 0.0107 + 0.004 + (optic.userData.aimOffsetY ?? 0.05);
    aimZ = -0.085;
    sight.position.set(0, aimY, aimZ);
    for (const o of barrel.userData.irons) o.visible = false;
  }
  root.add(sight);
  u.sight = sight;
  u.aimPoint = new THREE.Vector3(0, aimY, aimZ);
  u.adsDistance = optic?.userData.adsDistance ?? null;
  u.adsWeaponFov = optic?.userData.adsWeaponFov ?? null;

  // A muzzle device on the crown.
  u.muzzleZ = DEAGLE_MUZZLE_Z;
  const devBuild = BARREL_BUILDERS[def.attachments?.barrel];
  if (devBuild) {
    const dev = devBuild(0.0125);
    const devLen = dev.userData.lengthZ ?? 0.05;
    dev.position.set(0, 0, DEAGLE_MUZZLE_Z - devLen / 2);
    root.add(dev);
    u.muzzleZ = DEAGLE_MUZZLE_Z - devLen;
  }

  // Under the dust cover, ahead of the guard.
  const ub = def.attachments?.underbarrel;
  const ubBuild = UNDER_BUILDERS[ub];
  if (ubBuild) {
    const unit = ubBuild();
    unit.position.set(0, ub === "laser" ? -0.052 : -0.031, -0.118);
    root.add(unit);
    if (ub === "laser") {
      const origin = unit.position.clone().add(unit.userData.emitter || new THREE.Vector3());
      const beamMat = new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.85, depthWrite: false });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 1, 6), beamMat);
      beam.rotation.x = Math.PI / 2;
      beam.position.copy(origin);
      beam.visible = false;
      root.add(beam);
      u.laserBeam = beam;
      u.laserOrigin = origin.clone();
    }
  }

  // The moving parts, for the view model (weapon-view.js).
  u.deagle = { slide, hammer, brass: slide.userData.brass, slideRestZ: slide.position.z };
  u.inspectKeys = DEAGLE_INSPECT_KEYS;
  root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return root;
}
