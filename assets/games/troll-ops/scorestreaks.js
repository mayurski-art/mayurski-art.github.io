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

import { rankUnlocked } from "./progression.js?v=cg1";

/* Deliberately not progression.js's XP table. Reaching for the wrong one is
   the likeliest bug in this system, so the shapes stay distinct. */
export const SCORE = {
  kill: 100,
  assist: 50,
  objectiveTick: 10,    // per KOTH hill second
  hillCapture: 75,
  plant: 150,
  defuse: 150,
  dogKill: 50,          // shooting an enemy K9
  airKill: 125,         // an enemy aircraft or SAM Turret destroyed
};

/* The ladder. `cost` is score in one life; `rank` gates it in the picker.
   Order matters — the picker and HUD render in this order. */
export const STREAK_DEFS = {
  uav: {
    id: "uav",
    badge: "silver",   // BO2 tiers: silver, gold, then red for the top streak
    name: "UAV",
    icon: "uav",
    cost: 200,
    rank: 0,
    duration: 25,
    blurb: "Enemy positions on your minimap for 25 seconds. Your whole team sees it.",
  },
  counteruav: {
    id: "counteruav",
    badge: "silver",
    name: "Counter-UAV",
    short: "Counter-UAV",
    icon: "counteruav",
    cost: 250,
    rank: 3,
    duration: 30,      // the enemy minimap is jammed this long
    lockout: 45,       // whoever had an enemy UAV up can't call another this long
    blurb: "Jams the enemy minimap for 30 seconds and knocks their UAV out of the sky. Whoever called it can't call another UAV for 45 seconds.",
  },
  carepackage: {
    id: "carepackage",
    badge: "silver",   // BO2 tiers: silver, gold, then red for the top streak
    name: "Care Package",
    icon: "carepackage",
    cost: 300,
    rank: 5,
    blurb: "Mark a spot, a crate drops in. Ammo, a weapon, or another streak — you find out when you open it.",
  },
  drone: {
    id: "drone",
    badge: "gold",   // BO2 tiers: silver, gold, then red for the top streak
    name: "Hunter-Killer Drone",
    short: "Hunter-Killer",
    icon: "drone",
    cost: 350,
    rank: 12,
    blurb: "Launches and hunts the nearest enemy. One kill, then it's gone.",
  },
  airstrike: {
    id: "airstrike",
    badge: "gold",   // BO2 tiers: silver, gold, then red for the top streak
    name: "Lightning Strike",
    icon: "airstrike",
    cost: 450,
    rank: 20,
    blurb: "Mark a spot. Five seconds later it stops being a spot.",
  },
  // BO2's SAM Turret: set it down and it shoots enemy aircraft out of the
  // sky by itself (UAVs, drones, gunships, warships, Dragonfires), never
  // people. Enemies can shoot it apart. game.js + sam-turret.js.
  samturret: {
    id: "samturret",
    badge: "gold",
    name: "SAM Turret",
    short: "SAM Turret",
    icon: "samturret",
    cost: 500,
    rank: 22,
    duration: 90,
    blurb: "Set down an anti-air turret. It locks onto enemy aircraft and fires missiles until they're gone. Enemies can shoot it. Lasts 90 seconds.",
  },
  k9: {
    id: "k9",
    badge: "gold",
    name: "K9 Unit",
    icon: "k9",
    cost: 550,
    rank: 25,
    duration: 45,
    cooldown: 60,      // user: one pack a minute at most
    blurb: "Six attack dogs hunt the enemy team for 45 seconds. They can be shot. 60 second cooldown before the next pack.",
  },
  helicopter: {
    id: "helicopter",
    badge: "red",   // BO2 tiers: silver, gold, then red for the top streak
    name: "Helicopter Gunship",
    short: "Gunship",
    icon: "helicopter",
    cost: 700,
    rank: 30,
    duration: 45,
    cooldown: 60,      // seconds before you can call another (user: everything past Lightning Strike)
    blurb: "A gunship on station for 45 seconds, picking off whatever it can see. 60 second cooldown before the next one.",
  },
  // BO2's Dragonfire: a quadrotor you pilot yourself through its nose
  // camera, with an LMG under it. Your body stays where you called it.
  // game.js + dragonfire.js.
  dragonfire: {
    id: "dragonfire",
    badge: "red",
    name: "Dragonfire",
    icon: "dragonfire",
    cost: 750,
    rank: 31,
    duration: 60,
    cooldown: 60,
    blurb: "Fly a quadrotor drone with a light machine gun for 60 seconds. It can be shot down, and your body stays where you called it. 60 second cooldown before the next one.",
  },
  vsat: {
    id: "vsat",
    badge: "red",
    name: "Orbital VSAT",
    short: "VSAT",
    icon: "vsat",
    cost: 800,
    rank: 32,
    duration: 40,
    cooldown: 60,
    blurb: "A satellite shows every enemy on your team's minimap for 40 seconds, and which way they're facing. Can't be shot down. 60 second cooldown before the next one.",
  },
  warship: {
    id: "warship",
    badge: "red",
    name: "VTOL Warship",
    icon: "warship",
    cost: 850,
    rank: 35,
    duration: 40,
    cooldown: 60,
    blurb: "Take the guns of a VTOL circling overhead: 25 mm chain gun and 105 mm cannon. Your body stays on the ground. 60 second cooldown before the next one.",
  },
  swarm: {
    id: "swarm",
    badge: "red",
    name: "Swarm",
    icon: "swarm",
    cost: 1000,
    rank: 48,
    duration: 30,
    count: 24,
    cooldown: 60,      // user: one swarm a minute at most
    blurb: "Hunter-Killer drones pour in from the sky for 30 seconds, one enemy each. 60 second cooldown before the next one.",
  },
};

