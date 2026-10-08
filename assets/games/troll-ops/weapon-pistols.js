// Troll Forces — the pistols, traced from reference photos so each reads as
// the real gun: the Sixty-Nine (FN Five-seveN) and the TRUE-69 (Black Ops
// 2's KAP-40). weapons.js model.build picks the builder; weapon-model.js
// routes them here.
//
// Every outline is the gun's side profile measured off a side-on reference
// image in pixels and mapped to metres (`mapper`), so proportions, the grip
// rake and the signature cuts come from the photo, not from memory. Each
// profile is extruded across x. The slide is its own node so the view model
// can cycle it (placePistolSlide), and the mag is its own node so the
// reload can pull it.

import * as THREE from "three";
import { buildGripHand } from "./hand-model.js";
import { OPTIC_BUILDERS, BARREL_BUILDERS, UNDER_BUILDERS, railSection } from "./attachment-models.js?v=fg1-wst";

/* ---------------------------------------------------------------- helpers */

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

/* Fine stipple, for polymer grips (the extrusions' UVs are metres). */
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
  }, 70);
}

/* Raised diamond checkering, for the KAP-40's rubber grip. */
function checkerTexture() {
  return canvasTex("checker", 64, 64, (g, W, H) => {
    g.fillStyle = "#000";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#fff";
    for (const [cx, cy] of [[0, 0], [32, 32], [64, 0], [0, 64], [64, 64]]) {
      g.beginPath();
      g.moveTo(cx, cy - 13); g.lineTo(cx + 13, cy); g.lineTo(cx, cy + 13); g.lineTo(cx - 13, cy);
      g.fill();
    }
  }, 260);
}

/* Text stamped on a flank (a transparent decal). */
function stampTexture(text, color = "rgba(225,225,215,0.85)") {
  const key = `stamp:${text}:${color}`;
  if (TEX[key]) return TEX[key];
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = color;
  g.font = "700 40px 'DM Mono', monospace";
  g.textBaseline = "middle";
  g.fillText(text, 4, 33);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.userData.shared = true;
  return (TEX[key] = t);
}

/* Photo pixels -> gun metres. `s` metres per pixel; (x0, y0) is the pixel
   that lands at (z0, 0); `dir` is +1 when the muzzle is on the photo's
   left (z grows with px), -1 when it is on the right. */
function mapper({ s, x0, y0, z0, dir }) {
  const P = ([px, py]) => [z0 + dir * (px - x0) * s, -(py - y0) * s];
  return { s, P, poly: (pts) => pts.map(P), z: (px) => P([px, y0])[0], y: (py) => -(py - y0) * s };
}

const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
function cylZ(r, len, mat, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  m.rotation.x = Math.PI / 2;
  return m;
}
const shapeOf = (pts) => new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b)));

/* A side profile [z, y] extruded `width` across x (centred, or from x0). */
function extrudeX(pts, width, mat, { bevel = 0.0008, holes = [], x = 0 } = {}) {
  const s = shapeOf(pts);
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([a, b]) => new THREE.Vector2(a, b))));
  const g = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.0002, width - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: 2, curveSegments: 6,
  });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.rotateY(-Math.PI / 2);     // shape x -> gun z, depth -> across x
  const m = new THREE.Mesh(g, mat);
  m.position.x = x;
  return m;
}

/* A flat decal on a flank: `side` +1 right, -1 left; (z, y) its centre. */
function decal(tex, side, x, z, y, w, h) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, opacity: 0.9, depthWrite: false, roughness: 0.7, metalness: 0.1 }));
  m.rotation.y = side * Math.PI / 2;
  m.position.set(side * x, y, z);
  return m;
}

/* A screw head / pin end on both flanks. */
function pins(group, mat, x, pts, r = 0.0016) {
  for (const [z, y] of pts) {
    for (const side of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.0008, 10), mat);
      p.rotation.z = Math.PI / 2;
      p.position.set(side * x, y, z);
      group.add(p);
    }
  }
}

/* Iron sights on a level line at `sightY`: a rear block with a square
   notch (two ears) and a front blade, each with a white dot facing you. */
