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
import { setClothed, setHips, reshapeRig, setFace } from "./character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1m1u-gt1-gt2-bk1-cw1-zr10-bf1-sr1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-mg1-sp1";
import { applyToken, removeToken, tokenTraits, tokenFace, TOKENS, TRAIT_ART } from "./traits.js?v=bk1-cw1-zr10-bf1-sr1-nf1-or1-nf2-em2-nb2-sb1-lh1-fc1-fm1-mr1-gt1-fg2-bd1-mj1-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-sf1-hl1-mg1-sp1";
import { addRim } from "../view/rim-light.js?v=sr1";
import { tagInk, untagInk } from "../view/char-ink.js?v=ci1-ci2-ci3-ci4-ci5-rb4-rb5-mg1-sp1";

const DIR = new URL("../traits/", import.meta.url);
const ART_V = globalThis.TRAITS_BUST ?? "tr7";
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
/* The head on the body, bigger like the NFT art (user, 2026-10-16: the
   head was small): `scale` the board's size (0.6, then 0.69 so the face
   read, now 0.85). `neck` lifts it on a thin neck (metres; `neckR` its
   radius at the bottom and top): tried at 0.07, then off (user: "i dont
   want the neck"), kept as a lab slider. The head's hit sphere stays
   exactly where and as big as it was at 0.69 (HIT_LOOK): cosmetic only. */
// `mirror`: the whole face flipped left to right, so the chin points down
// to the south-east like the NFTs' instead of the south-west (user,
// 2026-10-16: "horizontal flip ... all the faces"): the head pivot's x is
// negated, so the face, its relief, and every face trait (eyes, beard,
// moustache, mask) flip together; hats are flipped back (applyBlocky,
// reliefHead) so their prints still read.
const HEAD = { scale: 0.85, neck: 0, neckR: [0.05, 0.043], model: "relief", mirror: true };
const HIT_LOOK = { scale: 0.69, y: 0.02 };
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
// In front of the pecs, not in them (user, 2026-10-13: the gun showed
// through the TROLLS body; measured, it sat 5-6 cm inside the chest and its
// forearms, the reload's mag in the left thigh): the stock 7 cm further
// forward and 2 cm in from the shoulder joint, the gun at its own size (bigger, it ran
// through more), a little more blade and left-shoulder roll so the left
// hand still reaches the handguard, a shallower low ready (ready, radians)
// and the belt pouch (pouch, chest-local) out past the thigh. Its arm is
// short for a long stock: past reachR of the arm the trigger hand takes the
// stock's wrist (straight, the arm lay down the stock). A reload lifts the
// gun as much as the stick's drops it (reloadDrop) and swings it a third as
// far (swing): dropped, the launcher's tube went into the shoulder. Pistols keep
// their own reach (pistolZ). The menu's port-arms carry raises the trigger
// elbow (carryPoleR). tools/troll-ops-nft-hold-test.mjs measures it.
const GUN_HOLD = { x: 0.13, y: -0.08, z: -0.17, pistolZ: -0.1, scale: 1, blade: 0.45, roll: 0.2, under: 0.075, runX: 0.06, lean: 0.25, ready: 0.1, pouch: [-0.15, -0.42, -0.2], reachR: 0.8, swing: 0.3, reloadDrop: -1, carryPoleR: [1, 0.8, 0.2] };

// mat() and toon() carry the rim light (view/rim-light.js); drawn() (the
// face, prints) doesn't.
function mat(color, extra = {}) {
  return addRim(new THREE.MeshStandardMaterial({ color, roughness: 0.8, emissive: color, emissiveIntensity: 0.4, ...extra }));
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
  return addRim(new THREE.MeshToonMaterial({ color, gradientMap: TONES, emissive: color, emissiveIntensity: 0.12 }));
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
  img.crossOrigin = "anonymous";
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
  img.src = new URL("../../../images/wallpaper/trollface%20transparent.png", import.meta.url).href;
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

/* The Blender pieces (models/build_blocky_*.blender.py -> models/blocky/*.glb),
   each "<joint><S>__<part>" authored in its joint's frame, bone straight
   down -Y, at scale 1. */
const glb = (file) => new URL(`../models/blocky/${file}?v=${globalThis.TRAITS_BUST ?? "bb5"}`, import.meta.url).href;
const TORSO_GLB = glb("torso-muscle.glb");
/* What each CLOTHES trait dresses the body in (the trait library, traits.js):
   its block template wrapped on the torso, its `sleeves` on the box arms
   (boxArms: "long", "short" or none, bare), and the leg piece set
   (models/blocky/<file>, built by models/build_blocky_*.blender.py), with a
   colour per piece name; a piece with no colour is skin, "plaid" the
   shirt's cloth (plaidMaterial). Every token with the trait wears this. */
const KITS = {
  "clothes-tank-runner": { legs: "legs-muscle.glb",
    colours: { shorts: 0x34363e, hem: 0x43464f, upper: 0x141416, sole: 0xdcdcd6 } },
  // Farmer: plaid long sleeves, denim overalls to the boots
  "clothes-farmer": { sleeves: "long", legs: "legs-farmer.glb",
    colours: { sleeve: "plaid", cuff: "plaid", denim: 0x3f6fa6, hem: 0x2f5a8c, boot: 0x6b4423, collar: 0x8a5a30, sole: 0x2a2420 } },
  // Sweater Black: the farmer's pieces as black knit sleeves, dark jeans, black sneakers
  "clothes-sweater-black": { sleeves: "long", legs: "legs-farmer.glb",
    colours: { sleeve: 0x2b2b2e, cuff: 0x1f1f22, denim: 0x34363d, hem: 0x2a2c32, boot: 0x1b1b1d, collar: 0x1f1f22, sole: 0xe6e6e0 } },
  // Sensei: the undershirt's short blue sleeves and wristbands, baggy orange
  // gi trousers gathered into blue boots (build_blocky_sensei); first-person
  // forearms bare with the wristband (`fp`: the forearm's and cuff's colours)
  // #989's legs and torso are Sensei v3, a logo-free gi made in Roblox Studio
  // (tools/troll-ops-roblox-body.mjs; nft-lab "Body pieces"; user, 2026-10-17:
  // "redesign the sensei outfit but without the logos"), the head set
  // down onto its shorter collar
  "clothes-sensei": { sleeves: "short", legs: "legs-sensei3.glb", torso: "torso-sensei3.glb", headLift: -0.04,
    colours: { sleeve: 0x2d5a96, band: 0x2d5a96, gi: 0xf2841f, hem: 0xd96f15, boot: 0x2d5a96, sole: 0x24252b },
    fp: { sleeve: null, cuff: 0x2d5a96 } },
  // Jester (#33): the farmer's pieces as the purple jacket's sleeves with
  // teal shirt cuffs, purple trousers and black shoes
  "clothes-jester": { sleeves: "long", legs: "legs-farmer.glb",
    colours: { sleeve: 0x4b2a70, cuff: 0x3f8090, denim: 0x3c2159, hem: 0x2c173f, boot: 0x17151a, sole: 0x0e0d10 } },
  // Tshirt Black (#2630): the Sensei's short sleeves in black (the band is
  // skin: bare forearms), dark jeans, black sneakers
  "clothes-tshirt-black": { sleeves: "short", legs: "legs-farmer.glb",
    colours: { sleeve: 0x1d1d20, denim: 0x3b4a66, hem: 0x2f3c55, boot: 0x1b1b1d, sole: 0xe6e6e0 },
    fp: { sleeve: null, cuff: null } },
  // Trainer (#2631): short white shirt sleeves, navy track trousers, black trainers
  "clothes-trainer": { sleeves: "short", legs: "legs-farmer.glb",
    colours: { sleeve: 0xf2f2ee, denim: 0x232f48, hem: 0x1b253a, boot: 0x1b1b1d, sole: 0xe6e6e0 },
    fp: { sleeve: null, cuff: null } },
  // Sheriff Gear (#1272): white long shirt sleeves (the vest's on the
  // torso template), dark jeans, brown cowboy boots
  "clothes-sheriff-gear": { sleeves: "long", legs: "legs-farmer.glb",
    colours: { sleeve: 0xf4f4f0, cuff: 0xe2e2dc, denim: 0x2c3650, hem: 0x222a3e, boot: 0x4a2e18, sole: 0x2a1c12 } },
};
/* Hair modelled in Blender (traits.js MODELLED), worn on the relief head in
   its frame: the file and a colour per piece name. Carrot Cake Hair is the
   NFT's black spikes, a dark grey so the toon bands and the ink read on it. */
const HAIRS = {
  "hat-carrot-cake-hair": { file: "hair-carrot-cake.glb", colours: { hair: 0x2c2c33 } },
};
/* Token #id's look on the block body: its garment and that garment's kit,
   or null when the token isn't wearable (a trait not drawn yet). */
export function tokenLook(token) {
  const ids = tokenTraits(token);
  const garment = ids?.find((id) => id.startsWith("clothes-"));
  return garment && KITS[garment] ? { garment, kit: KITS[garment] } : null;
}
/* The farmer's shirt: white with a fine red-pink check, a tile repeated
   over the sleeves (box-projected UVs from Blender, 1 tile = 0.12 m). */
let plaidTex = null;
function plaidMaterial() {
  if (!plaidTex) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    g.fillStyle = "#f6f3ee"; g.fillRect(0, 0, 128, 128);
    for (const [at, w, col] of [[0, 6, "#e39a9a"], [64, 6, "#e39a9a"], [32, 3, "#f1c6c6"], [96, 3, "#f1c6c6"]]) {
      g.fillStyle = col;
      g.fillRect(at - w / 2, 0, w, 128); g.fillRect(0, at - w / 2, 128, w);
      if (at - w / 2 < 0) { g.fillRect(128 + at - w / 2, 0, w, 128); g.fillRect(0, 128 + at - w / 2, 128, w); }
    }
    plaidTex = new THREE.CanvasTexture(c);
    plaidTex.colorSpace = THREE.SRGBColorSpace;
    plaidTex.wrapS = plaidTex.wrapT = THREE.RepeatWrapping;
    plaidTex.anisotropy = 8;
  }
  return addRim(new THREE.MeshToonMaterial({ map: plaidTex, gradientMap: CLOTH_TONES, emissive: 0xffffff, emissiveMap: plaidTex, emissiveIntensity: 0.12 }));
}
/* A painted piece's material: its own texture (a Roblox Studio body,
   tools/troll-ops-roblox-body.mjs, carries one per part), cel-shaded like
   the cloth, one per texture. */
const paintedMats = new Map();
function paintedMaterial(map, alphaTest = 0) {
  if (!paintedMats.has(map)) {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    const m = addRim(new THREE.MeshToonMaterial({ map, gradientMap: CLOTH_TONES, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.12, alphaTest }));
    m.userData.shared = true;
    paintedMats.set(map, m);
  }
  return paintedMats.get(map);
}
/* The torso badges' placeholder (user, 2026-10-17: the trollface badge
   "looks messy"; blank first, the trollface goes in later): the badge's
   disc, plain off-white with a thin dark ring, covering the Roblox Studio
   texture's own logo underneath. Same disc as the badge drawing
   (tools/troll-ops-roblox-body.mjs badgeImage): see-through outside it. */
