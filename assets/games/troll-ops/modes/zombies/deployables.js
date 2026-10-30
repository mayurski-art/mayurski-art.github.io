// Troll Forces Zombies: deployables, Zombie Rush's Rookie kit. Pick one from
// the Deployables column and a see-through copy (the ghost) follows where
// you're looking, green where it fits and red where it doesn't; held, the
// column snaps it to a 1 m grid and square to the world ("Hold for grid
// mode"). Put it down and it costs the run's cash; each one you put down
// makes the next of that kind dearer (kits.js priceOf).
//
//   Auto Turret   turns to the nearest zombie in sight and fires on it
//   Barricade     a spiked wall: blocks the way, and spikes whatever leans on it
//   Barrel        goes up when the horde breaks it, and sets off its neighbours
//
// They stand in the world as colliders (the player and zombies walk into
// them; bullets pass, pen 0) and as the director's `blockers`: a zombie
// with one in its way swings at it (zombies.js Zombie._blockerAhead), and
// each swing lands here (hitBlocker). The zombies' flow fields leave them
// out, so the horde goes through a barricade, not round it.
//
// Co-op (coop.js): everyone's deployables stand on every screen, each with
// its owner (`mine` for ours: only those count toward our caps). The host
// runs them for real; everywhere else they're for show (dep.cosmetic): a
// turret still turns and fires tracers, but the host says what it hit and
// when anything breaks. A kill by your turret, spikes or barrel pays you,
// wherever it was decided.

import * as THREE from "three";
import { game } from "../../core/state.js?v=st1";
import { DEPLOYABLES, KITS, DEFAULT_KIT, statsAt, priceOf } from "./kits.js?v=zr6-zr9-zr10";
import { canAfford, spend } from "./economy.js?v=zr5-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416";
import { kitLevels } from "./credits.js?v=zc1-zc2";
import { raycastWorld } from "../../weapons/ballistics.js?v=cg1-wst-hf1-fu1b7-wb1-ar1-ar2-cl1-fj1-zr10-zc1-zc2-or1-gf1-tg1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416";
import { groundHeightAt } from "../../core/movement.js?v=umb2-sb2-gj1b7-or1-gf1-tg1-rfx1";
import { loadModel } from "../../maps/battlefield-props.js?v=sr1-or1-tx1-sp1-kbt1-gb1-pm1-kbk2-tfp7-tfb8-ss1-ss2-ss3-tfm2-ugb1-ug1-ugm1-hgb6";
import { areaDamage, explosionFx } from "../../combat/throwables.js?v=th1-kc2-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-dom1-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1";
import { WEAPON_DEFS } from "../../weapons/weapons.js?v=p5bm-wst-hf1-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-or1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416";

const MODEL = { turret: "zk-turret", barricade: "zk-spikewall", barrel: "zk-barrel" };
const PLACE_DIST = 2.4;       // metres in front of you, past the item's own half-depth
const PLACE_REACH_Y = 1.2;    // no putting one on a ledge above or below you
const GRID = 1;               // metres, in grid mode
const SPIKE_TICK = 0.25;      // seconds between spike bites
const RETARGET = 0.25;        // seconds between a turret's target checks
const AIM_OK = 0.12;          // radians off target a turret will still fire at
/* Put down (P7): it unfolds up out of the ground with a little overshoot;
   a turret's head comes up and spins round onto the sweep before it may fire. */
export const DEPLOY_TIME = 0.5;
const TURRET_ARM = 0.35;      // the turret's head after the body is up
function unfold(k) {          // 0..1 -> height scale, overshooting to 1.08
  if (k >= 1) return 1;
  const e = 1 - Math.pow(1 - k, 3);
  return e + Math.sin(k * Math.PI) * 0.08;
}
const TURRET_FX_DEF = WEAPON_DEFS.mtar || WEAPON_DEFS.problem416;

/* The run's deployables. `placed` counts what's been put down (prices
   climb with it); `list` is what's standing. */
