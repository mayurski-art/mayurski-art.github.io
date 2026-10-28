// Troll Forces Zombies: the run's HUD, laid out like Roblox's Zombie Rush
// Survival (refs/zombie-rush/ingame-hud-wave11.jpg): the wave and how many
// are left to go at the top, the Upgrades column down the left, cash in
// the bottom-left corner with the last gain over it, "+$15 ZOMBIE KILL"
// lines over the health bar, a big "Wave 7" as each wave starts, and the
// skip button through the break. Built into #to-hud once, shown only in a
// run (body.to-zombies hides the stock wave/hostiles/points boxes).
//
// The cards are buttons (tap on touch); on a keyboard 4 / 5 / 6 buy them
// and K skips the break. The numbers sit on the cards like the weapon
// bar's slot numbers.
//
// The Deployables column down the right (P2): 7 / 8 / 9 or a tap picks one
// to place, held picks it in grid mode. While placing, a chip up top says
// what and has Place / Cancel (a click places on a keyboard, a right click
// cancels; a second tap on the card places on touch).

import { game } from "../core/state.js?v=st1";
import { padHooks } from "../input/gamepad.js?v=in1-fu1b7-wb1-th2-ar1-ar2-cl1-bp1-fj1-zr10-zc1-zc2-zp1-aa0-pd1-nf1-or1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-spd1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-fp2-lk1-ugb1-ug1-ug2-ug3";

let root = null;
let hooks = { onBuy: () => {}, onSkip: () => {}, onDeploy: () => false, onPlace: () => false, onCancel: () => {} };
const els = {};
const shown = { wave: -1, left: -1, cash: -1, gain: -1, offers: "", deploy: "", placing: "", boss: "", bossK: -1, between: null, breakS: -1, downed: null, downS: -1, kills: -1, vote: "", revive: "", reviveK: -1 };

const ICONS = {
  health: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 41 8 25a9 9 0 0 1 13-13l3 3 3-3a9 9 0 0 1 13 13Z" fill="#ff3b4a" stroke="#5a0c12" stroke-width="2.5"/><path d="M33 8v8m-4-4h8" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/></svg>',
  gun: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M5 18h30l3-3h5v7h-6l-2 3H22l-3 11h-7l2-11H5z" fill="#2b2f36" stroke="#0b0d10" stroke-width="2" stroke-linejoin="round"/><path d="M24 25l-1 5h5" fill="none" stroke="#0b0d10" stroke-width="2"/></svg>',
  melee: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 41 31 13c3-4 9-2 8 3L15 44Z" fill="#9b6b3c" stroke="#3a220f" stroke-width="2.5" stroke-linejoin="round"/><path d="M9 41l4 3" stroke="#1d1209" stroke-width="5" stroke-linecap="round"/></svg>',
  turret: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 30v10M24 40l-9 5M24 40l9 5" stroke="#1d2025" stroke-width="3.5" stroke-linecap="round"/><rect x="13" y="16" width="20" height="14" rx="3" fill="#c9ced6" stroke="#1d2025" stroke-width="2.5"/><rect x="31" y="19" width="14" height="3.5" rx="1" fill="#1d2025"/><rect x="31" y="24" width="14" height="3.5" rx="1" fill="#1d2025"/><rect x="13" y="25" width="20" height="3" fill="#f2c230"/><circle cx="29" cy="20" r="2" fill="#ff2b2b"/></svg>',
  barricade: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 40h36" stroke="#4e2f18" stroke-width="5" stroke-linecap="round"/><g fill="#7a4a26" stroke="#2c1a0c" stroke-width="2" stroke-linejoin="round"><path d="M9 41 12 12l5 29z"/><path d="M17 41l4-33 4 33z"/><path d="M25 41l5-30 4 30z"/><path d="M33 41l5-27 3 27z"/></g><g fill="#e8d5a8"><path d="M11.4 18 12 12l1.2 6z"/><path d="M20.3 14 21 8l.8 6z"/><path d="M29.3 17 30 11l.8 6z"/><path d="M37.4 20 38 14l.6 6z"/></g></svg>',
  barrel: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 9h24l2 4v24l-2 4H12l-2-4V13z" fill="#c4231b" stroke="#4a0a07" stroke-width="2.5" stroke-linejoin="round"/><path d="M10 15h28v7H10z" fill="#f6c218"/><path d="M14 15h4l-3 7h-4zm8 0h4l-3 7h-4zm8 0h4l-3 7h-4z" fill="#16171a"/><path d="M10 31h28" stroke="#8e1812" stroke-width="2.5"/></svg>',
};
const KEYS = { hp: "4", gun: "5", melee: "6" };
const KEY_TO_ID = { Digit4: "hp", Digit5: "gun", Digit6: "melee" };
const DEPLOY_KEYS = ["Digit7", "Digit8", "Digit9"];
const HOLD_MS = 350;   // held this long, a deployable card picks grid mode

