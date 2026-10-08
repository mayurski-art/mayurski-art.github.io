// Troll Forces melee: quick swings, the Trollsaber's block, deflect and
// trail, and the Keyboard Warrior's shield.

import { stageFrozen, royaleDropView } from "../modes/royale.js?v=md1-gj1-fu1b7b7dc2-wb1m1";
import { breakSpawnGuard, killerPosFor } from "./damage.js?v=dm1-kc2-si1-gj1-fu1b7b7dc2-wb1m1";
import * as THREE from "three";
import { ParryState } from "../character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1m1u";
import { createKeyboardRepair } from "../keyboard-repair.js?v=kr15";
import { WEAPON_DEFS } from "../weapons.js?v=p5bm-wst-hf1-fu1-wb1";
import { settings } from "../menu/settings.js?v=ms1-gj1-fu1b7b7dc2-wb1m1";
import { spawnDamageNumber } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1";
import { SaberTrail } from "../trollsaber.js?v=ts4-ig1";
import { damp } from "../anim-curves.js";
import { game } from "../core/state.js?v=st1";

/* Quick melee swings without putting the gun away; pressing 3 makes the
   melee weapon the thing in your hands, which swings and moves faster. */
export function swingMelee() {
  if (game.socialUnarmed()) return;
  if (kbRepair.active) return;   // both hands busy fixing the keyboard
  if (game.meleeHolster) return;      // being put away for a streak
  if (!game.player.alive || game.move.busy || game.gameState !== "playing" || stageFrozen() || royaleDropView()) return;
  if (!game.player.melee || !game.player.melee.start()) return;
  // Everyone else sees the swing; the damage still travels as a normal hit.
  if (game.isPvp() && game.net.active) game.net.publishMelee(game.player.melee.swingIndex % 2, game.player.melee.def.id);
  breakSpawnGuard();
  // Swinging mid-ignite (or before it): the blade comes out fast, and the
  // slow draw gives way to the swing.
  if (game.activeMeleeMesh?.userData.igniteDelay > 0) {
    game.activeMeleeMesh.userData.igniteDelay = 0;
    if (game.activeMeleeMesh.userData.saber) game.audio.saberIgnite(); else if (game.activeMeleeMesh.userData.halo) game.audio.haloIgnite();
  }
  for (const m of [game.activeMeleeMesh, game.localHeld.mesh]) {
    const sv = m?.userData.saber || m?.userData.halo;
    if (sv && sv.frac < 1) sv.ignite();
  }
  game.meleeDrawT = 0;
  const kind = game.player.melee.def.model?.kind;
  if (kind === "saber" || kind === "halo") game.audio.saberSwing();
  else if (kind === "chainsaw") game.audio.chainsawRev();
  else if (kind === "reaper") game.audio.reaperSwing();
  else if (kind === "knuckles") game.audio.knuckleSwing();
  else game.audio.swing();
}

/* The swing itself: a short fan of rays rather than one, so a swing that is
   only nearly on target still connects the way a wide arc should. */
