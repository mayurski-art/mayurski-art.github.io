// Troll Forces — Troll City's horses, to ride (TROLL-CITY-RP2.md 2c).
//
// Six of the town's horses are their own models (view/horse-model.js): the
// three saddled at the rails out front, the saddled dun in the corral, and
// two without a saddle (the horsekeeper's job to saddle). Hold X by a
// saddled one to mount; W trots, Shift+W gallops, A/D steer, Space jumps (a
// gallop clears a fence by itself), hold X or C to get off. First or third
// person, whichever you're in.
//
// While mounted this module moves us (movement.js is bypassed, as the club
// line does): our feet are the horse's, the eye up at the saddle. The
// horse's colliders: three circles along it (a 1.3 m door stops it, the
// stable's 3.4 m doors and the corral gates don't); fences aren't ground.
//
// The wire (state packet): `ho` the horse +1, `hg` its gait, `hy` its yaw,
// `hs` the horsekeeper's saddles (bits). Everyone draws a rider's horse
// under them; when they get off it stands there, and after a minute walks
// home. The horsekeeper (the saddle peg in the stable; Hay Jay steps off)
// saddles horses, whistles one over, brushes one (it runs a bit faster).
// An apple fed to a horse brushes it too.

import * as THREE from "three";
import { game } from "../core/state.js?v=st1";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1";
import { bar, otherWithRole, rpExtras, rpListeners, rpLast, rpRide, seated, setBarRole } from "./social-rp.js?v=rp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1";
import { peerPosers } from "../net/remote-players.js?v=umb3g-pc1-nf-em1-mi2-wst-ig1-bs1-sb1-cb2-rp1-hf1-sb2-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1";
import { localPosers } from "../view/third-person.js?v=tp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1";
import { groundHeightAt, resolveCircle } from "../core/movement.js?v=umb2-sb2-gj1b7-or1-gf1-tg1";
import { poseSeated } from "./rp-roles.js?v=rp1b7-cd1-sh1-dj2-or1-bw2";
import { reachHand, setHandPose } from "../characters/character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1m1u-gt1-gt2-bk1-cw1-zr10-bf1-sr1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1";
import { buildHorse, SEAT_Y } from "../view/horse-model.js?v=hm1-hr2-zp1";

export const HORSE = {
  mountTime: 0.5, dismountTime: 0.5, reach: 2.5,
  speeds: [0, 3, 6, 11],       // m/s: stand, walk, trot, gallop
  back: -1.5,                  // backing up
  accel: 7, brake: 12,         // m/s²
  turnWalk: 1.6, turnGallop: 0.9, turnStand: 1.0,   // rad/s
  eye: SEAT_Y + 0.85,          // the rider's eye over the ground
  hop: 7.6,                    // m/s up: a 1.3 m jump
  gravity: 22,
  home: 60,                    // s parked before it walks home (the test shortens it)
  homeSpeed: 3,
  probes: [[0.9, 0.45], [0, 0.7], [-0.9, 0.45]],   // along the horse: offset, radius
  headroom: 2.5, stepUp: 0.36,
  saddleTime: 1.5, pegTime: 0.6, whistleTime: 0.6, brushTime: 1.2, feedTime: 0.6,
  brushSecs: 180, brushBoost: 1.12,
};
if (typeof window !== "undefined" && window.__trollHorseTune) Object.assign(HORSE, window.__trollHorseTune);

export const horses = {
  map: null,          // the map these were built for
  list: [],           // { id, name, coat, home, model, x, y, z, yaw, v, vy, gait, rider, parkedAt, saddled0, brushedUntil, callTo }
  mine: -1,           // the one we're on
  heard: { call: 0, brush: 0 },
};
const spots = () => (game.isSocial() ? game.builtMap?.map?.rp?.horses?.() || null : null);
const now = () => performance.now();
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const fwd = (yaw) => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) });
export const riding = () => horses.mine >= 0;

/* ----------------------------------------------------------- the horses */

