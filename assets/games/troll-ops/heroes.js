// Troll Forces — U Mad Bro? heroes (design doc "Troll Forces: U Mad Bro?
// mode", phase 2). Four heroes, each with health and speed multipliers, a
// passive, a signature melee and one ability on E. game.js owns the world
// (who is hostile, how damage lands, the dog); this module owns the rules
// and asks for those through `ctx`.
//
// The melee ids are stand-ins from gear.js until phase 3 brings the real
// bodies and weapons (keyboard greatsword, spear, fists, claws).

import * as THREE from "three";

export const HEROES = {
  knight: {
    id: "knight", name: "Troll Knight", hp: 150, speed: 0.9, melee: "keyboard", meleeMult: 1.3, cd: 12,
    ability: "Rage Quit Charge", passive: "Plate: 25% less damage from the front",
    blurb: "Tanky. E charges 8 m and flings anyone in the way.",
  },
  hunter: {
    id: "hunter", name: "Troll Hunter", hp: 100, speed: 1.1, melee: "reaper", meleeMult: 1, cd: 15,
    ability: "Sic 'Em", passive: "Sees enemy footprints for 3 s",
    blurb: "Fast tracker. E sends the Doge to pin the nearest enemy for 2 s.",
  },
  super: {
    id: "super", name: "Super Troll", hp: 120, speed: 1.0, melee: "trollsaber", meleeMult: 1, cd: 14,
    ability: "Superhero Landing", passive: "Double jump, hold jump to glide",
    blurb: "Never on the ground for long. E: up, then slam down. POW.",
  },
  metamorph: {
    id: "metamorph", name: "Troll Metamorphosis", hp: 80, speed: 1.2, melee: "halo", meleeMult: 1, cd: 0,
    ability: "Transform", passive: "Damage and kills fill the meter",
    blurb: "Weak and fast as Pepe. Fill the meter, press E, become the brute for 20 s.",
  },
};
export const HERO_IDS = Object.keys(HEROES);

// The Metamorph's brute form.
const BRUTE = { hp: 200, speed: 0.85, meleeMult: 2, time: 20 };
const METER_MAX = 100;
const METER_PER_DMG = 0.5;
const METER_PER_KILL = 30;

// Knight's charge: ~8 m in 0.36 s; anyone within reach takes a hit and flies.
const CHARGE_SPEED = 22, CHARGE_TIME = 0.36, CHARGE_REACH = 1.9, CHARGE_DMG = 35;
// Super Troll's slam.
const SLAM_UP = 15, SLAM_DOWN = 26, SLAM_RADIUS = 6, SLAM_DMG = 60;
const PIN_TIME = 2;

const STORE = "trollops:hero";
export function savedHero() {
  try { const id = localStorage.getItem(STORE); if (HEROES[id]) return id; } catch { /* storage off */ }
  return "knight";
}
export function saveHero(id) {
  try { localStorage.setItem(STORE, id); } catch { /* storage off */ }
}
export const randomHero = () => HERO_IDS[Math.floor(Math.random() * HERO_IDS.length)];

/* Bot stats for a hero (bots get health and speed, no abilities yet). */
export function botStats(id) {
  const h = HEROES[id] || HEROES.knight;
  return { maxHp: h.hp, speedMult: h.speed };
}

export class HeroKit {
  /* ctx: { move, look, audio, hostiles() -> [{id, pos}], hit(id, dmg, push, from),
     spawnDog(), word(pos, text), banner(text), reEquip() } */
  constructor(ctx) {
    this.ctx = ctx;
    this.id = savedHero();
    this.reset();
  }

  get def() { return HEROES[this.id]; }
  get brute() { return this.bruteT > 0; }

  setHero(id) {
    if (!HEROES[id]) return;
    this.id = id;
    saveHero(id);
  }

  reset() {
    this.cdT = 0;
    this.meter = 0;
    this.bruteT = 0;
    this.pinT = 0;
    this.charge = null;
    this.slam = null;
  }

