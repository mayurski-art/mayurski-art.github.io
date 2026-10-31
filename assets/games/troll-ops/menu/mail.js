// Trollnite's mail from the game (user, 2026-10-31: "just mail like event
// prizes event items unlocked like the pumpkin. a halloween update mail,
// etc."). Prizes and unlocks arrive on their own (progression/grants.js,
// progression/challenges.js); this is the news the game sends everyone: an
// update, an event starting. Each letter goes out from its `from` date (to
// its `until`, if it has one) into every player's Mail (menu/inbox.js), once
// per account, the first time they open the game after it's out.
//
// To send a new one: add a letter at the TOP, with an id never used before.

import { SEASON } from "../core/season.js?v=zf1-wb1";

export const LETTERS = [
  {
    id: "mail-2026-halloween-update",
    from: new Date(2026, 9, 26),
    until: SEASON.end,
    title: "Halloween update",
    body: "Hollowgrin is open: the island's haunted underside, with its fair, chapel and woods. Halloween challenges are live until 12 November, and everyone who plays Chapter One gets the Pumpkin Head free. Tap the pumpkin on the start screen for the Halloween look.",
    cta: "See the challenges",
    screen: "quests",
  },
  {
    id: "mail-2026-chapter-one",
    from: new Date(2026, 9, 26),
    title: "Welcome to Chapter One",
    body: "Season OG has started. Daily and weekly challenges pay XP, your progress follows your account to every device, and guests keep everything they earn when they sign up.",
    cta: "Open Quests",
    screen: "quests",
  },
];

/* The letters out now, oldest first (so the newest ends up on top). */
export function lettersDue(now = Date.now()) {
  return LETTERS.filter((l) => now >= l.from.getTime() && (!l.until || now <= l.until.getTime())).reverse();
}