let badgeBlank = null;
function badgePlaceholder() {
  if (badgeBlank) return badgeBlank;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d"), r = 256 / 2 - 2;
  g.beginPath();
  g.arc(128, 128, r, 0, Math.PI * 2);
  g.fillStyle = "#1e1b18";
  g.fill();
  g.beginPath();
  g.arc(128, 128, r * 0.9, 0, Math.PI * 2);
  g.fillStyle = "#f6f4ee";
  g.fill();
  badgeBlank = new THREE.CanvasTexture(c);
  badgeBlank.flipY = false;   // the GLB's UVs (a symmetric disc either way)
  return badgeBlank;
}
/* A kit's materials by piece name, up to a "-" ("sleeve-cap" is sleeve),
   shared within one body; a piece that brings its own texture wears it. */
function kitMaterials(colours) {
  const mats = new Map();
  return (name, map) => {
    if (map) return paintedMaterial(map);
    const key = name.split("-")[0];
    if (!mats.has(key)) {
      const c = colours[key];
      mats.set(key, c === "plaid" ? plaidMaterial() : toon(c ?? SKIN));
    }
    return mats.get(key);
  };
}
/* Your own first-person arms in token #token's garment (view/weapon-view.js
   placeBlockArms): the forearm's material (null: bare, the white skin) and
   the cuff's (null: none), or null for a token that isn't wearable. The
   plaid gets its own repeat for the first-person box (0.066 m across, about
   0.45 m long). */
const fpArmLooks = new Map();
export function fpArmLook(token) {
  const kit = tokenLook(token)?.kit;
  if (!kit) return null;
  if (!fpArmLooks.has(token)) {
    const mat = (c) => {
      if (c == null) return null;
      if (c !== "plaid") return toon(c);
      const m = plaidMaterial();
      m.map = m.emissiveMap = plaidTex.clone();
      m.map.repeat.set(0.55, 3.6);
      m.map.needsUpdate = true;
      return m;
    };
    const fp = kit.fp ?? kit.colours;
    fpArmLooks.set(token, { sleeve: mat(fp.sleeve), cuff: mat(fp.cuff) });
  }
  return fpArmLooks.get(token);
}
/* The trollface with depth (models/build_blocky_head.blender.py), one per
   head shape (HEAD.model, or a token's own face: FACE_HEADS): its file, how far its dome stands in front of the board
   (`dome`, its FRONT, without the features) and, with the sculpted brow
   and upper lip under the cap and moustache, `front`; and its skull behind
   (`back`), so the drawn head traits (traits.js planes) move out onto them. */
const HEAD_MODELS = {
  relief: { file: "head-relief.glb", dome: 0.065, front: 0.085, back: 0.19 },
  // #989's own drawing: its outline and features (build_blocky_head -- variant 989)
  // its eyes and forehead lines sit higher than the trollface's: the
  // hairline (HAIRLINE) stays above them
  989: { file: "head-989.glb", dome: 0.065, front: 0.085, back: 0.19, hairline: { top: 0.175, low: 0.13 } },
  // #1718's Eyes Relaxed: the relief head with the lids swelling over the
  // eyeballs where the squints sank (build_blocky_head -- variant 1718)
  // capLift/capTilt: its cap sits that much higher (m) and tipped back (rad),
  // the brim up off the eyes like the NFT, the back still on the skull
  // (user, 2026-10-20)
  1718: { file: "head-1718.glb", dome: 0.065, front: 0.085, back: 0.19, capLift: 0.03, capTilt: 0.15 },
};
/* An NFT face drawn on a shape of its own wears its own head (rig.nftFace,
   traits.js tokenFace; user, 2026-10-17: #989's drawing on the trollface
   head didn't match it). */
const FACE_HEADS = { gum: "989", relaxed: "1718" };
const headModel = (rig) => HEAD_MODELS[FACE_HEADS[rig?.nftFace]] || HEAD_MODELS[HEAD.model] || HEAD_MODELS.relief;
const ARM_BONES = { arm: 0.30, elbow: 0.325 };
const FIST_BACK = -0.058;   // the fist (0.125 long, down from the wrist) moved back up the forearm by half
/* A Blender piece set: [{ name, geo, hull }], each with its ink shell (the
   piece pushed out along smooth normals, drawn inside out). Once per file. */
const pieceSets = new Map();
/* Laplacian smoothing: each vertex moved halfway to its neighbours'
   average, `n` times (the open rim of a piece stays put). */
function smoothHull(geo, n) {
  const pos = geo.attributes.position, idx = geo.index, count = pos.count;
  const nb = Array.from({ length: count }, () => new Set());
  const edgeUse = new Map();
  for (let t = 0; t < idx.count; t += 3) for (let e = 0; e < 3; e++) {
    const a = idx.getX(t + e), b = idx.getX(t + (e + 1) % 3);
    nb[a].add(b); nb[b].add(a);
    const k = a < b ? `${a}|${b}` : `${b}|${a}`;
    edgeUse.set(k, (edgeUse.get(k) || 0) + 1);
  }
  const rim = new Uint8Array(count);
  for (const [k, used] of edgeUse) if (used === 1) for (const v of k.split("|")) rim[+v] = 1;
  const p = pos.array, q = new Float32Array(p.length);
  for (let it = 0; it < n; it++) {
    for (let i = 0; i < count; i++) {
      if (rim[i] || !nb[i].size) { q[i * 3] = p[i * 3]; q[i * 3 + 1] = p[i * 3 + 1]; q[i * 3 + 2] = p[i * 3 + 2]; continue; }
      let x = 0, y = 0, z = 0;
      for (const j of nb[i]) { x += p[j * 3]; y += p[j * 3 + 1]; z += p[j * 3 + 2]; }
      const m = nb[i].size;
      q[i * 3] = (p[i * 3] + x / m) / 2; q[i * 3 + 1] = (p[i * 3 + 1] + y / m) / 2; q[i * 3 + 2] = (p[i * 3 + 2] + z / m) / 2;
    }
    p.set(q);
  }
  pos.needsUpdate = true;
}
function loadPieces(url) {
  if (!pieceSets.has(url)) pieceSets.set(url, new GLTFLoader().loadAsync(url).then((gltf) => {
    const out = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const named = o.name.includes("__") ? o : o.parent;
      const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
      const hull = mergeVertices(new THREE.BufferGeometry().setAttribute("position", geo.attributes.position.clone()).setIndex(geo.index?.clone() ?? null), 1e-4);
      // a painted (Roblox Studio) piece is finely bumpy: its shell is
      // smoothed first, or it pokes through the dips as black specks
      if (o.material?.map) smoothHull(hull, 4);
      hull.computeVertexNormals();
      // every rig wearing the body shares these (remote-players.js dispose skips them)
      geo.userData.shared = hull.userData.shared = true;
      out.push({ name: named.name, geo, hull, mat: o.material?.name || "", map: o.material?.map || null, alphaTest: o.material?.alphaTest || 0 });
    });
    return out;
  }));
  return pieceSets.get(url);
}
const INK_PUSH = 0.0055;
const armInk = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
armInk.userData.shared = true;
armInk.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader.replace("#include <begin_vertex>",
    // (unit normals from computeVertexNormals; a zeroed one means no ink push there)
    `#include <begin_vertex>\n  transformed += normal * ${INK_PUSH.toFixed(4)};`);
};

/* The arms as plain rectangles, Roblox style (user, 2026-10-21: "for all
   blox characters lets keep the arm build really simple just rectangles",
   "no need for tricep bicep"): a box down each bone, stretched to its live
   length, and a box fist on the hand point, each with its ink shell. The
   kit's `sleeves` dress them: "long" the whole arm in the sleeve's colour
   with a cuff at the wrist, "short" the top of the upper arm (and a band at
   the wrist when the kit has one), none bare skin. Returns the added objects. */
// (10 cm square: the menu operator's port-arms carry crosses the right
// forearm at the wrist, where the old muscle forearm had tapered to 9 cm)
const ARM_BOX = { w: 0.10, top: 0.045, cap: 0.03, shortSleeve: 0.17, cuff: 0.035, over: 0.008, fist: [0.11, 0.125, 0.12] };
const boxGeos = new Map();   // by size
// (`name` the part of the arm it is: the hold tests sort the meshes by it)
function inkedBox(name, w, h, d, y, mat) {
  const key = [w, h, d].join();
  if (!boxGeos.has(key)) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const hull = mergeVertices(new THREE.BufferGeometry().setAttribute("position", geo.attributes.position.clone()).setIndex(geo.index.clone()), 1e-4);
    hull.computeVertexNormals();
    geo.userData.shared = hull.userData.shared = true;
    boxGeos.set(key, { geo, hull });
  }
  const { geo, hull } = boxGeos.get(key);
  const g = new THREE.Group();
  g.position.y = y;
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.name = name;
  g.add(m, new THREE.Mesh(hull, armInk));
  return { g, m };
}
function boxArms(rig, kit) {
  const p = rig.parts, s = rig.scale, c = kit.colours, X = ARM_BOX;
  const matOf = kitMaterials(c);
  const skin = matOf("skin"), sleeve = kit.sleeves ? matOf("sleeve") : skin;
  const added = [];
  for (const side of ["L", "R"]) {
    const hand = p[`wrist${side}`].parent;
    for (const kind of ["arm", "elbow", "hand"]) {
      const joint = kind === "hand" ? hand : p[`${kind}${side}`];
      // the bone this box hangs along: to the joint's child (the hand
      // carries on along the forearm)
      const bone = kind === "arm" ? p[`elbow${side}`].position : hand.position;
      const g = new THREE.Group();
      g.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), bone.clone().normalize());
      const len = ARM_BONES[kind] ?? 0;
      g.scale.set(s, kind === "hand" ? s : bone.length() / len, s);
      if (kind === "hand") {
        // The fist is centred on the hand point, not hung below it: that point
        // is where the rig puts a gun's grip (and the support hand on the
        // handguard), so the gun runs through the fist instead of past it.
        g.position.copy(bone).normalize().multiplyScalar(FIST_BACK * s);
        const [fw, fh, fd] = X.fist;
        const { g: box, m } = inkedBox("fist", fw, fh, fd, -fh / 2, skin);
        g.add(box);
        added.push(...fistFingers(rig, side, bone, m.material));
      } else {
        // the upper arm starts a little above the shoulder joint (its cap),
        // the forearm a little above the elbow so a bent arm doesn't gap
        const top = kind === "arm" ? X.top : X.cap, bottom = len;
        const long = kit.sleeves === "long", part = kind === "arm" ? "upper" : "fore";
        g.add(inkedBox(part, X.w, top + bottom, X.w, (top - bottom) / 2, long ? sleeve : skin).g);
        if (kind === "arm" && kit.sleeves === "short") {
          const h = top + X.shortSleeve;
          g.add(inkedBox(part, X.w + X.over * 2, h, X.w + X.over * 2, top - h / 2, sleeve).g);
        }
        const wrist = kind === "elbow" && (long ? c.cuff : c.band);
        if (wrist) g.add(inkedBox(part, X.w + X.over * 2, X.cuff, X.w + X.over * 2, -bottom + X.cuff / 2 + 0.01, matOf(long ? "cuff" : "band")).g);
      }
      joint.add(g);
      added.push(g);
    }
  }
  return Promise.resolve(added);
}

