// Troll Forces — the Peacemakers: a pair of engraved single-action
// revolvers, one per hand (weapons.js `peacemakers`).
//
// Each gun is nickel-plated and scroll-engraved, with an octagonal barrel,
// ivory grips scrimshawed with the trollface, and a cylinder that swings
// out on a crane so the reload can dump the brass and take a speedloader.
// Built in real-world metres (a 7.5" barrel), then scaled up a touch to
// read at view-model distance.
//
// The pair is one root (weapon-model.js routes `akimbo` defs here) so the
// view model, the menu preview and the third-person body all handle it as
// one gun. Per side the hierarchy is:
//
//   side  (S)  where the hand is: the reload moves the whole hand+gun
//    ├─ hand anchor   the glove / PF rod targets it; it stays put while
//    │                the gun twirls round the trigger finger
//    └─ pivot (P) at the trigger: twirls, flips, recoil
//        └─ gun (G)  the model (mirrored on the left)
//            └─ crane → cylinder → rounds → speedloader
//
// game.js (updateAkimbo) animates all of it through root.userData.sides.

import * as THREE from "three";

const SC = 1.08;                                        // model scale
const TRIGGER = new THREE.Vector3(0, -0.032, 0.014);    // twirl pivot, model units
const GRIP = new THREE.Vector3(0, -0.062, 0.056);       // palm centre on the grip
const GRIP_RAKE = 0.42;
const SIDE_X = 0.16;
export const CYL = { r: 0.0205, len: 0.044, cz: 0.0, pivot: new THREE.Vector3(-0.0115, -0.0205, 0) };
export const MUZZLE_Z = -0.207;

/* ---------------------------------------------------------------- textures */

const TEX = {};
const tex = (k, make) => TEX[k] ??= make();

function canvasTex(w, h, draw, repeat = false) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/* Scrollwork engraving: leafy spirals cut dark into bright nickel. Used as
   the colour map (the cuts darken) and the bump map (the cuts sink). */
function engravingTexture() {
  return tex("engrave", () => canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = "#e6e6ea";
    g.fillRect(0, 0, W, H);
    let s = 7;
    const R = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    g.strokeStyle = "rgba(40,40,48,.85)";
    g.lineCap = "round";
    const scroll = (cx, cy, r, turns, dir) => {
      g.lineWidth = 2.2;
      g.beginPath();
      for (let a = 0; a <= turns * Math.PI * 2; a += 0.12) {
        const rr = r * (1 - a / (turns * Math.PI * 2.2));
        const x = cx + Math.cos(a * dir) * rr, y = cy + Math.sin(a * dir) * rr;
        if (a === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
      // leaves off the spiral
      g.lineWidth = 1.4;
      for (let k = 0; k < 5; k++) {
        const a = R() * Math.PI * 2, d = r * (0.5 + R() * 0.5);
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
        g.beginPath();
        g.ellipse(x, y, 3 + R() * 4, 1.2 + R() * 1.4, a + 0.8, 0, Math.PI * 2);
        g.stroke();
      }
    };
    for (const [x, y, r, d] of [[64, 64, 46, 1], [192, 64, 40, -1], [64, 192, 40, -1], [192, 192, 46, 1], [128, 128, 26, 1], [0, 128, 26, -1], [256, 128, 26, -1], [128, 0, 26, 1], [128, 256, 26, 1]]) scroll(x, y, r, 1.6, d);
    // fine stippled background between the scrolls
    g.fillStyle = "rgba(60,60,70,.35)";
    for (let i = 0; i < 900; i++) g.fillRect(R() * W, R() * H, 1, 1);
  }, true));
}

/* Plain ivory grain for the grip panels. */
function ivoryTexture() {
  return tex("ivory", () => canvasTex(128, 128, (g, W, H) => {
    g.fillStyle = "#efe4c8";
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 30; i++) {
      g.strokeStyle = `rgba(${150 + (i % 4) * 10},${120 + (i % 3) * 8},80,${0.08 + (i % 5) * 0.025})`;
      g.lineWidth = 0.6 + (i % 3) * 0.5;
      g.beginPath();
      g.moveTo(0, i * 4.3);
      g.bezierCurveTo(W * 0.3, i * 4.3 + 3, W * 0.7, i * 4.3 - 3, W, i * 4.3 + 1);
      g.stroke();
    }
  }, true));
}

