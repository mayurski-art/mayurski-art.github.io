// Troll Forces — Hollowgrin: St. Grinsworth's chapel, rebuilt whole.
//
// Was a ruin (a breach in the south wall, half a roof); now it's the
// Gothic-revival chapel of the two reference photos: warm brick, a dark
// hammer-beam roof over red-and-gold painted panels, stained-glass lancets,
// pews either side of a red-carpet aisle, a raised altar on red steps under
// a gold trollface sunburst, and behind it a half-domed apse in blue-green
// and gold mosaic with a text band and a hanging star lantern. The breach
// is a side door now; the rose window moved to the east gable.
//
// Widened and raised (the user: "feel free to make the church bigger"): the
// nave 10.5 x 13.5 m, its walls 7.6 m, and a tower on its north-east corner
// (models/hg_chapel.py, hg-chapel-tower.glb: the belfry, the parapet, the
// spire, the clocks' roundels, troll gargoyles) whose bell swings and
// tolls, its rope down in the ringing room through the nave's north wall,
// a clock stuck at thirteen, bats round the belfry; a pipe organ by the
// east door that a ghost plays (hg-organ.glb). The apse pokes 2.7 m out
// of the west wall, up against the map's edge (its tiered stone benches cover
// the line where the edge's ghost wall starts, x = -51). One real light.
//
// hollowgrin.js hands its helpers in (H) rather than this file importing
// them back: the import tags (?v=) would make a second copy of that module.

import * as THREE from "three";
import { bellToll, organChord } from "./hollowgrin-chapel-sound.js?v=hgb2";
import { floorTexture, runnerTexture, ceilingTexture, friezeTexture, lancetTexture, domeTexture, apseWallTexture, sunburstTexture, frontalTexture, rulesTexture, lanternTexture, archFill, inward, quad, band } from "./chapel-art.js?v=ca1-tcs1";

export const CHAPEL = { x0: -49.5, x1: -39, z0: -5, z1: 8.5, h: 7.6 };
// the tower (hg_chapel.py TW): its shaft, belfry and spire; the ringing room
// at its foot through the nave's north wall
export const CHAPEL_TOWER = { x0: -42.6, x1: -39, z0: -8.4, z1: -4.4, shaft: 14.6, belfry: 18.2, spire: 26 };
const TOWER_DOOR = { c: -40.8, w: 1.3, h: 2.6 };
const ROOM_CEIL = 3.0;
const BELL = { x: -40.8, y: 16.75, z: -6.4 };      // the bell's axle (hg_chapel.py PIVOT)
const CLOCK = { y: 12.3, r: 0.95 };
// the organ against the east wall south of the door (hg_chapel.py ORGAN,
// CONSOLE, BENCH), clear of the south lancet's frame
const ORGAN = { x0: -40.15, x1: -39.6, z0: 4.6, z1: 7.4, h: 6.6 };
const ORGAN_CONSOLE = { x0: -40.7, x1: -40.15, z0: 5.1, z1: 6.7, h: 1.1 };
const ORGAN_BENCH = { x0: -41.3, x1: -40.9, z0: 5.3, z1: 6.5, h: 0.5 };
const T = 0.6;                                      // wall thickness
const CZ = (CHAPEL.z0 + CHAPEL.z1) / 2;             // 1.75: down the aisle
const IN = { x0: CHAPEL.x0 + T, x1: CHAPEL.x1 - T, z0: CHAPEL.z0 + T, z1: CHAPEL.z1 - T };
const APSE = { x: -49.2, r: 2.5, R: 3.0, spring: 3.4 };
const CHANCEL = { x: -47.9, step: -47.5, y: 0.3 };  // platform west of x, a 0.15 step to `step`
const RAIL_X = -47.35;
const ROOF_RISE = 4.6, ROOF_HALF = (CHAPEL.z1 - CHAPEL.z0) / 2 + 0.4;
const TRUSSES = [-48.2, -45.6, -42.8, -40.1];
// Pew rows (centres). The south side breaks for the cross aisle to the side
// door. Each run of pews is ONE collider, 1.2 m tall (over the 1.1 m jump):
// the 0.5 m gaps between rows were somewhere zombies (who need 1.7 m) could
// never reach you. The front row stands 1.7 m off the rail for the same reason,
// and the apse behind the altar is shut off (see buildChapel).
const PEW_ROWS = { north: [-45.3, -44.25, -43.2, -42.15, -41.1, -40.05], south: [-45.3, -44.25] };   // (the organ: the south's east end)
const PEW = { north: [IN.z0 + 0.1, CZ - 0.9], south: [CZ + 0.9, IN.z1 - 0.1] };
const LANCETS_N = [-47, -44.2], LANCETS_S = [-47.2, -40.9];
const LANCET = { w: 1.2, lo: 2.0, hi: 5.6 };
export const CHAPEL_SIDE_DOOR = { c: -42.6, w: 1.8, h: 3.1 };
const EAST_DOOR = { w: 2.2, h: 3.75 };

/* ================================================================== build */

