// Troll Forces bot scorestreaks: bots earn and call streaks like players.
// Moved out of game.js (split phase 1).

import { royale } from "../modes/royale.js?v=md1-gj1-fu1b7b7dc2-wb1m1c4";
import { streaksAllowed, STREAK_DEFS } from "../scorestreaks.js?v=umb1-wst-sb2-fu1-wb1";
import { streakEntities, startVsat, spawnVsatSat, uavBucket, streakBlast, flyovers, killstreakUi } from "./calling.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4";
import { HunterDrone, HelicopterGunship, VtolWarship, MarkerCanister, AIRSTRIKE_RADIUS, CarePackage, DRONE_SPLASH_RADIUS, AIRSTRIKE_DELAY, WARSHIP_GUNS } from "../streak-entities.js?v=vsat2-hk1";
import { Dragonfire, DF_RANGE, DF_DAMAGE } from "../dragonfire.js?v=df3-sb2";
import { swarmRuns, startUav, spawnRecon, applyCounterUav, streakOwnerHates, streakDamage } from "./air.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4";
import { dragonfireSkyCheck, round2, pickDroneTarget, spawnDrone, spawnHelicopter, spawnK9, droneWorld, rollPackageReward, strikeDelay, spawnAirstrike, spawnCarePackage } from "./fire.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4";
import * as THREE from "three";
import { samDeployPoint, spawnSam, spawnDragonfire, shootDownAir, airTargetPos, damageStreakEntity } from "./dragonfire.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4";
import { raycastWorld } from "../ballistics.js?v=cg1-wst-hf1-fu1b7-wb1";
import { spawnWarship, WARSHIP_BOARD_AT } from "./warship.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4";
import { WEAPON_DEFS } from "../weapons.js?v=p5bm-wst-hf1-fu1-wb1";
import { groundHeightAt } from "../movement.js?v=umb2-sb2-gj1b7";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4";
import { K9Pack } from "../k9-unit.js?v=k9c-bs1-sb2-gj1b7b7d";
import { damageDog, dogKilledBy } from "./k9.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4";
import { SamTurret } from "../sam-turret.js?v=sam1";
import { game } from "../core/state.js?v=st1";

// Every bot rolls three streaks a match and earns them on the same meter a
// player does (kills; the meter empties on death, an earned streak stays).
// Once one is ready it waits for a quiet beat (nobody in sight a moment)
// and calls it. The bot host runs the streak as its owner; everyone else
// sees it through the streak messages players' streaks already send.
// Phase 1 had the ones that run themselves; phase 2 added the Care Package
// (throw the marker, run to the crate, capture it) and the Lightning Strike
// (three marks where the team last saw the most enemies), phase 3 the VTOL
// Warship (the bot stands still and works the guns, botWarshipGunner).
export const BOT_STREAK_POOL = ["uav", "counteruav", "vsat", "carepackage", "drone", "airstrike", "k9", "helicopter", "swarm", "samturret", "dragonfire", "warship"];
const BOT_RADAR = new Set(["uav", "counteruav", "vsat"]);   // no sides to share in FFA
const BOT_AIR = new Set(["drone", "helicopter", "swarm", "warship", "dragonfire"]);
let botWarshipMatch = -1;   // one bot warship a match (design call), whoever's side
const BOT_AIR_CAP = 2;      // bot air streaks up at once, per team
/* Veteran bots (user): 1.4x the scorestreaks of a regular bot (was 2x;
   user wanted ~4 bot streaks a minute, not ~7, in a 22-player TDM), friend and
   foe alike: their kills pay 1.4x into the streak meter, and 1.4x as
   many of their aircraft can be up at once. */
const BOT_VET_STREAK_MULT = 1.4;
export function botStreakMult(b) { return b.skill === "veteran" ? BOT_VET_STREAK_MULT : 1; }
const BOT_QUIET = 1.5;      // seconds with nobody in sight before calling
export const BOT_STREAK_KEY = "trollops:botStreaks";

function botStreaksOn() {
  return game.isPvp() && !game.isRange() && !royale && streaksAllowed(game.currentMode()) && (!game.els.botStreaks || game.els.botStreaks.checked);
}

export function botStreakState(b) {
  if (!b.streak || b.streak.match !== game.matchesPlayed) {
    const pool = BOT_STREAK_POOL.filter((id) => !(game.currentMode().ffa && BOT_RADAR.has(id)));
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    b.streak = { picks: pool.slice(0, 3), pts: 0, earned: new Set(), ready: [], lock: {}, wasAlive: b.alive, match: game.matchesPlayed };
  }
  return b.streak;
}

/* A bot we host scored (a kill, from registerDeath). */
export function botEarn(b, pts) {
  if (!botStreaksOn()) return;
  const s = botStreakState(b);
  s.pts += pts * botStreakMult(b);
  for (const id of s.picks) {
    if (!s.earned.has(id) && s.pts >= STREAK_DEFS[id].cost) { s.earned.add(id); s.ready.push(id); }
  }
}

