// Troll Forces match end: the results screen, XP and medals, then the
// between-match intermission and the map vote.

import { clearLauncher } from "../combat/launcher.js?v=fj1-zr9-zr10-zc1-zc2-hr2-zp1-aa0-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-fs1-ut1-gf1-tg1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ls4-gb4-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2";
import { cancelCook } from "../combat/throwables.js?v=th1-kc2-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-dom1-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-fp2-lk1-hgb1-hgb2";
import { xpForMatch, xpForRun, addXp, getLevel, getPrestige, rankProgress, rankXpText } from "../progression/progression.js?v=p5-wst-sb2-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-nf1-or1-rfx1";
import { matchWeaponReport } from "../progression/weapon-xp.js?v=wx1";
import { matchLog } from "../combat/match-log.js?v=ml1-bp2";
import { renderAfterAction, hideAfterAction, afterActionData, queueBlueprint } from "./after-action.js?v=aar1-bp2-aar2-tfm2-rfx1-rfx2-rfx3-rm1-kzf1-fp2-lk1-hgb1-hgb2";
import { captureBlueprint } from "../view/blueprint-capture.js?v=bc1";
import { killstreakUi, achievements, clearStreakEntities } from "../streaks/calling.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-fs1-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ls4-gb4-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2";
import { medalSvg } from "../progression/medals.js?v=to-medals3-or1";
import { royale, ordinal, teardownRoyale, updateRoyaleGear } from "./royale.js?v=md1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-fp2-lk1-hgb1-hgb2";
import { recordMatch } from "../progression/record.js?v=rec1-or1";
import { setHillMarker, setBombSiteMarkers } from "../core/minimap.js?v=cr1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-fp2-lk1-hgb1-hgb2";
import { resetNuke } from "../streaks/nuke.js?v=tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-fp2-lk1-hgb1-hgb2";
import { teardownDomination } from "./domination.js?v=dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-fp2-lk1-hgb1-hgb2";
import { scheduleSocialReturn } from "./social.js?v=so1-si1-mb1-gj1-if1-fu1b7b7dc1c2-wb1m1c4-tc3-cup1-nc1-th2-ar2-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-aa0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-is1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-tb1-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-rm1-kzf1-fp2-lk1-hgb1-hgb2";
import { setNetStatus } from "../menu/lobby.js?v=lb1-si1-gj1-if1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-bw1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-aa0-rs1-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-fp2-lk1-hgb1-hgb2";
import { MAP_IDS, MAPS } from "../maps/maps.js?v=p5tc-k9-em1-wst-tl1-bs1-tl2-sb1-rp1-dj1-cr1-db1-sb2-db2a-db2b-db2c-db3-db4-db5-gj1-fu1b7b7dc1c2f1m1u-tc3-nc1-cd1-sh1-sg1-bw1-cw1-zr10-zh1-hr2-zp1-jb1-nh1-pi1-sr1-hl1-pf1-ub1-uw1-ug5-or1-bw2-bt1-wf1-wf2-zf1-bp1-is1-gf1-tg1-tcs1-kb0-kb1-kb2-kb3-cl1-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-tcs2-mg1-kb12-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb3-jb6-sp1-hh1-yb1-kbt1-gb1-gb3-rh1-gb4-tb1-gb5-gb7-gb8-gb9-tb2-bl1-kbb1-kbb2-dj2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-tfp1-tfp2-tfp3-tfp4-tfp7-tfb8-tfs1-ss1-ta1-ss2-ss3-ta2-tfm2-rfx1-rm1-kzf1-hgb1-hgb2";
import { mapShotAttrs } from "../maps/map-load-screen.js?v=ml3-wst-tl1-ng1-db5-gj1-fu1-sr1-ug5-or1-sp1-pv1-tb3-pv2-dm1-kbk2-tfp7-tfb8-rfx2-hgm1";
import { scheduleHubReturn } from "./zombies/hub.js?v=zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-sv1-dj2-bf1-pd1-jb1-pl2-nh1-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-bp1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-rm1-kzf1-fp2-lk1-hgb1-hgb2";
import { payRun } from "./zombies/credits.js?v=zc1-zc2";
import { game } from "../core/state.js?v=st1";

