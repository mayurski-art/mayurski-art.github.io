// Troll Forces — PvP bots.
//
// Lobbies will often have one or two real people, and an empty match is a
// mode nobody plays. Bots fill the room out.
//
// Exactly one client simulates them: the lowest peer id in the room is the
// bot host. It writes bot state into its own peer map (so its renderer treats
// them like anyone else) and broadcasts the same `state` messages everyone
// else already understands, so remote clients need no bot-specific code.

import * as THREE from "three";
import { groundHeightAt, resolveCircle } from "./movement.js?v=ti1";
import { segmentBlocked } from "./ballistics.js?v=cg1-wst";
import { FlowField } from "./nav.js?v=ti1";
import { clampInsidePolygon, insidePolygon } from "./edge.js";

const NAMES = [
  "grinbot", "sneerbot", "chuckles", "smirko", "haha_9000", "kekbot",
  "widemouth", "lolgrin", "trollbyte", "yikesbot", "guffaw", "snicker",
];

const BOT_HP = 100;
const BOT_SPEED = 4.2;
const BOT_RADIUS = 0.36;
const BOT_HEIGHT = 1.8;
const CLIMB_HEADROOM = 1.2;       // on a stair (see update's resolveCircle)
const UPPER_NAV_CELL = 0.55;      // flow-field cell above the ground floor (BotManager navFor)
const SAME_LEVEL = 0.9;           // a goal this much higher or lower is on another floor: stairs
const RESPAWN = 5;

const SIGHT_RANGE = 45;
const FIRE_RANGE = 38;

/* Accuracy. A flat coin-flip regardless of range made bots equally lethal at
   3m and 38m, which reads as random rather than skilled. Instead they have to
   *acquire* a target: chance climbs the longer they hold someone in view and
   falls off with distance, so pushing them punishes and sniping them rewards
   the same way it would against a person. */
const ACQUIRE_TIME = 0.9;         // seconds of continuous sight to be fully on target
// Line-of-sight raycasts are the bots' biggest cost (every bot against every
// target), so each bot re-checks who it can see this often and keeps its
// pick in between. Well under a human's reaction time.
const SIGHT_RECHECK = 0.15;
const NEAR_RANGE = 8;             // at or under this, accuracy is at its best
const HEADSHOT_CHANCE = 0.12;

/* Aiming down sights. Bots used to shoot everything from the hip at the
   same accuracy. Now they scope in on anyone past arm's length (it takes
   diff.adsTime to come up), shoot better and walk slower while in, and come
   back out to reload, when someone's in their face (hip-fire is faster
   there), or a beat after losing sight (they check the corner first). */
const ADS_MIN_RANGE = 6;          // closer than this: hip-fire
const ADS_LINGER = [0.4, 0.9];    // seconds scoped after losing sight
const ADS_MOVE = 0.5;             // move speed while fully scoped
const HIP_AT_RANGE = 0.7;         // hip-fire accuracy past NEAR_RANGE
const ADS_AT_RANGE = 1.1;         // scoped accuracy past NEAR_RANGE

/* Magazines. Firing forever with no reload gave the fight no rhythm and no
   reason to push. */
const MAG_SIZE = 26;
const RELOAD_TIME = 2.3;

/* `nade`: how keen a bot is to throw when it has a reason (chance per
   chance it gets), how far off its throws land (metres of scatter at 20 m),
   and whether it cooks frags so they go off on landing. */
const DIFFICULTY = {
  recruit:  { label: "Recruit",  hit: 0.28, damage: 14, interval: 1.0, reaction: 0.45, strafe: 0.55, lead: 0.15, readsGuard: false, adsTime: 0.42,
    nade: { chance: 0.3, scatter: 3.2, cook: false }, jump: 0.05, slide: 0.05 },
  regular:  { label: "Regular",  hit: 0.45, damage: 17, interval: 0.72, reaction: 0.28, strafe: 0.75, lead: 0.4, readsGuard: true, adsTime: 0.3,
    nade: { chance: 0.55, scatter: 1.9, cook: false }, jump: 0.12, slide: 0.12 },
  veteran:  { label: "Veteran",  hit: 0.62, damage: 20, interval: 0.53, reaction: 0.16, strafe: 1.0, lead: 0.75, readsGuard: true, adsTime: 0.22,
    nade: { chance: 0.85, scatter: 1.0, cook: true }, jump: 0.2, slide: 0.2 },
};

/* Moving like a player (user: bots never jumped or slid). In a fight a bot
   rolls every MOVE_ROLL seconds for a hop or a slide (`jump` / `slide`
   above); a bot pinned against something low hops over it. */
const MOVE_ROLL = 0.5;
const HOP_SPEED = 5.4;            // m/s up, the player's jump
const HOP_GRAVITY = 16;
const SLIDE_TIME = 0.75;
const SLIDE_BOOST = 1.75;         // speed at the start of a slide, easing to 1
const STUCK_HOP = 0.6;            // seconds pushing into something before hopping it
const MOVE_COOLDOWN = 1.2;

/* Grenades. One lethal and one tactical a life, like a player's kit, rolled
   per life (lethal: frag; tactical: flash, smoke or EMP), and
   a cooldown between throws so a bot that keeps its reason (a camper
   behind the same wall) doesn't empty its pockets at it at once. */
const BOT_LETHALS = ["frag"];
const BOT_TACTICALS = ["flash", "smoke", "emp"];
const NADE_FIRST = [5, 10];       // seconds after spawning before the first throw
const NADE_COOLDOWN = [9, 15];
const NADE_RECHECK = 0.6;         // how often a bot looks for a reason
const NADE_MIN = 7;               // no closer: it would be standing in the blast
const NADE_MAX = 26;
const CLUSTER = 4.5;              // enemies this close together count as a group
const SEEN_MEMORY = 4;            // seconds a hidden target's last position stays useful
const between = ([a, b]) => a + Math.random() * (b - a);

/* Melee-only bots (Infection's infected): they run the target down and
   swing when they're in reach. */
const MELEE_REACH = 1.9;   // keyboard reach (gear.js range 2.0 from the eye), centre to centre
const MELEE_INTERVAL = 0.95;      // seconds between swings, scaled by skill below
export const DIFFICULTY_IDS = Object.keys(DIFFICULTY);

/* Taking the high ground (Bot.updatePerch): with nobody in sight, every
   PERCH_EVERY seconds a bot may (PERCH_CHANCE) head up a stair within
   PERCH_RANGE and hold the top for PERCH_HOLD seconds before hunting again. */
