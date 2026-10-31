// First-person emotes and Socialize's free hands: the streak arms act them
// out in front of the camera.

import { gaitPhaseRate } from "../characters/character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1m1u-gt1-gt2-bk1-cw1-zr10-bf1-sr1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-mg1-sp1";
import { bar, barSipK, atPiano, piano, syncFpDrink } from "../modes/social-rp.js?v=rp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-kb0-kb1-kb2-kb3-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mg1-kb12-tm2-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb2-jb3-jb4-jb5-jb6-sp1-hh1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-sr2-sr3-sr4-sr5-sr6-sr7";
import * as THREE from "three";
import { hideFpEmoteProps, fpEmoteRodTip } from "../characters/emotes.js?v=hb4-em1-wst-soc1-ng1c2f1m1u-gt1-gt2-cw1-zr10-bf1-sr1-or1-nf2-em2-cf1-gs2-lh1-fg2-lp1-fg3-rc1-rc4-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-ht2-bx1-cg1-mg1-sp1-chg1";
import { inspectArms, pfArms, stretchBetween, blockFistPad } from "./weapon-view.js?v=wv1-si1-gj1-if1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-sr2-sr3-sr4-sr5-sr6-sr7";
import { EMOTES } from "../characters/emote-wheel.js?v=hb4-em1-wst-soc1c2f1m1u-gt1-gt2-cw1-zr10-bf1-sr1-or1-nf2-em2-nb2-pc2-cf1-gs2-lh1-fg2-lp1-fg3-rc1-rc4-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-ht2-bx1-sf1-cg1-mg1-sp1-chg1";
import { game } from "../core/state.js?v=st1";
import { duelArms } from "../modes/social-duel.js?v=sd1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-sr2-sr3-sr4-sr5-sr6-sr7";
import { royaleUseFrame } from "../modes/royale-use.js?v=ru1-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-sr2-sr3-sr4-sr5-sr6-sr7";
import { throwFrame, placeThrowInHand } from "../combat/throw-anim.js?v=ta1-th2-cl1-bp1-gt1-gt2-cw1-fj1-zr10-zc1-zc2-bf1-sr1-nf1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-rb4-rb6-hp1-ht1-bx1-mg1-sp1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416-mt2-hb4";
import { cuffArms } from "../modes/social-sheriff.js?v=sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-kb0-kb1-kb2-kb3-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mg1-kb12-tm2-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb2-jb3-jb4-jb5-jb6-sp1-hh1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-sr2-sr3-sr4-sr5-sr6-sr7";
import { clubArms } from "../modes/club-entry.js?v=ce1c1c2-wb1m1uc4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-bk1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-sr2-sr3-sr4-sr5-sr6-sr7";
import { horseArms } from "../modes/social-horses.js?v=hr1-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cl1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-sr2-sr3-sr4-sr5-sr6-sr7";
import { surfArms } from "../modes/social-surf.js?v=gb4-gb5-gb6-gb7-gb8-gb9-tb2-sp2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-tw1-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-sr2-sr3-sr4-sr5-sr6-sr7";
import { bandArms, hideFpInstrument } from "../modes/social-band.js?v=bd1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-gf1-tg1-tw1-arw1-su1-tcs1-er1-cl1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht1-ht2-bx1-ba1-sf1-cg1-hl1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-sr2-sr3-sr4-sr5-sr6-sr7";
import { awArms } from "../modes/arm-wrestle.js?v=aw1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-gf1-tg1-tw1-arw1-su1-tcs1-er1-cl1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht1-ht2-bx1-ba1-sf1-cg1-hl1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-sr2-sr3-sr4-sr5-sr6-sr7";
import { jailbreakArms } from "../modes/social-jailbreak.js?v=jb2-jb3-jb4-jb5-jb6-sp1-hh1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-tw1-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-sr2-sr3-sr4-sr5-sr6-sr7";

/* A first-person emote (emotes.js `fp`): the gun goes away (or does the
   trick), and the streak arms' real hands act it out in front of the camera.
   Runs after updateWeaponView, so it has the last word on the viewmodel. */