export function buildChapel(api, K, M, SP, root, lights, H) {
  const { place, wall, rodGeo, prismGeo, candle, jack, headstoneGeo, signTexture, surfMat, texMat, flickerMat, rng, ZSPAWNS, hgModel, ticker, ghostTroll, audio } = H;
  const C = CHAPEL;
  const R = rng(2027);
  const CM = {
    brick: surfMat("brick", 0xc89a5a, { mix: 0.3, tile: 1.2, bounce: 0.1 }),
    timber: surfMat("wood", 0x3a2216, { mix: 0.12, tile: 1, bounce: 0.06 }),
    oak: surfMat("wood", 0x7a4a28, { mix: 0.3, tile: 1, bounce: 0.3 }),
    marble: surfMat("marble", 0xd8cfc0, { mix: 0.4, tile: 1.2, bounce: 0.14 }),
    floor: texMat(floorTexture(), { tile: 1.6, rough: 0.55 }),
    carpet: new THREE.MeshStandardMaterial({ map: runnerTexture(), roughness: 0.95, emissive: 0x2a0606 }),
    velvet: new THREE.MeshStandardMaterial({ color: 0x7c1218, roughness: 0.95, emissive: 0x1a0404 }),
    linen: new THREE.MeshStandardMaterial({ color: 0xf0ece0, roughness: 0.9, emissive: 0x2a2824 }),
    ceiling: new THREE.MeshStandardMaterial({ map: ceilingTexture(), emissiveMap: ceilingTexture(), emissive: 0x6a5a50, roughness: 0.85, side: THREE.DoubleSide }),
    frieze: new THREE.MeshStandardMaterial({ map: friezeTexture(), emissiveMap: friezeTexture(), emissive: 0x504040, roughness: 0.8 }),
    lancet: new THREE.MeshBasicMaterial({ map: lancetTexture(), alphaTest: 0.5, side: THREE.DoubleSide, color: new THREE.Color(0xffffff).multiplyScalar(1.35) }),
    dome: new THREE.MeshStandardMaterial({ map: domeTexture(), emissiveMap: domeTexture(), emissive: 0xa8a090, roughness: 0.45, metalness: 0.15 }),
    apseWall: new THREE.MeshStandardMaterial({ map: apseWallTexture(), emissiveMap: apseWallTexture(), emissive: 0x8a8070, roughness: 0.5, metalness: 0.15 }),
    domeOut: new THREE.MeshStandardMaterial({ color: 0x4a6a62, roughness: 0.55, metalness: 0.3 }),
    sunburst: new THREE.MeshBasicMaterial({ map: sunburstTexture(), alphaTest: 0.35, color: new THREE.Color(0xffffff).multiplyScalar(0.72) }),
    frontal: new THREE.MeshStandardMaterial({ map: frontalTexture(), emissiveMap: frontalTexture(), emissive: 0x3a3030, roughness: 0.9 }),
    lantern: flickerMat({ map: lanternTexture(), color: new THREE.Color(0xffffff).multiplyScalar(1.5), strength: 0.35, speed: 0.3 }),
    opal: flickerMat({ color: new THREE.Color(0xfff0c8).multiplyScalar(1.3), strength: 0.25, speed: 0.4 }),
  };

  /* ---- floor: tiles, the runner, the chancel */
  K.add(CM.floor, place(new THREE.PlaneGeometry(IN.x1 - IN.x0, IN.z1 - IN.z0), { x: (IN.x0 + IN.x1) / 2, y: 0.016, z: CZ, rx: -Math.PI / 2 }), { shadow: false });
  const runner = (x0, x1, y, w) => {
    const g = new THREE.PlaneGeometry(x1 - x0, w);
    const uv = g.attributes.uv.array;
    for (let i = 0; i < uv.length; i += 2) uv[i] *= (x1 - x0) / 1.2;
    K.add(CM.carpet, place(g, { x: (x0 + x1) / 2, y, z: CZ, rx: -Math.PI / 2 }), { shadow: false });
  };
  runner(CHANCEL.step, IN.x1, 0.022, 1.2);
  // the chancel: a step, then the platform on into the apse
  K.solid((CHANCEL.x + CHANCEL.step) / 2, CZ, CHANCEL.step - CHANCEL.x, IN.z1 - IN.z0, 0.15, { mat: CM.marble, pen: 8 });
  K.solid((IN.x0 + CHANCEL.x) / 2, CZ, CHANCEL.x - IN.x0, IN.z1 - IN.z0, CHANCEL.y, { mat: CM.marble, pen: 8 });
  K.api.ghostBox(APSE.x - APSE.r / 2 + 0.15, CZ, APSE.r + 0.3, APSE.r * 2, CHANCEL.y, { pen: 8 });
  K.add(CM.marble, place(new THREE.CircleGeometry(APSE.r, 28, Math.PI / 2, Math.PI), { x: APSE.x, y: CHANCEL.y + 0.001, z: CZ, rx: -Math.PI / 2 }), { shadow: false });
  runner(CHANCEL.x, CHANCEL.step, 0.152, 1.2);
  K.box(CM.velvet, CHANCEL.step + 0.005, 0.005, CZ, 0.01, 0.14, 1.2, {}, { shadow: false });
  K.add(CM.carpet, place(new THREE.PlaneGeometry(CHANCEL.x - IN.x0 + 1.0, 3.0), { x: (IN.x0 + CHANCEL.x) / 2 - 0.5, y: CHANCEL.y + 0.004, z: CZ, rx: -Math.PI / 2 }), { shadow: false });
  K.box(CM.velvet, CHANCEL.x + 0.005, 0.15, CZ, 0.01, 0.15, 3.0, {}, { shadow: false });

  /* ---- the walls: brick, stone dressings, the lancets, two doors, the apse arch */
  const win = (c) => ({ c, w: LANCET.w, spans: [[LANCET.lo, LANCET.hi]] });
  const D = CHAPEL_SIDE_DOOR;
  wall(K, { axis: "x", at: C.z0 + T / 2, a: C.x0, b: C.x1, h: C.h, t: T, mat: CM.brick, trim: M.stoneDark, out: -1,
    holes: [...LANCETS_N.map(win), { c: TOWER_DOOR.c, w: TOWER_DOOR.w, spans: [[0, TOWER_DOOR.h]] }] });
  wall(K, { axis: "x", at: C.z1 - T / 2, a: C.x0, b: C.x1, h: C.h, t: T, mat: CM.brick, trim: M.stoneDark, out: 1,
    holes: [...LANCETS_S.map(win), { c: D.c, w: D.w, spans: [[0, D.h]] }] });
  wall(K, { axis: "z", at: C.x0 + T / 2, a: C.z0 + T, b: C.z1 - T, h: C.h, t: T, mat: CM.brick,
    holes: [{ c: CZ, w: APSE.r * 2, spans: [[0, APSE.spring + APSE.r]] }] });
  wall(K, { axis: "z", at: C.x1 - T / 2, a: C.z0 + T, b: C.z1 - T, h: C.h, t: T, mat: CM.brick, trim: M.stoneDark, out: 1,
    holes: [{ c: CZ, w: EAST_DOOR.w, spans: [[0, EAST_DOOR.h]] }] });
  // the arches in the tops of the openings, and the glass
  for (const [at, list] of [[C.z0 + T / 2, LANCETS_N], [C.z1 - T / 2, LANCETS_S]]) {
    for (const c of list) {
      archFill(K, CM.brick, { axis: "x", at, c, w: LANCET.w, top: LANCET.hi, R: LANCET.w, t: T - 0.02 });
      K.add(CM.lancet, place(new THREE.PlaneGeometry(LANCET.w, LANCET.hi - LANCET.lo), { x: c, y: (LANCET.lo + LANCET.hi) / 2, z: at }), { shadow: false });
    }
  }
  archFill(K, CM.brick, { axis: "x", at: C.z1 - T / 2, c: D.c, w: D.w, top: D.h, R: D.w * 0.75, t: T - 0.02 });
  archFill(K, CM.brick, { axis: "x", at: C.z0 + T / 2, c: TOWER_DOOR.c, w: TOWER_DOOR.w, top: TOWER_DOOR.h, R: TOWER_DOOR.w * 0.75, t: T - 0.02 });
  archFill(K, CM.brick, { axis: "z", at: C.x1 - T / 2, c: CZ, w: EAST_DOOR.w, top: EAST_DOOR.h, R: EAST_DOOR.w * 0.75, t: T - 0.02 });
  archFill(K, CM.brick, { axis: "z", at: C.x0 + T / 2, c: CZ, w: APSE.r * 2, top: APSE.spring + APSE.r, R: APSE.r, t: T - 0.02 });
  // the apse arch's gold moulding, nave side
  K.add(M.gold, place(new THREE.TorusGeometry(APSE.r + 0.05, 0.07, 6, 40, Math.PI), { x: IN.x0 + 0.02, y: APSE.spring, z: CZ, ry: Math.PI / 2 }));
  for (const s of [-1, 1]) K.box(M.gold, IN.x0 + 0.03, 0, CZ + s * (APSE.r + 0.05), 0.08, APSE.spring, 0.14);
  // the doors, swung open against the outside
  const leaf = (x, z, w, h, axis) => {
    K.box(CM.oak, x, 0, z, axis === "x" ? w : 0.07, h, axis === "x" ? 0.07 : w);
    for (const y of [0.5, h - 0.7]) K.box(M.iron, x, y, z, axis === "x" ? w * 0.9 : 0.09, 0.07, axis === "x" ? 0.09 : w * 0.9);
  };
  for (const s of [-1, 1]) {
    leaf(D.c + s * (D.w / 2 + 0.5), C.z1 + 0.06, 0.9, 2.5, "x");
    leaf(C.x1 + 0.06, CZ + s * (EAST_DOOR.w / 2 + 0.58), 1.1, 2.9, "z");
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
      ["x", IN.z0, 1, IN.x0, IN.x1, [[TOWER_DOOR.c - TOWER_DOOR.w / 2 - 0.1, TOWER_DOOR.c + TOWER_DOOR.w / 2 + 0.1]]],
      ["x", IN.z1, -1, IN.x0, IN.x1, [[D.c - D.w / 2 - 0.1, D.c + D.w / 2 + 0.1]]],
      ["z", IN.x1, -1, IN.z0, IN.z1, [[CZ - EAST_DOOR.w / 2 - 0.1, CZ + EAST_DOOR.w / 2 + 0.1]]],
    ];
    for (const [axis, at, face, a, b, gaps] of sides) {
      for (const [s, e] of runsOf(a, b, gaps)) {
        const m = (s + e) / 2, L = e - s, off = at + face * 0.025;
        const [x, z] = axis === "x" ? [m, off] : [off, m];
        K.box(CM.oak, x, 0, z, axis === "x" ? L : 0.05, 1.05, axis === "x" ? 0.05 : L, {}, { shadow: false });
        const [rx, rz] = axis === "x" ? [m, at + face * 0.05] : [at + face * 0.05, m];
        K.box(CM.timber, rx, 1.02, rz, axis === "x" ? L : 0.1, 0.08, axis === "x" ? 0.1 : L, {}, { shadow: false });
      }
      if (axis === "x") K.add(CM.frieze, band(axis, at + face * 0.01, IN.x0, IN.x1, C.h - 0.75, C.h - 0.25, face, 0.5), { shadow: false });
    }
  }

  /* ---- the apse: half cylinder, half dome, tiered stone benches */
  {
    const { x: ax, r, R: Ro, spring } = APSE;
    for (let i = 0; i <= 12; i++) {
      const th = Math.PI / 2 + (i / 12) * Math.PI, rr = (r + Ro) / 2 + 0.05;
      K.api.ghostBox(ax + Math.cos(th) * rr, CZ + Math.sin(th) * rr, 0.62, 0.62, C.h, { pen: 10 });
    }
    // CylinderGeometry: x = r sin(theta), so the west half is theta pi..2pi
    K.add(CM.brick, place(new THREE.CylinderGeometry(Ro, Ro, spring, 28, 1, true, Math.PI, Math.PI), { x: ax, y: spring / 2, z: CZ }));
    K.add(CM.apseWall, place(inward(new THREE.CylinderGeometry(r, r, spring - CHANCEL.y, 28, 1, true, Math.PI, Math.PI)), { x: ax, y: (spring + CHANCEL.y) / 2, z: CZ }), { shadow: false });
    K.add(CM.brick, place(new THREE.RingGeometry(r, Ro, 28, 1, Math.PI / 2, Math.PI), { x: ax, y: spring, z: CZ, rx: -Math.PI / 2 }), { shadow: false });
    // SphereGeometry: x = -r cos(phi) sin(theta), so the west half is phi -pi/2..pi/2
    K.add(CM.dome, place(inward(new THREE.SphereGeometry(r, 40, 14, -Math.PI / 2, Math.PI, 0, Math.PI / 2)), { x: ax, y: spring, z: CZ }), { shadow: false });
    K.add(CM.domeOut, place(new THREE.SphereGeometry(Ro, 28, 10, -Math.PI / 2, Math.PI, 0, Math.PI / 2), { x: ax, y: spring, z: CZ }));
    // the synthronon: two tiers of stone bench round the curve
    const tier = (r0, r1, y0, h) => {
      K.add(CM.marble, place(inward(new THREE.CylinderGeometry(r0, r0, h, 24, 1, true, Math.PI, Math.PI)), { x: ax, y: y0 + h / 2, z: CZ }));
      K.add(CM.marble, place(new THREE.RingGeometry(r0, r1, 24, 1, Math.PI / 2, Math.PI), { x: ax, y: y0 + h, z: CZ, rx: -Math.PI / 2 }), { shadow: false });
    };
    tier(1.8, r, CHANCEL.y, 0.45);
    tier(2.15, r, CHANCEL.y + 0.45, 0.45);
    for (let i = 0; i <= 10; i++) {
      const th = Math.PI / 2 + 0.12 + (i / 10) * (Math.PI - 0.24);
      K.api.ghostBox(ax + Math.cos(th) * 2.2, CZ + Math.sin(th) * 2.2, 0.62, 0.62, CHANCEL.y + 0.45, { pen: 6 });
    }
    // the sunburst, over the altar on the back of the apse
    K.add(CM.sunburst, place(new THREE.PlaneGeometry(2.3, 2.3), { x: ax - 2.13, y: 2.75, z: CZ, ry: Math.PI / 2 }), { shadow: false });
    // the altar: marble block, the frontal, linen, six candles in gold sticks
    const alx = ax - 0.75;
    K.solid(alx, CZ, 0.8, 2.0, 1.0, { y: CHANCEL.y, mat: CM.marble, pen: 8 });
    // nobody goes behind the altar: the apse floor is a pocket zombies can't
    // reach, so it's shut (the altar's front is the line, a little over head
    // height for a jump; bullets go on through)
    K.api.ghostBox((ax - APSE.r + alx + 0.4) / 2, CZ, alx + 0.4 - (ax - APSE.r), APSE.r * 2, 1.25, { y: CHANCEL.y, pen: 0.5 });
    K.add(CM.frontal, place(new THREE.PlaneGeometry(1.9, 0.9), { x: alx + 0.405, y: CHANCEL.y + 0.5, z: CZ, ry: Math.PI / 2 }), { shadow: false });
    K.box(CM.linen, alx, CHANCEL.y + 1.0, CZ, 0.86, 0.02, 2.12);
    for (let i = 0; i < 6; i++) {
      const z = CZ - 0.85 + i * 0.34, hh = 0.18 + (i === 2 || i === 3 ? 0.08 : 0);
      K.cyl(M.gold, alx - 0.2, CHANCEL.y + 1.02, z, 0.06, 0.025, hh, 8);
      candle(K, M, alx - 0.2, CHANCEL.y + 1.02 + hh, z, { seed: 3100 + i, h: 0.2 });
    }
    // two standing candelabra either side
    for (const s of [-1, 1]) {
      const x = alx, z = CZ + s * 1.45;
      K.cyl(M.gold, x, CHANCEL.y, z, 0.18, 0.1, 0.12, 10);
      K.cyl(M.gold, x, CHANCEL.y + 0.12, z, 0.04, 0.035, 1.4, 8);
      K.cyl(M.gold, x, CHANCEL.y + 1.52, z, 0.03, 0.16, 0.06, 10);
      for (const k of [-0.11, 0, 0.11]) candle(K, M, x, CHANCEL.y + 1.58, z + k, { seed: 3120 + s * 10 + k * 100, h: 0.22 });
    }
    // the star lantern on its chain from the arch
    {
      const x = IN.x0 + 0.6, y = 4.4;
      K.add(M.iron, rodGeo([x, y + 0.4, CZ], [x, APSE.spring + APSE.r - 0.05, CZ], 0.012, 4), { shadow: false });
      K.add(CM.lantern, place(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 6), { x, y, z: CZ }), { shadow: false });
      K.add(CM.lantern, place(new THREE.ConeGeometry(0.28, 0.3, 6), { x, y: y + 0.4, z: CZ }), { shadow: false });
      K.add(CM.lantern, place(new THREE.ConeGeometry(0.28, 0.42, 6), { x, y: y - 0.46, z: CZ, rx: Math.PI }), { shadow: false });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        K.add(M.gold, rodGeo([x + Math.cos(a) * 0.29, y - 0.26, CZ + Math.sin(a) * 0.29], [x + Math.cos(a) * 0.29, y + 0.26, CZ + Math.sin(a) * 0.29], 0.015, 4), { shadow: false });
      }
      K.cyl(M.gold, x, y + 0.55, CZ, 0.05, 0.03, 0.1, 8);
      SP.add(x, y, CZ, 0xffb050, { size: 3.2, blink: 0.12 });
    }
  }

  /* ---- the west wall either side of the apse: the Ten Controllments,
     I-V on the left as you face the altar (+z), VI-X on the right */
  for (const [z, lines] of [
    [CZ + APSE.r + 0.95, ["THE TEN", "CONTROLLMENTS", "I · THOU SHALT NOT RAGE QUIT", "II · FEED NO TROLLS", "III · U MAD? NO.", "IV · PROBLEM? NONE", "V · GG, ALWAYS"]],
    [CZ - APSE.r - 0.95, ["THE TEN", "CONTROLLMENTS", "VI · STAY GRINNING", "VII · LURK MOAR", "VIII · TAKE NOT THE BAIT", "IX · BLESSED ARE THE AFK", "X · KEEP CALM, TROLL ON"]],
  ]) {
    K.box(CM.timber, IN.x0 + 0.03, CHANCEL.y + 1.5, z, 0.06, 1.95, 1.62);   // up 0.3: the priest's raised hand hid line V
    K.add(new THREE.MeshStandardMaterial({ map: rulesTexture(lines), emissiveMap: rulesTexture(lines), emissive: 0x6a6050, roughness: 0.6 }),
      place(new THREE.PlaneGeometry(1.44, 1.62), { x: IN.x0 + 0.065, y: CHANCEL.y + 2.475, z, ry: Math.PI / 2 }), { shadow: false });
  }

  /* ---- the chancel: pulpit and the communion rail */
  {
    const px = -48.4, pz = IN.z0 + 0.95;
    K.api.ghostBox(px, (IN.z0 + pz + 0.5) / 2, 1.0, pz + 0.5 - IN.z0, 1.15, { y: CHANCEL.y, pen: 4 });   // to the wall: no gap behind
    K.cyl(CM.oak, px, CHANCEL.y, pz, 0.32, 0.48, 1.05, 8);
    K.cyl(CM.timber, px, CHANCEL.y + 1.05, pz, 0.52, 0.52, 0.08, 8);
    K.box(M.gold, px + 0.32, CHANCEL.y + 1.12, pz, 0.3, 0.03, 0.42, { rz: 0.35 });
    // (the lectern's corner is the priest's: hollowgrin-mannequins.js)
    // the rail, with a gap on the aisle
    for (const [a, b] of [[IN.z0, CZ - 1.0], [CZ + 1.0, IN.z1]]) {
      const zc = (a + b) / 2, L = b - a;
      K.api.ghostBox(RAIL_X, zc, 0.14, L, 0.85, { pen: 0.8 });
      K.box(CM.oak, RAIL_X, 0.78, zc, 0.14, 0.07, L);
      K.box(CM.oak, RAIL_X, 0.05, zc, 0.1, 0.06, L);
      K.box(CM.velvet, RAIL_X + 0.25, 0, zc, 0.3, 0.09, L - 0.1, {}, { shadow: false });
      for (let z = a + 0.15; z < b - 0.05; z += 0.24) K.cyl(M.gold, RAIL_X, 0.11, z, 0.025, 0.025, 0.67, 6, {}, { shadow: false });
    }
  }

  /* ---- the pews, dark oak with carved ends */
  {
    const endShape = new THREE.Shape();
    endShape.moveTo(0, 0);
    endShape.lineTo(0.56, 0);
    endShape.lineTo(0.56, 1.0);
    endShape.lineTo(0.42, 1.0);
    endShape.quadraticCurveTo(0.22, 1.0, 0.14, 0.74);
    endShape.quadraticCurveTo(0.1, 0.62, 0, 0.62);
    endShape.lineTo(0, 0);
    const endGeo = new THREE.ExtrudeGeometry(endShape, { depth: 0.07, bevelEnabled: false, curveSegments: 6 });
    const pew = (x, z0, z1) => {
      const zc = (z0 + z1) / 2, L = z1 - z0;
      K.box(CM.oak, x - 0.03, 0.4, zc, 0.44, 0.05, L - 0.1);
      K.box(CM.oak, x + 0.2, 0.45, zc, 0.04, 0.5, L - 0.1, { rz: -0.1 });
      K.box(CM.oak, x + 0.29, 0.74, zc, 0.12, 0.03, L - 0.1);
      K.box(CM.oak, x - 0.2, 0.07, zc, 0.06, 0.05, L - 0.1);
      for (const ze of [z0, z1 - 0.07]) K.add(CM.oak, endGeo.clone().translate(x - 0.27, 0, ze));
    };
    for (const side of ["north", "south"]) {
      const [z0, z1] = PEW[side], rows = PEW_ROWS[side];
      rows.forEach((x) => pew(x, z0, z1));
      let first = rows[0];
      rows.forEach((x, i) => {
        if (i < rows.length - 1 && rows[i + 1] - x < 1.2) return;
        K.api.ghostBox((first - 0.28 + x + 0.32) / 2, (z0 + z1) / 2, x + 0.32 - first + 0.28, z1 - z0, 1.2, { pen: 1.5 });
        first = rows[i + 1];
      });
    }
    endGeo.dispose();
  }

  /* ---- the roof: brick gables, slates outside, the hammer beams and the
     painted panels inside */
  {
    const rise = ROOF_RISE, half = ROOF_HALF;
    const len = Math.hypot(half, rise), ang = Math.atan2(rise, half);
    const xm = (C.x0 + C.x1) / 2, xl = C.x1 - C.x0;
    for (const s of [-1, 1]) K.box(M.roof, xm, C.h + rise / 2 - 0.12, CZ + s * half / 2, xl + 0.8, 0.2, len, { rx: s * ang });
    for (const gx of [C.x0 + T / 2, C.x1 - T / 2]) {
      K.add(CM.brick, place(prismGeo([[-(C.z1 - C.z0) / 2, 0], [(C.z1 - C.z0) / 2, 0], [0, rise]], T), { x: gx, y: C.h, z: CZ, ry: Math.PI / 2 }));
    }
    K.box(M.stoneDark, xm, C.h + rise - 0.1, CZ, xl + 0.9, 0.18, 0.3);
    // the underside of the slates, d metres out from the ridge line
    const under = (d) => C.h + rise - 0.12 - 0.1 / Math.cos(ang) - (rise / half) * d;
    const span = CZ - IN.z0;                       // 4.4: ridge to the wall's inner face
    const xa = IN.x0, xb = IN.x1, bay = 2.75;
    for (const s of [-1, 1]) {
      const zw = CZ + s * span, yw = under(span) - 0.03, yr = under(0) - 0.03;
      const pts = [[xa, yw, zw], [xb, yw, zw], [xb, yr, CZ], [xa, yr, CZ]];
      const u0 = xa / bay, u1 = xb / bay;
      K.add(CM.ceiling, quad(pts, [[u0, 0], [u1, 0], [u1, 1], [u0, 1]]), { shadow: false });
      // wall plate, purlins, the ridge beam
      K.box(CM.timber, (xa + xb) / 2, C.h - 0.05, zw - s * 0.2, xb - xa, under(span - 0.4) - C.h + 0.05, 0.45);
      for (const d of [1.5, 3.0]) K.box(CM.timber, (xa + xb) / 2, under(d) - 0.2, CZ + s * d, xb - xa, 0.18, 0.2, { rx: s * ang });
    }
    K.box(CM.timber, (xa + xb) / 2, under(0) - 0.3, CZ, xb - xa, 0.26, 0.24);
    // the trusses
    const arc = (pts) => {
      for (let i = 1; i < pts.length; i++) K.add(CM.timber, rodGeo(pts[i - 1], pts[i], 0.085, 6));
    };
    for (const x of TRUSSES) {
      for (const s of [-1, 1]) {
        const Z = (d) => CZ + s * d;
        const dp = span - 0.13, dt = span - 1.0;     // wall post, hammer tip
        // the corbel and the wall post
        K.box(M.stoneDark, x, C.h - 2.8, Z(span - 0.16), 0.36, 0.3, 0.32);
        K.box(CM.timber, x, C.h - 2.5, Z(dp), 0.22, 2.35, 0.24);
        // the hammer beam and its post up to the principal rafter
        K.box(CM.timber, x, C.h - 0.15, Z(span - 0.5), 0.24, 0.3, 1.0);
        K.box(CM.timber, x, C.h + 0.15, Z(dt), 0.2, under(dt) - C.h - 0.35, 0.2);
        K.add(M.gold, place(new THREE.SphereGeometry(0.09, 10, 8), { x, y: C.h - 0.2, z: Z(dt) }));
        K.cyl(M.gold, x, C.h - 0.48, Z(dt), 0.02, 0.06, 0.28, 8);
        // the curved brace under the hammer beam
        const lower = [];
        for (let i = 0; i <= 7; i++) {
          const a = (i / 7) * (Math.PI / 2);
          lower.push([x, C.h - 2.25 + 2.1 * Math.sin(a), Z(dt + (dp - dt) * Math.cos(a))]);
        }
        arc(lower);
        // the great arch from the hammer post up under the collar
        const upper = [];
        const top = under(1.3) - 0.42;
        for (let i = 0; i <= 10; i++) {
          const a = (i / 10) * (Math.PI / 2);
          upper.push([x, C.h + 0.35 + (top - C.h - 0.35) * Math.sin(a), Z(dt * Math.cos(a))]);
        }
        arc(upper);
        // the principal rafter
        const rl = Math.hypot(span, (rise / half) * span);
        K.box(CM.timber, x, (under(span) + under(0)) / 2 - 0.25, Z(span / 2), 0.22, 0.22, rl, { rx: s * ang });
      }
      K.box(CM.timber, x, under(1.3) - 0.42, CZ, 0.22, 0.24, 2.6);
    }
    // two opal lanterns hanging down the nave
    for (const x of [TRUSSES[1], TRUSSES[2]]) {
      K.add(M.iron, rodGeo([x, C.h - 0.25, CZ], [x, under(1.3) - 0.42, CZ], 0.012, 4), { shadow: false });
      K.cyl(M.gold, x, C.h - 0.35, CZ, 0.06, 0.2, 0.1, 10);
      K.cyl(CM.opal, x, C.h - 0.95, CZ, 0.17, 0.17, 0.6, 12, {}, { shadow: false });
      K.cyl(M.gold, x, C.h - 1.05, CZ, 0.12, 0.19, 0.1, 10);
      SP.add(x, C.h - 0.65, CZ, 0xfff0c8, { size: 1.4, blink: 0.05 });
    }
  }

  /* ---- outside: buttresses, the rose window on the east gable, the sign,
     the bell tower */
  for (const [x, z] of [[-46.4, C.z0 - 0.35], [-43.95, C.z0 - 0.35], [-46.0, C.z1 + 0.35], [-39.9, C.z1 + 0.35]]) {
    K.solid(x, z, 0.7, 0.7, 5.6, { mat: M.stone, pen: 10 });
    K.box(M.stoneDark, x, 5.6, z, 0.8, 0.2, 0.8, { rx: 0.3 });
  }
  for (const [x, ry] of [[IN.x1 - 0.01, -Math.PI / 2], [C.x1 + 0.01, Math.PI / 2]]) {
    K.add(M.rose, place(new THREE.CircleGeometry(1.15, 40), { x, y: C.h + 0.9, z: CZ, ry }), { shadow: false });
    K.add(M.stoneDark, place(new THREE.TorusGeometry(1.2, 0.12, 6, 36), { x, y: C.h + 0.9, z: CZ, ry }));
  }
  K.add(new THREE.MeshBasicMaterial({ map: signTexture(["ST. GRINSWORTH'S"], { bg: "#141018", fg: "#e8c868", edge: "#5a2a1a" }), color: 0xffffff }),
    place(new THREE.PlaneGeometry(2.6, 0.42), { x: C.x1 + 0.02, y: 4.16, z: CZ, ry: Math.PI / 2 }), { shadow: false });
  buildTower(api, K, M, SP, root, { place, wall, rodGeo, candle, hgModel, ticker, signTexture, audio });
  buildOrgan(api, K, M, root, { hgModel, ticker, ghostTroll, audio });

  /* ---- dust in the window's light (the light is the bake's) */
  SP.swarm(8, -44, CZ, 8, 7, 1.2, 5, 0xffe0a0, { size: 0.18, wander: 1.0, blink: 0.3 });

  /* ---- the churchyard, out of the side door */
  for (const [x, z] of [[-47.8, 10.4], [-45.6, 10.2], [-40.4, 10.6], [-48.2, 13.6], [-44.2, 14.2], [-39.8, 13.8]]) {
    const w = 0.6 + R() * 0.2, h = 0.8 + R() * 0.3;
    K.api.ghostBox(x, z, w, 0.3, h, { pen: 3 });
    K.add(R() < 0.5 ? M.stone : M.stoneDark, place(headstoneGeo(w, h, 0.18), { x, z, ry: (R() - 0.5) * 0.2 }));
  }
  for (const [x, z] of [[-46.4, 12.4], [-42.2, 12.0]]) {
    K.box(M.dirt, x, 0, z, 0.8, 0.08, 1.7, {}, { shadow: false });
    K.add(M.dirt, place(new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), { x: x + 0.85, y: 0, z, sx: 0.7, sy: 0.5, sz: 1.6 }));
    ZSPAWNS.push({ x, y: 0, z, rise: true });
  }
  jack(K, M, -44.6, 0, 9.4, { r: 0.26, face: Math.PI, seed: 3200 });
}

