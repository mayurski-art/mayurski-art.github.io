// Troll Forces — Troll City: the east end of Main Street, between the old
// town and the town hall (doc "Troll City redesign in Roblox Studio", the
// east Main Street lots).
//
// Six shops on the town's rows: north (fronts on z -9.6) the Grand Hotel,
// the Troll City Gazette and Sweet Grin's Bakery; south (fronts on z 9.6)
// Grin Express Co., Tintype Portraits and the milliner. The boardwalks run
// on to the founder's plaza, the street lamps and the telegraph poles keep
// their spacing. The hero props inside (the press, the camera, the dress
// form ...) are made in Studio with generate_mesh and come home with the
// Studio town; this draws the buildings and their plain furniture.
//
// Drawn by code after the Studio town, like the chapel and the hall: its
// own Kit, every piece and collider live, never moved by a Studio model.
// trollcity.js hands its builders in (H): the shop builder above all, so
// these are the town's own false fronts, signs, porches and doors.

import * as THREE from "three";
import { Kit, place, rng, chair as kitChair, chandelier, sconce, streetLamp, telegraphPole, barrel, crate, hitchRail, trough } from "./trollcity-kit.js?v=tc2-wst-tc3-sh1-sr1-pf1-or1-tcs1-tx1-ch1-sp1-kbt1";

export const EAST = { n: { x0: 35, x1: 70 }, s: { x0: 43, x1: 70 } };

/* Build them into `root`, after the town. H = { shop, boardwalk, counter,
   shelves, stove, wallPic, sign, FLOOR, ROW_N, ROW_S, WALK }. Returns the
   seats (rp.seats). */
