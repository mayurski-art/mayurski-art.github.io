// Troll Forces — "Trolling Loud", the neon nightclub map.
//
// A downtown superclub at night (the user's reference shots are in
// HANDOFF.md, images in refs/nightclub/). One block, three storeys:
//
//   ground   the hall: a mirror-black dance floor under a neon starburst and
//            a fringe chandelier, the DJ on a stage in front of a crystal
//            LED wall framed by nested light arches, quilted red booths
//            all round; the main bar (east), the VIP lounge under an oval
//            LED ceiling (west), the lobby, restrooms, coat check, and the
//            back of house (green room, backstage, kitchen).
//   upper    a U-shaped mezzanine round the hall (glass rails, booths,
//            windows looking down into the VIP lounge and the bar), the
//            back corridor behind the DJ wall, the manager's office and the
//            sound booth, and the open-air south terrace over the lobby.
//   roof     the Sky Bar: reached by the LED staircase off the terrace or
//            the office stair; a walkable glass skylight over the dance
//            floor, the city skyline all round.
//
// Versus: one side spawns in the south alley under the scaffold walkway,
// the other in the north loading yard under the dock shed. Zombies: they
// come off the street, the yard and over the parapets.
//
// One clock runs the club: 128 BPM, every neon tube, the dance floor, the
// LED walls, the lasers and the fourteen real lights kick on its beat
// (trollingloud-kit.js U). The club's own track plays from the DJ booth,
// muffled through the walls; start Troll Radio and the lights follow your
// song instead, on its real beat grid (music-beats.js). In Socialize DJ Lulz
// spins the radio's tracks for the whole room and takes requests at the
// booth (dj-lulz.js); his song plays through the same muffled booth chain and
// the club runs on its grid. Some things answer a bullet: signs short out,
// the mirror ball spins up, bottles shatter, the DJ's record scratches.
// Cosmetic and local, nothing synced.
//
// Everything is procedural and batched by material (Kit from
// trollcity-kit.js, Neon from trollingloud-kit.js). Every light is made
// here at load; nothing adds one at runtime (light-pool.js).

import * as THREE from "three";
import { rng, Kit, place, surfMat, texMat, tex, canvasTex, glowTexture, bottlesTexture, boardsTexture } from "./trollcity-kit.js?v=tc2-wst-tc3";
import {
  T, U, neonMat, Neon, skipOverride, ledMat, clubFx, wall, lining, cutRects, deck, glassRail,
  signsTexture, signUV, signAspect, quiltTexture, crocTexture, mosaicTexture, slatTexture, tileGlowTexture,
  fringeTexture, beamTexture, facetTexture, windowsTexture, speakerTexture, djTexture, flagTexture, busTexture,
} from "./trollingloud-kit.js?v=tl3-tc3";
import { BEATS } from "./music-beats.js?v=bg1";
import { pickOutfit } from "./outfits.js?v=of1m1-nc1";

/* ============================================================== the plan */

const BOUNDS = { minX: -36, maxX: 36, minZ: -34, maxZ: 34 };
const FL = 0.3;       // the club's floor (a step up off the street)
const CEIL = 4.2;     // ground-storey ceilings, under the upper floor
const UP = 4.5;       // the upper floor's top
const TOP = 8.7;      // the roof's underside
const ROOF = 9.0;     // the roof's top
const PARA = 1.1;     // parapet height

const B = { x0: -30, x1: 30, z0: -22, z1: 22 };
const HALL = { x0: -14, x1: 14, z0: -17, z1: 13 };
const DANCE = { x0: -7, x1: 7, z0: -10, z1: 4 };          // centre (0, -3)
const DC = { x: 0, z: -3 };
const ARM = 9.5;                                            // mezzanine arms' inner edge, |x|
const S_ARM = 8.5;                                          // south arm's inner edge, z
const STAGE = { x0: -6, x1: 6, z0: -17, z1: -13.4, top: 0.45 };
const OCULUS = [-5, 5, -8, 2];

// Stairs: api.stairs takes the foot edge, the first tread starts there.
const HALLST = { x: 7.5, zFoot: 4.3, w: 1.6, steps: 14, rise: 0.3, run: 0.3 };      // ground -> south arm, rises +z (both sides)
const SERV = { x: 28.7, zFoot: -10.6, w: 1.6, steps: 14, rise: 0.3, run: 0.3 };     // kitchen -> sound booth, rises -z
const ROOFST = { x: -28.7, zFoot: -8.6, w: 1.6, steps: 15, rise: 0.3, run: 0.3 };   // office -> roof, rises -z
const LEDST = { x: 0, zFoot: 18.4, w: 2.4, steps: 15, rise: 0.3, run: 0.35 };       // terrace -> roof, rises -z
const FIRE_S = { xFoot: 7, z: 23.1, w: 1.6, steps: 15, rise: 0.3, run: 0.3 };       // alley -> terrace, rises +x
const FIRE_N = { xFoot: -7, z: -23.1, w: 1.6, steps: 15, rise: 0.3, run: 0.3 };     // yard -> back corridor, rises -x

const SERV_HOLE = [27.75, 29.85, SERV.zFoot - SERV.steps * SERV.run, SERV.zFoot + 0.4];
const ROOF_HOLE = [-29.85, -27.75, ROOFST.zFoot - ROOFST.steps * ROOFST.run, ROOFST.zFoot + 0.4];

const BPM = 128, BPS = BPM / 60;

export const TL_FLOORS = { ground: 0, upper: UP, roof: ROOF };
export function tlFloorOf(y) { return y < 2.4 ? "ground" : y < 6.8 ? "upper" : "roof"; }

const ZSPAWNS = [];

/* ======================================================= live state

   Module state for the build being SHOWN: the lobby's map thumbnails and
   the preloader also run build(), so each build keeps its own state and
   the ticker (it only runs while its mesh is drawn) makes it the active
   one. onShot, onFrame and the sound all act on ACTIVE. */
let ACTIVE = null;
let AUDIO = null;
let MUSIC = null;

function newState() {
  return {
    lights: [], signs: [], bottles: null, ball: null, ballMirror: null, lasers: null, dj: null,
    kill: new Float32Array(16), flick: new Float32Array(16),
    gone: { value: new Float32Array(64) }, goneUntil: new Float32Array(64), bottleSegs: [],
    ballBoost: 0, ballRot: 0, dropUntil: 0, last: 0, cam: new THREE.Vector3(0, -99, 0),
    radioKick: 0, bassAvg: 0, freq: null,
    song: null, level: 1,   // a song with a beat grid driving the clock (onFrame)
  };
}

/* ============================================================ materials */

function materials() {
  const std = (color, rough = 0.8, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
  const glow = (color, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false });
  const glass = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
  const M = {
    // walls
    brick: surfMat("brick", 0x3a2e34, { mix: 0.12, tile: 2.4 }),
    brickSouth: clubFx(surfMat("brick", 0x3a2e34, { mix: 0.12, tile: 2.4 }), { wash: { color: 0xff2a7a, top: 3.5, strength: 0.1 } }),
    wallDark: clubFx(surfMat("plaster", 0x2a2432, { mix: 0.06, tile: 2.5, bounce: 0.05 }), { disco: true }),
    slats: clubFx(texMat(slatTexture(), { tile: 1.2, rough: 0.6, bounce: 0.1 }), { wash: { color: 0xff2a3a, top: 3.2, strength: 0.65 }, disco: true }),
    mosaic: clubFx(texMat(mosaicTexture(), { tile: 1.4, rough: 0.3, metal: 0.2, bounce: 0.4 }), { wash: { color: 0x20ffd0, top: 3, strength: 0.25 } }),
    barWood: clubFx(texMat(boardsTexture({ seed: 71, worn: 0.05, horizontal: true }), { color: 0x4a2a1c, tile: 1.8, rough: 0.45, bounce: 0.12 }), { wash: { color: 0xffa020, top: 2.5, strength: 0.16 } }),
    quiltWall: texMat(quiltTexture("#17121c", "#4a3c5c"), { tile: 1.0, rough: 0.5, bounce: 0.35 }),
    tileWall: surfMat("tile", 0x9ab8d0, { mix: 0.35, tile: 1.2, bounce: 0.12 }),
    // floors and ceilings
    floorHall: clubFx(surfMat("marble", 0x17131c, { mix: 0.04, tile: 3, rough: 0.28 }), { disco: true }),
    floorMezz: clubFx(surfMat("marble", 0x1c1620, { mix: 0.05, tile: 3, rough: 0.35 }), { disco: true }),
    floorVIP: surfMat("marble", 0x0e1a16, { mix: 0.05, tile: 3, rough: 0.25 }),
    floorBar: texMat(boardsTexture({ seed: 73, worn: 0.1, horizontal: true }), { color: 0x5a3a28, tile: 1.6, rough: 0.5, bounce: 0.06 }),
    floorBack: surfMat("concrete", 0x6a686e, { mix: 0.22, tile: 3, bounce: 0.08 }),
    floorLobby: surfMat("marble", 0x121016, { mix: 0.05, tile: 2.5, rough: 0.2 }),
    floorRest: surfMat("tile", 0xd0d4dc, { mix: 0.4, tile: 1.0, bounce: 0.1 }),
    carpet: std(0x2a1430, 1.0),
    ceiling: std(0x0b0a0e, 0.95),
    ceilingBack: surfMat("concrete", 0x3a3a40, { mix: 0.15, tile: 3, bounce: 0.06 }),
    roofTop: surfMat("asphalt", 0x5a5662, { mix: 0.25, tile: 3 }),
    terrace: surfMat("wood", 0x6a4a3a, { mix: 0.2, tile: 2 }),
    asphalt: surfMat("asphalt", 0x3a3a44, { mix: 0.1, tile: 4 }),
    sidewalk: surfMat("concrete", 0x6a6a74, { mix: 0.18, tile: 3 }),
    yard: surfMat("concrete", 0x5a5a60, { mix: 0.15, tile: 4 }),
    plinth: std(0x0c0b0e, 0.6),
    // trim and metal
    gold: std(0xc8a050, 0.32, 0.35, { emissive: 0x2a1c06 }),
    blackMetal: std(0x111114, 0.32, 0.6),
    blackGloss: std(0x08080a, 0.12, 0.3),
    steel: std(0x6a6c74, 0.38, 0.7),
    chrome: std(0xb0b4bc, 0.18, 0.85, { emissive: 0x101014 }),
    // furniture
    booth: clubFx(texMat(quiltTexture(), { tile: 0.7, rough: 0.45, bounce: 0.28 }), { disco: true }),
    boothBlack: texMat(quiltTexture("#141018", "#40384e"), { tile: 0.7, rough: 0.4, bounce: 0.2 }),
    boothGreen: texMat(crocTexture(), { tile: 0.8, rough: 0.35, bounce: 0.3 }),
    leather: std(0x0e0d12, 0.35, 0.1),
    tableTop: std(0x0a090e, 0.08, 0.3),
    wood: texMat(boardsTexture({ seed: 75, worn: 0.1 }), { color: 0x6a4a34, tile: 1.2, rough: 0.6 }),
    cases: std(0x15151a, 0.55, 0.3),
    speaker: texMat(speakerTexture(), { rough: 0.7 }),
    steelTop: std(0x9a9ca4, 0.25, 0.8),
    fridge: std(0xd8dade, 0.4, 0.3),
    plant: std(0x1e4a2a, 0.9),
    pot: std(0x1a1a1e, 0.5, 0.2),
    cloth: (() => { const m = std(0xffffff, 0.95); m.vertexColors = true; return m; })(),
    dumpster: std(0x1c4a30, 0.65, 0.35),
    van: std(0x1a1a24, 0.3, 0.5),
    tyre: std(0x0a0a0a, 0.9),
    bus: texMat(busTexture(), { rough: 0.35, metal: 0.3, bounce: 0.1 }),
    busBody: std(0x0e0c12, 0.3, 0.4),
    hvac: std(0x7a7c84, 0.55, 0.5),
    flag: texMat(flagTexture(), { rough: 0.9, side: THREE.DoubleSide }),
    // glass and glow
    glassRail: glass(0x9ad0ff, 0.1),
    glassWin: glass(0x6a8ab0, 0.16),
    glassRoof: glass(0x6a7ab8, 0.18),
    danceGlass: new THREE.MeshStandardMaterial({ color: 0x07040c, roughness: 0.06, metalness: 0.3, transparent: true, opacity: 0.8 }),
    black: new THREE.MeshBasicMaterial({ color: 0x000000 }),
    fluor: glow(0xe8f2ff, 1.3),
    warm: glow(0xffc880, 1.3),
    shopGlow: glow(0xd8a060, 0.38),
    laneLine: new THREE.MeshStandardMaterial({ color: 0xb8b8b0, roughness: 0.8 }),
    backlight: glow(0xffa848, 1.15),
    lens: glow(0xffffff, 2.0),
    redLamp: glow(0xff2020, 2.0),
    fridgeGlow: glow(0xbfe8ff, 0.9),
    dj: new THREE.MeshBasicMaterial({ map: djTexture(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, color: 0xd8d0e0 }),
    // neon (Neon batches; one draw call per material)
    neon: neonMat(),
    neonSign: neonMat({ map: signsTexture(), transparent: true, side: THREE.DoubleSide, key: "sign" }),
    neonHalo: neonMat({ map: glowTexture(), additive: true, side: THREE.DoubleSide, key: "halo" }),
    neonTile: neonMat({ map: tileGlowTexture(), additive: true, key: "tile" }),
    crystal: ledMat("crystal"),
    plasma: ledMat("plasma"),
    fringe: new THREE.MeshBasicMaterial({ map: fringeTexture(), color: new THREE.Color(0x9a88ff).multiplyScalar(1.25), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }),
    ball: new THREE.MeshStandardMaterial({ map: facetTexture(), roughness: 0.2, metalness: 0.75, emissive: 0x8a8aa8, emissiveMap: facetTexture() }),
    beam: new THREE.MeshBasicMaterial({ map: beamTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }),
    windows: new THREE.MeshBasicMaterial({ map: windowsTexture(), color: 0x6e6888, fog: false }),
    windowsNear: new THREE.MeshBasicMaterial({ map: windowsTexture(), color: 0x6a6478 }),
    skyDark: new THREE.MeshBasicMaterial({ color: 0x07060c }),
  };
  M.windows.userData.tile = 18;
  M.windowsNear.userData.tile = 14;
  return M;
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

/* ================================================================ helpers */

/* Socialize seats (the map's rp.seats, as in trollcity.js): every booth,
   sofa, armchair and stool, {x, z, y (the seat's top), floor, yaw, kind,
   stand}. `yaw` is the way you face sat down; `stand` is where you get up
   to, `out` metres in front of the seat. */
const SEATS = [];
function seatAt(x, z, y, floor, yaw, kind, out = 0) {
  const sx = yaw == null ? x : x - Math.sin(yaw) * out, sz = yaw == null ? z : z - Math.cos(yaw) * out;
  SEATS.push({ x, z, y, floor, yaw, kind, stand: { x: sx, z: sz } });
}
/* A sofa `len` long along `axis`, a seat every 0.7 m or so. */
function sofaSeats(x, z, len, axis, floor, yaw) {
  const n = Math.max(1, Math.floor(len / 0.7));
  for (let i = 0; i < n; i++) {
    const u = (i - (n - 1) / 2) * (len / n);
    seatAt(axis === "x" ? x + u : x, axis === "z" ? z + u : z, floor + 0.42, floor, yaw, "bench", 0.75);
  }
}

/* A U-shaped booth: quilted back and arms, a seat, a round table in the
   middle, a glowing plinth. `face` is where its open side looks. Every
   collider is axis-aligned (faces are quarter turns). */
function booth(K, M, N, cx, cz, { face = "+z", w = 2.8, d = 1.9, y = FL, mat = M.booth, glow = 0xff3a6a } = {}) {
  const L = (lx, lz) => face === "+z" ? [cx + lx, cz + lz] : face === "-z" ? [cx - lx, cz - lz] : face === "+x" ? [cx + lz, cz - lx] : [cx - lz, cz + lx];
  const swap = face === "+x" || face === "-x";
  const part = (lx, lz, lw, ld, h, m, { collide = true, py = y, pen = 3 } = {}) => {
    const [x, z] = L(lx, lz);
    const [ww, dd] = swap ? [ld, lw] : [lw, ld];
    if (collide) K.api.ghostBox(x, z, ww, dd, h, { y: py, pen });
    K.box(m, x, py, z, ww, h, dd);
  };
  part(0, -d / 2 + 0.25, w, 0.5, 1.1, mat);                                // back
  part(0, -d / 2 + 0.25, w + 0.02, 0.52, 0.05, M.gold, { collide: false, py: y + 1.1 });
  for (const s of [-1, 1]) part(s * (w / 2 - 0.22), 0.25, 0.44, d - 0.5, 0.72, mat);   // arms
  part(0, -d / 2 + 0.8, w - 0.88, 0.6, 0.42, mat);                          // seat
  // the table on a gold stem
  const [tx, tz] = L(0, 0.45);
  K.api.ghostBox(tx, tz, 0.8, 0.8, 0.74, { y, pen: 2 });
  K.cyl(M.gold, tx, y, tz, 0.25, 0.06, 0.05, 12);
  K.cyl(M.gold, tx, y + 0.05, tz, 0.05, 0.05, 0.62, 8);
  K.cyl(M.tableTop, tx, y + 0.67, tz, 0.45, 0.45, 0.05, 20);
  N.add(M.neon, place(new THREE.TorusGeometry(0.455, 0.012, 4, 24), { x: tx, y: y + 0.695, z: tz, rx: Math.PI / 2 }), { color: 0xffc070, k: 1.4, beat: 0.1 });
  // a candle lamp
  N.add(M.neon, place(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 8), { x: tx, y: y + 0.78, z: tz }), { color: 0xffb060, k: 2, beat: 0 });
  // under-seat glow strip along the open front of the seat
  const [gx, gz] = L(0, -d / 2 + 1.11);
  N.bar(M.neon, gx, y + 0.02, gz, swap ? 0.03 : w - 0.9, 0.03, swap ? w - 0.9 : 0.03, {}, { color: glow, k: 1.6, beat: 0.3 });
  // three seats along it; you get up out of the open front
  for (let i = -1; i <= 1; i++) {
    const [sx, sz] = L(i * (w - 0.88) / 3, -d / 2 + 0.8);
    seatAt(sx, sz, y + 0.42, y, FACE_YAW[face], "bench", d - 0.4);
    SEATS[SEATS.length - 1].reach = 1.7;   // you stand at the table, not at the seat
  }
}

/* A cocktail table: gold rim, smoked glass top (image 1). */
function cocktail(K, M, N, x, z, y = FL) {
  K.api.ghostBox(x, z, 0.7, 0.7, 0.75, { y, pen: 1 });
  K.cyl(M.gold, x, y, z, 0.32, 0.32, 0.04, 16);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    K.box(M.gold, x + Math.cos(a) * 0.3, y, z + Math.sin(a) * 0.3, 0.03, 0.72, 0.03);
  }
  K.cyl(M.tableTop, x, y + 0.36, z, 0.3, 0.3, 0.02, 16);
  K.cyl(M.tableTop, x, y + 0.72, z, 0.34, 0.34, 0.03, 20);
  N.add(M.neon, place(new THREE.TorusGeometry(0.345, 0.012, 4, 24), { x, y: y + 0.75, z, rx: Math.PI / 2 }), { color: 0xffb84a, k: 1.3, beat: 0.1 });
}

