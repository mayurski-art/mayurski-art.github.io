// Troll Forces — Kabukigrin's candle lines, v2 (docs/KB-SECURITY-ROOM.md 5;
// v1's tatami trays are gone, docs/CANDLE-LINES.md): the props and the
// timeline at the security room's desk (maps/kabukigrin-cctv.js). The joke
// is still crypto, done the way the user's concept video does it: the hand
// goes INTO the $TROLL chart on the monitor and pulls the tall green candle
// out, a bottle rolled over it like a rolling pin crushes it on the desk's
// glass, a card chops it into a line and gets flicked away, the face goes
// down on it, then up, then straight up through the roof, and back over
// the desk's edge.
//
// Everything here is a live mesh on the map's root: the candle, the powder
// (a pile, then the line), the card, the screen's ripple, the dust; the
// bottle, the chart and the chair are the security room's (cctv.bottle,
// .chart, .chair) and this moves them. One state (`st`) per station the
// mode drives (modes/social-lines.js): `start` (performance.now ms) and
// who, `cancelAt` (the beat a line stopped at: the powder stays 20 s).
//
// Rule 9: at rest it all lies on the desk's glass, under the monitor wall's
// lower edge; the card ends on the floor by the clutter.

import * as THREE from "three";

/* ------------------------------------------------------------ the beats */

// seconds from the hold-X; the mode, the body, the hands and the camera share these
export const BEATS = {
  down: 0.5,     // leaning in to the chart monitor
  reach: 1.1,    // the hand's in the screen
  pull: 1.7,     // ...and out, the candle in it
  lay: 2.0,      // the candle's on the glass
  cut: 3.1,      // the bottle's back: the card's up
  plant: 4.15,   // the face goes down (no stopping it from here)
  snap: 4.8,     // up again, STONKS
  launch: 5.2,   // straight up
  apex: 6.1,
  land: 7.0,     // back down, behind the desk
  grab: 7.25,    // hands on the desk's edge
  end: 8.4,      // over it, on your feet
};
export const ROLLS = [[2.3, 2.6], [2.6, 2.9]];   // the bottle's two passes
export const CHOPS = [3.3, 3.45, 3.6];
export const DRAG = [3.65, 3.95];
export const FLICK = [3.95, 4.15];
export const LEFTOVER_SECS = 20;            // a cancelled line stays this long
export const STONKS_GREEN = 0x1fd35a;
export const APEX_M = 35;                   // how high the launch goes
// where you come down: behind the desk, right of the chair
export const LAND = { dx: 0.5, dz: -0.3 };

const span = (t, [a, b]) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const ease = (k) => k * k * (3 - 2 * k);
const easeOut = (k) => 1 - (1 - k) * (1 - k);

/* The flight: metres above the floor and how far along to the landing (0..1). */
export function flight(t) {
  if (t < BEATS.launch || t >= BEATS.land) return { h: 0, k: t >= BEATS.land ? 1 : 0, up: false };
  if (t < BEATS.apex) { const k = span(t, [BEATS.launch, BEATS.apex]); return { h: APEX_M * easeOut(k), k: k * 0.5, up: true }; }
  const k = span(t, [BEATS.apex, BEATS.land]);
  return { h: APEX_M * (1 - k * k), k: 0.5 + k * 0.5, up: false };
}

/* What everything's doing `t` seconds in (t < 0: idle). `cancelAt`, when
   set, freezes the powder where it stopped and puts the rest back.
   Positions are station-local metres (+x east along the line, +z toward
   the chair, y up off the glass). */
