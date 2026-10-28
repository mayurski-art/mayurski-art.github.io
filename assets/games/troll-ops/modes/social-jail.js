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
// Leaving doesn't get you out (user, 2026-10-22: "leaving the game and
// joining back shouldnt bypass this... the sentence should resume"): what's
// left of a sentence, whether the jailbreak is off for it (`noBreak`) and
// any time still on the run are kept under SAVE_KEY (cloud-save.js syncs
// it, so another device doesn't get you out either) and picked up again the
// next time you're in Troll City's Socialize. Time away doesn't count.
//
// You stay in by the bars and the walls; walking out of the cell's own box
// (a respawn, a teleport) ends the sentence. (It used to measure 3.4 m from
// where you were put, and the back of a cell is 4.35 m away: you could walk
// out through the wall's corner check by pressing D.)

import { game } from "../core/state.js?v=st1";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-ugb1-ug1";
import { seated, standUp } from "./social-rp.js?v=rp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-kb0-kb1-kb2-kb3-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mg1-kb12-tm2-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb2-jb3-jb4-jb5-jb6-sp1-hh1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2";

export const JAIL_T = {
  maxSecs: 60,       // the longest sentence
  coolSecs: 120,     // after release, nobody can cuff you again for this long
  walkSpeed: 1.6,    // m/s, walked in through the door
  heatSecs: 120,     // out through the wall: this long on the run (modes/social-jailbreak.js spots you)
};

const SAVE_KEY = "trollops:jail";
const RESUME_DELAY = 1200;   // ms after arriving: the spawn's placed us first

export const jailed = {
  me: null,          // { ci, left, why }
  walk: null,        // walked in by the sheriff: { to: {x, z} } till we're inside
  coolUntil: 0,      // performance.now() ms
  escapedAt: 0,      // performance.now() ms we went out through the wall (modes/social-jailbreak.js)
  heatUntil: 0,      // ...and on the run till then: anyone who sees us sends us back
  inTown: false,     // Troll City's cells were here last frame
  resumeAt: 0,       // performance.now() ms to pick a saved sentence back up
  saved: null,       // what's in SAVE_KEY now (JSON), so it's only written on a change
  pending: 0,        // caught, the sheriff walking us back: the sentence already owed
};

export const cellsOf = () => (game.isSocial() ? game.builtMap?.map?.rp?.jail?.() || null : null);
export const inJail = () => !!jailed.me;
export const jailCooling = () => performance.now() < jailed.coolUntil;
export const onTheRun = () => !jailed.me && performance.now() < jailed.heatUntil;

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
  jailed.heatUntil = 0;
  jailed.pending = 0;
  if (why) showWaveBanner(why, 3200);
  return true;
}

/* `escaped`: out through the wall (modes/social-jailbreak.js), not let go:
   no grace from the cuffs after it. */
export function freeMe(note = "You're free to go. Behave yourself.", { escaped = false } = {}) {
  if (!jailed.me) return;
  jailed.me = null;
  jailed.walk = null;
  jailed.coolUntil = escaped ? 0 : performance.now() + JAIL_T.coolSecs * 1000;
  jailed.escapedAt = escaped ? performance.now() : 0;
  jailed.heatUntil = escaped ? performance.now() + JAIL_T.heatSecs * 1000 : 0;
  if (note) showWaveBanner(note, 2200);
}

/* The sentence as it stands, for SAVE_KEY: null when there's nothing owed. */
function owed() {
  const heat = Math.max(0, jailed.heatUntil - performance.now()) / 1000;
  if (jailed.me) return { left: Math.max(1, Math.ceil(jailed.me.left / 5) * 5), noBreak: !!jailed.me.noBreak };
  if (jailed.pending) return { left: jailed.pending, noBreak: true };
  if (heat > 0) return { heat: Math.ceil(heat / 5) * 5 };
  return null;
}
function saveJail() {
  const o = owed(), s = o ? JSON.stringify(o) : null;
  if (s === jailed.saved) return;
  jailed.saved = s;
  try { if (s) localStorage.setItem(SAVE_KEY, s); else localStorage.removeItem(SAVE_KEY); } catch { /* private mode */ }
}
function loadJail() {
  try {
    const o = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!o || typeof o !== "object") return null;
    const left = Math.min(JAIL_T.maxSecs, Math.max(0, +o.left || 0)), heat = Math.min(JAIL_T.heatSecs, Math.max(0, +o.heat || 0));
    return left || heat ? { left, heat, noBreak: !!o.noBreak } : null;
  } catch { return null; }
}
/* Back in Troll City: the cell again, or the rest of the run. */
function resumeJail() {
  const o = loadJail();
  if (!o || jailed.me) return;
  if (o.left > 0) {
    if (jailMe(null, o.left, `Your sentence picks up where you left it: ${Math.ceil(o.left)}s`)) jailed.me.noBreak = o.noBreak;
  } else if (o.heat > 0) {
    jailed.heatUntil = performance.now() + o.heat * 1000;
    showWaveBanner(`Still on the run: ${Math.ceil(o.heat)}s. Stay out of sight`, 3000);
  }
}
if (typeof window !== "undefined") window.addEventListener("pagehide", () => { if (jailed.inTown) saveJail(); });

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
    // leaving town: what's owed is kept, then let go here
    if (jailed.inTown && !jailed.resumeAt) saveJail();   // (a save not yet picked up stays as it was)
    jailed.inTown = false; jailed.resumeAt = 0;
    jailed.heatUntil = 0;
    if (jailed.me) { jailed.me = null; jailed.walk = null; }
    if (game.net) { game.net.jail = 0; game.net.heat = 0; }
    return null;
  }
  if (!jailed.inTown) { jailed.inTown = true; jailed.resumeAt = performance.now() + RESUME_DELAY; jailed.saved = undefined; }
  if (jailed.resumeAt && performance.now() >= jailed.resumeAt) { jailed.resumeAt = 0; resumeJail(); }
  if (jailed.me) {
    const c = J.cells[jailed.me.ci], p = game.move.pos, b = c.box;
    jailed.me.left -= dt;
    const inside = p.x > b.x0 - 0.3 && p.x < b.x1 + 0.3 && p.z > b.z0 - 0.3 && p.z < b.z1 + 0.3 && Math.abs(p.y - c.y) < 1.5;
    // moved out by something else (a respawn, the owner's teleport): let it go
    if (!inside && !jailed.walk) jailed.me.left = Math.min(jailed.me.left, 0);
    if (!game.player.alive) jailed.me.left = Math.min(jailed.me.left, 0);
    if (jailed.me.left <= 0) {
      // out of the cell with its wall blown (`broke`, the jailbreak): that's an escape
      const out = !!jailed.me.broke && !inside;
      freeMe(out ? "You're out. Keep your head down" : undefined, { escaped: out });
    }
  }
  if (game.net) game.net.jail = jailed.me && !jailed.walk ? jailed.me.ci + 1 : 0;
  if (game.net) game.net.heat = onTheRun() ? 1 : 0;
  if (!jailed.resumeAt) saveJail();   // (not before the saved one's been picked up: it'd wipe it)
  // the doors: shut while anyone's in
  const taken = takenCells();
  J.cells.forEach((c, i) => {
    const on = taken.has(i);
    if (!!c.shut !== on) { c.setShut(on); c.shut = on; }
  });
  if (onTheRun()) {
    const s = Math.ceil((jailed.heatUntil - performance.now()) / 1000);
    return `On the run · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} · stay out of sight`;
  }
  return jailed.me ? `In the cells · ${Math.max(0, Math.ceil(jailed.me.left))}s` : null;
}
