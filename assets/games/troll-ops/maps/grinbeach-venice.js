// Troll Forces: Grin Beach's new strips (GRIN BEACH 5a), "Venice". The
// bigger map's west strip has Muscle Beach and a skate plaza, the east strip
// a basketball court, the boardwalk's new ends a row of vendor stalls, and
// the volleyball net its court. gb-venice (models/build_grinbeach.blender.py
// build_venice) draws them; this lays their colliders, the signs and the
// court's chain link. The layout numbers are the builder's: change one,
// change the other.

import * as THREE from "three";
import { mapModel } from "./map-models.js?v=hg6e-sr1-or1-tx1-sp1-kbt1-gb1-kbb2";
import { shopSignMaterial } from "./map-dressing.js?v=hg6e-sr1-or1-tb1-tb2";

export const MUSCLE = { x: -48, z: -4, w: 13, d: 12 };
export const SKATE = { x: -48, z: 23.5, w: 13, d: 13 };
export const COURT = { x: 48, z: -6, w: 14, d: 26, lines: [41.5, 54.5, -18.5, 6.5], hoopZ: [-17.8, 5.8], rimY: 3.05 };
export const STALLS = [[41.5, "SHAVED ICE", 0xe2483a], [46.5, "VENICE TEES", 0x2aa8a0], [51.5, "SHADES $5", 0xf2b52e],
  [-42, "HENNA", 0xe86aa8], [-48, "PSYCHIC 5¢", 0x8a5ad8]];
export const STALL_Z = 14.2;
export const VB = [-1, 7, -19.5, -4.5];
export const RACKS = [[-28, 6.5], [10, -19.4]];
/* The tennis court (user, 2026-10-23), past the basketball court: the slab
   (centre, width, depth), the doubles lines, the net, the fence's gates. */
export const TENNIS = { x: 64.5, z: -6.1, w: 15, d: 27.8, dw: 10.97 / 2, dl: 23.77 / 2, netY: 0.914, postY: 1.07,
  gates: [["w", 1.0, 4.0], ["n", 61.0, 64.0]] };
/* The rims, for the ball (5d): centre and height. */
export const RIMS = COURT.hoopZ.map((hz, i) => ({ x: COURT.x, y: COURT.rimY, z: hz + (i === 0 ? 0.38 : -0.38) }));

export const VENICE_PALMS = [[-44, 7], [-52, 7], [-53, -15], [44, 21], [52, 21], [37.5, -16], [58, 18], [70, 13], [66, 30], [59, 35]];
export const VENICE_SPAWNS = [[-48, 34], [48, 30], [-47, -14], [50, 20], [64, 22]];

const G = { ghost: true };

/* A fence run as colliders, open over `gaps` (fractions along it), like the
   builder's fence_run. */
function fenceRun(api, x0, z0, x1, z1, h, gaps = []) {
  let spans = [[0, 1]];
  for (const [ga, gb] of gaps) {
    spans = spans.flatMap(([a, b]) => (gb <= a || ga >= b ? [[a, b]] : [...(ga > a ? [[a, ga]] : []), ...(gb < b ? [[gb, b]] : [])]));
  }
  for (const [a, b] of spans) {
    const ax = x0 + (x1 - x0) * a, az = z0 + (z1 - z0) * a, bx = x0 + (x1 - x0) * b, bz = z0 + (z1 - z0) * b;
    const along = Math.abs(bx - ax) > Math.abs(bz - az);
    api.box((ax + bx) / 2, (az + bz) / 2, along ? Math.abs(bx - ax) : 0.12, along ? 0.12 : Math.abs(bz - az), h, { ...G, pen: 0.4 });
  }
}

