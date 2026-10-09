// Troll Forces — "Troll City", the frontier boomtown map.
//
// A dusty 1870s boomtown on the open plains, after Bronze City (the user's
// reference shots and notes are in HANDOFF.md, images in refs/western/).
// Main Street runs west-east through the middle: false-fronted shops on
// raised boardwalks either side, and the domed courthouse (sheriff's
// office and jail) closing its east end, its clock a trollface. North of
// the shops: back lots, the railway (a locomotive and freight cars standing
// on two tracks), the station, the water tower, the freight shed and the
// lumber yard. South: a cross street down to the livery stable and the
// corral, frontier houses, and Boot Hill.
//
// Every shop can be walked through, front door to back door, and the
// Rusty Grin Saloon has an upstairs: a back room for cards and a balcony
// over Main Street.
//
// It plays both ways. Versus: one team spawns past the railway, the
// other out on the south plain; Main Street is the middle lane, the back
// lots the flanks. Zombies: they walk in off the plains, climb out of
// Boot Hill's graves, and come up the saloon stair after you.
//
// Everything is procedural (trollcity-kit.js) and batched by material.
// Light is the afternoon sun, the sky, and nine point lights indoors, all
// made here at load: nothing adds a light at runtime (light-pool.js).

import * as THREE from "three";
import {
  rng, Kit, place, prismGeo, runs, flat, surfMat, texMat, tex, canvasTex,
  boardsTexture, tinTexture, shingleTexture, damaskTexture, signTexture, wantedTexture,
  bottlesTexture, goodsTexture, paintingTexture, clockTexture, trollPaintTexture,
  glassTexture, curtainTexture, glowTexture, piebaldTexture, barsTexture,
  barrel, crate, crateStack, trough, hitchRail, bollard, telegraphPole, wire, streetLamp,
  wheel, wagon, horse, cactus, steerSkull, rock,
  tableSet as kitTableSet, chair as kitChair, stool as kitStool, piano as kitPiano,
  chandelier, sconce, railFence, picketFence, hayBale, log, coffin, framedPicture, artTexture,
} from "./trollcity-kit.js?v=tc2-wst-tc3";
import { LoopPath, Train } from "./train.js?v=tr1b7";

const BOUNDS = { minX: -62, maxX: 62, minZ: -50, maxZ: 50 };
const T = 0.3;            // wall thickness
const FLOOR = 0.3;        // shop floors and boardwalks sit this high
const STREET = { z0: -7, z1: 7 };
const WALK = 2.6;         // boardwalk depth
const ROW_N = { front: -9.6, back: -21.6 };
const ROW_S = { front: 9.6, back: 21.6 };
const CROSS = { x0: -23, x1: -13 };   // the cross street, south to the stable

// The saloon: everything the stair, the upstairs and the zombies share.
const SALOON = { x0: -23, x1: -5, h1: 4.2, up: 3.6, ff: 9.6 };
const UPPER_Y = SALOON.h1 + 0.3;      // the upstairs floor's top
/* The saloon bar's roleplay spots (Socialize, saloon-bar.js): where the
   props stand, and where you hold X. `zone` is the saloon's footprint. */
const BAR = {
  stand: { x: -6.45, z: -19.75 },
  // `spout`: where the beer comes out (the pour, saloon-bar.js PourFx)
  taps: [{ x: -6.78, z: -19.75, spout: { x: -6.78, y: FLOOR + 1.02, z: -19.36 } }, { x: -6.12, z: -19.75, spout: { x: -6.12, y: FLOOR + 1.02, z: -19.36 } },
    { x: -17.1, z: -20.4, keg: true, spout: { x: -17.1, y: FLOOR + 0.98, z: -19.92 } }],
  rack: { x: -7.45, z: -12.85 },
  apron: { x: -5.5, z: -12.15 },
  bell: { x: -7.45, z: -19.2 },
  bottles: { x: -5.85, z: -16.2 },
  zone: { x0: SALOON.x0, x1: SALOON.x1, z0: ROW_N.back, z1: ROW_N.front },
};
/* Doc Grin's (Socialize roleplay, rp-roles.js): the bag on the desk is
   the job, the medicine shelf pours a tonic. */
const DOC = {
  bag: { x: 31.0, z: -14.0 },
  tonic: { x: 32.0, z: -19.4 },
  zone: { x0: 25, x1: 33, z0: -21.6, z1: -9.6 },
};

/* Every seat in town (Socialize roleplay, rp-roles.js): the chairs,
   stools and the piano stool note themselves as they're built, benches and
   settees are listed where they stand. { x, z, y: seat top, floor, yaw
   (the way you face, camera convention; null = any), kind, stand: where
   you get up to }. Rebuilt with the map. */
const SEATS = [];
function seatAt(x, z, y, floor, yaw, kind, out = 0) {
  const sx = yaw == null ? x : x - Math.sin(yaw) * out, sz = yaw == null ? z : z - Math.cos(yaw) * out;
  SEATS.push({ x, z, y, floor, yaw, kind, stand: { x: sx, z: sz } });
}
/* A bench or settee `len` long along `axis`, a seat every 0.75 m or so. */
function benchSeats(x, z, len, axis, y, floor, yaw) {
  const n = Math.max(1, Math.floor(len / 0.7));
  for (let i = 0; i < n; i++) {
    const u = (i - (n - 1) / 2) * (len / n);
    seatAt(axis === "x" ? x + u : x, axis === "z" ? z + u : z, y, floor, yaw, "bench", 0.7);
  }
}
function chair(K, M, x, y, z, o = {}) { kitChair(K, M, x, y, z, o); seatAt(x, z, y + 0.47, y, o.ry || 0, "chair"); }
function stool(K, M, x, y, z) { kitStool(K, M, x, y, z); seatAt(x, z, y + 0.78, y, null, "stool"); }
function piano(K, M, x, y, z, o = {}) {
  kitPiano(K, M, x, y, z, o);
  const ry = o.ry || 0;
  seatAt(x + Math.sin(ry) * 0.85, z + Math.cos(ry) * 0.85, y + 0.56, y, ry, "piano");
}
/* Where a mug can be set down (Socialize, social-rp.js): the saloon bar's
   counter and its tables. { x, z, y: the top, floor, r (a round table) or
   x0..x1, z0..z1 (a counter) }. Rebuilt with the map. */
const SURFACES = [];
/* The smithy's forge, for the smith (smithy.js) to stoke: its light and the
   coal and glow materials. Rebuilt with the map. */
const SMITHY = { light: null, coal: null, glow: null };
/* The courthouse cells, for a fist fight refused (modes/social-duel.js):
   where to stand inside, facing the bars, and the door to shut. */
const JAIL = { cells: [] };
function tableSet(K, M, x, y, z, o = {}) {
  kitTableSet(K, M, x, y, z, o);
  SURFACES.push({ x, z, y: y + 0.77, floor: y, r: o.r || 0.55 });
  // facing the table, not the chair's own jitter
  for (const s of tableSeats(x, y, z, o)) seatAt(s.x, s.z, s.y, y, Math.atan2(s.x - x, s.z - z), "chair");
}

const STAIR = { x: -22.1, zFoot: -11.0, w: 1.2, steps: 14, rise: (UPPER_Y - FLOOR) / 14, run: 0.3 };
const STAIR_HOLE = { x0: -22.85, x1: -21.4, z0: STAIR.zFoot - STAIR.steps * STAIR.run, z1: -10.6 };

const COURT = { x0: 42, x1: 56, z0: -10, z1: 10, h1: 5.4, up: 3.4 };

const ZSPAWNS = [];

export const TC_FLOORS = { ground: 0, upper: UPPER_Y };
export function tcFloorOf(y) { return y >= 2.4 ? "upper" : "ground"; }

/* ================================================================ builders */

/* An axis-aligned wall of thickness `t`: `axis` "x" runs west-east at
   z = `at`, "z" runs north-south at x = `at`, from `a` to `b`. `holes` cut
   doors and windows: [{ c, w, spans: [[lo, hi], ...] }], heights relative to
   `y`; a span from 0 is a door. Around each opening go a frame (`trim`), a
   glazed pane on windows (`glass`), and a sill step on doors when the room
   has a raised floor (`sill`). `lining` faces the inside (toward -`out`)
   with a second material: wallpaper on plank walls. `inset` stops the
   lining short of both ends (a wall that runs across the side walls' ends:
   flush to the end, its edge showed as a stripe down every corner). */
function wall(K, M, { axis, at, a, b, y = 0, h, t = T, mat, pen = 8, holes = [], trim = null, out = 0, lining = null, glass = true, sill = 0, inset = 0 }) {
  const X = axis === "x";
  const piece = (s, e, lo, hi) => {
    if (e - s < 0.02 || hi - lo < 0.02) return;
    const c = (s + e) / 2, len = e - s;
    K.solid(X ? c : at, X ? at : c, X ? len : t, X ? t : len, hi - lo, { y: y + lo, pen, mat });
    const ls = Math.max(s, a + inset), le = Math.min(e, b - inset);
    if (lining && out && le - ls > 0.02) {
      const li = at - out * (t / 2 + 0.012), lc = (ls + le) / 2, ll = le - ls;
      K.box(lining, X ? lc : li, y + lo, X ? li : lc, X ? ll : 0.02, hi - lo, X ? 0.02 : ll);
    }
  };
  const at2 = (along, perp) => (X ? [along, perp] : [perp, along]);
  let cur = a;
  for (const hole of [...holes].sort((p, q) => p.c - q.c)) {
    const s = hole.c - hole.w / 2, e = hole.c + hole.w / 2;
    piece(cur, s, 0, h);
    let lo = 0;
    const spans = [...hole.spans].sort((p, q) => p[0] - q[0]);
    for (const [sLo, sHi] of spans) { piece(s, e, lo, sLo); lo = sHi; }
    piece(s, e, lo, h);
    cur = e;
    for (const [sLo, sHi] of spans) {
      const door = sLo < 0.05;
      const [cx, cz] = at2(hole.c, at);
      if (door && sill) K.solid(cx, cz, X ? hole.w : t, X ? t : hole.w, sill, { y, pen: 8, mat: M.floor });
      if (!door && glass) {
        const g = new THREE.PlaneGeometry(hole.w, sHi - sLo);
        K.add(M.glass, place(g, { x: cx, y: y + (sLo + sHi) / 2, z: cz, ry: X ? 0 : Math.PI / 2 }), { shadow: false });
        // mullions: a cross of glazing bars
        K.box(M.trimDark, cx, y + sLo, cz, X ? 0.04 : 0.05, sHi - sLo, X ? 0.05 : 0.04);
        K.box(M.trimDark, cx, y + (sLo + sHi) / 2 - 0.02, cz, X ? hole.w : 0.05, 0.04, X ? 0.05 : hole.w);
      }
      if (!trim) continue;
      const fw = 0.12, depth = t + 0.08;
      for (const side of [-1, 1]) {
        const [x, z] = at2(hole.c + side * (hole.w / 2 + fw / 2 - 0.02), at);
        K.box(trim, x, y + sLo, z, X ? fw : depth, sHi - sLo + fw, X ? depth : fw);
      }
      // The head and the sill sink 1 cm into the wall: with their faces on
      // the lintel's underside / the wall's top, the two z-fought.
      K.box(trim, cx, y + sHi - 0.01, cz, X ? hole.w + fw * 2 : depth, fw * 1.4 + 0.01, X ? depth : hole.w + fw * 2);
      if (!door) {
        const [sx, sz] = at2(hole.c, at + out * 0.05);
        K.box(trim, sx, y + sLo - 0.08, sz, X ? hole.w + 0.3 : depth + 0.1, 0.09, X ? depth + 0.1 : hole.w + 0.3);
      }
    }
  }
  piece(cur, b, 0, h);
}

/* Four walls round a rectangle. The north and south walls run the full
   width; west and east fit between them. `holes` per side as in wall(),
   `c` absolute (x on n/s, z on w/e). `skip` leaves a side out. */
function room(K, M, { x0, x1, z0, z1, y = 0, h, t = T, mat, lining = null, trim = null, holes = {}, skip = {}, glass = true, sill = 0, mats = {} }) {
  const common = { y, h, t, trim, lining, glass, sill };
  if (!skip.n) wall(K, M, { ...common, mat: mats.n || mat, axis: "x", at: z0 + t / 2, a: x0, b: x1, out: -1, holes: holes.n || [], inset: t });
  if (!skip.s) wall(K, M, { ...common, mat: mats.s || mat, axis: "x", at: z1 - t / 2, a: x0, b: x1, out: 1, holes: holes.s || [], inset: t });
  if (!skip.w) wall(K, M, { ...common, mat: mats.w || mat, axis: "z", at: x0 + t / 2, a: z0 + t, b: z1 - t, out: -1, holes: holes.w || [] });
  if (!skip.e) wall(K, M, { ...common, mat: mats.e || mat, axis: "z", at: x1 - t / 2, a: z0 + t, b: z1 - t, out: 1, holes: holes.e || [] });
}

/* A flat slab over a rectangle, with one rectangular hole. */
function slabWithHole(K, { x0, x1, z0, z1, y, h, hole, mat, pen = 8 }) {
  const put = (a0, a1, b0, b1) => {
    if (a1 - a0 < 0.05 || b1 - b0 < 0.05) return;
    K.solid((a0 + a1) / 2, (b0 + b1) / 2, a1 - a0, b1 - b0, h, { y, pen, mat });
  };
  put(x0, hole.x0, z0, z1);
  put(hole.x1, x1, z0, z1);
  put(hole.x0, hole.x1, z0, hole.z0);
  put(hole.x0, hole.x1, hole.z1, z1);
}

/* A railing: stops bodies, barely slows a bullet. */
function railing(K, M, { axis, at, a, b, y, mat = M.trimDark }) {
  const X = axis === "x";
  const len = b - a, c = (a + b) / 2;
  const x = X ? c : at, z = X ? at : c;
  K.api.ghostBox(x, z, X ? len : 0.1, X ? 0.1 : len, 1.05, { y, pen: 0.3 });
  K.box(mat, x, y + 0.95, z, X ? len : 0.12, 0.08, X ? 0.12 : len);
  K.box(mat, x, y + 0.08, z, X ? len : 0.08, 0.06, X ? 0.08 : len);
  const n = Math.max(2, Math.round(len / 0.24));
  for (let i = 0; i <= n; i++) {
    const s = a + (len * i) / n;
    K.box(mat, X ? s : at, y + 0.1, X ? at : s, 0.05, 0.86, 0.05);
  }
}

/* A gable roof with its ridge along x (or z with `alongZ`), eaves at y. */
function gableRoof(K, roof, end, { x0, x1, z0, z1, y, rise, over = 0.35, endT = 0.3, ridge = null, alongZ = false }) {
  if (alongZ) {
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, half = (x1 - x0) / 2 + over;
    const len = Math.hypot(half, rise), ang = Math.atan2(rise, half);
    K.box(roof, mx - half / 2, y + rise / 2 - 0.12, mz, len, 0.2, z1 - z0 + over * 2, { rz: ang });
    K.box(roof, mx + half / 2, y + rise / 2 - 0.12, mz, len, 0.2, z1 - z0 + over * 2, { rz: -ang });
    if (ridge) K.box(ridge, mx, y + rise - 0.06, mz, 0.26, 0.18, z1 - z0 + over * 2 + 0.1);
    if (!end) return;
    for (const gz of [z0 + endT / 2, z1 - endT / 2]) {
      K.add(end, place(prismGeo([[-(x1 - x0) / 2, 0], [(x1 - x0) / 2, 0], [0, rise]], endT), { x: mx, y, z: gz }));
    }
    return;
  }
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, half = (z1 - z0) / 2 + over;
  const len = Math.hypot(half, rise), ang = Math.atan2(rise, half);
  K.box(roof, mx, y + rise / 2 - 0.12, mz - half / 2, x1 - x0 + over * 2, 0.2, len, { rx: -ang });
  K.box(roof, mx, y + rise / 2 - 0.12, mz + half / 2, x1 - x0 + over * 2, 0.2, len, { rx: ang });
  if (ridge) K.box(ridge, mx, y + rise - 0.06, mz, x1 - x0 + over * 2 + 0.1, 0.18, 0.26);
  if (!end) return;
  for (const gx of [x0 + endT / 2, x1 - endT / 2]) {
    K.add(end, place(prismGeo([[-(z1 - z0) / 2, 0], [(z1 - z0) / 2, 0], [0, rise]], endT), { x: gx, y, z: mz, ry: Math.PI / 2 }));
  }
}

/* A sign board on a wall: `at` is the wall's outer face line, `o` the
   outward direction (+1/-1 along z, or along x with `axis` "z"). */
function signBoard(K, mat, frame, { x, z, y, w, h, o = 1, axis = "x" }) {
  const X = axis === "x";
  const g = new THREE.PlaneGeometry(w, h);
  // The board stands 1.5 cm proud of the frame's face (0.07 out): flush,
  // the two z-fought and the sign flickered.
  K.add(mat, place(g, { x: X ? x : x + o * 0.085, y, z: X ? z + o * 0.085 : z, ry: X ? (o > 0 ? 0 : Math.PI) : (o > 0 ? Math.PI / 2 : -Math.PI / 2) }), { shadow: false });
  K.box(frame, X ? x : x + o * 0.03, y - h / 2 - 0.06, X ? z + o * 0.03 : z, X ? w + 0.16 : 0.08, h + 0.12, X ? 0.08 : w + 0.16);
}

/* A poster or painting flat on a wall facing `o` along z (or x). */
function wallPic(K, mat, { x, y, z, w, h, o = 1, axis = "x", frame = null }) {
  const X = axis === "x";
  const g = new THREE.PlaneGeometry(w, h);
  // 1.3 cm off its frame's face (0.027 out), clear of z-fighting
  K.add(mat, place(g, { x: X ? x : x + o * 0.04, y, z: X ? z + o * 0.04 : z, ry: X ? (o > 0 ? 0 : Math.PI) : (o > 0 ? Math.PI / 2 : -Math.PI / 2) }), { shadow: false });
  if (frame) K.box(frame, X ? x : x + o * 0.012, y - h / 2 - 0.05, X ? z + o * 0.012 : z, X ? w + 0.1 : 0.03, h + 0.1, X ? 0.03 : w + 0.1);
}

/* A false-fronted shop on one of Main Street's rows. The front faces the
   street (row "n" faces +z, row "s" faces -z); doors front and back so
   every shop is a way through. Builds the floor, the walls (two storeys
   when `up`), the ceiling and roof, the false front with its cornice and
   painted sign, and the porch roof over the boardwalk. Returns the frame
   the furnishing code works in. */
function shop(K, M, spec) {
  const { x0, x1, row, h1, up = 0, ff, wallMat, trim = M.trimDark, lining = M.planksIn, floor = M.floor, sign, signMat } = spec;
  const front = row === "n" ? ROW_N.front : ROW_S.front;
  const back = row === "n" ? ROW_N.back : ROW_S.back;
  const z0 = Math.min(front, back), z1 = Math.max(front, back);
  const o = row === "n" ? 1 : -1;             // the street side, along z
  const fs = row === "n" ? "s" : "n", bs = row === "n" ? "n" : "s";
  const H = h1 + up;
  const cx = (x0 + x1) / 2;

  // floor
  K.solid(cx, (z0 + z1) / 2, x1 - x0 - 2 * T, z1 - z0 - 2 * T, FLOOR, { mat: floor });
  // ground storey
  room(K, M, {
    x0, x1, z0, z1, h: h1, mat: wallMat, lining, trim, sill: FLOOR,
    holes: { [fs]: spec.front || [], [bs]: spec.back || [], w: spec.west || [], e: spec.east || [] },
  });
  if (up) {
    room(K, M, {
      x0, x1, z0, z1, y: h1, h: up, mat: wallMat, lining: spec.liningUp || lining, trim,
      holes: { [fs]: spec.frontUp || [], [bs]: spec.backUp || [], w: spec.westUp || [], e: spec.eastUp || [] },
    });
  }
  // ceiling under the roof (or the upstairs floor)
  if (spec.upperFloor) spec.upperFloor();
  else K.solid(cx, (z0 + z1) / 2, x1 - x0 - 2 * T, z1 - z0 - 2 * T, 0.25, { y: h1, mat: M.ceiling });
  if (up) K.solid(cx, (z0 + z1) / 2, x1 - x0 - 2 * T, z1 - z0 - 2 * T, 0.25, { y: H, mat: M.ceiling });
  // the roof: tin, falling to the back behind the false front. It stops
  // inside the false front (it used to run 30 cm out through the front and
  // drew a dark stripe across the bottom of the sign); eaves at the back.
  {
    const fEnd = front - o * 0.2, bEnd = back - o * 0.3;
    const d = Math.abs(fEnd - bEnd), rise = 0.5;
    const ang = Math.atan2(rise, d) * o;
    K.box(M.roofTin, cx, H + 0.25 + rise / 2, (fEnd + bEnd) / 2, x1 - x0 + 0.4, 0.12, d, { rx: ang });
  }
  // false front: the wall carried up past the roof, a cornice on brackets
  const fz = front + o * (T / 2 + 0.0);
  K.solid(cx, front - o * T / 2 * 0, x1 - x0 + 0.3, T, ff - H, { y: H, mat: wallMat });
  K.box(trim, cx, H - 0.05, front + o * 0.2, x1 - x0 + 0.5, 0.18, 0.18);
  K.box(trim, cx, ff - 0.02, front + o * 0.12, x1 - x0 + 0.7, 0.22, 0.55);
  K.box(trim, cx, ff - 0.22, front + o * 0.1, x1 - x0 + 0.5, 0.12, 0.4);
  // The sign sits between the band and the cornice, and the cornice's
  // brackets stand either side of it: they used to run through the board
  // and the cornice and band cut its top and bottom edges (the "glitchy"
  // signs, user 2026-10-08).
  const hasSign = !!(sign || signMat);
  const sw = Math.min(x1 - x0 - 1.0, spec.signW || 99);
  for (let x = x0 + 0.3; x <= x1 - 0.25; x += (x1 - x0 - 0.55) / Math.max(1, Math.round((x1 - x0) / 1.6))) {
    if (hasSign && Math.abs(x - cx) < sw / 2 + 0.2) continue;
    K.box(trim, x, ff - 0.55, front + o * 0.25, 0.14, 0.34, 0.24);
  }
  // corner boards up the full height
  for (const x of [x0 + 0.08, x1 - 0.08]) K.box(trim, x, 0, front + o * 0.17, 0.2, ff - 0.2, 0.06);
  // the sign: its frame clears the band (top H + 0.13) and the cornice
  // board (bottom ff - 0.22) by a few centimetres, and it stands out past
  // the band's face (0.29 out): behind it, the band hid the sign's bottom
  // line from the street
  if (hasSign) {
    const sh = spec.signH || Math.min(1.5, (ff - H) * 0.62);
    const sy = spec.signY || (H + (ff - H) * 0.46);
    const top = Math.min(sy + sh / 2, ff - 0.3), bot = Math.max(sy - sh / 2, H + 0.21);
    signBoard(K, signMat || texMat(signTexture(sign.text, sign), { rough: 0.85, decal: true }), trim, { x: cx, z: front + o * 0.25, y: (top + bot) / 2, w: sw, h: top - bot, o });
  }
  // porch roof over the boardwalk, on posts at the kerb
  if (spec.porch !== false) {
    const py = spec.porchY || Math.min(h1 - 0.5, 3.5);
    const kerb = front + o * (WALK - 0.25);
    const d = WALK + 0.1;
    K.box(M.roofTin, cx, py - 0.2, front + o * d / 2, x1 - x0 + 0.2, 0.08, d, { rx: o * 0.12 });
    K.box(trim, cx, py - 0.48, kerb, x1 - x0 + 0.1, 0.16, 0.14);
    const n = Math.max(2, Math.round((x1 - x0) / 3.2));
    for (let i = 0; i <= n; i++) {
      const px = x0 + 0.15 + ((x1 - x0 - 0.3) * i) / n;
      K.solid(px, kerb, 0.16, 0.16, py - 0.5 - FLOOR, { y: FLOOR, pen: 3, mat: M.post });
      K.box(trim, px, py - 0.9, kerb - o * 0.15, 0.08, 0.08, 0.5, { rx: o * 0.8 });
    }
  }
  return { x0, x1, z0, z1, front, back, o, h1, H, cx, inX0: x0 + T, inX1: x1 - T, inZ0: z0 + T, inZ1: z1 - T, fz };
}

