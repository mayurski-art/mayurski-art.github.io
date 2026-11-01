// Troll Forces — "Kabukigrin" (doc docs/KABUKIGRIN.md): Grinjuku with
// Trolling Loud's Tokyo branch in its A side. Laid out in Roblox Studio
// (Kabukigrin (edit).rbxl); tools/troll-ops-map-from-studio.mjs --map
// kabukigrin --write brings back kabukigrin-layout.js: the colliders, the
// markers by name (spawns, sites, ropes, stairs) and the lights.
// Every still piece is Blender's since 2026-10-24 (Kabukigrin in Blender,
// claude.ai/artifact/ESCtEQZrXQ3MFZZg9MjWsw): models/build_kabukigrin.blender.py
// draws kb-shell, kb-props and kb-neon from the layout, and bakes kb-shell's
// and kb-props' light (phase 4: kb-shell-bake, kb-props-bake, one atlas a
// GLB, the fixed lights in it). In each, the mesh "gj" is Grinjuku's
// part (its own builders), the club cut out of it (the props Studio removed, the street
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
import { GRINJUKU } from "./grinjuku.js?v=gj1-sr1-or1-tx1-sp1-kbt1-gb1-kbb2-kbs1-pm1-kbk2-tfp7-tfb8-ss1-ss2-ss3-tfm2-hgb2-ugb1-ug1-ugm1-hgb5-hgb6-hgb8";
import { KB_LAYOUT } from "./kabukigrin-layout.js?v=kb0-kb1-kb2-kb3-kb5-kb6-kb9-kb10-sp1";
import { KB_PROPS } from "./kabukigrin-props.js?v=kbp1-kbb2-mn1-kb3";
import { mapModel, RETEXTURE } from "./map-models.js?v=hg6e-sr1-or1-tx1-sp1-kbt1-gb1-kbb2-kbs1-pm1-kbk2-tfp7-tfb8-ss1-ss2-ss3-tfm2-hgb2-ugb1-ug1-ugm1-hgb5-hgb6-hgb8";
import { loadBake } from "./battlefield-props.js?v=sr1-or1-tx1-sp1-kbt1-gb1-pm1-kbk2-tfp7-tfb8-ss1-ss2-ss3-tfm2-ugb1-ug1-ugm1-hgb6";
import { applyBakedLightMap, retexture, SURFACES } from "./surface-textures.js?v=hg6e-sr1-or1-tx1-sp1-kbt1-pm1-ss1-ss2-ss3-tfm2-ugb1-ug1-ugm1";
import { Kit, place } from "./trollcity-kit.js?v=tc2-wst-tc3-sh1-sr1-pf1-or1-tcs1-tx1-ch1-sp1-kbt1-pm1-ss1-ss2-ss3-tfm2-ugb1-ug1-ugm1";
import { U, Neon, neonMat, clubFx } from "./trollingloud-kit.js?v=tl3-tc3-sh1-sr1-or1-tcs1-tx1-ch1-sp1-kbt1-pm1-ss1-ss2-ss3-tfm2-ugb1-ug1-ugm1";
import { newState, sign, addLight, danceFloor, djStage, chandelier, bottleWall, finishClub, clubEngine, clubMaterials } from "./club-live.js?v=cl1-kb4-kb6-kb11-tx1-ch1-sp1-hh1-yb1-kbt1-dj2-mn1-gr1-pm1-ss1-ss2-ss3-tfm2-ugb1-ug1-ugm1";
import { FL, B1, CEIL, CEILL, HALL, DANCE, DC, STAGE, DJ_WALL, DECK, TUNNEL, STAIRS as UNDER_STAIRS, WELLS, SCREENS, inOldHall, groundField, stairLink, underColliders, underMaterials, buildUnderShell, cutOldClub, underFaces } from "./kabukigrin-under.js?v=kbu1";
import { buildClubSigns, signFaces } from "./kabukigrin-club-signs.js?v=kcs1";
import { wetFloor, hangProbe } from "./wet-floor.js?v=wf1-ss1-ss2-ss3-tfm2";
import { moneyRain } from "./club-money.js?v=mn1";
import { videoScreen } from "./video-wall.js?v=vw1-kb4-kb5-tx1-ch1-sp1-kbt1-pm1-kco1-ss1-ss2-ss3-tfm2-ugb1-ug1-ugm1";
import { buildRooms, roomsShot, roomsDebug } from "./kabukigrin-rooms.js?v=kb6-kb8-tx1-ch1-sp1-kbt1-pm1-ss1-ss2-ss3-tfm2-ugb1-ug1-ugm1";
import { KB_DOOR, KB_VIEW, kbNpcs, kbFreeSeats } from "./kabukigrin-social.js?v=kb9-tx1-ch1-sp1-kbt1-gb3-rh1-kb3-pm1-ss1-ss2-ss3-tfm2-rm1-ugb1-ug1-ugm1-nd1";
import { buildStreet, lightParlour, parlourColliders, parlourWall, MACHINES, PARLOUR, PLAY, streetSound } from "./kabukigrin-street.js?v=kb10-kb11-kb12-tx1-ch1-sp1-kbt1-kb3-pm1-ss1-ss2-ss3-tfm2-ugb1-ug1-ugm1";
import { buildSigns } from "./kabukigrin-signs.js?v=ks1-kbs1";
import { game } from "../core/state.js?v=st1";
import { buildTrain, trainFrame } from "./kabukigrin-train.js?v=kb14-sp1-kbt1-pm1-ss1-ss2-ss3-tfm2-ugb1-ug1-ugm1";

