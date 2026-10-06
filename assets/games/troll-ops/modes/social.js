// Troll Forces Socialize room mode: the hangout as the room's home mode,
// switching the room to a match and coming back, and the owner's mode row.

import { MAP_IDS, MAPS } from "../maps.js?v=p5tc-k9-em1-wst-tl1-bs1-tl2-sb1-rp1-dj1-cr1-db1-sb2";
import { MODES } from "../modes.js?v=umb1-rn-wst-tl1-bs1-soc1-t69-u69";
import { addXp } from "../progression.js?v=p5-wst-sb2";
import { clearStreakEntities } from "../streaks/calling.js?v=sk1-si1";
import { setHillMarker, setBombSiteMarkers } from "../core/minimap.js?v=cr1";
import { teardownRoyale } from "./royale.js?v=md1";
import { setNetStatus, renderLobbyRoster, showLobbyPanel } from "../menu/lobby.js?v=lb1-si1";
import { renderModes } from "../menu/mode-picker.js?v=mp1";
import { setTouchAds } from "../input/touch.js?v=in1";
import { cancelCook } from "../combat/throwables.js?v=th1-kc2-si1";
import { game } from "../core/state.js?v=st1";

// A Socialize room (QSOC) is a hangout until the owner, troll_runner,
// picks a real mode in the pause menu. That goes out as a "mode" message
// and everyone in the room loads into it on the same channel: bots, the
// countdown and the rest come with the mode as usual. When the match ends
// the room comes back to Socialize on its old map (no vote).
//
// `roomModeSeq` counts the switches. It rides every room note (net.modeSeq
// → `ms`), so a newcomer or anyone who missed the message follows the room,
// and a stale note can't switch anyone back. The owner's switches go up by
// two and a match ending goes up by one, so an owner switch that lands
// while clients are on their way back still wins.
//
// The owner check is client-side, like View mode and Invincible: the row
// only shows on troll_runner, and receivers only take a "mode" message from
// a peer whose state says owner. The netcode is trusting by design (net.js).

const SOCIAL_RETURN_SECONDS = 8;

function socialHomeMap() {
  if (game.socialMapId && MAP_IDS.includes(game.socialMapId)) return game.socialMapId;
  return MAP_IDS.includes(game.loadedMapId) ? game.loadedMapId : game.loadout.versusMapId;
}

/* Everyone moves at once, so split sides by a shared order rather than
   chooseTeam's live headcount (each client would read it before the others
   had switched). */
function joinRoomSide() {
  if (game.isSocial()) { game.net.setTeam("phantom"); return; }
  const ids = [game.net.id];
  for (const p of game.net.peers.values()) if (!game.isBotPeer(p)) ids.push(p.id);
  ids.sort();
  game.net.setTeam(ids.indexOf(game.net.id) % 2 === 0 ? "phantom" : "ghost");
}

function switchRoomMode(id, map, seq) {
  if (!game.socialRoom || !MODES[id]?.pvp || MODES[id].hidden || !(seq > game.roomModeSeq)) return false;
  game.roomModeSeq = game.net.modeSeq = seq;
  cancelSocialReturn();
  if (game.isSocial() && game.loadedMapId) game.socialMapId = game.loadedMapId;
  const mapHint = map && MAPS[map] ? map : null;
  // Still connecting (startGame hasn't entered the room's match yet): it
  // picks the room's mode and map up from here.
  if (game.gameState === "menu") {
    game.modeId = id;
    game.roomMapHint = mapHint;
    if (game.loadScreen.isOpen) game.loadScreen.setMap(game.loadInfo(game.matchMapId(mapHint)));
    return true;
  }
  // XP banked this match is kept, the same as leaving.
  if (game.player.matchXp > 0) { addXp(game.boostedXp(game.player.matchXp)); game.player.matchXp = 0; }
  // The host's bots leave everyone's screens now, not on a 5s timeout.
  for (const b of game.bots.bots) game.net.dropBot(b.id);
  game.bots.clear();
  clearStreakEntities();
  setHillMarker(null);
  setBombSiteMarkers(null);
  if (game.els.bombPrompt) game.els.bombPrompt.hidden = true;
  if (game.els.pickupPrompt) game.els.pickupPrompt.hidden = true;
  game.pickups.clear();
  game.bomb = null;
  teardownRoyale();   // before endStaging, or a sky lobby would launch its bus
  game.endStaging();
  game.cancelIntermission();
  game.stopEmote();
  game.emoteWheel.close(true);
  if (!game.els.pause.hidden) game.closePauseMenu();
  game.modeId = id;
  joinRoomSide();
  game.els.gameover.hidden = true;
  game.roomMapHint = mapHint;
  game.loadScreen.show(game.loadInfo(game.matchMapId(mapHint)));
  setNetStatus(`Live · room ${game.net.room} · ${game.currentMode().name}`, "live");
  game.enterMatch(mapHint);
  return true;
}

