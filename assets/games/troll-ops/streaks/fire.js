// Troll Forces scorestreaks, firing them: the Dragonfire sky check, the care
// package marker and crate, hunter-killer drones and their routing, the
// Lightning Strike tablet and airstrikes, the gunship. Moved out of game.js
// (split phase 1).

import * as THREE from "three";
import { raycastWorld } from "../ballistics.js?v=cg1-wst-hf1";
import { streaks, cancelMark, streakEntities, readyStreaksOrdered, lockStreak, uavBucket, startVsat, spawnVsatSat, achievements, flyovers, enemiesRevealed, pendingStrikes } from "./calling.js?v=sk1";
import { MarkerCanister, CarePackage, HunterDrone, DRONE_SPEED, ReconPlane, AIRSTRIKE_DELAY, AIRSTRIKE_RADIUS, AirstrikeRun, HelicopterGunship } from "../streak-entities.js?v=vsat2-hk1";
import { THROW_TIME } from "../character.js?v=to-hb4-em1-fc1-wst-soc1-ww1";
import { updateStreakHud, showWaveBanner } from "../core/hud.js?v=cr1";
import { STREAK_DEFS, PACKAGE_STREAK_POOL, streakIconSvg } from "../scorestreaks.js?v=umb1-wst-sb2";
import { groundHeightAt } from "../movement.js?v=umb2-sb2";
import { FlowField } from "../nav.js?v=ti1-bs1";
import { StrikeTablet, STRIKE_TARGETS } from "../streak-tablet.js?v=wu1";
import { K9Pack } from "../k9-unit.js?v=k9c-bs1-sb2";
import { game } from "../core/state.js?v=st1";

/* ---- Dragonfire needs open sky ----------------------------------------
   A quadrotor can't launch from inside a house or a tunnel (user): it
   needs sky overhead and room around you. Covered = anything solid within
   DF_SKY_UP straight up; confined = most of DF_SKY_RAYS level rays meet a
   wall within DF_SKY_SIDE (a room, a corridor, a container). The houses on
   Cul-de-Grin have walls but no roof collider, which is why the walls count
   on their own. Rays leave from DF_SKY_FROM up: over fences and waist-high
   cover (the street's median fence read as a roof from 1.5 m), under any
   real ceiling. Checked a few times a second, and only while a Dragonfire
   is ready. */
const DF_SKY_UP = 14, DF_SKY_SIDE = 12, DF_SKY_RAYS = 12, DF_SKY_BLOCKED = 9, DF_SKY_FROM = 2.0;
const dfSky = { t: 0, why: null };
const _skyFrom = new THREE.Vector3();
const _skyDir = new THREE.Vector3();
export function dragonfireSkyCheck(pos) {
  _skyFrom.set(pos.x, pos.y + DF_SKY_FROM, pos.z);
  if (raycastWorld(game.colliders, _skyFrom, _skyDir.set(0, 1, 0), DF_SKY_UP) < DF_SKY_UP - 1e-3) return "covered";
  let blocked = 0;
  for (let i = 0; i < DF_SKY_RAYS; i++) {
    const a = (i / DF_SKY_RAYS) * Math.PI * 2;
    if (raycastWorld(game.colliders, _skyFrom, _skyDir.set(Math.sin(a), 0, Math.cos(a)), DF_SKY_SIDE) < DF_SKY_SIDE - 1e-3) blocked++;
  }
  return blocked >= DF_SKY_BLOCKED ? "confined" : null;
}
/* Why the Dragonfire can't launch from here right now, or null. */
export function dragonfireBlocked() {
  const now = performance.now();
  if (now - dfSky.t > 250) { dfSky.t = now; dfSky.why = game.player.alive ? dragonfireSkyCheck(game.move.pos) : null; }
  return dfSky.why;
}
export const DF_BLOCK_TEXT = { covered: "NEEDS OPEN SKY", confined: "TOO CONFINED" };

/* Throw the care package marker we're holding. It spends the streak, lobs
   a canister that bounces and settles, and the drop is called where it
   stops (see updateStreakEntities / MarkerCanister). */
