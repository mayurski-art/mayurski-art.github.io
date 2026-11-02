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

import { rng } from "./trollcity-kit.js?v=tc2-wst-tc3-sh1-sr1-pf1-or1-tcs1-tx1-ch1-sp1-kbt1-pm1-ss1-ss2-ss3-tfm2-ugb1-ug1-ugm1";
import { MACHINES, PARLOUR } from "./kabukigrin-street.js?v=kb10-kb11-kb12-tx1-ch1-sp1-kbt1-kb3-pm1-ss1-ss2-ss3-tfm2-ugb1-ug1-ugm1-pqs1";
import { pickOutfit } from "../characters/outfits.js?v=of1m1-nc1-cd1-sh1-hr2-zp1-sr1-or1-gb3-rh1";
import { FL, B1, HALL, TUNNEL, STAGE, WELLS, underSeats } from "./kabukigrin-under.js?v=kbu1-kbc1-kbc2-kbc3-zf1-zft1";

// the camera's yaw facing each way (0 faces -z, +PI/2 faces -x)
const FACE_YAW = { "+z": Math.PI, "-z": 0, "+x": -Math.PI / 2, "-x": Math.PI / 2 };
const MEZZ = 3, TATAMI = 0.3;

/* ------------------------------------------------------------ the rooms */
export function kbZone(x, y, z) {
  // A Main, the lane the club's door opens onto: it and the hall see each other
  // (the pachinko parlour off its west side is part of it: its doors stand open)
  if (x >= -32 && x <= -14.4 && z >= -32 && z < 3.9) return "aMain";
  if (x >= PARLOUR.back && x < -32 && z >= PARLOUR.z0 && z <= PARLOUR.z1) return "aMain";
  // the dug club (kabukigrin-under.js): everything under the street, and the
  // stairs down from their top step (the front and side stairs' wells in the
  // square are the club's; the yard's staff stair and its tunnel are back of house)
  const inWell = (k) => x >= WELLS[k][0] && x <= WELLS[k][1] && z >= WELLS[k][2] && z <= WELLS[k][3] && y < 0.5;
  if (inWell(2) || (y < -0.3 && x >= TUNNEL.x0 - 0.6 && x <= TUNNEL.x1 + 0.6 && z > HALL.z1 + 0.25 && z <= 41)) return "back";
  if (inWell(0) || inWell(1) || (y < -0.3 && x >= HALL.x0 - 0.6 && x <= HALL.x1 + 0.6 && z >= HALL.z0 - 0.6 && z <= HALL.z1 + 0.25)) return "hall";
  if (x < -32 || x > -6 || z < 3.9 || z > 34) return "street";
  if (z > 24) return x < -24.15 && z < 29.85 ? "vip" : "back";
  if (x > -14.2 && y > MEZZ - 0.5 && z > 19) return "office";
  // Lulz Square, A Heaven over it and the arcade under that: the street now
  return "street";
}
// (the club is under a slab, seen only from inside and through the tunnel;
// the tatami room's door and the office's window open onto the square)
const SEES = {
  aMain: ["street"], street: ["aMain", "office", "vip"], hall: ["back"], office: ["street"],
  vip: ["back", "street"], back: ["hall", "vip"],
};
export const KB_VIEW = { zoneOf: kbZone, sees: (a, b) => a === b || SEES[a]?.includes(b) };

/* The door's zones (modes/club-entry.js): a guest band opens the hall, the
   mezzanine and the riser; the tatami room and the staff rooms (the back of
   house, the office) stay guarded. */
function entryZoneOf(x, y, z) {
  const k = kbZone(x, y, z);
  // (the office is the security room now: the VIP band opens it too, docs/KB-SECURITY-ROOM.md pick 5)
  return k === "street" || k === "aMain" ? "street" : k === "vip" || k === "office" ? "vip" : k === "back" ? "back" : "main";
}

/* Where the door's people stand. The club's front door looks north up A
   Main (the street is -z): the rope across it, Big Lulz and Tank either
   side, the line running up the lane along the west edge wall, in through
   the door to the lobby, the bounced on the lane's far side, newcomers
   walking down A Main from the spawn. */