  /* On (re)spawn: fresh cooldown, back to Pepe, movement perks set. */
  onSpawn() {
    this.reset();
    const m = this.ctx.move;
    m.maxAirJumps = m.airJumpsLeft = this.id === "super" ? 1 : 0;
    m.glide = this.id === "super";
  }

  /* Leaving the mode: undo the movement perks. */
  off() {
    this.reset();
    const m = this.ctx.move;
    m.maxAirJumps = m.airJumpsLeft = 0;
    m.glide = false;
  }

  maxHp() { return this.brute ? BRUTE.hp : this.def.hp; }
  speedMult() { return this.pinT > 0 ? 0.05 : this.brute ? BRUTE.speed : this.def.speed; }
  meleeMult() { return this.brute ? BRUTE.meleeMult : this.def.meleeMult; }
  wireId() { return this.id + (this.brute ? "!" : ""); }

  /* Damage coming at us: the Knight's plate takes a quarter off anything
     from the front half (where he's looking). */
  incoming(amount, fromPos) {
    if (this.id !== "knight" || !fromPos) return amount;
    const { move, look } = this.ctx;
    const dx = fromPos.x - move.pos.x, dz = fromPos.z - move.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    const facing = (-Math.sin(look.yaw) * dx - Math.cos(look.yaw) * dz) / len;
    return facing > 0.2 ? amount * 0.75 : amount;
  }

  onDealt(dmg) {
    if (this.id === "metamorph" && !this.brute) this.meter = Math.min(METER_MAX, this.meter + dmg * METER_PER_DMG);
  }
  onKill() {
    if (this.id === "metamorph" && !this.brute) this.meter = Math.min(METER_MAX, this.meter + METER_PER_KILL);
  }

  pin(seconds) { this.pinT = Math.max(this.pinT, seconds); }

  ready() {
    if (this.id === "metamorph") return !this.brute && this.meter >= METER_MAX;
    return this.cdT <= 0 && !this.charge && !this.slam;
  }

  /* E. True if something happened. */
  tryAbility() {
    if (!this.ready() || this.pinT > 0) return false;
    const { move, look, audio } = this.ctx;
    const fwd = new THREE.Vector3(-Math.sin(look.yaw), 0, -Math.cos(look.yaw));
    switch (this.id) {
      case "knight":
        this.charge = { t: CHARGE_TIME, dir: fwd, hit: new Set() };
        move.impulse(fwd.x * CHARGE_SPEED, 1.5, fwd.z * CHARGE_SPEED, CHARGE_TIME);
        audio.swing?.();
        this.ctx.banner("RAGE QUIT!");
        this.cdT = this.def.cd;
        break;
      case "hunter":
        if (!this.ctx.spawnDog()) return false;
        audio.whistle?.(null);
        this.ctx.banner("SIC 'EM!");
        this.cdT = this.def.cd;
        break;
      case "super":
        this.slam = { air: false, falling: false };
        move.impulse(fwd.x * 4, SLAM_UP, fwd.z * 4, 0.25);
        audio.slideWhistle?.(null, true);
        this.cdT = this.def.cd;
        break;
      case "metamorph":
        this.bruteT = BRUTE.time;
        this.meter = 0;
        audio.airhorn?.();
        this.ctx.banner("U MAD BRO?");
        this.ctx.reEquip();
        break;
    }
    return true;
  }

