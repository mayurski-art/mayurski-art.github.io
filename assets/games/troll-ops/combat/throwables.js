// Troll Forces throwables: grenades, blast damage, flash/stun/EMP, bot throws,
// cooking and the networked nades.

import { GrenadeSystem, blastDamage, THROWABLE_DEFS, GRENADE_GRAVITY } from "../gear.js?v=to-hb1kb3-bk1-wst-ig1";
import { streakEntities, streakBusy } from "../streaks/calling.js?v=sk1-si1-gj1-fu1b7b7dc2f1";
import { K9Pack } from "../k9-unit.js?v=k9c-bs1-sb2-gj1b7b7d";
import { damagePlayer, breakSpawnGuard } from "./damage.js?v=dm1-kc2-si1-gj1-fu1b7b7dc2f1";
import * as THREE from "three";
import { round2 } from "../streaks/fire.js?v=sk1-si1-gj1-fu1b7b7dc2f1";
import { segmentBlocked, raycastWorld } from "../ballistics.js?v=cg1-wst-hf1-fu1b7";
import { THROW_TIME } from "../character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1";
import { game } from "../core/state.js?v=st1";

export let grenades;

/* Everything alive that a blast could reach, as { actor, pos } pairs. The
   three enemy systems keep their own arrays, so this is the one place that
   has to know about all of them. */
export function blastCandidates(sparedTeam = game.net.team) {
  const out = [];
  if (game.zdir) {
    for (const z of game.zdir.zombies) {
      if (z.alive && !z.dying) out.push({ actor: z, pos: z.mesh.position });
    }
  }
  if (game.spawner) {
    for (const g of game.spawner.grunts) {
      if (g.alive && !g.dying) out.push({ actor: g, pos: g.mesh.position });
    }
  }
  // Teammates are out: bullets already spare them (hitMeshes skips your own
  // side), and a frag or an airstrike that didn't was a free teamkill that
  // also scored for your side. `sparedTeam` is the thrower's side — ours,
  // unless this is someone else's flash going off on our screen.
  const ffa = !!game.currentMode().ffa;
  for (const rp of game.remotes.byId.values()) {
    if (!rp.alive) continue;
    if (!ffa && sparedTeam && rp.team === sparedTeam) continue;
    out.push({ actor: rp, pos: rp.pos });
  }
  if (game.rangeSet) {
    for (const t of game.rangeSet.targets) {
      if (t.down <= 0) out.push({ actor: t, pos: t.mesh.position });
    }
  }
  // Enemy dogs: a frag or a strike takes them out too. Never our own pack.
  for (const e of streakEntities.values()) {
    if (!(e instanceof K9Pack) || e.owned) continue;
    if (!ffa && sparedTeam && e.team === sparedTeam) continue;
    for (const d of e.dogs) if (d?.alive) out.push({ actor: d, pos: d.pos });
  }
  return out;
}

/* Radial damage. Torso height is added to each target so a grenade resting
   on the floor still measures to a standing chest, not a pair of boots. */
export function areaDamage(centre, radius, damage, def, { fire = false, creditAs = null, botId = null } = {}) {
  const scaled = { ...def, radius, damage, minDamage: fire ? damage * 0.5 : def.minDamage };
  if (botId) { botAreaDamage(botId, centre, scaled, def); return; }
  for (const { actor, pos } of blastCandidates()) {
    const torso = pos.clone();
    torso.y += 0.9;
    const dmg = blastDamage(scaled, centre.distanceTo(torso));
    if (dmg <= 0) continue;
    const dir = torso.clone().sub(centre);
    dir.y = 0;
    dir.normalize();
    // `creditAs` names the thing that actually did this, for blasts that
    // aren't the gun in your hands — an airstrike kill credited to whatever
    // rifle you happened to be holding reads as a bug.
    game.onBulletActorHit(actor, { damage: dmg, isHead: false, point: torso, dir, creditAs });
  }

  // Your own grenade counts. Cooking one too long has to cost you.
  if (game.player.alive) {
    const selfDmg = blastDamage(scaled, centre.distanceTo(game.player.pos)) * (def.selfMult ?? 1);
    if (selfDmg > 0) damagePlayer(selfDmg, game.net.id, def.id);
  }
}

/* A bot's grenade (we host the bot). Same falloff as ours, but it's the
   bot's blast: it spares the bot's own side, not ours, and every hit is
   reported under the bot's id so the killfeed and scores credit it. */
