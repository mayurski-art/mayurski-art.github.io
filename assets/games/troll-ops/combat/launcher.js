// Troll Forces — the FHJ-18 AA launcher (FHJ18.md; user, 2026-10-10/12).
//
// Black Ops 2's anti-air launcher: aim down the sight at an enemy aircraft
// (or an enemy SAM Turret) and hold it in the sight for LOCK_SECS; a red
// bracket closes on it and says LOCKED, and only then does it fire. The
// missile homes on what it was locked to: one downs a UAV, Counter-UAV,
// drone, Dragonfire or SAM Turret, two a gunship, three the warship
// (enemyAirFor's `need`). No hip fire, no lock on anything on the ground.
//
// The missiles fly the SAM Turret's code (sam-turret.js flyMissiles) with a
// smoke trail. Whoever fired one (us, or one of the bots we host) counts
// its hits and calls the kill; everyone else just sees it fly
// ({kind:"aa", action:"launch"} on the streak channel).
//   updateLauncherLock(dt)   each frame, view/player-update.js: the lock
//   fireLauncher(w)          the trigger, combat/weapons.js fireOnce
//   updateAaMissiles(dt)     each frame, streaks/air.js: every missile
//   launchAa(...)            a shot (ours or a bot's), applyRemoteAa(m) theirs

import * as THREE from "three";
import { enemyAirFor, airTargetPos, shootDownAir } from "../streaks/dragonfire.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-aa0-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1";
import { streakEntities } from "../streaks/calling.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1";
import { SamTurret, spawnMissile, flyMissiles, clearMissiles } from "../streaks/sam-turret.js?v=sam1-fj1-or1";
import { raycastWorld } from "../weapons/ballistics.js?v=cg1-wst-hf1-fu1b7-wb1-ar1-ar2-cl1-fj1-zr10-zc1-zc2-or1";
import { game } from "../core/state.js?v=st1";

export const LOCK_SECS = 1.2;          // held in the sight this long: locked
export const LOCK_CONE = 6 * Math.PI / 180;
export const LOCK_RANGE = 220;         // m
const ADS_NEEDED = 0.85;               // how far into the sight before it looks for a lock
const round2 = (v) => Math.round(v * 100) / 100;

/* ------------------------------------------------------------ targets */

/* What a launcher on `team` (owned by `owner`: our id or a bot's) can lock
   onto: enemy aircraft, and enemy SAM Turrets (user, 2026-10-12), each
   { id, pos, need, e }. */
const _samAim = new Map();
export function aaTargetsFor(team, owner) {
  const list = enemyAirFor(team, owner);
  const ffa = !!game.currentMode().ffa;
  for (const e of streakEntities.values()) {
    if (!(e instanceof SamTurret) || !e.alive) continue;
    const by = e.botId || (e.owned ? game.net.id : null);
    if (ffa ? by === owner : (e.botTeam || e.team) === team) continue;
    let p = _samAim.get(e.id);
    if (!p) _samAim.set(e.id, p = new THREE.Vector3());
    list.push({ id: e.id, pos: p.copy(e.pos).setY(e.pos.y + 1.1), need: 1, e });
  }
  return list;
}

/* Where a target is now: an aircraft's, or a SAM Turret's head. */
const _tp = new THREE.Vector3();
function targetPos(id) {
  const e = streakEntities.get(id);
  if (e instanceof SamTurret) return e.dead ? null : _tp.copy(e.pos).setY(e.pos.y + 1.1);
  return airTargetPos(id);
}

/* ------------------------------------------------------------ the lock */

export const lock = { id: null, k: 0, locked: false, need: 1 };
let lockEl = null, hintAt = 0;
const _eye = new THREE.Vector3(), _fwd = new THREE.Vector3(), _to = new THREE.Vector3();

function holdingLauncher() {
  const p = game.player;
  if (!p?.alive || p.holding !== "gun" || game.currentWeaponSlot !== "secondary") return null;
  const w = p.weapons?.[p.secondaryId];
  return w?.def.lockOn ? w : null;
}