export function lineState(t, cancelAt = null) {
  const S = { active: t >= 0, lean: 0, reach: 0, ripple: 0, taken: false, candle: "stand", pull: 0, squash: 0,
    bottle: { mode: "rest", k: 0, z: -0.1, spin: 0 }, pile: 0, line: 0, eaten: 0, plant: 0, snap: 0,
    card: { x: 0.2, z: 0.1, y: 0, yaw: -0.3, pitch: 0, on: false, fly: -1 }, chop: 0, drag: 0, puffs: [], flight: flight(t), climb: 0, done: false };
  if (t < 0) return S;
  const tc = cancelAt != null ? Math.min(t, cancelAt) : t;
  const cancelled = cancelAt != null && t > cancelAt;
  S.lean = ease(span(tc, [0, BEATS.down])) * (1 - ease(span(t, [BEATS.snap, BEATS.launch])));
  S.reach = cancelled ? 0 : ease(span(tc, [BEATS.down, BEATS.reach])) * (1 - ease(span(tc, [BEATS.reach + 0.2, BEATS.pull])));
  S.ripple = tc >= BEATS.down + 0.3 && tc < BEATS.pull + 0.3 ? Math.sin(span(tc, [BEATS.down + 0.3, BEATS.pull + 0.3]) * Math.PI) : 0;
  S.taken = tc >= BEATS.reach + 0.15 && t < BEATS.end;
  // the candle: in the chart, in the hand, on the glass, crushed
  if (tc < BEATS.reach + 0.15) S.candle = "chart";
  else if (tc < BEATS.lay) { S.candle = "hand"; S.pull = span(tc, [BEATS.reach + 0.15, BEATS.lay]); }
  else S.candle = "glass";
  if (cancelled && S.candle === "hand") S.candle = "glass";   // dropped where it was going
  // the bottle: lifted and laid across, two passes, stood back up
  const B = S.bottle;
  if (!cancelled && tc >= BEATS.lay && tc < ROLLS[0][0]) { B.mode = "lift"; B.k = ease(span(tc, [BEATS.lay, ROLLS[0][0]])); }
  else if (!cancelled && tc >= ROLLS[0][0] && tc < ROLLS[1][1]) {
    B.mode = "roll";
    const first = tc < ROLLS[0][1], k = ease(span(tc, first ? ROLLS[0] : ROLLS[1]));
    B.z = first ? -0.1 + 0.16 * k : 0.06 - 0.16 * k;
    B.spin = (B.z + 0.1) / 0.038;
  } else if (!cancelled && tc >= ROLLS[1][1] && tc < BEATS.cut) { B.mode = "back"; B.k = ease(span(tc, [ROLLS[1][1], BEATS.cut])); }
  // crushed as the bottle crosses it, once each pass
  const crossed = (tc >= (ROLLS[0][0] + ROLLS[0][1]) / 2 ? 1 : 0) + (tc >= (ROLLS[1][0] + ROLLS[1][1]) / 2 ? 1 : 0);
  S.squash = crossed / 2;
  for (const [a, b] of ROLLS) { const m = (a + b) / 2, d = tc - m; if (d >= 0 && d < 0.7) S.puffs.push({ age: d / 0.7, seed: m }); }
  S.pile = crossed / 2;
  for (const c of CHOPS) {
    const a = tc - c;
    if (a >= 0 && a < 0.12) S.chop = Math.max(S.chop, a < 0.05 ? a / 0.05 : 1 - (a - 0.05) / 0.07);
  }
  S.drag = span(tc, DRAG);
  S.line = ease(S.drag);
  S.pile *= 1 - S.line;
  if (S.candle === "glass" && S.squash >= 1) S.candle = "gone";
  // the card: picked up, chops, the drag, flicked over the shoulder
  const C = S.card;
  if (!cancelled && tc >= BEATS.cut && tc < FLICK[0]) {
    C.on = true;
    const pick = ease(span(tc, [BEATS.cut, BEATS.cut + 0.15]));
    if (tc < DRAG[0]) {
      const chopX = tc < CHOPS[1] ? -0.03 : tc < CHOPS[2] ? 0.0 : 0.03;
      C.x = 0.2 + (chopX - 0.2) * pick; C.z = 0.1 - 0.1 * pick;
      C.y = 0.02 - 0.018 * S.chop + 0.03 * (1 - pick);
      C.yaw = -0.3 + (Math.PI / 2 + 0.3) * pick; C.pitch = 0.2;
    } else {
      C.x = -0.08 + 0.16 * easeOut(S.drag); C.z = 0.012; C.y = 0.0015;
      C.yaw = Math.PI / 2 - 0.12; C.pitch = 0.5;
    }
  } else if (!cancelled && tc >= FLICK[0]) {
    C.fly = span(tc, FLICK);
  }
  // the face: down on the line, the line gone, up again
  S.plant = ease(span(t, [BEATS.plant, BEATS.plant + 0.3])) * (1 - ease(span(t, [BEATS.snap - 0.1, BEATS.snap + 0.15])));
  if (cancelled) S.plant = 0;
  S.eaten = ease(span(tc, [BEATS.plant + 0.15, BEATS.plant + 0.45]));
  S.snap = t >= BEATS.snap ? Math.max(0, 1 - (t - BEATS.snap) / 0.5) : 0;
  S.climb = ease(span(t, [BEATS.grab, BEATS.end - 0.15]));
  S.done = t >= BEATS.end;
  return S;
}

