// Troll Forces: the blocky body, worn in game as the TROLLS #1718 "Body"
// cosmetic (cosmetics.js, account-locked; wearBlocky at the bottom) and
// compared with the stick in tools/trait-preview.html. The user, 2026-10-11:
// "what if we made it look like roblox character ... lets keep the live
// stick figure for now and try building this".
//
// Blocks ride the live rig's joints, so the whole gait, lean, emotes and arm
// IK move them; the ink stick, its mitts and the flat face board are hidden.
// Clothes are drawings wrapped onto the blocks (the way a blocky avatar's
// shirt is a flat template): the TROLLS garment art (traits/<id>.png, the
// garment frame) cropped onto the torso's front and back faces. The face art
// goes on the front of a block head; the cap is a block with its print.
// The rig wants { build: 0.25, legs: 0.67 } (arms hanging straight, shorter
// legs): built that way (the preview) or reshaped in place (wearBlocky).

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { setClothed, setHips, reshapeRig } from "./character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1m1u-gt1-gt2-bk1-cw1-zr10";
import { applyToken, removeToken } from "./traits.js?v=bk1-cw1-zr10";

const DIR = new URL("./traits/", import.meta.url);
const ART_V = globalThis.TRAITS_BUST ?? "tr1";
const FRAME = { w: 1000, h: 1167, spine: 500, chest: 233, unit: 1667 };   // the garment frame

const SKIN = 0xf3f3ef, INK = 0x0a0a0a;
const B = {
  torso: { w: 0.4, d: 0.2, top: 0.04, mid: -0.26 },   // the chest block, chest-local y
  lowerTop: 0.27,                                      // the hip block, hips-local y 0..this
  arm: 0.13, leg: 0.2,   // leg: half the torso's width, its full depth
  head: { w: 0.48, d: 0.38, bottom: -0.05, top: 0.48 },   // headPivot-local (blockHead only)
};
/* The board head's size on the block body: 0.48 m wide x 0.6 = ~0.29, a
   blocky avatar's head-to-torso ratio. */
const HEAD_SCALE = 0.69;   // 0.6, then 15% bigger (user) so the face reads
/* Where the rifle's stock sits (chest-local, metres at scale 1: x out to
   the right, y up, z forward is -) and how big the gun is drawn. */
// blade: the upper body turned into the gun (radians); roll: the left
// shoulder brought forward (metres), so the left hand reaches the handguard;
// under: the left fist grips the handguard from below (on its top, the fist
// stood up into the sight line; user: "the hand should not be covering the
// aim site")
// runX: the stock's x on the run, when the body doesn't blade (it runs
// square to the aim), in toward the middle so the left hand still reaches
// lean: how much of the stick's run lean the body keeps with the gun up
// (all of it slanted the block torso; user: "too slanted here")
const GUN_HOLD = { x: 0.15, y: -0.08, z: -0.1, scale: 1.15, blade: 0.38, roll: 0.07, under: 0.075, runX: 0.06, lean: 0.25 };

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, emissive: color, emissiveIntensity: 0.4, ...extra });
}
const edgeMat = new THREE.LineBasicMaterial({ color: INK });
/* Three flat tones, a comic's shading. */
const TONES = (() => {
  const t = new THREE.DataTexture(new Uint8Array([120, 120, 120, 255, 190, 190, 190, 255, 255, 255, 255, 255]), 3, 1);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
/* Softer tones for printed cloth: on the lime tank the deep shadow band
   read as dark stains. */
const CLOTH_TONES = (() => {
  const t = new THREE.DataTexture(new Uint8Array([175, 175, 175, 255, 220, 220, 220, 255, 255, 255, 255, 255]), 3, 1);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
function toon(color) {
  return new THREE.MeshToonMaterial({ color, gradientMap: TONES, emissive: color, emissiveIntensity: 0.12 });
}
/* A drawing, lit like the face board: it lights itself with its own colours
   (a flat white glow washed everything out). */
function drawn(map, extra = {}) {
  return new THREE.MeshStandardMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.55, roughness: 0.8, ...extra });
}
/* A box with ink edges (or none: the torso's are drawn in its template, so
   the two halves meet without a line across the middle). */
function block(w, h, d, materials, edges = true) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(geo, materials);
  m.castShadow = true;
  if (edges) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
  return m;
}
/* A limb block from a joint along `to` (that joint's child's position),
   `over` metres past its start and `overEnd` (default the same) past its end. */
function limb(parent, to, size, material, over = 0, overEnd = over) {
  const len = to.length();
  const m = block(size, len + over + overEnd, size, material);
  m.position.copy(to).multiplyScalar(0.5 + (overEnd - over) / 2 / len);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().normalize());
  parent.add(m);
  return m;
}

