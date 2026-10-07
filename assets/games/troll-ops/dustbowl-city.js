// Troll Forces — Dust Bowl's city beyond the wall, and the mountains.
//
// Scenery only: nothing out here has a collider. It's built from a seed when
// the map loads (a few ms) instead of shipping as a model, which kept ~2.5 MB
// off the map's download. Three merged meshes: the plaster blocks (one
// textured material, the variants as vertex colours), flat paint, and the
// lamp-lit windows. None cast shadows: under the low sun they would reach
// right across the village.
//
// The wall is 5 m and the eye 1.6 m, so from the middle of the village a roof
// at distance D only shows above it if it stands taller than about
// 1.6 + 3.4 * D / 35 m: the ring against the wall is 2-3 storeys and the
// blocks get taller with distance, so the skyline carries over the wall.

import * as THREE from "three";
import { retexture } from "./surface-textures.js?v=hg6e";

/* Palms in the streets outside (drawn by map-dressing.js palmTrees in
   maps.js); the blocks keep clear of them. [x, z, height] */
export const CITY_PALMS = [[-44, -20, 7.5], [-45, 14, 8], [45, -26, 7], [44, 22, 8.5], [-18, -45, 7.5], [22, -46, 8],
  [-26, 45, 7], [14, 46, 8], [-58, -40, 9], [60, 30, 9], [-50, 58, 8.5], [40, -60, 9], [66, -8, 9], [-66, 4, 8.5]];
const MOSQUE = [96, -42];
const MINARETS = [[-62, -78, 26], [58, -108, 24], [-115, 25, 28], [30, 118, 24], [-72, 92, 22], [128, 74, 25]];
const WATER_TOWERS = [[-48, -58], [62, 70]];
// the sun (maps.js dustbowl sun.pos) sets east-south-east: low hills there
const SUN_AZ = Math.atan2(34, 90);

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Plaster tints as the model pipeline gives them (map_kit palette colour
   lifted 55% toward white, retexture's default), so the city matches the
   village's own walls. */
const lift = (hex) => new THREE.Color(hex).lerp(new THREE.Color(0xffffff), 0.55);
const PLASTER = [lift(0xd2b98e), lift(0xd2b98e), lift(0xb89c72), lift(0xf2e8d2)];
const C = (hex) => new THREE.Color(hex);
const MUD_FAR = [0xc8a878, 0xb89a70, 0xd4b88c, 0xa88c66, 0xc0a07a].map(C);
const PAINT = {
  black: C(0x151618), dark: C(0x33373c), white: C(0xe9e9e4), blue: C(0x2c5585), turq: C(0x2f8a8a),
  timber: C(0xc9a36a), rust: C(0x7a4028), yellow: C(0xe8ad22), sand: C(0xc8aa7c),
  hill: C(0x8a6a5a), hillDark: C(0x6a5058), lamp: C(0xffb860),
};

/* Triangle soup per material; flat normals, world-metre box UVs (the same
   projection map_kit.py gives the models). */
class Bucket {
  constructor() { this.p = []; this.n = []; this.c = []; this.uv = []; }
  tri(a, b, c, col) {
    const ab = new THREE.Vector3().subVectors(b, a), ac = new THREE.Vector3().subVectors(c, a);
    const n = ab.cross(ac).normalize();
    const ax = Math.abs(n.x) >= Math.abs(n.y) && Math.abs(n.x) >= Math.abs(n.z) ? 0 : Math.abs(n.y) >= Math.abs(n.z) ? 1 : 2;
    for (const v of [a, b, c]) {
      this.p.push(v.x, v.y, v.z);
      this.n.push(n.x, n.y, n.z);
      this.c.push(col.r, col.g, col.b);
      if (ax === 0) this.uv.push(v.z, v.y); else if (ax === 1) this.uv.push(v.x, v.z); else this.uv.push(v.x, v.y);
    }
  }
  quad(a, b, c, d, col) { this.tri(a, b, c, col); this.tri(a, c, d, col); }
  /* box of w (x) h (y) d (z), bottom on y, like api.box; no bottom face */
  box(col, w, h, d, x, y, z) {
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, y1 = y + h;
    const V = (a, b, c) => new THREE.Vector3(a, b, c);
    this.quad(V(x0, y1, z0), V(x0, y1, z1), V(x1, y1, z1), V(x1, y1, z0), col);   // top
    this.quad(V(x0, y, z1), V(x1, y, z1), V(x1, y1, z1), V(x0, y1, z1), col);     // +z
    this.quad(V(x1, y, z0), V(x0, y, z0), V(x0, y1, z0), V(x1, y1, z0), col);     // -z
    this.quad(V(x1, y, z1), V(x1, y, z0), V(x1, y1, z0), V(x1, y1, z1), col);     // +x
    this.quad(V(x0, y, z0), V(x0, y, z1), V(x0, y1, z1), V(x0, y1, z0), col);     // -x
  }
  /* frustum/cylinder from a to b (any direction), radii r0 -> r1 */
  cyl(col, r0, a, b, seg = 8, r1 = r0, caps = true) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const axis = new THREE.Vector3().subVectors(B, A).normalize();
    const u = new THREE.Vector3(Math.abs(axis.y) > 0.9 ? 1 : 0, Math.abs(axis.y) > 0.9 ? 0 : 1, 0).cross(axis).normalize();
    const v = new THREE.Vector3().crossVectors(axis, u);
    const ring = (C0, r) => Array.from({ length: seg }, (_, i) => {
      const t = (i / seg) * Math.PI * 2;
      return C0.clone().addScaledVector(u, Math.cos(t) * r).addScaledVector(v, Math.sin(t) * r);
    });
    const ra = ring(A, r0), rb = ring(B, r1);
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      this.quad(ra[i], ra[j], rb[j], rb[i], col);
      if (caps) { this.tri(B, rb[i], rb[j], col); this.tri(A, ra[j], ra[i], col); }
    }
  }
  mesh(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.c, 3));
    if (material.map) g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, material);
    m.castShadow = false;
    m.receiveShadow = true;
    return m;
  }
}

