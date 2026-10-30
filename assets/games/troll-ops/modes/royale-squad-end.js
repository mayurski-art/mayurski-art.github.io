// Troll Forces — Troll Royale in teams, phase 5 (docs/ROYALE-SQUADS.md): the
// end screen by team. Your team's place and every teammate's kills, out or
// still standing, for the after-action Summary (modes/after-action.js
// teamHtml, from match-end.js).

import { game } from "../core/state.js?v=st1";
import { squadSize } from "./royale-squads.js?v=sq1";

/* `r`: the Royale ending (royale.js). null outside Royale in teams. */
export function squadCard(r) {
  if (!r || squadSize() < 2) return null;
  const rows = [{ name: "You", kills: game.player.kills | 0, alive: !!game.player.alive, me: true }];
  for (const rp of game.remotes.byId.values()) {
    if (rp.team !== game.net.team || rp.netId === game.net.id) continue;
    rows.push({ name: rp.peer.name || "operator", kills: rp.peer.kills | 0, alive: rp.alive });
  }
  return { place: r.finalPlace || r.place || 0, of: r.peak || 0, kills: rows.reduce((n, x) => n + x.kills, 0), rows };
}