export function throwMarker() {
  if (game.markingStreak !== "carepackage" || !game.player.alive || game.markerThrowT > 0) return;
  if (!streaks.spend("carepackage")) { cancelMark(); return; }
  game.markingStreak = null;
  if (game.els.streakMark) game.els.streakMark.hidden = true;

  const origin = new THREE.Vector3();
  game.camera.getWorldPosition(origin);
  const dir = new THREE.Vector3();
  game.camera.getWorldDirection(dir);
  dir.y += 0.2;
  dir.normalize();
  const clear = raycastWorld(game.colliders, origin, dir, 0.85);
  origin.addScaledVector(dir, Math.max(0, Math.min(0.5, clear - 0.25)));

  const eid = `pkg-${game.net.id}-${Math.round(performance.now())}`;
  // The reward is rolled HERE, once, and travels on the wire — rolling it on
  // open would let two clients disagree about the same crate.
  const marker = new MarkerCanister({ id: eid, origin, dir, world: droneWorld, owned: true });
  marker.reward = rollPackageReward();
  streakEntities.set(eid, marker);
  game.scene.add(marker.root);
  if (game.net.active) {
    game.net.publishStreak({
      kind: "carepackage", action: "marker", eid,
      ox: round2(origin.x), oy: round2(origin.y), oz: round2(origin.z),
      dx: round2(dir.x), dy: round2(dir.y), dz: round2(dir.z),
    });
  }
  game.audio.throwGear();
  game.localThrowT = THROW_TIME;
  // The overhand throw on the viewmodel, then the gun comes back.
  game.markerThrowT = game.MARKER_THROW_TIME;
  game.beginStreakHold(game.MARKER_THROW_TIME, "marker");
  game.selectedStreak = readyStreaksOrdered()[0] || null;
  updateStreakHud();
}

/* Run a streak we just called. Each one decides everything locally and then
   tells the room; nobody else re-derives any of it.
   Adding a streak: give it a beginStreakHold(...) here (plus startTabletDive
   for a tablet you dive into) and nothing else. It's always reached through
   callStreak, which puts a held melee weapon away first and hands back to it
   after; the secondary is handed back the same way. Don't call
   beginStreakHold from a path that skips callStreak, or melee drops it.
   tools/troll-ops-streak-holster-test.mjs picks new streaks up by itself. */
