// Troll Ops — Zombies: the round director, the horde AI and the points economy.
//
// Rounds scale the way the genre expects: health climbs flat early then
// compounds, counts grow to a cap, and a round only ends when the last one
// drops. Zombies spawn from the boarded windows on the player's CURRENT
// floor, which is both faithful and sidesteps cross-floor pathfinding — the
// Pentagrin's three levels are only reachable by stairs.

import * as THREE from "three";
import { makeEnemyDissolveMaterial } from "./shaders.js";
import { buildHumanoid, poseHumanoid } from "./character.js";
import { groundHeightAt, resolveCircle } from "./movement.js";
import { floorOf } from "./pentagrin.js";

export const ZOMBIE_TYPES = {
  troll: {
    id: "troll", face: "grin", color: 0x8f9a86,
    hpMult: 1, speed: 1.5, height: 1.78, build: 1.05,
    damage: 22, attackRange: 1.5, attackCd: 1.1,
  },
  pepe: {
    id: "pepe", face: "pepe", color: 0x62a34a,
    hpMult: 0.85, speed: 1.85, height: 1.72, build: 1.0,
    damage: 18, attackRange: 1.45, attackCd: 0.95,
  },
};

// points, straight from the genre
export const POINTS = { hit: 10, kill: 60, headshotKill: 100 };

const MAX_ALIVE = 12;
const SPAWN_INTERVAL = 1.1;
const ROUND_BREAK = 5;

/* Classic curve: +100 a round to round 9, then ×1.1 compounding. */
export function healthForRound(round) {
  if (round <= 9) return 150 + (round - 1) * 100;
  return Math.round(950 * Math.pow(1.1, round - 9));
}

export function countForRound(round) {
  return Math.min(28, 6 + Math.floor(round * 1.8));
}

export function speedForRound(round, base) {
  return base * Math.min(1.75, 1 + round * 0.045);
}

let idc = 0;

export class Zombie {
  constructor(typeId, position, scene, round) {
    this.type = ZOMBIE_TYPES[typeId];
    this.isZombie = true;
    this.id = ++idc;
    this.maxHp = Math.round(healthForRound(round) * this.type.hpMult);
    this.hp = this.maxHp;
    this.speed = speedForRound(round, this.type.speed);
    this.alive = true;
    this.dying = false;
    this.dissolveT = 0;
    this.attackCdT = 0.6;
    this.staggerT = 0;
    this.stunT = 0;
    this.velocity = new THREE.Vector3();
    this.groundY = position.y || 0;
    this.phase = Math.random() * Math.PI * 2;

    const mat = makeEnemyDissolveMaterial(this.type.color);
    this.rig = buildHumanoid(mat, {
      height: this.type.height,
      build: this.type.build,
      gun: false,
      face: this.type.face,
    });
    this.mesh = this.rig.root;
    this.mesh.userData.dissolveMat = mat;
    this.mesh.position.copy(position);
    scene.add(this.mesh);
  }

  get radius() { return 0.38 * this.type.build; }

  takeDamage(dmg, isHead) {
    if (!this.alive || this.dying) return { killed: false, points: 0 };
    this.hp -= dmg;
    this.staggerT = 0.08;
    if (this.hp > 0) return { killed: false, points: POINTS.hit };
    this.dying = true;
    return { killed: true, points: isHead ? POINTS.headshotKill : POINTS.kill, isHead };
  }

  stun(seconds) {
    this.stunT = Math.max(this.stunT || 0, seconds);
  }

  update(dt, playerPos, onAttack, arena, colliders) {
    if (this.stunT > 0 && !this.dying) {
      this.stunT -= dt;
      this.mesh.rotation.y += dt * 3;
      this.velocity.multiplyScalar(Math.max(0, 1 - 6 * dt));
      return;
    }
    if (this.dying) {
      this.dissolveT += dt * 1.5;
      this.mesh.userData.dissolveMat.uniforms.uDissolve.value = this.dissolveT;
      this.mesh.position.y -= dt * 0.25;
      if (this.dissolveT >= 1) this.alive = false;
      return;
    }

    const to = new THREE.Vector3().subVectors(playerPos, this.mesh.position);
    to.y = 0;
    const dist = to.length();
    this.attackCdT = Math.max(0, this.attackCdT - dt);

    // Damping belongs only where we're NOT steering. Applying it every frame
    // on top of the steering lerp settles the velocity at ~0.375x the
    // intended speed, which makes them shuffle far slower than configured.
    const damp = (rate) => {
      const k = Math.max(0, 1 - rate * dt);
      this.velocity.x *= k;
      this.velocity.z *= k;
    };

    if (this.staggerT > 0) {
      this.staggerT -= dt;
      damp(7);
    } else if (dist > this.type.attackRange) {
      to.normalize();
      this.velocity.x += (to.x * this.speed - this.velocity.x) * Math.min(1, dt * 5);
      this.velocity.z += (to.z * this.speed - this.velocity.z) * Math.min(1, dt * 5);
      this.mesh.rotation.y = Math.atan2(-to.x, -to.z);
    } else {
      damp(9);
      if (this.attackCdT <= 0) {
        this.attackCdT = this.type.attackCd;
        onAttack(this, this.type.damage);
      }
    }

    this.mesh.position.x += this.velocity.x * dt;
    this.mesh.position.z += this.velocity.z * dt;

    const r = this.radius;
    this.mesh.position.x = Math.max(arena.minX + r, Math.min(arena.maxX - r, this.mesh.position.x));
    this.mesh.position.z = Math.max(arena.minZ + r, Math.min(arena.maxZ - r, this.mesh.position.z));
    resolveCircle(colliders, this.mesh.position, r, this.groundY, this.type.height, 0.5);

    const support = groundHeightAt(colliders, this.mesh.position.x, this.mesh.position.z, this.groundY + 0.6, r * 0.8);
    this.groundY += (support - this.groundY) * Math.min(1, dt * 8);
    this.mesh.position.y = this.groundY;

    const moving = dist > this.type.attackRange;
    this.phase += dt * (moving ? 5.5 : 2.5);
    poseHumanoid(this.rig, { phase: this.phase, moving, zombie: true, dt });
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.mesh.userData.dissolveMat.dispose();
  }
}

