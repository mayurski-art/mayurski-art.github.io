// Troll Forces — Troll City's Troll-o-Graphs: three brass-and-walnut
// "computers" in the town hall's clerk's office (maps/trollcity-hall.js
// COMPUTERS; the machines themselves are Studio props). Hold X in front of
// one (the phone's swap button) and its screen fills the view:
//
//   - trolltruths.com lets itself be framed, so it opens right here, in the
//     game (troll-ops.html's CSP lets it in: frame-src).
//   - OpenSea and trollface.io refuse framing (X-Frame-Options DENY), so the
//     screen offers the real site in a new tab; the click is the player's,
//     so no popup blocker stops it, and the game keeps running behind it.
//
// The front hall's donation kiosk works the same way (the home page's Donate
// wallet, finance.trollrunner.net, in a new tab). Esc or Close puts the
// screen away. Nothing goes over the wire: it's each
// player's own screen.

import { game } from "../core/state.js?v=st1";
import { rpExtras } from "./social-rp.js?v=rp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-kb0-kb1-kb2-kb3-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mg1-kb12-tm2-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb2-jb3-jb4-jb5-jb6-sp1-hh1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9";
import { releaseHeldInputs } from "../menu/pause.js?v=pa1-mb1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9";

export const COMPUTER = {
  useTime: 0.35,   // hold X to switch it on
  reach: 1.1,      // m from the spot in front of the machine
};

const spots = () => (game.isSocial() ? game.builtMap?.map?.rp?.computers || null : null);
const near = (p, q, r) => Math.hypot(p.x - q.x, p.z - q.z) < r && Math.abs(p.y - (q.floor ?? p.y)) < 1;

function computerAction() {
  if (!game.isSocial() || !game.player.alive || screen.isOpen()) return null;
  const list = spots();
  if (!list) return null;
  const p = game.move.pos;
  const c = list.find((q) => near(p, q, COMPUTER.reach));
  if (!c) return null;
  return { key: `computer:${c.key}`, label: c.label || `Use the Troll-o-Graph: ${c.name}`, ctx: "Use", time: COMPUTER.useTime, done: () => screen.open(c) };
}

/* The screen: the site framed (trolltruths) or a card that opens it in a new
   tab (the rest). Frees the mouse like the sheriff's wanted board; the
   pause menu leaves it be (menu/buttons.js looks for .troll-o-graph). */
const screen = {
  el: null, wasLocked: false, at: null,
  isOpen() { return !!this.el && !this.el.hidden; },
  mount() {
    if (this.el) return;
    const el = document.createElement("div");
    el.className = "troll-o-graph";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.hidden = true;
    el.style.cssText = "position:absolute;inset:max(10px,3vh) max(10px,3vw);z-index:30;pointer-events:auto;display:flex;flex-direction:column;"
      + "background:#1c140c;border:2px solid #b8862e;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.6),inset 0 0 0 4px #3a2814;overflow:hidden;"
      + "color:#f4e8cf;font:600 14px/1.35 'DM Sans',sans-serif";
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) this.close();
      else if (e.target.closest("a[data-out]")) setTimeout(() => this.close(), 0);   // the tab opens, the screen goes away
    });
    window.addEventListener("keydown", (e) => {
      if (!this.isOpen() || e.code !== "Escape") return;
      e.preventDefault(); e.stopImmediatePropagation();
      this.close();
    }, true);
    (game.els.hud || document.body).appendChild(el);
    this.el = el;
  },
  open(c) {
    this.mount();
    releaseHeldInputs();
    this.wasLocked = !game.isTouch && !!document.pointerLockElement;
    if (this.wasLocked) game.controls?.unlock?.();
    this.at = c.key;
    const host = new URL(c.url).host;
    const bar = `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px 8px 14px;background:linear-gradient(#5a3e1c,#3a2814);border-bottom:1px solid #b8862e">`
      + `<span style="font:800 15px/1 'DM Sans',sans-serif;letter-spacing:.06em;color:#e8c868;text-transform:uppercase">${esc(c.title || "Troll-o-Graph")}</span>`
      + `<span style="font:500 13px/1 'DM Mono',monospace;opacity:.8;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(host)}</span>`
      + `<button type="button" data-close="1" aria-label="Close the Troll-o-Graph" style="padding:7px 14px;border-radius:10px;border:0.5px solid rgba(232,200,104,.6);background:rgba(0,0,0,.25);color:#f4e8cf;font:inherit;cursor:pointer">Close <kbd style="font:inherit;opacity:.7">Esc</kbd></button></div>`;
    const body = c.frame
      ? `<iframe title="${esc(c.name)}" src="${esc(c.url)}" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox" style="flex:1;width:100%;border:0;background:#fff"></iframe>`
      : `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;background:radial-gradient(circle at 50% 40%,#1f3a22,#0c1a0e);color:#9cf0a8;font:500 15px/1.5 'DM Mono',monospace">`
        + `<div style="font:800 20px/1.2 'DM Sans',sans-serif;color:#c8f8d0">${esc(c.name)}</div>`
        + `<div style="max-width:30em;opacity:.85">${esc(c.note || "This one won't show inside the game, so it opens in a new tab. The game keeps running here.")}</div>`
        + `<a data-out="1" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer" style="margin-top:6px;padding:12px 22px;border-radius:12px;background:#e8c868;color:#1c1208;font:800 16px/1 'DM Sans',sans-serif;text-decoration:none">Open ${esc(host)}</a></div>`;
    this.el.setAttribute("aria-label", `${c.title || "Troll-o-Graph"}: ${c.name}`);
    this.el.innerHTML = bar + body;
    this.el.hidden = false;
    (this.el.querySelector("a[data-out]") || this.el.querySelector("button"))?.focus();
  },
  close() {
    if (!this.isOpen()) return;
    this.el.hidden = true;
    this.el.innerHTML = "";   // the framed site stops (sound, timers)
    this.at = null;
    releaseHeldInputs();
    if (this.wasLocked && game.gameState === "playing") game.controls?.lock?.();
  },
};
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
export const computerOpen = () => screen.isOpen();

/* Each frame in Socialize: out of Troll City (or dead), the screen goes. */
export function updateComputers() {
  if (screen.isOpen() && (!spots() || !game.player.alive)) screen.close();
}

rpExtras.push(computerAction);

if (typeof window !== "undefined" && /[?&]tohooks=1/.test(location.search)) {
  window.__trollComputers = { COMPUTER, screen, state: () => ({ open: screen.isOpen(), at: screen.at, html: screen.el?.innerHTML || "" }) };
}
