// Troll Forces — the Tactical Nuke (TACTICAL-NUKE doc, phase 1: earn and
// call). Never picked in the lobby and never in the streak slots: the only
// way to get one is the Nuclear medal, 25 kills without dying, in Team
// Deathmatch or Free-for-All. Dying keeps it; one per player per match.
//
// Calling it raises the handheld (nuke-device.js) for 2.4 s: the screen
// boots, the thumb flips the safety cover and presses the key, and the
// nuke is ARMED. One `nuke` message goes out on the streak channel and
// every client runs the same 10 s countdown off it: banner, counter,
// siren, a red pulse and the sky going orange-red. The match keeps going
// through it. Phase 2 owns what happens at zero (missile, flash, the end).

import { game } from "../core/state.js?v=st1";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5";
import { beginStreakHold } from "./hold.js?v=sh1-if1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-cl1-bp1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1";
import { killstreakUi } from "./calling.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5";
import { buildNukeDevice } from "./nuke-device.js?v=tn1";
import { medalDef, medalIcon } from "../progression/medals.js?v=to-medals3-or1";
import { skyMat } from "../view/sky.js?v=sr1";
import * as THREE from "three";

export const NUKE = {
  countdown: 10,   // seconds from ARMED to zero
  hold: 2.4,       // the handheld's whole raise, press and lower
  armAt: 1.6,      // seconds into the hold the key goes down
};

/* ready: banked and not yet called. used: this player's one nuke is spent.
   calling: the handheld is up and the key not pressed yet. inbound: the
   countdown everyone is watching ({ who, team, id, t0 }). */
export const nuke = { ready: false, used: false, calling: false, inbound: null };

export function nukeModeOk(mode = game.currentMode()) {
  return mode?.id === "tdm" || mode?.id === "ffa";
}

/* Seconds left on the countdown, or null when none is running. */
export function nukeLeft() {
  if (!nuke.inbound) return null;
  return NUKE.countdown - (performance.now() - nuke.inbound.t0) / 1000;
}

let device = null;
/* The handheld, built on first use and parented to the viewmodel rig. */
export function nukeDevice() {
  if (!device) {
    device = buildNukeDevice();
    device.visible = false;
    game.weaponRig.add(device);
  }
  return device;
}

function keyLabel() {
  if (game.isTouch) return "Tap";
  if (game.gamepadState?.connected) return "Hold →";
  return "N";
}

/* The Nuclear medal just landed for us (combat/scoring.js). */
export function grantNuke() {
  if (!nukeModeOk() || nuke.ready || nuke.used) return;
  nuke.ready = true;
  renderReady();
  killstreakUi.banner({ title: "TACTICAL NUKE READY", sub: `${keyLabel()} to call it in`, label: "Nuclear", tone: "red" });
}

/* N, the touch row, or a held d-pad right. True when the call started. */
export function callNuke() {
  if (!nuke.ready || nuke.calling || nuke.inbound) return false;
  if (!game.player.alive || game.gameState !== "playing") return false;
  if (game.player.holding === "streak" || game.markingStreak) return false;
  // A melee weapon in hand is put away first, then the call goes through.
  if (game.player.holding === "melee" && !game.meleePutAway) { game.holsterMeleeThen(() => callNuke()); return true; }
  game.cancelCook();
  nuke.calling = true;
  beginStreakHold(NUKE.hold, "nuke");
  if (game.player.holding !== "streak") { nuke.calling = false; return false; }
  game.audio.reload();
  return true;
}

/* The key went down. Spent here, not at the call: dying with the handheld
   up keeps it for later. */
function arm() {
  nuke.calling = false;
  if (nuke.inbound) { showWaveBanner("A NUKE IS ALREADY INBOUND", 1400); return; }
  nuke.ready = false;
  nuke.used = true;
  renderReady();
  nukeBeep(1);
  const who = game.net.name || "You";
  const team = game.currentMode().ffa ? null : (game.net.team || "phantom");
  startInbound({ who, team, id: game.net.id || "me", mine: true });
  if (game.net.active) game.net.publishStreak({ kind: "nuke", action: "arm", who, team });
}

/* Someone else armed one (streaks/bot-streaks.js applyRemoteStreak). The
   first one heard wins; a second is ignored. */
export function applyRemoteNuke(m) {
  if (m.action !== "arm" || nuke.inbound || game.gameState !== "playing") return;
  startInbound({ who: m.who || "Someone", team: m.team || null, id: m.id || null, mine: false });
}

function startInbound(info) {
  nuke.inbound = { ...info, t0: performance.now(), lastSec: NUKE.countdown + 1, sky: saveSky() };
  const el = ensureOverlay();
  el.root.hidden = false;
  el.tint.hidden = false;
  el.from.textContent = info.mine ? "from you" : `from ${info.who}`;
  el.count.textContent = String(NUKE.countdown);
  killstreakUi.pulse();
}