/* A bar stool (no collider). */
function stool(K, M, x, z, y = FL) {
  K.cyl(M.chrome, x, y, z, 0.2, 0.2, 0.03, 10);
  K.cyl(M.chrome, x, y + 0.03, z, 0.03, 0.03, 0.66, 6);
  K.cyl(M.leather, x, y + 0.68, z, 0.2, 0.2, 0.08, 12);
  seatAt(x, z, y + 0.78, y, null, "stool");
}

/* A lounge armchair (black leather), facing `ry`. */
function armchair(K, M, x, z, y, ry = 0) {
  K.api.ghostBox(x, z, 0.9, 0.9, 0.8, { y, pen: 2 });
  const c = Math.cos(ry), s = Math.sin(ry);
  const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  K.box(M.leather, x, y, z, 0.85, 0.42, 0.85, { ry });
  const [bx, bz] = at(0, -0.33);
  K.box(M.leather, bx, y + 0.42, bz, 0.85, 0.5, 0.2, { ry });
  for (const sd of [-1, 1]) {
    const [ax, az] = at(sd * 0.36, 0.05);
    K.box(M.leather, ax, y + 0.42, az, 0.14, 0.22, 0.75, { ry });
  }
  seatAt(x, z, y + 0.42, y, ry + Math.PI, "chair", 0.75);
}

/* A potted plant. */
function plant(K, M, x, z, y = FL, h = 1.4) {
  K.api.ghostBox(x, z, 0.6, 0.6, 0.6, { y, pen: 1 });
  K.cyl(M.pot, x, y, z, 0.24, 0.3, 0.55, 10);
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9;
    K.add(M.plant, place(new THREE.ConeGeometry(0.14, h * (0.55 + (i % 3) * 0.2), 5), { x: x + Math.cos(a) * 0.1, y: y + 0.55 + h * 0.3, z: z + Math.sin(a) * 0.1, rx: Math.cos(a) * 0.35, rz: Math.sin(a) * 0.35 }));
  }
}

/* Road/flight cases, stacked. */
function cases(K, M, x, z, n = 2, ry = 0) {
  K.api.ghostBox(x, z, ry ? 0.8 : 1.2, ry ? 1.2 : 0.8, 0.75 * n, { y: FL, pen: 3 });
  for (let i = 0; i < n; i++) {
    K.box(M.cases, x, FL + i * 0.75, z, ry ? 0.78 : 1.18, 0.72, ry ? 1.18 : 0.78);
    K.box(M.steel, x, FL + i * 0.75 + 0.33, z, ry ? 0.8 : 1.2, 0.04, ry ? 1.2 : 0.8);
  }
}

/* A speaker stack: cabinets with the speaker face on +z (`face` -z flips). */
function speakers(K, M, x, z, { y = FL, n = 2, face = 1, w = 1.1, d = 0.9 } = {}) {
  K.api.ghostBox(x, z, w, d, 1.25 * n, { y, pen: 4 });
  for (let i = 0; i < n; i++) {
    K.box(M.cases, x, y + i * 1.25, z, w, 1.22, d);
    K.add(M.speaker, place(new THREE.PlaneGeometry(w - 0.06, 1.18), { x, y: y + i * 1.25 + 0.61, z: z + face * (d / 2 + 0.005), ry: face > 0 ? 0 : Math.PI }), { shadow: false });
  }
}

/* A fluorescent batten on a ceiling at `y`. */
function batten(K, M, x, y, z, len = 1.4, alongX = true) {
  K.box(M.steel, x, y - 0.06, z, alongX ? len : 0.14, 0.06, alongX ? 0.14 : len, {}, { shadow: false });
  K.box(M.fluor, x, y - 0.1, z, alongX ? len - 0.06 : 0.08, 0.04, alongX ? 0.08 : len - 0.06, {}, { shadow: false });
}

/* A neon sign from the atlas, `h` tall, facing `ry` (0 = +z). `group`
   makes it shootable (it shorts out for a few seconds). */
function sign(S, N, M, name, x, y, z, h, { ry = 0, group = 0, beat = 0.18, chase = 0, halo = null, haloK = 0.3 } = {}) {
  const w = h * signAspect(name);
  const nx = Math.sin(ry), nz = Math.cos(ry);
  N.quad(M.neonSign, x, y, z, w, h, { ry, uv: signUV(name), group, beat, chase, k: 1.15 });
  if (halo) N.quad(M.neonHalo, x - nx * 0.02, y, z - nz * 0.02, w * 1.25, h * 1.7, { ry, color: halo, k: haloK, group, beat: 0.35 });
  if (group) S.signs.push({ group, x, y, z, w, h, ry });
}

/* ================================================================ the shell */

