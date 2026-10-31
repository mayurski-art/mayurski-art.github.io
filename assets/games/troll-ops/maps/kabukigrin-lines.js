// Troll Forces — Kabukigrin's candle lines (docs/CANDLE-LINES.md): the props
// on the tatami room's three low tables and the timeline they play when
// someone cuts a line. The joke is crypto: a green candle off the stonks
// chart, crushed on a mirror with a $TROLL card, cut into a line, snorted
// through a rolled "ONE TROLL" bill.
//
// Everything here is a live mesh on the map's root (never the Kit, which
// merges what it's given): a gold-framed mirror tray, an acrylic stand of
// five chart candles (one red dip for the joke), the tall green one that
// gets taken, the powder as a pile then a line, the card, the bill, and the
// dust that puffs up on each press. Each table has one state (`st`) the
// mode drives (modes/social-lines.js): `start` (performance.now ms) and who,
// `cancelAt` (the beat a line stopped at: the powder stays 20 s), `face`
// (the user's nose in world space: the bill goes there) and `hideHand`
// (the local user in first person holds their own card and bill).
//
// Rule 9: it all lies on the table tops (0.75); the stand is the tallest
// piece at 6 cm (a kneeling eye by the tank grazed taller ones). The test raycasts the room's eye points at the koi tank,
// the noren, the lattice window and the doors against these boxes.

import * as THREE from "three";

/* ------------------------------------------------------------ the beats */

// seconds from the hold-X; the mode, the hands and the camera share these
export const BEATS = {
  down: 0.6,     // leaning in over the mirror
  pick: 1.2,     // the candle's off the stand, flat on the glass
  crush: 2.4,    // three presses with the card
  cut: 3.6,      // chop, chop, the long drag: the pile is a line
  bill: 4.2,     // the bill's up at the nose
  snort: 5.0,    // the line's gone, end to end
  end: 5.6,      // the head's snapped back
};
export const PRESSES = [1.3, 1.65, 2.0];    // when the card comes down
export const CHOPS = [2.45, 2.7, 2.95];
export const DRAG = [3.1, 3.55];
export const LEFTOVER_SECS = 20;            // a cancelled line stays this long
export const STONKS_GREEN = 0x1fd35a;

const span = (t, [a, b]) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const ease = (k) => k * k * (3 - 2 * k);
const easeOut = (k) => 1 - (1 - k) * (1 - k);

/* What everything's doing `t` seconds in (t < 0: idle). `cancelAt`, when
   set, freezes the powder where the line stopped and sends the card and the
   bill back. Fractions are 0..1; positions are tray-local metres. */
