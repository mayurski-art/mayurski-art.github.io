// The Tab scoreboard: kills, deaths, assists and K/D per operator, by side
// in team modes, one ranking in free-for-all.

import { playerIconSvg } from "../progression/rank-icons.js?v=rk1-or1";
import { withClan, getMyCard } from "../progression/calling-cards.js?v=p5-wst-sb2-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-nf1-or1";
import { playerName } from "../menu/lobby.js?v=lb1-si1-gj1-if1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-bw1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-aa0-rs1-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6";
import { getLevel, getPrestige, isOwner } from "../progression/progression.js?v=p5-wst-sb2-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-nf1-or1";
import { safeUid } from "../net/chat.js?v=to-social1-or1-pc2-gf1-tw1";
import { TEAMS } from "../net/remote-players.js?v=umb3g-pc1-nf-em1-mi2-wst-ig1-bs1-sb1-cb2-rp1-hf1-sb2-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6";
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
