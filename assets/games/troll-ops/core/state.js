// Troll Forces: the match state the split-out systems share.
//
// game.js grew to 16,865 lines with 226 top-level `let`s any part of it
// could read or write, so a change in one system reached others nobody
// could see. As each system moves out of game.js into its own folder (the
// split plan, 2026-10-06), the variables it shares move here, as fields:
// `stageT` becomes `match.stageT`, renamed in game.js in the same commit.
// `grep "match\."` then lists every cross-system dependency.
//
// Only what two or more systems touch lives here. State one system owns
// stays inside that system's module.

/* What a split-out module still reaches back into game.js for: game.js's
   functions, objects and variables, by name (`game.camera`,
   `game.currentWeapon()`). game.js fills it once, from its linkGame({...})
   table near the top, so that list is every place a module depends on
   game.js. Variables are getters (and setters when a module writes them),
   so a module always sees game.js's current value. Entries leave the table
   as the code they name moves out. */
export const game = {};
export function linkGame(table) {
  Object.defineProperties(game, Object.getOwnPropertyDescriptors(table));
}

/* This match: clock, phase, mode-wide flags. */
export const match = {};

/* The room: who is in it, who hosts, its map and mode. */
export const room = {};
