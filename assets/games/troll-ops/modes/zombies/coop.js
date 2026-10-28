// Troll Forces Zombies: co-op, 1-4 players in one run (Zombie Rush P4).
//
// One client, the room's host (net.hostId: the longest in the room that's
// live), runs the horde, the waves, the bosses and everyone's deployables
// for real. Everyone else sees the host's zombies mirrored (zombies.js
// Zombie.proxy, driveProxy) and sends what they do to them up the wire. The
// host leaving hands the lot to the next host, who picks up the mirrored
// zombies where they stand and carries on.
//
// The wire, all on net.js's batched channel ("z" + a letter, net.js routes
// them to onZombie):
//   zs  host: zombies spawned  [[nid, type, x, gy, z, yaw, hp, maxHp, rise, look]]
//   zp  host, 10 Hz: where they are  [[nid, x, gy, lift, z, yaw, anim, hp]]
//   ze  host: events  ["d", nid, by, cash, head] died (`by` is paid `cash`),
//       ["a", nid] swung, ["h", nid, to, dmg] the swing hit player `to`,
//       ["s", x, y, z, kind] a boss slam landed, ["g", nid] gone
//   zh  player -> host: hits on its zombies  [[nid, dmg, head]]
//   zw  host, 2 Hz and on a change: the wave  { r, s, b, n, vn, vt }
//   zd  deployables  ["a", did, id, x, y, z, yaw, level, owner] put down
//       (by the placer; the host adds the owner on a sync),
//       ["h", did, hp] hit, ["x", did] broken (both the host's)
//   zv  player -> all: skip-break vote  { v: 1 | 0 }
//   zr  player -> one player: picked you up  { to }
//   zq  player -> host: send me everything (joining, or the host changed)
//   zl  host: everyone's down, the run is lost
//
// Kills pay whoever made them: the host's own straight away (run.js), a
// player's when the host's "died" comes back with their id on it.

import * as THREE from "three";
import { game } from "../../core/state.js?v=st1";
import { Zombie, zombieWire } from "./horde.js?v=zr4c-sb2b7b7dc2f1m1u-gt1-gt2-zr5-zr6-zr7-zr8-zr9-zr10-zc2-zp1-bf1-sr1-fl1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-gf1-tg1-er1-cl1-rb4-rb6-hp1-ht1-bx1-sp1-tfb8-rfx1";
import { dep, depWire, spawnDeployable } from "./deployables.js?v=zr6-zr8-zr9-zr10-zh1-zc1-zc2-hr2-zp1-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-dom1-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1";
import { bossState, bossWire, slamAt } from "./boss.js?v=zr7-zr8-zr9-zr10-zh1-zc1-zc2-hr2-zp1-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-dom1-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cl1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1";
import { updateReviveRings, clearReviveRings, reviveRingState } from "../../view/revive-ring.js?v=rv1-zp1-bf1";
import { earn } from "./economy.js?v=zr5-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1";

const POS_EVERY = 0.1;      // seconds between zp
const WAVE_EVERY = 0.5;     // ...and zw
const DEP_HP_EVERY = 0.25;  // ...and a batch of deployable health
const STATE_FRESH = 4000;   // ms: a player whose state is older than this isn't counted
const LOSE_GRACE = 1.5;     // seconds everyone has to be down before it's over
const RESYNC_GAP = 2;       // seconds between asking the host for everything
const REVIVE_RANGE = 2;     // metres
const RISE_CATCH_UP = 0.25; // seconds of rise a mirrored zombie has left once the host's is up
export const REVIVE_TIME = 4;      // seconds holding X

