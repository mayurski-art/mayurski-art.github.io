// The local player's per-frame update: look, movement, the camera rig,
// firing and melee input, regen, and the per-frame HUD numbers.

import { touchState, setTouchAds } from "../input/touch.js?v=in1";
import { currentWeapon, fireOnce, tryReload } from "../combat/weapons.js?v=wp1-kc2-si1-gj1-fu1";
import { MOUSE_ACTIVE_MS, applyAimAssist, AIM_ASSIST_MOUSE_PULL } from "../input/aim-assist.js?v=in1-fu1";
import { isStaging } from "../modes/match-start.js?v=mst1-si1-mb1-gj1-if1-fu1";
import { dragonfireView, DF_ASSIST_PULL, DF_ASSIST_CONE_DEG, fireDragonfire } from "../streaks/dragonfire.js?v=sk1-si1-gj1-fu1";
import { lookSensScale, warshipView, placeWarshipCamera, fireWarship } from "../streaks/warship.js?v=sk1-si1-gj1-fu1";
import { royaleDropView, royaleRolling, stageFrozen, updateRoyaleRoll, royaleRollK, ROLL_SPEED, updateDropPlayer, royale, royaleSpectating, placeSpectateCamera, placeDropCamera, _dropTarget, cancelRoyaleAct } from "../modes/royale.js?v=md1-gj1-fu1";
import { bar, seated, holdSeat } from "../modes/social-rp.js?v=rp1-si1-gj1-if1-fu1";
import { updateTrain } from "../modes/social-train.js?v=st1";
import { updateDuel, duelFire } from "../modes/social-duel.js?v=sd1";
import { TIPSY, tipsyFx } from "../saloon-bar.js?v=sb1";
import { strikeTablet, throwMarker } from "../streaks/fire.js?v=sk1-si1-gj1-fu1";
import { insidePolygon } from "../edge.js";
import { INFECTION } from "../modes.js?v=umb1-rn-wst-tl1-bs1-soc1-t69-u69";
import { heroActive, hero } from "../modes/umb-heroes.js?v=sk1-si1-gj1-fu1";
import { updateSwivel, updateLocalRig, placeDeathCamera, updateEmoteCamera, updateThirdPersonCamera, swivel, swivelK } from "./third-person.js?v=tp1-si1-gj1-if1-fu1";
import { DF_RANGE } from "../dragonfire.js?v=df3-sb2";
import { settings } from "../menu/settings.js?v=ms1-gj1-fu1";
import { EMOTES } from "../emote-wheel.js?v=hb4-em1-wst-soc1";
import { damp } from "../anim-curves.js";
import { STANCE } from "../movement.js?v=umb2-sb2-gj1";
import { kbRepair, meleeConnect, updateSaberBlock, updateKbShield, swingMelee } from "../combat/melee.js?v=ml1-kc2-si1-gj1-fu1";
import { KB_GLANCE } from "../keyboard-repair.js?v=kr15";
import { updateDamageNumbers } from "../core/hud.js?v=cr1-si1-gj1-fu1";
import { chargedShotDef } from "../weapons.js?v=p5bm-wst-hf1-fu1";
import { game } from "../core/state.js?v=st1";

/* Last value written to each per-frame HUD node. The DOM write itself is
   cheap, but it was unconditional — every one of these touched layout/paint
   60×/sec even sitting still with full ammo and health. Comparing first
   means the browser only does anything the frame a number actually moves. */
export const hudCache = { hpPct: -1, hpLow: null, hpText: -1, ammoCur: -1, ammoRes: -1, reloadHidden: null, ads: null, adsHide: null, adsTp: null, lowhp: null };

/* Passive regen: health climbs back to full on its own once you've been out
   of a fight for a beat, instead of every scratch being permanent until the
   next respawn (there is no med pickup). The delay after the last hit is
   what keeps trading meaningful — regen never starts mid-fight. */
const REGEN_DELAY = 4.5;   // seconds since last hit before regen kicks in
const REGEN_RATE = 12;     // hp per second once it starts

