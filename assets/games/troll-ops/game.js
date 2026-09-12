// Troll Ops — main game module.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

import { WeaponState, WEAPON_DEFS } from "./weapons.js";
import { buildWeaponMesh } from "./weapon-model.js";
import { WeaponInspector } from "./inspector.js";
import { CharacterInspector } from "./char-inspector.js";
import { Loadout } from "./loadout.js";
import { addXp, xpForRun, xpForMatch, XP } from "./progression.js";
import { buildMap, disposeMap, MAPS, MAP_IDS } from "./maps.js";
import { Net, makeRoomCode, MAX_PLAYERS } from "./net.js";
import { RemotePlayers, TEAMS } from "./remote-players.js";
import { MODES, MODE_IDS, weaponForMode, playerWon, matchWinner, Hill, Bomb, pickBombSites, PLANT_TIME, DEFUSE_TIME } from "./modes.js";
import { BotManager } from "./bots.js";
import { resolveWeapon, defaultLoadoutFor } from "./attachments.js";
import { GameAudio } from "./audio.js";
import { ZombieDirector } from "./zombies.js";
import { zombieWindows } from "./pentagrin.js";
import { ImpactShader, makeMuzzleFlashMaterial, makeImpactSparkMaterial } from "./shaders.js";
import { WaveSpawner } from "./enemies.js";
import { BulletSystem, segmentBlocked, raycastWorld } from "./ballistics.js";
import { MovementController, STANCE, groundHeightAt } from "./movement.js";
import { MeleeState, buildMeleeMesh, GrenadeSystem, blastDamage } from "./gear.js";
import { RangeSet } from "./range.js";
import { PickupSystem, SwapHold } from "./pickups.js";

const els = {
  cabinet: document.getElementById("to-cabinet"),
  loading: document.getElementById("to-loading"),
  title: document.getElementById("to-title"),
  startBtn: document.getElementById("to-start-btn"),
  loMode: document.getElementById("to-lo-mode"),
  loModeBlurb: document.getElementById("to-lo-modeblurb"),
  goL1: document.getElementById("to-go-l1"),
  goL2: document.getElementById("to-go-l2"),
  goL3: document.getElementById("to-go-l3"),
  loPvp: document.getElementById("to-lo-pvp"),
  room: document.getElementById("to-room"),
  newRoom: document.getElementById("to-newroom"),
  netStatus: document.getElementById("to-net-status"),
  hudTeams: document.getElementById("to-hud-teams"),
  scorePhantom: document.getElementById("hud-score-phantom"),
  scoreGhost: document.getElementById("hud-score-ghost"),
  scoreboard: document.getElementById("to-scoreboard"),
  respawn: document.getElementById("to-respawn"),
  respawnText: document.getElementById("to-respawn-text"),
  spawnGuard: document.getElementById("to-spawnguard"),
  staging: document.getElementById("to-staging"),
  stagingMode: document.getElementById("to-staging-mode"),
  stagingClock: document.getElementById("to-staging-clock"),
  stagingSub: document.getElementById("to-staging-sub"),
  stagingRoster: document.getElementById("to-staging-roster"),
  bombStatus: document.getElementById("to-bomb-status"),
  bombSide: document.getElementById("to-bomb-side"),
  bombTimer: document.getElementById("to-bomb-timer"),
  bombPrompt: document.getElementById("to-bomb-prompt"),
  bombPromptText: document.getElementById("to-bomb-prompt-text"),
  bombBarFill: document.getElementById("to-bomb-bar-fill"),
  pickupPrompt: document.getElementById("to-pickup-prompt"),
  pickupPromptText: document.getElementById("to-pickup-prompt-text"),
  pickupBarFill: document.getElementById("to-pickup-bar-fill"),
  deathBy: document.getElementById("to-deathby"),
  deathByName: document.getElementById("to-deathby-name"),
  deathByMeta: document.getElementById("to-deathby-meta"),
  xpPopups: document.getElementById("to-xp-pops"),
  damageNumbers: document.getElementById("to-dmg-nums"),
  hudWaveBox: document.querySelector(".to-hud-wave"),
  hudHostilesBox: document.querySelector(".to-hud-hostiles"),
  loMaps: document.getElementById("to-lo-maps"),
  loClasses: document.getElementById("to-lo-classes"),
  loList: document.getElementById("to-lo-list"),
  loName: document.getElementById("to-lo-name"),
  loBlurb: document.getElementById("to-lo-blurb"),
  loStats: document.getElementById("to-lo-stats"),
  loAtts: document.getElementById("to-lo-atts"),
  loRank: document.getElementById("to-lo-rank-label"),
  loRankFill: document.getElementById("to-lo-rank-fill"),
  pause: document.getElementById("to-pause"),
  resumeBtn: document.getElementById("to-resume-btn"),
  quitBtn: document.getElementById("to-quit-btn"),
  gameover: document.getElementById("to-gameover"),
  goTitle: document.getElementById("to-go-title"),
  goWave: document.getElementById("to-go-wave"),
  goKills: document.getElementById("to-go-kills"),
  goTime: document.getElementById("to-go-time"),
  goXp: document.getElementById("to-go-xp"),
  goRank: document.getElementById("to-go-rank"),
  retryBtn: document.getElementById("to-retry-btn"),
  intermission: document.getElementById("to-intermission"),
  voteList: document.getElementById("to-vote-list"),
  voteClock: document.getElementById("to-vote-clock"),
  hud: document.getElementById("to-hud"),
  hudWave: document.getElementById("hud-wave"),
  hudHostiles: document.getElementById("hud-hostiles"),
  hudKills: document.getElementById("hud-kills"),
  waveBanner: document.getElementById("hud-wave-banner"),
  crosshair: document.getElementById("to-crosshair"),
  hitmarker: document.getElementById("to-hitmarker"),
  hitflash: document.getElementById("to-hitflash"),
  lowhp: document.getElementById("to-lowhp"),
  hpFill: document.getElementById("hud-hp-fill"),
  hpText: document.getElementById("hud-hp-text"),
  ammoCur: document.getElementById("hud-ammo-cur"),
  ammoRes: document.getElementById("hud-ammo-res"),
  reloadTag: document.getElementById("hud-reload-tag"),
  killfeed: document.getElementById("to-killfeed"),
  touch: document.getElementById("to-touch"),
  touchMove: document.getElementById("to-touch-move"),
  touchMoveNub: document.querySelector(".to-touch-stick-nub"),
  touchLook: document.getElementById("to-touch-look"),
  touchFire: document.getElementById("to-touch-fire"),
  touchAds: document.getElementById("to-touch-ads"),
  touchJump: document.getElementById("to-touch-jump"),
  touchReload: document.getElementById("to-touch-reload"),
  touchSlide: document.getElementById("to-touch-slide"),
  touchMelee: document.getElementById("to-touch-melee"),
  touchNade: document.getElementById("to-touch-nade"),
  touchInteract: document.getElementById("to-touch-interact"),
  touchSwap: document.getElementById("to-touch-swap"),
  gearMelee: document.getElementById("to-gear-melee"),
  gearMeleeName: document.getElementById("to-gear-melee-name"),
  gearLethal: document.getElementById("to-gear-lethal"),
  gearLethalName: document.getElementById("to-gear-lethal-name"),
  gearLethalN: document.getElementById("to-gear-lethal-n"),
  gearTactical: document.getElementById("to-gear-tactical"),
  gearTacticalName: document.getElementById("to-gear-tactical-name"),
  gearTacticalN: document.getElementById("to-gear-tactical-n"),
  cook: document.getElementById("to-cook"),
  cookFill: document.getElementById("to-cook-fill"),
  blind: document.getElementById("to-blind"),
  smoke: document.getElementById("to-smoke"),
  emp: document.getElementById("to-emp"),
  rangeHud: document.getElementById("to-range"),
  rangeShot: document.getElementById("to-range-shot"),
  rangeSens: document.getElementById("to-range-sens"),
  rangeFov: document.getElementById("to-range-fov"),
};

const isTouch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;

// Standard gamepad mapping: left stick moves, right stick looks, triggers
// fire/aim. Covers Bluetooth/MFi pads on iPad as well as desktop controllers
// — no separate "controller mode" toggle, it activates the moment a pad
// reports input, same way key state does.
const GP_DEADZONE = 0.18;
const gamepadState = {
  connected: false, moveX: 0, moveY: 0, lookDX: 0, lookDY: 0,
  firing: false, ads: false, jump: false, crouch: false,
};
let gpIndex = null;
let gpPrev = {};

// Debug readout for controllers that don't behave — shows the raw id/mapping
// and live axes/buttons so a pad that connects but does nothing (common with
// non-MFi/generic Bluetooth pads on iOS, which often report mapping:"" instead
// of "standard") can be diagnosed without a desktop devtools connection.
const gpDebugEl = document.getElementById("to-gp-debug");
const gpDebugForced = /[?&]gpdebug=1/.test(location.search);
function renderGpDebug(gp) {
  if (!gpDebugEl) return;
  if (!gp) {
    if (!gpDebugForced) gpDebugEl.hidden = true;
    else gpDebugEl.textContent = "No gamepad detected.\nPress any button on the controller.";
    return;
  }
  const nonStandard = gp.mapping !== "standard";
  gpDebugEl.hidden = false;
  const axes = gp.axes.map((a, i) => `${i}:${a.toFixed(2)}`).join(" ");
  const buttons = gp.buttons.map((b, i) => (b.pressed || b.value > 0.1) ? i : null).filter((v) => v !== null).join(",") || "none";
  gpDebugEl.textContent =
    `id: ${gp.id}\n` +
    `mapping: "${gp.mapping}"${nonStandard ? "  (NON-STANDARD — layout may be scrambled)" : ""}\n` +
    `axes: ${axes}\n` +
    `pressed: ${buttons}`;
}

// The touch pad belongs to the match, not the lobby — it used to sit over
// the menu, bleeding FIRE and RELOAD through the translucent panels.
// A paired controller (common on iPad) replaces the on-screen sticks, so the
// overlay hides itself the moment one is detected rather than stacking both.
function setTouchControls(on) { els.touch.hidden = !(isTouch && on) || gamepadState.connected; }
setTouchControls(false);
window.addEventListener("gamepadconnected", (e) => {
  gpIndex = e.gamepad.index;
  gamepadState.connected = true;
  if (gameState === "playing") setTouchControls(true);
});
window.addEventListener("gamepaddisconnected", (e) => {
  if (e.gamepad.index !== gpIndex) return;
  gpIndex = null;
  gamepadState.connected = false;
  gamepadState.moveX = gamepadState.moveY = 0;
  gamepadState.firing = gamepadState.ads = gamepadState.jump = gamepadState.crouch = false;
  if (gameState === "playing") setTouchControls(true);
});

const loadout = new Loadout({
  sum: {
    cls: document.getElementById("to-pf-sum-class"),
    name: document.getElementById("to-pf-sum-name"),
    secondary: document.getElementById("to-pf-sum-secondary"),
    atts: document.getElementById("to-pf-sum-atts"),
    stats: document.getElementById("to-pf-sum-stats"),
    attWeapon: document.getElementById("to-pf-att-weapon"),
    melee: document.getElementById("to-pf-sum-melee"),
    lethal: document.getElementById("to-pf-sum-lethal"),
    tactical: document.getElementById("to-pf-sum-tactical"),
    xp: document.getElementById("to-pf-xp"),
    next: document.getElementById("to-pf-next"),
  },
  maps: els.loMaps,
  slotToggle: document.getElementById("to-lo-slot-toggle"),
  classes: els.loClasses,
  list: els.loList,
  name: els.loName,
  blurb: els.loBlurb,
  stats: els.loStats,
  atts: els.loAtts,
  gear: document.getElementById("to-lo-gear"),
  rank: els.loRank,
  rankFill: els.loRankFill,
}, () => {
  refreshLobbyMap();
  if (inspectorLive) {
    const gearPanel = document.getElementById("to-pfp-gear");
    inspector?.show(gearPanel && !gearPanel.hidden ? loadout.melee : loadout.resolved);
  }
});

// -------------------- mode + networking --------------------

let modeId = "ops";
let matchesPlayed = 0;   // seeds the map-vote shortlist, so it changes each round
const teamScores = { phantom: 0, ghost: 0 };
const bots = new BotManager();
const BOT_TARGET = 8;      // participants a PvP room is padded up to

// Quickplay: everyone who leaves the room code untouched lands in the same
// public server for their mode, instead of each getting their own random
// room. Only overflow into a numbered shard (QTDM2, QTDM3, ...) once the
// base room is genuinely full of real people — see joinQuickplay().
const QUICKPLAY_BASE = { tdm: "QTDM", koth: "QKOH", oitc: "QOTC", gungame: "QGUN", snd: "QSND" };
const QUICKPLAY_MAX_SHARDS = 9;
let roomIsCustom = false;   // true once the player types a code or asks for a new one
let gunGameProgress = 0;
let hill = null;
let hillAcc = 0;

// -------------------- Search & Destroy --------------------
let bomb = null;             // Bomb instance for the current match, or null outside snd
let bombSites = null;        // [{id, x, z}] for the loaded map, cached per match
let sndRound = 0;            // 1-based round counter
let sndAttackTeam = "phantom"; // which team plants this round; swaps at halftime
let sndEliminated = false;   // this player is out for the rest of the round (no respawn)
let sndRoundOver = false;    // freeze while the banner/HUD settles between rounds
let sndInteractHeld = false; // physically holding E right now

const audio = new GameAudio();
let suppressT = 0;

// -------------------- settings + escape menu --------------------

const SETTINGS_KEY = "trollops:settings";
const settings = {
  volume: 50, sens: 100, fov: 78, invert: false, minimap: true, botSkill: "regular", aimAssist: true,
  ...(() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch { return {}; } })(),
};

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* private mode */ }
}

function applySettings() {
  audio.setVolume(settings.volume / 100);
  baseFov = settings.fov;
  minimapCanvas.hidden = !settings.minimap;

  const set = (id, value, outId, suffix = "") => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = !!value;
    else el.value = value;
    const out = outId && document.getElementById(outId);
    if (out) out.textContent = `${value}${suffix}`;
  };
  set("to-set-volume", settings.volume, "to-set-volume-out");
  set("to-set-sens", settings.sens, "to-set-sens-out", "%");
  set("to-set-fov", settings.fov, "to-set-fov-out", "°");
  set("to-set-invert", settings.invert);
  set("to-set-minimap", settings.minimap);
  set("to-set-aimassist", settings.aimAssist);

  set("to-set-volume-lobby", settings.volume, "to-set-volume-lobby-out");
  set("to-set-sens-lobby", settings.sens, "to-set-sens-lobby-out", "%");
  set("to-set-fov-lobby", settings.fov, "to-set-fov-lobby-out", "°");
  set("to-set-invert-lobby", settings.invert);
  set("to-set-minimap-lobby", settings.minimap);
  set("to-set-aimassist-lobby", settings.aimAssist);
  set("to-set-botskill", settings.botSkill);
  // Takes effect for bots created from here on, so a change mid-match applies
  // as they respawn rather than rewriting the ones already in the fight.
  bots.difficulty = settings.botSkill;
}

function bindRange(id, key, outId, suffix = "") {
  const el = document.getElementById(id);
  el?.addEventListener("input", () => {
    settings[key] = Number(el.value);
    const out = document.getElementById(outId);
    if (out) out.textContent = `${el.value}${suffix}`;
    applySettings();
    saveSettings();
  });
}

function bindCheck(id, key) {
  const el = document.getElementById(id);
  el?.addEventListener("change", () => {
    settings[key] = el.checked;
    applySettings();
    saveSettings();
  });
}

function bindSelect(id, key) {
  const el = document.getElementById(id);
  el?.addEventListener("change", () => {
    settings[key] = el.value;
    applySettings();
    saveSettings();
  });
}

// Same settings, reachable from both the in-match Esc menu and the lobby's
// Controls tab — a player shouldn't have to deploy just to fix sensitivity.
function initEscapeMenu() {
  bindRange("to-set-volume", "volume", "to-set-volume-out");
  bindRange("to-set-sens", "sens", "to-set-sens-out", "%");
  bindRange("to-set-fov", "fov", "to-set-fov-out", "°");
  bindCheck("to-set-invert", "invert");
  bindCheck("to-set-minimap", "minimap");
  bindCheck("to-set-aimassist", "aimAssist");

  bindRange("to-set-volume-lobby", "volume", "to-set-volume-lobby-out");
  bindRange("to-set-sens-lobby", "sens", "to-set-sens-lobby-out", "%");
  bindRange("to-set-fov-lobby", "fov", "to-set-fov-lobby-out", "°");
  bindCheck("to-set-invert-lobby", "invert");
  bindCheck("to-set-minimap-lobby", "minimap");
  bindCheck("to-set-aimassist-lobby", "aimAssist");
  bindSelect("to-set-botskill", "botSkill");

  const tabs = document.getElementById("to-menu-tabs");
  tabs?.addEventListener("click", (e) => {
    const btn = e.target.closest(".to-menu-tab");
    if (!btn) return;
    for (const b of tabs.children) {
      const on = b === btn;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", String(on));
    }
    for (const name of ["settings", "controls", "players"]) {
      const panel = document.getElementById(`to-panel-${name}`);
      if (panel) panel.hidden = name !== btn.dataset.tab;
    }
    if (btn.dataset.tab === "players") renderMenuRoster();
  });

  // Touch has no Esc key, so the in-match button opens the same menu.
  document.getElementById("to-gear")?.addEventListener("click", () => {
    if (gameState !== "playing") return;
    if (controls.isLocked) controls.unlock();
    else { gameState = "paused"; els.pause.hidden = false; }
  });
}

function renderMenuRoster() {
  const box = document.getElementById("to-menu-roster");
  if (!box) return;
  if (!isPvp() || !net.connected) {
    box.textContent = "Solo run — no other operators.";
    return;
  }
  renderScoreboard();
  box.innerHTML = els.scoreboard.innerHTML;
}

/* A round cracking past raises suppression — washes the colour out, tightens
   the vignette and jitters the frame, so being shot at actually costs you. */
function nearMiss(strength, at = null) {
  suppressT = Math.min(1, suppressT + strength);
  audio.whiz(at);
}

/* Footsteps for everyone who isn't you. Panned, so the direction of the
   sound is real information — the thing you actually listen for in a PF
   fight. Tracked per-actor by distance travelled rather than a timer, so
   someone walking slowly is quieter and rarer than someone sprinting. */
const stepTrack = new Map();
const STEP_STRIDE = 1.9;     // metres between footfalls
const STEP_HEARING = 34;     // beyond this we don't bother emitting

function updateEnemySteps(dt) {
  const seen = new Set();
  const sources = [];
  for (const rp of remotes.byId.values()) {
    if (rp.alive) sources.push({ key: `r${rp.netId}`, pos: rp.pos });
  }
  for (const b of bots.bots) {
    if (b.alive) sources.push({ key: `b${b.id}`, pos: b.pos });
  }

  for (const s of sources) {
    seen.add(s.key);
    let t = stepTrack.get(s.key);
    if (!t) { stepTrack.set(s.key, { last: s.pos.clone(), dist: 0 }); continue; }

    const moved = s.pos.distanceTo(t.last);
    t.last.copy(s.pos);
    // A teleport (respawn, net correction) shouldn't fire a burst of steps.
    if (moved > 3) { t.dist = 0; continue; }
    t.dist += moved;

    if (t.dist >= STEP_STRIDE) {
      t.dist -= STEP_STRIDE;
      const range = s.pos.distanceTo(player.pos);
      if (range < STEP_HEARING) {
        // Louder than your own steps: these are the ones worth hearing.
        audio.step(s.pos, 0.16);
      }
    }
  }

  for (const key of stepTrack.keys()) if (!seen.has(key)) stepTrack.delete(key);
}

/* Closest approach of a ray to a point; used to tell a near miss from a
   shot that was never coming near us. */
