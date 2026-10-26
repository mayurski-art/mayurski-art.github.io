// Troll Forces — Troll City: St. Grinsworth's, the town's chapel.
//
// Hollowgrin's Gothic brick chapel (hollowgrin-chapel.js), bigger and with a
// bell tower: it closes the east end of Second Street (doc "Troll City
// redesign in Roblox Studio", the chapel). Nave 22 x 12 m with 8 m walls,
// the tower out front (west) with the door, the rose window, the name board,
// a shut belfry and an octagonal slate spire; the apse at the east end
// under a copper-green half dome. Inside: tiled floor, the red runner, 28
// pews in two blocks with a cross aisle to the side door (Boot Hill), the
// hammer-beam roof over the painted panels, the chancel, altar, sunburst,
// mosaic apse and the Controllments, and an organ loft over the door, up a
// stair in the tower. Two of Hollowgrin's mannequins sit in the pews
// (hollowgrin-mannequins.js: the woman and the man, models/mq-*.glb).
//
// Drawn by code, not Studio: its look is the painted textures (chapel-art.js)
// and a Studio part can't carry those. It's built after the Studio town
// (buildTrollCity), in its own Kit: every piece and collider is live and
// numbered after everything else, and nothing of the Studio town moves it.
// trollcity.js hands its helpers in (H) rather than this file importing them
// back: the import tags (?v=) would make a second copy of that module.

import * as THREE from "three";
import { Kit, place, prismGeo, surfMat, texMat, signTexture, shingleTexture, rng } from "./trollcity-kit.js?v=tc2-wst-tc3-sh1-sr1-pf1-or1-tcs1-tx1-ch1-sp1-kbt1-pm1-ss1-ss2-ss3-tfm2";
import { loadModel } from "./battlefield-props.js?v=sr1-or1-tx1-sp1-kbt1-gb1-pm1-kbk2-tfp7-tfb8-ss1-ss2-ss3-tfm2";
import { floorTexture, runnerTexture, ceilingTexture, friezeTexture, lancetTexture, domeTexture, apseWallTexture, sunburstTexture, frontalTexture, rulesTexture, lanternTexture, roseTexture, archFill, inward, quad, band } from "./chapel-art.js?v=ca1-tcs1";

export const CHAPEL = { x0: 82, x1: 104, z0: 60, z1: 72, h: 8 };
const T = 0.6;                                         // wall thickness
const CZ = (CHAPEL.z0 + CHAPEL.z1) / 2;                // 66: Second Street's middle line, down the aisle
const IN = { x0: CHAPEL.x0 + T, x1: CHAPEL.x1 - T, z0: CHAPEL.z0 + T, z1: CHAPEL.z1 - T };
export const CHAPEL_TOWER = { x0: 77, x1: 82, z0: 63.5, z1: 68.5, top: 16, belfry: 20, spire: 32 };
const TW = CHAPEL_TOWER;
const DOOR = { w: 2.4, h: 3.8 };                    // the west door, and the arch from the tower into the nave
export const CHAPEL_SIDE_DOOR = { c: 94, w: 1.8, h: 3.4 };
const APSE = { x: CHAPEL.x1 - T / 2, r: 4.0, R: 4.5, spring: 3.4 };
const LANCETS = [86.8, 90.4, 94, 97.6, 101.2];         // 5 a side; the south one at 94 sits over the side door
const LANCET = { w: 1.3, lo: 2.6, hi: 6.6 };
const HIGH = { lo: 4.4, hi: 6.8 };
const BAYS = [88.6, 92.2, 95.8, 99.4];                 // buttresses outside, trusses inside
const ROOF_RISE = 4.5, ROOF_HALF = (CHAPEL.z1 - CHAPEL.z0) / 2 + 0.4;
// The pews: two blocks of 7 rows a side, the cross aisle to the side door
// between them. Each block of a side is ONE collider, 1.2 m tall (over the
// jump): the gaps between rows are no place to stand (Hollowgrin's lesson).
// The front row stands 2 m off the rail, room for a zombie (1.7 m).
const ROWS = [0, 1, 2, 3, 4, 5, 6];
const PEW_BLOCKS = [ROWS.map((i) => 86.9 + i * 0.95), ROWS.map((i) => 95.42 + i * 0.95)];
const PEW_Z = { north: [IN.z0 + 0.1, CZ - 0.9], south: [CZ + 0.9, IN.z1 - 0.1] };
// the chancel: a 0.15 step at `step`, the platform (0.3) from `x` into the apse
const CHANCEL = { step: 101.9, x: 102.4 };
const RAIL_X = 103.6;
// the stair up the tower's north wall to the organ loft (the town's upper
// floor height, so zombies find their way up it: trollcity.js links it).
// Its foot stands 0.9 m off the west wall, room to walk straight onto it
// (flush to the wall, a body only reached it over the second step), and its
// top step ends at the nave's west wall, the loft through it.
const STAIR = { x: TW.x0 + T + 0.9, z: TW.z0 + T + 0.5, w: 1.0, steps: 14, run: 0.25 };
const LOFT = { x1: 85.6 };
// Hollowgrin's two churchgoers, sat facing the altar (east) on the pews' middle
// seats: [model, pew row x, z]. Their seats come off the RP list.
const SITTERS = [["pew_woman", PEW_BLOCKS[0][2], CZ - 0.9 - 2.1], ["pew_man", PEW_BLOCKS[1][1], CZ + 0.9 + 2.1]];

const _up = new THREE.Vector3(0, 1, 0);
function rodGeo(a, b, r, seg = 4) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const dir = B.clone().sub(A);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1, true);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_up, dir.normalize()));
  g.translate(A.x, A.y, A.z);
  return g;
}

/* Build it into `root`, after the town. H = { wall, FLOOR, LOFT_Y }.
   Returns its pew seats (rp.seats), the preacher's spot and the stair link. */
