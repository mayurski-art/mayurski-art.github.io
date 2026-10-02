// Troll Forces — weapon skins.
//
// Every skin is cut from one of the sixteen troll banners
// (assets/images/banners), but not by wrapping the banner round the gun.
// Each is designed per part: which crop of the banner suits the long thin
// upper receiver, which the squarer lower, the handguard, the stock, the
// grip, the magazine; trim and metal colours taken from the banner's own
// palette. The parts show the banner and nothing else.
//
// tools/troll-skin-bake.html turns each recipe into one small atlas
// (skins/<id>.jpg, 1024x512) plus a picker thumbnail (skins/<id>-thumb.jpg).
// The game only ever loads the baked atlas, never a banner. The atlas
// regions below are sized to each panel's real proportions on the
// Problem 416 model (weapon-416.js), so art maps onto it unstretched.

import * as THREE from "three";

export const SKIN_ATLAS = {
  width: 1024,
  height: 1024,
  // Two copies of the same layout: the top half is the gun's left side, the
  // bottom half (`rightY` lower) its right side. The right is the left's
  // mirror, placed the same along the gun, with every text area flipped back
  // in place so writing reads correctly on both sides.
  rightY: 512,
  // Pixel rectangles (left side). Each panel's w:h matches that part's side profile.
  regions: {
    upper:     { x: 0,   y: 0,   w: 776, h: 88 },
    trim:      { x: 780, y: 0,   w: 244, h: 88 },
    lower:     { x: 0,   y: 92,  w: 602, h: 185 },
    handguard: { x: 606, y: 92,  w: 410, h: 110 },
    stock:     { x: 0,   y: 281, w: 405, h: 230 },
    grip:      { x: 412, y: 281, w: 134, h: 228 },
    mag:       { x: 606, y: 206, w: 185, h: 304 },
    // A part's own edge strip (top, bottom, front, back faces), laid along
    // the part. Only the stock has one; a skin fills it from `edges.stock`,
    // otherwise it stays trim like every other edge.
    stockEdge: { x: 796, y: 206, w: 228, h: 100 },
  },
};

/* Weapons that can wear skins. The Problem 416 is everyone's first gun and
   carries every panel type, so it's the one the skins are designed for. */
export const SKINNABLE = new Set(["problem416"]);

/* Edit these in tools/troll-skin-editor.html (node tools/troll-skin-editor.mjs):
   drag the boxes on the banner, Save writes them here and re-bakes the skin.
   Crops are [cx, cy, zoom, rot, flip]: rot (degrees, optional) turns the crop
   on the banner and flip (optional, 1) mirrors it. [cx, cy, zoom]: the centre of the crop as a fraction of the
   banner's width and height, and how much of the banner's WIDTH the panel
   spans. The crop's height follows from the panel's shape, so nothing is
   ever stretched. Colours: `trim` edges and inlay lines, `ink` for
   engraving and small print, `metal`/`accent` the barrel, rail and small
   hardware. `lines` rewrite text on the banner and `cutouts` lift art off it
   (both movable pieces, see editedBanner in tools/troll-skin-draw.js): the box (fractions of the
   banner) is painted over and `text` written back in the banner's pixel
   style — edit it in the skin editor. `art` gives a part its own picture
   (assets/images/skin-art) in place of the banner: that part's crop is then
   a crop of the picture; { file, bg } keys out its white paper onto `bg`. */
