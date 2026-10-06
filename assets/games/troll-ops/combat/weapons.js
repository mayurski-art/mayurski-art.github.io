// Troll Forces weapons: firing, reloads, what a bullet hit, weapon switching,
// the pickup prompt and the gear HUD.

import { breakSpawnGuard } from "./damage.js?v=dm1-kc2";
import { soulBlazerShot, soulBlazerMouth } from "../soul-blazer.js?v=sb1";
import * as THREE from "three";
import { royale, royaleNoise, royalePickupGun, stageFrozen, royaleDropView } from "../modes/royale.js?v=md1";
import { resolveK9 } from "../k9-unit.js?v=k9c-bs1-sb2";
import { showHitmarker, pushKillfeed, showWaveBanner } from "../core/hud.js?v=cr1";
import { damageStreakEntity } from "../streaks/dragonfire.js?v=sk1";
import { damageDog } from "../streaks/k9.js?v=sk1";
import { flinchRigFrom } from "../character.js?v=to-hb4-em1-fc1-wst-soc1-ww1";
import { heroActive, hero } from "../modes/umb-heroes.js?v=sk1";
import { warshipView, toggleWarshipGun } from "../streaks/warship.js?v=sk1";
import { gunDisplayName } from "../royale.js?v=p5-wst-bs1-sb2";
import { streakControlActive, streakEntities } from "../streaks/calling.js?v=sk1";
import { touchState } from "../input/touch.js?v=in1";
import { packageCaptureTime } from "../streaks/fire.js?v=sk1";
import { claimPackage } from "../streaks/air.js?v=sk1";
import { WeaponState } from "../weapons.js?v=p5bm-wst-hf1";
import { CarePackage } from "../streak-entities.js?v=vsat2-hk1";
import { game } from "../core/state.js?v=st1";

export function currentWeapon() {
  const id = game.currentWeaponSlot === "secondary" ? game.player.secondaryId : game.player.weaponId;
  return game.player.weapons[id] || game.player.weapons[game.player.weaponId];
}

export function tryReload() {
  if (game.socialUnarmed()) return;   // no guns in the hangout
  if (!game.controls.isLocked && !game.isTouch && !game.gamepadState.connected) return;
  // audio.reload() now fires from reloadPose() on the first frame w.reloading
  // is true, so it lands in step with the visual choreography's stages
  // rather than at the exact instant this input handler runs.
  currentWeapon().startReload();
}

/* `shot` (charge weapons, from chargedShotDef): the def this round flies
   with, the cells it costs, its recoil scale and charge level. */
