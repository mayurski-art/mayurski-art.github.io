// Troll Forces — guns built from a traced side outline (weapon-snipers.js,
// weapon-smgs.js hold the specs; this builds them).
//
// The body is the gun's side outline traced off a side-on reference image
// (the pixel outline, simplified, with its holes: trigger guards, skeleton
// stocks, handguard slots), mapped to metres and extruded across x.
// Furniture in another colour is its own traced piece laid over the body.
// Barrels and brakes are cylinders at the measured spans; the mag is cut
// out of the body and is its own node so the reload can pull it; bolt guns
// get a bolt handle node the view model works (view/rifle-action.js); iron
// sight posts are their own pieces and fold away under an optic. Optics,
// muzzle devices and underbarrels come from attachment-models.js.
//
// A spec: lengthM over pxLen, dir (-1 muzzle right, 1 muzzle left in the
// image), boreY, gripAt, body {w, color, outer, holes}, over [...], mag,
// barrel, muzzle, rail or railTop, opticX, hand, and optionally slots,
// blocks, bands, bolt, iron {y, rearX, adsDistance} and ironParts.

import * as THREE from "three";
import { buildGripHand, buildSupportHand } from "./hand-model.js";
import { OPTIC_BUILDERS, BARREL_BUILDERS, UNDER_BUILDERS, railSection } from "./attachment-models.js?v=fg1-wst";

const parse = (s) => s.trim().split(/\s+/).map((p) => p.split(",").map(Number));

/* ------------------------------------------------------------------ helpers */

const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
function cylZ(r, len, mat, seg = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  m.rotation.x = Math.PI / 2;
  return m;
}

/* A profile [z, y] extruded `width` across x, centred. */
function extrudeX(pts, width, mat, holes = [], bevel = 0.0012) {
  const s = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b)));
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([a, b]) => new THREE.Vector2(a, b))));
  const g = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.0002, width - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.85, bevelSegments: 2, curveSegments: 4,
  });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.rotateY(-Math.PI / 2);
  return new THREE.Mesh(g, mat);
}

/* Holes smaller than a few pixels across are lettering, not openings. */
function realHole(h) {
  const xs = h.map((p) => p[0]), ys = h.map((p) => p[1]);
  return Math.max(...xs) - Math.min(...xs) >= 4 && Math.max(...ys) - Math.min(...ys) >= 4;
}

/* ------------------------------------------------------------------- build */

