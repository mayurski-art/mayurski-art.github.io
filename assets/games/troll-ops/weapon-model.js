// Troll Ops — procedural weapon view models.
//
// One builder reads each weapon's `model` spec instead of the old hardcoded
// if-chain, so a bullpup PDW, a drum-fed LMG and a snub pistol all come out of
// the same code path looking like themselves.

import * as THREE from "three";
import { buildGripHand, buildSupportHand } from "./hand-model.js";
import {
  OPTIC_BUILDERS, BARREL_BUILDERS, UNDER_BUILDERS,
  buildIronRear, buildIronFront, railSection,
} from "./attachment-models.js";
import { build416 } from "./weapon-416.js";

const MATS = {
  body:   () => new THREE.MeshStandardMaterial({ color: 0x4a4f48, roughness: 0.4, metalness: 0.7 }),
  dark:   () => new THREE.MeshStandardMaterial({ color: 0x2a2c28, roughness: 0.55, metalness: 0.5 }),
  accent: () => new THREE.MeshStandardMaterial({ color: 0x6b7a5e, roughness: 0.4, metalness: 0.6 }),
  wood:   () => new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.75, metalness: 0.05 }),
  brass:  () => new THREE.MeshStandardMaterial({ color: 0xb08d3e, roughness: 0.35, metalness: 0.85 }),
  glow:   () => new THREE.MeshBasicMaterial({ color: 0x6dff4a }),
  glowTube: () => new THREE.MeshStandardMaterial({ color: 0x4ee62f, emissive: 0x4ee62f, emissiveIntensity: 1.4, roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.92 }),
};

function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function cyl(rt, rb, h, mat, seg = 10) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); }

function buildTankLauncher(def, spec, len) {
  // A robotic arm-extension weapon: the horn+cell "candle" stack runs
  // forward along -Z, level with the grip, like a barrel — not standing
  // up off a housing. It should read as a straight extension of the arm.
  const group = new THREE.Group();
  const darkMat = MATS.dark();
  const brassMat = MATS.brass();
  const bodyH = 0.09;

  // --- housing (holds grip/trigger, sits behind the horn)
  const housingLen = len * 0.5;
  const housing = box(0.09, bodyH * 1.3, housingLen, darkMat);
  housing.position.set(0, 0, len * 0.16);
  group.add(housing);

  // --- horn body: tapers forward from the housing into the brass collar,
  // muzzle end pointing down -Z (the weapon's forward axis).
  const hornLen = len * 0.62;
  const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.088, hornLen, 14), darkMat);
  horn.rotation.x = Math.PI / 2;
  horn.position.set(0, bodyH * 0.1, -hornLen / 2 - housingLen * 0.15);
  group.add(horn);
  const hornTipZ = horn.position.z - hornLen / 2;

  // --- brass collar band, sits at the horn's muzzle-end neck
  const brass = cyl(0.052, 0.062, 0.05, brassMat, 14);
  brass.rotation.x = Math.PI / 2;
  brass.position.set(0, bodyH * 0.1, hornTipZ - 0.025);
  group.add(brass);

  // --- glowing green fuel cylinder, running forward alongside the horn
  // on top, like a barrel shroud — the "candle" itself points forward.
  const cellR = 0.045;
  const cellLen = len * 0.42;
  const cellZ = hornTipZ - 0.05 - cellLen / 2;
  const cellGroup = new THREE.Group();
  cellGroup.position.set(0, bodyH * 0.1, cellZ);
  const cell = cyl(cellR, cellR, cellLen, MATS.glowTube(), 14);
  cell.rotation.x = Math.PI / 2;
  cellGroup.add(cell);
  const nub = cyl(cellR * 0.3, cellR * 0.3, cellLen * 0.16, MATS.glowTube(), 8);
  nub.rotation.x = Math.PI / 2;
  nub.position.z = -(cellLen / 2 + cellLen * 0.08);
  cellGroup.add(nub);
  group.add(cellGroup);
  const glowLight = new THREE.PointLight(0x4ee62f, 1.1, 1.4, 2);
  glowLight.position.set(0, bodyH * 0.1, cellZ);
  group.add(glowLight);
  const muzzleTipZ = cellZ - cellLen / 2 - cellLen * 0.16;

  // --- side tank ("Green Candles"), fed by a hose forward into the horn
  const tankLen = len * 0.34;
  const tank = box(0.05, 0.075, tankLen, darkMat);
  tank.position.set(-0.1, -bodyH * 0.2, len * 0.14);
  group.add(tank);
  const tankStripe = box(0.006, 0.078, tankLen * 0.62, MATS.glowTube());
  tankStripe.position.set(-0.1 - 0.028, -bodyH * 0.2, len * 0.14);
  group.add(tankStripe);

  const hoseMat = MATS.glowTube();
  const hose = cyl(0.009, 0.009, len * 0.22, hoseMat, 8);
  hose.rotation.x = Math.PI / 5;
  hose.position.set(-0.075, bodyH * 0.55, len * 0.02);
  group.add(hose);
  const hoseElbow = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.009, 6, 10, Math.PI * 0.6), hoseMat);
  hoseElbow.position.set(-0.05, bodyH * 0.35, -len * 0.06);
  hoseElbow.rotation.set(0, Math.PI / 2, Math.PI * 0.15);
  group.add(hoseElbow);

  // --- pistol grip + trigger under the housing
  const grip = box(0.05, 0.16, 0.06, darkMat);
  grip.position.set(0, -bodyH * 1.4, len * 0.3);
  grip.rotation.x = 0.28;
  group.add(grip);
  const hand = buildGripHand(bodyH / 0.07);
  hand.userData.hand = true;
  hand.position.copy(grip.position);
  hand.rotation.copy(grip.rotation);
  group.add(hand);
  const trigger = box(0.03, 0.05, 0.04, darkMat);
  trigger.position.set(0, -bodyH * 0.7, len * 0.2);
  group.add(trigger);

  // --- vent slit + control button on the housing, matching the reference
  const vent = box(0.006, 0.045, 0.05, MATS.glow());
  vent.position.set(0.046, -bodyH * 0.15, len * 0.12);
  group.add(vent);
  const button = cyl(0.012, 0.012, 0.01, darkMat, 10);
  button.rotation.z = Math.PI / 2;
  button.position.set(0.046, 0.03, len * 0.28);
  group.add(button);

  // The horn+cell stack, held level as an arm extension, reads well
  // without needing the big rescale the old vertical build required —
  // just a mild trim so it sits in the corner like other weapons.
  const wrap = new THREE.Group();
  wrap.add(group);
  const holdScale = 0.75;
  wrap.scale.setScalar(holdScale);

  const muzzleZ = muzzleTipZ * holdScale;
  // No sight on a tank launcher — aim straight down the horn/cell axis.
  const aimY = bodyH * 0.1 * holdScale;
  const aimZ = muzzleZ * 0.6;
  wrap.userData.sight = null;
  wrap.userData.aimPoint = new THREE.Vector3(0, aimY, aimZ);
  wrap.userData.muzzleZ = muzzleZ;
  wrap.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return wrap;
}