export function buildDustbowlCity() {
  const r = rng(77);
  const U = (a, b) => a + r() * (b - a);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const plaster = new Bucket(), paint = new Bucket(), lit = new Bucket();

  const keepClear = [...CITY_PALMS.map(([x, z]) => [x, z, 2.5]), [...MOSQUE, 20],
    ...MINARETS.map(([x, z]) => [x, z, 4]), ...WATER_TOWERS.map(([x, z]) => [x, z, 6])];
  const clear = (x, z, w, d) => keepClear.every(([cx, cz, rr]) => Math.abs(x - cx) > w / 2 + rr || Math.abs(z - cz) > d / 2 + rr);

  const parapet = (B, col, x, z, w, d, y, h = 0.5, t = 0.25) => {
    B.box(col, w, h, t, x, y, z - d / 2 + t / 2);
    B.box(col, w, h, t, x, y, z + d / 2 - t / 2);
    B.box(col, t, h, d - 2 * t, x - w / 2 + t / 2, y, z);
    B.box(col, t, h, d - 2 * t, x + w / 2 - t / 2, y, z);
  };

  /* One flat-roofed block. face: [nx, nz] of the side looking at the village
     (gets windows). detail 2 = plaster, parapet, windows, roof clutter;
     1 = flat paint (too far off for the plaster to show), a tank or hut;
     0 = the bare block. Windows only above 4 m: lower ones are behind the
     compound wall from everywhere you can stand. */
  function house(x, z, w, d, h, face, detail = 2) {
    const B = detail >= 2 ? plaster : paint;
    const col = detail >= 2 ? pick(PLASTER) : pick(MUD_FAR);
    B.box(col, w, h + 0.1, d, x, -0.1, z);
    let top = h;
    if (detail >= 1 && r() < 0.3) {                       // a stepped upper storey
      const uw = w * U(0.45, 0.7), ud = d * U(0.45, 0.7);
      const ux = x + U(-1, 1) * (w - uw) / 2, uz = z + U(-1, 1) * (d - ud) / 2;
      B.box(col, uw, 2.8, ud, ux, h, uz);
      if (detail >= 2) parapet(B, col, x, z, w, d, h, 0.45, 0.22);
      top = h + 2.8;
      [x, z, w, d] = [ux, uz, uw, ud];
    } else if (detail >= 2) parapet(B, col, x, z, w, d, h);
    if (detail >= 2 && face) {
      const [nx, nz] = face;
      const L = nz ? w : d;
      const fy = top === h ? 0 : h;
      const n = Math.max(1, Math.floor(L / 2.6));
      for (const y of [fy + 1.4, fy + 4.2, fy + 7.0]) {
        if (y + 1.2 >= top || y <= 4) continue;
        for (let i = 0; i < n; i++) {
          if (r() < 0.35) continue;
          const k = -L / 2 + (L * (i + 0.5)) / n;
          const glow = r() < 0.12;
          const W = glow ? lit : paint, wc = glow ? PAINT.lamp : PAINT.black;
          if (nz) W.box(wc, 0.6, 0.85, 0.05, x + k, y, z + nz * (d / 2 + 0.01));
          else W.box(wc, 0.05, 0.85, 0.6, x + nx * (w / 2 + 0.01), y, z + k);
        }
      }
    }
    if (detail >= 1) {
      const roll = r();
      const rx = x + U(-0.3, 0.3) * w, rz = z + U(-0.3, 0.3) * d;
      if (roll < 0.35) {                                   // water tank on legs
        const tc = pick([PAINT.dark, PAINT.white, PAINT.blue, PAINT.turq]);
        for (const [lx, lz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) paint.box(PAINT.dark, 0.08, 0.7, 0.08, rx + lx, top, rz + lz);
        paint.cyl(tc, 0.65, [rx, top + 0.7, rz], [rx, top + 1.9, rz], 10);
      } else if (roll < 0.5 && detail >= 2) {             // satellite dish
        paint.box(PAINT.dark, 0.06, 0.8, 0.06, rx, top, rz);
        paint.cyl(PAINT.white, 0.5, [rx, top + 0.85, rz], [rx + 0.08, top + 0.95, rz + 0.08], 12, 0.42);
      } else if (roll < 0.7) {                             // stair hut
        B.box(col, 2.0, 2.2, 2.0, rx, top, rz);
      }
    }
  }

  // the ring pressed against the outside of the wall (outer face at 36),
  // leaving room for the corner towers, gatehouses and mid towers
  for (const [axis, sgn] of [["x", -1], ["x", 1], ["z", -1], ["z", 1]]) {
    let t = -44;
    while (t < 44) {
      const w = U(5, 9), c = t + w / 2;
      t += w + (r() < 0.18 ? U(2.2, 3.2) : 0);
      if (Math.abs(c) + w / 2 > 34.6 || Math.abs(c) - w / 2 < (axis === "z" ? 4.8 : 2.7)) continue;
      const dd = U(5.5, 8.5), h = U(6.5, 10.5);
      const [x, z, bw, bd, face] = axis === "z"
        ? [c, sgn * (36 + dd / 2), w - 0.15, dd, [0, -sgn]]
        : [sgn * (36 + dd / 2), c, dd, w - 0.15, [-sgn, 0]];
      if (clear(x, z, bw, bd)) house(x, z, bw, bd, h, face, 2);
    }
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) house(sx * 44, sz * 44, 7.5, 7.5, U(8, 11), [-sx, 0], 2);

  // the blocks beyond: a 12 m street grid, taller the further out
  for (let i = -13; i < 13; i++) {
    for (let j = -13; j < 13; j++) {
      const cx = 12 * i + 6, cz = 12 * j + 6, cheb = Math.max(Math.abs(cx), Math.abs(cz));
      if (cheb < 54 || Math.hypot(cx, cz) > 175 || r() < 0.16) continue;
      const x = cx + U(-1.4, 1.4), z = cz + U(-1.4, 1.4);
      const w = U(6, 10), d = U(6, 10);
      if (!clear(x, z, w, d)) continue;
      const h = U(5.5, 10) + (cheb - 50) * 0.07 + (r() < 0.12 ? 4 : 0);
      const face = Math.abs(cx) >= Math.abs(cz) ? [cx > 0 ? -1 : 1, 0] : [0, cz > 0 ? -1 : 1];
      const detail = cheb < 75 ? 2 : cheb < 125 ? 1 : 0;
      if (detail && r() < 0.3) {                           // two houses sharing the lot
        house(x - w / 4, z, w / 2 - 0.1, d, h, face, detail);
        house(x + w / 4, z, w / 2 - 0.1, d, h * U(0.7, 1.15), face, detail);
      } else house(x, z, w, d, h, face, detail);
    }
  }

  // landmarks: the great mosque, minarets, water towers
  const [lt, dk] = [PLASTER[3], PLASTER[2]];
  const dome = (B, col, x, y, z, rad, steps = 7) => {
    for (let i = 0; i < steps; i++) {
      const a0 = (Math.PI / 2) * (i / steps), a1 = (Math.PI / 2) * ((i + 1) / steps);
      B.cyl(col, Math.max(rad * Math.cos(a0), 0.03), [x, y + rad * Math.sin(a0), z], [x, y + rad * Math.sin(a1), z], 16, Math.max(rad * Math.cos(a1), 0.03), false);
    }
  };
  const minaret = (x, z, h) => {
    plaster.box(dk, 3.4, 4.0, 3.4, x, -0.1, z);
    plaster.cyl(lt, 1.35, [x, 3.9, z], [x, h * 0.72, z], 8, 1.1);
    for (const f of [0.3, 0.5]) plaster.cyl(dk, 1.38 - f * 0.3, [x, h * f, z], [x, h * f + 0.4, z], 8);
    plaster.cyl(dk, 1.9, [x, h * 0.72, z], [x, h * 0.72 + 0.35, z], 10);
    plaster.cyl(lt, 1.75, [x, h * 0.72 + 0.35, z], [x, h * 0.72 + 1.1, z], 10);
    plaster.cyl(lt, 0.85, [x, h * 0.72 + 1.1, z], [x, h * 0.9, z], 8);
    plaster.cyl(dk, 1.0, [x, h * 0.9, z], [x, h * 0.9 + 0.3, z], 8);
    plaster.cyl(lt, 0.95, [x, h * 0.9 + 0.3, z], [x, h, z], 8, 0.03);
  };
  const [mx, mz] = MOSQUE;
  plaster.box(lt, 22, 9, 22, mx, -0.1, mz);
  parapet(plaster, lt, mx, mz, 22, 22, 8.9, 0.6, 0.3);
  plaster.cyl(dk, 6.8, [mx, 8.9, mz], [mx, 11.2, mz], 16);
  dome(plaster, lt, mx, 11.2, mz, 7.0);
  paint.cyl(PAINT.timber, 0.08, [mx, 18.1, mz], [mx, 20, mz], 6);
  paint.cyl(PAINT.yellow, 0.3, [mx, 19.2, mz], [mx, 19.7, mz], 8, 0.05);
  for (const [ox, oz] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) {
    plaster.cyl(dk, 2.0, [mx + ox, 8.9, mz + oz], [mx + ox, 9.6, mz + oz], 12);
    dome(plaster, lt, mx + ox, 9.6, mz + oz, 2.0, 5);
  }
  for (const [ox, oz] of [[-13, -13], [13, -13]]) minaret(mx + ox, mz + oz, 31);
  for (const [x, z, h] of MINARETS) minaret(x, z, h);
  for (const [x, z] of WATER_TOWERS) {
    for (const [lx, lz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
      paint.cyl(PAINT.dark, 0.18, [x + lx * 1.2, 0, z + lz * 1.2], [x + lx * 0.8, 15, z + lz * 0.8], 4);
    }
    for (const y of [5, 10]) {
      const k = 2 * (1.2 - (0.4 * y) / 15);
      const P = [[-k, -k], [k, -k], [k, k], [-k, k]];
      for (let i = 0; i < 4; i++) {
        const [a, b] = [P[i], P[(i + 1) % 4]];
        paint.cyl(PAINT.dark, 0.08, [x + a[0], y, z + a[1]], [x + b[0], y, z + b[1]], 4);
      }
    }
    paint.cyl(PAINT.rust, 3.2, [x, 15, z], [x, 19.5, z], 16);
    paint.cyl(PAINT.rust, 3.3, [x, 19.5, z], [x, 21.2, z], 16, 0.2);
  }

  // utility poles down the street between the ring and the blocks: a T at
  // the very top with insulators, so they never read as crosses
  for (const [axis, sgn] of [["x", -1], ["x", 1], ["z", -1], ["z", 1]]) {
    for (let k = -3; k <= 3; k++) {
      const t = k * 13 + U(-1.5, 1.5);
      const [x, z] = axis === "z" ? [t, sgn * 47.5] : [sgn * 47.5, t];
      if (!clear(x, z, 0.5, 0.5)) continue;
      paint.cyl(PAINT.timber, 0.13, [x, -0.1, z], [x, 9.2, z], 6, 0.1);
      const [ax, az] = axis === "z" ? [1, 0] : [0, 1];
      paint.box(PAINT.dark, 2.2 * ax + 0.1 * az, 0.1, 2.2 * az + 0.1 * ax, x, 9.1, z);
      for (const o of [-0.9, -0.3, 0.9]) paint.cyl(PAINT.white, 0.05, [x + o * ax, 9.2, z + o * az], [x + o * ax, 9.42, z + o * az], 6);
    }
  }

  // the desert floor round the village's own ground (which ends at +-48)
  const xs = [-360, -240, -150, -90, -48, 48, 90, 150, 240, 360];
  const V = (a, b, c) => new THREE.Vector3(a, b, c);
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < xs.length - 1; j++) {
      const [x0, x1, z0, z1] = [xs[i], xs[i + 1], xs[j], xs[j + 1]];
      if (x0 >= -48 && x1 <= 48 && z0 >= -48 && z1 <= 48) continue;
      paint.quad(V(x0, -0.06, z0), V(x0, -0.06, z1), V(x1, -0.06, z1), V(x1, -0.06, z0), PAINT.sand);
    }
  }

  // mountains round the horizon: highest north and west, foothills toward
  // the sun so it still drops into open sky; the dust fog makes them haze
  const ph = [U(0, 6.28), U(0, 6.28), U(0, 6.28)];
  const ridge = (th) => {
    const h = 62 + 22 * Math.sin(3 * th + ph[0]) + 11 * Math.sin(7 * th + ph[1]) + 5 * Math.sin(17 * th + ph[2]);
    const dsun = Math.abs(((th - SUN_AZ + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
    return h * (0.28 + 0.72 * Math.min(1, Math.max(0, (dsun - 0.35) / 1.1)));
  };
  const N = 144;
  for (const [radii, prof, amp, cols] of [
    [[168, 182, 196, 208], [-1, 0.55, 0.4, -1], 0.22, [PAINT.hill, PAINT.hill, PAINT.hill]],
    [[214, 240, 266, 292, 314], [-1, 0.5, 1.0, 0.72, 0.3], 1.0, [PAINT.hill, PAINT.hillDark, PAINT.hillDark, PAINT.hillDark]],
  ]) {
    const grid = [];
    for (let i = 0; i < N; i++) {
      const th = (2 * Math.PI * i) / N, H = ridge(th) * amp;
      grid.push(radii.map((rad, j) => {
        const rr = rad + U(-4, 4);
        const y = prof[j] < 0 ? prof[j] : H * prof[j] * U(0.82, 1.15);
        return V(rr * Math.cos(th), y, rr * Math.sin(th));
      }));
    }
    for (let i = 0; i < N; i++) {
      const a = grid[i], c = grid[(i + 1) % N];
      for (let j = 0; j < radii.length - 1; j++) paint.quad(a[j], c[j], c[j + 1], a[j + 1], cols[j]);
    }
  }

  // materials: plaster gets the village walls' photo texture (tiles per
  // metre as map-models.js RETEXTURE GS_Plaster), tinted by vertex colour
  const probe = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ name: "GS_Plaster", color: 0xffffff }));
  retexture(probe, { GS_Plaster: ["plaster", 0.4, 0] });
  const plasterMat = probe.material;
  plasterMat.vertexColors = true;
  const paintMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  const litMat = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xffa848, emissiveIntensity: 1.6, roughness: 0.5 });
  const group = new THREE.Group();
  group.name = "dustbowl-city";
  group.add(plaster.mesh(plasterMat), paint.mesh(paintMat), lit.mesh(litMat), citySmoke());
  return group;
}

