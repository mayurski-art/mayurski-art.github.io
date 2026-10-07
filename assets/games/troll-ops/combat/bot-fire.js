// Bots' shooting: who they can target, how their shots look and sound to
// everyone, firing at enemy aircraft, and the damage a bot we host deals.

import { occupants } from "../modes/spawns.js?v=spw1-gj1";
import { saberBlock, kbShield } from "./melee.js?v=ml1-kc2-si1-gj1";
import { MELEE_DEFS } from "../gear.js?v=to-hb1kb3-bk1-wst-ig1";
import { streakEntities } from "../streaks/calling.js?v=sk1-si1-gj1";
import { K9Pack } from "../k9-unit.js?v=k9c-bs1-sb2-gj1";
import { WEAPON_DEFS, chargedShotDef } from "../weapons.js?v=p5bm-wst-hf1";
import { hellfire } from "../view/viewmodels.js?v=vm1-si1-gj1";
import * as THREE from "three";
import { royale, royaleBotDamage, royaleBotVsBot, royaleNoise } from "../modes/royale.js?v=md1-gj1";
import { noteRigShot } from "../view/third-person.js?v=tp1-si1-gj1";
import { enemyAirFor, damageStreakEntity } from "../streaks/dragonfire.js?v=sk1-si1-gj1";
import { VtolWarship, HunterDrone, HelicopterGunship } from "../streak-entities.js?v=vsat2-hk1";
import { SamTurret } from "../sam-turret.js?v=sam1";
import { isStaging } from "../modes/match-start.js?v=mst1-si1-mb1-gj1";
import { botBusy } from "../modes/objectives.js?v=ob1-si1-gj1";
import { raycastWorld } from "../ballistics.js?v=cg1-wst-hf1";
import { Dragonfire } from "../dragonfire.js?v=df3-sb2";
import { damagePlayer } from "./damage.js?v=dm1-kc2-si1-gj1";
import { damageDog } from "../streaks/k9.js?v=sk1-si1-gj1";
import { flinchPeer } from "../core/hud.js?v=cr1-si1-gj1";
import { registerDeath } from "./scoring.js?v=sc1-kc2-si1-gj1";
import { game } from "../core/state.js?v=st1";

/* Everything a bot could shoot at: us, other humans, and other bots. */
export function botTargets() {
  const list = [];
  for (const o of occupants()) {
    // No point emptying a magazine into someone spawn protection is going to
    // shrug off — and it would look like the bot is broken.
    if (o.id === game.net.id && game.player.spawnGuard > 0) continue;
    // `melee`: only carrying a sword (Infection's infected), so worth
    // backing away from rather than holding ground against.
    // `blocking`: a Trollsaber guard up, which bots respect (bots.js
    // isGuarding) instead of emptying magazines into it.
    let blocking = false;
    if (o.id === game.net.id) blocking = saberBlock.active || kbShield.active;
    else {
      const rp = game.remotes.byId.get(o.id);
      blocking = !!(rp?.peer.blocking && rp.saberOut);
    }
    list.push({ id: o.id, team: o.team, alive: true, pos: o.pos, groundY: o.pos.y, yaw: o.yaw,
      melee: game.isInfection() && o.team === "ghost", blocking, blockCone: MELEE_DEFS.trollsaber.deflect.cone });
  }
  // K9 dogs are fair game: bots shoot the ones coming for them.
  for (const e of streakEntities.values()) {
    if (!(e instanceof K9Pack)) continue;
    for (const d of e.dogs) {
      if (d?.alive) list.push({ id: `k9:${e.id}:${d.i}`, team: e.team, alive: true, pos: d.pos, groundY: d.pos.y, yaw: d.yaw, dog: true });
    }
  }
  return list;
}

/* Someone else's shot, as seen and heard from here: their real gun's report
   (it used to be one generic rifle for every weapon in the room), a muzzle
   flash, and a tracer that follows the round's actual path so you can tell
   where fire is coming from. The tracer is cosmetic — hits are decided by
   whoever fired. */
