// Troll Forces damage to the player: damagePlayer, assists, killer names,
// the death card, respawn and spawn protection.

import { WEAPON_DEFS } from "../weapons.js?v=p5bm-wst-hf1-fu1-wb1";
import { MELEE_DEFS, THROWABLE_DEFS } from "../gear.js?v=to-hb1kb3-bk1-wst-ig1-th2";
import * as THREE from "three";
import { flashHit, noteHitDirection, flinchPeer, updateStreakHud, showWaveBanner, clearHitDirs } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2";
import { royale, updateRoyaleGear, royaleOnDeath, hideSpectateHud } from "../modes/royale.js?v=md1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2";
import { heroActive, hero, applyHeroLoadout } from "../modes/umb-heroes.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2";
import { streaks } from "../streaks/calling.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2";
import { INFECTION } from "../modes.js?v=umb1-rn-wst-tl1-bs1-soc1-t69-u69b7b7d-wb1";
import { killcamSelfId, startKillcamPresentation, endKillcamPresentation } from "./killcam-present.js?v=kp2-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2";
import { TEAMS } from "../remote-players.js?v=umb3g-pc1-nf-em1-mi2-wst-ig1-bs1-sb1-cb2-rp1-hf1-sb2-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2";
import { game } from "../core/state.js?v=st1";

/* Who has hurt us lately, and how much. The shooter's client already sends
   dmg / headshot / weapon with every hit — we were throwing all of it away.
   Keeping a short ledger is what turns "you died" into "who killed you, what
   with, and how close you got", and it's what assists are computed from. */
export const damageLog = new Map();      // attacker id -> { dmg, last, weaponId, head }
export const ASSIST_MEMORY = 10;         // seconds a contribution still counts
export const ASSIST_MIN_DAMAGE = 25;     // below this it isn't an assist

export function noteDamage(fromId, amount, weaponId, isHead) {
  if (!fromId || fromId === game.net.id) return;
  const e = damageLog.get(fromId) || { dmg: 0, last: 0, weaponId: null, head: false };
  e.dmg += amount;
  e.last = performance.now();
  e.weaponId = weaponId || e.weaponId;
  e.head = !!isHead;
  damageLog.set(fromId, e);
}

/* Everyone who contributed inside the memory window, minus the killer. */
export function assistersFor(killerId) {
  const now = performance.now();
  const out = [];
  for (const [id, e] of damageLog) {
    if (now - e.last > ASSIST_MEMORY * 1000) { damageLog.delete(id); continue; }
    if (id === killerId || e.dmg < ASSIST_MIN_DAMAGE) continue;
    out.push({ id, dmg: e.dmg });
  }
  return out;
}

export function nameFor(id) {
  if (id === game.net.id) return "You";
  return game.net.peers.get(id)?.name || game.bots.byId(id)?.name || "Someone";
}

/* Scorestreaks report kills with their own ids rather than a weapon's, so
   the killfeed and death card can say what actually got you. */
const STREAK_KILL_NAMES = {
  drone: "Hunter-Killer",
  heli: "Gunship",
  airstrike: "Lightning Strike",
  carepackage: "Care Package",
  k9: "K9 Unit",
  warship: "VTOL Warship",
  swarm: "Swarm",
  dragonfire: "Dragonfire",
  bomb: "Bomb",
  zone: "the Cringe",
};

export function weaponNameFor(id) {
  return WEAPON_DEFS[id]?.name || MELEE_DEFS[id]?.name || THROWABLE_DEFS[id]?.name || STREAK_KILL_NAMES[id] || null;
}

/* How much health the player who killed us had left — the single most useful
   thing a death screen can tell you, because it says whether to change the
   approach or just the aim. */
function killerHpFor(id) {
  // Bots we simulate are checked first: publishBot mirrors them into the peer
  // map, and that mirror only refreshes at 15Hz, so the peer copy can be a
  // stale snapshot of a bot whose real health we're holding right here.
  const b = game.bots.byId(id);
  if (b) return Math.max(0, Math.round(b.hp));
  const p = game.net.peers.get(id);
  if (p && Number.isFinite(p.hp)) return Math.max(0, Math.round(p.hp));
  return null;
}

