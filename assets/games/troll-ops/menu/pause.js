// The pause menu: open and close (a solo pause stops the game; with other
// people in the match only your own player freezes), and resume.

import { cancelMark } from "../streaks/calling.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-fs1-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ls4-gb4-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2-hb4-lu1-mb1-mb2-gc1-bt1-nft33-nfh1-nfh5-mg2";
import { renderPauseRange } from "../modes/spawns.js?v=spw1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-tnt1-mb1-mb2-gc1-nft33-nfh1-nfh5-mg2";
import { renderRoomModeRow } from "../modes/social.js?v=so1-si1-mb1-gj1-if1-fu1b7b7dc1c2-wb1m1c4-tc3-cup1-nc1-th2-ar2-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-aa0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-is1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-tb1-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-tnt1-mb2-gc1-nft33-nfh1-nfh5-mg2";
import { keys, lockChangedAt, controls } from "../input/keyboard-mouse.js?v=km1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-tnt1-mb1-mb2-gc1-nft33-nfh1-nfh5-mg2";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2-sk1-hb4-lu1-mb1-mb2-gc1-bt1-nft33-nfh1-nfh5-mg2";
import { game } from "../core/state.js?v=st1";
import { classAllowed, classSwitch } from "../combat/perk-carry.js?v=pk1-cl1-bp1-fj1-zh1-zc1-zc2-nf1-fl1-or1-ffa1-dom1-gf1-tg1-kb9-sp1-gb2-tb1-dm1-tfb8-rfx1-ret1-mrg1-ug1-ugm1-mrc1-hgb8-hgb9-tw1-ars1-p416-mt2-hb4-gc1";

export function openPauseMenu() {
  // Esc out of a half-placed streak instead of opening the menu — the point
  // isn't committed yet and the charge hasn't been spent.
  if (game.markingStreak) { cancelMark(); return; }
  releaseHeldInputs();
  renderPauseRange();
  renderRoomModeRow();
  renderPauseClasses();
  if (game.otherHumansInMatch()) {
    game.localPauseOnly = true;
    game.els.pause.hidden = false;
  } else {
    game.gameState = "paused";
    game.els.pause.hidden = false;
  }
}
export function closePauseMenu() {
  game.localPauseOnly = false;
  if (game.gameState === "paused") game.gameState = "playing";
  game.els.pause.hidden = true;
  clearTimeout(resumeTimer);
  setResumeLabel(null);
  // Whatever was held when the menu opened was released then; anything
  // pressed while it was up (keys typed into it) must not leak into play.
  releaseHeldInputs();
}

/* BO2's Change Class: in any mode where you carry your own class (not the
   ones that hand you the gun: Gun Game, One in the Chamber, Royale, and not
   Socialize), the five classes. The pick is saved at once and lands on your
   next respawn (combat/damage.js respawnPlayer), never mid-life. */
export function renderPauseClasses() {
  const wrap = document.getElementById("to-pause-classes");
  if (!wrap) return;
  const mode = game.currentMode?.();
  const L = game.loadout;
  wrap.hidden = !L || !classAllowed(mode) || game.gameState === "menu";
  if (wrap.hidden) return;
  wrap.innerHTML = "";
  const pending = classSwitch.pending ?? L.active;
  L.classes.forEach((c, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `to-btn ${i === pending ? "to-btn-primary" : "to-btn-ghost"}`;
    b.textContent = c.name;
    b.title = L.classSummary(i);
    b.setAttribute("aria-pressed", String(i === pending));
    b.addEventListener("click", () => {
      L.setActiveClass(i);
      classSwitch.pending = i;
      showWaveBanner(`${c.name}: on your next respawn`);
      renderPauseClasses();
    });
    wrap.appendChild(b);
  });
}

/* Everything "held" as of now, let go: movement keys, trigger, ADS. The
   menu steals keyup/mouseup (they land on the overlay, or the tab lost
   focus), so without this you'd come back running, firing or scoped. */
export function releaseHeldInputs() {
  keys.clear();
  game.mouseDown = false;
  game.adsHeld = false;
  if (typeof game.gamepadState !== "undefined") { game.gamepadState.firing = false; game.gamepadState.ads = false; game.gamepadState.jump = false; }
}

/* Resume (the button, Start on a pad, Enter). Desktop resumes by taking the
   mouse back; Chrome refuses that for ~1s after Esc released it, which used
   to make the first Resume click do nothing at all. Now it waits out the
   cooldown on its own ("Resuming…") and, if the lock is still refused,
   drops the menu anyway so a click on the game picks the mouse up. */
let resumeTimer = 0;
const RELOCK_COOLDOWN = 1150;
export function resumePlay() {
  if (game.isTouch) { closePauseMenu(); return; }
  clearTimeout(resumeTimer);
  const wait = RELOCK_COOLDOWN - (performance.now() - lockChangedAt);
  const attempt = () => {
    controls.lock().then(() => {
      // Some browsers resolve without locking (no promise support): the
      // lock event closes the menu when it really happens.
    }).catch(() => {
      setResumeLabel(null);
      closePauseMenu();
      showWaveBanner("Click to take the mouse back", 1600);
    });
  };
  if (wait > 0) {
    setResumeLabel("Resuming…");
    resumeTimer = setTimeout(attempt, wait);
  } else attempt();
}

function setResumeLabel(text) {
  if (!game.els.resumeBtn) return;
  game.els.resumeBtn.textContent = text || "Resume";
  game.els.resumeBtn.disabled = !!text;
}
