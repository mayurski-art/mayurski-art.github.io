// Troll Forces — medal callouts (BO2 style) and multikill tracking.
//
// This is presentation, not scoring: game.js already counts kills and owns
// `player.streak`. What's new here is the *time-window* counter, which is a
// different thing from a streak and the reason both exist:
//
//   player.streak  — kills since you last died (unbounded in time)
//   multikill      — kills within a few seconds of each other (survives dying)
//
// A double kill is two kills four seconds apart whether or not you died in
// between; a Rampage is ten kills without dying however long it took. BO2
// announces both, so we track both. What each medal looks like and pays lives
// in medals.js.

import { badgeSvg, medalDef } from "./medals.js?v=to-medals2";

const MULTIKILL_WINDOW = 4000;   // ms — BO2's multikill grace is about this

/* 2 and 3 get their own names; past that it's just "multi" with a count. */
const MULTI_LABELS = { 2: "Double Kill", 3: "Triple Kill", 4: "Quad Kill" };

const NUCLEAR_AT = 25;

const SPLASH_MAX = 3;       // medals stacked under the crosshair at once
const SPLASH_MS = 2200;     // how long each one stays up
const BANNER_MS = 3200;     // streak-ready / match-wide callout banner
const METAL_RANK = { silver: 0, gold: 1, red: 2 };

export class KillstreakUi {
  /* els: { badges, banner, screenPulse }. onPoints(pts, label) pays a
     medal's points (game.js owns the score meter and XP). onSting(metal)
     plays the medal sound, once per burst, pitched for the rarest medal. */
  constructor(els, { onPoints, onSting } = {}) {
    this.els = els;
    this.onPoints = onPoints || (() => {});
    this.onSting = onSting || (() => {});
    this.stingMetal = null;
    this.reset();
  }

  reset() {
    this.kills = [];          // timestamps inside the multikill window
    this.tally = new Map();   // medal label -> times earned this match
    this.els.badges?.replaceChildren();
    this.els.banner?.replaceChildren();
  }

  /* Count a medal for the after-action list and pay its points, without
     showing it. */
  count(label) {
    const { pts } = medalDef(label);
    const e = this.tally.get(label);
    if (e) e.n++;
    else this.tally.set(label, { label, n: 1, order: this.tally.size, pts });
    if (pts > 0) this.onPoints(pts, label);
  }

  /* A medal: counted for the end-of-match list AND popped on screen. */
  medal(label) {
    this.count(label);
    this.splash(label);
  }

  /* Everything earned this match, most-earned first, ties in the order
     they were first earned. */
  medals() {
    return [...this.tally.values()].sort((a, b) => b.n - a.n || a.order - b.order);
  }

  /* Points the medals paid this match (the after-action "medal bonus"). */
  bonus() {
    let t = 0;
    for (const m of this.tally.values()) t += m.pts * m.n;
    return t;
  }

  /* One kill just landed. Returns what it announced, so the caller can
     broadcast the match-wide ones without re-deriving the thresholds. */
  onKill({ head = false, streak = 0 } = {}) {
    const now = performance.now();
    this.kills.push(now);
    // Prune first, then count: the buffer is the window.
    this.kills = this.kills.filter((t) => now - t <= MULTIKILL_WINDOW);

    const out = { multi: 0, nuclear: false };

    if (head) this.medal("Headshot");

    const n = this.kills.length;
    if (n >= 2) {
      out.multi = n;
      this.medal(MULTI_LABELS[n] || `${n}× Multi Kill`);
    }

    if (streak === NUCLEAR_AT) {
      out.nuclear = true;
      this.medal("Nuclear");
    }

    return out;
  }

  /* BO2's splash: badge, title, +points, centre-screen. The newest sits on
     top at full size; older ones shrink, fade and lose their badge. */
  splash(label) {
    const wrap = this.els.badges;
    if (!wrap) return;
    const def = medalDef(label);
    for (const c of wrap.children) c.classList.add("is-old");
    while (wrap.children.length >= SPLASH_MAX) wrap.lastElementChild.remove();

    const el = document.createElement("div");
    el.className = `to-medal-pop metal-${def.metal}`;
    const icon = document.createElement("div");
    icon.className = "to-medal-icon";
    icon.innerHTML = badgeSvg(def);
    const name = document.createElement("div");
    name.className = "to-medal-name";
    name.textContent = label;
    el.append(icon, name);
    if (def.pts > 0) {
      const pts = document.createElement("div");
      pts.className = "to-medal-pts";
      pts.textContent = `+${def.pts}`;
      el.appendChild(pts);
    }
    wrap.prepend(el);
    setTimeout(() => el.remove(), SPLASH_MS);
    this.queueSting(def.metal);

    // Nuclear is the one moment the whole match hears about, so the full
    // screen gets one brief pulse too.
    if (def.glyph === "nuke") this.pulse();
  }

  /* One kill can land three medals at once (headshot, double kill, a
     rung); they share one sting, pitched for the rarest. */
  queueSting(metal) {
    const first = this.stingMetal == null;
    if (first || METAL_RANK[metal] > METAL_RANK[this.stingMetal]) this.stingMetal = metal;
    if (!first) return;
    setTimeout(() => { this.onSting(this.stingMetal); this.stingMetal = null; }, 0);
  }

  /* The bar across the top third: "UAV READY / Press 4 to call it in", and
     match-wide callouts. The badge is a medal's (`label`) or a 24-unit
     streak icon drawn inside a hexagon (`iconSvg`). */
  banner({ title, sub = "", iconSvg = "", label = "", tone = "gold" }) {
    const box = this.els.banner;
    if (!box) return;
    box.replaceChildren();
    const el = document.createElement("div");
    el.className = `to-ks-ready tone-${tone}`;
    const icon = document.createElement("div");
    icon.className = "to-ks-ready-icon";
    icon.innerHTML = label
      ? badgeSvg(medalDef(label))
      : badgeSvg({ shape: "hex", metal: tone === "red" ? "red" : "gold" }, {
        inner: iconSvg.replace("<svg ", '<svg x="17" y="16" width="30" height="30" '),
      });
    const text = document.createElement("div");
    const t1 = document.createElement("div");
    t1.className = "to-ks-ready-t1";
    t1.textContent = title;
    text.appendChild(t1);
    if (sub) {
      const t2 = document.createElement("div");
      t2.className = "to-ks-ready-t2";
      t2.textContent = sub;
      text.appendChild(t2);
    }
    el.append(icon, text);
    box.appendChild(el);
    setTimeout(() => el.remove(), BANNER_MS);
  }

  pulse() {
    const pulse = this.els.screenPulse;
    if (!pulse) return;
    pulse.classList.remove("is-pulsing");
    void pulse.offsetWidth;
    pulse.classList.add("is-pulsing");
  }
}