/* The best target in the cone, in the clear: the nearest the crosshair. */
function bestInSight(team) {
  game.camera.getWorldPosition(_eye);
  game.camera.getWorldDirection(_fwd);
  let best = null, bestA = LOCK_CONE;
  for (const t of aaTargetsFor(team, game.net.id)) {
    _to.copy(t.pos).sub(_eye);
    const d = _to.length();
    if (d > LOCK_RANGE || d < 3) continue;
    _to.divideScalar(d);
    const a = Math.acos(Math.max(-1, Math.min(1, _to.dot(_fwd))));
    if (a > bestA) continue;
    if (raycastWorld(game.colliders, _eye, _to, d) < d - 2) continue;
    best = t; bestA = a;
  }
  return best;
}

export function updateLauncherLock(dt) {
  const w = holdingLauncher();
  const aiming = !!w && w.adsT >= ADS_NEEDED && !w.reloading;
  const t = aiming ? bestInSight(game.net.team) : null;
  if (t && t.id === lock.id) lock.k = Math.min(1, lock.k + dt / LOCK_SECS);
  else if (lock.k > 0) lock.k = Math.max(0, lock.k - 2 * dt / LOCK_SECS);   // off it: bleeds away twice as fast
  if (t && lock.k <= 0) { lock.id = t.id; lock.need = t.need; }
  if (!t && lock.k <= 0) lock.id = null;
  lock.locked = lock.k >= 1 && !!t && t.id === lock.id;
  // The tone climbs with the lock; solid (the warble) once it's on.
  if (lock.id && lock.k > 0 && aiming) game.audio.candleCharge?.(lock.k, lock.locked);
  else game.audio.candleCharge?.(-1);
  drawBracket(aiming && lock.id ? targetPos(lock.id) : null);
}

function drawBracket(at) {
  if (!at) { if (lockEl) lockEl.hidden = true; return; }
  if (!lockEl) {
    lockEl = document.createElement("div");
    lockEl.className = "to-hk-lock to-aa-lock";
    lockEl.setAttribute("aria-hidden", "true");
    lockEl.innerHTML = "<i></i><span></span>";
    (game.els.streakMark?.parentElement || document.body).appendChild(lockEl);
  }
  const p = _to.copy(at).project(game.camera);
  const on = p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1;
  lockEl.hidden = !on;
  if (!on) return;
  const host = lockEl.parentElement.getBoundingClientRect();
  lockEl.style.left = `${((p.x + 1) / 2) * host.width}px`;
  lockEl.style.top = `${((1 - p.y) / 2) * host.height}px`;
  // Wide and amber while it locks, closing to red and LOCKED.
  const size = 64 - 30 * lock.k;
  lockEl.style.width = lockEl.style.height = `${size}px`;
  lockEl.classList.toggle("is-locking", !lock.locked);
  lockEl.lastChild.textContent = lock.locked ? "LOCKED" : "LOCKING";
}

/* ------------------------------------------------------------ the trigger */

function hint(text) {
  const now = performance.now();
  if (now - hintAt < 1200) return;
  hintAt = now;
  showWaveBanner(text, 900);
}

/* The trigger on the FHJ-18 (combat/weapons.js fireOnce hands it over). No
   hip fire, no fire without a lock. */
const _from = new THREE.Vector3(), _dir = new THREE.Vector3(), _right = new THREE.Vector3();
export function fireLauncher(w) {
  if (w.adsT < ADS_NEEDED) { hint("Aim to lock on"); return; }
  if (!lock.locked) { hint(lock.id ? "Hold it: locking" : "No lock: aircraft and SAM Turrets only"); return; }
  if (!w.canFire()) { if (w.ammoInMag <= 0 && !w.reloading) w.startReload(); return; }
  w.fire(1, 1);
  game.inspectT = 0;
  game.camera.getWorldPosition(_from);
  game.camera.getWorldDirection(_dir);
  // Out of the tube on the right shoulder, a touch up.
  _right.crossVectors(_dir, THREE.Object3D.DEFAULT_UP).normalize();
  _from.addScaledVector(_dir, 0.7).addScaledVector(_right, 0.18).y -= 0.05;
  _dir.y += 0.06;
  _dir.normalize();
  launchAa(_from, _dir, lock.id, lock.need, game.net.id);
  game.kickFireShake(w.def, 1);
  game.look.pitch = Math.min(game.PITCH_LIMIT, game.look.pitch + w.def.recoilKickPitch * 0.5);
  game.muzzleFlashT = 0.08;
  lock.k = 0; lock.locked = false; lock.id = null;
  game.audio.candleCharge?.(-1);
  // The next one goes in the tube by itself, as in BO2.
  if (w.ammoInMag <= 0) w.startReload();
}

