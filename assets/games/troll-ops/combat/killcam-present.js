// Troll Forces killcam presentation: poses the world, the killer's gun or
// melee and the HUD around a killcam.js replay, and ends or skips it.

import { poseDeath, DEATH_TIME, aimRig, gaitPhaseRate, poseHumanoid, poseThrowArm, THROW_TIME } from "../character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1m1u";
import { MELEE_DEFS, buildMeleeMesh, MeleeState, SABER_BLOCK, THROWABLE_DEFS } from "../gear.js?v=to-hb1kb3-bk1-wst-ig1-th2";
import { WEAPON_DEFS } from "../weapons.js?v=p5bm-wst-hf1-fu1-wb1-ar1-ar2";
import * as THREE from "three";
import { stripLights, buildWeaponMesh } from "../weapon-model.js?v=p5-em1-wst-hf1-wb1-ar1-ar2";
import { TEAMS } from "../remote-players.js?v=umb3g-pc1-nf-em1-mi2-wst-ig1-bs1-sb1-cb2-rp1-hf1-sb2-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2";
import { grenades, explosionFx } from "./throwables.js?v=th1-kc2-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2";
import { game } from "../core/state.js?v=st1";

/* ---------------- killcam (killcam.js) ----------------
   Recording runs every PvP frame while nothing is replaying: every remote
   actor's rendered pose, and ours. On death, the replay drives the camera
   (killcam.update in updatePlayer) and this poses the world to match:
   grenades in flight and their blasts, and the killer's view scoping in
   and out with them. */
export const killcamSelfId = () => game.net.id || "self";
const _kcSample = {};
const _kcShots = [];
let kcLocalPhase = 0;
let killcamGun = null;       // the killer's gun as the viewmodel during a replay
let killcamKick = 0;
let killcamHud = null;

export function updateKillcam(dt) {
  game.kcClock += dt;
  if (game.killcamWasActive && !game.killcam.active) endKillcamPresentation();
  game.killcamWasActive = game.killcam.active;
  if (!game.killcam.replaying) {
    for (const rp of game.remotes.byId.values()) {
      if (rp.alive && !rp.rig.root.visible) continue;   // no snapshots yet
      const snaps = rp.peer.snaps;
      game.killcam.record(game.kcClock, rp.netId, {
        x: rp.pos.x, y: rp.pos.y, z: rp.pos.z, yaw: rp.yaw, pitch: rp.pitch, lower: rp.lower,
        alive: rp.alive, wid: rp.weaponId, moving: !!snaps?.[snaps.length - 1]?.moving, bot: !!rp.peer.isBot,
        ...rp.meleeSample(),
        ads: rp.meleeMesh?.visible ? 0 : rp.ads, th: rp.throwT > 0 ? 1 - rp.throwT / THROW_TIME : -1,
      });
    }
    if (game.player.alive) {
      const pm = game.player.melee;
      const sword = !!pm && (game.player.holding === "melee" || pm.busy);
      game.killcam.record(game.kcClock, killcamSelfId(), {
        x: game.move.pos.x, y: game.move.pos.y, z: game.move.pos.z, yaw: game.look.yaw, pitch: game.look.pitch,
        lower: game.localLower, alive: true, wid: game.currentWeapon()?.def?.id, moving: game.move.moving,
        mid: sword ? pm.def.id : null, sw: sword && pm.busy ? Math.min(1, pm.t / pm.total) : -1,
        si: pm ? pm.swingIndex & 1 : 0, bk: sword ? game.localBlockT : 0,
        ads: sword ? 0 : game.currentWeapon()?.adsT || 0,
        th: game.localThrowT > 0 ? 1 - game.localThrowT / THROW_TIME : -1,
      });
    }
    game.killcam.recordNades(game.kcClock, grenades.live);
    return;
  }
  poseKillcamWorld(dt);
}

/* The world at replay time: everyone where they were, the killer hidden
   (we're in their eyes), us walking into it and dropping, their shots
   re-fired. */