export function lineState(t, cancelAt = null) {
  const S = { active: t >= 0, pick: 0, squash: 0, gone: 0, pile: 0, line: 0, eaten: 0, bill: 0, snap: 0,
    card: { x: 0.1, z: -0.085, y: 0, yaw: -0.3, pitch: 0, on: false }, press: 0, chop: 0, drag: 0, puffs: [], billSweep: 0, done: false };
  if (t < 0) return S;
  const tc = cancelAt != null ? Math.min(t, cancelAt) : t;
  const cancelled = cancelAt != null && t > cancelAt;
  S.pick = ease(span(tc, [BEATS.down, BEATS.pick]));
  // the presses: each one squashes the candle a third more and raises a third of the pile
  let presses = 0;
  for (const p of PRESSES) {
    if (tc >= p) presses++;
    const a = tc - p;
    if (a >= 0 && a < 0.3) S.press = Math.max(S.press, a < 0.1 ? a / 0.1 : 1 - (a - 0.1) / 0.2);
    if (a >= 0 && a < 0.7) S.puffs.push({ age: a / 0.7, seed: p });
  }
  S.squash = presses / 3;
  S.gone = presses >= 3 ? 1 : 0;
  S.pile = presses / 3;
  for (const c of CHOPS) {
    const a = tc - c;
    if (a >= 0 && a < 0.22) S.chop = Math.max(S.chop, a < 0.08 ? a / 0.08 : 1 - (a - 0.08) / 0.14);
  }
  S.drag = span(tc, DRAG);
  S.line = ease(S.drag);
  S.pile *= 1 - S.line;
  S.bill = cancelled ? 0 : ease(span(t, [BEATS.cut, BEATS.bill])) * (1 - ease(span(t, [BEATS.snort, BEATS.snort + 0.5])));
  S.eaten = ease(span(tc, [BEATS.bill, BEATS.snort]));
  S.billSweep = S.eaten;
  S.snap = t >= BEATS.snort ? Math.max(0, 1 - (t - BEATS.snort) / 0.6) : 0;
  S.done = t >= BEATS.end;
  // the card: in the hand from the pick to the end of the drag, else at rest
  const cardOn = !cancelled && tc >= BEATS.down + 0.3 && tc < DRAG[1] + 0.3;
  S.card.on = cardOn;
  if (cardOn) {
    const inCrush = tc < BEATS.cut;
    if (inCrush) {
      const k = ease(span(tc, [BEATS.down + 0.3, BEATS.pick]));
      S.card.x = 0.1 + (0 - 0.1) * k; S.card.z = -0.085 + (0.0 + 0.085) * k;
      S.card.y = 0.03 - 0.027 * S.press + 0.01 * (1 - k);
      S.card.yaw = -0.3 * (1 - k) + 0.15 * k;
      S.card.pitch = 0.18 * (1 - S.press) * k;   // tipped up at the near edge, pressed flat
    } else {
      // chopping across the pile, then the drag along x that draws the line
      const chopX = tc < CHOPS[0] ? -0.03 : tc < CHOPS[1] ? 0.0 : 0.03;
      const dragK = easeOut(S.drag);
      const inDrag = tc >= DRAG[0];
      S.card.x = inDrag ? -0.07 + 0.14 * dragK : chopX;
      S.card.z = inDrag ? 0.012 : 0.0;
      S.card.y = inDrag ? 0.0015 : 0.02 - 0.018 * S.chop;
      S.card.yaw = inDrag ? Math.PI / 2 - 0.12 : Math.PI / 2;   // on edge, across the line
      S.card.pitch = inDrag ? 0.5 : 0.2;
    }
  }
  return S;
}

/* ------------------------------------------------------------ textures */

const canvas = (w, h, draw) => { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); return c; };
const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const TROLL_URL = new URL("../../../images/wallpaper/trollface%20transparent.png", import.meta.url).href;

