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
// Same 10 x 10 m footprint; the apse pokes 2.7 m out of the west wall, up
// against the map's edge (its tiered stone benches cover the line where the
// edge's ghost wall starts, x = -51). One real light, the chapel's old one.
//
// hollowgrin.js hands its helpers in (H) rather than this file importing
// them back: the import tags (?v=) would make a second copy of that module.

import * as THREE from "three";
import { floorTexture, runnerTexture, ceilingTexture, friezeTexture, lancetTexture, domeTexture, apseWallTexture, sunburstTexture, frontalTexture, rulesTexture, lanternTexture, archFill, inward, quad, band } from "./chapel-art.js?v=ca1-tcs1";

export const CHAPEL = { x0: -49.5, x1: -39, z0: -3, z1: 7, h: 6.4 };
const T = 0.6;                                      // wall thickness
const CZ = (CHAPEL.z0 + CHAPEL.z1) / 2;             // 2: down the aisle
const IN = { x0: CHAPEL.x0 + T, x1: CHAPEL.x1 - T, z0: CHAPEL.z0 + T, z1: CHAPEL.z1 - T };
const APSE = { x: -49.2, r: 2.5, R: 3.0, spring: 3.4 };
const CHANCEL = { x: -47.9, step: -47.5, y: 0.3 };  // platform west of x, a 0.15 step to `step`
const RAIL_X = -47.35;
const ROOF_RISE = 3.5, ROOF_HALF = (CHAPEL.z1 - CHAPEL.z0) / 2 + 0.4;
const TRUSSES = [-48.2, -45.6, -42.8, -40.1];
// Pew rows (centres). The south side breaks for the cross aisle to the side
// door. Each run of pews is ONE collider, 1.2 m tall (over the 1.1 m jump):
// the 0.5 m gaps between rows were somewhere zombies (who need 1.7 m) could
// never reach you. The front row stands 1.7 m off the rail for the same reason,
// and the apse behind the altar is shut off (see buildChapel).
const PEW_ROWS = { north: [-45.3, -44.25, -43.2, -42.15, -41.1, -40.05], south: [-45.3, -44.25, -41.1, -40.05] };
const PEW = { north: [IN.z0 + 0.1, CZ - 0.9], south: [CZ + 0.9, IN.z1 - 0.1] };
const LANCETS_N = [-47, -44.2, -41.4], LANCETS_S = [-47.2, -40.9];
const LANCET = { w: 1.1, lo: 1.8, hi: 4.6 };
export const CHAPEL_SIDE_DOOR = { c: -42.6, w: 1.8, h: 3.1 };
const EAST_DOOR = { w: 2.2, h: 3.75 };

/* ================================================================== build */