export function fireStreak(id, at = null) {
  // Everything past Lightning Strike: one call a minute at most (user), from
  // the call. A charge earned in the meantime waits in its slot.
  if (STREAK_DEFS[id]?.cooldown) lockStreak(id, STREAK_DEFS[id].cooldown, "cooldown");
  switch (id) {
    case "uav": {
      const team = uavBucket();
      game.startUav(team, STREAK_DEFS.uav.duration);
      game.myUavUntil = performance.now() + STREAK_DEFS.uav.duration * 1000;
      const yaw = Math.random() * Math.PI * 2;
      if (game.net.active) {
        game.net.publishStreak({
          kind: "uav", action: "start", team, duration: STREAK_DEFS.uav.duration,
          x: round2(game.move.pos.x), z: round2(game.move.pos.z), yaw: round2(yaw),
        });
      }
      game.spawnRecon(round2(game.move.pos.x), game.move.pos.z, round2(yaw), STREAK_DEFS.uav.duration, { team, caller: game.net.id });
      showWaveBanner("UAV ONLINE", 1600);
      // Up, thumb CONFIRM, a beat on "UAV ONLINE", down (DESIGN-ARMS.md Phase 5).
      game.beginStreakHold(1.4, "tablet", "uav");
      break;
    }

    case "vsat": {
      const team = uavBucket();
      const dur = STREAK_DEFS.vsat.duration;
      startVsat(team, dur);
      const yaw = Math.random() * Math.PI * 2;
      spawnVsatSat(yaw, dur);
      if (game.net.active) {
        game.net.publishStreak({ kind: "vsat", action: "start", team, duration: dur, yaw: round2(yaw) });
        game.net.publishStreak({ kind: "callout", label: "ORBITAL VSAT", who: game.net.name });
      }
      showWaveBanner("ORBITAL VSAT ONLINE", 1800);
      game.beginStreakHold(1.5, "tablet", "vsat");
      break;
    }

    case "counteruav": {
      const def = STREAK_DEFS.counteruav;
      const yaw = Math.random() * Math.PI * 2;
      if (game.net.active) {
        game.net.publishStreak({
          kind: "cuav", action: "start", team: game.net.team, duration: def.duration, lockout: def.lockout,
          x: round2(game.move.pos.x), z: round2(game.move.pos.z), yaw: round2(yaw),
        });
      }
      game.spawnRecon(round2(game.move.pos.x), game.move.pos.z, round2(yaw), def.duration, { counter: true, team: game.net.team, caller: game.net.id });
      showWaveBanner("COUNTER-UAV ONLINE", 1600);
      game.beginStreakHold(1.4, "tablet", "counteruav");
      break;
    }

    case "carepackage":
      // Called by throwing the marker (throwMarker), never directly.
      break;

    case "drone": {
      // BO2: the drone comes out in your hands, spins up, and you toss it.
      // It leaves the hand DRONE_TOSS_AT into the hold (launchPendingDrone).
      game.pendingDroneLaunch = { eid: `streak-drone-${game.net.id}-${Math.round(performance.now())}` };
      game.beginStreakHold(game.DRONE_TOSS_AT + 0.35, "drone");
      break;
    }

    case "airstrike": {
      // `at` is the tablet's three marks. One bombing pass per mark, in the
      // order they were marked, a beat apart — BO2's three strikes. The jets
      // fly the way you were facing, so they come in over your shoulder.
      const pts = Array.isArray(at) ? at : [at];
      const yaw = game.look.yaw;
      const runs = pts.map((p, i) => ({ x: round2(p.x), z: round2(p.z), delay: round2(strikeDelay(i)) }));
      for (const r of runs) spawnAirstrike({ ...r, yaw, owned: true, team: game.net.team });
      if (game.net.active) {
        game.net.publishStreak({ kind: "airstrike", action: "mark", runs, yaw: round2(yaw), team: game.net.team });
      }
      showWaveBanner("LIGHTNING STRIKE INBOUND", 2000);
      break;
    }

    case "helicopter": {
      const eid = `streak-heli-${game.net.id}-${Math.round(performance.now())}`;
      const seed = Math.floor(Math.random() * 360);
      spawnHelicopter({ id: eid, seed, owned: true, team: game.net.team });
      if (game.net.active) {
        game.net.publishStreak({ kind: "heli", action: "spawn", eid, seed, team: game.net.team });
        // The gunship arriving is a match-wide moment, same as a nuke.
        game.net.publishStreak({ kind: "callout", label: "GUNSHIP INBOUND", who: game.net.name });
      }
      showWaveBanner("GUNSHIP INBOUND", 2000);
      // Same tablet call as the UAV, held a touch longer on the inbound page.
      game.beginStreakHold(1.6, "tablet", "gunship");
      achievements.award("gunship");
      break;
    }

    case "k9": {
      const eid = `streak-k9-${game.net.id}-${Math.round(performance.now())}`;
      spawnK9({ id: eid, owned: true, team: game.net.team, ownerId: game.net.id, x: game.move.pos.x, y: game.move.pos.y, z: game.move.pos.z, yaw: game.look.yaw });
      if (game.net.active) {
        game.net.publishStreak({ kind: "k9", action: "spawn", eid, team: game.net.team,
          x: round2(game.move.pos.x), y: round2(game.move.pos.y), z: round2(game.move.pos.z), yaw: round2(game.look.yaw) });
        game.net.publishStreak({ kind: "callout", label: "K9 UNIT", who: game.net.name });
      }
      showWaveBanner("K9 UNIT RELEASED", 1800);
      // No tablet for the dogs: two fingers in the mouth and a whistle.
      game.beginStreakHold(game.WHISTLE_HOLD, "whistle");
      game.audio.whistle(null, game.WHISTLE_BLOW_AT);
      break;
    }

    case "warship": {
      const eid = `streak-vtol-${game.net.id}-${Math.round(performance.now())}`;
      const seed = Math.floor(Math.random() * 360);
      game.warship = game.spawnWarship({ id: eid, seed, owned: true, team: game.net.team });
      game.warshipGun = "chain";
      if (game.net.active) {
        game.net.publishStreak({ kind: "warship", action: "spawn", eid, seed, team: game.net.team });
        game.net.publishStreak({ kind: "callout", label: "VTOL WARSHIP", who: game.net.name });
      }
      showWaveBanner("VTOL WARSHIP INBOUND", 1400);
      game.beginStreakHold(game.WARSHIP_BOARD_AT, "tablet", "warship");
      game.startTabletDive(game.WARSHIP_BOARD_AT);
      break;
    }

    case "samturret": {
      const eid = `streak-sam-${game.net.id}-${Math.round(performance.now())}`;
      const at = game.samDeployPoint(game.move.pos, game.look.yaw);
      game.spawnSam({ id: eid, owned: true, team: game.net.team, ...at });
      if (game.net.active) {
        game.net.publishStreak({ kind: "sam", action: "spawn", eid, team: game.net.team, x: round2(at.x), y: round2(at.y), z: round2(at.z), yaw: round2(at.yaw) });
        game.net.publishStreak({ kind: "callout", label: "SAM TURRET", who: game.net.name });
      }
      showWaveBanner("SAM TURRET DEPLOYED", 1600);
      game.beginStreakHold(1.3, "tablet", "samturret");
      break;
    }

    case "dragonfire": {
      const eid = `streak-df-${game.net.id}-${Math.round(performance.now())}`;
      const from = new THREE.Vector3(game.move.pos.x - Math.sin(game.look.yaw) * 0.8, game.move.pos.y + 1.3, game.move.pos.z - Math.cos(game.look.yaw) * 0.8);
      game.dragonfire = game.spawnDragonfire({ id: eid, owned: true, team: game.net.team, x: from.x, y: from.y, z: from.z, yaw: game.look.yaw });
      if (game.net.active) {
        game.net.publishStreak({ kind: "dragonfire", action: "spawn", eid, team: game.net.team, x: round2(from.x), y: round2(from.y), z: round2(from.z), yaw: round2(game.look.yaw) });
        game.net.publishStreak({ kind: "callout", label: "DRAGONFIRE", who: game.net.name });
      }
      showWaveBanner("DRAGONFIRE INBOUND", 1200);
      game.beginStreakHold(game.DF_BOARD_AT, "tablet", "dragonfire");
      game.startTabletDive(game.DF_BOARD_AT);
      break;
    }

    case "swarm": {
      game.swarmRuns.push({ t: 0, next: 1.4, sent: 0 });
      if (game.net.active) game.net.publishStreak({ kind: "callout", label: "SWARM", who: game.net.name });
      showWaveBanner("SWARM INBOUND", 2000);
      game.beginStreakHold(1.4, "tablet", "swarm");
      break;
    }
  }
}

