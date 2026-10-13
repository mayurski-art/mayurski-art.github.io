// Troll Forces touch buttons: icons that say what the button does right now
// (user, 2026-10-13: "instead of the fire bullet icon, it should change
// based on what is being pointed at for mobile devices").
//
//   Fire        a bullet when you're armed; in Socialize a mug to sip, a
//               shot glass, the piano's keys, a fist in a fight.
//   Context     the swap button turned hold-X button (combat/weapons.js
//               setTouchContext): the action's icon over its word, e.g. a
//               hand on "Grab", a bottle on "Fill", a lock on "Cuff".
//
// 24x24 stroked paths, drawn like the HUD's other icons (currentColor,
// round caps). A word with no icon here keeps the word alone.

const P = (...d) => d.map((x) => `<path d="${x}"/>`).join("");
const HAND = P("M7 11V6.5a1.5 1.5 0 0 1 3 0V11", "M10 10V5a1.5 1.5 0 0 1 3 0v5", "M13 10V6a1.5 1.5 0 0 1 3 0v4",
  "M16 9.5a1.5 1.5 0 0 1 3 0V14c0 4-3 7-7 7-3 0-5-1.8-6.4-4.4L3.8 13a1.5 1.5 0 0 1 2.6-1.5L7 13");
const MUG = P("M5 9h10v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z", "M15 11.5h2a2.5 2.5 0 0 1 0 5h-2",
  "M5 9c0-2 1.6-3 3-2.2C8.8 5.2 11.4 5 12.6 6.6 14 6 15 7.2 15 9");
const SHOT = P("M6 6h12l-1.6 13a2 2 0 0 1-2 1.8H9.6a2 2 0 0 1-2-1.8z", "M7 11h10");
const BOTTLE = P("M10 2.5h4v3.5l2 3V20a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 20V9l2-3z", "M8 13h8");
const FIST = P("M7 10.5V8a1.5 1.5 0 0 1 3 0v2", "M10 10V7a1.5 1.5 0 0 1 3 0v3", "M13 10V7.5a1.5 1.5 0 0 1 3 0V10",
  "M16 10a1.5 1.5 0 0 1 3 0v3.5c0 4-2.6 7-6.5 7S6 18 6 14.5V12a1.5 1.5 0 0 1 3 0", "M9 13.5h4");
const NOTE = P("M9 18V5.5l11-2V16", "M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3z", "M20 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3z");
const BULLET = P("M12 2.5c2.2 2 3.2 4.6 3.2 7.2V17H8.8V9.7c0-2.6 1-5.2 3.2-7.2z", "M8.8 13h6.4", "M8 20.5h8");
const STAR = P("M12 3l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.3 6.8 19l1-5.8L3.6 9.1l5.8-.8z");
const LOCK = P("M6 11h12v9.5H6z", "M8.5 11V8a3.5 3.5 0 0 1 7 0v3", "M12 14.5v2.5");
const UNLOCK = P("M6 11h12v9.5H6z", "M8.5 11V8a3.5 3.5 0 0 1 6.8-1.2", "M12 14.5v2.5");
const DOOR = P("M14 3.5H6v17h8", "M10 12h10.5", "M17.5 9l3 3-3 3");
const PLATE_DOWN = P("M4 18h16", "M7 18V12h10v6", "M12 4v6", "M9 7.5l3 2.5 3-2.5");

const FIRE = { bullet: BULLET, sip: MUG, shot: SHOT, keys: NOTE, fist: FIST };

const CONTEXT = {
  Take: HAND, Grab: HAND, Give: HAND, Hold: HAND,
  Fill: BOTTLE, Pour: BOTTLE, Tonic: BOTTLE,
  Mug: MUG, Set: PLATE_DOWN,
  Fight: FIST,
  Keys: NOTE, DJ: P("M4 14v-2a8 8 0 0 1 16 0v2", "M4 14h3v6H4z", "M17 14h3v6h-3z"),
  Badge: STAR,
  Apron: P("M9 3h6v4l3 1.5V21H6V8.5L9 7z", "M9 7h6", "M6 12h12"),
  Bag: P("M4 8.5h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z", "M9 8.5V5.5h6v3", "M12 11.5v6", "M9 14.5h6"),
  Cap: P("M3.5 15c0-4.4 3.8-7.5 8.5-7.5s8.5 3.1 8.5 7.5z", "M2.5 15h19", "M12 7.5V5"),
  Whistle: P("M3 9.5h9.5a5 5 0 1 1-4.8 6.4H6L3 13z", "M12.5 9.5l6-4", "M12.5 14.5h.01"),
  Cuff: LOCK, Lock: LOCK, Uncuff: UNLOCK,
  Ticket: P("M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z", "M14.5 7v10"),
  Board: P("M6 3.5h12a2 2 0 0 1 2 2V16H4V5.5a2 2 0 0 1 2-2z", "M4 10.5h16", "M8 19.5L6 21.5", "M16 19.5l2 2", "M8 13.5h.01", "M16 13.5h.01"),
  Bell: P("M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z", "M10 20.5a2 2 0 0 0 4 0"),
  Sit: P("M7 3v18", "M7 12h10v9", "M7 16h10"),
  Check: P("M5 12.5l4.5 4.5L19 7.5"),
  Line: P("M5 6h.01", "M5 12h.01", "M5 18h.01", "M9 6h10", "M9 12h10", "M9 18h10"),
  Leave: DOOR,
};

/* The fire buttons' icon: "bullet" | "sip" | "shot" | "keys" | "fist". */
let fireKind = "bullet";
export function setFireIcon(kind, els) {
  const k = FIRE[kind] ? kind : "bullet";
  if (k === fireKind) return;
  fireKind = k;
  for (const b of els) {
    const svg = b?.querySelector("svg");
    if (svg) svg.innerHTML = FIRE[k];
    if (b) b.dataset.icon = k;
  }
}

/* The context button's icon for action word `ctx`, or null. */
export const contextIcon = (ctx) => CONTEXT[ctx] || null;