export let fpEmoteArmsOn = false;


/* Socialize, first person: no gun, so your own hands swing at the bottom of
   the view with your stride (user: "empty hands should be replaced by
   running/walking animation arms moving"): low and loose at a walk, pumping
   up into view at a sprint, dropping out of sight when you stand still.
   Same hand targets as the first-person emotes (viewmodel space). */
export const socialArms = { phase: 0, k: 0, run: 0, at: 0 };
function socialArmsFrame() {
  const now = performance.now();
  const dt = Math.min(0.1, (now - (socialArms.at || now)) / 1000);
  socialArms.at = now;
  const speed = Math.hypot(game.move.velocity.x, game.move.velocity.z);
  const moving = game.move.moving && game.move.grounded && speed > 0.3;
  socialArms.k += ((moving ? 1 : 0) - socialArms.k) * Math.min(1, dt * 6);
  socialArms.run += ((game.move.sprinting ? 1 : 0) - socialArms.run) * Math.min(1, dt * 5);
  if (moving) socialArms.phase += dt * gaitPhaseRate(speed);
  const k = socialArms.k, run = socialArms.run;
  const cuffs = cuffArms();   // cuffed: hands behind your back, out of sight (social-sheriff.js)
  if (cuffs) return cuffs;
  const fight = duelArms();   // a fist fight: fists up (social-duel.js)
  if (fight) return fight;
  const jail = jailbreakArms();   // the jailbreak revolver up (social-jailbreak.js)
  if (jail) return jail;
  const wrestle = awArms();   // arm wrestling: the right hand locked with theirs (arm-wrestle.js)
  if (wrestle) return wrestle;
  const band = clubArms();   // Trolling Loud's door: the arm out for the band
  if (band) return band;
  const board = surfArms();   // on a surfboard: paddling, or arms out riding (social-surf.js)
  if (board) return board;
  const reins = horseArms();   // on a horse: both hands on the reins (social-horses.js)
  if (reins) return reins;
  const playing = bandArms();   // the saloon band's guitar or trumpet (social-band.js)
  if (playing) return playing;
  const hand = (side) => {
    // Right and left swing opposite each other, like the legs.
    const sw = Math.sin(socialArms.phase + (side > 0 ? 0 : Math.PI));
    const lift = Math.max(0, sw);   // the forward swing comes up into view
    // The view's bottom edge is about y -0.25 this far out (the viewmodel
    // lens is ~58°): standing still they sit below it, walking they rise
    // into it on each forward swing, sprinting they pump well up.
    return {
      pos: [
        side * (0.22 - run * 0.04),
        -0.46 + k * (0.19 + run * 0.04) + lift * k * (0.08 + run * 0.09),
        -0.45 - sw * k * (0.05 + run * 0.06),
      ],
      rot: [0.25 + run * 0.3 + lift * k * (0.25 + run * 0.35), side * 0.12, -side * Math.PI / 2],
      pose: run > 0.5 ? "fist" : "relaxed",
    };
  };
  // A drink (the saloon bar) rides in the right hand: held up in view and
  // steady, bobbing with the walk; a sip brings it to the mouth, tipped.
  let R = hand(1);
  if (bar.drink) {
    const s = barSipK();
    const bob = Math.sin(socialArms.phase * 2) * 0.008 * k;
    // At the top of a sip the rim is at your lip, so what you see is the
    // glass tipping up past you, not a face-full of foam.
    R = {
      pos: [0.17 - s * 0.11, -0.18 + bob + s * 0.12, -0.4 + s * 0.16],
      rot: [s * 0.95, 0.1 - s * 0.1, -Math.PI / 2],
      pose: "grip",
    };
  }
  // At the piano: both hands out on the keys, busy while a tune's going.
  if (atPiano()) {
    const a = piano.playing ? 1 : 0.15, t = piano.t;
    const keysHand = (side, rate) => ({
      pos: [side * 0.17 + Math.sin(t * 1.9 + side) * 0.03 * a, -0.3 + Math.max(0, Math.sin(t * rate)) * 0.02 * a, -0.44],
      rot: [0.95, side * 0.1, -side * Math.PI / 2], pose: "relaxed",
    });
    return { R: keysHand(1, 11), L: keysHand(-1, 9), gun: false, cam: { pitch: 0, yaw: 0 }, social: true };
  }
  return { R, L: hand(-1), gun: false, cam: { pitch: barSipK() * 0.06, yaw: 0 }, social: true };
}