function botAirUp(team) {
  let n = 0;
  for (const e of streakEntities.values()) {
    if (e.botId && e.botTeam === team && !e.sky && (e instanceof HunterDrone || e instanceof HelicopterGunship || e instanceof Dragonfire || e instanceof VtolWarship)) n++;
  }
  for (const s of swarmRuns) if (s.botId && s.team === team) n++;
  return n;
}

/* Per frame on the bot host: reset meters on death, call what's ready. */
export function updateBotStreaks(dt) {
  if (!botStreaksOn() || game.isStaging() || !game.net.isBotHost()) return;
  const now = performance.now();
  noteBotSightings(dt);
  for (const b of game.bots.bots) {
    const s = botStreakState(b);
    if (s.wasAlive && !b.alive) { s.pts = 0; s.earned.clear(); b.crate = null; }
    s.wasAlive = b.alive;
    if (b.alive && b.crate) updateBotCrate(b, dt);
    if (!b.alive || !s.ready.length || b.airborne || game.botBusy(b)) continue;
    const quiet = !b.lastSeen || b.lastSeen.age > BOT_QUIET;
    if (!quiet || b.reloadT > 0) continue;
    // Bots keep a Dragonfire banked until they're out under open sky, same
    // as a player; a Lightning Strike until their side has seen someone to
    // drop it on; a Warship if one bot already had this match's.
    const i = s.ready.findIndex((id) => (s.lock[id] || 0) <= now && (!BOT_AIR.has(id) || botAirUp(b.team) < BOT_AIR_CAP * botStreakMult(b))
      && (id !== "dragonfire" || !dragonfireSkyCheck(b.pos))
      && (id !== "airstrike" || botStrikeSpots(b).length > 0)
      && (id !== "warship" || botWarshipMatch !== game.matchesPlayed)
      && (id !== "carepackage" || !b.crate));
    if (i < 0) continue;
    const id = s.ready.splice(i, 1)[0];
    if (STREAK_DEFS[id].cooldown) s.lock[id] = now + STREAK_DEFS[id].cooldown * 1000;
    botFireStreak(b, id);
  }
}

/* A bot calls a streak: the same world events fireStreak makes for us,
   owned by the bot. */
