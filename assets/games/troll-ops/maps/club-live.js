// Troll Forces — the club's live layer, shared by every map with a club in
// it (Trolling Loud, Kabukigrin; doc docs/KABUKIGRIN.md 6.4): the things
// that move, glow on the beat or answer a bullet, and the clock and sound
// that drive them. Each builder takes the map's `plan`, where its club is:
//
//   FL, TOP, ROOF     the club's floor, the hall's ceiling underside, the roof
//   HALL              the hall's walls {x0, x1, z0, z1}
//   DANCE, DC         the dance floor {x0, x1, z0, z1} and its centre {x, z}
//   STAGE             the DJ's stage {x0, x1, z0, z1, top}
//   djWall            the z of the wall behind the DJ (the crystal LED wall)
//   deck              the DJ booth's centre {x, z}
//   BPM               the club's own track
//   speaker           [x, y, z] the booth's sound comes from
//   muffle(p)         [lowpass Hz, gain] for the booth heard from p
//   onCam(S, pos)     optional, every frame with the camera's position
//   djFace            "+z" (default) or "+x": the way the DJ looks
//   orbitY            the height of the lights riding round the ball (6.3)
//
// and its materials M (trollingloud.js materials(): neon, neonSign,
// neonHalo, neonTile, danceGlass, black, blackGloss, gold, steel, cases,
// chrome, blackMetal, crystal, fringe, ball, beam, dj, backlight).
// One clock runs the club: 128 BPM, or the song's beat grid (DJ Lulz, Troll
// Radio), into trollingloud-kit.js U, which every neon tube and LED reads.

import * as THREE from "three";
import { place, bottlesTexture, glowTexture } from "./trollcity-kit.js?v=tc2-wst-tc3-sh1-sr1-pf1-or1-tcs1-tx1-ch1-sp1-kbt1-pm1";
import {
  U, skipOverride, signUV, signAspect, neonMat, ledMat,
  signsTexture, tileGlowTexture, fringeTexture, beamTexture, facetTexture, djTexture,
} from "./trollingloud-kit.js?v=tl3-tc3-sh1-sr1-or1-tcs1-tx1-ch1-sp1-kbt1-pm1";
import { BEATS } from "../sound/music-beats.js?v=bg1-sg1-zr10-jb1-nh1-hl1-or1-hh1-yb1-gr1";
import { moneyTick, moneyDebug } from "./club-money.js?v=mn1";

/* A build's live state: the lobby's map thumbnails and the preloader also
   run build(), so each build keeps its own and the ticker (it only runs
   while its mesh is drawn) makes it the active one. */
export function newState() {
  return {
    lights: [], signs: [], bottles: null, ball: null, ballMirror: null, lasers: null, dj: null,
    kill: new Float32Array(16), flick: new Float32Array(16),
    gone: { value: new Float32Array(64) }, goneUntil: new Float32Array(64), bottleSegs: [],
    ballBoost: 0, ballRot: 0, dropUntil: 0, last: 0, cam: new THREE.Vector3(0, -99, 0),
    radioKick: 0, bassAvg: 0, freq: null,
    song: null, level: 1,   // a song with a beat grid driving the clock (onFrame)
  };
}

/* The materials the builders draw with, for a map that has no club of its
   own to take them from (trollingloud.js materials() makes the same). */