/* Where the killer was standing, for the kill cam to orbit toward. Same
   bots-first order as killerHpFor, but falls through to remotes.byId rather
   than net.peers directly since RemotePlayer.pos is the interpolated render
   position — the one that actually matches what was on screen. Null for a
   scorestreak kill (drone/heli/airstrike) or a killer that's already gone. */
export function killerPosFor(id) {
  if (!id) return null;
  const b = game.bots.byId(id);
  if (b) return new THREE.Vector3(b.pos.x, b.pos.y + 1.5, b.pos.z);
  const rp = game.remotes.byId.get(id);
  if (rp) return new THREE.Vector3(rp.pos.x, rp.pos.y + 1.5, rp.pos.z);
  return null;
}

/* `fromPos` places the hit-direction marker when there's no peer or bot to
   look up by id — a zombie, a grunt, the bomb. */
export function damagePlayer(amount, fromId, weaponId, isHead = false, fromPos = null) {
  if (!game.player.alive) return;
  // Owner's Invincible toggle: nothing lands, from anyone or anything.
  if (game.invincibleOn()) return;
  // Socialize: nobody can be hurt, whatever arrives off the wire.
  if (game.isSocial()) return;
  // Nothing lands before the match is live, whoever reports it.
  if (game.isStaging()) return;
  // A raised Trollsaber eats rounds from the front.
  if (game.tryDeflect(amount, fromId, weaponId, fromPos)) return;
  // Your own grenade can still sting on the range; it can't end the session.
  if (game.isRange()) {
    game.player.hp = Math.max(1, game.player.hp - amount);
    flashHit();
    game.audio.hurt();
    return;
  }
  // Freshly respawned and haven't fired yet — the round passes through.
  if (game.player.spawnGuard > 0 && game.isPvp()) return;
  // Troll Royale: Cope Plates soak everything but the Cringe itself.
  if (royale && game.player.armor > 0 && weaponId !== "zone") {
    const soak = Math.min(game.player.armor, amount);
    game.player.armor -= soak;
    amount -= soak;
    updateRoyaleGear();
    if (game.player.armor <= 0) game.audio.saberBreak();
    if (amount <= 0) {
      noteDamage(fromId, soak, weaponId, isHead);
      noteHitDirection(fromId, fromPos);
      flinchPeer(game.net.id, fromId, isHead, fromPos);
      flashHit();
      return;
    }
  }

  if (heroActive()) amount = hero().incoming(amount, fromPos || game.remotes.byId.get(fromId)?.pos || null);
  game.player.hp = Math.max(0, game.player.hp - amount);
  game.player.lastHurtAt = performance.now();
  noteDamage(fromId, amount, weaponId, isHead);
  noteHitDirection(fromId, fromPos);
  flinchPeer(game.net.id, fromId, isHead, fromPos);
  flashHit();
  game.audio.hurt();
  if (game.player.hp > 0) return;
  game.audio.died();

  if (game.isPvp()) {
    // In PvP dying is a respawn, not the end of the run.
    game.player.alive = false;
    game.cancelCook();
    game.player.deaths++;
    // Report the streak we were on before clearing it — it's what lets our
    // killer know they ended a run (Shutdown).
    const endedStreak = game.player.streak;
    game.player.streak = 0;
    // Dying takes the meter but not a streak already earned — BO2's rule,
    // and the reason this isn't streaks.reset().
    streaks.onDeath();
    updateStreakHud();
    // Who to look for, for Revenge.
    game.player.lastKilledBy = fromId || null;
    // S&D has no respawn timer — updateSnd() owns the "eliminated" HUD text
    // once this sets player.alive false; every other PvP mode counts this
    // down and calls respawnPlayer() itself.
    if (!game.isSnd() && !game.isRoyale()) game.respawnT = 4;
    if (royale) royaleOnDeath();
    // Remember where we fell, so the picker stops handing out this corner.
    game.notePointDeath(game.move.pos.x, game.move.pos.z);
    game.dropCarriedWeapon();
    game.net.reportDeath(fromId, weaponId, isHead, endedStreak);
    game.registerDeath("You", fromId, weaponId, {
      head: isHead, victimIsMe: true, victimTeam: game.net.team,
    });
    // Infection: a survivor who goes down gets up on the other side.
    if (game.isInfection() && game.infectionStarted) {
      if (game.net.team === "phantom") {
        game.net.setTeam("ghost");
        showWaveBanner("INFECTED — go get them", 1800);
      }
      game.respawnT = INFECTION.respawn;
    }
    showDeathCard(fromId, weaponId, isHead);
    game.noteLocalDeath();
    game.els.deathfade.classList.add("is-dead");
    damageLog.clear();
    game.els.respawn.hidden = false;
    // BO2 killcam: the last few seconds again, from the killer's eyes. The
    // respawn waits for it (skippable back down to the usual timer).
    killcamBaseRespawn = game.respawnT;
    game.killcam.start({ deathPos: game.player.pos, killerId: fromId, killerPos: killerPosFor(fromId), now: game.kcClock, selfId: killcamSelfId() });
    if (game.killcam.replaying && !game.isSnd()) game.respawnT = Math.max(game.respawnT, game.killcam.duration + 0.35);
    game.els.killcamBars.classList.add("is-on");
    startKillcamPresentation(fromId, weaponId, isHead);
  } else {
    game.endGame("dead");
  }
}