function irons(M, { rearZ0, rearZ1, rearBaseY, frontZ0, frontZ1, frontBaseY, sightY, rearW = 0.02, earH = 0.0022 }) {
  const rear = new THREE.Group(), front = new THREE.Group();
  const rz = (rearZ0 + rearZ1) / 2, rd = Math.abs(rearZ1 - rearZ0);
  const body = box(rearW, sightY - rearBaseY, rd, M.sight);
  body.position.set(0, (sightY + rearBaseY) / 2, rz);
  rear.add(body);
  const earW = (rearW - 0.0066) / 2;
  for (const s of [-1, 1]) {
    const ear = box(earW, earH, rd, M.sight);
    ear.position.set(s * (0.0033 + earW / 2), sightY + earH / 2, rz);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0009, 10), M.dot);
    dot.position.set(s * (0.0033 + earW / 2), sightY - 0.0012, Math.max(rearZ0, rearZ1) + 0.0002);
    rear.add(ear, dot);
  }
  const fz = (frontZ0 + frontZ1) / 2, fd = Math.abs(frontZ1 - frontZ0);
  const blade = box(0.0032, sightY - frontBaseY, fd, M.sight);
  blade.position.set(0, (sightY + frontBaseY) / 2, fz);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0009, 10), M.dot);
  dot.position.set(0, sightY - 0.0014, Math.max(frontZ0, frontZ1) + 0.0002);
  front.add(blade, dot);
  return { rear, front };
}

/* The attachment mounts every pistol shares: an optic on a rail top (irons
   off), a device on the crown, laser or grip under the dust cover. */