function botAreaDamage(botId, centre, scaled, def) {
  const bot = game.bots.byId(botId);
  if (!bot) return;   // the bot left with its grenade in the air
  const ffa = !!game.currentMode().ffa;
  if (game.player.alive && (ffa || bot.team !== game.net.team)) {
    const dmg = blastDamage(scaled, centre.distanceTo(game.player.pos));
    if (dmg > 0) game.botDealDamage(bot, game.net.id, dmg, false, def.id);
  }
  for (const rp of game.remotes.byId.values()) {
    if (!rp.alive || rp.netId === bot.id) continue;
    if (!ffa && rp.team === bot.team) continue;
    const dmg = blastDamage(scaled, centre.distanceTo(_blastTorso.copy(rp.pos).setY(rp.pos.y + 0.9)));
    if (dmg > 0) game.botDealDamage(bot, rp.netId, dmg, false, def.id);
  }
}
const _blastTorso = new THREE.Vector3();

export let botNadesThrown = 0;

/* A bot throws. bots.js decided that it should and where it wants the
   grenade to land; this works out the arc, puts the grenade in the world
   and tells the room, exactly as releaseCook does for the player. `lob`
   takes the high arc, for dropping one over cover rather than into it. */
export function botThrow(bot, kind, at, lob = false) {
  const def = THROWABLE_DEFS[kind];
  if (!def || !bot.alive) return false;
  const origin = new THREE.Vector3(bot.pos.x, bot.pos.y + 1.6, bot.pos.z);
  const dx = at.x - origin.x, dz = at.z - origin.z;
  const flat = Math.hypot(dx, dz);
  if (flat < 1) return false;
  bot.yaw = Math.atan2(-dx, -dz);
  // Frags skip and roll on after they land: aim a little short.
  const d = flat * (def.roll > 0.3 ? 0.84 : 0.95);
  const dy = (at.y ?? bot.pos.y) - origin.y;
  const v = def.throwSpeed, g = GRENADE_GRAVITY;
  const disc = v ** 4 - g * (g * d * d + 2 * dy * v * v);
  const angle = disc < 0 ? Math.PI / 4
    : Math.atan((v * v + (lob ? 1 : -1) * Math.sqrt(disc)) / (g * d));
  const dir = new THREE.Vector3(dx / flat * Math.cos(angle), Math.sin(angle), dz / flat * Math.cos(angle));
  origin.addScaledVector(dir, 0.5);

  // Flight time sets the fuse: a skilled bot cooks a frag so it goes off
  // about when it lands, with no time to run. A flash always gets to land.
  const flight = d / Math.max(0.1, v * Math.cos(angle));
  let fuse = def.fuse;
  if (def.cookable && def.damage > 0 && bot.diff.nade.cook) fuse = Math.max(flight + 0.35, def.fuse - 1.2);
  if (def.blind) fuse = Math.max(fuse, flight + 0.1);

  const gid = nextNadeId(bot.id);
  const gr = grenades.throwGrenade(def, origin, dir, bot.id, { fuseLeft: fuse, gid, team: bot.team });
  gr.botId = bot.id;
  noteThrow(bot.id);   // the host never hears its own bots' `nade` messages
  if (game.isPvp() && game.net.active) {
    game.net.publishNadeAs(bot.id, bot.team, {
      action: "throw", gid, def: def.id, fuse: round2(fuse),
      ox: round2(origin.x), oy: round2(origin.y), oz: round2(origin.z),
      dx: round2(dir.x), dy: round2(dir.y), dz: round2(dir.z),
    });
  }
  botNadesThrown++;
  return true;
}

/* Everything about a blast that isn't damage: light, sparks, sound, shove. */
export function explosionFx(def, pos) {
  const big = def.kind === "tactical" ? 0.5 : 1;
  game.spawnImpactBurst(pos, def.glow, def.kind === "tactical" ? 14 : 26);

  const flash = game.lightPool.acquire("point", game.scene, { color: def.glow, intensity: 260 * big, distance: def.radius * 2.6 });
  if (flash) {
    flash.position.copy(pos);
    blastLights.push({ light: flash, life: 0.3, max: 0.3, peak: 260 * big });
  }

  if (def.smoke) game.audio.smoke(pos);
  else if (def.emp) game.audio.emp(pos);
  else if (def.kind === "tactical") game.audio.flashbang(0, pos);
  else game.audio.explosion(big, pos);

  const near = Math.max(0, 1 - pos.distanceTo(game.player.pos) / (def.radius * 2));
  if (near > 0) { game.shakeMag = Math.max(game.shakeMag, near * 0.08); game.shakeT = 0.45; }
}

const blastLights = [];

export function updateBlastLights(dt) {
  for (let i = blastLights.length - 1; i >= 0; i--) {
    const b = blastLights[i];
    b.life -= dt;
    b.light.intensity = Math.max(0, (b.life / b.max) * b.peak);
    if (b.life <= 0) { game.lightPool.release(b.light); blastLights.splice(i, 1); }
  }
}