/* ------------------------------------------------------------ textures */

const canvas = (w, h, draw) => { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); return c; };
const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// the card's face: matte black, a gold chip, $TROLL embossed, a number
function cardTexture() {
  return tex(canvas(512, 324, (g, W, H) => {
    g.fillStyle = "#0e0e11"; g.fillRect(0, 0, W, H);
    const lg = g.createLinearGradient(0, 0, W, H);
    lg.addColorStop(0, "rgba(255,255,255,0.05)"); lg.addColorStop(0.5, "rgba(255,255,255,0)"); lg.addColorStop(1, "rgba(255,255,255,0.06)");
    g.fillStyle = lg; g.fillRect(0, 0, W, H);
    g.fillStyle = "#c9a24a"; g.beginPath(); g.roundRect(54, 108, 78, 62, 8); g.fill();
    g.strokeStyle = "#8a6a26"; g.lineWidth = 2;
    for (const y of [128, 150]) { g.beginPath(); g.moveTo(54, y); g.lineTo(132, y); g.stroke(); }
    g.beginPath(); g.moveTo(93, 108); g.lineTo(93, 170); g.stroke();
    g.font = "700 64px Oswald, 'DM Sans', sans-serif";
    g.fillStyle = "rgba(0,0,0,0.6)"; g.fillText("$TROLL", 58, 262);
    g.fillStyle = "#d8b45a"; g.fillText("$TROLL", 54, 258);
    g.font = "500 22px 'DM Mono', monospace";
    g.fillStyle = "#8f8f96"; g.fillText("4200 6900 0420 1337", 56, 300);
    g.font = "700 20px Oswald, sans-serif"; g.fillStyle = "#b9b9c2"; g.textAlign = "right";
    g.fillText("TROLLNITE BLACK", W - 40, 56);
  }));
}
function puffTexture() {
  return tex(canvas(64, 64, (g) => {
    const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, "rgba(120,255,160,0.9)"); rg.addColorStop(0.4, "rgba(60,220,110,0.35)"); rg.addColorStop(1, "rgba(31,211,90,0)");
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  }));
}
// the screen's ripple round the wrist: rings
function ringTexture() {
  return tex(canvas(128, 128, (g) => {
    for (const [r, a] of [[60, 0.9], [44, 0.6], [28, 0.4]]) {
      g.strokeStyle = `rgba(110,255,160,${a})`; g.lineWidth = 5;
      g.beginPath(); g.arc(64, 64, r, 0, Math.PI * 2); g.stroke();
    }
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
function slab(shape, depth) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  return g;
}
/* The line: a 15 cm strip along x with jagged edges. Its triangles run from
   -x to +x, so a draw range eats it from one end. */
const LINE_SEGS = 28, LINE_L = 0.15;
function lineGeometry(seedN = 5) {
  const r = rng(seedN), pos = [], idx = [];
  for (let i = 0; i <= LINE_SEGS; i++) {
    const x = -LINE_L / 2 + (i / LINE_SEGS) * LINE_L;
    const taper = Math.sin((i / LINE_SEGS) * Math.PI) ** 0.35;
    const w = (0.0055 + r() * 0.003) * taper, w2 = (0.0055 + r() * 0.003) * taper;
    pos.push(x, 0.0012, -w2, x, 0.0012, w);
  }
  for (let i = 0; i < LINE_SEGS; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

let MATS = null;
export function materials() {
  if (MATS) return MATS;
  MATS = {
    green: new THREE.MeshStandardMaterial({ color: STONKS_GREEN, emissive: STONKS_GREEN, emissiveIntensity: 0.6, roughness: 0.35, metalness: 0.1 }),
    wick: new THREE.MeshStandardMaterial({ color: 0xe8ffe8, emissive: 0x9fffb0, emissiveIntensity: 0.5, roughness: 0.5 }),
    powder: new THREE.MeshStandardMaterial({ color: 0x3df07a, emissive: STONKS_GREEN, emissiveIntensity: 0.5, roughness: 0.25, metalness: 0.35 }),
    cardBody: new THREE.MeshStandardMaterial({ color: 0x0c0c0f, roughness: 0.45, metalness: 0.2 }),
    cardFace: new THREE.MeshStandardMaterial({ map: cardTexture(), roughness: 0.38, metalness: 0.3 }),
    puff: new THREE.MeshBasicMaterial({ map: puffTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    ring: new THREE.MeshBasicMaterial({ map: ringTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
  };
  return MATS;
}

/* The card: a black slab with the printed face on top (origin: the middle
   of its underside). */
export function makeCard(M) {
  const card = new THREE.Group();
  const body = new THREE.Mesh(slab(roundedRect(0.0856, 0.054, 0.003), 0.0008), M.cardBody);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.0856, 0.054).rotateX(-Math.PI / 2), M.cardFace);
  face.position.y = 0.00085;
  card.add(body, face);
  return card;
}
/* The candle off the chart: a green body with its wicks (origin: its middle). */
const CANDLE = { w: 0.018, h: 0.075, wick: 0.012 };
export function makeCandle(M) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(CANDLE.w, CANDLE.h, CANDLE.w), M.green);
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, CANDLE.h + CANDLE.wick * 2, 6), M.wick);
  g.add(body, wick);
  return g;
}

/* ------------------------------------------------------------ the station

   One: the security desk's glass, in front of the keyboard, the chair
   facing it (kabukigrin-cctv.js DESK, CHAIR). */
const GRAINS = 140, STRAYS = 40;
function buildStation(cctv, M) {
  const D = cctv.desk, C = cctv.chair;
  const T = { i: 0, x: C.x, z: 19.93, top: D.glassTop, floor: 3, ry: 0, seat: { x: C.x, z: C.z, y: C.seat } };
  const g = new THREE.Group();
  g.position.set(T.x, T.top, T.z);
  const candle = makeCandle(M);
  candle.visible = false;
  g.add(candle);
  // the powder: a mound of grains, then the line and its strays
  const pile = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.0028, 0), M.powder, GRAINS);
  const r = rng(101);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(), e = new THREE.Euler();
  for (let k = 0; k < GRAINS; k++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.022;
    p3.set(Math.cos(a) * d * 1.8, 0.002 + Math.max(0, 0.016 - d) * (0.5 + r() * 0.5), Math.sin(a) * d * 0.8);
    q.setFromEuler(e.set(r() * 3, r() * 3, r() * 3));
    const sc = 0.7 + r() * 0.6;
    pile.setMatrixAt(k, m4.compose(p3, q, s3.set(sc, sc * 0.7, sc)));
  }
  pile.instanceMatrix.needsUpdate = true;
  pile.count = 0;
  const line = new THREE.Mesh(lineGeometry(9), M.powder);
  line.geometry.setDrawRange(0, 0);
  const strays = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.0014, 0), M.powder, STRAYS);
  for (let k = 0; k < STRAYS; k++) {
    p3.set(-0.085 + r() * 0.17, 0.001, (r() - 0.5) * 0.035);
    q.setFromEuler(e.set(r() * 3, r() * 3, 0));
    strays.setMatrixAt(k, m4.compose(p3, q, s3.set(1, 1, 1)));
  }
  strays.instanceMatrix.needsUpdate = true;
  strays.count = 0;
  g.add(pile, line, strays);
  // the card at rest on the glass, right of the line
  const card = makeCard(M);
  card.scale.setScalar(1.3);
  g.add(card);
  // the dust: a puff per pass of the bottle
  const puffs = [];
  for (let k = 0; k < 4; k++) {
    const pf = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.07), M.puff);
    pf.visible = false;
    pf.renderOrder = 3;
    g.add(pf);
    puffs.push(pf);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  // the ripple on the chart monitor, over its tall candle (the chart's group: x along the screen)
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), M.ring);
  ring.position.set(cctv.chart.w * 0.44, cctv.chart.h * 0.24, 0.02);
  ring.visible = false;
  ring.renderOrder = 3;
  cctv.chart.mesh.add(ring);
  // the roof's puffs where the launch goes through (world)
  const roof = [];
  for (let k = 0; k < 5; k++) {
    const pf = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), M.puff);
    pf.visible = false;
    pf.renderOrder = 3;
    roof.push(pf);
  }
  return { T, g, candle, pile, line, strays, card, puffs, ring, roof };
}