export const dep = {
  kit: DEFAULT_KIT,
  levels: {},      // deployable id -> kit level, from Credits (credits.js)
  placed: {},
  list: [],
  placing: null,   // { id, grid, ghost, spot, ok } while picking a spot
  cosmetic: false, // co-op, not the host: the host decides what they do
  blastBy: null,   // whose barrel is going off (run.js zombieHit credits them)
};

/* Co-op (coop.js): `add(e)` we put one down, `hp(e)` / `gone(e)` the
   host's word on one getting hit or broken. */
export const depWire = { add: null, hp: null, gone: null };
let didc = 0;

const _v = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _ray = new THREE.Raycaster();

/* --------------------------------------------------------------- models */

/* A clone of the kit model, or a plain stand-in box if it won't load. */
function buildModel(id, stats) {
  const root = new THREE.Group();
  loadModel(MODEL[id], {}).then((obj) => {
    // the kit faces Blender +Y, which lands on +Z here: turn it to face -Z,
    // the way the root is yawed (the gun downrange, the stakes at the horde)
    obj.rotation.y = Math.PI;
    root.add(obj);
    root.userData.model = obj;
    root.userData.onModel?.(obj);
  }).catch(() => {
    const { w, d, h } = stats.size;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: id === "barrel" ? 0xc4231b : id === "turret" ? 0x8a9099 : 0x7a4a26 }));
    m.position.y = h / 2;
    root.add(m);
    root.userData.model = m;
    root.userData.onModel?.(m);
  });
  return root;
}

const GHOST_OK = new THREE.MeshBasicMaterial({ color: 0x3dff6a, transparent: true, opacity: 0.42, depthWrite: false });
const GHOST_BAD = new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.42, depthWrite: false });

function paintGhost(root, ok) {
  const mat = ok ? GHOST_OK : GHOST_BAD;
  root.traverse((n) => { if (n.isMesh) { n.material = mat; n.castShadow = false; n.renderOrder = 5; } });
}

/* --------------------------------------------------------------- the kit */

const levelOf = (id) => dep.levels[id] || 1;

export const kitOf = () => KITS[dep.kit] || KITS[DEFAULT_KIT];

export function resetDeployables() {
  clearDeployables();
  dep.placed = {};
  dep.levels = kitLevels();
}

/* Everything off the map (the run ended). */
export function clearDeployables() {
  cancelPlacing();
  for (const e of dep.list.slice()) e.remove();
  dep.list.length = 0;
  if (game.zdir) game.zdir.blockers.length = 0;
}

const standing = (id) => dep.list.filter((e) => e.id === id && e.alive && e.mine).length;

/* The column's cards: what each costs next and whether you can have one. */
export function deployOffers() {
  return kitOf().deployables.map((id) => {
    const d = DEPLOYABLES[id];
    const price = priceOf(id, dep.placed[id] || 0);
    const count = standing(id);
    return {
      id, name: d.name, short: d.short || d.name, price, count, max: d.max,
      can: canAfford(price) && count < d.max,
      placing: dep.placing?.id === id,
    };
  });
}

/* --------------------------------------------------------------- placing */

/* The column: pick `id` (grid = it was held). Picking the one you're
   already placing puts it down (a second tap on touch). */
export function pickDeployable(id, grid = false) {
  if (dep.placing?.id === id && !grid) return placeDeployable();
  const d = DEPLOYABLES[id];
  if (!d) return false;
  const price = priceOf(id, dep.placed[id] || 0);
  if (!canAfford(price) || standing(id) >= d.max) return false;
  cancelPlacing();
  const stats = statsAt(id, levelOf(id));
  const ghost = buildModel(id, stats);
  ghost.userData.onModel = () => paintGhost(ghost, dep.placing?.ok ?? true);
  game.scene.add(ghost);
  dep.placing = { id, grid, ghost, stats, spot: null, ok: false };
  updatePlacing();
  return true;
}

export function cancelPlacing() {
  if (!dep.placing) return;
  game.scene.remove(dep.placing.ghost);
  dep.placing = null;
}

