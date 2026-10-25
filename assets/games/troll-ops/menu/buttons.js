// The menu and pause buttons (Start, Retry, Resume, the range's bot buttons,
// Quit to the lobby), and losing pointer lock or hiding the tab opening the
// pause menu.

import { addXp } from "../progression/progression.js?v=p5-wst-sb2-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-nf1-or1";
import { setBombSiteMarkers } from "../core/minimap.js?v=cr1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1";
import { setNetStatus, renderLobbyRoster, showLobbyPanel } from "./lobby.js?v=lb1-si1-gj1-if1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-bw1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-aa0-rs1-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1";
import { renderModes } from "./mode-picker.js?v=mp1-fu1b7b7d-wb1-ar1-ar2-cl1-bp1-fj1-zr9-zr10-zh1-zc1-zc2-nf1-fl1-or1-ffa1-dom1-gf1-tg1-kb9-sp1-gb2-tb1-dm1";
import { setTouchAds } from "../input/touch.js?v=in1-th2-bp1-bf1-pd1-nf1-fs1";
import { cancelCook } from "../combat/throwables.js?v=th1-kc2-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-dom1-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1";
import { returnToSocial, cancelSocialReturn } from "../modes/social.js?v=so1-si1-mb1-gj1-if1-fu1b7b7dc1c2-wb1m1c4-tc3-cup1-nc1-th2-ar2-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-aa0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-is1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-tb1-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1";
import { piano } from "../modes/social-rp.js?v=rp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-kb0-kb1-kb2-kb3-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mg1-kb12-tm2-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb2-jb3-jb4-jb5-jb6-sp1-hh1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1";
import { clubAskOpen } from "../modes/club-entry.js?v=ce1c1c2-wb1m1uc4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1";
import { hubReturnPending, returnToHub, forgetHubReturn, leaveHub } from "../modes/zombies/hub.js?v=zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-sv1-dj2-bf1-pd1-jb1-pl2-nh1-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-bp1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1";
import { kioskOpen } from "../view/zombies-kiosk.js?v=zk1-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1";
import { game } from "../core/state.js?v=st1";
import { dropPerks } from "../combat/perk-carry.js?v=pk1-cl1-bp1-fj1-zh1-zc1-zc2-nf1-fl1-or1-ffa1-dom1-gf1-tg1-kb9-sp1-gb2-tb1-dm1";

export function initMenuButtons() {
  game.els.startBtn.addEventListener("click", game.startGame);
  /* Mid-intermission this means "don't make me wait", not "reconnect" — the
     room is still up, so drop straight into the map the vote is currently on. */
  game.els.retryBtn.addEventListener("click", () => {
    if (game.intermissionT > 0) { game.intermissionT = 0.0001; return; }
    // Socialize room: same idea, straight back to the hangout.
    if (game.socialReturnSeq != null) { returnToSocial(); return; }
    // A run from the Zombies hub: back to the hub (modes/zombies/hub.js).
    if (hubReturnPending()) { returnToHub(); return; }
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
    dropPerks();
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
    forgetHubReturn();
    leaveHub();
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
    // the DJ booth, the piano's keys and the club door's 18+ question free
    // the mouse on purpose (and so does the sheriff's wanted board,
    // modes/social-sheriff.js: looked up, not imported, which would loop;
    // the town hall's Troll-o-Graph screens too, modes/social-computers.js)
    if (game.gameState === "playing" && !game.djLulz.isOpen && !kioskOpen() && !document.querySelector(".to-piano:not([hidden])") && !clubAskOpen() && !document.querySelector(".sheriff-board:not([hidden])") && !document.querySelector(".troll-o-graph:not([hidden])")) game.openPauseMenu();
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