function mountAttachments(root, def, { irons: ironParts, railTop, opticZ, muzzle, barrelR, under }) {
  const u = root.userData;
  const opticKey = def.attachments?.optic || (def.sight === "scope" ? "acog" : def.sight === "reddot" ? "reflex" : "iron");
  const opticBuild = OPTIC_BUILDERS[opticKey];
  const sight = new THREE.Group();
  let aimY = u.sightY, aimZ = 0, optic = null;
  if (opticBuild) {
    optic = opticBuild();
    sight.add(optic);
    // the optic builders sit on a full-height rail's teeth (origin + 0.0107)
    aimY = railTop - 0.0107 + 0.004 + (optic.userData.aimOffsetY ?? 0.05);
    aimZ = opticZ;
    sight.position.set(0, aimY, aimZ);
    for (const o of ironParts) o.visible = false;
  }
  root.add(sight);
  u.sight = sight;
  u.aimPoint = new THREE.Vector3(0, aimY, aimZ);
  u.adsDistance = optic?.userData.adsDistance ?? null;
  u.adsWeaponFov = optic?.userData.adsWeaponFov ?? null;

  u.muzzleZ = muzzle.z;
  const devBuild = BARREL_BUILDERS[def.attachments?.barrel];
  if (devBuild) {
    const dev = devBuild(barrelR);
    const devLen = dev.userData.lengthZ ?? 0.05;
    dev.position.set(0, muzzle.y, muzzle.z - devLen / 2);
    root.add(dev);
    u.muzzleZ = muzzle.z - devLen;
  }

  const ub = def.attachments?.underbarrel;
  const ubBuild = UNDER_BUILDERS[ub];
  if (ubBuild) {
    const unit = ubBuild();
    unit.position.set(0, ub === "laser" ? under.y - 0.021 : under.y, under.z);
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
}

/* The trigger hand's anchor (hidden: the PF rod ends here). */
function gripAnchor(root, z, y) {
  const hand = buildGripHand(1.03);
  hand.userData.hand = true;
  hand.position.set(0, y, z);
  hand.rotation.x = 0.32;
  root.add(hand);
  root.userData.gripPos = hand.position.clone();
  root.userData.pistol = true;
}

/* A mag whose parts are built in gun space: its group sits at `point` with
   no rotation (the rake is baked into the parts), so the sidearm reload
   pulls it straight down out of the grip. */
function magGroup(root, point, parts) {
  const g = new THREE.Group();
  g.position.copy(point);
  for (const p of parts) { p.position.sub(point); g.add(p); }
  root.add(g);
  root.userData.magMesh = g;
  root.userData.magazinePoint = point.clone();
  root.userData.magRestRotationX = 0;
  return g;
}

/* ------------------------------------------------- Sixty-Nine (Five-seveN) */

/* Traced from a right-side photo of an FN Five-seveN (Wikimedia Commons,
   "FN Five Seven.jpg", 1280 px wide): muzzle at px 1008, the slide's rear
   at 272, 208 mm long. Bore height px 120. */
const F7 = mapper({ s: 0.208 / 736, x0: 400, y0: 120, z0: 0.045, dir: -1 });
const F7_SIGHT = F7.y(62);

function f7Materials(env) {
  const std = (o) => new THREE.MeshStandardMaterial({ envMap: env, ...o });
  return {
    slide: std({ color: 0x2b2d31, metalness: 0.55, roughness: 0.42, envMapIntensity: 0.9 }),
    frame: std({ color: 0x1c1d1f, metalness: 0.05, roughness: 0.72, envMapIntensity: 0.5 }),
    grip: std({ color: 0x232426, metalness: 0.02, roughness: 0.9, bumpMap: stippleTexture(), bumpScale: 0.0007, envMapIntensity: 0.4 }),
    cut: std({ color: 0x101113, metalness: 0.4, roughness: 0.6 }),
    steel: std({ color: 0x55585e, metalness: 0.9, roughness: 0.32, envMapIntensity: 1.0 }),
    silver: std({ color: 0xa9adb3, metalness: 0.95, roughness: 0.28, envMapIntensity: 1.2 }),
    sight: std({ color: 0x141517, metalness: 0.5, roughness: 0.5 }),
    bore: new THREE.MeshBasicMaterial({ color: 0x040404 }),
    dot: new THREE.MeshBasicMaterial({ color: 0xf0f0f0 }),
  };
}

function buildSixtyNine(def, { env = null } = {}) {
  const M = f7Materials(env);
  const root = new THREE.Group();
  const u = root.userData;
  const { poly, z, y } = F7;
  u.sightY = F7_SIGHT;

  // --- slide: the tall flat-topped slide with its rounded rear
  const slide = new THREE.Group();
  // (the rear-sight photo: the upper slide is narrow with rounded top
  // edges, stepping out to a wider lower band over the frame)
  slide.add(extrudeX(poly([[291, 130], [297, 106], [309, 93], [322, 87], [990, 86], [1000, 90], [1006, 101], [1008, 120],
    [1007, 130]]), 0.0215, M.slide, { bevel: 0.0026 }));
  slide.add(extrudeX(poly([[283, 160], [284, 146], [289, 127], [1007, 127], [1006, 140], [1000, 152], [962, 157]]),
    0.0248, M.slide, { bevel: 0.0012 }));
  // rear serrations, slanted forward, on both bands and both sides
  for (let i = 0; i < 12; i++) {
    for (const s of [-1, 1]) {
      const hi = box(0.001, y(102) - y(127), 0.0013, M.cut);
      hi.position.set(s * 0.0106, (y(102) + y(127)) / 2, z(318 + i * 13));
      const lo = box(0.001, y(128) - y(151), 0.0013, M.cut);
      lo.position.set(s * 0.0123, (y(128) + y(151)) / 2, z(316 + i * 13));
      hi.rotation.x = lo.rotation.x = 0.12;
      slide.add(hi, lo);
    }
  }
  // the ejection port: open on the top right, the barrel hood showing in it
  const portLen = z(592) - z(728);
  const port = box(0.0104, y(88) - y(118), portLen, M.cut);
  port.position.set(0.0057, (y(88) + y(118)) / 2 + 0.0004, (z(592) + z(728)) / 2);
  const hood = box(0.009, 0.004, portLen * 0.85, M.steel);
  hood.position.set(0.003, y(96), port.position.z);
  slide.add(port, hood);
  // extractor and a cocking-indicator line on the flank
  const ext = box(0.0008, 0.0026, 0.012, M.cut);
  ext.position.set(0.0109, y(100), z(560));
  slide.add(ext);
  // irons ride the slide
  const sights = irons(M, {
    rearZ0: z(372), rearZ1: z(328), rearBaseY: y(87),
    frontZ0: z(970), frontZ1: z(946), frontBaseY: y(87),
    sightY: F7_SIGHT, rearW: 0.019,
  });
  slide.add(sights.rear, sights.front);
  root.add(slide);

  // --- barrel: the crown in the slide's nose, and a length inside that
  // shows when the slide runs back
  const muzzleZ = z(1008);
  const barrel = cylZ(0.0047, 0.07, M.steel, 18);
  barrel.position.set(0, 0, muzzleZ + 0.035 + 0.0006);
  const crown = new THREE.Mesh(new THREE.RingGeometry(0.003, 0.0049, 20), M.steel);
  crown.rotation.y = Math.PI;
  crown.position.set(0, 0, muzzleZ - 0.0004);
  const bore = new THREE.Mesh(new THREE.CircleGeometry(0.003, 16), M.bore);
  bore.rotation.y = Math.PI;
  bore.position.set(0, 0, muzzleZ - 0.0005);
  root.add(barrel, crown, bore);

  // --- frame: dust cover, the big rounded guard, the raked grip, all one
  // polymer profile with the guard hole cut through it
  root.add(extrudeX(poly([
    [286, 158], [1000, 158], [1004, 166], [998, 186], [990, 199], [790, 201], [770, 204], [764, 226], [752, 230], [741, 236],
    [737, 252], [735, 280], [728, 300], [718, 322], [704, 337], [690, 342], [556, 345], [546, 341], [530, 350],
    [512, 369], [500, 430], [492, 520], [488, 556], [484, 567], [300, 576], [287, 566], [284, 508], [296, 458],
    [308, 413], [320, 376], [332, 340], [346, 316], [350, 290], [348, 262], [332, 251], [320, 248], [308, 244],
    [296, 240], [284, 229], [276, 214], [279, 196],
  ]), 0.0275, M.frame, {
    bevel: 0.0014,
    holes: [poly([[560, 302], [567, 268], [579, 250], [597, 240], [704, 237], [714, 244], [720, 262], [716, 296],
      [706, 318], [690, 326], [575, 330], [562, 322]])],
  }));
  // stippled panels standing proud of the frame: the side panel and the
  // back strap, with the smooth sculpted web between them
  root.add(extrudeX(poly([[398, 332], [516, 330], [506, 432], [500, 536], [388, 538], [392, 430]]), 0.0298, M.grip, { bevel: 0.0008 }));
  root.add(extrudeX(poly([[340, 330], [356, 350], [334, 420], [316, 480], [304, 540], [290, 540], [290, 500], [300, 456],
    [312, 412], [324, 376]]), 0.0298, M.grip, { bevel: 0.0008 }));
  // the accessory rail under the dust cover
  const railLen = z(790) - z(952);
  const rail = railSection(railLen, 0.016, M.frame);
  rail.scale.y = 0.85;
  rail.rotation.z = Math.PI;
  rail.position.set(0, y(203), (z(790) + z(952)) / 2);
  root.add(rail);
  // trigger: a curved blade
  root.add(extrudeX(poly([[598, 238], [612, 238], [610, 268], [617, 298], [624, 316], [614, 320], [602, 302], [595, 270]]),
    0.006, M.frame, { bevel: 0.0005 }));
  // the silver takedown lever, the ambidextrous safety, the mag release
  const take = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.0012, 18, 1, false, 0, Math.PI), M.silver);
  take.rotation.set(0, 0, Math.PI / 2);
  take.position.set(0.0143, y(179), z(616));
  root.add(take);
  for (const s of [-1, 1]) {
    const saf = box(0.0018, 0.004, 0.011, M.frame);
    saf.position.set(s * 0.0145, y(194), z(672));
    root.add(saf);
  }
  for (const s of [-1, 1]) {
    // the ambidextrous mag release behind the guard
    const rel = box(0.0018, y(310) - y(335), z(495) - z(535), M.steel);
    rel.position.set(s * 0.0142, (y(310) + y(335)) / 2, (z(495) + z(535)) / 2);
    root.add(rel);
  }
  // the takedown lever's recess in the frame (right)
  const recess = box(0.0006, y(162) - y(204), z(560) - z(680), M.cut);
  recess.position.set(0.01385, (y(162) + y(204)) / 2, (z(560) + z(680)) / 2);
  root.add(recess);
  pins(root, M.steel, 0.0141, [[z(450), y(176)], [z(735), y(186)], [z(360), y(200)]], 0.0013);

  // --- the 20-round mag: body raked inside the grip, base plate below
  const RAKE = 0.26;
  const magBody = box(0.02, 0.098, 0.03, M.cut);
  magBody.rotation.x = -RAKE;
  magBody.position.set(0, y(420), z(398));
  const base = extrudeX(poly([[290, 562], [486, 556], [488, 568], [484, 579], [300, 584], [288, 576]]), 0.0285, M.frame, { bevel: 0.001 });
  const point = new THREE.Vector3(0, y(470), z(392));
  magGroup(root, point, [magBody, base]);

  gripAnchor(root, z(420), y(420));
  u.pistolAction = { slide, slideRestZ: slide.position.z, travel: 0.021 };
  u.inspectKeys = PISTOL_INSPECT_KEYS;
  mountAttachments(root, def, {
    irons: [sights.rear, sights.front], railTop: y(86), opticZ: z(560), muzzle: { z: muzzleZ, y: 0 }, barrelR: 0.0075,
    under: { z: rail.position.z, y: y(203) - 0.006 },
  });
  // a grip medallion where FN puts its logo
  root.add(decal(stampTexture("69", "rgba(150,152,158,0.8)"), -1, 0.0152, z(384), y(404), 0.016, 0.004));
  root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return root;
}