export function clubMaterials() {
  const std = (color, rough = 0.8, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
  const glow = (color, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false });
  return {
    gold: std(0xc8a050, 0.32, 0.35, { emissive: 0x2a1c06 }),
    blackMetal: std(0x111114, 0.32, 0.6),
    blackGloss: std(0x08080a, 0.12, 0.3),
    steel: std(0x6a6c74, 0.38, 0.7),
    chrome: std(0xb0b4bc, 0.18, 0.85, { emissive: 0x101014 }),
    cases: std(0x15151a, 0.55, 0.3),
    danceGlass: new THREE.MeshStandardMaterial({ color: 0x07040c, roughness: 0.06, metalness: 0.3, transparent: true, opacity: 0.8 }),
    black: new THREE.MeshBasicMaterial({ color: 0x000000 }),
    backlight: glow(0xffa848, 1.15),
    dj: new THREE.MeshBasicMaterial({ map: djTexture(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, color: 0xd8d0e0 }),
    neon: neonMat(),
    neonSign: neonMat({ map: signsTexture(), transparent: true, side: THREE.DoubleSide, key: "sign" }),
    neonHalo: neonMat({ map: glowTexture(), additive: true, side: THREE.DoubleSide, key: "halo" }),
    neonTile: neonMat({ map: tileGlowTexture(), additive: true, key: "tile" }),
    crystal: ledMat("crystal"),
    fringe: new THREE.MeshBasicMaterial({ map: fringeTexture(), color: new THREE.Color(0x9a88ff).multiplyScalar(1.25), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }),
    ball: new THREE.MeshStandardMaterial({ map: facetTexture(), roughness: 0.2, metalness: 0.75, emissive: 0x8a8aa8, emissiveMap: facetTexture() }),
    beam: new THREE.MeshBasicMaterial({ map: beamTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }),
  };
}

/* ================================================================ helpers */

/* A neon sign from the atlas, `h` tall, facing `ry` (0 = +z). `group`
   makes it shootable (it shorts out for a few seconds). */
export function sign(S, N, M, name, x, y, z, h, { ry = 0, group = 0, beat = 0.18, chase = 0, halo = null, haloK = 0.3 } = {}) {
  const w = h * signAspect(name);
  const nx = Math.sin(ry), nz = Math.cos(ry);
  N.quad(M.neonSign, x, y, z, w, h, { ry, uv: signUV(name), group, beat, chase, k: 1.15 });
  if (halo) N.quad(M.neonHalo, x - nx * 0.02, y, z - nz * 0.02, w * 1.25, h * 1.7, { ry, color: halo, k: haloK, group, beat: 0.35 });
  if (group) S.signs.push({ group, x, y, z, w, h, ry });
}

/* One of the club's real lights: kicks on the beat (`amp`), drifts round
   the colour wheel (`hue`), rides round the mirror ball (`orbit`, radians). */
export function addLight(S, lights, color, power, range, x, y, z, { hue = null, amp = 0.2, orbit = null } = {}) {
  const l = new THREE.PointLight(color, power, range, 1.6);
  l.position.set(x, y, z);
  l.castShadow = false;
  lights.push(l);
  S.lights.push({ l, base: power, hue, amp, orbit });
}

/* The bottles behind the bar: alpha-cut rows, lit from behind, split
   into shelf segments a bullet can empty one at a time (uGone). */
function bottleMat(gone) {
  const m = new THREE.MeshStandardMaterial({ map: bottlesTexture(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.2, metalness: 0.1, emissive: 0xffffff, emissiveIntensity: 0.55, emissiveMap: bottlesTexture() });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uGone = gone;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aSeg;\nvarying float vSeg;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSeg = aSeg;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vSeg;\nuniform float uGone[64];")
      .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nif (uGone[int(vSeg + 0.5)] > 0.5) discard;");
  };
  m.customProgramCacheKey = () => "tl-bottles";
  return m;
}

function mergeAll(list) {
  const geos = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = geos.reduce((n, g) => n + g.attributes.position.count, 0);
  const out = new THREE.BufferGeometry();
  for (const name of ["position", "normal", "uv", "aSeg"]) {
    const size = geos[0].attributes[name].itemSize;
    const arr = new Float32Array(total * size);
    let o = 0;
    for (const g of geos) {
      arr.set(g.attributes[name].array, o);
      o += g.attributes[name].array.length;
    }
    out.setAttribute(name, new THREE.Float32BufferAttribute(arr, size));
  }
  for (const g of list.concat(geos)) g.dispose();
  out.computeBoundingSphere();
  return out;
}

function mergeLasers(geos) {
  const total = geos.reduce((n, g) => n + g.attributes.position.count, 0);
  const out = new THREE.BufferGeometry();
  for (const name of ["position", "uv", "color"]) {
    const size = geos[0].attributes[name].itemSize;
    const arr = new Float32Array(total * size);
    let o = 0;
    for (const g of geos) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.Float32BufferAttribute(arr, size));
  }
  return out;
}

function ringPts(P, r, y, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push([P.DC.x + Math.cos(a) * r, y, P.DC.z + Math.sin(a) * r]);
  }
  return out;
}

/* How far a ray from the dance floor's centre at angle `a` runs before it
   meets the hall's walls. */
function rayToHall(P, a) {
  const { HALL, DC } = P;
  const c = Math.cos(a), s = Math.sin(a);
  const tx = c > 0 ? (HALL.x1 - 0.5 - DC.x) / c : c < 0 ? (HALL.x0 + 0.5 - DC.x) / c : Infinity;
  const tz = s > 0 ? (HALL.z1 - 0.5 - DC.z) / s : s < 0 ? (HALL.z0 + 0.5 - DC.z) / s : Infinity;
  return Math.min(tx, tz);
}

/* ============================================================== builders */

/* The dance floor: black glass over a mirror pit, LED tiles. `edgeY`: the
   lit edge's height, on the step down (0.18) or flush with the floor. */
export function danceFloor(K, M, N, P, { edgeY = 0.18 } = {}) {
  const { HALL, DANCE, DC } = P;
  K.add(M.danceGlass, place(new THREE.PlaneGeometry(DANCE.x1 - DANCE.x0, DANCE.z1 - DANCE.z0), { x: DC.x, y: 0.0, z: DC.z, rx: -Math.PI / 2 }), { shadow: false });
  // the pit under it: black all round, deep enough to hold the reflection
  const PIT = 12;
  K.box(M.black, 0, -PIT - 0.1, (HALL.z0 + HALL.z1) / 2, HALL.x1 - HALL.x0 + 2, 0.1, HALL.z1 - HALL.z0 + 2, {}, { shadow: false });
  for (const [x, z, w, d] of [[HALL.x0 - 1, 0, 0.1, 40], [HALL.x1 + 1, 0, 0.1, 40], [0, HALL.z0 - 1, 32, 0.1], [0, HALL.z1 + 1, 32, 0.1]]) {
    K.box(M.black, x, -PIT, z === 0 ? (HALL.z0 + HALL.z1) / 2 : z, w, PIT - 0.02, d, {}, { shadow: false });
  }
  const nx = Math.round(DANCE.x1 - DANCE.x0), nz = Math.round(DANCE.z1 - DANCE.z0);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = DANCE.x0 + 0.5 + i, z = DANCE.z0 + 0.5 + j;
    const pal = [0xff2ab4, 0x3ff0ff, 0x8a4aff, 0xff2ab4];
    const r = Math.hypot(x - DC.x, z - DC.z);
    N.quad(M.neonTile, x, 0.012, z, 0.96, 0.96, { rx: -Math.PI / 2, color: pal[(i + j) % 4], k: 0.42, chase: 0.75, phase: -r * 0.18, beat: 0.6, rip: 1 });
  }
  // a lit edge where the dance floor steps down
  for (const [x, z, w, d] of [[DC.x, DANCE.z0 - 0.01, nx, 0.02], [DC.x, DANCE.z1 + 0.01, nx, 0.02], [DANCE.x0 - 0.01, DC.z, 0.02, nz], [DANCE.x1 + 0.01, DC.z, 0.02, nz]]) {
    N.bar(M.neon, x, edgeY, z, w, 0.03, d, {}, { color: 0x3ff0ff, k: 2.2, chase: 1, chaseLen: 4, beat: 0.4 });
  }
}