/* Put the ghost down for real, if it fits and you can pay. */
export function placeDeployable() {
  const pl = dep.placing;
  if (!pl) return false;
  updatePlacing();
  const price = priceOf(pl.id, dep.placed[pl.id] || 0);
  if (!pl.ok || standing(pl.id) >= DEPLOYABLES[pl.id].max || !spend(price)) {
    game.audio.zombieBuy(false);
    return false;
  }
  const { x, y, z, yaw } = pl.spot;
  const e = spawnDeployable(pl.id, x, y, z, yaw);
  dep.placed[pl.id] = (dep.placed[pl.id] || 0) + 1;
  cancelPlacing();
  depWire.add?.(e);
  game.audio.deployPlace(e.pos);
  return true;
}

/* The deployable's footprint at a spot, as axis-aligned boxes (a turned
   barricade is a row of short segments, so its boxes hug it). */
function footprint(stats, x, y, z, yaw) {
  const { w, d, h } = stats.size;
  const cos = Math.cos(yaw), sin = Math.sin(yaw);
  if (stats.kind !== "barricade") {
    const hw = (Math.abs(w * cos) + Math.abs(d * sin)) / 2;
    const hd = (Math.abs(w * sin) + Math.abs(d * cos)) / 2;
    return [{ cx: x, cz: z, hw, hd, y, h }];
  }
  const n = Math.max(1, Math.round(w / d));
  const seg = w / n;
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = -w / 2 + seg * (i + 0.5);
    // the wall runs along its local X; three.js yaw turns X to (cos, -sin)
    out.push({ cx: x + cos * t, cz: z - sin * t, hw: (Math.abs(seg * cos) + Math.abs(d * sin)) / 2, hd: (Math.abs(seg * sin) + Math.abs(d * cos)) / 2, y, h });
  }
  return out;
}

/* Where the ghost goes this frame, and whether it fits there. */
export function updatePlacing() {
  const pl = dep.placing;
  if (!pl) return;
  const feet = game.move.pos.y;   // the movement controller keeps the feet
  const yawLook = game.look.yaw;
  _dir.set(-Math.sin(yawLook), 0, -Math.cos(yawLook));
  const want = PLACE_DIST + pl.stats.size.d / 2;
  _v.set(game.move.pos.x, feet + 0.6, game.move.pos.z);
  const wall = raycastWorld(game.colliders, _v, _dir, want + 0.6);
  const reach = Math.max(0.9, Math.min(want, wall - 0.5 - pl.stats.size.d / 2));
  let x = _v.x + _dir.x * reach;
  let z = _v.z + _dir.z * reach;
  // square to whichever way you're facing, so a barricade runs across your view
  let yaw = yawLook;
  if (pl.grid) {
    x = Math.round(x / GRID) * GRID;
    z = Math.round(z / GRID) * GRID;
    yaw = Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2);
  }
  const y = groundHeightAt(game.colliders, x, z, feet + 0.6, 0.3);
  pl.spot = { x, y, z, yaw };
  pl.ok = fits(pl.stats, x, y, z, yaw, feet);
  pl.ghost.position.set(x, y, z);
  pl.ghost.rotation.y = yaw;
  if (pl.ghost.userData.ok !== pl.ok) {
    pl.ghost.userData.ok = pl.ok;
    paintGhost(pl.ghost, pl.ok);
  }
}

