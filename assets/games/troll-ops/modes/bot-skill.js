// Room bot skill: the host's tier runs the room, veteran time banks the
// +10% XP boost, and the lobby note says whose setting is in charge.

import { isStaging } from "./match-start.js?v=mst1-si1-mb1-gj1-if1-fu1b7b7dc1c2c3f1";
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