/* The DJ: stage, the crystal LED wall, the nested light arches framing it
   (`arches` {a, h, n, step, drop}: the outer arch's half-width and top, how
   many, and how much each next one is narrower and lower), the booth and
   the troll DJ bobbing on the beat, the big trollface over the wall.
   `P.djFace` is the way the DJ looks across the floor: "+z" (default) or
   "+x". `stage: false` when the map already has the stage's block;
   `booth: false` leaves the booth's front bare (no DJ LULZ sign, no cyan
   strip at its foot). */
export function djStage(K, M, N, HN, S, P, { arches = {}, wall = { w: 14, h: 6.2 }, stage = true, booth = true } = {}) {
  const { FL, STAGE, djWall, deck } = P;
  const { a: A0 = 9.4, h: H0 = 8.15, n: AN = 6, step = 0.45, drop = 0.26 } = arches;
  // u runs along the wall, n out of it toward the floor: X(u, n) is the
  // world [x, z] (a size's [along, out] too)
  const side = P.djFace === "+x";
  const X = side ? (u, n) => [n, u] : (u, n) => [u, n];
  const ry = side ? Math.PI / 2 : 0;
  const du = side ? deck.z : deck.x, dn = side ? deck.x : deck.z;
  const [s0, s1, front] = side ? [STAGE.z0, STAGE.z1, STAGE.x1] : [STAGE.x0, STAGE.x1, STAGE.z1];
  if (stage) K.solid((STAGE.x0 + STAGE.x1) / 2, (STAGE.z0 + STAGE.z1) / 2, STAGE.x1 - STAGE.x0, STAGE.z1 - STAGE.z0, STAGE.top - FL, { y: FL, mat: M.blackGloss });
  {
    const [x, z] = X((s0 + s1) / 2, front + 0.005), [w, d] = X(s1 - s0, 0.01);
    N.bar(M.neon, x, STAGE.top - 0.06, z, w, 0.03, d, {}, { color: 0xff3fb4, k: 2.2, chase: 0.8, beat: 0.5 });
  }
  // the crystal LED wall (image 5)
  {
    const [x, z] = X(du, djWall + 0.02);
    K.add(M.crystal, place(new THREE.PlaneGeometry(wall.w, wall.h), { x, y: STAGE.top + wall.h / 2, z, ry }), { shadow: false });
  }
  // nested light arches framing it, red and gold LED points (image 5)
  for (let i = 0; i < AN; i++) {
    const a = A0 - i * step, h = H0 - i * drop, n = djWall - 0.15 + 0.4 + i * 0.38, y0 = STAGE.top;
    const pts = [];
    for (let k = 0; k <= 20; k++) {
      const t = Math.PI * (k / 20);
      const [x, z] = X(du - Math.cos(t) * a, n);
      pts.push([x, y0 + Math.sin(t) * (h - y0), z]);
    }
    HN.tube(M.neon, pts, { r: 0.045, color: i % 2 ? 0xff3a3a : 0xffb84a, k: 2.0, chase: 0.65, chaseLen: 2.5, phase0: i * 0.3, beat: 0.35 });
  }
  // the booth
  const at = (u, n) => X(du + u, dn + n);
  const box = (m, u, y, n, w, h, d) => { const [x, z] = at(u, n), [ww, dd] = X(w, d); K.box(m, x, y, z, ww, h, dd); };
  {
    const [x, z] = at(0, 0), [w, d] = X(5.2, 0.9);
    K.solid(x, z, w, d, 1.1, { y: STAGE.top, pen: 3, mat: M.blackGloss });
  }
  box(M.gold, 0, STAGE.top + 1.1, 0, 5.3, 0.04, 1.0);
  for (const u of [-1.5, 1.5]) {
    const [x, z] = at(u, -0.05);
    K.cyl(M.steel, x, STAGE.top + 1.14, z, 0.33, 0.33, 0.04, 20);
    K.cyl(M.blackGloss, x, STAGE.top + 1.18, z, 0.3, 0.3, 0.015, 20);
  }
  box(M.cases, 0, STAGE.top + 1.14, -0.1, 0.8, 0.08, 0.5);
  if (booth) {
    const [x, z] = at(0, 0.46), [w, d] = X(5.0, 0.01);
    N.bar(M.neon, x, STAGE.top + 0.15, z, w, 0.05, d, {}, { color: 0x3ff0ff, k: 2.4, chase: 0.9, beat: 0.6 });
    const [sx, sz] = at(0, 0.465);
    sign(S, N, M, "dj", sx, STAGE.top + 0.62, sz, 0.62, { group: 13, ry });
  }
  // the troll DJ, bobbing on the beat
  {
    const g = new THREE.PlaneGeometry(1.4, 1.75);
    const dj = new THREE.Mesh(g, M.dj);
    const [x, z] = at(0, -0.7);
    dj.position.set(x, STAGE.top + 1.4, z);
    if (side) dj.rotation.y = ry;
    S.dj = dj;
    S.djY = dj.position.y;
    K.root.add(dj);
  }
  // the big trollface over the crystal wall
  {
    const [x, z] = X(du, djWall + 0.06);
    sign(S, N, M, "trollCyan", x, STAGE.top + 4.2, z, 3.3, { group: 4, halo: 0x3ff0ff, haloK: 0.25, beat: 0.4, ry });
  }
}

