// Troll Forces scoring: registerDeath (killfeed, medals, streaks), XP, score,
// assists, match end and the team score HUD.

import { nameFor, weaponNameFor, ASSIST_MEMORY, ASSIST_MIN_DAMAGE } from "./damage.js?v=dm1-kc2-si1-gj1-fu1b7b7dc2-wb1m1";
import { spawnComicWord, pushKillfeed, jokeVerb, showWaveBanner, updateStreakHud } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1";
import { WEAPON_DEFS } from "../weapons.js?v=p5bm-wst-hf1-fu1-wb1";
import { botEarn } from "../streaks/bot-streaks.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1";
import { SCORE, streaksAllowed, STREAK_DEFS, streakIconSvg } from "../scorestreaks.js?v=umb1-wst-sb2-fu1-wb1";
import { hero } from "../modes/umb-heroes.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1";
import { killstreakUi, achievements, streaks, streakKeyLabel } from "../streaks/calling.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1";
import { playerWon, matchWinner, matchWinnerOnTimeout } from "../modes.js?v=umb1-rn-wst-tl1-bs1-soc1-t69-u69b7b7d-wb1";
import { currentWeapon } from "./weapons.js?v=wp1-kc2-si1-gj1-fu1b7b7dc2-wb1m1";
import { resolveWeapon, defaultLoadoutFor } from "../attachments.js?v=cg1-wst-sb2-fu1-wb1";
import { XP } from "../progression.js?v=p5-wst-sb2-fu1-wb1";
import { game } from "../core/state.js?v=st1";

/* Enemy id -> when they last killed a teammate, for the Avenger medal. */
export const recentTeamKillers = new Map();
const AVENGER_WINDOW = 5000;   // ms

