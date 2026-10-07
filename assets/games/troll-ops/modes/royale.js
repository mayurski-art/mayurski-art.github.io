// Troll Royale rules: setup, the box and drop, the Cringe, gear, bots,
// spectating and the end. Moved out of game.js (split phase 1); royale.js
// next door holds the zone and loot it runs on.

import { hashSeed, seededRng, RoyaleZone, ROYALE, LootField, lootSpots, ZoneVisual, ITEM_NAMES, gunDisplayName } from "../royale.js?v=p5-wst-bs1-sb2-fu1";
import { groundHeightAt } from "../movement.js?v=umb2-sb2-gj1b7";
import { insidePolygon } from "../edge.js";
import { DROP, RoyaleDrop, buildParaglider, Flight } from "../royale-drop.js?v=rp3-wst-bs1-sb2-fu1b7";
import { DROP_FALL, DROP_GLIDE, ROLL_TIME } from "../remote-players.js?v=umb3g-pc1-nf-em1-mi2-wst-ig1-bs1-sb1-cb2-rp1-hf1-sb2-gj1-fu1b7";
import * as THREE from "three";
import { WEAPON_DEFS, WeaponState } from "../weapons.js?v=p5bm-wst-hf1-fu1";
import { defaultLoadoutFor } from "../attachments.js?v=cg1-wst-sb2-fu1";
import { raycastWorld } from "../ballistics.js?v=cg1-wst-hf1-fu1b7";
import { game } from "../core/state.js?v=st1";

// Phase 1 ("Mini Royale"): solo, one life, loot only, the Cringe closing in,
// last troll standing. royale.js has the zone, the loot and their visuals;
// this is the rules. Every client runs the same zone off its own match clock
// (they agree because staging ends together) and the same floor loot from
// the stage owner's seed; only pickups and drops travel ("loot" messages).
// Each client ends the match itself when one troll is left, the way score
// limits already work.

export let royale = null;

function royaleSeed() { return hashSeed(`${game.net.room || "solo"}:${game.matchesPlayed}:royale`); }

function royaleGround(x, z) { return groundHeightAt(game.colliders, x, z, 0.8, 0.3) ?? 0; }

export function setupRoyale(seed = royaleSeed()) {
  teardownRoyale();
  const rng = seededRng(seed);
  const map = game.builtMap.map;
  const bounds = map.bounds;
  // A map can bring its own players, zone timings and loot density
  // (Trollface Island), and keep circles and loot on land.
  const onLand = (x, z) => (!map.edge || insidePolygon(map.edge, x, z));
  const dry = (x, z) => onLand(x, z) && (!map.wade || !insidePolygon(map.wade, x, z));
  // Circle centres stay on dry land too: a final circle in the lake is a
  // slow wade for everyone.
  const zone = new RoyaleZone(bounds, rng, map.royale?.phases || ROYALE.phases, map.edge ? dry : null);
  const loot = new LootField(game.scene);
  loot.spawnSeeded(lootSpots(game.colliders, bounds, rng, { ok: map.edge ? dry : null, perSqM: map.royale?.lootPerSqM }), rng, royaleGround);
  royale = {
    seed, zone, loot, visual: new ZoneVisual(game.scene),
    t: 0, live: false, peak: 0, place: 0, over: false, endT: 0,
    stageKey: "", zoneAcc: 0, act: null, spectate: null, outShown: false,
    noises: [],   // recent gunfire { x, z, t }, for bots to third-party
    drop: null, me: "ground", flight: null, lobbyItems: null,
  };
  royale.visual.update(zone.state(0), 0);
  // Trollface Island opens in the sky lobby, then the box opens (royale-drop.js).
  if (DROP.enabled && map.edge) {
    royale.drop = new RoyaleDrop({ scene: game.scene, colliders: game.colliders, edge: map.edge }, seed);
    royale.me = "lobby";
    royale.lobbyItems = new Map();
    for (const it of royale.drop.lobbyGunItems()) { royale.lobbyItems.set(it.id, it); loot.add(it); }
  }
}

/* In the sky lobby: free to move and try the guns, but nothing can be hurt. */
export function inSkyLobby() { return !!royale?.drop && royale.drop.phase === "lobby" && game.isStaging(); }
/* The pre-match countdown freezes you, except in the sky lobby. */
export function stageFrozen() { return game.isStaging() && !inSkyLobby(); }
/* In the air: the drop owns movement and the camera. (On the belt you walk
   as normal; the floor just moves under you.) */
export function royaleDropView() { return !!royale?.drop && game.player.alive && (royale.me === "fall" || royale.me === "glide"); }
/* On the moving floor or the ramp, before the edge. */
export function royaleOnBelt() { return !!royale?.drop && game.player.alive && royale.me === "belt"; }
/* Where you are in the drop, as the wire's `dr` (0 = not dropping; the belt is 0 too). */
export function royaleDropCode() {
  if (!royaleDropView()) return 0;
  return royale.me === "fall" ? DROP_FALL : DROP_GLIDE;
}

export const _dropTarget = new THREE.Vector3();
const _dropCam = new THREE.Vector3();
const _edgeAt = new THREE.Vector3();
const _edgeVel = new THREE.Vector3();
let playerGlider = null;

/* Orbit `dist` m behind `target` along the look direction, `height` up. */
export function placeDropCamera(target, dist, height) {
  const cp = Math.cos(game.look.pitch);
  _dropCam.set(Math.sin(game.look.yaw) * cp * dist, height - Math.sin(game.look.pitch) * dist, Math.cos(game.look.yaw) * cp * dist).add(target);
  game.camera.position.copy(_dropCam);
  game.camera.lookAt(target);
}

function dropGround(x, z, fromY) { return groundHeightAt(game.colliders, x, z, fromY); }

/* The glider over your own rig (seen in the third-person drop camera). */
function setPlayerGlider(on) {
  if (on && !playerGlider) {
    playerGlider = buildParaglider();
    playerGlider.position.y = 1.7;
    game.localRig.root.add(playerGlider);
  } else if (!on && playerGlider) {
    playerGlider.parent?.remove(playerGlider);
    playerGlider.traverse((o) => { o.geometry?.dispose(); if (o.material && !o.material.map) o.material.dispose?.(); });
    playerGlider = null;
  }
}