/* ================================================================== the tower */

/* The bell's toll, from the wall clock so every player sees (and hears) the
   same swing: once every TOLL.every seconds it swings up over a period,
   rings, and settles. tollAt(t) gives the bell's angle about its axle and
   the clapper's against it; the strikes are where the swing turns. */
export const TOLL = { every: 45, period: 2.6, up: 2.6, ring: 10.4, down: 13.0, max: 0.95 };
export function tollAt(t) {
  const s = ((t % TOLL.every) + TOLL.every) % TOLL.every;
  const amp = s < TOLL.up ? s / TOLL.up : s < TOLL.ring ? 1 : s < TOLL.down ? (TOLL.down - s) / (TOLL.down - TOLL.ring) : 0;
  const swing = (u) => {
    const a = u < TOLL.up ? u / TOLL.up : u < TOLL.ring ? 1 : u < TOLL.down ? (TOLL.down - u) / (TOLL.down - TOLL.ring) : 0;
    return TOLL.max * Math.max(0, a) * Math.sin((2 * Math.PI * u) / TOLL.period);
  };
  const bell = swing(s);
  // the clapper hangs back on its own swing, and lies against the lip when it gets there
  const clapper = Math.max(-0.42, Math.min(0.42, 0.75 * swing(Math.max(0, s - 0.32)) - bell));
  return { s, amp, bell, clapper };
}