/* A room note (stage, ready, go) or "mode" message carrying a newer mode
   count than ours: follow it. True when it switched us. */
export function adoptRoomMode(m) {
  if (!game.socialRoom || !m || !m.mode) return false;
  const ms = m.ms | 0;
  if (ms <= game.roomModeSeq) return false;
  // Already hanging out (we joined after the room came back): just catch
  // the count up rather than reload the hangout we're standing in.
  if (m.mode === "social" && game.isSocial() && game.gameState !== "menu" && game.gameState !== "gameover") {
    game.roomModeSeq = game.net.modeSeq = ms;
    return false;
  }
  return switchRoomMode(m.mode, m.map, ms);
}

/* The owner's pick from the pause menu. */
export function ownerSwitchRoomMode(id) {
  if (!game.isTrollRunner() || !game.socialRoom || !game.net.active) return;
  const seq = game.roomModeSeq + 2;
  const map = MODES[id]?.forceMap || (id === "social" ? socialHomeMap() : (MAP_IDS.includes(game.loadedMapId) ? game.loadedMapId : socialHomeMap()));
  if (!switchRoomMode(id, map, seq)) return;
  game.net.publishMode(id, map, seq);
}

export function scheduleSocialReturn() {
  cancelSocialReturn();
  const seq = game.roomModeSeq;
  game.socialReturnSeq = seq;
  game.els.retryBtn.textContent = "Back to the hangout";
  setNetStatus(`Match over · back to the hangout in ${SOCIAL_RETURN_SECONDS}s`, "live");
  game.socialReturnTimer = setTimeout(returnToSocial, SOCIAL_RETURN_SECONDS * 1000);
}

export function returnToSocial() {
  const seq = game.socialReturnSeq;
  cancelSocialReturn();
  // The owner switched again in the meantime: that wins.
  if (seq == null || seq !== game.roomModeSeq || !game.socialRoom || !game.net.active) return;
  switchRoomMode("social", socialHomeMap(), seq + 1);
}

export function cancelSocialReturn() {
  clearTimeout(game.socialReturnTimer);
  game.socialReturnTimer = 0;
  if (game.socialReturnSeq != null) game.els.retryBtn.textContent = "Drop in again";
  game.socialReturnSeq = null;
}

/* The owner's room-mode row in the pause menu: troll_runner, in a
   Socialize room, only. */
const ROOM_MODE_IDS = ["social", "tdm", "koth", "snd", "infection", "oitc", "gungame", "umb", "royale"];
export function renderRoomModeRow() {
  const row = document.getElementById("to-set-roommode-row");
  const sel = document.getElementById("to-set-roommode");
  if (!row || !sel) return;
  row.hidden = !(game.isTrollRunner() && game.socialRoom && game.net.active);
  if (row.hidden) return;
  if (!sel.options.length) {
    for (const id of ROOM_MODE_IDS) {
      if (!MODES[id]) continue;
      const o = document.createElement("option");
      o.value = id;
      o.textContent = MODES[id].name;
      sel.appendChild(o);
    }
  }
  // Offer the other side of where the room is: a mode from the hangout,
  // the hangout from a mode.
  sel.value = game.isSocial() ? "tdm" : "social";
}