// the mirror: near-black glass with the club's pink and cyan smeared across
// it, finger smudges, and one old green streak
function mirrorTexture() {
  const r = rng(11);
  return tex(canvas(512, 384, (g, W, H) => {
    g.fillStyle = "#07080c"; g.fillRect(0, 0, W, H);
    const smear = (x0, y0, x1, y1, c0, c1, a) => {
      const lg = g.createLinearGradient(x0, y0, x1, y1);
      lg.addColorStop(0, c0); lg.addColorStop(0.5, c1); lg.addColorStop(1, c0);
      g.globalAlpha = a; g.fillStyle = lg; g.fillRect(0, 0, W, H);
    };
    smear(0, 0, W, H * 0.6, "rgba(255,42,180,0)", "rgba(255,42,180,0.35)", 1);
    smear(W, 0, 0, H, "rgba(63,240,255,0)", "rgba(63,240,255,0.28)", 1);
    g.globalAlpha = 1;
    for (let i = 0; i < 14; i++) {
      // finger smudges: soft ovals
      const x = r() * W, y = r() * H, rr = 14 + r() * 30;
      const rg = g.createRadialGradient(x, y, 0, x, y, rr);
      rg.addColorStop(0, "rgba(255,255,255,0.07)"); rg.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = rg; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    // the old green streak, where a line once was
    g.strokeStyle = "rgba(31,211,90,0.18)"; g.lineWidth = 9; g.lineCap = "round";
    g.beginPath(); g.moveTo(W * 0.22, H * 0.68); g.quadraticCurveTo(W * 0.5, H * 0.6, W * 0.74, H * 0.66); g.stroke();
  }));
}

// the card's face: matte black, a gold chip, $TROLL embossed, a number
function cardTexture() {
  return tex(canvas(512, 324, (g, W, H) => {
    g.fillStyle = "#0e0e11"; g.fillRect(0, 0, W, H);
    // a brushed sheen
    const lg = g.createLinearGradient(0, 0, W, H);
    lg.addColorStop(0, "rgba(255,255,255,0.05)"); lg.addColorStop(0.5, "rgba(255,255,255,0)"); lg.addColorStop(1, "rgba(255,255,255,0.06)");
    g.fillStyle = lg; g.fillRect(0, 0, W, H);
    // the chip
    g.fillStyle = "#c9a24a"; g.beginPath(); g.roundRect(54, 108, 78, 62, 8); g.fill();
    g.strokeStyle = "#8a6a26"; g.lineWidth = 2;
    for (const y of [128, 150]) { g.beginPath(); g.moveTo(54, y); g.lineTo(132, y); g.stroke(); }
    g.beginPath(); g.moveTo(93, 108); g.lineTo(93, 170); g.stroke();
    // the embossed name
    g.font = "700 64px Oswald, 'DM Sans', sans-serif";
    g.textBaseline = "alphabetic";
    g.fillStyle = "rgba(0,0,0,0.6)"; g.fillText("$TROLL", 58, 262);
    g.fillStyle = "#d8b45a"; g.fillText("$TROLL", 54, 258);
    g.font = "500 22px 'DM Mono', monospace";
    g.fillStyle = "#8f8f96"; g.fillText("4200 6900 0420 1337", 56, 300);
    g.font = "700 20px Oswald, sans-serif"; g.fillStyle = "#b9b9c2"; g.textAlign = "right";
    g.fillText("TROLLNITE BLACK", W - 40, 56);
    g.textAlign = "left";
  }));
}

// the bill, drawn portrait so the roll's length runs down the canvas: a
// green-grey note, "ONE TROLL", the trollface art in the oval, the serial
// ending 420
function billTexture() {
  const c = canvas(440, 1024, (g, W, H) => {
    g.save();
    g.translate(W, 0); g.rotate(Math.PI / 2);   // draw landscape: 1024 x 440
    const w = H, h = W;
    g.fillStyle = "#cfd8bf"; g.fillRect(0, 0, w, h);
    // guilloche-ish bands
    g.strokeStyle = "rgba(40,90,50,0.25)"; g.lineWidth = 1;
    for (let i = 0; i < 40; i++) { g.beginPath(); g.ellipse(w / 2, h / 2, 300 + i * 4, 120 + i * 2.5, (i / 40) * Math.PI, 0, Math.PI * 2); g.stroke(); }
    g.strokeStyle = "#2f5a36"; g.lineWidth = 10; g.strokeRect(18, 18, w - 36, h - 36);
    g.lineWidth = 3; g.strokeRect(34, 34, w - 68, h - 68);
    g.fillStyle = "#1f3f27";
    g.font = "700 64px Georgia, serif"; g.textAlign = "center";
    g.fillText("FEDERAL TROLL NOTE", w / 2, 100);
    g.font = "900 120px Georgia, serif";
    g.fillText("ONE TROLL", w / 2, h - 90);
    g.font = "700 96px Georgia, serif";
    for (const [x, y] of [[90, 130], [w - 90, 130], [90, h - 60], [w - 90, h - 60]]) g.fillText("1", x, y);
    g.font = "500 30px 'DM Mono', monospace"; g.fillStyle = "#4a2a2a"; g.textAlign = "left";
    g.fillText("TN 69420420 A", 120, 170);
    g.textAlign = "right"; g.fillText("SERIES 2026", w - 120, 170);
    // the portrait oval: the art goes in once it loads
    g.fillStyle = "#e4eacf"; g.beginPath(); g.ellipse(w / 2, h / 2 + 10, 150, 125, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#2f5a36"; g.lineWidth = 6; g.stroke();
    g.restore();
  });
  const t = tex(c);
  const img = new Image();
  img.onload = () => {
    const g = c.getContext("2d");
    g.save(); g.translate(c.width, 0); g.rotate(Math.PI / 2);
    g.beginPath(); g.ellipse(512, 230, 140, 115, 0, 0, Math.PI * 2); g.clip();
    g.filter = "grayscale(1) sepia(0.6) hue-rotate(70deg) saturate(0.7) contrast(1.1)";
    g.drawImage(img, 512 - 125, 230 - 125, 250, 250);
    g.restore();
    t.needsUpdate = true;
  };
  img.src = TROLL_URL;
  return t;
}

function puffTexture() {
  return tex(canvas(64, 64, (g) => {
    const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, "rgba(120,255,160,0.9)"); rg.addColorStop(0.4, "rgba(60,220,110,0.35)"); rg.addColorStop(1, "rgba(31,211,90,0)");
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  }));
}

/* ------------------------------------------------------------ geometry */

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
}
// a flat shape lying in the x/z plane (ExtrudeGeometry builds in x/y, +z deep)
function slab(shape, depth) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);   // x/y -> x/-z, depth up
  return g;
}

