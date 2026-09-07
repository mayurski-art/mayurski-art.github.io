// Troll Ops — procedural weapon view models.
//
// One builder reads each weapon's `model` spec instead of the old hardcoded
// if-chain, so a bullpup PDW, a drum-fed LMG and a snub pistol all come out of
// the same code path looking like themselves.

import * as THREE from "three";

const MATS = {
  body:   () => new THREE.MeshStandardMaterial({ color: 0x4a4f48, roughness: 0.4, metalness: 0.7 }),
  dark:   () => new THREE.MeshStandardMaterial({ color: 0x2a2c28, roughness: 0.55, metalness: 0.5 }),
  accent: () => new THREE.MeshStandardMaterial({ color: 0x6b7a5e, roughness: 0.4, metalness: 0.6 }),
  wood:   () => new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.75, metalness: 0.05 }),
};

function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function cyl(rt, rb, h, mat, seg = 10) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); }

export function buildWeaponMesh(def) {
  const spec = def.model || {};
  const len = spec.len || 0.5;
  const heavy = !!spec.heavy;
  const bodyH = (heavy ? 0.085 : 0.07) * (def.cls === "sidearm" ? 0.85 : 1);
  const bodyW = (heavy ? 0.075 : 0.06) * (def.cls === "sidearm" ? 0.8 : 1);

  const group = new THREE.Group();
  const bodyMat = MATS.body();
  const darkMat = MATS.dark();
  const accentMat = MATS.accent();
  const furnitureMat = spec.wood ? MATS.wood() : darkMat;

  const bullpup = spec.stock === "bullpup";
  const isPistol = spec.stock === "none";

  // --- receiver
  const receiverLen = len * (bullpup ? 0.78 : 0.55);
  const body = box(bodyW, bodyH, receiverLen, bodyMat);
  body.position.z = -len * (bullpup ? 0.02 : 0.12);
  group.add(body);

  // --- barrel
  const barrelLen = len * 0.5 * (spec.barrel || 1);
  const barrelR = heavy ? 0.024 : 0.016;
  const barrel = cyl(barrelR, barrelR * 1.1, barrelLen, darkMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, bodyH * 0.1, -len * 0.62 - (barrelLen - len * 0.5) * 0.5);
  group.add(barrel);
  const muzzleZ = barrel.position.z - barrelLen / 2;

  // --- handguard / furniture over the barrel
  if (!isPistol) {
    const hg = box(bodyW * 1.05, bodyH * 0.55, len * 0.32 * (spec.barrel || 1), spec.wood ? furnitureMat : accentMat);
    hg.position.set(0, -bodyH * 0.05, -len * 0.4);
    group.add(hg);
  }

  // --- stock
  if (spec.stock === "fixed") {
    const stock = box(bodyW * 0.72, bodyH * 0.8, len * 0.34, furnitureMat);
    stock.position.set(0, -bodyH * 0.06, len * 0.3);
    group.add(stock);
    const comb = box(bodyW * 0.7, bodyH * 0.45, len * 0.2, furnitureMat);
    comb.position.set(0, bodyH * 0.4, len * 0.22);
    group.add(comb);
  } else if (spec.stock === "folding") {
    const rail = box(bodyW * 0.34, bodyH * 0.2, len * 0.3, darkMat);
    rail.position.set(0, bodyH * 0.05, len * 0.28);
    group.add(rail);
    const pad = box(bodyW * 0.8, bodyH * 0.85, len * 0.06, darkMat);
    pad.position.set(0, -bodyH * 0.02, len * 0.44);
    group.add(pad);
  } else if (bullpup) {
    const pad = box(bodyW * 0.9, bodyH * 1.1, len * 0.07, darkMat);
    pad.position.set(0, -bodyH * 0.05, len * 0.36);
    group.add(pad);
  }

  // --- pistol grip
  const grip = box(0.05, isPistol ? 0.13 : 0.15, 0.055, darkMat);
  grip.position.set(0, -bodyH * (isPistol ? 1.1 : 1.3), isPistol ? len * 0.18 : len * 0.02);
  grip.rotation.x = 0.32;
  group.add(grip);

  // --- magazine
  const magZ = bullpup ? len * 0.18 : -len * 0.14;
  if (spec.mag === "box" || spec.mag === "long") {
    const magLen = spec.mag === "long" ? 0.28 : 0.19;
    const mag = box(0.042, magLen, 0.06, darkMat);
    mag.position.set(0, -bodyH * 1.6 - (magLen - 0.19) * 0.5, isPistol ? len * 0.18 : magZ);
    mag.rotation.x = isPistol ? 0.32 : -0.12;
    group.add(mag);
  } else if (spec.mag === "curved") {
    const mag = box(0.044, 0.22, 0.062, darkMat);
    mag.position.set(0, -bodyH * 1.75, magZ);
    mag.rotation.x = -0.34;
    group.add(mag);
  } else if (spec.mag === "drum") {
    const drum = cyl(0.075, 0.075, 0.05, darkMat, 14);
    drum.rotation.z = Math.PI / 2;
    drum.position.set(0, -bodyH * 1.9, magZ);
    group.add(drum);
  } else if (spec.mag === "tube") {
    const tube = cyl(0.018, 0.018, len * 0.55, darkMat);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, -bodyH * 0.55, -len * 0.45);
    group.add(tube);
  } else if (spec.mag === "topbox") {
    const mag = box(0.05, 0.032, len * 0.42, darkMat);
    mag.position.set(0, bodyH * 0.62, -len * 0.1);
    group.add(mag);
  }

  // --- sight, and the aim point that ADS aligns to
  const sight = new THREE.Group();
  let aimY = bodyH * 0.7;
  let aimZ = -len * 0.15;
  const topOfMag = spec.mag === "topbox" ? bodyH * 0.62 + 0.032 : bodyH * 0.5;

  if (def.sight === "reddot") {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 6, 16), darkMat);
    const mount = box(0.02, 0.022, 0.03, darkMat);
    mount.position.y = -0.018;
    sight.add(ring, mount);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xff2222, side: THREE.DoubleSide, depthTest: false });
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.005, 10), dotMat);
    dot.position.z = 0.003;
    dot.renderOrder = 10;
    sight.add(dot);
    aimY = topOfMag + 0.035;
    aimZ = -len * 0.3;
  } else if (def.sight === "scope") {
    const tube = cyl(0.026, 0.026, len * 0.34, darkMat, 14);
    tube.rotation.x = Math.PI / 2;
    sight.add(tube);
    const bell = cyl(0.034, 0.026, len * 0.08, darkMat, 14);
    bell.rotation.x = Math.PI / 2;
    bell.position.z = -len * 0.2;
    sight.add(bell);
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x0e1a24, side: THREE.DoubleSide });
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.024, 14), glassMat);
    glass.position.z = len * 0.168;
    sight.add(glass);
    for (const z of [-len * 0.1, len * 0.1]) {
      const ring = box(0.03, 0.03, 0.016, darkMat);
      ring.position.set(0, -0.021, z);
      sight.add(ring);
    }
    aimY = topOfMag + 0.05;
    aimZ = -len * 0.16;
  } else {
    const rear = box(0.018, 0.02, 0.01, darkMat);
    const front = box(0.006, 0.022, 0.006, darkMat);
    rear.position.set(0, topOfMag + 0.014, -len * 0.15);
    front.position.set(0, topOfMag + 0.015, muzzleZ + 0.03);
    sight.add(rear, front);
    aimY = topOfMag + 0.02;
    aimZ = -len * 0.15;
  }

  if (def.sight !== "iron") sight.position.set(0, aimY, aimZ);
  group.add(sight);
  group.userData.sight = sight;
  group.userData.aimPoint = new THREE.Vector3(0, aimY, aimZ);
  group.userData.muzzleZ = muzzleZ;

  // --- suppressor / muzzle device
  const barrelAtt = def.attachments?.barrel;
  if (barrelAtt === "suppressor") {
    const can = cyl(barrelR * 1.9, barrelR * 1.9, 0.14, darkMat, 12);
    can.rotation.x = Math.PI / 2;
    can.position.set(0, bodyH * 0.1, muzzleZ - 0.06);
    group.add(can);
    group.userData.muzzleZ = muzzleZ - 0.13;
  } else if (barrelAtt === "comp" || barrelAtt === "brake") {
    const dev = cyl(barrelR * 1.5, barrelR * 1.5, 0.05, accentMat, 10);
    dev.rotation.x = Math.PI / 2;
    dev.position.set(0, bodyH * 0.1, muzzleZ - 0.02);
    group.add(dev);
    group.userData.muzzleZ = muzzleZ - 0.05;
  }

  // --- underbarrel
  const under = def.attachments?.underbarrel;
  if (under === "vert") {
    const g = box(0.032, 0.075, 0.032, darkMat);
    g.position.set(0, -bodyH * 1.3, -len * 0.42);
    group.add(g);
  } else if (under === "angled") {
    const g = box(0.032, 0.055, 0.05, darkMat);
    g.position.set(0, -bodyH * 1.2, -len * 0.42);
    g.rotation.x = -0.5;
    group.add(g);
  } else if (under === "laser") {
    const unit = box(0.026, 0.026, 0.055, darkMat);
    unit.position.set(0, -bodyH * 0.85, -len * 0.44);
    group.add(unit);
    const lensMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.006, 8), lensMat);
    lens.position.set(0, -bodyH * 0.85, -len * 0.47);
    group.add(lens);
  }

  group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return group;
}
