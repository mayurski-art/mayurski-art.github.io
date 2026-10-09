// Where people come in: spawn scoring (threats, sight lines, recent deaths,
// teammates), each side's half, spreading spawns apart, and the range's bots.

import { royaleDropView } from "./royale.js?v=md1-gj1-fu1b7b7dc2-wb1m1c4-cup1";
import { look } from "../input/keyboard-mouse.js?v=km1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1";
import * as THREE from "three";
import { insidePolygon } from "../edge.js";
import { groundHeightAt } from "../movement.js?v=umb2-sb2-gj1b7";
import { segmentBlocked } from "../ballistics.js?v=cg1-wst-hf1-fu1b7-wb1";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1";
import { game } from "../core/state.js?v=st1";

/* Everyone currently standing in the world, us included. Spawn scoring and
   the bot targeting both need this; they just filter it differently.

   Bots are included here too — spawnForTeam leans on this list to keep
   people apart, and in solo/bot-filled matches almost everyone on the field
   *is* a bot. Leaving them out made the anti-clump scoring blind to the
   very occupants it was supposed to be spacing out. */
export function occupants() {
  const list = [];
  if (game.player.alive && !royaleDropView()) {
    list.push({ id: game.net.id, team: game.net.team, pos: game.move.pos, yaw: look.yaw });
  }
  for (const rp of game.remotes.byId.values()) {
    if (!rp.alive) continue;
    list.push({ id: rp.netId, team: rp.team, pos: rp.pos, yaw: rp.yaw ?? 0 });
  }
  for (const b of game.bots.bots) {
    if (!b.alive || b.airborne) continue;
    list.push({ id: b.id, team: b.team, pos: b.pos, yaw: b.yaw ?? 0 });
  }
  return list;
}

/* Spawn points that recently got someone killed, so we can stop feeding
   players back into a camped corner. Keyed by spawn index. */
export const spawnDeaths = new Map();
const SPAWN_DEATH_MEMORY = 20;    // seconds a death keeps counting against a point
const SPAWN_SAFE_RADIUS = 18;     // an enemy nearer than this is a real threat
const SPAWN_VIEW_CONE = Math.cos(THREE.MathUtils.degToRad(50));
const SPAWN_TOLERANCE = 25;       // spawns within this of the best are all "safe enough"
export const SPAWN_GUARD = 1.5;          // seconds of respawn protection; ends the moment you fire

// Teammate spacing, Black Ops 2 style: a team spawns loosely spread across
// its side of the map rather than stacked on whoever's nearest. Too close
// is penalized outright (that's how two people end up standing on top of
// each other), and the reward band sits well out from the min so the "best"
// spot is genuinely spread, not just the least-bad crowd.
const SPAWN_MATE_TOO_CLOSE = 10;  // stacking distance — actively bad
const SPAWN_MATE_SWEET_LO = 20;   // reward band: far enough to feel spread...
const SPAWN_MATE_SWEET_HI = 35;   // ...but still the same fight, not the far side of the map

export function notePointDeath(x, z) {
  const pts = game.builtMap?.spawnPoints;
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
  if (game.isSnd()) return team === game.sndAttackTeam ? "lo" : "hi";
  return team === "ghost" ? "hi" : "lo";
}
const SPAWN_SIDE_BONUS = 35;

/* Candidate points are the team's side (split by position — see
   splitSpawnSides; the old list-index split interleaved the teams round the
   perimeter), or the whole ring for a mid-match respawn.

   Within that set the point is *scored* rather than picked at random: a
   uniform pick will happily drop you on top of someone who has been farming
   that corner, and with a 4s respawn that is the fastest way to make a match
   miserable. Enemies nearby, enemies looking this way and recent deaths all
   push a point down; nearby friendlies and being on your own side pull it up. */
