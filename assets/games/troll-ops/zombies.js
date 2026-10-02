// Troll Forces — Zombies: the round director, the horde AI and the points economy.
//
// Rounds scale the way the genre expects: health climbs flat early then
// compounds, counts grow to a cap, and a round only ends when the last one
// drops. Zombies spawn from the entry points on the player's CURRENT floor.
//
// Each zombies map hands the director a layout (the map's zombieLayout()):
// its entry points, how a height maps to a floor, each floor's height, and
// optionally the stair links between floors. With links, a zombie left on
// another floor walks to the stair, climbs it and carries on; without them
// (the Pentagrin) everyone follows the player's floor field.

import * as THREE from "three";
import { FlowField } from "./nav.js?v=ti1";
import { makeEnemyDissolveMaterial } from "./shaders.js";
import { buildHumanoid, poseHumanoid } from "./character.js?v=to-lk1";
import { groundHeightAt, resolveCircle } from "./movement.js?v=ti1";

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
const RISE_TIME = 1.6;        // a grave spawn clawing up out of the ground
const RISE_DEPTH = 1.9;
const ATTACK_REACH_Y = 1.3;   // no swiping at someone on the balcony above
const CLIMB_GIVE_UP = 9;      // seconds on a stair before re-thinking the route

/* Max Ammo: one drop a round, off a random kill in that round. */
const DROP_LIFETIME = 25;
const DROP_PICKUP = 1.5;

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
  constructor(typeId, position, scene, round, { rise = false } = {}) {
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
    this.riseT = rise ? RISE_TIME : 0;
    this.climb = null;       // { exit, exitFloor } while changing floors
    this.climbT = 0;

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
    if (rise) {
      this.mesh.position.y = this.groundY - RISE_DEPTH;
      this.mesh.rotation.y = Math.random() * Math.PI * 2;
    }
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

  /* `route` says where to go: { field, goal, chase }. `field` steers round
     walls toward `goal` (null = walk straight at it); `chase` is false while
     heading for a stair, when there's nobody in reach to swing at.
     `playerFeetY` keeps it from swiping at someone a floor above. */
  update(dt, playerPos, onAttack, arena, colliders, route = null, playerFeetY = null) {
    if (this.riseT > 0 && !this.dying) {
      // Clawing out of the grave: up through the dirt with a shudder, and it
      // doesn't walk or swing until it's out.
      this.riseT = Math.max(0, this.riseT - dt);
      const k = 1 - this.riseT / RISE_TIME;
      const ease = 1 - Math.pow(1 - k, 2.2);
      this.mesh.position.y = this.groundY - RISE_DEPTH * (1 - ease);
      this.mesh.rotation.z = Math.sin(k * 14) * 0.06 * (1 - k);
      this.phase += dt * 2.5;
      poseHumanoid(this.rig, { phase: this.phase, moving: false, zombie: true, dt });
      if (this.riseT <= 0) this.mesh.rotation.z = 0;
      return;
    }
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

    const field = route ? route.field : null;
    const goal = route?.goal || playerPos;
    const chase = route ? route.chase : true;
    const to = new THREE.Vector3(goal.x - this.mesh.position.x, 0, goal.z - this.mesh.position.z);
    const dist = to.length();
    this.attackCdT = Math.max(0, this.attackCdT - dt);
    const feetY = playerFeetY ?? this.groundY;
    const inReach = chase && dist <= this.type.attackRange && Math.abs(feetY - this.groundY) < ATTACK_REACH_Y;

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
    } else if (!inReach && dist > 0.05) {
      to.normalize();
      // Indoors the field knows the way round the walls; close in, or when
      // this spot has no route, fall back to walking straight at them. Not
      // while still below or above them (a stair's top step, a rail between):
      // straight at them is into the rail.
      const level = Math.abs(feetY - this.groundY) < 0.25;
      const steer = (field && (dist > 2.5 || !level)) ? field.steer(this.mesh.position.x, this.mesh.position.z) : null;
      const dir = steer || to;
      this.velocity.x += (dir.x * this.speed - this.velocity.x) * Math.min(1, dt * 5);
      this.velocity.z += (dir.z * this.speed - this.velocity.z) * Math.min(1, dt * 5);
      this.mesh.rotation.y = Math.atan2(-dir.x, -dir.z);
    } else {
      damp(9);
      if (inReach && this.attackCdT <= 0) {
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

    const moving = !inReach;
    this.phase += dt * (moving ? 5.5 : 2.5);
    poseHumanoid(this.rig, { phase: this.phase, moving, zombie: true, dt });
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.mesh.userData.dissolveMat.dispose();
  }
}

/* The Max Ammo drop: an ammo can that bobs, turns and glows until it's
   walked over or times out (blinking through its last five seconds). The
   glow is an additive decal, not a light: a new light mid-match recompiles
   every shader (see light-pool.js). */
let glowTex = null;
function dropGlowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d");
  const grd = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.35, "rgba(255,255,255,.45)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = grd;
  x.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

export class AmmoDrop {
  constructor(scene, x, y, z) {
    this.scene = scene;
    this.t = 0;
    this.alive = true;
    this.base = new THREE.Vector3(x, y, z);
    const can = new THREE.MeshStandardMaterial({ color: 0x55632f, roughness: 0.55, metalness: 0.15, emissive: 0x1c2608 });
    const band = new THREE.MeshStandardMaterial({ color: 0xffd23a, roughness: 0.4, emissive: 0xffb300, emissiveIntensity: 0.9 });
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.4, 0.3), can);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.07, 0.34), can);
    lid.position.y = 0.23;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.02, 6, 14, Math.PI), band);
    handle.position.y = 0.27;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.09, 0.31), band);
    stripe.position.y = 0.04;
    g.add(body, lid, handle, stripe);
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 2.2),
      new THREE.MeshBasicMaterial({
        map: dropGlowTexture(), color: 0x9dff5a, transparent: true, opacity: 0.8,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.04;
    this.glow = glow;
    this.can = g;
    this.root = new THREE.Group();
    this.root.add(g, glow);
    this.root.position.copy(this.base);
    scene.add(this.root);
  }

  /* True when the player (feet position) walks over it. */
  update(dt, feet) {
    this.t += dt;
    this.can.position.y = 0.55 + Math.sin(this.t * 2.6) * 0.12;
    this.can.rotation.y += dt * 1.6;
    const left = DROP_LIFETIME - this.t;
    this.root.visible = left > 5 || Math.floor(this.t * 6) % 2 === 0;
    this.glow.material.opacity = 0.6 + Math.sin(this.t * 5) * 0.2;
    if (left <= 0) { this.alive = false; return false; }
    const d = Math.hypot(feet.x - this.base.x, feet.z - this.base.z);
    return d < DROP_PICKUP && Math.abs(feet.y - this.base.y) < 1.4;
  }

  dispose() {
    this.scene.remove(this.root);
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();   // the shared glow texture stays
    });
  }
}

