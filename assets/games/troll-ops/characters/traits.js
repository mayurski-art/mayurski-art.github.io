// Troll Forces: TROLLS NFT traits on the operator (TROLLS-TRAITS.md).
//
// Every trait is a flat drawing in the game's ink style, baked from
// traits/src/<id>.svg to traits/<id>.png (tools/troll-ops-bake-traits.mjs),
// and worn on the live stick rig:
//   - head traits (hats, facials) on planes over the face board, in the
//     head frame: 1000 x 1033 units = headPivot x -0.30..0.30, y 0.62..0;
//   - clothes on a garment board: the drawing's own outline (the svg's
//     `cut-upper` / `cut-lower` paths) cut out of a thin slab, front art on
//     the front, back art on the back, the upper half on the chest joint and
//     the lower on the torso so it bends where the spine does. The garment
//     frame is 1000 x 1167 units, 1667 a metre, x 500 the spine, y 233 the
//     chest joint; a clothed troll's arms start at its shoulders.
// The unit is the token: applyToken(rig, id) puts on all of token #id's
// drawn traits.

import * as THREE from "three";
import { setClothed } from "./character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1m1u-gt1-gt2-bk1-cw1-zr10-bf1-sr1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1";

const DIR = new URL("../traits/", import.meta.url);
// The art's cache tag: bump it when a drawing changes (a dev page can set
// globalThis.TRAITS_BUST to refetch every time).
const ART_V = globalThis.TRAITS_BUST ?? "tr7";

/* The trait library: one drawing per TROLLS trait VALUE, named after it
   (type/value -> id), so every token with that trait wears the same art
   (user, 2026-10-15: "if another nft has these traits then there's no need
   to recreate them"). A token is wearable once every trait it has is drawn
   (BACKGROUND is nothing, and EYES/Eyes Relaxed is painted into the face,
   FACE_TRAITS: "" here).
     HATS/Goatfarm Hat        hat-goatfarm       (front + back)
     HATS/Camper Hat          hat-camper         (front + back)
     HATS/Baker Hat           hat-baker          (front + back)
     FACIALS/French Moustache facial-french-moustache
     FACIALS/Beard Brown      facial-beard-brown
     FACIALS/Face Mask UMADBRO facial-face-mask-umadbro
     EYES/Eyes Bloodshot      eyes-bloodshot
     EYES/Glasses Thug        eyes-glasses-thug  (worn over the facial)
     CLOTHES/Tank Runner      clothes-tank-runner (board + block template)
     CLOTHES/Farmer           clothes-farmer      (block template only)
     CLOTHES/Sweater Black    clothes-sweater-black (block template only)
     HATS/Carrot Cake Hair    hat-carrot-cake-hair (MODELLED: Blender spikes, no drawing)
     CLOTHES/Sensei           clothes-sensei      (block template only)
     HATS/Magician Hat        hat-magician       (front + back)
     HATS/Trucker Hat Microsoft hat-trucker-microsoft (front + back)
     HATS/Trucker Hat Yobucks hat-trucker-yobucks (front + back)
     FACIALS/Licky            facial-licky
     FACIALS/Gold Tooth       the face itself (face-gold-tooth.svg, character.js FACE_ART)
     EYES/Cracked Eyes        the face itself (face-cracked.svg, character.js FACE_ART)
     EYES/Blindfold           eyes-blindfold     (front + back)
     EYES/Glasses Reading     eyes-glasses-reading
     CLOTHES/Jester           clothes-jester      (block template only)
     CLOTHES/Tshirt Black     clothes-tshirt-black (block template only)
     CLOTHES/Trainer          clothes-trainer     (block template only)
     FACIALS/Bubblegum        the token's emote, not worn (user, 2026-10-15:
                              "without the bubble gum", the holder gets the
                              bubblegum emote; emotes.js)
   Head traits go on in this order, each a hair in front of the last. */