export const botStreakLog = [];   // recent bot calls, newest last (tests, debugging)
export function botFireStreak(b, id) {
  botStreakLog.push({ bot: b.id, team: b.team, id, t: Math.round(performance.now()) });
  if (botStreakLog.length > 60) botStreakLog.shift();
  const def = STREAK_DEFS[id];
  const tag = `${b.id}-${Math.round(performance.now())}`;
  const callout = (label) => {
    const m = { kind: "callout", label, who: b.name, team: game.currentMode().ffa ? null : b.team };
    if (game.net.active) game.net.publishStreak(m);
    applyRemoteStreak(m);
  };
  switch (id) {
    case "uav": {
      const yaw = Math.random() * Math.PI * 2;
      startUav(b.team, def.duration);
      spawnRecon(round2(b.pos.x), b.pos.z, round2(yaw), def.duration, { team: b.team, caller: b.id });
      if (game.net.active) game.net.publishStreak({ kind: "uav", action: "start", team: b.team, duration: def.duration, x: round2(b.pos.x), z: round2(b.pos.z), yaw: round2(yaw) });
      callout("UAV");
      break;
    }
    case "vsat": {
      const yaw = Math.random() * Math.PI * 2;
      startVsat(b.team, def.duration);
      spawnVsatSat(yaw, def.duration);
      if (game.net.active) game.net.publishStreak({ kind: "vsat", action: "start", team: b.team, duration: def.duration, yaw: round2(yaw) });
      callout("ORBITAL VSAT");
      break;
    }
    case "counteruav": {
      const m = { kind: "cuav", action: "start", team: b.team, duration: def.duration, lockout: def.lockout,
        x: round2(b.pos.x), z: round2(b.pos.z), yaw: round2(Math.random() * Math.PI * 2) };
      if (game.net.active) game.net.publishStreak(m);
      applyCounterUav(m);   // the host is in the room too
      callout("COUNTER-UAV");
      break;
    }
    case "drone": {
      const eid = `streak-drone-${tag}`;
      const victim = pickDroneTarget(b.pos, 1.6, { team: b.team, botId: b.id });
      const from = new THREE.Vector3(b.pos.x, b.pos.y + 1.8, b.pos.z);
      const e = spawnDrone({ id: eid, targetId: victim?.netId || null, owned: true, pos: from, yaw: b.yaw });
      e.botId = b.id; e.botTeam = b.team;
      if (game.net.active) {
        game.net.publishStreak({ kind: "drone", action: "launch", eid, target: victim?.netId || null,
          x: round2(from.x), y: round2(from.y), z: round2(from.z), yaw: round2(b.yaw) });
      }
      callout("HUNTER-KILLER");
      break;
    }
    case "helicopter": {
      const eid = `streak-heli-${tag}`;
      const seed = Math.floor(Math.random() * 360);
      const e = spawnHelicopter({ id: eid, seed, owned: true, team: b.team });
      e.botId = b.id; e.botTeam = b.team;
      if (game.net.active) game.net.publishStreak({ kind: "heli", action: "spawn", eid, seed, team: b.team });
      callout("GUNSHIP INBOUND");
      break;
    }
    case "k9": {
      const eid = `streak-k9-${tag}`;
      const e = spawnK9({ id: eid, owned: true, team: b.team, ownerId: b.id, x: b.pos.x, y: b.pos.y, z: b.pos.z, yaw: b.yaw });
      e.botId = b.id; e.botTeam = b.team;
      if (game.net.active) {
        game.net.publishStreak({ kind: "k9", action: "spawn", eid, team: b.team,
          x: round2(b.pos.x), y: round2(b.pos.y), z: round2(b.pos.z), yaw: round2(b.yaw) });
      }
      callout("K9 UNIT");
      break;
    }
    case "swarm":
      swarmRuns.push({ t: 0, next: 1.4, sent: 0, botId: b.id, team: b.team });
      callout("SWARM");
      break;
    case "samturret": {
      const eid = `streak-sam-${tag}`;
      const at = samDeployPoint(b.pos, b.yaw);
      const e = spawnSam({ id: eid, owned: true, team: b.team, ...at });
      e.botId = b.id; e.botTeam = b.team;
      if (game.net.active) game.net.publishStreak({ kind: "sam", action: "spawn", eid, team: b.team, x: round2(at.x), y: round2(at.y), z: round2(at.z), yaw: round2(at.yaw) });
      callout("SAM TURRET");
      break;
    }
    case "dragonfire": {
      // The bot stands where it called it (botBusy) and flies it (flyBotDragonfire).
      const eid = `streak-df-${tag}`;
      const from = { x: b.pos.x - Math.sin(b.yaw) * 0.8, y: b.pos.y + 1.3, z: b.pos.z - Math.cos(b.yaw) * 0.8 };
      const e = spawnDragonfire({ id: eid, owned: true, team: b.team, ...from, yaw: b.yaw, botId: b.id });
      e.botTeam = b.team;
      b.piloting = eid;
      if (game.net.active) game.net.publishStreak({ kind: "dragonfire", action: "spawn", eid, team: b.team, x: round2(from.x), y: round2(from.y), z: round2(from.z), yaw: round2(b.yaw) });
      callout("DRAGONFIRE");
      break;
    }
    case "carepackage": {
      // Lob the marker a few metres ahead, like a player's throw; the drop is
      // called where it settles (updateStreakEntities), and the bot goes to
      // fetch it (botObjective, updateBotCrate).
      const eid = `pkg-${b.id}-${Math.round(performance.now())}`;
      const origin = new THREE.Vector3(b.pos.x, b.pos.y + 1.5, b.pos.z);
      const dir = new THREE.Vector3(-Math.sin(b.yaw), 0.35, -Math.cos(b.yaw)).normalize();
      origin.addScaledVector(dir, Math.max(0, Math.min(0.5, raycastWorld(game.colliders, origin, dir, 0.85) - 0.25)));
      const marker = new MarkerCanister({ id: eid, origin, dir, world: droneWorld, owned: true });
      marker.reward = rollPackageReward();
      marker.botId = b.id;
      marker.botTeam = b.team;
      streakEntities.set(eid, marker);
      game.scene.add(marker.root);
      if (game.net.active) {
        game.net.publishStreak({ kind: "carepackage", action: "marker", eid,
          ox: round2(origin.x), oy: round2(origin.y), oz: round2(origin.z), dx: round2(dir.x), dy: round2(dir.y), dz: round2(dir.z) });
      }
      b.crate = { eid, holdT: 0 };
      callout("CARE PACKAGE");
      break;
    }
    case "airstrike": {
      const spots = botStrikeSpots(b);
      if (!spots.length) break;
      // The jets come in from the caller's side of the marks.
      const cx = spots.reduce((a, p) => a + p.x, 0) / spots.length, cz = spots.reduce((a, p) => a + p.z, 0) / spots.length;
      const yaw = Math.atan2(-(cx - b.pos.x), -(cz - b.pos.z));
      const runs = spots.map((p, i) => ({ x: round2(p.x), z: round2(p.z), delay: round2(strikeDelay(i)) }));
      for (const r of runs) {
        const run = spawnAirstrike({ ...r, yaw, owned: true, team: b.team });
        run.botId = b.id;
      }
      if (game.net.active) game.net.publishStreak({ kind: "airstrike", action: "mark", runs, yaw: round2(yaw), team: b.team });
      callout("LIGHTNING STRIKE");
      break;
    }
    case "warship": {
      // The bot stands where it called it (botBusy) and works the guns
      // (botWarshipGunner) until it leaves or the bot dies.
      const eid = `streak-vtol-${tag}`;
      const seed = Math.floor(Math.random() * 360);
      const ws = spawnWarship({ id: eid, seed, owned: true, team: b.team });
      ws.botId = b.id; ws.botTeam = b.team;
      b.gunning = eid;
      botWarshipMatch = game.matchesPlayed;
      if (game.net.active) game.net.publishStreak({ kind: "warship", action: "spawn", eid, seed, team: b.team });
      callout("VTOL WARSHIP");
      break;
    }
  }
}

