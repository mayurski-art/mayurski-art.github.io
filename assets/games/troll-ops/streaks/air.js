// Troll Forces scorestreaks in the air and on the ground each frame: the
// Swarm, UAV and Counter-UAV, care package claims, and the per-frame update
// of every live streak. Moved out of game.js (split phase 1).

import { STREAK_DEFS } from "../scorestreaks.js?v=umb1-wst-sb2-fu1-wb1";
import { streakEntities, flyovers, streaks, streakKeyLabel, uavBucket, uavUntil, lockStreak, streakLockUntil, enemiesRevealed, updateMarking, updateStreakControl, pendingStrikes, blastFx, streakBlast } from "./calling.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1";
import { HunterDrone, ReconPlane, MarkerCanister, CarePackage, VtolWarship, HelicopterGunship, HELI_DAMAGE, PKG_CRUSH_RADIUS, AIRSTRIKE_RADIUS, AIRSTRIKE_DAMAGE, AIRSTRIKE_BOMBS, DRONE_SPLASH_RADIUS, DRONE_DAMAGE, HELI_FIRE_RANGE } from "../streak-entities.js?v=vsat2-hk1";
import { streakBounds, spawnDrone, round2, attachAirHitbox, AIR_HP, spawnCarePackage, strikeTablet, droneTargetPos, pickDroneTarget, droneAirTarget, droneWorld, DRONE_AIR_SPEED, droneLeadPoint, DRONE_AIR_REACH } from "./fire.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1";
import * as THREE from "three";
import { showWaveBanner, updateStreakHud } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1";
import { resolveWeapon, defaultLoadoutFor } from "../attachments.js?v=cg1-wst-sb2-fu1-wb1";
import { WeaponState, WEAPON_DEFS } from "../weapons.js?v=p5bm-wst-hf1-fu1-wb1";
import { K9Pack } from "../k9-unit.js?v=k9c-bs1-sb2-gj1b7b7d";
import { updateK9 } from "./k9.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1";
import { Dragonfire } from "../dragonfire.js?v=df3-sb2";
import { dragonfireView, updateSamAi, airTargetPos, samMissileHit, syncDragonfireView, shootDownAir } from "./dragonfire.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1";
import { touchState } from "../input/touch.js?v=in1";
import { raycastWorld } from "../ballistics.js?v=cg1-wst-hf1-fu1b7-wb1";
import { groundHeightAt } from "../movement.js?v=umb2-sb2-gj1b7";
import { SamTurret } from "../sam-turret.js?v=sam1";
import { warshipImpact, syncWarshipView, updateWarshipHud } from "./warship.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1";
import { game } from "../core/state.js?v=st1";

/* The Swarm: Hunter-Killers diving in from the map's edge, one after
   another, each after its own enemy, until the count or the clock runs out. */
export const swarmRuns = [];
const SWARM_MAX_ALIVE = 6;
let swarmSeq = 0;

function updateSwarms(dt) {
  const def = STREAK_DEFS.swarm;
  for (let i = swarmRuns.length - 1; i >= 0; i--) {
    const s = swarmRuns[i];
    s.t += dt;
    if (s.t > def.duration || s.sent >= def.count) { swarmRuns.splice(i, 1); continue; }
    if (s.t < s.next) continue;
    // Whose run: ours, or a bot's we host (`botId`, `team`).
    const team = s.botId ? s.team : game.net.team;
    let alive = 0;
    const onTarget = new Map();
    for (const e of streakEntities.values()) {
      if (!(e instanceof HunterDrone) || !e.owned || !e.sky || e.frozen || (e.botId || null) !== (s.botId || null)) continue;
      alive++;
      if (e.targetId) onTarget.set(e.targetId, (onTarget.get(e.targetId) || 0) + 1);
    }
    if (alive >= SWARM_MAX_ALIVE) continue;
    // Spread them out: whoever has the fewest drones on them already.
    const ffa = game.currentMode().ffa;
    let victim = null, best = Infinity;
    for (const rp of game.remotes.byId.values()) {
      if (!rp.alive || rp.netId === s.botId) continue;
      if (!ffa && team && rp.team === team) continue;
      const score = (onTarget.get(rp.netId) || 0) + Math.random() * 0.5;
      if (score < best) { best = score; victim = rp; }
    }
    if (streakOwnerHates(team, s.botId)) {
      const score = (onTarget.get(game.net.id) || 0) + Math.random() * 0.5;
      if (score < best) { best = score; victim = { netId: game.net.id, pos: game.move.pos }; }
    }
    if (!victim) { s.next = s.t + 0.5; continue; }
    s.next = s.t + def.duration / def.count;
    s.sent++;
    launchSwarmDrone(victim, s);
  }
}