/* token -> its traits by type, as its metadata names them (local: the
   page's CSP blocks IPFS, so a token's traits are copied in here). */
export const TOKENS = {
  1718: { hat: "Goatfarm Hat", facial: "French Moustache", eyes: "Eyes Relaxed", clothes: "Tank Runner" },
  820: { hat: "Camper Hat", facial: "Beard Brown", eyes: "Eyes Bloodshot", clothes: "Farmer" },
  1262: { hat: "Baker Hat", facial: "Face Mask UMADBRO", eyes: "Glasses Thug", clothes: "Sweater Black" },
  989: { hat: "Carrot Cake Hair", facial: "Bubblegum", eyes: "None", clothes: "Sensei" },
  33: { hat: "Magician Hat", facial: "French Moustache", eyes: "Cracked Eyes", clothes: "Jester" },
  2630: { hat: "Trucker Hat Microsoft", facial: "Licky", eyes: "Blindfold", clothes: "Tshirt Black" },
  2631: { hat: "Trucker Hat Yobucks", facial: "Gold Tooth", eyes: "Glasses Reading", clothes: "Trainer" },
};
/* trait value -> its drawing's id; "" for a value that's the OG art. */
export const TRAIT_ART = {
  "Goatfarm Hat": "hat-goatfarm", "Camper Hat": "hat-camper",
  "French Moustache": "facial-french-moustache", "Beard Brown": "facial-beard-brown",
  "Eyes Relaxed": "", "Eyes Bloodshot": "eyes-bloodshot",
  "Tank Runner": "clothes-tank-runner", "Farmer": "clothes-farmer",
  "Baker Hat": "hat-baker", "Face Mask UMADBRO": "facial-face-mask-umadbro",
  "Glasses Thug": "eyes-glasses-thug", "Sweater Black": "clothes-sweater-black",
  "Carrot Cake Hair": "hat-carrot-cake-hair", "Sensei": "clothes-sensei",
  "Magician Hat": "hat-magician", "Trucker Hat Microsoft": "hat-trucker-microsoft", "Trucker Hat Yobucks": "hat-trucker-yobucks",
  "Licky": "facial-licky", "Gold Tooth": "",
  "Cracked Eyes": "", "Blindfold": "eyes-blindfold", "Glasses Reading": "eyes-glasses-reading",
  "Jester": "clothes-jester", "Tshirt Black": "clothes-tshirt-black", "Trainer": "clothes-trainer",
  "Eyes None": "", "None": "", "Bubblegum": "",
};
/* Traits that are Blender models, not drawings (blocky-body.js HAIRS puts
   them on the relief head): no planes here. */
export const MODELLED = new Set(["hat-carrot-cake-hair"]);
/* Eye traits that go on over the facial, not under it (shades over a mask). */
const OVER_FACIAL = new Set(["eyes-glasses-thug"]);
/* Token #id's drawn trait ids, worn in this order (eyes on the face, then
   the beard over the jaw, then the hat), or null when one of its traits
   isn't drawn yet: nobody shows up half dressed. */
/* A facial or eyes trait that is the whole face rather than a drawing over
   it: its expression key (character.js FACE_ART). #989's Bubblegum is the
   face blowing, without the gum (the gum is the holder's emote); #33's
   Cracked Eyes are painted into the trollface in place of its squints (as
   a card they floated in front of the grin; user, 2026-10-16), and #2631's
   Gold Tooth fills a tooth of it (a card was half buried in the grin);
   #1718's Eyes Relaxed are its closed lids in place of the squints. */
const FACE_TRAITS = { Bubblegum: "gum", "Cracked Eyes": "cracked", "Gold Tooth": "goldtooth", "Eyes Relaxed": "relaxed" };
export function tokenFace(token) {
  const t = TOKENS[token];
  return FACE_TRAITS[t?.facial] || FACE_TRAITS[t?.eyes] || null;
}

