// Troll Forces Zombies: the wall-buy prompt (modes/zombies/wallbuys.js).
// Standing at a chalk outline: "Hold X · MTAR · 1,200", the price red when
// you can't afford it, and the hold's bar filling. Otherwise one hint line:
// where your first gun is, or that the gun in your hands is running dry.
// Lives inside the Zombies HUD (#to-zh), under the crosshair.

import { game, match } from "../core/state.js?v=st1";
import { padButtonName } from "../menu/controller-layout.js?v=cl7-pd1-or1-pd2-hb4-xb1-mb2-tn12";
import { canAfford } from "../modes/zombies/economy.js?v=zr5-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-zd1-wb1-mt2-sk1-hb4-lu1-mb1-mb2-gc1-bt1-nft33-nfh1-nfh5-mg2-nft2531-nft2531h-tn13-fs1-fs2-rgb1-bdn1-msk1-tnm1";

/* Two mags or less left in reserve: time to find its wall. */
const LOW_MAGS = 2;

let box = null, line = null, bar = null, hint = null;
const shown = { key: "", hint: "" };

function mount() {
  const root = document.getElementById("to-zh");
  if (!root || box) return !!box;
  box = document.createElement("div");
  box.className = "zb-prompt";
  box.hidden = true;
  box.innerHTML = '<div class="zb-t"></div><div class="zh-down-bar"><i></i></div>';
  line = box.querySelector(".zb-t");
  bar = box.querySelector("i");
  hint = document.createElement("div");
  hint.className = "zb-hint";
  hint.hidden = true;
  root.append(box, hint);
  return true;
}

const keyName = () => (game.isTouch ? "SWAP" : game.gamepadState?.connected ? padButtonName(2) : "X");

/* Every frame of a run. */
export function updateBuyPrompt() {
  if (!mount()) return;
  const zb = match.zombieBuy;
  const wall = zb?.near() || null;
  if (wall) {
    const o = zb.offer(wall);
    const can = o.price === 0 || canAfford(o.price);
    const price = o.price === 0 ? "FREE" : o.price.toLocaleString();
    const what = o.kind === "ammo" ? `${o.name} ammo` : o.name;
    const key = `${keyName()}|${what}|${price}|${can}|${!!o.full}|${o.was || 0}`;
    if (key !== shown.key) {
      shown.key = key;
      line.innerHTML = "";
      if (o.full) line.append(`${what} · full`);
      else {
        const k = document.createElement("b"); k.textContent = `Hold ${keyName()}`;
        const p = document.createElement("span"); p.className = can ? "zb-price" : "zb-price is-poor"; p.textContent = price;
        line.append(k, ` · ${what} · `);
        // Fire Sale: the full price struck through, the half beside it
        if (o.was) { const s = document.createElement("s"); s.className = "zb-was"; s.textContent = o.was.toLocaleString(); line.append(s, " "); }
        line.append(p);
      }
    }
    box.hidden = false;
    bar.style.width = `${Math.round((game.swapHold?.active ? game.swapHold.progress : 0) * 100)}%`;
  } else if (!box.hidden) { box.hidden = true; shown.key = ""; }

  // one hint at a time, and none over the prompt
  let h = "";
  const p = game.player;
  // (and none while the revive prompt is up: it sits just above)
  if (!wall && p?.alive && !p.downed && !document.querySelector(".zh-revive:not([hidden])")) {
    if (p.gunless) h = "Get your gun at the Starter wall";
    else {
      const w = game.currentWeapon?.();
      if (p.holding === "gun" && w && w.ammoReserve <= w.def.magSize * LOW_MAGS) h = w.ammoReserve <= 0 && w.ammoInMag <= 0 ? "Out of ammo · buy more at its wall" : "Low ammo · buy more at its wall";
    }
  }
  if (h !== shown.hint) {
    shown.hint = h;
    hint.textContent = h;
    hint.hidden = !h;
  }
}

export function hideBuyPrompt() {
  if (box) box.hidden = true;
  if (hint) hint.hidden = true;
  shown.key = shown.hint = "";
}
