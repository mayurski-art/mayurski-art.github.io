// Troll Forces objective modes: King of the Hill scoring and Search &
// Destroy (sites, plant/defuse, bots on the bomb, rounds, halftime).

import { updateTeamHud, checkMatchEnd, awardScore, addMatchXp } from "../combat/scoring.js?v=sc1-kc2-si1-gj1-fu1b7b7dc2";
import { SCORE } from "../scorestreaks.js?v=umb1-wst-sb2-fu1";
import { XP } from "../progression.js?v=p5-wst-sb2-fu1";
import * as THREE from "three";
import { groundHeightAt } from "../movement.js?v=umb2-sb2-gj1b7";
import { explosionFx, grenades } from "../combat/throwables.js?v=th1-kc2-si1-gj1-fu1b7b7dc2";
import { damagePlayer, updateSpawnGuardHud, clearDeathVisuals, yawTowardCentre } from "../combat/damage.js?v=dm1-kc2-si1-gj1-fu1b7b7dc2";
import { PLANT_TIME, DEFUSE_TIME, matchWinner } from "../modes.js?v=umb1-rn-wst-tl1-bs1-soc1-t69-u69b7b7d";
import { showWaveBanner, updateStreakHud } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2";
import { achievements, streaks, uavUntil, vsatUntil, clearStreakEntities, streakEntities } from "../streaks/calling.js?v=sk1-si1-gj1-fu1b7b7dc2";
import { TEAMS } from "../remote-players.js?v=umb3g-pc1-nf-em1-mi2-wst-ig1-bs1-sb1-cb2-rp1-hf1-sb2-gj1-fu1b7b7dc2";
import { isSyntheticId } from "../net.js?v=umb3-rm1-ld2-em1-sb1-cb1-rp1-p22-bh1b7";
import { royale, royaleBotObjective } from "./royale.js?v=md1-gj1-fu1b7b7dc2";
import { CarePackage, VtolWarship } from "../streak-entities.js?v=vsat2-hk1";
import { game } from "../core/state.js?v=st1";


let hillHeldT = 0;   // seconds we've personally stood on the hill

export function scoreHill() {
  let phantom = 0, ghost = 0;
  const tally = (team) => { if (team === "ghost") ghost++; else phantom++; };
  const onHill = game.player.alive && game.hill.contains(game.move.pos.x, game.move.pos.z);
  if (onHill) tally(game.net.team);
  for (const rp of game.remotes.byId.values()) {
    if (rp.alive && game.hill.contains(rp.pos.x, rp.pos.z)) tally(rp.team);
  }
  if (phantom > ghost) game.teamScores.phantom += phantom;
  else if (ghost > phantom) game.teamScores.ghost += ghost;
  if (phantom || ghost) { updateTeamHud(); checkMatchEnd(); }

  // Holding the objective is worth XP, but paid in blocks — this runs once a
  // second and a popup every second would be noise.
  if (!onHill) { hillHeldT = 0; return; }
  // Score ticks every second the hill is held, unlike the XP block below —
  // objective play is meant to build streaks as fast as killing does.
  awardScore(SCORE.objectiveTick);
  if (++hillHeldT >= 5) { hillHeldT = 0; addMatchXp(XP.objective, "HOLDING"); }
}

const SND_SITE_RADIUS = 5.5;   // must match the visual ring in setBombSiteMarkers

export function siteUnderfoot() {
  for (const s of game.bombSites) if (Math.hypot(game.move.pos.x - s.x, game.move.pos.z - s.z) <= SND_SITE_RADIUS) return s;
  return null;
}

/* Who's still alive on each side, from our own state plus whatever the wire
   has told us about everyone else. Both sides need this every tick: an
   all-dead attacking team loses before the bomb goes off, an all-dead
   defending team loses the instant the bomb is live (no more need to defuse
   it — the fight for the site is already over). */
function isCarrierAlive() {
  if (!game.bomb.carrierId) return false;
  if (game.bomb.carrierId === game.net.id) return game.player.alive;
  return !!game.remotes.byId.get(game.bomb.carrierId)?.alive;
}