export function fireOnce(shot = null) {
  if (game.socialUnarmed()) return;
  const w = currentWeapon();
  const def = shot?.def || w.def;
  if (!w.canFire()) {
    if (w.ammoInMag <= 0 && !w.reloading) tryReload();
    return;
  }
  w.fire(shot?.cells ?? 1, shot?.kick ?? 1);
  if (w.def.akimbo) {
    // Right, left, right...: each pull fires the other gun.
    w.akimboSide = (w.akimboSide ?? 1) ^ 1;
    if (shot?.fan) {
      w.fireCooldown = 60 / w.def.fanFire.rpm;
      w.spread = Math.min(w.def.spreadMax + w.def.fanFire.spread, w.spread + w.def.fanFire.spread);
    }
    game.akimboView.onShot(game.activeWeaponMesh, w, w.akimboSide, !!shot?.fan);
  }
  if (w.def.charge) {
    w.lastShotLevel = shot?.level ?? 0;
    w.shotFlare = 1;
  }
  game.inspectT = 0;      // shooting always wins over the flourish
  breakSpawnGuard();
  game.audio.shot(def);
  // Camera shake per shot, shaped by the weapon's shake stats and its
  // attachments. Shouldering the gun steadies it, as with the recoil.
  game.kickFireShake(def, 1 - w.adsT * 0.35);
  game.muzzleFlashT = 0.045;
  game.muzzleLight.intensity = 0.35;
  game.muzzleMat.uniforms.uColor.value.setHex(def.muzzleColor ?? 0xfff2c0);
  game.muzzleLight.color.setHex(def.muzzleColor ?? 0xffcf8a);
  if (def.hellfire && game.activeWeaponMesh?.userData.sb) {
    // The jaws snap and spit fire; the last shell's fire coughs out.
    soulBlazerShot(game.activeWeaponMesh);
    soulBlazerMouth(game.activeWeaponMesh, game._sbPos, game._sbDir);
    game.hellfireView.burst(game._sbPos, game._sbDir, 1 - 0.45 * w.adsT);   // a little less in your face down the sight
    if (w.ammoInMag <= 0) {
      setTimeout(() => {
        if (!game.activeWeaponMesh?.userData.sb) return;
        soulBlazerMouth(game.activeWeaponMesh, game._sbPos, game._sbDir);
        game.hellfireView.cough(game._sbPos, game._sbDir);
        game.audio.emberCough();
      }, 260);
    }
  }

  // Part of the kick is permanent climb the player has to pull back down —
  // that's what makes recoil control a skill rather than a wait.
  game.look.pitch = Math.min(game.PITCH_LIMIT, game.look.pitch + def.recoilKickPitch * 0.35 * (1 - w.adsT * 0.35));

  const pellets = def.pellets || 1;
  const origin = new THREE.Vector3();
  game.camera.getWorldPosition(origin);
  const forward = new THREE.Vector3();
  game.camera.getWorldDirection(forward);

  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  const muzzle = origin.clone().addScaledVector(forward, 0.35);
  game.localShotAt = performance.now();
  if (game.isPvp()) game.net.reportShot(muzzle, forward, def.id, !!def.quiet, shot?.level ?? 0);
  if (royale && !def.quiet) royaleNoise(game.move.pos.x, game.move.pos.z, game.net.id);

  for (let i = 0; i < pellets; i++) {
    // A charged bolt holds its line: the charge steadies the cone.
    const spread = (def.pelletSpread != null ? def.pelletSpread : w.spread) * (1 - 0.7 * (shot?.level ?? 0));
    // Uniform disc around the aim axis — an even cone, unlike the old
    // world-axis rotation which skewed badly when looking up or down.
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * spread * 0.5;
    const dir = forward.clone()
      .addScaledVector(right, Math.cos(a) * r)
      .addScaledVector(up, Math.sin(a) * r)
      .normalize();
    game.bullets.spawn({ origin: muzzle.clone(), dir, def, ownerId: "player" });
    game.player.shotsFired++;   // combat record accuracy
  }
}

/* An enemy Dragonfire's or SAM Turret's hit volume. */
function resolveStreakKit(object) {
  const e = object?.userData?.air || object?.userData?.sam;
  return e ? { isStreakKit: true, entity: e } : null;
}

export function resolveBulletTarget(object) {
  return game.hitboxLab?.resolve(object)
    || resolveStreakKit(object)
    || resolveK9(object)
    || game.rangeSet?.resolve(object)
    || game.remotes.resolve(object)
    || game.zdir?.resolve(object)
    || findGruntFromObject(object);
}

