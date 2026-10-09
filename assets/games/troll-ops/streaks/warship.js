// Troll Forces VTOL Warship: riding its guns, the thermal feed, rounds
// landing. Moved out of game.js (split phase 1).

import { touchState } from "../input/touch.js?v=in1";
import { WARSHIP_GUNS, VtolWarship } from "../streak-entities.js?v=vsat2-hk1";
import { streakBounds, round2 } from "./fire.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1";
import { STREAK_DEFS } from "../scorestreaks.js?v=umb1-wst-sb2-fu1-wb1";
import { streakEntities, streakBlast } from "./calling.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1";
import * as THREE from "three";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1";
import { raycastWorld } from "../ballistics.js?v=cg1-wst-hf1-fu1b7-wb1";
import { WEAPON_DEFS } from "../weapons.js?v=p5bm-wst-hf1-fu1-wb1";
import { K9Pack } from "../k9-unit.js?v=k9c-bs1-sb2-gj1b7b7d";
import { k9Hostile } from "./k9.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1";
import { game } from "../core/state.js?v=st1";

let wsViewOn = false, wsSaved = null, wsStable = false, wsHud = null;
export const WARSHIP_BOARD_AT = 1.3;   // the tablet call, then you're in the gunner's seat

export function warshipView() {
  return !!game.warship && !game.warship.dead && game.player.alive && game.warship.age >= WARSHIP_BOARD_AT && game.warship.age < game.warship.duration;
}
/* Look sensitivity on the warship's gun (user: needs to be low): a third of
   your normal aim, and lower still the more the gun zooms in. Mouse, stick
   and touch alike. */
const WARSHIP_SENS = 0.35;
export function lookSensScale() {
  if (!warshipView()) return 1;
  return WARSHIP_SENS * Math.min(1, warshipFov() / game.baseFov);
}
/* The aim button zooms the gunner's optic in further (user: let AIM work on
   the 25mm). Same inputs as ADS on foot: AIM toggle, L2, right mouse, Q. */
const WARSHIP_AIM_ZOOM = 0.5;
function warshipAiming() {
  return warshipView() && ((game.isTouch && touchState.ads) || (game.gamepadState.connected && game.gamepadState.ads) || game.adsHeld || game.keys.has("KeyQ"));
}
export function warshipFov() {
  return (WARSHIP_GUNS[game.warshipGun]?.fov || game.baseFov) * (warshipAiming() ? WARSHIP_AIM_ZOOM : 1);
}

export function spawnWarship({ id, seed, owned, team }) {
  const ws = new VtolWarship({ id, owned, bounds: streakBounds(), seed, team, duration: STREAK_DEFS.warship.duration });
  streakEntities.set(id, ws);
  game.scene.add(ws.root);
  game.audio.wave();
  return ws;
}

/* The gunner's thermal feed: a black-hot-white filter on the world, a
   reticle, the gun readout and a box on every troll down there. */
function warshipHudEl() {
  if (wsHud) return wsHud;
  wsHud = document.createElement("div");
  wsHud.className = "to-ws";
  wsHud.hidden = true;
  wsHud.setAttribute("aria-hidden", "true");
  wsHud.innerHTML = `<div class="to-ws-marks"></div><div class="to-ws-scan"></div>
<div class="to-ws-reticle"><i></i><i></i><i></i><i></i><b></b></div>
<div class="to-ws-top"><strong>VTOL WARSHIP</strong><span class="to-ws-time"></span></div>
<div class="to-ws-guns"><span data-g="chain">25MM</span><span data-g="cannon">105MM</span><em class="to-ws-hint"></em></div>
<div class="to-ws-reload"><i></i></div>`;
  // Touch has no 1/2 keys: tap a gun's label to switch to it (it was
  // impossible to swap guns on a phone; the swap button is the END hold there).
  for (const s of wsHud.querySelectorAll(".to-ws-guns span")) {
    s.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (warshipView() && s.dataset.g !== game.warshipGun) toggleWarshipGun();
    });
  }
  (game.els.streakMark?.parentElement || document.body).appendChild(wsHud);
  return wsHud;
}