/* ------------------------------------------------------------ animating */

const _v = new THREE.Vector3(), _w = new THREE.Vector3();
// the floor spot the flicked card lands on (station-local)
const CARD_FLOOR = { x: -0.78, y: -0.752, z: 1.36 };

function pose(P, cctv, st, now, cam) {
  const t = st.start ? (now - st.start) / 1000 : -1;
  const S = lineState(t, st.cancelAt);
  const leftover = st.cancelAt != null && st.start && now - st.start > (st.cancelAt + LEFTOVER_SECS) * 1000;
  const idle = !S.active || S.done || leftover;
  cctv.taken = idle ? 0 : S.taken ? 1 : 0;
  // the ripple, grown and faded on the chart
  P.ring.visible = !idle && S.ripple > 0.01;
  if (P.ring.visible) { P.ring.scale.setScalar(0.5 + S.ripple * 1.2 + Math.sin(now / 90) * 0.06); P.ring.material.opacity = S.ripple; }
  // the candle: from the chart to the hand to the glass, squashed, gone
  const c = P.candle;
  c.visible = !idle && (S.candle === "hand" || S.candle === "glass");
  if (c.visible) {
    P.ring.updateMatrixWorld(true);
    P.ring.getWorldPosition(_w);
    P.g.worldToLocal(_w);
    const k = S.candle === "hand" ? S.pull : 1;
    // out of the screen toward the chair, up, then down flat on the glass
    _v.set(_w.x * (1 - k), _w.y * (1 - k) + Math.sin(k * Math.PI) * 0.12 + CANDLE.w / 2 * k, _w.z * (1 - k));
    c.position.copy(_v);
    c.rotation.set(0, 0, (Math.PI / 2) * ease(Math.max(0, k * 1.6 - 0.6)));
    c.scale.set(1 - 0.7 * S.squash, 1 + 0.3 * S.squash, 1 + 1.4 * S.squash);
  }
  // the bottle (the room's): lifted, laid across, rolled, stood back up
  const b = cctv.bottle, rest = b.userData.rest, B = S.bottle;
  const laid = (z) => { _v.set(0, 0.038, z); P.g.localToWorld(_v); return _v; };
  if (idle || B.mode === "rest") { b.position.copy(rest); b.rotation.set(0, 0, 0); }
  else if (B.mode === "lift" || B.mode === "back") {
    const k = B.mode === "lift" ? B.k : 1 - B.k;
    const to = laid(-0.1).clone();
    to.x += 0.135;   // laid, it runs from its foot toward -x: its middle over the line
    b.position.lerpVectors(rest, to, k);
    b.position.y += Math.sin(k * Math.PI) * 0.12;
    b.rotation.set(0, 0, (Math.PI / 2) * k);
  } else {
    const p = laid(B.z);
    b.position.set(p.x + 0.135, p.y, p.z);
    b.rotation.set(B.spin, 0, Math.PI / 2, "XYZ");
  }
  // the powder (a stopped line's stays till its 20 s are up)
  const segs = idle ? 0 : Math.round(LINE_SEGS * S.line), eaten = Math.round(segs * S.eaten);
  P.pile.count = idle ? 0 : Math.round(GRAINS * Math.min(1, S.pile * 1.08));
  P.line.geometry.setDrawRange(eaten * 6, Math.max(0, (segs - eaten) * 6));
  P.strays.count = idle ? 0 : Math.round(STRAYS * S.line * (1 - S.eaten * 0.9));
  // the card: at rest, in the hand, flying, on the floor till the next line
  const card = P.card, C = S.card;
  if (C.on) {
    card.position.set(C.x, C.y, C.z);
    card.rotation.set(0, C.yaw, 0);
    card.rotateX(-C.pitch);
    if (C.yaw > 1) card.rotation.z = -C.pitch;
  } else if (C.fly >= 0 || st.cardDown) {
    const k = C.fly >= 0 ? C.fly : 1;
    if (k >= 1) st.cardDown = true;
    card.position.set(0.07 + (CARD_FLOOR.x - 0.07) * k, 0.01 + (CARD_FLOOR.y - 0.01) * k + Math.sin(k * Math.PI) * 0.55, 0.01 + (CARD_FLOOR.z - 0.01) * k);
    card.rotation.set(k * 9, k * 5, k * 3);
    if (k >= 1) card.rotation.set(0, 0.8, 0);
  } else {
    card.position.set(0.2, 0, 0.1);
    card.rotation.set(0, -0.3, 0);
  }
  // the dust off each pass
  P.puffs.forEach((pf, k) => {
    const d = S.puffs[k];
    pf.visible = !!d && !idle;
    if (!d) return;
    pf.position.set(Math.sin(d.seed * 7 + k) * 0.015, 0.02 + d.age * 0.07, Math.cos(d.seed * 5) * 0.012);
    pf.scale.setScalar(0.6 + d.age * 1.8);
    pf.material.opacity = (1 - d.age) * 0.9;
    if (cam) pf.quaternion.copy(cam.quaternion);
  });
  // the chair spins off on its own as you go up, and settles
  const spinK = span(t, [BEATS.launch, BEATS.end]);
  cctv.chair.spin.rotation.y = !idle && t >= BEATS.launch ? Math.PI * 6 * easeOut(spinK) : 0;
  // the roof's dust where you went through
  const rt = t - (BEATS.launch + 0.2);
  P.roof.forEach((pf, k) => {
    pf.visible = !idle && rt >= 0 && rt < 2.4;
    if (!pf.visible) return;
    const a = rt / 2.4;
    pf.position.set(P.T.seat.x + Math.sin(k * 2.3) * 0.6 * a, 7.42 + a * 1.2 + k * 0.1, P.T.seat.z + Math.cos(k * 1.7) * 0.6 * a);
    pf.scale.setScalar(0.8 + a * 2.5);
    pf.material.opacity = (1 - a) * 0.7;
    if (cam) pf.quaternion.copy(cam.quaternion);
  });
}