/* World-ish UVs for the plated parts: each face samples along its own two
   axes in the gun's frame, `tile` metres per repeat, so the engraving is
   the same fine scale on a small screw head as on the barrel. */
const _pa = new THREE.Vector3(), _pb = new THREE.Vector3(), _pc = new THREE.Vector3(), _pn = new THREE.Vector3();
function projectUVs(mesh, tile) {
  let g = mesh.geometry;
  if (g.index) { const ni = g.toNonIndexed(); g.dispose(); g = mesh.geometry = ni; }
  mesh.updateMatrix();
  const pos = g.attributes.position, uv = g.attributes.uv;
  if (!uv) return;
  const pts = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (let i = 0; i + 2 < pos.count; i += 3) {
    for (let k = 0; k < 3; k++) pts[k].fromBufferAttribute(pos, i + k).applyMatrix4(mesh.matrix);
    _pa.subVectors(pts[1], pts[0]);
    _pb.subVectors(pts[2], pts[0]);
    _pn.crossVectors(_pa, _pb);
    const ax = Math.abs(_pn.x), ay = Math.abs(_pn.y), az = Math.abs(_pn.z);
    for (let k = 0; k < 3; k++) {
      const p = pts[k];
      let u, v;
      if (ax >= ay && ax >= az) { u = p.z; v = p.y; }
      else if (ay >= az) { u = p.x; v = p.z; }
      else { u = p.x; v = p.y; }
      uv.setXY(i + k, u / tile, v / tile);
    }
  }
  uv.needsUpdate = true;
}

/* Ivory with grain and the trollface scrimshawed in black ink. */
const TROLL_URL = new URL("../../images/wallpaper/trollface%20transparent.png", import.meta.url).href;
function scrimshawTexture() {
  return tex("scrim", () => {
    const draw = (g, W, H, img) => {
      const grd = g.createLinearGradient(0, 0, W, H);
      grd.addColorStop(0, "#f4ecd8");
      grd.addColorStop(1, "#e2d4b4");
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
      g.strokeStyle = "rgba(170,140,90,.18)";
      for (let i = 0; i < 26; i++) {
        g.lineWidth = 1 + (i % 3);
        g.beginPath();
        g.moveTo(0, i * 10);
        g.bezierCurveTo(W * 0.3, i * 10 + 8, W * 0.6, i * 10 - 6, W, i * 10 + 4);
        g.stroke();
      }
      if (!img) return;
      // the ink only: everything white in the art drops out
      const s = Math.min(W / img.width, H / img.height) * 0.86;
      const dw = img.width * s, dh = img.height * s;
      g.save();
      g.globalCompositeOperation = "multiply";
      g.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      g.restore();
    };
    const t = canvasTex(256, 256, (g, W, H) => draw(g, W, H, null));
    const img = new Image();
    img.onload = () => {
      draw(t.image.getContext("2d"), 256, 256, img);
      t.needsUpdate = true;
    };
    img.src = TROLL_URL;
    return t;
  });
}

/* --------------------------------------------------------------- materials */

function materials(env) {
  const engrave = engravingTexture();
  const nickel = new THREE.MeshStandardMaterial({
    color: 0xa6abb4, map: engrave, bumpMap: engrave, bumpScale: 0.0006,
    roughness: 0.2, metalness: 1.0, envMap: env, envMapIntensity: 1.7,
  });
  nickel.userData.tile = 0.032;
  return {
    nickel,
    nickelFine: nickel,
    blued: new THREE.MeshStandardMaterial({ color: 0x1e2430, roughness: 0.28, metalness: 0.9, envMap: env, envMapIntensity: 0.9 }),
    ivory: Object.assign(new THREE.MeshStandardMaterial({ map: ivoryTexture(), color: 0xf0e2c0, roughness: 0.38, metalness: 0.0, envMap: env, envMapIntensity: 0.45 }), { userData: { tile: 0.06 } }),
    scrim: new THREE.MeshStandardMaterial({ map: scrimshawTexture(), roughness: 0.4, metalness: 0.02, envMap: env, envMapIntensity: 0.3 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xd8a848, roughness: 0.25, metalness: 0.92, envMap: env, envMapIntensity: 1.1 }),
    lead: new THREE.MeshStandardMaterial({ color: 0x8a8c92, roughness: 0.55, metalness: 0.5, envMap: env, envMapIntensity: 0.6 }),
    bore: new THREE.MeshBasicMaterial({ color: 0x060606 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xe8b848, roughness: 0.22, metalness: 0.95, envMap: env, envMapIntensity: 1.2 }),
    loader: new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.5, metalness: 0.4, envMap: env, envMapIntensity: 0.5 }),
  };
}