export function tokenTraits(token) {
  const t = TOKENS[token];
  if (!t) return null;
  const ids = [];
  for (const type of ["eyes", "facial", "hat", "clothes"]) {
    const value = t[type];
    if (value === undefined) continue;
    const id = TRAIT_ART[value];
    if (id === undefined) return null;
    if (id) ids.push(id);
  }
  // shades over a mask: after the facial
  for (const id of ids.filter((x) => OVER_FACIAL.has(x))) { ids.splice(ids.indexOf(id), 1); ids.splice(ids.findIndex((x) => x.startsWith("hat-")) >>> 0, 0, id); }
  return ids;
}
/* Traits with a drawn back view (<id>.back.png). */
const HAS_BACK = new Set(["hat-goatfarm", "hat-camper", "hat-baker", "hat-magician", "hat-trucker-microsoft", "hat-trucker-yobucks", "eyes-blindfold", "clothes-tank-runner"]);
/* Clothes drawn as a garment board for the stick (<id>.svg with cut paths);
   the others have only a block template (blocky-body.js). */
const HAS_BOARD = new Set(["clothes-tank-runner"]);
/* Where a garment puts the arms: half the shoulder width, metres. */
const SHOULDERS = { "clothes-tank-runner": 0.15 };

const HEAD = { w: 0.6, h: 0.62, y: 0.31 };
/* Head drawings taller than the frame (their svg's viewBox): the beard
   hangs below the chin, down the frame's bottom edge (y 1033, the neck
   joint) and on, so its plane runs lower, and from the chin down it bends
   forward (`bend`: from this frame y, out `z` metres at the bottom edge)
   to lie over the chest instead of vanishing into it. */
const TALL = {
  // (the stick's flat beard; on the block body it's a volume: blocky-body.js beardVolume)
  "facial-beard-brown": { h: 1300, bend: { from: 900, z: 0.14 } },
  "facial-face-mask-umadbro": { h: 1300, bend: { from: 950, z: 0.1 } },
};
const UNIT = 1 / 1667;                 // garment frame units -> metres
const GARMENT = { w: 1000, h: 1167, spine: 500, chest: 233, depth: 0.075 };

const loader = new THREE.TextureLoader();
const texCache = new Map();
function texture(file) {
  if (!texCache.has(file)) {
    const t = loader.load(new URL(`${file}.png?v=${ART_V}`, DIR).href);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    texCache.set(file, t);
  }
  return texCache.get(file);
}
/* Lit like the face board: a little self-light so the drawing reads flat. */
function drawnMaterial(map, extra = {}) {
  return new THREE.MeshStandardMaterial({
    map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.55,
    transparent: true, alphaTest: 0.3, roughness: 0.75, ...extra,
  });
}

/* ------------------------------------------------------------ the head */

/* The face board shows its front only, and the back of the head is a plain
   skull: the art's silhouette mirrored, white with its ink edge. */
let skullTex = null;
export function skullBack(rig) {
  const head = rig.parts.head;
  if (!head?.userData.trollface || rig.skull) return;
  head.material.side = THREE.FrontSide;
  if (!skullTex) {
    // Sized up front (the art's own 800 x 730): a texture can't change size
    // once it's on the GPU, so it isn't sized when the art arrives.
    const W = 800, H = 730;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    skullTex = new THREE.CanvasTexture(c);
    skullTex.colorSpace = THREE.SRGBColorSpace;
    const img = new Image();
    img.onload = () => {
      const g = c.getContext("2d");
      const sil = (fill, k) => {
        const t = document.createElement("canvas"); t.width = W; t.height = H;
        const tg = t.getContext("2d");
        tg.drawImage(img, 0, 0, W, H);
        tg.globalCompositeOperation = "source-in";
        tg.fillStyle = fill; tg.fillRect(0, 0, W, H);
        g.save(); g.translate(W / 2, H / 2); g.scale(-k, k); g.translate(-W / 2, -H / 2); g.drawImage(t, 0, 0); g.restore();
      };
      sil("#060606", 1);
      sil("#f3f3ef", 0.965);
      skullTex.needsUpdate = true;
    };
    img.src = new URL("../../../images/wallpaper/trollface%20transparent.png", import.meta.url).href;
  }
  const back = new THREE.Mesh(head.geometry, drawnMaterial(skullTex, { roughness: 0.7 }));
  back.position.copy(head.position);
  back.position.z += 0.001;          // faces +Z: the back
  head.parent.add(back);
  rig.skull = back;
}