/* Fingers the block fist doesn't have: the middle finger (emotes.js
   "Middle fingers") and the L (the index finger and the thumb out, "L on
   forehead"). Finger blocks stand out of the fist, placed in the fist's own
   frame (build_blocky_arms fist: down -Y from the wrist, the back of the
   hand out +X on the right, the thumb across the front -Z). Each set hangs
   on the stick hand's mesh for that pose, so it shows exactly when that
   pose does (character.js setHandPose; the stick hand itself is drawn on
   no layer while the body is on), and turns with the wrist. */
const FIST_LEN = 0.125;
const FINGER = { w: 0.036, len: 0.1, sink: 0.012 };
// [x (mirrored on the left), y, z] of each block's centre, and its long axis
const FIST_FINGERS = {
  bird: [{ at: [0, -(FIST_LEN + FINGER.len / 2 - FINGER.sink), 0], along: "y" }],
  lsign: [
    // the index: out of the knuckles at the thumb's corner
    { at: [-0.018, -(FIST_LEN + 0.15 / 2 - FINGER.sink), -0.036], along: "y", len: 0.15 },
    // the thumb: out of the front, square to the index
    { at: [-0.014, -0.045, -(0.061 + 0.11 / 2 - FINGER.sink)], along: "z", len: 0.11 },
  ],
};
const fingerGeo = new Map();   // by length
function fistFingers(rig, side, bone, mat) {
  const block = (len) => {
    if (!fingerGeo.has(len)) {
      const geo = new THREE.BoxGeometry(FINGER.w, len, FINGER.w);
      const hull = mergeVertices(new THREE.BufferGeometry().setAttribute("position", geo.attributes.position.clone()).setIndex(geo.index.clone()), 1e-4);
      hull.computeVertexNormals();
      geo.userData.shared = hull.userData.shared = true;
      fingerGeo.set(len, { geo, hull });
    }
    return fingerGeo.get(len);
  };
  const s = rig.scale, sx = side === "L" ? -1 : 1;
  const wrist = rig.parts[`wrist${side}`], hand = wrist.parent;
  // the fist's frame in the hand point's (as boxArms hangs it)
  const dir = bone.clone().normalize();
  const fistM = new THREE.Matrix4().compose(dir.clone().multiplyScalar(FIST_BACK * s),
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir), new THREE.Vector3(s, s, s));
  const toZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const out = [];
  for (const [pose, blocks] of Object.entries(FIST_FINGERS)) {
    const mesh = rig.hands[side][pose];
    if (!mesh) continue;
    // the fist's frame in this mesh's, the wrist at rest (it twists the
    // fingers with it after)
    const q = wrist.quaternion.clone();
    wrist.quaternion.identity();
    hand.updateMatrixWorld(true);
    const rel = new THREE.Matrix4().copy(hand.matrixWorld).invert().multiply(mesh.matrixWorld);
    wrist.quaternion.copy(q);
    hand.updateMatrixWorld(true);
    const base = rel.invert().multiply(fistM);
    const f = new THREE.Group();
    f.matrixAutoUpdate = false;
    f.matrix.copy(base);
    for (const b of blocks) {
      const { geo, hull } = block(b.len || FINGER.len);
      const piece = new THREE.Group();
      piece.position.set(b.at[0] * sx, b.at[1], b.at[2]);
      if (b.along === "z") piece.quaternion.copy(toZ);
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      piece.add(m, new THREE.Mesh(hull, armInk));
      f.add(piece);
    }
    mesh.add(f);
    out.push(f);
  }
  return out;
}

/* The muscular legs (models/build_blocky_legs.blender.py -> blocky/legs-muscle.glb):
   "thigh<S>__*" on the hip's splay joint (the knee's parent), "knee<S>__*"
   on the knee, each stretched to its live bone like the arms; "ankle<S>__*"
   (the sneaker) on the ankle as it is. Shorts and shoes in their own colours,
   the rest skin. Returns the added objects. */