function rayDistanceTo(origin, dir, point) {
  const toPoint = point.clone().sub(origin);
  const along = toPoint.dot(dir);
  if (along < 0) return Infinity;
  return toPoint.addScaledVector(dir, -along).length();
}

function currentMode() { return MODES[modeId]; }
function isPvp() { return currentMode().pvp; }
function isZombies() { return !!currentMode().zombies; }
function isRange() { return !!currentMode().range; }
function isSnd() { return !!currentMode().rounds; }
let zdir = null;
let rangeSet = null;
function isBotPeer(p) { return p.isBot || String(p.id).startsWith("bot-"); }

function buildModeButtons() {
  els.loMode.innerHTML = "";
  for (const id of MODE_IDS) {
    const m = MODES[id];
    const b = document.createElement("button");
    b.type = "button";
    b.className = "to-lo-modebtn";
    b.dataset.mode = id;
    b.textContent = m.short;
    b.title = m.blurb;
    b.addEventListener("click", () => { modeId = id; renderModes(); });
    els.loMode.appendChild(b);
  }
  renderModes();
}

function renderModes() {
  for (const b of els.loMode.children) {
    const on = b.dataset.mode === modeId;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-pressed", String(on));
  }
  els.loModeBlurb.textContent = currentMode().blurb;
  els.loPvp.hidden = !isPvp();
  const soloNote = document.getElementById("to-pf-solo-note");
  if (soloNote) soloNote.hidden = isPvp();
  els.loMaps.hidden = !!currentMode().forceMap;   // Zombies has its own map
  renderLobbyRoster();   // no-ops until the lobby is ready
  if (lobbyReady) refreshLobbyMap();
}

// -------------------- lobby chrome --------------------
// The rail on the left swaps one centre panel, Phantom Forces style, rather
// than scrolling one long column of controls.

const LOBBY_PANELS = ["deploy", "loadout", "customize", "gear", "server", "controls"];
const railButtons = [...document.querySelectorAll("#to-pf-rail [data-panel]")];

const gunView = document.getElementById("to-gun-view");
const gunCanvas = document.getElementById("to-gun-canvas");
const inspector = gunCanvas ? new WeaponInspector(gunCanvas) : null;
let inspectorLive = false;

const charView = document.getElementById("to-char-view");
const charCanvas = document.getElementById("to-char-canvas");
const charInspector = charCanvas ? new CharacterInspector(charCanvas) : null;
let charInspectorLive = false;

/* One inspector, two panels that want to show it: move the element rather
   than standing up a second WebGL context for the same gun. */
function mountGunView(panel) {
  const mount = document.getElementById(`to-gun-mount-${panel}`);
  inspectorLive = !!(gunView && mount);
  if (!inspectorLive) return;
  if (gunView.parentElement !== mount) mount.appendChild(gunView);
  gunView.style.display = "";
}

/* Same move-the-element trick as mountGunView, for the operator locker
   viewer - it only ever lives on the Match Setup ("deploy") panel today,
   but is written the same way so a second panel can pick it up later. */
function mountCharView(panel) {
  const mount = document.getElementById(`to-char-mount-${panel}`);
  charInspectorLive = !!(charView && mount);
  if (!charInspectorLive) return;
  if (charView.parentElement !== mount) mount.appendChild(charView);
  charView.style.display = "";
}

// "deploy" (Match Setup) is the panel left un-hidden in the HTML, so it's
// what a player sees first without any click - nothing else calls
// showLobbyPanel("deploy") on first load, so the locker view has to be
// mounted here or it sits empty until the player clicks away and back.
mountCharView("deploy");

function showLobbyPanel(name) {
  for (const id of LOBBY_PANELS) {
    const panel = document.getElementById(`to-pfp-${id}`);
    if (panel) panel.hidden = id !== name;
  }
  for (const b of railButtons) {
    const on = b.dataset.panel === name;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-pressed", String(on));
  }
  // Card thumbnails can only measure themselves once the panel is on screen.
  if (name === "deploy") loadout.drawMapThumbs();

  if (name === "loadout" || name === "customize") {
    mountGunView(name);
    inspector?.show(loadout.resolved);
  } else if (name === "gear") {
    mountGunView(name);
    inspector?.show(loadout.melee);
  } else {
    inspectorLive = false;
    if (gunView) gunView.style.display = "none";
  }

  if (name === "deploy") {
    mountCharView(name);
  } else {
    charInspectorLive = false;
    if (charView) charView.style.display = "none";
  }
}

for (const b of railButtons) {
  b.addEventListener("click", () => showLobbyPanel(b.dataset.panel));
}

// `net` is constructed further down this module, so nothing may paint the
// roster until initLobbyChrome() runs at the end of setup.
let lobbyReady = false;

function renderLobbyRoster() {
  const box = document.getElementById("to-pf-roster");
  if (!box || !lobbyReady) return;

  const rows = [{ name: playerName(), state: "READY", you: true }];
  if (isPvp() && net.connected) {
    for (const p of net.peers.values()) {
      rows.push({ name: p.name, state: isBotPeer(p) ? "BOT" : "IN ROOM" });
    }
  }

  box.innerHTML = "";
  for (const row of rows) {
    const el = document.createElement("div");
    el.className = row.you ? "to-pf-op is-you" : "to-pf-op is-idle";
    const box2 = document.createElement("i");
    const name = document.createElement("span");
    name.textContent = row.name;
    const state = document.createElement("b");
    state.textContent = row.state;
    el.append(box2, name, state);
    box.appendChild(el);
  }

  if (rows.length === 1) {
    const note = document.createElement("p");
    note.className = "to-pf-empty";
    note.textContent = isPvp()
      ? (roomIsCustom
          ? "No one else in the room yet — share the code."
          : "No one else has deployed into this mode yet. Anyone who hits Deploy lands here with you.")
      : "Solo drop. No other operators.";
    box.appendChild(note);
  }
}

function renderCallsign() {
  const el = document.getElementById("to-pf-callsign");
  if (el) el.textContent = `Signed in as ${playerName()}`;
}

// The profile arrives after the accounts script signs in, so redraw then.
window.addEventListener("trollrunner:auth-changed", () => {
  renderCallsign();
  renderLobbyRoster();
});

function playerName() {
  const profile = window.TrollrunnerAccounts?.getCachedProfile?.();
  return String(profile?.username || "operator").slice(0, 14);
}

function setNetStatus(text, state = "") {
  els.netStatus.textContent = text;
  els.netStatus.classList.toggle("is-live", state === "live");
  els.netStatus.classList.toggle("is-bad", state === "bad");
}

buildModeButtons();

els.newRoom.addEventListener("click", () => {
  els.room.value = makeRoomCode();
  roomIsCustom = true;   // an explicit fresh code means "private room", not quickplay
});
els.room.addEventListener("input", () => {
  els.room.value = els.room.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
  roomIsCustom = els.room.value.length > 0;
});

function registerDeath(victimName, killerId, weaponId, opts = {}) {
  const mode = currentMode();
  const iKilled = killerId === net.id;
  const iDied = opts.victimIsMe;
  const killer = iKilled ? "You" : nameFor(killerId);
  const killerTeam = iKilled ? net.team : (net.peers.get(killerId)?.team || bots.byId(killerId)?.team);

  pushKillfeed({
    killer,
    victim: victimName,
    weapon: weaponNameFor(weaponId),
    head: !!opts.head,
    killerTeam,
    victimTeam: opts.victimTeam,
    mine: iKilled || iDied,
  });

  if (iKilled) {
    player.kills++;
    player.streak++;
    if (opts.head) player.headshots++;
    audio.kill();
    els.hudKills.textContent = String(player.kills);

    // XP lands per kill, not in a lump at the end — the immediate feedback
    // is most of what makes the grind feel like progress.
    awardKillXp(opts.head);
    announceStreak(player.streak);

    if (mode.ladder) {
      gunGameProgress++;
      if (playerWon(mode, gunGameProgress)) { endMatch("You cleared the rack"); return; }
      const next = equipFromLoadout();
      setActiveWeaponMesh(next);
      showWaveBanner(`${gunGameProgress + 1} / ${mode.ladder.length} — ${next.name}`, 1400);
    }
    if (mode.oneShot) {
      // landing the shot buys the round back
      const w = currentWeapon();
      w.ammoInMag = Math.min(w.def.magSize, w.ammoInMag + 1);
    }
  }

  // S&D scores round wins, not kills — sndRoundWin() owns teamScores and the
  // match-end check there instead, once the round itself is decided.
  if (!isSnd() && killerTeam && teamScores[killerTeam] != null) {
    teamScores[killerTeam]++;
    updateTeamHud();
  }
  if (!isSnd()) checkMatchEnd();

  // Whatever the victim was holding falls where they stood. Our own death
  // drops from damagePlayer instead, with the exact live WeaponState — this
  // covers everyone else's (bots we host, peers, bots peers host).
  if (!opts.victimIsMe && opts.victimPos && opts.victimWeaponId && scavengeAllowed()) {
    const def = resolveWeapon(opts.victimWeaponId, defaultLoadoutFor(opts.victimWeaponId));
    if (def) pickups.drop(`${killerId}:${performance.now()}`, def, opts.victimPos);
  }
}

/* Bank XP mid-match and show it floating up. Only PvP pays as it goes; Ops
   still settles once at the end via xpForRun, which its wave curve suits. */
function addMatchXp(amount, label) {
  if (!isPvp() || amount <= 0) return;
  player.matchXp += amount;
  showXpPopup(amount, label);
}

function awardKillXp(isHead) {
  addMatchXp(XP.kill + (isHead ? XP.headshot : 0), isHead ? "HEADSHOT" : "KILL");
}

const STREAKS = { 3: "Triple", 5: "Rampage", 7: "Unstoppable", 10: "Godlike" };

function announceStreak(n) {
  player.bestStreak = Math.max(player.bestStreak, n);
  const label = STREAKS[n];
  if (!label) return;
  showWaveBanner(`${label.toUpperCase()} — ${n} in a row`, 1500);
  audio.wave();
}

function showXpPopup(amount, label) {
  if (!els.xpPopups) return;
  const div = document.createElement("div");
  div.className = "to-xp-pop";
  div.textContent = label ? `+${amount} · ${label}` : `+${amount}`;
  els.xpPopups.appendChild(div);
  while (els.xpPopups.children.length > 4) els.xpPopups.firstChild.remove();
  setTimeout(() => div.remove(), 1400);
}

/* Damage we've dealt to each target, so that softening someone up still
   counts when a teammate lands the last shot. Without this, 90 damage and a
   stolen kill is indistinguishable from doing nothing at all. */
const dealtLog = new Map();       // victim id -> { dmg, last }

function noteDealt(targetId, amount) {
  if (!targetId || !isPvp()) return;
  const e = dealtLog.get(targetId) || { dmg: 0, last: 0 };
  e.dmg += amount;
  e.last = performance.now();
  dealtLog.set(targetId, e);
}

function creditAssistIfOwed(victimId, victimName) {
  const e = dealtLog.get(victimId);
  if (!e) return;
  dealtLog.delete(victimId);
  if (performance.now() - e.last > ASSIST_MEMORY * 1000) return;
  if (e.dmg < ASSIST_MIN_DAMAGE) return;

  player.assists++;
  addMatchXp(XP.assist, "ASSIST");
  pushKillfeed({ killer: "You", victim: victimName, assist: true, mine: true });
}

function checkMatchEnd() {
  const mode = currentMode();
  if (!mode.pvp || gameState !== "playing") return;
  const winner = matchWinner(mode, {
    teamScores,
    selfScore: player.kills,
    selfName: "You",
    peers: [...net.peers.values()],
  });
  if (winner) endMatch(winner);
}

function updateTeamHud() {
  els.scorePhantom.textContent = String(teamScores.phantom);
  els.scoreGhost.textContent = String(teamScores.ghost);
}

const net = new Net({
  // Bots filling the room isn't news; only announce real people.
  onJoin: (p) => { if (!isBotPeer(p)) pushKillfeed(`${p.name} joined`); },
  onLeave: (p) => { if (!isBotPeer(p)) pushKillfeed(`${p.name} left`); },
  // `hd` has always been on the wire; we just never read it.
  onHitTaken: (m) => damagePlayer(m.dmg, m.id, m.w, !!m.hd),
  onPeerDied: (p, m) => {
    const snap = p.snaps?.[p.snaps.length - 1];
    registerDeath(p.name, m.by, m.w, {
      head: !!m.hd, victimTeam: p.team,
      victimPos: snap ? new THREE.Vector3(snap.x, snap.y, snap.z) : null,
      victimWeaponId: p.weapon,
    });
    if (m.by !== net.id) creditAssistIfOwed(p.id, p.name);
  },
  onVote: () => { if (intermissionT > 0) renderVote(); },
  /* Adopt the owner's countdown rather than running our own, so two clients
     that started a fraction of a second apart still hit zero together. We
     only ever take a *shorter* remaining time: a late "6" arriving after we
     are down to 2 must not push us back up the clock. */
  onStage: (m) => {
    if (gameState !== "playing" || !isPvp()) return;
    const left = Number(m.left);
    if (!Number.isFinite(left) || left <= 0) { if (isStaging()) endStaging(); return; }
    if (isStaging() && left < stageT) { stageT = left; stageOwner = false; }
  },
  /* Bomb sync. `id` here is the sender, not necessarily the actor — a bot
     host reports carrier handoffs on the carrier's behalf. Our own actions
     already applied locally before we sent them, so this only needs to move
     the needle for everyone else's copy of the bomb. */
  onBomb: (m) => {
    if (!isSnd() || !bomb || m.id === net.id) return;
    if (m.kind === "action") {
      if (m.action === "plant") {
        els.bombPrompt.hidden = false;
        els.bombPromptText.textContent = `Planting site ${m.site}…`;
        els.bombBarFill.style.width = `${Math.min(100, (m.progress / PLANT_TIME) * 100)}%`;
      } else if (m.action === "defuse") {
        els.bombPrompt.hidden = false;
        els.bombPromptText.textContent = "Defusing…";
        els.bombBarFill.style.width = `${Math.min(100, (m.progress / DEFUSE_TIME) * 100)}%`;
      }
      return;
    }
    switch (m.action) {
      // Round number and attack side are never taken from the wire: every
      // client reaches the same round/side by independently seeing the same
      // bomb outcome and running beginSndRound() itself — the same principle
      // as staging's countdown ownership, just with nothing to race here
      // since there's no clock drift to correct. Only the carrier, which one
      // client picks on the others' behalf, actually needs to travel.
      case "reset":
        bomb.carrierId = m.carrierId;
        break;
      case "carrier":
        bomb.carrierId = m.carrierId;
        break;
      case "planted":
        bomb.plant(m.site);
        showWaveBanner(`Bomb planted — site ${m.site}`, 1800);
        audio.wave();
        els.bombPrompt.hidden = true;
        break;
      case "defused":
        bomb.defuse();
        sndRoundWin(sndDefendTeam(), "bomb defused");
        els.bombPrompt.hidden = true;
        break;
      case "cancel":
        if (bomb.action?.by === m.id) { bomb.action = null; els.bombPrompt.hidden = true; }
        break;
    }
  },
  ownsBot: (id) => !!bots.byId(id),
  onBotHit: (m) => {
    const { killed, bot } = bots.applyHit(m.target, m.dmg);
    if (!killed) return;
    net.reportDeathAs(m.target, m.id, m.w, !!m.hd);
    registerDeath(bot.name, m.id, m.w, {
      head: !!m.hd, victimTeam: bot.team,
      victimPos: bot.pos, victimWeaponId: bot.weaponId,
    });
    if (m.id !== net.id) creditAssistIfOwed(m.target, bot.name);
  },
  onRemoteShot: (p, m) => {
    const origin = new THREE.Vector3(m.ox, m.oy, m.oz);
    spawnImpactBurst(origin, 0xffcf8a, 3);

    audio.shot({ damage: 26, pellets: 1 }, 0.8, origin);

    // Was it aimed near our head? If so, suppress.
    const dir = new THREE.Vector3(m.dx, m.dy, m.dz);
    if (dir.lengthSq() > 0.001 && player.alive) {
      const miss = rayDistanceTo(origin, dir.normalize(), player.pos);
      if (miss < 3) {
        // The crack comes from where the round passed us, not the muzzle.
        const near = player.pos.clone().addScaledVector(dir, origin.distanceTo(player.pos));
        nearMiss(0.55 * (1 - miss / 3), near);
      }
    }
  },
});

lobbyReady = true;
renderCallsign();
renderLobbyRoster();

// -------------------- renderer / scene --------------------

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.5;
els.cabinet.appendChild(renderer.domElement);
renderer.domElement.style.position = "absolute";
renderer.domElement.style.inset = "0";
renderer.domElement.style.zIndex = "1";

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x3a4a38, 0.01);