export function spawnForTeam(team, forId = game.net.id, { sideOnly = game.spawnOpening || game.isSnd(), groundOnly = false } = {}) {
  const pts = game.builtMap.spawnPoints;
  if (!pts?.length) return { x: 0, y: 0, z: 0 };
  const ffa = !!game.currentMode().ffa;
  const own = new Set(!ffa && game.spawnSides ? game.spawnSides[spawnSideFor(team)] : pts.map((_, i) => i));
  let candidates = sideOnly ? [...own] : pts.map((_, i) => i);
  // Bots spawn on the ground floor: they take the stairs fine now (bots.js
  // planStair), but a bot dropped in an upstairs room (Undergrin's ticket
  // hall) still opens the match far from the fight.
  if (groundOnly || game.bots.byId?.(forId)) {
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
      const enemy = game.currentMode().ffa || o.team !== team;

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
  const me = forId !== game.net.id ? game.move.pos : null;
  const taken = (x, z) => others.some((o) => Math.hypot(o.pos.x - x, o.pos.z - z) < SPAWN_GAP)
    || (me && Math.hypot(me.x - x, me.z - z) < SPAWN_GAP)
    || spawnClaims.some((c) => (forId == null || c.id !== forId) && Math.hypot(c.x - x, c.z - z) < SPAWN_GAP);
  const standable = (x, z) => {
    if (x < game.ARENA.minX + 0.6 || x > game.ARENA.maxX - 0.6 || z < game.ARENA.minZ + 0.6 || z > game.ARENA.maxZ - 0.6) return false;
    if (game.ARENA.edge && !insidePolygon(game.ARENA.edge, x, z)) return false;
    if (game.ARENA.wade && insidePolygon(game.ARENA.wade, x, z)) return false;
    // Same floor as the point (not up on a crate or a ledge), nothing to
    // stand inside, and in sight of the point, not through a wall.
    if (Math.abs(groundHeightAt(game.colliders, x, z, y + 0.5, 0.45) - y) > 0.3) return false;
    for (const c of game.colliders) {
      if (c.max.y <= y + 0.4 || c.min.y > y + 1.9) continue;
      if (x > c.min.x - 0.45 && x < c.max.x + 0.45 && z > c.min.z - 0.45 && z < c.max.z + 0.45) return false;
    }
    return !segmentBlocked(game.colliders, _spawnFrom.set(sp.x, y + 1.2, sp.z), _spawnTo.set(x, y + 1.2, z));
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

export function teamSpawn(opts) { return spawnForTeam(game.net.team, game.net.id, opts); }
/* Where a bot comes in: ground floor only (see groundOnly). */
// `id ?? null`: a bot filled in has no id yet, and undefined would take
// spawnForTeam's default (yours), so it skipped you and landed on you.
export const botSpawn = (team, id, opts = {}) => spawnForTeam(team, id ?? null, { ...opts, groundOnly: true });

// Capped so a player mashing the button in the range can't spawn an
// unbounded crowd — plenty to look at, cheap enough to never matter.
const RANGE_BOT_CAP = 6;

/* "Spawn a bot" button in the Test Range HUD — the only way to get other
   visible characters into the range, which otherwise never has anyone in
   it. Harmless: these bots aim at the player (real steering/animation
   variety) but never actually deal damage, since onShoot is a no-op in
   the range's own per-frame bot update below. */
export function spawnRangeBot() {
  if (!game.isRange() || !game.net.isBotHost()) return;
  if (game.bots.count >= RANGE_BOT_CAP) { showWaveBanner("Range is full — kill one first", 1800); renderPauseRange(); return; }
  game.bots.fill(game.bots.count + 2, 1, botSpawn, true);
  for (const b of game.bots.bots) game.net.publishBot(b);
  showWaveBanner(`Bot ${game.bots.count} in the range`, 1800);
  renderPauseRange();
}

export function clearRangeBots() {
  if (!game.isRange() || !game.net.isBotHost()) return;
  for (const b of game.bots.bots) game.net.dropBot(b.id);   // takes their rigs down too
  game.bots.clear();
  renderPauseRange();
}

/* The HUD's "Spawn a bot" can't be clicked on desktop: the HUD only shows
   while the mouse is locked to aiming, and Esc opens this menu on top. So
   the range's bot controls live here too (and on the N key). */
export function renderPauseRange() {
  const box = game.els.pauseRange;
  if (!box) return;
  box.hidden = !game.isRange();
  if (box.hidden) return;
  const n = game.bots.count;
  game.els.pauseSpawnBot.textContent = n >= RANGE_BOT_CAP ? `Range full (${n}/${RANGE_BOT_CAP})` : `Spawn a bot (${n}/${RANGE_BOT_CAP})`;
  game.els.pauseSpawnBot.disabled = n >= RANGE_BOT_CAP;
  game.els.pauseClearBots.disabled = n === 0;
}