/* The hall's ceiling at `y`: a neon starburst round the skylight (image
   1), a ring of moving heads (image 5). */
export function hallCeiling(K, M, N, HN, P, y) {
  const { DC } = P;
  HN.tube(M.neon, ringPts(P, 5.4, y, 48), { closed: true, r: 0.05, color: 0xff3fb4, k: 2.6, chase: 0.8, chaseLen: 4, beat: 0.4 });
  const petals = 16;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    const rOut = rayToHall(P, a) - 0.6;
    const tw = 0.26, d = 0.16;
    const pt = (r, ang, yy = y) => [DC.x + Math.cos(ang) * r, yy, DC.z + Math.sin(ang) * r];
    const mid = 5.6 + (rOut - 5.6) * 0.55;
    const pts = [pt(5.6, a - d), pt(mid, a - d * 1.8 + tw), pt(rOut, a + tw * 0.9, y - 0.25), pt(mid, a + d * 1.8 + tw), pt(5.6, a + d)];
    HN.tube(M.neon, pts, { r: 0.035, color: i % 2 ? 0x9fd8ff : 0xb07aff, k: 2.4, chase: 0.9, chaseLen: 5, phase0: i * 0.13, beat: 0.3 });
  }
  K.add(M.blackMetal, place(new THREE.TorusGeometry(7.4, 0.12, 6, 48), { x: DC.x, y: y - 0.4, z: DC.z, rx: Math.PI / 2 }), { shadow: false });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const hx = DC.x + Math.cos(a) * 7.4, hz = DC.z + Math.sin(a) * 7.4;
    K.box(M.blackMetal, hx, y - 0.95, hz, 0.28, 0.42, 0.28, { ry: -a });
    N.add(M.neon, place(new THREE.CircleGeometry(0.1, 10), { x: hx, y: y - 0.96, z: hz, rx: Math.PI / 2 }), { color: i % 3 ? 0xffffff : 0xffd080, k: 2.4, beat: 0.7, chase: 0.5, phase: i / 16 });
  }
}

/* The fringe chandelier (its ring at `top`) and the mirror ball under it
   (`ball` {y, r}), image 2. The ball is a collider so it can be shot. */
export function chandelier(K, M, HN, S, P, { top = 7.9, ball: { y: BY = 6.75, r: BR = 0.55 } = {} } = {}) {
  const { DC, ROOF } = P;
  K.add(M.gold, place(new THREE.TorusGeometry(3.4, 0.07, 6, 48), { x: DC.x, y: top, z: DC.z, rx: Math.PI / 2 }), { shadow: false });
  for (const [r, h] of [[3.4, 1.9], [2.9, 1.55], [2.4, 1.2]]) {
    const g = new THREE.CylinderGeometry(r, r, h, 48, 1, true);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * Math.round((2 * Math.PI * r) / 1.5));
    const m = new THREE.Mesh(place(g, { x: DC.x, y: top - h / 2, z: DC.z }), M.fringe);
    m.renderOrder = 2;
    skipOverride(m);
    K.root.add(m);
    S.fringe = (S.fringe || []).concat(m);
  }
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    HN.add(M.neon, place(new THREE.SphereGeometry(0.06, 6, 4), { x: DC.x + Math.cos(a) * 3.5, y: top + 0.05, z: DC.z + Math.sin(a) * 3.5 }), { color: 0xff3020, k: 2.6, chase: 0.8, phase: i / 12, beat: 0.5 });
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    K.box(M.blackMetal, DC.x + Math.cos(a) * 3.4, top, DC.z + Math.sin(a) * 3.4, 0.03, ROOF - 0.1 - top, 0.03, {}, { shadow: false });
  }
  // the ball (its rod holds it up)
  K.api.ghostBox(DC.x, DC.z, BR * 2, BR * 2, BR * 2, { y: BY - BR, pen: 0.5 });
  K.api.ghostBox(DC.x, DC.z, 0.06, 0.06, ROOF - 0.1 - (BY - BR), { y: BY - BR, pen: 0.2 });
  K.box(M.chrome, DC.x, BY + BR - 0.05, DC.z, 0.03, ROOF - 0.1 - (BY + BR - 0.05), 0.03, {}, { shadow: false });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BR, 24, 16), M.ball);
  ball.position.set(DC.x, BY, DC.z);
  K.root.add(ball);
  S.ball = ball;
  U.uBall.value.set(DC.x, BY, DC.z);
  S.ballBox = { x: DC.x, y: BY, z: DC.z, r: BR + 0.2 };
}

/* The back bar's bottles: lit from behind (`back`, the wall's face), three
   shelves at `x` along z0..z1 from the floor `y`, every 0.8 m of shelf a
   segment a bullet empties. Faces -x (the bar on the east wall). Under a
   low ceiling: fewer `rows`, a shorter `glow` {h, y} and ghost wall `ghostH`. */
