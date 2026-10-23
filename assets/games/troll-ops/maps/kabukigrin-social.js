// Troll Forces — Kabukigrin in Socialize (doc docs/KABUKIGRIN.md 4.1):
// Trolling Loud's door moved to the club's front on A Main, the whole east
// half of Grinjuku as the street. What the Socialize modules read off the
// map (town-npcs.js, club-entry.js, social-rp.js, dj-lulz.js): the rooms and
// which can see which, the door's people and places, the seats (Studio's
// booths, stools and sofas: models/kb-town.glb), and the crowd.
//
// Rooms: the hall (the lobby is its front), the mezzanine and the riser
// under it, the office, the tatami room, the back of house; everything else
// is the street (the yard is open to the backs, so it's street too).

import { rng } from "./trollcity-kit.js?v=tc2-wst-tc3-sh1-sr1-pf1-or1-tcs1-tx1-ch1-sp1";
import { pickOutfit } from "../characters/outfits.js?v=of1m1-nc1-cd1-sh1-hr2-zp1-sr1-or1";

// the camera's yaw facing each way (0 faces -z, +PI/2 faces -x)
const FACE_YAW = { "+z": Math.PI, "-z": 0, "+x": -Math.PI / 2, "-x": Math.PI / 2 };
const MEZZ = 3, STAGE_TOP = 0.45, TATAMI = 0.3, STOOL = 0.76;

/* ------------------------------------------------------------ the rooms */
export function kbZone(x, y, z) {
  // A Main, the lane the club's door opens onto: it and the hall see each other
  if (x >= -32 && x <= -14.4 && z >= -32 && z < 3.9) return "aMain";
  if (x < -32 || x > -6 || z < 3.9 || z > 34) return "street";
  if (z > 24) return x < -24.15 && z < 29.85 ? "vip" : "back";
  if (x > -14.2 && y > MEZZ - 0.5) return z > 19 ? "office" : "mezz";
  if (x > -14.2) return "riser";   // under the mezzanine: the mid rope room, the bar's back
  return "hall";
}
// (the rest of the street sees neither: the blocks stand between)
const SEES = {
  aMain: ["hall"], street: ["riser"], hall: ["aMain", "mezz", "vip", "back"], mezz: ["hall", "office"], office: ["mezz", "hall"],
  vip: ["hall", "back"], back: ["hall", "vip"], riser: ["street"],
};
export const KB_VIEW = { zoneOf: kbZone, sees: (a, b) => a === b || SEES[a]?.includes(b) };

/* The door's zones (modes/club-entry.js): a guest band opens the hall, the
   mezzanine and the riser; the tatami room and the staff rooms (the back of
   house, the office) stay guarded. */
function entryZoneOf(x, y, z) {
  const k = kbZone(x, y, z);
  return k === "street" || k === "aMain" ? "street" : k === "vip" ? k : k === "back" || k === "office" ? "back" : "main";
}

/* Where the door's people stand. The club's front door looks north up A
   Main (the street is -z): the rope across it, Big Lulz and Tank either
   side, the line running up the lane along the west edge wall, in through
   the door to the lobby, the bounced on the lane's far side, newcomers
   walking down A Main from the spawn. */
const MOUTH = { x: -27.6, z: 3.0 };
export const KB_DOOR = {
  line: Array.from({ length: 9 }, (_, i) => ({ x: -29.2, z: 1.2 - i * 0.95 })),
  lanes: [
    { bouncer: "Big Lulz", x: -29.9, z: 2.2 },
    { bouncer: "Tank", x: -25.3, z: 2.2 },
  ],
  mouth: MOUTH,
  rope: { a: { x: -29.4, z: 3.5 }, b: { x: -25.8, z: 3.5 }, y: 0.84 },
  lobby: { x: -27, z: 7, y: 0, yaw: Math.PI },
  curb: { x: -25.5, z: -3, yaw: Math.PI },
  arrive: { x: -27, z: -24 },
  // club-entry.js's own numbers (the throw, the curb, the rope's reach) are
  // Trolling Loud's, whose street is +z of its door: turned half round here,
  // its mouth (0, 23.4) onto this one
  frame: { s: -1, ox: MOUTH.x, oz: MOUTH.z + 23.4 },
  // the bandana guy's corner on the way up the lane and back (clear of the Sewers' mouth)
  bandana: { in: { x: -27.6, z: -5 }, out: { x: -25.8, z: -5.6 } },
  zoneOf: entryZoneOf,
};