/* The boardwalks: plank decks one step up, in sections, with a kerb
   board along the street edge. */
function boardwalk(K, M, z0, z1, a, b, gaps = []) {
  for (const [s, e] of runs(a, b, gaps)) {
    for (let x = s; x < e - 0.01; x += 8) {
      const xe = Math.min(e, x + 8);
      K.solid((x + xe) / 2, (z0 + z1) / 2, xe - x, z1 - z0, FLOOR, { mat: M.deck, pen: 6 });
    }
    const kz = Math.abs(z0) < Math.abs(z1) ? z0 : z1;
    K.box(M.trimDark, (s + e) / 2, 0, kz, e - s - 0.02, FLOOR + 0.02, 0.1);   // ends 1 cm in from the deck's
  }
}

/* =============================================================== materials */

function materials() {
  const B = (color, o = {}) => texMat(boardsTexture({ seed: o.seed ?? 3, worn: o.worn ?? 0.3 }), { color, tile: o.tile ?? 2.0, bump: 0.015, rough: 0.92, bounce: o.bounce ?? 0 });
  const clap = (color, o = {}) => {
    const m = B(color, o);
    m.userData.vertical = true;   // boards run along the wall: clapboard
    return m;
  };
  const glow = (color, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k) });
  const std = (color, rough = 0.8, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
  const M = {
    // walls
    wallTan: clap(0xd2b48a, { seed: 3 }),
    wallOrange: B(0xd77a3e, { seed: 5, worn: 0.2 }),
    wallRed: B(0xa04530, { seed: 7 }),
    wallTeal: clap(0x3f8582, { seed: 9, worn: 0.25 }),
    wallGrey: clap(0xa9a49a, { seed: 11, worn: 0.45 }),
    wallWhite: clap(0xeee6d4, { seed: 13, worn: 0.35 }),
    wallGreen: clap(0x6e8c5c, { seed: 15 }),
    wallBlue: clap(0x5c7a98, { seed: 17 }),
    wallMustard: clap(0xd4a848, { seed: 19 }),
    wallBare: B(0xb89a74, { seed: 21, worn: 0.5 }),
    brick: surfMat("brick", 0xa0503a, { mix: 0.35, tile: 2.2 }),
    brickPale: surfMat("brick", 0xd8a888, { mix: 0.45, tile: 2.2 }),
    stone: surfMat("rock", 0xb0a088, { mix: 0.45, tile: 1.2 }),
    plaster: surfMat("plaster", 0xe8dcc4, { mix: 0.4, tile: 2 }),
    // insides
    planksIn: B(0xc8a87e, { seed: 23, bounce: 0.16 }),
    damask: texMat(damaskTexture(), { tile: 0.9, rough: 0.9, bounce: 0.2, color: 0xffffff }),
    damaskGreen: texMat(damaskTexture("#c9d6b0", "#b0c094"), { tile: 0.9, rough: 0.9, bounce: 0.18 }),
    damaskRose: texMat(damaskTexture("#e8cfc0", "#d8b4a2"), { tile: 0.9, rough: 0.9, bounce: 0.18 }),
    floor: B(0x8a6644, { seed: 25, worn: 0.15, tile: 1.8, bounce: 0.1 }),
    ceiling: B(0x5e4a3a, { seed: 27, tile: 1.6, bounce: 0.12 }),
    deck: B(0xa58d6c, { seed: 29, worn: 0.5, tile: 1.8 }),
    // timber, trim, metal
    trimDark: std(0x3b2a20, 0.85),
    trimCream: std(0xe9ddc2, 0.8),
    trimGold: std(0xc89a3a, 0.4, 0.5),
    post: B(0x6b4e36, { seed: 31, tile: 1.2 }),
    rail: B(0x8a6a4a, { seed: 33, tile: 1.5, worn: 0.6 }),
    weathered: B(0x9a8468, { seed: 35, worn: 0.7, tile: 1.4 }),
    pole: B(0x6a5640, { seed: 37, worn: 0.6, tile: 1.4 }),
    roofTin: texMat(tinTexture(), { tile: 2.4, rough: 0.55, metal: 0.4, color: 0xb8b2a8 }),
    roofShingle: texMat(shingleTexture(), { tile: 1.6, rough: 0.95 }),
    roofDark: texMat(shingleTexture(), { tile: 1.6, rough: 0.95, color: 0x7a7a88 }),
    iron: std(0x2a2826, 0.5, 0.5),
    blackIron: std(0x18181a, 0.35, 0.6),
    brass: std(0xc8963a, 0.3, 0.8),
    steel: std(0x8a8c90, 0.35, 0.8),
    rust: std(0x6a3a22, 0.8, 0.3),
    wire: std(0x222222, 0.6, 0.3),
    insulator: new THREE.MeshStandardMaterial({ color: 0x5aa8b0, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 }),
    glass: new THREE.MeshStandardMaterial({ map: glassTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.08, metalness: 0.3 }),
    lampGlass: glow(0xffd28a, 2.2),
    // props
    barrel: B(0x8a5a32, { seed: 39, tile: 0.8 }),
    barrelTop: std(0x6a4426, 0.9),
    crate: B(0xc09460, { seed: 41, tile: 1.0, worn: 0.4 }),
    crateTrim: std(0x8a6438, 0.9),
    water: new THREE.MeshStandardMaterial({ color: 0x3a5a5a, roughness: 0.05, metalness: 0.5 }),
    wheel: std(0x5a3c24, 0.85),
    wagonBed: B(0x7a5a3a, { seed: 43, tile: 1.2 }),
    wagonSide: B(0x9a3a2a, { seed: 45, tile: 1.2, worn: 0.5 }),
    canvasCloth: std(0xece2c8, 0.95, 0, { side: THREE.DoubleSide }),
    horse_bay: texMat(piebaldTexture("#8a4a26", null), { rough: 0.8 }),
    horse_white: texMat(piebaldTexture("#e8e4dc", "#c8c0b4"), { rough: 0.8 }),
    horse_black: texMat(piebaldTexture("#2a2420", null), { rough: 0.7 }),
    horse_paint: texMat(piebaldTexture("#f0ead8", "#7a3a1c"), { rough: 0.8 }),
    horse_dun: texMat(piebaldTexture("#c8a06a", null), { rough: 0.8 }),
    horseDark: std(0x1e1814, 0.8),
    eye: std(0x0a0a0a, 0.2),
    leather: std(0x5a321c, 0.6),
    blanket: std(0xb83a2a, 0.95),
    cactus: surfMat("grass", 0x8ab070, { mix: 0.35, tile: 0.6 }),
    bone: std(0xeee6d2, 0.7),
    horn: std(0xd8cfb8, 0.5),
    eyeSocket: std(0x1a1410, 0.9),
    rock: std(0xb8946c, 0.95, 0, { flatShading: true }),
    rockGrey: surfMat("rock", 0x9a9088, { mix: 0.35, tile: 2.2 }),
    furniture: B(0x5a3a24, { seed: 47, tile: 1.0 }),
    mugGlass: std(0xd8e2dc, 0.12, 0, { transparent: true, opacity: 0.5 }),
    chair: B(0x8a6a48, { seed: 49, tile: 0.8 }),
    pianoWood: std(0x2a1a12, 0.45, 0.1),
    keysWhite: std(0xf2ecdc, 0.4),
    keysBlack: std(0x101010, 0.4),
    sheetMusic: std(0xe8e0c8, 0.9),
    velvet: std(0x8a1a24, 0.95),
    settee: std(0x9a3a5a, 0.95),
    cards: std(0xf2f0ea, 0.8),
    chips: std(0xb82a2a, 0.5),
    whiskey: new THREE.MeshStandardMaterial({ color: 0x8a5a1a, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.8 }),
    hay: surfMat("grass", 0xd8b860, { mix: 0.35, tile: 0.8 }),
    twine: std(0x6a4a2a, 0.9),
    bark: B(0x8a6a4a, { seed: 65, tile: 1.2, worn: 0.6 }),
    logEnd: std(0xd8b080, 0.9),
    coffin: B(0x3a2418, { seed: 51, tile: 1.0, worn: 0.1 }),
    coffinLid: B(0x4a2e1e, { seed: 53, tile: 1.0, worn: 0.1 }),
    picket: std(0xece6da, 0.85),
    gold: std(0xf0c040, 0.25, 0.9, { emissive: 0x3a2a08 }),
    sack: std(0xb89a6a, 1),
    cloth: (() => { const m = std(0xffffff, 0.95); m.vertexColors = true; return m; })(),
    stove: std(0x222224, 0.5, 0.6),
    coal: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff6a1a).multiplyScalar(2.0) }),
    fireGlow: new THREE.MeshBasicMaterial({ map: glowTexture(), color: new THREE.Color(0xff7a2a).multiplyScalar(1.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    redVelvet: texMat(curtainTexture(), { rough: 0.95, side: THREE.DoubleSide, bounce: 0.12, color: 0xffffff }),
    stage: std(0x2e2420, 0.85),
    bars: new THREE.MeshStandardMaterial({ map: barsTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.6, color: 0x888888 }),
    bottles: new THREE.MeshStandardMaterial({ map: bottlesTexture(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.2, metalness: 0.1, emissive: 0x2a1e10, emissiveMap: bottlesTexture() }),
    backlight: glow(0xfff2d0, 1.1),
    goods1: new THREE.MeshStandardMaterial({ map: goodsTexture(7), alphaTest: 0.4, roughness: 0.7, side: THREE.DoubleSide }),
    goods2: new THREE.MeshStandardMaterial({ map: goodsTexture(19), alphaTest: 0.4, roughness: 0.7, side: THREE.DoubleSide }),
    mirror: new THREE.MeshStandardMaterial({ color: 0xd8dee6, roughness: 0.05, metalness: 0.95 }),
    rug: std(0x8a2a2a, 1),
    rugBlue: std(0x2a3a6a, 1),
    ballast: surfMat("rock", 0x8a7e70, { mix: 0.3, tile: 1.2 }),
    tie: B(0x4a3a2c, { seed: 55, tile: 1.0, worn: 0.6 }),
    rail_: std(0x6a6460, 0.35, 0.8),
    loco: std(0x1c1c20, 0.35, 0.6),
    locoRed: std(0x9a1e1e, 0.45, 0.3),
    locoBrass: std(0xd8a440, 0.25, 0.85),
    boxcar: B(0x8a3424, { seed: 57, tile: 1.6, worn: 0.4 }),
    boxcarYellow: B(0xc89a3a, { seed: 59, tile: 1.6, worn: 0.4 }),
    grass: surfMat("dirt", 0x9aa060, { mix: 0.12, tile: 3 }),
    grassDry: surfMat("dirt", 0xc8b070, { mix: 0.25, tile: 3 }),
    hill: surfMat("sand", 0xc8a070, { mix: 0.2, tile: 6 }),
    plainFar: surfMat("sand", 0xc8a272, { mix: 0.35, tile: 5 }),
    dirtPath: surfMat("dirt", 0x9a7a52, { mix: 0.3, tile: 3 }),
    mesa: surfMat("rock", 0xc87850, { mix: 0.25, tile: 9 }),
    mesaDark: surfMat("rock", 0xa05a3a, { mix: 0.2, tile: 9 }),
    flagRed: std(0xb82a2a, 0.9, 0, { side: THREE.DoubleSide }),
    flagWhite: std(0xf0ece2, 0.9, 0, { side: THREE.DoubleSide }),
    flagBlue: std(0x2a3a7a, 0.9, 0, { side: THREE.DoubleSide }),
    dome: std(0xd0c8b8, 0.6, 0.1),
    copper: std(0x5f9a86, 0.55, 0.4),
    tank: B(0x7a5438, { seed: 61, tile: 1.4, worn: 0.4 }),
    outhouse: B(0x8a7458, { seed: 63, tile: 1.2, worn: 0.7 }),
    stripes: texMat(tex("barberpole", () => canvasTex(64, 256, (g) => {
      g.fillStyle = "#f4f0e8";
      g.fillRect(0, 0, 64, 256);
      g.fillStyle = "#c8202a";
      for (let y = -64; y < 320; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y + 32); g.lineTo(64, y + 56); g.lineTo(0, y + 24); g.fill(); }
      g.fillStyle = "#2a4aa0";
      for (let y = -32; y < 320; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y + 32); g.lineTo(64, y + 44); g.lineTo(0, y + 12); g.fill(); }
    })), { rough: 0.4 }),
  };
  M.wanted = [0, 1, 2, 3].map((v) => texMat(wantedTexture(v), { rough: 0.95, decal: true }));
  M.paintDesert = texMat(paintingTexture("desert"), { rough: 0.7, bounce: 0.15, decal: true });
  M.paintPortrait = texMat(paintingTexture("portrait"), { rough: 0.7, bounce: 0.15, decal: true });
  M.clock = new THREE.MeshStandardMaterial({ map: clockTexture(), roughness: 0.5, emissive: 0x222018, emissiveMap: clockTexture() });
  M.trollPaint = new THREE.MeshStandardMaterial({ map: trollPaintTexture("#f2ead6"), transparent: true, alphaTest: 0.35, roughness: 0.9, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  M.trollGold = new THREE.MeshStandardMaterial({ map: trollPaintTexture("#e8b84a"), alphaTest: 0.35, roughness: 0.35, metalness: 0.6, side: THREE.DoubleSide });
  return M;
}

/* A sign painted in the town's style. */
function sign(text, sub = "", o = {}) {
  return texMat(signTexture(text, { sub, ...o }), { rough: 0.85, decal: true });
}

/* ================================================================= interiors */

/* Shelving on a wall, full of goods: `axis` the wall's axis, `at` its inner
   face, `o` into the room. Collides as one box. */
function shelves(K, M, { axis, at, a, b, o, y = FLOOR, h = 2.6, d = 0.45, goods = M.goods1, rows = 4 }) {
  const X = axis === "x";
  const c = (a + b) / 2, len = b - a;
  const mid = at + o * d / 2;
  K.api.ghostBox(X ? c : mid, X ? mid : c, X ? len : d, X ? d : len, h, { y, pen: 2 });
  K.box(M.furniture, X ? c : at + o * 0.02, y, X ? at + o * 0.02 : c, X ? len : 0.04, h, X ? 0.04 : len);
  for (const end of [a, b]) K.box(M.furniture, X ? end : mid, y, X ? mid : end, X ? 0.05 : d, h, X ? d : 0.05);
  for (let i = 0; i <= rows; i++) {
    const sy = y + 0.08 + (i * (h - 0.2)) / rows;
    K.box(M.furniture, X ? c : mid, sy, X ? mid : c, X ? len : d, 0.04, X ? d : len);
    if (i === rows) continue;
    const gh = (h - 0.2) / rows - 0.06;
    const g = new THREE.PlaneGeometry(len - 0.1, gh);
    const uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) * (len - 0.1) / 2.2 + i * 0.37 + a * 0.13);
    K.add(goods, place(g, { x: X ? c : at + o * d * 0.55, y: sy + 0.04 + gh / 2, z: X ? at + o * d * 0.55 : c, ry: X ? (o > 0 ? 0 : Math.PI) : (o > 0 ? Math.PI / 2 : -Math.PI / 2) }), { shadow: false });
  }
}

/* A shop counter: panelled front, a top, a till on it. */
function counter(K, M, { x, z, w, d, h = 1.05, y = FLOOR, axis = "x", till = true, mat = M.furniture }) {
  K.solid(x, z, axis === "x" ? w : d, axis === "x" ? d : w, h, { y, pen: 3, mat });
  K.box(M.trimDark, x, y + h, z, (axis === "x" ? w : d) + 0.08, 0.06, (axis === "x" ? d : w) + 0.08);
  if (till) {
    K.box(M.brass, x + (axis === "x" ? w * 0.3 : 0), y + h + 0.06, z + (axis === "x" ? 0 : w * 0.3), 0.36, 0.26, 0.3);
    K.box(M.brass, x + (axis === "x" ? w * 0.3 : 0), y + h + 0.32, z + (axis === "x" ? 0 : w * 0.3), 0.3, 0.12, 0.06, { rx: -0.3 });
  }
}

/* A sack of grain or flour, slumped. */
function sack(K, M, x, y, z, s = 1) {
  K.add(M.sack, place(new THREE.SphereGeometry(0.3 * s, 8, 6), { x, y: y + 0.24 * s, z, sx: 1, sy: 1.25, sz: 0.8 }));
  K.cyl(M.twine, x, y + 0.5 * s, z, 0.07 * s, 0.05 * s, 0.12 * s, 6);
}

/* A cast-iron stove with a flue through the ceiling. */
function stove(K, M, x, z, { y = FLOOR, top = 4 } = {}) {
  K.solid(x, z, 0.7, 0.6, 0.85, { y, pen: 4, mat: M.stove });
  for (const [dx, dz] of [[-0.2, -0.15], [0.2, -0.15], [-0.2, 0.15], [0.2, 0.15]]) K.cyl(M.iron, x + dx, y + 0.85, z + dz, 0.11, 0.11, 0.02, 10);
  K.cyl(M.stove, x + 0.2, y + 0.85, z + 0.2, 0.07, 0.07, top - y - 0.85, 8);
  K.box(M.coal, x, y + 0.2, z - 0.31, 0.3, 0.12, 0.01, {}, { shadow: false });
}

/* A rack of rifles on a wall. */
function rifleRack(K, M, { x, z, y = FLOOR + 0.9, axis = "x", o = 1, n = 6 }) {
  const X = axis === "x";
  K.box(M.furniture, x, y, z, X ? 2.2 : 0.06, 1.7, X ? 0.06 : 2.2);
  for (let i = 0; i < n; i++) {
    const s = -0.9 + (i * 1.8) / (n - 1);
    const rx = X ? x + s : x + o * 0.08, rz = X ? z + o * 0.08 : z + s;
    K.box(M.furniture, rx, y + 0.1, rz, 0.06, 0.62, 0.05);      // stock
    K.box(M.blackIron, rx, y + 0.7, rz, 0.035, 0.9, 0.035);     // barrel
  }
  K.box(M.trimDark, X ? x : x + o * 0.09, y + 0.85, X ? z + o * 0.09 : z, X ? 2.2 : 0.06, 0.06, X ? 0.06 : 2.2);
}

/* A row of clothes hanging off a rail, every one a different colour. */
function clothesRail(K, M, x, z, { len = 2, axis = "x", seed = 1 } = {}) {
  const X = axis === "x";
  const R = rng(seed);
  K.api.ghostBox(x, z, X ? len : 0.6, X ? 0.6 : len, 1.7, { y: FLOOR, pen: 0.6 });
  for (const s of [-len / 2, len / 2]) K.box(M.iron, X ? x + s : x, FLOOR, X ? z : z + s, 0.04, 1.65, 0.04);
  K.box(M.iron, x, FLOOR + 1.6, z, X ? len : 0.03, 0.03, X ? 0.03 : len);
  const cols = [0x3a2a22, 0x6a1a1a, 0x2a3a5a, 0x8a7a5a, 0x1a1a1a, 0x5a6a3a, 0xc8b898, 0x7a2a4a];
  for (let s = -len / 2 + 0.15; s < len / 2 - 0.1; s += 0.17 + R() * 0.06) {
    const h = 0.8 + R() * 0.4;
    K.box(M.cloth, X ? x + s : x, FLOOR + 1.58 - h, X ? z : z + s, X ? 0.07 : 0.46, h, X ? 0.46 : 0.07, {}, { color: cols[Math.floor(R() * cols.length)] });
  }
}

/* ============================================================= the saloon */