export class ZombieDirector {
  /* `layout`: { windows: [{ x, y, z, rise? }], floorOf(y, x, z) -> floor id,
     floors: { id: y }, links?: [{ from, to, a: {x,z}, b: {x,z} }] (a on
     `from`, b on `to`), support?: upper floors only open where there is
     floor under them, preferDist?: metres a spawn should ideally be from
     the player (big open maps), navCell/navPad/navStep: the flow field's
     grid size, wall margin and step height (nav.js defaults otherwise). */
  constructor(scene, arena, colliders, layout) {
    this.scene = scene;
    this.arena = arena;
    this.colliders = colliders;
    this.layout = layout;
    this.windows = layout.windows;
    this.floorOf = layout.floorOf || (() => "ground");
    this.floors = layout.floors || { ground: 0 };
    this.links = layout.links || [];
    this.zombies = [];
    this.round = 0;
    this.toSpawn = 0;
    this.spawnCd = 0;
    this.breakT = 0;
    this.points = 0;
    this.kills = 0;
    this.state = "idle";  // idle | spawning | fighting | between
    this.fields = new Map();   // "floor|target" -> FlowField, built on first use
    this.fieldT = 0;
    this.drop = null;          // the Max Ammo can on the ground, if any
    this.dropAtKill = -1;      // which of this round's kills drops it
    this.roundKills = 0;
    this.events = [];          // drained by game.js: { type: "maxammo" }
  }

