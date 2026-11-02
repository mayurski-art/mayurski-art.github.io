/* Socialize: the security room's CCTV (docs/KB-SECURITY-ROOM.md; the
   cameras, the monitor wall and the feeds in maps/kabukigrin-cctv.js).

   Every frame someone's in the office, one camera's feed renders (round
   robin), so the wall's ten monitors run at about 6 fps each, which reads
   as CCTV. Nothing renders when the room's empty.

   Stand at the wall, look at it and hold X: "Watch the cameras". The view
   becomes that camera's, full screen, graded like the monitors (the
   overlay: label, clock, REC). A / D, the arrows, the stick or the on-screen
   arrows flip cameras; Space, C, X, the pad's A or the close button stand you
   back up. Moving's frozen meanwhile; it's all local (nothing on the wire). */

import { rpExtras, seated } from "./social-rp.js?v=rp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-kb0-kb1-kb2-kb3-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mg1-kb12-tm2-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb2-jb3-jb4-jb5-jb6-sp1-hh1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-jx2-jx3-jx4-jx5-mb1-mb2-gc1-nft33-nfh1-nfh5-mg2-ll2-sp9-nft2531-nft2531h-tn12-tn13-rdf2-nh1-fs2-rgb1-bdn1-msk1-tnm1-ksr1";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2-sk1-hb4-lu1-mb1-mb2-gc1-bt1-nft33-nfh1-nfh5-mg2-nft2531-nft2531h-tn13-fs1-fs2-rgb1-bdn1-msk1-tnm1-ksr1";
import { touchState } from "../input/touch.js?v=in1-th2-bp1-bf1-pd1-nf1-fs1-tn13";
import { game } from "../core/state.js?v=st1";
import { stamp } from "../maps/kabukigrin-cctv.js?v=sr1-ksr1";

const PEEK = {
  reach: 2.9,        // from the wall's face
  cone: 0.8,         // cos of how far off the wall's middle you can look
  hold: 0.35,
};
export const P = {
  on: false,
  idx: 0,
  pos0: null,
  keys: new Set(),   // the keys down last frame (edges)
  xUp: false,        // X let go since it started (so the hold doesn't end it)
  t0: 0,
};
const api = () => (game.isSocial() ? game.builtMap?.map?.rp?.cctv?.() || null : null);
const view = () => game.builtMap?.map?.rp?.view || null;

/* In the office: by the camera (so watching a feed counts too). */
function inRoom() {
  const v = view(), p = game.camera.position;
  return !!v && v.zoneOf(p.x, p.y, p.z) === "office";
}

/* Looking at the wall, near enough, not in the chair or at its back. */
function atWall(A) {
  if (seated) return false;
  const p = game.move.pos;
  const S = A.screens;
  const mid = S[Math.floor(S.length / 2)].position;
  const d = p.z - mid.z;
  if (d < 0 || d > PEEK.reach || Math.abs(p.y - 3) > 0.6) return false;
  if (Math.hypot(p.x - A.chair.x, p.z - (A.chair.z + 0.75)) < 0.8) return false;
  const yaw = game.look.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const tx = mid.x - p.x, tz = mid.z - p.z, tl = Math.hypot(tx, tz) || 1;
  return (fx * tx + fz * tz) / tl > PEEK.cone;
}

rpExtras.push(() => {
  const A = api();
  if (!A || P.on || !game.player.alive || !atWall(A)) return null;
  return { key: "cctv", label: "Watch the cameras", busy: "Watching…", ctx: "Cameras", time: PEEK.hold, done: () => start(A) };
});

function start(A) {
  P.on = true;
  P.pos0 = game.move.pos.clone();
  P.xUp = false;
  P.t0 = performance.now();
  if (A.cams[P.idx]?.dead) flip(A, 1);
  ui().root.hidden = false;
  document.body.classList.add("to-cctv-on");
  paint(A);
  showWaveBanner(game.isTouch ? "Arrows to flip · ✕ to stop" : "A / D to flip · Space to stop", 1800);
}
function stop() {
  if (!P.on) return;
  P.on = false;
  if (UI) UI.root.hidden = true;
  document.body.classList.remove("to-cctv-on");
}
function flip(A, d) {
  const n = A.cams.length;
  for (let k = 1; k <= n; k++) {
    const i = (P.idx + d * k + n * 4) % n;
    if (!A.cams[i].dead) { P.idx = i; break; }
  }
  paint(A);
}

