// Troll Ops — grunt (horde enemy) definitions, spawning, and simple steering AI.
import * as THREE from "three";
import { makeEnemyDissolveMaterial } from "./shaders.js";

const GRUNT_TYPES = {
  runner: { hp: 40, speed: 4.4, radius: 0.42, height: 1.7, color: 0x6bd15a, scoreValue: 100, damage: 8, attackRange: 1.3, attackCd: 0.7 },
  brute:  { hp: 140, speed: 2.6, radius: 0.62, height: 2.3, color: 0xd15a5a, scoreValue: 250, damage: 18, attackRange: 1.7, attackCd: 1.1 },
  spitter:{ hp: 55, speed: 3.2, radius: 0.44, height: 1.75, color: 0xd1c85a, scoreValue: 160, damage: 12, attackRange: 12, attackCd: 1.8, ranged: true },
};

function buildGruntMesh(type) {
  const group = new THREE.Group();
  const mat = makeEnemyDissolveMaterial(type.color);

  const bodyGeo = new THREE.CapsuleGeometry(type.radius, type.height - type.radius * 2, 4, 8);
  const body = new THREE.Mesh(bodyGeo, mat);
  body.position.y = type.height / 2;
  body.castShadow = true;
  group.add(body);

  const headGeo = new THREE.SphereGeometry(type.radius * 0.85, 12, 10);
  const head = new THREE.Mesh(headGeo, mat);
  head.position.y = type.height + type.radius * 0.3;
  head.castShadow = true;
  head.userData.isHead = true;
  group.add(head);

  // grin — two dark eyes + a wide mouth arc, classic trollface energy without the emoji
  const eyeGeo = new THREE.SphereGeometry(type.radius * 0.14, 6, 6);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-type.radius * 0.32, type.height + type.radius * 0.4, type.radius * 0.72);
  eyeR.position.set(type.radius * 0.32, type.height + type.radius * 0.4, type.radius * 0.72);
  group.add(eyeL, eyeR);

  const mouthGeo = new THREE.TorusGeometry(type.radius * 0.42, type.radius * 0.08, 6, 12, Math.PI);
  const mouthMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
  const mouth = new THREE.Mesh(mouthGeo, mouthMat);
  mouth.rotation.x = Math.PI;
  mouth.position.set(0, type.height + type.radius * 0.08, type.radius * 0.75);
  group.add(mouth);

  group.userData.dissolveMat = mat;
  group.userData.headMesh = head;
  group.userData.bodyMesh = body;
  return group;
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
    this.velocity = new THREE.Vector3();
    this.mesh = buildGruntMesh(this.type);
    this.mesh.position.copy(position);
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

  update(dt, playerPos, onAttack, arenaBounds) {
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

    if (this.staggerT > 0) {
      this.staggerT -= dt;
    } else if (dist > this.type.attackRange) {
      toPlayer.normalize();
      const speed = this.type.speed;
      this.velocity.x += (toPlayer.x * speed - this.velocity.x) * Math.min(1, dt * 4);
      this.velocity.z += (toPlayer.z * speed - this.velocity.z) * Math.min(1, dt * 4);
      const angle = Math.atan2(toPlayer.x, toPlayer.z);
      this.mesh.rotation.y += (angle - this.mesh.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      this.mesh.rotation.y = angle;
    } else {
      this.velocity.x *= 0.8;
      this.velocity.z *= 0.8;
      if (this.attackCdT <= 0) {
        this.attackCdT = this.type.attackCd;
        onAttack(this, this.type.damage, this.type.ranged);
      }
    }

    // damping for knockback velocity beyond steering
    this.velocity.x *= 0.9;
    this.velocity.z *= 0.9;

    this.mesh.position.x += this.velocity.x * dt;
    this.mesh.position.z += this.velocity.z * dt;

    const r = this.type.radius;
    this.mesh.position.x = Math.max(arenaBounds.minX + r, Math.min(arenaBounds.maxX - r, this.mesh.position.x));
    this.mesh.position.z = Math.max(arenaBounds.minZ + r, Math.min(arenaBounds.maxZ - r, this.mesh.position.z));

    this.bobPhase += dt * (dist > this.type.attackRange ? 8 : 2);
    this.mesh.position.y = Math.abs(Math.sin(this.bobPhase)) * 0.06;
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && o.material !== this.mesh.userData.dissolveMat) o.material.dispose?.();
    });
    this.mesh.userData.dissolveMat.dispose();
  }
}

export class WaveSpawner {
  constructor(scene, arenaBounds, spawnPoints) {
    this.scene = scene;
    this.arenaBounds = arenaBounds;
    this.spawnPoints = spawnPoints;
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
        this.grunts.push(new Grunt(this.pickType(), pos, this.scene));
        this.toSpawn--;
      }
      if (this.toSpawn <= 0) this.waveActive = false;
    }

    for (const g of this.grunts) {
      if (g.alive) g.update(dt, playerPos, onAttack, this.arenaBounds);
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
