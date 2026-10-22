// Troll Forces — Trolling Loud's kitchen (the tf-parallel plan, phase 3).
//
// The room behind the bar: x 14-30, z -22 to -9 on the ground floor. The
// line along the north wall (fryer, six-burner range, griddle, prep fridge
// under one hood), the pass beside the bar door with a hatch through to the
// bar, the dish pit on the west wall, a dry store and the walk-in on the
// north-east, the prep island in the middle with the pans over it. White
// tile to head height, red quarry tile underfoot, troffers overhead, food
// everywhere (the game had none).
//
// The doors: the bar's and the hall's double swing doors are leaves on
// hinges (view/swing-doors.js swings them for whoever walks through). No
// collider on a leaf: the club's zone fence keeps guests out, bots walk
// the hole as before.
//
// The light: the club keeps its fourteen real lights (a 15th costs every
// lit pixel in the map). The backstage light hops to the kitchen while the
// camera is in it (hopBackLight, from trollingloud.js tick): moving a light
// is free, only adding one recompiles.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { place, texMat, canvasTex } from "./trollcity-kit.js?v=tc2-wst-tc3-sh1-sr1-pf1-or1-tcs1-tx1";

/* The room's inside faces (walls are 0.3 thick on lines x 14, 30, z -22, -9). */
export const KITCHEN = { x0: 14.15, x1: 29.85, z0: -21.85, z1: -9.15 };
/* The hatch through to the bar, beside the door (trollingloud.js cuts it). */
export const PASS_HATCH = { c: 25.2, w: 2.2, lo: 1.0, hi: 1.9 };

/* ------------------------------------------------------------ textures */

function subwayTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#b9bdbf"; g.fillRect(0, 0, w, h);                    // grout
    const tw = w / 4, th = h / 8;
    for (let r = 0; r < 8; r++) {
      for (let c = -1; c < 5; c++) {
        const x = c * tw + (r % 2 ? tw / 2 : 0) + 2, y = r * th + 2;
        const grd = g.createLinearGradient(0, y, 0, y + th - 4);
        grd.addColorStop(0, "#fbfcfc"); grd.addColorStop(1, "#e3e8ea");
        g.fillStyle = grd; g.fillRect(x, y, tw - 4, th - 4);
        g.fillStyle = "rgba(255,255,255,.7)"; g.fillRect(x + 3, y + 2, tw - 12, 3);   // the glaze catching the light
      }
    }
  }, { repeat: true });
}
function quarryTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#3a2420"; g.fillRect(0, 0, w, h);
    const n = 4, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const k = ((i * 7 + j * 13) % 5) / 5;
      g.fillStyle = `rgb(${150 + k * 30 | 0},${62 + k * 14 | 0},${44 + k * 8 | 0})`;
      g.fillRect(i * s + 3, j * s + 3, s - 6, s - 6);
      g.fillStyle = "rgba(0,0,0,.08)"; g.fillRect(i * s + 3 + s * 0.3, j * s + 3 + s * 0.5, s * 0.35, s * 0.2);
    }
  }, { repeat: true });
}
/* One atlas for every bit of writing in the room: the 86 board, the clock,
   the tickets, the door plates. */
const ATLAS = { board: [0, 0, 0.5, 0.5], clock: [0.5, 0, 0.75, 0.25], ticket: [0.75, 0, 0.875, 0.25], plate: [0, 0.5, 0.5, 0.625], wet: [0.5, 0.25, 0.75, 0.5] };
function atlasTexture() {
  return canvasTex(1024, 1024, (g, W) => {
    const R = ([u0, v0, u1, v1]) => [u0 * W, v0 * W, (u1 - u0) * W, (v1 - v0) * W];
    // the 86 board: chalk on slate in a wood frame
    let [x, y, w, h] = R(ATLAS.board);
    g.fillStyle = "#6a4a30"; g.fillRect(x, y, w, h);
    g.fillStyle = "#1e2422"; g.fillRect(x + 18, y + 18, w - 36, h - 36);
    g.fillStyle = "#e8ece6"; g.font = "bold 64px sans-serif"; g.textAlign = "center";
    g.fillText("86 LIST", x + w / 2, y + 100);
    g.font = "40px sans-serif"; g.textAlign = "left";
    ["wings (til 1)", "the lobster", "mid-tier ranch", "Dave's sauce"].forEach((t, i) => g.fillText("- " + t, x + 50, y + 180 + i * 62));
    g.strokeStyle = "#e8ece6"; g.lineWidth = 4; g.beginPath(); g.moveTo(x + 50, y + 236); g.lineTo(x + 300, y + 222); g.stroke();
    g.font = "italic 34px sans-serif"; g.fillText("specials: grin burger $12", x + 50, y + 460);
    // the clock
    [x, y, w, h] = R(ATLAS.clock);
    const cx = x + w / 2, cy = y + h / 2;
    g.fillStyle = "#111"; g.beginPath(); g.arc(cx, cy, w / 2 - 2, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#f4f2ea"; g.beginPath(); g.arc(cx, cy, w / 2 - 14, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#111";
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillRect(cx + Math.sin(a) * (w / 2 - 34) - 4, cy - Math.cos(a) * (w / 2 - 34) - 10, 8, 20); }
    g.lineWidth = 12; g.lineCap = "round"; g.strokeStyle = "#111";
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 50, cy - 40); g.stroke();      // ten past one
    g.lineWidth = 7; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 30, cy - 90); g.stroke();
    g.strokeStyle = "#c02020"; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx - 70, cy + 60); g.stroke();
    // a ticket
    [x, y, w, h] = R(ATLAS.ticket);
    g.fillStyle = "#fbf8ee"; g.fillRect(x, y, w, h);
    g.fillStyle = "#222"; g.font = "bold 22px monospace"; g.textAlign = "left";
    ["T12  2:10", "2x GRIN BGR", "  - no pickle", "1x WINGS hot", "1x NACHOS", "--------", "FIRE"].forEach((t, i) => g.fillText(t, x + 10, y + 34 + i * 30));
    // the door plate
    [x, y, w, h] = R(ATLAS.plate);
    g.fillStyle = "#c8ccd2"; g.fillRect(x, y, w, h);
    g.fillStyle = "#16181c"; g.font = "bold 60px sans-serif"; g.textAlign = "center";
    g.fillText("KITCHEN · STAFF ONLY", x + w / 2, y + h / 2 + 20, w - 36);
    // the wet floor sign's face
    [x, y, w, h] = R(ATLAS.wet);
    g.fillStyle = "#f2c81a"; g.fillRect(x, y, w, h);
    g.fillStyle = "#111"; g.font = "bold 38px sans-serif"; g.textAlign = "center";
    g.fillText("CAUTION", x + w / 2, y + 60); g.fillText("WET FLOOR", x + w / 2, y + 230);
    g.beginPath(); g.arc(x + w / 2, y + 100, 16, 0, Math.PI * 2); g.fill();          // the slipping man
    g.lineWidth = 12; g.strokeStyle = "#111"; g.beginPath(); g.moveTo(x + w / 2, y + 115); g.lineTo(x + w / 2 + 20, y + 160); g.lineTo(x + w / 2 - 25, y + 190); g.moveTo(x + w / 2 + 20, y + 160); g.lineTo(x + w / 2 + 45, y + 185); g.stroke();
  });
}