function livingAttackerIds() {
  const ids = [];
  if (game.player.alive && game.net.team === game.sndAttackTeam) ids.push(game.net.id);
  for (const rp of game.remotes.byId.values()) {
    if (rp.alive && rp.team === game.sndAttackTeam) ids.push(rp.netId);
  }
  return ids;
}

export function sndAliveCounts() {
  let attackers = 0, defenders = 0;
  if (game.player.alive) { if (game.net.team === game.sndAttackTeam) attackers++; else defenders++; }
  for (const rp of game.remotes.byId.values()) {
    if (!rp.alive) continue;
    if (rp.team === game.sndAttackTeam) attackers++; else defenders++;
  }
  return { attackers, defenders };
}

export function updateSnd(dt) {
  const isAttacker = game.net.team === game.sndAttackTeam;
  const wasPlanted = game.bomb.state === "planted";
  if (wasPlanted && game.bomb.update(dt)) {
    const s = game.bomb.siteAt(game.bomb.site);
    const at = new THREE.Vector3(s.x, (groundHeightAt(game.colliders, s.x, s.z, 1) ?? 0) + 0.5, s.z);
    explosionFx({ kind: "lethal", glow: 0xffb347, radius: 14 }, at);
    // The blast is the round-ender, not a weapon: it kills whoever stayed.
    if (game.player.alive && Math.hypot(game.move.pos.x - s.x, game.move.pos.z - s.z) < 9) damagePlayer(500, null, "bomb", false, at);
    sndRoundWin(game.sndAttackTeam, "bomb detonated");
  }

  // Status line: fuse once planted, otherwise the plant clock — and a callout
  // when someone else is on the bomb, which you'd hear in a real match.
  if (!game.sndRoundOver) {
    game.els.bombTimer.hidden = !sndLive;
    const planted = game.bomb.state === "planted";
    const secs = Math.ceil(planted ? game.bomb.fuse : game.sndClock);
    const text = planted ? `${secs}s` : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
    if (game.els.bombTimer.textContent !== text) game.els.bombTimer.textContent = text;
    game.els.bombTimer.classList.toggle("is-planted", planted);
    let side = planted
      ? (isAttacker ? `Defend the plant — site ${game.bomb.site}` : `Defuse site ${game.bomb.site}`)
      : (isAttacker ? (game.bomb.carrierId === game.net.id ? "You have the bomb" : "Plant the bomb") : "Defend the sites");
    if (game.remoteBombAct && game.remoteBombAct.until > performance.now() && !game.bomb.action) {
      side = game.remoteBombAct.kind === "plant" ? `Bomb being planted — site ${game.remoteBombAct.site}!` : "Bomb being defused!";
    }
    if (game.els.bombSide.textContent !== side) game.els.bombSide.textContent = side;
  }

  // Down players spectate the round out rather than respawning — S&D is one
  // life a round. The elimination check below still needs their team's alive
  // count, so this only stops the countdown text, not the tally.
  if (!game.player.alive) {
    if (!game.sndEliminated) {
      game.sndEliminated = true;
      game.els.respawnText.textContent = "Eliminated — waiting for the round";
      game.els.respawn.hidden = false;
    }
  } else if (game.player.spawnGuard > 0) {
    game.player.spawnGuard -= dt;
    if (game.player.spawnGuard <= 0) { game.player.spawnGuard = 0; updateSpawnGuardHud(); }
    else if (game.els.spawnGuard?.hidden) updateSpawnGuardHud();
  }

  if (game.sndRoundOver || !sndLive) return;
  sndLiveT += dt;

  // The plant clock. The bot host calls time and tells the room; everyone
  // else waits a beat for that call before deciding it themselves, so a
  // lost packet can't leave one client stuck in an expired round.
  if (game.bomb.state !== "planted") {
    game.sndClock = Math.max(0, game.sndClock - dt);
    if (game.sndClock <= 0) {
      if (!game.net.active || game.net.isBotHost()) {
        if (game.net.active) game.net.publishBomb({ kind: "event", action: "timeup" });
        sndRoundWin(sndDefendTeam(), "time expired");
        return;
      }
      sndTimeupWait += dt;
      if (sndTimeupWait > 1.5) { sndRoundWin(sndDefendTeam(), "time expired"); return; }
    }
  }

  // Elimination. Attackers wiped before a plant lose; defenders wiped before
  // a plant lose too (post-plant the fuse decides — a bomb ticking with
  // nobody left to defuse just goes off). A side that never had anyone on
  // it (a solo room) can't be "eliminated" — the clock handles that. The
  // grace period covers peers whose alive flag is still last round's.
  const { attackers, defenders } = sndAliveCounts();
  sndSeen.attackers = Math.max(sndSeen.attackers, attackers);
  sndSeen.defenders = Math.max(sndSeen.defenders, defenders);
  if (sndLiveT > SND_GRACE && game.bomb.state !== "planted") {
    if (sndSeen.attackers > 0 && attackers <= 0) { sndRoundWin(sndDefendTeam(), "attackers eliminated"); return; }
    if (sndSeen.defenders > 0 && defenders <= 0) { sndRoundWin(game.sndAttackTeam, "defenders eliminated"); return; }
  }

  // The carrier died holding it: it doesn't need a physical pickup prop for
  // a first cut of this mode — it just passes to the next living attacker,
  // lowest id first, so every client picks the same one independently. Only
  // the bot host actually assigns it, same authority that owns bot state.
  if (game.bomb.state === "carried" && !isCarrierAlive() && (game.net.isBotHost() || !game.net.active)) {
    const next = pickCarrier();
    if (next && next !== game.bomb.carrierId) {
      game.bomb.carrierId = next;
      if (game.net.active) game.net.publishBomb({ kind: "event", action: "carrier", carrierId: next });
    }
  }

  // Plant/defuse: only the acting player's own client drives its own
  // progress, and only while a live interact press is actually held.
  const isCarrier = game.bomb.carrierId === game.net.id;
  const onSite = isAttacker && isCarrier && game.bomb.state === "carried" ? siteUnderfoot() : null;
  const canDefuse = !isAttacker && game.bomb.state === "planted" && siteUnderfoot()?.id === game.bomb.site;
  game.sndCanInteract = !!(onSite || canDefuse);
  const acting = game.player.alive && game.sndInteractHeld && (onSite || canDefuse);

  if (acting) {
    const kind = onSite ? "plant" : "defuse";
    const need = kind === "plant" ? PLANT_TIME : DEFUSE_TIME;
    if (!game.bomb.action || game.bomb.action.by !== game.net.id || game.bomb.action.kind !== kind) {
      game.bomb.action = { kind, by: game.net.id, progress: 0, site: onSite?.id };
    }
    game.bomb.action.progress += dt;
    game.els.bombPrompt.hidden = false;
    game.els.bombPromptText.textContent = kind === "plant" ? `Planting site ${onSite.id}…` : `Defusing…`;
    game.els.bombBarFill.style.width = `${Math.min(100, (game.bomb.action.progress / need) * 100)}%`;
    if (game.isPvp() && game.net.active) game.net.publishBomb({ kind: "action", action: kind, by: game.net.id, progress: game.bomb.action.progress, site: onSite?.id });

    if (game.bomb.action.progress >= need) {
      if (kind === "plant") {
        game.bomb.plant(onSite.id);
        game.audio.wave();
        showWaveBanner(`Bomb planted — site ${onSite.id}`, 1800);
        if (game.net.active) game.net.publishBomb({ kind: "event", action: "planted", site: onSite.id });
        awardScore(SCORE.plant);
        achievements.award("bombtech");
      } else {
        game.bomb.defuse();
        sndRoundWin(sndDefendTeam(), "bomb defused");
        if (game.net.active) game.net.publishBomb({ kind: "event", action: "defused" });
        awardScore(SCORE.defuse);
        achievements.award("bombtech");
      }
      game.bomb.action = null;
      game.els.bombPrompt.hidden = true;
    }
  } else if (game.bomb.action?.by === game.net.id) {
    // Let go, moved off the site, or died mid-plant — the attempt doesn't
    // carry over; the next hold starts the timer from zero, same as CoD.
    game.bomb.action = null;
    game.els.bombPrompt.hidden = true;
    if (game.isPvp() && game.net.active) game.net.publishBomb({ kind: "event", action: "cancel" });
  } else if (!game.bomb.action) {
    if (onSite) { game.els.bombPrompt.hidden = false; game.els.bombPromptText.textContent = `Plant (site ${onSite.id})`; game.els.bombBarFill.style.width = "0%"; }
    else if (canDefuse) { game.els.bombPrompt.hidden = false; game.els.bombPromptText.textContent = "Defuse"; game.els.bombBarFill.style.width = "0%"; }
    else game.els.bombPrompt.hidden = true;
  }

  if (game.net.isBotHost() || !game.net.active) updateSndBots(dt);
}