const LEG_BONES = { thigh: 0.30, knee: 0.295 };
function muscleLegs(rig, kit) {
  const p = rig.parts, s = rig.scale;
  const matOf = kitMaterials(kit.colours);
  return loadPieces(glb(kit.legs)).then((pieces) => pieces.map(({ name, geo, hull, map }) => {
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
    const m = new THREE.Mesh(geo, matOf(part, map));
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
const CAP = { a: 0.32, b: 0.345, front: 0.09, back: 0.235 };   // ellipsoid half-width, half-height (to the cap's top), depths
/* Each hat's own shape: `ink` the colour of its walls and of the back
   under its back drawing; `brim` a band of the head frame (y0..y1, frame
   units) that stands out flat all round instead of following the head (a
   bucket hat's brim: a disc, `brimFront`/`brimBack` deep, metres), easing
   into the crown over `ease` units. */
const HATS = {
  "hat-goatfarm": { ink: "#151517" },
  "hat-camper": { ink: "#8f8862", brim: [352, 452], brimFront: 0.13, brimBack: 0.26, ease: 16 },
  // a flat cap: its bill out in front only (no brimBack: the crown all round behind)
  "hat-baker": { ink: "#1d1c17", brim: [345, 420], brimFront: 0.105, ease: 14 },
  // the wizard's hat is modelled whole (wizardHat): a bent cone on a wavy brim
  "hat-magician": { ink: "#16188c", brim: [320, 432], brimFront: 0.15, brimBack: 0.28, ease: 16, model: "wizard" },
  // trucker caps: the bill out in front only, mesh behind
  "hat-trucker-microsoft": { ink: "#b8305a", brim: [345, 448], brimFront: 0.13, ease: 14 },
  "hat-trucker-yobucks": { ink: "#c9c9c2", brim: [345, 448], brimFront: 0.13, ease: 14 },
  // the sheriff's cowboy hat is modelled whole too (cowboyHat)
  "hat-sheriff": { ink: "#151517", brim: [365, 440], model: "cowboy" },
};
/* How far the cap stands out of the head pivot's middle at (x, y): an
   ellipsoid round the head that closes exactly at that column's top edge of
   the cap (`top`), so the front and back meet in a rounded crown there
   instead of a flat lid. */
const capDepth = (x, y, centreY, s, d, top) => {
  const b = y > centreY && top !== undefined ? Math.max(0.05 * s, top - centreY) : CAP.b * s;
  return d * s * Math.sqrt(Math.max(0, 1 - (x / (CAP.a * s)) ** 2 - ((y - centreY) / b) ** 2));
};
/* The brim's depth at (x, y): flat across the band, a disc's edge in x. */
const brimDepth = (x, s, d) => d * s * Math.sqrt(Math.max(0, 1 - (x / (CAP.a * s)) ** 2));

/* Bent, the drawings still had nothing between them: from the side the cap
   was a sliver. So the cap gets thickness, like the garment boards: its
   front drawing's silhouette, filled from the bent front drawing back to
   the bent back drawing (the back drawn over the cap's own black, so the
   whole silhouette is cap), walled round in that black. Built in the head
   pivot's frame from the hat's two drawings; the flat planes are hidden. */
// (crossOrigin as three's TextureLoader asks: the same art then comes from
// the cache instead of a second download, seconds on a phone)
function loadImage(url) {
  return new Promise((ok, no) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = no; i.src = url; });
}
/* The wizard's hat (#33, HATS model "wizard"), built as a real hat rather
   than its drawing pushed out: pushed out, the cone was a thin fin from the
   side, its walls smeared the drawing into streaks and the brim was a flat
   slab (user, 2026-10-16: "fix the wizard hat for #33"). Like the NFT: a
   tapering cone round the crown that flops back and to the viewer's left
   with a drooping tip, on a wide, softly wavy brim, blue with yellow
   stars, cel-shaded, outlined by the ink pass. In the head pivot's frame
   (-z the front); `y` the brim's height, and the crown sized off the cap's
   ellipse (CAP) so it sits over the head like the caps. */
// crown: the base's half-width and its front and back (metres at scale 1: the
// face is 0.24 either side of the middle, its brow ~0.075 in front, the skull
// 0.19 behind); brim: its half-width and half-depth
const WIZARD = { blue: "#2532c9", under: "#151d8f", star: "#f6c52f", height: 0.46, bend: [0.24, 0.08], droop: 0.05,
  crown: [0.27, 0.1, 0.215], brim: [0.38, 0.33], wave: 0.014, sag: 0.022, thick: 0.012, stars: 14, band: 0.03 };
let wizardTex = null;
function wizardStars() {
  if (wizardTex) return wizardTex;
  const c = document.createElement("canvas"); c.width = 1024; c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = WIZARD.blue; g.fillRect(0, 0, c.width, c.height);
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let n = 0; n < WIZARD.stars; n++) {
    const x = rnd() * c.width, y = 40 + rnd() * (c.height - 80), r = 34 + rnd() * 16, rot = rnd() * Math.PI;
    for (const dx of [-c.width, 0, c.width]) {   // wrapped round the seam
      g.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = rot + (k * Math.PI) / 5, rr = k % 2 ? r * 0.45 : r;
        g.lineTo(x + dx + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      g.closePath();
      g.fillStyle = WIZARD.star; g.fill();
      g.lineWidth = 3; g.strokeStyle = "#0a0a0a"; g.stroke();
    }
  }
  wizardTex = new THREE.CanvasTexture(c);
  wizardTex.colorSpace = THREE.SRGBColorSpace;
  wizardTex.wrapS = wizardTex.wrapT = THREE.RepeatWrapping;
  wizardTex.anisotropy = 8;
  return wizardTex;
}
function wizardHat(y, s) {
  const W = WIZARD, map = wizardStars();
  const cloth = addRim(new THREE.MeshToonMaterial({ map, gradientMap: CLOTH_TONES, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.12 }));
  const under = toon(new THREE.Color(W.under).getHex());
  const ax = W.crown[0] * s, az = ((W.crown[1] + W.crown[2]) / 2) * s, zc = ((W.crown[2] - W.crown[1]) / 2) * s;
  const N = 48, K = 28, TAU = Math.PI * 2;
  // the cone: rings up a bent centre line, tapering to a drooping tip
  const pos = [], uv = [], idx = [];
  for (let k = 0; k <= K; k++) {
    // the centre line rises, leaning more and more to the side, and over
    // its last third flops sideways and a little down to a point
    const t = k / K, taper = Math.pow(1 - t, 0.9), flop = Math.max(0, t - 0.62) / 0.38;
    const cx = W.bend[0] * s * (t * t * 0.6 + flop * flop * 0.9), cz = zc + W.bend[1] * s * t * t;
    const cy = y + W.height * s * Math.min(t, 0.62 + 0.38 * Math.sin(flop * Math.PI / 2) * 0.55) - W.droop * s * flop * flop * flop;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * TAU;
      pos.push(cx + Math.cos(a) * ax * taper, cy, cz + Math.sin(a) * az * taper);
      uv.push(i / N, t * 0.9 + 0.05);
    }
  }
  for (let k = 0; k < K; k++) for (let i = 0; i < N; i++) {
    const a = k * (N + 1) + i, b = a + N + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const cone = new THREE.BufferGeometry();
  cone.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  cone.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  cone.setIndex(idx);
  cone.computeVertexNormals();
  // the brim: a ring from just inside the crown out to its wavy, sagging edge,
  // a top and an underside a few mm apart, joined round the rim
  const R = 10, bp = [], buv = [], top = [], bot = [], rim = [];
  const ring = (j, i, lower) => {
    const r = j / R, a = (i / N) * TAU;
    // (at r 0 just inside the crown: tucked under the cone)
    const rx = ax * 0.9 + (W.brim[0] * s - ax * 0.9) * r, rz = az * 0.9 + (W.brim[1] * s - az * 0.9) * r;
    const yy = y + (W.wave * s * Math.sin(3 * a + 0.6) - W.sag * s) * r * r - (lower ? W.thick * s : 0);
    bp.push(Math.cos(a) * rx, yy, zc + Math.sin(a) * rz);
    buv.push(0.5 + (Math.cos(a) * rx) / (0.62 * s), 0.5 + (Math.sin(a) * rz) / (0.31 * s));   // seen from above, so its stars keep their shape
  };
  for (const lower of [false, true]) for (let j = 0; j <= R; j++) for (let i = 0; i <= N; i++) ring(j, i, lower);
  const at = (lower, j, i) => (lower ? (R + 1) * (N + 1) : 0) + j * (N + 1) + i;
  for (let j = 0; j < R; j++) for (let i = 0; i < N; i++) {
    top.push(at(0, j, i), at(0, j, i + 1), at(0, j + 1, i), at(0, j, i + 1), at(0, j + 1, i + 1), at(0, j + 1, i));
    bot.push(at(1, j, i), at(1, j + 1, i), at(1, j, i + 1), at(1, j, i + 1), at(1, j + 1, i), at(1, j + 1, i + 1));
  }
  for (let i = 0; i < N; i++) rim.push(at(0, R, i), at(0, R, i + 1), at(1, R, i), at(0, R, i + 1), at(1, R, i + 1), at(1, R, i));
  const brim = new THREE.BufferGeometry();
  brim.setAttribute("position", new THREE.Float32BufferAttribute(bp, 3));
  brim.setAttribute("uv", new THREE.Float32BufferAttribute(buv, 2));
  brim.setIndex([...top, ...rim, ...bot]);
  brim.addGroup(0, top.length + rim.length, 0);
  brim.addGroup(top.length + rim.length, bot.length, 1);
  brim.computeVertexNormals();
  // the dark hatband round the cone's foot, a hair outside it
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.012, 1.03, W.band * s, N, 1, true), toon(0x0d1150));
  band.scale.set(ax, 1, az);
  band.position.set(0, y + (W.band / 2) * s + 0.002 * s, zc);
  const hat = new THREE.Group();
  for (const m of [new THREE.Mesh(cone, cloth), new THREE.Mesh(brim, [cloth, under]), band]) { m.castShadow = true; hat.add(m); }
  return hat;
}

/* The sheriff's cowboy hat (#1272, HATS model "cowboy"), modelled whole like
   the wizard's: a tall crown pinched in at the front with a crease down its
   top, a brown band with a gold star at the front, and a wide brim whose
   sides curl up and whose front and back dip, black felt cel-shaded, outlined
   by the ink pass. Sat low and tipped toward the NFT's art right (flipped
   back with the print on a mirrored head). In the head pivot's frame (-z the
   front), `y` the brim's height; the crown sized off the wizard's, which
   sits over the head like the caps. */
const COWBOY = { felt: 0x232326, under: 0x141416, band: 0x4e2e17, star: 0xf2bd38, height: 0.2, taper: 0.9,
  crease: 0.05, pinch: 0.035, brim: [0.43, 0.37], curl: 0.085, dip: 0.025, thick: 0.014, bandH: 0.04, tilt: 0.2 };
function cowboyHat(y, s) {
  const C = COWBOY, W = WIZARD;
  const felt = toon(C.felt), under = toon(C.under);
  const ax = W.crown[0] * s * 0.95, az = ((W.crown[1] + W.crown[2]) / 2) * s, zc = ((W.crown[2] - W.crown[1]) / 2) * s;
  const N = 48, K = 10, R = 8, TAU = Math.PI * 2;
  // the crown's top at (x, z): a crease down the middle, the front corners pinched in
  const topY = (x, z, r) => C.height * s + 0.02 * s * (1 - r * r)
    - C.crease * s * Math.exp(-((x / (0.07 * s)) ** 2)) * Math.max(0, 1 - 0.4 * r)
    - C.pinch * s * Math.exp(-(((Math.abs(x) - 0.12 * s) / (0.06 * s)) ** 2)) * Math.max(0, (zc - z) / az);
  const pos = [], idx = [];
  // the sides: rings up from the band to the top's edge, tapering in
  for (let k = 0; k <= K; k++) {
    const t = k / K, sc = 1 - (1 - C.taper) * t;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * TAU, x = Math.cos(a) * ax * sc, z = zc + Math.sin(a) * az * sc;
      pos.push(x, topY(Math.cos(a) * ax * C.taper, zc + Math.sin(a) * az * C.taper, 1) * t, z);
    }
  }
  for (let k = 0; k < K; k++) for (let i = 0; i < N; i++) {
    const a = k * (N + 1) + i, b = a + N + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  // the top: rings in from the edge to the middle, on the creased surface
  const top0 = pos.length / 3;
  for (let j = 0; j <= R; j++) {
    const r = 1 - j / R;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * TAU, x = Math.cos(a) * ax * C.taper * r, z = zc + Math.sin(a) * az * C.taper * r;
      pos.push(x, topY(x, z, r), z);
    }
  }
  for (let j = 0; j < R; j++) for (let i = 0; i < N; i++) {
    const a = top0 + j * (N + 1) + i, b = a + N + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const crown = new THREE.BufferGeometry();
  crown.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  crown.setIndex(idx);
  crown.computeVertexNormals();
  // the brim: from just inside the crown out to its edge, the sides curling
  // up and the front and back dipping, a top and an underside joined round the rim
  const RB = 10, bp = [], top = [], bot = [], rim = [];
  for (const lower of [false, true]) for (let j = 0; j <= RB; j++) for (let i = 0; i <= N; i++) {
    const r = j / RB, a = (i / N) * TAU, c = Math.cos(a), sn = Math.sin(a);
    const rx = ax * 0.9 + (C.brim[0] * s - ax * 0.9) * r, rz = az * 0.9 + (C.brim[1] * s - az * 0.9) * r;
    const yy = (C.curl * c * c - C.dip * sn * sn) * s * r * r * r - (lower ? C.thick * s : 0);
    bp.push(c * rx, yy, zc + sn * rz);
  }
  const at = (lower, j, i) => (lower ? (RB + 1) * (N + 1) : 0) + j * (N + 1) + i;
  for (let j = 0; j < RB; j++) for (let i = 0; i < N; i++) {
    top.push(at(0, j, i), at(0, j, i + 1), at(0, j + 1, i), at(0, j, i + 1), at(0, j + 1, i + 1), at(0, j + 1, i));
    bot.push(at(1, j, i), at(1, j + 1, i), at(1, j, i + 1), at(1, j, i + 1), at(1, j + 1, i), at(1, j + 1, i + 1));
  }
  for (let i = 0; i < N; i++) rim.push(at(0, RB, i), at(0, RB, i + 1), at(1, RB, i), at(0, RB, i + 1), at(1, RB, i + 1), at(1, RB, i));
  const brim = new THREE.BufferGeometry();
  brim.setAttribute("position", new THREE.Float32BufferAttribute(bp, 3));
  brim.setIndex([...top, ...rim, ...bot]);
  brim.addGroup(0, top.length + rim.length, 0);
  brim.addGroup(top.length + rim.length, bot.length, 1);
  brim.computeVertexNormals();
  // the band round the crown's foot, a hair outside it
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.025, C.bandH * s, N, 1, true), toon(C.band));
  band.scale.set(ax, 1, az);
  band.position.set(0, (C.bandH / 2) * s + 0.002 * s, zc);
  // the gold star on the band's front, a step off the crown's middle (the
  // NFT's art right), an ink star behind it for its outline
  const star = new THREE.Shape();
  for (let k = 0; k < 10; k++) {
    const a = Math.PI / 2 + (k * Math.PI) / 5, rr = (k % 2 ? 0.42 : 1) * 0.026 * s;
    k ? star.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : star.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const starGeo = new THREE.ExtrudeGeometry(star, { depth: 0.006 * s, bevelEnabled: false });
  const sx = -0.1 * s, sz = zc - az * 1.03 * Math.sqrt(1 - (sx / ax) ** 2);
  const starM = new THREE.Mesh(starGeo, toon(C.star));
  const starInk = new THREE.Mesh(starGeo, new THREE.MeshBasicMaterial({ color: INK }));
  starInk.scale.set(1.35, 1.35, 0.5);
  for (const m of [starM, starInk]) {
    m.position.set(sx, (C.bandH / 2) * s, sz - (m === starM ? 0.006 * s : 0));
    m.rotation.y = Math.PI + Math.atan2(sx / ax, 1) * 0.5;
  }
  const hat = new THREE.Group();
  for (const m of [new THREE.Mesh(crown, felt), new THREE.Mesh(brim, [felt, under]), band, starM, starInk]) { m.castShadow = true; hat.add(m); }
  hat.position.y = y;
  hat.rotation.z = C.tilt;
  return hat;
}

async function capVolume(id, plane, centreY, s) {
  const { width: w, height: h } = plane.geometry.parameters;
  const y0 = plane.position.y - h / 2;
  const hat = HATS[id] || HATS["hat-goatfarm"];
  // a hat modelled whole (the wizard's), the brim just under its band's top (on the brow, like the NFT)
  if (hat.model === "wizard") return wizardHat(y0 + h - ((hat.brim[0] + 45) / 1033) * h, s);
  if (hat.model === "cowboy") return cowboyHat(y0 + h - ((hat.brim[0] + 45) / 1033) * h, s);
  // the brim band in the plane's y (frame y runs down from the plane's top)
  const frameY = (Y) => y0 + h - (Y / 1033) * h;
  const brim = hat.brim ? [frameY(hat.brim[1]), frameY(hat.brim[0])] : null;
  const ease = hat.brim ? (hat.ease / 1033) * h : 0;
  // 0 off the brim, 1 on it, eased at its edges
  const onBrim = (y) => !brim ? 0 : Math.max(0, Math.min(1, Math.min(y - brim[0] + ease, brim[1] + ease - y) / (2 * ease)));
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
  bg.globalCompositeOperation = "source-in"; bg.fillStyle = hat.ink; bg.fillRect(0, 0, W, H);
  bg.globalCompositeOperation = "source-over"; bg.drawImage(bImg, 0, 0, W, H);
  const tex = (src) => { const t = src instanceof HTMLCanvasElement ? new THREE.CanvasTexture(src) : new THREE.Texture(src); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; return t; };
  // shaded in bands like the cloth and the face, and solid: lit as a
  // standard (glossy) surface it took on the menu's orange sun and a black
  // cap read as see-through (user, 2026-10-16). The cut-out edge is the
  // alphaTest alone, so it needn't blend.
  const cloth = (t) => addRim(new THREE.MeshToonMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.22, gradientMap: CLOTH_TONES, alphaTest: 0.5, side: THREE.DoubleSide }));
  const mats = [cloth(tex(fImg)), cloth(tex(bc)), toon(parseInt(hat.ink.slice(1), 16))];
  mats[2].side = THREE.DoubleSide;
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
  // (off the brim, a hat without one: no brimDepth to mix, it's NaN)
  const mix = (a, b, t) => (t > 0 ? a + (b - a) * t : a);
  const zF = (x, y) => -(0.004 * s + mix(capDepth(x, y, centreY, s, CAP.front, top(x)), brimDepth(x, s, hat.brimFront), onBrim(y)));
  const zB = (x, y) => 0.006 * s + (hat.brimBack == null ? capDepth(x, y, centreY, s, CAP.back, top(x)) : mix(capDepth(x, y, centreY, s, CAP.back, top(x)), brimDepth(x, s, hat.brimBack), onBrim(y)));
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

