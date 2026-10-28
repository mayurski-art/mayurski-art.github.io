// Troll Forces — Grin Beach in Socialize (Grin Beach 5b): the cast and the
// seats. What town-npcs.js and social-rp.js read off the map: who is where
// doing what, and the bleacher places a player can sit in.
//
// The courts' players and the surfers stand ready here; surfing (5c) and the
// games (5d) take them over. The layout numbers are grinbeach-venice.js's
// and maps.js's: change one, change the other.

import { rng } from "./trollcity-kit.js?v=tc2-wst-tc3-sh1-sr1-pf1-or1-tcs1-tx1-ch1-sp1-kbt1-pm1-ss1-ss2-ss3-tfm2-ugb1-ug1-ugm1";
import { pickOutfit } from "../characters/outfits.js?v=of1m1-nc1-cd1-sh1-hr2-zp1-sr1-or1-gb3-rh1";
import { STALLS, STALL_Z, COURT, TENNIS, VB, RACKS } from "./grinbeach-venice.js?v=gb1-tb1-tb2-kbb2-kbs1-pm1-kbk2-tfp7-tfb8-ss1-ss2-ss3-tfm2-hgb2-ugb1-ug1-ugm1-hgb5";

// the camera's yaw facing each way (0 faces -z, +PI/2 faces -x)
const FACE_YAW = { "+z": Math.PI, "-z": 0, "+x": -Math.PI / 2, "-x": Math.PI / 2 };
const WALK_Y = 0.45;
const TOWER_DECK = 2.4;

/* ------------------------------------------------------------ the seats

   The bleachers: three rows at each court (gb-venice), facing the play. */
export const GB_SEATS = [];
function seatAt(x, z, y, yaw, out = 0.6) {
  GB_SEATS.push({ x, z, y, floor: 0, yaw, kind: "bench", stand: { x: x - Math.sin(yaw) * out, z: z - Math.cos(yaw) * out } });
}
// volleyball, east of the net, facing -x (rows x 9.7 + 0.6k, tops 0.45 + 0.38k)
for (let k = 0; k < 3; k++) for (const z of [-8.8, -7.6, -6.4, -5.2]) seatAt(9.75 + 0.6 * k, z, 0.45 + 0.38 * k, FACE_YAW["-x"]);
// basketball, west of the court, facing +x (rows x 38.1 + 0.85k, tops 0.45 + 0.42k)
for (let k = 0; k < 3; k++) for (const z of [-11.6, -9.6, -7.6, -5.6, -3.6, -1.6]) seatAt(38.1 + 0.85 * k, z, 0.45 + 0.42 * k, FACE_YAW["+x"]);
// tennis, north of the fence, facing -z (rows z 9.1 + 0.85k)
const T_Z1 = TENNIS.z + TENNIS.d / 2;
for (let k = 0; k < 3; k++) for (const x of [61, 63, 65, 67, 69]) seatAt(x - 0.5, T_Z1 + 1.3 + 0.85 * k, 0.45 + 0.42 * k, FACE_YAW["-z"]);

/* ------------------------------------------------------------ the crowd

   Late afternoon on the strip: sunbathers on the loungers and towels, the
   stall keepers on the boardwalk, curls at Muscle Beach, a lifeguard up a
   tower, people strolling the boardwalk and the sand, a few watching from
   the bleachers; the volleyball four, the shootaround three, a tennis pair
   and the surfers by the racks, ready for 5c and 5d. `yaw` is the camera's;
   a sunbather's spot is the feet, the head toward `yaw`. */