// -------------------- Search & Destroy round flow --------------------

export function sndDefendTeam() { return game.sndAttackTeam === "phantom" ? "ghost" : "phantom"; }

/* Round timing. There used to be no clock at all, and bots respawned on
   their normal 5s timer, so with bots in the room the attackers could never
   be wiped and a bomb nobody planted meant a round that never ended. */
const SND_ROUND_TIME = 120;   // seconds to get a plant down, or the defenders win
const SND_GRACE = 1.5;        // after go-live, before elimination is judged
const SND_BOT_SITE_R = SND_SITE_RADIUS - 1.2;   // how far onto a site a bot walks before acting

export let sndLive = false;          // countdown cleared, round in play
let sndLiveT = 0;             // seconds since go-live
let sndTimeupWait = 0;        // non-host: how long we've sat at 0 waiting for the host's call
const sndSeen = { attackers: 0, defenders: 0 };   // most alive at once this round
let sndBotAction = null;      // { botId, kind, progress, site } — a bot we host at a site
let sndBotPub = 0;
export let sndBotSite = "A";         // where our attacking bots push this round

/* Between rounds, under the countdown: everyone respawns on their side and
   the bomb resets, so the room is visibly assembled before it goes live —
   the previous flow respawned players only after the countdown, which left
   the dead spectating a frozen clock. Every client runs this itself. */