const PERCH_FIRST = [6, 14];
const PERCH_EVERY = [10, 20];
const PERCH_CHANCE = 0.35;
const PERCH_RANGE = 45;
const PERCH_HOLD = [4, 8];
const PERCH_GIVE_UP = 30;          // seconds to get there before it's dropped

/* Anything tall standing at body height on this spot? */
function resolveBlocked(colliders, x, z, feetY) {
  for (const c of colliders) {
    if (c.max.y <= feetY + 0.45 || c.min.y >= feetY + 1.7) continue;
    if (x > c.min.x - BOT_RADIUS && x < c.max.x + BOT_RADIUS && z > c.min.z - BOT_RADIUS && z < c.max.z + BOT_RADIUS) return true;
  }
  return false;
}

/* Is target `t` holding a saber guard that faces `from`? Targets carry
   `blocking` (bool), `yaw` and `blockCone` (the saber's deflect.cone,
   a dot product against their facing). Forward at yaw 0 is -Z. */
function isGuarding(t, from) {
  if (!t.blocking) return false;
  const dx = from.x - t.pos.x, dz = from.z - t.pos.z;
  const len = Math.hypot(dx, dz);
  if (len < 1e-3) return true;
  const yaw = t.yaw || 0;
  return (dx * -Math.sin(yaw) + dz * -Math.cos(yaw)) / len >= (t.blockCone ?? 0.26);
}

/* Bots carry real guns from the roster rather than all reporting problem416,
   so the killfeed says something true about how you died. */
const BOT_WEAPONS = ["problem416", "snubgrin", "smg", "trollboy", "sneer", "cackle"];

// Everyone also carries a sidearm and draws it the instant the primary runs
// dry rather than standing there reloading in a firefight - the same reason
// a player reaches for 2 instead of holding R with someone shooting at them.
const BOT_SIDEARMS = ["pocketgrin", "widedeagle", "chortle", "peacemakers"];
const SIDEARM_MAG_SIZE = 12;
const SIDEARM_RELOAD_TIME = 1.5;

let counter = 0;