export function round2(v) { return Math.round(v * 100) / 100; }

/* What's in the box. Securing a package always hands out a random free
   scorestreak (charged, ready to call in immediately) — no care packages in
   the streak pool or they'd chain forever. */
export function rollPackageReward() {
  const pick = PACKAGE_STREAK_POOL[Math.floor(Math.random() * PACKAGE_STREAK_POOL.length)];
  return `streak:${pick}`;
}

export function spawnCarePackage({ id, x, z, reward, owned, ownerTeam, groundY = null }) {
  // A marker copy with the same id (someone else's throw, as seen here) is
  // replaced by the drop.
  const prev = streakEntities.get(id);
  if (prev) { prev.dispose(); streakEntities.delete(id); }
  const gy = groundY ?? groundHeightAt(game.colliders, x, z, 60) ?? 0;
  const pkg = new CarePackage({ id, x, z, groundY: gy, reward, owned, ownerTeam });
  streakEntities.set(id, pkg);
  pkg.addTo(game.scene);
  streakIconTexture(String(reward).split(":")[1]).then((tex) => tex && pkg.setIcon(tex));
  game.audio.wave();   // the heli's on its way
  return pkg;
}

/* A streak's line-art icon as a sprite texture, for the crate's floating
   "what's inside". Cached per streak. */
