// The melee viewmodel: equip, idle, swings, saber block and parry, hit and
// whiff kicks, and the chainsaw rev.

import * as THREE from "three";
import { inspectArms, restoreMeleeHands, pfArms, _meleeViewQ, _meleeViewE, meleeHands, applyReaperInspect, applyMeleeInspect, inspectProgress, poseSaberArms, poseMeleeArms, inspectDur } from "./weapon-view.js?v=wv1-si1-gj1-if1-fu1b7b7dc2-wb1m1";
import { saberTrail, POWER_IGNITE_DELAY, POWER_EQUIP_TIME, MELEE_DRAW_TIME, POWER_IGNITE, MELEE_EQUIP_TIME, saberBlock, kbShield, kbRepair, _kbFarGrip, saberParry, _parryW, _parryPos, _parryQ, _bladeG, _bladeP, _flickQ, _viewZ, _viewX, POWER_RETRACT, updateSaberFx } from "../combat/melee.js?v=ml1-kc2-si1-gj1-fu1b7b7dc2-wb1m1";
import { damp } from "../anim-curves.js";
import { KB_SHIELD } from "../keyboard-repair.js?v=kr15";
import { SABER_BLOCK, SABER_PARRY, chainsawRevAt } from "../gear.js?v=to-hb1kb3-bk1-wst-ig1";
import { parryWeights, PARRY_ZONES } from "../character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1m1u";
import { currentWeapon } from "../combat/weapons.js?v=wp1-kc2-si1-gj1-fu1b7b7dc2-wb1m1";
import { poseKnuckles } from "../brass-knuckles.js?v=bk1-wst";
import { game } from "../core/state.js?v=st1";

/* The melee view model: raised whenever it's the held weapon, and swung
   through the pose MeleeState solves each frame — the same rest grip, chop
   and thrust as the Godot reference. A quick melee borrows the same mesh, so
   it pops in for the swing and drops out again the moment it's over. */
let meleeIdleT = 0;
let meleeLowerT = 0;
const _meleeImpactEuler = new THREE.Euler();