class Bot {
  constructor(team, spawn, difficulty = "regular") {
    this.id = `bot-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    this.name = NAMES[counter % NAMES.length];
    this.team = team;
    this.isBot = true;
    this.skill = DIFFICULTY[difficulty] ? difficulty : "regular";
    this.diff = DIFFICULTY[this.skill];
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
    this.ads = 0;             // 0 = hip, 1 = fully scoped (see ADS_* above)
    this.adsLingerT = 0;
    this.acquireT = 0;        // how long the current target has been in view
    this.lastTargetId = null;
    this.roam = null;         // a point to head for when nobody is visible
    this.strafeDir = Math.random() < 0.5 ? 1 : -1;
    this.strafeT = 1 + Math.random() * 1.5;
    this.flinchT = 0;         // briefly turns/steps off-line after taking a hit
    this.prevTargetPos = null;    // for velocity-based lead
    this.targetVel = new THREE.Vector3();
    this.resetNades();
    // Infection: set by game.js when the bot turns. Speed and health scale
    // with it; the sword is all it has.
    this.meleeOnly = false;
    this.speedMult = 1;
    this.maxHp = BOT_HP;
    this.meleeT = 0;
    this.resetMoves();
  }

  resetMoves() {
    this.hopY = 0;            // height of a hop above groundY
    this.hopV = 0;
    this.slideT = 0;
    this.slideDir = new THREE.Vector3();
    this.moveRollT = MOVE_ROLL;
    this.moveCd = 0;
    this.stuckT = 0;
    this.wantSlide = false;
    this.stance = "stand";    // on the wire (net.js publishBot)
  }

  startHop() {
    if (this.hopY > 0 || this.hopV > 0 || this.slideT > 0) return;
    this.hopV = HOP_SPEED;
    this.moveCd = MOVE_COOLDOWN;
  }

  startSlide(dir) {
    if (this.hopY > 0 || this.slideT > 0 || dir.lengthSq() < 0.01) return;
    this.slideT = SLIDE_TIME;
    this.slideDir.set(dir.x, 0, dir.z).normalize();
    this.moveCd = MOVE_COOLDOWN;
  }

  resetNades() {
    // `frags` / `flashes` count the lethal / tactical, whatever kind it is.
    this.lethalKind = BOT_LETHALS[Math.floor(Math.random() * BOT_LETHALS.length)];
    this.tacticalKind = BOT_TACTICALS[Math.floor(Math.random() * BOT_TACTICALS.length)];
    this.frags = 1;
    this.flashes = 1;
    this.nadeT = between(NADE_FIRST);
    this.lastSeen = null;     // { id, x, y, z, age } of the last enemy in sight
  }

  respawn(spawn) {
    this.pos.set(spawn.x, 0, spawn.z);
    this.climb = null;
    this.vel.set(0, 0, 0);
    this.hp = this.maxHp || BOT_HP;
    this.alive = true;
    this.groundY = 0;
    this.ammo = MAG_SIZE;
    this.reloadT = 0;
    this.holdingSecondary = false;
    this.sidearmAmmo = SIDEARM_MAG_SIZE;
    this.sidearmReloadT = 0;
    this.ads = 0;
    this.adsLingerT = 0;
    this.acquireT = 0;
    this.lastTargetId = null;
    this.roam = null;
    this.perch = null;
    this.perchT = between(PERCH_FIRST);
    this.stairPlan = null;
    this.flinchT = 0;
    this.stunT = 0;
    this.prevTargetPos = null;
    this.resetNades();
    this.resetMoves();
  }

  /* Called when a shot connects on this bot. Real players flinch off-line
     immediately — that's the difference between a bot that eats a flank in
     silence and one that reacts like it's actually being shot at. */
  onDamaged() {
    this.hurtAt = performance.now();
    this.flinchT = 0.35 + Math.random() * 0.25;
    this.strafeDir = -this.strafeDir;
    // Sometimes the answer to being shot is to drop into a slide.
    if (Math.random() < this.diff.slide * 1.5) this.wantSlide = true;
  }

  /* Flashbanged or scrambled. Bots were handed to flashPlayer/empPlayer as
     their RemotePlayer render proxy, which has no stun(), so a flash at a
     bot's feet did nothing at all. Blinded bots lose their target, can't
     fire, and stumble instead of strafing. */
  stun(seconds) {
    this.stunT = Math.max(this.stunT || 0, seconds);
    this.acquireT = 0;
    this.adsLingerT = 0;      // blinded: out of the scope
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
    // Past close range, the scope is the difference: hip-fire sprays.
    const sights = range <= NEAR_RANGE ? 1 : HIP_AT_RANGE + (ADS_AT_RANGE - HIP_AT_RANGE) * this.ads;
    return this.diff.hit * falloff * (0.35 + 0.65 * acquired) * (1 - evasion) * sights;
  }

  update(dt, ctx) {
    const { colliders, arena, targets, onShoot, ffa, navFor, sightBlocked } = ctx;

    if (!this.alive) {
      this.respawnT -= dt;
      return;
    }
    // Troll Royale's sky lobby, bus and drop move this bot (royale-drop.js
    // via game.js): no AI, no physics until it lands.
    if (this.airborne) return;
    this.clock = (this.clock || 0) + dt;

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
    const sightRange = ctx.sightRange ? ctx.sightRange(this) : SIGHT_RANGE;
    let best = null, bestD = Infinity;         // visible
    let lead = null, leadD = Infinity;         // visible or not — who to walk toward
    this.sightT = (this.sightT ?? Math.random() * SIGHT_RECHECK) - dt;
    const rescan = this.sightT <= 0;
    if (rescan) this.sightT = SIGHT_RECHECK * (0.8 + Math.random() * 0.4);
    for (const t of targets) {
      if (!t.alive) continue;
      if (t.id === this.id) continue;
      if (!ffa && t.team === this.team) continue;
      const d = Math.hypot(t.pos.x - this.pos.x, t.pos.z - this.pos.z);
      if (d < leadD) { lead = t; leadD = d; }
      if (stunned) continue;     // blind: knows roughly where people are, sees nobody
      if (d > sightRange || d >= bestD) continue;
      // Between checks: stay on whoever the last one found.
      if (!rescan) { if (t.id === this.seenId) { best = t; bestD = d; } continue; }
      const theirEye = new THREE.Vector3(t.pos.x, (t.groundY ?? t.pos.y ?? 0) + 1.4, t.pos.z);
      if (segmentBlocked(colliders, eye, theirEye)) continue;
      // Smoke and the like: opaque to bots exactly as it is to players.
      if (sightBlocked?.(eye, theirEye)) continue;
      best = t; bestD = d;
    }

    if (rescan) this.seenId = best?.id ?? null;

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
    if (this.retreatT > 0) this.retreatT -= dt;

    if (best) this.lastSeen = { id: best.id, x: best.pos.x, y: best.groundY ?? best.pos.y ?? 0, z: best.pos.z, age: 0 };
    else if (this.lastSeen) this.lastSeen.age += dt;

    // A Trollsaber guard turned on us bats every round away: shooting into
    // it only drains their meter a little. Smarter bots stop feeding it and
    // work round the side or throw something the blade can't stop.
    const guarded = !!best && isGuarding(best, this.pos);
    if (guarded && !this.guarded) {
      this.guardT = 0;
      this.strafeDir = Math.random() < 0.5 ? 1 : -1;
      // Reach for a grenade soon, unless one just went.
      if (this.lastThrowAt == null || performance.now() - this.lastThrowAt > 6000) this.nadeT = Math.min(this.nadeT, 0.35 + this.diff.reaction * 2);
    }
    this.guarded = guarded;
    if (guarded) this.guardT += dt;
    // Recruits never catch on; the others after a round or two bounces off.
    const respectGuard = guarded && this.diff.readsGuard && this.guardT > this.diff.reaction * 2;

    // --- grenades
    if (ctx.onThrow && !this.meleeOnly && !busy && !stunned && (this.frags > 0 || this.flashes > 0)) {
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
            if (plan.kind === this.lethalKind) this.frags--; else this.flashes--;
            this.nadeT = between(NADE_COOLDOWN);
            if (plan.kind === "smoke") this.retreatT = 3;
            this.lastThrowAt = performance.now();
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
    } else if (best && this.meleeOnly && (this.climb || Math.abs((best.groundY ?? best.pos.y ?? 0) - this.groundY) >= SAME_LEVEL)) {
      // Up on a floor above (or below) us: a sword can't reach from here,
      // so take the stairs to them.
      desired = this.steerTo(best.id, best, ctx);
      this.yaw = Math.atan2(-desired.x, -desired.z);
    } else if (best && this.meleeOnly) {
      // Straight at them with a slight weave, all the way in: a sword has
      // no comfortable range to hold.
      this.yaw = Math.atan2(-(best.pos.x - this.pos.x), -(best.pos.z - this.pos.z));
      const toTarget = new THREE.Vector3(best.pos.x - this.pos.x, 0, best.pos.z - this.pos.z).normalize();
      const weave = Math.sin(performance.now() * 0.004 + this.strafeDir) * 0.35;
      desired = bestD < MELEE_REACH * 0.7
        ? new THREE.Vector3()
        : toTarget.addScaledVector(new THREE.Vector3(-toTarget.z, 0, toTarget.x), weave).normalize();
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
      // Someone coming in with a sword gets kited: back off while shooting,
      // since standing to trade is exactly what they want.
      // Just smoked themselves: back off in it.
      const closeSign = this.retreatT > 0 ? -1 : best.melee ? (bestD < 14 ? -1 : 0) : bestD > 12 ? 1 : (bestD < 6 ? -1 : 0);
      desired = toTarget.multiplyScalar(closeSign * 0.6)
        .addScaledVector(lateral, this.diff.strafe)
        .normalize();
      // An objective that can't wait (Troll Royale: the Cringe burning them,
      // or a gun an unarmed bot needs): keep shooting, but keep moving there,
      // by the flow field so walls don't pin them.
      if (objective?.urgent) {
        const toward = this.steerTo(objective.id, objective, ctx);
        desired = toward.addScaledVector(lateral, 0.35).normalize();
      } else if (this.climb) {
        // Halfway up a stair: keep going while shooting, rather than strafe
        // off the side of it.
        const dir = this.climbStep(ctx);
        if (dir) desired = dir.addScaledVector(lateral, 0.15).normalize();
      } else if (this.flinchT > 0.15) {
        // A fresh flinch briefly overrides strafing with a hard juke off-line —
        // the instinctive first move a real player makes under fire.
        desired = lateral.clone().normalize();
      } else if (respectGuard) {
        // Flank: all-out sideways, one way (no strafe flips), backing off a
        // touch if they're close enough to lunge.
        desired = lateral.clone().normalize();
        if (bestD < 8) {
          const away = new THREE.Vector3(this.pos.x - best.pos.x, 0, this.pos.z - best.pos.z).normalize();
          desired.addScaledVector(away, 0.5).normalize();
        }
        this.strafeT = Math.max(this.strafeT, 0.5);
      }
    } else if (objective && objD > objective.radius) {
      // Nobody in sight and the mode wants us somewhere — go there before
      // hunting. Without this KotH bots never stood on the hill and S&D
      // bots never went near a site.
      desired = this.steerTo(objective.id, objective, ctx);
      this.yaw = Math.atan2(-desired.x, -desired.z);
    } else if (objective) {
      // On the objective: hold it, shuffling a little and scanning the
      // approaches rather than staring at one wall.
      desired = this.wanderStep(dt).multiplyScalar(objective.radius > 2 ? 0.35 : 0);
      this.yaw += dt * 0.9 * this.strafeDir;
    } else if (!this.meleeOnly && this.updatePerch(dt, ctx)) {
      // Taking the high ground for a while (updatePerch): up there, then
      // hold it, turning to watch the approaches.
      const p = this.perch;
      if (!p.arrived && Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < 1.2 && Math.abs(p.y - this.groundY) < 0.6) p.arrived = true;
      if (p.arrived) {
        desired = new THREE.Vector3();
        this.yaw += dt * 0.8 * this.strafeDir;
        p.hold -= dt;
        if (p.hold <= 0) this.perch = null;
      } else {
        desired = this.steerTo(p.id, p, ctx);
        this.yaw = Math.atan2(-desired.x, -desired.z);
      }
    } else if (lead) {
      // Nobody in sight: walk the flow field toward the nearest enemy rather
      // than straight at them. Straight-line steering is fine on an open
      // arena and useless the moment a map has interior walls — the bot
      // grinds against one until the target happens to come round it.
      const step = this.steerTo(lead.id, lead.pos, ctx, true);
      if (step) {
        desired = step;
        this.yaw = Math.atan2(-desired.x, -desired.z);
      } else {
        desired = this.wanderStep(dt);
      }
    } else {
      desired = this.wanderStep(dt);
    }

    // --- hop and slide, like a player. In a fight a few rolls a second;
    // taking a hit can queue a slide; pinned on something low, hop it.
    const grounded = this.hopY <= 0 && this.hopV <= 0;
    this.moveCd = Math.max(0, this.moveCd - dt);
    if (best && !busy && !stunned && grounded && this.slideT <= 0 && this.moveCd <= 0) {
      this.moveRollT -= dt;
      if (this.wantSlide && this.moving) { this.wantSlide = false; this.startSlide(this.vel); }
      else if (this.moveRollT <= 0) {
        this.moveRollT = MOVE_ROLL;
        const r = Math.random();
        if (r < this.diff.jump) this.startHop();
        else if (r < this.diff.jump + this.diff.slide && this.moving) this.startSlide(this.vel);
      }
    }
    if (this.slideT > 0) {
      this.slideT -= dt;
      desired = this.slideDir.clone();
      if (this.slideT <= 0) this.slideT = 0;
    }
    this.stance = this.slideT > 0 ? "slide" : "stand";

    // Wading (a map's shallow water, arena.wade) slows them like it slows you.
    const wading = arena.wade && this.pos.y < 0.5 && insidePolygon(arena.wade, this.pos.x, this.pos.z);
    const slideBoost = this.slideT > 0 ? 1 + (SLIDE_BOOST - 1) * (this.slideT / SLIDE_TIME) : 1;
    const speed = BOT_SPEED * (this.speedMult || 1) * (wading ? 0.6 : 1) * slideBoost
      * (this.slideT > 0 ? 1 : 1 - (1 - ADS_MOVE) * this.ads);
    const turn = this.slideT > 0 || !grounded ? 1.5 : 5;   // committed in a slide or a hop
    this.vel.x += (desired.x * speed - this.vel.x) * Math.min(1, dt * turn);
    this.vel.z += (desired.z * speed - this.vel.z) * Math.min(1, dt * turn);
    const wasX = this.pos.x, wasZ = this.pos.z;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;

    this.pos.x = Math.max(arena.minX + BOT_RADIUS, Math.min(arena.maxX - BOT_RADIUS, this.pos.x));
    this.pos.z = Math.max(arena.minZ + BOT_RADIUS, Math.min(arena.maxZ - BOT_RADIUS, this.pos.z));
    if (arena.edge) clampInsidePolygon(this.pos, arena.edge, BOT_RADIUS);
    // On a stair, ducking under the floor above where the flight passes
    // through its stairwell: the slab's edge is lower than head height
    // part of the way (the U Mad Mansion's), and caught the bots there.
    resolveCircle(colliders, this.pos, BOT_RADIUS, this.groundY + this.hopY, this.climb ? CLIMB_HEADROOM : BOT_HEIGHT, 0.5);

    // Pushing into something and getting nowhere: hop it.
    const wantMove = desired.lengthSq() > 0.25;
    const got = Math.hypot(this.pos.x - wasX, this.pos.z - wasZ) / Math.max(dt, 1e-3);
    this.stuckT = wantMove && got < 0.6 && grounded ? this.stuckT + dt : 0;
    if (this.stuckT > STUCK_HOP) { this.stuckT = 0; this.startHop(); }

    if (this.hopY > 0 || this.hopV > 0) {
      this.hopV -= HOP_GRAVITY * dt;
      this.hopY += this.hopV * dt;
      // Landing on whatever is under the feet (a crate hopped onto counts).
      const feet = this.groundY + this.hopY;
      const under = groundHeightAt(colliders, this.pos.x, this.pos.z, feet + 0.3, BOT_RADIUS * 0.8);
      if (this.hopV < 0 && feet <= under) { this.groundY = under; this.hopY = 0; this.hopV = 0; }
      else if (under > this.groundY && feet > under) { this.hopY = feet - under; this.groundY = under; }
    } else {
      const support = groundHeightAt(colliders, this.pos.x, this.pos.z, this.groundY + 0.5, BOT_RADIUS * 0.8);
      this.groundY += (support - this.groundY) * Math.min(1, dt * 9);
    }
    this.pos.y = this.groundY + this.hopY;

    // Real ground speed, not "had steering input" — a bot holding its strafe
    // dance to trade shots was reporting `moving: true` every tick (see the
    // old hardcoded flag this replaced in net.js's publishBot), so remote
    // viewers saw it play a full forward jog while it barely drifted.
    this.moving = Math.hypot(this.vel.x, this.vel.z) > 0.4;

    // --- melee (infected): swing once they've been in reach a beat
    if (this.meleeOnly) {
      this.meleeT -= dt;
      if (best && !stunned && bestD <= MELEE_REACH && this.acquireT >= this.diff.reaction && this.meleeT <= 0) {
        this.meleeT = MELEE_INTERVAL * (0.7 + this.diff.interval * 0.35) * (0.9 + Math.random() * 0.2);
        ctx.onMelee?.(this, best);
      }
      return;
    }

    // --- shoot
    this.fireT -= dt;
    if (this.sidearmReloadT > 0) {
      this.sidearmReloadT -= dt;
      if (this.sidearmReloadT <= 0) this.sidearmAmmo = SIDEARM_MAG_SIZE;
    }
    // Hands full with the bomb means no trigger, same as for a player.
    const canSee = !busy && best && bestD < FIRE_RANGE;
    // They keep firing into a guard (user, 2026-10-03: "enemies don't shoot at
    // me when I have my trollsaber shielded"): standing there not shooting
    // read as broken. The rounds still bounce off the blade and drain its
    // meter; smarter bots shoot while they work round the side.
    const canShoot = canSee;
    // A short reaction delay before the first shot, so they don't snap onto
    // someone the instant they round a corner.
    const reacted = this.acquireT >= this.diff.reaction;

    // Dry primary with someone still in sight draws the sidearm instead of
    // reloading into a firefight; holstering it again (back to the rifle)
    // waits for a clear moment, same as the primary's own out-of-contact
    // reload just below.
    if (!this.holdingSecondary && this.ammo <= 0 && canSee) this.holdingSecondary = true;
    else if (this.holdingSecondary && !canSee && this.reloadT <= 0) this.holdingSecondary = false;
    this.updateAds(dt, { canShoot, reacted, range: bestD, objective });
    if (this.slideT > 0 || this.hopY > 0) this.ads = Math.max(0, this.ads - dt * 6);   // no scope mid-slide or mid-air

    if (this.holdingSecondary) {
      if (reacted && canShoot && this.sidearmReloadT <= 0 && this.fireT <= 0) {
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

    if (canShoot && reacted && this.reloadT <= 0 && this.fireT <= 0) {
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

  /* 0..1 through the current reload (0 = not reloading), for the body's
     third-person reload (net.js sends it as `rl`). */
  reloadProgress() {
    if (this.holdingSecondary) return this.sidearmReloadT > 0 ? 1 - this.sidearmReloadT / SIDEARM_RELOAD_TIME : 0;
    return this.reloadT > 0 ? 1 - this.reloadT / RELOAD_TIME : 0;
  }

  /* Scope in or out this frame. Moves `ads` toward the goal at the
     difficulty's scope-in speed (out is quicker, as for a player). */
  updateAds(dt, { canShoot, reacted, range, objective }) {
    const reloading = this.holdingSecondary ? this.sidearmReloadT > 0 : this.reloadT > 0;
    const engaged = canShoot && reacted && range >= ADS_MIN_RANGE;
    if (engaged) this.adsLingerT = between(ADS_LINGER);
    else this.adsLingerT = Math.max(0, this.adsLingerT - dt);
    // An objective that can't wait means running, not scoping.
    const want = !this.meleeOnly && !reloading && !objective?.urgent && !(this.stunT > 0)
      && (engaged || (this.adsLingerT > 0 && !(canShoot && range < ADS_MIN_RANGE)));
    const rate = want ? 1 / (this.diff.adsTime || 0.3) : 1 / 0.15;
    this.ads = want ? Math.min(1, this.ads + dt * rate) : Math.max(0, this.ads - dt * rate);
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
    // What's in the pockets: the lethal, and the tactical (smoke is cover,
    // not something to throw at someone, so it has its own use below).
    const L = this.frags > 0 ? this.lethalKind : null;
    const T = this.flashes > 0 ? this.tacticalKind : null;
    const Tat = T && T !== "smoke" ? T : null;

    // Hurt and in a gunfight: smoke between us and them, then back off in it.
    if (T === "smoke" && best && this.hp < (this.maxHp || BOT_HP) * 0.5) {
      const d = distTo(best.pos.x, best.pos.z);
      if (d >= 6) {
        const k = Math.min(0.45, 9 / d);
        const x = this.pos.x + (best.pos.x - this.pos.x) * k, z = this.pos.z + (best.pos.z - this.pos.z) * k;
        return { kind: T, x, y: this.groundY, z, dist: distTo(x, z), lob: false };
      }
    }

    // Saber guard up at us: the blade stops rounds, not blasts or flashes.
    if (best && this.guarded) {
      const d = distTo(best.pos.x, best.pos.z);
      const kind = L || Tat;
      const y = best.groundY ?? best.pos.y ?? 0;
      if (kind && inRange(d)) return { kind, x: best.pos.x, y, z: best.pos.z, dist: d, lob: false };
    }

    if (L) {
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
        return { kind: L, x: bestGroup.x, y: bestGroup.y, z: bestGroup.z,
          dist: distTo(bestGroup.x, bestGroup.z), lob: hidden(bestGroup.x, bestGroup.y, bestGroup.z) };
      }
    }

    if (objective) {
      const d = distTo(objective.x, objective.z);
      const held = enemies.some((e) => Math.hypot(e.pos.x - objective.x, e.pos.z - objective.z) <= (objective.radius || 4) + 2);
      if (held && inRange(d)) {
        // Smoke on a held objective is cover for the push onto it.
        const kind = L || T;
        const y = objective.y ?? this.groundY;
        return { kind, x: objective.x, y, z: objective.z, dist: d, lob: hidden(objective.x, y, objective.z) };
      }
    }

    const seen = this.lastSeen;
    if (!best && seen && seen.age < SEEN_MEMORY) {
      const still = enemies.find((e) => e.id === seen.id && Math.hypot(e.pos.x - seen.x, e.pos.z - seen.z) < 5);
      const d = distTo(seen.x, seen.z);
      if (still && inRange(d)) {
        const kind = d < 15 && Tat ? Tat : L || Tat;
        if (kind) return { kind, x: seen.x, y: seen.y, z: seen.z, dist: d, lob: true };
      }
    }
    return null;
  }

  /* Which way to walk to reach `goal` ({ x, z } and, if it has one, a
     height `y` / `groundY`), stairs included (user, 2026-10-03: "bots
     should also be smart in being able to walk up and down stairs").
     Same level (or no height given, or no stairs on the map): the flow
     field on this bot's level. Another level: the foot of the stair that
     best leads there (ctx.stairs: maps.js api.stairs + findStairs, and a
     zombies map's links), then up or down it, then on from the top.
     `orNull`: null instead of a straight line when there's no route, so the
     caller can wander. `goal.static`: a fixed spot (a perch), whose fields
     are kept for the match rather than pooled. */
  steerTo(id, goal, ctx, orNull = false) {
    const stairs = ctx.stairs || [];
    const here = this.groundY;
    const gy = goal.groundY ?? goal.y;
    if (this.climb) {
      const dir = this.climbStep(ctx);
      if (dir) return dir;
    }
    // Caught on the treads without a climb on (strafed onto them in a fight,
    // or knocked off course): finish the flight, whichever way the goal is,
    // rather than read the field of a "level" that's only a stair.
    if (stairs.length && this.hopY <= 0) {
      const on = this.onStair(stairs);
      if (on) {
        const { s, len } = on;
        const lo = s.a.y < s.b.y ? s.a : s.b, hi = lo === s.a ? s.b : s.a;
        let exit;
        if (gy == null) exit = Math.hypot(s.a.x - goal.x, s.a.z - goal.z) < Math.hypot(s.b.x - goal.x, s.b.z - goal.z) ? s.a : s.b;
        else exit = gy > here + 0.3 ? hi : gy < here - 0.3 ? lo : (Math.abs(hi.y - gy) < Math.abs(lo.y - gy) ? hi : lo);
        this.climb = { entry: exit === s.a ? s.b : s.a, exit, t: 0, limit: len / 2 + 3 };
        const dir = this.climbStep(ctx);
        if (dir) return dir;
      }
    }
    const field = (key, x, z, level, isStatic) => ctx.navFor?.({ id: key, pos: { x, z }, static: isStatic }, level);
    // The field's own target cell (a goal in a gap too tight for the grid
    // snaps to the nearest open cell, which can be the one we're in): the
    // last few metres are a straight walk.
    const arrived = (f) => {
      const k = f?.openIndex(this.pos.x, this.pos.z);
      return k >= 0 && f.dist[k] === 1 && Math.hypot(goal.x - this.pos.x, goal.z - this.pos.z) < 4;
    };
    const straight = () => {
      const v = new THREE.Vector3(goal.x - this.pos.x, 0, goal.z - this.pos.z);
      return v.lengthSq() > 1e-6 ? v.normalize() : new THREE.Vector3();
    };
    let step = null, tried = false;
    if (gy == null || !stairs.length || Math.abs(gy - here) < SAME_LEVEL) {
      const f = field(id, goal.x, goal.z, here, goal.static);
      step = f?.steer(this.pos.x, this.pos.z);
      tried = true;
      if (step) return step;
      if (arrived(f) && (gy == null || Math.abs(gy - here) < 0.6)) return straight();
    }
    // Another floor (or no way there on this one: a landing half a floor
    // short of the goal's): the stair that leads there.
    if (gy != null && stairs.length && Math.abs(gy - here) >= 0.5) {
      const plan = this.planStair(id, goal, gy, ctx, field);
      if (plan) {
        const { entry, exit, key } = plan;
        if (Math.hypot(entry.x - this.pos.x, entry.z - this.pos.z) < 1.1) {
          const len = Math.hypot(exit.x - entry.x, exit.z - entry.z);
          this.climb = { entry, exit, t: 0, limit: len / 2 + 3 };
          this.stairPlan = null;
          const dir = this.climbStep(ctx);
          if (dir) return dir;
        }
        step = field(key, entry.x, entry.z, here, true)?.steer(this.pos.x, this.pos.z);
        if (step) return step;
        const v = new THREE.Vector3(entry.x - this.pos.x, 0, entry.z - this.pos.z);
        if (v.lengthSq() > 1e-6) return v.normalize();
      }
    }
    if (!tried) step = field(id, goal.x, goal.z, here, goal.static)?.steer(this.pos.x, this.pos.z);
    if (step) return step;
    if (orNull) return null;
    const v = new THREE.Vector3(goal.x - this.pos.x, 0, goal.z - this.pos.z);
    return v.lengthSq() > 1e-6 ? v.normalize() : new THREE.Vector3(0, 0, -1);
  }

  /* Up (or down) the flight in this.climb: along its centre line, a little
     ahead of where the bot is on it, so one that stepped on off-centre
     straightens up instead of walking off the side of a narrow stair.
     Null (and the climb over) once it's at the end, or it's taking far too
     long, or it's been knocked off the side. */
  climbStep(ctx) {
    const c = this.climb, e = c.exit, a = c.entry || e;
    c.t += ctx.dtNow || 0.016;
    const dx = e.x - a.x, dz = e.z - a.z, len = Math.hypot(dx, dz) || 1;
    const ux = dx / len, uz = dz / len;
    const t = (this.pos.x - a.x) * ux + (this.pos.z - a.z) * uz;
    const done = (Math.abs(this.groundY - e.y) < 0.45 && Math.hypot(e.x - this.pos.x, e.z - this.pos.z) < 0.9) || t > len + 0.3;
    const side = Math.abs((this.pos.x - a.x) * uz - (this.pos.z - a.z) * ux);
    if (done || c.t > (c.limit || 8) || side > 2.2) { this.climb = null; return null; }
    const aim = Math.min(len, Math.max(0, t) + 1.4);
    const v = new THREE.Vector3(a.x + ux * aim - this.pos.x, 0, a.z + uz * aim - this.pos.z);
    if (v.lengthSq() < 0.04) v.set(ux, 0, uz);
    return v.normalize();
  }

  /* The flight this bot is standing on, partway up: { s, t, len }, or null. */
  onStair(stairs) {
    for (const s of stairs) {
      const dx = s.b.x - s.a.x, dz = s.b.z - s.a.z, len = Math.hypot(dx, dz);
      if (len < 1 || Math.abs(s.b.y - s.a.y) < 1) continue;
      const t = ((this.pos.x - s.a.x) * dx + (this.pos.z - s.a.z) * dz) / len;
      if (t < 0.8 || t > len - 0.8) continue;
      if (Math.abs((this.pos.x - s.a.x) * dz - (this.pos.z - s.a.z) * dx) / len > 1.0) continue;
      const y = s.a.y + (s.b.y - s.a.y) * (t / len);
      if (Math.abs(this.groundY - y) > 0.45) continue;
      // properly off the floor at either end, not walking past its foot
      if (this.groundY < Math.min(s.a.y, s.b.y) + 0.6 || this.groundY > Math.max(s.a.y, s.b.y) - 0.6) continue;
      return { s, t, len };
    }
    return null;
  }

  /* Which stair to take toward `goal` on another level: { entry, exit, key }
     or null. Ranked by real walking distance along this level's field to
     its foot (a stair round the far side of a wall isn't "near") and on from
     its top to the goal along that level's field (one that tops out on some
     other roof doesn't lead there). Kept for a moment: it's a few field
     lookups, and a bot dithering between two stairs reaches neither. */
  planStair(id, goal, gy, ctx, field) {
    const now = this.clock || 0;
    const p = this.stairPlan;
    if (p && p.id === id && now < p.until && Math.abs(p.here - this.groundY) < 0.5) return p.none ? null : p;
    const stairs = ctx.stairs, here = this.groundY, up = gy > here;
    const cand = [];
    for (let i = 0; i < stairs.length; i++) {
      const s = stairs[i];
      for (const [entry, exit, end] of [[s.a, s.b, "a"], [s.b, s.a, "b"]]) {
        if (Math.abs(entry.y - here) > 0.9 || Math.abs(exit.y - entry.y) < 0.5 || (exit.y > entry.y) !== up) continue;
        // and not on past the goal's floor (up the Ferris wheel to reach a
        // platform a metre off the ground)
        if (up ? exit.y > gy + 0.6 : exit.y < gy - 0.6) continue;
        const rough = Math.hypot(entry.x - this.pos.x, entry.z - this.pos.z)
          + Math.hypot(exit.x - goal.x, exit.z - goal.z) + Math.abs(exit.y - gy) * 4;
        cand.push({ i, end, entry, exit, rough });
      }
    }
    cand.sort((m, n) => m.rough - n.rough);
    const fdist = (f, x, z) => {
      if (!f) return Infinity;
      const k = f.openIndex(x, z);
      return k >= 0 && f.dist[k] ? f.dist[k] * f.cell : Infinity;
    };
    let best = null, bestCost = Infinity;
    for (const c of cand.slice(0, 5)) {
      const key = `stair${c.i}${c.end}`;
      const toFoot = Math.hypot(c.entry.x - this.pos.x, c.entry.z - this.pos.z) < 1.5
        ? 0 : fdist(field(key, c.entry.x, c.entry.z, here, true), this.pos.x, this.pos.z);
      if (!isFinite(toFoot)) continue;
      let onward;
      if (Math.abs(c.exit.y - gy) < 0.6) {
        onward = fdist(field(id, goal.x, goal.z, c.exit.y, goal.static), c.exit.x, c.exit.z);
        if (!isFinite(onward)) onward = 200 + Math.hypot(c.exit.x - goal.x, c.exit.z - goal.z);   // a last resort
      } else {
        // A landing short of the goal's floor: only worth it if another
        // flight goes on from there (a funbox's top is a dead end).
        let next = Infinity;
        for (const s of stairs) {
          for (const [en, ex] of [[s.a, s.b], [s.b, s.a]]) {
            if (Math.abs(en.y - c.exit.y) > 0.9 || (ex.y > en.y) !== up || Math.abs(ex.y - en.y) < 0.5) continue;
            if (up ? ex.y > gy + 0.6 : ex.y < gy - 0.6) continue;
            next = Math.min(next, Math.hypot(en.x - c.exit.x, en.z - c.exit.z) * 1.3
              + Math.hypot(ex.x - goal.x, ex.z - goal.z) * 1.3 + Math.abs(ex.y - gy) * 4);
          }
        }
        if (!isFinite(next)) continue;
        onward = next;
      }
      const cost = toFoot + onward;
      if (cost < bestCost) { bestCost = cost; best = { id, key, entry: c.entry, exit: c.exit }; }
    }
    this.stairPlan = best ? { ...best, here, until: now + 1.2 } : { id, here, until: now + 0.6, none: true };
    return best;
  }

  /* Sometimes, with nobody in sight, a bot heads up a stair to hold the
     high ground for a few seconds instead of always running at whoever's
     nearest (user: bots should go upstairs on their own, not only when
     chasing). True while it has a perch to go to or hold. */
  updatePerch(dt, ctx) {
    const stairs = ctx.stairs || [];
    if (this.perch) {
      const p = this.perch;
      p.t += dt;
      if (p.t > PERCH_GIVE_UP && !p.arrived) this.perch = null;
      return !!this.perch;
    }
    this.perchT = (this.perchT ?? between(PERCH_FIRST)) - dt;
    if (this.perchT > 0 || !stairs.length) return false;
    this.perchT = between(PERCH_EVERY);
    if (Math.random() > PERCH_CHANCE) return false;
    // A stair top within reach; the spot is a step or two past it, so the
    // bot doesn't park in the stairwell.
    const tops = [];
    for (let i = 0; i < stairs.length; i++) {
      const s = stairs[i];
      const [lo, hi, end] = s.a.y < s.b.y ? [s.a, s.b, "b"] : [s.b, s.a, "a"];
      if (hi.y < 1.2 || hi.y - lo.y < 1) continue;
      if (Math.hypot(hi.x - this.pos.x, hi.z - this.pos.z) > PERCH_RANGE) continue;
      tops.push({ i, end, lo, hi });
    }
    if (!tops.length) return false;
    const c = tops[Math.floor(Math.random() * tops.length)];
    const dx = c.hi.x - c.lo.x, dz = c.hi.z - c.lo.z, l = Math.hypot(dx, dz) || 1;
    let x = c.hi.x, z = c.hi.z;
    const fx = x + dx / l * 1.5, fz = z + dz / l * 1.5;
    if (Math.abs(groundHeightAt(ctx.colliders, fx, fz, c.hi.y + 0.3, BOT_RADIUS * 0.8) - c.hi.y) < 0.3
      && !resolveBlocked(ctx.colliders, fx, fz, c.hi.y)) { x = fx; z = fz; }
    this.perch = { id: `perch${c.i}${c.end}`, x, y: c.hi.y, z, t: 0, hold: between(PERCH_HOLD), arrived: false, static: true };
    return true;
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
    this.fieldPool = new Map();   // [level|]target id -> FlowField, reused across sweeps
    this.fieldBases = new Map();  // level -> the blocked grid every field there copies
    this.frameFields = new Map(); // fields already swept this tick
    this.staticFields = new Map(); // [level|]fixed spot -> FlowField, for the match
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
    // Which cells are blocked depends only on the map: worked out once here
    // and copied into every field (a big map rebuilding it per target was
    // most of the nav cost). arena.navCell: a coarser grid for big maps.
    this.fieldBases.clear();
    this.fieldPool.clear();
    this.frameFields.clear();
    this.staticFields.clear();
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
    // A big room: at most this many sweeps a frame. Past it a field already
    // swept for that target is reused a few frames stale rather than 100
    // bots re-sweeping 100 different island-sized fields every 0.3 s.
    let budget = this.bots.length > 24 ? 6 : Infinity;

    // Which cells are blocked on a level, worked out once and copied into
    // every field there.
    const baseFor = (level) => {
      let base = this.fieldBases.get(level);
      if (!base) {
        const src = this.fieldSrc;
        if (level > 0.5) {
          // Upstairs, a finer grid: walkways and landings up there are often
          // only a metre and a half wide (the Grinder's platforms, the top of
          // a stair), narrower than two coarse cells once the rails are
          // padded, so the ground floor's grid sealed them off. It only
          // covers where there's floor at this height, so a fine grid on a
          // big map (Troll Royale's island) stays small.
          let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
          for (const c of src.colliders) {
            if (Math.abs(c.max.y - level) > 0.45) continue;
            x0 = Math.min(x0, c.min.x); x1 = Math.max(x1, c.max.x);
            z0 = Math.min(z0, c.min.z); z1 = Math.max(z1, c.max.z);
          }
          const a = src.arena;
          const bounds = x0 > x1 ? { minX: a.minX, maxX: a.minX + 1, minZ: a.minZ, maxZ: a.minZ + 1 }
            : { minX: Math.max(a.minX, x0 - 2), maxX: Math.min(a.maxX, x1 + 2), minZ: Math.max(a.minZ, z0 - 2), maxZ: Math.min(a.maxZ, z1 + 2) };
          const cell = a.navCell ? Math.max(UPPER_NAV_CELL, a.navCell / 2) : UPPER_NAV_CELL;
          base = new FlowField(src.colliders, bounds, level, { cell, needSupport: true });
        } else {
          base = new FlowField(src.colliders, src.arena, level || src.floorY, { ...(src.arena.navCell ? { cell: src.arena.navCell } : {}) });
        }
        this.fieldBases.set(level, base);
      }
      return base;
    };
    const navFor = (target, levelY = 0) => {
      if (!target || !this.fieldSrc) return null;
      // A field per floor level: an upstairs walker needs the upstairs
      // walls, and only cells with floor under them (not the ground plan).
      const level = Math.max(0, Math.round(levelY * 2) / 2);
      const key = level ? `${level}|${target.id}` : target.id;
      // A fixed spot (a stair's foot, a perch): swept once and kept for the
      // match, outside the pool, so lots of them can't evict the chases.
      if (target.static) {
        let f = this.staticFields.get(key);
        if (!f) {
          f = new FlowField(null, null, 0, { template: baseFor(level) });
          f.compute(target.pos.x, target.pos.z);
          this.staticFields.set(key, f);
        }
        return f;
      }
      let f = this.frameFields.get(key);
      if (!f) {
        f = this.fieldPool.get(key);
        if (f?.swept && budget <= 0) return f;
        if (!f) {
          // Ids churn as people join, leave and bots recycle; keep the pool
          // from growing for the length of a match. Room for two targets a
          // bot (a Royale bot chases its own loot), or they evict each other
          // and every lookup is a fresh sweep.
          if (this.fieldPool.size >= Math.max(12, this.bots.length * 2)) {
            this.fieldPool.delete(this.fieldPool.keys().next().value);
          }
          f = new FlowField(null, null, 0, { template: baseFor(level) });
          this.fieldPool.set(key, f);
        }
        f.compute(target.pos.x, target.pos.z);
        f.swept = true;
        budget--;
        this.frameFields.set(key, f);
      }
      return f;
    };

    // A big room (Troll Royale's 100): a bot nowhere near a real player
    // thinks every 2nd frame (4th past 150 m), staggered, with the skipped
    // time handed over in one go, so it still covers the same ground.
    // `ctx.lodNear`: where the real players are (null = every bot, every frame).
    const lod = ctx.lodNear && this.bots.length > 24 ? ctx.lodNear : null;
    this.lodFrame = (this.lodFrame || 0) + 1;
    const sub = { ...ctx, navFor, dtNow: dt };
    for (let i = 0; i < this.bots.length; i++) {
      const bot = this.bots[i];
      let step = dt;
      if (lod && bot.alive) {
        let d2 = Infinity;
        for (const p of lod) d2 = Math.min(d2, (p.x - bot.pos.x) ** 2 + (p.z - bot.pos.z) ** 2);
        const every = d2 > 150 * 150 ? 4 : d2 > 70 * 70 ? 2 : 1;
        bot.lodDt = (bot.lodDt || 0) + dt;
        if ((this.lodFrame + i) % every) continue;
        step = Math.min(0.1, bot.lodDt);
        bot.lodDt = 0;
      }
      bot.update(step, sub);
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
  /* `pierce`: ignores armour (Troll Royale's Cringe). Bots only carry
     armour in Troll Royale (`bot.armor`, set by game.js). */
  applyHit(botId, dmg, { pierce = false } = {}) {
    const bot = this.byId(botId);
    if (!bot || !bot.alive) return { killed: false, bot: null };
    if (!pierce && bot.armor > 0) {
      const soak = Math.min(bot.armor, dmg);
      bot.armor -= soak;
      dmg -= soak;
      if (dmg <= 0) { bot.onDamaged(); return { killed: false, bot }; }
    }
    bot.hp -= dmg;
    bot.onDamaged();
    if (bot.hp > 0) return { killed: false, bot };
    bot.alive = false;
    bot.deaths++;
    bot.respawnT = RESPAWN;
    return { killed: true, bot };
  }
}