function buildSaloon(K, M, lights) {
  const S = SALOON;
  const F = shop(K, M, {
    x0: S.x0, x1: S.x1, row: "n", h1: S.h1, up: S.up, ff: S.ff, wallMat: M.wallOrange, trim: M.trimDark,
    lining: M.damask, liningUp: M.damaskRose,
    signMat: sign("THE RUSTY GRIN SALOON", "Est. 1872 · \"The best saloon in the West\"", { bg: "#efe2c4", fg: "#3a1a10", edge: "#3a1a10" }),
    signY: S.h1 + S.up + 0.95, signH: 1.45, signW: 12,
    porch: false,
    front: [{ c: -19.5, w: 2.0, spans: [[1.1, 3.3]] }, { c: -14, w: 1.8, spans: [[0, 2.8]] }, { c: -8.5, w: 2.0, spans: [[1.1, 3.3]] }],
    frontUp: [{ c: -19.5, w: 1.3, spans: [[0.9, 2.7]] }, { c: -14, w: 1.3, spans: [[0.3, 2.7]] }, { c: -8.5, w: 1.3, spans: [[0.9, 2.7]] }],
    back: [{ c: -20, w: 1.2, spans: [[0, 2.5]] }, { c: -9.5, w: 1.2, spans: [[0, 2.5]] }],
    backUp: [{ c: -18.5, w: 1.1, spans: [[1.0, 2.6]] }, { c: -10, w: 1.1, spans: [[1.0, 2.6]] }],
    west: [{ c: -18.6, w: 1.2, spans: [[0, 2.5]] }],
    westUp: [{ c: -19, w: 1.1, spans: [[1.0, 2.6]] }],
    eastUp: [{ c: -13, w: 1.1, spans: [[1.0, 2.6]] }],
    upperFloor: () => slabWithHole(K, {
      x0: S.x0 + T, x1: S.x1 - T, z0: ROW_N.back + T, z1: ROW_N.front - T, y: S.h1, h: 0.3,
      hole: STAIR_HOLE, mat: M.ceiling,
    }),
  });
  // the upstairs floorboards over the ceiling slab, so it reads as a floor
  K.box(M.floor, (S.x0 + S.x1) / 2 + 0.75, UPPER_Y + 0.002, (ROW_N.back + ROW_N.front) / 2, S.x1 - S.x0 - 2 * T - 1.5, 0.005, ROW_N.front - ROW_N.back - 2 * T, {}, { shadow: false });

  // corner pilasters and the band between the storeys (the reference's
  // dark timber frame on the orange planks)
  for (const x of [S.x0 + 0.15, -16.5, -11.5, S.x1 - 0.15]) K.box(M.trimDark, x, 0, ROW_N.front + 0.18, 0.34, S.h1 + S.up, 0.1);
  K.box(M.trimDark, -14, S.h1 - 0.15, ROW_N.front + 0.2, S.x1 - S.x0 + 0.3, 0.32, 0.12);

  // the balcony: a deck over the boardwalk on big posts, railed round
  const BZ = ROW_N.front + WALK - 0.1;
  K.solid(-14, (ROW_N.front + BZ) / 2, S.x1 - S.x0 + 0.6, BZ - ROW_N.front, 0.3, { y: S.h1, mat: M.deck });
  for (const x of [S.x0 - 0.1, -18.5, -14, -9.5, S.x1 + 0.1]) {
    K.solid(x, BZ - 0.2, 0.34, 0.34, S.h1 - FLOOR, { y: FLOOR, pen: 4, mat: M.trimDark });
    K.box(M.trimDark, x, S.h1 + 0.3, BZ - 0.2, 0.4, 1.2, 0.4);            // newel post
    K.box(M.trimDark, x, S.h1 + 1.5, BZ - 0.2, 0.48, 0.1, 0.48);
  }
  railing(K, M, { axis: "x", at: BZ - 0.2, a: S.x0 - 0.1, b: S.x1 + 0.1, y: UPPER_Y });
  railing(K, M, { axis: "z", at: S.x0 - 0.1, a: ROW_N.front, b: BZ - 0.2, y: UPPER_Y });
  railing(K, M, { axis: "z", at: S.x1 + 0.1, a: ROW_N.front, b: BZ - 0.2, y: UPPER_Y });
  // lanterns hung from the balcony's underside, and the swing doors
  for (const x of [-20.5, -7.5]) {
    K.cyl(M.iron, x, S.h1 - 0.5, BZ - 0.6, 0.01, 0.01, 0.5, 3, {}, { shadow: false });
    K.box(M.lampGlass, x, S.h1 - 0.85, BZ - 0.6, 0.18, 0.3, 0.18, {}, { shadow: false });
    K.box(M.blackIron, x, S.h1 - 0.56, BZ - 0.6, 0.24, 0.05, 0.24);
  }
  for (const side of [-1, 1]) {
    const hx = -14 + side * 0.9;
    K.add(M.wallOrange, place(new THREE.BoxGeometry(0.85, 1.2, 0.05), { x: hx - side * 0.3, y: FLOOR + 1.35, z: ROW_N.front - 0.25, ry: side * 0.9 }));
  }

  /* ---- ground floor ---- */
  const Y = FLOOR;
  // the bar down the east side: counter, brass foot rail, stools; the
  // back-bar against the wall, arched windows of bottles lit from behind
  K.solid(-7.45, -16, 0.7, 7.2, 1.1, { y: Y, pen: 3, mat: M.furniture });
  K.box(M.trimDark, -7.45, Y + 1.1, -16, 0.86, 0.07, 7.3);
  SURFACES.push({ x: -7.45, z: -16, y: Y + 1.17, floor: Y, x0: -7.82, x1: -7.08, z0: -19.6, z1: -12.4 });
  K.cyl(M.brass, -7.95, Y + 0.2, -16, 0.025, 0.025, 7.0, 6, { rx: Math.PI / 2 });
  for (let z = -19.1; z <= -12.9; z += 1.05) stool(K, M, -8.5, Y, z);
  K.solid(-5.55, -16.2, 0.5, 8.0, 1.0, { y: Y, pen: 3, mat: M.furniture });
  K.box(M.furniture, -5.5, Y + 1.0, -16.2, 0.4, 2.6, 8.0);
  for (const zc of [-18.8, -16.2, -13.6]) {
    // an arch cut into the back-bar: lit panel, two shelves of bottles
    K.box(M.backlight, -5.705, Y + 1.25, zc, 0.02, 1.25, 2.0, {}, { shadow: false });   // 1.5 cm proud: flush, it z-fought the back-bar
    K.add(M.trimDark, place(new THREE.TorusGeometry(1.0, 0.07, 6, 16, Math.PI), { x: -5.7, y: Y + 2.5, z: zc, ry: Math.PI / 2 }));
    for (const sy of [Y + 1.25, Y + 1.9]) {
      K.box(M.furniture, -5.82, sy - 0.03, zc, 0.3, 0.04, 2.0);
      K.add(M.bottles, place(new THREE.PlaneGeometry(1.95, 0.5), { x: -5.82, y: sy + 0.26, z: zc, ry: -Math.PI / 2 }), { shadow: false });   // standing on the shelf, not through it
    }
  }
  steerSkull(K, M, -5.62, Y + 3.3, -16.2, { ry: -Math.PI / 2, s: 1.2 });
  // cash register on the counter, a few glasses and a bottle
  K.box(M.brass, -7.45, Y + 1.16, -18.3, 0.34, 0.24, 0.32);
  K.box(M.brass, -7.45, Y + 1.4, -18.33, 0.3, 0.12, 0.06, { rx: -0.25 });
  for (const z of [-16.4, -15.8, -14.2]) K.cyl(M.whiskey, -7.5, Y + 1.17, z, 0.035, 0.03, 0.1, 8);
  K.cyl(M.whiskey, -7.4, Y + 1.17, -15.1, 0.05, 0.04, 0.32, 8);

  // Socialize roleplay (saloon-bar.js; spots in BAR below): two tap barrels
  // on a stand at the walkway's north end, the mug rack on the counter's
  // south end, the bartender's apron on its hook, the bell by the register.
  K.solid(BAR.stand.x, BAR.stand.z, 1.2, 0.6, 0.85, { y: Y, pen: 2, mat: M.furniture });
  for (const t of BAR.taps.slice(0, 2)) {
    barrel(K, M, t.x, BAR.stand.z, { y: Y + 0.85, lie: true, ry: Math.PI / 2, r: 0.27, h: 0.55, collide: false });
    K.cyl(M.brass, t.x, Y + 1.04, BAR.stand.z + 0.33, 0.018, 0.018, 0.1, 6, { rx: Math.PI / 2 });   // the spigot
    K.box(M.trimDark, t.x, Y + 1.06, BAR.stand.z + 0.36, 0.022, 0.12, 0.022);                       // its handle
  }
  K.box(M.furniture, BAR.rack.x, Y + 1.17, BAR.rack.z, 0.42, 0.03, 0.42);
  for (let i = 0; i < 6; i++) {
    const mx = BAR.rack.x - 0.12 + (i % 2) * 0.24, mz = BAR.rack.z - 0.13 + Math.floor(i / 2) * 0.13;
    K.cyl(M.mugGlass, mx, Y + 1.2, mz, 0.04, 0.038, 0.11, 10, {}, { shadow: false });
  }
  K.cyl(M.brass, BAR.apron.x, Y + 1.72, BAR.apron.z + 0.03, 0.012, 0.012, 0.08, 6, { rx: Math.PI / 2 });   // the hook
  K.add(M.canvasCloth, place(new THREE.PlaneGeometry(0.4, 0.62), { x: BAR.apron.x - 0.02, y: Y + 1.42, z: BAR.apron.z + 0.06 }), { shadow: false });   // its edge clear of the wall
  K.cyl(M.brass, BAR.bell.x, Y + 1.14, BAR.bell.z, 0.05, 0.065, 0.08, 10);
  K.cyl(M.brass, BAR.bell.x, Y + 1.22, BAR.bell.z, 0.012, 0.012, 0.05, 6);

  // the piano stage in the north-west, under red curtains
  {
    const sx0 = -15.6, sx1 = -10.6, sz0 = ROW_N.back + T, sz1 = -18.4;
    K.solid((sx0 + sx1) / 2, (sz0 + sz1) / 2, sx1 - sx0, sz1 - sz0, 0.35, { y: Y, mat: M.stage });
    K.solid((sx0 + sx1) / 2, sz1 + 0.25, sx1 - sx0 - 1.0, 0.5, 0.17, { y: Y, mat: M.stage });   // the step
    // proscenium: two posts and a header, curtains swagged either side
    for (const x of [sx0 + 0.2, sx1 - 0.2]) K.solid(x, sz1 - 0.2, 0.4, 0.4, 3.4, { y: Y + 0.35, pen: 4, mat: M.stage });
    K.box(M.stage, (sx0 + sx1) / 2, Y + 3.4, sz1 - 0.2, sx1 - sx0, 0.5, 0.4);
    for (const side of [-1, 1]) {
      const g = new THREE.PlaneGeometry(1.1, 3.0, 6, 1);
      K.add(M.redVelvet, place(g, { x: (sx0 + sx1) / 2 + side * 1.7, y: Y + 1.9, z: sz1 - 0.45, rz: side * 0.04 }));
    }
    K.add(M.redVelvet, place(new THREE.PlaneGeometry(sx1 - sx0 - 0.6, 0.6, 8, 1), { x: (sx0 + sx1) / 2, y: Y + 3.05, z: sz1 - 0.44 }));
    piano(K, M, (sx0 + sx1) / 2, Y + 0.35, sz0 + 0.55, { ry: 0 });
  }
  // settees along the west wall under paintings (ref: piano room)
  for (const z of [-16.4]) {
    K.solid(-22.35, z, 0.75, 2.0, 0.85, { y: Y, pen: 1.2, mat: M.settee });
    K.box(M.settee, -22.6, Y + 0.85, z, 0.25, 0.5, 2.0);
  }
  wallPic(K, M.paintDesert, { x: S.x0 + T, y: Y + 2.4, z: -16.2, w: 1.5, h: 1.1, o: 1, axis: "z", frame: M.trimGold });
  // tables, the card game on the one by the stage
  tableSet(K, M, -18.5, Y, -12.9, { seed: 3 });
  tableSet(K, M, -12.4, Y, -13.0, { seed: 5, cards: true });
  tableSet(K, M, -17.6, Y, -15.9, { seed: 7, chairs: 3 });
  tableSet(K, M, -10.3, Y, -16.3, { seed: 9 });
  // the timber posts holding the upstairs (ref: dark posts and rails)
  for (const [x, z] of [[-16.5, -14.4], [-11.5, -14.4]]) K.solid(x, z, 0.3, 0.3, S.h1 - Y, { y: Y, pen: 4, mat: M.trimDark });
  K.box(M.trimDark, -14, S.h1 - 0.3, -14.4, 13.6, 0.3, 0.3);
  // chandelier (the room's one light) and sconces round the walls
  chandelier(K, M, -14, S.h1 - 1.2, -14.4, { lights, power: 14, range: 15 });
  for (const [x, z, ry] of [[S.x0 + T, -10.6, Math.PI / 2], [S.x0 + T, -19.6, Math.PI / 2], [-14, ROW_N.back + T, 0], [-6.8, ROW_N.front - T, Math.PI]]) {
    sconce(K, M, x, Y + 2.3, z, { ry });
  }
  K.box(M.rug, -14, Y + 0.005, -11.6, 3.4, 0.01, 1.6, {}, { shadow: false });

  // the kitchen in the back-west corner (ref: stove, skillets, keg, sink)
  {
    const kx1 = -16.4, kz1 = -17.6;
    wall(K, M, { axis: "x", at: kz1, a: S.x0 + T, b: kx1, h: S.h1, mat: M.wallBare, lining: M.planksIn, out: 1, trim: M.trimDark, sill: 0,
      holes: [{ c: -21.2, w: 1.2, spans: [[0, 2.4]] }] });
    wall(K, M, { axis: "z", at: kx1, a: ROW_N.back + T, b: kz1 - T / 2, h: S.h1, mat: M.wallBare, lining: M.planksIn, out: 1 });
    stove(K, M, -18.3, ROW_N.back + 0.7, { top: S.h1 });
    for (const [x, r] of [[-20.2, 0.22], [-19.7, 0.17], [-19.25, 0.14]]) {
      K.add(M.stove, place(new THREE.CylinderGeometry(r, r, 0.04, 10), { x, y: Y + 2.0, z: ROW_N.back + T + 0.05, rx: Math.PI / 2 }));
      K.box(M.stove, x, Y + 2.2 + r * 0.5, ROW_N.back + T + 0.05, 0.04, r * 1.4, 0.03);
    }
    K.box(M.trimDark, -19.7, Y + 2.55, ROW_N.back + T + 0.03, 1.8, 0.08, 0.06);
    // the sink and the keg on its stand
    K.solid(-22.3, -20.6, 0.8, 1.4, 0.9, { y: Y, pen: 2, mat: M.wallBare });
    K.box(M.steel, -22.3, Y + 0.86, -20.6, 0.6, 0.05, 1.1);
    K.box(M.furniture, -17.1, Y, -20.4, 0.9, 0.7, 0.9);
    barrel(K, M, -17.1, -20.4, { y: Y + 0.7, lie: true, ry: 0, r: 0.38, h: 0.85, collide: false });
    K.cyl(M.brass, -17.1, Y + 1.0, -19.97, 0.018, 0.018, 0.1, 6, { rx: Math.PI / 2 });   // the keg's spigot
    K.api.ghostBox(-17.1, -20.4, 0.95, 0.95, 1.5, { y: Y, pen: 2 });
    crate(K, M, -16.95, -18.25, { y: Y, s: 0.6 });
    crate(K, M, -16.95, -18.25, { y: Y + 0.6, s: 0.5, collide: false, ry: 0.3 });
    K.solid(-19.8, -18.3, 1.6, 0.6, 0.8, { y: Y, pen: 2, mat: M.furniture });
    K.cyl(M.stove, -19.5, Y + 0.8, -18.3, 0.2, 0.18, 0.18, 10);
    K.cyl(M.dome, -20.2, Y + 0.8, -18.3, 0.22, 0.12, 0.08, 12);
    for (let i = 0; i < 2; i++) K.box(M.furniture, -21.2 + i * 0.8, Y + 1.7 + i * 0.5, ROW_N.back + T + 0.15, 0.8, 0.04, 0.3);
  }

  // the stair up the west wall, open on its east side
  api_stairs(K, STAIR.x, STAIR.zFoot, STAIR.w, STAIR.steps, STAIR.rise, STAIR.run, "-z", FLOOR);
  for (let i = 0; i < STAIR.steps; i++) {
    const z = STAIR.zFoot - STAIR.run * (i + 0.5);
    const top = FLOOR + STAIR.rise * (i + 1);
    // treads overlap each other 2 cm; the top one stops at the landing (onto it, the two z-fought)
    K.box(M.floor, STAIR.x, top - 0.06, z, STAIR.w, 0.06, STAIR.run + (i === STAIR.steps - 1 ? 0 : 0.02));
    K.box(M.furniture, STAIR.x, top - STAIR.rise, z + 0.14, STAIR.w, STAIR.rise - 0.06, 0.03);
  }
  {
    // the stringer on the open side and the handrail
    const len = STAIR.steps * STAIR.run, rise = STAIR.steps * STAIR.rise, ang = Math.atan2(rise, len);
    const zm = STAIR.zFoot - len / 2;
    K.box(M.trimDark, STAIR.x + STAIR.w / 2 + 0.05, FLOOR + rise / 2 - 0.35, zm, 0.08, 0.4, Math.hypot(len, rise), { rx: ang });
    K.box(M.trimDark, STAIR.x + STAIR.w / 2 + 0.05, FLOOR + rise / 2 + 0.85, zm, 0.08, 0.08, Math.hypot(len, rise), { rx: ang });
    for (let i = 1; i < STAIR.steps; i += 2) {
      const z = STAIR.zFoot - STAIR.run * (i + 0.5), y = FLOOR + STAIR.rise * (i + 1);
      K.box(M.trimDark, STAIR.x + STAIR.w / 2 + 0.05, y, z, 0.04, 0.9, 0.04);
    }
    K.api.ghostBox(STAIR.x + STAIR.w / 2 + 0.06, zm, 0.08, len, rise + 1.0, { y: FLOOR, pen: 0.3 });
  }
  // the upstairs landing's railing round the stairwell (east and south)
  railing(K, M, { axis: "z", at: STAIR_HOLE.x1 + 0.05, a: STAIR_HOLE.z0 + 0.5, b: STAIR_HOLE.z1, y: UPPER_Y });
  railing(K, M, { axis: "x", at: STAIR_HOLE.z1 + 0.05, a: STAIR_HOLE.x0, b: STAIR_HOLE.x1 + 0.05, y: UPPER_Y });

  /* ---- upstairs ---- */
  const U = UPPER_Y;
  // a partition with two doors: the hall at the front, the back room behind
  wall(K, M, { axis: "x", at: -16.6, a: S.x0 + T, b: S.x1 - T, y: U, h: S.h1 + S.up - U, mat: M.wallBare, lining: M.damaskRose, out: 1, trim: M.trimDark,
    holes: [{ c: -17.8, w: 1.1, spans: [[0, 2.3]] }, { c: -9.4, w: 1.1, spans: [[0, 2.3]] }] });
  // the back room (ref: card table, sconces, wagon wheel, a pelt)
  tableSet(K, M, -13.6, U, -19.2, { seed: 11, cards: true, r: 0.7, chairs: 5 });
  tableSet(K, M, -7.6, U, -19.4, { seed: 13, chairs: 2 });
  wheel(K, M, -10.6, U + 2.0, ROW_N.back + T + 0.06, { r: 0.6, spokes: 8 });
  K.add(M.horse_dun, place(prismGeo([[-0.6, -0.8], [0.6, -0.8], [0.8, 0.1], [0.3, 0.8], [-0.3, 0.8], [-0.8, 0.1]], 0.04), { x: -20.6, y: U + 1.8, z: ROW_N.back + T + 0.04 }));
  K.solid(-21.7, -18.6, 1.1, 1.0, 0.95, { y: U, pen: 1.2, mat: M.settee });
  K.box(M.settee, -22.15, U + 0.95, -18.6, 0.25, 0.6, 1.0);
  for (const x of [-16, -6.4]) sconce(K, M, x, U + 2.0, ROW_N.back + T, { ry: 0 });
  K.box(M.rugBlue, -13.6, U + 0.006, -19.2, 3.0, 0.01, 2.6, {}, { shadow: false });
  K.solid(-9.6, -20.3, 2.0, 1.4, 0.55, { y: U, pen: 1, mat: M.furniture });
  K.box(M.canvasCloth, -9.6, U + 0.55, -20.3, 1.95, 0.14, 1.35);
  K.box(M.blanket, -9.2, U + 0.69, -20.3, 1.2, 0.04, 1.37);
  K.box(M.furniture, -10.65, U + 0.5, -20.3, 0.08, 0.8, 1.4);
  K.box(M.rug, -14, U + 0.006, -13.2, 5.0, 0.01, 1.6, {}, { shadow: false });
  wallPic(K, M.wanted[3], { x: -16.0, y: U + 1.7, z: -16.45, w: 0.5, h: 0.75, o: 1 });
  for (let i = 0; i < 3; i++) K.box(M.trimGold, -21.0 + i * 0.5, U + 1.8, ROW_N.front - T - 0.05, 0.05, 0.05, 0.12);
  K.box(M.horseDark, -21.0, U + 1.4, ROW_N.front - T - 0.12, 0.3, 0.45, 0.12);
  wallPic(K, M.wanted[1], { x: -5.3, y: U + 1.8, z: -19.0, w: 0.5, h: 0.75, o: -1, axis: "z" });
  // the hall: settee, a side table, a painting; the door out to the balcony
  K.solid(-11.5, -16.0, 2.0, 0.7, 0.85, { y: U, pen: 1.2, mat: M.settee });
  K.box(M.settee, -11.5, U + 0.85, -16.25, 2.0, 0.5, 0.2);
  K.solid(-7.0, -11.0, 0.8, 0.8, 0.75, { y: U, pen: 1, mat: M.furniture });
  K.cyl(M.lampGlass, -7.0, U + 0.75, -11.0, 0.08, 0.1, 0.3, 8, {}, { shadow: false });
  // on the blank wall between the partition and the window (at z -13.6 it
  // hung half over the window)
  wallPic(K, M.paintDesert, { x: S.x1 - T, y: U + 1.8, z: -15.05, w: 1.4, h: 1.0, o: -1, axis: "z", frame: M.trimGold });
  sconce(K, M, -16.2, U + 2.0, ROW_N.front - T, { ry: Math.PI });
  {
    const l = new THREE.PointLight(0xffc27a, 6, 10, 1.8);
    l.position.set(-14, U + 2.6, -13);
    lights.push(l);
  }
  return F;
}

/* The stair colliders go through the map api (so K9s and the bots find the
   stair link); kept here so the saloon code reads in one place. */
function api_stairs(K, x, z, w, steps, rise, run, dir, y) {
  K.api.stairs(x, z, w, steps, rise, run, dir, { ghost: true, y });
}

/* =============================================================== the shops */