const skyMat = new THREE.ShaderMaterial({
  uniforms: {
    uTop: { value: new THREE.Color(0x1a2e4a) },
    uHorizon: { value: new THREE.Color(0x6b8a5e) },
    uBottom: { value: new THREE.Color(0x2a3324) },
  },
  vertexShader: /* glsl */`
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform vec3 uTop;
    uniform vec3 uHorizon;
    uniform vec3 uBottom;
    varying vec3 vDir;
    void main() {
      float h = vDir.y;
      vec3 color = h > 0.0
        ? mix(uHorizon, uTop, smoothstep(0.0, 0.6, h))
        : mix(uHorizon, uBottom, smoothstep(0.0, -0.3, h));
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  side: THREE.BackSide,
  fog: false,
  depthWrite: false,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(250, 24, 16), skyMat);
scene.add(sky);

const camera = new THREE.PerspectiveCamera(78, 16 / 9, 0.05, 300);
let baseFov = 78;   // driven by the FOV setting

// Lighting
const hemi = new THREE.HemisphereLight(0xb9d4ff, 0x39432c, 1.1);
scene.add(hemi);
const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
sun.position.set(30, 45, -20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
sun.shadow.camera.far = 120;
sun.shadow.bias = -0.0015;
scene.add(sun);
scene.add(sun.target);

// -------------------- map --------------------

// Mutated in place by buildMap — the movement controller holds references
// to both, so they must never be reassigned.
const ARENA = { minX: -34, maxX: 34, minZ: -34, maxZ: 34 };
const colliders = [];

let builtMap = null;
let spawnPoints = [];

function applyEnvironment(map) {
  skyMat.uniforms.uTop.value.set(map.sky.top);
  skyMat.uniforms.uHorizon.value.set(map.sky.horizon);
  skyMat.uniforms.uBottom.value.set(map.sky.bottom);

  scene.fog.color.set(map.fog.color);
  scene.fog.density = map.fog.density;

  sun.color.set(map.sun.color);
  sun.intensity = map.sun.intensity;
  sun.position.set(...map.sun.pos);

  // Keep the shadow frustum tight around whatever this map actually spans.
  const span = Math.max(map.bounds.maxX - map.bounds.minX, map.bounds.maxZ - map.bounds.minZ) * 0.62;
  sun.shadow.camera.left = -span;
  sun.shadow.camera.right = span;
  sun.shadow.camera.top = span;
  sun.shadow.camera.bottom = -span;
  sun.shadow.camera.updateProjectionMatrix();

  hemi.color.set(map.hemi.sky);
  hemi.groundColor.set(map.hemi.ground);
  hemi.intensity = map.hemi.intensity;

  ambient.color.set(map.ambient.color);
  ambient.intensity = map.ambient.intensity;
}

let loadedMapId = null;

function loadMap(id) {
  if (id === loadedMapId) return;    // the lobby already put us in this one
  disposeMap(builtMap, scene);
  builtMap = buildMap(id, { colliders, arena: ARENA });
  scene.add(builtMap.root);
  spawnPoints = builtMap.spawnPoints;
  applyEnvironment(builtMap.map);
  buildMinimapBase();
  // Bot pathfinding is built from the map's colliders, so it has to follow
  // the map — a field from the old geometry routes them into new walls.
  bots.rebuildNav(colliders, ARENA, 0);
  loadedMapId = id;
}

// -------------------- lobby backdrop --------------------
// The menu hangs over the arena you are about to drop into, drifting around
// it, rather than over a flat gradient — the map card and the view agree.

let lobbyAngle = 0.6;

function lobbyMapId() { return currentMode().forceMap || loadout.mapId; }

function refreshLobbyMap() {
  if (gameState !== "menu") return;
  loadMap(lobbyMapId());
}

function updateLobbyCamera(dt) {
  lobbyAngle += dt * 0.05;
  const cx = (ARENA.minX + ARENA.maxX) / 2;
  const cz = (ARENA.minZ + ARENA.maxZ) / 2;
  const span = Math.max(ARENA.maxX - ARENA.minX, ARENA.maxZ - ARENA.minZ);
  const r = span * 0.44;
  camera.position.set(
    cx + Math.cos(lobbyAngle) * r,
    13 + Math.sin(lobbyAngle * 0.7) * 2.5,
    cz + Math.sin(lobbyAngle) * r
  );
  camera.lookAt(cx, 2.4, cz);
  if (camera.fov !== baseFov) {
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
  }
}

// -------------------- minimap --------------------
// Static geometry is drawn once per map into an offscreen canvas and blitted
// each frame, so only the handful of moving dots costs anything.

const minimapCanvas = document.getElementById("to-minimap");
const minimapCtx = minimapCanvas.getContext("2d");
const minimapBase = document.createElement("canvas");
minimapBase.width = minimapCanvas.width;
minimapBase.height = minimapCanvas.height;

function mapToMinimap(x, z) {
  const w = ARENA.maxX - ARENA.minX;
  const d = ARENA.maxZ - ARENA.minZ;
  const pad = 6;
  const size = minimapCanvas.width - pad * 2;
  return [
    pad + ((x - ARENA.minX) / w) * size,
    pad + ((z - ARENA.minZ) / d) * size,
  ];
}

function buildMinimapBase() {
  const ctx = minimapBase.getContext("2d");
  ctx.clearRect(0, 0, minimapBase.width, minimapBase.height);
  ctx.fillStyle = "rgba(150,170,140,.16)";
  ctx.strokeStyle = "rgba(190,210,180,.28)";
  ctx.lineWidth = 1;
  for (const c of colliders) {
    if (c.min.y > 1.6) continue;           // overhead structures aren't walls
    const [x0, z0] = mapToMinimap(c.min.x, c.min.z);
    const [x1, z1] = mapToMinimap(c.max.x, c.max.z);
    ctx.fillRect(x0, z0, Math.max(1, x1 - x0), Math.max(1, z1 - z0));
    ctx.strokeRect(x0, z0, Math.max(1, x1 - x0), Math.max(1, z1 - z0));
  }
}

function drawMinimap() {
  const ctx = minimapCtx;
  const size = minimapCanvas.width;
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(minimapBase, 0, 0);

  if (hill) {
    const [hx, hz] = mapToMinimap(hill.position.x, hill.position.z);
    const r = (hill.radius / (ARENA.maxX - ARENA.minX)) * (size - 12);
    ctx.strokeStyle = "rgba(127,224,102,.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hx, hz, Math.max(4, r), 0, Math.PI * 2);
    ctx.stroke();
  }

  if (isPvp()) {
    for (const rp of remotes.byId.values()) {
      if (!rp.alive) continue;
      const [x, z] = mapToMinimap(rp.pos.x, rp.pos.z);
      ctx.fillStyle = rp.team === net.team ? "#7fd1e0" : "#ff6b5a";
      ctx.beginPath();
      ctx.arc(x, z, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (zdir) {
    for (const z of zdir.zombies) {
      if (!z.alive || z.dying) continue;
      const [mx, mz] = mapToMinimap(z.mesh.position.x, z.mesh.position.z);
      // only the ones sharing our floor, or the map reads as a swarm
      const sameFloor = Math.abs(z.groundY - move.pos.y) < 2.5;
      ctx.fillStyle = sameFloor ? "#8fd15a" : "rgba(143,209,90,.25)";
      ctx.beginPath();
      ctx.arc(mx, mz, sameFloor ? 2.8 : 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (spawner) {
    ctx.fillStyle = "#ff6b5a";
    for (const g of spawner.grunts) {
      if (!g.alive || g.dying) continue;
      const [x, z] = mapToMinimap(g.mesh.position.x, g.mesh.position.z);
      ctx.beginPath();
      ctx.arc(x, z, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // us, as an arrow pointing where we're looking
  const [px, pz] = mapToMinimap(move.pos.x, move.pos.z);
  ctx.save();
  ctx.translate(px, pz);
  ctx.rotate(-look.yaw);
  ctx.fillStyle = "#eaf5e4";
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4, 5);
  ctx.lineTo(0, 2.5);
  ctx.lineTo(-4, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// King of the Hill's capture ring — an open cylinder so you can see through it.
let hillMarker = null;
function setHillMarker(h) {
  if (!hillMarker) {
    hillMarker = new THREE.Mesh(
      new THREE.CylinderGeometry(6, 6, 2.6, 32, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x7fe066, transparent: true, opacity: 0.22,
        side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    hillMarker.userData.noBulletCollide = true;
    scene.add(hillMarker);
  }
  hillMarker.visible = !!h;
  if (h) {
    const p = h.position;
    hillMarker.position.set(p.x, 1.3, p.z);
  }
}

// Bomb site rings — a flat disc plus a floating letter, one pair per map,
// built once and repositioned/hidden rather than rebuilt every match.
let bombSiteMarkers = [];
function makeSiteLabel(letter) {
  const canvas = document.createElement("canvas");
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.font = "bold 84px 'DM Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(0,0,0,.85)";
  ctx.strokeText(letter, 64, 68);
  ctx.fillStyle = "#ff8a5a";
  ctx.fillText(letter, 64, 68);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set(1.6, 1.6, 1);
  sprite.renderOrder = 20;
  return sprite;
}

function setBombSiteMarkers(sites) {
  for (const m of bombSiteMarkers) scene.remove(m.ring, m.label);
  bombSiteMarkers = [];
  if (!sites) return;
  for (const site of sites) {
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(5, 5, 0.1, 32),
      new THREE.MeshBasicMaterial({ color: 0xff8a5a, transparent: true, opacity: 0.28, depthWrite: false }),
    );
    ring.userData.noBulletCollide = true;
    const y = groundHeightAt(colliders, site.x, site.z, 40) ?? 0;
    ring.position.set(site.x, y + 0.06, site.z);
    scene.add(ring);
    const label = makeSiteLabel(site.id);
    label.position.set(site.x, y + 2.4, site.z);
    scene.add(label);
    bombSiteMarkers.push({ ring, label, site });
  }
}

// -------------------- postprocessing --------------------

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.5, 0.82);
composer.addPass(bloom);
const impactPass = new ShaderPass(ImpactShader);
composer.addPass(impactPass);
composer.addPass(new OutputPass());

// -------------------- weapon view models --------------------
// Rendered in a separate scene/camera overlay so the tiny gun mesh never
// suffers near-plane distortion or scale mismatch with the world FOV.

const weaponScene = new THREE.Scene();
const weaponCamera = new THREE.PerspectiveCamera(58, 16 / 9, 0.01, 10);
const weaponRig = new THREE.Group();
weaponScene.add(weaponRig);

const weaponKeyLight = new THREE.DirectionalLight(0xfff2d8, 3.2);
weaponKeyLight.position.set(0.5, 1.2, 1);
weaponScene.add(weaponKeyLight);
const weaponRimLight = new THREE.DirectionalLight(0x8fb0ff, 1.8);
weaponRimLight.position.set(-0.6, 0.4, -1);
weaponScene.add(weaponRimLight);
const weaponFillLight = new THREE.AmbientLight(0xaab8ff, 1.1);
weaponScene.add(weaponFillLight);

scene.add(camera);


// Only the equipped weapon is built, and it's rebuilt whenever the loadout
// changes, because attachments alter the geometry.
let activeWeaponMesh = null;

function setActiveWeaponMesh(def) {
  if (activeWeaponMesh) {
    weaponRig.remove(activeWeaponMesh);
    activeWeaponMesh.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose?.();
    });
  }
  activeWeaponMesh = buildWeaponMesh(def);
  weaponRig.add(activeWeaponMesh);
}

let activeMeleeMesh = null;

function setActiveMeleeMesh(def) {
  if (activeMeleeMesh) {
    weaponRig.remove(activeMeleeMesh);
    activeMeleeMesh.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose?.();
    });
  }
  activeMeleeMesh = buildMeleeMesh(def);
  activeMeleeMesh.visible = false;
  weaponRig.add(activeMeleeMesh);
}

// muzzle flash sprite
const muzzleMat = makeMuzzleFlashMaterial();
const muzzleFlash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), muzzleMat);
muzzleFlash.rotation.z = Math.random() * Math.PI;
weaponRig.add(muzzleFlash);
let muzzleFlashT = 0;

// muzzle point light for dynamic illumination on each shot. Intensity stays
// small because the light sits centimetres from the gun mesh in the weapon
// overlay — anything near the old 3.2 blew the whole screen out to white
// under ACES tone mapping at this range.
const muzzleLight = new THREE.PointLight(0xffcf8a, 0, 1.2, 2);
weaponRig.add(muzzleLight);

// -------------------- tracers / impact sparks pools --------------------

const sparkGeo = new THREE.BufferGeometry();
const SPARK_MAX = 400;
const sparkPositions = new Float32Array(SPARK_MAX * 3);
const sparkLife = new Float32Array(SPARK_MAX);
sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
sparkGeo.setAttribute("aLife", new THREE.BufferAttribute(sparkLife, 1));
const sparkMat = makeImpactSparkMaterial();
const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
sparkPoints.frustumCulled = false;
scene.add(sparkPoints);

const sparks = []; // {idx, vel, life, maxLife}
let sparkCursor = 0;
function spawnImpactBurst(pos, color, count = 10) {
  sparkMat.uniforms.uColor.value.set(color);
  for (let i = 0; i < count; i++) {
    const idx = sparkCursor % SPARK_MAX;
    sparkCursor++;
    const vel = new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3 + 1, (Math.random() - 0.5) * 4);
    sparks[idx] = { pos: pos.clone(), vel, life: 0.4, maxLife: 0.4 };
  }
}

function updateSparks(dt) {
  for (let i = 0; i < SPARK_MAX; i++) {
    const s = sparks[i];
    if (!s) { sparkPositions[i * 3 + 1] = -1000; sparkLife[i] = 0; continue; }
    s.life -= dt;
    if (s.life <= 0) { sparks[i] = null; sparkPositions[i * 3 + 1] = -1000; sparkLife[i] = 0; continue; }
    s.vel.y -= 9.8 * dt;
    s.pos.addScaledVector(s.vel, dt);
    sparkPositions[i * 3] = s.pos.x;
    sparkPositions[i * 3 + 1] = s.pos.y;
    sparkPositions[i * 3 + 2] = s.pos.z;
    sparkLife[i] = s.life / s.maxLife;
  }
  sparkGeo.attributes.position.needsUpdate = true;
  sparkGeo.attributes.aLife.needsUpdate = true;
}

// -------------------- player state --------------------

const player = {
  pos: new THREE.Vector3(0, 1.7, 8), // eye position, mirrored from `move` each frame
  hp: 100,
  maxHp: 100,
  weaponId: "problem416",
  secondaryId: null,     // set by equipFromLoadout when the mode allows one
  weapons: {},
  kills: 0,
  deaths: 0,
  wave: 0,
  alive: true,
  melee: null,          // MeleeState, rebuilt from the loadout on every spawn
  holding: "gun",       // "gun" | "melee"
  gear: { lethal: 0, tactical: 0 },
  spawnGuard: 0,        // seconds of spawn protection left; broken by firing
  assists: 0,
  headshots: 0,
  streak: 0,            // kills since last death
  bestStreak: 0,
  matchXp: 0,           // XP banked during this match, shown on the result screen
};

// Which slot (primary/secondary) currentWeapon() resolves against - reset
// to primary on every spawn/equip so a fresh life always starts on the
// main gun regardless of what was held when the last one ended.
let currentWeaponSlot = "primary";

/* One in the hand: which throwable is cooking, and how much fuse is left. */
const cooking = { def: null, fuse: 0, slot: null };
let blindT = 0;         // seconds of flashbang whiteout left
let empT = 0;           // seconds of EMP scramble left — HUD and optics down
let shakeT = 0, shakeMag = 0;

const move = new MovementController({ colliders, arena: ARENA });
const bullets = new BulletSystem(scene);
const remotes = new RemotePlayers(scene);
const pickups = new PickupSystem(scene);
const swapHold = new SwapHold();

// Look is composed by hand rather than by PointerLockControls: recoil and the
// touch stick both need to write into the same orientation, and letting PLC
// own the camera quaternion made them fight each other.
const look = { yaw: 0, pitch: 0 };
const BASE_MOUSE_SENS = 0.0022;
const PITCH_LIMIT = 1.5;

const controls = new EventTarget();
controls.isLocked = false;
// requestPointerLock rejects (not throws) when the document isn't focused,
// so swallow it rather than surfacing an unhandled rejection.
controls.lock = () => { try { renderer.domElement.requestPointerLock?.()?.catch?.(() => {}); } catch { /* unsupported */ } };
controls.unlock = () => { try { document.exitPointerLock?.(); } catch { /* not locked */ } };

document.addEventListener("pointerlockchange", () => {
  const locked = document.pointerLockElement === renderer.domElement;
  controls.isLocked = locked;
  controls.dispatchEvent(new Event(locked ? "lock" : "unlock"));
});
document.addEventListener("mousemove", (e) => {
  if (!controls.isLocked) return;
  const sens = BASE_MOUSE_SENS * (settings.sens / 100);
  look.yaw -= e.movementX * sens;
  look.pitch += (settings.invert ? 1 : -1) * e.movementY * sens;
  look.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, look.pitch));
});

let spawner = null;

const keys = new Set();
window.addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (e.code === "KeyR") tryReload();
  if (e.code === "KeyT" && !e.repeat) startInspect();
  if (e.code === "KeyV" && !e.repeat) swingMelee();
  if (e.code === "Digit1") switchWeapon("primary");
  if (e.code === "Digit2") switchWeapon("secondary");
  if (e.code === "Digit3") setHolding("melee");
  if (e.code === "KeyG" && !e.repeat) startCook("lethal");
  if (e.code === "KeyF" && !e.repeat) startCook("tactical");
  // Range-only live tuning, so a sensitivity change can be felt immediately.
  if (isRange() && gameState === "playing") {
    if (e.code === "Minus") nudgeSetting("sens", -5, 20, 300);
    if (e.code === "Equal") nudgeSetting("sens", 5, 20, 300);
    if (e.code === "BracketLeft") nudgeSetting("fov", -1, 60, 100);
    if (e.code === "BracketRight") nudgeSetting("fov", 1, 60, 100);
  }
  if (e.code === "Space" && gameState === "playing") e.preventDefault();
  if (e.code === "Tab" && gameState === "playing" && isPvp()) {
    e.preventDefault();
    renderScoreboard();
    els.scoreboard.hidden = false;
  }
});
window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
  if (e.code === "Tab") els.scoreboard.hidden = true;
  if ((e.code === "KeyG" && cooking.slot === "lethal")
    || (e.code === "KeyF" && cooking.slot === "tactical")) releaseCook();
});

function renderScoreboard() {
  const rows = [{ name: `${playerName()} (you)`, team: net.team, kills: player.kills, you: true }];
  for (const p of net.peers.values()) {
    rows.push({ name: p.name, team: p.team, kills: p.kills | 0, you: false });
  }
  let html = "";
  for (const teamId of ["phantom", "ghost"]) {
    const team = TEAMS[teamId];
    const members = rows.filter((r) => r.team === teamId).sort((a, b) => b.kills - a.kills);
    html += `<div class="to-sb-team"><div class="to-sb-head">`
      + `<span style="color:${team.ui}">${team.name}</span><span>${teamScores[teamId]}</span></div>`;
    html += members.length
      ? members.map((r) => `<div class="to-sb-row${r.you ? " is-you" : ""}">`
          + `<span>${escapeHtml(r.name)}</span><span>${r.kills} kills</span></div>`).join("")
      : `<div class="to-sb-row"><span>—</span><span></span></div>`;
    html += `</div>`;
  }
  els.scoreboard.innerHTML = html;
}

// Peer names come off the wire, so they are never trusted as markup.
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

let mouseDown = false, adsHeld = false;
renderer.domElement.addEventListener("mousedown", (e) => {
  if (!controls.isLocked) return;
  if (e.button === 0) mouseDown = true;
  if (e.button === 2) adsHeld = true;   // PF parity: right mouse aims
});
window.addEventListener("mouseup", (e) => {
  if (e.button === 0) mouseDown = false;
  if (e.button === 2) adsHeld = false;
});
renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());

// -------------------- touch controls --------------------

const touchState = {
  moveX: 0, moveY: 0, lookDX: 0, lookDY: 0,
  firing: false, ads: false, jump: false,
  crouch: false, dive: false, interact: false, swap: false,
};

function bindStick(el, nub) {
  let active = false, startX = 0, startY = 0, id = null;
  el.addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0];
    active = true; id = t.identifier; startX = t.clientX; startY = t.clientY;
  }, { passive: true });
  el.addEventListener("touchmove", (e) => {
    if (!active) return;
    for (const t of e.changedTouches) {
      if (t.identifier !== id) continue;
      let dx = t.clientX - startX, dy = t.clientY - startY;
      const max = 40;
      dx = Math.max(-max, Math.min(max, dx));
      dy = Math.max(-max, Math.min(max, dy));
      touchState.moveX = dx / max;
      touchState.moveY = dy / max;
      if (nub) nub.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }
  }, { passive: true });
  const end = (e) => {
    for (const t of e.changedTouches) if (t.identifier === id) { active = false; touchState.moveX = 0; touchState.moveY = 0; if (nub) nub.style.transform = "translate(-50%,-50%)"; }
  };
  el.addEventListener("touchend", end);
  el.addEventListener("touchcancel", end);
}
bindStick(els.touchMove, els.touchMoveNub);

(function bindLook() {
  let id = null, lastX = 0, lastY = 0;
  els.touchLook.addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0];
    id = t.identifier; lastX = t.clientX; lastY = t.clientY;
  }, { passive: true });
  els.touchLook.addEventListener("touchmove", (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== id) continue;
      touchState.lookDX += (t.clientX - lastX) * 0.0028;
      touchState.lookDY += (t.clientY - lastY) * 0.0028;
      lastX = t.clientX; lastY = t.clientY;
    }
  }, { passive: true });
  const end = (e) => { for (const t of e.changedTouches) if (t.identifier === id) id = null; };
  els.touchLook.addEventListener("touchend", end);
  els.touchLook.addEventListener("touchcancel", end);
})();

function bindHold(el, onDown, onUp) {
  el.addEventListener("touchstart", (e) => { e.preventDefault(); el.classList.add("is-held"); onDown(); }, { passive: false });
  el.addEventListener("touchend", (e) => { e.preventDefault(); el.classList.remove("is-held"); onUp(); });
  el.addEventListener("touchcancel", () => { el.classList.remove("is-held"); onUp(); });
}
bindHold(els.touchFire, () => touchState.firing = true, () => touchState.firing = false);
bindHold(els.touchAds, () => touchState.ads = true, () => touchState.ads = false);
bindHold(els.touchJump, () => touchState.jump = true, () => touchState.jump = false);
bindHold(els.touchSlide, () => touchState.crouch = true, () => touchState.crouch = false);
els.touchReload.addEventListener("touchstart", (e) => { e.preventDefault(); tryReload(); });
els.touchMelee.addEventListener("touchstart", (e) => { e.preventDefault(); swingMelee(); });
// Touch cooks for as long as the button is held, same as the key.
bindHold(els.touchNade, () => startCook("lethal"), () => releaseCook());
bindHold(els.touchInteract, () => touchState.interact = true, () => touchState.interact = false);
bindHold(els.touchSwap, () => touchState.swap = true, () => touchState.swap = false);

// -------------------- gamepad --------------------

function deadzone(v) { return Math.abs(v) < GP_DEADZONE ? 0 : v; }

/* Controller aim assist — a soft rotational pull toward whoever is already
   near the crosshair, the way GTA5's "assisted aim" (not the full auto-lock
   option) nudges a stick-and-trigger aim rather than replacing it. Mouse
   play never touches this; a controller reticle just moves slower and less
   precisely than a mouse cursor, so this buys back some of that gap instead
   of asking for full aim-bot lock. */
const AIM_ASSIST_CONE = Math.cos(THREE.MathUtils.degToRad(7));   // ~14° wide search cone
const AIM_ASSIST_SLOWDOWN_CONE = Math.cos(THREE.MathUtils.degToRad(3.5));
const AIM_ASSIST_RANGE = 55;
const AIM_ASSIST_PULL = 3.4;       // rad/sec at the very centre of a lock
const AIM_ASSIST_SLOWDOWN = 0.45;  // multiplies the player's own stick turn near a target
const _aaOrigin = new THREE.Vector3();
const _aaForward = new THREE.Vector3();
const _aaToTarget = new THREE.Vector3();

/* Best enemy to assist toward right now, or null. Picks whoever is closest
   to the crosshair (not just closest in space) among enemies inside the
   search cone, alive, and with actual line of sight. */
function findAimAssistTarget() {
  camera.getWorldPosition(_aaOrigin);
  camera.getWorldDirection(_aaForward);

  let best = null, bestDot = -Infinity;
  for (const o of occupants()) {
    if (o.id === net.id) continue;
    const enemy = currentMode().ffa || o.team !== net.team;
    if (!enemy) continue;

    _aaToTarget.set(o.pos.x - _aaOrigin.x, o.pos.y + 1.3 - _aaOrigin.y, o.pos.z - _aaOrigin.z);
    const dist = _aaToTarget.length();
    if (dist < 0.01 || dist > AIM_ASSIST_RANGE) continue;
    _aaToTarget.multiplyScalar(1 / dist);

    const dot = _aaToTarget.dot(_aaForward);
    if (dot < AIM_ASSIST_CONE) continue;
    if (segmentBlocked(colliders, _aaOrigin, { x: o.pos.x, y: o.pos.y + 1.3, z: o.pos.z })) continue;

    if (dot > bestDot) { bestDot = dot; best = { pos: o.pos, dot }; }
  }
  return best;
}

/* Blends a rotational pull toward `target` into the pending look delta, and
   damps the player's own stick turn when it's already close — the "sticky"
   half GTA5 pairs with the pull. Both effects fall off with angle so the
   assist never overrides a deliberate flick past the target. */
function applyAimAssist(dt) {
  if (!settings.aimAssist) return;
  const target = findAimAssistTarget();
  if (!target) return;

  camera.getWorldPosition(_aaOrigin);
  _aaToTarget.set(target.pos.x - _aaOrigin.x, target.pos.y + 1.3 - _aaOrigin.y, target.pos.z - _aaOrigin.z).normalize();

  // Desired yaw/pitch to look straight at the target, minus what we're
  // already facing — small angular deltas pulled toward zero.
  const desiredYaw = Math.atan2(-_aaToTarget.x, -_aaToTarget.z);
  const desiredPitch = Math.asin(THREE.MathUtils.clamp(_aaToTarget.y, -1, 1));
  let dYaw = desiredYaw - look.yaw;
  while (dYaw > Math.PI) dYaw -= Math.PI * 2;
  while (dYaw < -Math.PI) dYaw += Math.PI * 2;
  const dPitch = desiredPitch - look.pitch;

  // Pull strength eases out toward the edge of the cone rather than cutting
  // off sharply, so entering/leaving lock doesn't feel like a snap.
  const edge = (target.dot - AIM_ASSIST_CONE) / (1 - AIM_ASSIST_CONE);
  const pull = AIM_ASSIST_PULL * edge * dt;
  look.yaw += THREE.MathUtils.clamp(dYaw, -pull, pull);
  look.pitch += THREE.MathUtils.clamp(dPitch, -pull, pull);

  if (target.dot > AIM_ASSIST_SLOWDOWN_CONE) {
    gamepadState.lookDX *= AIM_ASSIST_SLOWDOWN;
    gamepadState.lookDY *= AIM_ASSIST_SLOWDOWN;
  }
}

function pollGamepad(dt) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = gpIndex != null ? pads[gpIndex] : null;
  if (!gp) gp = Array.from(pads).find((p) => p && p.connected) || null;
  if (!gp) { gamepadState.connected = false; renderGpDebug(null); return; }
  gpIndex = gp.index;
  gamepadState.connected = true;
  if (gpDebugForced || gp.mapping !== "standard") renderGpDebug(gp);
  else if (gpDebugEl && !gpDebugEl.hidden) gpDebugEl.hidden = true;

  gamepadState.moveX = deadzone(gp.axes[0] || 0);
  gamepadState.moveY = deadzone(gp.axes[1] || 0);
  const lookX = deadzone(gp.axes[2] || 0);
  const lookY = deadzone(gp.axes[3] || 0);
  const sens = BASE_MOUSE_SENS * (settings.sens / 100) * 42;
  gamepadState.lookDX += lookX * sens * dt * 60;
  gamepadState.lookDY += lookY * sens * dt * 60 * (settings.invert ? -1 : 1);

  if (player.alive && !isStaging()) applyAimAssist(dt);

  const btn = (i) => !!gp.buttons[i]?.pressed;
  const pressedEdge = (i) => btn(i) && !gpPrev[i];

  const firingNow = gp.buttons[7]?.value > 0.15 || btn(7);   // R2
  if (firingNow && !gamepadState.firing) { fireEdgeTrigger = true; setTimeout(() => fireEdgeTrigger = false, 16); }
  gamepadState.firing = firingNow;
  gamepadState.ads = gp.buttons[6]?.value > 0.15 || btn(6);      // L2
  gamepadState.jump = btn(0);                                     // A / cross
  gamepadState.crouch = btn(1);                                   // B / circle

  if (pressedEdge(4)) tryReload();          // L1 -> reload (kept off fire face buttons)
  if (pressedEdge(2)) swingMelee();         // X / square -> melee
  if (pressedEdge(3)) setHolding(player.holding === "gun" ? "melee" : "gun"); // Y / triangle
  if (pressedEdge(5)) startCook("lethal");  // R1 -> cook nade
  if (gpPrev[5] && !btn(5)) releaseCook();
  if (pressedEdge(9)) {                     // Start/Home -> same as the on-screen gear icon
    if (controls.isLocked) controls.unlock();
    else { gameState = "paused"; els.pause.hidden = false; }
  }

  gpPrev = {};
  for (let i = 0; i < gp.buttons.length; i++) gpPrev[i] = btn(i);
}

// Start/Home resumes from the pause menu the same way it opened it — kept
// separate from pollGamepad since that only runs during gameState==="playing".
let gpMenuPrev = {};
function pollGamepadMenu() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = (gpIndex != null ? pads[gpIndex] : null) || Array.from(pads).find((p) => p && p.connected) || null;
  if (!gp) { gpMenuPrev = {}; return; }
  const pressed = !!gp.buttons[9]?.pressed;
  if (pressed && !gpMenuPrev[9]) { if (!isTouch) controls.lock(); else { gameState = "playing"; els.pause.hidden = true; } }
  gpMenuPrev = { 9: pressed };
}

// -------------------- HUD helpers --------------------

/* Accepts a plain string (joins, leaves, Ops points) or a structured kill.
   A kill reads "killer — weapon → victim", with the headshot marked and both
   names in their team colour, so the feed says what happened rather than just
   that something did. */
function pushKillfeed(entry) {
  const div = document.createElement("div");
  div.className = "to-kf-item";

  if (typeof entry === "string") {
    div.textContent = entry;
  } else {
    if (entry.mine) div.classList.add("is-mine");

    const nameSpan = (text, team) => {
      const s = document.createElement("span");
      s.className = "to-kf-name";
      // `.ui` is the CSS string; `.color` is a hex number for three.js.
      if (team && TEAMS[team]) s.style.color = TEAMS[team].ui;
      s.textContent = text;
      return s;
    };

    div.appendChild(nameSpan(entry.killer, entry.killerTeam));

    if (entry.assist) {
      const tag = document.createElement("span");
      tag.className = "to-kf-tag";
      tag.textContent = "assist";
      div.appendChild(tag);
    } else {
      if (entry.weapon) {
        const w = document.createElement("span");
        w.className = "to-kf-weapon";
        w.textContent = entry.weapon;
        div.appendChild(w);
      }
      if (entry.head) {
        const h = document.createElement("span");
        h.className = "to-kf-head";
        h.textContent = "HS";
        h.title = "Headshot";
        div.appendChild(h);
      }
    }

    const arrow = document.createElement("span");
    arrow.className = "to-kf-arrow";
    arrow.textContent = "→";
    div.appendChild(arrow);
    div.appendChild(nameSpan(entry.victim, entry.victimTeam));
  }

  els.killfeed.appendChild(div);
  // Keep the feed from growing without bound in a busy match.
  while (els.killfeed.children.length > 6) els.killfeed.firstChild.remove();
  setTimeout(() => div.remove(), 2700);
}

function showHitmarker(isCrit, damage = 0, point = null) {
  audio.hitmarker(isCrit);
  els.hitmarker.classList.remove("pop");
  els.hitmarker.classList.toggle("is-crit", isCrit);
  void els.hitmarker.offsetWidth;
  els.hitmarker.classList.add("pop");
  if (damage > 0 && point) spawnDamageNumber(damage, point, isCrit);
}

/* Damage numbers that live in the world: they start at the point the round
   actually landed and drift up from there, so a burst across a moving target
   leaves a legible trail instead of stacking in the middle of the screen. */
const damageNumbers = [];
const DAMAGE_NUMBER_LIFE = 0.9;

function spawnDamageNumber(damage, point, isCrit) {
  const el = document.createElement("span");
  el.className = "to-dmg-num" + (isCrit ? " is-crit" : "");
  el.textContent = String(Math.round(damage));
  els.damageNumbers.appendChild(el);
  damageNumbers.push({
    el,
    pos: point.clone(),
    life: DAMAGE_NUMBER_LIFE,
    // A little sideways drift keeps rapid hits from printing on top of
    // each other.
    drift: (Math.random() - 0.5) * 26,
  });
  // A long burst on several targets could otherwise pile up unbounded.
  while (damageNumbers.length > 24) {
    damageNumbers.shift().el.remove();
  }
}

const _dmgProject = new THREE.Vector3();

function updateDamageNumbers(dt) {
  for (let i = damageNumbers.length - 1; i >= 0; i--) {
    const d = damageNumbers[i];
    d.life -= dt;
    if (d.life <= 0) { d.el.remove(); damageNumbers.splice(i, 1); continue; }

    const t = 1 - d.life / DAMAGE_NUMBER_LIFE;
    _dmgProject.copy(d.pos).project(camera);
    // Behind the camera projects to a mirrored on-screen point, so hide it.
    if (_dmgProject.z > 1) { d.el.style.opacity = "0"; continue; }

    const x = (_dmgProject.x * 0.5 + 0.5) * window.innerWidth + d.drift * t;
    const y = (-_dmgProject.y * 0.5 + 0.5) * window.innerHeight - t * 46;
    d.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${(1 + (1 - t) * 0.25).toFixed(2)})`;
    d.el.style.opacity = String(Math.min(1, d.life / 0.35));
  }
}