function shell(K, M, N, S) {
  /* ---- the club floor: one slab, a hole for the dance floor */
  deck(K, cutRects(B.x0 - T / 2, B.x1 + T / 2, B.z0 - T / 2, B.z1 + T / 2, [[DANCE.x0, DANCE.x1, DANCE.z0, DANCE.z1]]), { top: FL, h: FL, edge: M.plinth });
  const paint = (mat, x0, x1, z0, z1, holes = [], y = FL + 0.002) => {
    for (const [a0, a1, b0, b1] of cutRects(x0, x1, z0, z1, holes)) {
      for (let x = a0; x < a1 - 0.01; x += 8) for (let z = b0; z < b1 - 0.01; z += 8) {
        const xe = Math.min(a1, x + 8), ze = Math.min(b1, z + 8);
        K.add(mat, place(new THREE.PlaneGeometry(xe - x, ze - z), { x: (x + xe) / 2, y, z: (z + ze) / 2, rx: -Math.PI / 2 }), { shadow: false });
      }
    }
  };
  paint(M.floorHall, HALL.x0, HALL.x1, HALL.z0, HALL.z1, [[DANCE.x0, DANCE.x1, DANCE.z0, DANCE.z1]]);
  paint(M.floorLobby, -14, 14, 13, B.z1);
  paint(M.floorVIP, B.x0, -14, -7, 13);
  paint(M.floorRest, B.x0, -14, 13, B.z1);
  paint(M.floorBack, B.x0, -14, B.z0, -7);
  paint(M.floorBack, -14, 14, B.z0, HALL.z0);
  paint(M.floorBack, 14, B.x1, B.z0, -9);
  paint(M.floorBar, 14, B.x1, -9, 13);
  paint(M.floorBack, 14, B.x1, 13, B.z1);

  /* ---- outer walls: brick, foot on the slab, up to the roof's top */
  const H = ROOF - FL;
  const door = (c, w = 2.0, hi = 2.3) => ({ c, w, spans: [[0, hi]] });
  const upDoor = (lo = UP - FL) => [lo, lo + 2.5];
  const north = [
    { c: -22, w: 2.0, spans: [[0, 2.3], [5.1, 6.6]], glass: M.glassWin },
    door(0, 3.0, 2.6),
    { c: 22, w: 3.0, spans: [[0, 2.6], [5.1, 6.6]], glass: M.glassWin },
    { c: -12.7, w: 2.0, spans: [upDoor()] },
    { c: -18.5, w: 2.6, spans: [[5.1, 6.6]], glass: M.glassWin },
    { c: 18, w: 2.6, spans: [[5.1, 6.6]], glass: M.glassWin },
  ];
  wall(K, { axis: "x", at: B.z0, a: B.x0 - T / 2, b: B.x1 + T / 2, y: FL, h: H, mat: M.brick, holes: north, frame: M.blackMetal });
  const west = [door(-4)];
  wall(K, { axis: "z", at: B.x0, a: B.z0 + T / 2, b: B.z1 - T / 2, y: FL, h: H, mat: M.brick, holes: west, frame: M.blackMetal });
  const east = [door(11.8)];
  wall(K, { axis: "z", at: B.x1, a: B.z0 + T / 2, b: B.z1 - T / 2, y: FL, h: H, mat: M.brick, holes: east, frame: M.blackMetal });
  // south: the wings go up to the roof, the middle stops at the terrace
  wall(K, { axis: "x", at: B.z1, a: B.x0 - T / 2, b: -14 - T / 2, y: FL, h: H, mat: M.brickSouth, holes: [door(-24)], frame: M.blackMetal });
  wall(K, { axis: "x", at: B.z1, a: 14 + T / 2, b: B.x1 + T / 2, y: FL, h: H, mat: M.brickSouth, holes: [door(24)], frame: M.blackMetal });
  wall(K, { axis: "x", at: B.z1, a: -14 - T / 2, b: 14 + T / 2, y: FL, h: UP - FL, mat: M.brickSouth, holes: [door(0, 3.3, 2.7)], frame: M.gold });

  /* ---- inside walls (foot FL, top TOP) */
  const IH = TOP - FL;
  const sideHall = (s) => [
    { c: -19.5, w: 2.0, spans: [[0, 2.3], upDoor()] },
    { c: -12, w: 2.0, spans: [[0, 2.3], upDoor()] },
    { c: -2, w: 3.3, spans: [[0, 3.0], [5.2, 7.4]] },
    { c: 8, w: 3.3, spans: [[0, 3.0], [5.2, 7.4]] },
  ];
  wall(K, { axis: "z", at: -14, a: B.z0 + T / 2, b: 13 - T / 2, y: FL, h: IH, mat: M.wallDark, holes: sideHall(-1), frame: M.gold });
  wall(K, { axis: "z", at: 14, a: B.z0 + T / 2, b: 13 - T / 2, y: FL, h: IH, mat: M.wallDark, holes: sideHall(1), frame: M.gold });
  // the notch walls either side of the lobby and terrace, up to the roof
  wall(K, { axis: "z", at: -14, a: 13 - T / 2, b: B.z1 - T / 2, y: FL, h: H, mat: M.brick, holes: [door(17.5)], frame: M.gold });
  wall(K, { axis: "z", at: 14, a: 13 - T / 2, b: B.z1 - T / 2, y: FL, h: H, mat: M.brick, holes: [door(17.5)], frame: M.gold });
  // z = 13: VIP | restrooms, hall | lobby (and the terrace above), bar | coat check
  wall(K, { axis: "x", at: 13, a: B.x0 + T / 2, b: -14 - T / 2, y: FL, h: IH, mat: M.wallDark, holes: [door(-22)], frame: M.gold });
  wall(K, { axis: "x", at: 13, a: 14 + T / 2, b: B.x1 - T / 2, y: FL, h: IH, mat: M.wallDark, holes: [door(22)], frame: M.gold });
  const hallSouth = [
    { c: -3, w: 3.3, spans: [[0, 2.9]] }, { c: 3, w: 3.3, spans: [[0, 2.9]] },
    { c: -6.4, w: 2.2, spans: [upDoor()] }, { c: 6.4, w: 2.2, spans: [upDoor()] },
    { c: -10.6, w: 4, spans: [[5.0, 7.6]], glass: M.glassWin }, { c: 10.6, w: 4, spans: [[5.0, 7.6]], glass: M.glassWin },
  ];
  wall(K, { axis: "x", at: 13, a: -14 - T / 2, b: 14 + T / 2, y: FL, h: H, mat: M.brick, holes: hallSouth, frame: M.gold });
  // the DJ wall
  const djWall = [{ c: -11.6, w: 2.0, spans: [[0, 2.3], upDoor()] }, { c: 11.6, w: 2.0, spans: [[0, 2.3], upDoor()] }];
  wall(K, { axis: "x", at: HALL.z0, a: -14 + T / 2, b: 14 - T / 2, y: FL, h: IH, mat: M.wallDark, holes: djWall, frame: M.gold });
  // green room | VIP (the office window looks down into the lounge)
  const vipNorth = [door(-25), { c: -19.5, w: 5, spans: [[5.2, 7.2]] }];
  wall(K, { axis: "x", at: -7, a: B.x0 + T / 2, b: -14 - T / 2, y: FL, h: IH, mat: M.wallDark, holes: vipNorth, frame: M.gold });
  // kitchen | bar (the sound booth's window over the bar)
  const barNorth = [door(22), { c: 18.5, w: 5, spans: [[5.2, 7.2]] }];
  wall(K, { axis: "x", at: -9, a: 14 + T / 2, b: B.x1 - T / 2, y: FL, h: IH, mat: M.wallDark, holes: barNorth, frame: M.gold });

  /* ---- facings */
  const lin = (mat, o) => lining(K, mat, { y: FL, ...o });
  // the hall: slatted panels all round
  lin(M.slats, { axis: "z", at: -14, side: 1, a: HALL.z0 + T / 2, b: 13 - T / 2, v1: IH, holes: sideHall(-1) });
  lin(M.slats, { axis: "z", at: 14, side: -1, a: HALL.z0 + T / 2, b: 13 - T / 2, v1: IH, holes: sideHall(1) });
  lin(M.slats, { axis: "x", at: 13, side: -1, a: -14 + T / 2, b: 14 - T / 2, v1: IH, holes: hallSouth });
  lin(M.slats, { axis: "x", at: HALL.z0, side: 1, a: -14 + T / 2, b: 14 - T / 2, v1: IH, holes: djWall });
  // VIP: teal mosaic
  lin(M.mosaic, { axis: "z", at: B.x0, side: 1, a: -7 + T / 2, b: 13 - T / 2, v1: IH, holes: west });
  lin(M.mosaic, { axis: "z", at: -14, side: -1, a: -7 + T / 2, b: 13 - T / 2, v1: IH, holes: sideHall(-1) });
  lin(M.mosaic, { axis: "x", at: -7, side: 1, a: B.x0 + T / 2, b: -14 - T / 2, v1: IH, holes: vipNorth });
  lin(M.mosaic, { axis: "x", at: 13, side: -1, a: B.x0 + T / 2, b: -14 - T / 2, v1: IH, holes: [door(-22)] });
  // the bar: dark wood
  lin(M.barWood, { axis: "z", at: B.x1, side: -1, a: -9 + T / 2, b: 13 - T / 2, v1: IH, holes: east });
  lin(M.barWood, { axis: "z", at: 14, side: 1, a: -9 + T / 2, b: 13 - T / 2, v1: IH, holes: sideHall(1) });
  lin(M.barWood, { axis: "x", at: -9, side: 1, a: 14 + T / 2, b: B.x1 - T / 2, v1: IH, holes: barNorth });
  lin(M.barWood, { axis: "x", at: 13, side: -1, a: 14 + T / 2, b: B.x1 - T / 2, v1: IH, holes: [door(22)] });
  // the lobby: black quilting
  const LH = CEIL - FL;
  lin(M.quiltWall, { axis: "z", at: -14, side: 1, a: 13 + T / 2, b: B.z1 - T / 2, v1: LH, holes: [door(17.5)] });
  lin(M.quiltWall, { axis: "z", at: 14, side: -1, a: 13 + T / 2, b: B.z1 - T / 2, v1: LH, holes: [door(17.5)] });
  lin(M.quiltWall, { axis: "x", at: 13, side: 1, a: -14 + T / 2, b: 14 - T / 2, v1: LH, holes: hallSouth });
  lin(M.quiltWall, { axis: "x", at: B.z1, side: -1, a: -14 + T / 2, b: 14 - T / 2, v1: LH, holes: [door(0, 3.3, 2.7)] });
  // restrooms: tile
  lin(M.tileWall, { axis: "z", at: B.x0, side: 1, a: 13 + T / 2, b: B.z1 - T / 2, v1: LH });
  lin(M.tileWall, { axis: "z", at: -14, side: -1, a: 13 + T / 2, b: B.z1 - T / 2, v1: LH, holes: [door(17.5)] });
  lin(M.tileWall, { axis: "x", at: 13, side: 1, a: B.x0 + T / 2, b: -14 - T / 2, v1: LH, holes: [door(-22)] });
  lin(M.tileWall, { axis: "x", at: B.z1, side: -1, a: B.x0 + T / 2, b: -14 - T / 2, v1: LH, holes: [door(-24)] });

  /* ---- the upper floor and the ceilings under it */
  const up = (rects, top, o = {}) => deck(K, rects, { top: UP, h: UP - CEIL, under: M.ceilingBack, ...o, topMat: top });
  up([[-14, 14, 13, B.z1]], M.terrace, { under: M.ceiling });                  // the terrace, over the lobby
  up([[-14, 14, B.z0, HALL.z0]], M.floorBack);                                 // the back corridor, over backstage
  up([[B.x0, -14, B.z0, -7]], M.carpet);                                       // the office, over the green room
  up(cutRects(14, B.x1, B.z0, -9, [SERV_HOLE]), M.floorBack);                  // the sound booth, over the kitchen
  up([[B.x0, -14, 13, B.z1], [14, B.x1, 13, B.z1]], null);                     // over the restrooms and coat check (shut in)
  // the mezzanine: a U round the hall, a lit fascia on its inner edges
  up([[HALL.x0, -ARM, HALL.z0, HALL.z1], [ARM, HALL.x1, HALL.z0, HALL.z1], [-ARM, ARM, S_ARM, HALL.z1]], M.floorMezz, { under: M.ceiling });
  for (const s of [-1, 1]) {
    K.box(M.blackGloss, s * (ARM + 0.04), CEIL - 0.25, (HALL.z0 + S_ARM) / 2, 0.08, 0.55, S_ARM - HALL.z0);
    N.bar(M.neon, s * (ARM - 0.02), CEIL - 0.12, (HALL.z0 + S_ARM) / 2, 0.03, 0.04, S_ARM - HALL.z0, {}, { color: 0xa060ff, k: 2.2, chase: 0.7, phase: 0, beat: 0.3 });
  }
  K.box(M.blackGloss, 0, CEIL - 0.25, S_ARM - 0.04, ARM * 2, 0.55, 0.08);
  N.bar(M.neon, 0, CEIL - 0.12, S_ARM - 0.06, ARM * 2, 0.04, 0.03, {}, { color: 0xa060ff, k: 2.2, chase: 0.7, beat: 0.3 });
  // its posts: black columns ringed with light (image 3)
  for (const s of [-1, 1]) {
    for (const z of [-14.5, -9, -3.5, 2, S_ARM]) column(K, M, N, s * ARM, z, FL, CEIL);
  }
  for (const x of [-4.2, 4.2]) column(K, M, N, x, S_ARM, FL, CEIL);
  // glass rails on its edges, open at the two hall stairs
  for (const s of [-1, 1]) glassRail(K, M, { axis: "z", at: s * ARM, a: HALL.z0 + T / 2, b: S_ARM, y: UP });
  for (const [a, b] of [[-ARM, -HALLST.x - HALLST.w / 2], [-HALLST.x + HALLST.w / 2, HALLST.x - HALLST.w / 2], [HALLST.x + HALLST.w / 2, ARM]]) {
    glassRail(K, M, { axis: "x", at: S_ARM, a, b, y: UP });
  }
  // round the service stair's hole
  K.solid(SERV_HOLE[0] - 0.05, (SERV_HOLE[2] + SERV_HOLE[3]) / 2, 0.1, SERV_HOLE[3] - SERV_HOLE[2], 1.05, { y: UP, pen: 0.4, mat: M.steel });
  K.solid((SERV_HOLE[0] + SERV_HOLE[1]) / 2, SERV_HOLE[3] + 0.05, SERV_HOLE[1] - SERV_HOLE[0], 0.1, 1.05, { y: UP, pen: 0.4, mat: M.steel });

  /* ---- the roof: everything but the terrace notch, the skylight and the
     office stair's hole */
  deck(K, cutRects(B.x0, B.x1, B.z0, B.z1, [[-14, 14, 13, B.z1], OCULUS, ROOF_HOLE]), { top: ROOF, h: ROOF - TOP, topMat: M.roofTop, under: M.ceiling });
  // parapets: round the outside, round the notch (open at the LED stair)
  const par = (x, z, w, d) => K.solid(x, z, w, d, PARA, { y: ROOF, mat: M.brick });
  par(0, B.z0, B.x1 - B.x0 + T, T);
  par(B.x0, 0, T, B.z1 - B.z0 - T);
  par(B.x1, 0, T, B.z1 - B.z0 - T);
  par((B.x0 - 14) / 2 - T / 4, B.z1, -14 - B.x0 + T / 2, T);
  par((B.x1 + 14) / 2 + T / 4, B.z1, B.x1 - 14 + T / 2, T);
  par(-14, (13 + B.z1) / 2, T, B.z1 - 13 - T);
  par(14, (13 + B.z1) / 2, T, B.z1 - 13 - T);
  const gap = LEDST.w / 2 + 0.2;
  par((-14 - gap) / 2, 13, 14 - gap + T / 2, T);
  par((14 + gap) / 2, 13, 14 - gap + T / 2, T);
  for (const [x, z, w, d] of [[0, B.z0, 60, 0], [B.x0, 0, 0, 44], [B.x1, 0, 0, 44]]) {
    N.bar(M.neon, x, ROOF + PARA + 0.01, z, w ? w : 0.05, 0.04, d ? d : 0.05, {}, { color: 0x6a5aff, k: 1.6, chase: 0.6, beat: 0.2 });
  }
  // round the office stair's hole
  K.solid(ROOF_HOLE[1] + 0.05, (ROOF_HOLE[2] + ROOF_HOLE[3]) / 2, 0.1, ROOF_HOLE[3] - ROOF_HOLE[2], 1.05, { y: ROOF, pen: 0.4, mat: M.steel });
  K.solid((ROOF_HOLE[0] + ROOF_HOLE[1]) / 2, ROOF_HOLE[3] + 0.05, ROOF_HOLE[1] - ROOF_HOLE[0], 0.1, 1.05, { y: ROOF, pen: 0.4, mat: M.steel });
  // the skylight: walkable glass over the dance floor
  {
    const [x0, x1, z0, z1] = OCULUS;
    K.api.ghostBox((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, 0.1, { y: ROOF - 0.1, pen: 0.3 });
    K.add(M.glassRoof, place(new THREE.PlaneGeometry(x1 - x0, z1 - z0), { x: (x0 + x1) / 2, y: ROOF - 0.04, z: (z0 + z1) / 2, rx: -Math.PI / 2 }), { shadow: false });
    for (let i = 0; i <= 4; i++) {
      K.box(M.blackMetal, x0 + (i * (x1 - x0)) / 4, ROOF - 0.12, (z0 + z1) / 2, 0.08, 0.12, z1 - z0);
      K.box(M.blackMetal, (x0 + x1) / 2, ROOF - 0.12, z0 + (i * (z1 - z0)) / 4, x1 - x0, 0.12, 0.08);
    }
    N.tube(M.neon, [[x0, ROOF + 0.02, z0], [x1, ROOF + 0.02, z0], [x1, ROOF + 0.02, z1], [x0, ROOF + 0.02, z1]], { smooth: false, closed: true, r: 0.04, color: 0xff3fb4, k: 2.0, chase: 0.8, chaseLen: 10, beat: 0.3 });
  }

  /* ---- the stairs: colliders through the map api (bots and K9s read
     their links), drawn here */
  const api = K.api;
  for (const s of [-1, 1]) {
    const x = s * HALLST.x;
    api.stairs(x, HALLST.zFoot, HALLST.w, HALLST.steps, HALLST.rise, HALLST.run, "+z", { y: FL, ghost: true });
    for (let i = 0; i < HALLST.steps; i++) {
      const z = HALLST.zFoot + HALLST.run * (i + 0.5), top = FL + HALLST.rise * (i + 1);
      K.box(M.blackGloss, x, FL, z, HALLST.w, top - FL, HALLST.run);
      N.bar(M.neon, x, top - HALLST.rise + 0.02, z - HALLST.run / 2 - 0.006, HALLST.w - 0.1, 0.03, 0.012, {}, { color: 0xff3fb4, k: 2.0, chase: 0.8, phase: i * 0.09, beat: 0.4 });
    }
    // glass sides on the upper two thirds, a gold handrail
    for (const sd of [-1, 1]) {
      const rx = x + sd * (HALLST.w / 2 + 0.05);
      const z0 = HALLST.zFoot + 1.2, z1 = S_ARM;
      K.api.ghostBox(rx, (z0 + z1) / 2, 0.08, z1 - z0, UP + 1.05 - FL, { y: FL, pen: 0.3 });
      const ang = Math.atan2(HALLST.rise, HALLST.run);
      const len = (z1 - HALLST.zFoot) / Math.cos(ang);
      const mid = FL + (z1 - HALLST.zFoot) * Math.tan(ang) / 2 + 0.95;
      K.add(M.glassRail, place(new THREE.PlaneGeometry(len, 0.95), { x: rx, y: mid - 0.45, z: (HALLST.zFoot + z1) / 2, ry: Math.PI / 2, rx: 0, rz: 0 }), { shadow: false });
      K.box(M.gold, rx, mid, (HALLST.zFoot + z1) / 2, 0.06, 0.06, len, { rx: -ang });
    }
  }
  api.stairs(SERV.x, SERV.zFoot, SERV.w, SERV.steps, SERV.rise, SERV.run, "-z", { y: FL, ghost: true });
  steelStair(K, M, SERV.x, SERV.zFoot, SERV, FL, -1);
  api.stairs(ROOFST.x, ROOFST.zFoot, ROOFST.w, ROOFST.steps, ROOFST.rise, ROOFST.run, "-z", { y: UP, ghost: true });
  steelStair(K, M, ROOFST.x, ROOFST.zFoot, ROOFST, UP, -1);
}

/* A black column with rings of white light (image 3). */
function column(K, M, N, x, z, y0, y1, r = 0.26) {
  K.api.ghostBox(x, z, r * 2, r * 2, y1 - y0, { y: y0, pen: 6 });
  K.cyl(M.blackGloss, x, y0, z, r, r, y1 - y0, 16);
  for (let y = y0 + 0.8; y < y1 - 0.3; y += 0.9) {
    N.add(M.neon, place(new THREE.TorusGeometry(r + 0.012, 0.022, 4, 20), { x, y, z, rx: Math.PI / 2 }), { color: 0xf0f4ff, k: 1.05, beat: 0.25, phase: y * 0.2, chase: 0.3 });
  }
}

/* A plain steel service stair along z (dir -1 rises toward -z). */
function steelStair(K, M, x, zFoot, st, y0, dir) {
  for (let i = 0; i < st.steps; i++) {
    const z = zFoot + dir * st.run * (i + 0.5), top = y0 + st.rise * (i + 1);
    K.box(M.steel, x, top - 0.05, z, st.w, 0.05, st.run);
  }
  const len = st.steps * st.run, h = st.steps * st.rise;
  const ang = Math.atan2(h, len);
  for (const s of [-1, 1]) {
    K.box(M.blackMetal, x + s * (st.w / 2 + 0.03), y0 + h / 2 - 0.2, zFoot + (dir * len) / 2, 0.05, 0.3, Math.hypot(len, h), { rx: dir * ang });
  }
  // the space under it, closed in with mesh panels
  K.add(M.blackMetal, place(new THREE.PlaneGeometry(len, h), { x: x - st.w / 2 - 0.05, y: y0 + h / 2, z: zFoot + (dir * len) / 2, ry: Math.PI / 2 }), { shadow: false });
}

/* =================================================================== the hall */

function hall(K, M, N, HN, S, lights) {
  /* ---- the dance floor: black glass over a mirror pit, LED tiles */
  K.add(M.danceGlass, place(new THREE.PlaneGeometry(DANCE.x1 - DANCE.x0, DANCE.z1 - DANCE.z0), { x: DC.x, y: 0.0, z: DC.z, rx: -Math.PI / 2 }), { shadow: false });
  // the pit under it: black all round, deep enough to hold the reflection
  const PIT = 12;
  K.box(M.black, 0, -PIT - 0.1, (HALL.z0 + HALL.z1) / 2, HALL.x1 - HALL.x0 + 2, 0.1, HALL.z1 - HALL.z0 + 2, {}, { shadow: false });
  for (const [x, z, w, d] of [[HALL.x0 - 1, 0, 0.1, 40], [HALL.x1 + 1, 0, 0.1, 40], [0, HALL.z0 - 1, 32, 0.1], [0, HALL.z1 + 1, 32, 0.1]]) {
    K.box(M.black, x, -PIT, z === 0 ? (HALL.z0 + HALL.z1) / 2 : z, w, PIT - 0.02, d, {}, { shadow: false });
  }
  for (let i = 0; i < 14; i++) for (let j = 0; j < 14; j++) {
    const x = DANCE.x0 + 0.5 + i, z = DANCE.z0 + 0.5 + j;
    const pal = [0xff2ab4, 0x3ff0ff, 0x8a4aff, 0xff2ab4];
    const r = Math.hypot(x - DC.x, z - DC.z);
    N.quad(M.neonTile, x, 0.012, z, 0.96, 0.96, { rx: -Math.PI / 2, color: pal[(i + j) % 4], k: 0.42, chase: 0.75, phase: -r * 0.18, beat: 0.6, rip: 1 });
  }
  // a lit edge where the dance floor steps down
  for (const [x, z, w, d] of [[DC.x, DANCE.z0 - 0.01, 14, 0.02], [DC.x, DANCE.z1 + 0.01, 14, 0.02], [DANCE.x0 - 0.01, DC.z, 0.02, 14], [DANCE.x1 + 0.01, DC.z, 0.02, 14]]) {
    N.bar(M.neon, x, 0.18, z, w, 0.03, d, {}, { color: 0x3ff0ff, k: 2.2, chase: 1, chaseLen: 4, beat: 0.4 });
  }

  /* ---- the DJ: stage, booth, crystal wall, arches */
  K.solid((STAGE.x0 + STAGE.x1) / 2, (STAGE.z0 + STAGE.z1) / 2, STAGE.x1 - STAGE.x0, STAGE.z1 - STAGE.z0, STAGE.top - FL, { y: FL, mat: M.blackGloss });
  N.bar(M.neon, 0, STAGE.top - 0.06, STAGE.z1 + 0.005, STAGE.x1 - STAGE.x0, 0.03, 0.01, {}, { color: 0xff3fb4, k: 2.2, chase: 0.8, beat: 0.5 });
  // the crystal LED wall (image 5)
  K.add(M.crystal, place(new THREE.PlaneGeometry(14, 6.2), { x: 0, y: STAGE.top + 3.1, z: HALL.z0 + T / 2 + 0.02 }), { shadow: false });
  // nested light arches framing it, red and gold LED points (image 5)
  for (let i = 0; i < 6; i++) {
    const a = 9.4 - i * 0.45, h = 8.15 - i * 0.26, z = HALL.z0 + 0.4 + i * 0.38, y0 = STAGE.top;
    const pts = [];
    for (let k = 0; k <= 20; k++) {
      const t = Math.PI * (k / 20);
      pts.push([-Math.cos(t) * a, y0 + Math.sin(t) * (h - y0), z]);
    }
    HN.tube(M.neon, pts, { r: 0.045, color: i % 2 ? 0xff3a3a : 0xffb84a, k: 2.0, chase: 0.65, chaseLen: 2.5, phase0: i * 0.3, beat: 0.35 });
  }
  // the booth
  K.solid(0, -14.25, 5.2, 0.9, 1.1, { y: STAGE.top, pen: 3, mat: M.blackGloss });
  K.box(M.gold, 0, STAGE.top + 1.1, -14.25, 5.3, 0.04, 1.0);
  for (const x of [-1.5, 1.5]) {
    K.cyl(M.steel, x, STAGE.top + 1.14, -14.3, 0.33, 0.33, 0.04, 20);
    K.cyl(M.blackGloss, x, STAGE.top + 1.18, -14.3, 0.3, 0.3, 0.015, 20);
  }
  K.box(M.cases, 0, STAGE.top + 1.14, -14.35, 0.8, 0.08, 0.5);
  N.bar(M.neon, 0, STAGE.top + 0.15, -13.79, 5.0, 0.05, 0.01, {}, { color: 0x3ff0ff, k: 2.4, chase: 0.9, beat: 0.6 });
  sign(S, N, M, "dj", 0, STAGE.top + 0.62, -13.785, 0.62, { group: 13 });
  // the troll DJ, bobbing on the beat
  {
    const g = new THREE.PlaneGeometry(1.4, 1.75);
    const dj = new THREE.Mesh(g, M.dj);
    dj.position.set(0, STAGE.top + 1.4, -14.95);
    S.dj = dj;
    S.djY = dj.position.y;
    K.root.add(dj);
  }
  // speaker stacks and line arrays
  for (const s of [-1, 1]) {
    speakers(K, M, s * 7.0, -15.6, { n: 2, face: 1 });
    for (let i = 0; i < 4; i++) {
      K.box(M.cases, s * 7.0, 7.4 - i * 0.42, -15.2, 1.0, 0.38, 0.7, { rx: -0.06 * i }, { shadow: false });
    }
    K.box(M.blackMetal, s * 7.0, 7.62, -15.2, 0.05, TOP - 7.62, 0.05);
  }
  // the big trollface over the crystal wall
  sign(S, N, M, "trollCyan", 0, STAGE.top + 4.2, HALL.z0 + T / 2 + 0.06, 3.3, { group: 4, halo: 0x3ff0ff, haloK: 0.25, beat: 0.4 });

  /* ---- the ceiling: neon starburst round the skylight (image 1), a ring
     of moving heads (image 5) */
  const y = TOP - 0.3;
  HN.tube(M.neon, ringPts(5.4, y, 48), { closed: true, r: 0.05, color: 0xff3fb4, k: 2.6, chase: 0.8, chaseLen: 4, beat: 0.4 });
  const petals = 16;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    const rOut = rayToHall(a) - 0.6;
    const tw = 0.26, d = 0.16;
    const P = (r, ang, yy = y) => [DC.x + Math.cos(ang) * r, yy, DC.z + Math.sin(ang) * r];
    const mid = 5.6 + (rOut - 5.6) * 0.55;
    const pts = [P(5.6, a - d), P(mid, a - d * 1.8 + tw), P(rOut, a + tw * 0.9, y - 0.25), P(mid, a + d * 1.8 + tw), P(5.6, a + d)];
    HN.tube(M.neon, pts, { r: 0.035, color: i % 2 ? 0x9fd8ff : 0xb07aff, k: 2.4, chase: 0.9, chaseLen: 5, phase0: i * 0.13, beat: 0.3 });
  }
  K.add(M.blackMetal, place(new THREE.TorusGeometry(7.4, 0.12, 6, 48), { x: DC.x, y: y - 0.4, z: DC.z, rx: Math.PI / 2 }), { shadow: false });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const hx = DC.x + Math.cos(a) * 7.4, hz = DC.z + Math.sin(a) * 7.4;
    K.box(M.blackMetal, hx, y - 0.95, hz, 0.28, 0.42, 0.28, { ry: -a });
    N.add(M.neon, place(new THREE.CircleGeometry(0.1, 10), { x: hx, y: y - 0.96, z: hz, rx: Math.PI / 2 }), { color: i % 3 ? 0xffffff : 0xffd080, k: 2.4, beat: 0.7, chase: 0.5, phase: i / 16 });
  }

  /* ---- the fringe chandelier and the mirror ball (image 2) */
  const top = 7.9;
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
  // the ball: a collider so it can be shot (its rod holds it up)
  const BY = 6.75, BR = 0.55;
  K.api.ghostBox(DC.x, DC.z, BR * 2, BR * 2, BR * 2, { y: BY - BR, pen: 0.5 });
  K.api.ghostBox(DC.x, DC.z, 0.06, 0.06, ROOF - 0.1 - (BY - BR), { y: BY - BR, pen: 0.2 });
  K.box(M.chrome, DC.x, BY + BR - 0.05, DC.z, 0.03, ROOF - 0.1 - (BY + BR - 0.05), 0.03, {}, { shadow: false });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BR, 24, 16), M.ball);
  ball.position.set(DC.x, BY, DC.z);
  K.root.add(ball);
  S.ball = ball;
  U.uBall.value.set(DC.x, BY, DC.z);
  S.ballBox = { x: DC.x, y: BY, z: DC.z, r: BR + 0.2 };

  /* ---- booths under and on the mezzanine, cocktail tables */
  for (const s of [-1, 1]) {
    const face = s < 0 ? "+x" : "-x";
    const wx = s * (14 - T / 2 - 0.95);
    for (const z of [-7, 3]) {
      booth(K, M, N, wx, z, { face, glow: 0xff3a6a });
      booth(K, M, N, wx, z, { face, y: UP, glow: 0xa060ff });
    }
    booth(K, M, N, s * 10, 13 - T / 2 - 0.95, { face: "-z", glow: 0xff3a6a });
    cocktail(K, M, N, s * 4.5, 11, UP);
    cocktail(K, M, N, s * 8.0, 11.2, UP);
    cocktail(K, M, N, s * 11.6, -14.2, UP);
  }
  for (const [x, z] of [[-8.2, -15.6], [8.2, -15.6], [-8.4, -12], [8.4, -12]]) cocktail(K, M, N, x, z);
  // a go-go podium on the dance floor, under the ball
  K.cyl(M.blackGloss, DC.x, 0, DC.z, 1.0, 1.0, 0.28, 24);
  N.add(M.neon, place(new THREE.TorusGeometry(1.0, 0.02, 4, 32), { x: DC.x, y: 0.28, z: DC.z, rx: Math.PI / 2 }), { color: 0xffffff, k: 2.2, beat: 0.6, chase: 0.6, chaseLen: 2 });
  K.api.ghostBox(DC.x, DC.z, 1.6, 1.6, 0.28, { y: 0, pen: 4 });

  /* ---- "no trolling on the dance floor", over the lobby doors */
  sign(S, N, M, "noTroll", 0, 3.55, 13 - T / 2 - 0.03, 0.62, { ry: Math.PI, group: 9 });

  /* ---- light: three over the floor, one on the DJ, two on the mezzanine */
  addLight(S, lights, 0xff2ab4, 34, 24, -5.5, 6.2, -6, { hue: 0.92, amp: 0.25 });
  addLight(S, lights, 0x3ff0ff, 34, 24, 5.5, 6.2, -6, { hue: 0.5, amp: 0.25 });
  addLight(S, lights, 0x8a4aff, 30, 24, 0, 6.2, 3.5, { hue: 0.75, amp: 0.25 });
  addLight(S, lights, 0xffd8f0, 16, 12, 0, 3.4, -12.6, { amp: 0.2 });
  addLight(S, lights, 0x9a60ff, 14, 16, -11.7, 7.6, -2, { amp: 0.15 });
  addLight(S, lights, 0x9a60ff, 14, 16, 11.7, 7.6, -2, { amp: 0.15 });
}

