// Troll Forces: the pre-match map vote, Black Ops 2 style (user, 2026-10-22:
// "i would like to see like the map voting and preview as well prior to
// users starting the matches").
//
// Public Match is a lobby. Everyone on that screen for the same mode is in
// it, and nobody hosts it: the shortlist (three maps) comes from the mode
// and the wall clock's 30-second round, so every tab offers the same three.
// Each tab puts its vote and whether it's ready on the site presence
// channel (menu/online.js activity, state "lobby"), so every tab counts the
// same votes. When a round runs out, every ready tab drops into the mode's
// public room on the winner: the first one in hosts it on that map and the
// rest follow the host's map (match-start.js followsHostMap). Alone in the
// lobby, Find Match goes straight in on your pick.
//
// A mode whose public room already has a match on skips the vote (you join
// that match on its map), and so does a mode that always plays one map.

import { MAPS } from "../maps/maps.js?v=p5tc-k9-em1-wst-tl1-bs1-tl2-sb1-rp1-dj1-cr1-db1-sb2-db2a-db2b-db2c-db3-db4-db5-gj1-fu1b7b7dc1c2f1m1u-tc3-nc1-cd1-sh1-sg1-bw1-cw1-zr10-zh1-hr2-zp1-jb1-nh1-pi1-sr1-hl1-pf1-ub1-uw1-ug5-or1-bw2-bt1-wf1-wf2-zf1-bp1-is1-gf1-tg1-tcs1-kb0-kb1-kb2-kb3-cl1-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-tcs2-mg1-kb12-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb3-jb6-sp1-hh1-yb1-kbt1-gb1-gb3-rh1-gb4-tb1";
import { mapShotAttrs } from "../maps/map-load-screen.js?v=ml3-wst-tl1-ng1-db5-gj1-fu1-sr1-ug5-or1-sp1-pv1";

export const ROUND_MS = 30000;
const CANDIDATES = 3;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/* The round we're in and the ms left in it (the same on every tab, give or
   take the clocks). */
export function round(now = Date.now()) {
  return { idx: Math.floor(now / ROUND_MS), left: ROUND_MS - (now % ROUND_MS) };
}

/* The three maps on offer for `mode` this round, out of `pool` (map ids, in
   the lobby's order). Seeded like the intermission's shortlist
   (modes/match-end.js), so every tab picks the same three. */
export function candidates(mode, pool, idx = round().idx) {
  const src = `${mode}:${idx}`;
  let seed = 0;
  for (let i = 0; i < src.length; i++) seed = (seed * 31 + src.charCodeAt(i)) >>> 0;
  const avail = [...pool], out = [];
  while (out.length < CANDIDATES && avail.length) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    out.push(avail.splice(seed % avail.length, 1)[0]);
  }
  return out;
}

/* The lobby's state: our vote and readiness, and everyone else's off the
   roster. `others` is the roster's players minus us (menu/online.js
   onlinePlayers, filtered by the caller). */
export const lobby = { mode: null, vote: null, ready: false, idx: -1 };

export function enterLobby(mode) {
  if (lobby.mode !== mode) { lobby.vote = null; lobby.ready = false; }
  lobby.mode = mode;
}
export function leaveLobby() { lobby.mode = null; lobby.vote = null; lobby.ready = false; }

/* What this tab says on the presence channel while it's in the lobby, or
   null (menu/online.js uses it in place of the plain "menu" activity). */
export function lobbyActivity(modeName) {
  if (!lobby.mode) return null;
  return { game: "tf", state: "lobby", mode: lobby.mode, modeName, map: lobby.vote, ready: lobby.ready };
}

/* Everyone in this mode's lobby but us, and the votes: ours plus theirs,
   counted only for maps on this round's shortlist. Ties go to the earlier
   map on the list, so every tab crowns the same winner. */