function fits(stats, x, y, z, yaw, feet) {
  if (Math.abs(y - feet) > PLACE_REACH_Y) return false;
  const a = game.ARENA;
  for (const f of footprint(stats, x, y, z, yaw)) {
    if (f.cx - f.hw < a.minX || f.cx + f.hw > a.maxX || f.cz - f.hd < a.minZ || f.cz + f.hd > a.maxZ) return false;
    for (const c of game.colliders) {
      if (c.max.y <= y + 0.12 || c.min.y >= y + f.h) continue;   // the floor it stands on, or overhead
      if (c.max.x <= f.cx - f.hw || c.min.x >= f.cx + f.hw) continue;
      if (c.max.z <= f.cz - f.hd || c.min.z >= f.cz + f.hd) continue;
      return false;
    }
    // not on top of yourself
    const px = Math.max(f.cx - f.hw, Math.min(game.move.pos.x, f.cx + f.hw));
    const pz = Math.max(f.cz - f.hd, Math.min(game.move.pos.z, f.cz + f.hd));
    if (Math.hypot(px - game.move.pos.x, pz - game.move.pos.z) < 0.45) return false;
  }
  return true;
}

/* --------------------------------------------------------------- entities */

class Deployable {
  constructor(id, x, y, z, yaw, level, { did = null, owner = null } = {}) {
    this.id = id;
    this.owner = owner;        // co-op: whose it is (null = ours)
    this.mine = !owner;
    this.did = did || `${game.net?.id || "me"}.${++didc}`;
    this.stats = statsAt(id, level);
    this.level = level;
    this.kind = this.stats.kind;
    this.maxHp = Math.round(this.stats.hp);
    this.hp = this.maxHp;
    this.alive = true;
    this.pos = new THREE.Vector3(x, y, z);
    this.yaw = yaw;
    this.hurtT = 0;            // seconds since it was last hit (its bar shows a while)
    this.deployT = 0;          // seconds since it was put down (the unfold)
    this.root = buildModel(id, this.stats);
    this.root.position.copy(this.pos);
    this.root.rotation.y = yaw;
    this.root.scale.set(0.85, 0.05, 0.85);
    this.root.userData.onModel = (m) => this.onModel(m);
    game.scene.add(this.root);
    // colliders and blockers: one per footprint box
    this.boxes = footprint(this.stats, x, y, z, yaw).map((f) => ({
      min: new THREE.Vector3(f.cx - f.hw, y, f.cz - f.hd),
      max: new THREE.Vector3(f.cx + f.hw, y + f.h, f.cz + f.hd),
      pen: 0, deploy: true,
    }));
    for (const b of this.boxes) game.colliders.push(b);
    this.blockers = this.boxes.map((box) => ({
      box, owner: this,
      pos: new THREE.Vector3((box.min.x + box.max.x) / 2, y, (box.min.z + box.max.z) / 2),
      get alive() { return this.owner.alive; },
    }));
    game.zdir?.blockers.push(...this.blockers);
  }

  onModel() {}

  /* Where its health bar sits. */
  get top() { return this.pos.y + this.stats.size.h + 0.25; }

  hit(dmg) {
    if (!this.alive || dep.cosmetic) return;
    this.hp -= dmg;
    this.hurtT = 0;
    if (this.hp <= 0) this.destroy();
    else depWire.hp?.(this);
  }

  /* Co-op: the host's word on its health. */
  setHp(hp) {
    if (!this.alive || hp >= this.hp) return;
    this.hp = hp;
    this.hurtT = 0;
  }

  destroy() {
    if (!this.alive) return;
    if (!dep.cosmetic) depWire.gone?.(this);
    this.alive = false;
    game.spawnImpactBurst(_v.copy(this.pos).setY(this.pos.y + this.stats.size.h * 0.5), this.kind === "barricade" ? 0x8a5a33 : 0x9aa0a8, 18);
    game.audio.deployBreak(this.pos);
    this.remove();
  }

  /* Off the map: model, colliders, blockers. */
  remove() {
    this.alive = false;
    game.scene.remove(this.root);
    if (this.flash) game.scene.remove(this.flash);
    for (const b of this.boxes) {
      const i = game.colliders.indexOf(b);
      if (i >= 0) game.colliders.splice(i, 1);
    }
    const bl = game.zdir?.blockers;
    if (bl) for (const b of this.blockers) { const i = bl.indexOf(b); if (i >= 0) bl.splice(i, 1); }
    const i = dep.list.indexOf(this);
    if (i >= 0) dep.list.splice(i, 1);
  }