export function kitchenMaterials() {
  const std = (color, rough = 0.6, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
  const vc = (rough, metal = 0) => { const m = std(0xffffff, rough, metal); m.vertexColors = true; return m; };
  return {
    tile: texMat(subwayTexture(), { tile: 0.6, rough: 0.25, bounce: 0.05 }),
    quarry: texMat(quarryTexture(), { tile: 0.6, rough: 0.55 }),
    copper: std(0xb8693a, 0.3, 0.85),
    grate: std(0x141414, 0.6, 0.5),
    food: vc(0.55),                              // every bite: one draw (vertex colours)
    goods: vc(0.7),                              // cans, boxes, jars on the shelves
    leaf: vc(0.32, 0.65),                        // the swing doors
    flame: new THREE.MeshBasicMaterial({ color: new THREE.Color(0x3a7aff).multiplyScalar(1.6), toneMapped: false }),
    lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff8a30).multiplyScalar(1.5), toneMapped: false }),
    diffuser: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xf4f8ff).multiplyScalar(1.6), toneMapped: false }),
    pool: new THREE.MeshBasicMaterial({ color: 0xff8a40, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    water: new THREE.MeshStandardMaterial({ color: 0x7aa8b8, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.75 }),
    atlas: new THREE.MeshStandardMaterial({ map: atlasTexture(), roughness: 0.8 }),
  };
}

/* ---------------------------------------------------------------- helpers */

/* A box from its extents (y0 = bottom). */
function bx(K, mat, x0, x1, y0, y1, z0, z1, opts) {
  return K.box(mat, (x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, {}, opts);
}
/* A plane showing one rectangle of the atlas, facing `ry` (0 = +z). */
function atlasQuad(K, KM, rect, x, y, z, w, h, ry = 0, rx = 0) {
  const g = new THREE.PlaneGeometry(w, h);
  const [u0, v0, u1, v1] = rect, uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), 1 - v1 + uv.getY(i) * (v1 - v0));
  K.add(KM.atlas, place(g, { x, y, z, ry, rx }), { shadow: false });
}
/* Seeded 0..1 (the same kitchen on every client). */
function rnd(seed) { let s = seed >>> 0; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x6d2b79f5 >>> 0) % 10000) / 10000; }

/* ------------------------------------------------------------------ food */
/* Each piece a handful of primitives in KM.food, coloured per vertex. `y` is
   the surface it sits on. */