const URL_GLB = new URL("../models/", import.meta.url).href;
const loader = new GLTFLoader();
// the GLBs that are light-mapped, and how strongly (battlefield-props BAKED)
// (Kabukigrin's hold half the light, so lamp-lit walls don't clip: build_kabukigrin BAKE_SCALE)
const BAKED = { "kb-shell": 2 * Math.PI, "kb-props": 2 * Math.PI };
// the ground's light, at half too (models/bake_map_ground.blender.py kabukigrin 1.7 40 0.5)
const GROUND_BAKE = { file: "kabukigrin-ground", rect: [-56, -56, 112], intensity: 2 * Math.PI };
// The layout's lights the bake leaves live (build_kabukigrin LIVE_LIGHTS), by
// x, z: the borrowed rooms', whose insides are drawn here, unbaked (the green
// room, the tatami room, the office). The rest are in the light maps.
const LIVE_LIGHTS = [[-13, 29], [-28, 27], [-10, 21.5]];
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

   Where the club stands (docs/KB-CLUB-UNDERGROUND.md): under Lulz Square,
   the open square Grinjuku's A site became. kabukigrin-under.js holds the
   plan; club-live.js builds Trolling Loud's live layer into it. Two plans:
   `PLAN_L` for the builders, in the dug group's frame (the floor at 0, as
   Trolling Loud's was), `PLAN` for the engine, in the world's. */