/* ------------------------------------------------------------ the seats

   Studio's furniture (Club.Furniture): three booths on the hall's walls,
   six stools at the bar, a sofa on the mezzanine facing the floor and one
   in the green room; the tatami room's cushions and the yokocho's stools. */
export const KB_SEATS = [];
function seatAt(x, z, y, floor, yaw, kind, out = 0.75) {
  KB_SEATS.push({ x, z, y, floor, yaw, kind, stand: { x: x - Math.sin(yaw) * out, z: z - Math.cos(yaw) * out } });
}
// a booth 2.5 m long along x against a wall, facing `face`; three places
export const KB_BOOTHS = [
  { x: -22.0, z: 4.55, face: "+z" },
  { x: -23.3, z: 23.4, face: "-z" },
  { x: -19.7, z: 23.4, face: "-z" },
];
for (const b of KB_BOOTHS) {
  const dz = b.face === "+z" ? 0.25 : -0.25;
  for (const dx of [-0.8, 0, 0.8]) seatAt(b.x + dx, b.z + dz, 0.45, 0, FACE_YAW[b.face], "bench");
}
export const KB_BAR_STOOLS = [9.0, 10.3, 11.6, 12.9, 14.2, 15.5].map((z) => ({ x: -16.85, z }));
for (const s of KB_BAR_STOOLS) seatAt(s.x, s.z, STOOL, 0, FACE_YAW["+x"], "stool", 0.6);
export const KB_SOFAS = [
  { x: -6.8, z: 15.5, len: 3, face: "-x", y: MEZZ },     // the mezzanine's, facing the floor
  { x: -8.5, z: 33.35, len: 3, face: "-z", y: 0 },       // the green room's
];
for (const s of KB_SOFAS) {
  for (const u of [-1, 0, 1]) {
    const [x, z] = s.face === "-x" ? [s.x - 0.1, s.z + u * 0.95] : [s.x + u * 0.95, s.z - 0.1];
    seatAt(x, z, s.y + 0.42, s.y, FACE_YAW[s.face], "bench");
  }
}
// the tatami room's cushions (on the mats, kneeling height) and the yokocho's stools
const ZABUTON = [[-29.9, 25.2, "+z"], [-29.9, 26.6, "-z"], [-29.9, 27.6, "+z"], [-29.9, 29.0, "-z"], [-24.9, 26.0, "+z"], [-24.9, 28.0, "-z"]];
for (const [x, z, face] of ZABUTON) seatAt(x, z, TATAMI + 0.12, TATAMI, FACE_YAW[face], "cushion", 0.6);
const YOKO_BARS = [[9.0, 1], [11.5, -1], [14.0, 1], [16.5, -1], [19.0, 1], [21.3, -1]];
for (const [x, side] of YOKO_BARS) {
  for (const dx of [-0.55, 0.55]) seatAt(x + dx, side > 0 ? -3.68 : -2.32, 0.68, 0, side > 0 ? 0 : Math.PI, "stool", 0.5);
}

/* ------------------------------------------------------------ the crowd

   ~80 in the club (Trolling Loud's density in a hall half its size), ~25 on
   the street (new to the Grinjuku side). `yaw` is the camera's; a seated
   NPC's `y` is the seat top. Seated NPCs take a seat's place (`seat` index)
   so no one sits on anyone. */