/* Every frame, from the streak tick (streaks/air.js). */
export function updateNuke() {
  if (nuke.calling) {
    const holding = game.player.holding === "streak" && game.streakDeviceKind === "nuke";
    if (!holding || !game.player.alive) nuke.calling = false;
    else if (game.streakHoldElapsed >= NUKE.armAt) arm();
  }
  if (!nuke.inbound) return;
  if (game.gameState !== "playing") { clearInbound(); return; }
  const left = nukeLeft();
  const sec = Math.max(0, Math.ceil(left));
  const el = ensureOverlay();
  if (sec !== nuke.inbound.lastSec) {
    nuke.inbound.lastSec = sec;
    el.count.textContent = String(sec);
    el.count.classList.remove("is-tick");
    void el.count.offsetWidth;
    el.count.classList.add("is-tick");
    if (sec > 0) nukeSiren();
    if (sec > 0 && sec <= 5) nukeBeep(0);
  }
  tintSky(Math.min(1, 1 - left / NUKE.countdown));
  if (left <= 0) detonate();
}

/* Zero. Phase 2 puts the missile, the flash, everyone dying and the match
   end here; until then the countdown just closes with a white flash. */
function detonate() {
  game.blindT = Math.max(game.blindT || 0, 1.2);
  clearInbound();
}

function clearInbound() {
  if (nuke.inbound?.sky) restoreSky(nuke.inbound.sky);
  nuke.inbound = null;
  if (overlay) { overlay.root.hidden = true; overlay.tint.hidden = true; }
}

/* New match, the end screen, leaving: nothing carries over. */
export function resetNuke() {
  clearInbound();
  nuke.ready = false;
  nuke.used = false;
  nuke.calling = false;
  renderReady();
}

// ---- HUD: the banked row, the countdown, the tint

let readyEl = null;
function renderReady() {
  const hud = document.getElementById("to-hud");
  if (!hud) return;
  if (!readyEl) {
    readyEl = document.createElement("div");
    readyEl.className = "to-nuke-ready";
    readyEl.hidden = true;
    readyEl.innerHTML = `<i class="to-nuke-ready-icon" aria-hidden="true"></i><span><b>TACTICAL NUKE</b><kbd></kbd></span>`;
    readyEl.querySelector("i").innerHTML = medalIcon(medalDef("Nuclear"));
    // Touch: tap the row to call it, like the streak rows.
    readyEl.addEventListener("touchstart", (e) => { e.preventDefault(); e.stopPropagation(); callNuke(); }, { passive: false });
    hud.appendChild(readyEl);
  }
  readyEl.hidden = !nuke.ready;
  readyEl.querySelector("kbd").textContent = keyLabel();
  if (game.isTouch) { readyEl.setAttribute("role", "button"); readyEl.setAttribute("aria-label", "Call in the Tactical Nuke"); }
}

let overlay = null;
function ensureOverlay() {
  if (overlay) return overlay;
  const parent = document.getElementById("to-hud")?.parentElement || document.body;
  const tint = document.createElement("div");
  tint.className = "to-nuke-tint";
  tint.hidden = true;
  tint.setAttribute("aria-hidden", "true");
  const root = document.createElement("div");
  root.className = "to-nuke";
  root.hidden = true;
  root.setAttribute("role", "alert");
  root.innerHTML = `<div class="to-nuke-banner"><b>TACTICAL NUKE INBOUND</b><span></span></div><div class="to-nuke-count"></div>`;
  parent.append(tint, root);
  overlay = { root, tint, from: root.querySelector(".to-nuke-banner span"), count: root.querySelector(".to-nuke-count") };
  return overlay;
}

// ---- the sky goes orange-red over the countdown

const SKY_KEYS = ["uTop", "uHorizon", "uBottom", "uCloudColor", "uCloudShade"];
const SKY_TO = { uTop: 0x5a1408, uHorizon: 0xff6a1e, uBottom: 0x3a1206, uCloudColor: 0xff9a52, uCloudShade: 0x6a2410 };
const _c = new THREE.Color();
function saveSky() {
  const out = {};
  for (const k of SKY_KEYS) out[k] = skyMat.uniforms[k].value.clone();
  return out;
}
function tintSky(k) {
  const base = nuke.inbound?.sky;
  if (!base) return;
  const e = k * k * (3 - 2 * k);
  for (const key of SKY_KEYS) skyMat.uniforms[key].value.copy(base[key]).lerp(_c.set(SKY_TO[key]), e * 0.85);
}
function restoreSky(base) {
  for (const k of SKY_KEYS) skyMat.uniforms[k].value.copy(base[k]);
}

// ---- sound: synthesised for now; the Pixabay alarm clip replaces it once
// the clip loader lands (drop cinematic doc, Sound).

function nukeSiren() {
  const a = game.audio;
  if (!a?._ready?.()) return;
  a._tone({ freq: 440, to: 880, duration: 0.5, gain: 0.05, type: "sawtooth" });
  a._tone({ freq: 880, to: 440, duration: 0.45, gain: 0.05, type: "sawtooth", delay: 0.5 });
}
function nukeBeep(armed) {
  const a = game.audio;
  if (!a?._ready?.()) return;
  if (armed) for (const d of [0, 0.12]) a._tone({ freq: 1320, duration: 0.08, gain: 0.08, type: "square", delay: d });
  else a._tone({ freq: 1000, duration: 0.12, gain: 0.07, type: "square", delay: 0.6 });
}
