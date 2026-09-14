// Troll Ops — killstreak badges and multikill callouts.
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
// announces both, so we track both.

const MULTIKILL_WINDOW = 4000;   // ms — BO2's multikill grace is about this

/* 2 and 3 get their own names; past that it's just "multi" with a count. */
const MULTI_LABELS = { 2: "Double Kill", 3: "Triple Kill", 4: "Quad Kill" };

/* The consecutive-streak ladder, extending the 3/5/7/10 that game.js's
   announceStreak already banners. Only entries above that get badges here,
   so the two layers don't shout the same number twice. */
const NUCLEAR_AT = 25;

export class KillstreakUi {
  constructor(els) {
    this.els = els;
    this.kills = [];       // timestamps inside the multikill window
  }

  reset() {
    this.kills = [];
  }

  /* One kill just landed. Returns what it announced, so the caller can
     broadcast the match-wide ones without re-deriving the thresholds. */
  onKill({ head = false, streak = 0, distance = 0 } = {}) {
    const now = performance.now();
    this.kills.push(now);
    // Prune first, then count: the buffer is the window.
    this.kills = this.kills.filter((t) => now - t <= MULTIKILL_WINDOW);

    const out = { multi: 0, nuclear: false };

    if (head) this.badge("HEADSHOT", "tier-head");

    const n = this.kills.length;
    if (n >= 2) {
      out.multi = n;
      this.badge(MULTI_LABELS[n] || `${n}× Multi Kill`, "tier-multi");
    }

    if (streak === NUCLEAR_AT) {
      out.nuclear = true;
      this.badge("NUCLEAR", "tier-nuclear");
    }

    return out;
  }

  /* Non-kill accomplishments (achievements, streak-earned) share the badge
     strip so there's one place on screen that means "something good". */
  note(label, tier = "tier-note") {
    this.badge(label, tier);
  }

  badge(label, tier) {
    const wrap = this.els.badges;
    if (!wrap) return;
    const div = document.createElement("div");
    div.className = `to-ks-badge ${tier}`;
    div.textContent = label;
    wrap.appendChild(div);
    // Same bound-the-list-and-self-remove shape as pushKillfeed/showXpPopup.
    while (wrap.children.length > 4) wrap.firstChild.remove();
    setTimeout(() => div.remove(), 1800);
  }
}