/* -------------------------------------------------------- TRUE-69 (KAP-40) */

/* Traced from a side-on render of Black Ops 2's KAP-40 (840 px wide):
   muzzle on the left at px 118, the upper's rear at 718, taken as 200 mm.
   Bore height px 107. The rear half of the upper (px 452 back) is the
   slide that cycles. */
const KP = mapper({ s: 0.2 / 600, x0: 588, y0: 107, z0: 0.045, dir: 1 });
const KP_SIGHT = KP.y(56);

function kapMaterials(env) {
  const std = (o) => new THREE.MeshStandardMaterial({ envMap: env, ...o });
  return {
    upper: std({ color: 0x585b4b, metalness: 0.4, roughness: 0.56, envMapIntensity: 0.85 }),
    inner: std({ color: 0x1e1f1c, metalness: 0.5, roughness: 0.55 }),
    grip: std({ color: 0x161616, metalness: 0.02, roughness: 0.88, bumpMap: checkerTexture(), bumpScale: 0.0009, envMapIntensity: 0.35 }),
    black: std({ color: 0x1a1b1c, metalness: 0.4, roughness: 0.55, envMapIntensity: 0.6 }),
    steel: std({ color: 0x8a8d92, metalness: 0.95, roughness: 0.3, envMapIntensity: 1.1 }),
    brass: std({ color: 0xc89a48, metalness: 0.95, roughness: 0.28, envMapIntensity: 1.1 }),
    sight: std({ color: 0x1a1b1c, metalness: 0.5, roughness: 0.5 }),
    bore: new THREE.MeshBasicMaterial({ color: 0x040404 }),
    dot: new THREE.MeshBasicMaterial({ color: 0xf0f0f0 }),
    red: new THREE.MeshBasicMaterial({ color: 0xd8262a }),
    glowSight: new THREE.MeshBasicMaterial({ color: 0x6dff4a }),
  };
}