function poseKillcamWorld(dt) {
  const rt = game.killcam.rt;
  for (const rp of game.remotes.byId.values()) {
    const s = game.killcam.sampleAt(rp.netId, rt, _kcSample);
    rp.replayPose(s, dt, rp.netId === game.killcam.killerId);
    // Their overhand throw on top (the body follows the arm again).
    if (s?.th >= 0 && rp.rig.root.visible) { poseThrowArm(rp.rig, s.th); rp.syncBody(s.pitch || 0); }
  }
  const me = game.killcam.sampleAt(killcamSelfId(), Math.min(rt, game.killcam.deathT), _kcSample);
  if (me) {
    game.localRig.root.visible = true;
    game.localRig.parts.head.visible = true;
    game.localRig.root.position.set(me.x, me.y, me.z);
    if (rt >= game.killcam.deathT) {
      if (game.localHeld.mesh) game.localHeld.mesh.visible = false;   // goes down empty-handed
      poseDeath(game.localRig, Math.min(1, (rt - game.killcam.deathT) / DEATH_TIME));
    } else {
      aimRig(game.localRig, me.yaw, dt, { moving: me.moving });
      if (me.moving) kcLocalPhase += dt * gaitPhaseRate(3.6);
      // Our own swings and guard play back too (the held melee mesh is
      // already on the rig: syncLocalRigHeld).
      const sword = !!me.mid && MELEE_DEFS[me.mid];
      game.syncLocalRigHeld(sword ? "melee" : "gun", sword ? MELEE_DEFS[me.mid] : WEAPON_DEFS[me.wid] || game.currentWeapon()?.def);
      if (game.localHeld.mesh) game.localHeld.mesh.visible = true;
      const sab = sword && game.localHeld.mesh?.userData.saber;
      if (sab) { sab.target = 1; sab.frac = Math.max(sab.frac, 0.999); }
      poseHumanoid(game.localRig, {
        phase: kcLocalPhase, moving: me.moving, pitch: me.pitch, lower: me.lower, strafe: 0, forward: 1,
        speed: me.moving ? 0.85 : 0, mps: me.moving ? 3.6 : 0, dt, hasGun: !sword, hold: sword ? "melee" : "gun",
        swing: sword && me.sw >= 0 ? { t: me.sw, kind: me.si % 2 === 0 ? "swing" : "thrust" } : null,
        block: sword && me.sw < 0 ? me.bk : 0, ads: sword ? 0 : me.ads || 0,
      });
      if (me.th >= 0) poseThrowArm(game.localRig, me.th);
    }
  }
  poseKillcamNades();
  for (const s of game.killcam.shotsSince(_kcShots)) {
    game.remoteShotFx(new THREE.Vector3(s.ox, s.oy, s.oz), new THREE.Vector3(s.dx, s.dy, s.dz), s.wid, s.quiet);
    if (s.id === game.killcam.killerId) killcamKick = 1;
  }
  updateKillcamGun(dt);
  if (killcamHud) killcamHud.classList.toggle("is-kill", game.killcam.atKill);
}

/* Grenades as they flew in the replay. The live ones are hidden while it
   plays (they belong to now, not then); each recorded one gets a stand-in
   on the grenade system's own geometry and material, and goes off with the
   ordinary blast (light, sparks, sound) when it did. */
const kcNades = new Map();   // nade key -> stand-in mesh
const _kcBooms = [];
const _kcNadePos = new THREE.Vector3();
function poseKillcamNades() {
  for (const g of grenades.live) g.mesh.visible = false;
  const rt = game.killcam.rt;
  for (const [key, n] of game.killcam.nades) {
    const at = game.killcam.nadeAt(n, rt, _kcNadePos);
    let m = kcNades.get(key);
    if (!at) { if (m) m.visible = false; continue; }
    if (!m) {
      const def = THROWABLE_DEFS[n.def];
      if (!def) continue;
      m = new THREE.Mesh(grenades.geo, grenades.matFor(def));
      game.scene.add(m);
      kcNades.set(key, m);
    }
    m.visible = true;
    m.position.copy(at);
    m.rotation.set(rt * 7, rt * 5, 0);
  }
  for (const n of game.killcam.boomsSince(_kcBooms)) {
    const def = THROWABLE_DEFS[n.def], p = n.pts[n.pts.length - 1];
    if (def) explosionFx(def, new THREE.Vector3(p.x, p.y, p.z));
  }
}

function clearKillcamNades() {
  for (const m of kcNades.values()) game.scene.remove(m);   // shared geometry and material: nothing to dispose
  kcNades.clear();
  for (const g of grenades.live) g.mesh.visible = true;
}

/* The killer's gun at the hip, bobbing with their walk and kicking on each
   of their shots, coming up to the sight as they aimed (the same sight
   line our own gun uses) and dipping out of the way for a throw. Built
   from their weapon id; hands stay hidden like ours. */
function buildKillcamGun(wid) {
  disposeKillcamGun();
  const def = WEAPON_DEFS[wid];
  if (!def) return;
  killcamGun = stripLights(buildWeaponMesh(def));
  killcamGun.traverse((o) => { if (o.userData.hand) o.visible = false; });
  game.weaponScene.add(killcamGun);
}