/* A drawing on a white ground (transparent bits are skin), cropped to the
   part of the frame a face covers: x0..x1, y0..y1 in frame units. */
function croppedTexture(file, [x0, y0, x1, y1], frameW, frameH, ground = "#f3f3ef") {
  const c = document.createElement("canvas");
  c.width = Math.round(x1 - x0); c.height = Math.round(y1 - y0);
  const g = c.getContext("2d");
  g.fillStyle = ground; g.fillRect(0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  const img = new Image();
  img.onload = () => { g.drawImage(img, x0 * img.width / frameW, y0 * img.height / frameH, (x1 - x0) * img.width / frameW, (y1 - y0) * img.height / frameH, 0, 0, c.width, c.height); t.needsUpdate = true; };
  img.src = file;
  return t;
}

/* The torso block's faces for one garment, from its block template
   (traits/src/<id>.block.svg: front, back, right and left side regions,
   1 unit a millimetre, y 0 the torso's top): rows y0..y1 of each region.
   Box face order: [+x (right), -x (left), +y, -y, +z (back), -z (front)]. */
const TEMPLATE = { w: 1200, h: 760, front: [0, 400], back: [400, 800], right: [800, 1000], left: [1000, 1200] };
function torsoFaces(garment, y0, y1) {
  const skin = mat(SKIN), shorts = mat(0x34363e);
  if (!garment) return [skin, skin, skin, shorts, skin, skin];
  const url = new URL(`${garment}.block.png?v=${ART_V}`, DIR).href;
  const face = ([x0, x1]) => drawn(croppedTexture(url, [x0, y0, x1, y1], TEMPLATE.w, TEMPLATE.h));
  return [face(TEMPLATE.right), face(TEMPLATE.left), skin, shorts, face(TEMPLATE.back), face(TEMPLATE.front)];
}

/* The face on the front of the block head: the face art where the board
   was (headPivot y 0.03..0.48), skin below and around. */
function faceTexture() {
  const H = B.head, px = 1000;
  const c = document.createElement("canvas");
  c.width = H.w * px; c.height = (H.top - H.bottom) * px;
  const g = c.getContext("2d");
  g.fillStyle = "#f3f3ef"; g.fillRect(0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  const img = new Image();
  img.onload = () => { g.drawImage(img, 0, (H.top - 0.48) * px, 0.48 * px, 0.45 * px); t.needsUpdate = true; };
  img.src = new URL("../../images/wallpaper/trollface%20transparent.png", import.meta.url).href;
  return t;
}

function capPrint(text) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 140;
  const g = c.getContext("2d");
  g.fillStyle = "#151517"; g.fillRect(0, 0, 512, 140);
  g.font = "bold 92px Impact, 'Arial Narrow Bold', sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillStyle = "#f4f4f1";
  g.fillText(text, 256, 76, 470);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* The muscular arms (models/build_blocky_arms.blender.py -> blocky/arms-muscle.glb):
   blocky muscle masses, each piece "<joint><S>__<muscle>" authored in its
   joint's frame, bone straight down -Y, at scale 1 with these bone lengths. */
const glb = (file) => new URL(`./models/blocky/${file}?v=${globalThis.TRAITS_BUST ?? "bb1"}`, import.meta.url).href;
const ARMS_GLB = glb("arms-muscle.glb"), TORSO_GLB = glb("torso-muscle.glb"), LEGS_GLB = glb("legs-muscle.glb");
const HEAD_GLB = glb("head-relief.glb");
/* The trollface with a little depth (models/build_blocky_head.blender.py):
   how far its dome stands in front of the board and its skull behind, so
   the drawn head traits (traits.js planes) move out onto them. */
const RELIEF = { front: 0.045, back: 0.075 };   // front: the dome plus the sculpted brow and upper lip under the cap and moustache
const ARM_BONES = { arm: 0.30, elbow: 0.325 };
const FIST_BACK = -0.058;   // the fist (0.125 long, down from the wrist) moved back up the forearm by half
/* A Blender piece set: [{ name, geo, hull }], each with its ink shell (the
   piece pushed out along smooth normals, drawn inside out). Once per file. */
const pieceSets = new Map();
function loadPieces(url) {
  if (!pieceSets.has(url)) pieceSets.set(url, new GLTFLoader().loadAsync(url).then((gltf) => {
    const out = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const named = o.name.includes("__") ? o : o.parent;
      const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
      const hull = mergeVertices(new THREE.BufferGeometry().setAttribute("position", geo.attributes.position.clone()).setIndex(geo.index?.clone() ?? null), 1e-4);
      hull.computeVertexNormals();
      // every rig wearing the body shares these (remote-players.js dispose skips them)
      geo.userData.shared = hull.userData.shared = true;
      out.push({ name: named.name, geo, hull, mat: o.material?.name || "" });
    });
    return out;
  }));
  return pieceSets.get(url);
}
const loadArms = () => loadPieces(ARMS_GLB);
const INK_PUSH = 0.0055;
const armInk = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
armInk.userData.shared = true;
armInk.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader.replace("#include <begin_vertex>",
    // (unit normals from computeVertexNormals; a zeroed one means no ink push there)
    `#include <begin_vertex>\n  transformed += normal * ${INK_PUSH.toFixed(4)};`);
};