const iconTextures = new Map();
function streakIconTexture(id) {
  if (!STREAK_DEFS[id]) return Promise.resolve(null);
  if (!iconTextures.has(id)) {
    iconTextures.set(id, new Promise((resolve) => {
      const svg = streakIconSvg(id)
        .replace('fill="currentColor"', 'fill="#9dff7a"')
        .replace('stroke="currentColor"', 'stroke="#9dff7a"')
        .replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" ');
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = c.height = 128;
        const g = c.getContext("2d");
        g.fillStyle = "rgba(10,24,12,.72)";
        g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "#9dff7a"; g.lineWidth = 4; g.stroke();
        g.drawImage(img, 22, 22, 84, 84);
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        resolve(tex);
      };
      img.onerror = () => resolve(null);
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    }));
  }
  return iconTextures.get(id);
}

/* How long a package takes to capture: its owner grabs it quickly, a
   teammate a little slower, and an enemy has to stand there and steal it. */
export function packageCaptureTime(pkg) {
  if (pkg.owned && !pkg.botId) return 0.8;   // a bot's crate we host is still the bot's
  if (!game.currentMode().ffa && game.net.team && pkg.ownerTeam === game.net.team) return 1.6;
  return 3.5;
}

/* The drone leaves the hand: pick its target now (not at the call, the
   room may have moved) and send it. */
export function launchPendingDrone() {
  const p = game.pendingDroneLaunch;
  game.pendingDroneLaunch = null;
  if (!p || !game.player.alive) return;
  const victim = pickDroneTarget(game.move.pos);
  const from = handLaunchPoint();
  spawnDrone({ id: p.eid, targetId: victim?.netId || null, owned: true, pos: from, yaw: game.look.yaw });
  if (game.net.active) {
    game.net.publishStreak({
      kind: "drone", action: "launch", eid: p.eid, target: victim?.netId || null,
      x: round2(from.x), y: round2(from.y), z: round2(from.z), yaw: round2(game.look.yaw),
    });
  }
  showWaveBanner(victim ? `HUNTER-KILLER — LOCKED ON ${String(victim.peer?.name || "TARGET").toUpperCase()}` : "HUNTER-KILLER — SEARCHING", 1800);
  game.audio.throwGear();
}

export function spawnDrone({ id, targetId, owned, pos, yaw = 0, sky = false, credit = "drone" }) {
  const drone = new HunterDrone({ id, owned, targetId, pos, yaw, sky, credit });
  attachAirHitbox(drone, 0.7, AIR_HP.drone);
  streakEntities.set(id, drone);
  game.scene.add(drone.root);
  if (!sky) game.audio.wave();   // a Swarm is two dozen of them
  return drone;
}

/* Just in front of the streak tablet, in world space. */
function handLaunchPoint() {
  const fwd = new THREE.Vector3();
  game.camera.getWorldDirection(fwd);
  const right = new THREE.Vector3().crossVectors(fwd, game.camera.up).normalize();
  const p = game.camera.position.clone().addScaledVector(fwd, 0.7).addScaledVector(right, 0.25);
  p.y -= 0.3;
  // Never inside a wall you're hugging.
  const toP = p.clone().sub(game.camera.position);
  const len = toP.length();
  if (raycastWorld(game.colliders, game.camera.position, toP.divideScalar(len), len) < len) {
    p.copy(game.camera.position);
    p.y -= 0.2;
  }
  return p;
}

/* The world-probing hooks a drone steers by (see HunterDrone.update). */
export const droneWorld = {
  target: null,
  probe: (from, dir, len) => raycastWorld(game.colliders, from, dir, len),
  sweep: (from, dir, len) => sweepWorld(from, dir, len),
  groundAt: (x, z, fromY) => groundHeightAt(game.colliders, x, z, fromY),
  route: (p, target, out) => droneRoute(p, target, out),
};