/* The bots wait in the box with everyone else, standing round the middle. */
export function placeBotsInLobby() {
  const n = game.bots.bots.length + 1;
  game.bots.bots.forEach((b, i) => {
    const s = royale.drop.lobbySpot(i + 1, n);
    b.pos.set(s.x, s.y, s.z);
    b.groundY = s.y;
    b.airborne = true;   // parked: the bot AI leaves it be until it lands
    b.drop = { state: "lobby" };
    b.dropCode = 0;
    game.net.publishBot(b);
  });
}

/* Sky lobby tick: the guns on the floor (infinite ammo, back a few seconds
   after they're taken), the pick-up prompt, and the countdown on the HUD. */
export function updateSkyLobby(dt) {
  const r = royale;
  r.loot.update(dt, game.camera, game.move.pos);
  for (const id of r.drop.lobbyRespawns(dt)) {
    const it = r.lobbyItems.get(id);
    if (it) r.loot.add(it);
  }
  for (const ws of Object.values(game.player.weapons)) if (ws) ws.ammoReserve = ws.def.reserveMax;
  if (game.player.alive) game.updatePickupPrompt(dt);
  const secs = Math.max(0, Math.ceil(game.stageT));
  const timer = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  if (game.els.royalePhase.textContent !== "Box opens in") game.els.royalePhase.textContent = "Box opens in";
  if (game.els.royaleTimer.textContent !== timer) game.els.royaleTimer.textContent = timer;
  const n = `${royaleAliveList().length} trolls`;
  if (game.els.royaleAlive.textContent !== n) game.els.royaleAlive.textContent = n;
}

/* 0:00 in the lobby: the lobby guns go (and whatever you picked up), one
   wall opens, and the floor starts carrying everyone toward it. */
export function openRoyaleBox() {
  const r = royale, d = r.drop;
  d.openBox();
  for (const it of [...r.loot.items.values()]) if ((it.y || 0) > 100) r.loot.take(it.id);
  game.equipFromLoadout();
  game.setActiveWeaponMesh(game.currentWeapon().def);
  if (game.els.pickupPrompt) game.els.pickupPrompt.hidden = true;
  game.setTouchContext(null);
  r.me = "belt";
  game.look.yaw = d.openYaw;   // facing the open side
  game.look.pitch = -0.1;
  if (game.net.isBotHost()) {
    // Where they land: spread over the whole island, on the floor loot (it
    // only lies on dry land), not piled onto the map's handful of spawn
    // points. With 99 bots on ~16 spots every landing was a brawl: the
    // island went from 100 to 40 in the first 15 seconds (user, 2026-10-03:
    // "within a couple of minutes we went from 100 people to 10").
    const floor = [...r.loot.items.values()].filter((it) => (it.y || 0) < 100);
    const spots = floor.length ? floor : game.builtMap.spawnPoints?.length ? game.builtMap.spawnPoints : [{ x: 0, z: 0 }];
    const rng = seededRng((r.seed ^ 0xbe17) >>> 0);
    for (const b of game.bots.bots) {
      const target = spots[Math.floor(Math.random() * spots.length)];
      const tx = target.x + (Math.random() - 0.5) * 8, tz = target.z + (Math.random() - 0.5) * 8;
      b.airborne = true;
      b.yaw = d.openYaw;
      // Each bot wanders a little side to side on the way out, its own way.
      b.drop = { state: "belt", tx, tz, flight: null, wobble: rng() * Math.PI * 2, wobbleHz: 0.4 + rng() * 0.5 };
    }
  }
  game.showWaveBanner("FLOOR'S MOVING — off the edge, trolls", 2600);
}

/* The belt runs; the bots on it are carried to the edge and fall toward
   where they want to land; the zone goes live once the floor has gone. */
function updateRoyaleDropWorld(dt) {
  const r = royale, d = r.drop;
  if (!d || d.phase === "lobby") return;
  if (d.phase === "belt") {
    d.updateBelt(dt);
    if (!r.live && d.phase === "done") {
      r.live = true;
      r.t = 0;
      game.showWaveBanner("Everyone's out — last troll standing wins", 1800);
    }
  }
  if (!game.net.isBotHost()) return;
  const dir = d.openDir, S = DROP.boxSize / 2, c = d.boxCentre;
  for (const b of game.bots.bots) {
    const bd = b.drop;
    if (!bd || !b.alive) continue;
    if (bd.state === "belt") {
      // Carried along openDir, steering into the opening's width with a
      // little wobble; held at the wall until it's lined up with the gap.
      if (d.onBelt(b.pos)) {
        bd.wobble += dt * bd.wobbleHz * Math.PI * 2;
        const dx = b.pos.x - c.x, dz = b.pos.z - c.z;
        const fwd = dx * dir.x + dz * dir.z, side = dx * -dir.z + dz * dir.x;   // side: +ve to the right of openDir
        const wantSide = Math.sin(bd.wobble) * 2.5;
        const sideStep = Math.max(-3 * dt, Math.min(3 * dt, wantSide - side));
        const lined = Math.abs(side + sideStep) < DROP.beltW / 2 - 0.8;
        const fwdStep = (!lined && fwd + d.beltStep(dt) > S - 0.6) ? Math.max(0, S - 0.6 - fwd) : d.beltStep(dt);
        b.pos.x += dir.x * fwdStep + -dir.z * sideStep;
        b.pos.z += dir.z * fwdStep + dir.x * sideStep;
        b.pos.y = DROP.boxY;
        b.groundY = b.pos.y;
        b.yaw = d.openYaw;
        b.dropCode = 0;
      } else {
        bd.flight = new Flight(b.pos, game.builtMap.map.edge, { glider: false, vel: _edgeVel.set(dir.x * DROP.beltSpeed, -2, dir.z * DROP.beltSpeed) });
        bd.state = "fly";
        b.dropCode = DROP_FALL;
      }
    } else if (bd.state === "fly") {
      const f = bd.flight;
      const dx = bd.tx - f.pos.x, dz = bd.tz - f.pos.z, dist = Math.hypot(dx, dz);
      const yaw = Math.atan2(-dx, -dz);
      f.update(dt, { forward: dist > 6 ? 1 : 0, strafe: 0, yaw, pitch: dist > 40 ? -0.9 : -0.3, open: false }, dropGround);
      b.pos.copy(f.pos);
      b.groundY = f.pos.y;
      b.yaw = yaw;
      b.dropCode = f.state === "fall" ? DROP_FALL : 0;
      if (f.state === "landed") { bd.state = "roll"; bd.t = 0; b.roll = 0.001; }
    } else if (bd.state === "roll") {
      // Tuck and roll off the landing, carried a few metres forward, then run.
      bd.t += dt;
      const k = Math.min(1, bd.t / ROLL_TIME);
      const step = ROLL_SPEED * (1 - k) * dt;
      const nx = b.pos.x - Math.sin(b.yaw) * step, nz = b.pos.z - Math.cos(b.yaw) * step;
      const g = dropGround(nx, nz, b.pos.y + 0.6);
      if (g != null && Math.abs(g - b.pos.y) < 0.6) { b.pos.x = nx; b.pos.z = nz; b.pos.y = g; b.groundY = g; }
      b.roll = k < 1 ? Math.max(0.001, k) : 0;
      if (k >= 1) { b.airborne = false; b.drop = null; }
    }
  }
}

