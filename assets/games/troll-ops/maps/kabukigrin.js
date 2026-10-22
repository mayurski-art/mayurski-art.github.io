// Troll Forces — "Kabukigrin" (doc docs/KABUKIGRIN.md): Grinjuku with
// Trolling Loud's Tokyo branch in its A side. Laid out in Roblox Studio
// (Kabukigrin (edit).rbxl) and brought back by
// tools/troll-ops-map-from-studio.mjs --map kabukigrin --write as two files:
//   models/kb-town.glb      every still piece, one mesh per material, named
//                           "<key>|<tint>|<shadow>": a Grinjuku chunk's key
//                           is "glb:<its GLB>:<its material>" and it carries
//                           that GLB's material, its light-map UVs and paint
//   kabukigrin-layout.js    the colliders, the markers by name (spawns,
//                           sites, ropes, stairs) and the lights
// So the map is the Studio layout's, the look Grinjuku's: a chunk is lit by
// its own GLB's bake and retextured as that GLB is (map-models.js).
// On top of that the club's live layer, in code (club-live.js, as Trolling
// Loud's): the dance floor over its mirror pit, the DJ, the ceiling, the
// chandelier and ball, the bottle wall, the lasers, the clock and the
// booth's track; the seam pieces the street sees (the marquee, the kanji
// strip, the LED windows on Mid Bottom) and the two video screens
// (video-wall.js); the borrowed rooms' live bits (kabukigrin-rooms.js: the
// yokocho, the tatami VIP and its koi tank, the office's one-way mirror).
// Kept as kabukigrin_wip (out of the vote pool) until phase 6.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GRINJUKU } from "./grinjuku.js?v=gj1-sr1-or1";
import { KB_LAYOUT } from "./kabukigrin-layout.js?v=kb0-kb1-kb2-kb3-kb5-kb6";
import { mapModel, RETEXTURE } from "./map-models.js?v=hg6e-sr1-or1";
import { loadBake } from "./battlefield-props.js?v=sr1-or1";
import { applyBakedLightMap, retexture } from "./surface-textures.js?v=hg6e-sr1-or1";
import { Kit, place, surfMat, texMat } from "./trollcity-kit.js?v=tc2-wst-tc3-sh1-sr1-pf1-or1-tcs1";
import { Neon, neonMat, clubFx, cutRects, slatTexture, mosaicTexture } from "./trollingloud-kit.js?v=tl3-tc3-sh1-sr1-or1-tcs1";
import { newState, sign, addLight, danceFloor, djStage, hallCeiling, chandelier, bottleWall, finishClub, clubEngine, clubMaterials } from "./club-live.js?v=cl1-kb4-kb6";
import { videoScreen } from "./video-wall.js?v=vw1-kb4-kb5";
import { buildRooms, roomsShot, roomsDebug } from "./kabukigrin-rooms.js?v=kb6-kb8";

const URL_GLB = new URL("../models/", import.meta.url).href;
const loader = new GLTFLoader();
// the GLBs whose chunks are light-mapped, and how strongly (battlefield-props BAKED)
const BAKED = { "gj-shell": Math.PI, "gj-props": Math.PI, "gj-skyline": Math.PI };

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

/* Cut the dance floor's rectangle out of everything flat at y 0 in `obj`
   (the town's floors, the game's ground plane), so the mirror pit under
   the glass shows through. Triangles that cross the edge are clipped;
   every attribute is carried over. */
