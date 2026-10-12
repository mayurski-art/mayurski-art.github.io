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

import { game } from "../core/state.js?v=st1";

let root = null;
let hooks = { onBuy: () => {}, onSkip: () => {} };
const els = {};
const shown = { wave: -1, left: -1, cash: -1, gain: -1, offers: "", between: null, breakS: -1, downed: null, downS: -1, kills: -1 };

const ICONS = {
  health: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 41 8 25a9 9 0 0 1 13-13l3 3 3-3a9 9 0 0 1 13 13Z" fill="#ff3b4a" stroke="#5a0c12" stroke-width="2.5"/><path d="M33 8v8m-4-4h8" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/></svg>',
  gun: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M5 18h30l3-3h5v7h-6l-2 3H22l-3 11h-7l2-11H5z" fill="#2b2f36" stroke="#0b0d10" stroke-width="2" stroke-linejoin="round"/><path d="M24 25l-1 5h5" fill="none" stroke="#0b0d10" stroke-width="2"/></svg>',
  melee: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 41 31 13c3-4 9-2 8 3L15 44Z" fill="#9b6b3c" stroke="#3a220f" stroke-width="2.5" stroke-linejoin="round"/><path d="M9 41l4 3" stroke="#1d1209" stroke-width="5" stroke-linecap="round"/></svg>',
};
const KEYS = { hp: "4", gun: "5", melee: "6" };
const KEY_TO_ID = { Digit4: "hp", Digit5: "gun", Digit6: "melee" };

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
  els.top.append(els.left, els.wave);

  els.skip = el("button", "zh-skip");
  els.skip.type = "button";
  els.skip.hidden = true;
  els.skip.setAttribute("aria-label", "Skip the break");
  els.skip.innerHTML = '<span class="zh-skip-t">Skip break</span><span class="zh-skip-s"></span><span class="zh-key">K</span>';
  els.skipS = els.skip.querySelector(".zh-skip-s");
  els.skip.addEventListener("click", () => hooks.onSkip());

  els.up = el("div", "zh-col zh-up");
  els.up.append(el("div", "zh-col-h", "Upgrades"));
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

  els.cash = el("div", "zh-cash");
  els.gain = el("span", "zh-gain");
  els.cashN = el("strong", "zh-cash-n");
  els.cash.append(els.gain, els.cashN);

  els.feed = el("div", "zh-feed");
  els.banner = el("div", "zh-banner");

  els.down = el("div", "zh-down");
  els.down.hidden = true;
  els.down.innerHTML = '<div class="zh-down-t">Bleeding out</div><div class="zh-down-bar"><i></i></div><div class="zh-down-k"></div>';
  els.downBar = els.down.querySelector("i");
  els.downK = els.down.querySelector(".zh-down-k");

  root.append(els.top, els.skip, els.up, els.cash, els.feed, els.banner, els.down);
  for (const ev of ["pointerdown", "touchstart", "mousedown"]) root.addEventListener(ev, swallow, { passive: true });
  hud.append(root);

  // a new size (rotation, touch layout on/off) re-fits the card labels
  window.addEventListener("resize", () => { shown.offers = ""; });
  window.addEventListener("keydown", (e) => {
    if (e.repeat || root.hidden || game.gameState !== "playing" || game.localPauseOnly) return;
    const id = KEY_TO_ID[e.code];
    if (id) els.cards[id].b.click();
    else if (e.code === "KeyK") hooks.onSkip();
  });
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
    els.skipS.textContent = s.between ? `Next wave in ${breakS}s` : "";
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

  const d = s.downed;
  if (!!d !== shown.downed) {
    shown.downed = !!d;
    els.down.hidden = !d;
    root.classList.toggle("is-downed", !!d);
  }
  if (d) {
    els.downBar.style.transform = `scaleX(${Math.max(0, d.t / d.max).toFixed(3)})`;
    if (d.kills !== shown.kills) {
      shown.kills = d.kills;
      els.downK.textContent = `Kills to get up: ${d.kills} / ${d.need}`;
    }
  }
}