export const coop = {
  on: false,          // this run is in a room with others (or could be)
  host: true,         // this client runs the horde
  wave: { r: 0, s: "idle", b: 0, n: 0, vn: 0, vt: 1 },   // the host's last zw (everyone else)
  votes: new Set(),   // host: who wants the break skipped (ids, ours included)
  myVote: false,
  revive: null,       // { id, name, t } while we hold X on someone
  allDownT: 0,
  syncT: 0,
  onWaveStart: null,  // run.js: (n) a wave began (the host's word)
  onCleared: null,    // run.js: (n) the host cleared one
  onRevived: null,    // run.js: (name) a teammate picked us up
  onLost: null,       // run.js: everyone went down
  onJoinMidRound: null, // run.js: we came in while a round was on (wait it out)
  heard: false,       // the host's first zw has come in
  own: null,          // our own last wave, while we ran it (takeOver)
};

let posT = 0, waveT = 0, depT = 0;
let hits = [];              // zh, waiting for the frame's flush
let events = [];            // ze, likewise
const depDirty = new Set(); // deployables whose health changed
let lastWire = "";          // the last zw, to send a change straight away

const net = () => game.net;
const me = () => game.net.id;
const prefix = () => `${me().slice(0, 4)}.`;
const hostNow = () => !net().connected || net().hostId() === me();
const r2 = (v) => Math.round(v * 100) / 100;

/* Everyone else in the room who's a real, current player. */
export function roomPlayers() {
  const now = performance.now();
  const out = [];
  for (const p of net().peers.values()) {
    if (p.isBot || /^(bot|streak)-/.test(p.id)) continue;
    if (!p.stateAt || now - p.stateAt > STATE_FRESH) continue;
    out.push(p);
  }
  return out;
}

export const playerCount = () => (coop.on ? 1 + roomPlayers().length : 1);

const feetOf = (p) => p.snaps?.[p.snaps.length - 1] || null;

/* ------------------------------------------------------------- the run */

export function startCoop() {
  coop.on = !!net().connected;
  coop.host = hostNow();
  coop.wave = { r: 0, s: "idle", b: 0, n: 0, vn: 0, vt: 1 };
  coop.votes.clear();
  coop.myVote = false;
  coop.revive = null;
  coop.allDownT = 0;
  coop.syncT = 0;
  coop.heard = false;
  coop.own = null;
  hits = []; events = []; depDirty.clear(); lastWire = "";
  posT = waveT = depT = 0;
  dep.cosmetic = coop.on && !coop.host;
  if (!coop.on) return;
  zombieWire.hit = (z, dmg, head) => { if (z.nid) hits.push([z.nid, Math.round(dmg), head ? 1 : 0]); };
  depWire.add = (e) => send({ t: "zd", d: ["a", e.did, e.id, r2(e.pos.x), r2(e.pos.y), r2(e.pos.z), r2(e.yaw), e.level, me()] });
  depWire.hp = (e) => { if (coop.host) depDirty.add(e); };
  depWire.gone = (e) => { if (coop.host) send({ t: "zd", d: ["x", e.did] }); };
  bossWire.slam = (z, at, kind) => events.push(["s", r2(at.x), r2(at.y), r2(at.z), kind]);
  if (!coop.host) askSync();
}

export function stopCoop() {
  clearReviveRings();
  coop.on = false;
  coop.host = true;
  dep.cosmetic = false;
  zombieWire.hit = null;
  depWire.add = depWire.hp = depWire.gone = null;
  bossWire.slam = null;
}

function send(m) {
  if (!net().connected) return;
  m.id = me();
  net().send(m);
}

function askSync() {
  coop.syncT = RESYNC_GAP;
  send({ t: "zq", to: net().hostId() });
}

/* The host's horde targets: every player on their feet, as zombies.js wants
   them ({ id, pos (eye), feetY }; id null = us). */
export function coopTargets() {
  const out = [];
  if (game.player.alive && !game.player.downed) out.push({ id: null, pos: game.player.pos, feetY: game.move.pos.y });
  for (const p of roomPlayers()) {
    const s = feetOf(p);
    if (!s || p.alive === false || p.downed) continue;
    out.push({ id: p.id, pos: { x: s.x, y: s.y + 1.6, z: s.z }, feetY: s.y });
  }
  return out;
}

