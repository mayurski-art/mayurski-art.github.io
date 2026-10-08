// The Tab scoreboard: kills, deaths, assists and K/D per operator, by side
// in team modes, one ranking in free-for-all.

import { playerIconSvg } from "../rank-icons.js?v=rk1";
import { withClan, getMyCard } from "../calling-cards.js?v=p5-wst-sb2-fu1-wb1";
import { playerName } from "../menu/lobby.js?v=lb1-si1-gj1-if1-fu1b7b7dc2-wb1";
import { getLevel, getPrestige, isOwner } from "../progression.js?v=p5-wst-sb2-fu1-wb1";
import { safeUid } from "../chat.js?v=to-social1";
import { TEAMS } from "../remote-players.js?v=umb3g-pc1-nf-em1-mi2-wst-ig1-bs1-sb1-cb2-rp1-hf1-sb2-gj1-fu1b7b7dc2-wb1";
import { game } from "./state.js?v=st1";

/* Kills, deaths, assists and K/D per operator. Team modes list each side
   under its score; free-for-all modes have no sides worth showing, so it's
   one ranking. Bots don't earn assists, so theirs read as a dash. */
/* Rank in front of a scoreboard name (prestige phase 2): the owner's badge,
   else the prestige or rank icon and the Troll Forces level. */
function rankChip(r) {
  if (r.owner) return `<span class="to-sb-rank"><i class="is-owner to-sb-owner">Owner</i></span>`;
  if (!r.level) return "";
  return `<span class="to-sb-rank">${playerIconSvg(r.level, r.prestige, 18)}<b>${r.level}</b></span>`;
}

export function renderScoreboard() {
  const rows = [{
    name: `${withClan(playerName(), getMyCard().clan)} (you)`, team: game.net.team, you: true, uid: game.playerUid(),
    kills: game.player.kills | 0, deaths: game.player.deaths | 0, assists: game.player.assists | 0,
    level: getLevel(), prestige: getPrestige(), owner: isOwner(),
  }];
  for (const p of game.net.peers.values()) {
    if (String(p.id).startsWith("streak-")) continue;   // drones and gunships aren't players
    rows.push({
      name: withClan(p.name, p.clan), team: p.team, you: false, uid: safeUid(p.uid),
      kills: p.kills | 0, deaths: p.deaths | 0, assists: game.isBotPeer(p) ? null : (p.assists | 0),
      level: p.level, prestige: p.prestige | 0, owner: !!p.owner,
    });
  }
  // Most kills first; fewer deaths breaks a tie.
  const rank = (a, b) => (b.kills - a.kills) || (a.deaths - b.deaths);
  const cols = `<span>K</span><span>D</span><span>A</span><span>K/D</span>`;
  const row = (r, place = null) => `<div class="to-sb-row${r.you ? " is-you" : ""}">`
    + `<span>${place != null ? `<b>${place}.</b> ` : ""}${rankChip(r)}${r.uid
      ? `<button type="button" class="to-sb-name" data-uid="${r.uid}" title="View profile">${escapeHtml(r.name)}</button>`
      : escapeHtml(r.name)}</span>`
    + `<span>${r.kills}</span><span>${r.deaths}</span><span>${r.assists ?? "–"}</span>`
    + `<span>${(r.kills / Math.max(1, r.deaths)).toFixed(2)}</span></div>`;

  let html = "";
  if (game.currentMode().ffa) {
    const all = rows.sort(rank);
    html += `<div class="to-sb-team"><div class="to-sb-head">`
      + `<span>${escapeHtml(game.currentMode().name)}</span>${cols}</div>`;
    html += all.map((r, i) => row(r, i + 1)).join("");
    html += `</div>`;
  } else {
    for (const teamId of ["phantom", "ghost"]) {
      const team = TEAMS[teamId];
      const members = rows.filter((r) => r.team === teamId).sort(rank);
      html += `<div class="to-sb-team"><div class="to-sb-head">`
        + `<span style="color:${team.ui}">${game.teamName(teamId)} · ${game.teamScores[teamId]}</span>${cols}</div>`;
      html += members.length
        ? members.map((r) => row(r)).join("")
        : `<div class="to-sb-row"><span>—</span></div>`;
      html += `</div>`;
    }
  }
  game.els.scoreboard.innerHTML = html;
}

// Peer names come off the wire, so they are never trusted as markup.
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