export function remoteShotFx(origin, dir, weaponId, quiet = false, charge = 0) {
  let base = WEAPON_DEFS[weaponId] || WEAPON_DEFS.problem416;
  if (charge > 0 && base.charge) base = chargedShotDef(base, charge).def;
  game.audio.shot(quiet ? { ...base, quiet: true } : base, 0.8, origin);
  if (!quiet) game.impactFx.puff(origin, dir.lengthSq() > 0.001 ? dir.clone().normalize() : null);
  if (dir.lengthSq() < 0.001) return;
  // The Soul Blazer's fire out of someone else's skull (not across the map).
  if (base.hellfire && origin.distanceToSquared(game.camera.position) < 70 * 70) {
    hellfire.burst(origin.clone().addScaledVector(dir.clone().normalize(), 0.45), dir.clone().normalize(), 0.8);
  }
  const pellets = Math.min(base.pellets || 1, 4);   // a few pellets read as buckshot
  for (let i = 0; i < pellets; i++) {
    const d = dir.clone().normalize();
    if (pellets > 1) {
      d.x += (Math.random() - 0.5) * (base.pelletSpread || 0.1);
      d.y += (Math.random() - 0.5) * (base.pelletSpread || 0.1);
      d.normalize();
    }
    game.bullets.spawn({ origin: origin.clone().addScaledVector(d, 0.6), dir: d, def: base, ownerId: "remote", cosmetic: true });
  }
}

const _botMuzzle = new THREE.Vector3();
const _botAim = new THREE.Vector3();

export function onBotShoot(bot, target, dmg, isHead, hit, range = 30, usingSecondary = false) {
  const wid = (usingSecondary ? bot.secondaryId : bot.weaponId) || "problem416";
  if (royale) {
    dmg = royaleBotDamage(bot, dmg);
    if (game.bots.byId(target.id)) dmg *= royaleBotVsBot();
    royaleNoise(bot.pos.x, bot.pos.z, bot.id);
  }

  // The round's visible path: at the target's chest on a hit, off to one
  // side on a miss. Played here (we host the bot) and sent to the room,
  // which previously neither saw nor heard bots fire at all.
  const fwdX = -Math.sin(bot.yaw), fwdZ = -Math.cos(bot.yaw);
  _botMuzzle.set(bot.pos.x + fwdX * 0.5, bot.pos.y + 1.45, bot.pos.z + fwdZ * 0.5);
  _botAim.set(target.pos.x, (target.groundY ?? target.pos.y ?? 0) + (isHead ? 1.6 : 1.2), target.pos.z);
  if (!hit) {
    const side = (0.5 + Math.random() * 1.2) * (Math.random() < 0.5 ? -1 : 1);
    _botAim.x += fwdZ * side;
    _botAim.z -= fwdX * side;
    _botAim.y += (Math.random() - 0.3) * 0.8;
  }
  const dir = _botAim.clone().sub(_botMuzzle).normalize();
  remoteShotFx(_botMuzzle, dir, wid);
  game.killcam.noteShot(game.kcClock, bot.id, _botMuzzle, dir, wid);
  noteRigShot(bot.id);
  if (game.net.active) game.net.reportShotAs(bot.id, _botMuzzle, dir, wid);

  if (!hit) {
    if (target.id === game.net.id) game.nearMiss(0.45, bot.pos);
    return;
  }
  botDealDamage(bot, target.id, dmg, isHead, wid);
}

/* Bots shoot enemy aircraft (user): when nobody on the ground has their
   attention (no enemy seen for a moment), a bot turns its gun on the
   nearest enemy aircraft it can see within BOT_AA_RANGE and fires at its
   own rate and accuracy, harder to hit the smaller and faster it is. The
   rounds are drawn and sent like any bot shot; damage goes to the
   aircraft's owner (damageStreakEntity). SAM Turrets on the ground count
   too. */