function launchSwarmDrone(victim, run = null) {
  const b = streakBounds();
  const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  const r = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) * 0.5;
  // In over the edge on the victim's far side-ish, high above the rooftops.
  const a = Math.atan2(victim.pos.z - cz, victim.pos.x - cx) + Math.PI + (Math.random() - 0.5) * 2.2;
  const pos = new THREE.Vector3(cx + Math.cos(a) * r, 30 + Math.random() * 10, cz + Math.sin(a) * r);
  const yaw = Math.atan2(-(victim.pos.x - pos.x), -(victim.pos.z - pos.z));
  const id = `streak-swarm-${game.net.id}-${Math.round(performance.now())}-${++swarmSeq}`;
  const e = spawnDrone({ id, targetId: victim.netId, owned: true, pos, yaw, sky: true, credit: "swarm" });
  if (run?.botId) { e.botId = run.botId; e.botTeam = run.team; }
  if (game.net.active) {
    game.net.publishStreak({
      kind: "drone", action: "launch", eid: id, target: victim.netId, sky: 1, credit: "swarm",
      x: round2(pos.x), y: round2(pos.y), z: round2(pos.z), yaw: round2(yaw),
    });
  }
}

/* UAV's world presence: a spotter plane circling the map for the UAV's
   duration (ReconPlane). Purely decorative — enemiesRevealed()/uavUntil own
   the reveal; the heading just seeds where on the orbit it comes in. */
export function spawnRecon(x, z, yaw, duration = STREAK_DEFS.uav.duration, { team = null, counter = false, caller = null } = {}) {
  const bounds = game.builtMap?.map?.bounds || game.ARENA;
  const plane = new ReconPlane({ bounds, yaw, duration, counter });
  plane.team = team;
  // The same id on every client (from the call's rounded x and yaw, which
  // is what the wire carries), so a SAM Turret can shoot one down for all.
  plane.eid = `recon:${counter ? 1 : 0}:${Math.round(yaw * 100)}:${Math.round(x * 100)}`;
  plane.caller = caller;
  attachAirHitbox(plane, 2.8, AIR_HP.recon);
  flyovers.push(plane);
  game.scene.add(plane.root);
  return plane;
}

/* Nearest living enemy, for the drone's target pick. Bots and peers both live
   in remotes, so one pass covers them. */
export function nearestHostileTo(from) {
  let best = null, bestD = Infinity;
  const ffa = game.currentMode().ffa;
  for (const rp of game.remotes.byId.values()) {
    if (!rp.alive) continue;
    if (!ffa && game.net.team && rp.team === game.net.team) continue;
    const d = from.distanceTo(rp.pos);
    if (d < bestD) { bestD = d; best = rp; }
  }
  return best;
}