export function prepareSndRound() {
  game.sndRound++;
  game.sndRoundOver = false;
  game.sndEliminated = false;
  sndLive = false;
  game.sndClock = SND_ROUND_TIME;
  sndLiveT = 0;
  sndTimeupWait = 0;
  sndSeen.attackers = sndSeen.defenders = 0;
  sndBotAction = null;
  game.remoteBombAct = null;
  sndBotSite = Math.random() < 0.5 ? "A" : "B";
  // One life a round means a round boundary is the only other place a life
  // ends, so it has to reset the meter the way a death does. Earned streaks
  // still carry, same as across a death.
  streaks.onRoundEnd();
  uavUntil.phantom = 0;
  uavUntil.ghost = 0;
  vsatUntil.phantom = 0;
  vsatUntil.ghost = 0;
  game.jammedUntil = 0;
  game.myUavUntil = 0;
  // A gunship or a crate has no round to belong to once this one ends.
  clearStreakEntities();
  updateStreakHud();
  grenades.clear();
  game.bullets.clear();
  game.pickups.clear();
  game.bomb.reset();
  game.els.bombPrompt.hidden = true;
  game.els.bombTimer.hidden = true;
  game.els.hudWave.textContent = String(game.sndRound);
  game.els.bombSide.textContent = game.net.team === game.sndAttackTeam ? "Plant the bomb" : "Defend the sites";
  game.els.bombSide.style.color = TEAMS[game.net.team]?.ui || "";
  showWaveBanner(`ROUND ${game.sndRound} — ${game.net.team === game.sndAttackTeam ? "ATTACKING" : "DEFENDING"}`, 2600);
  game.audio.wave();

  clearDeathVisuals();
  game.player.hp = game.player.maxHp;
  game.player.alive = true;
  game.els.respawn.hidden = true;
  const sp = game.teamSpawn({ sideOnly: true });
  game.move.reset(sp.x, sp.z, sp.y || 0);
  game.look.yaw = yawTowardCentre(sp);
  game.look.pitch = 0;
  game.setActiveWeaponMesh(game.equipFromLoadout());
  game.warmNewGuns();

  if (game.isPvp() && game.net.isBotHost()) {
    game.bots.reviveAll((team, id) => game.botSpawn(team, id, { sideOnly: true }));
    for (const b of game.bots.bots) game.net.publishBot(b);
  }
}