/* The line: a 12 cm strip along x with jagged edges and a few stray grains.
   Its triangles run from -x to +x, so a draw range eats it from one end. */
function lineGeometry(seedN = 5) {
  const r = rng(seedN), N = 28, L = 0.12, pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const x = -L / 2 + (i / N) * L;
    const taper = Math.sin((i / N) * Math.PI) ** 0.35;
    const w = (0.0045 + r() * 0.0025) * taper, w2 = (0.0045 + r() * 0.0025) * taper;
    pos.push(x, 0.0012, -w2, x, 0.0012, w);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------ the tables

   Studio's three low tables in the tatami room (kabukigrin-layout.js
   colliders), top 0.75 on the tatami (0.3). `axis`: the long side. The
   tray and the stand sit in a frame with +x along it. `stand`: where you
   stand to use it (the open end, or the side clear of the cushions), the
   camera yaw facing the table. `cushions`: the rp seats beside it. */
// The tray frame's +x runs left-to-right as seen from `at`, so the line
// always lies across the user's view (`ry` turns the frame; the tray and
// the stand are placed in it). Tables 1 and 2 are used from their east
// end, facing west; table 3 from its west side (its east is the wall).
export const LINE_TABLES = [
  { x: -29.9, z: 25.9, top: 0.75, floor: 0.3, ry: Math.PI / 2, tray: [0, 0.26], stand: [0, -0.04], at: { x: -28.95, z: 25.9, yaw: Math.PI / 2 }, cushions: [[-29.9, 25.2], [-29.9, 26.6]] },
  { x: -29.9, z: 28.3, top: 0.75, floor: 0.3, ry: Math.PI / 2, tray: [0, 0.26], stand: [0, -0.04], at: { x: -28.95, z: 28.3, yaw: Math.PI / 2 }, cushions: [[-29.9, 27.6], [-29.9, 29.0]] },
  { x: -24.9, z: 27.0, top: 0.75, floor: 0.3, ry: -Math.PI / 2, tray: [0, 0.1], stand: [0.4, -0.08], at: { x: -25.78, z: 27.0, yaw: -Math.PI / 2 }, cushions: [[-24.9, 26.0], [-24.9, 28.0]] },
];

const CANDLES = [   // the stand, left to right: [height, red?]
  [0.02, false], [0.03, false], [0.024, true], [0.038, false], [0.046, false],
];
const TAKEN = 4;    // the tall one on the right is the one you take
const CANDLE_W = 0.011, WICK = 0.006, BASE_H = 0.012, GRAINS = 120, STRAYS = 36;

let MATS = null;
export function materials() {
  if (MATS) return MATS;
  const green = new THREE.MeshStandardMaterial({ color: STONKS_GREEN, emissive: STONKS_GREEN, emissiveIntensity: 0.35, roughness: 0.35, metalness: 0.1 });
  MATS = {
    gold: new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.85, roughness: 0.32, emissive: 0x3a2a0a, emissiveIntensity: 0.5 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.06, metalness: 0.8, emissive: 0xffffff, emissiveIntensity: 0.55, emissiveMap: mirrorTexture() }),
    acrylic: new THREE.MeshStandardMaterial({ color: 0xd8ecff, roughness: 0.08, metalness: 0.05, transparent: true, opacity: 0.32, depthWrite: false }),
    green,
    red: new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0xff3b3b, emissiveIntensity: 0.3, roughness: 0.35 }),
    wick: new THREE.MeshStandardMaterial({ color: 0xe8ffe8, emissive: 0x9fffb0, emissiveIntensity: 0.4, roughness: 0.5 }),
    powder: new THREE.MeshStandardMaterial({ color: 0x3df07a, emissive: STONKS_GREEN, emissiveIntensity: 0.45, roughness: 0.25, metalness: 0.35 }),
    cardBody: new THREE.MeshStandardMaterial({ color: 0x0c0c0f, roughness: 0.45, metalness: 0.2 }),
    cardFace: new THREE.MeshStandardMaterial({ map: cardTexture(), roughness: 0.38, metalness: 0.3 }),
    bill: new THREE.MeshStandardMaterial({ map: billTexture(), roughness: 0.75, side: THREE.DoubleSide }),
    billIn: new THREE.MeshStandardMaterial({ color: 0x9aa88a, roughness: 0.8, side: THREE.BackSide }),
    puff: new THREE.MeshBasicMaterial({ map: puffTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
  };
  MATS.bill.map.wrapS = MATS.bill.map.wrapT = THREE.RepeatWrapping;
  MATS.bill.map.repeat.set(0.3, 0.58);
  MATS.bill.map.offset.set(0.35, 0.21);
  return MATS;
}

