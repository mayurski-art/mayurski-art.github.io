// Troll Forces — Troll City's jailbreak (memory note "Troll City jailbreak",
// user 2026-10-22). Taped under every cell's bunk is a .50 hand cannon
// (modes/jailbreak-gun.js; user: "a strong gun that fires like a pistol"). Locked up,
// hold X at the bunk and it's yours: eight rounds for the eight X's on the
// chalk trollface on the back wall (maps/trollcity-jailwall.js). Hit every
// one and the weak patch beside the bunk gives; miss once (a spot already
// hit, the brick between, anywhere) and the guards heard it: the gun goes,
// no second try, the whole sentence is served.
//
// Socialize has no guns otherwise: while this one's out, fire is the shot
// (rpBusy.gun), not a punch, a sip or the piano. Each shot goes to the room
// (`jb` rp messages), so everyone hears it and sees the hole in that cell.
// A cell's wall comes back fresh a minute after it empties.

import { game } from "../core/state.js?v=st1";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1";
import { touchState } from "../input/touch.js?v=in1-th2-bp1-bf1-pd1-nf1-fs1";
import { rpBusy, rpExtras, rpListeners } from "./social-rp.js?v=rp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-kb0-kb1-kb2-kb3-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mg1-kb12-tm2-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb2-jb3";
import { cellsOf, jailed } from "./social-jail.js?v=sj1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-kb0-kb1-kb2-kb3-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mg1-kb12-tm2-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb2-jb3";
import { makeHandCannon } from "./jailbreak-gun.js?v=jb4-jb3";
import { raycastWorld } from "../weapons/ballistics.js?v=cg1-wst-hf1-fu1b7-wb1-ar1-ar2-cl1-fj1-zr10-zc1-zc2-or1-gf1-tg1";
import * as THREE from "three";

export const JB = {
  reach: 1.3,        // m from the bunk's middle to reach under it
  takeTime: 0.8,     // hold X
  shotGap: 0.35,     // s between shots
  wallRange: 7,      // m: further than this along the aim isn't the back wall
  resetSecs: 60,     // an empty cell's wall comes back fresh after this
};

export const jb = {
  sentence: null,    // the jailed.me this attempt belongs to (a new sentence, a new try)
  gun: false,        // the revolver in hand
  lost: false,       // missed: no escape this sentence
  cleared: false,    // every spot hit
  broke: null,       // the wall we blew: { ci, sentence, until (ms) }
  cd: 0, fireWas: false,
  kick: 0,           // the gun's recoil, 1 at the shot, easing back
  flashT: 0,         // the muzzle flash's time left
};
const KICK = { recoilKickPitch: 0.06, shakeVert: 1.5, shakeJolt: 1.3 };   // the screen's jolt (game.kickFireShake)

/* The hand cannon in the first-person right hand (like the fist fight's side gun). */
let fpGun = null;
function syncFpGun(show) {
  const arms = game.streakArms?.userData?.arms;
  if (!arms) return;
  if (show && !fpGun) fpGun = makeHandCannon();
  if (!fpGun) return;
  const hand = arms[0].hand;
  if (show) {
    if (fpGun.parent !== hand.parent) hand.parent.add(fpGun);
    fpGun.position.copy(hand.position);
    fpGun.quaternion.copy(hand.quaternion);
    fpGun.rotateZ(Math.PI / 2);
    // the kick: muzzle up and the gun back into the hand
    fpGun.rotateX(jb.kick * 0.55);
    fpGun.translateZ(jb.kick * 0.05);
    fpGun.scale.setScalar(1.25);
    fpGun.userData.flash.material.uniforms.uIntensity.value = jb.flashT > 0 ? 1.6 : 0;
  }
  fpGun.visible = !!show;
}

const send = (m) => game.net?.publishRp?.({ k: "jb", ...m });
const myCell = () => {
  const J = cellsOf();
  if (!J || !jailed.me || jailed.walk) return null;
  const c = J.cells[jailed.me.ci];
  return c?.wall ? c : null;
};

/* Hold X at your own bunk, locked up, with the gun still there. */
function takeAction() {
  const c = myCell();
  if (!c || jb.gun || jb.lost || jb.cleared || !game.player.alive) return null;
  if (jb.sentence === jailed.me && jb.taken) return null;
  const p = game.move.pos;
  if (Math.hypot(p.x - c.cot.x, p.z - c.cot.z) > JB.reach) return null;
  return { key: "jailbreak:gun", label: "Reach under the bunk", ctx: "Reach", time: JB.takeTime, done: takeGun };
}