const EXTRAS = new Set(["Beachgoer", "Surfer", "Lifter", "Baller"]);
const TOWELS = [0xff5a6a, 0x3ab0e8, 0xf2c232, 0x5ad88a, 0xb07ae8, 0xff8a3a];
export function beachNpcs() {
  const cast = [];
  const add = (name, role, act, spot, extra = {}) => cast.push({ name, role, act, ...spot, ...extra });
  let n = 0;
  const extra = (role, act, spot, more) => add(`${role} ${++n}`, role, act, spot, more);
  const R = rng(61);

  /* ---- the stalls: a keeper behind each counter, facing the boardwalk */
  const KEEPERS = { "SHAVED ICE": ["Sno Cone Sal", "tend"], "VENICE TEES": ["Threads", "count"], "SHADES $5": ["Shady Steve", "count"],
    HENNA: ["Henna Hana", "tend"], "PSYCHIC 5¢": ["Madame Lulz", "tend"] };
  for (const [x, label] of STALLS) {
    const [name, act] = KEEPERS[label] || ["Vendor", "count"];
    add(name, "Vendor", act, { x, z: STALL_Z + 0.75, y: WALK_Y, yaw: FACE_YAW["-z"] });
  }
  // a customer at the shaved ice, one at the tees
  extra("Beachgoer", "drink", { x: STALLS[0][0] + 0.3, z: STALL_Z - 1.1, y: WALK_Y, yaw: FACE_YAW["+z"] }, { drink: "beer" });
  extra("Beachgoer", "phone", { x: STALLS[1][0] - 0.4, z: STALL_Z - 1.15, y: WALK_Y, yaw: FACE_YAW["+z"] });

  /* ---- sunbathers: one on each lounger (gb-beach: beside each umbrella,
     the backrest toward the sea, 0.9 rad up from its hinge 0.62 m seaward
     of the seat's middle), two on towels on the open sand. The feet sit
     where the back lands on the backrest (checked in a side-on shot). */
  for (const [ux, uz] of [[-24, -18], [4, -20], [32, -14], [-6, -4]]) {
    extra("Beachgoer", "lie", { x: ux + 1.0, z: uz + 0.6 + 0.55, y: 0.37, yaw: FACE_YAW["-z"] }, { recline: 0.9 });
  }
  for (const [x, z, yaw] of [[-19.5, -13.2, -0.3], [19.5, -11.0, 0.25], [-40.5, -14.5, 0.1]]) {
    extra("Beachgoer", "lie", { x, z, y: 0.02, yaw }, { towel: TOWELS[Math.floor(R() * TOWELS.length)] });
  }

  /* ---- Muscle Beach: curls on the pad, a spotter at the benches */
  for (const [x, z, yaw] of [[-48.8, -3.2, FACE_YAW["+x"]], [-44.3, -4.6, FACE_YAW["-x"]], [-49.6, 0.4, 2.6]]) {
    extra("Lifter", "lift", { x, z, y: 0.06, yaw }, { build: 1.35 });
  }
  add("Spotter Steve", "Muscle Beach", "guard", { x: -50.8, z: -9.3, y: 0.06, yaw: FACE_YAW["+z"] }, { build: 1.4 });

  /* ---- the lifeguard, up the tower by the volleyball court */
  add("Lifeguard Lenny", "Lifeguard", "guard", { x: 14, z: -17.2, y: TOWER_DECK, yaw: 0 });

  /* ---- volleyball: two a side, the net across z -12 (5d, modes/social-vball.js:
     `vball` is how good; two of them fill in a 2v2) */
  const vx = (VB[0] + VB[1]) / 2;
  for (const [dx, z, yaw, skill] of [[-2, -16.5, FACE_YAW["+z"], 0.6], [2, -15.8, FACE_YAW["+z"], 0.7], [-2.2, -7.8, FACE_YAW["-z"], 0.55], [1.8, -8.4, FACE_YAW["-z"], 0.75]]) {
    extra("Baller", "ready", { x: vx + dx, z, y: 0, yaw }, { vball: { skill } });
  }
  /* ---- the shootaround under the south hoop: the regulars you run it
     with (5d, modes/hoops-game.js: `hoops` is how good, how they play) */
  for (const [dx, z, skill] of [[0, -12.5, 0.5], [-3.2, -14.6, 0.58], [3.4, -13.8, 0.65]]) {
    const x = COURT.x + dx;
    extra("Baller", "ready", { x, z, y: 0.05, yaw: Math.atan2(x - COURT.x, z - COURT.hoopZ[0]) }, { hoops: { skill, style: "all" } });
  }
  /* ---- the legends, waiting on the west sideline for next */
  for (const [name, z, hoops] of [["Hoops Hank", -15.4, { skill: 0.72, style: "post" }], ["Crossover Carla", -16.5, { skill: 0.85, style: "handles" }], ["Big Grin", -17.6, { skill: 0.8, style: "dunk" }]]) {
    add(name, "Baller", "ready", { x: 40.7, z, y: 0.05, yaw: FACE_YAW["+x"] }, { hoops, build: name === "Big Grin" ? 1.25 : 1 });
  }
  /* ---- tennis: the club pros, one on each baseline (5d, modes/social-tennis.js:
     `tennis` is how good) */
  for (const [name, z, yaw, skill] of [["Deuce Dominguez", TENNIS.z - TENNIS.dl - 0.7, FACE_YAW["+z"], 0.7], ["Ace Alvarez", TENNIS.z + TENNIS.dl + 0.7, FACE_YAW["-z"], 0.9]]) {
    add(name, "Baller", "ready", { x: TENNIS.x + 1.5, z, y: 0.05, yaw }, { tennis: { skill } });
  }

  /* ---- the surfers, by the racks, looking at the sets */
  for (const [rx, rz] of RACKS) {
    for (const dx of [-2.2, 2.3]) {
      if (rz < 0 && dx > 0) continue;
      extra("Surfer", "guard", { x: rx + dx, z: rz + (rz < 0 ? 0.6 : -1.2), y: 0, yaw: FACE_YAW["-z"] + (dx > 0 ? 0.25 : -0.2) });
    }
  }

  /* ---- out in the lineup: four on boards, taking turns on the sets (5c,
     modes/social-surf.js drives them: `line` the way each rides, `surfAt`
     his place in the 40 s cycle) */
  for (const [x, z, line, at] of [[-30, -38, -1, 0], [6, -37, 1, 10], [30, -39, 1, 20], [52, -38, -1, 30]]) {
    extra("Surfer", "surf", { x, z, y: 0, yaw: Math.PI }, { line, surfAt: at, board: (at / 10) | 0 });
  }

  /* ---- in the bleachers: two at each court, a seat apart */
  const taken = new Set();
  const sit = (i, act, more) => {
    const s = GB_SEATS[i];
    taken.add(i);
    extra("Beachgoer", act, { x: s.x, z: s.z, y: s.y, yaw: s.yaw, sit: true }, more);
  };
  for (const [pick, act] of [[(s) => s.x < 12 && s.z < -7, "drink"], [(s) => s.x < 12 && s.z > -6, "phone"],
    [(s) => s.x > 38 && s.x < 40 && s.z < -8, "drink"], [(s) => s.x > 38.9 && s.x < 40 && s.z > -5, "phone"],
    [(s) => s.z > 9 && s.z < 9.5 && s.x < 63, "drink"], [(s) => s.z > 9.9 && s.z < 10.4 && s.x > 65, "phone"]]) {
    const i = GB_SEATS.findIndex((s, j) => !taken.has(j) && pick(s));
    if (i >= 0) sit(i, act, act === "drink" ? { drink: "beer" } : {});
  }

  /* ---- strolling: the boardwalk end to end, the sand above the tideline */
  extra("Beachgoer", "walk", { y: WALK_Y, path: [[-50, 10.4], [50, 10.4]], pace: true, at: 0.1 });
  extra("Beachgoer", "walk", { y: WALK_Y, path: [[-50, 11.2], [50, 11.2]], pace: true, at: 0.62 });
  extra("Beachgoer", "walk", { y: 0, path: [[-38, 1.0], [36, 1.0]], pace: true, at: 0.4 });
  extra("Beachgoer", "walk", { y: 0, path: [[-36, -18.9], [-20, -18.9], [-2.5, -20.2]], pace: true, at: 0.75 });

  const DR = rng(97);
  for (const c of cast) if (EXTRAS.has(c.role)) c.outfit = pickOutfit("Beachgoer", DR());
  return cast;
}

/* The seats a player can take: every one no NPC is on. */
export function beachFreeSeats(cast) {
  return GB_SEATS.filter((s) => !cast.some((c) => c.sit && Math.hypot(c.x - s.x, c.z - s.z) < 0.2 && Math.abs(c.y - s.y) < 0.1));
}