/* The card: a black slab with the printed face on top (its origin at the
   middle of its underside). The first-person hands hold one too. */
export function makeCard(M) {
  const card = new THREE.Group();
  const body = new THREE.Mesh(slab(roundedRect(0.0856, 0.054, 0.003), 0.0008), M.cardBody);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.0856, 0.054).rotateX(-Math.PI / 2), M.cardFace);
  face.position.y = 0.00085;
  card.add(body, face);
  return card;
}
/* The bill: a rolled note, open at both ends so the roll shows (its axis
   along y, the origin at its middle). */
export function makeBill(M) {
  const bill = new THREE.Group();
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0032, 0.09, 14, 1, true), M.bill);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.0026, 0.0026, 0.088, 12, 1, true), M.billIn);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.0019, 0.0019, 0.086, 10, 1, true), M.bill);
  bill.add(roll, inner, core);
  return bill;
}

function candle(h, red, M) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(CANDLE_W, h, CANDLE_W), red ? M.red : M.green);
  body.position.y = h / 2;
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, h + WICK * 2, 6), M.wick);
  wick.position.y = h / 2;
  g.add(body, wick);
  g.userData.h = h;
  return g;
}

/* One table's props, in the tray frame. */
function buildTable(T, M, i) {
  const g = new THREE.Group();
  g.position.set(T.x, T.top, T.z);
  g.rotation.y = T.ry;
  const [tx, tz] = T.tray;
  const [sx, sz] = T.stand;

  // the mirror tray: a gold bevel frame round the glass
  const frame = roundedRect(0.36, 0.26, 0.02);
  frame.holes.push(roundedRect(0.34, 0.24, 0.012));
  const rim = new THREE.Mesh(slab(frame, 0.012), M.gold);
  rim.position.set(tx, 0, tz);
  const back = new THREE.Mesh(slab(roundedRect(0.36, 0.26, 0.02), 0.004), M.gold);
  back.position.set(tx, 0, tz);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.24).rotateX(-Math.PI / 2), M.glass);
  glass.position.set(tx, 0.0045, tz);
  g.add(back, rim, glass);

  // the candle stand: an acrylic base, five candles stepping up, the red dip in the middle
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.13, BASE_H, 0.05), M.acrylic);
  base.position.set(sx, BASE_H / 2, sz);
  base.renderOrder = 2;
  g.add(base);
  const slots = [];
  CANDLES.forEach(([h, red], k) => {
    const c = candle(h, red, M);
    c.position.set(sx - 0.048 + k * 0.024, BASE_H, sz);
    slots.push(c.position.clone());
    if (k === TAKEN) c.userData.taken = true;
    g.add(c);
  });
  const taken = g.children.find((o) => o.userData.taken);

  // the powder: a mound of grains, then the line and its strays
  const grainGeo = new THREE.IcosahedronGeometry(0.0022, 0);
  const pile = new THREE.InstancedMesh(grainGeo, M.powder, GRAINS);
  const r = rng(100 + i);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(), e = new THREE.Euler();
  for (let k = 0; k < GRAINS; k++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.016;
    const y = 0.0025 + Math.max(0, 0.014 - d) * (0.6 + r() * 0.5);
    p3.set(tx + Math.cos(a) * d * 1.3, 0.004 + y, tz + Math.sin(a) * d);
    q.setFromEuler(e.set(r() * 3, r() * 3, r() * 3));
    const sc = 0.7 + r() * 0.6;
    m4.compose(p3, q, s3.set(sc, sc * 0.8, sc));
    pile.setMatrixAt(k, m4);
  }
  pile.instanceMatrix.needsUpdate = true;
  pile.count = 0;
  const line = new THREE.Mesh(lineGeometry(7 + i), M.powder);
  line.position.set(tx, 0.0045, tz);
  line.geometry.setDrawRange(0, 0);
  const strays = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.0012, 0), M.powder, STRAYS);
  for (let k = 0; k < STRAYS; k++) {
    p3.set(tx - 0.07 + r() * 0.14, 0.0055, tz + (r() - 0.5) * 0.03);
    q.setFromEuler(e.set(r() * 3, r() * 3, 0));
    m4.compose(p3, q, s3.set(1, 1, 1));
    strays.setMatrixAt(k, m4);
  }
  strays.instanceMatrix.needsUpdate = true;
  strays.count = 0;
  g.add(pile, line, strays);

  // the card, at rest on the near corner of the tray
  const card = makeCard(M);
  card.userData.rest = { x: tx + 0.1, z: tz - 0.085, yaw: -0.3 };
  card.position.set(tx + 0.1, 0.0045, tz - 0.085);
  card.rotation.y = -0.3;
  g.add(card);

  // the bill, lying along the tray's far edge
  const bill = makeBill(M);
  bill.userData.rest = { x: tx - 0.02, z: tz + 0.09 };
  bill.position.set(tx - 0.02, 0.0045 + 0.0032, tz + 0.09);
  bill.rotation.z = Math.PI / 2;   // lying along x
  g.add(bill);

  // the dust: a few soft puffs over the candle
  const puffs = [];
  for (let k = 0; k < 6; k++) {
    const pf = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.05), M.puff);
    pf.visible = false;
    pf.renderOrder = 3;
    g.add(pf);
    puffs.push(pf);
  }

  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return { g, tx, tz, sx, sz, taken, slot: slots[TAKEN], pile, line, strays, card, bill, puffs, glass };
}