export function tally(others, cands) {
  const inLobby = others.filter((p) => p.activity?.game === "tf" && p.activity.state === "lobby" && p.activity.mode === lobby.mode);
  const votes = new Map(cands.map((id) => [id, 0]));
  const add = (id) => { if (votes.has(id)) votes.set(id, votes.get(id) + 1); };
  add(lobby.vote);
  for (const p of inLobby) add(p.activity.map);
  let winner = cands[0] || null;
  for (const id of cands) if (votes.get(id) > votes.get(winner)) winner = id;
  return { inLobby, votes, winner, ready: inLobby.filter((p) => p.activity.ready).length + (lobby.ready ? 1 : 0) };
}

const clock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `0:${String(s).padStart(2, "0")}`; };
const shot = (id, sizes, cls = "") => `<img class="${cls}" ${mapShotAttrs(id, sizes)} alt="" draggable="false">`;

/* The panel in the lobby's middle. `view` is one of
   { kind: "vote", cands, t (tally), hot (map id to show big) }
   { kind: "live", server (menu/online.js serverList entry) }
   { kind: "fixed", map (id) } */
export function renderPanel(host, view) {
  let html = "";
  if (view.kind === "vote") {
    const { cands, t, hot } = view;
    const big = hot && cands.includes(hot) ? hot : lobby.vote || t.winner;
    const total = [...t.votes.values()].reduce((a, b) => a + b, 0);
    html = `<header><b>Map vote</b><span class="to-mv-clock" aria-label="Vote ends in">${clock(round().left)}</span></header>`
      + `<figure class="to-mv-big">${big ? shot(big, "560px") : ""}<figcaption><b>${esc(MAPS[big]?.name || big || "")}</b>${big === t.winner && total ? `<small>Winning</small>` : ""}</figcaption></figure>`
      + `<ol class="to-mv-cards">${cands.map((id) => {
        const n = t.votes.get(id) || 0;
        const cls = [id === lobby.vote && "is-mine", id === big && "is-hot", id === t.winner && total && "is-lead"].filter(Boolean).join(" ");
        return `<li class="${cls}" data-map="${esc(id)}">${shot(id, "180px")}<span><b>${esc(MAPS[id]?.name || id)}</b><i>${n} vote${n === 1 ? "" : "s"}</i></span>`
          + `<em style="--p:${total ? n / total : 0}"></em></li>`;
      }).join("")}</ol>`;
    // No line under it saying who's in the lobby and how Find Match works
    // (user, 2026-10-22: "make sure the description lines in the game is
    // removed including the 'in the lobby: ...' text"); Find Match's row
    // still counts who's ready.
  } else if (view.kind === "live") {
    const s = view.server;
    html = `<header><b>Match in progress</b><span class="to-mv-clock">${s.players.length} playing</span></header>`
      + `<figure class="to-mv-big">${s.map ? shot(s.map, "560px") : ""}<figcaption><b>${esc(s.mapName || "")}</b></figcaption></figure>`;
  } else if (view.kind === "fixed") {
    html = `<header><b>Map</b></header>`
      + `<figure class="to-mv-big">${shot(view.map, "560px")}<figcaption><b>${esc(MAPS[view.map]?.name || view.map)}</b></figcaption></figure>`;
  }
  /* A phone shows it as a sheet over the lobby (menu-bo2.js): a close
     button, and the lobby's go button at the foot. */
  if (view.sheet && html) {
    const { label, value } = view.sheet;
    html = html.replace("</header>", `<button type="button" class="to-mv-close" aria-label="Close the map vote">&times;</button></header>`)
      + `<footer class="to-mv-foot"><button type="button" class="to-mv-go">${esc(label)}${value ? `<small>${esc(value)}</small>` : ""}</button></footer>`;
  }
  host.innerHTML = html;
  for (const img of host.querySelectorAll("img")) img.addEventListener("error", () => img.remove());
}

/* Only the clock, between full redraws. */
export function tickClock(host) {
  const c = host.querySelector(".to-mv-clock[aria-label]");
  if (c) c.textContent = clock(round().left);
}