export function buildEast(api, root, M, H) {
  const { shop, boardwalk, counter, shelves, stove, wallPic, sign, FLOOR: Y, ROW_N, ROW_S, WALK } = H;
  const c0 = api.colliders.length;
  const K = new Kit(api, root);
  const add0 = K.add;
  K.add = (mat, geo, o = {}) => add0.call(K, mat, geo, { ...o, live: true });
  const R = rng(1880);
  const std = (color, rough = 0.85) => new THREE.MeshStandardMaterial({ color, roughness: rough });
  const EM = { bread: std(0xc88a46, 0.8), crust: std(0x8a5428, 0.8), paper: std(0xece4cc, 0.95), cake: std(0xf2d8e0, 0.7),
    felt: [0x3a2a22, 0x6a2a3a, 0x2a3a5a, 0x5a5a3a, 0x8a6a4a].map((c) => std(c, 0.95)), glassCase: new THREE.MeshStandardMaterial({ color: 0xcfe4ea, roughness: 0.05, transparent: true, opacity: 0.25, depthWrite: false }) };
  const seats = [];
  const chairAt = (x, y, z, ry) => {
    kitChair(K, M, x, y, z, { ry });
    seats.push({ x, z, y: y + 0.47, floor: y, yaw: ry, kind: "chair", stand: { x, z } });
  };
  const win = (c, w = 2.0, lo = 1.0, hi = 3.0) => ({ c, w, spans: [[lo, hi]] });
  const door = (c, w = 1.3, h = 2.6) => ({ c, w, spans: [[0, h]] });

  /* ---- the street: boardwalks on to the plaza, lamps every 16 m, a pole every 32 */
  boardwalk(K, M, ROW_N.front, ROW_N.front + WALK, EAST.n.x0, EAST.n.x1);
  boardwalk(K, M, ROW_S.front - WALK, ROW_S.front, EAST.s.x0, EAST.s.x1);
  for (const x of [44, 60]) for (const z of [-6.6, 6.6]) streetLamp(K, M, x, z, {});
  telegraphPole(K, M, 52.5, -6.7, {});
  for (const [x, z] of [[47.5, -6.4], [64.5, 6.4]]) hitchRail(K, M, x, z, { len: 2.6 });
  trough(K, M, 50.8, -6.3, { len: 2.0 });

  /* ---- north row ---- */
  // the Grand Hotel: two storeys of front, a balcony over the boardwalk,
  // the lobby open (the rooms are let out)
  {
    const F = shop(K, M, {
      x0: 36, x1: 50, row: "n", h1: 4.0, up: 3.4, ff: 9.0, wallMat: M.wallWhite, trim: M.trimDark, lining: M.damaskRose, porch: false,
      sign: { text: "GRAND HOTEL", sub: "Baths · Billiards · Better than the Inn", bg: "#2a3a2a", fg: "#e8d8a8", edge: "#e8d8a8" },
      signY: 8.3, signH: 1.0,
      front: [win(38.4), door(43, 1.8, 2.8), win(47.6)],
      frontUp: [38, 41.4, 44.6, 48].map((c) => win(c, 1.0, 0.8, 2.4)),
      back: [door(47.6, 1.2, 2.4)],
    });
    for (const x of [38, 41.4, 44.6, 48]) K.box(M.trimDark, x, 4.6, ROW_N.front - 0.6, 1.0, 1.8, 0.04);   // dark rooms
    // the balcony on posts at the kerb: its deck, a railing
    const kerb = ROW_N.front + WALK - 0.25, dz = (ROW_N.front + kerb) / 2;
    K.solid(43, dz, 14.2, WALK, 0.2, { y: 4.0, mat: M.deck, pen: 6 });
    for (let i = 0; i <= 5; i++) K.solid(36.15 + i * 2.74, kerb, 0.18, 0.18, 4.0 - Y, { y: Y, pen: 3, mat: M.post });
    K.box(M.trimDark, 43, 4.2, kerb, 14.2, 0.08, 0.1);
    K.box(M.trimDark, 43, 5.12, kerb, 14.2, 0.08, 0.12);
    for (let x = 36.2; x < 49.9; x += 0.26) K.box(M.trimDark, x, 4.28, kerb, 0.05, 0.84, 0.05, {}, { shadow: false });
    for (const s of [-1, 1]) K.box(M.trimDark, 43 + s * 7.05, 4.2, dz, 0.08, 1.0, WALK - 0.3);
    // the lobby: the desk and key board, a settee, a rug, the chandelier
    counter(K, M, { x: 40.5, z: -18.4, w: 3.2, d: 0.7, mat: M.furniture });
    K.box(M.furniture, 40.5, Y + 1.3, F.inZ0 + 0.03, 2.2, 1.1, 0.06);
    for (let i = 0; i < 12; i++) K.box(M.brass, 39.6 + (i % 6) * 0.36, Y + 1.5 + Math.floor(i / 6) * 0.45, F.inZ0 + 0.08, 0.04, 0.14, 0.03);
    K.solid(46.6, -15.6, 2.2, 0.8, 0.85, { y: Y, pen: 1.2, mat: M.settee });
    K.box(M.settee, 46.6, Y + 0.85, -16.05, 2.2, 0.5, 0.25);
    for (const x of [46.0, 47.2]) seats.push({ x, z: -15.5, y: Y + 0.5, floor: Y, yaw: Math.PI, kind: "bench", stand: { x, z: -14.6 } });
    K.box(M.rug, 43, Y + 0.005, -14.8, 4.0, 0.01, 2.6, {}, { shadow: false });
    wallPic(K, M.paintDesert, { x: 46.6, y: Y + 2.4, z: F.inZ0, w: 1.6, h: 1.1, o: 1, frame: M.trimGold });
    chandelier(K, M, 43, 3.2, -15.0, { r: 0.7 });
    // rocking chairs out front, facing the street
    for (const x of [37.6, 39.4, 46.6, 48.4]) chairAt(x, Y, ROW_N.front + 0.9, Math.PI);
  }
  // The Troll City Gazette: the press (Studio), type cases, bundles of papers
  {
    const F = shop(K, M, {
      x0: 51, x1: 60, row: "n", h1: 4.0, ff: 6.6, wallMat: M.wallMustard, trim: M.trimDark,
      sign: { text: "THE TROLL CITY GAZETTE", sub: "All the news that's fit to troll", bg: "#1a1a1a", fg: "#efe6d4", edge: "#efe6d4" },
      front: [win(53.2, 2.4), door(57.6)],
      back: [door(53.4, 1.2, 2.4)],
    });
    shelves(K, M, { axis: "z", at: F.inX0, a: -21.0, b: -17.0, o: 1, goods: M.goods2, rows: 6, h: 1.6, d: 0.6 });
    for (let i = 0; i < 6; i++) {
      const x = 57.6 + (i % 3) * 0.55, z = -20.6 + Math.floor(i / 3) * 0.5;
      K.box(EM.paper, x, Y, z, 0.42, 0.22 + R() * 0.25, 0.32, { ry: (R() - 0.5) * 0.3 });
    }
    K.api.ghostBox(58.15, -20.35, 1.7, 1.0, 0.5, { y: Y, pen: 2 });
    K.solid(54.4, -12.4, 1.4, 0.7, 0.78, { y: Y, mat: M.furniture, pen: 2 });
    chairAt(54.4, Y, -13.1, Math.PI);
    wallPic(K, sign("EXTRA! EXTRA!", "U MAD? Town says: no", { bg: "#efe6d4", fg: "#1a1a1a", edge: "#1a1a1a", w: 512, h: 384 }), { x: F.inX1, y: Y + 1.9, z: -14.0, w: 1.1, h: 0.82, o: -1, axis: "z" });
    sconce(K, M, 55.5, Y + 2.2, ROW_N.back + 0.3, { ry: 0 });
  }
  // Sweet Grin's Bakery: the counter, loaves on the shelves, cakes in the case
  {
    const F = shop(K, M, {
      x0: 61, x1: 70, row: "n", h1: 4.0, ff: 6.4, wallMat: M.wallRed, trim: M.trimCream, lining: M.damask,
      sign: { text: "SWEET GRIN'S", sub: "Bakery · Pies · Fresh daily", bg: "#efe6d4", fg: "#8a2a3a", edge: "#8a2a3a" },
      front: [win(63.4, 2.4), door(67.6)],
      back: [door(64, 1.2, 2.4)],
    });
    counter(K, M, { x: 65.5, z: -17.0, w: 4.0, d: 0.7, mat: M.furniture });
    K.box(EM.glassCase, 64.6, Y + 1.11, -17.0, 1.6, 0.4, 0.6, {}, { shadow: false });
    for (let i = 0; i < 3; i++) K.cyl(EM.cake, 64.1 + i * 0.5, Y + 1.11, -17.0, 0.16, 0.16, 0.14, 12);
    // loaves on the back wall's shelves
    for (let row = 0; row < 3; row++) {
      const y = Y + 0.9 + row * 0.55;
      K.box(M.furniture, 65.5, y, F.inZ0 + 0.22, 4.4, 0.04, 0.42);
      for (let i = 0; i < 9; i++) K.add(R() < 0.5 ? EM.bread : EM.crust, place(new THREE.SphereGeometry(0.15, 8, 6), { x: 63.6 + i * 0.47, y: y + 0.12, z: F.inZ0 + 0.22, sx: 1.6, sy: 0.8, sz: 0.9 }));
    }
    K.api.ghostBox(65.5, F.inZ0 + 0.22, 4.4, 0.45, 2.3, { y: Y, pen: 2 });
    for (const x of [62.2, 63.6]) { K.cyl(M.barrelTop, x, Y, -12.2, 0.3, 0.3, 0.72, 12); chairAt(x, Y, -12.9, Math.PI); }
    stove(K, M, F.inX1 - 0.5, -20.6, { top: 4.0 });
  }

  /* ---- south row ---- */
  // Grin Express Co.: stage and freight; the counter, the scales, parcels (the safe: Studio)
  {
    const F = shop(K, M, {
      x0: 44, x1: 53, row: "s", h1: 4.2, ff: 7.0, wallMat: M.wallTeal, trim: M.trimCream,
      sign: { text: "GRIN EXPRESS CO.", sub: "Stage · Freight · Gold (probably)", bg: "#2a1a10", fg: "#e8c868", edge: "#e8c868" },
      front: [win(46.4, 2.2), door(50.4, 1.6, 2.8)],
      back: [door(50.4, 2.2, 2.8)],
    });
    counter(K, M, { x: 47.2, z: 15.6, w: 4.0, d: 0.7, mat: M.furniture });
    // (the safe in the corner is a Studio prop)
    K.cyl(M.blackIron, 51.6, Y, 19.5, 0.05, 0.05, 1.2, 6);
    K.box(M.brass, 51.6, Y + 1.2, 19.5, 0.6, 0.04, 0.04);
    for (const s of [-1, 1]) K.cyl(M.brass, 51.6 + s * 0.28, Y + 0.95, 19.5, 0.14, 0.1, 0.05, 10);
    for (const [x, z] of [[49.0, 20.2], [50.0, 20.4]]) crate(K, M, x, z, { y: Y, s: 0.7, ry: R() * 0.4 });
    barrel(K, M, 52.0, 12.0, { y: Y });
    sconce(K, M, 48.5, Y + 2.2, ROW_S.back - 0.3, { ry: Math.PI });
  }
  // Tintype Portraits: the camera (Studio), a painted backdrop, the posing chair
  {
    const F = shop(K, M, {
      x0: 54, x1: 62, row: "s", h1: 4.0, ff: 6.4, wallMat: M.wallGrey, trim: M.trimDark, lining: M.damaskGreen,
      sign: { text: "TINTYPE PORTRAITS", sub: "Hold still · Don't grin (you will)", bg: "#efe6d4", fg: "#2a2a2a", edge: "#2a2a2a" },
      front: [win(56.0, 2.0), door(59.8)],
      back: [door(56.2, 1.2, 2.4)],
    });
    K.box(M.redVelvet, 58, Y, F.inZ1 - 0.06, 4.6, 3.2, 0.04);
    chairAt(58, Y, 19.6, Math.PI);
    for (const [x, z] of [[F.inX0, 13.0], [F.inX0, 16.0]]) wallPic(K, M.paintPortrait, { x, y: Y + 1.8, z, w: 0.7, h: 0.9, o: 1, axis: "z", frame: M.trimGold });
    K.solid(F.inX1 - 0.4, 12.6, 0.7, 1.4, 0.8, { y: Y, mat: M.furniture, pen: 2 });
  }
  // the milliner and dressmaker: hats on stands, bolts of cloth, the mirror
  {
    const F = shop(K, M, {
      x0: 63, x1: 70, row: "s", h1: 4.0, ff: 6.2, wallMat: M.wallGreen, trim: M.trimCream, lining: M.damaskRose,
      sign: { text: "MILLINER", sub: "Hats · Gowns · Alterations", bg: "#2c3a28", fg: "#f0d8e0", edge: "#f0d8e0" },
      front: [win(65.2, 2.2), door(68.4, 1.2)],
      back: [door(65, 1.2, 2.4)],
    });
    for (let i = 0; i < 4; i++) {
      const x = 64.2 + i * 0.9, z = 12.4, felt = EM.felt[i % EM.felt.length];
      K.cyl(M.trimDark, x, Y, z, 0.03, 0.03, 1.3 + (i % 2) * 0.15, 6);
      K.cyl(felt, x, Y + 1.3 + (i % 2) * 0.15, z, 0.26, 0.26, 0.02, 14);
      K.cyl(felt, x, Y + 1.32 + (i % 2) * 0.15, z, 0.13, 0.15, 0.16, 12);
    }
    K.api.ghostBox(65.55, 12.4, 3.2, 0.6, 1.6, { y: Y, pen: 1 });
    counter(K, M, { x: 66.5, z: 19.0, w: 3.0, d: 0.7, till: false, mat: M.furniture });
    for (let i = 0; i < 5; i++) K.cyl(EM.felt[(i + 2) % EM.felt.length], 65.4 + i * 0.5, Y + 1.11, 19.0, 0.12, 0.12, 0.6, 10, { rz: Math.PI / 2 });
    K.add(M.mirror, place(new THREE.PlaneGeometry(0.7, 1.7), { x: F.inX1 - 0.04, y: Y + 1.25, z: 16.2, ry: -Math.PI / 2 }), { shadow: false });
    K.box(M.trimGold, F.inX1 - 0.03, Y + 0.35, 16.2, 0.03, 1.8, 0.85);
  }

  K.flush();
  for (const c of api.colliders.slice(c0)) c.live = true;
  return { seats };
}
