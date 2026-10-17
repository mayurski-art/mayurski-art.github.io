// Troll Forces Zombies: the bosses (Zombie Rush P3). A mini-boss
// (Meatwagon) walks in partway through waves 10 and 20; the last wave opens
// with the final boss (The Grinlord), who calls the dead up round him. Both
// slam the ground when you're close: they plant, wind up (the tell), and a
// shockwave knocks you back and hurts, and breaks deployables near it.
// Their health is a multiple of the wave's own zombie health, so they keep
// pace with the curve (zombies.js healthForRound), times a share per player.
//
// Co-op: only the host runs them (when they come, the slam, the summons);
// a slam goes out on the wire (bossWire.slam) and lands on every player's
// own screen through slamAt, which hurts only the local player.
//
// The bosses are ordinary zombies to everything else (types "mini" and
// "boss" in zombies.js: bigger, red, stagger-proof): bullets, turrets and
// barrels hit them, they count toward the wave, and the wave isn't clear
// until they're down. This file adds when they come and what they do.

import * as THREE from "three";
import { game } from "../../core/state.js?v=st1";
import { healthForRound, ZOMBIE_TYPES } from "./horde.js?v=zr4c-sb2b7b7dc2f1m1u-gt1-gt2-zr5-zr6-zr7-zr8-zr9-zr10-zc2-zp1-bf1-sr1-fl1-or1-nf2-em2-lh1-fg2-fg3";
import { dep } from "./deployables.js?v=zr6-zr8-zr9-zr10-zh1-zc1-zc2-hr2-zp1-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3";

export const MINI_WAVES = [10, 20];
const MINI_HP = 10;            // x the wave's zombie health
const FINAL_HP = 12;
const PER_PLAYER = 0.3;        // health share each extra player adds (0.7 + 0.3 x players)
const MINI_AT = 0.5;           // the mini-boss comes once this share of the wave is out

const SLAM = {
  mini: { range: 3.6, radius: 4.2, damage: 40, windup: 0.9, cd: 7, push: 11 },
  boss: { range: 4.4, radius: 5.2, damage: 55, windup: 0.8, cd: 5.5, push: 13 },
};
const SUMMON = { every: 14, count: 3, max: 10 };   // the final boss: walkers round him, up to max alive

/* Co-op (coop.js): `slam(zombie, at, kind)` sends one to the room. */
export const bossWire = { slam: null };

export const bossState = {
  wave: 0,
  spawned: false,
  boss: null,          // the zombie
  waveTotal: 0,        // how many the wave started with (when the mini comes)
  rings: [],           // shockwave rings on the ground
};

export const bossHealth = (kind, wave, players = 1) =>
  Math.round(healthForRound(wave) * (kind === "boss" ? FINAL_HP : MINI_HP) * (1 - PER_PLAYER + PER_PLAYER * players));

export function resetBosses() {
  for (const r of bossState.rings) game.scene.remove(r.mesh);
  bossState.rings.length = 0;
  bossState.wave = 0;
  bossState.spawned = false;
  bossState.boss = null;
}

/* A new wave started (run.js nextZombieWave). */
export function bossWaveStarted(wave) {
  bossState.wave = wave;
  bossState.spawned = false;
  bossState.boss = null;
  bossState.waveTotal = game.zdir?.toSpawn || 0;
}

export const bossKindFor = (wave, finalWave) =>
  wave >= finalWave ? "boss" : MINI_WAVES.includes(wave) ? "mini" : null;

/* The boss now (tests; the debug hook). */
export function spawnBossNow(kind) {
  const zd = game.zdir;
  const feet = { x: game.move.pos.x, y: game.move.pos.y, z: game.move.pos.z };
  const z = zd.spawnBoss(kind, bossHealth(kind, Math.max(1, zd.round)), feet);
  if (!z) return null;
  bossState.spawned = true;
  bossState.boss = z;
  z.slamCd = 2.5;
  z.summonT = SUMMON.every * 0.5;
  z.slamT = 0;
  game.audio.zombieShriek(z.mesh.position);
  return z;
}

/* Expanding dust ring on the ground where a slam lands. */
const RING_GEO = new THREE.RingGeometry(0.82, 1, 48);
function slamRing(at, radius) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xd8c3a0, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(RING_GEO, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(at.x, at.y + 0.06, at.z);
  mesh.scale.setScalar(0.3);
  game.scene.add(mesh);
  bossState.rings.push({ mesh, t: 0, life: 0.45, radius });
}

function slam(z, S) {
  const p = z.mesh.position;
  const at = new THREE.Vector3(p.x, z.groundY, p.z);
  slamAt(at, z.type.id, true);
  bossWire.slam?.(z, at, z.type.id);
}

/* A slam landing at `at` (on the ground): the ring and the dust, the local
   player hurt and thrown, and (`real`: this client runs the bosses) the
   deployables in it broken. */