export function updateMeleeView(dt) {
  const mesh = game.activeMeleeMesh;
  const melee = game.player.melee;
  sawShake = 0;
  if (!mesh || !melee) return;

  // Put away for a streak (holsterMeleeFor): once it's all the way down, the
  // call goes through and the hands are off it this same frame.
  if (game.meleeHolster) {
    if (!game.player.alive || game.player.holding !== "melee" || game.gameState !== "playing") game.meleeHolster = null;
    else if (game.meleeHolster.t >= (game.meleeHolster.len ?? game.MELEE_HOLSTER_TIME)) game.finishMeleeHolster();
  }

  const held = game.player.holding === "melee";
  const swinging = melee.busy;
  if (held || swinging) inspectArms.visible = false;   // the gun's showcase arms
  // Tossed hands go back on the sword the moment the toss isn't playing.
  if (!(game.inspectT > 0 && held && !swinging)) restoreMeleeHands(mesh);
  mesh.visible = held || swinging;
  const saber = mesh.userData.saber;
  if (saber && mesh.visible !== game.saberWasShown) {
    game.saberWasShown = mesh.visible;
    saber.snapOff();
    saberTrail?.clear();
    game.saberHavePrevTip = false;
    if (mesh.visible) {
      const equip = held && !swinging;
      if (equip) mesh.userData.igniteDelay = POWER_IGNITE_DELAY;   // lit below, once the hilt's up
      else { saber.ignite(); saber.flare(1.2); game.audio.saberIgnite(); }
      game.meleeDrawT = game.meleeDrawLen = equip ? POWER_EQUIP_TIME : MELEE_DRAW_TIME;
    }
    else { game.audio.saberHum(-1); if (!mesh.userData.holstered) game.audio.saberRetract(); }
  }
  // The Halo Blade: dark in the hand, its prongs unfold out of the hilt as
  // it's drawn (halo-blade.js), and fold away when it's put up.
  const halo = mesh.userData.halo;
  if (halo && mesh.visible !== !!mesh.userData.wasShown) {
    mesh.userData.wasShown = mesh.visible;
    if (mesh.visible) {
      const equip = held && !swinging;
      halo.snapOff();
      if (equip) mesh.userData.igniteDelay = POWER_IGNITE_DELAY;
      else { halo.ignite(); game.audio.haloIgnite(); }
      game.meleeDrawT = game.meleeDrawLen = equip ? POWER_EQUIP_TIME : MELEE_DRAW_TIME;
    }
    else { halo.retract(); if (!mesh.userData.holstered) game.audio.haloRetract(); }
  }
  // Ignition: the hilt is up and still, now the blade comes out.
  if (mesh.userData.igniteDelay > 0) {
    mesh.userData.igniteDelay = mesh.visible ? mesh.userData.igniteDelay - dt : 0;
    if (mesh.userData.igniteDelay <= 0 && mesh.visible) {
      const power = saber || halo;
      power?.ignite(POWER_IGNITE);
      if (saber) { saber.flare(0.6); game.audio.saberIgniteSlow(); }
      else if (halo) game.audio.haloIgniteSlow();
    }
  }
  // The holster already played the power-down; that hide was quiet.
  if (!mesh.visible) mesh.userData.holstered = false;
  // Everything else (Keyboard Warrior, Chainsaw, Reaper) gets the same slow
  // draw when it's equipped, with its own start-up sound.
  if (!saber && !halo && mesh.visible !== !!mesh.userData.drawShown) {
    mesh.userData.drawShown = mesh.visible;
    if (mesh.visible && held && !swinging) {
      game.meleeDrawT = game.meleeDrawLen = MELEE_EQUIP_TIME;
      const kind = melee.def.model?.kind;
      if (kind === "chainsaw") game.audio.chainsawStart();
      else if (kind === "keyboard") game.audio.keyboardBoot();
      else if (kind === "knuckles") game.audio.knuckleCrack();
    }
  }
  // Only while the gun is what we hold: this used to re-show it every frame,
  // so it stayed on screen beside the streak tablet and marker.
  if (game.activeWeaponMesh) game.activeWeaponMesh.visible = game.player.holding === "gun" && !swinging;
  // Every melee weapon is held by the black rod arms, not the old white
  // block hands. The saber lets go for its inspect.
  game.saberArmsOn = mesh.visible && game.player.alive && (!saber || game.inspectT <= 0);
  if (!game.saberArmsOn && game.saberArmsWere) pfArms.visible = false;
  game.saberArmsWere = game.saberArmsOn;
  if (!mesh.visible) {
    meleeIdleT = 0; saberBlock.t = 0; kbShield.t = 0;
    if (kbRepair.active) kbRepair.stop();   // put away mid-fix: it's fixed when it comes back
    return;
  }

  const { pos, quat } = melee.pose();
  mesh.position.copy(pos);
  mesh.quaternion.copy(quat);
  // Per-weapon framing on top of the shared pose (gear.js model.view): the
  // chainsaw is carried level with the bar out front, not up like a sword.
  const view = melee.def.model?.view;
  if (view) {
    if (view.pos) { mesh.position.x += view.pos[0]; mesh.position.y += view.pos[1]; mesh.position.z += view.pos[2]; }
    if (view.rot) mesh.quaternion.multiply(_meleeViewQ.setFromEuler(_meleeViewE.set(view.rot[0], view.rot[1], view.rot[2])));
  }
  mesh.scale.setScalar(view?.scale || 1);

  // Drawing an energy blade: it comes up from low right, hilt first, turning
  // into the guard while the blade lights — a flourish, not a pop-in. The
  // arms follow the weapon, so they draw it too.
  if (game.meleeDrawT > 0) {
    game.meleeDrawT = Math.max(0, game.meleeDrawT - dt);
    const k = 1 - game.meleeDrawT / game.meleeDrawLen;
    const e = 1 - Math.pow(1 - k, 3);              // ease out
    const off = 1 - e;
    mesh.position.x += off * 0.14;
    mesh.position.y -= off * 0.34;
    mesh.position.z += off * 0.08;
    // Twist about the blade (roll) and tip it back, settling with a small
    // overshoot right at the end.
    const settle = Math.sin(k * Math.PI) * 0.12 * (k > 0.6 ? 1 : 0);
    mesh.quaternion.multiply(_meleeViewQ.setFromEuler(_meleeViewE.set(off * -0.9 + settle, 0, off * 1.6)));
  }

  if (melee.def.shield) {
    kbShield.t = damp(kbShield.t, kbShield.active ? 1 : 0, 14, dt);
    if (kbShield.t > 0.001) {
      mesh.position.lerp(KB_SHIELD.pos, kbShield.t);
      mesh.quaternion.slerp(KB_SHIELD.quat, kbShield.t);
    }
    // The support hand rides out to the far end for the shield and onto the
    // tools for the repair, and must come back under the main hand after
    // (user: it stayed up the blade, and its arm hid the U MAD BRO? guard).
    // `home` eases back to the built grip; the shield lerps from it fresh
    // every frame instead of compounding on the hand's own position.
    const sup = meleeHands(mesh)[1];
    if (sup && !mesh.userData.handsTossed) {
      const home = sup.home || (sup.home = { pos: sup.pos.clone(), quat: sup.quat.clone() });
      if (kbRepair.active) {
        home.pos.copy(sup.obj.position);
        home.quat.copy(sup.obj.quaternion);
      } else {
        const k = 1 - Math.exp(-dt * 12);
        home.pos.lerp(sup.pos, k);
        home.quat.slerp(sup.quat, k);
        sup.obj.position.copy(home.pos).lerp(_kbFarGrip, kbShield.t);
        sup.obj.quaternion.copy(home.quat);
      }
    }
    // each round knocks it back into your face a little
    if (kbShield.kick > 0) {
      kbShield.kick = Math.max(0, kbShield.kick - dt * 7);
      mesh.position.z += kbShield.kick * 0.06;
      mesh.position.x += (Math.random() - 0.5) * kbShield.kick * 0.02;
    }
    if (kbRepair.active) kbRepair.update(dt, mesh, meleeHands(mesh));
  }

  if (saber) {
    // Guard up: blade across the body. A deflect knocks it back a touch.
    saberBlock.t = damp(saberBlock.t, saberBlock.active ? 1 : 0, 16, dt);
    if (saberBlock.t > 0.001) {
      mesh.position.lerp(SABER_BLOCK.pos, saberBlock.t);
      mesh.quaternion.slerp(SABER_BLOCK.quat, saberBlock.t);
    }
    // A deflect whips the blade to meet the round (a blend of the zone
    // parries aimed at the shooter), flicks it away and eases back.
    saberParry.update(dt);
    const ps = saberParry.sample();
    const pw = ps.k * saberBlock.t;
    game.saberFlick = ps.flick * saberBlock.t;
    let turn = 1;
    if (pw > 0.001) {
      parryWeights(ps.x, ps.y, _parryW);
      _parryPos.set(0, 0, 0);
      let acc = 0;
      for (const z of PARRY_ZONES) {
        const w = _parryW[z];
        if (w <= 0) continue;
        _parryPos.addScaledVector(SABER_PARRY[z].pos, w);
        if (acc === 0) _parryQ.copy(SABER_PARRY[z].quat);
        else _parryQ.slerp(SABER_PARRY[z].quat, w / (acc + w));
        acc += w;
      }
      // Which way the blade turned (in the view plane) to meet the round:
      // the flick carries on that way.
      _bladeG.subVectors(saber.tipLocal, saber.rootLocal).applyQuaternion(mesh.quaternion);
      _bladeP.subVectors(saber.tipLocal, saber.rootLocal).applyQuaternion(_parryQ);
      turn = Math.sign(_bladeG.x * _bladeP.y - _bladeG.y * _bladeP.x) || 1;
      mesh.position.lerp(_parryPos, pw);
      mesh.quaternion.slerp(_parryQ, pw);
    }
    if (Math.abs(game.saberFlick) > 0.001) {
      // The wrist turn, in view space: on past the intercept, pushed out at
      // the round.
      mesh.quaternion.premultiply(_flickQ.setFromAxisAngle(_viewZ, game.saberFlick * turn * 0.6));
      mesh.quaternion.premultiply(_flickQ.setFromAxisAngle(_viewX, -Math.abs(game.saberFlick) * 0.25));
    }
    if (game.saberDeflectT > 0) {
      game.saberDeflectT = Math.max(0, game.saberDeflectT - dt * 7);
      mesh.position.z += game.saberDeflectT * 0.03;
    }
  }

  // Holstering for a streak: the draw run backwards — it tips and drops
  // away low right, an energy blade powering down as it goes. Waits for a
  // swing already in progress to land.
  if (game.meleeHolster && !swinging) {
    if (!game.meleeHolster.started) {
      game.meleeHolster.started = true;
      game.meleeDrawT = 0;
      game.inspectT = 0;
      if (kbRepair.active) kbRepair.stop();
      const power = saber || halo;
      if (power) {
        power.retract(POWER_RETRACT);
        mesh.userData.igniteDelay = 0;
        if (saber) { game.audio.saberHum(-1); game.audio.saberRetract(); } else game.audio.haloRetract();
        mesh.userData.holstered = true;
      }
    }
    game.meleeHolster.t += dt;
    // An energy blade holds still while it powers down, then drops.
    const hold = saber || halo ? POWER_RETRACT : 0;
    const len = game.meleeHolster.len ?? game.MELEE_HOLSTER_TIME;
    const k = Math.max(0, Math.min(1, (game.meleeHolster.t - hold) / Math.max(0.05, len - hold)));
    const e = k * k * (3 - k) / 2;                 // eases in, leaves quickly
    mesh.position.x += e * 0.14;
    mesh.position.y -= e * 0.34;
    mesh.position.z += e * 0.08;
    mesh.quaternion.multiply(_meleeViewQ.setFromEuler(_meleeViewE.set(e * -0.9, 0, e * 1.6)));
  }

  if (swinging) {
    // Impact: a brief sharp decel + tiny recoil-back, same idea as the
    // gun's viewKick* but scoped to melee. Whiff: the tracks' own
    // follow-through keyframe is allowed to overextend slightly further
    // than its authored end pose while this is decaying.
    game.meleeImpactT = Math.max(0, game.meleeImpactT - dt * 6);
    game.meleeWhiffT = Math.max(0, game.meleeWhiffT - dt * 4);
    if (game.meleeImpactT > 0) {
      mesh.position.z += game.meleeImpactT * 0.05;
      mesh.position.y -= game.meleeImpactT * 0.02;
    }
    if (game.meleeWhiffT > 0) {
      _meleeImpactEuler.set(0, 0, THREE.MathUtils.degToRad(game.meleeWhiffT * 6));
      mesh.quaternion.multiply(new THREE.Quaternion().setFromEuler(_meleeImpactEuler));
    }
  }

  if (!swinging) {
    const w = currentWeapon();
    // Walking/running bob, same phase source the gun view model rides
    // (w.bobPhase keeps advancing even while melee is the held weapon) —
    // without this the sword held dead still while sprinting read as
    // "glued to the screen" rather than carried.
    const moveBob = game.move.moving ? 0.018 : 0;
    mesh.position.x += Math.sin(w.bobPhase) * moveBob * 0.5;
    mesh.position.y -= Math.abs(Math.cos(w.bobPhase)) * moveBob;

    // Sprinting drops the blade out of guard the same way a sprinting gun
    // lowers out of the sight line.
    const wantLower = game.move.sprinting ? 1 : 0;
    meleeLowerT = damp(meleeLowerT, wantLower, 9, dt);
    mesh.position.y -= meleeLowerT * 0.1;
    mesh.position.z += meleeLowerT * 0.08;
    mesh.rotateX(meleeLowerT * 0.5);

    // Slow figure-eight breathing sway while fully idle, matching the
    // reference's idle animation — the walk bob above already covers
    // movement, so this only adds while standing still. Skipped while the
    // inspect flourish is playing so the two don't fight over the same
    // quaternion.
    if (!game.move.moving && game.inspectT <= 0) {
      meleeIdleT = (meleeIdleT + dt) % MELEE_IDLE_PERIOD;
      const phase = (meleeIdleT / MELEE_IDLE_PERIOD) * Math.PI * 2;
      const bob = 0.012;
      mesh.position.x += Math.sin(phase) * bob * 0.6;
      mesh.position.y -= Math.abs(Math.cos(phase)) * bob;
      _meleeIdleEuler.set(
        THREE.MathUtils.degToRad(Math.cos(phase) * 1.4),
        THREE.MathUtils.degToRad(Math.sin(phase) * 1.8),
        0);
      mesh.quaternion.multiply(new THREE.Quaternion().setFromEuler(_meleeIdleEuler));
    } else if (game.move.moving) {
      meleeIdleT = 0;
    }

    // Toss-and-float flourish (D-pad up / T while holding the sword), see
    // applyMeleeInspect. Also lets tossed hands back onto the sword. The
    // Reaper's Grin has its own: shut, flick open, a knife trick.
    if (mesh.userData.kind === "reaper") applyReaperInspect(mesh);
    else if (mesh.userData.kind === "chainsaw") applySawRev(mesh);
    else if (mesh.userData.kind !== "knuckles") applyMeleeInspect(mesh);   // the knuckles' is poseKnuckles below
  }
  // The chainsaw revs: the engine shakes it (and, hard, the screen), the
  // chain speeds up, the throttle squeezes and the exhaust smokes.
  let rev = 0;
  if (mesh.userData.kind === "chainsaw") {
    if (swinging) {
      const t = melee.t;
      rev = chainsawRevAt(t);
      if (sawPrevT < 0.28 && t >= 0.28) game.audio.chainsawRip();
      // Grinding in: sawed back and forth along the bar.
      if (t > 0.38 && t < 0.64) mesh.translateZ(Math.sin(t * 58) * 0.022 * Math.min(1, (t - 0.38) / 0.05));
      sawPrevT = t;
    } else {
      sawPrevT = 0;
      rev = sawInspectRev;
    }
    const grinding = swinging && melee.t > 0.34 && melee.t < 0.64;
    const amp = 0.0014 + rev * (grinding ? 0.016 : 0.009);
    mesh.position.x += (Math.random() - 0.5) * amp;
    mesh.position.y += (Math.random() - 0.5) * amp;
    mesh.position.z += (Math.random() - 0.5) * amp * 0.5;
    sawShake = rev * (grinding ? 0.02 : 0.007);
  }
  // Knuckle Grinners: the fists jab, hook, crack and show off inside the
  // still root (brass-knuckles.js); the arms follow their anchors.
  if (mesh.userData.kind === "knuckles") {
    const cracks = poseKnuckles(mesh, {
      t: swinging ? melee.t : 0, index: melee.swingIndex,
      inspect: game.inspectT > 0 && held && !swinging ? inspectProgress() : -1, time: game.clock.elapsedTime,
    });
    if (cracks) game.audio.knuckleCrack();
  }
  mesh.userData.tick?.(dt, swinging, rev);

  if (saber) updateSaberFx(mesh, saber, swinging, dt);
  if (game.saberArmsOn) (saber ? poseSaberArms(mesh) : poseMeleeArms(mesh));
}
const MELEE_IDLE_PERIOD = 3.2;
const _meleeIdleEuler = new THREE.Euler();

