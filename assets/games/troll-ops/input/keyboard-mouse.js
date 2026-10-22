// Keyboard and mouse: pointer lock, mouse look, every key binding, fire and
// aim on the buttons, and no text selection or drag outside typing fields.

import "../../../js/automation-pointer-lock.js?v=ap1";   // tests: a fake lock, so headless Chrome can't trap the desktop cursor
import { strikeTablet } from "../streaks/fire.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-fs1-ut1-gf1-tg1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1";
import { settings } from "../menu/settings.js?v=ms1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-aa0-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1";
import { lookSensScale } from "../streaks/warship.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-fs1-ut1-gf1-tg1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1";
import { charInspectorLive, menuEmoteWheel } from "../menu/lobby.js?v=lb1-si1-gj1-if1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-bw1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-aa0-rs1-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1";
import { skipKillcam } from "../combat/killcam-present.js?v=kp2-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-dom1-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1";
import { royaleSpectating, cycleSpectate, royale, startRoyaleAct } from "../modes/royale.js?v=md1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1";
import { tryReload, switchWeapon, setHolding } from "../combat/weapons.js?v=wp1-kc2-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-aa0-ar0-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1";
import { swivelTaps, SWIVEL_TAP, trySwivel } from "../view/third-person.js?v=tp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1";
import { startInspect } from "../view/weapon-view.js?v=wv1-si1-gj1-if1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1";
import { swingMelee } from "../combat/melee.js?v=ml1-kc2-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-aa0-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1";
import { useHeroAbility } from "../modes/umb-heroes.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-fs1-ut1-gf1-tg1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1";
import { callNuke } from "../streaks/nuke.js?v=tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1";
import { callStreakSlot } from "../streaks/calling.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-fs1-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1";
import { startCook, carriedThrowSlot, cancelCook, releaseThrowKey } from "../combat/throwables.js?v=th1-kc2-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-dom1-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1";
import { renderScoreboard } from "../core/scoreboard.js?v=sb1-gj1-if1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-aa0-rs1-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1";
import { game } from "../core/state.js?v=st1";
import { freeLook } from "../view/free-look.js?v=nf1";

// Look is composed by hand rather than by PointerLockControls: recoil and the
// touch stick both need to write into the same orientation, and letting PLC
// own the camera quaternion made them fight each other.
export const look = { yaw: 0, pitch: 0 };
const BASE_MOUSE_SENS = 0.0022;
export const PITCH_LIMIT = 1.5;

export const controls = new EventTarget();

/* When the lock last changed. Chrome refuses a re-lock for ~1s after an
   unlock (resumePlay waits it out), and the first mousemove after a fresh
   lock can carry a huge bogus delta (dropped below). */
export let lockChangedAt = 0;

export const keys = new Set();
// Belt and braces for style.css's no-select rule: no drag of any image or
// link, no selection start or long-press menu outside a typing field.
const typingField = (t) => !!t?.closest?.("input, textarea, [contenteditable='true']");