/* A clock's dial: thirteen hours, XIII at the top where XII should be. */
function clockTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "#14121c";
  g.beginPath(); g.arc(256, 256, 252, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#c8a050"; g.lineWidth = 10;
  g.beginPath(); g.arc(256, 256, 236, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 3;
  g.beginPath(); g.arc(256, 256, 160, 0, Math.PI * 2); g.stroke();
  const N = ["XIII", "I", "II", "III", "IIII", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  g.fillStyle = "#e8d8a8";
  g.font = "bold 44px Georgia, serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * Math.PI * 2;
    g.save();
    g.translate(256 + Math.sin(a) * 198, 256 - Math.cos(a) * 198);
    g.rotate(a);
    g.fillText(N[i], 0, 0);
    g.restore();
    for (let k = 0; k < 5; k++) {                   // the minute ticks
      const b = a + (k / 5) * (Math.PI * 2 / 13);
      g.fillRect(256 + Math.sin(b) * 222 - 2, 256 - Math.cos(b) * 222 - 2, 4, 4);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function buildTower(api, K, M, SP, root, { wall, rodGeo, candle, hgModel, ticker, signTexture, place, audio }) {
  const TW = CHAPEL_TOWER, C = CHAPEL;
  const tx = (TW.x0 + TW.x1) / 2, tz = (TW.z0 + TW.z1) / 2;
  hgModel(api, "hg-chapel-tower");

  /* ---- colliders: the walls round the ringing room and up the shaft (the
     belfry's twin openings left open), the room's ceiling, the top */
  const lanc = (c0, c1, y0 = 0) => [-0.62, 0.62].map((d) => ({ c: (c0 + c1) / 2 + d, w: 0.9, spans: [[15.0 - y0, 17.6 - y0]] }));
  wall(K, { axis: "x", at: TW.z0 + T / 2, a: TW.x0, b: TW.x1, h: TW.belfry, t: T, pen: 10, holes: lanc(TW.x0 + T, TW.x1 - T) });
  wall(K, { axis: "z", at: TW.x0 + T / 2, a: TW.z0 + T, b: C.z0, h: TW.belfry, t: T, pen: 10, holes: lanc(TW.z0 + T, TW.z1 - T) });
  wall(K, { axis: "z", at: TW.x1 - T / 2, a: TW.z0 + T, b: C.z0, h: TW.belfry, t: T, pen: 10, holes: lanc(TW.z0 + T, TW.z1 - T) });
  wall(K, { axis: "x", at: TW.z1 - T / 2, a: TW.x0, b: TW.x1, y: C.h, h: TW.belfry - C.h, t: T, pen: 10, holes: lanc(TW.x0 + T, TW.x1 - T, C.h) });
  K.api.ghostBox(tx, (TW.z0 + T + C.z0) / 2, TW.x1 - TW.x0 - 2 * T, C.z0 - TW.z0 - T, 0.2, { y: ROOM_CEIL, pen: 6 });
  K.api.ghostBox(tx, tz, TW.x1 - TW.x0 - 2 * T, TW.z1 - TW.z0 - 2 * T, 0.1, { y: 14.5, pen: 6 });
  K.api.ghostBox(tx, tz, TW.x1 - TW.x0 + 0.24, TW.z1 - TW.z0 + 0.24, TW.spire - TW.belfry, { y: TW.belfry, pen: 10 });

  /* ---- the bell and its clapper, swung about the axle */
  const pivot = new THREE.Group();
  pivot.position.set(BELL.x, BELL.y, BELL.z);
  root.add(pivot);
  // (a faint warmth on the bronze, so it reads swinging in the dark belfry)
  hgModel(api, "hg-bell", { parent: pivot, then: (obj) => obj.traverse((n) => { if (n.isMesh && n.userData.blenderMat === "HG_BellBronze") n.material.emissive.setHex(0x4a3016); }) });
  const clap = new THREE.Group();
  pivot.add(clap);
  hgModel(api, "hg-bell-clapper", { parent: clap });

  /* ---- the ringing room: the rope down through its ceiling, the sally
     (the striped grip) at hand height, a candle on the bench, the peal board */
  const rope = new THREE.Group();
  rope.position.set(tx + 0.4, 0, tz);
  root.add(rope);
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xb09a68, roughness: 1 });
  rope.add(new THREE.Mesh(rodGeo([0, 0.95, 0], [0, ROOM_CEIL + 0.6, 0], 0.016, 5), ropeMat));
  const sally = document.createElement("canvas");
  sally.width = 16; sally.height = 64;
  {
    const g = sally.getContext("2d");
    for (let i = 0; i < 8; i++) { g.fillStyle = ["#a01e24", "#e8e0cc", "#1e3a8a", "#e8e0cc"][i % 4]; g.fillRect(0, i * 8, 16, 8); }
  }
  const sallyTex = new THREE.CanvasTexture(sally);
  sallyTex.colorSpace = THREE.SRGBColorSpace;
  rope.add(new THREE.Mesh(place(new THREE.CylinderGeometry(0.045, 0.045, 0.6, 8), { y: 1.55 }), new THREE.MeshStandardMaterial({ map: sallyTex, roughness: 1 })));
  candle(K, M, TW.x0 + T + 0.2, 0.47, C.z0 - 0.7, { seed: 3400, h: 0.16 });
  K.add(new THREE.MeshBasicMaterial({ map: signTexture(["ST. GRINSWORTH'S RINGERS", "A PEAL OF ONE BELL", "RUNG AT THE THIRTEENTH HOUR"], { w: 1024, h: 768, bg: "#2a1a10", fg: "#e8c868", edge: "#5a3a1a" }), color: 0xd8d0c0 }),
    place(new THREE.PlaneGeometry(1.12, 0.92), { x: tx, y: 1.8, z: TW.z0 + T + 0.045 }), { shadow: false });

  /* ---- the clocks: east, north, south, all stopped at XIII; the minute
     hand twitches as if it might go on, and doesn't */
  const dialMat = new THREE.MeshStandardMaterial({ map: clockTexture(), emissiveMap: null, emissive: 0x2a2418, roughness: 0.6 });
  const handMat = new THREE.MeshStandardMaterial({ color: 0xc8a050, roughness: 0.4, metalness: 0.8 });
  const minutes = [];
  for (const [x, z, ry] of [[TW.x1 + 0.05, tz, Math.PI / 2], [tx, TW.z0 - 0.05, Math.PI], [tx, TW.z1 + 0.05, 0]]) {
    const face = new THREE.Group();
    face.position.set(x, CLOCK.y, z);
    face.rotation.y = ry;
    root.add(face);
    face.add(new THREE.Mesh(new THREE.CircleGeometry(CLOCK.r, 40), dialMat));
    const hour = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.015).translate(0, 0.2, 0.012), handMat);
    hour.rotation.z = 0.04;
    face.add(hour);
    const minute = new THREE.Group();
    minute.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.72, 0.015).translate(0, 0.3, 0.03), handMat));
    // a trollface at the minute hand's tip, and on the boss
    minute.add(new THREE.Mesh(place(new THREE.PlaneGeometry(0.2, 0.2), { y: 0.72, z: 0.04 }), M.trollLit));
    face.add(minute);
    minutes.push(minute);
    face.add(new THREE.Mesh(place(new THREE.PlaneGeometry(0.24, 0.24), { z: 0.05 }), M.trollLit));
  }

  /* ---- bats round the belfry */
  const batMat = new THREE.MeshBasicMaterial({ color: 0x0a080c, side: THREE.DoubleSide });
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0.06, 0, 0, -0.08, 0.32, 0.02, -0.02, 0, 0, -0.08, 0.32, 0.02, -0.02, 0.22, -0.02, -0.12], 3));
  const bats = [];
  for (let i = 0; i < 9; i++) {
    const bat = new THREE.Group();
    bat.add(new THREE.Mesh(place(new THREE.SphereGeometry(0.06, 6, 4), { sz: 1.6 }), batMat));
    const wings = [1, -1].map((s) => {
      const w = new THREE.Mesh(wingGeo, batMat);
      w.scale.x = s;
      bat.add(w);
      return w;
    });
    root.add(bat);
    bats.push({ bat, wings, r: 2.6 + (i % 4) * 0.9, h: 15.5 + ((i * 1.7) % 6), w: (i % 2 ? 1 : -1) * (0.5 + (i % 3) * 0.18), p: i * 0.7 });
  }

  // a toll where the swing turns (the clapper on the lip), as loud as you're near
  let lastBell = 0, lastVel = 0;
  root.add(ticker((renderer, scene, camera) => {
    const now = performance.now() / 1000;
    const { bell, clapper } = tollAt(Date.now() / 1000);
    const vel = bell - lastBell;
    if (Math.abs(bell) > 0.35 && ((lastVel > 0 && vel <= 0) || (lastVel < 0 && vel >= 0))) {
      const d = camera.position.distanceTo(pivot.position);
      bellToll(audio(), 0.55 / (1 + (d / 14) ** 2));
    }
    lastBell = bell;
    if (vel !== 0) lastVel = vel;
    pivot.rotation.z = bell;
    clap.rotation.z = clapper;
    rope.position.y = 0.4 * (bell / TOLL.max);
    // the minute hands: a twitch now and then, back to XIII
    const tw = (now % 4.3) < 0.18 ? -0.09 : 0;
    for (const m of minutes) m.rotation.z = tw;
    for (const b of bats) {
      const a = b.p + now * b.w;
      b.bat.position.set(tx + Math.cos(a) * b.r, b.h + Math.sin(now * 1.3 + b.p) * 0.6, tz + Math.sin(a) * b.r);
      b.bat.rotation.y = -a + (b.w > 0 ? 0 : Math.PI);
      const f = Math.sin(now * 17 + b.p * 3) * 0.7;
      b.wings[0].rotation.z = f;
      b.wings[1].rotation.z = -f;
    }
  }));
}