  update(dt) {
    this.hurtT += dt;
    if (this.deployT < DEPLOY_TIME) {
      this.deployT = Math.min(DEPLOY_TIME, this.deployT + dt);
      const k = this.deployT / DEPLOY_TIME;
      const xz = 0.85 + 0.15 * Math.min(1, k * 1.6);
      this.root.scale.set(xz, Math.max(0.05, unfold(k)), xz);
    }
  }

  /* Still unfolding (a turret: still arming). */
  get deploying() { return this.deployT < DEPLOY_TIME; }
}

/* A zombie the kit hurt: blood, a flinch, and on a kill the cash and the
   count, same as a bullet of yours (no hitmarker: you didn't fire it). */
function hurtZombie(z, dmg, point, dir, by = null) {
  if (!z.alive || z.dying) return;
  const res = z.takeDamage(dmg, false);
  game.impactFx.hit(point, { normal: _v.copy(dir).negate(), dir, surface: z.body ? "blood" : "zombie", scale: 0.7 });
  z.flinchFrom?.(dir, 0.2);
  if (res.killed) {
    game.zombieHit(z, res, point, by);
    if (by) return;   // someone else's: the kill is theirs (coop.js pays them)
    game.zdir.kills++;
    game.player.kills++;
  }
}

/* The map's own walls, for a turret's line of sight (deployables don't block it). */
let mapWalls = null;
let mapWallsLen = -1;
function walls() {
  if (!mapWalls || mapWallsLen !== game.colliders.length) {
    mapWalls = game.colliders.filter((c) => !c.deploy);
    mapWallsLen = game.colliders.length;
  }
  return mapWalls;
}

/* A turret's muzzle flash (P7): one soft, additive star at the barrels, a
   frame or two per shot, on a texture made once. */
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
  // four spikes, so it reads as a flash and not a glow
  g.globalCompositeOperation = "lighter";
  g.fillStyle = "rgba(255,220,140,0.8)";
  g.fillRect(30, 2, 4, 60);
  g.fillRect(2, 30, 60, 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  flashMat = new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  return flashMat;
}
const FLASH_TIME = 0.045;

class Turret extends Deployable {
  constructor(...a) {
    super(...a);
    this.flash = new THREE.Sprite(muzzleFlashMat());
    this.flash.visible = false;
    this.flashT = 0;
    this.shots = 0;
    game.scene.add(this.flash);
    this.target = null;
    this.retargetT = 0;
    this.fireT = 0;
    this.headYaw = 0;          // relative to the base
    this.gunPitch = 0;
    this.kick = 0;
    this.armT = 0;             // the head coming up after the unfold
    this.headY = 0;
    this.muzzle = new THREE.Vector3(this.pos.x, this.pos.y + 0.9, this.pos.z);
  }

  get armed() { return this.armT >= TURRET_ARM; }

  onModel(m) {
    this.head = m.getObjectByName("turret_head");
    this.gun = m.getObjectByName("turret_gun");
    this.muzzleNode = m.getObjectByName("turret_muzzle");
    this.gunZ = this.gun?.position.z ?? 0;
    this.headY = this.head?.position.y ?? 0;
  }

  aimPoint(z) {
    return _v.set(z.mesh.position.x, z.groundY + z.type.height * 0.62, z.mesh.position.z);
  }

  canSee(z) {
    if (!z.alive || z.dying || z.riseT > 0) return false;
    const p = this.aimPoint(z);
    const dist = p.distanceTo(this.muzzle);
    if (dist > this.stats.range) return false;
    _dir.copy(p).sub(this.muzzle).normalize();
    return raycastWorld(walls(), this.muzzle, _dir, dist) >= dist - 0.3;
  }

  pick() {
    let best = null, bestD = Infinity;
    for (const z of game.zdir?.zombies || []) {
      const d = Math.hypot(z.mesh.position.x - this.pos.x, z.mesh.position.z - this.pos.z);
      if (d < bestD && d <= this.stats.range && this.canSee(z)) { best = z; bestD = d; }
    }
    return best;
  }