function buildShops(K, M, lights) {
  const Y = FLOOR;
  const R = rng(1872);

  /* ---- north row ---- */
  // Henry Grin Bros., clothiers
  {
    const F = shop(K, M, {
      x0: -50, x1: -40, row: "n", h1: 4.0, ff: 6.3, wallMat: M.wallGreen, trim: M.trimCream, lining: M.damaskGreen,
      sign: { text: "HENRY GRIN BROS.", sub: "Fine Clothiers · Hats for big heads", bg: "#2c3a28", fg: "#e8d8a8", edge: "#e8d8a8" },
      front: [{ c: -47.6, w: 2.2, spans: [[1.0, 3.0]] }, { c: -44.4, w: 1.3, spans: [[0, 2.6]] }, { c: -42.0, w: 1.6, spans: [[1.0, 3.0]] }],
      back: [{ c: -45, w: 1.2, spans: [[0, 2.4]] }],
      east: [{ c: -15.6, w: 1.2, spans: [[0, 2.4]] }],
    });
    clothesRail(K, M, -47.4, -14.2, { len: 2.4, seed: 2 });
    clothesRail(K, M, -47.4, -17.4, { len: 2.4, seed: 4 });
    shelves(K, M, { axis: "z", at: F.inX0, a: -21.0, b: -16.6, o: 1, goods: M.goods2, rows: 5 });
    counter(K, M, { x: -42.2, z: -18.6, w: 2.4, d: 0.7 });
    K.add(M.mirror, place(new THREE.PlaneGeometry(0.8, 1.7), { x: F.inX1 - 0.05, y: Y + 1.25, z: -12.4, ry: -Math.PI / 2 }), { shadow: false });   // in front of its frame (it was inside it)
    K.box(M.trimGold, F.inX1 - 0.03, Y + 0.35, -12.4, 0.03, 1.8, 0.95);
    for (let i = 0; i < 4; i++) {
      // hats on pegs (they'd suit a trollface)
      const z = -20.6 + i * 0.6;
      K.cyl(M.horseDark, F.inX1 - 0.2, Y + 2.2, z, 0.17, 0.12, 0.16, 10, { rz: Math.PI / 2 });
      K.cyl(M.horseDark, F.inX1 - 0.12, Y + 2.2, z, 0.26, 0.26, 0.02, 12, { rz: Math.PI / 2 });
    }
    sconce(K, M, -45, Y + 2.2, ROW_N.back + T, { ry: 0 });
  }
  // Kek & Sons, general mercantile: crowded (the reference: density)
  {
    const F = shop(K, M, {
      x0: -38, x1: -26, row: "n", h1: 4.2, ff: 7.0, wallMat: M.wallTan, trim: M.trimDark,
      sign: { text: "KEK & SONS", sub: "General Mercantile · Everything a troll needs", bg: "#ecdcb8", fg: "#5a1a12", edge: "#5a1a12" },
      front: [{ c: -35.6, w: 2.6, spans: [[0.9, 3.2]] }, { c: -32, w: 1.6, spans: [[0, 2.8]] }, { c: -28.4, w: 2.6, spans: [[0.9, 3.2]] }],
      back: [{ c: -28.0, w: 1.3, spans: [[0, 2.5]] }],
      west: [{ c: -13.8, w: 1.2, spans: [[0, 2.4]] }],
    });
    shelves(K, M, { axis: "z", at: F.inX0, a: -21.0, b: -15.0, o: 1, goods: M.goods1, rows: 5, h: 3.0 });
    shelves(K, M, { axis: "z", at: F.inX1, a: -20.4, b: -12.6, o: -1, goods: M.goods2, rows: 5, h: 3.0 });
    shelves(K, M, { axis: "x", at: ROW_N.back + T, a: -36.6, b: -29.4, o: 1, goods: M.goods1, rows: 5, h: 3.2 });
    counter(K, M, { x: -33.6, z: -18.0, w: 4.0, d: 0.7 });
    K.box(M.steel, -32.4, Y + 1.11, -18.0, 0.5, 0.1, 0.4);             // the scale
    K.cyl(M.steel, -32.4, Y + 1.21, -18.0, 0.18, 0.16, 0.03, 10);
    // cracker barrels, sacks, crates all over the floor
    for (const [x, z] of [[-30.6, -14.2], [-30.0, -15.0], [-35.2, -13.4]]) barrel(K, M, x, z, { y: Y, r: 0.32, h: 0.85 });
    for (const [x, z] of [[-36.2, -16.4], [-35.6, -16.8], [-36.4, -17.2], [-29.4, -11.4]]) sack(K, M, x, Y, z, 0.9 + R() * 0.3);
    K.api.ghostBox(-36.1, -16.8, 1.4, 1.4, 0.7, { y: Y, pen: 1 });
    crate(K, M, -28.2, -13.6, { y: Y, s: 0.8, ry: 0.2 });
    crate(K, M, -28.2, -13.6, { y: Y + 0.8, s: 0.6, ry: -0.1, collide: false });
    stove(K, M, -32.0, -14.4, { top: 4.2 });
    // things hung from the ceiling beams: lanterns, pans, a saddle
    for (let i = 0; i < 6; i++) {
      const x = -36.4 + i * 1.3;
      K.cyl(M.iron, x, 3.4, -12.2, 0.008, 0.008, 0.8, 3, {}, { shadow: false });
      if (i % 2) K.cyl(M.stove, x, 3.2, -12.2, 0.16, 0.16, 0.04, 10, { rx: Math.PI / 2 });
      else K.box(M.lampGlass, x, 3.15, -12.2, 0.14, 0.24, 0.14, {}, { shadow: false });
    }
    const l = new THREE.PointLight(0xffc27a, 7, 11, 1.8);
    l.position.set(-32, 3.3, -15.5);
    lights.push(l);
  }
  // the saloon
  buildSaloon(K, M, lights);
  // Ramirez Bank: brick, heavier, teal false front (the reference)
  {
    const F = shop(K, M, {
      x0: -2, x1: 10, row: "n", h1: 5.2, ff: 7.6, wallMat: M.brick, trim: M.trimCream, lining: M.damaskGreen,
      signMat: sign("RAMIREZ BANK", "First Bank of Carlos Ramirez · Est. 2008", { bg: "#2f6a68", fg: "#e9c46a", edge: "#e9c46a" }),
      signH: 1.6, signW: 8,
      front: [{ c: 0.8, w: 1.8, spans: [[1.2, 3.8]] }, { c: 4, w: 1.8, spans: [[0, 3.0]] }, { c: 7.2, w: 1.8, spans: [[1.2, 3.8]] }],
      back: [{ c: 8.6, w: 1.2, spans: [[0, 2.5]] }],
      porchY: 4.0,
    });
    // the teal facade boards over the brick, like the reference's bank
    K.box(M.wallTeal, 4, 5.2, ROW_N.front + 0.185, 12.2, 2.4, 0.06);   // over the corner boards, not flush with them
    for (const x of [-1.85, 9.85, 2.4, 5.6]) K.box(M.wallTeal, x, 0, ROW_N.front + 0.2, 0.36, 5.2, 0.1);
    for (const [x, ry] of [[-2.15, -Math.PI / 2], [10.15, Math.PI / 2]]) steerSkull(K, M, x, 6.3, -12.0, { ry, s: 1.1 });
    // teller line: a counter across the hall with bars above, a gate
    K.solid(2.9, -15.2, 9.0, 0.6, 1.15, { y: Y, pen: 4, mat: M.furniture });
    K.box(M.trimDark, 2.9, Y + 1.15, -15.2, 9.1, 0.07, 0.7);
    K.add(M.bars, place(new THREE.PlaneGeometry(9.0, 1.2), { x: 2.9, y: Y + 1.82, z: -15.2 }), { shadow: false });
    K.api.ghostBox(2.9, -15.2, 9.0, 0.1, 1.4, { y: Y + 1.15, pen: 0.3 });
    for (const x of [0.4, 3.0, 5.6]) wallPic(K, M.trimCream, { x, y: Y + 2.55, z: -15.17, w: 0.9, h: 0.22, o: 1 });
    // the vault: stone walls, the round door swung open, gold inside
    {
      const vx0 = -1.7, vx1 = 4.2, vz0 = ROW_N.back + T, vz1 = -18.0;
      wall(K, M, { axis: "x", at: vz1, a: vx0, b: vx1, h: 3.4, y: Y, t: 0.6, mat: M.stone, out: 1, trim: M.trimDark, holes: [{ c: 2.6, w: 1.4, spans: [[0, 2.2]] }] });
      wall(K, M, { axis: "z", at: vx1 - 0.3, a: vz0, b: vz1 - 0.3, h: 3.4, y: Y, t: 0.6, mat: M.stone, out: 1 });
      K.solid((vx0 + vx1) / 2, (vz0 + vz1) / 2, vx1 - vx0, vz1 - vz0, 0.3, { y: Y + 3.4, mat: M.stone });
      const door = new THREE.CylinderGeometry(1.0, 1.0, 0.3, 24);
      K.add(M.steel, place(door, { x: 4.0, y: Y + 1.1, z: -17.0, rx: Math.PI / 2, rz: 0, ry: 1.2 }));
      K.add(M.brass, place(new THREE.TorusGeometry(0.35, 0.04, 6, 16), { x: 4.15, y: Y + 1.1, z: -16.6, ry: 1.2 }));
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI;
        K.box(M.brass, 4.15, Y + 1.1, -16.6, 0.04, 0.6, 0.04, { rz: a, ry: 1.2 });
      }
      K.api.ghostBox(4.0, -16.9, 0.8, 1.8, 2.1, { y: Y, pen: 8 });
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3 - i; j++) K.box(M.gold, -0.6 + j * 0.34 + i * 0.17, Y + i * 0.1, -20.3, 0.3, 0.1, 0.16);
        K.box(M.gold, 1.3 + i * 0.32, Y, -20.6, 0.3, 0.1, 0.16);
      }
      for (const [x, z] of [[0.2, -19.0], [0.7, -19.3]]) sack(K, M, x, Y, z, 0.9);
      K.api.ghostBox(0, -20, 2.2, 1.6, 0.6, { y: Y, pen: 2 });
      K.box(M.gold, 0.2, Y + 0.32, -18.75, 0.18, 0.18, 0.01);
    }
    // the manager's desk and a chair, a portrait of the founder
    K.solid(7.3, -19.8, 1.6, 0.8, 0.78, { y: Y, pen: 2, mat: M.furniture });
    chair(K, M, 7.3, Y, -20.6, { ry: Math.PI });
    wallPic(K, M.paintPortrait, { x: 7.3, y: Y + 2.4, z: ROW_N.back + T, w: 1.0, h: 1.3, o: 1, frame: M.trimGold });
    for (const x of [0.5, 7.5]) K.box(M.rugBlue, x, Y + 0.005, -12.2, 2.2, 0.01, 1.4, {}, { shadow: false });
    const l = new THREE.PointLight(0xffd8a0, 7, 12, 1.8);
    l.position.set(4, 4.2, -13.5);
    lights.push(l);
  }
  // Guns & Ammo
  {
    const F = shop(K, M, {
      x0: 13, x1: 23, row: "n", h1: 4.0, ff: 6.2, wallMat: M.wallGrey, trim: M.trimDark,
      sign: { text: "GUNS & AMMO", sub: "No refunds · Problem?", bg: "#2a2420", fg: "#e8b84a", edge: "#e8b84a" },
      front: [{ c: 15.2, w: 2.0, spans: [[1.0, 3.0]] }, { c: 18.4, w: 1.4, spans: [[0, 2.6]] }, { c: 21.2, w: 1.6, spans: [[1.0, 3.0]] }],
      back: [{ c: 15.0, w: 1.2, spans: [[0, 2.4]] }],
      west: [{ c: -16.8, w: 1.2, spans: [[0, 2.4]] }],
    });
    rifleRack(K, M, { x: F.inX1, z: -15.6, axis: "z", o: -1 });
    rifleRack(K, M, { x: 18.6, z: ROW_N.back + T, axis: "x", o: 1 });
    // a glass display case for a counter
    K.solid(17.6, -16.4, 5.0, 0.7, 1.0, { y: Y, pen: 3, mat: M.furniture });
    K.box(M.glass, 17.6, Y + 1.0, -16.4, 4.9, 0.02, 0.62, {}, { shadow: false });
    for (let i = 0; i < 6; i++) K.box(M.blackIron, 15.6 + i * 0.75, Y + 0.95, -16.4, 0.28, 0.04, 0.12, { ry: 0.4 });
    for (const [x, z] of [[21.9, -19.4], [21.9, -20.4], [21.0, -20.5]]) crate(K, M, x, z, { y: Y, s: 0.7 });
    wallPic(K, M.wanted[0], { x: F.inX0, y: Y + 2.0, z: -12.6, w: 0.5, h: 0.75, o: 1, axis: "z" });
    wallPic(K, M.wanted[2], { x: F.inX0, y: Y + 2.0, z: -13.6, w: 0.5, h: 0.75, o: 1, axis: "z" });
    sconce(K, M, 18, Y + 2.3, ROW_N.back + T, { ry: 0 });
  }
  // Doc Grin
  {
    const F = shop(K, M, {
      x0: 25, x1: 33, row: "n", h1: 3.8, ff: 5.8, wallMat: M.wallWhite, trim: M.trimDark,
      sign: { text: "DOC GRIN", sub: "Physician · Surgeon · Dentist", bg: "#f2eadc", fg: "#2a2a6a", edge: "#2a2a6a" },
      front: [{ c: 27, w: 1.8, spans: [[1.0, 2.9]] }, { c: 30.4, w: 1.3, spans: [[0, 2.6]] }],
      back: [{ c: 31.2, w: 1.2, spans: [[0, 2.4]] }],
      east: [{ c: -17.8, w: 1.2, spans: [[0, 2.4]] }],
    });
    // the exam table, a folding screen, a desk, the medicine shelf
    K.solid(27.0, -18.6, 2.0, 0.8, 0.85, { y: Y, pen: 2, mat: M.furniture });
    K.box(M.leather, 27.0, Y + 0.85, -18.6, 1.95, 0.1, 0.75);
    for (let i = 0; i < 3; i++) K.add(M.trimCream, place(new THREE.BoxGeometry(0.7, 1.7, 0.04), { x: 28.6 + i * 0.55, y: Y + 0.9, z: -17.0 + (i % 2) * 0.2, ry: (i % 2 ? 0.5 : -0.5) }));
    K.solid(31.4, -14.0, 1.4, 0.7, 0.78, { y: Y, pen: 2, mat: M.furniture });
    chair(K, M, 31.4, Y, -14.8, { ry: Math.PI });
    K.box(M.furniture, F.inX1 - 0.18, Y + 1.0, -19.4, 0.3, 1.8, 2.2);
    for (const sy of [Y + 1.3, Y + 1.9, Y + 2.5]) K.add(M.bottles, place(new THREE.PlaneGeometry(2.1, 0.5), { x: F.inX1 - 0.34, y: sy, z: -19.4, ry: -Math.PI / 2 }), { shadow: false });
    K.api.ghostBox(F.inX1 - 0.18, -19.4, 0.36, 2.2, 2.8, { y: Y, pen: 2 });
    sconce(K, M, 28, Y + 2.2, ROW_N.back + T, { ry: 0 });
  }

  /* ---- south row ---- */
  // Irongrin Smithy: a wide open front, the forge glowing at the back
  {
    const F = shop(K, M, {
      x0: -50, x1: -38, row: "s", h1: 4.6, ff: 6.2, wallMat: M.wallRed, trim: M.trimDark, lining: M.planksIn,
      sign: { text: "IRONGRIN SMITHY", sub: "Wagons mended · Horses shod", bg: "#2a1a14", fg: "#f0d8a0", edge: "#f0d8a0" },
      front: [{ c: -44, w: 4.6, spans: [[0, 3.6]] }],
      back: [{ c: -40.2, w: 1.3, spans: [[0, 2.5]] }],
      porch: false,
    });
    // the forge: a stone hearth, coals, a hood and chimney through the roof
    K.solid(-47.4, 19.8, 2.2, 1.4, 0.9, { y: Y, pen: 10, mat: M.stone });
    // its own coal and glow materials, so the smith can make them breathe
    SMITHY.coal = M.coal.clone();
    SMITHY.glow = M.fireGlow.clone();
    K.box(SMITHY.coal, -47.4, Y + 0.9, 19.7, 1.4, 0.06, 0.9, {}, { shadow: false });
    K.add(SMITHY.glow, place(new THREE.PlaneGeometry(3, 3), { x: -47.4, y: Y + 0.95, z: 19.7, rx: -Math.PI / 2 }), { shadow: false });
    K.box(M.stone, -47.4, Y + 2.3, 20.2, 2.0, 1.0, 1.0);
    K.box(M.stone, -47.4, Y + 3.3, 20.6, 0.9, 3.4, 0.7);
    // anvil on a stump, a quench barrel, tools on the wall
    K.cyl(M.bark, -45.4, Y, 18.0, 0.35, 0.35, 0.55, 10);
    K.box(M.blackIron, -45.4, Y + 0.55, 18.0, 0.7, 0.18, 0.28);
    K.box(M.blackIron, -45.4, Y + 0.73, 18.0, 0.9, 0.14, 0.3);
    K.cyl(M.blackIron, -44.85, Y + 0.73, 18.0, 0.13, 0.0, 0.3, 6, { rz: Math.PI / 2 });
    K.api.ghostBox(-45.4, 18.0, 0.9, 0.7, 0.9, { y: Y, pen: 6 });
    barrel(K, M, -43.6, 19.8, { y: Y });
    for (let i = 0; i < 5; i++) K.box(M.blackIron, -42.6 + i * 0.35, Y + 1.6, F.inZ1 - 0.04, 0.06, 0.6, 0.03);
    for (const [x, z, ry] of [[-39.0, 14.0, Math.PI / 2], [-39.0, 16.2, Math.PI / 2]]) wheel(K, M, x - 0.1, 0.9, z, { r: 0.6, ry, rz: 0.12 });
    wagon(K, M, -42.6, 13.2, { ry: 0.2, load: 0 });
    for (let i = 0; i < 6; i++) K.add(M.blackIron, place(new THREE.TorusGeometry(0.08, 0.015, 4, 10, Math.PI * 1.4), { x: -49.6, y: Y + 1.6 + (i % 3) * 0.25, z: 13 + Math.floor(i / 3) * 0.3, ry: Math.PI / 2, rz: -0.6 }));
    const l = new THREE.PointLight(0xff7a2a, 9, 10, 1.6);
    l.position.set(-47.4, Y + 1.4, 19.0);
    lights.push(l);
    SMITHY.light = l;
  }
  // the Grin Inn: two storeys of front (the rooms are let out; only the
  // lobby is open)
  {
    const F = shop(K, M, {
      x0: -35, x1: -25, row: "s", h1: 4.0, up: 3.4, ff: 8.6, wallMat: M.wallBlue, trim: M.trimCream, lining: M.damaskRose,
      sign: { text: "GRIN INN", sub: "Rooms · Baths · No questions", bg: "#efe6d4", fg: "#2a3a6a", edge: "#2a3a6a" },
      signY: 8.0, signH: 1.0,
      front: [{ c: -32.6, w: 1.8, spans: [[1.0, 3.0]] }, { c: -30, w: 1.5, spans: [[0, 2.7]] }, { c: -27.4, w: 1.8, spans: [[1.0, 3.0]] }],
      frontUp: [{ c: -33.0, w: 1.0, spans: [[0.8, 2.4]] }, { c: -30, w: 1.0, spans: [[0.8, 2.4]] }, { c: -27.0, w: 1.0, spans: [[0.8, 2.4]] }],
      back: [{ c: -27.0, w: 1.2, spans: [[0, 2.4]] }],
      west: [{ c: 15.5, w: 1.2, spans: [[0, 2.4]] }],
    });
    // dark rooms behind the upstairs windows
    for (const x of [-33.0, -30, -27.0]) K.box(M.trimDark, x, 4.6, ROW_S.front + 0.6, 1.0, 1.8, 0.04);
    counter(K, M, { x: -27.6, z: 18.4, w: 0.7, d: 2.4, axis: "z" });
    K.box(M.furniture, -25.4, Y + 1.4, 18.4, 0.06, 1.0, 1.6);
    for (let i = 0; i < 8; i++) K.box(M.brass, -25.45, Y + 1.6 + Math.floor(i / 4) * 0.4, 17.85 + (i % 4) * 0.36, 0.03, 0.14, 0.04);
    K.solid(-33.6, 18.6, 0.8, 2.2, 0.85, { y: Y, pen: 1.2, mat: M.settee });
    K.box(M.settee, -34.05, Y + 0.85, 18.6, 0.25, 0.5, 2.2);
    K.box(M.rug, -30, Y + 0.005, 15.0, 3.0, 0.01, 2.2, {}, { shadow: false });
    wallPic(K, M.paintDesert, { x: -30.6, y: Y + 2.3, z: F.inZ1, w: 1.4, h: 1.0, o: -1, frame: M.trimGold });
    chandelier(K, M, -30, 3.0, 15.4, { r: 0.6, lights, power: 6, range: 9 });
  }
  // Telegraph & Post
  {
    const F = shop(K, M, {
      x0: -13, x1: -3, row: "s", h1: 4.0, ff: 6.0, wallMat: M.wallMustard, trim: M.trimDark,
      sign: { text: "TELEGRAPH & POST", sub: "Western Grin Co. · Dots, dashes & memes", bg: "#2a2a2a", fg: "#f0e0b0", edge: "#f0e0b0" },
      front: [{ c: -10.6, w: 2.0, spans: [[1.0, 3.0]] }, { c: -7, w: 1.4, spans: [[0, 2.6]] }, { c: -4.6, w: 1.2, spans: [[1.0, 3.0]] }],
      back: [{ c: -11.0, w: 1.2, spans: [[0, 2.4]] }],
      west: [{ c: 17, w: 1.2, spans: [[0, 2.4]] }],
    });
    counter(K, M, { x: -6.0, z: 17.4, w: 5.0, d: 0.7, till: false });
    // pigeonholes for the mail, the key on the desk
    K.box(M.furniture, -6.0, Y + 1.2, F.inZ1 - 0.15, 4.4, 1.8, 0.3);
    for (let i = 0; i < 11; i++) for (let j = 0; j < 4; j++) {
      K.box(M.trimDark, -8.0 + i * 0.4, Y + 1.3 + j * 0.42, F.inZ1 - 0.31, 0.32, 0.32, 0.02);
      if ((i * 7 + j * 3) % 4) K.box(M.cards, -8.0 + i * 0.4, Y + 1.33 + j * 0.42, F.inZ1 - 0.32, 0.26, 0.06, 0.02, { rz: 0.1 * ((i + j) % 3 - 1) });
    }
    K.box(M.brass, -4.6, Y + 1.11, 17.4, 0.3, 0.06, 0.2);
    K.box(M.brass, -4.6, Y + 1.17, 17.35, 0.2, 0.03, 0.04, { rx: 0.2 });
    for (const [x, z] of [[-4.8, 20.0], [-4.2, 20.5], [-5.0, 20.6]]) sack(K, M, x, Y, z, 0.9);
    K.api.ghostBox(-4.6, 20.3, 1.4, 1.2, 0.7, { y: Y, pen: 1 });
    sconce(K, M, -8, Y + 2.2, F.inZ0, { ry: Math.PI });
  }
  // Shave & a Haircut
  {
    const F = shop(K, M, {
      x0: -1, x1: 7, row: "s", h1: 3.8, ff: 5.8, wallMat: M.wallWhite, trim: M.trimDark,
      sign: { text: "SHAVE & A HAIRCUT", sub: "Two bits · Trims for grins", bg: "#f2ecdc", fg: "#a01a22", edge: "#2a4aa0" },
      front: [{ c: 1.4, w: 2.2, spans: [[1.0, 2.9]] }, { c: 4.6, w: 1.3, spans: [[0, 2.6]] }],
      back: [{ c: 5.4, w: 1.2, spans: [[0, 2.4]] }],
    });
    for (const x of [0.8, 3.2]) {
      // a barber's chair: red seat on a pedestal
      K.cyl(M.steel, x, Y, 18.8, 0.28, 0.2, 0.4, 12);
      K.solid(x, 18.9, 0.7, 0.8, 0.75, { y: Y, pen: 1.2, mat: M.velvet });
      K.box(M.velvet, x, Y + 0.75, 19.3, 0.7, 0.8, 0.15, { rx: 0.25 });
      K.box(M.steel, x, Y + 0.2, 18.35, 0.5, 0.05, 0.3);
    }
    K.add(M.mirror, place(new THREE.PlaneGeometry(4.2, 1.2), { x: 2.0, y: Y + 1.7, z: F.inZ1 - 0.02, ry: Math.PI }), { shadow: false });
    K.box(M.trimDark, 2.0, Y + 1.04, F.inZ1 - 0.04, 4.4, 1.32, 0.04);
    K.box(M.trimCream, 2.0, Y + 0.85, F.inZ1 - 0.25, 4.4, 0.08, 0.45);
    for (const x of [0.8, 3.2]) K.cyl(M.dome, x, Y + 0.93, F.inZ1 - 0.25, 0.18, 0.12, 0.08, 10);
    // the striped pole outside, by the door
    K.solid(6.4, ROW_S.front - 0.5, 0.24, 0.24, 2.0, { y: FLOOR, pen: 2 });
    K.cyl(M.stripes, 6.4, FLOOR + 0.3, ROW_S.front - 0.5, 0.1, 0.1, 1.4, 12);
    K.add(M.steel, place(new THREE.SphereGeometry(0.13, 10, 6), { x: 6.4, y: FLOOR + 1.85, z: ROW_S.front - 0.5 }));
    sconce(K, M, 2, Y + 2.2, F.inZ0, { ry: Math.PI });
  }
  // Six Feet Under, undertaker
  {
    const F = shop(K, M, {
      x0: 10, x1: 20, row: "s", h1: 4.0, ff: 6.4, wallMat: M.wallBare, trim: M.trimDark,
      sign: { text: "SIX FEET UNDER", sub: "Undertaker · We'll have the last laugh", bg: "#1a1a1a", fg: "#d8d0c0", edge: "#d8d0c0" },
      front: [{ c: 12.4, w: 2.0, spans: [[1.0, 3.0]] }, { c: 16.0, w: 1.4, spans: [[0, 2.6]] }],
      back: [{ c: 18.4, w: 1.2, spans: [[0, 2.4]] }],
      east: [{ c: 15.6, w: 1.2, spans: [[0, 2.4]] }],
    });
    for (const [x, ry] of [[11.0, 0.1], [12.0, -0.08], [13.0, 0.05]]) coffin(K, M, x, Y, F.inZ1 - 0.25, { ry: Math.PI + ry, stand: true });
    K.api.ghostBox(12.0, F.inZ1 - 0.3, 3.2, 0.5, 1.9, { y: Y, pen: 2 });
    // one on trestles, lid off, a trollface painted inside
    K.box(M.furniture, 16.4, Y, 18.8, 0.1, 0.75, 0.6);
    K.box(M.furniture, 17.9, Y, 18.8, 0.1, 0.75, 0.6);
    coffin(K, M, 17.15, Y + 0.75, 18.8, { ry: Math.PI / 2 });
    K.api.ghostBox(17.15, 18.8, 2.0, 0.8, 1.0, { y: Y, pen: 2 });
    K.add(M.trollPaint, place(new THREE.PlaneGeometry(0.5, 0.5), { x: 16.6, y: Y + 1.118, z: 18.8, rx: -Math.PI / 2 }), { shadow: false });
    wallPic(K, sign("ONE SIZE FITS MOST", "", { bg: "#efe6d4", fg: "#1a1a1a", edge: "#1a1a1a", w: 512, h: 128 }), { x: 15, y: Y + 2.4, z: F.inZ1, w: 1.6, h: 0.4, o: -1 });
    sconce(K, M, 14.5, Y + 2.2, F.inZ0, { ry: Math.PI });
  }
  // the Assay Office
  {
    const F = shop(K, M, {
      x0: 23, x1: 33, row: "s", h1: 4.0, ff: 6.0, wallMat: M.wallTan, trim: M.trimCream,
      sign: { text: "ASSAY OFFICE", sub: "We buy gold · And memes", bg: "#5a1a14", fg: "#f0c860", edge: "#f0c860" },
      front: [{ c: 25.4, w: 2.0, spans: [[1.0, 3.0]] }, { c: 28.6, w: 1.4, spans: [[0, 2.6]] }, { c: 31.4, w: 1.6, spans: [[1.0, 3.0]] }],
      back: [{ c: 25.0, w: 1.2, spans: [[0, 2.4]] }],
      west: [{ c: 15.6, w: 1.2, spans: [[0, 2.4]] }],
    });
    counter(K, M, { x: 28.6, z: 17.6, w: 5.0, d: 0.7, till: false });
    // a balance scale and nuggets on the counter, a safe behind
    K.box(M.brass, 27.6, Y + 1.11, 17.6, 0.06, 0.5, 0.06);
    K.box(M.brass, 27.6, Y + 1.6, 17.6, 0.7, 0.03, 0.03);
    for (const s of [-0.33, 0.33]) K.cyl(M.brass, 27.6 + s, Y + 1.3, 17.6, 0.12, 0.1, 0.03, 10);
    const N = rng(7);
    for (let i = 0; i < 9; i++) K.add(M.gold, place(new THREE.IcosahedronGeometry(0.05 + N() * 0.04, 0), { x: 29.4 + N() * 0.6, y: Y + 1.12, z: 17.4 + N() * 0.4 }));
    K.solid(31.6, 20.4, 1.0, 0.9, 1.3, { y: Y, pen: 12, mat: M.blackIron });
    K.box(M.brass, 31.6, Y + 0.65, 19.94, 0.2, 0.2, 0.02);
    for (const [x, z] of [[26.3, 20.4], [26.9, 20.8]]) sack(K, M, x, Y, z, 1);
    K.api.ghostBox(26.6, 20.6, 1.4, 1.4, 0.7, { y: Y, pen: 1 });
    sconce(K, M, 28, Y + 2.2, F.inZ0, { ry: Math.PI });
  }
}