/* `skin` defaults to the one chosen with the loadout (def.attachments.skin);
   remote players pass theirs explicitly. Only the Problem 416 wears skins,
   and it has its own panelled model to wear them on (weapon-416.js). */
/* Drop any lights a model carries (the Green Candles cell glow). Only the
   first-person viewmodel keeps them: it renders in its own weaponScene. A
   light on a third-person gun in the world scene changes the light count
   and recompiles every lit shader (light-pool.js). */
export function stripLights(obj) {
  const lights = [];
  obj.traverse((n) => { if (n.isLight) lights.push(n); });
  for (const l of lights) l.parent.remove(l);
  return obj;
}

export function buildWeaponMesh(def, { skin } = {}) {
  if (def.id === "problem416") return build416(def, skin ?? def.attachments?.skin ?? null);
  const spec = def.model || {};
  if (spec.stock === "tank") return buildTankLauncher(def, spec, spec.len || 0.5);
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

    // Support hand claws down over the FRONT face of the handguard,
    // centred on it in X and offset forward in Z so the fingers hang
    // down in front of — not sunk inside — the handguard's own solid
    // box. buildSupportHand's local origin sits above where its fingers
    // hang (-Y), so it's placed above the handguard's top surface with
    // enough clearance for the whole claw to read in front of it.
    // Every non-pistol weapon is carried two-handed. Scaled the same way
    // the trigger hand is, against the standard bodyH of 0.07.
    // Scaled up beyond the trigger hand's own bodyH/0.07 factor — the claw
    // is a much more minimal shape (5 boxes, no forearm bulk) and reads as
    // a stray detail rather than a hand at that size from normal gameplay
    // viewing distance, confirmed by an in-game screenshot at the smaller
    // scale.
    const hgTopY = hg.position.y + bodyH * 0.275;
    const hgFrontZ = hg.position.z - len * 0.16 * (spec.barrel || 1);
    const supportHand = buildSupportHand((bodyH / 0.07) * 1.5);
    supportHand.userData.hand = true;
    const supportHandPos = new THREE.Vector3(0, hgTopY + bodyH * 0.4, hgFrontZ + 0.04);
    supportHand.position.copy(supportHandPos);
    group.add(supportHand);
    // Exposed so the third-person rig can point its own off-hand at the
    // same spot on a peer's weapon mesh, instead of duplicating this offset.
    group.userData.supportHandPos = supportHandPos;
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
  // Scale=1 is tuned against the standard (non-heavy, non-pistol) bodyH of
  // 0.07 — every other weapon's hand scales proportionally to its own grip.
  const hand = buildGripHand(bodyH / 0.07);
  hand.userData.hand = true;
  hand.position.copy(grip.position);
  hand.rotation.copy(grip.rotation);
  group.add(hand);

  // --- magazine
  // Detachable types (box/curved/drum/long/topbox) store their mesh and rest
  // transform on userData so Phase 3 reload choreography (game.js) can pull
  // the mag out and swap in a fresh one instead of it being a permanently
  // baked-in child — tube (shell-fed) and the "none" weapons intentionally
  // don't expose this, since they don't reload with a mag swap at all.
  const magZ = bullpup ? len * 0.18 : -len * 0.14;
  if (spec.mag === "box" || spec.mag === "long") {
    const magLen = spec.mag === "long" ? 0.28 : 0.19;
    const mag = box(0.042, magLen, 0.06, darkMat);
    mag.position.set(0, -bodyH * 1.6 - (magLen - 0.19) * 0.5, isPistol ? len * 0.18 : magZ);
    mag.rotation.x = isPistol ? 0.32 : -0.12;
    group.add(mag);
    group.userData.magMesh = mag;
    group.userData.magazinePoint = mag.position.clone();
    group.userData.magRestRotationX = mag.rotation.x;
  } else if (spec.mag === "curved") {
    const mag = box(0.044, 0.22, 0.062, darkMat);
    mag.position.set(0, -bodyH * 1.75, magZ);
    mag.rotation.x = -0.34;
    group.add(mag);
    group.userData.magMesh = mag;
    group.userData.magazinePoint = mag.position.clone();
    group.userData.magRestRotationX = mag.rotation.x;
  } else if (spec.mag === "drum") {
    const drum = cyl(0.075, 0.075, 0.05, darkMat, 14);
    drum.rotation.z = Math.PI / 2;
    drum.position.set(0, -bodyH * 1.9, magZ);
    group.add(drum);
    group.userData.magMesh = drum;
    group.userData.magazinePoint = drum.position.clone();
    group.userData.magRestRotationX = drum.rotation.z;
  } else if (spec.mag === "tube") {
    const tube = cyl(0.018, 0.018, len * 0.55, darkMat);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, -bodyH * 0.55, -len * 0.45);
    group.add(tube);
  } else if (spec.mag === "topbox") {
    const mag = box(0.05, 0.032, len * 0.42, darkMat);
    mag.position.set(0, bodyH * 0.62, -len * 0.1);
    group.add(mag);
    group.userData.magMesh = mag;
    group.userData.magazinePoint = mag.position.clone();
    group.userData.magRestRotationX = mag.rotation.x;
  }

  // --- sight, and the aim point that ADS aligns to
  const sight = new THREE.Group();
  let aimY = bodyH * 0.7;
  let aimZ = -len * 0.15;
  let railMountedOptic = null;
  const topOfMag = spec.mag === "topbox" ? bodyH * 0.62 + 0.032 : bodyH * 0.5;

  // The chosen optic decides the shape, not the broad `def.sight` family —
  // otherwise Reflex/Coyote and ACOG/8x each collapse into one mesh and half
  // the Customize screen changes nothing you can see. Falls back to the
  // family when a weapon ships with glass but carries no attachment record
  // (bot loadouts and dropped pickups both take that path).
  const opticKey = def.attachments?.optic
    || (def.sight === "scope" ? "acog" : def.sight === "reddot" ? "reflex" : "iron");
  const opticBuild = OPTIC_BUILDERS[opticKey];

  if (opticBuild) {
    const optic = opticBuild();
    sight.add(optic);
    // Rail surface sits just above the receiver; the optic's own
    // `aimOffsetY` lifts the glass from there, so a tall scope rides high
    // and a micro dot sits low without a per-sight constant here.
    const railY = topOfMag + 0.004;
    aimY = railY + (optic.userData.aimOffsetY ?? 0.05);
    // Sat over the rail that carries it, straddling the receiver/handguard
    // joint the way a real optic does. Long glass is pulled a touch further
    // forward so the eyepiece doesn't overhang the stock, short glass a
    // touch back so its mount still lands on the rail.
    aimZ = -len * (optic.userData.lengthZ > 0.12 ? 0.34 : 0.3);
    // Sub-groups measure from the glass centre, but the mount legs are
    // drawn downward from it, so nothing else needs shifting.
    railMountedOptic = optic;
  } else {
    // Iron sights: rear aperture on the receiver, hooded post on the barrel.
    // These sit in weapon space (the group is never offset for irons), so
    // they're placed absolutely, exactly as before.
    const rear = buildIronRear();
    rear.position.set(0, topOfMag + 0.016, -len * 0.15);
    const front = buildIronFront();
    front.position.set(0, topOfMag + 0.015, muzzleZ + 0.03);
    sight.add(rear, front);
    aimY = topOfMag + 0.022;
    aimZ = -len * 0.15;
  }

  // Only a rail-mounted optic is moved as a unit — iron sights were already
  // placed in weapon space above, and offsetting the group would double it.
  if (railMountedOptic) sight.position.set(0, aimY, aimZ);
  group.add(sight);
  // A mounted optic wants a rail under it, or it floats above the receiver.
  if (railMountedOptic && !isPistol) {
    // Long enough to run under the optic's whole footprint plus a little
    // spare either end, and centred on the optic — a fixed-length rail at a
    // fixed Z left the 8x's front ring hanging over bare receiver.
    const railLen = Math.max(len * 0.3, (railMountedOptic.userData.lengthZ ?? 0.09) + 0.04);
    const rail = railSection(railLen, bodyW * 0.62, MATS.dark());
    rail.position.set(0, topOfMag, aimZ);
    group.add(rail);
  }
  group.userData.sight = sight;
  group.userData.aimPoint = new THREE.Vector3(0, aimY, aimZ);
  // Tube optics bring the eyepiece up to the eye when aimed (see
  // attachment-models.js adsDistance); open sights keep the default.
  group.userData.adsDistance = railMountedOptic?.userData.adsDistance ?? null;
  group.userData.adsWeaponFov = railMountedOptic?.userData.adsWeaponFov ?? null;
  group.userData.muzzleZ = muzzleZ;

  // --- suppressor / muzzle device
  const barrelAtt = def.attachments?.barrel;
  const barrelBuild = BARREL_BUILDERS[barrelAtt];
  if (barrelBuild) {
    const dev = barrelBuild(barrelR);
    const devLen = dev.userData.lengthZ ?? 0.05;
    // Butted against the crown rather than a fixed offset, so a long
    // suppressor and a stubby brake both sit flush on the muzzle.
    dev.position.set(0, bodyH * 0.1, muzzleZ - devLen / 2);
    group.add(dev);
    // The flash now leaves the device's own muzzle, not the bare barrel's.
    group.userData.muzzleZ = muzzleZ - devLen;
  }

  // --- underbarrel
  const under = def.attachments?.underbarrel;
  const underBuild = UNDER_BUILDERS[under];
  if (underBuild) {
    const unit = underBuild();
    // Hung off the handguard's real underside rather than a bodyH fraction —
    // the handguard's own height varies with `heavy`, so a constant offset
    // left grips floating in a visible gap under light-barrelled guns.
    // Grips clamp to the bottom rail; the laser rides the side rail a little
    // higher, tucked against the handguard's flank.
    const hgBottomY = -bodyH * 0.05 - bodyH * 0.275;
    const unitY = under === "laser" ? hgBottomY + 0.012 : hgBottomY;
    const unitZ = -len * (under === "laser" ? 0.44 : 0.42);
    unit.position.set(0, unitY, unitZ);
    group.add(unit);

    if (under === "laser") {
      // Beam starts at the emitter bezel, converted from the unit's local
      // space into weapon space so it leaves the lens rather than the middle
      // of the housing.
      const em = unit.userData.emitter || new THREE.Vector3();
      const originZ = unitZ + em.z;
      const origin = new THREE.Vector3(em.x, unitY + em.y, originZ);

      // The beam itself: a thin, always-facing-forward cylinder the game code
      // rescales to the raycast distance and shows only while aiming, so it
      // reads as an activated sight rather than a cosmetic glued to the rail.
      const beamMat = new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.85, depthWrite: false });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 1, 6), beamMat);
      beam.rotation.x = Math.PI / 2;   // cylinder's height axis runs along +Z after this
      beam.position.copy(origin);
      beam.visible = false;
      group.add(beam);
      group.userData.laserBeam = beam;
      group.userData.laserOrigin = origin.clone();
    }
  }

  group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return group;
}