const _emoteRodTip = new THREE.Vector3();
export function updateFpEmoteView() {
  // A grenade in hand outranks an emote: the arm pulls the pin and throws.
  // Then Royale's plate or Hopium (modes/royale-use.js), props placed already.
  const thr = throwFrame();
  const use = royaleUseFrame(!thr);
  const f = thr || use || game.fpEmoteFrame() || (game.socialUnarmed() && game.player.alive ? socialArmsFrame() : null);
  if (!f?.instrument) hideFpInstrument();   // the guitar / trumpet only while its arms are the ones up
  if (!f) {
    if (fpEmoteArmsOn) { game.hideStreakArms(); fpEmoteArmsOn = false; }
    syncFpDrink(false);
    hideFpEmoteProps();
    return;
  }
  inspectArms.visible = false;
  if (game.activeMeleeMesh) game.activeMeleeMesh.visible = false;
  // The gun is put away: so are the rods that hold it, or they hang in view
  // as a second pair beside the emote's.
  // Socialize has no gun to do a trick with: the hands act it out alone.
  const gun = !game.socialUnarmed() && f.gun;
  if (!gun) pfArms.visible = false;
  if (game.activeWeaponMesh) {
    game.activeWeaponMesh.visible = !!gun && game.player.holding === "gun";
    // (a gun trick, Gun spin, is placed in weapon-view.js gunTwirl)
  }
  fpEmoteArmsOn = true;
  poseFreeArms(f);
  if (f.throwing) placeThrowInHand();
  // An emote's own props in your hands (Pour up's cup and bottle).
  const props = game.emoteKind() === "fp" ? EMOTES[game.emote.idx].fpProps : null;
  if (props) {
    props(game.streakArms, game.streakArms.userData.arms[0].hand, game.streakArms.userData.arms[1].hand, game.emote.t);
    // The rods have no hand to wrap round it: each ends with its tip just
    // touching the prop, coming in from outside (user: "the end of
    // the arm should slightly touch the cup but the arm shouldnt be seen
    // being inside of the cup").
    const pad = blockFistPad();
    game.streakArms.userData.arms.forEach((arm, i) => {
      if (arm.rod.visible && fpEmoteRodTip(i === 0 ? 1 : -1, game.STREAK_SHOULDER[i], arm.hand.position, _emoteRodTip, pad)) stretchBetween(arm.rod, game.STREAK_SHOULDER[i], _emoteRodTip);
    });
  } else hideFpEmoteProps();
  // The saloon bar's drink, in the right hand (not during an emote).
  syncFpDrink(!!f.social);
}

/* Both streak arms placed straight from hand targets in viewmodel space
   ({R, L}: {pos, rot, pose} or null), not off a device's grip anchors: the
   first-person emotes and the K9 whistle. */
export function poseFreeArms(f) {
  game.streakArms.visible = true;
  const arms = game.streakArms.userData.arms;
  ["R", "L"].forEach((k, i) => {
    const arm = arms[i], h = f[k];
    // The black rods act the emote out, no fingers at all (user: "it makes it
    // even funnier"). The white hand stays placed, unseen, as the point the
    // rod reaches for and the frame anything held in it hangs off.
    arm.hand.visible = arm.wrist.visible = arm.cuff.visible = arm.sleeve.visible = false;
    arm.rod.visible = !!h;
    if (!h) return;
    arm.hand.position.set(h.pos[0], h.pos[1], h.pos[2]);
    arm.hand.rotation.set(h.rot[0], h.rot[1], h.rot[2], "YXZ");
    stretchBetween(arm.rod, game.STREAK_SHOULDER[i], arm.hand.position);
  });
}