/* Ray against the colliders (all axis-aligned boxes) that also says which
   face it met, so a flier can slide along it. `inside` = the ray starts
   within a box; its normal is then the nearest way out. */
const _sweepHit = { t: 0, normal: new THREE.Vector3(), inside: false };
function sweepWorld(from, dir, len) {
  let bestT = Infinity, bestAxis = -1, bestSign = 0, inside = false;
  const o = [from.x, from.y, from.z], d = [dir.x, dir.y, dir.z];
  for (const c of game.colliders) {
    const lo = [c.min.x, c.min.y, c.min.z], hi = [c.max.x, c.max.y, c.max.z];
    let tmin = -Infinity, tmax = Infinity, axis = -1, sign = 0, miss = false;
    for (let a = 0; a < 3; a++) {
      if (Math.abs(d[a]) < 1e-9) {
        if (o[a] < lo[a] || o[a] > hi[a]) { miss = true; break; }
        continue;
      }
      let t1 = (lo[a] - o[a]) / d[a], t2 = (hi[a] - o[a]) / d[a], s = -1;
      if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
      if (t1 > tmin) { tmin = t1; axis = a; sign = s; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) { miss = true; break; }
    }
    if (miss || tmax < 0 || tmin > len) continue;
    if (tmin < 0) {
      // Starting inside: the way out is the nearest face.
      let pen = Infinity;
      for (let a = 0; a < 3; a++) {
        if (o[a] - lo[a] < pen) { pen = o[a] - lo[a]; axis = a; sign = -1; }
        if (hi[a] - o[a] < pen) { pen = hi[a] - o[a]; axis = a; sign = 1; }
      }
      bestT = 0; bestAxis = axis; bestSign = sign; inside = true;
      break;
    }
    if (tmin < bestT) { bestT = tmin; bestAxis = axis; bestSign = sign; }
  }
  if (bestAxis < 0) return null;
  _sweepHit.t = bestT;
  _sweepHit.inside = inside;
  _sweepHit.normal.set(0, 0, 0).setComponent(bestAxis, bestSign);
  return _sweepHit;
}

/* A drone that can't see its target flies the way round, at chest height,
   using the same flow field the bots walk (nav.js), one per floor height
   and rebuilt per map. Returns null when it can see it (go straight in) or
   there's no route (fall back to climbing over). */
export const droneFields = new Map();
const _routeChest = new THREE.Vector3();
const _routeDir = new THREE.Vector3();
function droneRoute(p, target, out) {
  if (droneWorld.air) return null;   // an aircraft: open sky, straight at it
  _routeChest.set(target.x, target.y + 1.1, target.z);
  const d = _routeChest.distanceTo(p);
  if (d < 0.01) return null;
  _routeDir.copy(_routeChest).sub(p).divideScalar(d);
  if (raycastWorld(game.colliders, p, _routeDir, d) >= d - 0.3) return null;
  const floorY = Math.round(target.y * 2) / 2;
  let field = droneFields.get(floorY);
  if (!field) {
    field = new FlowField(game.colliders, game.builtMap?.map?.bounds || game.ARENA, floorY);
    droneFields.set(floorY, field);
  }
  if (!field.compute(target.x, target.z)) return null;
  const s = field.steer(p.x, p.z, out);
  if (!s) return null;
  s.y = Math.max(-0.8, Math.min(0.8, (floorY + 1.6 - p.y) * 0.5));
  return s.normalize();
}

/* Where a drone's target is standing (feet), on this client. The target can
   be us: on the victim's screen the drone is coming for the local player,
   who isn't in remotes. */
export function droneTargetPos(targetId) {
  if (!targetId) return null;
  if (targetId === game.net.id) return game.player.alive ? game.move.pos : null;
  const rp = game.remotes.byId.get(targetId);
  if (rp) return rp.alive ? rp.pos : null;
  return droneAirTarget(targetId)?.root.position || null;
}