/* ------------------------------------------------------------ animating */

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
const LINE_SEGS = 28;

function poseTable(P, st, now, cam) {
  const t = st.start ? (now - st.start) / 1000 : -1;
  const S = lineState(t, st.cancelAt);
  const leftover = st.cancelAt != null && st.start && now - st.start > (st.cancelAt + LEFTOVER_SECS) * 1000;
  const finished = S.done || leftover;
  const g = P.g;
  // the candle: on the stand, then flat on the glass, squashed, then gone;
  // a new one on the stand once the line's over (the market printed one)
  const c = P.taken;
  if (!S.active || finished) {
    c.visible = true;
    c.position.copy(P.slot);
    c.rotation.set(0, 0, 0);
    c.scale.setScalar(1);
    if (S.done && t < BEATS.end + 0.4) { const k = (t - BEATS.end) / 0.4; c.scale.setScalar(0.2 + 0.8 * k); }   // pops back up
  } else {
    const k = S.pick, h = c.userData.h;
    c.visible = S.gone < 1;
    // from upright in its slot to lying on its side on the glass, mid-way up in an arc
    c.position.set(P.slot.x + (P.tx - P.slot.x) * k, P.slot.y + (0.0045 + CANDLE_W / 2 - P.slot.y) * k + Math.sin(k * Math.PI) * 0.06, P.slot.z + (P.tz - P.slot.z) * k);
    c.rotation.set(0, 0, Math.PI / 2 * k);
    // lying along x: the body's local y runs along -x after the roll; its origin is the base, so shift by half its length
    c.position.x += (h / 2) * k;
    const sq = 1 - 0.85 * S.squash;
    c.scale.set(1 + 0.7 * S.squash, sq, 1 + 0.7 * S.squash);
    c.children[0].material.transparent = false;
  }
  // the powder
  P.pile.count = Math.round(GRAINS * Math.min(1, S.pile * 1.08));
  const segs = Math.round(LINE_SEGS * S.line);
  const eaten = Math.round(segs * S.eaten);
  P.line.geometry.setDrawRange(eaten * 6, Math.max(0, (segs - eaten) * 6));
  P.strays.count = Math.round(STRAYS * S.line * (1 - S.eaten * 0.9));
  if (finished && !S.active) { P.pile.count = 0; P.line.geometry.setDrawRange(0, 0); P.strays.count = 0; }
  // the card: at rest, or in the hand over the mirror
  const card = P.card, R = card.userData.rest;
  card.visible = !(st.hideHand && S.card.on);
  if (S.card.on) {
    card.position.set(P.tx + S.card.x, 0.0045 + S.card.y, P.tz + S.card.z);
    card.rotation.set(0, S.card.yaw, 0);
    card.rotateX(-S.card.pitch);
    if (S.card.yaw > 1) card.rotation.z = -S.card.pitch;   // on its edge: tipped, not pitched
  } else {
    card.position.set(R.x, 0.0045, R.z);
    card.rotation.set(0, R.yaw, 0);
  }
  // the bill: lying on the tray, or up at the nose (`face`, world) tracking along the line
  const bill = P.bill, B = bill.userData.rest;
  bill.visible = !(st.hideHand && S.bill > 0.02);
  if (S.bill > 0.001 && st.face) {
    g.updateMatrixWorld(true);
    _v.set(B.x, 0.0077, B.z);
    _w.copy(st.face);
    g.worldToLocal(_w);
    // the nose rides along the line as it goes
    _w.x += (S.billSweep - 0.5) * 0.1 * S.eaten;
    _v.lerp(_w, S.bill);
    bill.position.copy(_v);
    // from flat on the tray to pointing down at the glass from the nose
    bill.rotation.set(0, 0, Math.PI / 2 * (1 - S.bill) + 0.25 * S.bill);
    bill.rotation.x = -0.9 * S.bill;
  } else {
    bill.position.set(B.x, 0.0077, B.z);
    bill.rotation.set(0, 0, Math.PI / 2);
  }
  // the dust: a puff per press, rising and thinning, facing the camera
  P.puffs.forEach((pf, k) => {
    const d = S.puffs[k];
    pf.visible = !!d && !finished;
    if (!d) return;
    const a = d.age;
    pf.position.set(P.tx + Math.sin(d.seed * 7 + k) * 0.012, 0.012 + a * 0.05, P.tz + Math.cos(d.seed * 5) * 0.01);
    pf.scale.setScalar(0.6 + a * 1.6);
    pf.material.opacity = (1 - a) * 0.9;
    if (cam) pf.quaternion.copy(cam.quaternion);
  });
}