/* ------------------------------------------------------------- the overlay */
let UI = null;
function ui() {
  if (UI) return UI;
  const root = document.createElement("div");
  root.className = "to-cctv";
  root.hidden = true;
  root.innerHTML = `<div class="to-cctv-label"></div><div class="to-cctv-rec"><i></i>REC</div><div class="to-cctv-time"></div>
    <div class="to-cctv-hint"></div>
    <button type="button" class="to-cctv-btn to-cctv-prev" aria-label="Previous camera">‹</button>
    <button type="button" class="to-cctv-btn to-cctv-next" aria-label="Next camera">›</button>
    <button type="button" class="to-cctv-btn to-cctv-close" aria-label="Stop watching">✕</button>`;
  (document.getElementById("to-hud") || document.body).appendChild(root);
  UI = { root, label: root.querySelector(".to-cctv-label"), time: root.querySelector(".to-cctv-time"), hint: root.querySelector(".to-cctv-hint") };
  root.querySelector(".to-cctv-prev").addEventListener("click", () => { const A = api(); if (A) flip(A, -1); });
  root.querySelector(".to-cctv-next").addEventListener("click", () => { const A = api(); if (A) flip(A, 1); });
  root.querySelector(".to-cctv-close").addEventListener("click", stop);
  return UI;
}
function paint(A) {
  const U = ui(), c = A.cams[P.idx];
  U.label.textContent = c.label;
  U.hint.textContent = game.isTouch ? "" : `A / D: camera ${P.idx + 1} of ${A.cams.length} · Space to stop`;
}

/* ------------------------------------------------------------- every frame */

// the keyboard by its events (a tap shorter than a frame still counts); the
// pad and the touch sticks are polled below
if (typeof window !== "undefined") window.addEventListener("keydown", (e) => {
  if (!P.on || e.repeat) return;
  const A = api();
  if (!A) return;
  if (e.code === "KeyA" || e.code === "ArrowLeft") flip(A, -1);
  else if (e.code === "KeyD" || e.code === "ArrowRight") flip(A, 1);
  else if (e.code === "Space" || e.code === "KeyC" || (e.code === "KeyX" && P.xUp)) stop();
});
export function updateCctv() {
  const A = api();
  if (!A) { stop(); return; }
  if (P.on) {
    const dead = !game.player.alive || game.gameState !== "playing" || game.player.hp < 1;
    // held still where we stood
    game.move.pos.copy(P.pos0);
    game.move.velocity.set(0, 0, 0);
    game.move.moving = false; game.move.sprinting = false;
    const now = new Set();
    const gp = game.gamepadState, ts = touchState;
    if ((gp.connected && gp.moveX < -0.6) || (game.isTouch && ts.moveX < -0.6)) now.add("L");
    if ((gp.connected && gp.moveX > 0.6) || (game.isTouch && ts.moveX > 0.6)) now.add("R");
    if (gp.jump || gp.crouch || (game.isTouch && (ts.jump || ts.crouch))) now.add("Q");
    if (game.keys.has("KeyX") || (game.isTouch && ts.interact) || gp.pickup) now.add("X"); else P.xUp = true;
    const edge = (k) => now.has(k) && !P.keys.has(k);
    if (edge("L")) flip(A, -1);
    if (edge("R")) flip(A, 1);
    if (dead || edge("Q") || (P.xUp && edge("X") && performance.now() - P.t0 > 400)) stop();
    P.keys = now;
    if (P.on && UI) UI.time.textContent = stamp();
  }
  // the weapon pass draws nothing while the view is a camera's
  if (game.weaponScene) game.weaponScene.visible = !P.on;
  A.active = P.on || inRoom();
  A.peek = P.on ? P.idx : -1;
  A.tick(game.renderer, game.scene, { npcs: game.townNpcs, view: view(), rig: game.localRig?.root });
}

/* The view's a camera's (view/player-update.js asks first). */
export const cctvView = () => P.on;
export function placeCctvCamera(camera) {
  const c = api()?.cams[P.idx]?.cam;
  if (!c) return;
  camera.position.copy(c.position);
  camera.quaternion.copy(c.quaternion);
}

// headless tests reach in here (tools/troll-ops-cctv-test.mjs)
if (typeof window !== "undefined" && /[?&]tohooks=1/.test(location.search)) {
  window.__trollCctv = {
    P, PEEK,
    api: () => api(),
    state: () => { const A = api(); return A && { active: A.active, peek: A.peek, renders: A.stats.renders, on: P.on, idx: P.idx, dead: A.cams.map((c) => !!c.dead), inRoom: inRoom() }; },
    start: () => { const A = api(); if (A) start(A); },
    stop,
    flip: (d) => { const A = api(); if (A) flip(A, d); },
    /* a feed's pixels, summed in a coarse grid (the test compares two) */
    feed: (k) => {
      const A = api(), r = game.renderer, c = A?.cams[k];
      if (!c) return null;
      const px = new Uint16Array(c.rt.width * c.rt.height * 4);
      r.readRenderTargetPixels(c.rt, 0, 0, c.rt.width, c.rt.height, px);
      let sum = 0, lit = 0;
      for (let i = 0; i < px.length; i += 4) { const v = px[i] + px[i + 1] + px[i + 2]; sum += v; if (v > 0) lit++; }
      return { sum, lit, n: px.length / 4 };
    },
  };
}
