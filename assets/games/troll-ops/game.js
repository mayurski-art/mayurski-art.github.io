// Troll Forces — main game module.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

import { WeaponState, WEAPON_DEFS, chargedShotDef } from "./weapons.js?v=p5bm-wst-hf1";
import { buildWeaponMesh, stripLights, preloadWeaponModels, setWeaponEnvMap, hasDetailedModel } from "./weapon-model.js?v=p5-em1-wst-hf1";
import { WeaponInspector } from "./inspector.js?v=hb1-nf-wst-ig1-sb2";
import { CharacterInspector } from "./char-inspector.js?v=hb4-wst-soc1-sb2";
import { Loadout } from "./loadout.js?v=p5tc-nf-k9-wst-ig1-tl1-bs1-tl2-sb1-rp1-dj1-cr1-db1-sb2";
import { StreakPicker } from "./streak-picker.js?v=umb1-wst-sb2";
import { StreakState, STREAK_DEFS, SCORE, streaksAllowed, streakIconSvg, streakBadgeSvg, streakShortName, PACKAGE_STREAK_POOL } from "./scorestreaks.js?v=umb1-wst-sb2";
import { K9Pack, K9, resolveK9 } from "./k9-unit.js?v=k9c-bs1-sb2";
import {
  CarePackage, MarkerCanister, HunterDrone, HelicopterGunship, ReconPlane, AirstrikeRun, BlastFx,
  VtolWarship, WARSHIP_GUNS, VsatSatellite,
  PKG_CRUSH_RADIUS,
  DRONE_DAMAGE, DRONE_SPLASH_RADIUS, DRONE_SPEED,
  AIRSTRIKE_DELAY, AIRSTRIKE_RADIUS, AIRSTRIKE_DAMAGE, AIRSTRIKE_BOMBS,
  HELI_FIRE_RANGE, HELI_DAMAGE,
} from "./streak-entities.js?v=vsat2-hk1";
import { KillstreakUi } from "./killstreak-ui.js?v=to-medals3";
import { medalSvg } from "./medals.js?v=to-medals3";
import { StrikeTablet, STRIKE_TARGETS } from "./streak-tablet.js?v=wu1";
import { KillCam } from "./killcam.js?v=to-fx3-kc2";
import { Achievements } from "./achievements.js?v=umb1-wst-sb2";
import { addXp, syncXp, xpForRun, xpForMatch, XP, XP_SCALE, prestigeUnlocked, getLevel, getPrestige, isOwner } from "./progression.js?v=p5-wst-sb2";
import { playerIconSvg } from "./rank-icons.js?v=rk1";
import { recordMatch } from "./record.js?v=rec1";
import { getMyCard, withClan } from "./calling-cards.js?v=p5-wst-sb2";
import { openProfileCard } from "./profile-card.js?v=pc1-wst-sb2";
import { buildMap, disposeMap, MAPS, MAP_IDS } from "./maps.js?v=p5tc-k9-em1-wst-tl1-bs1-tl2-sb1-rp1-dj1-cr1-db1-sb2";
import { createMapPreloader } from "./map-preload.js?v=mp4";
import { createMapLoadScreen, mapShotAttrs } from "./map-load-screen.js?v=ml3-wst-tl1-ng1";
import { Net, makeRoomCode, MAX_PLAYERS, MAX_PLAYERS_ROYALE, isSyntheticId } from "./net.js?v=umb3-rm1-ld2-em1-sb1-cb1-rp1-p22-bh1";
import { MatchChat, safeUid } from "./chat.js?v=to-social1";
import { RemotePlayers, TEAMS, STANCE_LOWER, ROLL_TIME, rollRig, poseDrop, DROP_BUS, DROP_FALL, DROP_GLIDE, setFunnyDeaths, setSeatLookup } from "./remote-players.js?v=umb3g-pc1-nf-em1-mi2-wst-ig1-bs1-sb1-cb2-rp1-hf1-sb2";
import { ROLES, roleCode, DOCTOR, poseSeated, posePianoArms, PianoVoice, TUNES } from "./rp-roles.js?v=rp1";
import { buildHumanoid, poseHumanoid, poseDeath, DEATH_TIME, poseThrowArm, THROW_TIME, gaitPhaseRate, mountHeldWeapon, aimRig, flinchRigFrom, DANCES, ParryState, parryWeights, PARRY_ZONES } from "./character.js?v=to-hb4-em1-fc1-wst-soc1-ww1";
import { EmoteWheel, EMOTES } from "./emote-wheel.js?v=hb4-em1-wst-soc1";
import {
  buildDrink, placeDrinkInHand, poseDrinkArm, mountDrink, drinkCode, drinkMax, tipsyFx, TIPSY,
  BEER_SIPS, GRAB_TIME, FILL_TIME, FILL_TIME_BARTENDER, POUR_TIME, SIP_TIME, APRON_TIME,
  OFFER_SECONDS, REACH, BARTENDER_LEAVE_SECONDS,
} from "./saloon-bar.js?v=sb1";
import { TownNpcs } from "./town-npcs.js?v=tn4";
import { poseEmoteCode, emoteCode, emoteSeconds, FP_HAND_POSES, hideFpEmoteProps, fpEmoteRodTip } from "./emotes.js?v=hb4-em1-wst-soc1-ng1";
import { buildWatch, wristOf } from "./wristwear.js?v=ww1";
import { MatchIntro } from "./match-intro.js?v=mi5-wst";
import {
  MODES, MODE_IDS, weaponForMode, playerWon, matchWinner, matchWinnerOnTimeout,
  Hill, Bomb, pickBombSites, pickHillPoints, splitSpawnSides, PLANT_TIME, DEFUSE_TIME, INFECTION,
} from "./modes.js?v=umb1-rn-wst-tl1-bs1-soc1-t69-u69";
import { BotManager } from "./bots.js?v=cg5-em1-wst-bs1-p22-bs2-sb2";
import { resolveWeapon, defaultLoadoutFor } from "./attachments.js?v=cg1-wst-sb2";
import { GameAudio } from "./audio.js?v=zr4-hf1";
import { MapAmbience } from "./ambience.js?v=amb1-wst-tl1";
import { insidePolygon } from "./edge.js";
import { ROYALE, RoyaleZone, ZoneVisual, LootField, lootSpots, seededRng, hashSeed, gunDisplayName, ITEM_NAMES } from "./royale.js?v=p5-wst-bs1-sb2";
import { GameMusic, EQ_BANDS, EQ_RANGE } from "./music.js?v=to-gs1";
import { DjLulz } from "./dj-lulz.js?v=dj1";
import { stage, rise, damp, smoothstep } from "./anim-curves.js";
import { AnimDebugLab } from "./anim-debug.js";
import { buildStreakDevice, buildMarkerDevice, drawTabletScreen } from "./streak-device.js?v=to-df1";
import { buildHumanHand, placeHand, poseHumanHand, handWrist, handMaterials, inkOutline, HAND_POSES, HAND_GRIPS } from "./hand-model.js?v=to-grip2";
import { FlowField } from "./nav.js?v=ti1-bs1";
import { ZombieDirector, goreStandIns } from "./zombies.js?v=zr4c-sb2";
import { ImpactShader, makeMuzzleFlashMaterial } from "./shaders.js";
import { ImpactFx } from "./impact-fx.js?v=zr4";
import { LightPool } from "./light-pool.js";
import { loadModel } from "./battlefield-props.js";
import { kickCurve } from "./attachments.js?v=cg1-wst-sb2";
import { WaveSpawner } from "./enemies.js?v=hb4-wst-soc1-sb2";
import { BulletSystem, segmentBlocked, raycastWorld } from "./ballistics.js?v=cg1-wst-hf1";
import { MovementController, STANCE, groundHeightAt } from "./movement.js?v=umb2-sb2";
import { applyHeroBody, syncHeroBody, setHeroEnvMap, preloadHeroBodies } from "./hero-bodies.js?v=umb3g-nf-wst-ig1-soc1";
import { HeroKit, HEROES, HERO_IDS, FootprintTrail, randomHero, botStats, savedHero, saveHero } from "./heroes.js?v=umb2";
import { MeleeState, MELEE_DEFS, buildMeleeMesh, GrenadeSystem, blastDamage, THROWABLE_DEFS, GRENADE_GRAVITY, SABER_BLOCK, SABER_PARRY, chainsawRevAt } from "./gear.js?v=to-hb1kb3-bk1-wst-ig1";
import { poseKnuckles } from "./brass-knuckles.js?v=bk1-wst";
import { setSaberEnvMap, preloadTrollsaber, SaberTrail } from "./trollsaber.js?v=ts4-ig1";
import { createAkimboView, AKIMBO_INSPECT_TIME } from "./akimbo-view.js?v=ak1-wst";
import { createKeyboardRepair, KB_SHIELD, KB_GLANCE } from "./keyboard-repair.js?v=kr15";
import { RangeSet } from "./range.js";
import { PickupSystem, SwapHold } from "./pickups.js?v=sw1-wst-sb2";
import { HudLayout } from "./hud-layout.js?v=hl3";
import { initCloudSave } from "./cloud-save.js?v=cs1";
import { ControllerLayout, padEmotePressed } from "./controller-layout.js?v=cl7";
import { CosmeticsPanel, cleanFaceKey, loadCosmetics } from "./cosmetics.js?v=hb4-fc1-wst-soc1-ww1";
import { Dragonfire, DF_DAMAGE, DF_RANGE, DF_SPREAD, DF_HP } from "./dragonfire.js?v=df3-sb2";
import { SamTurret, SAM_RANGE, SAM_LOCK, SAM_SALVO_GAP, SAM_RELOAD } from "./sam-turret.js?v=sam1";
import { DROP, RoyaleDrop, Flight, buildParaglider } from "./royale-drop.js?v=rp3-wst-bs1-sb2";
import { preloadHalloweenMelee, setHalloweenEnvMap } from "./melee-models.js?v=hw2";
import {
  HellfireFx, updateSoulBlazerView, soulBlazerShot, soulBlazerKick, soulBlazerIgnite, soulBlazerMouth,
  soulBlazerInspect, soulBlazerReloadPose, SB_INSPECT_CUES,
} from "./soul-blazer.js?v=sb1";
import { AIM_ASSIST_MOUSE_PULL, AIM_ASSIST_MOUSE_SLOWDOWN, MOUSE_ACTIVE_MS, aimAssistPoints, applyAimAssist, findAimAssistTarget } from "./input/aim-assist.js?v=in1";
import { game, linkGame } from "./core/state.js?v=st1";
import { PAD_SENS_MULT, PAD_SENS_NAMES, padLookTurn, pollGamepad, pollGamepadMenu, radialStick } from "./input/gamepad.js?v=in1";
import { setTouchAds, touchState, initTouch } from "./input/touch.js?v=in1";
import { ROLL_SPEED, ROYALE_BUS_GONE, _dropTarget, applyRoyaleCatchUp, cancelRoyaleAct, cycleSpectate, drawRoyaleMinimap, hideSpectateHud, inSkyLobby, onRoyaleLoot, ordinal, placeBotsInLobby, placeDropCamera, placeSpectateCamera, royale, royaleAliveList, royaleBotDamage, royaleBotObjective, royaleBotSight, royaleBotVsBot, royaleDropCode, royaleDropView, royaleNoise, royaleOnDeath, royalePickupGun, royaleRollK, royaleRolling, royaleSpectating, royaleWants, setupRoyale, stageFrozen, startRoyaleAct, startRoyaleBus, teardownRoyale, updateDropPlayer, updateRoyale, updateRoyaleGear, updateRoyaleRoll, updateSkyLobby, initRoyale } from "./modes/royale.js?v=md1";
import { clearDamageNumbers, clearHitDirs, damageNumbers, flashHit, flinchPeer, hitDirs, jokeVerb, noteHitDirection, pushKillfeed, showHitmarker, showWaveBanner, spawnComicWord, spawnDamageNumber, updateDamageNumbers, updateHitDirs, updateStreakHud } from "./core/hud.js?v=cr1";
import { buildMinimapBase, drawMinimap, mapToMinimap, minimapCanvas, setBombSiteMarkers, setHillMarker, initMinimap } from "./core/minimap.js?v=cr1";
import { achievements, blastFx, callReadyStreak, callStreak, callStreakSlot, cancelMark, clearStreakEntities, clearStreakLocks, confirmMark, cycleSelectedStreak, endActiveStreak, enemiesRevealed, flyovers, groundAimPoint, killstreakUi, lockStreak, minimapJammed, pendingStrikes, readyStreaksOrdered, spawnVsatSat, startVsat, streakBlast, streakBusy, streakControlActive, streakEnd, streakEntities, streakKeyLabel, streakLockLeft, streakLockUntil, streakLockWhy, streakPicker, streakSlotIds, streaks, uavActiveFor, uavBucket, uavUntil, updateMarking, updateStreakControl, useSelectedStreak, vsatActiveFor, vsatUntil, vsatUp, initStreakCalling } from "./streaks/calling.js?v=sk1";
import { AIR_HP, DF_BLOCK_TEXT, DRONE_AIR_REACH, DRONE_AIR_SPEED, attachAirHitbox, dragonfireBlocked, dragonfireSkyCheck, droneAirTarget, droneFields, droneLeadPoint, droneTargetPos, droneWorld, ensureStrikeTablet, fireStreak, launchPendingDrone, openStrikeTablet, packageCaptureTime, pickDroneTarget, rollPackageReward, round2, spawnAirstrike, spawnCarePackage, spawnDrone, spawnHelicopter, spawnK9, streakBounds, strikeDelay, strikeTablet, throwMarker } from "./streaks/fire.js?v=sk1";
import { HUNTER_DOG_BITE, HUNTER_PIN, applyHeroFx, applyHeroLoadout, assignBotHeroes, footprints, hero, heroActive, heroFx, heroHostiles, heroKit, heroMeleeDef, updateHero, useHeroAbility } from "./modes/umb-heroes.js?v=sk1";
import { damageDog, dogKilledBy, k9Hostile, k9Stairs, updateK9 } from "./streaks/k9.js?v=sk1";
import { DF_ASSIST_CONE_DEG, DF_ASSIST_PULL, DF_BOARD_AT, airTargetPos, damageStreakEntity, dragonfireView, enemyAirFor, fireDragonfire, samDeployPoint, samHitCount, samMissileHit, samTargets, shootDownAir, spawnDragonfire, spawnSam, streakHostileToMe, syncDragonfireView, updateSamAi } from "./streaks/dragonfire.js?v=sk1";
import { WARSHIP_BOARD_AT, fireWarship, lookSensScale, placeWarshipCamera, spawnWarship, syncWarshipView, toggleWarshipGun, updateWarshipHud, warshipFov, warshipImpact, warshipView } from "./streaks/warship.js?v=sk1";
import { applyCounterUav, claimPackage, lockEl, nearestHostileTo, spawnRecon, startUav, streakDamage, streakOwnerHates, strikeImpact, swarmRuns, updateStreakEntities, updateUavState } from "./streaks/air.js?v=sk1";
import { BOT_STREAK_KEY, BOT_STREAK_POOL, applyRemoteStreak, botEarn, botFireStreak, botStreakLog, botStreakMult, botStreakState, botWarshipGunner, flyBotDragonfire, updateBotStreaks, initBotStreaks } from "./streaks/bot-streaks.js?v=sk1";
import { SETTINGS_KEY, applySettings, saveSettings, settings } from "./menu/settings.js?v=ms1";
import { initRadioWidget } from "./menu/radio.js?v=mr1";
import { initEscapeMenu, renderMenuRoster, initMenuRoster } from "./menu/escape-menu.js?v=em1";
import { buildModeButtons, renderModes, initModePicker } from "./menu/mode-picker.js?v=mp1";
import { activeLobbyPanel, charInspector, charInspectorLive, cosmetics, inspector, inspectorLive, menuEmoteWheel, noBotsRoom, playerName, pollMenuEmotePad, renderCallsign, renderLobbyRoster, setNetStatus, showLobbyPanel, showSumGun, sumInspector, initLobby } from "./menu/lobby.js?v=lb1";
import { endKillcamPresentation, killcamFov, killcamSelfId, killcamWeaponFov, skipKillcam, startKillcamPresentation, updateKillcam } from "./combat/killcam-present.js?v=kp2";
import { ASSIST_MEMORY, ASSIST_MIN_DAMAGE, assistersFor, breakSpawnGuard, clearDeathVisuals, damageLog, damagePlayer, killcamBaseRespawn, killerPosFor, nameFor, noteDamage, onGruntAttack, respawnPlayer, showDeathCard, updateSpawnGuardHud, weaponNameFor, yawTowardCentre } from "./combat/damage.js?v=dm1-kc2";
import { MELEE_DRAW_TIME, MELEE_EQUIP_TIME, POWER_EQUIP_TIME, POWER_HOLSTER_TIME, POWER_IGNITE, POWER_IGNITE_DELAY, POWER_RETRACT, SLOW_IGNITE, _bladeG, _bladeP, _flickQ, _kbFarGrip, _parryPos, _parryQ, _parryW, _viewX, _viewZ, kbRepair, kbShield, meleeConnect, onRemoteDeflect, saberBlock, saberParry, saberTrail, swingMelee, tryDeflect, updateKbShield, updateRemoteSabers, updateSaberBlock, updateSaberFx, initMelee } from "./combat/melee.js?v=ml1-kc2";
import { applyEmpState, applyRemoteNade, areaDamage, blastCandidates, botNadesThrown, botThrow, cancelCook, carriedThrowSlot, empPlayer, explosionFx, flashPlayer, grenadeCtx, grenades, nextNadeId, publishBoom, refillGear, releaseCook, startCook, stunActor, updateBlastLights, initThrowables } from "./combat/throwables.js?v=th1-kc2";
import { currentWeapon, cycleWeapon, fireOnce, frozenPlayer, nearbyPackage, onBulletActorHit, resolveBulletTarget, setHolding, setTouchContext, switchWeapon, tryReload, updateGearHud, updatePickupPrompt } from "./combat/weapons.js?v=wp1-kc2";
import { addMatchXp, awardKillXp, awardScore, checkMatchEnd, creditAssistIfOwed, dealtLog, lastHitRange, noteDealt, recentTeamKillers, registerDeath, updateTeamHud } from "./combat/scoring.js?v=sc1-kc2";
/* What the split-out modules reach back into game.js for (see core/state.js).
   Functions go in as they are; everything else as a getter, so nothing is
   read before game.js declares it. game.js only ever gets smaller: an
   entry leaves this list when the thing it names moves out. */
linkGame({
  get _euler() { return _euler; },
  get _meleeViewE() { return _meleeViewE; },
  get _meleeViewQ() { return _meleeViewQ; },
  get _sbDir() { return _sbDir; },
  get _sbPos() { return _sbPos; },
  get activeDroneMesh() { return activeDroneMesh; },
  get activeLobbyPanel() { return activeLobbyPanel; },
  get activeMarkerMesh() { return activeMarkerMesh; },
  get activeMeleeMesh() { return activeMeleeMesh; },
  get activeStreakMesh() { return activeStreakMesh; },
  get activeWeaponMesh() { return activeWeaponMesh; },
  addMatchXp,
  get adsHeld() { return adsHeld; },
  get aimAssistSticky() { return aimAssistSticky; }, set aimAssistSticky(v) { aimAssistSticky = v; },
  get akimboView() { return akimboView; },
  get ambience() { return ambience; },
  applyGraphics,
  applyInfectionLoadout,
  areaDamage,
  get ARENA() { return ARENA; },
  get audio() { return audio; },
  awardScore,
  get baseFov() { return baseFov; }, set baseFov(v) { baseFov = v; },
  beginStreakHold,
  get blindT() { return blindT; }, set blindT(v) { blindT = v; },
  botBusy,
  botDealDamage,
  botEarn,
  get bots() { return bots; },
  botWarshipGunner,
  get builtMap() { return builtMap; },
  get bullets() { return bullets; },
  calibratePadRest,
  callReadyStreak,
  callStreakSlot,
  get camera() { return camera; },
  cancelCook,
  carriedThrowSlot,
  closePauseMenu,
  get colliders() { return colliders; },
  get controls() { return controls; },
  get cooking() { return cooking; },
  currentMode,
  currentWeapon,
  get currentWeaponSlot() { return currentWeaponSlot; }, set currentWeaponSlot(v) { currentWeaponSlot = v; },
  cycleSelectedStreak,
  cycleSpectate,
  cycleWeapon,
  damagePlayer,
  get dealtLog() { return dealtLog; },
  get DF_BLOCK_TEXT() { return DF_BLOCK_TEXT; },
  get DF_BOARD_AT() { return DF_BOARD_AT; },
  get dfHud() { return dfHud; }, set dfHud(v) { dfHud = v; },
  get dfIx() { return dfIx; },
  get dfIz() { return dfIz; },
  get dfSaved() { return dfSaved; }, set dfSaved(v) { dfSaved = v; },
  get dfSendT() { return dfSendT; }, set dfSendT(v) { dfSendT = v; },
  get dfViewOn() { return dfViewOn; }, set dfViewOn(v) { dfViewOn = v; },
  get dragonfire() { return dragonfire; }, set dragonfire(v) { dragonfire = v; },
  dragonfireBlocked,
  dragonfireView,
  get DRONE_TOSS_AT() { return DRONE_TOSS_AT; },
  get droneFields() { return droneFields; },
  dropCarriedWeapon,
  get duoXClaimed() { return duoXClaimed; },
  get els() { return els; },
  get emoteIsTp() { return emoteIsTp; },
  get emoteWheel() { return emoteWheel; },
  get empT() { return empT; }, set empT(v) { empT = v; },
  endCandleCharge,
  endGame,
  endMatch,
  endStaging,
  endStreakHold,
  enemiesRevealed,
  enemyAirFor,
  equipFromLoadout,
  explosionFx,
  get fireEdgeTrigger() { return fireEdgeTrigger; }, set fireEdgeTrigger(v) { fireEdgeTrigger = v; },
  fireStreak,
  flyBotDragonfire,
  get freshStreak() { return freshStreak; }, set freshStreak(v) { freshStreak = v; },
  get gamepadState() { return gamepadState; },
  get gameState() { return gameState; },
  get gpDebugEl() { return gpDebugEl; },
  get gpDebugForced() { return gpDebugForced; },
  get gpIndex() { return gpIndex; }, set gpIndex(v) { gpIndex = v; },
  get gpPrev() { return gpPrev; }, set gpPrev(v) { gpPrev = v; },
  get gunGameProgress() { return gunGameProgress; }, set gunGameProgress(v) { gunGameProgress = v; },
  get hellfire() { return hellfire; },
  get hellfireView() { return hellfireView; },
  heroActive,
  get hill() { return hill; },
  get hitboxLab() { return hitboxLab; },
  get hitFlashT() { return hitFlashT; }, set hitFlashT(v) { hitFlashT = v; },
  holsterMeleeFor,
  holsterMeleeThen,
  get hudLayout() { return hudLayout; },
  get impactFx() { return impactFx; },
  get infectionStarted() { return infectionStarted; },
  get inspector() { return inspector; },
  get inspectT() { return inspectT; }, set inspectT(v) { inspectT = v; },
  invincibleOn,
  isBotPeer,
  isInfected,
  isInfection,
  isPvp,
  isRange,
  isRoyale,
  isSnd,
  isSocial,
  isStaging,
  get isTouch() { return isTouch; },
  get jammedUntil() { return jammedUntil; }, set jammedUntil(v) { jammedUntil = v; },
  k9Stairs,
  get kcClock() { return kcClock; }, set kcClock(v) { kcClock = v; },
  get keys() { return keys; },
  kickFireShake,
  get killcam() { return killcam; },
  get killcamBaseRespawn() { return killcamBaseRespawn; },
  get killcamWasActive() { return killcamWasActive; }, set killcamWasActive(v) { killcamWasActive = v; },
  get lastHitRange() { return lastHitRange; },
  learnPadRest,
  get lightPool() { return lightPool; },
  get loadout() { return loadout; },
  get lobbyReady() { return lobbyReady; },
  get localBlockT() { return localBlockT; },
  get localHeld() { return localHeld; },
  get localLower() { return localLower; },
  get localPauseOnly() { return localPauseOnly; },
  get localRig() { return localRig; },
  get localShotAt() { return localShotAt; }, set localShotAt(v) { localShotAt = v; },
  get localThrowT() { return localThrowT; }, set localThrowT(v) { localThrowT = v; },
  get lockEl() { return lockEl; },
  get look() { return look; },
  mapToMinimap,
  get MARKER_THROW_TIME() { return MARKER_THROW_TIME; },
  get markerThrowT() { return markerThrowT; }, set markerThrowT(v) { markerThrowT = v; },
  get markingStreak() { return markingStreak; }, set markingStreak(v) { markingStreak = v; },
  get matchClockT() { return matchClockT; },
  get matchesPlayed() { return matchesPlayed; },
  get matchIntro() { return matchIntro; },
  get meleeDrawT() { return meleeDrawT; }, set meleeDrawT(v) { meleeDrawT = v; },
  get meleeHolster() { return meleeHolster; },
  get meleeImpactT() { return meleeImpactT; }, set meleeImpactT(v) { meleeImpactT = v; },
  get meleePutAway() { return meleePutAway; },
  get meleeWhiffT() { return meleeWhiffT; }, set meleeWhiffT(v) { meleeWhiffT = v; },
  minimapJammed,
  get modeId() { return modeId; }, set modeId(v) { modeId = v; },
  get modePicked() { return modePicked; }, set modePicked(v) { modePicked = v; },
  get move() { return move; },
  get music() { return music; },
  get muzzleFlash() { return muzzleFlash; },
  get muzzleFlashT() { return muzzleFlashT; }, set muzzleFlashT(v) { muzzleFlashT = v; },
  get muzzleLight() { return muzzleLight; },
  get muzzleMat() { return muzzleMat; },
  get myUavUntil() { return myUavUntil; }, set myUavUntil(v) { myUavUntil = v; },
  nameFor,
  nearbyPackage,
  get net() { return net; },
  noteDealt,
  noteLocalDeath,
  notePointDeath,
  occupants,
  onBulletActorHit,
  openPauseMenu,
  openPlayerProfile,
  openStrikeTablet,
  get padRest() { return padRest; },
  get pendingDroneLaunch() { return pendingDroneLaunch; }, set pendingDroneLaunch(v) { pendingDroneLaunch = v; },
  pickPad,
  get pickups() { return pickups; },
  get PITCH_LIMIT() { return PITCH_LIMIT; },
  get player() { return player; },
  playerUid,
  powerHeld,
  putDownDrink,
  get rangeSet() { return rangeSet; },
  readyStreaksOrdered,
  refreshLobbyMap,
  registerDeath,
  releaseCook,
  get remotes() { return remotes; },
  remoteShotFx,
  renderBotSkillNote,
  get renderer() { return renderer; },
  renderGpDebug,
  renderLobbyRoster,
  renderScoreboard,
  renderViewModeRow,
  reportRangeShot,
  resolveBulletTarget,
  get respawnT() { return respawnT; }, set respawnT(v) { respawnT = v; },
  get roomIsCustom() { return roomIsCustom; }, set roomIsCustom(v) { roomIsCustom = v; },
  get royaleCatchUp() { return royaleCatchUp; }, set royaleCatchUp(v) { royaleCatchUp = v; },
  royaleSpectating,
  get saberDeflectT() { return saberDeflectT; }, set saberDeflectT(v) { saberDeflectT = v; },
  get saberFlick() { return saberFlick; },
  get saberHavePrevTip() { return saberHavePrevTip; }, set saberHavePrevTip(v) { saberHavePrevTip = v; },
  samDeployPoint,
  get samHitCount() { return samHitCount; },
  scavengeAllowed,
  get scene() { return scene; },
  get selectedStreak() { return selectedStreak; }, set selectedStreak(v) { selectedStreak = v; },
  setActiveMeleeMesh,
  setActiveWeaponMesh,
  setHolding,
  get settings() { return settings; },
  setTouchContext,
  get shakeMag() { return shakeMag; }, set shakeMag(v) { shakeMag = v; },
  get shakeT() { return shakeT; }, set shakeT(v) { shakeT = v; },
  showWaveBanner,
  skipKillcam,
  get sndCanInteract() { return sndCanInteract; },
  socialUnarmed,
  get SPAWN_GUARD() { return SPAWN_GUARD; },
  spawnDragonfire,
  get spawner() { return spawner; },
  spawnImpactBurst,
  spawnRecon,
  spawnSam,
  spawnWarship,
  get stageT() { return stageT; },
  startCook,
  startInspect,
  startTabletDive,
  startUav,
  get streakCallGuardUntil() { return streakCallGuardUntil; }, set streakCallGuardUntil(v) { streakCallGuardUntil = v; },
  streakControlActive,
  streakDamage,
  get streakDeviceKind() { return streakDeviceKind; },
  get streakEnd() { return streakEnd; },
  get streakEntities() { return streakEntities; },
  streakHoldActive,
  streakKeyLabel,
  streakLockLeft,
  get streakLockWhy() { return streakLockWhy; },
  streakOwnerHates,
  get streaks() { return streaks; },
  streakSlotIds,
  get strikeTablet() { return strikeTablet; },
  get sumGunKey() { return sumGunKey; }, set sumGunKey(v) { sumGunKey = v; },
  get swapHold() { return swapHold; },
  get swarmRuns() { return swarmRuns; },
  swingMelee,
  syncLocalRigHeld,
  syncWarshipView,
  get tabletDive() { return tabletDive; }, set tabletDive(v) { tabletDive = v; },
  get targetMeshes() { return targetMeshes; },
  get teamScores() { return teamScores; },
  teamSpawn,
  throwMarker,
  toggleThirdPerson,
  toggleWarshipGun,
  get touchState() { return touchState; },
  tryDeflect,
  tryReload,
  trySwivel,
  updateGearHud,
  updatePickupPrompt,
  updateSpawnGuardHud,
  useHeroAbility,
  useSelectedStreak,
  vsatUp,
  warmNewGuns,
  get warship() { return warship; }, set warship(v) { warship = v; },
  get WARSHIP_BOARD_AT() { return WARSHIP_BOARD_AT; },
  get warshipGun() { return warshipGun; }, set warshipGun(v) { warshipGun = v; },
  warshipView,
  get weaponCamera() { return weaponCamera; },
  weaponNameFor,
  get weaponRig() { return weaponRig; },
  get weaponScene() { return weaponScene; },
  get WHISTLE_BLOW_AT() { return WHISTLE_BLOW_AT; },
  get WHISTLE_HOLD() { return WHISTLE_HOLD; },
  get zdir() { return zdir; },
});

/* Maps download once (user, 2026-10-04): /sw.js keeps the game's models,
   textures and three.js in the browser so a map isn't fetched again every
   day. Not on localhost unless ?sw=1 (a dev edit would come back stale);
   ?sw=0 takes it off this browser. */
(function registerAssetCache() {
  const sw = navigator.serviceWorker;
  if (!sw) return;
  const q = new URLSearchParams(location.search).get("sw");
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if (q === "0" || (local && q !== "1")) {
    sw.getRegistrations().then((rs) => rs.forEach((r) => { if (r.active?.scriptURL.endsWith("/sw.js")) r.unregister(); })).catch(() => {});
    return;
  }
  sw.register("/sw.js", { scope: "/" }).catch((e) => console.warn("[troll forces] asset cache off:", e?.message || e));
  // The first visit loads most of the game before the worker is up: hand it
  // what this page already fetched, now and once the map is in, so the next
  // visit doesn't download it again.
  const handOver = () => sw.ready.then((r) => r.active?.postMessage({
    type: "cache-urls", urls: performance.getEntriesByType("resource").map((e) => e.name),
  })).catch(() => {});
  if (document.readyState === "complete") handOver(); else addEventListener("load", handOver, { once: true });
  setTimeout(handOver, 60000);
  addEventListener("pagehide", handOver);
})();

const els = {
  cabinet: document.getElementById("to-cabinet"),
  loading: document.getElementById("to-loading"),
  title: document.getElementById("to-title"),
  startBtn: document.getElementById("to-start-btn"),
  loMode: document.getElementById("to-lo-mode"),
  loModeBlurb: document.getElementById("to-lo-modeblurb"),
  goL1: document.getElementById("to-go-l1"),
  goL2: document.getElementById("to-go-l2"),
  goL3: document.getElementById("to-go-l3"),
  loPvp: document.getElementById("to-lo-pvp"),
  room: document.getElementById("to-room"),
  newRoom: document.getElementById("to-newroom"),
  noBots: document.getElementById("to-nobots"),
  botStreaks: document.getElementById("to-botstreaks"),
  netStatus: document.getElementById("to-net-status"),
  hudTeams: document.getElementById("to-hud-teams"),
  hudMatchClock: document.getElementById("to-hud-matchclock"),
  scorePhantom: document.getElementById("hud-score-phantom"),
  namePhantom: document.getElementById("hud-name-phantom"),
  nameGhost: document.getElementById("hud-name-ghost"),
  scoreGhost: document.getElementById("hud-score-ghost"),
  scoreboard: document.getElementById("to-scoreboard"),
  respawn: document.getElementById("to-respawn"),
  respawnText: document.getElementById("to-respawn-text"),
  spawnGuard: document.getElementById("to-spawnguard"),
  staging: document.getElementById("to-staging"),
  stagingMode: document.getElementById("to-staging-mode"),
  stagingClock: document.getElementById("to-staging-clock"),
  stagingSub: document.getElementById("to-staging-sub"),
  stagingRoster: document.getElementById("to-staging-roster"),
  bombStatus: document.getElementById("to-bomb-status"),
  royale: document.getElementById("to-royale"),
  royalePhase: document.getElementById("to-royale-phase"),
  royaleTimer: document.getElementById("to-royale-timer"),
  royaleAlive: document.getElementById("to-royale-alive"),
  royaleAct: document.getElementById("to-royale-act"),
  royaleActText: document.getElementById("to-royale-act-text"),
  royaleActFill: document.getElementById("to-royale-act-fill"),
  cringe: document.getElementById("to-cringe"),
  armor: document.getElementById("to-armor"),
  gearPlates: document.getElementById("to-gear-plates"),
  gearPlatesN: document.getElementById("to-gear-plates-n"),
  gearHeals: document.getElementById("to-gear-heals"),
  gearHealsN: document.getElementById("to-gear-heals-n"),
  bombSide: document.getElementById("to-bomb-side"),
  bombTimer: document.getElementById("to-bomb-timer"),
  bombPrompt: document.getElementById("to-bomb-prompt"),
  bombPromptText: document.getElementById("to-bomb-prompt-text"),
  bombBarFill: document.getElementById("to-bomb-bar-fill"),
  pickupPrompt: document.getElementById("to-pickup-prompt"),
  pickupPromptText: document.getElementById("to-pickup-prompt-text"),
  pickupBarFill: document.getElementById("to-pickup-bar-fill"),
  pickupKey: document.getElementById("to-pickup-key"),
  pickupKeyCap: document.getElementById("to-pickup-key-cap"),
  spectate: document.getElementById("to-spectate"),
  spectateOut: document.getElementById("to-spectate-out"),
  spectateName: document.getElementById("to-spectate-name"),
  spectateN: document.getElementById("to-spectate-n"),
  spectatePrev: document.getElementById("to-spectate-prev"),
  spectateNext: document.getElementById("to-spectate-next"),
  deathBy: document.getElementById("to-deathby"),
  deathByName: document.getElementById("to-deathby-name"),
  deathByMeta: document.getElementById("to-deathby-meta"),
  xpPopups: document.getElementById("to-xp-pops"),
  damageNumbers: document.getElementById("to-dmg-nums"),
  ksBadges: document.getElementById("to-ks-badges"),
  ksBanner: document.getElementById("to-ks-banner"),
  screenPulse: document.getElementById("to-screen-pulse"),
  ssHud: document.getElementById("to-ss-hud"),
  ssMeterFill: document.getElementById("to-ss-meter-fill"),
  ssSlots: document.getElementById("to-ss-slots"),
  ssPicker: document.getElementById("to-ss-picker"),
  ssCount: document.getElementById("to-ss-count"),
  streakMark: document.getElementById("to-streak-mark"),
  hudWaveBox: document.querySelector(".to-hud-wave"),
  hudHostilesBox: document.querySelector(".to-hud-hostiles"),
  loMaps: document.getElementById("to-lo-maps"),
  loClasses: document.getElementById("to-lo-classes"),
  loList: document.getElementById("to-lo-list"),
  loName: document.getElementById("to-lo-name"),
  loBlurb: document.getElementById("to-lo-blurb"),
  loStats: document.getElementById("to-lo-stats"),
  loAtts: document.getElementById("to-lo-atts"),
  loRank: document.getElementById("to-lo-rank-label"),
  loRankFill: document.getElementById("to-lo-rank-fill"),
  pause: document.getElementById("to-pause"),
  resumeBtn: document.getElementById("to-resume-btn"),
  quitBtn: document.getElementById("to-quit-btn"),
  gameover: document.getElementById("to-gameover"),
  goTitle: document.getElementById("to-go-title"),
  goWave: document.getElementById("to-go-wave"),
  goKills: document.getElementById("to-go-kills"),
  goTime: document.getElementById("to-go-time"),
  goXp: document.getElementById("to-go-xp"),
  goRank: document.getElementById("to-go-rank"),
  goMedals: document.getElementById("to-go-medals"),
  retryBtn: document.getElementById("to-retry-btn"),
  intermission: document.getElementById("to-intermission"),
  voteList: document.getElementById("to-vote-list"),
  voteClock: document.getElementById("to-vote-clock"),
  hud: document.getElementById("to-hud"),
  hudWave: document.getElementById("hud-wave"),
  hudHostiles: document.getElementById("hud-hostiles"),
  hudKills: document.getElementById("hud-kills"),
  waveBanner: document.getElementById("hud-wave-banner"),
  crosshair: document.getElementById("to-crosshair"),
  charge: document.getElementById("to-charge"),
  saberMeter: document.getElementById("to-saber-meter"),
  chargeCells: document.getElementById("to-charge-cells"),
  killcamBars: document.getElementById("to-killcam-bars"),
  hitmarker: document.getElementById("to-hitmarker"),
  hitflash: document.getElementById("to-hitflash"),
  hitdir: document.getElementById("to-hitdir"),
  lowhp: document.getElementById("to-lowhp"),
  deathfade: document.getElementById("to-deathfade"),
  hpFill: document.getElementById("hud-hp-fill"),
  hpText: document.getElementById("hud-hp-text"),
  ammoCur: document.getElementById("hud-ammo-cur"),
  ammoRes: document.getElementById("hud-ammo-res"),
  reloadTag: document.getElementById("hud-reload-tag"),
  killfeed: document.getElementById("to-killfeed"),
  touch: document.getElementById("to-touch"),
  touchMove: document.getElementById("to-touch-move"),
  touchMoveNub: document.querySelector(".to-touch-stick-nub"),
  touchLook: document.getElementById("to-touch-look"),
  touchFire: document.getElementById("to-touch-fire"),
  touchFireL: document.getElementById("to-touch-fire-l"),
  touchTac: document.getElementById("to-touch-tac"),
  touchMoveZone: document.getElementById("to-touch-movezone"),
  touchAds: document.getElementById("to-touch-ads"),
  touchJump: document.getElementById("to-touch-jump"),
  touchReload: document.getElementById("to-touch-reload"),
  touchSlide: document.getElementById("to-touch-slide"),
  touchMelee: document.getElementById("to-touch-melee"),
  touchNade: document.getElementById("to-touch-nade"),
  touchInteract: document.getElementById("to-touch-interact"),
  touchSwap: document.getElementById("to-touch-swap"),
  touchAdmire: document.getElementById("to-touch-admire"),
  touchEmote: document.getElementById("to-touch-emote"),
  touchStreak: document.getElementById("to-touch-streak"),
  touchEndStreak: document.getElementById("to-touch-endstreak"),
  gearMelee: document.getElementById("to-gear-melee"),
  gearMeleeName: document.getElementById("to-gear-melee-name"),
  gearLethal: document.getElementById("to-gear-lethal"),
  gearLethalName: document.getElementById("to-gear-lethal-name"),
  gearLethalN: document.getElementById("to-gear-lethal-n"),
  gearTactical: document.getElementById("to-gear-tactical"),
  gearTacticalName: document.getElementById("to-gear-tactical-name"),
  gearTacticalN: document.getElementById("to-gear-tactical-n"),
  cook: document.getElementById("to-cook"),
  cookFill: document.getElementById("to-cook-fill"),
  blind: document.getElementById("to-blind"),
  smoke: document.getElementById("to-smoke"),
  emp: document.getElementById("to-emp"),
  rangeHud: document.getElementById("to-range"),
  rangeShot: document.getElementById("to-range-shot"),
  rangeSens: document.getElementById("to-range-sens"),
  rangeFov: document.getElementById("to-range-fov"),
  rangeSpawnBot: document.getElementById("to-range-spawnbot"),
  pauseRange: document.getElementById("to-pause-range"),
  pauseSpawnBot: document.getElementById("to-pause-spawnbot"),
  pauseClearBots: document.getElementById("to-pause-clearbots"),
};

const isTouch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;

// Standard gamepad mapping: left stick moves, right stick looks, triggers
// fire/aim. Covers Bluetooth/MFi pads on iPad as well as desktop controllers
// — no separate "controller mode" toggle, it activates the moment a pad
// reports input, same way key state does.
const gamepadState = {
  connected: false, moveX: 0, moveY: 0, lookDX: 0, lookDY: 0,
  firing: false, ads: false, jump: false, crouch: false, pickup: false, endStreak: false,
};
let gpIndex = null;
let gpPrev = {};

// Debug readout for controllers that don't behave — shows the raw id/mapping
// and live axes/buttons so a pad that connects but does nothing (common with
// non-MFi/generic Bluetooth pads on iOS, which often report mapping:"" instead
// of "standard") can be diagnosed without a desktop devtools connection.
const gpDebugEl = document.getElementById("to-gp-debug");
const gpDebugForced = /[?&]gpdebug=1/.test(location.search);
function renderGpDebug(gp) {
  if (!gpDebugEl) return;
  if (!gp) {
    if (!gpDebugForced) gpDebugEl.hidden = true;
    else gpDebugEl.textContent = "No gamepad detected.\nPress any button on the controller.";
    return;
  }
  const nonStandard = gp.mapping !== "standard";
  gpDebugEl.hidden = false;
  const axes = gp.axes.map((a, i) => `${i}:${a.toFixed(2)}`).join(" ");
  const buttons = gp.buttons.map((b, i) => (b.pressed || b.value > 0.1) ? i : null).filter((v) => v !== null).join(",") || "none";
  gpDebugEl.textContent =
    `id: ${gp.id}\n` +
    `mapping: "${gp.mapping}"${nonStandard ? "  (NON-STANDARD — layout may be scrambled)" : ""}\n` +
    `axes: ${axes}\n` +
    `pressed: ${buttons}`;
}

// The touch pad belongs to the match, not the lobby — it used to sit over
// the menu, bleeding FIRE and RELOAD through the translucent panels.
// A paired controller (common on iPad) replaces the on-screen sticks, so the
// overlay hides itself the moment one is detected rather than stacking both.
function setTouchControls(on) {
  els.touch.hidden = !(isTouch && on) || gamepadState.connected;
  // The whole touch HUD layout (and the portrait "turn it sideways" card)
  // hangs off this class, so a phone menu keeps its own layout.
  document.body.classList.toggle("to-touch-play", !els.touch.hidden);
  if (!els.touch.hidden) lockLandscape();
}

/* Settings > HUD layout: drag the touch buttons and HUD pieces anywhere.
   Opens from the lobby or the pause menu; the menus step aside and the HUD
   (and, on a phone, the touch pad) shows until Done. */
let layoutRestore = null;
const hudLayout = new HudLayout({
  stage: els.hud.parentElement || document.body,
  touch: isTouch,
  onOpen() {
    layoutRestore = {
      screens: [els.title, els.pause, els.gameover].map((el) => [el, el.hidden]),
      hud: els.hud.hidden, touch: els.touch.hidden,
    };
    for (const [el] of layoutRestore.screens) el.hidden = true;
    els.hud.hidden = false;
    setTouchControls(true);
  },
  onClose() {
    const r = layoutRestore;
    layoutRestore = null;
    if (!r) return;
    for (const [el, was] of r.screens) el.hidden = was;
    els.hud.hidden = r.hud;
    setTouchControls(!r.touch);
  },
});
for (const b of document.querySelectorAll("[data-hud-layout]")) b.addEventListener("click", () => hudLayout.open());

/* Android Chrome can hold landscape once fullscreen; iOS can do neither and
   gets the rotate card instead. Both calls fail quietly where unsupported. */
let triedLandscape = false;
function lockLandscape() {
  if (triedLandscape || !isTouch) return;
  triedLandscape = true;
  const el = document.documentElement;
  const go = () => screen.orientation?.lock?.("landscape").catch(() => {});
  if (el.requestFullscreen && !document.fullscreenElement) {
    el.requestFullscreen({ navigationUI: "hide" }).then(go).catch(() => {});
  } else go();
}
setTouchControls(false);
// Settings > Controller (lobby and Esc menu): the pad drawn with its bindings.
for (const host of document.querySelectorAll("[data-pad-layout]")) new ControllerLayout(host);
function markPadPresent() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  document.body.classList.toggle("to-has-pad", Array.from(pads).some((p) => p && p.connected));
}
window.addEventListener("gamepadconnected", markPadPresent);
window.addEventListener("gamepaddisconnected", markPadPresent);
/* Which pad to read (user, 2026-10-03: "I auto sway to the left" on a
   controller). The last pad to connect used to win, so a phantom or
   non-standard device (some laptops expose one, an axis resting at -1)
   could take over and hold the player at full left. A standard-mapped pad
   is preferred over anything else; among those, the one already in use. */
function pickPad(pads, current) {
  const live = Array.from(pads).filter((p) => p && p.connected);
  const cur = current != null ? live.find((p) => p.index === current) : null;
  if (cur && cur.mapping === "standard") return cur;
  return live.find((p) => p.mapping === "standard") || cur || live[0] || null;
}

/* The left stick's resting offset. A worn stick that rests a little off
   centre (drift) used to walk you sideways once it passed the deadzone; it's
   measured whenever the stick should be at rest (a pad connecting, the
   loading screen coming down) and taken off every reading. Only a small
   offset counts: anything bigger is someone actually pushing the stick. */
const padRest = { x: 0, y: 0, index: null };
function calibratePadRest() {
  const gp = gpIndex != null ? navigator.getGamepads?.()[gpIndex] : null;
  if (!gp) return;
  const x = gp.axes[0] || 0, y = gp.axes[1] || 0;
  if (padRest.index !== gp.index) { padRest.x = 0; padRest.y = 0; padRest.index = gp.index; }
  if (Math.hypot(x, y) < 0.3) { padRest.x = x; padRest.y = y; }
}

/* ...and re-learned during play (user, 2026-10-03: "still a left sided auto
   drift but it's small"). One reading at connect or load can be wrong: a pad
   that hasn't reported yet reads all zeros, and a worn stick wanders. A stick
   sitting near the centre and almost perfectly still for over a second is
   resting, not being pushed (a thumb holding a tilt wobbles more than this),
   so its average then becomes the new rest. */
const REST_LEARN = { secs: 1.2, wobble: 0.025, radius: 0.28 };
const restWin = { t: 0, minX: 0, maxX: 0, minY: 0, maxY: 0, sx: 0, sy: 0, n: 0 };
function learnPadRest(x, y, dt) {
  if (Math.hypot(x, y) >= REST_LEARN.radius) { restWin.t = 0; restWin.n = 0; return; }
  if (!restWin.n) Object.assign(restWin, { t: 0, minX: x, maxX: x, minY: y, maxY: y, sx: 0, sy: 0 });
  restWin.minX = Math.min(restWin.minX, x); restWin.maxX = Math.max(restWin.maxX, x);
  restWin.minY = Math.min(restWin.minY, y); restWin.maxY = Math.max(restWin.maxY, y);
  if (restWin.maxX - restWin.minX > REST_LEARN.wobble || restWin.maxY - restWin.minY > REST_LEARN.wobble) {
    restWin.n = 0;   // moving: start a fresh window next frame
    return;
  }
  restWin.t += dt; restWin.sx += x; restWin.sy += y; restWin.n++;
  if (restWin.t >= REST_LEARN.secs) {
    padRest.x = restWin.sx / restWin.n;
    padRest.y = restWin.sy / restWin.n;
    restWin.n = 0;
  }
}

window.addEventListener("gamepadconnected", (e) => {
  const gp = pickPad(navigator.getGamepads ? navigator.getGamepads() : [e.gamepad], gpIndex);
  gpIndex = gp ? gp.index : e.gamepad.index;
  gamepadState.connected = true;
  // A beat later: a fresh pad's first reading can still be all zeros.
  setTimeout(calibratePadRest, 300);
  if (gameState === "playing") setTouchControls(true);
});
window.addEventListener("gamepaddisconnected", (e) => {
  if (e.gamepad.index !== gpIndex) return;
  gpIndex = null;
  gamepadState.connected = false;
  gamepadState.moveX = gamepadState.moveY = 0;
  gamepadState.firing = gamepadState.ads = gamepadState.jump = gamepadState.crouch = false;
  gamepadState.pickup = false;
  if (gameState === "playing") setTouchControls(true);
});

const loadout = new Loadout({
  sum: {
    cls: document.getElementById("to-pf-sum-class"),
    name: document.getElementById("to-pf-sum-name"),
    secondary: document.getElementById("to-pf-sum-secondary"),
    atts: document.getElementById("to-pf-sum-atts"),
    stats: document.getElementById("to-pf-sum-stats"),
    attWeapon: document.getElementById("to-pf-att-weapon"),
    melee: document.getElementById("to-pf-sum-melee"),
    lethal: document.getElementById("to-pf-sum-lethal"),
    tactical: document.getElementById("to-pf-sum-tactical"),
    xp: document.getElementById("to-pf-xp"),
    next: document.getElementById("to-pf-next"),
  },
  maps: els.loMaps,
  mapCard: {
    thumb: document.getElementById("to-pf-mapcard-thumb"),
    name: document.getElementById("to-pf-mapcard-name"),
    blurb: document.getElementById("to-pf-mapcard-blurb"),
    change: document.getElementById("to-pf-mapcard-change"),
  },
  slotToggle: document.getElementById("to-lo-slot-toggle"),
  classes: els.loClasses,
  list: els.loList,
  name: els.loName,
  blurb: els.loBlurb,
  stats: els.loStats,
  atts: els.loAtts,
  gear: document.getElementById("to-lo-gear"),
  rank: els.loRank,
  rankFill: els.loRankFill,
}, (activeWeapon) => {
  refreshLobbyMap();
  charInspector?.setWeapon(loadout.resolved);
  showSumGun();
  if (inspectorLive) {
    const gearPanel = document.getElementById("to-pfp-gear");
    inspector?.show(gearPanel && !gearPanel.hidden ? loadout.melee : activeWeapon);
  }
});

// -------------------- scorestreaks --------------------
// The code is in streaks/ (and modes/umb-heroes.js); these are the variables
// game.js itself still writes, so they live here until their writers move.

/* Counter-UAV (BO2): an enemy one scrambles our minimap until jammedUntil,
   knocks our side's UAV down, and whoever of us had called that UAV gets
   locked out of calling another (streakLockUntil.uav). myUavUntil is how we
   know it was us. */
let jammedUntil = 0;
let myUavUntil = 0;

/* Marking mode: the streak that's waiting for a ground point, or null. Both
   the care package and the airstrike need "look somewhere, press again", so
   they share it. */
let markingStreak = null;

/* Controller-only: which ready streak d-pad right will fire. Keyboard's `4`
   doesn't use this — it always calls the priciest ready one directly. This
   is purely for a pad, which has a spare button to dedicate to "pick"
   separately from "use". */
let selectedStreak = null;
let streakCallGuardUntil = 0;   // no calls for a moment after a care package pays out
let freshStreak = null;         // { id, until }: the slot pulses "ready" after a package
initStreakCalling();


/* ---------------- Dragonfire + SAM Turret (BO2) ----------------
   dragonfire.js / sam-turret.js own the models and flight; this is the
   piloting, the guns' damage, the SAM's targeting and the shoot-downs.
   Authority follows the rest of the streaks: the owner's client decides
   (its gun's hits, its SAM's locks and kills, its Dragonfire's health),
   everyone else draws a copy from the wire. */
let dragonfire = null;          // our own while we fly it
let dfViewOn = false, dfSaved = null, dfHud = null, dfSendT = 0;
let dfIx = 0, dfIz = 0;         // this frame's stick, taken before the body freezes


/* The VTOL Warship. `warship` is our own while we ride its guns. */
let warship = null;
let warshipGun = "chain";

initBotStreaks();

// -------------------- mode + networking --------------------

let modeId = "ops";
// Nothing is ticked on the Play tab until the player picks a mode (user
// call): Deploy waits for that choice. modeId keeps a real value underneath
// so everything that reads currentMode() before then still works.
let modePicked = false;
let matchesPlayed = 0;   // seeds the map-vote shortlist, so it changes each round
const teamScores = { phantom: 0, ghost: 0 };
const bots = new BotManager();
const BOT_TARGET = MAX_PLAYERS;   // a PvP room is padded with bots up to 22; each real joiner bumps one

// Quickplay: everyone who leaves the room code untouched lands in the same
// public server for their mode, instead of each getting their own random
// room. Only overflow into a numbered shard (QTDM2, QTDM3, ...) once the
// base room is genuinely full of real people — see joinQuickplay().
const QUICKPLAY_BASE = { umb: "QUMB", tdm: "QTDM", koth: "QKOH", oitc: "QOTC", gungame: "QGUN", snd: "QSND", infection: "QINF", royale: "QTRR", social: "QSOC" };
const QUICKPLAY_MAX_SHARDS = 9;
let roomIsCustom = false;   // true once the player types a code or asks for a new one
/* The room's map, as its host told us before our match began (onStage). */
let roomMapHint = null;
let gunGameProgress = 0;
let hill = null;
let hillAcc = 0;

// -------------------- Search & Destroy --------------------
let bomb = null;             // Bomb instance for the current match, or null outside snd
let bombSites = null;        // [{id, x, z}] for the loaded map, cached per match
let sndRound = 0;            // 1-based round counter
let sndAttackTeam = "phantom"; // which team plants this round; swaps at halftime
let sndEliminated = false;   // this player is out for the rest of the round (no respawn)
let sndRoundOver = false;    // freeze while the banner/HUD settles between rounds
let sndInteractHeld = false; // physically holding E right now
// Standing where a plant/defuse is possible. A pad has no E: D-pad right
// (its hold-to-interact button) plants and defuses here, and stops being a
// weapon-swap hold while it does.
let sndCanInteract = false;

const audio = new GameAudio();
const ambience = new MapAmbience(audio);
const music = new GameMusic();
let suppressT = 0;

const animDebug = new AnimDebugLab();

/* -------------------- room bot skill --------------------
   Bots only ever run on ONE client, the bot host (net.isBotHost: whoever has
   been in the room longest, which is normally whoever started it), and it
   builds them with its own Bot skill setting. So the host's setting is the
   room's, and a joiner's own choice does nothing while someone else hosts.
   Every bot carries its tier on the wire (`bs`), so each client reads the
   room's skill off the bots themselves: the lobby says whose setting is in
   charge, and the veteran XP boost pays everyone in the room, not only the
   host. If the host leaves, the next-longest player takes the bots over and
   keeps the tier the room was playing at for the rest of that match
   (`roomSkillSeen`), instead of swapping to their own setting mid-fight. */
let roomSkillSeen = null;   // tier read off another host's bots this match
function roomBotSkill() {
  if (!net.active || net.isBotHost()) return bots.count ? bots.difficulty : null;
  const n = {};
  for (const p of net.peers.values()) if (p.botSkill) n[p.botSkill] = (n[p.botSkill] || 0) + 1;
  let best = null;
  for (const k in n) if (!best || n[k] > n[best]) best = k;
  return best;   // null: no bots in the room
}
const VETERAN_XP_BOOST = 0.1;   // +10% XP for a match played against veteran bots
function syncRoomBotSkill(dt) {
  if (net.active && !net.isBotHost()) {
    const seen = roomBotSkill();
    if (seen) roomSkillSeen = seen;
  } else if (net.active && roomSkillSeen) {
    bots.difficulty = roomSkillSeen;   // took the bots over mid-match
  }
  // Veteran time, for the XP boost: the boost pays once veteran bots have
  // been in the match for at least half of it, so a tier flipped in the
  // last minute doesn't earn it.
  if (gameState !== "playing" || isStaging()) return;
  player.matchT += dt;
  if (roomBotSkill() === "veteran") player.vetBotT += dt;
  renderBotSkillNote();
}
function veteranBoostOn() {
  return isPvp() && !isRange() && player.matchT > 0 && player.vetBotT >= player.matchT * 0.5;
}
/* XP as it's banked on the account: the veteran boost on top. */
function boostedXp(amount) {
  return veteranBoostOn() ? Math.round(amount * (1 + VETERAN_XP_BOOST)) : amount;
}
/* Lobby: under the Bot skill picker, say whose setting runs the room. */
let botSkillNoteText = null;
function renderBotSkillNote() {
  const el = document.getElementById("to-set-botskill-note");
  if (!el) return;
  let text = "Veteran bots: +10% XP";
  if (net.active && !net.isBotHost()) {
    const seen = roomBotSkill() || roomSkillSeen;
    text = seen
      ? `Host's bots: ${seen[0].toUpperCase() + seen.slice(1)}${seen === "veteran" ? " (+10% XP)" : ""}. Yours applies when you host.`
      : "The host's setting runs the bots. Yours applies when you host.";
  }
  if (text !== botSkillNoteText) { botSkillNoteText = text; el.textContent = text; }
}

function toggleThirdPerson() {
  settings.thirdPerson = !settings.thirdPerson;
  saveSettings();
}

/* Emotes: hold H for the wheel (emote-wheel.js), release on one to play
   it. The camera pulls out to third person for it, like any locker-room
   emote; moving, firing, dying or the clock running out ends it. The index
   rides the state packet (`em`) so everyone else sees it too. */
let emote = null;   // { idx, t, role } while the local player is emoting (role 1 = second half of a duo)
Object.assign(HAND_POSES, FP_HAND_POSES);   // point / L / flat, for the first-person emotes
const emoteWheel = new EmoteWheel(els.hud, (i) => {
  if (gameState !== "playing" || !player.alive) return;
  if (EMOTES[i].kind === "duo") { armDuo(i); return; }
  emote = { idx: i, t: 0, role: 0 };
});
function stopEmote() { emote = null; }
const emoteKind = () => (emote ? EMOTES[emote.idx]?.kind ?? null : null);
/* Third person and duo emotes pull the camera out; first person ones don't. */
const emoteIsTp = () => !!emote && emoteKind() !== "fp";
/* This frame's first-person emote: hand targets, gun, camera motion. */
const fpEmoteFrame = () => (emoteKind() === "fp" ? EMOTES[emote.idx].fp(emote.t) : null);
/* Nothing to play (a bad index off a hook or old save): no emote. */
function validEmote() { if (emote && !EMOTES[emote.idx]) emote = null; return emote; }

/* Duo emotes (user, 2026-10-04: "it shouldn't be aim at the person. it
   should be a trigger to hold x near a person to send them a emote request.
   and then they receive that notification. and in order for the duo emote to
   activate, that other person has to stand near the other person and hold x.
   also the emote request should have a 30 second limit countdown").
   Pick a duo emote on the wheel and it's armed. Walk up to a teammate (within
   DUO_NEAR) and hold X (DUO_HOLD) to send them the request. They get a
   notification counting down DUO_REQUEST_SECONDS; to accept they come and
   stand by you and hold X too. The accepter works out where both stand
   (their midpoint, facing each other the emote's distance apart) and sends
   it back, so both clients snap to the same spots and start together.
   Teammates only. While it's yours to use, X belongs to the duo (no weapon
   swap or pickup). */
const DUO_NEAR = 3, DUO_REQUEST_SECONDS = 30, DUO_HOLD = 0.6;
let duoArmed = null;      // { idx, until, hold } picked on the wheel, not sent yet
let duoOutgoing = null;   // { to, name, idx, until }
let duoIncoming = null;   // { from, name, idx, until, hold }
let duoTarget = null;     // the teammate in reach this frame
let duoXClaimed = false;  // X is the duo's this frame (updatePickupPrompt leaves it alone)
const _duoFrom = new THREE.Vector3(), _duoTo = new THREE.Vector3();
const duoAllowed = () => isPvp() && net.connected && !currentMode().ffa && !!net.team && player.alive;
const duoTeammate = (rp) => !!rp?.peer && !isBotPeer(rp.peer) && rp.alive && rp.peer.team === net.team;
/* Close enough to share an emote: DUO_NEAR on the ground, about the same
   floor, nothing solid in between. */
function duoInReach(rp) {
  if (!duoTeammate(rp)) return false;
  const d = Math.hypot(rp.pos.x - move.pos.x, rp.pos.z - move.pos.z);
  if (d > DUO_NEAR || Math.abs(rp.pos.y - move.pos.y) > 1.5) return false;
  _duoFrom.set(move.pos.x, move.pos.y + 1.1, move.pos.z);
  _duoTo.set(rp.pos.x, rp.pos.y + 1.1, rp.pos.z);
  return !segmentBlocked(colliders, _duoFrom, _duoTo);
}
function nearestDuoTeammate() {
  if (!duoAllowed()) return null;
  let best = null, bestD = Infinity;
  for (const rp of remotes.byId.values()) {
    if (!duoInReach(rp)) continue;
    const d = Math.hypot(rp.pos.x - move.pos.x, rp.pos.z - move.pos.z);
    if (d < bestD) { best = rp; bestD = d; }
  }
  return best;
}
/* Picked on the wheel: ready to send with X. A new pick replaces a request
   still waiting for an answer. */
function armDuo(idx) {
  if (EMOTES[idx]?.kind !== "duo" || !duoAllowed()) return;
  cancelDuoOutgoing();
  duoArmed = { idx, until: performance.now() + DUO_REQUEST_SECONDS * 1000, hold: 0 };
}
function cancelDuoOutgoing() {
  if (duoOutgoing && net.connected) net.send({ t: "duo", id: net.id, to: duoOutgoing.to, k: "cancel", e: duoOutgoing.idx });
  duoOutgoing = null;
}
function sendDuoInvite(idx, rp = duoTarget) {
  if (!rp || !net.connected) return;
  net.send({ t: "duo", id: net.id, to: rp.netId, k: "invite", e: idx });
  duoOutgoing = { to: rp.netId, name: rp.peer?.name || "operator", idx, until: performance.now() + DUO_REQUEST_SECONDS * 1000 };
  duoArmed = null;
}
function onDuoMessage(p, m) {
  const idx = m.e | 0;
  if (EMOTES[idx]?.kind !== "duo") return;
  if (m.k === "invite") {
    if (p.team !== net.team || currentMode().ffa) return;   // teammates only
    duoIncoming = { from: p.id, name: p.name || "operator", idx, until: performance.now() + DUO_REQUEST_SECONDS * 1000, hold: 0 };
    audio.stageTick?.();
  } else if (m.k === "cancel") {
    if (duoIncoming?.from === p.id) duoIncoming = null;
  } else if (m.k === "accept") {
    if (!duoOutgoing || duoOutgoing.to !== p.id || duoOutgoing.idx !== idx) return;
    duoOutgoing = null;
    if (!player.alive || gameState !== "playing") return;
    placeForDuo(m.mx, m.mz, m.dx, m.dz, idx, -1);
    emote = { idx, t: 0, role: 0 };
  }
}
/* Stand at the duo spot: `side` -1 is the inviter, +1 the accepter, along
   (dx, dz), which points from the inviter to the accepter. */
function placeForDuo(mx, mz, dx, dz, idx, side) {
  if (![mx, mz, dx, dz].every(Number.isFinite)) return;
  const half = (EMOTES[idx].dist || 1) / 2;
  const x = mx + dx * side * half, z = mz + dz * side * half;
  move.pos.x = x; move.pos.z = z;
  player.pos.x = x; player.pos.z = z;
  if (move.velocity) move.velocity.set(0, 0, 0);
  // Face the partner: the inviter looks along (dx, dz), the accepter back.
  const fx = -side * dx, fz = -side * dz;
  look.yaw = Math.atan2(-fx, -fz);
}
function acceptDuo() {
  const inv = duoIncoming;
  duoIncoming = null;
  const rp = remotes.byId.get(inv.from);
  if (!rp || !player.alive || gameState !== "playing") return;
  let dx = move.pos.x - rp.pos.x, dz = move.pos.z - rp.pos.z;
  const len = Math.hypot(dx, dz) || 1;
  dx /= len; dz /= len;
  const mx = (move.pos.x + rp.pos.x) / 2, mz = (move.pos.z + rp.pos.z) / 2;
  net.send({ t: "duo", id: net.id, to: inv.from, k: "accept", e: inv.idx, mx, mz, dx, dz });
  placeForDuo(mx, mz, dx, dz, inv.idx, 1);
  duoArmed = null;
  cancelDuoOutgoing();
  emote = { idx: inv.idx, t: 0, role: 1 };
}
const duoPromptEl = document.createElement("div");
duoPromptEl.className = "to-duo-prompt";
duoPromptEl.hidden = true;
duoPromptEl.setAttribute("role", "status");
duoPromptEl.setAttribute("aria-live", "polite");
duoPromptEl.innerHTML = "<i class=\"to-duo-ring\"></i><span></span><b class=\"to-duo-clock\"></b>";
els.hud.appendChild(duoPromptEl);
let duoPromptText = "", duoPromptClock = "";
const duoSecondsLeft = (until, now) => Math.max(0, Math.ceil((until - now) / 1000));
/* Per frame: the wheel's duo state, the X hold (accept or send) and the
   prompt with its countdown. */
function updateDuo(dt) {
  const now = performance.now();
  const live = player.alive && gameState === "playing";
  if (!live) { duoArmed = null; duoIncoming = null; cancelDuoOutgoing(); }
  if (duoArmed && now > duoArmed.until) duoArmed = null;
  if (duoOutgoing && now > duoOutgoing.until) duoOutgoing = null;
  if (duoIncoming && now > duoIncoming.until) duoIncoming = null;
  if (emoteWheel.isOpen) emoteWheel.setDuo(duoAllowed(), nearestDuoTeammate()?.peer?.name || null);

  const holdingX = keys.has("KeyX") || (isTouch && touchState.swap) || !!gamepadState.pickup;
  const inviter = duoIncoming ? remotes.byId.get(duoIncoming.from) : null;
  const inviterNear = !!inviter && duoInReach(inviter);
  duoTarget = duoArmed && !inviterNear ? nearestDuoTeammate() : null;
  duoXClaimed = inviterNear || !!duoTarget;
  // X accepts a request from someone beside you first, else sends yours.
  const fill = (o) => { o.hold = holdingX ? o.hold + dt : Math.max(0, o.hold - dt * 2); return o.hold >= DUO_HOLD; };
  if (duoIncoming) {
    if (!inviterNear) duoIncoming.hold = 0;
    else if (fill(duoIncoming)) acceptDuo();
  }
  if (duoArmed) {
    if (!duoTarget) duoArmed.hold = 0;
    else if (fill(duoArmed)) sendDuoInvite(duoArmed.idx, duoTarget);
  }

  let text = "", clock = "", ring = 0, cls = "";
  if (duoIncoming) {
    const name = EMOTES[duoIncoming.idx].name;
    text = inviterNear ? `${duoIncoming.name} wants to ${name}: hold X` : `${duoIncoming.name} wants to ${name}: go to them and hold X`;
    clock = `${duoSecondsLeft(duoIncoming.until, now)}s`;
    ring = inviterNear ? Math.min(1, duoIncoming.hold / DUO_HOLD) : 0;
    cls = "is-incoming";
  } else if (duoArmed) {
    const name = EMOTES[duoArmed.idx].name;
    text = duoTarget ? `Hold X: ${name} with ${duoTarget.peer?.name || "operator"}` : `${name}: walk up to a teammate and hold X`;
    clock = `${duoSecondsLeft(duoArmed.until, now)}s`;
    ring = duoTarget ? Math.min(1, duoArmed.hold / DUO_HOLD) : 0;
    cls = "is-armed";
  } else if (duoOutgoing) {
    text = `${EMOTES[duoOutgoing.idx].name}: waiting for ${duoOutgoing.name}`;
    clock = `${duoSecondsLeft(duoOutgoing.until, now)}s`;
    cls = "is-waiting";
  }
  duoPromptEl.hidden = !text;
  if (!text) return;
  if (text !== duoPromptText) duoPromptEl.querySelector("span").textContent = duoPromptText = text;
  if (clock !== duoPromptClock) duoPromptEl.querySelector(".to-duo-clock").textContent = duoPromptClock = clock;
  duoPromptEl.classList.toggle("is-incoming", cls === "is-incoming");
  duoPromptEl.classList.toggle("is-armed", cls === "is-armed");
  duoPromptEl.classList.toggle("is-waiting", cls === "is-waiting");
  duoPromptEl.style.setProperty("--fill", String(ring));
}

initMenuRoster();


/* A round cracking past raises suppression — washes the colour out, tightens
   the vignette and jitters the frame, so being shot at actually costs you. */
function nearMiss(strength, at = null) {
  suppressT = Math.min(1, suppressT + strength);
  audio.whiz(at);
}

/* Footsteps for everyone who isn't you. Panned, so the direction of the
   sound is real information — the thing you actually listen for in a PF
   fight. Tracked per-actor by distance travelled rather than a timer, so
   someone walking slowly is quieter and rarer than someone sprinting. */
const stepTrack = new Map();
const STEP_STRIDE = 1.9;     // metres between footfalls
const STEP_HEARING = 34;     // beyond this we don't bother emitting

function updateEnemySteps(dt) {
  const seen = new Set();
  const sources = [];
  for (const rp of remotes.byId.values()) {
    if (rp.alive) sources.push({ key: `r${rp.netId}`, pos: rp.pos });
  }
  for (const b of bots.bots) {
    if (b.alive) sources.push({ key: `b${b.id}`, pos: b.pos });
  }

  for (const s of sources) {
    seen.add(s.key);
    let t = stepTrack.get(s.key);
    if (!t) { stepTrack.set(s.key, { last: s.pos.clone(), dist: 0 }); continue; }

    const moved = s.pos.distanceTo(t.last);
    t.last.copy(s.pos);
    // A teleport (respawn, net correction) shouldn't fire a burst of steps.
    if (moved > 3) { t.dist = 0; continue; }
    t.dist += moved;

    if (t.dist >= STEP_STRIDE) {
      t.dist -= STEP_STRIDE;
      if (heroActive() && hero().id === "hunter" && player.alive) footprints().drop(s.pos, look.yaw);
      const range = s.pos.distanceTo(player.pos);
      if (range < STEP_HEARING) {
        // Louder than your own steps: these are the ones worth hearing.
        audio.step(s.pos, 0.16);
      }
    }
  }

  for (const key of stepTrack.keys()) if (!seen.has(key)) stepTrack.delete(key);
}

/* Closest approach of a ray to a point; used to tell a near miss from a
   shot that was never coming near us. */
function rayDistanceTo(origin, dir, point) {
  const toPoint = point.clone().sub(origin);
  const along = toPoint.dot(dir);
  if (along < 0) return Infinity;
  return toPoint.addScaledVector(dir, -along).length();
}

function currentMode() { return MODES[modeId]; }
function isPvp() { return currentMode().pvp; }
function isZombies() { return !!currentMode().zombies; }
function isRange() { return !!currentMode().range; }
function isView() { return !!currentMode().view; }
/* Socialize (modes.js): a hangout, no combat. `socialRoom` is the room
   itself, which stays a Socialize room while the owner has it playing a
   real mode (see switchRoomMode). */
function isSocial() { return !!currentMode().social; }
/* The hangout's empty hands. The owner (user: "troll_runner should not
   have any restriction" in Socialize) keeps the whole loadout there, guns,
   melee and throwables, except while a drink or a seat has the hands. */
function socialUnarmed() { return isSocial() && (!isTrollRunner() || !!bar.drink || !!seated); }
let socialRoom = false;
let roomModeSeq = 0;         // the room's mode count (net.modeSeq on the wire)
let socialMapId = null;      // the hangout's map, to come back to after a match
let socialReturnSeq = null;  // set while a finished match waits to go back to the hangout
let socialReturnTimer = 0;
/* View mode is the owner's alone (user: "only for troll_runner"): the
   setting row only shows, and only takes effect, on that account. */
function isTrollRunner() {
  return String(window.TrollrunnerAccounts?.getCachedProfile?.()?.username || "").toLowerCase() === "troll_runner";
}
function viewModeOn() { return !!settings.viewMode && isTrollRunner(); }
/* Invincible is the owner's too: the pause-menu row only shows, and only
   takes effect, on troll_runner. */
function invincibleOn() { return !!settings.invincible && isTrollRunner(); }
function renderViewModeRow() {
  const row = document.getElementById("to-set-viewmode-row");
  if (row) row.hidden = !isTrollRunner();
  const godRow = document.getElementById("to-set-invincible-row");
  if (godRow) godRow.hidden = !isTrollRunner();
  const note = document.getElementById("to-set-viewmode-note");
  if (note) note.hidden = !viewModeOn();
}
let viewPrevMode = null;   // the mode the lobby had before Deploy swapped in View mode
function isSnd() { return !!currentMode().rounds; }
function isInfection() { return !!currentMode().infection; }
function isRoyale() { return !!currentMode().royale; }
/* Participants a PvP room is padded up to with bots. */
function botTarget() { return isSocial() ? 0 : isRoyale() ? (builtMap?.map?.royale?.players || ROYALE.players) : BOT_TARGET; }
/* Infection plays on the two ordinary sides: Phantoms are the survivors,
   Ghosts the infected. */
function isInfected() { return isInfection() && net.team === "ghost"; }
function teamName(team) {
  if (isInfection()) return team === "ghost" ? "Infected" : "Survivors";
  return TEAMS[team]?.name;
}
let zdir = null;
let rangeSet = null;
function isBotPeer(p) { return p.isBot || isSyntheticId(p.id); }

/* Where the real people are looking from (us: the camera, so a spectator
   counts where they watch), for the bots' level of detail. */
const _humanEyes = [];
function humanEyes() {
  _humanEyes.length = 0;
  _humanEyes.push(camera.position);
  for (const rp of remotes.byId.values()) {
    if (rp.alive && !isBotPeer(rp.peer)) _humanEyes.push(rp.pos);
  }
  return _humanEyes;
}

/* Real people in the room, and how they're split — what the bots pad out. */
function humanHeadcount() {
  const teams = { phantom: 0, ghost: 0 };
  let humans = 1;
  if (net.team in teams) teams[net.team]++;
  for (const p of net.peers.values()) {
    if (isBotPeer(p)) continue;
    humans++;
    if (p.team in teams) teams[p.team]++;
  }
  return { humans, teams };
}

/* Any OTHER real (non-bot) person currently connected to this match. When
   true, pausing must stay local-only — this client's own net feed, bots
   (this client may be the bot host, publishing them for the whole room)
   and incoming bullets keep simulating so nobody else's match freezes
   because one operator opened their menu. */
function otherHumansInMatch() {
  if (!net.connected) return false;
  for (const p of net.peers.values()) if (!isBotPeer(p)) return true;
  return false;
}

initModePicker();

let sumGunKey = null;

// `net` is constructed further down this module, so nothing may paint the
// roster until initLobbyChrome() runs at the end of setup.
let lobbyReady = false;
initLobby();


/* Match clock: counts down once a timed PvP mode goes live, independent of
   the staging countdown. `null` means this mode has no clock at all, so the
   HUD element stays hidden rather than showing a stray "0:00". */
let matchClockT = null;
let matchClockShown = -1;

function resetMatchClock() {
  const mode = currentMode();
  matchClockT = mode.pvp && mode.timeLimit ? mode.timeLimit : null;
  matchClockShown = -1;
  els.hudMatchClock.hidden = matchClockT === null;
  if (matchClockT !== null) paintMatchClock();
}

function paintMatchClock() {
  const whole = Math.max(0, Math.ceil(matchClockT));
  if (whole === matchClockShown) return;
  matchClockShown = whole;
  const mins = Math.floor(whole / 60), secs = whole % 60;
  els.hudMatchClock.textContent = `${mins}:${String(secs).padStart(2, "0")}`;
}

function updateMatchClock(dt) {
  if (matchClockT === null) return;
  if (isInfection() && !infectionStarted) return;   // the clock starts with the first infection
  matchClockT = Math.max(0, matchClockT - dt);
  paintMatchClock();
  if (matchClockT <= 0) checkMatchEnd();
}

const net = new Net({
  // Bots filling the room isn't news; only announce real people.
  onJoin: (p) => { if (!isBotPeer(p)) pushKillfeed(`${p.name} joined`); },
  // Someone arrived after the sky lobby: the host tells them where the
  // Royale is (the lobby's own clock only goes out while it runs).
  onHello: (p) => {
    // Everyone in a room plays the host's map: tell the newcomer which.
    // (Paused counts: the host may be sitting in the pause menu.)
    if ((gameState === "playing" || gameState === "paused") && isPvp() && !isBotPeer(p) && net.isBotHost() && loadedMapId) net.publishRoomMap(p.id, loadedMapId, modeId);
    if (!royale?.drop || gameState !== "playing" || isStaging() || isBotPeer(p) || !net.isBotHost()) return;
    const d = royale.drop;
    net.publishRoyaleCatchUp(p.id, royale.seed, d.phase === "bus" ? d.busT : ROYALE_BUS_GONE, royale.t, royale.live);
  },
  onLeave: (p) => { if (!isBotPeer(p)) pushKillfeed(`${p.name} left`); },
  // `hd` has always been on the wire; we just never read it.
  onHitTaken: (m) => damagePlayer(m.dmg, m.id, m.w, !!m.hd),
  // Someone else hit someone else: show the victim flinch here too.
  onHitSeen: (m) => { if (m.id !== net.id && m.target !== net.id) flinchPeer(m.target, m.id, !!m.hd); },
  onPeerDied: (p, m) => {
    const snap = p.snaps?.[p.snaps.length - 1];
    registerDeath(p.name, m.by, m.w, {
      head: !!m.hd, victimTeam: p.team,
      victimPos: snap ? new THREE.Vector3(snap.x, snap.y, snap.z) : null,
      victimWeaponId: p.weapon,
      // `sk` is the victim's own streak, which only they were tracking —
      // Shutdown needs it and can't derive it.
      victimId: p.id, victimStreak: m.sk | 0,
      distance: lastHitRange.get(p.id) || 0,
    });
    lastHitRange.delete(p.id);
    if (m.by !== net.id) creditAssistIfOwed(p.id, p.name);
  },
  onStreak: (m) => applyRemoteStreak(m),
  onDuo: (p, m) => onDuoMessage(p, m),
  onInfect: (m) => applyInfect(m.ids || []),
  onFx: (m) => applyHeroFx(m),
  onNade: (m) => applyRemoteNade(m),
  onDeflect: (p, m) => onRemoteDeflect(p, m),
  onLoot: (p, m) => onRoyaleLoot(p, m),
  onVote: () => { if (intermissionT > 0) renderVote(); },
  onChat: (p, m) => chat.receive(p, m),
  // Socialize: the owner switched the room's mode (see switchRoomMode).
  onMode: (p, m) => { if (p.owner) adoptRoomMode(m); },
  onRp: (p, m) => (String(m.k).startsWith("dj") ? djLulz.onMessage(p, m) : onBarMessage(p, m)),
  /* Map loading screen (see enterMatch). Follow the host's map early, and
     as the host of a match already on, let a finished latecomer in. */
  onReady: (p, m) => {
    if (adoptRoomMode(m)) return;
    if (followsHostMap(m) && loadScreen.isOpen) {
      roomMapHint = m.map;   // still connecting: startGame picks it up
      if (loadTarget && m.map !== loadTarget) enterMatch(m.map);
      return;
    }
    if (!loadScreen.isOpen && (gameState === "playing" || gameState === "paused") && isPvp() && net.isBotHost() && loadedMapId) {
      // Loading the wrong map (our room-map note reached them late): correct them.
      if (m.map !== loadedMapId) net.publishRoomMap(p.id, loadedMapId, modeId);
      else if (m.ok) net.publishGo(p.id, loadedMapId, modeId, isStaging() ? stageT : 0);
    }
  },
  /* Adopt the owner's countdown rather than running our own, so two clients
     that started a fraction of a second apart still hit zero together. We
     only ever take a *shorter* remaining time: a late "6" arriving after we
     are down to 2 must not push us back up the clock. */
  onStage: (m) => {
    // Troll Royale catch-up (we joined after the sky lobby): kept until our
    // own Royale is set up, which can be after this lands.
    if (m.bt != null) { royaleCatchUp = { ...m, at: performance.now() }; applyRoyaleCatchUp(); return; }
    // Socialize: the room moved on to another mode while we weren't looking.
    if (adoptRoomMode(m)) return;
    // One map per room: the host's (the room's oldest player, who runs the
    // countdown). Everyone used to load their own pick, so a room could be
    // split across maps. Before our match starts we note it for startGame;
    // during the countdown we switch to it. A prestige map comes with the
    // host, unlocked or not.
    if (followsHostMap(m)) {
      if (gameState !== "playing" && gameState !== "paused") { roomMapHint = m.map; return; }
      if ((isStaging() || loadScreen.isOpen) && m.map !== (loadTarget || loadedMapId)) { roomMapHint = m.map; enterMatch(m.map); return; }
    }
    // On the loading screen, the host's countdown (or its go, once the match
    // is on) is our cue. A plain room-map note at 0 isn't.
    if (loadHold) {
      const left = Number(m.left);
      if (loadWarm && (m.go || left > 0)) releaseLoad(Number.isFinite(left) ? left : 0);
      return;
    }
    if (gameState !== "playing" || !isPvp()) return;
    // Troll Royale: the owner's seed wins, so everyone has the same zone
    // and loot even if their match counts drifted apart.
    if (royale && isStaging() && m.sd && (m.sd >>> 0) !== royale.seed) setupRoyale(m.sd >>> 0);
    const left = Number(m.left);
    if (!Number.isFinite(left) || left <= 0) { if (isStaging()) endStaging(); return; }
    if (isStaging() && left < stageT) { stageT = left; stageOwner = false; }
  },
  /* Bomb sync. `id` here is the sender, not necessarily the actor — a bot
     host reports carrier handoffs on the carrier's behalf. Our own actions
     already applied locally before we sent them, so this only needs to move
     the needle for everyone else's copy of the bomb. */
  onBomb: (m) => {
    if (!isSnd() || !bomb || m.id === net.id) return;
    if (m.kind === "action") {
      // Someone else's progress. It used to write into our own hold-E bar,
      // which updateSnd hid again the very next frame — so nobody ever saw
      // it. It goes in the status line instead.
      if (m.action === "plant" || m.action === "defuse") noteRemoteBombAct(m.action, m.site || bomb.site);
      return;
    }
    switch (m.action) {
      // Round number and attack side are never taken from the wire: every
      // client reaches the same round/side by independently seeing the same
      // bomb outcome and running prepareSndRound() itself — the same principle
      // as staging's countdown ownership, just with nothing to race here
      // since there's no clock drift to correct. Only the carrier, which one
      // client picks on the others' behalf, actually needs to travel.
      case "reset":
        bomb.carrierId = m.carrierId;
        break;
      case "carrier":
        bomb.carrierId = m.carrierId;
        break;
      case "planted":
        if (bomb.state !== "carried") break;   // already planted/decided here
        bomb.plant(m.site);
        remoteBombAct = null;
        showWaveBanner(`Bomb planted — site ${m.site}`, 1800);
        audio.wave();
        els.bombPrompt.hidden = true;
        break;
      case "defused":
        if (bomb.state === "exploded") break;   // it went off here first
        bomb.defuse();
        sndRoundWin(sndDefendTeam(), "bomb defused");
        els.bombPrompt.hidden = true;
        break;
      case "cancel":
        remoteBombAct = null;
        break;
      case "timeup":
        if (bomb.state !== "planted") sndRoundWin(sndDefendTeam(), "time expired");
        break;
    }
  },
  ownsBot: (id) => !!bots.byId(id),
  onBotHit: (m) => {
    const { killed, bot } = bots.applyHit(m.target, m.dmg);
    if (!killed) return;
    net.reportDeathAs(m.target, m.id, m.w, !!m.hd);
    registerDeath(bot.name, m.id, m.w, {
      head: !!m.hd, victimTeam: bot.team, victimIsBot: true,
      victimPos: bot.pos, victimWeaponId: bot.weaponId,
    });
    if (m.id !== net.id) creditAssistIfOwed(m.target, bot.name);
  },
  onRemoteShot: (p, m) => {
    const origin = new THREE.Vector3(m.ox, m.oy, m.oz);
    const dir = new THREE.Vector3(m.dx, m.dy, m.dz);
    remoteShotFx(origin, dir, m.w, !!m.q, +m.c || 0);
    killcam.noteShot(kcClock, m.id || p?.id, origin, dir, m.w, !!m.q);
    if (royale && !m.q) royaleNoise(origin.x, origin.z, m.id || p?.id);

    // Was it aimed near our head? If so, suppress.
    if (dir.lengthSq() > 0.001 && player.alive) {
      const miss = rayDistanceTo(origin, dir.normalize(), player.pos);
      if (miss < 3) {
        // The crack comes from where the round passed us, not the muzzle.
        const near = player.pos.clone().addScaledVector(dir, origin.distanceTo(player.pos));
        nearMiss(0.55 * (1 - miss / 3), near);
      }
    }
  },
});

/* Match chat (chat.js): Enter all-chat, Y team chat. Lives in the HUD, so it
   shows only in a match. While it's open the game's own keys stand down. */
const chat = new MatchChat({
  net,
  mount: els.hud,
  isTeamMode: () => !currentMode().ffa,
  teamColor: (t) => TEAMS[t]?.ui,
  openProfile: (uid) => openPlayerProfile(uid),
  onOpenChange: (open) => { if (open) { keys.clear(); mouseDown = false; } },
});

/* Trolling Loud's DJ (dj-lulz.js): Socialize requests at the booth, his
   record for the whole room through the booth, the club's lights on it. */
const djLulz = new DjLulz({
  net,
  tracks: music.tracks,
  mount: els.hud,
  humans: () => [...net.peers.values()].filter((p) => !isBotPeer(p)),
  name: () => playerName(),
  banner: (text, ms) => showWaveBanner(text, ms),
  releaseInputs: () => releaseHeldInputs(),
  lock: () => { if (gameState === "playing") controls.lock(); },
  unlock: () => controls.unlock(),
  isTouch,
  radioOn: () => music.playing && music.volume > 0,
});

/* The Troll Forces profile card (profile-card.js) for any operator with an
   account; its "Full profile" opens the site's own card. What the match
   already knows about them draws at once. The pointer has to be free to
   use it, so only reachable from menus, the paused roster and chat. */
function openPlayerProfile(uid) {
  const id = safeUid(uid);
  if (!id) return;
  let peer = null;
  for (const p of net.peers.values()) if (safeUid(p.uid) === id) { peer = p; break; }
  openProfileCard(id, peer ? { name: peer.name, level: peer.level, prestige: peer.prestige, owner: peer.owner, clan: peer.clan, card: peer.card } : {});
}
function playerUid() {
  return safeUid(window.TrollrunnerAccounts?.getCachedProfile?.()?.userId);
}

lobbyReady = true;
renderCallsign();
renderLobbyRoster();

// -------------------- renderer / scene --------------------

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.5;
els.cabinet.appendChild(renderer.domElement);
renderer.domElement.style.position = "absolute";
renderer.domElement.style.inset = "0";
renderer.domElement.style.zIndex = "1";

// three's compileAsync polls every material it saw until that shader is
// ready, and one disposed meanwhile (a match torn down mid warm-up) throws
// from inside the poll. Hold material disposals while a warm-up runs.
if (renderer.compileAsync) {
  let compiling = 0;
  const held = [];
  const rawDispose = THREE.Material.prototype.dispose;
  THREE.Material.prototype.dispose = function () {
    if (compiling) held.push(this); else rawDispose.call(this);
  };
  const rawCompileAsync = renderer.compileAsync.bind(renderer);
  renderer.compileAsync = async (...args) => {
    compiling++;
    try { return await rawCompileAsync(...args); } finally {
      if (--compiling === 0) for (const m of held.splice(0)) rawDispose.call(m);
    }
  };
}

const scene = new THREE.Scene();
const lightPool = new LightPool(scene);
scene.fog = new THREE.FogExp2(0x3a4a38, 0.01);

/* Compile the world scene's shaders the way the frame draws them. The world
   goes through the composer into an offscreen buffer, and three keys every
   shader on whether a render target is bound (tone mapping and colour space
   are applied by the output pass instead). Compiling with no target set
   builds the straight-to-screen variant, which the game never uses, so the
   real one still compiled on first sight: the first third-person switch,
   the first streak in the sky. Any off-screen target gives the right key;
   the compile itself happens synchronously inside compileAsync, so the
   target only needs to be bound for that call. `lightScene` lets a loose
   group compile under the world's lights and fog without joining it. */
const warmTarget = new THREE.WebGLRenderTarget(1, 1);
function compileWorld(root = scene, cam = camera, lightScene = null) {
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(warmTarget);
  try {
    return renderer.compileAsync ? renderer.compileAsync(root, cam, lightScene) : Promise.resolve(renderer.compile(root, cam, lightScene));
  } finally {
    renderer.setRenderTarget(prev);
  }
}

/* The sky (map detail pass, phase 1): the map's three-colour gradient, a
   band of haze on the horizon, the sun (a disc and its glow, off for
   indoor and night maps), and a layer of slow clouds lit from the sun's
   side. All one shader on the dome: no geometry, no lights. Clouds cost an
   fbm per pixel, so Graphics > Medium halves them and Low turns them off
   (uCloudQ). Writes sRGB, so each map's hex colours read as written. */
const skyMat = new THREE.ShaderMaterial({
  uniforms: {
    uTop: { value: new THREE.Color(0x1a2e4a) },
    uHorizon: { value: new THREE.Color(0x6b8a5e) },
    uBottom: { value: new THREE.Color(0x2a3324) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(0xffffff) },
    uSunSize: { value: 0.03 },      // disc radius, radians
    uSunGlow: { value: 0.0 },
    uHaze: { value: 0.0 },
    uCloud: { value: 0.0 },         // coverage 0..1
    uCloudQ: { value: 2 },          // 0 off, 1 cheap, 2 full
    uCloudColor: { value: new THREE.Color(0xffffff) },
    uCloudShade: { value: new THREE.Color(0x8090a0) },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform vec3 uTop, uHorizon, uBottom, uSunDir, uSunColor, uCloudColor, uCloudShade;
    uniform float uSunSize, uSunGlow, uHaze, uCloud, uCloudQ, uTime;
    varying vec3 vDir;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5, t = 0.0;
      for (int i = 0; i < 5; i++) {
        if (float(i) >= 2.0 + uCloudQ * 1.5) break;
        v += a * noise(p);
        t += a;
        p = p * 2.03 + vec2(17.0, 9.0);
        a *= 0.5;
      }
      return v / t;   // 0..1 whatever the octave count, so coverage means the same on every tier
    }
    void main() {
      vec3 d = normalize(vDir);
      float h = d.y;
      vec3 color = h > 0.0
        ? mix(uHorizon, uTop, pow(smoothstep(0.0, 0.75, h), 0.8))
        : mix(uHorizon, uBottom, smoothstep(0.0, -0.3, h));
      // haze: the horizon colour pulled up into the lowest few degrees
      color = mix(color, uHorizon, uHaze * exp(-abs(h) * 9.0));
      float c = max(dot(d, uSunDir), 0.0);
      // glow round the sun, wide and soft, then tight and hot
      color += uSunColor * uSunGlow * (0.18 * pow(c, 6.0) + 0.55 * pow(c, 90.0));
      if (uCloud > 0.0 && uCloudQ > 0.0 && h > 0.0) {
        vec2 p = d.xz / (h + 0.12) * 1.6 + vec2(uTime * 0.012, uTime * 0.004);
        float n = fbm(p);
        float cov = smoothstep(1.0 - uCloud, 1.0 - uCloud + 0.32, n) * smoothstep(0.0, 0.18, h);
        // lit edge toward the sun, shaded underside away from it
        float lit = 0.45 + 0.55 * smoothstep(0.35, 0.8, fbm(p + uSunDir.xz * 0.12));
        vec3 cloud = mix(uCloudShade, uCloudColor, lit) + uSunColor * uSunGlow * 0.35 * pow(c, 4.0);
        color = mix(color, cloud, cov * 0.92);
      }
      // the disc itself, in front of the clouds' thin edges
      float disc = smoothstep(cos(uSunSize), cos(uSunSize * 0.82), dot(d, uSunDir)) * step(0.001, uSunGlow);
      color = mix(color, uSunColor * 1.6 + 0.3, disc);
      gl_FragColor = vec4(color, 1.0);
      #include <colorspace_fragment>
    }
  `,
  side: THREE.BackSide,
  fog: false,
  depthWrite: false,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(250, 24, 16), skyMat);
// Drawn first and centred on the camera every frame (a skybox), so a map
// bigger than the dome (Trollface Island) never looks past its edge.
sky.renderOrder = -1;
sky.frustumCulled = false;
sky.onBeforeRender = () => { skyMat.uniforms.uTime.value = performance.now() / 1000; };
scene.add(sky);

const camera = new THREE.PerspectiveCamera(78, 16 / 9, 0.05, 300);
let baseFov = 78;   // driven by the FOV setting
const killcam = new KillCam(camera);
/* The killcam history's clock: sim seconds, not wall time, so a replay
   plays back at the speed the match actually ran. */
let kcClock = 0;

// Lighting
const hemi = new THREE.HemisphereLight(0xb9d4ff, 0x39432c, 1.1);
scene.add(hemi);
const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
sun.position.set(30, 45, -20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
sun.shadow.camera.far = 120;
sun.shadow.bias = -0.0015;
scene.add(sun);
scene.add(sun.target);

// -------------------- map --------------------

// Mutated in place by buildMap — the movement controller holds references
// to both, so they must never be reassigned.
const ARENA = { minX: -34, maxX: 34, minZ: -34, maxZ: 34 };
const colliders = [];
// The TDM / S&D opening cinematic (match-intro.js), run under staging.
const matchIntro = new MatchIntro({
  camera,
  host: els.hud,
  raycast: (o, d, len) => raycastWorld(colliders, o, d, len),
  audio,
});

let builtMap = null;
let spawnPoints = [];
let spawnSides = null;   // splitSpawnSides() for the loaded map: { axis, lo, hi } spawn indices

function applyEnvironment(map) {
  skyMat.uniforms.uTop.value.set(map.sky.top);
  skyMat.uniforms.uHorizon.value.set(map.sky.horizon);
  skyMat.uniforms.uBottom.value.set(map.sky.bottom);
  // Sun disc + glow (a map without `sky.sun` has none: indoors, night),
  // horizon haze, clouds. The disc sits where the sun light comes from.
  const sk = map.sky;
  skyMat.uniforms.uSunDir.value.set(...map.sun.pos).normalize();
  skyMat.uniforms.uSunColor.value.set(sk.sunColor ?? map.sun.color);
  skyMat.uniforms.uSunGlow.value = sk.sun ?? 0;
  skyMat.uniforms.uSunSize.value = sk.sunSize ?? 0.03;
  skyMat.uniforms.uHaze.value = sk.haze ?? 0;
  skyMat.uniforms.uCloud.value = sk.clouds ?? 0;
  skyMat.uniforms.uCloudColor.value.set(sk.cloudColor ?? 0xffffff);
  skyMat.uniforms.uCloudShade.value.set(sk.cloudShade ?? 0x8a96a6);
  renderer.toneMappingExposure = map.exposure ?? 1.5;
  // Bloom keys off the scene's linear light BEFORE tone mapping, so a map
  // lit bright enough that plain lit surfaces pass the 0.82 default (the
  // Grinleria's sunlit white marble and ice) glows all over: a white veil
  // and a blown-out rink on Medium/High. Such a map raises its threshold
  // (map.bloom) so only real lights and emissives bloom.
  bloom.threshold = map.bloom?.threshold ?? BLOOM_DEFAULT.threshold;
  bloom.strength = map.bloom?.strength ?? BLOOM_DEFAULT.strength;
  bloom.radius = map.bloom?.radius ?? BLOOM_DEFAULT.radius;

  scene.fog.color.set(map.fog.color);
  scene.fog.density = map.fog.density;

  // How far you can see: 300 m on the arena maps, more on a big one
  // (map.viewFar). The sky dome sits just inside it.
  camera.far = map.viewFar || 300;
  camera.updateProjectionMatrix();
  sky.scale.setScalar((camera.far * 0.9) / 250);

  sun.color.set(map.sun.color);
  sun.intensity = map.sun.intensity;
  sun.position.set(...map.sun.pos);

  // Keep the shadow frustum tight around whatever this map actually spans.
  const span = Math.max(map.bounds.maxX - map.bounds.minX, map.bounds.maxZ - map.bounds.minZ) * 0.62;
  sun.shadow.camera.left = -span;
  sun.shadow.camera.right = span;
  sun.shadow.camera.top = span;
  sun.shadow.camera.bottom = -span;
  sun.shadow.camera.updateProjectionMatrix();

  hemi.color.set(map.hemi.sky);
  hemi.groundColor.set(map.hemi.ground);
  hemi.intensity = map.hemi.intensity;

  ambient.color.set(map.ambient.color);
  ambient.intensity = map.ambient.intensity;

  // A map in space (Trollface Island) gets stars inside the sky dome.
  setStarField(!!map.stars);
}

/* Stars for a space sky: points just inside the dome, so they ride along
   with it (it follows the camera) and never get closer. A denser, tinted
   band across the sky reads as the Milky Way. */
let starField = null;
function setStarField(on) {
  if (!on) {
    if (starField) { sky.remove(starField); starField.geometry.dispose(); starField.material.dispose(); starField = null; }
    return;
  }
  if (starField) return;
  const N = 5200, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  let s = 0x5eed;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < N; i++) {
    const band = i < N * 0.45;
    let x, y, z;
    do {
      x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1;
      if (band) y = y * 0.16 + x * 0.45;   // a tilted band
    } while (x * x + y * y + z * z > 1 || x * x + y * y + z * z < 0.05);
    const l = Math.hypot(x, y, z), r = 240;
    pos.set([x / l * r, y / l * r, z / l * r], i * 3);
    const b = 0.45 + rnd() * 0.55;
    const tint = rnd();
    col.set(tint < 0.12 ? [b, b * 0.8, b * 1.2] : tint < 0.22 ? [b * 1.15, b, b * 0.8] : [b, b, b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  starField = new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false, transparent: true, opacity: 0.95 }));
  starField.renderOrder = -1;
  sky.add(starField);
}

let loadedMapId = null;

// ?colliderdebug=1 draws every entry in `colliders` as a wireframe box, so a
// mismatch between a house's real modelled walls and its ghostWalls/ghostBox
// collider (the two are hand-authored separately, per house-props.js and
// battlefield-props.js's file comments) shows up as a wireframe visibly
// poking through or floating short of the visible mesh, instead of only
// surfacing as a confusing "shot through the wall" bug report later.
const colliderDebugForced = /[?&]colliderdebug=1/.test(location.search);
let colliderDebugGroup = null;
function buildColliderDebugOverlay() {
  const group = new THREE.Group();
  group.name = "collider-debug";
  const mat = new THREE.LineBasicMaterial({ color: 0xff2d55 });
  for (const c of colliders) {
    const size = new THREE.Vector3().subVectors(c.max, c.min);
    const center = new THREE.Vector3().addVectors(c.max, c.min).multiplyScalar(0.5);
    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const edges = new THREE.EdgesGeometry(geo);
    const line = new THREE.LineSegments(edges, mat);
    line.position.copy(center);
    group.add(line);
  }
  return group;
}

function loadMap(id) {
  if (id === loadedMapId) return;    // the lobby already put us in this one
  disposeMap(builtMap, scene);
  // A map preloaded from the menu (map-preload.js) is adopted as built: its
  // colliders and bounds are copied into the live arrays the movement
  // controller holds, and nothing is rebuilt or re-downloaded.
  const pre = mapPreload?.take(id);
  if (pre) {
    colliders.length = 0;
    for (const c of pre.colliders) colliders.push(c);
    Object.assign(ARENA, pre.arena);
    builtMap = pre.built;
  } else {
    builtMap = buildMap(id, { colliders, arena: ARENA });
  }
  builtMap.map.attachAudio?.(audio);
  builtMap.map.attachMusic?.(music);
  scene.add(builtMap.root);
  spawnPoints = builtMap.spawnPoints;
  // Spawns are authored as [x, z]: stand each on the floor under it (a
  // platform, a step), not at y 0 inside it. At y 0 on Undergrin the push
  // out of the 1.1 m platform shoved players out past the end wall, stuck
  // in a sliver they could only shuffle along (user: "stuck in place").
  for (const sp of spawnPoints) if (!sp.y) sp.y = groundHeightAt(colliders, sp.x, sp.z, 2.0);
  spawnSides = splitSpawnSides(spawnPoints);
  applyEnvironment(builtMap.map);
  applyClutter();
  buildMinimapBase();
  // Bot pathfinding is built from the map's colliders, so it has to follow
  // the map — a field from the old geometry routes them into new walls.
  bots.rebuildNav(colliders, ARENA, 0);
  loadedMapId = id;
  if (colliderDebugForced) {
    colliderDebugGroup?.parent?.remove(colliderDebugGroup);
    colliderDebugGroup = buildColliderDebugOverlay();
    builtMap.root.add(colliderDebugGroup);
  }
  // Whatever was just built should be warm too (its shaders compile now,
  // under the menu, not on the first frame of the match).
  if (!pre) mapPreload?.noteLive(id);
}

// -------------------- map preloading --------------------
// Nothing loads in the menu any more (user, 2026-10-03: "the map loading
// after users click on find match, for that specific map"). Find Match opens
// the map loading screen (map-load-screen.js), and this builds, downloads
// and warms that one map behind it — see enterMatch below.
const loadScreen = createMapLoadScreen(els.loading.parentElement);
const mapPreload = createMapPreloader({
  renderer, scene, camera, buildMap, maps: MAPS, ids: MAP_IDS,
  compileScene: () => compileWorld(),
  getLive: () => (builtMap ? { id: loadedMapId, root: builtMap.root } : null),
  // Off-map builds never compile behind a live match, only in the menu or
  // under the loading screen.
  canRun: () => gameState === "menu" || loadScreen.isOpen,
});
window.__trollPreload = mapPreload;

// -------------------- lobby backdrop --------------------
// The menu hangs over the arena you are about to drop into, drifting around
// it, rather than over a flat gradient — the map card and the view agree.

let lobbyAngle = 0.6;

/* The map a match on this mode is played on: a forced one (the range), the
   mode's own list (Zombies: its saved pick, else the first), or the versus
   map — the room's, when one is passed. Read from the mode itself, not the
   lobby's state, so it holds however the match was started. */
function matchMapId(roomMapId = null) {
  const m = currentMode();
  if (m.forceMap) return m.forceMap;
  if (m.mapPool) return m.mapPool.includes(loadout.poolMapId) ? loadout.poolMapId : m.mapPool[0];
  return roomMapId || loadout.versusMapId;   // a prestige map only in a private room
}

function lobbyMapId() { return matchMapId(); }

/* The lobby used to build the selected map as its backdrop, but the BO2
   planet covers it completely, so that was a whole map built (and rebuilt
   on every loadout change) for nobody. Kept as a hook; the match loads its
   map behind the loading screen instead. */
function refreshLobbyMap() {}

function updateLobbyCamera(dt) {
  lobbyAngle += dt * 0.05;
  const cx = (ARENA.minX + ARENA.maxX) / 2;
  const cz = (ARENA.minZ + ARENA.maxZ) / 2;
  const span = Math.max(ARENA.maxX - ARENA.minX, ARENA.maxZ - ARENA.minZ);
  const r = span * 0.44;
  camera.position.set(
    cx + Math.cos(lobbyAngle) * r,
    13 + Math.sin(lobbyAngle * 0.7) * 2.5,
    cz + Math.sin(lobbyAngle) * r
  );
  camera.lookAt(cx, 2.4, cz);
  if (camera.fov !== baseFov) {
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
  }
}

initMinimap();

// -------------------- postprocessing --------------------

// Multisampled (user, 2026-10-03: "graphics need to improve on mobile",
// blurry). The canvas's own antialias never reached the 3D view: every
// frame goes through these passes' offscreen targets, which had no MSAA,
// so every edge was jagged, worst on a phone. The sample count follows the
// graphics tier (applyGraphics: MSAA_SAMPLES).
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, camera));
const ssao = new SSAOPass(scene, camera, 1, 1);
ssao.kernelRadius = 0.6;
ssao.minDistance = 0.001;
ssao.maxDistance = 0.15;
ssao.output = SSAOPass.OUTPUT.Default;
composer.addPass(ssao);
const BLOOM_DEFAULT = { strength: 0.55, radius: 0.5, threshold: 0.82 };   // a map can override (applyEnvironment)
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), BLOOM_DEFAULT.strength, BLOOM_DEFAULT.radius, BLOOM_DEFAULT.threshold);
composer.addPass(bloom);
const impactPass = new ShaderPass(ImpactShader);
composer.addPass(impactPass);
composer.addPass(new OutputPass());

// -------------------- weapon view models --------------------
// Rendered in a separate scene/camera overlay so the tiny gun mesh never
// suffers near-plane distortion or scale mismatch with the world FOV.

const weaponScene = new THREE.Scene();
const weaponCamera = new THREE.PerspectiveCamera(58, 16 / 9, 0.01, 10);
const weaponRig = new THREE.Group();
weaponScene.add(weaponRig);

const weaponKeyLight = new THREE.DirectionalLight(0xfff2d8, 3.2);
weaponKeyLight.position.set(0.5, 1.2, 1);
weaponScene.add(weaponKeyLight);
const weaponRimLight = new THREE.DirectionalLight(0x8fb0ff, 1.8);
weaponRimLight.position.set(-0.6, 0.4, -1);
weaponScene.add(weaponRimLight);
const weaponFillLight = new THREE.AmbientLight(0xaab8ff, 1.1);
weaponScene.add(weaponFillLight);

let weaponEnvTex = null;
/* A small studio for the detailed guns' reflections (the Green Candles'
   brass and steel): a dark floor, a grey horizon, a bright ceiling and
   three softboxes, baked once into a PMREM map. Only materials that ask
   for it use it (weapon-model.js), so no other gun or the world changes. */
(() => {
  const env = new THREE.Scene();
  const geo = new THREE.SphereGeometry(10, 32, 16);
  const cols = [];
  const pos = geo.attributes.position;
  const c = new THREE.Color();
  const top = new THREE.Color(0.85, 0.87, 0.9), floor = new THREE.Color(0.05, 0.05, 0.055);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 10;
    c.setRGB(0.32, 0.34, 0.37).lerp(y > 0 ? top : floor, y > 0 ? Math.pow(y, 0.8) : Math.pow(-y, 0.5));
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  env.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const panel = new THREE.MeshBasicMaterial({ color: 0xffffff });
  panel.color.setScalar(4);
  for (const [x, y, z, w, h] of [[5, 5, 3, 5, 3], [-6, 3, -2, 3, 4], [0, 7, -6, 8, 1.2]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), panel);
    p.position.set(x, y, z);
    p.lookAt(0, 0, 0);
    env.add(p);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  weaponEnvTex = pmrem.fromScene(env, 0.04).texture;
  setWeaponEnvMap(weaponEnvTex);
  setSaberEnvMap(weaponEnvTex);
  setHalloweenEnvMap(weaponEnvTex);
  setHeroEnvMap(weaponEnvTex);
  pmrem.dispose();
})();

scene.add(camera);


// Only the equipped weapon is built, and it's rebuilt whenever the loadout
// changes, because attachments alter the geometry.
let activeWeaponMesh = null;
let activeWeaponDef = null;

// The Trollsaber's hilt streams in too; its builder swaps the model into
// any saber already built (trollsaber.js), so nothing to rebuild here.
preloadTrollsaber();
// The Chainsaw and the Reaper's Grin stream in the same way (melee-models.js).
preloadHalloweenMelee();

// Detailed models stream in; rebuild the gun in hand once they land.
preloadWeaponModels().then((ok) => {
  if (!ok) return;
  if (hasDetailedModel(activeWeaponDef)) setActiveWeaponMesh(activeWeaponDef);
  // The menu previews snapshot the gun once; redraw them with the real model.
  if (hasDetailedModel(loadout.resolved)) {
    sumGunKey = null;
    showSumGun();
    charInspector?.setWeapon(loadout.resolved);
    if (inspectorLive) inspector?.show(loadout.resolved);
  }
});

function setActiveWeaponMesh(def) {
  activeWeaponDef = def;
  if (activeWeaponMesh) {
    weaponRig.remove(activeWeaponMesh);
    activeWeaponMesh.traverse((o) => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      if (o.material) o.material.dispose?.();
    });
  }
  activeWeaponMesh = buildWeaponMesh(def);
  // No first-person hands on guns (user call, 2026-09-25): the gun on
  // screen should look exactly like it does in the skin editor, and the
  // block hands sat right on the skin art. Melee and the streak device keep
  // theirs. The meshes stay (tagged userData.hand) for anything that reads
  // their positions; they just don't draw.
  activeWeaponMesh.traverse((o) => { if (o.userData.hand) o.visible = false; });
  weaponRig.add(activeWeaponMesh);
}

let activeMeleeMesh = null;

function setActiveMeleeMesh(def) {
  if (activeMeleeMesh) {
    restoreMeleeHands(activeMeleeMesh);
    weaponRig.remove(activeMeleeMesh);
    activeMeleeMesh.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose?.();
    });
  }
  activeMeleeMesh = buildMeleeMesh(def);
  activeMeleeMesh.visible = false;
  weaponRig.add(activeMeleeMesh);
}

/* Streak-call device (DESIGN-ARMS.md Phase 5) — built once, unlike the
   weapon/melee meshes, since it never changes per-loadout the way a gun's
   attachments or a melee weapon choice do. */
const activeStreakMesh = buildStreakDevice();
activeStreakMesh.visible = false;
weaponRig.add(activeStreakMesh);
// The care package marker, held up ready to throw.
const activeMarkerMesh = buildMarkerDevice();
activeMarkerMesh.visible = false;
weaponRig.add(activeMarkerMesh);
// The hunter-killer itself, held before it's tossed (the model streams in).
const activeDroneMesh = new THREE.Group();
activeDroneMesh.visible = false;
weaponRig.add(activeDroneMesh);
// Both hands cup it from underneath, one either side of the body.
activeDroneMesh.userData.anchors = (() => {
  const right = new THREE.Object3D(), left = new THREE.Object3D();
  right.position.set(0.075, -0.035, 0.01);
  left.position.set(-0.075, -0.035, 0.01);
  activeDroneMesh.add(right, left);
  return { right, left };
})();
loadModel("hunter-drone").then((obj) => {
  obj.scale.setScalar(0.32);
  obj.traverse((n) => { if (n.isMesh) n.castShadow = false; });
  activeDroneMesh.add(obj);
  activeDroneMesh.userData.rotors = [];
  obj.traverse((n) => { if (n.name?.startsWith("DroneRotor")) activeDroneMesh.userData.rotors.push(n); });
}).catch(() => {});

// muzzle flash sprite
const muzzleMat = makeMuzzleFlashMaterial();
const muzzleFlash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), muzzleMat);
muzzleFlash.rotation.z = Math.random() * Math.PI;
weaponRig.add(muzzleFlash);
let muzzleFlashT = 0;
// The Peacemakers' two guns, their brass and their smoke (akimbo-view.js).
const akimboView = createAkimboView({ weaponRig, audio });
let akimboShown = false;

// muzzle point light for dynamic illumination on each shot. Intensity stays
// small because the light sits centimetres from the gun mesh in the weapon
// overlay — anything near the old 3.2 blew the whole screen out to white
// under ACES tone mapping at this range.
const muzzleLight = new THREE.PointLight(0xffcf8a, 0, 1.2, 2);
weaponRig.add(muzzleLight);

// The Soul Blazer's hellfire (soul-blazer.js): one system in the weapon
// scene for the fire out of the skull in your hands, one in the world for
// everyone else's shots, the burning pellets, where they land and the kill.
const hellfireView = new HellfireFx(weaponScene, { scale: 0.5, max: 300 });
const hellfire = new HellfireFx(scene, { scale: 1, max: 900, gain: 0.85, additive: false, hot: 0.5 });
const _sbPos = new THREE.Vector3();
const _sbDir = new THREE.Vector3();
const _sbView = new THREE.Matrix4();

// -------------------- impact effects --------------------

// Debris and dust where rounds land (see impact-fx.js); the additive sparks
// are kept for blasts and the gunship's gun only.
const impactFx = new ImpactFx(scene);
function spawnImpactBurst(pos, color, count = 10) { impactFx.sparksAt(pos, color, count); }

// -------------------- player state --------------------

const player = {
  pos: new THREE.Vector3(0, 1.7, 8), // eye position, mirrored from `move` each frame
  hp: 100,
  maxHp: 100,
  weaponId: "problem416",
  secondaryId: null,     // set by equipFromLoadout when the mode allows one
  weapons: {},
  kills: 0,
  deaths: 0,
  wave: 0,
  alive: true,
  melee: null,          // MeleeState, rebuilt from the loadout on every spawn
  holding: "gun",       // "gun" | "melee" | "streak"
  gear: { lethal: 0, tactical: 0 },
  lastHurtAt: -Infinity, // performance.now() of the last damage taken; gates regen
  spawnGuard: 0,        // seconds of spawn protection left; broken by firing
  assists: 0,
  headshots: 0,
  streak: 0,            // kills since last death
  bestStreak: 0,
  matchXp: 0,           // XP banked during this match, shown on the result screen
  matchT: 0,            // seconds of this match played (veteran XP boost)
  vetBotT: 0,           // ...of them with veteran bots in the room
  lastKilledBy: null,   // whose kill sent us back, for the Revenge achievement
  // Combat record (prestige phase 3, record.js): this match's extra counters.
  shotsFired: 0,        // rounds fired (each shotgun pellet is a round)
  shotsHit: 0,          // ...that hit an enemy player or bot
  matchScore: 0,        // all score earned, streaks allowed or not (for SPM)
  weaponKills: {},      // kills per weapon id (favourite gun)
};

// Which slot (primary/secondary) currentWeapon() resolves against - reset
// to primary on every spawn/equip so a fresh life always starts on the
// main gun regardless of what was held when the last one ended.
let currentWeaponSlot = "primary";

/* Streak device call window (DESIGN-ARMS.md Phase 5). `streakHoldT > 0`
   means "stay on the device," ticked down in updatePlayer(); reaching 0
   returns to whatever was held before (streakReturnTo: the gun in either
   slot, or the melee weapon, which is holstered before the call).
   `streakHoldUntilMark` means "don't count down — stay up for the whole
   marking window," cleared explicitly by confirmMark()/cancelMark(). */
let streakHoldT = 0;
let streakHoldUntilMark = false;

/* The tablet used to swap with the gun in one frame both ways. Now ending a
   hold only starts the tablet lowering (updateStreakView); the gun comes
   back once it's down, rising from the sprint-lowered pose. */
let streakLowering = false;

/* What's in the hand while holding === "streak": the tablet/remote (UAV,
   gunship, the strike's targeting), the care package marker, or the
   hunter-killer itself before it's tossed. */
let streakDeviceKind = "tablet";
// Which page the tablet shows: "uav", "gunship", "strike" (drawTabletScreen).
let streakScreen = "idle";
let streakHoldElapsed = 0;
const MARKER_THROW_TIME = 0.5;
let markerThrowT = 0;
const DRONE_TOSS_AT = 0.6;          // seconds into the hold that the drone leaves the hand
let pendingDroneLaunch = null;

/* Tablet dive (user): for the streaks you work from the tablet (Lightning
   Strike, VTOL Warship, Dragonfire) the view tips down onto the tablet in
   your hands, then pushes into its screen and cuts through a green scan
   flash to whatever it opens (the strike map, the gunner's feed, the
   drone's camera). `then` runs at the cut. Called streaks that just
   confirm (UAV, gunship, VSAT...) keep the plain hold. */
let tabletDive = null;        // { t, dur, then }
let tabletDiveFx = null;
const DIVE_LOOK = 0.42;       // share of the dive spent looking down at it
function startTabletDive(dur, then = null) {
  tabletDive = { t: 0, dur: Math.max(0.5, dur), then };
}
function tabletDiveK() { return tabletDive ? Math.min(1, tabletDive.t / tabletDive.dur) : 0; }
/* How far the view has tipped down onto the tablet (radians). */
function tabletDiveDip() {
  if (!tabletDive) return 0;
  const k = tabletDiveK();
  const a = Math.min(1, k / DIVE_LOOK);
  return 0.38 * a * a * (3 - 2 * a);
}
function updateTabletDive(dt) {
  if (!tabletDive) return;
  if (!player.alive || gameState !== "playing") { tabletDive = null; return; }
  tabletDive.t += dt;
  if (tabletDive.t >= tabletDive.dur) {
    const then = tabletDive.then;
    tabletDive = null;
    tabletDiveFlash();
    then?.();
  }
}
function tabletDiveFlash() {
  if (!tabletDiveFx) {
    tabletDiveFx = document.createElement("div");
    tabletDiveFx.className = "to-tablet-dive";
    tabletDiveFx.setAttribute("aria-hidden", "true");
    (els.streakMark?.parentElement || document.body).appendChild(tabletDiveFx);
  }
  tabletDiveFx.classList.remove("is-on");
  void tabletDiveFx.offsetWidth;   // restart the animation
  tabletDiveFx.classList.add("is-on");
  audio.reload();
}

/* Calling a streak with the melee weapon out (user): it's put away first —
   the draw played backwards, down and off low right, blade powering down —
   and the streak is called the moment it's gone. A swing in progress
   finishes first. `id` is the streak waiting on it. */
const MELEE_HOLSTER_TIME = 0.4;
let meleeHolster = null;        // { t, id }
let meleePutAway = false;       // true only while the holstered call runs
let streakReturnTo = "gun";     // what the hold hands back to: "gun" | "melee"

function holsterMeleeFor(id) {
  if (meleeHolster) { meleeHolster.id = id; meleeHolster.then = null; return; }
  meleeHolster = { t: 0, id, started: false, len: powerHeld() ? POWER_HOLSTER_TIME : MELEE_HOLSTER_TIME };
  cancelCook();
}

/* Is the melee weapon in hand an energy blade (Trollsaber, Halo Blade)? */
function powerHeld() {
  const ud = activeMeleeMesh?.userData;
  return player.holding === "melee" && !!(ud?.saber || ud?.halo);
}

/* Put the energy blade away before `then` runs (a weapon swap): it powers
   down in the hand, then drops out of view. */
function holsterMeleeThen(then) {
  if (meleeHolster) { meleeHolster.then = then; return; }
  meleeHolster = { t: 0, id: null, then, started: false, len: POWER_HOLSTER_TIME };
  cancelCook();
}

function finishMeleeHolster() {
  if (meleeHolster.then) {
    const then = meleeHolster.then;
    meleeHolster = null;
    meleePutAway = true;
    try { then(); } finally { meleePutAway = false; }
    return;
  }
  const id = meleeHolster.id;
  meleeHolster = null;
  meleePutAway = true;
  try { callStreak(id); } finally { meleePutAway = false; }
  if (player.holding === "streak") streakReturnTo = "melee";
  // The call didn't go through after all (spent, jammed...): draw it back.
  else if (player.holding === "melee") {
    meleeDrawT = meleeDrawLen = MELEE_DRAW_TIME;
    const ud = activeMeleeMesh?.userData;
    (ud?.saber || ud?.halo)?.ignite();
    if (ud) ud.holstered = false;
  }
}

function beginStreakHold(seconds = 0, kind = "tablet", screen = null) {
  // Never interrupt a mid-swing; a held melee weapon goes through
  // holsterMeleeFor first.
  if (player.holding === "melee" && !meleePutAway) return;
  if (player.holding !== "streak" || streakDeviceKind !== kind) {
    streakHoldElapsed = 0;
    streakRaiseT = 0;
  }
  streakDeviceKind = kind;
  if (screen) streakScreen = screen;
  streakLowering = false;
  setHolding("streak");
  streakHoldT = seconds;
  streakHoldUntilMark = seconds <= 0;
}

function endStreakHold(immediate = false) {
  streakHoldT = 0;
  streakHoldUntilMark = false;
  if (player.holding !== "streak") { streakLowering = false; return; }
  if (immediate || !player.alive) { finishStreakHold(); return; }
  streakLowering = true;
}

function finishStreakHold() {
  streakLowering = false;
  streakRaiseT = 0;
  markerThrowT = 0;
  if (player.holding === "streak") {
    // Back to the melee weapon if that's what it was called off (it draws
    // itself back up), otherwise the gun - primary or secondary, whichever
    // slot was up.
    if (streakReturnTo === "melee") setHolding("melee");
    if (player.holding === "streak") setHolding("gun");
  }
  streakReturnTo = "gun";
  weaponLowerT = 1;
  if (pendingDroneLaunch) launchPendingDrone();
}

function streakHoldActive() { return player.holding === "streak"; }

/* One in the hand: which throwable is cooking, and how much fuse is left. */
const cooking = { def: null, fuse: 0, slot: null };
let blindT = 0;         // seconds of flashbang whiteout left
let empT = 0;           // seconds of EMP scramble left — HUD and optics down
let shakeT = 0, shakeMag = 0;   // blasts and near misses

/* Firing shake. Each shot kicks a damped spring on each camera axis (pitch,
   yaw, roll) plus a short high-frequency buzz; the weapon's shake stats
   (weapons.js, trimmed by attachments.js) decide how hard each axis is
   kicked and how fast it settles. White noise per frame, which this
   replaced, couldn't express "this grip keeps the sight from bouncing". */
const fireShake = { p: 0, y: 0, r: 0, vp: 0, vy: 0, vr: 0, buzz: 0, rec: 1 };
function kickFireShake(def, steady) {
  // Grows slower than the kick itself, so a light rifle still visibly moves
  // and a sniper doesn't throw the whole screen.
  const k = kickCurve(def.recoilKickPitch) * 1.6 * (def.shakeScale ?? 1) * steady;
  const jolt = def.shakeJolt ?? 1;
  fireShake.vp += k * 11 * (def.shakeVert ?? 1) * (0.85 + Math.random() * 0.3);
  fireShake.vy += k * 9 * (def.shakeSide ?? 1) * (Math.random() * 2 - 1);
  fireShake.vr += k * 9 * jolt * (Math.random() < 0.5 ? -1 : 1);
  fireShake.buzz = Math.min(0.012, fireShake.buzz + k * 0.12 * jolt);
  fireShake.rec = def.shakeRecover ?? 1;
}
function updateFireShake(dt) {
  // Stiffer and better damped the faster the weapon recovers. Stepped in
  // small slices: at 20fps a stiff spring would blow up in one big step.
  const w = 30 * fireShake.rec, z = 0.5 + 0.18 * fireShake.rec;
  const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    for (const [x, v] of [["p", "vp"], ["y", "vy"], ["r", "vr"]]) {
      fireShake[v] += (-w * w * fireShake[x] - 2 * z * w * fireShake[v]) * h;
      fireShake[x] += fireShake[v] * h;
    }
  }
  fireShake.buzz *= Math.exp(-dt * 16 * fireShake.rec);
}
function resetFireShake() {
  fireShake.p = fireShake.y = fireShake.r = fireShake.vp = fireShake.vy = fireShake.vr = fireShake.buzz = 0;
}
// Smoothed idle-sway position, lagged behind the raw sine target by weapon
// weight — see updateWeaponView for why this lives here instead of on
// WeaponState (it's pure view lag, never read for gameplay).
let swaySmoothX = 0, swaySmoothY = 0;

const move = new MovementController({ colliders, arena: ARENA });
const bullets = new BulletSystem(scene);
// Soul Blazer pellets fly as fire (soul-blazer.js HellfireFx).
bullets.onFireTrail = (from, to) => hellfire.trail(from, to);

// -------------------- local third-person body --------------------
// The local player has never had a visible body - only the first-person
// viewmodel (weaponScene, a separate camera/pass below). Third-person mode
// needs one, so it reuses the exact rig every bot/remote player already
// uses (buildHumanoid/poseHumanoid) rather than a bespoke model. It's built
// once and left in `scene` permanently; only its visibility toggles with
// view mode, since the FP camera sits at head height inside it and it
// would otherwise occlude the FP view.
const LOCAL_RIG_MAT = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.7, metalness: 0.1 });
const localRig = buildHumanoid(LOCAL_RIG_MAT, { height: 1.8, gun: false });
localRig.face = cosmetics.face;
localRig.root.visible = false;
scene.add(localRig.root);
// Our own head gets its own copy of the face material, so it can fade out of
// the way as we aim in third person without touching anyone else's.
localRig.parts.head.material = localRig.parts.head.material.clone();
localRig.parts.head.material.alphaTest = 0.02;
let localPhase = Math.random() * Math.PI * 2;
const remotes = new RemotePlayers(scene);
const pickups = new PickupSystem(scene);
const swapHold = new SwapHold();

// Look is composed by hand rather than by PointerLockControls: recoil and the
// touch stick both need to write into the same orientation, and letting PLC
// own the camera quaternion made them fight each other.
const look = { yaw: 0, pitch: 0 };
const BASE_MOUSE_SENS = 0.0022;
const PITCH_LIMIT = 1.5;

const controls = new EventTarget();
controls.isLocked = false;
// requestPointerLock rejects (not throws) when the document isn't focused,
// so swallow it rather than surfacing an unhandled rejection.
controls.lock = () => {
  try {
    const p = renderer.domElement.requestPointerLock?.();
    p?.catch?.(() => {});
    return p || Promise.resolve();
  } catch (err) { return Promise.reject(err); }
};
controls.unlock = () => { try { document.exitPointerLock?.(); } catch { /* not locked */ } };

/* When the lock last changed. Chrome refuses a re-lock for ~1s after an
   unlock (resumePlay waits it out), and the first mousemove after a fresh
   lock can carry a huge bogus delta (dropped below). */
let lockChangedAt = 0;
document.addEventListener("pointerlockchange", () => {
  const locked = document.pointerLockElement === renderer.domElement;
  controls.isLocked = locked;
  lockChangedAt = performance.now();
  controls.dispatchEvent(new Event(locked ? "lock" : "unlock"));
});
document.addEventListener("mousemove", (e) => {
  if (!controls.isLocked) return;
  // The strike tablet has the mouse: it steers the reticle, not the view.
  if (strikeTablet?.isOpen) { strikeTablet.moveCursor(e.movementX, e.movementY); return; }
  // The emote wheel has the mouse while it's open: the view holds still.
  if (emoteWheel.isOpen) { emoteWheel.move(e.movementX, e.movementY); return; }
  // Right after a re-lock the browser can report one enormous jump (the
  // cursor's travel while unlocked): swallow the first moments and cap any
  // single event, so resuming never snaps the view somewhere else.
  if (performance.now() - lockChangedAt < 60) return;
  const mx = Math.max(-300, Math.min(300, e.movementX));
  const my = Math.max(-300, Math.min(300, e.movementY));
  mouseLookAt = performance.now();
  // Near a target, aim assist makes the mouse a little "sticky" (see
  // applyAimAssist) — the same slowdown the stick gets, just gentler.
  const sticky = aimAssistSticky ? AIM_ASSIST_MOUSE_SLOWDOWN : 1;
  const sens = BASE_MOUSE_SENS * (settings.sens / 100) * sticky * lookSensScale();
  look.yaw -= mx * sens;
  look.pitch += (settings.invert ? 1 : -1) * my * sens;
  look.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, look.pitch));
});

let spawner = null;

const keys = new Set();
window.addEventListener("keydown", (e) => {
  if (chat.isTyping) return;
  // Match chat: Enter for everyone, Y for your team (team modes).
  if ((e.code === "Enter" || e.code === "NumpadEnter" || e.code === "KeyY") && !e.repeat
      && gameState === "playing" && isPvp() && net.connected) {
    e.preventDefault();
    chat.open(e.code === "KeyY");
    return;
  }
  // The emote wheel (in a match, or on the menu's operator): H opens and
  // closes it, X plays what's hovered, Esc closes.
  const wheel = gameState === "menu" ? (charInspectorLive ? menuEmoteWheel : null) : emoteWheel;
  if (wheel && !e.repeat && !typingField(e.target)) {
    if (e.code === "KeyH" && !localPauseOnly) {
      wheel.toggle(gameState === "menu" || (gameState === "playing" && player.alive));
      return;
    }
    if (wheel.isOpen && e.code === "KeyX") { wheel.close(); return; }
    if (wheel.isOpen && e.code === "Escape") wheel.close(true);
  }
  keys.add(e.code);
  // View mode: the keys only fly the camera (and Esc still pauses).
  if (isView() && gameState === "playing" && e.code !== "Escape") return;
  if (e.code === "Space" && !e.repeat && killcam.active && !player.alive) skipKillcam();
  if ((e.code === "Space" || e.code === "Enter") && !e.repeat && matchIntro.active) matchIntro.skip();
  if (!e.repeat && !player.alive && royaleSpectating()) {
    if (e.code === "ArrowLeft" || e.code === "KeyA" || e.code === "KeyQ") cycleSpectate(-1);
    if (e.code === "ArrowRight" || e.code === "KeyD" || e.code === "KeyE") cycleSpectate(1);
  }
  // Pause with other people still live in the match keeps gameState at
  // "playing" (see openPauseMenu) so their match doesn't stall, so these
  // action keys need their own guard now instead of relying on gameState.
  if (!localPauseOnly) {
    if (e.code === "KeyR") tryReload();
    if ((e.code === "KeyA" || e.code === "KeyD") && !e.repeat) {
      const now = performance.now() / 1000;
      if (now - swivelTaps[e.code] < SWIVEL_TAP) { trySwivel(e.code === "KeyA" ? -1 : 1); swivelTaps[e.code] = 0; }
      else swivelTaps[e.code] = now;
    }
    if (e.code === "KeyT" && !e.repeat) startInspect();
    if (e.code === "KeyV" && !e.repeat) swingMelee();
    if (e.code === "KeyE" && !e.repeat) useHeroAbility();
    if (e.code === "KeyB" && !e.repeat) toggleThirdPerson();
    if (e.code === "Digit1") switchWeapon("primary");
    if (e.code === "Digit2") switchWeapon("secondary");
    // Not mid-streak: it would yank the tablet/marker out of your hands.
    if (e.code === "Digit3" && player.holding !== "streak") setHolding("melee");
    // One key per streak row (4 = top). A single "call the priciest" key
    // fired the hunter-killer whenever you meant the care package.
    // Troll Royale has no streaks: 4 puts a plate on, 5 uses Hopium.
    if (royale && (e.code === "Digit4" || e.code === "Digit5") && !e.repeat) startRoyaleAct(e.code === "Digit4" ? "plate" : "heal");
    else if (/^Digit[4-7]$/.test(e.code) && !e.repeat) callStreakSlot(+e.code.slice(5) - 4);
    // G throws whatever throwable you brought (one slot: lethal OR tactical).
    if (e.code === "KeyG" && !e.repeat) startCook(carriedThrowSlot());
    // F is plant/defuse while you're somewhere you can do either (S&D);
    // everywhere else it's the tactical.
    if (e.code === "KeyF" && !e.repeat && !(isSnd() && sndCanInteract)) startCook("tactical");
  }
  // Range-only live tuning, so a sensitivity change can be felt immediately.
  if (isRange() && gameState === "playing" && !localPauseOnly) {
    if (e.code === "Minus") nudgeSetting("sens", -5, 0, 200);
    if (e.code === "Equal") nudgeSetting("sens", 5, 0, 200);
    if (e.code === "BracketLeft") nudgeSetting("fov", -1, 60, 100);
    if (e.code === "BracketRight") nudgeSetting("fov", 1, 60, 100);
    if (e.code === "KeyN" && !e.repeat) spawnRangeBot();
  }
  if (e.code === "Space" && gameState === "playing" && !localPauseOnly) e.preventDefault();
  if (e.code === "Tab" && gameState === "playing" && !localPauseOnly && isPvp()) {
    e.preventDefault();
    renderScoreboard();
    els.scoreboard.hidden = false;
  }
});
window.addEventListener("blur", () => { cancelCook(); emoteWheel.close(true); });
window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
  if (e.code === "Tab") els.scoreboard.hidden = true;
  if ((e.code === "KeyG" && cooking.slot)
    || (e.code === "KeyF" && cooking.slot === "tactical")) releaseCook();
});

/* Kills, deaths, assists and K/D per operator. Team modes list each side
   under its score; free-for-all modes have no sides worth showing, so it's
   one ranking. Bots don't earn assists, so theirs read as a dash. */
/* Rank in front of a scoreboard name (prestige phase 2): the owner's badge,
   else the prestige or rank icon and the Troll Forces level. */
function rankChip(r) {
  if (r.owner) return `<span class="to-sb-rank"><i class="is-owner to-sb-owner">Owner</i></span>`;
  if (!r.level) return "";
  return `<span class="to-sb-rank">${playerIconSvg(r.level, r.prestige, 18)}<b>${r.level}</b></span>`;
}

function renderScoreboard() {
  const rows = [{
    name: `${withClan(playerName(), getMyCard().clan)} (you)`, team: net.team, you: true, uid: playerUid(),
    kills: player.kills | 0, deaths: player.deaths | 0, assists: player.assists | 0,
    level: getLevel(), prestige: getPrestige(), owner: isOwner(),
  }];
  for (const p of net.peers.values()) {
    if (String(p.id).startsWith("streak-")) continue;   // drones and gunships aren't players
    rows.push({
      name: withClan(p.name, p.clan), team: p.team, you: false, uid: safeUid(p.uid),
      kills: p.kills | 0, deaths: p.deaths | 0, assists: isBotPeer(p) ? null : (p.assists | 0),
      level: p.level, prestige: p.prestige | 0, owner: !!p.owner,
    });
  }
  // Most kills first; fewer deaths breaks a tie.
  const rank = (a, b) => (b.kills - a.kills) || (a.deaths - b.deaths);
  const cols = `<span>K</span><span>D</span><span>A</span><span>K/D</span>`;
  const row = (r, place = null) => `<div class="to-sb-row${r.you ? " is-you" : ""}">`
    + `<span>${place != null ? `<b>${place}.</b> ` : ""}${rankChip(r)}${r.uid
      ? `<button type="button" class="to-sb-name" data-uid="${r.uid}" title="View profile">${escapeHtml(r.name)}</button>`
      : escapeHtml(r.name)}</span>`
    + `<span>${r.kills}</span><span>${r.deaths}</span><span>${r.assists ?? "–"}</span>`
    + `<span>${(r.kills / Math.max(1, r.deaths)).toFixed(2)}</span></div>`;

  let html = "";
  if (currentMode().ffa) {
    const all = rows.sort(rank);
    html += `<div class="to-sb-team"><div class="to-sb-head">`
      + `<span>${escapeHtml(currentMode().name)}</span>${cols}</div>`;
    html += all.map((r, i) => row(r, i + 1)).join("");
    html += `</div>`;
  } else {
    for (const teamId of ["phantom", "ghost"]) {
      const team = TEAMS[teamId];
      const members = rows.filter((r) => r.team === teamId).sort(rank);
      html += `<div class="to-sb-team"><div class="to-sb-head">`
        + `<span style="color:${team.ui}">${teamName(teamId)} · ${teamScores[teamId]}</span>${cols}</div>`;
      html += members.length
        ? members.map((r) => row(r)).join("")
        : `<div class="to-sb-row"><span>—</span></div>`;
      html += `</div>`;
    }
  }
  els.scoreboard.innerHTML = html;
}

// Peer names come off the wire, so they are never trusted as markup.
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

let mouseDown = false, adsHeld = false;
renderer.domElement.addEventListener("mousedown", (e) => {
  if (!controls.isLocked) {
    // In play without the mouse (a refused re-lock, or resumed on a pad):
    // a click on the game takes it back instead of doing nothing.
    if (!isTouch && gameState === "playing" && els.pause.hidden) controls.lock();
    return;
  }
  if (strikeTablet?.isOpen) {
    if (e.button === 0) strikeTablet.place();
    else if (e.button === 2) strikeTablet.undo();
    return;
  }
  // Emote wheel open: a click plays what's hovered, a right click closes.
  if (emoteWheel.isOpen) {
    if (e.button === 0) emoteWheel.close();
    else if (e.button === 2) emoteWheel.close(true);
    return;
  }
  // Troll Royale, out: a click is next, a right click the one before.
  if (!player.alive && royaleSpectating() && (e.button === 0 || e.button === 2)) { cycleSpectate(e.button === 0 ? 1 : -1); return; }
  if (e.button === 0) mouseDown = true;
  if (e.button === 2) adsHeld = true;   // PF parity: right mouse aims
});
window.addEventListener("mouseup", (e) => {
  if (e.button === 0) mouseDown = false;
  if (e.button === 2) adsHeld = false;
});
renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
// Belt and braces for style.css's no-select rule: no drag of any image or
// link, no selection start or long-press menu outside a typing field.
const typingField = (t) => !!t?.closest?.("input, textarea, [contenteditable='true']");
document.addEventListener("dragstart", (e) => e.preventDefault());
document.addEventListener("selectstart", (e) => { if (!typingField(e.target)) e.preventDefault(); });
document.addEventListener("contextmenu", (e) => { if (!typingField(e.target)) e.preventDefault(); });

initTouch();

let mouseLookAt = -Infinity;
let aimAssistSticky = false;   // crosshair is on a target this frame (read by the mouse handler)

let hitFlashT = 0;

/* Whatever the bullets are allowed to hit this frame. Hoisted out of the
   frame loop because melee and blasts need the same list. */
let targetMeshes = [];
let hitboxLab = null;   // localhost ?hitbox=1 only (hitbox-lab.js)
initThrowables();

let saberDeflectT = 0;
let saberFlick = 0;
let saberWasShown = false;
let meleeDrawT = 0;
let meleeDrawLen = MELEE_DRAW_TIME;
let saberHavePrevTip = false;
initMelee();

// -------------------- the test range --------------------

/* The whole point of the range: say exactly what that round did, at what
   distance, so a sensitivity or FOV change can be judged on evidence. */
function reportRangeShot(target, info, dropped = false) {
  if (!els.rangeShot) return;
  const dist = info.distance != null ? info.distance : target.distance;
  els.rangeShot.textContent =
    `${info.isHead ? "HEADSHOT" : "HIT"} · ${Math.round(dist)} m · ${Math.round(info.damage)} dmg${dropped ? " · DOWN" : ""}`;
  els.rangeShot.classList.remove("is-new");
  void els.rangeShot.offsetWidth;
  els.rangeShot.classList.add("is-new");
}

function updateRangeHud() {
  if (!els.rangeSens) return;
  els.rangeSens.textContent = `${settings.sens}%`;
  els.rangeFov.textContent = `${settings.fov}°`;
}

/* Sensitivity and FOV are adjustable without unlocking the mouse, because
   the only honest way to judge either is while you are actually aiming. */
function nudgeSetting(key, delta, min, max) {
  settings[key] = Math.max(min, Math.min(max, settings[key] + delta));
  applySettings();
  saveSettings();
  updateRangeHud();
}

// -------------------- game flow --------------------

let gameState = "menu"; // menu | playing | paused | gameover
let elapsedRun = 0;

// True while the pause menu is open in a match that has other real people
// in it. Unlike a solo `gameState = "paused"` (which stops the whole
// simulation block below), this leaves gameState at "playing" so net
// updates, the bot host's bot sim, remote interpolation and in-flight
// bullets all keep running for everyone else in the room — only this
// client's own movement/aim/fire freezes, the same way a dead or
// pre-match player already freezes via the `frozen` flag in updatePlayer.
let localPauseOnly = false;
function openPauseMenu() {
  // Esc out of a half-placed streak instead of opening the menu — the point
  // isn't committed yet and the charge hasn't been spent.
  if (markingStreak) { cancelMark(); return; }
  releaseHeldInputs();
  renderPauseRange();
  renderRoomModeRow();
  if (otherHumansInMatch()) {
    localPauseOnly = true;
    els.pause.hidden = false;
  } else {
    gameState = "paused";
    els.pause.hidden = false;
  }
}
function closePauseMenu() {
  localPauseOnly = false;
  if (gameState === "paused") gameState = "playing";
  els.pause.hidden = true;
  clearTimeout(resumeTimer);
  setResumeLabel(null);
  // Whatever was held when the menu opened was released then; anything
  // pressed while it was up (keys typed into it) must not leak into play.
  releaseHeldInputs();
}

/* Everything "held" as of now, let go: movement keys, trigger, ADS. The
   menu steals keyup/mouseup (they land on the overlay, or the tab lost
   focus), so without this you'd come back running, firing or scoped. */
function releaseHeldInputs() {
  keys.clear();
  mouseDown = false;
  adsHeld = false;
  if (typeof gamepadState !== "undefined") { gamepadState.firing = false; gamepadState.ads = false; gamepadState.jump = false; }
}

/* Resume (the button, Start on a pad, Enter). Desktop resumes by taking the
   mouse back; Chrome refuses that for ~1s after Esc released it, which used
   to make the first Resume click do nothing at all. Now it waits out the
   cooldown on its own ("Resuming…") and, if the lock is still refused,
   drops the menu anyway so a click on the game picks the mouse up. */
let resumeTimer = 0;
const RELOCK_COOLDOWN = 1150;
function resumePlay() {
  if (isTouch) { closePauseMenu(); return; }
  clearTimeout(resumeTimer);
  const wait = RELOCK_COOLDOWN - (performance.now() - lockChangedAt);
  const attempt = () => {
    controls.lock().then(() => {
      // Some browsers resolve without locking (no promise support): the
      // lock event closes the menu when it really happens.
    }).catch(() => {
      setResumeLabel(null);
      closePauseMenu();
      showWaveBanner("Click to take the mouse back", 1600);
    });
  };
  if (wait > 0) {
    setResumeLabel("Resuming…");
    resumeTimer = setTimeout(attempt, wait);
  } else attempt();
}

function setResumeLabel(text) {
  if (!els.resumeBtn) return;
  els.resumeBtn.textContent = text || "Resume";
  els.resumeBtn.disabled = !!text;
}

/* The local player as the wire sees them. Shared by the match loop and the
   intermission, which keeps broadcasting so the room doesn't time us out
   (PEER_TIMEOUT is 5s and an intermission runs for 20). */
// net.update() only actually sends this at 15Hz, but it used to get a fresh
// object every animate() frame at 60Hz regardless — three throwaway objects
// for every one that ships. One reused object costs nothing to overwrite.
const _netSnapshot = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, stance: null, moving: false, ads: 0, hp: 0, alive: true, weapon: null, skin: null, kills: 0 };
function netSnapshot() {
  _netSnapshot.x = move.pos.x; _netSnapshot.y = move.pos.y; _netSnapshot.z = move.pos.z;
  // Under the glider everyone else sees the wing's heading, not your look.
  _netSnapshot.yaw = royale?.me === "glide" && royale.flight ? royale.flight.heading : look.yaw;
  _netSnapshot.pitch = look.pitch;
  _netSnapshot.stance = move.stance; _netSnapshot.moving = move.moving;
  _netSnapshot.ads = player.holding === "gun" ? currentWeapon()?.adsT || 0 : 0;
  _netSnapshot.reload = player.holding === "gun" ? localReloadK() : 0;
  _netSnapshot.reloadTime = currentWeapon()?.reloadTime || 2.3;
  _netSnapshot.hp = player.hp; _netSnapshot.alive = player.alive;
  // Socialize: nothing in hand, so everyone else sees empty hands too.
  _netSnapshot.weapon = socialUnarmed() ? null
    : player.holding === "melee" && player.melee
    ? player.melee.def.id
    : (player.holding === "gun" ? currentWeapon()?.def.id : null) || player.weaponId;
  // The skin of whatever that is, so everyone else sees the same gun.
  _netSnapshot.skin = (player.holding === "gun" ? currentWeapon()?.def.attachments?.skin : null) || null;
  _netSnapshot.kills = player.kills;
  _netSnapshot.deaths = player.deaths;
  _netSnapshot.assists = player.assists;
  _netSnapshot.emote = emote ? emoteCode(emote.idx, emote.role) : 0;
  _netSnapshot.block = saberBlock.active;
  _netSnapshot.roll = royaleRollK();
  _netSnapshot.drop = royaleDropCode();
  _netSnapshot.face = cosmetics.face;
  _netSnapshot.level = getLevel();
  _netSnapshot.prestige = getPrestige();
  _netSnapshot.owner = isOwner();
  { const c = getMyCard(); _netSnapshot.clan = c.clan; _netSnapshot.card = c.card; }
  _netSnapshot.hero = heroActive() ? hero().wireId() : null;
  _netSnapshot.swivel = swivel.seq ? swivel.seq * (swivel.dir || swivel.lastDir || 1) : 0;
  // The saloon bar (Socialize): drink, a sip, the apron.
  const social = isSocial();
  _netSnapshot.drink = social ? drinkCode(bar.drink) : 0;
  _netSnapshot.sip = social && bar.sipT > 0;
  _netSnapshot.role = social ? roleCode(bar.role) : null;
  // Phase 2: the seat we're in, the tune we're playing.
  _netSnapshot.seat = social && seated ? seated.idx + 1 : 0;
  _netSnapshot.piano = social && piano.playing ? piano.tune + 1 : 0;
  return _netSnapshot;
}

/* Everyone currently standing in the world, us included. Spawn scoring and
   the bot targeting both need this; they just filter it differently.

   Bots are included here too — spawnForTeam leans on this list to keep
   people apart, and in solo/bot-filled matches almost everyone on the field
   *is* a bot. Leaving them out made the anti-clump scoring blind to the
   very occupants it was supposed to be spacing out. */
function occupants() {
  const list = [];
  if (player.alive && !royaleDropView()) {
    list.push({ id: net.id, team: net.team, pos: move.pos, yaw: look.yaw });
  }
  for (const rp of remotes.byId.values()) {
    if (!rp.alive) continue;
    list.push({ id: rp.netId, team: rp.team, pos: rp.pos, yaw: rp.yaw ?? 0 });
  }
  for (const b of bots.bots) {
    if (!b.alive || b.airborne) continue;
    list.push({ id: b.id, team: b.team, pos: b.pos, yaw: b.yaw ?? 0 });
  }
  return list;
}

/* Spawn points that recently got someone killed, so we can stop feeding
   players back into a camped corner. Keyed by spawn index. */
const spawnDeaths = new Map();
const SPAWN_DEATH_MEMORY = 20;    // seconds a death keeps counting against a point
const SPAWN_SAFE_RADIUS = 18;     // an enemy nearer than this is a real threat
const SPAWN_VIEW_CONE = Math.cos(THREE.MathUtils.degToRad(50));
const SPAWN_TOLERANCE = 25;       // spawns within this of the best are all "safe enough"
const SPAWN_GUARD = 1.5;          // seconds of respawn protection; ends the moment you fire

// Teammate spacing, Black Ops 2 style: a team spawns loosely spread across
// its side of the map rather than stacked on whoever's nearest. Too close
// is penalized outright (that's how two people end up standing on top of
// each other), and the reward band sits well out from the min so the "best"
// spot is genuinely spread, not just the least-bad crowd.
const SPAWN_MATE_TOO_CLOSE = 10;  // stacking distance — actively bad
const SPAWN_MATE_SWEET_LO = 20;   // reward band: far enough to feel spread...
const SPAWN_MATE_SWEET_HI = 35;   // ...but still the same fight, not the far side of the map

function notePointDeath(x, z) {
  const pts = builtMap?.spawnPoints;
  if (!pts) return;
  let bestI = -1, bestD = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - x, pts[i].z - z);
    if (d < bestD) { bestD = d; bestI = i; }
  }
  // Only blame the spawn if the death happened close enough to be its fault.
  if (bestI >= 0 && bestD < 12) spawnDeaths.set(bestI, performance.now());
}

/* Which half of the map a team spawns on. Team modes pin Phantoms to one
   side and Ghosts to the other; Search & Destroy pins by *role* instead, so
   the attackers always walk in from the same end toward sites that
   pickBombSites put on the defenders' half — and sides swap with roles at
   halftime, as in CoD. */
function spawnSideFor(team) {
  if (isSnd()) return team === sndAttackTeam ? "lo" : "hi";
  return team === "ghost" ? "hi" : "lo";
}

/* True from the moment a match is set up until the countdown clears: the
   opening spawn is always on your own side. After that, respawns may use
   any point and your side is only a preference — CoD-style dynamic spawns,
   which is what stops a team being farmed at its own doorstep. */
let spawnOpening = false;
const SPAWN_SIDE_BONUS = 35;

/* Candidate points are the team's side (split by position — see
   splitSpawnSides; the old list-index split interleaved the teams round the
   perimeter), or the whole ring for a mid-match respawn.

   Within that set the point is *scored* rather than picked at random: a
   uniform pick will happily drop you on top of someone who has been farming
   that corner, and with a 4s respawn that is the fastest way to make a match
   miserable. Enemies nearby, enemies looking this way and recent deaths all
   push a point down; nearby friendlies and being on your own side pull it up. */
function spawnForTeam(team, forId = net.id, { sideOnly = spawnOpening || isSnd(), groundOnly = false } = {}) {
  const pts = builtMap.spawnPoints;
  if (!pts?.length) return { x: 0, y: 0, z: 0 };
  const ffa = !!currentMode().ffa;
  const own = new Set(!ffa && spawnSides ? spawnSides[spawnSideFor(team)] : pts.map((_, i) => i));
  let candidates = sideOnly ? [...own] : pts.map((_, i) => i);
  // Bots spawn on the ground floor: they take the stairs fine now (bots.js
  // planStair), but a bot dropped in an upstairs room (Undergrin's ticket
  // hall) still opens the match far from the fight.
  if (groundOnly || bots.byId?.(forId)) {
    const ground = candidates.filter((i) => (pts[i].y || 0) < 3);
    if (ground.length) candidates = ground;
  }

  // Never score against ourselves: the corpse we're respawning from would
  // read as a nearby "teammate" and pull us straight back to where we died.
  const others = occupants().filter((o) => o.id !== forId);
  const now = performance.now();
  let best = null, bestScore = -Infinity;
  const scored = [];

  for (const i of candidates) {
    const sp = pts[i];
    let score = !ffa && own.has(i) ? SPAWN_SIDE_BONUS : 0;

    for (const o of others) {
      const dx = sp.x - o.pos.x, dz = sp.z - o.pos.z;
      const d = Math.hypot(dx, dz);
      // In a free-for-all everyone still standing is an enemy.
      const enemy = currentMode().ffa || o.team !== team;

      if (!enemy) {
        // Being right on top of a teammate is bad in its own right — one
        // stray grenade or a burst that overpenetrates gets both of you.
        if (d < SPAWN_MATE_TOO_CLOSE) score -= 60 * (1 - d / SPAWN_MATE_TOO_CLOSE);
        // The reward band is a plateau, not a single point, so many spawns
        // qualify as "well spread" rather than the field collapsing onto one
        // ideal ring around each teammate.
        else if (d < SPAWN_MATE_SWEET_LO) score += 10 * ((d - SPAWN_MATE_TOO_CLOSE) / (SPAWN_MATE_SWEET_LO - SPAWN_MATE_TOO_CLOSE));
        else if (d <= SPAWN_MATE_SWEET_HI) score += 10;
        else score += 10 * Math.max(0, 1 - (d - SPAWN_MATE_SWEET_HI) / 30);
        continue;
      }
      if (d < SPAWN_SAFE_RADIUS) score -= 140 * (1 - d / SPAWN_SAFE_RADIUS);
      // Being inside their view cone is worse than merely being close.
      if (d < 45 && d > 0.01) {
        const fx = -Math.sin(o.yaw), fz = -Math.cos(o.yaw);
        if ((dx / d) * fx + (dz / d) * fz > SPAWN_VIEW_CONE) score -= 70 * (1 - d / 45);
      }
    }

    const died = spawnDeaths.get(i);
    if (died && now - died < SPAWN_DEATH_MEMORY * 1000) {
      score -= 90 * (1 - (now - died) / (SPAWN_DEATH_MEMORY * 1000));
    }

    scored.push({ sp, score });
    if (score > bestScore) { bestScore = score; best = sp; }
  }

  // Pick at random among the spawns that are *near enough* to the best rather
  // than always taking the winner. Safety is a threshold, not a ranking, and
  // an always-optimal choice is a predictable one — which is the camping
  // problem again from the other side.
  const good = scored.filter((s) => s.score >= bestScore - SPAWN_TOLERANCE);
  const pick = good[Math.floor(Math.random() * good.length)];
  return spreadSpawn(pick?.sp || best || pts[0], forId, others);
}

/* Nobody spawns on top of anybody (user, 2026-10-05). A map has a handful
   of spawn points and a room holds 22, so players and bots were dropped on
   the very same spot: bodies inside each other, and two FFA bots on one
   point stood there all match. The point picked above is where you come
   in; this finds a free spot of your own right round it, so a side still
   comes in together, a few steps apart. Spots handed out in the last
   couple of seconds count as taken too: a whole team spawning in one frame
   isn't standing on them yet. */
const SPAWN_GAP = 1.3;         // metres between two people's spawn spots
const SPAWN_RINGS = [1.6, 3, 4.4];
const SPAWN_CLAIM_MS = 2500;
const spawnClaims = [];        // { id, x, z, at }
const _spawnFrom = new THREE.Vector3(), _spawnTo = new THREE.Vector3();
function spreadSpawn(sp, forId, others) {
  const now = performance.now();
  while (spawnClaims.length && now - spawnClaims[0].at > SPAWN_CLAIM_MS) spawnClaims.shift();
  const y = sp.y || 0;
  // You, even before you count as alive (a match opening behind its
  // loading screen), so a bot filling in late doesn't land on you.
  const me = forId !== net.id ? move.pos : null;
  const taken = (x, z) => others.some((o) => Math.hypot(o.pos.x - x, o.pos.z - z) < SPAWN_GAP)
    || (me && Math.hypot(me.x - x, me.z - z) < SPAWN_GAP)
    || spawnClaims.some((c) => (forId == null || c.id !== forId) && Math.hypot(c.x - x, c.z - z) < SPAWN_GAP);
  const standable = (x, z) => {
    if (x < ARENA.minX + 0.6 || x > ARENA.maxX - 0.6 || z < ARENA.minZ + 0.6 || z > ARENA.maxZ - 0.6) return false;
    if (ARENA.edge && !insidePolygon(ARENA.edge, x, z)) return false;
    if (ARENA.wade && insidePolygon(ARENA.wade, x, z)) return false;
    // Same floor as the point (not up on a crate or a ledge), nothing to
    // stand inside, and in sight of the point, not through a wall.
    if (Math.abs(groundHeightAt(colliders, x, z, y + 0.5, 0.45) - y) > 0.3) return false;
    for (const c of colliders) {
      if (c.max.y <= y + 0.4 || c.min.y > y + 1.9) continue;
      if (x > c.min.x - 0.45 && x < c.max.x + 0.45 && z > c.min.z - 0.45 && z < c.max.z + 0.45) return false;
    }
    return !segmentBlocked(colliders, _spawnFrom.set(sp.x, y + 1.2, sp.z), _spawnTo.set(x, y + 1.2, z));
  };
  let at = null;
  if (!taken(sp.x, sp.z)) at = { x: sp.x, z: sp.z };
  const a0 = Math.random() * Math.PI * 2;
  for (const r of SPAWN_RINGS) {
    if (at) break;
    const n = Math.round(r * 4);
    for (let k = 0; k < n && !at; k++) {
      const a = a0 + (k / n) * Math.PI * 2;
      const x = sp.x + Math.cos(a) * r, z = sp.z + Math.sin(a) * r;
      if (!taken(x, z) && standable(x, z)) at = { x, z };
    }
  }
  // Packed solid round the point (it shouldn't be, with 22): the point it is.
  if (!at) at = { x: sp.x, z: sp.z };
  const i = forId == null ? -1 : spawnClaims.findIndex((c) => c.id === forId);
  if (i >= 0) spawnClaims.splice(i, 1);
  spawnClaims.push({ id: forId, x: at.x, z: at.z, at: now });
  return new THREE.Vector3(at.x, y, at.z);
}

function teamSpawn(opts) { return spawnForTeam(net.team, net.id, opts); }
/* Where a bot comes in: ground floor only (see groundOnly). */
// `id ?? null`: a bot filled in has no id yet, and undefined would take
// spawnForTeam's default (yours), so it skipped you and landed on you.
const botSpawn = (team, id, opts = {}) => spawnForTeam(team, id ?? null, { ...opts, groundOnly: true });

// Capped so a player mashing the button in the range can't spawn an
// unbounded crowd — plenty to look at, cheap enough to never matter.
const RANGE_BOT_CAP = 6;

/* "Spawn a bot" button in the Test Range HUD — the only way to get other
   visible characters into the range, which otherwise never has anyone in
   it. Harmless: these bots aim at the player (real steering/animation
   variety) but never actually deal damage, since onShoot is a no-op in
   the range's own per-frame bot update below. */
function spawnRangeBot() {
  if (!isRange() || !net.isBotHost()) return;
  if (bots.count >= RANGE_BOT_CAP) { showWaveBanner("Range is full — kill one first", 1800); renderPauseRange(); return; }
  bots.fill(bots.count + 2, 1, botSpawn, true);
  for (const b of bots.bots) net.publishBot(b);
  showWaveBanner(`Bot ${bots.count} in the range`, 1800);
  renderPauseRange();
}

function clearRangeBots() {
  if (!isRange() || !net.isBotHost()) return;
  for (const b of bots.bots) net.dropBot(b.id);   // takes their rigs down too
  bots.clear();
  renderPauseRange();
}

/* The HUD's "Spawn a bot" can't be clicked on desktop: the HUD only shows
   while the mouse is locked to aiming, and Esc opens this menu on top. So
   the range's bot controls live here too (and on the N key). */
function renderPauseRange() {
  const box = els.pauseRange;
  if (!box) return;
  box.hidden = !isRange();
  if (box.hidden) return;
  const n = bots.count;
  els.pauseSpawnBot.textContent = n >= RANGE_BOT_CAP ? `Range full (${n}/${RANGE_BOT_CAP})` : `Spawn a bot (${n}/${RANGE_BOT_CAP})`;
  els.pauseSpawnBot.disabled = n >= RANGE_BOT_CAP;
  els.pauseClearBots.disabled = n === 0;
}

/* Everything a bot could shoot at: us, other humans, and other bots. */
function botTargets() {
  const list = [];
  for (const o of occupants()) {
    // No point emptying a magazine into someone spawn protection is going to
    // shrug off — and it would look like the bot is broken.
    if (o.id === net.id && player.spawnGuard > 0) continue;
    // `melee`: only carrying a sword (Infection's infected), so worth
    // backing away from rather than holding ground against.
    // `blocking`: a Trollsaber guard up, which bots respect (bots.js
    // isGuarding) instead of emptying magazines into it.
    let blocking = false;
    if (o.id === net.id) blocking = saberBlock.active || kbShield.active;
    else {
      const rp = remotes.byId.get(o.id);
      blocking = !!(rp?.peer.blocking && rp.saberOut);
    }
    list.push({ id: o.id, team: o.team, alive: true, pos: o.pos, groundY: o.pos.y, yaw: o.yaw,
      melee: isInfection() && o.team === "ghost", blocking, blockCone: MELEE_DEFS.trollsaber.deflect.cone });
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
function remoteShotFx(origin, dir, weaponId, quiet = false, charge = 0) {
  let base = WEAPON_DEFS[weaponId] || WEAPON_DEFS.problem416;
  if (charge > 0 && base.charge) base = chargedShotDef(base, charge).def;
  audio.shot(quiet ? { ...base, quiet: true } : base, 0.8, origin);
  if (!quiet) impactFx.puff(origin, dir.lengthSq() > 0.001 ? dir.clone().normalize() : null);
  if (dir.lengthSq() < 0.001) return;
  // The Soul Blazer's fire out of someone else's skull (not across the map).
  if (base.hellfire && origin.distanceToSquared(camera.position) < 70 * 70) {
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
    bullets.spawn({ origin: origin.clone().addScaledVector(d, 0.6), dir: d, def: base, ownerId: "remote", cosmetic: true });
  }
}

const _botMuzzle = new THREE.Vector3();
const _botAim = new THREE.Vector3();

function onBotShoot(bot, target, dmg, isHead, hit, range = 30, usingSecondary = false) {
  const wid = (usingSecondary ? bot.secondaryId : bot.weaponId) || "problem416";
  if (royale) {
    dmg = royaleBotDamage(bot, dmg);
    if (bots.byId(target.id)) dmg *= royaleBotVsBot();
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
  killcam.noteShot(kcClock, bot.id, _botMuzzle, dir, wid);
  noteRigShot(bot.id);
  if (net.active) net.reportShotAs(bot.id, _botMuzzle, dir, wid);

  if (!hit) {
    if (target.id === net.id) nearMiss(0.45, bot.pos);
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
  const ffa = !!currentMode().ffa;
  for (const e of streakEntities.values()) {
    if (!(e instanceof SamTurret) || !e.alive) continue;
    const owner = e.botId || (e.owned ? net.id : null);
    if (ffa ? owner !== b.id : (e.botTeam || e.team) !== b.team) list.push({ id: e.id, pos: e.pos.clone().setY(e.pos.y + 1.1), e });
  }
  return list;
}
function updateBotAntiAir(dt) {
  if (isStaging()) return;
  for (const b of bots.bots) {
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
        if (raycastWorld(colliders, _aaEye, _aaDir, d) < d - 1.5) continue;
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
    if (net.active) net.reportShotAs(b.id, _botMuzzle, dir, wid);
    if (hit) {
      spawnImpactBurst(a.pos, 0xffd08a, 4);
      damageStreakEntity(a.e, diff.damage ?? 17, b.id);
    }
  }
}

/* Damage a bot we host deals to anyone: us, another of our bots, or a remote
   player (who applies it to themselves when the hit arrives). */
function botDealDamage(bot, targetId, dmg, isHead, wid) {
  if (targetId === net.id) { damagePlayer(dmg, bot.id, wid, isHead); return; }
  if (typeof targetId === "string" && targetId.startsWith("k9:")) {
    const j = targetId.lastIndexOf(":");
    const pack = streakEntities.get(targetId.slice(3, j));
    if (pack instanceof K9Pack) damageDog(pack, +targetId.slice(j + 1), dmg, bot.id);
    return;
  }
  flinchPeer(targetId, bot.id, isHead);

  if (bots.byId(targetId)) {
    const { killed, bot: victim } = bots.applyHit(targetId, dmg);
    if (killed) {
      bot.kills++;
      net.reportDeathAs(targetId, bot.id, wid, isHead);
      registerDeath(victim.name, bot.id, wid, {
        head: isHead, victimTeam: victim.team, victimIsBot: true,
        victimPos: victim.pos, victimWeaponId: victim.weaponId,
      });
    }
    return;
  }
  net.reportHitAs(bot.id, targetId, dmg, isHead, wid);
}

// A late joiner's Troll Royale catch-up (modes/royale.js applies it).
let royaleCatchUp = null;
initRoyale();

// -------------------- Infection --------------------
//
// Nobody hosts the match: every client turns itself when it dies, and its
// team rides out on the next state message. The one decision that has to be
// made once is who starts infected, so the bot host (lowest id, same as for
// bots) makes it and broadcasts an `infect` message. Every client counts
// the sides from what it sees and ends the match itself when no survivor is
// left, the same way score limits already work.

let infectionStarted = false;
let infectionT = 0;          // countdown to the first infection
let infectionCalled = false; // the "first infection in..." banner
let lastSurvivorCalled = false;
let reinfectT = 0;           // host: grace before replacing infected who all left
let noSurvivorsT = 0;        // how long the count has read zero survivors
let infectionShown = "";     // last counts painted into the HUD

function resetInfection() {
  infectionStarted = false;
  infectionT = INFECTION.firstDelay;
  infectionCalled = false;
  lastSurvivorCalled = false;
  reinfectT = 0;
  noSurvivorsT = 0;
  infectionShown = "";
  const inf = isInfection();
  // The last match's bots would otherwise sit in the peer map, still on the
  // sides they ended on, until they time out — long enough to be counted as
  // infected in a match nobody's been infected in yet.
  if (inf) for (const [id, p] of net.peers) if (isBotPeer(p)) { remotes.byId.get(id)?.dispose(); remotes.byId.delete(id); net.peers.delete(id); }
  els.namePhantom.textContent = inf ? "Survivors" : TEAMS.phantom.name;
  els.nameGhost.textContent = inf ? "Infected" : TEAMS.ghost.name;
  if (player.maxHp === INFECTION.hp) player.maxHp = 100;
  if (inf) net.setTeam("phantom");
}

/* Sword only, faster (see move.update), tougher. Survivors keep their kit. */
function applyInfectionLoadout() {
  if (!isInfection()) return;
  player.maxHp = isInfected() ? INFECTION.hp : 100;
  player.hp = Math.min(player.hp, player.maxHp);
  if (!isInfected()) return;
  cooking.def = null;
  cooking.slot = null;
  els.cook.hidden = true;
  player.gear.lethal = 0;
  player.gear.tactical = 0;
  setHolding("melee");
  updateGearHud();
}

function markInfectionStarted() {
  if (infectionStarted) return;
  infectionStarted = true;
  // The three minutes are for surviving, so they start now.
  matchClockT = currentMode().timeLimit;
  matchClockShown = -1;
  paintMatchClock();
}

/* Everyone in the match by side, from what this client can see. Survivors
   who are down still count: they're about to get up infected, and until
   their team flips they haven't. */
function infectionCounts() {
  let survivors = 0, infected = 0, lastName = null;
  const tally = (team, name) => {
    if (team === "ghost") infected++;
    else if (team === "phantom") { survivors++; lastName = name; }
  };
  tally(net.team, "You");
  for (const p of net.peers.values()) {
    if (String(p.id).startsWith("streak-")) continue;
    tally(p.team, p.name);
  }
  return { survivors, infected, lastName };
}

/* Host only: pick who starts infected and tell everyone. */
function pickFirstInfected() {
  const ids = [net.id];
  for (const p of net.peers.values()) {
    if (String(p.id).startsWith("streak-") || p.team === "ghost") continue;
    ids.push(p.id);
  }
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const chosen = ids.slice(0, ids.length >= INFECTION.twoFirstAt ? 2 : 1);
  if (net.active) net.send({ t: "infect", id: net.id, ids: chosen });
  applyInfect(chosen);
}

function applyInfect(ids) {
  if (!isInfection() || gameState !== "playing") return;
  markInfectionStarted();
  const others = [];
  for (const id of ids) {
    if (id === net.id) {
      if (net.team !== "ghost") {
        net.setTeam("ghost");
        applyInfectionLoadout();
        player.hp = player.maxHp;
      }
      showWaveBanner("YOU'RE INFECTED — cut them down", 2000);
      continue;
    }
    const b = bots.byId(id);
    if (b) infectBot(b);
    others.push(nameFor(id) || "someone");
  }
  if (others.length && !ids.includes(net.id)) {
    showWaveBanner(`${others.join(" & ")} ${others.length > 1 ? "are" : "is"} infected — run`, 2000);
  }
  audio.wave();
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
function sortInfectionBots() {
  for (const b of bots.bots) {
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
function botMelee(bot, target) {
  const def = MELEE_DEFS.keyboard;
  bot.meleeSwing = ((bot.meleeSwing | 0) + 1) & 1;
  const p = net.peers.get(bot.id);
  if (p) { p.meleeSeq = (p.meleeSeq | 0) + 1; p.meleeKind = bot.meleeSwing; p.meleeDef = def.id; }
  if (net.active) net.publishMeleeAs(bot.id, bot.meleeSwing, def.id);
  botDealDamage(bot, target.id, def.damage, false, def.id);
}

function paintInfectionCounts(c) {
  const shown = `${c.survivors}:${c.infected}`;
  if (shown === infectionShown) return;
  infectionShown = shown;
  teamScores.phantom = c.survivors;
  teamScores.ghost = c.infected;
  updateTeamHud();
}

function updateInfection(dt) {
  if (!infectionStarted) {
    paintInfectionCounts(infectionCounts());
    if (isStaging()) return;
    // Someone's already turned. On our first live tick that means we joined
    // a match under way, and a latecomer comes in infected; after that it's
    // just the host's message still on its way.
    if (infectionCounts().infected > 0) {
      if (!infectionCalled) { net.setTeam("ghost"); applyInfectionLoadout(); }
      infectionCalled = true;
      markInfectionStarted();
      return;
    }
    if (!infectionCalled) {
      infectionCalled = true;
      showWaveBanner(`First infection in ${INFECTION.firstDelay}s — spread out`, 1800);
    }
    infectionT -= dt;
    if (infectionT <= 0 && (net.isBotHost() || !net.active)) pickFirstInfected();
    return;
  }

  const c = infectionCounts();
  paintInfectionCounts(c);

  // Held for a moment before it counts: a peer's team can read wrong for a
  // message or two (they flipped, their next state is in flight).
  noSurvivorsT = c.survivors === 0 && c.infected > 0 ? noSurvivorsT + dt : 0;
  if (noSurvivorsT > 0.5) { endMatch("Infected win"); return; }

  if (c.survivors === 1 && !lastSurvivorCalled) {
    lastSurvivorCalled = true;
    showWaveBanner(net.team === "phantom" ? "LAST SURVIVOR — it's all on you" : `LAST SURVIVOR — ${c.lastName}`, 2200);
    audio.wave();
  }

  // Every infected left the room: the host starts it again rather than
  // handing the survivors a match with nobody to run from.
  if (c.infected === 0 && (net.isBotHost() || !net.active)) {
    reinfectT += dt;
    if (reinfectT > 3) { reinfectT = 0; pickFirstInfected(); }
  } else {
    reinfectT = 0;
  }
}

let hillHeldT = 0;   // seconds we've personally stood on the hill

function scoreHill() {
  let phantom = 0, ghost = 0;
  const tally = (team) => { if (team === "ghost") ghost++; else phantom++; };
  const onHill = player.alive && hill.contains(move.pos.x, move.pos.z);
  if (onHill) tally(net.team);
  for (const rp of remotes.byId.values()) {
    if (rp.alive && hill.contains(rp.pos.x, rp.pos.z)) tally(rp.team);
  }
  if (phantom > ghost) teamScores.phantom += phantom;
  else if (ghost > phantom) teamScores.ghost += ghost;
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

function siteUnderfoot() {
  for (const s of bombSites) if (Math.hypot(move.pos.x - s.x, move.pos.z - s.z) <= SND_SITE_RADIUS) return s;
  return null;
}

/* Who's still alive on each side, from our own state plus whatever the wire
   has told us about everyone else. Both sides need this every tick: an
   all-dead attacking team loses before the bomb goes off, an all-dead
   defending team loses the instant the bomb is live (no more need to defuse
   it — the fight for the site is already over). */
function isCarrierAlive() {
  if (!bomb.carrierId) return false;
  if (bomb.carrierId === net.id) return player.alive;
  return !!remotes.byId.get(bomb.carrierId)?.alive;
}

function livingAttackerIds() {
  const ids = [];
  if (player.alive && net.team === sndAttackTeam) ids.push(net.id);
  for (const rp of remotes.byId.values()) {
    if (rp.alive && rp.team === sndAttackTeam) ids.push(rp.netId);
  }
  return ids;
}

function sndAliveCounts() {
  let attackers = 0, defenders = 0;
  if (player.alive) { if (net.team === sndAttackTeam) attackers++; else defenders++; }
  for (const rp of remotes.byId.values()) {
    if (!rp.alive) continue;
    if (rp.team === sndAttackTeam) attackers++; else defenders++;
  }
  return { attackers, defenders };
}

function updateSnd(dt) {
  const isAttacker = net.team === sndAttackTeam;
  const wasPlanted = bomb.state === "planted";
  if (wasPlanted && bomb.update(dt)) {
    const s = bomb.siteAt(bomb.site);
    const at = new THREE.Vector3(s.x, (groundHeightAt(colliders, s.x, s.z, 1) ?? 0) + 0.5, s.z);
    explosionFx({ kind: "lethal", glow: 0xffb347, radius: 14 }, at);
    // The blast is the round-ender, not a weapon: it kills whoever stayed.
    if (player.alive && Math.hypot(move.pos.x - s.x, move.pos.z - s.z) < 9) damagePlayer(500, null, "bomb", false, at);
    sndRoundWin(sndAttackTeam, "bomb detonated");
  }

  // Status line: fuse once planted, otherwise the plant clock — and a callout
  // when someone else is on the bomb, which you'd hear in a real match.
  if (!sndRoundOver) {
    els.bombTimer.hidden = !sndLive;
    const planted = bomb.state === "planted";
    const secs = Math.ceil(planted ? bomb.fuse : sndClock);
    const text = planted ? `${secs}s` : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
    if (els.bombTimer.textContent !== text) els.bombTimer.textContent = text;
    els.bombTimer.classList.toggle("is-planted", planted);
    let side = planted
      ? (isAttacker ? `Defend the plant — site ${bomb.site}` : `Defuse site ${bomb.site}`)
      : (isAttacker ? (bomb.carrierId === net.id ? "You have the bomb" : "Plant the bomb") : "Defend the sites");
    if (remoteBombAct && remoteBombAct.until > performance.now() && !bomb.action) {
      side = remoteBombAct.kind === "plant" ? `Bomb being planted — site ${remoteBombAct.site}!` : "Bomb being defused!";
    }
    if (els.bombSide.textContent !== side) els.bombSide.textContent = side;
  }

  // Down players spectate the round out rather than respawning — S&D is one
  // life a round. The elimination check below still needs their team's alive
  // count, so this only stops the countdown text, not the tally.
  if (!player.alive) {
    if (!sndEliminated) {
      sndEliminated = true;
      els.respawnText.textContent = "Eliminated — waiting for the round";
      els.respawn.hidden = false;
    }
  } else if (player.spawnGuard > 0) {
    player.spawnGuard -= dt;
    if (player.spawnGuard <= 0) { player.spawnGuard = 0; updateSpawnGuardHud(); }
    else if (els.spawnGuard?.hidden) updateSpawnGuardHud();
  }

  if (sndRoundOver || !sndLive) return;
  sndLiveT += dt;

  // The plant clock. The bot host calls time and tells the room; everyone
  // else waits a beat for that call before deciding it themselves, so a
  // lost packet can't leave one client stuck in an expired round.
  if (bomb.state !== "planted") {
    sndClock = Math.max(0, sndClock - dt);
    if (sndClock <= 0) {
      if (!net.active || net.isBotHost()) {
        if (net.active) net.publishBomb({ kind: "event", action: "timeup" });
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
  if (sndLiveT > SND_GRACE && bomb.state !== "planted") {
    if (sndSeen.attackers > 0 && attackers <= 0) { sndRoundWin(sndDefendTeam(), "attackers eliminated"); return; }
    if (sndSeen.defenders > 0 && defenders <= 0) { sndRoundWin(sndAttackTeam, "defenders eliminated"); return; }
  }

  // The carrier died holding it: it doesn't need a physical pickup prop for
  // a first cut of this mode — it just passes to the next living attacker,
  // lowest id first, so every client picks the same one independently. Only
  // the bot host actually assigns it, same authority that owns bot state.
  if (bomb.state === "carried" && !isCarrierAlive() && (net.isBotHost() || !net.active)) {
    const next = pickCarrier();
    if (next && next !== bomb.carrierId) {
      bomb.carrierId = next;
      if (net.active) net.publishBomb({ kind: "event", action: "carrier", carrierId: next });
    }
  }

  // Plant/defuse: only the acting player's own client drives its own
  // progress, and only while a live interact press is actually held.
  const isCarrier = bomb.carrierId === net.id;
  const onSite = isAttacker && isCarrier && bomb.state === "carried" ? siteUnderfoot() : null;
  const canDefuse = !isAttacker && bomb.state === "planted" && siteUnderfoot()?.id === bomb.site;
  sndCanInteract = !!(onSite || canDefuse);
  const acting = player.alive && sndInteractHeld && (onSite || canDefuse);

  if (acting) {
    const kind = onSite ? "plant" : "defuse";
    const need = kind === "plant" ? PLANT_TIME : DEFUSE_TIME;
    if (!bomb.action || bomb.action.by !== net.id || bomb.action.kind !== kind) {
      bomb.action = { kind, by: net.id, progress: 0, site: onSite?.id };
    }
    bomb.action.progress += dt;
    els.bombPrompt.hidden = false;
    els.bombPromptText.textContent = kind === "plant" ? `Planting site ${onSite.id}…` : `Defusing…`;
    els.bombBarFill.style.width = `${Math.min(100, (bomb.action.progress / need) * 100)}%`;
    if (isPvp() && net.active) net.publishBomb({ kind: "action", action: kind, by: net.id, progress: bomb.action.progress, site: onSite?.id });

    if (bomb.action.progress >= need) {
      if (kind === "plant") {
        bomb.plant(onSite.id);
        audio.wave();
        showWaveBanner(`Bomb planted — site ${onSite.id}`, 1800);
        if (net.active) net.publishBomb({ kind: "event", action: "planted", site: onSite.id });
        awardScore(SCORE.plant);
        achievements.award("bombtech");
      } else {
        bomb.defuse();
        sndRoundWin(sndDefendTeam(), "bomb defused");
        if (net.active) net.publishBomb({ kind: "event", action: "defused" });
        awardScore(SCORE.defuse);
        achievements.award("bombtech");
      }
      bomb.action = null;
      els.bombPrompt.hidden = true;
    }
  } else if (bomb.action?.by === net.id) {
    // Let go, moved off the site, or died mid-plant — the attempt doesn't
    // carry over; the next hold starts the timer from zero, same as CoD.
    bomb.action = null;
    els.bombPrompt.hidden = true;
    if (isPvp() && net.active) net.publishBomb({ kind: "event", action: "cancel" });
  } else if (!bomb.action) {
    if (onSite) { els.bombPrompt.hidden = false; els.bombPromptText.textContent = `Plant (site ${onSite.id})`; els.bombBarFill.style.width = "0%"; }
    else if (canDefuse) { els.bombPrompt.hidden = false; els.bombPromptText.textContent = "Defuse"; els.bombBarFill.style.width = "0%"; }
    else els.bombPrompt.hidden = true;
  }

  if (net.isBotHost() || !net.active) updateSndBots(dt);
}

/* Gun Game and One in the Chamber force what you're holding and leave no
   secondary slot to scavenge into, so a dead player's gun in those modes
   isn't worth dropping — the ladder or the one-shot pistol already decides
   the next gun for everyone. */
function scavengeAllowed() {
  // Infection: the infected can't carry a gun, so nothing is worth dropping.
  // Troll Royale: everything on the ground is loot (royale.js), not a drop.
  return !weaponForMode(currentMode(), gunGameProgress) && !isInfection() && !isRoyale();
}

/* Drop whatever gun the player was holding right where they died, so
   another operator can scavenge it as a secondary. Melee kills, the range,
   and Gun Game/OITC never drop anything — you can't scavenge into a slot
   those modes don't give you. */
function dropCarriedWeapon() {
  if (!scavengeAllowed()) return;
  const w = currentWeapon();
  if (!w) return;
  pickups.drop(net.id, w.def, move.pos);
}

function equipFromLoadout() {
  const mode = currentMode();
  const forcedId = weaponForMode(mode, gunGameProgress);
  // Troll Royale: you land with a pistol and find the rest.
  const startId = mode.royale ? ROYALE.startWeapon : forcedId;
  let def = startId ? resolveWeapon(startId, defaultLoadoutFor(startId)) : loadout.resolved;
  if (mode.tuneWeapon) def = mode.tuneWeapon(def);
  player.weaponId = def.id;
  player.weapons = { [def.id]: new WeaponState(def) };
  if (!startId) {
    const secDef = loadout.resolvedSecondary;
    player.secondaryId = secDef.id;
    player.weapons[secDef.id] = new WeaponState(secDef);
  } else {
    player.secondaryId = null;
  }
  const meleeDef = heroActive() ? heroMeleeDef() : loadout.melee;
  player.melee = new MeleeState(meleeDef);
  setActiveMeleeMesh(meleeDef);
  currentWeaponSlot = "primary";
  player.holding = "gun";
  if (activeMeleeMesh) activeMeleeMesh.visible = false;
  refillGear();
  updateGearHud();
  return def;
}

/* Put everyone who didn't ask for a private room into the same public
   server for the mode they picked. Tries the base room first (QTDM, QKOH,
   ...); only spills into a numbered shard once the base room already has
   enough real people that MAX_PLAYERS would be exceeded, so a lone player
   never gets sharded off by themselves. Modes without a quickplay base
   (none currently) fall back to a private random room, same as before. */
async function joinQuickplay() {
  const base = QUICKPLAY_BASE[modeId];
  if (!base) {
    const code = makeRoomCode();
    return { code, kind: await net.start(code, { name: playerName(), mapId: loadout.mapId, uid: playerUid() }) };
  }
  for (let shard = 1; shard <= QUICKPLAY_MAX_SHARDS; shard++) {
    const code = shard === 1 ? base : `${base}${shard}`;
    setNetStatus(shard === 1 ? "Connecting…" : `Server full, trying another (${shard})…`);
    const kind = await net.start(code, { name: playerName(), mapId: loadout.mapId, uid: playerUid() });
    if (!kind) return { code, kind };   // real connectivity failure — retrying won't help
    // Real people only: a room's bots (mirrored into its peer list) would
    // otherwise make a busy Royale look full and shard every joiner away.
    const cap = isRoyale() ? MAX_PLAYERS_ROYALE : MAX_PLAYERS;
    if (net.humanCount <= cap || shard === QUICKPLAY_MAX_SHARDS) return { code, kind };
    net.stop();
  }
}

/* A stage message whose map this client should take: from a player who
   joined the room before us (so two newcomers can't swap maps back and
   forth), same mode, and a mode that lets you pick the map at all. */
function followsHostMap(m) {
  if (!m.map || !MAPS[m.map] || m.mode !== modeId || !isPvp()) return false;
  const mode = currentMode();
  if (mode.forceMap || mode.mapPool) return false;
  // The host's map, not just any older player's: a tab stuck on its loading
  // screen used to drag everyone onto its map (net.hostId).
  return net.peers.has(m.id) && net.hostId() === m.id;
}

async function startGame() {
  audio.resume();   // the click that got us here is the gesture Web Audio needs
  // View mode: the lobby's map, nobody in it (see isView).
  if (viewModeOn() && modeId !== "view") { viewPrevMode = modeId; modeId = "view"; }
  else if (!viewModeOn() && modeId === "view") modeId = viewPrevMode || "ops";
  // The click is the only gesture we get: take the mouse now, so the match
  // doesn't open on the pause screen after a long load.
  if (!isTouch) { try { controls.lock(); } catch { /* the pause screen catches it later */ } }
  roomMapHint = null;
  // Socialize is the one public hangout room: never a private code. The
  // room may already be playing a mode the owner switched it to; the host
  // says so while we connect (adoptRoomMode) and modeId follows.
  socialRoom = isSocial();
  roomModeSeq = net.modeSeq = 0;
  socialMapId = null;
  cancelSocialReturn();
  loadScreen.show(loadInfo(matchMapId()));
  els.title.hidden = true;
  if (isPvp()) {
    els.startBtn.disabled = true;
    setNetStatus("Connecting…");
    loadScreen.status(socialRoom ? "Finding the hangout…" : "Finding a match…");
    const result = els.room.value && roomIsCustom && !socialRoom
      ? { code: els.room.value, kind: await net.start(els.room.value, { name: playerName(), mapId: loadout.mapId, uid: playerUid() }) }
      : await joinQuickplay();
    els.startBtn.disabled = false;
    if (!result.kind) {
      loadScreen.hide();
      els.title.hidden = false;
      if (controls.isLocked) controls.unlock();
      socialRoom = false;
      setNetStatus("Couldn't reach the room. Try another code.", "bad");
      return;
    }
    if (!socialRoom) els.room.value = result.code;
    // The hangout is one side, so anyone can duo-emote with anyone.
    if (isSocial()) net.setTeam("phantom");
    else net.chooseTeam();
    chat.render();   // it was built before the room connected
    setNetStatus(`Live · ${result.kind} · room ${result.code} · ${teamName(net.team)}`, "live");
  } else {
    net.stop();
  }

  enterMatch(isPvp() ? roomMapHint : null);
}

/* -------------------- map loading screen --------------------

   Find Match → this screen (map-load-screen.js) → the countdown. It stays
   up until the map is built, downloaded and its shaders compiled, so the
   match runs smooth from its first frame on every device, however long
   that takes. Online it then waits until everyone in the room has loaded
   too (user: "game doesn't start until everyone loads in completely"), for
   up to LOAD_WAIT_MAX seconds once we're ready (see updateLoadScreen).

   The wire: every client sends "ready" (net.publishReady) about once a
   second while on this screen, ok:0 while loading, ok:1 once done. The
   host (net.isBotHost) starts the countdown when every player who speaks
   "ready" has sent ok:1 for its map; its countdown "stage" messages are the
   go for everyone else. A player arriving once the match is on gets a
   targeted go (net.publishGo) from the host when they finish. Players on an
   old cached page never send "ready", so they're not waited on. */
let loadHold = false;    // match set up under the loading screen; countdown frozen until "go"
let loadTarget = null;   // the map the screen is loading
let loadSeq = 0;         // bumped to cancel a superseded load (the room switched maps)
let loadPing = 0;        // seconds until the next "ready" resend

function loadInfo(id) {
  return { id, name: MAPS[id]?.name || "", blurb: MAPS[id]?.blurb || "", mode: currentMode().name };
}

async function enterMatch(mapHint = null) {
  const seq = ++loadSeq;
  loadWarm = false;
  loadHold = false;
  loadPing = 0;
  let id = matchMapId(mapHint);
  if (!loadScreen.isOpen) loadScreen.show(loadInfo(id));
  // Everyone re-reports for this match; old "done"s were for the last one.
  for (const p of net.peers.values()) p.readyMap = null;
  for (;;) {
    loadTarget = id;
    loadScreen.setMap(loadInfo(id));
    if (id !== loadedMapId) {
      const tick = () => {
        const st = mapPreload.status(id);
        loadScreen.progress(st.progress * 0.85);
        loadScreen.status(st.state === "compiling" ? "Building the map" : "Loading the map");
      };
      const off = mapPreload.onChange(tick);
      tick();
      try { await mapPreload.preload(id); } catch { /* loadMap builds it plainly */ } finally { off(); }
      if (seq !== loadSeq) return;
    }
    // The room may have told us its map while we loaded ours.
    const want = matchMapId(isPvp() ? (roomMapHint || mapHint) : mapHint);
    if (want === id) break;
    id = want;
  }
  loadHold = true;
  beginMatch(id);
  // Everything else the match will draw (bots, streak models, the gun),
  // compiled now rather than on the frame it first appears.
  loadScreen.progress(0.88);
  loadScreen.status("Warming up");
  await warmShaders();
  if (seq !== loadSeq) return;
  loadScreen.progress(1);
  loadScreen.status(isPvp() && net.active ? "Waiting for players" : "Ready");
  loadWarm = true;
}
let loadWarm = false;    // shaders done; only then do we tell the room we're ready

/* The loading screen comes down and the countdown runs. `left` adopts the
   host's clock; without one we keep the countdown beginMatch set. */
function releaseLoad(left = 0) {
  if (!loadHold) return;
  loadHold = false;
  loadWarm = false;
  loadTarget = null;
  if (left > 0 && isStaging()) { stageT = left; stageShown = -1; }
  loadScreen.hide();
  calibratePadRest();   // nobody should be pushing the stick on the loading screen
  if (!isTouch && gameState === "playing") {
    try { controls.lock(); } catch { /* refused — the pause screen catches it */ }
    setTimeout(() => {
      if (gameState === "playing" && !controls.isLocked && !loadScreen.isOpen) openPauseMenu();
    }, 260);
  }
}

/* Four times a second while the loading screen is up — on a timer rather
   than the frame loop, so a player who tabs away mid-load (no frames in a
   background tab) keeps reporting in instead of timing out of the room. */
let loadClock = performance.now();
setInterval(() => {
  const now = performance.now();
  updateLoadScreen(Math.min(2, (now - loadClock) / 1000));
  loadClock = now;
}, 250);
function updateLoadScreen(dt) {
  if (!loadScreen.isOpen) return;
  const online = isPvp() && net.active;
  const done = loadHold && loadWarm;
  if (online) {
    net.prune();
    loadPing -= dt;
    if (loadPing <= 0 && loadTarget) { loadPing = 1; net.publishReady(loadTarget, modeId, done); }
  }
  if (!done) { loadWaitT = 0; return; }
  if (!online) { releaseLoad(); return; }
  const others = [...net.peers.values()].filter((p) => !isBotPeer(p) && p.lr);
  const n = others.filter((p) => p.readyMap === loadedMapId).length;
  // A time limit on the wait (user, 2026-10-04: "add a timeout for the
  // slowest player wait"; it had none). Counted from when we were ready.
  // The host starts without whoever is still loading once it runs out;
  // they're let in the moment they finish (onReady's publishGo, the same
  // way as a latecomer). A slow host is the other half: the rest start on
  // their own a while later, and adopt its countdown once it arrives.
  loadWaitT += dt;
  const host = net.isBotHost();
  const limit = host ? loadWaitMax : loadWaitMax + LOAD_WAIT_CLIENT_EXTRA;
  const left = Math.max(0, Math.ceil(limit - loadWaitT));
  loadScreen.status(others.length ? `Waiting for players ${n + 1}/${others.length + 1} · starting in ${left}s` : "Ready");
  if (host && n === others.length) releaseLoad();
  else if (loadWaitT >= limit) releaseLoad();
}
const LOAD_WAIT_MAX = 20;          // seconds the host waits on slow loaders once it's ready
const LOAD_WAIT_CLIENT_EXTRA = 25; // and on top, before a non-host stops waiting for the host
let loadWaitMax = LOAD_WAIT_MAX;   // (tests shorten it: __trollOps.setLoadWaitMax)
let loadWaitT = 0;

/* -------------------- pre-match staging --------------------

   A match used to begin the instant the map loaded: you were dropped on your
   spawn, already live, while the bots that fill the room only appeared a frame
   later from inside the animate loop. That reads as abrupt, and a room with one
   or two humans looks empty at exactly the moment it should feel like a match
   about to kick off.

   Staging is a short countdown *inside* `playing` rather than a sixth game
   state — the world renders, remote players and bots stream in and are visible,
   but nobody can move, shoot or take damage until the clock hits zero. Keeping
   it a flag rather than a state means the ~25 existing `gameState === "playing"`
   checks all keep working untouched. */
const STAGE_SECONDS = 6;
// TDM and S&D open on a cinematic of both teams (match-intro.js), so their
// first countdown is long enough to hold it plus a couple of beats to GO.
// Every client uses the same length so the shared clock never shrinks it.
const INTRO_STAGE_SECONDS = 10;
const INTRO_TAIL = 1.6;          // seconds of plain countdown left after the cinematic
let stageT = 0;                  // seconds left; 0 means the match is live
let introPending = null;         // "full" | "short": starts on the first un-held staging tick
let introDelay = 0;              // ...a beat in, once respawned bots have been placed
let stageShown = -1;             // last whole second painted, so we only touch the DOM on a change
let stageOwner = false;          // are we the client publishing the clock?
let stagePub = 0;                // throttle on republishing it

function isStaging() { return stageT > 0; }

function introMode() { return modeId === "tdm" || modeId === "snd"; }
function introOn() { return introMode() && !document.body.classList.contains("tf-anim-off"); }

/* Everyone the cinematic should show, as match-intro.js actors. Bots ride
   the peer map too (net.publishBot mirrors them in); streak entities don't
   count as anyone. */
function introCast() {
  const mine = [], enemy = [];
  for (const rp of remotes.byId.values()) {
    if (String(rp.netId).startsWith("streak-") || !rp.alive) continue;
    const actor = {
      id: String(rp.netId),
      name: rp.peer.name || "operator",
      pos: rp.pos,   // live: a respawned bot lands a frame after the round resets
      yaw: rp.yaw,
      pose: (name) => {
        const i = name ? EMOTES.findIndex((e) => e.id === name) : -1;
        rp.cineEmote = i >= 0 ? emoteCode(i) : 0;
      },
    };
    (rp.team === net.team ? mine : enemy).push(actor);
  }
  return { mine, enemy };
}

function startMatchIntro(kind) {
  const short = kind === "short";
  // A round restart only has 3 s on the clock: leave it less of a tail.
  const length = stageT - (short ? 0.9 : INTRO_TAIL);
  if (length < (short ? 1.4 : 4)) return;
  const enemyTeam = net.team === "phantom" ? "ghost" : "phantom";
  const snd = isSnd();
  const attack = snd && net.team === sndAttackTeam;
  matchIntro.start({
    length: short ? Math.min(length, 2.4) : length,
    short,
    seed: sndRound,
    modeName: currentMode().name,
    mapName: builtMap.map.name,
    mine: { name: TEAMS[net.team]?.name || "Trolls", ui: TEAMS[net.team]?.ui },
    enemy: { name: TEAMS[enemyTeam]?.name || "Jeets", ui: TEAMS[enemyTeam]?.ui },
    roleMine: snd ? (attack ? "Attacking" : "Defending") : "",
    roleEnemy: snd ? (attack ? "Defending" : "Attacking") : "",
    cast: introCast,
    self: () => ({
      feet: move.pos,
      eye: player.pos,
      yaw: look.yaw,
      pitch: look.pitch,
      name: playerName(),
    }),
  });
  document.body.classList.add("to-intro-on");
}
matchIntro.onEnd = () => document.body.classList.remove("to-intro-on");

/* Compile every shader the match will need while the countdown runs, so the
   first grenade, the first streak and the first bot in view don't each
   freeze the frame they appear (a shader compiles on first draw, and on a
   laptop GPU that is hundreds of ms apiece). The map and the bots are already
   in the scene; the rest gets one throwaway stand-in each, parked out of
   sight, compiled, and removed. compileAsync lets the driver compile in
   parallel where it can, so the countdown keeps ticking meanwhile.

   It runs every match, streak models included: each map brings its own
   lights, and the light count is part of every shader's key, so last
   match's shaders don't fit this one.

   The guns get stand-ins too, both copies: the first-person one and the one
   the third-person body holds. Only the equipped gun is ever built
   (setActiveWeaponMesh), so the secondary, and the body's gun the first
   time you go third person, used to compile on the spot. The stand-ins are
   kept (never drawn) until the next warm-up, because three frees a shader
   once the last material using it is disposed, and every weapon swap
   disposes the gun it puts away. */
const WARM_MODELS = ["care-package", "helicopter", "hunter-drone", "recon-drone", "strike-jet", "k9-dog", "vtol-warship"];
let warmKeep = [];                 // last warm-up's stand-ins, holding their shaders
const warmedGuns = new Set();      // gunWarmKey()s those stand-ins cover
const gunWarmKey = (def) => `${def.id}:${JSON.stringify(def.attachments || {})}`;

/* Every gun this match can put in your hands: the loadout's two, or the
   whole Gun Game rack. */
function matchGunDefs() {
  const mode = currentMode();
  const defs = Object.values(player.weapons || {}).map((w) => w.def);
  if (mode.ladder) {
    for (const id of mode.ladder) {
      let def = resolveWeapon(id, defaultLoadoutFor(id));
      if (mode.tuneWeapon) def = mode.tuneWeapon(def);
      defs.push(def);
    }
  }
  const seen = new Set();
  return defs.filter((d) => d && !seen.has(gunWarmKey(d)) && seen.add(gunWarmKey(d)));
}

/* First-person and third-person stand-ins for `defs` (and the melee
   weapon's third-person copy), not yet attached anywhere. */
function gunStandIns(defs, melee) {
  const fp = new THREE.Group(), tp = new THREE.Group();
  fp.visible = false;
  for (const def of defs) {
    fp.add(buildWeaponMesh(def));
    const g = stripLights(buildWeaponMesh(def));
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    tp.add(g);
  }
  if (melee) tp.add(buildMeleeMesh(melee, false, { held3p: true }));
  return { fp, tp };
}

function disposeStandIns(objs) {
  for (const obj of objs) obj.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    if (o.material) for (const m of [].concat(o.material)) m.dispose?.();
  });
}

/* compile() doesn't upload textures; do the stand-ins' now too. */
function uploadStandInTextures(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      if (!m) continue;
      for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "alphaMap", "bumpMap"]) {
        const t = m[k];
        if (t?.isTexture && t.image) { try { renderer.initTexture(t); } catch { /* uploads on first draw */ } }
      }
    }
  });
}

/* Guns compiled against the world and the viewmodel scene, keeping them
   in `keep`. */
async function warmGuns(defs, melee, keep) {
  const { fp, tp } = gunStandIns(defs, melee);
  keep.push(fp, tp);
  tp.position.set(0, -200, 0);
  weaponRig.add(fp);
  try {
    uploadStandInTextures(fp);
    uploadStandInTextures(tp);
    await Promise.all([
      compileWorld(tp, camera, scene),
      renderer.compileAsync(fp, weaponCamera, weaponScene),
    ]);
    for (const d of defs) warmedGuns.add(gunWarmKey(d));
  } finally {
    weaponRig.remove(fp);
  }
}

/* A class change on respawn brings guns the countdown never saw. */
function warmNewGuns() {
  if (!renderer.compileAsync || gameState !== "playing") return;
  const fresh = matchGunDefs().filter((d) => !warmedGuns.has(gunWarmKey(d)));
  if (fresh.length) warmGuns(fresh, null, warmKeep).catch(() => {});
}

async function warmShaders() {
  if (!renderer.compileAsync) return;
  const stand = new THREE.Group();
  stand.position.set(0, -200, 0);
  for (const def of Object.values(THROWABLE_DEFS)) {
    stand.add(new THREE.Mesh(grenades.geo, grenades.matFor(def)));
  }
  const kept = [];
  ensureStrikeTablet();
  scene.add(stand);
  try {
    const models = (await Promise.all(WARM_MODELS.map((m) => loadModel(m).catch(() => null)))).filter(Boolean);
    // zombies: the blood pool and the neck stump of a headshot kill
    if (isZombies()) models.push(...goreStandIns());
    for (const m of models) stand.add(m);
    kept.push(...models);
    uploadStandInTextures(stand);
    warmedGuns.clear();
    await Promise.all([
      compileWorld(scene, camera),
      renderer.compileAsync(weaponScene, weaponCamera),
      warmGuns(matchGunDefs(), player.melee?.def, kept),
    ]);
  } catch (e) {
    // Only ever a head start; the frame will compile whatever this missed.
  } finally {
    scene.remove(stand);
    for (const m of kept) m.parent?.remove(m);
    const old = warmKeep;
    warmKeep = kept;
    disposeStandIns(old);
  }
}

/* Frozen: input is ignored and damage is refused. The camera still moves so
   the player can look around the room while they wait. */
function beginStaging(seconds = STAGE_SECONDS) {
  // Animations off (menu-bo2.js switch): solo skips most of the wait. PvP
  // keeps the room's clock, since everyone in it shares one countdown.
  const fast = !isPvp() && document.body.classList.contains("tf-anim-off");
  if (fast) seconds = Math.min(seconds, 2);
  // TDM / S&D: the match opener gets the full cinematic (and a longer clock
  // to hold it), each later S&D round the short squad cut.
  matchIntro.stop();
  introPending = null;
  if (introMode() && !royale) {
    const opener = seconds === STAGE_SECONDS;
    if (opener) seconds = INTRO_STAGE_SECONDS;
    if (introOn()) { introPending = opener ? "full" : "short"; introDelay = 0.15; }
  }
  stageT = seconds;
  stageShown = -1;
  stagePub = 0;
  // Solo play always "owns" its own clock; PvP re-derives ownership every
  // publish tick in updateStaging() rather than latching a one-time guess
  // here — a peer's `hello` can land a beat after this runs, and a stale
  // "I'm alone" snapshot would leave two clients both convinced they own it.
  stageOwner = !isPvp() || !net.active;
  // A beat in, once the bots that fill the room have streamed in.
  // (Under the loading screen enterMatch warms everything itself.)
  if (!loadHold) setTimeout(() => { if (isStaging()) warmShaders(); }, fast ? 0 : 900);
  // The sky lobby is a place to walk round in, not a frozen countdown card.
  els.staging.hidden = !!royale?.drop;
  if (!royale?.drop) document.body.classList.add("to-staging-on");
  else showWaveBanner("SKY LOBBY — try the guns, the bus leaves soon", 2600);
  els.stagingMode.textContent = isPvp()
    ? `${currentMode().name} — ${builtMap.map.name}`
    : builtMap.map.name;
  els.stagingSub.textContent = isInfection()
    ? "Everyone starts clean. Someone won't stay that way."
    : isPvp() && net.team
    ? `You are ${TEAMS[net.team].name}`
    : "Get ready";
  updateStagingRoster();
}

function endStaging() {
  // Already ended. (The sky lobby hides the countdown card, so a hidden card
  // alone doesn't mean that there.)
  if (stageT <= 0 && els.staging.hidden && royale?.drop?.phase !== "lobby") return;
  stageT = 0;
  spawnOpening = false;
  introPending = null;
  matchIntro.stop();
  els.staging.hidden = true;
  document.body.classList.remove("to-staging-on");
  // The opening seconds still deserve the cover a respawn gets.
  player.spawnGuard = isPvp() ? SPAWN_GUARD : 0;
  updateSpawnGuardHud();
  if (royale?.drop) startRoyaleBus();
  else if (royale) { royale.live = true; royale.t = 0; showWaveBanner("DROP IN — last troll standing wins", 1800); }
  else if (isPvp() && !isSnd()) showWaveBanner("FIGHT", 1100);
  audio.stageTick(true);
  // The horde/zombie clock — and the first wave banner — start now, not when
  // the map loaded, so nothing was ever ticking behind the countdown.
  if (isZombies()) nextZombieRound();
  else if (isSnd()) sndGoLive();
  else if (!isPvp() && !isRange()) nextWave();

  // Search & Destroy's clock is per-round elsewhere (PLANT_TIME/DEFUSE_TIME);
  // this is the whole-match clock for score-limited modes like TDM.
  if (isPvp() && !isSnd()) resetMatchClock();
}

/* How full the room looks right now — the whole point of staging is that the
   bots are already standing there when the player counts down. */
function updateStagingRoster() {
  if (!isPvp()) { els.stagingRoster.textContent = ""; return; }
  let humans = 1, botCount = 0;
  for (const p of net.peers.values()) (isBotPeer(p) ? botCount++ : humans++);
  const parts = [`${humans} operator${humans === 1 ? "" : "s"}`];
  if (botCount) parts.push(`${botCount} bot${botCount === 1 ? "" : "s"}`);
  els.stagingRoster.textContent = parts.join(" · ");
}

function updateStaging(dt) {
  // The first tick the clock actually runs (not under the loading screen),
  // so the cinematic is squeezed into whatever is really left.
  if (introPending && (introDelay -= dt) <= 0) { const k = introPending; introPending = null; startMatchIntro(k); }
  stageT -= dt;
  if (matchIntro.active) matchIntro.setClock(stageT);

  // Only the owner publishes, ~3×/sec, so a client that joins or reloads
  // mid-countdown adopts the clock already running rather than its own.
  // Re-checked every tick (not latched once) so a peer whose `hello` arrived
  // a beat late still hands ownership off the moment it's known about.
  if (isPvp() && net.active) {
    stageOwner = net.isBotHost();
    stagePub -= dt;
    if (stageOwner && stagePub <= 0) {
      stagePub = 0.33;
      net.publishStage(loadedMapId || loadout.mapId, modeId, stageT, royale ? royale.seed : undefined);
    }
  }

  const whole = Math.max(0, Math.ceil(stageT));
  if (whole !== stageShown) {
    stageShown = whole;
    els.stagingClock.textContent = whole > 0 ? String(whole) : "GO";
    // Restarting a CSS animation needs the class off for a reflow first.
    els.stagingClock.classList.remove("is-tick");
    void els.stagingClock.offsetWidth;
    els.stagingClock.classList.add("is-tick");
    if (whole > 0) audio.stageTick(whole <= 3);
    updateStagingRoster();
  }

  if (stageT <= 0) endStaging();
}

/* Everything a match needs reset, with no connection work — so a rematch can
   reuse the room the lobby already joined instead of tearing it down and
   making everyone re-handshake. */
function beginMatch(mapId = null) {
  killcam.clear();
  setFunnyDeaths(!!currentMode().funny);
  suppressT = 0;
  clearHitDirs();
  player.hp = player.maxHp;
  player.kills = 0;
  player.deaths = 0;
  player.wave = 0;
  player.alive = true;
  player.assists = 0;
  player.headshots = 0;
  player.streak = 0;
  player.bestStreak = 0;
  player.matchXp = 0;
  player.matchT = 0;
  player.vetBotT = 0;
  player.shotsFired = 0;
  player.shotsHit = 0;
  player.matchScore = 0;
  player.weaponKills = {};
  roomSkillSeen = null;
  player.lastKilledBy = null;
  // A fresh match starts with nothing earned and nothing banked, and picks up
  // whatever three streaks the lobby has selected.
  streaks.reset();
  streaks.setSelected(streakPicker.selected);
  uavUntil.phantom = 0;
  uavUntil.ghost = 0;
  vsatUntil.phantom = 0;
  vsatUntil.ghost = 0;
  clearStreakLocks();
  killstreakUi.reset();
  recentTeamKillers.clear();
  achievements.reset();
  clearStreakEntities();
  if (els.ssSlots) els.ssSlots.dataset.sig = "";
  updateStreakHud();
  damageLog.clear();
  dealtLog.clear();
  lastHitRange.clear();
  if (els.deathBy) els.deathBy.hidden = true;
  elapsedRun = 0;
  respawnT = 0;
  teamScores.phantom = 0;
  teamScores.ghost = 0;
  updateTeamHud();

  gunGameProgress = 0;
  hillAcc = 0;
  resetInfection();
  // After that reset: it reads a 150 max as "was infected" (the Knight's 150 too).
  applyHeroLoadout();

  spawnDeaths.clear();
  // Spawn protection starts when the countdown ends, not when the map loads —
  // burning it during staging would spend it before anyone can shoot.
  player.spawnGuard = 0;
  updateSpawnGuardHud();

  loadMap(matchMapId(mapId));
  // Socialize: the map's townsfolk (town-npcs.js), if it has any.
  townNpcs?.dispose();
  townNpcs = isSocial() && builtMap?.map?.rp?.npcs ? new TownNpcs(scene, builtMap.map.rp.npcs(), builtMap.map.rp) : null;
  player.armor = 0;
  player.plates = 0;
  player.heals = 0;
  if (isRoyale()) setupRoyale(); else teardownRoyale();
  spawnOpening = true;   // cleared by endStaging — everyone opens on their own side
  clearDeathVisuals();   // dying as the last match ended left the screen dark
  const sp = royale?.drop ? royale.drop.lobbySpot(0) : isPvp() ? teamSpawn() : builtMap.playerSpawn;
  move.reset(sp.x, sp.z, sp.y || 0);
  look.yaw = yawTowardCentre(sp);
  look.pitch = 0;
  bullets.clear();
  grenades.clear();
  pickups.clear();
  swapHold.reset();
  cooking.def = null;
  cooking.slot = null;
  els.cook.hidden = true;
  blindT = 0;
  empT = 0;
  clearDamageNumbers();
  applyEmpState(false);
  els.smoke.style.opacity = "0";
  shakeT = 0;
  shakeMag = 0;
  resetFireShake();
  remotes.clear();
  bots.clear();

  hill = currentMode().hill
    ? new Hill(pickHillPoints(builtMap.map.bounds, builtMap.spawnPoints, colliders))
    : null;
  setHillMarker(hill);

  if (currentMode().rounds) {
    bombSites = pickBombSites(builtMap.map.bounds, builtMap.spawnPoints, colliders);
    bomb = new Bomb(bombSites);
    setBombSiteMarkers(bombSites);
    sndRound = 0;
    sndAttackTeam = "phantom";
  } else {
    bomb = null;
    bombSites = null;
    setBombSiteMarkers(null);
  }

  setActiveWeaponMesh(equipFromLoadout());

  if (spawner) {
    for (const g of spawner.grunts) g.dispose(scene);
    spawner = null;
  }
  els.rangeHud.hidden = true;
  if (zdir) { zdir.clear(); zdir = null; }

  if (rangeSet) { rangeSet.clear(); rangeSet = null; }

  if (isRange()) {
    rangeSet = new RangeSet(scene);
  } else if (isZombies()) {
    zdir = new ZombieDirector(scene, ARENA, colliders, builtMap.map.zombieLayout());
  } else if (!isPvp() && !isView()) {
    spawner = new WaveSpawner(scene, ARENA, spawnPoints, colliders);
  }

  const pvp = isPvp();
  const snd = isSnd();
  els.hudTeams.hidden = !pvp || isRoyale();
  els.royale.hidden = !isRoyale();
  updateRoyaleGear();
  // S&D keeps the wave/hostiles boxes — repurposed as round count and bomb
  // status — where every other PvP mode hides them.
  els.hudWaveBox.hidden = (pvp && !snd) || isRange();
  els.hudHostilesBox.hidden = (pvp && !snd) || isRange();
  els.bombStatus.hidden = !snd;
  if (els.touchInteract) els.touchInteract.hidden = !snd;
  // The Test Range info box is retired (user, 2026-09-28): N still spawns a
  // bot, and Esc has Spawn a bot / Clear bots and the full settings.
  els.rangeHud.hidden = true;
  updateRangeHud();
  document.getElementById("hud-l-wave").textContent = isZombies() || snd ? "Round" : "Wave";
  document.getElementById("hud-l-hostiles").textContent = isZombies() ? "Zombies" : (snd ? "Bomb" : "Hostiles");
  document.getElementById("hud-l-kills").textContent = isZombies() ? "Points" : "Kills";
  // Only Zombies keeps this box (Points); the kill count is gone (user, 2026-09-28).
  document.getElementById("hud-score-box").style.display = isZombies() ? "" : "none";
  els.respawn.hidden = true;
  els.scoreboard.hidden = true;

  els.title.hidden = true;
  els.gameover.hidden = true;
  els.pause.hidden = true;
  els.hud.hidden = isView();   // View mode: just the map on screen
  // Socialize: style.css hides the combat HUD and touch buttons off this.
  document.body.classList.toggle("to-social", isSocial());
  resetBar();
  document.body.classList.remove("to-social-drink");
  setTouchControls(true);
  gameState = "playing";

  // The range is a sandbox, not a match — there is nothing to count down to.
  if (isView()) {
    showWaveBanner("View mode: fly with WASD, Space up, C down, Shift fast", 3200);
  } else if (isSocial()) {
    // Nothing to count down to either: no bots, no clock, no score.
    spawnOpening = false;
    resetMatchClock();
    showWaveBanner(isTouch ? "Socialize: tap the face button for emotes" : "Socialize: H for emotes, Enter to chat", 3200);
  } else if (isRange()) {
    showWaveBanner("Test range — nothing here shoots back", 2600);
  } else {
    // Bots are filled here rather than on the first live frame, so the room is
    // already populated while the player watches the clock.
    if (isPvp() && net.isBotHost()) {
      const { humans, teams } = humanHeadcount();
      bots.fill(noBotsRoom() ? 0 : botTarget(), humans, botSpawn, !!currentMode().ffa, teams);
      net.botCount = bots.bots.length;
      for (const b of bots.bots) net.publishBot(b);
    }
    // Troll Royale: the bots wait in the sky lobby too.
    if (royale?.drop) placeBotsInLobby();
    // S&D's round 1 is set up like every later round, under this countdown.
    if (isSnd()) prepareSndRound();
    // Wave 1 / Round 1 don't spawn until the countdown clears — starting the
    // spawner immediately would have grunts standing idle mid-countdown and
    // "WAVE 1" competing on screen with "GET READY".
    beginStaging(royale?.drop ? DROP.lobbySeconds : undefined);
    applyRoyaleCatchUp();
  }

  // Browsers refuse a pointer lock requested too soon after an unlock without
  // a fresh gesture, which the auto-advance out of an intermission doesn't
  // have. If it's refused we land on the pause screen instead of in a live
  // match with dead mouse-look, and clicking resume picks it back up.
  // (Under the loading screen, releaseLoad does this when it comes down.)
  if (!isTouch && !loadHold) {
    try { controls.lock(); } catch { /* refused — the pause screen catches it */ }
    setTimeout(() => {
      if (gameState === "playing" && !controls.isLocked) openPauseMenu();
    }, 260);
  }
}

function nextZombieRound() {
  player.wave = zdir.round + 1;
  zdir.startRound(player.wave);
  els.hudWave.textContent = String(player.wave);
  showWaveBanner(`ROUND ${player.wave}`);
  audio.wave();
}

/* The Max Ammo drop: every gun's reserve full again, plus your grenades.
   The mag you're holding stays as it is, the way the genre does it. */
function zombieMaxAmmo() {
  for (const w of Object.values(player.weapons)) w.ammoReserve = w.def.reserveMax - w.def.magSize;
  player.gear.lethal = loadout.carried("lethal");
  player.gear.tactical = loadout.carried("tactical");
  showWaveBanner("MAX AMMO", 1600);
  audio.wave();
}

function onZombieAttack(zombie, dmg) {
  damagePlayer(dmg, null, null, false, zombie.mesh?.position);
}

function nextWave() {
  player.wave++;
  els.hudWave.textContent = String(player.wave);
  showWaveBanner(`WAVE ${player.wave}`);
  audio.wave();
  spawner.startWave(player.wave);
}

// -------------------- Search & Destroy round flow --------------------

function sndDefendTeam() { return sndAttackTeam === "phantom" ? "ghost" : "phantom"; }

/* Round timing. There used to be no clock at all, and bots respawned on
   their normal 5s timer, so with bots in the room the attackers could never
   be wiped and a bomb nobody planted meant a round that never ended. */
const SND_ROUND_TIME = 120;   // seconds to get a plant down, or the defenders win
const SND_GRACE = 1.5;        // after go-live, before elimination is judged
const SND_BOT_SITE_R = SND_SITE_RADIUS - 1.2;   // how far onto a site a bot walks before acting

let sndLive = false;          // countdown cleared, round in play
let sndClock = 0;             // seconds left to plant
let sndLiveT = 0;             // seconds since go-live
let sndTimeupWait = 0;        // non-host: how long we've sat at 0 waiting for the host's call
const sndSeen = { attackers: 0, defenders: 0 };   // most alive at once this round
let sndBotAction = null;      // { botId, kind, progress, site } — a bot we host at a site
let sndBotPub = 0;
let sndBotSite = "A";         // where our attacking bots push this round
let remoteBombAct = null;     // { kind, site, until } — someone else mid-plant/defuse

/* Between rounds, under the countdown: everyone respawns on their side and
   the bomb resets, so the room is visibly assembled before it goes live —
   the previous flow respawned players only after the countdown, which left
   the dead spectating a frozen clock. Every client runs this itself. */
function prepareSndRound() {
  sndRound++;
  sndRoundOver = false;
  sndEliminated = false;
  sndLive = false;
  sndClock = SND_ROUND_TIME;
  sndLiveT = 0;
  sndTimeupWait = 0;
  sndSeen.attackers = sndSeen.defenders = 0;
  sndBotAction = null;
  remoteBombAct = null;
  sndBotSite = Math.random() < 0.5 ? "A" : "B";
  // One life a round means a round boundary is the only other place a life
  // ends, so it has to reset the meter the way a death does. Earned streaks
  // still carry, same as across a death.
  streaks.onRoundEnd();
  uavUntil.phantom = 0;
  uavUntil.ghost = 0;
  vsatUntil.phantom = 0;
  vsatUntil.ghost = 0;
  jammedUntil = 0;
  myUavUntil = 0;
  // A gunship or a crate has no round to belong to once this one ends.
  clearStreakEntities();
  updateStreakHud();
  grenades.clear();
  bullets.clear();
  pickups.clear();
  bomb.reset();
  els.bombPrompt.hidden = true;
  els.bombTimer.hidden = true;
  els.hudWave.textContent = String(sndRound);
  els.bombSide.textContent = net.team === sndAttackTeam ? "Plant the bomb" : "Defend the sites";
  els.bombSide.style.color = TEAMS[net.team]?.ui || "";
  showWaveBanner(`ROUND ${sndRound} — ${net.team === sndAttackTeam ? "ATTACKING" : "DEFENDING"}`, 2600);
  audio.wave();

  clearDeathVisuals();
  player.hp = player.maxHp;
  player.alive = true;
  els.respawn.hidden = true;
  const sp = teamSpawn({ sideOnly: true });
  move.reset(sp.x, sp.z, sp.y || 0);
  look.yaw = yawTowardCentre(sp);
  look.pitch = 0;
  setActiveWeaponMesh(equipFromLoadout());
  warmNewGuns();

  if (isPvp() && net.isBotHost()) {
    bots.reviveAll((team, id) => botSpawn(team, id, { sideOnly: true }));
    for (const b of bots.bots) net.publishBot(b);
  }
}

/* The countdown cleared. The carrier is picked now rather than in
   prepareSndRound: a peer who died last round still reads as dead until
   their next state packet, and choosing among "living" attackers before
   then could skip them. Humans get it ahead of bots when there's a choice. */
function sndGoLive() {
  sndLive = true;
  sndLiveT = 0;
  player.spawnGuard = SPAWN_GUARD;
  updateSpawnGuardHud();
  if (net.isBotHost() || !net.active) {
    bomb.carrierId = pickCarrier();
    if (net.active) net.publishBomb({ kind: "event", action: "reset", round: sndRound, attackTeam: sndAttackTeam, carrierId: bomb.carrierId });
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
function botObjective(bot) {
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
  if (hill) {
    const p = hill.position;
    return { id: `hill-${hill.index}`, x: p.x, z: p.z, radius: hill.radius * 0.6 };
  }
  if (!isSnd() || !bomb || !sndLive || sndRoundOver) return null;
  const attacking = bot.team === sndAttackTeam;
  if (bomb.state === "planted") {
    const s = bomb.siteAt(bomb.site);
    return { id: `site-${s.id}`, x: s.x, z: s.z, radius: attacking ? 7 : 1 };
  }
  if (attacking) {
    const s = bomb.siteAt(sndBotSite);
    return { id: `site-${s.id}`, x: s.x, z: s.z, radius: bomb.carrierId === bot.id ? 1 : 8 };
  }
  // Defenders pick a site by id so the split is stable across the round.
  let h = 0;
  for (let i = 0; i < bot.id.length; i++) h = (h * 31 + bot.id.charCodeAt(i)) >>> 0;
  const s = bombSites[h % bombSites.length];
  return { id: `site-${s.id}`, x: s.x, z: s.z, radius: 6 };
}

function botBusy(bot) {
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
  if (bomb.state === "carried") {
    const b = bots.byId(bomb.carrierId);
    const s = bomb.siteAt(sndBotSite);
    if (b?.alive && !(b.stunT > 0) && Math.hypot(b.pos.x - s.x, b.pos.z - s.z) <= SND_BOT_SITE_R) {
      actor = b; kind = "plant"; site = s;
    }
  } else if (bomb.state === "planted") {
    const s = bomb.siteAt(bomb.site);
    const current = sndBotAction?.kind === "defuse" ? bots.byId(sndBotAction.botId) : null;
    const candidates = current ? [current, ...bots.bots] : bots.bots;
    for (const b of candidates) {
      if (!b?.alive || b.team === sndAttackTeam || b.stunT > 0) continue;
      if (Math.hypot(b.pos.x - s.x, b.pos.z - s.z) > SND_BOT_SITE_R) continue;
      actor = b; kind = "defuse"; site = s;
      break;
    }
  }

  if (!actor) {
    if (sndBotAction) {
      sndBotAction = null;
      if (net.active) net.publishBomb({ kind: "event", action: "cancel", by: "bot" });
    }
    return;
  }

  if (!sndBotAction || sndBotAction.botId !== actor.id || sndBotAction.kind !== kind) {
    sndBotAction = { botId: actor.id, kind, progress: 0, site: site.id };
  }
  sndBotAction.progress += dt;
  sndBotPub -= dt;
  if (net.active && sndBotPub <= 0) {
    sndBotPub = 0.2;
    net.publishBomb({ kind: "action", action: kind, by: actor.id, progress: sndBotAction.progress, site: site.id });
  }
  noteRemoteBombAct(kind, site.id);

  if (kind === "plant" && sndBotAction.progress >= PLANT_TIME) {
    sndBotAction = null;
    bomb.plant(site.id);
    audio.wave();
    showWaveBanner(`Bomb planted — site ${site.id}`, 1800);
    if (net.active) net.publishBomb({ kind: "event", action: "planted", site: site.id });
  } else if (kind === "defuse" && sndBotAction.progress >= DEFUSE_TIME) {
    sndBotAction = null;
    bomb.defuse();
    if (net.active) net.publishBomb({ kind: "event", action: "defused" });
    sndRoundWin(sndDefendTeam(), "bomb defused");
  }
}

/* Somebody else is on the bomb — shown in the status line rather than the
   hold-E bar, which is ours. Expires on its own if the messages stop. */
function noteRemoteBombAct(kind, site) {
  remoteBombAct = { kind, site, until: performance.now() + 500 };
}

/* Round over: score it, check for a match win, and either roll into the next
   round or let checkMatchEnd's endMatch take over. Every client reaches this
   independently off the same bomb/elimination state, so nobody needs to be
   told the round ended — they all see it happen at once. */
function sndRoundWin(winningTeam, reason) {
  if (sndRoundOver) return;
  sndRoundOver = true;
  teamScores[winningTeam] = (teamScores[winningTeam] || 0) + 1;
  updateTeamHud();
  showWaveBanner(`${TEAMS[winningTeam].name.toUpperCase()} WIN THE ROUND — ${reason}`, 2600);
  audio.kill();

  const winner = matchWinner(currentMode(), {
    teamScores, selfScore: 0, selfName: "You", peers: [...net.peers.values()],
  });
  if (winner) { endMatch(winner); return; }

  // Halftime: sides swap once each team has attacked the same number of
  // rounds — i.e. right after round roundsToWin - 1 finishes, so a 6-round
  // win limit swaps after round 5, matching Black Ops 2's split.
  if (sndRound === currentMode().roundsToWin - 1) {
    sndAttackTeam = sndDefendTeam();
    setTimeout(() => { if (gameState === "playing" && isSnd()) showWaveBanner("HALFTIME — SIDES SWAP", 1300); }, 300);
  }

  setTimeout(() => {
    if (gameState !== "playing" || !isSnd()) return;
    prepareSndRound();
    beginStaging(3);
  }, 2600);
}

function finishRun(title, headline, headlineLabel, secondLabel, thirdLabel, opts = {}) {
  gameState = "gameover";
  player.alive = false;
  cancelCook();
  if (controls.isLocked) controls.unlock();
  els.hud.hidden = true;
  setTouchControls(false);
  els.gameover.hidden = false;
  els.goTitle.textContent = title;
  els.goWave.textContent = headline;
  els.goL1.textContent = headlineLabel;
  els.goKills.textContent = String(player.kills);
  els.goL2.textContent = secondLabel;
  const mins = Math.floor(elapsedRun / 60), secs = Math.floor(elapsedRun % 60);
  els.goTime.textContent = `${mins}:${String(secs).padStart(2, "0")}`;
  els.goL3.textContent = thirdLabel;

  // PvP banks XP per kill as the match runs, so only the end-of-match
  // bonuses are settled here. Ops still pays once, on its wave curve.
  const base = isPvp()
    ? player.matchXp + xpForMatch({ won: !!opts.won, completed: !!opts.completed })
    : xpForRun({ kills: player.kills, wave: player.wave });
  const gained = boostedXp(base);
  const { rankedUp, rank } = addXp(gained);
  els.goXp.textContent = `+${gained.toLocaleString()} XP${gained > base ? " · +10% veteran bots" : ""}`;
  els.goRank.textContent = rankedUp ? `Level up — now LV ${rank}` : "";
  els.goRank.hidden = !rankedUp;
  renderMatchMedals();
  loadout.render();

  // addXp above already queued this XP for the account (troll_ops_xp).
  // Filing the run is separate: it feeds the leaderboard and the flat
  // game_run/high_score awards, and it no-ops for guests.
  window.TrollrunnerAccounts?.reportGameResult?.("troll-ops", player.wave * 10000 + player.kills * 10, {
    mode: modeId,
    kills: player.kills,
    deaths: player.deaths,
    wave: player.wave,
    map: loadedMapId || loadout.mapId,
  });
}

/* BO2's after-action medal list: every medal this match with its count,
   most-earned first. Hidden when nothing was earned. */
function renderMatchMedals() {
  const box = els.goMedals;
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

function endGame(reason) {
  const zombies = isZombies();
  finishRun(
    reason === "quit" ? "Extracted" : (zombies ? "They got you" : "You went down"),
    String(player.wave),
    zombies ? "Round reached" : "Wave reached",
    zombies ? "Zombies killed" : "Kills",
    "Time survived",
  );
  window.TrollLeaderboard?.report?.("troll-ops", { pvp: false, wave: player.wave, kills: player.kills });
}

function endMatch(title) {
  endStaging();          // a match can be ended from outside (everyone left)
  const mode = currentMode();
  const headline = royale?.finalPlace ? ordinal(royale.finalPlace)
    : mode.ffa ? String(player.kills) : String(teamScores[net.team] ?? 0);
  const won = mode.ffa
    ? title.startsWith("You")
    : title === `${teamName(net.team)} win`;
  // Before finishRun: Comeback/Flawless/Combat Medic belong in its medal list.
  achievements.onMatchEnd({
    won, deaths: player.deaths, assists: player.assists, kills: player.kills,
  });
  finishRun(title, headline, royale ? "Your place" : mode.ffa ? "Your score" : "Your side", "Your kills", "Match length", { won, completed: true });

  window.TrollLeaderboard?.report?.("troll-ops", {
    pvp: true, kills: player.kills, deaths: player.deaths, won,
    assists: player.assists, headshots: player.headshots, streak: player.bestStreak,
  });
  // Combat record (record.js): this match onto the account'''s lifetime totals.
  recordMatch({
    won, kills: player.kills, deaths: player.deaths, assists: player.assists,
    headshots: player.headshots, bestStreak: player.bestStreak, score: player.matchScore,
    seconds: player.matchT, shotsFired: player.shotsFired, shotsHit: player.shotsHit,
    weaponKills: player.weaponKills,
  });

  bots.clear();
  clearStreakEntities();
  setHillMarker(null);
  setBombSiteMarkers(null);
  els.bombPrompt.hidden = true;
  if (els.pickupPrompt) els.pickupPrompt.hidden = true;
  pickups.clear();
  bomb = null;
  teardownRoyale();
  updateRoyaleGear();
  if (els.royale) els.royale.hidden = true;

  // The room stays up. Tearing the channel down here meant everyone had to
  // re-enter a code and re-handshake to play a second match — and quickplay
  // could shard them apart on the way back.
  // A match the owner started in the hangout: no map vote, everyone goes
  // back to Socialize.
  if (net.active && socialRoom) scheduleSocialReturn();
  else if (net.active) startIntermission();
  else setNetStatus("Match over. Pick a mode to drop in again.");
}

// -------------------- intermission --------------------

const INTERMISSION = 20;          // seconds between matches
const VOTE_CANDIDATES = 3;
let intermissionT = 0;
let voteOptions = [];

/* The three maps on offer. Derived from the room code and the match count so
   every client lands on the same shortlist without anyone hosting the vote. */
function pickVoteOptions() {
  const pool = MAP_IDS.filter((id) => id !== loadout.mapId);
  const seedSrc = `${net.room || ""}:${matchesPlayed}`;
  let seed = 0;
  for (let i = 0; i < seedSrc.length; i++) seed = (seed * 31 + seedSrc.charCodeAt(i)) >>> 0;
  const out = [];
  const avail = [...pool];
  while (out.length < Math.min(VOTE_CANDIDATES, avail.length + 0) && avail.length) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    out.push(avail.splice(seed % avail.length, 1)[0]);
  }
  // Always let people re-run the map they just played.
  if (out.length < VOTE_CANDIDATES) out.push(loadout.mapId);
  return out;
}

function startIntermission() {
  matchesPlayed++;
  net.clearVotes();
  voteOptions = pickVoteOptions();
  intermissionT = INTERMISSION;
  renderVote();
  els.intermission.hidden = false;
  setNetStatus(`Match over · next map in ${INTERMISSION}s`, "live");
}

function renderVote() {
  if (!els.voteList) return;
  const tally = new Map();
  const add = (m) => { if (m) tally.set(m, (tally.get(m) || 0) + 1); };
  add(net.myVote);
  for (const p of net.peers.values()) {
    if (!isBotPeer(p)) add(p.vote);
  }

  els.voteList.replaceChildren();
  for (const id of voteOptions) {
    const n = tally.get(id) || 0;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "to-vote-opt";
    btn.classList.toggle("is-mine", net.myVote === id);
    btn.setAttribute("aria-pressed", String(net.myVote === id));
    // A real shot of the map (tools/troll-ops-map-previews.mjs renders them).
    btn.innerHTML =
      `<img class="to-vote-img" ${mapShotAttrs(id, "200px")} alt="" loading="eager" draggable="false">` +
      `<span class="to-vote-row"><span class="to-vote-name">${MAPS[id]?.name || id}</span>` +
      `<span class="to-vote-n">${n ? `${n} vote${n === 1 ? "" : "s"}` : ""}</span></span>`;
    btn.querySelector("img").addEventListener("error", (e) => e.target.remove());
    btn.addEventListener("click", () => {
      net.castVote(id);
      renderVote();
    });
    els.voteList.appendChild(btn);
  }
}

function cancelIntermission() {
  intermissionT = 0;
  voteOptions = [];
  net.clearVotes();
  if (els.intermission) els.intermission.hidden = true;
}

/* Ticked from the frame loop so it shares the same clock as everything else. */
function updateIntermission(dt) {
  if (intermissionT <= 0) return;
  intermissionT -= dt;
  if (els.voteClock) els.voteClock.textContent = String(Math.max(0, Math.ceil(intermissionT)));
  if (intermissionT > 0) return;

  intermissionT = 0;
  els.intermission.hidden = true;

  // Everyone tallies the same votes, so everyone loads the same map.
  const winner = net.voteWinner() || voteOptions[0] || loadout.mapId;
  net.clearVotes();

  if (!net.active) { setNetStatus("Match over. Pick a mode to drop in again."); return; }

  loadout.mapId = winner;
  els.gameover.hidden = true;
  roomMapHint = null;
  enterMatch(winner);
}

// -------------------- Socialize room mode --------------------
//
// A Socialize room (QSOC) is a hangout until the owner, troll_runner,
// picks a real mode in the pause menu. That goes out as a "mode" message
// and everyone in the room loads into it on the same channel: bots, the
// countdown and the rest come with the mode as usual. When the match ends
// the room comes back to Socialize on its old map (no vote).
//
// `roomModeSeq` counts the switches. It rides every room note (net.modeSeq
// → `ms`), so a newcomer or anyone who missed the message follows the room,
// and a stale note can't switch anyone back. The owner's switches go up by
// two and a match ending goes up by one, so an owner switch that lands
// while clients are on their way back still wins.
//
// The owner check is client-side, like View mode and Invincible: the row
// only shows on troll_runner, and receivers only take a "mode" message from
// a peer whose state says owner. The netcode is trusting by design (net.js).

const SOCIAL_RETURN_SECONDS = 8;

function socialHomeMap() {
  if (socialMapId && MAP_IDS.includes(socialMapId)) return socialMapId;
  return MAP_IDS.includes(loadedMapId) ? loadedMapId : loadout.versusMapId;
}

/* Everyone moves at once, so split sides by a shared order rather than
   chooseTeam's live headcount (each client would read it before the others
   had switched). */
function joinRoomSide() {
  if (isSocial()) { net.setTeam("phantom"); return; }
  const ids = [net.id];
  for (const p of net.peers.values()) if (!isBotPeer(p)) ids.push(p.id);
  ids.sort();
  net.setTeam(ids.indexOf(net.id) % 2 === 0 ? "phantom" : "ghost");
}

function switchRoomMode(id, map, seq) {
  if (!socialRoom || !MODES[id]?.pvp || MODES[id].hidden || !(seq > roomModeSeq)) return false;
  roomModeSeq = net.modeSeq = seq;
  cancelSocialReturn();
  if (isSocial() && loadedMapId) socialMapId = loadedMapId;
  const mapHint = map && MAPS[map] ? map : null;
  // Still connecting (startGame hasn't entered the room's match yet): it
  // picks the room's mode and map up from here.
  if (gameState === "menu") {
    modeId = id;
    roomMapHint = mapHint;
    if (loadScreen.isOpen) loadScreen.setMap(loadInfo(matchMapId(mapHint)));
    return true;
  }
  // XP banked this match is kept, the same as leaving.
  if (player.matchXp > 0) { addXp(boostedXp(player.matchXp)); player.matchXp = 0; }
  // The host's bots leave everyone's screens now, not on a 5s timeout.
  for (const b of bots.bots) net.dropBot(b.id);
  bots.clear();
  clearStreakEntities();
  setHillMarker(null);
  setBombSiteMarkers(null);
  if (els.bombPrompt) els.bombPrompt.hidden = true;
  if (els.pickupPrompt) els.pickupPrompt.hidden = true;
  pickups.clear();
  bomb = null;
  teardownRoyale();   // before endStaging, or a sky lobby would launch its bus
  endStaging();
  cancelIntermission();
  stopEmote();
  emoteWheel.close(true);
  if (!els.pause.hidden) closePauseMenu();
  modeId = id;
  joinRoomSide();
  els.gameover.hidden = true;
  roomMapHint = mapHint;
  loadScreen.show(loadInfo(matchMapId(mapHint)));
  setNetStatus(`Live · room ${net.room} · ${currentMode().name}`, "live");
  enterMatch(mapHint);
  return true;
}

/* A room note (stage, ready, go) or "mode" message carrying a newer mode
   count than ours: follow it. True when it switched us. */
function adoptRoomMode(m) {
  if (!socialRoom || !m || !m.mode) return false;
  const ms = m.ms | 0;
  if (ms <= roomModeSeq) return false;
  // Already hanging out (we joined after the room came back): just catch
  // the count up rather than reload the hangout we're standing in.
  if (m.mode === "social" && isSocial() && gameState !== "menu" && gameState !== "gameover") {
    roomModeSeq = net.modeSeq = ms;
    return false;
  }
  return switchRoomMode(m.mode, m.map, ms);
}

/* The owner's pick from the pause menu. */
function ownerSwitchRoomMode(id) {
  if (!isTrollRunner() || !socialRoom || !net.active) return;
  const seq = roomModeSeq + 2;
  const map = MODES[id]?.forceMap || (id === "social" ? socialHomeMap() : (MAP_IDS.includes(loadedMapId) ? loadedMapId : socialHomeMap()));
  if (!switchRoomMode(id, map, seq)) return;
  net.publishMode(id, map, seq);
}

function scheduleSocialReturn() {
  cancelSocialReturn();
  const seq = roomModeSeq;
  socialReturnSeq = seq;
  els.retryBtn.textContent = "Back to the hangout";
  setNetStatus(`Match over · back to the hangout in ${SOCIAL_RETURN_SECONDS}s`, "live");
  socialReturnTimer = setTimeout(returnToSocial, SOCIAL_RETURN_SECONDS * 1000);
}

function returnToSocial() {
  const seq = socialReturnSeq;
  cancelSocialReturn();
  // The owner switched again in the meantime: that wins.
  if (seq == null || seq !== roomModeSeq || !socialRoom || !net.active) return;
  switchRoomMode("social", socialHomeMap(), seq + 1);
}

function cancelSocialReturn() {
  clearTimeout(socialReturnTimer);
  socialReturnTimer = 0;
  if (socialReturnSeq != null) els.retryBtn.textContent = "Drop in again";
  socialReturnSeq = null;
}

/* The owner's room-mode row in the pause menu: troll_runner, in a
   Socialize room, only. */
const ROOM_MODE_IDS = ["social", "tdm", "koth", "snd", "infection", "oitc", "gungame", "umb", "royale"];
function renderRoomModeRow() {
  const row = document.getElementById("to-set-roommode-row");
  const sel = document.getElementById("to-set-roommode");
  if (!row || !sel) return;
  row.hidden = !(isTrollRunner() && socialRoom && net.active);
  if (row.hidden) return;
  if (!sel.options.length) {
    for (const id of ROOM_MODE_IDS) {
      if (!MODES[id]) continue;
      const o = document.createElement("option");
      o.value = id;
      o.textContent = MODES[id].name;
      sel.appendChild(o);
    }
  }
  // Offer the other side of where the room is: a mode from the hangout,
  // the hangout from a mode.
  sel.value = isSocial() ? "tdm" : "social";
}
document.getElementById("to-set-roommode-go")?.addEventListener("click", () => {
  const id = document.getElementById("to-set-roommode")?.value;
  if (id) ownerSwitchRoomMode(id);
});

els.startBtn.addEventListener("click", startGame);
/* Mid-intermission this means "don't make me wait", not "reconnect" — the
   room is still up, so drop straight into the map the vote is currently on. */
els.retryBtn.addEventListener("click", () => {
  if (intermissionT > 0) { intermissionT = 0.0001; return; }
  // Socialize room: same idea, straight back to the hangout.
  if (socialReturnSeq != null) { returnToSocial(); return; }
  startGame();
});
// Touch has no pointer lock to re-take, so Resume just closes the menu —
// it used to do nothing there, stranding the player in the pause menu.
els.resumeBtn.addEventListener("click", resumePlay);
els.rangeSpawnBot?.addEventListener("click", spawnRangeBot);
els.pauseSpawnBot?.addEventListener("click", spawnRangeBot);
els.pauseClearBots?.addEventListener("click", clearRangeBots);
els.quitBtn.addEventListener("click", () => {
  // Quitting mid-match used to just discard player.matchXp — every kill's
  // banked XP for the session, gone, with no result screen to explain why.
  // finishRun settles it normally on a real match end; here there's no
  // result screen to show, so just fold the banked amount into the total.
  if (isPvp() && gameState === "playing" && player.matchXp > 0) {
    addXp(boostedXp(player.matchXp));
    player.matchXp = 0;
  }
  gameState = "menu";
  if (modeId === "view") modeId = viewPrevMode || "ops";
  // Left a Socialize room (maybe mid owner-started match): the lobby is
  // back on Socialize, and the room's mode count is forgotten.
  if (socialRoom) {
    socialRoom = false;
    roomModeSeq = net.modeSeq = 0;
    socialMapId = null;
    modeId = "social";
    renderModes();
  }
  cancelSocialReturn();
  document.body.classList.remove("to-social", "to-social-drink");
  resetBar();
  townNpcs?.dispose();
  townNpcs = null;
  localPauseOnly = false;
  endStaging();
  cancelIntermission();
  setBombSiteMarkers(null);
  if (els.bombPrompt) els.bombPrompt.hidden = true;
  if (els.pickupPrompt) els.pickupPrompt.hidden = true;
  pickups.clear();
  bomb = null;
  net.stop();
  chat.clear();
  remotes.clear();
  setNetStatus("Share the code with whoever you want in the match.");
  els.pause.hidden = true;
  els.hud.hidden = true;
  setTouchAds(false);
  setTouchControls(false);
  els.title.hidden = false;
  loadout.render();
  renderLobbyRoster();
  roomSkillSeen = null;
  renderBotSkillNote();
  showLobbyPanel("deploy");
});

controls.addEventListener("lock", () => { closePauseMenu(); chat.setInteractive(false); });
controls.addEventListener("unlock", () => {
  chat.setInteractive(true);
  cancelCook();
  if (gameState === "playing" && !djLulz.isOpen) openPauseMenu();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) cancelCook();
  if (document.hidden && gameState === "playing") openPauseMenu();
  // Backgrounding the tab is also the last reliable moment to flush banked
  // match XP — a closed tab never runs another frame, so this can't wait
  // for the "playing" branch above's later logic or a normal match end.
  if (document.hidden && isPvp() && player.matchXp > 0) {
    addXp(boostedXp(player.matchXp));
    player.matchXp = 0;
  }
});

// -------------------- damage to player --------------------

let respawnT = 0;


/* Everything death puts on screen, taken back off. Shared by a respawn, a
   new S&D round and a new match — the last two used to skip it, so dying in
   S&D left the 62% death fade over every round after. */

let killcamWasActive = false;

// -------------------- main loop --------------------

const clock = new THREE.Clock();

function resize() {
  const w = els.cabinet.clientWidth, h = els.cabinet.clientHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  ssao.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  weaponCamera.aspect = w / h;
  weaponCamera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);

/* Graphics tiers. SSAO is the big one: it re-renders the whole scene with a
   normal material every frame, then samples and blurs it, which roughly
   doubles the cost of a frame on a laptop iGPU. Every tier keeps the same
   shadow TYPE and light count on purpose: changing either recompiles every
   lit shader (the 2 s freezes light-pool.js exists to stop), whereas
   toggling a pass or resizing the shadow map is free to do mid-match.
   Purely local: nothing here is sent over the wire. */
const GFX_TIERS = ["high", "medium", "low"];
const GFX = {
  high:   { ssao: true,  bloom: true,  shadowSize: 2048 },
  medium: { ssao: false, bloom: true,  shadowSize: 2048 },
  low:    { ssao: false, bloom: false, shadowSize: 1024 },
};
const GFX_AUTO_KEY = "trollops:gfx-auto";
// Auto starts wherever it settled last time on this device, so a laptop that
// always ends up on Low doesn't spend the first minute of every match lagging.
let gfxAutoTier = (() => {
  // A phone's first match starts without SSAO, so it never spends its
  // opening seconds lagging (and shedding resolution) to find that out.
  const first = isTouch ? "medium" : "high";
  try { const t = localStorage.getItem(GFX_AUTO_KEY); return GFX[t] ? t : first; } catch { return first; }
})();
let gfxCeiling = 0;       // best tier index Auto may climb back to this session
let gfxApplied = null;

function gfxTier() {
  return settings.gfx === "auto" || !GFX[settings.gfx] ? gfxAutoTier : settings.gfx;
}

/* Map clutter (instanced tufts, bushes, flowers: userData.clutter = full
   count) drawn in proportion to the graphics tier, so phones get a lighter
   map (map detail pass). Instances are placed in random order, so any
   leading share is spread evenly. */
const CLUTTER_SHARE = { low: 0.15, medium: 0.35, high: 0.55 };
function applyClutter() {
  const tier = gfxTier();
  const share = CLUTTER_SHARE[tier] ?? 1;
  // A mesh can carry its own shares (map-dressing.js: the PvP maps' clutter
  // is sparse to begin with, so it thins less than the island's).
  builtMap?.root?.traverse((o) => { if (o.userData.clutter) o.count = Math.max(1, Math.round(o.userData.clutter * (o.userData.clutterShare?.[tier] ?? share))); });
}

/* MSAA on the composer's targets per tier. Phones keep 2 even on Low:
   sharpness was the complaint there, and a phone's tiled GPU resolves MSAA
   cheaply. A laptop on Low drops it, since that's a struggling iGPU. */
const MSAA_SAMPLES = { high: 4, medium: 2, low: isTouch ? 2 : 0 };
function setComposerSamples(n) {
  for (const rt of [composer.renderTarget1, composer.renderTarget2]) {
    if (rt.samples === n) continue;
    rt.samples = n;
    rt.dispose();   // reallocated at the new sample count on next use
  }
}

function applyGraphics() {
  const tier = gfxTier();
  applyClutter();
  const out = settings.gfx === "auto" ? tier.toUpperCase() : "";
  for (const id of ["to-set-gfx-out", "to-set-gfx-lobby-out"]) {
    const el = document.getElementById(id);
    if (el) el.textContent = out;
  }
  if (tier === gfxApplied) return;
  gfxApplied = tier;
  const cfg = GFX[tier];
  skyMat.uniforms.uCloudQ.value = tier === "low" ? 0 : tier === "medium" ? 1 : 2;
  ssao.enabled = cfg.ssao;
  bloom.enabled = cfg.bloom;
  setComposerSamples(MSAA_SAMPLES[tier] ?? 2);
  if (sun.shadow.mapSize.x !== cfg.shadowSize) {
    sun.shadow.mapSize.set(cfg.shadowSize, cfg.shadowSize);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;   // three rebuilds it at the new size next frame
  }
}

function setAutoTier(tier) {
  gfxAutoTier = tier;
  try { localStorage.setItem(GFX_AUTO_KEY, tier); } catch { /* private mode */ }
  applyGraphics();
}

/* Dynamic quality. Judged over 2-second windows: under 40 fps steps down,
   over 57 steps up. On Auto it sheds effects BEFORE resolution, so a slow
   device loses SSAO rather than going blurry, and a fast one never leaves
   High. Climbing back up is deliberately slower (3 good windows in a row),
   and a tier that drops straight back under 40 isn't retried this session,
   so it can't flicker between two tiers. The HUD is DOM and stays sharp. */
const MAX_PIXEL_RATIO = Math.min(2, window.devicePixelRatio || 1);
// Phones used to fall to 0.6, which is what made them blurry: effects and
// then the auto tier go first, and the picture stays at least 1:1.
const MIN_PIXEL_RATIO = isTouch ? Math.min(1, MAX_PIXEL_RATIO) : 0.75;
let pixelRatio = renderer.getPixelRatio();
const perfWin = { t: 0, n: 0, cool: 0, good: 0, raised: false };

function setPixelRatioStep(next) {
  if (Math.abs(next - pixelRatio) < 1e-3) return false;
  pixelRatio = next;
  renderer.setPixelRatio(next);
  composer.setPixelRatio?.(next);
  resize();
  return true;
}

function adaptResolution(rawDt) {
  if (gameState !== "playing" || isStaging() || document.hidden || rawDt > 0.5) return;
  perfWin.t += rawDt;
  perfWin.n++;
  perfWin.cool -= rawDt;
  if (perfWin.t < 2) return;
  const fps = perfWin.n / perfWin.t;
  perfWin.t = 0;
  perfWin.n = 0;
  if (perfWin.cool > 0) return;

  const auto = settings.gfx === "auto";
  const tierIdx = GFX_TIERS.indexOf(gfxAutoTier);
  const raised = perfWin.raised;
  perfWin.raised = false;
  perfWin.good = fps > 57 ? perfWin.good + 1 : 0;

  if (fps < 40) {
    if (auto && tierIdx < GFX_TIERS.length - 1) {
      // The tier we just climbed to couldn't hold: stay below it for good.
      if (raised) gfxCeiling = tierIdx + 1;
      setAutoTier(GFX_TIERS[tierIdx + 1]);
      perfWin.cool = 3;
    } else if (setPixelRatioStep(Math.max(MIN_PIXEL_RATIO, pixelRatio - 0.25))) {
      perfWin.cool = 3;
    }
  } else if (fps > 57) {
    if (setPixelRatioStep(Math.min(MAX_PIXEL_RATIO, pixelRatio + 0.125))) {
      perfWin.cool = 3;
    } else if (auto && tierIdx > gfxCeiling && perfWin.good >= 3) {
      setAutoTier(GFX_TIERS[tierIdx - 1]);
      perfWin.good = 0;
      perfWin.raised = true;
      perfWin.cool = 4;
    }
  }
}

function animate() {
  requestAnimationFrame(animate);
  const rawDt = clock.getDelta();
  const dt = Math.min(0.05, rawDt);
  adaptResolution(rawDt);
  const t = clock.elapsedTime;

  if (gameState === "paused" || localPauseOnly) pollGamepadMenu();

  // The map's ambience plays while you're in it (paused included) and fades
  // out back at the menu or on the scoreboard. It's one or the other with the
  // radio: start a song and the ambience fades out, stop it and it fades back.
  const radioOn = music.playing && music.volume > 0;
  ambience.set((gameState === "playing" || gameState === "paused") && loadedMapId && !radioOn ? loadedMapId : null);
  // A map with its own sound or music-driven lights (Trolling Loud's DJ)
  // follows the same rule: on in a match, and it knows when the radio is.
  // In Socialize the club's DJ spins for the room; his record (or else
  // your radio's song) is the clock the lights run on.
  const mapLive = (gameState === "playing" || gameState === "paused") && !!loadedMapId;
  djLulz.setMap(mapLive && isSocial() ? builtMap?.map : null);
  if (djLulz.active) djLulz.update(dt, move.pos);
  const song = djLulz.song() || (radioOn && music.current ? { src: music.current.src, t: music.time } : null);
  builtMap?.map?.onFrame?.({ live: mapLive, radio: radioOn, song });

  // Runs during "gameover", between two matches in a room that stayed up.
  if (intermissionT > 0) {
    updateIntermission(dt);
    net.update(dt, netSnapshot());
  }

  if (gameState === "playing") {
    if (isStaging()) { if (!loadHold) updateStaging(dt); }
    // The clock itself isn't playtime, and nothing hostile moves during it.
    else { elapsedRun += dt; updateMatchClock(dt); }
    const staging = isStaging();

    aimAssistSticky = false;   // re-earned each frame by applyAimAssist
    pollGamepad(dt);
    updatePlayer(dt);
    if (!isRange()) regenPlayer(dt);
    updateWeaponView(dt);
    updateFpEmoteView();

    targetMeshes = [];
    if (staging) {
      if (inSkyLobby()) updateSkyLobby(dt);
      // Hostiles hold still, but remote operators and bots still stream in so
      // the room visibly fills while the player waits.
      if (isPvp()) {
        // Bot hosting can only be decided once the room connects, which can
        // land a beat after the countdown starts (and joining resets the peer
        // map the bots are mirrored into): fill and re-publish them here, not
        // only at GO, so the countdown (and the match intro) has somebody in
        // it. publishBot throttles its own network sends.
        if (!royale && net.isBotHost()) {
          if (!bots.bots.length && !noBotsRoom() && !isInfection()) {
            const { humans, teams } = humanHeadcount();
            bots.fill(botTarget(), humans, botSpawn, !!currentMode().ffa, teams);
            net.botCount = bots.bots.length;
          }
          for (const b of bots.bots) net.publishBot(b);
        }
        net.update(dt, netSnapshot());
        remotes.sync(net.peers);
        remotes.update(dt, net.team, !!currentMode().ffa);
        updateRemoteSabers();
      }
    } else if (isRange()) {
      rangeSet.update(dt);
      targetMeshes = rangeSet.hitMeshes();
      // The hitbox lab clears the plates away so only its trolls take rounds.
      if (hitboxLab) {
        hitboxLab.update(dt);
        targetMeshes = hitboxLab.hitMeshes();
        for (const t of rangeSet.targets) t.mesh.visible = false;
      }
      // Ammo and gear are free here — the range is for testing, not rationing.
      const w = currentWeapon();
      w.ammoReserve = w.def.reserveMax;
      player.gear.lethal = loadout.carried("lethal");
      player.gear.tactical = loadout.carried("tactical");
      player.hp = Math.min(player.maxHp, player.hp + dt * 12);
      // Bots spawned via the range's "Spawn a bot" button (spawnRangeBot)
      // keep steering/animating here — this whole block is a no-op for
      // anyone who never clicked that button.
      if (bots.count) {
        bots.update(dt, {
          colliders, arena: ARENA, ffa: true,
          // Real targets (including the player) so they walk/strafe/chase
          // with natural variety instead of just idling in place - onShoot
          // is a no-op so they never actually damage you here.
          targets: botTargets(),
          onShoot: () => {},
          spawnFor: botSpawn,
          sightBlocked: (a, b) => grenades.blocksSight(a, b),
        });
        for (const b of bots.bots) net.publishBot(b);
        net.update(dt, netSnapshot());
        remotes.sync(net.peers);
        remotes.update(dt, net.team, true);
        updateRemoteSabers();
      }
    } else if (isZombies()) {
      const roundOver = zdir.update(dt, player.pos, onZombieAttack, move.pos.y);
      if (roundOver) nextZombieRound();
      for (const ev of zdir.events.splice(0)) {
        if (ev.type === "maxammo") zombieMaxAmmo();
        else if (ev.type === "shriek") audio.zombieShriek(ev.at);
        else if (ev.type === "groan") audio.zombieGroan(ev.at, ev.voice);
        else if (ev.type === "snarl") audio.zombieSnarl(ev.at, ev.voice);
        else if (ev.type === "death") audio.zombieDeath(ev.at, ev.voice);
      }
      els.hudHostiles.textContent = String(zdir.remaining);
      els.hudKills.textContent = zdir.points.toLocaleString();
      targetMeshes = zdir.hitMeshes();
    } else if (isView()) {
      // View mode: an empty map, nothing to simulate.
    } else if (!isPvp() && spawner) {
      spawner.update(dt, player.pos, onGruntAttack);
      els.hudHostiles.textContent = String(spawner.aliveCount + spawner.toSpawn);
      if (spawner.isWaveClear()) nextWave();
      for (const g of spawner.grunts) if (g.alive && !g.dying) targetMeshes.push(...g.rig.hitboxMeshes);
    } else {
      const ffa = !!currentMode().ffa;

      syncRoomBotSkill(dt);
      // Exactly one client simulates the bots and publishes them as peers, so
      // everyone else needs no bot-specific code at all.
      if (net.isBotHost()) {
        const { humans, teams } = humanHeadcount();
        // Infection's sides change all match long; padding them back to even
        // would undo every infection, so it just fills the room.
        bots.fill(noBotsRoom() ? 0 : botTarget(), humans, botSpawn, ffa || isInfection(), isInfection() ? null : teams);
        net.botCount = bots.bots.length;
        if (isInfection()) sortInfectionBots();
        if (currentMode().funny) assignBotHeroes();
        bots.update(dt, {
          colliders, arena: ARENA, ffa,
          targets: botTargets(),
          onShoot: onBotShoot,
          // Weapon-decided modes (One in the Chamber, Gun Game) stay gun-only.
          onThrow: currentMode().noBotNades ? null : botThrow,
          onMelee: botMelee,
          spawnFor: botSpawn,
          sightBlocked: (a, b) => grenades.blocksSight(a, b),
          objectiveFor: botObjective,
          isBusy: botBusy,
          stairs: k9Stairs(),
          sightRange: royale ? royaleBotSight : null,
          noRespawn: isSnd() || isRoyale(),
          lodNear: isRoyale() ? humanEyes() : null,
        });
        updateBotStreaks(dt);
        updateBotAntiAir(dt);
        for (const b of bots.bots) net.publishBot(b);
      } else if (bots.count) {
        for (const b of bots.bots) net.dropBot(b.id);
        bots.clear();
      }

      net.update(dt, netSnapshot());
      remotes.sync(net.peers);
      remotes.update(dt, net.team, ffa, camera.position);
      updateRemoteSabers();
      updateKillcam(dt);
      targetMeshes = remotes.hitMeshes(ffa ? null : net.team);
      for (const e of streakEntities.values()) {
        if (e instanceof K9Pack && k9Hostile(e)) targetMeshes.push(...e.hitMeshes());
        else if (e instanceof SamTurret && streakHostileToMe(e)) targetMeshes.push(...e.hitMeshes());
      }
      for (const a of enemyAirFor(net.team, net.id)) {
        if (a.e instanceof Dragonfire) targetMeshes.push(...a.e.hitMeshes());
        else if (a.e.hitbox && a.e.hp > 0) targetMeshes.push(a.e.hitbox);
      }

      if (isSocial()) { updateBar(dt); townNpcs?.update(dt, camera.position); }   // the hangout: the saloon bar owns hold X; the townsfolk
      else if (scavengeAllowed()) { pickups.update(dt); updatePickupPrompt(dt); }
      else {
        if (pickups.drops.length) pickups.clear();
        // Troll Royale has no scavenge drops, but its guns on the ground
        // (floor loot and whatever the dead leave) use the same hold-X prompt.
        if (isRoyale()) updatePickupPrompt(dt);
      }

      if (isInfection()) updateInfection(dt);

      if (hill) {
        if (hill.update(dt)) { setHillMarker(hill); showWaveBanner("Hill moved", 1300); }
        hillAcc += dt;
        if (hillAcc >= 1) { hillAcc = 0; scoreHill(); }
      }

      if (isSnd()) {
        updateSnd(dt);
      } else if (isRoyale()) {
        updateRoyale(dt);
      } else if (!player.alive) {
        respawnT -= dt;
        els.respawnText.textContent = `Down — back in ${Math.max(1, Math.ceil(respawnT))}`;
        if (respawnT <= 0) respawnPlayer();
      } else if (player.spawnGuard > 0) {
        player.spawnGuard -= dt;
        if (player.spawnGuard <= 0) { player.spawnGuard = 0; updateSpawnGuardHud(); }
        else if (els.spawnGuard?.hidden) updateSpawnGuardHud();
      }
    }

    grenades.update(dt, grenadeCtx());
    grenades.updateSmoke(dt, camera);
    updateBlastLights(dt);

    bullets.update(dt, {
      colliders,
      targetMeshes,
      resolveTarget: resolveBulletTarget,
      onActorHit: onBulletActorHit,
      onTrace: hitboxLab?.onTrace,
      // Someone else's round striking a wall throws the same dust, a touch
      // lighter — it's the "they're shooting at that corner" cue.
      onWorldHit: (point, cosmetic, hit = {}) => {
        impactFx.hit(point, { normal: hit.normal, dir: hit.dir, surface: hit.ground ? "ground" : "concrete", scale: cosmetic ? 0.6 : 1 });
        // Burning pellets lick the surface they land on (a few per shot).
        if (hit.def?.hellfire && Math.random() < (cosmetic ? 0.25 : 0.4)) hellfire.lick(point, hit.normal);
        audio.impact(point);
        // maps with things that react to being shot (Hollowgrin's tin trolls)
        builtMap?.map?.onShot?.(point);
      },
      bounds: ARENA,
    });
    impactFx.update(dt, camera, renderer);
    hellfire.update(dt);
    hellfireView.update(dt);

    // HUD updates — each only touches the DOM when its value actually changed.
    const w = currentWeapon();
    const hpPct = (player.hp / player.maxHp) * 100;
    if (hpPct !== hudCache.hpPct) { hudCache.hpPct = hpPct; els.hpFill.style.width = `${hpPct}%`; }
    const hpLow = player.hp < 30;
    if (hpLow !== hudCache.hpLow) { hudCache.hpLow = hpLow; els.hpFill.classList.toggle("is-low", hpLow); }
    const hpText = Math.ceil(player.hp);
    if (hpText !== hudCache.hpText) { hudCache.hpText = hpText; els.hpText.textContent = hpText; }
    if (w.ammoInMag !== hudCache.ammoCur) { hudCache.ammoCur = w.ammoInMag; els.ammoCur.textContent = w.ammoInMag; }
    if (w.ammoReserve !== hudCache.ammoRes) { hudCache.ammoRes = w.ammoReserve; els.ammoRes.textContent = w.ammoReserve; }
    const reloadHidden = !w.reloading;
    if (reloadHidden !== hudCache.reloadHidden) { hudCache.reloadHidden = reloadHidden; els.reloadTag.hidden = reloadHidden; }
    if (w.ads !== hudCache.ads) {
      hudCache.ads = w.ads;
      // Raising/lowering the sight was the one silent transition on the gun —
      // every other action (fire, reload, inspect) already has a cue.
      audio.ads(w.ads);
    }
    // First person aims through the gun's own sight, so the crosshair goes.
    // Third person has no sight picture (the camera sits over the shoulder),
    // so it stays, tightened, or aiming in left you with nothing to aim by.
    const adsTp = w.ads && (settings.thirdPerson || emoteIsTp());
    const adsHide = w.ads && !adsTp;
    if (adsHide !== hudCache.adsHide || adsTp !== hudCache.adsTp) {
      hudCache.adsHide = adsHide;
      hudCache.adsTp = adsTp;
      els.crosshair.classList.toggle("is-ads", adsHide);
      els.crosshair.classList.toggle("is-ads-tp", adsTp);
    }
    const lowhp = player.hp < 25 && !royaleSpectating();
    if (lowhp !== hudCache.lowhp) { hudCache.lowhp = lowhp; els.lowhp.classList.toggle("is-low", lowhp); }

    // A cooked grenade keeps ticking in your hand, and can go off in it.
    // Only cookable ones: a smoke held down used to burn its fuse
    // in your hand too, with no cook bar to warn you.
    if (cooking.def && cooking.def.cookable) {
      cooking.fuse -= dt;
      els.cook.hidden = false;
      els.cookFill.style.width = `${Math.max(0, (cooking.fuse / cooking.def.fuse) * 100)}%`;
      if (cooking.fuse <= 0) {
        const held = cooking.def;
        cooking.fuse = 0;
        releaseCook({ cookedOff: true });   // spent in the hand…
        const at = player.pos.clone();
        publishBoom(nextNadeId(), held, at);
        explosionFx(held, at);       // …and detonates right there
        if (held.damage > 0) areaDamage(at, held.radius, held.damage, held, {});
        if (held.blind) flashPlayer(at, held);
        if (held.emp) empPlayer(at, held);
        if (held.smoke) grenades.spawnSmoke(held, at);
      }
    }

    blindT = Math.max(0, blindT - dt);
    els.blind.style.opacity = String(Math.min(1, blindT * 0.85));

    const wasEmp = empT > 0;
    empT = Math.max(0, empT - dt);
    if (wasEmp !== empT > 0 || empT > 0) applyEmpState(empT > 0);

    // Standing in your own smoke should cost you the same visibility it
    // costs everyone else.
    // Capped well below opaque: inside the cloud you lose the room, but you
    // keep your weapon and your footing. A full whiteout just reads as broken.
    const haze = grenades.densityAt(camera.position);
    els.smoke.style.opacity = String(haze * 0.66);

    shakeT = Math.max(0, shakeT - dt);
    if (shakeT <= 0) shakeMag = 0;

    hitFlashT = Math.max(0, hitFlashT - dt * 4);
    updateHitDirs(dt);
    els.hitflash.classList.toggle("is-hit", hitFlashT > 0.05);
    impactPass.uniforms.uHitFlash.value = hitFlashT;
    impactPass.uniforms.uLowHp.value = player.hp < 25 ? 1 : 0;
    impactPass.uniforms.uAberration.value = Math.min(1, w.viewKickKnockback * 6);
    impactPass.uniforms.uTime.value = t;
    suppressT = Math.max(0, suppressT - dt * 1.1);
    impactPass.uniforms.uSuppress.value = suppressT;
    updateUavState();
    updateStreakEntities(dt);
    updateHero(dt);
    drawMinimap();

    // fov kick based on sprint/ads
    const def = w.def;
    let targetFov = baseFov;
    if (w.ads) targetFov = baseFov * def.adsFovMult;
    if (move.sprinting && !w.ads) targetFov = baseFov * 1.06;
    if (move.stance === STANCE.SLIDE) targetFov = baseFov * 1.12;
    if (swivel.dir) targetFov = baseFov * (1 + 0.1 * Math.sin(Math.PI * swivelK()));
    if (warshipView()) targetFov = warshipFov();
    if (matchIntro.active) targetFov = baseFov * 0.7;   // a longer lens for the cinematic
    camera.fov = killcamFov(baseFov) ?? camera.fov + (targetFov - camera.fov) * Math.min(1, dt * 10);
    camera.updateProjectionMatrix();

    // Tube optics narrow the viewmodel lens as well, so the eyepiece fills
    // a useful part of the screen instead of a coin in the middle.
    const vm = activeWeaponMesh?.userData;
    const adsWeaponFov = player.holding !== "melee" && player.holding !== "streak" && vm?.adsWeaponFov ? vm.adsWeaponFov : 50;
    const targetWeaponFov = 58 + (adsWeaponFov - 58) * w.adsT;
    weaponCamera.fov = killcamWeaponFov() ?? weaponCamera.fov + (targetWeaponFov - weaponCamera.fov) * Math.min(1, dt * 10);
    weaponCamera.updateProjectionMatrix();

    animDebug.update();
  }

  if (gameState === "menu") {
    updateLobbyCamera(dt);
    pollMenuEmotePad();
    if (inspectorLive && !els.title.hidden) inspector?.tick(dt);
    if (charInspectorLive && !els.title.hidden) charInspector?.tick(dt);
    if (charInspectorLive && !els.title.hidden) sumInspector?.tick(dt);
  }

  sky.position.copy(camera.position);
  // The BO2 menu's planet (menu-bo2.js) covers the whole lobby: skip
  // drawing the arena nobody can see behind it.
  // Nor anything under the loading screen until the match is set up there.
  if (!(gameState === "menu" && (document.body.classList.contains("to-bo2-cover") || loadScreen.isOpen))) composer.render();

  // The FP viewmodel (gun+arms) only makes sense in first person — the gun
  // is already visible on the third-person rig itself, so rendering both
  // would double up the weapon on screen.
  // Spectating in Troll Royale: the view is someone else's, so no gun of ours.
  // Dead (and not in a replay): no gun on screen, the camera is on the body.
  // Socialize draws no gun, only its free hands (socialArmsFrame).
  if (gameState === "playing" && !matchIntro.active && ((player.alive && !isView() && !settings.thirdPerson && !emoteIsTp() && !royaleSpectating() && !royaleDropView() && !warshipView() && !dragonfireView()) || killcam.replaying)) {
    renderer.autoClear = false;
    renderer.clearDepth();
    placeRodWatch();
    renderer.render(weaponScene, weaponCamera);
    renderer.autoClear = true;
  }
}

const _euler = new THREE.Euler(0, 0, 0, "YXZ");
const _listenFwd = new THREE.Vector3();
const _listenUp = new THREE.Vector3();
let stepPhase = 0;

// -------------------- third-person camera (spring arm) --------------------
// Chase camera behind the player's own rig. Distance/side offset blend
// in from an over-the-shoulder position as ADS deepens (w.adsT), rather
// than snapping to first-person the way most third-person shooters with
// real iron sights do - this game keeps the model visible while aiming.
const TP_HIP_DIST = 3.2;
const TP_HIP_SIDE = 0.55;       // shoulder offset, hip-fire framing
const TP_ADS_DIST = 1.5;
const TP_ADS_SIDE = 0.5;
const TP_HEIGHT = 0.35;
const _tpPivot = new THREE.Vector3();
const _tpDesired = new THREE.Vector3();
const _tpDir = new THREE.Vector3();
const _tpRight = new THREE.Vector3();
const _tpForward = new THREE.Vector3();

/* Places `camera` behind `pivot` along the look direction (yaw/pitch),
   pulled in by raycastWorld so it never clips through a wall/floor. */
/* While emoting the camera swings round in front, a little above, and
   looks back at the operator's chest — the locker-room angle — pulled in
   if a wall is in the way. `pivot` is the eye position. */
function updateEmoteCamera(pivot, yaw, duoDist = 0) {
  _euler.set(0, yaw, 0);
  _tpForward.set(0, 0, -1).applyEuler(_euler);
  _tpPivot.copy(pivot);
  _tpPivot.y -= 0.45;
  // A duo: look at the pair from a three-quarter angle, centred between
  // them (a straight side view shows both flat trollfaces edge-on).
  if (duoDist) {
    _tpPivot.addScaledVector(_tpForward, duoDist / 2);
    _euler.set(0, yaw + 0.95, 0);
    _tpForward.set(0, 0, -1).applyEuler(_euler);
  }
  _tpDir.copy(_tpForward).multiplyScalar(duoDist ? 3.3 : 2.7);
  _tpDir.y += 0.5;
  const wantLen = _tpDir.length();
  _tpDir.normalize();
  const safeLen = Math.max(0.6, raycastWorld(colliders, _tpPivot, _tpDir, wantLen) - 0.15);
  camera.position.copy(_tpPivot).addScaledVector(_tpDir, safeLen);
  camera.lookAt(_tpPivot);
}

function updateThirdPersonCamera(pivot, yaw, pitch, adsT) {
  // A U Mad Bro? hero body is far wider than the stick figure (the Knight's
  // head and pauldrons): sit further back and further out so it never
  // covers the crosshair.
  const big = localRig.heroBodyId ? 1 : 0;
  const dist = TP_HIP_DIST + (TP_ADS_DIST - TP_HIP_DIST) * adsT + big * 0.5;
  const side = TP_HIP_SIDE + (TP_ADS_SIDE - TP_HIP_SIDE) * adsT + big * 0.32;

  _euler.set(pitch, yaw, 0);
  _tpForward.set(0, 0, -1).applyEuler(_euler);
  _tpRight.set(1, 0, 0).applyEuler(_euler);

  _tpPivot.copy(pivot);
  _tpDesired.copy(_tpPivot)
    .addScaledVector(_tpForward, -dist)
    .addScaledVector(_tpRight, side);
  _tpDesired.y += TP_HEIGHT;

  _tpDir.copy(_tpDesired).sub(_tpPivot);
  const wantLen = _tpDir.length();
  _tpDir.normalize();
  // Pull the camera in toward the pivot if the desired spot is behind a
  // wall/floor — a small skin width keeps it from resting exactly on the
  // surface and clipping into it.
  const safeLen = Math.max(0.15, raycastWorld(colliders, _tpPivot, _tpDir, wantLen) - 0.1);

  camera.position.copy(_tpPivot).addScaledVector(_tpDir, safeLen);
  // Look along the aim from over the shoulder, parallel to it, rather than
  // back across at the pivot: converging on the pivot ran the line of sight
  // through our own head, which filled the middle of the screen in ADS.
  camera.lookAt(
    camera.position.x + _tpForward.x * 10,
    camera.position.y + _tpForward.y * 10,
    camera.position.z + _tpForward.z * 10,
  );
  // Aiming in, our own face ghosts out so the left of the sight picture is
  // clear; pulled in tight against a wall it would be in the way outright.
  const head = localRig.parts.head;
  head.visible = safeLen > 0.9;
  head.material.opacity = 1 - 0.7 * adsT;
  head.material.depthWrite = adsT < 0.1;
}

let localLower = 0;
/* Third-person shooting and reloading (character.js _gripSupport): when we
   last fired, and how far through the current reload we are (0 = none). */
let localShotAt = -Infinity;
function localReloadK() {
  const w = currentWeapon();
  return w?.reloading && w.reloadTime > 0 ? Math.min(0.999, Math.max(0.001, 1 - w.reloadT / w.reloadTime)) : 0;
}
/* A bot fired: its body brings the gun up (remote humans: net.js "shot"). */
function noteRigShot(id) {
  const p = net.peers.get(id);
  if (p) p.shotAt = performance.now();
}
let localThrowT = 0;   // the third-person body's overhand throw, counting down
let localBlockT = 0;   // the third-person body in the saber guard, 0..1

/* Positions and poses the local player's own humanoid rig every frame -
   same buildHumanoid/poseHumanoid contract remote-players.js drives other
   operators with, fed from this client's own authoritative move/look state
   instead of reconstructed network deltas. Runs regardless of view mode
   (cheap, and keeps the rig ready the instant third person is toggled on)
   but only actually matters visually while localRig.root.visible is true. */
/* ---------------- Swivel (user: a basketball spin move) ----------------
   Running forward, double-tap A or D (a pad: click the left or right
   stick) and the body spins a full 360 on the spot toward that side and
   comes out of it SWIVEL_SIDE metres over to that side, still running.
   Left spins to the body's left first (flip SWIVEL_LEFT_SIGN to reverse).
   Everyone else sees the spin (`sv` on the state packet: side * count); in
   first person it's a quick roll and FOV kick rather than a full turn of
   the camera. */
const SWIVEL_TIME = 0.5;
const SWIVEL_SIDE = 0.9;          // metres gained toward that side
const SWIVEL_COOLDOWN = 0.35;     // after one ends
const SWIVEL_TAP = 0.28;          // seconds between the two taps
const SWIVEL_LEFT_SIGN = 1;       // +1: a left swivel turns left first (yaw grows to the left)
const swivel = { t: 0, dir: 0, yaw: 0, cd: 0, seq: 0, prevK: 0 };
const swivelTaps = { KeyA: 0, KeyD: 0 };
function swivelK() { return swivel.dir ? Math.min(1, swivel.t / SWIVEL_TIME) : 0; }
function swivelEase(k) { return k * k * (3 - 2 * k); }
/* `dir` -1 left, +1 right. Needs to be running forward on the ground. */
function trySwivel(dir) {
  if (swivel.dir || swivel.cd > 0 || !player.alive || localPauseOnly || stageFrozen()) return false;
  if (!move.grounded || move.busy || move.stance !== STANCE.STAND) return false;
  const fwd = -(move.velocity.x * Math.sin(look.yaw) + move.velocity.z * Math.cos(look.yaw));
  if (fwd < 1.5) return false;
  swivel.dir = dir;
  swivel.lastDir = dir;
  swivel.t = 0;
  swivel.prevK = 0;
  swivel.yaw = look.yaw;
  swivel.seq = (swivel.seq % 999) + 1;
  audio.slide?.();
  return true;
}
/* Per frame after the move: shift sideways along the swivel's arc. */
function updateSwivel(dt) {
  swivel.cd = Math.max(0, swivel.cd - dt);
  if (!swivel.dir) return;
  swivel.t += dt;
  const k = swivelK();
  const step = (swivelEase(k) - swivelEase(swivel.prevK)) * SWIVEL_SIDE * swivel.dir;
  swivel.prevK = k;
  // Right of the heading the swivel started on: (cos, 0, -sin).
  move.pos.x += Math.cos(swivel.yaw) * step;
  move.pos.z -= Math.sin(swivel.yaw) * step;
  move.resolveHorizontal(move.pos, move.pos.y);
  if (k >= 1 || !player.alive) { swivel.dir = 0; swivel.cd = SWIVEL_COOLDOWN; }
}
/* The body's extra turn for a swivel of `dir` at `k` (0..1), radians. */
function swivelSpin(dir, k) {
  return -dir * SWIVEL_LEFT_SIGN * Math.PI * 2 * swivelEase(Math.max(0, Math.min(1, k)));
}

/* Dead, between the killcam and the respawn (or with no killcam at all):
   your own body lies where you fell, weapons gone from it and from the
   screen (user: show the dead body, not the guns). Timed off kcClock, so a
   fall the killcam already played stays settled rather than replaying. */
let localDeadAt = 0;
function noteLocalDeath() {
  localDeadAt = kcClock;
  localRig.death = null;
}
function updateLocalDeadBody() {
  localRig.root.visible = true;
  localRig.parts.head.visible = true;
  localRig.root.position.set(move.pos.x, move.pos.y, move.pos.z);
  if (localHeld.mesh) localHeld.mesh.visible = false;
  weaponRig.visible = false;
  poseDeath(localRig, Math.min(1, (kcClock - localDeadAt) / DEATH_TIME));
}
const _deathCamAt = new THREE.Vector3(), _deathCamDir = new THREE.Vector3();
/* Looking down at the body from a little behind and above, drifting slowly
   round it; pulled in off walls like the third-person camera. */
function placeDeathCamera() {
  const t = kcClock - localDeadAt;
  const a = look.yaw + 0.5 + t * 0.12;
  _deathCamAt.set(move.pos.x, move.pos.y + 0.35, move.pos.z);
  _deathCamDir.set(Math.sin(a) * 2.6, 2.4, Math.cos(a) * 2.6);
  const want = _deathCamDir.length();
  _deathCamDir.normalize();
  const len = Math.max(0.6, raycastWorld(colliders, _deathCamAt, _deathCamDir, want) - 0.15);
  camera.position.copy(_deathCamAt).addScaledVector(_deathCamDir, len);
  camera.lookAt(_deathCamAt);
}

function updateLocalRig(dt) {
  if (!player.alive && gameState === "playing" && !royaleSpectating()) { updateLocalDeadBody(); return; }
  localRig.root.position.set(move.pos.x, move.pos.y, move.pos.z);
  // The body follows the aim a beat behind; the head leads the turn.
  const rolling = royaleRolling();
  // Under the glider the body hangs the way the wing flies, not where you look.
  const gliding = royale?.me === "glide" && royale.flight;
  aimRig(localRig, rolling ? royale.rollYaw : gliding ? royale.flight.heading : look.yaw, dt, { moving: move.moving, snap: rolling });
  if (swivel.dir) localRig.root.rotation.y += swivelSpin(swivel.dir, swivelK());

  const wantLower = rolling ? 1 : STANCE_LOWER[move.stance] ?? 0;
  localLower += (wantLower - localLower) * Math.min(1, dt * 8);

  // Signed forward/strafe relative to facing, same convention
  // remote-players.js derives from position deltas - here it's exact,
  // straight off the velocity vector and yaw.
  const sin = Math.sin(look.yaw), cos = Math.cos(look.yaw);
  const vx = move.velocity.x, vz = move.velocity.z;
  const speed = Math.hypot(vx, vz);
  const rightX = cos, rightZ = -sin;
  const fwdX = -sin, fwdZ = -cos;
  let strafe = 0, forward = 1;
  if (speed > 0.05) {
    strafe = Math.max(-1, Math.min(1, (vx * rightX + vz * rightZ) * 6));
    forward = Math.max(-1, Math.min(1, (vx * fwdX + vz * fwdZ) * 6));
  }
  const gaitSpeed = Math.max(0, Math.min(1, speed / 4.2));

  if (move.moving) localPhase += dt * gaitPhaseRate(speed);

  // What's in the hands: the melee weapon while it's held or mid-swing
  // (a quick melee swings it without putting the gun away), else the gun.
  const swinging = !!player.melee?.busy;
  const hold = socialUnarmed() ? "none"   // the hangout: empty hands
    : player.holding === "melee" || swinging ? "melee"
    : player.holding === "gun" ? "gun" : "none";
  const def = currentWeapon()?.def;
  syncLocalRigHeld(hold, def);

  if (emoteWheel.isOpen && (!player.alive || gameState !== "playing")) emoteWheel.close(true);
  updateDuo(dt);
  if (validEmote()) {
    emote.t += dt;
    if (move.moving || !player.alive || gameState !== "playing" || emote.t > emoteSeconds(emote.idx)) stopEmote();
  }
  if (seated && emote) standUp();   // an emote is a standing thing: get up for it
  if (localHeld.mesh) localHeld.mesh.visible = !emote;
  els.hud.classList.toggle("is-emoting", emoteIsTp());
  if (!isSocial() || emote) syncLocalDrink(false);
  if (emote) {
    poseEmoteCode(localRig, emoteCode(emote.idx, emote.role), emote.t);
    return;
  }

  poseHumanoid(localRig, {
    phase: localPhase,
    moving: move.moving && move.grounded,
    pitch: look.pitch,
    lower: localLower,
    strafe,
    forward,
    speed: gaitSpeed,
    mps: speed,
    dt,
    hold,
    hasGun: hold === "gun" && def?.cls !== "sidearm",
    swing: swinging ? {
      t: Math.min(1, player.melee.t / player.melee.total),
      kind: player.melee.swingIndex % 2 === 0 ? "swing" : "thrust",
    } : null,
    recoil: hold === "gun" ? Math.min(1, (currentWeapon()?.viewKickKnockback || 0) * 7) : 0,
    ads: hold === "gun" ? currentWeapon()?.adsT || 0 : 0,
    fired: (performance.now() - localShotAt) / 1000,
    reload: hold === "gun" ? localReloadK() : 0,
    block: localBlockT = damp(localBlockT, saberBlock.active || kbShield.active ? 1 : 0, 14, dt),
    parry: saberParry.sample(),
  });
  // Third person, mid-repair: the board held flat across the body and
  // shaken about while it gets fixed.
  if (kbRepair.active && localHeld.mesh && hold === "melee") {
    localHeld.mesh.rotation.set(-Math.PI / 2 + Math.sin(kbRepair.t * 9) * 0.15, Math.sin(kbRepair.t * 13) * 0.2, Math.PI / 2);
  } else if (localHeld.mesh && hold === "melee") localHeld.mesh.rotation.set(0, 0, 0);
  if (localThrowT > 0) {
    localThrowT = Math.max(0, localThrowT - dt);
    poseThrowArm(localRig, 1 - localThrowT / THROW_TIME);
  }
  if (isSocial()) syncLocalDrink(true);   // the saloon bar: a drink in hand
  // Sat down (rp-roles.js); at the piano, both hands on the keys.
  if (seated && isSocial()) {
    if (seated.s.kind === "piano") posePianoArms(localRig, piano.t += dt, 0.3, piano.playing);
    poseSeated(localRig, seated.s.y, seated.s.kind === "stool" ? 0.55 : 0);
  }
  rollRig(localRig, royaleRollK());
  // Skydiving, then hanging under the glider (seen in the drop camera).
  const dropCode = royaleDropCode();
  if (dropCode === DROP_FALL || dropCode === DROP_GLIDE) {
    localDropT += dt;
    poseDrop(localRig, dropCode, localDropT);
    if (localHeld.mesh) localHeld.mesh.visible = false;
  }
}
let localDropT = 0;

/* The third-person body carries the same gun or melee weapon the first-
   person view shows. Rebuilt only when what's held changes. */
const localHeld = { key: null, mesh: null };
function syncLocalRigHeld(hold, def) {
  const key = hold === "gun" ? `gun:${def?.id}:${def?.attachments?.skin || ""}` : hold === "melee" ? `melee:${player.melee?.def?.id}` : "none";
  if (key === localHeld.key) return;
  localHeld.key = key;
  if (localHeld.mesh) {
    localHeld.mesh.parent?.remove(localHeld.mesh);
    localHeld.mesh.traverse((o) => { if (!o.geometry?.userData.shared) o.geometry?.dispose?.(); });
    localHeld.mesh = null;
  }
  if (hold === "gun" && def) {
    localHeld.mesh = stripLights(buildWeaponMesh(def));
    mountHeldWeapon(localRig, localHeld.mesh);
  } else if (hold === "melee" && player.melee?.def) {
    // No first-person hands on it: the body's own mitt holds it.
    localHeld.mesh = buildMeleeMesh(player.melee.def, false, { held3p: true });
    localHeld.mesh.scale.setScalar(1.1);
    localHeld.mesh.userData.meleeId = player.melee.def.id;
    localRig.parts.gripR.add(localHeld.mesh);
    // Built lit; it ignites in third person too, slowly when equipped.
    const sv = localHeld.mesh.userData.saber || localHeld.mesh.userData.halo;
    if (sv) { sv.snapOff(); sv.ignite(player.holding === "melee" && !player.melee.busy ? SLOW_IGNITE : undefined); }
  }
  localHeld.mesh?.traverse((o) => { if (o.isMesh) o.castShadow = true; });
}

/* Last value written to each per-frame HUD node. The DOM write itself is
   cheap, but it was unconditional — every one of these touched layout/paint
   60×/sec even sitting still with full ammo and health. Comparing first
   means the browser only does anything the frame a number actually moves. */
const hudCache = { hpPct: -1, hpLow: null, hpText: -1, ammoCur: -1, ammoRes: -1, reloadHidden: null, ads: null, adsHide: null, adsTp: null, lowhp: null };

/* Passive regen: health climbs back to full on its own once you've been out
   of a fight for a beat, instead of every scratch being permanent until the
   next respawn (there is no med pickup). The delay after the last hit is
   what keeps trading meaningful — regen never starts mid-fight. */
const REGEN_DELAY = 4.5;   // seconds since last hit before regen kicks in
const REGEN_RATE = 12;     // hp per second once it starts

function regenPlayer(dt) {
  if (!player.alive || player.hp >= player.maxHp) return;
  if (performance.now() - player.lastHurtAt < REGEN_DELAY * 1000) return;
  player.hp = Math.min(player.maxHp, player.hp + REGEN_RATE * dt);
}

/* View mode's camera: flies where you look, through everything, no gravity.
   Space / jump up, C / Ctrl / crouch down, Shift (or the stick pushed all
   the way) for speed. */
const VIEW_FLY_SPEED = 12;
function flyView(dt, ix, iz) {
  const gp = gamepadState.connected;
  const up = keys.has("Space") || (isTouch && touchState.jump) || (gp && gamepadState.jump) ? 1 : 0;
  const down = keys.has("KeyC") || keys.has("ControlLeft") || (isTouch && touchState.crouch) || (gp && gamepadState.crouch) ? 1 : 0;
  const fast = keys.has("ShiftLeft") || ((isTouch || gp) && iz > 0.9) ? 3.5 : 1;
  const sp = VIEW_FLY_SPEED * fast * dt;
  const cy = Math.cos(look.yaw), sy = Math.sin(look.yaw), cp = Math.cos(look.pitch);
  move.pos.x += (-sy * cp * iz + cy * ix) * sp;
  move.pos.z += (-cy * cp * iz - sy * ix) * sp;
  move.pos.y = Math.max(-30, move.pos.y + (Math.sin(look.pitch) * iz + up - down) * sp);
  move.velocity.set(0, 0, 0);
}

/* Seconds a trigger pull keeps you out of a sprint (updatePlayer). */
const FIRE_SPRINT_HOLD = 0.35;
let fireSprintHoldT = 0;

function updatePlayer(dt) {
  const w = currentWeapon();

  if (streakHoldT > 0 && !streakHoldUntilMark) {
    streakHoldT -= dt;
    if (streakHoldT <= 0) endStreakHold();
  }

  const gp = gamepadState.connected;

  // The pad's own assist runs in pollGamepad off stick deflection; touch
  // gets the same while a thumb is down on the look pad, and mouse or
  // trackpad while it's being moved. aimAssistSticky is left set from the
  // pad's pass this frame, so only clear it when nothing is steering.
  const mouseSteering = controls.isLocked && performance.now() - mouseLookAt < MOUSE_ACTIVE_MS;
  const canAssist = player.alive && !isStaging() && !dragonfireView();
  if (canAssist && touchState.looking) applyAimAssist(dt);
  if (canAssist && mouseSteering) applyAimAssist(dt, AIM_ASSIST_MOUSE_PULL);

  if ((isTouch &&(touchState.lookDX || touchState.lookDY)) || (gp && (gamepadState.lookDX || gamepadState.lookDY))) {
    const ls = lookSensScale();
    look.yaw -= (touchState.lookDX + gamepadState.lookDX) * ls;
    look.pitch -= (touchState.lookDY + gamepadState.lookDY) * ls;
    look.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, look.pitch));
    touchState.lookDX = 0; touchState.lookDY = 0;
    gamepadState.lookDX = 0; gamepadState.lookDY = 0;
  }

  let ix = 0, iz = 0;
  if (isTouch) {
    ix += touchState.moveX;
    iz += -touchState.moveY;
  }
  if (gp) {
    ix += gamepadState.moveX;
    iz += -gamepadState.moveY;
  }
  if (!isTouch && !gp) {
    if (keys.has("KeyW")) iz += 1;
    if (keys.has("KeyS")) iz -= 1;
    if (keys.has("KeyA")) ix -= 1;
    if (keys.has("KeyD")) ix += 1;
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
  dfIx = ix; dfIz = iz;   // the Dragonfire flies off the same stick
  // The saloon bar: a few drinks in, the walk wanders side to side.
  if (bar.tipsy > TIPSY.onset && isSocial() && (ix || iz)) ix = Math.max(-1, Math.min(1, ix + tipsyFx(bar.tipsy, performance.now() / 1000).stagger * 0.45));
  const frozen = dropping || rolling || !player.alive || stageFrozen() || localPauseOnly || !!strikeTablet?.isOpen || warshipView() || dragonfireView();
  if (frozen) { ix = 0; iz = 0; }
  // The landing roll carries you forward along the glider's line.
  if (rolling) {
    updateRoyaleRoll(dt);
    iz = Math.max(0, 1 - royaleRollK()) * (ROLL_SPEED / 4.2);
  }
  // A toggled AIM shouldn't survive a death or a streak call.
  if (touchState.ads && (!player.alive || player.holding === "streak")) setTouchAds(false);

  // Q aims as well as right mouse.
  // An EMP kills the optic, so there is nothing to aim down until it clears.
  // Calling a streak swaps the hands to the streak device/marker, so the
  // primary's optic has no business popping up over it (that's the "scoped
  // weapon flash" glitch when activating a killstreak while holding ADS).
  // Staging doesn't block it: scoping in on the mark is harmless (see canAds).
  const wantAds = player.alive && !isView() && !socialUnarmed() && !localPauseOnly && empT <= 0 && player.holding !== "streak"
    && ((isTouch && touchState.ads) || (gp && gamepadState.ads) || adsHeld || keys.has("KeyQ"));
  const wantFire = !frozen && !isView() && !socialUnarmed() && ((isTouch && touchState.firing) || (gp && gamepadState.firing) || mouseDown);
  // Pulling the trigger at a run ends the run, like BO2 and PF: the gun
  // comes up and shoots. It used to stay dropped and slung across the body
  // while rounds left from the middle of the screen, which read as not
  // being able to shoot at all. A short hold keeps a semi-auto's taps from
  // dropping the gun between shots. Reloading or empty, you keep running.
  const triggerUp = wantFire && player.holding === "gun" && !w.reloading && w.ammoInMag > 0;
  fireSprintHoldT = triggerUp ? FIRE_SPRINT_HOLD : Math.max(0, fireSprintHoldT - dt);
  if (isSnd()) {
    sndInteractHeld = !frozen && ((isTouch && touchState.interact) || (keys.has("KeyF") && cooking.slot !== "tactical")
      || (gp && gamepadState.pickup && sndCanInteract));
  }

  // Shallow water (a map's `wade` outline, edge.js): slow, and no sprinting.
  // Only with your feet in it: a jetty, bridge or boat deck over it is dry.
  const wading = !!ARENA.wade && move.pos.y < 0.5 && insidePolygon(ARENA.wade, move.pos.x, move.pos.z);
  if (dropping) updateDropPlayer(dt, dropIx, dropIz, (isTouch && touchState.jump) || (gp && gamepadState.jump) || keys.has("Space"));
  else if (isView()) flyView(dt, ix, iz);
  else if (seated && isSocial()) holdSeat(dt, ix, iz, !frozen && ((isTouch && touchState.jump) || (gp && gamepadState.jump) || keys.has("Space") || keys.has("KeyC")));
  else move.update(dt, {
    forward: iz,
    strafe: ix,
    sprint: !wading && !rolling && fireSprintHoldT <= 0 && ((isTouch || gp) ? iz > 0.82 : keys.has("ShiftLeft")),
    jump: !frozen && ((isTouch && touchState.jump) || (gp && gamepadState.jump) || keys.has("Space")),
    crouch: !frozen && ((isTouch && touchState.crouch) || (gp && gamepadState.crouch) || keys.has("KeyC")),
    dive: !frozen && ((isTouch && touchState.dive) || keys.has("ControlLeft") || keys.has("ControlRight")),
    yaw: rolling ? royale.rollYaw : look.yaw,
    adsHeld: wantAds,
    speedMult: w.moveSpeedMult * (isInfected() ? INFECTION.speed : 1) * (wading ? 0.55 : 1) * (heroActive() ? hero().speedMult() : 1),
    // Troll Royale is a 400 m island: sprinting covers it 25% faster.
    sprintMult: (w.def.sprintMult || 1.35) * (isRoyale() ? 1.25 : 1),
    inertia: w.def.inertia,
  });

  updateSwivel(dt);

  if (move.moving && move.grounded && player.alive) {
    stepPhase += dt * (move.sprinting ? 13 : 9);
    if (stepPhase > Math.PI) { stepPhase -= Math.PI; audio.step(); }
  } else {
    stepPhase = 0;
  }
  if (move.justLanded && player.alive) audio.land(move.landSpeed);

  updateEnemySteps(dt);

  move.eyePosition(player.pos);

  // While it's running, the kill cam owns camera.position/.quaternion in
  // full — skip both the eye-position copy and the aim/recoil composition
  // below so the two don't fight over the same camera in the same frame.
  if (killcam.update(dt)) return;
  // Catches the orbit finishing on its own (as opposed to being cut short by
  // respawnPlayer's killcam.cancel(), which already clears this itself) —
  // classList.remove on an absent class is a no-op, so this is safe every frame.
  els.killcamBars.classList.remove("is-on");

  // The local rig always follows the player (even in first-person, when
  // it's simply invisible) so it's never a frame stale the moment third
  // person is toggled on, and so OTHER systems that might reasonably poke
  // at it (screenshots, a future killcam angle) see a live pose.
  updateLocalRig(dt);

  // The match intro owns the camera outright while it plays (staging, so
  // nobody can move or shoot anyway). Your own body is in the shot until
  // the camera pushes into your eyes.
  if (matchIntro.active) {
    matchIntro.update(dt);
    if (matchIntro.active) {
      localRig.root.visible = matchIntro.selfVisible;
      localRig.parts.head.visible = true;
      _listenFwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
      _listenUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
      audio.setListener(camera.position, _listenFwd, _listenUp);
      return;
    }
  }

  const shake = shakeT > 0 ? shakeMag * (shakeT / 0.45) : 0;
  // Phase 6 (DESIGN-ARMS.md §5, camera polish): small, separately-tuned
  // camera-only echoes of the viewmodel's own landing dip and melee impact-
  // stop — same trigger state (landDipT/landDipMag, meleeImpactT), much
  // smaller magnitude, so the whole screen never shakes as hard as the gun
  // moves. Read one frame behind their viewmodel counterparts (updatePlayer
  // runs before updateWeaponView each frame) — imperceptible on a decaying
  // effect, not worth reordering the main loop over.
  const landKick = landDipMag * landDipT * 0.05;
  const meleeKick = meleeImpactT * 0.03;
  updateFireShake(dt);
  const buzz = fireShake.buzz;
  const fpCam = fpEmoteFrame()?.cam;   // a first-person emote's head motion (a laugh, a facepalm)
  const viewYaw = look.yaw + w.recoilYaw + (Math.random() - 0.5) * shake + fireShake.y + (Math.random() - 0.5) * buzz
    + (fpCam?.yaw || 0) + (Math.random() - 0.5) * sawShake;
  updateTabletDive(dt);
  const viewPitch = look.pitch - tabletDiveDip() + w.recoilPitch + (Math.random() - 0.5) * shake + landKick + meleeKick
    + fireShake.p + (Math.random() - 0.5) * buzz + (fpCam?.pitch || 0) + (Math.random() - 0.5) * sawShake;

  if (royaleSpectating()) {
    localRig.root.visible = false;
    placeSpectateCamera(dt);
  } else if (!player.alive && gameState === "playing") {
    placeDeathCamera();
  } else if (dragonfireView()) {
    // Flying the Dragonfire through its nose camera; your body stays put.
    // Its own airframe is hidden from its own camera: the gun and the
    // rotor arms used to hang across the view (user: fix the camera).
    localRig.root.visible = true;
    dragonfire.root.visible = false;
    dragonfire.cameraPose(camera.position, camera.quaternion);
    // Aim assist (user): a pull onto whoever is near the reticle, out to the
    // gun's range, while you shoot or aim. Just flying, it leaves the drone
    // alone: a constant pull steered it into walls.
    const dfFiring = (isTouch && touchState.firing) || (gp && gamepadState.firing) || mouseDown;
    if (!localPauseOnly && (dfFiring || mouseSteering || touchState.looking || gp)) applyAimAssist(dt, DF_ASSIST_PULL, DF_ASSIST_CONE_DEG, DF_RANGE);
    if (!localPauseOnly && dfFiring) fireDragonfire();
  } else if (warshipView()) {
    // Up in the VTOL's gunner seat; your body stands where you called it.
    localRig.root.visible = true;
    placeWarshipCamera();
    if ((isTouch && touchState.firing) || (gp && gamepadState.firing) || mouseDown) fireWarship();
  } else if (royaleDropView()) {
    // Third person on the drop: behind the bus while you ride, then behind
    // you (and your glider) on the way down. Look orbits the camera.
    localRig.root.visible = royale.me !== "bus";
    if (royale.me === "bus") placeDropCamera(royale.drop.bus ? royale.drop.bus.position : move.pos, 26, 8);
    else placeDropCamera(_dropTarget.set(move.pos.x, move.pos.y + (royale.me === "glide" ? 3 : 1.4), move.pos.z), royale.me === "glide" ? 10 : 7, 1.5);
  } else if (settings.thirdPerson || emoteIsTp()) {
    localRig.root.visible = true;
    if (emoteIsTp()) updateEmoteCamera(player.pos, look.yaw, emoteKind() === "duo" ? EMOTES[emote.idx].dist || 1 : 0);
    else updateThirdPersonCamera(player.pos, viewYaw, viewPitch, w.adsT);
  } else {
    localRig.root.visible = false;
    localRig.parts.head.visible = true;
    camera.position.copy(player.pos);
    // Landing roll: the view goes head over heels once and dips as you tuck.
    const rollK = royaleRollK();
    if (rollK > 0) camera.position.y -= Math.sin(Math.PI * rollK) * 0.9;
    // PF slide: the view tips over a few degrees while you slide, leaning
    // toward the side you're steering (left by default).
    slideTiltT = damp(slideTiltT, move.stance === STANCE.SLIDE ? 1 : 0, 9, dt);
    const slideRoll = slideTiltT * 0.075 * ((move.strafeInput ?? 0) > 0.2 ? -1 : 1)
      + (swivel.dir ? -swivel.dir * 0.16 * Math.sin(Math.PI * swivelK()) : 0);
    // One place composes the camera: aim + weapon recoil.
    const rollPitch = rollK > 0 ? -Math.PI * 2 * rollK * rollK * (3 - 2 * rollK) : 0;
    // Keyboard repair: the head glances up at the messenger. The viewmodel
    // camera turns with it, so the board drops away in view and the floating
    // message comes to the middle, like you looked up at it.
    const glance = kbRepair.active ? kbRepair.glance : 0;
    // Tipsy (the saloon bar): the room leans and bobs a little.
    const tip = bar.tipsy > TIPSY.onset && isSocial() ? tipsyFx(bar.tipsy, performance.now() / 1000) : null;
    _euler.set(viewPitch + rollPitch + glance * KB_GLANCE.pitch + (tip?.pitch || 0), viewYaw + glance * KB_GLANCE.yaw, (Math.random() - 0.5) * shake * 0.6 + fireShake.r + slideRoll + (tip?.roll || 0));
    camera.quaternion.setFromEuler(_euler);
    if (glance > 0 || weaponCamera.userData.glanced) {
      weaponCamera.quaternion.setFromEuler(_euler.set(glance * KB_GLANCE.pitch, glance * KB_GLANCE.yaw, 0, "YXZ"));
      weaponCamera.userData.glanced = glance > 0;
    }
  }

  // Panned sounds resolve against wherever the camera now is and faces.
  _listenFwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
  _listenUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
  audio.setListener(camera.position, _listenFwd, _listenUp);

  // Projects against the camera, so it has to follow the camera update or
  // every number trails a frame behind the thing it is stuck to.
  updateDamageNumbers(dt);

  // Swinging locks out the trigger; the melee weapon has no trigger at all.
  const swinging = !!player.melee && player.melee.busy;
  if (player.melee && player.melee.update(dt)) meleeConnect();

  const canAct = !move.busy && player.alive && !stageFrozen() && !royaleDropView() && !warshipView();
  // Pulling the trigger drops a plate or a Hopium half-used.
  if (royale?.act && wantFire) cancelRoyaleAct();
  // Aiming itself is harmless during the pre-match countdown — no shooting,
  // no movement change beyond what ADS already slows — so it gets its own,
  // looser gate instead of inheriting the staging freeze from canAct.
  const canAds = !move.busy && player.alive;
  w.update(dt, {
    moving: move.moving,
    sprinting: move.sprinting,
    grounded: move.grounded,
    jumping: move.jumping,
    // A held melee weapon has the hands: the gun behind it doesn't scope in
    // (with the saber, aim is the block instead).
    adsHeld: wantAds && canAds && player.holding !== "melee" && !w.def.noAds,
    canAds,
  });
  updateSaberBlock(dt, wantAds && canAds);
  updateKbShield(wantAds && canAds);

  // A charge only lives while the gun is up: melee, a streak device or
  // death drops it.
  if (w.charging && (player.holding !== "gun" || !player.alive)) endCandleCharge(w);

  // Holding the melee weapon turns the fire button into a swing.
  if (player.holding === "melee") {
    if (wantFire && fireEdgeTrigger && canAct) swingMelee();
    return;
  }

  // Holding the care package marker: fire throws it.
  if (player.holding === "streak" && markingStreak === "carepackage" && wantFire && fireEdgeTrigger) throwMarker();

  // Looking at the streak device (DESIGN-ARMS.md Phase 5 §5's explicit
  // interaction-bug call-out): fire is disabled outright rather than
  // silently shooting through a hidden gun mesh while the device is up.
  if (player.holding === "streak") return;

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
      if (fireEdgeTrigger && w.burstLeft <= 0 && w.canFire()) w.burstLeft = w.def.burst || 2;
    } else if (fireEdgeTrigger && w.canFire()) {
      fireOnce();
    } else if (fireEdgeTrigger && w.reloading && w.def.shellReload && w.interruptReload()) {
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
    if (w.reloading || move.sprinting || !held) {
      const release = !held && !w.reloading && !move.sprinting;
      const level = w.chargeT < c.minHold ? 0 : w.chargeLevel;
      endCandleCharge(w);
      if (release) fireOnce(chargedShotDef(w.def, level));
      return;
    }
    w.chargeT += dt;
    audio.candleCharge(w.chargeLevel, w.chargeT >= c.time);
    return;
  }
  if (!pressed) return;
  if (w.canFire()) {
    w.charging = true;
    w.chargeT = 0;
    inspectT = 0;
  } else if (w.ammoInMag <= 0 && !w.reloading) {
    tryReload();
  }
}

function endCandleCharge(w) {
  w.cancelCharge();
  audio.candleCharge(-1);
  els.charge.hidden = true;
}

let fireEdgeTrigger = false;
window.addEventListener("mousedown", (e) => {
  if (emote && (e.button === 0 || e.button === 2)) stopEmote();
  if (e.button === 0) { fireEdgeTrigger = true; setTimeout(() => fireEdgeTrigger = false, 16); }
});
els.touchFire.addEventListener("touchstart", () => { fireEdgeTrigger = true; setTimeout(() => fireEdgeTrigger = false, 16); });

/* The melee view model: raised whenever it's the held weapon, and swung
   through the pose MeleeState solves each frame — the same rest grip, chop
   and thrust as the Godot reference. A quick melee borrows the same mesh, so
   it pops in for the swing and drops out again the moment it's over. */
let meleeIdleT = 0;
let meleeLowerT = 0;

/* Phase 4 (DESIGN-ARMS.md): hit/whiff visual distinction. meleeConnect()
   sets one of these to 1 the instant it resolves a swing's single hit
   check; both decay here so a connect reads as a sharp stop-on-impact and
   a whiff reads as a slightly looser overextension, without adding new
   keyframes to SWING_TRACK/THRUST_TRACK — this only perturbs the sampled
   pose those tracks already produce. */
let meleeImpactT = 0;
let meleeWhiffT = 0;
const _meleeImpactEuler = new THREE.Euler();

function updateMeleeView(dt) {
  const mesh = activeMeleeMesh;
  const melee = player.melee;
  sawShake = 0;
  if (!mesh || !melee) return;

  // Put away for a streak (holsterMeleeFor): once it's all the way down, the
  // call goes through and the hands are off it this same frame.
  if (meleeHolster) {
    if (!player.alive || player.holding !== "melee" || gameState !== "playing") meleeHolster = null;
    else if (meleeHolster.t >= (meleeHolster.len ?? MELEE_HOLSTER_TIME)) finishMeleeHolster();
  }

  const held = player.holding === "melee";
  const swinging = melee.busy;
  if (held || swinging) inspectArms.visible = false;   // the gun's showcase arms
  // Tossed hands go back on the sword the moment the toss isn't playing.
  if (!(inspectT > 0 && held && !swinging)) restoreMeleeHands(mesh);
  mesh.visible = held || swinging;
  const saber = mesh.userData.saber;
  if (saber && mesh.visible !== saberWasShown) {
    saberWasShown = mesh.visible;
    saber.snapOff();
    saberTrail?.clear();
    saberHavePrevTip = false;
    if (mesh.visible) {
      const equip = held && !swinging;
      if (equip) mesh.userData.igniteDelay = POWER_IGNITE_DELAY;   // lit below, once the hilt's up
      else { saber.ignite(); saber.flare(1.2); audio.saberIgnite(); }
      meleeDrawT = meleeDrawLen = equip ? POWER_EQUIP_TIME : MELEE_DRAW_TIME;
    }
    else { audio.saberHum(-1); if (!mesh.userData.holstered) audio.saberRetract(); }
  }
  // The Halo Blade: dark in the hand, its prongs unfold out of the hilt as
  // it's drawn (halo-blade.js), and fold away when it's put up.
  const halo = mesh.userData.halo;
  if (halo && mesh.visible !== !!mesh.userData.wasShown) {
    mesh.userData.wasShown = mesh.visible;
    if (mesh.visible) {
      const equip = held && !swinging;
      halo.snapOff();
      if (equip) mesh.userData.igniteDelay = POWER_IGNITE_DELAY;
      else { halo.ignite(); audio.haloIgnite(); }
      meleeDrawT = meleeDrawLen = equip ? POWER_EQUIP_TIME : MELEE_DRAW_TIME;
    }
    else { halo.retract(); if (!mesh.userData.holstered) audio.haloRetract(); }
  }
  // Ignition: the hilt is up and still, now the blade comes out.
  if (mesh.userData.igniteDelay > 0) {
    mesh.userData.igniteDelay = mesh.visible ? mesh.userData.igniteDelay - dt : 0;
    if (mesh.userData.igniteDelay <= 0 && mesh.visible) {
      const power = saber || halo;
      power?.ignite(POWER_IGNITE);
      if (saber) { saber.flare(0.6); audio.saberIgniteSlow(); }
      else if (halo) audio.haloIgniteSlow();
    }
  }
  // The holster already played the power-down; that hide was quiet.
  if (!mesh.visible) mesh.userData.holstered = false;
  // Everything else (Keyboard Warrior, Chainsaw, Reaper) gets the same slow
  // draw when it's equipped, with its own start-up sound.
  if (!saber && !halo && mesh.visible !== !!mesh.userData.drawShown) {
    mesh.userData.drawShown = mesh.visible;
    if (mesh.visible && held && !swinging) {
      meleeDrawT = meleeDrawLen = MELEE_EQUIP_TIME;
      const kind = melee.def.model?.kind;
      if (kind === "chainsaw") audio.chainsawStart();
      else if (kind === "keyboard") audio.keyboardBoot();
      else if (kind === "knuckles") audio.knuckleCrack();
    }
  }
  // Only while the gun is what we hold: this used to re-show it every frame,
  // so it stayed on screen beside the streak tablet and marker.
  if (activeWeaponMesh) activeWeaponMesh.visible = player.holding === "gun" && !swinging;
  // Every melee weapon is held by the black rod arms, not the old white
  // block hands. The saber lets go for its inspect.
  saberArmsOn = mesh.visible && player.alive && (!saber || inspectT <= 0);
  if (!saberArmsOn && saberArmsWere) pfArms.visible = false;
  saberArmsWere = saberArmsOn;
  if (!mesh.visible) {
    meleeIdleT = 0; saberBlock.t = 0; kbShield.t = 0;
    if (kbRepair.active) kbRepair.stop();   // put away mid-fix: it's fixed when it comes back
    return;
  }

  const { pos, quat } = melee.pose();
  mesh.position.copy(pos);
  mesh.quaternion.copy(quat);
  // Per-weapon framing on top of the shared pose (gear.js model.view): the
  // chainsaw is carried level with the bar out front, not up like a sword.
  const view = melee.def.model?.view;
  if (view) {
    if (view.pos) { mesh.position.x += view.pos[0]; mesh.position.y += view.pos[1]; mesh.position.z += view.pos[2]; }
    if (view.rot) mesh.quaternion.multiply(_meleeViewQ.setFromEuler(_meleeViewE.set(view.rot[0], view.rot[1], view.rot[2])));
  }
  mesh.scale.setScalar(view?.scale || 1);

  // Drawing an energy blade: it comes up from low right, hilt first, turning
  // into the guard while the blade lights — a flourish, not a pop-in. The
  // arms follow the weapon, so they draw it too.
  if (meleeDrawT > 0) {
    meleeDrawT = Math.max(0, meleeDrawT - dt);
    const k = 1 - meleeDrawT / meleeDrawLen;
    const e = 1 - Math.pow(1 - k, 3);              // ease out
    const off = 1 - e;
    mesh.position.x += off * 0.14;
    mesh.position.y -= off * 0.34;
    mesh.position.z += off * 0.08;
    // Twist about the blade (roll) and tip it back, settling with a small
    // overshoot right at the end.
    const settle = Math.sin(k * Math.PI) * 0.12 * (k > 0.6 ? 1 : 0);
    mesh.quaternion.multiply(_meleeViewQ.setFromEuler(_meleeViewE.set(off * -0.9 + settle, 0, off * 1.6)));
  }

  if (melee.def.shield) {
    kbShield.t = damp(kbShield.t, kbShield.active ? 1 : 0, 14, dt);
    if (kbShield.t > 0.001) {
      mesh.position.lerp(KB_SHIELD.pos, kbShield.t);
      mesh.quaternion.slerp(KB_SHIELD.quat, kbShield.t);
    }
    // The support hand rides out to the far end for the shield and onto the
    // tools for the repair, and must come back under the main hand after
    // (user: it stayed up the blade, and its arm hid the U MAD BRO? guard).
    // `home` eases back to the built grip; the shield lerps from it fresh
    // every frame instead of compounding on the hand's own position.
    const sup = meleeHands(mesh)[1];
    if (sup && !mesh.userData.handsTossed) {
      const home = sup.home || (sup.home = { pos: sup.pos.clone(), quat: sup.quat.clone() });
      if (kbRepair.active) {
        home.pos.copy(sup.obj.position);
        home.quat.copy(sup.obj.quaternion);
      } else {
        const k = 1 - Math.exp(-dt * 12);
        home.pos.lerp(sup.pos, k);
        home.quat.slerp(sup.quat, k);
        sup.obj.position.copy(home.pos).lerp(_kbFarGrip, kbShield.t);
        sup.obj.quaternion.copy(home.quat);
      }
    }
    // each round knocks it back into your face a little
    if (kbShield.kick > 0) {
      kbShield.kick = Math.max(0, kbShield.kick - dt * 7);
      mesh.position.z += kbShield.kick * 0.06;
      mesh.position.x += (Math.random() - 0.5) * kbShield.kick * 0.02;
    }
    if (kbRepair.active) kbRepair.update(dt, mesh, meleeHands(mesh));
  }

  if (saber) {
    // Guard up: blade across the body. A deflect knocks it back a touch.
    saberBlock.t = damp(saberBlock.t, saberBlock.active ? 1 : 0, 16, dt);
    if (saberBlock.t > 0.001) {
      mesh.position.lerp(SABER_BLOCK.pos, saberBlock.t);
      mesh.quaternion.slerp(SABER_BLOCK.quat, saberBlock.t);
    }
    // A deflect whips the blade to meet the round (a blend of the zone
    // parries aimed at the shooter), flicks it away and eases back.
    saberParry.update(dt);
    const ps = saberParry.sample();
    const pw = ps.k * saberBlock.t;
    saberFlick = ps.flick * saberBlock.t;
    let turn = 1;
    if (pw > 0.001) {
      parryWeights(ps.x, ps.y, _parryW);
      _parryPos.set(0, 0, 0);
      let acc = 0;
      for (const z of PARRY_ZONES) {
        const w = _parryW[z];
        if (w <= 0) continue;
        _parryPos.addScaledVector(SABER_PARRY[z].pos, w);
        if (acc === 0) _parryQ.copy(SABER_PARRY[z].quat);
        else _parryQ.slerp(SABER_PARRY[z].quat, w / (acc + w));
        acc += w;
      }
      // Which way the blade turned (in the view plane) to meet the round:
      // the flick carries on that way.
      _bladeG.subVectors(saber.tipLocal, saber.rootLocal).applyQuaternion(mesh.quaternion);
      _bladeP.subVectors(saber.tipLocal, saber.rootLocal).applyQuaternion(_parryQ);
      turn = Math.sign(_bladeG.x * _bladeP.y - _bladeG.y * _bladeP.x) || 1;
      mesh.position.lerp(_parryPos, pw);
      mesh.quaternion.slerp(_parryQ, pw);
    }
    if (Math.abs(saberFlick) > 0.001) {
      // The wrist turn, in view space: on past the intercept, pushed out at
      // the round.
      mesh.quaternion.premultiply(_flickQ.setFromAxisAngle(_viewZ, saberFlick * turn * 0.6));
      mesh.quaternion.premultiply(_flickQ.setFromAxisAngle(_viewX, -Math.abs(saberFlick) * 0.25));
    }
    if (saberDeflectT > 0) {
      saberDeflectT = Math.max(0, saberDeflectT - dt * 7);
      mesh.position.z += saberDeflectT * 0.03;
    }
  }

  // Holstering for a streak: the draw run backwards — it tips and drops
  // away low right, an energy blade powering down as it goes. Waits for a
  // swing already in progress to land.
  if (meleeHolster && !swinging) {
    if (!meleeHolster.started) {
      meleeHolster.started = true;
      meleeDrawT = 0;
      inspectT = 0;
      if (kbRepair.active) kbRepair.stop();
      const power = saber || halo;
      if (power) {
        power.retract(POWER_RETRACT);
        mesh.userData.igniteDelay = 0;
        if (saber) { audio.saberHum(-1); audio.saberRetract(); } else audio.haloRetract();
        mesh.userData.holstered = true;
      }
    }
    meleeHolster.t += dt;
    // An energy blade holds still while it powers down, then drops.
    const hold = saber || halo ? POWER_RETRACT : 0;
    const len = meleeHolster.len ?? MELEE_HOLSTER_TIME;
    const k = Math.max(0, Math.min(1, (meleeHolster.t - hold) / Math.max(0.05, len - hold)));
    const e = k * k * (3 - k) / 2;                 // eases in, leaves quickly
    mesh.position.x += e * 0.14;
    mesh.position.y -= e * 0.34;
    mesh.position.z += e * 0.08;
    mesh.quaternion.multiply(_meleeViewQ.setFromEuler(_meleeViewE.set(e * -0.9, 0, e * 1.6)));
  }

  if (swinging) {
    // Impact: a brief sharp decel + tiny recoil-back, same idea as the
    // gun's viewKick* but scoped to melee. Whiff: the tracks' own
    // follow-through keyframe is allowed to overextend slightly further
    // than its authored end pose while this is decaying.
    meleeImpactT = Math.max(0, meleeImpactT - dt * 6);
    meleeWhiffT = Math.max(0, meleeWhiffT - dt * 4);
    if (meleeImpactT > 0) {
      mesh.position.z += meleeImpactT * 0.05;
      mesh.position.y -= meleeImpactT * 0.02;
    }
    if (meleeWhiffT > 0) {
      _meleeImpactEuler.set(0, 0, THREE.MathUtils.degToRad(meleeWhiffT * 6));
      mesh.quaternion.multiply(new THREE.Quaternion().setFromEuler(_meleeImpactEuler));
    }
  }

  if (!swinging) {
    const w = currentWeapon();
    // Walking/running bob, same phase source the gun view model rides
    // (w.bobPhase keeps advancing even while melee is the held weapon) —
    // without this the sword held dead still while sprinting read as
    // "glued to the screen" rather than carried.
    const moveBob = move.moving ? 0.018 : 0;
    mesh.position.x += Math.sin(w.bobPhase) * moveBob * 0.5;
    mesh.position.y -= Math.abs(Math.cos(w.bobPhase)) * moveBob;

    // Sprinting drops the blade out of guard the same way a sprinting gun
    // lowers out of the sight line.
    const wantLower = move.sprinting ? 1 : 0;
    meleeLowerT = damp(meleeLowerT, wantLower, 9, dt);
    mesh.position.y -= meleeLowerT * 0.1;
    mesh.position.z += meleeLowerT * 0.08;
    mesh.rotateX(meleeLowerT * 0.5);

    // Slow figure-eight breathing sway while fully idle, matching the
    // reference's idle animation — the walk bob above already covers
    // movement, so this only adds while standing still. Skipped while the
    // inspect flourish is playing so the two don't fight over the same
    // quaternion.
    if (!move.moving && inspectT <= 0) {
      meleeIdleT = (meleeIdleT + dt) % MELEE_IDLE_PERIOD;
      const phase = (meleeIdleT / MELEE_IDLE_PERIOD) * Math.PI * 2;
      const bob = 0.012;
      mesh.position.x += Math.sin(phase) * bob * 0.6;
      mesh.position.y -= Math.abs(Math.cos(phase)) * bob;
      _meleeIdleEuler.set(
        THREE.MathUtils.degToRad(Math.cos(phase) * 1.4),
        THREE.MathUtils.degToRad(Math.sin(phase) * 1.8),
        0);
      mesh.quaternion.multiply(new THREE.Quaternion().setFromEuler(_meleeIdleEuler));
    } else if (move.moving) {
      meleeIdleT = 0;
    }

    // Toss-and-float flourish (D-pad up / T while holding the sword), see
    // applyMeleeInspect. Also lets tossed hands back onto the sword. The
    // Reaper's Grin has its own: shut, flick open, a knife trick.
    if (mesh.userData.kind === "reaper") applyReaperInspect(mesh);
    else if (mesh.userData.kind === "chainsaw") applySawRev(mesh);
    else if (mesh.userData.kind !== "knuckles") applyMeleeInspect(mesh);   // the knuckles' is poseKnuckles below
  }
  // The chainsaw revs: the engine shakes it (and, hard, the screen), the
  // chain speeds up, the throttle squeezes and the exhaust smokes.
  let rev = 0;
  if (mesh.userData.kind === "chainsaw") {
    if (swinging) {
      const t = melee.t;
      rev = chainsawRevAt(t);
      if (sawPrevT < 0.28 && t >= 0.28) audio.chainsawRip();
      // Grinding in: sawed back and forth along the bar.
      if (t > 0.38 && t < 0.64) mesh.translateZ(Math.sin(t * 58) * 0.022 * Math.min(1, (t - 0.38) / 0.05));
      sawPrevT = t;
    } else {
      sawPrevT = 0;
      rev = sawInspectRev;
    }
    const grinding = swinging && melee.t > 0.34 && melee.t < 0.64;
    const amp = 0.0014 + rev * (grinding ? 0.016 : 0.009);
    mesh.position.x += (Math.random() - 0.5) * amp;
    mesh.position.y += (Math.random() - 0.5) * amp;
    mesh.position.z += (Math.random() - 0.5) * amp * 0.5;
    sawShake = rev * (grinding ? 0.02 : 0.007);
  }
  // Knuckle Grinners: the fists jab, hook, crack and show off inside the
  // still root (brass-knuckles.js); the arms follow their anchors.
  if (mesh.userData.kind === "knuckles") {
    const cracks = poseKnuckles(mesh, {
      t: swinging ? melee.t : 0, index: melee.swingIndex,
      inspect: inspectT > 0 && held && !swinging ? inspectProgress() : -1, time: clock.elapsedTime,
    });
    if (cracks) audio.knuckleCrack();
  }
  mesh.userData.tick?.(dt, swinging, rev);

  if (saber) updateSaberFx(mesh, saber, swinging, dt);
  if (saberArmsOn) (saber ? poseSaberArms(mesh) : poseMeleeArms(mesh));
}
const MELEE_IDLE_PERIOD = 3.2;
const _meleeIdleEuler = new THREE.Euler();

/* Chainsaw rev (admire, T / D-pad up / the touch admire button): brought up
   in front of the face, bar tipped up, three throttle blips, the last one
   held, then back down. applySawRev leaves the throttle in sawInspectRev
   for updateMeleeView's shake, chain and smoke. */
const SAW_REV_TIME = 1.7;
const SAW_BLIPS = [[0.1, 0.28], [0.36, 0.52], [0.6, 0.9]];
let sawRevBlips = 0;
let sawInspectRev = 0;
let sawPrevT = 0;
let sawShake = 0;      // extra screen jitter (radians) while the saw is revving
const _sawQ = new THREE.Quaternion();
const _sawE = new THREE.Euler();
function applySawRev(mesh) {
  sawInspectRev = 0;
  if (inspectT <= 0) return;
  const k = 1 - inspectT / inspectDur;
  const lift = smooth01(Math.min(1, k / 0.12)) * (1 - smooth01(Math.max(0, (k - 0.9) / 0.1)));
  for (let i = 0; i < SAW_BLIPS.length; i++) {
    const [a, b] = SAW_BLIPS[i];
    if (k >= a && k < b) {
      const u = (k - a) / (b - a);
      sawInspectRev = Math.max(sawInspectRev, Math.min(1, u * 6) * (i === SAW_BLIPS.length - 1 ? 1 : 1 - u * 0.4));
      if (sawRevBlips <= i) { sawRevBlips = i + 1; i === SAW_BLIPS.length - 1 ? audio.chainsawRip() : audio.chainsawRev(); }
    }
  }
  sawInspectRev = Math.max(sawInspectRev, lift * 0.12);
  mesh.position.x -= 0.1 * lift;
  mesh.position.y += 0.1 * lift;
  mesh.position.z += 0.06 * lift;
  // bar tipped up toward the sky, a little toward the middle; it bucks on each blip
  _sawQ.setFromEuler(_sawE.set((0.42 + sawInspectRev * 0.06) * lift, 0.26 * lift, 0.18 * lift));
  mesh.quaternion.premultiply(_sawQ);
}
function smooth01(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }

/* Streak device viewmodel (DESIGN-ARMS.md Phase 5). Simple raise/steady/
   lower — no swing state to fight over the pose the way melee has, so this
   is much shorter than updateMeleeView. `streakRaiseT` eases the device
   into its hold pose; sprinting lowers it the same way the gun/melee do.
   Whatever's in hand, the real sleeved arms (streakArms) hold it. */
let streakRaiseT = 0;
let streakSprintT = 0;
// Two-handed, centred and low, screen tipped up toward the eye — BO2's
// tablet hold. The old one-hand wrist unit sat half off the bottom right.
const TABLET_HOLD_POS = new THREE.Vector3(0, -0.098, -0.4);
const TABLET_TILT = -0.36;
const TABLET_PRESS_AT = 0.45;       // seconds into a UAV/gunship call the thumb goes down
// The K9 whistle: hand target in viewmodel space (fingers up and back into
// the mouth, so you see the back of it, knuckles forward), how long it is
// held, when the note starts.
const WHISTLE_HAND = [0.035, -0.1, -0.195];
const WHISTLE_ROT = [-0.3, Math.PI - 0.35, 0.3];
const WHISTLE_HOLD = 1.6;
const WHISTLE_BLOW_AT = 0.3;

function updateStreakView(dt) {
  const held = player.holding === "streak";
  const mesh = streakDeviceKind === "marker" ? activeMarkerMesh
    : streakDeviceKind === "drone" ? activeDroneMesh
    : streakDeviceKind === "whistle" ? null : activeStreakMesh;
  for (const m of [activeStreakMesh, activeMarkerMesh, activeDroneMesh]) m.visible = held && m === mesh;
  if (!held) { streakRaiseT = 0; streakSprintT = 0; hideStreakArms(); return; }
  inspectArms.visible = false;
  if (!player.alive) { finishStreakHold(); if (mesh) mesh.visible = false; hideStreakArms(); return; }
  if (streakHoldElapsed === 0) resetStreakArms();
  streakHoldElapsed += dt;

  // Up quickly, down a touch quicker; once it's down, the gun comes back.
  streakRaiseT = damp(streakRaiseT, streakLowering ? 0 : 1, streakLowering ? 11 : 8, dt);
  if (streakLowering && streakRaiseT < 0.05) { finishStreakHold(); if (mesh) mesh.visible = false; hideStreakArms(); return; }
  streakSprintT = damp(streakSprintT, move.sprinting ? 1 : 0, 8, dt);
  const e = streakRaiseT, off = 1 - e, s = streakSprintT;
  const t = performance.now() / 1000;
  const idleX = Math.sin(t * 1.3) * 0.003, idleY = Math.sin(t * 1.9) * 0.003;

  if (streakDeviceKind === "whistle") {
    // K9 call: the right hand comes up to the mouth, two fingers in, and
    // blows; the head tips back a touch with the breath, then it drops away.
    const blow = Math.max(0, Math.min(1, (streakHoldElapsed - WHISTLE_BLOW_AT) / 0.9));
    const push = Math.sin(blow * Math.PI);            // the breath swelling and fading
    const trill = blow > 0 && blow < 1 ? Math.sin(t * 38) * 0.0015 : 0;
    poseFreeArms({
      R: {
        pos: [WHISTLE_HAND[0] + off * 0.1 + idleX,
          WHISTLE_HAND[1] - off * 0.32 - s * 0.1 + idleY + push * 0.008 + trill,
          WHISTLE_HAND[2] + off * 0.06 + push * 0.01],
        rot: [WHISTLE_ROT[0] - off * 0.9, WHISTLE_ROT[1], WHISTLE_ROT[2] + off * 0.3],
        pose: "whistle",
      },
      L: null,
    });
    return;
  }

  if (streakDeviceKind === "marker") {
    // Held up by the shoulder, strobe blinking; the throw is a wind-back and
    // an overhand flick, then the hand is empty and follows through.
    activeMarkerMesh.userData.strobe.visible = (t * 2.5) % 1 < 0.2;
    let fx = 0, fy = 0, fz = 0, pitch = 0;
    if (markerThrowT > 0) {
      markerThrowT = Math.max(0, markerThrowT - dt);
      const k = 1 - markerThrowT / MARKER_THROW_TIME;
      if (k < 0.3) { const w = k / 0.3; fy = 0.05 * w; fz = 0.06 * w; pitch = -0.6 * w; }
      else if (k < 0.5) { const w = (k - 0.3) / 0.2; fy = 0.05 + 0.06 * w; fz = 0.06 - 0.32 * w; pitch = -0.6 + 1.6 * w; }
      else mesh.visible = false;   // it's gone; the empty hand drops away
    }
    mesh.scale.setScalar(0.6);
    mesh.position.set(0.15 + off * 0.08 + idleX, -0.15 - off * 0.3 - s * 0.12 + idleY + fy, -0.36 + off * 0.05 + fz);
    mesh.rotation.set(s * 0.4 + off * 0.8 + pitch, -0.3 - off * 0.3, s * 0.25 + off * 0.4 + 0.15);
    poseStreakArms(mesh.visible ? mesh : null, "wrap", dt, 0);
    return;
  }

  if (streakDeviceKind === "drone") {
    // Cradled out in front in both hands, rotors spinning up, then tossed up
    // and away; the hands follow through and drop out of view.
    const toss = Math.max(0, (streakHoldElapsed - DRONE_TOSS_AT + 0.15) / 0.3);
    for (const r of activeDroneMesh.userData.rotors || []) r.rotation.y += dt * 60 * Math.min(1, streakHoldElapsed / 0.5);
    mesh.position.set(0.02 + off * 0.1 + idleX, -0.16 - off * 0.3 + idleY + toss * toss * 0.5, -0.42 + off * 0.05 - toss * 0.3);
    mesh.rotation.set(-0.15 + off * 0.6 + toss * 0.4, 0.3 * off, off * 0.3);
    if (toss >= 1) mesh.visible = false;
    // Hands let go a moment into the toss, not once it's gone.
    poseStreakArms(toss > 0.35 ? null : mesh, "cup", dt, 0);
    if (pendingDroneLaunch && streakHoldElapsed >= DRONE_TOSS_AT) launchPendingDrone();
    return;
  }

  // Tablet: rises from low with both hands, screen tipping up to the eye,
  // then settles with a slight idle drift. A UAV/gunship call gets a right-
  // thumb press on CONFIRM and the page flips; the strike tablet just holds.
  const calling = ["uav", "counteruav", "vsat", "gunship", "k9", "warship", "swarm", "dragonfire", "samturret"].includes(streakScreen);
  const pk = calling ? (streakHoldElapsed - TABLET_PRESS_AT) / 0.22 : -1;
  const press = pk > 0 && pk < 1 ? Math.sin(pk * Math.PI) : 0;
  const confirmed = calling && pk >= 0.5;
  mesh.position.set(
    TABLET_HOLD_POS.x + idleX,
    TABLET_HOLD_POS.y - off * 0.3 - s * 0.1 + idleY - press * 0.006,
    TABLET_HOLD_POS.z + off * 0.06 + press * 0.004
  );
  mesh.rotation.set(TABLET_TILT + s * 0.35 - off * 0.6 + press * 0.05, off * 0.2, s * 0.2 + off * 0.25);
  if (tabletDive) {
    // The dive: the tablet comes up square to the eye as the view tips down
    // to it, then rushes into the lens until its screen is all there is.
    const k = tabletDiveK();
    const a = Math.min(1, k / DIVE_LOOK), b = Math.max(0, (k - DIVE_LOOK) / (1 - DIVE_LOOK));
    const ea = a * a * (3 - 2 * a), eb = b * b * b;
    mesh.position.x += (0 - mesh.position.x) * ea;
    mesh.position.y += (-0.05 - mesh.position.y) * ea + 0.05 * eb;
    mesh.position.z += (-0.34 - mesh.position.z) * ea + 0.3 * eb;
    mesh.rotation.x += (-0.02 - mesh.rotation.x) * ea;
    mesh.rotation.y *= 1 - ea;
    mesh.rotation.z *= 1 - ea;
  }
  drawTabletScreen(activeStreakMesh, streakScreen, streakHoldElapsed, confirmed);
  poseStreakArms(mesh, "side", dt, pk > 0 && pk < 1 ? pk : 0);
}

/* The arms that hold streak devices: real hands (hand-model.js — white,
   ink-outlined, jointed fingers) on a wrist/cuff/sleeve run to a shoulder
   below the screen. The hand is placed on the device's grip anchor per
   style — "side" hooks the fingers over a tablet edge, "cup" palms the
   drone from underneath, "wrap" closes a fist round the marker. Arm 0 is
   the right arm, arm 1 the left. */
const STREAK_SHOULDER = [new THREE.Vector3(0.27, -0.54, 0.1), new THREE.Vector3(-0.27, -0.54, 0.1)];
const streakArms = (() => {
  const root = new THREE.Group();
  root.visible = false;
  const mats = handMaterials();
  const unitCyl = (rTop, rBottom, mat) => {
    const g = new THREE.CylinderGeometry(rTop, rBottom, 1, 12);
    g.translate(0, 0.5, 0);
    return new THREE.Mesh(g, mat);
  };
  const arms = [];
  for (let i = 0; i < 2; i++) {
    const hand = buildHumanHand(i === 0 ? 1 : -1, mats);
    const wrist = unitCyl(0.02, 0.023, mats.skin);
    const cuff = unitCyl(0.033, 0.032, mats.cuff);
    const sleeve = unitCyl(0.042, 0.032, mats.sleeve);
    inkOutline(cuff);
    root.add(hand, wrist, cuff, sleeve);
    arms.push({ hand, wrist, cuff, sleeve, free: false, attached: false, vel: new THREE.Vector3() });
  }
  // The Phantom Forces black rods (see pfArms), tip on the grip.
  const rodMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
  for (const arm of arms) {
    const g = new THREE.CylinderGeometry(0.013, 0.034, 1, 10);
    g.translate(0, 0.5, 0);
    arm.rod = new THREE.Mesh(g, rodMat);
    arm.rod.renderOrder = -1;
    arm.rod.visible = false;
    root.add(arm.rod);
  }
  root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  root.userData.arms = arms;
  return root;
})();
weaponRig.add(streakArms);

function hideStreakArms() {
  streakArms.visible = false;
  for (const arm of streakArms.userData.arms) arm.rod.visible = false;
}

/* New hold: both hands start attached again. */
function resetStreakArms() {
  for (const arm of streakArms.userData.arms) { arm.free = false; arm.attached = false; arm.vel.set(0, 0, 0); }
}

/* Put the hands on `mesh`'s grip anchors and run each arm down to its
   shoulder. `mesh` null means the hands have let go (a toss/throw): each
   keeps the momentum it had and falls away below the screen. A one-handed
   device (the marker) has no left anchor, so that arm stays down. `tap` is
   0..1 through the CONFIRM press (the right index taps the bezel). */
const _armPrev = new THREE.Vector3();
const _wristAt = new THREE.Vector3();
function poseStreakArms(mesh, style, dt, tap) {
  streakArms.visible = true;
  const anchors = mesh?.userData.anchors || null;
  if (mesh) mesh.updateMatrixWorld(true);
  const arms = streakArms.userData.arms;
  for (let i = 0; i < arms.length; i++) {
    const arm = arms[i];
    const anchor = anchors ? (i === 0 ? anchors.right : anchors.left) : null;
    let show;
    if (anchor && !arm.free) {
      _armPrev.copy(arm.hand.position);
      placeHand(arm.hand, anchor, style, i === 0 ? 1 : -1, i === 0 ? tap : 0);
      // Remember how the hand was moving, for the follow-through if it lets go.
      if (dt > 0 && arm.attached) arm.vel.subVectors(arm.hand.position, _armPrev).divideScalar(dt);
      if (arm.vel.lengthSq() > 9) arm.vel.setLength(3);
      arm.attached = true;
      show = true;
    } else if (arm.attached) {
      // Let go: fingers open, coast on, then drop out of view.
      arm.free = true;
      poseHumanHand(arm.hand, "relaxed");
      arm.vel.multiplyScalar(Math.max(0, 1 - dt * 6));
      arm.vel.y -= dt * 3.2;
      arm.hand.position.addScaledVector(arm.vel, dt);
      show = arm.hand.position.y > -0.5;
    } else {
      show = false;
    }
    arm.hand.visible = arm.wrist.visible = arm.cuff.visible = arm.sleeve.visible = show;
    arm.rod.visible = false;
    if (!show) continue;
    // The PF look everywhere: no hands, the rod's tip holds it. (The white
    // hand stays placed, invisibly, as the grip point.)
    arm.hand.visible = arm.wrist.visible = arm.cuff.visible = arm.sleeve.visible = false;
    arm.rod.visible = true;
    stretchBetween(arm.rod, STREAK_SHOULDER[i], streakRodTip(arm, anchor, style, i));
  }
}

/* Where a streak arm's rod ends. On the tablet the palm centre sits outside
   the edge, so the rod goes to the edge itself, low on the side; elsewhere
   (and once a hand has let go) the placed hand is the spot. */
const STREAK_ROD_TIP = { side: new THREE.Vector3(0.006, -0.05, -0.004) };
const _rodTip = new THREE.Vector3();
const _rodQ = new THREE.Quaternion();
function streakRodTip(arm, anchor, style, i) {
  const off = STREAK_ROD_TIP[style];
  if (!off || !anchor || arm.free) return arm.hand.position;
  anchor.getWorldPosition(_rodTip);
  anchor.getWorldQuaternion(_rodQ);
  return _rodTip.add(_armDir.set(off.x * (i === 0 ? 1 : -1), off.y, off.z).applyQuaternion(_rodQ));
}

/* hand -> wrist -> cuff -> sleeve, all along the line to the shoulder. */
function layStreakArm(arm, i) {
  const shoulder = STREAK_SHOULDER[i];
  handWrist(arm.hand, _wristAt);
  _armDir.subVectors(shoulder, _wristAt).normalize();
  _armFrom.copy(_wristAt).addScaledVector(_armDir, -0.012);
  _armTo.copy(_wristAt).addScaledVector(_armDir, 0.04);
  stretchBetween(arm.wrist, _armFrom, _armTo);
  _armFrom.copy(_armTo);
  _armTo.copy(_wristAt).addScaledVector(_armDir, 0.065);
  stretchBetween(arm.cuff, _armFrom, _armTo);
  stretchBetween(arm.sleeve, _armTo, shoulder);
}

/* A first-person emote (emotes.js `fp`): the gun goes away (or does the
   trick), and the streak arms' real hands act it out in front of the camera.
   Runs after updateWeaponView, so it has the last word on the viewmodel. */
let fpEmoteArmsOn = false;

/* Socialize, first person: no gun, so your own hands swing at the bottom of
   the view with your stride (user: "empty hands should be replaced by
   running/walking animation arms moving"): low and loose at a walk, pumping
   up into view at a sprint, dropping out of sight when you stand still.
   Same hand targets as the first-person emotes (viewmodel space). */
/* -------------------- the saloon bar (Socialize roleplay) --------------------

   User, 2026-10-04: "allow users to grab beer mugs and refill themselves
   etc. bartender role that anyone can fill." Troll City's saloon lists its
   spots as `rp.bar` (trollcity.js); everything is hold X there, the same
   prompt and bar as a weapon pickup:
     the rack: a mug (empty) · a tap or the kitchen keg: fill it ·
     the apron hook: become the bartender (one at a time) or hang it up ·
     the back-bar bottles (bartender): a whiskey · the bell (bartender):
     last call for the room · another player with empty hands: hold your
     drink out to them; they hold X by you to take it.
   Fire sips, G puts it down. Sips make you tipsy (saloon-bar.js tipsyFx).
   What's in your hand, a sip, and the role ride the state packet. */
let townNpcs = null;   // Socialize townsfolk (town-npcs.js)
const bar = {
  drink: null,      // { kind: "beer"|"whiskey", sips }
  sipT: 0,          // counts down through a sip
  sipDone: false,   // this sip has been swallowed (halfway)
  hold: null, holdT: 0, holdLock: false,
  role: null,       // "bartender" while we wear the apron
  outT: 0,          // seconds the bartender has been out of the saloon
  tipsy: 0,
  tipsyShown: false,
  offer: null,      // incoming: { from, name, kind, sips, until }
  outgoing: null,   // { to, name, until }
  fireWas: false,
  fp: null,         // the drink in our first-person hand
  tp: null,         // ...and on our own body
};

function resetBar() {
  bar.drink = null; bar.sipT = 0; bar.hold = null; bar.holdT = 0; bar.role = null; bar.outT = 0;
  bar.tipsy = 0; bar.tipsyShown = false; bar.offer = null; bar.outgoing = null;
  seated = null;
  stopPianos();
  piano.played = false; piano.tune = 0;
  npcYieldKey = "";
}
const barSpots = () => (isSocial() ? builtMap?.map?.rp?.bar || null : null);
function barNear(B, spot, reach = REACH) {
  return !!spot && Math.hypot(spot.x - move.pos.x, spot.z - move.pos.z) <= reach && Math.abs(move.pos.y - (B.floorY || 0)) < 1.2;
}
function barInside(B) {
  const z = B.zone;
  return move.pos.x > z.x0 && move.pos.x < z.x1 && move.pos.z > z.z0 && move.pos.z < z.z1;
}
const drinkName = (kind) => (kind === "whiskey" ? "whiskey" : "beer");
/* Someone else holding a job (the apron, the piano, the doctor's bag), who
   keeps it if we both took it at once: whoever joined the room first
   (lowest id on a tie). */
function otherWithRole(role, olderOnly = false) {
  if (!role) return null;
  for (const p of net.peers.values()) {
    if (isBotPeer(p) || p.role !== role) continue;
    if (!olderOnly) return p;
    const since = p.since || 0;
    if (since < net.since || (since === net.since && p.id < net.id)) return p;
  }
  return null;
}
/* The nearest real player within reach with nothing in their hands. */
function barNearestEmptyHanded(reach = 2.2) {
  let best = null, bestD = reach;
  for (const rp of remotes.byId.values()) {
    if (!rp.peer || isBotPeer(rp.peer) || !rp.alive || (rp.peer.drink | 0)) continue;
    const d = Math.hypot(rp.pos.x - move.pos.x, rp.pos.z - move.pos.z);
    if (d < bestD && Math.abs(rp.pos.y - move.pos.y) < 1.5) { best = rp; bestD = d; }
  }
  return best;
}

/* What holding X does where we stand, best first. */
function barAction(B) {
  const now = performance.now();
  // A drink held out to us, its giver beside us.
  if (bar.offer && !bar.drink && now < bar.offer.until) {
    const rp = remotes.byId.get(bar.offer.from);
    if (rp && Math.hypot(rp.pos.x - move.pos.x, rp.pos.z - move.pos.z) < 3) {
      return { key: "take", label: `Take ${bar.offer.name}'s ${drinkName(bar.offer.kind)}`, ctx: "Take", time: 0.35,
        done: () => { net.publishRp({ k: "take", to: bar.offer.from }); } };
    }
  }
  if (B) {
    if (!bar.drink && barNear(B, B.rack)) {
      return { key: "rack", label: "Grab a mug", busy: "Grabbing a mug…", ctx: "Grab", time: GRAB_TIME,
        done: () => { bar.drink = { kind: "beer", sips: 0 }; audio.brassTinkle?.(4); showWaveBanner(isTouch ? "Fill it at a barrel tap" : "Fill it at a barrel tap · G puts it down", 1800); } };
    }
    if (bar.drink?.kind === "beer" && bar.drink.sips < BEER_SIPS && B.taps.some((t) => barNear(B, t))) {
      return { key: "tap", label: bar.drink.sips ? "Top it up" : "Fill your mug", busy: "Pouring…", ctx: "Fill",
        time: bar.role === "bartender" ? FILL_TIME_BARTENDER : FILL_TIME,
        done: () => { bar.drink.sips = BEER_SIPS; audio.pump?.(0.4); showWaveBanner(isTouch ? "Fire to sip" : "Click to sip", 1400); } };
    }
    if (barNear(B, B.apron)) {
      if (bar.role === "bartender") {
        return { key: "apron", label: "Hang up the apron", busy: "Untying…", ctx: "Apron", time: APRON_TIME,
          done: () => setBarRole(null, "Apron's back on the hook.") };
      }
      const other = otherWithRole("bartender");
      if (other) return { key: "apron", info: true, label: `${other.name} is tending bar` };
      return { key: "apron", label: "Put on the apron (bartender)", busy: "Tying it on…", ctx: "Apron", time: APRON_TIME,
        done: () => setBarRole("bartender", "You're the bartender. You pour faster, pour whiskey at the back-bar and ring the bell for last call.") };
    }
    if (bar.role === "bartender" && !bar.drink && barNear(B, B.bottles)) {
      return { key: "bottles", label: "Pour a whiskey", busy: "Pouring…", ctx: "Pour", time: POUR_TIME,
        done: () => { bar.drink = { kind: "whiskey", sips: 1 }; audio.brassTinkle?.(3); } };
    }
    if (bar.role === "bartender" && barNear(B, B.bell)) {
      return { key: "bell", label: "Ring the bell (last call)", ctx: "Bell", time: 0.2,
        done: () => { net.publishRp({ k: "bell" }); lastCall(playerName()); } };
    }
  }
  // Trolling Loud: ask DJ Lulz for a song at the booth.
  const dj = djLulz.action(move.pos);
  if (dj) return dj;
  // Hold a drink out to whoever is beside us with empty hands.
  if (bar.drink?.sips > 0 && !bar.outgoing) {
    const rp = barNearestEmptyHanded();
    if (rp) {
      const name = rp.peer.name || "them";
      return { key: `give:${rp.peer.id}`, label: `Hand ${name} your ${drinkName(bar.drink.kind)}`, ctx: "Give", time: 0.45,
        done: () => {
          bar.outgoing = { to: rp.peer.id, name, until: performance.now() + OFFER_SECONDS * 1000 };
          net.publishRp({ k: "offer", to: rp.peer.id, kind: bar.drink.kind, sips: bar.drink.sips });
          showWaveBanner(`Holding it out to ${name}`, 1600);
        } };
    }
  }
  return rpAction();
}

/* One job at a time: taking one puts down whatever we had. */
function setBarRole(role, note) {
  if (bar.role === "pianist" && role !== "pianist") piano.playing = false;
  bar.role = role;
  bar.outT = 0;
  if (note) showWaveBanner(note, role ? 3600 : 1600);
}

/* ------------------------ Socialize roleplay, phase 2 (rp-roles.js) ------------------------

   User, 2026-10-04: "seats everywhere, ... piano player, ... doctor".
   Every chair, stool, bench and settee in town is a seat (the map's
   rp.seats): hold X by one to sit, move or jump to get up. The piano stool
   makes you the pianist (fire plays a tune, again stops, the next start is
   the next tune); everyone nearby hears it. Doc Grin's bag on his desk is
   the doctor's job: hold X by someone for a check-up that sobers them up.
   Anyone can take a tonic at his medicine shelf. A townsfolk NPC with the
   job steps off while a player has it. */
let seated = null;    // { idx, s } while we're sat down
const piano = { playing: false, tune: 0, played: false, voices: new Map(), t: 0 };
let npcYieldKey = "";

const rpSeats = () => (isSocial() ? builtMap?.map?.rp?.seats?.() || null : null);
const docSpots = () => (isSocial() ? builtMap?.map?.rp?.doctor || null : null);
setSeatLookup(() => rpSeats());

/* Is seat `i` taken: by a player, or by a townsfolk NPC sat there (the
   piano player gets up for a player). */
function seatTaken(i) {
  for (const p of net.peers.values()) if (!isBotPeer(p) && p.seat === i + 1) return true;
  const s = rpSeats()?.[i];
  if (!s || s.kind === "piano") return false;
  for (const n of townNpcs?.sitters() || []) {
    if (Math.hypot(n.x - s.x, n.z - s.z) < 0.4 && Math.abs(n.y - s.y) < 0.5) return true;
  }
  return false;
}

/* The nearest free seat within reach, on our floor. */
function nearestSeat(reach = 0.95) {
  const seats = rpSeats();
  if (!seats) return -1;
  let best = -1, bestD = reach;
  for (let i = 0; i < seats.length; i++) {
    const s = seats[i];
    if (Math.abs(move.pos.y - s.floor) > 0.6) continue;
    const d = Math.hypot(s.x - move.pos.x, s.z - move.pos.z);
    if (d < bestD && !seatTaken(i)) { best = i; bestD = d; }
  }
  return best;
}

function sitDown(idx) {
  const s = rpSeats()?.[idx];
  if (!s) return;
  if (emote) stopEmote();
  seated = { idx, s };
  move.pos.set(s.x, s.floor, s.z);
  move.velocity.set(0, 0, 0);
  if (s.yaw != null) look.yaw = s.yaw;
  if (s.kind !== "piano") { showWaveBanner(isTouch ? "Move to get up" : "Move or jump to get up", 1400); return; }
  // The piano stool: the pianist's job, if it's free and we have no other.
  const other = otherWithRole("pianist");
  if (other) showWaveBanner(`${other.name} has the piano`, 1800);
  else if (bar.role && bar.role !== "pianist") showWaveBanner(`You're the ${ROLES[bar.role].label.toLowerCase()}: one job at a time`, 2000);
  else setBarRole("pianist", isTouch ? "You're on the piano. Fire plays a tune, again stops." : "You're on the piano. Click to play a tune, again to stop.");
}

function standUp() {
  const s = seated?.s;
  seated = null;
  if (!s) return;
  move.pos.set(s.stand.x, s.floor, s.stand.z);
  move.velocity.set(0, 0, 0);
  if (bar.role === "pianist") setBarRole(null, null);
}

/* Sat down: stay put, eyes at seated height; any move or a jump gets up. */
function holdSeat(dt, ix, iz, jump) {
  if (ix || iz || jump || !player.alive) { standUp(); return; }
  const s = seated.s;
  move.pos.set(s.x, s.floor, s.z);
  move.velocity.set(0, 0, 0);
  move.moving = false;
  move.sprinting = false;
  move.grounded = true;
  move.eyeHeight = damp(move.eyeHeight, s.y - s.floor + 0.74, 10, dt);
}

/* Hold X (after the saloon bar's own): the doctor, a seat. */
function rpAction() {
  if (seated) return null;
  // The doctor: a check-up for whoever's beside us (before the bag:
  // a patient by the desk shouldn't get the bag put down).
  if (bar.role === "doctor") {
    const rp = rpNearestPlayer(2.0);
    if (rp) {
      const name = rp.peer.name || "them";
      return { key: `check:${rp.peer.id}`, label: `Give ${name} a check-up`, busy: "Say ahh…", ctx: "Check", time: DOCTOR.checkTime,
        done: () => { net.publishRp({ k: "cure", to: rp.peer.id }); showWaveBanner(`${name}: a clean bill of health`, 1600); } };
    }
  }
  const D = docSpots();
  if (D) {
    if (barNear(D, D.bag)) {
      if (bar.role === "doctor") {
        return { key: "docbag", label: "Put down the doctor's bag", busy: "Closing it up…", ctx: "Bag", time: DOCTOR.bagTime,
          done: () => setBarRole(null, "Doc's bag is back on the desk.") };
      }
      const other = otherWithRole("doctor");
      if (other) return { key: "docbag", info: true, label: `${other.name} is the doctor` };
      return { key: "docbag", label: "Take the doctor's bag (doctor)", busy: "Opening it…", ctx: "Bag", time: DOCTOR.bagTime,
        done: () => setBarRole("doctor", "You're the doctor. Hold X by anyone for a check-up: it sobers them right up.") };
    }
    if (barNear(D, D.tonic)) {
      return { key: "tonic", label: "Take a tonic", busy: "Glug…", ctx: "Tonic", time: DOCTOR.tonicTime,
        done: () => { bar.tipsy = Math.max(0, bar.tipsy - DOCTOR.tonic); audio.brassTinkle?.(2); showWaveBanner(bar.tipsy > TIPSY.onset ? "A little steadier" : "Steady as a rock", 1400); } };
    }
  }
  const i = nearestSeat();
  if (i >= 0) {
    const s = rpSeats()[i];
    return { key: `seat:${i}`, label: s.kind === "piano" ? "Sit at the piano" : "Sit down", ctx: "Sit", time: 0.3, done: () => sitDown(i) };
  }
  return null;
}

/* The nearest real player within reach, whatever's in their hands. */
function rpNearestPlayer(reach) {
  let best = null, bestD = reach;
  for (const rp of remotes.byId.values()) {
    if (!rp.peer || isBotPeer(rp.peer) || !rp.alive) continue;
    const d = Math.hypot(rp.pos.x - move.pos.x, rp.pos.z - move.pos.z);
    if (d < bestD && Math.abs(rp.pos.y - move.pos.y) < 1.5) { best = rp; bestD = d; }
  }
  return best;
}

/* Fire at the piano: start a tune (the next one each time), or stop. */
function togglePiano() {
  if (piano.playing) { piano.playing = false; return; }
  if (piano.played) piano.tune = (piano.tune + 1) % TUNES.length;
  piano.played = true;
  piano.playing = true;
  showWaveBanner(`♪ ${TUNES[piano.tune].name}`, 1800);
}
const atPiano = () => seated?.s.kind === "piano" && bar.role === "pianist";

/* Each frame in Socialize: the townsfolk off shift, every piano that's
   playing (ours and the room's), heard from where we stand. */
function updateRp(dt) {
  if (bar.role === "pianist" && !atPiano()) setBarRole(null, null);
  // Which NPC jobs a player has.
  const yieldRoles = new Set();
  const seats = rpSeats();
  const jobs = [bar.role, ...[...net.peers.values()].filter((p) => !isBotPeer(p)).map((p) => p.role)];
  for (const r of jobs) if (ROLES[r]) yieldRoles.add(ROLES[r].npc);
  if (seated?.s.kind === "piano") yieldRoles.add(ROLES.pianist.npc);
  for (const p of net.peers.values()) if (p.seat && seats?.[p.seat - 1]?.kind === "piano") yieldRoles.add(ROLES.pianist.npc);
  const key = [...yieldRoles].sort().join();
  if (key !== npcYieldKey && townNpcs) { npcYieldKey = key; townNpcs.setYield(yieldRoles); }

  // The pianos: ours, and each player at a piano with a tune going.
  const want = new Map();
  if (piano.playing && atPiano()) want.set("me", { tune: piano.tune, s: seated.s });
  for (const p of net.peers.values()) {
    const s = p.piano && p.seat ? seats?.[p.seat - 1] : null;
    if (s?.kind === "piano" && p.role === "pianist") want.set(p.id, { tune: p.piano - 1, s });
  }
  for (const [id, v] of piano.voices) {
    const w = want.get(id);
    if (!w || w.tune !== v.tune) { v.stop(); piano.voices.delete(id); }
  }
  for (const [id, w] of want) {
    let v = piano.voices.get(id);
    if (!v) { v = new PianoVoice(audio, { x: w.s.x, y: w.s.y + 0.6, z: w.s.z }, w.tune); piano.voices.set(id, v); }
    // Loud in the saloon, gone a street away.
    const d = Math.hypot(w.s.x - camera.position.x, w.s.z - camera.position.z);
    v.update(Math.max(0, Math.min(1, 1 - (d - 10) / 28)) * 0.9);
  }
}

function stopPianos() {
  for (const v of piano.voices.values()) v.stop();
  piano.voices.clear();
  piano.playing = false;
}

function lastCall(who) {
  showWaveBanner(`Last call at the Rusty Grin! (${who})`, 2600);
  audio.medal?.("gold");
}

function putDownDrink() {
  if (!bar.drink) return;
  bar.drink = null;
  bar.sipT = 0;
  bar.outgoing = null;
  audio.brassTinkle?.(3);
}

/* Off the wire (net "rp"). */
function onBarMessage(p, m) {
  if (!isSocial() || isBotPeer(p)) return;
  if (m.k === "bell") { lastCall(p.name || "the bartender"); return; }
  if (m.to !== net.id) return;
  const now = performance.now();
  if (m.k === "cure") {
    // Only from whoever has the doctor's bag.
    if (p.role !== "doctor") return;
    bar.tipsy = 0;
    showWaveBanner(`${p.name || "The doctor"} gave you a check-up: right as rain`, 2200);
    audio.brassTinkle?.(2);
    return;
  }
  if (m.k === "offer") {
    if (bar.drink) return;
    const kind = m.kind === "whiskey" ? "whiskey" : "beer";
    bar.offer = { from: p.id, name: p.name || "someone", kind, sips: Math.max(1, Math.min(drinkMax(kind), m.sips | 0)), until: now + OFFER_SECONDS * 1000 };
    showWaveBanner(`${bar.offer.name} offers you a ${drinkName(kind)}: hold X by them`, 2600);
  } else if (m.k === "take") {
    // Only the drink we held out, to them, if we still have it.
    if (!bar.outgoing || bar.outgoing.to !== p.id || !bar.drink) return;
    const d = bar.drink;
    bar.drink = null; bar.outgoing = null; bar.sipT = 0;
    net.publishRp({ k: "give", to: p.id, kind: d.kind, sips: d.sips });
  } else if (m.k === "give") {
    if (!bar.offer || bar.offer.from !== p.id || bar.drink) return;
    const kind = m.kind === "whiskey" ? "whiskey" : "beer";
    bar.drink = { kind, sips: Math.max(0, Math.min(drinkMax(kind), m.sips | 0)) };
    bar.offer = null;
    audio.brassTinkle?.(4);
    showWaveBanner("Cheers!", 1200);
  }
}

function updateBar(dt) {
  const B = barSpots();
  const now = performance.now();
  bar.tipsy = Math.max(0, bar.tipsy - TIPSY.decay * dt);
  if (bar.offer && now > bar.offer.until) bar.offer = null;
  if (bar.outgoing && now > bar.outgoing.until) bar.outgoing = null;

  // A sip: fire, one at a time. The drink goes down halfway through it.
  const fireNow = !localPauseOnly && !emoteWheel.isOpen && (mouseDown || (isTouch && touchState.firing) || (gamepadState.connected && gamepadState.firing));
  if (fireNow && !bar.fireWas && atPiano() && player.alive) togglePiano();   // at the piano, fire plays
  else if (fireNow && !bar.fireWas && bar.drink?.sips > 0 && bar.sipT <= 0 && player.alive) {
    bar.sipT = SIP_TIME; bar.sipDone = false;
    if (emote) stopEmote();
  }
  bar.fireWas = fireNow;
  if (bar.sipT > 0) {
    bar.sipT = Math.max(0, bar.sipT - dt);
    if (!bar.sipDone && bar.sipT <= SIP_TIME / 2 && bar.drink) {
      bar.sipDone = true;
      bar.drink.sips = Math.max(0, bar.drink.sips - 1);
      bar.tipsy = Math.min(TIPSY.max + 1, bar.tipsy + (bar.drink.kind === "whiskey" ? TIPSY.perShot : TIPSY.perBeerSip));
      if (!bar.drink.sips && bar.drink.kind === "whiskey") bar.drink = null;   // the shot glass goes back
      else if (!bar.drink.sips) showWaveBanner("Empty. Fill it again at a tap", 1400);
    }
  }
  if (bar.tipsy >= TIPSY.onset && !bar.tipsyShown) { bar.tipsyShown = true; showWaveBanner("You're feeling it…", 1800); }
  if (bar.tipsy < TIPSY.onset * 0.5) bar.tipsyShown = false;
  const fx = tipsyFx(bar.tipsy, now / 1000);
  if (fx.k > 0 && player.alive && !localPauseOnly) look.yaw += fx.yaw;

  // The bartender: off the job if they wander out. Any job: off it if
  // someone who got there first has it too.
  if (bar.role === "bartender") {
    if (!B) bar.role = null;
    else {
      bar.outT = barInside(B) ? 0 : bar.outT + dt;
      if (bar.outT > BARTENDER_LEAVE_SECONDS) setBarRole(null, "You left the saloon: the apron's back on its hook.");
    }
  }
  const older = otherWithRole(bar.role, true);
  if (older) setBarRole(null, `${older.name} already has that job.`);
  updateRp(dt);

  // Hold X.
  const act = player.alive ? barAction(B) : null;
  const held = !frozenPlayer() && !duoXClaimed && !localPauseOnly
    && (keys.has("KeyX") || (isTouch && touchState.swap) || !!gamepadState.pickup);
  if (!held) bar.holdLock = false;
  if (act && !act.info && held && !bar.holdLock) {
    if (bar.hold?.key !== act.key) { bar.hold = act; bar.holdT = 0; }
    bar.holdT += dt;
    if (bar.holdT >= act.time) {
      bar.hold = null; bar.holdT = 0; bar.holdLock = true;
      act.done();
    }
  } else { bar.hold = null; bar.holdT = 0; }

  setTouchContext(act && !act.info ? act.ctx : null);
  if (els.pickupPrompt) {
    if (act) {
      els.pickupPrompt.hidden = false;
      els.pickupPromptText.textContent = bar.hold && act.busy ? act.busy : act.label;
      // A keycap that pulses until you hold it, like Troll Royale's loot:
      // nobody knows the bar is a hold otherwise.
      const cap = !isTouch && !act.info;
      els.pickupPrompt.classList.toggle("is-royale", cap);
      if (els.pickupKey) {
        els.pickupKey.hidden = !cap;
        if (cap) {
          const k = gamepadState.connected ? "D-pad →" : "X";
          if (els.pickupKeyCap.textContent !== k) els.pickupKeyCap.textContent = k;
          els.pickupKey.classList.toggle("is-held", !!bar.hold);
        }
      }
      els.pickupBarFill.style.width = `${act.info ? 0 : Math.round(Math.min(1, bar.holdT / act.time) * 100)}%`;
    } else els.pickupPrompt.hidden = true;
  }
  document.body.classList.toggle("to-social-drink", !!bar.drink);
  document.body.classList.toggle("to-social-armed", !socialUnarmed());
}

/* The sip as a 0..1..0 lift (up to the mouth, back down). */
function barSipK() {
  if (bar.sipT <= 0) return 0;
  const t = 1 - bar.sipT / SIP_TIME;
  return Math.min(1, Math.sin(Math.PI * t) * 1.6);
}

/* Our own body's drink, in third person. */
function syncLocalDrink(show) {
  const kind = show && bar.drink ? bar.drink.kind : null;
  if ((bar.tp?.userData.kind || null) !== kind) {
    if (bar.tp) { bar.tp.parent?.remove(bar.tp); bar.tp = null; }
    if (kind) { bar.tp = buildDrink(kind); mountDrink(localRig, bar.tp); }
  }
  if (!bar.tp) return;
  bar.tp.userData.setSips(bar.drink.sips);
  poseDrinkArm(localRig, barSipK());
}

/* Our first-person hand's drink, placed on the right streak-arm hand (its
   transform, not its child: the hand itself is hidden). */
function syncFpDrink(show) {
  const kind = show && bar.drink ? bar.drink.kind : null;
  if ((bar.fp?.userData.kind || null) !== kind) {
    if (bar.fp) { bar.fp.parent?.remove(bar.fp); bar.fp = null; }
    if (kind) bar.fp = buildDrink(kind);
  }
  if (!bar.fp) return;
  const hand = streakArms.userData.arms[0].hand;
  if (bar.fp.parent !== hand.parent) hand.parent.add(bar.fp);
  bar.fp.userData.setSips(bar.drink.sips);
  placeDrinkInHand(bar.fp, hand, 1);
}

const socialArms = { phase: 0, k: 0, run: 0, at: 0 };
function socialArmsFrame() {
  const now = performance.now();
  const dt = Math.min(0.1, (now - (socialArms.at || now)) / 1000);
  socialArms.at = now;
  const speed = Math.hypot(move.velocity.x, move.velocity.z);
  const moving = move.moving && move.grounded && speed > 0.3;
  socialArms.k += ((moving ? 1 : 0) - socialArms.k) * Math.min(1, dt * 6);
  socialArms.run += ((move.sprinting ? 1 : 0) - socialArms.run) * Math.min(1, dt * 5);
  if (moving) socialArms.phase += dt * gaitPhaseRate(speed);
  const k = socialArms.k, run = socialArms.run;
  const hand = (side) => {
    // Right and left swing opposite each other, like the legs.
    const sw = Math.sin(socialArms.phase + (side > 0 ? 0 : Math.PI));
    const lift = Math.max(0, sw);   // the forward swing comes up into view
    // The view's bottom edge is about y -0.25 this far out (the viewmodel
    // lens is ~58°): standing still they sit below it, walking they rise
    // into it on each forward swing, sprinting they pump well up.
    return {
      pos: [
        side * (0.22 - run * 0.04),
        -0.46 + k * (0.19 + run * 0.04) + lift * k * (0.08 + run * 0.09),
        -0.45 - sw * k * (0.05 + run * 0.06),
      ],
      rot: [0.25 + run * 0.3 + lift * k * (0.25 + run * 0.35), side * 0.12, -side * Math.PI / 2],
      pose: run > 0.5 ? "fist" : "relaxed",
    };
  };
  // A drink (the saloon bar) rides in the right hand: held up in view and
  // steady, bobbing with the walk; a sip brings it to the mouth, tipped.
  let R = hand(1);
  if (bar.drink) {
    const s = barSipK();
    const bob = Math.sin(socialArms.phase * 2) * 0.008 * k;
    // At the top of a sip the rim is at your lip, so what you see is the
    // glass tipping up past you, not a face-full of foam.
    R = {
      pos: [0.17 - s * 0.11, -0.18 + bob + s * 0.12, -0.4 + s * 0.16],
      rot: [s * 0.95, 0.1 - s * 0.1, -Math.PI / 2],
      pose: "grip",
    };
  }
  // At the piano: both hands out on the keys, busy while a tune's going.
  if (atPiano()) {
    const a = piano.playing ? 1 : 0.15, t = piano.t;
    const keysHand = (side, rate) => ({
      pos: [side * 0.17 + Math.sin(t * 1.9 + side) * 0.03 * a, -0.3 + Math.max(0, Math.sin(t * rate)) * 0.02 * a, -0.44],
      rot: [0.95, side * 0.1, -side * Math.PI / 2], pose: "relaxed",
    });
    return { R: keysHand(1, 11), L: keysHand(-1, 9), gun: false, cam: { pitch: 0, yaw: 0 }, social: true };
  }
  return { R, L: hand(-1), gun: false, cam: { pitch: barSipK() * 0.06, yaw: 0 }, social: true };
}

const _emoteRodTip = new THREE.Vector3();
function updateFpEmoteView() {
  const f = fpEmoteFrame() || (socialUnarmed() && player.alive ? socialArmsFrame() : null);
  if (!f) {
    if (fpEmoteArmsOn) { hideStreakArms(); fpEmoteArmsOn = false; }
    syncFpDrink(false);
    hideFpEmoteProps();
    return;
  }
  inspectArms.visible = false;
  if (activeMeleeMesh) activeMeleeMesh.visible = false;
  // The gun is put away: so are the rods that hold it, or they hang in view
  // as a second pair beside the emote's.
  // Socialize has no gun to do a trick with: the hands act it out alone.
  const gun = !socialUnarmed() && f.gun;
  if (!gun) pfArms.visible = false;
  if (activeWeaponMesh) {
    activeWeaponMesh.visible = !!gun && player.holding === "gun";
    if (gun) {
      activeWeaponMesh.position.y += f.gun.lift || 0;
      activeWeaponMesh.rotateZ(f.gun.spin || 0);
    }
  }
  fpEmoteArmsOn = true;
  poseFreeArms(f);
  // An emote's own props in your hands (Pour up's cup and bottle).
  const props = emoteKind() === "fp" ? EMOTES[emote.idx].fpProps : null;
  if (props) {
    props(streakArms, streakArms.userData.arms[0].hand, streakArms.userData.arms[1].hand, emote.t);
    // The rods have no hand to wrap round it: each ends with its tip just
    // touching the prop, coming in from outside (user: "the end of
    // the arm should slightly touch the cup but the arm shouldnt be seen
    // being inside of the cup").
    streakArms.userData.arms.forEach((arm, i) => {
      if (arm.rod.visible && fpEmoteRodTip(i === 0 ? 1 : -1, STREAK_SHOULDER[i], arm.hand.position, _emoteRodTip)) stretchBetween(arm.rod, STREAK_SHOULDER[i], _emoteRodTip);
    });
  } else hideFpEmoteProps();
  // The saloon bar's drink, in the right hand (not during an emote).
  syncFpDrink(!!f.social);
}

/* Both streak arms placed straight from hand targets in viewmodel space
   ({R, L}: {pos, rot, pose} or null), not off a device's grip anchors: the
   first-person emotes and the K9 whistle. */
function poseFreeArms(f) {
  streakArms.visible = true;
  const arms = streakArms.userData.arms;
  ["R", "L"].forEach((k, i) => {
    const arm = arms[i], h = f[k];
    // The black rods act the emote out, no fingers at all (user: "it makes it
    // even funnier"). The white hand stays placed, unseen, as the point the
    // rod reaches for and the frame anything held in it hangs off.
    arm.hand.visible = arm.wrist.visible = arm.cuff.visible = arm.sleeve.visible = false;
    arm.rod.visible = !!h;
    if (!h) return;
    arm.hand.position.set(h.pos[0], h.pos[1], h.pos[2]);
    arm.hand.rotation.set(h.rot[0], h.rot[1], h.rot[2], "YXZ");
    stretchBetween(arm.rod, STREAK_SHOULDER[i], arm.hand.position);
  });
}

let weaponLowerT = 0;

/* Phase 2 (DESIGN-ARMS.md §5): landing-impact dip. `move.justLanded`/
   `landSpeed` (movement.js) already exist and were unused before this —
   a one-frame edge the viewmodel converts into a decaying impulse rather
   than a fixed-length animation, so a light hop and a hard fall from a
   vault both settle at their own natural rate. */
let landDipT = 0;      // 0..1, decays via damp() back to 0 each frame
let landDipMag = 0;    // captured strength of the current dip, set once on the landing frame
const LAND_DIP_MAX_SPEED = 9;   // landSpeed at/above this reads as "full" impact
const LAND_DIP_POS = 0.05;      // meters of downward dip at full impact
const LAND_DIP_PITCH = 0.16;    // radians of forward tilt at full impact

/* Phase 2: sprint transition polish. weaponLowerT already handles the
   flat lower; this adds the "sling to the side" roll on the way out and
   lets the return overshoot slightly before settling, scaled by weapon
   weight so a heavy gun swings wider than a pistol. */
let sprintRollT = 0;

/* Phase 2: start/stop settling. bobPhase (weapons.js) freezes rather than
   resetting when movement stops, which already avoids a snap-to-zero, but
   the amplitude itself still cuts instantly from full to whatever the
   frozen phase happens to be. This eases the amplitude multiplier instead,
   so stopping reads as the weapon settling rather than the bob motion just
   stopping mid-swing. */
let bobSettleT = 0;
// Turn lag: last frame's look angles and the smoothed lag offsets.
let lastLookYaw = 0, lastLookPitch = 0, turnLagX = 0, turnLagY = 0;
let slideTiltT = 0;   // camera roll while sliding, eased in and out

/* Phase 2: ADS transition weight. `w.adsT` (weapons.js) ramps linearly at
   a fixed rate and drives FOV/laser-threshold/etc elsewhere, so it isn't
   safe to reshape directly. Instead this is a damped shadow of it, lagging
   behind exactly like swaySmoothX/Y already lag behind raw sway — used
   only for the hip<->ADS position lerp, so heavier guns settle into their
   sight picture instead of snapping there linearly. */
let adsSmoothT = 0;

/* Weapon inspect (D-pad up / T). Admires whatever's in hand — pure
   flourish, cancelled by anything that matters (firing, aiming, reloading,
   sprinting, swinging) so it can never cost you a fight.

   Long guns get a proper showcase: both hands bring the gun up to the
   middle of the screen side-on (left side, muzzle left, the whole gun
   visible edge to edge), a wrist twist turns it round to the right side,
   then it goes back to the hip. Skins are authored so the right side reads
   correctly too (see the sides formula in HANDOFF.md), so this is the
   moment a skin gets seen in full. Sidearms keep their quick twirl. The
   Keyboard Warrior gets tossed: it flips up out of the hands, floats in
   front of the camera keys-out with the RGB running, then drops back into
   the catch. */
const GUN_INSPECT_TIME = 4.2;
const SIDEARM_INSPECT_TIME = 2.2;
const MELEE_INSPECT_TIME = 3.6;
let inspectT = 0;
let inspectDur = GUN_INSPECT_TIME;
let inspectFreeze = null;   // test hook: pin the animation at one t

function isLongGunInspect(w) { return w.def.cls !== "sidearm"; }

function startInspect() {
  if (socialUnarmed()) return;
  if (inspectT > 0 || !player.alive || gameState !== "playing" || move.busy) return;
  if (player.holding === "gun") {
    const w = currentWeapon();
    if (w.reloading || w.adsT > 0.05) return;
    inspectDur = w.def.akimbo ? AKIMBO_INSPECT_TIME : isLongGunInspect(w) ? (w.def.inspectTime ?? GUN_INSPECT_TIME) : SIDEARM_INSPECT_TIME;
  } else if (player.holding === "melee") {
    if (!player.melee || player.melee.busy) return;
    inspectDur = player.melee.chainsaw ? SAW_REV_TIME : MELEE_INSPECT_TIME;
  } else {
    return;
  }
  inspectT = inspectDur;
  sawRevBlips = 0;
  // Admiring the chainsaw revs it instead (applySawRev plays the blips).
  if (player.holding === "gun" && currentWeapon().def.akimbo) audio.hammerCock();
  else if (player.holding !== "melee" || !player.melee.chainsaw) audio.reload();     // the same handling clicks, which is what an inspect is
}

function updateInspect(dt) {
  if (inspectT <= 0) { inspectArms.visible = false; return; }
  // Anything that matters takes the weapon back immediately.
  // Sprinting does NOT cancel it: PF lets you admire the gun on the run.
  if (!player.alive || move.busy) { inspectT = 0; return; }
  if (player.holding === "gun") {
    const w = currentWeapon();
    if (w.reloading || w.adsT > 0.05) { inspectT = 0; return; }
  } else if (player.holding === "melee") {
    if (!player.melee || player.melee.busy) { inspectT = 0; return; }
  } else {
    inspectT = 0;
    return;
  }
  if (inspectFreeze != null) { inspectT = Math.max(1e-4, (1 - inspectFreeze) * inspectDur); return; }
  inspectT = Math.max(0, inspectT - dt);
}

function inspectProgress() { return inspectT > 0 ? 1 - inspectT / inspectDur : 0; }

// stage()/rise() now live in anim-curves.js, imported above.

/* Keyframe track: rows of [t, v1, v2, ...] with t rising 0..1. Sampled as a
   cubic Hermite with Catmull-Rom tangents, so the motion flows through the
   keys instead of stopping on each one, and eases in/out at the two ends. */
function sampleKeys(keys, t, out) {
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const k1 = keys[i], k2 = keys[i + 1];
  const k0 = keys[i - 1], k3 = keys[i + 2];
  const span = k2[0] - k1[0];
  const u = Math.max(0, Math.min(1, (t - k1[0]) / span));
  const u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  for (let j = 1; j < k1.length; j++) {
    const m1 = k0 ? (k2[j] - k0[j]) / (k2[0] - k0[0]) * span : 0;
    const m2 = k3 ? (k3[j] - k1[j]) / (k3[0] - k1[0]) * span : 0;
    out[j - 1] = h00 * k1[j] + h10 * m1 + h01 * k2[j] + h11 * m2;
  }
  return out;
}

/* Where the model's middle is and how long it is, in its own space, hands
   left out. Measured once per built mesh: the pivot of every view model is
   its grip, and a side-on gun spun about its grip swings half off screen. */
function inspectBounds(mesh) {
  if (mesh.userData.inspectBounds) return mesh.userData.inspectBounds;
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  const m = new THREE.Matrix4();
  const inv = new THREE.Matrix4();
  mesh.updateWorldMatrix(true, true);
  inv.copy(mesh.matrixWorld).invert();
  mesh.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    for (let p = o; p && p !== mesh; p = p.parent) if (p.userData.hand) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    m.multiplyMatrices(inv, o.matrixWorld);
    tmp.copy(o.geometry.boundingBox).applyMatrix4(m);
    box.union(tmp);
  });
  const size = box.getSize(new THREE.Vector3());
  const bounds = { center: box.getCenter(new THREE.Vector3()), len: Math.max(size.x, size.y, size.z) };
  mesh.userData.inspectBounds = bounds;
  return bounds;
}

/* How far in front of the camera a model of this length has to sit to fill
   `frac` of the screen width. Aspect-aware, so a 4:3 iPad and a 21:9
   monitor both see the whole gun. */
function inspectDistance(len, frac) {
  const halfH = Math.tan(THREE.MathUtils.degToRad(weaponCamera.fov / 2));
  const halfW = halfH * Math.max(0.5, weaponCamera.aspect);
  return THREE.MathUtils.clamp((len / 2) / (frac * halfW), 0.42, 1.4);
}

/* Pistol: a one-handed showman's twirl around the trigger guard. Additive,
   on top of the normal hip pose. */
const _inspectPose = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 };
function _zeroPose(p) { p.x = p.y = p.z = p.pitch = p.yaw = p.roll = 0; return p; }
function inspectTwirl(t, p) {
  const overallEase = Math.sin(Math.min(1, t / 0.1) * Math.PI / 2)
    * Math.sin(Math.min(1, (1 - t) / 0.15) * Math.PI / 2);
  const spins = 1.5; // full turns
  p.roll = Math.sin(t * Math.PI * 2 * spins) * overallEase * 0.9;
  p.yaw = overallEase * Math.sin(t * Math.PI * 2 * spins + 0.6) * 0.22;
  p.pitch = overallEase * 0.1;
  p.x = overallEase * -0.02;
  p.y = overallEase * 0.03;
  p.z = overallEase * 0.06;
}

function inspectPose() {
  const p = _inspectPose;
  if (inspectT <= 0 || player.holding !== "gun") return _zeroPose(p);
  const w = currentWeapon();
  if (isLongGunInspect(w) || w.def.akimbo) return _zeroPose(p);   // applyGunInspect / akimbo-view own those
  inspectTwirl(inspectProgress(), p);
  return p;
}

/* Long-gun showcase keys: [t, yaw°, twist°, tilt°, x, y, dz].
   yaw   +90 = muzzle left, left side to camera; -90 = muzzle right.
   twist roll about the barrel; toward the camera shows the top of the gun.
   tilt  muzzle up, in the screen plane.
   x/y   where the middle of the gun sits (camera space); dz pushes it back.
   Beats: bring up (0-.16), admire the left side with a slow drift (.16-.44),
   wrist twist through muzzle-away (.44-.62), admire the right side
   (.62-.86), back to the hip (.86-1). */
const GUN_INSPECT_KEYS = [
  [0.00,  58,  26, -10,  0.07, -0.13, 0.08],
  [0.16,  84,  15,   4,  0.00, -0.035, 0],
  [0.30,  79,   9,   6, -0.012, -0.028, 0],
  [0.44,  87,  17,   2,  0.004, -0.04, 0],
  [0.53,  28, -30,  -2,  0.00, -0.015, 0.07],
  [0.62, -84, -15,   4,  0.00, -0.035, 0],
  [0.74, -79,  -9,   6,  0.012, -0.028, 0],
  [0.86, -87, -17,   2, -0.004, -0.04, 0],
  [1.00, -48, -26, -10,  0.09, -0.14, 0.08],
];
const _gunKey = new Array(6).fill(0);
const _qTilt = new THREE.Quaternion();
const _qYaw = new THREE.Quaternion();
const _qTwist = new THREE.Quaternion();
const _qInspect = new THREE.Quaternion();
const _vInspect = new THREE.Vector3();
const _vCenter = new THREE.Vector3();
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

/* Runs after the normal gun pose is set, and blends from it to the
   showcase pose, so sway/bob hand over smoothly at both ends. */
function applyGunInspect(mesh, w) {
  const long = inspectT > 0 && player.holding === "gun" && isLongGunInspect(w);
  const t = long ? inspectProgress() : 0;
  const blend = long ? rise(t, 0, 0.14) * (1 - rise(t, 0.86, 1)) : 0;
  // The rods stay on the gun through the inspect (user:
  // no white hands anywhere; the old showcase arms are retired).
  inspectArms.visible = false;
  if (blend <= 0) return;

  const [yaw, twist, tilt, x, y, dz] = sampleKeys(mesh.userData.inspectKeys ?? GUN_INSPECT_KEYS, t, _gunKey);
  const yawR = THREE.MathUtils.degToRad(yaw);
  // Muzzle-up is a different screen rotation depending on which way the
  // muzzle points; sin(yaw) carries it smoothly through the turn.
  _qTilt.setFromAxisAngle(AXIS_Z, -THREE.MathUtils.degToRad(tilt) * Math.sin(yawR));
  _qYaw.setFromAxisAngle(AXIS_Y, yawR);
  _qTwist.setFromAxisAngle(AXIS_Z, THREE.MathUtils.degToRad(twist));
  _qInspect.copy(_qTilt).multiply(_qYaw).multiply(_qTwist);

  const { center, len } = inspectBounds(mesh);
  const d = inspectDistance(len, 0.72) + dz;
  _vCenter.copy(center).applyQuaternion(_qInspect);
  _vInspect.set(x, y, -d).sub(_vCenter);

  mesh.position.lerp(_vInspect, blend);
  mesh.quaternion.slerp(_qInspect, blend);
  if (inspectArms.visible) poseInspectArms(mesh, Math.sin(yawR));
}

/* Both hands on the gun for the showcase. The block hands built onto every
   gun stay hidden (user call: the gun reads clean day to day, and they sat
   on the skin art); these are real arms instead, a sleeve from a shoulder
   below the screen to a fist on the grip and one under the handguard, so
   whichever side of the gun is showing, the arms come from the player. The
   built hands are still used, invisibly, as the anchors for where the
   fists go. */
/* Shoulders sit below the screen. Which one feeds which fist follows the
   gun: muzzle left, the trigger hand is on the right of the screen and gets
   the right arm; muzzle right, it swaps, so the arms never cross into an X.
   `side` is sin(yaw), so the swap sweeps smoothly through the twist. */
const INSPECT_SHOULDER_X = 0.28;
const _shoulder = new THREE.Vector3();
const INSPECT_SUPPORT_DROP = 0.095;  // under the handguard, not on top of the art
const inspectArms = (() => {
  const root = new THREE.Group();
  root.visible = false;
  // White hands, black sleeves, ink outlines — the trollface look (hand-model.js).
  const { sleeve: sleeveMat, cuff: cuffMat, skin: skinMat, shade: knuckleMat } = handMaterials();
  // Unit cylinders standing on y=0, stretched between two points per frame.
  const unitCyl = (rTop, rBottom, mat) => {
    const g = new THREE.CylinderGeometry(rTop, rBottom, 1, 10);
    g.translate(0, 0.5, 0);
    return new THREE.Mesh(g, mat);
  };
  const box = (w, h, d, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
  };
  const arms = [];
  for (let i = 0; i < 2; i++) {
    const fist = new THREE.Group();
    if (i === 0) {
      // Trigger hand: wraps a near-vertical pistol grip (grip runs along
      // the fist's Y), knuckles forward toward the muzzle (-Z).
      fist.add(box(0.064, 0.078, 0.056, skinMat, 0, -0.004, 0.006));
      for (let k = 0; k < 4; k++) fist.add(box(0.068, 0.017, 0.02, knuckleMat, 0, 0.026 - k * 0.02, -0.026));
      fist.add(box(0.02, 0.05, 0.03, skinMat, 0.03, 0.03, -0.012));   // thumb over the top
    } else {
      // Support hand: cups the handguard from underneath, fingers curling
      // up both sides so a finger row shows whichever side faces camera.
      fist.add(box(0.062, 0.03, 0.1, skinMat, 0, -0.012, 0));
      for (const sx of [-1, 1]) {
        for (let k = 0; k < 4; k++) fist.add(box(0.012, 0.034, 0.02, knuckleMat, sx * 0.035, 0.012, -0.036 + k * 0.024));
      }
    }
    const wrist = unitCyl(0.022, 0.026, skinMat);
    const cuff = unitCyl(0.037, 0.035, cuffMat);
    const sleeve = unitCyl(0.044, 0.032, sleeveMat);
    inkOutline(fist);
    inkOutline(cuff);
    root.add(fist, wrist, cuff, sleeve);
    arms.push({ fist, wrist, cuff, sleeve });
  }
  root.userData.arms = arms;
  return root;
})();
weaponRig.add(inspectArms);

const _armFrom = new THREE.Vector3();
const _armTo = new THREE.Vector3();
const _armDir = new THREE.Vector3();
const _armUp = new THREE.Vector3(0, 1, 0);
/* Your wristwear (a Rolex, wristwear.js) in your own view: round the left
   rod a little way back from its tip, face up. Placed just before the view
   model draws, after every arm pose this frame, so it never trails the rod. */
const ROD_WATCH_BACK = 0.07;       // from the rod's tip
let rodWatch = null;
const _rwZ = new THREE.Vector3(), _rwY = new THREE.Vector3(), _rwX = new THREE.Vector3(), _rwM = new THREE.Matrix4();
function placeRodWatch() {
  const id = wristOf(cosmetics.face);
  if ((rodWatch?.userData.wristId || "") !== id) {
    rodWatch?.parent?.remove(rodWatch);
    rodWatch = id ? buildWatch(id, 0.0165, { envMap: weaponEnvTex }) : null;
    rodWatch?.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  }
  if (!rodWatch) return;
  // The left rod in view: an emote's or a streak device's, else the gun's.
  const sRod = streakArms.visible ? streakArms.userData.arms[1].rod : null;
  const gRod = pfArms.visible ? pfArms.userData.rods[1] : null;
  const rod = sRod?.visible ? sRod : gRod?.visible ? gRod : null;
  rodWatch.visible = !!rod;
  if (!rod) return;
  if (rodWatch.parent !== rod.parent) rod.parent.add(rodWatch);
  // A rod stands on its shoulder end along its +Y, scale.y long (stretchBetween).
  _rwZ.set(0, 1, 0).applyQuaternion(rod.quaternion);
  rodWatch.position.copy(rod.position).addScaledVector(_rwZ, Math.max(0, rod.scale.y - ROD_WATCH_BACK));
  // The band round the rod (the watch's Z back along it), the face up.
  _rwZ.negate();
  _rwY.set(0, 1, 0).addScaledVector(_rwZ, -_rwZ.y);
  if (_rwY.lengthSq() < 1e-6) _rwY.set(0, 0, 1);
  _rwY.normalize();
  _rwX.crossVectors(_rwY, _rwZ);
  rodWatch.quaternion.setFromRotationMatrix(_rwM.makeBasis(_rwX, _rwY, _rwZ));
}

function stretchBetween(obj, from, to) {
  _armDir.subVectors(to, from);
  const len = _armDir.length();
  obj.position.copy(from);
  obj.quaternion.setFromUnitVectors(_armUp, _armDir.multiplyScalar(1 / Math.max(1e-5, len)));
  obj.scale.set(1, len, 1);
}

function poseInspectArms(mesh, side) {
  mesh.updateMatrixWorld(true);
  const anchors = mesh.children.filter((o) => o.userData.hand);
  const arms = inspectArms.userData.arms;
  for (let i = 0; i < arms.length; i++) {
    const arm = arms[i];
    const anchor = anchors[i];
    arm.fist.visible = arm.wrist.visible = arm.cuff.visible = arm.sleeve.visible = !!anchor;
    if (!anchor) continue;
    anchor.getWorldPosition(arm.fist.position);
    anchor.getWorldQuaternion(arm.fist.quaternion);
    if (i === 1) {
      // Down from the rail-top anchor to underneath, in the gun's own up.
      _armDir.set(0, -INSPECT_SUPPORT_DROP, 0).applyQuaternion(mesh.quaternion);
      arm.fist.position.add(_armDir);
    }
    const shoulder = _shoulder.set((i === 0 ? 1 : -1) * INSPECT_SHOULDER_X * side, -0.51, 0.11);
    // fist -> wrist -> cuff -> sleeve, all along the line to the shoulder.
    _armDir.subVectors(shoulder, arm.fist.position).normalize();
    _armFrom.copy(arm.fist.position).addScaledVector(_armDir, 0.03);
    _armTo.copy(arm.fist.position).addScaledVector(_armDir, 0.075);
    stretchBetween(arm.wrist, _armFrom, _armTo);
    _armFrom.copy(_armTo);
    _armTo.copy(arm.fist.position).addScaledVector(_armDir, 0.1);
    stretchBetween(arm.cuff, _armFrom, _armTo);
    stretchBetween(arm.sleeve, _armTo, shoulder);
  }
}

/* Phantom Forces arms (user's PF reference clip, 2026-09-27): no hands at
   all, just two thin black rods rising from below the screen, and the tip
   of each rod IS the hand. The right rod ends on the pistol grip, the left
   under the handguard (or on the magazine while reloading). Unlit black, so
   they read as silhouettes and never sit on the skin art the way the block
   hands did. The built hand meshes stay hidden; they're only the anchors. */
// Out and back toward the real shoulders, so each rod runs in from a
// bottom corner of the screen and a good length of arm shows (user: "make
// the rod arms longer").
const PF_ARM_SHOULDER = [new THREE.Vector3(0.44, -0.74, 0.16), new THREE.Vector3(-0.32, -0.78, 0.12)];
const PF_SUPPORT_DROP = 0.085;   // from the rail-top support anchor to under the handguard
const pfArms = (() => {
  const root = new THREE.Group();
  root.visible = false;
  const mat = new THREE.MeshBasicMaterial({ color: 0x050505 });
  const rods = [];
  for (let i = 0; i < 2; i++) {
    // A unit rod standing on y=0: blunt taper to the tip (the "hand"),
    // thicker toward the shoulder, stretched between two points per frame.
    const g = new THREE.CylinderGeometry(0.013, 0.034, 1, 10);
    g.translate(0, 0.5, 0);
    const rod = new THREE.Mesh(g, mat);
    rod.renderOrder = -1;
    root.add(rod);
    rods.push(rod);
  }
  root.userData.rods = rods;
  return root;
})();
weaponRig.add(pfArms);

/* A forward grip on the gun (an underbarrel vert or angled grip, tagged
   userData.foregrip in attachment-models.js): the left hand fists it.
   Cached per built mesh. */
function foregripOf(mesh) {
  if (mesh.userData._foregrip === undefined) {
    let f = null;
    mesh.traverse((o) => { if (!f && o.userData.foregrip) f = { obj: o, point: o.userData.foregrip }; });
    mesh.userData._foregrip = f;
  }
  return mesh.userData._foregrip;
}

/* Trollsaber: held like a saber, the rods to two spots on the hilt, the
   right up by the clamp, the left down by the pommel. */
let saberArmsOn = false;
let saberArmsWere = false;
const SABER_HAND_Z = [0.045, 0.104];                 // along the hilt (gear.js grip at 0)
const _saP = new THREE.Vector3();
function poseSaberArms(mesh) {
  pfArms.visible = true;
  mesh.updateMatrixWorld(true);
  const rods = pfArms.userData.rods;
  for (let i = 0; i < 2; i++) {
    _saP.set(0, 0, SABER_HAND_Z[i]);
    mesh.localToWorld(_saP);
    rods[i].visible = true;
    stretchBetween(rods[i], PF_ARM_SHOULDER[i], _saP);
  }
}

/* The other melee weapons (Keyboard Warrior, Chainsaw, Reaper's Grin): their
   built block hands stay as invisible grip points (they still get tossed
   and caught by the keyboard's inspect, so the arms follow), and the rods
   reach them. A one-handed weapon's other arm stays down. */
function poseMeleeArms(mesh) {
  pfArms.visible = true;
  mesh.updateMatrixWorld(true);
  const hands = meleeHands(mesh);
  const rods = pfArms.userData.rods;
  for (let i = 0; i < 2; i++) {
    const h = hands[i]?.obj;
    rods[i].visible = !!h;
    if (!h) continue;
    h.visible = false;
    h.updateMatrixWorld(true);
    h.getWorldPosition(_saP);
    stretchBetween(rods[i], PF_ARM_SHOULDER[i], _saP);
  }
}

/* The Peacemakers: a gun in each hand, so each arm comes up from its own
   shoulder to its own grip. The anchors belong to the hands, not the guns,
   so a twirl spins the gun and not the arm. */
const AKIMBO_SHOULDER = [new THREE.Vector3(0.34, -0.66, 0.04), new THREE.Vector3(-0.34, -0.66, 0.04)];
function poseAkimboArms(mesh) {
  const rods = pfArms.userData.rods;
  const hands = mesh.userData.akimboHands;
  for (let i = 0; i < 2; i++) {
    hands[i].getWorldPosition(_pfTip);
    rods[i].visible = true;
    stretchBetween(rods[i], AKIMBO_SHOULDER[i], _pfTip);
  }
}

const _pfTip = new THREE.Vector3();
const _pfMag = new THREE.Vector3();
const _pfDown = new THREE.Vector3();
/* `magBlend` 0..1 moves the support rod's tip from the handguard onto the
   magazine (reloads). */
function posePfArms(mesh, magBlend = 0) {
  if (saberArmsOn) return;   // the Trollsaber has the arms (poseSaberArms)
  const show = !!mesh?.visible && !inspectArms.visible && player.holding === "gun";
  pfArms.visible = show;
  if (!show) return;
  mesh.updateMatrixWorld(true);
  if (mesh.userData.akimbo) { poseAkimboArms(mesh); return; }
  // [grip, support]: the support hand is the one parked at supportHandPos
  // (build order differs between weapon-model.js and weapon-416.js).
  let anchors = mesh.userData.pfAnchors;
  if (!anchors) {
    const hands = mesh.children.filter((o) => o.userData.hand);
    const sp = mesh.userData.supportHandPos;
    const support = sp ? hands.find((o) => o.position.distanceTo(sp) < 1e-4) : null;
    const grip = hands.find((o) => o !== support);
    anchors = mesh.userData.pfAnchors = [grip, support].filter(Boolean).length ? [grip || support, support] : [];
  }
  const rods = pfArms.userData.rods;
  for (let i = 0; i < 2; i++) {
    // Sidearms carry no support hand: the left rod cups the grip too.
    const anchor = anchors[i] || anchors[0];
    rods[i].visible = !!anchor;
    if (!anchor) continue;
    anchor.getWorldPosition(_pfTip);
    _pfDown.set(0, -1, 0).applyQuaternion(mesh.quaternion);
    if (i === 1) {
      const fg = anchors[1] ? foregripOf(mesh) : null;
      if (fg) fg.obj.localToWorld(_pfTip.copy(fg.point));
      else _pfTip.addScaledVector(_pfDown, anchors[1] ? (mesh.userData.pfSupportDrop ?? PF_SUPPORT_DROP) : 0.03);
      const mag = mesh.userData.shellMesh?.visible ? mesh.userData.shellMesh : mesh.userData.magMesh;
      if (magBlend > 0 && mag?.visible) {
        mag.getWorldPosition(_pfMag).addScaledVector(_pfDown, 0.05);
        _pfTip.lerp(_pfMag, magBlend);
      }
    }
    stretchBetween(rods[i], PF_ARM_SHOULDER[i], _pfTip);
  }
}

/* Keyboard Warrior toss. Beats (t):
     0.00-0.10  wind-up dip
     0.10-0.34  toss: leaves the hands with one end-over-end flip, rising
                a touch past the hover point
     0.34-0.70  float: hangs in front of the camera keys-out, esc end on
                the left like a real keyboard, slow sway and bob
     0.70-0.86  drop: a barrel roll on the way down into the hands
     0.86-1.00  catch: weight lands, a dip that settles
   The hands stay behind: they're lifted off the sword into the rig while
   it's airborne, sink out of view, and come back up for the catch. */
const MELEE_T_TOSS = 0.10, MELEE_T_FLOAT = 0.34, MELEE_T_DROP = 0.70, MELEE_T_CATCH = 0.86;
// Keys face local +Y, blade runs down local -Z, the F-row is the -X edge.
// Presented: blade to the right, keys at the camera, F-row on top.
const MELEE_FLOAT_QUAT = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0)));
const _qRest = new THREE.Quaternion();
const _vRest = new THREE.Vector3();
const _vRestCenter = new THREE.Vector3();
const _vFloatCenter = new THREE.Vector3();
const _qFloat = new THREE.Quaternion();
const _qSpin = new THREE.Quaternion();
const _qWobble = new THREE.Quaternion();

function meleeHands(mesh) {
  if (!mesh.userData.inspectHandList) {
    mesh.userData.inspectHandList = mesh.children.filter((o) => o.userData.hand).map((o) => ({
      obj: o, pos: o.position.clone(), quat: o.quaternion.clone(), rigPos: new THREE.Vector3(),
    }));
  }
  return mesh.userData.inspectHandList;
}

/* Put tossed-off hands back on the sword exactly where they were built. */
function restoreMeleeHands(mesh) {
  if (!mesh?.userData.handsTossed) return;
  for (const h of meleeHands(mesh)) {
    mesh.add(h.obj);
    h.obj.position.copy(h.pos);
    h.obj.quaternion.copy(h.quat);
  }
  mesh.userData.handsTossed = false;
}

/* The Reaper's Grin, admired: the blade folds shut, you bring it up, flick
   it open with a snap, roll it twice round the wrist with a little toss,
   and turn it to show the engraving before it settles back.
     0.00-0.10 fold shut    0.10-0.22 raise    0.22-0.32 flick open
     0.34-0.70 two rolls    0.70-0.88 show     0.88-1.00 back to rest */
let reaperClick = false;
const _meleeViewQ = new THREE.Quaternion();
const _meleeViewE = new THREE.Euler();
function applyReaperInspect(mesh) {
  const setFold = mesh.userData.setFold;
  if (inspectT <= 0) { setFold?.(0); reaperClick = false; return; }
  const t = inspectProgress();
  const sm = (a, b) => smoothstep(Math.max(0, Math.min(1, (t - a) / (b - a))));
  let fold = 0;
  if (t < 0.1) fold = sm(0, 0.1);
  else if (t < 0.22) fold = 1;
  else if (t < 0.32) {
    const u = (t - 0.22) / 0.1, c = 2.2;   // back-out: snaps past open, settles
    fold = 1 - (1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2));
    if (!reaperClick) { reaperClick = true; audio.reload(); }
  }
  if (t < 0.2) reaperClick = false;
  setFold?.(fold);
  const raise = sm(0.1, 0.22) * (1 - sm(0.88, 1));
  const snap = t > 0.22 && t < 0.34 ? Math.sin(((t - 0.22) / 0.12) * Math.PI) : 0;
  const trick = Math.max(0, Math.min(1, (t - 0.34) / 0.36));
  const roll = Math.PI * 4 * (trick < 0.5 ? 2 * trick * trick : 1 - Math.pow(-2 * trick + 2, 2) / 2);
  const toss = Math.sin(trick * Math.PI) * 0.045;
  const show = sm(0.7, 0.8) * (1 - sm(0.86, 0.94));
  mesh.position.x -= 0.24 * raise;
  mesh.position.y += 0.1 * raise + toss;
  mesh.position.z += 0.04 * raise;
  _qSpin.setFromAxisAngle(AXIS_X, -0.35 * raise - 0.25 * snap);
  mesh.quaternion.multiply(_qSpin);
  _qSpin.setFromAxisAngle(AXIS_Y, 0.55 * raise + 0.5 * show);
  mesh.quaternion.multiply(_qSpin);
  _qSpin.setFromAxisAngle(AXIS_Z, roll);
  mesh.quaternion.multiply(_qSpin);
}

function applyMeleeInspect(mesh) {
  const t = inspectProgress();
  const airborne = inspectT > 0 && t >= MELEE_T_TOSS + 0.02 && t < MELEE_T_CATCH;
  if (!airborne) restoreMeleeHands(mesh);
  if (inspectT <= 0) return;

  // The rest pose this frame (idle pose + walk bob), and its middle.
  _vRest.copy(mesh.position);
  _qRest.copy(mesh.quaternion);
  const { center, len } = inspectBounds(mesh);
  _vRestCenter.copy(center).applyQuaternion(_qRest).add(_vRest);

  const d = inspectDistance(len, 0.66);
  const floatT = Math.max(0, t - MELEE_T_FLOAT) * inspectDur;
  _qWobble.setFromEuler(new THREE.Euler(
    Math.sin(floatT * 1.9) * 0.07 - 0.12,     // lean the keys up toward the light a touch
    Math.sin(floatT * 1.3) * 0.26,
    Math.sin(floatT * 1.7 + 0.8) * 0.05));
  _qFloat.copy(_qWobble).multiply(MELEE_FLOAT_QUAT);
  _vFloatCenter.set(0, 0.015 + Math.sin(floatT * 2.2) * 0.012, -d);

  if (t < MELEE_T_TOSS) {
    // Wind-up: dip and cock back before the throw.
    const k = Math.sin((t / MELEE_T_TOSS) * Math.PI * 0.5);
    mesh.position.y -= 0.045 * k;
    mesh.position.z += 0.03 * k;
    _qSpin.setFromAxisAngle(AXIS_X, 0.25 * k);
    mesh.quaternion.multiply(_qSpin);
  } else if (t < MELEE_T_FLOAT) {
    const s = (t - MELEE_T_TOSS) / (MELEE_T_FLOAT - MELEE_T_TOSS);
    const e = 1 - Math.pow(1 - s, 3);   // thrown: fast off the hands, slowing at the top
    _qInspect.copy(_qRest).slerp(_qFloat, smoothstep(s));
    _qSpin.setFromAxisAngle(AXIS_X, -Math.PI * 2 * (1 - e));
    _qInspect.multiply(_qSpin);
    _vInspect.copy(_vRestCenter).lerp(_vFloatCenter, e);
    _vInspect.y += Math.sin(s * Math.PI) * 0.09;   // rises past the hover point, settles back
    placeByCenter(mesh, _qInspect, _vInspect, center);
  } else if (t < MELEE_T_DROP) {
    placeByCenter(mesh, _qFloat, _vFloatCenter, center);
  } else if (t < MELEE_T_CATCH) {
    const s = (t - MELEE_T_DROP) / (MELEE_T_CATCH - MELEE_T_DROP);
    const e = s * s * (1.6 - 0.6 * s);   // falls: slow off the hover, fast into the hands
    _qInspect.copy(_qFloat).slerp(_qRest, smoothstep(s));
    _qSpin.setFromAxisAngle(AXIS_Z, Math.PI * 2 * e);
    _qInspect.multiply(_qSpin);
    _vInspect.copy(_vFloatCenter).lerp(_vRestCenter, e);
    placeByCenter(mesh, _qInspect, _vInspect, center);
  } else {
    // Catch: the weight lands in the hands and settles.
    const s = (t - MELEE_T_CATCH) / (1 - MELEE_T_CATCH);
    const hit = Math.sin(Math.min(1, s * 2.2) * Math.PI) * (1 - s * 0.6);
    mesh.position.y -= 0.05 * hit;
    mesh.position.z += 0.02 * hit;
    _qSpin.setFromAxisAngle(AXIS_X, -0.18 * hit);
    mesh.quaternion.multiply(_qSpin);
  }

  if (airborne) {
    const hands = meleeHands(mesh);
    if (!mesh.userData.handsTossed) {
      // Leave the hands where they were at the throw, in rig space.
      for (const h of hands) {
        mesh.add(h.obj);
        h.obj.position.copy(h.pos);
        h.obj.quaternion.copy(h.quat);
        h.obj.position.applyQuaternion(_qRest).add(_vRest);
        h.obj.quaternion.premultiply(_qRest);
        h.rigPos.copy(h.obj.position);
        weaponRig.add(h.obj);
      }
      mesh.userData.handsTossed = true;
    }
    // Sink out of view while it's up, rise back for the catch.
    const down = rise(t, MELEE_T_TOSS, MELEE_T_FLOAT) * (1 - rise(t, MELEE_T_DROP - 0.04, MELEE_T_CATCH));
    for (const h of hands) {
      h.obj.visible = mesh.visible;
      h.obj.position.copy(h.rigPos);
      h.obj.position.y -= 0.24 * down;
      h.obj.position.z += 0.05 * down;
    }
  }
}

function placeByCenter(mesh, quat, centerPos, localCenter) {
  mesh.quaternion.copy(quat);
  _vCenter.copy(localCenter).applyQuaternion(quat);
  mesh.position.copy(centerPos).sub(_vCenter);
}

/* Reload animation (DESIGN-ARMS.md Phase 3): the weapon dips down and tilts
   away from view for the middle stretch of the reload, staged into named
   phases keyed off normalized progress `t` (0..1) rather than one flat dip
   — timed off the same w.reloading/reloadT/reloadTime the ammo swap already
   uses (reloadTime is the per-instance duration set by startReload(), which
   already differs between an empty reload and a faster tac reload), so
   staging can never fall out of sync with when ammo actually lands.

   Phase boundaries (fractions of `t`):
     0.00-0.12  raise    - weapon dips into reload pose
     0.12-0.42  magOut   - mag mesh drops out of the well (skipped entirely
                            on a tac reload's shorter timeline below)
     0.42-0.72  magIn    - fresh mag rises back into the well
     0.72-1.00  settle   - weapon returns to combat pose
   A tac reload (round already chambered) compresses this to raise/magIn/
   settle only — no empty mag to visibly drop, matching startReload()'s
   `reloadWasEmpty` branch. */
const _reloadPose = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 };
let reloadEventsFiredFor = null; // WeaponState instance we've already fired start/complete events for

const MAG_HOLD_SCREEN = new THREE.Vector3(-0.05, -0.17, -0.62);
const MAG_DROP_SCREEN = new THREE.Vector3(-0.06, -0.7, -0.45);
const MAG_HOLD_QUAT = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35, 0.5, -0.3));
const _magRestQ = new THREE.Quaternion();
const _magRestE = new THREE.Euler();
const _magHoldQ = new THREE.Quaternion();
const _magHold = new THREE.Vector3();
const _magDrop = new THREE.Vector3();
function reloadPose(w, mesh) {
  const p = _reloadPose;
  const mag = mesh?.userData.magMesh;

  if (!w.reloading || !w.reloadTime) {
    p.x = p.y = p.z = p.pitch = p.yaw = p.roll = p.magHold = 0;
    // magT too: `p` is shared, and a reload cut short by death left the
    // last mid-reload value here, so placeReloadMag kept every gun after it
    // (the respawned one included) holding its mag out in the air.
    p.shellT = p.rack = p.magT = p.akimboT = p.portShell = -1;
    p.pumpBack = null;
    if (mag) {
      mag.visible = true;
      mag.position.copy(mesh.userData.magazinePoint);
      mag.rotation.x = mesh.userData.magRestRotationX ?? mag.userData.restRotX ?? mag.rotation.x;
    }
    if (reloadEventsFiredFor === w) {
      audio.reloadComplete();
      reloadEventsFiredFor = null;
    }
    return p;
  }

  if (w.def.hellfire && w.def.shellReload) return soulBlazerReloadPose(w, p);
  if (w.def.shellReload) return shellReloadPose(w, mesh, p);
  if (w.def.akimbo) {
    // akimbo-view.js moves the two guns themselves (and plays the
    // cylinder, brass and speedloader sounds); the pair's root stays put.
    reloadEventsFiredFor = w;
    p.x = p.y = p.z = p.pitch = p.yaw = p.roll = p.magHold = 0;
    p.shellT = p.rack = p.magT = -1;
    p.akimboT = 1 - Math.max(0, w.reloadT) / w.reloadTime;
    return p;
  }

  if (reloadEventsFiredFor !== w) {
    if (w.def.candleShot) audio.tankSwap(w.reloadTime); else audio.reload();
    reloadEventsFiredFor = w;
  }

  const total = w.reloadTime;
  const t = 1 - Math.max(0, w.reloadT) / total;  // 0..1 through the reload

  // Phantom Forces reload (user's reference clip): the gun rolls well over
  // (~40°, magwell toward you, muzzle up), the left arm pulls the mag out
  // and down off screen, brings a fresh one up on the same arc, seats it,
  // and the gun rolls back. The envelope eases in over the first 14% and
  // out over the last 26%.
  const dip = Math.sin(Math.min(1, t / 0.14) * Math.PI / 2)
    * Math.sin(Math.min(1, (1 - t) / 0.26) * Math.PI / 2);
  // Sidearms tip over less, or the pistol rolls half off the screen.
  const rollK = mesh?.userData.supportHandPos ? 1 : 0.55;
  p.x = -dip * 0.05;
  p.y = -dip * 0.1 * rollK;
  p.z = dip * 0.04;
  p.pitch = dip * 0.32;
  p.yaw = -dip * 0.12;
  p.roll = dip * 0.72 * rollK;

  // Stages: reach 0.08-0.18, pull out 0.18-0.34 to the hold point, down
  // off screen for the swap 0.34-0.44, back up 0.46-0.56, seat 0.56-0.70,
  // arm back to the handguard 0.72-0.84. A tac reload runs the same beats
  // (PF swaps the mag either way); its shorter reloadTime makes it quicker.
  // The mag itself is placed by placeReloadMag once the gun is posed.
  p.magT = mag && mesh ? t : -1;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  p.magHold = p.magT < 0 ? 0 : smoothstep(clamp01((t - 0.08) / 0.1)) * (1 - smoothstep(clamp01((t - 0.72) / 0.12)));
  return p;
}

/* Shell-by-shell reload (the Grinmington, BO2's 870): the gun rolls over
   to show the loading port under the receiver and tips its muzzle up; each
   shell rides up on the support arm and is thumbed in (a small forward
   shove as it seats). An empty gun ends on a rack of the pump. Driven by
   WeaponState's shell stages, so the pose can't drift from the ammo count. */
function shellReloadPose(w, mesh, p) {
  const sr = w.def.shellReload;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const k = 1 - Math.max(0, w.shellT) / Math.max(0.001, w.shellDur);   // 0..1 through the stage
  let env = 1;
  if (w.shellStage === "start") env = smoothstep(k);
  else if (w.shellStage === "end") env = smoothstep(clamp01(Math.max(0, w.shellT) / sr.end));
  let shove = 0;
  p.shellT = -1;
  if (w.shellStage === "shell") {
    p.shellT = k;
    // Thumbed home over the last third of each shell.
    shove = Math.sin(clamp01((k - 0.62) / 0.38) * Math.PI);
  }
  p.x = -env * 0.03;
  p.y = -env * 0.05 + shove * 0.006;
  p.z = env * 0.02 - shove * 0.018;
  p.pitch = env * 0.2;
  p.yaw = -env * 0.06;
  p.roll = env * 0.62;      // port side (underneath) turned toward you
  p.magT = -1;
  // The support arm leaves the forend for each shell.
  p.magHold = p.shellT < 0 ? 0 : Math.sin(clamp01(p.shellT / 0.85) * Math.PI) * 0.9;
  // The rack: first sr.rack seconds of an empty gun's "end" stage.
  p.rack = -1;
  if (w.shellStage === "end" && w.shellDur > sr.end + 1e-4 && w.shellT > sr.end) {
    p.rack = 1 - (w.shellT - sr.end) / sr.rack;
  }
  return p;
}

/* The pump forend: back and forward after each shot (pumpT) and on the
   empty-reload rack. 0..1 progress -> how far back (0 = home). */
const PUMP_TRAVEL = 0.085;
function placePump(mesh, w, rackT, backOverride = null) {
  const pump = mesh?.userData.pumpMesh;
  if (!pump) return;
  // The Soul Blazer's port load holds the pump open, then slams it home.
  if (backOverride != null) { pump.position.z = mesh.userData.pumpRestZ + backOverride * PUMP_TRAVEL; return; }
  let t = -1;
  if (rackT >= 0) t = rackT;
  else if (w.pumpT > 0 && w.pumpDur > 0 && w.def.fireMode === "pump") t = 1 - w.pumpT / w.pumpDur;
  // A beat after the shot, a hard pull back, a hold, then home.
  const back = t < 0 ? 0 : t < 0.18 ? 0 : t < 0.45 ? smoothstep((t - 0.18) / 0.27)
    : t < 0.55 ? 1 : t < 0.85 ? 1 - smoothstep((t - 0.55) / 0.3) : 0;
  pump.position.z = mesh.userData.pumpRestZ + back * PUMP_TRAVEL;
}

/* The shell in the support hand: from low left (off the bandolier) up to
   the loading port, then gone into the tube. */
const SHELL_HOLD_SCREEN = new THREE.Vector3(-0.07, -0.2, -0.5);
const _shellHold = new THREE.Vector3();
function placeReloadShell(mesh, t, portT = -1) {
  const shell = mesh?.userData.shellMesh;
  if (!shell) return;
  // The Soul Blazer's port load: dropped in from above the open port.
  if (portT >= 0 && mesh.userData.ejectPort) {
    const k = smoothstep(Math.min(1, portT));
    shell.position.copy(mesh.userData.ejectPort).add(_shellHold.set(0.004 + 0.1 * (1 - k), 0.03 * (1 - k), 0.006 * (1 - k)));
    shell.rotation.set(0, 0, Math.PI / 2 * (1 - k));
    shell.visible = portT < 0.97;
    return;
  }
  shell.rotation.set(0, 0, 0);
  if (t < 0 || t > 0.9) { shell.visible = false; return; }
  mesh.updateMatrixWorld(true);
  const port = mesh.userData.loadPort;
  const hold = mesh.worldToLocal(_shellHold.copy(SHELL_HOLD_SCREEN));
  const up = smoothstep(Math.min(1, t / 0.55));
  shell.position.lerpVectors(hold, port, up);
  // Pushed forward into the tube for the last stretch.
  if (t > 0.62) shell.position.z -= smoothstep((t - 0.62) / 0.28) * 0.05;
  shell.visible = true;
}

/* Sounds that ride WeaponState's own timeline (shell in, pump, rack). */
function drainWeaponEvents(w) {
  if (!w.events?.length) return;
  for (const e of w.events) {
    if (e === "shell") { audio.shellIn(); if (w.def.hellfire) sbFed(activeWeaponMesh); }
    else if (e === "pump") { audio.pump(w.pumpDur); if (w.def.hellfire) soulBlazerKick(activeWeaponMesh, 0.8); }
    else if (e === "rack") audio.pump(w.def.shellReload.rack);
    // "portload" (the Soul Blazer's port shell going home) is played at the
    // pump slam instead, by updateSoulBlazerHand.
  }
  w.events.length = 0;
}

/* ---- the Soul Blazer in hand (soul-blazer.js does the gun itself) ---- */

const _sbEye = new THREE.Vector3();
let sbCueT = -1;
let sbWaveZ = null;

/* A shell thumbed into the tube: its skull's eyes light (the counter does
   that), an ember puff from the port, a gulp, the charms jump. */
function sbFed(mesh) {
  if (!mesh?.userData.sb) return;
  audio.soulGulp();
  soulBlazerKick(mesh, 0.6);
  _sbEye.copy(mesh.userData.loadPort).applyMatrix4(mesh.matrixWorld);
  for (let i = 0; i < 6; i++) {
    _sbDir.set((Math.random() - 0.5) * 0.6, -0.2 - Math.random() * 0.4, (Math.random() - 0.5) * 0.6);
    hellfireView.ember(_sbEye, _sbDir, { size: 0.02, life: 0.4 });
  }
}

/* The pump slammed home on an empty gun: it relights with a roar. */
function sbRelight(mesh) {
  soulBlazerIgnite(mesh);
  audio.soulRoar();
  soulBlazerMouth(mesh, _sbPos, _sbDir);
  hellfireView.roar(_sbPos, _sbDir);
  kickFireShake(currentWeapon().def, 0.35);
}

function sbEyesWorld(mesh, fn) {
  const sb = mesh.userData.sb;
  mesh.updateMatrixWorld(true);
  for (let i = 0; i < Math.min(2, sb.halos.length); i++) {
    if (sb.halos[i] === sb.mouthHalo) continue;
    fn(_sbEye.copy(sb.halos[i].position).applyMatrix4(mesh.matrixWorld));
  }
}

function sbInspectCue(mesh, cue, dead) {
  switch (cue) {
    case "pentagram": audio.soulTick(0.5, !dead); break;
    case "eyes": if (!dead) audio.soulTick(1, true); break;
    case "growl": if (dead) audio.dryRasp(); else audio.soulGrowl(); break;
    case "tongue":
      soulBlazerMouth(mesh, _sbPos, _sbDir);
      if (dead) hellfireView.wisp(_sbPos, 2);
      else { hellfireView.tongue(_sbPos, _sbDir); audio.fireWhoosh(0.35); }
      break;
    case "clack": audio.jawClack(); break;
    case "smoke": sbEyesWorld(mesh, (p) => hellfireView.wisp(p, 1)); break;
    case "roll": audio.chainJingle(1); break;
    case "rattle": audio.chainJingle(0.75); soulBlazerKick(mesh, 0.9); break;
    default:
  }
}

/* Per frame for the gun in hand: what only the shooter knows (ammo, the
   real-world view for the charms), the relight at the pump slam, and the
   admire's ember wave, jaw and cues. */
function updateSoulBlazerHand(mesh, w) {
  const sb = mesh.userData.sb;
  weaponCamera.updateMatrixWorld();
  _sbView.multiplyMatrices(camera.matrixWorld, weaponCamera.matrixWorldInverse);
  if (w.shellStage === "port" && w.reloading) {
    const k = 1 - Math.max(0, w.shellT) / Math.max(0.001, w.shellDur);
    if (k >= 0.62 && !w.sbRelit) { w.sbRelit = true; sbRelight(mesh); }
  } else w.sbRelit = false;
  updateSoulBlazerView(mesh, w, _sbView);
  if (w.sbRelit) sb.ammo = Math.max(sb.ammo, 1);   // relit before the shell is counted

  const t = inspectT > 0 && player.holding === "gun" ? inspectProgress() : -1;
  const dead = w.ammoInMag <= 0;
  soulBlazerInspect(mesh, t, dead);
  if (t >= 0) {
    for (const [ct, cue] of SB_INSPECT_CUES) if (sbCueT < ct && t >= ct) sbInspectCue(mesh, cue, dead);
    // a soft tick as the ember wave lights each flank skull
    if (sb.waveAt != null && sbWaveZ != null) {
      for (const z of sb.slotZ || []) if ((sbWaveZ - z) * (sb.waveAt - z) < 0) audio.soulTick(0.3, true);
    }
    sbWaveZ = sb.waveAt;
    sbCueT = t;
  } else {
    sbCueT = -1;
    sbWaveZ = null;
  }
}

/* Green Candles, per frame: the gauge shows what's in the tank; the candle
   breathes, dims as the tank runs down, flickers when it's nearly dry,
   brightens with the charge and flares on every shot while a pulse of
   light runs down the hose into the body. On a reload the old tank keeps
   its reading until it's off (magT 0.46), the candle goes out with the
   hose disconnected, the fresh tank fills bottom to top as it seats, and
   the candle catches again. Also drives the charge ring. */
function updateGreenCandles(mesh, w, magT, dt) {
  const gc = mesh.userData.gc;
  const charging = !!gc && w.charging;
  els.charge.hidden = !charging || player.holding !== "gun";
  if (!gc) return;
  const s = mesh.userData.gcState || (mesh.userData.gcState = { shown: w.ammoInMag / w.def.magSize, flare: 0, pulse: -1, amp: 0, t: 0 });
  s.t += dt;
  const size = w.def.magSize;
  let target = w.ammoInMag / size;
  let lit = 1;
  if (w.reloading && magT >= 0) {
    if (magT >= 0.46) target = (Math.min(size, w.ammoInMag + w.ammoReserve) / size) * smoothstep(Math.min(1, Math.max(0, (magT - 0.56) / 0.2)));
    if (magT < 0.3) lit = 1 - 0.88 * smoothstep(magT / 0.3);
    else if (magT < 0.72) lit = 0.12;
    else lit = 0.12 + 0.88 * smoothstep(Math.min(1, (magT - 0.72) / 0.14)) * (0.7 + 0.3 * Math.abs(Math.sin(s.t * 40)));
  }
  s.shown = damp(s.shown, target, 14, dt);
  gc.gaugeFill.scale.z = Math.max(0.001, s.shown);

  const c = w.def.charge;
  const level = w.chargeLevel;
  const full = charging && w.chargeT >= c.time * Math.max(0.2, w.chargeCap);
  if (w.shotFlare) {
    s.flare = 1 + (w.lastShotLevel || 0) * 1.5;
    s.pulse = 0;
    s.amp = 2.5 + (w.lastShotLevel || 0) * 4;
    w.shotFlare = 0;
  }
  s.flare *= Math.exp(-dt * 8);
  if (s.pulse >= 0) {
    s.pulse += dt / 0.2;
    if (s.pulse > 1.3) s.pulse = -1;
  } else if (charging && level > 0.05) {
    // While charging, pulses feed the candle, quicker as it fills.
    s.pulse = 0;
    s.amp = 1.2 + level * 2;
  }
  const low = w.ammoInMag / size < 0.2 ? 0.28 * Math.max(0, Math.sin(s.t * 9) * Math.sin(s.t * 2.3 + 1)) : 0;
  const flicker = 1 + 0.05 * Math.sin(s.t * 21) + 0.035 * Math.sin(s.t * 33.7) - low;
  const fuel = 0.4 + 0.6 * s.shown;
  const g = gc.glow;
  const set = (m, k) => { if (m) m.emissiveIntensity = m.userData.baseEmissive * k; };
  set(g.GC_CandleCore, lit * fuel * flicker * (1 + 0.55 * level) + s.flare * 1.2);
  set(g.GC_CandleShell, lit * (0.5 + 0.5 * fuel) * flicker * (1 + 0.9 * level) + s.flare * 0.8);
  set(g.GC_Wick, lit * flicker * (1 + 1.2 * level) + s.flare * 1.2);
  set(g.GC_HoseGlow, (0.35 + 0.65 * lit) * (1 + 0.7 * level));
  set(g.GC_Gauge, 0.75 + 0.25 * flicker + (full ? 0.5 * Math.abs(Math.sin(s.t * 14)) : 0));
  set(g.GC_Led, full ? (Math.sin(s.t * 18) > 0 ? 1.6 : 0.3) : lit);
  const [haloCandle, haloWick] = gc.halos;
  const hk = lit * (0.7 + 0.3 * fuel) * flicker;
  haloCandle.material.opacity = haloCandle.userData.base.opacity * (hk * (1 + 1.1 * level) + s.flare * 1.4);
  haloCandle.scale.setScalar(haloCandle.userData.base.size * (0.9 + 0.35 * level + 0.35 * s.flare));
  haloWick.material.opacity = Math.min(1, haloWick.userData.base.opacity * (hk * (1 + 1.6 * level) + s.flare * 1.2));
  haloWick.scale.setScalar(haloWick.userData.base.size * (0.9 + 0.9 * level + 0.8 * s.flare));
  const pu = g.GC_HoseGlow?.userData.pulse;
  if (pu) {
    pu.uPulse.value = s.pulse;
    pu.uPulseAmp.value = s.pulse >= 0 ? s.amp : 0;
  }
  // A held full charge strains in the hands.
  if (full) {
    mesh.position.x += (Math.random() - 0.5) * 0.0024;
    mesh.position.y += (Math.random() - 0.5) * 0.0024;
  }

  if (charging) {
    els.charge.style.setProperty("--p", level.toFixed(3));
    els.charge.classList.toggle("is-full", full);
    const cells = w.chargeT >= c.minHold ? chargedShotDef(w.def, level).cells : 1;
    els.chargeCells.textContent = w.chargeT >= c.minHold ? `${cells} ${cells === 1 ? "CELL" : "CELLS"}` : "";
  }
}

/* The mag's path is picked in screen (weapon-camera) space and brought into
   the gun's frame, so it has to run after this frame's gun pose: out of the
   well to a hold point low and left of centre where you see it in the hand
   (as in PF), down off screen for the swap, and the same way back. */
function placeReloadMag(mesh, t) {
  const mag = mesh?.userData.magMesh;
  if (!mag || t < 0) return;
  const rest = mesh.userData.magazinePoint;
  if (mag.userData.restRotX == null) mag.userData.restRotX = mag.rotation.x;
  const restRot = mesh.userData.magRestRotationX ?? mag.userData.restRotX;
  const seg = (a, b) => smoothstep(Math.max(0, Math.min(1, (t - a) / (b - a))));
  mesh.updateMatrixWorld(true);
  // Sidearms (no support hand) keep it tight: straight down out of the
  // grip and back, in the gun's own frame.
  const sidearm = !mesh.userData.supportHandPos;
  const hold = sidearm ? _magHold.set(rest.x, rest.y - 0.13, rest.z + 0.02)
    : mesh.worldToLocal(_magHold.copy(MAG_HOLD_SCREEN));
  const drop = sidearm ? _magDrop.set(rest.x, rest.y - 0.5, rest.z + 0.06)
    : mesh.worldToLocal(_magDrop.copy(MAG_DROP_SCREEN));
  if (t < 0.34) mag.position.lerpVectors(rest, hold, seg(0.18, 0.34));
  else if (t < 0.45) mag.position.lerpVectors(hold, drop, seg(0.34, 0.44));
  else if (t < 0.56) mag.position.lerpVectors(drop, hold, seg(0.46, 0.56));
  else mag.position.lerpVectors(hold, rest, seg(0.56, 0.7));
  const away = t < 0.45 ? seg(0.18, 0.34) : 1 - seg(0.56, 0.7);
  // In the hand it hangs upright on screen, tipped toward you, whatever
  // the gun's roll: slerp from its seated rotation to that screen pose.
  _magRestQ.setFromEuler(_magRestE.set(restRot, 0, 0));
  if (sidearm) _magHoldQ.setFromEuler(_magRestE.set(restRot + 0.3, 0, 0));
  else mesh.getWorldQuaternion(_magHoldQ).invert().multiply(MAG_HOLD_QUAT);
  mag.quaternion.copy(_magRestQ).slerp(_magHoldQ, away);
  mag.visible = true;
}

const _laserRay = new THREE.Raycaster();
const _laserOrigin = new THREE.Vector3();
const _laserDir = new THREE.Vector3();
const LASER_ADS_THRESHOLD = 0.4; // beam only reads as "activated" once the sight has actually come up

/* The laser attachment only exists on the gun model if it's equipped
   (weapon-model.js), so absence of the beam node means "no laser" — nothing
   here needs to re-check the loadout. Aiming, not equipping, turns it on:
   the beam is dark until the sight comes up, same as the reflex/ACOG glass. */
function updateLaserBeam(mesh, w) {
  const beam = mesh.userData.laserBeam;
  if (!beam) return;
  if (w.adsT < LASER_ADS_THRESHOLD) { beam.visible = false; return; }

  camera.getWorldPosition(_laserOrigin);
  camera.getWorldDirection(_laserDir);

  let range = raycastWorld(colliders, _laserOrigin, _laserDir, 60);
  if (targetMeshes.length) {
    _laserRay.set(_laserOrigin, _laserDir);
    _laserRay.near = 0;
    _laserRay.far = range;
    const hits = _laserRay.intersectObjects(targetMeshes, true);
    if (hits.length) range = hits[0].distance;
  }

  // Cylinder height runs along the geometry's own Y axis; rotation.x = 90deg
  // (set at build time) is what points that axis down the barrel, so the
  // beam is stretched with scale.y, not scale.z, and re-centered along
  // local Z to keep its near end pinned at the laser unit.
  const origin = mesh.userData.laserOrigin;
  const len = Math.max(0.02, range - (-origin.z));
  beam.scale.y = len;
  beam.position.z = origin.z - len / 2;
  const fade = Math.min(1, (w.adsT - LASER_ADS_THRESHOLD) / (1 - LASER_ADS_THRESHOLD));
  beam.material.opacity = 0.85 * fade;
  beam.visible = true;
}

/* Viewmodel animation layers, composed additively in this fixed order
   (DESIGN-ARMS.md §3.1) — every new term this system gains belongs in one
   of these, not a parallel transform:
     1. base pose      - hip<->ADS lerp (basePos)
     2. movement       - bob (bobX/Y), sway (swayX/Y)
     3. inertia        - swaySmoothX/Y lag, weaponLowerT sprint/slide/busy lower
     4. recoil         - viewKick*
     5. reload/action  - rl (reloadPose)
     6. melee          - handled separately in updateMeleeView; REPLACES the
                         base pose outright during an active swing rather
                         than adding to it
     7. camera reaction - lives outside this function entirely; must stay a
                         smaller, separately-tuned effect, never the same
                         numbers as the viewmodel response above */
/* Optic glass is tinted so the lens reads as glass from the hip, but that
   tint sat between the eye and the target once aimed. Clear it as the gun
   comes up; the reticle draws on its own material and stays lit. */
function fadeOpticGlass(mesh, adsT) {
  let mats = mesh.userData.glassMats;
  if (!mats) {
    mats = [];
    mesh.traverse((o) => { if (o.material?.userData?.isGlass) mats.push(o.material); });
    mesh.userData.glassMats = mats;
  }
  for (const m of mats) m.opacity = m.userData.baseOpacity * (1 - 0.9 * adsT);
}

function updateWeaponView(dt) {
  const w = currentWeapon();
  updateInspect(dt);
  updateMeleeView(dt);
  updateStreakView(dt);
  const mesh = activeWeaponMesh;
  // Streak preempts the gun/melee mesh per DESIGN-ARMS.md §3.3's priority
  // stack — return before any weapon-view math runs so weaponLowerT/insp/rl
  // don't fight the device pose for ownership of activeWeaponMesh (which is
  // simply hidden, not touched, while holding === "streak").
  if (!saberArmsOn) pfArms.visible = false;   // posePfArms below re-shows them on a held gun
  // The streak device has its own arms (streakArms): the gun's rods go.
  if (player.holding === "streak") { pfArms.visible = false; return; }
  if (!mesh) return;

  // Aiming plants the sight: bob and idle sway fall away as the weapon
  // comes up, so walking while aimed no longer swims the whole gun across
  // the screen the way full-amplitude bob did.
  const steady = 1 - w.adsT * 0.85;
  // Settle: eases toward 1 while moving, toward 0 at rest, on top of (not
  // instead of) bobPhase freezing — the freeze already stops the wave from
  // continuing, this stops the amplitude from cutting off abruptly with it.
  bobSettleT = damp(bobSettleT, move.moving ? 1 : 0, move.moving ? 10 : 5, dt);
  const bobX = Math.sin(w.bobPhase) * w.def.bobAmp * 0.5 * steady * bobSettleT;
  const bobY = Math.abs(Math.cos(w.bobPhase)) * w.def.bobAmp * steady * bobSettleT;
  const rawSwayX = Math.sin(clock.elapsedTime * w.def.swaySpeed) * w.def.swayAmp * steady;
  const rawSwayY = Math.cos(clock.elapsedTime * w.def.swaySpeed * 0.8) * w.def.swayAmp * 0.6 * steady;
  // Directional strafe lean: a small extra lag-behind tilt keyed to strafe
  // direction, on top of the symmetric idle sway above, so left/right reads
  // as different rather than mirrored. move.strafeInput is -1 (left)..1
  // (right), already computed every frame by movement.js's own update().
  const strafeLean = (move.strafeInput ?? 0) * 0.012 * steady;
  // A heavier gun (lower `inertia` — the same field move.update() already
  // reads for how sluggish it turns) lags a beat behind its own sway target
  // instead of just swaying a smaller amount. Same idea as a real barrel's
  // momentum: it doesn't matter how little it moves if it moves instantly.
  const swayLag = Math.min(1, dt * (w.def.inertia ?? 8));
  swaySmoothX += (rawSwayX + strafeLean - swaySmoothX) * swayLag;
  swaySmoothY += (rawSwayY - swaySmoothY) * swayLag;
  const swayX = swaySmoothX, swayY = swaySmoothY;

  const adsOffset = w.adsT;
  // Heavier weapons settle into position more slowly (lower lambda = more
  // lag) — same `inertia`/`model.heavy` signals already used for sway lag
  // and the sprint roll above, not new per-weapon data.
  const adsLambda = w.def.model?.heavy ? 10 : (w.def.inertia ?? 8) * 1.6;
  adsSmoothT = damp(adsSmoothT, adsOffset, adsLambda, dt);
  // The gun rides high and close enough that the rods holding it are in
  // view (CoD-style framing).
  const hipPos = new THREE.Vector3(0.2, -0.165, -0.5);
  if (mesh.userData.hipOffset) hipPos.add(mesh.userData.hipOffset);
  const aimPoint = mesh.userData.aimPoint || new THREE.Vector3(0, 0, -0.4);
  // Where the sight sits in front of the weapon camera. Tube optics ask to
  // come closer so the eyepiece frames the view rather than a pinhole.
  const adsViewDistance = -(mesh.userData.adsDistance ?? 0.46);
  const adsPos = new THREE.Vector3(-aimPoint.x, -aimPoint.y, adsViewDistance - aimPoint.z);
  const basePos = hipPos.clone().lerp(adsPos, adsSmoothT);

  // Gun drops out of the way while sprinting, sliding or vaulting.
  const wantLower = (move.sprinting || move.stance === STANCE.SLIDE || move.busy) ? 1 : 0;
  weaponLowerT = damp(weaponLowerT, wantLower, 9, dt);
  // "Sling to the side" roll tracks the same sprint/lower gate, but at its
  // own (slightly slower) rate so the roll settles in a beat after the
  // straight lower does — that stagger is what makes the sprint-out read as
  // two things happening (drop, then swing) rather than one linear slide.
  sprintRollT = damp(sprintRollT, wantLower, 6, dt);

  // Landing impact: capture once on the justLanded edge, then let it decay.
  // Caller (this function) is responsible for clearing justLanded, per the
  // contract documented at movement.js's own justLanded assignment.
  if (move.justLanded) {
    landDipMag = Math.min(1, move.landSpeed / LAND_DIP_MAX_SPEED);
    landDipT = 1;
    move.justLanded = false;
  }
  landDipT = damp(landDipT, 0, 7, dt);

  const insp = inspectPose();
  const rl = reloadPose(w, mesh);
  const landPos = LAND_DIP_POS * landDipMag * landDipT;
  const landPitch = LAND_DIP_PITCH * landDipMag * landDipT;
  // Heavier weapons swing further into the sprint roll (def.heavy / a longer
  // model.len both already exist as the "this gun is bigger" signals used
  // elsewhere in weapon-model.js — reused here rather than adding new data).
  const weightMult = w.def.model?.heavy ? 1.35 : 1;
  const sprintRoll = sprintRollT * 0.22 * weightMult;
  // PF sprint cant (user's reference clip): the gun swings across the body,
  // muzzle up and to the LEFT, a diagonal rather than straight up the right.
  const sprintCant = sprintRollT * 0.5;

  // Turn lag (PF): the gun trails the view when you turn and rolls into
  // it, heavier guns further. Look rates are per second, wrapped yaw.
  const yawStep = Math.atan2(Math.sin(look.yaw - lastLookYaw), Math.cos(look.yaw - lastLookYaw));
  const yawRate = dt > 0 ? yawStep / dt : 0;
  const pitchRate = dt > 0 ? (look.pitch - lastLookPitch) / dt : 0;
  lastLookYaw = look.yaw;
  lastLookPitch = look.pitch;
  const lagK = (w.def.model?.heavy ? 1.3 : 1) * (1 - adsOffset * 0.8);
  turnLagX = damp(turnLagX, THREE.MathUtils.clamp(yawRate * 0.009, -0.05, 0.05) * lagK, 10, dt);
  turnLagY = damp(turnLagY, THREE.MathUtils.clamp(pitchRate * 0.006, -0.035, 0.035) * lagK, 10, dt);

  mesh.position.set(
    basePos.x + bobX + swayX - w.viewKickKnockback * 0.4 + weaponLowerT * 0.02 + turnLagX + insp.x + rl.x,
    basePos.y + bobY + swayY - weaponLowerT * 0.15 - landPos - turnLagY + insp.y + rl.y,
    basePos.z + w.viewKickKnockback * 0.6 + weaponLowerT * 0.08 + insp.z + rl.z
  );
  mesh.rotation.set(
    -w.viewKickPitch * 0.8 + weaponLowerT * 0.45 + landPitch - turnLagY * 2 + insp.pitch + rl.pitch,
    w.viewKickYaw * 0.6 + (1 - adsOffset) * (0.05 + (mesh.userData.hipYaw ?? 0)) + sprintCant + turnLagX * 2 + insp.yaw + rl.yaw,
    (1 - adsOffset) * 0.08 + weaponLowerT * 0.38 + sprintRoll + turnLagX * 4 + insp.roll + rl.roll + w.viewKickRoll
  );
  applyGunInspect(mesh, w);
  if (mesh.userData.akimbo) {
    akimboView.update(mesh, w, dt, { reload: rl.akimboT ?? -1, inspect: inspectT > 0 && player.holding === "gun" ? inspectProgress() : -1 });
    akimboShown = true;
  } else if (akimboShown) {
    akimboView.hideFx();
    akimboShown = false;
  }
  placeReloadMag(mesh, rl.magT ?? -1);
  updateGreenCandles(mesh, w, rl.magT ?? -1, dt);
  placeReloadShell(mesh, rl.shellT ?? -1, rl.portShell ?? -1);
  placePump(mesh, w, rl.rack ?? -1, rl.pumpBack ?? null);
  if (mesh.userData.sb) updateSoulBlazerHand(mesh, w);
  drainWeaponEvents(w);
  posePfArms(mesh, rl.magHold || 0);

  if (mesh.userData.sight) mesh.userData.sight.visible = true;
  fadeOpticGlass(mesh, adsSmoothT);
  updateLaserBeam(mesh, w);

  if (muzzleFlashT > 0) {
    muzzleFlashT -= dt;
    muzzleMat.uniforms.uIntensity.value = Math.max(0, muzzleFlashT / 0.045) * w.def.muzzleFlashScale;
    muzzleFlash.rotation.z += 20 * dt;
  } else {
    muzzleMat.uniforms.uIntensity.value = 0;
  }
  muzzleLight.intensity *= Math.max(0, 1 - dt * 30);
  const barrelTipLocal = new THREE.Vector3(0, 0.02, mesh.userData.muzzleZ ?? -0.62);
  muzzleFlash.position.copy(basePos).add(barrelTipLocal);
  if (mesh.userData.akimbo) akimboView.muzzleLocal(mesh, w.akimboSide ?? 0, muzzleFlash.position);
  muzzleLight.position.copy(muzzleFlash.position);
}

// -------------------- boot --------------------

resize();
applySettings();
initEscapeMenu();
initRadioWidget();
els.loading.hidden = true;
animate();

/* Hitbox lab, localhost only, behind ?hitbox=1: puts you in the Test Range
   with a row of trolls and reads every round against both the hitbox and
   the visible body (hitbox-lab.js). Loaded lazily, so play never fetches it. */
if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && /[?&]hitbox=1/.test(location.search)) {
  import("./hitbox-lab.js?v=hl3-wst-soc1-sb2").then(({ createHitboxLab }) => {
    hitboxLab = createHitboxLab({
      scene, look, move, colliders: () => colliders, isRange, state: () => gameState, startGame,
      setMode: (id) => { modeId = id; modePicked = true; },
    });
  });
}

/* Test hook. This file is a module, so nothing above is reachable from a
   headless harness by bare identifier the way the main site's inline script
   is. Behind ?tohooks=1 so normal play never exposes it. */
if (/[?&]tohooks=1/.test(location.search)) {
  window.__trollOps = {
    renderer, scene, colliders, streakArms,
    els, net, player, move, look, bots, remotes, loadout, djLulz, music, builtMap: () => builtMap, modeId: () => modeId, spawner: () => spawner,
    chat, renderScoreboard, renderLobbyRoster, renderMenuRoster,
    settings, radialStick, padLookTurn, hitboxLab: () => hitboxLab, localRig, toggleThirdPerson, charInspector, inspector, emoteWheel, menuEmoteWheel, lookSensScale, botEarn, botStreakState, botStreakLog, uavActiveFor, vsatActiveFor, findAimAssistTarget, emote: () => emote,
    duo: () => ({ target: duoTarget?.netId || null, armed: duoArmed, outgoing: duoOutgoing, incoming: duoIncoming, xClaimed: duoXClaimed }),
    nearestDuoTeammate, armDuo, sendDuoInvite, keys, setEmote: (idx, role = 0) => { emote = EMOTES[idx] ? { idx, t: 0, role } : null; },
    closePauseMenu, openPauseMenu, currentWeapon, tryReload, switchWeapon, pfArms, setAds: (v) => { adsHeld = !!v; },
    kbRepair, kbShield, saberFrac: () => (activeMeleeMesh?.userData.saber || activeMeleeMesh?.userData.halo)?.frac ?? null,
    setLoadWaitMax: (s) => { loadWaitMax = s; },
    loadState: () => ({ open: loadScreen.isOpen, hold: loadHold, warm: loadWarm, target: loadTarget, staging: isStaging(), stageT, status: document.querySelector(".to-mapload-status")?.textContent || "" }),
    gfx: () => ({ tier: gfxTier(), auto: gfxAutoTier, ceiling: gfxCeiling, ssao: ssao.enabled, bloom: bloom.enabled, shadow: sun.shadow.mapSize.x, pixelRatio }),
    startGame, beginMatch, endMatch, spawnForTeam, respawnPlayer, damagePlayer, breakSpawnGuard,
    startIntermission, updateIntermission, occupants, notePointDeath,
    isStaging, beginStaging, endStaging, updateStaging, matchIntro,
    isSnd, bomb: () => bomb, bombSites: () => bombSites, sndRound: () => sndRound,
    sndAttackTeam: () => sndAttackTeam, sndEliminated: () => sndEliminated,
    prepareSndRound, sndGoLive, botObjective, sndClock: () => sndClock, setSndClock: (v) => { sndClock = v; }, teamScores, sndLive: () => sndLive, sndBotSite: () => sndBotSite, spawnSides: () => spawnSides, hill: () => hill, stunActor, blastCandidates, sndRoundWin, updateSnd, siteUnderfoot, sndAliveCounts,
    stageT: () => stageT, stageOwner: () => stageOwner,
    registerDeath, noteDealt, creditAssistIfOwed, showDeathCard,
    noteDamage, assistersFor, addMatchXp, awardKillXp, pushKillfeed,
    damageLog: () => damageLog, dealtLog: () => dealtLog,
    voteOptions: () => voteOptions,
    intermissionT: () => intermissionT,
    state: () => gameState,
    grenades, audio, ambience, camera, colliders, killcam, bullets, look,
    startCook, releaseCook, cancelCook, applyRemoteNade, blindT: () => blindT, cooking,
    empT: () => empT,
    empPlayer, flashPlayer, explosionFx, fireShake,
    startInspect, inspectT: () => inspectT, inspectPose, setInspectFreeze: (v) => { inspectFreeze = v; },
    showHitmarker, damageNumbers: () => damageNumbers, noteHitDirection, hitDirs,
    setMode: (id) => { modeId = id; modePicked = true; },
    hero: () => hero(), heroHostiles, applyHeroFx, useHeroAbility,
    zdir: () => zdir,
    onBulletActorHit,
    loadedMapId: () => loadedMapId,
    THREE,
    activeMeleeMesh: () => activeMeleeMesh,
    activeWeaponMesh: () => activeWeaponMesh,
    matchClockT: () => matchClockT,
    resetMatchClock, swingMelee, fireOnce, akimboView, setActiveWeaponMesh, botThrow, botMelee, isInfected, infectionCounts, applyInfect,
    infectionStarted: () => infectionStarted, pickFirstInfected, setInfectionT: (v) => { infectionT = v; }, botNadesThrown: () => botNadesThrown,
    activeLobbyPanel: () => activeLobbyPanel, showLobbyPanel,
    streaks, streakPicker, killstreakUi, achievements, streakIconSvg,
    awardScore, callReadyStreak, callStreak, fireStreak, startUav, applyRemoteStreak,
    cycleSelectedStreak, useSelectedStreak, selectedStreak: () => selectedStreak,
    readyStreaksOrdered, streakSlotIds, callStreakSlot, warmShaders, lightPool, pixelRatio: () => pixelRatio,
    updateStreakHud, enemiesRevealed, uavBucket, uavUntil, vsatUntil, drawMinimap,
    streakLockLeft, minimapJammed, applyCounterUav, flyovers, STREAK_DEFS,
    lastHitRange: () => lastHitRange,
    streakEntities, pendingStrikes, flyovers, strikeTablet: () => strikeTablet, openStrikeTablet, throwMarker, HunterDroneClass: HunterDrone, droneWorld, raycastWorld, groundHeightAt,
    markingStreak: () => markingStreak, confirmMark, cancelMark, updateMarking,
    groundAimPoint, rollPackageReward, claimPackage, clearStreakEntities,
    spawnCarePackage, spawnDrone, spawnHelicopter, updateStreakEntities,
    spawnK9, spawnWarship, spawnDragonfire, spawnSam, dragonfire: () => dragonfire, dragonfireView, samTargets, shootDownAir,
    botStreakMult, dragonfireSkyCheck, dragonfireBlocked, streakControlActive, streakBusy, endActiveStreak, streakEnd, warship: () => warship, markingStreak: () => markingStreak,
    fireDragonfire, roomBotSkill, boostedXp, veteranBoostOn, weaponRig, localHeld, MELEE_DEFS, saberParry,
    trySwivel, swivel, tabletDive: () => tabletDive, tabletDiveDip, botFireStreak, BOT_STREAK_POOL, updateBotAntiAir, enemyAirFor,
    warship: () => warship, warshipView, warshipGun: () => warshipGun, fireWarship, toggleWarshipGun,
    swarmRuns, damageDog, K9Pack, VtolWarship, WARSHIP_GUNS, K9, spawnRecon, droneAirTarget, enemyAirFor, jammedUntil: () => jammedUntil,
    nearestHostileTo, strikeImpact, spawnAirstrike, pickDroneTarget, nearbyPackage, updatePickupPrompt,
    gamepadState, touchState, streakKeyLabel, keys, swapHold,
    animDebug, weaponLowerT: () => weaponLowerT, switchWeapon,
    tryReload, currentWeapon, fireOnce, composer, setHolding,
    setTrigger: (v) => { mouseDown = !!v; },
    isStaging: () => isStaging(),
    // Socialize (switchRoomMode).
    isSocial: () => isSocial(), damagePlayer, switchWeapon, swingMelee, startCook,
    social: () => ({ room: socialRoom, seq: roomModeSeq, home: socialMapId, returning: socialReturnSeq != null, map: loadedMapId, mode: modeId, team: net.team, gameState }),
    ownerSwitchRoomMode, returnToSocial, renderRoomModeRow, fpWeaponDrawn: () => activeWeaponMesh?.visible ?? null,
    socialArms: () => ({ k: socialArms.k, run: socialArms.run, phase: socialArms.phase, on: fpEmoteArmsOn }),
    bar: () => ({ drink: bar.drink && { ...bar.drink }, role: bar.role, tipsy: bar.tipsy, sipT: bar.sipT, offer: !!bar.offer, outgoing: !!bar.outgoing, prompt: els.pickupPrompt.hidden ? null : els.pickupPromptText.textContent, fp: !!bar.fp?.parent, tp: !!bar.tp?.parent }),
    barState: bar,
    // Socialize roleplay phase 2 (rp-roles.js): seats, the piano, the jobs.
    rp: () => ({
      seated: seated && { idx: seated.idx, kind: seated.s.kind, eye: move.eyeHeight }, role: bar.role, tipsy: bar.tipsy,
      piano: { playing: piano.playing, tune: piano.tune, voices: [...piano.voices.keys()] }, yieldKey: npcYieldKey,
      prompt: els.pickupPrompt.hidden ? null : els.pickupPromptText.textContent,
    }),
    rpSeats: () => rpSeats(), seatTaken, sitDown, standUp, docSpots: () => docSpots(),
    townNpcs: () => townNpcs,
    weaponRig: () => weaponRig,
    candleState: () => { const w = currentWeapon(); return { charging: w.charging, level: w.chargeLevel, ammo: w.ammoInMag, reserve: w.ammoReserve, reloading: w.reloading }; },
    hellfire, hellfireView,
    meleeImpactT: () => meleeImpactT, meleeWhiffT: () => meleeWhiffT, sawShake: () => sawShake, sawInspectRev: () => sawInspectRev,
    targetMeshes: () => targetMeshes, meleeConnect,
    saberState: () => ({ ...saberBlock, trail: !!saberTrail?.mesh.visible, deflectT: saberDeflectT, parry: { ...saberParry.sample(), t: saberParry.t }, flick: saberFlick }),
    DROP, royaleDropView, inSkyLobby, startRoyaleBus,
    royale: () => royale, royaleAliveList, startRoyaleAct, royalePickupGun, royaleWants, setupRoyale, cycleSpectate, royaleSpectating,
    royaleBotObjective, royaleBotDamage, royaleNoise, ROYALE,
    activeStreakMesh: () => activeStreakMesh, streakHoldT: () => streakHoldT,
    streakArms, beginStreakHold, weaponRig, WHISTLE_HAND, WHISTLE_ROT, spawnVsatSat,
    beginStreakHold, endStreakHold, meleeHolster: () => meleeHolster, clearStreakLocks,
    landDipT: () => landDipT, landDipMag: () => landDipMag,
    aimAssistPoints, findAimAssistTarget, applyAimAssist, controls,
  };
  animDebug.mount(() => {
    const w = currentWeapon();
    return {
      weapon: w.def?.name ?? w.id ?? "-",
      holding: player.holding,
      adsT: w.adsT.toFixed(2),
      reloading: w.reloading, reloadT: w.reloadT?.toFixed?.(2) ?? "-",
      sprinting: move.sprinting, stance: move.stance,
      grounded: move.grounded, jumping: move.jumping,
      justLanded: move.justLanded, landSpeed: move.landSpeed?.toFixed?.(2) ?? "-",
      velocity: move.velocity ? `${move.velocity.x.toFixed(1)},${move.velocity.y.toFixed(1)},${move.velocity.z.toFixed(1)}` : "-",
      meleeBusy: player.melee?.busy, meleeT: player.melee?.t?.toFixed?.(2) ?? "-",
      inspectT: inspectT.toFixed(2),
      markingStreak: markingStreak ?? "-",
    };
  });
}

