// Bots' shooting: who they can target, how their shots look and sound to
// everyone, firing at enemy aircraft, and the damage a bot we host deals.

import { occupants } from "../modes/spawns.js?v=spw1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-jx2";
import { saberBlock, kbShield } from "./melee.js?v=ml1-kc2-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-aa0-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-jx2";
import { MELEE_DEFS } from "../weapons/gear.js?v=to-hb1kb3-bk1-wst-ig1-th2-zr5-zr9-zr10-zp1-or1-rb4-hp1-bx1-mg1-sp1";
import { streakEntities } from "../streaks/calling.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-fs1-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ls4-gb4-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2-hb4-jx2";
import { K9Pack } from "../bots/k9-unit.js?v=k9c-bs1-sb2-gj1b7b7d-sr1-fl1-or1-gf1-tg1-tcs1-tx1-sp1-kbt1-gb1-pm1-kbk2-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-ugb1-ug1-ugm1-hgb6-hb4";
import { WEAPON_DEFS, chargedShotDef } from "../weapons/weapons.js?v=p5bm-wst-hf1-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-or1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416-mt2-hb4";
import { hellfire } from "../view/viewmodels.js?v=vm1-si1-gj1-if1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-jx2";
import * as THREE from "three";
import { royale, royaleBotDamage, royaleBotHit, royaleNoise } from "../modes/royale.js?v=md1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-jx2";
import { noteRigShot } from "../view/third-person.js?v=tp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-jx2";
import { enemyAirFor, damageStreakEntity } from "../streaks/dragonfire.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-aa0-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-fs1-ut1-gf1-tg1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ls4-gb4-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2-hb4-jx2";
import { VtolWarship, HunterDrone, HelicopterGunship } from "../streaks/streak-entities.js?v=vsat2-hk1-sr1-or1-tx1-sp1-kbt1-gb1-pm1-kbk2-tfp7-tfb8-ss1-ss2-ss3-tfm2-ugb1-ug1-ugm1-hgb6";
import { SamTurret } from "../streaks/sam-turret.js?v=sam1-fj1-or1";
import { isStaging } from "../modes/match-start.js?v=mst1-si1-mb1-gj1-if1-fu1b7b7dc1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-ob1-kc1-dj2-bf1-pd1-jb1-pl2-nh1-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-bc1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-bz1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kb3-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-bk1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-jx2";
import { botBusy } from "../modes/objectives.js?v=ob1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-jx2";
import { raycastWorld } from "../weapons/ballistics.js?v=cg1-wst-hf1-fu1b7-wb1-ar1-ar2-cl1-fj1-zr10-zc1-zc2-or1-gf1-tg1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416-mt2-hb4";
import { Dragonfire } from "../streaks/dragonfire-drone.js?v=df3-sb2-or1";
import { damagePlayer, isExplosive } from "./damage.js?v=dm1-kc2-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-dom1-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-pm1-kbk2-zw1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-jx2";
import { damageDog } from "../streaks/k9.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-fs1-ut1-gf1-tg1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ls4-gb4-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2-hb4-jx2";
import { flinchPeer } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2-sk1-hb4-jx2";
import { registerDeath } from "./scoring.js?v=sc1-kc2-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-jx2";
import { aaTargetsFor, launchAa } from "./launcher.js?v=fj1-zr9-zr10-zc1-zc2-hr2-zp1-aa0-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-fs1-ut1-gf1-tg1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ls4-gb4-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2-sk1-hb4-jx2";
import { game } from "../core/state.js?v=st1";