export function onBulletActorHit(actor, info) {
  if (actor.isLabDummy) {
    // The lab scores the round itself (onTrace); here it's just the feedback.
    showHitmarker(info.isHead, info.damage, info.point, false);
    game.impactFx.hit(info.point, { normal: info.dir.clone().negate(), dir: info.dir, surface: "zombie", scale: info.isHead ? 1.3 : 1 });
    return;
  }
  if (actor.isStreakKit) {
    damageStreakEntity(actor.entity, info.damage, game.net.id);
    showHitmarker(false, info.damage, info.point, false);
    game.impactFx.hit(info.point, { normal: info.dir.clone().negate(), dir: info.dir, surface: "metal", scale: 1 });
    game.spawnImpactBurst(info.point, 0xffd08a, 5);
    return;
  }
  if (actor.isK9Dog) {
    // An enemy dog: its owner applies the damage (damageDog forwards it).
    damageDog(actor.pack, actor.i, info.damage, game.net.id);
    showHitmarker(false, info.damage, info.point, false);
    game.impactFx.hit(info.point, { normal: info.dir.clone().negate(), dir: info.dir, surface: "zombie", scale: 0.9 });
    return;
  }

  if (actor.isRangeTarget) {
    const { killed } = actor.takeDamage(info.damage, info.isHead);
    showHitmarker(info.isHead, info.damage, info.point, killed);
    game.impactFx.hit(info.point, { normal: info.dir.clone().negate(), dir: info.dir, surface: "wood", scale: info.isHead ? 1.4 : 1 });
    game.reportRangeShot(actor, info, killed);
    return;
  }

  if (actor.isZombie) {
    const { killed, points } = actor.takeDamage(info.damage, info.isHead);
    game.zdir.award(points);
    showHitmarker(info.isHead, info.damage, info.point, killed);
    game.impactFx.hit(info.point, { normal: info.dir.clone().negate(), dir: info.dir, surface: actor.body ? "blood" : "zombie", scale: info.isHead ? 1.5 : 1.1 });
    // A headshot kill takes the head off: a burst out the far side and up.
    const popped = killed && info.isHead ? actor.popHead?.() : null;
    if (popped) {
      game.impactFx.hit(popped, { normal: info.dir, dir: info.dir, surface: "blood", scale: 4 });
      game.impactFx.hit(popped, { normal: THREE.Object3D.DEFAULT_UP, surface: "blood", scale: 3 });
      game.audio.zombieHeadPop(popped);
    }
    if (actor.rig) flinchRigFrom(actor.rig, info.dir, info.isHead ? 1 : 0.5);
    else actor.flinchFrom?.(info.dir, info.isHead ? 1 : 0.5);
    if (killed) {
      game.zdir.kills++;
      game.player.kills++;
      game.audio.kill();
      pushKillfeed(`${info.isHead ? "Headshot — " : ""}+${points}`);
    }
    return;
  }

  // Remote players own their own health: we report the hit and they apply it.
  if (actor.netId) {
    game.player.shotsHit++;   // combat record accuracy: a round on an enemy player or bot
    game.noteDealt(actor.netId, info.damage);
    if (heroActive()) hero().onDealt(info.damage);
    // Our own bots never hear our broadcasts, so resolve those locally.
    const shotWith = info.creditAs || currentWeapon().def.id;
    let killedNow = false;
    if (game.bots.byId(actor.netId)) {
      const { killed, bot } = game.bots.applyHit(actor.netId, info.damage);
      killedNow = killed;
      if (killed) {
        game.dealtLog.delete(actor.netId);
        game.net.reportDeathAs(actor.netId, game.net.id, shotWith, info.isHead);
        game.registerDeath(bot.name, game.net.id, shotWith, {
          head: info.isHead, victimTeam: bot.team, victimIsBot: true,
          victimPos: bot.pos, victimWeaponId: bot.weaponId,
          victimId: bot.id, distance: info.distance || 0,
        });
      }
    } else {
      game.net.reportHit(actor.netId, info.damage, info.isHead, shotWith);
      // A peer applies its own damage and reports its own death, so the range
      // we hit it from is only known here. Remember the last one per target
      // so the kill that comes back off the wire can still be a Longshot.
      game.lastHitRange.set(actor.netId, info.distance || 0);
    }
    showHitmarker(info.isHead, info.damage, info.point, killedNow);
    game.impactFx.hit(info.point, { normal: info.dir.clone().negate(), dir: info.dir, surface: "ink", scale: info.isHead ? 1.5 : 1.1 });
    if (actor.rig) flinchRigFrom(actor.rig, info.dir, info.isHead ? 1 : 0.5);
    return;
  }
  onGruntBulletHit(actor, info);
}

