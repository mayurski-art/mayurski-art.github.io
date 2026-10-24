// Troll Forces — "Kabukigrin" (doc docs/KABUKIGRIN.md): Grinjuku with
// Trolling Loud's Tokyo branch in its A side. Laid out in Roblox Studio
// (Kabukigrin (edit).rbxl); tools/troll-ops-map-from-studio.mjs --map
// kabukigrin --write brings back kabukigrin-layout.js: the colliders, the
// markers by name (spawns, sites, ropes, stairs) and the lights.
// Every still piece is Blender's since 2026-10-24 (Kabukigrin in Blender,
// claude.ai/artifact/ESCtEQZrXQ3MFZZg9MjWsw): models/build_kabukigrin.blender.py
// draws kb-shell, kb-props and kb-neon from the layout. In each, the mesh
// "gj" is Grinjuku's part (its own builders; gj-shell's and gj-props' bakes
// light it), the club cut out of it (the props Studio removed, the street
// dressing behind the club's walls, the dance floor's hole); the mesh "kb"
// is the club's, every material named by its Studio key
// ("glb:<gj model>:<material>|<tint>|<shadow>|n", "gen:<hash>||1"), so it
// is shaded and retextured as that GLB's material (map-models.js).
// On top of that the club's live layer, in code (club-live.js, as Trolling
// Loud's): the dance floor over its mirror pit, the DJ, the ceiling, the
// chandelier and ball, the bottle wall, the lasers, the clock and the
// booth's track; the seam pieces the street sees (the marquee, the kanji
// strip, the LED windows on Mid Bottom) and the two video screens
// (video-wall.js); the borrowed rooms' live bits (kabukigrin-rooms.js: the
// yokocho, the tatami VIP and its koi tank, the office's one-way mirror);
// the street's (kabukigrin-street.js: the pachinko parlour on A Main).
// In Socialize (kabukigrin-social.js): the door on A Main, the line, DJ Lulz
// at the booth, the crowd in the club and on the street, the seats.
// In the vote pool since phase 6 (it was kabukigrin_wip while it was built).

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GRINJUKU } from "./grinjuku.js?v=gj1-sr1-or1-tx1-sp1-kbt1-gb1";
import { KB_LAYOUT } from "./kabukigrin-layout.js?v=kb0-kb1-kb2-kb3-kb5-kb6-kb9-kb10-sp1";
import { mapModel, RETEXTURE } from "./map-models.js?v=hg6e-sr1-or1-tx1-sp1-kbt1-gb1";
import { loadBake } from "./battlefield-props.js?v=sr1-or1-tx1-sp1-kbt1-gb1";
import { applyBakedLightMap, retexture, SURFACES } from "./surface-textures.js?v=hg6e-sr1-or1-tx1-sp1-kbt1";
import { Kit, place, surfMat, texMat } from "./trollcity-kit.js?v=tc2-wst-tc3-sh1-sr1-pf1-or1-tcs1-tx1-ch1-sp1-kbt1";
import { U, Neon, neonMat, clubFx, cutRects, slatTexture, mosaicTexture } from "./trollingloud-kit.js?v=tl3-tc3-sh1-sr1-or1-tcs1-tx1-ch1-sp1-kbt1";
import { newState, sign, addLight, danceFloor, djStage, hallCeiling, chandelier, bottleWall, finishClub, clubEngine, clubMaterials } from "./club-live.js?v=cl1-kb4-kb6-kb11-tx1-ch1-sp1-hh1-yb1-kbt1";
import { videoScreen } from "./video-wall.js?v=vw1-kb4-kb5-tx1-ch1-sp1-kbt1";
import { buildRooms, roomsShot, roomsDebug } from "./kabukigrin-rooms.js?v=kb6-kb8-tx1-ch1-sp1-kbt1";
import { KB_DOOR, KB_VIEW, kbNpcs, kbFreeSeats } from "./kabukigrin-social.js?v=kb9-tx1-ch1-sp1-kbt1-gb3-rh1";
import { buildStreet, streetSound } from "./kabukigrin-street.js?v=kb10-kb11-kb12-tx1-ch1-sp1-kbt1";
import { buildTrain, trainFrame } from "./kabukigrin-train.js?v=kb14-sp1-kbt1";