function clearDamageNumbers() {
  for (const d of damageNumbers) d.el.remove();
  damageNumbers.length = 0;
}

let hitFlashT = 0;
function flashHit() {
  hitFlashT = 1;
}

function showWaveBanner(text, ms = 1800) {
  els.waveBanner.textContent = text;
  els.waveBanner.classList.add("is-visible");
  clearTimeout(showWaveBanner._t);
  showWaveBanner._t = setTimeout(() => els.waveBanner.classList.remove("is-visible"), ms);
}

// -------------------- weapon actions --------------------

function currentWeapon() {
  const id = currentWeaponSlot === "secondary" ? player.secondaryId : player.weaponId;
  return player.weapons[id] || player.weapons[player.weaponId];
}

function tryReload() {
  if (!controls.isLocked && !isTouch && !gamepadState.connected) return;
  if (currentWeapon().startReload()) audio.reload();
}

function fireOnce() {
  const w = currentWeapon();
  const def = w.def;
  if (!w.canFire()) {
    if (w.ammoInMag <= 0 && !w.reloading) tryReload();
    return;
  }
  w.fire();
  inspectT = 0;      // shooting always wins over the flourish
  breakSpawnGuard();
  audio.shot(def);
  muzzleFlashT = 0.045;
  muzzleLight.intensity = 0.35;

  // Part of the kick is permanent climb the player has to pull back down —
  // that's what makes recoil control a skill rather than a wait.
  look.pitch = Math.min(PITCH_LIMIT, look.pitch + def.recoilKickPitch * 0.35 * (1 - w.adsT * 0.35));

  const pellets = def.pellets || 1;
  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);

  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  const muzzle = origin.clone().addScaledVector(forward, 0.35);
  if (isPvp()) net.reportShot(muzzle, forward, def.id);

  for (let i = 0; i < pellets; i++) {
    const spread = def.pelletSpread != null ? def.pelletSpread : w.spread;
    // Uniform disc around the aim axis — an even cone, unlike the old
    // world-axis rotation which skewed badly when looking up or down.
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * spread * 0.5;
    const dir = forward.clone()
      .addScaledVector(right, Math.cos(a) * r)
      .addScaledVector(up, Math.sin(a) * r)
      .normalize();
    bullets.spawn({ origin: muzzle.clone(), dir, def, ownerId: "player" });
  }
}

function resolveBulletTarget(object) {
  return rangeSet?.resolve(object)
    || remotes.resolve(object)
    || zdir?.resolve(object)
    || findGruntFromObject(object);
}

function onBulletActorHit(actor, info) {
  if (actor.isRangeTarget) {
    const { killed } = actor.takeDamage(info.damage, info.isHead);
    showHitmarker(info.isHead, info.damage, info.point);
    spawnImpactBurst(info.point, info.isHead ? 0xffe27a : 0xbfc4b8, info.isHead ? 14 : 7);
    reportRangeShot(actor, info, killed);
    return;
  }

  if (actor.isZombie) {
    const { killed, points } = actor.takeDamage(info.damage, info.isHead);
    zdir.award(points);
    showHitmarker(info.isHead, info.damage, info.point);
    spawnImpactBurst(info.point, info.isHead ? 0xffe27a : 0x8fd15a, info.isHead ? 16 : 8);
    if (killed) {
      zdir.kills++;
      player.kills++;
      audio.kill();
      pushKillfeed(`${info.isHead ? "Headshot — " : ""}+${points}`);
    }
    return;
  }

  // Remote players own their own health: we report the hit and they apply it.
  if (actor.netId) {
    noteDealt(actor.netId, info.damage);
    // Our own bots never hear our broadcasts, so resolve those locally.
    const shotWith = currentWeapon().def.id;
    if (bots.byId(actor.netId)) {
      const { killed, bot } = bots.applyHit(actor.netId, info.damage);
      if (killed) {
        dealtLog.delete(actor.netId);
        net.reportDeathAs(actor.netId, net.id, shotWith, info.isHead);
        registerDeath(bot.name, net.id, shotWith, {
          head: info.isHead, victimTeam: bot.team,
          victimPos: bot.pos, victimWeaponId: bot.weaponId,
        });
      }
    } else {
      net.reportHit(actor.netId, info.damage, info.isHead, shotWith);
    }
    showHitmarker(info.isHead, info.damage, info.point);
    spawnImpactBurst(info.point, info.isHead ? 0xffe27a : 0xff8a5a, info.isHead ? 16 : 8);
    return;
  }
  onGruntBulletHit(actor, info);
}

function onGruntBulletHit(grunt, { damage, isHead, point, dir }) {
  const knockDir = dir.clone(); knockDir.y = 0; knockDir.normalize();
  const result = grunt.takeDamage(damage, isHead, knockDir);
  showHitmarker(isHead, damage, point);
  spawnImpactBurst(point, isHead ? 0xffe27a : 0xff8a5a, isHead ? 16 : 8);
  if (result.killed) {
    player.kills++;
    els.hudKills.textContent = String(player.kills);
    pushKillfeed(`${isHead ? "Headshot — " : ""}Grunt down`);
  }
}

function findGruntFromObject(obj) {
  let o = obj;
  while (o) {
    if (o.userData && o.userData.dissolveMat) {
      const grunt = spawner.grunts.find((g) => g.mesh === o);
      if (grunt) return grunt;
    }
    o = o.parent;
  }
  return null;
}

// -------------------- melee + throwables --------------------

const grenades = new GrenadeSystem(scene);

/* Whatever the bullets are allowed to hit this frame. Hoisted out of the
   frame loop because melee and blasts need the same list. */
let targetMeshes = [];

/* Everything alive that a blast could reach, as { actor, pos } pairs. The
   three enemy systems keep their own arrays, so this is the one place that
   has to know about all of them. */
function blastCandidates() {
  const out = [];
  if (zdir) {
    for (const z of zdir.zombies) {
      if (z.alive && !z.dying) out.push({ actor: z, pos: z.mesh.position });
    }
  }
  if (spawner) {
    for (const g of spawner.grunts) {
      if (g.alive && !g.dying) out.push({ actor: g, pos: g.mesh.position });
    }
  }
  for (const rp of remotes.byId.values()) {
    if (rp.alive) out.push({ actor: rp, pos: rp.pos });
  }
  if (rangeSet) {
    for (const t of rangeSet.targets) {
      if (t.down <= 0) out.push({ actor: t, pos: t.mesh.position });
    }
  }
  return out;
}

/* Radial damage. Torso height is added to each target so a grenade resting
   on the floor still measures to a standing chest, not a pair of boots. */
function areaDamage(centre, radius, damage, def, { fire = false } = {}) {
  const scaled = { ...def, radius, damage, minDamage: fire ? damage * 0.5 : def.minDamage };
  for (const { actor, pos } of blastCandidates()) {
    const torso = pos.clone();
    torso.y += 0.9;
    const dmg = blastDamage(scaled, centre.distanceTo(torso));
    if (dmg <= 0) continue;
    const dir = torso.clone().sub(centre);
    dir.y = 0;
    dir.normalize();
    onBulletActorHit(actor, { damage: dmg, isHead: false, point: torso, dir });
  }

  // Your own grenade counts. Cooking one too long has to cost you.
  if (player.alive) {
    const selfDmg = blastDamage(scaled, centre.distanceTo(player.pos)) * (def.selfMult ?? 1);
    if (selfDmg > 0) damagePlayer(selfDmg, net.id, def.id);
  }
}

/* Everything about a blast that isn't damage: light, sparks, sound, shove. */
function explosionFx(def, pos) {
  const big = def.kind === "tactical" ? 0.5 : 1;
  spawnImpactBurst(pos, def.glow, def.kind === "tactical" ? 14 : 26);

  const flash = new THREE.PointLight(def.glow, 260 * big, def.radius * 2.6, 2);
  flash.position.copy(pos);
  scene.add(flash);
  blastLights.push({ light: flash, life: 0.3, max: 0.3, peak: 260 * big });

  if (def.smoke) audio.smoke(pos);
  else if (def.emp) audio.emp(pos);
  else if (def.kind === "tactical") audio.flashbang(0, pos);
  else audio.explosion(big, pos);

  const near = Math.max(0, 1 - pos.distanceTo(player.pos) / (def.radius * 2));
  if (near > 0) { shakeMag = Math.max(shakeMag, near * 0.08); shakeT = 0.45; }
}

const blastLights = [];