function onGruntBulletHit(grunt, { damage, isHead, point, dir }) {
  const knockDir = dir.clone(); knockDir.y = 0; knockDir.normalize();
  const result = grunt.takeDamage(damage, isHead, knockDir);
  showHitmarker(isHead, damage, point, result.killed);
  game.impactFx.hit(point, { normal: dir.clone().negate(), dir, surface: "grunt", scale: isHead ? 1.5 : 1.1 });
  if (grunt.rig) flinchRigFrom(grunt.rig, dir, isHead ? 1 : 0.5);
  if (result.killed) {
    game.player.kills++;
    game.els.hudKills.textContent = String(game.player.kills);
    pushKillfeed(`${isHead ? "Headshot — " : ""}Grunt down`);
  }
}

function findGruntFromObject(obj) {
  let o = obj;
  while (o) {
    if (o.userData && o.userData.dissolveMat) {
      const grunt = game.spawner.grunts.find((g) => g.mesh === o);
      if (grunt) return grunt;
    }
    o = o.parent;
  }
  return null;
}

export function setHolding(what) {
  if (game.player.holding === what) return;
  if (game.socialUnarmed()) return;   // hands stay empty in the hangout
  if (game.isInfected() && what !== "melee") return;   // the sword is all they have
  if (what === "melee" && !game.player.melee) return;
  game.player.holding = what;
  if (game.activeWeaponMesh) game.activeWeaponMesh.visible = what === "gun";
  if (game.activeMeleeMesh) game.activeMeleeMesh.visible = what === "melee";
  game.activeStreakMesh.visible = what === "streak" && game.streakDeviceKind === "tablet";
  if (what !== "streak") game.activeMarkerMesh.visible = game.activeDroneMesh.visible = false;
  game.muzzleFlash.visible = what === "gun";
  updateGearHud();
}

/* 1 draws the primary, 2 the secondary - rebuilds the visible gun mesh for
   whichever def that slot now points at and makes it the active weapon.
   No-op in modes with no secondary (equipFromLoadout leaves
   player.secondaryId null there - Gun Game, One in the Chamber) or when
   already holding that slot's gun. */
export function switchWeapon(slot) {
  if (game.socialUnarmed()) return;
  if (warshipView()) { toggleWarshipGun(); return; }
  if (game.isInfected()) return;
  // Mid-streak the tablet/marker is in your hands; a swap would yank it away
  // and leave you on the other gun once the streak is done.
  if (game.player.holding === "streak") return;
  const id = slot === "secondary" ? game.player.secondaryId : game.player.weaponId;
  if (!id || !game.player.weapons[id]) return;
  // An energy blade powers down in the hand before the gun comes up.
  if (game.powerHeld() && !game.meleePutAway && !game.player.melee?.busy && game.player.alive) { game.holsterMeleeThen(() => switchWeapon(slot)); return; }
  const w = game.player.weapons[id];
  if (game.player.holding === "gun" && w === currentWeapon()) return;
  // A shell-by-shell reload is dropped on a swap; shells already in stay in.
  const prev = currentWeapon();
  if (prev !== w && prev?.def.shellReload) prev.abortReload();
  if (prev !== w && prev?.charging) game.endCandleCharge(prev);
  game.currentWeaponSlot = slot;
  game.setActiveWeaponMesh(w.def);
  setHolding("gun");
}

/* Gamepad-only: keyboard has three dedicated keys (1/2/3) for primary/
   secondary/melee, but the pad only has one free face button for this, so it
   cycles through whatever's actually equipped instead. Skips secondary when
   there isn't one (Gun Game, One in the Chamber, or no sidearm picked up
   yet) rather than landing on a dead slot. */
export function cycleWeapon() {
  if (game.socialUnarmed()) return;
  if (game.player.holding === "streak") return;   // same reason as switchWeapon
  const order = ["primary", ...(game.player.secondaryId ? ["secondary"] : []), "melee"];
  const current = game.player.holding === "melee" ? "melee" : game.currentWeaponSlot;
  const at = order.indexOf(current);
  const next = order[(at + 1) % order.length];
  if (next === "melee") setHolding("melee");
  else switchWeapon(next);
}