/* =========================================================== the courthouse */

/* Sheriff's office in front, the jail behind; brick, two storeys of
   windows, a clock tower with the trollface on every dial, and a dome. */
function buildCourthouse(K, M, lights) {
  const C = COURT, Y = FLOOR;
  const cz = 0;
  K.solid((C.x0 + C.x1) / 2, cz, C.x1 - C.x0 - 2 * T, C.z1 - C.z0 - 2 * T, FLOOR, { mat: M.floor });
  const winW = { w: 1.2, spans: [[1.3, 3.7]] };
  room(K, M, {
    x0: C.x0, x1: C.x1, z0: C.z0, z1: C.z1, h: C.h1, mat: M.brickPale, lining: M.damaskGreen, trim: M.trimCream, sill: FLOOR,
    holes: {
      w: [{ c: -5.6, ...winW }, { c: 0, w: 2.0, spans: [[0, 3.2]] }, { c: 5.6, ...winW }],
      n: [{ c: 45.4, w: 1.3, spans: [[0, 2.6]] }, { c: 50.2, w: 1.2, spans: [[0, 2.5]] }],
      s: [{ c: 45.4, w: 1.3, spans: [[0, 2.6]] }, { c: 50.2, w: 1.2, spans: [[0, 2.5]] }],
      e: [{ c: -6.6, w: 0.6, spans: [[2.6, 3.6]] }, { c: 0, w: 0.6, spans: [[2.6, 3.6]] }, { c: 6.6, w: 0.6, spans: [[2.6, 3.6]] }],
    },
  });
  // the upper storey: windows only, dark rooms behind
  room(K, M, {
    x0: C.x0, x1: C.x1, z0: C.z0, z1: C.z1, y: C.h1, h: C.up, mat: M.brickPale, trim: M.trimCream,
    holes: {
      w: [-5.6, -2, 2, 5.6].map((c) => ({ c, w: 1.0, spans: [[0.7, 2.5]] })),
      n: [44.6, 48, 52.4].map((c) => ({ c, w: 1.0, spans: [[0.7, 2.5]] })),
      s: [44.6, 48, 52.4].map((c) => ({ c, w: 1.0, spans: [[0.7, 2.5]] })),
    },
  });
  K.solid((C.x0 + C.x1) / 2, cz, C.x1 - C.x0 - 2 * T, C.z1 - C.z0 - 2 * T, 0.25, { y: C.h1, mat: M.ceiling });
  for (const [x, z, w, d] of [[C.x0 + 0.5, 0, 0.04, 19], [C.x1 - 0.5, 0, 0.04, 19], [49, C.z0 + 0.5, 13, 0.04], [49, C.z1 - 0.5, 13, 0.04]]) K.box(M.trimDark, x, C.h1 + 0.3, z, w, C.up - 0.4, d);
  // the cornice and roof
  const top = C.h1 + C.up;
  K.box(M.trimCream, 49, top - 0.1, 0, C.x1 - C.x0 + 0.7, 0.35, C.z1 - C.z0 + 0.7);
  K.box(M.trimCream, 49, C.h1 - 0.12, 0, C.x1 - C.x0 + 0.3, 0.22, C.z1 - C.z0 + 0.3);
  K.solid(49, 0, C.x1 - C.x0, C.z1 - C.z0, 0.3, { y: top, mat: M.roofTin });
  // the portico on the west: four columns, a pediment, the step up
  K.solid(C.x0 - 1.4, 0, 2.8, 9.6, FLOOR, { mat: M.stone });
  for (const z of [-3.9, -1.3, 1.3, 3.9]) {
    K.solid(C.x0 - 2.3, z, 0.5, 0.5, 4.6, { y: FLOOR, pen: 6 });
    K.cyl(M.trimCream, C.x0 - 2.3, FLOOR, z, 0.26, 0.22, 4.6, 14);
    K.box(M.trimCream, C.x0 - 2.3, FLOOR, z, 0.6, 0.2, 0.6);
    K.box(M.trimCream, C.x0 - 2.3, FLOOR + 4.5, z, 0.6, 0.2, 0.6);
  }
  K.box(M.trimCream, C.x0 - 1.3, FLOOR + 4.7, 0, 3.0, 0.5, 10.2);
  K.add(M.trimCream, place(prismGeo([[-5.2, 0], [5.2, 0], [0, 1.5]], 3.0), { x: C.x0 - 1.3, y: FLOOR + 5.2, z: 0, ry: Math.PI / 2 }));
  wallPic(K, sign("COURTHOUSE", "Sheriff · Jail · Justice (lol)", { bg: "#efe6d4", fg: "#2a2a2a", edge: "#2a2a2a" }), { x: C.x0 - 2.82, y: FLOOR + 4.95, z: 0, w: 6.0, h: 0.5 * 1.0, o: -1, axis: "z" });
  // the clock tower and the dome (the end of Main Street's view)
  {
    const tx = 48.5, tz = 0, ty = top + 0.3, tw = 4.2, th = 3.6;
    K.box(M.brickPale, tx, ty, tz, tw, th, tw);
    K.box(M.trimCream, tx, ty + th - 0.1, tz, tw + 0.5, 0.3, tw + 0.5);
    K.box(M.trimCream, tx, ty, tz, tw + 0.3, 0.25, tw + 0.3);
    for (const [dx, dz, ry] of [[-1, 0, -Math.PI / 2], [1, 0, Math.PI / 2], [0, -1, Math.PI], [0, 1, 0]]) {
      const g = new THREE.CircleGeometry(1.35, 32);
      K.add(M.clock, place(g, { x: tx + dx * (tw / 2 + 0.03), y: ty + th / 2, z: tz + dz * (tw / 2 + 0.03), ry }), { shadow: false });
      K.add(M.trimDark, place(new THREE.TorusGeometry(1.38, 0.08, 6, 32), { x: tx + dx * (tw / 2 + 0.05), y: ty + th / 2, z: tz + dz * (tw / 2 + 0.05), ry }));
    }
    const dy = ty + th + 0.2;
    K.cyl(M.trimCream, tx, dy, tz, 1.9, 1.9, 1.4, 20);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      K.box(M.trimDark, tx + Math.cos(a) * 1.92, dy + 0.3, tz + Math.sin(a) * 1.92, 0.3, 0.8, 0.3, { ry: -a });
    }
    K.add(M.dome, place(new THREE.SphereGeometry(2.0, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), { x: tx, y: dy + 1.4, z: tz }));
    K.cyl(M.trimCream, tx, dy + 3.3, tz, 0.5, 0.5, 0.8, 12);
    K.add(M.copper, place(new THREE.ConeGeometry(0.6, 0.9, 12), { x: tx, y: dy + 4.55, z: tz }));
    K.cyl(M.blackIron, tx, dy + 5.0, tz, 0.04, 0.04, 3.0, 6);
    // the flag: stripes and a blue canton (a plain one, nobody's)
    const fy = dy + 7.2;
    for (let i = 0; i < 7; i++) K.box(i % 2 ? M.flagWhite : M.flagRed, tx + 1.0, fy - i * 0.16, tz, 1.9, 0.16, 0.01, {}, { shadow: false });
    K.box(M.flagBlue, tx + 0.45, fy - 0.48, tz + 0.006, 0.8, 0.64, 0.01, {}, { shadow: false });
  }
  // inside: the partition, the sheriff's office (west), the jail (east)
  const px = 49.0;
  wall(K, M, { axis: "z", at: px, a: C.z0 + T, b: C.z1 - T, y: 0, h: C.h1, mat: M.brickPale, lining: M.damaskGreen, out: 1, trim: M.trimDark, sill: FLOOR,
    holes: [{ c: 0, w: 1.4, spans: [[0, 2.6]] }] });
  // dark wainscot round the office, a picture rail above it
  for (const [x, z, w, d] of [[C.x0 + T + 0.03, 0, 0.06, C.z1 - C.z0 - 2 * T], [px - T / 2 - 0.04, 0, 0.06, C.z1 - C.z0 - 2 * T],
    [(C.x0 + px) / 2, C.z0 + T + 0.03, px - C.x0 - T, 0.06], [(C.x0 + px) / 2, C.z1 - T - 0.03, px - C.x0 - T, 0.06]]) {
    K.box(M.furniture, x, FLOOR, z, w, 1.1, d);
    K.box(M.trimDark, x, FLOOR + 1.1, z, w + 0.04, 0.08, d + 0.04);
    K.box(M.trimDark, x, 3.6, z, w + 0.02, 0.06, d + 0.02);
  }
  K.box(M.rug, 45.6, FLOOR + 0.005, 0, 3.6, 0.01, 2.4, {}, { shadow: false });
  chandelier(K, M, 45.6, C.h1 - 1.2, 0, { r: 0.7 });
  wallPic(K, M.paintPortrait, { x: C.x0 + T, y: 2.6, z: -3.2, w: 1.0, h: 1.3, o: 1, axis: "z", frame: M.trimGold });
  wallPic(K, sign("IN GRIN WE TRUST", "", { bg: "#2a3a2a", fg: "#e8d8a8", edge: "#e8d8a8", w: 1024, h: 180 }), { x: px - T / 2 - 0.08, y: 3.4, z: 0, w: 2.8, h: 0.5, o: -1, axis: "z" });
  // the sheriff's desk, his chair, the wanted board, a gun rack, a stove
  K.solid(47.4, -6.2, 1.8, 0.9, 0.8, { y: Y, pen: 2, mat: M.furniture });
  chair(K, M, 47.4, Y, -7.1, { ry: Math.PI });
  K.box(M.brass, 47.8, Y + 0.8, -6.1, 0.18, 0.06, 0.18);   // the badge, set down
  // the general's nameplate, facing whoever's been brought in
  K.box(M.furniture, 47.0, Y + 0.8, -5.82, 0.62, 0.11, 0.06, { rx: 0.35 });
  K.add(sign("THE GENERAL", "", { bg: "#c89a3a", fg: "#2a1a10", edge: "#2a1a10", w: 512, h: 96 }), place(new THREE.PlaneGeometry(0.58, 0.09), { x: 47.0, y: Y + 0.86, z: -5.785, rx: -0.35 }), { shadow: false });
  K.add(M.trollGold, place(new THREE.CircleGeometry(0.11, 5), { x: 47.8, y: Y + 0.87, z: -6.1, rx: -Math.PI / 2 }), { shadow: false });
  // the wanted board, between the corner and the side door
  K.box(M.furniture, 43.45, Y + 1.0, C.z0 + T + 0.03, 2.0, 1.6, 0.04);
  for (let i = 0; i < 3; i++) wallPic(K, M.wanted[i], { x: 42.85 + i * 0.6, y: Y + 1.8 + (i % 2) * 0.1, z: C.z0 + T + 0.05, w: 0.5, h: 0.74, o: 1 });
  rifleRack(K, M, { x: C.x0 + T, z: 6.6, axis: "z", o: 1, n: 5 });
  stove(K, M, 47.8, 7.6, { top: C.h1 });
  K.solid(42.65, -4.2, 0.6, 1.2, 1.4, { y: Y, pen: 4, mat: M.furniture });    // filing cabinet
  for (const z of [-3.4, 3.4]) {
    // benches for the waiting
    K.solid(47.9, z, 0.5, 2.0, 0.5, { y: Y, pen: 1, mat: M.furniture });
  }
  const l = new THREE.PointLight(0xffd8a0, 8, 14, 1.8);
  l.position.set(45.6, 4.4, 0);
  lights.push(l);
  // the jail: a corridor along the partition, three cells behind bars
  const cx0 = 51.2;
  for (const [z0, z1] of [[C.z0 + T, -3.4], [-3.4, 3.4], [3.4, C.z1 - T]]) {
    const zc = (z0 + z1) / 2;
    // bars across the front, the door standing open
    const door = { c: zc + 1.2, w: 1.0 };
    for (const [a, b] of runs(z0, z1, [[door.c - door.w / 2, door.c + door.w / 2]])) {
      K.add(M.bars, place(new THREE.PlaneGeometry(b - a, 2.8), { x: cx0, y: Y + 1.4, z: (a + b) / 2, ry: Math.PI / 2 }), { shadow: false });
      K.api.ghostBox(cx0, (a + b) / 2, 0.08, b - a, 2.8, { y: Y, pen: 0.3 });
    }
    K.add(M.bars, place(new THREE.PlaneGeometry(1.0, 2.8), { x: cx0 + 0.42, y: Y + 1.4, z: door.c + door.w / 2 + 0.25, ry: Math.PI / 2 + 1.1 }), { shadow: false });
    // the door shut (a fist fight refused, modes/social-duel.js): its bars
    // and its collider, both put away till then
    const shut = new THREE.Mesh(new THREE.PlaneGeometry(door.w, 2.8), M.bars);
    shut.position.set(cx0, Y + 1.4, door.c);
    shut.rotation.y = Math.PI / 2;
    shut.visible = false;
    K.root.add(shut);
    const c = K.api.ghostBox(cx0, door.c, 0.12, door.w, 2.8, { y: Y, pen: 0.3 });
    const closed = { min: c.min.clone(), max: c.max.clone() };
    const setShut = (on) => {
      shut.visible = on;
      c.min.copy(closed.min); c.max.copy(closed.max);
      if (!on) { c.min.y = -60; c.max.y = -59; }
    };
    setShut(false);
    JAIL.cells.push({ x: 53.9, z: door.c, y: Y, yaw: Math.PI / 2, setShut });
    K.box(M.blackIron, cx0, Y + 2.8, zc, 0.1, 0.1, z1 - z0);
    // a cot and a bucket
    K.solid(55.0, zc - 1.2, 0.9, 2.0, 0.5, { y: Y, pen: 1, mat: M.furniture });
    K.box(M.canvasCloth, 55.0, Y + 0.5, zc - 1.2, 0.85, 0.08, 1.95);
    K.cyl(M.steel, 53.0, Y, zc - 2.2, 0.16, 0.14, 0.3, 10);
    // and a trollface scratched on the wall
    K.add(M.trollPaint, place(new THREE.PlaneGeometry(0.7, 0.7), { x: C.x1 - T - 0.04, y: Y + 1.7, z: zc + 0.4, ry: -Math.PI / 2 }), { shadow: false });   // on the wallpaper, not behind it
  }
  for (const z of [-3.4, 3.4]) K.solid(53.5, z, 4.5, 0.25, C.h1 - Y, { y: Y, mat: M.brickPale });
  K.box(M.lampGlass, 50.2, C.h1 - 0.6, 0, 0.2, 0.3, 0.2, {}, { shadow: false });
}

/* ============================================================== the railway */