function cutDanceFloor(obj, R = DANCE) {
  obj.updateMatrixWorld(true);
  const meshes = [];
  obj.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const box = new THREE.Box3();
  for (const o of meshes) {
    box.setFromObject(o);
    if (box.max.x < R.x0 || box.min.x > R.x1 || box.max.z < R.z0 || box.min.z > R.z1 || box.min.y > 0.06 || box.max.y < -0.06) continue;
    const src = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    src.applyMatrix4(o.matrixWorld);
    const names = Object.keys(src.attributes), A = names.map((k) => src.attributes[k]);
    const sizes = A.map((a) => a.itemSize), width = sizes.reduce((a, b) => a + b, 0);
    const vert = (i) => {
      const v = new Float32Array(width);
      let w = 0;
      for (const a of A) for (let c = 0; c < a.itemSize; c++) v[w++] = a.getComponent(i, c);
      return v;
    };
    // the part of polygon `poly` where f(v) >= 0 (f linear in position)
    const clip = (poly, f) => {
      const out = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b);
        if (fa >= 0) out.push(a);
        if ((fa >= 0) !== (fb >= 0)) {
          const t = fa / (fa - fb), v = new Float32Array(width);
          for (let k = 0; k < width; k++) v[k] = a[k] + (b[k] - a[k]) * t;
          out.push(v);
        }
      }
      return out;
    };
    const west = (v) => R.x0 - v[0], east = (v) => v[0] - R.x1;
    const inX = (p) => clip(clip(p, (v) => v[0] - R.x0), (v) => R.x1 - v[0]);
    const kept = [];
    let cut = false;
    for (let t = 0; t < src.attributes.position.count; t += 3) {
      const tri = [vert(t), vert(t + 1), vert(t + 2)];
      const xs = tri.map((v) => v[0]), zs = tri.map((v) => v[2]);
      if (!tri.every((v) => Math.abs(v[1]) < 0.06) || Math.max(...xs) <= R.x0 || Math.min(...xs) >= R.x1 || Math.max(...zs) <= R.z0 || Math.min(...zs) >= R.z1) { kept.push(tri); continue; }
      cut = true;
      for (const p of [clip(tri, west), clip(tri, east), clip(inX(tri), (v) => R.z0 - v[2]), clip(inX(tri), (v) => v[2] - R.z1)]) {
        for (let i = 1; i + 1 < p.length; i++) kept.push([p[0], p[i], p[i + 1]]);
      }
    }
    if (!cut) { src.dispose(); continue; }
    const g = new THREE.BufferGeometry();
    let off = 0;
    names.forEach((k, ai) => {
      const size = sizes[ai], arr = new Float32Array(kept.length * 3 * size);
      let w = 0;
      for (const tri of kept) for (const v of tri) for (let c = 0; c < size; c++) arr[w++] = v[off + c];
      g.setAttribute(k, new THREE.Float32BufferAttribute(arr, size));
      off += size;
    });
    g.applyMatrix4(o.matrixWorld.clone().invert());
    g.computeBoundingSphere();
    o.geometry.dispose();
    o.geometry = g;
    src.dispose();
  }
}

/* Grinjuku's own street dressing where the club's walls now are: the
   shop signs, awnings and lightboxes on the facades that became the hall's
   walls, and the blade sign on Mid Bottom's wall where the club's trollface
   goes. Every triangle wholly inside a box goes (bar the ground's, flat at
   y 0); Studio's new pieces (their
   key ends "|n") and its generated props ("gen:") stay. */