export function registerDeath(victimName, killerId, weaponId, opts = {}) {
  const mode = game.currentMode();
  const iDied = opts.victimIsMe;
  const killerTeam = killerId === game.net.id ? game.net.team : (game.net.peers.get(killerId)?.team || game.bots.byId(killerId)?.team);
  // Your own frag, and the Hunter-Killer's warhead catching a teammate,
  // both used to pay out as a kill — XP, streak, a point for the team.
  // Neither earns anything now; the feed still reports them honestly.
  const suicide = !killerId || (iDied && killerId === game.net.id) || (opts.victimId && opts.victimId === killerId);
  const teamkill = !suicide && !mode.ffa && !!killerTeam && killerTeam === opts.victimTeam;
  const iKilled = killerId === game.net.id && !suicide && !teamkill;
  const killer = killerId === game.net.id ? "You" : nameFor(killerId);

  // U Mad Bro?: the body flies (remote-players.js), a comic word pops over
  // it, a slide whistle follows it, and your own kills honk.
  if (mode.funny) {
    if (opts.victimPos && !opts.victimIsMe) {
      spawnComicWord(opts.victimPos, !!opts.head);
      game.audio.slideWhistle(opts.victimPos);
    }
    if (iKilled) { if (opts.head) game.audio.airhorn(); else game.audio.bonk(); }
  }

  // The Soul Blazer feeds on the dead: a kill with it goes up in hellfire.
  if (!suicide && WEAPON_DEFS[weaponId]?.hellfire && opts.victimPos && !iDied) {
    game.hellfire.killBurst(opts.victimPos);
    game.audio.soulFeed(opts.victimPos);
  }

  pushKillfeed({
    killer: suicide ? victimName : killer,
    killerIsBot: killerId !== game.net.id && !!game.bots.byId(killerId),
    victim: victimName,
    victimIsBot: !!opts.victimIsBot,
    joke: !!mode.funny && !suicide,
    weapon: suicide ? (weaponNameFor(weaponId) || "self") : mode.funny ? jokeVerb(!!opts.head) : weaponNameFor(weaponId),
    tag: teamkill ? "teamkill" : null,
    head: !!opts.head && !suicide,
    killerTeam: suicide ? opts.victimTeam : killerTeam,
    victimTeam: opts.victimTeam,
    mine: killerId === game.net.id || iDied,
    suicide,
  });

  // A bot we host got a kill: its scorestreak meter, like ours.
  const killerBot = !suicide && !teamkill && killerId !== game.net.id ? game.bots.byId(killerId) : null;
  if (killerBot) botEarn(killerBot, SCORE.kill);

  if (iKilled) {
    game.player.kills++;
    game.player.streak++;
    if (mode.funny) hero().onKill();
    if (opts.head) game.player.headshots++;
    if (weaponId) game.player.weaponKills[weaponId] = (game.player.weaponKills[weaponId] || 0) + 1;
    game.audio.kill();
    game.els.hudKills.textContent = String(game.player.kills);

    // XP lands per kill, not in a lump at the end — the immediate feedback
    // is most of what makes the grind feel like progress.
    awardKillXp();
    announceStreak(game.player.streak);
    awardScore(SCORE.kill);

    // Badges are a second layer over announceStreak's banner: that tracks
    // kills-without-dying, this one tracks kills-close-together, and BO2
    // calls out both.
    const called = killstreakUi.onKill({
      head: !!opts.head, streak: game.player.streak, distance: opts.distance || 0,
    });
    // Ordinary badges stay local; the top of the ladder is a match-wide
    // moment, so it goes on the wire.
    if (called.nuclear && game.net.active) {
      game.net.publishStreak({ kind: "callout", label: "NUCLEAR", who: game.net.name });
    }
    // Avenger: the one who just dropped a teammate (Revenge is your own
    // killer; the achievements layer has that one).
    const avengedAt = opts.victimId && recentTeamKillers.get(opts.victimId);
    if (avengedAt && performance.now() - avengedAt <= AVENGER_WINDOW) {
      recentTeamKillers.delete(opts.victimId);
      killstreakUi.medal("Avenger");
    }
    achievements.onKill({
      victimId: killerId === game.net.id ? opts.victimId : null,
      victimStreak: opts.victimStreak || 0,
      distance: opts.distance || 0,
      lastKilledBy: game.player.lastKilledBy,
    });

    if (mode.ladder) {
      game.gunGameProgress++;
      if (playerWon(mode, game.gunGameProgress)) { game.endMatch("You cleared the rack"); return; }
      const next = game.equipFromLoadout();
      game.setActiveWeaponMesh(next);
      showWaveBanner(`${game.gunGameProgress + 1} / ${mode.ladder.length} — ${next.name}`, 1400);
    }
    if (mode.oneShot) {
      // landing the shot buys the round back
      const w = currentWeapon();
      w.ammoInMag = Math.min(w.def.magSize, w.ammoInMag + 1);
    }
  }

  // First Blood is a match-wide fact, so a peer's kill closes it for us too.
  if (!iKilled && !suicide && !teamkill) achievements.noteKillByOther();

  // An enemy just dropped one of ours: killing them soon after is Avenger.
  if (!mode.ffa && !iDied && !suicide && !teamkill && killerId && killerId !== game.net.id
      && opts.victimTeam && opts.victimTeam === game.net.team) {
    recentTeamKillers.set(killerId, performance.now());
  }
  // BO2 shows it and scores nothing; medals.js pays Suicide 0.
  if (iDied && suicide && game.isPvp()) killstreakUi.medal("Suicide");

  // S&D scores round wins, not kills — sndRoundWin() owns teamScores and the
  // match-end check there instead, once the round itself is decided.
  if (!game.isSnd() && !suicide && !teamkill && killerTeam && game.teamScores[killerTeam] != null) {
    game.teamScores[killerTeam]++;
    updateTeamHud();
  }
  if (!game.isSnd()) checkMatchEnd();

  // Whatever the victim was holding falls where they stood. Our own death
  // drops from damagePlayer instead, with the exact live WeaponState — this
  // covers everyone else's (bots we host, peers, bots peers host).
  if (!opts.victimIsMe && opts.victimPos && opts.victimWeaponId && game.scavengeAllowed()) {
    const def = resolveWeapon(opts.victimWeaponId, defaultLoadoutFor(opts.victimWeaponId));
    if (def) game.pickups.drop(`${killerId}:${performance.now()}`, def, opts.victimPos);
  }
}

/* Bank XP mid-match and show it floating up. Only PvP pays as it goes; Ops
   still settles once at the end via xpForRun, which its wave curve suits. */
export function addMatchXp(amount, label) {
  if (!game.isPvp() || amount <= 0) return;
  game.player.matchXp += amount;
  showXpPopup(amount, label);
}