/* Hold X: standing over a dropped weapon, picks it up into the secondary
   slot — replacing the sidearm there if any, same as Call of Duty. Nothing
   underfoot, the same hold instead instantly swaps primary/secondary.

   A care package underfoot takes priority over both: it is the rarer thing
   and you are deliberately standing on it. Same key for all three, because
   "hold X on the thing at your feet" is one idea, not three. */
let pkgHoldT = 0;
export function updatePickupPrompt(dt) {
  const pkg = game.player.alive ? nearbyPackage() : null;
  // Troll Royale: guns on the ground are loot, picked up the same way.
  const lootGun = royale && game.player.alive ? royale.loot.nearest(game.move.pos.x, game.move.pos.z, 1.6, (it) => it.k === "gun") : null;
  const drop = lootGun ? { def: lootGun.def, loot: lootGun, name: gunDisplayName(lootGun) }
    : (game.player.alive && !royale ? game.pickups.nearest(game.move.pos.x, game.move.pos.z) : null);
  // D-pad right only counts as "hold X" with something underfoot. With
  // nothing there the same press fires a streak, and counting it here too
  // swapped you onto your secondary every time you called one (Y swaps).
  const padHold = game.gamepadState.pickup && !(game.isSnd() && game.sndCanInteract) && (!!pkg || !!drop);
  // While X can accept or send a duo emote, it does that (updateDuo) instead.
  // In a streak, holding X ends it instead (updateStreakControl).
  const held = !frozenPlayer() && !game.duoXClaimed && !streakControlActive() && ((game.isTouch && touchState.swap) || game.keys.has("KeyX") || padHold);

  // A package has its own capture clock (BO2: the owner grabs it fast, an
  // enemy stands there stealing it). `canPickup` keeps the instant-swap
  // branch from firing while we're on one — holding X must capture it, not
  // switch guns.
  if (pkg && held) {
    pkgHoldT += dt;
    if (pkgHoldT >= packageCaptureTime(pkg)) {
      pkgHoldT = 0;
      claimPackage(pkg);
      if (game.els.pickupPrompt) game.els.pickupPrompt.hidden = true;
      setTouchContext(null);
      return;
    }
  } else pkgHoldT = 0;
  const action = game.swapHold.update(dt, held && !pkg, !!drop || !!pkg);
  if (action === "swap") {
    switchWeapon(game.currentWeaponSlot === "secondary" ? "primary" : "secondary");
  } else if (action === "pickup" && drop?.loot) {
    royalePickupGun(drop.loot);
  } else if (action === "pickup" && drop) {
    game.pickups.take(drop);
    game.player.secondaryId = drop.def.id;
    game.player.weapons[drop.def.id] = new WeaponState(drop.def);
    // Equip it into your hands immediately, same as CoD - without this,
    // player.secondaryId/weapons updated but the held mesh (and holding
    // "melee" at the time) never refreshed, so picking up a weapon looked
    // like it did nothing unless you happened to already be on the
    // secondary slot and pressed 2 afterward.
    game.currentWeaponSlot = "secondary";
    game.setActiveWeaponMesh(drop.def);
    setHolding("gun");
    game.audio.reload();
    showWaveBanner(`Picked up ${drop.def.name}`, 1200);
  }

  // Touch: the swap button turns into a labelled CAPTURE / PICK UP button
  // while there is something to take, so it reads as the thing to hold.
  setTouchContext(game.player.alive ? (pkg ? "Capture" : drop ? "Pick up" : null) : null);

  if (game.els.pickupPrompt) {
    if ((pkg || drop) && game.player.alive) {
      // No key hint in the prompt (user, 2026-09-28): just the action.
      const steal = pkg && (!pkg.owned || pkg.botId) && (game.currentMode().ffa || !game.net.team || pkg.ownerTeam !== game.net.team);
      const label = pkg
        ? (pkgHoldT > 0 ? (steal ? "Stealing the care package…" : "Capturing…") : `${steal ? "Steal" : "Capture"} the care package`)
        : (game.swapHold.active ? `Picking up ${drop.name || drop.def.name}…` : `Pick up ${drop.name || drop.def.name}`);
      game.els.pickupPrompt.hidden = false;
      game.els.pickupPromptText.textContent = label;
      // Troll Royale is the exception to "no key hints" (user, 2026-09-29):
      // loot is the whole game there and nobody knew it was a hold. A keycap
      // that pulses until you start holding it. Touch has its own labelled
      // PICK UP button, so no cap there.
      const cap = !!royale && !!drop?.loot && !game.isTouch;
      game.els.pickupPrompt.classList.toggle("is-royale", cap);
      if (game.els.pickupKey) {
        game.els.pickupKey.hidden = !cap;
        if (cap) {
          const k = game.gamepadState.connected ? "D-pad →" : "X";
          if (game.els.pickupKeyCap.textContent !== k) game.els.pickupKeyCap.textContent = k;
          game.els.pickupKey.classList.toggle("is-held", game.swapHold.active);
        }
      }
      const progress = pkg ? pkgHoldT / packageCaptureTime(pkg) : game.swapHold.progress;
      game.els.pickupBarFill.style.width = `${Math.round(progress * 100)}%`;
    } else {
      game.els.pickupPrompt.hidden = true;
    }
  }
}