function takeGun() {
  const c = myCell();
  if (!c) return;
  jb.gun = true; jb.taken = true; jb.cd = 0.4;
  cellState(jailed.me.ci).taken = true;   // gone from under the bunk till the cell's wall comes back
  rpBusy.gun = true;
  syncFpGun(true);
  showWaveBanner("A .50 hand cannon, taped under the bunk. Eight rounds, eight X's. Miss once and you serve it all", 3600);
  send({ e: "take", ci: jailed.me.ci });
}

function putAway() {
  if (!jb.gun) return;
  jb.gun = false;
  rpBusy.gun = false;
  syncFpGun(false);
}

/* Fire with the gun out: where the round meets the back wall. */
function shoot() {
  const c = myCell();
  if (!c) return;
  const ci = jailed.me.ci, W = c.wall;
  const from = new THREE.Vector3(), dir = new THREE.Vector3();
  game.camera.getWorldPosition(from);
  game.camera.getWorldDirection(dir);
  // a heavy pistol's crack, the flash, the kick and the jolt
  const at = { x: from.x, y: from.y, z: from.z };
  game.audio.pistolShot?.("fiveseven", 1.3, at);
  game.audio.revolverShot?.(1, at);
  jb.kick = 1; jb.flashT = 0.05;
  game.look.pitch += 0.06;
  game.kickFireShake?.(KICK, 1);
  // the round's dust where it lands, whatever it hits
  const d = raycastWorld(game.colliders, from, dir, 40);
  if (Number.isFinite(d) && d < 40) {
    const hitAt = from.clone().addScaledVector(dir, d);
    game.impactFx?.hit(hitAt, { normal: dir.clone().negate(), dir, surface: "concrete", scale: 1.4 });
  }
  const h = W.hitPoint(from, dir);
  const onWall = h && h.dist < JB.wallRange && h.z > c.box.z0 && h.z < c.box.z1 && h.y > c.y && h.y < c.y + 3.6;
  const s = onWall ? W.spotIndex(h.z, h.y) : -1;
  const good = s >= 0 && !W.spots[s].hit;
  if (onWall) W.mark(h.z, h.y, good ? s : -1);
  send({ e: "shot", ci, z: onWall ? +h.z.toFixed(3) : null, y: onWall ? +h.y.toFixed(3) : null, s: good ? s : -1 });
  if (!good) {
    jb.lost = true;
    W.lose();
    putAway();
    send({ e: "lost", ci });
    showWaveBanner(s >= 0 ? "Already hit that one. The guards heard: no way out now, serve the full sentence"
      : "Missed. The guards heard: no way out now, serve the full sentence", 3600);
    return;
  }
  if (W.spots.every((q) => q.hit)) {
    jb.cleared = true;
    putAway();
    breakOut(ci);
  }
}

/* Every spot hit: the patch beside the bunk blows out. It stays open while
   we're in the cell and a minute after (`jb` on our state packet, so the
   whole room and late joiners see it); walking out through it is the
   escape (modes/social-jail.js freeMe escaped). */
function breakOut(ci) {
  const c = myCell();
  if (!c) return;
  c.wall.setBroken(true, { blast: true });
  jailed.me.broke = true;
  jb.broke = { ci, sentence: jailed.me, until: Infinity };
  boom(c);
  showWaveBanner("The wall blows. Go, before anyone looks", 2800);
  send({ e: "broke", ci });
}

/* The blast at a cell's weak patch: the flash, the boom and the shake
   (a grenade's, combat/throwables.js explosionFx, its light from the pool). */
const BLAST = { glow: 0xffb070, radius: 4, kind: "lethal" };
function boom(c) {
  const at = new THREE.Vector3(c.wall.rect.x + 0.3, c.y + 1.2, (c.wall.breach.z0 + c.wall.breach.z1) / 2);
  if (game.explosionFx) game.explosionFx(BLAST, at);
  else game.audio.explosion?.(1, at);
}

/* First person: the revolver up in the right hand, the left out of the way. */
export function jailbreakArms() {
  if (!jb.gun) return null;
  return {
    R: { pos: [0.14, -0.17, -0.5], rot: [0.05, 0, -Math.PI / 2], pose: "grip" },
    L: { pos: [-0.2, -0.46, -0.45], rot: [0.25, -0.12, Math.PI / 2], pose: "relaxed" },
    gun: false, cam: { pitch: 0, yaw: 0 }, social: true,
  };
}

/* The revolvers under the bunks, and when each cell's wall comes back. */
const under = new Map();   // cell index -> { mesh, taken, emptyFor }
function cellState(i) {
  let u = under.get(i);
  if (!u) { u = { mesh: null, taken: false, emptyFor: 0 }; under.set(i, u); }
  return u;
}
function freshen(c, u) {
  c.wall.reset();
  u.taken = false;
}