/* The countdown cleared. The carrier is picked now rather than in
   prepareSndRound: a peer who died last round still reads as dead until
   their next state packet, and choosing among "living" attackers before
   then could skip them. Humans get it ahead of bots when there's a choice. */
export function sndGoLive() {
  sndLive = true;
  sndLiveT = 0;
  game.player.spawnGuard = game.SPAWN_GUARD;
  updateSpawnGuardHud();
  if (game.net.isBotHost() || !game.net.active) {
    game.bomb.carrierId = pickCarrier();
    if (game.net.active) game.net.publishBomb({ kind: "event", action: "reset", round: game.sndRound, attackTeam: game.sndAttackTeam, carrierId: game.bomb.carrierId });
  }
}

function pickCarrier() {
  const ids = livingAttackerIds().sort();
  return ids.find((id) => !isSyntheticId(id)) || ids[0] || null;
}

/* Where a bot we host should be heading in the current mode, or null to
   just hunt. KotH: the hill. S&D: attackers push one site (the carrier
   onto it), defenders split across both, and once it's planted everyone
   converges — defenders right onto the bomb. */
export function botObjective(bot) {
  // Troll Royale: the zone first, then loot, then the sound of a fight.
  if (royale) return royaleBotObjective(bot);
  // Its own care package, once it's down: go and get it. Not while the
  // heli is still inbound (user, 2026-10-04: "the bots are stuck"): parked
  // on the marker for the whole flight in, a bot stood spinning on the spot,
  // and with every veteran earning crates there was always one doing it.
  // Anywhere inside the claim ring will do, not the exact spot.
  if (bot.crate) {
    const pkg = streakEntities.get(bot.crate.eid);
    if (pkg instanceof CarePackage && pkg.landed && !pkg.claimed) return { id: `pkg-${pkg.id}`, x: pkg.x, z: pkg.z, radius: 1.2 };
  }
  if (game.hill) {
    const p = game.hill.position;
    return { id: `hill-${game.hill.index}`, x: p.x, z: p.z, radius: game.hill.radius * 0.6 };
  }
  if (!game.isSnd() || !game.bomb || !sndLive || game.sndRoundOver) return null;
  const attacking = bot.team === game.sndAttackTeam;
  if (game.bomb.state === "planted") {
    const s = game.bomb.siteAt(game.bomb.site);
    return { id: `site-${s.id}`, x: s.x, z: s.z, radius: attacking ? 7 : 1 };
  }
  if (attacking) {
    const s = game.bomb.siteAt(sndBotSite);
    return { id: `site-${s.id}`, x: s.x, z: s.z, radius: game.bomb.carrierId === bot.id ? 1 : 8 };
  }
  // Defenders pick a site by id so the split is stable across the round.
  let h = 0;
  for (let i = 0; i < bot.id.length; i++) h = (h * 31 + bot.id.charCodeAt(i)) >>> 0;
  const s = game.bombSites[h % game.bombSites.length];
  return { id: `site-${s.id}`, x: s.x, z: s.z, radius: 6 };
}

export function botBusy(bot) {
  // Flying its Dragonfire: stands still where it called it, like a player.
  if (bot.piloting) {
    if (streakEntities.get(bot.piloting)?.alive) return true;
    bot.piloting = null;
  }
  // On a Warship's guns: the same, until the ship leaves.
  if (bot.gunning) {
    const ws = streakEntities.get(bot.gunning);
    if (ws instanceof VtolWarship && ws.age < ws.duration) return true;
    bot.gunning = null;
  }
  return !!sndBotAction && sndBotAction.botId === bot.id;
}

/* Bot plants and defuses, run by the bot host only. Same timings as a
   player's hold-E, and broadcast through the same bomb messages, so every
   other client sees a bot plant exactly as it would a person's. */
