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
import { FlowField } from "./nav.js?v=ti1-bs1";
import { makeEnemyDissolveMaterial } from "./shaders.js";
import { buildHumanoid, poseHumanoid } from "./character.js?v=to-hb4-em1-fc1-wst-soc1";
import { groundHeightAt, resolveCircle } from "./movement.js?v=ti1-sb2";
import { preloadZombieModels, zombieModelsReady, pickLook, lookReady, createZombieBody, CLIP_SPEED, ONE_SHOTS } from "./zombie-models.js?v=zr4c";

/* Behaviour types. The look (body + clothes) is picked separately, so a
   runner can be any of the horde's bodies. `gait` is the clip it moves on. */
export const ZOMBIE_TYPES = {
  walker: {
    id: "walker", gait: "walk", color: 0x8f9a86,
    hpMult: 1, speed: 1.5, height: 1.78, build: 1.0,
    damage: 22, attackRange: 1.5, attackCd: 1.1,
  },
  runner: {
    id: "runner", gait: "run", color: 0x8f9a86,
    hpMult: 0.8, speed: 2.4, height: 1.78, build: 1.0,
    damage: 18, attackRange: 1.55, attackCd: 0.95,
  },
  // gaunt and long-armed, always in its own body: lopes in low and, from a
  // few metres off with a clear line, crouches with a shriek and leaps
  leaper: {
    id: "leaper", gait: "lope", color: 0x8f9a86,
    hpMult: 0.7, speed: 2.9, height: 1.7, build: 0.9,
    damage: 26, attackRange: 1.6, attackCd: 0.9, leaps: true,
  },
};

const RUNNERS_FROM = 5;       // round runners start showing up
const RUNNER_SHARE = 0.25;
const LEAPERS_FROM = 8;
const LEAPER_SHARE = 0.12;
const MAX_LEAPERS = 2;        // alive at once

/* The leap: from LEAP_MIN..LEAP_MAX metres, level with the target and with a
   clear line, a LEAP_WINDUP crouch (the shriek is the tell, so it's fair),
   then a LEAP_TIME arc LEAP_HEIGHT up that lands just short of where the
   target stood, raking if they're still in reach. */
const LEAP_MIN = 3.5;
const LEAP_MAX = 7.5;
const LEAP_WINDUP = 0.4;
const LEAP_TIME = 0.7;
const LEAP_HEIGHT = 1.2;
const LEAP_SHORT = 1.0;       // lands this far in front of the target
const LEAP_RECOVER = 0.5;
const LEAP_CD = 3.5;

/* Nothing tall between a and b at chest height on feet height y (colliders
   are boxes: a 2D slab test per box). */
export function lineClear(colliders, a, b, y) {
  const dx = b.x - a.x, dz = b.z - a.z;
  for (const c of colliders) {
    if (c.max.y < y + 0.5 || c.min.y > y + 1.4) continue;
    let t0 = 0, t1 = 1;
    for (const [p, d, lo, hi] of [[a.x, dx, c.min.x, c.max.x], [a.z, dz, c.min.z, c.max.z]]) {
      if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) { t0 = 2; break; } continue; }
      let u = (lo - p) / d, v = (hi - p) / d;
      if (u > v) [u, v] = [v, u];
      t0 = Math.max(t0, u); t1 = Math.min(t1, v);
      if (t0 > t1) break;
    }
    if (t0 <= t1) return false;
  }
  return true;
}
const DIE_HOLD = 1.6;         // seconds a body lies there before it sinks
const SINK_TIME = 1.4;
const SINK_DEPTH = 0.6;

// per-zombie skin tints, multiplied over the baked skin: pale, greener, greyer
const TINTS = [0xffffff, 0xe6f0d8, 0xd8dccf, 0xf0e8d8, 0xd0dcc4].map((h) => new THREE.Color(h));

/* ---- Gore and voices (ZR4) ------------------------------------------------
   A body bleeds out where it falls: a dark pool spreads under it and fades as
   it sinks. A headshot kill takes the head off (popHead): the head bone
   collapses to nothing (hair, eyes and teeth ride it) and a raw stump caps
   the neck. Voices are events the director hands game.js (audio.js
   zombieGroan / zombieSnarl / zombieDeath). */
