// Troll Forces — scorestreaks, Black Ops 2 style.
//
// Two things live here and they are easy to confuse, so: `progression.js`
// owns XP, which is permanent and unlocks weapons across sessions. This file
// owns SCORE, which is per-life, never persisted, and buys rewards inside a
// single match. A kill pays into both.
//
// BO2's rules, which this follows: score accrues from kills, assists and
// objective work; dying zeroes the meter but does NOT take away a reward you
// already earned; you pick three streaks before the match and can only call
// those three.

import { rankUnlocked } from "./progression.js";

/* Deliberately not progression.js's XP table. Reaching for the wrong one is
   the likeliest bug in this system, so the shapes stay distinct. */
export const SCORE = {
  kill: 100,
  assist: 50,
  objectiveTick: 10,    // per KOTH hill second
  hillCapture: 75,
  plant: 150,
  defuse: 150,
};

/* The ladder. `cost` is score in one life; `rank` gates it in the picker.
   Order matters — the picker and HUD render in this order. */
export const STREAK_DEFS = {
  uav: {
    id: "uav",
    name: "UAV",
    icon: "uav",
    cost: 200,
    rank: 0,
    duration: 25,
    blurb: "Enemy positions on your minimap for 25 seconds. Your whole team sees it.",
  },
  carepackage: {
    id: "carepackage",
    name: "Care Package",
    icon: "carepackage",
    cost: 300,
    rank: 5,
    blurb: "Mark a spot, a crate drops in. Ammo, a weapon, or another streak — you find out when you open it.",
  },
  drone: {
    id: "drone",
    name: "Hunter-Killer Drone",
    short: "Hunter-Killer",
    icon: "drone",
    cost: 350,
    rank: 12,
    blurb: "Launches and hunts the nearest enemy. One kill, then it's gone.",
  },
  airstrike: {
    id: "airstrike",
    name: "Lightning Strike",
    icon: "airstrike",
    cost: 450,
    rank: 20,
    blurb: "Mark a spot. Five seconds later it stops being a spot.",
  },
  helicopter: {
    id: "helicopter",
    name: "Helicopter Gunship",
    short: "Gunship",
    icon: "helicopter",
    cost: 700,
    rank: 30,
    duration: 45,
    blurb: "A gunship on station for 45 seconds, picking off whatever it can see.",
  },
};

export const STREAK_IDS = Object.keys(STREAK_DEFS);
export const LOADOUT_SIZE = 3;

/* Every streak above the first tier hands out rewards from the care package,
   so the roll needs a pool that can't hand out another care package. */
export const PACKAGE_STREAK_POOL = ["uav", "drone", "airstrike"];

export function streakUnlocked(id) {
  const def = STREAK_DEFS[id];
  return !!def && rankUnlocked(def.rank);
}

/* Minimal single-color line-art glyphs, one per streak — the picker and HUD
   both had nothing but text before this, so even a plain silhouette reads as
   a big step up and doesn't need new art assets to ship. `currentColor`
   throughout so the existing ready/selected CSS states just work. */
const STREAK_ICON_PATHS = {
  uav: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke-linecap="round"/><circle cx="12" cy="12" r="7.5" fill="none"/>',
  carepackage: '<rect x="4" y="10" width="16" height="10" rx="1"/><path d="M4 14h16M12 10v10" stroke="#0d1410" stroke-width="1"/><path d="M12 2v8M7 5l5-3 5 3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  drone: '<path d="M12 8l7-4M12 8l-7-4M12 16l7 4M12 16l-7 4" stroke-linecap="round" fill="none"/><circle cx="19" cy="4" r="2.4"/><circle cx="5" cy="4" r="2.4"/><circle cx="19" cy="20" r="2.4"/><circle cx="5" cy="20" r="2.4"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/>',
  airstrike: '<path d="M12 1v10" stroke-linecap="round" fill="none"/><path d="M12 11l-3.5 8h7L12 11z"/><path d="M8 15l-4 1.5M16 15l4 1.5" fill="none" stroke-linecap="round"/>',
  helicopter: '<ellipse cx="10" cy="14" rx="7" ry="4"/><rect x="16" y="13" width="6" height="2" rx="1"/><rect x="9" y="6" width="2" height="6" rx="1"/><path d="M2 6h16" fill="none" stroke-linecap="round"/><rect x="7" y="18" width="6" height="2" rx="1"/>',
};