/* Everything a bot could shoot at: us, other humans, and other bots. */
export function botTargets() {
  const list = [];
  for (const o of occupants()) {
    // No point emptying a magazine into someone spawn protection is going to
    // shrug off — and it would look like the bot is broken.
    if (o.id === game.net.id && game.player.spawnGuard > 0) continue;
    // `melee`: only carrying a sword (Infection's infected), so worth
    // backing away from rather than holding ground against.
    // `blocking`: a Trollsaber guard up, which bots respect (bots.js
    // isGuarding) instead of emptying magazines into it.
    let blocking = false;
    if (o.id === game.net.id) blocking = saberBlock.active || kbShield.active;
    else {
      const rp = game.remotes.byId.get(o.id);
      blocking = !!(rp?.peer.blocking && rp.saberOut);
    }
    list.push({ id: o.id, team: o.team, alive: true, pos: o.pos, groundY: o.pos.y, yaw: o.yaw,
      melee: game.isInfection() && o.team === "ghost", blocking, blockCone: MELEE_DEFS.trollsaber.deflect.cone });
  }
  // K9 dogs are fair game: bots shoot the ones coming for them.
  for (const e of streakEntities.values()) {
    if (!(e instanceof K9Pack)) continue;
    for (const d of e.dogs) {
      if (d?.alive) list.push({ id: `k9:${e.id}:${d.i}`, team: e.team, alive: true, pos: d.pos, groundY: d.pos.y, yaw: d.yaw, dog: true });
    }
  }
  return list;
}

/* Someone else's shot, as seen and heard from here: their real gun's report
   (it used to be one generic rifle for every weapon in the room), a muzzle
   flash, and a tracer that follows the round's actual path so you can tell
   where fire is coming from. The tracer is cosmetic — hits are decided by
   whoever fired. `range`: the tracer ends there without a wall strike of its
   own (a bot miss we host has already drawn its impact, see onBotShoot). */
export function remoteShotFx(origin, dir, weaponId, quiet = false, charge = 0, range = 0) {
  let base = WEAPON_DEFS[weaponId] || WEAPON_DEFS.problem416;
  if (charge > 0 && base.charge) base = chargedShotDef(base, charge).def;
  game.audio.shot(quiet ? { ...base, quiet: true } : base, 0.8, origin);
  if (!quiet) game.impactFx.puff(origin, dir.lengthSq() > 0.001 ? dir.clone().normalize() : null);
  if (dir.lengthSq() < 0.001) return;
  // The Soul Blazer's fire out of someone else's skull (not across the map).
  if (base.hellfire && origin.distanceToSquared(game.camera.position) < 70 * 70) {
    hellfire.burst(origin.clone().addScaledVector(dir.clone().normalize(), 0.45), dir.clone().normalize(), 0.8);
  }
  const pellets = Math.min(base.pellets || 1, 4);   // a few pellets read as buckshot
  for (let i = 0; i < pellets; i++) {
    const d = dir.clone().normalize();
    if (pellets > 1) {
      d.x += (Math.random() - 0.5) * (base.pelletSpread || 0.1);
      d.y += (Math.random() - 0.5) * (base.pelletSpread || 0.1);
      d.normalize();
    }
    game.bullets.spawn({ origin: origin.clone().addScaledVector(d, 0.6), dir: d, def: base, ownerId: "remote", cosmetic: true,
      range: range > 0 ? Math.max(0.1, range - 0.6) : 0 });
  }
}

const _botMuzzle = new THREE.Vector3();
const _botAim = new THREE.Vector3();
const _botMiss = new THREE.Vector3();
const _botMissNormal = new THREE.Vector3();

/* A missed round has to land somewhere you can see. A miss used to be a
   tracer nudged off to one side and nothing more, so a bot that missed read
   as one that never fired. The round's line from the muzzle is cast against
   the map and the ground; the dust goes up where it strikes, within this
   far. */
const MISS_RAY = 60;

/* Where a round from `origin` along `dir` lands: metres to the first wall
   (game.colliders) or the ground plane, or MISS_RAY if it hits nothing. */
export function botMissDistance(origin, dir) {
  let d = raycastWorld(game.colliders, origin, dir, MISS_RAY);
  if (dir.y < -1e-4) d = Math.min(d, origin.y / -dir.y);
  return d;
}