const BOT_AA_RANGE = 85;
const BOT_AA_SIZE = { drone: 0.35, dragonfire: 0.55, heli: 0.95, recon: 0.6, sam: 1 };
const _aaEye = new THREE.Vector3(), _aaDir = new THREE.Vector3();
function botAirTargets(b) {
  const list = enemyAirFor(b.team, b.id).filter((a) => !(a.e instanceof VtolWarship));
  const ffa = !!game.currentMode().ffa;
  for (const e of streakEntities.values()) {
    if (!(e instanceof SamTurret) || !e.alive) continue;
    const owner = e.botId || (e.owned ? game.net.id : null);
    if (ffa ? owner !== b.id : (e.botTeam || e.team) !== b.team) list.push({ id: e.id, pos: e.pos.clone().setY(e.pos.y + 1.1), e });
  }
  return list;
}
export function updateBotAntiAir(dt) {
  if (isStaging()) return;
  for (const b of game.bots.bots) {
    if (!b.alive || b.airborne || b.meleeOnly || b.piloting || botBusy(b) || b.reloadT > 0) { b.aa = null; continue; }
    if (b.lastSeen && b.lastSeen.age < 1.2) { b.aa = null; continue; }   // busy with people
    b.aaT = (b.aaT || 0) - dt;
    _aaEye.set(b.pos.x, (b.groundY ?? b.pos.y) + 1.5, b.pos.z);
    if (!b.aa || b.aaT <= -1.5) {
      // Re-pick now and then: the nearest one in the clear.
      let best = null, bestD = BOT_AA_RANGE;
      for (const a of botAirTargets(b)) {
        const d = a.pos.distanceTo(_aaEye);
        if (d > bestD) continue;
        _aaDir.copy(a.pos).sub(_aaEye).divideScalar(d);
        if (raycastWorld(game.colliders, _aaEye, _aaDir, d) < d - 1.5) continue;
        best = a; bestD = d;
      }
      b.aa = best ? { id: best.id } : null;
      b.aaT = Math.max(0, b.aaT);
    }
    if (!b.aa) continue;
    const a = botAirTargets(b).find((x) => x.id === b.aa.id);
    if (!a) { b.aa = null; continue; }
    // Face it; the reaction beat before the first round.
    b.yaw = Math.atan2(-(a.pos.x - b.pos.x), -(a.pos.z - b.pos.z));
    b.pitch = Math.atan2(a.pos.y - _aaEye.y, Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z));
    if (b.aaT > 0) continue;
    const diff = b.diff || {};
    b.aaT = (diff.interval ?? 0.85) * (0.8 + Math.random() * 0.4);
    const kind = a.e instanceof HunterDrone ? "drone" : a.e instanceof Dragonfire ? "dragonfire" : a.e instanceof HelicopterGunship ? "heli" : a.e instanceof SamTurret ? "sam" : "recon";
    const d = a.pos.distanceTo(_aaEye);
    const hit = Math.random() < (diff.hit ?? 0.45) * BOT_AA_SIZE[kind] * Math.max(0.35, 1 - d / 140);
    const fwdX = -Math.sin(b.yaw), fwdZ = -Math.cos(b.yaw);
    _botMuzzle.set(b.pos.x + fwdX * 0.5, _aaEye.y - 0.05, b.pos.z + fwdZ * 0.5);
    _botAim.copy(a.pos);
    if (!hit) { _botAim.x += (Math.random() - 0.5) * 4; _botAim.y += (Math.random() - 0.5) * 3; _botAim.z += (Math.random() - 0.5) * 4; }
    const dir = _botAim.clone().sub(_botMuzzle).normalize();
    const wid = b.weaponId || "problem416";
    remoteShotFx(_botMuzzle, dir, wid);
    noteRigShot(b.id);
    if (game.net.active) game.net.reportShotAs(b.id, _botMuzzle, dir, wid);
    if (hit) {
      game.spawnImpactBurst(a.pos, 0xffd08a, 4);
      damageStreakEntity(a.e, diff.damage ?? 17, b.id);
    }
  }
}

/* Damage a bot we host deals to anyone: us, another of our bots, or a remote
   player (who applies it to themselves when the hit arrives). */
export function botDealDamage(bot, targetId, dmg, isHead, wid) {
  if (targetId === game.net.id) { damagePlayer(dmg, bot.id, wid, isHead); return; }
  if (typeof targetId === "string" && targetId.startsWith("k9:")) {
    const j = targetId.lastIndexOf(":");
    const pack = streakEntities.get(targetId.slice(3, j));
    if (pack instanceof K9Pack) damageDog(pack, +targetId.slice(j + 1), dmg, bot.id);
    return;
  }
  flinchPeer(targetId, bot.id, isHead);

  if (game.bots.byId(targetId)) {
    const { killed, bot: victim } = game.bots.applyHit(targetId, dmg);
    if (killed) {
      bot.kills++;
      game.net.reportDeathAs(targetId, bot.id, wid, isHead);
      registerDeath(victim.name, bot.id, wid, {
        head: isHead, victimTeam: victim.team, victimIsBot: true,
        victimPos: victim.pos, victimWeaponId: victim.weaponId,
      });
    }
    return;
  }
  game.net.reportHitAs(bot.id, targetId, dmg, isHead, wid);
}
