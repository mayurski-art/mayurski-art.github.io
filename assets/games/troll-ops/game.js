// Troll Forces — main game module.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

import { WeaponState, WEAPON_DEFS, chargedShotDef } from "./weapons.js?v=cg1";
import { buildWeaponMesh, stripLights, preloadWeaponModels, setWeaponEnvMap, hasDetailedModel } from "./weapon-model.js?v=cg1";
import { WeaponInspector } from "./inspector.js?v=cg1";
import { buildGlove, poseGlove, gloveWrist } from "./glove-model.js?v=gl5";
import { CharacterInspector } from "./char-inspector.js?v=cg1";
import { Loadout } from "./loadout.js?v=hg6e";
import { StreakPicker } from "./streak-picker.js?v=gu1";
import { StreakState, STREAK_DEFS, SCORE, streaksAllowed, streakIconSvg, streakBadgeSvg, streakShortName, PACKAGE_STREAK_POOL } from "./scorestreaks.js?v=gu1";
import { K9Pack, K9, resolveK9 } from "./k9-unit.js?v=sw1";
import {
  CarePackage, MarkerCanister, HunterDrone, HelicopterGunship, ReconPlane, AirstrikeRun, BlastFx,
  VtolWarship, WARSHIP_GUNS, VsatSatellite,
  PKG_CRUSH_RADIUS,
  DRONE_DAMAGE, DRONE_SPLASH_RADIUS,
  AIRSTRIKE_DELAY, AIRSTRIKE_RADIUS, AIRSTRIKE_DAMAGE, AIRSTRIKE_BOMBS,
  HELI_FIRE_RANGE, HELI_DAMAGE,
} from "./streak-entities.js?v=vsat2";
import { KillstreakUi } from "./killstreak-ui.js?v=to-medals2";
import { medalSvg } from "./medals.js?v=to-medals2";
import { StrikeTablet, STRIKE_TARGETS } from "./streak-tablet.js";
import { KillCam } from "./killcam.js?v=to-fx3";
import { Achievements } from "./achievements.js?v=gu1";
import { addXp, syncXp, xpForRun, xpForMatch, XP, XP_SCALE } from "./progression.js?v=gu1";
import { buildMap, disposeMap, MAPS, MAP_IDS } from "./maps.js?v=hg6e";
import { Net, makeRoomCode, MAX_PLAYERS, MAX_PLAYERS_ROYALE, isSyntheticId } from "./net.js?v=to-lk1";
import { MatchChat, safeUid } from "./chat.js?v=to-social1";
import { RemotePlayers, TEAMS, STANCE_LOWER, ROLL_TIME, rollRig, poseDrop, DROP_BUS, DROP_FALL, DROP_GLIDE } from "./remote-players.js?v=rp3";
import { buildHumanoid, poseHumanoid, poseDeath, DEATH_TIME, poseThrowArm, THROW_TIME, gaitPhaseRate, mountHeldWeapon, aimRig, flinchRigFrom, DANCES, ParryState, parryWeights, PARRY_ZONES } from "./character.js?v=to-lk1";
import { EmoteWheel, EMOTES } from "./emote-wheel.js?v=to-fx3";
import { poseEmoteCode, emoteCode, emoteSeconds, FP_HAND_POSES } from "./emotes.js?v=to-fx3";
import {
  MODES, MODE_IDS, weaponForMode, playerWon, matchWinner, matchWinnerOnTimeout,
  Hill, Bomb, pickBombSites, pickHillPoints, splitSpawnSides, PLANT_TIME, DEFUSE_TIME, INFECTION,
} from "./modes.js?v=vm1";
import { BotManager } from "./bots.js?v=cg1";
import { resolveWeapon, defaultLoadoutFor } from "./attachments.js?v=cg1";
import { GameAudio } from "./audio.js?v=to-r100";
import { insidePolygon } from "./edge.js";
import { ROYALE, RoyaleZone, ZoneVisual, LootField, lootSpots, seededRng, hashSeed, gunDisplayName, ITEM_NAMES } from "./royale.js?v=cg1";
import { GameMusic } from "./music.js?v=to-s12c-optin";
import { stage, rise, damp, smoothstep } from "./anim-curves.js";
import { AnimDebugLab } from "./anim-debug.js";
import { buildStreakDevice, buildMarkerDevice, drawTabletScreen } from "./streak-device.js?v=to-df1";
import { buildHumanHand, placeHand, poseHumanHand, handWrist, handMaterials, inkOutline, HAND_POSES, HAND_GRIPS } from "./hand-model.js?v=to-grip2";
import { FlowField } from "./nav.js?v=ti1";
import { ZombieDirector } from "./zombies.js?v=zr1";
import { ImpactShader, makeMuzzleFlashMaterial } from "./shaders.js";
import { ImpactFx } from "./impact-fx.js";
import { LightPool } from "./light-pool.js";
import { loadModel } from "./battlefield-props.js";
import { kickCurve } from "./attachments.js?v=cg1";
import { WaveSpawner } from "./enemies.js?v=to-ads2";
import { BulletSystem, segmentBlocked, raycastWorld } from "./ballistics.js?v=cg1";
import { MovementController, STANCE, groundHeightAt } from "./movement.js?v=ti1";
import { MeleeState, MELEE_DEFS, buildMeleeMesh, GrenadeSystem, blastDamage, THROWABLE_DEFS, GRENADE_GRAVITY, SABER_BLOCK, SABER_PARRY, chainsawRevAt } from "./gear.js?v=to-fx3";
import { setSaberEnvMap, preloadTrollsaber, SaberTrail } from "./trollsaber.js?v=ts2";
import { RangeSet } from "./range.js";
import { PickupSystem, SwapHold } from "./pickups.js?v=cg1";
import { HudLayout } from "./hud-layout.js?v=hl2";
import { ControllerLayout, padEmotePressed } from "./controller-layout.js?v=cl7";
import { CosmeticsPanel, cleanFaceKey } from "./cosmetics.js?v=cos1";
import { Dragonfire, DF_DAMAGE, DF_RANGE, DF_SPREAD, DF_HP } from "./dragonfire.js?v=df3";
import { SamTurret, SAM_RANGE, SAM_LOCK, SAM_SALVO_GAP, SAM_RELOAD } from "./sam-turret.js?v=sam1";
import { DROP, RoyaleDrop, Flight, buildParaglider } from "./royale-drop.js?v=rp3";
import { preloadHalloweenMelee, setHalloweenEnvMap } from "./melee-models.js?v=hw2";

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
  noBots: document.getElementById("to-nobots"),
  botStreaks: document.getElementById("to-botstreaks"),
  netStatus: document.getElementById("to-net-status"),
  hudTeams: document.getElementById("to-hud-teams"),
  hudMatchClock: document.getElementById("to-hud-matchclock"),
  scorePhantom: document.getElementById("hud-score-phantom"),
  namePhantom: document.getElementById("hud-name-phantom"),
  nameGhost: document.getElementById("hud-name-ghost"),
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
  royale: document.getElementById("to-royale"),
  royalePhase: document.getElementById("to-royale-phase"),
  royaleTimer: document.getElementById("to-royale-timer"),
  royaleAlive: document.getElementById("to-royale-alive"),
  royaleAct: document.getElementById("to-royale-act"),
  royaleActText: document.getElementById("to-royale-act-text"),
  royaleActFill: document.getElementById("to-royale-act-fill"),
  cringe: document.getElementById("to-cringe"),
  armor: document.getElementById("to-armor"),
  gearPlates: document.getElementById("to-gear-plates"),
  gearPlatesN: document.getElementById("to-gear-plates-n"),
  gearHeals: document.getElementById("to-gear-heals"),
  gearHealsN: document.getElementById("to-gear-heals-n"),
  bombSide: document.getElementById("to-bomb-side"),
  bombTimer: document.getElementById("to-bomb-timer"),
  bombPrompt: document.getElementById("to-bomb-prompt"),
  bombPromptText: document.getElementById("to-bomb-prompt-text"),
  bombBarFill: document.getElementById("to-bomb-bar-fill"),
  pickupPrompt: document.getElementById("to-pickup-prompt"),
  pickupPromptText: document.getElementById("to-pickup-prompt-text"),
  pickupBarFill: document.getElementById("to-pickup-bar-fill"),
  pickupKey: document.getElementById("to-pickup-key"),
  pickupKeyCap: document.getElementById("to-pickup-key-cap"),
  spectate: document.getElementById("to-spectate"),
  spectateOut: document.getElementById("to-spectate-out"),
  spectateName: document.getElementById("to-spectate-name"),
  spectateN: document.getElementById("to-spectate-n"),
  spectatePrev: document.getElementById("to-spectate-prev"),
  spectateNext: document.getElementById("to-spectate-next"),
  deathBy: document.getElementById("to-deathby"),
  deathByName: document.getElementById("to-deathby-name"),
  deathByMeta: document.getElementById("to-deathby-meta"),
  xpPopups: document.getElementById("to-xp-pops"),
  damageNumbers: document.getElementById("to-dmg-nums"),
  ksBadges: document.getElementById("to-ks-badges"),
  ksBanner: document.getElementById("to-ks-banner"),
  screenPulse: document.getElementById("to-screen-pulse"),
  ssHud: document.getElementById("to-ss-hud"),
  ssMeterFill: document.getElementById("to-ss-meter-fill"),
  ssSlots: document.getElementById("to-ss-slots"),
  ssPicker: document.getElementById("to-ss-picker"),
  ssCount: document.getElementById("to-ss-count"),
  streakMark: document.getElementById("to-streak-mark"),
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
  goMedals: document.getElementById("to-go-medals"),
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
  charge: document.getElementById("to-charge"),
  saberMeter: document.getElementById("to-saber-meter"),
  chargeCells: document.getElementById("to-charge-cells"),
  killcamBars: document.getElementById("to-killcam-bars"),
  hitmarker: document.getElementById("to-hitmarker"),
  hitflash: document.getElementById("to-hitflash"),
  hitdir: document.getElementById("to-hitdir"),
  lowhp: document.getElementById("to-lowhp"),
  deathfade: document.getElementById("to-deathfade"),
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
  touchFireL: document.getElementById("to-touch-fire-l"),
  touchTac: document.getElementById("to-touch-tac"),
  touchMoveZone: document.getElementById("to-touch-movezone"),
  touchAds: document.getElementById("to-touch-ads"),
  touchJump: document.getElementById("to-touch-jump"),
  touchReload: document.getElementById("to-touch-reload"),
  touchSlide: document.getElementById("to-touch-slide"),
  touchMelee: document.getElementById("to-touch-melee"),
  touchNade: document.getElementById("to-touch-nade"),
  touchInteract: document.getElementById("to-touch-interact"),
  touchSwap: document.getElementById("to-touch-swap"),
  touchAdmire: document.getElementById("to-touch-admire"),
  touchEmote: document.getElementById("to-touch-emote"),
  touchStreak: document.getElementById("to-touch-streak"),
  touchEndStreak: document.getElementById("to-touch-endstreak"),
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
  rangeSpawnBot: document.getElementById("to-range-spawnbot"),
  pauseRange: document.getElementById("to-pause-range"),
  pauseSpawnBot: document.getElementById("to-pause-spawnbot"),
  pauseClearBots: document.getElementById("to-pause-clearbots"),
};

const isTouch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;

// Standard gamepad mapping: left stick moves, right stick looks, triggers
// fire/aim. Covers Bluetooth/MFi pads on iPad as well as desktop controllers
// — no separate "controller mode" toggle, it activates the moment a pad
// reports input, same way key state does.
const GP_DEADZONE = 0.18;
const gamepadState = {
  connected: false, moveX: 0, moveY: 0, lookDX: 0, lookDY: 0,
  firing: false, ads: false, jump: false, crouch: false, pickup: false, endStreak: false,
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
function setTouchControls(on) {
  els.touch.hidden = !(isTouch && on) || gamepadState.connected;
  // The whole touch HUD layout (and the portrait "turn it sideways" card)
  // hangs off this class, so a phone menu keeps its own layout.
  document.body.classList.toggle("to-touch-play", !els.touch.hidden);
  if (!els.touch.hidden) lockLandscape();
}

/* Settings > HUD layout: drag the touch buttons and HUD pieces anywhere.
   Opens from the lobby or the pause menu; the menus step aside and the HUD
   (and, on a phone, the touch pad) shows until Done. */
let layoutRestore = null;
const hudLayout = new HudLayout({
  stage: els.hud.parentElement || document.body,
  touch: isTouch,
  onOpen() {
    layoutRestore = {
      screens: [els.title, els.pause, els.gameover].map((el) => [el, el.hidden]),
      hud: els.hud.hidden, touch: els.touch.hidden,
    };
    for (const [el] of layoutRestore.screens) el.hidden = true;
    els.hud.hidden = false;
    setTouchControls(true);
  },
  onClose() {
    const r = layoutRestore;
    layoutRestore = null;
    if (!r) return;
    for (const [el, was] of r.screens) el.hidden = was;
    els.hud.hidden = r.hud;
    setTouchControls(!r.touch);
  },
});
for (const b of document.querySelectorAll("[data-hud-layout]")) b.addEventListener("click", () => hudLayout.open());

/* Android Chrome can hold landscape once fullscreen; iOS can do neither and
   gets the rotate card instead. Both calls fail quietly where unsupported. */
let triedLandscape = false;
function lockLandscape() {
  if (triedLandscape || !isTouch) return;
  triedLandscape = true;
  const el = document.documentElement;
  const go = () => screen.orientation?.lock?.("landscape").catch(() => {});
  if (el.requestFullscreen && !document.fullscreenElement) {
    el.requestFullscreen({ navigationUI: "hide" }).then(go).catch(() => {});
  } else go();
}
setTouchControls(false);
// Settings > Controller (lobby and Esc menu): the pad drawn with its bindings.
for (const host of document.querySelectorAll("[data-pad-layout]")) new ControllerLayout(host);
function markPadPresent() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  document.body.classList.toggle("to-has-pad", Array.from(pads).some((p) => p && p.connected));
}
window.addEventListener("gamepadconnected", markPadPresent);
window.addEventListener("gamepaddisconnected", markPadPresent);
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
  gamepadState.pickup = false;
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
  mapCard: {
    thumb: document.getElementById("to-pf-mapcard-thumb"),
    name: document.getElementById("to-pf-mapcard-name"),
    blurb: document.getElementById("to-pf-mapcard-blurb"),
    change: document.getElementById("to-pf-mapcard-change"),
  },
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
}, (activeWeapon) => {
  refreshLobbyMap();
  charInspector?.setWeapon(loadout.resolved);
  showSumGun();
  if (inspectorLive) {
    const gearPanel = document.getElementById("to-pfp-gear");
    inspector?.show(gearPanel && !gearPanel.hidden ? loadout.melee : activeWeapon);
  }
});

// -------------------- scorestreaks --------------------

const streakPicker = new StreakPicker({ picker: els.ssPicker, count: els.ssCount }, null,
  (id) => { if (activeLobbyPanel === "streaks") inspector?.showStreak(id); });

/* The local player's score meter and banked calls. Peers' meters aren't
   modelled: only the client that earned a streak calls it, and it tells
   everyone else what happened. */
const streaks = new StreakState();

/* Medal points are real, like BO2's: they pay into the scorestreak meter
   and match XP (PvP only, same as every other mid-match XP). The splash
   shows the "+50" itself, so no XP popup here. */
const killstreakUi = new KillstreakUi(
  { badges: els.ksBadges, banner: els.ksBanner, screenPulse: els.screenPulse },
  {
    onPoints: (pts) => {
      if (isPvp()) player.matchXp += Math.round(pts * XP_SCALE);
      awardScore(pts);
    },
    onSting: (metal) => audio.medal(metal),
  },
);

const achievements = new Achievements(
  (def) => killstreakUi.medal(def.name),
  (def) => killstreakUi.medal(def.name),
);

/* UAV is a team-wide reveal with a clock, so it lives as two timestamps
   rather than on `streaks` — an enemy UAV reveals us to them, not them to us,
   and both sides can have one up at once. */
const uavUntil = { phantom: 0, ghost: 0 };

function uavActiveFor(team) {
  return !!team && uavUntil[team] > performance.now();
}

/* Orbital VSAT (BO2): a satellite sweep that shows enemies AND which way
   they face. Its own clock, because nothing can shoot a satellite down: an
   enemy Counter-UAV still jams the minimap but leaves vsatUntil alone. */
const vsatUntil = { phantom: 0, ghost: 0 };
function vsatActiveFor(team) {
  return !!team && vsatUntil[team] > performance.now();
}
/* The satellite itself, crossing the sky while it's up (everyone sees it). */
function spawnVsatSat(yaw, duration) {
  const bounds = builtMap?.map?.bounds || ARENA;
  const sat = new VsatSatellite({ bounds, yaw, duration });
  flyovers.push(sat);
  scene.add(sat.root);
  return sat;
}
function startVsat(team, duration) {
  if (!team) return;
  vsatUntil[team] = Math.max(vsatUntil[team] || 0, performance.now() + duration * 1000);
}
function vsatUp() { return vsatActiveFor(uavBucket()) && !minimapJammed(); }

/* Which bucket a UAV we call belongs in. Free-for-all has no sides to share a
   reveal with, and offline play never runs chooseTeam so `net.team` is null —
   both collapse onto the same single bucket, which is also what keeps a solo
   match against bots from calling a UAV that reveals nothing. */
function uavBucket() {
  if (currentMode().ffa || !net.team) return "phantom";
  return net.team;
}

/* Whether we can currently see enemies on the minimap. An enemy
   Counter-UAV jams it, whoever's UAV is up. */
function enemiesRevealed() {
  const team = uavBucket();
  return (uavActiveFor(team) || vsatActiveFor(team)) && !minimapJammed();
}

/* Counter-UAV (BO2): an enemy one scrambles our minimap until jammedUntil,
   knocks our side's UAV down, and whoever of us had called that UAV gets
   locked out of calling another (streakLockUntil.uav). myUavUntil is how we
   know it was us. */
let jammedUntil = 0;
let myUavUntil = 0;
function minimapJammed() { return jammedUntil > performance.now(); }

/* Per-streak lockouts, ms timestamps: the gunship/K9/Swarm cooldown after a call,
   and the UAV lockout an enemy Counter-UAV hands whoever's UAV it downed.
   A banked charge waits it out; nothing is lost. */
const streakLockUntil = {};
const streakLockWhy = {};
function streakLockLeft(id) {
  const left = ((streakLockUntil[id] || 0) - performance.now()) / 1000;
  return left > 0 ? left : 0;
}
function lockStreak(id, seconds, why) {
  streakLockUntil[id] = Math.max(streakLockUntil[id] || 0, performance.now() + seconds * 1000);
  streakLockWhy[id] = why;
  updateStreakHud();
}
function clearStreakLocks() {
  for (const k of Object.keys(streakLockUntil)) delete streakLockUntil[k];
  jammedUntil = 0;
  myUavUntil = 0;
}

/* Live streak objects. Keyed by id so a net message can find the one it is
   talking about; the local player's own are flagged `owned` and are the only
   ones that decide anything. */
const streakEntities = new Map();   // id -> CarePackage | HunterDrone | HelicopterGunship
const pendingStrikes = [];          // AirstrikeRun: mark → jet → bombs, in game time

/* Pure flyover VFX for UAV — unlike streakEntities these decide nothing
   (uavUntil owns the reveal), so they don't need ids or wire lookups, just a
   list to age out and drop. */
const flyovers = [];                // ReconPlane

/* Fireball + smoke column + shock ring for streak blasts (made on first use:
   the scene doesn't exist yet up here). */
let blastFx = null;
function streakBlast(pos, scale = 1) {
  if (!blastFx) blastFx = new BlastFx(scene);
  blastFx.spawn(pos, scale);
}

/* Marking mode: the streak that's waiting for a ground point, or null. Both
   the care package and the airstrike need "look somewhere, press again", so
   they share it. */
let markingStreak = null;

/* Controller-only: which ready streak d-pad right will fire. Keyboard's `4`
   doesn't use this — it always calls the priciest ready one directly. This
   is purely for a pad, which has a spare button to dedicate to "pick"
   separately from "use". */
let selectedStreak = null;
let streakCallGuardUntil = 0;   // no calls for a moment after a care package pays out
let freshStreak = null;         // { id, until }: the slot pulses "ready" after a package

function clearStreakEntities() {
  for (const e of streakEntities.values()) e.dispose();
  streakEntities.clear();
  for (const s of pendingStrikes) s.dispose();
  pendingStrikes.length = 0;
  // Flyovers used to survive the round/match reset and finish their pass
  // over the next one.
  for (const f of flyovers) f.dispose();
  flyovers.length = 0;
  blastFx?.clear();
  if (lockEl) lockEl.hidden = true;
  strikeTablet?.lower();
  markingStreak = null;
  selectedStreak = null;
  pendingDroneLaunch = null;
  dragonfire = null;
  samHitCount.clear();
  swarmRuns.length = 0;
  warship = null;
  syncWarshipView();
  droneFields.clear();   // built against this map's colliders
  if (streakHoldActive()) endStreakHold(true);
  if (els.streakMark) els.streakMark.hidden = true;
}

/* Priciest-first order. A cheap streak like UAV re-banks roughly every two
   kills, well before a pricier one like Hunter-Killer does — sorting
   cheapest-first meant the single-button call kept re-firing UAV forever and
   a banked Hunter-Killer charge never got used until UAV happened to be
   spent or deselected. Most-valuable-first means whichever streak took the
   most kills to earn is the one the button actually fires. */
function readyStreaksOrdered() {
  return streaks.readyIds().filter((id) => !streakLockLeft(id))
    .sort((a, b) => STREAK_DEFS[b].cost - STREAK_DEFS[a].cost);
}

/* D-pad down: move the pointer to the next ready streak. Does nothing with
   none ready, per how BO2's own equipment wheel behaves — there's nothing to
   select yet. */
function cycleSelectedStreak() {
  if (!streaksAllowed(currentMode()) || !player.alive || markingStreak) return;
  const ready = readyStreaksOrdered();
  if (!ready.length) { selectedStreak = null; updateStreakHud(); return; }
  const at = ready.indexOf(selectedStreak);
  selectedStreak = ready[(at + 1) % ready.length];
  updateStreakHud();
}

/* D-pad right: fire whatever is currently selected. Falls back to the
   priciest ready streak if the pointer is stale (its streak got spent
   elsewhere, or this is the first press with nothing cycled yet) — the
   button should never require two presses to do something the first time. */
function useSelectedStreak() {
  if (performance.now() < streakCallGuardUntil && !markingStreak) return;
  if (!streaksAllowed(currentMode()) || !player.alive) return;
  if (markingStreak) { confirmMark(); return; }
  const id = streaks.ready(selectedStreak) ? selectedStreak : readyStreaksOrdered()[0];
  if (!id) return;
  callStreak(id);
}

/* Where the player is looking, on the ground. Both marking streaks land at
   this point, and it's also what shows the marker reticle. */
function groundAimPoint(maxDist = 140) {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  // raycastWorld returns the distance to the first solid (maxDist if none).
  // This used to read it as a hit object, so the crosshair was never used
  // and every mark fell through to the flat-ground guess below.
  const d = raycastWorld(colliders, camera.position, dir, maxDist);
  if (d < maxDist) {
    const p = camera.position.clone().addScaledVector(dir, Math.max(0, d - 0.3));
    const top = groundHeightAt(colliders, p.x, p.z, p.y + 0.5);
    p.y = top ?? p.y;
    return p;
  }

  // Nothing solid under the crosshair. Aiming down, intersect the ground
  // plane. Aiming level or up, there is no such intersection, so drop a point
  // out in front instead — otherwise marking silently refuses whenever you
  // are looking at the horizon, which is most of the time.
  const ground = groundHeightAt(colliders, move.pos.x, move.pos.z, 40) ?? 0;
  if (dir.y < -1e-3) {
    const t = (ground - camera.position.y) / dir.y;
    if (t > 0 && t <= maxDist) return camera.position.clone().addScaledVector(dir, t);
  }
  const flat = new THREE.Vector3(dir.x, 0, dir.z);
  if (flat.lengthSq() < 1e-6) return null;   // straight up or straight down
  flat.normalize();
  const ahead = move.pos.clone().addScaledVector(flat, Math.min(30, maxDist));
  ahead.y = groundHeightAt(colliders, ahead.x, ahead.z, 60) ?? ground;
  return ahead;
}

/* The HUD's streak rows, in order: the loadout's picks, then anything a care
   package granted outside them. Keyboard slot i is key 4 + i. */
/* Left to right, cheapest to dearest (user, 2026-09-29), a care package's
   extra streak slotting in by its cost too; the keys (4, 5, 6...) follow. */
function streakSlotIds() {
  return streaks.selected.concat(streaks.readyIds().filter((id) => !streaks.selected.includes(id)))
    .sort((a, b) => STREAK_DEFS[a].cost - STREAK_DEFS[b].cost);
}

/* The touch STREAK button (and nothing else now): the selected streak, which
   is the newest one earned. It used to be the priciest ready one, and that
   was the "care package deploys a hunter-killer" bug: the two are earned
   back to back (300 / 350), so with both banked, calling the package fired
   the drone. */
function callReadyStreak() {
  if (!streaksAllowed(currentMode()) || !player.alive) return;
  if (performance.now() < streakCallGuardUntil && !markingStreak) return;

  // Already lining one up: this press is the confirm, not a new call.
  if (markingStreak) { confirmMark(); return; }

  const id = streaks.ready(selectedStreak) ? selectedStreak : readyStreaksOrdered()[0];
  if (!id) return;
  callStreak(id);
}

/* Keyboard 4/5/6/7 and a tap on a HUD row: that exact streak, never a guess.
   Its own key again confirms a mark; another ready streak's key drops the
   mark and calls that one instead. */
function callStreakSlot(i) {
  if (!streaksAllowed(currentMode()) || !player.alive) return;
  if (performance.now() < streakCallGuardUntil && !markingStreak) return;
  const id = streakSlotIds()[i];
  if (!id) return;
  if (markingStreak) {
    if (id === markingStreak) { confirmMark(); return; }
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
function callStreak(id) {
  if (id === "dragonfire") {
    const why = dragonfireBlocked();
    if (why) {
      showWaveBanner(`DRAGONFIRE ${DF_BLOCK_TEXT[why]} — GET OUTSIDE`, 1600);
      return;
    }
  }
  const lock = streakLockLeft(id);
  if (lock > 0) {
    showWaveBanner(`${STREAK_DEFS[id].name} ${streakLockWhy[id] === "jammed" ? "jammed" : "cooling down"}: ${Math.ceil(lock)}s`, 1100);
    return;
  }
  // The marking streaks don't spend until the point is confirmed — dying or
  // cancelling mid-mark must not eat the reward.
  if (id === "airstrike") {
    // BO2's Lightning Strike: up comes the tablet, you mark three spots on
    // the overhead map. Nothing is spent until the third is marked.
    markingStreak = id;
    cancelCook();
    updateStreakHud();
    beginStreakHold(0, "tablet", "strike");
    startTabletDive(0.95, () => { if (markingStreak === "airstrike") openStrikeTablet(); });
    return;
  }
  if (id === "carepackage") {
    // BO2: out comes the smoke marker; throwing it is what calls the drop.
    // Nothing is spent until it leaves your hand.
    markingStreak = id;
    cancelCook();
    showWaveBanner("CARE PACKAGE — THROW THE MARKER", 2000);
    updateStreakHud();   // keeps the touch button up through the mark
    beginStreakHold(0, "marker");
    return;
  }

  if (!streaks.spend(id)) return;
  cancelCook();   // a grenade in hand goes back on the belt
  fireStreak(id);
  // Firing clears the pointer to the next ready one, so d-pad right on a
  // controller is immediately useful again without a re-cycle.
  selectedStreak = readyStreaksOrdered()[0] || null;
  updateStreakHud();
}

/* Second press of the marking flow: commit to where we're looking. */
function confirmMark() {
  const id = markingStreak;
  // On the tablet, the streak's own key marks the spot under the reticle.
  if (id === "airstrike") { strikeTablet?.place(); return; }
  if (id === "carepackage") { throwMarker(); return; }
  const at = groundAimPoint();
  if (!at) { showWaveBanner("No ground in sight", 1200); return; }
  if (!streaks.spend(id)) { cancelMark(); return; }
  markingStreak = null;
  if (els.streakMark) els.streakMark.hidden = true;
  // A beat on the tablet to "send" it, then it lowers and the gun comes up.
  beginStreakHold(0.35);
  fireStreak(id, at);
  updateStreakHud();
}

/* What to call the FIRE/confirm action in prompts. A controller player told
   to "press 4" has no 4 to press — and on a pad, firing/confirming is d-pad
   right, not the d-pad down that only cycles the selection. */
function streakKeyLabel(id = markingStreak) {
  if (isTouch) return "STREAK";
  if (gamepadState.connected) return "D-pad right";
  const i = streakSlotIds().indexOf(id);
  return String(4 + Math.max(0, i));
}

/* Leave marking without the "Cancelled" banner: switching straight to
   another streak says enough on its own. */
function dropMarkQuietly() {
  strikeTablet?.lower();
  endStreakHold();
  markingStreak = null;
  if (els.streakMark) els.streakMark.hidden = true;
}

function cancelMark() {
  if (!markingStreak) return;
  strikeTablet?.lower();
  endStreakHold(!player.alive);
  markingStreak = null;
  if (els.streakMark) els.streakMark.hidden = true;
  showWaveBanner("Cancelled", 900);
  updateStreakHud();
}

/* Reticle + prompt while a marking streak is up. */
function updateMarking() {
  if (!els.streakMark) return;
  if (!markingStreak || !player.alive) {
    if (markingStreak && !player.alive) cancelMark();
    els.streakMark.hidden = true;
    return;
  }
  if (markingStreak === "airstrike") {
    // The tablet is the whole interface; no ground ring or prompt.
    els.streakMark.hidden = true;
    return;
  }
  // Care package: the marker is in your hand. No key hint (user call).
  els.streakMark.hidden = false;
  els.streakMark.textContent = `${STREAK_DEFS[markingStreak].name}: throw the marker`;
  els.streakMark.classList.add("is-ready");
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
const streakEnd = { t: 0, latch: false, padAt: 0, padShort: false };
let streakEndEl = null;

/* What you're in that holding can end, or null. */
function streakControlActive() {
  if (!player.alive || gameState !== "playing") return null;
  if (dragonfire && dragonfire.owned && dragonfire.alive) return "dragonfire";
  if (warship && warship.owned && !warship.dead && warship.age < warship.duration) return "warship";
  if (markingStreak) return markingStreak;
  return null;
}

/* Anything streak-shaped in your hands or under your control. */
function streakBusy() {
  return !!streakControlActive() || player.holding === "streak" || !!tabletDive || !!strikeTablet?.isOpen;
}

function endActiveStreak() {
  const what = streakControlActive();
  if (!what) return;
  tabletDive = null;
  if (what === "dragonfire") {
    // Expires on the next tick: the owner loop tells the room and drops it.
    dragonfire.duration = Math.min(dragonfire.duration, dragonfire.age);
    endStreakHold(true);
    showWaveBanner("DRAGONFIRE ENDED", 1200);
  } else if (what === "warship") {
    warship.duration = Math.min(warship.duration, warship.age);
    if (net.active) net.publishStreak({ kind: "warship", action: "leave", eid: warship.id });
    endStreakHold(true);
    showWaveBanner("VTOL WARSHIP ENDED", 1200);
  } else {
    cancelMark();
  }
  audio.reload();
  updateStreakHud();
}

function streakEndKeyLabel() {
  if (isTouch) return "END";
  if (gamepadState.connected) return "\u2192";   // d-pad right
  return "X";
}

function streakEndHudEl() {
  if (streakEndEl) return streakEndEl;
  streakEndEl = document.createElement("div");
  streakEndEl.className = "to-ss-endhold";
  streakEndEl.hidden = true;
  streakEndEl.setAttribute("aria-live", "polite");
  streakEndEl.innerHTML = `<span class="to-ss-endhold-k"></span><span class="to-ss-endhold-t"></span><i class="to-ss-endhold-bar"><b></b></i>`;
  (els.streakMark?.parentElement || document.body).appendChild(streakEndEl);
  return streakEndEl;
}

/* Once a frame: the hold toward ending, its prompt, and the throwables
   greying out while a streak is busy. */
function updateStreakControl(dt) {
  const what = streakControlActive();
  const held = !!what && !localPauseOnly && (keys.has("KeyX") || (gamepadState.connected && gamepadState.endStreak) || (isTouch && touchState.endStreak));
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
  if (els.touchEndStreak) els.touchEndStreak.hidden = !isTouch || !what;
  if (els.touchEndStreak) els.touchEndStreak.style.setProperty("--p", (streakEnd.t / END_HOLD).toFixed(3));

  const el = streakEndHudEl();
  // Touch has the END button itself; the prompt is for keys and pads.
  const show = !!what && !isTouch;
  el.hidden = !show;
  if (!show) return;
  const name = what === "dragonfire" ? "Dragonfire" : what === "warship" ? "VTOL Warship" : STREAK_DEFS[what]?.name || "streak";
  el.querySelector(".to-ss-endhold-k").textContent = streakEndKeyLabel();
  el.querySelector(".to-ss-endhold-t").textContent = `Hold to ${STREAK_DEFS[what] && what === markingStreak ? "cancel" : "end"} ${name}`;
  el.style.setProperty("--p", (streakEnd.t / END_HOLD).toFixed(3));
  el.classList.toggle("is-holding", streakEnd.t > 0.02);
}

/* ---- Dragonfire needs open sky ----------------------------------------
   A quadrotor can't launch from inside a house or a tunnel (user): it
   needs sky overhead and room around you. Covered = anything solid within
   DF_SKY_UP straight up; confined = most of DF_SKY_RAYS level rays meet a
   wall within DF_SKY_SIDE (a room, a corridor, a container). The houses on
   Cul-de-Grin have walls but no roof collider, which is why the walls count
   on their own. Rays leave from DF_SKY_FROM up: over fences and waist-high
   cover (the street's median fence read as a roof from 1.5 m), under any
   real ceiling. Checked a few times a second, and only while a Dragonfire
   is ready. */
const DF_SKY_UP = 14, DF_SKY_SIDE = 12, DF_SKY_RAYS = 12, DF_SKY_BLOCKED = 9, DF_SKY_FROM = 2.0;
const dfSky = { t: 0, why: null };
const _skyFrom = new THREE.Vector3();
const _skyDir = new THREE.Vector3();
function dragonfireSkyCheck(pos) {
  _skyFrom.set(pos.x, pos.y + DF_SKY_FROM, pos.z);
  if (raycastWorld(colliders, _skyFrom, _skyDir.set(0, 1, 0), DF_SKY_UP) < DF_SKY_UP - 1e-3) return "covered";
  let blocked = 0;
  for (let i = 0; i < DF_SKY_RAYS; i++) {
    const a = (i / DF_SKY_RAYS) * Math.PI * 2;
    if (raycastWorld(colliders, _skyFrom, _skyDir.set(Math.sin(a), 0, Math.cos(a)), DF_SKY_SIDE) < DF_SKY_SIDE - 1e-3) blocked++;
  }
  return blocked >= DF_SKY_BLOCKED ? "confined" : null;
}
/* Why the Dragonfire can't launch from here right now, or null. */
function dragonfireBlocked() {
  const now = performance.now();
  if (now - dfSky.t > 250) { dfSky.t = now; dfSky.why = player.alive ? dragonfireSkyCheck(move.pos) : null; }
  return dfSky.why;
}
const DF_BLOCK_TEXT = { covered: "NEEDS OPEN SKY", confined: "TOO CONFINED" };

/* Throw the care package marker we're holding. It spends the streak, lobs
   a canister that bounces and settles, and the drop is called where it
   stops (see updateStreakEntities / MarkerCanister). */
function throwMarker() {
  if (markingStreak !== "carepackage" || !player.alive || markerThrowT > 0) return;
  if (!streaks.spend("carepackage")) { cancelMark(); return; }
  markingStreak = null;
  if (els.streakMark) els.streakMark.hidden = true;

  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  dir.y += 0.2;
  dir.normalize();
  const clear = raycastWorld(colliders, origin, dir, 0.85);
  origin.addScaledVector(dir, Math.max(0, Math.min(0.5, clear - 0.25)));

  const eid = `pkg-${net.id}-${Math.round(performance.now())}`;
  // The reward is rolled HERE, once, and travels on the wire — rolling it on
  // open would let two clients disagree about the same crate.
  const marker = new MarkerCanister({ id: eid, origin, dir, world: droneWorld, owned: true });
  marker.reward = rollPackageReward();
  streakEntities.set(eid, marker);
  scene.add(marker.root);
  if (net.active) {
    net.publishStreak({
      kind: "carepackage", action: "marker", eid,
      ox: round2(origin.x), oy: round2(origin.y), oz: round2(origin.z),
      dx: round2(dir.x), dy: round2(dir.y), dz: round2(dir.z),
    });
  }
  audio.throwGear();
  localThrowT = THROW_TIME;
  // The overhand throw on the viewmodel, then the gun comes back.
  markerThrowT = MARKER_THROW_TIME;
  beginStreakHold(MARKER_THROW_TIME, "marker");
  selectedStreak = readyStreaksOrdered()[0] || null;
  updateStreakHud();
}

/* Run a streak we just called. Each one decides everything locally and then
   tells the room; nobody else re-derives any of it. */
function fireStreak(id, at = null) {
  // Everything past Lightning Strike: one call a minute at most (user), from
  // the call. A charge earned in the meantime waits in its slot.
  if (STREAK_DEFS[id]?.cooldown) lockStreak(id, STREAK_DEFS[id].cooldown, "cooldown");
  switch (id) {
    case "uav": {
      const team = uavBucket();
      startUav(team, STREAK_DEFS.uav.duration);
      myUavUntil = performance.now() + STREAK_DEFS.uav.duration * 1000;
      const yaw = Math.random() * Math.PI * 2;
      if (net.active) {
        net.publishStreak({
          kind: "uav", action: "start", team, duration: STREAK_DEFS.uav.duration,
          x: round2(move.pos.x), z: round2(move.pos.z), yaw: round2(yaw),
        });
      }
      spawnRecon(round2(move.pos.x), move.pos.z, round2(yaw), STREAK_DEFS.uav.duration, { team, caller: net.id });
      showWaveBanner("UAV ONLINE", 1600);
      // Up, thumb CONFIRM, a beat on "UAV ONLINE", down (DESIGN-ARMS.md Phase 5).
      beginStreakHold(1.4, "tablet", "uav");
      break;
    }

    case "vsat": {
      const team = uavBucket();
      const dur = STREAK_DEFS.vsat.duration;
      startVsat(team, dur);
      const yaw = Math.random() * Math.PI * 2;
      spawnVsatSat(yaw, dur);
      if (net.active) {
        net.publishStreak({ kind: "vsat", action: "start", team, duration: dur, yaw: round2(yaw) });
        net.publishStreak({ kind: "callout", label: "ORBITAL VSAT", who: net.name });
      }
      showWaveBanner("ORBITAL VSAT ONLINE", 1800);
      beginStreakHold(1.5, "tablet", "vsat");
      break;
    }

    case "counteruav": {
      const def = STREAK_DEFS.counteruav;
      const yaw = Math.random() * Math.PI * 2;
      if (net.active) {
        net.publishStreak({
          kind: "cuav", action: "start", team: net.team, duration: def.duration, lockout: def.lockout,
          x: round2(move.pos.x), z: round2(move.pos.z), yaw: round2(yaw),
        });
      }
      spawnRecon(round2(move.pos.x), move.pos.z, round2(yaw), def.duration, { counter: true, team: net.team, caller: net.id });
      showWaveBanner("COUNTER-UAV ONLINE", 1600);
      beginStreakHold(1.4, "tablet", "counteruav");
      break;
    }

    case "carepackage":
      // Called by throwing the marker (throwMarker), never directly.
      break;

    case "drone": {
      // BO2: the drone comes out in your hands, spins up, and you toss it.
      // It leaves the hand DRONE_TOSS_AT into the hold (launchPendingDrone).
      pendingDroneLaunch = { eid: `streak-drone-${net.id}-${Math.round(performance.now())}` };
      beginStreakHold(DRONE_TOSS_AT + 0.35, "drone");
      break;
    }

    case "airstrike": {
      // `at` is the tablet's three marks. One bombing pass per mark, in the
      // order they were marked, a beat apart — BO2's three strikes. The jets
      // fly the way you were facing, so they come in over your shoulder.
      const pts = Array.isArray(at) ? at : [at];
      const yaw = look.yaw;
      const runs = pts.map((p, i) => ({ x: round2(p.x), z: round2(p.z), delay: round2(strikeDelay(i)) }));
      for (const r of runs) spawnAirstrike({ ...r, yaw, owned: true, team: net.team });
      if (net.active) {
        net.publishStreak({ kind: "airstrike", action: "mark", runs, yaw: round2(yaw), team: net.team });
      }
      showWaveBanner("LIGHTNING STRIKE INBOUND", 2000);
      break;
    }

    case "helicopter": {
      const eid = `streak-heli-${net.id}-${Math.round(performance.now())}`;
      const seed = Math.floor(Math.random() * 360);
      spawnHelicopter({ id: eid, seed, owned: true, team: net.team });
      if (net.active) {
        net.publishStreak({ kind: "heli", action: "spawn", eid, seed, team: net.team });
        // The gunship arriving is a match-wide moment, same as a nuke.
        net.publishStreak({ kind: "callout", label: "GUNSHIP INBOUND", who: net.name });
      }
      showWaveBanner("GUNSHIP INBOUND", 2000);
      // Same tablet call as the UAV, held a touch longer on the inbound page.
      beginStreakHold(1.6, "tablet", "gunship");
      achievements.award("gunship");
      break;
    }

    case "k9": {
      const eid = `streak-k9-${net.id}-${Math.round(performance.now())}`;
      spawnK9({ id: eid, owned: true, team: net.team, ownerId: net.id, x: move.pos.x, y: move.pos.y, z: move.pos.z, yaw: look.yaw });
      if (net.active) {
        net.publishStreak({ kind: "k9", action: "spawn", eid, team: net.team,
          x: round2(move.pos.x), y: round2(move.pos.y), z: round2(move.pos.z), yaw: round2(look.yaw) });
        net.publishStreak({ kind: "callout", label: "K9 UNIT", who: net.name });
      }
      showWaveBanner("K9 UNIT RELEASED", 1800);
      // No tablet for the dogs: two fingers in the mouth and a whistle.
      beginStreakHold(WHISTLE_HOLD, "whistle");
      audio.whistle(null, WHISTLE_BLOW_AT);
      break;
    }

    case "warship": {
      const eid = `streak-vtol-${net.id}-${Math.round(performance.now())}`;
      const seed = Math.floor(Math.random() * 360);
      warship = spawnWarship({ id: eid, seed, owned: true, team: net.team });
      warshipGun = "chain";
      if (net.active) {
        net.publishStreak({ kind: "warship", action: "spawn", eid, seed, team: net.team });
        net.publishStreak({ kind: "callout", label: "VTOL WARSHIP", who: net.name });
      }
      showWaveBanner("VTOL WARSHIP INBOUND", 1400);
      beginStreakHold(WARSHIP_BOARD_AT, "tablet", "warship");
      startTabletDive(WARSHIP_BOARD_AT);
      break;
    }

    case "samturret": {
      const eid = `streak-sam-${net.id}-${Math.round(performance.now())}`;
      const at = samDeployPoint(move.pos, look.yaw);
      spawnSam({ id: eid, owned: true, team: net.team, ...at });
      if (net.active) {
        net.publishStreak({ kind: "sam", action: "spawn", eid, team: net.team, x: round2(at.x), y: round2(at.y), z: round2(at.z), yaw: round2(at.yaw) });
        net.publishStreak({ kind: "callout", label: "SAM TURRET", who: net.name });
      }
      showWaveBanner("SAM TURRET DEPLOYED", 1600);
      beginStreakHold(1.3, "tablet", "samturret");
      break;
    }

    case "dragonfire": {
      const eid = `streak-df-${net.id}-${Math.round(performance.now())}`;
      const from = new THREE.Vector3(move.pos.x - Math.sin(look.yaw) * 0.8, move.pos.y + 1.3, move.pos.z - Math.cos(look.yaw) * 0.8);
      dragonfire = spawnDragonfire({ id: eid, owned: true, team: net.team, x: from.x, y: from.y, z: from.z, yaw: look.yaw });
      if (net.active) {
        net.publishStreak({ kind: "dragonfire", action: "spawn", eid, team: net.team, x: round2(from.x), y: round2(from.y), z: round2(from.z), yaw: round2(look.yaw) });
        net.publishStreak({ kind: "callout", label: "DRAGONFIRE", who: net.name });
      }
      showWaveBanner("DRAGONFIRE INBOUND", 1200);
      beginStreakHold(DF_BOARD_AT, "tablet", "dragonfire");
      startTabletDive(DF_BOARD_AT);
      break;
    }

    case "swarm": {
      swarmRuns.push({ t: 0, next: 1.4, sent: 0 });
      if (net.active) net.publishStreak({ kind: "callout", label: "SWARM", who: net.name });
      showWaveBanner("SWARM INBOUND", 2000);
      beginStreakHold(1.4, "tablet", "swarm");
      break;
    }
  }
}

function round2(v) { return Math.round(v * 100) / 100; }

/* What's in the box. Securing a package always hands out a random free
   scorestreak (charged, ready to call in immediately) — no care packages in
   the streak pool or they'd chain forever. */
function rollPackageReward() {
  const pick = PACKAGE_STREAK_POOL[Math.floor(Math.random() * PACKAGE_STREAK_POOL.length)];
  return `streak:${pick}`;
}

function spawnCarePackage({ id, x, z, reward, owned, ownerTeam, groundY = null }) {
  // A marker copy with the same id (someone else's throw, as seen here) is
  // replaced by the drop.
  const prev = streakEntities.get(id);
  if (prev) { prev.dispose(); streakEntities.delete(id); }
  const gy = groundY ?? groundHeightAt(colliders, x, z, 60) ?? 0;
  const pkg = new CarePackage({ id, x, z, groundY: gy, reward, owned, ownerTeam });
  streakEntities.set(id, pkg);
  pkg.addTo(scene);
  streakIconTexture(String(reward).split(":")[1]).then((tex) => tex && pkg.setIcon(tex));
  audio.wave();   // the heli's on its way
  return pkg;
}

/* A streak's line-art icon as a sprite texture, for the crate's floating
   "what's inside". Cached per streak. */
const iconTextures = new Map();
function streakIconTexture(id) {
  if (!STREAK_DEFS[id]) return Promise.resolve(null);
  if (!iconTextures.has(id)) {
    iconTextures.set(id, new Promise((resolve) => {
      const svg = streakIconSvg(id)
        .replace('fill="currentColor"', 'fill="#9dff7a"')
        .replace('stroke="currentColor"', 'stroke="#9dff7a"')
        .replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" ');
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = c.height = 128;
        const g = c.getContext("2d");
        g.fillStyle = "rgba(10,24,12,.72)";
        g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "#9dff7a"; g.lineWidth = 4; g.stroke();
        g.drawImage(img, 22, 22, 84, 84);
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        resolve(tex);
      };
      img.onerror = () => resolve(null);
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    }));
  }
  return iconTextures.get(id);
}

/* How long a package takes to capture: its owner grabs it quickly, a
   teammate a little slower, and an enemy has to stand there and steal it. */
function packageCaptureTime(pkg) {
  if (pkg.owned && !pkg.botId) return 0.8;   // a bot's crate we host is still the bot's
  if (!currentMode().ffa && net.team && pkg.ownerTeam === net.team) return 1.6;
  return 3.5;
}

/* The drone leaves the hand: pick its target now (not at the call, the
   room may have moved) and send it. */
function launchPendingDrone() {
  const p = pendingDroneLaunch;
  pendingDroneLaunch = null;
  if (!p || !player.alive) return;
  const victim = pickDroneTarget(move.pos);
  const from = handLaunchPoint();
  spawnDrone({ id: p.eid, targetId: victim?.netId || null, owned: true, pos: from, yaw: look.yaw });
  if (net.active) {
    net.publishStreak({
      kind: "drone", action: "launch", eid: p.eid, target: victim?.netId || null,
      x: round2(from.x), y: round2(from.y), z: round2(from.z), yaw: round2(look.yaw),
    });
  }
  showWaveBanner(victim ? `HUNTER-KILLER — LOCKED ON ${String(victim.peer?.name || "TARGET").toUpperCase()}` : "HUNTER-KILLER — SEARCHING", 1800);
  audio.throwGear();
}

function spawnDrone({ id, targetId, owned, pos, yaw = 0, sky = false, credit = "drone" }) {
  const drone = new HunterDrone({ id, owned, targetId, pos, yaw, sky, credit });
  attachAirHitbox(drone, 0.7, AIR_HP.drone);
  streakEntities.set(id, drone);
  scene.add(drone.root);
  if (!sky) audio.wave();   // a Swarm is two dozen of them
  return drone;
}

/* Just in front of the streak tablet, in world space. */
function handLaunchPoint() {
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
  const p = camera.position.clone().addScaledVector(fwd, 0.7).addScaledVector(right, 0.25);
  p.y -= 0.3;
  // Never inside a wall you're hugging.
  const toP = p.clone().sub(camera.position);
  const len = toP.length();
  if (raycastWorld(colliders, camera.position, toP.divideScalar(len), len) < len) {
    p.copy(camera.position);
    p.y -= 0.2;
  }
  return p;
}

/* The world-probing hooks a drone steers by (see HunterDrone.update). */
const droneWorld = {
  target: null,
  probe: (from, dir, len) => raycastWorld(colliders, from, dir, len),
  sweep: (from, dir, len) => sweepWorld(from, dir, len),
  groundAt: (x, z, fromY) => groundHeightAt(colliders, x, z, fromY),
  route: (p, target, out) => droneRoute(p, target, out),
};

/* Ray against the colliders (all axis-aligned boxes) that also says which
   face it met, so a flier can slide along it. `inside` = the ray starts
   within a box; its normal is then the nearest way out. */
const _sweepHit = { t: 0, normal: new THREE.Vector3(), inside: false };
function sweepWorld(from, dir, len) {
  let bestT = Infinity, bestAxis = -1, bestSign = 0, inside = false;
  const o = [from.x, from.y, from.z], d = [dir.x, dir.y, dir.z];
  for (const c of colliders) {
    const lo = [c.min.x, c.min.y, c.min.z], hi = [c.max.x, c.max.y, c.max.z];
    let tmin = -Infinity, tmax = Infinity, axis = -1, sign = 0, miss = false;
    for (let a = 0; a < 3; a++) {
      if (Math.abs(d[a]) < 1e-9) {
        if (o[a] < lo[a] || o[a] > hi[a]) { miss = true; break; }
        continue;
      }
      let t1 = (lo[a] - o[a]) / d[a], t2 = (hi[a] - o[a]) / d[a], s = -1;
      if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
      if (t1 > tmin) { tmin = t1; axis = a; sign = s; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) { miss = true; break; }
    }
    if (miss || tmax < 0 || tmin > len) continue;
    if (tmin < 0) {
      // Starting inside: the way out is the nearest face.
      let pen = Infinity;
      for (let a = 0; a < 3; a++) {
        if (o[a] - lo[a] < pen) { pen = o[a] - lo[a]; axis = a; sign = -1; }
        if (hi[a] - o[a] < pen) { pen = hi[a] - o[a]; axis = a; sign = 1; }
      }
      bestT = 0; bestAxis = axis; bestSign = sign; inside = true;
      break;
    }
    if (tmin < bestT) { bestT = tmin; bestAxis = axis; bestSign = sign; }
  }
  if (bestAxis < 0) return null;
  _sweepHit.t = bestT;
  _sweepHit.inside = inside;
  _sweepHit.normal.set(0, 0, 0).setComponent(bestAxis, bestSign);
  return _sweepHit;
}

/* A drone that can't see its target flies the way round, at chest height,
   using the same flow field the bots walk (nav.js), one per floor height
   and rebuilt per map. Returns null when it can see it (go straight in) or
   there's no route (fall back to climbing over). */
const droneFields = new Map();
const _routeChest = new THREE.Vector3();
const _routeDir = new THREE.Vector3();
function droneRoute(p, target, out) {
  _routeChest.set(target.x, target.y + 1.1, target.z);
  const d = _routeChest.distanceTo(p);
  if (d < 0.01) return null;
  _routeDir.copy(_routeChest).sub(p).divideScalar(d);
  if (raycastWorld(colliders, p, _routeDir, d) >= d - 0.3) return null;
  const floorY = Math.round(target.y * 2) / 2;
  let field = droneFields.get(floorY);
  if (!field) {
    field = new FlowField(colliders, builtMap?.map?.bounds || ARENA, floorY);
    droneFields.set(floorY, field);
  }
  if (!field.compute(target.x, target.z)) return null;
  const s = field.steer(p.x, p.z, out);
  if (!s) return null;
  s.y = Math.max(-0.8, Math.min(0.8, (floorY + 1.6 - p.y) * 0.5));
  return s.normalize();
}

/* Where a drone's target is standing (feet), on this client. The target can
   be us: on the victim's screen the drone is coming for the local player,
   who isn't in remotes. */
function droneTargetPos(targetId) {
  if (!targetId) return null;
  if (targetId === net.id) return player.alive ? move.pos : null;
  const rp = remotes.byId.get(targetId);
  return rp && rp.alive ? rp.pos : null;
}

/* Hunter-killer target pick: nearest enemy, but one it can actually see
   beats a closer one behind a wall (scored as if 25 m further away). */
/* `team` / `botId`: whose drone (default ours). A bot's can pick us. */
function pickDroneTarget(from, eyeUp = 1.6, { team = net.team, botId = null } = {}) {
  let best = null, bestScore = Infinity;
  const ffa = currentMode().ffa;
  const eye = new THREE.Vector3(from.x, from.y + eyeUp, from.z);
  const dir = new THREE.Vector3();
  const consider = (pos, who) => {
    const d = from.distanceTo(pos);
    dir.set(pos.x - eye.x, pos.y + 1.2 - eye.y, pos.z - eye.z);
    const len = dir.length() || 1;
    dir.divideScalar(len);
    const seen = raycastWorld(colliders, eye, dir, len) >= len - 0.3;
    const score = d + (seen ? 0 : 25);
    if (score < bestScore) { bestScore = score; best = who; }
  };
  for (const rp of remotes.byId.values()) {
    if (!rp.alive || rp.netId === botId) continue;
    if (!ffa && team && rp.team === team) continue;
    consider(rp.pos, rp);
  }
  if (streakOwnerHates(team, botId)) consider(move.pos, { netId: net.id, pos: move.pos, peer: { name: "you" } });
  return best;
}

/* Mark order -> seconds to that pass's first impact. */
function strikeDelay(i) { return AIRSTRIKE_DELAY - 1 + i * 1.7; }

/* The Lightning Strike tablet (streak-tablet.js), made on first use. */
let strikeTablet = null;
function openStrikeTablet() {
  if (!strikeTablet) {
    strikeTablet = new StrikeTablet({ host: els.streakMark?.parentElement || document.body, renderer, scene });
  }
  const bounds = builtMap?.map?.bounds || ARENA;
  const keyHint = isTouch ? "Tap the map to mark" : gamepadState.connected
    ? "Stick aims · A marks · B undoes" : "Mouse aims · Click marks · Right-click undoes · Esc cancels";
  strikeTablet.open({
    bounds,
    radius: AIRSTRIKE_RADIUS * 0.75,
    me: { x: move.pos.x, z: move.pos.z, yaw: look.yaw },
    hint: keyHint,
    blips: () => {
      const out = [];
      const ffa = currentMode().ffa;
      for (const rp of remotes.byId.values()) {
        if (!rp.alive) continue;
        const friendly = !ffa && !!net.team && rp.team === net.team;
        if (friendly || enemiesRevealed()) out.push({ x: rp.pos.x, z: rp.pos.z, friendly });
      }
      return out;
    },
    onPlace: (n) => {
      audio.reload();
      if (n >= STRIKE_TARGETS) showWaveBanner("STRIKE CONFIRMED", 1200);
    },
    onConfirm: (pts) => {
      if (markingStreak !== "airstrike" || !player.alive) return;
      if (!streaks.spend("airstrike")) { cancelMark(); return; }
      markingStreak = null;
      beginStreakHold(0.2);
      fireStreak("airstrike", pts);
      selectedStreak = readyStreaksOrdered()[0] || null;
      updateStreakHud();
    },
    onCancel: () => { if (markingStreak === "airstrike") cancelMark(); },
  });
}

function spawnAirstrike({ x, z, yaw, owned, team, delay = AIRSTRIKE_DELAY }) {
  const run = new AirstrikeRun({
    x, z, yaw, delay, owned, team,
    groundAt: (px, pz) => groundHeightAt(colliders, px, pz, 60) ?? 0,
  });
  run.addTo(scene);
  pendingStrikes.push(run);
  return run;
}

/* Bullets can bring aircraft down (user: bots should shoot aircraft with
   their guns; so can people). An invisible hit volume on the airframe
   (game.js resolveStreakKit reads userData.air) and a health pool; the
   owner applies hits (damageStreakEntity), recon planes on every client. */
const AIR_HP = { drone: 60, heli: 600, recon: 450 };
const _airHitMat = new THREE.MeshBasicMaterial({ visible: false });
function attachAirHitbox(e, radius, hp) {
  e.hp = hp;
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), _airHitMat);
  m.userData.air = e;
  e.root.add(m);
  e.hitbox = m;
}

function spawnHelicopter({ id, seed, owned, team }) {
  const bounds = builtMap?.map?.bounds || { minX: ARENA.minX, maxX: ARENA.maxX, minZ: ARENA.minZ, maxZ: ARENA.maxZ };
  const heli = new HelicopterGunship({
    id, owned, bounds, seed, team, lights: lightPool, duration: STREAK_DEFS.helicopter.duration,
  });
  attachAirHitbox(heli, 3.2, AIR_HP.heli);
  streakEntities.set(id, heli);
  scene.add(heli.root);
  audio.wave();
  return heli;
}

/* ---------------- K9 Unit, VTOL Warship, Swarm (BO2's top tier) ---------------- */

function streakBounds() {
  return builtMap?.map?.bounds || { minX: ARENA.minX, maxX: ARENA.maxX, minZ: ARENA.minZ, maxZ: ARENA.maxZ };
}

function spawnK9({ id, owned, team, ownerId, x, y, z, yaw = 0 }) {
  const pack = new K9Pack({
    id, owned, team, ownerId, origin: new THREE.Vector3(x, y, z), yaw,
    duration: STREAK_DEFS.k9.duration, world: { colliders, bounds: streakBounds() },
  });
  streakEntities.set(id, pack);
  scene.add(pack.root);
  audio.wave();
  return pack;
}

/* A pack that's hostile to us: shootable, and on our radar as a threat. */
function k9Hostile(pack) {
  if (pack.owned && !pack.botId) return false;   // ours (a bot's pack we host can be the enemy's)
  if (pack.botId && !currentMode().ffa && pack.team === net.team) return false;
  return !!currentMode().ffa || !net.team || pack.team !== net.team;
}

/* Who a pack may go for: its owner's enemies (bots and peers both live in
   remotes). The owner is never on the list. */
function k9Hostiles(pack) {
  const ffa = currentMode().ffa;
  const out = [];
  for (const rp of remotes.byId.values()) {
    if (!rp.alive || rp.netId === pack.ownerId) continue;
    if (!ffa && pack.team && rp.team === pack.team) continue;
    out.push({ id: rp.netId, pos: rp.pos, alive: true });
  }
  if (streakOwnerHates(pack.team, pack.botId)) out.push({ id: net.id, pos: move.pos, alive: true });
  return out;
}

function updateK9(id, pack, dt) {
  if (!pack.owned) {
    if (pack.updateCopy(dt) === "expire") { pack.dispose(); streakEntities.delete(id); }
    return;
  }
  const ownerBot = pack.botId ? bots.byId(pack.botId) : null;
  const out = pack.updateOwned(dt, {
    hostiles: () => k9Hostiles(pack),
    ownerPos: ownerBot ? (ownerBot.alive ? ownerBot.pos : null) : player.alive ? move.pos : null,
    onBite: (dog, targetId, dmg) => {
      streakDamage(pack.botId, targetId, dmg, "k9");
      audio.bark?.(dog.pos);
    },
  });
  if (net.active && pack.snapT <= 0) {
    pack.snapT = 1 / K9.snapHz;
    net.publishStreak({ kind: "k9", action: "pos", eid: id, team: pack.team, d: pack.snapshot() });
  }
  if (out === "expire") {
    if (net.active) net.publishStreak({ kind: "k9", action: "end", eid: id });
    if (!pack.botId) showWaveBanner("K9 UNIT CALLED OFF", 1400);
    pack.dispose();
    streakEntities.delete(id);
  }
}

/* A dog taking damage from us, one of our bots, or a hit off the wire. Only
   the pack's owner applies it; anyone else forwards it. True if it died. */
function damageDog(pack, i, dmg, byId) {
  if (!pack.dogs[i]?.alive) return false;
  if (!pack.owned) {
    if (net.active) net.publishStreak({ kind: "k9", action: "hit", eid: pack.id, i, dmg: Math.round(dmg), by: byId });
    return false;
  }
  if (!pack.damage(i, dmg)) return false;
  audio.bark?.(pack.dogs[i].pos, true);
  if (net.active) net.publishStreak({ kind: "k9", action: "die", eid: pack.id, i, by: byId });
  return true;
}

function dogKilledBy(byId) {
  if (byId !== net.id) return;
  awardScore(SCORE.dogKill);
  pushKillfeed(`K9 down  +${SCORE.dogKill}`);
  audio.kill();
}

/* ---------------- Dragonfire + SAM Turret (BO2) ----------------
   dragonfire.js / sam-turret.js own the models and flight; this is the
   piloting, the guns' damage, the SAM's targeting and the shoot-downs.
   Authority follows the rest of the streaks: the owner's client decides
   (its gun's hits, its SAM's locks and kills, its Dragonfire's health),
   everyone else draws a copy from the wire. */
let dragonfire = null;          // our own while we fly it
const DF_BOARD_AT = 1.2;        // the tablet dive, then you're flying
let dfViewOn = false, dfSaved = null, dfHud = null, dfSendT = 0;
let dfIx = 0, dfIz = 0;         // this frame's stick, taken before the body freezes
const samHitCount = new Map();  // air eid -> SAM missiles it has taken (owner side)

function dragonfireView() {
  return !!dragonfire && dragonfire.alive && player.alive && dragonfire.age >= DF_BOARD_AT;
}

function spawnDragonfire({ id, owned, team, x, y, z, yaw, botId = null }) {
  const df = new Dragonfire({ id, owned, team, x, y, z, yaw, duration: STREAK_DEFS.dragonfire.duration, botId });
  streakEntities.set(id, df);
  scene.add(df.root);
  audio.wave();
  return df;
}

function spawnSam({ id, owned, team, x, y, z, yaw, botId = null }) {
  const sam = new SamTurret({ id, owned, team, x, y, z, yaw, duration: STREAK_DEFS.samturret.duration, botId });
  streakEntities.set(id, sam);
  scene.add(sam.root);
  audio.land?.(6);
  return sam;
}

/* Where a SAM goes down: a couple of metres ahead, pulled back off a wall,
   on the floor there. */
function samDeployPoint(from, yaw) {
  const dir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const eye = new THREE.Vector3(from.x, from.y + 1, from.z);
  const d = Math.max(0.6, Math.min(2.2, raycastWorld(colliders, eye, dir, 2.2) - 0.6));
  const x = from.x + dir.x * d, z = from.z + dir.z * d;
  const y = groundHeightAt(colliders, x, z, from.y + 1.5) ?? from.y;
  return { x, y, z, yaw };
}

/* Streak kit that's hostile to us (shootable, and a SAM target). */
function streakHostileToMe(e) {
  if (e.owned && !e.botId) return false;
  const ffa = !!currentMode().ffa;
  if (ffa || !net.team) return true;
  return (e.botTeam || e.team) !== net.team;
}

/* Aircraft a SAM on `team` (owned by `botId`, or us) should shoot at:
   { id, pos, need } where `need` is how many missiles bring it down. */
const _airPos = new THREE.Vector3();
/* Enemy aircraft for a side: { id, pos, need, e } where `need` is how many
   SAM missiles bring it down and `e` the entity (or recon plane). `team` is
   the side looking; `owner` whose kit to leave alone in FFA (net.id for
   us, a bot's id). Used by SAM Turrets, bots' guns and our own bullets. */
function enemyAirFor(team, owner) {
  const ffa = !!currentMode().ffa;
  const ownerOf = (e) => (e.botId || (e.owned ? net.id : e.ownerId || null));
  const hostile = (t, e) => ffa ? ownerOf(e) !== owner : !!t && t !== team;
  const out = [];
  for (const e of streakEntities.values()) {
    if (e.dead) continue;
    if (e instanceof Dragonfire) {
      if (e.alive && e.launched && hostile(e.botTeam || e.team, e)) out.push({ id: e.id, pos: e.pos, need: 1, e });
    } else if (e instanceof HelicopterGunship) {
      if (e.onStation && hostile(e.botTeam || e.team, e)) out.push({ id: e.id, pos: e.root.position, need: 2, e });
    } else if (e instanceof VtolWarship) {
      if (e.onStation && hostile(e.team, e)) out.push({ id: e.id, pos: e.root.position, need: 3, e });
    } else if (e instanceof HunterDrone) {
      // Its side is its hunter's: hunting us or ours = it's the enemy's.
      let t = e.botTeam || null;
      if (!t && !e.owned) {
        const tp = e.targetId === net.id ? net.team : net.peers.get(e.targetId)?.team;
        t = tp && !ffa ? (tp === "phantom" ? "ghost" : "phantom") : null;
      } else if (!t && e.owned) t = net.team;
      if (e.root.position.y > 3 && hostile(t, e)) out.push({ id: e.id, pos: e.root.position, need: 1, e });
    }
  }
  for (const f of flyovers) {
    if (!f.eid || f.done || f.dead || f.age < 3 || f.age > f.duration) continue;
    if (ffa ? f.caller !== owner : hostile(f.team, f)) out.push({ id: f.eid, pos: f.root.position, need: 1, e: f });
  }
  return out;
}

function samTargets(sam) {
  const team = sam.botId ? sam.botTeam || sam.team : sam.team;
  return enemyAirFor(team, sam.botId || (sam.owned ? net.id : null)).filter((t) => t.e !== sam);
}

function airTargetPos(id) {
  const e = streakEntities.get(id);
  if (e && !e.dead) return e instanceof Dragonfire ? e.pos : e.root.position;
  const f = flyovers.find((p) => p.eid === id && !p.dead);
  return f ? f.root.position : null;
}

/* Owner: pick, slew, lock, fire pairs. */
function updateSamAi(sam, dt) {
  if (sam.age < 1.2 || !sam.alive) return;
  sam.reloadT = Math.max(0, sam.reloadT - dt);
  const list = samTargets(sam);
  const eye = _airPos.set(sam.pos.x, sam.pos.y + 1.3, sam.pos.z);
  const inbound = (id) => sam.missiles.filter((m) => m.targetId === id).length;
  const usable = (t) => {
    const d = t.pos.distanceTo(eye);
    if (d > SAM_RANGE) return false;
    if ((samHitCount.get(t.id) || 0) + inbound(t.id) >= t.need) return false;   // enough already on the way
    const dir = t.pos.clone().sub(eye).divideScalar(d);
    return raycastWorld(colliders, eye, dir, d) >= d - 2;
  };
  let tgt = sam.targetId ? list.find((t) => t.id === sam.targetId) : null;
  if (tgt && !usable(tgt) && sam.salvo <= 0) tgt = null;
  if (!tgt) {
    let best = Infinity;
    for (const t of list) {
      if (!usable(t)) continue;
      const d = t.pos.distanceTo(eye);
      if (d < best) { best = d; tgt = t; }
    }
    if (tgt?.id !== sam.targetId) sam.lockT = 0;
  }
  sam.targetId = tgt ? tgt.id : null;
  if (!tgt) return;
  const off = sam.aimAt(tgt.pos, dt);
  sam.lockT = off < 0.12 ? sam.lockT + dt : Math.max(0, sam.lockT - dt);
  if (sam.salvo <= 0 && sam.reloadT <= 0 && sam.lockT >= SAM_LOCK) { sam.salvo = Math.min(2, tgt.need); sam.salvoT = 0; }
  if (sam.salvo > 0) {
    sam.salvoT -= dt;
    if (sam.salvoT <= 0) {
      const ms = sam.launch(tgt.id);
      sam.salvo--;
      sam.salvoT = SAM_SALVO_GAP;
      if (sam.salvo <= 0) sam.reloadT = SAM_RELOAD;
      audio.explosion?.(0.12, ms.pos);
      if (net.active) {
        net.publishStreak({ kind: "sam", action: "launch", eid: sam.id, t: tgt.id,
          x: round2(ms.pos.x), y: round2(ms.pos.y), z: round2(ms.pos.z), dx: round2(ms.dir.x), dy: round2(ms.dir.y), dz: round2(ms.dir.z) });
      }
    }
  }
}

/* A SAM missile reaching its target, on the SAM owner's client. */
function samMissileHit(sam, targetId) {
  const n = (samHitCount.get(targetId) || 0) + 1;
  samHitCount.set(targetId, n);
  const t = samTargets(sam).find((x) => x.id === targetId);
  const need = t ? t.need : 1;
  if (n >= need) shootDownAir(targetId, sam.botId || net.id, true);
}

/* Bullets (or a Dragonfire's gun) on streak kit: its owner applies it. */
function damageStreakEntity(e, dmg, byId, fromWire = false) {
  if (e instanceof ReconPlane) {
    // No owner copy to defer to: every client counts the same hits.
    e.hp -= dmg;
    if (!fromWire && net.active) net.publishStreak({ kind: "air", action: "hit", eid: e.eid, dmg: Math.round(dmg), by: byId });
    if (e.hp <= 0) shootDownAir(e.eid, byId, false);
    return;
  }
  if (e.owned) {
    e.hp -= dmg;
    if (e.hp <= 0) shootDownAir(e.id, byId, true);
  } else if (net.active) {
    net.publishStreak({ kind: "air", action: "hit", eid: e.id, dmg: Math.round(dmg), by: byId });
  }
}

/* Destroyed: a Dragonfire or SAM shot apart, or an aircraft a SAM hit.
   `announce`: this client decided it, so tell the room. */
function shootDownAir(eid, byId, announce = false) {
  const e = streakEntities.get(eid);
  const plane = !e && flyovers.find((f) => f.eid === eid);
  if (!e && !plane) return;
  if (announce && net.active) net.publishStreak({ kind: "air", action: "down", eid, by: byId || null });
  const at = (e ? (e instanceof Dragonfire ? e.pos : e instanceof SamTurret ? e.pos.clone().setY(e.pos.y + 1) : e.root.position) : plane.root.position).clone();
  explosionFx({ kind: "lethal", glow: 0xffa23a, radius: 4 }, at);
  streakBlast(at, e instanceof HunterDrone || e instanceof Dragonfire ? 0.7 : 1.2);
  audio.explosion?.(0.5, at);
  const mine = e ? (e.owned && !e.botId) : plane.team === uavBucket() && !currentMode().ffa;
  if (e) {
    if (e === warship) warship = null;
    if (e === dragonfire) { dragonfire = null; showWaveBanner("DRAGONFIRE DESTROYED", 1600); }
    if (e instanceof HelicopterGunship && mine) showWaveBanner("GUNSHIP SHOT DOWN", 1600);
    if (e instanceof VtolWarship && mine) showWaveBanner("WARSHIP SHOT DOWN", 1600);
    if (e instanceof SamTurret && mine) showWaveBanner("SAM TURRET DESTROYED", 1600);
    e.dispose();
    streakEntities.delete(eid);
  } else {
    if (!plane.counter) {
      if (plane.team) uavUntil[plane.team] = 0;
      if (plane.team === uavBucket() && myUavUntil > performance.now()) myUavUntil = 0;
      if (mine) showWaveBanner("UAV SHOT DOWN", 1600);
    } else if (currentMode().ffa || !net.team || plane.team !== net.team) {
      jammedUntil = 0;   // their jammer's down: our radar's back
      showWaveBanner("ENEMY COUNTER-UAV DOWN", 1500);
    }
    plane.dispose();
    flyovers.splice(flyovers.indexOf(plane), 1);
  }
  samHitCount.delete(eid);
  const botShooter = byId && bots.byId(byId);
  if (botShooter) botEarn(botShooter, SCORE.airKill);
  if (byId && byId === net.id && !mine) {
    awardScore(SCORE.airKill);
    addMatchXp(XP.kill, "AIRCRAFT DOWN");
    pushKillfeed(`Aircraft down  +${SCORE.airKill}`);
  }
}

/* Owner: our Dragonfire's gun. Hitscan from the nose camera along the
   crosshair; people, dogs and enemy streak kit all take it. */
const _dfRay = new THREE.Raycaster();
const DF_ASSIST_CONE_DEG = 10;   // the pull's search cone (the gun's is 7)
const DF_ASSIST_PULL = 0.7;      // share of the gun's full pull, every frame while flying
const DF_MAGNET_DEG = 3;         // rounds bend onto a target this close to the reticle
function fireDragonfire() {
  const df = dragonfire;
  if (!df || !df.tryFire()) return;
  const dir = camera.getWorldDirection(new THREE.Vector3());
  // Magnetism: someone within a few degrees of the reticle (in sight, in
  // range) draws the round onto their chest before the spread goes on.
  const mag = settings.aimAssist ? findAimAssistTarget(DF_MAGNET_DEG, DF_RANGE) : null;
  if (mag) dir.set(mag.aim.x - camera.position.x, mag.aim.y - camera.position.y, mag.aim.z - camera.position.z).normalize();
  dir.x += (Math.random() - 0.5) * DF_SPREAD * 2;
  dir.y += (Math.random() - 0.5) * DF_SPREAD * 2;
  dir.z += (Math.random() - 0.5) * DF_SPREAD * 2;
  dir.normalize();
  const from = camera.position.clone();
  const wall = raycastWorld(colliders, from, dir, DF_RANGE);
  _dfRay.set(from, dir);
  _dfRay.near = 0.3;
  _dfRay.far = wall;
  let to = from.clone().addScaledVector(dir, wall);
  const meshes = targetMeshes.filter((m) => !m.userData?.air || m.userData.air !== df);
  const hits = meshes.length ? _dfRay.intersectObjects(meshes, true) : [];
  let hitActor = false;
  for (const h of hits) {
    const actor = resolveBulletTarget(h.object);
    if (!actor) continue;
    to = h.point.clone();
    onBulletActorHit(actor, { damage: DF_DAMAGE, isHead: false, point: h.point, dir, creditAs: "dragonfire", distance: h.distance });
    hitActor = true;
    break;
  }
  if (!hitActor && wall < DF_RANGE) impactFx.hit(to, { normal: dir.clone().negate(), dir, surface: "ground", scale: 1 });
  df.shoot(to);
  audio.shot(WEAPON_DEFS.bellow || WEAPON_DEFS.problem416, 0.4);
  shakeMag = Math.max(shakeMag, 0.004); shakeT = 0.06;
  if (net.active) net.publishStreak({ kind: "dragonfire", action: "shot", eid: df.id, x: round2(to.x), y: round2(to.y), z: round2(to.z) });
}

/* The pilot's feed: a timer, the drone's health, a reticle. */
function dragonfireHudEl() {
  if (dfHud) return dfHud;
  dfHud = document.createElement("div");
  dfHud.className = "to-df";
  dfHud.hidden = true;
  dfHud.setAttribute("aria-hidden", "true");
  dfHud.innerHTML = `<div class="to-df-scan"></div><div class="to-df-frame"><i></i><i></i><i></i><i></i></div>
<div class="to-df-reticle"><b></b></div>
<div class="to-df-top"><strong>DRAGONFIRE</strong><span class="to-df-time"></span></div>
<div class="to-df-hp"><span>HULL</span><div><i></i></div></div>
<div class="to-df-heat"><span>GUN</span><div><i></i></div><em>OVERHEATED</em></div>
<div class="to-df-alt"></div>
<div class="to-df-keys"></div>`;
  (els.streakMark?.parentElement || document.body).appendChild(dfHud);
  return dfHud;
}

function syncDragonfireView() {
  // Killed on the ground: the link's cut and the drone drops.
  if (dragonfire && !player.alive && dragonfire.alive) {
    dragonfire.hp = 0;
    shootDownAir(dragonfire.id, null, true);
  }
  const on = dragonfireView();
  if (on !== dfViewOn) {
    dfViewOn = on;
    const el = dragonfireHudEl();
    el.hidden = !on;
    document.body.classList.toggle("to-in-dragonfire", on);
    if (on) {
      dfSaved = { yaw: look.yaw, pitch: look.pitch };
      look.pitch = -0.1;
      // How to climb and dive, in whatever the player is holding (user:
      // couldn't find how to go up or down).
      el.querySelector(".to-df-keys").textContent = gamepadState.connected ? "A climb · B dive · R2 fire"
        : isTouch ? "▲ climb · ▼ dive · or look and fly" : "SPACE climb · C dive · or look and fly";
      showWaveBanner("DRAGONFIRE — YOU HAVE CONTROL", 1500);
    } else {
      if (dfSaved) { look.yaw = dfSaved.yaw; look.pitch = dfSaved.pitch; }
      dfSaved = null;
      if (player.alive && dragonfire && !dragonfire.alive) showWaveBanner("DRAGONFIRE OFFLINE", 1200);
    }
  }
  if (!on) return;
  const df = dragonfire;
  dfHud.querySelector(".to-df-time").textContent = `${Math.max(0, Math.ceil(df.duration - df.age))}s`;
  dfHud.querySelector(".to-df-hp i").style.width = `${Math.round(Math.max(0, df.hp / DF_HP) * 100)}%`;
  dfHud.querySelector(".to-df-heat i").style.width = `${Math.round(df.heat * 100)}%`;
  dfHud.classList.toggle("is-hot", df.heat > 0.7);
  if (df.overheated && !dfHud.classList.contains("is-overheated")) audio.reload();   // the clack of a locked gun
  dfHud.classList.toggle("is-overheated", df.overheated);
  const floor = groundHeightAt(colliders, df.pos.x, df.pos.z, df.pos.y) ?? 0;
  dfHud.querySelector(".to-df-alt").textContent = `ALT ${Math.max(0, df.pos.y - floor).toFixed(1)}m`;
  dfHud.classList.toggle("is-low", df.duration - df.age < 10 || df.hp < DF_HP * 0.35);
}

/* The VTOL Warship. `warship` is our own while we ride its guns. */
let warship = null;
let warshipGun = "chain";
let wsViewOn = false, wsSaved = null, wsStable = false, wsHud = null;
const WARSHIP_BOARD_AT = 1.3;   // the tablet call, then you're in the gunner's seat

function warshipView() {
  return !!warship && !warship.dead && player.alive && warship.age >= WARSHIP_BOARD_AT && warship.age < warship.duration;
}
/* Look sensitivity on the warship's gun (user: needs to be low): a third of
   your normal aim, and lower still the more the gun zooms in. Mouse, stick
   and touch alike. */
const WARSHIP_SENS = 0.35;
function lookSensScale() {
  if (!warshipView()) return 1;
  return WARSHIP_SENS * Math.min(1, (WARSHIP_GUNS[warshipGun]?.fov || baseFov) / baseFov);
}

function spawnWarship({ id, seed, owned, team }) {
  const ws = new VtolWarship({ id, owned, bounds: streakBounds(), seed, team, duration: STREAK_DEFS.warship.duration });
  streakEntities.set(id, ws);
  scene.add(ws.root);
  audio.wave();
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
      if (warshipView() && s.dataset.g !== warshipGun) toggleWarshipGun();
    });
  }
  (els.streakMark?.parentElement || document.body).appendChild(wsHud);
  return wsHud;
}

function syncWarshipView() {
  // Killed on the ground: the ride is over, and the warship heads home.
  if (warship && !player.alive && warship.age < warship.duration) {
    warship.duration = Math.max(WARSHIP_BOARD_AT, warship.age);
    if (net.active) net.publishStreak({ kind: "warship", action: "leave", eid: warship.id });
  }
  const on = warshipView();
  if (on === wsViewOn) return;
  wsViewOn = on;
  const el = warshipHudEl();
  el.hidden = !on;
  renderer.domElement.style.filter = on ? "grayscale(1) contrast(1.5) brightness(1.12)" : "";
  document.body.classList.toggle("to-in-warship", on);
  if (on) {
    wsSaved = { yaw: look.yaw, pitch: look.pitch };
    wsStable = false;
    // Start looking at the middle of the map.
    const at = warship.gunnerPos(new THREE.Vector3());
    const dx = warship.centre.x - at.x, dz = warship.centre.z - at.z;
    look.yaw = Math.atan2(-dx, -dz);
    look.pitch = Math.atan2(-at.y, Math.hypot(dx, dz));
    el.querySelector(".to-ws-hint").textContent = isTouch ? "SWAP to change gun" : gamepadState.connected ? "Y changes gun" : "1 / 2 or scroll changes gun";
    showWaveBanner("VTOL WARSHIP — YOU HAVE THE GUNS", 1600);
  } else {
    if (wsSaved) { look.yaw = wsSaved.yaw; look.pitch = wsSaved.pitch; }
    wsSaved = null;
    if (player.alive && warship) showWaveBanner("WARSHIP LEAVING", 1200);
  }
}

const _wsDir = new THREE.Vector3();
const _wsP = new THREE.Vector3();
/* The gunner's camera: rides the gun deck, and holds the ground point under
   the crosshair still while the ship circles (a stabilised gimbal), so
   aiming is about the target, not about fighting the orbit. */
function placeWarshipCamera() {
  _euler.set(look.pitch, look.yaw, 0);
  _wsDir.set(0, 0, -1).applyEuler(_euler);
  let held = false;
  if (wsStable && _wsDir.y < -0.02) {
    const t = (0 - camera.position.y) / _wsDir.y;
    _wsP.copy(camera.position).addScaledVector(_wsDir, t);
    held = true;
  }
  warship.gunnerPos(camera.position);
  if (held) {
    const dx = _wsP.x - camera.position.x, dy = _wsP.y - camera.position.y, dz = _wsP.z - camera.position.z;
    look.yaw = Math.atan2(-dx, -dz);
    look.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  }
  look.pitch = Math.max(-1.52, Math.min(-0.1, look.pitch));
  wsStable = true;
  _euler.set(look.pitch, look.yaw, 0);
  camera.quaternion.setFromEuler(_euler);
}

function toggleWarshipGun() {
  warshipGun = warshipGun === "chain" ? "cannon" : "chain";
  audio.reload();
}

function fireWarship() {
  const ws = warship;
  const g = WARSHIP_GUNS[warshipGun];
  if (!ws.tryFire(warshipGun)) return;
  const dir = camera.getWorldDirection(new THREE.Vector3());
  if (g.spread) {
    dir.x += (Math.random() - 0.5) * g.spread * 2;
    dir.y += (Math.random() - 0.5) * g.spread * 2;
    dir.z += (Math.random() - 0.5) * g.spread * 2;
    dir.normalize();
  }
  const from = camera.position;
  let d = raycastWorld(colliders, from, dir, 480);
  if (dir.y < -1e-3) d = Math.min(d, (0 - from.y) / dir.y);
  const to = from.clone().addScaledVector(dir, d);
  ws.shoot(warshipGun, to);
  if (net.active) {
    net.publishStreak({ kind: "warship", action: "shot", eid: ws.id, g: warshipGun, x: round2(to.x), y: round2(to.y), z: round2(to.z) });
  }
  if (warshipGun === "cannon") {
    audio.explosion(0.35);
    shakeMag = Math.max(shakeMag, 0.035); shakeT = 0.25;
  } else {
    audio.shot(WEAPON_DEFS.bellow || WEAPON_DEFS.problem416, 0.45);
  }
}

/* A round landing. Everyone sees it; only the gunner's copy hurts anyone. */
function warshipImpact(ws, r) {
  const g = WARSHIP_GUNS[r.gun];
  if (r.gun === "cannon") {
    explosionFx({ kind: "lethal", glow: 0xffb347, radius: g.radius }, r.to);
    streakBlast(r.to, 1.1);
    impactFx.hit(r.to, { normal: new THREE.Vector3(0, 1, 0), surface: "ground", scale: 4 });
  } else {
    impactFx.hit(r.to, { normal: new THREE.Vector3(0, 1, 0), surface: "ground", scale: 1.8 });
    spawnImpactBurst(r.to, 0xffc46a, 6);
    if (Math.random() < 0.35) audio.impact(r.to);
  }
  if (ws.owned) {
    areaDamage(r.to, g.radius, g.damage,
      { id: "warship", radius: g.radius, minDamage: g.damage * 0.25, selfMult: 0 },
      { creditAs: "warship", botId: ws.botId || null });
  }
}

const _wsProj = new THREE.Vector3();
function updateWarshipHud() {
  if (!wsViewOn || !wsHud) return;
  const g = WARSHIP_GUNS[warshipGun];
  wsHud.querySelector(".to-ws-time").textContent = `${Math.max(0, Math.ceil(warship.duration - warship.age))}s`;
  for (const s of wsHud.querySelectorAll(".to-ws-guns span")) s.classList.toggle("is-on", s.dataset.g === warshipGun);
  const cool = warship.fireT / g.interval;
  wsHud.querySelector(".to-ws-reload i").style.width = `${Math.round((1 - Math.min(1, cool)) * 100)}%`;
  wsHud.classList.toggle("is-cannon", warshipGun === "cannon");
  // Boxes on everyone: red for the enemy, blue for your side, and you.
  const marks = wsHud.querySelector(".to-ws-marks");
  const host = wsHud.getBoundingClientRect();
  const ffa = !!currentMode().ffa;
  const list = [];
  for (const rp of remotes.byId.values()) {
    if (!rp.alive) continue;
    list.push({ pos: rp.pos, kind: !ffa && net.team && rp.team === net.team ? "friend" : "foe" });
  }
  for (const e of streakEntities.values()) {
    if (e instanceof K9Pack && k9Hostile(e)) for (const d of e.dogs) if (d?.alive) list.push({ pos: d.pos, kind: "foe dog" });
  }
  list.push({ pos: move.pos, kind: "you" });
  while (marks.children.length < list.length) marks.appendChild(document.createElement("i"));
  [...marks.children].forEach((m, i) => {
    const it = list[i];
    if (!it) { m.hidden = true; return; }
    _wsProj.set(it.pos.x, it.pos.y + 0.9, it.pos.z).project(camera);
    const vis = _wsProj.z < 1 && Math.abs(_wsProj.x) < 1.05 && Math.abs(_wsProj.y) < 1.05;
    m.hidden = !vis;
    if (!vis) return;
    m.className = `is-${it.kind.replace(" ", " is-")}`;
    m.style.transform = `translate(${((_wsProj.x + 1) / 2) * host.width}px, ${((1 - _wsProj.y) / 2) * host.height}px)`;
  });
}

/* The Swarm: Hunter-Killers diving in from the map's edge, one after
   another, each after its own enemy, until the count or the clock runs out. */
const swarmRuns = [];
const SWARM_MAX_ALIVE = 6;
let swarmSeq = 0;

function updateSwarms(dt) {
  const def = STREAK_DEFS.swarm;
  for (let i = swarmRuns.length - 1; i >= 0; i--) {
    const s = swarmRuns[i];
    s.t += dt;
    if (s.t > def.duration || s.sent >= def.count) { swarmRuns.splice(i, 1); continue; }
    if (s.t < s.next) continue;
    // Whose run: ours, or a bot's we host (`botId`, `team`).
    const team = s.botId ? s.team : net.team;
    let alive = 0;
    const onTarget = new Map();
    for (const e of streakEntities.values()) {
      if (!(e instanceof HunterDrone) || !e.owned || !e.sky || e.frozen || (e.botId || null) !== (s.botId || null)) continue;
      alive++;
      if (e.targetId) onTarget.set(e.targetId, (onTarget.get(e.targetId) || 0) + 1);
    }
    if (alive >= SWARM_MAX_ALIVE) continue;
    // Spread them out: whoever has the fewest drones on them already.
    const ffa = currentMode().ffa;
    let victim = null, best = Infinity;
    for (const rp of remotes.byId.values()) {
      if (!rp.alive || rp.netId === s.botId) continue;
      if (!ffa && team && rp.team === team) continue;
      const score = (onTarget.get(rp.netId) || 0) + Math.random() * 0.5;
      if (score < best) { best = score; victim = rp; }
    }
    if (streakOwnerHates(team, s.botId)) {
      const score = (onTarget.get(net.id) || 0) + Math.random() * 0.5;
      if (score < best) { best = score; victim = { netId: net.id, pos: move.pos }; }
    }
    if (!victim) { s.next = s.t + 0.5; continue; }
    s.next = s.t + def.duration / def.count;
    s.sent++;
    launchSwarmDrone(victim, s);
  }
}

function launchSwarmDrone(victim, run = null) {
  const b = streakBounds();
  const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  const r = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) * 0.5;
  // In over the edge on the victim's far side-ish, high above the rooftops.
  const a = Math.atan2(victim.pos.z - cz, victim.pos.x - cx) + Math.PI + (Math.random() - 0.5) * 2.2;
  const pos = new THREE.Vector3(cx + Math.cos(a) * r, 30 + Math.random() * 10, cz + Math.sin(a) * r);
  const yaw = Math.atan2(-(victim.pos.x - pos.x), -(victim.pos.z - pos.z));
  const id = `streak-swarm-${net.id}-${Math.round(performance.now())}-${++swarmSeq}`;
  const e = spawnDrone({ id, targetId: victim.netId, owned: true, pos, yaw, sky: true, credit: "swarm" });
  if (run?.botId) { e.botId = run.botId; e.botTeam = run.team; }
  if (net.active) {
    net.publishStreak({
      kind: "drone", action: "launch", eid: id, target: victim.netId, sky: 1, credit: "swarm",
      x: round2(pos.x), y: round2(pos.y), z: round2(pos.z), yaw: round2(yaw),
    });
  }
}

/* UAV's world presence: a spotter plane circling the map for the UAV's
   duration (ReconPlane). Purely decorative — enemiesRevealed()/uavUntil own
   the reveal; the heading just seeds where on the orbit it comes in. */
function spawnRecon(x, z, yaw, duration = STREAK_DEFS.uav.duration, { team = null, counter = false, caller = null } = {}) {
  const bounds = builtMap?.map?.bounds || ARENA;
  const plane = new ReconPlane({ bounds, yaw, duration, counter });
  plane.team = team;
  // The same id on every client (from the call's rounded x and yaw, which
  // is what the wire carries), so a SAM Turret can shoot one down for all.
  plane.eid = `recon:${counter ? 1 : 0}:${Math.round(yaw * 100)}:${Math.round(x * 100)}`;
  plane.caller = caller;
  attachAirHitbox(plane, 2.8, AIR_HP.recon);
  flyovers.push(plane);
  scene.add(plane.root);
  return plane;
}

/* Nearest living enemy, for the drone's target pick. Bots and peers both live
   in remotes, so one pass covers them. */
function nearestHostileTo(from) {
  let best = null, bestD = Infinity;
  const ffa = currentMode().ffa;
  for (const rp of remotes.byId.values()) {
    if (!rp.alive) continue;
    if (!ffa && net.team && rp.team === net.team) continue;
    const d = from.distanceTo(rp.pos);
    if (d < bestD) { bestD = d; best = rp; }
  }
  return best;
}

/* Open a landed package: apply the reward it was created with. */
function claimPackage(pkg) {
  pkg.claimed = true;
  const [kind, arg] = String(pkg.reward).split(":");

  if (kind === "ammo") {
    for (const w of Object.values(player.weapons)) {
      w.ammoReserve = w.def.reserveMax - w.def.magSize;
      w.ammoInMag = w.def.magSize;
    }
    player.gear.lethal = loadout.carried("lethal");
    player.gear.tactical = loadout.carried("tactical");
    showWaveBanner("RESUPPLIED", 1500);
  } else if (kind === "weapon") {
    const def = resolveWeapon(arg, defaultLoadoutFor(arg));
    if (def) {
      player.secondaryId = def.id;
      player.weapons[def.id] = new WeaponState(def);
      currentWeaponSlot = "secondary";
      setActiveWeaponMesh(def);
      setHolding("gun");
      showWaveBanner(`PACKAGE — ${def.name.toUpperCase()}`, 1600);
    }
  } else if (kind === "streak") {
    streaks.grant(arg);
    selectedStreak = arg;
    // Banked, never fired for you: it sits in its slot, pulsing, until you
    // call it. A short guard stops the same press (or a stray tap on the
    // slot that just appeared) from calling it on the spot.
    streakCallGuardUntil = performance.now() + 900;
    freshStreak = { id: arg, until: performance.now() + 5000 };
    setTimeout(updateStreakHud, 5100);   // the pulse ends
        updateStreakHud();
    showWaveBanner(`${STREAK_DEFS[arg]?.name.toUpperCase() || "STREAK"} READY — ${isTouch ? "TAP IT TO CALL" : `PRESS ${streakKeyLabel(arg).toUpperCase()}`}`, 2200);
  }

  audio.reload();
  if (net.active) net.publishStreak({ kind: "carepackage", action: "claimed", eid: pkg.id });
  // Pops open, then updateStreakEntities drops it on "gone".
  pkg.open();
  spawnImpactBurst(new THREE.Vector3(pkg.x, pkg.groundY + 0.8, pkg.z), 0x9dff7a, 16);
}

/* Someone else's Counter-UAV. From the enemy: our minimap scrambles, our
   side's UAV (and its plane) goes down, and if that UAV was ours we can't
   call another for the lockout. In free-for-all everyone else is the enemy. */
function applyCounterUav(m) {
  const def = STREAK_DEFS.counteruav;
  const dur = m.duration || def.duration;
  if (typeof m.x === "number" && typeof m.z === "number") {
    spawnRecon(m.x, m.z, m.yaw || 0, dur, { counter: true, team: m.team, caller: m.id || null });
  }
  const enemy = currentMode().ffa || !net.team || m.team !== net.team;
  if (!enemy) { showWaveBanner("FRIENDLY COUNTER-UAV", 1500); return; }
  const now = performance.now();
  jammedUntil = Math.max(jammedUntil, now + dur * 1000);
  const mine = uavBucket();
  uavUntil[mine] = 0;
  uavWasUp = false;   // our own banner below says why, not "UAV OFFLINE"
  for (const f of flyovers) if (f.team === mine && !f.counter) f.cutShort();
  if (myUavUntil > now) {
    myUavUntil = 0;
    const secs = m.lockout || def.lockout;
    lockStreak("uav", secs, "jammed");
    showWaveBanner(`UAV SHOT DOWN · NO UAV FOR ${secs}s`, 2200);
  } else {
    showWaveBanner("ENEMY COUNTER-UAV · RADAR JAMMED", 1800);
  }
}

function startUav(team, duration) {
  if (!team) return;
  const until = performance.now() + duration * 1000;
  // A second UAV extends rather than restarts, so stacking two isn't a
  // downgrade for whoever called the first.
  uavUntil[team] = Math.max(uavUntil[team] || 0, until);
}

/* Say when our radar drops, so losing it reads as the UAV expiring rather
   than the minimap breaking. */
let uavWasUp = false;
function updateUavState() {
  // Lockout countdowns tick on the HUD (the signature stops redundant rebuilds).
  if (Object.keys(streakLockUntil).length) updateStreakHud();
  const up = enemiesRevealed();
  if (uavWasUp && !up) showWaveBanner("UAV OFFLINE", 1200);
  uavWasUp = up;
}

/* Everything a live streak does per frame. Only the owner resolves damage and
   outcomes; a rendered copy just animates. */
function updateStreakEntities(dt) {
  updateMarking();

  for (const [id, e] of [...streakEntities]) {
    if (e instanceof MarkerCanister) {
      if (e.update(dt) === "rest" && e.owned) {
        // Settled: call the drop right here, for everyone.
        const p = e.pos;
        // One of our bots' (botId): its side owns the crate, and it comes for it.
        const team = e.botId ? e.botTeam : net.team;
        const pkg = spawnCarePackage({ id, x: p.x, z: p.z, groundY: e.floor, reward: e.reward, owned: true, ownerTeam: team });
        if (e.botId) pkg.botId = e.botId;
        if (net.active) {
          net.publishStreak({
            kind: "carepackage", action: "drop",
            eid: id, x: round2(p.x), z: round2(p.z), y: round2(e.floor), reward: e.reward, team,
          });
        }
        if (!e.botId) showWaveBanner("CARE PACKAGE INBOUND", 1800);
      } else if (!e.owned && e.age > 12) { e.dispose(); streakEntities.delete(id); }
      continue;
    }

    if (e instanceof CarePackage) {
      const out = e.update(dt);
      if (out === "landed") {
        // Slams into the dirt: dust, a thud, a shake up close — and anyone
        // under it is flattened (the caller decides; BO2 crates kill).
        const at = new THREE.Vector3(e.x, e.groundY + 0.05, e.z);
        impactFx.hit(at, { normal: new THREE.Vector3(0, 1, 0), dir: new THREE.Vector3(0, -1, 0), surface: "ground", scale: 5 });
        audio.explosion(0.4, at);
        const near = Math.max(0, 1 - at.distanceTo(player.pos) / 14);
        if (near > 0) { shakeMag = Math.max(shakeMag, near * 0.05); shakeT = 0.3; }
        if (e.owned) crushUnderPackage(e);
      }
      if (out === "gone" || e.expired) { e.dispose(); streakEntities.delete(id); }
      continue;
    }

    if (e instanceof HunterDrone) {
      updateDrone(id, e, dt);
      continue;
    }

    if (e instanceof K9Pack) {
      updateK9(id, e, dt);
      continue;
    }

    if (e instanceof Dragonfire) {
      if (e.owned && e.botId) {
        flyBotDragonfire(e, dt);
        if (e.dead) continue;
      } else if (e.owned && e === dragonfire && dragonfireView()) {
        const up = ((isTouch && touchState.jump) || (gamepadState.connected && gamepadState.jump) || keys.has("Space") ? 1 : 0)
          - ((isTouch && touchState.crouch) || (gamepadState.connected && gamepadState.crouch) || keys.has("KeyC") || keys.has("ControlLeft") ? 1 : 0);
        e.fly(dt, { fwd: dfIz, strafe: dfIx, up, yaw: look.yaw, pitch: look.pitch, followPitch: true },
          (from, dir, max) => raycastWorld(colliders, from, dir, max),
          (x, z, fromY) => groundHeightAt(colliders, x, z, fromY));
      } else if (e.owned && !e.launched) {
        e.fly(dt, { fwd: 0, strafe: 0, up: 0, yaw: e.yaw, pitch: e.pitch }, null, null);
      }
      if (e.owned && net.active && (dfSendT -= dt) <= 0) {
        dfSendT = 1 / 12;
        net.publishStreak({ kind: "dragonfire", action: "pos", eid: e.id, x: round2(e.pos.x), y: round2(e.pos.y), z: round2(e.pos.z), yaw: round2(e.yaw), p: round2(e.pitch) });
      }
      const out = e.update(dt);
      if (out === "expire") {
        if (e.owned && net.active && e.hp > 0) net.publishStreak({ kind: "dragonfire", action: "end", eid: e.id });
        if (e === dragonfire) dragonfire = null;
        const pilot = e.botId && bots.byId(e.botId);
        if (pilot && pilot.piloting === e.id) pilot.piloting = null;
        e.dispose();
        streakEntities.delete(id);
      }
      continue;
    }

    if (e instanceof SamTurret) {
      if (e.owned) updateSamAi(e, dt);
      const hits = e.updateMissiles(dt, airTargetPos);
      for (const h of hits) {
        explosionFx({ kind: "lethal", glow: 0xffc070, radius: 2.5 }, h.at);
        if (e.owned && h.targetId && airTargetPos(h.targetId)) samMissileHit(e, h.targetId);
      }
      const out = e.update(dt);
      if (out === "expire") {
        if (e.owned && net.active && e.hp > 0) net.publishStreak({ kind: "sam", action: "end", eid: e.id });
        e.dispose();
        streakEntities.delete(id);
      }
      continue;
    }

    if (e instanceof VtolWarship) {
      if (e.owned && e.botId) botWarshipGunner(e, dt);
      const landed = [];
      const out = e.update(dt, landed);
      for (const r of landed) warshipImpact(e, r);
      if (out === "expire") {
        if (e === warship) warship = null;
        e.dispose();
        streakEntities.delete(id);
      }
      continue;
    }

    if (e instanceof HelicopterGunship) {
      let aim = null;
      if (e.onStation) {
        const victim = gunshipTarget(e);
        if (victim) {
          aim = victim.chest;
          if (e.tryFire()) {
            gunshipShotFx(e, victim.chest);
            // Only the caller's copy deals damage; the hit reaches everyone
            // else as an ordinary hit message.
            if (e.owned && e.botId) streakDamage(e.botId, victim.rp ? victim.rp.netId : net.id, HELI_DAMAGE, "heli");
            else if (e.owned && victim.rp) dealDamageToRemote(victim.rp, HELI_DAMAGE, "heli");
          }
        }
      }
      const out = e.update(dt, aim);
      if (out === "expire") {
        if (e.owned && net.active) net.publishStreak({ kind: "heli", action: "despawn", eid: id });
        e.dispose();
        streakEntities.delete(id);
      }
      continue;
    }
  }
  updateDroneLock();
  updateSwarms(dt);
  syncWarshipView();
  updateWarshipHud();
  syncDragonfireView();
  updateStreakControl(dt);
  strikeTablet?.update(dt);

  // Lightning strikes: each run plays its own timeline (smoke, jet, bombs)
  // and reports every bomb the frame it lands.
  for (let i = pendingStrikes.length - 1; i >= 0; i--) {
    const s = pendingStrikes[i];
    for (const bi of s.update(dt)) strikeImpact(s, s.bombs[bi].at);
    if (s.done) { s.dispose(); pendingStrikes.splice(i, 1); }
  }

  // Recon planes: fly, then age out. They own no reveal, so there's nothing
  // to report back over the wire when they expire.
  for (let i = flyovers.length - 1; i >= 0; i--) {
    const f = flyovers[i];
    if (f.update(dt) === "expire") {
      f.dispose();
      flyovers.splice(i, 1);
    }
  }

  blastFx?.update(dt);
}

/* A crate landing on someone. Only the caller's copy runs this. */
function crushUnderPackage(pkg) {
  const at = new THREE.Vector3(pkg.x, pkg.groundY, pkg.z);
  if (pkg.botId) {
    // A bot's crate: the bot's kill, and it spares the bot's own side.
    const bot = bots.byId(pkg.botId);
    if (!bot) return;
    const ffa = !!currentMode().ffa;
    const under = (p) => Math.hypot(p.x - pkg.x, p.z - pkg.z) <= PKG_CRUSH_RADIUS && Math.abs(p.y - pkg.groundY) <= 2.5;
    for (const rp of remotes.byId.values()) {
      if (rp.alive && rp.netId !== bot.id && (ffa || rp.team !== bot.team) && under(rp.pos)) botDealDamage(bot, rp.netId, 400, false, "carepackage");
    }
    if (player.alive && (ffa || net.team !== bot.team) && under(move.pos)) botDealDamage(bot, net.id, 400, false, "carepackage");
    return;
  }
  for (const rp of remotes.byId.values()) {
    if (!rp.alive) continue;
    if (Math.hypot(rp.pos.x - pkg.x, rp.pos.z - pkg.z) > PKG_CRUSH_RADIUS) continue;
    if (Math.abs(rp.pos.y - pkg.groundY) > 2.5) continue;
    dealDamageToRemote(rp, 400, "carepackage");
  }
  if (player.alive && Math.hypot(move.pos.x - pkg.x, move.pos.z - pkg.z) <= PKG_CRUSH_RADIUS
    && Math.abs(move.pos.y - at.y) < 2.5) {
    damagePlayer(400, net.id, "carepackage");
  }
}

/* One bomb of a Lightning Strike landing. Only the caller does damage. */
function strikeImpact(s, at) {
  explosionFx({ kind: "lethal", glow: 0xffb347, radius: AIRSTRIKE_RADIUS }, at);
  streakBlast(at, 1.3);
  impactFx.hit(at, { normal: new THREE.Vector3(0, 1, 0), surface: "ground", scale: 4 });
  if (s.owned) {
    areaDamage(at, AIRSTRIKE_RADIUS * 0.6,
      AIRSTRIKE_DAMAGE / AIRSTRIKE_BOMBS * 2,
      { id: "airstrike", radius: AIRSTRIKE_RADIUS * 0.6, minDamage: 20, selfMult: 1 },
      { creditAs: "airstrike", botId: s.botId || null });
  }
}

/* One hunter-killer's frame. The caller's copy re-acquires a target when
   its one dies and decides the detonation; everyone else's copy flies the
   same steering at the same target and waits for the caller's word. */
function updateDrone(id, e, dt) {
  if (e.owned && e.age > 0.3 && !droneTargetPos(e.targetId)) {
    const next = pickDroneTarget(e.root.position, 0, e.botId ? { team: e.botTeam, botId: e.botId } : undefined);
    const nextId = next?.netId || null;
    if (nextId !== e.targetId) {
      e.targetId = nextId;
      if (next && !e.sky && !e.botId) showWaveBanner(`HUNTER-KILLER — RETARGETED ${String(next.peer?.name || "").toUpperCase()}`, 1400);
      if (net.active) net.publishStreak({ kind: "drone", action: "retarget", eid: id, target: nextId });
    }
  }
  droneWorld.target = droneTargetPos(e.targetId);
  const out = e.update(dt, droneWorld);
  if (!out) {
    // A copy that thought it arrived gives up if the owner never says so.
    if (e.frozen && e.age - e.frozenAt > 2) { e.dispose(); streakEntities.delete(id); }
    return;
  }
  if (!e.owned) {
    e.done = false;
    e.frozen = true;
    e.frozenAt = e.age;
    return;
  }
  detonateDrone(e, out);
  if (net.active) {
    const p = e.root.position;
    net.publishStreak({
      kind: "drone", action: out === "expire" ? "expire" : "kill", eid: id,
      x: round2(p.x), y: round2(p.y), z: round2(p.z),
    });
  }
  e.dispose();
  streakEntities.delete(id);
}

/* The warhead going off, on the caller's copy: a direct hit on the target it
   reached, then the blast for everyone else in range — the caller included,
   if they flew it into their own feet (the user asked for that). */
function detonateDrone(e, out) {
  const at = e.root.position.clone();
  explosionFx({ kind: "lethal", glow: 0xffa23a, radius: DRONE_SPLASH_RADIUS }, at);
  streakBlast(at, out === "expire" ? 0.6 : 0.9);
  // Damage goes through the ordinary hit path, so a drone kill credits and
  // killfeeds exactly like a bullet one. A bot's drone can be hitting us.
  if (out === "hit" && e.targetId && (e.botId || e.targetId !== net.id)) {
    streakDamage(e.botId, e.targetId, DRONE_DAMAGE, e.credit);
  }
  areaDamage(at, DRONE_SPLASH_RADIUS, out === "expire" ? DRONE_DAMAGE * 0.5 : DRONE_DAMAGE * 0.8,
    { id: e.credit, radius: DRONE_SPLASH_RADIUS, minDamage: 20, selfMult: e.sky || e.botId ? 0 : 1 },
    { creditAs: e.credit, botId: e.botId || null });
}

/* A red lock bracket over whatever our hunter-killer is chasing, so you can
   see the homing work. One at a time: the newest drone wins. */
let lockEl = null;
function updateDroneLock() {
  let drone = null;
  for (const e of streakEntities.values()) {
    if (e instanceof HunterDrone && e.owned && !e.botId && !e.frozen) drone = e;
  }
  const target = drone ? droneTargetPos(drone.targetId) : null;
  if (!target) { if (lockEl) lockEl.hidden = true; return; }
  if (!lockEl) {
    lockEl = document.createElement("div");
    lockEl.className = "to-hk-lock";
    lockEl.setAttribute("aria-hidden", "true");
    lockEl.innerHTML = "<i></i><span>LOCKED</span>";
    (els.streakMark?.parentElement || document.body).appendChild(lockEl);
  }
  const p = new THREE.Vector3(target.x, target.y + 1.1, target.z).project(camera);
  const onScreen = p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1;
  lockEl.hidden = !onScreen;
  if (!onScreen) return;
  const host = lockEl.parentElement.getBoundingClientRect();
  lockEl.style.left = `${((p.x + 1) / 2) * host.width}px`;
  lockEl.style.top = `${((1 - p.y) / 2) * host.height}px`;
  const dist = drone.root.position.distanceTo(target);
  lockEl.classList.toggle("is-close", dist < 12);
}

/* What a gunship shoots at: the nearest hostile it has a clear line to. On
   copies it can be us (hostile side), so we see it coming even though the
   damage arrives from the caller. */
const _heliDir = new THREE.Vector3();
function gunshipTarget(e) {
  const muzzle = e.muzzle;
  const ffa = currentMode().ffa;
  let best = null, bestD = HELI_FIRE_RANGE;
  const consider = (pos, rp) => {
    const chest = new THREE.Vector3(pos.x, pos.y + 1.1, pos.z);
    const d = muzzle.distanceTo(chest);
    if (d >= bestD) return;
    _heliDir.copy(chest).sub(muzzle).divideScalar(d);
    if (raycastWorld(colliders, muzzle, _heliDir, d) < d - 0.4) return;   // roof or wall in the way
    bestD = d;
    best = { chest, rp };
  };
  for (const rp of remotes.byId.values()) {
    if (!rp.alive || rp.netId === e.botId) continue;
    if (!ffa && e.team && rp.team === e.team) continue;
    consider(rp.pos, rp);
  }
  // Someone else's, or one of our bots' on the other side: we're a target.
  if ((!e.owned || e.botId) && player.alive && (ffa || !e.team || e.team !== net.team)) consider(move.pos, null);
  return best;
}

/* The chin gun firing: tracers you can follow from the nose to the target,
   a muzzle puff, and the heaviest gun report in the game. */
function gunshipShotFx(e, aimAt) {
  const muzzle = e.muzzle;
  const def = WEAPON_DEFS.bellow || WEAPON_DEFS.problem416;
  for (let i = 0; i < 2; i++) {
    const d = aimAt.clone().sub(muzzle).normalize();
    d.x += (Math.random() - 0.5) * 0.035;
    d.y += (Math.random() - 0.5) * 0.035;
    d.z += (Math.random() - 0.5) * 0.035;
    d.normalize();
    bullets.spawn({ origin: muzzle.clone().addScaledVector(d, 0.4), dir: d, def, ownerId: "remote", cosmetic: true });
  }
  spawnImpactBurst(muzzle, 0xffd166, 5);
  impactFx.puff(muzzle, aimAt.clone().sub(muzzle).normalize(), 1.5);
  audio.shot(def, 0.45, e.root.position);
}

/* Nearest living enemy of a given team, within range. The gunship is not a
   player, so it can't use net.team — it carries whose side it's on. */
function nearestHostileToTeam(from, team, maxDist = Infinity) {
  let best = null, bestD = maxDist;
  const ffa = currentMode().ffa;
  for (const rp of remotes.byId.values()) {
    if (!rp.alive) continue;
    if (!ffa && team && rp.team === team) continue;
    const d = from.distanceTo(rp.pos);
    if (d < bestD) { bestD = d; best = rp; }
  }
  // In free-for-all the caller is fair game to nobody but themselves, so the
  // gunship simply never targets its owner.
  return best;
}

/* Apply streak damage to a remote actor through the existing paths, so kill
   credit, the killfeed and assists all behave as they do for gunfire. */
function dealDamageToRemote(rp, damage, weaponId) {
  // RemotePlayer carries its id as `netId` — there is no `rp.id`. Reading
  // that silently sent every gunship round, HK direct hit and crate crush
  // to nobody.
  const id = rp.netId;
  const bot = bots.byId(id);
  if (bot) {
    const { killed } = bots.applyHit(id, damage);
    noteDealt(id, damage);
    if (killed) {
      dealtLog.delete(id);
      net.reportDeathAs(id, net.id, weaponId, false);
      registerDeath(bot.name, net.id, weaponId, {
        victimTeam: bot.team, victimPos: bot.pos, victimWeaponId: bot.weaponId,
        victimId: bot.id, victimIsBot: true,
      });
    }
    return;
  }
  noteDealt(id, damage);
  net.reportHit(id, damage, false, weaponId);
}

/* Streak damage from whoever owns the streak: us (the old path above), or a
   bot we host (its own gun's path, so the kill, killfeed and team score
   credit the bot, and the local player can be the one hit). */
function streakDamage(botId, targetId, damage, weaponId) {
  if (botId) {
    // A bot that has since left takes its streak's damage with it.
    const bot = bots.byId(botId);
    if (bot) botDealDamage(bot, targetId, damage, false, weaponId);
    return;
  }
  const rp = remotes.byId.get(targetId);
  if (rp && rp.alive) dealDamageToRemote(rp, damage, weaponId);
}

/* A hostile of a streak's owner, as a target: the local player counts when
   the owner is one of our bots on the other side. */
function streakOwnerHates(team, botId) {
  if (!botId || !player.alive) return false;
  return !!currentMode().ffa || !team || team !== net.team;
}

// -------------------- Bot scorestreaks (phase 1) --------------------
//
// Every bot rolls three streaks a match and earns them on the same meter a
// player does (kills; the meter empties on death, an earned streak stays).
// Once one is ready it waits for a quiet beat (nobody in sight a moment)
// and calls it. The bot host runs the streak as its owner; everyone else
// sees it through the streak messages players' streaks already send.
// Phase 1 had the ones that run themselves; phase 2 added the Care Package
// (throw the marker, run to the crate, capture it) and the Lightning Strike
// (three marks where the team last saw the most enemies), phase 3 the VTOL
// Warship (the bot stands still and works the guns, botWarshipGunner).
const BOT_STREAK_POOL = ["uav", "counteruav", "vsat", "carepackage", "drone", "airstrike", "k9", "helicopter", "swarm", "samturret", "dragonfire", "warship"];
const BOT_RADAR = new Set(["uav", "counteruav", "vsat"]);   // no sides to share in FFA
const BOT_AIR = new Set(["drone", "helicopter", "swarm", "warship", "dragonfire"]);
let botWarshipMatch = -1;   // one bot warship a match (design call), whoever's side
const BOT_AIR_CAP = 2;      // bot air streaks up at once, per team
/* Veteran bots (user): twice the scorestreaks of a regular bot, friend and
   foe alike: their kills pay double into the streak meter, and twice as
   many of their aircraft can be up at once. */
const BOT_VET_STREAK_MULT = 2;
function botStreakMult(b) { return b.skill === "veteran" ? BOT_VET_STREAK_MULT : 1; }
const BOT_QUIET = 1.5;      // seconds with nobody in sight before calling
const BOT_STREAK_KEY = "trollops:botStreaks";

try { if (els.botStreaks && localStorage.getItem(BOT_STREAK_KEY) === "0") els.botStreaks.checked = false; } catch { /* private window */ }
els.botStreaks?.addEventListener("change", () => {
  try { localStorage.setItem(BOT_STREAK_KEY, els.botStreaks.checked ? "1" : "0"); } catch { /* private window */ }
});

function botStreaksOn() {
  return isPvp() && !isRange() && !royale && streaksAllowed(currentMode()) && (!els.botStreaks || els.botStreaks.checked);
}

function botStreakState(b) {
  if (!b.streak || b.streak.match !== matchesPlayed) {
    const pool = BOT_STREAK_POOL.filter((id) => !(currentMode().ffa && BOT_RADAR.has(id)));
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    b.streak = { picks: pool.slice(0, 3), pts: 0, earned: new Set(), ready: [], lock: {}, wasAlive: b.alive, match: matchesPlayed };
  }
  return b.streak;
}

/* A bot we host scored (a kill, from registerDeath). */
function botEarn(b, pts) {
  if (!botStreaksOn()) return;
  const s = botStreakState(b);
  s.pts += pts * botStreakMult(b);
  for (const id of s.picks) {
    if (!s.earned.has(id) && s.pts >= STREAK_DEFS[id].cost) { s.earned.add(id); s.ready.push(id); }
  }
}

function botAirUp(team) {
  let n = 0;
  for (const e of streakEntities.values()) {
    if (e.botId && e.botTeam === team && !e.sky && (e instanceof HunterDrone || e instanceof HelicopterGunship || e instanceof Dragonfire || e instanceof VtolWarship)) n++;
  }
  for (const s of swarmRuns) if (s.botId && s.team === team) n++;
  return n;
}

/* Per frame on the bot host: reset meters on death, call what's ready. */
function updateBotStreaks(dt) {
  if (!botStreaksOn() || isStaging() || !net.isBotHost()) return;
  const now = performance.now();
  noteBotSightings(dt);
  for (const b of bots.bots) {
    const s = botStreakState(b);
    if (s.wasAlive && !b.alive) { s.pts = 0; s.earned.clear(); b.crate = null; }
    s.wasAlive = b.alive;
    if (b.alive && b.crate) updateBotCrate(b, dt);
    if (!b.alive || !s.ready.length || b.airborne || botBusy(b)) continue;
    const quiet = !b.lastSeen || b.lastSeen.age > BOT_QUIET;
    if (!quiet || b.reloadT > 0) continue;
    // Bots keep a Dragonfire banked until they're out under open sky, same
    // as a player; a Lightning Strike until their side has seen someone to
    // drop it on; a Warship if one bot already had this match's.
    const i = s.ready.findIndex((id) => (s.lock[id] || 0) <= now && (!BOT_AIR.has(id) || botAirUp(b.team) < BOT_AIR_CAP * botStreakMult(b))
      && (id !== "dragonfire" || !dragonfireSkyCheck(b.pos))
      && (id !== "airstrike" || botStrikeSpots(b).length > 0)
      && (id !== "warship" || botWarshipMatch !== matchesPlayed)
      && (id !== "carepackage" || !b.crate));
    if (i < 0) continue;
    const id = s.ready.splice(i, 1)[0];
    if (STREAK_DEFS[id].cooldown) s.lock[id] = now + STREAK_DEFS[id].cooldown * 1000;
    botFireStreak(b, id);
  }
}

/* A bot calls a streak: the same world events fireStreak makes for us,
   owned by the bot. */
const botStreakLog = [];   // recent bot calls, newest last (tests, debugging)
function botFireStreak(b, id) {
  botStreakLog.push({ bot: b.id, team: b.team, id, t: Math.round(performance.now()) });
  if (botStreakLog.length > 60) botStreakLog.shift();
  const def = STREAK_DEFS[id];
  const tag = `${b.id}-${Math.round(performance.now())}`;
  const callout = (label) => {
    const m = { kind: "callout", label, who: b.name, team: currentMode().ffa ? null : b.team };
    if (net.active) net.publishStreak(m);
    applyRemoteStreak(m);
  };
  switch (id) {
    case "uav": {
      const yaw = Math.random() * Math.PI * 2;
      startUav(b.team, def.duration);
      spawnRecon(round2(b.pos.x), b.pos.z, round2(yaw), def.duration, { team: b.team, caller: b.id });
      if (net.active) net.publishStreak({ kind: "uav", action: "start", team: b.team, duration: def.duration, x: round2(b.pos.x), z: round2(b.pos.z), yaw: round2(yaw) });
      callout("UAV");
      break;
    }
    case "vsat": {
      const yaw = Math.random() * Math.PI * 2;
      startVsat(b.team, def.duration);
      spawnVsatSat(yaw, def.duration);
      if (net.active) net.publishStreak({ kind: "vsat", action: "start", team: b.team, duration: def.duration, yaw: round2(yaw) });
      callout("ORBITAL VSAT");
      break;
    }
    case "counteruav": {
      const m = { kind: "cuav", action: "start", team: b.team, duration: def.duration, lockout: def.lockout,
        x: round2(b.pos.x), z: round2(b.pos.z), yaw: round2(Math.random() * Math.PI * 2) };
      if (net.active) net.publishStreak(m);
      applyCounterUav(m);   // the host is in the room too
      callout("COUNTER-UAV");
      break;
    }
    case "drone": {
      const eid = `streak-drone-${tag}`;
      const victim = pickDroneTarget(b.pos, 1.6, { team: b.team, botId: b.id });
      const from = new THREE.Vector3(b.pos.x, b.pos.y + 1.8, b.pos.z);
      const e = spawnDrone({ id: eid, targetId: victim?.netId || null, owned: true, pos: from, yaw: b.yaw });
      e.botId = b.id; e.botTeam = b.team;
      if (net.active) {
        net.publishStreak({ kind: "drone", action: "launch", eid, target: victim?.netId || null,
          x: round2(from.x), y: round2(from.y), z: round2(from.z), yaw: round2(b.yaw) });
      }
      callout("HUNTER-KILLER");
      break;
    }
    case "helicopter": {
      const eid = `streak-heli-${tag}`;
      const seed = Math.floor(Math.random() * 360);
      const e = spawnHelicopter({ id: eid, seed, owned: true, team: b.team });
      e.botId = b.id; e.botTeam = b.team;
      if (net.active) net.publishStreak({ kind: "heli", action: "spawn", eid, seed, team: b.team });
      callout("GUNSHIP INBOUND");
      break;
    }
    case "k9": {
      const eid = `streak-k9-${tag}`;
      const e = spawnK9({ id: eid, owned: true, team: b.team, ownerId: b.id, x: b.pos.x, y: b.pos.y, z: b.pos.z, yaw: b.yaw });
      e.botId = b.id; e.botTeam = b.team;
      if (net.active) {
        net.publishStreak({ kind: "k9", action: "spawn", eid, team: b.team,
          x: round2(b.pos.x), y: round2(b.pos.y), z: round2(b.pos.z), yaw: round2(b.yaw) });
      }
      callout("K9 UNIT");
      break;
    }
    case "swarm":
      swarmRuns.push({ t: 0, next: 1.4, sent: 0, botId: b.id, team: b.team });
      callout("SWARM");
      break;
    case "samturret": {
      const eid = `streak-sam-${tag}`;
      const at = samDeployPoint(b.pos, b.yaw);
      const e = spawnSam({ id: eid, owned: true, team: b.team, ...at });
      e.botId = b.id; e.botTeam = b.team;
      if (net.active) net.publishStreak({ kind: "sam", action: "spawn", eid, team: b.team, x: round2(at.x), y: round2(at.y), z: round2(at.z), yaw: round2(at.yaw) });
      callout("SAM TURRET");
      break;
    }
    case "dragonfire": {
      // The bot stands where it called it (botBusy) and flies it (flyBotDragonfire).
      const eid = `streak-df-${tag}`;
      const from = { x: b.pos.x - Math.sin(b.yaw) * 0.8, y: b.pos.y + 1.3, z: b.pos.z - Math.cos(b.yaw) * 0.8 };
      const e = spawnDragonfire({ id: eid, owned: true, team: b.team, ...from, yaw: b.yaw, botId: b.id });
      e.botTeam = b.team;
      b.piloting = eid;
      if (net.active) net.publishStreak({ kind: "dragonfire", action: "spawn", eid, team: b.team, x: round2(from.x), y: round2(from.y), z: round2(from.z), yaw: round2(b.yaw) });
      callout("DRAGONFIRE");
      break;
    }
    case "carepackage": {
      // Lob the marker a few metres ahead, like a player's throw; the drop is
      // called where it settles (updateStreakEntities), and the bot goes to
      // fetch it (botObjective, updateBotCrate).
      const eid = `pkg-${b.id}-${Math.round(performance.now())}`;
      const origin = new THREE.Vector3(b.pos.x, b.pos.y + 1.5, b.pos.z);
      const dir = new THREE.Vector3(-Math.sin(b.yaw), 0.35, -Math.cos(b.yaw)).normalize();
      origin.addScaledVector(dir, Math.max(0, Math.min(0.5, raycastWorld(colliders, origin, dir, 0.85) - 0.25)));
      const marker = new MarkerCanister({ id: eid, origin, dir, world: droneWorld, owned: true });
      marker.reward = rollPackageReward();
      marker.botId = b.id;
      marker.botTeam = b.team;
      streakEntities.set(eid, marker);
      scene.add(marker.root);
      if (net.active) {
        net.publishStreak({ kind: "carepackage", action: "marker", eid,
          ox: round2(origin.x), oy: round2(origin.y), oz: round2(origin.z), dx: round2(dir.x), dy: round2(dir.y), dz: round2(dir.z) });
      }
      b.crate = { eid, holdT: 0 };
      callout("CARE PACKAGE");
      break;
    }
    case "airstrike": {
      const spots = botStrikeSpots(b);
      if (!spots.length) break;
      // The jets come in from the caller's side of the marks.
      const cx = spots.reduce((a, p) => a + p.x, 0) / spots.length, cz = spots.reduce((a, p) => a + p.z, 0) / spots.length;
      const yaw = Math.atan2(-(cx - b.pos.x), -(cz - b.pos.z));
      const runs = spots.map((p, i) => ({ x: round2(p.x), z: round2(p.z), delay: round2(strikeDelay(i)) }));
      for (const r of runs) {
        const run = spawnAirstrike({ ...r, yaw, owned: true, team: b.team });
        run.botId = b.id;
      }
      if (net.active) net.publishStreak({ kind: "airstrike", action: "mark", runs, yaw: round2(yaw), team: b.team });
      callout("LIGHTNING STRIKE");
      break;
    }
    case "warship": {
      // The bot stands where it called it (botBusy) and works the guns
      // (botWarshipGunner) until it leaves or the bot dies.
      const eid = `streak-vtol-${tag}`;
      const seed = Math.floor(Math.random() * 360);
      const ws = spawnWarship({ id: eid, seed, owned: true, team: b.team });
      ws.botId = b.id; ws.botTeam = b.team;
      b.gunning = eid;
      botWarshipMatch = matchesPlayed;
      if (net.active) net.publishStreak({ kind: "warship", action: "spawn", eid, seed, team: b.team });
      callout("VTOL WARSHIP");
      break;
    }
  }
}

/* Where a bot's side has been seeing enemies: every sighting a bot makes
   (bots.js lastSeen) is kept a while, per side, for its Lightning Strike. */
const BOT_INTEL_KEEP = 25;      // seconds a sighting stays useful
const botIntel = new Map();     // side -> [{ x, z, t }]
let botIntelT = 0;
function botSide(b) { return currentMode().ffa ? b.id : b.team; }
function noteBotSightings(dt) {
  if ((botIntelT -= dt) > 0) return;
  botIntelT = 0.5;
  const now = performance.now() / 1000;
  for (const b of bots.bots) {
    if (!b.alive || !b.lastSeen || b.lastSeen.age > 1) continue;
    const side = botSide(b);
    const list = botIntel.get(side) || [];
    list.push({ x: b.lastSeen.x, z: b.lastSeen.z, t: now });
    while (list.length > 60 || (list.length && now - list[0].t > BOT_INTEL_KEEP)) list.shift();
    botIntel.set(side, list);
  }
}

/* Up to three strike marks for a bot: the densest clusters of its side's
   recent sightings (newer counts more), at least 9 m apart, none on top of a
   friend. Empty when the side has seen nobody lately. */
function botStrikeSpots(b) {
  const now = performance.now() / 1000;
  const pts = (botIntel.get(botSide(b)) || []).filter((p) => now - p.t <= BOT_INTEL_KEEP);
  if (!pts.length) return [];
  const ffa = !!currentMode().ffa;
  const friends = [];
  if (!ffa) {
    for (const o of bots.bots) if (o.alive && o.team === b.team) friends.push(o.pos);
    if (player.alive && net.team === b.team) friends.push(move.pos);
  } else friends.push(b.pos);
  const spots = [];
  const left = pts.slice();
  while (spots.length < 3 && left.length) {
    let best = null, bestW = 0;
    for (const p of left) {
      let w = 0;
      for (const q of left) {
        if (Math.hypot(p.x - q.x, p.z - q.z) < 7) w += 1 - (now - q.t) / BOT_INTEL_KEEP * 0.7;
      }
      if (w > bestW) { bestW = w; best = p; }
    }
    if (!best) break;
    for (let i = left.length - 1; i >= 0; i--) if (Math.hypot(left[i].x - best.x, left[i].z - best.z) < 9) left.splice(i, 1);
    if (!friends.some((f) => Math.hypot(f.x - best.x, f.z - best.z) < AIRSTRIKE_RADIUS + 2)) spots.push({ x: best.x, z: best.z });
  }
  return spots;
}

/* A bot fetching its care package: the objective walks it over, standing
   on it runs the owner's capture clock, and the reward goes in its slots
   (a streak bots can't call becomes one they can). */
function updateBotCrate(b, dt) {
  const e = streakEntities.get(b.crate.eid);
  if (!e || (e instanceof CarePackage && e.claimed)) { b.crate = null; return; }
  if (!(e instanceof CarePackage) || !e.landed) return;   // still the marker, or the heli's inbound
  if (!e.withinClaim(b.pos.x, b.pos.z)) { b.crate.holdT = 0; return; }
  b.crate.holdT += dt;
  if (b.crate.holdT < 0.8) return;
  const [kind, arg] = String(e.reward).split(":");
  if (kind === "streak") {
    const callable = BOT_STREAK_POOL.filter((id) => id !== "carepackage" && !(currentMode().ffa && BOT_RADAR.has(id)));
    const id = callable.includes(arg) ? arg : callable[Math.floor(Math.random() * callable.length)];
    botStreakState(b).ready.push(id);
  }
  if (net.active) net.publishStreak({ kind: "carepackage", action: "claimed", eid: e.id });
  e.open();
  spawnImpactBurst(new THREE.Vector3(e.x, e.groundY + 0.8, e.z), 0x9dff7a, 16);
  b.crate = null;
}

/* A bot's VTOL Warship, on the bot host: from the gun deck, pick the
   nearest enemy in the clear, rake them with the 25MM in bursts, and drop a
   105MM shell when two or more are bunched up. Aim error scales with the
   bot's skill. The bot dying sends the ship home, as it does for a player. */
const _bwsFrom = new THREE.Vector3(), _bwsDir = new THREE.Vector3(), _bwsAim = new THREE.Vector3();
function botWarshipGunner(ws, dt) {
  const bot = bots.byId(ws.botId);
  if (!bot || !bot.alive) {
    if (ws.age < ws.duration) {
      ws.duration = Math.max(WARSHIP_BOARD_AT, ws.age);
      if (net.active) net.publishStreak({ kind: "warship", action: "leave", eid: ws.id });
    }
    if (bot && bot.gunning === ws.id) bot.gunning = null;
    return;
  }
  if (!ws.onStation) return;
  ws.gunnerPos(_bwsFrom);
  ws.aiT = (ws.aiT || 0) - dt;
  if (ws.aiT <= 0) {
    ws.aiT = 0.6;
    ws.aiTarget = null;
    const ffa = !!currentMode().ffa;
    let bestD = Infinity;
    const consider = (id, pos) => {
      _bwsAim.set(pos.x, pos.y + 0.9, pos.z);
      const d = _bwsFrom.distanceTo(_bwsAim);
      if (d >= bestD) return;
      _bwsDir.copy(_bwsAim).sub(_bwsFrom).divideScalar(d);
      if (raycastWorld(colliders, _bwsFrom, _bwsDir, d) < d - 0.6) return;   // under a roof
      bestD = d;
      ws.aiTarget = { id, pos };
    };
    for (const rp of remotes.byId.values()) {
      if (!rp.alive || rp.netId === bot.id || (!ffa && rp.team === bot.team)) continue;
      consider(rp.netId, rp.pos);
    }
    if (player.alive && (ffa || net.team !== bot.team)) consider(net.id, move.pos);
  }
  const tgt = ws.aiTarget;
  if (!tgt) return;
  // Bursts: ~1.2 s on the trigger, ~0.7 s off, like a person walking it on.
  ws.burstT = (ws.burstT ?? 1.2) - dt;
  if (ws.burstT < -0.7) ws.burstT = 1.2;
  // Anyone else on the bot's hit list within 6 m of the target.
  const ffa = !!currentMode().ffa;
  let bunched = 0;
  for (const rp of remotes.byId.values()) {
    if (!rp.alive || rp.netId === tgt.id || rp.netId === bot.id || (!ffa && rp.team === bot.team)) continue;
    if (Math.hypot(rp.pos.x - tgt.pos.x, rp.pos.z - tgt.pos.z) < 6) bunched++;
  }
  if (tgt.id !== net.id && player.alive && (ffa || net.team !== bot.team) && Math.hypot(move.pos.x - tgt.pos.x, move.pos.z - tgt.pos.z) < 6) bunched++;
  const gun = bunched >= 1 && (ws.cannonT = (ws.cannonT || 0) - dt) <= 0 ? "cannon" : "chain";
  if (gun === "chain" && ws.burstT < 0) return;
  if (!ws.tryFire(gun)) return;
  if (gun === "cannon") ws.cannonT = 4;
  const err = (bot.skill === "veteran" ? 0.6 : bot.skill === "recruit" ? 2.2 : 1.3) * (gun === "cannon" ? 1.5 : 1);
  _bwsAim.set(tgt.pos.x + (Math.random() - 0.5) * err, tgt.pos.y + 0.6, tgt.pos.z + (Math.random() - 0.5) * err);
  _bwsDir.copy(_bwsAim).sub(_bwsFrom).normalize();
  let d = raycastWorld(colliders, _bwsFrom, _bwsDir, 480);
  if (_bwsDir.y < -1e-3) d = Math.min(d, (0 - _bwsFrom.y) / _bwsDir.y);
  const to = _bwsFrom.clone().addScaledVector(_bwsDir, d);
  ws.shoot(gun, to);
  if (net.active) net.publishStreak({ kind: "warship", action: "shot", eid: ws.id, g: gun, x: round2(to.x), y: round2(to.y), z: round2(to.z) });
  if (gun === "cannon") audio.explosion(0.2, ws.root.position);
  else if (Math.random() < 0.3) audio.shot(WEAPON_DEFS.bellow || WEAPON_DEFS.problem416, 0.3, ws.root.position);
}

/* A bot's Dragonfire, on the bot host: pick the nearest enemy it can get
   at, hold a firing spot ~9 m off it and 5 m up, face it, and shoot on the
   bot's own accuracy. No enemy: circle over the bot. The bot dying drops it. */
const _bdfTo = new THREE.Vector3(), _bdfDir = new THREE.Vector3();
function flyBotDragonfire(e, dt) {
  const bot = bots.byId(e.botId);
  if (!bot || !bot.alive) { shootDownAir(e.id, null, true); return; }
  if (!e.launched) { e.fly(dt, { fwd: 0, strafe: 0, up: 0, yaw: e.yaw, pitch: e.pitch }, null, null); return; }
  e.aiT = (e.aiT || 0) - dt;
  if (e.aiT <= 0) {
    e.aiT = 0.5;
    let best = null, bestD = Infinity;
    const ffa = !!currentMode().ffa;
    const consider = (id, pos) => {
      const d = pos.distanceTo(e.pos);
      if (d < bestD) { bestD = d; best = { id, pos }; }
    };
    for (const rp of remotes.byId.values()) {
      if (!rp.alive || rp.netId === bot.id || (!ffa && rp.team === bot.team)) continue;
      consider(rp.netId, rp.pos);
    }
    if (player.alive && streakOwnerHates(bot.team, bot.id)) consider(net.id, move.pos);
    e.aiTarget = best;
  }
  const t = e.aiTarget;
  let tx, ty, tz, faceYaw;
  if (t) {
    _bdfDir.set(e.pos.x - t.pos.x, 0, e.pos.z - t.pos.z);
    if (_bdfDir.lengthSq() < 1e-3) _bdfDir.set(1, 0, 0);
    _bdfDir.normalize();
    tx = t.pos.x + _bdfDir.x * 9; tz = t.pos.z + _bdfDir.z * 9; ty = t.pos.y + 5;
    faceYaw = Math.atan2(-(t.pos.x - e.pos.x), -(t.pos.z - e.pos.z));
  } else {
    const a = e.age * 0.4;
    tx = bot.pos.x + Math.cos(a) * 10; tz = bot.pos.z + Math.sin(a) * 10; ty = bot.pos.y + 7;
    faceYaw = Math.atan2(-(tx - e.pos.x), -(tz - e.pos.z));
  }
  let dyaw = Math.atan2(Math.sin(faceYaw - e.yaw), Math.cos(faceYaw - e.yaw));
  const yaw = e.yaw + Math.max(-3 * dt, Math.min(3 * dt, dyaw));
  const dx = tx - e.pos.x, dz = tz - e.pos.z, dy = ty - e.pos.y;
  const sn = Math.sin(yaw), cs = Math.cos(yaw);
  const clamp1 = (v) => Math.max(-1, Math.min(1, v));
  const aimPitch = t ? Math.atan2(t.pos.y + 1.1 - e.pos.y, Math.hypot(t.pos.x - e.pos.x, t.pos.z - e.pos.z)) : -0.2;
  e.fly(dt, { fwd: clamp1(-(dx * sn + dz * cs) / 4), strafe: clamp1((dx * cs - dz * sn) / 4), up: clamp1(dy / 2.5), yaw, pitch: aimPitch },
    (from, dir, max) => raycastWorld(colliders, from, dir, max),
    (x, z, fromY) => groundHeightAt(colliders, x, z, fromY));
  // Fire when it's facing them with a clear line.
  if (!t || Math.abs(dyaw) > 0.3) return;
  const from = e.muzzleWorld(_bdfTo.set(0, 0, 0)).clone();
  const aim = t.pos.clone(); aim.y += 1.1;
  const d = from.distanceTo(aim);
  if (d > DF_RANGE || !e.tryFire()) return;
  _bdfDir.copy(aim).sub(from).divideScalar(d);
  if (raycastWorld(colliders, from, _bdfDir, d) < d - 0.5) return;
  const hit = Math.random() < (bot.diff?.hit ?? 0.45) * 0.8;
  const to = hit ? aim : aim.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 2.4));
  e.shoot(to);
  if (net.active) net.publishStreak({ kind: "dragonfire", action: "shot", eid: e.id, x: round2(to.x), y: round2(to.y), z: round2(to.z) });
  if (Math.random() < 0.35) audio.shot(WEAPON_DEFS.bellow || WEAPON_DEFS.problem416, 0.25, e.pos);
  if (hit) streakDamage(bot.id, t.id, DF_DAMAGE, "dragonfire");
}

/* Streak events from someone else. Display and world state only — our own
   meter is never touched from the wire. */
function applyRemoteStreak(m) {
  switch (m.kind) {
    case "cuav":
      if (m.action === "start") applyCounterUav(m);
      break;

    case "vsat":
      if (m.action === "start") {
        startVsat(m.team, m.duration || STREAK_DEFS.vsat.duration);
        spawnVsatSat(+m.yaw || 0, m.duration || STREAK_DEFS.vsat.duration);
        if (m.team === uavBucket() && !currentMode().ffa) showWaveBanner("FRIENDLY VSAT IN ORBIT", 1500);
        else showWaveBanner("ENEMY ORBITAL VSAT — THEY SEE YOU", 1800);
      }
      break;

    case "uav":
      if (m.action === "start") {
        startUav(m.team, m.duration || STREAK_DEFS.uav.duration);
        if (typeof m.x === "number" && typeof m.z === "number") {
          spawnRecon(m.x, m.z, m.yaw || 0, m.duration || STREAK_DEFS.uav.duration, { team: m.team, caller: m.id || null });
        }
        // Only say so when it's our side's UAV — an enemy one reveals us to
        // them, which is not something we'd be told about.
        if (m.team === uavBucket() && !currentMode().ffa) {
          showWaveBanner("FRIENDLY UAV OVERHEAD", 1500);
        }
      }
      break;

    case "carepackage":
      if (m.action === "marker" && !streakEntities.has(m.eid)) {
        // Their marker in flight, for show; the drop replaces it.
        const marker = new MarkerCanister({
          id: m.eid, world: droneWorld,
          origin: new THREE.Vector3(m.ox, m.oy, m.oz), dir: new THREE.Vector3(m.dx, m.dy, m.dz),
        });
        streakEntities.set(m.eid, marker);
        scene.add(marker.root);
      } else if (m.action === "drop" && !(streakEntities.get(m.eid) instanceof CarePackage)) {
        // Render their crate with the reward THEY rolled; never re-roll.
        spawnCarePackage({
          id: m.eid, x: m.x, z: m.z, groundY: typeof m.y === "number" ? m.y : null,
          reward: m.reward, owned: false, ownerTeam: m.team,
        });
      } else if (m.action === "claimed") {
        // Plays the same pop the opener saw; removed on "gone".
        streakEntities.get(m.eid)?.open();
      }
      break;

    case "drone":
      if (m.action === "launch" && !streakEntities.has(m.eid)) {
        // A copy that flies the same steering at the same target, launched
        // from where the caller's hand was. It hurts nobody here: the owner
        // reports the detonation and every hit.
        let pos;
        if (typeof m.x === "number") pos = new THREE.Vector3(m.x, m.y, m.z);
        else {
          const from = net.peers.get(m.id);
          const snap = from?.snaps?.[from.snaps.length - 1];
          pos = snap ? new THREE.Vector3(snap.x, snap.y + 1.4, snap.z) : move.pos.clone();
        }
        spawnDrone({ id: m.eid, targetId: m.target || null, owned: false, pos, yaw: m.yaw || 0, sky: !!m.sky, credit: m.credit || "drone" });
        if (m.target && m.target === net.id && performance.now() - (applyRemoteStreak.warnAt || 0) > 2500) {
          applyRemoteStreak.warnAt = performance.now();
          showWaveBanner(m.sky ? "SWARM DRONE ON YOU — MOVE" : "HUNTER-KILLER INBOUND — MOVE", 1800);
        }
      } else if (m.action === "retarget") {
        const d = streakEntities.get(m.eid);
        if (d) {
          d.targetId = m.target || null;
          d.frozen = false;
          if (m.target && m.target === net.id) showWaveBanner("HUNTER-KILLER INBOUND — MOVE", 1800);
        }
      } else if (m.action === "kill" || m.action === "expire") {
        const d = streakEntities.get(m.eid);
        if (d) {
          // Blow up where the caller's drone did, not wherever our copy got to.
          if (typeof m.x === "number") d.root.position.set(m.x, m.y, m.z);
          explosionFx({ kind: "lethal", glow: 0xffa23a, radius: DRONE_SPLASH_RADIUS }, d.root.position);
          streakBlast(d.root.position, m.action === "expire" ? 0.6 : 0.9);
          d.dispose();
          streakEntities.delete(m.eid);
        }
      }
      break;

    case "airstrike":
      // Only the show: the caller resolves the damage and every hit arrives
      // as an ordinary `hit` message. The run is a pure function of the
      // mark, so every client flies the same jet and drops the same bombs.
      if (m.action === "mark") {
        const runs = Array.isArray(m.runs) ? m.runs : [{ x: m.x, z: m.z, delay: m.delay }];
        for (const r of runs) {
          if (typeof r?.x !== "number" || typeof r?.z !== "number") continue;
          spawnAirstrike({ x: r.x, z: r.z, yaw: m.yaw || 0, owned: false, team: m.team, delay: r.delay || AIRSTRIKE_DELAY });
        }
      }
      break;

    case "heli":
      if (m.action === "spawn" && !streakEntities.has(m.eid)) {
        spawnHelicopter({ id: m.eid, seed: m.seed, owned: false, team: m.team });
      } else if (m.action === "despawn") {
        const h = streakEntities.get(m.eid);
        if (h) { h.dispose(); streakEntities.delete(m.eid); }
      }
      break;

    case "k9": {
      let pack = streakEntities.get(m.eid);
      if (m.action === "spawn" && !pack) {
        spawnK9({ id: m.eid, owned: false, team: m.team, ownerId: m.id, x: m.x, y: m.y, z: m.z, yaw: m.yaw || 0 });
        audio.whistle({ x: m.x, y: (m.y || 0) + 1.6, z: m.z });   // the handler calling them in
        if (currentMode().ffa || !net.team || m.team !== net.team) showWaveBanner("ENEMY K9 UNIT — WATCH YOUR BACK", 1800);
      } else if (m.action === "pos") {
        if (!pack && Array.isArray(m.d)) {
          // Joined mid-pack: start the copy from the first dog we're told about.
          const f = m.d.find(Array.isArray);
          if (f) pack = spawnK9({ id: m.eid, owned: false, team: m.team, ownerId: m.id, x: f[0] / 10, y: f[1] / 10, z: f[2] / 10 });
        }
        if (pack instanceof K9Pack && !pack.owned) pack.applySnapshot(m.d);
      } else if (m.action === "hit") {
        if (pack instanceof K9Pack && pack.owned) damageDog(pack, m.i | 0, +m.dmg || 0, m.by);
      } else if (m.action === "die") {
        if (pack instanceof K9Pack) pack.kill(m.i | 0);
        dogKilledBy(m.by);
      } else if (m.action === "end" && pack) {
        pack.dispose();
        streakEntities.delete(m.eid);
      }
      break;
    }

    case "dragonfire": {
      const df = streakEntities.get(m.eid);
      if (m.action === "spawn" && !df) {
        spawnDragonfire({ id: m.eid, owned: false, team: m.team, x: m.x, y: m.y, z: m.z, yaw: m.yaw || 0 });
        if (currentMode().ffa || !net.team || m.team !== net.team) showWaveBanner("ENEMY DRAGONFIRE INBOUND", 1800);
      } else if (df instanceof Dragonfire) {
        if (m.action === "pos") df.applySnapshot(m.x, m.y, m.z, m.yaw || 0, m.p || 0);
        else if (m.action === "shot") {
          df.shoot(new THREE.Vector3(m.x, m.y, m.z));
          if (Math.random() < 0.5) audio.shot(WEAPON_DEFS.bellow || WEAPON_DEFS.problem416, 0.3, df.pos);
        } else if (m.action === "end") { df.dispose(); streakEntities.delete(m.eid); }
      }
      break;
    }

    case "sam": {
      const sam = streakEntities.get(m.eid);
      if (m.action === "spawn" && !sam) {
        spawnSam({ id: m.eid, owned: false, team: m.team, x: m.x, y: m.y, z: m.z, yaw: m.yaw || 0 });
        if (currentMode().ffa || !net.team || m.team !== net.team) showWaveBanner("ENEMY SAM TURRET — AIR DEFENSES UP", 1800);
      } else if (sam instanceof SamTurret) {
        if (m.action === "launch") {
          sam.targetId = m.t || null;
          sam.spawnMissile(new THREE.Vector3(m.x, m.y, m.z), new THREE.Vector3(m.dx, m.dy, m.dz), m.t || null);
          const tp = airTargetPos(m.t);
          if (tp) sam.aimAt(tp, 10);
          audio.explosion?.(0.1, sam.pos);
        } else if (m.action === "end") { sam.dispose(); streakEntities.delete(m.eid); }
      }
      break;
    }

    case "air": {
      const e = streakEntities.get(m.eid);
      if (m.action === "hit" && e && e.owned) damageStreakEntity(e, +m.dmg || 0, m.by);
      else if (m.action === "hit" && !e) {
        const plane = flyovers.find((f) => f.eid === m.eid);
        if (plane) damageStreakEntity(plane, +m.dmg || 0, m.by, true);
      }
      else if (m.action === "down") shootDownAir(m.eid, m.by);
      break;
    }

    case "warship": {
      const ws = streakEntities.get(m.eid);
      if (m.action === "spawn" && !ws) spawnWarship({ id: m.eid, seed: m.seed, owned: false, team: m.team });
      else if (m.action === "shot" && ws instanceof VtolWarship && WARSHIP_GUNS[m.g]) {
        ws.shoot(m.g, new THREE.Vector3(m.x, m.y, m.z));
        if (m.g === "cannon") audio.explosion(0.2, ws.root.position);
        else if (Math.random() < 0.3) audio.shot(WEAPON_DEFS.bellow || WEAPON_DEFS.problem416, 0.3, ws.root.position);
      } else if (m.action === "leave" && ws instanceof VtolWarship) ws.duration = Math.min(ws.duration, ws.age);
      break;
    }

    case "callout":
      // Match-wide hype: the nuclear-tier badge and the big streaks arriving.
      // Purely cosmetic, never gameplay. A bot on our own side (its call
      // carries `team`) gets a quiet line, not the big red banner: with a
      // dozen bots calling things it was all you saw.
      if (m.team && !currentMode().ffa && m.team === net.team) {
        showWaveBanner(`${m.who || "Ally"}: ${m.label}`, 1100);
        break;
      }
      killstreakUi.banner({ title: `${m.who || "Someone"}: ${m.label}`, sub: m.label === "NUCLEAR" ? "Went nuclear" : "Scorestreak inbound", label: m.label === "NUCLEAR" ? "Nuclear" : "Streak", tone: "red" });
      killstreakUi.pulse();
      break;
  }
}

// -------------------- mode + networking --------------------

let modeId = "ops";
// Nothing is ticked on the Play tab until the player picks a mode (user
// call): Deploy waits for that choice. modeId keeps a real value underneath
// so everything that reads currentMode() before then still works.
let modePicked = false;
let matchesPlayed = 0;   // seeds the map-vote shortlist, so it changes each round
const teamScores = { phantom: 0, ghost: 0 };
const bots = new BotManager();
const BOT_TARGET = 8;      // participants a PvP room is padded up to

// Quickplay: everyone who leaves the room code untouched lands in the same
// public server for their mode, instead of each getting their own random
// room. Only overflow into a numbered shard (QTDM2, QTDM3, ...) once the
// base room is genuinely full of real people — see joinQuickplay().
const QUICKPLAY_BASE = { tdm: "QTDM", koth: "QKOH", oitc: "QOTC", gungame: "QGUN", snd: "QSND", infection: "QINF", royale: "QTRR" };
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
// Standing where a plant/defuse is possible. A pad has no E: D-pad right
// (its hold-to-interact button) plants and defuses here, and stops being a
// weapon-swap hold while it does.
let sndCanInteract = false;

const audio = new GameAudio();
const music = new GameMusic();
let suppressT = 0;

const animDebug = new AnimDebugLab();

// -------------------- settings + escape menu --------------------

const SETTINGS_KEY = "trollops:settings";
const settings = {
  volume: 50, sens: 100, fov: 78, invert: false, minimap: true, gloves: true, botSkill: "regular", aimAssist: true, thirdPerson: false,
  gfx: "auto", viewMode: false,
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
  set("to-set-gloves", settings.gloves);
  set("to-set-aimassist", settings.aimAssist);

  set("to-set-volume-lobby", settings.volume, "to-set-volume-lobby-out");
  set("to-set-sens-lobby", settings.sens, "to-set-sens-lobby-out", "%");
  set("to-set-fov-lobby", settings.fov, "to-set-fov-lobby-out", "°");
  set("to-set-invert-lobby", settings.invert);
  set("to-set-minimap-lobby", settings.minimap);
  set("to-set-gloves-lobby", settings.gloves);
  set("to-set-aimassist-lobby", settings.aimAssist);
  set("to-set-viewmode-lobby", settings.viewMode);
  renderViewModeRow();
  set("to-set-botskill", settings.botSkill);
  set("to-set-gfx", settings.gfx);
  set("to-set-gfx-lobby", settings.gfx);
  applyGraphics();
  // Takes effect for bots created from here on, so a change mid-match applies
  // as they respawn rather than rewriting the ones already in the fight.
  bots.difficulty = settings.botSkill;
  renderBotSkillNote();
}

/* -------------------- room bot skill --------------------
   Bots only ever run on ONE client, the bot host (net.isBotHost: whoever has
   been in the room longest, which is normally whoever started it), and it
   builds them with its own Bot skill setting. So the host's setting is the
   room's, and a joiner's own choice does nothing while someone else hosts.
   Every bot carries its tier on the wire (`bs`), so each client reads the
   room's skill off the bots themselves: the lobby says whose setting is in
   charge, and the veteran XP boost pays everyone in the room, not only the
   host. If the host leaves, the next-longest player takes the bots over and
   keeps the tier the room was playing at for the rest of that match
   (`roomSkillSeen`), instead of swapping to their own setting mid-fight. */
let roomSkillSeen = null;   // tier read off another host's bots this match
function roomBotSkill() {
  if (!net.active || net.isBotHost()) return bots.count ? bots.difficulty : null;
  const n = {};
  for (const p of net.peers.values()) if (p.botSkill) n[p.botSkill] = (n[p.botSkill] || 0) + 1;
  let best = null;
  for (const k in n) if (!best || n[k] > n[best]) best = k;
  return best;   // null: no bots in the room
}
const VETERAN_XP_BOOST = 0.1;   // +10% XP for a match played against veteran bots
function syncRoomBotSkill(dt) {
  if (net.active && !net.isBotHost()) {
    const seen = roomBotSkill();
    if (seen) roomSkillSeen = seen;
  } else if (net.active && roomSkillSeen) {
    bots.difficulty = roomSkillSeen;   // took the bots over mid-match
  }
  // Veteran time, for the XP boost: the boost pays once veteran bots have
  // been in the match for at least half of it, so a tier flipped in the
  // last minute doesn't earn it.
  if (gameState !== "playing" || isStaging()) return;
  player.matchT += dt;
  if (roomBotSkill() === "veteran") player.vetBotT += dt;
  renderBotSkillNote();
}
function veteranBoostOn() {
  return isPvp() && !isRange() && player.matchT > 0 && player.vetBotT >= player.matchT * 0.5;
}
/* XP as it's banked on the account: the veteran boost on top. */
function boostedXp(amount) {
  return veteranBoostOn() ? Math.round(amount * (1 + VETERAN_XP_BOOST)) : amount;
}
/* Lobby: under the Bot skill picker, say whose setting runs the room. */
let botSkillNoteText = null;
function renderBotSkillNote() {
  const el = document.getElementById("to-set-botskill-note");
  if (!el) return;
  let text = "Veteran bots: +10% XP";
  if (net.active && !net.isBotHost()) {
    const seen = roomBotSkill() || roomSkillSeen;
    text = seen
      ? `Host's bots: ${seen[0].toUpperCase() + seen.slice(1)}${seen === "veteran" ? " (+10% XP)" : ""}. Yours applies when you host.`
      : "The host's setting runs the bots. Yours applies when you host.";
  }
  if (text !== botSkillNoteText) { botSkillNoteText = text; el.textContent = text; }
}

function toggleThirdPerson() {
  settings.thirdPerson = !settings.thirdPerson;
  saveSettings();
}

/* Emotes: hold H for the wheel (emote-wheel.js), release on one to play
   it. The camera pulls out to third person for it, like any locker-room
   emote; moving, firing, dying or the clock running out ends it. The index
   rides the state packet (`em`) so everyone else sees it too. */
let emote = null;   // { idx, t, role } while the local player is emoting (role 1 = second half of a duo)
Object.assign(HAND_POSES, FP_HAND_POSES);   // point / L / flat, for the first-person emotes
const emoteWheel = new EmoteWheel(els.hud, (i) => {
  if (gameState !== "playing" || !player.alive) return;
  if (EMOTES[i].kind === "duo") { sendDuoInvite(i); return; }
  emote = { idx: i, t: 0, role: 0 };
});
function stopEmote() { emote = null; }
const emoteKind = () => (emote ? EMOTES[emote.idx]?.kind ?? null : null);
/* Third person and duo emotes pull the camera out; first person ones don't. */
const emoteIsTp = () => !!emote && emoteKind() !== "fp";
/* This frame's first-person emote: hand targets, gun, camera motion. */
const fpEmoteFrame = () => (emoteKind() === "fp" ? EMOTES[emote.idx].fp(emote.t) : null);
/* Nothing to play (a bad index off a hook or old save): no emote. */
function validEmote() { if (emote && !EMOTES[emote.idx]) emote = null; return emote; }

/* Duo emotes. Aim at a teammate (a real player, alive, in sight, within
   DUO_RANGE) with the wheel open and the duo slices light up. Picking one
   sends them an invite; they have INVITE_SECONDS to hold X (DUO_HOLD) to
   accept. The accepter works out where both stand (their midpoint, facing
   each other the emote's distance apart) and sends it back, so both
   clients snap to the same spots and start together. Teammates only. */
const DUO_RANGE = 10, DUO_BODY = 0.9, INVITE_SECONDS = 6, DUO_HOLD = 0.5;
let duoTarget = null;     // the teammate's RemotePlayer the crosshair is on
let duoOutgoing = null;   // { to, name, idx, until }
let duoIncoming = null;   // { from, name, idx, until, hold }
const _duoFwd = new THREE.Vector3(), _duoTo = new THREE.Vector3();
function findDuoTarget() {
  if (!isPvp() || !net.connected || currentMode().ffa || !net.team || !player.alive) return null;
  camera.getWorldDirection(_duoFwd);
  let best = null, bestA = Infinity;
  for (const rp of remotes.byId.values()) {
    const peer = rp.peer;
    if (!peer || isBotPeer(peer) || !rp.alive || peer.team !== net.team) continue;
    // On them: the crosshair line passes through their body (a column
    // DUO_BODY wide, feet to head), and nothing solid is in between.
    const hx = rp.pos.x - camera.position.x, hz = rp.pos.z - camera.position.z;
    const fh = Math.hypot(_duoFwd.x, _duoFwd.z);
    if (fh < 0.2) continue;   // looking straight up or down
    const along = (hx * _duoFwd.x + hz * _duoFwd.z) / fh;   // how far ahead they are
    if (along < 0.3 || along > DUO_RANGE) continue;
    const side = Math.abs(hx * _duoFwd.z - hz * _duoFwd.x) / fh;   // how far off to the side
    if (side > DUO_BODY / 2 || side >= bestA) continue;
    const yAt = camera.position.y + (_duoFwd.y / fh) * along;   // crosshair height at them
    if (yAt < rp.pos.y - 0.1 || yAt > rp.pos.y + 2.0) continue;
    _duoTo.set(rp.pos.x, rp.pos.y + 1.1, rp.pos.z);
    if (segmentBlocked(colliders, camera.position, _duoTo)) continue;
    best = rp; bestA = side;
  }
  return best;
}
function sendDuoInvite(idx) {
  const rp = duoTarget;
  if (!rp || !net.connected) return;
  net.send({ t: "duo", id: net.id, to: rp.netId, k: "invite", e: idx });
  duoOutgoing = { to: rp.netId, name: rp.peer?.name || "operator", idx, until: performance.now() + INVITE_SECONDS * 1000 };
}
function onDuoMessage(p, m) {
  const idx = m.e | 0;
  if (EMOTES[idx]?.kind !== "duo") return;
  if (m.k === "invite") {
    if (p.team !== net.team || currentMode().ffa) return;   // teammates only
    duoIncoming = { from: p.id, name: p.name || "operator", idx, until: performance.now() + INVITE_SECONDS * 1000, hold: 0 };
  } else if (m.k === "accept") {
    if (!duoOutgoing || duoOutgoing.to !== p.id || duoOutgoing.idx !== idx) return;
    duoOutgoing = null;
    if (!player.alive || gameState !== "playing") return;
    placeForDuo(m.mx, m.mz, m.dx, m.dz, idx, -1);
    emote = { idx, t: 0, role: 0 };
  }
}
/* Stand at the duo spot: `side` -1 is the inviter, +1 the accepter, along
   (dx, dz), which points from the inviter to the accepter. */
function placeForDuo(mx, mz, dx, dz, idx, side) {
  if (![mx, mz, dx, dz].every(Number.isFinite)) return;
  const half = (EMOTES[idx].dist || 1) / 2;
  const x = mx + dx * side * half, z = mz + dz * side * half;
  move.pos.x = x; move.pos.z = z;
  player.pos.x = x; player.pos.z = z;
  if (move.velocity) move.velocity.set(0, 0, 0);
  // Face the partner: the inviter looks along (dx, dz), the accepter back.
  const fx = -side * dx, fz = -side * dz;
  look.yaw = Math.atan2(-fx, -fz);
}
function acceptDuo() {
  const inv = duoIncoming;
  duoIncoming = null;
  const rp = remotes.byId.get(inv.from);
  if (!rp || !player.alive || gameState !== "playing") return;
  let dx = move.pos.x - rp.pos.x, dz = move.pos.z - rp.pos.z;
  const len = Math.hypot(dx, dz) || 1;
  dx /= len; dz /= len;
  const mx = (move.pos.x + rp.pos.x) / 2, mz = (move.pos.z + rp.pos.z) / 2;
  net.send({ t: "duo", id: net.id, to: inv.from, k: "accept", e: inv.idx, mx, mz, dx, dz });
  placeForDuo(mx, mz, dx, dz, inv.idx, 1);
  emote = { idx: inv.idx, t: 0, role: 1 };
}
const duoPromptEl = document.createElement("div");
duoPromptEl.className = "to-duo-prompt";
duoPromptEl.hidden = true;
duoPromptEl.setAttribute("role", "status");
duoPromptEl.innerHTML = "<i class=\"to-duo-ring\"></i><span></span>";
els.hud.appendChild(duoPromptEl);
/* Per frame: the wheel's duo target, the invite prompt and the X hold. */
function updateDuo(dt) {
  duoTarget = emoteWheel.isOpen ? findDuoTarget() : null;
  emoteWheel.setDuoTarget(duoTarget?.peer?.name || null);
  const now = performance.now();
  if (duoOutgoing && now > duoOutgoing.until) duoOutgoing = null;
  if (duoIncoming && (now > duoIncoming.until || !player.alive || gameState !== "playing")) duoIncoming = null;
  if (duoIncoming) {
    const holdingX = keys.has("KeyX") || (isTouch && touchState.swap);
    duoIncoming.hold = holdingX ? duoIncoming.hold + dt : Math.max(0, duoIncoming.hold - dt * 2);
    if (duoIncoming.hold >= DUO_HOLD) acceptDuo();
  }
  const text = duoIncoming
    ? `${duoIncoming.name} wants to ${EMOTES[duoIncoming.idx].name}: hold X`
    : duoOutgoing ? `${EMOTES[duoOutgoing.idx].name}: waiting for ${duoOutgoing.name}…` : "";
  duoPromptEl.hidden = !text;
  if (text) {
    duoPromptEl.querySelector("span").textContent = text;
    duoPromptEl.classList.toggle("is-incoming", !!duoIncoming);
    duoPromptEl.style.setProperty("--fill", String(duoIncoming ? Math.min(1, duoIncoming.hold / DUO_HOLD) : 0));
  }
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
  bindCheck("to-set-gloves", "gloves");
  bindCheck("to-set-aimassist", "aimAssist");

  bindRange("to-set-volume-lobby", "volume", "to-set-volume-lobby-out");
  bindRange("to-set-sens-lobby", "sens", "to-set-sens-lobby-out", "%");
  bindRange("to-set-fov-lobby", "fov", "to-set-fov-lobby-out", "°");
  bindCheck("to-set-invert-lobby", "invert");
  bindCheck("to-set-minimap-lobby", "minimap");
  bindCheck("to-set-gloves-lobby", "gloves");
  bindCheck("to-set-aimassist-lobby", "aimAssist");
  bindCheck("to-set-viewmode-lobby", "viewMode");
  bindSelect("to-set-botskill", "botSkill");
  bindSelect("to-set-gfx", "gfx");
  bindSelect("to-set-gfx-lobby", "gfx");

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
    else openPauseMenu();
  });
}

// In-game radio widget — a separate playlist from Troll Radio, usable from
// the lobby and carried straight through into the match (see music.js).
function initRadioWidget() {
  const toggle = document.getElementById("to-radio-toggle");
  const panel = document.getElementById("to-radio-panel");
  const titleEl = document.getElementById("to-radio-title");
  const artistEl = document.getElementById("to-radio-artist");
  const playBtn = document.getElementById("to-radio-play");
  const prevBtn = document.getElementById("to-radio-prev");
  const nextBtn = document.getElementById("to-radio-next");
  const shuffleBtn = document.getElementById("to-radio-shuffle");
  const volume = document.getElementById("to-radio-volume");
  if (!toggle || !panel) return;

  const repaint = () => {
    const t = music.current;
    titleEl.textContent = t ? t.title : (music.hasTracks ? "—" : "No tracks loaded");
    artistEl.textContent = t ? t.artist : "";
    playBtn.textContent = music.playing ? "⏸" : "▶";
    playBtn.setAttribute("aria-label", music.playing ? "Pause" : "Play");
    shuffleBtn.classList.toggle("is-active", music.shuffle);
    shuffleBtn.setAttribute("aria-pressed", String(music.shuffle));
  };
  music.onchange = repaint;

  toggle.addEventListener("click", () => {
    const open = panel.hidden;
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
  });
  playBtn.addEventListener("click", () => music.toggle());
  prevBtn.addEventListener("click", () => music.prev());
  nextBtn.addEventListener("click", () => music.next());
  shuffleBtn.addEventListener("click", () => music.setShuffle(!music.shuffle));
  volume.value = Math.round(music.volume * 100);
  volume.addEventListener("input", () => music.setVolume(volume.value / 100));

  if (!music.hasTracks) {
    playBtn.disabled = true;
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    shuffleBtn.disabled = true;
  }

  repaint();

  // Music is opt-in: nothing plays until the player hits Play. Whatever state
  // they leave it in on the menu (playing or paused) carries into the match.
}

document.getElementById("to-menu-roster")?.addEventListener("click", (e) => {
  const b = e.target.closest("[data-uid]");
  if (b) openPlayerProfile(b.dataset.uid);
});

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
function isView() { return !!currentMode().view; }
/* View mode is the owner's alone (user: "only for troll_runner"): the
   setting row only shows, and only takes effect, on that account. */
function isTrollRunner() {
  return String(window.TrollrunnerAccounts?.getCachedProfile?.()?.username || "").toLowerCase() === "troll_runner";
}
function viewModeOn() { return !!settings.viewMode && isTrollRunner(); }
function renderViewModeRow() {
  const row = document.getElementById("to-set-viewmode-row");
  if (row) row.hidden = !isTrollRunner();
  const note = document.getElementById("to-set-viewmode-note");
  if (note) note.hidden = !viewModeOn();
}
let viewPrevMode = null;   // the mode the lobby had before Deploy swapped in View mode
function isSnd() { return !!currentMode().rounds; }
function isInfection() { return !!currentMode().infection; }
function isRoyale() { return !!currentMode().royale; }
/* Participants a PvP room is padded up to with bots. */
function botTarget() { return isRoyale() ? (builtMap?.map?.royale?.players || ROYALE.players) : BOT_TARGET; }
/* Infection plays on the two ordinary sides: Phantoms are the survivors,
   Ghosts the infected. */
function isInfected() { return isInfection() && net.team === "ghost"; }
function teamName(team) {
  if (isInfection()) return team === "ghost" ? "Infected" : "Survivors";
  return TEAMS[team]?.name;
}
let zdir = null;
let rangeSet = null;
function isBotPeer(p) { return p.isBot || isSyntheticId(p.id); }

/* Where the real people are looking from (us: the camera, so a spectator
   counts where they watch), for the bots' level of detail. */
const _humanEyes = [];
function humanEyes() {
  _humanEyes.length = 0;
  _humanEyes.push(camera.position);
  for (const rp of remotes.byId.values()) {
    if (rp.alive && !isBotPeer(rp.peer)) _humanEyes.push(rp.pos);
  }
  return _humanEyes;
}

/* Real people in the room, and how they're split — what the bots pad out. */
function humanHeadcount() {
  const teams = { phantom: 0, ghost: 0 };
  let humans = 1;
  if (net.team in teams) teams[net.team]++;
  for (const p of net.peers.values()) {
    if (isBotPeer(p)) continue;
    humans++;
    if (p.team in teams) teams[p.team]++;
  }
  return { humans, teams };
}

/* Any OTHER real (non-bot) person currently connected to this match. When
   true, pausing must stay local-only — this client's own net feed, bots
   (this client may be the bot host, publishing them for the whole room)
   and incoming bullets keep simulating so nobody else's match freezes
   because one operator opened their menu. */
function otherHumansInMatch() {
  if (!net.connected) return false;
  for (const p of net.peers.values()) if (!isBotPeer(p)) return true;
  return false;
}

/* The Play tab's mode list: versus modes first, then the solo ones, each a
   full-width row with a tick on the one you're deploying into. */
const MODE_GROUPS = [
  { label: "Versus", ids: ["tdm", "koth", "snd", "infection", "oitc", "gungame"] },
  { label: "Solo", ids: ["ops", "zombies", "range"] },
];
const TICK_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

function buildModeButtons() {
  els.loMode.innerHTML = "";
  // Anything added to modes.js later still shows up, under Versus or Solo.
  const placed = new Set(MODE_GROUPS.flatMap((g) => g.ids));
  const groups = MODE_GROUPS.map((g) => ({ ...g, ids: g.ids.filter((id) => MODES[id]) }));
  for (const id of MODE_IDS) {
    if (!placed.has(id) && !MODES[id].hidden) groups[MODES[id].pvp ? 0 : 1].ids.push(id);
  }
  for (const g of groups) {
    const head = document.createElement("div");
    head.className = "to-lo-modegroup";
    head.textContent = g.label;
    els.loMode.appendChild(head);
    for (const id of g.ids) {
      const m = MODES[id];
      const b = document.createElement("button");
      b.type = "button";
      b.className = "to-lo-modebtn";
      b.dataset.mode = id;
      b.title = m.blurb;
      const name = document.createElement("span");
      name.textContent = m.name;
      b.appendChild(name);
      b.insertAdjacentHTML("beforeend", TICK_SVG);
      b.addEventListener("click", () => { modeId = id; modePicked = true; renderModes(); });
      els.loMode.appendChild(b);
    }
  }
  renderModes();
}

/* The mode description is the one optional thing in the mode column: drop
   it when the column is too short for it, so the mode buttons always fit
   with no scrollbar (the column stops above the map card). */
const modeColumn = els.loMode.closest(".to-pf-modes");
function fitModeBlurb() {
  if (!modeColumn) return;
  els.loModeBlurb.hidden = false;
  if (modeColumn.scrollHeight > modeColumn.clientHeight + 1) els.loModeBlurb.hidden = true;
}
if (modeColumn && "ResizeObserver" in window) new ResizeObserver(fitModeBlurb).observe(modeColumn);

function renderModes() {
  for (const b of els.loMode.children) {
    if (!b.dataset.mode) continue;
    const on = modePicked && b.dataset.mode === modeId;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-pressed", String(on));
  }
  els.loModeBlurb.textContent = modePicked ? currentMode().blurb : "Pick a mode to deploy.";
  els.startBtn.disabled = !modePicked;
  fitModeBlurb();
  // On phones the list is one sideways-scrolling row of chips; keep the
  // picked one in view.
  const act = els.loMode.querySelector(".to-lo-modebtn.is-active");
  if (act && els.loMode.scrollWidth > els.loMode.clientWidth) {
    const box = els.loMode.getBoundingClientRect();
    const r = act.getBoundingClientRect();
    if (r.left < box.left || r.right > box.right) {
      els.loMode.scrollLeft += r.left - box.left - 16;
    }
  }
  els.loPvp.hidden = !modePicked || !isPvp();
  const soloNote = document.getElementById("to-pf-solo-note");
  if (soloNote) soloNote.hidden = !modePicked || isPvp();

  // Scorestreaks are versus-only, and Gun Game / One in the Chamber opt out
  // (see modes.js noStreaks). The picker stays reachable either way so the
  // note can explain why it's empty, rather than the tab vanishing. Until a
  // mode is picked (phones start with none) the picker shows: the streaks
  // you choose carry into any versus match.
  const allowed = !modePicked || streaksAllowed(currentMode());
  const ssPanelNote = document.getElementById("to-ss-note");
  const ssSoloNote = document.getElementById("to-ss-solo-note");
  if (ssPanelNote) ssPanelNote.hidden = !allowed;
  if (ssSoloNote) ssSoloNote.hidden = allowed;
  if (els.ssPicker) els.ssPicker.hidden = !allowed;
  // Zombies and the range bring their own map, so the card just names it.
  loadout.setForcedMap(currentMode().forceMap || null);
  loadout.setMapPool(currentMode().mapPool || null);
  renderLobbyRoster();   // no-ops until the lobby is ready
  if (lobbyReady) refreshLobbyMap();
}

// -------------------- lobby chrome --------------------
// The tab bar across the top swaps what's under it. "deploy" is the Play
// tab (mode list, map card, Deploy); the rest open one panel each.
// Loadout and Customize share the Loadout tab.

const LOBBY_PANELS = ["deploy", "loadout", "customize", "gear", "cosmetics", "streaks", "server", "controls"];
const TAB_FOR_PANEL = { customize: "loadout" };
const pfRoot = document.getElementById("to-pf");
// Tabs, the Loadout/Customize switch and the loadout card's Edit link.
const railButtons = [...document.querySelectorAll("#to-pf [data-panel]")];

const gunView = document.getElementById("to-gun-view");
const gunCanvas = document.getElementById("to-gun-canvas");
const inspector = gunCanvas ? new WeaponInspector(gunCanvas) : null;

// The Play tab's loadout card previews the primary too, rebuilt only when
// the weapon, its attachments or its skin change.
const sumCanvas = document.getElementById("to-pf-sum-canvas");
const sumInspector = sumCanvas ? new WeaponInspector(sumCanvas, { thumb: true }) : null;
let sumGunKey = null;
function showSumGun() {
  const def = loadout.resolved;
  const key = def ? `${def.id}:${JSON.stringify(def.attachments || {})}` : null;
  if (!sumInspector || !def || key === sumGunKey) return;
  sumGunKey = key;
  sumInspector.show(def);
}
showSumGun();
let inspectorLive = false;

const charView = document.getElementById("to-char-view");
const charCanvas = document.getElementById("to-char-canvas");
const charInspector = charCanvas ? new CharacterInspector(charCanvas) : null;
/* Cosmetics (cosmetics.js): the face you wear, on the menu operator, your
   own body in matches, and everyone else's view of you (`fc`). */
const cosmetics = new CosmeticsPanel(document.getElementById("to-cos-body"), (face) => applyOwnFace(face));
function applyOwnFace(face) {
  if (charInspector) charInspector.humanoid.face = face;
  localRig.face = face;   // only ever called on a pick, long after localRig exists
}
if (charInspector) charInspector.humanoid.face = cosmetics.face;
let charInspectorLive = false;
// The operator on the main menu carries your equipped primary.
charInspector?.setWeapon(loadout.resolved);

/* One inspector, three panels that want to show it. Weapon Loadout keeps it
   boxed inside its detail card (to-gun-mount-loadout); Customize and Gear
   pull it out to the free-floating hero spot the operator viewer uses on
   Match Setup instead — the weapon stands in for the operator there. */
const pfCenter = document.getElementById("to-pf-center")?.parentElement || null; // .to-pf
function mountGunView(panel) {
  // Beside the panel on desktop; phones have no room beside it, so there the
  // Weapons view keeps it boxed in its detail card.
  const narrow = (pfCenter?.clientWidth || 0) <= 760;
  const boxMount = panel === "loadout" && narrow ? document.getElementById("to-gun-mount-loadout") : null;
  const target = boxMount || pfCenter;
  inspectorLive = !!(gunView && target);
  if (!inspectorLive) return;
  gunView.classList.toggle("is-hero", !boxMount);
  if (gunView.parentElement !== target) target.appendChild(gunView);
  gunView.style.display = "";
}

/* Unlike the gun view, the operator locker viewer isn't nested inside a
   per-panel box — it's a free-floating hero shot over the whole lobby
   (see .to-char-view), so showing it for a panel is just an on/off flag. */
function mountCharView(panel) {
  charInspectorLive = !!(charView && (panel === "deploy" || panel === "cosmetics"));
  if (charView) charView.style.display = charInspectorLive ? "" : "none";
  if (!charInspectorLive) menuEmoteWheel?.close(true);
}

/* Emoting in the main menu (user): the same wheel as in a match, played by
   the operator on Match Setup. H / L3 + R3 together / the Emote button open it. */
const menuEmoteWheel = charView && els.title ? new EmoteWheel(els.title, (i) => charInspector?.playEmote(i)) : null;
menuEmoteWheel?.el.classList.add("is-menu");
const menuEmoteBtn = document.getElementById("to-char-emote");
menuEmoteBtn?.addEventListener("click", () => {
  menuEmoteWheel?.toggle(charInspectorLive && gameState === "menu");
  menuEmoteBtn.setAttribute("aria-expanded", String(!!menuEmoteWheel?.isOpen));
});
// Pad in the menu: both sticks clicked together (or the emote button set on
// the controller card) opens, the right stick points, Cross/A plays, Circle/B closes.
let gpMenuEmotePrev = {};
function pollMenuEmotePad() {
  const w = menuEmoteWheel;
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = w && charInspectorLive ? Array.from(pads).find((p) => p && p.connected) : null;
  if (!gp) { gpMenuEmotePrev = {}; return; }
  const b = (i) => !!gp.buttons[i]?.pressed, edge = (i) => b(i) && !gpMenuEmotePrev[i];
  if (padEmotePressed(gp, edge) || (b(10) && b(11) && (edge(10) || edge(11)))) w.toggle();
  if (w.isOpen) {
    w.aim(gp.axes[2] || 0, gp.axes[3] || 0);
    if (edge(0)) w.close();
    else if (edge(1)) w.close(true);
  }
  gpMenuEmotePrev = {};
  for (let i = 0; i < gp.buttons.length; i++) gpMenuEmotePrev[i] = b(i);
}

// "deploy" (Match Setup) is the panel left un-hidden in the HTML, so it's
// what a player sees first without any click - nothing else calls
// showLobbyPanel("deploy") on first load, so the locker view has to be
// shown here or it stays hidden until the player clicks away and back.
mountCharView("deploy");

// Which panel is currently open, or `null` when every panel is collapsed —
// clicking the already-active rail button toggles it closed instead of
// forcing some other tab to take its place.
let activeLobbyPanel = "deploy";

function showLobbyPanel(name) {
  activeLobbyPanel = name;
  if (pfRoot) pfRoot.dataset.panel = name || "";
  if (els.title) els.title.dataset.panel = name || "";
  for (const id of LOBBY_PANELS) {
    const panel = document.getElementById(`to-pfp-${id}`);
    if (panel) panel.hidden = id !== name;
  }
  const tabName = TAB_FOR_PANEL[name] || name;
  for (const b of railButtons) {
    // Top tabs light up for their whole group; the switch and Edit link
    // only for their exact panel.
    const on = b.classList.contains("to-pf-tab") ? b.dataset.panel === tabName : b.dataset.panel === name;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-pressed", String(on));
  }
  if (name !== "deploy") closeMapDrawer(false);
  // The map card's thumbnail can only measure itself once it is on screen.
  if (name === "deploy") loadout.drawMapCard();

  if (name === "loadout" || name === "customize") {
    mountGunView(name);
    inspector?.show(loadout.resolvedActive);
  } else if (name === "gear") {
    mountGunView(name);
    inspector?.show(loadout.melee);
  } else if (name === "streaks") {
    mountGunView(name);
    inspector?.showStreak(streakPicker.selected.at(-1) || "uav");
  } else {
    inspectorLive = false;
    if (gunView) gunView.style.display = "none";
  }

  if (name === "deploy" || name === "cosmetics") {
    mountCharView(name);
  } else {
    charInspectorLive = false;
    if (charView) charView.style.display = "none";
    menuEmoteWheel?.close(true);
  }
}

for (const b of railButtons) {
  b.addEventListener("click", () => showLobbyPanel(b.dataset.panel));
}
if (pfRoot) pfRoot.dataset.panel = activeLobbyPanel;
if (els.title) els.title.dataset.panel = activeLobbyPanel;

/* Map picker: "Change" on the map card slides it in from the right. Picking
   a map applies straight away (loadout.js), Done or Esc just closes it. */
const mapDrawer = document.getElementById("to-map-drawer");
const mapScrim = document.getElementById("to-map-scrim");
const mapChange = document.getElementById("to-pf-mapcard-change");

function openMapDrawer() {
  if (!mapDrawer) return;
  mapDrawer.hidden = false;
  if (mapScrim) mapScrim.hidden = false;
  els.title?.classList.add("has-drawer");
  mapChange?.setAttribute("aria-expanded", "true");
  loadout.drawMapThumbs();
  (mapDrawer.querySelector(".to-lo-map.is-active") || mapDrawer.querySelector("button"))?.focus();
}

function closeMapDrawer(returnFocus = true) {
  if (!mapDrawer || mapDrawer.hidden) return;
  mapDrawer.hidden = true;
  if (mapScrim) mapScrim.hidden = true;
  els.title?.classList.remove("has-drawer");
  mapChange?.setAttribute("aria-expanded", "false");
  if (returnFocus) mapChange?.focus();
}

mapChange?.addEventListener("click", openMapDrawer);
mapScrim?.addEventListener("click", () => closeMapDrawer());
document.getElementById("to-map-close")?.addEventListener("click", () => closeMapDrawer());
document.getElementById("to-map-done")?.addEventListener("click", () => closeMapDrawer());
mapDrawer?.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { e.stopPropagation(); closeMapDrawer(); }
});

// `net` is constructed further down this module, so nothing may paint the
// roster until initLobbyChrome() runs at the end of setup.
let lobbyReady = false;

function renderLobbyRoster() {
  const box = document.getElementById("to-pf-roster");
  if (!box || !lobbyReady) return;

  const rows = [{ name: playerName(), state: "READY", you: true, uid: playerUid() }];
  if (isPvp() && net.connected) {
    for (const p of net.peers.values()) {
      rows.push({ name: p.name, state: isBotPeer(p) ? "BOT" : "IN ROOM", uid: safeUid(p.uid) });
    }
  }

  box.innerHTML = "";
  for (const row of rows) {
    const el = document.createElement("div");
    el.className = row.you ? "to-pf-op is-you" : "to-pf-op is-idle";
    const box2 = document.createElement("i");
    const name = document.createElement(row.uid ? "button" : "span");
    name.textContent = row.name;
    if (row.uid) {
      name.type = "button";
      name.className = "to-pf-op-name";
      name.title = `View ${row.name}'s profile`;
      name.addEventListener("click", () => openPlayerProfile(row.uid));
    }
    const state = document.createElement("b");
    state.textContent = row.state;
    el.append(box2, name, state);
    box.appendChild(el);
  }

  if (rows.length === 1) {
    const note = document.createElement("p");
    note.className = "to-pf-empty";
    note.textContent = isPvp()
      ? (noBotsRoom()
          ? "No bots room — just you until you share the code above."
          : roomIsCustom
            ? "No one else in the room yet — share the code."
            : "No one else has deployed into this mode yet. Anyone who hits Deploy lands here with you.")
      : "Solo drop. No other operators.";
    box.appendChild(note);
  }
}

/* The lobby header's profile button: your whole site profile (avatar,
   banner, level, friends, settings), or the sign-in when signed out. */
function renderProfileBtn() {
  const btn = document.getElementById("to-pf-profile");
  if (!btn) return;
  const profile = window.TrollrunnerAccounts?.getCachedProfile?.();
  btn.querySelector("span").textContent = profile?.username || "Sign in";
  const img = btn.querySelector("img");
  img.hidden = !profile?.avatarUrl;
  if (profile?.avatarUrl) img.src = profile.avatarUrl;
  const svg = btn.querySelector("svg");
  if (svg) svg.style.display = profile?.avatarUrl ? "none" : "";
  const label = profile?.username ? `Your profile (${profile.username})` : "Sign in";
  btn.title = label;
  btn.setAttribute("aria-label", label);
}
renderProfileBtn();
document.getElementById("to-pf-profile")?.addEventListener("click", () => {
  const acc = window.TrollrunnerAccounts;
  if (acc?.getCachedProfile?.()) acc.openProfile?.();
  else if (acc?.openLogin) acc.openLogin("login");
  else acc?.openProfile?.();
});

function renderCallsign() {
  const el = document.getElementById("to-pf-callsign");
  if (el) el.textContent = `Signed in as ${playerName()}`;
}

// The profile arrives after the accounts script signs in, so redraw then --
// the level shown is the account level, and any XP queued while signed out
// gets credited now.
window.addEventListener("trollrunner:auth-changed", () => {
  renderCallsign();
  renderViewModeRow();
  renderProfileBtn();
  renderLobbyRoster();
  // Picks locked by the guest level at page load come back now that the
  // account level is known (phones: the profile often lands after the lobby).
  if (!loadout.restoreSaved()) loadout.render();
  streakPicker.restore();
  void syncXp()?.then(() => loadout.render());
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

/* "No bots" — walk a map alone without a match happening around you. Ticking
   it alone is enough to get a private room (auto-generates a code exactly
   like clicking "Private room", if one isn't already set) — you only need
   to hand the code to anyone if you actually want them to join you. */
function noBotsRoom() { return !!els.noBots?.checked; }
els.noBots?.addEventListener("change", () => {
  if (els.noBots.checked && !els.room.value) {
    els.room.value = makeRoomCode();
    roomIsCustom = true;
  }
});

/* Enemy id -> when they last killed a teammate, for the Avenger medal. */
const recentTeamKillers = new Map();
const AVENGER_WINDOW = 5000;   // ms

function registerDeath(victimName, killerId, weaponId, opts = {}) {
  const mode = currentMode();
  const iDied = opts.victimIsMe;
  const killerTeam = killerId === net.id ? net.team : (net.peers.get(killerId)?.team || bots.byId(killerId)?.team);
  // Your own frag, and the Hunter-Killer's warhead catching a teammate,
  // both used to pay out as a kill — XP, streak, a point for the team.
  // Neither earns anything now; the feed still reports them honestly.
  const suicide = !killerId || (iDied && killerId === net.id) || (opts.victimId && opts.victimId === killerId);
  const teamkill = !suicide && !mode.ffa && !!killerTeam && killerTeam === opts.victimTeam;
  const iKilled = killerId === net.id && !suicide && !teamkill;
  const killer = killerId === net.id ? "You" : nameFor(killerId);

  pushKillfeed({
    killer: suicide ? victimName : killer,
    killerIsBot: killerId !== net.id && !!bots.byId(killerId),
    victim: victimName,
    victimIsBot: !!opts.victimIsBot,
    weapon: suicide ? (weaponNameFor(weaponId) || "self") : weaponNameFor(weaponId),
    tag: teamkill ? "teamkill" : null,
    head: !!opts.head && !suicide,
    killerTeam: suicide ? opts.victimTeam : killerTeam,
    victimTeam: opts.victimTeam,
    mine: killerId === net.id || iDied,
    suicide,
  });

  // A bot we host got a kill: its scorestreak meter, like ours.
  const killerBot = !suicide && !teamkill && killerId !== net.id ? bots.byId(killerId) : null;
  if (killerBot) botEarn(killerBot, SCORE.kill);

  if (iKilled) {
    player.kills++;
    player.streak++;
    if (opts.head) player.headshots++;
    audio.kill();
    els.hudKills.textContent = String(player.kills);

    // XP lands per kill, not in a lump at the end — the immediate feedback
    // is most of what makes the grind feel like progress.
    awardKillXp();
    announceStreak(player.streak);
    awardScore(SCORE.kill);

    // Badges are a second layer over announceStreak's banner: that tracks
    // kills-without-dying, this one tracks kills-close-together, and BO2
    // calls out both.
    const called = killstreakUi.onKill({
      head: !!opts.head, streak: player.streak, distance: opts.distance || 0,
    });
    // Ordinary badges stay local; the top of the ladder is a match-wide
    // moment, so it goes on the wire.
    if (called.nuclear && net.active) {
      net.publishStreak({ kind: "callout", label: "NUCLEAR", who: net.name });
    }
    // Avenger: the one who just dropped a teammate (Revenge is your own
    // killer; the achievements layer has that one).
    const avengedAt = opts.victimId && recentTeamKillers.get(opts.victimId);
    if (avengedAt && performance.now() - avengedAt <= AVENGER_WINDOW) {
      recentTeamKillers.delete(opts.victimId);
      killstreakUi.medal("Avenger");
    }
    achievements.onKill({
      victimId: killerId === net.id ? opts.victimId : null,
      victimStreak: opts.victimStreak || 0,
      distance: opts.distance || 0,
      lastKilledBy: player.lastKilledBy,
    });

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

  // First Blood is a match-wide fact, so a peer's kill closes it for us too.
  if (!iKilled && !suicide && !teamkill) achievements.noteKillByOther();

  // An enemy just dropped one of ours: killing them soon after is Avenger.
  if (!mode.ffa && !iDied && !suicide && !teamkill && killerId && killerId !== net.id
      && opts.victimTeam && opts.victimTeam === net.team) {
    recentTeamKillers.set(killerId, performance.now());
  }
  // BO2 shows it and scores nothing; medals.js pays Suicide 0.
  if (iDied && suicide && isPvp()) killstreakUi.medal("Suicide");

  // S&D scores round wins, not kills — sndRoundWin() owns teamScores and the
  // match-end check there instead, once the round itself is decided.
  if (!isSnd() && !suicide && !teamkill && killerTeam && teamScores[killerTeam] != null) {
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

function awardKillXp() {
  // The headshot bonus is the Headshot medal's +50 now (medals.js), so the
  // total is unchanged; this pop is just the kill.
  addMatchXp(XP.kill, "KILL");
}

/* Pay into the scorestreak meter. Separate from XP on purpose: XP is
   permanent and unlocks weapons, this is per-life and buys streaks. A kill
   pays into both, which is why every call site here sits next to an
   addMatchXp call. */
function awardScore(amount) {
  if (!streaksAllowed(currentMode())) return;
  for (const id of streaks.addScore(amount)) {
    selectedStreak = id;   // newest earned, like BO2's default pick
    killstreakUi.banner({
      title: `${STREAK_DEFS[id].name} ready`,
      sub: isTouch ? "Tap it to call it in" : `Press ${streakKeyLabel(id)} to call it in`,
      iconSvg: streakIconSvg(id),
      tone: STREAK_DEFS[id].badge === "red" ? "red" : "gold",
    });
    audio.wave();
  }
  updateStreakHud();
}

const STREAK_RUNGS = new Set([3, 5, 7, 10]);

function announceStreak(n) {
  player.bestStreak = Math.max(player.bestStreak, n);
  if (!STREAK_RUNGS.has(n)) return;
  // A star medal on the splash (medals.js); its sting replaces the old
  // wave-banner chime.
  killstreakUi.medal(`${n} Kill Streak`);
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

/* How far away each target was when we last hit it. A peer applies its own
   damage and announces its own death, so by the time we learn we killed
   someone the shot is long gone — this is the only place the range survives,
   and Longshot needs it. */
const lastHitRange = new Map();   // victim id -> metres

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
  awardScore(SCORE.assist);
  pushKillfeed({ killer: "You", victim: victimName, assist: true, mine: true });
}

function checkMatchEnd() {
  const mode = currentMode();
  if (!mode.pvp || gameState !== "playing") return;
  const args = {
    teamScores,
    selfScore: player.kills,
    selfName: "You",
    peers: [...net.peers.values()],
  };
  const winner = matchWinner(mode, args);
  if (winner) { endMatch(winner); return; }
  if (mode.timeLimit && matchClockT !== null && matchClockT <= 0) {
    endMatch(matchWinnerOnTimeout(mode, args));
  }
}

function updateTeamHud() {
  els.scorePhantom.textContent = String(teamScores.phantom);
  els.scoreGhost.textContent = String(teamScores.ghost);
  // How far behind we ever got, for Comeback. Free-for-all has no side to be
  // behind, so it only tracks in team modes.
  if (!currentMode().ffa && net.team) {
    const mine = teamScores[net.team] || 0;
    const theirs = net.team === "phantom" ? teamScores.ghost : teamScores.phantom;
    achievements.noteScores(mine, theirs);
  }
}

/* Match clock: counts down once a timed PvP mode goes live, independent of
   the staging countdown. `null` means this mode has no clock at all, so the
   HUD element stays hidden rather than showing a stray "0:00". */
let matchClockT = null;
let matchClockShown = -1;

function resetMatchClock() {
  const mode = currentMode();
  matchClockT = mode.pvp && mode.timeLimit ? mode.timeLimit : null;
  matchClockShown = -1;
  els.hudMatchClock.hidden = matchClockT === null;
  if (matchClockT !== null) paintMatchClock();
}

function paintMatchClock() {
  const whole = Math.max(0, Math.ceil(matchClockT));
  if (whole === matchClockShown) return;
  matchClockShown = whole;
  const mins = Math.floor(whole / 60), secs = whole % 60;
  els.hudMatchClock.textContent = `${mins}:${String(secs).padStart(2, "0")}`;
}

function updateMatchClock(dt) {
  if (matchClockT === null) return;
  if (isInfection() && !infectionStarted) return;   // the clock starts with the first infection
  matchClockT = Math.max(0, matchClockT - dt);
  paintMatchClock();
  if (matchClockT <= 0) checkMatchEnd();
}

const net = new Net({
  // Bots filling the room isn't news; only announce real people.
  onJoin: (p) => { if (!isBotPeer(p)) pushKillfeed(`${p.name} joined`); },
  // Someone arrived after the sky lobby: the host tells them where the
  // Royale is (the lobby's own clock only goes out while it runs).
  onHello: (p) => {
    if (!royale?.drop || gameState !== "playing" || isStaging() || isBotPeer(p) || !net.isBotHost()) return;
    const d = royale.drop;
    net.publishRoyaleCatchUp(p.id, royale.seed, d.phase === "bus" ? d.busT : ROYALE_BUS_GONE, royale.t, royale.live);
  },
  onLeave: (p) => { if (!isBotPeer(p)) pushKillfeed(`${p.name} left`); },
  // `hd` has always been on the wire; we just never read it.
  onHitTaken: (m) => damagePlayer(m.dmg, m.id, m.w, !!m.hd),
  // Someone else hit someone else: show the victim flinch here too.
  onHitSeen: (m) => { if (m.id !== net.id && m.target !== net.id) flinchPeer(m.target, m.id, !!m.hd); },
  onPeerDied: (p, m) => {
    const snap = p.snaps?.[p.snaps.length - 1];
    registerDeath(p.name, m.by, m.w, {
      head: !!m.hd, victimTeam: p.team,
      victimPos: snap ? new THREE.Vector3(snap.x, snap.y, snap.z) : null,
      victimWeaponId: p.weapon,
      // `sk` is the victim's own streak, which only they were tracking —
      // Shutdown needs it and can't derive it.
      victimId: p.id, victimStreak: m.sk | 0,
      distance: lastHitRange.get(p.id) || 0,
    });
    lastHitRange.delete(p.id);
    if (m.by !== net.id) creditAssistIfOwed(p.id, p.name);
  },
  onStreak: (m) => applyRemoteStreak(m),
  onDuo: (p, m) => onDuoMessage(p, m),
  onInfect: (m) => applyInfect(m.ids || []),
  onNade: (m) => applyRemoteNade(m),
  onDeflect: (p, m) => onRemoteDeflect(p, m),
  onLoot: (p, m) => onRoyaleLoot(p, m),
  onVote: () => { if (intermissionT > 0) renderVote(); },
  onChat: (p, m) => chat.receive(p, m),
  /* Adopt the owner's countdown rather than running our own, so two clients
     that started a fraction of a second apart still hit zero together. We
     only ever take a *shorter* remaining time: a late "6" arriving after we
     are down to 2 must not push us back up the clock. */
  onStage: (m) => {
    // Troll Royale catch-up (we joined after the sky lobby): kept until our
    // own Royale is set up, which can be after this lands.
    if (m.bt != null) { royaleCatchUp = { ...m, at: performance.now() }; applyRoyaleCatchUp(); return; }
    if (gameState !== "playing" || !isPvp()) return;
    // Troll Royale: the owner's seed wins, so everyone has the same zone
    // and loot even if their match counts drifted apart.
    if (royale && isStaging() && m.sd && (m.sd >>> 0) !== royale.seed) setupRoyale(m.sd >>> 0);
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
      // Someone else's progress. It used to write into our own hold-E bar,
      // which updateSnd hid again the very next frame — so nobody ever saw
      // it. It goes in the status line instead.
      if (m.action === "plant" || m.action === "defuse") noteRemoteBombAct(m.action, m.site || bomb.site);
      return;
    }
    switch (m.action) {
      // Round number and attack side are never taken from the wire: every
      // client reaches the same round/side by independently seeing the same
      // bomb outcome and running prepareSndRound() itself — the same principle
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
        if (bomb.state !== "carried") break;   // already planted/decided here
        bomb.plant(m.site);
        remoteBombAct = null;
        showWaveBanner(`Bomb planted — site ${m.site}`, 1800);
        audio.wave();
        els.bombPrompt.hidden = true;
        break;
      case "defused":
        if (bomb.state === "exploded") break;   // it went off here first
        bomb.defuse();
        sndRoundWin(sndDefendTeam(), "bomb defused");
        els.bombPrompt.hidden = true;
        break;
      case "cancel":
        remoteBombAct = null;
        break;
      case "timeup":
        if (bomb.state !== "planted") sndRoundWin(sndDefendTeam(), "time expired");
        break;
    }
  },
  ownsBot: (id) => !!bots.byId(id),
  onBotHit: (m) => {
    const { killed, bot } = bots.applyHit(m.target, m.dmg);
    if (!killed) return;
    net.reportDeathAs(m.target, m.id, m.w, !!m.hd);
    registerDeath(bot.name, m.id, m.w, {
      head: !!m.hd, victimTeam: bot.team, victimIsBot: true,
      victimPos: bot.pos, victimWeaponId: bot.weaponId,
    });
    if (m.id !== net.id) creditAssistIfOwed(m.target, bot.name);
  },
  onRemoteShot: (p, m) => {
    const origin = new THREE.Vector3(m.ox, m.oy, m.oz);
    const dir = new THREE.Vector3(m.dx, m.dy, m.dz);
    remoteShotFx(origin, dir, m.w, !!m.q, +m.c || 0);
    killcam.noteShot(kcClock, m.id || p?.id, origin, dir, m.w, !!m.q);
    if (royale && !m.q) royaleNoise(origin.x, origin.z, m.id || p?.id);

    // Was it aimed near our head? If so, suppress.
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

/* Match chat (chat.js): Enter all-chat, Y team chat. Lives in the HUD, so it
   shows only in a match. While it's open the game's own keys stand down. */
const chat = new MatchChat({
  net,
  mount: els.hud,
  isTeamMode: () => !currentMode().ffa,
  teamColor: (t) => TEAMS[t]?.ui,
  openProfile: (uid) => openPlayerProfile(uid),
  onOpenChange: (open) => { if (open) { keys.clear(); mouseDown = false; } },
});

/* The site's profile card (troll-accounts.js) for any operator with an
   account. The pointer has to be free to use it, so only reachable from
   menus, the paused roster and chat. */
function openPlayerProfile(uid) {
  const id = safeUid(uid);
  if (id) window.TrollrunnerAccounts?.openProfileCard?.(id);
}
function playerUid() {
  return safeUid(window.TrollrunnerAccounts?.getCachedProfile?.()?.userId);
}

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

// three's compileAsync polls every material it saw until that shader is
// ready, and one disposed meanwhile (a match torn down mid warm-up) throws
// from inside the poll. Hold material disposals while a warm-up runs.
if (renderer.compileAsync) {
  let compiling = 0;
  const held = [];
  const rawDispose = THREE.Material.prototype.dispose;
  THREE.Material.prototype.dispose = function () {
    if (compiling) held.push(this); else rawDispose.call(this);
  };
  const rawCompileAsync = renderer.compileAsync.bind(renderer);
  renderer.compileAsync = async (...args) => {
    compiling++;
    try { return await rawCompileAsync(...args); } finally {
      if (--compiling === 0) for (const m of held.splice(0)) rawDispose.call(m);
    }
  };
}

const scene = new THREE.Scene();
const lightPool = new LightPool(scene);
scene.fog = new THREE.FogExp2(0x3a4a38, 0.01);

/* The sky (map detail pass, phase 1): the map's three-colour gradient, a
   band of haze on the horizon, the sun (a disc and its glow, off for
   indoor and night maps), and a layer of slow clouds lit from the sun's
   side. All one shader on the dome: no geometry, no lights. Clouds cost an
   fbm per pixel, so Graphics > Medium halves them and Low turns them off
   (uCloudQ). Writes sRGB, so each map's hex colours read as written. */
const skyMat = new THREE.ShaderMaterial({
  uniforms: {
    uTop: { value: new THREE.Color(0x1a2e4a) },
    uHorizon: { value: new THREE.Color(0x6b8a5e) },
    uBottom: { value: new THREE.Color(0x2a3324) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(0xffffff) },
    uSunSize: { value: 0.03 },      // disc radius, radians
    uSunGlow: { value: 0.0 },
    uHaze: { value: 0.0 },
    uCloud: { value: 0.0 },         // coverage 0..1
    uCloudQ: { value: 2 },          // 0 off, 1 cheap, 2 full
    uCloudColor: { value: new THREE.Color(0xffffff) },
    uCloudShade: { value: new THREE.Color(0x8090a0) },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform vec3 uTop, uHorizon, uBottom, uSunDir, uSunColor, uCloudColor, uCloudShade;
    uniform float uSunSize, uSunGlow, uHaze, uCloud, uCloudQ, uTime;
    varying vec3 vDir;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5, t = 0.0;
      for (int i = 0; i < 5; i++) {
        if (float(i) >= 2.0 + uCloudQ * 1.5) break;
        v += a * noise(p);
        t += a;
        p = p * 2.03 + vec2(17.0, 9.0);
        a *= 0.5;
      }
      return v / t;   // 0..1 whatever the octave count, so coverage means the same on every tier
    }
    void main() {
      vec3 d = normalize(vDir);
      float h = d.y;
      vec3 color = h > 0.0
        ? mix(uHorizon, uTop, pow(smoothstep(0.0, 0.75, h), 0.8))
        : mix(uHorizon, uBottom, smoothstep(0.0, -0.3, h));
      // haze: the horizon colour pulled up into the lowest few degrees
      color = mix(color, uHorizon, uHaze * exp(-abs(h) * 9.0));
      float c = max(dot(d, uSunDir), 0.0);
      // glow round the sun, wide and soft, then tight and hot
      color += uSunColor * uSunGlow * (0.18 * pow(c, 6.0) + 0.55 * pow(c, 90.0));
      if (uCloud > 0.0 && uCloudQ > 0.0 && h > 0.0) {
        vec2 p = d.xz / (h + 0.12) * 1.6 + vec2(uTime * 0.012, uTime * 0.004);
        float n = fbm(p);
        float cov = smoothstep(1.0 - uCloud, 1.0 - uCloud + 0.32, n) * smoothstep(0.0, 0.18, h);
        // lit edge toward the sun, shaded underside away from it
        float lit = 0.45 + 0.55 * smoothstep(0.35, 0.8, fbm(p + uSunDir.xz * 0.12));
        vec3 cloud = mix(uCloudShade, uCloudColor, lit) + uSunColor * uSunGlow * 0.35 * pow(c, 4.0);
        color = mix(color, cloud, cov * 0.92);
      }
      // the disc itself, in front of the clouds' thin edges
      float disc = smoothstep(cos(uSunSize), cos(uSunSize * 0.82), dot(d, uSunDir)) * step(0.001, uSunGlow);
      color = mix(color, uSunColor * 1.6 + 0.3, disc);
      gl_FragColor = vec4(color, 1.0);
      #include <colorspace_fragment>
    }
  `,
  side: THREE.BackSide,
  fog: false,
  depthWrite: false,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(250, 24, 16), skyMat);
// Drawn first and centred on the camera every frame (a skybox), so a map
// bigger than the dome (Trollface Island) never looks past its edge.
sky.renderOrder = -1;
sky.frustumCulled = false;
sky.onBeforeRender = () => { skyMat.uniforms.uTime.value = performance.now() / 1000; };
scene.add(sky);

const camera = new THREE.PerspectiveCamera(78, 16 / 9, 0.05, 300);
let baseFov = 78;   // driven by the FOV setting
const killcam = new KillCam(camera);
/* The killcam history's clock: sim seconds, not wall time, so a replay
   plays back at the speed the match actually ran. */
let kcClock = 0;

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
let spawnSides = null;   // splitSpawnSides() for the loaded map: { axis, lo, hi } spawn indices

function applyEnvironment(map) {
  skyMat.uniforms.uTop.value.set(map.sky.top);
  skyMat.uniforms.uHorizon.value.set(map.sky.horizon);
  skyMat.uniforms.uBottom.value.set(map.sky.bottom);
  // Sun disc + glow (a map without `sky.sun` has none: indoors, night),
  // horizon haze, clouds. The disc sits where the sun light comes from.
  const sk = map.sky;
  skyMat.uniforms.uSunDir.value.set(...map.sun.pos).normalize();
  skyMat.uniforms.uSunColor.value.set(sk.sunColor ?? map.sun.color);
  skyMat.uniforms.uSunGlow.value = sk.sun ?? 0;
  skyMat.uniforms.uSunSize.value = sk.sunSize ?? 0.03;
  skyMat.uniforms.uHaze.value = sk.haze ?? 0;
  skyMat.uniforms.uCloud.value = sk.clouds ?? 0;
  skyMat.uniforms.uCloudColor.value.set(sk.cloudColor ?? 0xffffff);
  skyMat.uniforms.uCloudShade.value.set(sk.cloudShade ?? 0x8a96a6);
  renderer.toneMappingExposure = map.exposure ?? 1.5;

  scene.fog.color.set(map.fog.color);
  scene.fog.density = map.fog.density;

  // How far you can see: 300 m on the arena maps, more on a big one
  // (map.viewFar). The sky dome sits just inside it.
  camera.far = map.viewFar || 300;
  camera.updateProjectionMatrix();
  sky.scale.setScalar((camera.far * 0.9) / 250);

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

  // A map in space (Trollface Island) gets stars inside the sky dome.
  setStarField(!!map.stars);
}

/* Stars for a space sky: points just inside the dome, so they ride along
   with it (it follows the camera) and never get closer. A denser, tinted
   band across the sky reads as the Milky Way. */
let starField = null;
function setStarField(on) {
  if (!on) {
    if (starField) { sky.remove(starField); starField.geometry.dispose(); starField.material.dispose(); starField = null; }
    return;
  }
  if (starField) return;
  const N = 5200, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  let s = 0x5eed;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < N; i++) {
    const band = i < N * 0.45;
    let x, y, z;
    do {
      x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1;
      if (band) y = y * 0.16 + x * 0.45;   // a tilted band
    } while (x * x + y * y + z * z > 1 || x * x + y * y + z * z < 0.05);
    const l = Math.hypot(x, y, z), r = 240;
    pos.set([x / l * r, y / l * r, z / l * r], i * 3);
    const b = 0.45 + rnd() * 0.55;
    const tint = rnd();
    col.set(tint < 0.12 ? [b, b * 0.8, b * 1.2] : tint < 0.22 ? [b * 1.15, b, b * 0.8] : [b, b, b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  starField = new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false, transparent: true, opacity: 0.95 }));
  starField.renderOrder = -1;
  sky.add(starField);
}

let loadedMapId = null;

// ?colliderdebug=1 draws every entry in `colliders` as a wireframe box, so a
// mismatch between a house's real modelled walls and its ghostWalls/ghostBox
// collider (the two are hand-authored separately, per house-props.js and
// battlefield-props.js's file comments) shows up as a wireframe visibly
// poking through or floating short of the visible mesh, instead of only
// surfacing as a confusing "shot through the wall" bug report later.
const colliderDebugForced = /[?&]colliderdebug=1/.test(location.search);
let colliderDebugGroup = null;
function buildColliderDebugOverlay() {
  const group = new THREE.Group();
  group.name = "collider-debug";
  const mat = new THREE.LineBasicMaterial({ color: 0xff2d55 });
  for (const c of colliders) {
    const size = new THREE.Vector3().subVectors(c.max, c.min);
    const center = new THREE.Vector3().addVectors(c.max, c.min).multiplyScalar(0.5);
    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const edges = new THREE.EdgesGeometry(geo);
    const line = new THREE.LineSegments(edges, mat);
    line.position.copy(center);
    group.add(line);
  }
  return group;
}

function loadMap(id) {
  if (id === loadedMapId) return;    // the lobby already put us in this one
  disposeMap(builtMap, scene);
  builtMap = buildMap(id, { colliders, arena: ARENA });
  builtMap.map.attachAudio?.(audio);
  scene.add(builtMap.root);
  spawnPoints = builtMap.spawnPoints;
  // Spawns are authored as [x, z]: stand each on the floor under it (a
  // platform, a step), not at y 0 inside it. At y 0 on Undergrin the push
  // out of the 1.1 m platform shoved players out past the end wall, stuck
  // in a sliver they could only shuffle along (user: "stuck in place").
  for (const sp of spawnPoints) if (!sp.y) sp.y = groundHeightAt(colliders, sp.x, sp.z, 2.0);
  spawnSides = splitSpawnSides(spawnPoints);
  applyEnvironment(builtMap.map);
  applyClutter();
  buildMinimapBase();
  // Bot pathfinding is built from the map's colliders, so it has to follow
  // the map — a field from the old geometry routes them into new walls.
  bots.rebuildNav(colliders, ARENA, 0);
  loadedMapId = id;
  if (colliderDebugForced) {
    colliderDebugGroup?.parent?.remove(colliderDebugGroup);
    colliderDebugGroup = buildColliderDebugOverlay();
    builtMap.root.add(colliderDebugGroup);
  }
}

// -------------------- lobby backdrop --------------------
// The menu hangs over the arena you are about to drop into, drifting around
// it, rather than over a flat gradient — the map card and the view agree.

let lobbyAngle = 0.6;

/* The map a match on this mode is played on: a forced one (the range), the
   mode's own list (Zombies: its saved pick, else the first), or the versus
   map — the room's, when one is passed. Read from the mode itself, not the
   lobby's state, so it holds however the match was started. */
function matchMapId(roomMapId = null) {
  const m = currentMode();
  if (m.forceMap) return m.forceMap;
  if (m.mapPool) return m.mapPool.includes(loadout.poolMapId) ? loadout.poolMapId : m.mapPool[0];
  return roomMapId || loadout.mapId;
}

function lobbyMapId() { return matchMapId(); }

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
  // An island map: its coast and its lake, under the buildings.
  const outline = (poly, fill, stroke) => {
    ctx.beginPath();
    poly.forEach(([x, z], i) => { const [a, b] = mapToMinimap(x, z); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); });
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke();
  };
  if (ARENA.edge) outline(ARENA.edge, "rgba(110,190,95,.28)", "rgba(200,230,190,.5)");
  if (ARENA.wade) outline(ARENA.wade, "rgba(70,170,255,.35)", "rgba(140,200,255,.5)");
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

  if (royale) drawRoyaleMinimap(ctx, size);

  if (isPvp()) {
    // Friendlies always show. Enemies are fogged unless a UAV is up, or
    // they're close enough to hear/see without a radar's help — scaled to
    // the current map's size so small maps don't hand out free radar and
    // huge ones don't demand near-melee range before anything shows.
    const showEnemies = enemiesRevealed();
    const vsat = vsatUp();
    const arenaSpan = Math.max(ARENA.maxX - ARENA.minX, ARENA.maxZ - ARENA.minZ);
    const proximityRadius = Math.min(28, Math.max(14, arenaSpan * 0.16));
    for (const rp of remotes.byId.values()) {
      if (!rp.alive) continue;
      // No team of our own (free-for-all, or offline before chooseTeam runs)
      // means nobody is a friendly, so everyone is subject to the fog.
      const friendly = !currentMode().ffa && !!net.team && rp.team === net.team;
      const nearby = Math.hypot(rp.pos.x - move.pos.x, rp.pos.z - move.pos.z) <= proximityRadius;
      if (!friendly && !showEnemies && !nearby) continue;
      const [x, z] = mapToMinimap(rp.pos.x, rp.pos.z);
      ctx.fillStyle = friendly ? "#7fd1e0" : "#ff6b5a";
      ctx.beginPath();
      if (!friendly && vsat) {
        // The VSAT's edge over a UAV: which way they're facing, too.
        ctx.save();
        ctx.translate(x, z);
        ctx.rotate(-(rp.yaw || 0));
        ctx.moveTo(0, -5);
        ctx.lineTo(3.4, 3.6);
        ctx.lineTo(-3.4, 3.6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.arc(x, z, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (showEnemies) {
      // A thin sweep ring, so it reads as "the UAV is why you can see this".
      // The satellite's is doubled and brighter.
      ctx.strokeStyle = vsat ? "rgba(255,150,110,.85)" : "rgba(255,107,90,.5)";
      ctx.lineWidth = 1;
      ctx.strokeRect(1.5, 1.5, size - 3, size - 3);
      if (vsat) ctx.strokeRect(4.5, 4.5, size - 9, size - 9);
    }

    // Care packages beacon their own position by radio the moment they
    // land — that's independent of UAV, so it stays on screen whether or
    // not a UAV is currently up.
    for (const e of streakEntities.values()) {
      if (!(e instanceof CarePackage) || e.claimed) continue;
      const [x, z] = mapToMinimap(e.x, e.z);
      ctx.fillStyle = "#f5c542";
      ctx.beginPath();
      ctx.moveTo(x, z - 5);
      ctx.lineTo(x + 5, z + 4);
      ctx.lineTo(x - 5, z + 4);
      ctx.closePath();
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

  // Jammed by an enemy Counter-UAV: static over everything but ourselves.
  if (isPvp() && minimapJammed()) drawMinimapStatic(ctx, size);

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

function drawMinimapStatic(ctx, size) {
  ctx.fillStyle = "rgba(8,10,9,.72)";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 260; i++) {
    const v = 90 + ((Math.random() * 150) | 0);
    ctx.fillStyle = `rgba(${v},${v},${v},${0.25 + Math.random() * 0.4})`;
    ctx.fillRect((Math.random() * size) | 0, (Math.random() * size) | 0, 2 + ((Math.random() * 5) | 0), 1 + ((Math.random() * 2) | 0));
  }
  // A rolling tear band, like a dead feed.
  const band = ((performance.now() / 9) % (size + 20)) - 10;
  ctx.fillStyle = "rgba(255,255,255,.12)";
  ctx.fillRect(0, band, size, 6);
  ctx.fillStyle = "#ff6b5a";
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "center";
  ctx.fillText("JAMMED", size / 2, size / 2 + 4);
  ctx.textAlign = "start";
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
    // Ground-level support only: sites sit on open floor, and a ceiling of
    // 40 used to put the ring on whatever roof or catwalk was overhead.
    const y = groundHeightAt(colliders, site.x, site.z, 1) ?? 0;
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
const ssao = new SSAOPass(scene, camera, 1, 1);
ssao.kernelRadius = 0.6;
ssao.minDistance = 0.001;
ssao.maxDistance = 0.15;
ssao.output = SSAOPass.OUTPUT.Default;
composer.addPass(ssao);
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

let weaponEnvTex = null;
/* A small studio for the detailed guns' reflections (the Green Candles'
   brass and steel): a dark floor, a grey horizon, a bright ceiling and
   three softboxes, baked once into a PMREM map. Only materials that ask
   for it use it (weapon-model.js), so no other gun or the world changes. */
(() => {
  const env = new THREE.Scene();
  const geo = new THREE.SphereGeometry(10, 32, 16);
  const cols = [];
  const pos = geo.attributes.position;
  const c = new THREE.Color();
  const top = new THREE.Color(0.85, 0.87, 0.9), floor = new THREE.Color(0.05, 0.05, 0.055);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 10;
    c.setRGB(0.32, 0.34, 0.37).lerp(y > 0 ? top : floor, y > 0 ? Math.pow(y, 0.8) : Math.pow(-y, 0.5));
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  env.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const panel = new THREE.MeshBasicMaterial({ color: 0xffffff });
  panel.color.setScalar(4);
  for (const [x, y, z, w, h] of [[5, 5, 3, 5, 3], [-6, 3, -2, 3, 4], [0, 7, -6, 8, 1.2]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), panel);
    p.position.set(x, y, z);
    p.lookAt(0, 0, 0);
    env.add(p);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  weaponEnvTex = pmrem.fromScene(env, 0.04).texture;
  setWeaponEnvMap(weaponEnvTex);
  setSaberEnvMap(weaponEnvTex);
  setHalloweenEnvMap(weaponEnvTex);
  pmrem.dispose();
})();

scene.add(camera);


// Only the equipped weapon is built, and it's rebuilt whenever the loadout
// changes, because attachments alter the geometry.
let activeWeaponMesh = null;
let activeWeaponDef = null;

// The Trollsaber's hilt streams in too; its builder swaps the model into
// any saber already built (trollsaber.js), so nothing to rebuild here.
preloadTrollsaber();
// The Chainsaw and the Reaper's Grin stream in the same way (melee-models.js).
preloadHalloweenMelee();

// Detailed models stream in; rebuild the gun in hand once they land.
preloadWeaponModels().then((ok) => {
  if (!ok) return;
  if (hasDetailedModel(activeWeaponDef)) setActiveWeaponMesh(activeWeaponDef);
  // The menu previews snapshot the gun once; redraw them with the real model.
  if (hasDetailedModel(loadout.resolved)) {
    sumGunKey = null;
    showSumGun();
    charInspector?.setWeapon(loadout.resolved);
    if (inspectorLive) inspector?.show(loadout.resolved);
  }
});

function setActiveWeaponMesh(def) {
  activeWeaponDef = def;
  if (activeWeaponMesh) {
    weaponRig.remove(activeWeaponMesh);
    activeWeaponMesh.traverse((o) => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      if (o.material) o.material.dispose?.();
    });
  }
  activeWeaponMesh = buildWeaponMesh(def);
  // No first-person hands on guns (user call, 2026-09-25): the gun on
  // screen should look exactly like it does in the skin editor, and the
  // block hands sat right on the skin art. Melee and the streak device keep
  // theirs. The meshes stay (tagged userData.hand) for anything that reads
  // their positions; they just don't draw.
  activeWeaponMesh.traverse((o) => { if (o.userData.hand) o.visible = false; });
  weaponRig.add(activeWeaponMesh);
}

let activeMeleeMesh = null;

function setActiveMeleeMesh(def) {
  if (activeMeleeMesh) {
    restoreMeleeHands(activeMeleeMesh);
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

/* Streak-call device (DESIGN-ARMS.md Phase 5) — built once, unlike the
   weapon/melee meshes, since it never changes per-loadout the way a gun's
   attachments or a melee weapon choice do. */
const activeStreakMesh = buildStreakDevice();
activeStreakMesh.visible = false;
weaponRig.add(activeStreakMesh);
// The care package marker, held up ready to throw.
const activeMarkerMesh = buildMarkerDevice();
activeMarkerMesh.visible = false;
weaponRig.add(activeMarkerMesh);
// The hunter-killer itself, held before it's tossed (the model streams in).
const activeDroneMesh = new THREE.Group();
activeDroneMesh.visible = false;
weaponRig.add(activeDroneMesh);
// Both hands cup it from underneath, one either side of the body.
activeDroneMesh.userData.anchors = (() => {
  const right = new THREE.Object3D(), left = new THREE.Object3D();
  right.position.set(0.075, -0.035, 0.01);
  left.position.set(-0.075, -0.035, 0.01);
  activeDroneMesh.add(right, left);
  return { right, left };
})();
loadModel("hunter-drone").then((obj) => {
  obj.scale.setScalar(0.32);
  obj.traverse((n) => { if (n.isMesh) n.castShadow = false; });
  activeDroneMesh.add(obj);
  activeDroneMesh.userData.rotors = [];
  obj.traverse((n) => { if (n.name?.startsWith("DroneRotor")) activeDroneMesh.userData.rotors.push(n); });
}).catch(() => {});

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

// -------------------- impact effects --------------------

// Debris and dust where rounds land (see impact-fx.js); the additive sparks
// are kept for blasts and the gunship's gun only.
const impactFx = new ImpactFx(scene);
function spawnImpactBurst(pos, color, count = 10) { impactFx.sparksAt(pos, color, count); }

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
  holding: "gun",       // "gun" | "melee" | "streak"
  gear: { lethal: 0, tactical: 0 },
  lastHurtAt: -Infinity, // performance.now() of the last damage taken; gates regen
  spawnGuard: 0,        // seconds of spawn protection left; broken by firing
  assists: 0,
  headshots: 0,
  streak: 0,            // kills since last death
  bestStreak: 0,
  matchXp: 0,           // XP banked during this match, shown on the result screen
  matchT: 0,            // seconds of this match played (veteran XP boost)
  vetBotT: 0,           // ...of them with veteran bots in the room
  lastKilledBy: null,   // whose kill sent us back, for the Revenge achievement
};

// Which slot (primary/secondary) currentWeapon() resolves against - reset
// to primary on every spawn/equip so a fresh life always starts on the
// main gun regardless of what was held when the last one ended.
let currentWeaponSlot = "primary";

/* Streak device call window (DESIGN-ARMS.md Phase 5). `streakHoldT > 0`
   means "stay on the device," ticked down in updatePlayer(); reaching 0
   returns to whatever was held before (always "gun" in practice — you
   can't call a streak while holding melee, callStreak/useSelectedStreak
   are gated behind streaksAllowed which requires the gun slot already).
   `streakHoldUntilMark` means "don't count down — stay up for the whole
   marking window," cleared explicitly by confirmMark()/cancelMark(). */
let streakHoldT = 0;
let streakHoldUntilMark = false;

/* The tablet used to swap with the gun in one frame both ways. Now ending a
   hold only starts the tablet lowering (updateStreakView); the gun comes
   back once it's down, rising from the sprint-lowered pose. */
let streakLowering = false;

/* What's in the hand while holding === "streak": the tablet/remote (UAV,
   gunship, the strike's targeting), the care package marker, or the
   hunter-killer itself before it's tossed. */
let streakDeviceKind = "tablet";
// Which page the tablet shows: "uav", "gunship", "strike" (drawTabletScreen).
let streakScreen = "idle";
let streakHoldElapsed = 0;
const MARKER_THROW_TIME = 0.5;
let markerThrowT = 0;
const DRONE_TOSS_AT = 0.6;          // seconds into the hold that the drone leaves the hand
let pendingDroneLaunch = null;

/* Tablet dive (user): for the streaks you work from the tablet (Lightning
   Strike, VTOL Warship, Dragonfire) the view tips down onto the tablet in
   your hands, then pushes into its screen and cuts through a green scan
   flash to whatever it opens (the strike map, the gunner's feed, the
   drone's camera). `then` runs at the cut. Called streaks that just
   confirm (UAV, gunship, VSAT...) keep the plain hold. */
let tabletDive = null;        // { t, dur, then }
let tabletDiveFx = null;
const DIVE_LOOK = 0.42;       // share of the dive spent looking down at it
function startTabletDive(dur, then = null) {
  tabletDive = { t: 0, dur: Math.max(0.5, dur), then };
}
function tabletDiveK() { return tabletDive ? Math.min(1, tabletDive.t / tabletDive.dur) : 0; }
/* How far the view has tipped down onto the tablet (radians). */
function tabletDiveDip() {
  if (!tabletDive) return 0;
  const k = tabletDiveK();
  const a = Math.min(1, k / DIVE_LOOK);
  return 0.38 * a * a * (3 - 2 * a);
}
function updateTabletDive(dt) {
  if (!tabletDive) return;
  if (!player.alive || gameState !== "playing") { tabletDive = null; return; }
  tabletDive.t += dt;
  if (tabletDive.t >= tabletDive.dur) {
    const then = tabletDive.then;
    tabletDive = null;
    tabletDiveFlash();
    then?.();
  }
}
function tabletDiveFlash() {
  if (!tabletDiveFx) {
    tabletDiveFx = document.createElement("div");
    tabletDiveFx.className = "to-tablet-dive";
    tabletDiveFx.setAttribute("aria-hidden", "true");
    (els.streakMark?.parentElement || document.body).appendChild(tabletDiveFx);
  }
  tabletDiveFx.classList.remove("is-on");
  void tabletDiveFx.offsetWidth;   // restart the animation
  tabletDiveFx.classList.add("is-on");
  audio.reload();
}

function beginStreakHold(seconds = 0, kind = "tablet", screen = null) {
  if (player.holding === "melee") return; // never interrupt a mid-swing
  if (player.holding !== "streak" || streakDeviceKind !== kind) {
    streakHoldElapsed = 0;
    streakRaiseT = 0;
  }
  streakDeviceKind = kind;
  if (screen) streakScreen = screen;
  streakLowering = false;
  setHolding("streak");
  streakHoldT = seconds;
  streakHoldUntilMark = seconds <= 0;
}

function endStreakHold(immediate = false) {
  streakHoldT = 0;
  streakHoldUntilMark = false;
  if (player.holding !== "streak") { streakLowering = false; return; }
  if (immediate || !player.alive) { finishStreakHold(); return; }
  streakLowering = true;
}

function finishStreakHold() {
  streakLowering = false;
  streakRaiseT = 0;
  markerThrowT = 0;
  if (player.holding === "streak") setHolding("gun");
  weaponLowerT = 1;
  if (pendingDroneLaunch) launchPendingDrone();
}

function streakHoldActive() { return player.holding === "streak"; }

/* One in the hand: which throwable is cooking, and how much fuse is left. */
const cooking = { def: null, fuse: 0, slot: null };
let blindT = 0;         // seconds of flashbang whiteout left
let empT = 0;           // seconds of EMP scramble left — HUD and optics down
let shakeT = 0, shakeMag = 0;   // blasts and near misses

/* Firing shake. Each shot kicks a damped spring on each camera axis (pitch,
   yaw, roll) plus a short high-frequency buzz; the weapon's shake stats
   (weapons.js, trimmed by attachments.js) decide how hard each axis is
   kicked and how fast it settles. White noise per frame, which this
   replaced, couldn't express "this grip keeps the sight from bouncing". */
const fireShake = { p: 0, y: 0, r: 0, vp: 0, vy: 0, vr: 0, buzz: 0, rec: 1 };
function kickFireShake(def, steady) {
  // Grows slower than the kick itself, so a light rifle still visibly moves
  // and a sniper doesn't throw the whole screen.
  const k = kickCurve(def.recoilKickPitch) * 1.6 * (def.shakeScale ?? 1) * steady;
  const jolt = def.shakeJolt ?? 1;
  fireShake.vp += k * 11 * (def.shakeVert ?? 1) * (0.85 + Math.random() * 0.3);
  fireShake.vy += k * 9 * (def.shakeSide ?? 1) * (Math.random() * 2 - 1);
  fireShake.vr += k * 9 * jolt * (Math.random() < 0.5 ? -1 : 1);
  fireShake.buzz = Math.min(0.012, fireShake.buzz + k * 0.12 * jolt);
  fireShake.rec = def.shakeRecover ?? 1;
}
function updateFireShake(dt) {
  // Stiffer and better damped the faster the weapon recovers. Stepped in
  // small slices: at 20fps a stiff spring would blow up in one big step.
  const w = 30 * fireShake.rec, z = 0.5 + 0.18 * fireShake.rec;
  const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    for (const [x, v] of [["p", "vp"], ["y", "vy"], ["r", "vr"]]) {
      fireShake[v] += (-w * w * fireShake[x] - 2 * z * w * fireShake[v]) * h;
      fireShake[x] += fireShake[v] * h;
    }
  }
  fireShake.buzz *= Math.exp(-dt * 16 * fireShake.rec);
}
function resetFireShake() {
  fireShake.p = fireShake.y = fireShake.r = fireShake.vp = fireShake.vy = fireShake.vr = fireShake.buzz = 0;
}
// Smoothed idle-sway position, lagged behind the raw sine target by weapon
// weight — see updateWeaponView for why this lives here instead of on
// WeaponState (it's pure view lag, never read for gameplay).
let swaySmoothX = 0, swaySmoothY = 0;

const move = new MovementController({ colliders, arena: ARENA });
const bullets = new BulletSystem(scene);

// -------------------- local third-person body --------------------
// The local player has never had a visible body - only the first-person
// viewmodel (weaponScene, a separate camera/pass below). Third-person mode
// needs one, so it reuses the exact rig every bot/remote player already
// uses (buildHumanoid/poseHumanoid) rather than a bespoke model. It's built
// once and left in `scene` permanently; only its visibility toggles with
// view mode, since the FP camera sits at head height inside it and it
// would otherwise occlude the FP view.
const LOCAL_RIG_MAT = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.7, metalness: 0.1 });
const localRig = buildHumanoid(LOCAL_RIG_MAT, { height: 1.8, gun: false });
localRig.face = cosmetics.face;
localRig.root.visible = false;
scene.add(localRig.root);
// Our own head gets its own copy of the face material, so it can fade out of
// the way as we aim in third person without touching anyone else's.
localRig.parts.head.material = localRig.parts.head.material.clone();
localRig.parts.head.material.alphaTest = 0.02;
let localPhase = Math.random() * Math.PI * 2;
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
controls.lock = () => {
  try {
    const p = renderer.domElement.requestPointerLock?.();
    p?.catch?.(() => {});
    return p || Promise.resolve();
  } catch (err) { return Promise.reject(err); }
};
controls.unlock = () => { try { document.exitPointerLock?.(); } catch { /* not locked */ } };

/* When the lock last changed. Chrome refuses a re-lock for ~1s after an
   unlock (resumePlay waits it out), and the first mousemove after a fresh
   lock can carry a huge bogus delta (dropped below). */
let lockChangedAt = 0;
document.addEventListener("pointerlockchange", () => {
  const locked = document.pointerLockElement === renderer.domElement;
  controls.isLocked = locked;
  lockChangedAt = performance.now();
  controls.dispatchEvent(new Event(locked ? "lock" : "unlock"));
});
document.addEventListener("mousemove", (e) => {
  if (!controls.isLocked) return;
  // The strike tablet has the mouse: it steers the reticle, not the view.
  if (strikeTablet?.isOpen) { strikeTablet.moveCursor(e.movementX, e.movementY); return; }
  // The emote wheel has the mouse while it's open: the view holds still.
  if (emoteWheel.isOpen) { emoteWheel.move(e.movementX, e.movementY); return; }
  // Right after a re-lock the browser can report one enormous jump (the
  // cursor's travel while unlocked): swallow the first moments and cap any
  // single event, so resuming never snaps the view somewhere else.
  if (performance.now() - lockChangedAt < 60) return;
  const mx = Math.max(-300, Math.min(300, e.movementX));
  const my = Math.max(-300, Math.min(300, e.movementY));
  mouseLookAt = performance.now();
  // Near a target, aim assist makes the mouse a little "sticky" (see
  // applyAimAssist) — the same slowdown the stick gets, just gentler.
  const sticky = aimAssistSticky ? AIM_ASSIST_MOUSE_SLOWDOWN : 1;
  const sens = BASE_MOUSE_SENS * (settings.sens / 100) * sticky * lookSensScale();
  look.yaw -= mx * sens;
  look.pitch += (settings.invert ? 1 : -1) * my * sens;
  look.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, look.pitch));
});

let spawner = null;

const keys = new Set();
window.addEventListener("keydown", (e) => {
  if (chat.isTyping) return;
  // Match chat: Enter for everyone, Y for your team (team modes).
  if ((e.code === "Enter" || e.code === "NumpadEnter" || e.code === "KeyY") && !e.repeat
      && gameState === "playing" && isPvp() && net.connected) {
    e.preventDefault();
    chat.open(e.code === "KeyY");
    return;
  }
  // The emote wheel (in a match, or on the menu's operator): H opens and
  // closes it, X plays what's hovered, Esc closes.
  const wheel = gameState === "menu" ? (charInspectorLive ? menuEmoteWheel : null) : emoteWheel;
  if (wheel && !e.repeat && !typingField(e.target)) {
    if (e.code === "KeyH" && !localPauseOnly) {
      wheel.toggle(gameState === "menu" || (gameState === "playing" && player.alive));
      return;
    }
    if (wheel.isOpen && e.code === "KeyX") { wheel.close(); return; }
    if (wheel.isOpen && e.code === "Escape") wheel.close(true);
  }
  keys.add(e.code);
  // View mode: the keys only fly the camera (and Esc still pauses).
  if (isView() && gameState === "playing" && e.code !== "Escape") return;
  if (e.code === "Space" && !e.repeat && killcam.active && !player.alive) skipKillcam();
  if (!e.repeat && !player.alive && royaleSpectating()) {
    if (e.code === "ArrowLeft" || e.code === "KeyA" || e.code === "KeyQ") cycleSpectate(-1);
    if (e.code === "ArrowRight" || e.code === "KeyD" || e.code === "KeyE") cycleSpectate(1);
  }
  // Pause with other people still live in the match keeps gameState at
  // "playing" (see openPauseMenu) so their match doesn't stall, so these
  // action keys need their own guard now instead of relying on gameState.
  if (!localPauseOnly) {
    if (e.code === "KeyR") tryReload();
    if ((e.code === "KeyA" || e.code === "KeyD") && !e.repeat) {
      const now = performance.now() / 1000;
      if (now - swivelTaps[e.code] < SWIVEL_TAP) { trySwivel(e.code === "KeyA" ? -1 : 1); swivelTaps[e.code] = 0; }
      else swivelTaps[e.code] = now;
    }
    if (e.code === "KeyT" && !e.repeat) startInspect();
    if (e.code === "KeyV" && !e.repeat) swingMelee();
    if (e.code === "KeyB" && !e.repeat) toggleThirdPerson();
    if (e.code === "Digit1") switchWeapon("primary");
    if (e.code === "Digit2") switchWeapon("secondary");
    if (e.code === "Digit3") setHolding("melee");
    // One key per streak row (4 = top). A single "call the priciest" key
    // fired the hunter-killer whenever you meant the care package.
    // Troll Royale has no streaks: 4 puts a plate on, 5 uses Hopium.
    if (royale && (e.code === "Digit4" || e.code === "Digit5") && !e.repeat) startRoyaleAct(e.code === "Digit4" ? "plate" : "heal");
    else if (/^Digit[4-7]$/.test(e.code) && !e.repeat) callStreakSlot(+e.code.slice(5) - 4);
    // G throws whatever throwable you brought (one slot: lethal OR tactical).
    if (e.code === "KeyG" && !e.repeat) startCook(carriedThrowSlot());
    // F is plant/defuse while you're somewhere you can do either (S&D);
    // everywhere else it's the tactical.
    if (e.code === "KeyF" && !e.repeat && !(isSnd() && sndCanInteract)) startCook("tactical");
  }
  // Range-only live tuning, so a sensitivity change can be felt immediately.
  if (isRange() && gameState === "playing" && !localPauseOnly) {
    if (e.code === "Minus") nudgeSetting("sens", -5, 0, 200);
    if (e.code === "Equal") nudgeSetting("sens", 5, 0, 200);
    if (e.code === "BracketLeft") nudgeSetting("fov", -1, 60, 100);
    if (e.code === "BracketRight") nudgeSetting("fov", 1, 60, 100);
    if (e.code === "KeyN" && !e.repeat) spawnRangeBot();
  }
  if (e.code === "Space" && gameState === "playing" && !localPauseOnly) e.preventDefault();
  if (e.code === "Tab" && gameState === "playing" && !localPauseOnly && isPvp()) {
    e.preventDefault();
    renderScoreboard();
    els.scoreboard.hidden = false;
  }
});
window.addEventListener("blur", () => { cancelCook(); emoteWheel.close(true); });
window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
  if (e.code === "Tab") els.scoreboard.hidden = true;
  if ((e.code === "KeyG" && cooking.slot)
    || (e.code === "KeyF" && cooking.slot === "tactical")) releaseCook();
});

/* Kills, deaths, assists and K/D per operator. Team modes list each side
   under its score; free-for-all modes have no sides worth showing, so it's
   one ranking. Bots don't earn assists, so theirs read as a dash. */
function renderScoreboard() {
  const rows = [{
    name: `${playerName()} (you)`, team: net.team, you: true, uid: playerUid(),
    kills: player.kills | 0, deaths: player.deaths | 0, assists: player.assists | 0,
  }];
  for (const p of net.peers.values()) {
    if (String(p.id).startsWith("streak-")) continue;   // drones and gunships aren't players
    rows.push({
      name: p.name, team: p.team, you: false, uid: safeUid(p.uid),
      kills: p.kills | 0, deaths: p.deaths | 0, assists: isBotPeer(p) ? null : (p.assists | 0),
    });
  }
  // Most kills first; fewer deaths breaks a tie.
  const rank = (a, b) => (b.kills - a.kills) || (a.deaths - b.deaths);
  const cols = `<span>K</span><span>D</span><span>A</span><span>K/D</span>`;
  const row = (r, place = null) => `<div class="to-sb-row${r.you ? " is-you" : ""}">`
    + `<span>${place != null ? `<b>${place}.</b> ` : ""}${r.uid
      ? `<button type="button" class="to-sb-name" data-uid="${r.uid}" title="View profile">${escapeHtml(r.name)}</button>`
      : escapeHtml(r.name)}</span>`
    + `<span>${r.kills}</span><span>${r.deaths}</span><span>${r.assists ?? "–"}</span>`
    + `<span>${(r.kills / Math.max(1, r.deaths)).toFixed(2)}</span></div>`;

  let html = "";
  if (currentMode().ffa) {
    const all = rows.sort(rank);
    html += `<div class="to-sb-team"><div class="to-sb-head">`
      + `<span>${escapeHtml(currentMode().name)}</span>${cols}</div>`;
    html += all.map((r, i) => row(r, i + 1)).join("");
    html += `</div>`;
  } else {
    for (const teamId of ["phantom", "ghost"]) {
      const team = TEAMS[teamId];
      const members = rows.filter((r) => r.team === teamId).sort(rank);
      html += `<div class="to-sb-team"><div class="to-sb-head">`
        + `<span style="color:${team.ui}">${teamName(teamId)} · ${teamScores[teamId]}</span>${cols}</div>`;
      html += members.length
        ? members.map((r) => row(r)).join("")
        : `<div class="to-sb-row"><span>—</span></div>`;
      html += `</div>`;
    }
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
  if (!controls.isLocked) {
    // In play without the mouse (a refused re-lock, or resumed on a pad):
    // a click on the game takes it back instead of doing nothing.
    if (!isTouch && gameState === "playing" && els.pause.hidden) controls.lock();
    return;
  }
  if (strikeTablet?.isOpen) {
    if (e.button === 0) strikeTablet.place();
    else if (e.button === 2) strikeTablet.undo();
    return;
  }
  // Emote wheel open: a click plays what's hovered, a right click closes.
  if (emoteWheel.isOpen) {
    if (e.button === 0) emoteWheel.close();
    else if (e.button === 2) emoteWheel.close(true);
    return;
  }
  // Troll Royale, out: a click is next, a right click the one before.
  if (!player.alive && royaleSpectating() && (e.button === 0 || e.button === 2)) { cycleSpectate(e.button === 0 ? 1 : -1); return; }
  if (e.button === 0) mouseDown = true;
  if (e.button === 2) adsHeld = true;   // PF parity: right mouse aims
});
window.addEventListener("mouseup", (e) => {
  if (e.button === 0) mouseDown = false;
  if (e.button === 2) adsHeld = false;
});
renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
// Belt and braces for style.css's no-select rule: no drag of any image or
// link, no selection start or long-press menu outside a typing field.
const typingField = (t) => !!t?.closest?.("input, textarea, [contenteditable='true']");
document.addEventListener("dragstart", (e) => e.preventDefault());
document.addEventListener("selectstart", (e) => { if (!typingField(e.target)) e.preventDefault(); });
document.addEventListener("contextmenu", (e) => { if (!typingField(e.target)) e.preventDefault(); });

// -------------------- touch controls --------------------

const touchState = {
  moveX: 0, moveY: 0, lookDX: 0, lookDY: 0, looking: false,
  firing: false, ads: false, jump: false,
  crouch: false, dive: false, interact: false, swap: false, endStreak: false,
};

/* `zone`: a touch anywhere in it moves the stick under the thumb first
   (a floating stick), and it springs back to its rest spot on release. */
function bindStick(el, nub, zone = null) {
  let active = false, startX = 0, startY = 0, id = null;
  const begin = (e) => {
    if (active) return;
    const t = e.changedTouches[0];
    active = true; id = t.identifier; startX = t.clientX; startY = t.clientY;
    if (zone && e.currentTarget === zone) {
      const box = el.offsetParent.getBoundingClientRect();
      el.style.left = `${t.clientX - box.left - el.offsetWidth / 2}px`;
      el.style.top = `${t.clientY - box.top - el.offsetHeight / 2}px`;
      el.style.bottom = "auto";
      el.classList.add("is-floating");
    }
    el.classList.add("is-active");
  };
  el.addEventListener("touchstart", begin, { passive: true });
  zone?.addEventListener("touchstart", begin, { passive: true });
  const move = (e) => {
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
  };
  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== id) continue;
      active = false; touchState.moveX = 0; touchState.moveY = 0;
      if (nub) nub.style.transform = "translate(-50%,-50%)";
      el.style.left = el.style.top = el.style.bottom = "";
      el.classList.remove("is-floating", "is-active");
    }
  };
  for (const target of zone ? [el, zone] : [el]) {
    target.addEventListener("touchmove", move, { passive: true });
    target.addEventListener("touchend", end);
    target.addEventListener("touchcancel", end);
  }
}
bindStick(els.touchMove, els.touchMoveNub, els.touchMoveZone);

/* Touch look, tuned toward CoD Mobile's default feel: a much livelier base
   rate than the old flat 0.0028 rad/px (which also ignored the Sensitivity
   slider entirely), a little acceleration so a fast flick covers a turn
   without a second swipe while slow drags stay precise, and a lower rate
   while aiming down sights so the scope doesn't feel twitchy. */
const TOUCH_BASE_SENS = 0.0065;   // rad per CSS px at 100% sensitivity, hip-fire
const TOUCH_ACCEL_START = 0.6;    // px/ms before acceleration kicks in
const TOUCH_ACCEL_MAX = 1.6;      // cap on the flick multiplier
function touchLookGain(dx, dy, dtMs) {
  const speed = Math.hypot(dx, dy) / Math.max(dtMs, 4);
  const accel = Math.min(TOUCH_ACCEL_MAX, 1 + Math.max(0, speed - TOUCH_ACCEL_START) * 0.5);
  const adsScale = 1 - (currentWeapon()?.adsT || 0) * 0.4;
  return TOUCH_BASE_SENS * (settings.sens / 100) * accel * adsScale;
}
function addTouchLook(t, last) {
  const now = performance.now();
  const dx = t.clientX - last.x, dy = t.clientY - last.y;
  const g = touchLookGain(dx, dy, now - last.t);
  touchState.lookDX += dx * g;
  touchState.lookDY += (settings.invert ? -1 : 1) * dy * g;
  last.x = t.clientX; last.y = t.clientY; last.t = now;
}

(function bindLook() {
  let id = null;
  const last = { x: 0, y: 0, t: 0 };
  els.touchLook.addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0];
    id = t.identifier; last.x = t.clientX; last.y = t.clientY; last.t = performance.now();
    touchState.looking = true;
  }, { passive: true });
  els.touchLook.addEventListener("touchmove", (e) => {
    for (const t of e.changedTouches) if (t.identifier === id) addTouchLook(t, last);
  }, { passive: true });
  const end = (e) => {
    for (const t of e.changedTouches) if (t.identifier === id) { id = null; touchState.looking = false; }
  };
  els.touchLook.addEventListener("touchend", end);
  els.touchLook.addEventListener("touchcancel", end);
})();

function bindHold(el, onDown, onUp) {
  el.addEventListener("touchstart", (e) => { e.preventDefault(); el.classList.add("is-held"); onDown(); }, { passive: false });
  el.addEventListener("touchend", (e) => { e.preventDefault(); el.classList.remove("is-held"); onUp(); });
  el.addEventListener("touchcancel", () => { el.classList.remove("is-held"); onUp(); });
}
/* Two fire buttons (right thumb, and a left one for firing while you
   steer), so firing is a count of thumbs down, not a flag either can clear
   for the other. The right one also aims while held: drag it like the look
   pad, the way CoD Mobile's fire button works. */
let firingThumbs = 0;
const fireDown = () => { firingThumbs++; touchState.firing = true; };
const fireUp = () => { firingThumbs = Math.max(0, firingThumbs - 1); touchState.firing = firingThumbs > 0; };
bindHold(els.touchFire, fireDown, fireUp);
if (els.touchFireL) bindHold(els.touchFireL, fireDown, fireUp);
/* A held button that also aims: drag it like the look pad. Fire, and the
   throwable (user: free look up and down while holding a grenade). */
function dragAims(el) {
  if (!el) return;
  let id = null;
  const last = { x: 0, y: 0, t: 0 };
  el.addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0];
    id = t.identifier; last.x = t.clientX; last.y = t.clientY; last.t = performance.now();
  }, { passive: true });
  el.addEventListener("touchmove", (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== id) continue;
      addTouchLook(t, last);
      touchState.looking = true;
    }
  }, { passive: false });
  const end = (e) => { for (const t of e.changedTouches) if (t.identifier === id) { id = null; touchState.looking = false; } };
  el.addEventListener("touchend", end);
  el.addEventListener("touchcancel", end);
}
dragAims(els.touchFire);
/* AIM is a tap toggle, like CoD Mobile's default: tap to scope in, tap
   again to come out, so the right thumb stays free to aim and shoot. */
function setTouchAds(on) {
  touchState.ads = on;
  els.touchAds.classList.toggle("is-on", on);
  els.touchAds.setAttribute("aria-pressed", String(on));
}
els.touchAds.addEventListener("touchstart", (e) => { e.preventDefault(); setTouchAds(!touchState.ads); }, { passive: false });
bindHold(els.touchJump, () => touchState.jump = true, () => touchState.jump = false);
bindHold(els.touchSlide, () => touchState.crouch = true, () => touchState.crouch = false);
els.touchReload.addEventListener("touchstart", (e) => { e.preventDefault(); tryReload(); });
els.touchMelee.addEventListener("touchstart", (e) => { e.preventDefault(); swingMelee(); });
// Touch cooks for as long as the button is held, same as the key.
bindHold(els.touchNade, () => startCook("lethal"), () => releaseCook());
dragAims(els.touchNade);
if (els.touchTac) bindHold(els.touchTac, () => startCook("tactical"), () => releaseCook());
dragAims(els.touchTac);
bindHold(els.touchInteract, () => touchState.interact = true, () => touchState.interact = false);
bindHold(els.touchSwap, () => { touchState.swap = true; if (warshipView()) toggleWarshipGun(); }, () => touchState.swap = false);
// Admire (inspect) the gun or melee in your hands, the T key on a keyboard.
els.touchAdmire?.addEventListener("touchstart", (e) => { e.preventDefault(); startInspect(); }, { passive: false });
// A tap, not a hold — and it doubles as the confirm for a marked spot, the
// same way the key and the d-pad do.
if (els.touchEndStreak) bindHold(els.touchEndStreak, () => { touchState.endStreak = true; }, () => { touchState.endStreak = false; });
if (els.touchStreak) {
  els.touchStreak.addEventListener("touchstart", (e) => { e.preventDefault(); callReadyStreak(); });
}
// Emotes on touch: tap to open the wheel (its slices are plain buttons
// without pointer lock), tap a slice to play it, tap EMOTE again to shut it.
// Duo invites are accepted by holding X, same as the key.
if (els.touchEmote) {
  els.touchEmote.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (emoteWheel.isOpen) emoteWheel.close(true);
    else if (gameState === "playing" && player.alive) emoteWheel.open();
    els.touchEmote.setAttribute("aria-expanded", String(emoteWheel.isOpen));
  }, { passive: false });
}

// -------------------- gamepad --------------------

function deadzone(v) { return Math.abs(v) < GP_DEADZONE ? 0 : v; }

/* Aim assist — a soft rotational pull toward whatever is already near the
   crosshair, the way GTA5's "assisted aim" (not the full auto-lock option)
   nudges an aim rather than replacing it. It runs on every input, but only
   while that input is actually steering: the right stick deflected, a thumb
   on the touch look pad, or the mouse/trackpad moved in the last moment —
   so it never drags an aim that's being held still. Mouse gets a softer
   pull and slowdown, since a cursor is already far more precise than a
   stick or thumb. */
const AIM_ASSIST_CONE_DEG = 7;   // ~14° wide search cone at the default (hip) FOV
const AIM_ASSIST_SLOWDOWN_DEG = 3.5;
const AIM_ASSIST_RANGE = 55;
const AIM_ASSIST_PULL = 3.4;       // rad/sec at the very centre of a lock
const AIM_ASSIST_SLOWDOWN = 0.45;  // multiplies the player's own look turn near a target
// Thumbs get less friction than a stick: at 0.45 tracking a strafing
// target on the look pad felt like dragging through mud.
const AIM_ASSIST_TOUCH_SLOWDOWN = 0.75;
const AIM_ASSIST_MOUSE_PULL = 0.5;       // share of the full pull a mouse gets
const AIM_ASSIST_MOUSE_SLOWDOWN = 0.72;  // gentler "sticky" for mouse turns
const MOUSE_ACTIVE_MS = 200;             // mouse counts as steering this long after it moves
let mouseLookAt = -Infinity;
let aimAssistSticky = false;   // crosshair is on a target this frame (read by the mouse handler)
const _aaOrigin = new THREE.Vector3();
const _aaForward = new THREE.Vector3();
const _aaToTarget = new THREE.Vector3();

/* Every point assist could lock onto this frame, as chest-height world
   positions. Players and bots come from occupants(); the zombies, wave
   grunts and range plates each keep their own lists, and used to be left
   out entirely, which is why assist seemed dead outside PvP. */
function aimAssistPoints() {
  const pts = [];
  const ffa = currentMode().ffa;
  for (const o of occupants()) {
    if (o.id === net.id) continue;
    if (!ffa && o.team === net.team) continue;
    pts.push({ x: o.pos.x, y: o.pos.y + 1.3, z: o.pos.z });
  }
  const bodies = [...(zdir?.zombies || []), ...(spawner?.grunts || [])];
  for (const e of bodies) {
    if (!e.alive || e.dying) continue;
    const p = e.mesh.position;
    pts.push({ x: p.x, y: p.y + e.type.height * 0.72, z: p.z });
  }
  for (const t of rangeSet?.targets || []) {
    if (t.down > 0) continue;
    const p = t.mesh.position;
    // the painted ring: pivot (0.9) + 34% of the 1.7 plate
    pts.push({ x: p.x, y: p.y + 0.9 + 1.7 * 0.34, z: p.z });
  }
  return pts;
}

/* Best point to assist toward right now, or null. Picks whatever is closest
   to the crosshair (not just closest in space) inside the search cone, with
   actual line of sight. */
function findAimAssistTarget(coneDeg = AIM_ASSIST_CONE_DEG, range = AIM_ASSIST_RANGE) {
  camera.getWorldPosition(_aaOrigin);
  camera.getWorldDirection(_aaForward);

  // The cone is a screen-space angle, not a world one: zoomed in (lower FOV)
  // the same enemy silhouette covers more of the screen, so the search cone
  // has to narrow with it or assist gets stronger while ADS/scoped and
  // weaker at hip-fire relative to what's actually on screen.
  const fovScale = camera.fov / baseFov;
  const cone = Math.cos(THREE.MathUtils.degToRad(coneDeg * fovScale));

  let best = null, bestDot = -Infinity;
  for (const pt of aimAssistPoints()) {
    _aaToTarget.set(pt.x - _aaOrigin.x, pt.y - _aaOrigin.y, pt.z - _aaOrigin.z);
    const dist = _aaToTarget.length();
    if (dist < 0.01 || dist > range) continue;
    _aaToTarget.multiplyScalar(1 / dist);

    const dot = _aaToTarget.dot(_aaForward);
    if (dot < cone || dot <= bestDot) continue;
    if (segmentBlocked(colliders, _aaOrigin, pt)) continue;
    bestDot = dot; best = { aim: pt, dot, cone };
  }
  return best;
}

/* Blends a rotational pull toward `target` into the look, and damps the
   player's own stick/thumb turn when it's already close — the "sticky" half
   GTA5 pairs with the pull. Both effects fall off with angle so the assist
   never overrides a deliberate flick past the target. */
function applyAimAssist(dt, strength = 1, coneDeg = AIM_ASSIST_CONE_DEG, range = AIM_ASSIST_RANGE) {
  if (!settings.aimAssist) return;
  const target = findAimAssistTarget(coneDeg, range);
  if (!target) return;

  camera.getWorldPosition(_aaOrigin);
  const a = target.aim;
  _aaToTarget.set(a.x - _aaOrigin.x, a.y - _aaOrigin.y, a.z - _aaOrigin.z).normalize();

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
  const edge = (target.dot - target.cone) / (1 - target.cone);
  const pull = AIM_ASSIST_PULL * strength * edge * dt;
  look.yaw += THREE.MathUtils.clamp(dYaw, -pull, pull);
  look.pitch += THREE.MathUtils.clamp(dPitch, -pull, pull);

  const fovScale = camera.fov / baseFov;
  const slowdownCone = Math.cos(THREE.MathUtils.degToRad(AIM_ASSIST_SLOWDOWN_DEG * fovScale));
  if (target.dot > slowdownCone) {
    aimAssistSticky = true;
    gamepadState.lookDX *= AIM_ASSIST_SLOWDOWN;
    gamepadState.lookDY *= AIM_ASSIST_SLOWDOWN;
    touchState.lookDX *= AIM_ASSIST_TOUCH_SLOWDOWN;
    touchState.lookDY *= AIM_ASSIST_TOUCH_SLOWDOWN;
  }
}

let gpWheelSwallow = false;   // the A/B that worked the emote wheel isn't a jump/crouch
const STICK_CHORD = 0.12;  // seconds a stick click waits for the other stick
let stickChord = null, gpDt = 0;
function pollGamepad(dt) {
  gpDt = dt;
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = gpIndex != null ? pads[gpIndex] : null;
  if (!gp) gp = Array.from(pads).find((p) => p && p.connected) || null;
  if (!gp) {
    gamepadState.connected = false;
    // Held-button state has to clear with the pad, or unplugging mid-hold
    // leaves `pickup` stuck on and the hold never releases.
    gamepadState.pickup = false;
    renderGpDebug(null);
    return;
  }
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

  // Merely having a gamepad connected isn't "playing with a controller" — a
  // trackpad or certain mice enumerate as a Gamepad object too, and this
  // function used to run (and pull aim toward enemies) every frame any pad
  // object existed, even completely idle. Assist should only ever nudge the
  // look that the controller itself is actively driving, so it's gated on
  // real right-stick deflection this frame, not on pad presence.
  const usingGamepadLook = lookX !== 0 || lookY !== 0;
  if (usingGamepadLook && player.alive && !isStaging() && !dragonfireView()) applyAimAssist(dt);

  const btn = (i) => !!gp.buttons[i]?.pressed;
  const pressedEdge = (i) => btn(i) && !gpPrev[i];
  if (killcam.active && !player.alive && pressedEdge(0)) skipKillcam();
  // Troll Royale, out: bumpers or the D-pad go round the players still alive.
  if (!player.alive && royaleSpectating()) {
    if (pressedEdge(4) || pressedEdge(14)) cycleSpectate(-1);
    if (pressedEdge(5) || pressedEdge(15)) cycleSpectate(1);
  }

  // The strike tablet takes the pad: either stick aims, A / R2 marks,
  // B undoes (and cancels with nothing marked). Nothing else fires.
  if (strikeTablet?.isOpen) {
    strikeTablet.stick(gamepadState.moveX + lookX, gamepadState.moveY + lookY, dt);
    gamepadState.lookDX = 0; gamepadState.lookDY = 0;
    gamepadState.moveX = 0; gamepadState.moveY = 0;
    if (pressedEdge(0) || pressedEdge(7)) strikeTablet.place();
    if (pressedEdge(1)) strikeTablet.undo();
    gamepadState.firing = false; gamepadState.jump = false; gamepadState.ads = false;
    gpPrev = {};
    for (let i = 0; i < gp.buttons.length; i++) gpPrev[i] = btn(i);
    return;
  }

  const firingNow = gp.buttons[7]?.value > 0.15 || btn(7);   // R2
  if (firingNow && !gamepadState.firing) { fireEdgeTrigger = true; setTimeout(() => fireEdgeTrigger = false, 16); }
  gamepadState.firing = firingNow;
  gamepadState.ads = gp.buttons[6]?.value > 0.15 || btn(6);      // L2
  gamepadState.jump = btn(0);                                     // A / cross
  gamepadState.crouch = btn(1);                                   // B / circle

  // The pause menu being open (with other people still live in the match)
  // keeps this function running so the Start button can still resume, but
  // every other action button must stop reaching the player's weapon/gear.
  if (!localPauseOnly) {
    if (pressedEdge(4)) tryReload();          // L1 -> reload (kept off fire face buttons)
    if (pressedEdge(2)) swingMelee();         // X / square -> melee
    // Stick clicks (user): both sticks together open the emote wheel; one
    // alone is the swivel to that side. Decided STICK_CHORD s after the
    // first click, so the second stick of a chord isn't read as a swivel.
    // A single emote button can be set on the Settings controller card
    // (controller-layout.js padEmoteButton) instead.
    if (padEmotePressed(gp, pressedEdge)) emoteWheel.toggle(gameState === "playing" && player.alive);
    if (!stickChord && (pressedEdge(10) || pressedEdge(11))) stickChord = { t: 0, l: false, r: false, done: false };
    if (stickChord) {
      stickChord.t += gpDt;
      stickChord.l ||= btn(10);
      stickChord.r ||= btn(11);
      if (!stickChord.done && stickChord.l && stickChord.r) {
        stickChord.done = true;
        emoteWheel.toggle(gameState === "playing" && player.alive);
      } else if (!stickChord.done && stickChord.t >= STICK_CHORD) {
        stickChord.done = true;
        trySwivel(stickChord.l ? -1 : 1);
      }
      if (stickChord.done && !btn(10) && !btn(11)) stickChord = null;
    }
    if (pressedEdge(3)) cycleWeapon();        // Y / triangle -> cycle primary/secondary/melee
    // R1 -> cook whatever throwable you brought. It used to be lethal-only,
    // so a loadout carrying a flash/smoke/EMP threw nothing on RB (user:
    // "throwable doesn't work on controller").
    if (pressedEdge(5)) startCook(carriedThrowSlot());
    if (gpPrev[5] && !btn(5)) releaseCook();
    // D-pad left does the same (NOT L1 — L1 is reload above, and one button
    // doing both would reload every time you threw a flash).
    if (pressedEdge(14)) startCook(carriedThrowSlot());
    if (gpPrev[14] && !btn(14)) releaseCook();
    if (pressedEdge(12)) startInspect();      // D-pad up -> admire the weapon
    // Emote wheel open (both sticks, above): the right stick points at a
    // slice instead of turning the view, Cross/A plays it, Circle/B closes.
    // A held A or B doesn't jump or crouch.
    if (emoteWheel.isOpen) {
      emoteWheel.aim(gp.axes[2] || 0, gp.axes[3] || 0);
      gamepadState.lookDX = 0; gamepadState.lookDY = 0;
      if (pressedEdge(0)) emoteWheel.close();
      else if (pressedEdge(1)) emoteWheel.close(true);
      gpWheelSwallow = true;
    }
    if (gpWheelSwallow) {
      if (btn(0) || btn(1)) { gamepadState.jump = false; gamepadState.crouch = false; }
      else if (!emoteWheel.isOpen) gpWheelSwallow = false;
    }
    if (pressedEdge(8)) toggleThirdPerson();  // Select/View/Minus -> camera toggle

    // D-pad down cycles which ready streak d-pad right will fire — a pick,
    // not a use, since the pad has a button to spare for it and keyboard's
    // single-button "4" doesn't need one.
    if (pressedEdge(13)) cycleSelectedStreak();
    // D-pad right is context-dependent, the same way holding X already is:
    // over a dropped weapon or a landed package, hold it to pick up/open —
    // otherwise it fires whichever streak is currently selected. Checked
    // here (edge-triggered) only when nothing is underfoot; the hold case is
    // handled below by updatePickupPrompt reading gamepadState.pickup.
    // In a streak, d-pad right is the hold-to-end (updateStreakControl).
    // A quick tap while marking still confirms the mark, on release so a
    // hold that's ending it never confirms on the way.
    if (pressedEdge(15) && streakControlActive()) {
      streakEnd.padAt = performance.now();
      streakEnd.padShort = !!markingStreak;
    } else if (pressedEdge(15) && !nearbyPackage() && !pickups.nearest(move.pos.x, move.pos.z)
        && !(isSnd() && sndCanInteract)) {
      useSelectedStreak();
    }
    if (gpPrev[15] && !btn(15) && streakEnd.padAt) {
      if (streakEnd.padShort && markingStreak && performance.now() - streakEnd.padAt < 300) useSelectedStreak();
      streakEnd.padAt = 0;
      streakEnd.padShort = false;
    }
  }
  // D-pad right, held: the pad's equivalent of holding X for swap/pickup/
  // open. Read as a level because all three are holds, and gated on the
  // pause the same way every other action button is. Whether this or the
  // edge-triggered streak-fire above actually does anything is decided by
  // updatePickupPrompt/useSelectedStreak looking at what's underfoot, same
  // question both ask.
  gamepadState.pickup = !localPauseOnly && btn(15) && !streakControlActive();
  gamepadState.endStreak = !localPauseOnly && btn(15);
  if (pressedEdge(9)) {                     // Start/Home -> same as the on-screen gear icon
    if (controls.isLocked) controls.unlock();
    else openPauseMenu();
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
  if (pressed && !gpMenuPrev[9] && !els.pause.hidden) {
    // A pad press isn't a gesture the browser accepts for pointer lock, so
    // asking for one here always failed and Start never resumed. The pad
    // doesn't need the mouse: close the menu and play.
    closePauseMenu();
    controls.lock();
  }
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

    // Bots wanting their own labeled span (rather than reusing `.to-kf-tag`,
    // which the assist/weapon slot below is also using) keeps a bot kill
    // from ever being mistaken for a headshot or an assist at a glance.
    const nameSpan = (text, team, isBot) => {
      const frag = document.createDocumentFragment();
      const s = document.createElement("span");
      s.className = "to-kf-name";
      // `.ui` is the CSS string; `.color` is a hex number for three.js.
      if (team && TEAMS[team]) s.style.color = TEAMS[team].ui;
      s.textContent = text;
      frag.appendChild(s);
      if (isBot) {
        const bot = document.createElement("span");
        bot.className = "to-kf-bot";
        bot.textContent = "BOT";
        frag.appendChild(bot);
      }
      return frag;
    };

    div.appendChild(nameSpan(entry.killer, entry.killerTeam, entry.killerIsBot));

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
      if (entry.tag) {
        const tag = document.createElement("span");
        tag.className = "to-kf-tag";
        tag.textContent = entry.tag;
        div.appendChild(tag);
      }
    }

    // A suicide is one name, not "grinbot → grinbot".
    if (!entry.suicide) {
      const arrow = document.createElement("span");
      arrow.className = "to-kf-arrow";
      arrow.textContent = "→";
      div.appendChild(arrow);
      div.appendChild(nameSpan(entry.victim, entry.victimTeam, entry.victimIsBot));
    }
  }

  els.killfeed.appendChild(div);
  // Keep the feed from growing without bound in a busy match.
  while (els.killfeed.children.length > 6) els.killfeed.firstChild.remove();
  setTimeout(() => div.remove(), 2700);
}

/* `killed` is only ever true when the caller already knows the shot was
   lethal in the same synchronous step (a bot, a grunt, our own registerDeath)
   — a peer's death confirmation comes back over the wire later and marks
   itself there instead, so this never has to guess. */
function showHitmarker(isCrit, damage = 0, point = null, killed = false) {
  audio.hitmarker(isCrit);
  els.hitmarker.classList.remove("pop");
  els.hitmarker.classList.toggle("is-crit", isCrit);
  els.hitmarker.classList.toggle("is-kill", killed);
  void els.hitmarker.offsetWidth;
  els.hitmarker.classList.add("pop");
  if (damage > 0 && point) spawnDamageNumber(damage, point, isCrit);
}

/* Damage numbers that live in the world: they start at the point the round
   actually landed and drift up from there, so a burst across a moving target
   leaves a legible trail instead of stacking in the middle of the screen. */
const damageNumbers = [];
const DAMAGE_NUMBER_LIFE = 0.9;

function spawnDamageNumber(damage, point, isCrit, text = null) {
  const el = document.createElement("span");
  el.className = "to-dmg-num" + (isCrit ? " is-crit" : "") + (text ? " is-word" : "");
  el.textContent = text || String(Math.round(damage));
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

/* Hit-direction markers: one red arc round the crosshair per attacker,
   pointing where the hit came from. The arc holds the attacker's position
   at the moment of the hit, not where they go after — it says "from there",
   it isn't a wallhack — and turns as you turn. A fresh hit from the same
   source refreshes its arc rather than stacking another. */
const HITDIR_LIFE = 1.6;
const HITDIR_MAX = 6;
const hitDirs = new Map();   // source key -> { el, x, z, t }
const _hitDirFwd = new THREE.Vector3();

/* Flinch whoever was hit, away from whoever hit them — the local player's
   own body included. Cosmetic: a peer may never know its rig flinched here. */
const _flinchDir = new THREE.Vector3();
function flinchPeer(targetId, fromId, isHead, fromPos = null) {
  const rig = targetId === net.id ? localRig : remotes.byId.get(targetId)?.rig;
  if (!rig) return;
  const from = fromPos || (fromId === net.id ? move.pos : (remotes.byId.get(fromId)?.pos || bots.byId(fromId)?.pos));
  if (!from) { flinchRigFrom(rig, _flinchDir.set(0, 0, 0), isHead ? 1 : 0.5); return; }
  _flinchDir.subVectors(rig.root.position, from);
  _flinchDir.y = 0;
  if (_flinchDir.lengthSq() < 1e-6) _flinchDir.set(0, 0, 1);
  flinchRigFrom(rig, _flinchDir.normalize(), isHead ? 1 : 0.5);
}

function noteHitDirection(fromId, fromPos = null) {
  if (fromId && fromId === net.id) return;   // your own grenade: you know where it was
  const pos = fromPos || (fromId ? (remotes.byId.get(fromId)?.pos || bots.byId(fromId)?.pos) : null);
  if (!pos || !els.hitdir) return;
  const key = fromId || `${Math.round(pos.x)},${Math.round(pos.z)}`;
  let h = hitDirs.get(key);
  if (!h) {
    if (hitDirs.size >= HITDIR_MAX) {
      const [oldKey, old] = hitDirs.entries().next().value;
      old.el.remove();
      hitDirs.delete(oldKey);
    }
    const el = document.createElement("div");
    el.className = "to-hitdir-mark";
    els.hitdir.appendChild(el);
    h = { el };
    hitDirs.set(key, h);
  }
  h.x = pos.x;
  h.z = pos.z;
  h.t = HITDIR_LIFE;
  updateHitDirs(0);
}

function updateHitDirs(dt) {
  if (!hitDirs.size) return;
  camera.getWorldDirection(_hitDirFwd);
  const fl = Math.hypot(_hitDirFwd.x, _hitDirFwd.z) || 1;
  const fx = _hitDirFwd.x / fl, fz = _hitDirFwd.z / fl;
  for (const [key, h] of hitDirs) {
    h.t -= dt;
    if (h.t <= 0) { h.el.remove(); hitDirs.delete(key); continue; }
    const tx = h.x - move.pos.x, tz = h.z - move.pos.z;
    // Bearing from straight ahead, clockwise: right of you is +90°.
    const deg = Math.atan2(tx * -fz + tz * fx, tx * fx + tz * fz) * 180 / Math.PI;
    h.el.style.transform = `rotate(${deg.toFixed(1)}deg)`;
    h.el.style.opacity = Math.min(1, h.t / 0.5).toFixed(2);
  }
}

function clearHitDirs() {
  for (const h of hitDirs.values()) h.el.remove();
  hitDirs.clear();
}

function showWaveBanner(text, ms = 1800) {
  els.waveBanner.textContent = text;
  els.waveBanner.classList.add("is-visible");
  clearTimeout(showWaveBanner._t);
  showWaveBanner._t = setTimeout(() => els.waveBanner.classList.remove("is-visible"), ms);
}

/* The scorestreak strip: a meter toward the cheapest streak that isn't ready
   yet, then one row per selected streak. Rebuilt only when the set of rows
   changes; the meter itself is just a width. */
const STREAK_ICON_URL = (id) => new URL(`./streak-icons/${id}.png?v=ss3`, import.meta.url).href;

function updateStreakHud() {
  if (!els.ssHud) return;
  const on = streaksAllowed(currentMode()) && (streaks.selected.length > 0 || streaks.readyIds().length > 0);
  els.ssHud.hidden = !on;
  // On a phone the button only exists when there's something to call —
  // an always-on dead button is just lost screen space.
  if (els.touchStreak) {
    // Touch calls a streak by tapping its row; this button is only the
    // big "drop it here" confirm while one is being marked.
    els.touchStreak.hidden = !isTouch || !on || !markingStreak;
  }
  if (!on) return;

  const next = streaks.nextProgress();
  els.ssMeterFill.style.width = next ? `${Math.round(next.frac * 100)}%` : "100%";

  const onPad = gamepadState.connected && !isTouch;
  const key = onPad ? "→" : "4";
  const selId = streaks.ready(selectedStreak) ? selectedStreak : readyStreaksOrdered()[0];
  // On a pad, a ready streak also needs to show WHICH one d-pad right will
  // fire — d-pad down moved off "call directly" onto "pick", so the ready
  // key alone no longer says that.
  // A care package can grant a streak outside the loadout's three picks
  // (rollPackageReward/grant) — it still needs its own slot or securing the
  // package looks like it did nothing.
  const slotIds = streakSlotIds();
  const freshId = freshStreak && performance.now() < freshStreak.until ? freshStreak.id : "";
  // A ready Dragonfire says so when you're somewhere it can't launch from.
  const dfWhy = slotIds.includes("dragonfire") && streaks.ready("dragonfire") ? dragonfireBlocked() : null;
  const signature = `${key}|${onPad || isTouch ? selId : ""}|${markingStreak || ""}|${freshId}|${dfWhy || ""}|`
    + slotIds.map((id) => `${id}:${streaks.ready(id) ? 1 : 0}:${Math.ceil(streakLockLeft(id))}`).join("|");
  if (els.ssSlots.dataset.sig !== signature) {
    els.ssSlots.dataset.sig = signature;
    els.ssSlots.innerHTML = "";
    slotIds.forEach((id, slot) => {
      const def = STREAK_DEFS[id];
      const lock = Math.ceil(streakLockLeft(id));
      const ready = streaks.ready(id) && !lock;
      const isSelected = (onPad || isTouch) && ready && id === selId;
      const row = document.createElement("div");
      const fresh = ready && freshStreak && freshStreak.id === id && performance.now() < freshStreak.until;
      const skyBlocked = id === "dragonfire" && ready && dfWhy;
      row.className = `to-ss-slot${ready ? " is-ready" : ""}${skyBlocked ? " is-blocked" : ""}${lock ? " is-locked" : ""}${isSelected ? " is-selected" : ""}${id === markingStreak ? " is-marking" : ""}${fresh ? " is-fresh" : ""}`;
      // Touch: tap a row to call that streak (the pad and keyboard have keys).
      if (isTouch && ready) {
        row.setAttribute("role", "button");
        row.setAttribute("aria-label", `Call ${def.name}`);
        row.addEventListener("touchstart", (e) => { e.preventDefault(); e.stopPropagation(); callStreakSlot(slot); }, { passive: false });
      }
      // A picture of the streak, not its name (user, 2026-09-28): rendered
      // from the game's own models (models/render_streak_icons.blender.py).
      // Ready = lit with a green rim; not yet = dimmed grey.
      const img = document.createElement("img");
      img.className = "to-ss-img";
      img.src = STREAK_ICON_URL(id);
      img.alt = "";
      img.draggable = false;
      row.appendChild(img);
      // BO2: every streak carries its badge (tier metal + its symbol) and its
      // name, with the cost under it until it's earned, then how to call it.
      const badge = document.createElement("i");
      badge.className = "to-ss-badge";
      badge.innerHTML = streakBadgeSvg(id, { dim: !ready });
      row.appendChild(badge);
      const cap = document.createElement("div");
      cap.className = "to-ss-cap";
      const nm = document.createElement("b");
      nm.textContent = streakShortName(id);
      const sub = document.createElement("span");
      sub.textContent = lock ? `${streakLockWhy[id] === "jammed" ? "JAMMED" : "COOLDOWN"} ${lock}s`
        : skyBlocked ? DF_BLOCK_TEXT[dfWhy]
        : ready ? (isTouch ? "READY · TAP" : `READY · ${onPad ? "→" : streakKeyLabel(id)}`) : `${def.cost}`;
      cap.append(nm, sub);
      row.appendChild(cap);
      if (skyBlocked) {
        // A roof over the picture: get outside to fly it.
        const tag = document.createElement("em");
        tag.className = "to-ss-sky";
        tag.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M4 4l16 16"/></svg>`;
        row.appendChild(tag);
      }
      row.title = `${def.name}${skyBlocked ? ` (${dfWhy === "covered" ? "needs open sky overhead" : "too confined here"}: get outside)` : ""}${lock ? ` (${streakLockWhy[id] === "jammed" ? "jammed" : "cooldown"}, ${lock}s)` : ready ? " (ready)" : `: ${def.cost}`}`;
      if (!row.hasAttribute("aria-label")) row.setAttribute("aria-label", row.title);
      els.ssSlots.appendChild(row);
    });
  }
}

// -------------------- weapon actions --------------------

function currentWeapon() {
  const id = currentWeaponSlot === "secondary" ? player.secondaryId : player.weaponId;
  return player.weapons[id] || player.weapons[player.weaponId];
}

function tryReload() {
  if (!controls.isLocked && !isTouch && !gamepadState.connected) return;
  // audio.reload() now fires from reloadPose() on the first frame w.reloading
  // is true, so it lands in step with the visual choreography's stages
  // rather than at the exact instant this input handler runs.
  currentWeapon().startReload();
}

/* `shot` (charge weapons, from chargedShotDef): the def this round flies
   with, the cells it costs, its recoil scale and charge level. */
function fireOnce(shot = null) {
  const w = currentWeapon();
  const def = shot?.def || w.def;
  if (!w.canFire()) {
    if (w.ammoInMag <= 0 && !w.reloading) tryReload();
    return;
  }
  w.fire(shot?.cells ?? 1, shot?.kick ?? 1);
  if (w.def.charge) {
    w.lastShotLevel = shot?.level ?? 0;
    w.shotFlare = 1;
  }
  inspectT = 0;      // shooting always wins over the flourish
  breakSpawnGuard();
  audio.shot(def);
  // Camera shake per shot, shaped by the weapon's shake stats and its
  // attachments. Shouldering the gun steadies it, as with the recoil.
  kickFireShake(def, 1 - w.adsT * 0.35);
  muzzleFlashT = 0.045;
  muzzleLight.intensity = 0.35;
  muzzleMat.uniforms.uColor.value.setHex(def.muzzleColor ?? 0xfff2c0);
  muzzleLight.color.setHex(def.muzzleColor ?? 0xffcf8a);

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
  if (isPvp()) net.reportShot(muzzle, forward, def.id, !!def.quiet, shot?.level ?? 0);
  if (royale && !def.quiet) royaleNoise(move.pos.x, move.pos.z, net.id);

  for (let i = 0; i < pellets; i++) {
    // A charged bolt holds its line: the charge steadies the cone.
    const spread = (def.pelletSpread != null ? def.pelletSpread : w.spread) * (1 - 0.7 * (shot?.level ?? 0));
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

/* An enemy Dragonfire's or SAM Turret's hit volume. */
function resolveStreakKit(object) {
  const e = object?.userData?.air || object?.userData?.sam;
  return e ? { isStreakKit: true, entity: e } : null;
}

function resolveBulletTarget(object) {
  return resolveStreakKit(object)
    || resolveK9(object)
    || rangeSet?.resolve(object)
    || remotes.resolve(object)
    || zdir?.resolve(object)
    || findGruntFromObject(object);
}

function onBulletActorHit(actor, info) {
  if (actor.isStreakKit) {
    damageStreakEntity(actor.entity, info.damage, net.id);
    showHitmarker(false, info.damage, info.point, false);
    impactFx.hit(info.point, { normal: info.dir.clone().negate(), dir: info.dir, surface: "metal", scale: 1 });
    spawnImpactBurst(info.point, 0xffd08a, 5);
    return;
  }
  if (actor.isK9Dog) {
    // An enemy dog: its owner applies the damage (damageDog forwards it).
    damageDog(actor.pack, actor.i, info.damage, net.id);
    showHitmarker(false, info.damage, info.point, false);
    impactFx.hit(info.point, { normal: info.dir.clone().negate(), dir: info.dir, surface: "zombie", scale: 0.9 });
    return;
  }

  if (actor.isRangeTarget) {
    const { killed } = actor.takeDamage(info.damage, info.isHead);
    showHitmarker(info.isHead, info.damage, info.point, killed);
    impactFx.hit(info.point, { normal: info.dir.clone().negate(), dir: info.dir, surface: "wood", scale: info.isHead ? 1.4 : 1 });
    reportRangeShot(actor, info, killed);
    return;
  }

  if (actor.isZombie) {
    const { killed, points } = actor.takeDamage(info.damage, info.isHead);
    zdir.award(points);
    showHitmarker(info.isHead, info.damage, info.point, killed);
    impactFx.hit(info.point, { normal: info.dir.clone().negate(), dir: info.dir, surface: "zombie", scale: info.isHead ? 1.5 : 1.1 });
    if (actor.rig) flinchRigFrom(actor.rig, info.dir, info.isHead ? 1 : 0.5);
    else actor.flinchFrom?.(info.dir, info.isHead ? 1 : 0.5);
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
    const shotWith = info.creditAs || currentWeapon().def.id;
    let killedNow = false;
    if (bots.byId(actor.netId)) {
      const { killed, bot } = bots.applyHit(actor.netId, info.damage);
      killedNow = killed;
      if (killed) {
        dealtLog.delete(actor.netId);
        net.reportDeathAs(actor.netId, net.id, shotWith, info.isHead);
        registerDeath(bot.name, net.id, shotWith, {
          head: info.isHead, victimTeam: bot.team, victimIsBot: true,
          victimPos: bot.pos, victimWeaponId: bot.weaponId,
          victimId: bot.id, distance: info.distance || 0,
        });
      }
    } else {
      net.reportHit(actor.netId, info.damage, info.isHead, shotWith);
      // A peer applies its own damage and reports its own death, so the range
      // we hit it from is only known here. Remember the last one per target
      // so the kill that comes back off the wire can still be a Longshot.
      lastHitRange.set(actor.netId, info.distance || 0);
    }
    showHitmarker(info.isHead, info.damage, info.point, killedNow);
    impactFx.hit(info.point, { normal: info.dir.clone().negate(), dir: info.dir, surface: "ink", scale: info.isHead ? 1.5 : 1.1 });
    if (actor.rig) flinchRigFrom(actor.rig, info.dir, info.isHead ? 1 : 0.5);
    return;
  }
  onGruntBulletHit(actor, info);
}

function onGruntBulletHit(grunt, { damage, isHead, point, dir }) {
  const knockDir = dir.clone(); knockDir.y = 0; knockDir.normalize();
  const result = grunt.takeDamage(damage, isHead, knockDir);
  showHitmarker(isHead, damage, point, result.killed);
  impactFx.hit(point, { normal: dir.clone().negate(), dir, surface: "grunt", scale: isHead ? 1.5 : 1.1 });
  if (grunt.rig) flinchRigFrom(grunt.rig, dir, isHead ? 1 : 0.5);
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

const grenades = new GrenadeSystem(scene, lightPool);

/* Whatever the bullets are allowed to hit this frame. Hoisted out of the
   frame loop because melee and blasts need the same list. */
let targetMeshes = [];

/* Everything alive that a blast could reach, as { actor, pos } pairs. The
   three enemy systems keep their own arrays, so this is the one place that
   has to know about all of them. */
function blastCandidates(sparedTeam = net.team) {
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
  // Teammates are out: bullets already spare them (hitMeshes skips your own
  // side), and a frag or an airstrike that didn't was a free teamkill that
  // also scored for your side. `sparedTeam` is the thrower's side — ours,
  // unless this is someone else's flash going off on our screen.
  const ffa = !!currentMode().ffa;
  for (const rp of remotes.byId.values()) {
    if (!rp.alive) continue;
    if (!ffa && sparedTeam && rp.team === sparedTeam) continue;
    out.push({ actor: rp, pos: rp.pos });
  }
  if (rangeSet) {
    for (const t of rangeSet.targets) {
      if (t.down <= 0) out.push({ actor: t, pos: t.mesh.position });
    }
  }
  // Enemy dogs: a frag or a strike takes them out too. Never our own pack.
  for (const e of streakEntities.values()) {
    if (!(e instanceof K9Pack) || e.owned) continue;
    if (!ffa && sparedTeam && e.team === sparedTeam) continue;
    for (const d of e.dogs) if (d?.alive) out.push({ actor: d, pos: d.pos });
  }
  return out;
}

/* Radial damage. Torso height is added to each target so a grenade resting
   on the floor still measures to a standing chest, not a pair of boots. */
function areaDamage(centre, radius, damage, def, { fire = false, creditAs = null, botId = null } = {}) {
  const scaled = { ...def, radius, damage, minDamage: fire ? damage * 0.5 : def.minDamage };
  if (botId) { botAreaDamage(botId, centre, scaled, def); return; }
  for (const { actor, pos } of blastCandidates()) {
    const torso = pos.clone();
    torso.y += 0.9;
    const dmg = blastDamage(scaled, centre.distanceTo(torso));
    if (dmg <= 0) continue;
    const dir = torso.clone().sub(centre);
    dir.y = 0;
    dir.normalize();
    // `creditAs` names the thing that actually did this, for blasts that
    // aren't the gun in your hands — an airstrike kill credited to whatever
    // rifle you happened to be holding reads as a bug.
    onBulletActorHit(actor, { damage: dmg, isHead: false, point: torso, dir, creditAs });
  }

  // Your own grenade counts. Cooking one too long has to cost you.
  if (player.alive) {
    const selfDmg = blastDamage(scaled, centre.distanceTo(player.pos)) * (def.selfMult ?? 1);
    if (selfDmg > 0) damagePlayer(selfDmg, net.id, def.id);
  }
}

/* A bot's grenade (we host the bot). Same falloff as ours, but it's the
   bot's blast: it spares the bot's own side, not ours, and every hit is
   reported under the bot's id so the killfeed and scores credit it. */
function botAreaDamage(botId, centre, scaled, def) {
  const bot = bots.byId(botId);
  if (!bot) return;   // the bot left with its grenade in the air
  const ffa = !!currentMode().ffa;
  if (player.alive && (ffa || bot.team !== net.team)) {
    const dmg = blastDamage(scaled, centre.distanceTo(player.pos));
    if (dmg > 0) botDealDamage(bot, net.id, dmg, false, def.id);
  }
  for (const rp of remotes.byId.values()) {
    if (!rp.alive || rp.netId === bot.id) continue;
    if (!ffa && rp.team === bot.team) continue;
    const dmg = blastDamage(scaled, centre.distanceTo(_blastTorso.copy(rp.pos).setY(rp.pos.y + 0.9)));
    if (dmg > 0) botDealDamage(bot, rp.netId, dmg, false, def.id);
  }
}
const _blastTorso = new THREE.Vector3();

let botNadesThrown = 0;

/* A bot throws. bots.js decided that it should and where it wants the
   grenade to land; this works out the arc, puts the grenade in the world
   and tells the room, exactly as releaseCook does for the player. `lob`
   takes the high arc, for dropping one over cover rather than into it. */
function botThrow(bot, kind, at, lob = false) {
  const def = THROWABLE_DEFS[kind];
  if (!def || !bot.alive) return false;
  const origin = new THREE.Vector3(bot.pos.x, bot.pos.y + 1.6, bot.pos.z);
  const dx = at.x - origin.x, dz = at.z - origin.z;
  const flat = Math.hypot(dx, dz);
  if (flat < 1) return false;
  bot.yaw = Math.atan2(-dx, -dz);
  // Frags skip and roll on after they land: aim a little short.
  const d = flat * (def.roll > 0.3 ? 0.84 : 0.95);
  const dy = (at.y ?? bot.pos.y) - origin.y;
  const v = def.throwSpeed, g = GRENADE_GRAVITY;
  const disc = v ** 4 - g * (g * d * d + 2 * dy * v * v);
  const angle = disc < 0 ? Math.PI / 4
    : Math.atan((v * v + (lob ? 1 : -1) * Math.sqrt(disc)) / (g * d));
  const dir = new THREE.Vector3(dx / flat * Math.cos(angle), Math.sin(angle), dz / flat * Math.cos(angle));
  origin.addScaledVector(dir, 0.5);

  // Flight time sets the fuse: a skilled bot cooks a frag so it goes off
  // about when it lands, with no time to run. A flash always gets to land.
  const flight = d / Math.max(0.1, v * Math.cos(angle));
  let fuse = def.fuse;
  if (def.cookable && def.damage > 0 && bot.diff.nade.cook) fuse = Math.max(flight + 0.35, def.fuse - 1.2);
  if (def.blind) fuse = Math.max(fuse, flight + 0.1);

  const gid = nextNadeId(bot.id);
  const gr = grenades.throwGrenade(def, origin, dir, bot.id, { fuseLeft: fuse, gid, team: bot.team });
  gr.botId = bot.id;
  noteThrow(bot.id);   // the host never hears its own bots' `nade` messages
  if (isPvp() && net.active) {
    net.publishNadeAs(bot.id, bot.team, {
      action: "throw", gid, def: def.id, fuse: round2(fuse),
      ox: round2(origin.x), oy: round2(origin.y), oz: round2(origin.z),
      dx: round2(dir.x), dy: round2(dir.y), dz: round2(dir.z),
    });
  }
  botNadesThrown++;
  return true;
}

/* Everything about a blast that isn't damage: light, sparks, sound, shove. */
function explosionFx(def, pos) {
  const big = def.kind === "tactical" ? 0.5 : 1;
  spawnImpactBurst(pos, def.glow, def.kind === "tactical" ? 14 : 26);

  const flash = lightPool.acquire("point", scene, { color: def.glow, intensity: 260 * big, distance: def.radius * 2.6 });
  if (flash) {
    flash.position.copy(pos);
    blastLights.push({ light: flash, life: 0.3, max: 0.3, peak: 260 * big });
  }

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
    if (b.life <= 0) { lightPool.release(b.light); blastLights.splice(i, 1); }
  }
}

/* Flashbangs only blind what can see them, so a wall is real cover and
   turning away actually helps. */
/* Whether a grenade is a teammate's — which spares us, same as their frags
   do. Our own still gets us: that's the price of a bad throw. */
function friendlyNade(g) {
  return !!(g?.remote || g?.botId) && !currentMode().ffa && !!net.team && g.team === net.team;
}

/* The side a grenade belongs to: ours, unless someone else threw it (a remote
   player, or a bot we simulate). */
function nadeTeam(g) {
  return g?.remote || g?.botId ? g.team : net.team;
}

function flashPlayer(pos, def, g = null) {
  const dist = pos.distanceTo(player.pos);
  // Smoke eats a flash the same way a wall does.
  if (!friendlyNade(g) && dist <= def.radius && !segmentBlocked(colliders, player.pos, pos)
      && !grenades.blocksSight(player.pos, pos)) {
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const toBang = pos.clone().sub(player.pos).normalize();
    const facing = Math.max(0, forward.dot(toBang));   // 1 = staring right at it
    const strength = (1 - dist / def.radius) * (0.35 + facing * 0.65);
    blindT = Math.max(blindT, def.blind * strength);
    audio.flashbang(strength, pos);
  }

  for (const { actor, pos: apos } of blastCandidates(nadeTeam(g))) {
    if (pos.distanceTo(apos) > def.radius) continue;
    if (segmentBlocked(colliders, apos, pos)) continue;
    if (grenades.blocksSight(apos, pos)) continue;
    if (g?.botId && actor.netId === g.botId) continue;
    stunActor(actor, def.stun);
  }
}

/* A bot shows up in blastCandidates as its RemotePlayer render proxy, which
   has no stun() — the real Bot we simulate does. Grunts and zombies take it
   directly. A remote human's stun happens on their own client. */
function stunActor(actor, seconds) {
  const bot = actor.netId ? bots.byId(actor.netId) : null;
  (bot || actor).stun?.(seconds);
}

function applyEmpState(on) {
  els.emp.classList.toggle("is-on", on);
  els.hud.classList.toggle("to-emp-down", on);
}

/* EMP: no damage, no blindness — it takes your gear away. Optics go dark,
   the HUD scrambles, and the radar stops updating, so you have to fight the
   room on what you can actually see. Walls stop it; smoke doesn't. */
function empPlayer(pos, def, g = null) {
  const dist = pos.distanceTo(player.pos);
  if (!friendlyNade(g) && dist <= def.radius && !segmentBlocked(colliders, player.pos, pos)) {
    const strength = 1 - dist / def.radius;
    empT = Math.max(empT, def.emp.scramble * (0.4 + strength * 0.6));
    audio.empHit();
  }

  // Bots are scrambled even when we weren't — this used to return early the
  // moment we were out of range, so an EMP thrown at a bot never reached it.
  for (const { actor, pos: apos } of blastCandidates(nadeTeam(g))) {
    if (pos.distanceTo(apos) > def.radius) continue;
    if (segmentBlocked(colliders, apos, pos)) continue;
    // Bots run on sight, so scrambling them reads as a short stun.
    stunActor(actor, def.emp.scramble * 0.35);
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
    onDetonate: (g, pos) => publishBoom(g.gid, g.def, pos, g.botId ? bots.byId(g.botId) : null),
  };
}

/* Tell the room where our grenade actually went off. */
function publishBoom(gid, def, pos, bot = null) {
  if (!gid || !isPvp() || !net.active) return;
  const payload = { action: "boom", gid, def: def.id, x: round2(pos.x), y: round2(pos.y), z: round2(pos.z) };
  if (bot) net.publishNadeAs(bot.id, bot.team, payload);
  else net.publishNade(payload);
}

let nadeSeq = 0;
/* A bot's grenades carry the bot's id, so nobody counting "grenades that
   client threw" by prefix mistakes the host's bots for the host. */
function nextNadeId(ownerId = net.id) { return `${ownerId}-${++nadeSeq}`; }

/* Someone else's throwable, from their `throw`/`boom` messages. */
function applyRemoteNade(m) {
  if (gameState !== "playing") return;
  const def = THROWABLE_DEFS[m.def];
  if (!def) return;
  if (m.action === "throw") {
    noteThrow(m.id);
    const origin = new THREE.Vector3(m.ox, m.oy, m.oz);
    const dir = new THREE.Vector3(m.dx, m.dy, m.dz).normalize();
    grenades.throwGrenade(def, origin, dir, m.id, {
      fuseLeft: Number.isFinite(m.fuse) ? m.fuse : def.fuse, remote: true, gid: m.gid, team: m.team,
    });
  } else if (m.action === "boom") {
    grenades.remoteBoom(m.gid, def, new THREE.Vector3(m.x, m.y, m.z), m.id, m.team, grenadeCtx());
  }
}

/* Someone we can see threw something: their rig plays the overhand arm. */
function noteThrow(id) {
  const p = net.peers.get(id);
  if (p) p.throwSeq = (p.throwSeq | 0) + 1;
}

function refillGear() {
  player.gear.lethal = loadout.carried("lethal");
  player.gear.tactical = loadout.carried("tactical");
}

/* The one throwable slot a loadout carries: lethal or tactical. */
function carriedThrowSlot() {
  return loadout.throwKind === "tactical" ? "tactical" : "lethal";
}

/* Cooking: holding the key starts the fuse while the grenade is still in
   your hand. Impact throwables ignore it — they go off where they land. */
function startCook(slot) {
  if (cooking.def || !player.alive || gameState !== "playing" || isStaging() || isInfected()) return;
  if (streakBusy()) return;   // no throwables while working a streak (user)
  if (player.gear[slot] <= 0) return;
  const def = slot === "lethal" ? loadout.lethal : loadout.tactical;
  cooking.def = def;
  cooking.slot = slot;
  cooking.fuse = def.fuse;
}

/* Put a cooking throwable back unthrown and unspent. Dying, pausing, a lost
   pointer lock and a hidden tab all end a cook: the key-up that would have
   thrown it never arrives (or arrives on the death cam, which used to throw
   a grenade from wherever the killcam happened to be looking), and a cook
   left set blocked every later throw until the next match. */
function cancelCook() {
  if (!cooking.def) return;
  cooking.def = null;
  cooking.slot = null;
  cooking.fuse = 0;
  els.cook.hidden = true;
}

/* `cookedOff`: the fuse ran out in the hand. The grenade is spent but never
   thrown — this used to throw it anyway with a zero fuse, so it went off a
   second time a frame after the in-hand blast: two explosions, double damage. */
function releaseCook({ cookedOff = false } = {}) {
  if (!cooking.def) return;
  if (!player.alive || gameState !== "playing" || streakBusy()) { cancelCook(); return; }
  const def = cooking.def;
  const slot = cooking.slot;
  cooking.def = null;
  cooking.slot = null;
  els.cook.hidden = true;
  if (player.gear[slot] <= 0) return;
  player.gear[slot]--;
  updateGearHud();
  if (cookedOff) return;

  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  // Throws arc up a little, so aiming flat still lobs it somewhere useful.
  dir.y += 0.18;
  dir.normalize();
  // Out in front of the face, but never through a wall you're pressed up
  // against: a grenade spawned on the far side of it goes off over there.
  const clear = raycastWorld(colliders, origin, dir, 0.85);   // distance to the first solid
  origin.addScaledVector(dir, Math.max(0, Math.min(0.6, clear - 0.25)));

  const gid = nextNadeId();
  grenades.throwGrenade(def, origin, dir, "player", { fuseLeft: cooking.fuse, gid });
  if (isPvp() && net.active) {
    net.publishNade({
      action: "throw", gid, def: def.id, fuse: round2(cooking.fuse),
      ox: round2(origin.x), oy: round2(origin.y), oz: round2(origin.z),
      dx: round2(dir.x), dy: round2(dir.y), dz: round2(dir.z),
    });
  }
  breakSpawnGuard();
  audio.throwGear();
  localThrowT = THROW_TIME;
}

/* Quick melee swings without putting the gun away; pressing 3 makes the
   melee weapon the thing in your hands, which swings and moves faster. */
function swingMelee() {
  if (!player.alive || move.busy || gameState !== "playing" || stageFrozen() || royaleDropView()) return;
  if (!player.melee || !player.melee.start()) return;
  // Everyone else sees the swing; the damage still travels as a normal hit.
  if (isPvp() && net.active) net.publishMelee(player.melee.swingIndex % 2, player.melee.def.id);
  breakSpawnGuard();
  const kind = player.melee.def.model?.kind;
  if (kind === "saber") audio.saberSwing();
  else if (kind === "chainsaw") audio.chainsawRev();
  else if (kind === "reaper") audio.reaperSwing();
  else audio.swing();
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
  // A cut sweeps the whole arc; a thrust goes a little further down a narrow
  // line. Rays fan across the sweep at three heights (the aim, the chest of
  // someone a little below it, the head of someone a little above), centre
  // first so a square hit wins.
  const thrust = player.melee.swingIndex % 2 === 1 && def.model?.kind !== "chainsaw";
  const reach = def.range * (thrust ? 1.1 : 1);
  const half = (thrust ? def.arc * 0.3 : def.arc) / 2;
  ray.far = reach;
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  const fan = [];
  for (const h of [0, -0.5, 0.5, -1, 1]) for (const v of [0, -0.28, 0.14]) fan.push([h * half, v]);

  for (const [off, tilt] of fan) {
    const dir = forward.clone().addScaledVector(right, Math.tan(off)).addScaledVector(up, Math.tan(tilt)).normalize();
    ray.set(origin, dir);
    const hits = targetMeshes.length ? ray.intersectObjects(targetMeshes, true) : [];
    for (const h of hits) {
      const actor = resolveBulletTarget(h.object);
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
      if (def.model?.kind === "saber") audio.saberHit();
      else if (def.model?.kind === "chainsaw") audio.chainsawHit();
      else audio.meleeHit();
      onBulletActorHit(actor, {
        damage: def.damage * mult,
        isHead: mult > 1,
        point: h.point,
        dir: dir.clone(),
      });
      meleeImpactT = 1;
      return;
    }
  }
  if (def.model?.kind !== "saber") audio.impact();
  meleeWhiffT = 1;
}

/* ---- Trollsaber: block and deflect ----------------------------------
   With the saber drawn, holding aim raises it across the body; rounds from
   the front (inside def.deflect.cone) hit the blade instead of you. Each
   one, and holding the guard, drains a meter; run it dry and the guard
   breaks for def.deflect.breakTime. Blasts, melee, zombies and the bomb go
   straight through (only WEAPON_DEFS rounds are deflectable). */
const saberBlock = { active: false, meter: 1, broken: 0, idle: 0, t: 0 };
let saberDeflectT = 0;
const saberParry = new ParryState();   // the last deflect's parry (character.js)
const _parryV = new THREE.Vector3();
const _parryW = {};
const _parryPos = new THREE.Vector3();
const _parryQ = new THREE.Quaternion();
const _flickQ = new THREE.Quaternion();
const _viewZ = new THREE.Vector3(0, 0, 1);
const _viewX = new THREE.Vector3(1, 0, 0);
const _bladeG = new THREE.Vector3(), _bladeP = new THREE.Vector3();
let saberFlick = 0;
let saberWasShown = false;
let saberTrail = null;
let saberSwingSpeed = 0;
let saberHavePrevTip = false;
const _saberPrevTip = new THREE.Vector3();
const _saberRoot = new THREE.Vector3();
const _saberTip = new THREE.Vector3();
const _deflectTo = new THREE.Vector3();
const _deflectFwd = new THREE.Vector3();
const _deflectQ = new THREE.Quaternion();

function heldSaberDeflect() {
  return player.melee?.def?.deflect || null;
}

function updateSaberBlock(dt, wantAds) {
  const d = heldSaberDeflect();
  const want = !!d && player.holding === "melee" && player.alive && wantAds
    && !player.melee.busy && saberBlock.broken <= 0 && saberBlock.meter > 0 && !isStaging();
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
  if (!els.saberMeter) return;
  const show = !!d && player.holding === "melee" && player.alive
    && (want || saberBlock.meter < 0.999 || saberBlock.broken > 0);
  els.saberMeter.hidden = !show;
  if (!show) return;
  els.saberMeter.style.setProperty("--p", saberBlock.meter.toFixed(3));
  els.saberMeter.classList.toggle("is-on", want);
  els.saberMeter.classList.toggle("is-broken", saberBlock.broken > 0);
}

function breakSaberGuard() {
  const d = heldSaberDeflect();
  if (!d) return;
  saberBlock.meter = 0;
  saberBlock.active = false;
  saberBlock.broken = d.breakTime;
  audio.saberBreak();
  activeMeleeMesh?.userData.saber?.flare(1.4);
}

/* damagePlayer asks first: true means the blade took it. */
function tryDeflect(amount, fromId, weaponId, fromPos) {
  if (!saberBlock.active) return false;
  const d = heldSaberDeflect();
  if (!d || !WEAPON_DEFS[weaponId]) return false;
  const src = fromPos || killerPosFor(fromId);
  camera.getWorldDirection(_deflectFwd);
  _deflectFwd.y = 0;
  _deflectFwd.normalize();
  if (src) {
    _deflectTo.set(src.x - move.pos.x, 0, src.z - move.pos.z);
    if (_deflectTo.lengthSq() > 1e-6 && _deflectTo.normalize().dot(_deflectFwd) < d.cone) return false;
  }
  saberBlock.meter -= d.drainPerHit + amount * d.drainPerDamage;
  saberBlock.idle = 0;
  saberDeflectT = 1;
  // Which parry: where the round came from, in our view. killerPosFor
  // already puts `src` at the shooter's eye.
  if (src) {
    camera.getWorldPosition(_parryV);
    _parryV.set(src.x - _parryV.x, (src.y ?? _parryV.y) - _parryV.y, src.z - _parryV.z).normalize();
    _parryV.applyQuaternion(_deflectQ.copy(camera.quaternion).invert());
    saberParry.start(_parryV.x, _parryV.y);
  } else saberParry.start(0, 0);
  activeMeleeMesh?.userData.saber?.flare(0.9);
  // Sparks where the round met the blade: the blade's middle is in view
  // space (the weapon camera sits at the origin), so re-aim it through the
  // world camera's wider lens and put the burst out along that ray.
  const saberMesh = activeMeleeMesh;
  const s = saberMesh?.userData.saber;
  if (s) {
    const v = s.tipLocal.clone().lerp(s.rootLocal, 0.45);
    saberMesh.localToWorld(v);
    const k = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.tan(THREE.MathUtils.degToRad(weaponCamera.fov / 2));
    v.x *= k; v.y *= k;
    v.normalize().multiplyScalar(1.3);
    camera.localToWorld(v);
    spawnImpactBurst(v, 0xff6a3a, 14);
    ricochetRound(v, src, weaponId);
  }
  audio.saberClash();
  net.publishDeflect(fromId, weaponId);
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
  bullets.spawn({ origin: at.clone().addScaledVector(_ricoDir, 0.15), dir: _ricoDir.clone(), def, ownerId: "remote", cosmetic: true });
}

/* Everyone else's sabers, once a frame after remotes.update: the sounds
   their bodies queued (ignite, retract, swing) and one hum on the nearest
   lit blade, bending up while it swings. */
const _remoteHumAt = new THREE.Vector3();
function updateRemoteSabers() {
  let near = null, nearD = 30 * 30;
  for (const rp of remotes.byId.values()) {
    for (const s of rp.sfx) {
      if (s.kind === "ignite") audio.saberIgnite(s.at);
      else if (s.kind === "retract") audio.saberRetract(s.at);
      else if (s.kind === "swing") audio.saberSwing(s.at);
    }
    rp.sfx.length = 0;
    if (!rp.saberOut || !rp.saber?.lit) continue;
    const d = rp.pos.distanceToSquared(move.pos);
    if (d < nearD) { near = rp; nearD = d; }
  }
  if (!near) { audio.saberHumAt(-1); return; }
  audio.saberHumAt(near.swinging ? 0.8 : 0, near.bladeMid(_remoteHumAt) || near.centre(_remoteHumAt));
}

/* A peer's blade ate a round: sparks on it for everyone; if it was our
   round, the number that would have printed says DEFLECTED instead. */
function onRemoteDeflect(p, m) {
  const rp = remotes.byId.get(p.id);
  if (!rp) return;
  // Their parry, by where the shooter stands relative to them.
  const from = m.by === net.id ? move.pos : killerPosFor(m.by);
  if (from) {
    const dx = from.x - rp.pos.x, dz = from.z - rp.pos.z, dy = (from.y ?? rp.pos.y) - rp.pos.y;
    const c = Math.cos(rp.yaw), sn = Math.sin(rp.yaw);
    // rig right is (cos, 0, -sin), ahead is (-sin, 0, -cos)
    const side = dx * c - dz * sn, ahead = -dx * sn - dz * c;
    const len = Math.max(0.5, Math.hypot(side, ahead));
    rp.startParry(side / len, Math.atan2(dy, len));
  } else rp.startParry(0, 0);
  const at = rp.bladeMid() || rp.centre();
  spawnImpactBurst(at, 0xff6a3a, 14);
  // Our own position is the feet; killerPosFor's is already the eye.
  const lift = from === move.pos ? 1.5 : 0;
  ricochetRound(at, from ? _parryV.set(from.x, (from.y ?? at.y - lift) + lift, from.z) : null, WEAPON_DEFS[m.w] ? m.w : "problem416");
  rp.saber?.flare(0.9);
  audio.saberClash(at);
  if (m.by === net.id) spawnDamageNumber(0, at, false, "DEFLECTED");
}

/* Swing trail and the hum, once a frame while the saber is out. The trail
   lives in weaponRig, the parent of the melee mesh, so its points are the
   mesh's own matrix applied to the blade root/tip. */
function updateSaberFx(mesh, saber, swinging, dt) {
  if (!saberTrail) saberTrail = new SaberTrail(weaponRig);
  mesh.updateMatrix();
  _saberRoot.copy(saber.rootLocal).applyMatrix4(mesh.matrix);
  _saberTip.copy(saber.tipLocal).applyMatrix4(mesh.matrix);
  const now = performance.now() / 1000;
  // Only the cut itself leaves a trail, not the wind-up or the recovery.
  const m = player.melee;
  const cutting = swinging && m.t >= m.window.open - 0.09 && m.t <= m.window.close + 0.05;
  // A deflect's flick is a cut too: the blade whips and streaks.
  if ((cutting || Math.abs(saberFlick) > 0.25) && saber.lit) saberTrail.push(_saberRoot, _saberTip, now);
  saberTrail.update(now);
  const speed = saberHavePrevTip ? _saberTip.distanceTo(_saberPrevTip) / Math.max(dt, 1e-3) : 0;
  _saberPrevTip.copy(_saberTip);
  saberHavePrevTip = true;
  saberSwingSpeed = damp(saberSwingSpeed, speed, 12, dt);
  audio.saberHum(saber.lit ? Math.min(1, saberSwingSpeed / 7) : -1);
}

function setHolding(what) {
  if (player.holding === what) return;
  if (isInfected() && what !== "melee") return;   // the sword is all they have
  if (what === "melee" && !player.melee) return;
  player.holding = what;
  if (activeWeaponMesh) activeWeaponMesh.visible = what === "gun";
  if (activeMeleeMesh) activeMeleeMesh.visible = what === "melee";
  activeStreakMesh.visible = what === "streak" && streakDeviceKind === "tablet";
  if (what !== "streak") activeMarkerMesh.visible = activeDroneMesh.visible = false;
  muzzleFlash.visible = what === "gun";
  updateGearHud();
}

/* 1 draws the primary, 2 the secondary - rebuilds the visible gun mesh for
   whichever def that slot now points at and makes it the active weapon.
   No-op in modes with no secondary (equipFromLoadout leaves
   player.secondaryId null there - Gun Game, One in the Chamber) or when
   already holding that slot's gun. */
function switchWeapon(slot) {
  if (warshipView()) { toggleWarshipGun(); return; }
  if (isInfected()) return;
  // Mid-streak the tablet/marker is in your hands; a swap would yank it away
  // and leave you on the other gun once the streak is done.
  if (player.holding === "streak") return;
  const id = slot === "secondary" ? player.secondaryId : player.weaponId;
  if (!id || !player.weapons[id]) return;
  const w = player.weapons[id];
  if (player.holding === "gun" && w === currentWeapon()) return;
  // A shell-by-shell reload is dropped on a swap; shells already in stay in.
  const prev = currentWeapon();
  if (prev !== w && prev?.def.shellReload) prev.abortReload();
  if (prev !== w && prev?.charging) endCandleCharge(prev);
  currentWeaponSlot = slot;
  setActiveWeaponMesh(w.def);
  setHolding("gun");
}

/* Gamepad-only: keyboard has three dedicated keys (1/2/3) for primary/
   secondary/melee, but the pad only has one free face button for this, so it
   cycles through whatever's actually equipped instead. Skips secondary when
   there isn't one (Gun Game, One in the Chamber, or no sidearm picked up
   yet) rather than landing on a dead slot. */
function cycleWeapon() {
  if (player.holding === "streak") return;   // same reason as switchWeapon
  const order = ["primary", ...(player.secondaryId ? ["secondary"] : []), "melee"];
  const current = player.holding === "melee" ? "melee" : currentWeaponSlot;
  const at = order.indexOf(current);
  const next = order[(at + 1) % order.length];
  if (next === "melee") setHolding("melee");
  else switchWeapon(next);
}

/* Hold X: standing over a dropped weapon, picks it up into the secondary
   slot — replacing the sidearm there if any, same as Call of Duty. Nothing
   underfoot, the same hold instead instantly swaps primary/secondary.

   A care package underfoot takes priority over both: it is the rarer thing
   and you are deliberately standing on it. Same key for all three, because
   "hold X on the thing at your feet" is one idea, not three. */
let pkgHoldT = 0;
function updatePickupPrompt(dt) {
  const pkg = player.alive ? nearbyPackage() : null;
  // Troll Royale: guns on the ground are loot, picked up the same way.
  const lootGun = royale && player.alive ? royale.loot.nearest(move.pos.x, move.pos.z, 1.6, (it) => it.k === "gun") : null;
  const drop = lootGun ? { def: lootGun.def, loot: lootGun, name: gunDisplayName(lootGun) }
    : (player.alive && !royale ? pickups.nearest(move.pos.x, move.pos.z) : null);
  // D-pad right only counts as "hold X" with something underfoot. With
  // nothing there the same press fires a streak, and counting it here too
  // swapped you onto your secondary every time you called one (Y swaps).
  const padHold = gamepadState.pickup && !(isSnd() && sndCanInteract) && (!!pkg || !!drop);
  // While a duo invite is up, X accepts it (updateDuo) instead.
  // In a streak, holding X ends it instead (updateStreakControl).
  const held = !frozenPlayer() && !duoIncoming && !streakControlActive() && ((isTouch && touchState.swap) || keys.has("KeyX") || padHold);

  // A package has its own capture clock (BO2: the owner grabs it fast, an
  // enemy stands there stealing it). `canPickup` keeps the instant-swap
  // branch from firing while we're on one — holding X must capture it, not
  // switch guns.
  if (pkg && held) {
    pkgHoldT += dt;
    if (pkgHoldT >= packageCaptureTime(pkg)) {
      pkgHoldT = 0;
      claimPackage(pkg);
      if (els.pickupPrompt) els.pickupPrompt.hidden = true;
      setTouchContext(null);
      return;
    }
  } else pkgHoldT = 0;
  const action = swapHold.update(dt, held && !pkg, !!drop || !!pkg);
  if (action === "swap") {
    switchWeapon(currentWeaponSlot === "secondary" ? "primary" : "secondary");
  } else if (action === "pickup" && drop?.loot) {
    royalePickupGun(drop.loot);
  } else if (action === "pickup" && drop) {
    pickups.take(drop);
    player.secondaryId = drop.def.id;
    player.weapons[drop.def.id] = new WeaponState(drop.def);
    // Equip it into your hands immediately, same as CoD - without this,
    // player.secondaryId/weapons updated but the held mesh (and holding
    // "melee" at the time) never refreshed, so picking up a weapon looked
    // like it did nothing unless you happened to already be on the
    // secondary slot and pressed 2 afterward.
    currentWeaponSlot = "secondary";
    setActiveWeaponMesh(drop.def);
    setHolding("gun");
    audio.reload();
    showWaveBanner(`Picked up ${drop.def.name}`, 1200);
  }

  // Touch: the swap button turns into a labelled CAPTURE / PICK UP button
  // while there is something to take, so it reads as the thing to hold.
  setTouchContext(player.alive ? (pkg ? "Capture" : drop ? "Pick up" : null) : null);

  if (els.pickupPrompt) {
    if ((pkg || drop) && player.alive) {
      // No key hint in the prompt (user, 2026-09-28): just the action.
      const steal = pkg && (!pkg.owned || pkg.botId) && (currentMode().ffa || !net.team || pkg.ownerTeam !== net.team);
      const label = pkg
        ? (pkgHoldT > 0 ? (steal ? "Stealing the care package…" : "Capturing…") : `${steal ? "Steal" : "Capture"} the care package`)
        : (swapHold.active ? `Picking up ${drop.name || drop.def.name}…` : `Pick up ${drop.name || drop.def.name}`);
      els.pickupPrompt.hidden = false;
      els.pickupPromptText.textContent = label;
      // Troll Royale is the exception to "no key hints" (user, 2026-09-29):
      // loot is the whole game there and nobody knew it was a hold. A keycap
      // that pulses until you start holding it. Touch has its own labelled
      // PICK UP button, so no cap there.
      const cap = !!royale && !!drop?.loot && !isTouch;
      els.pickupPrompt.classList.toggle("is-royale", cap);
      if (els.pickupKey) {
        els.pickupKey.hidden = !cap;
        if (cap) {
          const k = gamepadState.connected ? "D-pad →" : "X";
          if (els.pickupKeyCap.textContent !== k) els.pickupKeyCap.textContent = k;
          els.pickupKey.classList.toggle("is-held", swapHold.active);
        }
      }
      const progress = pkg ? pkgHoldT / packageCaptureTime(pkg) : swapHold.progress;
      els.pickupBarFill.style.width = `${Math.round(progress * 100)}%`;
    } else {
      els.pickupPrompt.hidden = true;
    }
  }
}

function setTouchContext(label) {
  const b = els.touchSwap;
  if (!b || !isTouch) return;
  const on = !!label;
  if (b.classList.contains("is-context") === on && (!on || b.dataset.ctx === label)) return;
  b.classList.toggle("is-context", on);
  b.dataset.ctx = label || "";
  const span = b.querySelector(".to-touch-ctx");
  if (span) span.textContent = label || "";
  b.setAttribute("aria-label", on ? `Hold to ${label.toLowerCase()}` : "Hold to swap weapons, pick up a dropped weapon, or open a care package");
}

/* The landed, unclaimed package we're standing on, if any. */
function nearbyPackage() {
  for (const e of streakEntities.values()) {
    if (e instanceof CarePackage && e.withinClaim(move.pos.x, move.pos.z)) return e;
  }
  return null;
}

function frozenPlayer() { return !player.alive || stageFrozen() || royaleDropView(); }

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
  // One throwable slot: the kind you didn't bring has no chip and no button.
  const offKind = loadout.throwKind === "lethal" ? "tactical" : "lethal";
  els.gearLethal.classList.toggle("is-uncarried", offKind === "lethal");
  els.gearTactical.classList.toggle("is-uncarried", offKind === "tactical");
  els.touchNade?.classList.toggle("is-uncarried", offKind === "lethal");
  els.touchTac?.classList.toggle("is-uncarried", offKind === "tactical");
  // Touch: the buttons are icons and carry the count (the chips are hidden there).
  if (els.touchNade) {
    els.touchNade.setAttribute("aria-label", `Throw ${loadout.lethal.name}`);
    els.touchNade.dataset.n = String(player.gear.lethal);
    els.touchNade.classList.toggle("is-empty", player.gear.lethal <= 0);
  }
  if (els.touchTac) {
    els.touchTac.setAttribute("aria-label", `Throw ${loadout.tactical.name}`);
    els.touchTac.dataset.n = String(player.gear.tactical);
    els.touchTac.classList.toggle("is-empty", player.gear.tactical <= 0);
  }
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

// True while the pause menu is open in a match that has other real people
// in it. Unlike a solo `gameState = "paused"` (which stops the whole
// simulation block below), this leaves gameState at "playing" so net
// updates, the bot host's bot sim, remote interpolation and in-flight
// bullets all keep running for everyone else in the room — only this
// client's own movement/aim/fire freezes, the same way a dead or
// pre-match player already freezes via the `frozen` flag in updatePlayer.
let localPauseOnly = false;
function openPauseMenu() {
  // Esc out of a half-placed streak instead of opening the menu — the point
  // isn't committed yet and the charge hasn't been spent.
  if (markingStreak) { cancelMark(); return; }
  releaseHeldInputs();
  renderPauseRange();
  if (otherHumansInMatch()) {
    localPauseOnly = true;
    els.pause.hidden = false;
  } else {
    gameState = "paused";
    els.pause.hidden = false;
  }
}
function closePauseMenu() {
  localPauseOnly = false;
  if (gameState === "paused") gameState = "playing";
  els.pause.hidden = true;
  clearTimeout(resumeTimer);
  setResumeLabel(null);
  // Whatever was held when the menu opened was released then; anything
  // pressed while it was up (keys typed into it) must not leak into play.
  releaseHeldInputs();
}

/* Everything "held" as of now, let go: movement keys, trigger, ADS. The
   menu steals keyup/mouseup (they land on the overlay, or the tab lost
   focus), so without this you'd come back running, firing or scoped. */
function releaseHeldInputs() {
  keys.clear();
  mouseDown = false;
  adsHeld = false;
  if (typeof gamepadState !== "undefined") { gamepadState.firing = false; gamepadState.ads = false; gamepadState.jump = false; }
}

/* Resume (the button, Start on a pad, Enter). Desktop resumes by taking the
   mouse back; Chrome refuses that for ~1s after Esc released it, which used
   to make the first Resume click do nothing at all. Now it waits out the
   cooldown on its own ("Resuming…") and, if the lock is still refused,
   drops the menu anyway so a click on the game picks the mouse up. */
let resumeTimer = 0;
const RELOCK_COOLDOWN = 1150;
function resumePlay() {
  if (isTouch) { closePauseMenu(); return; }
  clearTimeout(resumeTimer);
  const wait = RELOCK_COOLDOWN - (performance.now() - lockChangedAt);
  const attempt = () => {
    controls.lock().then(() => {
      // Some browsers resolve without locking (no promise support): the
      // lock event closes the menu when it really happens.
    }).catch(() => {
      setResumeLabel(null);
      closePauseMenu();
      showWaveBanner("Click to take the mouse back", 1600);
    });
  };
  if (wait > 0) {
    setResumeLabel("Resuming…");
    resumeTimer = setTimeout(attempt, wait);
  } else attempt();
}

function setResumeLabel(text) {
  if (!els.resumeBtn) return;
  els.resumeBtn.textContent = text || "Resume";
  els.resumeBtn.disabled = !!text;
}

/* The local player as the wire sees them. Shared by the match loop and the
   intermission, which keeps broadcasting so the room doesn't time us out
   (PEER_TIMEOUT is 5s and an intermission runs for 20). */
// net.update() only actually sends this at 15Hz, but it used to get a fresh
// object every animate() frame at 60Hz regardless — three throwaway objects
// for every one that ships. One reused object costs nothing to overwrite.
const _netSnapshot = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, stance: null, moving: false, ads: 0, hp: 0, alive: true, weapon: null, skin: null, kills: 0 };
function netSnapshot() {
  _netSnapshot.x = move.pos.x; _netSnapshot.y = move.pos.y; _netSnapshot.z = move.pos.z;
  // Under the glider everyone else sees the wing's heading, not your look.
  _netSnapshot.yaw = royale?.me === "glide" && royale.flight ? royale.flight.heading : look.yaw;
  _netSnapshot.pitch = look.pitch;
  _netSnapshot.stance = move.stance; _netSnapshot.moving = move.moving;
  _netSnapshot.ads = player.holding === "gun" ? currentWeapon()?.adsT || 0 : 0;
  _netSnapshot.hp = player.hp; _netSnapshot.alive = player.alive;
  _netSnapshot.weapon = player.holding === "melee" && player.melee
    ? player.melee.def.id
    : (player.holding === "gun" ? currentWeapon()?.def.id : null) || player.weaponId;
  // The skin of whatever that is, so everyone else sees the same gun.
  _netSnapshot.skin = (player.holding === "gun" ? currentWeapon()?.def.attachments?.skin : null) || null;
  _netSnapshot.kills = player.kills;
  _netSnapshot.deaths = player.deaths;
  _netSnapshot.assists = player.assists;
  _netSnapshot.emote = emote ? emoteCode(emote.idx, emote.role) : 0;
  _netSnapshot.block = saberBlock.active;
  _netSnapshot.roll = royaleRollK();
  _netSnapshot.drop = royaleDropCode();
  _netSnapshot.face = cosmetics.face;
  _netSnapshot.swivel = swivel.seq ? swivel.seq * (swivel.dir || swivel.lastDir || 1) : 0;
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
  if (player.alive && !royaleDropView()) {
    list.push({ id: net.id, team: net.team, pos: move.pos, yaw: look.yaw });
  }
  for (const rp of remotes.byId.values()) {
    if (!rp.alive) continue;
    list.push({ id: rp.netId, team: rp.team, pos: rp.pos, yaw: rp.yaw ?? 0 });
  }
  for (const b of bots.bots) {
    if (!b.alive || b.airborne) continue;
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

// Teammate spacing, Black Ops 2 style: a team spawns loosely spread across
// its side of the map rather than stacked on whoever's nearest. Too close
// is penalized outright (that's how two people end up standing on top of
// each other), and the reward band sits well out from the min so the "best"
// spot is genuinely spread, not just the least-bad crowd.
const SPAWN_MATE_TOO_CLOSE = 10;  // stacking distance — actively bad
const SPAWN_MATE_SWEET_LO = 20;   // reward band: far enough to feel spread...
const SPAWN_MATE_SWEET_HI = 35;   // ...but still the same fight, not the far side of the map

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

/* Which half of the map a team spawns on. Team modes pin Phantoms to one
   side and Ghosts to the other; Search & Destroy pins by *role* instead, so
   the attackers always walk in from the same end toward sites that
   pickBombSites put on the defenders' half — and sides swap with roles at
   halftime, as in CoD. */
function spawnSideFor(team) {
  if (isSnd()) return team === sndAttackTeam ? "lo" : "hi";
  return team === "ghost" ? "hi" : "lo";
}

/* True from the moment a match is set up until the countdown clears: the
   opening spawn is always on your own side. After that, respawns may use
   any point and your side is only a preference — CoD-style dynamic spawns,
   which is what stops a team being farmed at its own doorstep. */
let spawnOpening = false;
const SPAWN_SIDE_BONUS = 35;

/* Candidate points are the team's side (split by position — see
   splitSpawnSides; the old list-index split interleaved the teams round the
   perimeter), or the whole ring for a mid-match respawn.

   Within that set the point is *scored* rather than picked at random: a
   uniform pick will happily drop you on top of someone who has been farming
   that corner, and with a 4s respawn that is the fastest way to make a match
   miserable. Enemies nearby, enemies looking this way and recent deaths all
   push a point down; nearby friendlies and being on your own side pull it up. */
function spawnForTeam(team, forId = net.id, { sideOnly = spawnOpening || isSnd(), groundOnly = false } = {}) {
  const pts = builtMap.spawnPoints;
  if (!pts?.length) return { x: 0, y: 0, z: 0 };
  const ffa = !!currentMode().ffa;
  const own = new Set(!ffa && spawnSides ? spawnSides[spawnSideFor(team)] : pts.map((_, i) => i));
  let candidates = sideOnly ? [...own] : pts.map((_, i) => i);
  // Bots path on the ground floor only (one flow field at y 0): an upstairs
  // spawn (Undergrin's ticket hall) would leave one wandering up there.
  if (groundOnly || bots.byId?.(forId)) {
    const ground = candidates.filter((i) => (pts[i].y || 0) < 3);
    if (ground.length) candidates = ground;
  }

  // Never score against ourselves: the corpse we're respawning from would
  // read as a nearby "teammate" and pull us straight back to where we died.
  const others = occupants().filter((o) => o.id !== forId);
  const now = performance.now();
  let best = null, bestScore = -Infinity;
  const scored = [];

  for (const i of candidates) {
    const sp = pts[i];
    let score = !ffa && own.has(i) ? SPAWN_SIDE_BONUS : 0;

    for (const o of others) {
      const dx = sp.x - o.pos.x, dz = sp.z - o.pos.z;
      const d = Math.hypot(dx, dz);
      // In a free-for-all everyone still standing is an enemy.
      const enemy = currentMode().ffa || o.team !== team;

      if (!enemy) {
        // Being right on top of a teammate is bad in its own right — one
        // stray grenade or a burst that overpenetrates gets both of you.
        if (d < SPAWN_MATE_TOO_CLOSE) score -= 60 * (1 - d / SPAWN_MATE_TOO_CLOSE);
        // The reward band is a plateau, not a single point, so many spawns
        // qualify as "well spread" rather than the field collapsing onto one
        // ideal ring around each teammate.
        else if (d < SPAWN_MATE_SWEET_LO) score += 10 * ((d - SPAWN_MATE_TOO_CLOSE) / (SPAWN_MATE_SWEET_LO - SPAWN_MATE_TOO_CLOSE));
        else if (d <= SPAWN_MATE_SWEET_HI) score += 10;
        else score += 10 * Math.max(0, 1 - (d - SPAWN_MATE_SWEET_HI) / 30);
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
  return pick?.sp || best || pts[0];
}

function teamSpawn(opts) { return spawnForTeam(net.team, net.id, opts); }
/* Where a bot comes in: ground floor only (see groundOnly). */
const botSpawn = (team, id, opts = {}) => spawnForTeam(team, id, { ...opts, groundOnly: true });

// Capped so a player mashing the button in the range can't spawn an
// unbounded crowd — plenty to look at, cheap enough to never matter.
const RANGE_BOT_CAP = 6;

/* "Spawn a bot" button in the Test Range HUD — the only way to get other
   visible characters into the range, which otherwise never has anyone in
   it. Harmless: these bots aim at the player (real steering/animation
   variety) but never actually deal damage, since onShoot is a no-op in
   the range's own per-frame bot update below. */
function spawnRangeBot() {
  if (!isRange() || !net.isBotHost()) return;
  if (bots.count >= RANGE_BOT_CAP) { showWaveBanner("Range is full — kill one first", 1800); renderPauseRange(); return; }
  bots.fill(bots.count + 2, 1, botSpawn, true);
  for (const b of bots.bots) net.publishBot(b);
  showWaveBanner(`Bot ${bots.count} in the range`, 1800);
  renderPauseRange();
}

function clearRangeBots() {
  if (!isRange() || !net.isBotHost()) return;
  for (const b of bots.bots) net.dropBot(b.id);   // takes their rigs down too
  bots.clear();
  renderPauseRange();
}

/* The HUD's "Spawn a bot" can't be clicked on desktop: the HUD only shows
   while the mouse is locked to aiming, and Esc opens this menu on top. So
   the range's bot controls live here too (and on the N key). */
function renderPauseRange() {
  const box = els.pauseRange;
  if (!box) return;
  box.hidden = !isRange();
  if (box.hidden) return;
  const n = bots.count;
  els.pauseSpawnBot.textContent = n >= RANGE_BOT_CAP ? `Range full (${n}/${RANGE_BOT_CAP})` : `Spawn a bot (${n}/${RANGE_BOT_CAP})`;
  els.pauseSpawnBot.disabled = n >= RANGE_BOT_CAP;
  els.pauseClearBots.disabled = n === 0;
}

/* Everything a bot could shoot at: us, other humans, and other bots. */
function botTargets() {
  const list = [];
  for (const o of occupants()) {
    // No point emptying a magazine into someone spawn protection is going to
    // shrug off — and it would look like the bot is broken.
    if (o.id === net.id && player.spawnGuard > 0) continue;
    // `melee`: only carrying a sword (Infection's infected), so worth
    // backing away from rather than holding ground against.
    // `blocking`: a Trollsaber guard up, which bots respect (bots.js
    // isGuarding) instead of emptying magazines into it.
    let blocking = false;
    if (o.id === net.id) blocking = saberBlock.active;
    else {
      const rp = remotes.byId.get(o.id);
      blocking = !!(rp?.peer.blocking && rp.saberOut);
    }
    list.push({ id: o.id, team: o.team, alive: true, pos: o.pos, groundY: o.pos.y, yaw: o.yaw,
      melee: isInfection() && o.team === "ghost", blocking, blockCone: MELEE_DEFS.trollsaber.deflect.cone });
  }
  // K9 dogs are fair game: bots shoot the ones coming for them.
  for (const e of streakEntities.values()) {
    if (!(e instanceof K9Pack)) continue;
    for (const d of e.dogs) {
      if (d?.alive) list.push({ id: `k9:${e.id}:${d.i}`, team: e.team, alive: true, pos: d.pos, groundY: d.pos.y, yaw: d.yaw, dog: true });
    }
  }
  return list;
}

/* Someone else's shot, as seen and heard from here: their real gun's report
   (it used to be one generic rifle for every weapon in the room), a muzzle
   flash, and a tracer that follows the round's actual path so you can tell
   where fire is coming from. The tracer is cosmetic — hits are decided by
   whoever fired. */
function remoteShotFx(origin, dir, weaponId, quiet = false, charge = 0) {
  let base = WEAPON_DEFS[weaponId] || WEAPON_DEFS.problem416;
  if (charge > 0 && base.charge) base = chargedShotDef(base, charge).def;
  audio.shot(quiet ? { ...base, quiet: true } : base, 0.8, origin);
  if (!quiet) impactFx.puff(origin, dir.lengthSq() > 0.001 ? dir.clone().normalize() : null);
  if (dir.lengthSq() < 0.001) return;
  const pellets = Math.min(base.pellets || 1, 4);   // a few pellets read as buckshot
  for (let i = 0; i < pellets; i++) {
    const d = dir.clone().normalize();
    if (pellets > 1) {
      d.x += (Math.random() - 0.5) * (base.pelletSpread || 0.1);
      d.y += (Math.random() - 0.5) * (base.pelletSpread || 0.1);
      d.normalize();
    }
    bullets.spawn({ origin: origin.clone().addScaledVector(d, 0.6), dir: d, def: base, ownerId: "remote", cosmetic: true });
  }
}

const _botMuzzle = new THREE.Vector3();
const _botAim = new THREE.Vector3();

function onBotShoot(bot, target, dmg, isHead, hit, range = 30, usingSecondary = false) {
  const wid = (usingSecondary ? bot.secondaryId : bot.weaponId) || "problem416";
  if (royale) { dmg = royaleBotDamage(bot, dmg); royaleNoise(bot.pos.x, bot.pos.z, bot.id); }

  // The round's visible path: at the target's chest on a hit, off to one
  // side on a miss. Played here (we host the bot) and sent to the room,
  // which previously neither saw nor heard bots fire at all.
  const fwdX = -Math.sin(bot.yaw), fwdZ = -Math.cos(bot.yaw);
  _botMuzzle.set(bot.pos.x + fwdX * 0.5, bot.pos.y + 1.45, bot.pos.z + fwdZ * 0.5);
  _botAim.set(target.pos.x, (target.groundY ?? target.pos.y ?? 0) + (isHead ? 1.6 : 1.2), target.pos.z);
  if (!hit) {
    const side = (0.5 + Math.random() * 1.2) * (Math.random() < 0.5 ? -1 : 1);
    _botAim.x += fwdZ * side;
    _botAim.z -= fwdX * side;
    _botAim.y += (Math.random() - 0.3) * 0.8;
  }
  const dir = _botAim.clone().sub(_botMuzzle).normalize();
  remoteShotFx(_botMuzzle, dir, wid);
  killcam.noteShot(kcClock, bot.id, _botMuzzle, dir, wid);
  if (net.active) net.reportShotAs(bot.id, _botMuzzle, dir, wid);

  if (!hit) {
    if (target.id === net.id) nearMiss(0.45, bot.pos);
    return;
  }
  botDealDamage(bot, target.id, dmg, isHead, wid);
}

/* Bots shoot enemy aircraft (user): when nobody on the ground has their
   attention (no enemy seen for a moment), a bot turns its gun on the
   nearest enemy aircraft it can see within BOT_AA_RANGE and fires at its
   own rate and accuracy, harder to hit the smaller and faster it is. The
   rounds are drawn and sent like any bot shot; damage goes to the
   aircraft's owner (damageStreakEntity). SAM Turrets on the ground count
   too. */
const BOT_AA_RANGE = 85;
const BOT_AA_SIZE = { drone: 0.35, dragonfire: 0.55, heli: 0.95, recon: 0.6, sam: 1 };
const _aaEye = new THREE.Vector3(), _aaDir = new THREE.Vector3();
function botAirTargets(b) {
  const list = enemyAirFor(b.team, b.id).filter((a) => !(a.e instanceof VtolWarship));
  const ffa = !!currentMode().ffa;
  for (const e of streakEntities.values()) {
    if (!(e instanceof SamTurret) || !e.alive) continue;
    const owner = e.botId || (e.owned ? net.id : null);
    if (ffa ? owner !== b.id : (e.botTeam || e.team) !== b.team) list.push({ id: e.id, pos: e.pos.clone().setY(e.pos.y + 1.1), e });
  }
  return list;
}
function updateBotAntiAir(dt) {
  if (isStaging()) return;
  for (const b of bots.bots) {
    if (!b.alive || b.airborne || b.meleeOnly || b.piloting || botBusy(b) || b.reloadT > 0) { b.aa = null; continue; }
    if (b.lastSeen && b.lastSeen.age < 1.2) { b.aa = null; continue; }   // busy with people
    b.aaT = (b.aaT || 0) - dt;
    _aaEye.set(b.pos.x, (b.groundY ?? b.pos.y) + 1.5, b.pos.z);
    if (!b.aa || b.aaT <= -1.5) {
      // Re-pick now and then: the nearest one in the clear.
      let best = null, bestD = BOT_AA_RANGE;
      for (const a of botAirTargets(b)) {
        const d = a.pos.distanceTo(_aaEye);
        if (d > bestD) continue;
        _aaDir.copy(a.pos).sub(_aaEye).divideScalar(d);
        if (raycastWorld(colliders, _aaEye, _aaDir, d) < d - 1.5) continue;
        best = a; bestD = d;
      }
      b.aa = best ? { id: best.id } : null;
      b.aaT = Math.max(0, b.aaT);
    }
    if (!b.aa) continue;
    const a = botAirTargets(b).find((x) => x.id === b.aa.id);
    if (!a) { b.aa = null; continue; }
    // Face it; the reaction beat before the first round.
    b.yaw = Math.atan2(-(a.pos.x - b.pos.x), -(a.pos.z - b.pos.z));
    b.pitch = Math.atan2(a.pos.y - _aaEye.y, Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z));
    if (b.aaT > 0) continue;
    const diff = b.diff || {};
    b.aaT = (diff.interval ?? 0.85) * (0.8 + Math.random() * 0.4);
    const kind = a.e instanceof HunterDrone ? "drone" : a.e instanceof Dragonfire ? "dragonfire" : a.e instanceof HelicopterGunship ? "heli" : a.e instanceof SamTurret ? "sam" : "recon";
    const d = a.pos.distanceTo(_aaEye);
    const hit = Math.random() < (diff.hit ?? 0.45) * BOT_AA_SIZE[kind] * Math.max(0.35, 1 - d / 140);
    const fwdX = -Math.sin(b.yaw), fwdZ = -Math.cos(b.yaw);
    _botMuzzle.set(b.pos.x + fwdX * 0.5, _aaEye.y - 0.05, b.pos.z + fwdZ * 0.5);
    _botAim.copy(a.pos);
    if (!hit) { _botAim.x += (Math.random() - 0.5) * 4; _botAim.y += (Math.random() - 0.5) * 3; _botAim.z += (Math.random() - 0.5) * 4; }
    const dir = _botAim.clone().sub(_botMuzzle).normalize();
    const wid = b.weaponId || "problem416";
    remoteShotFx(_botMuzzle, dir, wid);
    if (net.active) net.reportShotAs(b.id, _botMuzzle, dir, wid);
    if (hit) {
      spawnImpactBurst(a.pos, 0xffd08a, 4);
      damageStreakEntity(a.e, diff.damage ?? 17, b.id);
    }
  }
}

/* Damage a bot we host deals to anyone: us, another of our bots, or a remote
   player (who applies it to themselves when the hit arrives). */
function botDealDamage(bot, targetId, dmg, isHead, wid) {
  if (targetId === net.id) { damagePlayer(dmg, bot.id, wid, isHead); return; }
  if (typeof targetId === "string" && targetId.startsWith("k9:")) {
    const j = targetId.lastIndexOf(":");
    const pack = streakEntities.get(targetId.slice(3, j));
    if (pack instanceof K9Pack) damageDog(pack, +targetId.slice(j + 1), dmg, bot.id);
    return;
  }
  flinchPeer(targetId, bot.id, isHead);

  if (bots.byId(targetId)) {
    const { killed, bot: victim } = bots.applyHit(targetId, dmg);
    if (killed) {
      bot.kills++;
      net.reportDeathAs(targetId, bot.id, wid, isHead);
      registerDeath(victim.name, bot.id, wid, {
        head: isHead, victimTeam: victim.team, victimIsBot: true,
        victimPos: victim.pos, victimWeaponId: victim.weaponId,
      });
    }
    return;
  }
  net.reportHitAs(bot.id, targetId, dmg, isHead, wid);
}

// -------------------- Troll Royale --------------------
//
// Phase 1 ("Mini Royale"): solo, one life, loot only, the Cringe closing in,
// last troll standing. royale.js has the zone, the loot and their visuals;
// this is the rules. Every client runs the same zone off its own match clock
// (they agree because staging ends together) and the same floor loot from
// the stage owner's seed; only pickups and drops travel ("loot" messages).
// Each client ends the match itself when one troll is left, the way score
// limits already work.

let royale = null;

function royaleSeed() { return hashSeed(`${net.room || "solo"}:${matchesPlayed}:royale`); }

function royaleGround(x, z) { return groundHeightAt(colliders, x, z, 0.8, 0.3) ?? 0; }

function setupRoyale(seed = royaleSeed()) {
  teardownRoyale();
  const rng = seededRng(seed);
  const map = builtMap.map;
  const bounds = map.bounds;
  // A map can bring its own players, zone timings and loot density
  // (Trollface Island), and keep circles and loot on land.
  const onLand = (x, z) => (!map.edge || insidePolygon(map.edge, x, z));
  const dry = (x, z) => onLand(x, z) && (!map.wade || !insidePolygon(map.wade, x, z));
  // Circle centres stay on dry land too: a final circle in the lake is a
  // slow wade for everyone.
  const zone = new RoyaleZone(bounds, rng, map.royale?.phases || ROYALE.phases, map.edge ? dry : null);
  const loot = new LootField(scene);
  loot.spawnSeeded(lootSpots(colliders, bounds, rng, { ok: map.edge ? dry : null, perSqM: map.royale?.lootPerSqM }), rng, royaleGround);
  royale = {
    seed, zone, loot, visual: new ZoneVisual(scene),
    t: 0, live: false, peak: 0, place: 0, over: false, endT: 0,
    stageKey: "", zoneAcc: 0, act: null, spectate: null, outShown: false,
    noises: [],   // recent gunfire { x, z, t }, for bots to third-party
    drop: null, me: "ground", flight: null, lobbyItems: null,
  };
  royale.visual.update(zone.state(0), 0);
  // Trollface Island opens in the sky lobby, then the Troll Bus (royale-drop.js).
  if (DROP.enabled && map.edge) {
    royale.drop = new RoyaleDrop({ scene, colliders, edge: map.edge }, seed);
    royale.me = "lobby";
    royale.lobbyItems = new Map();
    for (const it of royale.drop.lobbyGunItems()) { royale.lobbyItems.set(it.id, it); loot.add(it); }
  }
}

/* In the sky lobby: free to move and try the guns, but nothing can be hurt. */
function inSkyLobby() { return !!royale?.drop && royale.drop.phase === "lobby" && isStaging(); }
/* The pre-match countdown freezes you, except in the sky lobby. */
function stageFrozen() { return isStaging() && !inSkyLobby(); }
/* On the bus or in the air: the drop owns movement and the camera. */
function royaleDropView() { return !!royale?.drop && player.alive && (royale.me === "bus" || royale.me === "fall" || royale.me === "glide"); }
/* Where you are in the drop, as the wire's `dr` (0 = not dropping). */
function royaleDropCode() {
  if (!royaleDropView()) return 0;
  return royale.me === "bus" ? DROP_BUS : royale.me === "fall" ? DROP_FALL : DROP_GLIDE;
}

const _dropTarget = new THREE.Vector3();
const _dropCam = new THREE.Vector3();
const _busAt = new THREE.Vector3();
let dropJumpWas = false;
let playerGlider = null;

/* Orbit `dist` m behind `target` along the look direction, `height` up. */
function placeDropCamera(target, dist, height) {
  const cp = Math.cos(look.pitch);
  _dropCam.set(Math.sin(look.yaw) * cp * dist, height - Math.sin(look.pitch) * dist, Math.cos(look.yaw) * cp * dist).add(target);
  camera.position.copy(_dropCam);
  camera.lookAt(target);
}

function dropGround(x, z, fromY) { return groundHeightAt(colliders, x, z, fromY); }

/* The glider over your own rig (seen in the third-person drop camera). */
function setPlayerGlider(on) {
  if (on && !playerGlider) {
    playerGlider = buildParaglider();
    playerGlider.position.y = 1.7;
    localRig.root.add(playerGlider);
  } else if (!on && playerGlider) {
    playerGlider.parent?.remove(playerGlider);
    playerGlider.traverse((o) => { o.geometry?.dispose(); if (o.material && !o.material.map) o.material.dispose?.(); });
    playerGlider = null;
  }
}

/* The bots wait in the box with everyone else, standing round the middle. */
function placeBotsInLobby() {
  const n = bots.bots.length + 1;
  bots.bots.forEach((b, i) => {
    const s = royale.drop.lobbySpot(i + 1, n);
    b.pos.set(s.x, s.y, s.z);
    b.groundY = s.y;
    b.airborne = true;   // parked: the bot AI leaves it be until it lands
    b.drop = { state: "lobby" };
    b.dropCode = 0;
    net.publishBot(b);
  });
}

/* Sky lobby tick: the guns on the floor (infinite ammo, back a few seconds
   after they're taken), the pick-up prompt, and the countdown on the HUD. */
function updateSkyLobby(dt) {
  const r = royale;
  r.loot.update(dt, camera, move.pos);
  for (const id of r.drop.lobbyRespawns(dt)) {
    const it = r.lobbyItems.get(id);
    if (it) r.loot.add(it);
  }
  for (const ws of Object.values(player.weapons)) if (ws) ws.ammoReserve = ws.def.reserveMax;
  if (player.alive) updatePickupPrompt(dt);
  const secs = Math.max(0, Math.ceil(stageT));
  const timer = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  if (els.royalePhase.textContent !== "Bus leaves in") els.royalePhase.textContent = "Bus leaves in";
  if (els.royaleTimer.textContent !== timer) els.royaleTimer.textContent = timer;
  const n = `${royaleAliveList().length} trolls`;
  if (els.royaleAlive.textContent !== n) els.royaleAlive.textContent = n;
}

/* 0:00 in the lobby: the box goes, the lobby guns go (and whatever you
   picked up), and everyone is on the Troll Bus. */
function startRoyaleBus() {
  const r = royale, d = r.drop;
  d.startBus();
  for (const it of [...r.loot.items.values()]) if ((it.y || 0) > 100) r.loot.take(it.id);
  equipFromLoadout();
  setActiveWeaponMesh(currentWeapon().def);
  if (els.pickupPrompt) els.pickupPrompt.hidden = true;
  setTouchContext(null);
  r.me = "bus";
  // Nothing can reach you up here, so no spawn-protection card either.
  player.spawnGuard = 0;
  updateSpawnGuardHud();
  dropJumpWas = true;   // a key held over from the lobby isn't a jump
  look.yaw = d.path.yaw + Math.PI / 2 + Math.PI;   // looking along the bus's line
  look.pitch = -0.25;
  if (net.isBotHost()) {
    const spots = builtMap.spawnPoints?.length ? builtMap.spawnPoints : [{ x: 0, z: 0 }];
    for (const b of bots.bots) {
      const target = spots[Math.floor(Math.random() * spots.length)];
      const tx = target.x + (Math.random() - 0.5) * 20, tz = target.z + (Math.random() - 0.5) * 20;
      b.airborne = true;
      b.drop = { state: "bus", tx, tz, jumpT: d.timeNearest(tx, tz) + (Math.random() - 0.5) * 2, flight: null };
    }
  }
  showWaveBanner(isTouch ? "ALL ABOARD — tap JUMP to drop" : gamepadState.connected ? "ALL ABOARD — A to drop" : "ALL ABOARD — SPACE to drop", 2600);
}

/* The bus flies; the bots aboard ride it, jump near where they want to
   land and glide there; the zone goes live once the bus has crossed. */
function updateRoyaleDropWorld(dt) {
  const r = royale, d = r.drop;
  if (!d || d.phase === "lobby") return;
  if (d.phase === "bus") {
    d.updateBus(dt);
    if (!r.live && d.pastIsland(d.busT)) {
      r.live = true;
      r.t = 0;
      showWaveBanner("Everyone's out — last troll standing wins", 1800);
    }
  }
  if (!net.isBotHost()) return;
  for (const b of bots.bots) {
    const bd = b.drop;
    if (!bd || !b.alive) continue;
    if (bd.state === "bus") {
      if (d.phase === "bus") d.busPos(d.busT, b.pos).y -= 1.4;
      b.groundY = b.pos.y;
      b.dropCode = DROP_BUS;
      if (d.phase !== "bus" || d.pastIsland(d.busT) || (d.busT >= bd.jumpT && d.overIsland(d.busT))) {
        bd.flight = new Flight(_busAt.copy(b.pos).setY(b.pos.y - 3), builtMap.map.edge);
        bd.state = "fly";
        b.dropCode = DROP_FALL;
      }
    } else if (bd.state === "fly") {
      const f = bd.flight;
      const dx = bd.tx - f.pos.x, dz = bd.tz - f.pos.z, dist = Math.hypot(dx, dz);
      const yaw = Math.atan2(-dx, -dz);
      f.update(dt, { forward: dist > 6 ? 1 : 0, strafe: 0, yaw, pitch: dist > 60 ? -0.9 : -0.2, open: false }, dropGround);
      b.pos.copy(f.pos);
      b.groundY = f.pos.y;
      b.yaw = f.state === "glide" ? f.heading : yaw;
      b.dropCode = f.state === "glide" ? DROP_GLIDE : f.state === "fall" ? DROP_FALL : 0;
      if (f.state === "landed") { bd.state = "roll"; bd.t = 0; b.roll = 0.001; }
    } else if (bd.state === "roll") {
      // Tuck and roll off the landing, carried a few metres forward, then run.
      bd.t += dt;
      const k = Math.min(1, bd.t / ROLL_TIME);
      const step = ROLL_SPEED * (1 - k) * dt;
      const nx = b.pos.x - Math.sin(b.yaw) * step, nz = b.pos.z - Math.cos(b.yaw) * step;
      const g = dropGround(nx, nz, b.pos.y + 0.6);
      if (g != null && Math.abs(g - b.pos.y) < 0.6) { b.pos.x = nx; b.pos.z = nz; b.pos.y = g; b.groundY = g; }
      b.roll = k < 1 ? Math.max(0.001, k) : 0;
      if (k >= 1) { b.airborne = false; b.drop = null; }
    }
  }
}

/* You, on the bus or in the air. */
function updateDropPlayer(dt, ix, iz, jumpHeld) {
  const r = royale, d = r.drop;
  const pressed = jumpHeld && !dropJumpWas;
  dropJumpWas = jumpHeld;
  if (r.me === "bus") {
    if (d.phase === "bus") d.busPos(d.busT, move.pos).y -= 1.4;
    move.velocity.set(0, 0, 0);
    if (d.phase !== "bus" || d.pastIsland(d.busT) || (pressed && d.overIsland(d.busT))) {
      r.flight = new Flight(_busAt.copy(move.pos).setY(move.pos.y - 3), builtMap.map.edge);
      r.me = "fall";
      showWaveBanner(isTouch ? "Tap JUMP again to open the glider early" : "The glider opens by itself — jump again to open it early", 1800);
    } else if (pressed) showWaveBanner("Wait till you're over the island", 900);
    return;
  }
  const f = r.flight;
  f.update(dt, { forward: iz, strafe: ix, yaw: look.yaw, pitch: look.pitch, open: pressed }, dropGround);
  move.pos.copy(f.pos);
  move.velocity.copy(f.vel);
  if (f.state === "glide" && r.me !== "glide") { r.me = "glide"; setPlayerGlider(true); audio.reload(); }
  if (f.state === "landed") {
    move.reset(f.pos.x, f.pos.z, f.pos.y);
    // Tuck and roll off the landing (the way the glider was flying), then
    // the gun comes up and you're off.
    r.me = "roll";
    r.rollT = 0;
    r.rollYaw = r.flight.heading ?? look.yaw;
    r.flight = null;
    setPlayerGlider(false);
    setHolding("none");
    audio.land(7);
  }
}

/* The landing roll: you're carried forward and can't act till it's done. */
const ROLL_SPEED = 5;   // m/s at the start of the roll, easing to 0
function royaleRolling() { return royale?.me === "roll" && player.alive; }
function royaleRollK() { return royaleRolling() ? Math.min(1, royale.rollT / ROLL_TIME) : 0; }
function updateRoyaleRoll(dt) {
  const r = royale;
  r.rollT += dt;
  if (r.rollT < ROLL_TIME) return;
  r.me = "ground";
  setHolding("gun");
}

/* Joined after the sky lobby (onHello / onStage "bt"): skip our own lobby,
   board the bus where it is now, and run the match clock from where the
   room's is. Once the bus has crossed the island there's no way in: watch
   till the next match. */
const ROYALE_BUS_GONE = 1e6;
let royaleCatchUp = null;
function applyRoyaleCatchUp() {
  const c = royaleCatchUp;
  if (!c || !royale?.drop || gameState !== "playing" || !isStaging()) return;
  royaleCatchUp = null;
  const late = (performance.now() - c.at) / 1000;
  if (performance.now() - c.at > 30000) return;   // stale: from some older match
  if (c.sd && (c.sd >>> 0) !== royale.seed) setupRoyale(c.sd >>> 0);
  endStaging();
  const r = royale, d = r.drop;
  d.busT = Math.min(+c.bt + late, ROYALE_BUS_GONE);
  if (c.lv) { r.live = true; r.t = (+c.rt || 0) + late; }
  if (!d.overIsland(d.busT) && d.along(d.busT) > d.path.tIn) royaleLateSpectate();
}

function royaleLateSpectate() {
  const r = royale;
  r.lateJoin = true;
  r.me = "ground";
  r.flight = null;
  r.live = true;
  setPlayerGlider(false);
  player.alive = false;
  player.hp = 0;
  player.spawnGuard = 0;
  updateSpawnGuardHud();
  showWaveBanner("This drop already left — spectating till the next one", 2600);
}

function teardownRoyale() {
  if (!royale) return;
  royale.drop?.dispose();
  setPlayerGlider(false);
  royale.visual.dispose();
  royale.loot.clear();
  royale = null;
  els.cringe?.classList.remove("is-on");
  if (els.royaleAct) els.royaleAct.hidden = true;
  hideSpectateHud();
}

/* Everyone still standing, counted once each: us, peers, and the bots we
   host (on anyone else's screen those arrive as peers). */
function royaleAliveList() {
  const list = [];
  if (player.alive) list.push({ id: net.id, name: "You", pos: move.pos, yaw: look.yaw, me: true });
  const seen = new Set([net.id]);
  for (const rp of remotes.byId.values()) {
    if (!rp.alive || seen.has(rp.netId)) continue;
    seen.add(rp.netId);
    list.push({ id: rp.netId, name: rp.tagText, pos: rp.pos, yaw: rp.yaw || 0 });
  }
  for (const b of bots.bots) {
    if (!b.alive || seen.has(b.id)) continue;
    seen.add(b.id);
    list.push({ id: b.id, name: b.name, pos: b.pos, yaw: b.yaw || 0 });
  }
  return list;
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function updateRoyale(dt) {
  const r = royale;
  if (!r) return;
  updateRoyaleDropWorld(dt);
  if (r.live && !r.over) r.t += dt;
  const s = r.zone.state(r.t);
  r.visual.update(s, r.t);
  r.loot.update(dt, camera, player.alive ? move.pos : camera.position);

  const alive = royaleAliveList();
  if (r.live) r.peak = Math.max(r.peak, alive.length);

  // Zone, countdown, trolls left.
  const secs = Math.max(0, Math.ceil(s.left));
  const phase = s.stage === "final" ? "Final circle" : s.stage === "closing" ? `Zone ${s.phase} closing` : `Zone ${s.phase}`;
  const timer = s.stage === "final" ? "—" : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  const onBus = r.drop?.phase === "bus" && !r.live;
  const phaseText = onBus ? "Troll Bus" : phase;
  const timerText = onBus ? (r.me === "bus" ? "JUMP" : "—") : timer;
  if (els.royalePhase.textContent !== phaseText) els.royalePhase.textContent = phaseText;
  if (els.royaleTimer.textContent !== timerText) els.royaleTimer.textContent = timerText;
  const left = `${alive.length} left`;
  if (els.royaleAlive.textContent !== left) els.royaleAlive.textContent = left;
  els.royale.classList.toggle("is-closing", s.stage === "closing");
  const key = `${s.phase}:${s.stage}`;
  if (r.live && key !== r.stageKey) {
    if (r.stageKey) {
      if (s.stage === "closing") { showWaveBanner("The Cringe is closing in", 1600); audio.wave(); }
      else if (s.stage === "wait") showWaveBanner(`Zone ${s.phase} marked`, 1300);
      else if (s.stage === "final") showWaveBanner("Final circle", 1400);
    }
    r.stageKey = key;
  }

  // The Cringe: whole points of damage as they add up, armour ignored.
  const out = player.alive && r.live && RoyaleZone.outside(s, move.pos.x, move.pos.z);
  els.cringe.classList.toggle("is-on", !!out);
  if (out && s.dps > 0) {
    r.zoneAcc += s.dps * dt;
    if (r.zoneAcc >= 1) {
      const d = Math.floor(r.zoneAcc);
      r.zoneAcc -= d;
      damagePlayer(d, null, "zone");
    }
  } else r.zoneAcc = 0;

  // The bots we host take the Cringe too, and leave their gear when they go.
  if (net.isBotHost()) {
    for (const b of bots.bots) {
      if (r.live && b.alive && s.dps > 0 && RoyaleZone.outside(s, b.pos.x, b.pos.z)) {
        b.zoneAcc = (b.zoneAcc || 0) + s.dps * dt;
        if (b.zoneAcc >= 1) {
          const d = Math.floor(b.zoneAcc);
          b.zoneAcc -= d;
          const { killed } = bots.applyHit(b.id, d, { pierce: true });
          if (killed) {
            net.reportDeathAs(b.id, null, "zone", false);
            registerDeath(b.name, null, "zone", { victimTeam: b.team, victimIsBot: true, victimId: b.id });
          }
        }
      }
      if (!b.alive && !b.royaleDropped) { b.royaleDropped = true; royaleDropBotGear(b); }
      if (b.alive && !b.airborne) updateRoyaleBot(b, dt);
    }
  }
  if (r.noises.length && r.t - r.noises[0].t > 5) r.noises.shift();

  if (player.alive && r.live) royaleAutoPickup();
  updateRoyaleAct(dt);

  if (player.alive) {
    if (player.spawnGuard > 0) {
      player.spawnGuard -= dt;
      if (player.spawnGuard <= 0) { player.spawnGuard = 0; updateSpawnGuardHud(); }
      else if (els.spawnGuard?.hidden) updateSpawnGuardHud();
    }
  } else {
    // Out: watch whoever got you, then whoever is nearest; prev/next (and
    // the mouse, stick or a drag) go round everyone still standing.
    const prev = r.spectate;
    r.spectate = pickSpectateTarget(r.spectate, alive);
    if (r.spectate && r.spectate !== prev && r.spectate.id !== prev?.id) onSpectateTarget();
    const out = r.lateJoin ? "Joined mid-match — you're in the next one"
      : `Eliminated — ${ordinal(r.place || alive.length + 1)} of ${r.peak}`;
    if (!r.outShown) { r.outShown = true; els.respawn.hidden = false; }
    const watching = royaleSpectating();
    // The spectator view is clear: no 62% death fade, no low-HP pulse, and
    // the centre "Eliminated" line moves down into the bar.
    if (watching) els.deathfade.classList.remove("is-dead");
    els.respawn.hidden = watching;
    els.spectate.hidden = !watching;
    els.killcamBars.parentElement.classList.toggle("to-spectating", watching);
    const text = watching ? out : r.spectate ? `${out} · watching ${r.spectate.name}` : out;
    if (els.respawnText.textContent !== text) els.respawnText.textContent = text;
    if (watching) {
      const others = spectateOrder(alive);
      const n = `${others.findIndex((a) => a.id === r.spectate.id) + 1} of ${others.length} alive`;
      if (els.spectateOut.textContent !== out) els.spectateOut.textContent = out;
      if (els.spectateName.textContent !== r.spectate.name) els.spectateName.textContent = r.spectate.name;
      if (els.spectateN.textContent !== n) els.spectateN.textContent = n;
      const one = others.length < 2;
      els.spectatePrev.hidden = one;
      els.spectateNext.hidden = one;
    }
  }

  // The end: one troll left (or none, if the Cringe took the last two).
  const ended = r.live && !r.over && r.t > 3 && ((r.peak >= 2 && alive.length <= 1) || alive.length === 0);
  if (ended) {
    r.endT += dt;
    if (r.endT > 1.2) finishRoyale(alive);
  } else r.endT = 0;
}

function finishRoyale(alive) {
  const r = royale;
  r.over = true;
  hideSpectateHud();
  const won = player.alive;
  const place = won ? 1 : (r.place || r.peak);
  const bonus = r.lateJoin ? 0 : Math.max(0, r.peak - place) * 4 + (won ? 40 : 0);
  if (bonus > 0) addMatchXp(bonus, won ? "LAST TROLL STANDING" : `${ordinal(place).toUpperCase()} PLACE`);
  const winner = alive.find((a) => !a.me)?.name;
  r.finalPlace = place;
  endMatch(won ? "You win — last troll standing" : winner ? `${winner} wins` : "The Cringe wins");
}

/* Out of the match: where we finished, and everything we carried on the floor. */
function royaleOnDeath() {
  const r = royale;
  r.place = royaleAliveList().length + 1;
  r.act = null;
  // Out for good: nothing left to protect (its pill hung over the spectator view).
  player.spawnGuard = 0;
  updateSpawnGuardHud();
  let n = 0;
  const put = (fields) => {
    const a = n * 2.39996, d = 0.55 + n * 0.18;
    n++;
    royaleDrop(fields, move.pos.x + Math.cos(a) * d, move.pos.z + Math.sin(a) * d);
  };
  for (const id of [player.weaponId, player.secondaryId]) {
    const ws = id && player.weapons[id];
    if (ws) put(gunFields(ws));
  }
  for (let i = 0; i < player.plates; i++) put({ k: "plate", n: 1 });
  for (let i = 0; i < player.heals; i++) put({ k: "heal", n: 1 });
  player.plates = 0;
  player.heals = 0;
  player.armor = 0;
  updateRoyaleGear();
}

function gunFields(ws) {
  return { k: "gun", w: ws.def.id, a: ws.def.attachments, r: ws.royaleRarity | 0, ammo: ws.ammoReserve + ws.ammoInMag };
}

function royaleDrop(fields, x, z) {
  const it = royale.loot.add({ id: royale.loot.nextDropId(net.id), ...fields, x, y: royaleGround(x, z), z });
  net.publishLoot({ k: "add", item: LootField.wire(it) });
  return it;
}

/* A bot we host went down: whatever it was carrying. */
function royaleDropBotGear(b) {
  const at = (i) => [b.pos.x + Math.cos(i * 2.4) * (0.6 + i * 0.15), b.pos.z + Math.sin(i * 2.4) * (0.6 + i * 0.15)];
  let i = 0;
  if (WEAPON_DEFS[b.weaponId]) {
    const [x, z] = at(i++);
    royaleDrop({ k: "gun", w: b.weaponId, a: b.gunAtt || defaultLoadoutFor(b.weaponId), r: b.gunRarity ?? 0 }, x, z);
  }
  for (let n = 0; n < (b.plates | 0); n++) { const [x, z] = at(i++); royaleDrop({ k: "plate", n: 1 }, x, z); }
  for (let n = 0; n < (b.heals | 0); n++) { const [x, z] = at(i++); royaleDrop({ k: "heal", n: 1 }, x, z); }
  b.plates = 0;
  b.heals = 0;
}

// ---- Troll Royale bots (phase 2): they loot, plate up, heal, move with
// the zone and go to where the shooting is. All on the bot host. bots.js
// stays generic: it walks to whatever botObjective() hands it.

const BOT_LOOT_REACH = 1.3;      // metres: close enough to grab it
const BOT_LOOT_SEARCH = 30;      // how far a bot looks for loot it wants
const BOT_LOOT_SEARCH_ARMED = 10;
const BOT_NOISE_RANGE = 45;      // gunfire this close draws an armed bot in

/* First sight of a bot this match: a pistol and empty pockets, like us. */
function initRoyaleBot(b) {
  b.royaleInit = true;
  b.weaponId = ROYALE.startWeapon;
  b.secondaryId = ROYALE.startWeapon;
  b.gunRarity = null;     // null = still on the pistol
  b.gunAtt = null;
  b.armor = 0;
  b.plates = 0;
  b.heals = 0;
  b.act = null;
  b.lootId = null;
}

function botArmed(b) { return b.gunRarity != null; }

function botWants(b, it) {
  if (it.k === "gun") {
    if (WEAPON_DEFS[it.w]?.cls === "sidearm") return false;   // it already has one
    return !botArmed(b) || (it.r | 0) > b.gunRarity;
  }
  if (it.k === "plate") return (b.plates | 0) < ROYALE.carryPlates;
  if (it.k === "heal") return (b.heals | 0) < ROYALE.carryHeals;
  return false;
}

/* The loot a bot is heading for: it keeps its pick while it's still there
   and still wanted, else the nearest wanted item inside the coming circle
   that no other bot has already called. */
function royaleBotLoot(b, circle) {
  const items = royale.loot.items;
  if (b.lootId) {
    const it = items.get(b.lootId);
    if (it && botWants(b, it)) return it;
    b.lootId = null;
  }
  const claimed = new Set();
  for (const o of bots.bots) if (o !== b && o.alive && o.lootId) claimed.add(o.lootId);
  const reach = botArmed(b) && (b.plates | 0) > 0 ? BOT_LOOT_SEARCH_ARMED : BOT_LOOT_SEARCH;
  let best = null, bestD = reach;
  for (const it of items.values()) {
    if (claimed.has(it.id) || !botWants(b, it)) continue;
    if (Math.hypot(it.x - circle.x, it.z - circle.z) > circle.r) continue;
    const d = Math.hypot(it.x - b.pos.x, it.z - b.pos.z);
    if (d < bestD) { best = it; bestD = d; }
  }
  b.lootId = best?.id || null;
  return best;
}

/* The newest gunfire an armed bot can hear that isn't its own. */
function royaleNoiseFor(b) {
  if (!botArmed(b)) return null;
  for (let i = royale.noises.length - 1; i >= 0; i--) {
    const n = royale.noises[i];
    if (royale.t - n.t > 4 || n.by === b.id) continue;
    const d = Math.hypot(n.x - b.pos.x, n.z - b.pos.z);
    if (d > 6 && d < BOT_NOISE_RANGE) return { id: `noise-${Math.round(n.x / 6)}-${Math.round(n.z / 6)}`, x: n.x, z: n.z };
  }
  return null;
}

/* Gunfire, for the bots to hear. */
function royaleNoise(x, z, by) {
  if (!royale?.live) return;
  royale.noises.push({ x, z, t: royale.t, by });
  if (royale.noises.length > 24) royale.noises.shift();
}

/* Where the zone says a bot must be, or null. `urgent` when it's already
   burning: bots.js then moves it even mid-fight. */
function royaleBotObjective(b) {
  if (!royale.live) return null;
  if (!b.royaleInit) initRoyaleBot(b);
  const s = royale.zone.state(royale.t);
  const c = s.next && s.stage !== "final" ? s.next : s;
  const outNow = RoyaleZone.outside(s, b.pos.x, b.pos.z);
  const d = Math.hypot(b.pos.x - c.x, b.pos.z - c.z);
  const zone = { id: `zone-${s.phase}`, x: c.x, z: c.z, radius: Math.max(2, c.r * 0.5), urgent: outNow };
  const soon = s.stage !== "wait" || s.left < 15;
  if (outNow || (d > c.r * 0.8 && soon)) return zone;
  const it = royaleBotLoot(b, c);
  // Without a real gun, getting one beats trading pistol shots.
  if (it) {
    const d = Math.hypot(it.x - b.pos.x, it.z - b.pos.z);
    const need = (it.k === "gun" && !botArmed(b))
      || (it.k === "plate" && !(b.plates | 0) && !(b.armor | 0) && d < 15)
      || (it.k === "heal" && b.hp < 50 && d < 15);
    return { id: `loot-${it.id}`, x: it.x, z: it.z, radius: 0.9, urgent: need || d < 8 };
  }
  const noise = royaleNoiseFor(b);
  if (noise) return { ...noise, radius: 3 };
  if (d > c.r * 0.8) return zone;
  return null;   // armed and stocked: hunt (bots.js walks to the nearest enemy)
}

/* Per frame, per bot we host: grab what it reached, plate or heal when
   nobody is in sight. */
function updateRoyaleBot(b, dt) {
  if (!b.royaleInit) initRoyaleBot(b);
  if (b.lootId) {
    const it = royale.loot.items.get(b.lootId);
    if (!it) b.lootId = null;
    else if (Math.hypot(it.x - b.pos.x, it.z - b.pos.z) < BOT_LOOT_REACH && botWants(b, it)) {
      royaleTake(it);
      b.lootId = null;
      if (it.k === "gun") {
        // A real gun in hand: the pistol goes back to being the sidearm.
        if (botArmed(b)) {
          royaleDrop({ k: "gun", w: b.weaponId, a: b.gunAtt || defaultLoadoutFor(b.weaponId), r: b.gunRarity }, b.pos.x + 0.6, b.pos.z);
        }
        b.weaponId = it.w;
        b.gunAtt = it.a;
        b.gunRarity = it.r | 0;
        b.holdingSecondary = false;
      } else if (it.k === "plate") b.plates++;
      else if (it.k === "heal") b.heals++;
    }
  }
  // Plate or heal with nobody in sight, or mid-fight while nothing has hit
  // it for a couple of seconds (behind cover); a hit cancels it.
  const quiet = !b.lastTargetId || performance.now() - (b.hurtAt || 0) > 2000;
  if (b.act) {
    if (!quiet || (b.hurtAt || 0) > b.act.at) { b.act = null; return; }
    b.act.t += dt;
    if (b.act.t < b.act.dur) return;
    if (b.act.kind === "plate") { b.plates--; b.armor = Math.min(ROYALE.maxArmor, (b.armor | 0) + ROYALE.plateHp); }
    else { b.heals--; b.hp = b.maxHp || 100; }
    b.act = null;
  } else if (quiet && b.plates > 0 && (b.armor | 0) < ROYALE.maxArmor) {
    b.act = { kind: "plate", t: 0, dur: ROYALE.plateTime * 1.2, at: performance.now() };
  } else if (quiet && b.heals > 0 && b.hp < 70) {
    b.act = { kind: "heal", t: 0, dur: ROYALE.healTime, at: performance.now() };
  }
}

/* A bot's shot hits as hard as the gun it's holding: the pistol it lands
   with is weak, a looted gun better, a rarer one better still. */
function royaleBotDamage(b, dmg) {
  if (!botArmed(b) || b.holdingSecondary) return dmg * 0.65;
  return dmg * (0.95 + 0.07 * (b.gunRarity | 0));
}

/* Someone else's pickup or drop. */
function onRoyaleLoot(p, m) {
  if (!royale) return;
  if (m.k === "take") { royale.loot.take(String(m.i)); royale.drop?.lobbyTake(String(m.i)); }
  else if (m.k === "add" && m.item && typeof m.item.id === "string") royale.loot.add(m.item);
}

function royaleTake(it) {
  royale.loot.take(it.id);
  royale.drop?.lobbyTake(it.id);
  net.publishLoot({ k: "take", i: it.id });
}

/* Plates, Hopium and ammo go straight into your pockets when there's room. */
function royaleAutoPickup() {
  const it = royale.loot.nearest(move.pos.x, move.pos.z, 1.3, (x) => x.k !== "gun" && royaleWants(x));
  if (!it) return;
  royaleTake(it);
  if (it.k === "plate") player.plates++;
  else if (it.k === "heal") player.heals++;
  else if (it.k === "ammo") {
    for (const id of [player.weaponId, player.secondaryId]) {
      const ws = id && player.weapons[id];
      if (ws) ws.ammoReserve = Math.min(ws.def.reserveMax, ws.ammoReserve + Math.ceil(ws.def.reserveMax * 0.4));
    }
  }
  audio.reload();
  showWaveBanner(`+ ${ITEM_NAMES[it.k]}`, 700);
  updateRoyaleGear();
}

function royaleWants(it) {
  if (it.k === "plate") return player.plates < ROYALE.carryPlates;
  if (it.k === "heal") return player.heals < ROYALE.carryHeals;
  if (it.k === "ammo") {
    return [player.weaponId, player.secondaryId].some((id) => {
      const ws = id && player.weapons[id];
      return ws && ws.ammoReserve < ws.def.reserveMax;
    });
  }
  return false;
}

/* A gun off the floor: into the empty slot if there is one, else in place
   of the one in your hands, which drops where you stand. */
function royalePickupGun(it) {
  royaleTake(it);
  const ws = new WeaponState(it.def);
  ws.royaleRarity = it.r | 0;
  const inMag = Math.min(ws.def.magSize, it.ammo ?? ws.def.magSize);
  ws.ammoInMag = inMag;
  ws.ammoReserve = it.ammo != null ? Math.max(0, it.ammo - inMag) : Math.round(ws.def.reserveMax * 0.35);
  let slot = !player.secondaryId ? "secondary" : currentWeaponSlot === "secondary" ? "secondary" : "primary";
  // The same gun as the other slot would share its key: take that slot.
  const other = slot === "primary" ? player.secondaryId : player.weaponId;
  if (other === it.def.id) slot = slot === "primary" ? "secondary" : "primary";
  const oldId = slot === "primary" ? player.weaponId : player.secondaryId;
  if (oldId && player.weapons[oldId]) {
    const a = Math.random() * Math.PI * 2;
    royaleDrop(gunFields(player.weapons[oldId]), move.pos.x + Math.cos(a) * 0.8, move.pos.z + Math.sin(a) * 0.8);
    delete player.weapons[oldId];
  }
  if (slot === "primary") player.weaponId = it.def.id; else player.secondaryId = it.def.id;
  player.weapons[it.def.id] = ws;
  currentWeaponSlot = slot;
  setActiveWeaponMesh(it.def);
  setHolding("gun");
  audio.reload();
  showWaveBanner(`Picked up ${gunDisplayName(it)}`, 1200);
}

/* Plating up / Hopium: a short channel, cancelled by firing or dying. */
function startRoyaleAct(kind) {
  if (!royale || !player.alive || royale.act || isStaging()) return;
  if (kind === "plate" && (player.plates <= 0 || player.armor >= ROYALE.maxArmor)) return;
  if (kind === "heal" && (player.heals <= 0 || player.hp >= player.maxHp)) return;
  royale.act = { kind, t: 0, dur: kind === "plate" ? ROYALE.plateTime : ROYALE.healTime, rate: (player.maxHp - player.hp) / ROYALE.healTime };
  audio.throwGear();
}

function cancelRoyaleAct() {
  if (royale) royale.act = null;
  if (els.royaleAct) els.royaleAct.hidden = true;
}

function updateRoyaleAct(dt) {
  const a = royale.act;
  if (!a || !player.alive) { if (a) royale.act = null; els.royaleAct.hidden = true; return; }
  a.t += dt;
  const k = Math.min(1, a.t / a.dur);
  if (a.kind === "heal") player.hp = Math.min(player.maxHp, player.hp + a.rate * dt);
  els.royaleAct.hidden = false;
  const text = a.kind === "plate" ? "Plating up" : "Hopium";
  if (els.royaleActText.textContent !== text) els.royaleActText.textContent = text;
  els.royaleActFill.style.width = `${Math.round(k * 100)}%`;
  els.royaleActFill.style.background = a.kind === "plate" ? "#7fb2ff" : "#55ff7a";
  if (k < 1) return;
  if (a.kind === "plate") {
    player.plates--;
    player.armor = Math.min(ROYALE.maxArmor, player.armor + ROYALE.plateHp);
    audio.reload();
  } else {
    player.heals--;
    player.hp = player.maxHp;
  }
  royale.act = null;
  els.royaleAct.hidden = true;
  updateRoyaleGear();
}

function updateRoyaleGear() {
  if (!els.armor) return;
  const on = !!royale;
  els.armor.hidden = !on;
  els.gearPlates.hidden = !on;
  els.gearHeals.hidden = !on;
  if (!on) return;
  [...els.armor.children].forEach((seg, i) => {
    seg.style.setProperty("--p", Math.max(0, Math.min(1, (player.armor - i * ROYALE.plateHp) / ROYALE.plateHp)).toFixed(3));
  });
  els.gearPlatesN.textContent = String(player.plates);
  els.gearHealsN.textContent = String(player.heals);
  els.gearPlates.classList.toggle("is-empty", player.plates <= 0);
  els.gearHeals.classList.toggle("is-empty", player.heals <= 0);
}

/* Spectating: keep watching someone while they're alive; our killer first. */
function pickSpectateTarget(cur, alive) {
  const others = alive.filter((a) => !a.me);
  if (!others.length) return null;
  if (cur) { const still = others.find((a) => a.id === cur.id); if (still) return still; }
  const killer = others.find((a) => a.id === player.lastKilledBy);
  if (killer) return killer;
  let best = null, bestD = Infinity;
  for (const a of others) {
    const d = Math.hypot(a.pos.x - move.pos.x, a.pos.z - move.pos.z);
    if (d < bestD) { best = a; bestD = d; }
  }
  return best;
}

function royaleSpectating() {
  return !!royale && !player.alive && !!royale.spectate && !killcam.replaying && gameState === "playing";
}

/* Everyone still standing but us, in a fixed order so prev/next go round. */
function spectateOrder(alive = royaleAliveList()) {
  return alive.filter((a) => !a.me).sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function cycleSpectate(dir) {
  if (!royaleSpectating()) return;
  const others = spectateOrder();
  if (others.length < 2) return;
  const at = others.findIndex((a) => a.id === royale.spectate.id);
  royale.spectate = others[(at + dir + others.length) % others.length];
  onSpectateTarget();
}

/* A new troll to watch: start from behind them, looking where they look. */
let specSnap = true;
function onSpectateTarget() {
  const t = royale?.spectate;
  if (!t) return;
  look.yaw = t.yaw;
  look.pitch = -0.18;
  specSnap = true;
}

/* A free orbit round whoever we're watching: the mouse, stick or a drag
   swing it (look.yaw / look.pitch, which nothing else reads while we're
   out), pulled in off walls, and eased onto their 15 Hz position updates.
   It used to be locked behind their back and looking where they did. */
const _specPivot = new THREE.Vector3();
const _specWant = new THREE.Vector3();
const _specDir = new THREE.Vector3();
const SPEC_DIST = 4.2;
function placeSpectateCamera(dt) {
  const t = royale.spectate;
  _specWant.set(t.pos.x, (t.pos.y || 0) + 1.55, t.pos.z);
  if (specSnap || _specPivot.distanceTo(_specWant) > 12) { _specPivot.copy(_specWant); specSnap = false; }
  else _specPivot.lerp(_specWant, Math.min(1, dt * 10));
  _euler.set(Math.max(-1.1, Math.min(0.45, look.pitch)), look.yaw, 0);
  _specDir.set(0, 0, 1).applyEuler(_euler);   // from the pivot back toward the camera
  const len = Math.max(0.6, raycastWorld(colliders, _specPivot, _specDir, SPEC_DIST) - 0.15);
  camera.position.copy(_specPivot).addScaledVector(_specDir, len);
  camera.lookAt(_specPivot.x, _specPivot.y + 0.3, _specPivot.z);
  // Their floating name would sit across the top of the view from here;
  // the spectate bar already says who it is.
  for (const rp of remotes.byId.values()) if (rp.netId === t.id && rp.tag) rp.tag.visible = false;
}

els.spectatePrev?.addEventListener("click", () => cycleSpectate(-1));
els.spectateNext?.addEventListener("click", () => cycleSpectate(1));

function hideSpectateHud() {
  if (els.spectate) els.spectate.hidden = true;
  els.killcamBars.parentElement.classList.remove("to-spectating");
}

// Touch: the plate and Hopium chips are buttons.
els.gearPlates?.addEventListener("click", () => startRoyaleAct("plate"));
els.gearHeals?.addEventListener("click", () => startRoyaleAct("heal"));

/* Zone rings on the minimap: the Cringe's edge now, and the next circle. */
function drawRoyaleMinimap(ctx, size) {
  const s = royale.zone.state(royale.t);
  const scale = (size - 12) / (ARENA.maxX - ARENA.minX);
  const ring = (x, z, r, style, w) => {
    const [mx, mz] = mapToMinimap(x, z);
    ctx.strokeStyle = style;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(mx, mz, Math.max(2, r * scale), 0, Math.PI * 2);
    ctx.stroke();
  };
  if (s.next) ring(s.next.x, s.next.z, s.next.r, "rgba(255,255,255,.85)", 1.5);
  ring(s.x, s.z, s.r, "rgba(125,255,74,.95)", 2);
}

// -------------------- Infection --------------------
//
// Nobody hosts the match: every client turns itself when it dies, and its
// team rides out on the next state message. The one decision that has to be
// made once is who starts infected, so the bot host (lowest id, same as for
// bots) makes it and broadcasts an `infect` message. Every client counts
// the sides from what it sees and ends the match itself when no survivor is
// left, the same way score limits already work.

let infectionStarted = false;
let infectionT = 0;          // countdown to the first infection
let infectionCalled = false; // the "first infection in..." banner
let lastSurvivorCalled = false;
let reinfectT = 0;           // host: grace before replacing infected who all left
let noSurvivorsT = 0;        // how long the count has read zero survivors
let infectionShown = "";     // last counts painted into the HUD

function resetInfection() {
  infectionStarted = false;
  infectionT = INFECTION.firstDelay;
  infectionCalled = false;
  lastSurvivorCalled = false;
  reinfectT = 0;
  noSurvivorsT = 0;
  infectionShown = "";
  const inf = isInfection();
  // The last match's bots would otherwise sit in the peer map, still on the
  // sides they ended on, until they time out — long enough to be counted as
  // infected in a match nobody's been infected in yet.
  if (inf) for (const [id, p] of net.peers) if (isBotPeer(p)) { remotes.byId.get(id)?.dispose(); remotes.byId.delete(id); net.peers.delete(id); }
  els.namePhantom.textContent = inf ? "Survivors" : TEAMS.phantom.name;
  els.nameGhost.textContent = inf ? "Infected" : TEAMS.ghost.name;
  if (player.maxHp === INFECTION.hp) player.maxHp = 100;
  if (inf) net.setTeam("phantom");
}

/* Sword only, faster (see move.update), tougher. Survivors keep their kit. */
function applyInfectionLoadout() {
  if (!isInfection()) return;
  player.maxHp = isInfected() ? INFECTION.hp : 100;
  player.hp = Math.min(player.hp, player.maxHp);
  if (!isInfected()) return;
  cooking.def = null;
  cooking.slot = null;
  els.cook.hidden = true;
  player.gear.lethal = 0;
  player.gear.tactical = 0;
  setHolding("melee");
  updateGearHud();
}

function markInfectionStarted() {
  if (infectionStarted) return;
  infectionStarted = true;
  // The three minutes are for surviving, so they start now.
  matchClockT = currentMode().timeLimit;
  matchClockShown = -1;
  paintMatchClock();
}

/* Everyone in the match by side, from what this client can see. Survivors
   who are down still count: they're about to get up infected, and until
   their team flips they haven't. */
function infectionCounts() {
  let survivors = 0, infected = 0, lastName = null;
  const tally = (team, name) => {
    if (team === "ghost") infected++;
    else if (team === "phantom") { survivors++; lastName = name; }
  };
  tally(net.team, "You");
  for (const p of net.peers.values()) {
    if (String(p.id).startsWith("streak-")) continue;
    tally(p.team, p.name);
  }
  return { survivors, infected, lastName };
}

/* Host only: pick who starts infected and tell everyone. */
function pickFirstInfected() {
  const ids = [net.id];
  for (const p of net.peers.values()) {
    if (String(p.id).startsWith("streak-") || p.team === "ghost") continue;
    ids.push(p.id);
  }
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const chosen = ids.slice(0, ids.length >= INFECTION.twoFirstAt ? 2 : 1);
  if (net.active) net.send({ t: "infect", id: net.id, ids: chosen });
  applyInfect(chosen);
}

function applyInfect(ids) {
  if (!isInfection() || gameState !== "playing") return;
  markInfectionStarted();
  const others = [];
  for (const id of ids) {
    if (id === net.id) {
      if (net.team !== "ghost") {
        net.setTeam("ghost");
        applyInfectionLoadout();
        player.hp = player.maxHp;
      }
      showWaveBanner("YOU'RE INFECTED — cut them down", 2000);
      continue;
    }
    const b = bots.byId(id);
    if (b) infectBot(b);
    others.push(nameFor(id) || "someone");
  }
  if (others.length && !ids.includes(net.id)) {
    showWaveBanner(`${others.join(" & ")} ${others.length > 1 ? "are" : "is"} infected — run`, 2000);
  }
  audio.wave();
}

/* Bot host: turn one of our bots. */
function infectBot(b) {
  b.team = "ghost";
  b.meleeOnly = true;
  b.speedMult = INFECTION.speed;
  b.maxHp = INFECTION.hp;
  b.holdingSecondary = false;
  if (b.alive) b.hp = b.maxHp;
}

/* Bot host, every tick: new bots join the side the match is on (survivors
   before the first infection, infected after), and a survivor bot that's
   down gets up infected. */
function sortInfectionBots() {
  for (const b of bots.bots) {
    if (!b.infectionSorted) {
      b.infectionSorted = true;
      if (infectionStarted) infectBot(b);
      else { b.team = "phantom"; b.meleeOnly = false; }
    } else if (infectionStarted && !b.alive && b.team === "phantom") {
      infectBot(b);
    }
  }
}

/* A bot we host swings its sword at `target`. Whether it's in reach is
   bots.js's call; this plays the swing everywhere and lands the hit. */
function botMelee(bot, target) {
  const def = MELEE_DEFS.keyboard;
  bot.meleeSwing = ((bot.meleeSwing | 0) + 1) & 1;
  const p = net.peers.get(bot.id);
  if (p) { p.meleeSeq = (p.meleeSeq | 0) + 1; p.meleeKind = bot.meleeSwing; p.meleeDef = def.id; }
  if (net.active) net.publishMeleeAs(bot.id, bot.meleeSwing, def.id);
  botDealDamage(bot, target.id, def.damage, false, def.id);
}

function paintInfectionCounts(c) {
  const shown = `${c.survivors}:${c.infected}`;
  if (shown === infectionShown) return;
  infectionShown = shown;
  teamScores.phantom = c.survivors;
  teamScores.ghost = c.infected;
  updateTeamHud();
}

function updateInfection(dt) {
  if (!infectionStarted) {
    paintInfectionCounts(infectionCounts());
    if (isStaging()) return;
    // Someone's already turned. On our first live tick that means we joined
    // a match under way, and a latecomer comes in infected; after that it's
    // just the host's message still on its way.
    if (infectionCounts().infected > 0) {
      if (!infectionCalled) { net.setTeam("ghost"); applyInfectionLoadout(); }
      infectionCalled = true;
      markInfectionStarted();
      return;
    }
    if (!infectionCalled) {
      infectionCalled = true;
      showWaveBanner(`First infection in ${INFECTION.firstDelay}s — spread out`, 1800);
    }
    infectionT -= dt;
    if (infectionT <= 0 && (net.isBotHost() || !net.active)) pickFirstInfected();
    return;
  }

  const c = infectionCounts();
  paintInfectionCounts(c);

  // Held for a moment before it counts: a peer's team can read wrong for a
  // message or two (they flipped, their next state is in flight).
  noSurvivorsT = c.survivors === 0 && c.infected > 0 ? noSurvivorsT + dt : 0;
  if (noSurvivorsT > 0.5) { endMatch("Infected win"); return; }

  if (c.survivors === 1 && !lastSurvivorCalled) {
    lastSurvivorCalled = true;
    showWaveBanner(net.team === "phantom" ? "LAST SURVIVOR — it's all on you" : `LAST SURVIVOR — ${c.lastName}`, 2200);
    audio.wave();
  }

  // Every infected left the room: the host starts it again rather than
  // handing the survivors a match with nobody to run from.
  if (c.infected === 0 && (net.isBotHost() || !net.active)) {
    reinfectT += dt;
    if (reinfectT > 3) { reinfectT = 0; pickFirstInfected(); }
  } else {
    reinfectT = 0;
  }
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
  // Score ticks every second the hill is held, unlike the XP block below —
  // objective play is meant to build streaks as fast as killing does.
  awardScore(SCORE.objectiveTick);
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
  if (wasPlanted && bomb.update(dt)) {
    const s = bomb.siteAt(bomb.site);
    const at = new THREE.Vector3(s.x, (groundHeightAt(colliders, s.x, s.z, 1) ?? 0) + 0.5, s.z);
    explosionFx({ kind: "lethal", glow: 0xffb347, radius: 14 }, at);
    // The blast is the round-ender, not a weapon: it kills whoever stayed.
    if (player.alive && Math.hypot(move.pos.x - s.x, move.pos.z - s.z) < 9) damagePlayer(500, null, "bomb", false, at);
    sndRoundWin(sndAttackTeam, "bomb detonated");
  }

  // Status line: fuse once planted, otherwise the plant clock — and a callout
  // when someone else is on the bomb, which you'd hear in a real match.
  if (!sndRoundOver) {
    els.bombTimer.hidden = !sndLive;
    const planted = bomb.state === "planted";
    const secs = Math.ceil(planted ? bomb.fuse : sndClock);
    const text = planted ? `${secs}s` : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
    if (els.bombTimer.textContent !== text) els.bombTimer.textContent = text;
    els.bombTimer.classList.toggle("is-planted", planted);
    let side = planted
      ? (isAttacker ? `Defend the plant — site ${bomb.site}` : `Defuse site ${bomb.site}`)
      : (isAttacker ? (bomb.carrierId === net.id ? "You have the bomb" : "Plant the bomb") : "Defend the sites");
    if (remoteBombAct && remoteBombAct.until > performance.now() && !bomb.action) {
      side = remoteBombAct.kind === "plant" ? `Bomb being planted — site ${remoteBombAct.site}!` : "Bomb being defused!";
    }
    if (els.bombSide.textContent !== side) els.bombSide.textContent = side;
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

  if (sndRoundOver || !sndLive) return;
  sndLiveT += dt;

  // The plant clock. The bot host calls time and tells the room; everyone
  // else waits a beat for that call before deciding it themselves, so a
  // lost packet can't leave one client stuck in an expired round.
  if (bomb.state !== "planted") {
    sndClock = Math.max(0, sndClock - dt);
    if (sndClock <= 0) {
      if (!net.active || net.isBotHost()) {
        if (net.active) net.publishBomb({ kind: "event", action: "timeup" });
        sndRoundWin(sndDefendTeam(), "time expired");
        return;
      }
      sndTimeupWait += dt;
      if (sndTimeupWait > 1.5) { sndRoundWin(sndDefendTeam(), "time expired"); return; }
    }
  }

  // Elimination. Attackers wiped before a plant lose; defenders wiped before
  // a plant lose too (post-plant the fuse decides — a bomb ticking with
  // nobody left to defuse just goes off). A side that never had anyone on
  // it (a solo room) can't be "eliminated" — the clock handles that. The
  // grace period covers peers whose alive flag is still last round's.
  const { attackers, defenders } = sndAliveCounts();
  sndSeen.attackers = Math.max(sndSeen.attackers, attackers);
  sndSeen.defenders = Math.max(sndSeen.defenders, defenders);
  if (sndLiveT > SND_GRACE && bomb.state !== "planted") {
    if (sndSeen.attackers > 0 && attackers <= 0) { sndRoundWin(sndDefendTeam(), "attackers eliminated"); return; }
    if (sndSeen.defenders > 0 && defenders <= 0) { sndRoundWin(sndAttackTeam, "defenders eliminated"); return; }
  }

  // The carrier died holding it: it doesn't need a physical pickup prop for
  // a first cut of this mode — it just passes to the next living attacker,
  // lowest id first, so every client picks the same one independently. Only
  // the bot host actually assigns it, same authority that owns bot state.
  if (bomb.state === "carried" && !isCarrierAlive() && (net.isBotHost() || !net.active)) {
    const next = pickCarrier();
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
  sndCanInteract = !!(onSite || canDefuse);
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
        awardScore(SCORE.plant);
        achievements.award("bombtech");
      } else {
        bomb.defuse();
        sndRoundWin(sndDefendTeam(), "bomb defused");
        if (net.active) net.publishBomb({ kind: "event", action: "defused" });
        awardScore(SCORE.defuse);
        achievements.award("bombtech");
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
    if (onSite) { els.bombPrompt.hidden = false; els.bombPromptText.textContent = `Plant (site ${onSite.id})`; els.bombBarFill.style.width = "0%"; }
    else if (canDefuse) { els.bombPrompt.hidden = false; els.bombPromptText.textContent = "Defuse"; els.bombBarFill.style.width = "0%"; }
    else els.bombPrompt.hidden = true;
  }

  if (net.isBotHost() || !net.active) updateSndBots(dt);
}

/* Gun Game and One in the Chamber force what you're holding and leave no
   secondary slot to scavenge into, so a dead player's gun in those modes
   isn't worth dropping — the ladder or the one-shot pistol already decides
   the next gun for everyone. */
function scavengeAllowed() {
  // Infection: the infected can't carry a gun, so nothing is worth dropping.
  // Troll Royale: everything on the ground is loot (royale.js), not a drop.
  return !weaponForMode(currentMode(), gunGameProgress) && !isInfection() && !isRoyale();
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
  // Troll Royale: you land with a pistol and find the rest.
  const startId = mode.royale ? ROYALE.startWeapon : forcedId;
  let def = startId ? resolveWeapon(startId, defaultLoadoutFor(startId)) : loadout.resolved;
  if (mode.tuneWeapon) def = mode.tuneWeapon(def);
  player.weaponId = def.id;
  player.weapons = { [def.id]: new WeaponState(def) };
  if (!startId) {
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
    return { code, kind: await net.start(code, { name: playerName(), mapId: loadout.mapId, uid: playerUid() }) };
  }
  for (let shard = 1; shard <= QUICKPLAY_MAX_SHARDS; shard++) {
    const code = shard === 1 ? base : `${base}${shard}`;
    setNetStatus(shard === 1 ? "Connecting…" : `Server full, trying another (${shard})…`);
    const kind = await net.start(code, { name: playerName(), mapId: loadout.mapId, uid: playerUid() });
    if (!kind) return { code, kind };   // real connectivity failure — retrying won't help
    // Real people only: a room's bots (mirrored into its peer list) would
    // otherwise make a busy Royale look full and shard every joiner away.
    const cap = isRoyale() ? MAX_PLAYERS_ROYALE : MAX_PLAYERS;
    if (net.humanCount <= cap || shard === QUICKPLAY_MAX_SHARDS) return { code, kind };
    net.stop();
  }
}

async function startGame() {
  audio.resume();   // the click that got us here is the gesture Web Audio needs
  // View mode: the lobby's map, nobody in it (see isView).
  if (viewModeOn() && modeId !== "view") { viewPrevMode = modeId; modeId = "view"; }
  else if (!viewModeOn() && modeId === "view") modeId = viewPrevMode || "ops";
  if (isPvp()) {
    els.startBtn.disabled = true;
    setNetStatus("Connecting…");
    const result = els.room.value && roomIsCustom
      ? { code: els.room.value, kind: await net.start(els.room.value, { name: playerName(), mapId: loadout.mapId, uid: playerUid() }) }
      : await joinQuickplay();
    els.startBtn.disabled = false;
    if (!result.kind) { setNetStatus("Couldn't reach the room. Try another code.", "bad"); return; }
    els.room.value = result.code;
    net.chooseTeam();
    chat.render();   // it was built before the room connected
    setNetStatus(`Live · ${result.kind} · room ${result.code} · ${teamName(net.team)}`, "live");
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

/* Compile every shader the match will need while the countdown runs, so the
   first grenade, the first streak and the first bot in view don't each
   freeze the frame they appear (a shader compiles on first draw, and on a
   laptop GPU that is hundreds of ms apiece). The map and the bots are already
   in the scene; the rest gets one throwaway stand-in each, parked out of
   sight, compiled, and removed. compileAsync lets the driver compile in
   parallel where it can, so the countdown keeps ticking meanwhile. */
const WARM_MODELS = ["care-package", "helicopter", "hunter-drone", "recon-drone", "strike-jet", "k9-dog", "vtol-warship"];
let warmedOnce = false;
async function warmShaders() {
  if (!renderer.compileAsync) return;
  const stand = new THREE.Group();
  stand.position.set(0, -200, 0);
  for (const def of Object.values(THROWABLE_DEFS)) {
    stand.add(new THREE.Mesh(grenades.geo, grenades.matFor(def)));
  }
  scene.add(stand);
  try {
    if (!warmedOnce) {
      const models = await Promise.all(WARM_MODELS.map((m) => loadModel(m).catch(() => null)));
      for (const m of models) if (m) stand.add(m);
    }
    await renderer.compileAsync(scene, camera);
    await renderer.compileAsync(weaponScene, weaponCamera);
    warmedOnce = true;
  } catch (e) {
    // Only ever a head start; the frame will compile whatever this missed.
  } finally {
    scene.remove(stand);
  }
}

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
  // A beat in, once the bots that fill the room have streamed in.
  setTimeout(() => { if (isStaging()) warmShaders(); }, 900);
  // The sky lobby is a place to walk round in, not a frozen countdown card.
  els.staging.hidden = !!royale?.drop;
  if (!royale?.drop) document.body.classList.add("to-staging-on");
  else showWaveBanner("SKY LOBBY — try the guns, the bus leaves soon", 2600);
  els.stagingMode.textContent = isPvp()
    ? `${currentMode().name} — ${builtMap.map.name}`
    : builtMap.map.name;
  els.stagingSub.textContent = isInfection()
    ? "Everyone starts clean. Someone won't stay that way."
    : isPvp() && net.team
    ? `You are ${TEAMS[net.team].name}`
    : "Get ready";
  updateStagingRoster();
}

function endStaging() {
  // Already ended. (The sky lobby hides the countdown card, so a hidden card
  // alone doesn't mean that there.)
  if (stageT <= 0 && els.staging.hidden && royale?.drop?.phase !== "lobby") return;
  stageT = 0;
  spawnOpening = false;
  els.staging.hidden = true;
  document.body.classList.remove("to-staging-on");
  // The opening seconds still deserve the cover a respawn gets.
  player.spawnGuard = isPvp() ? SPAWN_GUARD : 0;
  updateSpawnGuardHud();
  if (royale?.drop) startRoyaleBus();
  else if (royale) { royale.live = true; royale.t = 0; showWaveBanner("DROP IN — last troll standing wins", 1800); }
  else if (isPvp() && !isSnd()) showWaveBanner("FIGHT", 1100);
  audio.stageTick(true);
  // The horde/zombie clock — and the first wave banner — start now, not when
  // the map loaded, so nothing was ever ticking behind the countdown.
  if (isZombies()) nextZombieRound();
  else if (isSnd()) sndGoLive();
  else if (!isPvp() && !isRange()) nextWave();

  // Search & Destroy's clock is per-round elsewhere (PLANT_TIME/DEFUSE_TIME);
  // this is the whole-match clock for score-limited modes like TDM.
  if (isPvp() && !isSnd()) resetMatchClock();
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
      net.publishStage(loadout.mapId, modeId, stageT, royale ? royale.seed : undefined);
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
  killcam.clear();
  suppressT = 0;
  clearHitDirs();
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
  player.matchT = 0;
  player.vetBotT = 0;
  roomSkillSeen = null;
  player.lastKilledBy = null;
  // A fresh match starts with nothing earned and nothing banked, and picks up
  // whatever three streaks the lobby has selected.
  streaks.reset();
  streaks.setSelected(streakPicker.selected);
  uavUntil.phantom = 0;
  uavUntil.ghost = 0;
  vsatUntil.phantom = 0;
  vsatUntil.ghost = 0;
  clearStreakLocks();
  killstreakUi.reset();
  recentTeamKillers.clear();
  achievements.reset();
  clearStreakEntities();
  if (els.ssSlots) els.ssSlots.dataset.sig = "";
  updateStreakHud();
  damageLog.clear();
  dealtLog.clear();
  lastHitRange.clear();
  if (els.deathBy) els.deathBy.hidden = true;
  elapsedRun = 0;
  respawnT = 0;
  teamScores.phantom = 0;
  teamScores.ghost = 0;
  updateTeamHud();

  gunGameProgress = 0;
  hillAcc = 0;
  resetInfection();

  spawnDeaths.clear();
  // Spawn protection starts when the countdown ends, not when the map loads —
  // burning it during staging would spend it before anyone can shoot.
  player.spawnGuard = 0;
  updateSpawnGuardHud();

  loadMap(matchMapId(mapId));
  player.armor = 0;
  player.plates = 0;
  player.heals = 0;
  if (isRoyale()) setupRoyale(); else teardownRoyale();
  spawnOpening = true;   // cleared by endStaging — everyone opens on their own side
  clearDeathVisuals();   // dying as the last match ended left the screen dark
  const sp = royale?.drop ? royale.drop.lobbySpot(0) : isPvp() ? teamSpawn() : builtMap.playerSpawn;
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
  resetFireShake();
  remotes.clear();
  bots.clear();

  hill = currentMode().hill
    ? new Hill(pickHillPoints(builtMap.map.bounds, builtMap.spawnPoints, colliders))
    : null;
  setHillMarker(hill);

  if (currentMode().rounds) {
    bombSites = pickBombSites(builtMap.map.bounds, builtMap.spawnPoints, colliders);
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
    zdir = new ZombieDirector(scene, ARENA, colliders, builtMap.map.zombieLayout());
  } else if (!isPvp() && !isView()) {
    spawner = new WaveSpawner(scene, ARENA, spawnPoints, colliders);
  }

  const pvp = isPvp();
  const snd = isSnd();
  els.hudTeams.hidden = !pvp || isRoyale();
  els.royale.hidden = !isRoyale();
  updateRoyaleGear();
  // S&D keeps the wave/hostiles boxes — repurposed as round count and bomb
  // status — where every other PvP mode hides them.
  els.hudWaveBox.hidden = (pvp && !snd) || isRange();
  els.hudHostilesBox.hidden = (pvp && !snd) || isRange();
  els.bombStatus.hidden = !snd;
  if (els.touchInteract) els.touchInteract.hidden = !snd;
  // The Test Range info box is retired (user, 2026-09-28): N still spawns a
  // bot, and Esc has Spawn a bot / Clear bots and the full settings.
  els.rangeHud.hidden = true;
  updateRangeHud();
  document.getElementById("hud-l-wave").textContent = isZombies() || snd ? "Round" : "Wave";
  document.getElementById("hud-l-hostiles").textContent = isZombies() ? "Zombies" : (snd ? "Bomb" : "Hostiles");
  document.getElementById("hud-l-kills").textContent = isZombies() ? "Points" : "Kills";
  // Only Zombies keeps this box (Points); the kill count is gone (user, 2026-09-28).
  document.getElementById("hud-score-box").style.display = isZombies() ? "" : "none";
  els.respawn.hidden = true;
  els.scoreboard.hidden = true;

  els.title.hidden = true;
  els.gameover.hidden = true;
  els.pause.hidden = true;
  els.hud.hidden = isView();   // View mode: just the map on screen
  setTouchControls(true);
  gameState = "playing";

  // The range is a sandbox, not a match — there is nothing to count down to.
  if (isView()) {
    showWaveBanner("View mode: fly with WASD, Space up, C down, Shift fast", 3200);
  } else if (isRange()) {
    showWaveBanner("Test range — nothing here shoots back", 2600);
  } else {
    // Bots are filled here rather than on the first live frame, so the room is
    // already populated while the player watches the clock.
    if (isPvp() && net.isBotHost()) {
      const { humans, teams } = humanHeadcount();
      bots.fill(noBotsRoom() ? 0 : botTarget(), humans, botSpawn, !!currentMode().ffa, teams);
      net.botCount = bots.bots.length;
      for (const b of bots.bots) net.publishBot(b);
    }
    // Troll Royale: the bots wait in the sky lobby too.
    if (royale?.drop) placeBotsInLobby();
    // S&D's round 1 is set up like every later round, under this countdown.
    if (isSnd()) prepareSndRound();
    // Wave 1 / Round 1 don't spawn until the countdown clears — starting the
    // spawner immediately would have grunts standing idle mid-countdown and
    // "WAVE 1" competing on screen with "GET READY".
    beginStaging(royale?.drop ? DROP.lobbySeconds : undefined);
    applyRoyaleCatchUp();
  }

  // Browsers refuse a pointer lock requested too soon after an unlock without
  // a fresh gesture, which the auto-advance out of an intermission doesn't
  // have. If it's refused we land on the pause screen instead of in a live
  // match with dead mouse-look, and clicking resume picks it back up.
  if (!isTouch) {
    try { controls.lock(); } catch { /* refused — the pause screen catches it */ }
    setTimeout(() => {
      if (gameState === "playing" && !controls.isLocked) openPauseMenu();
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

/* The Max Ammo drop: every gun's reserve full again, plus your grenades.
   The mag you're holding stays as it is, the way the genre does it. */
function zombieMaxAmmo() {
  for (const w of Object.values(player.weapons)) w.ammoReserve = w.def.reserveMax - w.def.magSize;
  player.gear.lethal = loadout.carried("lethal");
  player.gear.tactical = loadout.carried("tactical");
  showWaveBanner("MAX AMMO", 1600);
  audio.wave();
}

function onZombieAttack(zombie, dmg) {
  damagePlayer(dmg, null, null, false, zombie.mesh?.position);
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

/* Round timing. There used to be no clock at all, and bots respawned on
   their normal 5s timer, so with bots in the room the attackers could never
   be wiped and a bomb nobody planted meant a round that never ended. */
const SND_ROUND_TIME = 120;   // seconds to get a plant down, or the defenders win
const SND_GRACE = 1.5;        // after go-live, before elimination is judged
const SND_BOT_SITE_R = SND_SITE_RADIUS - 1.2;   // how far onto a site a bot walks before acting

let sndLive = false;          // countdown cleared, round in play
let sndClock = 0;             // seconds left to plant
let sndLiveT = 0;             // seconds since go-live
let sndTimeupWait = 0;        // non-host: how long we've sat at 0 waiting for the host's call
const sndSeen = { attackers: 0, defenders: 0 };   // most alive at once this round
let sndBotAction = null;      // { botId, kind, progress, site } — a bot we host at a site
let sndBotPub = 0;
let sndBotSite = "A";         // where our attacking bots push this round
let remoteBombAct = null;     // { kind, site, until } — someone else mid-plant/defuse

/* Between rounds, under the countdown: everyone respawns on their side and
   the bomb resets, so the room is visibly assembled before it goes live —
   the previous flow respawned players only after the countdown, which left
   the dead spectating a frozen clock. Every client runs this itself. */
function prepareSndRound() {
  sndRound++;
  sndRoundOver = false;
  sndEliminated = false;
  sndLive = false;
  sndClock = SND_ROUND_TIME;
  sndLiveT = 0;
  sndTimeupWait = 0;
  sndSeen.attackers = sndSeen.defenders = 0;
  sndBotAction = null;
  remoteBombAct = null;
  sndBotSite = Math.random() < 0.5 ? "A" : "B";
  // One life a round means a round boundary is the only other place a life
  // ends, so it has to reset the meter the way a death does. Earned streaks
  // still carry, same as across a death.
  streaks.onRoundEnd();
  uavUntil.phantom = 0;
  uavUntil.ghost = 0;
  vsatUntil.phantom = 0;
  vsatUntil.ghost = 0;
  jammedUntil = 0;
  myUavUntil = 0;
  // A gunship or a crate has no round to belong to once this one ends.
  clearStreakEntities();
  updateStreakHud();
  grenades.clear();
  bullets.clear();
  pickups.clear();
  bomb.reset();
  els.bombPrompt.hidden = true;
  els.bombTimer.hidden = true;
  els.hudWave.textContent = String(sndRound);
  els.bombSide.textContent = net.team === sndAttackTeam ? "Plant the bomb" : "Defend the sites";
  els.bombSide.style.color = TEAMS[net.team]?.ui || "";
  showWaveBanner(`ROUND ${sndRound} — ${net.team === sndAttackTeam ? "ATTACKING" : "DEFENDING"}`, 2600);
  audio.wave();

  clearDeathVisuals();
  player.hp = player.maxHp;
  player.alive = true;
  els.respawn.hidden = true;
  const sp = teamSpawn({ sideOnly: true });
  move.reset(sp.x, sp.z, sp.y || 0);
  look.yaw = yawTowardCentre(sp);
  look.pitch = 0;
  setActiveWeaponMesh(equipFromLoadout());

  if (isPvp() && net.isBotHost()) {
    bots.reviveAll((team, id) => botSpawn(team, id, { sideOnly: true }));
    for (const b of bots.bots) net.publishBot(b);
  }
}

/* The countdown cleared. The carrier is picked now rather than in
   prepareSndRound: a peer who died last round still reads as dead until
   their next state packet, and choosing among "living" attackers before
   then could skip them. Humans get it ahead of bots when there's a choice. */
function sndGoLive() {
  sndLive = true;
  sndLiveT = 0;
  player.spawnGuard = SPAWN_GUARD;
  updateSpawnGuardHud();
  if (net.isBotHost() || !net.active) {
    bomb.carrierId = pickCarrier();
    if (net.active) net.publishBomb({ kind: "event", action: "reset", round: sndRound, attackTeam: sndAttackTeam, carrierId: bomb.carrierId });
  }
}

function pickCarrier() {
  const ids = livingAttackerIds().sort();
  return ids.find((id) => !isSyntheticId(id)) || ids[0] || null;
}

/* Where a bot we host should be heading in the current mode, or null to
   just hunt. KotH: the hill. S&D: attackers push one site (the carrier
   onto it), defenders split across both, and once it's planted everyone
   converges — defenders right onto the bomb. */
function botObjective(bot) {
  // Troll Royale: the zone first, then loot, then the sound of a fight.
  if (royale) return royaleBotObjective(bot);
  // Its own care package, once it's down: go and get it.
  if (bot.crate) {
    const pkg = streakEntities.get(bot.crate.eid);
    if (pkg instanceof CarePackage && !pkg.claimed) return { id: `pkg-${pkg.id}`, x: pkg.x, z: pkg.z, radius: 0.6 };
  }
  if (hill) {
    const p = hill.position;
    return { id: `hill-${hill.index}`, x: p.x, z: p.z, radius: hill.radius * 0.6 };
  }
  if (!isSnd() || !bomb || !sndLive || sndRoundOver) return null;
  const attacking = bot.team === sndAttackTeam;
  if (bomb.state === "planted") {
    const s = bomb.siteAt(bomb.site);
    return { id: `site-${s.id}`, x: s.x, z: s.z, radius: attacking ? 7 : 1 };
  }
  if (attacking) {
    const s = bomb.siteAt(sndBotSite);
    return { id: `site-${s.id}`, x: s.x, z: s.z, radius: bomb.carrierId === bot.id ? 1 : 8 };
  }
  // Defenders pick a site by id so the split is stable across the round.
  let h = 0;
  for (let i = 0; i < bot.id.length; i++) h = (h * 31 + bot.id.charCodeAt(i)) >>> 0;
  const s = bombSites[h % bombSites.length];
  return { id: `site-${s.id}`, x: s.x, z: s.z, radius: 6 };
}

function botBusy(bot) {
  // Flying its Dragonfire: stands still where it called it, like a player.
  if (bot.piloting) {
    if (streakEntities.get(bot.piloting)?.alive) return true;
    bot.piloting = null;
  }
  // On a Warship's guns: the same, until the ship leaves.
  if (bot.gunning) {
    const ws = streakEntities.get(bot.gunning);
    if (ws instanceof VtolWarship && ws.age < ws.duration) return true;
    bot.gunning = null;
  }
  return !!sndBotAction && sndBotAction.botId === bot.id;
}

/* Bot plants and defuses, run by the bot host only. Same timings as a
   player's hold-E, and broadcast through the same bomb messages, so every
   other client sees a bot plant exactly as it would a person's. */
function updateSndBots(dt) {
  let actor = null, kind = null, site = null;
  if (bomb.state === "carried") {
    const b = bots.byId(bomb.carrierId);
    const s = bomb.siteAt(sndBotSite);
    if (b?.alive && !(b.stunT > 0) && Math.hypot(b.pos.x - s.x, b.pos.z - s.z) <= SND_BOT_SITE_R) {
      actor = b; kind = "plant"; site = s;
    }
  } else if (bomb.state === "planted") {
    const s = bomb.siteAt(bomb.site);
    const current = sndBotAction?.kind === "defuse" ? bots.byId(sndBotAction.botId) : null;
    const candidates = current ? [current, ...bots.bots] : bots.bots;
    for (const b of candidates) {
      if (!b?.alive || b.team === sndAttackTeam || b.stunT > 0) continue;
      if (Math.hypot(b.pos.x - s.x, b.pos.z - s.z) > SND_BOT_SITE_R) continue;
      actor = b; kind = "defuse"; site = s;
      break;
    }
  }

  if (!actor) {
    if (sndBotAction) {
      sndBotAction = null;
      if (net.active) net.publishBomb({ kind: "event", action: "cancel", by: "bot" });
    }
    return;
  }

  if (!sndBotAction || sndBotAction.botId !== actor.id || sndBotAction.kind !== kind) {
    sndBotAction = { botId: actor.id, kind, progress: 0, site: site.id };
  }
  sndBotAction.progress += dt;
  sndBotPub -= dt;
  if (net.active && sndBotPub <= 0) {
    sndBotPub = 0.2;
    net.publishBomb({ kind: "action", action: kind, by: actor.id, progress: sndBotAction.progress, site: site.id });
  }
  noteRemoteBombAct(kind, site.id);

  if (kind === "plant" && sndBotAction.progress >= PLANT_TIME) {
    sndBotAction = null;
    bomb.plant(site.id);
    audio.wave();
    showWaveBanner(`Bomb planted — site ${site.id}`, 1800);
    if (net.active) net.publishBomb({ kind: "event", action: "planted", site: site.id });
  } else if (kind === "defuse" && sndBotAction.progress >= DEFUSE_TIME) {
    sndBotAction = null;
    bomb.defuse();
    if (net.active) net.publishBomb({ kind: "event", action: "defused" });
    sndRoundWin(sndDefendTeam(), "bomb defused");
  }
}

/* Somebody else is on the bomb — shown in the status line rather than the
   hold-E bar, which is ours. Expires on its own if the messages stop. */
function noteRemoteBombAct(kind, site) {
  remoteBombAct = { kind, site, until: performance.now() + 500 };
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
  if (sndRound === currentMode().roundsToWin - 1) {
    sndAttackTeam = sndDefendTeam();
    setTimeout(() => { if (gameState === "playing" && isSnd()) showWaveBanner("HALFTIME — SIDES SWAP", 1300); }, 300);
  }

  setTimeout(() => {
    if (gameState !== "playing" || !isSnd()) return;
    prepareSndRound();
    beginStaging(3);
  }, 2600);
}

function finishRun(title, headline, headlineLabel, secondLabel, thirdLabel, opts = {}) {
  gameState = "gameover";
  player.alive = false;
  cancelCook();
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
  const base = isPvp()
    ? player.matchXp + xpForMatch({ won: !!opts.won, completed: !!opts.completed })
    : xpForRun({ kills: player.kills, wave: player.wave });
  const gained = boostedXp(base);
  const { rankedUp, rank } = addXp(gained);
  els.goXp.textContent = `+${gained.toLocaleString()} XP${gained > base ? " · +10% veteran bots" : ""}`;
  els.goRank.textContent = rankedUp ? `Level up — now LV ${rank}` : "";
  els.goRank.hidden = !rankedUp;
  renderMatchMedals();
  loadout.render();

  // addXp above already queued this XP for the account (troll_ops_xp).
  // Filing the run is separate: it feeds the leaderboard and the flat
  // game_run/high_score awards, and it no-ops for guests.
  window.TrollrunnerAccounts?.reportGameResult?.("troll-ops", player.wave * 10000 + player.kills * 10, {
    mode: modeId,
    kills: player.kills,
    deaths: player.deaths,
    wave: player.wave,
    map: loadedMapId || loadout.mapId,
  });
}

/* BO2's after-action medal list: every medal this match with its count,
   most-earned first. Hidden when nothing was earned. */
function renderMatchMedals() {
  const box = els.goMedals;
  if (!box) return;
  const list = killstreakUi.medals();
  box.hidden = !list.length;
  const ul = box.querySelector("ul");
  ul.replaceChildren();
  for (const m of list) {
    const li = document.createElement("li");
    li.className = "to-go-medal";
    const icon = document.createElement("span");
    icon.className = "to-go-medal-icon";
    icon.innerHTML = medalSvg(m.label);
    const name = document.createElement("span");
    name.className = "to-go-medal-name";
    name.textContent = m.label;
    const n = document.createElement("b");
    n.textContent = `×${m.n}`;
    li.append(icon, name, n);
    li.setAttribute("aria-label", `${m.label}, ${m.n} time${m.n === 1 ? "" : "s"}`);
    ul.appendChild(li);
  }
  const bonus = killstreakUi.bonus();
  const foot = box.querySelector(".to-go-medal-bonus");
  if (foot) {
    foot.hidden = !bonus;
    foot.textContent = `Medal bonus +${bonus.toLocaleString()}`;
  }
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
  const headline = royale?.finalPlace ? ordinal(royale.finalPlace)
    : mode.ffa ? String(player.kills) : String(teamScores[net.team] ?? 0);
  const won = mode.ffa
    ? title.startsWith("You")
    : title === `${teamName(net.team)} win`;
  // Before finishRun: Comeback/Flawless/Combat Medic belong in its medal list.
  achievements.onMatchEnd({
    won, deaths: player.deaths, assists: player.assists, kills: player.kills,
  });
  finishRun(title, headline, royale ? "Your place" : mode.ffa ? "Your score" : "Your side", "Your kills", "Match length", { won, completed: true });

  window.TrollLeaderboard?.report?.("troll-ops", {
    pvp: true, kills: player.kills, deaths: player.deaths, won,
    assists: player.assists, headshots: player.headshots, streak: player.bestStreak,
  });

  bots.clear();
  clearStreakEntities();
  setHillMarker(null);
  setBombSiteMarkers(null);
  els.bombPrompt.hidden = true;
  if (els.pickupPrompt) els.pickupPrompt.hidden = true;
  pickups.clear();
  bomb = null;
  teardownRoyale();
  updateRoyaleGear();
  if (els.royale) els.royale.hidden = true;

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
    // A real shot of the map (tools/troll-ops-map-previews.mjs renders them).
    btn.innerHTML =
      `<img class="to-vote-img" src="assets/games/troll-ops/ui/maps/${id}.jpg?v=mp1" alt="" loading="eager" draggable="false">` +
      `<span class="to-vote-row"><span class="to-vote-name">${MAPS[id]?.name || id}</span>` +
      `<span class="to-vote-n">${n ? `${n} vote${n === 1 ? "" : "s"}` : ""}</span></span>`;
    btn.querySelector("img").addEventListener("error", (e) => e.target.remove());
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
// Touch has no pointer lock to re-take, so Resume just closes the menu —
// it used to do nothing there, stranding the player in the pause menu.
els.resumeBtn.addEventListener("click", resumePlay);
els.rangeSpawnBot?.addEventListener("click", spawnRangeBot);
els.pauseSpawnBot?.addEventListener("click", spawnRangeBot);
els.pauseClearBots?.addEventListener("click", clearRangeBots);
els.quitBtn.addEventListener("click", () => {
  // Quitting mid-match used to just discard player.matchXp — every kill's
  // banked XP for the session, gone, with no result screen to explain why.
  // finishRun settles it normally on a real match end; here there's no
  // result screen to show, so just fold the banked amount into the total.
  if (isPvp() && gameState === "playing" && player.matchXp > 0) {
    addXp(boostedXp(player.matchXp));
    player.matchXp = 0;
  }
  gameState = "menu";
  if (modeId === "view") modeId = viewPrevMode || "ops";
  localPauseOnly = false;
  endStaging();
  cancelIntermission();
  setBombSiteMarkers(null);
  if (els.bombPrompt) els.bombPrompt.hidden = true;
  if (els.pickupPrompt) els.pickupPrompt.hidden = true;
  pickups.clear();
  bomb = null;
  net.stop();
  chat.clear();
  remotes.clear();
  setNetStatus("Share the code with whoever you want in the match.");
  els.pause.hidden = true;
  els.hud.hidden = true;
  setTouchAds(false);
  setTouchControls(false);
  els.title.hidden = false;
  loadout.render();
  renderLobbyRoster();
  roomSkillSeen = null;
  renderBotSkillNote();
  showLobbyPanel("deploy");
});

controls.addEventListener("lock", () => { closePauseMenu(); chat.setInteractive(false); });
controls.addEventListener("unlock", () => {
  chat.setInteractive(true);
  cancelCook();
  if (gameState === "playing") openPauseMenu();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) cancelCook();
  if (document.hidden && gameState === "playing") openPauseMenu();
  // Backgrounding the tab is also the last reliable moment to flush banked
  // match XP — a closed tab never runs another frame, so this can't wait
  // for the "playing" branch above's later logic or a normal match end.
  if (document.hidden && isPvp() && player.matchXp > 0) {
    addXp(boostedXp(player.matchXp));
    player.matchXp = 0;
  }
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

/* Scorestreaks report kills with their own ids rather than a weapon's, so
   the killfeed and death card can say what actually got you. */
const STREAK_KILL_NAMES = {
  drone: "Hunter-Killer",
  heli: "Gunship",
  airstrike: "Lightning Strike",
  carepackage: "Care Package",
  k9: "K9 Unit",
  warship: "VTOL Warship",
  swarm: "Swarm",
  dragonfire: "Dragonfire",
  bomb: "Bomb",
  zone: "the Cringe",
};

function weaponNameFor(id) {
  return WEAPON_DEFS[id]?.name || MELEE_DEFS[id]?.name || THROWABLE_DEFS[id]?.name || STREAK_KILL_NAMES[id] || null;
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

/* Where the killer was standing, for the kill cam to orbit toward. Same
   bots-first order as killerHpFor, but falls through to remotes.byId rather
   than net.peers directly since RemotePlayer.pos is the interpolated render
   position — the one that actually matches what was on screen. Null for a
   scorestreak kill (drone/heli/airstrike) or a killer that's already gone. */
function killerPosFor(id) {
  if (!id) return null;
  const b = bots.byId(id);
  if (b) return new THREE.Vector3(b.pos.x, b.pos.y + 1.5, b.pos.z);
  const rp = remotes.byId.get(id);
  if (rp) return new THREE.Vector3(rp.pos.x, rp.pos.y + 1.5, rp.pos.z);
  return null;
}

/* `fromPos` places the hit-direction marker when there's no peer or bot to
   look up by id — a zombie, a grunt, the bomb. */
function damagePlayer(amount, fromId, weaponId, isHead = false, fromPos = null) {
  if (!player.alive) return;
  // Nothing lands before the match is live, whoever reports it.
  if (isStaging()) return;
  // A raised Trollsaber eats rounds from the front.
  if (tryDeflect(amount, fromId, weaponId, fromPos)) return;
  // Your own grenade can still sting on the range; it can't end the session.
  if (isRange()) {
    player.hp = Math.max(1, player.hp - amount);
    flashHit();
    audio.hurt();
    return;
  }
  // Freshly respawned and haven't fired yet — the round passes through.
  if (player.spawnGuard > 0 && isPvp()) return;
  // Troll Royale: Cope Plates soak everything but the Cringe itself.
  if (royale && player.armor > 0 && weaponId !== "zone") {
    const soak = Math.min(player.armor, amount);
    player.armor -= soak;
    amount -= soak;
    updateRoyaleGear();
    if (player.armor <= 0) audio.saberBreak();
    if (amount <= 0) {
      noteDamage(fromId, soak, weaponId, isHead);
      noteHitDirection(fromId, fromPos);
      flinchPeer(net.id, fromId, isHead, fromPos);
      flashHit();
      return;
    }
  }

  player.hp = Math.max(0, player.hp - amount);
  player.lastHurtAt = performance.now();
  noteDamage(fromId, amount, weaponId, isHead);
  noteHitDirection(fromId, fromPos);
  flinchPeer(net.id, fromId, isHead, fromPos);
  flashHit();
  audio.hurt();
  if (player.hp > 0) return;
  audio.died();

  if (isPvp()) {
    // In PvP dying is a respawn, not the end of the run.
    player.alive = false;
    cancelCook();
    player.deaths++;
    // Report the streak we were on before clearing it — it's what lets our
    // killer know they ended a run (Shutdown).
    const endedStreak = player.streak;
    player.streak = 0;
    // Dying takes the meter but not a streak already earned — BO2's rule,
    // and the reason this isn't streaks.reset().
    streaks.onDeath();
    updateStreakHud();
    // Who to look for, for Revenge.
    player.lastKilledBy = fromId || null;
    // S&D has no respawn timer — updateSnd() owns the "eliminated" HUD text
    // once this sets player.alive false; every other PvP mode counts this
    // down and calls respawnPlayer() itself.
    if (!isSnd() && !isRoyale()) respawnT = 4;
    if (royale) royaleOnDeath();
    // Remember where we fell, so the picker stops handing out this corner.
    notePointDeath(move.pos.x, move.pos.z);
    dropCarriedWeapon();
    net.reportDeath(fromId, weaponId, isHead, endedStreak);
    registerDeath("You", fromId, weaponId, {
      head: isHead, victimIsMe: true, victimTeam: net.team,
    });
    // Infection: a survivor who goes down gets up on the other side.
    if (isInfection() && infectionStarted) {
      if (net.team === "phantom") {
        net.setTeam("ghost");
        showWaveBanner("INFECTED — go get them", 1800);
      }
      respawnT = INFECTION.respawn;
    }
    showDeathCard(fromId, weaponId, isHead);
    noteLocalDeath();
    els.deathfade.classList.add("is-dead");
    damageLog.clear();
    els.respawn.hidden = false;
    // BO2 killcam: the last few seconds again, from the killer's eyes. The
    // respawn waits for it (skippable back down to the usual timer).
    killcamBaseRespawn = respawnT;
    killcam.start({ deathPos: player.pos, killerId: fromId, killerPos: killerPosFor(fromId), now: kcClock, selfId: killcamSelfId() });
    if (killcam.replaying && !isSnd()) respawnT = Math.max(respawnT, killcam.duration + 0.35);
    els.killcamBars.classList.add("is-on");
    startKillcamPresentation(fromId, weaponId, isHead);
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


/* Everything death puts on screen, taken back off. Shared by a respawn, a
   new S&D round and a new match — the last two used to skip it, so dying in
   S&D left the 62% death fade over every round after. */

/* ---------------- killcam (killcam.js) ----------------
   Recording runs every PvP frame while nothing is replaying: every remote
   actor's rendered pose, and ours. On death, the replay drives the camera
   (killcam.update in updatePlayer) and this poses the world to match. */
const killcamSelfId = () => net.id || "self";
const _kcSample = {};
const _kcShots = [];
let kcLocalPhase = 0;
let killcamGun = null;       // the killer's gun as the viewmodel during a replay
let killcamKick = 0;
let killcamHud = null;
let killcamWasActive = false;
let killcamBaseRespawn = 4;

function updateKillcam(dt) {
  kcClock += dt;
  if (killcamWasActive && !killcam.active) endKillcamPresentation();
  killcamWasActive = killcam.active;
  if (!killcam.replaying) {
    for (const rp of remotes.byId.values()) {
      if (rp.alive && !rp.rig.root.visible) continue;   // no snapshots yet
      const snaps = rp.peer.snaps;
      killcam.record(kcClock, rp.netId, {
        x: rp.pos.x, y: rp.pos.y, z: rp.pos.z, yaw: rp.yaw, pitch: rp.pitch, lower: rp.lower,
        alive: rp.alive, wid: rp.weaponId, moving: !!snaps?.[snaps.length - 1]?.moving, bot: !!rp.peer.isBot,
        ...rp.meleeSample(),
      });
    }
    if (player.alive) {
      const pm = player.melee;
      const sword = !!pm && (player.holding === "melee" || pm.busy);
      killcam.record(kcClock, killcamSelfId(), {
        x: move.pos.x, y: move.pos.y, z: move.pos.z, yaw: look.yaw, pitch: look.pitch,
        lower: localLower, alive: true, wid: currentWeapon()?.def?.id, moving: move.moving,
        mid: sword ? pm.def.id : null, sw: sword && pm.busy ? Math.min(1, pm.t / pm.total) : -1,
        si: pm ? pm.swingIndex & 1 : 0, bk: sword ? localBlockT : 0,
      });
    }
    return;
  }
  poseKillcamWorld(dt);
}

/* The world at replay time: everyone where they were, the killer hidden
   (we're in their eyes), us walking into it and dropping, their shots
   re-fired. */
function poseKillcamWorld(dt) {
  const rt = killcam.rt;
  for (const rp of remotes.byId.values()) {
    const s = killcam.sampleAt(rp.netId, rt, _kcSample);
    rp.replayPose(s, dt, rp.netId === killcam.killerId);
  }
  const me = killcam.sampleAt(killcamSelfId(), Math.min(rt, killcam.deathT), _kcSample);
  if (me) {
    localRig.root.visible = true;
    localRig.parts.head.visible = true;
    localRig.root.position.set(me.x, me.y, me.z);
    if (rt >= killcam.deathT) {
      if (localHeld.mesh) localHeld.mesh.visible = false;   // goes down empty-handed
      poseDeath(localRig, Math.min(1, (rt - killcam.deathT) / DEATH_TIME));
    } else {
      aimRig(localRig, me.yaw, dt, { moving: me.moving });
      if (me.moving) kcLocalPhase += dt * gaitPhaseRate(3.6);
      // Our own swings and guard play back too (the held melee mesh is
      // already on the rig: syncLocalRigHeld).
      const sword = !!me.mid && MELEE_DEFS[me.mid];
      syncLocalRigHeld(sword ? "melee" : "gun", sword ? MELEE_DEFS[me.mid] : WEAPON_DEFS[me.wid] || currentWeapon()?.def);
      if (localHeld.mesh) localHeld.mesh.visible = true;
      const sab = sword && localHeld.mesh?.userData.saber;
      if (sab) { sab.target = 1; sab.frac = Math.max(sab.frac, 0.999); }
      poseHumanoid(localRig, {
        phase: kcLocalPhase, moving: me.moving, pitch: me.pitch, lower: me.lower, strafe: 0, forward: 1,
        speed: me.moving ? 0.85 : 0, mps: me.moving ? 3.6 : 0, dt, hasGun: !sword, hold: sword ? "melee" : "gun",
        swing: sword && me.sw >= 0 ? { t: me.sw, kind: me.si % 2 === 0 ? "swing" : "thrust" } : null,
        block: sword && me.sw < 0 ? me.bk : 0,
      });
    }
  }
  for (const s of killcam.shotsSince(_kcShots)) {
    remoteShotFx(new THREE.Vector3(s.ox, s.oy, s.oz), new THREE.Vector3(s.dx, s.dy, s.dz), s.wid, s.quiet);
    if (s.id === killcam.killerId) killcamKick = 1;
  }
  updateKillcamGun(dt);
  if (killcamHud) killcamHud.classList.toggle("is-kill", killcam.atKill);
}

/* The killer's gun at the hip, bobbing with their walk and kicking on each
   of their shots. Built from their weapon id; hands stay hidden like ours. */
function buildKillcamGun(wid) {
  disposeKillcamGun();
  const def = WEAPON_DEFS[wid];
  if (!def) return;
  killcamGun = stripLights(buildWeaponMesh(def));
  killcamGun.traverse((o) => { if (o.userData.hand) o.visible = false; });
  weaponScene.add(killcamGun);
}

function disposeKillcamGun() {
  if (!killcamGun) return;
  weaponScene.remove(killcamGun);
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
  weaponScene.remove(killcamMelee.mesh);
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
    const mesh = stripLights(buildMeleeMesh(def, false));
    const sab = mesh.userData.saber;
    if (sab) { sab.target = 1; sab.frac = 1; }
    weaponScene.add(mesh);
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
  if (view?.rot) mesh.quaternion.multiply(_meleeViewQ.setFromEuler(_meleeViewE.set(view.rot[0], view.rot[1], view.rot[2])));
  mesh.scale.setScalar(view?.scale || 1);
  if (mesh.userData.saber && s.sw < 0 && s.bk > 0.001) {
    mesh.position.lerp(SABER_BLOCK.pos, s.bk);
    mesh.quaternion.slerp(SABER_BLOCK.quat, s.bk);
  }
  return true;
}

function updateKillcamGun(dt) {
  const sm = killcam.sampleAt(killcam.killerId, killcam.rt, _kcSample);
  const melee = updateKillcamMelee(sm);
  if (!killcamGun) return;
  killcamGun.visible = !melee;
  killcamKick = Math.max(0, killcamKick - dt * 10);
  const s = sm;
  const walk = s?.moving ? killcam.rt * 9 : 0;
  const k = killcamKick;
  killcamGun.position.set(
    0.22 + Math.sin(walk) * 0.006,
    -0.2 - Math.abs(Math.cos(walk)) * 0.006 - (s?.lower || 0) * 0.02,
    -0.55 + k * 0.045,
  );
  killcamGun.rotation.set(k * 0.07, 0, Math.sin(walk) * 0.01);
}

/* Title, killer plate and the skip hint. BO2's layout: KILLCAM across the
   top, who and with what bottom-left, skip bottom-right. */
function startKillcamPresentation(killerId, weaponId, isHead) {
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
    els.killcamBars.parentElement.appendChild(killcamHud);
  }
  const name = killerId ? nameFor(killerId) : null;
  const team = killerId && (net.peers.get(killerId)?.team || bots.byId(killerId)?.team);
  const nameEl = killcamHud.querySelector(".to-kc-name");
  nameEl.textContent = name && name !== "You" ? name : "Unknown";
  nameEl.style.color = team && TEAMS[team] ? TEAMS[team].ui : "";
  const bits = [weaponNameFor(weaponId)].filter(Boolean);
  if (isHead) bits.push("Headshot");
  killcamHud.querySelector(".to-kc-weapon").textContent = bits.join(" · ");
  killcamHud.querySelector(".to-kc-skip").textContent = "Skip";
  killcamHud.classList.remove("is-kill");
  killcamHud.hidden = false;
  if (killcam.replaying) {
    // Which way we go down: shot from the front knocks us onto our back,
    // from behind pitches us forward onto our face.
    const k = killcam.sampleAt(killcam.killerId, killcam.deathT, {});
    if (k) {
      let d = Math.atan2(-(k.x - move.pos.x), -(k.z - move.pos.z)) - look.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      localRig.deathHint = { dir: Math.abs(d) < Math.PI / 2 ? 1 : -1 };
    }
    localRig.death = null;
    buildKillcamGun(weaponId && WEAPON_DEFS[weaponId] ? weaponId : killcam.killerWeapon);
    weaponRig.visible = false;
  }
  // The replay is the death screen now: no 62% fade or centre countdown
  // over it, and none of the live HUD.
  els.killcamBars.parentElement.classList.add("to-kc-on");
  els.deathfade.classList.remove("is-dead");
  els.respawn.style.visibility = "hidden";
}

function endKillcamPresentation() {
  if (killcamHud) killcamHud.hidden = true;
  els.killcamBars.parentElement.classList.remove("to-kc-on");
  disposeKillcamGun();
  disposeKillcamMelee();
  weaponRig.visible = player.alive;
  els.respawn.style.visibility = "";
  els.killcamBars.classList.remove("is-on");
  if (!player.alive) els.deathfade.classList.add("is-dead");
}

/* Space / A / a tap: straight back to the ordinary respawn timer (BO2's
   skip) — never faster than dying without a killcam would have been. */
function skipKillcam() {
  if (!killcam.active || player.alive) return;
  const elapsed = killcam.t;
  killcam.cancel();
  endKillcamPresentation();
  if (!isSnd()) respawnT = Math.min(respawnT, Math.max(0.25, killcamBaseRespawn - elapsed));
}

function clearDeathVisuals() {
  killcam.cancel();
  endKillcamPresentation();
  killcamWasActive = false;
  els.killcamBars.classList.remove("is-on");
  els.deathfade.classList.remove("is-dead");
  if (els.deathBy) els.deathBy.hidden = true;
  hideSpectateHud();
  // Every caller is about to put us back up (respawn, new round, new match).
  weaponRig.visible = true;
  localRig.death = null;
}

function respawnPlayer() {
  clearDeathVisuals();
  clearHitDirs();
  const sp = teamSpawn();
  move.reset(sp.x, sp.z, sp.y || 0);
  look.yaw = yawTowardCentre(sp);
  look.pitch = 0;
  player.hp = player.maxHp;
  player.alive = true;
  player.spawnGuard = SPAWN_GUARD;
  setActiveWeaponMesh(equipFromLoadout());
  applyInfectionLoadout();
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
    if (dist < 14) damagePlayer(dmg * 0.8, null, null, false, grunt.mesh.position);
  } else {
    damagePlayer(dmg, null, null, false, grunt.mesh.position);
  }
}

// -------------------- main loop --------------------

const clock = new THREE.Clock();

function resize() {
  const w = els.cabinet.clientWidth, h = els.cabinet.clientHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  ssao.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  weaponCamera.aspect = w / h;
  weaponCamera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);

/* Graphics tiers. SSAO is the big one: it re-renders the whole scene with a
   normal material every frame, then samples and blurs it, which roughly
   doubles the cost of a frame on a laptop iGPU. Every tier keeps the same
   shadow TYPE and light count on purpose: changing either recompiles every
   lit shader (the 2 s freezes light-pool.js exists to stop), whereas
   toggling a pass or resizing the shadow map is free to do mid-match.
   Purely local: nothing here is sent over the wire. */
const GFX_TIERS = ["high", "medium", "low"];
const GFX = {
  high:   { ssao: true,  bloom: true,  shadowSize: 2048 },
  medium: { ssao: false, bloom: true,  shadowSize: 2048 },
  low:    { ssao: false, bloom: false, shadowSize: 1024 },
};
const GFX_AUTO_KEY = "trollops:gfx-auto";
// Auto starts wherever it settled last time on this device, so a laptop that
// always ends up on Low doesn't spend the first minute of every match lagging.
let gfxAutoTier = (() => {
  try { const t = localStorage.getItem(GFX_AUTO_KEY); return GFX[t] ? t : "high"; } catch { return "high"; }
})();
let gfxCeiling = 0;       // best tier index Auto may climb back to this session
let gfxApplied = null;

function gfxTier() {
  return settings.gfx === "auto" || !GFX[settings.gfx] ? gfxAutoTier : settings.gfx;
}

/* Map clutter (instanced tufts, bushes, flowers: userData.clutter = full
   count) drawn in proportion to the graphics tier, so phones get a lighter
   map (map detail pass). Instances are placed in random order, so any
   leading share is spread evenly. */
const CLUTTER_SHARE = { low: 0.15, medium: 0.35, high: 0.55 };
function applyClutter() {
  const tier = gfxTier();
  const share = CLUTTER_SHARE[tier] ?? 1;
  // A mesh can carry its own shares (map-dressing.js: the PvP maps' clutter
  // is sparse to begin with, so it thins less than the island's).
  builtMap?.root?.traverse((o) => { if (o.userData.clutter) o.count = Math.max(1, Math.round(o.userData.clutter * (o.userData.clutterShare?.[tier] ?? share))); });
}

function applyGraphics() {
  const tier = gfxTier();
  applyClutter();
  const out = settings.gfx === "auto" ? tier.toUpperCase() : "";
  for (const id of ["to-set-gfx-out", "to-set-gfx-lobby-out"]) {
    const el = document.getElementById(id);
    if (el) el.textContent = out;
  }
  if (tier === gfxApplied) return;
  gfxApplied = tier;
  const cfg = GFX[tier];
  skyMat.uniforms.uCloudQ.value = tier === "low" ? 0 : tier === "medium" ? 1 : 2;
  ssao.enabled = cfg.ssao;
  bloom.enabled = cfg.bloom;
  if (sun.shadow.mapSize.x !== cfg.shadowSize) {
    sun.shadow.mapSize.set(cfg.shadowSize, cfg.shadowSize);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;   // three rebuilds it at the new size next frame
  }
}

function setAutoTier(tier) {
  gfxAutoTier = tier;
  try { localStorage.setItem(GFX_AUTO_KEY, tier); } catch { /* private mode */ }
  applyGraphics();
}

/* Dynamic quality. Judged over 2-second windows: under 40 fps steps down,
   over 57 steps up. On Auto it sheds effects BEFORE resolution, so a slow
   device loses SSAO rather than going blurry, and a fast one never leaves
   High. Climbing back up is deliberately slower (3 good windows in a row),
   and a tier that drops straight back under 40 isn't retried this session,
   so it can't flicker between two tiers. The HUD is DOM and stays sharp. */
const MAX_PIXEL_RATIO = Math.min(2, window.devicePixelRatio || 1);
const MIN_PIXEL_RATIO = isTouch ? 0.6 : 0.75;
let pixelRatio = renderer.getPixelRatio();
const perfWin = { t: 0, n: 0, cool: 0, good: 0, raised: false };

function setPixelRatioStep(next) {
  if (Math.abs(next - pixelRatio) < 1e-3) return false;
  pixelRatio = next;
  renderer.setPixelRatio(next);
  composer.setPixelRatio?.(next);
  resize();
  return true;
}

function adaptResolution(rawDt) {
  if (gameState !== "playing" || isStaging() || document.hidden || rawDt > 0.5) return;
  perfWin.t += rawDt;
  perfWin.n++;
  perfWin.cool -= rawDt;
  if (perfWin.t < 2) return;
  const fps = perfWin.n / perfWin.t;
  perfWin.t = 0;
  perfWin.n = 0;
  if (perfWin.cool > 0) return;

  const auto = settings.gfx === "auto";
  const tierIdx = GFX_TIERS.indexOf(gfxAutoTier);
  const raised = perfWin.raised;
  perfWin.raised = false;
  perfWin.good = fps > 57 ? perfWin.good + 1 : 0;

  if (fps < 40) {
    if (auto && tierIdx < GFX_TIERS.length - 1) {
      // The tier we just climbed to couldn't hold: stay below it for good.
      if (raised) gfxCeiling = tierIdx + 1;
      setAutoTier(GFX_TIERS[tierIdx + 1]);
      perfWin.cool = 3;
    } else if (setPixelRatioStep(Math.max(MIN_PIXEL_RATIO, pixelRatio - 0.25))) {
      perfWin.cool = 3;
    }
  } else if (fps > 57) {
    if (setPixelRatioStep(Math.min(MAX_PIXEL_RATIO, pixelRatio + 0.125))) {
      perfWin.cool = 3;
    } else if (auto && tierIdx > gfxCeiling && perfWin.good >= 3) {
      setAutoTier(GFX_TIERS[tierIdx - 1]);
      perfWin.good = 0;
      perfWin.raised = true;
      perfWin.cool = 4;
    }
  }
}

function animate() {
  requestAnimationFrame(animate);
  const rawDt = clock.getDelta();
  const dt = Math.min(0.05, rawDt);
  adaptResolution(rawDt);
  const t = clock.elapsedTime;

  if (gameState === "paused" || localPauseOnly) pollGamepadMenu();

  // Runs during "gameover", between two matches in a room that stayed up.
  if (intermissionT > 0) {
    updateIntermission(dt);
    net.update(dt, netSnapshot());
  }

  if (gameState === "playing") {
    if (isStaging()) updateStaging(dt);
    // The clock itself isn't playtime, and nothing hostile moves during it.
    else { elapsedRun += dt; updateMatchClock(dt); }
    const staging = isStaging();

    aimAssistSticky = false;   // re-earned each frame by applyAimAssist
    pollGamepad(dt);
    updatePlayer(dt);
    if (!isRange()) regenPlayer(dt);
    updateWeaponView(dt);
    updateFpEmoteView();

    targetMeshes = [];
    if (staging) {
      if (inSkyLobby()) updateSkyLobby(dt);
      // Hostiles hold still, but remote operators and bots still stream in so
      // the room visibly fills while the player waits.
      if (isPvp()) {
        net.update(dt, netSnapshot());
        remotes.sync(net.peers);
        remotes.update(dt, net.team, !!currentMode().ffa);
        updateRemoteSabers();
      }
    } else if (isRange()) {
      rangeSet.update(dt);
      targetMeshes = rangeSet.hitMeshes();
      // Ammo and gear are free here — the range is for testing, not rationing.
      const w = currentWeapon();
      w.ammoReserve = w.def.reserveMax;
      player.gear.lethal = loadout.carried("lethal");
      player.gear.tactical = loadout.carried("tactical");
      player.hp = Math.min(player.maxHp, player.hp + dt * 12);
      // Bots spawned via the range's "Spawn a bot" button (spawnRangeBot)
      // keep steering/animating here — this whole block is a no-op for
      // anyone who never clicked that button.
      if (bots.count) {
        bots.update(dt, {
          colliders, arena: ARENA, ffa: true,
          // Real targets (including the player) so they walk/strafe/chase
          // with natural variety instead of just idling in place - onShoot
          // is a no-op so they never actually damage you here.
          targets: botTargets(),
          onShoot: () => {},
          spawnFor: botSpawn,
          sightBlocked: (a, b) => grenades.blocksSight(a, b),
        });
        for (const b of bots.bots) net.publishBot(b);
        net.update(dt, netSnapshot());
        remotes.sync(net.peers);
        remotes.update(dt, net.team, true);
        updateRemoteSabers();
      }
    } else if (isZombies()) {
      const roundOver = zdir.update(dt, player.pos, onZombieAttack, move.pos.y);
      if (roundOver) nextZombieRound();
      for (const ev of zdir.events.splice(0)) {
        if (ev.type === "maxammo") zombieMaxAmmo();
      }
      els.hudHostiles.textContent = String(zdir.remaining);
      els.hudKills.textContent = zdir.points.toLocaleString();
      targetMeshes = zdir.hitMeshes();
    } else if (isView()) {
      // View mode: an empty map, nothing to simulate.
    } else if (!isPvp() && spawner) {
      spawner.update(dt, player.pos, onGruntAttack);
      els.hudHostiles.textContent = String(spawner.aliveCount + spawner.toSpawn);
      if (spawner.isWaveClear()) nextWave();
      for (const g of spawner.grunts) if (g.alive && !g.dying) targetMeshes.push(...g.rig.hitboxMeshes);
    } else {
      const ffa = !!currentMode().ffa;

      syncRoomBotSkill(dt);
      // Exactly one client simulates the bots and publishes them as peers, so
      // everyone else needs no bot-specific code at all.
      if (net.isBotHost()) {
        const { humans, teams } = humanHeadcount();
        // Infection's sides change all match long; padding them back to even
        // would undo every infection, so it just fills the room.
        bots.fill(noBotsRoom() ? 0 : botTarget(), humans, botSpawn, ffa || isInfection(), isInfection() ? null : teams);
        net.botCount = bots.bots.length;
        if (isInfection()) sortInfectionBots();
        bots.update(dt, {
          colliders, arena: ARENA, ffa,
          targets: botTargets(),
          onShoot: onBotShoot,
          // Weapon-decided modes (One in the Chamber, Gun Game) stay gun-only.
          onThrow: currentMode().noBotNades ? null : botThrow,
          onMelee: botMelee,
          spawnFor: botSpawn,
          sightBlocked: (a, b) => grenades.blocksSight(a, b),
          objectiveFor: botObjective,
          isBusy: botBusy,
          noRespawn: isSnd() || isRoyale(),
          lodNear: isRoyale() ? humanEyes() : null,
        });
        updateBotStreaks(dt);
        updateBotAntiAir(dt);
        for (const b of bots.bots) net.publishBot(b);
      } else if (bots.count) {
        for (const b of bots.bots) net.dropBot(b.id);
        bots.clear();
      }

      net.update(dt, netSnapshot());
      remotes.sync(net.peers);
      remotes.update(dt, net.team, ffa, camera.position);
      updateRemoteSabers();
      updateKillcam(dt);
      targetMeshes = remotes.hitMeshes(ffa ? null : net.team);
      for (const e of streakEntities.values()) {
        if (e instanceof K9Pack && k9Hostile(e)) targetMeshes.push(...e.hitMeshes());
        else if (e instanceof SamTurret && streakHostileToMe(e)) targetMeshes.push(...e.hitMeshes());
      }
      for (const a of enemyAirFor(net.team, net.id)) {
        if (a.e instanceof Dragonfire) targetMeshes.push(...a.e.hitMeshes());
        else if (a.e.hitbox && a.e.hp > 0) targetMeshes.push(a.e.hitbox);
      }

      if (scavengeAllowed()) { pickups.update(dt); updatePickupPrompt(dt); }
      else {
        if (pickups.drops.length) pickups.clear();
        // Troll Royale has no scavenge drops, but its guns on the ground
        // (floor loot and whatever the dead leave) use the same hold-X prompt.
        if (isRoyale()) updatePickupPrompt(dt);
      }

      if (isInfection()) updateInfection(dt);

      if (hill) {
        if (hill.update(dt)) { setHillMarker(hill); showWaveBanner("Hill moved", 1300); }
        hillAcc += dt;
        if (hillAcc >= 1) { hillAcc = 0; scoreHill(); }
      }

      if (isSnd()) {
        updateSnd(dt);
      } else if (isRoyale()) {
        updateRoyale(dt);
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
      // Someone else's round striking a wall throws the same dust, a touch
      // lighter — it's the "they're shooting at that corner" cue.
      onWorldHit: (point, cosmetic, hit = {}) => {
        impactFx.hit(point, { normal: hit.normal, dir: hit.dir, surface: hit.ground ? "ground" : "concrete", scale: cosmetic ? 0.6 : 1 });
        audio.impact(point);
        // maps with things that react to being shot (Hollowgrin's tin trolls)
        builtMap?.map?.onShot?.(point);
      },
      bounds: ARENA,
    });
    impactFx.update(dt, camera, renderer);

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
    if (w.ads !== hudCache.ads) {
      hudCache.ads = w.ads;
      // Raising/lowering the sight was the one silent transition on the gun —
      // every other action (fire, reload, inspect) already has a cue.
      audio.ads(w.ads);
    }
    // First person aims through the gun's own sight, so the crosshair goes.
    // Third person has no sight picture (the camera sits over the shoulder),
    // so it stays, tightened, or aiming in left you with nothing to aim by.
    const adsTp = w.ads && (settings.thirdPerson || emoteIsTp());
    const adsHide = w.ads && !adsTp;
    if (adsHide !== hudCache.adsHide || adsTp !== hudCache.adsTp) {
      hudCache.adsHide = adsHide;
      hudCache.adsTp = adsTp;
      els.crosshair.classList.toggle("is-ads", adsHide);
      els.crosshair.classList.toggle("is-ads-tp", adsTp);
    }
    const lowhp = player.hp < 25 && !royaleSpectating();
    if (lowhp !== hudCache.lowhp) { hudCache.lowhp = lowhp; els.lowhp.classList.toggle("is-low", lowhp); }

    // A cooked grenade keeps ticking in your hand, and can go off in it.
    // Only cookable ones: a firebomb or smoke held down used to burn its fuse
    // in your hand too, with no cook bar to warn you.
    if (cooking.def && cooking.def.cookable) {
      cooking.fuse -= dt;
      els.cook.hidden = false;
      els.cookFill.style.width = `${Math.max(0, (cooking.fuse / cooking.def.fuse) * 100)}%`;
      if (cooking.fuse <= 0) {
        const held = cooking.def;
        cooking.fuse = 0;
        releaseCook({ cookedOff: true });   // spent in the hand…
        const at = player.pos.clone();
        publishBoom(nextNadeId(), held, at);
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
    updateHitDirs(dt);
    els.hitflash.classList.toggle("is-hit", hitFlashT > 0.05);
    impactPass.uniforms.uHitFlash.value = hitFlashT;
    impactPass.uniforms.uLowHp.value = player.hp < 25 ? 1 : 0;
    impactPass.uniforms.uAberration.value = Math.min(1, w.viewKickKnockback * 6);
    impactPass.uniforms.uTime.value = t;
    suppressT = Math.max(0, suppressT - dt * 1.1);
    impactPass.uniforms.uSuppress.value = suppressT;
    updateUavState();
    updateStreakEntities(dt);
    drawMinimap();

    // fov kick based on sprint/ads
    const def = w.def;
    let targetFov = baseFov;
    if (w.ads) targetFov = baseFov * def.adsFovMult;
    if (move.sprinting && !w.ads) targetFov = baseFov * 1.06;
    if (move.stance === STANCE.SLIDE) targetFov = baseFov * 1.12;
    if (swivel.dir) targetFov = baseFov * (1 + 0.1 * Math.sin(Math.PI * swivelK()));
    if (warshipView()) targetFov = WARSHIP_GUNS[warshipGun].fov;
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 10);
    camera.updateProjectionMatrix();

    // Tube optics narrow the viewmodel lens as well, so the eyepiece fills
    // a useful part of the screen instead of a coin in the middle.
    const vm = activeWeaponMesh?.userData;
    const adsWeaponFov = player.holding !== "melee" && player.holding !== "streak" && vm?.adsWeaponFov ? vm.adsWeaponFov : 50;
    const targetWeaponFov = 58 + (adsWeaponFov - 58) * w.adsT;
    weaponCamera.fov += (targetWeaponFov - weaponCamera.fov) * Math.min(1, dt * 10);
    weaponCamera.updateProjectionMatrix();

    animDebug.update();
  }

  if (gameState === "menu") {
    updateLobbyCamera(dt);
    pollMenuEmotePad();
    if (inspectorLive && !els.title.hidden) inspector?.tick(dt);
    if (charInspectorLive && !els.title.hidden) charInspector?.tick(dt);
    if (charInspectorLive && !els.title.hidden) sumInspector?.tick(dt);
  }

  sky.position.copy(camera.position);
  // The BO2 menu's planet (menu-bo2.js) covers the whole lobby: skip
  // drawing the arena nobody can see behind it.
  if (!(gameState === "menu" && document.body.classList.contains("to-bo2-cover"))) composer.render();

  // The FP viewmodel (gun+arms) only makes sense in first person — the gun
  // is already visible on the third-person rig itself, so rendering both
  // would double up the weapon on screen.
  // Spectating in Troll Royale: the view is someone else's, so no gun of ours.
  // Dead (and not in a replay): no gun on screen, the camera is on the body.
  if (gameState === "playing" && ((player.alive && !isView() && !settings.thirdPerson && !emoteIsTp() && !royaleSpectating() && !royaleDropView() && !warshipView() && !dragonfireView()) || killcam.replaying)) {
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

// -------------------- third-person camera (spring arm) --------------------
// Chase camera behind the player's own rig. Distance/side offset blend
// in from an over-the-shoulder position as ADS deepens (w.adsT), rather
// than snapping to first-person the way most third-person shooters with
// real iron sights do - this game keeps the model visible while aiming.
const TP_HIP_DIST = 3.2;
const TP_HIP_SIDE = 0.55;       // shoulder offset, hip-fire framing
const TP_ADS_DIST = 1.5;
const TP_ADS_SIDE = 0.5;
const TP_HEIGHT = 0.35;
const _tpPivot = new THREE.Vector3();
const _tpDesired = new THREE.Vector3();
const _tpDir = new THREE.Vector3();
const _tpRight = new THREE.Vector3();
const _tpForward = new THREE.Vector3();

/* Places `camera` behind `pivot` along the look direction (yaw/pitch),
   pulled in by raycastWorld so it never clips through a wall/floor. */
/* While emoting the camera swings round in front, a little above, and
   looks back at the operator's chest — the locker-room angle — pulled in
   if a wall is in the way. `pivot` is the eye position. */
function updateEmoteCamera(pivot, yaw, duoDist = 0) {
  _euler.set(0, yaw, 0);
  _tpForward.set(0, 0, -1).applyEuler(_euler);
  _tpPivot.copy(pivot);
  _tpPivot.y -= 0.45;
  // A duo: look at the pair from a three-quarter angle, centred between
  // them (a straight side view shows both flat trollfaces edge-on).
  if (duoDist) {
    _tpPivot.addScaledVector(_tpForward, duoDist / 2);
    _euler.set(0, yaw + 0.95, 0);
    _tpForward.set(0, 0, -1).applyEuler(_euler);
  }
  _tpDir.copy(_tpForward).multiplyScalar(duoDist ? 3.3 : 2.7);
  _tpDir.y += 0.5;
  const wantLen = _tpDir.length();
  _tpDir.normalize();
  const safeLen = Math.max(0.6, raycastWorld(colliders, _tpPivot, _tpDir, wantLen) - 0.15);
  camera.position.copy(_tpPivot).addScaledVector(_tpDir, safeLen);
  camera.lookAt(_tpPivot);
}

function updateThirdPersonCamera(pivot, yaw, pitch, adsT) {
  const dist = TP_HIP_DIST + (TP_ADS_DIST - TP_HIP_DIST) * adsT;
  const side = TP_HIP_SIDE + (TP_ADS_SIDE - TP_HIP_SIDE) * adsT;

  _euler.set(pitch, yaw, 0);
  _tpForward.set(0, 0, -1).applyEuler(_euler);
  _tpRight.set(1, 0, 0).applyEuler(_euler);

  _tpPivot.copy(pivot);
  _tpDesired.copy(_tpPivot)
    .addScaledVector(_tpForward, -dist)
    .addScaledVector(_tpRight, side);
  _tpDesired.y += TP_HEIGHT;

  _tpDir.copy(_tpDesired).sub(_tpPivot);
  const wantLen = _tpDir.length();
  _tpDir.normalize();
  // Pull the camera in toward the pivot if the desired spot is behind a
  // wall/floor — a small skin width keeps it from resting exactly on the
  // surface and clipping into it.
  const safeLen = Math.max(0.15, raycastWorld(colliders, _tpPivot, _tpDir, wantLen) - 0.1);

  camera.position.copy(_tpPivot).addScaledVector(_tpDir, safeLen);
  // Look along the aim from over the shoulder, parallel to it, rather than
  // back across at the pivot: converging on the pivot ran the line of sight
  // through our own head, which filled the middle of the screen in ADS.
  camera.lookAt(
    camera.position.x + _tpForward.x * 10,
    camera.position.y + _tpForward.y * 10,
    camera.position.z + _tpForward.z * 10,
  );
  // Aiming in, our own face ghosts out so the left of the sight picture is
  // clear; pulled in tight against a wall it would be in the way outright.
  const head = localRig.parts.head;
  head.visible = safeLen > 0.9;
  head.material.opacity = 1 - 0.7 * adsT;
  head.material.depthWrite = adsT < 0.1;
}

let localLower = 0;
let localThrowT = 0;   // the third-person body's overhand throw, counting down
let localBlockT = 0;   // the third-person body in the saber guard, 0..1

/* Positions and poses the local player's own humanoid rig every frame -
   same buildHumanoid/poseHumanoid contract remote-players.js drives other
   operators with, fed from this client's own authoritative move/look state
   instead of reconstructed network deltas. Runs regardless of view mode
   (cheap, and keeps the rig ready the instant third person is toggled on)
   but only actually matters visually while localRig.root.visible is true. */
/* ---------------- Swivel (user: a basketball spin move) ----------------
   Running forward, double-tap A or D (a pad: click the left or right
   stick) and the body spins a full 360 on the spot toward that side and
   comes out of it SWIVEL_SIDE metres over to that side, still running.
   Left spins to the body's left first (flip SWIVEL_LEFT_SIGN to reverse).
   Everyone else sees the spin (`sv` on the state packet: side * count); in
   first person it's a quick roll and FOV kick rather than a full turn of
   the camera. */
const SWIVEL_TIME = 0.5;
const SWIVEL_SIDE = 0.9;          // metres gained toward that side
const SWIVEL_COOLDOWN = 0.35;     // after one ends
const SWIVEL_TAP = 0.28;          // seconds between the two taps
const SWIVEL_LEFT_SIGN = 1;       // +1: a left swivel turns left first (yaw grows to the left)
const swivel = { t: 0, dir: 0, yaw: 0, cd: 0, seq: 0, prevK: 0 };
const swivelTaps = { KeyA: 0, KeyD: 0 };
function swivelK() { return swivel.dir ? Math.min(1, swivel.t / SWIVEL_TIME) : 0; }
function swivelEase(k) { return k * k * (3 - 2 * k); }
/* `dir` -1 left, +1 right. Needs to be running forward on the ground. */
function trySwivel(dir) {
  if (swivel.dir || swivel.cd > 0 || !player.alive || localPauseOnly || stageFrozen()) return false;
  if (!move.grounded || move.busy || move.stance !== STANCE.STAND) return false;
  const fwd = -(move.velocity.x * Math.sin(look.yaw) + move.velocity.z * Math.cos(look.yaw));
  if (fwd < 1.5) return false;
  swivel.dir = dir;
  swivel.lastDir = dir;
  swivel.t = 0;
  swivel.prevK = 0;
  swivel.yaw = look.yaw;
  swivel.seq = (swivel.seq % 999) + 1;
  audio.slide?.();
  return true;
}
/* Per frame after the move: shift sideways along the swivel's arc. */
function updateSwivel(dt) {
  swivel.cd = Math.max(0, swivel.cd - dt);
  if (!swivel.dir) return;
  swivel.t += dt;
  const k = swivelK();
  const step = (swivelEase(k) - swivelEase(swivel.prevK)) * SWIVEL_SIDE * swivel.dir;
  swivel.prevK = k;
  // Right of the heading the swivel started on: (cos, 0, -sin).
  move.pos.x += Math.cos(swivel.yaw) * step;
  move.pos.z -= Math.sin(swivel.yaw) * step;
  move.resolveHorizontal(move.pos, move.pos.y);
  if (k >= 1 || !player.alive) { swivel.dir = 0; swivel.cd = SWIVEL_COOLDOWN; }
}
/* The body's extra turn for a swivel of `dir` at `k` (0..1), radians. */
function swivelSpin(dir, k) {
  return -dir * SWIVEL_LEFT_SIGN * Math.PI * 2 * swivelEase(Math.max(0, Math.min(1, k)));
}

/* Dead, between the killcam and the respawn (or with no killcam at all):
   your own body lies where you fell, weapons gone from it and from the
   screen (user: show the dead body, not the guns). Timed off kcClock, so a
   fall the killcam already played stays settled rather than replaying. */
let localDeadAt = 0;
function noteLocalDeath() {
  localDeadAt = kcClock;
  localRig.death = null;
}
function updateLocalDeadBody() {
  localRig.root.visible = true;
  localRig.parts.head.visible = true;
  localRig.root.position.set(move.pos.x, move.pos.y, move.pos.z);
  if (localHeld.mesh) localHeld.mesh.visible = false;
  weaponRig.visible = false;
  poseDeath(localRig, Math.min(1, (kcClock - localDeadAt) / DEATH_TIME));
}
const _deathCamAt = new THREE.Vector3(), _deathCamDir = new THREE.Vector3();
/* Looking down at the body from a little behind and above, drifting slowly
   round it; pulled in off walls like the third-person camera. */
function placeDeathCamera() {
  const t = kcClock - localDeadAt;
  const a = look.yaw + 0.5 + t * 0.12;
  _deathCamAt.set(move.pos.x, move.pos.y + 0.35, move.pos.z);
  _deathCamDir.set(Math.sin(a) * 2.6, 2.4, Math.cos(a) * 2.6);
  const want = _deathCamDir.length();
  _deathCamDir.normalize();
  const len = Math.max(0.6, raycastWorld(colliders, _deathCamAt, _deathCamDir, want) - 0.15);
  camera.position.copy(_deathCamAt).addScaledVector(_deathCamDir, len);
  camera.lookAt(_deathCamAt);
}

function updateLocalRig(dt) {
  if (!player.alive && gameState === "playing" && !royaleSpectating()) { updateLocalDeadBody(); return; }
  localRig.root.position.set(move.pos.x, move.pos.y, move.pos.z);
  // The body follows the aim a beat behind; the head leads the turn.
  const rolling = royaleRolling();
  // Under the glider the body hangs the way the wing flies, not where you look.
  const gliding = royale?.me === "glide" && royale.flight;
  aimRig(localRig, rolling ? royale.rollYaw : gliding ? royale.flight.heading : look.yaw, dt, { moving: move.moving, snap: rolling });
  if (swivel.dir) localRig.root.rotation.y += swivelSpin(swivel.dir, swivelK());

  const wantLower = rolling ? 1 : STANCE_LOWER[move.stance] ?? 0;
  localLower += (wantLower - localLower) * Math.min(1, dt * 8);

  // Signed forward/strafe relative to facing, same convention
  // remote-players.js derives from position deltas - here it's exact,
  // straight off the velocity vector and yaw.
  const sin = Math.sin(look.yaw), cos = Math.cos(look.yaw);
  const vx = move.velocity.x, vz = move.velocity.z;
  const speed = Math.hypot(vx, vz);
  const rightX = cos, rightZ = -sin;
  const fwdX = -sin, fwdZ = -cos;
  let strafe = 0, forward = 1;
  if (speed > 0.05) {
    strafe = Math.max(-1, Math.min(1, (vx * rightX + vz * rightZ) * 6));
    forward = Math.max(-1, Math.min(1, (vx * fwdX + vz * fwdZ) * 6));
  }
  const gaitSpeed = Math.max(0, Math.min(1, speed / 4.2));

  if (move.moving) localPhase += dt * gaitPhaseRate(speed);

  // What's in the hands: the melee weapon while it's held or mid-swing
  // (a quick melee swings it without putting the gun away), else the gun.
  const swinging = !!player.melee?.busy;
  const hold = player.holding === "melee" || swinging ? "melee"
    : player.holding === "gun" ? "gun" : "none";
  const def = currentWeapon()?.def;
  syncLocalRigHeld(hold, def);

  if (emoteWheel.isOpen && (!player.alive || gameState !== "playing")) emoteWheel.close(true);
  updateDuo(dt);
  if (validEmote()) {
    emote.t += dt;
    if (move.moving || !player.alive || gameState !== "playing" || emote.t > emoteSeconds(emote.idx)) stopEmote();
  }
  if (localHeld.mesh) localHeld.mesh.visible = !emote;
  els.hud.classList.toggle("is-emoting", emoteIsTp());
  if (emote) {
    poseEmoteCode(localRig, emoteCode(emote.idx, emote.role), emote.t);
    return;
  }

  poseHumanoid(localRig, {
    phase: localPhase,
    moving: move.moving && move.grounded,
    pitch: look.pitch,
    lower: localLower,
    strafe,
    forward,
    speed: gaitSpeed,
    mps: speed,
    dt,
    hold,
    hasGun: hold === "gun" && def?.cls !== "sidearm",
    swing: swinging ? {
      t: Math.min(1, player.melee.t / player.melee.total),
      kind: player.melee.swingIndex % 2 === 0 ? "swing" : "thrust",
    } : null,
    recoil: hold === "gun" ? Math.min(1, (currentWeapon()?.viewKickKnockback || 0) * 7) : 0,
    block: localBlockT = damp(localBlockT, saberBlock.active ? 1 : 0, 14, dt),
    parry: saberParry.sample(),
  });
  if (localThrowT > 0) {
    localThrowT = Math.max(0, localThrowT - dt);
    poseThrowArm(localRig, 1 - localThrowT / THROW_TIME);
  }
  rollRig(localRig, royaleRollK());
  // Skydiving, then hanging under the glider (seen in the drop camera).
  const dropCode = royaleDropCode();
  if (dropCode === DROP_FALL || dropCode === DROP_GLIDE) {
    localDropT += dt;
    poseDrop(localRig, dropCode, localDropT);
    if (localHeld.mesh) localHeld.mesh.visible = false;
  }
}
let localDropT = 0;

/* The third-person body carries the same gun or melee weapon the first-
   person view shows. Rebuilt only when what's held changes. */
const localHeld = { key: null, mesh: null };
function syncLocalRigHeld(hold, def) {
  const key = hold === "gun" ? `gun:${def?.id}:${def?.attachments?.skin || ""}` : hold === "melee" ? `melee:${player.melee?.def?.id}` : "none";
  if (key === localHeld.key) return;
  localHeld.key = key;
  if (localHeld.mesh) {
    localHeld.mesh.parent?.remove(localHeld.mesh);
    localHeld.mesh.traverse((o) => { if (!o.geometry?.userData.shared) o.geometry?.dispose?.(); });
    localHeld.mesh = null;
  }
  if (hold === "gun" && def) {
    localHeld.mesh = stripLights(buildWeaponMesh(def));
    mountHeldWeapon(localRig, localHeld.mesh);
  } else if (hold === "melee" && player.melee?.def) {
    // No first-person hands on it: the body's own mitt holds it.
    localHeld.mesh = buildMeleeMesh(player.melee.def, false);
    localHeld.mesh.scale.setScalar(1.1);
    localHeld.mesh.userData.meleeId = player.melee.def.id;
    localRig.parts.gripR.add(localHeld.mesh);
  }
  localHeld.mesh?.traverse((o) => { if (o.isMesh) o.castShadow = true; });
}

/* Last value written to each per-frame HUD node. The DOM write itself is
   cheap, but it was unconditional — every one of these touched layout/paint
   60×/sec even sitting still with full ammo and health. Comparing first
   means the browser only does anything the frame a number actually moves. */
const hudCache = { hpPct: -1, hpLow: null, hpText: -1, ammoCur: -1, ammoRes: -1, reloadHidden: null, ads: null, adsHide: null, adsTp: null, lowhp: null };

/* Passive regen: health climbs back to full on its own once you've been out
   of a fight for a beat, instead of every scratch being permanent until the
   next respawn (there is no med pickup). The delay after the last hit is
   what keeps trading meaningful — regen never starts mid-fight. */
const REGEN_DELAY = 4.5;   // seconds since last hit before regen kicks in
const REGEN_RATE = 12;     // hp per second once it starts

function regenPlayer(dt) {
  if (!player.alive || player.hp >= player.maxHp) return;
  if (performance.now() - player.lastHurtAt < REGEN_DELAY * 1000) return;
  player.hp = Math.min(player.maxHp, player.hp + REGEN_RATE * dt);
}

/* View mode's camera: flies where you look, through everything, no gravity.
   Space / jump up, C / Ctrl / crouch down, Shift (or the stick pushed all
   the way) for speed. */
const VIEW_FLY_SPEED = 12;
function flyView(dt, ix, iz) {
  const gp = gamepadState.connected;
  const up = keys.has("Space") || (isTouch && touchState.jump) || (gp && gamepadState.jump) ? 1 : 0;
  const down = keys.has("KeyC") || keys.has("ControlLeft") || (isTouch && touchState.crouch) || (gp && gamepadState.crouch) ? 1 : 0;
  const fast = keys.has("ShiftLeft") || ((isTouch || gp) && iz > 0.9) ? 3.5 : 1;
  const sp = VIEW_FLY_SPEED * fast * dt;
  const cy = Math.cos(look.yaw), sy = Math.sin(look.yaw), cp = Math.cos(look.pitch);
  move.pos.x += (-sy * cp * iz + cy * ix) * sp;
  move.pos.z += (-cy * cp * iz - sy * ix) * sp;
  move.pos.y = Math.max(-30, move.pos.y + (Math.sin(look.pitch) * iz + up - down) * sp);
  move.velocity.set(0, 0, 0);
}

function updatePlayer(dt) {
  const w = currentWeapon();

  if (streakHoldT > 0 && !streakHoldUntilMark) {
    streakHoldT -= dt;
    if (streakHoldT <= 0) endStreakHold();
  }

  const gp = gamepadState.connected;

  // The pad's own assist runs in pollGamepad off stick deflection; touch
  // gets the same while a thumb is down on the look pad, and mouse or
  // trackpad while it's being moved. aimAssistSticky is left set from the
  // pad's pass this frame, so only clear it when nothing is steering.
  const mouseSteering = controls.isLocked && performance.now() - mouseLookAt < MOUSE_ACTIVE_MS;
  const canAssist = player.alive && !isStaging() && !dragonfireView();
  if (canAssist && touchState.looking) applyAimAssist(dt);
  if (canAssist && mouseSteering) applyAimAssist(dt, AIM_ASSIST_MOUSE_PULL);

  if ((isTouch &&(touchState.lookDX || touchState.lookDY)) || (gp && (gamepadState.lookDX || gamepadState.lookDY))) {
    const ls = lookSensScale();
    look.yaw -= (touchState.lookDX + gamepadState.lookDX) * ls;
    look.pitch -= (touchState.lookDY + gamepadState.lookDY) * ls;
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
  // The pause menu being open in a live-with-others match freezes this
  // client's own avatar the same way death or staging does, while net
  // updates, bots and remote players keep simulating around it.
  // Heads-down on the strike tablet: you stand still, as in BO2.
  // On the bus or in the air your stick steers the fall, not your feet.
  const dropping = royaleDropView();
  const dropIx = ix, dropIz = iz;
  const rolling = royaleRolling();
  dfIx = ix; dfIz = iz;   // the Dragonfire flies off the same stick
  const frozen = dropping || rolling || !player.alive || stageFrozen() || localPauseOnly || !!strikeTablet?.isOpen || warshipView() || dragonfireView();
  if (frozen) { ix = 0; iz = 0; }
  // The landing roll carries you forward along the glider's line.
  if (rolling) {
    updateRoyaleRoll(dt);
    iz = Math.max(0, 1 - royaleRollK()) * (ROLL_SPEED / 4.2);
  }
  // A toggled AIM shouldn't survive a death or a streak call.
  if (touchState.ads && (!player.alive || player.holding === "streak")) setTouchAds(false);

  // Q aims as well as right mouse.
  // An EMP kills the optic, so there is nothing to aim down until it clears.
  // Calling a streak swaps the hands to the streak device/marker, so the
  // primary's optic has no business popping up over it (that's the "scoped
  // weapon flash" glitch when activating a killstreak while holding ADS).
  // Staging doesn't block it: scoping in on the mark is harmless (see canAds).
  const wantAds = player.alive && !isView() && !localPauseOnly && empT <= 0 && player.holding !== "streak"
    && ((isTouch && touchState.ads) || (gp && gamepadState.ads) || adsHeld || keys.has("KeyQ"));
  const wantFire = !frozen && !isView() && ((isTouch && touchState.firing) || (gp && gamepadState.firing) || mouseDown);
  if (isSnd()) {
    sndInteractHeld = !frozen && ((isTouch && touchState.interact) || (keys.has("KeyF") && cooking.slot !== "tactical")
      || (gp && gamepadState.pickup && sndCanInteract));
  }

  // Shallow water (a map's `wade` outline, edge.js): slow, and no sprinting.
  // Only with your feet in it: a jetty, bridge or boat deck over it is dry.
  const wading = !!ARENA.wade && move.pos.y < 0.5 && insidePolygon(ARENA.wade, move.pos.x, move.pos.z);
  if (dropping) updateDropPlayer(dt, dropIx, dropIz, (isTouch && touchState.jump) || (gp && gamepadState.jump) || keys.has("Space"));
  else if (isView()) flyView(dt, ix, iz);
  else move.update(dt, {
    forward: iz,
    strafe: ix,
    sprint: !wading && !rolling && ((isTouch || gp) ? iz > 0.82 : keys.has("ShiftLeft")),
    jump: !frozen && ((isTouch && touchState.jump) || (gp && gamepadState.jump) || keys.has("Space")),
    crouch: !frozen && ((isTouch && touchState.crouch) || (gp && gamepadState.crouch) || keys.has("KeyC")),
    dive: !frozen && ((isTouch && touchState.dive) || keys.has("ControlLeft") || keys.has("ControlRight")),
    yaw: rolling ? royale.rollYaw : look.yaw,
    adsHeld: wantAds,
    speedMult: w.moveSpeedMult * (isInfected() ? INFECTION.speed : 1) * (wading ? 0.55 : 1),
    // Troll Royale is a 400 m island: sprinting covers it 25% faster.
    sprintMult: (w.def.sprintMult || 1.35) * (isRoyale() ? 1.25 : 1),
    inertia: w.def.inertia,
  });

  updateSwivel(dt);

  if (move.moving && move.grounded && player.alive) {
    stepPhase += dt * (move.sprinting ? 13 : 9);
    if (stepPhase > Math.PI) { stepPhase -= Math.PI; audio.step(); }
  } else {
    stepPhase = 0;
  }
  if (move.justLanded && player.alive) audio.land(move.landSpeed);

  updateEnemySteps(dt);

  move.eyePosition(player.pos);

  // While it's running, the kill cam owns camera.position/.quaternion in
  // full — skip both the eye-position copy and the aim/recoil composition
  // below so the two don't fight over the same camera in the same frame.
  if (killcam.update(dt)) return;
  // Catches the orbit finishing on its own (as opposed to being cut short by
  // respawnPlayer's killcam.cancel(), which already clears this itself) —
  // classList.remove on an absent class is a no-op, so this is safe every frame.
  els.killcamBars.classList.remove("is-on");

  // The local rig always follows the player (even in first-person, when
  // it's simply invisible) so it's never a frame stale the moment third
  // person is toggled on, and so OTHER systems that might reasonably poke
  // at it (screenshots, a future killcam angle) see a live pose.
  updateLocalRig(dt);

  const shake = shakeT > 0 ? shakeMag * (shakeT / 0.45) : 0;
  // Phase 6 (DESIGN-ARMS.md §5, camera polish): small, separately-tuned
  // camera-only echoes of the viewmodel's own landing dip and melee impact-
  // stop — same trigger state (landDipT/landDipMag, meleeImpactT), much
  // smaller magnitude, so the whole screen never shakes as hard as the gun
  // moves. Read one frame behind their viewmodel counterparts (updatePlayer
  // runs before updateWeaponView each frame) — imperceptible on a decaying
  // effect, not worth reordering the main loop over.
  const landKick = landDipMag * landDipT * 0.05;
  const meleeKick = meleeImpactT * 0.03;
  updateFireShake(dt);
  const buzz = fireShake.buzz;
  const fpCam = fpEmoteFrame()?.cam;   // a first-person emote's head motion (a laugh, a facepalm)
  const viewYaw = look.yaw + w.recoilYaw + (Math.random() - 0.5) * shake + fireShake.y + (Math.random() - 0.5) * buzz
    + (fpCam?.yaw || 0) + (Math.random() - 0.5) * sawShake;
  updateTabletDive(dt);
  const viewPitch = look.pitch - tabletDiveDip() + w.recoilPitch + (Math.random() - 0.5) * shake + landKick + meleeKick
    + fireShake.p + (Math.random() - 0.5) * buzz + (fpCam?.pitch || 0) + (Math.random() - 0.5) * sawShake;

  if (royaleSpectating()) {
    localRig.root.visible = false;
    placeSpectateCamera(dt);
  } else if (!player.alive && gameState === "playing") {
    placeDeathCamera();
  } else if (dragonfireView()) {
    // Flying the Dragonfire through its nose camera; your body stays put.
    // Its own airframe is hidden from its own camera: the gun and the
    // rotor arms used to hang across the view (user: fix the camera).
    localRig.root.visible = true;
    dragonfire.root.visible = false;
    dragonfire.cameraPose(camera.position, camera.quaternion);
    // Aim assist (user): a pull onto whoever is near the reticle, out to the
    // gun's range, while you shoot or aim. Just flying, it leaves the drone
    // alone: a constant pull steered it into walls.
    const dfFiring = (isTouch && touchState.firing) || (gp && gamepadState.firing) || mouseDown;
    if (!localPauseOnly && (dfFiring || mouseSteering || touchState.looking || gp)) applyAimAssist(dt, DF_ASSIST_PULL, DF_ASSIST_CONE_DEG, DF_RANGE);
    if (!localPauseOnly && dfFiring) fireDragonfire();
  } else if (warshipView()) {
    // Up in the VTOL's gunner seat; your body stands where you called it.
    localRig.root.visible = true;
    placeWarshipCamera();
    if ((isTouch && touchState.firing) || (gp && gamepadState.firing) || mouseDown) fireWarship();
  } else if (royaleDropView()) {
    // Third person on the drop: behind the bus while you ride, then behind
    // you (and your glider) on the way down. Look orbits the camera.
    localRig.root.visible = royale.me !== "bus";
    if (royale.me === "bus") placeDropCamera(royale.drop.bus ? royale.drop.bus.position : move.pos, 26, 8);
    else placeDropCamera(_dropTarget.set(move.pos.x, move.pos.y + (royale.me === "glide" ? 3 : 1.4), move.pos.z), royale.me === "glide" ? 10 : 7, 1.5);
  } else if (settings.thirdPerson || emoteIsTp()) {
    localRig.root.visible = true;
    if (emoteIsTp()) updateEmoteCamera(player.pos, look.yaw, emoteKind() === "duo" ? EMOTES[emote.idx].dist || 1 : 0);
    else updateThirdPersonCamera(player.pos, viewYaw, viewPitch, w.adsT);
  } else {
    localRig.root.visible = false;
    localRig.parts.head.visible = true;
    camera.position.copy(player.pos);
    // Landing roll: the view goes head over heels once and dips as you tuck.
    const rollK = royaleRollK();
    if (rollK > 0) camera.position.y -= Math.sin(Math.PI * rollK) * 0.9;
    // PF slide: the view tips over a few degrees while you slide, leaning
    // toward the side you're steering (left by default).
    slideTiltT = damp(slideTiltT, move.stance === STANCE.SLIDE ? 1 : 0, 9, dt);
    const slideRoll = slideTiltT * 0.075 * ((move.strafeInput ?? 0) > 0.2 ? -1 : 1)
      + (swivel.dir ? -swivel.dir * 0.16 * Math.sin(Math.PI * swivelK()) : 0);
    // One place composes the camera: aim + weapon recoil.
    const rollPitch = rollK > 0 ? -Math.PI * 2 * rollK * rollK * (3 - 2 * rollK) : 0;
    _euler.set(viewPitch + rollPitch, viewYaw, (Math.random() - 0.5) * shake * 0.6 + fireShake.r + slideRoll);
    camera.quaternion.setFromEuler(_euler);
  }

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

  const canAct = !move.busy && player.alive && !stageFrozen() && !royaleDropView() && !warshipView();
  // Pulling the trigger drops a plate or a Hopium half-used.
  if (royale?.act && wantFire) cancelRoyaleAct();
  // Aiming itself is harmless during the pre-match countdown — no shooting,
  // no movement change beyond what ADS already slows — so it gets its own,
  // looser gate instead of inheriting the staging freeze from canAct.
  const canAds = !move.busy && player.alive;
  w.update(dt, {
    moving: move.moving,
    sprinting: move.sprinting,
    grounded: move.grounded,
    jumping: move.jumping,
    // A held melee weapon has the hands: the gun behind it doesn't scope in
    // (with the saber, aim is the block instead).
    adsHeld: wantAds && canAds && player.holding !== "melee",
    canAds,
  });
  updateSaberBlock(dt, wantAds && canAds);

  // A charge only lives while the gun is up: melee, a streak device or
  // death drops it.
  if (w.charging && (player.holding !== "gun" || !player.alive)) endCandleCharge(w);

  // Holding the melee weapon turns the fire button into a swing.
  if (player.holding === "melee") {
    if (wantFire && fireEdgeTrigger && canAct) swingMelee();
    return;
  }

  // Holding the care package marker: fire throws it.
  if (player.holding === "streak" && markingStreak === "carepackage" && wantFire && fireEdgeTrigger) throwMarker();

  // Looking at the streak device (DESIGN-ARMS.md Phase 5 §5's explicit
  // interaction-bug call-out): fire is disabled outright rather than
  // silently shooting through a hidden gun mesh while the device is up.
  if (player.holding === "streak") return;

  if (w.def.fireMode === "charge") {
    updateCandleCharge(w, dt, wantFire && canAct && !swinging);
  } else if (wantFire && canAct && !swinging) {
    if (w.def.fireMode === "auto") {
      if (w.canFire()) fireOnce();
    } else if (w.def.fireMode === "burst") {
      if (fireEdgeTrigger && w.burstLeft <= 0 && w.canFire()) w.burstLeft = w.def.burst || 2;
    } else if (fireEdgeTrigger && w.canFire()) {
      fireOnce();
    } else if (fireEdgeTrigger && w.reloading && w.def.shellReload && w.interruptReload()) {
      // BO2 pump shotgun: fire stops the shell-by-shell reload, and the
      // shot goes off as soon as the gun is back up.
      w.fireQueued = true;
    }
  }
  if (w.fireQueued && !w.reloading) {
    w.fireQueued = false;
    if (wantFire && canAct && !swinging && w.canFire()) fireOnce();
  }

  // A burst finishes on its own cadence even if the trigger is released.
  if (w.burstLeft > 0 && canAct && w.canFire()) {
    fireOnce();
    w.burstLeft--;
  }
}

/* Green Candles charge shot. Press starts a charge (the candle brightens,
   a hum climbs, a ring fills round the crosshair); release fires. Let go
   inside `minHold` and it's a tap: a quick 1-cell bolt. Past that, the
   bolt scales with the charge up to a full 3-cell shot at `time`, capped
   by what's left in the tank. Holding a full charge keeps it, with a
   shake. Sprinting or reloading drops it without firing. */
function updateCandleCharge(w, dt, held) {
  const c = w.def.charge;
  // Its own press edge (not the 16 ms fireEdgeTrigger): a slow frame must
  // never swallow the press that starts a charge.
  const pressed = held && !w.triggerHeld;
  w.triggerHeld = held;
  if (w.charging) {
    if (w.reloading || move.sprinting || !held) {
      const release = !held && !w.reloading && !move.sprinting;
      const level = w.chargeT < c.minHold ? 0 : w.chargeLevel;
      endCandleCharge(w);
      if (release) fireOnce(chargedShotDef(w.def, level));
      return;
    }
    w.chargeT += dt;
    audio.candleCharge(w.chargeLevel, w.chargeT >= c.time);
    return;
  }
  if (!pressed) return;
  if (w.canFire()) {
    w.charging = true;
    w.chargeT = 0;
    inspectT = 0;
  } else if (w.ammoInMag <= 0 && !w.reloading) {
    tryReload();
  }
}

function endCandleCharge(w) {
  w.cancelCharge();
  audio.candleCharge(-1);
  els.charge.hidden = true;
}

let fireEdgeTrigger = false;
window.addEventListener("mousedown", (e) => {
  if (emote && (e.button === 0 || e.button === 2)) stopEmote();
  if (e.button === 0) { fireEdgeTrigger = true; setTimeout(() => fireEdgeTrigger = false, 16); }
});
els.touchFire.addEventListener("touchstart", () => { fireEdgeTrigger = true; setTimeout(() => fireEdgeTrigger = false, 16); });

/* The melee view model: raised whenever it's the held weapon, and swung
   through the pose MeleeState solves each frame — the same rest grip, chop
   and thrust as the Godot reference. A quick melee borrows the same mesh, so
   it pops in for the swing and drops out again the moment it's over. */
let meleeIdleT = 0;
let meleeLowerT = 0;

/* Phase 4 (DESIGN-ARMS.md): hit/whiff visual distinction. meleeConnect()
   sets one of these to 1 the instant it resolves a swing's single hit
   check; both decay here so a connect reads as a sharp stop-on-impact and
   a whiff reads as a slightly looser overextension, without adding new
   keyframes to SWING_TRACK/THRUST_TRACK — this only perturbs the sampled
   pose those tracks already produce. */
let meleeImpactT = 0;
let meleeWhiffT = 0;
const _meleeImpactEuler = new THREE.Euler();

function updateMeleeView(dt) {
  const mesh = activeMeleeMesh;
  const melee = player.melee;
  sawShake = 0;
  if (!mesh || !melee) return;

  const held = player.holding === "melee";
  const swinging = melee.busy;
  if (held || swinging) inspectArms.visible = false;   // the gun's showcase arms
  // Tossed hands go back on the sword the moment the toss isn't playing.
  if (!(inspectT > 0 && held && !swinging)) restoreMeleeHands(mesh);
  mesh.visible = held || swinging;
  const saber = mesh.userData.saber;
  if (saber && mesh.visible !== saberWasShown) {
    saberWasShown = mesh.visible;
    saber.snapOff();
    saberTrail?.clear();
    saberHavePrevTip = false;
    if (mesh.visible) { saber.ignite(); audio.saberIgnite(); }
    else { audio.saberHum(-1); audio.saberRetract(); }
  }
  // Only while the gun is what we hold: this used to re-show it every frame,
  // so it stayed on screen beside the streak tablet and marker.
  if (activeWeaponMesh) activeWeaponMesh.visible = player.holding === "gun" && !swinging;
  // Every melee weapon is held by the real arms now (gloves, or the black
  // rods), not the old white block hands. The saber lets go for its inspect.
  saberArmsOn = mesh.visible && player.alive && (!saber || inspectT <= 0);
  if (!saberArmsOn && saberArmsWere) { gloveRig.visible = false; pfArms.visible = false; }
  saberArmsWere = saberArmsOn;
  if (!mesh.visible) { meleeIdleT = 0; saberBlock.t = 0; return; }

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
    saberFlick = ps.flick * saberBlock.t;
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
    if (Math.abs(saberFlick) > 0.001) {
      // The wrist turn, in view space: on past the intercept, pushed out at
      // the round.
      mesh.quaternion.premultiply(_flickQ.setFromAxisAngle(_viewZ, saberFlick * turn * 0.6));
      mesh.quaternion.premultiply(_flickQ.setFromAxisAngle(_viewX, -Math.abs(saberFlick) * 0.25));
    }
    if (saberDeflectT > 0) {
      saberDeflectT = Math.max(0, saberDeflectT - dt * 7);
      mesh.position.z += saberDeflectT * 0.03;
    }
  }

  if (swinging) {
    // Impact: a brief sharp decel + tiny recoil-back, same idea as the
    // gun's viewKick* but scoped to melee. Whiff: the tracks' own
    // follow-through keyframe is allowed to overextend slightly further
    // than its authored end pose while this is decaying.
    meleeImpactT = Math.max(0, meleeImpactT - dt * 6);
    meleeWhiffT = Math.max(0, meleeWhiffT - dt * 4);
    if (meleeImpactT > 0) {
      mesh.position.z += meleeImpactT * 0.05;
      mesh.position.y -= meleeImpactT * 0.02;
    }
    if (meleeWhiffT > 0) {
      _meleeImpactEuler.set(0, 0, THREE.MathUtils.degToRad(meleeWhiffT * 6));
      mesh.quaternion.multiply(new THREE.Quaternion().setFromEuler(_meleeImpactEuler));
    }
  }

  if (!swinging) {
    const w = currentWeapon();
    // Walking/running bob, same phase source the gun view model rides
    // (w.bobPhase keeps advancing even while melee is the held weapon) —
    // without this the sword held dead still while sprinting read as
    // "glued to the screen" rather than carried.
    const moveBob = move.moving ? 0.018 : 0;
    mesh.position.x += Math.sin(w.bobPhase) * moveBob * 0.5;
    mesh.position.y -= Math.abs(Math.cos(w.bobPhase)) * moveBob;

    // Sprinting drops the blade out of guard the same way a sprinting gun
    // lowers out of the sight line.
    const wantLower = move.sprinting ? 1 : 0;
    meleeLowerT = damp(meleeLowerT, wantLower, 9, dt);
    mesh.position.y -= meleeLowerT * 0.1;
    mesh.position.z += meleeLowerT * 0.08;
    mesh.rotateX(meleeLowerT * 0.5);

    // Slow figure-eight breathing sway while fully idle, matching the
    // reference's idle animation — the walk bob above already covers
    // movement, so this only adds while standing still. Skipped while the
    // inspect flourish is playing so the two don't fight over the same
    // quaternion.
    if (!move.moving && inspectT <= 0) {
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
    } else if (move.moving) {
      meleeIdleT = 0;
    }

    // Toss-and-float flourish (D-pad up / T while holding the sword), see
    // applyMeleeInspect. Also lets tossed hands back onto the sword. The
    // Reaper's Grin has its own: shut, flick open, a knife trick.
    if (mesh.userData.kind === "reaper") applyReaperInspect(mesh);
    else if (mesh.userData.kind === "chainsaw") applySawRev(mesh);
    else applyMeleeInspect(mesh);
  }
  // The chainsaw revs: the engine shakes it (and, hard, the screen), the
  // chain speeds up, the throttle squeezes and the exhaust smokes.
  let rev = 0;
  if (mesh.userData.kind === "chainsaw") {
    if (swinging) {
      const t = melee.t;
      rev = chainsawRevAt(t);
      if (sawPrevT < 0.28 && t >= 0.28) audio.chainsawRip();
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
  mesh.userData.tick?.(dt, swinging, rev);

  if (saber) updateSaberFx(mesh, saber, swinging, dt);
  if (saberArmsOn) (saber ? poseSaberArms(mesh) : poseMeleeArms(mesh));
}
const MELEE_IDLE_PERIOD = 3.2;
const _meleeIdleEuler = new THREE.Euler();

/* Chainsaw rev (admire, T / D-pad up / the touch admire button): brought up
   in front of the face, bar tipped up, three throttle blips, the last one
   held, then back down. applySawRev leaves the throttle in sawInspectRev
   for updateMeleeView's shake, chain and smoke. */
const SAW_REV_TIME = 1.7;
const SAW_BLIPS = [[0.1, 0.28], [0.36, 0.52], [0.6, 0.9]];
let sawRevBlips = 0;
let sawInspectRev = 0;
let sawPrevT = 0;
let sawShake = 0;      // extra screen jitter (radians) while the saw is revving
const _sawQ = new THREE.Quaternion();
const _sawE = new THREE.Euler();
function applySawRev(mesh) {
  sawInspectRev = 0;
  if (inspectT <= 0) return;
  const k = 1 - inspectT / inspectDur;
  const lift = smooth01(Math.min(1, k / 0.12)) * (1 - smooth01(Math.max(0, (k - 0.9) / 0.1)));
  for (let i = 0; i < SAW_BLIPS.length; i++) {
    const [a, b] = SAW_BLIPS[i];
    if (k >= a && k < b) {
      const u = (k - a) / (b - a);
      sawInspectRev = Math.max(sawInspectRev, Math.min(1, u * 6) * (i === SAW_BLIPS.length - 1 ? 1 : 1 - u * 0.4));
      if (sawRevBlips <= i) { sawRevBlips = i + 1; i === SAW_BLIPS.length - 1 ? audio.chainsawRip() : audio.chainsawRev(); }
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

/* Streak device viewmodel (DESIGN-ARMS.md Phase 5). Simple raise/steady/
   lower — no swing state to fight over the pose the way melee has, so this
   is much shorter than updateMeleeView. `streakRaiseT` eases the device
   into its hold pose; sprinting lowers it the same way the gun/melee do.
   Whatever's in hand, the real sleeved arms (streakArms) hold it. */
let streakRaiseT = 0;
let streakSprintT = 0;
// Two-handed, centred and low, screen tipped up toward the eye — BO2's
// tablet hold. The old one-hand wrist unit sat half off the bottom right.
const TABLET_HOLD_POS = new THREE.Vector3(0, -0.098, -0.4);
const TABLET_TILT = -0.36;
const TABLET_PRESS_AT = 0.45;       // seconds into a UAV/gunship call the thumb goes down
// The K9 whistle: hand target in viewmodel space (fingers up and back into
// the mouth, so you see the back of it, knuckles forward), how long it is
// held, when the note starts.
const WHISTLE_HAND = [0.035, -0.1, -0.195];
const WHISTLE_ROT = [-0.3, Math.PI - 0.35, 0.3];
const WHISTLE_HOLD = 1.6;
const WHISTLE_BLOW_AT = 0.3;

function updateStreakView(dt) {
  const held = player.holding === "streak";
  const mesh = streakDeviceKind === "marker" ? activeMarkerMesh
    : streakDeviceKind === "drone" ? activeDroneMesh
    : streakDeviceKind === "whistle" ? null : activeStreakMesh;
  for (const m of [activeStreakMesh, activeMarkerMesh, activeDroneMesh]) m.visible = held && m === mesh;
  if (!held) { streakRaiseT = 0; streakSprintT = 0; hideStreakArms(); return; }
  inspectArms.visible = false;
  if (!player.alive) { finishStreakHold(); if (mesh) mesh.visible = false; hideStreakArms(); return; }
  if (streakHoldElapsed === 0) resetStreakArms();
  streakHoldElapsed += dt;

  // Up quickly, down a touch quicker; once it's down, the gun comes back.
  streakRaiseT = damp(streakRaiseT, streakLowering ? 0 : 1, streakLowering ? 11 : 8, dt);
  if (streakLowering && streakRaiseT < 0.05) { finishStreakHold(); if (mesh) mesh.visible = false; hideStreakArms(); return; }
  streakSprintT = damp(streakSprintT, move.sprinting ? 1 : 0, 8, dt);
  const e = streakRaiseT, off = 1 - e, s = streakSprintT;
  const t = performance.now() / 1000;
  const idleX = Math.sin(t * 1.3) * 0.003, idleY = Math.sin(t * 1.9) * 0.003;

  if (streakDeviceKind === "whistle") {
    // K9 call: the right hand comes up to the mouth, two fingers in, and
    // blows; the head tips back a touch with the breath, then it drops away.
    const blow = Math.max(0, Math.min(1, (streakHoldElapsed - WHISTLE_BLOW_AT) / 0.9));
    const push = Math.sin(blow * Math.PI);            // the breath swelling and fading
    const trill = blow > 0 && blow < 1 ? Math.sin(t * 38) * 0.0015 : 0;
    poseFreeArms({
      R: {
        pos: [WHISTLE_HAND[0] + off * 0.1 + idleX,
          WHISTLE_HAND[1] - off * 0.32 - s * 0.1 + idleY + push * 0.008 + trill,
          WHISTLE_HAND[2] + off * 0.06 + push * 0.01],
        rot: [WHISTLE_ROT[0] - off * 0.9, WHISTLE_ROT[1], WHISTLE_ROT[2] + off * 0.3],
        pose: "whistle",
      },
      L: null,
    });
    return;
  }

  if (streakDeviceKind === "marker") {
    // Held up by the shoulder, strobe blinking; the throw is a wind-back and
    // an overhand flick, then the hand is empty and follows through.
    activeMarkerMesh.userData.strobe.visible = (t * 2.5) % 1 < 0.2;
    let fx = 0, fy = 0, fz = 0, pitch = 0;
    if (markerThrowT > 0) {
      markerThrowT = Math.max(0, markerThrowT - dt);
      const k = 1 - markerThrowT / MARKER_THROW_TIME;
      if (k < 0.3) { const w = k / 0.3; fy = 0.05 * w; fz = 0.06 * w; pitch = -0.6 * w; }
      else if (k < 0.5) { const w = (k - 0.3) / 0.2; fy = 0.05 + 0.06 * w; fz = 0.06 - 0.32 * w; pitch = -0.6 + 1.6 * w; }
      else mesh.visible = false;   // it's gone; the empty hand drops away
    }
    mesh.scale.setScalar(0.6);
    mesh.position.set(0.15 + off * 0.08 + idleX, -0.15 - off * 0.3 - s * 0.12 + idleY + fy, -0.36 + off * 0.05 + fz);
    mesh.rotation.set(s * 0.4 + off * 0.8 + pitch, -0.3 - off * 0.3, s * 0.25 + off * 0.4 + 0.15);
    poseStreakArms(mesh.visible ? mesh : null, "wrap", dt, 0);
    return;
  }

  if (streakDeviceKind === "drone") {
    // Cradled out in front in both hands, rotors spinning up, then tossed up
    // and away; the hands follow through and drop out of view.
    const toss = Math.max(0, (streakHoldElapsed - DRONE_TOSS_AT + 0.15) / 0.3);
    for (const r of activeDroneMesh.userData.rotors || []) r.rotation.y += dt * 60 * Math.min(1, streakHoldElapsed / 0.5);
    mesh.position.set(0.02 + off * 0.1 + idleX, -0.16 - off * 0.3 + idleY + toss * toss * 0.5, -0.42 + off * 0.05 - toss * 0.3);
    mesh.rotation.set(-0.15 + off * 0.6 + toss * 0.4, 0.3 * off, off * 0.3);
    if (toss >= 1) mesh.visible = false;
    // Hands let go a moment into the toss, not once it's gone.
    poseStreakArms(toss > 0.35 ? null : mesh, "cup", dt, 0);
    if (pendingDroneLaunch && streakHoldElapsed >= DRONE_TOSS_AT) launchPendingDrone();
    return;
  }

  // Tablet: rises from low with both hands, screen tipping up to the eye,
  // then settles with a slight idle drift. A UAV/gunship call gets a right-
  // thumb press on CONFIRM and the page flips; the strike tablet just holds.
  const calling = ["uav", "counteruav", "vsat", "gunship", "k9", "warship", "swarm", "dragonfire", "samturret"].includes(streakScreen);
  const pk = calling ? (streakHoldElapsed - TABLET_PRESS_AT) / 0.22 : -1;
  const press = pk > 0 && pk < 1 ? Math.sin(pk * Math.PI) : 0;
  const confirmed = calling && pk >= 0.5;
  mesh.position.set(
    TABLET_HOLD_POS.x + idleX,
    TABLET_HOLD_POS.y - off * 0.3 - s * 0.1 + idleY - press * 0.006,
    TABLET_HOLD_POS.z + off * 0.06 + press * 0.004
  );
  mesh.rotation.set(TABLET_TILT + s * 0.35 - off * 0.6 + press * 0.05, off * 0.2, s * 0.2 + off * 0.25);
  if (tabletDive) {
    // The dive: the tablet comes up square to the eye as the view tips down
    // to it, then rushes into the lens until its screen is all there is.
    const k = tabletDiveK();
    const a = Math.min(1, k / DIVE_LOOK), b = Math.max(0, (k - DIVE_LOOK) / (1 - DIVE_LOOK));
    const ea = a * a * (3 - 2 * a), eb = b * b * b;
    mesh.position.x += (0 - mesh.position.x) * ea;
    mesh.position.y += (-0.05 - mesh.position.y) * ea + 0.05 * eb;
    mesh.position.z += (-0.34 - mesh.position.z) * ea + 0.3 * eb;
    mesh.rotation.x += (-0.02 - mesh.rotation.x) * ea;
    mesh.rotation.y *= 1 - ea;
    mesh.rotation.z *= 1 - ea;
  }
  drawTabletScreen(activeStreakMesh, streakScreen, streakHoldElapsed, confirmed);
  poseStreakArms(mesh, "side", dt, pk > 0 && pk < 1 ? pk : 0);
}

/* The arms that hold streak devices: real hands (hand-model.js — white,
   ink-outlined, jointed fingers) on a wrist/cuff/sleeve run to a shoulder
   below the screen. The hand is placed on the device's grip anchor per
   style — "side" hooks the fingers over a tablet edge, "cup" palms the
   drone from underneath, "wrap" closes a fist round the marker. Arm 0 is
   the right arm, arm 1 the left. */
const STREAK_SHOULDER = [new THREE.Vector3(0.27, -0.54, 0.1), new THREE.Vector3(-0.27, -0.54, 0.1)];
const streakArms = (() => {
  const root = new THREE.Group();
  root.visible = false;
  const mats = handMaterials();
  const unitCyl = (rTop, rBottom, mat) => {
    const g = new THREE.CylinderGeometry(rTop, rBottom, 1, 12);
    g.translate(0, 0.5, 0);
    return new THREE.Mesh(g, mat);
  };
  const arms = [];
  for (let i = 0; i < 2; i++) {
    const hand = buildHumanHand(i === 0 ? 1 : -1, mats);
    const wrist = unitCyl(0.02, 0.023, mats.skin);
    const cuff = unitCyl(0.033, 0.032, mats.cuff);
    const sleeve = unitCyl(0.042, 0.032, mats.sleeve);
    inkOutline(cuff);
    root.add(hand, wrist, cuff, sleeve);
    arms.push({ hand, wrist, cuff, sleeve, free: false, attached: false, vel: new THREE.Vector3() });
  }
  // Gloves off: the Phantom Forces black rods (see pfArms), tip on the grip.
  const rodMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
  for (const arm of arms) {
    const g = new THREE.CylinderGeometry(0.013, 0.034, 1, 10);
    g.translate(0, 0.5, 0);
    arm.rod = new THREE.Mesh(g, rodMat);
    arm.rod.renderOrder = -1;
    arm.rod.visible = false;
    root.add(arm.rod);
  }
  root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  root.userData.arms = arms;
  return root;
})();
weaponRig.add(streakArms);

/* With Settings > Gloves on, the streak devices are held in the same
   tactical gloves and sleeves as the guns (user: the white hands didn't
   match). A pair of their own, posed off the placed white hand (the glove
   rig shares hand-model.js's frame), sleeve run to the streak shoulders. */
let streakGloves = null;
Promise.all([buildGlove(1, weaponEnvTex), buildGlove(-1, weaponEnvTex)]).then((g) => {
  if (!g[0] || !g[1]) return;
  streakGloves = g;
  for (const h of g) {
    h.root.visible = h.sleeve.visible = false;
    streakArms.add(h.root, h.sleeve);
  }
});

/* Swap arm i's white hand for its glove when gloves are on. True if the
   glove took over (the white hand, wrist, cuff and sleeve are hidden). */
function dressStreakArm(arm, i, show, pose, thumb = 0) {
  const g = streakGloves?.[i];
  const on = !!g && glovesOn() && show;
  if (g) g.root.visible = g.sleeve.visible = on;
  if (!on) return false;
  arm.hand.visible = arm.wrist.visible = arm.cuff.visible = arm.sleeve.visible = false;
  g.root.position.copy(arm.hand.position);
  g.root.quaternion.copy(arm.hand.quaternion);
  poseGlove(g, pose, thumb);
  layGloveSleeve(g, STREAK_SHOULDER[i]);
  return true;
}

function hideStreakArms() {
  streakArms.visible = false;
  for (const arm of streakArms.userData.arms) arm.rod.visible = false;
}

/* New hold: both hands start attached again. */
function resetStreakArms() {
  for (const arm of streakArms.userData.arms) { arm.free = false; arm.attached = false; arm.vel.set(0, 0, 0); }
}

/* Put the hands on `mesh`'s grip anchors and run each arm down to its
   shoulder. `mesh` null means the hands have let go (a toss/throw): each
   keeps the momentum it had and falls away below the screen. A one-handed
   device (the marker) has no left anchor, so that arm stays down. `tap` is
   0..1 through the CONFIRM press (the right index taps the bezel). */
const _armPrev = new THREE.Vector3();
const _wristAt = new THREE.Vector3();
function poseStreakArms(mesh, style, dt, tap) {
  streakArms.visible = true;
  const anchors = mesh?.userData.anchors || null;
  if (mesh) mesh.updateMatrixWorld(true);
  const arms = streakArms.userData.arms;
  for (let i = 0; i < arms.length; i++) {
    const arm = arms[i];
    const anchor = anchors ? (i === 0 ? anchors.right : anchors.left) : null;
    let show;
    if (anchor && !arm.free) {
      _armPrev.copy(arm.hand.position);
      placeHand(arm.hand, anchor, style, i === 0 ? 1 : -1, i === 0 ? tap : 0);
      // Remember how the hand was moving, for the follow-through if it lets go.
      if (dt > 0 && arm.attached) arm.vel.subVectors(arm.hand.position, _armPrev).divideScalar(dt);
      if (arm.vel.lengthSq() > 9) arm.vel.setLength(3);
      arm.attached = true;
      show = true;
    } else if (arm.attached) {
      // Let go: fingers open, coast on, then drop out of view.
      arm.free = true;
      poseHumanHand(arm.hand, "relaxed");
      arm.vel.multiplyScalar(Math.max(0, 1 - dt * 6));
      arm.vel.y -= dt * 3.2;
      arm.hand.position.addScaledVector(arm.vel, dt);
      show = arm.hand.position.y > -0.5;
    } else {
      show = false;
    }
    arm.hand.visible = arm.wrist.visible = arm.cuff.visible = arm.sleeve.visible = show;
    arm.rod.visible = false;
    const pose = arm.free ? "relaxed" : HAND_GRIPS[style]?.pose || "relaxed";
    if (dressStreakArm(arm, i, show, pose, i === 0 ? tap : 0) || !show) continue;
    // Gloves off is the PF look everywhere: no hands, the rod's tip holds it.
    // (The white hand stays posed, invisibly, as the grip point.)
    arm.hand.visible = arm.wrist.visible = arm.cuff.visible = arm.sleeve.visible = false;
    arm.rod.visible = true;
    stretchBetween(arm.rod, STREAK_SHOULDER[i], streakRodTip(arm, anchor, style, i));
  }
}

/* Where a gloves-off rod ends. On the tablet the palm centre sits outside
   the edge, so the rod goes to the edge itself, low on the side; elsewhere
   (and once a hand has let go) the placed hand is the spot. */
const STREAK_ROD_TIP = { side: new THREE.Vector3(0.006, -0.05, -0.004) };
const _rodTip = new THREE.Vector3();
const _rodQ = new THREE.Quaternion();
function streakRodTip(arm, anchor, style, i) {
  const off = STREAK_ROD_TIP[style];
  if (!off || !anchor || arm.free) return arm.hand.position;
  anchor.getWorldPosition(_rodTip);
  anchor.getWorldQuaternion(_rodQ);
  return _rodTip.add(_armDir.set(off.x * (i === 0 ? 1 : -1), off.y, off.z).applyQuaternion(_rodQ));
}

/* hand -> wrist -> cuff -> sleeve, all along the line to the shoulder. */
function layStreakArm(arm, i) {
  const shoulder = STREAK_SHOULDER[i];
  handWrist(arm.hand, _wristAt);
  _armDir.subVectors(shoulder, _wristAt).normalize();
  _armFrom.copy(_wristAt).addScaledVector(_armDir, -0.012);
  _armTo.copy(_wristAt).addScaledVector(_armDir, 0.04);
  stretchBetween(arm.wrist, _armFrom, _armTo);
  _armFrom.copy(_armTo);
  _armTo.copy(_wristAt).addScaledVector(_armDir, 0.065);
  stretchBetween(arm.cuff, _armFrom, _armTo);
  stretchBetween(arm.sleeve, _armTo, shoulder);
}

/* A first-person emote (emotes.js `fp`): the gun goes away (or does the
   trick), and the streak arms' real hands act it out in front of the camera.
   Runs after updateWeaponView, so it has the last word on the viewmodel. */
let fpEmoteArmsOn = false;
function updateFpEmoteView() {
  const f = fpEmoteFrame();
  if (!f) {
    if (fpEmoteArmsOn) { hideStreakArms(); fpEmoteArmsOn = false; }
    return;
  }
  inspectArms.visible = false;
  if (activeMeleeMesh) activeMeleeMesh.visible = false;
  // The gun is put away: so are the arms that hold it (PF rods or gloves),
  // or they hang in view as a second pair beside the emote hands.
  if (!f.gun) { pfArms.visible = false; gloveRig.visible = false; }
  if (activeWeaponMesh) {
    activeWeaponMesh.visible = !!f.gun && player.holding === "gun";
    if (f.gun) {
      activeWeaponMesh.position.y += f.gun.lift || 0;
      activeWeaponMesh.rotateZ(f.gun.spin || 0);
    }
  }
  fpEmoteArmsOn = true;
  poseFreeArms(f);
}

/* Both streak arms placed straight from hand targets in viewmodel space
   ({R, L}: {pos, rot, pose} or null), not off a device's grip anchors: the
   first-person emotes and the K9 whistle. */
function poseFreeArms(f) {
  streakArms.visible = true;
  const arms = streakArms.userData.arms;
  ["R", "L"].forEach((k, i) => {
    const arm = arms[i], h = f[k];
    arm.rod.visible = false;
    arm.hand.visible = arm.wrist.visible = arm.cuff.visible = arm.sleeve.visible = !!h;
    if (!h) { dressStreakArm(arm, i, false); return; }
    arm.hand.position.set(h.pos[0], h.pos[1], h.pos[2]);
    arm.hand.rotation.set(h.rot[0], h.rot[1], h.rot[2], "YXZ");
    poseHumanHand(arm.hand, h.pose);
    if (dressStreakArm(arm, i, true, h.pose)) return;
    // Gloves off: the black rods act the emote out, no fingers at all (user:
    // "it makes it even funnier"). The white hand stays posed, unseen, as the
    // point the rod reaches for.
    arm.hand.visible = arm.wrist.visible = arm.cuff.visible = arm.sleeve.visible = false;
    arm.rod.visible = true;
    stretchBetween(arm.rod, STREAK_SHOULDER[i], arm.hand.position);
  });
}

let weaponLowerT = 0;

/* Phase 2 (DESIGN-ARMS.md §5): landing-impact dip. `move.justLanded`/
   `landSpeed` (movement.js) already exist and were unused before this —
   a one-frame edge the viewmodel converts into a decaying impulse rather
   than a fixed-length animation, so a light hop and a hard fall from a
   vault both settle at their own natural rate. */
let landDipT = 0;      // 0..1, decays via damp() back to 0 each frame
let landDipMag = 0;    // captured strength of the current dip, set once on the landing frame
const LAND_DIP_MAX_SPEED = 9;   // landSpeed at/above this reads as "full" impact
const LAND_DIP_POS = 0.05;      // meters of downward dip at full impact
const LAND_DIP_PITCH = 0.16;    // radians of forward tilt at full impact

/* Phase 2: sprint transition polish. weaponLowerT already handles the
   flat lower; this adds the "sling to the side" roll on the way out and
   lets the return overshoot slightly before settling, scaled by weapon
   weight so a heavy gun swings wider than a pistol. */
let sprintRollT = 0;

/* Phase 2: start/stop settling. bobPhase (weapons.js) freezes rather than
   resetting when movement stops, which already avoids a snap-to-zero, but
   the amplitude itself still cuts instantly from full to whatever the
   frozen phase happens to be. This eases the amplitude multiplier instead,
   so stopping reads as the weapon settling rather than the bob motion just
   stopping mid-swing. */
let bobSettleT = 0;
// Turn lag: last frame's look angles and the smoothed lag offsets.
let lastLookYaw = 0, lastLookPitch = 0, turnLagX = 0, turnLagY = 0;
let slideTiltT = 0;   // camera roll while sliding, eased in and out

/* Phase 2: ADS transition weight. `w.adsT` (weapons.js) ramps linearly at
   a fixed rate and drives FOV/laser-threshold/etc elsewhere, so it isn't
   safe to reshape directly. Instead this is a damped shadow of it, lagging
   behind exactly like swaySmoothX/Y already lag behind raw sway — used
   only for the hip<->ADS position lerp, so heavier guns settle into their
   sight picture instead of snapping there linearly. */
let adsSmoothT = 0;

/* Weapon inspect (D-pad up / T). Admires whatever's in hand — pure
   flourish, cancelled by anything that matters (firing, aiming, reloading,
   sprinting, swinging) so it can never cost you a fight.

   Long guns get a proper showcase: both hands bring the gun up to the
   middle of the screen side-on (left side, muzzle left, the whole gun
   visible edge to edge), a wrist twist turns it round to the right side,
   then it goes back to the hip. Skins are authored so the right side reads
   correctly too (see the sides formula in HANDOFF.md), so this is the
   moment a skin gets seen in full. Sidearms keep their quick twirl. The
   Keyboard Warrior gets tossed: it flips up out of the hands, floats in
   front of the camera keys-out with the RGB running, then drops back into
   the catch. */
const GUN_INSPECT_TIME = 4.2;
const SIDEARM_INSPECT_TIME = 2.2;
const MELEE_INSPECT_TIME = 3.6;
let inspectT = 0;
let inspectDur = GUN_INSPECT_TIME;
let inspectFreeze = null;   // test hook: pin the animation at one t

function isLongGunInspect(w) { return w.def.cls !== "sidearm"; }

function startInspect() {
  if (inspectT > 0 || !player.alive || gameState !== "playing" || move.busy) return;
  if (player.holding === "gun") {
    const w = currentWeapon();
    if (w.reloading || w.adsT > 0.05) return;
    inspectDur = isLongGunInspect(w) ? GUN_INSPECT_TIME : SIDEARM_INSPECT_TIME;
  } else if (player.holding === "melee") {
    if (!player.melee || player.melee.busy) return;
    inspectDur = player.melee.chainsaw ? SAW_REV_TIME : MELEE_INSPECT_TIME;
  } else {
    return;
  }
  inspectT = inspectDur;
  sawRevBlips = 0;
  // Admiring the chainsaw revs it instead (applySawRev plays the blips).
  if (player.holding !== "melee" || !player.melee.chainsaw) audio.reload();     // the same handling clicks, which is what an inspect is
}

function updateInspect(dt) {
  if (inspectT <= 0) { inspectArms.visible = false; return; }
  // Anything that matters takes the weapon back immediately.
  // Sprinting does NOT cancel it: PF lets you admire the gun on the run.
  if (!player.alive || move.busy) { inspectT = 0; return; }
  if (player.holding === "gun") {
    const w = currentWeapon();
    if (w.reloading || w.adsT > 0.05) { inspectT = 0; return; }
  } else if (player.holding === "melee") {
    if (!player.melee || player.melee.busy) { inspectT = 0; return; }
  } else {
    inspectT = 0;
    return;
  }
  if (inspectFreeze != null) { inspectT = Math.max(1e-4, (1 - inspectFreeze) * inspectDur); return; }
  inspectT = Math.max(0, inspectT - dt);
}

function inspectProgress() { return inspectT > 0 ? 1 - inspectT / inspectDur : 0; }

// stage()/rise() now live in anim-curves.js, imported above.

/* Keyframe track: rows of [t, v1, v2, ...] with t rising 0..1. Sampled as a
   cubic Hermite with Catmull-Rom tangents, so the motion flows through the
   keys instead of stopping on each one, and eases in/out at the two ends. */
function sampleKeys(keys, t, out) {
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const k1 = keys[i], k2 = keys[i + 1];
  const k0 = keys[i - 1], k3 = keys[i + 2];
  const span = k2[0] - k1[0];
  const u = Math.max(0, Math.min(1, (t - k1[0]) / span));
  const u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  for (let j = 1; j < k1.length; j++) {
    const m1 = k0 ? (k2[j] - k0[j]) / (k2[0] - k0[0]) * span : 0;
    const m2 = k3 ? (k3[j] - k1[j]) / (k3[0] - k1[0]) * span : 0;
    out[j - 1] = h00 * k1[j] + h10 * m1 + h01 * k2[j] + h11 * m2;
  }
  return out;
}

/* Where the model's middle is and how long it is, in its own space, hands
   left out. Measured once per built mesh: the pivot of every view model is
   its grip, and a side-on gun spun about its grip swings half off screen. */
function inspectBounds(mesh) {
  if (mesh.userData.inspectBounds) return mesh.userData.inspectBounds;
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  const m = new THREE.Matrix4();
  const inv = new THREE.Matrix4();
  mesh.updateWorldMatrix(true, true);
  inv.copy(mesh.matrixWorld).invert();
  mesh.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    for (let p = o; p && p !== mesh; p = p.parent) if (p.userData.hand) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    m.multiplyMatrices(inv, o.matrixWorld);
    tmp.copy(o.geometry.boundingBox).applyMatrix4(m);
    box.union(tmp);
  });
  const size = box.getSize(new THREE.Vector3());
  const bounds = { center: box.getCenter(new THREE.Vector3()), len: Math.max(size.x, size.y, size.z) };
  mesh.userData.inspectBounds = bounds;
  return bounds;
}

/* How far in front of the camera a model of this length has to sit to fill
   `frac` of the screen width. Aspect-aware, so a 4:3 iPad and a 21:9
   monitor both see the whole gun. */
function inspectDistance(len, frac) {
  const halfH = Math.tan(THREE.MathUtils.degToRad(weaponCamera.fov / 2));
  const halfW = halfH * Math.max(0.5, weaponCamera.aspect);
  return THREE.MathUtils.clamp((len / 2) / (frac * halfW), 0.42, 1.4);
}

/* Pistol: a one-handed showman's twirl around the trigger guard. Additive,
   on top of the normal hip pose. */
const _inspectPose = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 };
function _zeroPose(p) { p.x = p.y = p.z = p.pitch = p.yaw = p.roll = 0; return p; }
function inspectTwirl(t, p) {
  const overallEase = Math.sin(Math.min(1, t / 0.1) * Math.PI / 2)
    * Math.sin(Math.min(1, (1 - t) / 0.15) * Math.PI / 2);
  const spins = 1.5; // full turns
  p.roll = Math.sin(t * Math.PI * 2 * spins) * overallEase * 0.9;
  p.yaw = overallEase * Math.sin(t * Math.PI * 2 * spins + 0.6) * 0.22;
  p.pitch = overallEase * 0.1;
  p.x = overallEase * -0.02;
  p.y = overallEase * 0.03;
  p.z = overallEase * 0.06;
}

function inspectPose() {
  const p = _inspectPose;
  if (inspectT <= 0 || player.holding !== "gun") return _zeroPose(p);
  const w = currentWeapon();
  if (isLongGunInspect(w)) return _zeroPose(p);   // applyGunInspect owns it
  inspectTwirl(inspectProgress(), p);
  return p;
}

/* Long-gun showcase keys: [t, yaw°, twist°, tilt°, x, y, dz].
   yaw   +90 = muzzle left, left side to camera; -90 = muzzle right.
   twist roll about the barrel; toward the camera shows the top of the gun.
   tilt  muzzle up, in the screen plane.
   x/y   where the middle of the gun sits (camera space); dz pushes it back.
   Beats: bring up (0-.16), admire the left side with a slow drift (.16-.44),
   wrist twist through muzzle-away (.44-.62), admire the right side
   (.62-.86), back to the hip (.86-1). */
const GUN_INSPECT_KEYS = [
  [0.00,  58,  26, -10,  0.07, -0.13, 0.08],
  [0.16,  84,  15,   4,  0.00, -0.035, 0],
  [0.30,  79,   9,   6, -0.012, -0.028, 0],
  [0.44,  87,  17,   2,  0.004, -0.04, 0],
  [0.53,  28, -30,  -2,  0.00, -0.015, 0.07],
  [0.62, -84, -15,   4,  0.00, -0.035, 0],
  [0.74, -79,  -9,   6,  0.012, -0.028, 0],
  [0.86, -87, -17,   2, -0.004, -0.04, 0],
  [1.00, -48, -26, -10,  0.09, -0.14, 0.08],
];
const _gunKey = new Array(6).fill(0);
const _qTilt = new THREE.Quaternion();
const _qYaw = new THREE.Quaternion();
const _qTwist = new THREE.Quaternion();
const _qInspect = new THREE.Quaternion();
const _vInspect = new THREE.Vector3();
const _vCenter = new THREE.Vector3();
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

/* Runs after the normal gun pose is set, and blends from it to the
   showcase pose, so sway/bob hand over smoothly at both ends. */
function applyGunInspect(mesh, w) {
  const long = inspectT > 0 && player.holding === "gun" && isLongGunInspect(w);
  const t = long ? inspectProgress() : 0;
  const blend = long ? rise(t, 0, 0.14) * (1 - rise(t, 0.86, 1)) : 0;
  // Gloves or rods, the arms stay on the gun through the inspect (user:
  // no white hands anywhere; the old showcase arms are retired).
  inspectArms.visible = false;
  if (blend <= 0) return;

  const [yaw, twist, tilt, x, y, dz] = sampleKeys(GUN_INSPECT_KEYS, t, _gunKey);
  const yawR = THREE.MathUtils.degToRad(yaw);
  // Muzzle-up is a different screen rotation depending on which way the
  // muzzle points; sin(yaw) carries it smoothly through the turn.
  _qTilt.setFromAxisAngle(AXIS_Z, -THREE.MathUtils.degToRad(tilt) * Math.sin(yawR));
  _qYaw.setFromAxisAngle(AXIS_Y, yawR);
  _qTwist.setFromAxisAngle(AXIS_Z, THREE.MathUtils.degToRad(twist));
  _qInspect.copy(_qTilt).multiply(_qYaw).multiply(_qTwist);

  const { center, len } = inspectBounds(mesh);
  const d = inspectDistance(len, 0.72) + dz;
  _vCenter.copy(center).applyQuaternion(_qInspect);
  _vInspect.set(x, y, -d).sub(_vCenter);

  mesh.position.lerp(_vInspect, blend);
  mesh.quaternion.slerp(_qInspect, blend);
  if (inspectArms.visible) poseInspectArms(mesh, Math.sin(yawR));
}

/* Both hands on the gun for the showcase. The block hands built onto every
   gun stay hidden (user call: the gun reads clean day to day, and they sat
   on the skin art); these are real arms instead, a sleeve from a shoulder
   below the screen to a fist on the grip and one under the handguard, so
   whichever side of the gun is showing, the arms come from the player. The
   built hands are still used, invisibly, as the anchors for where the
   fists go. */
/* Shoulders sit below the screen. Which one feeds which fist follows the
   gun: muzzle left, the trigger hand is on the right of the screen and gets
   the right arm; muzzle right, it swaps, so the arms never cross into an X.
   `side` is sin(yaw), so the swap sweeps smoothly through the twist. */
const INSPECT_SHOULDER_X = 0.28;
const _shoulder = new THREE.Vector3();
const INSPECT_SUPPORT_DROP = 0.095;  // under the handguard, not on top of the art
const inspectArms = (() => {
  const root = new THREE.Group();
  root.visible = false;
  // White hands, black sleeves, ink outlines — the trollface look (hand-model.js).
  const { sleeve: sleeveMat, cuff: cuffMat, skin: skinMat, shade: knuckleMat } = handMaterials();
  // Unit cylinders standing on y=0, stretched between two points per frame.
  const unitCyl = (rTop, rBottom, mat) => {
    const g = new THREE.CylinderGeometry(rTop, rBottom, 1, 10);
    g.translate(0, 0.5, 0);
    return new THREE.Mesh(g, mat);
  };
  const box = (w, h, d, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
  };
  const arms = [];
  for (let i = 0; i < 2; i++) {
    const fist = new THREE.Group();
    if (i === 0) {
      // Trigger hand: wraps a near-vertical pistol grip (grip runs along
      // the fist's Y), knuckles forward toward the muzzle (-Z).
      fist.add(box(0.064, 0.078, 0.056, skinMat, 0, -0.004, 0.006));
      for (let k = 0; k < 4; k++) fist.add(box(0.068, 0.017, 0.02, knuckleMat, 0, 0.026 - k * 0.02, -0.026));
      fist.add(box(0.02, 0.05, 0.03, skinMat, 0.03, 0.03, -0.012));   // thumb over the top
    } else {
      // Support hand: cups the handguard from underneath, fingers curling
      // up both sides so a finger row shows whichever side faces camera.
      fist.add(box(0.062, 0.03, 0.1, skinMat, 0, -0.012, 0));
      for (const sx of [-1, 1]) {
        for (let k = 0; k < 4; k++) fist.add(box(0.012, 0.034, 0.02, knuckleMat, sx * 0.035, 0.012, -0.036 + k * 0.024));
      }
    }
    const wrist = unitCyl(0.022, 0.026, skinMat);
    const cuff = unitCyl(0.037, 0.035, cuffMat);
    const sleeve = unitCyl(0.044, 0.032, sleeveMat);
    inkOutline(fist);
    inkOutline(cuff);
    root.add(fist, wrist, cuff, sleeve);
    arms.push({ fist, wrist, cuff, sleeve });
  }
  root.userData.arms = arms;
  return root;
})();
weaponRig.add(inspectArms);

const _armFrom = new THREE.Vector3();
const _armTo = new THREE.Vector3();
const _armDir = new THREE.Vector3();
const _armUp = new THREE.Vector3(0, 1, 0);
function stretchBetween(obj, from, to) {
  _armDir.subVectors(to, from);
  const len = _armDir.length();
  obj.position.copy(from);
  obj.quaternion.setFromUnitVectors(_armUp, _armDir.multiplyScalar(1 / Math.max(1e-5, len)));
  obj.scale.set(1, len, 1);
}

function poseInspectArms(mesh, side) {
  mesh.updateMatrixWorld(true);
  const anchors = mesh.children.filter((o) => o.userData.hand);
  const arms = inspectArms.userData.arms;
  for (let i = 0; i < arms.length; i++) {
    const arm = arms[i];
    const anchor = anchors[i];
    arm.fist.visible = arm.wrist.visible = arm.cuff.visible = arm.sleeve.visible = !!anchor;
    if (!anchor) continue;
    anchor.getWorldPosition(arm.fist.position);
    anchor.getWorldQuaternion(arm.fist.quaternion);
    if (i === 1) {
      // Down from the rail-top anchor to underneath, in the gun's own up.
      _armDir.set(0, -INSPECT_SUPPORT_DROP, 0).applyQuaternion(mesh.quaternion);
      arm.fist.position.add(_armDir);
    }
    const shoulder = _shoulder.set((i === 0 ? 1 : -1) * INSPECT_SHOULDER_X * side, -0.51, 0.11);
    // fist -> wrist -> cuff -> sleeve, all along the line to the shoulder.
    _armDir.subVectors(shoulder, arm.fist.position).normalize();
    _armFrom.copy(arm.fist.position).addScaledVector(_armDir, 0.03);
    _armTo.copy(arm.fist.position).addScaledVector(_armDir, 0.075);
    stretchBetween(arm.wrist, _armFrom, _armTo);
    _armFrom.copy(_armTo);
    _armTo.copy(arm.fist.position).addScaledVector(_armDir, 0.1);
    stretchBetween(arm.cuff, _armFrom, _armTo);
    stretchBetween(arm.sleeve, _armTo, shoulder);
  }
}

/* Phantom Forces arms (user's PF reference clip, 2026-09-27): no hands at
   all, just two thin black rods rising from below the screen, and the tip
   of each rod IS the hand. The right rod ends on the pistol grip, the left
   under the handguard (or on the magazine while reloading). Unlit black, so
   they read as silhouettes and never sit on the skin art the way the block
   hands did. The built hand meshes stay hidden; they're only the anchors. */
const PF_ARM_SHOULDER = [new THREE.Vector3(0.36, -0.66, 0.02), new THREE.Vector3(-0.06, -0.7, -0.06)];
const PF_SUPPORT_DROP = 0.085;   // from the rail-top support anchor to under the handguard
const pfArms = (() => {
  const root = new THREE.Group();
  root.visible = false;
  const mat = new THREE.MeshBasicMaterial({ color: 0x050505 });
  const rods = [];
  for (let i = 0; i < 2; i++) {
    // A unit rod standing on y=0: blunt taper to the tip (the "hand"),
    // thicker toward the shoulder, stretched between two points per frame.
    const g = new THREE.CylinderGeometry(0.013, 0.034, 1, 10);
    g.translate(0, 0.5, 0);
    const rod = new THREE.Mesh(g, mat);
    rod.renderOrder = -1;
    root.add(rod);
    rods.push(rod);
  }
  root.userData.rods = rods;
  return root;
})();
weaponRig.add(pfArms);

/* Tactical gloves (glove-model.js): once they've loaded they replace the
   black rods: the right glove wraps the pistol grip with the index on the
   trigger, the left cups the handguard from below (or fists a vertical
   foregrip: mesh.userData.supportStyle), and each wears a jacket sleeve
   running off screen to the same shoulder points the rods used. */
const gloveRig = new THREE.Group();
gloveRig.visible = false;
weaponRig.add(gloveRig);
let gloves = null;
/* Settings → Gloves. Off is the Phantom Forces look from before: black rod
   arms, the old hip framing, the white showcase arms on inspect. */
const glovesOn = () => !!gloves && settings.gloves !== false;
Promise.all([buildGlove(1, weaponEnvTex), buildGlove(-1, weaponEnvTex)]).then((g) => {
  if (!g[0] || !g[1]) return;
  gloves = g;
  for (const h of g) gloveRig.add(h.root, h.sleeve);
});
const basisQ = (x, y, z) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
  new THREE.Vector3(...x), new THREE.Vector3(...y), new THREE.Vector3(...z)));
// Hand frames in the gun's frame (hand: fingers -Z, back +Y, thumb -X on
// the right hand; the mirrored left hand's thumb is on +X).
const GLOVE_GRIP_Q = basisQ([0, -1, 0], [1, 0, 0], [0, 0, 1]);      // right: back of hand out right, thumb up the grip
const GLOVE_SUPPORT_Q = basisQ([0, 0, -1], [0, -1, 0], [-1, 0, 0]); // left: palm up under the handguard, thumb forward
const GLOVE_FOREGRIP_Q = basisQ([0, 1, 0], [-1, 0, 0], [0, 0, 1]);  // left: fist round a vertical grip, thumb up
// Left, C-clamp on the handguard's side: back of the hand out toward the
// camera, fingers forward and a little up, thumb over the top, wrist back
// and down (a hand cupped underneath is invisible from a first-person eye).
const GLOVE_CCLAMP_Q = basisQ([0, 0.92, 0.4], [-1, 0, 0], [0, -0.4, 0.92]);
const GLOVE_CCLAMP_OFF = new THREE.Vector3(-0.034, 0.028, 0.04);
const GLOVE_GRIP_OFF = new THREE.Vector3(0.03, -0.012, 0.006);      // palm centre from the grip anchor, in its frame
const GLOVE_SUPPORT_OFF = new THREE.Vector3(0, -0.014, 0.004);
const GLOVE_FOREGRIP_OFF = new THREE.Vector3(-0.03, 0.0, 0.004);
const GLOVE_SLEEVE_LEN = 0.37;
const _gloveQ = new THREE.Quaternion();
const _gloveOff = new THREE.Vector3();
const _gloveDir = new THREE.Vector3();
const _gloveZ = new THREE.Vector3(0, 0, 1);
const _gloveRigQ = new THREE.Quaternion();

function placeGlove(g, i, mesh, anchor, tip, sidearm, magBlend = 0) {
  // During a mag swap the left hand holds the mag (palm under it).
  const style = i === 0 ? "grip" : sidearm || magBlend > 0.35 ? "support" : (mesh.userData.supportStyle || "cclamp");
  if (style === "grip") {
    anchor.getWorldQuaternion(_gloveQ);
    g.root.quaternion.copy(_gloveQ).multiply(GLOVE_GRIP_Q);
    _gloveOff.copy(GLOVE_GRIP_OFF).applyQuaternion(_gloveQ);
    poseGlove(g, "trigger");
  } else if (style === "cclamp") {
    g.root.quaternion.copy(mesh.quaternion).multiply(GLOVE_CCLAMP_Q);
    _gloveOff.copy(GLOVE_CCLAMP_OFF).applyQuaternion(mesh.quaternion);
    poseGlove(g, "support");
  } else if (style === "foregrip") {
    g.root.quaternion.copy(mesh.quaternion).multiply(GLOVE_FOREGRIP_Q);
    _gloveOff.copy(GLOVE_FOREGRIP_OFF).applyQuaternion(mesh.quaternion);
    poseGlove(g, "foregrip");
  } else {
    g.root.quaternion.copy(mesh.quaternion).multiply(GLOVE_SUPPORT_Q);
    _gloveOff.copy(GLOVE_SUPPORT_OFF).applyQuaternion(mesh.quaternion);
    poseGlove(g, "support");
  }
  finishGlove(g, i, tip);
}

/* The glove at `tip` + _gloveOff (world space, root quaternion already set
   in world space), brought into gloveRig's frame, with its sleeve run to
   the shoulder. */
function finishGlove(g, i, tip) {
  // Anchors are read in world space; the gloves live under gloveRig, so
  // bring the pose into its frame (identity in play, not in debug shots).
  g.root.position.copy(tip).add(_gloveOff);
  gloveRig.updateMatrixWorld();
  gloveRig.worldToLocal(g.root.position);
  g.root.quaternion.premultiply(gloveRig.getWorldQuaternion(_gloveRigQ).invert());
  layGloveSleeve(g, PF_ARM_SHOULDER[i]);
}

/* Sleeve: from the wrist to the shoulder, stretched only if it has to be. */
function layGloveSleeve(g, shoulder) {
  const wrist = gloveWrist(g);
  _gloveDir.subVectors(shoulder, wrist);
  const len = _gloveDir.length();
  g.sleeve.position.copy(wrist);
  g.sleeve.quaternion.setFromUnitVectors(_gloveZ, _gloveDir.multiplyScalar(1 / Math.max(1e-5, len)));
  g.sleeve.scale.set(1, 1, Math.max(1, len / GLOVE_SLEEVE_LEN));
}

/* Trollsaber: held like a saber, two fists round the hilt, right hand up
   by the clamp, left down by the pommel. Each hand's frame is built from
   the hilt axis and the way to its shoulder, so the fists stay wrapped on
   and the forearms run back to the body through every swing and the
   guard. Gloves off: the black rods run to the same two spots. */
let saberArmsOn = false;
let saberArmsWere = false;
const SABER_HAND_Z = [0.045, 0.104];                 // along the hilt (gear.js grip at 0)
const SABER_GLOVE_OFF = [new THREE.Vector3(0.036, -0.010, 0.006), new THREE.Vector3(-0.036, 0.0, 0.006)];
const _saP = new THREE.Vector3();
const _saA = new THREE.Vector3();
const _saT = new THREE.Vector3();
const _saX = new THREE.Vector3();
const _saQ = new THREE.Quaternion();
const _saM = new THREE.Matrix4();
function poseSaberArms(mesh) {
  const gl = glovesOn();
  pfArms.visible = !gl;
  gloveRig.visible = gl;
  showBothGloves();
  mesh.updateMatrixWorld(true);
  mesh.getWorldQuaternion(_saQ);
  _saA.set(0, 0, -1).applyQuaternion(_saQ);          // up the blade
  const rods = pfArms.userData.rods;
  for (let i = 0; i < 2; i++) {
    _saP.set(0, 0, SABER_HAND_Z[i]);
    mesh.localToWorld(_saP);
    if (!gl) {
      rods[i].visible = true;
      stretchBetween(rods[i], PF_ARM_SHOULDER[i], _saP);
      continue;
    }
    // wrist side (the gun frame's +Z) toward the shoulder, square to the hilt
    _saT.subVectors(PF_ARM_SHOULDER[i], _saP);
    _saT.addScaledVector(_saA, -_saA.dot(_saT)).normalize();
    _saX.crossVectors(_saA, _saT);
    _saM.makeBasis(_saX, _saA, _saT);
    const g = gloves[i];
    g.root.quaternion.setFromRotationMatrix(_saM);
    _gloveOff.copy(SABER_GLOVE_OFF[i]).applyQuaternion(g.root.quaternion);
    g.root.quaternion.multiply(i === 0 ? GLOVE_GRIP_Q : GLOVE_FOREGRIP_Q);
    poseGlove(g, "foregrip");
    finishGlove(g, i, _saP);
  }
}

/* The other melee weapons (Keyboard Warrior, Chainsaw, Reaper's Grin): their
   built block hands stay as invisible grip points (they still get tossed
   and caught by the keyboard's inspect, so the arms follow), and the gloves
   or the black rods take them, fists wrapped round each hand's grip axis
   (userData.gripAxis in the hand's own frame, default its -Z). A one-handed
   weapon's other arm stays down. */
const _meleeAxisDefault = new THREE.Vector3(0, 0, -1);
function poseMeleeArms(mesh) {
  const gl = glovesOn();
  pfArms.visible = !gl;
  gloveRig.visible = gl;
  showBothGloves();
  mesh.updateMatrixWorld(true);
  const hands = meleeHands(mesh);
  const rods = pfArms.userData.rods;
  for (let i = 0; i < 2; i++) {
    const h = hands[i]?.obj;
    if (h) h.visible = false;
    if (!h) {
      rods[i].visible = false;
      if (gloves) gloves[i].root.visible = gloves[i].sleeve.visible = false;
      continue;
    }
    h.updateMatrixWorld(true);
    h.getWorldPosition(_saP);
    h.getWorldQuaternion(_saQ);
    _saA.copy(h.userData.gripAxis || _meleeAxisDefault).applyQuaternion(_saQ).normalize();
    if (!gl) {
      rods[i].visible = true;
      stretchBetween(rods[i], PF_ARM_SHOULDER[i], _saP);
      continue;
    }
    _saT.subVectors(PF_ARM_SHOULDER[i], _saP);
    _saT.addScaledVector(_saA, -_saA.dot(_saT)).normalize();
    _saX.crossVectors(_saA, _saT);
    _saM.makeBasis(_saX, _saA, _saT);
    const g = gloves[i];
    g.root.quaternion.setFromRotationMatrix(_saM);
    _gloveOff.copy(SABER_GLOVE_OFF[i]).applyQuaternion(g.root.quaternion);
    g.root.quaternion.multiply(i === 0 ? GLOVE_GRIP_Q : GLOVE_FOREGRIP_Q);
    poseGlove(g, "foregrip");
    finishGlove(g, i, _saP);
  }
}

/* A one-handed melee weapon hides a glove; everything else wants both. */
function showBothGloves() {
  if (!gloves) return;
  for (const g of gloves) g.root.visible = g.sleeve.visible = true;
}

const _pfTip = new THREE.Vector3();
const _pfMag = new THREE.Vector3();
const _pfDown = new THREE.Vector3();
/* `magBlend` 0..1 moves the support rod's tip from the handguard onto the
   magazine (reloads). */
function posePfArms(mesh, magBlend = 0) {
  if (saberArmsOn) return;   // the Trollsaber has the arms (poseSaberArms)
  const show = !!mesh?.visible && !inspectArms.visible && player.holding === "gun";
  const gl = glovesOn();
  pfArms.visible = show && !gl;
  gloveRig.visible = show && gl;
  if (!show) return;
  showBothGloves();
  mesh.updateMatrixWorld(true);
  // [grip, support]: the support hand is the one parked at supportHandPos
  // (build order differs between weapon-model.js and weapon-416.js).
  let anchors = mesh.userData.pfAnchors;
  if (!anchors) {
    const hands = mesh.children.filter((o) => o.userData.hand);
    const sp = mesh.userData.supportHandPos;
    const support = sp ? hands.find((o) => o.position.distanceTo(sp) < 1e-4) : null;
    const grip = hands.find((o) => o !== support);
    anchors = mesh.userData.pfAnchors = [grip, support].filter(Boolean).length ? [grip || support, support] : [];
  }
  const rods = pfArms.userData.rods;
  for (let i = 0; i < 2; i++) {
    // Sidearms carry no support hand: the left rod cups the grip too.
    const anchor = anchors[i] || anchors[0];
    rods[i].visible = !!anchor;
    if (!anchor) continue;
    anchor.getWorldPosition(_pfTip);
    _pfDown.set(0, -1, 0).applyQuaternion(mesh.quaternion);
    if (i === 1) {
      _pfTip.addScaledVector(_pfDown, anchors[1] ? (mesh.userData.pfSupportDrop ?? PF_SUPPORT_DROP) : 0.03);
      const mag = mesh.userData.shellMesh?.visible ? mesh.userData.shellMesh : mesh.userData.magMesh;
      if (magBlend > 0 && mag?.visible) {
        mag.getWorldPosition(_pfMag).addScaledVector(_pfDown, 0.05);
        _pfTip.lerp(_pfMag, magBlend);
      }
    }
    if (gl) placeGlove(gloves[i], i, mesh, anchor, _pfTip, !anchors[1], i === 1 ? magBlend : 0);
    else stretchBetween(rods[i], PF_ARM_SHOULDER[i], _pfTip);
  }
  if (gl && !anchors[0]) gloveRig.visible = false;
}

/* Keyboard Warrior toss. Beats (t):
     0.00-0.10  wind-up dip
     0.10-0.34  toss: leaves the hands with one end-over-end flip, rising
                a touch past the hover point
     0.34-0.70  float: hangs in front of the camera keys-out, esc end on
                the left like a real keyboard, slow sway and bob
     0.70-0.86  drop: a barrel roll on the way down into the hands
     0.86-1.00  catch: weight lands, a dip that settles
   The hands stay behind: they're lifted off the sword into the rig while
   it's airborne, sink out of view, and come back up for the catch. */
const MELEE_T_TOSS = 0.10, MELEE_T_FLOAT = 0.34, MELEE_T_DROP = 0.70, MELEE_T_CATCH = 0.86;
// Keys face local +Y, blade runs down local -Z, the F-row is the -X edge.
// Presented: blade to the right, keys at the camera, F-row on top.
const MELEE_FLOAT_QUAT = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0)));
const _qRest = new THREE.Quaternion();
const _vRest = new THREE.Vector3();
const _vRestCenter = new THREE.Vector3();
const _vFloatCenter = new THREE.Vector3();
const _qFloat = new THREE.Quaternion();
const _qSpin = new THREE.Quaternion();
const _qWobble = new THREE.Quaternion();

function meleeHands(mesh) {
  if (!mesh.userData.inspectHandList) {
    mesh.userData.inspectHandList = mesh.children.filter((o) => o.userData.hand).map((o) => ({
      obj: o, pos: o.position.clone(), quat: o.quaternion.clone(), rigPos: new THREE.Vector3(),
    }));
  }
  return mesh.userData.inspectHandList;
}

/* Put tossed-off hands back on the sword exactly where they were built. */
function restoreMeleeHands(mesh) {
  if (!mesh?.userData.handsTossed) return;
  for (const h of meleeHands(mesh)) {
    mesh.add(h.obj);
    h.obj.position.copy(h.pos);
    h.obj.quaternion.copy(h.quat);
  }
  mesh.userData.handsTossed = false;
}

/* The Reaper's Grin, admired: the blade folds shut, you bring it up, flick
   it open with a snap, roll it twice round the wrist with a little toss,
   and turn it to show the engraving before it settles back.
     0.00-0.10 fold shut    0.10-0.22 raise    0.22-0.32 flick open
     0.34-0.70 two rolls    0.70-0.88 show     0.88-1.00 back to rest */
let reaperClick = false;
const _meleeViewQ = new THREE.Quaternion();
const _meleeViewE = new THREE.Euler();
function applyReaperInspect(mesh) {
  const setFold = mesh.userData.setFold;
  if (inspectT <= 0) { setFold?.(0); reaperClick = false; return; }
  const t = inspectProgress();
  const sm = (a, b) => smoothstep(Math.max(0, Math.min(1, (t - a) / (b - a))));
  let fold = 0;
  if (t < 0.1) fold = sm(0, 0.1);
  else if (t < 0.22) fold = 1;
  else if (t < 0.32) {
    const u = (t - 0.22) / 0.1, c = 2.2;   // back-out: snaps past open, settles
    fold = 1 - (1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2));
    if (!reaperClick) { reaperClick = true; audio.reload(); }
  }
  if (t < 0.2) reaperClick = false;
  setFold?.(fold);
  const raise = sm(0.1, 0.22) * (1 - sm(0.88, 1));
  const snap = t > 0.22 && t < 0.34 ? Math.sin(((t - 0.22) / 0.12) * Math.PI) : 0;
  const trick = Math.max(0, Math.min(1, (t - 0.34) / 0.36));
  const roll = Math.PI * 4 * (trick < 0.5 ? 2 * trick * trick : 1 - Math.pow(-2 * trick + 2, 2) / 2);
  const toss = Math.sin(trick * Math.PI) * 0.045;
  const show = sm(0.7, 0.8) * (1 - sm(0.86, 0.94));
  mesh.position.x -= 0.24 * raise;
  mesh.position.y += 0.1 * raise + toss;
  mesh.position.z += 0.04 * raise;
  _qSpin.setFromAxisAngle(AXIS_X, -0.35 * raise - 0.25 * snap);
  mesh.quaternion.multiply(_qSpin);
  _qSpin.setFromAxisAngle(AXIS_Y, 0.55 * raise + 0.5 * show);
  mesh.quaternion.multiply(_qSpin);
  _qSpin.setFromAxisAngle(AXIS_Z, roll);
  mesh.quaternion.multiply(_qSpin);
}

function applyMeleeInspect(mesh) {
  const t = inspectProgress();
  const airborne = inspectT > 0 && t >= MELEE_T_TOSS + 0.02 && t < MELEE_T_CATCH;
  if (!airborne) restoreMeleeHands(mesh);
  if (inspectT <= 0) return;

  // The rest pose this frame (idle pose + walk bob), and its middle.
  _vRest.copy(mesh.position);
  _qRest.copy(mesh.quaternion);
  const { center, len } = inspectBounds(mesh);
  _vRestCenter.copy(center).applyQuaternion(_qRest).add(_vRest);

  const d = inspectDistance(len, 0.66);
  const floatT = Math.max(0, t - MELEE_T_FLOAT) * inspectDur;
  _qWobble.setFromEuler(new THREE.Euler(
    Math.sin(floatT * 1.9) * 0.07 - 0.12,     // lean the keys up toward the light a touch
    Math.sin(floatT * 1.3) * 0.26,
    Math.sin(floatT * 1.7 + 0.8) * 0.05));
  _qFloat.copy(_qWobble).multiply(MELEE_FLOAT_QUAT);
  _vFloatCenter.set(0, 0.015 + Math.sin(floatT * 2.2) * 0.012, -d);

  if (t < MELEE_T_TOSS) {
    // Wind-up: dip and cock back before the throw.
    const k = Math.sin((t / MELEE_T_TOSS) * Math.PI * 0.5);
    mesh.position.y -= 0.045 * k;
    mesh.position.z += 0.03 * k;
    _qSpin.setFromAxisAngle(AXIS_X, 0.25 * k);
    mesh.quaternion.multiply(_qSpin);
  } else if (t < MELEE_T_FLOAT) {
    const s = (t - MELEE_T_TOSS) / (MELEE_T_FLOAT - MELEE_T_TOSS);
    const e = 1 - Math.pow(1 - s, 3);   // thrown: fast off the hands, slowing at the top
    _qInspect.copy(_qRest).slerp(_qFloat, smoothstep(s));
    _qSpin.setFromAxisAngle(AXIS_X, -Math.PI * 2 * (1 - e));
    _qInspect.multiply(_qSpin);
    _vInspect.copy(_vRestCenter).lerp(_vFloatCenter, e);
    _vInspect.y += Math.sin(s * Math.PI) * 0.09;   // rises past the hover point, settles back
    placeByCenter(mesh, _qInspect, _vInspect, center);
  } else if (t < MELEE_T_DROP) {
    placeByCenter(mesh, _qFloat, _vFloatCenter, center);
  } else if (t < MELEE_T_CATCH) {
    const s = (t - MELEE_T_DROP) / (MELEE_T_CATCH - MELEE_T_DROP);
    const e = s * s * (1.6 - 0.6 * s);   // falls: slow off the hover, fast into the hands
    _qInspect.copy(_qFloat).slerp(_qRest, smoothstep(s));
    _qSpin.setFromAxisAngle(AXIS_Z, Math.PI * 2 * e);
    _qInspect.multiply(_qSpin);
    _vInspect.copy(_vFloatCenter).lerp(_vRestCenter, e);
    placeByCenter(mesh, _qInspect, _vInspect, center);
  } else {
    // Catch: the weight lands in the hands and settles.
    const s = (t - MELEE_T_CATCH) / (1 - MELEE_T_CATCH);
    const hit = Math.sin(Math.min(1, s * 2.2) * Math.PI) * (1 - s * 0.6);
    mesh.position.y -= 0.05 * hit;
    mesh.position.z += 0.02 * hit;
    _qSpin.setFromAxisAngle(AXIS_X, -0.18 * hit);
    mesh.quaternion.multiply(_qSpin);
  }

  if (airborne) {
    const hands = meleeHands(mesh);
    if (!mesh.userData.handsTossed) {
      // Leave the hands where they were at the throw, in rig space.
      for (const h of hands) {
        mesh.add(h.obj);
        h.obj.position.copy(h.pos);
        h.obj.quaternion.copy(h.quat);
        h.obj.position.applyQuaternion(_qRest).add(_vRest);
        h.obj.quaternion.premultiply(_qRest);
        h.rigPos.copy(h.obj.position);
        weaponRig.add(h.obj);
      }
      mesh.userData.handsTossed = true;
    }
    // Sink out of view while it's up, rise back for the catch.
    const down = rise(t, MELEE_T_TOSS, MELEE_T_FLOAT) * (1 - rise(t, MELEE_T_DROP - 0.04, MELEE_T_CATCH));
    for (const h of hands) {
      h.obj.visible = mesh.visible;
      h.obj.position.copy(h.rigPos);
      h.obj.position.y -= 0.24 * down;
      h.obj.position.z += 0.05 * down;
    }
  }
}

function placeByCenter(mesh, quat, centerPos, localCenter) {
  mesh.quaternion.copy(quat);
  _vCenter.copy(localCenter).applyQuaternion(quat);
  mesh.position.copy(centerPos).sub(_vCenter);
}

/* Reload animation (DESIGN-ARMS.md Phase 3): the weapon dips down and tilts
   away from view for the middle stretch of the reload, staged into named
   phases keyed off normalized progress `t` (0..1) rather than one flat dip
   — timed off the same w.reloading/reloadT/reloadTime the ammo swap already
   uses (reloadTime is the per-instance duration set by startReload(), which
   already differs between an empty reload and a faster tac reload), so
   staging can never fall out of sync with when ammo actually lands.

   Phase boundaries (fractions of `t`):
     0.00-0.12  raise    - weapon dips into reload pose
     0.12-0.42  magOut   - mag mesh drops out of the well (skipped entirely
                            on a tac reload's shorter timeline below)
     0.42-0.72  magIn    - fresh mag rises back into the well
     0.72-1.00  settle   - weapon returns to combat pose
   A tac reload (round already chambered) compresses this to raise/magIn/
   settle only — no empty mag to visibly drop, matching startReload()'s
   `reloadWasEmpty` branch. */
const _reloadPose = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 };
let reloadEventsFiredFor = null; // WeaponState instance we've already fired start/complete events for

const MAG_HOLD_SCREEN = new THREE.Vector3(-0.05, -0.17, -0.62);
const MAG_DROP_SCREEN = new THREE.Vector3(-0.06, -0.7, -0.45);
const MAG_HOLD_QUAT = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35, 0.5, -0.3));
const _magRestQ = new THREE.Quaternion();
const _magRestE = new THREE.Euler();
const _magHoldQ = new THREE.Quaternion();
const _magHold = new THREE.Vector3();
const _magDrop = new THREE.Vector3();
function reloadPose(w, mesh) {
  const p = _reloadPose;
  const mag = mesh?.userData.magMesh;

  if (!w.reloading || !w.reloadTime) {
    p.x = p.y = p.z = p.pitch = p.yaw = p.roll = p.magHold = 0;
    // magT too: `p` is shared, and a reload cut short by death left the
    // last mid-reload value here, so placeReloadMag kept every gun after it
    // (the respawned one included) holding its mag out in the air.
    p.shellT = p.rack = p.magT = -1;
    if (mag) {
      mag.visible = true;
      mag.position.copy(mesh.userData.magazinePoint);
      mag.rotation.x = mesh.userData.magRestRotationX ?? mag.userData.restRotX ?? mag.rotation.x;
    }
    if (reloadEventsFiredFor === w) {
      audio.reloadComplete();
      reloadEventsFiredFor = null;
    }
    return p;
  }

  if (w.def.shellReload) return shellReloadPose(w, mesh, p);

  if (reloadEventsFiredFor !== w) {
    if (w.def.candleShot) audio.tankSwap(w.reloadTime); else audio.reload();
    reloadEventsFiredFor = w;
  }

  const total = w.reloadTime;
  const t = 1 - Math.max(0, w.reloadT) / total;  // 0..1 through the reload

  // Phantom Forces reload (user's reference clip): the gun rolls well over
  // (~40°, magwell toward you, muzzle up), the left arm pulls the mag out
  // and down off screen, brings a fresh one up on the same arc, seats it,
  // and the gun rolls back. The envelope eases in over the first 14% and
  // out over the last 26%.
  const dip = Math.sin(Math.min(1, t / 0.14) * Math.PI / 2)
    * Math.sin(Math.min(1, (1 - t) / 0.26) * Math.PI / 2);
  // Sidearms tip over less, or the pistol rolls half off the screen.
  const rollK = mesh?.userData.supportHandPos ? 1 : 0.55;
  p.x = -dip * 0.05;
  p.y = -dip * 0.1 * rollK;
  p.z = dip * 0.04;
  p.pitch = dip * 0.32;
  p.yaw = -dip * 0.12;
  p.roll = dip * 0.72 * rollK;

  // Stages: reach 0.08-0.18, pull out 0.18-0.34 to the hold point, down
  // off screen for the swap 0.34-0.44, back up 0.46-0.56, seat 0.56-0.70,
  // arm back to the handguard 0.72-0.84. A tac reload runs the same beats
  // (PF swaps the mag either way); its shorter reloadTime makes it quicker.
  // The mag itself is placed by placeReloadMag once the gun is posed.
  p.magT = mag && mesh ? t : -1;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  p.magHold = p.magT < 0 ? 0 : smoothstep(clamp01((t - 0.08) / 0.1)) * (1 - smoothstep(clamp01((t - 0.72) / 0.12)));
  return p;
}

/* Shell-by-shell reload (the Grinmington, BO2's 870): the gun rolls over
   to show the loading port under the receiver and tips its muzzle up; each
   shell rides up on the support arm and is thumbed in (a small forward
   shove as it seats). An empty gun ends on a rack of the pump. Driven by
   WeaponState's shell stages, so the pose can't drift from the ammo count. */
function shellReloadPose(w, mesh, p) {
  const sr = w.def.shellReload;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const k = 1 - Math.max(0, w.shellT) / Math.max(0.001, w.shellDur);   // 0..1 through the stage
  let env = 1;
  if (w.shellStage === "start") env = smoothstep(k);
  else if (w.shellStage === "end") env = smoothstep(clamp01(Math.max(0, w.shellT) / sr.end));
  let shove = 0;
  p.shellT = -1;
  if (w.shellStage === "shell") {
    p.shellT = k;
    // Thumbed home over the last third of each shell.
    shove = Math.sin(clamp01((k - 0.62) / 0.38) * Math.PI);
  }
  p.x = -env * 0.03;
  p.y = -env * 0.05 + shove * 0.006;
  p.z = env * 0.02 - shove * 0.018;
  p.pitch = env * 0.2;
  p.yaw = -env * 0.06;
  p.roll = env * 0.62;      // port side (underneath) turned toward you
  p.magT = -1;
  // The support arm leaves the forend for each shell.
  p.magHold = p.shellT < 0 ? 0 : Math.sin(clamp01(p.shellT / 0.85) * Math.PI) * 0.9;
  // The rack: first sr.rack seconds of an empty gun's "end" stage.
  p.rack = -1;
  if (w.shellStage === "end" && w.shellDur > sr.end + 1e-4 && w.shellT > sr.end) {
    p.rack = 1 - (w.shellT - sr.end) / sr.rack;
  }
  return p;
}

/* The pump forend: back and forward after each shot (pumpT) and on the
   empty-reload rack. 0..1 progress -> how far back (0 = home). */
const PUMP_TRAVEL = 0.085;
function placePump(mesh, w, rackT) {
  const pump = mesh?.userData.pumpMesh;
  if (!pump) return;
  let t = -1;
  if (rackT >= 0) t = rackT;
  else if (w.pumpT > 0 && w.pumpDur > 0 && w.def.fireMode === "pump") t = 1 - w.pumpT / w.pumpDur;
  // A beat after the shot, a hard pull back, a hold, then home.
  const back = t < 0 ? 0 : t < 0.18 ? 0 : t < 0.45 ? smoothstep((t - 0.18) / 0.27)
    : t < 0.55 ? 1 : t < 0.85 ? 1 - smoothstep((t - 0.55) / 0.3) : 0;
  pump.position.z = mesh.userData.pumpRestZ + back * PUMP_TRAVEL;
}

/* The shell in the support hand: from low left (off the bandolier) up to
   the loading port, then gone into the tube. */
const SHELL_HOLD_SCREEN = new THREE.Vector3(-0.07, -0.2, -0.5);
const _shellHold = new THREE.Vector3();
function placeReloadShell(mesh, t) {
  const shell = mesh?.userData.shellMesh;
  if (!shell) return;
  if (t < 0 || t > 0.9) { shell.visible = false; return; }
  mesh.updateMatrixWorld(true);
  const port = mesh.userData.loadPort;
  const hold = mesh.worldToLocal(_shellHold.copy(SHELL_HOLD_SCREEN));
  const up = smoothstep(Math.min(1, t / 0.55));
  shell.position.lerpVectors(hold, port, up);
  // Pushed forward into the tube for the last stretch.
  if (t > 0.62) shell.position.z -= smoothstep((t - 0.62) / 0.28) * 0.05;
  shell.visible = true;
}

/* Sounds that ride WeaponState's own timeline (shell in, pump, rack). */
function drainWeaponEvents(w) {
  if (!w.events?.length) return;
  for (const e of w.events) {
    if (e === "shell") audio.shellIn();
    else if (e === "pump") audio.pump(w.pumpDur);
    else if (e === "rack") audio.pump(w.def.shellReload.rack);
  }
  w.events.length = 0;
}

/* Green Candles, per frame: the gauge shows what's in the tank; the candle
   breathes, dims as the tank runs down, flickers when it's nearly dry,
   brightens with the charge and flares on every shot while a pulse of
   light runs down the hose into the body. On a reload the old tank keeps
   its reading until it's off (magT 0.46), the candle goes out with the
   hose disconnected, the fresh tank fills bottom to top as it seats, and
   the candle catches again. Also drives the charge ring. */
function updateGreenCandles(mesh, w, magT, dt) {
  const gc = mesh.userData.gc;
  const charging = !!gc && w.charging;
  els.charge.hidden = !charging || player.holding !== "gun";
  if (!gc) return;
  const s = mesh.userData.gcState || (mesh.userData.gcState = { shown: w.ammoInMag / w.def.magSize, flare: 0, pulse: -1, amp: 0, t: 0 });
  s.t += dt;
  const size = w.def.magSize;
  let target = w.ammoInMag / size;
  let lit = 1;
  if (w.reloading && magT >= 0) {
    if (magT >= 0.46) target = (Math.min(size, w.ammoInMag + w.ammoReserve) / size) * smoothstep(Math.min(1, Math.max(0, (magT - 0.56) / 0.2)));
    if (magT < 0.3) lit = 1 - 0.88 * smoothstep(magT / 0.3);
    else if (magT < 0.72) lit = 0.12;
    else lit = 0.12 + 0.88 * smoothstep(Math.min(1, (magT - 0.72) / 0.14)) * (0.7 + 0.3 * Math.abs(Math.sin(s.t * 40)));
  }
  s.shown = damp(s.shown, target, 14, dt);
  gc.gaugeFill.scale.z = Math.max(0.001, s.shown);

  const c = w.def.charge;
  const level = w.chargeLevel;
  const full = charging && w.chargeT >= c.time * Math.max(0.2, w.chargeCap);
  if (w.shotFlare) {
    s.flare = 1 + (w.lastShotLevel || 0) * 1.5;
    s.pulse = 0;
    s.amp = 2.5 + (w.lastShotLevel || 0) * 4;
    w.shotFlare = 0;
  }
  s.flare *= Math.exp(-dt * 8);
  if (s.pulse >= 0) {
    s.pulse += dt / 0.2;
    if (s.pulse > 1.3) s.pulse = -1;
  } else if (charging && level > 0.05) {
    // While charging, pulses feed the candle, quicker as it fills.
    s.pulse = 0;
    s.amp = 1.2 + level * 2;
  }
  const low = w.ammoInMag / size < 0.2 ? 0.28 * Math.max(0, Math.sin(s.t * 9) * Math.sin(s.t * 2.3 + 1)) : 0;
  const flicker = 1 + 0.05 * Math.sin(s.t * 21) + 0.035 * Math.sin(s.t * 33.7) - low;
  const fuel = 0.4 + 0.6 * s.shown;
  const g = gc.glow;
  const set = (m, k) => { if (m) m.emissiveIntensity = m.userData.baseEmissive * k; };
  set(g.GC_CandleCore, lit * fuel * flicker * (1 + 0.55 * level) + s.flare * 1.2);
  set(g.GC_CandleShell, lit * (0.5 + 0.5 * fuel) * flicker * (1 + 0.9 * level) + s.flare * 0.8);
  set(g.GC_Wick, lit * flicker * (1 + 1.2 * level) + s.flare * 1.2);
  set(g.GC_HoseGlow, (0.35 + 0.65 * lit) * (1 + 0.7 * level));
  set(g.GC_Gauge, 0.75 + 0.25 * flicker + (full ? 0.5 * Math.abs(Math.sin(s.t * 14)) : 0));
  set(g.GC_Led, full ? (Math.sin(s.t * 18) > 0 ? 1.6 : 0.3) : lit);
  const [haloCandle, haloWick] = gc.halos;
  const hk = lit * (0.7 + 0.3 * fuel) * flicker;
  haloCandle.material.opacity = haloCandle.userData.base.opacity * (hk * (1 + 1.1 * level) + s.flare * 1.4);
  haloCandle.scale.setScalar(haloCandle.userData.base.size * (0.9 + 0.35 * level + 0.35 * s.flare));
  haloWick.material.opacity = Math.min(1, haloWick.userData.base.opacity * (hk * (1 + 1.6 * level) + s.flare * 1.2));
  haloWick.scale.setScalar(haloWick.userData.base.size * (0.9 + 0.9 * level + 0.8 * s.flare));
  const pu = g.GC_HoseGlow?.userData.pulse;
  if (pu) {
    pu.uPulse.value = s.pulse;
    pu.uPulseAmp.value = s.pulse >= 0 ? s.amp : 0;
  }
  // A held full charge strains in the hands.
  if (full) {
    mesh.position.x += (Math.random() - 0.5) * 0.0024;
    mesh.position.y += (Math.random() - 0.5) * 0.0024;
  }

  if (charging) {
    els.charge.style.setProperty("--p", level.toFixed(3));
    els.charge.classList.toggle("is-full", full);
    const cells = w.chargeT >= c.minHold ? chargedShotDef(w.def, level).cells : 1;
    els.chargeCells.textContent = w.chargeT >= c.minHold ? `${cells} ${cells === 1 ? "CELL" : "CELLS"}` : "";
  }
}

/* The mag's path is picked in screen (weapon-camera) space and brought into
   the gun's frame, so it has to run after this frame's gun pose: out of the
   well to a hold point low and left of centre where you see it in the hand
   (as in PF), down off screen for the swap, and the same way back. */
function placeReloadMag(mesh, t) {
  const mag = mesh?.userData.magMesh;
  if (!mag || t < 0) return;
  const rest = mesh.userData.magazinePoint;
  if (mag.userData.restRotX == null) mag.userData.restRotX = mag.rotation.x;
  const restRot = mesh.userData.magRestRotationX ?? mag.userData.restRotX;
  const seg = (a, b) => smoothstep(Math.max(0, Math.min(1, (t - a) / (b - a))));
  mesh.updateMatrixWorld(true);
  // Sidearms (no support hand) keep it tight: straight down out of the
  // grip and back, in the gun's own frame.
  const sidearm = !mesh.userData.supportHandPos;
  const hold = sidearm ? _magHold.set(rest.x, rest.y - 0.13, rest.z + 0.02)
    : mesh.worldToLocal(_magHold.copy(MAG_HOLD_SCREEN));
  const drop = sidearm ? _magDrop.set(rest.x, rest.y - 0.5, rest.z + 0.06)
    : mesh.worldToLocal(_magDrop.copy(MAG_DROP_SCREEN));
  if (t < 0.34) mag.position.lerpVectors(rest, hold, seg(0.18, 0.34));
  else if (t < 0.45) mag.position.lerpVectors(hold, drop, seg(0.34, 0.44));
  else if (t < 0.56) mag.position.lerpVectors(drop, hold, seg(0.46, 0.56));
  else mag.position.lerpVectors(hold, rest, seg(0.56, 0.7));
  const away = t < 0.45 ? seg(0.18, 0.34) : 1 - seg(0.56, 0.7);
  // In the hand it hangs upright on screen, tipped toward you, whatever
  // the gun's roll: slerp from its seated rotation to that screen pose.
  _magRestQ.setFromEuler(_magRestE.set(restRot, 0, 0));
  if (sidearm) _magHoldQ.setFromEuler(_magRestE.set(restRot + 0.3, 0, 0));
  else mesh.getWorldQuaternion(_magHoldQ).invert().multiply(MAG_HOLD_QUAT);
  mag.quaternion.copy(_magRestQ).slerp(_magHoldQ, away);
  mag.visible = true;
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

/* Viewmodel animation layers, composed additively in this fixed order
   (DESIGN-ARMS.md §3.1) — every new term this system gains belongs in one
   of these, not a parallel transform:
     1. base pose      - hip<->ADS lerp (basePos)
     2. movement       - bob (bobX/Y), sway (swayX/Y)
     3. inertia        - swaySmoothX/Y lag, weaponLowerT sprint/slide/busy lower
     4. recoil         - viewKick*
     5. reload/action  - rl (reloadPose)
     6. melee          - handled separately in updateMeleeView; REPLACES the
                         base pose outright during an active swing rather
                         than adding to it
     7. camera reaction - lives outside this function entirely; must stay a
                         smaller, separately-tuned effect, never the same
                         numbers as the viewmodel response above */
/* Optic glass is tinted so the lens reads as glass from the hip, but that
   tint sat between the eye and the target once aimed. Clear it as the gun
   comes up; the reticle draws on its own material and stays lit. */
function fadeOpticGlass(mesh, adsT) {
  let mats = mesh.userData.glassMats;
  if (!mats) {
    mats = [];
    mesh.traverse((o) => { if (o.material?.userData?.isGlass) mats.push(o.material); });
    mesh.userData.glassMats = mats;
  }
  for (const m of mats) m.opacity = m.userData.baseOpacity * (1 - 0.9 * adsT);
}

function updateWeaponView(dt) {
  const w = currentWeapon();
  updateInspect(dt);
  updateMeleeView(dt);
  updateStreakView(dt);
  const mesh = activeWeaponMesh;
  // Streak preempts the gun/melee mesh per DESIGN-ARMS.md §3.3's priority
  // stack — return before any weapon-view math runs so weaponLowerT/insp/rl
  // don't fight the device pose for ownership of activeWeaponMesh (which is
  // simply hidden, not touched, while holding === "streak").
  if (!saberArmsOn) pfArms.visible = false;   // posePfArms below re-shows them on a held gun
  // The streak device has its own arms (streakArms): the gun's gloves go.
  if (player.holding === "streak") { gloveRig.visible = false; pfArms.visible = false; return; }
  if (!mesh) return;

  // Aiming plants the sight: bob and idle sway fall away as the weapon
  // comes up, so walking while aimed no longer swims the whole gun across
  // the screen the way full-amplitude bob did.
  const steady = 1 - w.adsT * 0.85;
  // Settle: eases toward 1 while moving, toward 0 at rest, on top of (not
  // instead of) bobPhase freezing — the freeze already stops the wave from
  // continuing, this stops the amplitude from cutting off abruptly with it.
  bobSettleT = damp(bobSettleT, move.moving ? 1 : 0, move.moving ? 10 : 5, dt);
  const bobX = Math.sin(w.bobPhase) * w.def.bobAmp * 0.5 * steady * bobSettleT;
  const bobY = Math.abs(Math.cos(w.bobPhase)) * w.def.bobAmp * steady * bobSettleT;
  const rawSwayX = Math.sin(clock.elapsedTime * w.def.swaySpeed) * w.def.swayAmp * steady;
  const rawSwayY = Math.cos(clock.elapsedTime * w.def.swaySpeed * 0.8) * w.def.swayAmp * 0.6 * steady;
  // Directional strafe lean: a small extra lag-behind tilt keyed to strafe
  // direction, on top of the symmetric idle sway above, so left/right reads
  // as different rather than mirrored. move.strafeInput is -1 (left)..1
  // (right), already computed every frame by movement.js's own update().
  const strafeLean = (move.strafeInput ?? 0) * 0.012 * steady;
  // A heavier gun (lower `inertia` — the same field move.update() already
  // reads for how sluggish it turns) lags a beat behind its own sway target
  // instead of just swaying a smaller amount. Same idea as a real barrel's
  // momentum: it doesn't matter how little it moves if it moves instantly.
  const swayLag = Math.min(1, dt * (w.def.inertia ?? 8));
  swaySmoothX += (rawSwayX + strafeLean - swaySmoothX) * swayLag;
  swaySmoothY += (rawSwayY - swaySmoothY) * swayLag;
  const swayX = swaySmoothX, swayY = swaySmoothY;

  const adsOffset = w.adsT;
  // Heavier weapons settle into position more slowly (lower lambda = more
  // lag) — same `inertia`/`model.heavy` signals already used for sway lag
  // and the sprint roll above, not new per-weapon data.
  const adsLambda = w.def.model?.heavy ? 10 : (w.def.inertia ?? 8) * 1.6;
  adsSmoothT = damp(adsSmoothT, adsOffset, adsLambda, dt);
  // With the gloves on, the gun rides a little higher and closer so the
  // hands on it are in view (CoD-style framing); the rods sat off screen.
  const hipPos = glovesOn() ? new THREE.Vector3(0.2, -0.165, -0.5) : new THREE.Vector3(0.22, -0.2, -0.55);
  if (mesh.userData.hipOffset) hipPos.add(mesh.userData.hipOffset);
  const aimPoint = mesh.userData.aimPoint || new THREE.Vector3(0, 0, -0.4);
  // Where the sight sits in front of the weapon camera. Tube optics ask to
  // come closer so the eyepiece frames the view rather than a pinhole.
  const adsViewDistance = -(mesh.userData.adsDistance ?? 0.46);
  const adsPos = new THREE.Vector3(-aimPoint.x, -aimPoint.y, adsViewDistance - aimPoint.z);
  const basePos = hipPos.clone().lerp(adsPos, adsSmoothT);

  // Gun drops out of the way while sprinting, sliding or vaulting.
  const wantLower = (move.sprinting || move.stance === STANCE.SLIDE || move.busy) ? 1 : 0;
  weaponLowerT = damp(weaponLowerT, wantLower, 9, dt);
  // "Sling to the side" roll tracks the same sprint/lower gate, but at its
  // own (slightly slower) rate so the roll settles in a beat after the
  // straight lower does — that stagger is what makes the sprint-out read as
  // two things happening (drop, then swing) rather than one linear slide.
  sprintRollT = damp(sprintRollT, wantLower, 6, dt);

  // Landing impact: capture once on the justLanded edge, then let it decay.
  // Caller (this function) is responsible for clearing justLanded, per the
  // contract documented at movement.js's own justLanded assignment.
  if (move.justLanded) {
    landDipMag = Math.min(1, move.landSpeed / LAND_DIP_MAX_SPEED);
    landDipT = 1;
    move.justLanded = false;
  }
  landDipT = damp(landDipT, 0, 7, dt);

  const insp = inspectPose();
  const rl = reloadPose(w, mesh);
  const landPos = LAND_DIP_POS * landDipMag * landDipT;
  const landPitch = LAND_DIP_PITCH * landDipMag * landDipT;
  // Heavier weapons swing further into the sprint roll (def.heavy / a longer
  // model.len both already exist as the "this gun is bigger" signals used
  // elsewhere in weapon-model.js — reused here rather than adding new data).
  const weightMult = w.def.model?.heavy ? 1.35 : 1;
  const sprintRoll = sprintRollT * 0.22 * weightMult;
  // PF sprint cant (user's reference clip): the gun swings across the body,
  // muzzle up and to the LEFT, a diagonal rather than straight up the right.
  const sprintCant = sprintRollT * 0.5;

  // Turn lag (PF): the gun trails the view when you turn and rolls into
  // it, heavier guns further. Look rates are per second, wrapped yaw.
  const yawStep = Math.atan2(Math.sin(look.yaw - lastLookYaw), Math.cos(look.yaw - lastLookYaw));
  const yawRate = dt > 0 ? yawStep / dt : 0;
  const pitchRate = dt > 0 ? (look.pitch - lastLookPitch) / dt : 0;
  lastLookYaw = look.yaw;
  lastLookPitch = look.pitch;
  const lagK = (w.def.model?.heavy ? 1.3 : 1) * (1 - adsOffset * 0.8);
  turnLagX = damp(turnLagX, THREE.MathUtils.clamp(yawRate * 0.009, -0.05, 0.05) * lagK, 10, dt);
  turnLagY = damp(turnLagY, THREE.MathUtils.clamp(pitchRate * 0.006, -0.035, 0.035) * lagK, 10, dt);

  mesh.position.set(
    basePos.x + bobX + swayX - w.viewKickKnockback * 0.4 + weaponLowerT * 0.02 + turnLagX + insp.x + rl.x,
    basePos.y + bobY + swayY - weaponLowerT * 0.15 - landPos - turnLagY + insp.y + rl.y,
    basePos.z + w.viewKickKnockback * 0.6 + weaponLowerT * 0.08 + insp.z + rl.z
  );
  mesh.rotation.set(
    -w.viewKickPitch * 0.8 + weaponLowerT * 0.45 + landPitch - turnLagY * 2 + insp.pitch + rl.pitch,
    w.viewKickYaw * 0.6 + (1 - adsOffset) * (0.05 + (mesh.userData.hipYaw ?? 0)) + sprintCant + turnLagX * 2 + insp.yaw + rl.yaw,
    (1 - adsOffset) * 0.08 + weaponLowerT * 0.38 + sprintRoll + turnLagX * 4 + insp.roll + rl.roll + w.viewKickRoll
  );
  applyGunInspect(mesh, w);
  placeReloadMag(mesh, rl.magT ?? -1);
  updateGreenCandles(mesh, w, rl.magT ?? -1, dt);
  placeReloadShell(mesh, rl.shellT ?? -1);
  placePump(mesh, w, rl.rack ?? -1);
  drainWeaponEvents(w);
  posePfArms(mesh, rl.magHold || 0);

  if (mesh.userData.sight) mesh.userData.sight.visible = true;
  fadeOpticGlass(mesh, adsSmoothT);
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
initRadioWidget();
loadMap(lobbyMapId());
els.loading.hidden = true;
animate();

/* Test hook. This file is a module, so nothing above is reachable from a
   headless harness by bare identifier the way the main site's inline script
   is. Behind ?tohooks=1 so normal play never exposes it. */
if (/[?&]tohooks=1/.test(location.search)) {
  window.__trollOps = {
    renderer, scene, colliders,
    els, net, player, move, look, bots, remotes, loadout, builtMap: () => builtMap, modeId: () => modeId, spawner: () => spawner,
    chat, renderScoreboard, renderLobbyRoster, renderMenuRoster,
    settings, localRig, toggleThirdPerson, charInspector, inspector, emoteWheel, menuEmoteWheel, lookSensScale, botEarn, botStreakState, botStreakLog, uavActiveFor, vsatActiveFor, findAimAssistTarget, emote: () => emote,
    duo: () => ({ target: duoTarget?.netId || null, outgoing: duoOutgoing, incoming: duoIncoming }),
    findDuoTarget, sendDuoInvite, keys, setEmote: (idx, role = 0) => { emote = EMOTES[idx] ? { idx, t: 0, role } : null; },
    closePauseMenu, openPauseMenu, currentWeapon, tryReload, switchWeapon, pfArms, setAds: (v) => { adsHeld = !!v; },
    gfx: () => ({ tier: gfxTier(), auto: gfxAutoTier, ceiling: gfxCeiling, ssao: ssao.enabled, bloom: bloom.enabled, shadow: sun.shadow.mapSize.x, pixelRatio }),
    startGame, beginMatch, endMatch, spawnForTeam, respawnPlayer, damagePlayer, breakSpawnGuard,
    startIntermission, updateIntermission, occupants, notePointDeath,
    isStaging, beginStaging, endStaging, updateStaging,
    isSnd, bomb: () => bomb, bombSites: () => bombSites, sndRound: () => sndRound,
    sndAttackTeam: () => sndAttackTeam, sndEliminated: () => sndEliminated,
    prepareSndRound, sndGoLive, botObjective, sndClock: () => sndClock, setSndClock: (v) => { sndClock = v; }, teamScores, sndLive: () => sndLive, sndBotSite: () => sndBotSite, spawnSides: () => spawnSides, hill: () => hill, stunActor, blastCandidates, sndRoundWin, updateSnd, siteUnderfoot, sndAliveCounts,
    stageT: () => stageT, stageOwner: () => stageOwner,
    registerDeath, noteDealt, creditAssistIfOwed, showDeathCard,
    noteDamage, assistersFor, addMatchXp, awardKillXp, pushKillfeed,
    damageLog: () => damageLog, dealtLog: () => dealtLog,
    voteOptions: () => voteOptions,
    intermissionT: () => intermissionT,
    state: () => gameState,
    grenades, audio, camera, colliders, killcam, bullets, look,
    startCook, releaseCook, cancelCook, applyRemoteNade, blindT: () => blindT, cooking,
    empT: () => empT,
    empPlayer, flashPlayer, explosionFx, fireShake,
    startInspect, inspectT: () => inspectT, inspectPose, setInspectFreeze: (v) => { inspectFreeze = v; },
    showHitmarker, damageNumbers: () => damageNumbers, noteHitDirection, hitDirs,
    setMode: (id) => { modeId = id; modePicked = true; },
    zdir: () => zdir,
    loadedMapId: () => loadedMapId,
    THREE,
    activeMeleeMesh: () => activeMeleeMesh,
    activeWeaponMesh: () => activeWeaponMesh,
    matchClockT: () => matchClockT,
    resetMatchClock, swingMelee, botThrow, botMelee, isInfected, infectionCounts, applyInfect,
    infectionStarted: () => infectionStarted, pickFirstInfected, setInfectionT: (v) => { infectionT = v; }, botNadesThrown: () => botNadesThrown,
    activeLobbyPanel: () => activeLobbyPanel, showLobbyPanel,
    streaks, streakPicker, killstreakUi, achievements, streakIconSvg,
    awardScore, callReadyStreak, callStreak, fireStreak, startUav, applyRemoteStreak,
    cycleSelectedStreak, useSelectedStreak, selectedStreak: () => selectedStreak,
    readyStreaksOrdered, streakSlotIds, callStreakSlot, warmShaders, lightPool, pixelRatio: () => pixelRatio,
    updateStreakHud, enemiesRevealed, uavBucket, uavUntil, vsatUntil, drawMinimap,
    streakLockLeft, minimapJammed, applyCounterUav, flyovers, STREAK_DEFS,
    lastHitRange: () => lastHitRange,
    streakEntities, pendingStrikes, flyovers, strikeTablet: () => strikeTablet, openStrikeTablet, throwMarker, HunterDroneClass: HunterDrone, droneWorld, raycastWorld, groundHeightAt,
    markingStreak: () => markingStreak, confirmMark, cancelMark, updateMarking,
    groundAimPoint, rollPackageReward, claimPackage, clearStreakEntities,
    spawnCarePackage, spawnDrone, spawnHelicopter, updateStreakEntities,
    spawnK9, spawnWarship, spawnDragonfire, spawnSam, dragonfire: () => dragonfire, dragonfireView, samTargets, shootDownAir,
    botStreakMult, dragonfireSkyCheck, dragonfireBlocked, streakControlActive, streakBusy, endActiveStreak, streakEnd, warship: () => warship, markingStreak: () => markingStreak,
    fireDragonfire, roomBotSkill, boostedXp, veteranBoostOn, weaponRig, localHeld, MELEE_DEFS, saberParry,
    trySwivel, swivel, tabletDive: () => tabletDive, tabletDiveDip, botFireStreak, BOT_STREAK_POOL, updateBotAntiAir, enemyAirFor,
    warship: () => warship, warshipView, warshipGun: () => warshipGun, fireWarship, toggleWarshipGun,
    swarmRuns, damageDog, K9Pack, VtolWarship, WARSHIP_GUNS, K9,
    nearestHostileTo, strikeImpact, spawnAirstrike, pickDroneTarget, nearbyPackage, updatePickupPrompt,
    gamepadState, touchState, streakKeyLabel, keys, swapHold,
    animDebug, weaponLowerT: () => weaponLowerT, switchWeapon,
    tryReload, currentWeapon, fireOnce, composer, setHolding,
    setTrigger: (v) => { mouseDown = !!v; },
    isStaging: () => isStaging(),
    gloves: () => gloves, gloveRig: () => gloveRig, weaponRig: () => weaponRig,
    candleState: () => { const w = currentWeapon(); return { charging: w.charging, level: w.chargeLevel, ammo: w.ammoInMag, reserve: w.ammoReserve, reloading: w.reloading }; },
    meleeImpactT: () => meleeImpactT, meleeWhiffT: () => meleeWhiffT, sawShake: () => sawShake, sawInspectRev: () => sawInspectRev,
    targetMeshes: () => targetMeshes, meleeConnect,
    saberState: () => ({ ...saberBlock, trail: !!saberTrail?.mesh.visible, deflectT: saberDeflectT, parry: { ...saberParry.sample(), t: saberParry.t }, flick: saberFlick }),
    DROP, royaleDropView, inSkyLobby, startRoyaleBus,
    royale: () => royale, royaleAliveList, startRoyaleAct, royalePickupGun, royaleWants, setupRoyale, cycleSpectate, royaleSpectating,
    royaleBotObjective, royaleBotDamage, royaleNoise, ROYALE,
    activeStreakMesh: () => activeStreakMesh, streakHoldT: () => streakHoldT,
    streakArms, beginStreakHold, weaponRig, WHISTLE_HAND, WHISTLE_ROT, spawnVsatSat,
    beginStreakHold, endStreakHold,
    landDipT: () => landDipT, landDipMag: () => landDipMag,
    aimAssistPoints, findAimAssistTarget, applyAimAssist, controls,
  };
  animDebug.mount(() => {
    const w = currentWeapon();
    return {
      weapon: w.def?.name ?? w.id ?? "-",
      holding: player.holding,
      adsT: w.adsT.toFixed(2),
      reloading: w.reloading, reloadT: w.reloadT?.toFixed?.(2) ?? "-",
      sprinting: move.sprinting, stance: move.stance,
      grounded: move.grounded, jumping: move.jumping,
      justLanded: move.justLanded, landSpeed: move.landSpeed?.toFixed?.(2) ?? "-",
      velocity: move.velocity ? `${move.velocity.x.toFixed(1)},${move.velocity.y.toFixed(1)},${move.velocity.z.toFixed(1)}` : "-",
      meleeBusy: player.melee?.busy, meleeT: player.melee?.t?.toFixed?.(2) ?? "-",
      inspectT: inspectT.toFixed(2),
      markingStreak: markingStreak ?? "-",
    };
  });
}

