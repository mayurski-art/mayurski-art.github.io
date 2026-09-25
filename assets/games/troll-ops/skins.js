// Troll Ops — weapon skins.
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
    id: "green", name: "Green Room", banner: "banner-03.jpg",
    blurb: "Big white letters, bigger grin.",
    palette: { trim: "#0c0c0c", ink: "#ffffff", metal: 0x1d1f1c, accent: 0x22a846 },
    crops: {
      upper: [0.5, 0.47, 1],
      lower: [0.5, 0.42, 0.45],
      handguard: [0.84, 0.44, 0.33],
      stock: [0.2, 0.5, 0.3],
      grip: [0.52, 0.85, 0.05],
      mag: [0.63, 0.8, 0.08],
    },
  },
  {
    id: "hitman", name: "Hitman Red", banner: "banner-04.jpg",
    blurb: "Every hole on it is a receipt.",
    palette: { trim: "#101216", ink: "#ffffff", metal: 0x15161a, accent: 0xe01010 },
    crops: {
      upper: [0.3, 0.34, 0.5],
      lower: [0.15, 0.45, 0.3],
      handguard: [0.63, 0.47, 0.3],
      stock: [0.86, 0.27, 0.18],
      grip: [0.91, 0.68, 0.06],
      mag: [0.74, 0.62, 0.08],
    },
  },
  {
    id: "livewire", name: "Live Wire", banner: "banner-07.jpg",
    blurb: "Runs hot. Don't lick it.",
    palette: { trim: "#0a1a4a", ink: "#e6f4ff", metal: 0x0c1633, accent: 0x9fd8ff },
    crops: {
      upper: [0.3, 0.36, 0.6],
      lower: [0.3, 0.55, 0.45],
      handguard: [0.6, 0.35, 0.35],
      stock: [0.9, 0.44, 0.16],
      grip: [0.1, 0.9, 0.06],
      mag: [0.15, 0.5, 0.1],
    },
  },
  {
    id: "buytroll", name: "Buy $TROLL", banner: "banner-10.jpg",
    blurb: "Available only on the battlefield.",
    palette: { trim: "#111111", ink: "#111111", metal: 0x161616, accent: 0xfff24a },
    crops: {
      upper: [0.5, 0.91, 0.4],
      lower: [0.33, 0.5, 0.51],
      handguard: [0.675, 0.6, 0.35],
      stock: [0.89, 0.34, 0.175],
      grip: [0.93, 0.8, 0.06],
      mag: [0.1, 0.38, 0.155],
    },
    textAreas: [[0.02, 0.1, 0.18, 0.37], [0.085, 0.36, 0.56, 0.69], [0.41, 0.875, 0.59, 0.945]],
  },
  {
    id: "jungle", name: "Deep Cover", banner: "banner-11.jpg",
    blurb: "You didn't see this one coming. That's the point.",
    palette: { trim: "#1b2a14", ink: "#d9e8c0", metal: 0x1a1f16, accent: 0x6b8f3a },
    crops: {
      upper: [0.25, 0.3, 0.5],
      lower: [0.65, 0.39, 0.4],
      handguard: [0.2, 0.6, 0.3],
      stock: [0.53, 0.72, 0.18],
      grip: [0.45, 0.75, 0.06],
      mag: [0.85, 0.5, 0.1],
    },
  },
  {
    id: "gladiator", name: "Gladiator", banner: "banner-01.jpg",
    blurb: "Marble, gold and a very small skirt.",
    palette: { trim: "#b8892e", ink: "#6d5117", metal: 0xd8d2c4, accent: 0x2a3aa8 },
    crops: {
      upper: [0.3, 0.3, 0.5],
      lower: [0.665, 0.5, 0.38],
      handguard: [0.25, 0.6, 0.3],
      stock: [0.69, 0.6, 0.05],
      grip: [0.2, 0.2, 0.06],
      mag: [0.4, 0.7, 0.1],
    },
  },
  {
    id: "tie", name: "Loose Tie", banner: "banner-02.jpg",
    blurb: "Business casual. Mostly business.",
    palette: { trim: "#0d0d0d", ink: "#111111", metal: 0x121212, accent: 0xe8e8e8 },
    crops: {
      upper: [0.46, 0.42, 0.3],
      lower: [0.19, 0.55, 0.32],
      handguard: [0.73, 0.64, 0.245],
      stock: [0.905, 0.54, 0.16],
      grip: [0.95, 0.8, 0.05],
      mag: [0.95, 0.75, 0.08],
    },
  },
  {
    id: "knight", name: "Knight Watch", banner: "banner-05.jpg",
    blurb: "The ticker is $TROLL. The blade agrees.",
    palette: { trim: "#c9ced6", ink: "#0b0d10", metal: 0x9aa3ad, accent: 0x1e7bff },
    crops: {
      upper: [0.5, 0.12, 0.5],
      lower: [0.5, 0.45, 0.55],
      handguard: [0.83, 0.5, 0.3],
      stock: [0.3, 0.72, 0.25],
      grip: [0.3, 0.15, 0.06],
      mag: [0.9, 0.45, 0.08],
    },
  },
  {
    id: "frog", name: "Frog Swap", banner: "banner-06.jpg",
    blurb: "Wait, that's not the usual face.",
    palette: { trim: "#1f3fbf", ink: "#ffffff", metal: 0x2a2d31, accent: 0x5aa83a },
    crops: {
      upper: [0.3, 0.2, 0.5],
      lower: [0.52, 0.48, 0.42],
      handguard: [0.525, 0.84, 0.35],
      stock: [0.715, 0.88, 0.13],
      grip: [0.6, 0.9, 0.06],
      mag: [0.245, 0.85, 0.1],
    },
  },
  {
    id: "diamond", name: "Diamond Fist", banner: "banner-08.jpg",
    blurb: "U mad, bro? The army isn't.",
    palette: { trim: "#b7ff2e", ink: "#e9f0ff", metal: 0x1a1d24, accent: 0xb7ff2e },
    crops: {
      upper: [0.25, 0.65, 0.5],
      lower: [0.525, 0.33, 0.35],
      handguard: [0.8, 0.66, 0.3],
      stock: [0.515, 0.88, 0.18],
      grip: [0.1, 0.15, 0.06],
      mag: [0.6, 0.8, 0.1],
    },
  },
  {
    id: "keyboard", name: "U Mad Bro", banner: "banner-09.jpg",
    blurb: "Winter camo. Mechanical switches.",
    palette: { trim: "#dfe6ee", ink: "#1b2230", metal: 0x3b4452, accent: 0x7bff66 },
    crops: {
      upper: [0.874, 0.43, 0.185],
      lower: [0.815, 0.41, 0.3],
      handguard: [0.72, 0.6, 0.2],
      stock: [0.08, 0.4, 0.165],
      grip: [0.7, 0.75, 0.05],
      mag: [0.1, 0.65, 0.08],
    },
  },
  {
    id: "brute", name: "Brute Force", banner: "banner-12.jpg",
    blurb: "Sketched in pencil. Hits in ink.",
    palette: { trim: "#2b2b2b", ink: "#111111", metal: 0x3a3a3a, accent: 0x8dff5a },
    crops: {
      upper: [0.5, 0.2, 0.5],
      lower: [0.545, 0.35, 0.33],
      handguard: [0.245, 0.34, 0.21],
      stock: [0.75, 0.75, 0.15],
      grip: [0.1, 0.3, 0.06],
      mag: [0.2, 0.75, 0.1],
    },
  },
  {
    id: "lightspeed", name: "Speed of Light", banner: "banner-13.jpg",
    blurb: "Speed of light, powered by a red wagon.",
    palette: { trim: "#d62828", ink: "#222222", metal: 0x2e2e2e, accent: 0xfff7c2 },
    crops: {
      upper: [0.83, 0.135, 0.165],
      lower: [0.81, 0.47, 0.38],
      handguard: [0.52, 0.5, 0.35],
      stock: [0.83, 0.64, 0.15],
      grip: [0.9, 0.5, 0.06],
      mag: [0.3, 0.5, 0.1],
    },
    textAreas: [[0.75, 0.1, 0.905, 0.16]],
  },
  {
    id: "office", name: "Office Hours", banner: "banner-14.jpg",
    blurb: "Per my last email.",
    palette: { trim: "#1c2a44", ink: "#dddddd", metal: 0x2a2a2a, accent: 0x8a1c24 },
    crops: {
      upper: [0.4, 0.11, 0.55],
      lower: [0.45, 0.4, 0.4],
      handguard: [0.475, 0.68, 0.15],
      stock: [0.905, 0.22, 0.16],
      grip: [0.5, 0.75, 0.05],
      mag: [0.8, 0.8, 0.1],
    },
  },
  {
    id: "order", name: "The Order", banner: "banner-15.jpg",
    blurb: "We don't talk about the Order.",
    palette: { trim: "#9fb8c8", ink: "#e6f2f8", metal: 0x0f1418, accent: 0x6fd0ff },
    crops: {
      upper: [0.5, 0.2, 0.5],
      lower: [0.5, 0.45, 0.3],
      handguard: [0.8, 0.6, 0.3],
      stock: [0.5, 0.44, 0.13],
      grip: [0.5, 0.85, 0.05],
      mag: [0.5, 0.82, 0.11],
    },
  },
];

export const SKIN_BY_ID = Object.fromEntries(SKINS.map((s) => [s.id, s]));

/* The skin a weapon should wear, or null for the factory finish. */
export function skinDef(skinId, weaponId) {
  if (!skinId || !SKINNABLE.has(weaponId)) return null;
  return SKIN_BY_ID[skinId] || null;
}

export function skinsFor(weaponId) {
  return SKINNABLE.has(weaponId) ? SKINS : [];
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