/* Build the props on the map's root, round the security room's desk.
   Returns the handle the map lists as rp.lines(). */
export function buildLines({ root, cctv }) {
  const M = materials();
  const P = buildStation(cctv, M);
  root.add(P.g);
  for (const pf of P.roof) root.add(pf);
  const st = { start: 0, by: null, cancelAt: null, npc: -1, cardDown: false };
  const T = { ...P.T, st, P };
  // the card's face poses it all each frame (never culled: it's always there)
  P.card.children[1].frustumCulled = false;
  P.card.children[1].onBeforeRender = (r, s, cam) => pose(P, cctv, st, performance.now(), cam);
  const api = {
    tables: [T],
    cctv,
    /* the station's local point in world space */
    world: (i, x, y, z, out = new THREE.Vector3()) => { P.g.updateMatrixWorld(true); return P.g.localToWorld(out.set(x, y, z)); },
    /* the chart's tall candle (where the hand goes in), world */
    chartPoint: (out = new THREE.Vector3()) => { P.ring.updateMatrixWorld(true); return P.ring.getWorldPosition(out); },
    state: lineState,
    /* rule 9: the props' world boxes [x0,y0,z0,x1,y1,z1] */
    boxes: () => {
      P.g.updateMatrixWorld(true);
      const out = [];
      P.g.traverseVisible((o) => {
        if (!o.isMesh || (o.isInstancedMesh && !o.count)) return;
        o.geometry.computeBoundingBox();
        const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
        out.push([b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z]);
      });
      return out;
    },
  };
  return api;
}
