// The menu and pause buttons (Start, Retry, Resume, the range's bot buttons,
// Quit to the lobby), and losing pointer lock or hiding the tab opening the
// pause menu.

import { addXp } from "../progression.js?v=p5-wst-sb2-fu1";
import { setBombSiteMarkers } from "../core/minimap.js?v=cr1-gj1-fu1";
import { setNetStatus, renderLobbyRoster, showLobbyPanel } from "./lobby.js?v=lb1-si1-gj1-if1-fu1";
import { renderModes } from "./mode-picker.js?v=mp1-fu1";
import { setTouchAds } from "../input/touch.js?v=in1";
import { cancelCook } from "../combat/throwables.js?v=th1-kc2-si1-gj1-fu1";
import { returnToSocial, cancelSocialReturn } from "../modes/social.js?v=so1-si1-mb1-gj1-if1-fu1";
import { piano } from "../modes/social-rp.js?v=rp1-si1-gj1-if1-fu1";
import { game } from "../core/state.js?v=st1";

export function initMenuButtons() {
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
    // the DJ booth and the piano's keys free the mouse on purpose
    if (game.gameState === "playing" && !game.djLulz.isOpen && !piano.panel?.isOpen) game.openPauseMenu();
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