/* What used to run at load in game.js: called from game.js where this code was. */
export function initKeyboardMouse() {
  controls.isLocked = false;
  // requestPointerLock rejects (not throws) when the document isn't focused,
  // so swallow it rather than surfacing an unhandled rejection.
  controls.lock = () => {
    try {
      const p = game.renderer.domElement.requestPointerLock?.();
      p?.catch?.(() => {});
      return p || Promise.resolve();
    } catch (err) { return Promise.reject(err); }
  };
  controls.unlock = () => { try { document.exitPointerLock?.(); } catch { /* not locked */ } };
  document.addEventListener("pointerlockchange", () => {
    const locked = document.pointerLockElement === game.renderer.domElement;
    controls.isLocked = locked;
    lockChangedAt = performance.now();
    controls.dispatchEvent(new Event(locked ? "lock" : "unlock"));
  });
  document.addEventListener("mousemove", (e) => {
    if (!controls.isLocked) return;
    // The strike tablet has the mouse: it steers the reticle, not the view.
    if (strikeTablet?.isOpen) { strikeTablet.moveCursor(e.movementX, e.movementY); return; }
    // The emote wheel has the mouse while it's open: the view holds still.
    if (game.emoteWheel.isOpen) { game.emoteWheel.move(e.movementX, e.movementY); return; }
    // Right after a re-lock the browser can report one enormous jump (the
    // cursor's travel while unlocked): swallow the first moments and cap any
    // single event, so resuming never snaps the view somewhere else.
    if (performance.now() - lockChangedAt < 60) return;
    const mx = Math.max(-300, Math.min(300, e.movementX));
    const my = Math.max(-300, Math.min(300, e.movementY));
    game.mouseLookAt = performance.now();
    // No aim assist on a mouse, as in Phantom Forces (user, 2026-10-13):
    // the stick and the thumb get it (input/aim-assist.js), a cursor doesn't.
    const sens = BASE_MOUSE_SENS * (settings.sens / 100) * lookSensScale();
    look.yaw -= mx * sens;
    look.pitch += (settings.invert ? 1 : -1) * my * sens;
    look.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, look.pitch));
  });
  window.addEventListener("keydown", (e) => {
    if (game.chat.isTyping) return;
    // Match chat: Enter for everyone, Y for your team (team modes).
    if ((e.code === "Enter" || e.code === "NumpadEnter" || e.code === "KeyY") && !e.repeat
        && game.gameState === "playing" && game.isPvp() && game.net.connected) {
      e.preventDefault();
      game.chat.open(e.code === "KeyY");
      return;
    }
    // U: the public chat (everyone on Troll Forces), in any match, solo too
    if (e.code === "KeyU" && !e.repeat && game.gameState === "playing" && !typingField(e.target)) {
      e.preventDefault();
      game.chat.open("public");
      return;
    }
    // The emote wheel (in a match, or on the menu's operator): H opens and
    // closes it, X plays what's hovered, Esc closes.
    const wheel = game.gameState === "menu" ? (charInspectorLive ? menuEmoteWheel : null) : game.emoteWheel;
    if (wheel && !e.repeat && !typingField(e.target)) {
      if (e.code === "KeyH" && !game.localPauseOnly) {
        wheel.toggle(game.gameState === "menu" || (game.gameState === "playing" && game.player.alive));
        return;
      }
      if (wheel.isOpen && e.code === "KeyX") { wheel.close(); return; }
      if (wheel.isOpen && e.code === "Escape") wheel.close(true);
    }
    keys.add(e.code);
    // View mode: the keys only fly the camera (and Esc still pauses).
    if (game.isView() && game.gameState === "playing" && e.code !== "Escape") return;
    if (e.code === "Space" && !e.repeat && game.killcam.active && !game.player.alive) skipKillcam();
    if ((e.code === "Space" || e.code === "Enter") && !e.repeat && game.matchIntro.active) game.matchIntro.skip();
    if (!e.repeat && !game.player.alive && royaleSpectating()) {
      if (e.code === "ArrowLeft" || e.code === "KeyA" || e.code === "KeyQ") cycleSpectate(-1);
      if (e.code === "ArrowRight" || e.code === "KeyD" || e.code === "KeyE") cycleSpectate(1);
    }
    // Pause with other people still live in the match keeps gameState at
    // "playing" (see openPauseMenu) so their match doesn't stall, so these
    // action keys need their own guard now instead of relying on gameState.
    if (!game.localPauseOnly) {
      if (e.code === "KeyR") tryReload(true);
      // Double-tap a side to swivel; Left/Right share A/D's tap clock.
      const side = e.code === "ArrowLeft" ? "KeyA" : e.code === "ArrowRight" ? "KeyD" : e.code;
      if ((side === "KeyA" || side === "KeyD") && !e.repeat) {
        const now = performance.now() / 1000;
        if (now - swivelTaps[side] < SWIVEL_TAP) { trySwivel(side === "KeyA" ? -1 : 1); swivelTaps[side] = 0; }
        else swivelTaps[side] = now;
      }
      if (e.code === "KeyT" && !e.repeat) startInspect();
      if (e.code === "KeyV" && !e.repeat) swingMelee();
      if (e.code === "KeyE" && !e.repeat) useHeroAbility();
      if (e.code === "KeyB" && !e.repeat) game.toggleThirdPerson();
      if (e.code === "Digit1") switchWeapon("primary");
      if (e.code === "Digit2") switchWeapon("secondary");
      // Not mid-streak: it would yank the tablet/marker out of your hands.
      if (e.code === "Digit3" && game.player.holding !== "streak") setHolding("melee");
      // One key per streak row (4 = top). A single "call the priciest" key
      // fired the hunter-killer whenever you meant the care package.
      // Troll Royale has no streaks: 4 puts a plate on, 5 uses Hopium.
      if (royale && (e.code === "Digit4" || e.code === "Digit5") && !e.repeat) startRoyaleAct(e.code === "Digit4" ? "plate" : "heal");
      else if (/^Digit[4-7]$/.test(e.code) && !e.repeat) callStreakSlot(+e.code.slice(5) - 4);
      // N calls a banked Tactical Nuke (the Range keeps N for a target bot).
      if (e.code === "KeyN" && !e.repeat && !game.isRange()) callNuke();
      // G throws whatever throwable you brought (one slot: lethal OR tactical).
      if (e.code === "KeyG" && !e.repeat) startCook(carriedThrowSlot());
      // F is plant/defuse while you're somewhere you can do either (S&D);
      // everywhere else it's the tactical.
      if (e.code === "KeyF" && !e.repeat && !(game.isSnd() && game.sndCanInteract)) startCook("tactical");
    }
    // Range-only live tuning, so a sensitivity change can be felt immediately.
    if (game.isRange() && game.gameState === "playing" && !game.localPauseOnly) {
      if (e.code === "Minus") game.nudgeSetting("sens", -5, 0, 200);
      if (e.code === "Equal") game.nudgeSetting("sens", 5, 0, 200);
      if (e.code === "BracketLeft") game.nudgeSetting("fov", -1, 60, 100);
      if (e.code === "BracketRight") game.nudgeSetting("fov", 1, 60, 100);
      if (e.code === "KeyN" && !e.repeat) game.spawnRangeBot();
    }
    if (e.code === "Space" && game.gameState === "playing" && !game.localPauseOnly) e.preventDefault();
    if (e.code === "Tab" && game.gameState === "playing" && !game.localPauseOnly && game.isPvp()) {
      e.preventDefault();
      renderScoreboard();
      game.els.scoreboard.hidden = false;
    }
  });
  window.addEventListener("blur", () => { cancelCook(); game.emoteWheel.close(true); freeLook.held = false; });
  // Free look in third person (view/free-look.js): hold Alt and the mouse
  // swings the camera round your troll, to its face. (Kept from the
  // browser, which would take Alt for its menu bar.)
  const isAlt = (e) => e.code === "AltLeft" || e.code === "AltRight";
  window.addEventListener("keydown", (e) => { if (isAlt(e) && game.gameState === "playing" && !game.chat.isTyping) { e.preventDefault(); freeLook.held = true; } });
  window.addEventListener("keyup", (e) => { if (isAlt(e)) { e.preventDefault(); freeLook.held = false; } });
  window.addEventListener("keyup", (e) => {
    keys.delete(e.code);
    if (e.code === "Tab") game.els.scoreboard.hidden = true;
    if ((e.code === "KeyG" && game.cooking.slot)
      || (e.code === "KeyF" && game.cooking.slot === "tactical")) releaseThrowKey();   // a tap waits for the pin
  });
  game.renderer.domElement.addEventListener("mousedown", (e) => {
    if (!controls.isLocked) {
      // In play without the mouse (a refused re-lock, or resumed on a pad):
      // a click on the game takes it back instead of doing nothing.
      if (!game.isTouch && game.gameState === "playing" && game.els.pause.hidden) controls.lock();
      return;
    }
    if (strikeTablet?.isOpen) {
      if (e.button === 0) strikeTablet.place();
      else if (e.button === 2) strikeTablet.undo();
      return;
    }
    // Emote wheel open: a click plays what's hovered, a right click closes.
    if (game.emoteWheel.isOpen) {
      if (e.button === 0) game.emoteWheel.close();
      else if (e.button === 2) game.emoteWheel.close(true);
      return;
    }
    // Zombies, placing a deployable: a click puts it down, a right click lets it go.
    if (game.deployClick?.(e.button)) return;
    // Troll Royale, out: a click is next, a right click the one before.
    if (!game.player.alive && royaleSpectating() && (e.button === 0 || e.button === 2)) { cycleSpectate(e.button === 0 ? 1 : -1); return; }
    if (e.button === 0) game.mouseDown = true;
    if (e.button === 2) game.adsHeld = true;   // PF parity: right mouse aims
  });
  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) game.mouseDown = false;
    if (e.button === 2) game.adsHeld = false;
  });
  game.renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("dragstart", (e) => e.preventDefault());
  document.addEventListener("selectstart", (e) => { if (!typingField(e.target)) e.preventDefault(); });
  document.addEventListener("contextmenu", (e) => { if (!typingField(e.target)) e.preventDefault(); });
}
