// Troll Forces — the court games' setup card at Troll Beach (Socialize).
// Hold X at the hoops scoreboard or the umpire's chair and a card comes up
// (the mouse freed, like the Troll-o-Graph): the format (1v1 / 2v2 / 3v3,
// singles / doubles), what the game's to, who fills the empty spots (the
// next on your ladder, the regulars, the legends), then Run it / Play,
// Start a tutorial, the 3-point contest. Other players who hold X at the
// board while the game waits take the bots' spots. The last choices are
// remembered in this browser.
//
// The games (modes/hoops-game.js, social-tennis.js) own what the choices
// mean; this owns the card. style.css .to-court-setup*.

import { game } from "../core/state.js?v=st1";
import { releaseHeldInputs } from "../menu/pause.js?v=pa1-mb1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-tnt1-mb2-gc1-nft33-nfh1-nfh5-mg2-ll2-sp9-nft2531-nft2531h-tn12-tn13-rdf2-kbc3-zft1-pqs1-fbo1-cst1";

const KEY = "tf-court-setup";
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/* What each sport offers. `value` is the default; the chosen one is
   remembered per sport. */
export const SETUP = {
  hoops: {
    title: "Hoops", sub: "Streetball on the south hoop",
    rows: [
      { key: "size", label: "Format", values: [[1, "1v1"], [2, "2v2"], [3, "3v3"]], value: 1 },
      { key: "to", label: "Game to", values: [[11, "11"], [21, "21"]], value: 11 },
      { key: "bots", label: "Empty spots", values: [["ladder", "Next on your ladder"], ["regulars", "The regulars"], ["legends", "The legends"]], value: "ladder" },
    ],
    actions: [["run", "Run it", true], ["tutorial", "Start a tutorial"], ["contest", "3-point contest"]],
    note: "Anyone who holds X at the board while it waits takes a bot's spot. 2s and 1s, win by 2, make it take it.",
  },
  tennis: {
    title: "Tennis", sub: "Centre court by the pier",
    rows: [
      { key: "size", label: "Format", values: [[1, "Singles"], [2, "Doubles"]], value: 1 },
      { key: "to", label: "Tiebreak to", values: [[7, "7"], [10, "10"]], value: 7 },
      { key: "bots", label: "Empty spots", values: [["ladder", "Next on your ladder"], ["pro", "The club pros"], ["ace", "Ace Alvarez"]], value: "ladder" },
    ],
    actions: [["play", "Play", true], ["tutorial", "Start a tutorial"]],
    note: "Anyone who holds X at the chair while it waits takes a bot's spot. Win by 2; sides change at 6.",
  },
};

function saved() { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { return {}; } }
function save(all) { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* storage off */ } }
/* The remembered choices for a sport (the defaults where nothing's saved). */
export function setupChoices(sport) {
  const def = SETUP[sport], got = saved()[sport] || {};
  const out = {};
  for (const r of def.rows) out[r.key] = r.values.some(([v]) => v === got[r.key]) ? got[r.key] : r.value;
  return out;
}

const card = {
  el: null, sport: null, choices: null, onAction: null, wasLocked: false,
  isOpen() { return !!this.el && !this.el.hidden; },
  mount() {
    if (this.el) return;
    const el = document.createElement("div");
    el.className = "to-court-setup";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.hidden = true;
    el.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-row]");
      if (b) { this.pick(b.dataset.row, b.dataset.i | 0); return; }
      const a = e.target.closest("button[data-action]");
      if (a) { const k = a.dataset.action; const ch = { ...this.choices }; this.close(); if (k !== "close") this.onAction?.(k, ch); return; }
      if (e.target === el) this.close();   // the backdrop
    });
    window.addEventListener("keydown", (e) => {
      if (!this.isOpen() || e.code !== "Escape") return;
      e.preventDefault(); e.stopImmediatePropagation();
      this.close();
    }, true);
    (game.els?.hud || document.body).appendChild(el);
    this.el = el;
  },
  open(sport, onAction, extra = {}) {
    this.mount();
    releaseHeldInputs();
    this.wasLocked = !game.isTouch && !!document.pointerLockElement;
    if (this.wasLocked) game.controls?.unlock?.();
    this.sport = sport; this.onAction = onAction;
    this.choices = setupChoices(sport);
    const d = SETUP[sport];
    const rows = d.rows.map((r) => `<div class="to-court-setup__row" data-key="${r.key}"><span class="to-court-setup__label">${esc(r.label)}</span><div class="to-court-setup__seg">${r.values.map(([v, l], i) => `<button type="button" data-row="${r.key}" data-i="${i}" aria-pressed="${v === this.choices[r.key]}">${esc(l)}</button>`).join("")}</div></div>`).join("");
    const actions = d.actions.filter(([k]) => !(extra.hide || []).includes(k)).map(([k, l, primary]) => `<button type="button" data-action="${k}" class="${primary ? "is-primary" : ""}">${esc(l)}</button>`).join("");
    this.el.setAttribute("aria-label", `${d.title} setup`);
    this.el.innerHTML = `<div class="to-court-setup__card">
      <div class="to-court-setup__head"><b>${esc(d.title)}</b><span>${esc(extra.sub || d.sub)}</span><button type="button" data-action="close" aria-label="Close">Close <kbd>Esc</kbd></button></div>
      ${rows}
      <p class="to-court-setup__note">${esc(extra.note || d.note)}</p>
      <div class="to-court-setup__actions">${actions}</div>
    </div>`;
    this.el.hidden = false;
    this.el.querySelector("button.is-primary")?.focus();
  },
  pick(key, i) {
    const r = SETUP[this.sport].rows.find((x) => x.key === key);
    if (!r) return;
    this.choices[key] = r.values[i][0];
    const all = saved(); all[this.sport] = { ...(all[this.sport] || {}), [key]: this.choices[key] }; save(all);
    for (const b of this.el.querySelectorAll(`button[data-row="${key}"]`)) b.setAttribute("aria-pressed", String((b.dataset.i | 0) === i));
  },
  close() {
    if (!this.isOpen()) return;
    this.el.hidden = true;
    this.el.innerHTML = "";
    releaseHeldInputs();
    if (this.wasLocked && game.gameState === "playing") game.controls?.lock?.();
  },
};
export const openCourtSetup = (sport, onAction, extra) => card.open(sport, onAction, extra);
export const closeCourtSetup = () => card.close();
export const courtSetupOpen = () => card.isOpen();

if (typeof window !== "undefined" && /[?&]tohooks=1/.test(location.search)) {
  window.__trollCourtSetup = { SETUP, open: openCourtSetup, close: closeCourtSetup, choices: setupChoices, pick: (k, i) => card.pick(k, i), act: (k) => card.el?.querySelector(`button[data-action="${k}"]`)?.click(),
    state: () => ({ open: card.isOpen(), sport: card.sport, choices: card.choices, buttons: card.el ? [...card.el.querySelectorAll("button[data-action]")].map((b) => b.dataset.action) : [] }) };
}