/* A zombie's swing landed (run.js onZombieAttack, on the host): show it
   everywhere, and if it was at someone else, it's theirs to take. True =
   it was (`blocker`: it was at a deployable, which is nobody's). */
export function coopSwing(z, dmg, blocker = false) {
  if (!coop.on || !coop.host || !z.nid) return false;
  // (the swing itself went out when it started: hostSend, z.swung)
  if (blocker || z.targetId == null) return false;
  events.push(["h", z.nid, z.targetId, Math.round(dmg)]);
  return true;
}

/* Our vote to skip the break (the Skip button / K). */
export function voteSkip() {
  coop.myVote = !coop.myVote;
  if (coop.host) { if (coop.myVote) coop.votes.add(me()); else coop.votes.delete(me()); }
  else send({ t: "zv", v: coop.myVote ? 1 : 0 });
}

/* ------------------------------------------------------------- each frame */

/* Before the director's frame: who's host now, and taking over (or handing
   back) the horde if that changed. */
export function coopPreFrame(dt) {
  if (!coop.on) return;
  const h = hostNow();
  if (h !== coop.host) {
    coop.host = h;
    if (h) takeOver();
    else handBack();
  }
  dep.cosmetic = !coop.host;
  if (!coop.host) {
    coop.syncT -= dt;
    // the break ticks down between the host's words on it
    if (coop.wave.s === "between") coop.wave.b = Math.max(0, coop.wave.b - dt);
    const zd = game.zdir;
    zd.state = coop.wave.s;
    zd.breakT = coop.wave.b;
    zd.toSpawn = coop.wave.n;
  }
}

/* After it: the host sends; everyone sends their hits; the revive. */
export function coopPostFrame(dt) {
  if (!coop.on) return;
  const zd = game.zdir;
  if (coop.host) hostSend(dt, zd);
  if (hits.length) {
    send({ t: "zh", to: net().hostId(), h: hits });
    hits = [];
  }
  if (events.length) {
    send({ t: "ze", e: events });
    events = [];
  }
  updateRevive(dt);
}

function hostSend(dt, zd) {
  const born = [];
  for (const z of zd.zombies) {
    if (!z.nid) {
      z.nid = prefix() + z.id;
      const p = z.mesh.position;
      born.push([z.nid, z.type.id, r2(p.x), r2(z.groundY), r2(p.z), r2(z.mesh.rotation.y), Math.round(z.hp), z.maxHp, z.riseT > 0 ? 1 : 0, z.look || 0]);
    }
    // a swing just started: everyone sees it now, the hit comes when it lands
    if (z.swung) { z.swung = false; if (!z.dying) events.push(["a", z.nid]); }
    if (z.dying && !z.sentDie) {
      z.sentDie = true;
      events.push(["d", z.nid, z.killedBy || me(), z.killCash || 0, z.headless ? 1 : 0]);
    }
  }
  if (born.length) send({ t: "zs", z: born });

  posT -= dt;
  if (posT <= 0) {
    posT = POS_EVERY;
    const at = [];
    for (const z of zd.zombies) {
      if (!z.alive || z.dying || !z.nid || z.riseT > 0) continue;
      const p = z.mesh.position;
      at.push([z.nid, r2(p.x), r2(z.groundY), r2(Math.max(0, p.y - z.groundY)), r2(p.z), r2(z.mesh.rotation.y), z.wireAnim, Math.round(z.hp)]);
    }
    if (at.length) send({ t: "zp", z: at });
  }

  depT -= dt;
  if (depT <= 0 && depDirty.size) {
    depT = DEP_HP_EVERY;
    for (const e of depDirty) if (e.alive) send({ t: "zd", d: ["h", e.did, Math.round(e.hp)] });
    depDirty.clear();
  }

  // the skip vote: everyone in the room wants it (gone players drop out)
  const ids = new Set([me(), ...roomPlayers().map((p) => p.id)]);
  for (const v of coop.votes) if (!ids.has(v)) coop.votes.delete(v);
  if (zd.state !== "between") { coop.votes.clear(); coop.myVote = false; }
  else if (coop.votes.size >= ids.size) zd.skipBreak();

  const w = waveWire(zd, ids.size);
  coop.own = w;
  const key = `${w.r}|${w.s}|${w.n}|${w.vn}|${w.vt}`;
  waveT -= dt;
  if (waveT <= 0 || key !== lastWire) {
    waveT = WAVE_EVERY;
    lastWire = key;
    send({ t: "zw", ...w });
  }

  // everyone down, for a moment: the run is lost
  const down = (game.player.downed || !game.player.alive) && roomPlayers().every((p) => p.downed || p.alive === false);
  coop.allDownT = down ? coop.allDownT + dt : 0;
  if (coop.allDownT >= LOSE_GRACE) {
    coop.allDownT = -1e9;
    send({ t: "zl" });
    coop.onLost?.();
  }
}