/* ------------------------------------------------------------------ shapes */

const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
function cylZ(r0, r1, len, mat, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, seg), mat);
  m.rotation.x = -Math.PI / 2;   // its +Y runs down -Z: r0 at the back, r1 at the front
  return m;
}

/* The plow-handle grip as a side profile (z, y), extruded across x. */
function gripShape(inset = 0) {
  const s = new THREE.Shape();
  const k = 1 - inset;
  const c = new THREE.Vector2(0.055, -0.062);
  const P = (z, y) => [c.x + (z - c.x) * k, c.y + (y - c.y) * k];
  s.moveTo(...P(0.024, -0.024));
  s.bezierCurveTo(...P(0.026, -0.05), ...P(0.03, -0.075), ...P(0.046, -0.1));
  s.quadraticCurveTo(...P(0.052, -0.109), ...P(0.062, -0.11));
  s.lineTo(...P(0.086, -0.106));
  s.quadraticCurveTo(...P(0.092, -0.1), ...P(0.088, -0.09));
  s.bezierCurveTo(...P(0.078, -0.064), ...P(0.07, -0.04), ...P(0.058, -0.022));
  s.quadraticCurveTo(...P(0.05, -0.012), ...P(0.04, -0.016));
  s.lineTo(...P(0.024, -0.024));
  return s;
}

function extrudeX(shape, width, mat) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0012, bevelSegments: 2, curveSegments: 14 });
  g.translate(0, 0, -width / 2);
  g.rotateY(-Math.PI / 2);   // shape x -> gun z, shape y -> gun y, depth -> across x
  return new THREE.Mesh(g, mat);
}

/* One round: brass case, rim, a lead bullet. Its back (the rim) at z=0,
   the bullet forward (-z). */
function round(M) {
  const g = new THREE.Group();
  const caseM = cylZ(0.0046, 0.0046, 0.03, M.brass, 10);
  caseM.position.z = -0.015;
  const rim = cylZ(0.0056, 0.0056, 0.0018, M.brass, 12);
  rim.position.z = -0.0009;
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.0044, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.lead);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -0.03;
  const prim = cylZ(0.0016, 0.0016, 0.0004, M.lead, 8);
  prim.position.z = 0.0002;
  g.add(caseM, rim, nose, prim);
  return g;
}

/* --------------------------------------------------------------- one gun */