/* Where a bot's side has been seeing enemies: every sighting a bot makes
   (bots.js lastSeen) is kept a while, per side, for its Lightning Strike. */
const BOT_INTEL_KEEP = 25;      // seconds a sighting stays useful
const botIntel = new Map();     // side -> [{ x, z, t }]
let botIntelT = 0;
function botSide(b) { return game.currentMode().ffa ? b.id : b.team; }
function noteBotSightings(dt) {
  if ((botIntelT -= dt) > 0) return;
  botIntelT = 0.5;
  const now = performance.now() / 1000;
  for (const b of game.bots.bots) {
    if (!b.alive || !b.lastSeen || b.lastSeen.age > 1) continue;
    const side = botSide(b);
    const list = botIntel.get(side) || [];
    list.push({ x: b.lastSeen.x, z: b.lastSeen.z, t: now });
    while (list.length > 60 || (list.length && now - list[0].t > BOT_INTEL_KEEP)) list.shift();
    botIntel.set(side, list);
  }
}

/* Up to three strike marks for a bot: the densest clusters of its side's
   recent sightings (newer counts more), at least 9 m apart, none on top of a
   friend. Empty when the side has seen nobody lately. */
function botStrikeSpots(b) {
  const now = performance.now() / 1000;
  const pts = (botIntel.get(botSide(b)) || []).filter((p) => now - p.t <= BOT_INTEL_KEEP);
  if (!pts.length) return [];
  const ffa = !!game.currentMode().ffa;
  const friends = [];
  if (!ffa) {
    for (const o of game.bots.bots) if (o.alive && o.team === b.team) friends.push(o.pos);
    if (game.player.alive && game.net.team === b.team) friends.push(game.move.pos);
  } else friends.push(b.pos);
  const spots = [];
  const left = pts.slice();
  while (spots.length < 3 && left.length) {
    let best = null, bestW = 0;
    for (const p of left) {
      let w = 0;
      for (const q of left) {
        if (Math.hypot(p.x - q.x, p.z - q.z) < 7) w += 1 - (now - q.t) / BOT_INTEL_KEEP * 0.7;
      }
      if (w > bestW) { bestW = w; best = p; }
    }
    if (!best) break;
    for (let i = left.length - 1; i >= 0; i--) if (Math.hypot(left[i].x - best.x, left[i].z - best.z) < 9) left.splice(i, 1);
    if (!friends.some((f) => Math.hypot(f.x - best.x, f.z - best.z) < AIRSTRIKE_RADIUS + 2)) spots.push({ x: best.x, z: best.z });
  }
  return spots;
}

/* A bot fetching its care package: the objective walks it over, standing
   on it runs the owner's capture clock, and the reward goes in its slots
   (a streak bots can't call becomes one they can). */
const BOT_CRATE_GIVE_UP = 25;   // seconds after it lands
function updateBotCrate(b, dt) {
  const e = streakEntities.get(b.crate.eid);
  if (!e || (e instanceof CarePackage && e.claimed)) { b.crate = null; return; }
  if (!(e instanceof CarePackage) || !e.landed) return;   // still the marker, or the heli's inbound
  // Down somewhere it can't get to (a roof, over a wall the marker bounced
  // past): let it go rather than walk at it for the crate's whole life.
  b.crate.t = (b.crate.t || 0) + dt;
  if (b.crate.t > BOT_CRATE_GIVE_UP) { b.crate = null; return; }
  if (!e.withinClaim(b.pos.x, b.pos.z)) { b.crate.holdT = 0; return; }
  b.crate.holdT += dt;
  if (b.crate.holdT < 0.8) return;
  const [kind, arg] = String(e.reward).split(":");
  if (kind === "streak") {
    const callable = BOT_STREAK_POOL.filter((id) => id !== "carepackage" && !(game.currentMode().ffa && BOT_RADAR.has(id)));
    const id = callable.includes(arg) ? arg : callable[Math.floor(Math.random() * callable.length)];
    botStreakState(b).ready.push(id);
  }
  if (game.net.active) game.net.publishStreak({ kind: "carepackage", action: "claimed", eid: e.id });
  e.open();
  game.spawnImpactBurst(new THREE.Vector3(e.x, e.groundY + 0.8, e.z), 0x9dff7a, 16);
  b.crate = null;
}

/* A bot's VTOL Warship, on the bot host: from the gun deck, pick the
   nearest enemy in the clear, rake them with the 25MM in bursts, and drop a
   105MM shell when two or more are bunched up. Aim error scales with the
   bot's skill. The bot dying sends the ship home, as it does for a player. */
