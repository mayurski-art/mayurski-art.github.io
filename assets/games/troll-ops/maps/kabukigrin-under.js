// Troll Forces — Kabukigrin's club, underground (doc docs/KB-CLUB-UNDERGROUND.md).
// The hall that stood on A site is dug out: its block is Lulz Square now, an
// open square A Main runs straight into, and the club is two floors under
// it. B1 (-3.6) is a balcony on three sides looking down on B2 (-7.5), the
// dance floor, under one slab (the square's floor). Four stairs: the front
// stair off the square (S1), the back stair off the yard through a tunnel
// (S2), the side stair off the square's south-east corner (S5), and from the
// balcony to the floor the grand stair (G1) and the service stair behind the
// DJ (S4). Everything here is near-black: the walls, the floor, the booths.
// Only what gives light is bright (club-live.js draws those, in a group
// this module hands back, whose y is the floor).
//
// Frames: `L` is local to that group (B2 floor = 0); colliders are world
// (api.ghostBox), so every height a collider takes is local + FL.

import * as THREE from "three";
import { surfMat, place } from "./trollcity-kit.js?v=tc2-wst-tc3-sh1-sr1-pf1-or1-tcs1-tx1-ch1-sp1-kbt1-pm1-ss1-ss2-ss3-tfm2-ugb1-ug1-ugm1";
import { cutRects } from "./trollingloud-kit.js?v=tl3-tc3-sh1-sr1-or1-tcs1-tx1-ch1-sp1-kbt1-pm1-ss1-ss2-ss3-tfm2-ugb1-ug1-ugm1";

/* ---------------------------------------------------------------- the plan */
export const FL = -7.5;               // B2, the dance floor (world)
export const B1 = -3.6;               // the balcony's deck (world)
export const CEIL = -0.6;             // the club's ceiling: the square's slab is -0.6 .. 0
export const B1L = B1 - FL;           // 3.9, local
export const CEILL = CEIL - FL;       // 6.9, local
export const STL = -FL;               // 7.5, the street, local
// the hall, B1 and B2 alike
export const HALL = { x0: -31.5, x1: -6.5, z0: 4.5, z1: 30 };
export const DANCE = { x0: -27.5, x1: -15.5, z0: 11, z1: 23 };   // 12 x 12
export const DC = { x: -21.5, z: 17 };
// the stage against the west wall (local heights), the DJ looking east
export const STAGE = { x0: -31.5, x1: -28, z0: 8, z1: 16, top: 0.6 };
export const DJ_WALL = -31.45;
export const DECK = { x: -29.6, z: 12 };
// the balcony's three arms (B1): north, east, south
export const ARMS = {
  north: [-31.5, -6.5, 4.5, 12],
  east: [-11, -6.5, 12, 22],
  south: [-31.5, -6.5, 22, 30],
};
// the tunnel from the yard's stair to the south arm
export const TUNNEL = { x0: -21, x1: -19, z0: 30, z1: 34.6 };
/* The stairs: `from` the head (street or deck) to the foot, `axis` the way
   down, each `n` risers of `rise` on treads `tread` deep, `w` wide across.
   S1, S5 and S2 land on B1 from the street; G1 and S4 on B2 from B1. */
export const STAIRS = {
  S1: { x0: -27.5, x1: -24.5, z0: 4.5, axis: "+z", n: 18, rise: 0.2, tread: 0.3, top: 0, w: 3 },
  S5: { z0: 22, z1: 24, x0: -22, axis: "+x", n: 18, rise: 0.2, tread: 0.3, top: 0, w: 2 },
  S2: { x0: -21, x1: -19, z0: 40, axis: "-z", n: 18, rise: 0.2, tread: 0.3, top: 0, w: 2 },
  G1: { x0: -14.5, x1: -11, z0: 12, axis: "+z", n: 20, rise: 0.195, tread: 0.25, top: B1, w: 3.5 },
  S4: { x0: -31.5, x1: -29.5, z0: 22, axis: "-z", n: 20, rise: 0.195, tread: 0.25, top: B1, w: 2 },
};
// the openings cut in the street (the ground plane and its slab): [x0, x1, z0, z1]
export const WELLS = [
  [-27.5, -24.5, 4.5, 9.9],    // S1
  [-22, -16.6, 22, 24],        // S5
  [-21, -19, 34.6, 40],        // S2
];
// the dug ground: the hall and the tunnel, grown past their walls so the
// field's edge ramp (core/ground-field.js reads between its points) sits
// inside a wall, never under a foot
const DUG = [[-32.3, -5.7, 3.7, 30.8], [-21.6, -18.4, 30.8, 40.6]];
// what the old club stood in: the street-level hall and its front, up to the
// Heaven block's face. Its Studio pieces, props and colliders go
export const OLD_HALL = { x0: -32, x1: -14, z0: 2.9, z1: 23.9 };
export const inOldHall = (x, z, y = 0) => x > OLD_HALL.x0 && x < OLD_HALL.x1 && z > OLD_HALL.z0 && z < OLD_HALL.z1 && y > -0.5 && y < 8.6;