export class ZombieDirector {
  constructor(scene, arena, colliders, windows) {
    this.scene = scene;
    this.arena = arena;
    this.colliders = colliders;
    this.windows = windows;
    this.zombies = [];
    this.round = 0;
    this.toSpawn = 0;
    this.spawnCd = 0;
    this.breakT = 0;
    this.points = 0;
    this.kills = 0;
    this.state = "idle";  // idle | spawning | fighting | between
  }

  get aliveCount() { return this.zombies.filter((z) => z.alive && !z.dying).length; }
  get remaining() { return this.aliveCount + this.toSpawn; }

  startRound(n) {
    this.round = n;
    this.toSpawn = countForRound(n);
    this.spawnCd = 0.8;
    this.state = "spawning";
  }

  award(points) { this.points += points; }

  /* Spend, if affordable. Z2's doors, wall buys and perks go through this. */
  spend(cost) {
    if (this.points < cost) return false;
    this.points -= cost;
    return true;
  }

  /* Windows on the player's floor — zombies come in where you are. */
  spawnPointFor(playerPos) {
    const floor = floorOf(playerPos.y);
    const here = this.windows.filter((w) => floorOf(w.y) === floor);
    const pool = here.length ? here : this.windows;
    if (!pool.length) return null;
    // prefer a window that isn't right on top of the player
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < 4; i++) {
      const w = pool[Math.floor(Math.random() * pool.length)];
      const d = Math.hypot(w.x - playerPos.x, w.z - playerPos.z);
      const score = d > 6 ? d : -d;
      if (score > bestScore) { bestScore = score; best = w; }
    }
    return best;
  }

  pickType() {
    return Math.random() < 0.45 ? "pepe" : "troll";
  }

  update(dt, playerPos, onAttack) {
    if (this.state === "spawning" || this.state === "fighting") {
      if (this.toSpawn > 0) {
        this.spawnCd -= dt;
        if (this.spawnCd <= 0 && this.aliveCount < MAX_ALIVE) {
          this.spawnCd = SPAWN_INTERVAL;
          const w = this.spawnPointFor(playerPos);
          if (w) {
            const pos = new THREE.Vector3(
              w.x + (Math.random() - 0.5) * 1.4,
              w.y,
              w.z + (Math.random() - 0.5) * 1.4,
            );
            this.zombies.push(new Zombie(this.pickType(), pos, this.scene, this.round));
            this.toSpawn--;
          }
        }
      } else {
        this.state = "fighting";
      }
    }

    for (const z of this.zombies) {
      if (z.alive) z.update(dt, playerPos, onAttack, this.arena, this.colliders);
    }

    const dead = this.zombies.filter((z) => !z.alive);
    if (dead.length) {
      for (const z of dead) z.dispose(this.scene);
      this.zombies = this.zombies.filter((z) => z.alive);
    }

    if (this.state === "fighting" && this.remaining === 0) {
      this.state = "between";
      this.breakT = ROUND_BREAK;
    }
    if (this.state === "between") {
      this.breakT -= dt;
      if (this.breakT <= 0) return true;   // caller starts the next round
    }
    return false;
  }

  hitMeshes() {
    const out = [];
    for (const z of this.zombies) {
      if (!z.alive || z.dying) continue;
      z.mesh.traverse((o) => { if (o.isMesh) out.push(o); });
    }
    return out;
  }

  resolve(object) {
    let o = object;
    while (o) {
      if (o.userData?.dissolveMat) {
        const z = this.zombies.find((zz) => zz.mesh === o);
        if (z) return z;
      }
      o = o.parent;
    }
    return null;
  }

  clear() {
    for (const z of this.zombies) z.dispose(this.scene);
    this.zombies = [];
    this.toSpawn = 0;
    this.state = "idle";
  }
}