function food(K, KM, color, geo) { K.add(KM.food, geo, { color, shadow: false }); }
const C = {
  bun: 0xd8963e, bunLo: 0xe0a456, patty: 0x4a2a18, cheese: 0xf2b81e, lettuce: 0x5aa83a, tomato: 0xc8341e,
  fry: 0xf0c450, basket: 0xb81e1e, paper: 0xf4efe0, crust: 0xd9a35a, cheesy: 0xeab44c, pep: 0xa8281e,
  wing: 0xb8481a, celery: 0x9ac85a, ranch: 0xf2f0e6, chip: 0xe8c060, jalapeno: 0x4a8a2a, plate: 0xf4f4f0,
  tray: 0x26262a, sheet: 0x9a9ca4, shell: 0xe8c870, beef: 0x6a3a20, lemon: 0xf2d630, lime: 0x58a830,
  ketchup: 0xc02018, mustard: 0xe8c020, cap: 0xf4f4f4, board: 0x8a5a34, onion: 0xe8dcc8, salsa: 0xb83a24, cake: 0x5a2a1a, frosting: 0xf4e8f0, beer: 0xc88a20,
};
function burger(K, KM, x, y, z, s = 1, ry = 0) {
  const p = (geo, o) => place(geo, { x, z, ...o, y: y + o.y * s });
  food(K, KM, C.bunLo, p(new THREE.CylinderGeometry(0.055 * s, 0.05 * s, 0.022 * s, 12), { y: 0.011 }));
  food(K, KM, C.patty, p(new THREE.CylinderGeometry(0.06 * s, 0.06 * s, 0.02 * s, 12), { y: 0.032 }));
  food(K, KM, C.cheese, p(new THREE.BoxGeometry(0.105 * s, 0.005 * s, 0.105 * s), { y: 0.044, ry: ry + 0.6 }));
  food(K, KM, C.lettuce, p(new THREE.CylinderGeometry(0.064 * s, 0.064 * s, 0.006 * s, 10), { y: 0.05 }));
  food(K, KM, C.tomato, p(new THREE.CylinderGeometry(0.05 * s, 0.05 * s, 0.008 * s, 10), { y: 0.057 }));
  food(K, KM, C.bun, p(new THREE.SphereGeometry(0.057 * s, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), { y: 0.061, sy: 0.7 }));
}
function burgerBasket(K, KM, x, y, z, ry = 0) {
  const R = rnd(Math.round(x * 97 + z * 31));
  const c = Math.cos(ry), s = Math.sin(ry);
  const at = (u, v) => [x + u * c + v * s, z - u * s + v * c];
  food(K, KM, C.basket, place(new THREE.BoxGeometry(0.24, 0.05, 0.16), { x, y: y + 0.025, z, ry }));
  food(K, KM, C.paper, place(new THREE.BoxGeometry(0.22, 0.004, 0.14), { x, y: y + 0.052, z, ry }));
  const [bx0, bz0] = at(-0.05, 0);
  burger(K, KM, bx0, y + 0.054, bz0, 0.9, ry);
  for (let i = 0; i < 9; i++) {
    const [fx, fz] = at(0.06 + (R() - 0.5) * 0.06, (R() - 0.5) * 0.09);
    food(K, KM, C.fry, place(new THREE.BoxGeometry(0.009, 0.009, 0.075), { x: fx, y: y + 0.062 + R() * 0.02, z: fz, ry: ry + R() * 3, rx: (R() - 0.5) * 0.6 }));
  }
}
function pizza(K, KM, x, y, z, r = 0.17) {
  const R = rnd(Math.round(x * 53 + z * 17));
  food(K, KM, C.crust, place(new THREE.CylinderGeometry(r, r, 0.016, 20), { x, y: y + 0.008, z }));
  food(K, KM, C.cheesy, place(new THREE.CylinderGeometry(r * 0.9, r * 0.9, 0.006, 20), { x, y: y + 0.017, z }));
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + R() * 0.4, d = r * (i % 2 ? 0.55 : 0.3) + R() * 0.03;
    food(K, KM, C.pep, place(new THREE.CylinderGeometry(0.026, 0.026, 0.005, 10), { x: x + Math.cos(a) * d, y: y + 0.021, z: z + Math.sin(a) * d }));
  }
}
function wings(K, KM, x, y, z) {
  const R = rnd(Math.round(x * 41 + z * 7));
  food(K, KM, C.tray, place(new THREE.BoxGeometry(0.32, 0.02, 0.22), { x, y: y + 0.01, z }));
  for (let i = 0; i < 9; i++) {
    food(K, KM, C.wing, place(new THREE.SphereGeometry(0.026, 8, 6), { x: x - 0.1 + (i % 3) * 0.06 + R() * 0.02, y: y + 0.035, z: z - 0.06 + Math.floor(i / 3) * 0.055, sx: 1.6, sy: 0.75, ry: R() * 3 }));
  }
  for (let i = 0; i < 3; i++) food(K, KM, C.celery, place(new THREE.BoxGeometry(0.012, 0.012, 0.11), { x: x + 0.1, y: y + 0.03, z: z - 0.03 + i * 0.03, ry: 0.2 }));
  food(K, KM, C.ranch, place(new THREE.CylinderGeometry(0.03, 0.025, 0.035, 10), { x: x + 0.1, y: y + 0.037, z: z + 0.07 }));
}
function nachos(K, KM, x, y, z) {
  const R = rnd(Math.round(x * 23 + z * 59));
  food(K, KM, C.plate, place(new THREE.CylinderGeometry(0.15, 0.13, 0.015, 18), { x, y: y + 0.008, z }));
  for (let i = 0; i < 16; i++) {
    const a = R() * Math.PI * 2, d = R() * 0.1;
    food(K, KM, C.chip, place(new THREE.CylinderGeometry(0.035, 0.035, 0.004, 3), { x: x + Math.cos(a) * d, y: y + 0.02 + R() * 0.035, z: z + Math.sin(a) * d, rx: (R() - 0.5) * 0.9, rz: (R() - 0.5) * 0.9, ry: R() * 3 }));
  }
  for (let i = 0; i < 7; i++) food(K, KM, C.cheese, place(new THREE.SphereGeometry(0.014, 6, 4), { x: x + (R() - 0.5) * 0.14, y: y + 0.05, z: z + (R() - 0.5) * 0.14, sy: 0.5 }));
  for (let i = 0; i < 5; i++) food(K, KM, C.jalapeno, place(new THREE.CylinderGeometry(0.01, 0.01, 0.004, 8), { x: x + (R() - 0.5) * 0.12, y: y + 0.058, z: z + (R() - 0.5) * 0.12 }));
}
function sliders(K, KM, x, y, z) {
  food(K, KM, C.board, place(new THREE.BoxGeometry(0.36, 0.02, 0.14), { x, y: y + 0.01, z }));
  for (let i = 0; i < 4; i++) burger(K, KM, x - 0.12 + i * 0.08, y + 0.02, z, 0.6);
}
function tacos(K, KM, x, y, z) {
  food(K, KM, C.sheet, place(new THREE.BoxGeometry(0.44, 0.02, 0.3), { x, y: y + 0.01, z }));
  for (let i = 0; i < 4; i++) {
    const tx = x - 0.15 + i * 0.1;
    food(K, KM, C.shell, place(new THREE.CylinderGeometry(0.055, 0.055, 0.2, 10, 1, true, Math.PI / 2, Math.PI), { x: tx, y: y + 0.075, z, rx: Math.PI / 2 }));
    food(K, KM, C.beef, place(new THREE.BoxGeometry(0.03, 0.03, 0.17), { x: tx, y: y + 0.07, z }));
    food(K, KM, C.lettuce, place(new THREE.BoxGeometry(0.04, 0.012, 0.16), { x: tx, y: y + 0.09, z }));
    food(K, KM, C.cheese, place(new THREE.BoxGeometry(0.03, 0.008, 0.15), { x: tx, y: y + 0.1, z }));
  }
}
function garnish(K, KM, x, y, z) {
  const R = rnd(Math.round(x * 13 + z * 3));
  food(K, KM, C.sheet, place(new THREE.BoxGeometry(0.3, 0.05, 0.2), { x, y: y + 0.025, z }));
  for (let i = 0; i < 10; i++) {
    food(K, KM, i % 2 ? C.lemon : C.lime, place(new THREE.SphereGeometry(0.03, 8, 6), { x: x - 0.11 + (i % 5) * 0.055, y: y + 0.065, z: z - 0.045 + Math.floor(i / 5) * 0.09 + (R() - 0.5) * 0.01, sx: 1.15, sy: 0.85 }));
  }
}
function bottles(K, KM, x, y, z) {
  for (const [dx, col] of [[0, C.ketchup], [0.06, C.mustard], [0.12, C.ketchup]]) {
    food(K, KM, col, place(new THREE.CylinderGeometry(0.024, 0.026, 0.15, 10), { x: x + dx, y: y + 0.075, z }));
    food(K, KM, C.cap, place(new THREE.CylinderGeometry(0.006, 0.016, 0.04, 8), { x: x + dx, y: y + 0.17, z }));
  }
}