const URL_GLB = new URL("../models/", import.meta.url).href;
const loader = new GLTFLoader();
// the GLBs whose chunks are light-mapped, and how strongly (battlefield-props BAKED)
const BAKED = { "gj-shell": Math.PI, "gj-props": Math.PI, "gj-skyline": Math.PI };
/* Photo surfaces (user, 2026-10-23: as Troll City got): the street, the
   pavements and the floors from the Poly Haven sets in surface-textures.js,
   and on the painted fronts a detail of the front set (below). */
const KB_RETEXTURE = {
  ...RETEXTURE,
  GS_Pavement: ["kbpave", 0.5],
  GS_FloorConc: ["kbfloor", 0.3],
};
/* GS_Paint is every flat-painted face in the town (map_kit.py folds them
   into one vertex-coloured material): fronts, signs, window panels and the
   road's paint. A photo can't replace it, so its walls only get the front
   set's grain and relief over the paint (`amt`), by the world normal: the
   floors, the lane lines and the crossings stay as painted. */
function paintDetail(mat, surface, repeat, amt) {
  const s = SURFACES[surface];
  if (!s || mat.userData.kbDetail) return;
  mat.userData.kbDetail = true;
  const tex = [s.color.clone(), s.normal.clone()];
  for (const t of tex) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.needsUpdate = true; }
  mat.normalMap = tex[1];
  mat.normalScale = new THREE.Vector2(0.8, 0.8);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uDetail = { value: tex[0] };
    sh.uniforms.uDetailAmt = { value: amt };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vWall;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWall = 1.0 - smoothstep(0.35, 0.6, abs(normalize(mat3(modelMatrix) * objectNormal).y));");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform sampler2D uDetail;\nuniform float uDetailAmt;\nvarying float vWall;")
      .replace("#include <color_fragment>", `#include <color_fragment>
  float kbD = dot(texture2D(uDetail, vNormalMapUv).rgb, vec3(0.333));
  diffuseColor.rgb *= mix(1.0, 0.55 + 0.9 * kbD, uDetailAmt * vWall);`)
      .replace("#include <normal_fragment_maps>", `vec3 kbN = normal;
#include <normal_fragment_maps>
  normal = normalize(mix(kbN, normal, vWall));`);
  };
  mat.needsUpdate = true;
}

const L = KB_LAYOUT;
const byKind = (kind) => Object.entries(L.markers).filter(([, m]) => m.kind === kind);
// Spawn_1, Spawn_2 ... in number order: the game splits the list in halves by team
const num = (name) => +(name.match(/\d+$/)?.[0] ?? 0);
const SPAWNS = byKind("spawn").filter(([n]) => /^Spawn_\d+$/.test(n)).sort(([a], [b]) => num(a) - num(b)).map(([, m]) => [m.p[0], m.p[2], m.p[1] || undefined].filter((v) => v !== undefined));
const PLAYER = L.markers.PlayerSpawn?.p || SPAWNS[0] && [SPAWNS[0][0], 0, SPAWNS[0][1]];
const SITES = byKind("site").map(([n, m]) => ({ id: n.replace(/^Site_/, ""), x: m.p[0], y: m.p[1] || 0, z: m.p[2] })).sort((a, b) => (a.id < b.id ? -1 : 1));
// every flight's foot and top, for whatever finds its way between floors
// (k9-unit.js, the bots): buildMap finds tall flights in the colliders by
// itself, not a two-step kerb
const STAIRS = byKind("stair").sort(([a], [b]) => num(a) - num(b)).map(([, m]) => ({ a: { x: m.p[0], y: m.p[1], z: m.p[2] }, b: { x: m.to[0], y: m.to[1], z: m.to[2] } }));
const ROPES = byKind("rope").sort(([a], [b]) => num(a) - num(b)).map(([, m]) => ({ x: m.p[0], z: m.p[2], y0: m.p[1], y1: m.top, dir: m.dir || "+z" }));