/* A beard's drawing (traits.js: a tall flat plane over the face, frame rows
   0..1300, the head's 1033 and the hang below the chin) as hair GROWN OUT
   OF THE FACE (user, 2026-10-15: "it needs to look good ... like its
   attached to the trollface itself, not attached in front of it"):
     - its back lies on the relief head's own surface (read off the head's
       vertices into a height map), sunk a hair into it, so there's no gap
       and no ledge where the face and the beard meet;
     - its thickness grows from nothing at every edge (a distance field over
       the drawing's silhouette) to a full mass in the middle, so round the
       grin it's flush with the face and swells away from it;
     - past the face's edge the sideburns carry on round the jaw toward the
       ears, and under the chin it hangs down over the chest, resting on it;
     - it's shaded in bands like the face (the same toon tones), so the two
       read as one surface.
   Built in the head pivot's frame (-z the front), once the relief head is on. */
/* The trollface's jaw: the bottom of the face art's silhouette in each
   column ([head frame x, row]), measured off trollface transparent.png. */
const JAW = [[0, 877], [175, 877], [200, 906], [250, 930], [300, 935], [350, 932], [400, 923], [450, 911], [500, 901],
  [550, 885], [600, 855], [650, 830], [700, 805], [750, 771], [800, 715], [850, 634], [875, 596], [1000, 560]];
const BEARD = {
  dark: "#3d1e09",
  curl: 0.75,        // past the face's edge, how far back the sideburns go per metre out (pivot frame)
  chin: [860, 1080], // frame rows from the jaw down, where it stops wrapping the jaw and drapes onto the chest
  chest: { front: 0.135, top: 0.05 }, // the block chest's front (pecs) and top, chest-local metres (blocky/torso-muscle.glb)
  rest: 0.008,       // the hang's back, off the shirt
  soft: 0.035,       // how softly the jaw's surface turns into the chest's
  thick: [0.028, 0.06], // the mass at its fullest on the jaw and in the hang
  taper: 0.045,      // how far in from an edge it takes to reach that (metres)
  sink: 0.003,       // its back, into the face
  ride: [900, 1110], // frame rows over which it hands over from the head to the chest (beardRide)
  // where the drawing ends under the jaw (hemmed), clear of the shirt: the
  // trollface's own jaw line, `margin` rows below it and `chin` [x, width,
  // rows] lower again under the chin (user, 2026-10-16: "the beard doesnt
  // follow the path of the trollface shape"; the old cut was a symmetric
  // curve, and the jaw slants from row ~935 on the left to ~770 on the right)
  hem: { jaw: JAW, margin: 60, chin: [480, 140, 50] },
  tint: [0.42, 0.56, 0.8], // the material's colour (r, g, b), so the lit beard reads the NFT's brown, not ginger (beardVolume)
};
/* Every facial built as a shell on the face this way (BEARDS.md 8), by
   trait id: the beard, and a bandana mask (a thin shell, its point hanging
   onto the neck). reliefHead swaps these in for their flat cards. */
const SHELLS = {
  "facial-beard-brown": BEARD,
  "facial-face-mask-umadbro": { ...BEARD, tint: 1, dark: "#0b0b0c", curl: 0.9, chin: [880, 1100], rest: 0.004,
    thick: [0.0045, 0.006], taper: 0.01, ride: [920, 1120],
    // a thin shell lies OFF the face (the nose and the grin's relief poked through), no depth image
    // (the mask keeps the symmetric cut it was approved with)
    sink: 0.002, lift: 0.008, depth: false, hem: { row: 960, rise: 110 } },
  // the blindfold: a cloth band moulded onto the face like the mask, its
  // ends wrapping round past the face's sides (as a card bent round an
  // ellipse it stood off the temples like a plank; user, 2026-10-16), the
  // back card (its knot) kept; head-frame rows, no hang, no hem
  "eyes-blindfold": { ...BEARD, tint: 1, dark: "#6f6550", curl: 0.9, rows: 1033, chin: [2000, 2100], ride: [2000, 2100], rest: 0.004,
    thick: [0.004, 0.005], taper: 0.01, sink: 0.002, lift: 0.006, depth: false, hem: null, keepBack: true },
  // the French Moustache the same way: as a card its curled tips stood off
  // past the cheeks in 3/4 view (user, 2026-10-16); moulded on, they lie on
  // the face and turn back round its sides
  "facial-french-moustache": { ...BEARD, tint: 1, dark: "#0b0b0c", curl: 0.9, rows: 1033, chin: [2000, 2100], ride: [2000, 2100], rest: 0.004,
    thick: [0.003, 0.004], taper: 0.006, sink: 0.002, lift: 0.005, depth: false, hem: null },
};
/* A shell's drawing cut off along its hem, feathered over `soft` rows so
   alphaTest leaves a smooth edge: either along the jaw (`jaw`: [frame x,
   row] points, plus `margin` and the `chin` drop) or at frame row `row`
   mid-chin, `rise` rows higher at the drawing's sides (a parabola). No hem:
   the drawing as it is. */
function hemmed(img, hem, rows) {
  if (!hem) return img;
  const c = document.createElement("canvas");
  c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), px = d.data, soft = hem.soft ?? 14;
  // the cut's row in each column of the drawing (its x is the head frame's, 1000 wide)
  const cut = new Float32Array(c.width);
  for (let x = 0; x < c.width; x++) {
    const fx = (x + 0.5) / c.width * 1000;
    if (hem.jaw) {
      const j = hem.jaw, i = Math.max(1, Math.min(j.length - 1, j.findIndex(([jx]) => jx >= fx)));
      const [x0, r0] = j[i - 1], [x1, r1] = j[i];
      const [cx, cw, cd] = hem.chin || [0, 1, 0];
      cut[x] = r0 + (r1 - r0) * Math.max(0, Math.min(1, (fx - x0) / (x1 - x0))) + (hem.margin || 0) + cd * Math.exp(-(((fx - cx) / cw) ** 2));
    } else {
      const u = fx / 500 - 1;
      cut[x] = hem.row - hem.rise * u * u;
    }
  }
  const top = Math.min(...cut) - soft;
  for (let y = 0; y < c.height; y++) {
    const r = (y + 0.5) / c.height * rows;
    if (r < top) continue;
    for (let x = 0; x < c.width; x++) {
      const k = 1 - smooth01(cut[x] - soft, cut[x], r);
      if (k < 1) px[(y * c.width + x) * 4 + 3] *= k;
    }
  }
  g.putImageData(d, 0, 0);
  return c;
}
/* Eye traits worn OVER a shell facial (sunglasses over a face mask): their
   card stands this much further out than the relief's front (metres). */
const OVER_SHELL = { "eyes-glasses-thug": 0.016 };
/* The beard rides two joints (BEARDS.md 1): the jaw on the head, the hang
   on the chest, and between them a blend, so when the head looks down or
   welds to a rifle stock the hang stays draped on the chest instead of
   swinging into it. Each vertex has a weight (chestW, 0 the head, 1 the
   chest) and a uniform carries the chest's move since the build, in the
   head pivot's frame (beardRide, set every frame by rideUpdate). */
function rideMaterial(material, ride) {
  material.userData.ride = ride;
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    prev?.call(material, sh, r);
    sh.uniforms.beardRide = ride;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float chestW;\nuniform mat4 beardRide;")
      .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\n  objectNormal = normalize(mix(objectNormal, mat3(beardRide) * objectNormal, chestW));")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n  transformed = mix(transformed, (beardRide * vec4(transformed, 1.0)).xyz, chestW);");
  };
  material.customProgramCacheKey = () => "beard-ride";
  return material;
}
/* The beard's ink outline from every angle (BEARDS.md 3): the arms' trick,
   its front pushed out along its normals and drawn black from behind, so
   only its silhouette shows. Each vertex's push is scaled by inkW: 0 where
   the beard lies on the face (no ink ring round the grin: the hair grows
   out of the face), 1 past the face's edge and down the hang. It rides the
   chest like the beard (beardRide). */