export function setTouchContext(label) {
  const b = game.els.touchSwap;
  if (!b || !game.isTouch) return;
  const on = !!label;
  if (b.classList.contains("is-context") === on && (!on || b.dataset.ctx === label)) return;
  b.classList.toggle("is-context", on);
  b.dataset.ctx = label || "";
  const span = b.querySelector(".to-touch-ctx");
  if (span) span.textContent = label || "";
  b.setAttribute("aria-label", on ? `Hold to ${label.toLowerCase()}` : "Hold to swap weapons, pick up a dropped weapon, or open a care package");
}

/* The landed, unclaimed package we're standing on, if any. */
export function nearbyPackage() {
  for (const e of streakEntities.values()) {
    if (e instanceof CarePackage && e.withinClaim(game.move.pos.x, game.move.pos.z)) return e;
  }
  return null;
}

export function frozenPlayer() { return !game.player.alive || stageFrozen() || royaleDropView(); }

export function updateGearHud() {
  const melee = (game.player.melee && game.player.melee.def) || game.loadout.melee;
  game.els.gearMeleeName.textContent = melee.name;
  game.els.gearMelee.classList.toggle("is-active", game.player.holding === "melee");
  game.els.gearLethalName.textContent = game.loadout.lethal.name;
  game.els.gearLethalN.textContent = String(game.player.gear.lethal);
  game.els.gearLethal.classList.toggle("is-empty", game.player.gear.lethal <= 0);
  game.els.gearTacticalName.textContent = game.loadout.tactical.name;
  game.els.gearTacticalN.textContent = String(game.player.gear.tactical);
  game.els.gearTactical.classList.toggle("is-empty", game.player.gear.tactical <= 0);
  // One throwable slot: the kind you didn't bring has no chip and no button.
  const offKind = game.loadout.throwKind === "lethal" ? "tactical" : "lethal";
  game.els.gearLethal.classList.toggle("is-uncarried", offKind === "lethal");
  game.els.gearTactical.classList.toggle("is-uncarried", offKind === "tactical");
  game.els.touchNade?.classList.toggle("is-uncarried", offKind === "lethal");
  game.els.touchTac?.classList.toggle("is-uncarried", offKind === "tactical");
  // Touch: the buttons are icons and carry the count (the chips are hidden there).
  if (game.els.touchNade) {
    game.els.touchNade.setAttribute("aria-label", `Throw ${game.loadout.lethal.name}`);
    game.els.touchNade.dataset.n = String(game.player.gear.lethal);
    game.els.touchNade.classList.toggle("is-empty", game.player.gear.lethal <= 0);
  }
  if (game.els.touchTac) {
    game.els.touchTac.setAttribute("aria-label", `Throw ${game.loadout.tactical.name}`);
    game.els.touchTac.dataset.n = String(game.player.gear.tactical);
    game.els.touchTac.classList.toggle("is-empty", game.player.gear.tactical <= 0);
  }
}
