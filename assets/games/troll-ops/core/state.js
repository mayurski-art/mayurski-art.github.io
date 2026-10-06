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

/* This match: clock, phase, mode-wide flags. */
export const match = {};

/* The room: who is in it, who hosts, its map and mode. */
export const room = {};