  /* A field on `floor`, keyed by what it leads to. */
  field(floor, key) {
    const k = `${floor}|${key}`;
    let f = this.fields.get(k);
    if (!f) {
      const floorY = this.floors[floor] ?? 0;
      f = new FlowField(this.colliders, this.arena, floorY, {
        needSupport: !!this.layout.support && floorY > 0.5,
        cell: this.layout.navCell, pad: this.layout.navPad, step: this.layout.navStep,   // undefined = the defaults
      });
      this.fields.set(k, f);
    }
    return f;
  }

  /* The field toward the player on the player's floor, re-swept a few times
     a second rather than every frame. `feet` is the player's feet. */
  fieldFor(feet, dt) {
    const field = this.field(this.floorOf(feet.y, feet.x, feet.z), "player");
    this.fieldT -= dt;
    if (this.fieldT <= 0 || field.targetIdx < 0) {
      this.fieldT = 0.3;
      field.compute(feet.x, feet.z);
    }
    return field;
  }

  /* The first floor to climb to on the way from `from` to `to` (a breadth-
     first walk over the stair links), or null if they don't connect. */
  nextFloor(from, to) {
    const key = `${from}>${to}`;
    this.hops ??= new Map();
    if (this.hops.has(key)) return this.hops.get(key);
    const prev = new Map([[from, null]]);
    const queue = [from];
    while (queue.length && !prev.has(to)) {
      const f = queue.shift();
      for (const l of this.links) {
        const n = l.from === f ? l.to : l.to === f ? l.from : null;
        if (n && !prev.has(n)) { prev.set(n, f); queue.push(n); }
      }
    }
    let step = null;
    if (prev.has(to)) {
      step = to;
      while (prev.get(step) !== from) step = prev.get(step);
    }
    this.hops.set(key, step);
    return step;
  }

  /* Where one zombie should head. On the player's floor (or on a map with
     no stair links): the player. Otherwise the nearest link off its floor,
     then straight up (or down) the stair to the far end. */
  routeFor(z, playerPos, playerField, feetY, dt) {
    if (z.climb) {
      const { exit, exitFloor } = z.climb;
      z.climbT += dt;
      const d = Math.hypot(exit.x - z.mesh.position.x, exit.z - z.mesh.position.z);
      const level = Math.abs(z.groundY - (this.floors[exitFloor] ?? 0)) < 0.35;
      if ((level && d < 1.2) || z.climbT > CLIMB_GIVE_UP) z.climb = null;
      else return { field: null, goal: exit, chase: false };
    }
    const here = this.floorOf(z.groundY + 0.2, z.mesh.position.x, z.mesh.position.z);
    const there = this.floorOf(feetY + 0.2, playerPos.x, playerPos.z);
    if (!this.links.length || here === there) return { field: playerField, goal: playerPos, chase: true };
    // With more than one stair, only take one that leads toward the
    // player's floor (the next floor on the way, through the links).
    const toward = this.nextFloor(here, there);
    let best = null, bestD = Infinity;
    for (let i = 0; i < this.links.length; i++) {
      const link = this.links[i];
      let entry, exit, exitFloor, end;
      if (link.from === here) { entry = link.a; exit = link.b; exitFloor = link.to; end = "a"; }
      else if (link.to === here) { entry = link.b; exit = link.a; exitFloor = link.from; end = "b"; }
      else continue;
      if (toward && exitFloor !== toward) continue;
      const d = Math.hypot(entry.x - z.mesh.position.x, entry.z - z.mesh.position.z);
      if (d < bestD) { bestD = d; best = { i, entry, exit, exitFloor, end }; }
    }
    if (!best) return { field: playerField, goal: playerPos, chase: true };
    if (bestD < 1.3) {
      z.climb = { exit: best.exit, exitFloor: best.exitFloor };
      z.climbT = 0;
      return { field: null, goal: best.exit, chase: false };
    }
    // the stair doesn't move, so its field is swept once and kept
    const f = this.field(here, `link${best.i}${best.end}`);
    if (f.targetIdx < 0) f.compute(best.entry.x, best.entry.z);
    return { field: f, goal: best.entry, chase: false };
  }