/* Hunter-killers also take down enemy UAVs and Counter-UAVs (user,
   2026-10-04). A recon plane is a drone target by its eid; the same plane
   flies the same path on every client, so every copy of the drone can chase
   it. It circles at RECON_ALTITUDE a touch faster than a drone hunts, so a
   drone after one leads it along its known path (pathAt) at DRONE_AIR_SPEED
   times the speed, and goes off within DRONE_AIR_REACH of it. */
export const DRONE_AIR_SPEED = 1.7, DRONE_AIR_REACH = 4, DRONE_AIR_PRIORITY = 0.5;
export function droneAirTarget(id) {
  if (typeof id !== "string" || !id.startsWith("recon:")) return null;
  const f = flyovers.find((p) => p.eid === id);
  return f && !f.dead && !f.done && f.age <= f.duration ? f : null;
}
const _droneLead = new THREE.Vector3();
/* Where to fly to meet plane `f` from `p` (feet-style: the drone aims 1 m
   above what it's given). */
export function droneLeadPoint(p, f) {
  _droneLead.copy(f.root.position);
  const speed = DRONE_SPEED * DRONE_AIR_SPEED;
  for (let i = 0; i < 3; i++) {
    const tti = Math.min(4, _droneLead.distanceTo(p) / speed);
    f.pathAt(f.age + tti, _droneLead);
  }
  _droneLead.y -= 1;
  return _droneLead;
}

/* Hunter-killer target pick: nearest enemy, but one it can actually see
   beats a closer one behind a wall (scored as if 25 m further away). */
/* `team` / `botId`: whose drone (default ours). A bot's can pick us. */
export function pickDroneTarget(from, eyeUp = 1.6, { team = game.net.team, botId = null } = {}) {
  let best = null, bestScore = Infinity;
  const ffa = game.currentMode().ffa;
  const eye = new THREE.Vector3(from.x, from.y + eyeUp, from.z);
  const dir = new THREE.Vector3();
  const consider = (pos, who) => {
    const d = from.distanceTo(pos);
    dir.set(pos.x - eye.x, pos.y + 1.2 - eye.y, pos.z - eye.z);
    const len = dir.length() || 1;
    dir.divideScalar(len);
    const seen = raycastWorld(game.colliders, eye, dir, len) >= len - 0.3;
    const score = d + (seen ? 0 : 25);
    if (score < bestScore) { bestScore = score; best = who; }
  };
  for (const rp of game.remotes.byId.values()) {
    if (!rp.alive || rp.netId === botId) continue;
    if (!ffa && team && rp.team === team) continue;
    consider(rp.pos, rp);
  }
  if (game.streakOwnerHates(team, botId)) consider(game.move.pos, { netId: game.net.id, pos: game.move.pos, peer: { name: "you" } });
  // Enemy UAVs and Counter-UAVs: in open sky, and worth going after, so
  // they count at DRONE_AIR_PRIORITY of their distance (an enemy in sight
  // within ~30 m still comes first).
  for (const t of game.enemyAirFor(team, botId || game.net.id)) {
    if (!(t.e instanceof ReconPlane) || !droneAirTarget(t.id)) continue;
    const score = from.distanceTo(t.pos) * DRONE_AIR_PRIORITY;
    if (score < bestScore) { bestScore = score; best = { netId: t.id, pos: t.pos, air: true, peer: { name: t.e.counter ? "Counter-UAV" : "UAV" } }; }
  }
  return best;
}

/* Mark order -> seconds to that pass's first impact. */
export function strikeDelay(i) { return AIRSTRIKE_DELAY - 1 + i * 1.7; }

/* The Lightning Strike tablet (streak-tablet.js), made during the warm-up
   (or on first use, if that never ran) so opening it costs only the
   overhead picture. */
