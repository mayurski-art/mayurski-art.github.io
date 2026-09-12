// Troll Ops — PvP bots.
//
// Lobbies will often have one or two real people, and an empty match is a
// mode nobody plays. Bots fill the room out.
//
// Exactly one client simulates them: the lowest peer id in the room is the
// bot host. It writes bot state into its own peer map (so its renderer treats
// them like anyone else) and broadcasts the same `state` messages everyone
// else already understands, so remote clients need no bot-specific code.

import * as THREE from "three";
import { groundHeightAt, resolveCircle } from "./movement.js";
import { segmentBlocked } from "./ballistics.js";
import { FlowField } from "./nav.js";

const NAMES = [
  "grinbot", "sneerbot", "chuckles", "smirko", "haha_9000", "kekbot",
  "widemouth", "lolgrin", "trollbyte", "yikesbot", "guffaw", "snicker",
];

const BOT_HP = 100;
const BOT_SPEED = 4.2;
const BOT_RADIUS = 0.36;
const BOT_HEIGHT = 1.8;
const RESPAWN = 5;

const SIGHT_RANGE = 45;
const FIRE_RANGE = 38;

/* Accuracy. A flat coin-flip regardless of range made bots equally lethal at
   3m and 38m, which reads as random rather than skilled. Instead they have to
   *acquire* a target: chance climbs the longer they hold someone in view and
   falls off with distance, so pushing them punishes and sniping them rewards
   the same way it would against a person. */
const ACQUIRE_TIME = 0.9;         // seconds of continuous sight to be fully on target
const NEAR_RANGE = 8;             // at or under this, accuracy is at its best
const HEADSHOT_CHANCE = 0.12;

/* Magazines. Firing forever with no reload gave the fight no rhythm and no
   reason to push. */
const MAG_SIZE = 26;
const RELOAD_TIME = 2.3;

const DIFFICULTY = {
  recruit:  { label: "Recruit",  hit: 0.28, damage: 14, interval: 1.15, reaction: 0.45, strafe: 0.55, lead: 0.15 },
  regular:  { label: "Regular",  hit: 0.45, damage: 17, interval: 0.85, reaction: 0.28, strafe: 0.75, lead: 0.4 },
  veteran:  { label: "Veteran",  hit: 0.62, damage: 20, interval: 0.62, reaction: 0.16, strafe: 1.0, lead: 0.75 },
};
export const DIFFICULTY_IDS = Object.keys(DIFFICULTY);

/* Bots carry real guns from the roster rather than all reporting problem416,
   so the killfeed says something true about how you died. */
const BOT_WEAPONS = ["problem416", "snubgrin", "smg", "trollboy", "sneer", "cackle"];

// Everyone also carries a sidearm and draws it the instant the primary runs
// dry rather than standing there reloading in a firefight - the same reason
// a player reaches for 2 instead of holding R with someone shooting at them.
const BOT_SIDEARMS = ["pocketgrin", "widedeagle", "chortle"];
const SIDEARM_MAG_SIZE = 12;
const SIDEARM_RELOAD_TIME = 1.5;

let counter = 0;