const CLEAR = [
  [-31.75, -14.25, -0.01, 7.45, 3.9, 5.6],   // the hall's north wall, inside, down to the floor
  [-31.75, -30.7, 0.05, 7.45, 4, 23.8],      // its west wall, behind the DJ
  [-31.75, -14.4, 0.05, 7.45, 23, 24.1],     // its south wall
  [-14.7, -13.6, 0.05, 3.6, 4, 23.8],        // the bar's wall under the mezzanine, its parapet's signs
  [-6.2, -4.4, 0.05, 8.8, 13.6, 14.4],       // the blade sign on Mid Bottom's wall
  [-24.6, -22.85, 2.7, 8.6, -8.35, 3.25],    // the A Main screen's footprint: the windows, lightboxes and shop signs on that face
  [15.8, 22.8, 3.45, 7.75, -32.6, -31.85],   // the Alta screen's
  [-31.75, -24.2, 0.31, 6.0, 24.2, 29.85],   // the tatami room's inside: the backs' windows and signs on the edge wall
];
function clearForClub(scene) {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    let q = o;
    while (q && !q.userData.tc) q = q.parent;
    if (/\|n$|^gen:/.test(q?.userData.tc || o.name)) return;
    const g = o.geometry, P = g.attributes.position;
    const I = g.index ?? { count: P.count, getX: (i) => i };
    o.updateMatrixWorld(true);
    const v = new THREE.Vector3(), keep = [];
    const inBox = (i) => {
      v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld);
      return CLEAR.findIndex(([x0, x1, y0, y1, z0, z1]) => v.x >= x0 && v.x <= x1 && v.y >= y0 && v.y <= y1 && v.z >= z0 && v.z <= z1);
    };
    const flat = (t) => [0, 1, 2].every((k) => Math.abs(v.fromBufferAttribute(P, I.getX(t + k)).applyMatrix4(o.matrixWorld).y) < 0.02);
    let dropped = 0;
    for (let t = 0; t < I.count; t += 3) {
      const a = inBox(I.getX(t));
      if (a >= 0 && a === inBox(I.getX(t + 1)) && a === inBox(I.getX(t + 2)) && !flat(t)) { dropped++; continue; }
      keep.push(I.getX(t), I.getX(t + 1), I.getX(t + 2));
    }
    if (dropped) g.setIndex(keep);
  });
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

  K.flush();
  N.flush();
  HN.flush();
  for (const l of lights) root.add(l);
  // (the lasers stop at the hall's walls: the tatami room and the office lie past them)
  finishClub(root, M, HN, S, CLUB, { clip: { x0: HALL.x0, x1: -13.7, z0: 3.9, z1: 24 } });

  /* ---- the video screens, Times Square billboards (refs/times-square-
     screens-*.jpg): each in a housing built out from its facade past every
     window frame, ledge and sign on it, so nothing stands in front, the shop
     signs in its way cleared (CLEAR). The club's over the Sewers' mouth on
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

/* The Studio town: each mesh gets its GLB's material, light map and texture. */
function loadTown(api) {
  loader.load(`${URL_GLB}${L.glb}.glb?v=${L.v}`, (gltf) => {
    const todo = [];
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      let q = o;
      while (q && !q.userData.tc) q = q.parent;
      const [key, , shadow] = (q?.userData.tc || o.name).split("|");
      const [kind, file, name] = key.split(":");
      if (kind !== "glb") return;
      o.material.name = name;   // retexture's rules go by the Blender name
      o.castShadow = shadow !== "0" && file !== "gj-neon";
      o.receiveShadow = true;
      todo.push([o, file]);
    });
    const files = [...new Set(todo.map(([, f]) => f))];
    Promise.all(files.map((f) => (BAKED[f] ? loadBake(f) : Promise.resolve(null)))).then((bakes) => {
      const bakeOf = new Map(files.map((f, i) => [f, bakes[i]]));
      for (const [o, file] of todo) {
        const bake = bakeOf.get(file);
        if (bake) applyBakedLightMap(o, bake, BAKED[file]);
      }
      retexture(gltf.scene, RETEXTURE);
      cutDanceFloor(gltf.scene);
      clearForClub(gltf.scene);
      api.prop(gltf.scene);
    });
  }, undefined, (e) => console.warn("Kabukigrin: the Studio town didn't load", e));
}

function buildKabukigrin(api) {
  for (const [x, z, w, d, h, y, pen] of L.colliders) api.ghostBox(x, z, w, d, h, { y, pen });
  api.stairLinks.push(...STAIRS.map((s) => ({ a: { ...s.a }, b: { ...s.b } })));
  for (const r of ROPES) api.rope(r.x, r.z, r.y0, r.y1, { dir: r.dir, ghost: true });
  loadTown(api);
  // the game's ground plane (made before build) gets the same hole
  const probe = api.prop(new THREE.Group()), top = probe.parent;
  top.remove(probe);
  const ground = top.children.find((o) => o.isMesh && o.geometry.type === "PlaneGeometry");
  if (ground) cutDanceFloor(ground);
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
  return { ...d, decals: d.decals.map(keep).filter(Boolean), clutter: d.clutter.map(keep).filter(Boolean) };
})();

export const KABUKIGRIN = {
  ...GRINJUKU,
  name: "Kabukigrin",
  blurb: "Shinjuku's neon on one side, a nightclub on the other.",
  playerSpawn: { x: PLAYER[0], z: PLAYER[2] },
  build: buildKabukigrin,
  dress: DRESS,
  bombSites: SITES,
  spawns: SPAWNS,
  // the koi tank and the office's mirror first, then the club's signs and bottles
  onShot: (p) => { if (!roomsShot(p)) CLUB.onShot(p); },
  attachAudio: CLUB.attachAudio,
  attachMusic: CLUB.attachMusic,
  onFrame: CLUB.onFrame,
  debug: () => ({ ...CLUB.debug(), rooms: roomsDebug(), ropes: ROPES.map((r) => ({ ...r })), sites: SITES.map((s) => ({ ...s })) }),
};