/* ============================================================== the club

   Where the club stands (doc 3.1): the hall is Grinjuku's A site, the DJ on
   the west wall looking east across the floor to the mezzanine (A Heaven),
   the bar under the mezzanine's overhang. club-live.js builds from this. */
const HALL = { x0: -31.7, x1: -14.4, z0: 4.4, z1: 23.6 };
const DANCE = { x0: -27, x1: -17, z0: 10, z1: 20 };
const PLAN = {
  FL: 0, TOP: 7.4, ROOF: 8.0, HALL, DANCE, DC: { x: -22, z: 15 },
  STAGE: { x0: -31.7, x1: -28, z0: 10, z1: 20, top: 0.45 },
  BPM: 128, djFace: "+x", djWall: -31.65, deck: { x: -29.6, z: 15 }, speaker: [-29.6, 2.2, 15],
  orbitY: 5.2,
  muffle: (p) => muffle(p),
};
const CLUB = clubEngine(PLAN);

/* The booth heard from p (doc 3.2), [lowpass Hz, gain]: full in the hall,
   a little softer on the open mezzanine, through a wall in the office, the
   tatami room and the back of house, further off in the yard, through the
   front wall on A Main, faint in the Sewers and Mid Bottom, nothing on B
   side (the yokocho included). Near an open doorway into the hall the hall
   leaks out: the closer, the brighter, so walking in through the main door
   or the back doors opens the sound up gradually, not at a line. */
const ZONES = [
  // [x0, x1, z0, z1, y0, y1, Hz, gain]
  [HALL.x0, HALL.x1, 4.1, 24, -1, PLAN.TOP, 16000, 1],   // (to the walls' middles: no gap in a doorway)
  [-14.4, -6, 4, 19, 2.5, PLAN.TOP, 9000, 0.95],       // the mezzanine, open over the hall
  [-14.4, -6, 19, 24, 2.5, PLAN.TOP, 2200, 0.8],       // the manager's office, the mirror between
  [-10, -6, 8, 11.6, -1, 2.5, 1800, 0.7],              // the riser off Mid Bottom
  [-31.7, -24.15, 24.2, 29.85, -1, 6, 1600, 0.8],      // the tatami room
  [-32, -6, 24, 34, -1, 6, 1300, 0.8],                 // the kitchen, green room and office stair
  [-32, -6, 34, 42, -1, 9, 520, 0.6],                  // the loading yard
  [-32, -14.4, -32, 4.4, -1, 9, 380, 0.85],            // A Main, the front wall between
  [-14.4, 7, -42, 42, -1, 9, 300, 0.55],               // the Sewers, Mid Bottom, the mid
];
// the doorways: [x, y, z, what leaks through: Hz, gain]; the hall's, and the yard's from the back of house
const DOORS = [
  [-27.6, 1.5, 3.9, 16000, 0.95], [-27, 1.4, 24, 16000, 0.95], [-16, 1.4, 24, 16000, 0.95], [-12, 4.3, 24, 16000, 0.95], [-12, 4.3, 19, 16000, 0.95],
  [-27.5, 1.5, 34, 1300, 0.8], [-15.5, 1.5, 34, 1300, 0.8],
];
function muffle(p) {
  const z = ZONES.find(([x0, x1, z0, z1, y0, y1]) => p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1 && p.y >= y0 && p.y < y1);
  if (!z) return [200, 0];   // B side: the club is a block away
  let [hz, k] = z.slice(6);
  if (hz >= 16000) return [hz, k];
  // the louder room through each doorway, falling off over a few metres
  let out = hz;
  for (const [x, y, dz, dHz, dK] of DOORS) {
    if (dHz <= hz) continue;
    const leak = 1 / (1 + (Math.hypot(p.x - x, (p.y - y) * 1.5, p.z - dz) / 3.6) ** 2);
    out = Math.max(out, Math.exp(Math.log(hz) + (Math.log(dHz) - Math.log(hz)) * leak));
    k = Math.max(k, dK * leak);
  }
  return [Math.round(out), k];
}