export function onBotShoot(bot, target, dmg, isHead, hit, range = 30, usingSecondary = false) {
  const wid = (usingSecondary ? bot.secondaryId : bot.weaponId) || "problem416";
  if (royale) {
    dmg = royaleBotDamage(bot, dmg);
    royaleNoise(bot.pos.x, bot.pos.z, bot.id);
  }

  // The round's visible path: at the target's chest on a hit, off to one
  // side on a miss, by the tier's missSpread (bots.js DIFFICULTY). Played
  // here (we host the bot) and sent to the room, which previously neither
  // saw nor heard bots fire at all.
  const fwdX = -Math.sin(bot.yaw), fwdZ = -Math.cos(bot.yaw);
  _botMuzzle.set(bot.pos.x + fwdX * 0.5, bot.pos.y + 1.45, bot.pos.z + fwdZ * 0.5);
  _botAim.set(target.pos.x, (target.groundY ?? target.pos.y ?? 0) + (isHead ? 1.6 : 1.2), target.pos.z);
  if (!hit) {
    const [lo, hi] = bot.diff?.missSpread || [0.6, 1.6];
    const side = (lo + Math.random() * (hi - lo)) * (Math.random() < 0.5 ? -1 : 1);
    _botAim.x += fwdZ * side;
    _botAim.z -= fwdX * side;
    _botAim.y += (Math.random() - 0.4) * 0.6;
  }
  const dir = _botAim.clone().sub(_botMuzzle).normalize();
  // A miss lands: the same dust a player's round throws off a wall
  // (game.js onWorldHit), where this round's line meets the map. The
  // tracer runs to that point and no further. Everyone else gets the same
  // origin and direction, so their own copy of the tracer strikes the same
  // spot and draws it there too. Nothing within MISS_RAY: the tracer alone.
  let landed = 0;
  if (!hit) {
    const d = botMissDistance(_botMuzzle, dir);
    if (d < MISS_RAY) {
      landed = d;
      _botMiss.copy(_botMuzzle).addScaledVector(dir, d);
      const ground = _botMiss.y < 0.02;
      _botMissNormal.set(0, 1, 0);
      if (!ground) _botMissNormal.copy(dir).negate();
      game.impactFx.hit(_botMiss, { normal: _botMissNormal.clone(), dir: dir.clone(), surface: ground ? "ground" : "concrete", scale: 0.6 });
      game.audio.impact(_botMiss);
    }
  }
  // The tracer always gets an end, so it never flies on across the island
  // tested against every wall (ballistics.js): the target on a hit, the
  // strike or MISS_RAY on a miss.
  const reach = hit ? _botAim.distanceTo(_botMuzzle) : (landed || MISS_RAY);
  remoteShotFx(_botMuzzle, dir, wid, false, 0, reach);
  game.killcam.noteShot(game.kcClock, bot.id, _botMuzzle, dir, wid);
  noteRigShot(bot.id);
  if (game.net.active) game.net.reportShotAs(bot.id, _botMuzzle, dir, wid);

  if (!hit) {
    if (target.id === game.net.id) game.nearMiss(0.45, bot.pos);
    return;
  }
  botDealDamage(bot, target.id, dmg, isHead, wid);
}

/* Bots shoot enemy aircraft (user): when nobody on the ground has their
   attention (no enemy seen for a moment), a bot turns its gun on the
   nearest enemy aircraft it can see within BOT_AA_RANGE and fires at its
   own rate and accuracy, harder to hit the smaller and faster it is. The
   rounds are drawn and sent like any bot shot; damage goes to the
   aircraft's owner (damageStreakEntity). SAM Turrets on the ground count
   too. */