/* ----------------------------------------------------------- the build */

/* ctx: { FL, CEIL, T, M (the club's materials), batten, sign, S, N }. */
export function buildKitchen(K, KM, ctx) {
  const { FL, CEIL, M } = ctx;
  const { x0: X0, x1: X1, z0: Z0, z1: Z1 } = KITCHEN;
  const TOPY = FL + 0.92;                                    // counter height

  /* ---- the room: quarry tile underfoot, white tile to head height */
  for (let x = X0; x < X1 - 0.01; x += 8) {
    const xe = Math.min(X1, x + 8);
    K.add(KM.quarry, place(new THREE.PlaneGeometry(xe - x, Z1 - Z0), { x: (x + xe) / 2, y: FL + 0.004, z: (Z0 + Z1) / 2, rx: -Math.PI / 2 }), { shadow: false });
  }
  ctx.tileWalls(KM.tile, 1.85);
  bx(K, M.steel, 20.75, 21.25, FL + 0.005, FL + 0.009, -18.55, -18.05, { shadow: false });   // the floor drain
  for (let i = 0; i < 5; i++) bx(K, KM.grate, 20.8 + i * 0.09, 20.84 + i * 0.09, FL + 0.009, FL + 0.011, -18.5, -18.1, { shadow: false });

  /* ---- the line, under one hood: fryer, range, griddle, prep fridge */
  const LZ0 = Z0, LZ1 = Z0 + 0.9;                             // z -21.85 .. -20.95
  K.solid(17.6, (LZ0 + LZ1) / 2, 5.3, 0.9, 0.92, { y: FL, pen: 3 });
  // the bodies
  bx(K, M.steel, 14.95, 15.7, FL, TOPY - 0.04, LZ0, LZ1);                 // fryer
  bx(K, M.steel, 15.75, 17.25, FL, TOPY - 0.04, LZ0, LZ1);                // range
  bx(K, M.steel, 17.3, 18.5, FL, TOPY - 0.04, LZ0, LZ1);                  // griddle
  bx(K, M.steel, 18.55, 20.25, FL, TOPY - 0.04, LZ0, LZ1);                // the prep fridge
  bx(K, M.steelTop, 14.9, 20.3, TOPY - 0.04, TOPY, LZ0, LZ1 + 0.03);     // one top
  bx(K, M.chrome, 14.9, 20.3, FL + 0.82, FL + 0.85, LZ1 + 0.02, LZ1 + 0.05);   // the towel bar
  // fryer: two oil wells, two baskets on the hanger
  for (const x of [15.15, 15.5]) {
    bx(K, M.gold, x - 0.14, x + 0.14, TOPY, TOPY + 0.004, LZ0 + 0.25, LZ0 + 0.7);
    bx(K, M.chrome, x - 0.11, x + 0.11, TOPY + 0.12, TOPY + 0.24, LZ0 + 0.06, LZ0 + 0.18);   // a basket hung up to drain
    bx(K, M.blackMetal, x - 0.015, x + 0.015, TOPY + 0.2, TOPY + 0.22, LZ0 + 0.18, LZ0 + 0.42);
  }
  // range: an oven door, six burners (two lit), a stock pot, a copper pan
  bx(K, M.blackGloss, 15.85, 17.15, FL + 0.18, FL + 0.66, LZ1 - 0.01, LZ1 + 0.01);
  bx(K, M.chrome, 16.0, 17.0, FL + 0.7, FL + 0.73, LZ1 + 0.01, LZ1 + 0.05);
  for (let i = 0; i < 6; i++) {
    const x = 16.0 + (i % 3) * 0.5, z = LZ0 + 0.3 + Math.floor(i / 3) * 0.32;
    bx(K, M.blackMetal, x - 0.2, x + 0.2, TOPY, TOPY + 0.03, z - 0.14, z + 0.14);
    if (i === 1 || i === 3) K.add(KM.flame, place(new THREE.TorusGeometry(0.06, 0.008, 4, 16), { x, y: TOPY + 0.035, z, rx: Math.PI / 2 }), { shadow: false });
  }
  for (let i = 0; i < 6; i++) bx(K, M.blackMetal, 15.9 + i * 0.25, 15.94 + i * 0.25, FL + 0.76, FL + 0.8, LZ1, LZ1 + 0.04);   // knobs
  K.cyl(M.steel, 16.5, TOPY + 0.03, LZ0 + 0.3, 0.17, 0.17, 0.32, 16);   // stock pot
  K.cyl(M.steelTop, 16.5, TOPY + 0.35, LZ0 + 0.3, 0.175, 0.175, 0.01, 16);
  K.cyl(KM.copper, 16.0, TOPY + 0.03, LZ0 + 0.62, 0.14, 0.12, 0.06, 14);   // a sauté pan on the lit burner
  bx(K, KM.copper, 15.62, 15.88, TOPY + 0.07, TOPY + 0.09, LZ0 + 0.6, LZ0 + 0.64);
  // griddle: black steel plate, burgers on it, a press
  bx(K, M.blackGloss, 17.35, 18.45, TOPY, TOPY + 0.012, LZ0 + 0.1, LZ1 - 0.06);
  for (let i = 0; i < 6; i++) food(K, KM, C.patty, place(new THREE.CylinderGeometry(0.058, 0.058, 0.02, 12), { x: 17.55 + (i % 3) * 0.3, y: TOPY + 0.022, z: LZ0 + 0.4 + Math.floor(i / 3) * 0.24 }));
  for (const i of [0, 2]) food(K, KM, C.cheese, place(new THREE.BoxGeometry(0.1, 0.005, 0.1), { x: 17.55 + i * 0.3, y: TOPY + 0.034, z: LZ0 + 0.4, ry: 0.7 }));
  for (let i = 0; i < 3; i++) food(K, KM, C.bunLo, place(new THREE.CylinderGeometry(0.055, 0.055, 0.018, 12), { x: 17.55 + i * 0.3, y: TOPY + 0.021, z: LZ0 + 0.18 }));
  // prep fridge: pans of the fixings sunk in the top
  const fix = [C.tomato, C.lettuce, C.onion, C.cheese, C.jalapeno, C.salsa, C.beef, C.pep];
  fix.forEach((col, i) => {
    const x = 18.7 + (i % 4) * 0.38, z = LZ0 + 0.3 + Math.floor(i / 4) * 0.3;
    bx(K, M.steelTop, x - 0.17, x + 0.17, TOPY, TOPY + 0.012, z - 0.13, z + 0.13);
    food(K, KM, col, place(new THREE.BoxGeometry(0.3, 0.02, 0.22), { x, y: TOPY + 0.004, z }));
  });
  for (const x of [18.95, 19.8]) bx(K, M.chrome, x - 0.3, x + 0.3, FL + 0.72, FL + 0.75, LZ1, LZ1 + 0.04);   // drawer pulls
  // the splash, the salamander on its shelf, the hood with lamps under it
  bx(K, M.steelTop, 14.9, 20.3, TOPY, FL + 2.05, LZ0, LZ0 + 0.02);
  bx(K, M.steel, 15.75, 17.25, FL + 1.5, FL + 1.53, LZ0, LZ0 + 0.45);
  bx(K, M.steel, 15.95, 17.05, FL + 1.53, FL + 1.85, LZ0 + 0.02, LZ0 + 0.42);
  bx(K, KM.lamp, 16.0, 17.0, FL + 1.6, FL + 1.62, LZ0 + 0.4, LZ0 + 0.43, { shadow: false });
  bx(K, M.steel, 14.85, 20.35, FL + 2.05, FL + 2.6, LZ0, LZ0 + 1.15);
  bx(K, M.steelTop, 14.85, 20.35, FL + 2.0, FL + 2.05, LZ0 + 0.95, LZ0 + 1.15);
  bx(K, M.steel, 15.2, 20.0, FL + 2.6, CEIL, LZ0, LZ0 + 0.5);              // the duct up
  for (const x of [16.1, 17.6, 19.1]) bx(K, M.fluor, x - 0.35, x + 0.35, FL + 2.035, FL + 2.045, LZ0 + 0.55, LZ0 + 0.75, { shadow: false });

  /* ---- the dry store (east of the yard door): two wire shelf units */
  K.solid(24.75, Z0 + 0.25, 2.1, 0.5, 1.9, { y: FL, pen: 2 });
  {
    const R = rnd(4711);
    for (const ux of [24.2, 25.3]) {
      for (const dx of [-0.48, 0.48]) for (const dz of [0.03, 0.47]) bx(K, M.chrome, ux + dx - 0.015, ux + dx + 0.015, FL, FL + 1.9, Z0 + dz - 0.015, Z0 + dz + 0.015);
      for (let s = 0; s < 4; s++) {
        const y = FL + 0.15 + s * 0.55;
        bx(K, M.chrome, ux - 0.5, ux + 0.5, y, y + 0.02, Z0, Z0 + 0.5);
        if (s === 0) {   // a sack of flour, a sack of rice
          for (const [dx, col] of [[-0.22, 0xece6d6], [0.22, 0xd8cdb0]]) K.add(KM.goods, place(new THREE.BoxGeometry(0.38, 0.4, 0.34, 2, 2, 2), { x: ux + dx, y: y + 0.22, z: Z0 + 0.25 }), { color: col });
          continue;
        }
        for (let x = ux - 0.42; x < ux + 0.42; x += 0.1 + R() * 0.04) {
          const kind = R();
          if (kind < 0.45) K.add(KM.goods, place(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 10), { x, y: y + 0.08, z: Z0 + 0.3 }), { color: [0xc83020, 0x2a6ac8, 0xe8b020, 0x3a9a40][Math.floor(R() * 4)] });
          else if (kind < 0.8) K.add(KM.goods, place(new THREE.BoxGeometry(0.09, 0.22 + R() * 0.1, 0.3), { x, y: y + 0.14, z: Z0 + 0.26 }), { color: [0xc8a060, 0xe8e0d0, 0x8a3020, 0x2a4a8a][Math.floor(R() * 4)] });
          else K.add(KM.goods, place(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 10), { x, y: y + 0.11, z: Z0 + 0.3 }), { color: [0xc84020, 0x6a8a2a, 0xe8c040][Math.floor(R() * 3)] });
        }
      }
    }
  }
  // kegs, out of the yard door's way
  for (const [x, z] of [[24.2, -19.8], [24.85, -19.8], [24.52, -19.2]]) {
    K.cyl(M.steel, x, FL, z, 0.28, 0.28, 0.6, 14);
    K.cyl(M.chrome, x, FL + 0.6, z, 0.06, 0.06, 0.05, 8);
    K.api.ghostBox(x, z, 0.56, 0.56, 0.6, { y: FL, pen: 3 });
  }
  // the walk-in's door: a handle and strip curtain over the frame
  bx(K, M.chrome, 28.35, 28.45, FL + 0.9, FL + 1.3, -18.07, -17.99);
  for (let x = 27.4; x < 28.4; x += 0.12) bx(K, KM.water, x, x + 0.1, FL + 0.15, FL + 2.3, -18.0, -17.995, { shadow: false });

  /* ---- the prep island: boards, knives, hotel pans, a scale; pans overhead */
  {
    const y = FL + 0.99, z = -15.5;
    bx(K, M.wood, 19.3, 19.9, y, y + 0.025, z + 0.25, z + 0.62);
    bx(K, M.wood, 21.9, 22.5, y, y + 0.025, z - 0.15, z + 0.3);
    for (let i = 0; i < 6; i++) food(K, KM, C.onion, place(new THREE.CylinderGeometry(0.03, 0.03, 0.008, 10), { x: 19.45 + i * 0.05, y: y + 0.03, z: z + 0.45, rz: 1.3 }));   // an onion going into rings
    for (let i = 0; i < 6; i++) {
      const x = 20.25 + (i % 3) * 0.36, zz = z - 0.32 + Math.floor(i / 3) * 0.36;
      bx(K, M.steelTop, x - 0.16, x + 0.16, y, y + 0.07, zz - 0.15, zz + 0.15);
      food(K, KM, [C.onion, C.tomato, C.lettuce, C.cheese, C.salsa, C.lime][i], place(new THREE.BoxGeometry(0.28, 0.012, 0.26), { x, y: y + 0.073, z: zz }));
    }
    pizza(K, KM, 22.2, y + 0.025, z + 0.06, 0.15);
    bx(K, M.steelTop, 22.6, 22.85, y, y + 0.05, z - 0.4, z - 0.15);                        // the scale
    bx(K, M.blackGloss, 22.64, 22.81, y + 0.05, y + 0.052, z - 0.36, z - 0.19);
    // the pot rack, hung from the ceiling
    const ry = FL + 2.35;
    for (const dx of [-1.3, 1.3]) for (const dz of [-0.35, 0.35]) bx(K, M.chrome, 21 + dx - 0.01, 21 + dx + 0.01, ry, CEIL, z + dz - 0.01, z + dz + 0.01, { shadow: false });
    bx(K, M.chrome, 19.65, 22.35, ry, ry + 0.03, z - 0.37, z - 0.33, { shadow: false });
    bx(K, M.chrome, 19.65, 22.35, ry, ry + 0.03, z + 0.33, z + 0.37, { shadow: false });
    for (let i = 0; i < 5; i++) {
      const x = 19.9 + i * 0.55, zz = i % 2 ? z + 0.35 : z - 0.35, r = 0.075 + (i % 3) * 0.018, mat = i === 2 ? M.blackMetal : KM.copper;
      bx(K, mat, x - 0.01, x + 0.01, ry - 0.24, ry, zz - 0.004, zz + 0.004, { shadow: false });   // the handle on its hook
      K.cyl(mat, x, ry - 0.24 - r, zz - 0.02, r * 0.8, r, 0.04, 16, { rx: Math.PI / 2 }, { shadow: false });
    }
  }

  /* ---- the dish pit (west wall, between the backstage door and the hall door) */
  {
    const DX0 = X0, DX1 = X0 + 0.75, x = (DX0 + DX1) / 2;
    K.solid(x, -15.8, 0.75, 4.7, 0.92, { y: FL, pen: 3 });
    K.solid(x, -16.6, 0.75, 0.7, 1.75, { y: FL, pen: 4 });
    bx(K, M.steel, DX0, DX1, FL, TOPY - 0.04, -18.15, -13.45);
    bx(K, M.steelTop, DX0, DX1 + 0.03, TOPY - 0.04, TOPY, -18.15, -13.45);
    bx(K, M.steelTop, DX0, DX0 + 0.04, TOPY, TOPY + 0.35, -18.15, -13.45);                 // the splash
    // the dish machine: a box with a hood that lifts
    bx(K, M.steel, DX0 + 0.04, DX1 - 0.02, TOPY, FL + 1.75, -16.92, -16.28);
    bx(K, M.chrome, DX1 - 0.04, DX1, FL + 1.25, FL + 1.28, -16.85, -16.35);
    // three bays, water in two, a gooseneck sprayer
    for (const [z, wet] of [[-15.75, true], [-15.1, true], [-14.45, false]]) {
      bx(K, M.blackMetal, DX0 + 0.1, DX1 - 0.08, TOPY - 0.002, TOPY + 0.002, z - 0.28, z + 0.28, { shadow: false });
      if (wet) bx(K, KM.water, DX0 + 0.1, DX1 - 0.08, TOPY + 0.004, TOPY + 0.006, z - 0.27, z + 0.27, { shadow: false });
    }
    K.cyl(M.chrome, DX0 + 0.12, TOPY, -15.1, 0.015, 0.015, 0.5, 8);
    K.add(M.chrome, place(new THREE.TorusGeometry(0.15, 0.012, 6, 12, Math.PI), { x: DX0 + 0.27, y: TOPY + 0.5, z: -15.1, ry: 0 }), { shadow: false });
    K.cyl(M.chrome, DX0 + 0.42, TOPY + 0.32, -15.1, 0.012, 0.012, 0.18, 8);
    // dirty racks on the landing table, clean racks on the shelf over it
    for (const [z, y, n] of [[-17.6, TOPY, 1], [-13.9, TOPY, 2], [-17.6, FL + 1.55, 1], [-15.6, FL + 1.55, 1], [-14.4, FL + 1.55, 1]]) {
      for (let k = 0; k < n; k++) {
        const yy = y + k * 0.11;
        bx(K, KM.grate, DX0 + 0.12, DX1 - 0.1, yy, yy + 0.1, z - 0.25, z + 0.25, { shadow: false });
        for (let i = 0; i < 9; i++) K.cyl(M.glassRail, DX0 + 0.2 + (i % 3) * 0.15, yy + 0.02, z - 0.16 + Math.floor(i / 3) * 0.16, 0.035, 0.03, 0.11, 8, {}, { shadow: false });
      }
    }
    bx(K, M.steelTop, DX0, DX0 + 0.45, FL + 1.53, FL + 1.55, -18.1, -13.5);                // the shelf
    K.add(KM.goods, place(new THREE.BoxGeometry(0.5, 0.15, 0.36), { x: x + 0.05, y: TOPY + 0.08, z: -17.0 }), { color: 0x3a3a40 });   // a bus tub
  }
  // the hand sink and the fire extinguisher by the hall door
  bx(K, M.steelTop, X0, X0 + 0.42, FL + 0.8, FL + 0.95, -10.45, -9.85);
  K.cyl(M.chrome, X0 + 0.08, FL + 0.95, -10.15, 0.012, 0.012, 0.2, 8);
  K.add(KM.goods, place(new THREE.BoxGeometry(0.08, 0.28, 0.12), { x: X0 + 0.05, y: FL + 1.35, z: -10.15 }), { color: 0xd8dade });   // soap
  K.cyl(KM.goods, X0 + 0.12, FL + 0.6, -10.95, 0.075, 0.075, 0.48, 12, {}, { color: 0xc01818 });
  bx(K, M.blackMetal, X0 + 0.1, X0 + 0.14, FL + 1.08, FL + 1.16, -10.99, -10.91);

  /* ---- the bar wall: the reach-ins, the 86 board, the clock, the pass */
  for (const x of [15.4, 16.25]) {
    K.solid(x, Z1 - 0.37, 0.8, 0.74, 2.0, { y: FL, pen: 3, mat: M.fridge });
    K.box(M.fridgeGlow, x, FL + 0.25, Z1 - 0.745, 0.62, 1.6, 0.01);
    // what's inside: beer, cake, garnish
    for (let s = 0; s < 3; s++) {
      const y = FL + 0.3 + s * 0.52;
      bx(K, M.chrome, x - 0.31, x + 0.31, y, y + 0.015, Z1 - 0.76, Z1 - 0.752, { shadow: false });
      for (let i = 0; i < 5; i++) {
        const xi = x - 0.24 + i * 0.12;
        if (x < 16 || s === 2) K.add(KM.goods, place(new THREE.CylinderGeometry(0.03, 0.032, 0.22, 8), { x: xi, y: y + 0.13, z: Z1 - 0.765 }), { color: s === 1 ? 0x2a7a3a : C.beer, shadow: false });
        else if (s === 1) { K.add(KM.food, place(new THREE.CylinderGeometry(0.1, 0.1, 0.11, 12, 1, false, 0, 5.2), { x: x - 0.1, y: y + 0.07, z: Z1 - 0.78 }), { color: C.cake, shadow: false }); K.add(KM.food, place(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 12, 1, false, 0, 5.2), { x: x - 0.1, y: y + 0.135, z: Z1 - 0.78 }), { color: C.frosting, shadow: false }); break; }
        else { garnish(K, KM, x, y + 0.015, Z1 - 0.84); break; }
      }
    }
    K.add(M.glassWin, place(new THREE.PlaneGeometry(0.66, 1.7), { x, y: FL + 1.05, z: Z1 - 0.742, ry: Math.PI }), { shadow: false });
    bx(K, M.chrome, x + 0.28, x + 0.31, FL + 0.8, FL + 1.4, Z1 - 0.79, Z1 - 0.75);
  }
  atlasQuad(K, KM, ATLAS.board, 18.6, FL + 1.65, Z1 - 0.02, 1.2, 1.2, Math.PI);
  atlasQuad(K, KM, ATLAS.clock, 20.2, FL + 2.55, Z1 - 0.02, 0.42, 0.42, Math.PI);
  atlasQuad(K, KM, ATLAS.plate, 22, FL + 2.85, Z1 - 0.02, 1.1, 0.275, Math.PI);           // over the door, kitchen side
  atlasQuad(K, KM, ATLAS.plate, 22, FL + 2.85, Z1 + 0.33, 1.1, 0.275, 0);                  // and the bar side
  // the pass: a counter, the heat-lamp shelf, the hatch to the bar, tickets, a bell
  {
    const P0 = 23.6, P1 = 27.3, PZ0 = Z1 - 0.7, y = FL + PASS_HATCH.lo;
    K.solid((P0 + P1) / 2, (PZ0 + Z1) / 2, P1 - P0, 0.7, PASS_HATCH.lo - 0.05, { y: FL, pen: 3, mat: M.steel });
    bx(K, M.steelTop, P0, P1, y - 0.05, y, PZ0, Z1 + 0.32);                                   // the top runs through the hatch
    K.api.ghostBox(PASS_HATCH.c, -9, PASS_HATCH.w, 0.3, PASS_HATCH.hi - PASS_HATCH.lo, { y: FL + PASS_HATCH.lo, pen: 0.4 });   // nobody climbs through
    bx(K, M.steelTop, P0, P1, FL + 1.95, FL + 1.98, PZ0 + 0.05, Z1);                          // the heat-lamp shelf
    for (const x of [24.4, 25.5, 26.6]) {
      K.cyl(M.blackMetal, x, FL + 1.75, PZ0 + 0.35, 0.09, 0.05, 0.2, 12, {}, { shadow: false });
      K.cyl(KM.lamp, x, FL + 1.745, PZ0 + 0.35, 0.07, 0.07, 0.01, 12, {}, { shadow: false });
    }
    // the warm pool the lamps throw on the pass
    K.add(KM.pool, place(new THREE.PlaneGeometry(3.4, 0.55), { x: (P0 + P1) / 2, y: y + 0.002, z: PZ0 + 0.35, rx: -Math.PI / 2 }), { shadow: false });
    bx(K, M.chrome, P0, P1, FL + 1.9, FL + 1.93, PZ0 + 0.02, PZ0 + 0.06);                      // the ticket rail
    for (let i = 0; i < 4; i++) atlasQuad(K, KM, ATLAS.ticket, 24.0 + i * 0.6, FL + 1.78, PZ0 + 0.01, 0.13, 0.26, Math.PI);
    K.cyl(M.gold, 23.85, y, PZ0 + 0.15, 0.04, 0.045, 0.02, 12);
    K.add(M.gold, place(new THREE.SphereGeometry(0.035, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), { x: 23.85, y: y + 0.02, z: PZ0 + 0.15 }));
    // up and waiting: the order on the ticket
    burgerBasket(K, KM, 24.3, y, PZ0 + 0.35, 0.2);
    burgerBasket(K, KM, 24.75, y, PZ0 + 0.4, -0.1);
    wings(K, KM, 25.4, y, PZ0 + 0.35);
    nachos(K, KM, 26.1, y, PZ0 + 0.4);
    pizza(K, KM, 26.75, y, PZ0 + 0.32, 0.17);
    bottles(K, KM, 23.75, y, PZ0 + 0.55);
  }
  // more on the go: sliders and tacos on the island, wings and a pizza by the line
  sliders(K, KM, 20.6, FL + 0.99, -14.95);
  tacos(K, KM, 21.6, FL + 0.99, -15.0);
  garnish(K, KM, 19.8, FL + 0.99, -16.0);

  /* ---- details: the wet floor cone, a mop bucket, a knife magnet */
  {
    const x = 22.2, z = -12.2, y = FL;
    const g = new THREE.ConeGeometry(0.2, 0.62, 4, 1, true);
    K.add(KM.goods, place(g, { x, y: y + 0.31, z, ry: Math.PI / 4 }), { color: 0xf2c81a });
    for (const ry of [0, Math.PI]) atlasQuad(K, KM, ATLAS.wet, x + Math.sin(ry) * 0.12, y + 0.3, z + Math.cos(ry) * 0.12, 0.18, 0.3, ry, ry ? 0.33 : -0.33);
    K.add(KM.goods, place(new THREE.CylinderGeometry(0.22, 0.18, 0.34, 12), { x: 26.6, y: y + 0.17, z: -16.4 }), { color: 0xe8b818 });
    bx(K, M.chrome, 26.58, 26.62, y + 0.3, y + 1.4, -16.35, -16.31);
    bx(K, M.blackMetal, X0, X0 + 0.03, FL + 1.35, FL + 1.4, -12.0 - 1.8, -12.0 - 1.2);
  }

  /* ---- light: troffers (a chrome frame, a bright lens) in place of the battens */
  for (const z of [-12.5, -18.2]) for (const x of [17.6, 21, 24.4]) {
    bx(K, M.chrome, x - 0.66, x + 0.66, CEIL - 0.06, CEIL, z - 0.34, z + 0.34, { shadow: false });
    bx(K, KM.diffuser, x - 0.6, x + 0.6, CEIL - 0.065, CEIL - 0.055, z - 0.28, z + 0.28, { shadow: false });
  }
  ctx.staffSigns();

  /* ---- plated up in the bar: the kitchen feeds the club */
  const HT = FL + 1.06;
  burgerBasket(K, KM, 18.05, HT, -5.0, 0.5);
  wings(K, KM, 21.45, HT, 3.5);
  nachos(K, KM, 18.0, HT, 6.0);

  return swingDoors(ctx.root, KM, FL);
}

