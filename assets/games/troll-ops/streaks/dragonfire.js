// Troll Forces Dragonfire and SAM turret: flying the drone, its gun, SAM
// targeting and missiles, and streak kit taking damage. Moved out of game.js
// (split phase 1).

import { Dragonfire, DF_RANGE, DF_SPREAD, DF_DAMAGE, DF_HP } from "../dragonfire.js?v=df3-sb2";
import { STREAK_DEFS, SCORE } from "../scorestreaks.js?v=umb1-wst-sb2-fu1-wb1";
import { streakEntities, flyovers, streakBlast, uavBucket, uavUntil } from "./calling.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2";
import { SamTurret, SAM_RANGE, SAM_LOCK, SAM_SALVO_GAP, SAM_RELOAD } from "../sam-turret.js?v=sam1";
import * as THREE from "three";
import { raycastWorld } from "../ballistics.js?v=cg1-wst-hf1-fu1b7-wb1";
import { groundHeightAt } from "../movement.js?v=umb2-sb2-gj1b7";
import { HelicopterGunship, VtolWarship, HunterDrone, ReconPlane } from "../streak-entities.js?v=vsat2-hk1";
import { round2 } from "./fire.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2";
import { showWaveBanner, pushKillfeed } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2";
import { XP } from "../progression.js?v=p5-wst-sb2-fu1-wb1";
import { findAimAssistTarget } from "../input/aim-assist.js?v=in1-fu1b7-wb1";
import { WEAPON_DEFS } from "../weapons.js?v=p5bm-wst-hf1-fu1-wb1";
import { game } from "../core/state.js?v=st1";

export const DF_BOARD_AT = 1.2;        // the tablet dive, then you're flying
export const samHitCount = new Map();  // air eid -> SAM missiles it has taken (owner side)

export function dragonfireView() {
  return !!game.dragonfire && game.dragonfire.alive && game.player.alive && game.dragonfire.age >= DF_BOARD_AT;
}

export function spawnDragonfire({ id, owned, team, x, y, z, yaw, botId = null }) {
  const df = new Dragonfire({ id, owned, team, x, y, z, yaw, duration: STREAK_DEFS.dragonfire.duration, botId });
  streakEntities.set(id, df);
  game.scene.add(df.root);
  game.audio.wave();
  return df;
}

export function spawnSam({ id, owned, team, x, y, z, yaw, botId = null }) {
  const sam = new SamTurret({ id, owned, team, x, y, z, yaw, duration: STREAK_DEFS.samturret.duration, botId });
  streakEntities.set(id, sam);
  game.scene.add(sam.root);
  game.audio.land?.(6);
  return sam;
}

/* Where a SAM goes down: a couple of metres ahead, pulled back off a wall,
   on the floor there. */
export function samDeployPoint(from, yaw) {
  const dir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const eye = new THREE.Vector3(from.x, from.y + 1, from.z);
  const d = Math.max(0.6, Math.min(2.2, raycastWorld(game.colliders, eye, dir, 2.2) - 0.6));
  const x = from.x + dir.x * d, z = from.z + dir.z * d;
  const y = groundHeightAt(game.colliders, x, z, from.y + 1.5) ?? from.y;
  return { x, y, z, yaw };
}

/* Streak kit that's hostile to us (shootable, and a SAM target). */
export function streakHostileToMe(e) {
  if (e.owned && !e.botId) return false;
  const ffa = !!game.currentMode().ffa;
  if (ffa || !game.net.team) return true;
  return (e.botTeam || e.team) !== game.net.team;
}

/* Aircraft a SAM on `team` (owned by `botId`, or us) should shoot at:
   { id, pos, need } where `need` is how many missiles bring it down. */
const _airPos = new THREE.Vector3();
/* Enemy aircraft for a side: { id, pos, need, e } where `need` is how many
   SAM missiles bring it down and `e` the entity (or recon plane). `team` is
   the side looking; `owner` whose kit to leave alone in FFA (net.id for
   us, a bot's id). Used by SAM Turrets, bots' guns and our own bullets. */