/* A controller (user, 2026-10-13: "detect if a controller is connected and
   based off that use the dpad"): the number badges become d-pad prompts.
   D-pad down walks a highlight through the six cards, d-pad up buys or
   deploys it (held: grid mode); placing, R2 / A puts it down and B cancels
   (input/gamepad.js). A number key on the keyboard puts the numbers back
   until the pad is used again. */
const pad = { on: false, sel: 0, kb: false };
function padList() {
  return [...["hp", "gun", "melee"].map((id) => ({ id, b: els.cards[id].b })),
    ...els.depOrder.map((id) => ({ id, dep: true, b: els.depCards[id].b }))];
}
function paintPad() {
  padList().forEach((c, i) => {
    const k = c.b.querySelector(".zh-key");
    if (k.dataset.k == null) k.dataset.k = k.textContent;
    const sel = pad.on && i === pad.sel;
    c.b.classList.toggle("is-sel", sel);
    k.textContent = pad.on ? (sel ? "▲" : "") : k.dataset.k;
  });
}
function setPad(on) {
  if (on === pad.on) return;
  pad.on = on;
  root.classList.toggle("is-pad", on);
  paintPad();
}
const padUsed = () => { pad.kb = false; setPad(document.body.classList.contains("to-has-pad")); };
padHooks.zombies = {
  active: () => !!root && !root.hidden && game.gameState === "playing" && !game.localPauseOnly,
  placing: () => !!hooks.isPlacing?.(),
  next() {
    padUsed();
    const n = padList().length;
    if (n) pad.sel = (pad.sel + 1) % n;
    paintPad();
  },
  useStart() {
    const was = pad.on;
    padUsed();
    if (!was) return;   // the first press only shows the prompts
    const c = padList()[pad.sel];
    if (!c) return;
    if (c.dep) holdStart(c.id, "pad");
    else c.b.click();
  },
  useEnd() { holdEnd("pad"); },
  state: () => ({ on: pad.on, sel: pad.sel, id: padList()[pad.sel]?.id ?? null }),
};

const money = (n) => `$${Math.round(n).toLocaleString()}`;

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

/* A card label that fits its card: shrunk a touch if it's a little long
   ("Grinmington 870" on a phone), on two lines if it's longer than that,
   never cut short with "…". */
const FIT_STEPS = [0.94, 0.88];
export function fitLabel(e, text) {
  e.textContent = text;
  e.classList.remove("is-wrap");
  e.style.fontSize = "";
  if (e.scrollWidth <= e.clientWidth + 1) return;
  const base = parseFloat(getComputedStyle(e).fontSize);
  for (const k of FIT_STEPS) {
    e.style.fontSize = `${(base * k).toFixed(2)}px`;
    if (e.scrollWidth <= e.clientWidth + 1) return;
  }
  e.style.fontSize = "";
  e.classList.add("is-wrap");
}

/* A tap on the HUD is a tap on the HUD, not a look drag or a shot. */
function swallow(e) { e.stopPropagation(); }