  update(dt) {
    super.update(dt);
    if (this.armT < TURRET_ARM) {
      // up out of the base and a spin onto the sweep; nothing fired yet
      if (!this.deploying) this.armT = Math.min(TURRET_ARM, this.armT + dt);
      const k = this.armT / TURRET_ARM;
      if (this.head) {
        this.head.position.y = this.headY - (1 - k) * 0.18;
        this.head.rotation.y = this.headYaw - (1 - k * k) * Math.PI;
      }
      if (this.gun) this.gun.rotation.x = (1 - k) * 0.5;
      return;
    }
    if (this.muzzleNode) this.muzzleNode.getWorldPosition(this.muzzle);
    this.retargetT -= dt;
    if (this.retargetT <= 0 || (this.target && (!this.target.alive || this.target.dying))) {
      this.retargetT = RETARGET;
      if (!this.target || !this.canSee(this.target)) this.target = this.pick();
    }
    this.fireT = Math.max(0, this.fireT - dt);
    this.kick = Math.max(0, this.kick - dt * 9);
    this.flashT = Math.max(0, this.flashT - dt);
    this.flash.visible = this.flashT > 0;
    let off = Math.PI;
    if (this.target) {
      const p = this.aimPoint(this.target);
      const want = Math.atan2(-(p.x - this.pos.x), -(p.z - this.pos.z)) - this.yaw;
      let d = Math.atan2(Math.sin(want - this.headYaw), Math.cos(want - this.headYaw));
      const step = this.stats.turn * dt;
      this.headYaw += Math.max(-step, Math.min(step, d));
      const flat = Math.hypot(p.x - this.muzzle.x, p.z - this.muzzle.z);
      const pitch = Math.atan2(p.y - this.muzzle.y, flat);
      this.gunPitch += (pitch - this.gunPitch) * Math.min(1, dt * 10);
      off = Math.abs(Math.atan2(Math.sin(want - this.headYaw), Math.cos(want - this.headYaw)));
      if (off < AIM_OK && this.fireT <= 0) this.fire();
    } else {
      // nothing in sight: a slow sweep
      this.headYaw += dt * 0.6;
      this.gunPitch += (0 - this.gunPitch) * Math.min(1, dt * 3);
    }
    if (this.head) this.head.rotation.y = this.headYaw;
    if (this.gun) {
      // the model is turned half round (buildModel): its barrels run along +Z
      this.gun.rotation.x = -this.gunPitch;
      this.gun.position.z = this.gunZ - this.kick * 0.05;   // recoil back along the barrels
    }
  }

  fire() {
    const z = this.target;
    this.fireT = 1 / this.stats.fireRate;
    this.kick = 1;
    const p = this.aimPoint(z).clone();
    const dir = p.clone().sub(this.muzzle).normalize();
    // the body under the aim point, for where the blood goes
    _ray.set(this.muzzle, dir);
    _ray.far = this.stats.range + 1;
    const hit = _ray.intersectObjects(z.hitboxMeshes, true)[0];
    const point = hit ? hit.point : p;
    if (!dep.cosmetic) hurtZombie(z, this.stats.damage, point, dir, this.owner);
    // a teammate's screen: the host says what it hit, but the blood is here too
    else game.impactFx.hit(point, { normal: _v.copy(dir).negate(), dir, surface: z.body ? "blood" : "zombie", scale: 0.7 });
    game.bullets.spawn({ origin: this.muzzle.clone(), dir, def: TURRET_FX_DEF, ownerId: "remote", cosmetic: true, range: this.muzzle.distanceTo(point) });
    // the flash at the barrels, a few sparks, and smoke every third round
    this.flash.position.copy(this.muzzle).addScaledVector(dir, 0.08);
    this.flash.scale.setScalar(0.32 + Math.random() * 0.18);
    this.flash.material.rotation = Math.random() * Math.PI;
    this.flashT = FLASH_TIME;
    this.flash.visible = true;
    game.spawnImpactBurst(this.muzzle, 0xffd166, 3);
    if (++this.shots % 3 === 0) game.impactFx.puff(this.muzzle, dir, 0.7);
    game.audio.shot(TURRET_FX_DEF, 0.32, this.muzzle);
  }
}