export function regenPlayer(dt) {
  if (!game.player.alive || game.player.hp >= game.player.maxHp) return;
  if (performance.now() - game.player.lastHurtAt < REGEN_DELAY * 1000) return;
  game.player.hp = Math.min(game.player.maxHp, game.player.hp + REGEN_RATE * dt);
}

/* View mode's camera: flies where you look, through everything, no gravity.
   Space / jump up, C / Ctrl / crouch down, Shift (or the stick pushed all
   the way) for speed. */
const VIEW_FLY_SPEED = 12;
function flyView(dt, ix, iz) {
  const gp = game.gamepadState.connected;
  const up = game.keys.has("Space") || (game.isTouch && touchState.jump) || (gp && game.gamepadState.jump) ? 1 : 0;
  const down = game.keys.has("KeyC") || game.keys.has("ControlLeft") || (game.isTouch && touchState.crouch) || (gp && game.gamepadState.crouch) ? 1 : 0;
  const fast = game.keys.has("ShiftLeft") || ((game.isTouch || gp) && iz > 0.9) ? 3.5 : 1;
  const sp = VIEW_FLY_SPEED * fast * dt;
  const cy = Math.cos(game.look.yaw), sy = Math.sin(game.look.yaw), cp = Math.cos(game.look.pitch);
  game.move.pos.x += (-sy * cp * iz + cy * ix) * sp;
  game.move.pos.z += (-cy * cp * iz - sy * ix) * sp;
  game.move.pos.y = Math.max(-30, game.move.pos.y + (Math.sin(game.look.pitch) * iz + up - down) * sp);
  game.move.velocity.set(0, 0, 0);
}

/* Seconds a trigger pull keeps you out of a sprint (updatePlayer). */
const FIRE_SPRINT_HOLD = 0.35;
let fireSprintHoldT = 0;
let fireWasDown = false;