export let strikeTablet = null;
export function ensureStrikeTablet() {
  if (!strikeTablet) {
    strikeTablet = new StrikeTablet({ host: game.els.streakMark?.parentElement || document.body, renderer: game.renderer, scene: game.scene });
  }
  return strikeTablet;
}
export function openStrikeTablet() {
  ensureStrikeTablet();
  const bounds = game.builtMap?.map?.bounds || game.ARENA;
  const keyHint = game.isTouch ? "Tap the map to mark" : game.gamepadState.connected
    ? "Stick aims · A marks · B undoes" : "Mouse aims · Click marks · Right-click undoes · Esc cancels";
  strikeTablet.open({
    bounds,
    radius: AIRSTRIKE_RADIUS * 0.75,
    me: { x: game.move.pos.x, z: game.move.pos.z, yaw: game.look.yaw },
    hint: keyHint,
    blips: () => {
      const out = [];
      const ffa = game.currentMode().ffa;
      for (const rp of game.remotes.byId.values()) {
        if (!rp.alive) continue;
        const friendly = !ffa && !!game.net.team && rp.team === game.net.team;
        if (friendly || enemiesRevealed()) out.push({ x: rp.pos.x, z: rp.pos.z, friendly });
      }
      return out;
    },
    onPlace: (n) => {
      game.audio.reload();
      if (n >= STRIKE_TARGETS) showWaveBanner("STRIKE CONFIRMED", 1200);
    },
    onConfirm: (pts) => {
      if (game.markingStreak !== "airstrike" || !game.player.alive) return;
      if (!streaks.spend("airstrike")) { cancelMark(); return; }
      game.markingStreak = null;
      game.beginStreakHold(0.2);
      fireStreak("airstrike", pts);
      game.selectedStreak = readyStreaksOrdered()[0] || null;
      updateStreakHud();
    },
    onCancel: () => { if (game.markingStreak === "airstrike") cancelMark(); },
  });
}

export function spawnAirstrike({ x, z, yaw, owned, team, delay = AIRSTRIKE_DELAY }) {
  const run = new AirstrikeRun({
    x, z, yaw, delay, owned, team,
    groundAt: (px, pz) => groundHeightAt(game.colliders, px, pz, 60) ?? 0,
  });
  run.addTo(game.scene);
  pendingStrikes.push(run);
  return run;
}

/* Bullets can bring aircraft down (user: bots should shoot aircraft with
   their guns; so can people). An invisible hit volume on the airframe
   (game.js resolveStreakKit reads userData.air) and a health pool; the
   owner applies hits (damageStreakEntity), recon planes on every client. */
export const AIR_HP = { drone: 60, heli: 600, recon: 450 };
const _airHitMat = new THREE.MeshBasicMaterial({ visible: false });
export function attachAirHitbox(e, radius, hp) {
  e.hp = hp;
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), _airHitMat);
  m.userData.air = e;
  e.root.add(m);
  e.hitbox = m;
}

export function spawnHelicopter({ id, seed, owned, team }) {
  const bounds = game.builtMap?.map?.bounds || { minX: game.ARENA.minX, maxX: game.ARENA.maxX, minZ: game.ARENA.minZ, maxZ: game.ARENA.maxZ };
  const heli = new HelicopterGunship({
    id, owned, bounds, seed, team, lights: game.lightPool, duration: STREAK_DEFS.helicopter.duration,
  });
  attachAirHitbox(heli, 3.2, AIR_HP.heli);
  streakEntities.set(id, heli);
  game.scene.add(heli.root);
  game.audio.wave();
  return heli;
}

/* ---------------- K9 Unit, VTOL Warship, Swarm (BO2's top tier) ---------------- */

export function streakBounds() {
  return game.builtMap?.map?.bounds || { minX: game.ARENA.minX, maxX: game.ARENA.maxX, minZ: game.ARENA.minZ, maxZ: game.ARENA.maxZ };
}

export function spawnK9({ id, owned, team, ownerId, x, y, z, yaw = 0, count = undefined, duration = undefined }) {
  const pack = new K9Pack({
    id, owned, team, ownerId, origin: new THREE.Vector3(x, y, z), yaw, count,
    duration: duration || STREAK_DEFS.k9.duration,
    world: { colliders: game.colliders, bounds: streakBounds(), stairs: game.k9Stairs(), navCell: game.builtMap?.map?.navCell || null },
  });
  streakEntities.set(id, pack);
  game.scene.add(pack.root);
  game.audio.wave();
  return pack;
}
