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
const FIRE_INTERVAL = 0.85;
const HIT_CHANCE = 0.45;      // kept well under a real player's
const HEADSHOT_CHANCE = 0.12;
const BOT_DAMAGE = 17;

let counter = 0;

class Bot {
  constructor(team, spawn) {
    this.id = `bot-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    this.name = NAMES[counter % NAMES.length];
    this.team = team;
    this.isBot = true;
    this.hp = BOT_HP;
    this.alive = true;
    this.kills = 0;
    this.pos = new THREE.Vector3(spawn.x, 0, spawn.z);
    this.vel = new THREE.Vector3();
    this.yaw = Math.random() * Math.PI * 2;
    this.pitch = 0;
    this.groundY = 0;
    this.fireT = Math.random() * FIRE_INTERVAL;
    this.respawnT = 0;
    this.wander = new THREE.Vector3();
    this.wanderT = 0;
  }

  respawn(spawn) {
    this.pos.set(spawn.x, 0, spawn.z);
    this.vel.set(0, 0, 0);
    this.hp = BOT_HP;
    this.alive = true;
    this.groundY = 0;
  }

  update(dt, ctx) {
    const { colliders, arena, targets, onShoot, ffa } = ctx;

    if (!this.alive) {
      this.respawnT -= dt;
      return;
    }

    // --- pick the nearest visible enemy
    const eye = new THREE.Vector3(this.pos.x, this.groundY + 1.5, this.pos.z);
    let best = null, bestD = Infinity;
    for (const t of targets) {
      if (!t.alive) continue;
      if (t.id === this.id) continue;
      if (!ffa && t.team === this.team) continue;
      const d = Math.hypot(t.pos.x - this.pos.x, t.pos.z - this.pos.z);
      if (d > SIGHT_RANGE || d >= bestD) continue;
      const theirEye = new THREE.Vector3(t.pos.x, (t.groundY ?? t.pos.y ?? 0) + 1.4, t.pos.z);
      if (segmentBlocked(colliders, eye, theirEye)) continue;
      best = t; bestD = d;
    }

    // --- steer
    let desired;
    if (best) {
      this.yaw = Math.atan2(-(best.pos.x - this.pos.x), -(best.pos.z - this.pos.z));
      // close to a comfortable range rather than walking into their face
      const sign = bestD > 12 ? 1 : (bestD < 6 ? -1 : 0);
      desired = new THREE.Vector3(best.pos.x - this.pos.x, 0, best.pos.z - this.pos.z)
        .normalize().multiplyScalar(sign);
    } else {
      this.wanderT -= dt;
      if (this.wanderT <= 0) {
        this.wanderT = 2 + Math.random() * 3;
        const a = Math.random() * Math.PI * 2;
        this.wander.set(Math.cos(a), 0, Math.sin(a));
      }
      desired = this.wander.clone();
      if (desired.lengthSq() > 0) this.yaw = Math.atan2(-desired.x, -desired.z);
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
    if (best && bestD < FIRE_RANGE && this.fireT <= 0) {
      this.fireT = FIRE_INTERVAL * (0.75 + Math.random() * 0.6);
      // Misses are reported too, so the target hears the round go past.
      const hit = Math.random() < HIT_CHANCE;
      const head = hit && Math.random() < HEADSHOT_CHANCE;
      onShoot(this, best, hit ? BOT_DAMAGE * (head ? 2 : 1) : 0, head, hit, bestD);
    }
  }
}

export class BotManager {
  constructor() {
    this.bots = [];
    this.enabled = false;
  }

  get count() { return this.bots.length; }

  clear() {
    this.bots.length = 0;
  }

  /* Fill the room up to `target` participants, splitting bots across sides. */
  fill(target, humanCount, spawnFor, ffa) {
    const want = Math.max(0, target - humanCount);
    while (this.bots.length > want) this.bots.pop();
    while (this.bots.length < want) {
      const team = ffa
        ? (Math.random() < 0.5 ? "phantom" : "ghost")
        : (this.bots.filter((b) => b.team === "phantom").length <= this.bots.filter((b) => b.team === "ghost").length ? "phantom" : "ghost");
      this.bots.push(new Bot(team, spawnFor(team)));
    }
  }

  byId(id) { return this.bots.find((b) => b.id === id) || null; }

  update(dt, ctx) {
    for (const bot of this.bots) {
      bot.update(dt, ctx);
      if (!bot.alive && bot.respawnT <= 0) bot.respawn(ctx.spawnFor(bot.team, bot.id));
    }
  }

  /* Returns { killed, bot } so the caller can award the kill. */
  applyHit(botId, dmg) {
    const bot = this.byId(botId);
    if (!bot || !bot.alive) return { killed: false, bot: null };
    bot.hp -= dmg;
    if (bot.hp > 0) return { killed: false, bot };
    bot.alive = false;
    bot.respawnT = RESPAWN;
    return { killed: true, bot };
  }
}
