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
import { buildMap, disposeMap, MAPS, MAP_IDS } from "./maps.js?v=p5tc-k9-em1-wst-tl1-bs1-tl2-sb1-rp1-dj1-cr1-db1-sb2-db2a-db2b-db2c-db3-db4-db5";
import { createMapPreloader } from "./map-preload.js?v=mp4";
import { createMapLoadScreen, mapShotAttrs } from "./map-load-screen.js?v=ml3-wst-tl1-ng1-db5";
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
import { clearDamageNumbers, clearHitDirs, damageNumbers, flashHit, flinchPeer, hitDirs, jokeVerb, noteHitDirection, pushKillfeed, showHitmarker, showWaveBanner, spawnComicWord, spawnDamageNumber, updateDamageNumbers, updateHitDirs, updateStreakHud } from "./core/hud.js?v=cr1-si1";
import { buildMinimapBase, drawMinimap, mapToMinimap, minimapCanvas, setBombSiteMarkers, setHillMarker, initMinimap } from "./core/minimap.js?v=cr1";
import { achievements, blastFx, callReadyStreak, callStreak, callStreakSlot, cancelMark, clearStreakEntities, clearStreakLocks, confirmMark, cycleSelectedStreak, endActiveStreak, enemiesRevealed, flyovers, groundAimPoint, killstreakUi, lockStreak, minimapJammed, pendingStrikes, readyStreaksOrdered, spawnVsatSat, startVsat, streakBlast, streakBusy, streakControlActive, streakEnd, streakEntities, streakKeyLabel, streakLockLeft, streakLockUntil, streakLockWhy, streakPicker, streakSlotIds, streaks, uavActiveFor, uavBucket, uavUntil, updateMarking, updateStreakControl, useSelectedStreak, vsatActiveFor, vsatUntil, vsatUp, initStreakCalling } from "./streaks/calling.js?v=sk1-si1";
import { AIR_HP, DF_BLOCK_TEXT, DRONE_AIR_REACH, DRONE_AIR_SPEED, attachAirHitbox, dragonfireBlocked, dragonfireSkyCheck, droneAirTarget, droneFields, droneLeadPoint, droneTargetPos, droneWorld, ensureStrikeTablet, fireStreak, launchPendingDrone, openStrikeTablet, packageCaptureTime, pickDroneTarget, rollPackageReward, round2, spawnAirstrike, spawnCarePackage, spawnDrone, spawnHelicopter, spawnK9, streakBounds, strikeDelay, strikeTablet, throwMarker } from "./streaks/fire.js?v=sk1-si1";
import { HUNTER_DOG_BITE, HUNTER_PIN, applyHeroFx, applyHeroLoadout, assignBotHeroes, footprints, hero, heroActive, heroFx, heroHostiles, heroKit, heroMeleeDef, updateHero, useHeroAbility } from "./modes/umb-heroes.js?v=sk1-si1";
import { damageDog, dogKilledBy, k9Hostile, k9Stairs, updateK9 } from "./streaks/k9.js?v=sk1-si1";
import { DF_ASSIST_CONE_DEG, DF_ASSIST_PULL, DF_BOARD_AT, airTargetPos, damageStreakEntity, dragonfireView, enemyAirFor, fireDragonfire, samDeployPoint, samHitCount, samMissileHit, samTargets, shootDownAir, spawnDragonfire, spawnSam, streakHostileToMe, syncDragonfireView, updateSamAi } from "./streaks/dragonfire.js?v=sk1-si1";
import { WARSHIP_BOARD_AT, fireWarship, lookSensScale, placeWarshipCamera, spawnWarship, syncWarshipView, toggleWarshipGun, updateWarshipHud, warshipFov, warshipImpact, warshipView } from "./streaks/warship.js?v=sk1-si1";
import { applyCounterUav, claimPackage, lockEl, nearestHostileTo, spawnRecon, startUav, streakDamage, streakOwnerHates, strikeImpact, swarmRuns, updateStreakEntities, updateUavState } from "./streaks/air.js?v=sk1-si1";
import { BOT_STREAK_KEY, BOT_STREAK_POOL, applyRemoteStreak, botEarn, botFireStreak, botStreakLog, botStreakMult, botStreakState, botWarshipGunner, flyBotDragonfire, updateBotStreaks, initBotStreaks } from "./streaks/bot-streaks.js?v=sk1-si1";
import { SETTINGS_KEY, applySettings, saveSettings, settings } from "./menu/settings.js?v=ms1";
import { initRadioWidget } from "./menu/radio.js?v=mr1";
import { initEscapeMenu, renderMenuRoster, initMenuRoster } from "./menu/escape-menu.js?v=em1";
import { buildModeButtons, renderModes, initModePicker } from "./menu/mode-picker.js?v=mp1";
import { activeLobbyPanel, charInspector, charInspectorLive, cosmetics, inspector, inspectorLive, menuEmoteWheel, noBotsRoom, playerName, pollMenuEmotePad, renderCallsign, renderLobbyRoster, setNetStatus, showLobbyPanel, showSumGun, sumInspector, initLobby } from "./menu/lobby.js?v=lb1-si1";
import { endKillcamPresentation, killcamFov, killcamSelfId, killcamWeaponFov, skipKillcam, startKillcamPresentation, updateKillcam } from "./combat/killcam-present.js?v=kp2-si1";
import { ASSIST_MEMORY, ASSIST_MIN_DAMAGE, assistersFor, breakSpawnGuard, clearDeathVisuals, damageLog, damagePlayer, killcamBaseRespawn, killerPosFor, nameFor, noteDamage, onGruntAttack, respawnPlayer, showDeathCard, updateSpawnGuardHud, weaponNameFor, yawTowardCentre } from "./combat/damage.js?v=dm1-kc2-si1";
import { MELEE_DRAW_TIME, MELEE_EQUIP_TIME, POWER_EQUIP_TIME, POWER_HOLSTER_TIME, POWER_IGNITE, POWER_IGNITE_DELAY, POWER_RETRACT, SLOW_IGNITE, _bladeG, _bladeP, _flickQ, _kbFarGrip, _parryPos, _parryQ, _parryW, _viewX, _viewZ, kbRepair, kbShield, meleeConnect, onRemoteDeflect, saberBlock, saberParry, saberTrail, swingMelee, tryDeflect, updateKbShield, updateRemoteSabers, updateSaberBlock, updateSaberFx, initMelee } from "./combat/melee.js?v=ml1-kc2-si1";
import { applyEmpState, applyRemoteNade, areaDamage, blastCandidates, botNadesThrown, botThrow, cancelCook, carriedThrowSlot, empPlayer, explosionFx, flashPlayer, grenadeCtx, grenades, nextNadeId, publishBoom, refillGear, releaseCook, startCook, stunActor, updateBlastLights, initThrowables } from "./combat/throwables.js?v=th1-kc2-si1";
import { currentWeapon, cycleWeapon, fireOnce, frozenPlayer, nearbyPackage, onBulletActorHit, resolveBulletTarget, setHolding, setTouchContext, switchWeapon, tryReload, updateGearHud, updatePickupPrompt } from "./combat/weapons.js?v=wp1-kc2-si1";
import { addMatchXp, awardKillXp, awardScore, checkMatchEnd, creditAssistIfOwed, dealtLog, lastHitRange, noteDealt, recentTeamKillers, registerDeath, updateTeamHud } from "./combat/scoring.js?v=sc1-kc2-si1";
import { botBusy, botObjective, noteRemoteBombAct, prepareSndRound, scoreHill, siteUnderfoot, sndAliveCounts, sndBotSite, sndDefendTeam, sndGoLive, sndLive, sndRoundWin, updateSnd } from "./modes/objectives.js?v=ob1-si1";
import { applyInfect, applyInfectionLoadout, botMelee, infectionCounts, infectionStarted, pickFirstInfected, resetInfection, sortInfectionBots, updateInfection } from "./modes/infection.js?v=in1-si1";
import { adoptRoomMode, cancelSocialReturn, ownerSwitchRoomMode, renderRoomModeRow, returnToSocial, scheduleSocialReturn, initSocial } from "./modes/social.js?v=so1-si1-mb1";
import { initMenuButtons } from "./menu/buttons.js?v=mb1-mb1";
import { cancelIntermission, endGame, endMatch, renderVote, startIntermission, updateIntermission, voteOptions } from "./modes/match-end.js?v=me1-si1-mb1";
import { LOAD_WAIT_MAX, beginMatch, beginStaging, endStaging, enterMatch, followsHostMap, isStaging, loadHold, loadInfo, loadTarget, loadWarm, releaseLoad, startGame, updateStaging, warmNewGuns, warmShaders, initMatchStart } from "./modes/match-start.js?v=mst1-si1-mb1";
import { atPiano, bar, barSipK, docSpots, holdSeat, npcYieldKey, onBarMessage, piano, putDownDrink, resetBar, rpSeats, seatTaken, seated, sitDown, standUp, syncFpDrink, syncLocalDrink, updateBar, initSocialRp } from "./modes/social-rp.js?v=rp1-si1";
import { SWIVEL_TAP, localBlockT, localHeld, localLower, localReloadK, noteLocalDeath, noteRigShot, placeDeathCamera, swivel, swivelK, swivelTaps, syncLocalRigHeld, trySwivel, updateEmoteCamera, updateLocalRig, updateSwivel, updateThirdPersonCamera } from "./view/third-person.js?v=tp1-si1";
import { endCandleCharge, hudCache, regenPlayer, updatePlayer, initPlayerUpdate } from "./view/player-update.js?v=pu1-si1-mb1";
import { _armDir, _armFrom, _armTo, _meleeViewE, _meleeViewQ, applyMeleeInspect, applyReaperInspect, inspectArms, inspectDur, inspectPose, inspectProgress, landDipMag, landDipT, meleeHands, pfArms, placeRodWatch, poseMeleeArms, poseSaberArms, restoreMeleeHands, startInspect, stretchBetween, updateWeaponView, initWeaponView } from "./view/weapon-view.js?v=wv1-si1";
import { fpEmoteArmsOn, poseFreeArms, socialArms, updateFpEmoteView } from "./view/fp-emote.js?v=fe1-si1";
import { STREAK_SHOULDER, WHISTLE_BLOW_AT, WHISTLE_HAND, WHISTLE_HOLD, WHISTLE_ROT, hideStreakArms, streakArms, updateStreakView, initStreakView } from "./view/streak-view.js?v=sv1-si1";
import { SAW_REV_TIME, sawInspectRev, sawShake, updateMeleeView } from "./view/melee-view.js?v=mv1-si1";
import { _sbDir, _sbPos, _sbView, activeDroneMesh, activeMarkerMesh, activeMeleeMesh, activeStreakMesh, activeWeaponMesh, akimboView, hellfire, hellfireView, muzzleFlash, muzzleLight, muzzleMat, setActiveMeleeMesh, setActiveWeaponMesh, weaponCamera, weaponEnvTex, weaponRig, weaponScene, initViewmodels } from "./view/viewmodels.js?v=vm1-si1";
import { renderScoreboard } from "./core/scoreboard.js?v=sb1";
import { PITCH_LIMIT, controls, keys, lockChangedAt, look, initKeyboardMouse } from "./input/keyboard-mouse.js?v=km1";
import { armDuo, duoArmed, duoIncoming, duoOutgoing, duoTarget, duoXClaimed, emoteIsTp, emoteKind, emoteWheel, fpEmoteFrame, nearestDuoTeammate, onDuoMessage, sendDuoInvite, stopEmote, updateDuo, validEmote, initLocalEmotes } from "./view/local-emotes.js?v=le1";
import { SPAWN_GUARD, botSpawn, clearRangeBots, notePointDeath, occupants, renderPauseRange, spawnDeaths, spawnForTeam, spawnRangeBot, teamSpawn } from "./modes/spawns.js?v=spw1";
import { botDealDamage, botTargets, onBotShoot, remoteShotFx, updateBotAntiAir } from "./combat/bot-fire.js?v=bf1-mb1";
import { DIVE_LOOK, DRONE_TOSS_AT, MARKER_THROW_TIME, MELEE_HOLSTER_TIME, beginStreakHold, endStreakHold, finishMeleeHolster, finishStreakHold, holsterMeleeFor, holsterMeleeThen, meleePutAway, powerHeld, startTabletDive, streakDeviceKind, streakHoldActive, streakHoldUntilMark, streakLowering, streakScreen, tabletDiveDip, tabletDiveK, updateTabletDive } from "./streaks/hold.js?v=sh1";
import { closePauseMenu, openPauseMenu, releaseHeldInputs, resumePlay } from "./menu/pause.js?v=pa1-mb1";
import { paintMatchClock, resetMatchClock, updateMatchClock } from "./modes/match-clock.js?v=mc1";
import { boostedXp, renderBotSkillNote, roomBotSkill, syncRoomBotSkill, veteranBoostOn } from "./modes/bot-skill.js?v=bsk1-mb1";
/* What the split-out modules reach back into game.js for (see core/state.js).
   Functions go in as they are; everything else as a getter, so nothing is
   read before game.js declares it. game.js only ever gets smaller: an
   entry leaves this list when the thing it names moves out. */
