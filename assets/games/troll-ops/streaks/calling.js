// Troll Forces scorestreaks, the calling side: the meter, the picker, UAV
// and VSAT clocks, lockouts, marking a ground point, and ending a streak
// you control. Moved out of game.js (split phase 1).

import { StreakPicker } from "../streak-picker.js?v=umb1-wst-sb2-fu1";
import { StreakState, STREAK_DEFS, streaksAllowed } from "../scorestreaks.js?v=umb1-wst-sb2-fu1";
import { KillstreakUi } from "../killstreak-ui.js?v=to-medals3";
import { XP_SCALE } from "../progression.js?v=p5-wst-sb2-fu1";
import { Achievements } from "../achievements.js?v=umb1-wst-sb2-fu1";
import { VsatSatellite, BlastFx } from "../streak-entities.js?v=vsat2-hk1";
import { updateStreakHud, showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2f1";
import * as THREE from "three";
import { raycastWorld } from "../ballistics.js?v=cg1-wst-hf1-fu1b7";
import { groundHeightAt } from "../movement.js?v=umb2-sb2-gj1b7";
import { touchState } from "../input/touch.js?v=in1";
import { game } from "../core/state.js?v=st1";


export let streakPicker;

/* The local player's score meter and banked calls. Peers' meters aren't
   modelled: only the client that earned a streak calls it, and it tells
   everyone else what happened. */
export const streaks = new StreakState();

/* Medal points are real, like BO2's: they pay into the scorestreak meter
   and match XP (PvP only, same as every other mid-match XP). The splash
   shows the "+50" itself, so no XP popup here. */
export let killstreakUi;

export const achievements = new Achievements(
  (def) => killstreakUi.medal(def.name),
  (def) => killstreakUi.medal(def.name),
);

/* UAV is a team-wide reveal with a clock, so it lives as two timestamps
   rather than on `streaks` — an enemy UAV reveals us to them, not them to us,
   and both sides can have one up at once. */
export const uavUntil = { phantom: 0, ghost: 0 };

export function uavActiveFor(team) {
  return !!team && uavUntil[team] > performance.now();
}

/* Orbital VSAT (BO2): a satellite sweep that shows enemies AND which way
   they face. Its own clock, because nothing can shoot a satellite down: an
   enemy Counter-UAV still jams the minimap but leaves vsatUntil alone. */
export const vsatUntil = { phantom: 0, ghost: 0 };
export function vsatActiveFor(team) {
  return !!team && vsatUntil[team] > performance.now();
}
/* The satellite itself, crossing the sky while it's up (everyone sees it). */
export function spawnVsatSat(yaw, duration) {
  const bounds = game.builtMap?.map?.bounds || game.ARENA;
  const sat = new VsatSatellite({ bounds, yaw, duration });
  flyovers.push(sat);
  game.scene.add(sat.root);
  return sat;
}
export function startVsat(team, duration) {
  if (!team) return;
  vsatUntil[team] = Math.max(vsatUntil[team] || 0, performance.now() + duration * 1000);
}
export function vsatUp() { return vsatActiveFor(uavBucket()) && !minimapJammed(); }

/* Which bucket a UAV we call belongs in. Free-for-all has no sides to share a
   reveal with, and offline play never runs chooseTeam so `net.team` is null —
   both collapse onto the same single bucket, which is also what keeps a solo
   match against bots from calling a UAV that reveals nothing. */
export function uavBucket() {
  if (game.currentMode().ffa || !game.net.team) return "phantom";
  return game.net.team;
}

/* Whether we can currently see enemies on the minimap. An enemy
   Counter-UAV jams it, whoever's UAV is up. */
export function enemiesRevealed() {
  const team = uavBucket();
  return (uavActiveFor(team) || vsatActiveFor(team)) && !minimapJammed();
}
export function minimapJammed() { return game.jammedUntil > performance.now(); }

/* Per-streak lockouts, ms timestamps: the gunship/K9/Swarm cooldown after a call,
   and the UAV lockout an enemy Counter-UAV hands whoever's UAV it downed.
   A banked charge waits it out; nothing is lost. */
export const streakLockUntil = {};
export const streakLockWhy = {};
export function streakLockLeft(id) {
  const left = ((streakLockUntil[id] || 0) - performance.now()) / 1000;
  return left > 0 ? left : 0;
}
export function lockStreak(id, seconds, why) {
  streakLockUntil[id] = Math.max(streakLockUntil[id] || 0, performance.now() + seconds * 1000);
  streakLockWhy[id] = why;
  updateStreakHud();
}
export function clearStreakLocks() {
  for (const k of Object.keys(streakLockUntil)) delete streakLockUntil[k];
  game.jammedUntil = 0;
  game.myUavUntil = 0;
}

/* Live streak objects. Keyed by id so a net message can find the one it is
   talking about; the local player's own are flagged `owned` and are the only
   ones that decide anything. */
export const streakEntities = new Map();   // id -> CarePackage | HunterDrone | HelicopterGunship
export const pendingStrikes = [];          // AirstrikeRun: mark → jet → bombs, in game time

/* Pure flyover VFX for UAV — unlike streakEntities these decide nothing
   (uavUntil owns the reveal), so they don't need ids or wire lookups, just a
   list to age out and drop. */
export const flyovers = [];                // ReconPlane

/* Fireball + smoke column + shock ring for streak blasts (made on first use:
   the scene doesn't exist yet up here). */
export let blastFx = null;
export function streakBlast(pos, scale = 1) {
  if (!blastFx) blastFx = new BlastFx(game.scene);
  blastFx.spawn(pos, scale);
}

export function clearStreakEntities() {
  for (const e of streakEntities.values()) e.dispose();
  streakEntities.clear();
  for (const s of pendingStrikes) s.dispose();
  pendingStrikes.length = 0;
  // Flyovers used to survive the round/match reset and finish their pass
  // over the next one.
  for (const f of flyovers) f.dispose();
  flyovers.length = 0;
  blastFx?.clear();
  if (game.lockEl) game.lockEl.hidden = true;
  game.strikeTablet?.lower();
  game.markingStreak = null;
  game.selectedStreak = null;
  game.pendingDroneLaunch = null;
  game.dragonfire = null;
  game.samHitCount.clear();
  game.swarmRuns.length = 0;
  game.warship = null;
  game.syncWarshipView();
  game.droneFields.clear();   // built against this map's colliders
  if (game.streakHoldActive()) game.endStreakHold(true);
  if (game.els.streakMark) game.els.streakMark.hidden = true;
}

/* Priciest-first order. A cheap streak like UAV re-banks roughly every two
   kills, well before a pricier one like Hunter-Killer does — sorting
   cheapest-first meant the single-button call kept re-firing UAV forever and
   a banked Hunter-Killer charge never got used until UAV happened to be
   spent or deselected. Most-valuable-first means whichever streak took the
   most kills to earn is the one the button actually fires. */
export function readyStreaksOrdered() {
  return streaks.readyIds().filter((id) => !streakLockLeft(id))
    .sort((a, b) => STREAK_DEFS[b].cost - STREAK_DEFS[a].cost);
}

/* D-pad down: move the pointer to the next ready streak. Does nothing with
   none ready, per how BO2's own equipment wheel behaves — there's nothing to
   select yet. */
export function cycleSelectedStreak() {
  if (!streaksAllowed(game.currentMode()) || !game.player.alive || game.markingStreak) return;
  const ready = readyStreaksOrdered();
  if (!ready.length) { game.selectedStreak = null; updateStreakHud(); return; }
  const at = ready.indexOf(game.selectedStreak);
  game.selectedStreak = ready[(at + 1) % ready.length];
  updateStreakHud();
}

/* D-pad right: fire whatever is currently selected. Falls back to the
   priciest ready streak if the pointer is stale (its streak got spent
   elsewhere, or this is the first press with nothing cycled yet) — the
   button should never require two presses to do something the first time. */
export function useSelectedStreak() {
  if (performance.now() < game.streakCallGuardUntil && !game.markingStreak) return;
  if (!streaksAllowed(game.currentMode()) || !game.player.alive) return;
  if (game.markingStreak) { confirmMark(); return; }
  const id = streaks.ready(game.selectedStreak) ? game.selectedStreak : readyStreaksOrdered()[0];
  if (!id) return;
  callStreak(id);
}

/* Where the player is looking, on the ground. Both marking streaks land at
   this point, and it's also what shows the marker reticle. */
export function groundAimPoint(maxDist = 140) {
  const dir = new THREE.Vector3();
  game.camera.getWorldDirection(dir);
  // raycastWorld returns the distance to the first solid (maxDist if none).
  // This used to read it as a hit object, so the crosshair was never used
  // and every mark fell through to the flat-ground guess below.
  const d = raycastWorld(game.colliders, game.camera.position, dir, maxDist);
  if (d < maxDist) {
    const p = game.camera.position.clone().addScaledVector(dir, Math.max(0, d - 0.3));
    const top = groundHeightAt(game.colliders, p.x, p.z, p.y + 0.5);
    p.y = top ?? p.y;
    return p;
  }

  // Nothing solid under the crosshair. Aiming down, intersect the ground
  // plane. Aiming level or up, there is no such intersection, so drop a point
  // out in front instead — otherwise marking silently refuses whenever you
  // are looking at the horizon, which is most of the time.
  const ground = groundHeightAt(game.colliders, game.move.pos.x, game.move.pos.z, 40) ?? 0;
  if (dir.y < -1e-3) {
    const t = (ground - game.camera.position.y) / dir.y;
    if (t > 0 && t <= maxDist) return game.camera.position.clone().addScaledVector(dir, t);
  }
  const flat = new THREE.Vector3(dir.x, 0, dir.z);
  if (flat.lengthSq() < 1e-6) return null;   // straight up or straight down
  flat.normalize();
  const ahead = game.move.pos.clone().addScaledVector(flat, Math.min(30, maxDist));
  ahead.y = groundHeightAt(game.colliders, ahead.x, ahead.z, 60) ?? ground;
  return ahead;
}

/* The HUD's streak rows, in order: the loadout's picks, then anything a care
   package granted outside them. Keyboard slot i is key 4 + i. */
/* Left to right, cheapest to dearest (user, 2026-09-29), a care package's
   extra streak slotting in by its cost too; the keys (4, 5, 6...) follow. */
export function streakSlotIds() {
  return streaks.selected.concat(streaks.readyIds().filter((id) => !streaks.selected.includes(id)))
    .sort((a, b) => STREAK_DEFS[a].cost - STREAK_DEFS[b].cost);
}

/* The touch STREAK button (and nothing else now): the selected streak, which
   is the newest one earned. It used to be the priciest ready one, and that
   was the "care package deploys a hunter-killer" bug: the two are earned
   back to back (300 / 350), so with both banked, calling the package fired
   the drone. */
export function callReadyStreak() {
  if (!streaksAllowed(game.currentMode()) || !game.player.alive) return;
  if (performance.now() < game.streakCallGuardUntil && !game.markingStreak) return;

  // Already lining one up: this press is the confirm, not a new call.
  if (game.markingStreak) { confirmMark(); return; }

  const id = streaks.ready(game.selectedStreak) ? game.selectedStreak : readyStreaksOrdered()[0];
  if (!id) return;
  callStreak(id);
}

/* Keyboard 4/5/6/7 and a tap on a HUD row: that exact streak, never a guess.
   Its own key again confirms a mark; another ready streak's key drops the
   mark and calls that one instead. */
export function callStreakSlot(i) {
  if (!streaksAllowed(game.currentMode()) || !game.player.alive) return;
  if (performance.now() < game.streakCallGuardUntil && !game.markingStreak) return;
  const id = streakSlotIds()[i];
  if (!id) return;
  if (game.markingStreak) {
    if (id === game.markingStreak) { confirmMark(); return; }
    if (!streaks.ready(id)) return;
    dropMarkQuietly();
  }
  if (!streaks.ready(id)) {
    showWaveBanner(`${STREAK_DEFS[id].name} not ready`, 900);
    return;
  }
  callStreak(id);
}

/* Spend and fire a specific streak — or, for the two that need a ground
   point, enter marking instead of spending yet. Shared by the keyboard's
   single-button call and the pad's cycle-then-use pair. */
export function callStreak(id) {
  if (id === "dragonfire") {
    const why = game.dragonfireBlocked();
    if (why) {
      showWaveBanner(`DRAGONFIRE ${game.DF_BLOCK_TEXT[why]} — GET OUTSIDE`, 1600);
      return;
    }
  }
  const lock = streakLockLeft(id);
  if (lock > 0) {
    showWaveBanner(`${STREAK_DEFS[id].name} ${streakLockWhy[id] === "jammed" ? "jammed" : "cooling down"}: ${Math.ceil(lock)}s`, 1100);
    return;
  }
  // Melee in hand: it's put away first, and the call goes through once it's
  // gone (updateMeleeView). The streak hold hands back to it after.
  if (game.player.holding === "melee" && !game.meleePutAway) { game.holsterMeleeFor(id); return; }
  // The marking streaks don't spend until the point is confirmed — dying or
  // cancelling mid-mark must not eat the reward.
  if (id === "airstrike") {
    // BO2's Lightning Strike: up comes the tablet, you mark three spots on
    // the overhead map. Nothing is spent until the third is marked.
    game.markingStreak = id;
    game.cancelCook();
    updateStreakHud();
    game.beginStreakHold(0, "tablet", "strike");
    game.startTabletDive(0.95, () => { if (game.markingStreak === "airstrike") game.openStrikeTablet(); });
    return;
  }
  if (id === "carepackage") {
    // BO2: out comes the smoke marker; throwing it is what calls the drop.
    // Nothing is spent until it leaves your hand.
    game.markingStreak = id;
    game.cancelCook();
    showWaveBanner("CARE PACKAGE — THROW THE MARKER", 2000);
    updateStreakHud();   // keeps the touch button up through the mark
    game.beginStreakHold(0, "marker");
    return;
  }

  if (!streaks.spend(id)) return;
  game.cancelCook();   // a grenade in hand goes back on the belt
  game.fireStreak(id);
  // Firing clears the pointer to the next ready one, so d-pad right on a
  // controller is immediately useful again without a re-cycle.
  game.selectedStreak = readyStreaksOrdered()[0] || null;
  updateStreakHud();
}

/* Second press of the marking flow: commit to where we're looking. */
export function confirmMark() {
  const id = game.markingStreak;
  // On the tablet, the streak's own key marks the spot under the reticle.
  if (id === "airstrike") { game.strikeTablet?.place(); return; }
  if (id === "carepackage") { game.throwMarker(); return; }
  const at = groundAimPoint();
  if (!at) { showWaveBanner("No ground in sight", 1200); return; }
  if (!streaks.spend(id)) { cancelMark(); return; }
  game.markingStreak = null;
  if (game.els.streakMark) game.els.streakMark.hidden = true;
  // A beat on the tablet to "send" it, then it lowers and the gun comes up.
  game.beginStreakHold(0.35);
  game.fireStreak(id, at);
  updateStreakHud();
}

/* What to call the FIRE/confirm action in prompts. A controller player told
   to "press 4" has no 4 to press — and on a pad, firing/confirming is d-pad
   right, not the d-pad down that only cycles the selection. */
export function streakKeyLabel(id = game.markingStreak) {
  if (game.isTouch) return "STREAK";
  if (game.gamepadState.connected) return "D-pad right";
  const i = streakSlotIds().indexOf(id);
  return String(4 + Math.max(0, i));
}

/* Leave marking without the "Cancelled" banner: switching straight to
   another streak says enough on its own. */
function dropMarkQuietly() {
  game.strikeTablet?.lower();
  game.endStreakHold();
  game.markingStreak = null;
  if (game.els.streakMark) game.els.streakMark.hidden = true;
}

export function cancelMark() {
  if (!game.markingStreak) return;
  game.strikeTablet?.lower();
  game.endStreakHold(!game.player.alive);
  game.markingStreak = null;
  if (game.els.streakMark) game.els.streakMark.hidden = true;
  showWaveBanner("Cancelled", 900);
  updateStreakHud();
}

/* Reticle + prompt while a marking streak is up. */
export function updateMarking() {
  if (!game.els.streakMark) return;
  if (!game.markingStreak || !game.player.alive) {
    if (game.markingStreak && !game.player.alive) cancelMark();
    game.els.streakMark.hidden = true;
    return;
  }
  if (game.markingStreak === "airstrike") {
    // The tablet is the whole interface; no ground ring or prompt.
    game.els.streakMark.hidden = true;
    return;
  }
  // Care package: the marker is in your hand. No key hint (user call).
  game.els.streakMark.hidden = false;
  game.els.streakMark.textContent = `${STREAK_DEFS[game.markingStreak].name}: throw the marker`;
  game.els.streakMark.classList.add("is-ready");
}

/* ---- In a streak: no throwables, and hold to end it ------------------
   While you're working a streak (flying the Dragonfire, on the Warship's
   guns, lining up a Lightning Strike or holding a care package marker) or
   it's in your hands (the tablet, the whistle, the drone), your throwables
   stay on your belt (user). And any streak you're in can be ended early by
   holding one input for END_HOLD seconds: d-pad right on a pad (the streak
   button already), X on a keyboard (its "hold to act" key), the END button
   on touch. A marking streak hasn't been spent, so ending it costs nothing;
   a Dragonfire or Warship ended early is gone, like letting it time out. */
const END_HOLD = 0.8;
export const streakEnd = { t: 0, latch: false, padAt: 0, padShort: false };
let streakEndEl = null;

/* What you're in that holding can end, or null. */
export function streakControlActive() {
  if (!game.player.alive || game.gameState !== "playing") return null;
  if (game.dragonfire && game.dragonfire.owned && game.dragonfire.alive) return "dragonfire";
  if (game.warship && game.warship.owned && !game.warship.dead && game.warship.age < game.warship.duration) return "warship";
  if (game.markingStreak) return game.markingStreak;
  return null;
}

/* Anything streak-shaped in your hands or under your control. */
export function streakBusy() {
  return !!streakControlActive() || game.player.holding === "streak" || !!game.tabletDive || !!game.strikeTablet?.isOpen;
}

export function endActiveStreak() {
  const what = streakControlActive();
  if (!what) return;
  game.tabletDive = null;
  if (what === "dragonfire") {
    // Expires on the next tick: the owner loop tells the room and drops it.
    game.dragonfire.duration = Math.min(game.dragonfire.duration, game.dragonfire.age);
    game.endStreakHold(true);
    showWaveBanner("DRAGONFIRE ENDED", 1200);
  } else if (what === "warship") {
    game.warship.duration = Math.min(game.warship.duration, game.warship.age);
    if (game.net.active) game.net.publishStreak({ kind: "warship", action: "leave", eid: game.warship.id });
    game.endStreakHold(true);
    showWaveBanner("VTOL WARSHIP ENDED", 1200);
  } else {
    cancelMark();
  }
  game.audio.reload();
  updateStreakHud();
}

function streakEndKeyLabel() {
  if (game.isTouch) return "END";
  if (game.gamepadState.connected) return "\u2192";   // d-pad right
  return "X";
}

function streakEndHudEl() {
  if (streakEndEl) return streakEndEl;
  streakEndEl = document.createElement("div");
  streakEndEl.className = "to-ss-endhold";
  streakEndEl.hidden = true;
  streakEndEl.setAttribute("aria-live", "polite");
  streakEndEl.innerHTML = `<span class="to-ss-endhold-k"></span><span class="to-ss-endhold-t"></span><i class="to-ss-endhold-bar"><b></b></i>`;
  (game.els.streakMark?.parentElement || document.body).appendChild(streakEndEl);
  return streakEndEl;
}

/* Once a frame: the hold toward ending, its prompt, and the throwables
   greying out while a streak is busy. */
export function updateStreakControl(dt) {
  const what = streakControlActive();
  const held = !!what && !game.localPauseOnly && (game.keys.has("KeyX") || (game.gamepadState.connected && game.gamepadState.endStreak) || (game.isTouch && touchState.endStreak));
  if (!held) streakEnd.latch = false;
  if (held && !streakEnd.latch) {
    streakEnd.t += dt;
    if (streakEnd.t >= END_HOLD) {
      streakEnd.t = 0;
      streakEnd.latch = true;   // let go before the next one can end
      streakEnd.padShort = false;
      endActiveStreak();
    }
  } else streakEnd.t = Math.max(0, streakEnd.t - dt * 3);

  document.body.classList.toggle("to-streak-busy", streakBusy());
  if (streaks.ready("dragonfire")) updateStreakHud();   // the open-sky tag (the signature skips a no-op)
  if (game.els.touchEndStreak) game.els.touchEndStreak.hidden = !game.isTouch || !what;
  if (game.els.touchEndStreak) game.els.touchEndStreak.style.setProperty("--p", (streakEnd.t / END_HOLD).toFixed(3));

  const el = streakEndHudEl();
  // Touch has the END button itself; the prompt is for keys and pads.
  const show = !!what && !game.isTouch;
  el.hidden = !show;
  if (!show) return;
  const name = what === "dragonfire" ? "Dragonfire" : what === "warship" ? "VTOL Warship" : STREAK_DEFS[what]?.name || "streak";
  el.querySelector(".to-ss-endhold-k").textContent = streakEndKeyLabel();
  el.querySelector(".to-ss-endhold-t").textContent = `Hold to ${STREAK_DEFS[what] && what === game.markingStreak ? "cancel" : "end"} ${name}`;
  el.style.setProperty("--p", (streakEnd.t / END_HOLD).toFixed(3));
  el.classList.toggle("is-holding", streakEnd.t > 0.02);
}

/* What used to run at load in game.js: called from game.js where this code was. */
export function initStreakCalling() {
  // -------------------- scorestreaks --------------------

  streakPicker = new StreakPicker({ picker: game.els.ssPicker, count: game.els.ssCount }, null,
    (id) => { if (game.activeLobbyPanel === "streaks") game.inspector?.showStreak(id); });

  /* Medal points are real, like BO2's: they pay into the scorestreak meter
     and match XP (PvP only, same as every other mid-match XP). The splash
     shows the "+50" itself, so no XP popup here. */
  killstreakUi = new KillstreakUi(
    { badges: game.els.ksBadges, banner: game.els.ksBanner, screenPulse: game.els.screenPulse },
    {
      onPoints: (pts) => {
        if (game.isPvp()) game.player.matchXp += Math.round(pts * XP_SCALE);
        game.awardScore(pts);
      },
      onSting: (metal) => game.audio.medal(metal),
    },
  );
}