export const STREAK_IDS = Object.keys(STREAK_DEFS);
export const LOADOUT_SIZE = 3;

/* Every streak above the first tier hands out rewards from the care package,
   so the roll needs a pool that can't hand out another care package. */
export const PACKAGE_STREAK_POOL = ["uav", "counteruav", "drone", "airstrike"];

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
  counteruav: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7.5" fill="none"/><path d="M3 3l18 18M12 2v3M2 12h3" stroke-linecap="round" fill="none" stroke-width="2"/>',
  carepackage: '<rect x="4" y="10" width="16" height="10" rx="1"/><path d="M4 14h16M12 10v10" stroke="#0d1410" stroke-width="1"/><path d="M12 2v8M7 5l5-3 5 3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  drone: '<path d="M12 8l7-4M12 8l-7-4M12 16l7 4M12 16l-7 4" stroke-linecap="round" fill="none"/><circle cx="19" cy="4" r="2.4"/><circle cx="5" cy="4" r="2.4"/><circle cx="19" cy="20" r="2.4"/><circle cx="5" cy="20" r="2.4"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/>',
  airstrike: '<path d="M12 1v10" stroke-linecap="round" fill="none"/><path d="M12 11l-3.5 8h7L12 11z"/><path d="M8 15l-4 1.5M16 15l4 1.5" fill="none" stroke-linecap="round"/>',
  k9: '<path d="M4 9l2-6 3 4h6l3-4 2 6c0 5-3 9-8 9s-8-4-8-9z"/><circle cx="9.3" cy="11" r="1.1" fill="#0d1410" stroke="none"/><circle cx="14.7" cy="11" r="1.1" fill="#0d1410" stroke="none"/><path d="M10.4 15h3.2l-1.6 1.8z" fill="#0d1410" stroke="none"/>',
  warship: '<rect x="10.5" y="3" width="3" height="17" rx="1.5"/><rect x="2" y="9" width="20" height="2.4" rx="1"/><circle cx="3.5" cy="10.2" r="2.6" fill="none"/><circle cx="20.5" cy="10.2" r="2.6" fill="none"/><rect x="7" y="18.5" width="10" height="1.8" rx="0.9"/>',
  vsat: '<rect x="9.5" y="9.5" width="5" height="5" rx="1" transform="rotate(45 12 12)"/><rect x="1.5" y="10" width="6" height="4" rx="0.6"/><rect x="16.5" y="10" width="6" height="4" rx="0.6"/><path d="M7.5 12h2M14.5 12h2" stroke-linecap="round"/><path d="M8 4.5a5.5 5.5 0 0 1 8 0M10 6.6a2.8 2.8 0 0 1 4 0" fill="none" stroke-linecap="round"/><path d="M12 15.5v4M9.5 21h5" fill="none" stroke-linecap="round"/>',
  swarm: '<rect x="3" y="4" width="4.5" height="4.5" rx="1"/><rect x="15" y="3" width="4.5" height="4.5" rx="1"/><rect x="9.5" y="10" width="5" height="5" rx="1"/><rect x="3.5" y="16" width="4" height="4" rx="1"/><rect x="16" y="15.5" width="4.5" height="4.5" rx="1"/><path d="M5.2 4V2M17.2 3V1M12 10V8" stroke-linecap="round"/>',
  dragonfire: '<circle cx="5.5" cy="5.5" r="3.6" fill="none"/><circle cx="18.5" cy="5.5" r="3.6" fill="none"/><circle cx="5.5" cy="18.5" r="3.6" fill="none"/><circle cx="18.5" cy="18.5" r="3.6" fill="none"/><path d="M8 8l2.5 2.5M16 8l-2.5 2.5M8 16l2.5-2.5M16 16l-2.5-2.5" stroke-linecap="round"/><rect x="9.5" y="7.5" width="5" height="9" rx="1"/><path d="M12 16.5v4" stroke-linecap="round"/>',
  samturret: '<rect x="2" y="4" width="6.5" height="6.5" rx="0.8"/><rect x="15.5" y="4" width="6.5" height="6.5" rx="0.8"/><rect x="9.5" y="5.5" width="5" height="4.5" rx="0.8"/><path d="M9.8 5.5a2.2 2.2 0 0 1 4.4 0" fill="none"/><path d="M12 10v4M12 14l-6 7M12 14l6 7M12 14v7" fill="none" stroke-linecap="round"/>',
  helicopter: '<ellipse cx="10" cy="14" rx="7" ry="4"/><rect x="16" y="13" width="6" height="2" rx="1"/><rect x="9" y="6" width="2" height="6" rx="1"/><path d="M2 6h16" fill="none" stroke-linecap="round"/><rect x="7" y="18" width="6" height="2" rx="1"/>',
};