function buildGun(M) {
  const gun = new THREE.Group();

  // frame: the window round the cylinder, the recoil shield behind it
  const strap = box(0.02, 0.008, 0.07, M.nickel);
  strap.position.set(0, 0.024, -0.002);
  const lower = box(0.026, 0.014, 0.06, M.nickel);
  lower.position.set(0, -0.029, 0.004);
  const front = box(0.026, 0.05, 0.012, M.nickel);
  front.position.set(0, -0.003, -0.033);
  const shield = box(0.03, 0.058, 0.014, M.nickel);
  shield.position.set(0, -0.004, 0.032);
  const rear = box(0.026, 0.03, 0.024, M.nickel);
  rear.position.set(0, -0.006, 0.048);
  gun.add(strap, lower, front, shield, rear);
  // rear sight groove on the top strap, the frame screws in gold
  const notch = box(0.004, 0.0025, 0.012, M.bore);
  notch.position.set(0, 0.0285, 0.022);
  gun.add(notch);
  for (const [y, z] of [[-0.02, 0.046], [-0.002, 0.052], [-0.025, -0.02]]) {
    for (const x of [-1, 1]) {
      const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.0008, 8), M.gold);
      sc.rotation.z = Math.PI / 2;
      sc.position.set(x * 0.0132, y, z);
      gun.add(sc);
    }
  }

  // barrel: octagonal, blued at the crown, front blade sight, the bore
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.0108, 0.165, 8), M.nickelFine);
  barrel.rotation.x = -Math.PI / 2;
  barrel.rotation.y = Math.PI / 8;
  barrel.position.set(0, 0.002, -0.039 - 0.0825);
  gun.add(barrel);
  const crown = cylZ(0.0108, 0.0108, 0.004, M.blued, 8);
  crown.rotation.y = Math.PI / 8;
  crown.position.set(0, 0.002, MUZZLE_Z + 0.002);
  const bore = cylZ(0.0052, 0.0052, 0.0006, M.bore, 12);
  bore.position.set(0, 0.002, MUZZLE_Z - 0.0003);
  const blade = box(0.0025, 0.009, 0.012, M.nickel);
  blade.position.set(0, 0.016, MUZZLE_Z + 0.01);
  gun.add(crown, bore, blade);
  // the ejector rod's shroud under the barrel
  const shroud = cylZ(0.0058, 0.0058, 0.09, M.nickel, 12);
  shroud.position.set(0, -0.0135, -0.095);
  const shroudCap = cylZ(0.0058, 0.0058, 0.006, M.blued, 12);
  shroudCap.position.set(0, -0.0135, -0.142);
  gun.add(shroud, shroudCap);

  // grip: the nickel straps all round, ivory panels inset, the medallion
  const strapG = extrudeX(gripShape(0), 0.026, M.nickel);
  const panels = extrudeX(gripShape(0.14), 0.03, M.ivory);
  gun.add(strapG, panels);
  for (const x of [-1, 1]) {
    const med = new THREE.Mesh(new THREE.CircleGeometry(0.0165, 28), M.scrim);
    med.position.set(x * 0.0168, -0.064, 0.058);
    med.position.x = x * 0.0174;
    med.rotation.set(0, x * Math.PI / 2, 0);
    med.rotateX(x * 0.0);
    // tilt the face with the grip's rake, upright when the gun is level
    med.rotateZ(x * -0.38);
    gun.add(med);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0168, 0.0011, 6, 28), M.gold);
    ring.position.copy(med.position);
    ring.rotation.copy(med.rotation);
    gun.add(ring);
  }
  const butt = box(0.027, 0.003, 0.03, M.nickel);
  butt.position.set(0, -0.108, 0.074);
  butt.rotation.x = 0.16;
  gun.add(butt);
  const lanyard = new THREE.Mesh(new THREE.TorusGeometry(0.004, 0.0009, 6, 12), M.nickel);
  lanyard.position.set(0, -0.112, 0.08);
  lanyard.rotation.y = Math.PI / 2;
  gun.add(lanyard);

  // trigger guard and trigger
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.0125, 0.0022, 6, 18, Math.PI * 1.15), M.nickel);
  guard.rotation.set(0, Math.PI / 2, Math.PI * 0.95);
  guard.position.set(0, -0.034, 0.012);
  const trigger = box(0.004, 0.017, 0.0045, M.blued);
  trigger.position.set(0, -0.039, 0.014);
  trigger.rotation.x = 0.35;
  gun.add(guard, trigger);

  // hammer, pivoting back into cock
  const hammer = new THREE.Group();
  hammer.position.set(0, 0.006, 0.043);
  const hBody = box(0.0075, 0.026, 0.01, M.blued);
  hBody.position.set(0, 0.012, 0.002);
  const spur = box(0.011, 0.005, 0.016, M.blued);
  spur.position.set(0, 0.025, 0.009);
  spur.rotation.x = -0.35;
  for (let i = 0; i < 3; i++) {
    const r = box(0.0115, 0.0012, 0.002, M.bore);
    r.position.set(0, 0.0278, 0.004 + i * 0.004);
    r.rotation.x = -0.35;
    hammer.add(r);
  }
  hammer.add(hBody, spur);
  gun.add(hammer);

  // cylinder on its crane, the rounds in it, a speedloader behind them
  const crane = new THREE.Group();
  crane.position.copy(CYL.pivot);
  gun.add(crane);
  const arm = box(0.0065, 0.006, 0.006, M.nickel);
  arm.position.set(0.0055, 0.004, -CYL.len / 2 - 0.004);
  arm.rotation.z = 0.9;
  crane.add(arm);
  const cyl = new THREE.Group();
  cyl.position.set(-CYL.pivot.x, -CYL.pivot.y - 0.002, CYL.cz);
  crane.add(cyl);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(CYL.r, CYL.r, CYL.len, 30), M.nickelFine);
  drum.rotation.x = -Math.PI / 2;
  cyl.add(drum);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    // a flute between each pair of chambers
    const fl = box(0.0055, 0.0032, CYL.len * 0.62, M.blued);
    fl.position.set(Math.cos(a + Math.PI / 6) * (CYL.r - 0.001), Math.sin(a + Math.PI / 6) * (CYL.r - 0.001), -0.004);
    fl.rotation.z = a + Math.PI / 6 + Math.PI / 2;
    cyl.add(fl);
    // the chamber mouths in the front face
    const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.0052, 12), M.bore);
    mouth.position.set(Math.cos(a) * 0.0122, Math.sin(a) * 0.0122, -CYL.len / 2 - 0.0002);
    mouth.rotation.y = Math.PI;
    cyl.add(mouth);
  }
  const axle = cylZ(0.004, 0.004, CYL.len + 0.01, M.blued, 10);
  cyl.add(axle);
  const rounds = new THREE.Group();
  cyl.add(rounds);
  const roundList = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    const r = round(M);
    r.position.set(Math.cos(a) * 0.0122, Math.sin(a) * 0.0122, CYL.len / 2 + 0.0008);
    rounds.add(r);
    roundList.push(r);
  }
  // the speedloader: a black knurled body holding the six by their rims
  const loader = new THREE.Group();
  loader.visible = false;
  const lBody = cylZ(0.0185, 0.0185, 0.011, M.loader, 18);
  lBody.position.z = 0.0075;
  const knob = cylZ(0.006, 0.0075, 0.012, M.loader, 12);
  knob.position.z = 0.019;
  loader.add(lBody, knob);
  rounds.add(loader);

  gun.userData = { crane, cyl, rounds, roundList, loader, hammer };
  gun.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = false;
    const tile = o.material.userData?.tile;
    if (tile) projectUVs(o, tile);
  });
  return gun;
}