function ringPts(r, y, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push([DC.x + Math.cos(a) * r, y, DC.z + Math.sin(a) * r]);
  }
  return out;
}

/* How far a ray from the dance floor's centre at angle `a` runs before it
   meets the hall's walls. */
function rayToHall(a) {
  const c = Math.cos(a), s = Math.sin(a);
  const tx = c > 0 ? (HALL.x1 - 0.5 - DC.x) / c : c < 0 ? (HALL.x0 + 0.5 - DC.x) / c : Infinity;
  const tz = s > 0 ? (HALL.z1 - 0.5 - DC.z) / s : s < 0 ? (HALL.z0 + 0.5 - DC.z) / s : Infinity;
  return Math.min(tx, tz);
}

function addLight(S, lights, color, power, range, x, y, z, { hue = null, amp = 0.2 } = {}) {
  const l = new THREE.PointLight(color, power, range, 1.6);
  l.position.set(x, y, z);
  l.castShadow = false;
  lights.push(l);
  S.lights.push({ l, base: power, hue, amp });
}

/* ==================================================== the rooms off the hall */

function vip(K, M, N, S, lights) {
  const cx = -22, cz = 3;
  // the oval LED ceiling in a black and gold frame (image 3)
  const disc = new THREE.CircleGeometry(1, 48);
  K.add(M.plasma, place(disc, { x: cx, y: TOP - 0.25, z: cz, rx: Math.PI / 2, sx: 5.4, sy: 6.8 }), { shadow: false });
  K.add(M.gold, place(new THREE.TorusGeometry(1, 0.012, 4, 64), { x: cx, y: TOP - 0.25, z: cz, rx: Math.PI / 2, sx: 5.5, sy: 6.9, sz: 8 }), { shadow: false });
  K.box(M.blackGloss, cx, TOP - 0.55, cz, 13, 0.3, 0.3, {}, { shadow: false });
  N.tube(M.neon, (() => { const p = []; for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; p.push([cx + Math.cos(a) * 5.6, TOP - 0.3, cz + Math.sin(a) * 7.0]); } return p; })(), { closed: true, r: 0.03, color: 0xffffff, k: 1.8, chase: 0.5, beat: 0.3 });
  // black columns ringed with light
  for (const [x, z] of [[-27, -3], [-17, -3], [-27, 9.5], [-17, 9.5]]) column(K, M, N, x, z, FL, TOP, 0.42);
  // croc booths on gold plinths, round the room
  booth(K, M, N, cx, -5.3, { face: "+z", w: 3.2, mat: M.boothGreen, glow: 0x20ffd0 });
  booth(K, M, N, cx, 11.3, { face: "-z", w: 3.2, mat: M.boothGreen, glow: 0x20ffd0 });
  booth(K, M, N, -28.6, 3, { face: "+x", w: 3.2, mat: M.boothGreen, glow: 0x20ffd0 });
  booth(K, M, N, -15.4, 3, { face: "-x", w: 3.2, mat: M.boothGreen, glow: 0x20ffd0 });
  for (const [x, z] of [[-24.5, 0.5], [-19.5, 0.5], [-24.5, 5.5], [-19.5, 5.5]]) cocktail(K, M, N, x, z);
  // a champagne rail on the floor's rim, lit rosettes on the floor (image 3)
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    N.add(M.neonTile, place(new THREE.RingGeometry(0.5, 0.9, 16), { x: cx + Math.cos(a) * 3.4, y: FL + 0.01, z: cz + Math.sin(a) * 4.2, rx: -Math.PI / 2 }), { color: 0xa060ff, k: 0.5, chase: 0.6, phase: i / 7, beat: 0.4 });
  }
  sign(S, N, M, "vip", B.x0 + T / 2 + 0.05, 5.6, cz, 1.3, { ry: Math.PI / 2, group: 7, halo: 0x20ffd0 });
  sign(S, N, M, "problem", cx, 6.0, 13 - T / 2 - 0.04, 1.4, { ry: Math.PI, group: 6, halo: 0x20ffd0, haloK: 0.2 });
  addLight(S, lights, 0x30ffd8, 30, 24, cx, 5.4, cz, { amp: 0.2 });
}

function bar(K, M, N, S, lights) {
  // the counter: black glossy top, a gold kick rail, amber under-glow
  const z0 = -6, z1 = 10, cx = 26.0;
  K.solid(cx, (z0 + z1) / 2, 0.8, z1 - z0, 1.1, { y: FL, pen: 3, mat: M.barWood });
  K.box(M.blackGloss, cx - 0.05, FL + 1.1, (z0 + z1) / 2, 1.0, 0.06, z1 - z0 + 0.1);
  N.bar(M.neon, cx - 0.43, FL + 0.08, (z0 + z1) / 2, 0.02, 0.04, z1 - z0, {}, { color: 0xffa020, k: 2.2, chase: 0.7, beat: 0.35 });
  N.bar(M.neon, cx - 0.56, FL + 1.12, (z0 + z1) / 2, 0.02, 0.03, z1 - z0 + 0.1, {}, { color: 0xffd080, k: 1.6, beat: 0.1 });
  K.box(M.gold, cx - 0.65, FL + 0.25, (z0 + z1) / 2, 0.05, 0.05, z1 - z0);
  for (let z = z0 + 0.5; z < z1; z += 0.95) stool(K, M, cx - 1.05, z);
  // the back bar: a cabinet, three rows of bottles lit from behind
  K.solid(29.5, (z0 + z1) / 2, 0.6, z1 - z0, 1.0, { y: FL, pen: 3, mat: M.barWood });
  K.add(M.backlight, place(new THREE.PlaneGeometry(z1 - z0, 2.6), { x: B.x1 - T / 2 - 0.03, y: FL + 2.5, z: (z0 + z1) / 2, ry: -Math.PI / 2 }), { shadow: false });
  const segs = [];
  let seg = 0;
  for (let row = 0; row < 3; row++) {
    const yy = FL + 1.25 + row * 0.85;
    K.box(M.blackGloss, 29.55, yy - 0.03, (z0 + z1) / 2, 0.5, 0.03, z1 - z0);
    for (let z = z0; z < z1 - 0.01; z += 0.8) {
      const g = new THREE.PlaneGeometry(0.8, 0.62);
      const uv = g.attributes.uv;
      const u0 = ((seg * 0.37) % 1) * 0.6;
      for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + uv.getX(i) * 0.4);
      place(g, { x: 29.45, y: yy + 0.31, z: z + 0.4, ry: -Math.PI / 2 });
      const n = g.attributes.position.count;
      g.setAttribute("aSeg", new THREE.Float32BufferAttribute(new Float32Array(n).fill(seg), 1));
      segs.push(g);
      S.bottleSegs.push({ seg, x: 29.45, y: yy + 0.31, z: z + 0.4 });
      seg++;
    }
  }
  const bm = new THREE.Mesh(mergeAll(segs), bottleMat(S.gone));
  bm.castShadow = false;
  K.root.add(bm);
  // a ghost wall in front of the bottles so a shot stops on the shelf
  K.api.ghostBox(29.55, (z0 + z1) / 2, 0.08, z1 - z0, 2.8, { y: FL + 1.0, pen: 0.4 });
  S.shelf = { x0: 29.2, x1: 29.95, y0: FL + 1.1, y1: FL + 3.9, z0, z1 };
  // pendants over the counter
  for (let z = z0 + 1; z < z1; z += 2.5) {
    K.box(M.blackMetal, cx, 3.6, z, 0.01, TOP - 3.6, 0.01, {}, { shadow: false });
    K.add(M.warm, place(new THREE.SphereGeometry(0.16, 10, 8), { x: cx, y: 3.5, z }), { shadow: false });
    N.quad(M.neonHalo, cx - 0.2, 3.5, z, 0.9, 0.9, { ry: -Math.PI / 2, color: 0xffa040, k: 0.25, beat: 0.2 });
  }
  // high-top tables
  for (const [x, z] of [[18, -5], [18, 0.5], [18, 6], [21.5, -2.5], [21.5, 3.5], [21.5, 9.5], [17.2, 11]]) {
    K.api.ghostBox(x, z, 0.7, 0.7, 1.05, { y: FL, pen: 1 });
    K.cyl(M.gold, x, FL, z, 0.25, 0.25, 0.03, 12);
    K.cyl(M.chrome, x, FL, z, 0.04, 0.04, 1.02, 8);
    K.cyl(M.tableTop, x, FL + 1.02, z, 0.36, 0.36, 0.04, 16);
    for (let k = 0; k < 2; k++) stool(K, M, x + (k ? 0.7 : -0.7), z);
  }
  sign(S, N, M, "umad", B.x1 - T / 2 - 0.06, 5.7, 2, 1.6, { ry: -Math.PI / 2, group: 5, halo: 0xffa020 });
  sign(S, N, M, "bar", 22, 6.0, -9 + T / 2 + 0.04, 1.2, { group: 8, halo: 0xffa020 });
  addLight(S, lights, 0xffa848, 30, 24, 22, 4.6, 2, { amp: 0.12 });
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

function lobby(K, M, N, S, lights) {
  // the host stand and the velvet rope lane in from the door
  K.solid(5.5, 19.5, 1.2, 0.6, 1.15, { y: FL, pen: 2, mat: M.blackGloss });
  K.box(M.gold, 5.5, FL + 1.15, 19.5, 1.3, 0.04, 0.7);
  N.bar(M.neon, 5.5, FL + 0.05, 19.19, 1.1, 0.03, 0.01, {}, { color: 0xffd080, k: 2, beat: 0.2 });
  for (const x of [-2.6, 2.6]) {
    const pts = [];
    for (let z = 21; z >= 15.4; z -= 1.4) {
      K.cyl(M.gold, x, FL, z, 0.16, 0.16, 0.04, 10);
      K.cyl(M.gold, x, FL, z, 0.03, 0.03, 0.95, 6);
      K.add(M.gold, place(new THREE.SphereGeometry(0.06, 8, 6), { x, y: FL + 0.98, z }));
      pts.push([x, FL + 0.82, z]);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const [a, b] = [pts[i], pts[i + 1]];
      N.tube(M.neon, [a, [a[0], a[1] - 0.12, (a[2] + b[2]) / 2], b], { r: 0.03, color: 0x8a0a1a, k: 0.9, beat: 0 });
    }
  }
  // gold and black: the logo over the hall doors, mirror panels, sofas
  sign(S, N, M, "logo", 0, 3.62, 13 + T / 2 + 0.03, 0.82, { beat: 0.3 });
  for (const x of [-12.2, 12.2]) {
    K.api.ghostBox(x, 16, 1.0, 3.0, 0.8, { y: FL, pen: 2 });
    K.box(M.boothBlack, x, FL, 16, 1.0, 0.42, 3.0);
    K.box(M.boothBlack, x + (x < 0 ? -0.4 : 0.4), FL + 0.42, 16, 0.2, 0.5, 3.0);
    sofaSeats(x + (x < 0 ? 0.1 : -0.1), 16, 3.0, "z", FL, FACE_YAW[x < 0 ? "+x" : "-x"]);
  }
  for (const x of [-8, 0, 8]) {
    K.box(M.gold, x, CEIL - 0.08, 17.5, 0.04, 0.08, 6, {}, { shadow: false });
    N.bar(M.neon, x, CEIL - 0.1, 17.5, 0.03, 0.02, 6, {}, { color: 0xffd080, k: 1.8, chase: 0.6, beat: 0.2 });
  }
  plant(K, M, -12.6, 21.2);
  plant(K, M, 12.6, 21.2);
  sign(S, N, M, "rest", -14 + T / 2 + 0.03, 3.2, 17.5, 0.34, { ry: Math.PI / 2 });
  sign(S, N, M, "coat", 14 - T / 2 - 0.03, 3.2, 17.5, 0.34, { ry: -Math.PI / 2 });
  addLight(S, lights, 0xffc880, 12, 14, 0, 3.6, 17.5, { amp: 0.08 });
}