/* `<svg>` markup for a streak's icon, sized by the caller via CSS. Falls
   back to a plain dot rather than throwing if a def is ever added without
   one — a missing icon shouldn't break the card it's on. */
export function streakIconSvg(id) {
  const paths = STREAK_ICON_PATHS[STREAK_DEFS[id]?.icon] || '<circle cx="12" cy="12" r="4"/>';
  return `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.4" aria-hidden="true">${paths}</svg>`;
}

/* The streak's badge, BO2 style: a bevelled metal hexagon (silver, gold or
   red by tier, def.badge) with its symbol stamped in the middle. Used on the
   HUD slots and in the lobby picker. `dim`: not earned yet. */
const BADGE_METALS = {
  silver: ["#f4f6f8", "#9aa3ad", "#59616b", "#1d2127"],
  gold:   ["#fff1b8", "#e2b340", "#98701c", "#2a1d06"],
  red:    ["#ffc2b8", "#e2463a", "#8e1a14", "#2a0706"],
};
let badgeSeq = 0;
export function streakBadgeSvg(id, { dim = false } = {}) {
  const def = STREAK_DEFS[id];
  const [hi, mid, lo, ink] = BADGE_METALS[def?.badge] || BADGE_METALS.silver;
  const g = `ssb${++badgeSeq}`;
  const paths = STREAK_ICON_PATHS[def?.icon] || '<circle cx="12" cy="12" r="4"/>';
  return `<svg viewBox="0 0 64 64" aria-hidden="true"${dim ? ' class="is-dim"' : ""}>
<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset=".5" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></linearGradient></defs>
<path d="M32 2 58 17v30L32 62 6 47V17z" fill="${ink}" opacity=".85"/>
<path d="M32 5 55.5 18.5v27L32 59 8.5 45.5v-27z" fill="url(#${g})"/>
<path d="M32 11 50 21.5v21L32 53 14 42.5v-21z" fill="${ink}" opacity=".9"/>
<path d="M32 13 48 22.3v19.4L32 51 16 41.7V22.3z" fill="none" stroke="${mid}" stroke-width="1.2" opacity=".7"/>
<g transform="translate(18 18) scale(1.17)" fill="${hi}" stroke="${hi}" stroke-width="1.2">${paths}</g>
</svg>`;
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
    this.gifted = {};    // how many of those came from a care package (free)
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
    this.gifted[id] = (this.gifted[id] || 0) + 1;
    return true;
  }

  /* Calling one spends the charge and the score it cost. The meter is not
     zeroed: banking toward the next streak is the whole point of the ladder. */
  spend(id) {
    if (!this.ready(id)) return false;
    this.charges[id] -= 1;
    if (this.charges[id] <= 0) delete this.charges[id];
    // A care package's streak was a gift: calling it doesn't touch the meter.
    if (this.gifted[id] > 0) { this.gifted[id] -= 1; return true; }
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
