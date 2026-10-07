// Troll Forces match start: joining a room, the map loading screen, the
// pre-match staging countdown and intro, shader warm-up, and beginMatch.

import { makeRoomCode, MAX_PLAYERS_ROYALE, MAX_PLAYERS } from "../net.js?v=umb3-rm1-ld2-em1-sb1-cb1-rp1-p22-bh1";
import { playerName, setNetStatus, noBotsRoom } from "../menu/lobby.js?v=lb1-si1-gj1";
import { MAPS } from "../maps.js?v=p5tc-k9-em1-wst-tl1-bs1-tl2-sb1-rp1-dj1-cr1-db1-sb2-db2a-db2b-db2c-db3-db4-db5-gj1";
import { cancelSocialReturn } from "./social.js?v=so1-si1-mb1-gj1";
import { EMOTES } from "../emote-wheel.js?v=hb4-em1-wst-soc1";
import { emoteCode } from "../emotes.js?v=hb4-em1-wst-soc1-ng1";
import { TEAMS, setFunnyDeaths } from "../remote-players.js?v=umb3g-pc1-nf-em1-mi2-wst-ig1-bs1-sb1-cb2-rp1-hf1-sb2-gj1";
import { resolveWeapon, defaultLoadoutFor } from "../attachments.js?v=cg1-wst-sb2";
import * as THREE from "three";
import { buildWeaponMesh, stripLights } from "../weapon-model.js?v=p5-em1-wst-hf1";
import { buildMeleeMesh, THROWABLE_DEFS } from "../gear.js?v=to-hb1kb3-bk1-wst-ig1";
import { grenades, applyEmpState } from "../combat/throwables.js?v=th1-kc2-si1-gj1";
import { ensureStrikeTablet } from "../streaks/fire.js?v=sk1-si1-gj1";
import { loadModel } from "../battlefield-props.js";
import { goreStandIns, ZombieDirector } from "../zombies.js?v=zr4c-sb2";
import { royale, startRoyaleBus, setupRoyale, teardownRoyale, updateRoyaleGear, placeBotsInLobby, applyRoyaleCatchUp } from "./royale.js?v=md1-gj1";
import { showWaveBanner, clearHitDirs, updateStreakHud, clearDamageNumbers } from "../core/hud.js?v=cr1-si1-gj1";
import { updateSpawnGuardHud, damageLog, clearDeathVisuals, yawTowardCentre } from "../combat/damage.js?v=dm1-kc2-si1-gj1";
import { sndGoLive, prepareSndRound } from "./objectives.js?v=ob1-si1-gj1";
import { streaks, streakPicker, uavUntil, vsatUntil, clearStreakLocks, killstreakUi, achievements, clearStreakEntities } from "../streaks/calling.js?v=sk1-si1-gj1";
import { recentTeamKillers, dealtLog, lastHitRange, updateTeamHud } from "../combat/scoring.js?v=sc1-kc2-si1-gj1";
import { resetInfection } from "./infection.js?v=in1-si1-gj1";
import { applyHeroLoadout } from "./umb-heroes.js?v=sk1-si1-gj1";
import { TownNpcs } from "../town-npcs.js?v=tn4";
import { Hill, pickHillPoints, pickBombSites, Bomb } from "../modes.js?v=umb1-rn-wst-tl1-bs1-soc1-t69-u69";
import { setHillMarker, setBombSiteMarkers } from "../core/minimap.js?v=cr1-gj1";
import { RangeSet } from "../range.js";
import { WaveSpawner } from "../enemies.js?v=hb4-wst-soc1-sb2";
import { DROP } from "../royale-drop.js?v=rp3-wst-bs1-sb2";
import { game } from "../core/state.js?v=st1";

/* Put everyone who didn't ask for a private room into the same public
   server for the mode they picked. Tries the base room first (QTDM, QKOH,
   ...); only spills into a numbered shard once the base room already has
   enough real people that MAX_PLAYERS would be exceeded, so a lone player
   never gets sharded off by themselves. Modes without a quickplay base
   (none currently) fall back to a private random room, same as before. */
async function joinQuickplay() {
  const base = game.QUICKPLAY_BASE[game.modeId];
  if (!base) {
    const code = makeRoomCode();
    return { code, kind: await game.net.start(code, { name: playerName(), mapId: game.loadout.mapId, uid: game.playerUid() }) };
  }
  for (let shard = 1; shard <= game.QUICKPLAY_MAX_SHARDS; shard++) {
    const code = shard === 1 ? base : `${base}${shard}`;
    setNetStatus(shard === 1 ? "Connecting…" : `Server full, trying another (${shard})…`);
    const kind = await game.net.start(code, { name: playerName(), mapId: game.loadout.mapId, uid: game.playerUid() });
    if (!kind) return { code, kind };   // real connectivity failure — retrying won't help
    // Real people only: a room's bots (mirrored into its peer list) would
    // otherwise make a busy Royale look full and shard every joiner away.
    const cap = game.isRoyale() ? MAX_PLAYERS_ROYALE : MAX_PLAYERS;
    if (game.net.humanCount <= cap || shard === game.QUICKPLAY_MAX_SHARDS) return { code, kind };
    game.net.stop();
  }
}