function restrooms(K, M, N, S) {
  // stalls along the west wall
  for (let z = 14.0; z <= 20.1; z += 1.5) {
    K.solid(-28.9, z, 1.9, 0.05, 2.0, { y: FL + 0.15, pen: 1, mat: M.blackGloss });
    K.api.ghostBox(-28.9, z, 1.9, 0.05, 0.15, { y: FL, pen: 1 });
  }
  for (let z = 14.75; z < 20.5; z += 1.5) {
    K.box(M.fridge, -29.4, FL, z, 0.5, 0.45, 0.4);
  }
  // the sinks and a long mirror lit pink
  K.solid(-18, 13 + T / 2 + 0.3, 4.6, 0.6, 0.9, { y: FL, pen: 2, mat: M.blackGloss });
  K.box(M.chrome, -18, CEIL - 2.3, 13 + T / 2 + 0.02, 4.4, 1.2, 0.02);
  N.tube(M.neon, [[-20.25, 1.55, 13.2], [-15.75, 1.55, 13.2], [-15.75, 2.8, 13.2], [-20.25, 2.8, 13.2]], { smooth: false, closed: true, r: 0.025, color: 0xff4fd8, k: 2, beat: 0.15 });
  for (let x = -24; x <= -16; x += 4) batten(K, M, x, CEIL, 17.5);
  sign(S, N, M, "exit", -24, 2.95, B.z1 - T / 2 - 0.03, 0.28, { ry: Math.PI });
}

function coatCheck(K, M, N, S) {
  K.solid(21.75, 16.2, 9.5, 0.6, 1.1, { y: FL, pen: 3, mat: M.blackGloss });
  K.box(M.gold, 21.75, FL + 1.1, 16.2, 9.6, 0.04, 0.7);
  N.bar(M.neon, 21.75, FL + 0.06, 15.89, 9.4, 0.03, 0.01, {}, { color: 0xffd84a, k: 2, beat: 0.2 });
  // the coats on rails behind
  const R = rng(9);
  const cols = [0x1a1a22, 0x6a1a2a, 0x2a3a5a, 0x8a7a5a, 0x101010, 0x4a2a5a, 0xc8b898];
  for (const z of [18.4, 20.2]) {
    K.api.ghostBox(21.75, z, 9, 0.6, 1.8, { y: FL, pen: 0.6 });
    K.box(M.chrome, 21.75, FL + 1.75, z, 9, 0.03, 0.03);
    for (let x = 17.4; x < 26.2; x += 0.16 + R() * 0.05) {
      const h = 0.9 + R() * 0.4;
      K.box(M.cloth, x, FL + 1.72 - h, z, 0.07, h, 0.5, {}, { color: cols[Math.floor(R() * cols.length)] });
    }
  }
  for (let x = 18; x <= 26; x += 4) batten(K, M, x, CEIL, 17.5);
  sign(S, N, M, "exit", 24, 2.95, B.z1 - T / 2 - 0.03, 0.28, { ry: Math.PI });
}

function backOfHouse(K, M, N, S, lights) {
  /* green room */
  K.api.ghostBox(-29.2, -19, 1.0, 3.2, 0.8, { y: FL, pen: 2 });
  K.box(M.boothBlack, -29.2, FL, -19, 1.0, 0.42, 3.2);
  K.box(M.boothBlack, -29.6, FL + 0.42, -19, 0.2, 0.5, 3.2);
  sofaSeats(-29.1, -19, 3.2, "z", FL, FACE_YAW["+x"]);
  K.solid(-27.6, -19, 0.8, 1.6, 0.42, { y: FL, pen: 2, mat: M.tableTop });
  // a vanity mirror ringed with bulbs
  K.solid(-25, -7 - T / 2 - 0.3, 3.2, 0.6, 0.85, { y: FL, pen: 2, mat: M.wood });
  K.box(M.chrome, -25, 1.45, -7 - T / 2 - 0.02, 2.6, 1.2, 0.02);
  for (let i = 0; i < 14; i++) {
    const t = i / 13;
    const p = t < 0.5 ? [-26.35 + t * 2 * 2.7, 2.7] : [-26.35 + (t - 0.5) * 2 * 2.7, 1.35];
    N.add(M.neon, place(new THREE.SphereGeometry(0.05, 6, 4), { x: p[0], y: p[1], z: -7.2 }), { color: 0xfff0d0, k: 2, beat: 0 });
  }
  K.solid(-16, -21.3, 0.7, 0.7, 1.7, { y: FL, pen: 4, mat: M.fridge });
  K.box(M.fridgeGlow, -16, FL + 0.2, -20.94, 0.5, 1.3, 0.01);
  for (let z = -19; z <= -9; z += 5) batten(K, M, -22, CEIL, z, 1.4, false);
  sign(S, N, M, "staff", -14 - T / 2 - 0.03, 2.9, -19.5, 0.3, { ry: -Math.PI / 2 });

  /* backstage: road cases, cable reels, a truss on the floor */
  for (const [x, n] of [[-9, 2], [-7.6, 1], [-4.5, 2], [5, 2], [6.4, 1], [9.2, 2]]) cases(K, M, x, -21.3, n);
  for (const x of [-3, 3]) {
    K.cyl(M.wood, x, FL, -18.2, 0.5, 0.5, 0.06, 14, { rx: 0 });
    K.cyl(M.cases, x, FL + 0.06, -18.2, 0.22, 0.22, 0.6, 12);
    K.cyl(M.wood, x, FL + 0.66, -18.2, 0.5, 0.5, 0.06, 14);
    K.api.ghostBox(x, -18.2, 1, 1, 0.72, { y: FL, pen: 2 });
  }
  for (let x = -10; x <= 10; x += 5) batten(K, M, x, CEIL, -19.5);
  addLight(S, lights, 0xd8e8ff, 12, 22, 0, 3.5, -19.5, { amp: 0.04 });

  /* kitchen: a steel island, shelving, kegs, the walk-in */
  K.solid(21, -15.5, 4, 1.4, 0.95, { y: FL, pen: 3, mat: M.steel });
  K.box(M.steelTop, 21, FL + 0.95, -15.5, 4.1, 0.04, 1.5);
  K.solid(17.2, -21.4, 3.6, 0.6, 2.2, { y: FL, pen: 2, mat: M.steel });
  K.solid(27.9, -20, 3.8, 3.8, 2.8, { y: FL, pen: 6, mat: M.fridge });
  K.box(M.steel, 27.9, FL + 0.1, -18.08, 1.2, 2.2, 0.04);
  for (const [x, z] of [[24.4, -12.4], [24.4, -13.2], [25.2, -12.4]]) {
    K.cyl(M.steel, x, FL, z, 0.28, 0.28, 0.6, 12);
    K.api.ghostBox(x, z, 0.56, 0.56, 0.6, { y: FL, pen: 3 });
  }
  for (let x = 17; x <= 25; x += 4) batten(K, M, x, CEIL, -12.5);
  for (let x = 17; x <= 25; x += 4) batten(K, M, x, CEIL, -18.5);
  sign(S, N, M, "staff", 14 + T / 2 + 0.03, 2.9, -12, 0.3, { ry: Math.PI / 2 });

  /* upstairs: the back corridor, the office, the sound booth */
  for (const [x, n] of [[-6, 2], [-2, 1], [2.5, 2], [7, 1]]) {
    K.api.ghostBox(x, -21.3, 1.2, 0.8, 0.75 * n, { y: UP, pen: 3 });
    for (let i = 0; i < n; i++) K.box(M.cases, x, UP + i * 0.75, -21.3, 1.18, 0.72, 0.78);
  }
  for (let x = -10; x <= 10; x += 5) batten(K, M, x, TOP, -19.5);
  // the office: a desk at the window over the VIP lounge, a safe, a sofa
  K.solid(-19.5, -8.4, 3.2, 1.0, 0.78, { y: UP, pen: 3, mat: M.wood });
  K.box(M.blackGloss, -19.5, UP + 0.78, -8.3, 0.9, 0.55, 0.06);
  K.box(M.fridgeGlow, -19.5, UP + 0.82, -8.26, 0.8, 0.45, 0.01);
  K.solid(-16.0, -21.2, 1.0, 0.9, 1.2, { y: UP, pen: 8, mat: M.blackMetal });
  K.api.ghostBox(-24, -21.2, 3, 1.0, 0.8, { y: UP, pen: 2 });
  K.box(M.leather, -24, UP, -21.2, 3, 0.42, 1.0);
  K.box(M.leather, -24, UP + 0.42, -21.6, 3, 0.5, 0.2);
  sofaSeats(-24, -21.1, 3, "x", UP, FACE_YAW["+z"]);
  for (let z = -19; z <= -10; z += 4.5) batten(K, M, -21, TOP, z, 1.4, false);
  // the sound booth: racks along the north wall, a desk at the window over the bar
  for (let x = 15.5; x < 25; x += 1.1) {
    K.solid(x, -21.4, 0.9, 0.7, 2.0, { y: UP, pen: 3, mat: M.cases });
    N.bar(M.neon, x, UP + 0.3, -21.04, 0.6, 1.4, 0.005, {}, { color: x % 2 > 1 ? 0x3aff7a : 0x3ff0ff, k: 0.6, chase: 0.9, chaseLen: 1, phase: x * 0.37, beat: 0.6 });
  }
  K.solid(18.5, -10.0, 4.5, 1.0, 0.8, { y: UP, pen: 3, mat: M.cases });
  N.bar(M.neon, 18.5, UP + 0.81, -10.0, 4.2, 0.01, 0.7, {}, { color: 0xff7ad8, k: 0.5, chase: 0.8, chaseLen: 0.5, beat: 0.7 });
  for (let x = 17; x <= 25; x += 4) batten(K, M, x, TOP, -15.5);
}

/* ============================================================ the terrace */

function terrace(K, M, N, S, lights) {
  // the parapet: a curb and glass, open where the fire escape lands
  const fx0 = 11.7, fx1 = 13.7;
  for (const [a, b] of [[-14 + T / 2, fx0], [fx1, 14 - T / 2]]) {
    K.solid((a + b) / 2, B.z1, b - a, T, 0.3, { y: UP, mat: M.brick });
    glassRail(K, M, { axis: "x", at: B.z1, a, b, y: UP + 0.3, h: 0.85 });
  }
  // the LED staircase up to the roof (image 4): black treads, glowing risers
  const st = LEDST;
  K.api.stairs(st.x, st.zFoot, st.w, st.steps, st.rise, st.run, "-z", { y: UP, ghost: true });
  for (let i = 0; i < st.steps; i++) {
    const z = st.zFoot - st.run * (i + 0.5), top = UP + st.rise * (i + 1);
    K.box(M.blackGloss, st.x, top - 0.07, z, st.w, 0.07, st.run);
    N.bar(M.neon, st.x, top - st.rise + 0.02, z + st.run / 2 + 0.008, st.w - 0.06, st.rise - 0.1, 0.012, {}, { color: 0x3a8cff, k: 2.2, chase: 0.8, phase: -i * 0.07, beat: 0.4 });
  }
  const len = st.steps * st.run, h = st.steps * st.rise, ang = Math.atan2(h, len);
  for (const s of [-1, 1]) {
    const x = st.x + s * (st.w / 2 + 0.04);
    // a steel side plate closing the stair in, a lit handrail on posts
    K.add(M.steel, place(prismGeo2(len, h), { x, y: UP, z: st.zFoot, ry: -Math.PI / 2 }), { shadow: false });
    K.box(M.chrome, x, UP + h / 2 + 0.95, st.zFoot - len / 2, 0.05, 0.05, Math.hypot(len, h), { rx: ang });
    N.bar(M.neon, x, UP + h / 2 + 0.9, st.zFoot - len / 2, 0.02, 0.02, Math.hypot(len, h), { rx: ang }, { color: 0xf0f4ff, k: 1.8, chase: 0.6, beat: 0.2 });
    for (let i = 1; i < st.steps; i += 3) {
      const z = st.zFoot - st.run * (i + 0.5);
      K.box(M.chrome, x, UP + st.rise * (i + 1), z, 0.04, 0.95, 0.04);
    }
    K.api.ghostBox(x, st.zFoot - len / 2 - 0.5, 0.08, len - 1.0, h + 1.05, { y: UP, pen: 0.3 });
  }
  // the neon bar (west), the lounge (east)
  K.solid(-11.2, 17.5, 0.8, 4.6, 1.1, { y: UP, pen: 3, mat: M.blackGloss });
  K.box(M.blackGloss, -11.25, UP + 1.1, 17.5, 1.0, 0.05, 4.7);
  N.bar(M.neon, -10.79, UP + 0.1, 17.5, 0.01, 0.9, 4.5, {}, { color: 0xff3fb4, k: 1.4, chase: 0.6, beat: 0.4 });
  K.solid(-13.55, 17.5, 0.5, 5, 1.0, { y: UP, pen: 3, mat: M.blackGloss });
  for (let z = 15.6; z < 19.6; z += 0.9) stool(K, M, -10.3, z, UP);
  sign(S, N, M, "lol", -14 + T / 2 + 0.05, UP + 2.4, 17.5, 1.3, { ry: Math.PI / 2, beat: 0.35, halo: 0xff3fb4 });
  for (const [x, z, ry] of [[6, 15.6, 0], [8, 15.6, 0], [6, 18.6, Math.PI], [8, 18.6, Math.PI], [10.8, 17.1, -Math.PI / 2]]) armchair(K, M, x, z, UP, ry);
  for (const [x, z] of [[7, 17.1]]) {
    K.api.ghostBox(x, z, 1.4, 0.8, 0.42, { y: UP, pen: 2 });
    K.box(M.tableTop, x, UP, z, 1.4, 0.42, 0.8);
  }
  plant(K, M, -4, 21.1, UP);
  plant(K, M, 4, 21.1, UP);
  plant(K, M, 4, 14.0, UP);
  // the facade sign over the street, on posts off the parapet
  const sh = 2.3, sw = sh * signAspect("logo");
  for (const x of [-sw * 0.35, sw * 0.35]) K.api.ghostBox(x, B.z1 + T / 2 + 0.1, 0.2, 0.2, 8.4 - UP, { y: UP, pen: 8 });
  K.solid(0, B.z1 + T / 2 + 0.25, sw + 0.4, 0.1, sh + 0.3, { y: 5.85, pen: 8, mat: M.blackMetal });
  for (const x of [-sw * 0.35, sw * 0.35]) K.box(M.blackMetal, x, UP, B.z1 + T / 2 + 0.1, 0.2, 8.4 - UP, 0.2);
  sign(S, N, M, "logo", 0, 5.85 + sh / 2 + 0.15, B.z1 + T / 2 + 0.31, sh, { group: 1, halo: 0xff3fb4, haloK: 0.35, beat: 0.35 });
  addLight(S, lights, 0x5a8cff, 18, 18, 0, 7.6, 18.5, { amp: 0.15 });
}

/* A right-triangle plate under a stair: run `len` along +x, rise `h`. */
function prismGeo2(len, h) {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array([0, 0, 0, len, 0, 0, len, h, 0, 0, 0, 0, len, h, 0, len, 0, 0]);
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return g;
}

/* ================================================================ the roof */

