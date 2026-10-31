// Troll Forces damage to the player: damagePlayer, assists, killer names,
// the death card, respawn and spawn protection.

import { WEAPON_DEFS } from "../weapons/weapons.js?v=p5bm-wst-hf1-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-or1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416-mt2-hb4";
import { MELEE_DEFS, THROWABLE_DEFS } from "../weapons/gear.js?v=to-hb1kb3-bk1-wst-ig1-th2-zr5-zr9-zr10-zp1-or1-rb4-hp1-bx1-mg1-sp1";
import * as THREE from "three";
import { matchLog } from "./match-log.js?v=ml1-bp2";
import { flashHit, noteHitDirection, flinchPeer, updateStreakHud, showWaveBanner, clearHitDirs } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2-sk1-hb4-lu1-mb1";
import { royale, updateRoyaleGear, royaleOnDeath, hideSpectateHud } from "../modes/royale.js?v=md1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-jx2-jx3-jx4-jx5-mb1";
import { goDown, hurtDown } from "../modes/royale-down.js?v=rd1-wb1-mt2-sk1-hb4-jx2-jx3-mb1";
import { heroActive, hero, applyHeroLoadout } from "../modes/umb-heroes.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-fs1-ut1-gf1-tg1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ls4-gb4-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2-hb4-lu1-mb1";
import { streaks, streakPicker } from "../streaks/calling.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-fs1-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ls4-gb4-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2-hb4-lu1-mb1";
import { INFECTION } from "../modes/modes.js?v=umb1-rn-wst-tl1-bs1-soc1-t69-u69b7b7d-wb1-ar1-ar2-zh1-fl1-or1-ffa1-dom1-gf1-tg1-kb9-sp1-gb2-tb1-dm1-tfb8-ug1-ugm1-hgb8-hgb9-mt2-hb4";
import { killcamSelfId, startKillcamPresentation, endKillcamPresentation } from "./killcam-present.js?v=kp2-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-dom1-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-tnt1-mb1";
import { TEAMS } from "../net/remote-players.js?v=umb3g-pc1-nf-em1-mi2-wst-ig1-bs1-sb1-cb2-rp1-hf1-sb2-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2-sk1-hb4-jx2-jx3-mb1";
import { game } from "../core/state.js?v=st1";
import { carryClassPerks, classSwitch } from "./perk-carry.js?v=pk1-cl1-bp1-fj1-zh1-zc1-zc2-nf1-fl1-or1-ffa1-dom1-gf1-tg1-kb9-sp1-gb2-tb1-dm1-tfb8-rfx1-ret1-mrg1-ug1-ugm1-mrc1-hgb8-hgb9-tw1-ars1-p416-mt2-hb4";
import { hasPerk, PERK_TUNE } from "../progression/perks.js?v=pk1-cl1-bp1-fj1-zc1-zc2-nf1-or1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416-mt2-hb4";

/* What Flak Jacket (perks.js) shrugs off: thrown lethals and the streaks
   that blow up (not gunship rounds, dogs, a crate on the head or the bomb). */
const EXPLOSIVE = new Set(["airstrike", "drone", "swarm", "dragonfire", "samturret"]);
export const isExplosive = (weaponId) => EXPLOSIVE.has(weaponId) || (THROWABLE_DEFS[weaponId]?.damage > 0);
const explosive = isExplosive;

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
  // Zombies: down is down; the bleed-out (modes/zombies/run.js) decides the rest.
  // Troll Royale in teams: enemy fire finishes you off (modes/royale-down.js).
  if (game.player.downed) { if (royale) hurtDown(amount, fromId, weaponId); return; }
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
  if (hasPerk("flakjacket") && explosive(weaponId)) amount *= PERK_TUNE.flakJacket;
  game.player.hp = Math.max(0, game.player.hp - amount);
  // A hit knocks the view (BO2's flinch); Toughness all but cancels it.
  const kick = Math.min(0.05, 0.008 + amount * 0.0006) * (hasPerk("toughness") ? PERK_TUNE.toughnessKick : 1);
  game.shakeMag = Math.max(game.shakeMag, kick);
  game.shakeT = Math.max(game.shakeT, 0.16);
  game.player.lastHurtAt = performance.now();
  noteDamage(fromId, amount, weaponId, isHead);
  noteHitDirection(fromId, fromPos);
  flinchPeer(game.net.id, fromId, isHead, fromPos);
  flashHit();
  game.audio.hurt();
  if (game.player.hp > 0) return;
  // Troll Royale in teams: down, not out, while a teammate is up
  if (royale && goDown(fromId, weaponId)) return;
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
    // ...and on the after-action map, with the line the shot came along.
    matchLog.death(game.move.pos, fromPos, weaponId, game.player.matchT);
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
  } else if (game.isZombies()) {
    game.zombieDowned();
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
  // A class picked from the pause menu since the last life: its three
  // scorestreaks take over the ladder now (the meter and anything already
  // earned stay, as in BO2).
  if (classSwitch.pending != null) {
    classSwitch.pending = null;
    streaks.setSelected(streakPicker.selected);
  }
  game.setActiveWeaponMesh(game.equipFromLoadout());
  carryClassPerks();
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