export function syncWarshipView() {
  // Killed on the ground: the ride is over, and the warship heads home.
  if (game.warship && !game.player.alive && game.warship.age < game.warship.duration) {
    game.warship.duration = Math.max(WARSHIP_BOARD_AT, game.warship.age);
    if (game.net.active) game.net.publishStreak({ kind: "warship", action: "leave", eid: game.warship.id });
  }
  const on = warshipView();
  if (on === wsViewOn) return;
  wsViewOn = on;
  const el = warshipHudEl();
  el.hidden = !on;
  game.renderer.domElement.style.filter = on ? "grayscale(1) contrast(1.5) brightness(1.12)" : "";
  document.body.classList.toggle("to-in-warship", on);
  if (on) {
    wsSaved = { yaw: game.look.yaw, pitch: game.look.pitch };
    wsStable = false;
    // Start looking at the middle of the map.
    const at = game.warship.gunnerPos(new THREE.Vector3());
    const dx = game.warship.centre.x - at.x, dz = game.warship.centre.z - at.z;
    game.look.yaw = Math.atan2(-dx, -dz);
    game.look.pitch = Math.atan2(-at.y, Math.hypot(dx, dz));
    el.querySelector(".to-ws-hint").textContent = game.isTouch ? "SWAP to change gun · AIM to zoom" : game.gamepadState.connected ? "Y changes gun · L2 zooms" : "1 / 2 or scroll changes gun · right click zooms";
    showWaveBanner("VTOL WARSHIP — YOU HAVE THE GUNS", 1600);
  } else {
    if (wsSaved) { game.look.yaw = wsSaved.yaw; game.look.pitch = wsSaved.pitch; }
    wsSaved = null;
    if (game.player.alive && game.warship) showWaveBanner("WARSHIP LEAVING", 1200);
  }
}

const _wsDir = new THREE.Vector3();
const _wsP = new THREE.Vector3();
/* The gunner's camera: rides the gun deck, and holds the ground point under
   the crosshair still while the ship circles (a stabilised gimbal), so
   aiming is about the target, not about fighting the orbit. */
export function placeWarshipCamera() {
  game._euler.set(game.look.pitch, game.look.yaw, 0);
  _wsDir.set(0, 0, -1).applyEuler(game._euler);
  let held = false;
  if (wsStable && _wsDir.y < -0.02) {
    const t = (0 - game.camera.position.y) / _wsDir.y;
    _wsP.copy(game.camera.position).addScaledVector(_wsDir, t);
    held = true;
  }
  game.warship.gunnerPos(game.camera.position);
  if (held) {
    const dx = _wsP.x - game.camera.position.x, dy = _wsP.y - game.camera.position.y, dz = _wsP.z - game.camera.position.z;
    game.look.yaw = Math.atan2(-dx, -dz);
    game.look.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  }
  game.look.pitch = Math.max(-1.52, Math.min(-0.1, game.look.pitch));
  wsStable = true;
  game._euler.set(game.look.pitch, game.look.yaw, 0);
  game.camera.quaternion.setFromEuler(game._euler);
}

export function toggleWarshipGun() {
  game.warshipGun = game.warshipGun === "chain" ? "cannon" : "chain";
  game.audio.reload();
}

export function fireWarship() {
  const ws = game.warship;
  const g = WARSHIP_GUNS[game.warshipGun];
  if (!ws.tryFire(game.warshipGun)) return;
  const dir = game.camera.getWorldDirection(new THREE.Vector3());
  if (g.spread) {
    dir.x += (Math.random() - 0.5) * g.spread * 2;
    dir.y += (Math.random() - 0.5) * g.spread * 2;
    dir.z += (Math.random() - 0.5) * g.spread * 2;
    dir.normalize();
  }
  const from = game.camera.position;
  let d = raycastWorld(game.colliders, from, dir, 480);
  if (dir.y < -1e-3) d = Math.min(d, (0 - from.y) / dir.y);
  const to = from.clone().addScaledVector(dir, d);
  ws.shoot(game.warshipGun, to);
  if (game.net.active) {
    game.net.publishStreak({ kind: "warship", action: "shot", eid: ws.id, g: game.warshipGun, x: round2(to.x), y: round2(to.y), z: round2(to.z) });
  }
  if (game.warshipGun === "cannon") {
    game.audio.explosion(0.35);
    game.shakeMag = Math.max(game.shakeMag, 0.035); game.shakeT = 0.25;
  } else {
    game.audio.shot(WEAPON_DEFS.bellow || WEAPON_DEFS.problem416, 0.45);
  }
}