function updateBlastLights(dt) {
  for (let i = blastLights.length - 1; i >= 0; i--) {
    const b = blastLights[i];
    b.life -= dt;
    b.light.intensity = Math.max(0, (b.life / b.max) * b.peak);
    if (b.life <= 0) { scene.remove(b.light); blastLights.splice(i, 1); }
  }
}

/* Flashbangs only blind what can see them, so a wall is real cover and
   turning away actually helps. */
function flashPlayer(pos, def) {
  const dist = pos.distanceTo(player.pos);
  // Smoke eats a flash the same way a wall does.
  if (dist <= def.radius && !segmentBlocked(colliders, player.pos, pos)
      && !grenades.blocksSight(player.pos, pos)) {
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const toBang = pos.clone().sub(player.pos).normalize();
    const facing = Math.max(0, forward.dot(toBang));   // 1 = staring right at it
    const strength = (1 - dist / def.radius) * (0.35 + facing * 0.65);
    blindT = Math.max(blindT, def.blind * strength);
    audio.flashbang(strength, pos);
  }

  for (const { actor, pos: apos } of blastCandidates()) {
    if (pos.distanceTo(apos) > def.radius) continue;
    if (segmentBlocked(colliders, apos, pos)) continue;
    if (grenades.blocksSight(apos, pos)) continue;
    actor.stun?.(def.stun);
  }
}

function applyEmpState(on) {
  els.emp.classList.toggle("is-on", on);
  els.hud.classList.toggle("to-emp-down", on);
}

/* EMP: no damage, no blindness — it takes your gear away. Optics go dark,
   the HUD scrambles, and the radar stops updating, so you have to fight the
   room on what you can actually see. Walls stop it; smoke doesn't. */
function empPlayer(pos, def) {
  const dist = pos.distanceTo(player.pos);
  if (dist > def.radius || segmentBlocked(colliders, player.pos, pos)) return;
  const strength = 1 - dist / def.radius;
  empT = Math.max(empT, def.emp.scramble * (0.4 + strength * 0.6));
  audio.empHit();

  for (const { actor, pos: apos } of blastCandidates()) {
    if (pos.distanceTo(apos) > def.radius) continue;
    if (segmentBlocked(colliders, apos, pos)) continue;
    // Bots run on sight, so scrambling them reads as a short stun.
    actor.stun?.(def.emp.scramble * 0.35);
  }
}

function grenadeCtx() {
  return {
    colliders,
    arena: builtMap ? builtMap.map.bounds : ARENA,
    onExplode: explosionFx,
    onAreaDamage: areaDamage,
    onFlash: flashPlayer,
    onEmp: empPlayer,
  };
}

function refillGear() {
  player.gear.lethal = loadout.lethal.carried;
  player.gear.tactical = loadout.tactical.carried;
}

/* Cooking: holding the key starts the fuse while the grenade is still in
   your hand. Impact throwables ignore it — they go off where they land. */
function startCook(slot) {
  if (cooking.def || !player.alive || gameState !== "playing" || isStaging()) return;
  if (player.gear[slot] <= 0) return;
  const def = slot === "lethal" ? loadout.lethal : loadout.tactical;
  cooking.def = def;
  cooking.slot = slot;
  cooking.fuse = def.fuse;
}

function releaseCook() {
  if (!cooking.def) return;
  const def = cooking.def;
  const slot = cooking.slot;
  cooking.def = null;
  cooking.slot = null;
  els.cook.hidden = true;
  if (player.gear[slot] <= 0) return;
  player.gear[slot]--;

  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  // Throws arc up a little, so aiming flat still lobs it somewhere useful.
  dir.y += 0.18;
  dir.normalize();
  origin.addScaledVector(dir, 0.6);

  grenades.throwGrenade(def, origin, dir, "player", { fuseLeft: cooking.fuse });
  breakSpawnGuard();
  audio.throwGear();
  updateGearHud();
}

/* Quick melee swings without putting the gun away; pressing 3 makes the
   melee weapon the thing in your hands, which swings and moves faster. */
function swingMelee() {
  if (!player.alive || move.busy || gameState !== "playing" || isStaging()) return;
  if (!player.melee || !player.melee.start()) return;
  breakSpawnGuard();
  audio.swing();
}

/* The swing itself: a short fan of rays rather than one, so a swing that is
   only nearly on target still connects the way a wide arc should. */
function meleeConnect() {
  const def = player.melee.def;
  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

  const ray = new THREE.Raycaster();
  ray.near = 0;
  ray.far = def.range;

  for (const off of [0, -def.arc / 2, def.arc / 2]) {
    const dir = forward.clone().addScaledVector(right, Math.tan(off)).normalize();
    ray.set(origin, dir);
    const hits = targetMeshes.length ? ray.intersectObjects(targetMeshes, true) : [];
    for (const h of hits) {
      const actor = resolveBulletTarget(h.object);
      if (!actor) continue;
      // A hit from behind is a backstab, decided by which way they face.
      let mult = 1;
      const root = actor.mesh || actor.group;
      if (root) {
        const theirs = new THREE.Vector3(Math.sin(root.rotation.y), 0, Math.cos(root.rotation.y));
        const swing = dir.clone();
        swing.y = 0;
        swing.normalize();
        if (theirs.dot(swing) > 0.35) mult = def.backstabMult;
      }
      audio.meleeHit();
      onBulletActorHit(actor, {
        damage: def.damage * mult,
        isHead: mult > 1,
        point: h.point,
        dir: dir.clone(),
      });
      return;
    }
  }
  audio.impact();
}

function setHolding(what) {
  if (player.holding === what) return;
  if (what === "melee" && !player.melee) return;
  player.holding = what;
  if (activeWeaponMesh) activeWeaponMesh.visible = what === "gun";
  if (activeMeleeMesh) activeMeleeMesh.visible = what === "melee";
  muzzleFlash.visible = what === "gun";
  updateGearHud();
}

/* 1 draws the primary, 2 the secondary - rebuilds the visible gun mesh for
   whichever def that slot now points at and makes it the active weapon.
   No-op in modes with no secondary (equipFromLoadout leaves
   player.secondaryId null there - Gun Game, One in the Chamber) or when
   already holding that slot's gun. */
function switchWeapon(slot) {
  const id = slot === "secondary" ? player.secondaryId : player.weaponId;
  if (!id || !player.weapons[id]) return;
  const w = player.weapons[id];
  if (player.holding === "gun" && w === currentWeapon()) return;
  currentWeaponSlot = slot;
  setActiveWeaponMesh(w.def);
  setHolding("gun");
}

/* Hold X: standing over a dropped weapon, picks it up into the secondary
   slot — replacing the sidearm there if any, same as Call of Duty. Nothing
   underfoot, the same hold instead instantly swaps primary/secondary. */
function updatePickupPrompt(dt) {
  const held = !frozenPlayer() && ((isTouch && touchState.swap) || keys.has("KeyX"));
  const drop = player.alive ? pickups.nearest(move.pos.x, move.pos.z) : null;

  const action = swapHold.update(dt, held, !!drop);
  if (action === "swap") {
    switchWeapon(currentWeaponSlot === "secondary" ? "primary" : "secondary");
  } else if (action === "pickup" && drop) {
    pickups.take(drop);
    player.secondaryId = drop.def.id;
    player.weapons[drop.def.id] = new WeaponState(drop.def);
    audio.reload();
    showWaveBanner(`Picked up ${drop.def.name}`, 1200);
  }

  if (els.pickupPrompt) {
    if (drop && player.alive) {
      els.pickupPrompt.hidden = false;
      els.pickupPromptText.textContent = swapHold.active
        ? `Picking up ${drop.def.name}…` : `Hold X to pick up ${drop.def.name}`;
      els.pickupBarFill.style.width = `${Math.round(swapHold.progress * 100)}%`;
    } else {
      els.pickupPrompt.hidden = true;
    }
  }
}

function frozenPlayer() { return !player.alive || isStaging(); }

function updateGearHud() {
  const melee = (player.melee && player.melee.def) || loadout.melee;
  els.gearMeleeName.textContent = melee.name;
  els.gearMelee.classList.toggle("is-active", player.holding === "melee");
  els.gearLethalName.textContent = loadout.lethal.name;
  els.gearLethalN.textContent = String(player.gear.lethal);
  els.gearLethal.classList.toggle("is-empty", player.gear.lethal <= 0);
  els.gearTacticalName.textContent = loadout.tactical.name;
  els.gearTacticalN.textContent = String(player.gear.tactical);
  els.gearTactical.classList.toggle("is-empty", player.gear.tactical <= 0);
}

// -------------------- the test range --------------------

/* The whole point of the range: say exactly what that round did, at what
   distance, so a sensitivity or FOV change can be judged on evidence. */
function reportRangeShot(target, info, dropped = false) {
  if (!els.rangeShot) return;
  const dist = info.distance != null ? info.distance : target.distance;
  els.rangeShot.textContent =
    `${info.isHead ? "HEADSHOT" : "HIT"} · ${Math.round(dist)} m · ${Math.round(info.damage)} dmg${dropped ? " · DOWN" : ""}`;
  els.rangeShot.classList.remove("is-new");
  void els.rangeShot.offsetWidth;
  els.rangeShot.classList.add("is-new");
}

function updateRangeHud() {
  if (!els.rangeSens) return;
  els.rangeSens.textContent = `${settings.sens}%`;
  els.rangeFov.textContent = `${settings.fov}°`;
}

/* Sensitivity and FOV are adjustable without unlocking the mouse, because
   the only honest way to judge either is while you are actually aiming. */
function nudgeSetting(key, delta, min, max) {
  settings[key] = Math.max(min, Math.min(max, settings[key] + delta));
  applySettings();
  saveSettings();
  updateRangeHud();
}

// -------------------- game flow --------------------

let gameState = "menu"; // menu | playing | paused | gameover
let elapsedRun = 0;

/* The local player as the wire sees them. Shared by the match loop and the
   intermission, which keeps broadcasting so the room doesn't time us out
   (PEER_TIMEOUT is 5s and an intermission runs for 20). */
// net.update() only actually sends this at 15Hz, but it used to get a fresh
// object every animate() frame at 60Hz regardless — three throwaway objects
// for every one that ships. One reused object costs nothing to overwrite.
const _netSnapshot = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, stance: null, moving: false, hp: 0, alive: true, weapon: null, kills: 0 };
function netSnapshot() {
  _netSnapshot.x = move.pos.x; _netSnapshot.y = move.pos.y; _netSnapshot.z = move.pos.z;
  _netSnapshot.yaw = look.yaw; _netSnapshot.pitch = look.pitch;
  _netSnapshot.stance = move.stance; _netSnapshot.moving = move.moving;
  _netSnapshot.hp = player.hp; _netSnapshot.alive = player.alive;
  _netSnapshot.weapon = (player.holding === "gun" ? currentWeapon()?.def.id : null) || player.weaponId;
  _netSnapshot.kills = player.kills;
  return _netSnapshot;
}

/* Everyone currently standing in the world, us included. Spawn scoring and
   the bot targeting both need this; they just filter it differently.

   Bots are included here too — spawnForTeam leans on this list to keep
   people apart, and in solo/bot-filled matches almost everyone on the field
   *is* a bot. Leaving them out made the anti-clump scoring blind to the
   very occupants it was supposed to be spacing out. */
function occupants() {
  const list = [];
  if (player.alive) {
    list.push({ id: net.id, team: net.team, pos: move.pos, yaw: look.yaw });
  }
  for (const rp of remotes.byId.values()) {
    if (!rp.alive) continue;
    list.push({ id: rp.netId, team: rp.team, pos: rp.pos, yaw: rp.yaw ?? 0 });
  }
  for (const b of bots.bots) {
    if (!b.alive) continue;
    list.push({ id: b.id, team: b.team, pos: b.pos, yaw: b.yaw ?? 0 });
  }
  return list;
}

/* Spawn points that recently got someone killed, so we can stop feeding
   players back into a camped corner. Keyed by spawn index. */
const spawnDeaths = new Map();
const SPAWN_DEATH_MEMORY = 20;    // seconds a death keeps counting against a point
const SPAWN_SAFE_RADIUS = 18;     // an enemy nearer than this is a real threat
const SPAWN_VIEW_CONE = Math.cos(THREE.MathUtils.degToRad(50));
const SPAWN_TOLERANCE = 25;       // spawns within this of the best are all "safe enough"
const SPAWN_GUARD = 1.5;          // seconds of respawn protection; ends the moment you fire

function notePointDeath(x, z) {
  const pts = builtMap?.spawnPoints;
  if (!pts) return;
  let bestI = -1, bestD = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - x, pts[i].z - z);
    if (d < bestD) { bestD = d; bestI = i; }
  }
  // Only blame the spawn if the death happened close enough to be its fault.
  if (bestI >= 0 && bestD < 12) spawnDeaths.set(bestI, performance.now());
}

/* Team spawns are the map's spawn ring split in half — no map needs bespoke
   team zones yet, and opposite halves are naturally far apart.

   Within that half the point is *scored* rather than picked at random: a
   uniform pick will happily drop you on top of someone who has been farming
   that corner, and with a 4s respawn that is the fastest way to make a match
   miserable. Enemies nearby, enemies looking this way and recent deaths all
   push a point down; nearby friendlies pull it up. */
function spawnForTeam(team, forId = net.id) {
  const pts = builtMap.spawnPoints;
  if (!pts?.length) return { x: 0, y: 0, z: 0 };
  const half = Math.ceil(pts.length / 2);
  const lo = team === "ghost" ? half : 0;
  const hi = team === "ghost" ? pts.length : half;

  // Never score against ourselves: the corpse we're respawning from would
  // read as a nearby "teammate" and pull us straight back to where we died.
  const others = occupants().filter((o) => o.id !== forId);
  const now = performance.now();
  let best = null, bestScore = -Infinity;
  const scored = [];

  for (let i = lo; i < hi; i++) {
    const sp = pts[i];
    let score = 0;

    for (const o of others) {
      const dx = sp.x - o.pos.x, dz = sp.z - o.pos.z;
      const d = Math.hypot(dx, dz);
      // In a free-for-all everyone still standing is an enemy.
      const enemy = currentMode().ffa || o.team !== team;

      if (!enemy) {
        // Spawning near a living teammate is usually where the fight is.
        if (d < 30) score += 12 * (1 - d / 30);
        continue;
      }
      if (d < SPAWN_SAFE_RADIUS) score -= 140 * (1 - d / SPAWN_SAFE_RADIUS);
      // Being inside their view cone is worse than merely being close.
      if (d < 45 && d > 0.01) {
        const fx = -Math.sin(o.yaw), fz = -Math.cos(o.yaw);
        if ((dx / d) * fx + (dz / d) * fz > SPAWN_VIEW_CONE) score -= 70 * (1 - d / 45);
      }
    }

    const died = spawnDeaths.get(i);
    if (died && now - died < SPAWN_DEATH_MEMORY * 1000) {
      score -= 90 * (1 - (now - died) / (SPAWN_DEATH_MEMORY * 1000));
    }

    scored.push({ sp, score });
    if (score > bestScore) { bestScore = score; best = sp; }
  }

  // Pick at random among the spawns that are *near enough* to the best rather
  // than always taking the winner. Safety is a threshold, not a ranking, and
  // an always-optimal choice is a predictable one — which is the camping
  // problem again from the other side.
  const good = scored.filter((s) => s.score >= bestScore - SPAWN_TOLERANCE);
  const pick = good[Math.floor(Math.random() * good.length)];
  return pick?.sp || best || pts[lo] || pts[0];
}

function teamSpawn() { return spawnForTeam(net.team); }

/* Everything a bot could shoot at: us, other humans, and other bots. */
function botTargets() {
  const list = [];
  for (const o of occupants()) {
    // No point emptying a magazine into someone spawn protection is going to
    // shrug off — and it would look like the bot is broken.
    if (o.id === net.id && player.spawnGuard > 0) continue;
    list.push({ id: o.id, team: o.team, alive: true, pos: o.pos, groundY: o.pos.y });
  }
  return list;
}

function onBotShoot(bot, target, dmg, isHead, hit, range = 30, usingSecondary = false) {
  const wid = (usingSecondary ? bot.secondaryId : bot.weaponId) || "problem416";
  const def = WEAPON_DEFS[wid];
  audio.shot(def || { damage: 24, pellets: 1 }, 0.7, bot.pos);

  if (!hit) {
    if (target.id === net.id) nearMiss(0.45, bot.pos);
    return;
  }
  if (target.id === net.id) { damagePlayer(dmg, bot.id, wid, isHead); return; }

  if (bots.byId(target.id)) {
    const { killed, bot: victim } = bots.applyHit(target.id, dmg);
    if (killed) {
      bot.kills++;
      net.reportDeathAs(target.id, bot.id, wid, isHead);
      registerDeath(victim.name, bot.id, wid, {
        head: isHead, victimTeam: victim.team,
        victimPos: victim.pos, victimWeaponId: victim.weaponId,
      });
    }
    return;
  }
  net.reportHitAs(bot.id, target.id, dmg, isHead, wid);
}

let hillHeldT = 0;   // seconds we've personally stood on the hill

function scoreHill() {
  let phantom = 0, ghost = 0;
  const tally = (team) => { if (team === "ghost") ghost++; else phantom++; };
  const onHill = player.alive && hill.contains(move.pos.x, move.pos.z);
  if (onHill) tally(net.team);
  for (const rp of remotes.byId.values()) {
    if (rp.alive && hill.contains(rp.pos.x, rp.pos.z)) tally(rp.team);
  }
  if (phantom > ghost) teamScores.phantom += phantom;
  else if (ghost > phantom) teamScores.ghost += ghost;
  if (phantom || ghost) { updateTeamHud(); checkMatchEnd(); }

  // Holding the objective is worth XP, but paid in blocks — this runs once a
  // second and a popup every second would be noise.
  if (!onHill) { hillHeldT = 0; return; }
  if (++hillHeldT >= 5) { hillHeldT = 0; addMatchXp(XP.objective, "HOLDING"); }
}

const SND_SITE_RADIUS = 5.5;   // must match the visual ring in setBombSiteMarkers

function siteUnderfoot() {
  for (const s of bombSites) if (Math.hypot(move.pos.x - s.x, move.pos.z - s.z) <= SND_SITE_RADIUS) return s;
  return null;
}

/* Who's still alive on each side, from our own state plus whatever the wire
   has told us about everyone else. Both sides need this every tick: an
   all-dead attacking team loses before the bomb goes off, an all-dead
   defending team loses the instant the bomb is live (no more need to defuse
   it — the fight for the site is already over). */
function isCarrierAlive() {
  if (!bomb.carrierId) return false;
  if (bomb.carrierId === net.id) return player.alive;
  return !!remotes.byId.get(bomb.carrierId)?.alive;
}

function livingAttackerIds() {
  const ids = [];
  if (player.alive && net.team === sndAttackTeam) ids.push(net.id);
  for (const rp of remotes.byId.values()) {
    if (rp.alive && rp.team === sndAttackTeam) ids.push(rp.netId);
  }
  return ids;
}

function sndAliveCounts() {
  let attackers = 0, defenders = 0;
  if (player.alive) { if (net.team === sndAttackTeam) attackers++; else defenders++; }
  for (const rp of remotes.byId.values()) {
    if (!rp.alive) continue;
    if (rp.team === sndAttackTeam) attackers++; else defenders++;
  }
  return { attackers, defenders };
}