// A Main's street, as Grinjuku's dressing names it: [x0, z0, x1, z1]
const A_MAIN = GRINJUKU.dress.areas.aMain;
const PLAN_L = {
  FL: 0, TOP: CEILL, ROOF: CEILL, HALL, DANCE, DC, STAGE,
  BPM: 128, djFace: "+x", djWall: DJ_WALL, deck: DECK,
};
const PLAN = {
  ...PLAN_L, FL, TOP: CEIL, ROOF: CEIL,
  speaker: [-30.3, FL + 2.2, DECK.z], orbitY: FL + 5.2,
  // ...and dizzy or passed out (modes/drunk.js game.drunkMuffle 0..1), the booth sinks into a low hum
  muffle: (p) => { const [hz, k] = muffle(p), m = game.drunkMuffle || 0; return m ? [Math.round(hz * (1 - 0.8 * m) + 180 * m), k * (1 - 0.35 * m)] : [hz, k]; },
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
  [HALL.x0, HALL.x1, HALL.z0, HALL.z1, FL - 1, CEIL + 0.1, 16000, 1],   // the hall: B1 and B2
  [TUNNEL.x0 - 0.5, TUNNEL.x1 + 0.5, TUNNEL.z0, 40.5, B1 - 1, 0.1, 9000, 0.95],   // the tunnel and the yard's stair
  [-28, -24, 4.4, 10.2, -0.5, 2, 9000, 0.9],           // the front stair's slot
  [-22.5, -16, 21.5, 24.5, -0.5, 2, 9000, 0.9],        // the side stair's slot
  [-32, -14, 3.9, 24, -0.5, 9, 900, 0.7],              // Lulz Square, the slab between
  [-14.4, -6, 4, 24, 2.5, 9, 900, 0.6],                // A Heaven over the square
  [-32, -6, 24, 34, -0.5, 6, 700, 0.6],                // the kitchen, green room, tatami room, office
  [-32, -6, 34, 42, -0.5, 9, 600, 0.6],                // the loading yard
  [-32, -14.4, -32, 3.9, -0.5, 9, 380, 0.55],          // A Main
  [-14.4, 7, -42, 42, -1, 9, 300, 0.4],                // the Sewers, Mid Bottom, the mid
];
// the openings: [x, y, z, what leaks through: Hz, gain]; the three stairs' heads, the tunnel's mouth
const DOORS = [
  [-26, 0.5, 4.6, 16000, 0.95], [-21.8, 0.5, 23, 16000, 0.9], [-20, 0.5, 39.7, 9000, 0.8], [-20, B1 + 0.6, TUNNEL.z0, 16000, 0.95],
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

/* The stairs' openings in the game's ground plane (made before build, one
   quad): the wells down to the balcony. Everything else at y 0 is
   Blender's, which leaves the holes themselves. Same UVs as the plane (the
   ground bake projects by world x/z: applyGroundLightMap). */
function groundHole(ground, rects) {
  const g = ground.geometry, P = g.attributes.position;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < P.count; i++) { x0 = Math.min(x0, P.getX(i)); x1 = Math.max(x1, P.getX(i)); y0 = Math.min(y0, P.getY(i)); y1 = Math.max(y1, P.getY(i)); }
  ground.updateMatrixWorld(true);
  const inv = ground.matrixWorld.clone().invert(), v = new THREE.Vector3();
  const local = (x, z) => { v.set(x, 0, z).applyMatrix4(inv); return new THREE.Vector2(v.x, v.y); };
  const shape = new THREE.Shape([new THREE.Vector2(x0, y0), new THREE.Vector2(x1, y0), new THREE.Vector2(x1, y1), new THREE.Vector2(x0, y1)]);
  for (const [rx0, rx1, rz0, rz1] of rects) shape.holes.push(new THREE.Path([local(rx0, rz0), local(rx0, rz1), local(rx1, rz1), local(rx1, rz0)]));
  const hole = new THREE.ShapeGeometry(shape);
  const H = hole.attributes.position, uv = hole.attributes.uv;
  for (let i = 0; i < H.count; i++) uv.setXY(i, (H.getX(i) - x0) / (x1 - x0), (H.getY(i) - y0) / (y1 - y0));
  g.dispose();
  ground.geometry = hole;
}

/* The dug hall's ceiling at `y` (the slab's underside): a neon ring, and a
   ring of moving heads over the dance floor, short of the balcony's arms
   (club-live's hallCeiling reaches the walls: its heads would hang at head
   height over the arms). */