/* A neon sign from a canvas of Japanese text, one character per row when
   `vertical`. Its own material (one draw call). */
function jpSign(text, { vertical = false, color = "#3ff0ff", size = 112 } = {}) {
  const chars = [...text], n = chars.length;
  const c = document.createElement("canvas");
  c.width = Math.round(vertical ? size * 1.25 : size * (n + 0.6));
  c.height = Math.round(vertical ? size * (n + 0.4) : size * 1.4);
  const g = c.getContext("2d");
  g.font = `900 ${size}px 'Hiragino Sans','Yu Gothic','Meiryo','Noto Sans JP','Noto Sans CJK JP',sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = color;
  g.shadowColor = color;
  g.shadowBlur = size * 0.22;
  chars.forEach((ch, i) => {
    if (!vertical) { g.fillText(ch, size * (0.8 + i), c.height / 2); return; }
    // the long-vowel bar turns upright in vertical writing
    const y = size * (0.7 + i);
    if (ch === "ー") g.fillRect(c.width / 2 - size * 0.06, y - size * 0.4, size * 0.12, size * 0.8);
    else g.fillText(ch, c.width / 2, y);
  });
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  return { mat: neonMat({ map, transparent: true, key: `kb-${text}` }), aspect: c.width / c.height };
}

/* The dance floor's hole in the game's ground plane (made before build,
   one quad): the mirror pit under the glass shows through. Everything else
   at y 0 is Blender's, which leaves the hole itself. Same UVs as the plane
   (the ground bake projects by world x/z: applyGroundLightMap). */
function groundHole(ground, R = DANCE) {
  const g = ground.geometry, P = g.attributes.position;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < P.count; i++) { x0 = Math.min(x0, P.getX(i)); x1 = Math.max(x1, P.getX(i)); y0 = Math.min(y0, P.getY(i)); y1 = Math.max(y1, P.getY(i)); }
  ground.updateMatrixWorld(true);
  const inv = ground.matrixWorld.clone().invert(), v = new THREE.Vector3();
  const local = (x, z) => { v.set(x, 0, z).applyMatrix4(inv); return new THREE.Vector2(v.x, v.y); };
  const shape = new THREE.Shape([new THREE.Vector2(x0, y0), new THREE.Vector2(x1, y0), new THREE.Vector2(x1, y1), new THREE.Vector2(x0, y1)]);
  shape.holes.push(new THREE.Path([local(R.x0, R.z0), local(R.x0, R.z1), local(R.x1, R.z1), local(R.x1, R.z0)]));
  const hole = new THREE.ShapeGeometry(shape);
  const H = hole.attributes.position, uv = hole.attributes.uv;
  for (let i = 0; i < H.count; i++) uv.setXY(i, (H.getX(i) - x0) / (x1 - x0), (H.getY(i) - y0) / (y1 - y0));
  g.dispose();
  ground.geometry = hole;
}

function buildClub(api) {
  const S = newState();
  const root = new THREE.Group();
  api.prop(root);
  root.castShadow = false;
  const K = new Kit(api, root);
  const N = new Neon(root);
  const HN = new Neon(root);        // the hall's ceiling neon: mirrored in the dance floor
  const M = clubMaterials();
  const lights = [];

  clubInterior(K);
  danceFloor(K, M, N, PLAN, { edgeY: 0.01 });
  djStage(K, M, N, HN, S, PLAN, { stage: false, wall: { w: 10, h: 5.5 }, arches: { a: 6.8, h: 7.0, n: 5, step: 0.35, drop: 0.24 } });
  hallCeiling(K, M, N, HN, PLAN, PLAN.TOP - 0.3);
  chandelier(K, M, HN, S, PLAN, { top: 6.9, ball: { y: 5.75, r: 0.5 } });
  // the bottles on the back bar under the mezzanine (Studio's counter and cabinet)
  bottleWall(K, M, S, { x: -14.45, back: -14.42, z0: 8.4, z1: 16, y: 0, rows: 2, glow: { h: 1.7, y: 2.05 }, ghostH: 1.75 });

  /* ---- the marquee over the main door, facing up A Main (doc 3.2): its
     black and gold box is Studio's (generate_mesh), the sign and bulbs on it */
  sign(S, N, M, "logo", -26, 4.575, 3.18, 0.9, { ry: Math.PI, group: 1, halo: 0xff3fb4, haloK: 0.35, beat: 0.35 });
  for (let i = 0; i < 24; i++) {
    N.add(M.neon, new THREE.SphereGeometry(0.035, 6, 4).translate(-28.4 + i * 0.208, 3.95, 3.19), { color: 0xffd080, k: 2.2, chase: 1, phase: i / 24, beat: 0.2 });
  }
  const tokyo = jpSign("東京", { color: "#ffffff", size: 96 });
  N.quad(tokyo.mat, -26, 3.67, 3.66, 0.4 * tokyo.aspect, 0.4, { ry: Math.PI, k: 1.2, beat: 0.1 });

  /* ---- the light leak (doc 3.2): the floor's pink and the DJ wall's cyan
     out of each doorway, on the beat: a pool on A Main's wet street in front
     of the main door and a haze in the doorway, pools through the back doors
     on the tatami and the green room's floor */
  const pool = (x, y, z, w, d, color, k, beat) => N.quad(M.neonHalo, x, y, z, w, d, { rx: -Math.PI / 2, color, k, beat });
  pool(-27.6, 0.025, 1.6, 6.2, 5.2, 0xff2ab4, 0.34, 0.85);
  pool(-27.2, 0.03, 2.6, 3.4, 2.6, 0x3ff0ff, 0.16, 0.6);
  N.quad(M.neonHalo, -27.6, 1.7, 3.86, 4.6, 3.6, { ry: Math.PI, color: 0xff3fb4, k: 0.12, beat: 0.6 });
  pool(-27, 0.32, 25.3, 2.8, 2.2, 0xff2ab4, 0.18, 0.7);
  pool(-16, 0.025, 25.3, 2.8, 2.2, 0xff2ab4, 0.2, 0.7);

  /* ---- the kanji strip on the front corner: a blade sign reading downward,
     cyan and steady (the street's neon is calm) */
  // (its riveted panels, one a character, are Studio's)
  const strip = jpSign("トローリング・ラウド", { vertical: true, color: "#3ff0ff" });
  const sh = 5.4, sw = sh * strip.aspect;
  for (const [dx, ry] of [[0.085, Math.PI / 2], [-0.085, -Math.PI / 2]]) N.quad(strip.mat, -30.9 + dx, 2.5 + sh / 2, 3.25, sw, sh, { ry, k: 1.15, beat: 0, group: 3 });
  // shootable: a round into either face shorts it out (sign group 3)
  S.signs.push({ group: 3, x: -30.9, y: 2.5 + sh / 2, z: 3.25, w: sw, h: sh, ry: Math.PI / 2 });

  /* ---- the east wall on Mid Bottom: six LED windows pulsing on the kick,
     the big cyan trollface between them */
  for (const z of [5.6, 8.4, 11.2, 16.8, 19.6, 22.4]) {
    K.box(M.blackMetal, -5.99, 3.3, z, 0.04, 1.3, 1.7);
    K.add(M.crystal, place(new THREE.PlaneGeometry(1.6, 1.2), { x: -5.96, y: 3.95, z, ry: Math.PI / 2 }), { shadow: false });
  }
  sign(S, N, M, "trollCyan", -5.95, 5.5, 14, 3.3, { ry: Math.PI / 2, group: 2, halo: 0x3ff0ff, haloK: 0.25, beat: 0.4 });

  /* ---- the lights (doc 3.3, placed in Studio): the dance floor's rides
     round the ball; the club's kick on the beat, the bar and back don't */
  const AMP = { "#ff2ab4": 0.25, "#3ff0ff": 0.25, "#a060ff": 0.15, "#ff3a8a": 0.2 };
  for (const [x, y, z, hex, power, range] of L.lights) {
    const dance = hex === "#ff2ab4";
    addLight(S, lights, new THREE.Color(hex), power, range, x, y, z, { amp: AMP[hex] ?? 0.04, ...(dance && { hue: 0.92, orbit: 0 }) });
  }

  // the borrowed rooms (doc 3.5 b, c, d): Studio's walls, these their insides
  buildRooms({ root, K, N, M, S, jpSign, sfx: CLUB.sfx });
  // and the street's (doc 3.5 a): the pachinko parlour across the line
  buildStreet({ root, N, M });
  buildTrain(root);

  K.flush();
  N.flush();
  HN.flush();
  for (const l of lights) root.add(l);
  // (the lasers stop at the hall's walls: the tatami room and the office lie past them)
  finishClub(root, M, HN, S, CLUB, { clip: { x0: HALL.x0, x1: -13.7, z0: 3.9, z1: 24 } });

  /* ---- the video screens, Times Square billboards (refs/times-square-
     screens-*.jpg): each in a housing built out from its facade past every
     window frame, ledge and sign on it, so nothing stands in front, the shop
     signs in its way cleared (build_kabukigrin CLEAR). The club's over the Sewers' mouth on
     A Main, short of the marquee; the Alta screen on the east block's
     corner over the forecourt */
  api.prop(videoScreen({ w: 11.2, h: 5.6, px: [768, 384], x: -24.62, y: 5.65, z: -2.6, ry: -Math.PI / 2, frame: 1.6 })).castShadow = false;
  // (east of the corner's blade signs at x 14, over the shop signs)
  api.prop(videoScreen({ w: 6.67, h: 4, px: [640, 384], x: 19.3, y: 5.6, z: -33.3, ry: Math.PI, offset: 17.3, frame: 1.28 })).castShadow = false;
  // and the hall's two, facing each other over the dance floor: the pole
  // dancer on the front wall (the Sewers block's face), @SwishPng's leaping
  // trolls on the back wall's solid run
  api.prop(videoScreen({ w: 5.6, h: 3.15, px: [768, 432], x: -19.9, y: 5.1, z: 4.06, ry: 0, clips: ["pole"] })).castShadow = false;
  api.prop(videoScreen({ w: 6.4, h: 3.6, px: [640, 360], x: -21.5, y: 4.3, z: 23.76, ry: Math.PI, clips: ["swish"], fps: 24 })).castShadow = false;
}

/* The hall's inside (doc 3.4): Trolling Loud's slatted walls with the red
   wash, laid on the inner face of every wall Studio built (so each doorway
   stays open), the west edge wall behind the DJ; teal mosaic on the bar's
   wall under the mezzanine; mirror-black marble round the dance floor;
   a dark ceiling. */
function clubInterior(K) {
  const slats = clubFx(texMat(slatTexture(), { tile: 1.2, rough: 0.6, bounce: 0.1 }), { wash: { color: 0xff2a3a, top: 3.2, strength: 0.65 }, disco: true });
  const mosaic = clubFx(texMat(mosaicTexture(), { tile: 1.4, rough: 0.3, metal: 0.2, bounce: 0.4 }), { wash: { color: 0x20ffd0, top: 3, strength: 0.25 } });
  const marble = clubFx(surfMat("marble", 0x17131c, { mix: 0.04, tile: 3, rough: 0.28 }), { disco: true });
  Object.assign(marble, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  const ceiling = new THREE.MeshStandardMaterial({ color: 0x0b0a0e, roughness: 0.95 });
  const panel = (mat, x, z, len, y0, y1, ry) => {
    if (len < 0.05 || y1 - y0 < 0.05) return;
    K.add(mat, place(new THREE.PlaneGeometry(len, y1 - y0), { x, y: (y0 + y1) / 2, z, ry }), { shadow: false });
  };
  const { x0, x1, z0, z1 } = HALL, top = PLAN.TOP;
  // the front (z 3.9) and back (z 24) walls: a panel on each Studio piece
  for (const [x, z, w, d, h, y, pen] of L.colliders) {
    // (not the glass: the tatami room's window onto the hall)
    if (x - w / 2 < x0 - 0.05 || x + w / 2 > x1 + 0.45 || h < 0.5 || pen < 1) continue;
    const ya = Math.max(0, y), yb = Math.min(top, y + h);
    if (Math.abs(z - 3.9) < 0.05) panel(slats, x, z + d / 2 + 0.01, w, ya, yb, 0);
    if (Math.abs(z - 24) < 0.05) panel(slats, x, z - d / 2 - 0.01, w, ya, yb, Math.PI);
  }
  // the Sewers block's face (Grinjuku's, no collider of Studio's): the front wall east of the doors
  panel(slats, (-23 + x1) / 2, 4.01, x1 + 23, 0, top, 0);
  // the west edge wall, behind the DJ and its crystal wall
  panel(slats, x0 + 0.04, (z0 + z1) / 2, z1 - z0 + 0.6, 0, top, Math.PI / 2);
  // the bar's wall: the mezzanine's face, either side of the back bar
  for (const [za, zb] of [[z0 - 0.3, 8.4], [16, z1 + 0.2]]) panel(mosaic, -14.01, (za + zb) / 2, zb - za, 0, PLAN.ROOF - 5, -Math.PI / 2);
  // the floor round the dance floor, and the ceiling
  for (const [a0, a1, b0, b1] of cutRects(x0, x1, z0 - 0.3, z1 + 0.2, [[DANCE.x0, DANCE.x1, DANCE.z0, DANCE.z1]])) {
    K.add(marble, place(new THREE.PlaneGeometry(a1 - a0, b1 - b0), { x: (a0 + a1) / 2, y: 0.004, z: (b0 + b1) / 2, rx: -Math.PI / 2 }), { shadow: false });
  }
  K.add(ceiling, place(new THREE.PlaneGeometry(x1 - x0, z1 - z0 + 0.5), { x: (x0 + x1) / 2, y: top - 0.01, z: (z0 + z1) / 2, rx: Math.PI / 2 }), { shadow: false });
}

/* The Blender models (build_kabukigrin.blender.py): Grinjuku's part lit by
   its GLB's bake, the club's pieces as their Studio keys say; then the
   photo surfaces and the fronts' grain. */
const MODELS = { "kb-shell": "gj-shell", "kb-props": "gj-props", "kb-neon": null };
const MODELS_V = "kbb1";
function loadModels(api) {
  for (const [file, gj] of Object.entries(MODELS)) {
    loader.load(`${URL_GLB}${file}.glb?v=${MODELS_V}`, (gltf) => {
      const baked = [];
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.receiveShadow = true;
        const key = o.material.name;
        if (/^(glb|gen):/.test(key)) {
          // a club piece: "<kind>:<gj model>:<material>|<tint>|<shadow>..."
          const [k, , shadow] = key.split("|");
          const [kind, src, name] = k.split(":");
          if (kind === "glb") o.material.name = name;   // retexture's rules go by the Blender name
          o.castShadow = shadow !== "0" && src !== "gj-neon";
          return;
        }
        o.castShadow = file !== "kb-neon";
        if (gj) baked.push(o);
      });
      (gj ? loadBake(gj) : Promise.resolve(null)).then((bake) => {
        if (bake) for (const o of baked) applyBakedLightMap(o, bake, BAKED[gj]);
        retexture(gltf.scene, KB_RETEXTURE);
        gltf.scene.traverse((o) => { if (o.isMesh && o.material?.name === "GS_Paint") paintDetail(o.material, "kbfront", 0.45, 0.7); });
        api.prop(gltf.scene);
      });
    }, undefined, (e) => console.warn(`Kabukigrin: ${file} didn't load`, e));
  }
}

