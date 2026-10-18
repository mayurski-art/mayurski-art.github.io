// Room bot skill: the host's tier runs the room, veteran time banks the
// +10% XP boost, and the lobby note says whose setting is in charge.

import { isStaging } from "./match-start.js?v=mst1-si1-mb1-gj1-if1-fu1b7b7dc1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-ob1-kc1-dj2-bf1-pd1-jb1-pl2-nh1-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1";
import { game } from "../core/state.js?v=st1";

export function roomBotSkill() {
  if (!game.net.active || game.net.isBotHost()) return game.bots.count ? game.bots.difficulty : null;
  const n = {};
  for (const p of game.net.peers.values()) if (p.botSkill) n[p.botSkill] = (n[p.botSkill] || 0) + 1;
  let best = null;
  for (const k in n) if (!best || n[k] > n[best]) best = k;
  return best;   // null: no bots in the room
}
const VETERAN_XP_BOOST = 0.1;   // +10% XP for a match played against veteran bots
export function syncRoomBotSkill(dt) {
  if (game.net.active && !game.net.isBotHost()) {
    const seen = roomBotSkill();
    if (seen) game.roomSkillSeen = seen;
  } else if (game.net.active && game.roomSkillSeen) {
    game.bots.difficulty = game.roomSkillSeen;   // took the bots over mid-match
  }
  // Veteran time, for the XP boost: the boost pays once veteran bots have
  // been in the match for at least half of it, so a tier flipped in the
  // last minute doesn't earn it.
  if (game.gameState !== "playing" || isStaging()) return;
  game.player.matchT += dt;
  if (roomBotSkill() === "veteran") game.player.vetBotT += dt;
  renderBotSkillNote();
}
export function veteranBoostOn() {
  return game.isPvp() && !game.isRange() && game.player.matchT > 0 && game.player.vetBotT >= game.player.matchT * 0.5;
}
/* XP as it's banked on the account: the veteran boost on top. */
export function boostedXp(amount) {
  return veteranBoostOn() ? Math.round(amount * (1 + VETERAN_XP_BOOST)) : amount;
}
/* Lobby: under the Bot skill picker, say whose setting runs the room. */
let botSkillNoteText = null;
export function renderBotSkillNote() {
  const el = document.getElementById("to-set-botskill-note");
  if (!el) return;
  let text = "Veteran bots: +10% XP";
  if (game.net.active && !game.net.isBotHost()) {
    const seen = roomBotSkill() || game.roomSkillSeen;
    text = seen
      ? `Host's bots: ${seen[0].toUpperCase() + seen.slice(1)}${seen === "veteran" ? " (+10% XP)" : ""}. Yours applies when you host.`
      : "The host's setting runs the bots. Yours applies when you host.";
  }
  if (text !== botSkillNoteText) { botSkillNoteText = text; el.textContent = text; }
}