const BOT_AA_RANGE = 85;
const BOT_AA_SIZE = { drone: 0.35, dragonfire: 0.55, heli: 0.95, recon: 0.6, sam: 1 };
const _aaEye = new THREE.Vector3(), _aaDir = new THREE.Vector3();
function botAirTargets(b) {
  const list = enemyAirFor(b.team, b.id).filter((a) => !(a.e instanceof VtolWarship));
  const ffa = !!game.currentMode().ffa;
  for (const e of streakEntities.values()) {
    if (!(e instanceof SamTurret) || !e.alive) continue;
    const owner = e.botId || (e.owned ? game.net.id : null);
    if (ffa ? owner !== b.id : (e.botTeam || e.team) !== b.team) list.push({ id: e.id, pos: e.pos.clone().setY(e.pos.y + 1.1), e });
  }
  return list;
}
export function updateBotAntiAir(dt) {
  if (isStaging()) return;
  for (const b of game.bots.bots) {
    if (!b.alive || b.airborne || b.meleeOnly || b.piloting || botBusy(b) || b.reloadT > 0) { b.aa = null; b.aaUp = false; continue; }
    if (b.lastSeen && b.lastSeen.age < 1.2) { b.aa = null; b.aaUp = false; continue; }   // busy with people
    if (b.launcher && b.aaMissiles > 0) { botLauncher(b, dt); continue; }
    b.aaT = (b.aaT || 0) - dt;
    _aaEye.set(b.pos.x, (b.groundY ?? b.pos.y) + 1.5, b.pos.z);
    if (!b.aa || b.aaT <= -1.5) {
      // Re-pick now and then: the nearest one in the clear.
      let best = null, bestD = BOT_AA_RANGE;
      for (const a of botAirTargets(b)) {
        const d = a.pos.distanceTo(_aaEye);
        if (d > bestD) continue;
        _aaDir.copy(a.pos).sub(_aaEye).divideScalar(d);
        if (raycastWorld(game.colliders, _aaEye, _aaDir, d) < d - 1.5) continue;
        best = a; bestD = d;
      }
      b.aa = best ? { id: best.id } : null;
      b.aaT = Math.max(0, b.aaT);
    }
    if (!b.aa) continue;
    const a = botAirTargets(b).find((x) => x.id === b.aa.id);
    if (!a) { b.aa = null; continue; }
    // Face it; the reaction beat before the first round.
    b.yaw = Math.atan2(-(a.pos.x - b.pos.x), -(a.pos.z - b.pos.z));
    b.pitch = Math.atan2(a.pos.y - _aaEye.y, Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z));
    if (b.aaT > 0) continue;
    const diff = b.diff || {};
    b.aaT = (diff.interval ?? 0.85) * (0.8 + Math.random() * 0.4);
    const kind = a.e instanceof HunterDrone ? "drone" : a.e instanceof Dragonfire ? "dragonfire" : a.e instanceof HelicopterGunship ? "heli" : a.e instanceof SamTurret ? "sam" : "recon";
    const d = a.pos.distanceTo(_aaEye);
    const hit = Math.random() < (diff.hit ?? 0.45) * BOT_AA_SIZE[kind] * Math.max(0.35, 1 - d / 140);
    const fwdX = -Math.sin(b.yaw), fwdZ = -Math.cos(b.yaw);
    _botMuzzle.set(b.pos.x + fwdX * 0.5, _aaEye.y - 0.05, b.pos.z + fwdZ * 0.5);
    _botAim.copy(a.pos);
    if (!hit) { _botAim.x += (Math.random() - 0.5) * 4; _botAim.y += (Math.random() - 0.5) * 3; _botAim.z += (Math.random() - 0.5) * 4; }
    const dir = _botAim.clone().sub(_botMuzzle).normalize();
    const wid = b.weaponId || "problem416";
    remoteShotFx(_botMuzzle, dir, wid);
    noteRigShot(b.id);
    if (game.net.active) game.net.reportShotAs(b.id, _botMuzzle, dir, wid);
    if (hit) {
      game.spawnImpactBurst(a.pos, 0xffd08a, 4);
      damageStreakEntity(a.e, diff.damage ?? 17, b.id);
    }
  }
}

/* A bot with the FHJ-18 (FHJ18.md): the nearest enemy aircraft or SAM
   Turret in the clear within BOT_LAUNCHER_RANGE, and nobody on it: up on
   the shoulder, held on it while it locks (1.2 s for the best, longer for
   the rest), one missile, and down again while the next goes in. Its
   missiles fly and count like ours (combat/launcher.js launchAa), the kill
   is the bot's. */