/* A stage message whose map this client should take: from a player who
   joined the room before us (so two newcomers can't swap maps back and
   forth), same mode, and a mode that lets you pick the map at all. */
export function followsHostMap(m) {
  if (!m.map || !MAPS[m.map] || m.mode !== game.modeId || !game.isPvp()) return false;
  const mode = game.currentMode();
  if (mode.forceMap || mode.mapPool) return false;
  // The host's map, not just any older player's: a tab stuck on its loading
  // screen used to drag everyone onto its map (net.hostId).
  return game.net.peers.has(m.id) && game.net.hostId() === m.id;
}

export async function startGame() {
  game.audio.resume();   // the click that got us here is the gesture Web Audio needs
  // View mode: the lobby's map, nobody in it (see isView).
  if (game.viewModeOn() && game.modeId !== "view") { game.viewPrevMode = game.modeId; game.modeId = "view"; }
  else if (!game.viewModeOn() && game.modeId === "view") game.modeId = game.viewPrevMode || "ops";
  // The click is the only gesture we get: take the mouse now, so the match
  // doesn't open on the pause screen after a long load.
  if (!game.isTouch) { try { game.controls.lock(); } catch { /* the pause screen catches it later */ } }
  game.roomMapHint = null;
  // Socialize is the one public hangout room: never a private code. The
  // room may already be playing a mode the owner switched it to; the host
  // says so while we connect (adoptRoomMode) and modeId follows.
  game.socialRoom = game.isSocial();
  game.roomModeSeq = game.net.modeSeq = 0;
  game.socialMapId = null;
  cancelSocialReturn();
  game.loadScreen.show(loadInfo(game.matchMapId()));
  game.els.title.hidden = true;
  if (game.isPvp()) {
    game.els.startBtn.disabled = true;
    setNetStatus("Connecting…");
    game.loadScreen.status(game.socialRoom ? "Finding the hangout…" : "Finding a match…");
    const result = game.els.room.value && game.roomIsCustom && !game.socialRoom
      ? { code: game.els.room.value, kind: await game.net.start(game.els.room.value, { name: playerName(), mapId: game.loadout.mapId, uid: game.playerUid() }) }
      : await joinQuickplay();
    game.els.startBtn.disabled = false;
    if (!result.kind) {
      game.loadScreen.hide();
      game.els.title.hidden = false;
      if (game.controls.isLocked) game.controls.unlock();
      game.socialRoom = false;
      setNetStatus("Couldn't reach the room. Try another code.", "bad");
      return;
    }
    if (!game.socialRoom) game.els.room.value = result.code;
    // The hangout is one side, so anyone can duo-emote with anyone.
    if (game.isSocial()) game.net.setTeam("phantom");
    else game.net.chooseTeam();
    game.chat.render();   // it was built before the room connected
    setNetStatus(`Live · ${result.kind} · room ${result.code} · ${game.teamName(game.net.team)}`, "live");
  } else {
    game.net.stop();
  }

  enterMatch(game.isPvp() ? game.roomMapHint : null);
}

/* -------------------- map loading screen --------------------

   Find Match → this screen (map-load-screen.js) → the countdown. It stays
   up until the map is built, downloaded and its shaders compiled, so the
   match runs smooth from its first frame on every device, however long
   that takes. Online it then waits until everyone in the room has loaded
   too (user: "game doesn't start until everyone loads in completely"), for
   up to LOAD_WAIT_MAX seconds once we're ready (see updateLoadScreen).

   The wire: every client sends "ready" (net.publishReady) about once a
   second while on this screen, ok:0 while loading, ok:1 once done. The
   host (net.isBotHost) starts the countdown when every player who speaks
   "ready" has sent ok:1 for its map; its countdown "stage" messages are the
   go for everyone else. A player arriving once the match is on gets a
   targeted go (net.publishGo) from the host when they finish. Players on an
   old cached page never send "ready", so they're not waited on. */
export let loadHold = false;    // match set up under the loading screen; countdown frozen until "go"
export let loadTarget = null;   // the map the screen is loading
let loadSeq = 0;         // bumped to cancel a superseded load (the room switched maps)
let loadPing = 0;        // seconds until the next "ready" resend

