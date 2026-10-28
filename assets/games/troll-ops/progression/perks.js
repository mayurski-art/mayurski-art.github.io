// Troll Forces perks: Black Ops 2's list, one pick per tier, in every class
// (user, 2026-10-10: "For now make them just like in call of duty black ops
// 2. I plan to customize them in the future"). Tuning lives in PERK_TUNE so
// the numbers can be changed in one place.
//
// What each one does here (the hooks live with the system they touch):
//   Lightweight          move speed (view/player-update.js)
//   Hardline             scorestreaks cost less (scorestreaks.js costFor)
//   Blind Eye            air support can't pick you (streaks/air.js, fire.js, warship.js, bot-streaks.js)
//   Flak Jacket          explosive damage to you (combat/damage.js)
//   Ghost                off the enemy UAV while you move (core/minimap.js, streaks/fire.js)
//   Toughness            the hit kick (combat/damage.js)
//   Cold Blooded         dogs and AI gunners don't pick you; no red name (k9, bot-streaks.js, remote-players.js)
//   Fast Hands           throwables come out and go faster (combat/throw-anim.js)
//   Hard Wired           counter-UAV and EMP don't touch you (streaks/calling.js, combat/throwables.js)
//   Scavenger            bodies drop ammo packs (combat/scavenger.js)
//   Dexterity            faster ADS, fire out of a sprint (attachments.js perk mods, player-update.js)
//   Extreme Conditioning sprint speed (view/player-update.js)
//   Engineer             enemy streaks seen through walls (streak-entities.js)
//   Tactical Mask        flashes, stuns and EMPs on you (combat/throwables.js)
//   Dead Silence         others don't hear your steps (net.js flag, game.js steps)
//   Awareness            you hear enemy steps louder (game.js steps)

import { rankUnlocked } from "./progression.js?v=p5-wst-sb2-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-nf1-or1-rfx1-ret1";

export const PERK_TIERS = 3;

/* Unlock levels roughly in BO2's order: two free picks per tier from the
   start, the rest through the levels. */
export const PERK_DEFS = {
  lightweight: { id: "lightweight", tier: 0, rank: 0, name: "Lightweight", blurb: "Move faster." },
  flakjacket: { id: "flakjacket", tier: 0, rank: 0, name: "Flak Jacket", blurb: "Take far less damage from explosions." },
  hardline: { id: "hardline", tier: 0, rank: 4, name: "Hardline", blurb: "Scorestreaks cost 20% less." },
  blindeye: { id: "blindeye", tier: 0, rank: 13, name: "Blind Eye", blurb: "Air support can't see you: drones, the Swarm, gunships and strikes look straight past." },
  ghost: { id: "ghost", tier: 0, rank: 22, name: "Ghost", blurb: "Off the enemy UAV while you're moving. A VSAT still shows you." },

  toughness: { id: "toughness", tier: 1, rank: 0, name: "Toughness", blurb: "Getting shot barely knocks your aim." },
  fasthands: { id: "fasthands", tier: 1, rank: 0, name: "Fast Hands", blurb: "Throwables come out and go twice as fast." },
  scavenger: { id: "scavenger", tier: 1, rank: 7, name: "Scavenger", blurb: "Enemies you kill drop ammo. Walk over it for a mag and a throwable." },
  coldblooded: { id: "coldblooded", tier: 1, rank: 16, name: "Cold Blooded", blurb: "Dogs and AI gunners don't pick you, and your name never shows red." },
  hardwired: { id: "hardwired", tier: 1, rank: 25, name: "Hard Wired", blurb: "Counter-UAVs and EMPs don't touch your radar or HUD." },

  dexterity: { id: "dexterity", tier: 2, rank: 0, name: "Dexterity", blurb: "Aim down sights twice as fast and fire straight out of a sprint." },
  extremeconditioning: { id: "extremeconditioning", tier: 2, rank: 0, name: "Extreme Conditioning", short: "Extreme Cond.", blurb: "Sprint faster." },
  tacticalmask: { id: "tacticalmask", tier: 2, rank: 10, name: "Tactical Mask", blurb: "Flashbangs, stuns and EMPs barely touch you." },
  deadsilence: { id: "deadsilence", tier: 2, rank: 19, name: "Dead Silence", blurb: "Nobody hears your footsteps." },
  awareness: { id: "awareness", tier: 2, rank: 28, name: "Awareness", blurb: "Enemy footsteps are twice as loud." },
  engineer: { id: "engineer", tier: 2, rank: 31, name: "Engineer", blurb: "See enemy scorestreaks through walls." },
};
export const PERK_IDS = Object.keys(PERK_DEFS);
export const perksInTier = (tier) => PERK_IDS.filter((id) => PERK_DEFS[id].tier === tier);