class Barricade extends Deployable {
  constructor(...a) {
    super(...a);
    this.spikeT = 0;
  }

  update(dt) {
    super.update(dt);
    if (dep.cosmetic) return;
    this.spikeT -= dt;
    if (this.spikeT > 0) return;
    this.spikeT = SPIKE_TICK;
    const bite = this.stats.spikeDps * SPIKE_TICK;
    for (const z of game.zdir?.zombies || []) {
      if (!z.alive || z.dying) continue;
      const p = z.mesh.position;
      const reach = z.radius + 0.35;   // pressed up to it (zombies.js BLOCKER_REACH)
      for (const b of this.boxes) {
        if (p.x < b.min.x - reach || p.x > b.max.x + reach || p.z < b.min.z - reach || p.z > b.max.z + reach) continue;
        if (z.groundY > b.max.y || z.groundY + 1 < b.min.y) continue;
        _dir.set(p.x - this.pos.x, 0, p.z - this.pos.z).normalize();
        hurtZombie(z, bite, new THREE.Vector3(p.x, z.groundY + 0.9, p.z), _dir.clone(), this.owner);
        break;
      }
    }
  }
}

class Barrel extends Deployable {
  constructor(...a) {
    super(...a);
    this.fuseT = -1;           // counting down once a neighbour's blast catches it
  }

  update(dt) {
    super.update(dt);
    if (this.fuseT >= 0 && !dep.cosmetic) {
      this.fuseT -= dt;
      if (this.fuseT < 0) this.destroy();
    }
  }

  destroy() {
    if (!this.alive) return;
    if (!dep.cosmetic) depWire.gone?.(this);
    this.alive = false;
    const s = this.stats;
    const c = new THREE.Vector3(this.pos.x, this.pos.y + 0.6, this.pos.z);
    const def = { id: "zbarrel", name: "Explosive Barrel", kind: "lethal", glow: 0xff7a2a, radius: s.radius, damage: s.damage, minDamage: s.minDamage, selfMult: 0 };
    this.remove();
    explosionFx(def, c);
    if (dep.cosmetic) return;   // the blast and the chain are the host's
    dep.blastBy = this.owner;
    try { areaDamage(c, s.radius, s.damage, def, { creditAs: "barrel" }); } finally { dep.blastBy = null; }
    // the barrels it reaches go up after it, one after another
    for (const e of dep.list) {
      if (e instanceof Barrel && e.alive && e.fuseT < 0 && e.pos.distanceTo(this.pos) <= s.radius) e.fuseT = s.chainDelay;
    }
  }
}

const CLASSES = { turret: Turret, barricade: Barricade, barrel: Barrel };

/* `opts` (co-op): { level, did, owner } for someone else's. */
export function spawnDeployable(id, x, y, z, yaw, opts = {}) {
  const e = new CLASSES[DEPLOYABLES[id].kind](id, x, y, z, yaw, opts.level || levelOf(id), opts);
  dep.list.push(e);
  return e;
}

/* A zombie's swing landed on a deployable (run.js onZombieAttack). */
export function hitBlocker(blocker, dmg) {
  blocker.owner?.hit(dmg);
}

/* A click while placing: left puts it down, right lets it go. True = the
   click was ours (input/keyboard-mouse.js asks before it fires). */
export function deployClick(button) {
  if (!dep.placing) return false;
  if (button === 0) placeDeployable();
  else if (button === 2) cancelPlacing();
  return true;
}

export function updateDeployables(dt) {
  if (dep.placing) {
    if (game.player.downed || !game.player.alive) cancelPlacing();
    else updatePlacing();
  }
  for (const e of dep.list.slice()) if (e.alive) e.update(dt);
}