const _bwsFrom = new THREE.Vector3(), _bwsDir = new THREE.Vector3(), _bwsAim = new THREE.Vector3();
export function botWarshipGunner(ws, dt) {
  const bot = game.bots.byId(ws.botId);
  if (!bot || !bot.alive) {
    if (ws.age < ws.duration) {
      ws.duration = Math.max(WARSHIP_BOARD_AT, ws.age);
      if (game.net.active) game.net.publishStreak({ kind: "warship", action: "leave", eid: ws.id });
    }
    if (bot && bot.gunning === ws.id) bot.gunning = null;
    return;
  }
  if (!ws.onStation) return;
  ws.gunnerPos(_bwsFrom);
  ws.aiT = (ws.aiT || 0) - dt;
  if (ws.aiT <= 0) {
    ws.aiT = 0.6;
    ws.aiTarget = null;
    const ffa = !!game.currentMode().ffa;
    let bestD = Infinity;
    const consider = (id, pos) => {
      _bwsAim.set(pos.x, pos.y + 0.9, pos.z);
      const d = _bwsFrom.distanceTo(_bwsAim);
      if (d >= bestD) return;
      _bwsDir.copy(_bwsAim).sub(_bwsFrom).divideScalar(d);
      if (raycastWorld(game.colliders, _bwsFrom, _bwsDir, d) < d - 0.6) return;   // under a roof
      bestD = d;
      ws.aiTarget = { id, pos };
    };
    for (const rp of game.remotes.byId.values()) {
      if (!rp.alive || rp.netId === bot.id || (!ffa && rp.team === bot.team)) continue;
      consider(rp.netId, rp.pos);
    }
    if (game.player.alive && (ffa || game.net.team !== bot.team)) consider(game.net.id, game.move.pos);
  }
  const tgt = ws.aiTarget;
  if (!tgt) return;
  // Bursts: ~1.2 s on the trigger, ~0.7 s off, like a person walking it on.
  ws.burstT = (ws.burstT ?? 1.2) - dt;
  if (ws.burstT < -0.7) ws.burstT = 1.2;
  // Anyone else on the bot's hit list within 6 m of the target.
  const ffa = !!game.currentMode().ffa;
  let bunched = 0;
  for (const rp of game.remotes.byId.values()) {
    if (!rp.alive || rp.netId === tgt.id || rp.netId === bot.id || (!ffa && rp.team === bot.team)) continue;
    if (Math.hypot(rp.pos.x - tgt.pos.x, rp.pos.z - tgt.pos.z) < 6) bunched++;
  }
  if (tgt.id !== game.net.id && game.player.alive && (ffa || game.net.team !== bot.team) && Math.hypot(game.move.pos.x - tgt.pos.x, game.move.pos.z - tgt.pos.z) < 6) bunched++;
  const gun = bunched >= 1 && (ws.cannonT = (ws.cannonT || 0) - dt) <= 0 ? "cannon" : "chain";
  if (gun === "chain" && ws.burstT < 0) return;
  if (!ws.tryFire(gun)) return;
  if (gun === "cannon") ws.cannonT = 4;
  const err = (bot.skill === "veteran" ? 0.6 : bot.skill === "recruit" ? 2.2 : 1.3) * (gun === "cannon" ? 1.5 : 1);
  _bwsAim.set(tgt.pos.x + (Math.random() - 0.5) * err, tgt.pos.y + 0.6, tgt.pos.z + (Math.random() - 0.5) * err);
  _bwsDir.copy(_bwsAim).sub(_bwsFrom).normalize();
  let d = raycastWorld(game.colliders, _bwsFrom, _bwsDir, 480);
  if (_bwsDir.y < -1e-3) d = Math.min(d, (0 - _bwsFrom.y) / _bwsDir.y);
  const to = _bwsFrom.clone().addScaledVector(_bwsDir, d);
  ws.shoot(gun, to);
  if (game.net.active) game.net.publishStreak({ kind: "warship", action: "shot", eid: ws.id, g: gun, x: round2(to.x), y: round2(to.y), z: round2(to.z) });
  if (gun === "cannon") game.audio.explosion(0.2, ws.root.position);
  else if (Math.random() < 0.3) game.audio.shot(WEAPON_DEFS.bellow || WEAPON_DEFS.problem416, 0.3, ws.root.position);
}

/* A bot's Dragonfire, on the bot host: pick the nearest enemy it can get
   at, hold a firing spot ~9 m off it and 5 m up, face it, and shoot on the
   bot's own accuracy. No enemy: circle over the bot. The bot dying drops it. */