function build(R) {
  for (const h of horses.list) { h.model.group.parent?.remove(h.model.group); }
  horses.list = [];
  horses.mine = -1;
  horses.map = game.builtMap;
  if (!R?.M) return;
  for (const c of R.list) {
    const model = buildHorse(R.M, { coat: c.coat, saddled: c.saddle });
    const yaw = c.ry - Math.PI / 2;
    // a parked horse is solid; ridden, its collider is put away
    const col = { min: new THREE.Vector3(), max: new THREE.Vector3(), pen: 2, horse: c.id };
    game.colliders.push(col);
    const h = { id: c.id, name: c.name, coat: c.coat, home: { x: c.x, z: c.z, yaw }, model, col,
      x: c.x, y: 0, z: c.z, yaw, v: 0, vy: 0, gait: 0, rider: null, parkedAt: 0, saddled0: c.saddle, brushedUntil: 0, callTo: null };
    h.y = groundY(h.x, h.z, 1);
    game.scene.add(model.group);
    horses.list.push(h);
  }
}
/* Ground under a horse: no fences (they're jumped, not stood on). */
let walkable = null, walkableOf = null;
function groundY(x, z, from) {
  if (walkableOf !== game.colliders || !walkable || walkable.length + horses.list.length < game.colliders.length - 50) {
    walkable = game.colliders.filter((c) => (c.pen ?? 1) >= 0.5 && c.horse == null);
    walkableOf = game.colliders;
  }
  return groundHeightAt(walkable, x, z, from + HORSE.stepUp, 0.3);
}
function placeCol(h) {
  const parked = h.rider == null;
  const fx = Math.abs(Math.sin(h.yaw)) * 1.15 + Math.abs(Math.cos(h.yaw)) * 0.35;
  const fz = Math.abs(Math.cos(h.yaw)) * 1.15 + Math.abs(Math.sin(h.yaw)) * 0.35;
  h.col.min.set(h.x - fx, parked ? h.y : -60, h.z - fz);
  h.col.max.set(h.x + fx, parked ? h.y + 1.7 : -59, h.z + fz);
}
/* Saddled: born that way, or a horsekeeper here has saddled it. */
function saddled(h) {
  if (h.saddled0) return true;
  if (bar.role === "horsekeeper" && (horses.mySaddles & (1 << h.id))) return true;
  for (const p of game.net.peers.values()) if (p.role === "horsekeeper" && (p.saddles & (1 << h.id))) return true;
  return false;
}
horses.mySaddles = 0;

/* ------------------------------------------------------------- mounting */