export function mountZombiesHud(h) {
  hooks = { ...hooks, ...h };
  if (root) return;
  const hud = document.getElementById("to-hud");
  if (!hud) return;
  root = el("div", "zh");
  root.id = "to-zh";
  root.hidden = true;

  els.top = el("div", "zh-top");
  els.left = el("span", "zh-left");
  els.wave = el("strong", "zh-wave");
  // a boss on its feet: its name and health take the place of "in N waves"
  els.boss = el("span", "zh-boss");
  els.boss.hidden = true;
  els.boss.innerHTML = '<span class="zh-boss-n"></span><span class="zh-boss-bar"><i></i></span>';
  els.bossN = els.boss.querySelector(".zh-boss-n");
  els.bossBar = els.boss.querySelector("i");
  els.top.append(els.left, els.boss, els.wave);

  els.skip = el("button", "zh-skip");
  els.skip.type = "button";
  els.skip.hidden = true;
  els.skip.setAttribute("aria-label", "Skip the break");
  els.skip.innerHTML = '<span class="zh-skip-t">Skip break</span><span class="zh-skip-s"></span><span class="zh-key">K</span>';
  els.skipS = els.skip.querySelector(".zh-skip-s");
  els.skipT = els.skip.querySelector(".zh-skip-t");
  els.skip.addEventListener("click", () => hooks.onSkip());

  els.up = el("div", "zh-col zh-up");
  els.up.append(el("div", "zh-col-h", "Upgrades"), el("div", "zh-col-s zh-padhint", "▼ next · ▲ buy"));
  els.cards = {};
  for (const id of ["hp", "gun", "melee"]) {
    const b = el("button", `zh-card zh-card-${id}`);
    b.type = "button";
    b.innerHTML = `<span class="zh-price"></span><span class="zh-icon"></span><span class="zh-sub"></span><span class="zh-title"></span><span class="zh-key">${KEYS[id]}</span>`;
    b.addEventListener("click", () => {
      if (!hooks.onBuy(id)) { b.classList.remove("is-no"); void b.offsetWidth; b.classList.add("is-no"); }
      else { b.classList.remove("is-bought"); void b.offsetWidth; b.classList.add("is-bought"); }
    });
    els.cards[id] = {
      b,
      price: b.querySelector(".zh-price"),
      icon: b.querySelector(".zh-icon"),
      sub: b.querySelector(".zh-sub"),
      title: b.querySelector(".zh-title"),
    };
    els.up.append(b);
  }

  // the Deployables column: cards made on the first update, from the kit
  els.dep = el("div", "zh-col zh-dep");
  const depHead = el("div", "zh-col-hrow");
  depHead.append(el("div", "zh-col-h", "Deployables"), el("div", "zh-col-s", "(Hold for grid mode)"));
  els.dep.append(depHead);
  els.depCards = {};
  els.depOrder = [];

  els.chip = el("div", "zh-chip");
  els.chip.hidden = true;
  els.chip.innerHTML = '<span class="zh-chip-t"></span><span class="zh-chip-s"></span><button type="button" class="zh-chip-b is-place">Place</button><button type="button" class="zh-chip-b is-cancel">Cancel</button>';
  els.chipT = els.chip.querySelector(".zh-chip-t");
  els.chipS = els.chip.querySelector(".zh-chip-s");
  els.chip.querySelector(".is-place").addEventListener("click", () => hooks.onPlace());
  els.chip.querySelector(".is-cancel").addEventListener("click", () => hooks.onCancel());

  els.cash = el("div", "zh-cash");
  els.gain = el("span", "zh-gain");
  els.cashN = el("strong", "zh-cash-n");
  els.cash.append(els.gain, els.cashN);

  els.feed = el("div", "zh-feed");
  els.banner = el("div", "zh-banner");

  els.down = el("div", "zh-down");
  els.down.hidden = true;
  els.down.innerHTML = '<div class="zh-down-t">Bleeding out</div><div class="zh-down-bar"><i></i></div><div class="zh-down-k"></div>';
  els.downT = els.down.querySelector(".zh-down-t");
  els.downBar = els.down.querySelector("i");
  els.downK = els.down.querySelector(".zh-down-k");
  // co-op: holding X by a downed teammate
  els.revive = el("div", "zh-revive");
  els.revive.hidden = true;
  els.revive.innerHTML = '<div class="zh-revive-t"></div><div class="zh-down-bar"><i></i></div>';
  els.reviveT = els.revive.querySelector(".zh-revive-t");
  els.reviveBar = els.revive.querySelector("i");

  root.append(els.top, els.skip, els.up, els.dep, els.chip, els.cash, els.feed, els.banner, els.down, els.revive);
  for (const ev of ["pointerdown", "touchstart", "mousedown"]) root.addEventListener(ev, swallow, { passive: true });
  hud.append(root);

  // a new size (rotation, touch layout on/off) re-fits the card labels
  window.addEventListener("resize", () => { shown.offers = ""; });
  window.addEventListener("keydown", (e) => {
    if (e.repeat || root.hidden || game.gameState !== "playing" || game.localPauseOnly) return;
    if (KEY_TO_ID[e.code] || DEPLOY_KEYS.includes(e.code)) { pad.kb = true; setPad(false); }
    const id = KEY_TO_ID[e.code];
    if (id) els.cards[id].b.click();
    else if (e.code === "KeyK") hooks.onSkip();
    else if (e.code === "Escape") hooks.onCancel();
    const di = DEPLOY_KEYS.indexOf(e.code);
    if (di >= 0 && els.depOrder[di]) holdStart(els.depOrder[di], e.code);
  });
  window.addEventListener("keyup", (e) => {
    if (DEPLOY_KEYS.includes(e.code)) holdEnd(e.code);
  });
}