export function loadInfo(id) {
  return { id, name: MAPS[id]?.name || "", blurb: MAPS[id]?.blurb || "", mode: game.currentMode().name };
}

export async function enterMatch(mapHint = null) {
  const seq = ++loadSeq;
  loadWarm = false;
  loadHold = false;
  loadPing = 0;
  let id = game.matchMapId(mapHint);
  if (!game.loadScreen.isOpen) game.loadScreen.show(loadInfo(id));
  // Everyone re-reports for this match; old "done"s were for the last one.
  for (const p of game.net.peers.values()) p.readyMap = null;
  for (;;) {
    loadTarget = id;
    game.loadScreen.setMap(loadInfo(id));
    if (id !== game.loadedMapId) {
      const tick = () => {
        const st = game.mapPreload.status(id);
        game.loadScreen.progress(st.progress * 0.85);
        game.loadScreen.status(st.state === "compiling" ? "Building the map" : "Loading the map");
      };
      const off = game.mapPreload.onChange(tick);
      tick();
      try { await game.mapPreload.preload(id); } catch { /* loadMap builds it plainly */ } finally { off(); }
      if (seq !== loadSeq) return;
    }
    // The room may have told us its map while we loaded ours.
    const want = game.matchMapId(game.isPvp() ? (game.roomMapHint || mapHint) : mapHint);
    if (want === id) break;
    id = want;
  }
  loadHold = true;
  beginMatch(id);
  // Everything else the match will draw (bots, streak models, the gun),
  // compiled now rather than on the frame it first appears.
  game.loadScreen.progress(0.88);
  game.loadScreen.status("Warming up");
  await warmShaders();
  if (seq !== loadSeq) return;
  game.loadScreen.progress(1);
  game.loadScreen.status(game.isPvp() && game.net.active ? "Waiting for players" : "Ready");
  loadWarm = true;
}
export let loadWarm = false;    // shaders done; only then do we tell the room we're ready

/* The loading screen comes down and the countdown runs. `left` adopts the
   host's clock; without one we keep the countdown beginMatch set. */
export function releaseLoad(left = 0) {
  if (!loadHold) return;
  loadHold = false;
  loadWarm = false;
  loadTarget = null;
  if (left > 0 && isStaging()) { game.stageT = left; stageShown = -1; }
  game.loadScreen.hide();
  game.calibratePadRest();   // nobody should be pushing the stick on the loading screen
  if (!game.isTouch && game.gameState === "playing") {
    try { game.controls.lock(); } catch { /* refused — the pause screen catches it */ }
    setTimeout(() => {
      if (game.gameState === "playing" && !game.controls.isLocked && !game.loadScreen.isOpen) game.openPauseMenu();
    }, 260);
  }
}

/* Four times a second while the loading screen is up — on a timer rather
   than the frame loop, so a player who tabs away mid-load (no frames in a
   background tab) keeps reporting in instead of timing out of the room. */
let loadClock = performance.now();
function updateLoadScreen(dt) {
  if (!game.loadScreen.isOpen) return;
  const online = game.isPvp() && game.net.active;
  const done = loadHold && loadWarm;
  if (online) {
    game.net.prune();
    loadPing -= dt;
    if (loadPing <= 0 && loadTarget) { loadPing = 1; game.net.publishReady(loadTarget, game.modeId, done); }
  }
  if (!done) { loadWaitT = 0; return; }
  if (!online) { releaseLoad(); return; }
  const others = [...game.net.peers.values()].filter((p) => !game.isBotPeer(p) && p.lr);
  const n = others.filter((p) => p.readyMap === game.loadedMapId).length;
  // A time limit on the wait (user, 2026-10-04: "add a timeout for the
  // slowest player wait"; it had none). Counted from when we were ready.
  // The host starts without whoever is still loading once it runs out;
  // they're let in the moment they finish (onReady's publishGo, the same
  // way as a latecomer). A slow host is the other half: the rest start on
  // their own a while later, and adopt its countdown once it arrives.
  loadWaitT += dt;
  const host = game.net.isBotHost();
  const limit = host ? game.loadWaitMax : game.loadWaitMax + LOAD_WAIT_CLIENT_EXTRA;
  const left = Math.max(0, Math.ceil(limit - loadWaitT));
  game.loadScreen.status(others.length ? `Waiting for players ${n + 1}/${others.length + 1} · starting in ${left}s` : "Ready");
  if (host && n === others.length) releaseLoad();
  else if (loadWaitT >= limit) releaseLoad();
}
export const LOAD_WAIT_MAX = 20;          // seconds the host waits on slow loaders once it's ready
const LOAD_WAIT_CLIENT_EXTRA = 25; // and on top, before a non-host stops waiting for the host
let loadWaitT = 0;

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
// TDM and S&D open on a cinematic of both teams (match-intro.js), so their
// first countdown is long enough to hold it plus a couple of beats to GO.
// Every client uses the same length so the shared clock never shrinks it.
const INTRO_STAGE_SECONDS = 10;
const INTRO_TAIL = 1.6;          // seconds of plain countdown left after the cinematic
let introPending = null;         // "full" | "short": starts on the first un-held staging tick
let introDelay = 0;              // ...a beat in, once respawned bots have been placed
let stageShown = -1;             // last whole second painted, so we only touch the DOM on a change
let stagePub = 0;                // throttle on republishing it