function finishRun(title, headline, headlineLabel, secondLabel, thirdLabel, opts = {}) {
  game.gameState = "gameover";
  game.player.alive = false;
  cancelCook();
  if (game.controls.isLocked) game.controls.unlock();
  game.els.hud.hidden = true;
  game.setTouchControls(false);
  game.els.gameover.hidden = false;
  game.els.goTitle.textContent = title;
  game.els.goWave.textContent = headline;
  game.els.goL1.textContent = headlineLabel;
  game.els.goKills.textContent = String(game.player.kills);
  game.els.goL2.textContent = secondLabel;
  const mins = Math.floor(game.elapsedRun / 60), secs = Math.floor(game.elapsedRun % 60);
  game.els.goTime.textContent = `${mins}:${String(secs).padStart(2, "0")}`;
  game.els.goL3.textContent = thirdLabel;

  // PvP banks XP per kill as the match runs, so only the end-of-match
  // bonuses are settled here. Ops still pays once, on its wave curve.
  const base = game.isPvp()
    ? game.player.matchXp + xpForMatch({ won: !!opts.won, completed: !!opts.completed })
    : xpForRun({ kills: game.player.kills, wave: game.player.wave });
  const gained = game.boostedXp(base);
  // The after-action report animates the rank bar from here to there.
  const levelBefore = getLevel(), fracBefore = rankProgress();
  const { rankedUp, rank } = addXp(gained);
  // Zombies: the Credits the run paid (modes/zombies/credits.js)
  const cr = opts.credits != null ? ` · +${opts.credits.toLocaleString()} Credits` : "";
  game.els.goXp.textContent = `+${gained.toLocaleString()} XP${gained > base ? " · +10% veteran bots" : ""}${cr}`;
  game.els.goRank.textContent = rankedUp ? `Level up — now LV ${rank}` : "";
  game.els.goRank.hidden = !rankedUp;
  renderMatchMedals();
  // PvP gets the Call of Duty report (modes/after-action.js) in place of the
  // three stats; Ops and Zombies runs keep the plain card.
  if (game.isPvp() && !game.isSocial()) {
    renderAfterAction(afterActionData({
      title, won: opts.won, boostedXp: gained > base,
      rank: {
        levelBefore, fracBefore, levelAfter: getLevel(), fracAfter: rankProgress(), prestige: getPrestige(),
        gained, xpText: rankXpText(), weapons: matchWeaponReport(), events: matchLog.events, counts: matchLog.counts(),
      },
    }));
  } else hideAfterAction();
  game.loadout.render();

  // addXp above already queued this XP for the account (troll_ops_xp).
  // Filing the run is separate: it feeds the leaderboard and the flat
  // game_run/high_score awards, and it no-ops for guests. It's the one
  // write: the weekly and monthly boards (modes/zombies/hub.js, the menu's
  // Leaderboards, leaderboard.js) add these rows up over their window. The
  // score stays this match's own, so high_score XP means a personal best.
  window.TrollrunnerAccounts?.reportGameResult?.("troll-ops", game.player.wave * 10000 + game.player.kills * 10, {
    mode: game.modeId,
    pvp: game.isPvp() && !game.isSocial(),
    won: !!opts.won,
    kills: game.player.kills,
    deaths: game.player.deaths,
    assists: game.player.assists || 0,
    headshots: game.player.headshots || 0,
    streak: game.player.bestStreak || 0,
    wave: game.player.wave,
    map: game.loadedMapId || game.loadout.mapId,
  });
}

/* BO2's after-action medal list: every medal this match with its count,
   most-earned first. Hidden when nothing was earned. */