export function updatePlayer(dt) {
  const w = currentWeapon();

  if (game.streakHoldT > 0 && !game.streakHoldUntilMark) {
    game.streakHoldT -= dt;
    if (game.streakHoldT <= 0) game.endStreakHold();
  }

  const gp = game.gamepadState.connected;

  // The pad's own assist runs in pollGamepad off stick deflection; touch
  // gets the same while a thumb is down on the look pad, and mouse or
  // trackpad while it's being moved. aimAssistSticky is left set from the
  // pad's pass this frame, so only clear it when nothing is steering.
  const mouseSteering = game.controls.isLocked && performance.now() - game.mouseLookAt < MOUSE_ACTIVE_MS;
  const canAssist = game.player.alive && !isStaging() && !dragonfireView();
  if (canAssist && touchState.looking) applyAimAssist(dt);
  if (canAssist && mouseSteering) applyAimAssist(dt, AIM_ASSIST_MOUSE_PULL);

  if ((game.isTouch &&(touchState.lookDX || touchState.lookDY)) || (gp && (game.gamepadState.lookDX || game.gamepadState.lookDY))) {
    const ls = lookSensScale();
    game.look.yaw -= (touchState.lookDX + game.gamepadState.lookDX) * ls;
    game.look.pitch -= (touchState.lookDY + game.gamepadState.lookDY) * ls;
    game.look.pitch = Math.max(-game.PITCH_LIMIT, Math.min(game.PITCH_LIMIT, game.look.pitch));
    touchState.lookDX = 0; touchState.lookDY = 0;
    game.gamepadState.lookDX = 0; game.gamepadState.lookDY = 0;
  }

  let ix = 0, iz = 0;
  if (game.isTouch) {
    ix += touchState.moveX;
    iz += -touchState.moveY;
  }
  if (gp) {
    ix += game.gamepadState.moveX;
    iz += -game.gamepadState.moveY;
  }
  if (!game.isTouch && !gp) {
    if (game.keys.has("KeyW")) iz += 1;
    if (game.keys.has("KeyS")) iz -= 1;
    if (game.keys.has("KeyA")) ix -= 1;
    if (game.keys.has("KeyD")) ix += 1;
  }
  ix = Math.max(-1, Math.min(1, ix));
  iz = Math.max(-1, Math.min(1, iz));

  // Dead players keep their camera but stop driving anything — and so does
  // everyone during the pre-match countdown. Look is deliberately still live:
  // you can size up the room while you wait, you just can't leave the mark.
  // The pause menu being open in a live-with-others match freezes this
  // client's own avatar the same way death or staging does, while net
  // updates, bots and remote players keep simulating around it.
  // Heads-down on the strike tablet: you stand still, as in BO2.
  // On the bus or in the air your stick steers the fall, not your feet.
  const dropping = royaleDropView();
  const dropIx = ix, dropIz = iz;
  const rolling = royaleRolling();
  game.dfIx = ix; game.dfIz = iz;   // the Dragonfire flies off the same stick
  // The saloon bar: a few drinks in, the walk wanders side to side.
  if (bar.tipsy > TIPSY.onset && game.isSocial() && (ix || iz)) ix = Math.max(-1, Math.min(1, ix + tipsyFx(bar.tipsy, performance.now() / 1000).stagger * 0.45));
  const frozen = dropping || rolling || !game.player.alive || stageFrozen() || game.localPauseOnly || !!strikeTablet?.isOpen || warshipView() || dragonfireView();
  if (frozen) { ix = 0; iz = 0; }
  // The landing roll carries you forward along the glider's line.
  if (rolling) {
    updateRoyaleRoll(dt);
    iz = Math.max(0, 1 - royaleRollK()) * (ROLL_SPEED / 4.2);
  }
  // A toggled AIM shouldn't survive a death or a streak call.
  if (touchState.ads && (!game.player.alive || game.player.holding === "streak")) setTouchAds(false);

  // Q aims as well as right mouse.
  // An EMP kills the optic, so there is nothing to aim down until it clears.
  // Calling a streak swaps the hands to the streak device/marker, so the
  // primary's optic has no business popping up over it (that's the "scoped
  // weapon flash" glitch when activating a killstreak while holding ADS).
  // Staging doesn't block it: scoping in on the mark is harmless (see canAds).
  const wantAds = game.player.alive && !game.isView() && !game.socialUnarmed() && !game.localPauseOnly && game.empT <= 0 && game.player.holding !== "streak"
    && ((game.isTouch && touchState.ads) || (gp && game.gamepadState.ads) || game.adsHeld || game.keys.has("KeyQ"));
  const wantFire = !frozen && !game.isView() && !game.socialUnarmed() && ((game.isTouch && touchState.firing) || (gp && game.gamepadState.firing) || game.mouseDown);
  // The frame the trigger went down (the 16 ms fireEdgeTrigger pulse can
  // fall between two slow frames).
  const firePressed = wantFire && !fireWasDown;
  fireWasDown = wantFire;
  // Pulling the trigger at a run ends the run, like BO2 and PF: the gun
  // comes up and shoots. It used to stay dropped and slung across the body
  // while rounds left from the middle of the screen, which read as not
  // being able to shoot at all. A short hold keeps a semi-auto's taps from
  // dropping the gun between shots. Reloading or empty, you keep running.
  const triggerUp = wantFire && game.player.holding === "gun" && !w.reloading && w.ammoInMag > 0;
  fireSprintHoldT = triggerUp ? FIRE_SPRINT_HOLD : Math.max(0, fireSprintHoldT - dt);
  if (game.isSnd()) {
    game.sndInteractHeld = !frozen && ((game.isTouch && touchState.interact) || (game.keys.has("KeyF") && game.cooking.slot !== "tactical")
      || (gp && game.gamepadState.pickup && game.sndCanInteract));
  }

  // Shallow water (a map's `wade` outline, edge.js): slow, and no sprinting.
  // Only with your feet in it: a jetty, bridge or boat deck over it is dry.
  const wading = !!game.ARENA.wade && game.move.pos.y < 0.5 && insidePolygon(game.ARENA.wade, game.move.pos.x, game.move.pos.z);
  updateTrain();   // the Grin Express, and us on it, before we move (Socialize)
  if (dropping) updateDropPlayer(dt, dropIx, dropIz, (game.isTouch && touchState.jump) || (gp && game.gamepadState.jump) || game.keys.has("Space"));
  else if (game.isView()) flyView(dt, ix, iz);
  else if (seated && game.isSocial()) holdSeat(dt, ix, iz, !frozen && ((game.isTouch && touchState.jump) || (gp && game.gamepadState.jump) || game.keys.has("Space") || game.keys.has("KeyC")));
  else game.move.update(dt, {
    forward: iz,
    strafe: ix,
    sprint: !wading && !rolling && fireSprintHoldT <= 0 && ((game.isTouch || gp) ? iz > 0.82 : game.keys.has("ShiftLeft")),
    jump: !frozen && ((game.isTouch && touchState.jump) || (gp && game.gamepadState.jump) || game.keys.has("Space")),
    crouch: !frozen && ((game.isTouch && touchState.crouch) || (gp && game.gamepadState.crouch) || game.keys.has("KeyC")),
    dive: !frozen && ((game.isTouch && touchState.dive) || game.keys.has("ControlLeft") || game.keys.has("ControlRight")),
    yaw: rolling ? royale.rollYaw : game.look.yaw,
    pitch: game.look.pitch,
    adsHeld: wantAds,
    speedMult: w.moveSpeedMult * (game.isInfected() ? INFECTION.speed : 1) * (wading ? 0.55 : 1) * (heroActive() ? hero().speedMult() : 1),
    // Troll Royale is a 400 m island: sprinting covers it 25% faster.
    sprintMult: (w.def.sprintMult || 1.35) * (game.isRoyale() ? 1.25 : 1),
    inertia: w.def.inertia,
  });

  // fist fights with the townsfolk (Socialize): after we've moved, so a
  // bump reads our speed and a knock-down holds us where we fell
  if (game.isSocial()) { duelFire(); updateDuel(dt); }

  updateSwivel(dt);

  if (game.move.moving && game.move.grounded && game.player.alive) {
    game.stepPhase += dt * (game.move.sprinting ? 13 : 9);
    if (game.stepPhase > Math.PI) { game.stepPhase -= Math.PI; game.audio.step(); }
  } else {
    game.stepPhase = 0;
  }
  if (game.move.justLanded && game.player.alive) game.audio.land(game.move.landSpeed);

  game.updateEnemySteps(dt);

  game.move.eyePosition(game.player.pos);

  // While it's running, the kill cam owns camera.position/.quaternion in
  // full — skip both the eye-position copy and the aim/recoil composition
  // below so the two don't fight over the same camera in the same frame.
  if (game.killcam.update(dt)) return;
  // Catches the orbit finishing on its own (as opposed to being cut short by
  // respawnPlayer's killcam.cancel(), which already clears this itself) —
  // classList.remove on an absent class is a no-op, so this is safe every frame.
  game.els.killcamBars.classList.remove("is-on");

  // The local rig always follows the player (even in first-person, when
  // it's simply invisible) so it's never a frame stale the moment third
  // person is toggled on, and so OTHER systems that might reasonably poke
  // at it (screenshots, a future killcam angle) see a live pose.
  updateLocalRig(dt);

  // The match intro owns the camera outright while it plays (staging, so
  // nobody can move or shoot anyway). Your own body is in the shot until
  // the camera pushes into your eyes.
  if (game.matchIntro.active) {
    game.matchIntro.update(dt);
    if (game.matchIntro.active) {
      game.localRig.root.visible = game.matchIntro.selfVisible;
      game.localRig.parts.head.visible = true;
      game._listenFwd.set(0, 0, -1).applyQuaternion(game.camera.quaternion);
      game._listenUp.set(0, 1, 0).applyQuaternion(game.camera.quaternion);
      game.audio.setListener(game.camera.position, game._listenFwd, game._listenUp);
      return;
    }
  }

  const shake = game.shakeT > 0 ? game.shakeMag * (game.shakeT / 0.45) : 0;
  // Phase 6 (DESIGN-ARMS.md §5, camera polish): small, separately-tuned
  // camera-only echoes of the viewmodel's own landing dip and melee impact-
  // stop — same trigger state (landDipT/landDipMag, meleeImpactT), much
  // smaller magnitude, so the whole screen never shakes as hard as the gun
  // moves. Read one frame behind their viewmodel counterparts (updatePlayer
  // runs before updateWeaponView each frame) — imperceptible on a decaying
  // effect, not worth reordering the main loop over.
  const landKick = game.landDipMag * game.landDipT * 0.05;
  const meleeKick = game.meleeImpactT * 0.03;
  game.updateFireShake(dt);
  const buzz = game.fireShake.buzz;
  const fpCam = game.fpEmoteFrame()?.cam;   // a first-person emote's head motion (a laugh, a facepalm)
  const viewYaw = game.look.yaw + w.recoilYaw + (Math.random() - 0.5) * shake + game.fireShake.y + (Math.random() - 0.5) * buzz
    + (fpCam?.yaw || 0) + (Math.random() - 0.5) * game.sawShake;
  game.updateTabletDive(dt);
  const viewPitch = game.look.pitch - game.tabletDiveDip() + w.recoilPitch + (Math.random() - 0.5) * shake + landKick + meleeKick
    + game.fireShake.p + (Math.random() - 0.5) * buzz + (fpCam?.pitch || 0) + (Math.random() - 0.5) * game.sawShake;

  if (royaleSpectating()) {
    game.localRig.root.visible = false;
    placeSpectateCamera(dt);
  } else if (!game.player.alive && game.gameState === "playing") {
    placeDeathCamera();
  } else if (dragonfireView()) {
    // Flying the Dragonfire through its nose camera; your body stays put.
    // Its own airframe is hidden from its own camera: the gun and the
    // rotor arms used to hang across the view (user: fix the camera).
    game.localRig.root.visible = true;
    game.dragonfire.root.visible = false;
    game.dragonfire.cameraPose(game.camera.position, game.camera.quaternion);
    // Aim assist (user): a pull onto whoever is near the reticle, out to the
    // gun's range, while you shoot or aim. Just flying, it leaves the drone
    // alone: a constant pull steered it into walls.
    const dfFiring = (game.isTouch && touchState.firing) || (gp && game.gamepadState.firing) || game.mouseDown;
    if (!game.localPauseOnly && (dfFiring || mouseSteering || touchState.looking || gp)) applyAimAssist(dt, DF_ASSIST_PULL, DF_ASSIST_CONE_DEG, DF_RANGE);
    if (!game.localPauseOnly && dfFiring) fireDragonfire();
  } else if (warshipView()) {
    // Up in the VTOL's gunner seat; your body stands where you called it.
    game.localRig.root.visible = true;
    placeWarshipCamera();
    if ((game.isTouch && touchState.firing) || (gp && game.gamepadState.firing) || game.mouseDown) fireWarship();
  } else if (royaleDropView()) {
    // Third person on the drop: behind the bus while you ride, then behind
    // you (and your glider) on the way down. Look orbits the camera.
    game.localRig.root.visible = royale.me !== "bus";
    if (royale.me === "bus") placeDropCamera(royale.drop.bus ? royale.drop.bus.position : game.move.pos, 26, 8);
    else placeDropCamera(_dropTarget.set(game.move.pos.x, game.move.pos.y + (royale.me === "glide" ? 3 : 1.4), game.move.pos.z), royale.me === "glide" ? 10 : 7, 1.5);
  } else if (settings.thirdPerson || game.emoteIsTp()) {
    game.localRig.root.visible = true;
    if (game.emoteIsTp()) updateEmoteCamera(game.player.pos, game.look.yaw, game.emoteKind() === "duo" ? EMOTES[game.emote.idx].dist || 1 : 0);
    else updateThirdPersonCamera(game.player.pos, viewYaw, viewPitch, w.adsT);
  } else {
    game.localRig.root.visible = false;
    game.localRig.parts.head.visible = true;
    game.camera.position.copy(game.player.pos);
    // Landing roll: the view goes head over heels once and dips as you tuck.
    const rollK = royaleRollK();
    if (rollK > 0) game.camera.position.y -= Math.sin(Math.PI * rollK) * 0.9;
    // PF slide: the view tips over a few degrees while you slide, leaning
    // toward the side you're steering (left by default).
    game.slideTiltT = damp(game.slideTiltT, game.move.stance === STANCE.SLIDE ? 1 : 0, 9, dt);
    const slideRoll = game.slideTiltT * 0.075 * ((game.move.strafeInput ?? 0) > 0.2 ? -1 : 1)
      + (swivel.dir ? -swivel.dir * 0.16 * Math.sin(Math.PI * swivelK()) : 0);
    // One place composes the camera: aim + weapon recoil.
    const rollPitch = rollK > 0 ? -Math.PI * 2 * rollK * rollK * (3 - 2 * rollK) : 0;
    // Keyboard repair: the head glances up at the messenger. The viewmodel
    // camera turns with it, so the board drops away in view and the floating
    // message comes to the middle, like you looked up at it.
    const glance = kbRepair.active ? kbRepair.glance : 0;
    // Tipsy (the saloon bar): the room leans and bobs a little.
    const tip = bar.tipsy > TIPSY.onset && game.isSocial() ? tipsyFx(bar.tipsy, performance.now() / 1000) : null;
    game._euler.set(viewPitch + rollPitch + glance * KB_GLANCE.pitch + (tip?.pitch || 0), viewYaw + glance * KB_GLANCE.yaw, (Math.random() - 0.5) * shake * 0.6 + game.fireShake.r + slideRoll + (tip?.roll || 0));
    game.camera.quaternion.setFromEuler(game._euler);
    if (glance > 0 || game.weaponCamera.userData.glanced) {
      game.weaponCamera.quaternion.setFromEuler(game._euler.set(glance * KB_GLANCE.pitch, glance * KB_GLANCE.yaw, 0, "YXZ"));
      game.weaponCamera.userData.glanced = glance > 0;
    }
  }

  // Panned sounds resolve against wherever the camera now is and faces.
  game._listenFwd.set(0, 0, -1).applyQuaternion(game.camera.quaternion);
  game._listenUp.set(0, 1, 0).applyQuaternion(game.camera.quaternion);
  game.audio.setListener(game.camera.position, game._listenFwd, game._listenUp);

  // Projects against the camera, so it has to follow the camera update or
  // every number trails a frame behind the thing it is stuck to.
  updateDamageNumbers(dt);

  // Swinging locks out the trigger; the melee weapon has no trigger at all.
  const swinging = !!game.player.melee && game.player.melee.busy;
  if (game.player.melee && game.player.melee.update(dt)) meleeConnect();

  const canAct = !game.move.busy && game.player.alive && !stageFrozen() && !royaleDropView() && !warshipView();
  // Pulling the trigger drops a plate or a Hopium half-used.
  if (royale?.act && wantFire) cancelRoyaleAct();
  // Aiming itself is harmless during the pre-match countdown — no shooting,
  // no movement change beyond what ADS already slows — so it gets its own,
  // looser gate instead of inheriting the staging freeze from canAct.
  const canAds = !game.move.busy && game.player.alive;
  w.update(dt, {
    moving: game.move.moving,
    sprinting: game.move.sprinting,
    grounded: game.move.grounded,
    jumping: game.move.jumping,
    // A held melee weapon has the hands: the gun behind it doesn't scope in
    // (with the saber, aim is the block instead).
    adsHeld: wantAds && canAds && game.player.holding !== "melee" && !w.def.noAds,
    canAds,
  });
  updateSaberBlock(dt, wantAds && canAds);
  updateKbShield(wantAds && canAds);

  // A charge only lives while the gun is up: melee, a streak device or
  // death drops it.
  if (w.charging && (game.player.holding !== "gun" || !game.player.alive)) endCandleCharge(w);

  // Holding the melee weapon turns the fire button into a swing.
  if (game.player.holding === "melee") {
    if (wantFire && game.fireEdgeTrigger && canAct) swingMelee();
    return;
  }

  // Holding the care package marker: fire throws it.
  if (game.player.holding === "streak" && game.markingStreak === "carepackage" && wantFire && game.fireEdgeTrigger) throwMarker();

  // Looking at the streak device (DESIGN-ARMS.md Phase 5 §5's explicit
  // interaction-bug call-out): fire is disabled outright rather than
  // silently shooting through a hidden gun mesh while the device is up.
  if (game.player.holding === "streak") return;

  // Fire mid-reload with rounds still in the mag: the reload stops (the mag
  // keeps what it had) and the gun shoots. Shell-by-shell guns stop their
  // own way below (interruptReload).
  if (wantFire && canAct && !swinging && (game.fireEdgeTrigger || firePressed) && w.reloading && !w.def.shellReload
      && w.ammoInMag > 0 && w.def.fireMode !== "charge") w.abortReload();

  if (w.def.fireMode === "charge") {
    updateCandleCharge(w, dt, wantFire && canAct && !swinging);
  } else if (w.def.fanFire && wantAds && canAct && !swinging) {
    // The Peacemakers have no sights: aim fans the hammers, fast and wild.
    if (w.canFire()) fireOnce({ fan: true });
    else if (w.ammoInMag <= 0 && !w.reloading) tryReload();
  } else if (wantFire && canAct && !swinging) {
    if (w.def.fireMode === "auto") {
      if (w.canFire()) fireOnce();
    } else if (w.def.fireMode === "burst") {
      if (game.fireEdgeTrigger && w.burstLeft <= 0 && w.canFire()) w.burstLeft = w.def.burst || 2;
    } else if (game.fireEdgeTrigger && w.canFire()) {
      fireOnce();
    } else if (game.fireEdgeTrigger && w.reloading && w.def.shellReload && w.interruptReload()) {
      // BO2 pump shotgun: fire stops the shell-by-shell reload, and the
      // shot goes off as soon as the gun is back up.
      w.fireQueued = true;
    }
  }
  if (w.fireQueued && !w.reloading) {
    w.fireQueued = false;
    if (wantFire && canAct && !swinging && w.canFire()) fireOnce();
  }

  // A burst finishes on its own cadence even if the trigger is released.
  if (w.burstLeft > 0 && canAct && w.canFire()) {
    fireOnce();
    w.burstLeft--;
  }
}