  get aliveCount() { return this.zombies.filter((z) => z.alive && !z.dying).length; }
  get remaining() { return this.aliveCount + this.toSpawn; }

  startRound(n) {
    this.round = n;
    this.toSpawn = countForRound(n);
    this.spawnCd = 0.8;
    this.state = "spawning";
    this.roundKills = 0;
    // one Max Ammo a round, off a kill somewhere past the first third
    this.dropAtKill = Math.max(1, Math.floor(this.toSpawn * (0.35 + Math.random() * 0.5)));
  }

  award(points) { this.points += points; }

  /* Spend, if affordable. Z2's doors, wall buys and perks go through this. */
  spend(cost) {
    if (this.points < cost) return false;
    this.points -= cost;
    return true;
  }

  /* Entry points on the player's floor — zombies come in where you are. */
  spawnPointFor(feet) {
    const floor = this.floorOf(feet.y, feet.x, feet.z);
    const here = this.windows.filter((w) => this.floorOf(w.y + 0.2, w.x, w.z) === floor);
    const pool = here.length ? here : this.windows;
    if (!pool.length) return null;
    // Prefer one that isn't right on top of the player; on a big open map,
    // also not so far off that they take a minute to arrive.
    const ideal = this.layout.preferDist || 0;
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < (ideal ? 6 : 4); i++) {
      const w = pool[Math.floor(Math.random() * pool.length)];
      const d = Math.hypot(w.x - feet.x, w.z - feet.z);
      const score = ideal
        ? (d < 7 ? d - 100 : -Math.abs(d - ideal))
        : (d > 6 ? d : -d);
      if (score > bestScore) { bestScore = score; best = w; }
    }
    return best;
  }

  pickType() {
    return Math.random() < 0.45 ? "pepe" : "troll";
  }

  /* `playerPos` is the eye; `feetY` the player's feet (defaults to a
     standing eye height below it). Returns true when the next round is due. */
  update(dt, playerPos, onAttack, feetY = playerPos.y - 1.6) {
    const feet = { x: playerPos.x, y: feetY + 0.2, z: playerPos.z };
    if (this.state === "spawning" || this.state === "fighting") {
      if (this.toSpawn > 0) {
        this.spawnCd -= dt;
        if (this.spawnCd <= 0 && this.aliveCount < MAX_ALIVE) {
          this.spawnCd = SPAWN_INTERVAL;
          const w = this.spawnPointFor(feet);
          if (w) {
            const spread = w.rise ? 0.3 : 1.4;   // a grave is a grave
            const pos = new THREE.Vector3(
              w.x + (Math.random() - 0.5) * spread,
              w.y,
              w.z + (Math.random() - 0.5) * spread,
            );
            this.zombies.push(new Zombie(this.pickType(), pos, this.scene, this.round, { rise: !!w.rise }));
            this.toSpawn--;
          }
        }
      } else {
        this.state = "fighting";
      }
    }

    const field = this.fieldFor(feet, dt);
    for (const z of this.zombies) {
      if (!z.alive) continue;
      const route = z.dying ? null : this.routeFor(z, playerPos, field, feetY, dt);
      z.update(dt, playerPos, onAttack, this.arena, this.colliders, route, feetY);
      if (z.dying && !z.counted) {
        z.counted = true;
        this.roundKills++;
        if (this.roundKills === this.dropAtKill && !this.drop) {
          const p = z.mesh.position;
          this.drop = new AmmoDrop(this.scene, p.x, Math.max(0, z.groundY), p.z);
        }
      }
    }

    if (this.drop) {
      const picked = this.drop.update(dt, { x: playerPos.x, y: feetY, z: playerPos.z });
      if (picked) this.events.push({ type: "maxammo" });
      if (picked || !this.drop.alive) { this.drop.dispose(); this.drop = null; }
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
      out.push(...z.rig.hitboxMeshes);
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
    if (this.drop) { this.drop.dispose(); this.drop = null; }
    this.events.length = 0;
  }
}