/* A deployable card pressed (key or finger): let go before HOLD_MS and it's
   a pick; keep it down and it's a pick in grid mode, as soon as it counts. */
let hold = null;   // { id, src, timer }
function holdStart(id, src) {
  holdCancel();
  hold = { id, src, timer: setTimeout(() => { const h = hold; hold = null; if (h) pickDeploy(h.id, true); }, HOLD_MS) };
}
function holdEnd(src) {
  if (!hold || hold.src !== src) return;
  const { id, timer } = hold;
  clearTimeout(timer);
  hold = null;
  pickDeploy(id, false);
}
function holdCancel() {
  if (hold) clearTimeout(hold.timer);
  hold = null;
}
function pickDeploy(id, grid) {
  const c = els.depCards[id];
  if (!hooks.onDeploy(id, grid) && c) { c.b.classList.remove("is-no"); void c.b.offsetWidth; c.b.classList.add("is-no"); }
}

function depCard(o, i) {
  const b = el("button", `zh-card zh-card-dep zh-card-${o.id}`);
  b.type = "button";
  b.innerHTML = `<span class="zh-price"></span><span class="zh-icon">${ICONS[o.id] || ""}</span><span class="zh-sub"></span><span class="zh-title"></span><span class="zh-key">${i + 7}</span>`;
  const src = `card-${o.id}`;
  b.addEventListener("pointerdown", (e) => { e.preventDefault(); holdStart(o.id, src); });
  b.addEventListener("pointerup", () => holdEnd(src));
  b.addEventListener("pointerleave", () => { if (hold?.src === src) holdCancel(); });
  b.addEventListener("pointercancel", () => { if (hold?.src === src) holdCancel(); });
  b.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickDeploy(o.id, false); } });
  const c = { b, price: b.querySelector(".zh-price"), sub: b.querySelector(".zh-sub"), title: b.querySelector(".zh-title") };
  els.depCards[o.id] = c;
  els.depOrder[i] = o.id;
  els.dep.append(b);
  return c;
}