const waveWire = (zd, total) => ({ r: zd.round, s: zd.state, b: r2(zd.breakT), n: zd.toSpawn, vn: coop.votes.size, vt: total });

/* The host went (or we outlasted it): the mirrored zombies are ours now,
   standing where they were, and the wave carries on from its last word. */
function takeOver() {
  const zd = game.zdir;
  // The newer of the last wave we heard and the last we ran ourselves: a
  // host that lost the role for a moment (a newcomer looked like the host
  // while it loaded in) took it back at round 0, the only wave it had ever
  // heard, and the run started over for everyone.
  const w = coop.own && coop.own.r > coop.wave.r ? coop.own : coop.wave;
  for (const z of zd.zombies) {
    if (!z.proxy) continue;
    z.proxy = false;
    z.snap = null;
    z.sentDie = z.dying;
    if (z.type.boss) { z.slamCd = 2.5; z.summonT = 7; z.slamT = 0; }
  }
  zd.round = w.r;
  zd.state = w.s === "idle" ? "idle" : w.s;
  zd.breakT = w.b;
  zd.toSpawn = w.n;
  zd.maxAlive = 12 + 4 * Math.max(0, playerCount() - 1);
  const boss = zd.zombies.find((z) => z.type.boss && z.alive && !z.dying);
  bossState.wave = w.r;
  bossState.boss = boss || null;
  bossState.spawned = !!boss || w.s === "between";
  bossState.waveTotal = w.n + zd.aliveCount;
  coop.votes.clear();
  if (coop.myVote) coop.votes.add(me());
  dep.cosmetic = false;
  lastWire = "";
}

/* Someone older is running it after all: ours go, theirs come in. */
function handBack() {
  const zd = game.zdir;
  for (const z of zd.zombies) z.dispose(zd.scene);
  zd.zombies = [];
  dep.cosmetic = true;
  askSync();
}

/* ------------------------------------------------------------- the wire in */

const byNid = (nid) => game.zdir?.zombies.find((z) => z.nid === nid) || null;
const depByDid = (did) => dep.list.find((e) => e.did === did) || null;

export function onZombieMessage(p, m) {
  const zd = game.zdir;
  if (!coop.on || !zd) return;
  switch (m.t) {
    case "zs": if (!coop.host) for (const row of m.z || []) spawnProxy(row); break;
    case "zp": if (!coop.host) movedProxies(m.z || []); break;
    case "ze": for (const ev of m.e || []) onEvent(ev); break;
    case "zh": if (coop.host) for (const h of m.h || []) hostHit(p.id, h); break;
    case "zw": if (!coop.host) onWave(m); break;
    case "zd": onDeployable(p, m.d || []); break;
    case "zv": if (coop.host) { if (m.v) coop.votes.add(p.id); else coop.votes.delete(p.id); } break;
    case "zr": if (m.to === me()) coop.onRevived?.(p.name || "A teammate"); break;
    case "zq": if (coop.host) sendSync(p.id); break;
    case "zl": if (!coop.host) coop.onLost?.(); break;
  }
}