function nearestHorse(r, filter = () => true) {
  let best = null, bd = r;
  for (const h of horses.list) {
    if (!filter(h)) continue;
    const d = Math.hypot(h.x - game.move.pos.x, h.z - game.move.pos.z);
    if (d < bd) { bd = d; best = h; }
  }
  return best;
}
function horseAction() {
  if (!game.isSocial() || !game.player.alive || !horses.list.length) return null;
  if (riding()) {
    const h = horses.list[horses.mine];
    return { key: "dismount", label: `Get off ${h.name}`, ctx: "Off", time: HORSE.dismountTime, done: () => dismount() };
  }
  if (seated) return null;
  const R = spots();
  // the horsekeeper's peg
  if (R?.peg && Math.hypot(R.peg.x - game.move.pos.x, R.peg.z - game.move.pos.z) < 1.4) {
    if (bar.role === "horsekeeper") return { key: "peg", label: "Hang the saddle back on its peg", busy: "Hanging it up…", ctx: "Peg", time: HORSE.pegTime, done: () => { horses.mySaddles = 0; setBarRole(null, "Hay Jay's back on the horses."); } };
    const other = otherWithRole("horsekeeper");
    if (other) return { key: "peg", info: true, label: `${other.name || "Someone"} keeps the horses` };
    if (bar.role) return { key: "peg", info: true, label: "One job at a time" };
    return { key: "peg", label: "Take the spare saddle (horsekeeper)", busy: "Shouldering it…", ctx: "Peg", time: HORSE.pegTime,
      done: () => setBarRole("horsekeeper", "You keep the horses. Hold X by an unsaddled one to saddle it, by a parked one to brush it; away from them, whistle one over.") };
  }
  const h = nearestHorse(HORSE.reach, (x) => x.rider == null);
  if (!h) return null;
  // an apple for a horse: anyone
  if (bar.drink?.kind === "apple") {
    return { key: `feed:${h.id}`, label: `Feed ${h.name} your apple`, ctx: "Feed", time: HORSE.feedTime,
      done: () => { bar.drink = null; game.net.publishRp({ k: "horse", e: "feed", h: h.id }); brushed(h, null); } };
  }
  if (bar.role === "horsekeeper") {
    if (!saddled(h)) return { key: `saddle:${h.id}`, label: `Saddle ${h.name}`, busy: "Cinching the girth…", ctx: "Saddle", time: HORSE.saddleTime, done: () => { horses.mySaddles |= 1 << h.id; showWaveBanner(`${h.name} is saddled`, 1400); } };
    if (now() > h.brushedUntil) return { key: `brush:${h.id}`, label: `Brush ${h.name} down`, busy: "Brushing…", ctx: "Brush", time: HORSE.brushTime, done: () => { game.net.publishRp({ k: "horse", e: "brush", h: h.id }); brushed(h, null); } };
  }
  if (!saddled(h)) return { key: `ride:${h.id}`, info: true, label: `${h.name}: no saddle (the horsekeeper has one)` };
  return { key: `ride:${h.id}`, label: `Mount ${h.name}`, ctx: "Ride", time: HORSE.mountTime, done: () => mount(h) };
}
/* The horsekeeper's whistle: last of everything (away from it all). */
function whistleAction() {
  if (bar.role !== "horsekeeper" || riding() || !game.isSocial() || !horses.list.length) return null;
  const h = nearestHorse(400, (x) => x.rider == null && !x.callTo);
  if (!h || Math.hypot(h.x - game.move.pos.x, h.z - game.move.pos.z) < HORSE.reach + 1) return null;
  return { key: `whistle:${h.id}`, label: `Whistle ${h.name} over`, ctx: "Whistle", time: HORSE.whistleTime,
    done: () => { const to = { x: game.move.pos.x, z: game.move.pos.z }; game.net.publishRp({ k: "horse", e: "call", h: h.id, x: +to.x.toFixed(2), z: +to.z.toFixed(2) }); call(h, to); whistle(null); } };
}

function mount(h) {
  if (h.rider != null) return;
  if (bar.drink && bar.drink.kind !== "apple") { /* a drink stays in the right hand */ }
  horses.mine = h.id;
  h.rider = "me";
  h.v = 0; h.vy = 0;
  h.callTo = null;
  game.look.yaw = h.yaw;
  placeCol(h);
  game.audio?.step?.({ x: h.x, y: h.y, z: h.z }, 0.14);
  showWaveBanner(game.isTouch ? "Push forward to ride; the jump button jumps" : "W trots, Shift+W gallops, A/D steer, Space jumps · hold X or C to get off", 2600);
}
function dismount() {
  const h = horses.list[horses.mine];
  horses.mine = -1;
  if (!h) return;
  h.rider = null;
  h.v = 0; h.gait = 0; h.parkedAt = now();
  placeCol(h);
  // off on the left side, clear of it
  const left = { x: -Math.cos(h.yaw), z: Math.sin(h.yaw) };
  const p = game.move.pos;
  p.set(h.x + left.x * 1.1, h.y, h.z + left.z * 1.1);
  resolveCircle(game.colliders, p, 0.35, p.y, 2);
  p.y = groundHeightAt(game.colliders, p.x, p.z, h.y + 1.0);
  game.move.velocity?.set?.(0, 0, 0);
  game.move.grounded = true;
}

/* ---------------------------------------------------------------- riding */