/* Distant smoke (bazaar phase 5): somebody else's war two streets over.
   Three plumes out in the city, one THREE.Points (one draw call): soft puffs
   rise, drift downwind, swell and fade, then start again at the base. */
const PLUMES = [[-96, -118, 1.0], [132, 58, 0.8], [-150, 74, 0.65]];   // x, z, strength
const PUFFS = 32;
function citySmoke() {
  const n = PLUMES.length * PUFFS;
  const pos = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n);
  const age = new Float32Array(n), life = new Float32Array(n), seed = new Float32Array(n);
  const r = rng(91);
  for (let i = 0; i < n; i++) { life[i] = 11 + r() * 7; age[i] = r() * life[i]; seed[i] = r(); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  geo.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 400 }, uColor: { value: new THREE.Color(0x3a302c) } },
    vertexShader: `attribute float aSize; attribute float aAlpha; uniform float uScale; varying float vA;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vA = aAlpha;
        gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; varying float vA;
      void main() { float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard;
        gl_FragColor = vec4(uColor, vA * (1.0 - d * d)); }`,
    transparent: true, depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.name = "dustbowl-smoke";
  points.frustumCulled = false;
  let last = performance.now();
  points.onBeforeRender = (renderer, scene, camera) => {
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    mat.uniforms.uScale.value = renderer.getDrawingBufferSize(_buf).y * 0.5 * camera.projectionMatrix.elements[5];
    for (let p = 0; p < PLUMES.length; p++) {
      const [px, pz, k] = PLUMES[p];
      for (let j = 0; j < PUFFS; j++) {
        const i = p * PUFFS + j;
        age[i] += dt;
        if (age[i] > life[i]) { age[i] -= life[i]; seed[i] = Math.random(); }
        const t = age[i] / life[i], h = t * 48 * k;
        pos[i * 3] = px + h * 0.55 + (seed[i] - 0.5) * (3 + h * 0.25);   // wind leans it east
        pos[i * 3 + 1] = 6 + h;
        pos[i * 3 + 2] = pz + (seed[i] * 7 % 1 - 0.5) * (3 + h * 0.25);
        size[i] = (7 + t * 26) * k;
        alpha[i] = 0.8 * Math.min(1, 0.5 + k * 0.5) * Math.min(1, t * 6) * (1 - t);
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
  };
  return points;
}
const _buf = new THREE.Vector2();