export function enemyAirFor(team, owner) {
  const ffa = !!game.currentMode().ffa;
  const ownerOf = (e) => (e.botId || (e.owned ? game.net.id : e.ownerId || null));
  const hostile = (t, e) => ffa ? ownerOf(e) !== owner : !!t && t !== team;
  const out = [];
  for (const e of streakEntities.values()) {
    if (e.dead) continue;
    if (e instanceof Dragonfire) {
      if (e.alive && e.launched && hostile(e.botTeam || e.team, e)) out.push({ id: e.id, pos: e.pos, need: 1, e });
    } else if (e instanceof HelicopterGunship) {
      if (e.onStation && hostile(e.botTeam || e.team, e)) out.push({ id: e.id, pos: e.root.position, need: 2, e });
    } else if (e instanceof VtolWarship) {
      if (e.onStation && hostile(e.team, e)) out.push({ id: e.id, pos: e.root.position, need: 3, e });
    } else if (e instanceof HunterDrone) {
      // Its side is its hunter's: hunting us or ours = it's the enemy's.
      let t = e.botTeam || null;
      if (!t && !e.owned) {
        const tp = e.targetId === game.net.id ? game.net.team : game.net.peers.get(e.targetId)?.team;
        t = tp && !ffa ? (tp === "phantom" ? "ghost" : "phantom") : null;
      } else if (!t && e.owned) t = game.net.team;
      if (e.root.position.y > 3 && hostile(t, e)) out.push({ id: e.id, pos: e.root.position, need: 1, e });
    }
  }
  for (const f of flyovers) {
    if (!f.eid || f.done || f.dead || f.age < 3 || f.age > f.duration) continue;
    if (ffa ? f.caller !== owner : hostile(f.team, f)) out.push({ id: f.eid, pos: f.root.position, need: 1, e: f });
  }
  return out;
}

export function samTargets(sam) {
  const team = sam.botId ? sam.botTeam || sam.team : sam.team;
  return enemyAirFor(team, sam.botId || (sam.owned ? game.net.id : null)).filter((t) => t.e !== sam);
}

export function airTargetPos(id) {
  const e = streakEntities.get(id);
  if (e && !e.dead) return e instanceof Dragonfire ? e.pos : e.root.position;
  const f = flyovers.find((p) => p.eid === id && !p.dead);
  return f ? f.root.position : null;
}

/* Owner: pick, slew, lock, fire pairs. */
export function updateSamAi(sam, dt) {
  if (sam.age < 1.2 || !sam.alive) return;
  sam.reloadT = Math.max(0, sam.reloadT - dt);
  const list = samTargets(sam);
  const eye = _airPos.set(sam.pos.x, sam.pos.y + 1.3, sam.pos.z);
  const inbound = (id) => sam.missiles.filter((m) => m.targetId === id).length;
  const usable = (t) => {
    const d = t.pos.distanceTo(eye);
    if (d > SAM_RANGE) return false;
    if ((samHitCount.get(t.id) || 0) + inbound(t.id) >= t.need) return false;   // enough already on the way
    const dir = t.pos.clone().sub(eye).divideScalar(d);
    return raycastWorld(game.colliders, eye, dir, d) >= d - 2;
  };
  let tgt = sam.targetId ? list.find((t) => t.id === sam.targetId) : null;
  if (tgt && !usable(tgt) && sam.salvo <= 0) tgt = null;
  if (!tgt) {
    let best = Infinity;
    for (const t of list) {
      if (!usable(t)) continue;
      const d = t.pos.distanceTo(eye);
      if (d < best) { best = d; tgt = t; }
    }
    if (tgt?.id !== sam.targetId) sam.lockT = 0;
  }
  sam.targetId = tgt ? tgt.id : null;
  if (!tgt) return;
  const off = sam.aimAt(tgt.pos, dt);
  sam.lockT = off < 0.12 ? sam.lockT + dt : Math.max(0, sam.lockT - dt);
  if (sam.salvo <= 0 && sam.reloadT <= 0 && sam.lockT >= SAM_LOCK) { sam.salvo = Math.min(2, tgt.need); sam.salvoT = 0; }
  if (sam.salvo > 0) {
    sam.salvoT -= dt;
    if (sam.salvoT <= 0) {
      const ms = sam.launch(tgt.id);
      sam.salvo--;
      sam.salvoT = SAM_SALVO_GAP;
      if (sam.salvo <= 0) sam.reloadT = SAM_RELOAD;
      game.audio.explosion?.(0.12, ms.pos);
      if (game.net.active) {
        game.net.publishStreak({ kind: "sam", action: "launch", eid: sam.id, t: tgt.id,
          x: round2(ms.pos.x), y: round2(ms.pos.y), z: round2(ms.pos.z), dx: round2(ms.dir.x), dy: round2(ms.dir.y), dz: round2(ms.dir.z) });
      }
    }
  }
}

/* A SAM missile reaching its target, on the SAM owner's client. */
export function samMissileHit(sam, targetId) {
  const n = (samHitCount.get(targetId) || 0) + 1;
  samHitCount.set(targetId, n);
  const t = samTargets(sam).find((x) => x.id === targetId);
  const need = t ? t.need : 1;
  if (n >= need) shootDownAir(targetId, sam.botId || game.net.id, true);
}

