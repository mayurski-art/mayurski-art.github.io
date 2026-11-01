// Troll Forces Socialize: Kabukigrin's bar service (docs/KB-BAR-SERVICE.md 3).
//
// Sat on one of the club's bar stools (a seat with `bar`, kabukigrin-
// social.js) with empty hands, hold X: a short menu card comes up (1-4, or
// a tap). Pick one and the nearest bartender turns to you and pours; the
// glass lands in your hand as the saloon's drinks do (social-rp.js bar.drink:
// fire sips, G sets it down), and what each sip does to you is saloon-bar.js
// TIPSY.perSip. Free, one at a time.
//
// `orderDrink(player, drinkId)` is the way in for anyone else who serves
// (North's dialogue): "me" and one of KB_DRINKS' ids.

import { game } from "../core/state.js?v=st1";
import { bar, rpExtras, seated } from "./social-rp.js?v=rp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-kb0-kb1-kb2-kb3-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mg1-kb12-tm2-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb2-jb3-jb4-jb5-jb6-sp1-hh1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-jx2-jx3-jx4-jx5-mb1-mb2-gc1-nft33-nfh1-nfh5-mg2-ll2-sp9-nft2531-nft2531h-tn12-tn13-rdf2-kbc3";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2-sk1-hb4-lu1-mb1-mb2-gc1-bt1-nft33-nfh1-nfh5-mg2-nft2531-nft2531h-kbc1-kbc2-kbc3";
import { drinkMax, poseDrinkArm } from "../maps/saloon-bar.js?v=sb1b7-cup1-gt1-gt2-cw1-zr10-hr2-zp1-bf1-sr1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-mg1-sp1-mb1-mb2-nft2531-kbc1-kbc2-kbc3";
import { releaseHeldInputs } from "../menu/pause.js?v=pa1-mb1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-tnt1-mb2-gc1-nft33-nfh1-nfh5-mg2-ll2-sp9-nft2531-nft2531h-tn12-tn13-rdf2-kbc3";

export const KB_DRINKS = [
  { id: "sake", name: "Sake", note: "warm, one cup, hits quick", key: "1" },
  { id: "highball", name: "Highball", note: "whisky, soda, a wheel of lemon", key: "2" },
  { id: "sour", name: "Grin Sour", note: "the house special. It glows", key: "3" },
  { id: "tea", name: "Green tea", note: "steadies you a touch", key: "4" },
];
export const KB_BAR = { pour: 1.2, turnBack: 2.4 };   // seconds: the pour, and the bartender's attention after

export const kbBar = { open: false, pouring: null, el: null, keys: null };

const atBar = () => !!(seated?.s.bar && game.player.alive);
const byId = (id) => KB_DRINKS.find((d) => d.id === id) || null;

/* ------------------------------------------------------------- the card */

function build() {
  const el = document.createElement("div");
  el.className = "to-kb-menu";
  el.hidden = true;
  el.setAttribute("role", "menu");
  el.setAttribute("aria-label", "Order a drink");
  el.innerHTML = `<div class="to-kb-menu-head"><span>Kabukigrin bar</span><span class="to-kb-menu-hint">${game.isTouch ? "tap one" : "1-4 · Esc closes"}</span></div>`
    + KB_DRINKS.map((d) => `<button type="button" class="to-kb-menu-row" data-id="${d.id}" role="menuitem"><span class="to-kb-menu-key">${d.key}</span><span class="to-kb-menu-name">${d.name}</span><span class="to-kb-menu-note">${d.note}</span></button>`).join("");
  for (const ev of ["mousedown", "pointerdown", "touchstart"]) el.addEventListener(ev, (e) => e.stopPropagation());
  el.addEventListener("click", (e) => { const id = e.target.closest("[data-id]")?.dataset.id; if (id) orderDrink("me", id); });
  game.els.hud.appendChild(el);
  kbBar.el = el;
  // keys while it's open belong to it
  kbBar.keys = (e) => {
    if (!kbBar.open) return;
    const d = KB_DRINKS.find((x) => e.code === `Digit${x.key}` || e.code === `Numpad${x.key}`);
    if (!d && e.code !== "Escape") return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.repeat) return;
    if (d) orderDrink("me", d.id); else closeMenu();
  };
  window.addEventListener("keydown", kbBar.keys, true);
}
export function openMenu() {
  if (!kbBar.el) build();
  if (kbBar.open) return;
  releaseHeldInputs();
  kbBar.el.hidden = false;
  kbBar.open = true;
}
export function closeMenu() {
  if (!kbBar.open) return;
  kbBar.open = false;
  if (kbBar.el) kbBar.el.hidden = true;
}