const BOT_LAUNCHER_RANGE = 140;
const BOT_LAUNCHER_RELOAD = 3.2;
function botLauncher(b, dt) {
  b.aaT = (b.aaT || 0) - dt;
  _aaEye.set(b.pos.x, (b.groundY ?? b.pos.y) + 1.5, b.pos.z);
  const list = aaTargetsFor(b.team, b.id);
  let a = b.aa ? list.find((x) => x.id === b.aa.id) : null;
  if (!a && b.aaT <= 0) {
    let best = null, bestD = BOT_LAUNCHER_RANGE;
    for (const t of list) {
      const d = t.pos.distanceTo(_aaEye);
      if (d > bestD || d < 4) continue;
      _aaDir.copy(t.pos).sub(_aaEye).divideScalar(d);
      if (raycastWorld(game.colliders, _aaEye, _aaDir, d) < d - 2) continue;
      best = t; bestD = d;
    }
    a = best;
    b.aa = best ? { id: best.id, lockT: 0 } : null;
    b.aaT = best ? 0 : 1;
  }
  if (!a) { b.aa = null; b.aaUp = b.aaT > 0.4 && b.aaUp; return; }
  b.aaUp = true;
  b.yaw = Math.atan2(-(a.pos.x - b.pos.x), -(a.pos.z - b.pos.z));
  b.pitch = Math.atan2(a.pos.y - _aaEye.y, Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z));
  if (b.aaT > 0) return;   // the next one's still going in
  // Locking: the best (hit 0.6+) in 1.2 s, a recruit in about 2.
  const lockSecs = 1.2 + Math.max(0, 0.6 - (b.diff?.hit ?? 0.45)) * 2.5;
  b.aa.lockT += dt;
  if (b.aa.lockT < lockSecs) return;
  _aaDir.copy(a.pos).sub(_aaEye).normalize();
  _aaDir.y += 0.05;
  _botMuzzle.copy(_aaEye).addScaledVector(_aaDir, 0.6);
  launchAa(_botMuzzle, _aaDir.normalize(), a.id, a.need, b.id);
  noteRigShot(b.id);
  b.aaMissiles--;
  b.aa = null;
  b.aaT = BOT_LAUNCHER_RELOAD;
}

/* Damage a bot we host deals to anyone: us, another of our bots, or a remote
   player (who applies it to themselves when the hit arrives). */
export function botDealDamage(bot, targetId, dmg, isHead, wid) {
  if (targetId === game.net.id) { damagePlayer(dmg, bot.id, wid, isHead); return; }
  if (typeof targetId === "string" && targetId.startsWith("k9:")) {
    const j = targetId.lastIndexOf(":");
    const pack = streakEntities.get(targetId.slice(3, j));
    if (pack instanceof K9Pack) damageDog(pack, +targetId.slice(j + 1), dmg, bot.id);
    return;
  }
  flinchPeer(targetId, bot.id, isHead);

  const hit = game.bots.byId(targetId);
  if (hit) {
    // Troll Royale: bot on bot, by the pace director (royale.js royaleBotHit),
    // whatever did it: a gun, a streak, a crate.
    if (royale) dmg = royaleBotHit(bot, hit, dmg);
    const { killed, bot: victim } = game.bots.applyHit(targetId, dmg, { explosive: isExplosive(wid) });
    if (killed) {
      bot.kills++;
      bot.killedAt = performance.now();   // Troll Royale's post-kill calm (modes/royale.js)
      game.net.reportDeathAs(targetId, bot.id, wid, isHead);
      registerDeath(victim.name, bot.id, wid, {
        head: isHead, victimTeam: victim.team, victimIsBot: true,
        victimPos: victim.pos, victimWeaponId: victim.weaponId,
      });
    }
    return;
  }
  game.net.reportHitAs(bot.id, targetId, dmg, isHead, wid);
}