export function awardKillXp() {
  // The headshot bonus is the Headshot medal's +50 now (medals.js), so the
  // total is unchanged; this pop is just the kill.
  addMatchXp(XP.kill, "KILL");
}

/* Pay into the scorestreak meter. Separate from XP on purpose: XP is
   permanent and unlocks weapons, this is per-life and buys streaks. A kill
   pays into both, which is why every call site here sits next to an
   addMatchXp call. */
export function awardScore(amount) {
  game.player.matchScore += amount;   // combat record SPM, whether streaks are on or not
  if (!streaksAllowed(game.currentMode())) return;
  for (const id of streaks.addScore(amount)) {
    game.selectedStreak = id;   // newest earned, like BO2's default pick
    killstreakUi.banner({
      title: `${STREAK_DEFS[id].name} ready`,
      sub: game.isTouch ? "Tap it to call it in" : `Press ${streakKeyLabel(id)} to call it in`,
      iconSvg: streakIconSvg(id),
      tone: STREAK_DEFS[id].badge === "red" ? "red" : "gold",
    });
    game.audio.wave();
  }
  updateStreakHud();
}

const STREAK_RUNGS = new Set([3, 5, 7, 10]);

function announceStreak(n) {
  game.player.bestStreak = Math.max(game.player.bestStreak, n);
  if (!STREAK_RUNGS.has(n)) return;
  // A star medal on the splash (medals.js); its sting replaces the old
  // wave-banner chime.
  killstreakUi.medal(`${n} Kill Streak`);
}

function showXpPopup(amount, label) {
  if (!game.els.xpPopups) return;
  const div = document.createElement("div");
  div.className = "to-xp-pop";
  div.textContent = label ? `+${amount} · ${label}` : `+${amount}`;
  game.els.xpPopups.appendChild(div);
  while (game.els.xpPopups.children.length > 4) game.els.xpPopups.firstChild.remove();
  setTimeout(() => div.remove(), 1400);
}

/* Damage we've dealt to each target, so that softening someone up still
   counts when a teammate lands the last shot. Without this, 90 damage and a
   stolen kill is indistinguishable from doing nothing at all. */
export const dealtLog = new Map();       // victim id -> { dmg, last }

/* How far away each target was when we last hit it. A peer applies its own
   damage and announces its own death, so by the time we learn we killed
   someone the shot is long gone — this is the only place the range survives,
   and Longshot needs it. */
export const lastHitRange = new Map();   // victim id -> metres

export function noteDealt(targetId, amount) {
  if (!targetId || !game.isPvp()) return;
  const e = dealtLog.get(targetId) || { dmg: 0, last: 0 };
  e.dmg += amount;
  e.last = performance.now();
  dealtLog.set(targetId, e);
}

export function creditAssistIfOwed(victimId, victimName) {
  const e = dealtLog.get(victimId);
  if (!e) return;
  dealtLog.delete(victimId);
  if (performance.now() - e.last > ASSIST_MEMORY * 1000) return;
  if (e.dmg < ASSIST_MIN_DAMAGE) return;

  game.player.assists++;
  addMatchXp(XP.assist, "ASSIST");
  awardScore(SCORE.assist);
  pushKillfeed({ killer: "You", victim: victimName, assist: true, mine: true });
}

export function checkMatchEnd() {
  const mode = game.currentMode();
  if (!mode.pvp || game.gameState !== "playing") return;
  const args = {
    teamScores: game.teamScores,
    selfScore: game.player.kills,
    selfName: "You",
    peers: [...game.net.peers.values()],
  };
  const winner = matchWinner(mode, args);
  if (winner) { game.endMatch(winner); return; }
  if (mode.timeLimit && game.matchClockT !== null && game.matchClockT <= 0) {
    game.endMatch(matchWinnerOnTimeout(mode, args));
  }
}

export function updateTeamHud() {
  game.els.scorePhantom.textContent = String(game.teamScores.phantom);
  game.els.scoreGhost.textContent = String(game.teamScores.ghost);
  // How far behind we ever got, for Comeback. Free-for-all has no side to be
  // behind, so it only tracks in team modes.
  if (!game.currentMode().ffa && game.net.team) {
    const mine = game.teamScores[game.net.team] || 0;
    const theirs = game.net.team === "phantom" ? game.teamScores.ghost : game.teamScores.phantom;
    achievements.noteScores(mine, theirs);
  }
}