function buildRailway(K, M, lights, R) {
  const TRACKS = [-29.8, -35.0];
  for (const tz of TRACKS) {
    // ballast bed, ties, two rails, out past the edges of the map
    K.box(M.ballast, 0, 0, tz, 300, 0.14, 3.0, {}, { shadow: false });
    for (let x = -150; x <= 150; x += 0.62) K.box(M.tie, x, 0.12, tz, 0.24, 0.1, 2.5, { ry: (R() - 0.5) * 0.04 }, { shadow: false });
    for (const s of [-0.72, 0.72]) {
      K.box(M.rail_, 0, 0.22, tz + s, 300, 0.1, 0.07, {}, { shadow: false });
      K.box(M.rail_, 0, 0.22, tz + s, 300, 0.03, 0.14, {}, { shadow: false });
    }
  }
  // track 0 is also a loop round town (the Grin Express runs it in
  // Socialize, train.js): an arc each end, a straight across the south plain
  buildLoopTrack(K, M, R);
  // the platform behind the shops
  K.solid(-6, -26.3, 60, 2.6, FLOOR, { mat: M.deck, pen: 6 });
  K.box(M.trimDark, -6, 0, -27.6, 59.98, FLOOR + 0.02, 0.1);
  // the conductor's cap on its stand, at Choo's end of the platform: take it
  // and you're the conductor (modes/social-conductor.js); it's off the hook
  // while somebody wears it
  {
    const x = CONDUCTOR.stand.x, z = CONDUCTOR.stand.z;
    K.cyl(M.blackIron, x, FLOOR, z, 0.035, 0.045, 1.55, 8);
    K.cyl(M.blackIron, x, FLOOR, z, 0.2, 0.22, 0.05, 12);
    K.box(M.blackIron, x, FLOOR + 1.5, z - 0.07, 0.03, 0.03, 0.16);
    const navy = new THREE.MeshStandardMaterial({ color: 0x1c2a4a, roughness: 0.8 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xc89a3a, roughness: 0.4, metalness: 0.6 });
    const cap = new THREE.Group();
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.115, 0.1, 16), navy);
    crown.position.y = 0.05;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.117, 0.117, 0.03, 16), brass);
    band.position.y = 0.02;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.2), new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.5 }));
    visor.position.set(-0.13, 0.0, 0);
    cap.add(crown, band, visor);
    cap.position.set(x, FLOOR + 1.47, z - 0.15);
    cap.rotation.z = -0.25;   // hung on the hook by its back, tipped
    K.root.add(cap);
    CONDUCTOR.setCap = (on) => { cap.visible = on; CONDUCTOR.capOn = on; };
  }
  // the Grin Express (loco, tender, two open cars) standing at the platform,
  // the goods wagons on the siding
  TRAIN_STATE.train = buildTrain(K, M);
  boxcar(K, M, 30, TRACKS[1], M.boxcar, "KEK RAIL", "#8a3a2a");
  boxcar(K, M, -26.5, TRACKS[1], M.boxcarYellow, "TROLL & PACIFIC", "#b88a3a");
  flatcar(K, M, -15.6, TRACKS[1]);

  // the station, beyond the tracks
  {
    const x0 = -10, x1 = 4, z0 = -45, z1 = -38.6;
    // the platform stops at the wall's face (under the door sills it z-fought them)
    K.solid((x0 + x1) / 2, -37.85, x1 - x0 + 6, 1.5, FLOOR, { mat: M.deck, pen: 6 });
    K.box(M.trimDark, (x0 + x1) / 2, 0, -37.1, x1 - x0 + 5.98, FLOOR + 0.02, 0.1);
    K.solid((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0 - 2 * T, z1 - z0 - 2 * T, FLOOR, { mat: M.floor });
    room(K, M, {
      x0, x1, z0, z1, h: 3.8, mat: M.wallWhite, lining: M.planksIn, trim: M.trimDark, sill: FLOOR,
      mats: {},
      holes: {
        s: [{ c: -7.4, w: 1.1, spans: [[1.0, 2.8]] }, { c: -4.6, w: 1.3, spans: [[0, 2.6]] }, { c: -1.4, w: 1.1, spans: [[1.0, 2.8]] }, { c: 1.6, w: 1.3, spans: [[0, 2.6]] }],
        n: [{ c: -3, w: 1.3, spans: [[0, 2.6]] }],
        w: [{ c: -41.8, w: 1.0, spans: [[1.0, 2.8]] }],
        e: [{ c: -41.8, w: 1.2, spans: [[0, 2.5]] }],
      },
    });
    // a dark wainscot band, the hip roof (two gables and a ridge), the sign
    for (const [x, z, w, d] of [[(x0 + x1) / 2, z1 + 0.02, x1 - x0, 0.06], [(x0 + x1) / 2, z0 - 0.02, x1 - x0, 0.06], [x0 - 0.02, (z0 + z1) / 2, 0.06, z1 - z0], [x1 + 0.02, (z0 + z1) / 2, 0.06, z1 - z0]]) K.box(M.trimDark, x, 0, z, w, 1.0, d);
    K.solid((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, 0.2, { y: 3.8, mat: M.ceiling });
    gableRoof(K, M.roofDark, null, { x0: x0 - 0.2, x1: x1 + 0.2, z0, z1, y: 3.95, rise: 2.0, over: 1.6, ridge: M.trimDark });
    for (const gx of [x0, x1]) K.add(M.roofDark, place(prismGeo([[-(z1 - z0) / 2 - 1.6, 0], [(z1 - z0) / 2 + 1.6, 0], [0, 2.0]], 2.6), { x: gx + (gx === x0 ? 1.1 : -1.1), y: 3.95, z: (z0 + z1) / 2, ry: Math.PI / 2, sz: 1 }));
    signBoard(K, sign("TRAIN STATION", "", { bg: "#efe6d4", fg: "#2a2a2a", edge: "#2a2a2a", w: 1024, h: 200 }), M.trimDark, { x: -4.6, z: z1, y: 3.3, w: 3.2, h: 0.6, o: 1 });
    signBoard(K, sign("TROLL CITY", "Elev. 1337 ft · Pop. 420", { bg: "#efe6d4", fg: "#2a2a2a", edge: "#2a2a2a" }), M.trimDark, { x: 1.6, z: z1, y: 3.3, w: 2.6, h: 0.65, o: 1 });
    // inside: the ticket window, benches, a clock
    K.solid(-6.5, -42.6, 0.6, 3.6, 1.1, { y: FLOOR, pen: 3, mat: M.furniture });
    K.add(M.bars, place(new THREE.PlaneGeometry(3.4, 1.0), { x: -6.5, y: FLOOR + 1.7, z: -42.6, ry: Math.PI / 2 }), { shadow: false });
    for (const x of [-2.5, 0.5]) K.solid(x, -44.2, 2.0, 0.5, 0.48, { y: FLOOR, pen: 1, mat: M.furniture });
    K.add(M.clock, place(new THREE.CircleGeometry(0.35, 24), { x: -1.0, y: 3.0, z: z0 + T + 0.045 }), { shadow: false });   // in front of the wallpaper
    // benches on the platform, a luggage cart, a lamp post each end
    for (const x of [-8.4, 0.2]) {
      K.solid(x, -38.0, 1.8, 0.5, 0.5, { y: FLOOR, pen: 1, mat: M.furniture });
      K.box(M.furniture, x, FLOOR + 0.5, -38.2, 1.8, 0.45, 0.06);
    }
    crate(K, M, 6.0, -38.0, { y: FLOOR, s: 0.7 });
    K.api.ghostBox(-12.8, -38.0, 1.2, 0.7, 1.0, { y: FLOOR, pen: 1.5 });
    K.box(M.wagonBed, -12.8, FLOOR + 0.35, -38.0, 1.2, 0.08, 0.7);
    for (const s of [-0.5, 0.5]) wheel(K, M, -12.8 + s, FLOOR + 0.22, -37.6, { r: 0.22, spokes: 6 });
    K.box(M.canvasCloth, -12.8, FLOOR + 0.43, -38.0, 0.5, 0.35, 0.5);
    for (const x of [-12.2, 6.2]) streetLamp(K, M, x, -37.4, { y: FLOOR });
    // the flag on the roof, as in the reference
    K.cyl(M.blackIron, -3, 5.9, -41.8, 0.03, 0.03, 2.4, 6);
    for (let i = 0; i < 5; i++) K.box(i % 2 ? M.flagWhite : M.flagRed, -2.45, 8.2 - i * 0.14, -41.8, 1.1, 0.14, 0.01, {}, { shadow: false });
    K.box(M.flagBlue, -2.75, 8.1, -41.79, 0.5, 0.4, 0.01, {}, { shadow: false });
    const l = new THREE.PointLight(0xffd8a0, 5, 9, 1.8);
    l.position.set(-3, 3.2, -41.8);
    lights.push(l);
  }

  // the water tower, its tank wearing a painted trollface
  {
    const x = 12, z = -42.5, legH = 5.2, r = 2.2;
    for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) {
      K.solid(x + dx, z + dz, 0.34, 0.34, legH, { pen: 4, mat: M.post });
    }
    for (const [ax, at] of [["x", z - 1.5], ["x", z + 1.5], ["z", x - 1.5], ["z", x + 1.5]]) {
      for (const k of [1, -1]) {
        const len = Math.hypot(3, legH * 0.55);
        const ang = Math.atan2(legH * 0.55, 3) * k;
        K.box(M.post, ax === "x" ? x : at, legH * 0.22, ax === "x" ? at : z, ax === "x" ? len : 0.12, 0.14, ax === "x" ? 0.12 : len, ax === "x" ? { rz: ang } : { rx: -ang });
      }
    }
    K.solid(x, z, 4.6, 4.6, 0.25, { y: legH, pen: 6, mat: M.deck });
    railing(K, M, { axis: "x", at: z - 2.25, a: x - 2.3, b: x + 2.3, y: legH + 0.25 });
    K.cyl(M.tank, x, legH + 0.25, z, r, r, 3.6, 24);
    for (const hy of [0.9, 1.9, 2.9]) K.cyl(M.blackIron, x, legH + 0.25 + hy, z, r + 0.03, r + 0.03, 0.08, 24);
    K.add(M.roofShingle, place(new THREE.ConeGeometry(r + 0.35, 1.6, 24), { x, y: legH + 3.85 + 0.8, z }));
    // the face, wrapped round the side toward town
    {
      const g = new THREE.CylinderGeometry(r + 0.04, r + 0.04, 2.6, 24, 1, true, -0.8, 1.6);
      K.add(M.trollPaint, place(g, { x, y: legH + 0.25 + 1.8, z, ry: 0 }), { shadow: false });
    }
    // the spout swung out over the track
    K.cyl(M.blackIron, x - 1.0, legH + 0.6, z + 2.0, 0.18, 0.18, 0.4, 10);
    K.add(M.blackIron, place(new THREE.CylinderGeometry(0.14, 0.14, 2.8, 10), { x: x - 1.0, y: legH + 0.3, z: z + 3.1, rx: 1.25 }));
  }

  // the freight shed: a roof on posts over a loading dock, stacked freight
  {
    const x0 = -36, x1 = -20, z0 = -46, z1 = -39;
    K.solid((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, 1.0, { mat: M.deck, pen: 8 });
    K.box(M.trimDark, (x0 + x1) / 2, 0, z1 + 0.02, x1 - x0 - 0.02, 1.02, 0.08);
    api_stairs(K, -22, z1 + 1.2, 2.0, 3, 1.0 / 3, 0.4, "-z", 0);
    for (let i = 0; i < 3; i++) K.box(M.deck, -22, 0, z1 + 0.4 * (i + 0.5), 2.0, (1.0 / 3) * (3 - i), 0.4);
    for (let x = x0 + 0.3; x <= x1 - 0.2; x += (x1 - x0 - 0.6) / 4) {
      for (const z of [z0 + 0.3, z1 - 0.3]) K.solid(x, z, 0.25, 0.25, 3.0, { y: 1.0, pen: 3, mat: M.post });
    }
    gableRoof(K, M.roofTin, M.wallRed, { x0, x1, z0, z1, y: 4.0, rise: 1.4, over: 0.5, ridge: M.trimDark });
    K.box(M.post, (x0 + x1) / 2, 3.9, z0 + 0.3, x1 - x0, 0.2, 0.2);
    K.box(M.post, (x0 + x1) / 2, 3.9, z1 - 0.3, x1 - x0, 0.2, 0.2);
    // the back wall boards, a sign
    K.solid((x0 + x1) / 2, z0 + 0.15, x1 - x0 - 0.02, 0.3, 3.02, { y: 1.0, mat: M.wallRed });   // over the posts' tops and ends, not flush with them
    signBoard(K, sign("FREIGHT", "", { bg: "#efe6d4", fg: "#5a1a12", edge: "#5a1a12", w: 1024, h: 200 }), M.trimDark, { x: (x0 + x1) / 2, z: z1 - 0.12, y: 3.5, w: 3.2, h: 0.6, o: 1 });   // in front of the posts
    for (const [x, z, ry] of [[-34, -43.5, 0.1], [-30.5, -44.6, -0.2], [-25.2, -42.8, 0.3]]) {
      crate(K, M, x, z, { y: 1.0, s: 0.95, ry });
      crate(K, M, x + 1.0, z, { y: 1.0, s: 0.85, ry: ry + 0.1 });
      crate(K, M, x + 0.05, z, { y: 1.95, s: 0.75, ry: ry - 0.2, collide: false });
    }
    for (const [x, z] of [[-27.8, -44.8], [-27.0, -44.9], [-32.2, -41.0]]) barrel(K, M, x, z, { y: 1.0 });
  }

  // the lumber yard: log piles, plank stacks, a saw shed
  {
    const x0 = 22, x1 = 46, z0 = -48.5, z1 = -39.5;
    railFence(K, M, { axis: "x", at: z1, a: x0, b: x1, gaps: [[29, 33], [40, 43]] });
    railFence(K, M, { axis: "z", at: x1, a: z0, b: z1 });
    for (const [x, z, n] of [[26, -43.5, 3], [26, -46.5, 2], [36.5, -46.5, 3]]) {
      // a pyramid of logs
      let k = 0;
      for (let row = 0; row < n; row++) {
        for (let i = 0; i < n - row; i++) {
          log(K, M, x, row * 0.38, z + (i - (n - row - 1) / 2) * 0.46, { r: 0.22, len: 5.0, ry: 0 });
          k++;
        }
      }
      K.api.ghostBox(x, z, 5.0, n * 0.46, n * 0.38 + 0.1, { pen: 10 });
      for (const s of [-1.8, 1.8]) K.box(M.post, x + s, 0, z + (n * 0.46) / 2 + 0.1, 0.14, n * 0.38 + 0.2, 0.14);
    }
    // stacks of sawn planks, stickered
    for (const [x, z] of [[31, -43.6], [41.5, -43.6]]) {
      K.solid(x, z, 3.6, 1.3, 1.3, { pen: 8 });
      for (let i = 0; i < 7; i++) {
        K.box(M.crate, x, i * 0.185, z, 3.6, 0.14, 1.3);
        for (const s of [-1.4, 0, 1.4]) K.box(M.post, x + s, i * 0.185 + 0.14, z, 0.06, 0.045, 1.3, {}, { shadow: false });
      }
    }
    // the saw shed: a roof on posts over the saw bench
    {
      const sx0 = 36, sx1 = 45, sz0 = -42.6, sz1 = -40.4;
      for (const x of [sx0, (sx0 + sx1) / 2, sx1]) for (const z of [sz0, sz1]) K.solid(x, z, 0.22, 0.22, 3.2, { pen: 3, mat: M.post });
      K.box(M.roofTin, (sx0 + sx1) / 2, 3.2, (sz0 + sz1) / 2, sx1 - sx0 + 0.8, 0.1, sz1 - sz0 + 1.2, { rx: 0.1 });
      K.solid(40.5, -41.5, 4.0, 0.9, 0.85, { pen: 4, mat: M.furniture });
      K.add(M.steel, place(new THREE.CylinderGeometry(0.5, 0.5, 0.03, 24), { x: 40.5, y: 0.85, z: -41.5, rx: Math.PI / 2 }));
      log(K, M, 40.5, 0.85, -41.5, { r: 0.2, len: 3.0 });
    }
    signBoard(K, sign("GRIN LUMBER CO.", "", { bg: "#efe6d4", fg: "#3a2a1a", edge: "#3a2a1a", w: 1024, h: 200 }), M.trimDark, { x: 36.5, z: z1 + 0.1, y: 2.1, w: 3.4, h: 0.65, o: 1 });
    for (const x of [33.6, 39.4]) K.solid(x, z1 + 0.1, 0.2, 0.2, 2.6, { pen: 3, mat: M.post });
  }
}

/* A 4-4-0 steam locomotive and its tender, standing on the track at `x`,
   cowcatcher west. Collides as boxes; the cab is open, you can stand in it. */
function locomotive(K, M, x, tz) {
  const y0 = 0.25;
  // frame and running gear
  K.solid(x, tz, 9.0, 1.6, 0.9, { y: y0, pen: 12, mat: M.loco });
  K.api.ghostBox(x, tz, 9.0, 1.6, y0, { pen: 12 });   // the wheels, down to the rails
  for (const [wx, r] of [[-3.0, 0.42], [-1.9, 0.42], [0.6, 0.85], [2.6, 0.85]]) {
    for (const s of [-0.85, 0.85]) {
      wheel(K, M, x + wx, y0 + r, tz + s, { r, spokes: r > 0.6 ? 14 : 8 });
    }
  }
  for (const s of [-0.95, 0.95]) K.box(M.steel, x + 1.6, y0 + 0.75, tz + s, 2.4, 0.08, 0.06);   // side rods
  // boiler, smokebox, the funnel stack, dome and bell
  K.add(M.loco, place(new THREE.CylinderGeometry(0.85, 0.85, 5.4, 20), { x: x - 1.1, y: y0 + 1.95, z: tz, rz: Math.PI / 2 }));
  K.api.ghostBox(x - 1.1, tz, 5.4, 1.7, 2.0, { y: y0 + 0.9, pen: 12 });
  for (const bx of [-2.6, -0.6, 1.2]) K.add(M.locoBrass, place(new THREE.CylinderGeometry(0.87, 0.87, 0.08, 20), { x: x + bx, y: y0 + 1.95, z: tz, rz: Math.PI / 2 }));
  K.add(M.loco, place(new THREE.CylinderGeometry(0.9, 0.9, 0.3, 20), { x: x - 3.95, y: y0 + 1.95, z: tz, rz: Math.PI / 2 }));
  // the smokebox door: the trollface in brass
  K.add(M.trollGold, place(new THREE.CircleGeometry(0.75, 24), { x: x - 4.11, y: y0 + 1.95, z: tz, ry: -Math.PI / 2 }), { shadow: false });
  K.add(M.locoBrass, place(new THREE.SphereGeometry(0.2, 10, 8), { x: x - 4.12, y: y0 + 2.95, z: tz }));   // headlamp
  K.box(M.locoRed, x - 4.0, y0 + 2.75, tz, 0.5, 0.45, 0.5);
  K.box(M.lampGlass, x - 4.26, y0 + 2.8, tz, 0.02, 0.32, 0.32, {}, { shadow: false });
  K.cyl(M.loco, x - 3.3, y0 + 2.6, tz, 0.26, 0.45, 1.3, 14);
  K.cyl(M.loco, x - 3.3, y0 + 3.85, tz, 0.55, 0.3, 0.55, 14);   // the funnel's flare
  K.cyl(M.locoBrass, x - 1.2, y0 + 2.7, tz, 0.35, 0.3, 0.55, 14);
  K.add(M.locoBrass, place(new THREE.SphereGeometry(0.3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), { x: x - 1.2, y: y0 + 3.25, z: tz }));
  K.cyl(M.locoBrass, x - 2.2, y0 + 2.7, tz, 0.18, 0.12, 0.35, 10);
  // cowcatcher: slats raked forward
  for (let i = -3; i <= 3; i++) K.box(M.locoRed, x - 4.8, y0 - 0.1, tz + i * 0.22, 1.1, 0.06, 0.05, { rz: 0.6, ry: i * 0.08 });
  // the cab: walls, windows, a roof, the open back
  {
    const cx = x + 3.3;
    K.solid(cx, tz - 0.85, 2.2, 0.12, 2.0, { y: y0 + 1.1, pen: 6, mat: M.locoRed });
    K.solid(cx, tz + 0.85, 2.2, 0.12, 2.0, { y: y0 + 1.1, pen: 6, mat: M.locoRed });
    K.solid(cx - 1.05, tz, 0.12, 1.7, 2.0, { y: y0 + 1.1, pen: 8, mat: M.locoRed });
    K.box(M.loco, cx, y0 + 3.1, tz, 2.6, 0.12, 2.1);
    for (const s of [-0.86, 0.86]) K.box(M.glass, cx - 0.2, y0 + 2.2, tz + s * 1.005, 0.8, 0.6, 0.02, {}, { shadow: false });
    signBoard(K, sign("GRIN EXPRESS", "No. 69", { bg: "#9a1e1e", fg: "#f0d080", edge: "#f0d080", w: 512, h: 160 }), M.locoBrass, { x: cx, z: tz + 0.91, y: y0 + 1.6, w: 1.6, h: 0.5, o: 1 });
    signBoard(K, sign("GRIN EXPRESS", "No. 69", { bg: "#9a1e1e", fg: "#f0d080", edge: "#f0d080", w: 512, h: 160 }), M.locoBrass, { x: cx, z: tz - 0.91, y: y0 + 1.6, w: 1.6, h: 0.5, o: -1 });
  }
  // the tender: coal heaped in a box
  {
    const tx = x + 6.6;
    K.solid(tx, tz, 3.6, 1.8, 1.9, { y: y0 + 0.5, pen: 12, mat: M.loco });
    K.api.ghostBox(tx, tz, 3.6, 1.8, y0 + 0.5, { pen: 12 });
    for (const wx of [-1.1, 1.1]) for (const s of [-0.85, 0.85]) wheel(K, M, tx + wx, y0 + 0.4, tz + s, { r: 0.4, spokes: 8 });
    K.add(M.stove, place(new THREE.SphereGeometry(0.9, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), { x: tx - 0.4, y: y0 + 2.35, z: tz, sx: 1.6, sy: 0.4, sz: 0.9 }));
    K.box(M.locoBrass, tx, y0 + 2.35, tz, 3.62, 0.08, 1.82);
  }
}

/* The loop track (train.js LoopPath): the north straight is the station's
   track 0, already laid; these are the two end arcs and the south straight. */
const LOOP = { x0: -90, x1: 90, z0: -29.8, z1: 59.8 };
function buildLoopTrack(K, M, R) {
  const path = new LoopPath(LOOP);
  // the south straight
  K.box(M.ballast, 0, 0, LOOP.z1, LOOP.x1 - LOOP.x0, 0.14, 3.0, {}, { shadow: false });
  for (let x = LOOP.x0; x <= LOOP.x1; x += 0.62) K.box(M.tie, x, 0.12, LOOP.z1, 0.24, 0.1, 2.5, { ry: (R() - 0.5) * 0.04 }, { shadow: false });
  for (const s of [-0.72, 0.72]) {
    K.box(M.rail_, 0, 0.22, LOOP.z1 + s, LOOP.x1 - LOOP.x0, 0.1, 0.07, {}, { shadow: false });
    K.box(M.rail_, 0, 0.22, LOOP.z1 + s, LOOP.x1 - LOOP.x0, 0.03, 0.14, {}, { shadow: false });
  }
  // the arcs, in short straight pieces
  const p = { x: 0, z: 0, dx: 0, dz: 0 };
  for (const from of [path.ls, 2 * path.ls + path.la]) {
    for (let s = 0; s < path.la; s += 0.62) {
      path.at(from + s, p);
      const ry = Math.atan2(-p.dz, p.dx);   // a box's long x along the way
      const nx = -p.dz, nz = p.dx;          // across it
      if (Math.round(s / 0.62) % 3 === 0) K.box(M.ballast, p.x, 0, p.z, 2.0, 0.14, 3.0, { ry }, { shadow: false });
      K.box(M.tie, p.x, 0.12, p.z, 0.24, 0.1, 2.5, { ry: ry + (R() - 0.5) * 0.04 }, { shadow: false });
      for (const o of [-0.72, 0.72]) K.box(M.rail_, p.x + nx * o, 0.22, p.z + nz * o, 0.66, 0.1, 0.07, { ry }, { shadow: false });
    }
  }
}

/* The Grin Express: its loco and tender, two open passenger cars, each its
   own group with its own colliders, so train.js can run it round the loop. */
const TRAIN_STATE = { train: null };
/* The conductor's job (modes/social-conductor.js): the cap's stand on the
   platform behind the shops, and the platforms you can hold the train from
   (that one and the station's, across the tracks). */
const CONDUCTOR = {
  stand: { x: -21.6, z: -25.35, floor: FLOOR },
  platforms: [{ x0: -36, x1: 24, z0: -27.6, z1: -25.0 }, { x0: -13, x1: 7, z0: -38.6, z1: -37.1 }],
  setCap: () => {}, capOn: true,
};
function buildTrain(K, M) {
  const car = (build, len, back, decks) => {
    const group = new THREE.Group();
    K.root.add(group);
    const boxes = [];
    const api = {
      ghostBox: (x, z, w, d, h, { y = 0, pen = 0.9 } = {}) => boxes.push({ c: K.api.ghostBox(x, z, w, d, h, { y, pen }), x, z, w, d, y, h }),
    };
    const kit = new Kit(api, group);
    build(kit);
    kit.flush();
    return { group, boxes, len, back, decks };
  };
  const cars = [
    // the cab floor is the loco's deck
    car((k) => locomotive(k, M, 0, 0), 9.0, 0, [{ x0: 2.3, x1: 4.35, z0: -0.75, z1: 0.75, y: 1.15 }]),
    car((k) => passengerCar(k, M), 9.0, 13.5, [{ x0: -4.4, x1: 4.4, z0: -1.25, z1: 1.25, y: 0.9 }]),
    car((k) => passengerCar(k, M), 9.0, 23.1, [{ x0: -4.4, x1: 4.4, z0: -1.25, z1: 1.25, y: 0.9 }]),
  ];
  // standing with the loco at x -12, the cars along the platform
  return new Train(new LoopPath(LOOP), cars, { station: LOOP.x1 + 12 });
}

/* An open passenger car (local, nose to -x): a deck at 0.9 m with a running
   board each side to step up from the platform, waist rails with a gap in
   the middle of each side, benches at the ends, a tin roof on posts. */
function passengerCar(K, M) {
  const y0 = 0.25, L = 9.0, W = 2.6, top = 0.9;
  K.box(M.loco, 0, y0 + 0.2, 0, L - 0.6, 0.3, W - 0.5);
  for (const bx of [-2.9, -2.1, 2.1, 2.9]) for (const s of [-0.85, 0.85]) wheel(K, M, bx, y0 + 0.4, s, { r: 0.4, spokes: 8 });
  K.solid(0, 0, L, W, 0.15, { y: top - 0.15, pen: 8, mat: M.deck });
  K.api.ghostBox(0, 0, L, W - 0.4, top - 0.15, { pen: 8 });
  K.box(M.locoRed, 0, top - 0.42, 0, L, 0.27, W + 0.02);
  for (const s of [-1, 1]) {
    // the running board: a step half way up
    K.api.ghostBox(0, s * (W / 2 + 0.2), L - 1.0, 0.4, 0.6, { pen: 2 });
    K.box(M.trimDark, 0, 0.52, s * (W / 2 + 0.2), L - 1.0, 0.08, 0.4);
    // waist rails either side of the gap, and the posts that hold the roof
    for (const c of [-2.65, 2.65]) {
      K.api.ghostBox(c, s * (W / 2 - 0.05), 3.7, 0.1, 1.0, { y: top, pen: 2 });
      K.box(M.locoBrass, c, top + 0.9, s * (W / 2 - 0.05), 3.7, 0.06, 0.06);
      K.box(M.locoRed, c, top, s * (W / 2 - 0.05), 3.7, 0.45, 0.05);
    }
    for (const px of [-4.35, -0.85, 0.85, 4.35]) K.box(M.post, px, top, s * (W / 2 - 0.05), 0.1, 2.1, 0.1);
  }
  for (const e of [-1, 1]) {
    K.api.ghostBox(e * (L / 2 - 0.05), 0, 0.1, W, 1.0, { y: top, pen: 2 });
    K.box(M.locoRed, e * (L / 2 - 0.05), top, 0, 0.06, 1.0, W);
    // a bench at each end, facing in
    K.solid(e * 3.75, 0, 0.5, W - 0.5, 0.45, { y: top, pen: 2, mat: M.furniture });
    K.box(M.furniture, e * 4.05, top + 0.45, 0, 0.08, 0.5, W - 0.5);
  }
  K.box(M.roofTin, 0, top + 2.1, 0, L + 0.3, 0.1, W + 0.3);
  for (const e of [-1, 1]) K.box(M.blackIron, e * (L / 2 + 0.25), y0 + 0.45, 0, 0.4, 0.2, 0.3);
}

/* A boxcar: plank body, a sliding door half open, a catwalk on the roof. */
function boxcar(K, M, x, tz, mat, name, bg) {
  const y0 = 0.25, L = 8.0, W = 2.4, H = 2.6;
  K.solid(x, tz, L, W, H, { y: y0 + 0.9, pen: 6, mat });
  K.api.ghostBox(x, tz, L, W - 0.3, y0 + 0.9, { pen: 6 });
  K.box(M.loco, x, y0 + 0.55, tz, L, 0.35, W - 0.2);
  for (const bx of [-2.8, -2.0, 2.0, 2.8]) for (const s of [-0.85, 0.85]) wheel(K, M, x + bx, y0 + 0.4, tz + s, { r: 0.4, spokes: 8 });
  K.box(M.roofTin, x, y0 + 0.9 + H, tz, L + 0.2, 0.12, W + 0.2);
  K.box(M.post, x, y0 + 1.02 + H, tz, L, 0.06, 0.5);
  for (const s of [-1, 1]) {
    K.box(M.trimDark, x - 1.0, y0 + 0.95, tz + s * (W / 2 + 0.02), 2.0, H - 0.1, 0.05);
    K.box(M.iron, x - 0.6, y0 + 0.95 + H - 0.12, tz + s * (W / 2 + 0.05), 3.0, 0.08, 0.05);
    signBoard(K, sign(name, "", { bg, fg: "#f2ead6", edge: bg, shade: "rgba(0,0,0,.3)", w: 1024, h: 180 }), mat, { x: x + 2.0, z: tz + s * (W / 2), y: y0 + 2.6, w: 3.0, h: 0.55, o: s });
  }
  for (const s of [-1, 1]) K.box(M.blackIron, x + s * (L / 2 + 0.25), y0 + 0.6, tz, 0.4, 0.2, 0.3);
}

/* A flatcar carrying logs. */
function flatcar(K, M, x, tz) {
  const y0 = 0.25, L = 8.0, W = 2.4;
  K.solid(x, tz, L, W, 0.35, { y: y0 + 0.75, pen: 8, mat: M.wagonBed });
  K.api.ghostBox(x, tz, L, W - 0.3, y0 + 0.75, { pen: 8 });
  for (const bx of [-2.8, -2.0, 2.0, 2.8]) for (const s of [-0.85, 0.85]) wheel(K, M, x + bx, y0 + 0.4, tz + s, { r: 0.4, spokes: 8 });
  for (const s of [-1.15, 1.15]) for (const bx of [-3.5, 0, 3.5]) K.box(M.post, x + bx, y0 + 1.1, tz + s, 0.12, 1.3, 0.12);
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 4 - row; i++) log(K, M, x, y0 + 1.1 + row * 0.42, tz + (i - (3 - row) / 2) * 0.5, { r: 0.24, len: 7.6 });
  }
  K.api.ghostBox(x, tz, L, W, 1.3, { y: y0 + 1.1, pen: 10 });
}