const BEARD_INK = 0.0065;
function beardInk(ride) {
  const m = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.beardRide = ride;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float chestW;\nattribute float inkW;\nuniform mat4 beardRide;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
  vec3 inkN = normalize(mix(normal, mat3(beardRide) * normal, chestW));
  transformed = mix(transformed, (beardRide * vec4(transformed, 1.0)).xyz, chestW) + inkN * ${BEARD_INK.toFixed(4)} * inkW;`);
  };
  m.customProgramCacheKey = () => "beard-ink";
  return m;
}
const smooth01 = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
/* The relief head's front surface as a height map over the rectangle
   [x0, x0 + w] x [y0, y0 + h] of `frame` (an Object3D the result is in):
   for each of gw x gh bins, the frontmost z (most negative) of the head's
   vertices there, the empty bins filled out from their filled neighbours,
   with how far (metres) each lies outside the head. */
function headHeights(head, frame, x0, y0, w, h, gw, gh) {
  head.updateMatrixWorld(true);
  frame.updateMatrixWorld(true);
  const toFrame = new THREE.Matrix4().copy(frame.matrixWorld).invert();
  const m = new THREE.Matrix4(), v = new THREE.Vector3();
  const z = new Float32Array(gw * gh).fill(Infinity);
  head.traverse((o) => {
    if (!o.isMesh || o.material === armInk) return;
    m.multiplyMatrices(toFrame, o.matrixWorld);
    const pos = o.geometry.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      v.fromBufferAttribute(pos, k).applyMatrix4(m);
      const i = Math.floor((v.x - x0) / w * gw), j = Math.floor((v.y - y0) / h * gh);
      if (i < 0 || j < 0 || i >= gw || j >= gh) continue;
      if (v.z < z[j * gw + i]) z[j * gw + i] = v.z;
    }
  });
  // the head's own bins; the back half's vertices never win (front is -z)
  const out = new Float32Array(gw * gh).fill(Infinity);
  for (let k = 0; k < z.length; k++) if (z[k] < 0) out[k] = 0; else z[k] = Infinity;
  // fill outward a ring at a time: each empty bin takes its filled
  // neighbours' mean, one bin further out than the nearest of them
  const cell = Math.hypot(w / gw, h / gh) / Math.SQRT2;
  for (let ring = 0, filled = true; filled && ring < gw + gh; ring++) {
    filled = false;
    const nz = z.slice(), no = out.slice();
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const k = j * gw + i;
      if (z[k] !== Infinity) continue;
      let sum = 0, n = 0, best = Infinity;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= gw || b >= gh) continue;
        const q = b * gw + a;
        if (z[q] === Infinity) continue;
        sum += z[q]; n++; best = Math.min(best, out[q]);
      }
      if (n) { nz[k] = sum / n; no[k] = best + cell; filled = true; }
    }
    z.set(nz); out.set(no);
  }
  // two passes of smoothing on the head's own bins (bins straddling the
  // dome's sculpted grooves read as speckle)
  for (let pass = 0; pass < 2; pass++) {
    const nz = z.slice();
    for (let j = 1; j < gh - 1; j++) for (let i = 1; i < gw - 1; i++) {
      const k = j * gw + i;
      nz[k] = (z[k] * 4 + z[k - 1] + z[k + 1] + z[k - gw] + z[k + gw]) / 8;
    }
    z.set(nz);
  }
  const at = (arr, x, y) => {
    const fx = Math.max(0, Math.min(gw - 1.001, (x - x0) / w * gw - 0.5)), fy = Math.max(0, Math.min(gh - 1.001, (y - y0) / h * gh - 0.5));
    const i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j, k = j * gw + i;
    return (arr[k] * (1 - tx) + arr[k + 1] * tx) * (1 - ty) + (arr[k + gw] * (1 - tx) + arr[k + gw + 1] * tx) * ty;
  };
  return { z: (x, y) => at(z, x, y), outside: (x, y) => at(out, x, y) };
}
/* The beard's shape, built once per beard and rig scale and shared by every
   rig wearing it (BEARDS.md 4): its geometry (front, back and ink shell,
   only the nodes its cells use), its two textures, and the chest-to-pivot
   transform it was fitted to (each rig's ride is measured from that). Built
   off the first rig to wear it; the relief head is the same on every rig,
   and so, near enough, is the chest's place under the head at rest. */
const beardShapes = new Map();
function beardShape(id, plane, s, head, pivot, chest, joints) {
  const key = `${id}|${s}`;
  if (!beardShapes.has(key)) beardShapes.set(key, buildBeard(id, plane, s, head, pivot, chest, joints).catch((e) => { beardShapes.delete(key); throw e; }));
  return beardShapes.get(key);
}
async function buildBeard(id, plane, s, head, pivot, chest, joints) {
  const BEARD = SHELLS[id];
  const { width: w, height: h } = plane.geometry.parameters;
  const top = plane.position.y + h / 2, bottom = top - h;
  const rows = BEARD.rows ?? 1300; // the drawing's frame height (a beard's tall frame; an eye band the head frame)
  const fImg = await loadImage(new URL(`${id}.png?v=${ART_V}`, DIR).href);
  // its depth (<id>.depth.png, BEARDS.md 2): how full the hair is where,
  // white the fullest; a beard without one gets the plain profile
  const dImg = BEARD.depth === false ? null : await loadImage(new URL(`${id}.depth.png?v=${ART_V}`, DIR).href).catch(() => null);
  const W = 512, H = Math.round(512 * h / w);
  // the hem (user, 2026-10-15: "part of the lower facial asset goes into the
  // upper torso ... we want there to be some feel of separation"): the
  // drawing ends on a curve under the jaw, lowest mid-chin and rising
  // toward the ears, so the face reads as one piece and the shirt another
  const art = hemmed(fImg, (globalThis.SHELL_HEM || {})[id] || BEARD.hem, rows);
  const mc = document.createElement("canvas"); mc.width = W; mc.height = H;
  const mg = mc.getContext("2d", { willReadFrequently: true });
  mg.drawImage(art, 0, 0, W, H);
  const alpha = mg.getImageData(0, 0, W, H).data;
  const inside = (u, v) => {
    const i = Math.min(W - 1, Math.max(0, Math.floor(u * W))), j = Math.min(H - 1, Math.max(0, Math.floor((1 - v) * H)));
    return alpha[(j * W + i) * 4 + 3] > 128;
  };
  // the back: the silhouette in the hair's dark
  const bc = document.createElement("canvas"); bc.width = W; bc.height = H;
  const bg = bc.getContext("2d");
  bg.drawImage(mc, 0, 0);
  bg.globalCompositeOperation = "source-in"; bg.fillStyle = BEARD.dark; bg.fillRect(0, 0, W, H);
  const tex = (src) => { const t = src instanceof HTMLCanvasElement ? new THREE.CanvasTexture(src) : new THREE.Texture(src); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; return t; };
  // A coarser grid than the drawing needs: the drawing's own alpha makes the
  // edge, the grid only carries the depth (130 across: ~5 mm cells)
  const N = 130, M = Math.round(N * h / w);
  const X = (i) => -w / 2 + (w * i) / N, Y = (j) => bottom + (h * j) / M;
  const uF = (x) => 0.5 - x / w, V = (y) => (y - bottom) / h;
  const row = (y) => (top - y) / h * rows;     // pivot y -> frame row
  const mask = new Uint8Array(N * M);
  for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) mask[j * N + i] = inside(uF((X(i) + X(i + 1)) / 2), V((Y(j) + Y(j + 1)) / 2)) ? 1 : 0;
  const cell = (i, j) => i >= 0 && j >= 0 && i < N && j < M && mask[j * N + i] === 1;
  // Each cell's distance in from the silhouette's edge (metres): a two-pass
  // chamfer over the mask
  const dw = w / N, dh = h / M, dd = Math.hypot(dw, dh);
  const dist = new Float32Array(N * M);
  for (let k = 0; k < dist.length; k++) dist[k] = mask[k] ? 1e9 : 0;
  const relax = (i, j, a, b, d) => { const k = j * N + i; if (a < 0 || b < 0 || a >= N || b >= M) { dist[k] = Math.min(dist[k], d / 2); return; } dist[k] = Math.min(dist[k], dist[b * N + a] + d); };
  for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) if (mask[j * N + i]) { relax(i, j, i - 1, j, dw); relax(i, j, i, j - 1, dh); relax(i, j, i - 1, j - 1, dd); relax(i, j, i + 1, j - 1, dd); }
  for (let j = M - 1; j >= 0; j--) for (let i = N - 1; i >= 0; i--) if (mask[j * N + i]) { relax(i, j, i + 1, j, dw); relax(i, j, i, j + 1, dh); relax(i, j, i + 1, j + 1, dd); relax(i, j, i - 1, j + 1, dd); }
  // at a grid node: the mean of the cells round it (0 off the silhouette)
  const nodeDist = (i, j) => {
    let sum = 0;
    for (const [a, b] of [[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]]) if (a >= 0 && b >= 0 && a < N && b < M) sum += dist[b * N + a];
    return sum / 4;
  };
  // The head's front surface, and how far outside the head each point is
  const H2 = headHeights(head, pivot, -w / 2, bottom, w, h, 72, Math.round(72 * h / w));
  // The chest's front in this frame, at pivot height y: the point on the
  // chest joint's front (its top rounded off) brought into the pivot's frame
  // (at the pose it's built in; each rig's ride is measured from it)
  pivot.updateMatrixWorld(true); chest.updateMatrixWorld(true);
  const toChest = new THREE.Matrix4().copy(chest.matrixWorld).invert().multiply(pivot.matrixWorld);
  const toPivot = new THREE.Matrix4().copy(toChest).invert();
  const cv = new THREE.Vector3();
  // (a rig not posed yet has no usable matrices: then no chest to rest on)
  const posed = toChest.elements.every(Number.isFinite) && Math.abs(toChest.determinant()) > 1e-9;
  // Measured where it can be (BEARDS.md 9, "measure, don't guess"): rays
  // straight back through this frame onto the chest joint's own meshes (not
  // the head, arms or anything on another joint; the torso's big flat faces
  // have no vertices mid-chest to bin). Each point takes the most forward
  // hit from its height up to `lift` above, so the hair rolls over the
  // block's rounded top edge instead of tucking behind it (the formula
  // below put that edge 2 cm low: a band of shirt across the beard).
  const CG = 40, cgh = Math.round(CG * h / w), cz = new Float32Array(CG * cgh).fill(Infinity);
  if (posed) {
    const meshes = [];
    chest.traverse((o) => {
      if (!o.isMesh || !o.visible || o.material === armInk) return;
      for (let q = o; q && q !== chest; q = q.parent) if (!q.visible || q === pivot || joints?.has(q)) return;
      meshes.push(o);
    });
    const ray = new THREE.Raycaster(), o3 = new THREE.Vector3(), d3 = new THREE.Vector3(0, 0, 1).transformDirection(pivot.matrixWorld);
    const toPiv = new THREE.Matrix4().copy(pivot.matrixWorld).invert();
    for (let j = 0; j < cgh && meshes.length; j++) for (let i = 0; i < CG; i++) {
      o3.set(-w / 2 + (i + 0.5) * w / CG, bottom + (j + 0.5) * h / cgh, -1).applyMatrix4(pivot.matrixWorld);
      ray.set(o3, d3);
      const hit = ray.intersectObjects(meshes, false)[0];
      if (hit) cz[j * CG + i] = hit.point.applyMatrix4(toPiv).z;
    }
  }
  const measured = cz.some(Number.isFinite), lift = Math.ceil(0.025 * s / (h / cgh));
  // each bin: the most forward hit from it up to `lift` above (and a column
  // either side), then read bilinearly, so the hang has no steps
  const cl = new Float32Array(CG * cgh).fill(Infinity);
  for (let j = 0; j < cgh; j++) for (let i = 0; i < CG; i++) {
    let best = Infinity;
    for (let b = j; b <= Math.min(cgh - 1, j + lift); b++)
      for (let a = Math.max(0, i - 1); a <= Math.min(CG - 1, i + 1); a++) best = Math.min(best, cz[b * CG + a]);
    cl[j * CG + i] = best;
  }
  const chestZ = (x, y) => {
    if (!posed) return Infinity;
    if (measured) {
      const fx = Math.max(0, Math.min(CG - 1.001, (x + w / 2) / w * CG - 0.5)), fy = Math.max(0, Math.min(cgh - 1.001, (y - bottom) / h * cgh - 0.5));
      const i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j, k = j * CG + i;
      const c = [cl[k], cl[k + 1], cl[k + CG], cl[k + CG + 1]], wt = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty];
      // off the chest's edge on some corners: the ones on it, if any
      let sum = 0, n = 0;
      for (let q = 0; q < 4; q++) if (isFinite(c[q])) { sum += c[q] * wt[q]; n += wt[q]; }
      return n > 0.25 ? sum / n - BEARD.rest * s : Infinity;
    }
    cv.set(x, y, 0).applyMatrix4(toChest);
    const over = (cv.y - (BEARD.chest.top * s - 0.06 * s)) / (0.06 * s);   // 0 below the shoulders' rounding, 1 at the top
    if (over >= 1) return Infinity;
    const zc = -BEARD.chest.front * s * Math.sqrt(1 - Math.max(0, over) ** 2) - BEARD.rest * s;
    cv.z = zc;
    return cv.applyMatrix4(toPivot).z;
  };
  // smooth min of two depths (the more forward, -z, wins), rounded over k
  const smin = (a, b, k) => { if (!isFinite(b)) return a; const t = Math.max(0, Math.min(1, 0.5 + 0.5 * (b - a) / k)); return b * (1 - t) + a * t - k * t * (1 - t); };
  const back = (x, y) => {
    const r = row(y);
    // past the face's edge: on round the jaw toward the ears, above the
    // chin; from the chin down it lies on whichever is further forward,
    // the jaw it grows from or the chest it drapes over
    const side = 1 - smooth01(BEARD.chin[0] - 60, BEARD.chin[1], r);
    const jaw = H2.z(x, y) + (BEARD.sink - (BEARD.lift || 0)) * s + side * BEARD.curl * H2.outside(x, y);
    return side >= 1 ? jaw : smin(jaw, chestZ(x, y), BEARD.soft * s);
  };
  let full = (x, y) => s * (BEARD.thick[0] + (BEARD.thick[1] - BEARD.thick[0]) * smooth01(BEARD.chin[0], BEARD.chin[1] + 80, row(y)));
  if (dImg) {
    const dc = document.createElement("canvas"); dc.width = 128; dc.height = Math.round(128 * h / w);
    const dg = dc.getContext("2d", { willReadFrequently: true });
    dg.drawImage(dImg, 0, 0, dc.width, dc.height);
    const dpx = dg.getImageData(0, 0, dc.width, dc.height).data, DW = dc.width, DH = dc.height;
    const at = (u, v) => {   // bilinear, the red channel
      const fx = Math.max(0, Math.min(DW - 1.001, u * DW - 0.5)), fy = Math.max(0, Math.min(DH - 1.001, (1 - v) * DH - 0.5));
      const i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j, k = (j * DW + i) * 4;
      return ((dpx[k] * (1 - tx) + dpx[k + 4] * tx) * (1 - ty) + (dpx[k + DW * 4] * (1 - tx) + dpx[k + DW * 4 + 4] * tx) * ty) / 255;
    };
    full = (x, y) => s * BEARD.thick[1] * at(uF(x), V(y));
  }
  // The cells: drawn when it or a neighbour is beard (the faces run a cell
  // past the silhouette, so the drawing's own smooth outline, its alpha,
  // makes the edge, not the grid's steps: the hat's trick, capVolume); the
  // ink shell on the beard's own cells, where they leave the face
  const drawCell = (i, j) => { for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (cell(i + di, j + dj)) return true; return false; };
  const inkOf = (i, j) => smooth01(0, 0.012 * s, H2.outside(X(i), Y(j)));
  // Only the nodes those cells use get a vertex (two each: front and back)
  const slot = new Int32Array((N + 1) * (M + 1)).fill(-1);
  const nodes = [];
  const use = (i, j) => { const g = j * (N + 1) + i; if (slot[g] < 0) { slot[g] = nodes.length; nodes.push([i, j]); } return slot[g]; };
  const quads = [], inkQuads = [];
  for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) {
    if (!drawCell(i, j)) continue;
    const q = [use(i, j), use(i + 1, j), use(i + 1, j + 1), use(i, j + 1)];
    quads.push(q);
    if (cell(i, j) && (inkOf(i, j) || inkOf(i + 1, j) || inkOf(i + 1, j + 1) || inkOf(i, j + 1))) inkQuads.push(q);
  }
  const NN = nodes.length;
  const pos = new Float32Array(NN * 2 * 3), uv = new Float32Array(NN * 2 * 2), wgt = new Float32Array(NN * 2), inkW = new Float32Array(NN * 2);
  nodes.forEach(([i, j], k) => {
    const x = X(i), y = Y(j);
    const zb = back(x, y);
    const zf = zb - BEARD.sink * s - full(x, y) * smooth01(0, BEARD.taper * s, nodeDist(i, j));
    pos.set([x, y, zf], k * 3);
    pos.set([x, y, zb], (NN + k) * 3);
    uv.set([uF(x), V(y)], k * 2);
    uv.set([uF(x), V(y)], (NN + k) * 2);
    wgt[k] = wgt[NN + k] = posed ? smooth01(BEARD.ride[0], BEARD.ride[1], row(y)) : 0;
    inkW[k] = inkOf(i, j);
  });
  const fIdx = [], bIdx = [], hIdx = [];
  for (const [a, b, c, d] of quads) {
    fIdx.push(a, d, c, a, c, b);
    bIdx.push(NN + a, NN + b, NN + c, NN + a, NN + c, NN + d);
  }
  for (const [a, b, c, d] of inkQuads) hIdx.push(a, d, c, a, c, b);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setAttribute("chestW", new THREE.BufferAttribute(wgt, 1));
  geo.setIndex([...fIdx, ...bIdx]);
  geo.addGroup(0, fIdx.length, 0);
  geo.addGroup(fIdx.length, bIdx.length, 1);
  geo.computeVertexNormals();
  // the ink shell shares the beard's attributes
  const hull = new THREE.BufferGeometry();
  for (const k of ["position", "normal", "chestW"]) hull.setAttribute(k, geo.attributes[k]);
  hull.setAttribute("inkW", new THREE.BufferAttribute(inkW, 1));
  hull.setIndex(hIdx);
  // every rig wearing it shares these (remote-players.js dispose skips them)
  geo.userData.shared = hull.userData.shared = true;
  return { geo, hull, front: tex(art), back: tex(bc), toChest, posed };
}
/* One rig's beard: the shared shape in this rig's own materials, riding
   this rig's chest. */
async function beardVolume(id, plane, s, head, pivot, chest, joints) {
  const B = await beardShape(id, plane, s, head, pivot, chest, joints);
  const ride = { value: new THREE.Matrix4() };
  // shaded in bands like the relief face (reliefHead), so they read as one
  const mats = [
    rideMaterial(addRim(new THREE.MeshToonMaterial({ map: B.front, emissive: 0xffffff, emissiveMap: B.front, emissiveIntensity: 0.22, gradientMap: CLOTH_TONES, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide })), ride),
    rideMaterial(drawn(B.back, { transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, emissiveIntensity: 0.35 }), ride),
  ];
  // The lights push a drawn colour well past the art (a white face just
  // clips): the Beard Brown came out ginger (user, 2026-10-16). `tint`
  // takes it back down to the NFT's brown, front and back alike.
  const tint = [].concat(SHELLS[id].tint ?? 1);   // one factor, or [r, g, b]
  const k = new THREE.Color(...(tint.length === 3 ? tint : [tint[0], tint[0], tint[0]]));
  for (const m of mats) { m.color.multiply(k); m.emissive.multiply(k); }
  const mesh = new THREE.Mesh(B.geo, mats);
  mesh.castShadow = true;
  mesh.renderOrder = 2;
  const ink = new THREE.Mesh(B.hull, beardInk(ride));
  ink.renderOrder = 2;
  mesh.add(ink);
  // the chest's move since the build, in the pivot's frame: a point glued
  // to the chest at the build is at inverse(toChest now) * toChest(build)
  const now = new THREE.Matrix4();
  mesh.onBeforeRender = () => {
    if (!B.posed) return;
    now.copy(chest.matrixWorld).invert().multiply(pivot.matrixWorld).invert();
    ride.value.multiplyMatrices(now, B.toChest);
  };
  mesh.userData.ride = ride;
  return mesh;
}

/* The face board swapped for the relief head (user: "There should be a
   little bit of 3d dept to the trollface"): the same art and outline, a
   shallow dome in front, a plain skull behind. Its face wears the board's
   own live material (so expressions and face cosmetics carry on); the board
   and the drawn skull back (traits.js) are hidden; the drawn traits move
   out onto the dome and the skull. Returns the added objects, and a
   function that puts it all back. */
/* The face's ink hull round its rim only (user, 2026-10-15: the farmer's
   nose "looks cracked"): the pushed-out back faces poked through the
   sculpted nostril's crease as black spikes. The drawing already inks the
   face's front, so the hull's triangles facing the way the face does (its
   mean normal) are dropped; the silhouette, where the outline shows, keeps
   them. Built once per hull. */
const rimInks = new WeakMap();
function rimInk(hull, face) {
  if (rimInks.has(hull)) return rimInks.get(hull);
  const fn = face.attributes.normal, front = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i < fn.count; i++) front.add(v.fromBufferAttribute(fn, i));
  front.normalize();
  const n = hull.attributes.normal, idx = hull.index, keep = [];
  const facing = (i) => v.fromBufferAttribute(n, i).dot(front) > 0.55;
  if (n && idx) for (let t = 0; t < idx.count; t += 3) {
    const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
    if (!(facing(a) && facing(b) && facing(c))) keep.push(a, b, c);
  }
  const rim = n && idx ? hull.clone() : hull;
  if (rim !== hull) { rim.setIndex(keep); rim.userData.shared = true; }
  rimInks.set(hull, rim);
  return rim;
}
/* A trait card bent round the head (build_blocky_head FRONT, BACK): across
   x it falls from the dome or the skull toward the board, an ellipse of
   half-width SKULL_HALF, so a band hugs the skull and glasses the face.
   Once per plane. */
const SKULL_HALF = 0.25;
function wrapCard(plane, s, depth) {
  const { width: w, height: h } = plane.geometry.parameters;
  const geo = new THREE.PlaneGeometry(w, h, 40, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const k = Math.min(1, Math.abs(pos.getX(i)) / (SKULL_HALF * s));
    pos.setZ(i, -depth * s * (1 - Math.sqrt(1 - k * k)));
  }
  geo.computeVertexNormals();
  plane.geometry = geo;
  plane.userData.wrapped = true;
}

/* The face's triangles above the hairline, pushed out along their
   normals, as one mesh in `mat`. The hairline comes down in points (the
   fringe's spikes onto the forehead, like the NFT's), from `top` between
   them to `low` at their tips, `points` across the face (user, 2026-10-17:
   a straight band looked bad). Built once per face. */
const HAIRLINE = { top: 0.13, low: 0.07, points: 5, x: [-0.22, 0.22], out: 0.003 };
// `h`: a head's own heights (HEAD_MODELS hairline), over HAIRLINE's
const hairlineY = (x, h) => {
  const [x0, x1] = HAIRLINE.x, f = ((x - x0) / (x1 - x0)) * HAIRLINE.points;
  const t = Math.abs((f - Math.floor(f)) * 2 - 1);   // 1 between points, 0 at a tip
  const { top, low } = { ...HAIRLINE, ...h };
  return low + (top - low) * t;
};
const hairlines = new WeakMap();
function hairline(faceGeo, mat, h) {
  if (!hairlines.has(faceGeo)) {
    const pos = faceGeo.attributes.position, nrm = faceGeo.attributes.normal, idx = faceGeo.index;
    const keep = [];
    const n = idx ? idx.count : pos.count, at = (i) => (idx ? idx.getX(i) : i);
    for (let t = 0; t < n; t += 3) {
      const a = at(t), b = at(t + 1), c = at(t + 2);
      const above = (i) => pos.getY(i) > hairlineY(pos.getX(i), h);
      if (above(a) && above(b) && above(c)) keep.push(a, b, c);
    }
    const p = pos.array.slice();
    if (nrm) for (let i = 0; i < pos.count; i++) for (let k = 0; k < 3; k++) p[i * 3 + k] += nrm.array[i * 3 + k] * HAIRLINE.out;
    const geo = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(p, 3)).setIndex(keep);
    geo.computeVertexNormals();
    geo.userData.shared = true;
    hairlines.set(faceGeo, geo);
  }
  const m = new THREE.Mesh(hairlines.get(faceGeo), mat);
  m.castShadow = true;
  m.name = "hairline";
  return m;
}
function reliefHead(rig) {
  const p = rig.parts, s = rig.scale, board = p.head;
  const M = headModel(rig);
  return loadPieces(glb(M.file)).then(async (pieces) => {
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
      g.add(m, new THREE.Mesh(face ? rimInk(hull, geo) : hull, armInk));
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
          // flipped back on a mirrored head (HEAD.mirror): the print reads
          if (HEAD.mirror) cap.scale.x *= -1;
          cap.position.y += (M.capLift || 0) * s;
          cap.rotation.x += M.capTilt || 0;
          cap.userData.inkOwn = true;   // its own outline, not the face's (view/char-ink.js)
          p.headPivot.add(cap);
          grp.visible = false;
          hidden.push(grp);
          g.userData.cap = cap;
          continue;
        }
        if (SHELLS[id]) {
          // the beard (or a mask) as a shell round the jaw, in place of its card
          const front = grp.children.find((c) => Math.abs(c.rotation.y - Math.PI) < 1e-3);
          if (!front) continue;
          // it drapes over the torso's measured front: wait for the torso
          await rig.torsoReady?.catch(() => {});
          const beard = await beardVolume(id, front, s, g, p.headPivot, p.chest, new Set(Object.values(p).filter((j) => j?.isObject3D && j !== p.chest)));
          p.headPivot.add(beard);
          (g.userData.extra ||= []).push(beard);
          // (a band round the head, the blindfold, keeps its back card)
          const only = SHELLS[id].keepBack ? front : grp;
          only.visible = false;
          hidden.push(only);
          if (!SHELLS[id].keepBack) continue;
        }
        for (const plane of grp.children) {
          if (!plane.visible) continue;
          const isFront = Math.abs(plane.rotation.y - Math.PI) < 1e-3;
          moved.push([plane, plane.position.z]);
          // a band round the back of the skull (the blindfold), or glasses
          // across the rounded face: bent onto it, not a flat card floating
          // off its sides
          if (!plane.userData.wrapped) wrapCard(plane, s, isFront ? M.dome : M.back);
          plane.position.z += (isFront ? -(M.front + (OVER_SHELL[id] || 0)) : M.back) * s;
        }
      }
    }
    // modelled hair: on the relief head's group, in its frame (it shows and
    // hides with the face), each piece inked like the arms
    for (const id of tokenTraits(rig.traits?.token) || []) {
      const hair = HAIRS[id];
      if (!hair) continue;
      const matOf = kitMaterials(hair.colours);
      for (const { name, geo, hull } of await loadPieces(glb(hair.file))) {
        const m = new THREE.Mesh(geo, matOf(name.split("__")[0]));
        m.castShadow = true;
        m.name = name;
        g.add(m, new THREE.Mesh(hull, armInk));
      }
      // The hairline: the face's forehead stands in front of the hair's cap,
      // so the bare scalp showed between the fringe spikes (user,
      // 2026-10-17: no scalp under hair). The face's top strip, above the
      // brows, gets a skin of the hair's colour a hair's width out.
      const face = pieces.find((x) => x.mat === "trollface");
      if (face) g.add(hairline(face.geo, matOf("hair"), M.hairline));
    }
    g.userData.undo = () => {
      board.layers.mask = mask;
      if (rig.skull) rig.skull.visible = true;
      for (const [plane, z] of moved) plane.position.z = z;
      for (const grp of hidden) grp.visible = true;
      g.userData.cap?.parent?.remove(g.userData.cap);
      for (const o of g.userData.extra || []) o.parent?.remove(o);
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
  // a kit with its own painted torso (a Roblox Studio body) wears that
  if (KITS[garment]?.torso) return loadPieces(glb(KITS[garment].torso)).then((pieces) => pieces.map(({ name, geo, hull, map, alphaTest }) => {
    const g = new THREE.Group();
    g.scale.setScalar(s);
    const badge = name.split("__")[1]?.startsWith("badge");
    const m = new THREE.Mesh(geo, map ? paintedMaterial(badge ? badgePlaceholder() : map, alphaTest) : toon(SKIN));
    if (badge) {
      m.userData.placeholder = "trollface badge";
      // the front disc came out smaller than the texture's own logo under
      // it, whose spikes showed round it: grown a third about its centre
      // (the chest is near flat there)
      if (name.split("__")[1] === "badge") {
        geo.computeBoundingBox();
        const c = geo.boundingBox.getCenter(new THREE.Vector3());
        m.position.copy(c).multiplyScalar(-0.3);
        m.scale.setScalar(1.3);
      }
    }
    m.castShadow = !alphaTest;
    m.name = name.split("__")[1];
    // a decal (the badges) lies on the torso: no ink shell of its own
    g.add(m);
    if (!alphaTest) g.add(new THREE.Mesh(hull, armInk));
    p[name.split("__")[0]].add(g);
    return g;
  }));
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
   tankColor, cap: "U MAD BRO?", moustache: true }; the garment's kit
   (KITS) picks the arm and leg pieces. Returns a remover. */
export function applyBlocky(rig, look = {}) {
  const p = rig.parts, s = rig.scale;
  const kit = KITS[look.garment] || KITS["clothes-tank-runner"];
  const added = [];
  const add = (parent, o) => { parent.add(o); added.push(o); return o; };
  // The head stays the trollface board (user: "roblox shape except the
  // head"), shrunk to a blocky avatar's proportions (about 0.6 of the
  // torso's width) and set down on the torso; its drawn traits (traits.js
  // head planes, the skull back) ride it. `blockHead` tries a block instead.
  const boardHead = !look.blockHead;
  const hide = boardHead ? [p.body] : [p.body, p.head];
  const pivotY = p.headPivot.position.y;
  const hit = rig.hitboxMeshes?.[0], hitWas = hit && [hit.position.y, hit.scale.x];
  if (boardHead) {
    p.headPivot.scale.set(HEAD.mirror ? -HEAD.scale : HEAD.scale, HEAD.scale, HEAD.scale);
    // (kit.headLift: the head held up off a torso that reaches the chin,
    // the Roblox Studio body's; user, 2026-10-17)
    p.headPivot.position.y = (HIT_LOOK.y + HEAD.neck + (kit.headLift || 0)) * s;
    // the hit sphere (a child of the head pivot) kept at its old place and size
    if (hit) {
      hit.scale.setScalar(HIT_LOOK.scale / HEAD.scale);
      hit.position.y = (HIT_LOOK.y * s + HIT_LOOK.scale * hitWas[0] - p.headPivot.position.y) / HEAD.scale;
    }
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
  // the neck: a thin tapered skin piece on the neck joint, from inside the
  // chest up into the head, so it nods with the head
  if (boardHead && HEAD.neck > 0) {
    const y0 = -0.03 * s, y1 = p.headPivot.position.y + 0.08 * HEAD.scale * s;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(HEAD.neckR[1] * s, HEAD.neckR[0] * s, y1 - y0, 20), toon(SKIN));
    neck.position.y = (y0 + y1) / 2;
    neck.castShadow = true;
    add(p.neckPivot, neck);
  }

  // --- torso: the muscular one from Blender (look.torso "muscle", the
  // default), or ("block") a chest block on the chest joint and a hip block
  // on the torso joint (pivoting at the hips), so the body bends where the
  // spine does. Template rows: y 0 is the torso's top (chest + 0.04 m), 1 mm a unit.
  const T = B.torso;
  // (rig.torsoReady: the beard rests on this torso, so it waits for it)
  if ((look.torso ?? "muscle") === "muscle") later(rig.torsoReady = muscleTorso(rig, look.garment));
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
  if ((look.arms ?? "muscle") === "muscle") later(boxArms(rig, kit));
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
    later(muscleLegs(rig, kit));
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
    if (hit) { hit.position.y = hitWas[0]; hit.scale.setScalar(hitWas[1]); }
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

/* The NFT design lab (tools/nft-lab.html) tunes these tables live and
   rebuilds the body: they're read at build time, and `flush` drops the
   beard shapes built from the old values. The game never touches this. */
export const DESIGN = { KITS, HAIRS, HATS, CAP, SHELLS, HEAD_MODELS, HEAD, TOKENS, TRAIT_ART, flush: () => beardShapes.clear() };

/* ------------------------------------------------------------ in game */

/* The body cosmetic (cosmetics.js "body": "trolls-<token>", locked to the
   token's holder): TROLLS #token as the blocky troll on a live game rig,
   put on or taken off in place; `token` 0 takes it off. Cheap to call
   every frame; resolves once the body is on. The rig is reshaped to the
   blocky proportions (character.js reshapeRig: arms hanging straight,
   shorter legs) with its hit capsules along the new bones, the head traits
   drawn on (traits.js), then the body (applyBlocky) in the token's garment. */
/* The body your own troll should wear: set from the Cosmetics pick
   (menu/lobby.js), worn by view/third-person.js every frame. */
export const ownBody = { want: "" };
/* Start token's body pieces downloading at once: applyBlocky asks for them
   only once the traits' art is on, so on a phone the head (the biggest,
   half a megabyte) landed seconds after everything else. */
function prefetchPieces(rig, token) {
  const look = tokenLook(token);
  if (!look) return;
  const kit = KITS[look.garment] || KITS["clothes-tank-runner"];
  const urls = [glb(headModel(rig).file), kit.torso ? glb(kit.torso) : TORSO_GLB];
  if (kit.legs) urls.push(glb(kit.legs));
  for (const id of tokenTraits(token) || []) if (HAIRS[id]) urls.push(glb(HAIRS[id].file));
  for (const u of urls) loadPieces(u).catch(() => {});
}

/* The same, with no rig yet: the page's first moments, for the body you
   wore last (menu/lobby.js), so it's in by the time your sign-in says you
   may wear it. */
export function prefetchBody(token) {
  if (tokenLook(token)) prefetchPieces({ nftFace: tokenFace(token) }, +token);
}

export function wearBlocky(rig, token) {
  token = tokenLook(token) ? +token : 0;
  if ((rig.blocky?.token || 0) === token) return rig.blocky?.ready ?? Promise.resolve();
  if (rig.blocky) {
    const b = rig.blocky;
    rig.blocky = null;
    b.off();
    if (!token) return Promise.resolve();
  }
  const head = rig.parts.head;
  const side = head.material.side;
  const unshape = reshapeRig(rig, { build: 0.25, legs: 0.67 });
  let restore = null, gone = false;
  const b = (rig.blocky = {
    token,
    off() {
      gone = true;
      untagInk(rig);
      restore?.();
      removeToken(rig);
      // the traits' skull back (traits.js skullBack): the stick has none
      rig.skull?.parent?.remove(rig.skull);
      rig.skull = null;
      head.material.side = side;
      rig.nftFace = null;
      setFace(rig);
      unshape();
    },
  });
  // the NFT's own face, if its facial is one (traits.js tokenFace)
  rig.nftFace = tokenFace(token);
  setFace(rig);
  prefetchPieces(rig, token);
  b.ready = applyToken(rig, token, { headOnly: true }).then(() => {
    if (gone) return;
    // skullBack turned the board's (possibly shared) face material one-sided
    head.material.side = side;
    restore = applyBlocky(rig, { garment: tokenLook(token).garment });
    // the edge ink (view/char-ink.js) once its pieces are on
    return restore.loaded.then(() => { if (!gone) tagInk(rig); });
  });
  return b.ready;
}
