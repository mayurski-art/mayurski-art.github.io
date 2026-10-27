// Troll Forces — Troll City: the town hall, closing the east end of Main
// Street (doc "Troll City redesign in Roblox Studio", the town hall; it
// replaces the courthouse).
//
// 24 x 32 m of pink brick with cream pilasters and cornices, two storeys
// (the ground floor at 0.3 m, upstairs at 4.5 m like the saloon's), a
// six-column portico with the speech balcony on top and bunting, a clock
// tower on the town hall's line (x 92) with a trollface on every dial, a
// copper-green dome and the striped flag. Inside, the ground floor: the
// front hall (the clerk's counter, the stairs up), the clerk's office
// (north front), the sheriff's office (south front, its own SHERIFF door),
// the jail behind it (four cells along the east wall) and the courtroom
// (north back, open up through both storeys). Upstairs: the council
// chamber, its doors onto the balcony; the rest of the upstairs is shut.
// Out front, the founder's plaza.
//
// Drawn by code after the Studio town, like the chapel (trollcity-chapel.js):
// its own Kit, every piece and collider live, never moved by a Studio
// model. trollcity.js hands its helpers in (H) and the sheriff's and the
// jail's RP objects, which this fills: the badge on the desk, the wanted
// board, the cells and their doors.

import * as THREE from "three";
import { Kit, place, prismGeo, surfMat, canvasTex, texMat, rng, chair as kitChair, chandelier, hitchRail, bollard, streetLamp, sconce } from "./trollcity-kit.js?v=tc2-wst-tc3-sh1-sr1-pf1-or1-tcs1-tx1-ch1-sp1-kbt1-pm1-ss1-ss2-ss3-tfm2-ugb1";
import { floorTexture } from "./chapel-art.js?v=ca1-tcs1";
import { buildJailWall, BREACH } from "./trollcity-jailwall.js?v=jb1-jb3-jb6-sp1";

export const HALL = { x0: 80, x1: 104, z0: -16, z1: 16, top: 8.5 };
const T = 0.3;                                  // wall thickness
const XB = 92;                                  // the back rooms' wall: the town hall's line
const ZJ = 2;                                   // the courtroom's south wall, the jail beyond
const ZC = -6, ZS = 6;                          // the front hall between the clerk's office and the sheriff's
const PORT = { x0: 77, col: 77.5, z: [-6, -3.6, -1.2, 1.2, 3.6, 6], half: 7.2 };
const STAIR = { x: 84.6, z: -5.2, w: 1.1, steps: 14, run: 0.3 };
const CELLS = { x: 98.6, edges: [ZJ + T / 2, 5.5, 8.85, 12.2, HALL.z1 - T] };
// cell i's inside, between its dividers, and where its weak patch sits (beside the bunk)
const cellSpan = (i) => {
  const z0 = CELLS.edges[i] + (i ? 0.125 : 0), z1 = CELLS.edges[i + 1] - (i < 3 ? 0.125 : 0);
  return { z0, z1, zc: (z0 + z1) / 2, breach: (z0 + z1) / 2 + 0.75 };
};
export const PLAZA = { x0: 64, x1: 76, z0: -9.6, z1: 9.6 };
// the clerk's office's three Troll-o-Graphs (made in Studio: Props/TrollOGraph_*),
// backs to its south wall: hold X in front of one (modes/social-computers.js).
// trolltruths.com lets itself be framed, so it opens in the game; OpenSea and
// trollface.io refuse (X-Frame-Options DENY), so theirs open in a new tab.
export const COMPUTERS = [
  { key: "trolltruths", name: "TrollTruths", url: "https://trolltruths.com", frame: true, x: 85, z: -7.45, floor: 0.3 },
  { key: "opensea", name: "OpenSea: TROLLS", url: "https://opensea.io/collection/trollsoneth", frame: false, x: 87, z: -7.45, floor: 0.3 },
  { key: "trollface", name: "trollface.io", url: "https://trollface.io", frame: false, x: 89, z: -7.45, floor: 0.3 },
  // and in the front hall, against the sheriff's wall: the donation kiosk (Props/DonationKiosk_1),
  // the home page's Donate wallet, in a new tab like the two above
  { key: "donate", name: "Donate", title: "Donation kiosk", label: "Donate to the Troll Runner wallet", url: "https://finance.trollrunner.net", frame: false,
    note: "Tips go to the Troll Runner wallet, on its own page in a new tab. The game keeps running here.", x: 84.45, z: 4.6, floor: 0.3 },
];

/* Build it into `root`, after the town. H = { wall, railing, wallPic, sign,
   signBoard, slabWithHole, stove, rifleRack, counter, FLOOR, UPPER_Y,
   sheriff, jail } (sheriff and jail: trollcity.js's RP objects, filled here).
   Returns its seats (rp.seats), where Sheriff Grimes and Deputy Doofus
   stand, and the stair link. */