/* Bullets (or a Dragonfire's gun) on streak kit: its owner applies it. */
export function damageStreakEntity(e, dmg, byId, fromWire = false) {
  if (e instanceof ReconPlane) {
    // No owner copy to defer to: every client counts the same hits.
    e.hp -= dmg;
    if (!fromWire && game.net.active) game.net.publishStreak({ kind: "air", action: "hit", eid: e.eid, dmg: Math.round(dmg), by: byId });
    if (e.hp <= 0) shootDownAir(e.eid, byId, false);
    return;
  }
  if (e.owned) {
    e.hp -= dmg;
    if (e.hp <= 0) shootDownAir(e.id, byId, true);
  } else if (game.net.active) {
    game.net.publishStreak({ kind: "air", action: "hit", eid: e.id, dmg: Math.round(dmg), by: byId });
  }
}

/* Destroyed: a Dragonfire or SAM shot apart, or an aircraft a SAM hit.
   `announce`: this client decided it, so tell the room. */
export function shootDownAir(eid, byId, announce = false) {
  const e = streakEntities.get(eid);
  const plane = !e && flyovers.find((f) => f.eid === eid);
  if (!e && !plane) return;
  if (announce && game.net.active) game.net.publishStreak({ kind: "air", action: "down", eid, by: byId || null });
  const at = (e ? (e instanceof Dragonfire ? e.pos : e instanceof SamTurret ? e.pos.clone().setY(e.pos.y + 1) : e.root.position) : plane.root.position).clone();
  game.explosionFx({ kind: "lethal", glow: 0xffa23a, radius: 4 }, at);
  streakBlast(at, e instanceof HunterDrone || e instanceof Dragonfire ? 0.7 : 1.2);
  game.audio.explosion?.(0.5, at);
  const mine = e ? (e.owned && !e.botId) : plane.team === uavBucket() && !game.currentMode().ffa;
  if (e) {
    if (e === game.warship) game.warship = null;
    if (e === game.dragonfire) { game.dragonfire = null; showWaveBanner("DRAGONFIRE DESTROYED", 1600); }
    if (e instanceof HelicopterGunship && mine) showWaveBanner("GUNSHIP SHOT DOWN", 1600);
    if (e instanceof VtolWarship && mine) showWaveBanner("WARSHIP SHOT DOWN", 1600);
    if (e instanceof SamTurret && mine) showWaveBanner("SAM TURRET DESTROYED", 1600);
    e.dispose();
    streakEntities.delete(eid);
  } else {
    if (!plane.counter) {
      if (plane.team) uavUntil[plane.team] = 0;
      if (plane.team === uavBucket() && game.myUavUntil > performance.now()) game.myUavUntil = 0;
      if (mine) showWaveBanner("UAV SHOT DOWN", 1600);
    } else if (game.currentMode().ffa || !game.net.team || plane.team !== game.net.team) {
      game.jammedUntil = 0;   // their jammer's down: our radar's back
      showWaveBanner("ENEMY COUNTER-UAV DOWN", 1500);
    }
    plane.dispose();
    flyovers.splice(flyovers.indexOf(plane), 1);
  }
  samHitCount.delete(eid);
  const botShooter = byId && game.bots.byId(byId);
  if (botShooter) game.botEarn(botShooter, SCORE.airKill);
  if (byId && byId === game.net.id && !mine) {
    game.awardScore(SCORE.airKill);
    game.addMatchXp(XP.kill, "AIRCRAFT DOWN");
    pushKillfeed(`Aircraft down  +${SCORE.airKill}`);
  }
}

/* Owner: our Dragonfire's gun. Hitscan from the nose camera along the
   crosshair; people, dogs and enemy streak kit all take it. */
const _dfRay = new THREE.Raycaster();
export const DF_ASSIST_CONE_DEG = 10;   // the pull's search cone (the gun's is 7)
export const DF_ASSIST_PULL = 0.7;      // share of the gun's full pull, every frame while flying
const DF_MAGNET_DEG = 3;         // rounds bend onto a target this close to the reticle
export function fireDragonfire() {
  const df = game.dragonfire;
  if (!df || !df.tryFire()) return;
  const dir = game.camera.getWorldDirection(new THREE.Vector3());
  // Magnetism: someone within a few degrees of the reticle (in sight, in
  // range) draws the round onto their chest before the spread goes on.
  const mag = game.settings.aimAssist ? findAimAssistTarget(DF_MAGNET_DEG, DF_RANGE) : null;
  if (mag) dir.set(mag.aim.x - game.camera.position.x, mag.aim.y - game.camera.position.y, mag.aim.z - game.camera.position.z).normalize();
  dir.x += (Math.random() - 0.5) * DF_SPREAD * 2;
  dir.y += (Math.random() - 0.5) * DF_SPREAD * 2;
  dir.z += (Math.random() - 0.5) * DF_SPREAD * 2;
  dir.normalize();
  const from = game.camera.position.clone();
  const wall = raycastWorld(game.colliders, from, dir, DF_RANGE);
  _dfRay.set(from, dir);
  _dfRay.near = 0.3;
  _dfRay.far = wall;
  let to = from.clone().addScaledVector(dir, wall);
  const meshes = game.targetMeshes.filter((m) => !m.userData?.air || m.userData.air !== df);
  const hits = meshes.length ? _dfRay.intersectObjects(meshes, true) : [];
  let hitActor = false;
  for (const h of hits) {
    const actor = game.resolveBulletTarget(h.object);
    if (!actor) continue;
    to = h.point.clone();
    game.onBulletActorHit(actor, { damage: DF_DAMAGE, isHead: false, point: h.point, dir, creditAs: "dragonfire", distance: h.distance });
    hitActor = true;
    break;
  }
  if (!hitActor && wall < DF_RANGE) game.impactFx.hit(to, { normal: dir.clone().negate(), dir, surface: "ground", scale: 1 });
  df.shoot(to);
  game.audio.shot(WEAPON_DEFS.bellow || WEAPON_DEFS.problem416, 0.4);
  game.shakeMag = Math.max(game.shakeMag, 0.004); game.shakeT = 0.06;
  if (game.net.active) game.net.publishStreak({ kind: "dragonfire", action: "shot", eid: df.id, x: round2(to.x), y: round2(to.y), z: round2(to.z) });
}