export function buildChapel(api, root, M, H) {
  const { wall, FLOOR: F, LOFT_Y } = H;
  const c0 = api.colliders.length;
  const K = new Kit(api, root);
  const add0 = K.add;
  K.add = (mat, geo, o = {}) => add0.call(K, mat, geo, { ...o, live: true });
  const C = CHAPEL;
  const CH = F + 0.3;                                  // the chancel's top
  const R = rng(2028);
  const CM = {
    brick: surfMat("brick", 0xc89a5a, { mix: 0.3, tile: 1.2, bounce: 0.16 }),
    stoneDark: surfMat("rock", 0x6a6670, { mix: 0.35, tile: 1.1 }),
    timber: surfMat("wood", 0x3a2216, { mix: 0.12, tile: 1, bounce: 0.08 }),
    oak: surfMat("wood", 0x7a4a28, { mix: 0.3, tile: 1, bounce: 0.3 }),
    marble: surfMat("marble", 0xd8cfc0, { mix: 0.4, tile: 1.2, bounce: 0.14 }),
    slate: texMat(shingleTexture(), { color: 0x6c7280, tile: 1.1, rough: 0.8 }),
    floor: texMat(floorTexture(), { tile: 1.6, rough: 0.55 }),
    carpet: new THREE.MeshStandardMaterial({ map: runnerTexture(), roughness: 0.95, emissive: 0x2a0606 }),
    velvet: new THREE.MeshStandardMaterial({ color: 0x7c1218, roughness: 0.95, emissive: 0x1a0404 }),
    linen: new THREE.MeshStandardMaterial({ color: 0xf0ece0, roughness: 0.9, emissive: 0x2a2824 }),
    ceiling: new THREE.MeshStandardMaterial({ map: ceilingTexture(), emissiveMap: ceilingTexture(), emissive: 0x6a5a50, roughness: 0.85, side: THREE.DoubleSide }),
    frieze: new THREE.MeshStandardMaterial({ map: friezeTexture(), emissiveMap: friezeTexture(), emissive: 0x504040, roughness: 0.8 }),
    lancet: new THREE.MeshBasicMaterial({ map: lancetTexture(), alphaTest: 0.5, side: THREE.DoubleSide, color: new THREE.Color(0xffffff).multiplyScalar(1.35) }),
    dome: new THREE.MeshStandardMaterial({ map: domeTexture(), emissiveMap: domeTexture(), emissive: 0xa8a090, roughness: 0.45, metalness: 0.15 }),
    apseWall: new THREE.MeshStandardMaterial({ map: apseWallTexture(), emissiveMap: apseWallTexture(), emissive: 0x8a8070, roughness: 0.5, metalness: 0.15 }),
    sunburst: new THREE.MeshBasicMaterial({ map: sunburstTexture(), alphaTest: 0.35, color: new THREE.Color(0xffffff).multiplyScalar(0.72) }),
    frontal: new THREE.MeshStandardMaterial({ map: frontalTexture(), emissiveMap: frontalTexture(), emissive: 0x3a3030, roughness: 0.9 }),
    lantern: new THREE.MeshBasicMaterial({ map: lanternTexture(), color: new THREE.Color(0xffffff).multiplyScalar(1.5) }),
    opal: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0c8).multiplyScalar(1.2) }),
    rose: new THREE.MeshBasicMaterial({ map: roseTexture(), color: new THREE.Color(0xffffff).multiplyScalar(1.25) }),
    wax: new THREE.MeshStandardMaterial({ color: 0xf0e6cc, roughness: 0.7, emissive: 0x3a3428 }),
    flame: new THREE.MeshBasicMaterial({ color: 0xffc060, side: THREE.DoubleSide }),
  };
  const candle = (x, y, z, h = 0.2) => {
    K.cyl(CM.wax, x, y, z, 0.035, 0.032, h, 8);
    for (const ry of [0, Math.PI / 2]) K.add(CM.flame, place(new THREE.PlaneGeometry(0.06, 0.12), { x, y: y + h + 0.06, z, ry }), { shadow: false });
  };

  /* ---- floors: the nave's and the tower's, tiled, a step up off the street */
  K.solid((IN.x0 + IN.x1) / 2, CZ, IN.x1 - IN.x0, IN.z1 - IN.z0, F, { pen: 8 });
  K.solid((TW.x0 + T + TW.x1) / 2, CZ, TW.x1 - TW.x0 - T, TW.z1 - TW.z0 - 2 * T, F, { pen: 8 });
  K.add(CM.floor, place(new THREE.PlaneGeometry(IN.x1 - IN.x0, IN.z1 - IN.z0), { x: (IN.x0 + IN.x1) / 2, y: F + 0.016, z: CZ, rx: -Math.PI / 2 }), { shadow: false });
  K.add(CM.floor, place(new THREE.PlaneGeometry(TW.x1 - TW.x0 - T, TW.z1 - TW.z0 - 2 * T), { x: (TW.x0 + T + TW.x1) / 2, y: F + 0.016, z: CZ, rx: -Math.PI / 2 }), { shadow: false });
  // the thresholds, and the steps up to the west door and the side door
  K.solid(TW.x0 + T / 2, CZ, T, DOOR.w, F, { mat: M.stone, pen: 8 });
  K.solid(C.x0 + T / 2, CZ, T, DOOR.w, F, { mat: M.stone, pen: 8 });
  K.solid(CHAPEL_SIDE_DOOR.c, C.z1 - T / 2, CHAPEL_SIDE_DOOR.w, T, F, { mat: M.stone, pen: 8 });
  K.solid(TW.x0 - 0.75, CZ, 1.5, DOOR.w + 1.2, 0.15, { mat: M.stone, pen: 8 });
  K.solid(TW.x0 - 0.35, CZ, 0.7, DOOR.w + 1.2, F, { mat: M.stone, pen: 8 });
  K.solid(CHAPEL_SIDE_DOOR.c, C.z1 + 0.4, 2.8, 0.8, 0.15, { mat: M.stone, pen: 8 });
  const runner = (x0, x1, y, w) => {
    const g = new THREE.PlaneGeometry(x1 - x0, w);
    const uv = g.attributes.uv.array;
    for (let i = 0; i < uv.length; i += 2) uv[i] *= (x1 - x0) / 1.2;
    K.add(CM.carpet, place(g, { x: (x0 + x1) / 2, y, z: CZ, rx: -Math.PI / 2 }), { shadow: false });
  };
  runner(TW.x0 + T, CHANCEL.step, F + 0.022, 1.2);
  // the chancel: a step, then the platform on into the apse
  K.solid((CHANCEL.step + CHANCEL.x) / 2, CZ, CHANCEL.x - CHANCEL.step, IN.z1 - IN.z0, F + 0.15, { mat: CM.marble, pen: 8 });
  K.solid((CHANCEL.x + IN.x1) / 2, CZ, IN.x1 - CHANCEL.x, IN.z1 - IN.z0, CH, { mat: CM.marble, pen: 8 });
  K.solid((IN.x1 + APSE.x + APSE.r) / 2, CZ, APSE.x + APSE.r - IN.x1, APSE.r * 2, CH, { pen: 8 });
  K.box(CM.marble, (IN.x1 + C.x1) / 2, 0, CZ, T, CH, APSE.r * 2);
  K.add(CM.marble, place(new THREE.CircleGeometry(APSE.r, 32, -Math.PI / 2, Math.PI), { x: APSE.x, y: CH + 0.001, z: CZ, rx: -Math.PI / 2 }), { shadow: false });
  runner(CHANCEL.step, CHANCEL.x, F + 0.152, 1.2);
  K.box(CM.velvet, CHANCEL.step - 0.005, F, CZ, 0.01, 0.14, 1.2, {}, { shadow: false });
  K.add(CM.carpet, place(new THREE.PlaneGeometry(APSE.x + 0.6 - CHANCEL.x, 3.0), { x: (CHANCEL.x + APSE.x + 0.6) / 2, y: CH + 0.004, z: CZ, rx: -Math.PI / 2 }), { shadow: false });
  K.box(CM.velvet, CHANCEL.x - 0.005, F + 0.15, CZ, 0.01, 0.15, 3.0, {}, { shadow: false });

  /* ---- the nave's walls: brick, stone dressings, the lancets, the doors, the apse arch */
  const win = (c) => ({ c, w: LANCET.w, spans: [[LANCET.lo, LANCET.hi]] });
  const D = CHAPEL_SIDE_DOOR;
  const common = { h: C.h, t: T, mat: CM.brick, glass: false };
  wall(K, M, { ...common, axis: "x", at: C.z0 + T / 2, a: C.x0, b: C.x1, trim: CM.stoneDark, out: -1, holes: LANCETS.map(win) });
  wall(K, M, { ...common, axis: "x", at: C.z1 - T / 2, a: C.x0, b: C.x1, trim: CM.stoneDark, out: 1,
    holes: LANCETS.map((c) => (c === D.c ? { c, w: D.w, spans: [[0, D.h], [HIGH.lo, HIGH.hi]] } : win(c))) });
  // the west wall: the arch from the tower, and up at the loft the way in from the stair
  wall(K, M, { ...common, axis: "z", at: C.x0 + T / 2, a: C.z0 + T, b: C.z1 - T,
    holes: [{ c: CZ, w: DOOR.w, spans: [[0, DOOR.h]] }, { c: STAIR.z, w: STAIR.w, spans: [[LOFT_Y, LOFT_Y + 2.3]] }] });
  wall(K, M, { ...common, axis: "z", at: C.x1 - T / 2, a: C.z0 + T, b: C.z1 - T, holes: [{ c: CZ, w: APSE.r * 2, spans: [[0, APSE.spring + APSE.r]] }] });
  for (const [at, s] of [[C.z0 + T / 2, -1], [C.z1 - T / 2, 1]]) {
    for (const c of LANCETS) {
      const [lo, hi] = s > 0 && c === D.c ? [HIGH.lo, HIGH.hi] : [LANCET.lo, LANCET.hi];
      archFill(K, CM.brick, { axis: "x", at, c, w: LANCET.w, top: hi, R: LANCET.w, t: T - 0.02 });
      K.add(CM.lancet, place(new THREE.PlaneGeometry(LANCET.w, hi - lo), { x: c, y: (lo + hi) / 2, z: at }), { shadow: false });
    }
  }
  archFill(K, CM.brick, { axis: "x", at: C.z1 - T / 2, c: D.c, w: D.w, top: D.h, R: D.w * 0.75, t: T - 0.02 });
  archFill(K, CM.brick, { axis: "z", at: C.x0 + T / 2, c: CZ, w: DOOR.w, top: DOOR.h, R: DOOR.w * 0.75, t: T - 0.02 });
  archFill(K, CM.brick, { axis: "z", at: C.x1 - T / 2, c: CZ, w: APSE.r * 2, top: APSE.spring + APSE.r, R: APSE.r, t: T - 0.02 });
  // the apse arch's gold moulding, nave side
  K.add(M.gold, place(new THREE.TorusGeometry(APSE.r + 0.05, 0.08, 6, 48, Math.PI), { x: IN.x1 - 0.02, y: APSE.spring, z: CZ, ry: Math.PI / 2 }));
  for (const s of [-1, 1]) K.box(M.gold, IN.x1 - 0.03, CH, CZ + s * (APSE.r + 0.05), 0.08, APSE.spring - CH, 0.16);
  // the doors, swung open: the west pair back against the tower, the side
  // pair square to the wall (the buttresses stand close either side)
  const leaf = (x, z, w, h, axis) => {
    K.box(CM.oak, x, F, z, axis === "x" ? w : 0.07, h, axis === "x" ? 0.07 : w);
    for (const y of [0.5, h - 0.7]) K.box(M.iron, x, F + y, z, axis === "x" ? w * 0.9 : 0.09, 0.07, axis === "x" ? 0.09 : w * 0.9);
  };
  for (const s of [-1, 1]) {
    leaf(D.c + s * (D.w / 2 - 0.04), C.z1 + 0.47, 0.9, D.h - F - 0.2, "z");
    leaf(TW.x0 - 0.06, CZ + s * (DOOR.w * 0.75 + 0.05), DOOR.w / 2, DOOR.h - F - 0.2, "z");
  }
  // wainscot and dado rail round the nave, the stencilled frieze up top
  {
    const runsOf = (a, b, gaps) => {
      const out = [];
      let s = a;
      for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) { if (g0 > s) out.push([s, g0]); s = Math.max(s, g1); }
      if (b > s) out.push([s, b]);
      return out;
    };
    const sides = [
      ["x", IN.z0, 1, IN.x0, IN.x1, []],
      ["x", IN.z1, -1, IN.x0, IN.x1, [[D.c - D.w / 2 - 0.1, D.c + D.w / 2 + 0.1]]],
      ["z", IN.x0, 1, IN.z0, IN.z1, [[CZ - DOOR.w / 2 - 0.1, CZ + DOOR.w / 2 + 0.1]]],
    ];
    for (const [axis, at, face, a, b, gaps] of sides) {
      for (const [s, e] of runsOf(a, b, gaps)) {
        const m = (s + e) / 2, L = e - s, off = at + face * 0.025;
        const [x, z] = axis === "x" ? [m, off] : [off, m];
        K.box(CM.oak, x, F, z, axis === "x" ? L : 0.05, 1.05, axis === "x" ? 0.05 : L, {}, { shadow: false });
        const [rx, rz] = axis === "x" ? [m, at + face * 0.05] : [at + face * 0.05, m];
        K.box(CM.timber, rx, F + 1.02, rz, axis === "x" ? L : 0.1, 0.08, axis === "x" ? 0.1 : L, {}, { shadow: false });
      }
      if (axis === "x") K.add(CM.frieze, band(axis, at + face * 0.01, IN.x0, IN.x1, C.h - 0.62, C.h - 0.1, face, 0.5), { shadow: false });
    }
  }

  /* ---- the apse: half cylinder, half dome, tiered stone benches, all east of x */
  {
    const { x: ax, r, R: Ro, spring } = APSE;
    for (let i = 0; i <= 14; i++) {
      const th = -Math.PI / 2 + (i / 14) * Math.PI, rr = (r + Ro) / 2 + 0.05;
      K.api.ghostBox(ax + Math.cos(th) * rr, CZ + Math.sin(th) * rr, 0.7, 0.7, C.h, { pen: 10 });
    }
    // CylinderGeometry: x = r sin(theta), so the east half is theta 0..pi
    K.add(CM.brick, place(new THREE.CylinderGeometry(Ro, Ro, spring, 32, 1, true, 0, Math.PI), { x: ax, y: spring / 2, z: CZ }));
    K.add(CM.apseWall, place(inward(new THREE.CylinderGeometry(r, r, spring - CH, 32, 1, true, 0, Math.PI)), { x: ax, y: (spring + CH) / 2, z: CZ }), { shadow: false });
    K.add(CM.brick, place(new THREE.RingGeometry(r, Ro, 32, 1, -Math.PI / 2, Math.PI), { x: ax, y: spring, z: CZ, rx: -Math.PI / 2 }), { shadow: false });
    // SphereGeometry: x = -r cos(phi) sin(theta), so the east half is phi pi/2..3pi/2
    K.add(CM.dome, place(inward(new THREE.SphereGeometry(r, 44, 16, Math.PI / 2, Math.PI, 0, Math.PI / 2)), { x: ax, y: spring, z: CZ }), { shadow: false });
    K.add(M.copper, place(new THREE.SphereGeometry(Ro, 32, 12, Math.PI / 2, Math.PI, 0, Math.PI / 2), { x: ax, y: spring, z: CZ }));
    K.add(M.gold, place(new THREE.SphereGeometry(0.22, 10, 8), { x: ax, y: spring + Ro + 0.1, z: CZ }));
    // the synthronon: two tiers of stone bench round the curve
    const tier = (r0, y0, h) => {
      K.add(CM.marble, place(inward(new THREE.CylinderGeometry(r0, r0, h, 28, 1, true, 0, Math.PI)), { x: ax, y: y0 + h / 2, z: CZ }));
      K.add(CM.marble, place(new THREE.RingGeometry(r0, r, 28, 1, -Math.PI / 2, Math.PI), { x: ax, y: y0 + h, z: CZ, rx: -Math.PI / 2 }), { shadow: false });
    };
    tier(3.1, CH, 0.45);
    tier(3.5, CH + 0.45, 0.45);
    // the sunburst, over the altar on the back of the apse
    K.add(CM.sunburst, place(new THREE.PlaneGeometry(3.0, 3.0), { x: ax + r - 0.42, y: CH + 2.85, z: CZ, ry: -Math.PI / 2 }), { shadow: false });
    // the altar: marble block, the frontal, linen, six candles in gold sticks
    const alx = ax + 1.2;
    K.solid(alx, CZ, 0.8, 2.0, 1.0, { y: CH, mat: CM.marble, pen: 8 });
    // nobody goes behind the altar: the apse floor is a pocket zombies can't
    // reach, so it's shut (bullets go on through)
    K.api.ghostBox((alx - 0.4 + ax + r) / 2, CZ, ax + r - (alx - 0.4), r * 2, 1.25, { y: CH, pen: 0.5 });
    K.add(CM.frontal, place(new THREE.PlaneGeometry(1.9, 0.9), { x: alx - 0.405, y: CH + 0.5, z: CZ, ry: -Math.PI / 2 }), { shadow: false });
    K.box(CM.linen, alx, CH + 1.0, CZ, 0.86, 0.02, 2.12);
    for (let i = 0; i < 6; i++) {
      const z = CZ - 0.85 + i * 0.34, hh = 0.18 + (i === 2 || i === 3 ? 0.08 : 0);
      K.cyl(M.gold, alx + 0.2, CH + 1.02, z, 0.06, 0.025, hh, 8);
      candle(alx + 0.2, CH + 1.02 + hh, z);
    }
    // two standing candelabra either side
    for (const s of [-1, 1]) {
      const x = alx, z = CZ + s * 1.6;
      K.cyl(M.gold, x, CH, z, 0.18, 0.1, 0.12, 10);
      K.cyl(M.gold, x, CH + 0.12, z, 0.04, 0.035, 1.4, 8);
      K.cyl(M.gold, x, CH + 1.52, z, 0.03, 0.16, 0.06, 10);
      for (const k of [-0.11, 0, 0.11]) candle(x, CH + 1.58, z + k, 0.22);
    }
    // the star lantern on its chain from the arch
    {
      const x = IN.x1 - 0.6, y = 5.6;
      K.add(M.iron, rodGeo([x, y + 0.4, CZ], [x, spring + r - 0.05, CZ], 0.014, 4), { shadow: false });
      K.add(CM.lantern, place(new THREE.CylinderGeometry(0.34, 0.34, 0.6, 6), { x, y, z: CZ }), { shadow: false });
      K.add(CM.lantern, place(new THREE.ConeGeometry(0.34, 0.36, 6), { x, y: y + 0.48, z: CZ }), { shadow: false });
      K.add(CM.lantern, place(new THREE.ConeGeometry(0.34, 0.5, 6), { x, y: y - 0.55, z: CZ, rx: Math.PI }), { shadow: false });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        K.add(M.gold, rodGeo([x + Math.cos(a) * 0.35, y - 0.31, CZ + Math.sin(a) * 0.35], [x + Math.cos(a) * 0.35, y + 0.31, CZ + Math.sin(a) * 0.35], 0.018, 4), { shadow: false });
      }
      K.cyl(M.gold, x, y + 0.66, CZ, 0.06, 0.035, 0.12, 8);
    }
  }

  /* ---- the east wall either side of the apse: the Ten Controllments,
     I-V on the left as you face the altar (north), VI-X on the right */
  for (const [z, lines] of [
    [CZ - APSE.r - 0.7, ["THE TEN", "CONTROLLMENTS", "I · THOU SHALT NOT RAGE QUIT", "II · FEED NO TROLLS", "III · U MAD? NO.", "IV · PROBLEM? NONE", "V · GG, ALWAYS"]],
    [CZ + APSE.r + 0.7, ["THE TEN", "CONTROLLMENTS", "VI · STAY GRINNING", "VII · LURK MOAR", "VIII · TAKE NOT THE BAIT", "IX · BLESSED ARE THE AFK", "X · KEEP CALM, TROLL ON"]],
  ]) {
    K.box(CM.timber, IN.x1 - 0.03, CH + 1.6, z, 0.06, 1.62, 1.3);
    K.add(new THREE.MeshStandardMaterial({ map: rulesTexture(lines), emissiveMap: rulesTexture(lines), emissive: 0x6a6050, roughness: 0.6 }),
      place(new THREE.PlaneGeometry(1.16, 1.32), { x: IN.x1 - 0.065, y: CH + 2.41, z, ry: -Math.PI / 2 }), { shadow: false });
  }

  /* ---- the chancel: the pulpit in the north corner, the communion rail
     across the apse's mouth */
  const pulpit = { x: 102.85, z: IN.z0 + 0.7 };
  {
    const { x: px, z: pz } = pulpit;
    K.api.ghostBox(px, (IN.z0 + pz + 0.45) / 2, 0.9, pz + 0.45 - IN.z0, 1.15, { y: CH, pen: 4 });   // to the wall: no gap behind
    K.cyl(CM.oak, px, CH, pz, 0.3, 0.44, 1.05, 8);
    K.cyl(CM.timber, px, CH + 1.05, pz, 0.48, 0.48, 0.08, 8);
    K.box(M.gold, px - 0.3, CH + 1.12, pz, 0.3, 0.03, 0.42, { rz: -0.35 });
    for (const [a, b] of [[CZ - APSE.r, CZ - 1.0], [CZ + 1.0, CZ + APSE.r]]) {
      const zc = (a + b) / 2, L = b - a;
      K.api.ghostBox(RAIL_X, zc, 0.14, L, 0.85, { y: CH, pen: 0.8 });
      K.box(CM.oak, RAIL_X, CH + 0.78, zc, 0.14, 0.07, L);
      K.box(CM.oak, RAIL_X, CH + 0.05, zc, 0.1, 0.06, L);
      K.box(CM.velvet, RAIL_X - 0.25, CH, zc, 0.3, 0.09, L - 0.1, {}, { shadow: false });
      for (let z = a + 0.15; z < b - 0.05; z += 0.24) K.cyl(M.gold, RAIL_X, CH + 0.11, z, 0.025, 0.025, 0.67, 6, {}, { shadow: false });
    }
  }

  /* ---- the pews, dark oak with carved ends, facing east; their seats */
  const seats = [], rests = [];
  {
    const endShape = new THREE.Shape();
    endShape.moveTo(0.56, 0);
    endShape.lineTo(0, 0);
    endShape.lineTo(0, 1.0);
    endShape.lineTo(0.14, 1.0);
    endShape.quadraticCurveTo(0.34, 1.0, 0.42, 0.74);
    endShape.quadraticCurveTo(0.46, 0.62, 0.56, 0.62);
    endShape.lineTo(0.56, 0);
    const endGeo = new THREE.ExtrudeGeometry(endShape, { depth: 0.07, bevelEnabled: false, curveSegments: 6 });
    const pew = (x, z0, z1) => {
      const zc = (z0 + z1) / 2, L = z1 - z0;
      K.box(CM.oak, x + 0.03, F + 0.4, zc, 0.44, 0.05, L - 0.1);
      K.box(CM.oak, x - 0.2, F + 0.45, zc, 0.04, 0.5, L - 0.1, { rz: 0.1 });
      K.box(CM.oak, x - 0.29, F + 0.74, zc, 0.12, 0.03, L - 0.1);
      K.box(CM.oak, x + 0.2, F + 0.07, zc, 0.06, 0.05, L - 0.1);
      for (const ze of [z0, z1 - 0.07]) K.add(CM.oak, endGeo.clone().translate(x - 0.29, F, ze));
    };
    for (const rows of PEW_BLOCKS) {
      for (const side of ["north", "south"]) {
        const [z0, z1] = PEW_Z[side];
        const aisle = side === "north" ? z1 : z0, s = side === "north" ? -1 : 1;
        for (const x of rows) {
          pew(x, z0, z1);
          // two seats a pew, the aisle end and the middle, facing the altar;
          // you get up into the aisle
          for (const d of [0.7, 2.1]) seats.push({ x: x + 0.03, z: aisle + s * d, y: F + 0.45, floor: F, yaw: -Math.PI / 2, kind: "pew", stand: { x, z: CZ + s * 0.45 } });
          // a bot sits in every other row's aisle end a while (bots.js rest)
          if (rows.indexOf(x) % 2 === 0) rests.push({ act: "sit", x, z: CZ + s * 0.45, y: F, at: { x: x + 0.03, z: aisle + s * 0.7 }, yaw: -Math.PI / 2, w: 1 });
        }
        const x0 = rows[0] - 0.32, x1 = rows[rows.length - 1] + 0.3;
        K.api.ghostBox((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, 1.2, { y: F, pen: 1.5 });
      }
    }
    endGeo.dispose();
    // the churchgoers, frozen mid-sermon; nobody sits in their seats
    for (const [name, x, z] of SITTERS) {
      const i = seats.findIndex((s) => Math.abs(s.x - (x + 0.03)) < 0.01 && Math.abs(s.z - z) < 0.01);
      if (i >= 0) seats.splice(i, 1);
      loadModel(`mq-${name}`, {}).then((obj) => {
        obj.position.set(x + 0.02, F, z);
        obj.rotation.y = Math.PI / 2;
        obj.traverse((n) => {
          if (!n.isMesh) return;
          // one baked atlas: hair, brows and lashes cut out of it, the rest opaque
          Object.assign(n.material, { transparent: false, alphaTest: 0.5, depthWrite: true });
          if (n.material.map) n.material.map.anisotropy = 4;
        });
        api.prop(obj);
      }).catch((e) => console.warn("mannequin", name, e));
    }
  }

  /* ---- the roof: brick gables, slates outside, the hammer beams and the
     painted panels inside */
  {
    const rise = ROOF_RISE, half = ROOF_HALF;
    const len = Math.hypot(half, rise), ang = Math.atan2(rise, half);
    const xm = (C.x0 + C.x1 + 0.4) / 2, xl = C.x1 + 0.4 - C.x0;
    for (const s of [-1, 1]) K.box(CM.slate, xm, C.h + rise / 2 - 0.12, CZ + s * half / 2, xl, 0.2, len, { rx: s * ang });
    for (const gx of [C.x0 + T / 2, C.x1 - T / 2]) {
      K.add(CM.brick, place(prismGeo([[-(C.z1 - C.z0) / 2, 0], [(C.z1 - C.z0) / 2, 0], [0, rise]], T), { x: gx, y: C.h, z: CZ, ry: Math.PI / 2 }));
    }
    K.box(CM.stoneDark, xm, C.h + rise - 0.1, CZ, xl + 0.1, 0.18, 0.3);
    // the underside of the slates, d metres out from the ridge line
    const under = (d) => C.h + rise - 0.12 - 0.1 / Math.cos(ang) - (rise / half) * d;
    const span = CZ - IN.z0;                       // 5.4: ridge to the wall's inner face
    const xa = IN.x0, xb = IN.x1, bay = 3.6;
    for (const s of [-1, 1]) {
      const zw = CZ + s * span, yw = under(span) - 0.03, yr = under(0) - 0.03;
      const pts = [[xa, yw, zw], [xb, yw, zw], [xb, yr, CZ], [xa, yr, CZ]];
      const u0 = xa / bay, u1 = xb / bay;
      K.add(CM.ceiling, quad(pts, [[u0, 0], [u1, 0], [u1, 1], [u0, 1]]), { shadow: false });
      // wall plate, purlins, the ridge beam
      K.box(CM.timber, (xa + xb) / 2, C.h - 0.05, zw - s * 0.2, xb - xa, under(span - 0.4) - C.h + 0.05, 0.45);
      for (const d of [1.5, 3.0, 4.3]) K.box(CM.timber, (xa + xb) / 2, under(d) - 0.2, CZ + s * d, xb - xa, 0.18, 0.2, { rx: s * ang });
    }
    K.box(CM.timber, (xa + xb) / 2, under(0) - 0.3, CZ, xb - xa, 0.26, 0.24);
    // the trusses
    const arc = (pts) => {
      for (let i = 1; i < pts.length; i++) K.add(CM.timber, rodGeo(pts[i - 1], pts[i], 0.095, 6));
    };
    for (const x of BAYS) {
      for (const s of [-1, 1]) {
        const Z = (d) => CZ + s * d;
        const dp = span - 0.13, dt = span - 1.1;     // wall post, hammer tip
        // the corbel and the wall post
        K.box(CM.stoneDark, x, C.h - 2.8, Z(span - 0.16), 0.36, 0.3, 0.32);
        K.box(CM.timber, x, C.h - 2.5, Z(dp), 0.22, 2.35, 0.24);
        // the hammer beam and its post up to the principal rafter
        K.box(CM.timber, x, C.h - 0.15, Z(span - 0.55), 0.24, 0.3, 1.1);
        K.box(CM.timber, x, C.h + 0.15, Z(dt), 0.2, under(dt) - C.h - 0.35, 0.2);
        K.add(M.gold, place(new THREE.SphereGeometry(0.1, 10, 8), { x, y: C.h - 0.2, z: Z(dt) }));
        K.cyl(M.gold, x, C.h - 0.5, Z(dt), 0.02, 0.07, 0.3, 8);
        // the curved brace under the hammer beam
        const lower = [];
        for (let i = 0; i <= 7; i++) {
          const a = (i / 7) * (Math.PI / 2);
          lower.push([x, C.h - 2.25 + 2.1 * Math.sin(a), Z(dt + (dp - dt) * Math.cos(a))]);
        }
        arc(lower);
        // the great arch from the hammer post up under the collar
        const upper = [];
        const top = under(1.4) - 0.42;
        for (let i = 0; i <= 10; i++) {
          const a = (i / 10) * (Math.PI / 2);
          upper.push([x, C.h + 0.35 + (top - C.h - 0.35) * Math.sin(a), Z(dt * Math.cos(a))]);
        }
        arc(upper);
        // the principal rafter
        const rl = Math.hypot(span, (rise / half) * span);
        K.box(CM.timber, x, (under(span) + under(0)) / 2 - 0.25, Z(span / 2), 0.22, 0.22, rl, { rx: s * ang });
      }
      K.box(CM.timber, x, under(1.4) - 0.42, CZ, 0.22, 0.24, 2.8);
    }
    // the opal lanterns hanging down the nave
    for (const x of BAYS) {
      const top = under(1.4) - 0.42;
      K.add(M.iron, rodGeo([x, 6.75, CZ], [x, top, CZ], 0.012, 4), { shadow: false });
      K.cyl(M.gold, x, 6.65, CZ, 0.06, 0.2, 0.1, 10);
      K.cyl(CM.opal, x, 6.05, CZ, 0.17, 0.17, 0.6, 12, {}, { shadow: false });
      K.cyl(M.gold, x, 5.95, CZ, 0.12, 0.19, 0.1, 10);
    }
  }

  /* ---- the organ loft over the door, its stair up the tower */
  {
    const xm = (IN.x0 + LOFT.x1) / 2, xl = LOFT.x1 - IN.x0, zl = IN.z1 - IN.z0;
    K.solid(xm, CZ, xl, zl, 0.3, { y: LOFT_Y - 0.3, mat: CM.timber, pen: 8 });
    K.add(CM.floor, place(new THREE.PlaneGeometry(xl, zl), { x: xm, y: LOFT_Y + 0.012, z: CZ, rx: -Math.PI / 2 }), { shadow: false });
    // the beam along its front, two posts under it (clear of the aisle and the pews)
    K.box(CM.timber, LOFT.x1 - 0.12, LOFT_Y - 0.55, CZ, 0.24, 0.3, zl);
    for (const z of [CZ - 3.6, CZ + 3.6]) K.solid(LOFT.x1 - 0.15, z, 0.26, 0.26, LOFT_Y - 0.55 - F, { y: F, mat: CM.timber, pen: 6 });
    // the balustrade
    K.api.ghostBox(LOFT.x1 - 0.05, CZ, 0.12, zl, 1.0, { y: LOFT_Y, pen: 0.8 });
    K.box(CM.oak, LOFT.x1 - 0.05, LOFT_Y + 0.92, CZ, 0.14, 0.08, zl);
    K.box(CM.oak, LOFT.x1 - 0.05, LOFT_Y, CZ, 0.12, 0.1, zl);
    for (let z = IN.z0 + 0.15; z < IN.z1 - 0.1; z += 0.26) K.cyl(CM.oak, LOFT.x1 - 0.05, LOFT_Y + 0.1, z, 0.035, 0.035, 0.82, 6, {}, { shadow: false });
    // the organ against the west wall, south of the stair's way in: the case
    // and the console, the pipes rising behind in a gold flat
    const oz0 = CZ - 0.6, oz1 = IN.z1 - 0.2;
    K.solid(IN.x0 + 0.45, (oz0 + oz1) / 2, 0.9, oz1 - oz0, 1.15, { y: LOFT_Y, mat: CM.oak, pen: 4 });
    K.box(CM.timber, IN.x0 + 0.95, LOFT_Y + 0.75, (oz0 + oz1) / 2 - 0.4, 0.2, 0.06, 1.6, { rz: -0.15 });
    K.box(CM.linen, IN.x0 + 0.96, LOFT_Y + 0.79, (oz0 + oz1) / 2 - 0.4, 0.12, 0.02, 1.5);
    const n = Math.floor((oz1 - oz0) / 0.3);
    for (let i = 0; i < n; i++) {
      const z = oz0 + 0.15 + i * ((oz1 - oz0 - 0.3) / (n - 1));
      const t = Math.abs(i - (n - 1) / 2) / ((n - 1) / 2);
      const h = 2.4 - 1.2 * t * t;
      K.cyl(M.gold, IN.x0 + 0.3, LOFT_Y + 1.15, z, 0.1, 0.1, h, 10);
      K.cyl(M.iron, IN.x0 + 0.42, LOFT_Y + 1.25, z, 0.045, 0.045, 0.12, 6, { rz: Math.PI / 2 }, { shadow: false });
    }
    // the stair: 14 steps up the tower's north wall, then through the wall
    const rise = (LOFT_Y - F) / STAIR.steps;
    api.stairs(STAIR.x, STAIR.z, STAIR.w, STAIR.steps, rise, STAIR.run, "+x", { ghost: true, y: F });
    for (let i = 0; i < STAIR.steps; i++) {
      const x = STAIR.x + STAIR.run * (i + 0.5), top = F + rise * (i + 1);
      K.box(CM.timber, x, F, STAIR.z, STAIR.run + 0.01, top - F - 0.06, STAIR.w);
      K.box(CM.oak, x - 0.01, top - 0.06, STAIR.z, STAIR.run + 0.03, 0.06, STAIR.w + 0.04);
    }
    const sx1 = STAIR.x + STAIR.run * STAIR.steps;
    K.solid((sx1 + IN.x0) / 2, STAIR.z, IN.x0 - sx1, STAIR.w, 0.3, { y: LOFT_Y - 0.3, mat: CM.timber, pen: 8 });
    // a handrail up its open side
    {
      const L = Math.hypot(sx1 - STAIR.x, LOFT_Y - F), a = Math.atan2(LOFT_Y - F, sx1 - STAIR.x);
      K.box(CM.oak, (STAIR.x + sx1) / 2, (F + LOFT_Y) / 2 + 0.9, STAIR.z + STAIR.w / 2 + 0.03, L, 0.07, 0.07, { rz: a });
      for (const t of [0.2, 0.5, 0.8]) K.cyl(CM.oak, STAIR.x + (sx1 - STAIR.x) * t, F + (LOFT_Y - F) * t, STAIR.z + STAIR.w / 2 + 0.03, 0.025, 0.025, 0.9, 6);
    }
  }

  /* ---- the tower: the west door, the rose window and the name board; a
     floor at 7 m shuts the belfry off (never a sniper's perch) */
  {
    const tx = (TW.x0 + TW.x1) / 2, tc = { ...common, h: TW.top, trim: CM.stoneDark };
    wall(K, M, { ...tc, axis: "x", at: TW.z0 + T / 2, a: TW.x0, b: TW.x1, out: -1 });
    wall(K, M, { ...tc, axis: "x", at: TW.z1 - T / 2, a: TW.x0, b: TW.x1, out: 1 });
    wall(K, M, { ...tc, axis: "z", at: TW.x0 + T / 2, a: TW.z0 + T, b: TW.z1 - T, out: -1, holes: [{ c: CZ, w: DOOR.w, spans: [[0, DOOR.h]] }] });
    archFill(K, CM.brick, { axis: "z", at: TW.x0 + T / 2, c: CZ, w: DOOR.w, top: DOOR.h, R: DOOR.w * 0.75, t: T - 0.02 });
    // its east face, above the nave's west wall, and the shut floor
    wall(K, M, { ...common, axis: "z", at: TW.x1 - T / 2, a: TW.z0 + T, b: TW.z1 - T, y: 7.0, h: TW.top - 7.0 });
    K.solid((TW.x0 + T + TW.x1 - T) / 2, CZ, TW.x1 - TW.x0 - 2 * T, TW.z1 - TW.z0 - 2 * T, 0.3, { y: 7.0, mat: CM.timber, pen: 8 });
    // corner quoins and a string course at the nave's eaves
    for (const [x, z] of [[TW.x0, TW.z0], [TW.x0, TW.z1], [TW.x1, TW.z0], [TW.x1, TW.z1]]) K.box(CM.stoneDark, x, 0, z, 0.5, TW.top, 0.5);
    K.box(CM.stoneDark, tx, C.h, CZ, TW.x1 - TW.x0 + 0.3, 0.25, TW.z1 - TW.z0 + 0.3);
    K.box(CM.stoneDark, tx, TW.top - 0.3, CZ, TW.x1 - TW.x0 + 0.4, 0.3, TW.z1 - TW.z0 + 0.4);
    // the rose window, outside and in
    for (const [x, ry] of [[TW.x0 - 0.01, -Math.PI / 2], [TW.x0 + T + 0.01, Math.PI / 2]]) {
      K.add(CM.rose, place(new THREE.CircleGeometry(1.05, 40), { x, y: 6.3, z: CZ, ry }), { shadow: false });
      K.add(CM.stoneDark, place(new THREE.TorusGeometry(1.1, 0.12, 6, 36), { x, y: 6.3, z: CZ, ry }));
    }
    K.add(new THREE.MeshBasicMaterial({ map: signTexture("ST. GRINSWORTH'S", { sub: "TROLL CITY", bg: "#141018", fg: "#e8c868", edge: "#5a2a1a" }), color: 0xffffff }),
      place(new THREE.PlaneGeometry(2.8, 0.7), { x: TW.x0 - 0.02, y: 4.45, z: CZ, ry: -Math.PI / 2 }), { shadow: false });
    // the belfry: stone piers at the corners, louvres between, the bell inside
    const B0 = TW.top, B1 = TW.belfry, bw = TW.x1 - TW.x0;
    K.box(CM.brick, tx, B0 - 0.2, CZ, bw, 0.2, bw);
    for (const [x, z] of [[TW.x0 + 0.5, TW.z0 + 0.5], [TW.x0 + 0.5, TW.z1 - 0.5], [TW.x1 - 0.5, TW.z0 + 0.5], [TW.x1 - 0.5, TW.z1 - 0.5]]) {
      K.box(CM.brick, x, B0, z, 1.0, B1 - B0, 1.0);
      K.box(CM.stoneDark, x, B0, z, 1.1, 0.3, 1.1);
    }
    for (const s of [-1, 1]) {
      for (let y = B0 + 0.5; y < B1 - 0.9; y += 0.32) {
        K.box(CM.timber, tx + s * (bw / 2 - 0.3), y, CZ, 0.04, 0.3, bw - 2.0, { rz: s * 0.6 });
        K.box(CM.timber, tx, y, CZ + s * (bw / 2 - 0.3), bw - 2.0, 0.3, 0.04, { rx: -s * 0.6 });
      }
      // a pointed arch over each opening
      archFill(K, CM.brick, { axis: "z", at: tx + s * (bw / 2 - 0.3), c: CZ, w: bw - 2.0, top: B1 - 0.2, R: bw - 2.0, t: 0.6, y: 0 });
      archFill(K, CM.brick, { axis: "x", at: CZ + s * (bw / 2 - 0.3), c: tx, w: bw - 2.0, top: B1 - 0.2, R: bw - 2.0, t: 0.6, y: 0 });
    }
    K.box(CM.brick, tx, B1 - 0.2, CZ, bw, 0.4, bw);
    K.add(M.gold, place(new THREE.CylinderGeometry(0.42, 0.8, 1.1, 18, 1, true), { x: tx, y: B0 + 1.6, z: CZ }));
    K.add(M.iron, place(new THREE.CylinderGeometry(0.05, 0.05, bw - 1.2, 4), { x: tx, y: B0 + 2.3, z: CZ, rx: Math.PI / 2 }));
    // the cornice, four pinnacles, the octagonal spire and the gold cross
    K.box(CM.stoneDark, tx, B1 + 0.2, CZ, bw + 0.5, 0.35, bw + 0.5);
    for (const [x, z] of [[TW.x0 + 0.3, TW.z0 + 0.3], [TW.x0 + 0.3, TW.z1 - 0.3], [TW.x1 - 0.3, TW.z0 + 0.3], [TW.x1 - 0.3, TW.z1 - 0.3]]) {
      K.add(CM.stoneDark, place(new THREE.ConeGeometry(0.32, 1.8, 4), { x, y: B1 + 0.55 + 0.9, z, ry: Math.PI / 4 }));
    }
    const sh = TW.spire - B1 - 0.55;
    K.add(CM.slate, place(new THREE.ConeGeometry(bw / 2 - 0.15, sh, 8), { x: tx, y: B1 + 0.55 + sh / 2, z: CZ, ry: Math.PI / 8 }));
    K.cyl(M.gold, tx, TW.spire - 0.2, CZ, 0.12, 0.08, 0.4, 8);
    K.box(M.gold, tx, TW.spire + 0.1, CZ, 0.12, 1.6, 0.12);
    K.box(M.gold, tx, TW.spire + 1.05, CZ, 0.12, 0.12, 0.8);
  }

  /* ---- outside: buttresses between the bays and at the east corners */
  for (const x of [...BAYS, C.x1 - 0.35]) {
    for (const z of [C.z0 - 0.35, C.z1 + 0.35]) {
      K.solid(x, z, 0.7, 0.7, 5.6, { mat: M.stone, pen: 10 });
      K.box(CM.stoneDark, x, 5.6, z, 0.8, 0.2, 0.8, { rx: z < CZ ? -0.3 : 0.3 });
    }
  }

  /* ---- the one light, warm, down the nave */
  const l = new THREE.PointLight(0xffc890, 16, 26, 1.8);
  l.position.set(93, 6.4, CZ);
  l.castShadow = false;
  root.add(l);

  K.flush();
  // everything here is live: drawn by code, not in Studio, never moved
  for (const c of api.colliders.slice(c0)) c.live = true;
  // and comes forth to kneel at the rail, knees on its velvet: walked up
  // to from the chancel, then in to it (the odds weigh against the pews)
  for (const dz of [-2.6, -1.5, 1.5, 2.6]) rests.push({ act: "pray", x: RAIL_X - 0.8, z: CZ + dz, y: CH, at: { x: RAIL_X - 0.35, z: CZ + dz }, yaw: -Math.PI / 2, w: 3 });
  return {
    seats,
    rests,
    preacher: { x: pulpit.x + 0.05, z: pulpit.z + 0.95, y: CH, yaw: Math.PI / 2 },
    stair: { a: { x: STAIR.x - 0.6, z: STAIR.z }, b: { x: STAIR.x + STAIR.run * STAIR.steps + 0.6, z: STAIR.z } },
  };
}