/* ------------------------------------------------------------ the doors */

/* One leaf: a stainless door with a round porthole and a kick plate, built
   along its pivot's +X from the hinge, merged into one mesh (KM.leaf). */
function leafGeometry(w, h) {
  const parts = [];
  const add = (geo, color, o) => {
    place(geo, o);
    const g = geo.index ? geo.toNonIndexed() : geo;
    const c = new THREE.Color(color), n = g.attributes.position.count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute("color", new THREE.Float32BufferAttribute(arr, 3));
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    parts.push(g);
  };
  const t = 0.045;
  add(new THREE.BoxGeometry(w - 0.02, h, t), 0x8a8e96, { x: w / 2, y: h / 2 });
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(w - 0.08, 0.3, 0.006), 0xd4d8de, { x: w / 2, y: 0.17, z: s * (t / 2 + 0.003) });          // kick plate
    add(new THREE.CircleGeometry(0.16, 20), 0x0c141c, { x: w / 2, y: 1.55, z: s * (t / 2 + 0.004), ry: s > 0 ? 0 : Math.PI });   // the porthole
    add(new THREE.TorusGeometry(0.165, 0.018, 6, 20), 0xd8dce2, { x: w / 2, y: 1.55, z: s * (t / 2 + 0.006) });
    add(new THREE.BoxGeometry(0.05, 0.36, 0.012), 0xd4d8de, { x: w - 0.16, y: 1.05, z: s * (t / 2 + 0.008) });           // push plate
  }
  add(new THREE.BoxGeometry(0.025, h, t + 0.01), 0x2a2c30, { x: w - 0.0125, y: h / 2 });                                  // the rubber edge
  const g = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return g;
}