function headPlane(rig, file, back, order = 0) {
  const s = rig.scale;
  const tall = TALL[file.replace(/\.back$/, "")];
  const h = tall ? HEAD.h * tall.h / 1033 : HEAD.h;
  const geo = new THREE.PlaneGeometry(HEAD.w * s, h * s, 1, tall?.bend ? 12 : 1);
  if (tall?.bend && !back) {
    // the plane's local +z is forward once it's turned to face the front
    const pos = geo.attributes.position, { from, z } = tall.bend;
    const yFrom = (h / 2 - (from / 1033) * HEAD.h) * s;   // frame y -> plane-local y
    for (let i = 0; i < pos.count; i++) {
      const t = (yFrom - pos.getY(i)) / (yFrom + h * s / 2);
      if (t > 0) pos.setZ(i, z * s * t ** 1.4);
    }
    geo.computeVertexNormals();
  }
  const m = new THREE.Mesh(geo, drawnMaterial(texture(file), { side: THREE.FrontSide }));
  // a hair off the board: in front (the board faces -Z), or behind facing
  // back; each trait a hair past the one before, so they never fight
  m.position.set(0, (HEAD.y - (h - HEAD.h) / 2) * s, (back ? 0.006 + order * 0.0005 : -0.004 - order * 0.0005) * s);
  if (!back) m.rotation.y = Math.PI;
  m.renderOrder = 2 + order;
  return m;
}

/* A clothed troll's neck: white, thick like the NFT's, with ink sides, on
   the neck joint so it tips with the head. It stands just behind the face
   board (the chin covers its top) and the garment covers its base; from
   behind, the skull covers its top. Bare trolls keep the ink stick. */
const NECK = { bottom: -0.02, top: 0.2, wBottom: 0.1, wTop: 0.085 };
let neckTex = null;
function neckTexture() {
  if (neckTex) return neckTex;
  const c = document.createElement("canvas");
  c.width = 256; c.height = 384;
  const g = c.getContext("2d");
  const inset = (1 - NECK.wTop / NECK.wBottom) * 128;
  g.beginPath();
  g.moveTo(inset, 0); g.lineTo(256 - inset, 0); g.lineTo(256, 384); g.lineTo(0, 384); g.closePath();
  g.fillStyle = "#f3f3ef"; g.fill();
  g.strokeStyle = "#0a0a0a"; g.lineWidth = 22;
  g.beginPath(); g.moveTo(inset, 0); g.lineTo(0, 384); g.moveTo(256 - inset, 0); g.lineTo(256, 384); g.stroke();
  // the cords running down into the collarbones
  g.lineWidth = 9; g.lineCap = "round";
  g.beginPath(); g.moveTo(78, 120); g.quadraticCurveTo(92, 280, 120, 384); g.moveTo(178, 120); g.quadraticCurveTo(164, 280, 136, 384); g.stroke();
  neckTex = new THREE.CanvasTexture(c);
  neckTex.colorSpace = THREE.SRGBColorSpace;
  return neckTex;
}
function neckPiece(rig) {
  const s = rig.scale;
  const h = (NECK.top - NECK.bottom) * s;
  const geo = new THREE.PlaneGeometry(NECK.wBottom * 2 * s, h);
  const g = new THREE.Group();
  for (const back of [false, true]) {
    const m = new THREE.Mesh(geo, drawnMaterial(neckTexture(), { side: THREE.FrontSide }));
    m.position.set(0, (NECK.bottom * s + h / 2), (back ? 0.0005 : 0.004) * s);
    if (!back) m.rotation.y = Math.PI;
    g.add(m);
  }
  rig.parts.neckPivot.add(g);
  return g;
}