class Bot {
  constructor(team, spawn, difficulty = "regular") {
    this.id = `bot-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    this.name = NAMES[counter % NAMES.length];
    this.team = team;
    this.isBot = true;
    this.diff = DIFFICULTY[difficulty] || DIFFICULTY.regular;
    this.weaponId = BOT_WEAPONS[counter % BOT_WEAPONS.length];
    this.secondaryId = BOT_SIDEARMS[counter % BOT_SIDEARMS.length];
    this.holdingSecondary = false;
    this.sidearmAmmo = SIDEARM_MAG_SIZE;
    this.sidearmReloadT = 0;
    this.hp = BOT_HP;
    this.alive = true;
    this.kills = 0;
    this.pos = new THREE.Vector3(spawn.x, 0, spawn.z);
    this.vel = new THREE.Vector3();
    this.yaw = Math.random() * Math.PI * 2;
    this.pitch = 0;
    this.groundY = 0;
    this.fireT = Math.random() * this.diff.interval;
    this.respawnT = 0;
    this.wander = new THREE.Vector3();
    this.wanderT = 0;
    this.ammo = MAG_SIZE;
    this.reloadT = 0;
    this.acquireT = 0;        // how long the current target has been in view
    this.lastTargetId = null;
    this.roam = null;         // a point to head for when nobody is visible
    this.strafeDir = Math.random() < 0.5 ? 1 : -1;
    this.strafeT = 1 + Math.random() * 1.5;
    this.flinchT = 0;         // briefly turns/steps off-line after taking a hit
    this.prevTargetPos = null;    // for velocity-based lead
    this.targetVel = new THREE.Vector3();
  }

  respawn(spawn) {
    this.pos.set(spawn.x, 0, spawn.z);
    this.vel.set(0, 0, 0);
    this.hp = BOT_HP;
    this.alive = true;
    this.groundY = 0;
    this.ammo = MAG_SIZE;
    this.reloadT = 0;
    this.holdingSecondary = false;
    this.sidearmAmmo = SIDEARM_MAG_SIZE;
    this.sidearmReloadT = 0;
    this.acquireT = 0;
    this.lastTargetId = null;
    this.roam = null;
    this.flinchT = 0;
    this.prevTargetPos = null;
  }

  /* Called when a shot connects on this bot. Real players flinch off-line
     immediately — that's the difference between a bot that eats a flank in
     silence and one that reacts like it's actually being shot at. */
  onDamaged() {
    this.flinchT = 0.35 + Math.random() * 0.25;
    this.strafeDir = -this.strafeDir;
  }

  /* Chance to land a shot right now: better the closer they are and the
     longer they've been tracked, with the difficulty tier setting the ceiling.
     A target strafing hard is genuinely harder to hit — how much harder
     depends on the bot's `lead` skill, so a veteran tracks a juking player
     far better than a recruit does, the same gap a real skill difference
     would produce. */
  hitChance(range) {
    const acquired = Math.min(1, this.acquireT / ACQUIRE_TIME);
    const falloff = range <= NEAR_RANGE
      ? 1
      : Math.max(0.25, 1 - (range - NEAR_RANGE) / (FIRE_RANGE - NEAR_RANGE) * 0.75);
    const targetSpeed = this.targetVel ? this.targetVel.length() : 0;
    const evasion = Math.min(1, targetSpeed / 6) * (1 - this.diff.lead) * 0.5;
    return this.diff.hit * falloff * (0.35 + 0.65 * acquired) * (1 - evasion);
  }

  update(dt, ctx) {
    const { colliders, arena, targets, onShoot, ffa, navFor, sightBlocked } = ctx;

    if (!this.alive) {
      this.respawnT -= dt;
      return;
    }

    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.ammo = MAG_SIZE;
    }

    // --- pick the nearest visible enemy, and the nearest enemy overall
    const eye = new THREE.Vector3(this.pos.x, this.groundY + 1.5, this.pos.z);
    let best = null, bestD = Infinity;         // visible
    let lead = null, leadD = Infinity;         // visible or not — who to walk toward
    for (const t of targets) {
      if (!t.alive) continue;
      if (t.id === this.id) continue;
      if (!ffa && t.team === this.team) continue;
      const d = Math.hypot(t.pos.x - this.pos.x, t.pos.z - this.pos.z);
      if (d < leadD) { lead = t; leadD = d; }
      if (d > SIGHT_RANGE || d >= bestD) continue;
      const theirEye = new THREE.Vector3(t.pos.x, (t.groundY ?? t.pos.y ?? 0) + 1.4, t.pos.z);
      if (segmentBlocked(colliders, eye, theirEye)) continue;
      // Smoke and the like: opaque to bots exactly as it is to players.
      if (sightBlocked?.(eye, theirEye)) continue;
      best = t; bestD = d;
    }

    // Sight has to be held to be worth anything; losing it resets the aim.
    if (best && best.id === this.lastTargetId) this.acquireT += dt;
    else this.acquireT = 0;
    this.lastTargetId = best?.id ?? null;

    // Track target velocity for lead-aim, and let a flinch from a recent hit
    // fade out over time.
    if (best) {
      if (this.prevTargetPos) {
        this.targetVel.set(
          (best.pos.x - this.prevTargetPos.x) / Math.max(dt, 1e-3),
          0,
          (best.pos.z - this.prevTargetPos.z) / Math.max(dt, 1e-3),
        );
        this.prevTargetPos.copy(best.pos);
      } else {
        this.prevTargetPos = best.pos.clone();
      }
    } else {
      this.prevTargetPos = null;
      this.targetVel.set(0, 0, 0);
    }
    if (this.flinchT > 0) this.flinchT -= dt;

    // --- steer
    let desired;
    if (best) {
      this.yaw = Math.atan2(-(best.pos.x - this.pos.x), -(best.pos.z - this.pos.z));
      // Close to a comfortable range rather than walking into their face,
      // and strafe laterally the whole time — a bot that holds still while
      // trading shots reads as scripted, not skilled. Flip strafe direction
      // periodically (and instantly on taking a hit) so it isn't a metronome.
      this.strafeT -= dt;
      if (this.strafeT <= 0) {
        this.strafeT = 0.6 + Math.random() * 1.2;
        if (Math.random() < 0.5) this.strafeDir = -this.strafeDir;
      }
      const toTarget = new THREE.Vector3(best.pos.x - this.pos.x, 0, best.pos.z - this.pos.z).normalize();
      const lateral = new THREE.Vector3(-toTarget.z, 0, toTarget.x).multiplyScalar(this.strafeDir);
      const closeSign = bestD > 12 ? 1 : (bestD < 6 ? -1 : 0);
      desired = toTarget.multiplyScalar(closeSign * 0.6)
        .addScaledVector(lateral, this.diff.strafe)
        .normalize();
      // A fresh flinch briefly overrides strafing with a hard juke off-line —
      // the instinctive first move a real player makes under fire.
      if (this.flinchT > 0.15) {
        desired = lateral.clone().normalize();
      }
    } else if (lead) {
      // Nobody in sight: walk the flow field toward the nearest enemy rather
      // than straight at them. Straight-line steering is fine on an open
      // arena and useless the moment a map has interior walls — the bot
      // grinds against one until the target happens to come round it.
      const field = navFor?.(lead);
      const step = field?.steer(this.pos.x, this.pos.z);
      if (step) {
        desired = step;
        this.yaw = Math.atan2(-desired.x, -desired.z);
      } else {
        desired = this.wanderStep(dt);
      }
    } else {
      desired = this.wanderStep(dt);
    }

    this.vel.x += (desired.x * BOT_SPEED - this.vel.x) * Math.min(1, dt * 5);
    this.vel.z += (desired.z * BOT_SPEED - this.vel.z) * Math.min(1, dt * 5);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;

    this.pos.x = Math.max(arena.minX + BOT_RADIUS, Math.min(arena.maxX - BOT_RADIUS, this.pos.x));
    this.pos.z = Math.max(arena.minZ + BOT_RADIUS, Math.min(arena.maxZ - BOT_RADIUS, this.pos.z));
    resolveCircle(colliders, this.pos, BOT_RADIUS, this.groundY, BOT_HEIGHT, 0.5);

    const support = groundHeightAt(colliders, this.pos.x, this.pos.z, this.groundY + 0.5, BOT_RADIUS * 0.8);
    this.groundY += (support - this.groundY) * Math.min(1, dt * 9);
    this.pos.y = this.groundY;

    // --- shoot
    this.fireT -= dt;
    if (this.sidearmReloadT > 0) {
      this.sidearmReloadT -= dt;
      if (this.sidearmReloadT <= 0) this.sidearmAmmo = SIDEARM_MAG_SIZE;
    }
    const canSee = best && bestD < FIRE_RANGE;
    // A short reaction delay before the first shot, so they don't snap onto
    // someone the instant they round a corner.
    const reacted = this.acquireT >= this.diff.reaction;

    // Dry primary with someone still in sight draws the sidearm instead of
    // reloading into a firefight; holstering it again (back to the rifle)
    // waits for a clear moment, same as the primary's own out-of-contact
    // reload just below.
    if (!this.holdingSecondary && this.ammo <= 0 && canSee) this.holdingSecondary = true;
    else if (this.holdingSecondary && !canSee && this.reloadT <= 0) this.holdingSecondary = false;

    if (this.holdingSecondary) {
      if (reacted && canSee && this.sidearmReloadT <= 0 && this.fireT <= 0) {
        if (this.sidearmAmmo <= 0) {
          this.sidearmReloadT = SIDEARM_RELOAD_TIME;
        } else {
          this.sidearmAmmo--;
          this.fireT = this.diff.interval * (0.9 + Math.random() * 0.6);
          const hit = Math.random() < this.hitChance(bestD) * 0.85; // pistols are less accurate at range
          const head = hit && Math.random() < HEADSHOT_CHANCE;
          onShoot(this, best, hit ? this.diff.damage * 0.8 * (head ? 2 : 1) : 0, head, hit, bestD, true);
        }
      }
      if (!canSee && this.ammo < MAG_SIZE && this.reloadT <= 0) this.reloadT = RELOAD_TIME;
      return;
    }

    if (canSee && reacted && this.reloadT <= 0 && this.fireT <= 0) {
      if (this.ammo <= 0) {
        this.reloadT = RELOAD_TIME;
      } else {
        this.ammo--;
        this.fireT = this.diff.interval * (0.75 + Math.random() * 0.6);
        // Misses are reported too, so the target hears the round go past.
        const hit = Math.random() < this.hitChance(bestD);
        const head = hit && Math.random() < HEADSHOT_CHANCE;
        onShoot(this, best, hit ? this.diff.damage * (head ? 2 : 1) : 0, head, hit, bestD);
      }
    } else if (!canSee && this.ammo < MAG_SIZE && this.reloadT <= 0) {
      // Top up while out of contact rather than mid-firefight.
      this.reloadT = RELOAD_TIME;
    }
  }

  /* No target and no route: drift, so they don't stand still looking broken. */
  wanderStep(dt) {
    this.wanderT -= dt;
    if (this.wanderT <= 0) {
      this.wanderT = 2 + Math.random() * 3;
      const a = Math.random() * Math.PI * 2;
      this.wander.set(Math.cos(a), 0, Math.sin(a));
    }
    const out = this.wander.clone();
    if (out.lengthSq() > 0) this.yaw = Math.atan2(-out.x, -out.z);
    return out;
  }
}

export class BotManager {
  constructor() {
    this.bots = [];
    this.enabled = false;
    this.difficulty = "regular";
    this.fieldSrc = null;         // geometry the fields are built from
    this.fieldPool = new Map();   // target id -> FlowField, reused across sweeps
    this.frameFields = new Map(); // fields already swept this tick
    this.fieldT = 0;
  }

  get count() { return this.bots.length; }

  clear() {
    this.bots.length = 0;
    this.fieldPool.clear();
    this.frameFields.clear();
  }

  /* Point the nav at a map. Fields built against the old geometry are stale
     the moment the map changes, so they're dropped rather than reused. */
  rebuildNav(colliders, arena, floorY = 0) {
    this.fieldSrc = { colliders, arena, floorY };
    this.fieldPool.clear();
    this.frameFields.clear();
  }

  /* Fill the room up to `target` participants, splitting bots across sides. */
  fill(target, humanCount, spawnFor, ffa) {
    const want = Math.max(0, target - humanCount);
    while (this.bots.length > want) this.bots.pop();
    while (this.bots.length < want) {
      const team = ffa
        ? (Math.random() < 0.5 ? "phantom" : "ghost")
        : (this.bots.filter((b) => b.team === "phantom").length <= this.bots.filter((b) => b.team === "ghost").length ? "phantom" : "ghost");
      this.bots.push(new Bot(team, spawnFor(team), this.difficulty));
    }
  }

  byId(id) { return this.bots.find((b) => b.id === id) || null; }

  update(dt, ctx) {
    // One field per *pursued target*, re-swept a few times a second. Keyed by
    // target id and cached for the frame: several bots chasing one person
    // share a single BFS, and bots chasing different people don't thrash a
    // shared field by recomputing it on every lookup.
    this.fieldT -= dt;
    if (this.fieldT <= 0) { this.fieldT = 0.3; this.frameFields?.clear(); }
    if (!this.frameFields) this.frameFields = new Map();

    const navFor = (target) => {
      if (!target || !this.fieldSrc) return null;
      let f = this.frameFields.get(target.id);
      if (!f) {
        f = this.fieldPool.get(target.id);
        if (!f) {
          // Ids churn as people join, leave and bots recycle; keep the pool
          // from growing for the length of a match.
          if (this.fieldPool.size >= 12) {
            this.fieldPool.delete(this.fieldPool.keys().next().value);
          }
          f = new FlowField(this.fieldSrc.colliders, this.fieldSrc.arena, this.fieldSrc.floorY);
          this.fieldPool.set(target.id, f);
        }
        f.compute(target.pos.x, target.pos.z);
        this.frameFields.set(target.id, f);
      }
      return f;
    };

    for (const bot of this.bots) {
      bot.update(dt, { ...ctx, navFor });
      if (!bot.alive && bot.respawnT <= 0) bot.respawn(ctx.spawnFor(bot.team, bot.id));
    }
  }

  /* Returns { killed, bot } so the caller can award the kill. */
  applyHit(botId, dmg) {
    const bot = this.byId(botId);
    if (!bot || !bot.alive) return { killed: false, bot: null };
    bot.hp -= dmg;
    bot.onDamaged();
    if (bot.hp > 0) return { killed: false, bot };
    bot.alive = false;
    bot.respawnT = RESPAWN;
    return { killed: true, bot };
  }
}