function roof(K, M, N, S, lights) {
  const y = ROOF;
  // the Sky Bar: a counter under a lit canopy frame
  K.solid(0, -18.6, 8, 0.8, 1.1, { y, pen: 3, mat: M.blackGloss });
  K.box(M.blackGloss, 0, y + 1.1, -18.6, 8.2, 0.05, 1.0);
  N.bar(M.neon, 0, y + 0.1, -18.19, 7.8, 0.9, 0.01, {}, { color: 0x5a8cff, k: 1.3, chase: 0.6, beat: 0.4 });
  K.solid(0, -21.2, 8, 0.5, 1.0, { y, pen: 3, mat: M.blackGloss });
  for (const x of [-4.2, 4.2]) for (const z of [-21.4, -17.4]) K.solid(x, z, 0.12, 0.12, 3.0, { y, pen: 3, mat: M.chrome });
  K.box(M.blackMetal, 0, y + 3.0, -19.4, 8.6, 0.12, 4.2, {}, { shadow: false });
  N.tube(M.neon, [[-4.3, y + 3.0, -21.5], [4.3, y + 3.0, -21.5], [4.3, y + 3.0, -17.3], [-4.3, y + 3.0, -17.3]], { smooth: false, closed: true, r: 0.035, color: 0x5a8cff, k: 2.2, chase: 0.8, beat: 0.3 });
  sign(S, N, M, "sky", 0, y + 3.65, -17.3, 1.0, { group: 10, halo: 0x5a8cff });
  for (let x = -3.5; x <= 3.5; x += 1) stool(K, M, x, -17.8, y);
  // lounge pods and chairs
  for (const [x, z, ry] of [[-10, -12, 0], [-8, -12, 0], [-10, -9.5, Math.PI], [-8, -9.5, Math.PI], [10, -12, 0], [8, -12, 0], [10, -9.5, Math.PI], [8, -9.5, Math.PI]]) armchair(K, M, x, z, y, ry);
  // cover: HVAC units, a water tank on legs, a billboard
  for (const [x, z, w, d] of [[-20, -15, 2.6, 1.6], [20, -15, 2.6, 1.6], [-22, 4, 1.6, 2.6], [22, 4, 1.6, 2.6], [-14, 2, 2.6, 1.6], [16, -4, 1.6, 2.6], [-24, 17, 2.6, 1.6], [24, 17, 2.6, 1.6]]) {
    K.solid(x, z, w, d, 1.45, { y, pen: 6, mat: M.hvac });
    K.cyl(M.blackMetal, x, y + 1.45, z, 0.5, 0.5, 0.08, 16);
  }
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.solid(24 + lx * 1.1, -18 + lz * 1.1, 0.16, 0.16, 1.8, { y, pen: 3, mat: M.blackMetal });
  K.api.ghostBox(24, -18, 3.2, 3.2, 2.6, { y: y + 1.8, pen: 8 });
  K.cyl(M.wood, 24, y + 1.8, -18, 1.6, 1.6, 2.6, 20);
  K.add(M.wood, place(new THREE.ConeGeometry(1.7, 0.7, 20), { x: 24, y: y + 4.75, z: -18 }));
  // the billboard by the terrace: a frame with the trollface lit pink
  for (const x of [-26, -20]) K.solid(x, 12.2, 0.2, 0.2, 5.4, { y, pen: 4, mat: M.blackMetal });
  K.solid(-23, 12.2, 7, 0.2, 3.2, { y: y + 2.4, pen: 8, mat: M.blackMetal });
  sign(S, N, M, "trollPink", -23, y + 4.0, 12.32, 3.0, { group: 2, halo: 0xff4fd8 });
  // the flag (a troll flag), and red aviation lamps
  K.cyl(M.chrome, 26, y, 20, 0.06, 0.04, 7, 8);
  K.api.ghostBox(26, 20, 0.14, 0.14, 7, { y, pen: 2 });
  const flag = place(new THREE.PlaneGeometry(2.2, 1.4, 6, 1), { x: 27.15, y: y + 6.2, z: 20 });
  const fp = flag.attributes.position;
  for (let i = 0; i < fp.count; i++) fp.setZ(i, fp.getZ(i) + Math.sin((fp.getX(i) - 26) * 2.2) * 0.12);
  flag.computeVertexNormals();
  K.add(M.flag, flag, { shadow: false });
  for (const [x, z] of [[B.x0, B.z0], [B.x1, B.z0], [B.x0, B.z1], [B.x1, B.z1]]) {
    K.add(M.redLamp, place(new THREE.SphereGeometry(0.1, 8, 6), { x, y: y + PARA + 0.12, z }), { shadow: false });
  }
  sign(S, N, M, "rooftop", 2.2, UP + 3.2, 13 + T / 2 + 0.04, 0.42, {});
  addLight(S, lights, 0x8a5aff, 70, 52, 0, 14, -4, { amp: 0.12 });
}

/* The door's dress code (user, 2026-10-08): a bandana under the red
   circle-and-slash, "NO BANDANAS". Lit from inside like the club's other
   signs. */
function noBandanasMat() {
  const c = document.createElement("canvas");
  c.width = 576; c.height = 720;
  const g = c.getContext("2d");
  const W = c.width, H = c.height;
  const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
  rr(0, 0, W, H, 34); g.fillStyle = "#120a16"; g.fill();
  g.shadowColor = "#ff3fb4"; g.shadowBlur = 26;
  rr(18, 18, W - 36, H - 36, 26); g.lineWidth = 9; g.strokeStyle = "#ff3fb4"; g.stroke();
  g.shadowBlur = 0;
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillStyle = "#ffd080"; g.font = "700 40px 'DM Sans', sans-serif";
  g.fillText("DRESS CODE", W / 2, 82);
  // the bandana: a square kerchief, paisley inside a border, folded on the
  // diagonal and tied, its knot's two tails out to the sides
  const cx = W / 2, cy = 320;
  g.lineJoin = "round"; g.lineCap = "round";
  const cloth = (path) => { g.beginPath(); path(); g.fillStyle = "#c8202a"; g.fill(); g.lineWidth = 8; g.strokeStyle = "#f4ece6"; g.stroke(); };
  for (const s of [-1, 1]) {
    // the tails, tied above the fold
    cloth(() => {
      g.moveTo(cx + s * 30, cy - 92);
      g.bezierCurveTo(cx + s * 70, cy - 122, cx + s * 120, cy - 118, cx + s * 168, cy - 96);
      g.lineTo(cx + s * 150, cy - 76);
      g.bezierCurveTo(cx + s * 110, cy - 96, cx + s * 70, cy - 98, cx + s * 40, cy - 74);
      g.closePath();
    });
  }
  cloth(() => {
    g.moveTo(cx - 150, cy - 78); g.quadraticCurveTo(cx, cy - 104, cx + 150, cy - 78);
    g.quadraticCurveTo(cx + 40, cy + 30, cx, cy + 125); g.quadraticCurveTo(cx - 40, cy + 30, cx - 150, cy - 78);
    g.closePath();
  });
  // the knot
  g.beginPath(); g.ellipse(cx, cy - 92, 26, 19, 0, 0, Math.PI * 2);
  g.fillStyle = "#a8141e"; g.fill(); g.lineWidth = 7; g.strokeStyle = "#f4ece6"; g.stroke();
  // the printed border, just inside the edge
  g.lineWidth = 4; g.strokeStyle = "#f4ece6"; g.setLineDash([2, 10]);
  g.beginPath();
  g.moveTo(cx - 120, cy - 66); g.quadraticCurveTo(cx, cy - 88, cx + 120, cy - 66);
  g.quadraticCurveTo(cx + 30, cy + 22, cx, cy + 98); g.quadraticCurveTo(cx - 30, cy + 22, cx - 120, cy - 66);
  g.stroke(); g.setLineDash([]);
  // paisley: teardrops with a curled tip, an eye in each
  const paisley = (x, y, r, a) => {
    g.save(); g.translate(cx + x, cy + y); g.rotate(a);
    g.beginPath();
    g.moveTo(0, r); g.bezierCurveTo(r * 1.1, r, r * 1.1, -r * 0.6, 0, -r * 0.7);
    g.bezierCurveTo(-r * 0.6, -r * 0.75, -r * 0.4, -r * 1.5, r * 0.25, -r * 1.7);
    g.bezierCurveTo(-r * 1.0, -r * 1.4, -r * 1.2, r * 0.9, 0, r);
    g.fillStyle = "#f4ece6"; g.fill();
    g.beginPath(); g.arc(0, r * 0.1, r * 0.32, 0, Math.PI * 2); g.fillStyle = "#c8202a"; g.fill();
    g.restore();
  };
  paisley(-62, -36, 17, 0.5); paisley(10, -40, 15, -0.4); paisley(70, -38, 16, 0.9);
  paisley(-20, 12, 16, 2.4); paisley(38, 20, 13, 1.2); paisley(2, 66, 12, 0.2);
  // the circle and the slash over it
  g.shadowColor = "#ff2a3a"; g.shadowBlur = 18;
  g.lineWidth = 30; g.strokeStyle = "#ff2a3a";
  g.beginPath(); g.arc(cx, cy, 200, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(cx - 141, cy - 141); g.lineTo(cx + 141, cy + 141); g.stroke();
  g.shadowBlur = 0;
  g.fillStyle = "#ffffff"; g.font = "800 66px 'DM Sans', sans-serif";
  g.fillText("NO BANDANAS", W / 2, 600);
  g.fillStyle = "#c9b8d4"; g.font = "500 30px 'DM Sans', sans-serif";
  g.fillText("Leave the colours at home", W / 2, 656);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.4 });
}

/* ============================================================ outside */

function outside(K, M, N, S, lights, R) {
  // the ground: street, yard, side alleys, out to the city (a hole where
  // the dance floor shows its pit)
  const ground = (mat, x0, x1, z0, z1, y = 0) => {
    for (const [a0, a1, b0, b1] of cutRects(x0, x1, z0, z1, [[DANCE.x0, DANCE.x1, DANCE.z0, DANCE.z1]])) {
      K.add(mat, place(new THREE.PlaneGeometry(a1 - a0, b1 - b0), { x: (a0 + a1) / 2, y, z: (b0 + b1) / 2, rx: -Math.PI / 2 }), { shadow: false });
    }
  };
  ground(M.asphalt, -260, 260, -260, 260);
  ground(M.sidewalk, B.x0 - 6, B.x1 + 6, B.z1 + T / 2, 25.0, 0.01);
  ground(M.yard, -36, 36, -34, B.z0 - T / 2, 0.01);
  for (const s of [-1, 1]) ground(M.sidewalk, s > 0 ? B.x1 + T / 2 : -36, s > 0 ? 36 : B.x0 - T / 2, B.z0, B.z1, 0.01);
  // lane markings down the street
  for (let x = -34; x < 34; x += 4) K.add(M.laneLine, place(new THREE.PlaneGeometry(2, 0.14), { x, y: 0.015, z: 27.6, rx: -Math.PI / 2 }), { shadow: false });

  /* ---- the alley out front (south): the entrance, the queue, spawn A */
  // the entrance canopy with marquee bulbs
  K.solid(0, B.z1 + T / 2 + 1.5, 8.4, 3.0, 0.3, { y: 3.4, pen: 6, mat: M.blackGloss });
  for (let i = 0; i < 26; i++) {
    const t = i / 25;
    const x = -4.1 + t * 8.2;
    N.add(M.neon, place(new THREE.SphereGeometry(0.06, 6, 4), { x, y: 3.36, z: B.z1 + T / 2 + 2.98 }), { color: 0xffd080, k: 2.4, chase: 1, phase: i / 4, beat: 0.4 });
  }
  N.bar(M.neon, 0, 3.55, B.z1 + T / 2 + 3.01, 8.4, 0.08, 0.01, {}, { color: 0xff3fb4, k: 2, chase: 0.8, beat: 0.3 });
  // rope lane along the wall, the bouncer's podium
  for (let x = -4.5; x >= -13; x -= 1.7) {
    K.cyl(M.chrome, x, 0, 24.4, 0.16, 0.16, 0.04, 10);
    K.cyl(M.chrome, x, 0, 24.4, 0.03, 0.03, 0.95, 6);
    if (x > -12) N.tube(M.neon, [[x, 0.82, 24.4], [x - 0.85, 0.7, 24.4], [x - 1.7, 0.82, 24.4]], { r: 0.03, color: 0x8a0a1a, k: 0.9, beat: 0 });
  }
  // the door rope's two posts (DOOR.rope; the rope itself is the door's,
  // modes/club-entry.js, so it can be unhooked)
  for (const x of [DOOR.rope.a.x, DOOR.rope.b.x]) {
    const z = DOOR.rope.a.z;
    K.cyl(M.gold, x, 0, z, 0.19, 0.2, 0.05, 14);
    K.cyl(M.gold, x, 0.05, z, 0.035, 0.035, 0.92, 8);
    K.add(M.gold, place(new THREE.SphereGeometry(0.075, 12, 8), { x, y: 1.0, z }));
    K.add(M.gold, place(new THREE.TorusGeometry(0.035, 0.009, 6, 12), { x, y: DOOR.rope.y, z: z + 0.04 }));
  }
  // the dress code by the door, where the line reads it: no bandanas
  K.add(noBandanasMat(), place(new THREE.PlaneGeometry(0.72, 0.9), { x: -3.15, y: 1.62, z: B.z1 + T / 2 + 0.02 }), { shadow: false });
  K.box(M.chrome, -3.15, 1.62 - 0.47, B.z1 + T / 2 + 0.01, 0.78, 0.04, 0.02);
  K.box(M.chrome, -3.15, 1.62 + 0.43, B.z1 + T / 2 + 0.01, 0.78, 0.04, 0.02);
  K.solid(4.6, 24.0, 0.8, 0.6, 1.15, { pen: 2, mat: M.blackGloss });
  // the fire escape up to the terrace: steel treads, a landing on posts
  {
    const st = FIRE_S;
    K.api.stairs(st.xFoot, st.z, st.w, st.steps, st.rise, st.run, "+x", { y: 0, ghost: true });
    for (let i = 0; i < st.steps; i++) {
      const x = st.xFoot + st.run * (i + 0.5), top = st.rise * (i + 1);
      K.box(M.blackMetal, x, top - 0.05, st.z, st.run, 0.05, st.w);
    }
    K.add(M.blackMetal, place(prismGeo2(st.steps * st.run, st.steps * st.rise), { x: st.xFoot, y: 0, z: st.z + st.w / 2 + 0.02 }), { shadow: false });
    const lx0 = st.xFoot + st.steps * st.run, lx1 = 14 - T / 2, lz0 = B.z1 + T / 2, lz1 = st.z + st.w / 2;
    K.solid((lx0 + lx1) / 2, (lz0 + lz1) / 2, lx1 - lx0, lz1 - lz0, 0.12, { y: UP - 0.12, pen: 3, mat: M.blackMetal });
    for (const [x, z] of [[lx0 + 0.1, lz1 - 0.1], [lx1 - 0.1, lz1 - 0.1]]) K.solid(x, z, 0.12, 0.12, UP - 0.12, { pen: 3, mat: M.blackMetal });
    K.solid(lx1 + 0.04, (lz0 + lz1) / 2, 0.08, lz1 - lz0, 1.05, { y: UP, pen: 0.4, mat: M.blackMetal });
    K.solid((lx0 + lx1) / 2, lz1 + 0.04, lx1 - lx0, 0.08, 1.05, { y: UP, pen: 0.4, mat: M.blackMetal });
  }
  // dumpsters, a van, a car
  for (const [x, z] of [[-20, 25.6], [16.5, 25.6]]) {
    K.solid(x, z, 1.9, 1.2, 1.3, { pen: 6, mat: M.dumpster });
    K.box(M.blackMetal, x, 1.3, z, 2.0, 0.06, 1.3);
  }
  vehicle(K, M, -26, 26.9, 5.4, 2.1, 2.3, M.van);
  vehicle(K, M, 25.5, 26.9, 4.4, 1.9, 1.5, M.van);
  // the scaffold walkway along the far side: spawn A shelters under it
  const SZ0 = 29.6, SZ1 = 33.6, SH = 3.2;
  K.solid(0, (SZ0 + SZ1) / 2, 64, SZ1 - SZ0, 0.15, { y: SH, pen: 6, mat: M.wood });
  for (let x = -32; x <= 32; x += 4) {
    for (const z of [SZ0, SZ1]) K.solid(x, z, 0.1, 0.1, SH, { pen: 2, mat: M.steel });
    K.box(M.steel, x, SH - 0.6, (SZ0 + SZ1) / 2, 0.06, 0.06, SZ1 - SZ0);
  }
  K.box(M.steel, 0, SH - 0.6, SZ0, 64, 0.06, 0.06);
  K.box(M.steel, 0, 1.1, SZ1, 64, 0.06, 0.06);
  // the shops across the street (out of bounds): dark fronts, neon signs
  facadeRow(K, M, N, S, 35.2, 1, R);

  /* ---- the loading yard (north): the dock shed, the tour bus, spawn B */
  const YZ0 = -33.6, YZ1 = -28.6, YH = 4.0;
  K.solid(0, (YZ0 + YZ1) / 2, 64, YZ1 - YZ0, 0.2, { y: YH, pen: 6, mat: M.steel });
  for (let x = -30; x <= 30; x += 6) for (const z of [YZ0, YZ1]) K.solid(x, z, 0.2, 0.2, YH, { pen: 3, mat: M.blackMetal });
  for (let x = -27; x <= 27; x += 6) batten(K, M, x, YH, (YZ0 + YZ1) / 2, 1.4);
  // the tour bus
  K.solid(9, -26.5, 12, 2.6, 3.4, { pen: 8 });
  K.box(M.busBody, 9, 0.5, -26.5, 12, 2.9, 2.6);
  for (const s of [-1, 1]) K.add(M.bus, place(new THREE.PlaneGeometry(12, 2.9), { x: 9, y: 1.95, z: -26.5 + s * 1.31, ry: s > 0 ? 0 : Math.PI }), { shadow: false });
  for (const x of [5, 13]) for (const s of [-1, 1]) K.cyl(M.tyre, x, 0.5, -26.5 + s * 1.2, 0.5, 0.5, 0.3, 14, { rx: Math.PI / 2 });
  for (const [x, z, n] of [[18.5, -24.2, 2], [20, -24.2, 1], [-18, -24, 2], [-16.6, -24, 1]]) {
    K.api.ghostBox(x, z, 1.2, 0.8, 0.75 * n, { pen: 3 });
    for (let i = 0; i < n; i++) K.box(M.cases, x, i * 0.75, z, 1.18, 0.72, 0.78);
  }
  K.solid(-26, -24.6, 1.9, 1.2, 1.3, { pen: 6, mat: M.dumpster });
  // the north fire escape up to the back corridor
  {
    const st = FIRE_N;
    K.api.stairs(st.xFoot, st.z, st.w, st.steps, st.rise, st.run, "-x", { y: 0, ghost: true });
    for (let i = 0; i < st.steps; i++) {
      const x = st.xFoot - st.run * (i + 0.5), top = st.rise * (i + 1);
      K.box(M.blackMetal, x, top - 0.05, st.z, st.run, 0.05, st.w);
    }
    K.add(M.blackMetal, place(prismGeo2(st.steps * st.run, st.steps * st.rise), { x: st.xFoot, y: 0, z: st.z - st.w / 2 - 0.02, ry: Math.PI }), { shadow: false });
    const lx1 = st.xFoot - st.steps * st.run, lx0 = -14 + T / 2, lz1 = B.z0 - T / 2, lz0 = st.z - st.w / 2;
    K.solid((lx0 + lx1) / 2, (lz0 + lz1) / 2, lx1 - lx0, lz1 - lz0, 0.12, { y: UP - 0.12, pen: 3, mat: M.blackMetal });
    for (const [x, z] of [[lx0 + 0.1, lz0 + 0.1], [lx1 - 0.1, lz0 + 0.1]]) K.solid(x, z, 0.12, 0.12, UP - 0.12, { pen: 3, mat: M.blackMetal });
    K.solid(lx0 - 0.04, (lz0 + lz1) / 2, 0.08, lz1 - lz0, 1.05, { y: UP, pen: 0.4, mat: M.blackMetal });
    K.solid((lx0 + lx1) / 2, lz0 - 0.04, lx1 - lx0, 0.08, 1.05, { y: UP, pen: 0.4, mat: M.blackMetal });
  }
  // the yard's back wall and the buildings behind it
  K.solid(0, -34.6, 74, 0.4, 4.2, { pen: 8, mat: M.brick });
  facadeRow(K, M, N, S, -36, -1, R, true);

  /* ---- the side alleys: chain-link fences on the bounds, AC units */
  for (const s of [-1, 1]) {
    K.solid(s * 36.2, 0, 0.1, 68, 3.0, { pen: 0.5 });
    for (let z = -34; z <= 34; z += 3) K.box(M.steel, s * 36.2, 0, z, 0.06, 3.0, 0.06);
    K.add(M.glassRail, place(new THREE.PlaneGeometry(68, 3.0), { x: s * 36.2, y: 1.5, z: 0, ry: Math.PI / 2 }), { shadow: false });
    for (const z of [-14, 8]) K.solid(s * 31.4, z, 1.6, 1.0, 1.2, { pen: 6, mat: M.hvac });
    sign(S, N, M, "exit", s * (B.x1 + T / 2 + 0.03), 2.95, s < 0 ? -4 : 11.8, 0.28, { ry: s > 0 ? Math.PI / 2 : -Math.PI / 2 });
  }
  addLight(S, lights, 0xff3a8a, 26, 26, 0, 4.4, 27.2, { amp: 0.15 });
  addLight(S, lights, 0xc8d8ff, 22, 30, 0, 3.6, -31, { amp: 0.04 });

  /* ---- the city: towers all round, lit windows, red lamps on top */
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2 + (R() - 0.5) * 0.09;
    const d = 150 + R() * 125;
    const w = 16 + R() * 18, dd = 16 + R() * 18, h = 30 + Math.pow(R(), 2) * (d > 240 ? 190 : 110);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    K.add(M.windows, place(new THREE.BoxGeometry(w, h, dd), { x, y: h / 2 - 0.5, z, ry: R() * 0.3 }), { shadow: false });
    if (R() < 0.45) N.add(M.neon, place(new THREE.SphereGeometry(0.6, 6, 4), { x, y: h + 0.4, z }), { color: 0xff2020, k: 2.0, beat: 0, chase: 1, phase: R() });
    if (R() < 0.25) N.bar(M.neon, x, h - 2.5, z, w * 0.9, 0.35, dd + 0.05, {}, { color: [0xff3fb4, 0x3ff0ff, 0x8a4aff][i % 3], k: 1.4, chase: 0.6, phase: R(), beat: 0.15 });
  }
}

