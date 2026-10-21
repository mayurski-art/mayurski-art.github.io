// Troll Forces Socialize room mode: the hangout as the room's home mode,
// switching the room to a match and coming back, and the owner's mode row.

import { MAP_IDS, MAPS } from "../maps/maps.js?v=p5tc-k9-em1-wst-tl1-bs1-tl2-sb1-rp1-dj1-cr1-db1-sb2-db2a-db2b-db2c-db3-db4-db5-gj1-fu1b7b7dc1c2f1m1u-tc3-nc1-cd1-sh1-sg1-bw1-cw1-zr10-zh1-hr2-zp1-jb1-nh1-pi1-sr1-hl1-pf1-ub1-uw1-ug5-or1-bw2-bt1-wf1-wf2-zf1-bp1-is1-gf1-tg1-tcs1";
import { MODES } from "./modes.js?v=umb1-rn-wst-tl1-bs1-soc1-t69-u69b7b7d-wb1-ar1-ar2-zh1-fl1-or1-ffa1-dom1-gf1-tg1";
import { addXp } from "../progression/progression.js?v=p5-wst-sb2-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-nf1-or1";
import { clearStreakEntities } from "../streaks/calling.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-fs1-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1";
import { setHillMarker, setBombSiteMarkers } from "../core/minimap.js?v=cr1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1";
import { resetNuke } from "../streaks/nuke.js?v=tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1";
import { teardownDomination } from "./domination.js?v=dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1";
import { teardownRoyale } from "./royale.js?v=md1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1";
import { setNetStatus } from "../menu/lobby.js?v=lb1-si1-gj1-if1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-bw1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-aa0-rs1-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1";
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
  teardownDomination();
  resetNuke();
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
const ROOM_MODE_IDS = ["social", "tdm", "ffa", "dom", "koth", "snd", "infection", "oitc", "gungame", "umb", "royale"];
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
}