function updateSnd(dt) {
  const isAttacker = net.team === sndAttackTeam;
  const wasPlanted = bomb.state === "planted";
  if (wasPlanted && bomb.update(dt)) sndRoundWin(sndAttackTeam, "bomb detonated");
  if (bomb.state === "planted") {
    els.bombTimer.hidden = false;
    els.bombTimer.textContent = Math.ceil(bomb.fuse) + "s";
    els.bombSide.textContent = isAttacker ? "Defend the plant" : `Defuse site ${bomb.site}`;
  }

  // Down players spectate the round out rather than respawning — S&D is one
  // life a round. The elimination check below still needs their team's alive
  // count, so this only stops the countdown text, not the tally.
  if (!player.alive) {
    if (!sndEliminated) {
      sndEliminated = true;
      els.respawnText.textContent = "Eliminated — waiting for the round";
      els.respawn.hidden = false;
    }
  } else if (player.spawnGuard > 0) {
    player.spawnGuard -= dt;
    if (player.spawnGuard <= 0) { player.spawnGuard = 0; updateSpawnGuardHud(); }
    else if (els.spawnGuard?.hidden) updateSpawnGuardHud();
  }

  if (sndRoundOver) return;

  // Elimination checks only matter pre-plant for the attackers (a bomb
  // already ticking wins on its own even if the last attacker just died) and
  // only matter for defenders once it's live (before that, defenders simply
  // wait — there's nothing on the clock to lose to).
  const { attackers } = sndAliveCounts();
  if (!wasPlanted && attackers <= 0) { sndRoundWin(sndDefendTeam(), "attackers eliminated"); return; }
  // Defenders wiped: nothing changes here. Pre-plant, the attackers still
  // have to walk the bomb to a site themselves; post-plant, the fuse alone
  // decides it (the check above already returned in that case).

  // The carrier died holding it: it doesn't need a physical pickup prop for
  // a first cut of this mode — it just passes to the next living attacker,
  // lowest id first, so every client picks the same one independently. Only
  // the bot host actually assigns it, same authority that owns bot state.
  if (bomb.state === "carried" && !isCarrierAlive() && (net.isBotHost() || !net.active)) {
    const next = livingAttackerIds().sort()[0];
    if (next && next !== bomb.carrierId) {
      bomb.carrierId = next;
      if (net.active) net.publishBomb({ kind: "event", action: "carrier", carrierId: next });
    }
  }

  // Plant/defuse: only the acting player's own client drives its own
  // progress, and only while a live interact press is actually held.
  const isCarrier = bomb.carrierId === net.id;
  const onSite = isAttacker && isCarrier && bomb.state === "carried" ? siteUnderfoot() : null;
  const canDefuse = !isAttacker && bomb.state === "planted" && siteUnderfoot()?.id === bomb.site;
  const acting = player.alive && sndInteractHeld && (onSite || canDefuse);

  if (acting) {
    const kind = onSite ? "plant" : "defuse";
    const need = kind === "plant" ? PLANT_TIME : DEFUSE_TIME;
    if (!bomb.action || bomb.action.by !== net.id || bomb.action.kind !== kind) {
      bomb.action = { kind, by: net.id, progress: 0, site: onSite?.id };
    }
    bomb.action.progress += dt;
    els.bombPrompt.hidden = false;
    els.bombPromptText.textContent = kind === "plant" ? `Planting site ${onSite.id}…` : `Defusing…`;
    els.bombBarFill.style.width = `${Math.min(100, (bomb.action.progress / need) * 100)}%`;
    if (isPvp() && net.active) net.publishBomb({ kind: "action", action: kind, by: net.id, progress: bomb.action.progress, site: onSite?.id });

    if (bomb.action.progress >= need) {
      if (kind === "plant") {
        bomb.plant(onSite.id);
        audio.wave();
        showWaveBanner(`Bomb planted — site ${onSite.id}`, 1800);
        if (net.active) net.publishBomb({ kind: "event", action: "planted", site: onSite.id });
      } else {
        bomb.defuse();
        sndRoundWin(sndDefendTeam(), "bomb defused");
        if (net.active) net.publishBomb({ kind: "event", action: "defused" });
      }
      bomb.action = null;
      els.bombPrompt.hidden = true;
    }
  } else if (bomb.action?.by === net.id) {
    // Let go, moved off the site, or died mid-plant — the attempt doesn't
    // carry over; the next hold starts the timer from zero, same as CoD.
    bomb.action = null;
    els.bombPrompt.hidden = true;
    if (isPvp() && net.active) net.publishBomb({ kind: "event", action: "cancel" });
  } else if (!bomb.action) {
    if (onSite) { els.bombPrompt.hidden = false; els.bombPromptText.textContent = `Hold E to plant (site ${onSite.id})`; els.bombBarFill.style.width = "0%"; }
    else if (canDefuse) { els.bombPrompt.hidden = false; els.bombPromptText.textContent = "Hold E to defuse"; els.bombBarFill.style.width = "0%"; }
    else els.bombPrompt.hidden = true;
  }
}

/* Gun Game and One in the Chamber force what you're holding and leave no
   secondary slot to scavenge into, so a dead player's gun in those modes
   isn't worth dropping — the ladder or the one-shot pistol already decides
   the next gun for everyone. */
function scavengeAllowed() {
  return !weaponForMode(currentMode(), gunGameProgress);
}

/* Drop whatever gun the player was holding right where they died, so
   another operator can scavenge it as a secondary. Melee kills, the range,
   and Gun Game/OITC never drop anything — you can't scavenge into a slot
   those modes don't give you. */
function dropCarriedWeapon() {
  if (!scavengeAllowed()) return;
  const w = currentWeapon();
  if (!w) return;
  pickups.drop(net.id, w.def, move.pos);
}

function equipFromLoadout() {
  const mode = currentMode();
  const forcedId = weaponForMode(mode, gunGameProgress);
  let def = forcedId ? resolveWeapon(forcedId, defaultLoadoutFor(forcedId)) : loadout.resolved;
  if (mode.tuneWeapon) def = mode.tuneWeapon(def);
  player.weaponId = def.id;
  player.weapons = { [def.id]: new WeaponState(def) };
  if (!forcedId) {
    const secDef = loadout.resolvedSecondary;
    player.secondaryId = secDef.id;
    player.weapons[secDef.id] = new WeaponState(secDef);
  } else {
    player.secondaryId = null;
  }
  player.melee = new MeleeState(loadout.melee);
  setActiveMeleeMesh(loadout.melee);
  currentWeaponSlot = "primary";
  player.holding = "gun";
  if (activeMeleeMesh) activeMeleeMesh.visible = false;
  refillGear();
  updateGearHud();
  return def;
}

/* Put everyone who didn't ask for a private room into the same public
   server for the mode they picked. Tries the base room first (QTDM, QKOH,
   ...); only spills into a numbered shard once the base room already has
   enough real people that MAX_PLAYERS would be exceeded, so a lone player
   never gets sharded off by themselves. Modes without a quickplay base
   (none currently) fall back to a private random room, same as before. */
async function joinQuickplay() {
  const base = QUICKPLAY_BASE[modeId];
  if (!base) {
    const code = makeRoomCode();
    return { code, kind: await net.start(code, { name: playerName(), mapId: loadout.mapId }) };
  }
  for (let shard = 1; shard <= QUICKPLAY_MAX_SHARDS; shard++) {
    const code = shard === 1 ? base : `${base}${shard}`;
    setNetStatus(shard === 1 ? "Connecting…" : `Server full, trying another (${shard})…`);
    const kind = await net.start(code, { name: playerName(), mapId: loadout.mapId });
    if (!kind) return { code, kind };   // real connectivity failure — retrying won't help
    if (net.playerCount <= MAX_PLAYERS || shard === QUICKPLAY_MAX_SHARDS) return { code, kind };
    net.stop();
  }
}

async function startGame() {
  audio.resume();   // the click that got us here is the gesture Web Audio needs
  if (isPvp()) {
    els.startBtn.disabled = true;
    setNetStatus("Connecting…");
    const result = els.room.value && roomIsCustom
      ? { code: els.room.value, kind: await net.start(els.room.value, { name: playerName(), mapId: loadout.mapId }) }
      : await joinQuickplay();
    els.startBtn.disabled = false;
    if (!result.kind) { setNetStatus("Couldn't reach the room. Try another code.", "bad"); return; }
    els.room.value = result.code;
    net.chooseTeam();
    setNetStatus(`Live · ${result.kind} · room ${result.code} · ${TEAMS[net.team].name}`, "live");
  } else {
    net.stop();
  }

  beginMatch();
}

/* -------------------- pre-match staging --------------------

   A match used to begin the instant the map loaded: you were dropped on your
   spawn, already live, while the bots that fill the room only appeared a frame
   later from inside the animate loop. That reads as abrupt, and a room with one
   or two humans looks empty at exactly the moment it should feel like a match
   about to kick off.

   Staging is a short countdown *inside* `playing` rather than a sixth game
   state — the world renders, remote players and bots stream in and are visible,
   but nobody can move, shoot or take damage until the clock hits zero. Keeping
   it a flag rather than a state means the ~25 existing `gameState === "playing"`
   checks all keep working untouched. */
const STAGE_SECONDS = 6;
let stageT = 0;                  // seconds left; 0 means the match is live
let stageShown = -1;             // last whole second painted, so we only touch the DOM on a change
let stageOwner = false;          // are we the client publishing the clock?
let stagePub = 0;                // throttle on republishing it

function isStaging() { return stageT > 0; }

/* Frozen: input is ignored and damage is refused. The camera still moves so
   the player can look around the room while they wait. */
function beginStaging(seconds = STAGE_SECONDS) {
  stageT = seconds;
  stageShown = -1;
  stagePub = 0;
  // Solo play always "owns" its own clock; PvP re-derives ownership every
  // publish tick in updateStaging() rather than latching a one-time guess
  // here — a peer's `hello` can land a beat after this runs, and a stale
  // "I'm alone" snapshot would leave two clients both convinced they own it.
  stageOwner = !isPvp() || !net.active;
  els.staging.hidden = false;
  document.body.classList.add("to-staging-on");
  els.stagingMode.textContent = isPvp()
    ? `${currentMode().name} — ${builtMap.map.name}`
    : builtMap.map.name;
  els.stagingSub.textContent = isPvp() && net.team
    ? `You are ${TEAMS[net.team].name}`
    : "Get ready";
  updateStagingRoster();
}

function endStaging() {
  if (stageT <= 0 && els.staging.hidden) return;
  stageT = 0;
  els.staging.hidden = true;
  document.body.classList.remove("to-staging-on");
  // The opening seconds still deserve the cover a respawn gets.
  player.spawnGuard = isPvp() ? SPAWN_GUARD : 0;
  updateSpawnGuardHud();
  if (isPvp() && !isSnd()) showWaveBanner("FIGHT", 1100);
  audio.stageTick(true);
  // The horde/zombie clock — and the first wave banner — start now, not when
  // the map loaded, so nothing was ever ticking behind the countdown.
  if (isZombies()) nextZombieRound();
  else if (isSnd()) beginSndRound();
  else if (!isPvp() && !isRange()) nextWave();
}

/* How full the room looks right now — the whole point of staging is that the
   bots are already standing there when the player counts down. */
function updateStagingRoster() {
  if (!isPvp()) { els.stagingRoster.textContent = ""; return; }
  let humans = 1, botCount = 0;
  for (const p of net.peers.values()) (isBotPeer(p) ? botCount++ : humans++);
  const parts = [`${humans} operator${humans === 1 ? "" : "s"}`];
  if (botCount) parts.push(`${botCount} bot${botCount === 1 ? "" : "s"}`);
  els.stagingRoster.textContent = parts.join(" · ");
}

function updateStaging(dt) {
  stageT -= dt;

  // Only the owner publishes, ~3×/sec, so a client that joins or reloads
  // mid-countdown adopts the clock already running rather than its own.
  // Re-checked every tick (not latched once) so a peer whose `hello` arrived
  // a beat late still hands ownership off the moment it's known about.
  if (isPvp() && net.active) {
    stageOwner = net.isBotHost();
    stagePub -= dt;
    if (stageOwner && stagePub <= 0) {
      stagePub = 0.33;
      net.publishStage(loadout.mapId, modeId, stageT);
    }
  }

  const whole = Math.max(0, Math.ceil(stageT));
  if (whole !== stageShown) {
    stageShown = whole;
    els.stagingClock.textContent = whole > 0 ? String(whole) : "GO";
    // Restarting a CSS animation needs the class off for a reflow first.
    els.stagingClock.classList.remove("is-tick");
    void els.stagingClock.offsetWidth;
    els.stagingClock.classList.add("is-tick");
    if (whole > 0) audio.stageTick(whole <= 3);
    updateStagingRoster();
  }

  if (stageT <= 0) endStaging();
}

/* Everything a match needs reset, with no connection work — so a rematch can
   reuse the room the lobby already joined instead of tearing it down and
   making everyone re-handshake. */
function beginMatch(mapId = null) {
  suppressT = 0;
  player.hp = player.maxHp;
  player.kills = 0;
  player.deaths = 0;
  player.wave = 0;
  player.alive = true;
  player.assists = 0;
  player.headshots = 0;
  player.streak = 0;
  player.bestStreak = 0;
  player.matchXp = 0;
  damageLog.clear();
  dealtLog.clear();
  if (els.deathBy) els.deathBy.hidden = true;
  elapsedRun = 0;
  respawnT = 0;
  teamScores.phantom = 0;
  teamScores.ghost = 0;
  updateTeamHud();

  gunGameProgress = 0;
  hillAcc = 0;

  spawnDeaths.clear();
  // Spawn protection starts when the countdown ends, not when the map loads —
  // burning it during staging would spend it before anyone can shoot.
  player.spawnGuard = 0;
  updateSpawnGuardHud();

  loadMap(currentMode().forceMap || mapId || loadout.mapId);
  const sp = isPvp() ? teamSpawn() : builtMap.playerSpawn;
  move.reset(sp.x, sp.z, sp.y || 0);
  look.yaw = yawTowardCentre(sp);
  look.pitch = 0;
  bullets.clear();
  grenades.clear();
  pickups.clear();
  swapHold.reset();
  cooking.def = null;
  cooking.slot = null;
  els.cook.hidden = true;
  blindT = 0;
  empT = 0;
  clearDamageNumbers();
  applyEmpState(false);
  els.smoke.style.opacity = "0";
  shakeT = 0;
  shakeMag = 0;
  remotes.clear();
  bots.clear();

  hill = currentMode().hill ? new Hill(builtMap.spawnPoints) : null;
  setHillMarker(hill);

  if (currentMode().rounds) {
    bombSites = pickBombSites(builtMap.map.bounds, builtMap.spawnPoints);
    bomb = new Bomb(bombSites);
    setBombSiteMarkers(bombSites);
    sndRound = 0;
    sndAttackTeam = "phantom";
  } else {
    bomb = null;
    bombSites = null;
    setBombSiteMarkers(null);
  }

  setActiveWeaponMesh(equipFromLoadout());

  if (spawner) {
    for (const g of spawner.grunts) g.dispose(scene);
    spawner = null;
  }
  els.rangeHud.hidden = true;
  if (zdir) { zdir.clear(); zdir = null; }

  if (rangeSet) { rangeSet.clear(); rangeSet = null; }

  if (isRange()) {
    rangeSet = new RangeSet(scene);
  } else if (isZombies()) {
    zdir = new ZombieDirector(scene, ARENA, colliders, zombieWindows());
  } else if (!isPvp()) {
    spawner = new WaveSpawner(scene, ARENA, spawnPoints, colliders);
  }

  const pvp = isPvp();
  const snd = isSnd();
  els.hudTeams.hidden = !pvp;
  // S&D keeps the wave/hostiles boxes — repurposed as round count and bomb
  // status — where every other PvP mode hides them.
  els.hudWaveBox.hidden = (pvp && !snd) || isRange();
  els.hudHostilesBox.hidden = (pvp && !snd) || isRange();
  els.bombStatus.hidden = !snd;
  if (els.touchInteract) els.touchInteract.hidden = !snd;
  els.rangeHud.hidden = !isRange();
  updateRangeHud();
  document.getElementById("hud-l-wave").textContent = isZombies() || snd ? "Round" : "Wave";
  document.getElementById("hud-l-hostiles").textContent = isZombies() ? "Zombies" : (snd ? "Bomb" : "Hostiles");
  document.getElementById("hud-l-kills").textContent = isZombies() ? "Points" : "Kills";
  els.respawn.hidden = true;
  els.scoreboard.hidden = true;

  els.title.hidden = true;
  els.gameover.hidden = true;
  els.pause.hidden = true;
  els.hud.hidden = false;
  setTouchControls(true);
  gameState = "playing";

  // The range is a sandbox, not a match — there is nothing to count down to.
  if (isRange()) {
    showWaveBanner("Test range — nothing here shoots back", 2600);
  } else {
    // Bots are filled here rather than on the first live frame, so the room is
    // already populated while the player watches the clock.
    if (isPvp() && net.isBotHost()) {
      const humans = 1 + [...net.peers.values()].filter((p) => !isBotPeer(p)).length;
      bots.fill(BOT_TARGET, humans, spawnForTeam, !!currentMode().ffa);
      for (const b of bots.bots) net.publishBot(b);
    }
    // Wave 1 / Round 1 don't spawn until the countdown clears — starting the
    // spawner immediately would have grunts standing idle mid-countdown and
    // "WAVE 1" competing on screen with "GET READY".
    beginStaging();
  }

  // Browsers refuse a pointer lock requested too soon after an unlock without
  // a fresh gesture, which the auto-advance out of an intermission doesn't
  // have. If it's refused we land on the pause screen instead of in a live
  // match with dead mouse-look, and clicking resume picks it back up.
  if (!isTouch) {
    try { controls.lock(); } catch { /* refused — the pause screen catches it */ }
    setTimeout(() => {
      if (gameState === "playing" && !controls.isLocked) {
        gameState = "paused";
        els.pause.hidden = false;
      }
    }, 260);
  }
}

function nextZombieRound() {
  player.wave = zdir.round + 1;
  zdir.startRound(player.wave);
  els.hudWave.textContent = String(player.wave);
  showWaveBanner(`ROUND ${player.wave}`);
  audio.wave();
}

function onZombieAttack(zombie, dmg) {
  damagePlayer(dmg, null, null);
}

function nextWave() {
  player.wave++;
  els.hudWave.textContent = String(player.wave);
  showWaveBanner(`WAVE ${player.wave}`);
  audio.wave();
  spawner.startWave(player.wave);
}

// -------------------- Search & Destroy round flow --------------------

function sndDefendTeam() { return sndAttackTeam === "phantom" ? "ghost" : "phantom"; }

/* A new round: same map, same loadouts, no economy — the bomb resets, both
   sides respawn on their side's spawns (attackers carry, defenders don't),
   and nobody is eliminated yet. Called once for round 1 (from endStaging,
   same as every other mode's opening whistle) and again after every round
   ends, once the short between-rounds countdown clears. */
function beginSndRound() {
  sndRound++;
  sndRoundOver = false;
  sndEliminated = false;
  bomb.reset();
  els.bombPrompt.hidden = true;
  els.bombTimer.hidden = true;
  els.hudWave.textContent = String(sndRound);
  els.bombSide.textContent = net.team === sndAttackTeam ? "Plant the bomb" : "Defend the sites";
  els.bombSide.style.color = TEAMS[net.team]?.ui || "";
  showWaveBanner(`ROUND ${sndRound} — ${net.team === sndAttackTeam ? "ATTACKING" : "DEFENDING"}`, 2200);
  audio.wave();

  player.hp = player.maxHp;
  player.alive = true;
  els.respawn.hidden = true;
  const sp = teamSpawn();
  move.reset(sp.x, sp.z, sp.y || 0);
  look.yaw = yawTowardCentre(sp);
  look.pitch = 0;
  setActiveWeaponMesh(equipFromLoadout());
  player.spawnGuard = SPAWN_GUARD;
  updateSpawnGuardHud();

  // One attacker actually carries it — the lowest-id attacker still alive,
  // which every client can compute identically without electing anyone.
  if (net.isBotHost() || !net.active) {
    const attackerIds = livingAttackerIds().sort();
    bomb.carrierId = attackerIds[0] || null;
    if (net.active) net.publishBomb({ kind: "event", action: "reset", round: sndRound, attackTeam: sndAttackTeam, carrierId: bomb.carrierId });
  }
}

/* Round over: score it, check for a match win, and either roll into the next
   round or let checkMatchEnd's endMatch take over. Every client reaches this
   independently off the same bomb/elimination state, so nobody needs to be
   told the round ended — they all see it happen at once. */