function spawnProxy([nid, type, x, gy, z, yaw, hp, maxHp, rise, look]) {
  const zd = game.zdir;
  if (byNid(nid) || !type) return;
  const zom = new Zombie(type, new THREE.Vector3(x, gy, z), zd.scene, Math.max(1, zd.round), { rise: !!rise, hp: maxHp, look: look || null, proxy: true });
  zom.nid = nid;
  zom.hp = Math.min(zom.maxHp, hp);
  if (!rise) zom.mesh.rotation.y = yaw;
  zd.zombies.push(zom);
}

function movedProxies(rows) {
  let missing = false;
  for (const [nid, x, gy, lift, z, yaw, a, hp] of rows) {
    const zom = byNid(nid);
    if (!zom) { missing = true; continue; }
    if (!zom.proxy || zom.dying) continue;
    // the host only sends it once it's out of the ground: a slow frame
    // rate here mustn't leave ours still climbing out while it walks off
    if (zom.riseT > RISE_CATCH_UP) zom.riseT = RISE_CATCH_UP;
    zom.snap = { x, gy, lift, z, yaw, a };
    zom.hp = Math.min(zom.hp, hp);
  }
  // a spawn message went astray: ask for the lot again
  if (missing && coop.syncT <= 0) askSync();
}

function onEvent(ev) {
  const [k] = ev;
  if (k === "d") {
    const [, nid, by, cash, head] = ev;
    const zom = byNid(nid);
    if (zom?.proxy && !zom.dying) {
      zom.dying = true;
      zom.hp = 0;
      zom.voiceEvent = head && zom.body ? null : "death";
      if (head) {
        const at = zom.popHead();
        if (at) { game.impactFx.hit(at, { normal: THREE.Object3D.DEFAULT_UP, surface: "blood", scale: 3 }); game.audio.zombieHeadPop(at); }
      }
    }
    if (by === me() && cash > 0) {
      const p = zom ? zom.mesh.position : game.move.pos;
      earn(cash, head ? "HEADSHOT KILL" : "ZOMBIE KILL", new THREE.Vector3(p.x, (zom?.groundY ?? p.y) + 1.6, p.z));
      game.zdir.kills++;
      game.player.kills++;
      game.audio.kill();
      coop.onKill?.();
    }
  } else if (k === "a") {
    const zom = byNid(ev[1]);
    if (zom?.proxy && !zom.dying) zom._swing();
  } else if (k === "h") {
    const [, nid, to, dmg] = ev;
    if (to !== me()) return;
    const zom = byNid(nid);
    game.damagePlayer(dmg, null, null, false, zom?.mesh.position);
  } else if (k === "s") {
    if (coop.host) return;
    const [, x, y, z, kind] = ev;
    slamAt(new THREE.Vector3(x, y, z), kind, false);
  } else if (k === "g") {
    const zom = byNid(ev[1]);
    if (zom?.proxy) { zom.dispose(game.zdir.scene); game.zdir.zombies.splice(game.zdir.zombies.indexOf(zom), 1); }
  }
}

/* A player's hit on one of ours (we're the host). A kill is theirs. */
function hostHit(from, [nid, dmg, head]) {
  const zom = byNid(nid);
  if (!zom || zom.proxy || !zom.alive || zom.dying) return;
  const res = zom.takeDamage(Math.max(0, Math.min(100000, +dmg || 0)), !!head);
  if (!res.killed) return;
  zom.killedBy = from;
  zom.killCash = res.cash;
  if (head) zom.popHead();
}

