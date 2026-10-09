// Troll Forces Infection: who's infected, the infected's loadout and bots,
// the counts on the HUD and how the match ends.

import { INFECTION } from "../modes.js?v=umb1-rn-wst-tl1-bs1-soc1-t69-u69b7b7d-wb1-ar1-ar2";
import { TEAMS } from "../remote-players.js?v=umb3g-pc1-nf-em1-mi2-wst-ig1-bs1-sb1-cb2-rp1-hf1-sb2-gj1-fu1b7b7dc2-wb1m1c4-cup1-ar2";
import { setHolding, updateGearHud } from "../combat/weapons.js?v=wp1-kc2-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-ar2";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-ar2";
import { nameFor } from "../combat/damage.js?v=dm1-kc2-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-ar2";
import { MELEE_DEFS, MeleeState } from "../gear.js?v=to-hb1kb3-bk1-wst-ig1";
import { updateTeamHud } from "../combat/scoring.js?v=sc1-kc2-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-ar2";
import { game } from "../core/state.js?v=st1";

// Nobody hosts the match: every client turns itself when it dies, and its
// team rides out on the next state message. The one decision that has to be
// made once is who starts infected, so the bot host (lowest id, same as for
// bots) makes it and broadcasts an `infect` message. Every client counts
// the sides from what it sees and ends the match itself when no survivor is
// left, the same way score limits already work.

export let infectionStarted = false;
let infectionCalled = false; // the "first infection in..." banner
let lastSurvivorCalled = false;
let reinfectT = 0;           // host: grace before replacing infected who all left
let noSurvivorsT = 0;        // how long the count has read zero survivors
let infectionShown = "";     // last counts painted into the HUD

export function resetInfection() {
  infectionStarted = false;
  game.infectionT = INFECTION.firstDelay;
  infectionCalled = false;
  lastSurvivorCalled = false;
  reinfectT = 0;
  noSurvivorsT = 0;
  infectionShown = "";
  const inf = game.isInfection();
  // The last match's bots would otherwise sit in the peer map, still on the
  // sides they ended on, until they time out — long enough to be counted as
  // infected in a match nobody's been infected in yet.
  if (inf) for (const [id, p] of game.net.peers) if (game.isBotPeer(p)) { game.remotes.byId.get(id)?.dispose(); game.remotes.byId.delete(id); game.net.peers.delete(id); }
  game.els.namePhantom.textContent = inf ? "Survivors" : TEAMS.phantom.name;
  game.els.nameGhost.textContent = inf ? "Infected" : TEAMS.ghost.name;
  if (game.player.maxHp === INFECTION.hp) game.player.maxHp = 100;
  if (inf) game.net.setTeam("phantom");
}

/* The keyboard sword only (whatever melee the loadout has; bots swing it
   too, botMelee), faster (see move.update), tougher. Survivors keep their
   kit. */
export function applyInfectionLoadout() {
  if (!game.isInfection()) return;
  game.player.maxHp = game.isInfected() ? INFECTION.hp : 100;
  game.player.hp = Math.min(game.player.hp, game.player.maxHp);
  if (!game.isInfected()) return;
  game.cooking.def = null;
  game.cooking.slot = null;
  game.els.cook.hidden = true;
  game.player.gear.lethal = 0;
  game.player.gear.tactical = 0;
  if (game.player.melee?.def.id !== MELEE_DEFS.keyboard.id) {
    game.player.melee = new MeleeState(MELEE_DEFS.keyboard);
    game.setActiveMeleeMesh(MELEE_DEFS.keyboard);
  }
  setHolding("melee");
  updateGearHud();
}

function markInfectionStarted() {
  if (infectionStarted) return;
  infectionStarted = true;
  // The three minutes are for surviving, so they start now.
  game.matchClockT = game.currentMode().timeLimit;
  game.matchClockShown = -1;
  game.paintMatchClock();
}

/* Everyone in the match by side, from what this client can see. Survivors
   who are down still count: they're about to get up infected, and until
   their team flips they haven't. */
export function infectionCounts() {
  let survivors = 0, infected = 0, lastName = null;
  const tally = (team, name) => {
    if (team === "ghost") infected++;
    else if (team === "phantom") { survivors++; lastName = name; }
  };
  tally(game.net.team, "You");
  for (const p of game.net.peers.values()) {
    if (String(p.id).startsWith("streak-")) continue;
    tally(p.team, p.name);
  }
  return { survivors, infected, lastName };
}

/* Host only: pick who starts infected and tell everyone. */
export function pickFirstInfected() {
  const ids = [game.net.id];
  for (const p of game.net.peers.values()) {
    if (String(p.id).startsWith("streak-") || p.team === "ghost") continue;
    ids.push(p.id);
  }
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const chosen = ids.slice(0, ids.length >= INFECTION.twoFirstAt ? 2 : 1);
  if (game.net.active) game.net.send({ t: "infect", id: game.net.id, ids: chosen });
  applyInfect(chosen);
}