/* Open a landed package: apply the reward it was created with. */
export function claimPackage(pkg) {
  pkg.claimed = true;
  const [kind, arg] = String(pkg.reward).split(":");

  if (kind === "ammo") {
    for (const w of Object.values(game.player.weapons)) {
      w.ammoReserve = w.def.reserveMax - w.def.magSize;
      w.ammoInMag = w.def.magSize;
    }
    game.player.gear.lethal = game.loadout.carried("lethal");
    game.player.gear.tactical = game.loadout.carried("tactical");
    showWaveBanner("RESUPPLIED", 1500);
  } else if (kind === "weapon") {
    const def = resolveWeapon(arg, defaultLoadoutFor(arg));
    if (def) {
      game.player.secondaryId = def.id;
      game.player.weapons[def.id] = new WeaponState(def);
      game.currentWeaponSlot = "secondary";
      game.setActiveWeaponMesh(def);
      game.setHolding("gun");
      showWaveBanner(`PACKAGE — ${def.name.toUpperCase()}`, 1600);
    }
  } else if (kind === "streak") {
    streaks.grant(arg);
    game.selectedStreak = arg;
    // Banked, never fired for you: it sits in its slot, pulsing, until you
    // call it. A short guard stops the same press (or a stray tap on the
    // slot that just appeared) from calling it on the spot.
    game.streakCallGuardUntil = performance.now() + 900;
    game.freshStreak = { id: arg, until: performance.now() + 5000 };
    setTimeout(updateStreakHud, 5100);   // the pulse ends
        updateStreakHud();
    showWaveBanner(`${STREAK_DEFS[arg]?.name.toUpperCase() || "STREAK"} READY — ${game.isTouch ? "TAP IT TO CALL" : `PRESS ${streakKeyLabel(arg).toUpperCase()}`}`, 2200);
  }

  game.audio.reload();
  if (game.net.active) game.net.publishStreak({ kind: "carepackage", action: "claimed", eid: pkg.id });
  // Pops open, then updateStreakEntities drops it on "gone".
  pkg.open();
  game.spawnImpactBurst(new THREE.Vector3(pkg.x, pkg.groundY + 0.8, pkg.z), 0x9dff7a, 16);
}

/* Someone else's Counter-UAV. From the enemy: our minimap scrambles, our
   side's UAV (and its plane) goes down, and if that UAV was ours we can't
   call another for the lockout. In free-for-all everyone else is the enemy. */
export function applyCounterUav(m) {
  const def = STREAK_DEFS.counteruav;
  const dur = m.duration || def.duration;
  if (typeof m.x === "number" && typeof m.z === "number") {
    spawnRecon(m.x, m.z, m.yaw || 0, dur, { counter: true, team: m.team, caller: m.id || null });
  }
  const enemy = game.currentMode().ffa || !game.net.team || m.team !== game.net.team;
  if (!enemy) { showWaveBanner("FRIENDLY COUNTER-UAV", 1500); return; }
  const now = performance.now();
  game.jammedUntil = Math.max(game.jammedUntil, now + dur * 1000);
  const mine = uavBucket();
  uavUntil[mine] = 0;
  uavWasUp = false;   // our own banner below says why, not "UAV OFFLINE"
  for (const f of flyovers) if (f.team === mine && !f.counter) f.cutShort();
  if (game.myUavUntil > now) {
    game.myUavUntil = 0;
    const secs = m.lockout || def.lockout;
    lockStreak("uav", secs, "jammed");
    showWaveBanner(`UAV SHOT DOWN · NO UAV FOR ${secs}s`, 2200);
  } else {
    showWaveBanner("ENEMY COUNTER-UAV · RADAR JAMMED", 1800);
  }
}

export function startUav(team, duration) {
  if (!team) return;
  const until = performance.now() + duration * 1000;
  // A second UAV extends rather than restarts, so stacking two isn't a
  // downgrade for whoever called the first.
  uavUntil[team] = Math.max(uavUntil[team] || 0, until);
}

/* Say when our radar drops, so losing it reads as the UAV expiring rather
   than the minimap breaking. */
let uavWasUp = false;
export function updateUavState() {
  // Lockout countdowns tick on the HUD (the signature stops redundant rebuilds).
  if (Object.keys(streakLockUntil).length) updateStreakHud();
  const up = enemiesRevealed();
  if (uavWasUp && !up) showWaveBanner("UAV OFFLINE", 1200);
  uavWasUp = up;
}