function underCeiling(K, M, N, HN, P, y) {
  const { DC } = P;
  const ring = [];
  for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; ring.push([DC.x + Math.cos(a) * 5.4, y, DC.z + Math.sin(a) * 5.4]); }
  HN.tube(M.neon, ring, { closed: true, r: 0.05, color: 0xff3fb4, k: 2.6, chase: 0.8, chaseLen: 4, beat: 0.4 });
  K.add(M.blackMetal, place(new THREE.TorusGeometry(4.5, 0.1, 6, 48), { x: DC.x, y: y - 0.4, z: DC.z, rx: Math.PI / 2 }), { shadow: false });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const hx = DC.x + Math.cos(a) * 4.5, hz = DC.z + Math.sin(a) * 4.5;
    K.box(M.blackMetal, hx, y - 0.95, hz, 0.28, 0.42, 0.28, { ry: -a });
    N.add(M.neon, place(new THREE.CircleGeometry(0.1, 10), { x: hx, y: y - 0.96, z: hz, rx: Math.PI / 2 }), { color: i % 3 ? 0xffffff : 0xffd080, k: 2.4, beat: 0.7, chase: 0.5, phase: i / 12 });
  }
}

function buildClub(api) {
  const S = newState();
  const root = new THREE.Group();
  api.prop(root);
  root.castShadow = false;
  const K = new Kit(api, root);
  const N = new Neon(root);
  const M = clubMaterials();
  const lights = [];

  /* ---- the dug club (kabukigrin-under.js), drawn in a group whose y is
     the floor, so club-live's builders (Trolling Loud's: floor at 0) land in
     it as they are; a collider they ask for goes down with it */
  const under = new THREE.Group();
  under.position.y = FL;
  root.add(under);
  const uapi = { ...api, ghostBox: (x, z, w, d, h, o = {}) => api.ghostBox(x, z, w, d, h, { ...o, y: (o.y ?? 0) + FL }) };
  const UK = new Kit(uapi, under);
  const UN = new Neon(under);
  const UHN = new Neon(under);      // the ceiling's neon: mirrored in the dance floor
  const UM = underMaterials();
  // spilt drinks on the black floor: pools near-mirror, the rest a touch glossier
  wetFloor(UM.floor, { rect: [HALL.x0, HALL.z0, HALL.x1, HALL.z1], cover: 0.35, scale: 1.6, edge: 0.4, pool: 0.03, dry: 0.7, dark: 0.85, env: 0.5, clamp: 0.6,
    probe: { at: [DC.x, FL + 1.2, DC.z], box: [HALL.x0, FL - 0.1, HALL.z0, HALL.x1, CEIL, HALL.z1] } });
  buildUnderShell(UK, UN, M, UM);
  const signs0 = S.signs.length;
  // (the tiles burn brighter than they did in the old red room: nothing else down here is lit)
  danceFloor(UK, M, UN, PLAN_L, { edgeY: 0.01, tileK: 0.9 });
  // (wall and arches inside the DJ's end, between the balcony's arms: z 12 .. 22)
  djStage(UK, M, UN, UHN, S, PLAN_L, { stage: true, booth: false, wall: { w: 9, h: 5.5 }, arches: { a: 4.7, h: 6.4, n: 5, step: 0.3, drop: 0.22 } });
  underCeiling(UK, M, UN, UHN, PLAN_L, CEILL - 0.3);
  chandelier(UK, M, UHN, S, PLAN_L, { top: 6.2, ball: { y: 5.0, r: 0.5 } });
  // money thrown over the floor on the drops, landing on the notes already
  // lying round its rim (kb_props.py scatter, moved down with the floor)
  const near = (c) => c[0] > DANCE.x0 - 2.2 && c[0] < DANCE.x1 + 2 && c[2] > DANCE.z0 - 2 && c[2] < DANCE.z1 + 2;
  moneyRain(under, S, { spots: KB_PROPS.cash.filter(near), area: DANCE });
  // the bottles on the back bar under the east arm
  bottleWall(UK, M, S, { x: -6.55, back: -6.52, z0: 13.5, z1: 20.5, y: 0, rows: 2, glow: { h: 1.7, y: 2.05 }, ghostH: 1.75 });
  // what the builders kept in the group's frame, into the world's (the shots, the ball's orbit)
  for (let i = signs0; i < S.signs.length; i++) S.signs[i].y += FL;
  for (const b of S.bottleSegs) b.y += FL;
  if (S.shelf) { S.shelf.y0 += FL; S.shelf.y1 += FL; }
  S.ballBox.y += FL;
  U.uBall.value.y += FL;

  /* ---- the lights (doc 6): made at build time, never changed in count.
     The floor's pink on the kick, the DJ wall's cyan, the bar's warm, the
     balcony's violet; the borrowed rooms keep theirs (LIVE_LIGHTS) */
  addLight(S, lights, new THREE.Color(0xff2ab4), 30, 16, DC.x, FL + 5, DC.z, { amp: 0.5, hue: 0.92, orbit: 0 });
  addLight(S, lights, new THREE.Color(0x3ff0ff), 18, 12, -30.2, FL + 4, DECK.z, { amp: 0.3 });
  addLight(S, lights, new THREE.Color(0xffb84a), 10, 9, -8.2, FL + 2.6, 17, { amp: 0.04 });
  addLight(S, lights, new THREE.Color(0x7a3cff), 10, 12, -20, B1 + 2.4, 8, { amp: 0.2 });
  const AMP = { "#ff2ab4": 0.25, "#3ff0ff": 0.25, "#a060ff": 0.15, "#ff3a8a": 0.2 };
  for (const [x, y, z, hex, power, range] of L.lights) {
    if (!LIVE_LIGHTS.some(([lx, lz]) => lx === x && lz === z)) continue;
    addLight(S, lights, new THREE.Color(hex), power, range, x, y, z, { amp: AMP[hex] ?? 0.04 });
  }

  /* ---- the east wall on Mid Bottom: six LED windows pulsing on the kick,
     the big cyan trollface between them */
  for (const z of [5.6, 8.4, 11.2, 16.8, 19.6, 22.4]) {
    K.box(M.blackMetal, -5.99, 3.3, z, 0.04, 1.3, 1.7);
    K.add(M.crystal, place(new THREE.PlaneGeometry(1.6, 1.2), { x: -5.96, y: 3.95, z, ry: Math.PI / 2 }), { shadow: false });
  }
  sign(S, N, M, "trollCyan", -5.95, 5.5, 14, 3.3, { ry: Math.PI / 2, group: 2, halo: 0x3ff0ff, haloK: 0.25, beat: 0.4 });

  // the way to the club's door (docs/KB-CLUB-UNDERGROUND.md 7): the canopy
  // and marquee over the front stair, the sign stack, the arrows, the blade
  buildClubSigns({ root, K, N, M, S, jpSign });

  // the borrowed rooms (doc 3.5 b, c, d): Studio's walls, these their insides
  buildRooms({ root, K, N, M, S, jpSign, sfx: CLUB.sfx });
  // and the street's (doc 3.5 a): the pachinko parlour across the line
  buildStreet({ root, N, M });
  // the shop signs, lettered in Japanese (the build cut Grinjuku's made-up glyphs)
  root.add(buildSigns());
  buildTrain(root);

  K.flush();
  N.flush();
  UK.flush();
  UN.flush();
  UHN.flush();
  for (const l of lights) root.add(l);
  // (the lasers stop at the hall's walls)
  finishClub(under, M, UHN, S, CLUB, { clip: { x0: HALL.x0, x1: HALL.x1, z0: HALL.z0, z1: HALL.z1 } });

  /* ---- the video screens, Times Square billboards (refs/times-square-
     screens-*.jpg): each in a housing built out from its facade past every
     window frame, ledge and sign on it, so nothing stands in front, the shop
     signs in its way cleared (build_kabukigrin CLEAR). The club's over the Sewers' mouth on
     A Main; the Alta screen on the east block's corner over the forecourt */
  api.prop(videoScreen({ w: 11.2, h: 5.6, px: [768, 384], x: -23.45, y: 5.65, z: -2.6, ry: -Math.PI / 2, frame: 0.32 })).castShadow = false;
  // (east of the corner's blade signs at x 14, over the shop signs)
  api.prop(videoScreen({ w: 6.67, h: 4, px: [640, 384], x: 19.3, y: 5.6, z: -33.3, ry: Math.PI, offset: 17.3, frame: 1.28 })).castShadow = false;
  // and the hall's two, facing each other across the dance floor over the
  // booths under the arms: the pole dancer then @Troll_'s coin on the north
  // wall, @SwishPng's leaping trolls on the south (kabukigrin-under.js SCREENS)
  api.prop(videoScreen({ w: SCREENS.w, h: SCREENS.h, px: [768, 432], x: SCREENS.pole.x, y: FL + SCREENS.y, z: HALL.z0 + 0.06, ry: 0, clips: ["pole", "coin"], fps: 24 })).castShadow = false;
  api.prop(videoScreen({ w: SCREENS.w, h: SCREENS.h, px: [640, 360], x: SCREENS.swish.x, y: FL + SCREENS.y, z: HALL.z1 - 0.06, ry: Math.PI, clips: ["swish"], fps: 24 })).castShadow = false;
}