/* A block of vehicle: a body box on wheels. */
function vehicle(K, M, x, z, len, w, h, mat) {
  K.solid(x, z, len, w, h, { pen: 6 });
  K.box(mat, x, 0.35, z, len, h - 0.35, w);
  K.box(M.glassWin, x + len * 0.3, h * 0.6, z, len * 0.25, h * 0.32, w + 0.02, {}, { shadow: false });
  for (const dx of [-len * 0.33, len * 0.33]) for (const s of [-1, 1]) K.cyl(M.tyre, x + dx, 0.35, z + s * (w / 2 - 0.1), 0.35, 0.35, 0.22, 12, { rx: Math.PI / 2 });
}

/* A row of dark shopfronts out of bounds at `z`, facing `o` (+1 faces -z),
   neon signs over the doors. */
function facadeRow(K, M, N, S, z, o, R, plain = false) {
  const names = ["pawn", "open", "nails", "mart"];
  let x = -40, i = 0;
  while (x < 40) {
    const w = 8 + R() * 6, h = 10 + R() * 14;
    K.solid(x + w / 2, z + o * 1.5, w - 0.2, 3, h, { pen: 8, mat: M.brick });
    K.add(M.windowsNear, place(new THREE.PlaneGeometry(w - 1, h - 5), { x: x + w / 2, y: 4.5 + (h - 5) / 2, z: z - o * 0.02, ry: o > 0 ? Math.PI : 0 }), { shadow: false });
    if (!plain) {
      K.add(M.shopGlow, place(new THREE.PlaneGeometry(w - 2.4, 2.4), { x: x + w / 2, y: 1.4, z: z - o * 0.02, ry: o > 0 ? Math.PI : 0 }), { shadow: false });
      if (i < names.length) sign(S, N, M, names[i], x + w / 2, 3.4, z - o * 0.06, 0.75, { ry: o > 0 ? Math.PI : 0, group: 14 + (i % 2) });
    }
    x += w;
    i++;
  }
}

/* ============================================================ the build */

function buildTrollingLoud(api) {
  ZSPAWNS.length = 0;
  SEATS.length = 0;
  const S = newState();
  const root = new THREE.Group();
  api.prop(root);
  root.castShadow = false;
  const K = new Kit(api, root);
  const N = new Neon(root);
  const HN = new Neon(root);        // the hall's ceiling neon: mirrored in the dance floor
  const M = materials();
  const R = rng(4242);
  const lights = [];

  shell(K, M, N, S);
  hall(K, M, N, HN, S, lights);
  vip(K, M, N, S, lights);
  bar(K, M, N, S, lights);
  lobby(K, M, N, S, lights);
  restrooms(K, M, N, S);
  coatCheck(K, M, N, S);
  backOfHouse(K, M, N, S, lights);
  terrace(K, M, N, S, lights);
  roof(K, M, N, S, lights);
  outside(K, M, N, S, lights, R);

  K.flush();
  N.flush();
  HN.flush();
  for (const l of lights) root.add(l);

  /* ---- the reflection: the ceiling neon, the crystal wall, the ball,
     mirrored under the glass floor */
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

  /* ---- the lasers, fanning from over the DJ booth */
  {
    const geos = [];
    const cols = [0x3aff7a, 0x3ff0ff, 0x3aff7a, 0xff3fb4, 0x3aff7a, 0x3ff0ff, 0x3aff7a, 0xff3fb4, 0x3aff7a];
    for (let i = 0; i < 9; i++) {
      const yaw = -0.9 + (i / 8) * 1.8, pitch = 0.08 + (i % 3) * 0.1, len = 26;
      for (const rx of [0, Math.PI / 2]) {
        const g = new THREE.PlaneGeometry(len, 0.07);
        g.translate(len / 2, 0, 0);
        g.rotateX(rx);
        g.rotateZ(pitch);
        g.rotateY(-Math.PI / 2 - yaw);
        const n = g.attributes.position.count, c = new THREE.Color(cols[i]).multiplyScalar(1.4);
        const arr = new Float32Array(n * 3);
        for (let k = 0; k < n; k++) { arr[k * 3] = c.r; arr[k * 3 + 1] = c.g; arr[k * 3 + 2] = c.b; }
        g.setAttribute("color", new THREE.Float32BufferAttribute(arr, 3));
        geos.push(g.toNonIndexed());
      }
    }
    const lasers = new THREE.Mesh(mergeLasers(geos), M.beam);
    lasers.position.set(0, STAGE.top + 1.75, -14.6);
    lasers.renderOrder = 3;
    lasers.frustumCulled = false;
    skipOverride(lasers);
    root.add(lasers);
    S.lasers = lasers;
  }

  /* ---- the club clock: one invisible mesh whose draw hook runs it */
  const tg = new THREE.BufferGeometry();
  tg.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(9), 3));
  const ticker = new THREE.Mesh(tg, M.black);
  ticker.frustumCulled = false;
  ticker.onBeforeRender = (r, sc, cam) => tick(S, cam);
  root.add(ticker);

  /* ---- zombie entry points: the street ends, the yard, the side alleys,
     the upstairs rooms, over the roof's parapets */
  for (const [x, z] of [[-35, 27], [35, 27], [-35, 31.5], [35, 31.5], [-20, 33], [0, 33], [20, 33], [-35, -27], [35, -27], [-35, -31], [35, -31], [-20, -33.6], [0, -33.6], [20, -33.6], [-33.5, -10], [33.5, 10], [-33.5, 12], [33.5, -12]]) {
    ZSPAWNS.push({ x, y: 0, z });
  }
  for (const [x, z] of [[-21, -12], [-26, -16], [26, -13.5], [22, -16], [0, -19.6], [-12, 20.6], [-4, 15]]) ZSPAWNS.push({ x, y: UP, z });
  for (const [x, z] of [[-28.6, -20.6], [28.6, -20.6], [-28.6, 20.6], [28.6, 20.6], [-28.6, 0], [28.6, 0]]) ZSPAWNS.push({ x, y: ROOF, z, rise: true });
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

/* ============================================================ the clock */