/* ------------------------------------------------------------ missiles */

const missiles = [];
const hitsOn = new Map();          // target id -> our missiles that reached it
const puffs = [];
let puffGeo = null;
const PUFF_LIFE = 1.4, PUFF_EVERY = 0.03, MAX_PUFFS = 160;

/* A missile off: `owner` is who gets the kill (our id or one of our bots'),
   and only that client counts its hits. `fromWire`: someone else's, to watch. */
export function launchAa(from, dir, targetId, need, owner, fromWire = false) {
  const ms = spawnMissile(missiles, game.scene, from, dir, targetId);
  ms.owner = owner;
  ms.need = need || 1;
  ms.mine = !fromWire;
  ms.puffT = 0;
  game.audio.explosion?.(0.14, from);
  if (!fromWire && game.net.active) {
    game.net.publishStreak({ kind: "aa", action: "launch", eid: owner, t: targetId,
      x: round2(from.x), y: round2(from.y), z: round2(from.z), dx: round2(dir.x), dy: round2(dir.y), dz: round2(dir.z) });
  }
  return ms;
}

/* Someone else's launch (streaks/bot-streaks.js applyRemoteStreak). */
export function applyRemoteAa(m) {
  if (m.action !== "launch") return;
  launchAa(new THREE.Vector3(+m.x || 0, +m.y || 0, +m.z || 0), new THREE.Vector3(+m.dx || 0, +m.dy || 1, +m.dz || 0), m.t || null, 1, m.eid, true);
}

function puff(at) {
  if (!puffGeo) puffGeo = new THREE.SphereGeometry(0.16, 6, 5);
  if (puffs.length >= MAX_PUFFS) { const old = puffs.shift(); old.mesh.parent?.remove(old.mesh); old.mesh.material.dispose(); }
  const mesh = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color: 0xc9c6bf, transparent: true, opacity: 0.55, depthWrite: false }));
  mesh.position.copy(at);
  game.scene.add(mesh);
  puffs.push({ mesh, t: 0 });
}

/* Every frame (streaks/air.js): fly them, trail smoke, count our hits. */
export function updateAaMissiles(dt) {
  for (const ms of missiles) {
    ms.puffT -= dt;
    if (ms.puffT <= 0) { ms.puffT = PUFF_EVERY; puff(ms.pos); }
  }
  for (let i = puffs.length - 1; i >= 0; i--) {
    const p = puffs[i];
    p.t += dt;
    const k = p.t / PUFF_LIFE;
    if (k >= 1) { p.mesh.parent?.remove(p.mesh); p.mesh.material.dispose(); puffs.splice(i, 1); continue; }
    p.mesh.scale.setScalar(1 + k * 4);
    p.mesh.material.opacity = 0.55 * (1 - k);
    p.mesh.position.y += dt * 0.4;
  }
  if (!missiles.length) return;
  for (const h of flyMissiles(missiles, dt, targetPos)) {
    game.explosionFx({ kind: "lethal", glow: 0xffc070, radius: 2.5 }, h.at);
    const ms = h.ms;
    if (!ms.mine || !h.targetId || !targetPos(h.targetId)) continue;
    const n = (hitsOn.get(h.targetId) || 0) + 1;
    hitsOn.set(h.targetId, n);
    if (n >= ms.need) { hitsOn.delete(h.targetId); shootDownAir(h.targetId, ms.owner, true); }
  }
}

/* A match over: nothing left in the air, no lock. */
export function clearLauncher() {
  clearMissiles(missiles);
  for (const p of puffs) { p.mesh.parent?.remove(p.mesh); p.mesh.material.dispose(); }
  puffs.length = 0;
  hitsOn.clear();
  Object.assign(lock, { id: null, k: 0, locked: false, need: 1 });
  if (lockEl) lockEl.hidden = true;
}

/* Tests: what's in the air. */
export const aaState = () => ({ lock: { ...lock }, missiles: missiles.length, puffs: puffs.length, hits: Object.fromEntries(hitsOn) });