export function bottleWall(K, M, S, { x, back, z0, z1, y, rows = 3, glow = { h: 2.6, y: 2.5 }, ghostH = 2.8 }) {
  K.add(M.backlight, place(new THREE.PlaneGeometry(z1 - z0, glow.h), { x: back, y: y + glow.y, z: (z0 + z1) / 2, ry: -Math.PI / 2 }), { shadow: false });
  const segs = [];
  let seg = 0;
  for (let row = 0; row < rows; row++) {
    const yy = y + 1.25 + row * 0.85;
    K.box(M.blackGloss, x + 0.1, yy - 0.03, (z0 + z1) / 2, 0.5, 0.03, z1 - z0);
    for (let z = z0; z < z1 - 0.01; z += 0.8) {
      const g = new THREE.PlaneGeometry(0.8, 0.62);
      const uv = g.attributes.uv;
      const u0 = ((seg * 0.37) % 1) * 0.6;
      for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + uv.getX(i) * 0.4);
      place(g, { x, y: yy + 0.31, z: z + 0.4, ry: -Math.PI / 2 });
      const n = g.attributes.position.count;
      g.setAttribute("aSeg", new THREE.Float32BufferAttribute(new Float32Array(n).fill(seg), 1));
      segs.push(g);
      S.bottleSegs.push({ seg, x, y: yy + 0.31, z: z + 0.4 });
      seg++;
    }
  }
  const bm = new THREE.Mesh(mergeAll(segs), bottleMat(S.gone));
  bm.castShadow = false;
  K.root.add(bm);
  // a ghost wall in front of the bottles so a shot stops on the shelf
  K.api.ghostBox(x + 0.1, (z0 + z1) / 2, 0.08, z1 - z0, ghostH, { y: y + 1.0, pen: 0.4 });
  S.shelf = { x0: x - 0.25, x1: x + 0.5, y0: y + 1.1, y1: y + 1.1 + ghostH, z0, z1 };
}

/* After the flush: the reflection (the ceiling neon HN, the crystal wall,
   the fringe and the ball mirrored under the glass floor), the lasers
   bursting out of the ball and turning with it, and the clock: one
   invisible mesh whose draw hook runs `club.tick`. `clip` ({ x0, x1, z0,
   z1 }): the room the beams stop at the walls of, where rooms lie past them. */
export function finishClub(root, M, HN, S, club, { clip = null } = {}) {
  const mirror = new THREE.Group();
  mirror.scale.y = -1;
  for (const m of HN.meshes) mirror.add(new THREE.Mesh(m.geometry, m.material));
  for (const m of root.children) {
    if (m.isMesh && (m.material === M.crystal || m.material === M.fringe)) mirror.add(new THREE.Mesh(m.geometry, m.material));
  }
  S.ballMirror = new THREE.Mesh(S.ball.geometry, M.ball);
  S.ballMirror.position.copy(S.ball.position);
  mirror.add(S.ballMirror);
  root.add(mirror);

  {
    const geos = [];
    const cols = [0x3aff7a, 0x3ff0ff, 0x3aff7a, 0xff3fb4];
    const BALL_Y = S.ball.position.y, N_BEAMS = 14;
    for (let i = 0; i < N_BEAMS; i++) {
      const yaw = (i / N_BEAMS) * Math.PI * 2, pitch = -(0.16 + (i % 4) * 0.12);
      const len = Math.min(24, (BALL_Y - 0.1) / Math.sin(-pitch));
      for (const rx of [0, Math.PI / 2]) {
        const g = new THREE.PlaneGeometry(len, 0.07);
        g.translate(len / 2, 0, 0);
        g.rotateX(rx);
        g.rotateZ(pitch);
        g.rotateY(-Math.PI / 2 - yaw);
        const n = g.attributes.position.count, c = new THREE.Color(cols[i % cols.length]).multiplyScalar(1.4);
        const arr = new Float32Array(n * 3);
        for (let k = 0; k < n; k++) { arr[k * 3] = c.r; arr[k * 3 + 1] = c.g; arr[k * 3 + 2] = c.b; }
        g.setAttribute("color", new THREE.Float32BufferAttribute(arr, 3));
        geos.push(g.toNonIndexed());
      }
    }
    if (clip) {
      M.beam.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vClipXZ;")
          .replace("#include <project_vertex>", "#include <project_vertex>\nvClipXZ = (modelMatrix * vec4(transformed, 1.0)).xz;");
        sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec2 vClipXZ;")
          .replace("void main() {", `void main() {\n  if (vClipXZ.x < ${clip.x0.toFixed(2)} || vClipXZ.x > ${clip.x1.toFixed(2)} || vClipXZ.y < ${clip.z0.toFixed(2)} || vClipXZ.y > ${clip.z1.toFixed(2)}) discard;`);
      };
      M.beam.customProgramCacheKey = () => `beam-clip-${clip.x0},${clip.x1},${clip.z0},${clip.z1}`;
    }
    const lasers = new THREE.Mesh(mergeLasers(geos), M.beam);
    lasers.position.copy(S.ball.position);
    lasers.renderOrder = 3;
    lasers.frustumCulled = false;
    skipOverride(lasers);
    root.add(lasers);
    S.lasers = lasers;
  }

  const tg = new THREE.BufferGeometry();
  tg.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(9), 3));
  const ticker = new THREE.Mesh(tg, M.black);
  ticker.frustumCulled = false;
  ticker.onBeforeRender = (r, sc, cam) => club.tick(S, cam);
  root.add(ticker);
}

/* ============================================================== the engine

   One per map: the clock, the shots, the sound, all acting on the build
   being shown (`active`). The map hands its own onShot / onFrame /
   attachAudio / attachMusic on from here. */

// A minor, four bars: A, A, F, G (bass roots, Hz); the stab chords
const ROOTS = [55, 55, 43.65, 49];
const STABS = [[220, 261.6, 329.6], [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7]];
const _c = new THREE.Color();