/* Everything a live streak does per frame. Only the owner resolves damage and
   outcomes; a rendered copy just animates. */
export function updateStreakEntities(dt) {
  updateMarking();

  for (const [id, e] of [...streakEntities]) {
    if (e instanceof MarkerCanister) {
      if (e.update(dt) === "rest" && e.owned) {
        // Settled: call the drop right here, for everyone.
        const p = e.pos;
        // One of our bots' (botId): its side owns the crate, and it comes for it.
        const team = e.botId ? e.botTeam : game.net.team;
        const pkg = spawnCarePackage({ id, x: p.x, z: p.z, groundY: e.floor, reward: e.reward, owned: true, ownerTeam: team });
        if (e.botId) pkg.botId = e.botId;
        if (game.net.active) {
          game.net.publishStreak({
            kind: "carepackage", action: "drop",
            eid: id, x: round2(p.x), z: round2(p.z), y: round2(e.floor), reward: e.reward, team,
          });
        }
        if (!e.botId) showWaveBanner("CARE PACKAGE INBOUND", 1800);
      } else if (!e.owned && e.age > 12) { e.dispose(); streakEntities.delete(id); }
      continue;
    }

    if (e instanceof CarePackage) {
      const out = e.update(dt);
      if (out === "landed") {
        // Slams into the dirt: dust, a thud, a shake up close — and anyone
        // under it is flattened (the caller decides; BO2 crates kill).
        const at = new THREE.Vector3(e.x, e.groundY + 0.05, e.z);
        game.impactFx.hit(at, { normal: new THREE.Vector3(0, 1, 0), dir: new THREE.Vector3(0, -1, 0), surface: "ground", scale: 5 });
        game.audio.explosion(0.4, at);
        const near = Math.max(0, 1 - at.distanceTo(game.player.pos) / 14);
        if (near > 0) { game.shakeMag = Math.max(game.shakeMag, near * 0.05); game.shakeT = 0.3; }
        if (e.owned) crushUnderPackage(e);
      }
      if (out === "gone" || e.expired) { e.dispose(); streakEntities.delete(id); }
      continue;
    }

    if (e instanceof HunterDrone) {
      updateDrone(id, e, dt);
      continue;
    }

    if (e instanceof K9Pack) {
      updateK9(id, e, dt);
      continue;
    }

    if (e instanceof Dragonfire) {
      if (e.owned && e.botId) {
        game.flyBotDragonfire(e, dt);
        if (e.dead) continue;
      } else if (e.owned && e === game.dragonfire && dragonfireView()) {
        const up = ((game.isTouch && touchState.jump) || (game.gamepadState.connected && game.gamepadState.jump) || game.keys.has("Space") ? 1 : 0)
          - ((game.isTouch && touchState.crouch) || (game.gamepadState.connected && game.gamepadState.crouch) || game.keys.has("KeyC") || game.keys.has("ControlLeft") ? 1 : 0);
        e.fly(dt, { fwd: game.dfIz, strafe: game.dfIx, up, yaw: game.look.yaw, pitch: game.look.pitch, followPitch: true },
          (from, dir, max) => raycastWorld(game.colliders, from, dir, max),
          (x, z, fromY) => groundHeightAt(game.colliders, x, z, fromY));
      } else if (e.owned && !e.launched) {
        e.fly(dt, { fwd: 0, strafe: 0, up: 0, yaw: e.yaw, pitch: e.pitch }, null, null);
      }
      if (e.owned && game.net.active && (game.dfSendT -= dt) <= 0) {
        game.dfSendT = 1 / 12;
        game.net.publishStreak({ kind: "dragonfire", action: "pos", eid: e.id, x: round2(e.pos.x), y: round2(e.pos.y), z: round2(e.pos.z), yaw: round2(e.yaw), p: round2(e.pitch) });
      }
      const out = e.update(dt);
      if (out === "expire") {
        if (e.owned && game.net.active && e.hp > 0) game.net.publishStreak({ kind: "dragonfire", action: "end", eid: e.id });
        if (e === game.dragonfire) game.dragonfire = null;
        const pilot = e.botId && game.bots.byId(e.botId);
        if (pilot && pilot.piloting === e.id) pilot.piloting = null;
        e.dispose();
        streakEntities.delete(id);
      }
      continue;
    }

    if (e instanceof SamTurret) {
      if (e.owned) updateSamAi(e, dt);
      const hits = e.updateMissiles(dt, airTargetPos);
      for (const h of hits) {
        game.explosionFx({ kind: "lethal", glow: 0xffc070, radius: 2.5 }, h.at);
        if (e.owned && h.targetId && airTargetPos(h.targetId)) samMissileHit(e, h.targetId);
      }
      const out = e.update(dt);
      if (out === "expire") {
        if (e.owned && game.net.active && e.hp > 0) game.net.publishStreak({ kind: "sam", action: "end", eid: e.id });
        e.dispose();
        streakEntities.delete(id);
      }
      continue;
    }

    if (e instanceof VtolWarship) {
      if (e.owned && e.botId) game.botWarshipGunner(e, dt);
      const landed = [];
      const out = e.update(dt, landed);
      for (const r of landed) warshipImpact(e, r);
      if (out === "expire") {
        if (e === game.warship) game.warship = null;
        e.dispose();
        streakEntities.delete(id);
      }
      continue;
    }

    if (e instanceof HelicopterGunship) {
      let aim = null;
      if (e.onStation) {
        const victim = gunshipTarget(e);
        if (victim) {
          aim = victim.chest;
          if (e.tryFire()) {
            gunshipShotFx(e, victim.chest);
            // Only the caller's copy deals damage; the hit reaches everyone
            // else as an ordinary hit message.
            if (e.owned && e.botId) streakDamage(e.botId, victim.rp ? victim.rp.netId : game.net.id, HELI_DAMAGE, "heli");
            else if (e.owned && victim.rp) dealDamageToRemote(victim.rp, HELI_DAMAGE, "heli");
          }
        }
      }
      const out = e.update(dt, aim);
      if (out === "expire") {
        if (e.owned && game.net.active) game.net.publishStreak({ kind: "heli", action: "despawn", eid: id });
        e.dispose();
        streakEntities.delete(id);
      }
      continue;
    }
  }
  updateDroneLock();
  updateSwarms(dt);
  syncWarshipView();
  updateWarshipHud();
  syncDragonfireView();
  updateStreakControl(dt);
  strikeTablet?.update(dt);

  // Lightning strikes: each run plays its own timeline (smoke, jet, bombs)
  // and reports every bomb the frame it lands.
  for (let i = pendingStrikes.length - 1; i >= 0; i--) {
    const s = pendingStrikes[i];
    for (const bi of s.update(dt)) strikeImpact(s, s.bombs[bi].at);
    if (s.done) { s.dispose(); pendingStrikes.splice(i, 1); }
  }

  // Recon planes: fly, then age out. They own no reveal, so there's nothing
  // to report back over the wire when they expire.
  for (let i = flyovers.length - 1; i >= 0; i--) {
    const f = flyovers[i];
    if (f.update(dt) === "expire") {
      f.dispose();
      flyovers.splice(i, 1);
    }
  }

  blastFx?.update(dt);
}

