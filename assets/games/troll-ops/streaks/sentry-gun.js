// Troll Forces — Sentry Gun (Black Ops 2 scorestreak).
//
// BO2's Sentry Gun: set it down and it guards the spot by itself, turning
// onto any enemy it can see and cutting them down with its six-barrel
// rotary gun, a red targeting laser on whatever it's looking at (user,
// 2026-11-01: "excellent aim bot. quick to detect, quick to kill"). Blind
// Eye hides you from it; enemies can shoot it apart. It
// is the same BO2-style sentry the zombies kit puts down (zk-turret.glb,
// built by models/build_zkit.blender.py), at BO2 size. This file is the
// model, the aim and the shooting; air.js steps it every frame and only
// the caller's copy deals the damage, like the Gunship.

import * as THREE from "three";
import { game } from "../core/state.js?v=st1";
import { streakEntities } from "./calling.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-fs1-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ls4-gb4-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2-hb4-lu1-mb1-mb2-gc1-bt1-nft33-nfh1-nfh5-mg2-nft2531-nft2531h-tn13-fs2";
import { loadModel } from "../maps/battlefield-props.js?v=sr1-or1-tx1-sp1-kbt1-gb1-pm1-kbk2-tfp7-tfb8-ss1-ss2-ss3-tfm2-ugb1-ug1-ugm1-hgb6";
import { groundHeightAt } from "../core/movement.js?v=umb2-sb2-gj1b7-or1-gf1-tg1-rfx1-hb4-tn13";
import { raycastWorld } from "../weapons/ballistics.js?v=cg1-wst-hf1-fu1b7-wb1-ar1-ar2-cl1-fj1-zr10-zc1-zc2-or1-gf1-tg1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416-mt2-hb4";
import { hasPerk, peerHas } from "../progression/perks.js?v=pk1-cl1-bp1-fj1-zc1-zc2-nf1-or1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416-mt2-hb4-gc1-tn13";
import { WEAPON_DEFS } from "../weapons/weapons.js?v=p5bm-wst-hf1-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-or1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416-mt2-hb4";

export const SENTRY_DURATION = 90;     // seconds on the ground
export const SENTRY_HP = 500;          // bullet damage it takes to kill it
export const SENTRY_RANGE = 55;        // metres it will engage at
export const SENTRY_TURN = 7;          // rad/s it slews: snaps round onto you
export const SENTRY_RATE = 11;         // rounds a second
export const SENTRY_DAMAGE = 14;       // a round; 8 rounds (about 0.7 s) kill
export const SENTRY_REACT = 0.12;      // seconds on a new target before the first round
export const SENTRY_SPREAD = 0.003;    // radians: it doesn't miss
const SENTRY_ARM = 1.2;                // unfolding, then the head swings onto the sweep
const AIM_OK = 0.05;                   // radians off it will still fire at
const RETARGET = 0.1;
const LASER_ON = 0xff1e1e, LASER_IDLE = 0xb01010;
const BARREL_SPIN = 28;                // rad/s, the rotary cluster at full spin
const FLASH_TIME = 0.045;
const CHEST = 1.1;                     // feet to chest
const PIVOT = 0.98;                    // feet to the gun's trunnion: the barrels' line runs through it
const CLEAR = 0.95;                    // metres kept open round it, past the barrels' 0.78 m reach
const FX_DEF = WEAPON_DEFS.mtar || WEAPON_DEFS.problem416;

let flashMat = null;
function muzzleFlashMat() {
  if (flashMat) return flashMat;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,250,220,1)");
  grad.addColorStop(0.25, "rgba(255,200,90,0.9)");
  grad.addColorStop(1, "rgba(255,120,20,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  flashMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  return flashMat;
}

const _dir = new THREE.Vector3(), _p = new THREE.Vector3(), _to = new THREE.Vector3(), _back = new THREE.Vector3();

/* The targeting laser: a thin red beam out along +Z (scaled to length)
   and a glowing dot where it lands. */