/* Hang the muscle pieces on `rig`'s arm joints: each lined up with its live
   bone and stretched to its length. Returns the added objects. */
function muscleArms(rig, material) {
  const p = rig.parts, s = rig.scale;
  return loadArms().then((pieces) => {
    const added = [];
    for (const { name, geo, hull } of pieces) {
      const [jname, muscle] = name.split("__");
      const kind = jname.slice(0, -1), side = jname.slice(-1);
      const joint = kind === "hand" ? p[`wrist${side}`].parent : p[`${kind}${side}`];
      // the bone this piece hangs along: to the joint's child (the hand
      // carries on along the forearm)
      const bone = kind === "arm" ? p[`elbow${side}`].position
        : p[`wrist${side}`].parent.position;
      const g = new THREE.Group();
      g.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), bone.clone().normalize());
      const stretch = kind === "hand" ? 1 : bone.length() / (ARM_BONES[kind] * s);
      g.scale.set(s, s * stretch, s);
      // The fist is centred on the hand point, not hung below it: that point
      // is where the rig puts a gun's grip (and the support hand on the
      // handguard), so the gun runs through the fist instead of past it.
      if (kind === "hand") g.position.copy(bone).normalize().multiplyScalar(FIST_BACK * s);
      const m = new THREE.Mesh(geo, material);
      m.castShadow = true;
      m.name = muscle;
      g.add(m, new THREE.Mesh(hull, armInk));
      joint.add(g);
      added.push(g);
    }
    return added;
  });
}

/* The muscular legs (models/build_blocky_legs.blender.py -> blocky/legs-muscle.glb):
   "thigh<S>__*" on the hip's splay joint (the knee's parent), "knee<S>__*"
   on the knee, each stretched to its live bone like the arms; "ankle<S>__*"
   (the sneaker) on the ankle as it is. Shorts and shoes in their own colours,
   the rest skin. Returns the added objects. */
const LEG_BONES = { thigh: 0.30, knee: 0.295 };
function muscleLegs(rig, colours) {
  const p = rig.parts, s = rig.scale;
  const mats = new Map();
  const matOf = (key) => {
    if (!mats.has(key)) mats.set(key, toon(colours[key] ?? SKIN));
    return mats.get(key);
  };
  return loadPieces(LEGS_GLB).then((pieces) => pieces.map(({ name, geo, hull }) => {
    const [jname, part] = name.split("__");
    const kind = jname.slice(0, -1), side = jname.slice(-1);
    const knee = p[`knee${side}`], ankle = p[`ankle${side}`];
    const joint = { thigh: knee.parent, knee, ankle }[kind];
    const g = new THREE.Group();
    const bone = { thigh: knee.position, knee: ankle.position }[kind];
    if (bone) {
      g.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), bone.clone().normalize());
      g.scale.set(s, s * bone.length() / (LEG_BONES[kind] * s), s);
    } else g.scale.setScalar(s);
    const m = new THREE.Mesh(geo, matOf(part));
    m.castShadow = true;
    m.name = part;
    g.add(m, new THREE.Mesh(hull, armInk));
    joint.add(g);
    return g;
  }));
}

/* A hat's drawing (traits.js: a flat plane in front of the face, and its
   back view behind the skull) shaped over the relief head like a cap: the
   plane bent onto an ellipsoid round the head, deeper than the head
   everywhere, closing to nothing at the cap's top edge, where the front
   and back drawings meet. (As flat cards, from the side the cap was two
   boards with the white top of the head between them; user: "fix the
   umadbro hat rendering".) In the plane's own frame its +z is outward
   (the front plane is turned to face forward), so the bend is +z for both. */