/* A crate landing on someone. Only the caller's copy runs this. */
function crushUnderPackage(pkg) {
  const at = new THREE.Vector3(pkg.x, pkg.groundY, pkg.z);
  if (pkg.botId) {
    // A bot's crate: the bot's kill, and it spares the bot's own side.
    const bot = game.bots.byId(pkg.botId);
    if (!bot) return;
    const ffa = !!game.currentMode().ffa;
    const under = (p) => Math.hypot(p.x - pkg.x, p.z - pkg.z) <= PKG_CRUSH_RADIUS && Math.abs(p.y - pkg.groundY) <= 2.5;
    for (const rp of game.remotes.byId.values()) {
      if (rp.alive && rp.netId !== bot.id && (ffa || rp.team !== bot.team) && under(rp.pos)) game.botDealDamage(bot, rp.netId, 400, false, "carepackage");
    }
    if (game.player.alive && (ffa || game.net.team !== bot.team) && under(game.move.pos)) game.botDealDamage(bot, game.net.id, 400, false, "carepackage");
    return;
  }
  for (const rp of game.remotes.byId.values()) {
    if (!rp.alive) continue;
    if (Math.hypot(rp.pos.x - pkg.x, rp.pos.z - pkg.z) > PKG_CRUSH_RADIUS) continue;
    if (Math.abs(rp.pos.y - pkg.groundY) > 2.5) continue;
    dealDamageToRemote(rp, 400, "carepackage");
  }
  if (game.player.alive && Math.hypot(game.move.pos.x - pkg.x, game.move.pos.z - pkg.z) <= PKG_CRUSH_RADIUS
    && Math.abs(game.move.pos.y - at.y) < 2.5) {
    game.damagePlayer(400, game.net.id, "carepackage");
  }
}