/* Each frame in Socialize. */
export function updateJailbreak(dt) {
  const J = cellsOf();
  if (!J) { putAway(); under.clear(); return; }
  // a new sentence, a new try; out of the cell, the gun stays behind
  if (jb.sentence !== jailed.me) {
    putAway();
    Object.assign(jb, { sentence: jailed.me, taken: false, lost: false, cleared: false });
  }
  if (jb.gun && (!myCell() || !game.player.alive)) putAway();
  if (jb.gun) {
    jb.kick = Math.max(0, jb.kick - dt * 5);
    jb.flashT = Math.max(0, jb.flashT - dt);
    syncFpGun(true);   // follows the hand
    jb.cd = Math.max(0, jb.cd - dt);
    const fire = !game.localPauseOnly && (game.mouseDown || (game.isTouch && touchState.firing) || (game.gamepadState.connected && game.gamepadState.firing));
    if (fire && !jb.fireWas && jb.cd <= 0) { jb.cd = JB.shotGap; shoot(); }
    jb.fireWas = fire;
  } else jb.fireWas = false;

  // our blown wall: open while we're in, then a minute more
  const now = performance.now();
  if (jb.broke && jb.broke.sentence !== jailed.me && jb.broke.until === Infinity) jb.broke.until = now + JB.resetSecs * 1000;
  if (jb.broke && now > jb.broke.until) jb.broke = null;
  if (game.net) game.net.jailbreak = jb.broke ? jb.broke.ci + 1 : 0;

  const taken = new Set(), blown = new Set();
  if (jailed.me && !jailed.walk) taken.add(jailed.me.ci);
  if (jb.broke) blown.add(jb.broke.ci);
  for (const p of game.net?.peers?.values?.() || []) {
    if (game.isBotPeer(p)) continue;
    if (p.jail > 0) taken.add(p.jail - 1);
    if (p.jailbreak > 0) blown.add(p.jailbreak - 1);
  }
  J.cells.forEach((c, i) => {
    if (!c.wall) return;
    const u = cellState(i);
    if (!u.mesh) {
      // on the floor under the bunk, lying on its side: you'd have to look for it
      u.mesh = makeHandCannon();
      u.mesh.userData.flash.visible = false;
      u.mesh.position.set(c.cot.x - 0.15, c.y + 0.02, c.cot.z + 0.35);
      u.mesh.rotation.set(0, 0.6, Math.PI / 2);
      game.scene.add(u.mesh);
    }
    const mine = jailed.me && !jailed.walk && jailed.me.ci === i;
    u.mesh.visible = !(mine ? jb.taken : u.taken);
    // blown by someone (their packet, or the bang just now, before it lands)
    const open = blown.has(i) || now - (u.blownAt || -1e9) < 3000;
    if (open && c.wall.state !== "broken") c.wall.setBroken(true);   // already open (we joined after): rubble, no blast
    c.wall.tick?.(dt);
    if (!open && c.wall.state === "broken") freshen(c, u);
    u.emptyFor = taken.has(i) || open ? 0 : u.emptyFor + dt;
    if (u.emptyFor > JB.resetSecs && (c.wall.state !== "whole" || c.wall.spots.some((q) => q.hit) || u.taken)) freshen(c, u);
  });
}

/* The room: someone else's shots, misses and the gun they took. */
rpListeners.push((p, m) => {
  if (m.k !== "jb" || game.isBotPeer(p)) return;
  const J = cellsOf();
  const c = J?.cells?.[m.ci | 0];
  if (!c?.wall) return;
  if (m.e === "take") cellState(m.ci | 0).taken = true;
  else if (m.e === "shot") {
    game.audio.pistolShot?.("fiveseven", 1.3, { x: c.x, y: c.y + 1.5, z: c.z });
    game.audio.revolverShot?.(1, { x: c.x, y: c.y + 1.5, z: c.z });
    if (Number.isFinite(m.z) && Number.isFinite(m.y)) {
      game.impactFx?.hit(new THREE.Vector3(c.wall.rect.x, m.y, m.z), { normal: new THREE.Vector3(-1, 0, 0), surface: "concrete", scale: 1.4 });
      const s = Number.isInteger(m.s) && m.s >= 0 && m.s < c.wall.spots.length ? m.s : -1;
      c.wall.mark(m.z, m.y, s);
    }
  } else if (m.e === "lost") c.wall.lose();
  else if (m.e === "broke") {
    cellState(m.ci | 0).blownAt = performance.now();
    c.wall.setBroken(true, { blast: true });
    boom(c);
  }
});

rpExtras.push(takeAction);

// headless tests reach in here (tools/troll-ops-jailbreak-test.mjs)
if (typeof window !== "undefined" && /[?&]tohooks=1/.test(location.search)) {
  window.__trollJailbreak = { JB, jb, takeGun, shoot, under };
}