// (the club's door is the front stair's head in Lulz Square now: the rope
// across the top step, you're let in onto the stair, kabukigrin-under.js S1)
const MOUTH = { x: -26, z: 3.9 };
const DOOR_POSTS = [{ x: -27.9, z: 3.6 }, { x: -24.1, z: 3.6 }];
export const KB_DOOR = {
  line: Array.from({ length: 9 }, (_, i) => ({ x: -29.2, z: 1.2 - i * 0.95 })),
  // (where the guest stands at each bouncer; the bouncers' own posts are
  // DOOR_POSTS, each beside a rope end: Big Lulz steps halfway to the hook)
  lanes: [
    { bouncer: "Big Lulz", x: -28.8, z: 2.8 },
    { bouncer: "Tank", x: -23.5, z: 2.8 },
  ],
  mouth: MOUTH,
  rope: { a: { x: -27.4, z: 4.2 }, b: { x: -24.6, z: 4.2 }, y: 0.84 },
  // on the stair's third tread (S1: 0.2 m risers on 0.3 m treads from z 4.5)
  lobby: { x: -26, z: 5.25, y: -0.6, yaw: Math.PI },
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

   The dug club's furniture (kabukigrin-under.js FURNITURE): seven booths
   under the balcony's arms, six stools at the main bar, four sofas on the
   balcony facing the floor; Studio's on the street: a sofa on A Heaven and
   one in the green room, the tatami room's cushions and the yokocho's
   stools. */
export const KB_SEATS = [];
function seatAt(x, z, y, floor, yaw, kind, out = 0.75) {
  KB_SEATS.push({ x, z, y, floor, yaw, kind, stand: { x: x - Math.sin(yaw) * out, z: z - Math.cos(yaw) * out } });
}
for (const s of underSeats()) seatAt(s.x, s.z, s.y, s.floor, FACE_YAW[s.face], s.kind, s.out);
// the main bar's stools: you can order here (modes/kb-bar.js)
for (const s of KB_SEATS) if (s.kind === "stool" && s.floor === FL) s.bar = true;
export const KB_SOFAS = [
  { x: -6.8, z: 15.5, len: 3, face: "-x", y: MEZZ },     // A Heaven's, facing the square
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
// the security room's office chair at its desk, facing the monitor wall (kabukigrin-cctv.js CHAIR)
seatAt(-9.75, 20.75, MEZZ + 0.48, MEZZ, FACE_YAW["-z"], "chair", 0.75);
const YOKO_BARS = [[9.0, 1], [11.5, -1], [14.0, 1], [16.5, -1], [19.0, 1], [21.3, -1]];
for (const [x, side] of YOKO_BARS) {
  for (const dx of [-0.55, 0.55]) seatAt(x + dx, side > 0 ? -3.68 : -2.32, 0.68, 0, side > 0 ? 0 : Math.PI, "stool", 0.5);
}

// the pachinko parlour's stools (kabukigrin-street.js MACHINES): sit and you play
// the machine in front (modes/social-pachinko.js); you get up into the aisle
const PACHI_SEAT = PARLOUR.floor + 0.58;
for (const [k, m] of MACHINES.entries()) {
  KB_SEATS.push({ x: m.x, z: m.stool, y: PACHI_SEAT, floor: PARLOUR.floor, yaw: m.s > 0 ? 0 : Math.PI, kind: "pachinko", machine: k,
    label: "Play pachinko", stand: { x: m.x, z: m.stool + m.s * 0.5 } });
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
    extra(role, act, { x: s.x, z: s.z, y: s.y, yaw: s.yaw, sit: true, ...((s.kind === "stool" || s.kind === "pachinko") && { stool: true }) }, more);
  };
  const seatsOf = (kind, pred = () => true) => KB_SEATS.map((s, i) => [s, i]).filter(([s]) => s.kind === kind && pred(s)).map(([, i]) => i);

  /* ---- the door: the front stair's head in Lulz Square, two bouncers
     either side of the rope, the list, the line up the lane */
  add("Big Lulz", "Bouncer", "guard", { ...DOOR_POSTS[0], y: 0, yaw: 0 }, guard);
  add("Tank", "Bouncer", "guard", { ...DOOR_POSTS[1], y: 0, yaw: 0 }, guard);
  add("Clipboard Carl", "Door host", "count", { x: -28.4, z: 1.9, y: 0, yaw: 0 });
  ["phone", "guard", "phone", "dance", "phone", "phone", "guard", "phone"].forEach((act, i) =>
    extra("Clubgoer", act, { x: -29.2 + (i % 3) * 0.12, z: 1.2 - i * 0.95, y: 0, yaw: Math.PI + (i % 2 ? 0.25 : -0.2) }, act === "dance" ? { dance: 0 } : {}));

  /* ---- the inside man, on the front stair's east side a few treads down,
     looking up at whoever comes through the rope (S1: 0.2 m risers on
     0.3 m treads from z 4.5: the eighth tread's top is -1.6) */
  add("Brick", "Bouncer", "guard", { x: -24.95, z: 6.75, y: -1.6, yaw: 0 }, guard);

  /* ---- the dance floor: the go-go dancer in the middle, the crowd facing
     the DJ on the west wall, the hype man on the stage. Twelve keep their
     spot; six roam (user, 2026-10-26: "not all of them needs to be in that
     same spot"): dance a while, step off to the floor's edge and film the
     DJ, then find another spot (town-npcs.js `stops`). */
  add("Glitter", "Go-go dancer", "dance", { x: DC.x, z: DC.z, y: FL, yaw: FACE_YAW["-x"] }, { dance: 3 });
  add("Hype Hank", "Hype man", "dance", { x: STAGE.x1 - 0.6, z: STAGE.z0 + 1.2, y: FL + STAGE.top, yaw: FACE_YAW["+x"] }, { dance: 2 });
  const R = rng(43);
  const spots = [];
  for (let tries = 0; spots.length < 24 && tries < 800; tries++) {
    const x = DANCE.x0 + 0.7 + R() * (DANCE.x1 - DANCE.x0 - 1.4), z = DANCE.z0 + 0.7 + R() * (DANCE.z1 - DANCE.z0 - 1.4);
    if (Math.hypot(x - DC.x, z - DC.z) < 1.7) continue;
    if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 1.2)) continue;
    spots.push({ x, z });
  }
  const faceDeck = (p) => Math.atan2(p.x - deck.x, p.z - deck.z);
  // (six of them throw money on the drops: doc MONEY-RAIN.md 2, town-npcs.js)
  spots.slice(0, 12).forEach((s, i) => {
    const to = R() < 0.7 ? { x: deck.x, z: deck.z } : { x: DC.x + (R() - 0.5) * 4, z: DC.z + (R() - 0.5) * 4 };
    extra("Raver", "dance", { x: s.x, z: s.z, y: FL, yaw: Math.atan2(s.x - to.x, s.z - to.z) }, { dance: Math.floor(R() * 4), ...(i < 6 && { throws: true }) });
  });
  // the floor's edge under the arms, clear of the booths, the stairs and the standing crowd
  const RIM = [[-25.8, 9.6], [-22.4, 9.6], [-18.8, 9.6], [-26.6, 24.6], [-22.8, 24.6], [-18.6, 24.6]].map(([x, z]) => ({ x, z }));
  for (let i = 0; i < 6; i++) {
    const a = spots[12 + i], b = spots[18 + i], rim = RIM[(i * 5) % 6];
    if (!a || !b) break;
    const stop = (p, act, secs) => ({ x: p.x, z: p.z, act, secs, yaw: faceDeck(p), dance: Math.floor(R() * 4) });
    extra("Raver", "roam", { x: a.x, z: a.z, y: FL, yaw: faceDeck(a) }, {
      stops: [stop(a, "dance", 14 + R() * 10), stop(rim, "phone", 7 + R() * 5), stop(b, "dance", 14 + R() * 10)],
    });
  }

  /* ---- the booths (two of three places taken), the bar, the edges */
  // (underSeats lists each booth's three places together)
  const benches = seatsOf("bench", (s) => s.floor === FL);
  for (let bi = 0; bi * 3 < benches.length; bi++) {
    benches.slice(bi * 3, bi * 3 + 2).forEach((i, k) => sit(i, "Clubgoer", k ? "phone" : "drink", { throws: true, ...(bi % 3 === 1 && { drink: "whiskey" }) }));
  }
  // behind the main bar under the east arm (the bottle wall at x -6.55); the
  // third is North, the head bartender, who talks (modes/npc-dialogue.js,
  // modes/talk/north.js)
  add("Shots McGee", "Bartender", "wipe", { x: -7.1, z: 14.5, y: FL, yaw: FACE_YAW["-x"] });
  add("Pourtia", "Bartender", "count", { x: -7.1, z: 19.5, y: FL, yaw: FACE_YAW["-x"] });
  add("North", "Bartender", "wipe", { x: -7.1, z: 17, y: FL, yaw: FACE_YAW["-x"] }, { talk: "north" });
  seatsOf("stool", (s) => s.floor === FL).forEach((i, k) => { if (k !== 2) sit(i, "Barfly", "drink", { ...(k % 3 === 0 && { drink: "whiskey" }), ...(k % 3 === 1 && { throws: true }) }); });
  for (const [x, z, yaw] of [[-29.5, 7.6, 2.4], [-28.7, 8.4, -0.8], [-14.2, 7.4, 0.6], [-13.4, 8.2, -2.6], [-14.6, 25.4, -0.3], [-21.6, 25.6, 0.2], [-27.8, 26.0, 2.8], [-27.0, 26.7, -0.4]]) {
    extra("Clubgoer", R() < 0.6 ? "drink" : "phone", { x, z, y: FL, yaw });
  }
  // under @SwishPng's screen on the south wall, watching it
  for (const x of [-27.6, -26.3]) extra("Clubgoer", "phone", { x, z: 27.2, y: FL, yaw: Math.PI });
  // the staff tunnel's mouth on the south arm; the tatami room's door, on
  // the square now; the side stair's head
  add("Knuckles", "Security", "guard", { x: -18.3, z: 29.1, y: B1, yaw: 0 }, guard);
  add("Rope", "VIP door", "guard", { x: -28.7, z: 22.9, y: 0, yaw: 0.3 }, guard);
  add("Deuce", "Bouncer", "guard", { x: -22.9, z: 21.3, y: 0, yaw: FACE_YAW["-x"] }, guard);

  /* ---- the balcony: on the glass over the floor, the sofas, the sound
     tech by the east arm's tables, a stroller along the north arm */
  for (const [x, z, face] of [[-22.6, 11.5, "+z"], [-19.5, 11.5, "+z"], [-15.6, 11.5, "+z"], [-10.5, 15.4, "-x"], [-10.5, 18.6, "-x"]]) {
    extra("Clubgoer", "drink", { x, z, y: B1, yaw: FACE_YAW[face] }, { throws: true });   // their bills fall to the floor below
  }
  seatsOf("bench", (s) => s.floor === B1).filter((i, k) => k % 2 === 0).slice(0, 4).forEach((i) => sit(i, "Clubgoer", "drink"));
  add("Fader", "Sound tech", "count", { x: -8.2, z: 17, y: B1, yaw: FACE_YAW["-x"] });
  extra("Clubgoer", "walk", { y: B1, path: [[-22, 10.9], [-13, 10.9]], pace: true, at: 0.3 });

  /* ---- the office over the square, the manager at the desk */
  add("Big Boss", "Manager", "count", { x: -12.35, z: 21.6, y: MEZZ, yaw: FACE_YAW["-x"] });
  // ...and the security side: Lurk at the desk's end, arms folded, watching the monitors (modes/social-lines.js gives him a line now and then)
  add("Lurk", "Security", "guard", { x: -8.68, z: 20.55, y: MEZZ, yaw: FACE_YAW["-z"] - 0.3 }, guard);

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

  /* ---- the pachinko parlour: a dozen at the machines, the floor man, and
     people going in and out of its doors off A Main (round the islands by
     the corridors at the glass and the back wall, never down an aisle of stools) */
  seatsOf("pachinko").filter((i, k) => (k * 7) % 4 === 1).forEach((i, k) => sit(i, "Clubgoer", k % 3 ? "tend" : "phone"));
  add("Pachi Pete", "Floor staff", "count", { x: -35.2, z: -15.9, y: PARLOUR.floor, yaw: FACE_YAW["+x"] });
  const F = PARLOUR.floor, dz = (PARLOUR.door[0] + PARLOUR.door[1]) / 2;
  extra("Clubgoer", "walk", { y: 0, path: [[-25.0, -26, 0], [-29.9, -22.5, 0], [-30.4, -15.6, 0], [-31.5, -15.6, F], [-32.15, -15.6, F], [-32.15, -23.4, F], [-34.6, -23.4, F]], pace: true, at: 0.1 });
  extra("Clubgoer", "walk", { y: 0, path: [[-26.8, -9, 0], [-30.4, dz + 0.5, 0], [-31.5, dz + 0.5, F], [-35.2, dz + 0.5, F], [-35.2, -9.2, F]], pace: true, at: 0.55 });
  extra("Clubgoer", "walk", { y: 0, path: [[-29.6, -26.5, 0], [-30.6, dz - 0.6, 0], [-31.5, dz - 0.6, F], [-32.15, dz - 0.6, F], [-32.15, -6.8, F], [-34.6, -6.8, F]], pace: true, at: 0.8 });

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
