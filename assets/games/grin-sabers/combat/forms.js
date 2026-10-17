// Grin Sabers — the seven classic lightsaber forms (design doc, "Saber forms").
//
// damage: a light swing's HP; a heavy does HEAVY_MULT of it.
// speed: swing speed, 1 = base timings (SWING_BASE below).
// combo: how many swings chain before a forced recovery.
// blockPower: 0..100, how little block points a blocked hit costs you.
// Phase 1 plays Shii-Cho only; the rest are data for phase 2.

export const HEAVY_MULT = 2.5;

// Base timings in seconds at speed 1.
export const SWING_BASE = {
  windup: 0.3,        // light: cocking the blade back (the tell)
  strike: 0.17,       // the blade travelling through the target: hits land here
  recover: 0.3,       // back to the guard
  chainWindup: 0.6,   // a chained swing's windup, as a share of a fresh one
  heavyWindup: 0.62,  // the heavy's long, readable windup
  heavyStrike: 0.22,
};

export const FORMS = {
  shiicho: { id: "shiicho", name: "Shii-Cho",        form: "Form I",   damage: 10, speed: 1.2, combo: 4, blockPower: 70, swingCost: 3, stance: "mid" },
  makashi: { id: "makashi", name: "Makashi",         form: "Form II",  damage: 9,  speed: 1.4, combo: 5, blockPower: 60, swingCost: 3, stance: "low" },
  soresu:  { id: "soresu",  name: "Soresu",          form: "Form III", damage: 7,  speed: 1.0, combo: 3, blockPower: 95, swingCost: 2, stance: "high" },
  ataru:   { id: "ataru",   name: "Ataru",           form: "Form IV",  damage: 12, speed: 1.3, combo: 4, blockPower: 50, swingCost: 5, stance: "mid" },
  shien:   { id: "shien",   name: "Shien / Djem So", form: "Form V",   damage: 18, speed: 0.9, combo: 3, blockPower: 55, swingCost: 5, stance: "high" },
  niman:   { id: "niman",   name: "Niman",           form: "Form VI",  damage: 11, speed: 1.1, combo: 4, blockPower: 65, swingCost: 3, stance: "mid" },
  juyo:    { id: "juyo",    name: "Juyo / Vaapad",   form: "Form VII", damage: 14, speed: 1.2, combo: 6, blockPower: 40, swingCost: 4, stance: "low" },
};

/* Block points a blocked hit of `damage` costs a defender in `form`. */
export function blockCost(form, damage) {
  return damage * (100 - form.blockPower) / 25 + 4;
}