/* You, on the belt: after your own walking has run (player-update.js), the
   floor carries you along openDir while you're on it; off the edge (or
   through where the floor was) you're falling, and the drop takes over. */
export function updateBeltPlayer(dt) {
  const r = royale, d = r.drop;
  if (d.onBelt(game.move.pos)) {
    const step = d.beltStep(dt);
    game.move.pos.x += d.openDir.x * step;
    game.move.pos.z += d.openDir.z * step;
  }
  if (game.move.pos.y < DROP.boxY - 1.5) {
    // Off with the speed you had: your run plus the belt under you.
    _edgeVel.copy(game.move.velocity).addScaledVector(_edgeAt.set(d.openDir.x, 0, d.openDir.z), DROP.beltSpeed);
    r.flight = new Flight(game.move.pos, game.builtMap.map.edge, { glider: false, vel: _edgeVel });
    r.me = "fall";
    game.setHolding("none");
    game.showWaveBanner("Steer with the camera — look down to dive", 1800);
  }
}

/* You, in the air. */
export function updateDropPlayer(dt, ix, iz) {
  const r = royale;
  const f = r.flight;
  f.update(dt, { forward: iz, strafe: ix, yaw: game.look.yaw, pitch: game.look.pitch, open: false }, dropGround);
  game.move.pos.copy(f.pos);
  game.move.velocity.copy(f.vel);
  if (f.state === "glide" && r.me !== "glide") { r.me = "glide"; setPlayerGlider(true); game.audio.reload(); }
  if (f.state === "landed") {
    game.move.reset(f.pos.x, f.pos.z, f.pos.y);
    // Tuck and roll off the landing (the way you were looking), then the
    // gun comes up and you're off. No damage, however far you fell.
    r.me = "roll";
    r.rollT = 0;
    r.rollYaw = r.me === "glide" ? f.heading : game.look.yaw;
    r.flight = null;
    setPlayerGlider(false);
    game.setHolding("none");
    game.audio.land(7);
  }
}

/* The landing roll: you're carried forward and can't act till it's done. */
export const ROLL_SPEED = 5;   // m/s at the start of the roll, easing to 0
export function royaleRolling() { return royale?.me === "roll" && game.player.alive; }
export function royaleRollK() { return royaleRolling() ? Math.min(1, royale.rollT / ROLL_TIME) : 0; }
export function updateRoyaleRoll(dt) {
  const r = royale;
  r.rollT += dt;
  if (r.rollT < ROLL_TIME) return;
  r.me = "ground";
  game.setHolding("gun");
}

/* Joined after the sky lobby (onHello / onStage "bt"): skip our own lobby,
   step onto the belt where the room's is, and run the match clock from where
   the room's is. Once the floor has gone there's no way in: watch till the
   next match. */
export const ROYALE_BOX_GONE = 1e6;
export function applyRoyaleCatchUp() {
  const c = game.royaleCatchUp;
  if (!c || !royale?.drop || game.gameState !== "playing" || !game.isStaging()) return;
  game.royaleCatchUp = null;
  const late = (performance.now() - c.at) / 1000;
  if (performance.now() - c.at > 30000) return;   // stale: from some older match
  if (c.sd && (c.sd >>> 0) !== royale.seed) setupRoyale(c.sd >>> 0);
  game.endStaging();
  const r = royale, d = r.drop;
  d.beltT = Math.min(+c.bt + late, ROYALE_BOX_GONE);
  if (c.lv) { r.live = true; r.t = (+c.rt || 0) + late; }
  if (d.beltT < DROP.floorGoneAfter) {
    // On the floor near the open side, facing it, with everyone else.
    const k = DROP.boxSize / 2 - 5;
    game.move.reset(d.boxCentre.x + d.openDir.x * k, d.boxCentre.z + d.openDir.z * k, DROP.boxY);
    game.look.yaw = d.openYaw;
    r.me = "belt";
  } else royaleLateSpectate();
}

function royaleLateSpectate() {
  const r = royale;
  r.lateJoin = true;
  r.me = "ground";
  r.flight = null;
  r.live = true;
  setPlayerGlider(false);
  game.player.alive = false;
  game.player.hp = 0;
  game.player.spawnGuard = 0;
  game.updateSpawnGuardHud();
  game.showWaveBanner("The floor's already gone — spectating till the next one", 2600);
}

export function teardownRoyale() {
  if (!royale) return;
  royale.drop?.dispose();
  setPlayerGlider(false);
  royale.visual.dispose();
  royale.loot.clear();
  royale = null;
  game.els.cringe?.classList.remove("is-on");
  if (game.els.royaleAct) game.els.royaleAct.hidden = true;
  hideSpectateHud();
}

/* Everyone still standing, counted once each: us, peers, and the bots we
   host (on anyone else's screen those arrive as peers). */