export function buildHall(api, root, M, H) {
  const { wall, railing, wallPic, sign, signBoard, slabWithHole, stove, rifleRack, counter, FLOOR: F, UPPER_Y: U } = H;
  const c0 = api.colliders.length;
  const K = new Kit(api, root);
  const add0 = K.add;
  K.add = (mat, geo, o = {}) => add0.call(K, mat, geo, { ...o, live: true });
  const C = HALL, R = rng(1869);
  const IN = { x0: C.x0 + T, x1: C.x1 - T, z0: C.z0 + T, z1: C.z1 - T };
  const HM = {
    brick: surfMat("brick", 0xe8907c, { mix: 0.5, tile: 2.2, bounce: 0.14 }),
    // louvred shutters, painted on (a box a slat was 11k triangles)
    shutter: texMat(canvasTex(64, 256, (g, W, Hh) => {
      g.fillStyle = "#2c4a36"; g.fillRect(0, 0, W, Hh);
      g.fillStyle = "#1a2c20"; g.fillRect(0, 0, W, 8); g.fillRect(0, Hh - 8, W, 8); g.fillRect(0, 0, 6, Hh); g.fillRect(W - 6, 0, 6, Hh);
      for (let y = 14; y < Hh - 10; y += 12) { g.fillStyle = "#1e3226"; g.fillRect(6, y, W - 12, 4); g.fillStyle = "#3c5e46"; g.fillRect(6, y + 4, W - 12, 2); }
    }), { rough: 0.8 }),
    lit: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xe8c890).multiplyScalar(0.85) }),
    checker: texMat(floorTexture(), { tile: 1.6, rough: 0.55 }),
    oak: surfMat("wood", 0x8a5634, { mix: 0.3, tile: 1, bounce: 0.25 }),
    green: new THREE.MeshStandardMaterial({ color: 0x2e5a3a, roughness: 0.9 }),
    pigeon: texMat(canvasTex(256, 256, (g, W, Hh) => {
      g.fillStyle = "#3a2618"; g.fillRect(0, 0, W, Hh);
      const r = rng(7);
      for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
        const x = 6 + i * 41.5, y = 6 + j * 41.5;
        g.fillStyle = "#1c120a"; g.fillRect(x, y, 36, 36);
        // papers, rolled and flat
        if (r() < 0.75) { g.fillStyle = ["#e8dcc0", "#d8c8a0", "#f0e8d8"][Math.floor(r() * 3)]; g.fillRect(x + 3, y + 14 + r() * 8, 30, 10 + r() * 10); }
        if (r() < 0.3) { g.fillStyle = "#c8b890"; g.beginPath(); g.arc(x + 18, y + 26, 7, 0, Math.PI * 2); g.fill(); }
      }
    }), { rough: 0.9 }),
    townMap: texMat(canvasTex(512, 384, (g, W, Hh) => {
      g.fillStyle = "#e8dcbc"; g.fillRect(0, 0, W, Hh);
      g.strokeStyle = "#5a3a20"; g.lineWidth = 6; g.strokeRect(8, 8, W - 16, Hh - 16);
      // the town, x -124..124 across, z -55..145 down
      const X = (x) => 24 + ((x + 124) / 248) * (W - 48), Z = (z) => 40 + ((z + 55) / 200) * (Hh - 64);
      g.fillStyle = "#c8a878";
      g.fillRect(X(-110), Z(-7), X(80) - X(-110), Z(7) - Z(-7));          // Main Street
      g.fillRect(X(-102), Z(60), X(82) - X(-102), Z(72) - Z(60));         // Second Street
      for (const [a, b] of [[-23, -13], [56, 66], [-82, -72]]) g.fillRect(X(a), Z(7), X(b) - X(a), Z(60) - Z(7));
      g.strokeStyle = "#7a5a3a"; g.lineWidth = 2;
      g.beginPath(); g.ellipse(X(-114) + (X(114) - X(-114)) / 2, Z(-30) + (Z(155) - Z(-30)) / 2, (X(114) - X(-114)) / 2, (Z(155) - Z(-30)) / 2, 0, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "#a83a2a"; g.fillRect(X(80), Z(-16), X(104) - X(80), Z(16) - Z(-16));
      g.fillStyle = "#6a6a7a"; g.fillRect(X(77), Z(60), X(104) - X(77), Z(72) - Z(60));
      g.fillStyle = "#2a1a10"; g.textAlign = "center";
      g.font = "bold 30px serif"; g.fillText("TROLL CITY", W / 2, 34);
      g.font = "14px serif";
      g.fillText("Main Street", X(-40), Z(0) + 5);
      g.fillText("Second Street", X(-40), Z(66) + 5);
      g.fillText("you are here", X(92), Z(-16) - 6);
    }), { rough: 0.9, decal: true }),
  };
  const seats = [];
  const chairAt = (x, y, z, ry, kind = "chair") => {
    kitChair(K, M, x, y, z, { ry });
    seats.push({ x, z, y: y + 0.47, floor: y, yaw: ry, kind, stand: { x, z } });
  };
  // a bench's seats, `n` of them along its length, facing `yaw`, got up from `out` in front
  const benchAt = (x, z, len, axis, y, yaw, floor, out = 0.7) => {
    const n = Math.max(1, Math.floor(len / 0.7));
    for (let i = 0; i < n; i++) {
      const u = (i - (n - 1) / 2) * (len / n);
      const sx = axis === "x" ? x + u : x, sz = axis === "z" ? z + u : z;
      seats.push({ x: sx, z: sz, y, floor, yaw, kind: "bench", stand: { x: sx - Math.sin(yaw) * out, z: sz - Math.cos(yaw) * out } });
    }
  };

  /* ---- floors: the ground floor a step up off the street, the hall tiled */
  K.solid((C.x0 + C.x1) / 2, 0, C.x1 - C.x0 - 2 * T, C.z1 - C.z0 - 2 * T, F, { mat: M.floor });
  K.add(HM.checker, place(new THREE.PlaneGeometry(XB - T / 2 - IN.x0, ZS - ZC - T), { x: (IN.x0 + XB - T / 2) / 2, y: F + 0.012, z: 0, rx: -Math.PI / 2 }), { shadow: false });
  // the upstairs floor: over the front rooms (the stair's hole in it) and over the jail
  slabWithHole(K, { x0: IN.x0, x1: XB - T / 2, z0: IN.z0, z1: IN.z1, y: U - 0.3, h: 0.3, mat: M.ceiling,
    hole: { x0: STAIR.x, x1: STAIR.x + STAIR.run * STAIR.steps + 0.1, z0: ZC + T / 2, z1: STAIR.z + STAIR.w / 2 + 0.05 } });
  K.solid((XB + T / 2 + IN.x1) / 2, (ZJ + T / 2 + IN.z1) / 2, IN.x1 - XB - T / 2, IN.z1 - ZJ - T / 2, 0.3, { y: U - 0.3, mat: M.ceiling });
  K.add(M.rug, place(new THREE.PlaneGeometry(6.4, 2.6), { x: 86.2, y: U + 0.008, z: 0, rx: -Math.PI / 2 }), { shadow: false });

  /* ---- the outer walls: windows (W) cut through, false ones (fake) painted on */
  const win = (c, w = 1.2, lo = 1.2, hi = 3.4) => ({ c, w, spans: [[lo, hi]] });
  const door = (c, w, h) => ({ c, w, spans: [[0, h]] });
  const outer = { t: T, mat: HM.brick, trim: M.trimCream, sill: F };
  const upper = { t: T, mat: HM.brick, trim: M.trimCream, y: U, h: C.top - U };
  const GW = 1.2, UW = 1.1;                     // window widths, ground and upstairs
  // ground storey: 0 .. U
  wall(K, M, { ...outer, h: U, axis: "z", at: C.x0 + T / 2, a: IN.z0, b: ZC, out: -1, lining: M.damask, holes: [win(-13), win(-9)] });
  wall(K, M, { ...outer, h: U, axis: "z", at: C.x0 + T / 2, a: ZC, b: ZS, out: -1, lining: M.damaskGreen, holes: [win(-2.6), door(0, 2.4, 3.6), win(2.6)] });
  wall(K, M, { ...outer, h: U, axis: "z", at: C.x0 + T / 2, a: ZS, b: IN.z1, out: -1, lining: M.damaskGreen, holes: [win(13)] });
  wall(K, M, { ...outer, h: U, axis: "x", at: C.z0 + T / 2, a: C.x0, b: XB, out: -1, lining: M.damask, holes: [win(84), win(88)] });
  wall(K, M, { ...outer, h: U, axis: "x", at: C.z0 + T / 2, a: XB, b: C.x1, out: -1, lining: M.damask, holes: [win(93.6, GW, 1.3, 3.5), win(102.4, GW, 1.3, 3.5)] });
  wall(K, M, { ...outer, h: U, axis: "x", at: C.z1 - T / 2, a: C.x0, b: XB, out: 1, lining: M.damaskGreen, holes: [door(84.5, 1.3, 2.8), win(89)] });
  wall(K, M, { ...outer, h: U, axis: "x", at: C.z1 - T / 2, a: XB, b: C.x1, out: 1, lining: M.brickPale, glass: false, holes: [win(94.5, 0.6, 2.6, 3.4), win(97, 0.6, 2.6, 3.4)] });
  wall(K, M, { ...outer, h: U, axis: "z", at: C.x1 - T / 2, a: IN.z0, b: ZJ, out: 1, lining: M.damask, holes: [-13, -9, -5, -1].map((c) => win(c, GW, 1.3, 3.5)) });
  const cellMid = [0, 1, 2, 3].map((i) => (CELLS.edges[i] + CELLS.edges[i + 1]) / 2);
  // the cells' back wall: a barred window each, and the gap the jailbreak's brick plug fills (trollcity-jailwall.js)
  const breaches = [0, 1, 2, 3].map((i) => ({ c: cellSpan(i).breach, w: BREACH.w, spans: [[0, BREACH.h]], bare: true }));
  wall(K, M, { ...outer, h: U, axis: "z", at: C.x1 - T / 2, a: ZJ, b: IN.z1, out: 1, lining: M.brickPale, glass: false, holes: [...cellMid.map((c) => win(c, 0.6, 2.6, 3.4)), ...breaches] });
  // upstairs: U .. top. The chamber's windows and balcony doors on the west,
  // the courtroom's high windows north and east; the shut rooms get false ones
  wall(K, M, { ...upper, axis: "z", at: C.x0 + T / 2, a: IN.z0, b: ZC, out: -1 });
  wall(K, M, { ...upper, axis: "z", at: C.x0 + T / 2, a: ZC, b: ZS, out: -1, lining: M.damaskGreen, holes: [win(-2.6, UW, 0.8, 3.0), door(0, 1.8, 3.0), win(2.6, UW, 0.8, 3.0)] });
  wall(K, M, { ...upper, axis: "z", at: C.x0 + T / 2, a: ZS, b: IN.z1, out: -1 });
  wall(K, M, { ...upper, axis: "x", at: C.z0 + T / 2, a: C.x0, b: XB, out: -1 });
  wall(K, M, { ...upper, axis: "x", at: C.z0 + T / 2, a: XB, b: C.x1, out: -1, lining: M.damask, holes: [win(93.6, GW, 0.5, 2.9), win(102.4, GW, 0.5, 2.9)] });
  wall(K, M, { ...upper, axis: "x", at: C.z1 - T / 2, a: C.x0, b: C.x1, out: 1 });
  wall(K, M, { ...upper, axis: "z", at: C.x1 - T / 2, a: IN.z0, b: ZJ, out: 1, lining: M.damask, holes: [-13, -9, -5, -1].map((c) => win(c, GW, 0.5, 2.9)) });
  wall(K, M, { ...upper, axis: "z", at: C.x1 - T / 2, a: ZJ, b: IN.z1, out: 1 });

  // shutters either side of a window, out on the face; `shut` closes them over it
  const face = (axis, o) => (axis === "x" ? (o < 0 ? C.z0 : C.z1) : (o < 0 ? C.x0 : C.x1));
  const shutters = (axis, o, c, lo, hi, w, shut = false) => {
    const at = face(axis, o) + o * 0.035, X = axis === "x";
    const sw = shut ? w / 2 : 0.5;
    for (const s of [-1, 1]) {
      const u = shut ? c + s * w / 4 : c + s * (w / 2 + 0.14 + sw / 2);
      K.box(HM.shutter, X ? u : at, lo, X ? at : u, X ? sw - 0.02 : 0.05, hi - lo, X ? 0.05 : sw - 0.02, {}, { shadow: false });
    }
  };
  // a round head over a window: a cream arch, the half-moon light under it
  const head = (axis, o, c, hi, w, fill) => {
    const at = face(axis, o) + o * 0.03, ry = axis === "x" ? (o > 0 ? 0 : Math.PI) : (o > 0 ? Math.PI / 2 : -Math.PI / 2);
    const [x, z] = axis === "x" ? [c, at] : [at, c];
    K.add(fill, place(new THREE.CircleGeometry(w / 2, 12, 0, Math.PI), { x, y: hi + 0.08, z, ry }), { shadow: false });
    K.add(M.trimCream, place(new THREE.RingGeometry(w / 2 + 0.02, w / 2 + 0.2, 12, 1, 0, Math.PI), { x, y: hi + 0.08, z, ry }), { shadow: false });
    K.box(M.trimCream, x, hi + 0.08 + w / 2 + 0.05, z, axis === "x" ? 0.22 : 0.12, 0.26, axis === "x" ? 0.12 : 0.22);   // the keystone
  };
  // a false window: lit glass painted on, the frame, a sill, the shutters
  const fake = (axis, o, c, lo, hi, w, { shut = false, arch = true } = {}) => {
    const at = face(axis, o) + o * 0.02, X = axis === "x";
    const ry = X ? (o > 0 ? 0 : Math.PI) : (o > 0 ? Math.PI / 2 : -Math.PI / 2);
    K.add(HM.lit, place(new THREE.PlaneGeometry(w, hi - lo), { x: X ? c : at, y: (lo + hi) / 2, z: X ? at : c, ry }), { shadow: false });
    K.box(M.trimDark, X ? c : at, lo, X ? at : c, X ? 0.04 : 0.03, hi - lo, X ? 0.03 : 0.04, {}, { shadow: false });
    K.box(M.trimDark, X ? c : at, (lo + hi) / 2, X ? at : c, X ? w : 0.03, 0.04, X ? 0.03 : w, {}, { shadow: false });
    for (const s of [-1, 1]) K.box(M.trimCream, X ? c + s * (w / 2 + 0.05) : at, lo, X ? at : c + s * (w / 2 + 0.05), X ? 0.12 : 0.06, hi - lo, X ? 0.06 : 0.12);
    K.box(M.trimCream, X ? c : at + o * 0.04, lo - 0.08, X ? at + o * 0.04 : c, X ? w + 0.3 : 0.14, 0.09, X ? 0.14 : w + 0.3);
    shutters(axis, o, c, lo, hi, w, shut);
    if (arch) head(axis, o, c, hi, w, HM.lit);
  };
  // the real windows' shutters and round heads
  for (const c of [-13, -9, -2.6, 2.6, 13]) { shutters("z", -1, c, 1.2, 3.4, GW); head("z", -1, c, 3.4, GW, M.glass); }
  for (const c of [-2.6, 2.6]) { shutters("z", -1, c, U + 0.8, U + 3.0, UW); head("z", -1, c, U + 3.0, UW, M.glass); }
  for (const c of [84, 88]) { shutters("x", -1, c, 1.2, 3.4, GW); head("x", -1, c, 3.4, GW, M.glass); }
  for (const c of [93.6, 102.4]) {
    shutters("x", -1, c, 1.3, 3.5, GW); head("x", -1, c, 3.5, GW, M.glass);
    shutters("x", -1, c, U + 0.5, U + 2.9, GW); head("x", -1, c, U + 2.9, GW, M.glass);
  }
  shutters("x", 1, 89, 1.2, 3.4, GW); head("x", 1, 89, 3.4, GW, M.glass);
  for (const c of [-13, -9, -5, -1]) {
    shutters("z", 1, c, 1.3, 3.5, GW); head("z", 1, c, 3.5, GW, M.glass);
    shutters("z", 1, c, U + 0.5, U + 2.9, GW); head("z", 1, c, U + 2.9, GW, M.glass);
  }
  // the false ones: the sheriff's west wall (shuttered, his wanted board's behind it) and the shut upstairs
  fake("z", -1, 9, 1.2, 3.4, GW, { shut: true, arch: false });
  for (const c of [-13, -9, 9, 13]) fake("z", -1, c, U + 0.8, U + 3.0, UW);
  for (const c of [84, 88]) fake("x", -1, c, U + 0.8, U + 3.0, UW);
  for (const c of [84, 89, 95.5, 100.5]) fake("x", 1, c, U + 0.8, U + 3.0, UW);
  for (const c of [6, 12]) fake("z", 1, c, U + 0.8, U + 3.0, UW);
  // bars in the jail's high windows
  for (const c of [94.5, 97]) K.add(M.bars, place(new THREE.PlaneGeometry(0.6, 0.8), { x: c, y: 3.0, z: C.z1 - T / 2 }), { shadow: false });
  for (const c of cellMid) K.add(M.bars, place(new THREE.PlaneGeometry(0.6, 0.8), { x: C.x1 - T / 2, y: 3.0, z: c, ry: Math.PI / 2 }), { shadow: false });

  /* ---- the brickwork's dressings: plinth, pilasters, string course, cornice, parapet */
  const ring = (mat, y, h, p, d = p + 0.05) => {
    const x0 = C.x0 - p, x1 = C.x1 + p, z0 = C.z0 - p, z1 = C.z1 + p;
    K.box(mat, (x0 + x1) / 2, y, z0 + d / 2, x1 - x0, h, d);
    K.box(mat, (x0 + x1) / 2, y, z1 - d / 2, x1 - x0, h, d);
    K.box(mat, x0 + d / 2, y, (z0 + z1) / 2, d, h, z1 - z0 - 2 * d);
    K.box(mat, x1 - d / 2, y, (z0 + z1) / 2, d, h, z1 - z0 - 2 * d);
  };
  ring(M.stone, 0, 0.6, 0.08);
  ring(M.trimCream, U - 0.2, 0.25, 0.1);
  ring(M.trimCream, C.top - 0.1, 0.45, 0.35);
  ring(HM.brick, C.top + 0.35, 0.6, -0.02, T + 0.04);
  ring(M.trimCream, C.top + 0.95, 0.15, 0.06, T + 0.16);
  const pil = (x, z, w, d) => K.box(M.trimCream, x, 0.6, z, w, C.top - 0.7, d);
  for (const z of [C.z0, -7.6, 7.6, C.z1]) pil(C.x0 - 0.04, z + (z === C.z0 ? 0.3 : z === C.z1 ? -0.3 : 0), 0.2, 0.6);
  for (const x of [C.x0 + 0.3, XB, C.x1 - 0.3]) for (const z of [C.z0 - 0.04, C.z1 + 0.04]) pil(x, z, 0.6, 0.2);
  for (const z of [C.z0 + 0.3, ZJ, C.z1 - 0.3]) pil(C.x1 + 0.04, z, 0.2, 0.6);
  // the roof: flat behind the parapet, tin on top
  K.solid((C.x0 + C.x1) / 2, 0, C.x1 - C.x0, C.z1 - C.z0, 0.3, { y: C.top, mat: M.ceiling });
  K.add(M.roofTin, place(new THREE.PlaneGeometry(C.x1 - C.x0 - 2 * T, C.z1 - C.z0 - 2 * T), { x: (C.x0 + C.x1) / 2, y: C.top + 0.31, z: 0, rx: -Math.PI / 2 }), { shadow: false });

  /* ---- the portico: six columns two storeys tall, the balcony on top, the pediment */
  {
    const P = PORT, zl = P.half * 2;
    K.solid((P.x0 + C.x0) / 2, 0, C.x0 - P.x0, zl, F, { mat: M.stone, pen: 8 });
    K.solid(P.x0 - 0.5, 0, 1.0, zl, 0.15, { mat: M.stone, pen: 8 });
    for (const z of P.z) {
      K.solid(P.col, z, 0.55, 0.55, C.top - 0.5 - F, { y: F, pen: 6 });
      K.cyl(M.trimCream, P.col, F + 0.3, z, 0.25, 0.29, C.top - 0.5 - F - 0.6, 16);
      K.box(M.trimCream, P.col, F, z, 0.72, 0.3, 0.72);
      K.box(M.trimCream, P.col, C.top - 0.8, z, 0.72, 0.3, 0.72);
    }
    // the balcony: a deck at the upstairs floor, a white railing between the
    // columns, bunting fans hung off it
    K.solid((P.x0 + C.x0) / 2, 0, C.x0 - P.x0, zl, 0.3, { y: U - 0.3, mat: M.trimCream, pen: 8 });
    railing(K, M, { axis: "z", at: P.col, a: -P.half, b: P.half, y: U, mat: M.trimCream });
    for (const s of [-1, 1]) railing(K, M, { axis: "x", at: s * (P.half - 0.05), a: P.x0, b: C.x0, y: U, mat: M.trimCream });
    for (let i = 0; i < P.z.length - 1; i++) {
      const z = (P.z[i] + P.z[i + 1]) / 2;
      [[0.78, M.flagRed], [0.56, M.flagWhite], [0.34, M.flagBlue]].forEach(([r, mat], k) => {
        K.add(mat, place(new THREE.CircleGeometry(r, 14, Math.PI, Math.PI), { x: P.col - 0.08 - k * 0.006, y: U + 1.0, z, ry: -Math.PI / 2 }), { shadow: false });
      });
    }
    // the entablature, the TOWN HALL frieze, the pediment and its roundel
    const ex0 = P.x0 - 0.1, ex1 = C.x0 + 0.2, exm = (ex0 + ex1) / 2;
    K.box(M.trimCream, exm, C.top - 0.5, 0, ex1 - ex0, 0.65, zl + 0.6);
    wallPic(K, sign("TOWN HALL", "Troll City · est. 1869", { bg: "#efe6d4", fg: "#2a2a2a", edge: "#2a2a2a" }), { x: ex0, y: C.top - 0.17, z: 0, w: 6.4, h: 0.55, o: -1, axis: "z" });
    K.add(M.trimCream, place(prismGeo([[-(P.half + 0.3), 0], [P.half + 0.3, 0], [0, 2.1]], ex1 - ex0), { x: exm, y: C.top + 0.15, z: 0, ry: Math.PI / 2 }));
    K.add(M.trollGold, place(new THREE.CircleGeometry(0.62, 24), { x: ex0 - 0.02, y: C.top + 0.85, z: 0, ry: -Math.PI / 2 }), { shadow: false });
    K.add(M.trimDark, place(new THREE.TorusGeometry(0.66, 0.06, 6, 24), { x: ex0 - 0.03, y: C.top + 0.85, z: 0, ry: -Math.PI / 2 }));
    // the doors' fanlight, and a lamp either side of them
    head("z", -1, 0, 3.6, 2.4, M.glass);
    for (const s of [-1, 1]) sconce(K, M, C.x0 - 0.05, 2.6, s * 1.75, { ry: -Math.PI / 2 });
  }

  /* ---- the clock tower on the roof: a trollface on every dial, the belvedere, the dome */
  {
    const tx = XB, tz = 0, ty = C.top + 0.3, tw = 5, th = 4.4;
    K.solid(tx, tz, tw, tw, th, { y: ty, mat: HM.brick, pen: 10 });
    for (const [x, z] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) K.box(M.trimCream, tx + x * (tw / 2 - 0.15), ty, tz + z * (tw / 2 - 0.15), 0.4, th, 0.4);
    K.box(M.trimCream, tx, ty + th - 0.05, tz, tw + 0.5, 0.35, tw + 0.5);
    K.box(M.trimCream, tx, ty, tz, tw + 0.25, 0.3, tw + 0.25);
    for (const [dx, dz, ry] of [[-1, 0, -Math.PI / 2], [1, 0, Math.PI / 2], [0, -1, Math.PI], [0, 1, 0]]) {
      K.add(M.clock, place(new THREE.CircleGeometry(1.6, 32), { x: tx + dx * (tw / 2 + 0.03), y: ty + th / 2 + 0.2, z: tz + dz * (tw / 2 + 0.03), ry }), { shadow: false });
      K.add(M.trimDark, place(new THREE.TorusGeometry(1.64, 0.09, 6, 32), { x: tx + dx * (tw / 2 + 0.05), y: ty + th / 2 + 0.2, z: tz + dz * (tw / 2 + 0.05), ry }));
    }
    const by = ty + th + 0.3;
    K.cyl(M.trimCream, tx, by, tz, 1.45, 1.45, 1.3, 20);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      K.box(M.trimDark, tx + Math.cos(a) * 1.92, by, tz + Math.sin(a) * 1.92, 0.24, 1.3, 0.24, { ry: -a });
    }
    K.cyl(M.trimCream, tx, by + 1.3, tz, 2.15, 2.15, 0.25, 24);
    const dy = by + 1.55;
    K.add(M.copper, place(new THREE.SphereGeometry(2.0, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), { x: tx, y: dy, z: tz }));
    K.cyl(M.trimCream, tx, dy + 1.9, tz, 0.45, 0.45, 0.8, 12);
    K.add(M.copper, place(new THREE.ConeGeometry(0.55, 1.0, 12), { x: tx, y: dy + 3.2, z: tz }));
    K.cyl(M.blackIron, tx, dy + 3.6, tz, 0.04, 0.04, 3.0, 6);
    const fy = dy + 6.4;
    for (let i = 0; i < 7; i++) K.box(i % 2 ? M.flagWhite : M.flagRed, tx + 1.0, fy - i * 0.16, tz, 1.9, 0.16, 0.01, {}, { shadow: false });
    K.box(M.flagBlue, tx + 0.45, fy - 0.48, tz + 0.006, 0.8, 0.64, 0.01, {}, { shadow: false });
  }

  /* ---- inside: the partitions */
  const part = { t: T, mat: M.damaskGreen, trim: M.trimDark, sill: 0, glass: false };
  wall(K, M, { ...part, axis: "x", at: ZC, a: IN.x0, b: XB - T / 2, h: U - 0.3, holes: [door(82.4, 1.2, 2.6)] });
  wall(K, M, { ...part, axis: "x", at: ZS, a: IN.x0, b: XB - T / 2, h: U - 0.3, holes: [door(86, 1.3, 2.6)] });
  wall(K, M, { ...part, mat: M.damask, axis: "z", at: XB, a: IN.z0, b: IN.z1, h: U, holes: [door(-3, 1.8, 3.0), door(13.5, 1.3, 2.6)] });
  wall(K, M, { ...part, mat: M.damask, axis: "z", at: XB, a: IN.z0, b: IN.z1, y: U, h: C.top - U });
  wall(K, M, { ...part, mat: M.brickPale, lining: M.damask, out: 1, axis: "x", at: ZJ, a: XB + T / 2, b: IN.x1, h: C.top });
  // upstairs, the chamber's side walls
  wall(K, M, { ...part, axis: "x", at: ZC, a: IN.x0, b: XB - T / 2, y: U, h: C.top - U });
  wall(K, M, { ...part, axis: "x", at: ZS, a: IN.x0, b: XB - T / 2, y: U, h: C.top - U });

  // dark wainscot and a picture rail round a room, gaps left at its doors:
  // sides [axis, at (inner face), face (into the room), a, b, gaps]
  const wainscot = (y, sides, h = 1.1) => {
    for (const [axis, at, fc, a, b, gaps = []] of sides) {
      let s = a;
      const runsOf = [];
      for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) { if (g0 > s) runsOf.push([s, g0]); s = Math.max(s, g1); }
      if (b > s) runsOf.push([s, b]);
      for (const [p, q] of runsOf) {
        const m = (p + q) / 2, L = q - p, off = at + fc * 0.03;
        const [x, z] = axis === "x" ? [m, off] : [off, m];
        K.box(M.furniture, x, y, z, axis === "x" ? L : 0.06, h, axis === "x" ? 0.06 : L, {}, { shadow: false });
        const [rx, rz] = axis === "x" ? [m, at + fc * 0.05] : [at + fc * 0.05, m];
        K.box(M.trimDark, rx, y + h, rz, axis === "x" ? L : 0.1, 0.08, axis === "x" ? 0.1 : L, {}, { shadow: false });
      }
    }
  };
  const gap = (c, w) => [c - w / 2 - 0.12, c + w / 2 + 0.12];

  /* ---- the front hall: the clerk's counter, benches, the stairs up */
  wainscot(F, [
    ["z", IN.x0, 1, ZC + T / 2, ZS - T / 2, [gap(0, 2.4)]],
    ["z", XB - T / 2, -1, ZC + T / 2, ZS - T / 2, [gap(-3, 1.8)]],
    ["x", ZS - T / 2, -1, IN.x0, XB - T / 2, [gap(86, 1.3)]],
  ]);
  counter(K, M, { x: 90.4, z: 0.6, w: 3.4, d: 0.7, axis: "z", till: false, mat: HM.oak });
  K.cyl(M.brass, 90.4, F + 1.11, 1.9, 0.07, 0.05, 0.08, 10);        // the bell
  signBoard(K, sign("CLERK", "Licences · Deeds · Complaints (none)", { bg: "#2a3a2a", fg: "#e8d8a8", edge: "#e8d8a8", w: 768, h: 192 }), M.trimDark, { x: XB - T / 2, z: 0.6, y: 3.3, w: 2.4, h: 0.6, o: -1, axis: "z" });
  wallPic(K, M.paintPortrait, { x: XB - T / 2, y: 2.15, z: 4.2, w: 0.9, h: 1.15, o: -1, axis: "z", frame: M.trimGold });
  for (const x of [82.6, 89.4]) { K.solid(x, ZS - T / 2 - 0.3, 2.0, 0.5, 0.48, { y: F, mat: HM.oak, pen: 1 }); benchAt(x, ZS - T / 2 - 0.3, 2.0, "x", F + 0.48, 0, F); }
  chandelier(K, M, 86, U - 1.2, 1.5, { r: 0.7 });
  // the stair: 14 steps east up the clerk's wall, through the hole to the chamber
  {
    const rise = (U - F) / STAIR.steps;
    api.stairs(STAIR.x, STAIR.z, STAIR.w, STAIR.steps, rise, STAIR.run, "+x", { ghost: true, y: F });
    for (let i = 0; i < STAIR.steps; i++) {
      const x = STAIR.x + STAIR.run * (i + 0.5), top = F + rise * (i + 1);
      K.box(HM.oak, x, F, STAIR.z, STAIR.run + 0.01, top - F - 0.05, STAIR.w);
      K.box(M.trimDark, x - 0.01, top - 0.05, STAIR.z, STAIR.run + 0.03, 0.05, STAIR.w + 0.04);
    }
    const sx1 = STAIR.x + STAIR.run * STAIR.steps, zr = STAIR.z + STAIR.w / 2 + 0.03;
    const L = Math.hypot(sx1 - STAIR.x, U - F), a = Math.atan2(U - F, sx1 - STAIR.x);
    K.box(HM.oak, (STAIR.x + sx1) / 2, (F + U) / 2 + 0.9, zr, L, 0.07, 0.07, { rz: a });
    for (const t of [0.15, 0.4, 0.65, 0.9]) K.cyl(HM.oak, STAIR.x + (sx1 - STAIR.x) * t, F + (U - F) * t, zr, 0.025, 0.025, 0.9, 6);
    // round the hole upstairs
    railing(K, M, { axis: "x", at: STAIR.z + STAIR.w / 2 + 0.1, a: STAIR.x, b: sx1 - 0.6, y: U, mat: HM.oak });
    railing(K, M, { axis: "z", at: STAIR.x - 0.05, a: ZC + T / 2, b: STAIR.z + STAIR.w / 2 + 0.1, y: U, mat: HM.oak });
  }

  /* ---- the clerk's office: pigeonholes, two desks, the map of the town */
  wainscot(F, [
    ["z", IN.x0, 1, IN.z0, ZC - T / 2],
    ["x", ZC - T / 2, -1, IN.x0, XB - T / 2, [gap(82.4, 1.2)]],
  ]);
  K.solid(85, IN.z0 + 0.25, 4.8, 0.5, 2.4, { y: F, mat: M.furniture, pen: 2 });
  K.add(HM.pigeon, place(new THREE.PlaneGeometry(4.6, 2.2), { x: 85, y: F + 1.2, z: IN.z0 + 0.51 }), { shadow: false });
  wallPic(K, HM.townMap, { x: XB - T / 2, y: 2.1, z: -11, w: 2.8, h: 2.1, o: -1, axis: "z", frame: M.trimDark });
  for (const [x, z] of [[84.2, -10.2], [88.6, -12.4]]) {
    K.solid(x, z, 1.4, 0.75, 0.78, { y: F, mat: M.furniture, pen: 2 });
    K.box(M.trimDark, x, F + 0.78, z, 1.46, 0.04, 0.8);
    for (let i = 0; i < 3; i++) K.box(M.canvasCloth, x - 0.4 + i * 0.3 + R() * 0.05, F + 0.82, z + (R() - 0.5) * 0.2, 0.22, 0.01, 0.3, { ry: (R() - 0.5) * 0.4 }, { shadow: false });
    chairAt(x, F, z + 0.7, 0);
  }
  stove(K, M, IN.x0 + 0.5, ZC - T / 2 - 0.5, { top: U - 0.3 });
  chandelier(K, M, 86, U - 1.2, -11, { r: 0.6 });

  /* ---- the sheriff's office: the desk and the badge, the wanted board, the rack, the stove */
  wainscot(F, [
    ["z", IN.x0, 1, ZS + T / 2, IN.z1, [[8.6 - 1.15, 8.6 + 1.15]]],
    ["x", ZS + T / 2, 1, IN.x0, XB - T / 2, [gap(86, 1.3), [88.3, 90.7]]],
    ["x", IN.z1, -1, IN.x0, XB - T / 2, [gap(84.5, 1.3)]],
    ["z", XB - T / 2, -1, ZS + T / 2, IN.z1, [gap(13.5, 1.3)]],
  ]);
  K.add(M.rug, place(new THREE.PlaneGeometry(3.6, 2.6), { x: 85.4, y: F + 0.005, z: 10.8, rx: -Math.PI / 2 }), { shadow: false });
  chandelier(K, M, 85.6, U - 1.3, 10.8, { r: 0.7 });
  wallPic(K, M.paintPortrait, { x: XB - T / 2, y: 2.7, z: 9.4, w: 1.0, h: 1.3, o: -1, axis: "z", frame: M.trimGold });
  wallPic(K, sign("IN GRIN WE TRUST", "", { bg: "#2a3a2a", fg: "#e8d8a8", edge: "#e8d8a8", w: 1024, h: 180 }), { x: XB - T / 2 - 0.08, y: 3.45, z: 13.5, w: 2.6, h: 0.46, o: -1, axis: "z" });
  // the desk faces whoever comes in from the hall; the sheriff's chair behind it
  const desk = { x: 87.6, z: 11.0 };
  K.solid(desk.x, desk.z, 0.9, 1.8, 0.8, { y: F, pen: 2, mat: M.furniture });
  chairAt(desk.x + 0.9, F, desk.z, Math.PI / 2);
  const S = H.sheriff;
  Object.assign(S.badge, { x: desk.x - 0.2, z: desk.z - 0.45, floor: F });
  const badge = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.18), M.brass);
  plate.position.set(S.badge.x, F + 0.83, S.badge.z);
  const star = new THREE.Mesh(new THREE.CircleGeometry(0.11, 5), M.trollGold);
  star.position.set(S.badge.x, F + 0.87, S.badge.z);
  star.rotation.x = -Math.PI / 2;
  badge.add(plate, star);
  root.add(badge);
  S.setBadge = (on) => { badge.visible = on; S.badgeOn = on; };
  badge.visible = S.badgeOn !== false;
  K.box(M.furniture, desk.x - 0.48, F + 0.8, desk.z + 0.4, 0.06, 0.11, 0.62);
  K.add(sign("THE GENERAL", "", { bg: "#c89a3a", fg: "#2a1a10", edge: "#2a1a10", w: 512, h: 96 }), place(new THREE.PlaneGeometry(0.58, 0.09), { x: desk.x - 0.515, y: F + 0.86, z: desk.z + 0.4, ry: -Math.PI / 2 }), { shadow: false });
  K.cyl(M.lampGlass, desk.x + 0.15, F + 0.8, desk.z + 0.6, 0.09, 0.1, 0.28, 10, {}, { shadow: false });
  // the wanted board on the west wall (the false window outside), three posters of its own
  K.box(M.furniture, IN.x0 + 0.03, F + 1.0, 8.6, 0.04, 1.6, 2.1);
  Object.assign(S.board, { x: IN.x0 + 0.9, z: 8.6, floor: F });
  S.posters = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.74), M.wanted[i]);
    m.position.set(IN.x0 + 0.075, F + 1.8 + (i % 2) * 0.1, 8.0 + i * 0.6);
    m.rotation.y = Math.PI / 2;
    root.add(m);
    S.posters.push({ mesh: m, def: M.wanted[i] });
  }
  S.setPoster = (i, mat) => { const p = S.posters[i]; if (p) p.mesh.material = mat || p.def; };
  rifleRack(K, M, { x: 89.5, z: ZS + T / 2, axis: "x", o: 1, n: 5 });
  stove(K, M, 91.15, 7.2, { top: U - 0.3 });
  K.solid(91.5, 9.5, 0.6, 1.1, 1.4, { y: F, pen: 4, mat: M.furniture });    // the filing cabinet
  for (const x of [81.6, 87.6]) { K.solid(x, IN.z1 - 0.28, 2.0, 0.5, 0.5, { y: F, pen: 1, mat: M.furniture }); benchAt(x, IN.z1 - 0.28, 2.0, "x", F + 0.5, 0, F); }
  {
    const l = new THREE.PointLight(0xffd8a0, 9, 15, 1.8);
    l.position.set(85.6, 3.4, 10.8);
    l.castShadow = false;
    root.add(l);
  }
  // outside its own door: the SHERIFF sign, a hitching rail, a bench
  signBoard(K, sign("SHERIFF", "", { bg: "#2a2a2a", fg: "#e8c868", edge: "#e8c868", w: 512, h: 128 }), M.trimDark, { x: 84.5, z: C.z1, y: 3.35, w: 1.9, h: 0.48, o: 1 });
  sconce(K, M, 85.6, 2.4, C.z1 + 0.05, { ry: 0 });
  hitchRail(K, M, 89.4, C.z1 + 2.0, { len: 2.6 });
  K.solid(81.8, C.z1 + 0.35, 1.8, 0.45, 0.45, { pen: 1, mat: M.furniture });
  benchAt(81.8, C.z1 + 0.35, 1.8, "x", 0.45, Math.PI, 0);

  /* ---- the jail: the corridor, four cells along the east wall behind bars */
  const J = H.jail;
  J.cells.length = 0;
  {
    const cx0 = CELLS.x;
    for (let i = 0; i < 4; i++) {
      const { z0, z1, zc, breach } = cellSpan(i);
      // bars across the front, the door standing open
      const dr = { c: zc + 0.8, w: 1.0 };
      for (const [a, b] of runsOf(z0, z1, [[dr.c - dr.w / 2, dr.c + dr.w / 2]])) {
        K.add(M.bars, place(new THREE.PlaneGeometry(b - a, 2.8), { x: cx0, y: F + 1.4, z: (a + b) / 2, ry: Math.PI / 2 }), { shadow: false });
        K.api.ghostBox(cx0, (a + b) / 2, 0.08, b - a, 2.8, { y: F, pen: 0.3 });
      }
      K.add(M.bars, place(new THREE.PlaneGeometry(1.0, 2.8), { x: cx0 - 0.42, y: F + 1.4, z: dr.c + dr.w / 2 + 0.25, ry: Math.PI / 2 - 1.1 }), { shadow: false });
      // the door shut (a fist fight refused, modes/social-duel.js): its bars
      // and its collider, both put away till then
      const shut = new THREE.Mesh(new THREE.PlaneGeometry(dr.w, 2.8), M.bars);
      shut.position.set(cx0, F + 1.4, dr.c);
      shut.rotation.y = Math.PI / 2;
      shut.visible = false;
      root.add(shut);
      const c = K.api.ghostBox(cx0, dr.c, 0.12, dr.w, 2.8, { y: F, pen: 0.3 });
      const closed = c.closed = { min: c.min.clone(), max: c.max.clone() };
      const setShut = (on) => {
        shut.visible = on;
        c.min.copy(closed.min); c.max.copy(closed.max);
        if (!on) { c.min.y = -60; c.max.y = -59; }
      };
      setShut(false);
      J.cells.push({
        x: cx0 + 2.6, z: dr.c, y: F, yaw: Math.PI / 2, setShut,
        box: { x0: cx0, x1: IN.x1, z0, z1 },             // inside (modes/social-jail.js)
        out: { x: cx0 - 0.9, z: dr.c },                  // the corridor, at the door
        cot: { x: IN.x1 - 0.6, y: F + 0.58, z: zc - 0.6 },
      });
      K.box(M.blackIron, cx0, F + 2.8, zc, 0.1, 0.1, z1 - z0);
      // a cot (the bunk itself is made in Studio: Props/JailBunk_*; here only
      // its collider), a bucket, and on the back wall the jailbreak's chalk trollface
      K.api.ghostBox(IN.x1 - 0.6, zc - 0.6, 0.9, 2.0, 0.5, { y: F, pen: 1 });
      K.cyl(M.steel, cx0 + 0.8, F, zc - 1.1, 0.16, 0.14, 0.3, 10);
      J.cells[i].wall = buildJailWall(K.api, root, { x: IN.x1 - 0.022, outerX: C.x1, zc, win: { z: cellMid[i], w: 0.6, y0: 2.6, y1: 3.4 },
        breachC: breach, brick: HM.brick, lining: M.brickPale, cellZ: [z0, z1] });
    }
    for (const z of CELLS.edges.slice(1, 4)) K.solid((cx0 + IN.x1) / 2, z, IN.x1 - cx0, 0.25, U - 0.3 - F, { y: F, mat: M.brickPale });
    K.box(M.blackIron, cx0, F + 2.85, (ZJ + IN.z1) / 2, 0.14, 0.1, IN.z1 - ZJ - T / 2);
    // the corridor: the keys on their hook, a table for the deputy, a lantern
    K.add(M.brass, place(new THREE.TorusGeometry(0.13, 0.015, 6, 16), { x: XB + T / 2 + 0.03, y: F + 1.5, z: 4.4, ry: Math.PI / 2 }));
    for (let i = 0; i < 4; i++) K.box(M.brass, XB + T / 2 + 0.04, F + 1.25 - (i % 2) * 0.03, 4.3 + i * 0.07, 0.01, 0.16, 0.025);
    K.solid(94.4, 4.6, 0.9, 0.9, 0.75, { y: F, mat: M.furniture, pen: 2 });
    chairAt(94.4, F, 5.4, 0);
    K.box(M.lampGlass, 96.4, U - 1.0, 9.0, 0.22, 0.32, 0.22, {}, { shadow: false });
    K.cyl(M.blackIron, 96.4, U - 0.68, 9.0, 0.015, 0.015, 0.38, 4);
  }

  /* ---- the courtroom: the judge's bench, the witness stand, the jury box, the gallery */
  wainscot(F, [
    ["x", IN.z0, 1, XB + T / 2, IN.x1],
    ["z", IN.x1, -1, IN.z0, ZJ - T / 2],
    ["x", ZJ - T / 2, -1, XB + T / 2, IN.x1],
    ["z", XB + T / 2, 1, IN.z0, ZJ - T / 2, [gap(-3, 1.8)]],
  ]);
  const DAIS = { x0: 95, x1: 101, z1: -12.6, top: F + 0.45 };
  {
    K.solid((DAIS.x0 + DAIS.x1) / 2, (IN.z0 + DAIS.z1) / 2, DAIS.x1 - DAIS.x0, DAIS.z1 - IN.z0, DAIS.top, { mat: HM.oak, pen: 8 });
    K.solid(DAIS.x0 - 0.4, -14, 0.8, 1.6, F + 0.22, { mat: HM.oak, pen: 8 });     // a step up at its west end
    // the judge's bench: a tall panelled front, the gavel, his chair
    K.solid((DAIS.x0 + DAIS.x1) / 2 , DAIS.z1 - 0.3, 5.0, 0.5, 1.15, { y: DAIS.top, mat: HM.oak, pen: 3 });
    K.box(M.trimDark, (DAIS.x0 + DAIS.x1) / 2, DAIS.top + 1.15, DAIS.z1 - 0.35, 5.2, 0.06, 0.7);
    for (let x = DAIS.x0 + 0.9; x < DAIS.x1 - 0.5; x += 1.05) K.box(M.trimDark, x, DAIS.top + 0.25, DAIS.z1 - 0.04, 0.8, 0.7, 0.03, {}, { shadow: false });
    K.box(HM.oak, 98.4, DAIS.top + 1.21, DAIS.z1 - 0.4, 0.06, 0.06, 0.26);
    K.cyl(HM.oak, 98.4, DAIS.top + 1.21, DAIS.z1 - 0.28, 0.035, 0.035, 0.14, 8, { rx: Math.PI / 2 });
    chairAt(98, DAIS.top, -14.0, Math.PI, "judge");
    // over him: JUSTICE (lol), the town's seal, the flag
    wallPic(K, sign("JUSTICE", "(lol)", { bg: "#2a2a2a", fg: "#e8d8a8", edge: "#c89a3a", w: 768, h: 192 }), { x: 98, y: 6.7, z: IN.z0, w: 3.4, h: 0.85, o: 1, frame: M.trimGold });
    K.add(M.trollGold, place(new THREE.CircleGeometry(0.9, 28), { x: 98, y: 4.6, z: IN.z0 + 0.03 }), { shadow: false });
    K.add(M.trimGold, place(new THREE.TorusGeometry(0.95, 0.07, 6, 28), { x: 98, y: 4.6, z: IN.z0 + 0.05 }));
    K.cyl(M.blackIron, 100.6, DAIS.top, -15.0, 0.2, 0.22, 0.12, 10);
    K.cyl(M.trimGold, 100.6, DAIS.top + 0.12, -15.0, 0.03, 0.03, 2.4, 6);
    for (let i = 0; i < 5; i++) K.box(i % 2 ? M.flagWhite : M.flagRed, 100.6 + 0.48, DAIS.top + 2.4 - i * 0.14, -15.0, 0.9, 0.14, 0.01, {}, { shadow: false });
    // the witness stand, east of the bench
    K.solid(102.3, -11.6, 1.3, 1.3, 0.3, { y: F, mat: HM.oak, pen: 4 });
    K.api.ghostBox(102.3, -10.97, 1.3, 0.08, 1.1, { y: F + 0.3, pen: 1 });
    K.box(HM.oak, 102.3, F + 0.3, -10.97, 1.3, 0.85, 0.06);
    chairAt(102.3, F + 0.3, -11.8, Math.PI, "witness");
    // the jury box against the east wall, two rows of four, the back row up a riser
    K.solid(102.95, -7.7, 1.3, 4.4, 0.3, { y: F, mat: HM.oak, pen: 4 });
    railing(K, M, { axis: "z", at: 101.4, a: -9.9, b: -5.5, y: F, mat: HM.oak });
    railing(K, M, { axis: "x", at: -5.45, a: 101.4, b: IN.x1, y: F, mat: HM.oak });
    for (const z of [-9.2, -8.2, -7.2, -6.2]) { chairAt(101.95, F, z, Math.PI / 2, "jury"); chairAt(102.85, F + 0.3, z, Math.PI / 2, "jury"); }
    // the bar across the room, its gate at the aisle; the counsel tables
    railing(K, M, { axis: "x", at: -10.6, a: XB + T / 2, b: 96.6, y: F, mat: HM.oak });
    railing(K, M, { axis: "x", at: -10.6, a: 97.6, b: 101.4, y: F, mat: HM.oak });
    for (const x of [94.6, 99.6]) {
      K.solid(x, -11.75, 1.6, 0.7, 0.76, { y: F, mat: M.furniture, pen: 2 });
      chairAt(x - 0.4, F, -11.0, 0);
      chairAt(x + 0.4, F, -11.0, 0);
    }
    // the gallery: seven rows of benches either side of the aisle, facing the judge;
    // each block one collider (no standing in the gaps between rows)
    const blocks = [[93.4, 96.4, 92.8], [97.8, 100.4, 97.1]];
    const rows = [-8.4, -7.2, -6.0, -4.8, -3.6, -2.4, -1.2];
    for (const [bx0, bx1, aisle] of blocks) {
      for (const z of rows) {
        const xc = (bx0 + bx1) / 2, L = bx1 - bx0;
        K.box(HM.oak, xc, F + 0.42, z, L, 0.05, 0.42);
        K.box(HM.oak, xc, F + 0.47, z + 0.24, L, 0.5, 0.04, { rx: 0.1 });
        K.box(HM.oak, xc, F + 0.08, z - 0.15, L, 0.05, 0.06);
        for (const ex of [bx0, bx1]) K.box(HM.oak, ex, F, z + 0.04, 0.06, 0.95, 0.56);
        for (const x of [xc - L / 4, xc + L / 4]) seats.push({ x, z: z - 0.02, y: F + 0.45, floor: F, yaw: 0, kind: "bench", stand: { x: aisle, z } });
      }
      K.api.ghostBox((bx0 + bx1) / 2, (rows[0] + rows[rows.length - 1]) / 2 + 0.05, bx1 - bx0 + 0.1, rows[rows.length - 1] - rows[0] + 0.7, 1.15, { y: F, pen: 1.5 });
    }
    chandelier(K, M, 97, 6.6, -9.5, { r: 0.9 });
    chandelier(K, M, 97, 6.6, -3.5, { r: 0.9 });
  }

  /* ---- upstairs: the council chamber, the long table, the mayor's desk, the balcony doors */
  wainscot(U, [
    ["z", IN.x0, 1, ZC + T / 2, ZS - T / 2, [gap(0, 1.8)]],
    ["z", XB - T / 2, -1, ZC + T / 2, ZS - T / 2],
    ["x", ZS - T / 2, -1, IN.x0, XB - T / 2],
  ]);
  {
    K.solid(86.2, 0, 6.0, 1.2, 0.76, { y: U, mat: HM.oak, pen: 2 });
    K.box(M.trimDark, 86.2, U + 0.76, 0, 6.1, 0.04, 1.3);
    for (let i = 0; i < 5; i++) {
      const x = 83.8 + i * 1.2;
      chairAt(x, U, -0.95, Math.PI, "council");
      chairAt(x, U, 0.95, 0, "council");
    }
    // the mayor's desk on a step at the east end, under the founder's portrait
    K.solid(91.0, 0, 1.5, 4.0, 0.25, { y: U, mat: HM.oak, pen: 8 });
    K.solid(90.5, 0, 0.6, 2.0, 0.95, { y: U + 0.25, mat: HM.oak, pen: 2 });
    chairAt(91.25, U + 0.25, 0, Math.PI / 2, "mayor");
    wallPic(K, M.paintPortrait, { x: XB - T / 2, y: U + 2.7, z: 0, w: 1.2, h: 1.55, o: -1, axis: "z", frame: M.trimGold });
    K.box(HM.oak, 90.4, U + 1.2, 0.6, 0.24, 0.07, 0.07);
    K.cyl(HM.oak, 90.4, U + 1.2, 0.48, 0.035, 0.035, 0.14, 8, { rx: Math.PI / 2 });
    K.cyl(M.blackIron, 91.2, U, -2.6, 0.2, 0.22, 0.12, 10);
    K.cyl(M.trimGold, 91.2, U + 0.12, -2.6, 0.03, 0.03, 2.4, 6);
    for (let i = 0; i < 7; i++) K.box(i % 2 ? M.flagWhite : M.flagRed, 90.75, U + 2.45 - i * 0.14, -2.6, 0.9, 0.14, 0.01, {}, { shadow: false });
    K.box(M.flagBlue, 90.48, U + 2.18, -2.594, 0.36, 0.42, 0.01, {}, { shadow: false });
    chandelier(K, M, 86.2, C.top - 1.3, 0, { r: 0.8 });
  }

  /* ---- the founder's plaza out front: paving, benches, lamps, bollards */
  {
    const P = PLAZA;
    K.add(M.stone, place(new THREE.PlaneGeometry(P.x1 - P.x0, P.z1 - P.z0), { x: (P.x0 + P.x1) / 2, y: 0.02, z: 0, rx: -Math.PI / 2 }), { shadow: false });
    for (const z of [P.z0, P.z1]) K.box(M.trimCream, (P.x0 + P.x1) / 2, 0, z, P.x1 - P.x0, 0.1, 0.2, {}, { shadow: false });
    for (const s of [-1, 1]) {
      K.solid(66.5, s * 8.4, 2.0, 0.5, 0.45, { pen: 1, mat: HM.oak });
      benchAt(66.5, s * 8.4, 2.0, "x", 0.45, s > 0 ? 0 : Math.PI, 0);
      streetLamp(K, M, 72.5, s * 8.6, {});
      for (const x of [75.4, 76.6]) bollard(K, M, x, s * 7.6, {});
    }
  }

  K.flush();
  // everything here is live: drawn by code, not in Studio, never moved
  for (const c of api.colliders.slice(c0)) c.live = true;
  const sx1 = STAIR.x + STAIR.run * STAIR.steps;
  return {
    seats,
    grimes: { x: 84.2, z: 8.6, y: F, yaw: 0 },
    deputy: { x: desk.x + 0.9, z: desk.z, y: F + 0.47, yaw: Math.PI / 2 },
    stair: { a: { x: STAIR.x - 0.6, z: STAIR.z }, b: { x: sx1 + 0.6, z: STAIR.z } },
  };
}

/* [a, b] minus the gaps, as runs. */
function runsOf(a, b, gaps) {
  const out = [];
  let s = a;
  for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) { if (g0 > s) out.push([s, g0]); s = Math.max(s, g1); }
  if (b > s) out.push([s, b]);
  return out;
}