export function buildChapel(api, K, M, SP, root, lights, H) {
  const { place, wall, rodGeo, prismGeo, candle, jack, headstoneGeo, signTexture, surfMat, texMat, flickerMat, rng, ZSPAWNS } = H;
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
  wall(K, { axis: "x", at: C.z0 + T / 2, a: C.x0, b: C.x1, h: C.h, t: T, mat: CM.brick, trim: M.stoneDark, out: -1, holes: LANCETS_N.map(win) });
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
      ["x", IN.z0, 1, IN.x0, IN.x1, []],
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
      if (axis === "x") K.add(CM.frieze, band(axis, at + face * 0.01, IN.x0, IN.x1, 5.85, 6.35, face, 0.5), { shadow: false });
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
        K.box(M.stoneDark, x, 3.6, Z(span - 0.16), 0.36, 0.3, 0.32);
        K.box(CM.timber, x, 3.9, Z(dp), 0.22, C.h - 0.15 - 3.9, 0.24);
        // the hammer beam and its post up to the principal rafter
        K.box(CM.timber, x, C.h - 0.15, Z(span - 0.5), 0.24, 0.3, 1.0);
        K.box(CM.timber, x, C.h + 0.15, Z(dt), 0.2, under(dt) - C.h - 0.35, 0.2);
        K.add(M.gold, place(new THREE.SphereGeometry(0.09, 10, 8), { x, y: C.h - 0.2, z: Z(dt) }));
        K.cyl(M.gold, x, C.h - 0.48, Z(dt), 0.02, 0.06, 0.28, 8);
        // the curved brace under the hammer beam
        const lower = [];
        for (let i = 0; i <= 7; i++) {
          const a = (i / 7) * (Math.PI / 2);
          lower.push([x, 4.15 + (C.h - 0.15 - 4.15) * Math.sin(a), Z(dt + (dp - dt) * Math.cos(a))]);
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
      K.add(M.iron, rodGeo([x, 6.15, CZ], [x, under(1.3) - 0.42, CZ], 0.012, 4), { shadow: false });
      K.cyl(M.gold, x, 6.05, CZ, 0.06, 0.2, 0.1, 10);
      K.cyl(CM.opal, x, 5.45, CZ, 0.17, 0.17, 0.6, 12, {}, { shadow: false });
      K.cyl(M.gold, x, 5.35, CZ, 0.12, 0.19, 0.1, 10);
      SP.add(x, 5.75, CZ, 0xfff0c8, { size: 1.4, blink: 0.05 });
    }
  }

  /* ---- outside: buttresses, the rose window on the east gable, the sign,
     the bell tower */
  for (const [x, z] of [[-45.6, C.z0 - 0.35], [-42.6, C.z0 - 0.35], [-46.0, C.z1 + 0.35], [-39.9, C.z1 + 0.35]]) {
    K.solid(x, z, 0.7, 0.7, 4.6, { mat: M.stone, pen: 10 });
    K.box(M.stoneDark, x, 4.6, z, 0.8, 0.2, 0.8, { rx: 0.3 });
  }
  for (const [x, ry] of [[IN.x1 - 0.01, -Math.PI / 2], [C.x1 + 0.01, Math.PI / 2]]) {
    K.add(M.rose, place(new THREE.CircleGeometry(0.85, 36), { x, y: 5.45, z: CZ, ry }), { shadow: false });
    K.add(M.stoneDark, place(new THREE.TorusGeometry(0.9, 0.1, 6, 32), { x, y: 5.45, z: CZ, ry }));
  }
  K.add(new THREE.MeshBasicMaterial({ map: signTexture(["ST. GRINSWORTH'S"], { bg: "#141018", fg: "#e8c868", edge: "#5a2a1a" }), color: 0xffffff }),
    place(new THREE.PlaneGeometry(2.6, 0.42), { x: C.x1 + 0.02, y: 4.16, z: CZ, ry: Math.PI / 2 }), { shadow: false });
  {
    // a bellcote astride the east gable: a slab in the gable wall's own
    // thickness (so nothing shows inside), the open bell stage over the ridge
    const tx = C.x1 - T / 2, tz = CZ, ridge = C.h + ROOF_RISE;
    K.box(CM.brick, tx, ridge - 1.6, tz, T, 2.3, 1.8);
    K.box(CM.brick, tx, ridge - 0.3, tz, 1.5, 1.0, 1.2);
    for (const [dx, dz] of [[-0.6, -0.45], [0.6, -0.45], [-0.6, 0.45], [0.6, 0.45]]) K.box(M.stone, tx + dx, ridge + 0.7, tz + dz, 0.24, 1.8, 0.24);
    K.box(M.stoneDark, tx, ridge + 2.5, tz, 1.7, 0.3, 1.4);
    K.add(M.roof, place(new THREE.ConeGeometry(1.1, 2.4, 4), { x: tx, y: ridge + 2.8 + 1.2, z: tz, ry: Math.PI / 4 }));
    K.cyl(M.iron, tx, ridge + 5.2, tz, 0.04, 0.02, 0.8, 4);
    K.box(M.iron, tx, ridge + 5.65, tz, 0.05, 0.05, 0.45);
    K.add(M.gold, place(new THREE.CylinderGeometry(0.16, 0.38, 0.55, 14, 1, true), { x: tx, y: ridge + 1.45, z: tz }));
    K.add(M.iron, place(new THREE.CylinderGeometry(0.035, 0.035, 0.95, 4), { x: tx, y: ridge + 1.8, z: tz, rx: Math.PI / 2 }));
  }

  /* ---- the one light, warm, and dust in it */
  const l = new THREE.PointLight(0xffc890, 12, 18, 2);
  l.position.set(-45.2, 5.4, CZ);
  lights.push(l);
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