function buildKabukigrin(api) {
  for (const [x, z, w, d, h, y, pen] of L.colliders) api.ghostBox(x, z, w, d, h, { y, pen });
  api.stairLinks.push(...STAIRS.map((s) => ({ a: { ...s.a }, b: { ...s.b } })));
  for (const r of ROPES) api.rope(r.x, r.z, r.y0, r.y1, { dir: r.dir, ghost: true });
  loadModels(api);
  // the game's ground plane (made before build) gets the dance floor's hole
  const probe = api.prop(new THREE.Group()), top = probe.parent;
  top.remove(probe);
  const ground = top.children.find((o) => o.isMesh && o.geometry.type === "PlaneGeometry");
  if (ground) groundHole(ground);
  buildClub(api);
  // the far city: drawn by the game, not part of the Studio town
  mapModel(api, "gj-skyline", { x: 0, z: 0, castShadow: false });
}

// The street's decals and litter stay off the club's floor (doc 5): every
// scatter that named no area, or A site, now names the rest
const DRESS = (() => {
  const d = GRINJUKU.dress, rest = Object.keys(d.areas).filter((a) => a !== "aSite");
  const keep = (e) => {
    const area = e.area ? [].concat(e.area).filter((a) => a !== "aSite") : rest;
    return area.length ? { ...e, area } : null;
  };
  // A Main's puddles go pink (doc 5): the club's marquee and the pachinko
  // sign in them, a magenta cast to the water
  const decals = d.decals.map(keep).filter(Boolean).flatMap((e) => {
    if (e.cell !== "puddle" || !e.area.includes("aMain")) return [e];
    const rest = e.area.filter((a) => a !== "aMain");
    const share = Math.round(e.n / e.area.length) + 3;
    return [...(rest.length ? [{ ...e, area: rest, n: e.n - share + 3 }] : []), { ...e, area: ["aMain"], n: share, color: 0x2e0a26, alpha: 0.78 }];
  });
  return { ...d, decals, clutter: d.clutter.map(keep).filter(Boolean) };
})();