/* ------------------------------------------------------------ ordering */

/* Order for `player` ("me": the local player; peers order on their own
   tabs). True if the bartender took it; false, with a banner saying why,
   if not (not on a bar stool, hands full, one already coming). */
export function orderDrink(player, drinkId) {
  const d = byId(drinkId);
  if (player !== "me" || !d) return false;
  if (!atBar()) { showWaveBanner("Take a seat at the bar first", 1600); return false; }
  if (bar.drink) { showWaveBanner("Your hands are full. G sets it down", 1600); return false; }
  if (kbBar.pouring) return false;
  closeMenu();
  kbBar.pouring = { id: d.id, t: 0, npc: takeBartender() };
  game.audio.brassTinkle?.(2);
  return true;
}

/* The nearest bartender turns to us and pours: his loop is ours for the
   pour and a moment after (town-npcs.js takeOver / release). */
function takeBartender() {
  const T = game.townNpcs, s = seated?.s;
  if (!T || !s) return null;
  let best = -1, bestD = 6;
  T.list.forEach((n, i) => {
    if (n.c.role !== "Bartender" || n.off || n.override) return;
    const d = Math.hypot(n.x - s.x, n.z - s.z);
    if (d < bestD) { best = i; bestD = d; }
  });
  if (best < 0) return null;
  const n = T.takeOver(best, (npc, rig) => {
    npc.moving = false;
    const P = kbBar.pouring;
    // the arm out over the bar while the glass fills
    if (P?.npc === n) poseDrinkArm(rig, 0, Math.sin(Math.min(1, P.t / KB_BAR.pour) * Math.PI), true);
  });
  if (n) { n.yaw = Math.atan2(-(s.x - n.x), -(s.z - n.z)); n.kbBack = KB_BAR.pour + KB_BAR.turnBack; n.kbIdx = best; }
  return n;
}

export function updateKbBar(dt) {
  if (!game.isSocial()) { if (kbBar.open) closeMenu(); kbBar.pouring = null; return; }
  if (kbBar.open && (!atBar() || bar.drink)) closeMenu();
  const P = kbBar.pouring;
  if (P) {
    P.t += dt;
    if (P.t >= KB_BAR.pour) {
      kbBar.pouring = null;
      if (atBar() && !bar.drink) {
        const d = byId(P.id);
        bar.drink = { kind: d.id, sips: drinkMax(d.id) };
        game.audio.brassTinkle?.(4);
        showWaveBanner(`${d.name}. ${game.isTouch ? "Fire sips" : "Click to sip"}${d.id === "tea" ? ", slowly" : ""}`, 1600);
      }
    }
  }
  // the bartender's attention runs out; back to his loop
  for (const n of game.townNpcs?.list || []) {
    if (!(n.kbBack > 0)) continue;
    n.kbBack -= dt;
    if (n.kbBack <= 0) { n.kbBack = 0; game.townNpcs.release(n.kbIdx); }
  }
}

/* Hold X on a bar stool: the menu. Asked before the saloon's own actions. */
rpExtras.push(() => {
  if (!atBar() || bar.drink || (game.net?.dz | 0) >= 2) return null;   // not while passing out (modes/drunk.js)
  if (kbBar.pouring) return { key: "kb-pour", label: "Pouring…", info: true };
  if (kbBar.open) return { key: "kb-menu", label: "Pick a drink", info: true };
  return { key: "kb-order", label: "Order a drink", ctx: "Order", time: 0.3, done: openMenu };
});

window.__trollKbBar = { KB_DRINKS, KB_BAR, kbBar, orderDrink, openMenu, closeMenu };
