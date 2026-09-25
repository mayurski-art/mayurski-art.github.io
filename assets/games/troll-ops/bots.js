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

/* `nade`: how keen a bot is to throw when it has a reason (chance per
   chance it gets), how far off its throws land (metres of scatter at 20 m),
   and whether it cooks frags so they go off on landing. */
const DIFFICULTY = {
  recruit:  { label: "Recruit",  hit: 0.28, damage: 14, interval: 1.15, reaction: 0.45, strafe: 0.55, lead: 0.15,
    nade: { chance: 0.3, scatter: 3.2, cook: false } },
  regular:  { label: "Regular",  hit: 0.45, damage: 17, interval: 0.85, reaction: 0.28, strafe: 0.75, lead: 0.4,
    nade: { chance: 0.55, scatter: 1.9, cook: false } },
  veteran:  { label: "Veteran",  hit: 0.62, damage: 20, interval: 0.62, reaction: 0.16, strafe: 1.0, lead: 0.75,
    nade: { chance: 0.85, scatter: 1.0, cook: true } },
};

/* Grenades. One frag and one flash a life, the same as a player's default
   kit, and a cooldown between throws so a bot that keeps its reason (a
   camper behind the same wall) doesn't empty its pockets at it at once. */
const NADE_FIRST = [5, 10];       // seconds after spawning before the first throw
const NADE_COOLDOWN = [9, 15];
const NADE_RECHECK = 0.6;         // how often a bot looks for a reason
const NADE_MIN = 7;               // no closer: it would be standing in the blast
const NADE_MAX = 26;
const CLUSTER = 4.5;              // enemies this close together count as a group
const SEEN_MEMORY = 4;            // seconds a hidden target's last position stays useful
const between = ([a, b]) => a + Math.random() * (b - a);
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
    this.deaths = 0;
    this.pos = new THREE.Vector3(spawn.x, 0, spawn.z);
    this.vel = new THREE.Vector3();
    this.yaw = Math.random() * Math.PI * 2;
    this.pitch = 0;
    this.groundY = 0;
    this.fireT = Math.random() * this.diff.interval;
    this.respawnT = 0;
    this.wander = new THREE.Vector3();
    this.wanderT = 0;
    this.moving = false;   // real ground speed, not "has steering input" — see update()
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
    this.resetNades();
  }

  resetNades() {
    this.frags = 1;
    this.flashes = 1;
    this.nadeT = between(NADE_FIRST);
    this.lastSeen = null;     // { id, x, y, z, age } of the last enemy in sight
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
    this.stunT = 0;
    this.prevTargetPos = null;
    this.resetNades();
  }

  /* Called when a shot connects on this bot. Real players flinch off-line
     immediately — that's the difference between a bot that eats a flank in
     silence and one that reacts like it's actually being shot at. */
  onDamaged() {
    this.flinchT = 0.35 + Math.random() * 0.25;
    this.strafeDir = -this.strafeDir;
  }

  /* Flashbanged or scrambled. Bots were handed to flashPlayer/empPlayer as
     their RemotePlayer render proxy, which has no stun(), so a flash at a
     bot's feet did nothing at all. Blinded bots lose their target, can't
     fire, and stumble instead of strafing. */
  stun(seconds) {
    this.stunT = Math.max(this.stunT || 0, seconds);
    this.acquireT = 0;
    this.lastTargetId = null;
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

    // Mode objective (a hill, a bomb site) and whether the mode has this bot
    // pinned in place mid-plant/defuse. Both optional — TDM passes neither.
    const objective = ctx.objectiveFor?.(this) || null;
    const busy = !!ctx.isBusy?.(this);
    const stunned = this.stunT > 0;
    if (stunned) this.stunT -= dt;

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
      if (stunned) continue;     // blind: knows roughly where people are, sees nobody
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

    if (best) this.lastSeen = { id: best.id, x: best.pos.x, y: best.groundY ?? best.pos.y ?? 0, z: best.pos.z, age: 0 };
    else if (this.lastSeen) this.lastSeen.age += dt;

    // --- grenades
    if (ctx.onThrow && !busy && !stunned && (this.frags > 0 || this.flashes > 0)) {
      this.nadeT -= dt;
      if (this.nadeT <= 0) {
        const plan = this.planThrow(targets, ffa, colliders, eye, best, objective);
        if (!plan) this.nadeT = NADE_RECHECK;
        else if (Math.random() > this.diff.nade.chance) this.nadeT = 2 + Math.random() * 2;   // let it go this time
        else {
          const s = this.diff.nade.scatter * Math.min(1.5, plan.dist / 20);
          const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * s;
          const at = { x: plan.x + Math.cos(a) * r, y: plan.y, z: plan.z + Math.sin(a) * r };
          if (ctx.onThrow(this, plan.kind, at, plan.lob)) {
            if (plan.kind === "frag") this.frags--; else this.flashes--;
            this.nadeT = between(NADE_COOLDOWN);
            // A beat with the hand busy: no shot goes off mid-throw.
            this.fireT = Math.max(this.fireT, 0.45);
          } else {
            this.nadeT = NADE_RECHECK;
          }
        }
      }
    }

    // --- steer
    let desired;
    const objD = objective ? Math.hypot(objective.x - this.pos.x, objective.z - this.pos.z) : Infinity;
    if (busy) {
      // Planting or defusing: rooted to the spot, eyes on whoever's coming.
      desired = new THREE.Vector3();
      if (best) this.yaw = Math.atan2(-(best.pos.x - this.pos.x), -(best.pos.z - this.pos.z));
    } else if (stunned) {
      // Staggering: a slow drift, no juke — the window a flash is meant to buy.
      desired = this.wanderStep(dt).multiplyScalar(0.3);
    } else if (best) {
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
    } else if (objective && objD > objective.radius) {
      // Nobody in sight and the mode wants us somewhere — go there before
      // hunting. Without this KotH bots never stood on the hill and S&D
      // bots never went near a site.
      const field = navFor?.({ id: objective.id, pos: objective });
      const step = field?.steer(this.pos.x, this.pos.z);
      if (step) {
        desired = step;
        this.yaw = Math.atan2(-desired.x, -desired.z);
      } else {
        desired = new THREE.Vector3(objective.x - this.pos.x, 0, objective.z - this.pos.z).normalize();
        this.yaw = Math.atan2(-desired.x, -desired.z);
      }
    } else if (objective) {
      // On the objective: hold it, shuffling a little and scanning the
      // approaches rather than staring at one wall.
      desired = this.wanderStep(dt).multiplyScalar(objective.radius > 2 ? 0.35 : 0);
      this.yaw += dt * 0.9 * this.strafeDir;
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

    // Real ground speed, not "had steering input" — a bot holding its strafe
    // dance to trade shots was reporting `moving: true` every tick (see the
    // old hardcoded flag this replaced in net.js's publishBot), so remote
    // viewers saw it play a full forward jog while it barely drifted.
    this.moving = Math.hypot(this.vel.x, this.vel.z) > 0.4;

    // --- shoot
    this.fireT -= dt;
    if (this.sidearmReloadT > 0) {
      this.sidearmReloadT -= dt;
      if (this.sidearmReloadT <= 0) this.sidearmAmmo = SIDEARM_MAG_SIZE;
    }
    // Hands full with the bomb means no trigger, same as for a player.
    const canSee = !busy && best && bestD < FIRE_RANGE;
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

  /* A reason to throw, or null. In order of how good a reason it is:
       - enemies bunched up (2+ within CLUSTER of each other): a frag;
       - enemies holding the objective we want (hill, bomb site): frag, or a
         flash if the frag is gone;
       - someone we just lost behind cover, still near where we saw them:
         lob it over — a flash when it's close enough to push, else a frag.
     A target we can see and shoot on its own isn't a reason: the gun is. */
  planThrow(targets, ffa, colliders, eye, best, objective) {
    const enemies = [];
    for (const t of targets) {
      if (!t.alive || t.id === this.id || (!ffa && t.team === this.team)) continue;
      enemies.push(t);
    }
    if (!enemies.length) return null;
    const distTo = (x, z) => Math.hypot(x - this.pos.x, z - this.pos.z);
    const inRange = (d) => d >= NADE_MIN && d <= NADE_MAX;
    const hidden = (x, y, z) => segmentBlocked(colliders, eye, new THREE.Vector3(x, y + 1, z));

    if (this.frags > 0) {
      let bestGroup = null;
      for (const e of enemies) {
        const d = distTo(e.pos.x, e.pos.z);
        if (!inRange(d)) continue;
        let n = 0, cx = 0, cz = 0;
        for (const o of enemies) {
          if (Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) > CLUSTER) continue;
          n++; cx += o.pos.x; cz += o.pos.z;
        }
        if (n >= 2 && (!bestGroup || n > bestGroup.n)) bestGroup = { n, x: cx / n, z: cz / n, y: e.groundY ?? e.pos.y ?? 0 };
      }
      if (bestGroup) {
        return { kind: "frag", x: bestGroup.x, y: bestGroup.y, z: bestGroup.z,
          dist: distTo(bestGroup.x, bestGroup.z), lob: hidden(bestGroup.x, bestGroup.y, bestGroup.z) };
      }
    }

    if (objective) {
      const d = distTo(objective.x, objective.z);
      const held = enemies.some((e) => Math.hypot(e.pos.x - objective.x, e.pos.z - objective.z) <= (objective.radius || 4) + 2);
      if (held && inRange(d)) {
        const kind = this.frags > 0 ? "frag" : "flash";
        const y = objective.y ?? this.groundY;
        return { kind, x: objective.x, y, z: objective.z, dist: d, lob: hidden(objective.x, y, objective.z) };
      }
    }

    const seen = this.lastSeen;
    if (!best && seen && seen.age < SEEN_MEMORY) {
      const still = enemies.find((e) => e.id === seen.id && Math.hypot(e.pos.x - seen.x, e.pos.z - seen.z) < 5);
      const d = distTo(seen.x, seen.z);
      if (still && inRange(d)) {
        const kind = d < 15 && this.flashes > 0 ? "flash" : this.frags > 0 ? "frag" : this.flashes > 0 ? "flash" : null;
        if (kind) return { kind, x: seen.x, y: seen.y, z: seen.z, dist: d, lob: true };
      }
    }
    return null;
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
  /* `humanTeams` ({ phantom, ghost }) pads each side rather than the room:
     bots go where the humans aren't. Without it a lone human always stood
     with four bots against three — the bots split evenly among themselves
     and the human made it 5v3. */
  fill(target, humanCount, spawnFor, ffa, humanTeams = null) {
    if (!ffa && humanTeams && target > 0) {
      const want = {
        phantom: Math.max(0, Math.floor(target / 2) - (humanTeams.phantom | 0)),
        ghost: Math.max(0, Math.ceil(target / 2) - (humanTeams.ghost | 0)),
      };
      for (const team of ["phantom", "ghost"]) {
        let have = this.bots.filter((b) => b.team === team).length;
        for (let i = this.bots.length - 1; i >= 0 && have > want[team]; i--) {
          if (this.bots[i].team === team) { this.bots.splice(i, 1); have--; }
        }
        for (; have < want[team]; have++) this.bots.push(new Bot(team, spawnFor(team), this.difficulty));
      }
      return;
    }
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
      // One-life modes (Search & Destroy) bring bots back at the round
      // boundary via reviveAll, never on the respawn clock — respawning here
      // meant the attacking side could never be eliminated.
      if (!bot.alive && bot.respawnT <= 0 && !ctx.noRespawn) bot.respawn(ctx.spawnFor(bot.team, bot.id));
    }
  }

  /* Everyone back on their feet at a fresh spawn — a new S&D round. */
  reviveAll(spawnFor) {
    for (const bot of this.bots) bot.respawn(spawnFor(bot.team, bot.id));
  }

  /* Returns { killed, bot } so the caller can award the kill. */
  applyHit(botId, dmg) {
    const bot = this.byId(botId);
    if (!bot || !bot.alive) return { killed: false, bot: null };
    bot.hp -= dmg;
    bot.onDamaged();
    if (bot.hp > 0) return { killed: false, bot };
    bot.alive = false;
    bot.deaths++;
    bot.respawnT = RESPAWN;
    return { killed: true, bot };
  }
}
