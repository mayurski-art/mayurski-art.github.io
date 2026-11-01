// Troll Forces — Sentry Gun (Black Ops 2 scorestreak).
//
// BO2's Sentry Gun: set it down and it guards the spot by itself, turning
// onto any enemy it can see and cutting them down with its six-barrel
// rotary gun. Blind Eye hides you from it; enemies can shoot it apart. It
// is the same BO2-style sentry the zombies kit puts down (zk-turret.glb,
// built by models/build_zkit.blender.py), at BO2 size. This file is the
// model, the aim and the shooting; air.js steps it every frame and only
// the caller's copy deals the damage, like the Gunship.

import * as THREE from "three";
import { game } from "../core/state.js?v=st1";
import { streakEntities } from "./calling.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-fs1-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ls4-gb4-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2-hb4-lu1-mb1-mb2-gc1-bt1-nft33-nfh1-nfh5-mg2-nft2531-nft2531h";
import { loadModel } from "../maps/battlefield-props.js?v=sr1-or1-tx1-sp1-kbt1-gb1-pm1-kbk2-tfp7-tfb8-ss1-ss2-ss3-tfm2-ugb1-ug1-ugm1-hgb6";
import { raycastWorld } from "../weapons/ballistics.js?v=cg1-wst-hf1-fu1b7-wb1-ar1-ar2-cl1-fj1-zr10-zc1-zc2-or1-gf1-tg1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416-mt2-hb4";
import { hasPerk, peerHas } from "../progression/perks.js?v=pk1-cl1-bp1-fj1-zc1-zc2-nf1-or1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416-mt2-hb4-gc1";
import { WEAPON_DEFS } from "../weapons/weapons.js?v=p5bm-wst-hf1-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-or1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416-mt2-hb4";

export const SENTRY_DURATION = 90;     // seconds on the ground
export const SENTRY_HP = 500;          // bullet damage it takes to kill it
export const SENTRY_RANGE = 45;        // metres it will engage at
export const SENTRY_TURN = 2.6;        // rad/s it slews
export const SENTRY_RATE = 9;          // rounds a second
export const SENTRY_DAMAGE = 12;       // a round; about a second on target kills
export const SENTRY_REACT = 0.45;      // seconds on a new target before the first round
const SENTRY_ARM = 1.2;                // unfolding, then the head swings onto the sweep
const AIM_OK = 0.1;                    // radians off it will still fire at
const RETARGET = 0.3;
const BARREL_SPIN = 28;                // rad/s, the rotary cluster at full spin
const FLASH_TIME = 0.045;
const CHEST = 1.1;                     // feet to chest
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

const _dir = new THREE.Vector3(), _p = new THREE.Vector3();

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
    this.muzzle = new THREE.Vector3(x, y + 0.95, z);
    this.flash = new THREE.Sprite(muzzleFlashMat());
    this.flash.visible = false;
    this.flashT = 0;
    this.hitbox = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.3, 1.0), new THREE.MeshBasicMaterial({ visible: false }));
    this.hitbox.position.y = 0.65;
    this.hitbox.userData.sentry = this;
    this.root.add(this.hitbox);
    this.headY = 0;
    this.gunZ = 0;
    loadModel("zk-turret", {}).then((m) => {
      if (this.dead) return;
      // the kit faces Blender +Y, which lands on +Z: turn it to face -Z
      m.rotation.y = Math.PI;
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

  canSee(chest) {
    const d = chest.distanceTo(this.muzzle);
    if (d > SENTRY_RANGE) return false;
    _dir.copy(chest).sub(this.muzzle).divideScalar(d);
    return raycastWorld(game.colliders, this.muzzle, _dir, d) >= d - 0.4;
  }

  /* The nearest it can see, keeping the one it's on unless another is
     clearly closer (no flicking between two). */
  pick() {
    let best = null, bestD = Infinity, cur = null;
    for (const c of this.candidates()) {
      if (!this.canSee(c.chest)) continue;
      const d = c.chest.distanceTo(this.muzzle);
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
      const pitch = Math.atan2(p.y - this.muzzle.y, Math.hypot(p.x - this.muzzle.x, p.z - this.muzzle.z));
      this.gunPitch += (pitch - this.gunPitch) * Math.min(1, dt * 10);
      const off = Math.abs(Math.atan2(Math.sin(want - this.headYaw), Math.cos(want - this.headYaw)));
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
      // the model is turned half round: its barrels run along +Z
      this.gun.rotation.x = -this.gunPitch;
      this.gun.position.z = this.gunZ - this.kick * 0.05;
    }
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
    // a little spread, so a few go wide at range
    const spread = 0.012 + p.distanceTo(this.muzzle) * 0.0006;
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

  dispose() {
    this.dead = true;
    this.flash.parent?.remove(this.flash);
    this.root.parent?.remove(this.root);
  }
}

export function spawnSentry({ id, owned, team, x, y, z, yaw, botId = null, ownerId = null }) {
  const e = new SentryGun({ id, owned, team, x, y, z, yaw, botId, ownerId });
  streakEntities.set(id, e);
  game.scene.add(e.root);
  game.audio.land?.(6);
  return e;
}