const CAP = { a: 0.32, b: 0.345, front: 0.056, back: 0.096, ink: "#151517" };   // ellipsoid half-width, half-height (to the cap's top), depths; the cap's colour
/* How far the cap stands out of the head pivot's middle at (x, y): an
   ellipsoid round the head that closes exactly at that column's top edge of
   the cap (`top`), so the front and back meet in a rounded crown there
   instead of a flat lid. */
const capDepth = (x, y, centreY, s, d, top) => {
  const b = y > centreY && top !== undefined ? Math.max(0.05 * s, top - centreY) : CAP.b * s;
  return d * s * Math.sqrt(Math.max(0, 1 - (x / (CAP.a * s)) ** 2 - ((y - centreY) / b) ** 2));
};

/* Bent, the drawings still had nothing between them: from the side the cap
   was a sliver. So the cap gets thickness, like the garment boards: its
   front drawing's silhouette, filled from the bent front drawing back to
   the bent back drawing (the back drawn over the cap's own black, so the
   whole silhouette is cap), walled round in that black. Built in the head
   pivot's frame from the hat's two drawings; the flat planes are hidden. */
function loadImage(url) {
  return new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
}
async function capVolume(id, plane, centreY, s) {
  const { width: w, height: h } = plane.geometry.parameters;
  const y0 = plane.position.y - h / 2;
  const [fImg, bImg] = await Promise.all([`${id}.png`, `${id}.back.png`].map((f) => loadImage(new URL(`${f}?v=${ART_V}`, DIR).href)));
  const W = 512, H = Math.round(512 * h / w);
  // The silhouette: the front drawing's alpha (u runs the front's way: the
  // front plane is turned round, so its u is 0.5 - x/w)
  const mc = document.createElement("canvas"); mc.width = W; mc.height = H;
  const mg = mc.getContext("2d", { willReadFrequently: true });
  mg.drawImage(fImg, 0, 0, W, H);
  const alpha = mg.getImageData(0, 0, W, H).data;
  const inside = (u, v) => {   // u, v: the front's uv, v up
    const i = Math.min(W - 1, Math.max(0, Math.floor(u * W))), j = Math.min(H - 1, Math.max(0, Math.floor((1 - v) * H)));
    return alpha[(j * W + i) * 4 + 3] > 128;
  };
  // The back drawing over the silhouette in black (mirrored: the back's u is 0.5 + x/w)
  const bc = document.createElement("canvas"); bc.width = W; bc.height = H;
  const bg = bc.getContext("2d");
  bg.save(); bg.translate(W, 0); bg.scale(-1, 1); bg.drawImage(mc, 0, 0); bg.restore();
  bg.globalCompositeOperation = "source-in"; bg.fillStyle = CAP.ink; bg.fillRect(0, 0, W, H);
  bg.globalCompositeOperation = "source-over"; bg.drawImage(bImg, 0, 0, W, H);
  const tex = (src) => { const t = src instanceof HTMLCanvasElement ? new THREE.CanvasTexture(src) : new THREE.Texture(src); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; return t; };
  const mats = [
    drawn(tex(fImg), { transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
    drawn(tex(bc), { transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
    mat(0x151517, { side: THREE.DoubleSide, emissiveIntensity: 0.25 }),
  ];
  // A grid over the plane; a cell is cap when its centre is inside the silhouette
  const N = 170, M = Math.round(N * h / w);
  const X = (i) => -w / 2 + (w * i) / N, Y = (j) => y0 + (h * j) / M;
  const uF = (x) => 0.5 - x / w, uB = (x) => 0.5 + x / w, V = (y) => (y - y0) / h;
  const mask = new Uint8Array(N * M);
  for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) mask[j * N + i] = inside(uF((X(i) + X(i + 1)) / 2), V((Y(j) + Y(j + 1)) / 2)) ? 1 : 0;
  const cell = (i, j) => i >= 0 && j >= 0 && i < N && j < M && mask[j * N + i] === 1;
  // The faces run a cell past the silhouette, so the drawings' own smooth
  // outlines (their alpha) make the cap's edge, not the grid's steps; the
  // walls stay on the grid, just inside, hidden behind them.
  const face = (i, j) => { for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (cell(i + di, j + dj)) return true; return false; };
  // each vertex column's top: the highest cap cell either side of it
  const colTop = [];
  for (let i = 0; i <= N; i++) {
    let t = 0;
    // (two cells either side: a face run past the silhouette still closes)
    for (const c of [i - 2, i - 1, i, i + 1]) for (let j = M - 1; j >= 0; j--) if (cell(c, j)) { t = Math.max(t, Y(j + 1)); break; }
    colTop.push(t);
  }
  const top = (x) => colTop[Math.round((x + w / 2) / w * N)];
  const zF = (x, y) => -(0.004 * s + capDepth(x, y, centreY, s, CAP.front, top(x)));
  const zB = (x, y) => 0.006 * s + capDepth(x, y, centreY, s, CAP.back, top(x));
  const pos = [], uv = [], groups = [[], [], []];
  const quad = (g, a, b, c, d) => { const n = pos.length / 3; for (const [p, t] of [a, b, c, d]) { pos.push(...p); uv.push(...t); } groups[g].push(n, n + 1, n + 2, n, n + 2, n + 3); };
  for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) {
    if (!face(i, j)) continue;
    const xs = [X(i), X(i + 1)], ys = [Y(j), Y(j + 1)];
    const f = (a, b) => [[xs[a], ys[b], zF(xs[a], ys[b])], [uF(xs[a]), V(ys[b])]];
    const k = (a, b) => [[xs[a], ys[b], zB(xs[a], ys[b])], [uB(xs[a]), V(ys[b])]];
    quad(0, f(0, 0), f(1, 0), f(1, 1), f(0, 1));
    quad(1, k(0, 0), k(0, 1), k(1, 1), k(1, 0));
    if (!cell(i, j)) continue;
    // walls where the silhouette ends
    const wall = (xa, ya, xb, yb) => quad(2,
      [[xa, ya, zF(xa, ya)], [0, 0]], [[xb, yb, zF(xb, yb)], [0, 0]], [[xb, yb, zB(xb, yb)], [0, 0]], [[xa, ya, zB(xa, ya)], [0, 0]]);
    if (!cell(i - 1, j)) wall(xs[0], ys[0], xs[0], ys[1]);
    if (!cell(i + 1, j)) wall(xs[1], ys[1], xs[1], ys[0]);
    if (!cell(i, j - 1)) wall(xs[1], ys[0], xs[0], ys[0]);
    if (!cell(i, j + 1)) wall(xs[0], ys[1], xs[1], ys[1]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  const index = [];
  groups.forEach((g, m) => { geo.addGroup(index.length, g.length, m); index.push(...g); });
  geo.setIndex(index);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mats);
  mesh.castShadow = true;
  mesh.renderOrder = 2;
  return mesh;
}

/* The face board swapped for the relief head (user: "There should be a
   little bit of 3d dept to the trollface"): the same art and outline, a
   shallow dome in front, a plain skull behind. Its face wears the board's
   own live material (so expressions and face cosmetics carry on); the board
   and the drawn skull back (traits.js) are hidden; the drawn traits move
   out onto the dome and the skull. Returns the added objects, and a
   function that puts it all back. */
function reliefHead(rig) {
  const p = rig.parts, s = rig.scale, board = p.head;
  return loadPieces(HEAD_GLB).then(async (pieces) => {
    // On the board itself (its turn undone), so it shows and hides with it
    // (the game sets the head's visibility: third person, cutscenes); the
    // board's own drawing is taken off the render layers instead.
    const g = new THREE.Group();
    g.rotation.y = -board.rotation.y;
    g.scale.setScalar(s);
    for (const { geo, hull, mat } of pieces) {
      const face = mat === "trollface";
      let use = geo;
      if (face) {
        // glTF's V runs from the top; the board's texture is a normal
        // flipY one (same as hero-bodies.js)
        use = geo.clone();
        const uv = use.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
      }
      // The face: shaded in bands like the body (the board's own material
      // lights itself so it reads flat, which hid the sculpting), wearing
      // the board's live art, followed when it changes (expressions)
      let look = toon(SKIN);
      if (face) {
        const art = board.material.map;
        look = new THREE.MeshToonMaterial({ map: art, emissive: 0xffffff, emissiveMap: art, emissiveIntensity: 0.22,
          gradientMap: CLOTH_TONES, transparent: true, alphaTest: 0.3 });
      }
      const m = new THREE.Mesh(use, look);
      if (face) m.onBeforeRender = () => {
        const bm = board.material, art = bm.map;
        if (look.map !== art) { look.map = look.emissiveMap = art; look.needsUpdate = true; }
        // the third-person aim ghosts the face out (view/third-person.js)
        look.opacity = bm.opacity;
        look.depthWrite = bm.depthWrite;
      };
      m.castShadow = true;
      g.add(m, new THREE.Mesh(hull, armInk));
    }
    board.add(g);
    const mask = board.layers.mask;
    board.layers.disableAll();
    if (rig.skull) rig.skull.visible = false;
    const moved = [], hidden = [];
    for (const [id, ms] of Object.entries(rig.traits?.byId || {})) {
      for (const grp of ms) {
        if (grp.parent !== p.headPivot) continue;
        if (id.startsWith("hat-")) {
          // the cap with thickness, in place of its two flat drawings
          const front = grp.children.find((c) => Math.abs(c.rotation.y - Math.PI) < 1e-3);
          if (!front) continue;
          const cap = await capVolume(id, front, board.position.y, s);
          p.headPivot.add(cap);
          grp.visible = false;
          hidden.push(grp);
          g.userData.cap = cap;
          continue;
        }
        for (const plane of grp.children) {
          const isFront = Math.abs(plane.rotation.y - Math.PI) < 1e-3;
          moved.push([plane, plane.position.z]);
          plane.position.z += (isFront ? -RELIEF.front : RELIEF.back) * s;
        }
      }
    }
    g.userData.undo = () => {
      board.layers.mask = mask;
      if (rig.skull) rig.skull.visible = true;
      for (const [plane, z] of moved) plane.position.z = z;
      for (const grp of hidden) grp.visible = true;
      g.userData.cap?.parent?.remove(g.userData.cap);
    };
    return [g];
  });
}

/* The muscular torso (models/build_blocky_torso.blender.py -> blocky/torso-muscle.glb):
   "chest__*" pieces on the chest joint, "torso__*" on the torso joint (it
   pivots at the hips), each UV-mapped onto the garment's block template, so
   the clothes drawing wraps the muscles. Returns the added objects. */
function muscleTorso(rig, garment) {
  const p = rig.parts, s = rig.scale;
  let material = toon(SKIN);
  if (garment) {
    const map = new THREE.TextureLoader().load(new URL(`${garment}.block.png?v=${ART_V}`, DIR).href);
    map.colorSpace = THREE.SRGBColorSpace;
    map.flipY = false;          // glTF UVs: v from the top
    map.anisotropy = 8;
    material = new THREE.MeshToonMaterial({ map, gradientMap: CLOTH_TONES, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.12 });
  }
  return loadPieces(TORSO_GLB).then((pieces) => pieces.map(({ name, geo, hull }) => {
    // The two halves overlap at the waist, below the RUNNER print (chest
    // -0.32..-0.26 = hips 0.16..0.22): no ink pushed out there, or each
    // half's rim draws a line across the belly through the other.
    if (!hull.userData.trimmed) {
      hull.userData.trimmed = true;
      const pos = hull.attributes.position, nrm = hull.attributes.normal;
      const inside = name.startsWith("chest") ? (y) => y < -0.305 : (y) => y > 0.165;
      for (let i = 0; i < pos.count; i++) if (inside(pos.getY(i))) nrm.setXYZ(i, 0, 0, 0);
    }
    const g = new THREE.Group();
    g.scale.setScalar(s);
    const m = new THREE.Mesh(geo, material);
    m.castShadow = true;
    m.name = name.split("__")[1];
    g.add(m, new THREE.Mesh(hull, armInk));
    p[name.split("__")[0]].add(g);
    return g;
  }));
}

/* Put the block body on `rig`. `look`: { garment: "clothes-tank-runner",
   tankColor, cap: "U MAD BRO?", moustache: true }. Returns a remover. */
export function applyBlocky(rig, look = {}) {
  const p = rig.parts, s = rig.scale;
  const added = [];
  const add = (parent, o) => { parent.add(o); added.push(o); return o; };
  // The head stays the trollface board (user: "roblox shape except the
  // head"), shrunk to a blocky avatar's proportions (about 0.6 of the
  // torso's width) and set down on the torso; its drawn traits (traits.js
  // head planes, the skull back) ride it. `blockHead` tries a block instead.
  const boardHead = !look.blockHead;
  const hide = boardHead ? [p.body] : [p.body, p.head];
  const pivotY = p.headPivot.position.y;
  if (boardHead) {
    p.headPivot.scale.setScalar(HEAD_SCALE);
    p.headPivot.position.y = 0.02 * s;
  }
  for (const o of hide) o.visible = false;
  for (const side of ["L", "R"]) rig.hands[side].group.traverse((o) => o.layers.disableAll());
  // The arms come out of the torso block's sides. The legs are each half
  // the torso's width and its full depth, side by side under it and
  // touching, an ink edge between them (from the stick's one hip point the
  // two blocks overlapped and read as one).
  setClothed(rig, B.torso.w / 2 + B.arm / 2);
  setHips(rig, B.torso.w / 4);
  // The gun hold (character.js _gripSupport): the stock in the right
  // shoulder pocket, out at the edge of the broad chest and in front of the
  // pecs (the stick's pocket, scaled by its build, landed in the middle of
  // this chest and buried the gun), the gun drawn bigger for the body.
  rig.gunHold = GUN_HOLD;
  // one rigid torso: its halves never twist against each other (character.js)
  rig.rigidTorso = true;

  // Blender pieces arrive a moment later (`restore.loaded` says when); a
  // body taken off before then drops them as they land.
  let dead = false;
  const pending = [];
  const later = (promise) => pending.push(promise.then((objs) => {
    if (dead) for (const o of objs) { o.userData.undo?.(); o.parent?.remove(o); }
    else added.push(...objs);
  }));
  // the face with a little depth (look.relief false: the flat board)
  if (boardHead && look.relief !== false) later(reliefHead(rig));

  // --- torso: the muscular one from Blender (look.torso "muscle", the
  // default), or ("block") a chest block on the chest joint and a hip block
  // on the torso joint (pivoting at the hips), so the body bends where the
  // spine does. Template rows: y 0 is the torso's top (chest + 0.04 m), 1 mm a unit.
  const T = B.torso;
  if ((look.torso ?? "muscle") === "muscle") later(muscleTorso(rig, look.garment));
  else {
  const row = (chestY) => (T.top - chestY) * 1000;
  const up = block(T.w * s, (T.top - T.mid) * s, T.d * s, torsoFaces(look.garment, row(T.top), row(T.mid)), false);
  up.position.y = ((T.top + T.mid) / 2) * s;
  add(p.chest, up);
  // The hip half sits a hair inside the chest half where they overlap, so
  // only one of them shows there.
  const lo = block(T.w * 0.995 * s, B.lowerTop * s, T.d * 0.995 * s, torsoFaces(look.garment, row(B.lowerTop - 0.48), row(-0.48)), false);
  lo.position.y = (B.lowerTop / 2) * s;
  add(p.torso, lo);
  // The torso's outline, drawn as ink edges round the whole of it: the
  // shoulders' top edges on the chest half, the hips' bottom on the hip half.
  const rim = (parent, y, w, d) => {
    const g = new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2));
    const l = new THREE.LineSegments(g, edgeMat);
    l.position.y = y;
    add(parent, l);
  };
  rim(p.chest, T.top * s + 0.001, T.w * s + 0.002, T.d * s + 0.002);
  rim(p.torso, -0.001, T.w * 0.995 * s + 0.002, T.d * 0.995 * s + 0.002);
  }

  // --- arms: the muscular ones from Blender (look.arms "muscle", the
  // default), or plain blocks ("block"): a block at the elbow so a bent arm
  // doesn't open a gap, and a hand block at the end. Skin either way: it's
  // a tank top. Cel-shaded, like a drawing: lit, half-tone and shadow bands,
  // so each muscle's planes read (the blocks' soft self-light flattened them).
  const skin = mat(SKIN), A = B.arm * s;
  if ((look.arms ?? "muscle") === "muscle") later(muscleArms(rig, toon(SKIN)));
  else for (const side of ["L", "R"]) {
    const elbow = p[`elbow${side}`], hand = p[`wrist${side}`].parent;
    added.push(limb(p[`arm${side}`], elbow.position, A, skin, 0.03 * s));
    added.push(limb(elbow, hand.position, A * 0.96, skin));
    add(elbow, block(A * 0.95, A * 0.95, A * 0.95, skin, false));
    const h = block(A * 0.9, A * 0.85, A * 0.9, skin);
    h.position.copy(hand.position).multiplyScalar(0.06 / hand.position.length() * s).add(hand.position);
    h.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), hand.position.clone().normalize());
    add(elbow, h);
  }

  // --- legs: the muscular ones from Blender (look.legs "muscle", the
  // default: running shorts to mid-thigh, bare muscled thighs and calves,
  // sneakers), or blocks ("block"): shorts on the thighs (the waistband
  // carries on from the torso), bare shins, black shoes
  const shorts = mat(look.shorts ?? 0x34363e), shoe = mat(0x111111);
  const L = B.leg * s;
  if ((look.legs ?? "muscle") === "muscle") {
    later(muscleLegs(rig, { shorts: look.shorts ?? 0x34363e, hem: 0x43464f, upper: 0x141416, sole: 0xdcdcd6 }));
  } else for (const side of ["L", "R"]) {
    const knee = p[`knee${side}`], ankle = p[`ankle${side}`];
    // the shorts reach up into the hips and stop at the knee; the shin
    // (narrower) runs on up inside them, so a bent knee doesn't open a gap
    added.push(limb(knee.parent, knee.position, L, shorts, 0.05 * s, 0));
    added.push(limb(knee, ankle.position, L * 0.97, skin, 0.07 * s, 0.01 * s));
    const foot = block(L * 0.98, 0.07 * s, 0.24 * s, shoe);
    foot.position.set(0, -0.015 * s, -0.05 * s);
    add(ankle, foot);
  }

  const restore = () => {
    dead = true;
    for (const o of added) { o.userData.undo?.(); o.parent?.remove(o); }
    for (const o of hide) o.visible = true;
    for (const side of ["L", "R"]) rig.hands[side].group.traverse((o) => o.layers.enableAll());
    p.headPivot.scale.setScalar(1);
    p.headPivot.position.y = pivotY;
    setClothed(rig, 0);
    setHips(rig, 0);
    delete rig.gunHold;
    delete rig.rigidTorso;
    if (rig.held) rig.held.scale.setScalar(1);
  };
  restore.loaded = Promise.all(pending);
  if (boardHead) return restore;

  // --- head: a block, the face on its front
  const H = B.head;
  const faceMat = drawn(faceTexture());
  const headSkin = mat(SKIN);
  const head = block(H.w * s, (H.top - H.bottom) * s, H.d * s, [headSkin, headSkin, headSkin, headSkin, headSkin, faceMat]);
  head.position.y = ((H.top + H.bottom) / 2) * s;
  add(p.headPivot, head);

  // the moustache: its drawing (head frame) on the face
  if (look.moustache) {
    const tex = new THREE.TextureLoader().load(new URL(`facial-french-moustache.png?v=${ART_V}`, DIR).href);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6 * s, 0.62 * s),
      drawn(tex, { transparent: true, alphaTest: 0.3 }));
    m.position.set(0, 0.31 * s, -(H.d / 2 + 0.004) * s);
    m.rotation.y = Math.PI;
    add(p.headPivot, m);
  }

  // the cap: a crown block with its print on the front, and a brim
  if (look.cap) {
    const black = mat(0x151517);
    const print = drawn(capPrint(look.cap));
    const crown = block((H.w + 0.02) * s, 0.15 * s, (H.d + 0.02) * s, [black, black, black, black, black, print]);
    crown.position.set(0, (H.top + 0.06) * s, 0);
    add(p.headPivot, crown);
    const brim = block((H.w - 0.04) * s, 0.025 * s, 0.17 * s, black);
    brim.position.set(0, (H.top - 0.005) * s, -(H.d / 2 + 0.085) * s);
    add(p.headPivot, brim);
  }

  return restore;
}