/* The ground's height field (core/ground-field.js): the floor of every
   dug rect, 0 elsewhere. 0.5 m points; the hall's floor is FL, the tunnel's
   a little under its slab. */
export function groundField() {
  const cell = 0.5, minX = -33, minZ = 3, w = 56, h = 78;
  const H = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = minX + i * cell, z = minZ + j * cell;
    const [hx0, hx1, hz0, hz1] = DUG[0], [tx0, tx1, tz0, tz1] = DUG[1];
    if (x >= hx0 && x <= hx1 && z >= hz0 && z <= hz1) H[j * w + i] = FL;
    else if (x >= tx0 && x <= tx1 && z >= tz0 && z <= tz1) H[j * w + i] = B1 - 0.9;
  }
  return { minX, minZ, cell, w, h, heights: H };
}

/* Each stair's treads: [x, z, w, d, top] (world top), head first. */
export function treads(s) {
  const out = [];
  for (let i = 0; i < s.n; i++) {
    const top = s.top - s.rise * (i + 1), a = s.tread * i, b = s.tread * (i + 1);
    if (s.axis === "+z") out.push([(s.x0 + s.x1) / 2, s.z0 + (a + b) / 2, s.w, s.tread, top]);
    else if (s.axis === "-z") out.push([(s.x0 + s.x1) / 2, s.z0 - (a + b) / 2, s.w, s.tread, top]);
    else if (s.axis === "+x") out.push([s.x0 + (a + b) / 2, (s.z0 + s.z1) / 2, s.tread, s.w, top]);
  }
  return out;
}
/* A stair's foot and head for the nav (maps.js api.stairLinks): the head a
   step past the first tread on the floor it leaves, the foot past the last. */
export function stairLink(s) {
  const t = treads(s), first = t[0], last = t[t.length - 1];
  const d = s.axis === "+z" ? [0, 1] : s.axis === "-z" ? [0, -1] : [1, 0];
  const foot = last[4];
  return { a: { x: last[0] + d[0] * 0.6, y: foot, z: last[1] + d[1] * 0.6 }, b: { x: first[0] - d[0] * 0.75, y: s.top, z: first[1] - d[1] * 0.75 } };
}

/* ------------------------------------------------------------ the colliders

   Everything the dig needs the game to stand on or stop at, world
   [x, z, w, d, h, y, pen]. The street's slab over the dug ground, the
   hall's walls, the arms, the treads, the rails, the wells' walls. */