/* The pilot's feed: a timer, the drone's health, a reticle. */
function dragonfireHudEl() {
  if (game.dfHud) return game.dfHud;
  game.dfHud = document.createElement("div");
  game.dfHud.className = "to-df";
  game.dfHud.hidden = true;
  game.dfHud.setAttribute("aria-hidden", "true");
  game.dfHud.innerHTML = `<div class="to-df-scan"></div><div class="to-df-frame"><i></i><i></i><i></i><i></i></div>
<div class="to-df-reticle"><b></b></div>
<div class="to-df-top"><strong>DRAGONFIRE</strong><span class="to-df-time"></span></div>
<div class="to-df-hp"><span>HULL</span><div><i></i></div></div>
<div class="to-df-heat"><span>GUN</span><div><i></i></div><em>OVERHEATED</em></div>
<div class="to-df-alt"></div>
<div class="to-df-keys"></div>`;
  (game.els.streakMark?.parentElement || document.body).appendChild(game.dfHud);
  return game.dfHud;
}

export function syncDragonfireView() {
  // Killed on the ground: the link's cut and the drone drops.
  if (game.dragonfire && !game.player.alive && game.dragonfire.alive) {
    game.dragonfire.hp = 0;
    shootDownAir(game.dragonfire.id, null, true);
  }
  const on = dragonfireView();
  if (on !== game.dfViewOn) {
    game.dfViewOn = on;
    const el = dragonfireHudEl();
    el.hidden = !on;
    document.body.classList.toggle("to-in-dragonfire", on);
    if (on) {
      game.dfSaved = { yaw: game.look.yaw, pitch: game.look.pitch };
      game.look.pitch = -0.1;
      // How to climb and dive, in whatever the player is holding (user:
      // couldn't find how to go up or down).
      el.querySelector(".to-df-keys").textContent = game.gamepadState.connected ? "A climb · B dive · R2 fire"
        : game.isTouch ? "▲ climb · ▼ dive · or look and fly" : "SPACE climb · C dive · or look and fly";
      showWaveBanner("DRAGONFIRE — YOU HAVE CONTROL", 1500);
    } else {
      if (game.dfSaved) { game.look.yaw = game.dfSaved.yaw; game.look.pitch = game.dfSaved.pitch; }
      game.dfSaved = null;
      if (game.player.alive && game.dragonfire && !game.dragonfire.alive) showWaveBanner("DRAGONFIRE OFFLINE", 1200);
    }
  }
  if (!on) return;
  const df = game.dragonfire;
  game.dfHud.querySelector(".to-df-time").textContent = `${Math.max(0, Math.ceil(df.duration - df.age))}s`;
  game.dfHud.querySelector(".to-df-hp i").style.width = `${Math.round(Math.max(0, df.hp / DF_HP) * 100)}%`;
  game.dfHud.querySelector(".to-df-heat i").style.width = `${Math.round(df.heat * 100)}%`;
  game.dfHud.classList.toggle("is-hot", df.heat > 0.7);
  if (df.overheated && !game.dfHud.classList.contains("is-overheated")) game.audio.reload();   // the clack of a locked gun
  game.dfHud.classList.toggle("is-overheated", df.overheated);
  const floor = groundHeightAt(game.colliders, df.pos.x, df.pos.z, df.pos.y) ?? 0;
  game.dfHud.querySelector(".to-df-alt").textContent = `ALT ${Math.max(0, df.pos.y - floor).toFixed(1)}m`;
  game.dfHud.classList.toggle("is-low", df.duration - df.age < 10 || df.hp < DF_HP * 0.35);
}