/* One bomb of a Lightning Strike landing. Only the caller does damage. */
export function strikeImpact(s, at) {
  game.explosionFx({ kind: "lethal", glow: 0xffb347, radius: AIRSTRIKE_RADIUS }, at);
  streakBlast(at, 1.3);
  game.impactFx.hit(at, { normal: new THREE.Vector3(0, 1, 0), surface: "ground", scale: 4 });
  if (s.owned) {
    game.areaDamage(at, AIRSTRIKE_RADIUS * 0.6,
      AIRSTRIKE_DAMAGE / AIRSTRIKE_BOMBS * 2,
      { id: "airstrike", radius: AIRSTRIKE_RADIUS * 0.6, minDamage: 20, selfMult: 1 },
      { creditAs: "airstrike", botId: s.botId || null });
  }
}

/* One hunter-killer's frame. The caller's copy re-acquires a target when
   its one dies and decides the detonation; everyone else's copy flies the
   same steering at the same target and waits for the caller's word. */
function updateDrone(id, e, dt) {
  if (e.owned && e.age > 0.3 && !droneTargetPos(e.targetId)) {
    const next = pickDroneTarget(e.root.position, 0, e.botId ? { team: e.botTeam, botId: e.botId } : undefined);
    const nextId = next?.netId || null;
    if (nextId !== e.targetId) {
      e.targetId = nextId;
      if (next && !e.sky && !e.botId) showWaveBanner(`HUNTER-KILLER — RETARGETED ${String(next.peer?.name || "").toUpperCase()}`, 1400);
      if (game.net.active) game.net.publishStreak({ kind: "drone", action: "retarget", eid: id, target: nextId });
    }
  }
  const plane = droneAirTarget(e.targetId);
  droneWorld.air = !!plane;
  droneWorld.speedMul = plane ? DRONE_AIR_SPEED : 1;
  droneWorld.target = plane ? droneLeadPoint(e.root.position, plane) : droneTargetPos(e.targetId);
  // Close enough to the plane itself (the lead point runs ahead of it).
  const out = plane && e.age > 0.3 && !e.frozen && e.root.position.distanceTo(plane.root.position) <= DRONE_AIR_REACH
    ? (e.done = true, "hit") : e.update(dt, droneWorld);
  droneWorld.air = false;
  droneWorld.speedMul = 1;
  if (!out) {
    // A copy that thought it arrived gives up if the owner never says so.
    if (e.frozen && e.age - e.frozenAt > 2) { e.dispose(); streakEntities.delete(id); }
    return;
  }
  if (!e.owned) {
    e.done = false;
    e.frozen = true;
    e.frozenAt = e.age;
    return;
  }
  detonateDrone(e, out);
  if (game.net.active) {
    const p = e.root.position;
    game.net.publishStreak({
      kind: "drone", action: out === "expire" ? "expire" : "kill", eid: id,
      x: round2(p.x), y: round2(p.y), z: round2(p.z),
    });
  }
  e.dispose();
  streakEntities.delete(id);
}