const _meleeAim = new THREE.Euler();
export function meleeConnect() {
  const def = game.player.melee.def;
  // From your own eyes along your aim, not from the camera: in third person
  // the camera sits ~3 m behind you, so a 2 m swing used to end behind your
  // own back and never touched anyone (user: "not able to kill enemies with
  // the trollsaber in third person"). In first person this is the same ray.
  const origin = game.player.pos.clone();
  const forward = new THREE.Vector3(0, 0, -1).applyEuler(_meleeAim.set(game.look.pitch, game.look.yaw, 0, "YXZ"));
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

  const ray = new THREE.Raycaster();
  ray.near = 0;
  // A cut sweeps the whole arc; a thrust goes a little further down a narrow
  // line. Rays fan across the sweep at three heights (the aim, the chest of
  // someone a little below it, the head of someone a little above), centre
  // first so a square hit wins.
  const thrust = game.player.melee.swingIndex % 2 === 1 && def.model?.kind !== "chainsaw";
  const reach = def.range * (thrust ? 1.1 : 1);
  const half = (thrust ? def.arc * 0.3 : def.arc) / 2;
  ray.far = reach;
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  const fan = [];
  for (const h of [0, -0.5, 0.5, -1, 1]) for (const v of [0, -0.28, 0.14]) fan.push([h * half, v]);

  for (const [off, tilt] of fan) {
    const dir = forward.clone().addScaledVector(right, Math.tan(off)).addScaledVector(up, Math.tan(tilt)).normalize();
    ray.set(origin, dir);
    const hits = game.targetMeshes.length ? ray.intersectObjects(game.targetMeshes, true) : [];
    for (const h of hits) {
      const actor = game.resolveBulletTarget(h.object);
      if (!actor) continue;
      // A hit from behind is a backstab, decided by which way they face.
      let mult = 1;
      const root = actor.mesh || actor.group;
      if (root) {
        // Matches movement.js's forwardVec (-sin(yaw), 0, -cos(yaw)) — this
        // was the mirror image of that, so backstabs registered when hitting
        // someone in the front and not the back.
        const theirs = new THREE.Vector3(-Math.sin(root.rotation.y), 0, -Math.cos(root.rotation.y));
        const swing = dir.clone();
        swing.y = 0;
        swing.normalize();
        if (theirs.dot(swing) > 0.35) mult = def.backstabMult;
      }
      if (def.model?.kind === "saber" || def.model?.kind === "halo") game.audio.saberHit();
      else if (def.model?.kind === "chainsaw") game.audio.chainsawHit();
      else if (def.model?.kind === "knuckles") game.audio.knuckleHit();
      else game.audio.meleeHit();
      game.onBulletActorHit(actor, {
        damage: def.damage * mult,
        isHead: mult > 1,
        point: h.point,
        dir: dir.clone(),
      });
      game.meleeImpactT = 1;
      return;
    }
  }
  if (def.model?.kind !== "saber") game.audio.impact();
  game.meleeWhiffT = 1;
}

/* ---- Trollsaber: block and deflect ----------------------------------
   With the saber drawn, holding aim raises it across the body; rounds from
   the front (inside def.deflect.cone) hit the blade instead of you. Each
   one, and holding the guard, drains a meter; run it dry and the guard
   breaks for def.deflect.breakTime. Blasts, melee, zombies and the bomb go
   straight through (only WEAPON_DEFS rounds are deflectable). */
export const saberBlock = { active: false, meter: 1, broken: 0, idle: 0, t: 0 };
export const saberParry = new ParryState();   // the last deflect's parry (character.js)
const _parryV = new THREE.Vector3();
export const _parryW = {};
export const _parryPos = new THREE.Vector3();
export const _parryQ = new THREE.Quaternion();
export const _flickQ = new THREE.Quaternion();
export const _viewZ = new THREE.Vector3(0, 0, 1);
export const _viewX = new THREE.Vector3(1, 0, 0);
export const _bladeG = new THREE.Vector3(), _bladeP = new THREE.Vector3();
// The draw flourish when an energy blade (saber, halo) comes into the hand.
export const MELEE_DRAW_TIME = 0.5;
// Equipping one (3, or cycling to it) rather than a quick V swing: a slow,
// deliberate ignite every time (user, 2026-10-03), and a weightier draw for
// the Keyboard Warrior and the Chainsaw too.
export const SLOW_IGNITE = 1.1;
export const MELEE_EQUIP_TIME = 1.0;
// Ignition on and off, where you can see it (user: "I just don't see the
// ignition when I equip it"): the energy blade's hilt comes up dark and
// settles, a beat, THEN it ignites; put away, it powers down in the hand
// first and only then drops out of view.
export const POWER_EQUIP_TIME = 0.7;     // the dark hilt rising into the guard
export const POWER_IGNITE_DELAY = 0.95;  // from the draw starting to the ignite
export const POWER_IGNITE = 1.35;        // the slow, sputtering ignite itself
export const POWER_RETRACT = 0.55;       // powering down in the hand
export const POWER_HOLSTER_TIME = 0.95;  // the whole put-away: retract, then drop
export let saberTrail = null;
let saberSwingSpeed = 0;
const _saberPrevTip = new THREE.Vector3();
const _saberRoot = new THREE.Vector3();
const _saberTip = new THREE.Vector3();
const _deflectTo = new THREE.Vector3();
const _deflectFwd = new THREE.Vector3();
const _deflectQ = new THREE.Quaternion();