function renderMatchMedals() {
  const box = game.els.goMedals;
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

export function endGame(reason) {
  const zombies = game.isZombies();
  if (zombies) game.stopZombieRun();
  // Zombies pays Credits for the run, quit or not: kills, waves, the win
  // (once: a second endGame for the same run pays nothing)
  const credits = zombies && game.gameState !== "gameover" ? payRun({ kills: game.player.kills, wave: game.player.wave, won: reason === "won" }) : (zombies ? 0 : null);
  finishRun(
    reason === "quit" ? "Extracted" : reason === "won" ? "You survived" : (zombies ? "They got you" : "You went down"),
    String(game.player.wave),
    zombies ? (reason === "won" ? "Waves cleared" : "Wave reached") : "Wave reached",
    zombies ? "Zombies killed" : "Kills",
    "Time survived",
    { won: reason === "won", credits },
  );
  // A run from the hub's pads goes back to the hub (modes/zombies/hub.js).
  if (zombies && reason !== "quit") scheduleHubReturn();
}

/* opts.won: a result fixed from outside the title (a Tactical Nuke's). */
export function endMatch(title, opts = {}) {
  game.endStaging();          // a match can be ended from outside (everyone left)
  const mode = game.currentMode();
  const headline = royale?.finalPlace ? ordinal(royale.finalPlace)
    : mode.ffa ? String(game.player.kills) : String(game.teamScores[game.net.team] ?? 0);
  const won = opts.won != null ? !!opts.won : mode.ffa
    ? title.startsWith("You")
    : title === `${game.teamName(game.net.team)} win`;
  // Before finishRun: Comeback/Flawless/Combat Medic belong in its medal list.
  achievements.onMatchEnd({
    won, deaths: game.player.deaths, assists: game.player.assists, kills: game.player.kills,
  });
  finishRun(title, headline, royale ? "Your place" : mode.ffa ? "Your score" : "Your side", "Your kills", "Match length", { won, completed: true });

  // Combat record (record.js): this match onto the account'''s lifetime totals.
  recordMatch({
    won, kills: game.player.kills, deaths: game.player.deaths, assists: game.player.assists,
    headshots: game.player.headshots, bestStreak: game.player.bestStreak, score: game.player.matchScore,
    seconds: game.player.matchT, shotsFired: game.player.shotsFired, shotsHit: game.player.shotsHit,
    weaponKills: game.player.weaponKills,
  });

  game.bots.clear();
  clearStreakEntities();
  clearLauncher();
  setHillMarker(null);
  teardownDomination();
  resetNuke();
  setBombSiteMarkers(null);
  game.els.bombPrompt.hidden = true;
  if (game.els.pickupPrompt) game.els.pickupPrompt.hidden = true;
  game.pickups.clear();
  game.bomb = null;
  teardownRoyale();
  updateRoyaleGear();
  // The report's plan of the level, drawn from the map while it's still
  // loaded and now clear of bots and streaks (modes/after-action.js).
  if (game.isPvp() && !game.isSocial()) {
    const events = matchLog.events.slice(), floorY = game.move.pos.y;
    queueBlueprint(() => captureBlueprint({
      renderer: game.renderer, scene: game.scene, colliders: game.colliders, arena: game.ARENA, floorY, events,
    }));
  }
  if (game.els.royale) game.els.royale.hidden = true;

  // The room stays up. Tearing the channel down here meant everyone had to
  // re-enter a code and re-handshake to play a second match — and quickplay
  // could shard them apart on the way back.
  // A match the owner started in the hangout: no map vote, everyone goes
  // back to Socialize.
  if (game.net.active && game.socialRoom) scheduleSocialReturn();
  else if (game.net.active) startIntermission();
  else setNetStatus("Match over. Pick a mode to drop in again.");
}


const INTERMISSION = 20;          // seconds of map vote between matches
const VOTE_CANDIDATES = 3;
export let voteOptions = [];
/* The vote's winner once its clock runs out. The next match doesn't start on
   its own (user: "dont auto start another match after one has ended"): it
   waits here, the room still up, till the player presses Drop in again. */
let heldMap = null;
export const matchHeld = () => heldMap != null;

/* "Next map — 20s" while the vote runs, "Next map — <name>" once it's settled. */
function setVoteHead(mapId) {
  const head = document.querySelector(".to-vote-head");
  if (!head) return;
  if (mapId) { head.textContent = `Next map — ${MAPS[mapId]?.name || mapId}`; game.els.voteClock = null; return; }
  head.innerHTML = `Next map — <span id="to-vote-clock">${INTERMISSION}</span>s`;
  game.els.voteClock = head.querySelector("span");
}

/* The three maps on offer. Derived from the room code and the match count so
   every client lands on the same shortlist without anyone hosting the vote. */
function pickVoteOptions() {
  const pool = MAP_IDS.filter((id) => id !== game.loadout.mapId);
  const seedSrc = `${game.net.room || ""}:${game.matchesPlayed}`;
  let seed = 0;
  for (let i = 0; i < seedSrc.length; i++) seed = (seed * 31 + seedSrc.charCodeAt(i)) >>> 0;
  const out = [];
  const avail = [...pool];
  while (out.length < Math.min(VOTE_CANDIDATES, avail.length + 0) && avail.length) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    out.push(avail.splice(seed % avail.length, 1)[0]);
  }
  // Always let people re-run the map they just played.
  if (out.length < VOTE_CANDIDATES) out.push(game.loadout.mapId);
  return out;
}