export function royaleAliveList() {
  const list = [];
  if (game.player.alive) list.push({ id: game.net.id, name: "You", pos: game.move.pos, yaw: game.look.yaw, me: true });
  const seen = new Set([game.net.id]);
  for (const rp of game.remotes.byId.values()) {
    if (!rp.alive || seen.has(rp.netId)) continue;
    seen.add(rp.netId);
    list.push({ id: rp.netId, name: rp.tagText, pos: rp.pos, yaw: rp.yaw || 0 });
  }
  for (const b of game.bots.bots) {
    if (!b.alive || seen.has(b.id)) continue;
    seen.add(b.id);
    list.push({ id: b.id, name: b.name, pos: b.pos, yaw: b.yaw || 0 });
  }
  return list;
}

export function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function updateRoyale(dt) {
  const r = royale;
  if (!r) return;
  updateRoyaleDropWorld(dt);
  if (r.live && !r.over) r.t += dt;
  const s = r.zone.state(r.t);
  r.visual.update(s, r.t);
  r.loot.update(dt, game.camera, game.player.alive ? game.move.pos : game.camera.position);

  const alive = royaleAliveList();
  if (r.live) r.peak = Math.max(r.peak, alive.length);

  // Zone, countdown, trolls left.
  const secs = Math.max(0, Math.ceil(s.left));
  const phase = s.stage === "final" ? "Final circle" : s.stage === "closing" ? `Zone ${s.phase} closing` : `Zone ${s.phase}`;
  const timer = s.stage === "final" ? "—" : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  const onBelt = r.drop?.phase === "belt" && !r.live;
  const phaseText = onBelt ? "Floor's moving" : phase;
  const timerText = onBelt ? "—" : timer;
  if (game.els.royalePhase.textContent !== phaseText) game.els.royalePhase.textContent = phaseText;
  if (game.els.royaleTimer.textContent !== timerText) game.els.royaleTimer.textContent = timerText;
  const left = `${alive.length} left`;
  if (game.els.royaleAlive.textContent !== left) game.els.royaleAlive.textContent = left;
  game.els.royale.classList.toggle("is-closing", s.stage === "closing");
  const key = `${s.phase}:${s.stage}`;
  if (r.live && key !== r.stageKey) {
    if (r.stageKey) {
      if (s.stage === "closing") { game.showWaveBanner("The Cringe is closing in", 1600); game.audio.wave(); }
      else if (s.stage === "wait") game.showWaveBanner(`Zone ${s.phase} marked`, 1300);
      else if (s.stage === "final") game.showWaveBanner("Final circle", 1400);
    }
    r.stageKey = key;
  }

  // The Cringe: whole points of damage as they add up, armour ignored.
  const out = game.player.alive && r.live && RoyaleZone.outside(s, game.move.pos.x, game.move.pos.z);
  game.els.cringe.classList.toggle("is-on", !!out);
  if (out && s.dps > 0) {
    r.zoneAcc += s.dps * dt;
    if (r.zoneAcc >= 1) {
      const d = Math.floor(r.zoneAcc);
      r.zoneAcc -= d;
      game.damagePlayer(d, null, "zone");
    }
  } else r.zoneAcc = 0;

  // The bots we host take the Cringe too, and leave their gear when they go.
  if (game.net.isBotHost()) {
    for (const b of game.bots.bots) {
      if (r.live && b.alive && s.dps > 0 && RoyaleZone.outside(s, b.pos.x, b.pos.z)) {
        b.zoneAcc = (b.zoneAcc || 0) + s.dps * dt;
        if (b.zoneAcc >= 1) {
          const d = Math.floor(b.zoneAcc);
          b.zoneAcc -= d;
          const { killed } = game.bots.applyHit(b.id, d, { pierce: true });
          if (killed) {
            game.net.reportDeathAs(b.id, null, "zone", false);
            game.registerDeath(b.name, null, "zone", { victimTeam: b.team, victimIsBot: true, victimId: b.id });
          }
        }
      }
      if (!b.alive && !b.royaleDropped) { b.royaleDropped = true; royaleDropBotGear(b); }
      if (b.alive && !b.airborne) updateRoyaleBot(b, dt);
    }
  }
  if (r.noises.length && r.t - r.noises[0].t > 5) r.noises.shift();

  if (game.player.alive && r.live) royaleAutoPickup();
  updateRoyaleAct(dt);

  if (game.player.alive) {
    if (game.player.spawnGuard > 0) {
      game.player.spawnGuard -= dt;
      if (game.player.spawnGuard <= 0) { game.player.spawnGuard = 0; game.updateSpawnGuardHud(); }
      else if (game.els.spawnGuard?.hidden) game.updateSpawnGuardHud();
    }
  } else {
    // Out: watch whoever got you, then whoever is nearest; prev/next (and
    // the mouse, stick or a drag) go round everyone still standing.
    const prev = r.spectate;
    r.spectate = pickSpectateTarget(r.spectate, alive);
    if (r.spectate && r.spectate !== prev && r.spectate.id !== prev?.id) onSpectateTarget();
    const out = r.lateJoin ? "Joined mid-match — you're in the next one"
      : `Eliminated — ${ordinal(r.place || alive.length + 1)} of ${r.peak}`;
    if (!r.outShown) { r.outShown = true; game.els.respawn.hidden = false; }
    const watching = royaleSpectating();
    // The spectator view is clear: no 62% death fade, no low-HP pulse, and
    // the centre "Eliminated" line moves down into the bar.
    if (watching) game.els.deathfade.classList.remove("is-dead");
    game.els.respawn.hidden = watching;
    game.els.spectate.hidden = !watching;
    game.els.killcamBars.parentElement.classList.toggle("to-spectating", watching);
    const text = watching ? out : r.spectate ? `${out} · watching ${r.spectate.name}` : out;
    if (game.els.respawnText.textContent !== text) game.els.respawnText.textContent = text;
    if (watching) {
      const others = spectateOrder(alive);
      const n = `${others.findIndex((a) => a.id === r.spectate.id) + 1} of ${others.length} alive`;
      if (game.els.spectateOut.textContent !== out) game.els.spectateOut.textContent = out;
      if (game.els.spectateName.textContent !== r.spectate.name) game.els.spectateName.textContent = r.spectate.name;
      if (game.els.spectateN.textContent !== n) game.els.spectateN.textContent = n;
      const one = others.length < 2;
      game.els.spectatePrev.hidden = one;
      game.els.spectateNext.hidden = one;
    }
  }

  // The end: one troll left (or none, if the Cringe took the last two).
  const ended = r.live && !r.over && r.t > 3 && ((r.peak >= 2 && alive.length <= 1) || alive.length === 0);
  if (ended) {
    r.endT += dt;
    if (r.endT > 1.2) finishRoyale(alive);
  } else r.endT = 0;
}