export function clubEngine(P) {
  const BPS = P.BPM / 60;
  let ACTIVE = null, AUDIO = null, MUSIC = null;

  function tick(S, cam) {
    ACTIVE = S;
    if (cam.isPerspectiveCamera) {
      U.uPlayer.value.copy(cam.position);
      S.cam.copy(cam.position);
      P.onCam?.(S, cam.position);
    }
    const now = performance.now() / 1000;
    if (now - S.last < 0.004) return;
    const dt = Math.min(0.1, S.last ? now - S.last : 0.016);
    S.last = now;

    // the beat: the song's own grid when there is one (DJ Lulz, or your radio),
    // else the radio's kick off the analyser, else the club's own clock
    let bp = now * BPS;
    let kick = Math.exp(-(bp % 1) * 5.0);
    let level = 1, songLevel = null;
    const sg = S.song;
    if (sg) {
      const g = sg.grid, t = sg.t + (now - sg.at);
      const f = (t - g.offset) * (g.bpm / 60), i = Math.floor(f);
      bp = f - g.down;   // whole bars land on the song's one
      if (f >= 0 && i < g.kick.length) {
        kick = Math.exp(-(f - i) * 5.0) * (0.25 + 0.75 * (+g.kick[i] || 0) / 9);
        level = 0.15 + 0.85 * (+g.level[i] || 0) / 9;
        songLevel = (+g.level[i] || 0) / 9;
      } else { kick = 0; level = 0.15; songLevel = 0; }
    } else if (S.radioOn) kick = S.radioKick;
    if (S.dropUntil > now) kick = (S.dropUntil - now) < 0.12 ? 1.4 : 0.05;
    S.level += (level - S.level) * Math.min(1, dt * 4);
    U.uTime.value = now;
    U.uBeatPos.value = bp;
    U.uKick.value = kick;
    U.uLevel.value = S.level;

    // the mirror ball: turning, faster for a while after it's shot
    S.ballBoost = Math.max(0, S.ballBoost - dt / 4);
    S.ballRot += dt * (0.32 + S.ballBoost * 2.6);
    U.uBallRot.value = S.ballRot;
    U.uDisco.value = 0.5 + S.ballBoost * 0.9 + kick * 0.12;
    if (S.ball) { S.ball.rotation.y = -S.ballRot; S.ballMirror.rotation.y = -S.ballRot; }

    // the lasers sweep
    if (S.lasers) {
      S.lasers.rotation.y = -S.ballRot;
      S.lasers.rotation.x = Math.sin(now * 0.21) * 0.05;
      S.lasers.material.opacity = 0.55 + 0.45 * kick;
    }
    // money over the floor on the drops (club-money.js; a map that asked for it)
    moneyTick(S, now, dt, bp, songLevel);
    // the DJ bobs
    if (S.dj) { S.dj.position.y = S.djY + kick * 0.05; S.dj.rotation.z = Math.sin(bp * Math.PI) * 0.035; }

    // the real lights: a gentle kick, the hall's three drifting round the wheel
    for (const L of S.lights) {
      L.l.intensity = L.base * (0.6 + 0.4 * S.level) * (1 + L.amp * (kick - 0.35));
      if (L.orbit !== null) {
        const a = L.orbit - S.ballRot;
        L.l.position.set(U.uBall.value.x + Math.cos(a) * 1.3, P.orbitY ?? 6.3, U.uBall.value.z + Math.sin(a) * 1.3);
      }
      if (L.hue !== null) L.l.color.copy(_c.setHSL((L.hue + bp / 64) % 1, 1, 0.6));
    }

    // shot-out signs: dark, then a stutter as they relight
    for (let g = 1; g < 16; g++) {
      const left = S.kill[g] - now;
      U.uKill.value[g] = left <= 0 ? 0 : left < 0.7 ? (Math.sin(now * 60 + g) > 0 ? 1 : 0.2) : 1;
    }
    // bottles come back after a while
    const gone = S.gone.value;
    for (let i = 0; i < 64; i++) if (gone[i] && now > S.goneUntil[i]) gone[i] = 0;
  }

  /* -------------------------------------------------- answering shots */
  function onShot(p) {
    const S = ACTIVE;
    if (!S) return;
    const now = performance.now() / 1000;
    // the mirror ball
    const b = S.ballBox;
    if (b && Math.hypot(p.x - b.x, p.y - b.y, p.z - b.z) < b.r + 0.15) {
      S.ballBoost = 1;
      sfx("tink", p);
      return;
    }
    // a sign
    for (const s of S.signs) {
      const dx = p.x - s.x, dz = p.z - s.z;
      const c = Math.cos(s.ry), sn = Math.sin(s.ry);
      const u = dx * c - dz * sn, n = dx * sn + dz * c;
      if (Math.abs(u) < s.w / 2 + 0.15 && Math.abs(p.y - s.y) < s.h / 2 + 0.15 && Math.abs(n) < 0.45) {
        if (S.kill[s.group] < now) sfx("zap", p);
        S.kill[s.group] = now + 3.2;
        return;
      }
    }
    // the bottles
    const sh = S.shelf;
    if (sh && p.x > sh.x0 && p.x < sh.x1 && p.y > sh.y0 && p.y < sh.y1 && p.z > sh.z0 && p.z < sh.z1) {
      let best = null, bd = 0.6;
      for (const g of S.bottleSegs) {
        const d = Math.hypot(p.y - g.y, p.z - g.z);
        if (d < bd && !S.gone.value[g.seg]) { bd = d; best = g; }
      }
      if (best) {
        S.gone.value[best.seg] = 1;
        S.goneUntil[best.seg] = now + 25;
        sfx("shatter", p);
      }
      return;
    }
    // the DJ's decks: a scratch, the track drops out for a bar
    const top = P.STAGE.top;
    const [au, an] = P.djFace === "+x" ? [p.z - P.deck.z, p.x - P.deck.x] : [p.x - P.deck.x, p.z - P.deck.z];
    if (Math.abs(au) < 2.7 && Math.abs(an) < 0.55 && p.y > top + 0.9 && p.y < top + 1.4) {
      if (S.dropUntil < now) {
        S.dropUntil = now + 4 / BPS;
        sfx("scratch", p);
      }
    }
  }

  /* -------------------------------------------------------- the sound

     The club's track: kick, clap, hats, an offbeat bass and a chord stab,
     scheduled a little ahead on the game's audio context in step with the
     light clock, through a lowpass (the walls between you and the booth)
     into a panner at the booth. Fades out when you're not in a match, and
     while Troll Radio plays (the lights follow the radio then). */
  const SND = { bus: null, song: null, lp: null, pan: null, noise: null, next: 0, gain: 0 };

  function ensureSound() {
    const a = AUDIO;
    if (!a?.ctx || !a.master) return null;
    if (SND.ctx === a.ctx) return a.ctx;
    const ctx = a.ctx;
    SND.ctx = ctx;
    SND.bus = ctx.createGain();
    SND.bus.gain.value = 0;
    SND.lp = ctx.createBiquadFilter();
    SND.lp.type = "lowpass";
    SND.lp.frequency.value = 900;
    SND.pan = ctx.createPanner();
    SND.pan.panningModel = "equalpower";
    SND.pan.distanceModel = "inverse";
    SND.pan.refDistance = 7;
    SND.pan.rolloffFactor = 0.7;
    SND.pan.maxDistance = 120;
    const [sx, sy, sz] = P.speaker;
    if (SND.pan.positionX) { SND.pan.positionX.value = sx; SND.pan.positionY.value = sy; SND.pan.positionZ.value = sz; }
    else SND.pan.setPosition(sx, sy, sz);
    // DJ Lulz's record (dj-lulz.js plugs its <audio> in here): the same
    // booth, the same walls
    SND.song = ctx.createGain();
    SND.song.gain.value = 0;
    SND.bus.connect(SND.lp);
    SND.song.connect(SND.lp);
    SND.lp.connect(SND.pan);
    SND.pan.connect(a.master);
    const len = ctx.sampleRate;
    SND.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = SND.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    SND.next = 0;
    return ctx;
  }

  function noiseHit(ctx, t, dest, { type = "highpass", freq = 7000, q = 0.7, dur = 0.05, peak = 0.3 }) {
    const src = ctx.createBufferSource();
    src.buffer = SND.noise;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  function tone(ctx, t, dest, { type = "sine", f0, f1 = f0, dur, peak, slide = dur }) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + slide);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /* Schedule every 16th note between `from` and `to` (in beats). */
  function scheduleTrack(ctx, fromBeat, toBeat, perfNow, ctxNow) {
    const S = ACTIVE;
    for (let n = Math.ceil(fromBeat * 4); n < toBeat * 4; n++) {
      const beat = n / 4;
      const t = ctxNow + (beat / BPS - perfNow);
      if (t < ctxNow) continue;
      if (S && S.dropUntil > perfNow && beat / BPS < S.dropUntil) continue;
      const step = n % 16, bar = Math.floor(n / 16) % 4;
      if (step % 4 === 0) tone(ctx, t, SND.bus, { f0: 150, f1: 42, dur: 0.32, peak: 0.9, slide: 0.12 });
      if (step === 4 || step === 12) noiseHit(ctx, t, SND.bus, { type: "bandpass", freq: 1500, q: 0.9, dur: 0.14, peak: 0.35 });
      if (step % 4 === 2) noiseHit(ctx, t, SND.bus, { freq: 7500, dur: 0.05, peak: 0.16 });
      if (step % 4 === 2 || step % 8 === 3) tone(ctx, t, SND.bus, { type: "sawtooth", f0: ROOTS[bar] * (step === 14 ? 2 : 1), dur: 0.18, peak: 0.16 });
      if (step === 0 && bar % 2 === 0) for (const f of STABS[bar]) tone(ctx, t, SND.bus, { type: "square", f0: f, dur: 0.22, peak: 0.035 });
    }
  }

  /* `song` { src, t, dj }: what's playing (DJ Lulz's record, or your radio)
     and how far in. With a beat grid the clock runs on it (tick); `dj` says
     it's DJ Lulz's, playing through the booth here. */
  function onFrame({ live = false, radio = false, song = null } = {}) {
    const S = ACTIVE;
    if (S) {
      const grid = song && BEATS[song.src];
      S.song = grid ? { grid, t: song.t, at: performance.now() / 1000 } : null;
      S.radioOn = !!radio && !!MUSIC?.analyser;
      if (S.radioOn) {
        const an = MUSIC.analyser;
        S.freq ??= new Uint8Array(an.frequencyBinCount);
        an.getByteFrequencyData(S.freq);
        const bass = (S.freq[0] + S.freq[1] + S.freq[2]) / 3 / 255;
        S.bassAvg += (bass - S.bassAvg) * 0.08;
        const k = Math.min(1, Math.max(0, (bass - S.bassAvg) * 7));
        S.radioKick = Math.max(k, S.radioKick * 0.88);
      }
    }
    const ctx = ensureSound();
    if (!ctx) return;
    const dj = !!song?.dj;
    const want = live && !radio && !dj && S ? 0.42 : 0;
    const perfNow = performance.now() / 1000, ctxNow = ctx.currentTime;
    if (S) {
      const [freq, k] = P.muffle(S.cam);
      SND.lp.frequency.setTargetAtTime(freq, ctxNow, 0.12);
      SND.bus.gain.setTargetAtTime(want * k, ctxNow, 0.25);
      SND.song.gain.setTargetAtTime(live && dj ? k : 0, ctxNow, 0.25);
    } else {
      SND.bus.gain.setTargetAtTime(0, ctxNow, 0.25);
      SND.song.gain.setTargetAtTime(0, ctxNow, 0.25);
    }
    SND.gain = want;
    if (!want) { SND.next = 0; return; }
    const nowBeat = perfNow * BPS, ahead = nowBeat + 0.25 * BPS;
    const from = Math.max(SND.next || nowBeat, nowBeat);
    if (ahead > from) { scheduleTrack(ctx, from, ahead, perfNow, ctxNow); SND.next = ahead; }
  }

  /* One-off sounds where a shot landed. */
  function sfx(kind, p) {
    const a = AUDIO;
    if (!a?.ctx || !a.master || !a.enabled) return;
    const ctx = a.ctx, t = ctx.currentTime;
    const out = ctx.createPanner();
    out.panningModel = "equalpower"; out.refDistance = 3; out.rolloffFactor = 1.2;
    if (out.positionX) { out.positionX.value = p.x; out.positionY.value = p.y; out.positionZ.value = p.z; } else out.setPosition(p.x, p.y, p.z);
    out.connect(a.master);
    if (!SND.noise) ensureSound();
    if (kind === "tink") for (const f of [2600, 3400, 4100]) tone(ctx, t + Math.random() * 0.04, out, { f0: f, dur: 0.5, peak: 0.08 });
    if (kind === "zap") {
      tone(ctx, t, out, { type: "square", f0: 120, f1: 60, dur: 0.25, peak: 0.12 });
      noiseHit(ctx, t, out, { type: "bandpass", freq: 3000, dur: 0.18, peak: 0.25 });
    }
    if (kind === "shatter") {
      noiseHit(ctx, t, out, { type: "highpass", freq: 3200, dur: 0.35, peak: 0.45 });
      for (let i = 0; i < 4; i++) tone(ctx, t + i * 0.03, out, { f0: 2400 + Math.random() * 2600, dur: 0.25, peak: 0.06 });
    }
    // Kabukigrin's pachinko parlour (kabukigrin-street.js): a handful of
    // steel balls rattling down the pins, and a machine's jingle
    if (kind === "balls") {
      noiseHit(ctx, t, out, { type: "bandpass", freq: 5200 + Math.random() * 2500, q: 2.5, dur: 0.06, peak: 0.07 });
      for (let i = 0; i < 3; i++) tone(ctx, t + Math.random() * 0.12, out, { f0: 3800 + Math.random() * 2400, dur: 0.07, peak: 0.025 });
    }
    if (kind === "jingle") {
      const root = [523, 587, 659, 698][Math.floor(Math.random() * 4)];
      [1, 1.25, 1.5, 2, 1.5, 2].forEach((m, i) => tone(ctx, t + i * 0.09, out, { type: "square", f0: root * m, dur: 0.11, peak: 0.03 }));
    }
    // Kabukigrin's train going over (kabukigrin-train.js): a low wheel roar
    // and the rail joints' knock, a beat every 0.3 s it's near
    if (kind === "rumble") {
      noiseHit(ctx, t, out, { type: "lowpass", freq: 140, dur: 0.45, peak: 0.32 });
      tone(ctx, t, out, { type: "sine", f0: 48, f1: 42, dur: 0.4, peak: 0.12 });
      if (Math.random() < 0.35) noiseHit(ctx, t + 0.05, out, { type: "bandpass", freq: 420, q: 3, dur: 0.07, peak: 0.12 });
    }
    if (kind === "scratch") {
      tone(ctx, t, out, { type: "sawtooth", f0: 300, f1: 900, dur: 0.12, peak: 0.18, slide: 0.1 });
      tone(ctx, t + 0.12, out, { type: "sawtooth", f0: 900, f1: 200, dur: 0.18, peak: 0.18, slide: 0.16 });
    }
  }

  return {
    tick, onShot, onFrame,
    // a shot answered by the map's own pieces sounds the same (kabukigrin-rooms.js)
    sfx,
    attachAudio: (a) => { AUDIO = a; },
    attachMusic: (m) => { MUSIC = m; },
    active: () => ACTIVE,
    // DJ Lulz's record plugs in here (dj-lulz.js), null before the audio exists
    songInput: () => (ensureSound() ? SND.song : null),
    debug: () => {
      const A = ACTIVE;
      return {
        active: !!A, lights: A?.lights.length ?? 0, ballBoost: A?.ballBoost ?? 0,
        kill: Array.from(U.uKill.value), beat: U.uBeatPos.value, gone: Array.from(A?.gone.value ?? []).filter(Boolean).length,
        lp: SND.lp ? SND.lp.frequency.value : null, busGain: SND.bus ? SND.bus.gain.value : null, want: SND.gain,
        signs: (A?.signs ?? []).map((s) => ({ g: s.group, x: s.x, y: s.y, z: s.z, ry: s.ry })),
        shelf: A?.shelf ?? null, radioOn: !!A?.radioOn,
        song: A?.song ? { bpm: A.song.grid.bpm, t: A.song.t } : null,
        kick: U.uKick.value, level: U.uLevel.value, songGain: SND.song ? SND.song.gain.value : null,
        muffleAt: (x, y, z) => P.muffle({ x, y, z })[0],
        money: moneyDebug(A),
      };
    },
  };
}