let laserGeo = null, dotMat = null;
function buildLaser() {
  if (!laserGeo) {
    laserGeo = new THREE.CylinderGeometry(0.006, 0.006, 1, 6, 1, true);
    laserGeo.rotateX(Math.PI / 2);
    laserGeo.translate(0, 0, 0.5);
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, "rgba(255,230,230,1)"); grad.addColorStop(0.3, "rgba(255,40,40,.9)"); grad.addColorStop(1, "rgba(255,0,0,0)");
    g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
    dotMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  }
  const beam = new THREE.Mesh(laserGeo, new THREE.MeshBasicMaterial({ color: LASER_IDLE, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  beam.renderOrder = 4;
  beam.frustumCulled = false;
  const dot = new THREE.Sprite(dotMat);
  dot.scale.setScalar(0.12);
  return { beam, dot };
}

export class SentryGun {
  constructor({ id, owned, team, x, y, z, yaw = 0, duration = SENTRY_DURATION, botId = null, ownerId = null }) {
    this.id = id;
    this.owned = !!owned;
    this.team = team;
    this.botId = botId;
    this.ownerId = ownerId;    // whose it is, so free-for-all spares them
    this.duration = duration;
    this.age = 0;
    this.hp = SENTRY_HP;
    this.dead = false;
    this.groundKit = true;     // shootable streak kit on the ground (game.js targetMeshes)
    this.downBanner = "SENTRY GUN DESTROYED";
    this.pos = new THREE.Vector3(x, y, z);
    this.root = new THREE.Group();
    this.root.name = "SentryGun";
    this.root.position.copy(this.pos);
    this.root.rotation.y = yaw;
    this.yaw = yaw;
    this.headYaw = 0;          // relative to the base
    this.gunPitch = 0;
    this.spinV = 0;
    this.kick = 0;
    this.target = null;        // { id, rp, chest } of who it's on (id null = the local player)
    this.onT = 0;              // seconds on the current target
    this.retargetT = 0;
    this.fireT = 0;
    this.shots = 0;
    this.muzzle = new THREE.Vector3(x, y + PIVOT, z);
    this.eye = new THREE.Vector3(x, y + PIVOT, z);   // where it sees from: fixed, unlike the swinging muzzle
    this.flash = new THREE.Sprite(muzzleFlashMat());
    this.flash.visible = false;
    this.flashT = 0;
    this.laser = buildLaser();
    this.laser.beam.visible = this.laser.dot.visible = false;
    this.hitbox = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.3, 1.0), new THREE.MeshBasicMaterial({ visible: false }));
    this.hitbox.position.y = 0.65;
    this.hitbox.userData.sentry = this;
    this.root.add(this.hitbox);
    this.headY = 0;
    this.gunZ = 0;
    loadModel("zk-turret", {}).then((m) => {
      if (this.dead) return;
      // the sentry's barrels run along Blender +Y, which glTF lands on -Z:
      // already facing the way the root does, so no half turn (that put the
      // barrels backwards while the rounds went forwards)
      this.root.add(m);
      this.head = m.getObjectByName("turret_head");
      this.gun = m.getObjectByName("turret_gun");
      this.barrels = m.getObjectByName("turret_barrels");
      this.muzzleNode = m.getObjectByName("turret_muzzle");
      this.gunZ = this.gun?.position.z ?? 0;
      this.headY = this.head?.position.y ?? 0;
    }).catch(() => {});
  }

  get alive() { return !this.dead && this.hp > 0 && this.age < this.duration; }
  get armed() { return this.age >= SENTRY_ARM; }
  hitMeshes() { return this.alive ? [this.hitbox] : []; }

  /* Everyone it would shoot. */
  candidates() {
    const ffa = !!game.currentMode().ffa;
    const owner = this.botId || this.ownerId;
    const out = [];
    for (const rp of game.remotes.byId.values()) {
      if (!rp.alive || rp.netId === owner || peerHas(rp.peer, "blindeye")) continue;   // Blind Eye
      if (!ffa && this.team && rp.team === this.team) continue;
      out.push({ id: rp.netId, rp, chest: new THREE.Vector3(rp.pos.x, rp.pos.y + CHEST, rp.pos.z) });
    }
    // Someone else's, or one of our bots' on the other side: we're a target.
    const mine = this.owned && !this.botId;
    if (!mine && game.player.alive && !hasPerk("blindeye") && (ffa || !this.team || this.team !== game.net.team)) {
      const p = game.move.pos;
      out.push({ id: null, rp: null, chest: new THREE.Vector3(p.x, p.y + CHEST, p.z) });
    }
    return out;
  }

  /* A clear line from its pivot (not the barrel tip, which swings round
     and can end up behind cover while the gun turns). */
  canSee(chest) {
    const d = chest.distanceTo(this.eye);
    if (d > SENTRY_RANGE) return false;
    _dir.copy(chest).sub(this.eye).divideScalar(d);
    return raycastWorld(game.colliders, this.eye, _dir, d) >= d - 0.4;
  }

  /* The nearest it can see, keeping the one it's on unless another is
     clearly closer (no flicking between two). */
  pick() {
    let best = null, bestD = Infinity, cur = null;
    for (const c of this.candidates()) {
      if (!this.canSee(c.chest)) continue;
      const d = c.chest.distanceTo(this.eye);
      if (this.target && c.id === this.target.id) cur = { c, d };
      if (d < bestD) { bestD = d; best = c; }
    }
    if (cur && cur.d - bestD < 4) return cur.c;
    return best;
  }

  /* One step. `deal(targetId, dmg)` applies a round (the caller's copy
     only; targetId null is the local player). "expire" when it's done. */
  update(dt, deal) {
    this.age += dt;
    // set down: up out of the ground, then the head comes round
    const u = Math.min(1, this.age / 0.8);
    this.root.scale.set(1, 0.6 + 0.4 * u * u * (3 - 2 * u), 1);
    if (this.muzzleNode) this.muzzleNode.getWorldPosition(this.muzzle);
    this.fireT = Math.max(0, this.fireT - dt);
    this.kick = Math.max(0, this.kick - dt * 9);
    this.flashT = Math.max(0, this.flashT - dt);
    this.flash.visible = this.flashT > 0;
    if (this.armed && this.alive) {
      this.retargetT -= dt;
      if (this.retargetT <= 0) {
        this.retargetT = RETARGET;
        const t = this.pick();
        if ((t ? t.id ?? "me" : "none") !== (this.target ? this.target.id ?? "me" : "none")) this.onT = 0;
        this.target = t;
      } else if (this.target) {
        // follow them between picks
        const rp = this.target.rp;
        const q = rp ? rp.pos : game.move.pos;
        this.target.chest.set(q.x, q.y + CHEST, q.z);
        if (rp && !rp.alive) { this.target = null; this.retargetT = 0; }
      }
    } else this.target = null;
    if (this.target) {
      this.onT += dt;
      const p = this.target.chest;
      const want = Math.atan2(-(p.x - this.pos.x), -(p.z - this.pos.z)) - this.yaw;
      const d = Math.atan2(Math.sin(want - this.headYaw), Math.cos(want - this.headYaw));
      const step = SENTRY_TURN * dt;
      this.headYaw += Math.max(-step, Math.min(step, d));
      const pitch = Math.atan2(p.y - this.eye.y, Math.hypot(p.x - this.eye.x, p.z - this.eye.z));
      this.gunPitch += (pitch - this.gunPitch) * Math.min(1, dt * 10);
      if (this.head) this.head.rotation.y = this.headYaw;
      if (this.gun) this.gun.rotation.x = this.gunPitch;
      const off = this.barrelAxis(_to).angleTo(_p.copy(p).sub(this.muzzle).normalize());
      if (off < AIM_OK && this.onT >= SENTRY_REACT && this.fireT <= 0) {
        if (this.canSee(p)) this.fire(deal);
        else { this.target = null; this.retargetT = 0; }
      }
    } else if (this.armed) {
      this.headYaw += dt * 0.6;   // nothing in sight: a slow sweep
      this.gunPitch += (0 - this.gunPitch) * Math.min(1, dt * 3);
    } else {
      // the head coming up and round onto the sweep
      const k = Math.min(1, this.age / SENTRY_ARM);
      if (this.head) this.head.position.y = this.headY - (1 - k) * 0.18;
      this.headYaw = -(1 - k * k) * Math.PI;
    }
    if (this.head) {
      if (this.armed) this.head.position.y = this.headY;
      this.head.rotation.y = this.headYaw;
    }
    if (this.gun) {
      // barrels along -Z: a positive turn about X lifts them; recoil is +Z
      this.gun.rotation.x = this.gunPitch;
      this.gun.position.z = this.gunZ + this.kick * 0.05;
    }
    this.aimLaser();
    const firing = this.target && this.fireT > 0;
    this.spinV += ((firing ? BARREL_SPIN : 0) - this.spinV) * Math.min(1, dt * (firing ? 6 : 1.5));
    if (this.barrels) this.barrels.rotation.z += this.spinV * dt;
    if (this.dead || this.hp <= 0 || this.age >= this.duration) return "expire";
    return null;
  }

  fire(deal) {
    this.fireT = 1 / SENTRY_RATE;
    this.shots++;
    this.kick = 1;
    const p = _p.copy(this.target.chest);
    const spread = SENTRY_SPREAD;
    _dir.copy(p).sub(this.muzzle).normalize();
    _dir.x += (Math.random() - 0.5) * spread; _dir.y += (Math.random() - 0.5) * spread; _dir.z += (Math.random() - 0.5) * spread;
    _dir.normalize();
    if (this.owned && deal) deal(this.target.id, SENTRY_DAMAGE);
    game.bullets.spawn({ origin: this.muzzle.clone(), dir: _dir.clone(), def: FX_DEF, ownerId: "remote", cosmetic: true, range: this.muzzle.distanceTo(p) + 2 });
    if (!this.flash.parent) this.root.parent?.add(this.flash);
    this.flash.position.copy(this.muzzle).addScaledVector(_dir, 0.08);
    this.flash.scale.setScalar(0.32 + Math.random() * 0.18);
    this.flash.material.rotation = Math.random() * Math.PI;
    this.flashT = FLASH_TIME;
    this.flash.visible = true;
    game.spawnImpactBurst?.(this.muzzle, 0xffd166, 3);
    if (this.shots % 3 === 0) game.impactFx?.puff(this.muzzle, _dir, 0.7);
    if (this.shots % 2 === 0) game.audio.shot?.(FX_DEF, 0.32, this.muzzle);
  }

  /* Where the barrels actually point, read off the model: from the
     rotary cluster's hub out to the muzzle (user: never a laser one way and
     the gun the other). Before the model is in, from the aim angles. */
  barrelAxis(out) {
    if (this.barrels && this.muzzleNode) {
      this.root.updateMatrixWorld(true);
      // the tip as it is now (rounds and the laser leave from here)
      this.muzzleNode.getWorldPosition(this.muzzle);
      out.copy(this.muzzle);
      this.barrels.getWorldPosition(_back);
      out.sub(_back);
      if (out.lengthSq() > 1e-6) return out.normalize();
    }
    const yaw = this.yaw + this.headYaw, cp = Math.cos(this.gunPitch);
    return out.set(-Math.sin(yaw) * cp, Math.sin(this.gunPitch), -Math.cos(yaw) * cp);
  }

  /* The beam out of the muzzle along the barrels, stopped by the first
     wall or the target's chest; brighter when it's on someone. */
  aimLaser() {
    const { beam, dot } = this.laser;
    const on = this.armed && this.alive;
    beam.visible = dot.visible = on;
    if (!on) return;
    if (!beam.parent) this.root.parent?.add(beam, dot);
    this.barrelAxis(_dir);
    if (this.muzzleNode) this.muzzleNode.getWorldPosition(this.muzzle);
    let len = raycastWorld(game.colliders, this.muzzle, _dir, SENTRY_RANGE);
    if (this.target) len = Math.min(len, this.target.chest.distanceTo(this.muzzle));
    len = Math.max(0.05, Math.min(len, SENTRY_RANGE));
    beam.position.copy(this.muzzle);
    beam.lookAt(_to.copy(this.muzzle).add(_dir));
    beam.scale.set(1, 1, len);
    beam.material.color.setHex(this.target ? LASER_ON : LASER_IDLE);
    beam.material.opacity = this.target ? 0.85 : 0.45;
    dot.position.copy(this.muzzle).addScaledVector(_dir, len - 0.02);
    dot.scale.setScalar(this.target ? 0.16 : 0.1);
  }

  dispose() {
    this.dead = true;
    this.laser.beam.parent?.remove(this.laser.beam);
    this.laser.dot.parent?.remove(this.laser.dot);
    this.laser.beam.material.dispose();
    this.flash.parent?.remove(this.flash);
    this.root.parent?.remove(this.root);
  }
}