/* A round landing. Everyone sees it; only the gunner's copy hurts anyone. */
export function warshipImpact(ws, r) {
  const g = WARSHIP_GUNS[r.gun];
  if (r.gun === "cannon") {
    game.explosionFx({ kind: "lethal", glow: 0xffb347, radius: g.radius }, r.to);
    streakBlast(r.to, 1.1);
    game.impactFx.hit(r.to, { normal: new THREE.Vector3(0, 1, 0), surface: "ground", scale: 4 });
  } else {
    game.impactFx.hit(r.to, { normal: new THREE.Vector3(0, 1, 0), surface: "ground", scale: 1.8 });
    game.spawnImpactBurst(r.to, 0xffc46a, 6);
    if (Math.random() < 0.35) game.audio.impact(r.to);
  }
  if (ws.owned) {
    game.areaDamage(r.to, g.radius, g.damage,
      { id: "warship", radius: g.radius, minDamage: g.damage * 0.25, selfMult: 0 },
      { creditAs: "warship", botId: ws.botId || null });
  }
}

const _wsProj = new THREE.Vector3();
export function updateWarshipHud() {
  if (!wsViewOn || !wsHud) return;
  const g = WARSHIP_GUNS[game.warshipGun];
  wsHud.querySelector(".to-ws-time").textContent = `${Math.max(0, Math.ceil(game.warship.duration - game.warship.age))}s`;
  for (const s of wsHud.querySelectorAll(".to-ws-guns span")) s.classList.toggle("is-on", s.dataset.g === game.warshipGun);
  const cool = game.warship.fireT / g.interval;
  wsHud.querySelector(".to-ws-reload i").style.width = `${Math.round((1 - Math.min(1, cool)) * 100)}%`;
  wsHud.classList.toggle("is-cannon", game.warshipGun === "cannon");
  // Boxes on everyone: red for the enemy, blue for your side, and you.
  const marks = wsHud.querySelector(".to-ws-marks");
  const host = wsHud.getBoundingClientRect();
  const ffa = !!game.currentMode().ffa;
  const list = [];
  for (const rp of game.remotes.byId.values()) {
    if (!rp.alive) continue;
    list.push({ pos: rp.pos, kind: !ffa && game.net.team && rp.team === game.net.team ? "friend" : "foe" });
  }
  for (const e of streakEntities.values()) {
    if (e instanceof K9Pack && k9Hostile(e)) for (const d of e.dogs) if (d?.alive) list.push({ pos: d.pos, kind: "foe dog" });
  }
  list.push({ pos: game.move.pos, kind: "you" });
  while (marks.children.length < list.length) marks.appendChild(document.createElement("i"));
  [...marks.children].forEach((m, i) => {
    const it = list[i];
    if (!it) { m.hidden = true; return; }
    _wsProj.set(it.pos.x, it.pos.y + 0.9, it.pos.z).project(game.camera);
    const vis = _wsProj.z < 1 && Math.abs(_wsProj.x) < 1.05 && Math.abs(_wsProj.y) < 1.05;
    m.hidden = !vis;
    if (!vis) return;
    m.className = `is-${it.kind.replace(" ", " is-")}`;
    m.style.transform = `translate(${((_wsProj.x + 1) / 2) * host.width}px, ${((1 - _wsProj.y) / 2) * host.height}px)`;
  });
}