/* ============================================================ the south side */

function buildSouth(K, M, lights, R) {
  // the livery stable: barn-red, a gable roof along x, big doors both ends,
  // stalls down both sides of the aisle
  {
    const x0 = -12, x1 = 6, z0 = 28, z1 = 40;
    K.solid((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0 - 2 * T, z1 - z0 - 2 * T, 0.05, { mat: M.dirtPath });
    room(K, M, {
      x0, x1, z0, z1, h: 4.4, mat: M.wallRed, lining: M.wallBare, trim: M.trimCream,
      holes: {
        w: [{ c: 34, w: 3.4, spans: [[0, 3.4]] }],
        e: [{ c: 34, w: 3.4, spans: [[0, 3.4]] }],
        n: [{ c: -7, w: 1.3, spans: [[0, 2.6]] }, { c: -1.5, w: 0.9, spans: [[2.0, 3.0]] }, { c: 2.6, w: 0.9, spans: [[2.0, 3.0]] }],
        s: [{ c: -3, w: 1.3, spans: [[0, 2.6]] }, { c: -8.5, w: 0.9, spans: [[2.0, 3.0]] }, { c: 2.0, w: 0.9, spans: [[2.0, 3.0]] }],
      },
    });
    gableRoof(K, M.roofShingle, M.wallRed, { x0, x1, z0, z1, y: 4.4, rise: 3.0, over: 0.5, ridge: M.trimDark });
    // the big doors' white X-braced leaves, swung open
    for (const [x, o] of [[x0, -1], [x1, 1]]) {
      for (const s of [-1, 1]) {
        const lz = 34 + s * 2.6, lx = x + o * 0.12;
        K.box(M.wallRed, lx, 0.05, lz, 0.08, 3.3, 1.7);
        K.box(M.trimCream, lx + o * 0.05, 0.05, lz, 0.04, 3.3, 0.12);
        K.box(M.trimCream, lx + o * 0.05, 1.65, lz, 0.04, 0.12, 1.7);
        K.box(M.trimCream, lx + o * 0.05, 0.1, lz, 0.04, 0.12, 2.2, { rx: s * 1.1 });
      }
      signBoard(K, sign("LIVERY & FEED", "Horses boarded · No trolls on the hay", { bg: "#efe6d4", fg: "#5a1a12", edge: "#5a1a12" }), M.trimDark, { x: x + o * 0.16, z: 34, y: 4.08, w: 3.6, h: 0.8, o, axis: "z" });   // clear of the door's head trim
    }
    // stalls: half-height partitions, a horse in some
    for (const [zw, zo] of [[z0 + T, 1], [z1 - T, -1]]) {
      const front = zw + zo * 3.2;
      for (let i = 0; i <= 4; i++) {
        const x = x0 + 3.0 + i * 3.1;
        if (x > x1 - 1.5) break;
        K.solid(x, (zw + front) / 2, 0.12, Math.abs(front - zw), 1.5, { pen: 1.5, mat: M.wallBare });
        K.box(M.post, x, 0, front, 0.2, 2.4, 0.2);
      }
      for (let i = 0; i < 5; i++) {
        const sx = x0 + 1.45 + i * 3.1;
        if (sx > x1 - 1.4) break;
        if ((i + (zo > 0 ? 0 : 1)) % 2 === 0) horse(K, M, sx, zw + zo * 1.7, { ry: zo > 0 ? Math.PI / 2 : -Math.PI / 2, coat: ["bay", "white", "black", "dun", "paint"][(i * 3 + (zo > 0 ? 0 : 2)) % 5] });
        else hayBale(K, M, sx, zw + zo * 0.7, { ry: 0 });
        K.box(M.weathered, sx, 0.5, zw + zo * 0.25, 1.0, 0.4, 0.4);       // the manger
      }
    }
    // a hayloft overhead at the east end (looks only)
    K.box(M.floor, x1 - 3.0, 3.2, (z0 + z1) / 2, 5.4, 0.15, z1 - z0 - 1.0);
    for (let i = 0; i < 4; i++) hayBale(K, M, x1 - 4.6 + (i % 2) * 1.3, 33 + Math.floor(i / 2) * 1.2, { y: 3.35, collide: false });
    for (const [x, z] of [[-12.7, 29.0], [6.7, 39.0]]) barrel(K, M, x, z, {});
    K.box(M.leather, x0 + T + 0.08, 1.3, 33, 0.16, 0.3, 0.6);       // a saddle on a peg
    const l = new THREE.PointLight(0xffd8a0, 5, 11, 1.8);
    l.position.set(-3, 3.6, 34);
    lights.push(l);
  }
  // the corral: rails round it, horses, a trough and a hay rick
  railFence(K, M, { axis: "x", at: 28, a: 8, b: 24, gaps: [[14, 17]] });
  railFence(K, M, { axis: "x", at: 42, a: 8, b: 24 });
  railFence(K, M, { axis: "z", at: 8, a: 28, b: 42, gaps: [[32.3, 35.7]] });
  railFence(K, M, { axis: "z", at: 24, a: 28, b: 42 });
  horse(K, M, 13, 36.5, { ry: 0.6, coat: "paint", graze: true });
  horse(K, M, 19.5, 33.0, { ry: 2.6, coat: "dun", saddle: true });
  horse(K, M, 20.5, 39.0, { ry: -0.4, coat: "white" });
  trough(K, M, 16, 30.2, { ry: 0, len: 2.4 });
  for (const [x, z] of [[11, 40.6], [12.3, 40.6]]) hayBale(K, M, x, z);
  hayBale(K, M, 11.6, 40.6, { y: 0.6, collide: false, ry: 0.2 });

  // frontier houses: one storey, a porch, a stovepipe, picket fences
  const HOUSES = [
    { x0: -50, x1: -42, z0: 30, z1: 37, wall: M.wallWhite, roof: M.roofShingle },
    { x0: -37, x1: -29, z0: 32, z1: 39, wall: M.wallMustard, roof: M.roofDark },
    { x0: 28, x1: 36, z0: 30, z1: 37, wall: M.wallBlue, roof: M.roofShingle },
    { x0: 40, x1: 48, z0: 31, z1: 38, wall: M.wallGreen, roof: M.roofDark },
  ];
  HOUSES.forEach((h, i) => {
    const cx = (h.x0 + h.x1) / 2;
    K.solid(cx, (h.z0 + h.z1) / 2, h.x1 - h.x0 - 2 * T, h.z1 - h.z0 - 2 * T, FLOOR, { mat: M.floor });
    room(K, M, {
      x0: h.x0, x1: h.x1, z0: h.z0, z1: h.z1, h: 3.2, mat: h.wall, lining: M.damaskRose, trim: M.trimDark, sill: FLOOR,
      holes: {
        n: [{ c: cx - 2.2, w: 1.1, spans: [[1.0, 2.5]] }, { c: cx + 0.6, w: 1.2, spans: [[0, 2.4]] }, { c: cx + 2.6, w: 1.1, spans: [[1.0, 2.5]] }],
        s: [{ c: cx - 1.6, w: 1.2, spans: [[0, 2.4]] }, { c: cx + 2.0, w: 1.1, spans: [[1.0, 2.5]] }],
        w: [{ c: (h.z0 + h.z1) / 2, w: 1.1, spans: [[1.0, 2.5]] }],
        e: [{ c: (h.z0 + h.z1) / 2, w: 1.1, spans: [[1.0, 2.5]] }],
      },
    });
    K.solid(cx, (h.z0 + h.z1) / 2, h.x1 - h.x0, h.z1 - h.z0, 0.2, { y: 3.2, mat: M.ceiling });
    gableRoof(K, h.roof, h.wall, { x0: h.x0, x1: h.x1, z0: h.z0, z1: h.z1, y: 3.3, rise: 1.8, over: 0.45, ridge: M.trimDark });
    // the porch on the north (town) side
    K.solid(cx, h.z0 - 1.1, h.x1 - h.x0, 2.2, FLOOR, { mat: M.deck, pen: 6 });
    K.box(M.roofTin, cx, 2.85, h.z0 - 1.05, h.x1 - h.x0 + 0.2, 0.08, 2.4, { rx: 0.15 });
    for (const x of [h.x0 + 0.2, cx, h.x1 - 0.2]) K.solid(x, h.z0 - 2.0, 0.16, 0.16, 2.6, { y: FLOOR, pen: 3, mat: M.post });
    railing(K, M, { axis: "x", at: h.z0 - 2.1, a: h.x0 + 0.3, b: cx - 0.8, y: FLOOR });
    K.cyl(M.stove, h.x1 - 1.5, 3.6, (h.z0 + h.z1) / 2 + 1.5, 0.12, 0.12, 2.2, 8);
    // inside: a table and chairs, a bed, the stove
    tableSet(K, M, cx - 1.4, FLOOR, (h.z0 + h.z1) / 2, { seed: 30 + i, chairs: 3, r: 0.45 });
    K.solid(h.x1 - 1.3, h.z1 - 1.4, 1.6, 2.0, 0.55, { y: FLOOR, pen: 1, mat: M.furniture });
    K.box(M.canvasCloth, h.x1 - 1.3, FLOOR + 0.55, h.z1 - 1.4, 1.5, 0.12, 1.9);
    K.box(M.blanket, h.x1 - 1.3, FLOOR + 0.67, h.z1 - 1.1, 1.52, 0.04, 1.2);
    stove(K, M, h.x1 - 1.5, (h.z0 + h.z1) / 2 + 1.5, { top: 3.2 });
    wallPic(K, i % 2 ? M.paintPortrait : M.paintDesert, { x: h.x0 + T, y: 2.0, z: (h.z0 + h.z1) / 2 - 1.6, w: 0.9, h: 0.7, o: 1, axis: "z", frame: M.trimGold });
    // the picket fence round the front yard
    picketFence(K, M, { axis: "x", at: h.z0 - 4.6, a: h.x0 - 1, b: h.x1 + 1, gaps: [[cx - 0.3, cx + 1.5]] });
    picketFence(K, M, { axis: "z", at: h.x0 - 1, a: h.z0 - 4.6, b: h.z0 - 0.5 });
    picketFence(K, M, { axis: "z", at: h.x1 + 1, a: h.z0 - 4.6, b: h.z0 - 0.5 });
  });
  // a windmill pump between the houses
  windmill(K, M, -40, 43.5);

  // Boot Hill: crooked wooden crosses on a rise, a few stones
  {
    const x0 = 48, x1 = 60, z0 = 40, z1 = 49;
    flat(K, M.grassDry, (x0 + x1) / 2, (z0 + z1) / 2, x1 - x0 + 3, z1 - z0 + 3, { y: 0.026 });
    railFence(K, M, { axis: "x", at: z0 - 0.4, a: x0 - 1, b: x1, gaps: [[52.6, 55]] });
    signBoard(K, sign("BOOT HILL", "Here lie the ones who got mad", { bg: "#d8c8a8", fg: "#2a1a10", edge: "#2a1a10", w: 1024, h: 220 }), M.trimDark, { x: 53.8, z: z0 - 0.4, y: 2.5, w: 2.0, h: 0.56, o: -1 });   // between the gate posts
    for (const x of [52.6, 55]) K.solid(x, z0 - 0.4, 0.18, 0.18, 2.9, { pen: 3, mat: M.post });
    const G = rng(66);
    for (let i = 0; i < 14; i++) {
      const gx = x0 + 1.2 + (i % 5) * 2.3 + (G() - 0.5) * 0.5, gz = z0 + 2.0 + Math.floor(i / 5) * 2.6 + (G() - 0.5) * 0.4;
      const tilt = (G() - 0.5) * 0.3;
      K.box(M.weathered, gx, 0, gz, 0.1, 1.15, 0.08, { rz: tilt });
      K.box(M.weathered, gx, 0.7, gz, 0.56, 0.09, 0.08, { rz: tilt });
      K.box(M.dirtPath, gx, 0, gz + 1.0, 0.8, 0.12, 1.7);
      ZSPAWNS.push({ x: gx, y: 0, z: gz + 1.0, rise: true });
    }
    for (const [x, z] of [[49.2, 47.8], [58.2, 41.8]]) cactus(K, M, x, z, { h: 2.6, seed: Math.floor(x) });
  }

  // back lots: outhouses (a moon cut in the door), laundry, woodpiles
  for (const [x, z, ry] of [[-44, -24.4, 0], [-31, -24.4, 0], [16, -24.4, 0], [-46.5, 24.2, Math.PI], [-6, 24.2, Math.PI], [27, 24.2, Math.PI]]) outhouse(K, M, x, z, ry);
  for (const [x, z] of [[-19, 24.0], [12, 23.8], [-27, -23.6], [6, -23.7]]) {
    K.api.ghostBox(x, z, 2.4, 1.0, 0.9, { pen: 6 });
    for (let i = 0; i < 9; i++) log(K, M, x - 0.4 + (i % 2) * 0.1, Math.floor(i / 3) * 0.28, z - 0.35 + (i % 3) * 0.32, { r: 0.13, len: 1.4, ry: 0 });
  }
  for (const [x, z] of [[-36, 24.5], [21, -24.0]]) {
    // a laundry line: two posts, the line, shirts and sheets
    for (const s of [-2.2, 2.2]) K.solid(x + s, z, 0.12, 0.12, 2.2, { pen: 2, mat: M.post });
    K.box(M.wire, x, 2.05, z, 4.4, 0.01, 0.01, {}, { shadow: false });
    const cols = [0xf2ecdc, 0xc84a3a, 0x5a7aa8, 0xe8dcb8, 0xf2ecdc];
    for (let i = 0; i < 5; i++) K.box(M.cloth, x - 1.7 + i * 0.85, 2.05 - 0.7, z, 0.6, 0.7, 0.02, { rz: (i % 2 - 0.5) * 0.06 }, { color: cols[i] });
  }
}

function outhouse(K, M, x, z, ry) {
  K.solid(x, z, 1.3, 1.3, 2.3, { pen: 2 });
  K.box(M.outhouse, x, 0, z, 1.2, 2.2, 1.2, { ry });
  K.box(M.roofTin, x, 2.25, z, 1.5, 0.08, 1.5, { ry, rx: 0.15 });
  const dz = Math.cos(ry), dx = Math.sin(ry);
  K.box(M.trimDark, x + dx * 0.61, 0, z + dz * 0.61, Math.abs(dz) * 0.8 + 0.03, 1.9, Math.abs(dx) * 0.8 + 0.03);
  K.add(M.lampGlass, place(new THREE.RingGeometry(0.05, 0.09, 10, 1, 0.6, 4.2), { x: x + dx * 0.63, y: 1.6, z: z + dz * 0.63, ry }), { shadow: false });
}

/* A windmill water pump: lattice tower, a fan of blades, a tail vane. */
function windmill(K, M, x, z) {
  const h = 9;
  K.solid(x, z, 1.4, 1.4, h, { pen: 1.5 });
  for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) {
    K.add(M.post, place(new THREE.BoxGeometry(0.12, h, 0.12), { x: x + dx * 0.55, y: h / 2, z: z + dz * 0.55, rx: dz * 0.06, rz: -dx * 0.06 }));
  }
  for (let y = 1; y < h; y += 2) K.box(M.post, x, y, z, 1.5 - y * 0.08, 0.08, 1.5 - y * 0.08);
  const hy = h + 0.4;
  K.box(M.iron, x, hy - 0.2, z, 0.4, 0.4, 0.8);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    K.add(M.steel, place(new THREE.BoxGeometry(0.28, 1.6, 0.03), { x: x + Math.sin(a) * 0.9 * 0, y: hy + Math.cos(a) * 0.95, z: z - 0.45 + 0, rz: a, ry: 0.3 }));
  }
  wheel(K, M, x, hy, z - 0.5, { r: 1.7, spokes: 12 });
  K.box(M.iron, x, hy - 0.05, z + 1.4, 0.06, 0.06, 2.0);
  K.box(M.steel, x, hy - 0.3, z + 2.4, 0.03, 0.9, 1.0);
  trough(K, M, x + 1.9, z, { ry: Math.PI / 2, len: 2.2 });
}

/* ============================================================ the main street */

function buildStreet(K, M, lights, R) {
  // boardwalks both sides; the south one breaks for the cross street
  boardwalk(K, M, ROW_N.front, ROW_N.front + WALK, -52, 35);
  boardwalk(K, M, ROW_S.front - WALK, ROW_S.front, -52, 35, [[CROSS.x0, CROSS.x1]]);
  // telegraph poles down both kerbs, wires strung pole to pole
  const lines = [];
  for (const z of [-6.6, 6.6]) {
    const tops = [];
    for (const x of [-52, -36, -20, -4, 12, 28]) tops.push(telegraphPole(K, M, x, z, { h: 7.4, ry: Math.PI / 2 }));
    lines.push(tops);
  }
  for (const tops of lines) {
    for (let i = 0; i + 1 < tops.length; i++) for (let k = 0; k < tops[i].length; k++) wire(K, M, tops[i][k], tops[i + 1][k], 0.45);
  }
  // across the crossroads, and away to the courthouse and out of town
  for (let k = 0; k < 2; k++) wire(K, M, lines[0][2][k], lines[1][2][k], 0.9);
  {
    const far = new THREE.Vector3(-90, 6.0, -6.6);
    for (let k = 0; k < 4; k++) wire(K, M, lines[0][0][k], far.clone().setZ(lines[0][0][k].z), 1.4);
  }
  // gas lamps, sparse
  for (const [x, z] of [[-44, -6.7], [-12.5, -6.7], [20, -6.7], [-34, 6.7], [-8, 6.7], [22, 6.7]]) streetLamp(K, M, x, z);
  // black bollards along the boardwalk edges by the bank and courthouse
  for (const z of [-6, -3, 3, 6]) bollard(K, M, 38.6, z);
  // hitching rails out front, horses tied up at them
  for (const [x, z] of [[-18.2, -5.6], [-9.8, -5.6], [-32, -5.6], [-44, 5.6], [2.6, 5.6]]) hitchRail(K, M, x, z, { len: 2.6 });
  horse(K, M, -18.8, -4.35, { ry: Math.PI / 2, coat: "black", saddle: true });
  horse(K, M, -17.4, -4.4, { ry: Math.PI / 2 + 0.1, coat: "bay", saddle: true });
  horse(K, M, -9.8, -4.4, { ry: Math.PI / 2 - 0.08, coat: "white", saddle: true });
  horse(K, M, -44.6, 4.4, { ry: -Math.PI / 2, coat: "dun" });
  for (const [x, z, ry] of [[-14, -5.2, 0], [-30.2, -5.2, 0], [-41.6, 5.2, 0]]) trough(K, M, x, z, { ry, len: 2.0 });
  // cover in the street: wagons, a stagecoach, barrels and crates
  wagon(K, M, -36.5, 1.6, { ry: 0.12, cover: true });
  wagon(K, M, 5.0, -1.4, { ry: -0.08, load: 3 });
  wagon(K, M, 24.0, 2.8, { ry: Math.PI + 0.2, load: 2 });
  stagecoach(K, M, -2.0, 3.4, Math.PI - 0.05);
  for (const [x, z] of [[-24.2, -5.4], [-23.6, -4.9], [12.4, 5.4], [34.5, -5.2], [34.0, -4.6]]) barrel(K, M, x, z, {});
  for (const [x, z, ry] of [[-38.6, -5.2, 0.1], [29.6, 5.2, -0.2], [14.2, -2.0, 0.4]]) crateStack(K, M, x, z, R, { ry });
  // the town well at the crossroads
  {
    const x = -18, z = 2.0;
    K.solid(x, z, 1.9, 1.9, 0.85, { pen: 10 });
    K.cyl(M.stone, x, 0, z, 0.95, 0.95, 0.85, 16);
    K.cyl(M.water, x, 0.6, z, 0.75, 0.75, 0.02, 16);
    for (const s of [-0.85, 0.85]) K.box(M.post, x + s, 0.85, z, 0.12, 1.6, 0.12);
    K.box(M.post, x, 2.4, z, 2.0, 0.12, 0.12);
    K.add(M.roofShingle, place(prismGeo([[-1.3, 0], [1.3, 0], [0, 0.8]], 1.6), { x, y: 2.5, z }));
    K.cyl(M.barrelTop, x, 2.0, z, 0.15, 0.15, 0.3, 8);
  }
  // the plaza before the courthouse: a statue of the founder, grinning
  {
    const x = 37.0, z = 0;
    K.solid(x, z, 2.0, 2.0, 1.4, { pen: 12, mat: M.stone });
    K.box(M.trimCream, x, 1.4, z, 2.2, 0.15, 2.2);
    const bronze = M.trollGold;
    K.add(M.copper, place(new THREE.CylinderGeometry(0.32, 0.38, 1.2, 10), { x, y: 2.15, z }));
    K.add(M.copper, place(new THREE.SphereGeometry(0.42, 16, 12), { x, y: 3.1, z, sx: 1.15, sz: 0.9 }));
    K.add(bronze, place(new THREE.PlaneGeometry(0.95, 0.95), { x: x - 0.4, y: 3.1, z, ry: -Math.PI / 2 }), { shadow: false });
    K.add(M.copper, place(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 16), { x, y: 3.48, z }));
    K.add(M.copper, place(new THREE.CylinderGeometry(0.26, 0.3, 0.32, 12), { x, y: 3.5, z }));
    K.add(M.copper, place(new THREE.BoxGeometry(0.14, 0.9, 0.14), { x, y: 3.0, z: z + 0.5, rx: -2.4 }));
    wallPic(K, sign("OUR FOUNDER", "He came. He saw. He trolled.", { bg: "#2a2a2a", fg: "#e8d8a8", edge: "#e8d8a8", w: 512, h: 160 }), { x: x - 1.0, y: 0.75, z, w: 1.2, h: 0.38, o: -1, axis: "z" });
  }
  // the town sign arching over the road out west
  {
    const x = -56;
    for (const z of [-6.5, 6.5]) K.solid(x, z, 0.4, 0.4, 5.6, { pen: 4, mat: M.post });
    K.box(M.post, x, 5.2, 0, 0.3, 0.3, 13.4);
    signBoard(K, sign("WELCOME TO TROLL CITY", "Pop. 420 · Problem?", { bg: "#e8d8b4", fg: "#5a1a12", edge: "#5a1a12" }), M.trimDark, { x, z: 0, y: 4.4, w: 8, h: 1.4, o: 1, axis: "z" });
    steerSkull(K, M, x + 0.25, 5.8, 0, { ry: Math.PI / 2, s: 1.4 });
  }
}

