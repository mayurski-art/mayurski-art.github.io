// Troll Forces match end: the results screen, XP and medals, then the
// between-match intermission and the map vote.

import { cancelCook } from "../combat/throwables.js?v=th1-kc2";
import { xpForMatch, xpForRun, addXp } from "../progression.js?v=p5-wst-sb2";
import { killstreakUi, achievements, clearStreakEntities } from "../streaks/calling.js?v=sk1";
import { medalSvg } from "../medals.js?v=to-medals3";
import { royale, ordinal, teardownRoyale, updateRoyaleGear } from "./royale.js?v=md1";
import { recordMatch } from "../record.js?v=rec1";
import { setHillMarker, setBombSiteMarkers } from "../core/minimap.js?v=cr1";
import { scheduleSocialReturn } from "./social.js?v=so1";
import { setNetStatus } from "../menu/lobby.js?v=lb1";
import { MAP_IDS, MAPS } from "../maps.js?v=p5tc-k9-em1-wst-tl1-bs1-tl2-sb1-rp1-dj1-cr1-db1-sb2";
import { mapShotAttrs } from "../map-load-screen.js?v=ml3-wst-tl1-ng1";
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
  const { rankedUp, rank } = addXp(gained);
  game.els.goXp.textContent = `+${gained.toLocaleString()} XP${gained > base ? " · +10% veteran bots" : ""}`;
  game.els.goRank.textContent = rankedUp ? `Level up — now LV ${rank}` : "";
  game.els.goRank.hidden = !rankedUp;
  renderMatchMedals();
  game.loadout.render();

  // addXp above already queued this XP for the account (troll_ops_xp).
  // Filing the run is separate: it feeds the leaderboard and the flat
  // game_run/high_score awards, and it no-ops for guests.
  window.TrollrunnerAccounts?.reportGameResult?.("troll-ops", game.player.wave * 10000 + game.player.kills * 10, {
    mode: game.modeId,
    kills: game.player.kills,
    deaths: game.player.deaths,
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
  finishRun(
    reason === "quit" ? "Extracted" : (zombies ? "They got you" : "You went down"),
    String(game.player.wave),
    zombies ? "Round reached" : "Wave reached",
    zombies ? "Zombies killed" : "Kills",
    "Time survived",
  );
  window.TrollLeaderboard?.report?.("troll-ops", { pvp: false, wave: game.player.wave, kills: game.player.kills });
}

export function endMatch(title) {
  game.endStaging();          // a match can be ended from outside (everyone left)
  const mode = game.currentMode();
  const headline = royale?.finalPlace ? ordinal(royale.finalPlace)
    : mode.ffa ? String(game.player.kills) : String(game.teamScores[game.net.team] ?? 0);
  const won = mode.ffa
    ? title.startsWith("You")
    : title === `${game.teamName(game.net.team)} win`;
  // Before finishRun: Comeback/Flawless/Combat Medic belong in its medal list.
  achievements.onMatchEnd({
    won, deaths: game.player.deaths, assists: game.player.assists, kills: game.player.kills,
  });
  finishRun(title, headline, royale ? "Your place" : mode.ffa ? "Your score" : "Your side", "Your kills", "Match length", { won, completed: true });

  window.TrollLeaderboard?.report?.("troll-ops", {
    pvp: true, kills: game.player.kills, deaths: game.player.deaths, won,
    assists: game.player.assists, headshots: game.player.headshots, streak: game.player.bestStreak,
  });
  // Combat record (record.js): this match onto the account'''s lifetime totals.
  recordMatch({
    won, kills: game.player.kills, deaths: game.player.deaths, assists: game.player.assists,
    headshots: game.player.headshots, bestStreak: game.player.bestStreak, score: game.player.matchScore,
    seconds: game.player.matchT, shotsFired: game.player.shotsFired, shotsHit: game.player.shotsHit,
    weaponKills: game.player.weaponKills,
  });

  game.bots.clear();
  clearStreakEntities();
  setHillMarker(null);
  setBombSiteMarkers(null);
  game.els.bombPrompt.hidden = true;
  if (game.els.pickupPrompt) game.els.pickupPrompt.hidden = true;
  game.pickups.clear();
  game.bomb = null;
  teardownRoyale();
  updateRoyaleGear();
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


const INTERMISSION = 20;          // seconds between matches
const VOTE_CANDIDATES = 3;
export let voteOptions = [];

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
  game.matchesPlayed++;
  game.net.clearVotes();
  voteOptions = pickVoteOptions();
  game.intermissionT = INTERMISSION;
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
  game.els.intermission.hidden = true;

  // Everyone tallies the same votes, so everyone loads the same map.
  const winner = game.net.voteWinner() || voteOptions[0] || game.loadout.mapId;
  game.net.clearVotes();

  if (!game.net.active) { setNetStatus("Match over. Pick a mode to drop in again."); return; }

  game.loadout.mapId = winner;
  game.els.gameover.hidden = true;
  game.roomMapHint = null;
  game.enterMatch(winner);
}