function disposeKillcamGun() {
  if (!killcamGun) return;
  game.weaponScene.remove(killcamGun);
  killcamGun.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    if (o.material) o.material.dispose?.();
  });
  killcamGun = null;
}

/* The killer's melee weapon in front of the camera while it's in their fist
   in the replay: its swings played off the recorded swing fraction on the
   same tracks our own sword uses, the saber's guard lerped in the same way. */
let killcamMelee = null;   // { mesh, state, id }
function disposeKillcamMelee() {
  if (!killcamMelee) return;
  game.weaponScene.remove(killcamMelee.mesh);
  killcamMelee.mesh.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    if (o.material) o.material.dispose?.();
  });
  killcamMelee = null;
}
function updateKillcamMelee(s) {
  const def = s?.mid && MELEE_DEFS[s.mid];
  if (!def) { if (killcamMelee) killcamMelee.mesh.visible = false; return false; }
  if (killcamMelee?.id !== def.id) {
    disposeKillcamMelee();
    const mesh = stripLights(buildMeleeMesh(def, false, { held3p: true }));
    const sab = mesh.userData.saber;
    if (sab) { sab.target = 1; sab.frac = 1; }
    game.weaponScene.add(mesh);
    killcamMelee = { mesh, state: new MeleeState(def), id: def.id };
  }
  const { mesh, state } = killcamMelee;
  mesh.visible = true;
  state.swingIndex = s.si | 0;
  state.t = s.sw >= 0 ? Math.max(1e-4, s.sw * state.total) : 0;
  const { pos, quat } = state.pose();
  mesh.position.copy(pos);
  mesh.quaternion.copy(quat);
  const view = def.model?.view;
  if (view?.pos) { mesh.position.x += view.pos[0]; mesh.position.y += view.pos[1]; mesh.position.z += view.pos[2]; }
  if (view?.rot) mesh.quaternion.multiply(game._meleeViewQ.setFromEuler(game._meleeViewE.set(view.rot[0], view.rot[1], view.rot[2])));
  mesh.scale.setScalar(view?.scale || 1);
  if (mesh.userData.saber && s.sw < 0 && s.bk > 0.001) {
    mesh.position.lerp(SABER_BLOCK.pos, s.bk);
    mesh.quaternion.slerp(SABER_BLOCK.quat, s.bk);
  }
  return true;
}

function updateKillcamGun(dt) {
  const sm = game.killcam.sampleAt(game.killcam.killerId, game.killcam.rt, _kcSample);
  const melee = updateKillcamMelee(sm);
  if (!killcamGun) return;
  killcamGun.visible = !melee;
  killcamKick = Math.max(0, killcamKick - dt * 10);
  const s = sm;
  const ads = s?.ads || 0;
  const steady = 1 - ads * 0.85;
  const walk = s?.moving ? game.killcam.rt * 9 : 0;
  const k = killcamKick * (1 - ads * 0.5);
  const ud = killcamGun.userData;
  const aim = ud.aimPoint || _kcAim;
  const throwDip = s?.th >= 0 ? Math.sin(Math.PI * s.th) * 0.3 : 0;
  killcamGun.position.set(
    0.22 + (-aim.x - 0.22) * ads + Math.sin(walk) * 0.006 * steady,
    -0.2 + (-aim.y + 0.2) * ads - Math.abs(Math.cos(walk)) * 0.006 * steady - (s?.lower || 0) * 0.02 * steady - throwDip,
    -0.55 + (-(ud.adsDistance ?? 0.46) - aim.z + 0.55) * ads + k * 0.045,
  );
  killcamGun.rotation.set(k * 0.07 - throwDip, 0, Math.sin(walk) * 0.01 * steady);
  fadeKillcamGlass(killcamGun, ads);
}
const _kcAim = new THREE.Vector3(0, 0, -0.4);

/* Optic glass clears as the gun comes up, as our own does (game.js's
   fadeOpticGlass). */
function fadeKillcamGlass(mesh, ads) {
  let mats = mesh.userData.glassMats;
  if (!mats) {
    mats = [];
    mesh.traverse((o) => { if (o.material?.userData?.isGlass) mats.push(o.material); });
    mesh.userData.glassMats = mats;
  }
  for (const m of mats) m.opacity = m.userData.baseOpacity * (1 - 0.9 * ads);
}