/* Each frame we ride (view/player-update.js, instead of move.update). */
export function rideHorse(dt, ix, iz, keys) {
  const h = horses.list[horses.mine];
  if (!h || !game.player.alive || !game.isSocial()) { dismount(); return; }
  if (keys.off || horses.offPressed) { horses.offPressed = false; dismount(); return; }
  const boost = now() < h.brushedUntil ? HORSE.brushBoost : 1;
  // throttle: W trots, sprint gallops; a light touch walks
  let want = 0;
  if (iz > 0.05) want = keys.sprint ? HORSE.speeds[3] * boost : iz > 0.55 ? HORSE.speeds[2] : HORSE.speeds[1];
  else if (iz < -0.05) want = HORSE.back;
  const a = want > h.v ? HORSE.accel : HORSE.brake;
  h.v += Math.sign(want - h.v) * Math.min(Math.abs(want - h.v), a * dt);
  // steering: quick at a walk, wide at a gallop
  const sp = Math.abs(h.v);
  const rate = sp < 0.3 ? HORSE.turnStand : HORSE.turnWalk + (HORSE.turnGallop - HORSE.turnWalk) * Math.min(1, sp / HORSE.speeds[3]);
  const turn = -ix * rate * dt;
  h.yaw = wrap(h.yaw + turn);
  game.look.yaw += turn;   // the view swings with the horse (the mouse looks round on top)
  // airborne?
  const grounded = h.y <= groundY(h.x, h.z, h.y) + 0.02 && h.vy <= 0;
  if (grounded && keys.jump && sp > 4) h.vy = HORSE.hop;
  // a gallop jumps a fence by itself
  if (grounded && sp > 9 && fenceAhead(h, dt)) h.vy = HORSE.hop;
  // move, then push out of what it walked into (three circles along it)
  const f = fwd(h.yaw);
  h.x += f.x * h.v * dt; h.z += f.z * h.v * dt;
  h.vy -= HORSE.gravity * dt;
  h.y += h.vy * dt;
  const g = groundY(h.x, h.z, h.y);
  if (h.y <= g) { h.y = g; h.vy = 0; }
  const ar = game.ARENA;
  const tmp = new THREE.Vector3();
  for (let pass = 0; pass < 2; pass++) {
    for (const [off, r] of HORSE.probes) {
      tmp.set(h.x + f.x * off, h.y, h.z + f.z * off);
      const bx = tmp.x, bz = tmp.z;
      resolveCircle(game.colliders, tmp, r, h.y, HORSE.headroom, HORSE.stepUp);
      h.x += tmp.x - bx; h.z += tmp.z - bz;
    }
  }
  if (ar) { h.x = Math.max(ar.minX + 1.2, Math.min(ar.maxX - 1.2, h.x)); h.z = Math.max(ar.minZ + 1.2, Math.min(ar.maxZ - 1.2, h.z)); }
  h.gait = sp < 0.2 ? 0 : sp <= 3.5 ? 1 : sp <= 7 ? 2 : 3;
  // us: on the horse's back
  const m = game.move;
  m.pos.set(h.x, h.y, h.z);
  m.velocity?.set?.(f.x * h.v, h.vy, f.z * h.v);
  m.grounded = h.y <= g + 0.02;
  m.moving = false;
  m.sprinting = false;
  m.eyeHeight = HORSE.eye;
}
/* A rail 0.5-1.4 m high 1.4-4.5 m ahead (a corral fence), plus this frame's
   stride: a slow frame at a gallop covers 2 m and mustn't step over the
   window. A rail is thin (0.14 m): the stretch ahead is tested as a segment
   against each box, not at points a gallop would step over. */