function heldSaberDeflect() {
  return game.player.melee?.def?.deflect || null;
}

export function updateSaberBlock(dt, wantAds) {
  const d = heldSaberDeflect();
  const want = !!d && game.player.holding === "melee" && game.player.alive && wantAds
    && !game.player.melee.busy && saberBlock.broken <= 0 && saberBlock.meter > 0 && !game.isStaging();
  saberBlock.active = want;
  if (saberBlock.broken > 0) saberBlock.broken = Math.max(0, saberBlock.broken - dt);
  if (!d) {
    saberBlock.meter = 1;
  } else if (want) {
    saberBlock.meter = Math.max(0, saberBlock.meter - d.drainHeld * dt);
    saberBlock.idle = 0;
    if (saberBlock.meter <= 0) breakSaberGuard();
  } else {
    saberBlock.idle += dt;
    if (saberBlock.idle > d.regenDelay && saberBlock.broken <= 0) saberBlock.meter = Math.min(1, saberBlock.meter + d.regen * dt);
  }
  if (!game.els.saberMeter) return;
  const show = !!d && game.player.holding === "melee" && game.player.alive
    && (want || saberBlock.meter < 0.999 || saberBlock.broken > 0);
  game.els.saberMeter.hidden = !show;
  if (!show) return;
  game.els.saberMeter.style.setProperty("--p", saberBlock.meter.toFixed(3));
  game.els.saberMeter.classList.toggle("is-on", want);
  game.els.saberMeter.classList.toggle("is-broken", saberBlock.broken > 0);
}

function breakSaberGuard() {
  const d = heldSaberDeflect();
  if (!d) return;
  saberBlock.meter = 0;
  saberBlock.active = false;
  saberBlock.broken = d.breakTime;
  game.audio.saberBreak();
  game.activeMeleeMesh?.userData.saber?.flare(1.4);
}

/* ---- the Keyboard Warrior's shield (gear.js MELEE_DEFS.keyboard.shield)
   Hold aim and the board goes up flat, keys out (keyboard-repair.js
   KB_SHIELD). It stops rounds from the front with no meter, but a few in a
   row break it: keycaps everywhere, and you sit down and fix it. */
export const kbShield = { active: false, t: 0, kick: 0, streak: 0, lastHit: 0 };
export let kbRepair;
export const _kbFarGrip = new THREE.Vector3(0, -0.03, -0.86);   // support hand under the far end
function heldKbShield() { return game.player.melee?.def?.shield || null; }
export function updateKbShield(wantAds) {
  kbShield.active = !!heldKbShield() && game.player.holding === "melee" && game.player.alive && wantAds
    && !game.player.melee.busy && !kbRepair.active && !game.isStaging();
  // Lowering the shield ends the streak: the break needs hits in a row.
  if (!kbShield.active) kbShield.streak = 0;
}
function tryKbShield(fromId, weaponId, fromPos) {
  const d = heldKbShield();
  if (!kbShield.active || !d || !WEAPON_DEFS[weaponId]) return false;
  const src = fromPos || killerPosFor(fromId);
  game.camera.getWorldDirection(_deflectFwd);
  _deflectFwd.y = 0;
  _deflectFwd.normalize();
  if (src) {
    _deflectTo.set(src.x - game.move.pos.x, 0, src.z - game.move.pos.z);
    if (_deflectTo.lengthSq() > 1e-6 && _deflectTo.normalize().dot(_deflectFwd) < d.cone) return false;
  }
  const at = game.player.pos.clone().addScaledVector(_deflectFwd, 0.6);
  at.y -= 0.2;
  game.spawnImpactBurst(at, 0x8a8a96, 10);
  game.audio.keyboardShieldHit();
  kbShield.kick = 1;
  // CONSECUTIVE hits (user, 2026-10-03): each one within hitWindow of the
  // last, the shield up the whole time. A pause, or lowering it, resets.
  const now = performance.now() / 1000;
  kbShield.streak = now - kbShield.lastHit <= d.hitWindow ? kbShield.streak + 1 : 1;
  kbShield.lastHit = now;
  if (kbShield.streak >= d.breakHits) {
    kbShield.streak = 0;
    kbShield.active = false;
    kbRepair.start();
  }
  return true;
}