function finishRoyale(alive) {
  const r = royale;
  r.over = true;
  hideSpectateHud();
  const won = game.player.alive;
  const place = won ? 1 : (r.place || r.peak);
  const bonus = r.lateJoin ? 0 : Math.max(0, r.peak - place) * 4 + (won ? 40 : 0);
  if (bonus > 0) game.addMatchXp(bonus, won ? "LAST TROLL STANDING" : `${ordinal(place).toUpperCase()} PLACE`);
  const winner = alive.find((a) => !a.me)?.name;
  r.finalPlace = place;
  game.endMatch(won ? "You win — last troll standing" : winner ? `${winner} wins` : "The Cringe wins");
}

/* Out of the match: where we finished, and everything we carried on the floor. */
export function royaleOnDeath() {
  const r = royale;
  r.place = royaleAliveList().length + 1;
  r.act = null;
  // Out for good: nothing left to protect (its pill hung over the spectator view).
  game.player.spawnGuard = 0;
  game.updateSpawnGuardHud();
  let n = 0;
  const put = (fields) => {
    const a = n * 2.39996, d = 0.55 + n * 0.18;
    n++;
    royaleDrop(fields, game.move.pos.x + Math.cos(a) * d, game.move.pos.z + Math.sin(a) * d);
  };
  for (const id of [game.player.weaponId, game.player.secondaryId]) {
    const ws = id && game.player.weapons[id];
    if (ws) put(gunFields(ws));
  }
  for (let i = 0; i < game.player.plates; i++) put({ k: "plate", n: 1 });
  for (let i = 0; i < game.player.heals; i++) put({ k: "heal", n: 1 });
  game.player.plates = 0;
  game.player.heals = 0;
  game.player.armor = 0;
  updateRoyaleGear();
}

function gunFields(ws) {
  return { k: "gun", w: ws.def.id, a: ws.def.attachments, r: ws.royaleRarity | 0, ammo: ws.ammoReserve + ws.ammoInMag };
}

function royaleDrop(fields, x, z) {
  const it = royale.loot.add({ id: royale.loot.nextDropId(game.net.id), ...fields, x, y: royaleGround(x, z), z });
  game.net.publishLoot({ k: "add", item: LootField.wire(it) });
  return it;
}

/* A bot we host went down: whatever it was carrying. */
function royaleDropBotGear(b) {
  const at = (i) => [b.pos.x + Math.cos(i * 2.4) * (0.6 + i * 0.15), b.pos.z + Math.sin(i * 2.4) * (0.6 + i * 0.15)];
  let i = 0;
  if (WEAPON_DEFS[b.weaponId]) {
    const [x, z] = at(i++);
    royaleDrop({ k: "gun", w: b.weaponId, a: b.gunAtt || defaultLoadoutFor(b.weaponId), r: b.gunRarity ?? 0 }, x, z);
  }
  for (let n = 0; n < (b.plates | 0); n++) { const [x, z] = at(i++); royaleDrop({ k: "plate", n: 1 }, x, z); }
  for (let n = 0; n < (b.heals | 0); n++) { const [x, z] = at(i++); royaleDrop({ k: "heal", n: 1 }, x, z); }
  b.plates = 0;
  b.heals = 0;
}

// ---- Troll Royale bots (phase 2): they loot, plate up, heal, move with
// the zone and go to where the shooting is. All on the bot host. bots.js
// stays generic: it walks to whatever botObjective() hands it.

const BOT_LOOT_REACH = 1.3;      // metres: close enough to grab it
const BOT_LOOT_SEARCH = 30;      // how far a bot looks for loot it wants
const BOT_LOOT_SEARCH_ARMED = 10;
const BOT_NOISE_RANGE = 45;      // gunfire this close draws an armed bot in

/* First sight of a bot this match: a pistol and empty pockets, like us. */
function initRoyaleBot(b) {
  b.royaleInit = true;
  b.weaponId = ROYALE.startWeapon;
  b.secondaryId = ROYALE.startWeapon;
  b.gunRarity = null;     // null = still on the pistol
  b.gunAtt = null;
  b.armor = 0;
  b.plates = 0;
  b.heals = 0;
  b.act = null;
  b.lootId = null;
}

function botArmed(b) { return b.gunRarity != null; }

function botWants(b, it) {
  if (it.k === "gun") {
    if (WEAPON_DEFS[it.w]?.cls === "sidearm") return false;   // it already has one
    return !botArmed(b) || (it.r | 0) > b.gunRarity;
  }
  if (it.k === "plate") return (b.plates | 0) < ROYALE.carryPlates;
  if (it.k === "heal") return (b.heals | 0) < ROYALE.carryHeals;
  return false;
}

/* The loot a bot is heading for: it keeps its pick while it's still there
   and still wanted, else the nearest wanted item inside the coming circle
   that no other bot has already called. */
function royaleBotLoot(b, circle) {
  const items = royale.loot.items;
  if (b.lootId) {
    const it = items.get(b.lootId);
    if (it && botWants(b, it)) return it;
    b.lootId = null;
  }
  const claimed = new Set();
  for (const o of game.bots.bots) if (o !== b && o.alive && o.lootId) claimed.add(o.lootId);
  const reach = botArmed(b) && (b.plates | 0) > 0 ? BOT_LOOT_SEARCH_ARMED : BOT_LOOT_SEARCH;
  let best = null, bestD = reach;
  for (const it of items.values()) {
    if (claimed.has(it.id) || !botWants(b, it)) continue;
    if (Math.hypot(it.x - circle.x, it.z - circle.z) > circle.r) continue;
    const d = Math.hypot(it.x - b.pos.x, it.z - b.pos.z);
    if (d < bestD) { best = it; bestD = d; }
  }
  b.lootId = best?.id || null;
  return best;
}