export const SKINS = [
  {
    id: "problem", name: "You Have a Problem", banner: "banner-16.jpg",
    blurb: "An error dialog that shoots back.",
    final: true,
    palette: { trim: "#1f4fd1", ink: "#10131c", metal: 0xb9bcc2, accent: 0xd9492b },
    art: { stock: { file: "problem-stock.jpg", bg: "#1f4fd1", paper: [[0.47, 0.554], [0.247, 0.573], [0.605, 0.708], [0.697, 0.726]] } },
    crops: {
      upper: [0.235, 0.12, 0.47],
      lower: [0.31, 0.46, 0.34, 0, 1],
      handguard: [0.685, 0.81, 0.57],
      stock: [0.515, 0.665, 0.965, 20],
      grip: [0.567, 0.605, 0.029, 90],
      mag: [0.81, 0.618, 0.032, -90],
    },
    lines: [{ box: [0.169, 0.325, 0.58, 0.454], text: "^ disgusting", dx: 0.005, dy: 0.005, size: 0.9, rot: -6, flip: 1 }],
    cutouts: [{ name: "trollface", box: [0.03, 0.3, 0.147, 0.62], dx: 0.287, dy: 0.005, size: 0.85 }],
    textAreas: [[0.02, 0.05, 0.465, 0.2], [0.472, 0.722, 0.537, 0.828], [0.702, 0.722, 0.91, 0.828]],
    right: {"lines":[{"text":"$TROLL","dx":0.015,"dy":0.005,"size":1.1,"rot":-6,"flip":1}],"newLines":[{"box":[0.02,0.04,0.47,0.228],"text":"Don't even joke with me lad","scale":0.66,"smooth":1,"bg":"rows","color":"#ffffff","shadow":"#0a1f7a","size":0.6,"dx":-0.115}],"crops":{"upper":[0.176,0.13,0.352],"mag":[0.81,0.618,0.026,-90,0],"lower":[0.323,0.46,0.34,0,1]},"cutouts":[{"dx":0.287,"dy":0.005,"size":0.9,"rot":0,"flip":0}]},
  },
  {
    id: "vice", name: "Vice Grin", banner: "banner-17.jpg",
    blurb: "Leonida sunset, fully loaded.",
    final: true,
    palette: { trim: "#6c3f8e", ink: "#fff4e8", metal: 0x2b2233, accent: 0xff8fb8, rail: [0x92885f, 0x2a2b1f] },
    edges: { stock: "vice-stock-edge.jpg" },
    art: { grip: "vice-gradient.jpg", mag: "vice-olive-gradient.jpg", stock: "troll-crew-san-andreas.jpg", handguard: "gta6-troll-skin-part-vice60.jpg" },
    layers: { receiver: [{ file: "banners/banner-11.jpg", src: [0.345, 0, 1, 1], at: [0.923, 0.587, 0.875], feather: 0.65, opacity: 0.65, id: "rkn0gy", mask: "vice-rkn0gy-mujaulpy.png", lock: 1 }], stock: [{ id: "8osvw2", file: "skin-art/vice-robbery-troll.jpg", src: [0.044, 0.05, 0.376, 0.486], at: [0.64, 0.42, 0.676], text: 1, feather: 0.15, opacity: 0.65, lock: 1, mask: "vice-8osvw2-mukhm6ar.png" }] },
    crops: {
      receiver: [0.5, 0.344, 1],
      handguard: [0.5, 0.446, 0.505],
      stock: [0.489, 0.627, 0.977],
      grip: [0.5, 0.5, 0.59],
      mag: [0.5, 0.5, 0.61],
    },
  },
];

/* Finishes: skins that change what the gun is made of instead of painting
   it, so every gun can wear them (weapon-model.js applyFinish). Ghost Glass
   is after the clear "glass" guns in Phantom Forces: see-through panels,
   bright edges, the small hardware frosted white. */
export const FINISHES = [
  { id: "ghostglass", name: "Ghost Glass", finish: "glass", blurb: "See-through, every edge lit. Nothing to hide." },
];

export const SKIN_BY_ID = Object.fromEntries([...SKINS, ...FINISHES].map((s) => [s.id, s]));

/* The banner skin a weapon should wear, or null for the factory finish (or a finish). */
export function skinDef(skinId, weaponId) {
  if (!skinId || !SKINNABLE.has(weaponId)) return null;
  const s = SKIN_BY_ID[skinId];
  return s && !s.finish ? s : null;
}

/* The finish a weapon should wear (any weapon), or null. */
export function finishDef(skinId) {
  const s = skinId ? SKIN_BY_ID[skinId] : null;
  return s?.finish ? s : null;
}

export function skinsFor(weaponId) {
  return [...(SKINNABLE.has(weaponId) ? SKINS : []), ...FINISHES];
}

export const skinAtlasUrl = (id) => new URL(`./skins/${id}.jpg`, import.meta.url).href;
export const skinThumbUrl = (id) => new URL(`./skins/${id}-thumb.jpg`, import.meta.url).href;

/* One texture per skin, loaded on first use and shared by every gun wearing
   it — yours, your third-person body's, and every other player's. */
const TEX = new Map();
export function skinAtlasTexture(id) {
  let tex = TEX.get(id);
  if (tex) return tex;
  tex = new THREE.TextureLoader().load(skinAtlasUrl(id));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.userData.shared = true;
  TEX.set(id, tex);
  return tex;
}