function sndRoundWin(winningTeam, reason) {
  if (sndRoundOver) return;
  sndRoundOver = true;
  teamScores[winningTeam] = (teamScores[winningTeam] || 0) + 1;
  updateTeamHud();
  showWaveBanner(`${TEAMS[winningTeam].name.toUpperCase()} WIN THE ROUND — ${reason}`, 2600);
  audio.kill();

  const winner = matchWinner(currentMode(), {
    teamScores, selfScore: 0, selfName: "You", peers: [...net.peers.values()],
  });
  if (winner) { endMatch(winner); return; }

  // Halftime: sides swap once each team has attacked the same number of
  // rounds — i.e. right after round roundsToWin - 1 finishes, so a 6-round
  // win limit swaps after round 5, matching Black Ops 2's split.
  if (sndRound === currentMode().roundsToWin - 1) sndAttackTeam = sndDefendTeam();

  setTimeout(() => { if (gameState === "playing" && isSnd()) beginStaging(3); }, 1400);
}

function finishRun(title, headline, headlineLabel, secondLabel, thirdLabel, opts = {}) {
  gameState = "gameover";
  player.alive = false;
  if (controls.isLocked) controls.unlock();
  els.hud.hidden = true;
  setTouchControls(false);
  els.gameover.hidden = false;
  els.goTitle.textContent = title;
  els.goWave.textContent = headline;
  els.goL1.textContent = headlineLabel;
  els.goKills.textContent = String(player.kills);
  els.goL2.textContent = secondLabel;
  const mins = Math.floor(elapsedRun / 60), secs = Math.floor(elapsedRun % 60);
  els.goTime.textContent = `${mins}:${String(secs).padStart(2, "0")}`;
  els.goL3.textContent = thirdLabel;

  // PvP banks XP per kill as the match runs, so only the end-of-match
  // bonuses are settled here. Ops still pays once, on its wave curve.
  const gained = isPvp()
    ? player.matchXp + xpForMatch({ won: !!opts.won, completed: !!opts.completed })
    : xpForRun({ kills: player.kills, wave: player.wave });
  const { rankedUp, rank } = addXp(gained);
  els.goXp.textContent = `+${gained.toLocaleString()} XP`;
  els.goRank.textContent = rankedUp ? `Rank up — now rank ${rank}` : "";
  els.goRank.hidden = !rankedUp;
  loadout.render();

  // Weapon rank stays local — it's a per-game unlock track, and the account's
  // XP is server-guarded with its own cooldowns and caps. Filing the run is
  // what the account API is actually for; it no-ops for guests.
  window.TrollrunnerAccounts?.reportGameResult?.("troll-ops", player.wave * 10000 + player.kills * 10, {
    mode: modeId,
    kills: player.kills,
    deaths: player.deaths,
    wave: player.wave,
    map: loadout.mapId,
  });
}

function endGame(reason) {
  const zombies = isZombies();
  finishRun(
    reason === "quit" ? "Extracted" : (zombies ? "They got you" : "You went down"),
    String(player.wave),
    zombies ? "Round reached" : "Wave reached",
    zombies ? "Zombies killed" : "Kills",
    "Time survived",
  );
  window.TrollLeaderboard?.report?.("troll-ops", { pvp: false, wave: player.wave, kills: player.kills });
}

function endMatch(title) {
  endStaging();          // a match can be ended from outside (everyone left)
  const mode = currentMode();
  const headline = mode.ffa ? String(player.kills) : String(teamScores[net.team] ?? 0);
  const won = mode.ffa
    ? title.startsWith("You")
    : title === `${TEAMS[net.team]?.name} win`;
  finishRun(title, headline, mode.ffa ? "Your score" : "Your side", "Your kills", "Match length", { won, completed: true });

  window.TrollLeaderboard?.report?.("troll-ops", {
    pvp: true, kills: player.kills, deaths: player.deaths, won,
    assists: player.assists, headshots: player.headshots, streak: player.bestStreak,
  });

  bots.clear();
  setHillMarker(null);
  setBombSiteMarkers(null);
  els.bombPrompt.hidden = true;
  if (els.pickupPrompt) els.pickupPrompt.hidden = true;
  pickups.clear();
  bomb = null;

  // The room stays up. Tearing the channel down here meant everyone had to
  // re-enter a code and re-handshake to play a second match — and quickplay
  // could shard them apart on the way back.
  if (net.active) startIntermission();
  else setNetStatus("Match over. Pick a mode to drop in again.");
}

// -------------------- intermission --------------------

const INTERMISSION = 20;          // seconds between matches
const VOTE_CANDIDATES = 3;
let intermissionT = 0;
let voteOptions = [];

/* The three maps on offer. Derived from the room code and the match count so
   every client lands on the same shortlist without anyone hosting the vote. */
function pickVoteOptions() {
  const pool = MAP_IDS.filter((id) => id !== loadout.mapId);
  const seedSrc = `${net.room || ""}:${matchesPlayed}`;
  let seed = 0;
  for (let i = 0; i < seedSrc.length; i++) seed = (seed * 31 + seedSrc.charCodeAt(i)) >>> 0;
  const out = [];
  const avail = [...pool];
  while (out.length < Math.min(VOTE_CANDIDATES, avail.length + 0) && avail.length) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    out.push(avail.splice(seed % avail.length, 1)[0]);
  }
  // Always let people re-run the map they just played.
  if (out.length < VOTE_CANDIDATES) out.push(loadout.mapId);
  return out;
}

function startIntermission() {
  matchesPlayed++;
  net.clearVotes();
  voteOptions = pickVoteOptions();
  intermissionT = INTERMISSION;
  renderVote();
  els.intermission.hidden = false;
  setNetStatus(`Match over · next map in ${INTERMISSION}s`, "live");
}

function renderVote() {
  if (!els.voteList) return;
  const tally = new Map();
  const add = (m) => { if (m) tally.set(m, (tally.get(m) || 0) + 1); };
  add(net.myVote);
  for (const p of net.peers.values()) {
    if (!isBotPeer(p)) add(p.vote);
  }

  els.voteList.replaceChildren();
  for (const id of voteOptions) {
    const n = tally.get(id) || 0;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "to-vote-opt";
    btn.classList.toggle("is-mine", net.myVote === id);
    btn.setAttribute("aria-pressed", String(net.myVote === id));
    btn.innerHTML =
      `<span class="to-vote-name">${MAPS[id]?.name || id}</span>` +
      `<span class="to-vote-n">${n || ""}</span>`;
    btn.addEventListener("click", () => {
      net.castVote(id);
      renderVote();
    });
    els.voteList.appendChild(btn);
  }
}

function cancelIntermission() {
  intermissionT = 0;
  voteOptions = [];
  net.clearVotes();
  if (els.intermission) els.intermission.hidden = true;
}

/* Ticked from the frame loop so it shares the same clock as everything else. */
function updateIntermission(dt) {
  if (intermissionT <= 0) return;
  intermissionT -= dt;
  if (els.voteClock) els.voteClock.textContent = String(Math.max(0, Math.ceil(intermissionT)));
  if (intermissionT > 0) return;

  intermissionT = 0;
  els.intermission.hidden = true;

  // Everyone tallies the same votes, so everyone loads the same map.
  const winner = net.voteWinner() || voteOptions[0] || loadout.mapId;
  net.clearVotes();

  if (!net.active) { setNetStatus("Match over. Pick a mode to drop in again."); return; }

  loadout.mapId = winner;
  els.gameover.hidden = true;
  beginMatch(winner);
}

els.startBtn.addEventListener("click", startGame);
/* Mid-intermission this means "don't make me wait", not "reconnect" — the
   room is still up, so drop straight into the map the vote is currently on. */
els.retryBtn.addEventListener("click", () => {
  if (intermissionT > 0) { intermissionT = 0.0001; return; }
  startGame();
});
els.resumeBtn.addEventListener("click", () => { if (!isTouch) controls.lock(); });
els.quitBtn.addEventListener("click", () => {
  gameState = "menu";
  endStaging();
  cancelIntermission();
  setBombSiteMarkers(null);
  if (els.bombPrompt) els.bombPrompt.hidden = true;
  if (els.pickupPrompt) els.pickupPrompt.hidden = true;
  pickups.clear();
  bomb = null;
  net.stop();
  remotes.clear();
  setNetStatus("Share the code with whoever you want in the match.");
  els.pause.hidden = true;
  els.hud.hidden = true;
  setTouchControls(false);
  els.title.hidden = false;
  loadout.render();
  renderLobbyRoster();
  showLobbyPanel("deploy");
});

controls.addEventListener("lock", () => { if (gameState === "paused") gameState = "playing"; els.pause.hidden = true; });
controls.addEventListener("unlock", () => {
  if (gameState === "playing") { gameState = "paused"; els.pause.hidden = false; }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && gameState === "playing") { gameState = "paused"; els.pause.hidden = false; }
});

// -------------------- damage to player --------------------

let respawnT = 0;

/* Who has hurt us lately, and how much. The shooter's client already sends
   dmg / headshot / weapon with every hit — we were throwing all of it away.
   Keeping a short ledger is what turns "you died" into "who killed you, what
   with, and how close you got", and it's what assists are computed from. */
const damageLog = new Map();      // attacker id -> { dmg, last, weaponId, head }
const ASSIST_MEMORY = 10;         // seconds a contribution still counts
const ASSIST_MIN_DAMAGE = 25;     // below this it isn't an assist

function noteDamage(fromId, amount, weaponId, isHead) {
  if (!fromId || fromId === net.id) return;
  const e = damageLog.get(fromId) || { dmg: 0, last: 0, weaponId: null, head: false };
  e.dmg += amount;
  e.last = performance.now();
  e.weaponId = weaponId || e.weaponId;
  e.head = !!isHead;
  damageLog.set(fromId, e);
}

/* Everyone who contributed inside the memory window, minus the killer. */
function assistersFor(killerId) {
  const now = performance.now();
  const out = [];
  for (const [id, e] of damageLog) {
    if (now - e.last > ASSIST_MEMORY * 1000) { damageLog.delete(id); continue; }
    if (id === killerId || e.dmg < ASSIST_MIN_DAMAGE) continue;
    out.push({ id, dmg: e.dmg });
  }
  return out;
}

function nameFor(id) {
  if (id === net.id) return "You";
  return net.peers.get(id)?.name || bots.byId(id)?.name || "Someone";
}

function weaponNameFor(id) {
  return WEAPON_DEFS[id]?.name || null;
}

/* How much health the player who killed us had left — the single most useful
   thing a death screen can tell you, because it says whether to change the
   approach or just the aim. */
function killerHpFor(id) {
  // Bots we simulate are checked first: publishBot mirrors them into the peer
  // map, and that mirror only refreshes at 15Hz, so the peer copy can be a
  // stale snapshot of a bot whose real health we're holding right here.
  const b = bots.byId(id);
  if (b) return Math.max(0, Math.round(b.hp));
  const p = net.peers.get(id);
  if (p && Number.isFinite(p.hp)) return Math.max(0, Math.round(p.hp));
  return null;
}

function damagePlayer(amount, fromId, weaponId, isHead = false) {
  if (!player.alive) return;
  // Nothing lands before the match is live, whoever reports it.
  if (isStaging()) return;
  // Your own grenade can still sting on the range; it can't end the session.
  if (isRange()) {
    player.hp = Math.max(1, player.hp - amount);
    flashHit();
    audio.hurt();
    return;
  }
  // Freshly respawned and haven't fired yet — the round passes through.
  if (player.spawnGuard > 0 && isPvp()) return;

  player.hp = Math.max(0, player.hp - amount);
  noteDamage(fromId, amount, weaponId, isHead);
  flashHit();
  audio.hurt();
  if (player.hp > 0) return;
  audio.died();

  if (isPvp()) {
    // In PvP dying is a respawn, not the end of the run.
    player.alive = false;
    player.deaths++;
    player.streak = 0;
    // S&D has no respawn timer — updateSnd() owns the "eliminated" HUD text
    // once this sets player.alive false; every other PvP mode counts this
    // down and calls respawnPlayer() itself.
    if (!isSnd()) respawnT = 4;
    // Remember where we fell, so the picker stops handing out this corner.
    notePointDeath(move.pos.x, move.pos.z);
    dropCarriedWeapon();
    net.reportDeath(fromId, weaponId, isHead);
    registerDeath("You", fromId, weaponId, {
      head: isHead, victimIsMe: true, victimTeam: net.team,
    });
    showDeathCard(fromId, weaponId, isHead);
    damageLog.clear();
    els.respawn.hidden = false;
  } else {
    endGame("dead");
  }
}

/* Who got you, with what, and how close you came. "They had 12 HP left" is
   the difference between "aim better" and "that fight was unwinnable". */
function showDeathCard(killerId, weaponId, isHead) {
  if (!els.deathBy) return;
  const name = killerId ? nameFor(killerId) : null;
  if (!name || name === "You") {
    els.deathBy.hidden = true;
    return;
  }
  const weapon = weaponNameFor(weaponId);
  const hp = killerHpFor(killerId);

  els.deathByName.textContent = name;
  const team = net.peers.get(killerId)?.team || bots.byId(killerId)?.team;
  els.deathByName.style.color = team && TEAMS[team] ? TEAMS[team].ui : "";

  const bits = [];
  if (weapon) bits.push(weapon);
  if (isHead) bits.push("headshot");
  if (hp != null) bits.push(`${hp} HP left`);
  els.deathByMeta.textContent = bits.join(" · ");
  els.deathBy.hidden = false;
}

/* Spawns ring the map edge, so face inward — otherwise you open your eyes
   looking at the perimeter wall. */
function yawTowardCentre(sp) {
  return Math.atan2(sp.x, sp.z);
}


function respawnPlayer() {
  const sp = teamSpawn();
  move.reset(sp.x, sp.z, sp.y || 0);
  look.yaw = yawTowardCentre(sp);
  look.pitch = 0;
  player.hp = player.maxHp;
  player.alive = true;
  player.spawnGuard = SPAWN_GUARD;
  setActiveWeaponMesh(equipFromLoadout());
  els.respawn.hidden = true;
}

/* Spawn protection is a promise not to be shot, not a licence to shoot, so
   firing drops it immediately. */
function breakSpawnGuard() {
  if (player.spawnGuard > 0) {
    player.spawnGuard = 0;
    updateSpawnGuardHud();
  }
}

function updateSpawnGuardHud() {
  const on = player.spawnGuard > 0;
  if (els.spawnGuard) els.spawnGuard.hidden = !on;
  document.body.classList.toggle("to-spawn-guarded", on);
}

function onGruntAttack(grunt, dmg, ranged) {
  if (ranged) {
    const dist = grunt.mesh.position.distanceTo(player.pos);
    if (dist < 14) damagePlayer(dmg * 0.8);
  } else {
    damagePlayer(dmg);
  }
}

// -------------------- main loop --------------------

const clock = new THREE.Clock();

function resize() {
  const w = els.cabinet.clientWidth, h = els.cabinet.clientHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  weaponCamera.aspect = w / h;
  weaponCamera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;

  if (gameState === "paused") pollGamepadMenu();

  // Runs during "gameover", between two matches in a room that stayed up.
  if (intermissionT > 0) {
    updateIntermission(dt);
    net.update(dt, netSnapshot());
  }

  if (gameState === "playing") {
    if (isStaging()) updateStaging(dt);
    // The clock itself isn't playtime, and nothing hostile moves during it.
    else elapsedRun += dt;
    const staging = isStaging();

    pollGamepad(dt);
    updatePlayer(dt);
    updateWeaponView(dt);

    targetMeshes = [];
    if (staging) {
      // Hostiles hold still, but remote operators and bots still stream in so
      // the room visibly fills while the player waits.
      if (isPvp()) {
        net.update(dt, netSnapshot());
        remotes.sync(net.peers);
        remotes.update(dt);
      }
    } else if (isRange()) {
      rangeSet.update(dt);
      targetMeshes = rangeSet.hitMeshes();
      // Ammo and gear are free here — the range is for testing, not rationing.
      const w = currentWeapon();
      w.ammoReserve = w.def.reserveMax;
      player.gear.lethal = loadout.lethal.carried;
      player.gear.tactical = loadout.tactical.carried;
      player.hp = Math.min(player.maxHp, player.hp + dt * 12);
    } else if (isZombies()) {
      const roundOver = zdir.update(dt, player.pos, onZombieAttack);
      if (roundOver) nextZombieRound();
      els.hudHostiles.textContent = String(zdir.remaining);
      els.hudKills.textContent = zdir.points.toLocaleString();
      targetMeshes = zdir.hitMeshes();
    } else if (!isPvp()) {
      spawner.update(dt, player.pos, onGruntAttack);
      els.hudHostiles.textContent = String(spawner.aliveCount + spawner.toSpawn);
      if (spawner.isWaveClear()) nextWave();
      for (const g of spawner.grunts) if (g.alive && !g.dying) targetMeshes.push(g.mesh);
    } else {
      const ffa = !!currentMode().ffa;

      // Exactly one client simulates the bots and publishes them as peers, so
      // everyone else needs no bot-specific code at all.
      if (net.isBotHost()) {
        const humans = 1 + [...net.peers.values()].filter((p) => !isBotPeer(p)).length;
        bots.fill(BOT_TARGET, humans, spawnForTeam, ffa);
        bots.update(dt, {
          colliders, arena: ARENA, ffa,
          targets: botTargets(),
          onShoot: onBotShoot,
          spawnFor: spawnForTeam,
          sightBlocked: (a, b) => grenades.blocksSight(a, b),
        });
        for (const b of bots.bots) net.publishBot(b);
      } else if (bots.count) {
        for (const b of bots.bots) net.dropBot(b.id);
        bots.clear();
      }

      net.update(dt, netSnapshot());
      remotes.sync(net.peers);
      remotes.update(dt);
      targetMeshes = remotes.hitMeshes(ffa ? null : net.team);

      if (scavengeAllowed()) { pickups.update(dt); updatePickupPrompt(dt); }
      else if (pickups.drops.length) pickups.clear();

      if (hill) {
        if (hill.update(dt)) { setHillMarker(hill); showWaveBanner("Hill moved", 1300); }
        hillAcc += dt;
        if (hillAcc >= 1) { hillAcc = 0; scoreHill(); }
      }

      if (isSnd()) {
        updateSnd(dt);
      } else if (!player.alive) {
        respawnT -= dt;
        els.respawnText.textContent = `Down — back in ${Math.max(1, Math.ceil(respawnT))}`;
        if (respawnT <= 0) respawnPlayer();
      } else if (player.spawnGuard > 0) {
        player.spawnGuard -= dt;
        if (player.spawnGuard <= 0) { player.spawnGuard = 0; updateSpawnGuardHud(); }
        else if (els.spawnGuard?.hidden) updateSpawnGuardHud();
      }
    }

    grenades.update(dt, grenadeCtx());
    grenades.updateSmoke(dt, camera);
    updateBlastLights(dt);

    bullets.update(dt, {
      colliders,
      targetMeshes,
      resolveTarget: resolveBulletTarget,
      onActorHit: onBulletActorHit,
      onWorldHit: (point) => { spawnImpactBurst(point, 0xbfc4b8, 5); audio.impact(point); },
    });
    updateSparks(dt);

    // HUD updates — each only touches the DOM when its value actually changed.
    const w = currentWeapon();
    const hpPct = (player.hp / player.maxHp) * 100;
    if (hpPct !== hudCache.hpPct) { hudCache.hpPct = hpPct; els.hpFill.style.width = `${hpPct}%`; }
    const hpLow = player.hp < 30;
    if (hpLow !== hudCache.hpLow) { hudCache.hpLow = hpLow; els.hpFill.classList.toggle("is-low", hpLow); }
    const hpText = Math.ceil(player.hp);
    if (hpText !== hudCache.hpText) { hudCache.hpText = hpText; els.hpText.textContent = hpText; }
    if (w.ammoInMag !== hudCache.ammoCur) { hudCache.ammoCur = w.ammoInMag; els.ammoCur.textContent = w.ammoInMag; }
    if (w.ammoReserve !== hudCache.ammoRes) { hudCache.ammoRes = w.ammoReserve; els.ammoRes.textContent = w.ammoReserve; }
    const reloadHidden = !w.reloading;
    if (reloadHidden !== hudCache.reloadHidden) { hudCache.reloadHidden = reloadHidden; els.reloadTag.hidden = reloadHidden; }
    if (w.ads !== hudCache.ads) { hudCache.ads = w.ads; els.crosshair.classList.toggle("is-ads", w.ads); }
    const lowhp = player.hp < 25;
    if (lowhp !== hudCache.lowhp) { hudCache.lowhp = lowhp; els.lowhp.classList.toggle("is-low", lowhp); }

    // A cooked grenade keeps ticking in your hand, and can go off in it.
    if (cooking.def) {
      cooking.fuse -= dt;
      els.cook.hidden = !cooking.def.cookable;
      els.cookFill.style.width = `${Math.max(0, (cooking.fuse / cooking.def.fuse) * 100)}%`;
      if (cooking.fuse <= 0) {
        const held = cooking.def;
        cooking.fuse = 0;
        releaseCook();               // it leaves the hand at zero fuse…
        const at = player.pos.clone();
        explosionFx(held, at);       // …and detonates right there
        if (held.damage > 0) areaDamage(at, held.radius, held.damage, held, {});
        if (held.blind) flashPlayer(at, held);
        if (held.emp) empPlayer(at, held);
        if (held.smoke) grenades.spawnSmoke(held, at);
      }
    }

    blindT = Math.max(0, blindT - dt);
    els.blind.style.opacity = String(Math.min(1, blindT * 0.85));

    const wasEmp = empT > 0;
    empT = Math.max(0, empT - dt);
    if (wasEmp !== empT > 0 || empT > 0) applyEmpState(empT > 0);

    // Standing in your own smoke should cost you the same visibility it
    // costs everyone else.
    // Capped well below opaque: inside the cloud you lose the room, but you
    // keep your weapon and your footing. A full whiteout just reads as broken.
    const haze = grenades.densityAt(camera.position);
    els.smoke.style.opacity = String(haze * 0.66);

    shakeT = Math.max(0, shakeT - dt);
    if (shakeT <= 0) shakeMag = 0;

    hitFlashT = Math.max(0, hitFlashT - dt * 4);
    els.hitflash.classList.toggle("is-hit", hitFlashT > 0.05);
    impactPass.uniforms.uHitFlash.value = hitFlashT;
    impactPass.uniforms.uLowHp.value = player.hp < 25 ? 1 : 0;
    impactPass.uniforms.uAberration.value = Math.min(1, w.viewKickKnockback * 6);
    impactPass.uniforms.uTime.value = t;
    suppressT = Math.max(0, suppressT - dt * 1.1);
    impactPass.uniforms.uSuppress.value = suppressT;
    drawMinimap();

    // fov kick based on sprint/ads
    const def = w.def;
    let targetFov = baseFov;
    if (w.ads) targetFov = baseFov * def.adsFovMult;
    if (move.sprinting && !w.ads) targetFov = baseFov * 1.06;
    if (move.stance === STANCE.SLIDE) targetFov = baseFov * 1.12;
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 10);
    camera.updateProjectionMatrix();

    const targetWeaponFov = 58 - w.adsT * 8;
    weaponCamera.fov += (targetWeaponFov - weaponCamera.fov) * Math.min(1, dt * 10);
    weaponCamera.updateProjectionMatrix();
  }

  if (gameState === "menu") {
    updateLobbyCamera(dt);
    if (inspectorLive && !els.title.hidden) inspector?.tick(dt);
    if (charInspectorLive && !els.title.hidden) charInspector?.tick(dt);
  }

  composer.render();

  if (gameState === "playing") {
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(weaponScene, weaponCamera);
    renderer.autoClear = true;
  }
}