function fenceAhead(h, dt) {
  const f = fwd(h.yaw), len = 3.1 + Math.abs(h.v) * dt;
  const ax = h.x + f.x * 1.4, az = h.z + f.z * 1.4, dx = f.x * len, dz = f.z * len;
  for (const c of game.colliders) {
    if (c.horse != null) continue;
    const top = c.max.y - h.y;
    if (!(top > 0.5 && top < 1.4 && c.min.y <= h.y + 0.1)) continue;
    // the segment's entry and exit along each axis (slab test)
    let t0 = 0, t1 = 1;
    for (const [a, d, lo, hi] of [[ax, dx, c.min.x, c.max.x], [az, dz, c.min.z, c.max.z]]) {
      if (Math.abs(d) < 1e-9) { if (a < lo || a > hi) { t0 = 2; break; } continue; }
      let u = (lo - a) / d, v = (hi - a) / d;
      if (u > v) [u, v] = [v, u];
      t0 = Math.max(t0, u); t1 = Math.min(t1, v);
      if (t0 > t1) break;
    }
    if (t0 <= t1) return true;
  }
  return false;
}

/* --------------------------------------------------------------- the room */

function call(h, to) { if (h.rider == null) { h.callTo = to; h.parkedAt = 0; horses.heard.call++; } }
function brushed(h, who) { h.brushedUntil = now() + HORSE.brushSecs * 1000; h.model.st.sparkle = 2; horses.heard.brush++; if (who) showWaveBanner(`${who} brushes ${h.name} down`, 1400); }
function whistle(at) {
  const a = game.audio;
  if (!a?._ready?.()) return;
  a._tone({ freq: 1500, to: 2100, duration: 0.18, gain: 0.07, type: "sine", at });
  a._tone({ freq: 2200, to: 1700, duration: 0.25, gain: 0.07, type: "sine", delay: 0.22, at });
}
function onMessage(p, m) {
  if (m.k !== "horse" || game.isBotPeer(p)) return;
  const h = horses.list[m.h | 0];
  if (!h) return;
  if (m.e === "feed") { brushed(h, null); return; }
  if (p.role !== "horsekeeper") return;
  if (m.e === "call" && Number.isFinite(+m.x) && Number.isFinite(+m.z)) { call(h, { x: +m.x, z: +m.z }); whistle(null); }
  else if (m.e === "brush") brushed(h, p.name || "The horsekeeper");
}

/* ----------------------------------------------------------- each frame */

export function updateHorses(dt) {
  const R = spots();
  if (!R) {
    if (horses.list.length) build(null);
    rpRide.on = false;
    if (game.net) { game.net.horse = 0; game.net.horseGait = 0; game.net.horseYaw = 0; game.net.saddles = 0; }
    return;
  }
  if (horses.map !== game.builtMap) build(R);
  if (bar.role !== "horsekeeper") horses.mySaddles = 0;
  // riders on the wire: which horse each peer is on
  const ridden = new Map();
  for (const p of game.net.peers.values()) {
    const i = (p.horse | 0) - 1;
    if (i >= 0 && horses.list[i] && !game.isBotPeer(p)) ridden.set(i, p);
  }
  const t = now() / 1000;
  for (const h of horses.list) {
    const peer = ridden.get(h.id);
    if (h.id === horses.mine) { /* ours: rideHorse moved it */ }
    else if (peer) {
      // someone else's: under them, where they're drawn (peerPosers sets it)
      if (h.rider !== peer.id) { h.rider = peer.id; h.callTo = null; }
      if (h.id === horses.mine) horses.mine = -1;
    } else if (h.rider != null && h.rider !== "me") {
      // they got off (or left): it stands there
      h.rider = null; h.gait = 0; h.v = 0; h.parkedAt = now();
    }
    if (h.rider == null) idle(h, dt);
    placeCol(h);
    h.model.setSaddled(saddled(h));
    h.model.group.position.set(h.x, h.y, h.z);
    h.model.group.rotation.y = h.yaw + Math.PI / 2;
    h.model.st.gait = h.gait; h.model.st.v = Math.abs(h.v);
    h.model.pose(t, dt);
    // hoofbeats from the stride, near enough to hear
    if (h.gait && Math.hypot(h.x - game.camera.position.x, h.z - game.camera.position.z) < 40) {
      const ph = h.model.st.phase, prev = h.lastPh ?? ph;
      if ((prev < 0.5 && ph >= 0.5) || ph < prev) game.audio?.step?.({ x: h.x, y: h.y, z: h.z }, 0.05 + 0.03 * h.gait);
      h.lastPh = ph;
    }
  }
  // a race for the same horse: the older player keeps it
  if (riding()) {
    const other = ridden.get(horses.mine);
    if (other && (other.since ?? 0) < (game.net.since ?? Infinity)) { showWaveBanner(`${other.name || "Someone"} got there first`, 1400); horses.mine = -1; }
  }
  rpRide.on = riding();
  const mine = horses.list[horses.mine];
  if (game.net) {
    game.net.horse = mine ? mine.id + 1 : 0;
    game.net.horseGait = mine ? mine.gait : 0;
    game.net.horseYaw = mine ? +mine.yaw.toFixed(2) : 0;
    game.net.saddles = bar.role === "horsekeeper" ? horses.mySaddles : 0;
  }
}
/* A horse nobody's on: answering a whistle, walking home after a while,
   or standing. */