/* What used to run at load in game.js: called from game.js where this code was. */
export function initSocial() {
  document.getElementById("to-set-roommode-go")?.addEventListener("click", () => {
    const id = document.getElementById("to-set-roommode")?.value;
    if (id) ownerSwitchRoomMode(id);
  });

  game.els.startBtn.addEventListener("click", game.startGame);
  /* Mid-intermission this means "don't make me wait", not "reconnect" — the
     room is still up, so drop straight into the map the vote is currently on. */
  game.els.retryBtn.addEventListener("click", () => {
    if (game.intermissionT > 0) { game.intermissionT = 0.0001; return; }
    // Socialize room: same idea, straight back to the hangout.
    if (game.socialReturnSeq != null) { returnToSocial(); return; }
    game.startGame();
  });
  // Touch has no pointer lock to re-take, so Resume just closes the menu —
  // it used to do nothing there, stranding the player in the pause menu.
  game.els.resumeBtn.addEventListener("click", game.resumePlay);
  game.els.rangeSpawnBot?.addEventListener("click", game.spawnRangeBot);
  game.els.pauseSpawnBot?.addEventListener("click", game.spawnRangeBot);
  game.els.pauseClearBots?.addEventListener("click", game.clearRangeBots);
  game.els.quitBtn.addEventListener("click", () => {
    // Quitting mid-match used to just discard player.matchXp — every kill's
    // banked XP for the session, gone, with no result screen to explain why.
    // finishRun settles it normally on a real match end; here there's no
    // result screen to show, so just fold the banked amount into the total.
    if (game.isPvp() && game.gameState === "playing" && game.player.matchXp > 0) {
      addXp(game.boostedXp(game.player.matchXp));
      game.player.matchXp = 0;
    }
    game.gameState = "menu";
    if (game.modeId === "view") game.modeId = game.viewPrevMode || "ops";
    // Left a Socialize room (maybe mid owner-started match): the lobby is
    // back on Socialize, and the room's mode count is forgotten.
    if (game.socialRoom) {
      game.socialRoom = false;
      game.roomModeSeq = game.net.modeSeq = 0;
      game.socialMapId = null;
      game.modeId = "social";
      renderModes();
    }
    cancelSocialReturn();
    document.body.classList.remove("to-social", "to-social-drink");
    game.resetBar();
    game.townNpcs?.dispose();
    game.townNpcs = null;
    game.localPauseOnly = false;
    game.endStaging();
    game.cancelIntermission();
    setBombSiteMarkers(null);
    if (game.els.bombPrompt) game.els.bombPrompt.hidden = true;
    if (game.els.pickupPrompt) game.els.pickupPrompt.hidden = true;
    game.pickups.clear();
    game.bomb = null;
    game.net.stop();
    game.chat.clear();
    game.remotes.clear();
    setNetStatus("Share the code with whoever you want in the match.");
    game.els.pause.hidden = true;
    game.els.hud.hidden = true;
    setTouchAds(false);
    game.setTouchControls(false);
    game.els.title.hidden = false;
    game.loadout.render();
    renderLobbyRoster();
    game.roomSkillSeen = null;
    game.renderBotSkillNote();
    showLobbyPanel("deploy");
  });

  game.controls.addEventListener("lock", () => { game.closePauseMenu(); game.chat.setInteractive(false); });
  game.controls.addEventListener("unlock", () => {
    game.chat.setInteractive(true);
    cancelCook();
    if (game.gameState === "playing" && !game.djLulz.isOpen) game.openPauseMenu();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelCook();
    if (document.hidden && game.gameState === "playing") game.openPauseMenu();
    // Backgrounding the tab is also the last reliable moment to flush banked
    // match XP — a closed tab never runs another frame, so this can't wait
    // for the "playing" branch above's later logic or a normal match end.
    if (document.hidden && game.isPvp() && game.player.matchXp > 0) {
      addXp(game.boostedXp(game.player.matchXp));
      game.player.matchXp = 0;
    }
  });
}