export function isStaging() { return game.stageT > 0; }

function introMode() { return game.modeId === "tdm" || game.modeId === "snd"; }
function introOn() { return introMode() && !document.body.classList.contains("tf-anim-off"); }

/* Everyone the cinematic should show, as match-intro.js actors. Bots ride
   the peer map too (net.publishBot mirrors them in); streak entities don't
   count as anyone. */
function introCast() {
  const mine = [], enemy = [];
  for (const rp of game.remotes.byId.values()) {
    if (String(rp.netId).startsWith("streak-") || !rp.alive) continue;
    const actor = {
      id: String(rp.netId),
      name: rp.peer.name || "operator",
      pos: rp.pos,   // live: a respawned bot lands a frame after the round resets
      yaw: rp.yaw,
      pose: (name) => {
        const i = name ? EMOTES.findIndex((e) => e.id === name) : -1;
        rp.cineEmote = i >= 0 ? emoteCode(i) : 0;
      },
    };
    (rp.team === game.net.team ? mine : enemy).push(actor);
  }
  return { mine, enemy };
}

function startMatchIntro(kind) {
  const short = kind === "short";
  // A round restart only has 3 s on the clock: leave it less of a tail.
  const length = game.stageT - (short ? 0.9 : INTRO_TAIL);
  if (length < (short ? 1.4 : 4)) return;
  const enemyTeam = game.net.team === "phantom" ? "ghost" : "phantom";
  const snd = game.isSnd();
  const attack = snd && game.net.team === game.sndAttackTeam;
  game.matchIntro.start({
    length: short ? Math.min(length, 2.4) : length,
    short,
    seed: game.sndRound,
    modeName: game.currentMode().name,
    mapName: game.builtMap.map.name,
    mine: { name: TEAMS[game.net.team]?.name || "Trolls", ui: TEAMS[game.net.team]?.ui },
    enemy: { name: TEAMS[enemyTeam]?.name || "Jeets", ui: TEAMS[enemyTeam]?.ui },
    roleMine: snd ? (attack ? "Attacking" : "Defending") : "",
    roleEnemy: snd ? (attack ? "Defending" : "Attacking") : "",
    cast: introCast,
    self: () => ({
      feet: game.move.pos,
      eye: game.player.pos,
      yaw: game.look.yaw,
      pitch: game.look.pitch,
      name: playerName(),
    }),
  });
  document.body.classList.add("to-intro-on");
}

/* Compile every shader the match will need while the countdown runs, so the
   first grenade, the first streak and the first bot in view don't each
   freeze the frame they appear (a shader compiles on first draw, and on a
   laptop GPU that is hundreds of ms apiece). The map and the bots are already
   in the scene; the rest gets one throwaway stand-in each, parked out of
   sight, compiled, and removed. compileAsync lets the driver compile in
   parallel where it can, so the countdown keeps ticking meanwhile.

   It runs every match, streak models included: each map brings its own
   lights, and the light count is part of every shader's key, so last
   match's shaders don't fit this one.

   The guns get stand-ins too, both copies: the first-person one and the one
   the third-person body holds. Only the equipped gun is ever built
   (setActiveWeaponMesh), so the secondary, and the body's gun the first
   time you go third person, used to compile on the spot. The stand-ins are
   kept (never drawn) until the next warm-up, because three frees a shader
   once the last material using it is disposed, and every weapon swap
   disposes the gun it puts away. */
const WARM_MODELS = ["care-package", "helicopter", "hunter-drone", "recon-drone", "strike-jet", "k9-dog", "vtol-warship"];
let warmKeep = [];                 // last warm-up's stand-ins, holding their shaders
const warmedGuns = new Set();      // gunWarmKey()s those stand-ins cover
const gunWarmKey = (def) => `${def.id}:${JSON.stringify(def.attachments || {})}`;

/* Every gun this match can put in your hands: the loadout's two, or the
   whole Gun Game rack. */