/* ------------------------------------------------------------ garments */

/* An svg path of M/L/Q/Z (absolute) as a THREE.Shape in a joint's frame:
   `toX`/`toY` map frame units to metres. */
function pathShape(d, toX, toY) {
  const shape = new THREE.Shape();
  const tok = d.match(/[MLQZ]|-?[\d.]+/g);
  let i = 0;
  const num = () => +tok[i++];
  while (i < tok.length) {
    const c = tok[i++];
    if (c === "M") { const x = num(), y = num(); shape.moveTo(toX(x), toY(y)); }
    else if (c === "L") { const x = num(), y = num(); shape.lineTo(toX(x), toY(y)); }
    else if (c === "Q") { const cx = num(), cy = num(), x = num(), y = num(); shape.quadraticCurveTo(toX(cx), toY(cy), toX(x), toY(y)); }
  }
  return shape;
}

const svgCache = new Map();
function garmentSvg(id) {
  if (!svgCache.has(id)) svgCache.set(id, fetch(new URL(`src/${id}.svg?v=${ART_V}`, DIR).href).then((r) => r.text()));
  return svgCache.get(id);
}
const imgCache = new Map();
function garmentPixels(file) {
  if (!imgCache.has(file)) imgCache.set(file, new Promise((done) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const g = c.getContext("2d", { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      done(g.getImageData(0, 0, c.width, c.height));
    };
    img.onerror = () => done(null);
    img.src = new URL(`${file}.png?v=${ART_V}`, DIR).href;
  }));
  return imgCache.get(file);
}

/* One half of a garment board on `joint`, whose origin sits `yOff` metres
   above the garment frame's chest joint (0 for the chest, -0.48 for the
   torso pivot at the hips). Front and back faces carry the drawings; the
   edge takes the colour just inside the drawing's own edge. */
function garmentPiece(rig, id, d, yOff, front, back, px) {
  const s = rig.scale;
  // frame units -> this joint's metres; seen from the front the troll's
  // right is on the left, so the frame's x runs the other way to the rig's
  const fx = (X) => (GARMENT.spine - X) * UNIT * s;
  const fy = (Y) => ((GARMENT.chest - Y) * UNIT - yOff) * s;
  const D = GARMENT.depth * s;
  const toFrame = (x, y) => [GARMENT.spine - x / (UNIT * s), GARMENT.chest - (y / s + yOff) / UNIT];

  const group = new THREE.Group();
  // Faces: the shape facing -Z with the front drawing, and +Z with the back.
  const face = (isFront) => {
    const shape = pathShape(d, isFront ? (X) => -fx(X) : fx, fy);
    const geo = new THREE.ShapeGeometry(shape, 12);
    if (isFront) geo.rotateY(Math.PI);          // x back to the rig's, facing -Z
    geo.translate(0, 0, isFront ? -D / 2 : D / 2);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let k = 0; k < pos.count; k++) {
      const [X, Y] = toFrame(pos.getX(k), pos.getY(k));
      uv.setXY(k, (isFront ? X : GARMENT.w - X) / GARMENT.w, 1 - Y / GARMENT.h);
    }
    const m = new THREE.Mesh(geo, drawnMaterial(texture(isFront ? front : back), { side: THREE.FrontSide, transparent: false }));
    m.renderOrder = 1;
    return m;
  };
  group.add(face(true));
  if (back) group.add(face(false));
  // Edge: the outline extruded through the slab, coloured from the front
  // drawing a little inside its ink rim, and darkened a shade.
  const ext = new THREE.ExtrudeGeometry(pathShape(d, fx, fy), { depth: D, bevelEnabled: false, curveSegments: 12 });
  ext.translate(0, 0, -D / 2);
  const pos = ext.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let k = 0; k < pos.count; k++) {
    let [X, Y] = toFrame(pos.getX(k), pos.getY(k));
    // in past the ink rim, toward the middle of the board
    const dx = GARMENT.spine - X, dy = 600 - Y, dl = Math.hypot(dx, dy) || 1;
    X += (dx / dl) * 26; Y += (dy / dl) * 26;
    let r = 0.53, g = 0.96, b = 0.16;
    if (px) {
      const ix = Math.max(0, Math.min(px.width - 1, Math.round(X))), iy = Math.max(0, Math.min(px.height - 1, Math.round(Y)));
      const o = (iy * px.width + ix) * 4;
      if (px.data[o + 3] > 0) { r = px.data[o] / 255; g = px.data[o + 1] / 255; b = px.data[o + 2] / 255; }
    }
    col.set([r * 0.8, g * 0.8, b * 0.8], k * 3);
  }
  ext.setAttribute("color", new THREE.BufferAttribute(col, 3));
  // Both sides: the frame's mirrored x turns the extruded walls inside out.
  const edgeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  group.add(new THREE.Mesh(ext, [hidden, edgeMat]));
  return group;
}