function buildTrue69(def, { env = null } = {}) {
  const M = kapMaterials(env);
  const root = new THREE.Group();
  const u = root.userData;
  const { poly, z, y } = KP;
  u.sightY = KP_SIGHT;
  const W = 0.03;

  // --- the front block: the deep Super-V housing hanging under the barrel,
  // with the trigger guard cut through its back
  root.add(extrudeX(poly([
    [452, 72], [200, 72], [132, 73], [128, 78], [128, 262], [136, 279], [358, 280], [448, 272], [458, 262],
    [470, 251], [486, 240], [498, 239], [500, 188], [452, 188],
  ]), W, M.upper, {
    bevel: 0.002,
    holes: [poly([[370, 250], [368, 234], [377, 201], [391, 191], [432, 191], [441, 214], [452, 240], [446, 251]])],
  }));
  // the darker Super-V panel low on the front, and the rail under it
  for (const s of [-1, 1]) {
    // a side rail (3 and 9 o'clock) on the low front block
    const sideRail = railSection(z(214) - z(128), 0.014, M.black);
    sideRail.rotation.z = s * -Math.PI / 2;
    sideRail.scale.y = 0.5;
    sideRail.position.set(s * (W / 2 + 0.001), (y(205) + y(250)) / 2, (z(128) + z(214)) / 2);
    root.add(sideRail);
    // a long groove along the block and the seam above the guard
    const groove = box(0.0008, 0.0012, z(452) - z(160), M.inner);
    groove.position.set(s * (W / 2 + 0.0002), y(135), (z(160) + z(452)) / 2);
    const seam = box(0.0008, 0.001, z(350) - z(140), M.inner);
    seam.position.set(s * (W / 2 + 0.0002), y(195), (z(140) + z(350)) / 2);
    root.add(groove, seam);
  }
  const lowRail = railSection(z(350) - z(140), 0.018, M.black);
  lowRail.scale.y = 0.6;
  lowRail.rotation.z = Math.PI;
  lowRail.position.set(0, y(277), (z(140) + z(350)) / 2);
  root.add(lowRail);
  // the top rail along the block (the integrated rail sights)
  const topRail = railSection(z(440) - z(200), 0.016, M.black);
  topRail.scale.y = 0.35;
  topRail.position.set(0, y(72) + 0.0014, (z(200) + z(440)) / 2);
  root.add(topRail);
  pins(root, M.inner, W / 2 + 0.0002, [[z(150), y(160)], [z(263), y(160)], [z(310), y(186)], [z(305), y(218)], [z(420), y(162)]], 0.0017);
  // the name on the flank where BO2 printed "KAP 40"
  root.add(decal(stampTexture("TRUE-69"), -1, W / 2 + 0.0003, z(290), y(232), 0.026, 0.0065));
  root.add(decal(stampTexture("TRUE-69"), 1, W / 2 + 0.0003, z(290), y(232), 0.026, 0.0065));

  // --- barrel nub and bore in the flat front face
  const muzzleZ = z(118);
  const nub = cylZ(0.0062, z(128) - z(118) + 0.002, M.black, 18);
  nub.position.set(0, 0, (z(118) + z(128)) / 2);
  const bore = new THREE.Mesh(new THREE.CircleGeometry(0.0034, 16), M.bore);
  bore.rotation.y = Math.PI;
  bore.position.set(0, 0, muzzleZ - 0.0012);
  root.add(nub, bore);

  // --- the frame inside the slide's run (seen when it cycles back)
  root.add(extrudeX(poly([[440, 120], [700, 120], [700, 186], [440, 186]]), W - 0.004, M.inner, { bevel: 0 }));

  // --- the slide: the upper's rear half, with the port and its brass, the
  // rear sight and the charging knob
  const slide = new THREE.Group();
  slide.add(extrudeX(poly([[452, 72], [676, 72], [690, 88], [708, 96], [712, 170], [700, 182], [640, 190], [452, 190]]), W, M.upper, { bevel: 0.002 }));
  slide.add(extrudeX(poly([[706, 80], [719, 82], [719, 110], [708, 110]]), 0.008, M.black, { bevel: 0.0006 }));
  for (const s of [-1, 1]) {
    // ejection port (shown on both flanks; the render shows it on the left)
    const port = box(0.0016, y(83) - y(122), z(612) - z(522), M.inner);
    port.position.set(s * (W / 2 - 0.0002), (y(83) + y(122)) / 2, (z(522) + z(612)) / 2);
    const brass = cylZ(0.0052, (z(612) - z(522)) * 0.8, M.brass, 14);
    brass.position.set(s * (W / 2 - 0.0041), (y(83) + y(122)) / 2, port.position.z);
    // rear grip cuts behind the port
    for (let i = 0; i < 4; i++) {
      const c = box(0.0008, y(96) - y(170), 0.0016, M.inner);
      c.position.set(s * (W / 2 + 0.0002), (y(96) + y(170)) / 2, z(640 + i * 14));
      slide.add(c);
    }
    slide.add(port, brass);
  }
  const sights = irons(M, {
    rearZ0: z(672), rearZ1: z(692), rearBaseY: y(72),
    frontZ0: z(140), frontZ1: z(158), frontBaseY: y(72),
    sightY: KP_SIGHT, rearW: 0.019,
  });
  sights.front.children[0].material = M.glowSight;   // BO2's green fibre front post
  slide.add(sights.rear);
  root.add(sights.front, slide);

  // --- trigger, selector, the red fire indicator
  root.add(extrudeX(poly([[420, 198], [432, 198], [437, 230], [430, 236], [423, 222]]), 0.006, M.black, { bevel: 0.0005 }));
  for (const s of [-1, 1]) {
    const sel = box(0.0016, 0.0035, 0.012, M.steel);
    sel.position.set(s * (W / 2 + 0.0008), y(135), z(420));
    sel.rotation.x = -0.4;
    const sel2 = box(0.0016, 0.006, 0.004, M.steel);
    sel2.position.set(s * (W / 2 + 0.0008), y(167), z(525));
    const dotR = new THREE.Mesh(new THREE.CircleGeometry(0.0012, 10), M.red);
    dotR.rotation.y = s * Math.PI / 2;
    dotR.position.set(s * (W / 2 + 0.0003), y(155), z(585));
    root.add(sel, sel2, dotR);
  }

  // --- the grip: black checkered rubber, raked hard, a lip at the base
  root.add(extrudeX(poly([[458, 188], [638, 188], [640, 250], [648, 273], [658, 297], [668, 323], [678, 371], [690, 395],
    [566, 422], [558, 417], [548, 370], [538, 333], [528, 301], [518, 265], [508, 250], [498, 241], [486, 240],
    [470, 251], [458, 262]]), 0.031, M.grip, { bevel: 0.0014 }));
  root.add(extrudeX(poly([[560, 410], [690, 384], [696, 400], [566, 428]]), 0.0335, M.black, { bevel: 0.001 }));

  // --- the extended mag hanging out of the grip, a brass round in its window
  const magBody = extrudeX(poly([[560, 300], [650, 280], [700, 440], [708, 500], [618, 530], [600, 470]]), 0.024, M.black, { bevel: 0.001 });
  const win = box(0.0006, y(461) - y(480), z(689) - z(657), M.brass);
  win.position.set(-0.0122, (y(461) + y(480)) / 2, (z(657) + z(689)) / 2);
  const point = new THREE.Vector3(0, y(470), z(640));
  magGroup(root, point, [magBody, win]);

  gripAnchor(root, z(600), y(320));
  u.pistolAction = { slide, slideRestZ: slide.position.z, travel: 0.015 };
  u.inspectKeys = PISTOL_INSPECT_KEYS;
  mountAttachments(root, def, {
    irons: [sights.rear, sights.front], railTop: topRail.position.y + 0.0107 * 0.35, opticZ: z(330),
    muzzle: { z: muzzleZ, y: 0 }, barrelR: 0.0085, under: { z: lowRail.position.z, y: y(277) - 0.004 },
  });
  root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return root;
}

/* ------------------------------------------------------------------ export */

export const PISTOL_BUILDERS = { sixtynine: buildSixtyNine, true69: buildTrue69 };

/* Showcase admire for the pistols: [t, yaw°, twist°, tilt°, x, y, dz], as
   weapon-view.js GUN_INSPECT_KEYS. Up side-on (left flank), a press-check
   while it's there, a turn to the right flank, home. */
export const PISTOL_INSPECT_KEYS = [
  [0.00,  50,  24, -8,  0.08, -0.12, 0.06],
  [0.16,  82,  12,  6,  0.00, -0.03, 0],
  [0.34,  78,   6, 10, -0.01, -0.024, 0],
  [0.48,  84,  14,  4,  0.004, -0.03, 0],
  [0.58,  20, -26, -2,  0.00, -0.012, 0.05],
  [0.68, -82, -12,  6,  0.00, -0.03, 0],
  [0.84, -78,  -6,  9,  0.01, -0.024, 0],
  [1.00, -44, -22, -8,  0.09, -0.13, 0.06],
];