/* damagePlayer asks first: true means the blade took it. */
export function tryDeflect(amount, fromId, weaponId, fromPos) {
  if (tryKbShield(fromId, weaponId, fromPos)) return true;
  if (!saberBlock.active) return false;
  const d = heldSaberDeflect();
  if (!d || !WEAPON_DEFS[weaponId]) return false;
  const src = fromPos || killerPosFor(fromId);
  game.camera.getWorldDirection(_deflectFwd);
  _deflectFwd.y = 0;
  _deflectFwd.normalize();
  if (src) {
    _deflectTo.set(src.x - game.move.pos.x, 0, src.z - game.move.pos.z);
    if (_deflectTo.lengthSq() > 1e-6 && _deflectTo.normalize().dot(_deflectFwd) < d.cone) return false;
  }
  saberBlock.meter -= d.drainPerHit + amount * d.drainPerDamage;
  saberBlock.idle = 0;
  game.saberDeflectT = 1;
  // Which parry: where the round came from, in our view. killerPosFor
  // already puts `src` at the shooter's eye.
  if (src) {
    game.camera.getWorldPosition(_parryV);
    _parryV.set(src.x - _parryV.x, (src.y ?? _parryV.y) - _parryV.y, src.z - _parryV.z).normalize();
    _parryV.applyQuaternion(_deflectQ.copy(game.camera.quaternion).invert());
    saberParry.start(_parryV.x, _parryV.y);
  } else saberParry.start(0, 0);
  game.activeMeleeMesh?.userData.saber?.flare(0.9);
  // Sparks where the round met the blade: the blade's middle is in view
  // space (the weapon camera sits at the origin), so re-aim it through the
  // world camera's wider lens and put the burst out along that ray.
  const saberMesh = game.activeMeleeMesh;
  const s = saberMesh?.userData.saber;
  if (s && (settings.thirdPerson || game.emoteIsTp())) {
    // Third person: the first-person blade isn't on screen, so burst in
    // front of the body, where the guard is.
    const v = game.player.pos.clone().addScaledVector(_deflectFwd, 0.7);
    v.y -= 0.25;
    game.spawnImpactBurst(v, 0xff6a3a, 14);
    ricochetRound(v, src, weaponId);
  } else if (s) {
    const v = s.tipLocal.clone().lerp(s.rootLocal, 0.45);
    saberMesh.localToWorld(v);
    const k = Math.tan(THREE.MathUtils.degToRad(game.camera.fov / 2)) / Math.tan(THREE.MathUtils.degToRad(game.weaponCamera.fov / 2));
    v.x *= k; v.y *= k;
    v.normalize().multiplyScalar(1.3);
    game.camera.localToWorld(v);
    game.spawnImpactBurst(v, 0xff6a3a, 14);
    ricochetRound(v, src, weaponId);
  }
  game.audio.saberClash();
  game.net.publishDeflect(fromId, weaponId);
  if (saberBlock.meter <= 0) breakSaberGuard();
  return true;
}

/* A deflected round, batted back the way it came (the way Luke sends bolts
   back at the troopers): a cosmetic tracer from the blade toward the
   shooter, thrown wide enough that it reads as redirected, not aimed. */
const _ricoDir = new THREE.Vector3();
function ricochetRound(at, towards, weaponId) {
  const def = WEAPON_DEFS[weaponId];
  if (!def) return;
  if (towards) _ricoDir.subVectors(towards, at).normalize();
  else _ricoDir.set(Math.random() - 0.5, 0.2, Math.random() - 0.5).normalize();
  _ricoDir.x += (Math.random() - 0.5) * 0.5;
  _ricoDir.y += (Math.random() - 0.3) * 0.35;
  _ricoDir.z += (Math.random() - 0.5) * 0.5;
  _ricoDir.normalize();
  game.bullets.spawn({ origin: at.clone().addScaledVector(_ricoDir, 0.15), dir: _ricoDir.clone(), def, ownerId: "remote", cosmetic: true });
}

/* Everyone else's sabers, once a frame after remotes.update: the sounds
   their bodies queued (ignite, retract, swing) and one hum on the nearest
   lit blade, bending up while it swings. */