  update(dt) {
    const { move } = this.ctx;
    if (this.cdT > 0) this.cdT = Math.max(0, this.cdT - dt);
    if (this.pinT > 0) this.pinT = Math.max(0, this.pinT - dt);
    if (this.bruteT > 0) {
      this.bruteT = Math.max(0, this.bruteT - dt);
      if (this.bruteT === 0) { this.ctx.banner("BACK TO PEPE"); this.ctx.reEquip(); }
    }

    // Knight: everyone the charge passes through.
    if (this.charge) {
      this.charge.t -= dt;
      for (const h of this.ctx.hostiles()) {
        if (this.charge.hit.has(h.id)) continue;
        if (Math.hypot(h.pos.x - move.pos.x, h.pos.z - move.pos.z) > CHARGE_REACH) continue;
        this.charge.hit.add(h.id);
        const d = this.charge.dir;
        this.ctx.hit(h.id, CHARGE_DMG, new THREE.Vector3(d.x * 9, 7, d.z * 9), move.pos);
        this.ctx.word(h.pos, "BONK!");
        this.ctx.audio.bonk?.(h.pos);
      }
      if (this.charge.t <= 0) this.charge = null;
    }

    // Super Troll: rise, then drive down at the top, boom on landing.
    if (this.slam) {
      if (!move.grounded) this.slam.air = true;
      if (this.slam.air && !this.slam.falling && move.velocity.y <= 0) {
        this.slam.falling = true;
        move.impulse(move.velocity.x * 0.3, -SLAM_DOWN, move.velocity.z * 0.3, 0.6);
      }
      if (this.slam.air && move.grounded) {
        this.slam = null;
        this.ctx.word(move.pos, "POW!");
        this.ctx.audio.meleeHit?.(null);
        this.ctx.shake?.(0.6);
        for (const h of this.ctx.hostiles()) {
          const dx = h.pos.x - move.pos.x, dz = h.pos.z - move.pos.z;
          const d = Math.hypot(dx, dz);
          if (d > SLAM_RADIUS || Math.abs(h.pos.y - move.pos.y) > 3) continue;
          const k = 1 - d / SLAM_RADIUS;
          const n = d > 0.01 ? 1 / d : 0;
          this.ctx.hit(h.id, Math.round(15 + SLAM_DMG * k), new THREE.Vector3(dx * n * (6 + 6 * k), 6 + 5 * k, dz * n * (6 + 6 * k)), move.pos);
        }
      }
    }
  }

  /* For the HUD chip. */
  hud() {
    const d = this.def;
    if (this.id === "metamorph") {
      if (this.brute) return { name: "BRUTE", label: `${Math.ceil(this.bruteT)}s`, frac: this.bruteT / BRUTE.time, ready: false };
      return { name: d.ability, label: this.meter >= METER_MAX ? "READY" : `${Math.floor(this.meter)}%`, frac: this.meter / METER_MAX, ready: this.meter >= METER_MAX };
    }
    const ready = this.cdT <= 0;
    return { name: d.ability, label: ready ? "READY" : `${Math.ceil(this.cdT)}s`, frac: ready ? 1 : 1 - this.cdT / d.cd, ready };
  }
}

/* Hunter's passive: every enemy step leaves a print that fades over 3 s.
   One shared geometry/material per print, a small pool reused round-robin. */
const PRINT_LIFE = 3;
export class FootprintTrail {
  constructor(scene, size = 48) {
    const geo = new THREE.PlaneGeometry(0.22, 0.34);
    geo.rotateX(-Math.PI / 2);
    this.prints = [];
    for (let i = 0; i < size; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xb6ff3c, transparent: true, opacity: 0, depthWrite: false });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      m.renderOrder = 2;
      scene.add(m);
      this.prints.push({ m, life: 0 });
    }
    this.next = 0;
    this.side = 1;
  }

  drop(pos, yaw = 0) {
    const p = this.prints[this.next];
    this.next = (this.next + 1) % this.prints.length;
    this.side = -this.side;
    p.m.position.set(pos.x + Math.cos(yaw) * 0.12 * this.side, pos.y + 0.03, pos.z - Math.sin(yaw) * 0.12 * this.side);
    p.m.rotation.y = yaw;
    p.life = PRINT_LIFE;
    p.m.visible = true;
  }

  update(dt) {
    for (const p of this.prints) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.m.material.opacity = Math.max(0, p.life / PRINT_LIFE) * 0.8;
      if (p.life <= 0) p.m.visible = false;
    }
  }

  clear() { for (const p of this.prints) { p.life = 0; p.m.visible = false; } }
}