export function startIntermission() {
  heldMap = null;
  game.matchesPlayed++;
  game.net.clearVotes();
  voteOptions = pickVoteOptions();
  game.intermissionT = INTERMISSION;
  setVoteHead(null);
  renderVote();
  game.els.intermission.hidden = false;
  setNetStatus(`Match over · next map in ${INTERMISSION}s`, "live");
}

export function renderVote() {
  if (!game.els.voteList) return;
  const tally = new Map();
  const add = (m) => { if (m) tally.set(m, (tally.get(m) || 0) + 1); };
  add(game.net.myVote);
  for (const p of game.net.peers.values()) {
    if (!game.isBotPeer(p)) add(p.vote);
  }

  game.els.voteList.replaceChildren();
  for (const id of voteOptions) {
    const n = tally.get(id) || 0;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "to-vote-opt";
    btn.classList.toggle("is-mine", game.net.myVote === id);
    btn.setAttribute("aria-pressed", String(game.net.myVote === id));
    // A real shot of the map (tools/troll-ops-map-previews.mjs renders them).
    btn.innerHTML =
      `<img class="to-vote-img" ${mapShotAttrs(id, "200px")} alt="" loading="eager" draggable="false">` +
      `<span class="to-vote-row"><span class="to-vote-name">${MAPS[id]?.name || id}</span>` +
      `<span class="to-vote-n">${n ? `${n} vote${n === 1 ? "" : "s"}` : ""}</span></span>`;
    btn.querySelector("img").addEventListener("error", (e) => e.target.remove());
    btn.addEventListener("click", () => {
      game.net.castVote(id);
      renderVote();
    });
    game.els.voteList.appendChild(btn);
  }
}

export function cancelIntermission() {
  game.intermissionT = 0;
  heldMap = null;
  voteOptions = [];
  game.net.clearVotes();
  if (game.els.intermission) game.els.intermission.hidden = true;
}

/* Ticked from the frame loop so it shares the same clock as everything else. */
export function updateIntermission(dt) {
  if (game.intermissionT <= 0) return;
  game.intermissionT -= dt;
  if (game.els.voteClock) game.els.voteClock.textContent = String(Math.max(0, Math.ceil(game.intermissionT)));
  if (game.intermissionT > 0) return;
  game.intermissionT = 0;

  // Everyone tallies the same votes, so everyone lands on the same map.
  const winner = game.net.voteWinner() || voteOptions[0] || game.loadout.mapId;
  game.net.clearVotes();
  if (!game.net.active) {
    game.els.intermission.hidden = true;
    setNetStatus("Match over. Pick a mode to drop in again.");
    return;
  }
  // The vote is settled: show just the winner and wait for the player.
  heldMap = winner;
  voteOptions = [winner];
  renderVote();
  setVoteHead(winner);
  setNetStatus("Match over · Drop in again when you're ready", "live");
}

/* Drop in again during the vote or after it: straight into the map the vote
   is on (or landed on). False when no next match is waiting. */
export function joinNextMatch() {
  if (game.intermissionT <= 0 && heldMap == null) return false;
  const winner = heldMap || game.net.voteWinner() || voteOptions[0] || game.loadout.mapId;
  cancelIntermission();
  if (!game.net.active) { setNetStatus("Match over. Pick a mode to drop in again."); return true; }
  game.loadout.mapId = winner;
  game.els.gameover.hidden = true;
  game.roomMapHint = null;
  game.enterMatch(winner);
  return true;
}
