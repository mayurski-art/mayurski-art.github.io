// Troll Forces — Kabukigrin's pachinko parlour in Socialize (user,
// 2026-10-24: "the pachinko should be playable and npcs and users should be
// able to enter in and out of its building").
//
// The room is the map's (maps/kabukigrin-street.js: Blender's room behind
// the glass, its colliders, the doors, the machines' screens and sound).
// Here, once a Socialize match is on it: the doors' collider goes, the
// bounds take in the room, the doors slide open. Then each frame: which
// machines are in play, ours (sat on its stool: hold X, social-rp.js's
// seats) and the room's (players on theirs, the NPCs at theirs). Ours
// spins fast and rattles; a hit (about once a minute) runs the rainbow and
// the fanfare, and the banner says so. Cosmetic: nothing is won or lost.

import { game } from "../core/state.js?v=st1";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2";
import { rpSeats, seated } from "./social-rp.js?v=rp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-kb0-kb1-kb2-kb3-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mg1-kb12-tm2-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb2-jb3-jb4-jb5-jb6-sp1-hh1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2";

let openedFor = null;
export function updatePachinko() {
  const rp = game.builtMap?.map?.rp;
  const P = rp?.pachinko?.();
  if (!P) return;
  const { play } = P;
  if (openedFor !== game.builtMap) {
    openedFor = game.builtMap;
    const i = game.colliders.findIndex((c) => c.pachinkoDoor);
    if (i >= 0) game.colliders.splice(i, 1);
    game.ARENA.minX = Math.min(game.ARENA.minX, P.minX);
    play.open = true;
    play.onJackpot = () => showWaveBanner("大当たり! Jackpot", 2400);
    play.npc = new Set();
  }
  // the NPCs sat at machines play all night (once the town's people are up)
  if (!play.npc.size && game.townNpcs) {
    for (const n of game.townNpcs.sitters()) {
      const k = P.machines.findIndex((m) => Math.abs(m.x - n.x) < 0.2 && Math.abs(m.stool - n.z) < 0.2);
      if (k >= 0) play.npc.add(k);
    }
  }
  const seats = rpSeats();
  play.mine = seated?.s.kind === "pachinko" ? seated.s.machine : -1;
  play.others.clear();
  for (const k of play.npc) play.others.add(k);
  for (const p of game.net.peers.values()) {
    const s = !game.isBotPeer(p) && p.seat ? seats?.[p.seat - 1] : null;
    if (s?.kind === "pachinko") play.others.add(s.machine);
  }
}