/* --------------------------------------------------------------- the pair */

export function buildRevolverPair(def, { env = null } = {}) {
  const M = materials(env);
  const root = new THREE.Group();
  const sides = [];
  for (const s of [1, -1]) {
    const side = new THREE.Group();
    side.position.set(s * SIDE_X, 0, 0);
    side.rotation.set(0, s * 0.03, -s * 0.12);   // toed in a touch, canted out so the inside shows
    root.add(side);
    const pivot = new THREE.Group();
    pivot.position.copy(TRIGGER).multiplyScalar(SC);
    side.add(pivot);
    const gun = buildGun(M);
    gun.scale.set(s * SC, SC, SC);       // the left gun is the right one mirrored
    gun.position.copy(TRIGGER).multiplyScalar(-SC);
    pivot.add(gun);
    // the hand: on the grip at rest, but it belongs to the side, so it
    // stays in place while the gun spins round the trigger finger
    const anchor = new THREE.Object3D();
    anchor.position.copy(GRIP).multiplyScalar(SC);
    anchor.rotation.x = GRIP_RAKE;
    anchor.userData.hand = true;
    side.add(anchor);
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.002, MUZZLE_Z - 0.004);
    gun.add(muzzle);
    sides.push({ s, side, pivot, gun, anchor, muzzle, restPos: side.position.clone(), restRot: side.rotation.clone(), ...gun.userData });
  }
  root.updateMatrixWorld(true);
  const inRoot = (o) => root.worldToLocal(o.getWorldPosition(new THREE.Vector3()));
  const u = root.userData;
  u.akimbo = true;
  u.pistol = true;
  u.sides = sides;
  u.akimboHands = sides.map((sd) => sd.anchor);
  u.pfAnchors = [sides[0].anchor, null];
  u.gripPos = inRoot(sides[0].anchor);
  u.gripPosL = inRoot(sides[1].anchor);
  u.muzzleZ = inRoot(sides[0].muzzle).z;
  u.aimPoint = new THREE.Vector3(0, 0.02, -0.2);
  u.sight = null;
  // the hip pose centres the pair instead of holding one gun off to the right
  u.hipOffset = new THREE.Vector3(-0.22, 0.062, -0.05);
  u.hipYaw = -0.05;
  return root;
}