/* Flashbangs only blind what can see them, so a wall is real cover and
   turning away actually helps. */
/* Whether a grenade is a teammate's — which spares us, same as their frags
   do. Our own still gets us: that's the price of a bad throw. */
function friendlyNade(g) {
  return !!(g?.remote || g?.botId) && !game.currentMode().ffa && !!game.net.team && g.team === game.net.team;
}

/* The side a grenade belongs to: ours, unless someone else threw it (a remote
   player, or a bot we simulate). */
function nadeTeam(g) {
  return g?.remote || g?.botId ? g.team : game.net.team;
}

export function flashPlayer(pos, def, g = null) {
  const dist = pos.distanceTo(game.player.pos);
  // Smoke eats a flash the same way a wall does.
  if (!friendlyNade(g) && dist <= def.radius && !segmentBlocked(game.colliders, game.player.pos, pos)
      && !grenades.blocksSight(game.player.pos, pos)) {
    const forward = new THREE.Vector3();
    game.camera.getWorldDirection(forward);
    const toBang = pos.clone().sub(game.player.pos).normalize();
    const facing = Math.max(0, forward.dot(toBang));   // 1 = staring right at it
    const strength = (1 - dist / def.radius) * (0.35 + facing * 0.65);
    game.blindT = Math.max(game.blindT, def.blind * strength);
    game.audio.flashbang(strength, pos);
  }

  for (const { actor, pos: apos } of blastCandidates(nadeTeam(g))) {
    if (pos.distanceTo(apos) > def.radius) continue;
    if (segmentBlocked(game.colliders, apos, pos)) continue;
    if (grenades.blocksSight(apos, pos)) continue;
    if (g?.botId && actor.netId === g.botId) continue;
    stunActor(actor, def.stun);
  }
}

/* A bot shows up in blastCandidates as its RemotePlayer render proxy, which
   has no stun() — the real Bot we simulate does. Grunts and zombies take it
   directly. A remote human's stun happens on their own client. */
export function stunActor(actor, seconds) {
  const bot = actor.netId ? game.bots.byId(actor.netId) : null;
  (bot || actor).stun?.(seconds);
}

export function applyEmpState(on) {
  game.els.emp.classList.toggle("is-on", on);
  game.els.hud.classList.toggle("to-emp-down", on);
}

/* EMP: no damage, no blindness — it takes your gear away. Optics go dark,
   the HUD scrambles, and the radar stops updating, so you have to fight the
   room on what you can actually see. Walls stop it; smoke doesn't. */
export function empPlayer(pos, def, g = null) {
  const dist = pos.distanceTo(game.player.pos);
  if (!friendlyNade(g) && dist <= def.radius && !segmentBlocked(game.colliders, game.player.pos, pos)) {
    const strength = 1 - dist / def.radius;
    game.empT = Math.max(game.empT, def.emp.scramble * (0.4 + strength * 0.6));
    game.audio.empHit();
  }

  // Bots are scrambled even when we weren't — this used to return early the
  // moment we were out of range, so an EMP thrown at a bot never reached it.
  for (const { actor, pos: apos } of blastCandidates(nadeTeam(g))) {
    if (pos.distanceTo(apos) > def.radius) continue;
    if (segmentBlocked(game.colliders, apos, pos)) continue;
    // Bots run on sight, so scrambling them reads as a short stun.
    stunActor(actor, def.emp.scramble * 0.35);
  }
}

export function grenadeCtx() {
  return {
    colliders: game.colliders,
    arena: game.builtMap ? game.builtMap.map.bounds : game.ARENA,
    onExplode: explosionFx,
    onAreaDamage: areaDamage,
    onFlash: flashPlayer,
    onEmp: empPlayer,
    onDetonate: (g, pos) => publishBoom(g.gid, g.def, pos, g.botId ? game.bots.byId(g.botId) : null),
  };
}

/* Tell the room where our grenade actually went off. */
export function publishBoom(gid, def, pos, bot = null) {
  if (!gid || !game.isPvp() || !game.net.active) return;
  const payload = { action: "boom", gid, def: def.id, x: round2(pos.x), y: round2(pos.y), z: round2(pos.z) };
  if (bot) game.net.publishNadeAs(bot.id, bot.team, payload);
  else game.net.publishNade(payload);
}

let nadeSeq = 0;
/* A bot's grenades carry the bot's id, so nobody counting "grenades that
   client threw" by prefix mistakes the host's bots for the host. */
export function nextNadeId(ownerId = game.net.id) { return `${ownerId}-${++nadeSeq}`; }

