// Troll Ops — grunt (horde enemy) definitions, spawning, and simple steering AI.
import * as THREE from "three";
import { makeEnemyDissolveMaterial } from "./shaders.js";
import { groundHeightAt, resolveCircle } from "./movement.js";
import { buildHumanoid, poseHumanoid } from "./character.js";

const GRUNT_TYPES = {
  runner: { hp: 40, speed: 4.4, radius: 0.42, height: 1.7, build: 1.0, color: 0x6bd15a, scoreValue: 100, damage: 8, attackRange: 1.3, attackCd: 0.7 },
  brute:  { hp: 140, speed: 2.6, radius: 0.62, height: 2.3, build: 1.4, color: 0xd15a5a, scoreValue: 250, damage: 18, attackRange: 1.7, attackCd: 1.1 },
  spitter:{ hp: 55, speed: 3.2, radius: 0.44, height: 1.75, build: 0.9, color: 0xd1c85a, scoreValue: 160, damage: 12, attackRange: 12, attackCd: 1.8, ranged: true },
};

function buildGruntRig(type) {
  const mat = makeEnemyDissolveMaterial(type.color);
  const rig = buildHumanoid(mat, { height: type.height, build: type.build || 1, gun: false });
  rig.root.userData.dissolveMat = mat;
  return rig;
}

let idCounter = 0;

export class Grunt {
  constructor(typeId, position, scene) {
    this.typeId = typeId;
    this.type = GRUNT_TYPES[typeId];
    this.id = ++idCounter;
    this.hp = this.type.hp;
    this.maxHp = this.type.hp;
    this.alive = true;
    this.dying = false;
    this.dissolveT = 0;
    this.attackCdT = 0;
    this.staggerT = 0;
    this.stunT = 0;
    this.velocity = new THREE.Vector3();
    this.rig = buildGruntRig(this.type);
    this.mesh = this.rig.root;
    this.mesh.position.copy(position);
    this.groundY = position.y || 0;
    this.bobPhase = Math.random() * Math.PI * 2;
    scene.add(this.mesh);
  }

  takeDamage(dmg, isHead, knockDir) {
    if (!this.alive || this.dying) return { killed: false };
    this.hp -= dmg;
    this.staggerT = 0.12;
    if (knockDir) {
      this.velocity.addScaledVector(knockDir, isHead ? 2.2 : 1.1);
    }
    if (this.hp <= 0) {
      this.dying = true;
      return { killed: true, scoreValue: this.type.scoreValue };
    }
    return { killed: false };
  }

  /* Flashbanged: stands there swaying until it wears off. */
  stun(seconds) {
    this.stunT = Math.max(this.stunT || 0, seconds);
  }