/* ================================================================== the organ */

/* The ghost at the organ: once every ORGAN_PLAY.every seconds (between the
   bell's tolls) it fades in at the console and plays for ORGAN_PLAY.len
   seconds, a chord each ORGAN_PLAY.chord. organAt(t): whether it plays, how
   far it has faded in, and which chord. */
export const ORGAN_PLAY = { every: 45, at: 21, len: 9, fade: 1.5, chord: 1.1 };
export function organAt(t) {
  const s = ((t % ORGAN_PLAY.every) + ORGAN_PLAY.every) % ORGAN_PLAY.every - ORGAN_PLAY.at;
  const playing = s >= 0 && s < ORGAN_PLAY.len;
  const fade = s < -ORGAN_PLAY.fade || s > ORGAN_PLAY.len + ORGAN_PLAY.fade ? 0
    : s < 0 ? 1 + s / ORGAN_PLAY.fade : s > ORGAN_PLAY.len ? 1 - (s - ORGAN_PLAY.len) / ORGAN_PLAY.fade : 1;
  return { s, playing, fade, chord: playing ? Math.floor(s / ORGAN_PLAY.chord) : -1 };
}

function buildOrgan(api, K, M, root, { hgModel, ticker, ghostTroll, audio }) {
  const O = ORGAN, Cn = ORGAN_CONSOLE, B = ORGAN_BENCH;
  hgModel(api, "hg-organ");
  K.solid((O.x0 + O.x1) / 2, (O.z0 + O.z1) / 2, O.x1 - O.x0, O.z1 - O.z0, O.h, { pen: 8 });
  K.solid((Cn.x0 + Cn.x1) / 2, (Cn.z0 + Cn.z1) / 2, Cn.x1 - Cn.x0, Cn.z1 - Cn.z0, Cn.h, { pen: 4 });
  K.solid((B.x0 + B.x1) / 2, (B.z0 + B.z1) / 2, B.x1 - B.x0, B.z1 - B.z0, B.h, { pen: 2 });

  /* ---- the keys: two manuals of naturals and sharps, instanced; the ghost
     presses them */
  const N = 24, z0 = 5.27, kw = (6.53 - z0) / N;
  const manuals = [{ x: Cn.x0 + 0.1, y: 0.76 }, { x: Cn.x0 + 0.2, y: 0.84 }];
  const white = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 0.022, kw - 0.004), new THREE.MeshStandardMaterial({ color: 0xe8e0c8, roughness: 0.45 }), N * 2);
  const sharpsAt = [];
  for (let i = 0; i < N - 1; i++) if ([0, 1, 3, 4, 5].includes(i % 7)) sharpsAt.push(i);
  const black = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.02, kw * 0.55), new THREE.MeshStandardMaterial({ color: 0x141214, roughness: 0.4 }), sharpsAt.length * 2);
  root.add(white, black);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const setKeys = (pressed) => {
    manuals.forEach((mn, k) => {
      for (let i = 0; i < N; i++) {
        const down = pressed.has(k * 100 + i);
        e.set(0, 0, down ? -0.06 : 0);
        m4.compose(p.set(mn.x, mn.y - (down ? 0.008 : 0), z0 + (i + 0.5) * kw), q.setFromEuler(e), one);
        white.setMatrixAt(k * N + i, m4);
      }
      sharpsAt.forEach((i, j) => {
        const down = pressed.has(k * 100 + 50 + j);
        m4.compose(p.set(mn.x + 0.03, mn.y + 0.018 - (down ? 0.008 : 0), z0 + (i + 1) * kw), q.identity(), one);
        black.setMatrixAt(k * sharpsAt.length + j, m4);
      });
    });
    white.instanceMatrix.needsUpdate = true;
    black.instanceMatrix.needsUpdate = true;
  };
  setKeys(new Set());

  /* ---- the ghost on the bench, its own see-through copies of the mansion's
     ghost materials (so fading it leaves theirs be) */
  const body = M.ghostly.clone(), face = M.ghostFace.clone();
  const ghost = ghostTroll(M, body, face);
  ghost.position.set((B.x0 + B.x1) / 2, 0.12, (B.z0 + B.z1) / 2);
  ghost.rotation.y = Math.PI / 2;
  ghost.scale.set(1, 0.82, 1);
  root.add(ghost);
  const op = { body: body.opacity, face: face.opacity };

  let last = -2;
  root.add(ticker((renderer, scene, camera) => {
    const { fade, chord } = organAt(Date.now() / 1000);
    ghost.visible = fade > 0.01;
    body.opacity = op.body * fade;
    face.opacity = op.face * fade;
    ghost.position.y = 0.12 + Math.sin(performance.now() / 600) * 0.03;
    if (chord === last) return;
    last = chord;
    if (chord >= 0) {
      const d = Math.hypot(camera.position.x - (O.x0 + O.x1) / 2, camera.position.y - 2, camera.position.z - (O.z0 + O.z1) / 2);
      organChord(audio(), chord, 0.4 / (1 + (d / 8) ** 2), ORGAN_PLAY.chord);
    }
    const pressed = new Set();
    if (chord >= 0) {
      // three or four keys a hand, from the chord's number (the same for everyone)
      let h = (chord * 2654435761) >>> 0;
      const next = () => (h = (h * 1103515245 + 12345) >>> 0) / 4294967296;
      for (const k of [0, 1]) for (let n = 0; n < 3 + (chord % 2); n++) pressed.add(k * 100 + Math.floor(next() * N));
      if (next() < 0.6) pressed.add(50 + Math.floor(next() * sharpsAt.length));
    }
    setKeys(pressed);
  }));
}