linkGame({
  get _euler() { return _euler; },
  get _listenFwd() { return _listenFwd; },
  get _listenUp() { return _listenUp; },
  get _meleeViewE() { return _meleeViewE; },
  get _meleeViewQ() { return _meleeViewQ; },
  get _sbDir() { return _sbDir; },
  get _sbPos() { return _sbPos; },
  get _sbView() { return _sbView; },
  get activeDroneMesh() { return activeDroneMesh; },
  get activeLobbyPanel() { return activeLobbyPanel; },
  get activeMarkerMesh() { return activeMarkerMesh; },
  get activeMeleeMesh() { return activeMeleeMesh; },
  get activeStreakMesh() { return activeStreakMesh; },
  get activeWeaponMesh() { return activeWeaponMesh; },
  addMatchXp,
  get adsHeld() { return adsHeld; }, set adsHeld(v) { adsHeld = v; },
  get aimAssistSticky() { return aimAssistSticky; }, set aimAssistSticky(v) { aimAssistSticky = v; },
  get akimboShown() { return akimboShown; }, set akimboShown(v) { akimboShown = v; },
  get akimboView() { return akimboView; },
  get ambience() { return ambience; },
  applyGraphics,
  applyInfectionLoadout,
  areaDamage,
  get ARENA() { return ARENA; },
  get audio() { return audio; },
  awardScore,
  get baseFov() { return baseFov; }, set baseFov(v) { baseFov = v; },
  beginStaging,
  beginStreakHold,
  get blindT() { return blindT; }, set blindT(v) { blindT = v; },
  get bomb() { return bomb; }, set bomb(v) { bomb = v; },
  get bombSites() { return bombSites; }, set bombSites(v) { bombSites = v; },
  boostedXp,
  botBusy,
  botDealDamage,
  botEarn,
  get bots() { return bots; },
  get botSpawn() { return botSpawn; },
  botTarget,
  botWarshipGunner,
  get builtMap() { return builtMap; },
  get bullets() { return bullets; },
  calibratePadRest,
  callReadyStreak,
  callStreakSlot,
  get camera() { return camera; },
  cancelCook,
  cancelIntermission,
  carriedThrowSlot,
  get chat() { return chat; },
  clearRangeBots,
  get clock() { return clock; },
  closePauseMenu,
  get colliders() { return colliders; },
  compileWorld,
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
  get dfIx() { return dfIx; }, set dfIx(v) { dfIx = v; },
  get dfIz() { return dfIz; }, set dfIz(v) { dfIz = v; },
  get dfSaved() { return dfSaved; }, set dfSaved(v) { dfSaved = v; },
  get dfSendT() { return dfSendT; }, set dfSendT(v) { dfSendT = v; },
  get dfViewOn() { return dfViewOn; }, set dfViewOn(v) { dfViewOn = v; },
  get DIVE_LOOK() { return DIVE_LOOK; },
  get djLulz() { return djLulz; },
  get dragonfire() { return dragonfire; }, set dragonfire(v) { dragonfire = v; },
  dragonfireBlocked,
  dragonfireView,
  get DRONE_TOSS_AT() { return DRONE_TOSS_AT; },
  get droneFields() { return droneFields; },
  dropCarriedWeapon,
  get duoXClaimed() { return duoXClaimed; },
  get elapsedRun() { return elapsedRun; }, set elapsedRun(v) { elapsedRun = v; },
  get els() { return els; },
  get emote() { return emote; }, set emote(v) { emote = v; },
  get emoteIsTp() { return emoteIsTp; },
  get emoteKind() { return emoteKind; },
  get emoteWheel() { return emoteWheel; },
  get empT() { return empT; }, set empT(v) { empT = v; },
  endCandleCharge,
  endGame,
  endMatch,
  endStaging,
  endStreakHold,
  enemiesRevealed,
  enemyAirFor,
  enterMatch,
  equipFromLoadout,
  explosionFx,
  finishMeleeHolster,
  finishStreakHold,
  get fireEdgeTrigger() { return fireEdgeTrigger; }, set fireEdgeTrigger(v) { fireEdgeTrigger = v; },
  get fireShake() { return fireShake; },
  fireStreak,
  flyBotDragonfire,
  get fpEmoteFrame() { return fpEmoteFrame; },
  get freshStreak() { return freshStreak; }, set freshStreak(v) { freshStreak = v; },
  get gamepadState() { return gamepadState; },
  get gameState() { return gameState; }, set gameState(v) { gameState = v; },
  get gpDebugEl() { return gpDebugEl; },
  get gpDebugForced() { return gpDebugForced; },
  get gpIndex() { return gpIndex; }, set gpIndex(v) { gpIndex = v; },
  get gpPrev() { return gpPrev; }, set gpPrev(v) { gpPrev = v; },
  get gunGameProgress() { return gunGameProgress; }, set gunGameProgress(v) { gunGameProgress = v; },
  get hellfire() { return hellfire; },
  get hellfireView() { return hellfireView; },
  heroActive,
  hideStreakArms,
  get hill() { return hill; }, set hill(v) { hill = v; },
  get hillAcc() { return hillAcc; }, set hillAcc(v) { hillAcc = v; },
  get hitboxLab() { return hitboxLab; },
  get hitFlashT() { return hitFlashT; }, set hitFlashT(v) { hitFlashT = v; },
  holsterMeleeFor,
  holsterMeleeThen,
  get hudLayout() { return hudLayout; },
  humanHeadcount,
  get impactFx() { return impactFx; },
  get infectionStarted() { return infectionStarted; },
  get infectionT() { return infectionT; }, set infectionT(v) { infectionT = v; },
  get inspectFreeze() { return inspectFreeze; },
  get inspector() { return inspector; },
  get inspectT() { return inspectT; }, set inspectT(v) { inspectT = v; },
  get intermissionT() { return intermissionT; }, set intermissionT(v) { intermissionT = v; },
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
  isTrollRunner,
  isView,
  isZombies,
  get jammedUntil() { return jammedUntil; }, set jammedUntil(v) { jammedUntil = v; },
  k9Stairs,
  get kcClock() { return kcClock; }, set kcClock(v) { kcClock = v; },
  get keys() { return keys; },
  kickFireShake,
  get killcam() { return killcam; },
  get killcamBaseRespawn() { return killcamBaseRespawn; },
  get killcamWasActive() { return killcamWasActive; }, set killcamWasActive(v) { killcamWasActive = v; },
  get landDipMag() { return landDipMag; },
  get landDipT() { return landDipT; },
  get lastHitRange() { return lastHitRange; },
  learnPadRest,
  get lightPool() { return lightPool; },
  get loadedMapId() { return loadedMapId; },
  loadInfo,
  loadMap,
  get loadout() { return loadout; },
  get loadScreen() { return loadScreen; },
  get loadWaitMax() { return loadWaitMax; },
  get lobbyReady() { return lobbyReady; },
  get localBlockT() { return localBlockT; },
  get localHeld() { return localHeld; },
  get localLower() { return localLower; },
  get localPauseOnly() { return localPauseOnly; }, set localPauseOnly(v) { localPauseOnly = v; },
  get localPhase() { return localPhase; }, set localPhase(v) { localPhase = v; },
  get localRig() { return localRig; },
  get localShotAt() { return localShotAt; }, set localShotAt(v) { localShotAt = v; },
  get localThrowT() { return localThrowT; }, set localThrowT(v) { localThrowT = v; },
  get lockEl() { return lockEl; },
  get look() { return look; },
  get mapPreload() { return mapPreload; },
  mapToMinimap,
  get MARKER_THROW_TIME() { return MARKER_THROW_TIME; },
  get markerThrowT() { return markerThrowT; }, set markerThrowT(v) { markerThrowT = v; },
  get markingStreak() { return markingStreak; }, set markingStreak(v) { markingStreak = v; },
  get matchClockShown() { return matchClockShown; }, set matchClockShown(v) { matchClockShown = v; },
  get matchClockT() { return matchClockT; }, set matchClockT(v) { matchClockT = v; },
  get matchesPlayed() { return matchesPlayed; }, set matchesPlayed(v) { matchesPlayed = v; },
  get matchIntro() { return matchIntro; },
  matchMapId,
  get MELEE_HOLSTER_TIME() { return MELEE_HOLSTER_TIME; },
  get meleeDrawLen() { return meleeDrawLen; }, set meleeDrawLen(v) { meleeDrawLen = v; },
  get meleeDrawT() { return meleeDrawT; }, set meleeDrawT(v) { meleeDrawT = v; },
  get meleeHolster() { return meleeHolster; }, set meleeHolster(v) { meleeHolster = v; },
  get meleeImpactT() { return meleeImpactT; }, set meleeImpactT(v) { meleeImpactT = v; },
  get meleePutAway() { return meleePutAway; },
  get meleeWhiffT() { return meleeWhiffT; }, set meleeWhiffT(v) { meleeWhiffT = v; },
  minimapJammed,
  get modeId() { return modeId; }, set modeId(v) { modeId = v; },
  get modePicked() { return modePicked; }, set modePicked(v) { modePicked = v; },
  get mouseDown() { return mouseDown; }, set mouseDown(v) { mouseDown = v; },
  get mouseLookAt() { return mouseLookAt; }, set mouseLookAt(v) { mouseLookAt = v; },
  get move() { return move; },
  get music() { return music; },
  get muzzleFlash() { return muzzleFlash; },
  get muzzleFlashT() { return muzzleFlashT; }, set muzzleFlashT(v) { muzzleFlashT = v; },
  get muzzleLight() { return muzzleLight; },
  get muzzleMat() { return muzzleMat; },
  get myUavUntil() { return myUavUntil; }, set myUavUntil(v) { myUavUntil = v; },
  nameFor,
  nearbyPackage,
  nearMiss,
  get net() { return net; },
  nextWave,
  nextZombieRound,
  noteDealt,
  noteLocalDeath,
  notePointDeath,
  nudgeSetting,
  occupants,
  onBulletActorHit,
  openPauseMenu,
  openPlayerProfile,
  openStrikeTablet,
  otherHumansInMatch,
  get padRest() { return padRest; },
  paintMatchClock,
  get pendingDroneLaunch() { return pendingDroneLaunch; }, set pendingDroneLaunch(v) { pendingDroneLaunch = v; },
  pickPad,
  get pickups() { return pickups; },
  get PITCH_LIMIT() { return PITCH_LIMIT; },
  get player() { return player; },
  playerUid,
  powerHeld,
  putDownDrink,
  get QUICKPLAY_BASE() { return QUICKPLAY_BASE; },
  get QUICKPLAY_MAX_SHARDS() { return QUICKPLAY_MAX_SHARDS; },
  get rangeSet() { return rangeSet; }, set rangeSet(v) { rangeSet = v; },
  readyStreaksOrdered,
  refreshLobbyMap,
  registerDeath,
  releaseCook,
  get remoteBombAct() { return remoteBombAct; }, set remoteBombAct(v) { remoteBombAct = v; },
  get remotes() { return remotes; },
  remoteShotFx,
  renderBotSkillNote,
  get renderer() { return renderer; },
  renderGpDebug,
  renderLobbyRoster,
  renderScoreboard,
  renderViewModeRow,
  reportRangeShot,
  resetBar,
  resetFireShake,
  resetMatchClock,
  resolveBulletTarget,
  get respawnT() { return respawnT; }, set respawnT(v) { respawnT = v; },
  resumePlay,
  get roomIsCustom() { return roomIsCustom; }, set roomIsCustom(v) { roomIsCustom = v; },
  get roomMapHint() { return roomMapHint; }, set roomMapHint(v) { roomMapHint = v; },
  get roomModeSeq() { return roomModeSeq; }, set roomModeSeq(v) { roomModeSeq = v; },
  get roomSkillSeen() { return roomSkillSeen; }, set roomSkillSeen(v) { roomSkillSeen = v; },
  get royaleCatchUp() { return royaleCatchUp; }, set royaleCatchUp(v) { royaleCatchUp = v; },
  royaleSpectating,
  get saberArmsOn() { return saberArmsOn; }, set saberArmsOn(v) { saberArmsOn = v; },
  get saberArmsWere() { return saberArmsWere; }, set saberArmsWere(v) { saberArmsWere = v; },
  get saberDeflectT() { return saberDeflectT; }, set saberDeflectT(v) { saberDeflectT = v; },
  get saberFlick() { return saberFlick; }, set saberFlick(v) { saberFlick = v; },
  get saberHavePrevTip() { return saberHavePrevTip; }, set saberHavePrevTip(v) { saberHavePrevTip = v; },
  get saberWasShown() { return saberWasShown; }, set saberWasShown(v) { saberWasShown = v; },
  samDeployPoint,
  get samHitCount() { return samHitCount; },
  get SAW_REV_TIME() { return SAW_REV_TIME; },
  get sawRevBlips() { return sawRevBlips; }, set sawRevBlips(v) { sawRevBlips = v; },
  get sawShake() { return sawShake; },
  scavengeAllowed,
  get scene() { return scene; },
  get selectedStreak() { return selectedStreak; }, set selectedStreak(v) { selectedStreak = v; },
  setActiveMeleeMesh,
  setActiveWeaponMesh,
  setHolding,
  get settings() { return settings; },
  setTouchContext,
  setTouchControls,
  get shakeMag() { return shakeMag; }, set shakeMag(v) { shakeMag = v; },
  get shakeT() { return shakeT; }, set shakeT(v) { shakeT = v; },
  showWaveBanner,
  skipKillcam,
  get slideTiltT() { return slideTiltT; }, set slideTiltT(v) { slideTiltT = v; },
  get sndAttackTeam() { return sndAttackTeam; }, set sndAttackTeam(v) { sndAttackTeam = v; },
  get sndCanInteract() { return sndCanInteract; }, set sndCanInteract(v) { sndCanInteract = v; },
  get sndClock() { return sndClock; }, set sndClock(v) { sndClock = v; },
  get sndEliminated() { return sndEliminated; }, set sndEliminated(v) { sndEliminated = v; },
  get sndInteractHeld() { return sndInteractHeld; }, set sndInteractHeld(v) { sndInteractHeld = v; },
  get sndRound() { return sndRound; }, set sndRound(v) { sndRound = v; },
  get sndRoundOver() { return sndRoundOver; }, set sndRoundOver(v) { sndRoundOver = v; },
  get socialMapId() { return socialMapId; }, set socialMapId(v) { socialMapId = v; },
  get socialReturnSeq() { return socialReturnSeq; }, set socialReturnSeq(v) { socialReturnSeq = v; },
  get socialReturnTimer() { return socialReturnTimer; }, set socialReturnTimer(v) { socialReturnTimer = v; },
  get socialRoom() { return socialRoom; }, set socialRoom(v) { socialRoom = v; },
  socialUnarmed,
  get SPAWN_GUARD() { return SPAWN_GUARD; },
  get spawnDeaths() { return spawnDeaths; },
  spawnDragonfire,
  get spawner() { return spawner; }, set spawner(v) { spawner = v; },
  spawnImpactBurst,
  get spawnOpening() { return spawnOpening; }, set spawnOpening(v) { spawnOpening = v; },
  get spawnPoints() { return spawnPoints; },
  spawnRangeBot,
  spawnRecon,
  spawnSam,
  get spawnSides() { return spawnSides; },
  spawnWarship,
  get stageOwner() { return stageOwner; }, set stageOwner(v) { stageOwner = v; },
  get stageT() { return stageT; }, set stageT(v) { stageT = v; },
  startCook,
  startGame,
  startInspect,
  startTabletDive,
  startUav,
  get stepPhase() { return stepPhase; }, set stepPhase(v) { stepPhase = v; },
  stopEmote,
  get STREAK_SHOULDER() { return STREAK_SHOULDER; },
  get streakArms() { return streakArms; },
  get streakCallGuardUntil() { return streakCallGuardUntil; }, set streakCallGuardUntil(v) { streakCallGuardUntil = v; },
  streakControlActive,
  streakDamage,
  get streakDeviceKind() { return streakDeviceKind; },
  get streakEnd() { return streakEnd; },
  get streakEntities() { return streakEntities; },
  streakHoldActive,
  get streakHoldElapsed() { return streakHoldElapsed; }, set streakHoldElapsed(v) { streakHoldElapsed = v; },
  get streakHoldT() { return streakHoldT; }, set streakHoldT(v) { streakHoldT = v; },
  get streakHoldUntilMark() { return streakHoldUntilMark; },
  streakKeyLabel,
  streakLockLeft,
  get streakLockWhy() { return streakLockWhy; },
  get streakLowering() { return streakLowering; },
  streakOwnerHates,
  get streakRaiseT() { return streakRaiseT; }, set streakRaiseT(v) { streakRaiseT = v; },
  get streaks() { return streaks; },
  get streakScreen() { return streakScreen; },
  streakSlotIds,
  get strikeTablet() { return strikeTablet; },
  get sumGunKey() { return sumGunKey; }, set sumGunKey(v) { sumGunKey = v; },
  get suppressT() { return suppressT; }, set suppressT(v) { suppressT = v; },
  get swapHold() { return swapHold; },
  get swarmRuns() { return swarmRuns; },
  get swaySmoothX() { return swaySmoothX; }, set swaySmoothX(v) { swaySmoothX = v; },
  get swaySmoothY() { return swaySmoothY; }, set swaySmoothY(v) { swaySmoothY = v; },
  swingMelee,
  syncLocalRigHeld,
  syncWarshipView,
  get tabletDive() { return tabletDive; }, set tabletDive(v) { tabletDive = v; },
  tabletDiveDip,
  tabletDiveK,
  get targetMeshes() { return targetMeshes; },
  teamName,
  get teamScores() { return teamScores; },
  teamSpawn,
  throwMarker,
  toggleThirdPerson,
  toggleWarshipGun,
  get touchState() { return touchState; },
  get townNpcs() { return townNpcs; }, set townNpcs(v) { townNpcs = v; },
  tryDeflect,
  tryReload,
  trySwivel,
  updateDuo,
  updateEnemySteps,
  updateFireShake,
  updateGearHud,
  updateMeleeView,
  updatePickupPrompt,
  updateRangeHud,
  updateSpawnGuardHud,
  updateStreakView,
  updateTabletDive,
  useHeroAbility,
  useSelectedStreak,
  validEmote,
  viewModeOn,
  get viewPrevMode() { return viewPrevMode; }, set viewPrevMode(v) { viewPrevMode = v; },
  vsatUp,
  warmNewGuns,
  get warship() { return warship; }, set warship(v) { warship = v; },
  get WARSHIP_BOARD_AT() { return WARSHIP_BOARD_AT; },
  get warshipGun() { return warshipGun; }, set warshipGun(v) { warshipGun = v; },
  warshipView,
  get weaponCamera() { return weaponCamera; },
  get weaponEnvTex() { return weaponEnvTex; },
  get weaponLowerT() { return weaponLowerT; }, set weaponLowerT(v) { weaponLowerT = v; },
  weaponNameFor,
  get weaponRig() { return weaponRig; },
  get weaponScene() { return weaponScene; },
  get WHISTLE_BLOW_AT() { return WHISTLE_BLOW_AT; },
  get WHISTLE_HOLD() { return WHISTLE_HOLD; },
  get zdir() { return zdir; }, set zdir(v) { zdir = v; },
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


/* Room bot skill (modes/bot-skill.js).
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


function toggleThirdPerson() {
  settings.thirdPerson = !settings.thirdPerson;
  saveSettings();
}


/* Emotes: hold H for the wheel (emote-wheel.js), release on one to play
   it. The camera pulls out to third person for it, like any locker-room
   emote; moving, firing, dying or the clock running out ends it. The index
   rides the state packet (`em`) so everyone else sees it too. */
let emote = null;   // { idx, t, role } while the local player is emoting (role 1 = second half of a duo)
initLocalEmotes();

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
    if (rp.alive) sources.push({ key: `r${rp.netId}`, pos: rp.pos, rope: rp.stance === "rope" });
  }
  for (const b of bots.bots) {
    if (b.alive) sources.push({ key: `b${b.id}`, pos: b.pos, rope: b.stance === "rope" });
  }

  for (const s of sources) {
    seen.add(s.key);
    let t = stepTrack.get(s.key);
    if (!t) { stepTrack.set(s.key, { last: s.pos.clone(), dist: 0 }); continue; }

    const moved = s.pos.distanceTo(t.last);
    t.last.copy(s.pos);
    // A teleport (respawn, net correction) shouldn't fire a burst of steps.
    if (moved > 3 || s.rope) { t.dist = 0; continue; }   // a rope climb is silent
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

let muzzleFlashT = 0;
let akimboShown = false;
initViewmodels();

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
let streakHoldElapsed = 0;
let markerThrowT = 0;
let pendingDroneLaunch = null;

/* Tablet dive (user): for the streaks you work from the tablet (Lightning
   Strike, VTOL Warship, Dragonfire) the view tips down onto the tablet in
   your hands, then pushes into its screen and cuts through a green scan
   flash to whatever it opens (the strike map, the gunner's feed, the
   drone's camera). `then` runs at the cut. Called streaks that just
   confirm (UAV, gunship, VSAT...) keep the plain hold. */
let tabletDive = null;        // { t, dur, then }
let meleeHolster = null;        // { t, id }


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

let spawner = null;

let mouseDown = false, adsHeld = false;
initKeyboardMouse();

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


/* True from the moment a match is set up until the countdown clears: the
   opening spawn is always on your own side. After that, respawns may use
   any point and your side is only a preference — CoD-style dynamic spawns,
   which is what stops a team being farmed at its own doorstep. */
let spawnOpening = false;


// A late joiner's Troll Royale catch-up (modes/royale.js applies it).
let royaleCatchUp = null;
initRoyale();

let infectionT = 0;          // countdown to the first infection


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

let loadWaitMax = LOAD_WAIT_MAX;   // (tests shorten it: __trollOps.setLoadWaitMax)
let stageT = 0;                  // seconds left; 0 means the match is live
let stageOwner = false;          // are we the client publishing the clock?
initMatchStart();

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

let sndClock = 0;             // seconds left to plant
let remoteBombAct = null;     // { kind, site, until } — someone else mid-plant/defuse

let intermissionT = 0;
initSocial();
initMenuButtons();

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


/* Third-person shooting and reloading (character.js _gripSupport): when we
   last fired, and how far through the current reload we are (0 = none). */
let localShotAt = -Infinity;
let localThrowT = 0;   // the third-person body's overhand throw, counting down

let fireEdgeTrigger = false;
initPlayerUpdate();
let townNpcs = null;   // Socialize townsfolk (town-npcs.js)
initSocialRp();


/* Phase 4 (DESIGN-ARMS.md): hit/whiff visual distinction. meleeConnect()
   sets one of these to 1 the instant it resolves a swing's single hit
   check; both decay here so a connect reads as a sharp stop-on-impact and
   a whiff reads as a slightly looser overextension, without adding new
   keyframes to SWING_TRACK/THRUST_TRACK — this only perturbs the sampled
   pose those tracks already produce. */
let meleeImpactT = 0;
let meleeWhiffT = 0;
let sawRevBlips = 0;


/* Streak device viewmodel (DESIGN-ARMS.md Phase 5). Simple raise/steady/
   lower — no swing state to fight over the pose the way melee has, so this
   is much shorter than updateMeleeView. `streakRaiseT` eases the device
   into its hold pose; sprinting lowers it the same way the gun/melee do.
   Whatever's in hand, the real sleeved arms (streakArms) hold it. */
let streakRaiseT = 0;
initStreakView();

let weaponLowerT = 0;
let slideTiltT = 0;   // camera roll while sliding, eased in and out
let inspectT = 0;
let inspectFreeze = null;   // test hook: pin the animation at one t

/* Trollsaber: held like a saber, the rods to two spots on the hilt, the
   right up by the clamp, the left down by the pommel. */
let saberArmsOn = false;
let saberArmsWere = false;
initWeaponView();

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