/* The newest gunfire an armed bot can hear that isn't its own. */
function royaleNoiseFor(b) {
  if (!botArmed(b)) return null;
  for (let i = royale.noises.length - 1; i >= 0; i--) {
    const n = royale.noises[i];
    if (royale.t - n.t > 4 || n.by === b.id) continue;
    const d = Math.hypot(n.x - b.pos.x, n.z - b.pos.z);
    if (d > 6 && d < BOT_NOISE_RANGE) return { id: `noise-${Math.round(n.x / 6)}-${Math.round(n.z / 6)}`, x: n.x, z: n.z };
  }
  return null;
}

/* Gunfire, for the bots to hear. */
export function royaleNoise(x, z, by) {
  if (!royale?.live) return;
  royale.noises.push({ x, z, t: royale.t, by });
  if (royale.noises.length > 24) royale.noises.shift();
}

/* Where the zone says a bot must be, or null. `urgent` when it's already
   burning: bots.js then moves it even mid-fight. */
export function royaleBotObjective(b) {
  if (!royale.live) return null;
  if (!b.royaleInit) initRoyaleBot(b);
  const s = royale.zone.state(royale.t);
  const c = s.next && s.stage !== "final" ? s.next : s;
  const outNow = RoyaleZone.outside(s, b.pos.x, b.pos.z);
  const d = Math.hypot(b.pos.x - c.x, b.pos.z - c.z);
  const zone = { id: `zone-${s.phase}`, x: c.x, z: c.z, radius: Math.max(2, c.r * 0.5), urgent: outNow };
  const soon = s.stage !== "wait" || s.left < 15;
  if (outNow || (d > c.r * 0.8 && soon)) return zone;
  const it = royaleBotLoot(b, c);
  // Without a real gun, getting one beats trading pistol shots.
  if (it) {
    const d = Math.hypot(it.x - b.pos.x, it.z - b.pos.z);
    const need = (it.k === "gun" && !botArmed(b))
      || (it.k === "plate" && !(b.plates | 0) && !(b.armor | 0) && d < 15)
      || (it.k === "heal" && b.hp < 50 && d < 15);
    return { id: `loot-${it.id}`, x: it.x, z: it.z, radius: 0.9, urgent: need || d < 8 };
  }
  const noise = royaleNoiseFor(b);
  if (noise) return { ...noise, radius: 3 };
  if (d > c.r * 0.8) return zone;
  return royaleBotRoam(b, c, s.phase);
}

/* Armed and stocked, with nothing to hear: move about inside the circle
   like a player rotating, one spot at a time, and fight whoever it runs
   into. It used to fall through to bots.js's hunt, which walks at the
   nearest enemy anywhere on the map: a wallhack, and in a 100-troll royale
   it emptied the island in a couple of minutes. */
function royaleBotRoam(b, c, phase) {
  const r = b.roam;
  const there = r && Math.hypot(r.x - b.pos.x, r.z - b.pos.z) < 4;
  const stale = !r || r.phase !== phase || there || royale.t > r.until
    || Math.hypot(r.x - c.x, r.z - c.z) > c.r * 0.85;
  if (stale) {
    // A spot on dry land inside the circle: a floor loot spot (taken or not),
    // falling back to the middle.
    let x = c.x, z = c.z;
    const inside = royale.roamSpots ||= [...royale.loot.items.values()].filter((it) => (it.y || 0) < 100).map((it) => ({ x: it.x, z: it.z }));
    for (let i = 0; i < 12; i++) {
      const p = inside[Math.floor(Math.random() * inside.length)];
      if (p && Math.hypot(p.x - c.x, p.z - c.z) < c.r * 0.8) { x = p.x; z = p.z; break; }
    }
    b.roam = { x, z, phase, n: (r?.n || 0) + 1, until: royale.t + 25 + Math.random() * 20 };
  }
  return { id: `roam-${b.id}-${b.roam.n}`, x: b.roam.x, z: b.roam.z, radius: 3, urgent: false };
}

/* Per frame, per bot we host: grab what it reached, plate or heal when
   nobody is in sight. */
function updateRoyaleBot(b, dt) {
  if (!b.royaleInit) initRoyaleBot(b);
  if (b.lootId) {
    const it = royale.loot.items.get(b.lootId);
    if (!it) b.lootId = null;
    else if (Math.hypot(it.x - b.pos.x, it.z - b.pos.z) < BOT_LOOT_REACH && botWants(b, it)) {
      royaleTake(it);
      b.lootId = null;
      if (it.k === "gun") {
        // A real gun in hand: the pistol goes back to being the sidearm.
        if (botArmed(b)) {
          royaleDrop({ k: "gun", w: b.weaponId, a: b.gunAtt || defaultLoadoutFor(b.weaponId), r: b.gunRarity }, b.pos.x + 0.6, b.pos.z);
        }
        b.weaponId = it.w;
        b.gunAtt = it.a;
        b.gunRarity = it.r | 0;
        b.holdingSecondary = false;
      } else if (it.k === "plate") b.plates++;
      else if (it.k === "heal") b.heals++;
    }
  }
  // Plate or heal with nobody in sight, or mid-fight while nothing has hit
  // it for a couple of seconds (behind cover); a hit cancels it.
  const quiet = !b.lastTargetId || performance.now() - (b.hurtAt || 0) > 2000;
  if (b.act) {
    if (!quiet || (b.hurtAt || 0) > b.act.at) { b.act = null; return; }
    b.act.t += dt;
    if (b.act.t < b.act.dur) return;
    if (b.act.kind === "plate") { b.plates--; b.armor = Math.min(ROYALE.maxArmor, (b.armor | 0) + ROYALE.plateHp); }
    else { b.heals--; b.hp = b.maxHp || 100; }
    b.act = null;
  } else if (quiet && b.plates > 0 && (b.armor | 0) < ROYALE.maxArmor) {
    b.act = { kind: "plate", t: 0, dur: ROYALE.plateTime * 1.2, at: performance.now() };
  } else if (quiet && b.heals > 0 && b.hp < 70) {
    b.act = { kind: "heal", t: 0, dur: ROYALE.healTime, at: performance.now() };
  }
}