export function underColliders() {
  const C = [];
  const box = (x0, x1, z0, z1, y0, y1, pen = 20) => C.push([(x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, y1 - y0, y0, pen]);
  // the slab: the street over the dug ground, minus the wells
  for (const [x0, x1, z0, z1] of cutRects(DUG[0][0], DUG[0][1], DUG[0][2], DUG[0][3], WELLS)) box(x0, x1, z0, z1, -0.5, 0, 8);
  for (const [x0, x1, z0, z1] of cutRects(DUG[1][0], DUG[1][1], DUG[1][2], DUG[1][3], WELLS)) box(x0, x1, z0, z1, -0.5, 0, 8);
  // B2's floor: the field is the ground, this is what the nav finds under a foot
  box(HALL.x0, HALL.x1, HALL.z0, HALL.z1, FL - 0.5, FL, 8);
  // the hall's walls (0.5 m, into the dug ground), the tunnel through the south one
  const { x0, x1, z0, z1 } = HALL;
  box(x0 - 0.5, x0, z0 - 0.5, z1 + 0.5, FL - 0.1, CEIL + 0.1);
  box(x1, x1 + 0.5, z0 - 0.5, z1 + 0.5, FL - 0.1, CEIL + 0.1);
  box(x0, x1, z0 - 0.5, z0, FL - 0.1, CEIL + 0.1);
  box(x0, TUNNEL.x0, z1, z1 + 0.5, FL - 0.1, CEIL + 0.1);
  box(TUNNEL.x1, x1, z1, z1 + 0.5, FL - 0.1, CEIL + 0.1);
  box(TUNNEL.x0, TUNNEL.x1, z1, z1 + 0.5, FL - 0.1, B1 - 0.4);
  // the tunnel: its floor, its walls
  box(TUNNEL.x0, TUNNEL.x1, TUNNEL.z0, TUNNEL.z1, B1 - 0.4, B1, 8);
  box(TUNNEL.x0 - 0.3, TUNNEL.x0, TUNNEL.z0, TUNNEL.z1 + 0.3, B1 - 0.4, 0);
  box(TUNNEL.x1, TUNNEL.x1 + 0.3, TUNNEL.z0, TUNNEL.z1 + 0.3, B1 - 0.4, 0);
  // the arms' decks (the S1 slot is cut out of the north one)
  for (const [ax0, ax1, az0, az1] of cutRects(...ARMS.north, [WELLS[0]])) box(ax0, ax1, az0, az1, B1 - 0.4, B1, 8);
  box(...ARMS.east, B1 - 0.4, B1, 8);
  box(...ARMS.south, B1 - 0.4, B1, 8);
  // the treads, each solid down to the deck or floor under it
  for (const [k, s] of Object.entries(STAIRS)) {
    const base = s.top === 0 ? B1 - 0.4 : FL - 0.1;
    for (const [x, z, w, d, top] of treads(s)) C.push([x, z, w, d, top - base, base, 6]);
    void k;
  }
  // the slots' walls: S1's two sides up to a parapet on the square, its south rim;
  // S5's north and south sides, its east rim; S2's two sides and its north rim
  const PAR = 1.05;
  box(-27.75, -27.5, 4.5, 9.9, B1 - 0.4, PAR);
  box(-24.5, -24.25, 4.5, 9.9, B1 - 0.4, PAR);
  box(-27.75, -24.25, 9.9, 10.15, 0, PAR, 4);
  box(-22, -16.6, 21.75, 22, B1 - 0.4, PAR);
  box(-22, -16.6, 24, 24.25, B1 - 0.4, PAR);
  box(-16.6, -16.35, 21.75, 24.25, 0, PAR, 4);
  box(-21.25, -21, 34.6, 40, B1 - 0.4, PAR);
  box(-19, -18.75, 34.6, 40, B1 - 0.4, PAR);
  box(-21.25, -18.75, 34.35, 34.6, 0, PAR, 4);
  // the rails round the drop (glass, 1.05): the north arm's edge, the east
  // arm's, the south arm's either side of S5's wall; the stairs' open sides
  box(-31.5, -14.5, 11.95, 12.05, B1, B1 + PAR, 4);
  box(-11.05, -10.95, 12, 22, B1, B1 + PAR, 4);
  box(-29.5, -22, 21.95, 22.05, B1, B1 + PAR, 4);
  box(-16.6, -11, 21.95, 22.05, B1, B1 + PAR, 4);
  for (const [x, z, w, d, top] of treads(STAIRS.G1)) C.push([-14.55, z, 0.1, d, 1.0, top, 4]);
  for (const [x, z, w, d, top] of treads(STAIRS.S4)) C.push([-29.45, z, 0.1, d, 1.0, top, 4]);
  // the two columns under the east arm's corners
  for (const z of [12.3, 21.7]) box(-11.45, -11.05, z - 0.2, z + 0.2, FL, B1 - 0.4, 4);
  return C;
}

/* -------------------------------------------------------------- the shell */
const mat = (color, rough = 0.9, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });

