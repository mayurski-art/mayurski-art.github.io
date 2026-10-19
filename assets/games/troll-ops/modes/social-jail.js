// Troll Forces — Troll City's cells (TROLL-CITY-RP2.md, phase 2b).
//
// Who's locked up, for how long, and the cell doors. A fist fight refused
// (modes/social-duel.js, via the sheriff NPC's arrest) or a player sheriff
// (modes/social-sheriff.js) puts you in; your own client keeps you there.
//
// The doors aren't messages: everyone's state packet carries the cell
// they're in (`jl`, cell + 1), and every client shuts a cell's door while
// anybody's in it. So a late joiner sees the doors right, nobody can open
// or shut someone else's, and a player leaving lets their door open.
//
// You stay in by the bars and the walls; walking out of the cell's own box
// (a respawn, a teleport) ends the sentence. (It used to measure 3.4 m from
// where you were put, and the back of a cell is 4.35 m away: you could walk
// out through the wall's corner check by pressing D.)

import { game } from "../core/state.js?v=st1";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1";
import { seated, standUp } from "./social-rp.js?v=rp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1";

export const JAIL_T = {
  maxSecs: 60,       // the longest sentence
  coolSecs: 120,     // after release, nobody can cuff you again for this long
  walkSpeed: 1.6,    // m/s, walked in through the door
};

export const jailed = {
  me: null,          // { ci, left, why }
  walk: null,        // walked in by the sheriff: { to: {x, z} } till we're inside
  coolUntil: 0,      // performance.now() ms
};

export const cellsOf = () => (game.isSocial() ? game.builtMap?.map?.rp?.jail?.() || null : null);
export const inJail = () => !!jailed.me;
export const jailCooling = () => performance.now() < jailed.coolUntil;

/* The cells somebody's in: ours (once we're through the door) and every
   real player's `jl`. */
function takenCells() {
  const s = new Set();
  if (jailed.me && !jailed.walk) s.add(jailed.me.ci);
  for (const p of game.net?.peers?.values?.() || []) if (!game.isBotPeer(p) && p.jail > 0) s.add(p.jail - 1);
  return s;
}

/* An empty cell (any, if all three are full). */
export function freeCell() {
  const J = cellsOf();
  if (!J?.cells.length) return -1;
  const taken = takenCells();
  const free = J.cells.map((_, i) => i).filter((i) => !taken.has(i));
  const pool = free.length ? free : J.cells.map((_, i) => i);
  return pool[Math.floor(Math.random() * pool.length)];
}

/* Lock us up: cell `ci` (an empty one if null) for `secs`. `walkIn`: from
   the corridor through the door (a sheriff brought us), else straight in
   (we woke up on the cot). */
export function jailMe(ci, secs, why, { walkIn = false } = {}) {
  const J = cellsOf();
  if (!J?.cells.length) return false;
  if (ci == null || !J.cells[ci]) ci = freeCell();
  const c = J.cells[ci];
  if (seated) standUp();
  if (walkIn) {
    game.move.reset(c.out.x, c.out.z, c.y);
    jailed.walk = { to: { x: c.x, z: c.z } };
  } else {
    game.move.reset(c.x, c.z, c.y);
    jailed.walk = null;
  }
  game.look.yaw = c.yaw;
  jailed.me = { ci, left: Math.min(JAIL_T.maxSecs, Math.max(1, secs)), why };
  if (why) showWaveBanner(why, 3200);
  return true;
}

export function freeMe(note = "You're free to go. Behave yourself.") {
  if (!jailed.me) return;
  jailed.me = null;
  jailed.walk = null;
  jailed.coolUntil = performance.now() + JAIL_T.coolSecs * 1000;
  if (note) showWaveBanner(note, 2200);
}

/* Walked in by the sheriff: is the door taking us, not the keys? */
export const jailHolds = () => !!(jailed.me && jailed.walk);
export function jailHold(dt) {
  const m = game.move, w = jailed.walk;
  const dx = w.to.x - m.pos.x, dz = w.to.z - m.pos.z, d = Math.hypot(dx, dz);
  m.velocity.set(0, 0, 0);
  m.sprinting = false;
  if (d < 0.08) { jailed.walk = null; m.moving = false; return; }
  const s = Math.min(d, JAIL_T.walkSpeed * dt);
  m.pos.x += dx / d * s;
  m.pos.z += dz / d * s;
  m.moving = true;
  game.look.yaw = Math.atan2(-dx, -dz);
}

/* Each frame: the sentence, staying in, the doors. Returns the chip text. */
export function updateJail(dt) {
  const J = cellsOf();
  if (!J) {
    if (jailed.me) { jailed.me = null; jailed.walk = null; }
    if (game.net) game.net.jail = 0;
    return null;
  }
  if (jailed.me) {
    const c = J.cells[jailed.me.ci], p = game.move.pos, b = c.box;
    jailed.me.left -= dt;
    const inside = p.x > b.x0 - 0.3 && p.x < b.x1 + 0.3 && p.z > b.z0 - 0.3 && p.z < b.z1 + 0.3 && Math.abs(p.y - c.y) < 1.5;
    // moved out by something else (a respawn, the owner's teleport): let it go
    if (!inside && !jailed.walk) jailed.me.left = Math.min(jailed.me.left, 0);
    if (!game.player.alive) jailed.me.left = Math.min(jailed.me.left, 0);
    if (jailed.me.left <= 0) freeMe();
  }
  if (game.net) game.net.jail = jailed.me && !jailed.walk ? jailed.me.ci + 1 : 0;
  // the doors: shut while anyone's in
  const taken = takenCells();
  J.cells.forEach((c, i) => {
    const on = taken.has(i);
    if (!!c.shut !== on) { c.setShut(on); c.shut = on; }
  });
  return jailed.me ? `In the cells · ${Math.max(0, Math.ceil(jailed.me.left))}s` : null;
}