const GUESTS = new Set(["Clubgoer", "Raver", "VIP", "Barfly"]);
export function kbNpcs({ DC, DANCE, deck }) {
  const cast = [];
  const add = (name, role, act, spot, extra = {}) => cast.push({ name, role, act, ...spot, ...extra });
  const guard = { height: 1.98, build: 1.4 };
  let n = 0;
  const extra = (role, act, spot, more) => add(`${role} ${++n}`, role, act, spot, more);
  const taken = new Set();
  const sit = (i, role, act, more) => {
    const s = KB_SEATS[i];
    taken.add(i);
    extra(role, act, { x: s.x, z: s.z, y: s.y, yaw: s.yaw, sit: true, ...(s.kind === "stool" && { stool: true }) }, more);
  };
  const seatsOf = (kind, pred = () => true) => KB_SEATS.map((s, i) => [s, i]).filter(([s]) => s.kind === kind && pred(s)).map(([, i]) => i);

  /* ---- the door: two bouncers, the list, the line up the lane */
  add("Big Lulz", "Bouncer", "guard", { x: -29.0, z: 3.0, y: 0, yaw: 0 }, guard);
  add("Tank", "Bouncer", "guard", { x: -26.2, z: 3.0, y: 0, yaw: 0 }, guard);
  add("Clipboard Carl", "Door host", "count", { x: -24.2, z: 2.6, y: 0, yaw: 0 });
  ["phone", "guard", "phone", "dance", "phone", "phone", "guard", "phone"].forEach((act, i) =>
    extra("Clubgoer", act, { x: -29.2 + (i % 3) * 0.12, z: 1.2 - i * 0.95, y: 0, yaw: Math.PI + (i % 2 ? 0.25 : -0.2) }, act === "dance" ? { dance: 0 } : {}));

  /* ---- the lobby: the inside man on the door */
  add("Brick", "Bouncer", "guard", { x: -25.2, z: 5.0, y: 0, yaw: 0.4 }, guard);

  /* ---- the dance floor: the go-go dancer on the podium, the crowd facing
     the DJ on the west wall, the hype man on the stage */
  add("Glitter", "Go-go dancer", "dance", { x: DC.x, z: DC.z, y: 0.28, yaw: FACE_YAW["-x"] }, { dance: 3 });
  add("Hype Hank", "Hype man", "dance", { x: -29.2, z: 12.2, y: STAGE_TOP, yaw: FACE_YAW["+x"] }, { dance: 2 });
  const R = rng(43);
  const spots = [];
  for (let tries = 0; spots.length < 18 && tries < 500; tries++) {
    const x = DANCE.x0 + 0.7 + R() * (DANCE.x1 - DANCE.x0 - 1.4), z = DANCE.z0 + 0.7 + R() * (DANCE.z1 - DANCE.z0 - 1.4);
    if (Math.hypot(x - DC.x, z - DC.z) < 1.7) continue;
    if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 1.2)) continue;
    spots.push({ x, z });
  }
  for (const s of spots) {
    const to = R() < 0.7 ? { x: deck.x, z: deck.z } : { x: DC.x + (R() - 0.5) * 4, z: DC.z + (R() - 0.5) * 4 };
    extra("Raver", "dance", { x: s.x, z: s.z, y: 0, yaw: Math.atan2(s.x - to.x, s.z - to.z) }, { dance: Math.floor(R() * 4) });
  }

  /* ---- the booths (two of three places taken), the bar, the edges */
  KB_BOOTHS.forEach((b, bi) => seatsOf("bench", (s) => Math.abs(s.z - b.z) < 0.5 && Math.abs(s.x - b.x) < 1.3).slice(0, 2)
    .forEach((i, k) => sit(i, "Clubgoer", k ? "phone" : "drink", bi === 1 ? { drink: "whiskey" } : {})));
  add("Shots McGee", "Bartender", "wipe", { x: -14.9, z: 10, y: 0, yaw: FACE_YAW["-x"] });
  add("Pourtia", "Bartender", "count", { x: -14.9, z: 14.4, y: 0, yaw: FACE_YAW["-x"] });
  add("Neon Nina", "Bartender", "wipe", { x: -14.9, z: 12.2, y: 0, yaw: FACE_YAW["-x"] });
  seatsOf("stool", (s) => s.x < -16).forEach((i, k) => { if (k !== 2) sit(i, "Barfly", "drink", k % 3 ? {} : { drink: "whiskey" }); });
  for (const [x, z, yaw] of [[-30.2, 6.2, 2.4], [-29.4, 7.0, -0.8], [-17.6, 6.0, 0.6], [-16.8, 6.8, -2.6], [-17.3, 21.0, -0.3], [-25.0, 21.2, 0.2], [-30.4, 21.6, 2.8], [-29.6, 22.3, -0.4]]) {
    extra("Clubgoer", R() < 0.6 ? "drink" : "phone", { x, z, y: 0, yaw });
  }
  // under @SwishPng's screen, watching it
  for (const x of [-22.4, -21.0]) extra("Clubgoer", "phone", { x, z: 20.8, y: 0, yaw: Math.PI });
  add("Knuckles", "Security", "guard", { x: -16.0, z: 22.7, y: 0, yaw: 0 }, guard);
  add("Rope", "VIP door", "guard", { x: -28.7, z: 22.9, y: 0, yaw: 0.3 }, guard);

  /* ---- the mezzanine: on the glass over the floor, the sofa, the sound
     desk, a stroller */
  for (const z of [6, 8.4, 12.2, 15.6]) extra("Clubgoer", "drink", { x: -13.35, z, y: MEZZ, yaw: FACE_YAW["-x"] });
  seatsOf("bench", (s) => s.floor === MEZZ).slice(0, 2).forEach((i) => sit(i, "Clubgoer", "drink"));
  add("Fader", "Sound tech", "count", { x: -11.9, z: 15.2, y: MEZZ, yaw: 0 });
  extra("Clubgoer", "walk", { y: MEZZ, path: [[-12.7, 5.2], [-12.7, 12.6]], pace: true, at: 0.3 });

  /* ---- the office: the manager at the desk, looking down the floor */
  add("Big Boss", "Manager", "count", { x: -12.35, z: 21.6, y: MEZZ, yaw: FACE_YAW["-x"] });

  /* ---- the tatami room: four of its six cushions, bottle service, one at the koi */
  seatsOf("cushion").slice(0, 4).forEach((i, k) => sit(i, "VIP", "drink", k % 2 ? { drink: "whiskey" } : {}));
  add("Bubbles", "Bottle service", "walk", { y: TATAMI, path: [[-27.6, 25], [-26, 25], [-26, 29.2], [-27.6, 29.2]], at: 0.15 });
  extra("VIP", "phone", { x: -30.6, z: 24.8, y: TATAMI, yaw: FACE_YAW["-x"] });

  /* ---- back of house: the kitchen, the green room, the headliner */
  add("Chef Lolz", "Cook", "cook", { x: -22.6, z: 26.0, y: 0, yaw: FACE_YAW["+x"] });
  add("Suds", "Dishwasher", "wash", { x: -22.6, z: 29.0, y: 0, yaw: FACE_YAW["+x"] });
  add("Skillet", "Runner", "carry", { x: -21.5, z: 27.6, y: 0, yaw: 0, path: [[-21.5, 27.6], [-17.5, 27.6], [-16, 24.6]], pace: true });
  add("MC Kek", "Headliner", "tend", { x: -16.5, z: 30.5, y: 0, yaw: FACE_YAW["+z"] });
  seatsOf("bench", (s) => s.floor === 0 && s.z > 30).slice(0, 2).forEach((i) => sit(i, "Clubgoer", "phone"));

  /* ---- the street, new to the Grinjuku side (doc 4.1): the takoyaki stall
     at B site, the konbini, pairs strolling B Main, smokers by the Vents,
     a guy asleep against B Main's vending machine, the yokocho's regulars */
  add("Tako Taro", "Vendor", "tend", { x: 20, z: 20.3, y: 0, yaw: 0 });
  for (const [x, z] of [[19.3, 19.0], [20.8, 18.9]]) extra("Clubgoer", "drink", { x, z, y: 0, yaw: Math.PI });
  add("Konbini Ken", "Clerk", "count", { x: 21, z: 30.5, y: 0, yaw: 0 });
  for (const at of [0, 0.5]) for (const dx of [0, 0.65]) extra("Clubgoer", "walk", { y: 0, path: [[24.6 + dx, -28], [24.6 + dx, 0]], pace: true, at: at + dx * 0.02 });
  extra("Clubgoer", "phone", { x: 5.6, z: -4.7, y: 0, yaw: 0.6 });
  extra("Clubgoer", "drink", { x: 5.7, z: -1.3, y: 0, yaw: 2.6 });
  extra("Clubgoer", "phone", { x: 24.4, z: -13, y: 0, yaw: FACE_YAW["+x"], sit: true });
  seatsOf("stool", (s) => s.x > 7).forEach((i, k) => { if (k % 3 !== 1) sit(i, "Barfly", "drink", k % 4 ? {} : { drink: "whiskey" }); });
  for (const [x, z, yaw] of [[-30.4, -12, -0.4], [-30.8, -16, 2.8], [-26, -20, 0.3], [-25.4, -20.6, -2.7]]) extra("Clubgoer", "phone", { x, z, y: 0, yaw });

  /* ---- the guy who didn't read the sign (club-entry.js, "the bandana guy"):
     off where the newcomers come from. Last, so no one else's index moves. */
  add("Bandana Benny", "Clubgoer", "phone", { x: KB_DOOR.arrive.x, z: KB_DOOR.arrive.z, y: 0, yaw: Math.PI }, { bandana: true });

  const DR = rng(79);
  for (const c of cast) if (GUESTS.has(c.role)) c.outfit = pickOutfit(c.role === "Barfly" ? "Clubgoer" : c.role, DR());
  return cast;
}

/* The seats a player can take: every one no NPC is on. */
export function kbFreeSeats(cast) {
  return KB_SEATS.filter((s) => !cast.some((c) => c.sit && Math.hypot(c.x - s.x, c.z - s.z) < 0.2 && Math.abs(c.y - s.y) < 0.1));
}