export function underMaterials() {
  const floor = surfMat("marble", 0x0a0910, { mix: 0.04, tile: 3, rough: 0.25 });
  Object.assign(floor, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  return {
    concrete: mat(0x121014, 0.92),
    deck: mat(0x0e0d11, 0.85),
    velvet: mat(0x0b0910, 0.97),
    wood: mat(0x0d0a0a, 0.7),
    step: mat(0x0c0b0e, 0.8),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x8ad8ff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
    floor,
  };
}

/* Draws the dug club's still pieces into `K` (a Kit on the local group:
   B2 = 0) and its glow into `N` (a Neon on it). `M` club-live's materials,
   `UM` underMaterials(). Returns the seats the crowd can take (local y). */
export function buildUnderShell(K, N, M, UM) {
  const { x0, x1, z0, z1 } = HALL;
  const W = x1 - x0, D = z1 - z0, CX = (x0 + x1) / 2, CZ = (z0 + z1) / 2;
  const L = (y) => y - FL;   // world height to local
  const plane = (m, w, h, at, opts = { shadow: false }) => K.add(m, place(new THREE.PlaneGeometry(w, h), at), opts);

  // the floor round the dance floor, the ceiling (the slab's underside)
  for (const [a0, a1, b0, b1] of cutRects(x0, x1, z0, z1, [[DANCE.x0, DANCE.x1, DANCE.z0, DANCE.z1]])) {
    plane(UM.floor, a1 - a0, b1 - b0, { x: (a0 + a1) / 2, y: 0.004, z: (b0 + b1) / 2, rx: -Math.PI / 2 });
  }
  plane(UM.concrete, W + 1, D + 1, { x: CX, y: CEILL - 0.01, z: CZ, rx: Math.PI / 2 });
  // the walls, inside faces (the colliders are the walls; these their skin)
  plane(UM.concrete, D, CEILL, { x: x0 + 0.02, y: CEILL / 2, z: CZ, ry: Math.PI / 2 });
  plane(UM.concrete, D, CEILL, { x: x1 - 0.02, y: CEILL / 2, z: CZ, ry: -Math.PI / 2 });
  plane(UM.concrete, W, CEILL, { x: CX, y: CEILL / 2, z: z0 + 0.02 });
  for (const [a, b] of [[x0, TUNNEL.x0], [TUNNEL.x1, x1]]) plane(UM.concrete, b - a, CEILL, { x: (a + b) / 2, y: CEILL / 2, z: z1 - 0.02, ry: Math.PI });
  plane(UM.concrete, TUNNEL.x1 - TUNNEL.x0, L(B1 - 0.4), { x: (TUNNEL.x0 + TUNNEL.x1) / 2, y: L(B1 - 0.4) / 2, z: z1 - 0.02, ry: Math.PI });

  // the tunnel: floor, walls, ceiling
  {
    const { x0: tx0, x1: tx1, z0: tz0, z1: tz1 } = TUNNEL, tw = tx1 - tx0, td = tz1 - tz0;
    K.box(UM.deck, (tx0 + tx1) / 2, L(B1 - 0.4), (tz0 + tz1) / 2, tw, 0.4, td);
    plane(UM.concrete, td, STL - L(B1), { x: tx0 + 0.02, y: (L(B1) + STL) / 2, z: (tz0 + tz1) / 2, ry: Math.PI / 2 });
    plane(UM.concrete, td, STL - L(B1), { x: tx1 - 0.02, y: (L(B1) + STL) / 2, z: (tz0 + tz1) / 2, ry: -Math.PI / 2 });
    plane(UM.concrete, tw, td, { x: (tx0 + tx1) / 2, y: CEILL - 0.01, z: (tz0 + tz1) / 2, rx: Math.PI / 2 });
    // a strip light down it
    N.bar(M.neon, (tx0 + tx1) / 2, CEILL - 0.08, (tz0 + tz1) / 2, 0.08, 0.04, td - 0.4, {}, { color: 0x7a3cff, k: 1.3, beat: 0.1 });
  }

  // the arms: slab, fascia with its UV strip under the edge
  const deck = (ax0, ax1, az0, az1) => K.box(UM.deck, (ax0 + ax1) / 2, L(B1 - 0.4), (az0 + az1) / 2, ax1 - ax0, 0.4, az1 - az0);
  for (const r of cutRects(...ARMS.north, [WELLS[0]])) deck(...r);
  deck(...ARMS.east);
  deck(...ARMS.south);
  const uv = (x, z, w, d) => N.bar(M.neon, x, L(B1 - 0.46), z, w, 0.05, d, {}, { color: 0x6a2cff, k: 1.5, beat: 0.12 });
  uv((-31.5 - 14.5) / 2, 11.9, 17, 0.06);
  uv(-10.9, 17, 0.06, 10);
  uv((-29.5 - 22) / 2, 22.1, 7.5, 0.06);
  uv((-16.6 - 11) / 2, 22.1, 5.6, 0.06);
  // UV tubes under the arms, over the booths and the bar
  for (const x of [-30, -22, -16, -10]) uv(x, 8.2, 1.4, 0.06);
  for (const z of [14.5, 19.5]) uv(-8.75, z, 0.06, 1.4);
  for (const x of [-28, -24, -14, -9]) uv(x, 26, 1.4, 0.06);
  // the columns under the east arm
  for (const z of [12.3, 21.7]) K.box(M.steel, -11.25, 0, z, 0.4, L(B1 - 0.4), 0.4);

  // the rails: glass panels between steel posts, a top rail
  const rail = (ax, az, bx, bz, y) => {
    const len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az) + Math.PI / 2;
    const cx = (ax + bx) / 2, cz = (az + bz) / 2;
    plane(UM.glass, len, 0.95, { x: cx, y: y + 0.5, z: cz, ry });
    K.box(M.steel, cx, y + 1.0, cz, len, 0.05, 0.05, { ry });
    const n = Math.max(1, Math.round(len / 1.3));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      K.box(M.steel, ax + (bx - ax) * t, y, az + (bz - az) * t, 0.05, 1.0, 0.05);
    }
  };
  rail(-31.5, 12, -14.5, 12, B1L);
  rail(-11, 12, -11, 22, B1L);
  rail(-29.5, 22, -22, 22, B1L);
  rail(-16.6, 22, -11, 22, B1L);

  // the stairs: treads, a lit nosing on each, the open sides' rails
  const stairs = (s, rails = null) => {
    const base = s.top === 0 ? L(B1 - 0.4) : -0.1;
    const T = treads(s);
    T.forEach(([x, z, w, d, top], i) => {
      const t = L(top);
      K.box(UM.step, x, base, z, w, t - base, d);
      const along = s.axis === "+x";
      // the nosing: the tread's leading edge
      const nx = along ? x - d / 2 + 0.02 : x, nz = along ? z : z + (s.axis === "+z" ? -d / 2 + 0.02 : d / 2 - 0.02);
      N.bar(M.neon, nx, t + 0.005, nz, along ? 0.03 : w - 0.1, 0.012, along ? w - 0.1 : 0.03, {}, { color: 0xff2ab4, k: 1.4, chase: 0.6, phase: i / T.length, beat: 0.25 });
      if (rails) for (const rx of rails) {
        plane(UM.glass, d, 0.95, { x: rx, y: t + 0.5, z, ry: Math.PI / 2 });
        if (i % 4 === 0) K.box(M.steel, rx, t, z, 0.05, 1.0, 0.05);
      }
    });
  };
  stairs(STAIRS.S1);
  stairs(STAIRS.S5);
  stairs(STAIRS.S2);
  stairs(STAIRS.G1, [-14.55]);
  stairs(STAIRS.S4, [-29.45]);
  // the slots' walls (up to the parapet on the square) and rims
  const wall = (ax0, ax1, az0, az1, y0, y1) => K.box(UM.concrete, (ax0 + ax1) / 2, y0, (az0 + az1) / 2, ax1 - ax0, y1 - y0, az1 - az0);
  wall(-27.75, -27.5, 4.5, 9.9, L(B1 - 0.4), STL + 1.05);
  wall(-24.5, -24.25, 4.5, 9.9, L(B1 - 0.4), STL + 1.05);
  wall(-27.75, -24.25, 9.9, 10.15, STL, STL + 1.05);
  wall(-22, -16.6, 21.75, 22, L(B1 - 0.4), STL + 1.05);
  wall(-22, -16.6, 24, 24.25, L(B1 - 0.4), STL + 1.05);
  wall(-16.6, -16.35, 21.75, 24.25, STL, STL + 1.05);
  wall(-21.25, -21, 34.6, 40, L(B1 - 0.4), STL + 1.05);
  wall(-19, -18.75, 34.6, 40, L(B1 - 0.4), STL + 1.05);
  wall(-21.25, -18.75, 34.35, 34.6, STL, STL + 1.05);
  // the dug ground's cut faces the wells show: earth behind the slot walls is
  // the walls themselves; the square's slab edge over each slot
  for (const [wx0, wx1, wz0, wz1] of WELLS) {
    plane(UM.concrete, wx1 - wx0, 0.6, { x: (wx0 + wx1) / 2, y: STL - 0.3, z: wz0 + 0.01 });
    plane(UM.concrete, wx1 - wx0, 0.6, { x: (wx0 + wx1) / 2, y: STL - 0.3, z: wz1 - 0.01, ry: Math.PI });
    plane(UM.concrete, wz1 - wz0, 0.6, { x: wx0 + 0.01, y: STL - 0.3, z: (wz0 + wz1) / 2, ry: Math.PI / 2 });
    plane(UM.concrete, wz1 - wz0, 0.6, { x: wx1 - 0.01, y: STL - 0.3, z: (wz0 + wz1) / 2, ry: -Math.PI / 2 });
  }

  /* ---- the furniture (all near-black): booths under the arms on the north
     and south walls, the main bar under the east arm with its stools, the
     balcony's sofas, tables and its own small bar */
  const seats = [];
  const booth = (x, z, face, y = 0) => {
    const dz = face === "+z" ? 1 : -1;
    K.box(UM.velvet, x, y, z, 2.5, 0.45, 0.6);                          // the seat
    K.box(UM.velvet, x, y, z - dz * 0.35, 2.5, 1.1, 0.12);             // its back
    K.box(UM.wood, x, y, z + dz * 0.75, 1.1, 0.42, 0.5);               // the table
    N.add(M.neon, new THREE.SphereGeometry(0.035, 6, 4).translate(x, y + 0.47, z + dz * 0.75), { color: 0xffa040, k: 1.6, beat: 0.05 });
    K.api.ghostBox(x, z - dz * 0.1, 2.5, 0.8, 1.2, { y: y + FL, pen: 3 });
    K.api.ghostBox(x, z + dz * 0.75, 1.1, 0.5, 0.45, { y: y + FL, pen: 2 });
    for (const dx of [-0.8, 0, 0.8]) seats.push({ x: x + dx, z: z + dz * 0.1, y: y + 0.45, floor: y, face, kind: "bench" });
  };
  for (const x of [-22.5, -19, -15.5]) booth(x, z0 + 0.45, "+z");
  for (const x of [-28, -24.5, -16, -12.5]) booth(x, z1 - 0.45, "-z");
  // the main bar: counter, its lit edge, stools (the bottles are club-live's)
  {
    const bx = -8.1, bz0 = 13.5, bz1 = 20.5;
    K.box(M.blackGloss, bx, 0, (bz0 + bz1) / 2, 1.0, 1.1, bz1 - bz0);
    K.box(UM.wood, bx, 1.1, (bz0 + bz1) / 2, 1.15, 0.05, bz1 - bz0 + 0.1);
    N.bar(M.neon, bx - 0.58, 1.05, (bz0 + bz1) / 2, 0.02, 0.03, bz1 - bz0, {}, { color: 0x3ff0ff, k: 1.6, chase: 0.5, chaseLen: 3, beat: 0.2 });
    K.api.ghostBox(bx, (bz0 + bz1) / 2, 1.15, bz1 - bz0 + 0.1, 1.15, { y: FL, pen: 3 });
    for (let i = 0; i < 6; i++) {
      const z = 14.2 + i * 1.2, x = bx - 1.3;
      K.cyl(M.steel, x, 0, z, 0.18, 0.04, 0.72, 10);
      K.cyl(M.blackGloss, x, 0.72, z, 0.2, 0.2, 0.06, 12);
      K.api.ghostBox(x, z, 0.4, 0.4, 0.78, { y: FL, pen: 2 });
      seats.push({ x, z, y: 0.76, floor: 0, face: "+x", kind: "stool", out: 0.6 });
    }
  }
  // the balcony: sofas facing the floor, cocktail tables on the east arm, the small bar on the north arm's west end
  const sofa = (x, z, face, y) => {
    const dz = face === "+z" ? 1 : -1;
    K.box(UM.velvet, x, y, z, 3, 0.42, 0.9);
    K.box(UM.velvet, x, y, z - dz * 0.4, 3, 0.9, 0.12);
    K.api.ghostBox(x, z - dz * 0.05, 3, 1.0, 0.95, { y: y + FL, pen: 3 });
    for (const dx of [-0.95, 0, 0.95]) seats.push({ x: x + dx, z: z + dz * 0.05, y: y + 0.42, floor: y, face, kind: "bench" });
  };
  sofa(-21, 9.2, "+z", B1L);
  sofa(-16.5, 9.2, "+z", B1L);
  sofa(-26, 25.2, "-z", B1L);
  sofa(-14, 25.2, "-z", B1L);
  for (const z of [14.5, 19.5]) {
    K.cyl(M.steel, -8.8, B1L, z, 0.22, 0.05, 0.9, 10);
    K.cyl(M.blackGloss, -8.8, B1L + 0.9, z, 0.32, 0.32, 0.04, 16);
    N.add(M.neon, new THREE.SphereGeometry(0.035, 6, 4).translate(-8.8, B1L + 0.97, z), { color: 0xffa040, k: 1.6, beat: 0.05 });
    K.api.ghostBox(-8.8, z, 0.6, 0.6, 0.95, { y: B1, pen: 2 });
  }
  {
    // the balcony bar: a short counter against the west wall, bottles' glow behind it
    K.box(M.blackGloss, -30.6, B1L, 8.2, 0.9, 1.1, 4);
    K.box(UM.wood, -30.6, B1L + 1.1, 8.2, 1.05, 0.05, 4.1);
    N.bar(M.neon, -30.13, B1L + 1.05, 8.2, 0.02, 0.03, 4, {}, { color: 0xff2ab4, k: 1.5, chase: 0.5, chaseLen: 3, beat: 0.2 });
    K.add(M.backlight, place(new THREE.PlaneGeometry(4, 1.4), { x: x0 + 0.03, y: B1L + 1.9, z: 8.2, ry: Math.PI / 2 }), { shadow: false });
    K.api.ghostBox(-30.6, 8.2, 1.05, 4.1, 1.15, { y: B1, pen: 3 });
  }
  return seats;
}