  update(dt, playerPos, onAttack, arenaBounds, colliders = []) {
    if (this.stunT > 0 && !this.dying) {
      this.stunT -= dt;
      this.mesh.rotation.y += dt * 2.4;
      this.velocity.multiplyScalar(Math.max(0, 1 - 6 * dt));
      return;
    }
    if (this.dying) {
      this.dissolveT += dt * 1.6;
      this.mesh.userData.dissolveMat.uniforms.uDissolve.value = this.dissolveT;
      this.mesh.position.y -= dt * 0.3;
      this.mesh.rotation.y += dt * 1.5;
      if (this.dissolveT >= 1) {
        this.alive = false;
      }
      return;
    }

    const toPlayer = new THREE.Vector3().subVectors(playerPos, this.mesh.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();
    this.attackCdT = Math.max(0, this.attackCdT - dt);

    // Same rule as the zombies: only damp when we aren't steering, or the
    // per-frame multiply fights the lerp and caps speed at ~0.375x.
    const damp = (rate) => {
      const k = Math.max(0, 1 - rate * dt);
      this.velocity.x *= k;
      this.velocity.z *= k;
    };

    if (this.staggerT > 0) {
      this.staggerT -= dt;
      damp(7);
    } else if (dist > this.type.attackRange) {
      toPlayer.normalize();
      const speed = this.type.speed;
      this.velocity.x += (toPlayer.x * speed - this.velocity.x) * Math.min(1, dt * 4);
      this.velocity.z += (toPlayer.z * speed - this.velocity.z) * Math.min(1, dt * 4);
      const angle = Math.atan2(toPlayer.x, toPlayer.z);
      this.mesh.rotation.y += (angle - this.mesh.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      this.mesh.rotation.y = angle;
    } else {
      damp(9);
      if (this.attackCdT <= 0) {
        this.attackCdT = this.type.attackCd;
        onAttack(this, this.type.damage, this.type.ranged);
      }
    }

    this.mesh.position.x += this.velocity.x * dt;
    this.mesh.position.z += this.velocity.z * dt;

    const r = this.type.radius;
    // Maps have real geometry now, so grunts have to be pushed out of walls
    // and stand on whatever surface is under them instead of sitting at y=0.
    this.mesh.position.x = Math.max(arenaBounds.minX + r, Math.min(arenaBounds.maxX - r, this.mesh.position.x));
    this.mesh.position.z = Math.max(arenaBounds.minZ + r, Math.min(arenaBounds.maxZ - r, this.mesh.position.z));
    resolveCircle(colliders, this.mesh.position, r, this.groundY, this.type.height, 0.5);

    const support = groundHeightAt(colliders, this.mesh.position.x, this.mesh.position.z, this.groundY + 0.5, r * 0.8);
    this.groundY += (support - this.groundY) * Math.min(1, dt * 9);

    const chasing = dist > this.type.attackRange;
    this.bobPhase += dt * (chasing ? 9 : 3);
    this.mesh.position.y = this.groundY;
    poseHumanoid(this.rig, { phase: this.bobPhase, moving: chasing, pitch: 0, lower: 0, dt });
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.mesh.userData.dissolveMat.dispose();
  }
}

export class WaveSpawner {
  constructor(scene, arenaBounds, spawnPoints, colliders = []) {
    this.scene = scene;
    this.arenaBounds = arenaBounds;
    this.spawnPoints = spawnPoints;
    this.colliders = colliders;
    this.grunts = [];
    this.wave = 0;
    this.toSpawn = 0;
    this.spawnCdT = 0;
    this.waveActive = false;
  }

  startWave(n) {
    this.wave = n;
    this.waveActive = true;
    this.toSpawn = 4 + Math.floor(n * 2.2);
    this.spawnCdT = 0;
  }

  get aliveCount() {
    return this.grunts.filter((g) => g.alive && !g.dying).length;
  }

  pickType() {
    const n = this.wave;
    const roll = Math.random();
    if (n >= 3 && roll < 0.12 + n * 0.01) return "brute";
    if (n >= 2 && roll < 0.35) return "spitter";
    return "runner";
  }

  update(dt, playerPos, onAttack) {
    if (this.waveActive && this.toSpawn > 0) {
      this.spawnCdT -= dt;
      if (this.spawnCdT <= 0 && this.aliveCount < 14) {
        this.spawnCdT = 0.45;
        const sp = this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)];
        const jitter = new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3);
        const pos = sp.clone().add(jitter);
        pos.y = groundHeightAt(this.colliders, pos.x, pos.z, 3);
        this.grunts.push(new Grunt(this.pickType(), pos, this.scene));
        this.toSpawn--;
      }
      if (this.toSpawn <= 0) this.waveActive = false;
    }

    for (const g of this.grunts) {
      if (g.alive) g.update(dt, playerPos, onAttack, this.arenaBounds, this.colliders);
    }

    const dead = this.grunts.filter((g) => !g.alive);
    if (dead.length) {
      for (const g of dead) g.dispose(this.scene);
      this.grunts = this.grunts.filter((g) => g.alive);
    }
  }

  isWaveClear() {
    return !this.waveActive && this.aliveCount === 0;
  }
}

export { GRUNT_TYPES };