export function showZombiesHud(on) {
  document.body.classList.toggle("to-zombies", !!on);
  if (!root) return;
  root.hidden = !on;
  if (!on) {
    for (const k of Object.keys(shown)) shown[k] = typeof shown[k] === "string" ? "" : (shown[k] === null ? null : -1);
    els.feed.textContent = "";
    els.banner.classList.remove("is-on");
    els.down.hidden = true;
    els.chip.hidden = true;
    holdCancel();
  }
}

/* The big centre text: "Wave 7" as a wave starts (red for the last one),
   and the run's other calls ("Back on your feet"). */
export function zombiesBanner(text, red = false) {
  if (!root) return;
  els.banner.textContent = text;
  els.banner.classList.toggle("is-final", red);
  els.banner.classList.remove("is-on");
  void els.banner.offsetWidth;
  els.banner.classList.add("is-on");
}

export function announceWave(n, final) {
  zombiesBanner(n >= final ? "Final wave" : `Wave ${n}`, n >= final);
}

function feedLine(amount, label) {
  const line = el("div", "zh-feed-l");
  line.innerHTML = `<b>+${money(amount)}</b> <span></span>`;
  line.querySelector("span").textContent = label;
  els.feed.prepend(line);
  while (els.feed.children.length > 4) els.feed.lastChild.remove();
  setTimeout(() => line.classList.add("is-out"), 1800);
  setTimeout(() => line.remove(), 2300);
}