const _bdfTo = new THREE.Vector3(), _bdfDir = new THREE.Vector3();
export function flyBotDragonfire(e, dt) {
  const bot = game.bots.byId(e.botId);
  if (!bot || !bot.alive) { shootDownAir(e.id, null, true); return; }
  if (!e.launched) { e.fly(dt, { fwd: 0, strafe: 0, up: 0, yaw: e.yaw, pitch: e.pitch }, null, null); return; }
  e.aiT = (e.aiT || 0) - dt;
  if (e.aiT <= 0) {
    e.aiT = 0.5;
    let best = null, bestD = Infinity;
    const ffa = !!game.currentMode().ffa;
    const consider = (id, pos) => {
      const d = pos.distanceTo(e.pos);
      if (d < bestD) { bestD = d; best = { id, pos }; }
    };
    for (const rp of game.remotes.byId.values()) {
      if (!rp.alive || rp.netId === bot.id || (!ffa && rp.team === bot.team)) continue;
      consider(rp.netId, rp.pos);
    }
    if (game.player.alive && streakOwnerHates(bot.team, bot.id)) consider(game.net.id, game.move.pos);
    e.aiTarget = best;
  }
  const t = e.aiTarget;
  let tx, ty, tz, faceYaw;
  if (t) {
    _bdfDir.set(e.pos.x - t.pos.x, 0, e.pos.z - t.pos.z);
    if (_bdfDir.lengthSq() < 1e-3) _bdfDir.set(1, 0, 0);
    _bdfDir.normalize();
    tx = t.pos.x + _bdfDir.x * 9; tz = t.pos.z + _bdfDir.z * 9; ty = t.pos.y + 5;
    faceYaw = Math.atan2(-(t.pos.x - e.pos.x), -(t.pos.z - e.pos.z));
  } else {
    const a = e.age * 0.4;
    tx = bot.pos.x + Math.cos(a) * 10; tz = bot.pos.z + Math.sin(a) * 10; ty = bot.pos.y + 7;
    faceYaw = Math.atan2(-(tx - e.pos.x), -(tz - e.pos.z));
  }
  let dyaw = Math.atan2(Math.sin(faceYaw - e.yaw), Math.cos(faceYaw - e.yaw));
  const yaw = e.yaw + Math.max(-3 * dt, Math.min(3 * dt, dyaw));
  const dx = tx - e.pos.x, dz = tz - e.pos.z, dy = ty - e.pos.y;
  const sn = Math.sin(yaw), cs = Math.cos(yaw);
  const clamp1 = (v) => Math.max(-1, Math.min(1, v));
  const aimPitch = t ? Math.atan2(t.pos.y + 1.1 - e.pos.y, Math.hypot(t.pos.x - e.pos.x, t.pos.z - e.pos.z)) : -0.2;
  e.fly(dt, { fwd: clamp1(-(dx * sn + dz * cs) / 4), strafe: clamp1((dx * cs - dz * sn) / 4), up: clamp1(dy / 2.5), yaw, pitch: aimPitch },
    (from, dir, max) => raycastWorld(game.colliders, from, dir, max),
    (x, z, fromY) => groundHeightAt(game.colliders, x, z, fromY));
  // Fire when it's facing them with a clear line.
  if (!t || Math.abs(dyaw) > 0.3) return;
  const from = e.muzzleWorld(_bdfTo.set(0, 0, 0)).clone();
  const aim = t.pos.clone(); aim.y += 1.1;
  const d = from.distanceTo(aim);
  if (d > DF_RANGE || !e.tryFire()) return;
  _bdfDir.copy(aim).sub(from).divideScalar(d);
  if (raycastWorld(game.colliders, from, _bdfDir, d) < d - 0.5) return;
  const hit = Math.random() < (bot.diff?.hit ?? 0.45) * 0.8;
  const to = hit ? aim : aim.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 2.4));
  e.shoot(to);
  if (game.net.active) game.net.publishStreak({ kind: "dragonfire", action: "shot", eid: e.id, x: round2(to.x), y: round2(to.y), z: round2(to.z) });
  if (Math.random() < 0.35) game.audio.shot(WEAPON_DEFS.bellow || WEAPON_DEFS.problem416, 0.25, e.pos);
  if (hit) streakDamage(bot.id, t.id, DF_DAMAGE, "dragonfire");
}

/* Streak events from someone else. Display and world state only — our own
   meter is never touched from the wire. */