function updateSndBots(dt) {
  let actor = null, kind = null, site = null;
  if (game.bomb.state === "carried") {
    const b = game.bots.byId(game.bomb.carrierId);
    const s = game.bomb.siteAt(sndBotSite);
    if (b?.alive && !(b.stunT > 0) && Math.hypot(b.pos.x - s.x, b.pos.z - s.z) <= SND_BOT_SITE_R) {
      actor = b; kind = "plant"; site = s;
    }
  } else if (game.bomb.state === "planted") {
    const s = game.bomb.siteAt(game.bomb.site);
    const current = sndBotAction?.kind === "defuse" ? game.bots.byId(sndBotAction.botId) : null;
    const candidates = current ? [current, ...game.bots.bots] : game.bots.bots;
    for (const b of candidates) {
      if (!b?.alive || b.team === game.sndAttackTeam || b.stunT > 0) continue;
      if (Math.hypot(b.pos.x - s.x, b.pos.z - s.z) > SND_BOT_SITE_R) continue;
      actor = b; kind = "defuse"; site = s;
      break;
    }
  }

  if (!actor) {
    if (sndBotAction) {
      sndBotAction = null;
      if (game.net.active) game.net.publishBomb({ kind: "event", action: "cancel", by: "bot" });
    }
    return;
  }

  if (!sndBotAction || sndBotAction.botId !== actor.id || sndBotAction.kind !== kind) {
    sndBotAction = { botId: actor.id, kind, progress: 0, site: site.id };
  }
  sndBotAction.progress += dt;
  sndBotPub -= dt;
  if (game.net.active && sndBotPub <= 0) {
    sndBotPub = 0.2;
    game.net.publishBomb({ kind: "action", action: kind, by: actor.id, progress: sndBotAction.progress, site: site.id });
  }
  noteRemoteBombAct(kind, site.id);

  if (kind === "plant" && sndBotAction.progress >= PLANT_TIME) {
    sndBotAction = null;
    game.bomb.plant(site.id);
    game.audio.wave();
    showWaveBanner(`Bomb planted — site ${site.id}`, 1800);
    if (game.net.active) game.net.publishBomb({ kind: "event", action: "planted", site: site.id });
  } else if (kind === "defuse" && sndBotAction.progress >= DEFUSE_TIME) {
    sndBotAction = null;
    game.bomb.defuse();
    if (game.net.active) game.net.publishBomb({ kind: "event", action: "defused" });
    sndRoundWin(sndDefendTeam(), "bomb defused");
  }
}

/* Somebody else is on the bomb — shown in the status line rather than the
   hold-E bar, which is ours. Expires on its own if the messages stop. */
export function noteRemoteBombAct(kind, site) {
  game.remoteBombAct = { kind, site, until: performance.now() + 500 };
}

/* Round over: score it, check for a match win, and either roll into the next
   round or let checkMatchEnd's endMatch take over. Every client reaches this
   independently off the same bomb/elimination state, so nobody needs to be
   told the round ended — they all see it happen at once. */
export function sndRoundWin(winningTeam, reason) {
  if (game.sndRoundOver) return;
  game.sndRoundOver = true;
  game.teamScores[winningTeam] = (game.teamScores[winningTeam] || 0) + 1;
  updateTeamHud();
  showWaveBanner(`${TEAMS[winningTeam].name.toUpperCase()} WIN THE ROUND — ${reason}`, 2600);
  game.audio.kill();

  const winner = matchWinner(game.currentMode(), {
    teamScores: game.teamScores, selfScore: 0, selfName: "You", peers: [...game.net.peers.values()],
  });
  if (winner) { game.endMatch(winner); return; }

  // Halftime: sides swap once each team has attacked the same number of
  // rounds — i.e. right after round roundsToWin - 1 finishes, so a 6-round
  // win limit swaps after round 5, matching Black Ops 2's split.
  if (game.sndRound === game.currentMode().roundsToWin - 1) {
    game.sndAttackTeam = sndDefendTeam();
    setTimeout(() => { if (game.gameState === "playing" && game.isSnd()) showWaveBanner("HALFTIME — SIDES SWAP", 1300); }, 300);
  }

  setTimeout(() => {
    if (game.gameState !== "playing" || !game.isSnd()) return;
    prepareSndRound();
    game.beginStaging(3);
  }, 2600);
}