/* Chainsaw rev (admire, T / D-pad up / the touch admire button): brought up
   in front of the face, bar tipped up, three throttle blips, the last one
   held, then back down. applySawRev leaves the throttle in sawInspectRev
   for updateMeleeView's shake, chain and smoke. */
export const SAW_REV_TIME = 1.7;
const SAW_BLIPS = [[0.1, 0.28], [0.36, 0.52], [0.6, 0.9]];
export let sawInspectRev = 0;
let sawPrevT = 0;
export let sawShake = 0;      // extra screen jitter (radians) while the saw is revving
const _sawQ = new THREE.Quaternion();
const _sawE = new THREE.Euler();
function applySawRev(mesh) {
  sawInspectRev = 0;
  if (game.inspectT <= 0) return;
  const k = 1 - game.inspectT / inspectDur;
  const lift = smooth01(Math.min(1, k / 0.12)) * (1 - smooth01(Math.max(0, (k - 0.9) / 0.1)));
  for (let i = 0; i < SAW_BLIPS.length; i++) {
    const [a, b] = SAW_BLIPS[i];
    if (k >= a && k < b) {
      const u = (k - a) / (b - a);
      sawInspectRev = Math.max(sawInspectRev, Math.min(1, u * 6) * (i === SAW_BLIPS.length - 1 ? 1 : 1 - u * 0.4));
      if (game.sawRevBlips <= i) { game.sawRevBlips = i + 1; i === SAW_BLIPS.length - 1 ? game.audio.chainsawRip() : game.audio.chainsawRev(); }
    }
  }
  sawInspectRev = Math.max(sawInspectRev, lift * 0.12);
  mesh.position.x -= 0.1 * lift;
  mesh.position.y += 0.1 * lift;
  mesh.position.z += 0.06 * lift;
  // bar tipped up toward the sky, a little toward the middle; it bucks on each blip
  _sawQ.setFromEuler(_sawE.set((0.42 + sawInspectRev * 0.06) * lift, 0.26 * lift, 0.18 * lift));
  mesh.quaternion.premultiply(_sawQ);
}
function smooth01(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