/* Room round a point at pivot height: the nearest wall in 12 directions. */
function roomAt(p) {
  const d = new THREE.Vector3();
  let min = Infinity;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    min = Math.min(min, raycastWorld(game.colliders, p, d.set(Math.sin(a), 0, Math.cos(a)), CLEAR));
  }
  return min;
}

/* Where it goes down: 1-2.2 m out with CLEAR all round so the barrels can
   turn without poking through anything. Ahead first, then to the sides,
   then behind; failing all of those, ahead nudged off the walls. */
export function sentryDeployPoint(from, yaw) {
  const eye = new THREE.Vector3(from.x, from.y + PIVOT, from.z);
  const dir = new THREE.Vector3();
  for (const turn of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.3, -2.3, Math.PI]) {
    const a = yaw + turn;
    dir.set(-Math.sin(a), 0, -Math.cos(a));
    const out = Math.min(2.2, raycastWorld(game.colliders, eye, dir, 2.2 + CLEAR) - CLEAR);
    if (out < 1) continue;
    const p = eye.clone().addScaledVector(dir, out);
    const y = groundHeightAt(game.colliders, p.x, p.z, from.y + 1.5);
    if (y == null || Math.abs(y - from.y) > 0.6) continue;
    p.y = y + PIVOT;
    if (roomAt(p) >= CLEAR - 0.02) return { x: p.x, y, z: p.z, yaw: a };
  }
  const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const ahead = Math.max(0, Math.min(2.2, raycastWorld(game.colliders, eye, fwd, 2.2 + CLEAR) - CLEAR));
  const p = new THREE.Vector3(from.x + fwd.x * ahead, from.y + PIVOT, from.z + fwd.z * ahead);
  const d = new THREE.Vector3();
  for (let pass = 0; pass < 3; pass++) {
    const push = new THREE.Vector3();
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      d.set(Math.sin(a), 0, Math.cos(a));
      const hit = raycastWorld(game.colliders, p, d, CLEAR);
      if (hit < CLEAR) push.addScaledVector(d, -(CLEAR - hit));
    }
    if (push.lengthSq() < 1e-6) break;
    if (push.length() > 0.6) push.setLength(0.6);
    // never pushed through something: only as far as it's open that way
    const n = push.clone().normalize();
    const room = raycastWorld(game.colliders, p, n, push.length() + 0.05);
    p.addScaledVector(n, Math.max(0, Math.min(push.length(), room - 0.05)));
  }
  const y = groundHeightAt(game.colliders, p.x, p.z, from.y + 1.5) ?? from.y;
  return { x: p.x, y, z: p.z, yaw };
}

export function spawnSentry({ id, owned, team, x, y, z, yaw, botId = null, ownerId = null }) {
  const e = new SentryGun({ id, owned, team, x, y, z, yaw, botId, ownerId });
  streakEntities.set(id, e);
  game.scene.add(e.root);
  game.audio.land?.(6);
  return e;
}