/* Who got you, with what, and how close you came. "They had 12 HP left" is
   the difference between "aim better" and "that fight was unwinnable". */
export function showDeathCard(killerId, weaponId, isHead) {
  if (!game.els.deathBy) return;
  const name = killerId ? nameFor(killerId) : null;
  if (!name || name === "You") {
    game.els.deathBy.hidden = true;
    return;
  }
  const weapon = weaponNameFor(weaponId);
  const hp = killerHpFor(killerId);

  game.els.deathByName.textContent = name;
  const team = game.net.peers.get(killerId)?.team || game.bots.byId(killerId)?.team;
  game.els.deathByName.style.color = team && TEAMS[team] ? TEAMS[team].ui : "";

  const bits = [];
  if (weapon) bits.push(weapon);
  if (isHead) bits.push("headshot");
  if (hp != null) bits.push(`${hp} HP left`);
  game.els.deathByMeta.textContent = bits.join(" · ");
  game.els.deathBy.hidden = false;
}

/* Spawns ring the map edge, so face inward — otherwise you open your eyes
   looking at the perimeter wall. */
export function yawTowardCentre(sp) {
  return Math.atan2(sp.x, sp.z);
}
export let killcamBaseRespawn = 4;

export function clearDeathVisuals() {
  game.killcam.cancel();
  endKillcamPresentation();
  game.killcamWasActive = false;
  game.els.killcamBars.classList.remove("is-on");
  game.els.deathfade.classList.remove("is-dead");
  if (game.els.deathBy) game.els.deathBy.hidden = true;
  hideSpectateHud();
  // Every caller is about to put us back up (respawn, new round, new match).
  game.weaponRig.visible = true;
  game.localRig.death = null;
}

export function respawnPlayer() {
  clearDeathVisuals();
  clearHitDirs();
  const sp = game.teamSpawn();
  game.move.reset(sp.x, sp.z, sp.y || 0);
  game.look.yaw = yawTowardCentre(sp);
  game.look.pitch = 0;
  game.player.hp = game.player.maxHp;
  game.player.alive = true;
  game.player.spawnGuard = game.SPAWN_GUARD;
  applyHeroLoadout();
  game.setActiveWeaponMesh(game.equipFromLoadout());
  game.warmNewGuns();
  game.applyInfectionLoadout();
  game.els.respawn.hidden = true;
}

/* Spawn protection is a promise not to be shot, not a licence to shoot, so
   firing drops it immediately. */
export function breakSpawnGuard() {
  if (game.player.spawnGuard > 0) {
    game.player.spawnGuard = 0;
    updateSpawnGuardHud();
  }
}

export function updateSpawnGuardHud() {
  const on = game.player.spawnGuard > 0;
  if (game.els.spawnGuard) game.els.spawnGuard.hidden = !on;
  document.body.classList.toggle("to-spawn-guarded", on);
}

export function onGruntAttack(grunt, dmg, ranged) {
  if (ranged) {
    const dist = grunt.mesh.position.distanceTo(game.player.pos);
    if (dist < 14) damagePlayer(dmg * 0.8, null, null, false, grunt.mesh.position);
  } else {
    damagePlayer(dmg, null, null, false, grunt.mesh.position);
  }
}