/* Every frame of a run; touches the DOM only when something changed. */
export function updateZombiesHud(dt, s) {
  if (!root || root.hidden) return;
  setPad(!pad.kb && document.body.classList.contains("to-has-pad"));
  if (s.wave !== shown.wave) {
    shown.wave = s.wave;
    els.wave.textContent = `Wave ${s.wave}`;
    const togo = Math.max(0, s.final - s.wave);
    els.left.innerHTML = togo > 0 ? `in <b>${togo}</b> wave${togo === 1 ? "" : "s"}` : "<b>Final wave</b>";
  }
  const breakS = s.between ? Math.ceil(Math.max(0, s.breakT)) : -1;
  if (s.between !== shown.between || breakS !== shown.breakS) {
    shown.between = s.between;
    shown.breakS = breakS;
    els.skip.hidden = !s.between;
    shown.vote = null;
  }
  // co-op: the skip is a vote, and everyone has to want it
  const v = s.between && s.vote ? `${s.vote.n}/${s.vote.of}:${s.vote.mine ? 1 : 0}` : "";
  if (s.between && v !== shown.vote) {
    shown.vote = v;
    // (user, 2026-10-14: unanimous, and it goes on by itself: say both)
    els.skipS.textContent = s.vote ? `Votes ${s.vote.n}/${s.vote.of} · all needed · next in ${breakS}s` : `Next wave in ${breakS}s`;
    els.skipT.textContent = s.vote ? (s.vote.mine ? "Voted to skip" : "Vote to skip") : "Skip break";
    els.skip.classList.toggle("is-voted", !!s.vote?.mine);
  }

  const rv = s.revive;
  const rkey = rv ? rv.name : "";
  if (rkey !== shown.revive) {
    shown.revive = rkey;
    els.revive.hidden = !rv;
    if (rv) els.reviveT.textContent = `Hold ${game.isTouch ? "SWAP" : "X"} to revive ${rv.name}`;
    shown.reviveK = -1;
  }
  if (rv) {
    const k = Math.round(Math.min(1, rv.k) * 100) / 100;
    if (k !== shown.reviveK) { shown.reviveK = k; els.reviveBar.style.transform = `scaleX(${k})`; }
  }

  const cash = Math.round(s.econ.cash);
  if (cash !== shown.cash) { shown.cash = cash; els.cashN.textContent = money(cash); }
  const gain = s.econ.gainT > 0 ? Math.round(s.econ.gain) : 0;
  if (gain !== shown.gain) {
    shown.gain = gain;
    els.gain.textContent = gain ? `+${money(gain)}` : "";
    els.gain.classList.toggle("is-on", !!gain);
  }
  for (const f of s.econ.feed.splice(0)) feedLine(f.amount, f.label);

  const key = s.offers.map((o) => `${o.id}:${o.title}:${o.sub}:${o.price}:${o.can}`).join("|");
  if (key !== shown.offers) {
    shown.offers = key;
    for (const o of s.offers) {
      const c = els.cards[o.id];
      c.price.textContent = o.price == null ? "MAX" : money(o.price);
      fitLabel(c.title, o.title);
      fitLabel(c.sub, o.sub);
      if (!c.icon.innerHTML) c.icon.innerHTML = ICONS[o.kind];
      c.b.classList.toggle("is-poor", o.price != null && !o.can);
      c.b.classList.toggle("is-max", o.price == null);
      c.b.setAttribute("aria-label", `${o.sub} ${o.title}${o.price == null ? ", maxed" : `, ${money(o.price)}`}`);
    }
  }

  if (s.deploy) {
    const dkey = s.deploy.map((o) => `${o.id}:${o.price}:${o.count}:${o.can}:${o.placing}`).join("|");
    if (dkey !== shown.deploy) {
      shown.deploy = dkey;
      s.deploy.forEach((o, i) => {
        const c = els.depCards[o.id] || depCard(o, i);
        c.price.textContent = money(o.price);
        fitLabel(c.title, o.short || o.name);   // the full name is on the chip
        fitLabel(c.sub, `${o.count} / ${o.max}`);
        c.b.classList.toggle("is-poor", !o.can && !o.placing);
        c.b.classList.toggle("is-placing", !!o.placing);
        c.b.setAttribute("aria-label", `${o.name}, ${money(o.price)}, ${o.count} of ${o.max} out`);
      });
      if (pad.on) paintPad();   // new cards get their prompt
    }
  }
  const pl = s.placing;
  const pkey = pl ? `${pl.name}:${pl.ok}:${pl.grid}` : "";
  if (pkey !== shown.placing) {
    shown.placing = pkey;
    els.chip.hidden = !pl;
    if (pl) {
      els.chipT.textContent = `Placing ${pl.name}`;
      els.chipS.textContent = pl.ok ? (pl.grid ? "Grid mode" : "") : "Won't fit there";
      els.chip.classList.toggle("is-bad", !pl.ok);
    }
  }

  const b = s.boss;
  const bkey = b ? `${b.name}:${b.final}` : "";
  if (bkey !== shown.boss) {
    shown.boss = bkey;
    els.boss.hidden = !b;
    els.left.hidden = !!b;
    if (b) { els.bossN.textContent = b.name; els.boss.classList.toggle("is-final", !!b.final); }
    shown.bossK = -1;
  }
  if (b) {
    const k = Math.round(b.k * 200) / 200;
    if (k !== shown.bossK) { shown.bossK = k; els.bossBar.style.transform = `scaleX(${k})`; }
  }

  const d = s.downed;
  if (!!d !== shown.downed) {
    shown.downed = !!d;
    els.down.hidden = !d;
    root.classList.toggle("is-downed", !!d);
  }
  if (d) {
    els.downBar.style.transform = `scaleX(${d.out ? 0 : Math.max(0, d.t / d.max).toFixed(3)})`;
    // solo: the last stand's kill count; co-op: wait for a teammate
    const key = `${d.kills}:${d.need}:${d.out ? 1 : 0}:${d.wait ? 1 : 0}`;
    if (key !== shown.kills) {
      shown.kills = key;
      els.downT.textContent = d.wait ? "Joining" : d.out ? "Out" : "Bleeding out";
      els.downK.textContent = d.wait ? "You spawn in when this round ends" : d.out ? "Back in when the wave is cleared"
        : d.need ? `Kills to get up: ${d.kills} / ${d.need}` : "Hang on: a teammate can pick you up";
    }
  }
}