function matchGunDefs() {
  const mode = game.currentMode();
  const defs = Object.values(game.player.weapons || {}).map((w) => w.def);
  if (mode.ladder) {
    for (const id of mode.ladder) {
      let def = resolveWeapon(id, defaultLoadoutFor(id));
      if (mode.tuneWeapon) def = mode.tuneWeapon(def);
      defs.push(def);
    }
  }
  const seen = new Set();
  return defs.filter((d) => d && !seen.has(gunWarmKey(d)) && seen.add(gunWarmKey(d)));
}

/* First-person and third-person stand-ins for `defs` (and the melee
   weapon's third-person copy), not yet attached anywhere. */
function gunStandIns(defs, melee) {
  const fp = new THREE.Group(), tp = new THREE.Group();
  fp.visible = false;
  for (const def of defs) {
    fp.add(buildWeaponMesh(def));
    const g = stripLights(buildWeaponMesh(def));
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    tp.add(g);
  }
  if (melee) tp.add(buildMeleeMesh(melee, false, { held3p: true }));
  return { fp, tp };
}

function disposeStandIns(objs) {
  for (const obj of objs) obj.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    if (o.material) for (const m of [].concat(o.material)) m.dispose?.();
  });
}

/* compile() doesn't upload textures; do the stand-ins' now too. */
function uploadStandInTextures(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      if (!m) continue;
      for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "alphaMap", "bumpMap"]) {
        const t = m[k];
        if (t?.isTexture && t.image) { try { game.renderer.initTexture(t); } catch { /* uploads on first draw */ } }
      }
    }
  });
}

/* Guns compiled against the world and the viewmodel scene, keeping them
   in `keep`. */
async function warmGuns(defs, melee, keep) {
  const { fp, tp } = gunStandIns(defs, melee);
  keep.push(fp, tp);
  tp.position.set(0, -200, 0);
  game.weaponRig.add(fp);
  try {
    uploadStandInTextures(fp);
    uploadStandInTextures(tp);
    await Promise.all([
      game.compileWorld(tp, game.camera, game.scene),
      game.renderer.compileAsync(fp, game.weaponCamera, game.weaponScene),
    ]);
    for (const d of defs) warmedGuns.add(gunWarmKey(d));
  } finally {
    game.weaponRig.remove(fp);
  }
}

/* A class change on respawn brings guns the countdown never saw. */
export function warmNewGuns() {
  if (!game.renderer.compileAsync || game.gameState !== "playing") return;
  const fresh = matchGunDefs().filter((d) => !warmedGuns.has(gunWarmKey(d)));
  if (fresh.length) warmGuns(fresh, null, warmKeep).catch(() => {});
}

export async function warmShaders() {
  if (!game.renderer.compileAsync) return;
  const stand = new THREE.Group();
  stand.position.set(0, -200, 0);
  for (const def of Object.values(THROWABLE_DEFS)) {
    stand.add(new THREE.Mesh(grenades.geo, grenades.matFor(def)));
  }
  const kept = [];
  ensureStrikeTablet();
  game.scene.add(stand);
  try {
    const models = (await Promise.all(WARM_MODELS.map((m) => loadModel(m).catch(() => null)))).filter(Boolean);
    // zombies: the blood pool and the neck stump of a headshot kill
    if (game.isZombies()) models.push(...goreStandIns());
    for (const m of models) stand.add(m);
    kept.push(...models);
    uploadStandInTextures(stand);
    warmedGuns.clear();
    await Promise.all([
      game.compileWorld(game.scene, game.camera),
      game.renderer.compileAsync(game.weaponScene, game.weaponCamera),
      warmGuns(matchGunDefs(), game.player.melee?.def, kept),
    ]);
  } catch (e) {
    // Only ever a head start; the frame will compile whatever this missed.
  } finally {
    game.scene.remove(stand);
    for (const m of kept) m.parent?.remove(m);
    const old = warmKeep;
    warmKeep = kept;
    disposeStandIns(old);
  }
}

/* Frozen: input is ignored and damage is refused. The camera still moves so
   the player can look around the room while they wait. */