const _euler = new THREE.Euler(0, 0, 0, "YXZ");
const _listenFwd = new THREE.Vector3();
const _listenUp = new THREE.Vector3();
let stepPhase = 0;

/* Last value written to each per-frame HUD node. The DOM write itself is
   cheap, but it was unconditional — every one of these touched layout/paint
   60×/sec even sitting still with full ammo and health. Comparing first
   means the browser only does anything the frame a number actually moves. */
const hudCache = { hpPct: -1, hpLow: null, hpText: -1, ammoCur: -1, ammoRes: -1, reloadHidden: null, ads: null, lowhp: null };

function updatePlayer(dt) {
  const w = currentWeapon();

  const gp = gamepadState.connected;

  if ((isTouch && (touchState.lookDX || touchState.lookDY)) || (gp && (gamepadState.lookDX || gamepadState.lookDY))) {
    look.yaw -= touchState.lookDX + gamepadState.lookDX;
    look.pitch -= touchState.lookDY + gamepadState.lookDY;
    look.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, look.pitch));
    touchState.lookDX = 0; touchState.lookDY = 0;
    gamepadState.lookDX = 0; gamepadState.lookDY = 0;
  }

  let ix = 0, iz = 0;
  if (isTouch) {
    ix += touchState.moveX;
    iz += -touchState.moveY;
  }
  if (gp) {
    ix += gamepadState.moveX;
    iz += -gamepadState.moveY;
  }
  if (!isTouch && !gp) {
    if (keys.has("KeyW")) iz += 1;
    if (keys.has("KeyS")) iz -= 1;
    if (keys.has("KeyA")) ix -= 1;
    if (keys.has("KeyD")) ix += 1;
  }
  ix = Math.max(-1, Math.min(1, ix));
  iz = Math.max(-1, Math.min(1, iz));

  // Dead players keep their camera but stop driving anything — and so does
  // everyone during the pre-match countdown. Look is deliberately still live:
  // you can size up the room while you wait, you just can't leave the mark.
  const frozen = !player.alive || isStaging();
  if (frozen) { ix = 0; iz = 0; }

  // Q aims as well as right mouse.
  // An EMP kills the optic, so there is nothing to aim down until it clears.
  const wantAds = empT <= 0
    && ((isTouch && touchState.ads) || (gp && gamepadState.ads) || adsHeld || keys.has("KeyQ"));
  const wantFire = (isTouch && touchState.firing) || (gp && gamepadState.firing) || mouseDown;
  if (isSnd()) sndInteractHeld = !frozen && ((isTouch && touchState.interact) || keys.has("KeyE"));

  move.update(dt, {
    forward: iz,
    strafe: ix,
    sprint: (isTouch || gp) ? iz > 0.82 : keys.has("ShiftLeft"),
    jump: !frozen && ((isTouch && touchState.jump) || (gp && gamepadState.jump) || keys.has("Space")),
    crouch: !frozen && ((isTouch && touchState.crouch) || (gp && gamepadState.crouch) || keys.has("KeyC")),
    dive: !frozen && ((isTouch && touchState.dive) || keys.has("ControlLeft") || keys.has("ControlRight")),
    yaw: look.yaw,
    adsHeld: wantAds,
    speedMult: w.moveSpeedMult,
    sprintMult: w.def.sprintMult,
    inertia: w.def.inertia,
  });

  if (move.moving && move.grounded && player.alive) {
    stepPhase += dt * (move.sprinting ? 13 : 9);
    if (stepPhase > Math.PI) { stepPhase -= Math.PI; audio.step(); }
  } else {
    stepPhase = 0;
  }

  updateEnemySteps(dt);

  move.eyePosition(player.pos);
  camera.position.copy(player.pos);

  // One place composes the camera: aim + weapon recoil.
  const shake = shakeT > 0 ? shakeMag * (shakeT / 0.45) : 0;
  _euler.set(
    look.pitch + w.recoilPitch + (Math.random() - 0.5) * shake,
    look.yaw + w.recoilYaw + (Math.random() - 0.5) * shake,
    (Math.random() - 0.5) * shake * 0.6,
  );
  camera.quaternion.setFromEuler(_euler);

  // Panned sounds resolve against wherever the camera now is and faces.
  _listenFwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
  _listenUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
  audio.setListener(camera.position, _listenFwd, _listenUp);

  // Projects against the camera, so it has to follow the camera update or
  // every number trails a frame behind the thing it is stuck to.
  updateDamageNumbers(dt);

  // Swinging locks out the trigger; the melee weapon has no trigger at all.
  const swinging = !!player.melee && player.melee.busy;
  if (player.melee && player.melee.update(dt)) meleeConnect();

  const canAct = !move.busy && player.alive && !isStaging();
  // Aiming itself is harmless during the pre-match countdown — no shooting,
  // no movement change beyond what ADS already slows — so it gets its own,
  // looser gate instead of inheriting the staging freeze from canAct.
  const canAds = !move.busy && player.alive;
  w.update(dt, {
    moving: move.moving,
    sprinting: move.sprinting,
    grounded: move.grounded,
    jumping: move.jumping,
    adsHeld: wantAds && canAds,
    canAds,
  });

  // Holding the melee weapon turns the fire button into a swing.
  if (player.holding === "melee") {
    if (wantFire && fireEdgeTrigger && canAct) swingMelee();
    return;
  }

  if (wantFire && canAct && !swinging) {
    if (w.def.fireMode === "auto") {
      if (w.canFire()) fireOnce();
    } else if (w.def.fireMode === "burst") {
      if (fireEdgeTrigger && w.burstLeft <= 0 && w.canFire()) w.burstLeft = w.def.burst || 2;
    } else if (fireEdgeTrigger && w.canFire()) {
      fireOnce();
    }
  }

  // A burst finishes on its own cadence even if the trigger is released.
  if (w.burstLeft > 0 && canAct && w.canFire()) {
    fireOnce();
    w.burstLeft--;
  }
}

let fireEdgeTrigger = false;
window.addEventListener("mousedown", (e) => {
  if (e.button === 0) { fireEdgeTrigger = true; setTimeout(() => fireEdgeTrigger = false, 16); }
});
els.touchFire.addEventListener("touchstart", () => { fireEdgeTrigger = true; setTimeout(() => fireEdgeTrigger = false, 16); });

/* The melee view model: raised whenever it's the held weapon, and swung
   through the pose MeleeState solves each frame — the same rest grip, chop
   and thrust as the Godot reference. A quick melee borrows the same mesh, so
   it pops in for the swing and drops out again the moment it's over. */
let meleeIdleT = 0;
function updateMeleeView(dt) {
  const mesh = activeMeleeMesh;
  const melee = player.melee;
  if (!mesh || !melee) return;

  const held = player.holding === "melee";
  const swinging = melee.busy;
  mesh.visible = held || swinging;
  if (activeWeaponMesh) activeWeaponMesh.visible = !held && !swinging;
  if (!mesh.visible) { meleeIdleT = 0; return; }

  const { pos, quat } = melee.pose();
  mesh.position.copy(pos);
  mesh.quaternion.copy(quat);

  // Slow figure-eight breathing bob while idle, matching the reference's
  // idle animation — suppressed mid-swing so it doesn't fight the pose.
  if (!swinging) {
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
  }
}
const MELEE_IDLE_PERIOD = 3.2;
const _meleeIdleEuler = new THREE.Euler();

let weaponLowerT = 0;

/* Weapon inspect (T). Turns the gun over in your hands for a couple of
   seconds — pure flourish, cancelled by anything that matters (firing,
   aiming, reloading, sprinting) so it can never cost you a fight. */
const INSPECT_TIME = 2.1;
let inspectT = 0;

function startInspect() {
  if (inspectT > 0 || !player.alive || gameState !== "playing") return;
  if (player.holding !== "gun" || move.busy) return;
  const w = currentWeapon();
  if (w.reloading || w.adsT > 0.05) return;
  inspectT = INSPECT_TIME;
  audio.reload();     // the same handling clicks, which is what an inspect is
}

function updateInspect(dt) {
  if (inspectT <= 0) return;
  const w = currentWeapon();
  // Anything that matters takes the gun back immediately.
  if (!player.alive || move.sprinting || move.busy || w.reloading || w.adsT > 0.05
      || player.holding !== "gun") {
    inspectT = 0;
    return;
  }
  inspectT = Math.max(0, inspectT - dt);
}

const _inspectPose = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 };

function inspectPose() {
  const p = _inspectPose;
  if (inspectT <= 0) {
    p.x = p.y = p.z = p.pitch = p.yaw = p.roll = 0;
    return p;
  }
  const t = 1 - inspectT / INSPECT_TIME;          // 0..1 through the animation
  // Ease in and out so the gun doesn't snap at either end.
  const ease = Math.sin(Math.min(1, t / 0.18) * Math.PI / 2)
    * Math.sin(Math.min(1, (1 - t) / 0.22) * Math.PI / 2);
  const turn = Math.sin(t * Math.PI * 2);

  // Kept deliberately small: the gun should turn over in the corner of the
  // view, not swing across it and blind you while it plays.
  p.x = ease * (-0.03 + turn * 0.02);
  p.y = ease * 0.02;
  p.z = ease * 0.05;
  p.pitch = ease * (0.12 + Math.sin(t * Math.PI) * 0.07);
  p.yaw = ease * turn * 0.34;
  p.roll = ease * (0.26 + Math.sin(t * Math.PI * 2 + 1) * 0.2);
  return p;
}

const _laserRay = new THREE.Raycaster();
const _laserOrigin = new THREE.Vector3();
const _laserDir = new THREE.Vector3();
const LASER_ADS_THRESHOLD = 0.4; // beam only reads as "activated" once the sight has actually come up

/* The laser attachment only exists on the gun model if it's equipped
   (weapon-model.js), so absence of the beam node means "no laser" — nothing
   here needs to re-check the loadout. Aiming, not equipping, turns it on:
   the beam is dark until the sight comes up, same as the reflex/ACOG glass. */
function updateLaserBeam(mesh, w) {
  const beam = mesh.userData.laserBeam;
  if (!beam) return;
  if (w.adsT < LASER_ADS_THRESHOLD) { beam.visible = false; return; }

  camera.getWorldPosition(_laserOrigin);
  camera.getWorldDirection(_laserDir);

  let range = raycastWorld(colliders, _laserOrigin, _laserDir, 60);
  if (targetMeshes.length) {
    _laserRay.set(_laserOrigin, _laserDir);
    _laserRay.near = 0;
    _laserRay.far = range;
    const hits = _laserRay.intersectObjects(targetMeshes, true);
    if (hits.length) range = hits[0].distance;
  }

  // Cylinder height runs along the geometry's own Y axis; rotation.x = 90deg
  // (set at build time) is what points that axis down the barrel, so the
  // beam is stretched with scale.y, not scale.z, and re-centered along
  // local Z to keep its near end pinned at the laser unit.
  const origin = mesh.userData.laserOrigin;
  const len = Math.max(0.02, range - (-origin.z));
  beam.scale.y = len;
  beam.position.z = origin.z - len / 2;
  const fade = Math.min(1, (w.adsT - LASER_ADS_THRESHOLD) / (1 - LASER_ADS_THRESHOLD));
  beam.material.opacity = 0.85 * fade;
  beam.visible = true;
}

function updateWeaponView(dt) {
  const w = currentWeapon();
  updateMeleeView(dt);
  const mesh = activeWeaponMesh;
  if (!mesh) return;

  // Aiming plants the sight: bob and idle sway fall away as the weapon
  // comes up, so walking while aimed no longer swims the whole gun across
  // the screen the way full-amplitude bob did.
  const steady = 1 - w.adsT * 0.85;
  const bobX = Math.sin(w.bobPhase) * w.def.bobAmp * 0.5 * steady;
  const bobY = Math.abs(Math.cos(w.bobPhase)) * w.def.bobAmp * steady;
  const swayX = Math.sin(clock.elapsedTime * w.def.swaySpeed) * w.def.swayAmp * steady;
  const swayY = Math.cos(clock.elapsedTime * w.def.swaySpeed * 0.8) * w.def.swayAmp * 0.6 * steady;

  const adsOffset = w.adsT;
  const hipPos = new THREE.Vector3(0.22, -0.2, -0.55);
  const aimPoint = mesh.userData.aimPoint || new THREE.Vector3(0, 0, -0.4);
  const adsViewDistance = -0.46; // where the sight should sit in front of the weapon camera
  const adsPos = new THREE.Vector3(-aimPoint.x, -aimPoint.y, adsViewDistance - aimPoint.z);
  const basePos = hipPos.clone().lerp(adsPos, adsOffset);

  // Gun drops out of the way while sprinting, sliding or vaulting.
  const wantLower = (move.sprinting || move.stance === STANCE.SLIDE || move.busy) ? 1 : 0;
  weaponLowerT += (wantLower - weaponLowerT) * Math.min(1, dt * 9);

  updateInspect(dt);
  const insp = inspectPose();

  mesh.position.set(
    basePos.x + bobX + swayX - w.viewKickKnockback * 0.4 + weaponLowerT * 0.05 + insp.x,
    basePos.y + bobY + swayY - weaponLowerT * 0.17 + insp.y,
    basePos.z + w.viewKickKnockback * 0.6 + weaponLowerT * 0.08 + insp.z
  );
  mesh.rotation.set(
    -w.viewKickPitch * 0.8 + weaponLowerT * 0.55 + insp.pitch,
    w.viewKickYaw * 0.6 + (1 - adsOffset) * 0.05 + insp.yaw,
    (1 - adsOffset) * 0.08 + weaponLowerT * 0.38 + insp.roll
  );

  if (mesh.userData.sight) mesh.userData.sight.visible = true;
  updateLaserBeam(mesh, w);

  if (muzzleFlashT > 0) {
    muzzleFlashT -= dt;
    muzzleMat.uniforms.uIntensity.value = Math.max(0, muzzleFlashT / 0.045) * w.def.muzzleFlashScale;
    muzzleFlash.rotation.z += 20 * dt;
  } else {
    muzzleMat.uniforms.uIntensity.value = 0;
  }
  muzzleLight.intensity *= Math.max(0, 1 - dt * 30);
  const barrelTipLocal = new THREE.Vector3(0, 0.02, mesh.userData.muzzleZ ?? -0.62);
  muzzleFlash.position.copy(basePos).add(barrelTipLocal);
  muzzleLight.position.copy(muzzleFlash.position);
}

// -------------------- boot --------------------

resize();
applySettings();
initEscapeMenu();
loadMap(lobbyMapId());
els.loading.hidden = true;
animate();

/* Test hook. This file is a module, so nothing above is reachable from a
   headless harness by bare identifier the way the main site's inline script
   is. Behind ?tohooks=1 so normal play never exposes it. */
if (/[?&]tohooks=1/.test(location.search)) {
  window.__trollOps = {
    els, net, player, move, look, bots, remotes, loadout, builtMap: () => builtMap,
    startGame, beginMatch, spawnForTeam, respawnPlayer, damagePlayer, breakSpawnGuard,
    startIntermission, updateIntermission, occupants, notePointDeath,
    isStaging, beginStaging, endStaging, updateStaging,
    isSnd, bomb: () => bomb, bombSites: () => bombSites, sndRound: () => sndRound,
    sndAttackTeam: () => sndAttackTeam, sndEliminated: () => sndEliminated,
    beginSndRound, sndRoundWin, updateSnd, siteUnderfoot, sndAliveCounts,
    stageT: () => stageT, stageOwner: () => stageOwner,
    registerDeath, noteDealt, creditAssistIfOwed, showDeathCard,
    noteDamage, assistersFor, addMatchXp, awardKillXp, pushKillfeed,
    damageLog: () => damageLog, dealtLog: () => dealtLog,
    voteOptions: () => voteOptions,
    intermissionT: () => intermissionT,
    state: () => gameState,
    grenades, audio, camera, colliders,
    empT: () => empT,
    empPlayer, flashPlayer, explosionFx,
    startInspect, inspectT: () => inspectT, inspectPose,
    showHitmarker, damageNumbers: () => damageNumbers,
    setMode: (id) => { modeId = id; },
    THREE,
  };
}