function onWave(m) {
  const w = coop.wave;
  const prevR = w.r, prevS = w.s;
  w.r = m.r | 0; w.s = String(m.s || "idle"); w.b = +m.b || 0; w.n = m.n | 0; w.vn = m.vn | 0; w.vt = Math.max(1, m.vt | 0);
  // The host's first word on the wave, and a round is on: we dropped into a
  // run already going, and sit this round out (run.js).
  const first = !coop.heard;
  coop.heard = true;
  if (first && w.r > 0 && w.s !== "between" && w.s !== "idle") coop.onJoinMidRound?.();
  if (w.r > prevR) coop.onWaveStart?.(w.r);
  if (w.s === "between" && prevS !== "between" && w.r > 0) coop.onCleared?.(w.r);
  if (w.s !== "between" && coop.myVote) coop.myVote = false;
}

function onDeployable(p, d) {
  const [k, did] = d;
  if (k === "a") {
    if (depByDid(did)) return;
    const [, , id, x, y, z, yaw, level, owner] = d;
    const who = owner && owner !== me() ? owner : owner === me() ? null : p.id;
    spawnDeployable(id, x, y, z, yaw, { level, did, owner: who });
    return;
  }
  if (coop.host) return;   // health and breaking are the host's to say
  const e = depByDid(did);
  if (!e) return;
  if (k === "h") e.setHp(d[2]);
  else if (k === "x") e.destroy();
}

/* Everything, to a player who just arrived (or lost track). */
function sendSync(to) {
  const zd = game.zdir;
  send({ t: "zw", to, ...waveWire(zd, playerCount()) });
  const rows = [];
  for (const z of zd.zombies) {
    if (!z.alive || z.dying || !z.nid) continue;
    const p = z.mesh.position;
    rows.push([z.nid, z.type.id, r2(p.x), r2(z.groundY), r2(p.z), r2(z.mesh.rotation.y), Math.round(z.hp), z.maxHp, 0, z.look || 0]);
  }
  if (rows.length) send({ t: "zs", to, z: rows });
  for (const e of dep.list) {
    if (!e.alive) continue;
    send({ t: "zd", to, d: ["a", e.did, e.id, r2(e.pos.x), r2(e.pos.y), r2(e.pos.z), r2(e.yaw), e.level, e.owner || me()] });
    send({ t: "zd", to, d: ["h", e.did, Math.round(e.hp)] });
  }
}

/* ------------------------------------------------------------- reviving */

/* Hold X by a downed teammate to pick them up. */
function updateRevive(dt) {
  const held = game.player.alive && !game.player.downed && !game.localPauseOnly
    && (game.keys.has("KeyX") || (game.isTouch && game.touchState?.swap) || !!game.gamepadState?.pickup);
  let near = null, nearD = REVIVE_RANGE;
  const rings = [];
  if (game.player.alive && !game.player.downed) {
    for (const p of roomPlayers()) {
      if (p.downed !== 1) continue;
      const s = feetOf(p);
      if (!s) continue;
      rings.push({ id: p.id, x: s.x, y: s.y, z: s.z });
      const d = Math.hypot(s.x - game.move.pos.x, s.z - game.move.pos.z);
      if (d < nearD && Math.abs(s.y - game.move.pos.y) < 1.5) { nearD = d; near = p; }
    }
  }
  if (!near) { coop.revive = null; updateReviveRings(rings, null, REVIVE_TIME); return; }
  if (!coop.revive || coop.revive.id !== near.id) coop.revive = { id: near.id, name: near.name || "teammate", t: 0 };
  coop.revive.t = held ? coop.revive.t + dt : 0;
  updateReviveRings(rings, coop.revive, REVIVE_TIME);
  if (coop.revive.t >= REVIVE_TIME) {
    send({ t: "zr", to: near.id });
    near.downed = 0;   // until their next state says so
    coop.revive = null;
  }
}

/* Tests (__trollOps.zrun().coop). */
export function coopDebug() {
  return {
    coop, rings: reviveRingState,
    players: () => roomPlayers().map((p) => ({ id: p.id, name: p.name, downed: p.downed | 0 })),
    targets: () => coopTargets().map((t) => t.id),
    vote: () => voteSkip(),
  };
}