export function beginStaging(seconds = STAGE_SECONDS) {
  // Animations off (menu-bo2.js switch): solo skips most of the wait. PvP
  // keeps the room's clock, since everyone in it shares one countdown.
  const fast = !game.isPvp() && document.body.classList.contains("tf-anim-off");
  if (fast) seconds = Math.min(seconds, 2);
  // TDM / S&D: the match opener gets the full cinematic (and a longer clock
  // to hold it), each later S&D round the short squad cut.
  game.matchIntro.stop();
  introPending = null;
  if (introMode() && !royale) {
    const opener = seconds === STAGE_SECONDS;
    if (opener) seconds = INTRO_STAGE_SECONDS;
    if (introOn()) { introPending = opener ? "full" : "short"; introDelay = 0.15; }
  }
  game.stageT = seconds;
  stageShown = -1;
  stagePub = 0;
  // Solo play always "owns" its own clock; PvP re-derives ownership every
  // publish tick in updateStaging() rather than latching a one-time guess
  // here — a peer's `hello` can land a beat after this runs, and a stale
  // "I'm alone" snapshot would leave two clients both convinced they own it.
  game.stageOwner = !game.isPvp() || !game.net.active;
  // A beat in, once the bots that fill the room have streamed in.
  // (Under the loading screen enterMatch warms everything itself.)
  if (!loadHold) setTimeout(() => { if (isStaging()) warmShaders(); }, fast ? 0 : 900);
  // The sky lobby is a place to walk round in, not a frozen countdown card.
  game.els.staging.hidden = !!royale?.drop;
  if (!royale?.drop) document.body.classList.add("to-staging-on");
  else showWaveBanner("SKY LOBBY — try the guns, the bus leaves soon", 2600);
  game.els.stagingMode.textContent = game.isPvp()
    ? `${game.currentMode().name} — ${game.builtMap.map.name}`
    : game.builtMap.map.name;
  game.els.stagingSub.textContent = game.isInfection()
    ? "Everyone starts clean. Someone won't stay that way."
    : game.isPvp() && game.net.team
    ? `You are ${TEAMS[game.net.team].name}`
    : "Get ready";
  updateStagingRoster();
}

export function endStaging() {
  // Already ended. (The sky lobby hides the countdown card, so a hidden card
  // alone doesn't mean that there.)
  if (game.stageT <= 0 && game.els.staging.hidden && royale?.drop?.phase !== "lobby") return;
  game.stageT = 0;
  game.spawnOpening = false;
  introPending = null;
  game.matchIntro.stop();
  game.els.staging.hidden = true;
  document.body.classList.remove("to-staging-on");
  // The opening seconds still deserve the cover a respawn gets.
  game.player.spawnGuard = game.isPvp() ? game.SPAWN_GUARD : 0;
  updateSpawnGuardHud();
  if (royale?.drop) startRoyaleBus();
  else if (royale) { royale.live = true; royale.t = 0; showWaveBanner("DROP IN — last troll standing wins", 1800); }
  else if (game.isPvp() && !game.isSnd()) showWaveBanner("FIGHT", 1100);
  game.audio.stageTick(true);
  // The horde/zombie clock — and the first wave banner — start now, not when
  // the map loaded, so nothing was ever ticking behind the countdown.
  if (game.isZombies()) game.nextZombieRound();
  else if (game.isSnd()) sndGoLive();
  else if (!game.isPvp() && !game.isRange()) game.nextWave();

  // Search & Destroy's clock is per-round elsewhere (PLANT_TIME/DEFUSE_TIME);
  // this is the whole-match clock for score-limited modes like TDM.
  if (game.isPvp() && !game.isSnd()) game.resetMatchClock();
}

/* How full the room looks right now — the whole point of staging is that the
   bots are already standing there when the player counts down. */
function updateStagingRoster() {
  if (!game.isPvp()) { game.els.stagingRoster.textContent = ""; return; }
  let humans = 1, botCount = 0;
  for (const p of game.net.peers.values()) (game.isBotPeer(p) ? botCount++ : humans++);
  const parts = [`${humans} operator${humans === 1 ? "" : "s"}`];
  if (botCount) parts.push(`${botCount} bot${botCount === 1 ? "" : "s"}`);
  game.els.stagingRoster.textContent = parts.join(" · ");
}

export function updateStaging(dt) {
  // The first tick the clock actually runs (not under the loading screen),
  // so the cinematic is squeezed into whatever is really left.
  if (introPending && (introDelay -= dt) <= 0) { const k = introPending; introPending = null; startMatchIntro(k); }
  game.stageT -= dt;
  if (game.matchIntro.active) game.matchIntro.setClock(game.stageT);

  // Only the owner publishes, ~3×/sec, so a client that joins or reloads
  // mid-countdown adopts the clock already running rather than its own.
  // Re-checked every tick (not latched once) so a peer whose `hello` arrived
  // a beat late still hands ownership off the moment it's known about.
  if (game.isPvp() && game.net.active) {
    game.stageOwner = game.net.isBotHost();
    stagePub -= dt;
    if (game.stageOwner && stagePub <= 0) {
      stagePub = 0.33;
      game.net.publishStage(game.loadedMapId || game.loadout.mapId, game.modeId, game.stageT, royale ? royale.seed : undefined);
    }
  }

  const whole = Math.max(0, Math.ceil(game.stageT));
  if (whole !== stageShown) {
    stageShown = whole;
    game.els.stagingClock.textContent = whole > 0 ? String(whole) : "GO";
    // Restarting a CSS animation needs the class off for a reflow first.
    game.els.stagingClock.classList.remove("is-tick");
    void game.els.stagingClock.offsetWidth;
    game.els.stagingClock.classList.add("is-tick");
    if (whole > 0) game.audio.stageTick(whole <= 3);
    updateStagingRoster();
  }

  if (game.stageT <= 0) endStaging();
}