function idle(h, dt) {
  let to = h.callTo;
  if (!to && h.parkedAt && now() - h.parkedAt > HORSE.home * 1000 && Math.hypot(h.x - h.home.x, h.z - h.home.z) > 0.5) to = h.home;
  if (!to) { h.v = 0; h.gait = 0; if (!h.parkedAt && Math.hypot(h.x - h.home.x, h.z - h.home.z) < 0.6) h.yaw = h.home.yaw; return; }
  const dx = to.x - h.x, dz = to.z - h.z, d = Math.hypot(dx, dz);
  const stopAt = h.callTo ? 2.0 : 0.15;
  if (d < stopAt) {
    if (to === h.home) { h.x = h.home.x; h.z = h.home.z; h.yaw = h.home.yaw; h.parkedAt = 0; }
    h.callTo = null; h.v = 0; h.gait = 0;
    return;
  }
  const speed = h.callTo ? HORSE.speeds[2] : HORSE.homeSpeed;
  const want = Math.atan2(-dx, -dz);
  h.yaw = wrap(h.yaw + Math.max(-2.5 * dt, Math.min(2.5 * dt, wrap(want - h.yaw))));
  const f = fwd(h.yaw), step = Math.min(d, speed * dt);
  const bx = h.x, bz = h.z;
  h.x += f.x * step; h.z += f.z * step;
  const p = new THREE.Vector3(h.x, h.y, h.z);
  h.col.max.y = -59; h.col.min.y = -60;   // not into itself
  resolveCircle(game.colliders, p, 0.6, h.y, HORSE.headroom, HORSE.stepUp);
  h.x = p.x; h.z = p.z;
  h.y = groundY(h.x, h.z, h.y);
  h.v = speed; h.gait = h.callTo ? 2 : 1;
  // stuck walking home: home anyway, when nobody's looking
  const moved = Math.hypot(h.x - bx, h.z - bz);
  h.stuck = moved < step * 0.2 ? (h.stuck || 0) + dt : 0;
  if (h.stuck > 3 && Math.hypot(h.x - game.camera.position.x, h.z - game.camera.position.z) > 35) {
    h.x = h.home.x; h.z = h.home.z; h.yaw = h.home.yaw; h.y = groundY(h.x, h.z, 1); h.callTo = null; h.parkedAt = 0; h.stuck = 0;
  }
}

/* ------------------------------------------------------------ the riders */

/* A rider on their horse: seated in the saddle, legs either side, hands on
   the reins, facing where the horse faces. */
