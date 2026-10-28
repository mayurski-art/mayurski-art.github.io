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
import { playSfx, preloadSfx } from "../sound/sfx-files.js?v=dc4";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1";
import { beginStreakHold, endStreakHold } from "./hold.js?v=sh1-if1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-cl1-bp1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1";
import { killstreakUi } from "./calling.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-fs1-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ls4-gb4-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1";
import { buildNukeDevice } from "./nuke-device.js?v=tn1";
import { NukeBlast, MISSILE_TIME } from "./nuke-blast.js?v=tn2";
import { streakBounds } from "./fire.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-fs1-ut1-gf1-tg1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ls4-gb4-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1";
import { medalDef, medalIcon } from "../progression/medals.js?v=to-medals3-or1";
import { skyMat } from "../view/sky.js?v=sr1-ss1-ss2-ss3-tfm2";
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
  preloadSfx();   // the alarm, missile and blast clips, in before the call
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
  preloadSfx();
  nuke.inbound = { ...info, t0: performance.now(), lastSec: NUKE.countdown + 1, sky: saveSky() };
  const el = ensureOverlay();
  el.root.hidden = false;
  el.tint.hidden = false;
  el.from.textContent = info.mine ? "from you" : `from ${info.who}`;
  el.count.textContent = String(NUKE.countdown);
  killstreakUi.pulse();
}

/* A countdown is running or the blast is playing out: the match can't end
   any other way now (combat/scoring.js holds the score limit and clock). */
export function nukeInbound() { return !!nuke.inbound; }

/* Every frame, from the streak tick (streaks/air.js). */
export function updateNuke(dt = 0) {
  if (nuke.calling) {
    const holding = game.player.holding === "streak" && game.streakDeviceKind === "nuke";
    if (!holding || !game.player.alive) nuke.calling = false;
    else if (game.streakHoldElapsed >= NUKE.armAt) arm();
  }
  const ib = nuke.inbound;
  if (!ib) return;
  if (game.gameState !== "playing") { clearInbound(); return; }
  const left = nukeLeft();
  const t = -left;                       // seconds past zero
  if (!ib.gone) {
    const sec = Math.max(0, Math.ceil(left));
    const el = ensureOverlay();
    if (sec !== ib.lastSec) {
      ib.lastSec = sec;
      el.count.textContent = String(sec);
      el.count.classList.remove("is-tick");
      void el.count.offsetWidth;
      el.count.classList.add("is-tick");
      if (sec > 0) nukeSiren();
      if (sec > 0 && sec <= 5) nukeBeep(0);
    }
    tintSky(Math.min(1, 1 - left / NUKE.countdown) * 0.85);
  }
  // The missile is in the air for the last three seconds.
  if (!ib.blast && left <= MISSILE_TIME) {
    ib.blast = buildBlast(ib);
    missileSound();
  }
  if (!ib.gone && left <= 0) detonate(ib);
  ib.blast?.update(t, dt);
  if (ib.gone) afterglow(ib, t);
}

/* Where it lands and where the missile comes from: the map's middle, and a
   bearing hashed from the caller, so every client builds the same blast. */
