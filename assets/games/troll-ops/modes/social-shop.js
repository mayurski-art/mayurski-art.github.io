// Troll Forces — Kek & Sons, Troll City's general store (TROLL-CITY-RP2.md,
// phase 2c). There's no money in the game, so it's roleplay: the merchant
// hands goods out, nobody pays.
//
//   - The till: hold X there to mind the store (merchant; Mr. Kek steps
//     off) or to hand it back.
//   - The merchant, by a customer: hold X to hand them a stetson (if they
//     haven't one) or a canteen (if their hands are empty). Only a
//     merchant's handouts are taken (role-gated, like the doctor's cure).
//   - The apple barrel by the door: anyone, empty-handed, takes an apple
//     (bites with fire, like a sip; or give it to someone, like a drink).
//
// A stetson is worn for the session (`mt` on the state packet, so everyone
// sees it; modes/social-conductor.js puts the hat on: a job's hat first).
// The canteen and the apple are drinks (saloon-bar.js kinds), so they
// already ride the hand, the wire (`dk`) and handing over.

import { game } from "../core/state.js?v=st1";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2";
import { bar, otherWithRole, rpExtras, rpListeners, rpNearestPlayer, setBarRole } from "./social-rp.js?v=rp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-kb0-kb1-kb2-kb3-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mg1-kb12-tm2-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb2-jb3-jb4-jb5-jb6-sp1-hh1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-rm1-kzf1";
import { CANTEEN_SIPS, APPLE_BITES } from "../maps/saloon-bar.js?v=sb1b7-cup1-gt1-gt2-cw1-zr10-hr2-zp1-bf1-sr1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-mg1-sp1";

export const SHOP = {
  tillTime: 0.6,     // hold X at the till: mind the store, or hand it back
  giveTime: 0.5,     // the merchant hands something over
  appleTime: 0.35,   // an apple out of the barrel
  reach: 1.3,        // m from the till / the barrel
  handReach: 2.0,    // m to a customer
};

export const shop = { heard: { stetson: 0, canteen: 0 }, gave: 0 };
const spots = () => (game.isSocial() ? game.builtMap?.map?.rp?.shop || null : null);
const near = (p, q, r) => Math.hypot(p.x - q.x, p.z - q.z) < r && Math.abs(p.y - (q.floor ?? p.y)) < 1;

function shopAction() {
  if (!game.isSocial() || !game.player.alive) return null;
  const S = spots();
  if (!S) return null;
  const p = game.move.pos;
  // the merchant, by a customer (first: serving beats handing the store back)
  if (bar.role === "merchant") {
    const rp = rpNearestPlayer(SHOP.handReach);
    if (rp) {
      const name = rp.peer.name || "them";
      const what = !rp.peer.stetson ? "stetson" : !rp.peer.drink ? "canteen" : null;
      if (what) {
        return { key: `shop:${rp.peer.id}:${what}`, label: `Hand ${name} a ${what}`, busy: "Wrapping it…", ctx: "Give", time: SHOP.giveTime,
          done: () => { game.net.publishRp({ k: "shop", e: "give", to: rp.peer.id, what }); shop.gave++; till(null); } };
      }
      return { key: `shop:${rp.peer.id}`, info: true, label: `${name}'s got a hat and full hands` };
    }
  }
  // the till: the job
  if (near(p, S.till, SHOP.reach)) {
    if (bar.role === "merchant") {
      return { key: "till", label: "Hand the store back to Mr. Kek", busy: "Counting the till…", ctx: "Till", time: SHOP.tillTime,
        done: () => setBarRole(null, "Mr. Kek's back behind the counter.") };
    }
    const other = otherWithRole("merchant");
    if (other) return { key: "till", info: true, label: `${other.name || "Someone"} is minding the store` };
    if (bar.role) return { key: "till", info: true, label: "One job at a time" };
    return { key: "till", label: "Mind the store (merchant)", busy: "Tying on the apron…", ctx: "Till", time: SHOP.tillTime,
      done: () => setBarRole("merchant", "You're minding Kek & Sons. Hold X by a customer: a stetson, or a canteen for empty hands.") };
  }
  // the apple barrel: anyone
  if (near(p, S.apples, SHOP.reach) && !bar.drink) {
    return { key: "apple", label: "Take an apple", ctx: "Apple", time: SHOP.appleTime,
      done: () => { bar.drink = { kind: "apple", sips: APPLE_BITES }; showWaveBanner(game.isTouch ? "An apple. Fire takes a bite" : "An apple. Fire takes a bite · G puts it down", 1600); } };
  }
  return null;
}

/* The till's bell and drawer (a sale, even a free one). */
function till(at) {
  const a = game.audio;
  if (!a?._ready?.()) return;
  a._noise({ duration: 0.12, gain: 0.06, type: "bandpass", freq: 900, at });
  a._tone({ freq: 2093, duration: 0.5, gain: 0.07, type: "sine", delay: 0.1, at });
  a._tone({ freq: 2637, duration: 0.6, gain: 0.05, type: "sine", delay: 0.16, at });
}

function onMessage(p, m) {
  if (m.k !== "shop" || m.to !== game.net.id || game.isBotPeer(p) || p.role !== "merchant") return;
  if (m.e !== "give") return;
  const who = p.name || "The merchant";
  if (m.what === "stetson") {
    if (bar.stetson) return;
    bar.stetson = true;
    shop.heard.stetson++;
    till(null);
    showWaveBanner(`${who} hands you a stetson. Looking sharp`, 2000);
  } else if (m.what === "canteen") {
    if (bar.drink) { showWaveBanner(`${who} offers a canteen, but your hands are full`, 1800); return; }
    bar.drink = { kind: "canteen", sips: CANTEEN_SIPS };
    shop.heard.canteen++;
    till(null);
    showWaveBanner(`${who} hands you a canteen. Fire takes a swig`, 2000);
  }
}

/* Each frame in Socialize: the stetson on the wire; out of Troll City, the
   job goes back. */
export function updateShop() {
  if (!spots() && bar.role === "merchant") setBarRole(null, null);
  if (game.net) game.net.stetson = game.isSocial() && bar.stetson ? 1 : 0;
}

rpExtras.push(shopAction);
rpListeners.push(onMessage);

if (typeof window !== "undefined" && /[?&]tohooks=1/.test(location.search)) {
  window.__trollShop = { SHOP, shop, state: () => ({ role: bar.role, stetson: !!bar.stetson, drink: bar.drink && { ...bar.drink }, hat: game.localRig?.jobHatKind || null }) };
}