export function slamAt(at, kind, real = true) {
  const S = SLAM[kind];
  if (!S) return;
  const p = at;
  slamRing(at, S.radius);
  game.spawnImpactBurst(at.clone().setY(at.y + 0.2), 0x9c8a6a, 30);
  game.audio.explosion(0.55, at);
  // you: hurt and thrown back, more the closer you stood
  const me = game.move.pos;
  const dx = me.x - p.x, dz = me.z - p.z;
  const d = Math.hypot(dx, dz);
  if (d < S.radius && Math.abs(me.y - at.y) < 1.6 && game.player.alive && !game.player.downed) {
    const k = 1 - d / S.radius;
    game.damagePlayer(Math.round(S.damage * (0.4 + 0.6 * k)), null, null, false, p);
    const n = d > 0.01 ? 1 / d : 0;
    game.move.impulse?.(dx * n * S.push * (0.5 + 0.5 * k), 4, dz * n * S.push * (0.5 + 0.5 * k), 0.45);
  }
  const near = Math.max(0, 1 - d / (S.radius * 2.5));
  if (near > 0) { game.shakeMag = Math.max(game.shakeMag, 0.05 * near); game.shakeT = 0.4; }
  // deployables in the ring take a beating
  if (real) for (const e of dep.list.slice()) {
    if (e.alive && Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < S.radius) e.hit(S.damage * 4);
  }
}

/* One boss's moves this frame: the slam (plant, wind up, land), and the
   final boss's summons. */
/* Who the boss is after: a co-op target's feet, or the local player's. */
function targetFeet(z) {
  const t = z.targetId != null ? game.zdir.targets?.find((q) => q.id === z.targetId) : null;
  return t ? { x: t.pos.x, y: t.feetY, z: t.pos.z } : game.move.pos;
}

function bossBrain(z, dt) {
  if (!z.alive || z.dying || z.riseT > 0) return;
  const S = SLAM[z.type.id];
  const me = targetFeet(z);
  const d = Math.hypot(me.x - z.mesh.position.x, me.z - z.mesh.position.z);
  z.slamCd = Math.max(0, (z.slamCd ?? 0) - dt);
  if (z.slamT > 0) {
    z.slamT -= dt;
    if (z.slamT <= 0) slam(z, S);
  } else if (S && z.slamCd <= 0 && d < S.range && Math.abs(me.y - z.groundY) < 1.6) {
    // the tell: it stops, faces you, and swings its arms up slowly
    z.slamT = S.windup;
    z.slamCd = S.cd;
    z.holdT = S.windup + 0.35;
    z.mesh.rotation.y = Math.atan2(-(me.x - z.mesh.position.x), -(me.z - z.mesh.position.z));
    if (z.body) {
      z.play("attack", 0.1);
      z.anim.setEffectiveTimeScale(0.55);
      z.attackT = S.windup + 0.3;
    }
    z.voiceEvent = "snarl";
  }
  if (z.type.id === "boss") {
    z.summonT -= dt;
    if (z.summonT <= 0) {
      z.summonT = SUMMON.every;
      const alive = game.zdir.zombies.filter((q) => q.alive && !q.dying).length;
      const n = Math.min(SUMMON.count, SUMMON.max - alive);
      if (n > 0) {
        game.zdir.summonAround(new THREE.Vector3(z.mesh.position.x, z.groundY, z.mesh.position.z), n);
        game.audio.zombieShriek(z.mesh.position);
      }
    }
  }
}

/* Every frame of a run. Returns the boss bar's state, or null. `host`:
   this client runs the horde (always, solo); otherwise the bosses are the
   host's, mirrored, and only the bar and the rings are ours. */
export function updateBosses(dt, finalWave, onArrive, host = true) {
  const zd = game.zdir;
  if (!zd) return null;
  const kind = bossKindFor(zd.round, finalWave);
  if (host && kind && !bossState.spawned && bossState.wave === zd.round && zd.state !== "between") {
    // the final boss opens the wave; a mini comes once half the wave is out
    const out = bossState.waveTotal - zd.toSpawn;
    if (kind === "boss" || out >= bossState.waveTotal * MINI_AT) {
      const z = spawnBossNow(kind);
      if (z) onArrive?.(z);
    }
  }
  if (host) for (const z of zd.zombies) if (z.type.boss && !z.proxy) bossBrain(z, dt);
  for (let i = bossState.rings.length - 1; i >= 0; i--) {
    const r = bossState.rings[i];
    r.t += dt;
    const k = Math.min(1, r.t / r.life);
    r.mesh.scale.setScalar(0.3 + (r.radius - 0.3) * (1 - Math.pow(1 - k, 2)));
    r.mesh.material.opacity = 0.75 * (1 - k);
    if (k >= 1) { game.scene.remove(r.mesh); r.mesh.material.dispose(); bossState.rings.splice(i, 1); }
  }
  const b = host ? bossState.boss : zd.zombies.find((z) => z.type.boss && z.alive && !z.dying);
  if (!b || !b.alive || b.dying) return null;
  return { name: ZOMBIE_TYPES[b.type.id].name, k: Math.max(0, b.hp / b.maxHp), final: b.type.id === "boss" };
}