function buildBlast(ib) {
  const b = streakBounds();
  const center = new THREE.Vector3((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
  const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2;
  let h = 2166136261;
  for (const c of String(ib.id || ib.who)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const seed = h >>> 0;
  ib.center = center;
  ib.span = span;
  return new NukeBlast(game.scene, { center, span, yaw: (seed % 6283) / 1000, seed });
}

/* Zero: the flash, and everyone in the match is gone. Nobody moves, shoots
   or respawns; the HUD goes; the nuke's cameras take over until the end
   screen. Each client does this for itself off the same clock. */
function detonate(ib) {
  ib.gone = true;
  if (overlay) { overlay.root.hidden = true; overlay.tint.hidden = true; }
  game.blindT = Math.max(game.blindT || 0, 1.6);
  game.shakeMag = Math.max(game.shakeMag || 0, 0.12);
  game.shakeT = Math.max(game.shakeT || 0, 1.4);
  blastSound();
  // The eye the first shot looks from, before anything moves.
  ib.eye = game.camera.position.clone();
  // Us: down for good (no respawn, no killcam, no death card).
  if (game.player.holding === "streak") endStreakHold(true);
  game.cancelCook();
  game.killcam?.cancel?.();
  game.player.alive = false;
  game.respawnT = 1e9;
  if (game.els.respawn) game.els.respawn.hidden = true;
  game.els.deathfade?.classList.remove("is-dead");
  game.els.killcamBars?.classList.remove("is-on");
  game.els.hud.hidden = true;
  game.setTouchControls?.(false);
  // Everyone else: vaporised where they stood. The host's bots stop dead.
  if (game.bots) game.bots.frozen = true;
  for (const rp of game.remotes?.byId?.values?.() || []) {
    const p = rp.rig?.root?.visible ? rp.rig.root.position : null;
    if (p) game.spawnImpactBurst(new THREE.Vector3(p.x, p.y + 1, p.z), 0x3a2a22, 14);
  }
  vaporise();
}

/* Keep every troll hidden: the remote renderer shows them again each frame. */
function vaporise() {
  for (const rp of game.remotes?.byId?.values?.() || []) {
    if (rp.rig?.root) rp.rig.root.visible = false;
    if (rp.tag) rp.tag.visible = false;
  }
  if (game.localRig?.root) game.localRig.root.visible = false;
}

const NUKE_END = 12;   // seconds from zero to the end screen
let whiteEl = null;
function afterglow(ib, t) {
  vaporise();
  // The sky burns down to a dark orange, the fog with it.
  tintSky(0.85 + 0.15 * Math.min(1, t / 2));
  if (game.scene.fog) {
    if (!ib.fog) ib.fog = game.scene.fog.color.clone();
    game.scene.fog.color.copy(ib.fog).lerp(_c.set(0x6a2a12), Math.min(1, t / 3) * 0.8);
  }
  // The second whiteout: slow, from 9 s to the end screen.
  if (!whiteEl) {
    whiteEl = document.createElement("div");
    whiteEl.className = "to-nuke-white";
    whiteEl.setAttribute("aria-hidden", "true");
    (document.getElementById("to-hud")?.parentElement || document.body).appendChild(whiteEl);
  }
  whiteEl.hidden = false;
  whiteEl.style.opacity = String(Math.max(0, Math.min(1, (t - 9) / 2.6)));
  if (t >= NUKE_END && !ib.ended) endByNuke(ib);
}

/* The end screen, the winner fixed by the nuke: the caller's side, or the
   caller in Free-for-All. The scores stand as they were. */
function endByNuke(ib) {
  ib.ended = true;
  const ffa = !!game.currentMode().ffa;
  const won = ffa ? !!ib.mine : ib.team === (game.net.team || "phantom");
  const title = ib.mine ? "You went nuclear" : `${ib.who} went nuclear`;
  // The caller tells the room too, so anyone who missed the countdown ends
  // the same way (combat/scoring.js onRoomEnd reads `nk`).
  if (ib.mine && game.net.active) {
    game.net.send({ t: "end", id: game.net.id, w: title.replace(/^You/, game.net.name), mode: game.modeId, map: game.loadedMapId, nk: { id: game.net.id, team: ib.team } });
  }
  game.endMatch(title, { won });
}

/* combat/scoring.js onRoomEnd: someone's nuke ended the match. */
export function nukeWonFor(nk) {
  if (!nk) return null;
  return game.currentMode().ffa ? nk.id === game.net.id : nk.team === (game.net.team || "phantom");
}

// ---- the nuke's cameras (view/player-update.js asks every frame)

export function nukeCineOn() { return !!nuke.inbound?.gone; }

const _look = new THREE.Vector3(), _from = new THREE.Vector3(), _dir = new THREE.Vector3();
/* 0-1.5 s: from your own eye, shaking, turned to the blast. 1.5-8 s: a wide
   fixed shot from the map's edge on your side, the cloud climbing. 8-12 s:
   a slow push in on the cap as it all goes white. */
export function placeNukeCamera(camera) {
  const ib = nuke.inbound;
  if (!ib?.blast) return;
  const t = -nukeLeft();
  const blast = ib.blast;
  blast.focus(t, _look);
  if (t < 1.5) {
    _from.copy(ib.eye);
    const sk = Math.max(0, 1 - t / 1.5) * 0.25;
    _look.y = Math.min(_look.y, ib.eye.y + 25);
    camera.position.copy(_from).add(_dir.set((Math.random() - 0.5) * sk, (Math.random() - 0.5) * sk, (Math.random() - 0.5) * sk));
    camera.lookAt(_look);
    return;
  }
  _dir.set(ib.eye.x - ib.center.x, 0, ib.eye.z - ib.center.z);
  if (_dir.lengthSq() < 1) _dir.set(0, 0, 1);
  _dir.normalize();
  const far = ib.span + 72 * blast.S;   // past the map, so the whole cloud fits
  const push = t < 8 ? 0 : Math.min(1, (t - 8) / 4);
  const ease = push * push * (3 - 2 * push);
  const drift = (t - 1.5) * 0.012;
  const ca = Math.cos(drift), sa = Math.sin(drift);
  const dx = _dir.x * ca - _dir.z * sa, dz = _dir.x * sa + _dir.z * ca;
  const dist = far * (1 - 0.35 * ease);
  camera.position.set(ib.center.x + dx * dist, (20 + 10 * ease) * blast.S, ib.center.z + dz * dist);   // up over the walls
  _look.y += 8 * ease * blast.S;
  camera.lookAt(_look);
}

function clearInbound() {
  const ib = nuke.inbound;
  ib?.alarm?.stop(0.2);
  if (ib?.sky) restoreSky(ib.sky);
  if (ib?.fog && game.scene.fog) game.scene.fog.color.copy(ib.fog);
  ib?.blast?.dispose();
  nuke.inbound = null;
  if (game.bots) game.bots.frozen = false;
  if (overlay) { overlay.root.hidden = true; overlay.tint.hidden = true; }
  if (whiteEl) { whiteEl.hidden = true; whiteEl.style.opacity = "0"; }
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
const SKY_TO = { uTop: 0x5a1408, uHorizon: 0xff6a1e, uBottom: 0x9a4a22, uCloudColor: 0xff9a52, uCloudShade: 0x6a2410 };
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
  for (const key of SKY_KEYS) skyMat.uniforms[key].value.copy(base[key]).lerp(_c.set(SKY_TO[key]), e);
}
function restoreSky(base) {
  for (const k of SKY_KEYS) skyMat.uniforms[k].value.copy(base[k]);
}

// ---- sound: the Pixabay clips (sound/sfx-files.js), each with its synth
// version for when the clip isn't in yet.

/* The alarm: one long clip looped through the countdown (stopped at zero),
   or the synth wail once a second. */
function nukeSiren() {
  const a = game.audio;
  if (!a?._ready?.()) return;
  const ib = nuke.inbound;
  if (ib && !ib.alarm) ib.alarm = playSfx("nuke-alarm", { gain: 0.55, loop: true }) || null;
  if (ib?.alarm) return;
  a._tone({ freq: 440, to: 880, duration: 0.5, gain: 0.05, type: "sawtooth" });
  a._tone({ freq: 880, to: 440, duration: 0.45, gain: 0.05, type: "sawtooth", delay: 0.5 });
}
/* The missile coming in: a long rising tear, then the hit. */
function missileSound() {
  const a = game.audio;
  if (!a?._ready?.() || playSfx("missile", { gain: 0.8 })) return;
  a._noise({ duration: 3, gain: 0.12, type: "bandpass", freq: 500, q: 1.4, sweepTo: 2600 });
  a._tone({ freq: 220, to: 900, duration: 3, gain: 0.03, type: "sawtooth" });
}
/* Zero: the crack, the shockwave, and a long rumble under the cloud. */
function blastSound() {
  const a = game.audio;
  if (!a?._ready?.()) return;
  nuke.inbound?.alarm?.stop(0.1);
  if (playSfx("nuke-blast", { gain: 1 })) {
    a._tone({ freq: 48, to: 22, duration: 8, gain: 0.25, type: "sine", delay: 0.1 });   // under the clip's rumble
    return;
  }
  a.explosion(3);
  a._noise({ duration: 9, gain: 0.5, type: "lowpass", freq: 260, sweepTo: 40, delay: 0.15 });
  a._tone({ freq: 48, to: 22, duration: 8, gain: 0.35, type: "sine", delay: 0.1 });
}
function nukeBeep(armed) {
  const a = game.audio;
  if (!a?._ready?.()) return;
  if (armed ? playSfx("beep", { gain: 0.6 }) && playSfx("beep", { gain: 0.6, delay: 0.12 }) : playSfx("beep", { gain: 0.5, delay: 0.6, rate: 0.8 })) return;
  if (armed) for (const d of [0, 0.12]) a._tone({ freq: 1320, duration: 0.08, gain: 0.08, type: "square", delay: d });
  else a._tone({ freq: 1000, duration: 0.12, gain: 0.07, type: "square", delay: 0.6 });
}