/* Everything a match needs reset, with no connection work — so a rematch can
   reuse the room the lobby already joined instead of tearing it down and
   making everyone re-handshake. */
export function beginMatch(mapId = null) {
  game.killcam.clear();
  setFunnyDeaths(!!game.currentMode().funny);
  game.suppressT = 0;
  clearHitDirs();
  game.player.hp = game.player.maxHp;
  game.player.kills = 0;
  game.player.deaths = 0;
  game.player.wave = 0;
  game.player.alive = true;
  game.player.assists = 0;
  game.player.headshots = 0;
  game.player.streak = 0;
  game.player.bestStreak = 0;
  game.player.matchXp = 0;
  game.player.matchT = 0;
  game.player.vetBotT = 0;
  game.player.shotsFired = 0;
  game.player.shotsHit = 0;
  game.player.matchScore = 0;
  game.player.weaponKills = {};
  game.roomSkillSeen = null;
  game.player.lastKilledBy = null;
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
  if (game.els.ssSlots) game.els.ssSlots.dataset.sig = "";
  updateStreakHud();
  damageLog.clear();
  dealtLog.clear();
  lastHitRange.clear();
  if (game.els.deathBy) game.els.deathBy.hidden = true;
  game.elapsedRun = 0;
  game.respawnT = 0;
  game.teamScores.phantom = 0;
  game.teamScores.ghost = 0;
  updateTeamHud();

  game.gunGameProgress = 0;
  game.hillAcc = 0;
  resetInfection();
  // After that reset: it reads a 150 max as "was infected" (the Knight's 150 too).
  applyHeroLoadout();

  game.spawnDeaths.clear();
  // Spawn protection starts when the countdown ends, not when the map loads —
  // burning it during staging would spend it before anyone can shoot.
  game.player.spawnGuard = 0;
  updateSpawnGuardHud();

  game.loadMap(game.matchMapId(mapId));
  // Socialize: the map's townsfolk (town-npcs.js), if it has any.
  game.townNpcs?.dispose();
  game.townNpcs = game.isSocial() && game.builtMap?.map?.rp?.npcs ? new TownNpcs(game.scene, game.builtMap.map.rp.npcs(), game.builtMap.map.rp) : null;
  game.player.armor = 0;
  game.player.plates = 0;
  game.player.heals = 0;
  if (game.isRoyale()) setupRoyale(); else teardownRoyale();
  game.spawnOpening = true;   // cleared by endStaging — everyone opens on their own side
  clearDeathVisuals();   // dying as the last match ended left the screen dark
  const sp = royale?.drop ? royale.drop.lobbySpot(0) : game.isPvp() ? game.teamSpawn() : game.builtMap.playerSpawn;
  game.move.reset(sp.x, sp.z, sp.y || 0);
  game.look.yaw = yawTowardCentre(sp);
  game.look.pitch = 0;
  game.bullets.clear();
  grenades.clear();
  game.pickups.clear();
  game.swapHold.reset();
  game.cooking.def = null;
  game.cooking.slot = null;
  game.els.cook.hidden = true;
  game.blindT = 0;
  game.empT = 0;
  clearDamageNumbers();
  applyEmpState(false);
  game.els.smoke.style.opacity = "0";
  game.shakeT = 0;
  game.shakeMag = 0;
  game.resetFireShake();
  game.remotes.clear();
  game.bots.clear();

  game.hill = game.currentMode().hill
    ? new Hill(pickHillPoints(game.builtMap.map.bounds, game.builtMap.spawnPoints, game.colliders))
    : null;
  setHillMarker(game.hill);

  if (game.currentMode().rounds) {
    // A map can place its own sites (Grinjuku); otherwise they're worked out
    // from the spawns. Either way they sit on open ground at y 0.
    const designed = game.builtMap.map.bombSites;
    game.bombSites = designed
      ? designed.map((s) => ({ id: s.id, x: s.x, z: s.z }))
      : pickBombSites(game.builtMap.map.bounds, game.builtMap.spawnPoints, game.colliders);
    game.bomb = new Bomb(game.bombSites);
    setBombSiteMarkers(game.bombSites);
    game.sndRound = 0;
    game.sndAttackTeam = "phantom";
  } else {
    game.bomb = null;
    game.bombSites = null;
    setBombSiteMarkers(null);
  }

  game.setActiveWeaponMesh(game.equipFromLoadout());

  if (game.spawner) {
    for (const g of game.spawner.grunts) g.dispose(game.scene);
    game.spawner = null;
  }
  game.els.rangeHud.hidden = true;
  if (game.zdir) { game.zdir.clear(); game.zdir = null; }

  if (game.rangeSet) { game.rangeSet.clear(); game.rangeSet = null; }

  if (game.isRange()) {
    game.rangeSet = new RangeSet(game.scene);
  } else if (game.isZombies()) {
    game.zdir = new ZombieDirector(game.scene, game.ARENA, game.colliders, game.builtMap.map.zombieLayout());
  } else if (!game.isPvp() && !game.isView()) {
    game.spawner = new WaveSpawner(game.scene, game.ARENA, game.spawnPoints, game.colliders);
  }

  const pvp = game.isPvp();
  const snd = game.isSnd();
  game.els.hudTeams.hidden = !pvp || game.isRoyale();
  game.els.royale.hidden = !game.isRoyale();
  updateRoyaleGear();
  // S&D keeps the wave/hostiles boxes — repurposed as round count and bomb
  // status — where every other PvP mode hides them.
  game.els.hudWaveBox.hidden = (pvp && !snd) || game.isRange();
  game.els.hudHostilesBox.hidden = (pvp && !snd) || game.isRange();
  game.els.bombStatus.hidden = !snd;
  if (game.els.touchInteract) game.els.touchInteract.hidden = !snd;
  // The Test Range info box is retired (user, 2026-09-28): N still spawns a
  // bot, and Esc has Spawn a bot / Clear bots and the full settings.
  game.els.rangeHud.hidden = true;
  game.updateRangeHud();
  document.getElementById("hud-l-wave").textContent = game.isZombies() || snd ? "Round" : "Wave";
  document.getElementById("hud-l-hostiles").textContent = game.isZombies() ? "Zombies" : (snd ? "Bomb" : "Hostiles");
  document.getElementById("hud-l-kills").textContent = game.isZombies() ? "Points" : "Kills";
  // Only Zombies keeps this box (Points); the kill count is gone (user, 2026-09-28).
  document.getElementById("hud-score-box").style.display = game.isZombies() ? "" : "none";
  game.els.respawn.hidden = true;
  game.els.scoreboard.hidden = true;

  game.els.title.hidden = true;
  game.els.gameover.hidden = true;
  game.els.pause.hidden = true;
  game.els.hud.hidden = game.isView();   // View mode: just the map on screen
  // Socialize: style.css hides the combat HUD and touch buttons off this.
  document.body.classList.toggle("to-social", game.isSocial());
  game.resetBar();
  document.body.classList.remove("to-social-drink");
  game.setTouchControls(true);
  game.gameState = "playing";

  // The range is a sandbox, not a match — there is nothing to count down to.
  if (game.isView()) {
    showWaveBanner("View mode: fly with WASD, Space up, C down, Shift fast", 3200);
  } else if (game.isSocial()) {
    // Nothing to count down to either: no bots, no clock, no score.
    game.spawnOpening = false;
    game.resetMatchClock();
    showWaveBanner(game.isTouch ? "Socialize: tap the face button for emotes" : "Socialize: H for emotes, Enter to chat", 3200);
  } else if (game.isRange()) {
    showWaveBanner("Test range — nothing here shoots back", 2600);
  } else {
    // Bots are filled here rather than on the first live frame, so the room is
    // already populated while the player watches the clock.
    if (game.isPvp() && game.net.isBotHost()) {
      const { humans, teams } = game.humanHeadcount();
      game.bots.fill(noBotsRoom() ? 0 : game.botTarget(), humans, game.botSpawn, !!game.currentMode().ffa, teams);
      game.net.botCount = game.bots.bots.length;
      for (const b of game.bots.bots) game.net.publishBot(b);
    }
    // Troll Royale: the bots wait in the sky lobby too.
    if (royale?.drop) placeBotsInLobby();
    // S&D's round 1 is set up like every later round, under this countdown.
    if (game.isSnd()) prepareSndRound();
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
  // (Under the loading screen, releaseLoad does this when it comes down.)
  if (!game.isTouch && !loadHold) {
    try { game.controls.lock(); } catch { /* refused — the pause screen catches it */ }
    setTimeout(() => {
      if (game.gameState === "playing" && !game.controls.isLocked) game.openPauseMenu();
    }, 260);
  }
}

/* What used to run at load in game.js: called from game.js where this code was. */
export function initMatchStart() {
  setInterval(() => {
    const now = performance.now();
    updateLoadScreen(Math.min(2, (now - loadClock) / 1000));
    loadClock = now;
  }, 250);
  game.matchIntro.onEnd = () => document.body.classList.remove("to-intro-on");
}
