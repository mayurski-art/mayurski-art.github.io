// Troll Ops — "The Pentagrin", the zombies map.
//
// A three-floor tribute to "Five": the boardroom you start in at the top, the
// war room with its DEFCON boards and sunken situation pit in the middle, the
// laboratories with the teleporter at the bottom. Floors are stacked upward
// from y=0 so the world ground doubles as the lab floor, and each slab is
// built with a hole punched over the stairwell below it.
//
// Every floor is laid out as rooms off a ring corridor rather than one open
// hall: the real building is corridors and offices, and a wide-open plate
// reads as an unfinished warehouse from inside. The top floor gets a real
// roof for the same reason — without one you stand in a government building
// looking up at open sky.

import * as THREE from "three";
import * as P from "./props.js";

export const FLOOR = { labs: 0, war: 5.5, board: 11 };

const FOOT = { minX: -32, maxX: 32, minZ: -26, maxZ: 26 };
const SLAB = 0.5;
const CEIL = 5;            // walls run floor to ceiling: 5.5 storey minus the 0.5 slab
const ROOF_Y = FLOOR.board + 5.5;

// stairwell footprints, kept clear through the slab above them
const STAIR_A = { x0: 19, x1: 31, z0: -24, z1: -13 };  // labs  -> war
const STAIR_B = { x0: -31, x1: -19, z0: 13, z1: 24 };  // war   -> board

const CONCRETE = 0x5c636a;
const INNER = 0x6a727a;
const PANEL = 0x6b4a2c;    // boardroom wood
const TRIM = 0x474e55;