/* The Blender models (build_kabukigrin.blender.py): each lit by its own
   bake (kb-neon is the light, not lit), the club's pieces as their Studio
   keys say; then the photo surfaces and the fronts' grain. */
const MODELS = ["kb-shell", "kb-props", "kb-neon"];
const MODELS_V = "kbb9";
function loadModels(api) {
  // settles once every model is placed (or failed): the wet floors' probes wait for it
  return Promise.all(MODELS.map((file) => new Promise((done) => {
    loader.load(`${URL_GLB}${file}.glb?v=${MODELS_V}`, (gltf) => {
      const baked = [];
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.receiveShadow = true;
        if (BAKED[file]) baked.push(o);
        // which part of the GLB: "gj" (Grinjuku's, baked), "kb" (Studio's
        // Parts), "hero" (Studio's generated pieces), "kbp" (the club's props)
        let part = o;
        while (part.parent && part.parent !== gltf.scene) part = part.parent;
        const key = o.material.name;
        if (!/^gj/.test(part.name)) {
          if (!/^(glb|gen):/.test(key)) { o.castShadow = file !== "kb-neon"; return; }
          // a club piece: "<kind>:<gj model>:<material>|<tint>|<shadow>..."
          const [k, , shadow] = key.split("|");
          const [kind, src, name] = k.split(":");
          if (kind === "glb") o.material.name = name;   // retexture's rules go by the Blender name
          o.castShadow = shadow !== "0" && src !== "gj-neon";
          return;
        }
        o.castShadow = file !== "kb-neon";
      });
      // the club that stood on the street is gone: its walls, props and signs
      // cut from the model, the square left open (kabukigrin-under.js)
      cutOldClub(gltf.scene);
      (BAKED[file] ? loadBake(file) : Promise.resolve(null)).then((bake) => {
        if (bake) for (const o of baked) applyBakedLightMap(o, bake, BAKED[file]);
        // the club's dark wood (the slats, the bar's front) takes the hall's
        // red wash, as the slatted panels behind it do (clubInterior)
        const wood = [];
        gltf.scene.traverse((o) => { if (o.isMesh && o.material?.name === "KB_Wood") wood.push(o); });
        retexture(gltf.scene, KB_RETEXTURE);
        lightParlour(gltf.scene);
        for (const o of wood) clubFx(o.material, { wash: { color: 0xff2a3a, top: 3.2, strength: 0.5 } });
        gltf.scene.traverse((o) => { if (o.isMesh && o.material?.name === "GS_Paint") paintDetail(o.material, "kbfront", 0.45, 0.7); });
        clubOnTop(gltf.scene);
        api.prop(gltf.scene);
      }).finally(done);
    }, undefined, (e) => { console.warn(`Kabukigrin: ${file} didn't load`, e); done(); });
  })));
}