/* Green Candles charge shot. Press starts a charge (the candle brightens,
   a hum climbs, a ring fills round the crosshair); release fires. Let go
   inside `minHold` and it's a tap: a quick 1-cell bolt. Past that, the
   bolt scales with the charge up to a full 3-cell shot at `time`, capped
   by what's left in the tank. Holding a full charge keeps it, with a
   shake. Sprinting or reloading drops it without firing. */
function updateCandleCharge(w, dt, held) {
  const c = w.def.charge;
  // Its own press edge (not the 16 ms fireEdgeTrigger): a slow frame must
  // never swallow the press that starts a charge.
  const pressed = held && !w.triggerHeld;
  w.triggerHeld = held;
  if (w.charging) {
    if (w.reloading || game.move.sprinting || !held) {
      const release = !held && !w.reloading && !game.move.sprinting;
      const level = w.chargeT < c.minHold ? 0 : w.chargeLevel;
      endCandleCharge(w);
      if (release) fireOnce(chargedShotDef(w.def, level));
      return;
    }
    w.chargeT += dt;
    game.audio.candleCharge(w.chargeLevel, w.chargeT >= c.time);
    return;
  }
  if (!pressed) return;
  if (w.canFire()) {
    w.charging = true;
    w.chargeT = 0;
    game.inspectT = 0;
  } else if (w.ammoInMag <= 0 && !w.reloading) {
    tryReload();
  }
}

export function endCandleCharge(w) {
  w.cancelCharge();
  game.audio.candleCharge(-1);
  game.els.charge.hidden = true;
}

/* What used to run at load in game.js: called from game.js where this code was. */
export function initPlayerUpdate() {
  window.addEventListener("mousedown", (e) => {
    if (game.emote && (e.button === 0 || e.button === 2)) game.stopEmote();
    if (e.button === 0) { game.fireEdgeTrigger = true; setTimeout(() => game.fireEdgeTrigger = false, 16); }
  });
  game.els.touchFire.addEventListener("touchstart", () => { game.fireEdgeTrigger = true; setTimeout(() => game.fireEdgeTrigger = false, 16); });
}