export function buildTraced(def, spec, env, { fallbackOptic = null } = {}) {
  const s = spec.lengthM / (spec.pxLen[1] - spec.pxLen[0]);
  const [gx, gy] = spec.gripAt;
  // the grip lands at z +0.02 (where the rifles' trigger hands sit), the
  // bore on y 0
  const Z = (px) => 0.02 + spec.dir * (px - gx) * s;
  const Y = (py) => -(py - spec.boreY) * s;
  const P = (pts) => pts.map(([px, py]) => [Z(px), Y(py)]);
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, envMap: env, metalness: 0.12, roughness: 0.64, envMapIntensity: 0.5, ...o });
  const over = (color) => std(color, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const steel = std(0x3a3c40, { metalness: 0.85, roughness: 0.35, envMapIntensity: 1.0 });
  const dark = std(0x141516, { metalness: 0.5, roughness: 0.6 });
  const bore = new THREE.MeshBasicMaterial({ color: 0x050505 });

  const root = new THREE.Group();
  const u = root.userData;

  // --- body and furniture
  const holes = spec.body.holes.map(parse).filter(realHole).map(P);
  root.add(extrudeX(P(parse(spec.body.outer)), spec.body.w, std(spec.body.color), holes));
  for (const o of spec.over) root.add(extrudeX(P(parse(o.poly)), o.w, over(o.color), o.hole ? [P(parse(o.hole))] : [], 0.001));
  for (const [x0, x1] of spec.slots || []) {
    for (const side of [-1, 1]) {
      const slot = box(0.001, Math.abs(Y(spec.slotY[0]) - Y(spec.slotY[1])) + 0.002, Math.abs(Z(x1) - Z(x0)), dark);
      slot.position.set(side * (spec.body.w / 2 + 0.0002), (Y(spec.slotY[0]) + Y(spec.slotY[1])) / 2, (Z(x0) + Z(x1)) / 2);
      root.add(slot);
    }
  }
  for (const b of spec.blocks || []) {
    const [x0, y0, x1, y1] = b.box;
    const blk = box(b.w, Math.abs(Y(y0) - Y(y1)), Math.abs(Z(x1) - Z(x0)), std(spec.body.color));
    blk.position.set(0, (Y(y0) + Y(y1)) / 2, (Z(x0) + Z(x1)) / 2);
    root.add(blk);
  }
  // the iron sights, their own pieces so glass can fold them: a slim front
  // post, and a rear notch (two ears over a lower base) to line it up in
  const irons = (spec.ironParts || []).map(([x0, y0, x1, y1]) => {
    const h = Math.abs(Y(y0) - Y(y1)), d = Math.abs(Z(x1) - Z(x0));
    const g = new THREE.Group();
    g.position.set(0, (Y(y0) + Y(y1)) / 2, (Z(x0) + Z(x1)) / 2);
    const rear = spec.iron && Math.abs((x0 + x1) / 2 - spec.iron.rearX) < Math.abs(x1 - x0);
    if (rear) {
      const base = box(0.016, h - 0.004, d, dark);
      base.position.y = -0.002;
      g.add(base);
      for (const side of [-1, 1]) {
        const ear = box(0.0045, h, d, dark);
        ear.position.x = side * 0.0055;
        g.add(ear);
      }
    } else {
      g.add(box(0.0035, h, Math.min(d, 0.008), dark));
      const guard = box(0.012, h * 0.45, d, dark);
      guard.position.y = -h * 0.275;
      g.add(guard);
    }
    g.userData.ironSight = rear ? "rear" : "front";
    root.add(g);
    return g;
  });
  for (const [x0, x1, color] of spec.bands || []) {
    const band = cylZ(spec.barrel.r * s * 2.6, Math.abs(Z(x1) - Z(x0)), std(color), 18);
    band.position.set(0, 0, (Z(x0) + Z(x1)) / 2);
    root.add(band);
  }

  // --- barrel, brake (ported) and bore
  const bLen = Math.abs(Z(spec.barrel.x[1]) - Z(spec.barrel.x[0]));
  const barrel = cylZ(spec.barrel.r * s, bLen, steel, 18);
  barrel.position.set(0, 0, (Z(spec.barrel.x[0]) + Z(spec.barrel.x[1])) / 2);
  root.add(barrel);
  const muzzleFrontPx = spec.dir < 0 ? Math.max(...spec.muzzle.x) : Math.min(...spec.muzzle.x);
  const mLen = Math.abs(Z(spec.muzzle.x[1]) - Z(spec.muzzle.x[0]));
  const mR = spec.muzzle.r * s;
  const brake = new THREE.Group();
  brake.add(cylZ(mR, mLen, dark, 22));
  for (let i = 0; i < spec.muzzle.ports; i++) {
    for (const side of [-1, 1]) {
      const port = box(mR * 0.5, mR * 1.1, mLen / (spec.muzzle.ports * 2.2), bore);
      port.position.set(side * mR * 0.78, 0, -mLen / 2 + (i + 0.6) * mLen / (spec.muzzle.ports + 0.3));
      brake.add(port);
    }
  }
  const crown = new THREE.Mesh(new THREE.CircleGeometry(Math.min(mR * 0.45, 0.008), 16), bore);
  crown.rotation.y = Math.PI;
  crown.position.z = -mLen / 2 - 0.0005;
  brake.add(crown);
  brake.position.set(0, 0, (Z(spec.muzzle.x[0]) + Z(spec.muzzle.x[1])) / 2);
  root.add(brake);
  const muzzleZ = Z(muzzleFrontPx);

  // --- the mag: its own node, pulled by the reload
  const magMesh = extrudeX(P(parse(spec.mag.poly)), spec.mag.w, std(spec.mag.color), [], 0.001);
  magMesh.geometry.computeBoundingBox();
  const mb = magMesh.geometry.boundingBox;
  const point = new THREE.Vector3(0, (mb.min.y + mb.max.y) / 2, (mb.min.z + mb.max.z) / 2);
  const mag = new THREE.Group();
  mag.position.copy(point);
  magMesh.position.sub(point);
  mag.add(magMesh);
  root.add(mag);
  u.magMesh = mag;
  u.magazinePoint = point.clone();
  u.magRestRotationX = 0;

  // --- a bolt handle on the right, turned up and drawn back by the view
  if (spec.bolt) {
    const bolt = new THREE.Group();
    bolt.position.set(0, 0, Z(spec.bolt.x));
    const stem = box(0.026, 0.006, 0.008, steel);
    stem.position.set(spec.body.w / 2 + 0.008, Y(spec.bolt.y), 0);
    stem.rotation.z = -0.5;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 14, 10), dark);
    knob.position.set(spec.body.w / 2 + 0.02, Y(spec.bolt.y) - 0.008, 0.004);
    bolt.add(stem, knob);
    root.add(bolt);
    u.boltAction = { bolt, restZ: bolt.position.z, travel: 0.07 };
  }

  // --- rail (where the trace has none) and the hands
  let railTopY;
  if (spec.rail) {
    const len = Math.abs(Z(spec.rail.x[1]) - Z(spec.rail.x[0]));
    const rail = railSection(len, 0.022, dark);
    rail.position.set(0, Y(spec.rail.top) + 0.004, (Z(spec.rail.x[0]) + Z(spec.rail.x[1])) / 2);
    root.add(rail);
    railTopY = Y(spec.rail.top) + 0.004 + 0.0107;
  } else {
    railTopY = Y(spec.railTop);
  }
  const hand = buildGripHand(1);
  hand.userData.hand = true;
  hand.position.set(0, Y(gy), Z(gx));
  hand.rotation.x = 0.32;
  root.add(hand);
  u.gripPos = hand.position.clone();
  const hgTop = Y(spec.hand.top), hgBottom = Y(spec.hand.bottom);
  const supportHandPos = new THREE.Vector3(0, hgTop + 0.028, Z(spec.hand.x));
  const support = buildSupportHand(1.5);
  support.userData.hand = true;
  support.position.copy(supportHandPos);
  root.add(support);
  u.supportHandPos = supportHandPos;
  u.pfSupportDrop = supportHandPos.y - (hgBottom - 0.004);

  // --- optic on the rail, device on the crown, laser/grip under the handguard
  // (a gun that must wear glass passes fallbackOptic for iron sights or a
  // key with no model)
  const opticKey = OPTIC_BUILDERS[def.attachments?.optic] ? def.attachments.optic : fallbackOptic;
  const opticBuild = OPTIC_BUILDERS[opticKey];
  const sight = new THREE.Group();
  let aimY = railTopY + 0.03, aimZ = Z(spec.opticX), optic = null;
  if (opticBuild) {
    optic = opticBuild();
    sight.add(optic);
    aimY = railTopY - 0.0107 + 0.004 + (optic.userData.aimOffsetY ?? 0.05);
    sight.position.set(0, aimY, aimZ);
  } else if (spec.iron) {
    // iron sights: the line across the tops of the traced rear and front posts
    aimY = Y(spec.iron.y);
    aimZ = Z(spec.iron.rearX);
  }
  // flip-up irons fold away under glass
  for (const p of irons) p.visible = !optic;
  root.add(sight);
  u.sight = sight;
  u.aimPoint = new THREE.Vector3(0, aimY, aimZ);
  u.adsDistance = optic?.userData.adsDistance ?? spec.iron?.adsDistance ?? null;
  u.adsWeaponFov = optic?.userData.adsWeaponFov ?? null;
  u.scopeKey = opticKey;

  u.muzzleZ = muzzleZ;
  const devBuild = BARREL_BUILDERS[def.attachments?.barrel];
  if (devBuild) {
    brake.visible = false;
    const back = Z(spec.dir < 0 ? Math.min(...spec.muzzle.x) : Math.max(...spec.muzzle.x));
    const dev = devBuild(spec.barrel.r * s * 1.4);
    const devLen = dev.userData.lengthZ ?? 0.05;
    dev.position.set(0, 0, back - devLen / 2);
    root.add(dev);
    u.muzzleZ = back - devLen;
  }
  const ub = def.attachments?.underbarrel;
  const ubBuild = UNDER_BUILDERS[ub];
  if (ubBuild) {
    const unit = ubBuild();
    unit.position.set(0, ub === "laser" ? hgBottom - 0.009 : hgBottom, Z(spec.hand.x) - 0.04);
    root.add(unit);
    if (ub === "laser") {
      const origin = unit.position.clone().add(unit.userData.emitter || new THREE.Vector3());
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 1, 6),
        new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.85, depthWrite: false }));
      beam.rotation.x = Math.PI / 2;
      beam.position.copy(origin);
      beam.visible = false;
      root.add(beam);
      u.laserBeam = beam;
      u.laserOrigin = origin.clone();
    }
  }
  root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return root;
}