const _c = new THREE.Color();
function tick(S, cam) {
  ACTIVE = S;
  if (cam.isPerspectiveCamera) {
    U.uPlayer.value.copy(cam.position);
    S.cam.copy(cam.position);
  }
  const now = performance.now() / 1000;
  if (now - S.last < 0.004) return;
  const dt = Math.min(0.1, S.last ? now - S.last : 0.016);
  S.last = now;

  // the beat: the song's own grid when there is one (DJ Lulz, or your radio),
  // else the radio's kick off the analyser, else the club's 128 BPM clock
  let bp = now * BPS;
  let kick = Math.exp(-(bp % 1) * 5.0);
  let level = 1;
  const sg = S.song;
  if (sg) {
    const g = sg.grid, t = sg.t + (now - sg.at);
    const f = (t - g.offset) * (g.bpm / 60), i = Math.floor(f);
    bp = f - g.down;   // whole bars land on the song's one
    if (f >= 0 && i < g.kick.length) {
      kick = Math.exp(-(f - i) * 5.0) * (0.25 + 0.75 * (+g.kick[i] || 0) / 9);
      level = 0.15 + 0.85 * (+g.level[i] || 0) / 9;
    } else { kick = 0; level = 0.15; }
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
    S.lasers.rotation.y = Math.sin(now * 0.45) * 0.35;
    S.lasers.rotation.x = Math.sin(now * 0.21) * 0.08;
    S.lasers.material.opacity = 0.55 + 0.45 * kick;
  }
  // the DJ bobs
  if (S.dj) { S.dj.position.y = S.djY + kick * 0.05; S.dj.rotation.z = Math.sin(bp * Math.PI) * 0.035; }

  // the real lights: a gentle kick, the hall's three drifting round the wheel
  for (const L of S.lights) {
    L.l.intensity = L.base * (0.6 + 0.4 * S.level) * (1 + L.amp * (kick - 0.35));
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

/* ============================================================ answering shots */

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
  if (Math.abs(p.x) < 2.7 && p.z > -14.8 && p.z < -13.7 && p.y > STAGE.top + 0.9 && p.y < STAGE.top + 1.4) {
    if (S.dropUntil < now) {
      S.dropUntil = now + 4 / BPS;
      sfx("scratch", p);
    }
  }
}

/* ============================================================ the sound

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
  if (SND.pan.positionX) { SND.pan.positionX.value = 0; SND.pan.positionY.value = 2.2; SND.pan.positionZ.value = -14.5; }
  else SND.pan.setPosition(0, 2.2, -14.5);
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

// A minor, four bars: A, A, F, G (bass roots, Hz); the stab chords
const ROOTS = [55, 55, 43.65, 49];
const STABS = [[220, 261.6, 329.6], [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7]];

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

/* Where you are decides how muffled the booth is: the hall open, the
   rooms off it through a doorway, the back of house and outside through
   walls (thump only). */
function muffle(p) {
  const inHall = p.x > HALL.x0 && p.x < HALL.x1 && p.z > HALL.z0 && p.z < HALL.z1 && p.y < ROOF;
  if (inHall) return [16000, 1];
  const inClub = p.x > B.x0 && p.x < B.x1 && p.z > B.z0 && p.z < B.z1 && p.y < ROOF;
  if (inClub) {
    const nextDoor = p.y < UP && (p.z > -9 && p.z < 22);
    return nextDoor ? [2200, 0.85] : [800, 0.8];
  }
  return [360, 1.25];
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
    const [freq, k] = muffle(S.cam);
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
  if (kind === "scratch") {
    tone(ctx, t, out, { type: "sawtooth", f0: 300, f1: 900, dur: 0.12, peak: 0.18, slide: 0.1 });
    tone(ctx, t + 0.12, out, { type: "sawtooth", f0: 900, f1: 200, dur: 0.18, peak: 0.18, slide: 0.16 });
  }
}

/* ============================================================ the crowd

   Socialize only (town-npcs.js): who's in the club and what they're doing.
   `yaw` is the camera's (0 faces -z, +PI/2 faces -x); a seated NPC's `y` is
   the seat top. The dancers move on the club's beat (rp.beat). */

const FACE_YAW = { "+z": Math.PI, "-z": 0, "+x": -Math.PI / 2, "-x": Math.PI / 2 };

/* Which room a point is in, and which rooms can see into which (through a
   wide doorway, the open atrium, the stair to the roof), so the crowd in a
   room the camera can't see into isn't drawn. The staff rooms are one room;
   the roof's strollers ("sky") walk over the skylight, seen from the hall. */
function clubZone(x, y, z) {
  if (y > ROOF - 0.5) return "roof";
  if (x < B.x0 || x > B.x1 || z < B.z0 || z > B.z1) return "street";
  if (z > 13) return y > UP - 0.5 ? "terrace" : x < -14 ? "rest" : x > 14 ? "coat" : "lobby";
  if (Math.abs(x) < 14) return z < HALL.z0 ? "back" : "hall";
  if (x < -14) return z < -7 ? "back" : "vip";
  return z < -9 ? "back" : "bar";
}
const CLUB_SEES = {
  street: ["lobby"], lobby: ["street", "hall", "coat", "rest"], coat: ["lobby"], rest: ["lobby"],
  hall: ["lobby", "vip", "bar", "back", "sky"], vip: ["hall", "back"], bar: ["hall", "back"], back: ["hall", "vip", "bar"],
  terrace: ["roof", "sky", "street"], roof: ["terrace", "sky"],
};
const CLUB_VIEW = { zoneOf: clubZone, sees: (a, b) => a === b || CLUB_SEES[a]?.includes(b) };

/* The door (Socialize, modes/club-entry.js; CLUB-ENTRY.md): which pass a
   spot needs. "street" is outside; "main" is the floor a guest wristband
   opens (lobby, hall, bar, restrooms, coat check, terrace, the roof's Sky
   Bar); "vip" and "back" (the VIP lounge, the staff rooms) stay guarded. */
function entryZoneOf(x, y, z) {
  const k = clubZone(x, y, z);
  return k === "street" || k === "vip" || k === "back" ? k : "main";
}
/* Where the door's people stand. The line runs west along the rope from the
   front door; the two lanes check people in front of Big Lulz and Tank
   (facing him); in through the front door to the lobby; the curb
   across the alley is where the bounced land; newcomers walk up the alley
   from the west. */
const DOOR = {
  line: Array.from({ length: 9 }, (_, i) => ({ x: -4.3 - i * 0.95, z: 23.35 })),
  lanes: [
    { bouncer: "Big Lulz", x: -3.3, z: 24.15 },
    { bouncer: "Tank", x: 3.3, z: 24.15 },
  ],
  mouth: { x: 0, z: 23.4 },
  // The velvet rope across the front door: Big Lulz unhooks the west end
  // (a) for each person let in; it hangs from the east post (b) meanwhile.
  rope: { a: { x: -1.95, z: 22.8 }, b: { x: 1.95, z: 22.8 }, y: 0.84 },
  lobby: { x: 0, z: 18, y: FL, yaw: 0 },
  curb: { x: 0, z: 29.2, yaw: 0 },
  arrive: { x: -30, z: 27.4 },
};

/* The seat of a booth() (same layout), `n` sitters along it. */
function boothSeats(cx, cz, face, y, w = 2.8, n = 2) {
  const L = (lx, lz) => face === "+z" ? [cx + lx, cz + lz] : face === "-z" ? [cx - lx, cz - lz] : face === "+x" ? [cx + lz, cz - lx] : [cx - lz, cz + lx];
  const out = [];
  for (let i = 0; i < n; i++) {
    const [x, z] = L(n === 1 ? -0.3 : (i ? 1 : -1) * (w - 0.88) / 4, -1.9 / 2 + 0.8);
    out.push({ x, z, y: y + 0.42, yaw: FACE_YAW[face], sit: true });
  }
  return out;
}

/* Standing at a table, `r` out from it at angle `a`, facing it. */
function atTable(tx, tz, y, a, r = 0.62) {
  const x = tx + Math.cos(a) * r, z = tz + Math.sin(a) * r;
  return { x, z, y, yaw: Math.atan2(x - tx, z - tz) };
}

function clubNpcs() {
  const W = 14 - T / 2 - 0.95;          // the hall's side booths, |x|
  const SB = 13 - T / 2 - 0.95;         // its south booths, z
  const STOOL = 0.78;                   // a bar stool's seat, over the floor
  const cast = [];
  const add = (name, role, act, spot, extra = {}) => cast.push({ name, role, act, ...spot, ...extra });
  const guard = { height: 1.98, build: 1.4 };
  let n = 0;
  const extra = (role, act, spot, more) => add(`${role} ${++n}`, role, act, spot, more);

  /* ---- the door: two bouncers, the list, and the line along the rope */
  add("Big Lulz", "Bouncer", "guard", { x: -2.4, z: 23.3, y: 0, yaw: Math.PI }, guard);
  add("Tank", "Bouncer", "guard", { x: 2.4, z: 23.3, y: 0, yaw: Math.PI }, guard);
  add("Clipboard Carl", "Door host", "count", { x: 4.6, z: 23.2, y: 0, yaw: Math.PI });
  const line = ["phone", "guard", "phone", "dance", "phone", "phone", "guard", "phone"];
  line.forEach((act, i) => extra("Clubgoer", act, { x: -4.3 - i * 0.95, z: 23.35 + (i % 3) * 0.12, y: 0, yaw: -Math.PI / 2 + (i % 2 ? 0.25 : -0.2) }, act === "dance" ? { dance: 0 } : {}));

  /* ---- the lobby and the coat check */
  add("Velvet", "Host", "count", { x: 5.5, z: 18.85, y: FL, yaw: Math.PI });
  add("Brick", "Bouncer", "guard", { x: 0, z: 13.85, y: FL, yaw: Math.PI }, guard);
  extra("Clubgoer", "phone", { x: -12.05, z: 15.4, y: FL + 0.42, yaw: -Math.PI / 2, sit: true });
  extra("Clubgoer", "drink", { x: 12.05, z: 16.4, y: FL + 0.42, yaw: Math.PI / 2, sit: true });
  add("Hangers", "Coat check", "count", { x: 21.75, z: 17.0, y: FL, yaw: 0 });
  extra("Clubgoer", "phone", { x: 20.6, z: 15.3, y: FL, yaw: Math.PI });

  /* ---- the dance floor: a go-go dancer on the podium, the crowd round it
     facing the DJ, the hype man on the stage */
  add("Glitter", "Go-go dancer", "dance", { x: DC.x, z: DC.z, y: 0.28, yaw: 0 }, { dance: 3 });
  add("Hype Hank", "Hype man", "dance", { x: 3.4, z: -14.3, y: STAGE.top, yaw: Math.PI }, { dance: 2 });
  const R = rng(41);
  const spots = [];
  for (let tries = 0; spots.length < 16 && tries < 400; tries++) {
    const x = DANCE.x0 + 0.7 + R() * (DANCE.x1 - DANCE.x0 - 1.4), z = DANCE.z0 + 0.7 + R() * (DANCE.z1 - DANCE.z0 - 1.4);
    if (Math.hypot(x - DC.x, z - DC.z) < 1.7) continue;           // the podium
    if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 1.25)) continue;
    spots.push({ x, z });
  }
  for (const s of spots) {
    // most face the DJ, some turn to a friend or the podium
    const to = R() < 0.7 ? { x: 0, z: -14.5 } : { x: DC.x + (R() - 0.5) * 4, z: DC.z + (R() - 0.5) * 4 };
    extra("Raver", "dance", { x: s.x, z: s.z, y: 0, yaw: Math.atan2(s.x - to.x, s.z - to.z) }, { dance: Math.floor(R() * 4) });
  }

  /* ---- the hall's booths, cocktail tables, and the doors staff watch */
  for (const s of [-1, 1]) {
    const face = s < 0 ? "+x" : "-x";
    boothSeats(s * W, -7, face, FL).forEach((p) => extra("Clubgoer", "drink", p));
    boothSeats(s * W, 3, face, FL, 2.8, 1).forEach((p) => extra("Clubgoer", "phone", p));
    boothSeats(s * 10, SB, "-z", FL).forEach((p, i) => extra("Clubgoer", i ? "phone" : "drink", p));
    extra("Clubgoer", "drink", atTable(s * 8.4, -12, FL, s < 0 ? 0.3 : Math.PI - 0.3));
    extra("Clubgoer", "drink", atTable(s * 8.2, -15.6, FL, Math.PI / 2 + s * 0.4), { drink: "whiskey" });
    add(s < 0 ? "Knuckles" : "Moose", "Security", "guard", { x: s * 10.2, z: -16.1, y: FL, yaw: Math.PI }, guard);
  }
  add("Rope", "VIP door", "guard", { x: -12.6, z: -4.1, y: FL, yaw: -Math.PI / 2 }, guard);

  /* ---- the VIP lounge: croc booths full, bottle service doing the round */
  boothSeats(-22, -5.3, "+z", FL, 3.2).forEach((p) => extra("VIP", "drink", p, { drink: "whiskey" }));
  boothSeats(-22, 11.3, "-z", FL, 3.2).forEach((p, i) => extra("VIP", i ? "drink" : "phone", p));
  boothSeats(-28.6, 3, "+x", FL, 3.2).forEach((p) => extra("VIP", "drink", p));
  boothSeats(-15.4, 3, "-x", FL, 3.2, 1).forEach((p) => extra("VIP", "drink", p, { drink: "whiskey" }));
  extra("VIP", "drink", atTable(-24.5, 5.5, FL, -0.6));
  extra("VIP", "drink", atTable(-19.5, 0.5, FL, 2.4), { drink: "whiskey" });
  extra("VIP", "dance", { x: -22.6, z: 2.5, y: FL, yaw: -2.4 }, { dance: 1 });
  extra("VIP", "dance", { x: -21.4, z: 3.5, y: FL, yaw: 0.7 }, { dance: 0 });
  add("Bubbles", "Bottle service", "walk", { y: FL, path: [[-26, -1.6], [-18, -1.6], [-18, 8], [-26, 8]], at: 0.15 });

  /* ---- the main bar: two behind it, the stools, the high-tops */
  add("Shots McGee", "Bartender", "wipe", { x: 27.6, z: -1, y: FL, yaw: Math.PI / 2 });
  add("Pourtia", "Bartender", "count", { x: 27.6, z: 6.2, y: FL, yaw: Math.PI / 2 });
  for (const k of [1, 2, 4, 7, 8, 11, 14]) {
    extra("Barfly", "drink", { x: 26 - 1.05, z: -5.5 + k * 0.95, y: FL + STOOL, yaw: -Math.PI / 2, sit: true, stool: true }, k % 3 ? {} : { drink: "whiskey" });
  }
  for (const [x, z, side] of [[18, -5, -1], [18, 0.5, 1], [21.5, 3.5, -1], [21.5, 3.5, 1], [21.5, -2.5, 1]]) {
    extra("Clubgoer", "drink", { x: x + side * 0.7, z, y: FL + STOOL, yaw: side * Math.PI / 2, sit: true, stool: true });
  }
  extra("Clubgoer", "drink", atTable(21.5, 9.5, FL, Math.PI / 2 + 0.3));
  extra("Clubgoer", "phone", atTable(18, 6, FL, -Math.PI / 2));

  /* ---- the mezzanine: booths, people on the rail watching the floor,
     strollers round the U */
  for (const s of [-1, 1]) {
    const face = s < 0 ? "+x" : "-x";
    boothSeats(s * W, s < 0 ? -7 : 3, face, UP).forEach((p) => extra("Clubgoer", "drink", p));
    boothSeats(s * W, s < 0 ? 3 : -7, face, UP, 2.8, 1).forEach((p) => extra("Clubgoer", "phone", p));
    for (const z of s < 0 ? [-8.5, 0.5] : [-4.5, 5.5]) extra("Clubgoer", "drink", { x: s * (ARM + 0.4), z, y: UP, yaw: s * Math.PI / 2 });
  }
  for (const x of [-3, 3.5]) extra("Clubgoer", "drink", { x, z: S_ARM + 0.45, y: UP, yaw: 0 });
  extra("Clubgoer", "drink", atTable(4.5, 11, UP, Math.PI / 2));
  const U_LANE = [[-10.8, -12.5], [-10.8, 9.9], [10.8, 9.9], [10.8, -12.5]];
  extra("Clubgoer", "walk", { y: UP, path: U_LANE, pace: true, at: 0.2 });
  extra("Clubgoer", "walk", { y: UP, path: U_LANE, pace: true, at: 0.7 });

  /* ---- back of house */
  add("MC Kek", "Headliner", "tend", { x: -25, z: -8.3, y: FL, yaw: Math.PI });
  extra("Clubgoer", "phone", { x: -29.05, z: -18.5, y: FL + 0.42, yaw: -Math.PI / 2, sit: true });
  add("Chef Lolz", "Cook", "count", { x: 21, z: -14.3, y: FL, yaw: 0 });
  add("Big Boss", "Manager", "count", { x: -19.5, z: -9.4, y: UP, yaw: Math.PI });
  add("Fader", "Sound tech", "count", { x: 18.5, z: -10.95, y: UP, yaw: Math.PI });

  /* ---- the terrace: the neon bar, the lounge, the parapet */
  add("Neon Nina", "Bartender", "wipe", { x: -12.45, z: 17.5, y: UP, yaw: -Math.PI / 2 });
  for (const z of [15.6, 17.4, 19.2]) extra("Barfly", "drink", { x: -10.3, z, y: UP + STOOL, yaw: Math.PI / 2, sit: true, stool: true });
  for (const [x, z, yaw] of [[6, 15.65, Math.PI], [8, 18.55, 0], [10.75, 17.1, Math.PI / 2]]) extra("Clubgoer", "drink", { x, z, y: UP + 0.42, yaw, sit: true });
  extra("Clubgoer", "drink", { x: -6.5, z: 21.3, y: UP, yaw: Math.PI });
  extra("Clubgoer", "phone", { x: 9.2, z: 21.3, y: UP, yaw: Math.PI + 0.3 });

  /* ---- the roof: the Sky Bar, the lounge pods, a lap round the skylight */
  add("Skye", "Bartender", "wipe", { x: 0, z: -19.9, y: ROOF, yaw: Math.PI });
  for (const x of [-2.5, -0.5, 2.5]) extra("Barfly", "drink", { x, z: -17.8, y: ROOF + STOOL, yaw: 0, sit: true, stool: true });
  for (const [x, z, yaw] of [[-10, -11.95, Math.PI], [-8, -9.55, 0], [10, -11.95, Math.PI], [8, -9.55, 0]]) extra("Clubgoer", "drink", { x, z, y: ROOF + 0.42, yaw, sit: true });
  const LAP = [[-11, -6], [11, -6], [11, 7], [-11, 7]];
  extra("Clubgoer", "walk", { y: ROOF, path: LAP, at: 0, zone: "sky" });
  extra("Clubgoer", "walk", { y: ROOF, path: LAP, at: 0.5, zone: "sky" });

  /* ---- dressed for the night (user, 2026-10-08): the guests wear outfits
     (outfits.js), the staff stay as they are */
  const DR = rng(77);
  for (const c of cast) if (GUESTS.has(c.role)) c.outfit = pickOutfit(c.role === "Barfly" ? "Clubgoer" : c.role, DR());
  return cast;
}
const GUESTS = new Set(["Clubgoer", "Raver", "VIP", "Barfly"]);

/* ================================================================ the map */

export const TROLLINGLOUD = {
  name: "Trolling Loud",
  blurb: "Bottle service, a mirror-black dance floor and a DJ who only plays bangers. Dress code: grin.",
  bounds: { ...BOUNDS },
  playerSpawn: { x: 0, z: 30 },
  // Midnight downtown: a violet sky glowing magenta at the horizon off the
  // city, no sun disc, a dim moon. Inside, the neon does the work.
  sky: { top: 0x05040c, horizon: 0x3a1440, bottom: 0x0c0612, haze: 0.35, clouds: 0.18, cloudColor: 0x3a2a4a, cloudShade: 0x0c0a14 },
  fog: { color: 0x170c22, density: 0.011 },
  exposure: 1.3,
  bloom: { threshold: 0.78, strength: 0.85, radius: 0.6 },
  noGroundPlane: true,
  ground: { colorA: 0x2a2a30, colorB: 0x222228, grid: 0x3a3a44, surface: "asphalt", tile: 4 },
  sun: { color: 0x9aa8ff, intensity: 0.7, pos: [-30, 60, 40] },
  hemi: { sky: 0x6a5aa8, ground: 0x2a1a2a, intensity: 0.85 },
  ambient: { color: 0x5a4a7a, intensity: 0.35 },
  viewFar: 420,
  build: buildTrollingLoud,
  onShot,
  attachAudio: (a) => { AUDIO = a; },
  attachMusic: (m) => { MUSIC = m; },
  onFrame,
  // Socialize: DJ Lulz takes requests here (dj-lulz.js). `spot` is where you
  // stand to ask, in front of the booth; `input` is where his record plugs
  // in (the booth's muffled, placed chain), null before the audio exists.
  dj: {
    name: "DJ Lulz",
    spot: { x: 0, z: -12.9, y: FL, reach: 3.4 },
    club: { ...B, top: ROOF },
    input: () => (ensureSound() ? SND.song : null),
  },
  // Socialize: the crowd (town-npcs.js), dancing on the club's clock; no
  // shadows (indoors under neon that casts none), drawn room by room
  rp: { npcs: () => clubNpcs(), seats: () => SEATS, beat: () => U.uBeatPos.value, npcShadows: false, view: CLUB_VIEW, door: { ...DOOR, zoneOf: entryZoneOf } },
  // for tools/troll-ops-trollingloud-test.mjs
  debug: () => ({
    active: !!ACTIVE, lights: ACTIVE?.lights.length ?? 0, ballBoost: ACTIVE?.ballBoost ?? 0,
    kill: Array.from(U.uKill.value), beat: U.uBeatPos.value, gone: Array.from(ACTIVE?.gone.value ?? []).filter(Boolean).length,
    lp: SND.lp ? SND.lp.frequency.value : null, busGain: SND.bus ? SND.bus.gain.value : null, want: SND.gain,
    signs: (ACTIVE?.signs ?? []).map((s) => ({ g: s.group, x: s.x, y: s.y, z: s.z, ry: s.ry })),
    shelf: ACTIVE?.shelf ?? null, radioOn: !!ACTIVE?.radioOn,
    song: ACTIVE?.song ? { bpm: ACTIVE.song.grid.bpm, t: ACTIVE.song.t } : null,
    kick: U.uKick.value, level: U.uLevel.value, songGain: SND.song ? SND.song.gain.value : null,
    muffleAt: (x, y, z) => muffle({ x, y, z })[0],
  }),
  // Team spawns: the south alley under the scaffold, the north yard under
  // the dock shed.
  spawns: [[-26, 31.4], [-18, 31.4], [-10, 31.4], [-3.5, 31.4], [3.5, 31.4], [10, 31.4], [18, 31.4], [26, 31.4],
    [-27, -31.2], [-19, -31.2], [-11, -31.2], [-3.5, -31.2], [3.5, -31.2], [11, -31.2], [19, -31.2], [27, -31.2]],

  zombieLayout: () => ({
    windows: ZSPAWNS.map((w) => ({ ...w })),
    floorOf: tlFloorOf,
    floors: TL_FLOORS,
    links: [
      { from: "ground", to: "upper", a: { x: -HALLST.x, z: HALLST.zFoot - 0.7 }, b: { x: -HALLST.x, z: S_ARM + 0.8 } },
      { from: "ground", to: "upper", a: { x: HALLST.x, z: HALLST.zFoot - 0.7 }, b: { x: HALLST.x, z: S_ARM + 0.8 } },
      { from: "ground", to: "upper", a: { x: SERV.x, z: SERV.zFoot + 0.7 }, b: { x: SERV.x, z: SERV_HOLE[2] - 0.8 } },
      { from: "ground", to: "upper", a: { x: FIRE_S.xFoot - 0.7, z: FIRE_S.z }, b: { x: 12.7, z: FIRE_S.z } },
      { from: "ground", to: "upper", a: { x: FIRE_N.xFoot + 0.7, z: FIRE_N.z }, b: { x: -12.7, z: FIRE_N.z } },
      { from: "upper", to: "roof", a: { x: ROOFST.x, z: ROOFST.zFoot + 0.7 }, b: { x: ROOFST.x, z: ROOF_HOLE[2] - 0.8 } },
      { from: "upper", to: "roof", a: { x: LEDST.x, z: LEDST.zFoot + 0.7 }, b: { x: LEDST.x, z: 12.2 } },
    ],
    support: true,
    preferDist: 14,
    navCell: 0.55,
    navPad: 0.3,
    navStep: 0.45,
  }),
};