const _remoteHumAt = new THREE.Vector3();
export function updateRemoteSabers() {
  let near = null, nearD = 30 * 30;
  for (const rp of game.remotes.byId.values()) {
    for (const s of rp.sfx) {
      if (s.kind === "ignite") game.audio.saberIgnite(s.at);
      else if (s.kind === "retract") game.audio.saberRetract(s.at);
      else if (s.kind === "swing") game.audio.saberSwing(s.at);
      else if (s.kind === "haloIgnite") game.audio.haloIgnite(s.at);
      else if (s.kind === "haloRetract") game.audio.haloRetract(s.at);
    }
    rp.sfx.length = 0;
    if (!rp.saberOut || !rp.saber?.lit) continue;
    const d = rp.pos.distanceToSquared(game.move.pos);
    if (d < nearD) { near = rp; nearD = d; }
  }
  if (!near) { game.audio.saberHumAt(-1); return; }
  game.audio.saberHumAt(near.swinging ? 0.8 : 0, near.bladeMid(_remoteHumAt) || near.centre(_remoteHumAt));
}

/* A peer's blade ate a round: sparks on it for everyone; if it was our
   round, the number that would have printed says DEFLECTED instead. */
export function onRemoteDeflect(p, m) {
  const rp = game.remotes.byId.get(p.id);
  if (!rp) return;
  // Their parry, by where the shooter stands relative to them.
  const from = m.by === game.net.id ? game.move.pos : killerPosFor(m.by);
  if (from) {
    const dx = from.x - rp.pos.x, dz = from.z - rp.pos.z, dy = (from.y ?? rp.pos.y) - rp.pos.y;
    const c = Math.cos(rp.yaw), sn = Math.sin(rp.yaw);
    // rig right is (cos, 0, -sin), ahead is (-sin, 0, -cos)
    const side = dx * c - dz * sn, ahead = -dx * sn - dz * c;
    const len = Math.max(0.5, Math.hypot(side, ahead));
    rp.startParry(side / len, Math.atan2(dy, len));
  } else rp.startParry(0, 0);
  const at = rp.bladeMid() || rp.centre();
  game.spawnImpactBurst(at, 0xff6a3a, 14);
  // Our own position is the feet; killerPosFor's is already the eye.
  const lift = from === game.move.pos ? 1.5 : 0;
  ricochetRound(at, from ? _parryV.set(from.x, (from.y ?? at.y - lift) + lift, from.z) : null, WEAPON_DEFS[m.w] ? m.w : "problem416");
  rp.saber?.flare(0.9);
  game.audio.saberClash(at);
  if (m.by === game.net.id) spawnDamageNumber(0, at, false, "DEFLECTED");
}

/* Swing trail and the hum, once a frame while the saber is out. The trail
   lives in weaponRig, the parent of the melee mesh, so its points are the
   mesh's own matrix applied to the blade root/tip. */
export function updateSaberFx(mesh, saber, swinging, dt) {
  if (!saberTrail) saberTrail = new SaberTrail(game.weaponRig);
  mesh.updateMatrix();
  _saberRoot.copy(saber.rootLocal).applyMatrix4(mesh.matrix);
  _saberTip.copy(saber.tipLocal).applyMatrix4(mesh.matrix);
  const now = performance.now() / 1000;
  // Only the cut itself leaves a trail, not the wind-up or the recovery.
  const m = game.player.melee;
  const cutting = swinging && m.t >= m.window.open - 0.09 && m.t <= m.window.close + 0.05;
  // A deflect's flick is a cut too: the blade whips and streaks.
  if ((cutting || Math.abs(game.saberFlick) > 0.25) && saber.lit) saberTrail.push(_saberRoot, _saberTip, now);
  saberTrail.update(now);
  const speed = game.saberHavePrevTip ? _saberTip.distanceTo(_saberPrevTip) / Math.max(dt, 1e-3) : 0;
  _saberPrevTip.copy(_saberTip);
  game.saberHavePrevTip = true;
  saberSwingSpeed = damp(saberSwingSpeed, speed, 12, dt);
  game.audio.saberHum(saber.lit ? Math.min(1, saberSwingSpeed / 7) : -1);
}

/* What used to run at load in game.js: called from game.js where this code was. */
export function initMelee() {
  kbRepair = createKeyboardRepair({ audio: game.audio });
}
