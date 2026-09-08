// Troll Ops — "The Pentagrin", the zombies map.
//
// A three-floor tribute to "Five": the boardroom you start in at the top, the
// war room with its DEFCON panels in the middle, the laboratories at the
// bottom. Floors are stacked upward from y=0 so the world ground doubles as
// the lab floor, and each slab is built with a hole punched over the stairwell
// below it.

import * as THREE from "three";
import * as P from "./props.js";

export const FLOOR = { labs: 0, war: 5.5, board: 11 };

const FOOT = { minX: -32, maxX: 32, minZ: -26, maxZ: 26 };
const SLAB = 0.5;

// stairwell footprints, kept clear through the slab above them
const STAIR_A = { x0: 19, x1: 31, z0: -24, z1: -13 };  // labs  -> war
const STAIR_B = { x0: -31, x1: -19, z0: 13, z1: 24 };  // war   -> board

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

/* Straight stair run climbing `rise` total, arriving level with `toY`. */
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

/* Boarded windows double as the zombie entry points. */
const WINDOWS = [];
function window_(api, floorY, x, z, rot) {
  P.boardedWindow(api, { x, z, y: floorY, rot });
  WINDOWS.push({ x, z, y: floorY });
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
  hemi: { sky: 0x7f93ab, ground: 0x2b3036, intensity: 0.9 },
  ambient: { color: 0xc2cedb, intensity: 0.75 },

  build(api) {
    WINDOWS.length = 0;
    const CONCRETE = 0x5c636a;
    const INNER = 0x6a727a;

    // ---------- outer shell, full height
    api.walls(0, 0, 64, 52, 17, 1.6, { color: CONCRETE, pen: 12 });

    // =======================================================  LABS (y = 0)
    {
      const y = FLOOR.labs;
      // lab partitions
      api.walls(-14, -8, 26, 20, 4.6, 0.8, { color: INNER, pen: 6, y, gaps: { e: 4, s: 4 } });
      api.walls(16, 10, 22, 20, 4.6, 0.8, { color: INNER, pen: 6, y, gaps: { w: 4, n: 4 } });

      P.labBench(api, { x: -20, z: -12, y, len: 6 });
      P.labBench(api, { x: -20, z: -4, y, len: 6 });
      P.labBench(api, { x: -8, z: -14, y, len: 5, rot: 1 });
      P.rayGunTable(api, { x: -8, z: -2, y });
      P.weaponsLocker(api, { x: -25, z: 6, y });
      P.weaponsLocker(api, { x: -22, z: 6, y });
      P.teleporterPad(api, { x: 16, z: 12, y, active: false });  // prototype, unbuilt
      P.furnace(api, { x: 24, z: -4, y });
      P.perkMachine(api, { x: 4, z: 20, y, kind: "speed" });

      // weapon-test targets
      for (const tz of [-20, -17, -14]) {
        api.box(10, tz, 0.3, 1.2, 1.8, { color: 0x8a5433, y, pen: 2 });
      }

      for (const [x, z, r] of [[-31, -18, Math.PI / 2], [-31, 4, Math.PI / 2],
        [31, -18, -Math.PI / 2], [0, -25, 0], [-14, 25, Math.PI], [14, 25, Math.PI]]) {
        window_(api, y, x, z, r);
      }
      for (const [x, z] of [[-18, -10], [-18, 10], [10, -10], [18, 8], [0, 0]]) {
        P.stripLight(api, { x, z, y: y + 4.4, color: 0xbcd0e6, intensity: 12, range: 18 });
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
      api.walls(0, 0, 62, 50, 4.6, 0.8, { color: INNER, pen: 6, y, gaps: { n: 6, s: 6, w: 5, e: 5 } });

      // central working teleporter, ringed by the four DEFCON consoles
      P.teleporterPad(api, { x: 0, z: 0, y, active: true });
      P.defconPanel(api, { x: -7, z: -6, y, rot: 0.6, index: 1 });
      P.defconPanel(api, { x: 7, z: -6, y, rot: -0.6, index: 2 });
      P.defconPanel(api, { x: -7, z: 6, y, rot: Math.PI - 0.6, index: 3 });
      P.defconPanel(api, { x: 7, z: 6, y, rot: Math.PI + 0.6, index: 4 });

      // situation-room displays on the north wall
      P.wallScreen(api, { x: -9, z: -24.2, y, w: 6, h: 3 });
      P.wallScreen(api, { x: 0, z: -24.2, y, w: 6, h: 3, color: 0x1d6b4f });
      P.wallScreen(api, { x: 9, z: -24.2, y, w: 6, h: 3 });

      // desk with the red phone
      api.box(-18, 14, 3, 1.2, 0.8, { color: 0x6b4a30, y, pen: 1.6 });
      P.redPhone(api, { x: -18, z: 14, y: y + 0.84 });
      P.officeChair(api, { x: -18, z: 15.6, y, face: -1 });

      P.perkMachine(api, { x: 22, z: -20, y, kind: "jugger" });
      P.mysteryBox(api, { x: 20, z: 16, y });
      P.elevatorDoors(api, { x: -30.2, z: -6, y, rot: Math.PI / 2 });
      P.elevatorDoors(api, { x: 30.2, z: 6, y, rot: -Math.PI / 2 });

      for (const [x, z, r] of [[-31, -14, Math.PI / 2], [31, 14, -Math.PI / 2],
        [-8, -25, 0], [8, -25, 0], [0, 25, Math.PI]]) {
        window_(api, y, x, z, r);
      }
      for (const [x, z] of [[-14, -12], [14, -12], [-14, 12], [14, 12], [0, 0]]) {
        P.stripLight(api, { x, z, y: y + 4.4, color: 0xd6e4ff, intensity: 13, range: 20 });
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

      // the conference room itself
      api.walls(0, 2, 34, 30, 4.4, 0.8, { color: INNER, pen: 6, y, gaps: { n: 5, s: 5, w: 4, e: 4 } });

      P.conferenceTable(api, { x: 0, z: 2, y, len: 14, wid: 3.4 });
      P.flagStand(api, { x: -3, z: -12.5, y });
      P.flagStand(api, { x: 3, z: -12.5, y });
      P.wallScreen(api, { x: 0, z: -13, y, w: 5, h: 2.4, color: 0x243a5c });

      // Quick Revive by the table, with the shotgun wall-buy beside it
      P.perkMachine(api, { x: -14, z: 14, y, kind: "revive" });
      P.wallBuy(api, { x: -10, z: 16.6, y, rot: Math.PI });

      // metal detectors in the corridors, as in the real boardroom halls
      P.metalDetector(api, { x: 0, z: 18, y });
      P.metalDetector(api, { x: -20, z: 2, y, rot: Math.PI / 2 });

      P.wallBuy(api, { x: 20, z: -20, y, rot: -Math.PI / 2, tint: 0x4a4f48 });
      P.elevatorDoors(api, { x: -30.2, z: -6, y, rot: Math.PI / 2 });

      for (const [x, z, r] of [[-31, -16, Math.PI / 2], [31, -10, -Math.PI / 2],
        [31, 12, -Math.PI / 2], [-12, -25, 0], [12, -25, 0], [18, 25, Math.PI]]) {
        window_(api, y, x, z, r);
      }
      for (const [x, z] of [[0, 2], [-16, -14], [16, -14], [-16, 16], [16, 16]]) {
        P.stripLight(api, { x, z, y: y + 4.2, color: 0xfff0d6, intensity: 18, range: 24 });
      }
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
