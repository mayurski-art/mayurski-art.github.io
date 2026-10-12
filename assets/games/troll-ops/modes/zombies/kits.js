// Troll Forces Zombies: kits and their deployables, as data. A kit (Zombie
// Rush's "class") is the three things you can put down in a run; the
// Rookie kit is the starter: a turret, a spike barricade and a barrel. The
// other kits (Medic, Recon, Trapper, Pyro, Demolitionist) slot in here
// later with their own deployables; deployables.js builds whatever a kit
// lists. Kit levels (P6, Credits) scale `level` stats.
//
// Distances are metres. Zombie Rush quotes studs (about 0.28 m): its
// turret's 56-stud range is ~16 m, the barrel's 19-stud blast ~5.3 m.
// Health and damage are tuned to our zombies (healthForRound: 150 HP on
// wave 1, ~1,000 by wave 10, ~7,000 by wave 30), not copied.

export const DEPLOYABLES = {
  turret: {
    id: "turret", name: "Auto Turret", short: "Turret", kind: "turret",
    price: 120, priceGrowth: 1.35,   // each one you put down costs more
    max: 3,                          // standing at once
    hp: 280,
    range: 16, fireRate: 6, damage: 18,   // ~108 DPS at level 1
    turn: 5.5,                       // rad/s the head slews
    size: { w: 0.9, d: 0.9, h: 1.05 },
    levelUp: { damage: 0.1, hp: 0.1, range: 0.04 },
  },
  barricade: {
    id: "barricade", name: "Barricade", short: "Barricade", kind: "barricade",
    price: 150, priceGrowth: 1.2,
    max: 6,
    hp: 340,
    spikeDps: 30,                    // to a zombie pressed against it
    size: { w: 2.4, d: 0.6, h: 1.3 },
    levelUp: { hp: 0.08, spikeDps: 0.1 },
  },
  barrel: {
    id: "barrel", name: "Explosive Barrel", short: "Barrel", kind: "barrel",
    price: 90, priceGrowth: 1,       // a consumable: always the same
    max: 6,
    hp: 28,                          // two swings and it goes up
    damage: 750, minDamage: 150, radius: 5.4,
    chainDelay: 0.16,                // a barrel caught in the blast follows
    size: { w: 0.9, d: 0.9, h: 1.15 },
    levelUp: { damage: 0.1, radius: 0.05 },
  },
};

export const KITS = {
  rookie: {
    id: "rookie", name: "Rookie",
    blurb: "A starter kit with dependable defense, blocking and a simple explosive.",
    deployables: ["turret", "barricade", "barrel"],
  },
};

export const DEFAULT_KIT = "rookie";

/* A deployable's stats at a kit level (1 = base). */
export function statsAt(id, level = 1) {
  const d = DEPLOYABLES[id];
  const out = { ...d };
  const k = Math.max(0, level - 1);
  for (const [stat, per] of Object.entries(d.levelUp || {})) out[stat] = d[stat] * (1 + per * k);
  return out;
}

/* What the next one costs, with `placed` already put down this run. */
export function priceOf(id, placed) {
  const d = DEPLOYABLES[id];
  return Math.round((d.price * Math.pow(d.priceGrowth, placed)) / 5) * 5;
}