// the crowd: the same every build (seeded), made once
let CAST = null;
const cast = () => (CAST ??= kbNpcs({ DC: PLAN.DC, DANCE, deck: PLAN.deck }));

export const KABUKIGRIN = {
  ...GRINJUKU,
  // the street: the photo asphalt, Grinjuku's lane lines printed on it at the old texture's brightness
  ground: { ...GRINJUKU.ground, surface: "kbasph" },
  name: "Kabukigrin",
  blurb: "Kabukicho after midnight. Trolling Loud's Tokyo branch on one side of the street, the alleys on the other, and a bomb site on the dance floor.",
  playerSpawn: { x: PLAYER[0], z: PLAYER[2] },
  build: buildKabukigrin,
  dress: DRESS,
  bombSites: SITES,
  spawns: SPAWNS,
  // the koi tank and the office's mirror first, then the club's signs and bottles
  onShot: (p) => { if (!roomsShot(p)) CLUB.onShot(p); },
  attachAudio: CLUB.attachAudio,
  attachMusic: CLUB.attachMusic,
  // the club's clock and lights, the pachinko parlour's din, the train
  onFrame: (f) => { CLUB.onFrame(f); streetSound(CLUB.sfx, f?.live); trainFrame(CLUB.sfx, f?.live ? U.uPlayer.value : null); },
  /* Socialize (doc 4.1): DJ Lulz at the booth, requests from the floor in
     front of the stage; the door, the crowd and the seats */
  dj: { name: "DJ Lulz", spot: { x: -27.3, z: 15, y: 0, reach: 3.4 }, club: { ...HALL, top: PLAN.TOP }, input: CLUB.songInput },
  rp: {
    npcs: () => cast(),
    seats: () => kbFreeSeats(cast()),
    beat: () => U.uBeatPos.value,
    npcShadows: false,
    view: KB_VIEW,
    door: KB_DOOR,
  },
  debug: () => ({ ...CLUB.debug(), rooms: roomsDebug(), ropes: ROPES.map((r) => ({ ...r })), sites: SITES.map((s) => ({ ...s })) }),
};