/* `<svg>` markup for a streak's icon, sized by the caller via CSS. Falls
   back to a plain dot rather than throwing if a def is ever added without
   one — a missing icon shouldn't break the card it's on. */
export function streakIconSvg(id) {
  const paths = STREAK_ICON_PATHS[STREAK_DEFS[id]?.icon] || '<circle cx="12" cy="12" r="4"/>';
  return `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.4" aria-hidden="true">${paths}</svg>`;
}

/* Name for the in-match HUD strip, which is narrower than the lobby card. */
export function streakShortName(id) {
  const def = STREAK_DEFS[id];
  return def ? (def.short || def.name) : id;
}

/* Per-match streak state for the local player. Peers' meters aren't modelled —
   only the client that earned a streak ever calls one, and it tells everyone
   else what happened (see net.js `publishStreak`). */
export class StreakState {
  constructor() {
    this.reset();
  }

  /* New match: nothing earned, nothing banked. */
  reset() {
    this.score = 0;
    this.charges = {};   // streak id -> how many calls are banked
    this.selected = [];  // the three ids picked in the lobby
  }

  setSelected(ids) {
    this.selected = ids.filter((id) => STREAK_DEFS[id]).slice(0, LOADOUT_SIZE);
  }

  /* Death takes the meter, not the rewards — BO2's actual behaviour, and the
     reason `charges` is untouched here. */
  onDeath() {
    this.score = 0;
  }

  /* S&D has no mid-round respawn, so a round boundary is the only place a
     life can end without a death. */
  onRoundEnd() {
    this.score = 0;
  }

  /* Returns the ids that just became affordable, so the caller can announce
     them — earning a streak should be a moment, not something you notice
     later by squinting at the HUD. */
  addScore(amount) {
    if (!(amount > 0)) return [];
    const before = this.score;
    this.score += amount;

    const earned = [];
    for (const id of this.selected) {
      const cost = STREAK_DEFS[id].cost;
      // Only fires on the frame the threshold is crossed, and only while
      // nothing is already banked — otherwise holding a call re-announces it
      // on every subsequent kill.
      if (before < cost && this.score >= cost && !this.charges[id]) {
        this.charges[id] = 1;
        earned.push(id);
      }
    }
    return earned;
  }

  /* Banked and ready to call. */
  ready(id) { return (this.charges[id] || 0) > 0; }

  /* Every id actually holding a charge — not just the loadout's three,
     since a care-package streak (grant()) can bank an id the player never
     selected and it still has to be callable. */
  readyIds() { return Object.keys(this.charges).filter((id) => this.ready(id)); }

  /* Hand out a charge directly, bypassing the meter — how a care package
     rewards a streak. */
  grant(id) {
    if (!STREAK_DEFS[id]) return false;
    this.charges[id] = (this.charges[id] || 0) + 1;
    return true;
  }

  /* Calling one spends the charge and the score it cost. The meter is not
     zeroed: banking toward the next streak is the whole point of the ladder. */
  spend(id) {
    if (!this.ready(id)) return false;
    this.charges[id] -= 1;
    if (this.charges[id] <= 0) delete this.charges[id];
    this.score = Math.max(0, this.score - STREAK_DEFS[id].cost);
    return true;
  }

  /* 0..1 toward the cheapest selected streak that isn't banked yet, for the
     HUD meter. Returns null once everything selected is ready. */
  nextProgress() {
    let next = null;
    for (const id of this.selected) {
      if (this.ready(id)) continue;
      const def = STREAK_DEFS[id];
      if (!next || def.cost < STREAK_DEFS[next].cost) next = id;
    }
    if (!next) return null;
    const cost = STREAK_DEFS[next].cost;
    return { id: next, cost, frac: Math.min(1, this.score / cost) };
  }
}

/* Which modes a streak has any business appearing in. Gun Game's ladder and
   One in the Chamber's single bullet are both decided by the weapon in your
   hands; a gunship parked overhead reads as broken rather than earned. */
export function streaksAllowed(mode) {
  return !!mode?.pvp && !mode.noStreaks;
}