/* Troll Royale pacing (user, 2026-10-03: "within a couple of minutes we
   went from 100 people to 10 ... match only lasted 2 minutes and 38
   seconds"). A hundred trolls on a 400 m island are all in each other's
   sight the moment they land, so left to TDM rules the bots wipe each other
   out in the first minute. Two dials, both on bots only (what a bot does to
   YOU is untouched): how far off a bot notices someone, and how hard bots
   hit each other, both growing as the zone closes, so the early game is
   looting and skirmishes and the last circles are a proper fight. */
const ROYALE_BOT_SIGHT = [16, 20, 26, 34, 45];      // metres, by zone phase
const ROYALE_BOT_VS_BOT = [0.2, 0.3, 0.45, 0.7, 1];  // damage scale, by zone phase
function royalePhaseIdx() {
  if (!royale?.live) return 0;
  const s = royale.zone.state(royale.t);
  return Math.max(0, Math.min(4, (s.phase | 0) - 1 + (s.stage === "final" ? 1 : 0)));
}
export function royaleBotSight(b) {
  // Someone shooting at it gets noticed whatever the range.
  if (b.hurtAt && performance.now() - b.hurtAt < 3000) return 45;
  return ROYALE_BOT_SIGHT[royalePhaseIdx()];
}
export function royaleBotVsBot() { return ROYALE_BOT_VS_BOT[royalePhaseIdx()]; }

/* A bot's shot hits as hard as the gun it's holding: the pistol it lands
   with is weak, a looted gun better, a rarer one better still. */
export function royaleBotDamage(b, dmg) {
  if (!botArmed(b) || b.holdingSecondary) return dmg * 0.65;
  return dmg * (0.95 + 0.07 * (b.gunRarity | 0));
}

/* Someone else's pickup or drop. */
export function onRoyaleLoot(p, m) {
  if (!royale) return;
  if (m.k === "take") { royale.loot.take(String(m.i)); royale.drop?.lobbyTake(String(m.i)); }
  else if (m.k === "add" && m.item && typeof m.item.id === "string") royale.loot.add(m.item);
}

function royaleTake(it) {
  royale.loot.take(it.id);
  royale.drop?.lobbyTake(it.id);
  game.net.publishLoot({ k: "take", i: it.id });
}

/* Plates, Hopium and ammo go straight into your pockets when there's room. */
function royaleAutoPickup() {
  const it = royale.loot.nearest(game.move.pos.x, game.move.pos.z, 1.3, (x) => x.k !== "gun" && royaleWants(x));
  if (!it) return;
  royaleTake(it);
  if (it.k === "plate") game.player.plates++;
  else if (it.k === "heal") game.player.heals++;
  else if (it.k === "ammo") {
    for (const id of [game.player.weaponId, game.player.secondaryId]) {
      const ws = id && game.player.weapons[id];
      if (ws) ws.ammoReserve = Math.min(ws.def.reserveMax, ws.ammoReserve + Math.ceil(ws.def.reserveMax * 0.4));
    }
  }
  game.audio.reload();
  game.showWaveBanner(`+ ${ITEM_NAMES[it.k]}`, 700);
  updateRoyaleGear();
}

export function royaleWants(it) {
  if (it.k === "plate") return game.player.plates < ROYALE.carryPlates;
  if (it.k === "heal") return game.player.heals < ROYALE.carryHeals;
  if (it.k === "ammo") {
    return [game.player.weaponId, game.player.secondaryId].some((id) => {
      const ws = id && game.player.weapons[id];
      return ws && ws.ammoReserve < ws.def.reserveMax;
    });
  }
  return false;
}

/* A gun off the floor: into the empty slot if there is one, else in place
   of the one in your hands, which drops where you stand. */
export function royalePickupGun(it) {
  royaleTake(it);
  const ws = new WeaponState(it.def);
  ws.royaleRarity = it.r | 0;
  const inMag = Math.min(ws.def.magSize, it.ammo ?? ws.def.magSize);
  ws.ammoInMag = inMag;
  ws.ammoReserve = it.ammo != null ? Math.max(0, it.ammo - inMag) : Math.round(ws.def.reserveMax * 0.35);
  let slot = !game.player.secondaryId ? "secondary" : game.currentWeaponSlot === "secondary" ? "secondary" : "primary";
  // The same gun as the other slot would share its key: take that slot.
  const other = slot === "primary" ? game.player.secondaryId : game.player.weaponId;
  if (other === it.def.id) slot = slot === "primary" ? "secondary" : "primary";
  const oldId = slot === "primary" ? game.player.weaponId : game.player.secondaryId;
  if (oldId && game.player.weapons[oldId]) {
    const a = Math.random() * Math.PI * 2;
    royaleDrop(gunFields(game.player.weapons[oldId]), game.move.pos.x + Math.cos(a) * 0.8, game.move.pos.z + Math.sin(a) * 0.8);
    delete game.player.weapons[oldId];
  }
  if (slot === "primary") game.player.weaponId = it.def.id; else game.player.secondaryId = it.def.id;
  game.player.weapons[it.def.id] = ws;
  game.currentWeaponSlot = slot;
  game.setActiveWeaponMesh(it.def);
  game.setHolding("gun");
  game.audio.reload();
  game.showWaveBanner(`Picked up ${gunDisplayName(it)}`, 1200);
}

/* Plating up / Hopium: a short channel, cancelled by firing or dying. */
export function startRoyaleAct(kind) {
  if (!royale || !game.player.alive || royale.act || game.isStaging()) return;
  if (kind === "plate" && (game.player.plates <= 0 || game.player.armor >= ROYALE.maxArmor)) return;
  if (kind === "heal" && (game.player.heals <= 0 || game.player.hp >= game.player.maxHp)) return;
  royale.act = { kind, t: 0, dur: kind === "plate" ? ROYALE.plateTime : ROYALE.healTime, rate: (game.player.maxHp - game.player.hp) / ROYALE.healTime };
  game.audio.throwGear();
}

export function cancelRoyaleAct() {
  if (royale) royale.act = null;
  if (game.els.royaleAct) game.els.royaleAct.hidden = true;
}