/* Someone else's throwable, from their `throw`/`boom` messages. */
export function applyRemoteNade(m) {
  if (game.gameState !== "playing") return;
  const def = THROWABLE_DEFS[m.def];
  if (!def) return;
  if (m.action === "throw") {
    noteThrow(m.id);
    const origin = new THREE.Vector3(m.ox, m.oy, m.oz);
    const dir = new THREE.Vector3(m.dx, m.dy, m.dz).normalize();
    grenades.throwGrenade(def, origin, dir, m.id, {
      fuseLeft: Number.isFinite(m.fuse) ? m.fuse : def.fuse, remote: true, gid: m.gid, team: m.team,
    });
  } else if (m.action === "boom") {
    grenades.remoteBoom(m.gid, def, new THREE.Vector3(m.x, m.y, m.z), m.id, m.team, grenadeCtx());
  }
}

/* Someone we can see threw something: their rig plays the overhand arm. */
function noteThrow(id) {
  const p = game.net.peers.get(id);
  if (p) p.throwSeq = (p.throwSeq | 0) + 1;
}

export function refillGear() {
  game.player.gear.lethal = game.loadout.carried("lethal");
  game.player.gear.tactical = game.loadout.carried("tactical");
}

/* The one throwable slot a loadout carries: lethal or tactical. */
export function carriedThrowSlot() {
  return game.loadout.throwKind === "tactical" ? "tactical" : "lethal";
}

/* Cooking: holding the key starts the fuse while the grenade is still in
   your hand. Impact throwables ignore it — they go off where they land. */
export function startCook(slot) {
  if (game.socialUnarmed()) { game.putDownDrink(); return; }   // G: the saloon bar's drink goes down
  if (game.cooking.def || !game.player.alive || game.gameState !== "playing" || game.isStaging() || game.isInfected()) return;
  if (streakBusy()) return;   // no throwables while working a streak (user)
  if (game.player.gear[slot] <= 0) return;
  const def = slot === "lethal" ? game.loadout.lethal : game.loadout.tactical;
  game.cooking.def = def;
  game.cooking.slot = slot;
  game.cooking.fuse = def.fuse;
}

/* Put a cooking throwable back unthrown and unspent. Dying, pausing, a lost
   pointer lock and a hidden tab all end a cook: the key-up that would have
   thrown it never arrives (or arrives on the death cam, which used to throw
   a grenade from wherever the killcam happened to be looking), and a cook
   left set blocked every later throw until the next match. */
export function cancelCook() {
  if (!game.cooking.def) return;
  game.cooking.def = null;
  game.cooking.slot = null;
  game.cooking.fuse = 0;
  game.els.cook.hidden = true;
}

/* `cookedOff`: the fuse ran out in the hand. The grenade is spent but never
   thrown — this used to throw it anyway with a zero fuse, so it went off a
   second time a frame after the in-hand blast: two explosions, double damage. */
export function releaseCook({ cookedOff = false } = {}) {
  if (!game.cooking.def) return;
  if (!game.player.alive || game.gameState !== "playing" || streakBusy()) { cancelCook(); return; }
  const def = game.cooking.def;
  const slot = game.cooking.slot;
  game.cooking.def = null;
  game.cooking.slot = null;
  game.els.cook.hidden = true;
  if (game.player.gear[slot] <= 0) return;
  game.player.gear[slot]--;
  game.updateGearHud();
  if (cookedOff) return;

  const origin = new THREE.Vector3();
  game.camera.getWorldPosition(origin);
  const dir = new THREE.Vector3();
  game.camera.getWorldDirection(dir);
  // Throws arc up a little, so aiming flat still lobs it somewhere useful.
  dir.y += 0.18;
  dir.normalize();
  // Out in front of the face, but never through a wall you're pressed up
  // against: a grenade spawned on the far side of it goes off over there.
  const clear = raycastWorld(game.colliders, origin, dir, 0.85);   // distance to the first solid
  origin.addScaledVector(dir, Math.max(0, Math.min(0.6, clear - 0.25)));

  const gid = nextNadeId();
  grenades.throwGrenade(def, origin, dir, "player", { fuseLeft: game.cooking.fuse, gid });
  if (game.isPvp() && game.net.active) {
    game.net.publishNade({
      action: "throw", gid, def: def.id, fuse: round2(game.cooking.fuse),
      ox: round2(origin.x), oy: round2(origin.y), oz: round2(origin.z),
      dx: round2(dir.x), dy: round2(dir.y), dz: round2(dir.z),
    });
  }
  breakSpawnGuard();
  game.audio.throwGear();
  game.localThrowT = THROW_TIME;
}

/* What used to run at load in game.js: called from game.js where this code was. */
export function initThrowables() {
  // -------------------- melee + throwables --------------------

  grenades = new GrenadeSystem(game.scene, game.lightPool);
}