/* Chain link: a diamond mesh on a canvas, alpha-tested, both sides. */
let linkTex = null;
function chainLinkMaterial() {
  if (!linkTex) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    g.clearRect(0, 0, 64, 64);
    g.strokeStyle = "#b8bec4";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 32); g.lineTo(32, 0); g.lineTo(64, 32); g.lineTo(32, 64); g.closePath();
    g.stroke();
    linkTex = new THREE.CanvasTexture(c);
    linkTex.wrapS = linkTex.wrapT = THREE.RepeatWrapping;
    linkTex.colorSpace = THREE.SRGBColorSpace;
    linkTex.anisotropy = 4;
  }
  return new THREE.MeshStandardMaterial({ map: linkTex, alphaTest: 0.4, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.4 });
}

function sign(api, text, color, { x, y, z, w, h = 0.55, ry = 0 }) {
  const board = new THREE.Mesh(new THREE.PlaneGeometry(w, h), shopSignMaterial(text, color));
  board.position.set(x, y, z);
  board.rotation.y = ry;
  api.prop(board);
}

export function buildVenice(api) {
  mapModel(api, "gb-venice", { x: 0, z: 0 });

  /* Muscle Beach */
  const { x: mx, z: mz, w: mw, d: md } = MUSCLE;
  const x0 = mx - mw / 2, x1 = mx + mw / 2, z0 = mz - md / 2, z1 = mz + md / 2;
  fenceRun(api, x0, z0, x1, z0, 1.05);
  fenceRun(api, x0, z1, x1, z1, 1.05, [[0.42, 0.62]]);
  fenceRun(api, x0, z0, x0, z1, 1.05);
  fenceRun(api, x1, z0, x1, z1, 1.05, [[0.38, 0.62]]);
  for (const gz of [mz - 1.6, mz + 1.6]) api.cylinder(x1, gz, 0.12, 3.4, { ...G, pen: 2 });
  sign(api, "MUSCLE BEACH", 0x2f6cc8, { x: x1 + 0.13, y: 2.95, z: mz, w: 3.0, ry: Math.PI / 2 });
  sign(api, "MUSCLE BEACH", 0x2f6cc8, { x: x1 - 0.13, y: 2.95, z: mz, w: 3.0, ry: -Math.PI / 2 });
  for (const bx of [-52, -49.5]) {
    api.box(bx, -7, 0.4, 1.25, 0.5, { ...G, pen: 1.5 });
    for (const px of [-0.55, 0.55]) api.cylinder(bx + px, -7.45, 0.06, 1.15, { ...G, pen: 1 });
  }
  for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) api.cylinder(-46 + dx, -7 + dz, 0.06, 2.36, { ...G, pen: 1 });
  for (const dz of [-1.6, 1.6]) api.cylinder(-51.5, -1 + dz, 0.08, 2.9, { ...G, pen: 1 });
  api.box(-45.5, 0.5, 2.4, 0.65, 0.95, { ...G, pen: 1.5 });
  api.cylinder(-53, 1, 0.3, 1.2, { ...G, pen: 1.5 });

  /* the skate plaza: the ledge, the rail, the funbox and its banks, the
     quarter pipe (banks are short stairs: the movement has no slopes) */
  api.box(-47, 19.5, 6, 0.6, 0.53, { ...G, pen: 3 });
  api.box(-44.65, 26.5, 4.3, 0.1, 0.82, { ...G, pen: 0.4 });
  api.box(-49, 24, 3, 2, 0.5, { ...G, pen: 3 });
  api.stairs(-52.1, 24, 2, 2, 0.25, 0.8, "+x", G);
  api.stairs(-45.9, 24, 2, 2, 0.25, 0.8, "-x", G);
  api.stairs(-52.4, 23.5, 11, 7, 0.24, 0.3, "-x", G);

  /* the basketball court: the end fences (chain link), the poles, the
     backboards, bleachers as steps */
  const C = COURT;
  const link = chainLinkMaterial();
  for (const fz of [C.z - C.d / 2 - 0.2, C.z + C.d / 2 + 0.2]) {
    api.box(C.x, fz, C.w, 0.1, 3.4, { ...G, pen: 0.3 });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(C.w, 3.3), link);
    panel.position.set(C.x, 1.75, fz);
    const t = panel.material.map;
    panel.material = link;
    t.repeat.set(C.w / 0.06 / 8, 3.3 / 0.06 / 8);
    api.prop(panel);
  }
  for (const [i, hz] of C.hoopZ.entries()) {
    const s = i === 0 ? 1 : -1;
    api.cylinder(C.x, hz - s * 1.8, 0.14, 3.55, { ...G, pen: 3 });
    api.box(C.x, hz - s * 0.025, 1.8, 0.06, 1.05, { ...G, y: 2.9, pen: 1 });
  }
  api.stairs(37.6, -7, 12, 3, 0.42, 0.85, "+x", G);

  /* the tennis court: chain link all round (open at the gates), the net
     (soft cover, bullets through), the umpire's chair, the benches, the
     bleachers north of it as steps */
  const T = TENNIS;
  const tx0 = T.x - T.w / 2, tx1 = T.x + T.w / 2, tz0 = T.z - T.d / 2, tz1 = T.z + T.d / 2;
  for (const [side, fixed, a0, a1, alongX] of [["s", tz0, tx0, tx1, true], ["n", tz1, tx0, tx1, true], ["w", tx0, tz0, tz1, false], ["e", tx1, tz0, tz1, false]]) {
    let spans = [[a0, a1]];
    for (const [gs, ga, gb] of T.gates) if (gs === side) spans = spans.flatMap(([a, b]) => [[a, ga], [gb, b]]);
    for (const [a, b] of spans) {
      const L = b - a, m = (a + b) / 2;
      api.box(alongX ? m : fixed, alongX ? fixed : m, alongX ? L : 0.1, alongX ? 0.1 : L, 3.4, { ...G, pen: 0.3 });
      // one material with the court's: its map repeats across COURT.w, so
      // the UVs stretch to keep the diamonds the same size
      const geo = new THREE.PlaneGeometry(L, 3.3);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (L / COURT.w));
      const panel = new THREE.Mesh(geo, link);
      panel.position.set(alongX ? m : fixed, 1.75, alongX ? fixed : m);
      if (!alongX) panel.rotation.y = Math.PI / 2;
      api.prop(panel);
    }
  }
  for (const px of [T.x - T.dw - 0.914, T.x + T.dw + 0.914]) api.cylinder(px, T.z, 0.06, T.postY, { ...G, pen: 1 });
  api.box(T.x, T.z, 2 * (T.dw + 0.914), 0.05, T.netY - 0.08, { ...G, y: 0.08, pen: 0.2 });
  api.box(T.x + T.dw + 1.6, T.z, 1.0, 1.0, 1.86, { ...G, pen: 1 });
  for (const bz of [T.z - 2.2, T.z + 2.2]) api.box(T.x - T.dw - 1.2, bz, 0.45, 1.8, 0.51, { ...G, pen: 1.5 });
  api.stairs(T.x, tz1 + 2.2, 9, 3, 0.42, 0.85, "+z", G);

  /* vendor stalls on the boardwalk */
  for (const [sx, name, col] of STALLS) {
    api.box(sx, STALL_Z, 2.6, 0.9, 0.95, { ...G, y: 0.45, pen: 2 });
    api.box(sx, STALL_Z + 0.12, 2.8, 1.8, 0.12, { ...G, y: 0.45 + 2.4, pen: 0.5 });
    for (const dx of [-1.3, 1.3]) api.cylinder(sx + dx, STALL_Z - 0.55, 0.05, 2.3, { ...G, y: 0.45, pen: 1 });
    sign(api, name, col, { x: sx, y: 0.45 + 2.85, z: STALL_Z - 0.79, w: 2.2, h: 0.42, ry: Math.PI });
  }

  /* volleyball: the referee's chair, bleachers */
  api.box(8.9, -10.6, 1.0, 1.0, 1.96, { ...G, pen: 1 });
  api.stairs(9.5, -7, 4.8, 3, 0.38, 0.6, "+x", G);

  /* surfboard racks */
  for (const [rx, rz] of RACKS) api.box(rx, rz, 2.9, 1.0, 1.35, { ...G, pen: 0.6 });
}