/* A floor slab covering the footprint except one rectangular hole. */
function slab(api, topY, hole, color) {
  const y = topY - SLAB;
  const put = (x0, x1, z0, z1) => {
    if (x1 - x0 < 0.05 || z1 - z0 < 0.05) return;
    api.box((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, SLAB, { color, y, pen: 8 });
  };
  const { minX, maxX, minZ, maxZ } = FOOT;
  if (!hole) { put(minX, maxX, minZ, maxZ); return; }
  put(minX, hole.x0, minZ, maxZ);
  put(hole.x1, maxX, minZ, maxZ);
  put(hole.x0, hole.x1, minZ, hole.z0);
  put(hole.x0, hole.x1, hole.z1, maxZ);
}

/* Straight stair run climbing to `toY`. */
function stairRun(api, { x, z, width, fromY, toY, steps, run, dir }) {
  const rise = (toY - fromY) / steps;
  const along = dir[1] === "x" ? "x" : "z";
  const sign = dir[0] === "+" ? 1 : -1;
  for (let i = 0; i < steps; i++) {
    const h = rise * (i + 1);
    const off = sign * run * (i + 0.5);
    api.box(
      along === "x" ? x + off : x,
      along === "z" ? z + off : z,
      along === "x" ? run : width,
      along === "z" ? run : width,
      h,
      { color: 0x6f767c, y: fromY, pen: 8 },
    );
  }
}

/* An interior room: four walls with optional doorways, at floor height. */
function room(api, { x, z, w, d, y, gaps = {}, color = INNER, h = CEIL }) {
  api.walls(x, z, w, d, h, 0.8, { color, pen: 6, y, gaps });
}

/* A run of recessed ceiling lights. Only every litEvery-th fitting carries
   a real light: three floors of fully lit ceilings is ~30 point lights, which
   costs more frame time than the whole rest of the map put together. */
function lightRun(api, y, points, color = 0xd6e4ff, intensity = 12, range = 20, litEvery = 2) {
  points.forEach(([x, z], i) => {
    P.stripLight(api, {
      x, z, y: y + CEIL - 0.2, color, intensity, range,
      lit: i % litEvery === 0,
    });
  });
}

/* Boarded windows double as the zombie entry points.

   The spawn point is pushed a metre and a half inboard of the frame: now
   that rooms run right up to the outer shell, a zombie spawned on the wall
   line itself would arrive inside the masonry. */
const WINDOWS = [];
const INBOARD = 1.6;
function window_(api, floorY, x, z, rot) {
  P.boardedWindow(api, { x, z, y: floorY, rot });
  const sx = x <= FOOT.minX + 2 ? x + INBOARD : (x >= FOOT.maxX - 2 ? x - INBOARD : x);
  const sz = z <= FOOT.minZ + 2 ? z + INBOARD : (z >= FOOT.maxZ - 2 ? z - INBOARD : z);
  WINDOWS.push({ x: sx, z: sz, y: floorY });
}

/* Desk with a chair — the offices and side rooms are full of them. */
function desk(api, { x, z, y, w = 2.6, d = 1.2, face = 1 }) {
  api.box(x, z, w, d, 0.78, { color: PANEL, y, pen: 1.6 });
  P.officeChair(api, { x, z: z + face * 1.5, y, face: -face });
}

/* Freestanding partition — breaks a wide corridor up without closing it.
   Always shorter than the span it sits in, so a route survives either side. */
function partition(api, { x, z, w, d, y, color = INNER }) {
  api.box(x, z, w, d, 2.6, { color, y, pen: 5 });
}

/* Low counter: reads as a reception desk, walked over by nothing. */
function counter(api, { x, z, w, d, y }) {
  api.box(x, z, w, d, 1.1, { color: PANEL, y, pen: 2 });
}

/* A row of filing cabinets against a wall. */
function cabinets(api, { x, z, y, count = 3, rot = 0 }) {
  for (let i = 0; i < count; i++) {
    const off = (i - (count - 1) / 2) * 1.1;
    const cx = rot ? x : x + off;
    const cz = rot ? z + off : z;
    api.box(cx, cz, rot ? 0.7 : 1, rot ? 1 : 0.7, 1.5, { color: TRIM, y, pen: 3 });
  }
}

export const PENTAGRIN = {
  name: "The Pentagrin",
  blurb: "Three floors of government building. Something got into the labs.",
  bounds: { minX: -31, maxX: 31, minZ: -25, maxZ: 25 },
  playerSpawn: { x: 0, z: 12, y: FLOOR.board },   // the boardroom, as in "Five"
  sky: { top: 0x05070a, horizon: 0x0b0f13, bottom: 0x05070a },
  fog: { color: 0x0d1116, density: 0.022 },
  ground: { colorA: 0x4b5057, colorB: 0x3e434a, grid: 0x6b757e },
  sun: { color: 0x9fb4cc, intensity: 0.35, pos: [20, 40, 10] },
  hemi: { sky: 0x7f93ab, ground: 0x2b3036, intensity: 1.15 },
  ambient: { color: 0xc2cedb, intensity: 1.05 },

  build(api) {
    WINDOWS.length = 0;

    // ---------- outer shell, full height
    api.walls(0, 0, 64, 52, 17, 1.6, { color: CONCRETE, pen: 12 });

    // =======================================================  LABS (y = 0)
    {
      const y = FLOOR.labs;

      // Two laboratories either side of a central cross corridor, with the
      // teleporter hall filling the south end.
      room(api, { x: -19, z: -11, w: 22, d: 20, y, gaps: { e: 5, s: 5 } });
      room(api, { x: 14, z: -11, w: 14, d: 20, y, gaps: { w: 5, s: 5 } });
      room(api, { x: 0, z: 14, w: 26, d: 18, y, gaps: { n: 6, w: 4, e: 4 } });
      room(api, { x: -22, z: 14, w: 14, d: 18, y, gaps: { e: 4, n: 4 } });
      room(api, { x: 24, z: 12, w: 12, d: 16, y, gaps: { w: 4, n: 4 } });

      // --- west lab: benches and the specimen table
      P.labBench(api, { x: -26, z: -16, y, len: 6 });
      P.labBench(api, { x: -26, z: -8, y, len: 6 });
      P.labBench(api, { x: -14, z: -17, y, len: 5, rot: 1 });
      P.labBench(api, { x: -14, z: -6, y, len: 5, rot: 1 });
      P.rayGunTable(api, { x: -20, z: -11, y });
      P.wallScreen(api, { x: -19, z: -20.4, y, w: 5, h: 2.2, color: 0x1d6b4f });

      // --- east lab: the furnace bay and lockers
      P.furnace(api, { x: 18, z: -17, y });
      P.weaponsLocker(api, { x: 9.5, z: -19, y });
      P.weaponsLocker(api, { x: 12.5, z: -19, y });
      P.labBench(api, { x: 14, z: -6, y, len: 5 });
      cabinets(api, { x: 20.2, z: -8, y, count: 3, rot: 1 });

      // --- teleporter hall: the pad, the panels that arm it, and the
      //     Pack-a-Punch it feeds, exactly the loop the original runs.
      P.teleporterPad(api, { x: 0, z: 14, y, active: true });
      P.packAPunch(api, { x: 0, z: 21.4, y, rot: Math.PI });
      P.defconPanel(api, { x: -8, z: 20, y, rot: 0.4, index: 1 });
      P.defconPanel(api, { x: 8, z: 20, y, rot: -0.4, index: 2 });
      P.wallBuy(api, { x: -12.2, z: 10, y, rot: Math.PI / 2, tint: 0x3a4a5a });

      // --- storage rooms
      P.perkMachine(api, { x: -26, z: 20, y, kind: "speed" });
      P.weaponsLocker(api, { x: -18, z: 20, y, rot: Math.PI });
      cabinets(api, { x: -26, z: 8.6, y, count: 4 });
      P.mysteryBox(api, { x: 24, z: 16, y });
      desk(api, { x: 24, z: 7, y, face: 1 });

      // Crates and a checkpoint partition down the central corridor.
      partition(api, { x: 0, z: 2, w: 6, d: 0.7, y });
      for (const [cx, cz, cw] of [[-4, -24, 2.2], [4, -24, 2.2], [16.5, 2, 2], [-16.5, 2, 2]]) {
        api.box(cx, cz, cw, cw, 1.6, { color: 0x6b5a3c, y, pen: 2.5 });
      }

      // --- corridors
      lightRun(api, y, [[0, -22], [0, 2], [-22, 14], [24, 12]], 0xbcd0e6, 13, 22, 1);
      lightRun(api, y, [[-19, -11], [14, -11], [0, 14]], 0x9fe0c0, 12, 20, 1);

      for (const [x, z, r] of [[-31, -18, Math.PI / 2], [-31, 4, Math.PI / 2],
        [31, -6, -Math.PI / 2], [0, -25, 0], [-20, 25, Math.PI], [14, 25, Math.PI]]) {
        window_(api, y, x, z, r);
      }

      stairRun(api, {
        x: 25, z: STAIR_A.z1 - 0.5, width: 8, fromY: y, toY: FLOOR.war,
        steps: 16, run: 0.66, dir: "-z",
      });
    }

    // ==================================================  WAR ROOM (y = 5.5)
    {
      const y = FLOOR.war;
      slab(api, y, STAIR_A, 0x555c63);

      // The war room proper: one big chamber off a ring corridor.
      room(api, { x: 0, z: -4, w: 30, d: 24, y, gaps: { n: 6, s: 6, w: 5, e: 5 } });

      // Sunken pit read as two tiers of decking, with the situation table in
      // the middle — you fight down into it from the corridor doors.
      api.box(0, -4, 22, 16, 0.35, { color: 0x4f565d, y, pen: 8 });
      api.box(0, -4, 15, 10, 0.7, { color: 0x59616a, y, pen: 8 });
      P.conferenceTable(api, { x: 0, z: -4, y: y + 0.7, len: 9, wid: 3 });
      P.redPhone(api, { x: 2.4, z: -4, y: y + 1.52 });

      // DEFCON boards ring the pit, screens fill the north wall.
      P.defconPanel(api, { x: -8, z: -10, y: y + 0.35, rot: 0.6, index: 1 });
      P.defconPanel(api, { x: 8, z: -10, y: y + 0.35, rot: -0.6, index: 2 });
      P.defconPanel(api, { x: -8, z: 2, y: y + 0.35, rot: Math.PI - 0.6, index: 3 });
      P.defconPanel(api, { x: 8, z: 2, y: y + 0.35, rot: Math.PI + 0.6, index: 4 });
      P.wallScreen(api, { x: -8, z: -15.4, y: y + 1, w: 6.5, h: 3.2 });
      P.wallScreen(api, { x: 0, z: -15.4, y: y + 1, w: 6.5, h: 3.2, color: 0x1d6b4f });
      P.wallScreen(api, { x: 8, z: -15.4, y: y + 1, w: 6.5, h: 3.2 });

      // Analyst desks up on the rim, facing the boards.
      for (const x of [-12.5, 12.5]) {
        desk(api, { x, z: -10, y, face: x < 0 ? 1 : -1 });
        desk(api, { x, z: -2, y, face: x < 0 ? 1 : -1 });
      }

      // Side rooms off the corridor: comms to the west, storage to the east.
      room(api, { x: -24.7, z: -14, w: 11.4, d: 16, y, gaps: { e: 4 } });
      room(api, { x: 24.7, z: 6, w: 11.4, d: 16, y, gaps: { w: 4 } });
      cabinets(api, { x: -29.4, z: -14, y, count: 4, rot: 1 });
      desk(api, { x: -25, z: -19, y, face: 1 });
      P.wallScreen(api, { x: -25, z: -21.4, y, w: 4, h: 2 });
      P.perkMachine(api, { x: 25, z: 12, y, kind: "jugger" });
      P.mysteryBox(api, { x: 25, z: 1, y });

      // Elevator lobbies, the way the two shafts bracket the floor.
      P.elevatorDoors(api, { x: -30.2, z: 6, y, rot: Math.PI / 2 });
      P.elevatorDoors(api, { x: 30.2, z: -14, y, rot: -Math.PI / 2 });
      P.wallBuy(api, { x: -14.6, z: -9, y, rot: -Math.PI / 2 });

      // Corridor checkpoints, the way the real building gates its rings.
      partition(api, { x: -6, z: 14, w: 7, d: 0.7, y });
      partition(api, { x: 6, z: 14, w: 7, d: 0.7, y });
      counter(api, { x: 0, z: -21, w: 8, d: 1.4, y });

      lightRun(api, y, [[0, -20], [0, 12], [-24, 4], [24, -6]], 0xd6e4ff, 13, 22, 1);
      lightRun(api, y, [[0, -4], [-25, -14], [25, 6]], 0xd6e4ff, 12, 20, 1);

      for (const [x, z, r] of [[-31, -14, Math.PI / 2], [31, 20, -Math.PI / 2],
        [-8, -25, 0], [8, -25, 0], [0, 25, Math.PI]]) {
        window_(api, y, x, z, r);
      }

      stairRun(api, {
        x: -25, z: STAIR_B.z0 + 0.5, width: 8, fromY: y, toY: FLOOR.board,
        steps: 16, run: 0.66, dir: "+z",
      });
    }

    // =================================================  BOARDROOM (y = 11)
    {
      const y = FLOOR.board;
      slab(api, y, STAIR_B, 0x5b626a);

      // The conference room, wood-paneled, with the corridor ring around it.
      room(api, { x: 0, z: -4, w: 30, d: 22, y, color: PANEL, gaps: { n: 5, s: 5 } });
      P.conferenceTable(api, { x: 0, z: -4, y, len: 14, wid: 3.4 });
      P.flagStand(api, { x: -3, z: -13.5, y });
      P.flagStand(api, { x: 3, z: -13.5, y });
      P.wallScreen(api, { x: 0, z: -14.4, y: y + 0.6, w: 6, h: 2.8, color: 0x243a5c });
      P.redPhone(api, { x: -5, z: -4, y: y + 0.84 });

      // Offices down both sides of the ring corridor.
      room(api, { x: -24.2, z: -14, w: 12.4, d: 14, y, gaps: { e: 3.5 } });
      room(api, { x: -24.2, z: 3, w: 12.4, d: 14, y, gaps: { e: 3.5 } });
      room(api, { x: 24.2, z: -14, w: 12.4, d: 14, y, gaps: { w: 3.5 } });
      room(api, { x: 24.2, z: 3, w: 12.4, d: 14, y, gaps: { w: 3.5 } });
      desk(api, { x: -24, z: -16, y, face: 1 });
      desk(api, { x: -24, z: 1, y, face: 1 });
      desk(api, { x: 24, z: -16, y, face: 1 });
      desk(api, { x: 24, z: 1, y, face: 1 });
      cabinets(api, { x: -28.6, z: -12, y, count: 3, rot: 1 });
      cabinets(api, { x: 28.6, z: 5, y, count: 3, rot: 1 });

      // The starting corner: revive, the first wall buy, and the detectors
      // that make the corridor read as a checkpoint.
      P.perkMachine(api, { x: -14, z: 14, y, kind: "revive" });
      P.wallBuy(api, { x: -10, z: 16.6, y, rot: Math.PI });
      P.wallBuy(api, { x: 16, z: 16.6, y, rot: Math.PI, tint: 0x4a4f48 });
      // The lobby end: a reception counter and detectors either side of the
      // boardroom doors, which is what makes the corridor read as a checkpoint.
      counter(api, { x: 0, z: 20, w: 9, d: 1.4, y });
      partition(api, { x: -10, z: 14, w: 6, d: 0.7, y, color: PANEL });
      partition(api, { x: 10, z: 14, w: 6, d: 0.7, y, color: PANEL });
      partition(api, { x: 0, z: -21, w: 8, d: 0.7, y, color: PANEL });
      P.metalDetector(api, { x: 0, z: 10, y });
      P.metalDetector(api, { x: -17, z: -4, y, rot: Math.PI / 2 });
      P.metalDetector(api, { x: 17, z: -4, y, rot: Math.PI / 2 });
      P.elevatorDoors(api, { x: -30.2, z: -6, y, rot: Math.PI / 2 });
      P.elevatorDoors(api, { x: 30.2, z: -6, y, rot: -Math.PI / 2 });

      lightRun(api, y, [[0, -4], [-8, -4], [8, -4]], 0xfff0d6, 15, 22, 2);
      lightRun(api, y, [[0, -20], [0, 14], [-16.5, 0], [16.5, 0]], 0xfff0d6, 13, 24, 1);
      lightRun(api, y, [[-24, -14], [24, -14], [-24, 3], [24, 3]], 0xfff0d6, 11, 18, 1);

      for (const [x, z, r] of [[-31, -16, Math.PI / 2], [31, -10, -Math.PI / 2],
        [31, 12, -Math.PI / 2], [-12, -25, 0], [12, -25, 0], [18, 25, Math.PI]]) {
        window_(api, y, x, z, r);
      }

      // ---------- roof. Without it the top floor is an office with the sky
      // for a ceiling, which is what made the whole building read as unbuilt.
      slab(api, ROOF_Y, null, 0x3f464d);
    }
  },

  // used by the shared arena code; zombies.js uses the window list instead
  spawns: [[0, -22], [0, 22], [-26, 0], [26, 0], [-20, -20], [20, -20], [-20, 20], [20, 20]],
};

/* Where zombies climb in, resolved after the map is built. */
export function zombieWindows() {
  return WINDOWS.map((w) => ({ ...w }));
}

/* Which floor a height belongs to — used to place and route zombies. */
export function floorOf(y) {
  if (y >= FLOOR.board - 1.5) return "board";
  if (y >= FLOOR.war - 1.5) return "war";
  return "labs";
}

export { FOOT as PENTAGRIN_FOOTPRINT };