/* The two doorways with leaves. `along`: the axis the opening runs along
   (its wall's line); the leaves hang on its two ends. */
const DOORS = [
  { id: "bar", x: 22, z: -9, along: "x", w: 2.0 },
  { id: "hall", x: 14, z: -12, along: "z", w: 2.0 },
];

function swingDoors(root, KM, FL) {
  const out = [];
  for (const d of DOORS) {
    const leafW = d.w / 2 - 0.01;
    const geo = leafGeometry(leafW, 2.2);
    const leaves = [];
    for (const e of [-1, 1]) {
      const pivot = new THREE.Group();
      const hx = d.along === "x" ? d.x + e * d.w / 2 : d.x, hz = d.along === "z" ? d.z + e * d.w / 2 : d.z;
      pivot.position.set(hx, FL + 0.03, hz);
      // the leaf points from its hinge to the middle of the doorway
      const dir = d.along === "x" ? [-e, 0] : [0, -e];
      const base = Math.atan2(-dir[1], dir[0]);               // three.js: local +X -> (cos r, -sin r) in (x, z)
      // which way a positive swing goes, along the doorway's normal (+z for an x door, +x for a z door)
      const probe = base + 0.1, nx = Math.cos(probe), nz = -Math.sin(probe);
      const sgn = (d.along === "x" ? nz : nx) > 0 ? 1 : -1;
      pivot.rotation.y = base;
      const m = new THREE.Mesh(geo, KM.leaf);
      m.castShadow = false;
      pivot.add(m);
      root.add(pivot);
      leaves.push({ pivot, base, sgn });
    }
    out.push({ ...d, y: FL, leaves, ang: 0, vel: 0, side: 0, hold: 0, wasOpen: false });
  }
  return out;
}

/* ------------------------------------------------------------ the light */

/* The backstage light hops into the kitchen while the camera's in there. */
const HOMES = {
  back: { x: 0, y: 3.5, z: -19.5, color: 0xd8e8ff, power: 12, range: 22 },
  kitchen: { x: 21.5, y: 3.6, z: -15.5, color: 0xfff1de, power: 26, range: 17 },
};
export function hopBackLight(S, cam) {
  const L = S.backLight;
  if (!L) return;
  const inKitchen = cam.x > 14 && cam.z < -9 && cam.z > -22.2 && cam.x < 30.2 && cam.y < 4.4;
  const want = inKitchen ? "kitchen" : "back";
  if (L.at === want) return;
  L.at = want;
  const h = HOMES[want];
  L.l.position.set(h.x, h.y, h.z);
  L.l.color.setHex(h.color);
  L.l.distance = h.range;
  L.base = h.power;
}