const POOL_TIME = 1.3;        // seconds to spread
let _poolTex = null;
function poolTexture() {
  if (_poolTex) return _poolTex;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  // One lumpy shape, not a cluster of discs: many small solid blobs packed
  // round a core (denser toward the middle), softened at the edge. Pooled
  // blood is nearly black red; the gloss is the material's (poolMaterial).
  g.filter = "blur(3px)";
  g.fillStyle = "rgb(34,3,2)";
  g.beginPath(); g.arc(128, 128, 62, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2, d = Math.pow(Math.random(), 0.7) * 78;
    const r = 8 + Math.random() * (26 - d * 0.18);
    g.beginPath(); g.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, Math.max(4, r), 0, Math.PI * 2); g.fill();
  }
  // a few runnels reaching out past the edge
  g.lineCap = "round";
  g.strokeStyle = "rgb(34,3,2)";
  for (let i = 0; i < 4; i++) {
    const a = Math.random() * Math.PI * 2;
    g.lineWidth = 6 + Math.random() * 6;
    g.beginPath(); g.moveTo(128 + Math.cos(a) * 60, 128 + Math.sin(a) * 60);
    g.lineTo(128 + Math.cos(a + 0.2) * 112, 128 + Math.sin(a + 0.2) * 112); g.stroke();
  }
  // thinner (lighter) toward the rim, where it's spreading
  g.filter = "none";
  g.globalCompositeOperation = "source-atop";
  const rim = g.createRadialGradient(128, 128, 40, 128, 128, 125);
  rim.addColorStop(0, "rgba(20,1,1,0.6)");
  rim.addColorStop(1, "rgba(92,10,7,0.5)");
  g.fillStyle = rim;
  g.fillRect(0, 0, 256, 256);
  _poolTex = new THREE.CanvasTexture(c);
  _poolTex.colorSpace = THREE.SRGBColorSpace;
  return _poolTex;
}
const POOL_GEO = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const STUMP_GEO = new THREE.SphereGeometry(0.065, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
const STUMP_MAT = new THREE.MeshStandardMaterial({ color: 0x5a0a07, roughness: 0.35, emissive: 0x1a0201 });

/* Lit and glossy, so it's dark in the dark and catches the moon and lamps
   like a wet floor does. */
function poolMaterial() {
  return new THREE.MeshStandardMaterial({
    map: poolTexture(), transparent: true, depthWrite: false, roughness: 0.12, metalness: 0,
    envMapIntensity: 1.2,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
}

/* Throwaway copies of the gore's pool and stump for game.js's countdown
   warm-up (warmShaders), so the first headshot kill doesn't stall the frame
   compiling them. Own materials: the warm-up disposes its stand-ins. */
export function goreStandIns() {
  return [new THREE.Mesh(POOL_GEO, poolMaterial()), new THREE.Mesh(STUMP_GEO, STUMP_MAT.clone())];
}

/* A zombie's own throat: pitch and rasp by type, the woman's look higher. */
function voiceFor(typeId, look) {
  const base = { walker: [0.82, 1.08, 0.45], runner: [1.02, 1.28, 0.75], leaper: [1.2, 1.45, 0.95] }[typeId] || [0.9, 1.1, 0.5];
  let pitch = base[0] + Math.random() * (base[1] - base[0]);
  if (look === "woman") pitch *= 1.35;
  return { pitch, rasp: Math.min(1, base[2] + (Math.random() - 0.5) * 0.3) };
}
const groanGap = (typeId) => (typeId === "walker" ? 4 + Math.random() * 6 : 2.5 + Math.random() * 3.5);

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
    this.attackT = 0;        // the swipe clip still playing
    this.sinkT = 0;

    this.leap = null;        // { phase: windup | air | land, t, from, to }
    this.leapCdT = 1.5;
    this.shrieked = false;   // set on a wind-up; the director turns it into an event
    this.voice = null;       // set once the look is known (voiceFor)
    this.voiceEvent = null;  // "groan" | "snarl" | "death": the director sends it to game.js
    this.groanT = 0.5 + Math.random() * 4;
    this.pool = null;        // the blood pool once it's down
    this.headless = false;

    const look = pickLook(typeId);
    this.look = look;
    this.voice = voiceFor(typeId, look);
    this.body = look ? createZombieBody(look, {
      tint: TINTS[Math.floor(Math.random() * TINTS.length)],
      build: 0.94 + Math.random() * 0.14,
    }) : null;
    if (this.body) {
      this.mesh = this.body.root;
      this.hitboxMeshes = this.body.hitboxMeshes;
      this.anim = null;
      this.sinkT = 0;
      this.flinch = new THREE.Vector3();     // x: pitch, z: roll (radians), decaying
      // out of step with each other, or the horde marches like a drill team
      for (const a of Object.values(this.body.actions)) a.time = Math.random() * a.getClip().duration;
      this.play(rise ? this._riseClip() : this.type.gait, 0);
    } else {
      // models unavailable: the old stick figure in the dissolve shader
      const mat = makeEnemyDissolveMaterial(this.type.color);
      this.rig = buildHumanoid(mat, { height: this.type.height, build: this.type.build, gun: false, face: "grin" });
      this.mesh = this.rig.root;
      this.mesh.userData.dissolveMat = mat;
      this.hitboxMeshes = this.rig.hitboxMeshes;
    }
    this.mesh.userData.zombie = this;
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
    // a headshot kill pops the head instead (no throat left to gurgle with)
    this.voiceEvent = isHead && this.body ? null : "death";
    return { killed: true, points: isHead ? POINTS.headshotKill : POINTS.kill, isHead };
  }

  stun(seconds) {
    this.stunT = Math.max(this.stunT || 0, seconds);
  }

  /* Cross-fade to a clip. Loops keep their own phase; one-shots restart. */
  play(name, fade = 0.25) {
    const next = this.body.actions[name];
    if (!next || this.anim === next) return;
    if (ONE_SHOTS.has(name)) next.reset();
    next.enabled = true;
    next.setEffectiveTimeScale(1);
    next.setEffectiveWeight(1);
    next.play();
    if (this.anim && fade > 0) this.anim.crossFadeTo(next, fade, false);
    else if (this.anim) this.anim.stop();
    this.anim = next;
    this.animName = name;
  }

  /* A bullet's shove: the chest tips away from the shot, then recovers.
     Called by game.js for the model bodies (the stick rig flinches itself). */
  flinchFrom(dir, strength = 0.5) {
    if (!this.body || this.dying) return;
    const len = Math.hypot(dir.x, dir.z) || 1;
    // axis up x dir: a turn about it tips the top toward where the shot went
    this.flinch.x += (dir.z / len) * 0.32 * strength;
    this.flinch.z += (-dir.x / len) * 0.32 * strength;
  }

  _flinchPose(dt) {
    const f = this.flinch;
    const amt = Math.hypot(f.x, f.z);
    if (amt < 1e-3) return;
    const bone = this.body.bones.spine_02;
    _axis.set(f.x / amt, 0, f.z / amt);
    _qw.setFromAxisAngle(_axis, Math.min(0.6, amt));
    bone.parent.getWorldQuaternion(_qp);
    // world-axis turn expressed in the bone's parent frame
    _ql.copy(_qp).invert().multiply(_qw).multiply(_qp);
    bone.quaternion.premultiply(_ql);
    f.multiplyScalar(Math.max(0, 1 - dt * 7));
  }

  /* Drive the clips from what the body is doing this frame. */
  _animate(dt, { moving = false, speed = 0 } = {}) {
    if (this.dying) {
      this.play("die", 0.12);
    } else if (this.attackT > 0) {
      this.attackT -= dt;
    } else if (this.leap) {
      // the leap sets its own clips (crouch, leap, idle on landing)
    } else if (this.riseT > 0) {
      this.play(this._riseClip(), 0.2);
    } else if (moving && speed > 0.15) {
      const g = this.type.gait;
      this.play(g, 0.3);
      this.anim.setEffectiveTimeScale(Math.max(0.45, Math.min(2.4, speed / CLIP_SPEED[g])));
    } else {
      this.play("idle", 0.35);
    }
    this.body.mixer.update(dt);
    // the clips key the head too, so a popped head stays gone every frame
    if (this.headless) this.body.bones.head.scale.setScalar(0.001);
    this._flinchPose(dt);
  }

  _clip(name, fade) {
    if (this.body) this.play(name, fade);
  }

  /* One frame of a leap: crouch (facing the target), the arc, the landing.
     The arc moves in steps that walls still stop. */
  _leapStep(dt, playerPos, onAttack, arena, colliders, feetY) {
    const L = this.leap;
    const p = this.mesh.position;
    const r = this.radius;
    this.velocity.set(0, 0, 0);
    if (L.phase === "windup") {
      this.mesh.rotation.y = Math.atan2(-(playerPos.x - p.x), -(playerPos.z - p.z));
      L.t -= dt;
      if (L.t > 0) return;
      const dx = playerPos.x - p.x, dz = playerPos.z - p.z;
      const d = Math.hypot(dx, dz) || 1;
      const reach = Math.max(0.5, Math.min(LEAP_MAX, d - LEAP_SHORT));
      this.leap = { phase: "air", k: 0, y0: this.groundY, dx: (dx / d) * reach, dz: (dz / d) * reach };
      this._clip("leap", 0.08);
      return;
    }
    if (L.phase === "air") {
      const k0 = L.k;
      L.k = Math.min(1, L.k + dt / LEAP_TIME);
      p.x += L.dx * (L.k - k0);
      p.z += L.dz * (L.k - k0);
      p.x = Math.max(arena.minX + r, Math.min(arena.maxX - r, p.x));
      p.z = Math.max(arena.minZ + r, Math.min(arena.maxZ - r, p.z));
      const y = L.y0 + 4 * LEAP_HEIGHT * L.k * (1 - L.k);
      resolveCircle(colliders, p, r, y, this.type.height, 0.5);
      p.y = y;
      if (L.k < 1) return;
      this.groundY = groundHeightAt(colliders, p.x, p.z, L.y0 + 0.6, r * 0.8);
      p.y = this.groundY;
      this.leap = { phase: "land", t: LEAP_RECOVER };
      this.leapCdT = LEAP_CD;
      const d = Math.hypot(playerPos.x - p.x, playerPos.z - p.z);
      if (d <= this.type.attackRange + 0.4 && Math.abs(feetY - this.groundY) < ATTACK_REACH_Y) {
        this.attackCdT = this.type.attackCd;
        this._swing();
        onAttack(this, this.type.damage);
      } else {
        this._clip("idle", 0.15);
      }
      return;
    }
    L.t -= dt;
    if (L.t <= 0) this.leap = null;
  }

  /* Clawing out of a grave (the clip is RISE_TIME long); older GLBs had none. */
  _riseClip() {
    return this.body.actions.rise ? "rise" : "idle";
  }

  /* A headshot kill: the head is gone. Returns where it was (world space),
     for the burst and the sound, or null on the stick-figure fallback. */
  popHead() {
    if (!this.body || this.headless) return null;
    const head = this.body.bones.head;
    const at = head.getWorldPosition(new THREE.Vector3());
    at.y += 0.08;
    this.headless = true;
    head.scale.setScalar(0.001);
    // the raw neck, where the head bone joined it
    const stump = new THREE.Mesh(STUMP_GEO, STUMP_MAT);
    stump.position.copy(head.position);
    head.parent.add(stump);
    return at;
  }

  /* The pool spreading under a body that's down, fading as it sinks. */
  _bleed(dt, scene) {
    if (!this.pool) {
      this.pool = new THREE.Mesh(POOL_GEO, poolMaterial());
      this.pool.rotation.y = Math.random() * Math.PI * 2;
      this.pool.renderOrder = 1;
      this.poolT = 0;
      this.poolSize = (this.headless ? 1.9 : 1.4) * (0.85 + Math.random() * 0.3);
      this.pool.position.set(this.mesh.position.x, this.groundY + 0.02, this.mesh.position.z);
      scene.add(this.pool);
    }
    // Under the chest (the neck, headless) as the body goes down: the die
    // clip decides which way it falls. Fixed once it's on the floor.
    if (this.body && this.dissolveT < this.body.actions.die.getClip().duration) {
      const b = this.body.bones[this.headless ? "neck_01" : "spine_02"];
      if (b) {
        b.getWorldPosition(_poolAt);
        this.pool.position.x = _poolAt.x;
        this.pool.position.z = _poolAt.z;
      }
    }
    this.poolT += dt;
    const k = Math.min(1, this.poolT / POOL_TIME);
    const s = this.poolSize * (0.25 + 0.75 * (1 - Math.pow(1 - k, 2)));
    this.pool.scale.set(s, 1, s);
    this.pool.material.opacity = this.sinkT > 0 ? Math.max(0, 1 - this.sinkT / SINK_TIME) : 1;
  }

  _swing() {
    this.voiceEvent = "snarl";
    if (!this.body) return;
    this.play("attack", 0.1);
    this.attackT = this.body.actions.attack.getClip().duration * 0.9;
  }

  /* `route` says where to go: { field, goal, chase }. `field` steers round
     walls toward `goal` (null = walk straight at it); `chase` is false while
     heading for a stair, when there's nobody in reach to swing at.
     `playerFeetY` keeps it from swiping at someone a floor above. */
  update(dt, playerPos, onAttack, arena, colliders, route = null, playerFeetY = null, scene = null) {
    // a moan every few seconds while it's on its feet
    if (!this.dying) {
      this.groanT -= dt;
      if (this.groanT <= 0) {
        this.groanT = groanGap(this.type.id);
        if (!this.voiceEvent) this.voiceEvent = "groan";
      }
    }
    if (this.riseT > 0 && !this.dying) {
      // Clawing out of the grave: up through the dirt with a shudder, and it
      // doesn't walk or swing until it's out.
      this.riseT = Math.max(0, this.riseT - dt);
      const k = 1 - this.riseT / RISE_TIME;
      const ease = 1 - Math.pow(1 - k, 2.2);
      this.mesh.position.y = this.groundY - RISE_DEPTH * (1 - ease);
      this.mesh.rotation.z = Math.sin(k * 14) * 0.06 * (1 - k);
      this.phase += dt * 2.5;
      if (this.body) this._animate(dt);
      else poseHumanoid(this.rig, { phase: this.phase, moving: false, zombie: true, dt });
      if (this.riseT <= 0) this.mesh.rotation.z = 0;
      return;
    }
    // shot dead or stunned mid-leap: it drops out of the air
    if (this.leap && (this.dying || this.stunT > 0)) this.leap = null;
    if (!this.leap && this.mesh.position.y > this.groundY + 0.01) {
      this.mesh.position.y = Math.max(this.groundY, this.mesh.position.y - 7 * dt);
    }
    if (this.stunT > 0 && !this.dying) {
      this.stunT -= dt;
      this.mesh.rotation.y += dt * 3;
      this.velocity.multiplyScalar(Math.max(0, 1 - 6 * dt));
      if (this.body) this._animate(dt);
      return;
    }
    if (this.dying) {
      if (scene) this._bleed(dt, scene);
      if (this.body) {
        // fall (the die clip), lie there a moment, then sink into the ground
        this.dissolveT += dt;
        const dieLen = this.body.actions.die.getClip().duration;
        if (this.dissolveT > dieLen + DIE_HOLD) {
          this.sinkT += dt;
          this.mesh.position.y = this.groundY - SINK_DEPTH * Math.min(1, this.sinkT / SINK_TIME);
          if (this.sinkT >= SINK_TIME) this.alive = false;
        }
        this._animate(dt);
        return;
      }
      this.dissolveT += dt * 1.5;
      this.mesh.userData.dissolveMat.uniforms.uDissolve.value = this.dissolveT;
      this.mesh.position.y -= dt * 0.25;
      if (this.dissolveT >= 1) this.alive = false;
      return;
    }

    if (this.leap) {
      this._leapStep(dt, playerPos, onAttack, arena, colliders, playerFeetY ?? this.groundY);
      if (this.body) this._animate(dt);
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

    if (this.type.leaps) {
      this.leapCdT = Math.max(0, this.leapCdT - dt);
      if (chase && this.leapCdT <= 0 && this.staggerT <= 0 && dist >= LEAP_MIN && dist <= LEAP_MAX
          && Math.abs(feetY - this.groundY) < 0.4 && lineClear(colliders, this.mesh.position, goal, this.groundY)) {
        this.leap = { phase: "windup", t: LEAP_WINDUP };
        this.shrieked = true;
        this.mesh.rotation.y = Math.atan2(-to.x, -to.z);
        this._clip("crouch", 0.12);
        if (this.body) this._animate(dt);
        return;
      }
    }

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
        this._swing();
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
    if (this.body) {
      this._animate(dt, { moving, speed: Math.hypot(this.velocity.x, this.velocity.z) });
      return;
    }
    this.phase += dt * (moving ? 5.5 : 2.5);
    poseHumanoid(this.rig, { phase: this.phase, moving, zombie: true, dt });
  }

  dispose(scene) {
    scene.remove(this.mesh);
    if (this.pool) { scene.remove(this.pool); this.pool.material.dispose(); this.pool = null; }
    if (this.body) {
      // the geometry and textures are the shared template's
      this.body.dispose();
      return;
    }
    this.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.mesh.userData.dissolveMat.dispose();
  }
}

const _axis = new THREE.Vector3();
const _poolAt = new THREE.Vector3();
const _qw = new THREE.Quaternion();
const _qp = new THREE.Quaternion();
const _ql = new THREE.Quaternion();

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
    this.events = [];          // drained by game.js: { type: "maxammo" } | { type: "shriek", at } | { type: "groan" | "snarl" | "death", at, voice }
    this.groanCd = 0;          // horde-wide gap between moans, so twelve don't drone in unison
    this.snarlCd = 0;          // and between swipe snarls
    this.forceType = null;     // tests: every spawn is this type
    preloadZombieModels();     // the bodies; spawning waits for them (see update)
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
    if (this.forceType) return this.forceType;          // tests
    if (this.round >= LEAPERS_FROM && lookReady("leaper") && Math.random() < LEAPER_SHARE
        && this.zombies.filter((z) => z.alive && !z.dying && z.type.id === "leaper").length < MAX_LEAPERS) {
      return "leaper";
    }
    return this.round >= RUNNERS_FROM && Math.random() < RUNNER_SHARE ? "runner" : "walker";
  }

  /* `playerPos` is the eye; `feetY` the player's feet (defaults to a
     standing eye height below it). Returns true when the next round is due. */
  update(dt, playerPos, onAttack, feetY = playerPos.y - 1.6) {
    const feet = { x: playerPos.x, y: feetY + 0.2, z: playerPos.z };
    if (this.state === "spawning" || this.state === "fighting") {
      if (this.toSpawn > 0) {
        this.spawnCd -= dt;
        // false = the bodies are still downloading (null = they failed: the
        // stick figures stand in rather than nobody ever turning up)
        if (this.spawnCd <= 0 && this.aliveCount < MAX_ALIVE && zombieModelsReady() !== false) {
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
    this.groanCd -= dt;
    this.snarlCd -= dt;
    for (const z of this.zombies) {
      if (!z.alive) continue;
      const route = z.dying ? null : this.routeFor(z, playerPos, field, feetY, dt);
      z.update(dt, playerPos, onAttack, this.arena, this.colliders, route, feetY, this.scene);
      if (z.voiceEvent) {
        const kind = z.voiceEvent;
        z.voiceEvent = null;
        // moans and snarls take turns (a surrounding horde swipes several
        // times a second); a death always gets through
        const ready = kind === "groan" ? this.groanCd <= 0 : kind === "snarl" ? this.snarlCd <= 0 : true;
        if (ready) {
          if (kind === "groan") this.groanCd = 0.45 + Math.random() * 0.5;
          if (kind === "snarl") this.snarlCd = 0.6 + Math.random() * 0.4;
          const p = z.mesh.position;
          this.events.push({ type: kind, at: { x: p.x, y: p.y + 1.5, z: p.z }, voice: z.voice });
        }
      }
      if (z.shrieked) {
        z.shrieked = false;
        const p = z.mesh.position;
        this.events.push({ type: "shriek", at: { x: p.x, y: p.y + 1.5, z: p.z } });
      }
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
      out.push(...z.hitboxMeshes);
    }
    return out;
  }

  resolve(object) {
    let o = object;
    while (o) {
      const z = o.userData?.zombie;
      if (z && this.zombies.includes(z)) return z;
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