/* The old club's pieces in a Blender model (kb-shell, kb-props, kb-neon):
   every triangle of a non-Grinjuku part that sits in the old hall is cut,
   the rest of the mesh kept with all its attributes (the bake's uv1 too). */
export function cutOldClub(scene) {
  const partOf = (o) => { while (o.parent && o.parent !== scene) o = o.parent; return o; };
  const v = new THREE.Vector3();
  scene.updateMatrixWorld(true);
  // Grinjuku's part keeps its street, but the wells are cut out of its floor
  const inWell = (x, z, y) => Math.abs(y) < 0.35 && WELLS.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const gone = /^gj/.test(partOf(o).name) ? inWell : inOldHall;
    const g = o.geometry, P = g.attributes.position, idx = g.index;
    const n = idx ? idx.count : P.count;
    const keep = [];
    let dropped = 0;
    for (let t = 0; t < n; t += 3) {
      let cx = 0, cy = 0, cz = 0;
      for (let k = 0; k < 3; k++) {
        v.fromBufferAttribute(P, idx ? idx.getX(t + k) : t + k).applyMatrix4(o.matrixWorld);
        cx += v.x / 3; cy += v.y / 3; cz += v.z / 3;
      }
      if (gone(cx, cz, cy)) { dropped++; continue; }
      keep.push(t, t + 1, t + 2);
    }
    if (!dropped) return;
    if (keep.length === 0) { o.visible = false; o.geometry = new THREE.BufferGeometry(); return; }
    // (the models' attributes are quantized and interleaved: read through
    // the accessor, which strides and denormalizes, into plain floats)
    const out = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(g.attributes)) {
      const size = attr.itemSize, arr = new Float32Array(keep.length * size);
      for (let i = 0; i < keep.length; i++) {
        const src = idx ? idx.getX(keep[i]) : keep[i];
        for (let k = 0; k < size; k++) arr[i * size + k] = attr.getComponent(src, k);
      }
      out.setAttribute(name, new THREE.BufferAttribute(arr, size));
    }
    out.computeBoundingSphere();
    o.geometry = out;
  });
}