const _tL = new THREE.Vector3(), _tR = new THREE.Vector3(), _pL = new THREE.Vector3(-1, -0.6, 0.4), _pR = new THREE.Vector3(1, -0.6, 0.4);
function poseRider(rig, h) {
  if (!rig || !h) return;
  rig.root.rotation.y = h.yaw;
  poseSeated(rig, h.y + SEAT_Y + h.model.body.position.y - 0.05, 0);
  const p = rig.parts, k = rig.scale || 1;
  // astride: thighs down the flanks, not forward over a chair seat
  p.legL.rotation.set(0.55, 0, 0.42);
  p.legR.rotation.set(0.55, 0, -0.42);
  p.kneeL.rotation.set(-0.95, 0, 0);
  p.kneeR.rotation.set(-0.95, 0, 0);
  p.chest.rotation.x = -(0.08 + (h.gait === 3 ? 0.12 : 0));
  // both hands forward and low to the reins
  const bob = h.gait ? Math.sin(h.model.st.phase * Math.PI * 4) * 0.02 * k : 0;
  reachHand(rig, -1, _tL.set(-0.1 * k, -0.28 * k + bob, -0.38 * k), _pL);
  reachHand(rig, 1, _tR.set(0.1 * k, -0.28 * k + bob, -0.38 * k), _pR);
  setHandPose(rig, -1, "fist");
  if (!rig.heldDrink) setHandPose(rig, 1, "fist");
  rig.root.updateMatrixWorld(true);
  rig.body?.update?.();
}

localPosers.push((rig) => {
  if (!riding() || !game.isSocial()) return;
  poseRider(rig, horses.list[horses.mine]);
});
peerPosers.push((rp) => {
  if (!game.isSocial()) return;
  const i = (rp.peer?.horse | 0) - 1;
  const h = horses.list[i];
  if (!h || h.rider !== rp.peer.id) return;
  // the horse goes where the rider's drawn (so it lags just as they do),
  // this frame (not next, when updateHorses places the rest)
  h.x = rp.pos.x; h.z = rp.pos.z; h.y = rp.pos.y;
  h.model.group.position.set(h.x, h.y, h.z);
  h.yaw = h.yaw + wrap((rp.peer.horseYaw ?? h.yaw) - h.yaw) * 0.3;
  h.model.group.rotation.y = h.yaw + Math.PI / 2;
  h.gait = rp.peer.horseGait | 0;
  h.v = [0, 3, 6, 11][h.gait];
  poseRider(rp.rig, h);
});

/* First person: both hands low on the reins (view/fp-emote.js). */
export function horseArms() {
  if (!riding()) return null;
  const h = horses.list[horses.mine];
  const bob = h.gait ? Math.sin(h.model.st.phase * Math.PI * 4) * 0.012 * h.gait : 0;
  const hand = (side) => ({ pos: [side * 0.12, -0.36 + bob, -0.46], rot: [0.5, side * 0.1, -side * Math.PI / 2], pose: "fist" });
  return { R: hand(1), L: hand(-1), gun: false, cam: { pitch: 0, yaw: 0 }, social: true };
}

/* ------------------------------------------------------------- hook up */

// C to get off: caught as it's pressed (a quick tap can fall between two frames)
if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyC" && !e.repeat && riding() && !game.localPauseOnly && !e.ctrlKey && !e.metaKey && !e.altKey) horses.offPressed = true;
  });
}

rpExtras.push(horseAction);
rpLast.push(whistleAction);
rpListeners.push(onMessage);

if (typeof window !== "undefined" && /[?&]tohooks=1/.test(location.search)) {
  window.__trollHorses = {
    HORSE, horses, mount: (i) => mount(horses.list[i]), dismount, saddled: (i) => saddled(horses.list[i]),
    state: () => ({ mine: horses.mine, role: bar.role, eye: game.move.eyeHeight,
      list: horses.list.map((h) => ({ id: h.id, x: +h.x.toFixed(2), y: +h.y.toFixed(2), z: +h.z.toFixed(2), yaw: +h.yaw.toFixed(2), gait: h.gait, v: +h.v.toFixed(2),
        rider: h.rider, saddled: saddled(h), parked: h.parkedAt > 0, brushed: now() < h.brushedUntil, called: !!h.callTo, home: h.home })) }),
  };
}