/* Build the props on the map's root. Returns the handle the map lists as
   rp.lines(): the tables, their states, and the boxes for the test. */
export function buildLines({ root }) {
  const M = materials();
  const tables = LINE_TABLES.map((T, i) => {
    const P = buildTable(T, M, i);
    root.add(P.g);
    const st = { start: 0, by: null, cancelAt: null, face: null, hideHand: false, npc: -1 };
    P.g.children[0].onBeforeRender = (r, s, cam) => poseTable(P, st, performance.now(), cam);
    return { ...T, i, st, P };
  });
  const api = {
    tables,
    /* the tray's local point in world space */
    world: (i, x, y, z, out = new THREE.Vector3()) => { const P = tables[i].P; P.g.updateMatrixWorld(true); return P.g.localToWorld(out.set(P.tx + x, y, P.tz + z)); },
    /* the card's and bill's rest and live spots (tray-local), for the hands */
    card: (i) => lineState(tables[i].st.start ? (performance.now() - tables[i].st.start) / 1000 : -1, tables[i].st.cancelAt).card,
    state: lineState,
    /* rule 9: every prop's world box [x0,y0,z0,x1,y1,z1] */
    boxes: () => tables.flatMap((T) => {
      T.P.g.updateMatrixWorld(true);
      const out = [];
      T.P.g.traverse((o) => {
        if (!o.isMesh || !o.visible || (o.isInstancedMesh && !o.count)) return;
        o.geometry.computeBoundingBox();
        const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
        out.push([b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z]);
      });
      return out;
    }),
  };
  return api;
}