function updateRoyaleAct(dt) {
  const a = royale.act;
  if (!a || !game.player.alive) { if (a) royale.act = null; game.els.royaleAct.hidden = true; return; }
  a.t += dt;
  const k = Math.min(1, a.t / a.dur);
  if (a.kind === "heal") game.player.hp = Math.min(game.player.maxHp, game.player.hp + a.rate * dt);
  game.els.royaleAct.hidden = false;
  const text = a.kind === "plate" ? "Plating up" : "Hopium";
  if (game.els.royaleActText.textContent !== text) game.els.royaleActText.textContent = text;
  game.els.royaleActFill.style.width = `${Math.round(k * 100)}%`;
  game.els.royaleActFill.style.background = a.kind === "plate" ? "#7fb2ff" : "#55ff7a";
  if (k < 1) return;
  if (a.kind === "plate") {
    game.player.plates--;
    game.player.armor = Math.min(ROYALE.maxArmor, game.player.armor + ROYALE.plateHp);
    game.audio.reload();
  } else {
    game.player.heals--;
    game.player.hp = game.player.maxHp;
  }
  royale.act = null;
  game.els.royaleAct.hidden = true;
  updateRoyaleGear();
}

export function updateRoyaleGear() {
  if (!game.els.armor) return;
  const on = !!royale;
  game.els.armor.hidden = !on;
  game.els.gearPlates.hidden = !on;
  game.els.gearHeals.hidden = !on;
  if (!on) return;
  [...game.els.armor.children].forEach((seg, i) => {
    seg.style.setProperty("--p", Math.max(0, Math.min(1, (game.player.armor - i * ROYALE.plateHp) / ROYALE.plateHp)).toFixed(3));
  });
  game.els.gearPlatesN.textContent = String(game.player.plates);
  game.els.gearHealsN.textContent = String(game.player.heals);
  game.els.gearPlates.classList.toggle("is-empty", game.player.plates <= 0);
  game.els.gearHeals.classList.toggle("is-empty", game.player.heals <= 0);
}

/* Spectating: keep watching someone while they're alive; our killer first. */
function pickSpectateTarget(cur, alive) {
  const others = alive.filter((a) => !a.me);
  if (!others.length) return null;
  if (cur) { const still = others.find((a) => a.id === cur.id); if (still) return still; }
  const killer = others.find((a) => a.id === game.player.lastKilledBy);
  if (killer) return killer;
  let best = null, bestD = Infinity;
  for (const a of others) {
    const d = Math.hypot(a.pos.x - game.move.pos.x, a.pos.z - game.move.pos.z);
    if (d < bestD) { best = a; bestD = d; }
  }
  return best;
}

export function royaleSpectating() {
  return !!royale && !game.player.alive && !!royale.spectate && !game.killcam.replaying && game.gameState === "playing";
}

/* Everyone still standing but us, in a fixed order so prev/next go round. */
function spectateOrder(alive = royaleAliveList()) {
  return alive.filter((a) => !a.me).sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

export function cycleSpectate(dir) {
  if (!royaleSpectating()) return;
  const others = spectateOrder();
  if (others.length < 2) return;
  const at = others.findIndex((a) => a.id === royale.spectate.id);
  royale.spectate = others[(at + dir + others.length) % others.length];
  onSpectateTarget();
}

/* A new troll to watch: start from behind them, looking where they look. */
let specSnap = true;
function onSpectateTarget() {
  const t = royale?.spectate;
  if (!t) return;
  game.look.yaw = t.yaw;
  game.look.pitch = -0.18;
  specSnap = true;
}

/* A free orbit round whoever we're watching: the mouse, stick or a drag
   swing it (look.yaw / look.pitch, which nothing else reads while we're
   out), pulled in off walls, and eased onto their 15 Hz position updates.
   It used to be locked behind their back and looking where they did. */
const _specPivot = new THREE.Vector3();
const _specWant = new THREE.Vector3();
const _specDir = new THREE.Vector3();
const SPEC_DIST = 4.2;
export function placeSpectateCamera(dt) {
  const t = royale.spectate;
  _specWant.set(t.pos.x, (t.pos.y || 0) + 1.55, t.pos.z);
  if (specSnap || _specPivot.distanceTo(_specWant) > 12) { _specPivot.copy(_specWant); specSnap = false; }
  else _specPivot.lerp(_specWant, Math.min(1, dt * 10));
  game._euler.set(Math.max(-1.1, Math.min(0.45, game.look.pitch)), game.look.yaw, 0);
  _specDir.set(0, 0, 1).applyEuler(game._euler);   // from the pivot back toward the camera
  const len = Math.max(0.6, raycastWorld(game.colliders, _specPivot, _specDir, SPEC_DIST) - 0.15);
  game.camera.position.copy(_specPivot).addScaledVector(_specDir, len);
  game.camera.lookAt(_specPivot.x, _specPivot.y + 0.3, _specPivot.z);
  // Their floating name would sit across the top of the view from here;
  // the spectate bar already says who it is.
  for (const rp of game.remotes.byId.values()) if (rp.netId === t.id && rp.tag) rp.tag.visible = false;
}

export function hideSpectateHud() {
  if (game.els.spectate) game.els.spectate.hidden = true;
  game.els.killcamBars.parentElement.classList.remove("to-spectating");
}

/* Zone rings on the minimap: the Cringe's edge now, and the next circle. */
export function drawRoyaleMinimap(ctx, size) {
  const s = royale.zone.state(royale.t);
  const scale = (size - 12) / (game.ARENA.maxX - game.ARENA.minX);
  const ring = (x, z, r, style, w) => {
    const [mx, mz] = game.mapToMinimap(x, z);
    ctx.strokeStyle = style;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(mx, mz, Math.max(2, r * scale), 0, Math.PI * 2);
    ctx.stroke();
  };
  if (s.next) ring(s.next.x, s.next.z, s.next.r, "rgba(255,255,255,.85)", 1.5);
  ring(s.x, s.z, s.r, "rgba(125,255,74,.95)", 2);
}

/* What used to run at load in game.js: called from game.js where this code was. */
export function initRoyale() {
  game.els.spectatePrev?.addEventListener("click", () => cycleSpectate(-1));
  game.els.spectateNext?.addEventListener("click", () => cycleSpectate(1));

  // Touch: the plate and Hopium chips are buttons.
  game.els.gearPlates?.addEventListener("click", () => startRoyaleAct("plate"));
  game.els.gearHeals?.addEventListener("click", () => startRoyaleAct("heal"));
}