/* The lens while a replay plays: the killer's zoom as they scoped in (their
   weapon's ADS FOV), and the viewmodel lens their optic asks for. null
   when no replay is up, and game.js's own FOV rules apply. */
function killcamAds() {
  if (!game.killcam.replaying) return null;
  const s = game.killcam.sampleAt(game.killcam.killerId, game.killcam.rt, _kcSample);
  return s && !s.mid ? s.ads || 0 : 0;
}
export function killcamFov(baseFov) {
  const ads = killcamAds();
  if (ads === null) return null;
  const mult = WEAPON_DEFS[game.killcam.sampleAt(game.killcam.killerId, game.killcam.rt, _kcSample)?.wid]?.adsFovMult ?? 1;
  return baseFov * (1 + (mult - 1) * ads);
}
export function killcamWeaponFov() {
  const ads = killcamAds();
  if (ads === null) return null;
  return 58 + ((killcamGun?.userData.adsWeaponFov || 50) - 58) * ads;
}

/* Title, killer plate and the skip hint. BO2's layout: KILLCAM across the
   top, who and with what bottom-left, skip bottom-right. */
export function startKillcamPresentation(killerId, weaponId, isHead) {
  if (!killcamHud) {
    killcamHud = document.createElement("div");
    killcamHud.className = "to-kc";
    killcamHud.innerHTML = `
      <div class="to-kc-top"><span class="to-kc-title">Killcam</span></div>
      <div class="to-kc-plate">
        <span class="to-kc-by">Killed by</span>
        <span class="to-kc-name"></span>
        <span class="to-kc-weapon"></span>
      </div>
      <button type="button" class="to-kc-skip"></button>`;
    killcamHud.querySelector(".to-kc-skip").addEventListener("pointerdown", (e) => { e.preventDefault(); skipKillcam(); });
    game.els.killcamBars.parentElement.appendChild(killcamHud);
  }
  const name = killerId ? game.nameFor(killerId) : null;
  const team = killerId && (game.net.peers.get(killerId)?.team || game.bots.byId(killerId)?.team);
  const nameEl = killcamHud.querySelector(".to-kc-name");
  nameEl.textContent = name && name !== "You" ? name : "Unknown";
  nameEl.style.color = team && TEAMS[team] ? TEAMS[team].ui : "";
  const bits = [game.weaponNameFor(weaponId)].filter(Boolean);
  if (isHead) bits.push("Headshot");
  killcamHud.querySelector(".to-kc-weapon").textContent = bits.join(" · ");
  killcamHud.querySelector(".to-kc-skip").textContent = "Skip";
  killcamHud.classList.remove("is-kill");
  killcamHud.hidden = false;
  if (game.killcam.replaying) {
    // Which way we go down: shot from the front knocks us onto our back,
    // from behind pitches us forward onto our face.
    const k = game.killcam.sampleAt(game.killcam.killerId, game.killcam.deathT, {});
    if (k) {
      let d = Math.atan2(-(k.x - game.move.pos.x), -(k.z - game.move.pos.z)) - game.look.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      game.localRig.deathHint = { dir: Math.abs(d) < Math.PI / 2 ? 1 : -1 };
    }
    game.localRig.death = null;
    buildKillcamGun(weaponId && WEAPON_DEFS[weaponId] ? weaponId : game.killcam.killerWeapon);
    game.weaponRig.visible = false;
  }
  // The replay is the death screen now: no 62% fade or centre countdown
  // over it, and none of the live HUD.
  game.els.killcamBars.parentElement.classList.add("to-kc-on");
  game.els.deathfade.classList.remove("is-dead");
  game.els.respawn.style.visibility = "hidden";
}

export function endKillcamPresentation() {
  if (killcamHud) killcamHud.hidden = true;
  game.els.killcamBars.parentElement.classList.remove("to-kc-on");
  disposeKillcamGun();
  disposeKillcamMelee();
  clearKillcamNades();
  game.weaponRig.visible = game.player.alive;
  game.els.respawn.style.visibility = "";
  game.els.killcamBars.classList.remove("is-on");
  if (!game.player.alive) game.els.deathfade.classList.add("is-dead");
}

/* Space / A / a tap: straight back to the ordinary respawn timer (BO2's
   skip) — never faster than dying without a killcam would have been. */
export function skipKillcam() {
  if (!game.killcam.active || game.player.alive) return;
  const elapsed = game.killcam.t;
  game.killcam.cancel();
  endKillcamPresentation();
  if (!game.isSnd()) game.respawnT = Math.min(game.respawnT, Math.max(0.25, game.killcamBaseRespawn - elapsed));
}