/* The warhead going off, on the caller's copy: a direct hit on the target it
   reached, then the blast for everyone else in range — the caller included,
   if they flew it into their own feet (the user asked for that). */
function detonateDrone(e, out) {
  const at = e.root.position.clone();
  // Reached an enemy UAV / Counter-UAV: it comes down for everyone, credited
  // like a SAM kill (the jam or reveal ends with it).
  if (out === "hit" && droneAirTarget(e.targetId)) {
    game.explosionFx({ kind: "lethal", glow: 0xffa23a, radius: 3 }, at);
    shootDownAir(e.targetId, e.botId || game.net.id, true);
    return;
  }
  game.explosionFx({ kind: "lethal", glow: 0xffa23a, radius: DRONE_SPLASH_RADIUS }, at);
  streakBlast(at, out === "expire" ? 0.6 : 0.9);
  // Damage goes through the ordinary hit path, so a drone kill credits and
  // killfeeds exactly like a bullet one. A bot's drone can be hitting us.
  if (out === "hit" && e.targetId && (e.botId || e.targetId !== game.net.id)) {
    streakDamage(e.botId, e.targetId, DRONE_DAMAGE, e.credit);
  }
  game.areaDamage(at, DRONE_SPLASH_RADIUS, out === "expire" ? DRONE_DAMAGE * 0.5 : DRONE_DAMAGE * 0.8,
    { id: e.credit, radius: DRONE_SPLASH_RADIUS, minDamage: 20, selfMult: e.sky || e.botId ? 0 : 1 },
    { creditAs: e.credit, botId: e.botId || null });
}

/* A red lock bracket over whatever our hunter-killer is chasing, so you can
   see the homing work. One at a time: the newest drone wins. */
export let lockEl = null;
function updateDroneLock() {
  let drone = null;
  for (const e of streakEntities.values()) {
    if (e instanceof HunterDrone && e.owned && !e.botId && !e.frozen) drone = e;
  }
  const target = drone ? droneTargetPos(drone.targetId) : null;
  if (!target) { if (lockEl) lockEl.hidden = true; return; }
  if (!lockEl) {
    lockEl = document.createElement("div");
    lockEl.className = "to-hk-lock";
    lockEl.setAttribute("aria-hidden", "true");
    lockEl.innerHTML = "<i></i><span>LOCKED</span>";
    (game.els.streakMark?.parentElement || document.body).appendChild(lockEl);
  }
  const p = new THREE.Vector3(target.x, target.y + 1.1, target.z).project(game.camera);
  const onScreen = p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1;
  lockEl.hidden = !onScreen;
  if (!onScreen) return;
  const host = lockEl.parentElement.getBoundingClientRect();
  lockEl.style.left = `${((p.x + 1) / 2) * host.width}px`;
  lockEl.style.top = `${((1 - p.y) / 2) * host.height}px`;
  const dist = drone.root.position.distanceTo(target);
  lockEl.classList.toggle("is-close", dist < 12);
}

/* What a gunship shoots at: the nearest hostile it has a clear line to. On
   copies it can be us (hostile side), so we see it coming even though the
   damage arrives from the caller. */
const _heliDir = new THREE.Vector3();
function gunshipTarget(e) {
  const muzzle = e.muzzle;
  const ffa = game.currentMode().ffa;
  let best = null, bestD = HELI_FIRE_RANGE;
  const consider = (pos, rp) => {
    const chest = new THREE.Vector3(pos.x, pos.y + 1.1, pos.z);
    const d = muzzle.distanceTo(chest);
    if (d >= bestD) return;
    _heliDir.copy(chest).sub(muzzle).divideScalar(d);
    if (raycastWorld(game.colliders, muzzle, _heliDir, d) < d - 0.4) return;   // roof or wall in the way
    bestD = d;
    best = { chest, rp };
  };
  for (const rp of game.remotes.byId.values()) {
    if (!rp.alive || rp.netId === e.botId) continue;
    if (!ffa && e.team && rp.team === e.team) continue;
    consider(rp.pos, rp);
  }
  // Someone else's, or one of our bots' on the other side: we're a target.
  if ((!e.owned || e.botId) && game.player.alive && (ffa || !e.team || e.team !== game.net.team)) consider(game.move.pos, null);
  return best;
}