/* The numbers, in one place for retuning. */
export const PERK_TUNE = {
  lightweightSpeed: 1.07,
  hardlineCost: 0.8,
  flakJacket: 0.35,
  toughnessKick: 0.25,
  fastHands: 2,
  dexterityAds: 0.5,
  dexteritySprintOut: 0.5,
  extremeSprint: 1.08,
  tacticalMask: 0.2,
  awarenessSteps: 2,
  scavengerMax: 12,
};

export function perkUnlocked(id) {
  const def = PERK_DEFS[id];
  return !!def && rankUnlocked(def.rank);
}

/* A class's three, each checked: the saved pick if it's that tier's and
   unlocked, else nothing (a class can run without a perk in a tier). */
export function validPerks(picks) {
  return [0, 1, 2].map((t) => {
    const id = picks?.[t];
    return PERK_DEFS[id]?.tier === t && perkUnlocked(id) ? id : null;
  });
}

/* The perks you're carrying this life: game.js fills game.player.perks from
   the active class on every spawn, so a class change lands on the respawn. */
let carried = new Set();
export function setCarriedPerks(ids) { carried = new Set(ids.filter(Boolean)); }
export function hasPerk(id) { return carried.has(id); }
export function carriedPerks() { return [...carried]; }

/* Over the wire: the perks another player's client has to know about. */
export const WIRE_PERKS = { ghost: 1, deadsilence: 2, coldblooded: 4, blindeye: 8 };
export function perkBits(ids = carried) {
  let b = 0;
  for (const [id, bit] of Object.entries(WIRE_PERKS)) if (ids.has(id)) b |= bit;
  return b;
}

/* A bot's level: net.js botLevel's hash (net.js imports nothing, so it
   keeps its own copy; the two must stay the same). */
function botLevel(id) {
  let h = 2166136261;
  for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return 1 + ((h >>> 0) % 69);
}

/* A bot's class perks: one a tier, fixed per bot id, only what its level
   has unlocked. The host simulates their effects (bots.js); the wire bits
   (pk) let every client honour Ghost, Dead Silence, Cold Blooded and Blind
   Eye on a bot exactly as on a player. */
export function botPerks(id) {
  const level = botLevel(id);
  let h = 0x9e3779b9;
  for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 2654435761);
  return new Set([0, 1, 2].map((t) => {
    const open = perksInTier(t).filter((p) => PERK_DEFS[p].rank <= level);
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    return open[(h >>> 0) % open.length];
  }));
}
export const peerHas = (peer, id) => !!((peer?.perks | 0) & (WIRE_PERKS[id] || 0));