/* Where the club was laid over Grinjuku, some of its faces sit on
   Grinjuku's own (the mezzanine's walls: a fraction of a millimetre
   apart), and the two took turns showing as the camera moved: whole wall
   panels flickering (user, 2026-10-26). The club's pieces win the depth
   test there; a material Grinjuku's part shares is copied first, so
   Grinjuku keeps its own. */
function clubOnTop(scene) {
  const partOf = (o) => { while (o.parent && o.parent !== scene) o = o.parent; return o; };
  const gjMats = new Set(), club = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    if (/^gj/.test(partOf(o).name)) gjMats.add(o.material);
    else club.push(o);
  });
  const copies = new Map();
  for (const o of club) {
    let m = o.material;
    if (gjMats.has(m)) {
      if (!copies.has(m)) {
        const c = m.clone();
        // (clone leaves the shader hooks behind: clubFx, paintDetail)
        c.onBeforeCompile = m.onBeforeCompile;
        c.customProgramCacheKey = m.customProgramCacheKey;
        copies.set(m, c);
      }
      m = o.material = copies.get(m);
    }
    Object.assign(m, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  }
}

function buildKabukigrin(api) {
  // (the pachinko parlour's room opens the edge wall and its front: its own
  // colliders, the doors shut but in Socialize: kabukigrin-street.js)
  // (the old club's, in the square now, are dropped: kabukigrin-under.js)
  for (const c of L.colliders) {
    const [x, z, w, d, h, y, pen] = c;
    if (!parlourWall(c) && !inOldHall(x, z, y)) api.ghostBox(x, z, w, d, h, { y, pen });
  }
  // the roof slab spanned the hall and A Heaven: A Heaven keeps its part
  api.ghostBox(-10, 14, 8, 20, 0.6, { y: 7.4, pen: 20 });
  parlourColliders(api);
  // and what the Blender props need (build_kabukigrin.blender.py)
  for (const [x, z, w, d, h, y, pen] of KB_PROPS.colliders) if (!inOldHall(x, z, y)) api.ghostBox(x, z, w, d, h, { y, pen });
  // the dug club: the square's slab, the hall, the balcony, the stairs
  for (const [x, z, w, d, h, y, pen] of underColliders()) api.ghostBox(x, z, w, d, h, { y, pen });
  api.stairLinks.push(...STAIRS.map((s) => ({ a: { ...s.a }, b: { ...s.b } })), ...Object.values(UNDER_STAIRS).map(stairLink));
  for (const r of ROPES) api.rope(r.x, r.z, r.y0, r.y1, { dir: r.dir, ghost: true });
  const models = loadModels(api);
  // the game's ground plane (made before build) gets the stairs' wells
  const probe = api.prop(new THREE.Group()), top = probe.parent;
  top.remove(probe);
  const ground = top.children.find((o) => o.isMesh && o.geometry.type === "PlaneGeometry");
  if (ground) {
    groundHole(ground, WELLS);
    // A Main's rain (doc phase 1): pools and run-off on its asphalt, the
    // marquee and the pachinko sign caught in them
    wetFloor(ground.material, { rect: A_MAIN, cover: 0.5, scale: 2.6, edge: 1.2, pool: 0.04, dry: 0.85, dark: 0.68, env: 1.0,
      probe: { at: [(A_MAIN[0] + A_MAIN[2]) / 2, 1.6, -14], box: [A_MAIN[0] - 0.6, -0.1, A_MAIN[1] - 4, A_MAIN[2] + 0.6, 22, A_MAIN[3] + 4] } });
  }
  buildClub(api);
  // each wet floor's reflection probe, on one mesh of it
  const wet = new Set();
  top.traverse((o) => {
    if (o.isMesh && o.material?.userData?.wetProbe && !wet.has(o.material)) { wet.add(o.material); hangProbe(o, { when: models }); }
  });
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
const cast = () => (CAST ??= kbNpcs({ DC, DANCE, deck: DECK }));

export const KABUKIGRIN = {
  ...GRINJUKU,
  // the street: the photo asphalt, Grinjuku's lane lines printed on it at the old texture's brightness
  ground: { ...GRINJUKU.ground, surface: "kbasph" },
  // the bake (phase 4): the ground's own, and hemi and ambient halved again,
  // the club's lights being in the light maps now
  groundBake: GROUND_BAKE,
  hemi: { ...GRINJUKU.hemi, intensity: 0.55 },
  ambient: { ...GRINJUKU.ambient, intensity: 0.11 },
  // (a touch more exposure: the streets came out a tenth darker on half the hemi)
  exposure: 1.4,
  grade: { ...GRINJUKU.grade },
  /* Haze (view/post-look.js; doc phase 4: neon reads better through it): a
     low fog on the hall's floor, as off a smoke machine, thinning up to the
     mezzanine, and a ground haze on the wet Mains */
  // the dug ground (core/ground-field.js): the hall's floor under the square
  groundField: groundField(),
  // the club's UV tubes light the white faces (view/blacklight.js; doc pick 5):
  // a player is always findable down there
  blacklight: { box: [HALL.x0, FL - 0.5, HALL.z0, HALL.x1, CEIL, HALL.z1], k: 1.6 },
  haze: [
    { box: [HALL.x0, FL, HALL.z0, HALL.x1, CEIL, HALL.z1], color: 0x1a0a1c, density: 0.07, falloff: 2.6, edge: 0.3 },
    { box: [A_MAIN[0], 0, A_MAIN[1], A_MAIN[2], 3, A_MAIN[3]], color: 0x2c1c44, density: 0.08, falloff: 0.8, edge: 1.5 },
    { box: [23.3, 0, -31.6, 31.4, 3, 3.6], color: 0x2c1c44, density: 0.07, falloff: 0.8, edge: 1.5 },
  ],
  name: "Kabukigrin",
  blurb: "Kabukicho after midnight. Trolling Loud's Tokyo branch on one side of the street, the alleys on the other, and a bomb site on the dance floor.",
  playerSpawn: { x: PLAYER[0], z: PLAYER[2] },
  build: buildKabukigrin,
  dress: DRESS,
  // A on the dance floor, down in the club (doc pick 1)
  bombSites: SITES.map((s) => (s.id === "A" ? { ...s, x: DC.x, y: FL, z: DC.z } : s)),
  spawns: SPAWNS,
  // the koi tank and the office's mirror first, then the club's signs and bottles
  onShot: (p) => { if (!roomsShot(p)) CLUB.onShot(p); },
  attachAudio: CLUB.attachAudio,
  attachMusic: CLUB.attachMusic,
  // the club's clock and lights, the pachinko parlour's din, the train
  onFrame: (f) => { CLUB.onFrame(f); streetSound(CLUB.sfx, f?.live); trainFrame(CLUB.sfx, f?.live ? U.uPlayer.value : null); },
  /* Socialize (doc 4.1): DJ Lulz at the booth, requests from the floor in
     front of the stage; the door, the crowd and the seats */
  dj: { name: "DJ Lulz", spot: { x: -27.6, z: DECK.z, y: FL, reach: 3.4 }, club: { ...HALL, y: FL, top: CEIL }, input: CLUB.songInput },
  rp: {
    npcs: () => cast(),
    seats: () => kbFreeSeats(cast()),
    beat: () => U.uBeatPos.value,
    npcShadows: false,
    view: KB_VIEW,
    door: KB_DOOR,
    // the pachinko parlour (modes/social-pachinko.js): its machines, who plays, its bounds
    pachinko: () => ({ machines: MACHINES, play: PLAY, minX: PARLOUR.minX }),
  },
  // the obstruction test's additions to models/kabukigrin-faces.json (the dug club and its signs)
  facesMore: () => {
    const u = underFaces(), s = signFaces();
    return { ...u, faces: [...u.faces, ...s.faces], props: [...u.props, ...s.props] };
  },
  debug: () => ({ ...CLUB.debug(), rooms: roomsDebug(), ropes: ROPES.map((r) => ({ ...r })), sites: KABUKIGRIN.bombSites.map((s) => ({ ...s })), under: { FL, B1, CEIL } }),
};