export function applyInfect(ids) {
  if (!game.isInfection() || game.gameState !== "playing") return;
  markInfectionStarted();
  const others = [];
  for (const id of ids) {
    if (id === game.net.id) {
      if (game.net.team !== "ghost") {
        game.net.setTeam("ghost");
        applyInfectionLoadout();
        game.player.hp = game.player.maxHp;
      }
      showWaveBanner("YOU'RE INFECTED — cut them down", 2000);
      continue;
    }
    const b = game.bots.byId(id);
    if (b) infectBot(b);
    others.push(nameFor(id) || "someone");
  }
  if (others.length && !ids.includes(game.net.id)) {
    showWaveBanner(`${others.join(" & ")} ${others.length > 1 ? "are" : "is"} infected — run`, 2000);
  }
  game.audio.wave();
}

/* Bot host: turn one of our bots. */
function infectBot(b) {
  b.team = "ghost";
  b.meleeOnly = true;
  b.speedMult = INFECTION.speed;
  b.maxHp = INFECTION.hp;
  b.holdingSecondary = false;
  if (b.alive) b.hp = b.maxHp;
}

/* Bot host, every tick: new bots join the side the match is on (survivors
   before the first infection, infected after), and a survivor bot that's
   down gets up infected. */
export function sortInfectionBots() {
  for (const b of game.bots.bots) {
    if (!b.infectionSorted) {
      b.infectionSorted = true;
      if (infectionStarted) infectBot(b);
      else { b.team = "phantom"; b.meleeOnly = false; }
    } else if (infectionStarted && !b.alive && b.team === "phantom") {
      infectBot(b);
    }
  }
}

/* A bot we host swings its sword at `target`. Whether it's in reach is
   bots.js's call; this plays the swing everywhere and lands the hit. */
export function botMelee(bot, target) {
  const def = MELEE_DEFS.keyboard;
  bot.meleeSwing = ((bot.meleeSwing | 0) + 1) & 1;
  const p = game.net.peers.get(bot.id);
  if (p) { p.meleeSeq = (p.meleeSeq | 0) + 1; p.meleeKind = bot.meleeSwing; p.meleeDef = def.id; }
  if (game.net.active) game.net.publishMeleeAs(bot.id, bot.meleeSwing, def.id);
  game.botDealDamage(bot, target.id, def.damage, false, def.id);
}

function paintInfectionCounts(c) {
  const shown = `${c.survivors}:${c.infected}`;
  if (shown === infectionShown) return;
  infectionShown = shown;
  game.teamScores.phantom = c.survivors;
  game.teamScores.ghost = c.infected;
  updateTeamHud();
}

export function updateInfection(dt) {
  if (!infectionStarted) {
    paintInfectionCounts(infectionCounts());
    if (game.isStaging()) return;
    // Someone's already turned. On our first live tick that means we joined
    // a match under way, and a latecomer comes in infected; after that it's
    // just the host's message still on its way.
    if (infectionCounts().infected > 0) {
      if (!infectionCalled) { game.net.setTeam("ghost"); applyInfectionLoadout(); }
      infectionCalled = true;
      markInfectionStarted();
      return;
    }
    if (!infectionCalled) {
      infectionCalled = true;
      showWaveBanner(`First infection in ${INFECTION.firstDelay}s — spread out`, 1800);
    }
    game.infectionT -= dt;
    if (game.infectionT <= 0 && (game.net.isBotHost() || !game.net.active)) pickFirstInfected();
    return;
  }

  const c = infectionCounts();
  paintInfectionCounts(c);

  // Held for a moment before it counts: a peer's team can read wrong for a
  // message or two (they flipped, their next state is in flight).
  noSurvivorsT = c.survivors === 0 && c.infected > 0 ? noSurvivorsT + dt : 0;
  if (noSurvivorsT > 0.5) { game.endMatch("Infected win"); return; }

  if (c.survivors === 1 && !lastSurvivorCalled) {
    lastSurvivorCalled = true;
    showWaveBanner(game.net.team === "phantom" ? "LAST SURVIVOR — it's all on you" : `LAST SURVIVOR — ${c.lastName}`, 2200);
    game.audio.wave();
  }

  // Every infected left the room: the host starts it again rather than
  // handing the survivors a match with nobody to run from.
  if (c.infected === 0 && (game.net.isBotHost() || !game.net.active)) {
    reinfectT += dt;
    if (reinfectT > 3) { reinfectT = 0; pickFirstInfected(); }
  } else {
    reinfectT = 0;
  }
}