/* A stagecoach: a boxy body hung between big wheels, luggage on top. */
function stagecoach(K, M, x, z, ry) {
  const c = Math.cos(ry), s = Math.sin(ry);
  K.api.ghostBox(x, z, Math.abs(c) * 4.2 + Math.abs(s) * 1.8, Math.abs(s) * 4.2 + Math.abs(c) * 1.8, 2.6, { pen: 3 });
  const at = (u, v) => [x + c * u + s * v, z - s * u + c * v];
  const [bx, bz] = at(0, 0);
  K.box(M.locoRed, bx, 0.95, bz, 2.4, 1.5, 1.5, { ry });
  K.box(M.trimGold, bx, 0.95, bz, 2.45, 0.06, 1.55, { ry });
  K.box(M.trimGold, bx, 2.42, bz, 2.45, 0.06, 1.55, { ry });
  K.box(M.loco, bx, 2.48, bz, 2.6, 0.1, 1.6, { ry });
  for (const side of [-1, 1]) {
    const [wx, wz] = at(0, side * 0.76);
    K.box(M.glass, wx, 1.55, wz, 0.7, 0.55, 0.02, { ry }, { shadow: false });
  }
  for (const [u, r] of [[-1.3, 0.75], [1.3, 0.6]]) for (const side of [-1, 1]) {
    const [wx, wz] = at(u, side * 0.95);
    wheel(K, M, wx, r, wz, { r, ry });
  }
  const [lx, lz] = at(-0.3, 0);
  crate(K, M, lx, lz, { y: 2.58, s: 0.55, ry, collide: false });
  const [dx, dz] = at(1.5, 0);
  K.box(M.loco, dx, 1.7, dz, 0.6, 0.12, 1.4, { ry });
  const [tx, tz] = at(2.8, 0);
  K.box(M.wagonSide, tx, 0.3, tz, 1.8, 0.09, 0.09, { ry });
}

/* =========================================================== the pictures */

/* The user's troll art round the town's walls, in five kinds of frame
   (trollcity-kit.js framedPicture): "We're So Bach" over the saloon piano,
   the troll general in gilt in the bank and the courthouse, the cowboys in
   barnwood and walnut, old sepia photographs in the hotel and the barber's. */
function hangPictures(K, M) {
  const art = {};
  const A = (name, sepia = false) => art[name + sepia] ??= texMat(artTexture(name, { sepia }), { rough: 0.75, bounce: 0.18, decal: true });
  const U = UPPER_Y;
  for (const p of [
    // the saloon: Bach by the piano, the general by the door, the cowboys
    // upstairs
    { x: -13.1, y: FLOOR + 2.55, z: ROW_N.back + T, w: 0.92, h: 0.92, o: 1, style: "gilt", art: A("bach") },
    { x: -16.7, y: 2.4, z: ROW_N.front - T, w: 0.8, h: 1.1, o: -1, style: "carved", art: A("tanktop") },
    { x: -11.3, y: 2.3, z: ROW_N.front - T, w: 0.7, h: 0.83, o: -1, style: "oval", art: A("cigar") },
    { x: -11.5, y: U + 1.85, z: -16.6 + T / 2, w: 1.1, h: 0.82, o: 1, style: "barn", art: A("generalScene") },
    { x: -13.6, y: U + 2.0, z: ROW_N.back + T, w: 0.7, h: 0.7, o: 1, style: "carved", art: A("cowboy") },
    // the police station: the troll general himself, in gold, on the wall
    // behind his desk; the bank and the office's far wall get cowboys
    { x: 47.4, y: 2.55, z: COURT.z0 + T, w: 1.15, h: 1.72, o: 1, style: "gilt", art: A("general") },   // under the picture rail (at 3.15 the rail ran through him)
    { x: 10 - T, y: 2.6, z: -12.8, w: 0.85, h: 1.0, o: -1, axis: "z", style: "gilt", art: A("cigar") },
    { x: 43.4, y: 2.6, z: COURT.z1 - T, w: 0.8, h: 0.8, o: -1, style: "carved", art: A("cowboy") },
    { x: 54.0, y: 2.2, z: COURT.z0 + T, w: 0.6, h: 0.82, o: 1, style: "photo", art: A("tanktop", true) },
    // the hotel lobby, the barber's, the doctor's: old photographs, an oval
    { x: -35 + T, y: 2.1, z: 12.6, w: 0.62, h: 0.62, o: 1, axis: "z", style: "photo", art: A("cowboy", true) },
    { x: -25 - T, y: 2.3, z: 12.6, w: 0.62, h: 0.73, o: -1, axis: "z", style: "oval", art: A("cigar") },
    { x: -1 + T, y: 2.0, z: 13.0, w: 0.58, h: 0.8, o: 1, axis: "z", style: "photo", art: A("tanktop", true) },
    { x: 25 + T, y: 2.1, z: -13.2, w: 0.6, h: 0.6, o: 1, axis: "z", style: "carved", art: A("cowboy", true) },
    // the store, the station, the guns shop
    { x: 2.2, y: 2.2, z: -45 + T, w: 0.8, h: 0.8, o: 1, style: "barn", art: A("cowboy") },
    { x: 13 + T, y: 2.3, z: -19.5, w: 0.6, h: 0.71, o: 1, axis: "z", style: "barn", art: A("cigar") },
  ]) framedPicture(K, M, p);
  // the houses: one each, every frame different
  const H = [[-50, -42, 30, 37], [-37, -29, 32, 39], [28, 36, 30, 37], [40, 48, 31, 38]];
  const styles = ["gilt", "barn", "oval", "photo"], arts = [A("cigar"), A("cowboy"), A("bach"), A("generalScene", true)];
  H.forEach(([x0, x1, z0], i) => {
    framedPicture(K, M, { x: x1 - T, y: 1.95, z: z0 + 1.6, w: 0.62, h: i === 3 ? 0.6 : 0.7, o: -1, axis: "z", style: styles[i], art: arts[i] });
  });
}

/* ============================================================== the plains */

function buildPlains(K, M, R) {
  // the plain itself, out to the horizon (the map's own ground stops 12 m
  // past the bounds, and the hills and the railway run on past that)
  K.add(M.plainFar, place(new THREE.PlaneGeometry(900, 900), { y: -0.04, rx: -Math.PI / 2 }), { shadow: false });
  // grass taking over at the edges of town
  for (const [x, z, w, d] of [[-56, -30, 12, 40], [-56, 30, 12, 40], [58, -28, 8, 44], [58, 28, 8, 22], [0, 46, 124, 8], [-20, -48.5, 84, 3], [20, 44, 50, 6]]) {
    flat(K, M.grassDry, x, z, w, d, { y: 0.015 });
  }
  for (const [x, z, w, d] of [[-56, -42, 8, 10], [-56, 42, 8, 10], [58, 44, 8, 10], [-40, 47, 22, 4]]) flat(K, M.grass, x, z, w, d, { y: 0.02 });
  // rocks and cactus
  for (const [x, z, s] of [[-59, -24, 1.6], [-58, 18, 1.3], [-59.5, 34, 2.0], [59, -38, 1.8], [59.5, -18, 1.2], [58, 12, 1.5], [59.5, 24, 1.1], [-50, -48.5, 1.4], [46, 48, 1.3], [-24, 48.2, 1.0], [-59, -47, 1.8]]) {
    rock(K, M, x, z, { s, seed: Math.floor(x * 7 + z) });
  }
  for (const [x, z, h] of [[-58, -12, 3.2], [-54, 22, 2.6], [-60, 40, 3.6], [58, -32, 3.0], [60, 4, 2.4], [-30, 47.5, 2.8], [6, 48, 3.4], [33, 47, 2.6], [-58, -34, 2.2], [57.5, 18, 3.4]]) {
    cactus(K, M, x, z, { h, seed: Math.floor(x * 13 + z * 3) });
  }
  // a broken prairie schooner and its spilled cargo by the road west
  wagon(K, M, -57.5, -13.5, { ry: 1.2, cover: true });
  for (const [x, z] of [[-55.8, -15.8], [-55.2, -16.4]]) barrel(K, M, x, z, {});
  // the distant mesas and buttes, all round, hazed by the dust
  for (const [x, z, w, h, d, ry, dark] of [
    [-150, -120, 90, 42, 40, 0.2, false], [40, -200, 140, 58, 50, -0.1, true], [210, -60, 60, 46, 40, 1.3, false],
    [190, 120, 110, 38, 46, 0.5, true], [-40, 210, 120, 50, 40, 0.1, false], [-210, 60, 70, 36, 50, 1.5, true],
    [-120, 160, 30, 64, 26, 0.3, false], [120, -150, 24, 70, 22, 0.8, false], [-190, -40, 26, 48, 24, 0.4, false],
  ]) mesa(K, dark ? M.mesaDark : M.mesa, x, z, w, h, d, ry, R);
  // low rolling hills on the plain, nearer
  // (clear of the train's loop, which runs out to x ±135 and z 60)
  for (const [x, z, r, h] of [[-95, -70, 40, 6], [100, 122, 46, 7], [-90, 128, 36, 5], [100, -80, 34, 6], [0, 112, 50, 5], [10, -110, 44, 6]]) {
    const g = new THREE.SphereGeometry(r, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    K.add(M.hill, place(g, { x, y: -1.2, z, sy: (h + 1.2) / r }), { shadow: false });
  }
}

/* A mesa: a flat-topped block with sloped, stepped sides. */
function mesa(K, mat, x, z, w, h, d, ry, R) {
  const pts = [];
  // a talus skirt, a steep cliff band, a cap: the lathe's rings
  for (const [r, y] of [[1.25, 0], [1.05, 0.12], [0.86, 0.3], [0.8, 0.62], [0.76, 0.94], [0.7, 1.0], [0.0, 1.0]]) pts.push(new THREE.Vector2(r, y * h));
  const g = new THREE.LatheGeometry(pts, 16);
  const p = g.attributes.position;
  const wob = Array.from({ length: 16 }, () => 0.88 + R() * 0.24);
  for (let i = 0; i < p.count; i++) {
    const k = wob[Math.floor(i / pts.length) % 16];
    p.setX(i, p.getX(i) * w * 0.5 * k);
    p.setZ(i, p.getZ(i) * d * 0.5 * k);
  }
  g.computeVertexNormals();
  K.add(mat, place(g, { x, y: -1, z, ry }), { shadow: false });
}

/* ================================================================== the map */

/* The benches and settees built as plain solids, as seats (SEATS), and
   the doctor's bag on Doc Grin's desk. */
function rpFurniture(K, M) {
  const Y = FLOOR, U = UPPER_Y;
  benchSeats(-22.25, -16.4, 2.0, "z", Y + 0.85, Y, -Math.PI / 2);      // the saloon's settee
  benchSeats(-21.6, -18.6, 1.0, "z", U + 0.95, U, -Math.PI / 2);       // upstairs, by the stair
  benchSeats(-11.5, -15.95, 2.0, "x", U + 0.85, U, Math.PI);           // the upstairs hall
  benchSeats(-33.5, 18.6, 2.2, "z", Y + 0.85, Y, -Math.PI / 2);        // the Grin Inn's lobby
  for (const z of [-3.4, 3.4]) benchSeats(47.9, z, 2.0, "z", Y + 0.5, Y, Math.PI / 2);   // the sheriff's waiting benches
  for (const x of [-2.5, 0.5]) benchSeats(x, -44.2, 2.0, "x", Y + 0.48, Y, Math.PI);      // the station's waiting room
  for (const x of [-8.4, 0.2]) benchSeats(x, -37.95, 1.8, "x", Y + 0.5, Y, Math.PI);      // the platform
  for (const x of [0.8, 3.2]) seatAt(x, 18.9, Y + 0.75, Y, 0, "chair", 0.7);              // the barber's chairs
  seatAt(27.0, -18.4, Y + 0.95, Y, Math.PI, "exam", 0.75);                                // Doc Grin's exam table
  // the doctor's bag, on the desk
  const b = DOC.bag;
  K.box(M.leather, b.x, Y + 0.78, b.z, 0.38, 0.2, 0.2);
  K.box(M.leather, b.x, Y + 0.98, b.z, 0.3, 0.05, 0.16);
  K.box(M.brass, b.x, Y + 1.03, b.z, 0.14, 0.04, 0.03);
}

function buildTrollCity(api) {
  ZSPAWNS.length = 0;
  SEATS.length = 0;
  SURFACES.length = 0;
  Object.assign(SMITHY, { light: null, coal: null, glow: null });
  JAIL.cells.length = 0;
  const root = new THREE.Group();
  api.prop(root);
  root.castShadow = false;
  const K = new Kit(api, root);
  const lights = [];
  const M = materials();
  const R = rng(1337);

  buildStreet(K, M, lights, R);
  buildShops(K, M, lights);
  buildCourthouse(K, M, lights);
  buildRailway(K, M, lights, R);
  buildSouth(K, M, lights, R);
  buildPlains(K, M, R);
  // a trough and a pump in the back lots, crates by the shops' back doors
  for (const [x, z, ry] of [[-34, -23.8, 0.2], [2, -23.6, -0.3], [-44, 23.6, 0.1], [20, 23.8, 0.5]]) crateStack(K, M, x, z, R, { ry });
  for (const [x, z] of [[-12, -23.6], [28, -23.2], [-28, 23.5], [8, 23.7]]) barrel(K, M, x, z, {});

  hangPictures(K, M);
  rpFurniture(K, M);

  K.flush();
  for (const l of lights) {
    l.castShadow = false;
    root.add(l);
  }

  /* ------------------------------------------------ zombie entry points */
  // off the plains, all round the edge
  for (const [x, z] of [
    [-61, -40], [-61, -22], [-61, -2], [-61, 14], [-61, 30], [-61, 46],
    [61, -44], [61, -22], [61, 14], [61, 30],
    [-46, -49.2], [-14, -49.2], [18, -49.2], [50, -49.2],
    [-50, 49.2], [-24, 49.2], [-4, 49.2], [24, 49.2], [40, 49.2],
  ]) ZSPAWNS.push({ x, y: 0, z });
}

export const TROLLCITY = {
  name: "Troll City",
  blurb: "Dust, saloons and a railroad. This town ain't big enough for the both of you.",
  bounds: { ...BOUNDS },
  playerSpawn: { x: -20, z: 0 },
  // Mid-afternoon on the plains: a high warm sun, a pale dusty sky going
  // gold at the horizon, scattered fair-weather cloud.
  sky: { top: 0x4f86c8, horizon: 0xf0dcb4, bottom: 0xb89a6a, sun: 1.2, sunSize: 0.035, sunColor: 0xfff0c8, haze: 0.55, clouds: 0.38, cloudColor: 0xffffff, cloudShade: 0xb8a898 },
  fog: { color: 0xdcc8a4, density: 0.0062 },
  exposure: 1.25,
  bloom: { threshold: 0.92 },
  ground: { colorA: 0xc8a272, colorB: 0xb89260, grid: 0xb08a5a, surface: "sand", tile: 5 },
  sun: { color: 0xfff0d8, intensity: 2.7, pos: [42, 58, 30] },
  hemi: { sky: 0xb8d0ec, ground: 0xb08a5a, intensity: 1.0 },
  ambient: { color: 0xfff0d8, intensity: 0.25 },
  build: buildTrollCity,
  // Socialize roleplay spots (saloon-bar.js / game.js updateBar). Floor
  // heights are the saloon's ground floor.
  rp: { bar: { ...BAR, floorY: FLOOR }, npcs: () => townNpcs(), seats: () => SEATS, surfaces: () => SURFACES, smithy: () => SMITHY, train: () => TRAIN_STATE.train, conductor: CONDUCTOR, jail: () => JAIL, doctor: { ...DOC, floorY: FLOOR } },
  // Team spawns: past the railway in the north, out on the plain south.
  spawns: [[-56, -46], [-46, -47.5], [-16, -47.8], [-2, -47.8], [8, -48], [18, -46.5], [50, -46], [58, -40],
    [-56, 46], [-44, 46.5], [-26, 45], [-12, 46], [0, 45.5], [14, 46], [28, 45], [40, 45.5]],

  zombieLayout: () => ({
    windows: ZSPAWNS.map((w) => ({ ...w })),
    floorOf: tcFloorOf,
    floors: TC_FLOORS,
    links: [{ from: "ground", to: "upper", a: { x: STAIR.x, z: STAIR.zFoot + 0.9 }, b: { x: STAIR.x, z: STAIR_HOLE.z0 - 0.9 } }],
    support: true,
    preferDist: 16,
    navCell: 0.55,
    navPad: 0.3,
    navStep: 0.45,
  }),
};

/* The chairs round a tableSet (trollcity-kit.js), worked out the same way it
   places them (same seed, same draws), so a townsfolk NPC sits on a real
   chair: [{ x, z, ry, y }] with ry the way the chair faces. */
function tableSeats(x, y, z, { chairs = 4, r = 0.55, seed = 1 } = {}) {
  const R = rng(seed), out = [];
  for (let i = 0; i < chairs; i++) {
    const a = (i / chairs) * Math.PI * 2 + R() * 0.4;
    out.push({ x: x + Math.cos(a) * (r + 0.35), z: z + Math.sin(a) * (r + 0.35), ry: -a - Math.PI / 2 + (R() - 0.5) * 0.5, y: y + 0.47, table: { x, z } });
  }
  return out;
}

/* Socialize townsfolk (town-npcs.js): who stands where doing what. `yaw`
   uses the camera's convention (0 faces -z, +PI/2 faces -x). Seats give the
   seat-top height; `act` picks the loop they play. Only in Socialize. */
function townNpcs() {
  const Y = FLOOR;
  const cards = tableSeats(-12.4, Y, -13.0, { seed: 5 });
  const corner = tableSeats(-17.6, Y, -15.9, { seed: 7, chairs: 3 });
  const front = tableSeats(-18.5, Y, -12.9, { seed: 3 });
  // Seated facing the table (forward is (-sin yaw, -cos yaw)).
  const seat = (s, extra) => ({ x: s.x, z: s.z, y: s.y, yaw: Math.atan2(s.x - s.table.x, s.z - s.table.z), sit: true, ...extra });
  return [
    // the Rusty Grin
    { name: "Grinny", role: "Barkeep", act: "wipe", x: -6.45, z: -15.2, y: Y, yaw: Math.PI / 2 },
    { name: "Old Kek", role: "Barfly", act: "drink", x: -8.5, z: -18.05, y: Y + 0.78, yaw: -Math.PI / 2, sit: true, stool: true },
    { name: "Dusty", role: "Barfly", act: "drink", x: -8.5, z: -15.95, y: Y + 0.78, yaw: -Math.PI / 2, sit: true, stool: true, drink: "whiskey" },
    { name: "Lil' Cope", role: "Barfly", act: "drink", x: -8.5, z: -13.85, y: Y + 0.78, yaw: -Math.PI / 2, sit: true, stool: true },
    seat(cards[0], { name: "Ace", role: "Card shark", act: "cards" }),
    seat(cards[1], { name: "Two-Bit", role: "Gambler", act: "cards" }),
    seat(cards[3], { name: "Lucky Lou", role: "Gambler", act: "cards" }),
    seat(corner[0], { name: "Mabel", role: "Regular", act: "drink" }),
    seat(front[1], { name: "Hank", role: "Regular", act: "drink", drink: "whiskey" }),
    { name: "Piano Pete", role: "Pianist", act: "piano", x: -13.1, z: -20.0, y: Y + 0.35 + 0.47, yaw: 0, sit: true },
    { name: "Miss Kitty", role: "Dancer", act: "dance", x: -12.0, z: -19.05, y: Y + 0.35, yaw: Math.PI },
    // Main Street: strollers round the street, stopping now and then
    // (two clear lanes, z -2.8 and 0.3, miss the horses, troughs, wagons and the well)
    { name: "Jebediah", role: "Townsfolk", act: "walk", y: 0, path: [[-40, -2.8], [30, -2.8], [30, 0.3], [-40, 0.3]], at: 0 },
    { name: "Clementine", role: "Townsfolk", act: "walk", y: 0, path: [[-40, -2.8], [30, -2.8], [30, 0.3], [-40, 0.3]], at: 0.4 },
    { name: "Hattie", role: "Townsfolk", act: "walk", y: 0, path: [[-40, -2.8], [30, -2.8], [30, 0.3], [-40, 0.3]], at: 0.65 },
    { name: "Mudcake", role: "Townsfolk", act: "walk", y: 0, path: [[-34, 0.3], [22, 0.3]], at: 0.3, pace: true },
    { name: "Sully", role: "Drifter", act: "walk", y: 0, path: [[-30, -2.8], [20, -2.8]], at: 0.8, pace: true },
    { name: "Dot", role: "Townsfolk", act: "walk", y: 0, path: [[-26, 0.3], [10, 0.3]], at: 0.1, pace: true },
    { name: "Cletus", role: "Townsfolk", act: "walk", y: 0, path: [[-18, 6], [-18, 26], [-14, 26], [-14, 6]], at: 0.2 },
    { name: "Pockets", role: "Townsfolk", act: "walk", y: 0, path: [[30, 5], [38, 5], [38, -5], [30, -5]], at: 0.7 },
    // the trades
    { name: "Sheriff Grimes", role: "Sheriff", act: "guard", x: 40.2, z: -1.5, y: Y, yaw: Math.PI / 2 },
    { name: "Deputy Doofus", role: "Deputy", act: "sit-read", x: 47.4, z: -7.1, y: Y + 0.47, yaw: Math.PI, sit: true },
    // the anvil top, the coals, the barrel's water; where he stands at each
    { name: "Iron Ike", role: "Blacksmith", act: "smith", x: -45.2, z: 17.3, y: Y, yaw: Math.PI,
      anvil: [-45.4, Y + 0.87, 18.0], forge: [-47.4, Y + 0.96, 19.45], quench: [-43.6, Y + 0.85, 19.8],
      stand: { anvil: [-45.2, 17.3], forge: [-47.65, 18.6], quench: [-43.85, 19.0] } },
    { name: "Hay Jay", role: "Horsekeeper", act: "brush", x: 18.5, z: 33.7, y: 0, yaw: -0.85 },
    { name: "Mr. Kek", role: "Merchant", act: "count", x: -33.6, z: -18.75, y: Y, yaw: Math.PI },
    { name: "Doc Grin", role: "Doctor", act: "tend", x: 27.0, z: -17.85, y: Y, yaw: 0 },
    { name: "Banker Bux", role: "Banker", act: "count", x: 2.9, z: -15.95, y: Y, yaw: Math.PI },
    { name: "Conductor Choo", role: "Conductor", act: "walk", y: Y, path: [[-20, -26.3], [8, -26.3]], at: 0.3, pace: true },
  ];
}

// shared with the dressing pass (maps.js): the shop floors to keep clear
export const TC_FOOTPRINTS = [
  [-50, ROW_N.back, 33, ROW_N.front + WALK], [-50, ROW_S.front - WALK, 33, ROW_S.back],
  [COURT.x0 - 3, COURT.z0, COURT.x1, COURT.z1], [-36, -48, 46, -24], [-12, 28, 6, 40],
];