export function applyRemoteStreak(m) {
  switch (m.kind) {
    case "cuav":
      if (m.action === "start") applyCounterUav(m);
      break;

    case "vsat":
      if (m.action === "start") {
        startVsat(m.team, m.duration || STREAK_DEFS.vsat.duration);
        spawnVsatSat(+m.yaw || 0, m.duration || STREAK_DEFS.vsat.duration);
        if (m.team === uavBucket() && !game.currentMode().ffa) showWaveBanner("FRIENDLY VSAT IN ORBIT", 1500);
        else showWaveBanner("ENEMY ORBITAL VSAT — THEY SEE YOU", 1800);
      }
      break;

    case "uav":
      if (m.action === "start") {
        startUav(m.team, m.duration || STREAK_DEFS.uav.duration);
        if (typeof m.x === "number" && typeof m.z === "number") {
          spawnRecon(m.x, m.z, m.yaw || 0, m.duration || STREAK_DEFS.uav.duration, { team: m.team, caller: m.id || null });
        }
        // Only say so when it's our side's UAV — an enemy one reveals us to
        // them, which is not something we'd be told about.
        if (m.team === uavBucket() && !game.currentMode().ffa) {
          showWaveBanner("FRIENDLY UAV OVERHEAD", 1500);
        }
      }
      break;

    case "carepackage":
      if (m.action === "marker" && !streakEntities.has(m.eid)) {
        // Their marker in flight, for show; the drop replaces it.
        const marker = new MarkerCanister({
          id: m.eid, world: droneWorld,
          origin: new THREE.Vector3(m.ox, m.oy, m.oz), dir: new THREE.Vector3(m.dx, m.dy, m.dz),
        });
        streakEntities.set(m.eid, marker);
        game.scene.add(marker.root);
      } else if (m.action === "drop" && !(streakEntities.get(m.eid) instanceof CarePackage)) {
        // Render their crate with the reward THEY rolled; never re-roll.
        spawnCarePackage({
          id: m.eid, x: m.x, z: m.z, groundY: typeof m.y === "number" ? m.y : null,
          reward: m.reward, owned: false, ownerTeam: m.team,
        });
      } else if (m.action === "claimed") {
        // Plays the same pop the opener saw; removed on "gone".
        streakEntities.get(m.eid)?.open();
      }
      break;

    case "drone":
      if (m.action === "launch" && !streakEntities.has(m.eid)) {
        // A copy that flies the same steering at the same target, launched
        // from where the caller's hand was. It hurts nobody here: the owner
        // reports the detonation and every hit.
        let pos;
        if (typeof m.x === "number") pos = new THREE.Vector3(m.x, m.y, m.z);
        else {
          const from = game.net.peers.get(m.id);
          const snap = from?.snaps?.[from.snaps.length - 1];
          pos = snap ? new THREE.Vector3(snap.x, snap.y + 1.4, snap.z) : game.move.pos.clone();
        }
        spawnDrone({ id: m.eid, targetId: m.target || null, owned: false, pos, yaw: m.yaw || 0, sky: !!m.sky, credit: m.credit || "drone" });
        if (m.target && m.target === game.net.id && performance.now() - (applyRemoteStreak.warnAt || 0) > 2500) {
          applyRemoteStreak.warnAt = performance.now();
          showWaveBanner(m.sky ? "SWARM DRONE ON YOU — MOVE" : "HUNTER-KILLER INBOUND — MOVE", 1800);
        }
      } else if (m.action === "retarget") {
        const d = streakEntities.get(m.eid);
        if (d) {
          d.targetId = m.target || null;
          d.frozen = false;
          if (m.target && m.target === game.net.id) showWaveBanner("HUNTER-KILLER INBOUND — MOVE", 1800);
        }
      } else if (m.action === "kill" || m.action === "expire") {
        const d = streakEntities.get(m.eid);
        if (d) {
          // Blow up where the caller's drone did, not wherever our copy got to.
          if (typeof m.x === "number") d.root.position.set(m.x, m.y, m.z);
          game.explosionFx({ kind: "lethal", glow: 0xffa23a, radius: DRONE_SPLASH_RADIUS }, d.root.position);
          streakBlast(d.root.position, m.action === "expire" ? 0.6 : 0.9);
          d.dispose();
          streakEntities.delete(m.eid);
        }
      }
      break;

    case "airstrike":
      // Only the show: the caller resolves the damage and every hit arrives
      // as an ordinary `hit` message. The run is a pure function of the
      // mark, so every client flies the same jet and drops the same bombs.
      if (m.action === "mark") {
        const runs = Array.isArray(m.runs) ? m.runs : [{ x: m.x, z: m.z, delay: m.delay }];
        for (const r of runs) {
          if (typeof r?.x !== "number" || typeof r?.z !== "number") continue;
          spawnAirstrike({ x: r.x, z: r.z, yaw: m.yaw || 0, owned: false, team: m.team, delay: r.delay || AIRSTRIKE_DELAY });
        }
      }
      break;

    case "heli":
      if (m.action === "spawn" && !streakEntities.has(m.eid)) {
        spawnHelicopter({ id: m.eid, seed: m.seed, owned: false, team: m.team });
      } else if (m.action === "despawn") {
        const h = streakEntities.get(m.eid);
        if (h) { h.dispose(); streakEntities.delete(m.eid); }
      }
      break;

    case "k9": {
      let pack = streakEntities.get(m.eid);
      if (m.action === "spawn" && !pack) {
        spawnK9({ id: m.eid, owned: false, team: m.team, ownerId: m.id, x: m.x, y: m.y, z: m.z, yaw: m.yaw || 0, count: m.n || undefined, duration: m.dur || undefined });
        game.audio.whistle({ x: m.x, y: (m.y || 0) + 1.6, z: m.z });   // the handler calling them in
        if (!m.n && (game.currentMode().ffa || !game.net.team || m.team !== game.net.team)) showWaveBanner("ENEMY K9 UNIT — WATCH YOUR BACK", 1800);
      } else if (m.action === "pos") {
        if (!pack && Array.isArray(m.d)) {
          // Joined mid-pack: start the copy from the first dog we're told about.
          const f = m.d.find(Array.isArray);
          if (f) pack = spawnK9({ id: m.eid, owned: false, team: m.team, ownerId: m.id, x: f[0] / 10, y: f[1] / 10, z: f[2] / 10 });
        }
        if (pack instanceof K9Pack && !pack.owned) pack.applySnapshot(m.d);
      } else if (m.action === "hit") {
        if (pack instanceof K9Pack && pack.owned) damageDog(pack, m.i | 0, +m.dmg || 0, m.by);
      } else if (m.action === "die") {
        if (pack instanceof K9Pack) pack.kill(m.i | 0);
        dogKilledBy(m.by);
      } else if (m.action === "end" && pack) {
        pack.dispose();
        streakEntities.delete(m.eid);
      }
      break;
    }

    case "dragonfire": {
      const df = streakEntities.get(m.eid);
      if (m.action === "spawn" && !df) {
        spawnDragonfire({ id: m.eid, owned: false, team: m.team, x: m.x, y: m.y, z: m.z, yaw: m.yaw || 0 });
        if (game.currentMode().ffa || !game.net.team || m.team !== game.net.team) showWaveBanner("ENEMY DRAGONFIRE INBOUND", 1800);
      } else if (df instanceof Dragonfire) {
        if (m.action === "pos") df.applySnapshot(m.x, m.y, m.z, m.yaw || 0, m.p || 0);
        else if (m.action === "shot") {
          df.shoot(new THREE.Vector3(m.x, m.y, m.z));
          if (Math.random() < 0.5) game.audio.shot(WEAPON_DEFS.bellow || WEAPON_DEFS.problem416, 0.3, df.pos);
        } else if (m.action === "end") { df.dispose(); streakEntities.delete(m.eid); }
      }
      break;
    }

    case "sam": {
      const sam = streakEntities.get(m.eid);
      if (m.action === "spawn" && !sam) {
        spawnSam({ id: m.eid, owned: false, team: m.team, x: m.x, y: m.y, z: m.z, yaw: m.yaw || 0 });
        if (game.currentMode().ffa || !game.net.team || m.team !== game.net.team) showWaveBanner("ENEMY SAM TURRET — AIR DEFENSES UP", 1800);
      } else if (sam instanceof SamTurret) {
        if (m.action === "launch") {
          sam.targetId = m.t || null;
          sam.spawnMissile(new THREE.Vector3(m.x, m.y, m.z), new THREE.Vector3(m.dx, m.dy, m.dz), m.t || null);
          const tp = airTargetPos(m.t);
          if (tp) sam.aimAt(tp, 10);
          game.audio.explosion?.(0.1, sam.pos);
        } else if (m.action === "end") { sam.dispose(); streakEntities.delete(m.eid); }
      }
      break;
    }

    case "air": {
      const e = streakEntities.get(m.eid);
      if (m.action === "hit" && e && e.owned) damageStreakEntity(e, +m.dmg || 0, m.by);
      else if (m.action === "hit" && !e) {
        const plane = flyovers.find((f) => f.eid === m.eid);
        if (plane) damageStreakEntity(plane, +m.dmg || 0, m.by, true);
      }
      else if (m.action === "down") shootDownAir(m.eid, m.by);
      break;
    }

    case "warship": {
      const ws = streakEntities.get(m.eid);
      if (m.action === "spawn" && !ws) spawnWarship({ id: m.eid, seed: m.seed, owned: false, team: m.team });
      else if (m.action === "shot" && ws instanceof VtolWarship && WARSHIP_GUNS[m.g]) {
        ws.shoot(m.g, new THREE.Vector3(m.x, m.y, m.z));
        if (m.g === "cannon") game.audio.explosion(0.2, ws.root.position);
        else if (Math.random() < 0.3) game.audio.shot(WEAPON_DEFS.bellow || WEAPON_DEFS.problem416, 0.3, ws.root.position);
      } else if (m.action === "leave" && ws instanceof VtolWarship) ws.duration = Math.min(ws.duration, ws.age);
      break;
    }

    case "callout":
      // Match-wide hype: the nuclear-tier badge and the big streaks arriving.
      // Purely cosmetic, never gameplay. A bot on our own side (its call
      // carries `team`) gets a quiet line, not the big red banner: with a
      // dozen bots calling things it was all you saw.
      if (m.team && !game.currentMode().ffa && m.team === game.net.team) {
        showWaveBanner(`${m.who || "Ally"}: ${m.label}`, 1100);
        break;
      }
      killstreakUi.banner({ title: `${m.who || "Someone"}: ${m.label}`, sub: m.label === "NUCLEAR" ? "Went nuclear" : "Scorestreak inbound", label: m.label === "NUCLEAR" ? "Nuclear" : "Streak", tone: "red" });
      killstreakUi.pulse();
      break;
  }
}

/* What used to run at load in game.js: called from game.js where this code was. */
export function initBotStreaks() {
  try { if (game.els.botStreaks && localStorage.getItem(BOT_STREAK_KEY) === "0") game.els.botStreaks.checked = false; } catch { /* private window */ }
  game.els.botStreaks?.addEventListener("change", () => {
    try { localStorage.setItem(BOT_STREAK_KEY, game.els.botStreaks.checked ? "1" : "0"); } catch { /* private window */ }
  });
}