/* Line-art glyphs, one per perk, like the scorestreaks' (currentColor). */
const PERK_ICON_PATHS = {
  lightweight: '<path d="M4 15c4 0 6-2 8-6 1.5 3 3.5 4.5 8 5" fill="none" stroke-linecap="round" stroke-width="2"/><path d="M3 19h18" stroke-linecap="round" fill="none"/><path d="M9 6l3-3 3 3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  flakjacket: '<path d="M7 3l5 2 5-2 3 4-2 3v11H6V10L4 7z"/><path d="M12 5v16" stroke="#0d1410" stroke-width="1.2"/><path d="M8 12h2M14 12h2M8 16h2M14 16h2" stroke="#0d1410" stroke-width="1.2"/>',
  hardline: '<circle cx="12" cy="12" r="8.5" fill="none" stroke-width="1.8"/><path d="M12 7v10M9 9.5c0-1.4 1.3-2 3-2s3 .7 3 2-1.3 1.8-3 2.3-3 1-3 2.3 1.3 2 3 2 3-.6 3-2" fill="none" stroke-linecap="round"/>',
  blindeye: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z" fill="none" stroke-width="1.8"/><circle cx="12" cy="12" r="2.6"/><path d="M3 21L21 3" stroke-linecap="round" stroke-width="2.2"/>',
  ghost: '<path d="M5 21V10a7 7 0 0 1 14 0v11l-2.4-2-2.3 2-2.3-2-2.3 2-2.3-2z"/><circle cx="9.5" cy="10.5" r="1.4" fill="#0d1410" stroke="none"/><circle cx="14.5" cy="10.5" r="1.4" fill="#0d1410" stroke="none"/>',
  toughness: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/><path d="M8.5 12l2.5 2.5 4.5-5" fill="none" stroke="#0d1410" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  fasthands: '<path d="M8 21v-7l-3-3 1.5-1.5L9 12V4.5a1.5 1.5 0 0 1 3 0V11h.5V3.5a1.5 1.5 0 0 1 3 0V11h.5V5.5a1.5 1.5 0 0 1 3 0V15l-3 6z"/><path d="M1 8h3M1 12h2" stroke-linecap="round" fill="none"/>',
  scavenger: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M8 9V6h8v3" fill="none" stroke-width="1.8"/><path d="M8 13v4M11 13v4M14 13v4M17 13v4" stroke="#0d1410" stroke-width="1.6" stroke-linecap="round"/>',
  coldblooded: '<path d="M12 2v20M3.5 7l17 10M3.5 17l17-10" stroke-linecap="round" fill="none" stroke-width="2"/><path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5" fill="none" stroke-linecap="round"/>',
  hardwired: '<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M10 7V3M14 7V3M10 21v-4M14 21v-4M3 10h4M3 14h4M17 10h4M17 14h4" stroke-linecap="round" fill="none"/>',
  dexterity: '<circle cx="12" cy="12" r="7" fill="none" stroke-width="1.8"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5" stroke-linecap="round" fill="none"/><circle cx="12" cy="12" r="1.6"/>',
  extremeconditioning: '<circle cx="14" cy="4" r="2.2"/><path d="M9 21l3-6-3-3 2-5 4 3 3 1M12 15l4 2v4M9 9H5l-2 3" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>',
  tacticalmask: '<path d="M3 9c3-3 15-3 18 0l-1 6c-1.5 3-4 4-8 4s-6.5-1-8-4z"/><circle cx="8.5" cy="12" r="2.3" fill="#0d1410" stroke="none"/><circle cx="15.5" cy="12" r="2.3" fill="#0d1410" stroke="none"/>',
  deadsilence: '<path d="M3 9h4l5-4v14l-5-4H3z"/><path d="M15 9l6 6M21 9l-6 6" stroke-linecap="round" fill="none" stroke-width="2"/>',
  awareness: '<path d="M7 13a5 5 0 1 1 9.5 2.2c-1 1.8-3 2.3-3 4.3a2.5 2.5 0 0 1-5 0" fill="none" stroke-width="1.8" stroke-linecap="round"/><path d="M19 5a9 9 0 0 1 2 6M17 7.5a5 5 0 0 1 1 3" fill="none" stroke-linecap="round"/>',
  engineer: '<path d="M14.5 3a5 5 0 0 0-5.3 6.8L3 16v3h3l6.2-6.2A5 5 0 0 0 19 7.5l-3 3-2.5-.5-.5-2.5z"/>',
};

export function perkIconSvg(id) {
  const paths = PERK_ICON_PATHS[id] || '<circle cx="12" cy="12" r="4"/>';
  return `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.4" aria-hidden="true">${paths}</svg>`;
}

/* BO2's perk colours: one per tier. */
export const PERK_TIER_COLORS = ["#3f8de0", "#e0483f", "#e5b234"];
export const PERK_TIER_NAMES = ["Perk 1", "Perk 2", "Perk 3"];