/* The chin gun firing: tracers you can follow from the nose to the target,
   a muzzle puff, and the heaviest gun report in the game. */
function gunshipShotFx(e, aimAt) {
  const muzzle = e.muzzle;
  const def = WEAPON_DEFS.bellow || WEAPON_DEFS.problem416;
  for (let i = 0; i < 2; i++) {
    const d = aimAt.clone().sub(muzzle).normalize();
    d.x += (Math.random() - 0.5) * 0.035;
    d.y += (Math.random() - 0.5) * 0.035;
    d.z += (Math.random() - 0.5) * 0.035;
    d.normalize();
    game.bullets.spawn({ origin: muzzle.clone().addScaledVector(d, 0.4), dir: d, def, ownerId: "remote", cosmetic: true });
  }
  game.spawnImpactBurst(muzzle, 0xffd166, 5);
  game.impactFx.puff(muzzle, aimAt.clone().sub(muzzle).normalize(), 1.5);
  game.audio.shot(def, 0.45, e.root.position);
}

/* Nearest living enemy of a given team, within range. The gunship is not a
   player, so it can't use net.team — it carries whose side it's on. */
function nearestHostileToTeam(from, team, maxDist = Infinity) {
  let best = null, bestD = maxDist;
  const ffa = game.currentMode().ffa;
  for (const rp of game.remotes.byId.values()) {
    if (!rp.alive) continue;
    if (!ffa && team && rp.team === team) continue;
    const d = from.distanceTo(rp.pos);
    if (d < bestD) { bestD = d; best = rp; }
  }
  // In free-for-all the caller is fair game to nobody but themselves, so the
  // gunship simply never targets its owner.
  return best;
}

/* Apply streak damage to a remote actor through the existing paths, so kill
   credit, the killfeed and assists all behave as they do for gunfire. */
function dealDamageToRemote(rp, damage, weaponId) {
  // RemotePlayer carries its id as `netId` — there is no `rp.id`. Reading
  // that silently sent every gunship round, HK direct hit and crate crush
  // to nobody.
  const id = rp.netId;
  const bot = game.bots.byId(id);
  if (bot) {
    const { killed } = game.bots.applyHit(id, damage);
    game.noteDealt(id, damage);
    if (killed) {
      game.dealtLog.delete(id);
      game.net.reportDeathAs(id, game.net.id, weaponId, false);
      game.registerDeath(bot.name, game.net.id, weaponId, {
        victimTeam: bot.team, victimPos: bot.pos, victimWeaponId: bot.weaponId,
        victimId: bot.id, victimIsBot: true,
      });
    }
    return;
  }
  game.noteDealt(id, damage);
  game.net.reportHit(id, damage, false, weaponId);
}

/* Streak damage from whoever owns the streak: us (the old path above), or a
   bot we host (its own gun's path, so the kill, killfeed and team score
   credit the bot, and the local player can be the one hit). */
export function streakDamage(botId, targetId, damage, weaponId) {
  if (botId) {
    // A bot that has since left takes its streak's damage with it.
    const bot = game.bots.byId(botId);
    if (bot) game.botDealDamage(bot, targetId, damage, false, weaponId);
    return;
  }
  const rp = game.remotes.byId.get(targetId);
  if (rp && rp.alive) dealDamageToRemote(rp, damage, weaponId);
}

/* A hostile of a streak's owner, as a target: the local player counts when
   the owner is one of our bots on the other side. */
export function streakOwnerHates(team, botId) {
  if (!botId || !game.player.alive) return false;
  return !!game.currentMode().ffa || !team || team !== game.net.team;
}