async function buildGarment(rig, id) {
  const svg = await garmentSvg(id);
  const px = await garmentPixels(id);
  const get = (name) => new RegExp(`id="${name}" d="([^"]+)"`).exec(svg)?.[1];
  const upper = get("cut-upper"), lower = get("cut-lower");
  const back = HAS_BACK.has(id) ? `${id}.back` : null;
  const g = new THREE.Group();
  const p = rig.parts;
  // The torso joint pivots at the hips, 0.48 m (two spine segments) below
  // the chest joint at rest.
  const up = garmentPiece(rig, id, upper, 0, id, back, px);
  const lo = garmentPiece(rig, id, lower, -0.48, id, back, px);
  p.chest.add(up);
  p.torso.add(lo);
  g.userData.parts = [up, lo, neckPiece(rig)];
  return g;
}

/* ------------------------------------------------------------ tokens */

/* Put on token #id's drawn traits (and take off whatever was on). */
export async function applyToken(rig, token, { headOnly = false } = {}) {
  removeToken(rig);
  skullBack(rig);
  // headOnly: the body is dressed some other way (blocky-body.js); a
  // garment with no board for the stick is skipped either way
  const ids = (tokenTraits(token) || []).filter((id) => !id.startsWith("clothes-") || (!headOnly && HAS_BOARD.has(id)));
  const worn = (rig.traits = { token, meshes: [], byId: {} });
  let order = 0;
  for (const id of ids) {
    let ms;
    if (MODELLED.has(id)) ms = [];
    else if (id.startsWith("clothes-")) {
      setClothed(rig, SHOULDERS[id] ?? 0.1);
      const g = await buildGarment(rig, id);
      ms = g.userData.parts;
      if (rig.traits !== worn) { for (const m of ms) m.parent?.remove(m); return; }
    } else {
      const g = new THREE.Group();
      g.add(headPlane(rig, id, false, order));
      if (HAS_BACK.has(id)) g.add(headPlane(rig, `${id}.back`, true, order));
      rig.parts.headPivot.add(g);
      ms = [g];
      order++;
    }
    worn.meshes.push(...ms);
    worn.byId[id] = ms;
  }
}

export function removeToken(rig) {
  if (!rig.traits) return;
  for (const m of rig.traits.meshes) m.parent?.remove(m);
  rig.traits = null;
  setClothed(rig, 0);
}

/* Show or hide one worn trait (the preview's toggles); a garment taken off
   takes the shoulders with it. */
export function showTrait(rig, id, on) {
  for (const m of rig.traits?.byId[id] || []) m.visible = on;
  if (id.startsWith("clothes-")) setClothed(rig, on ? SHOULDERS[id] ?? 0.1 : 0);
}