/* ------------------------------------------------------------ in game */

/* The body cosmetic (cosmetics.js "body": "trolls-1718", account-locked):
   TROLLS #1718 as the blocky troll on a live game rig, put on or taken off
   in place. Cheap to call every frame; resolves once the body is on. The
   rig is reshaped to the blocky proportions (character.js reshapeRig: arms
   hanging straight, shorter legs) with its hit capsules along the new bones,
   the head traits drawn on (traits.js), then the body (applyBlocky). */
export const BLOCKY_TOKEN = 1718;
/* The body your own troll should wear: set from the Cosmetics pick
   (menu/lobby.js), worn by view/third-person.js every frame. */
export const ownBody = { want: "" };
export function wearBlocky(rig, on) {
  on = !!on;
  if (!!rig.blocky === on) return rig.blocky?.ready ?? Promise.resolve();
  if (!on) {
    const b = rig.blocky;
    rig.blocky = null;
    b.off();
    return Promise.resolve();
  }
  const head = rig.parts.head;
  const side = head.material.side;
  const unshape = reshapeRig(rig, { build: 0.25, legs: 0.67 });
  let restore = null, gone = false;
  const b = (rig.blocky = {
    off() {
      gone = true;
      restore?.();
      removeToken(rig);
      // the traits' skull back (traits.js skullBack): the stick has none
      rig.skull?.parent?.remove(rig.skull);
      rig.skull = null;
      head.material.side = side;
      unshape();
    },
  });
  b.ready = applyToken(rig, BLOCKY_TOKEN, { headOnly: true }).then(() => {
    if (gone) return;
    // skullBack turned the board's (possibly shared) face material one-sided
    head.material.side = side;
    restore = applyBlocky(rig, { garment: "clothes-tank-runner" });
    return restore.loaded;
  });
  return b.ready;
}
