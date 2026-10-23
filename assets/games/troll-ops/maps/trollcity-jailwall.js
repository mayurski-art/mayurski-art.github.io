// Troll Forces — Troll City: the jailbreak wall in each cell (memory note
// "Troll City jailbreak", user 2026-10-22). A chalk trollface traced on the
// cell's back wall, eight critical spots on it (the eyes, the brows, the
// nose, the mouth's corners, the chin), the bullet holes, and the weak
// patch of brick beside the bunk that blows out once every spot is hit:
// its two faces and its collider go, and the desert behind the hall is open.
//
// Drawing only: who may shoot, a miss and the breakout's sync are
// modes/social-jailbreak.js's. The wall runs along z at x = `x` (the cell's
// side of the hall's east wall), the cell looking out at it along +x.

import * as THREE from "three";

const FACE_URL = new URL("../../../images/wallpaper/trollface%20transparent.png", import.meta.url).href;
const PX = 200;                                  // canvas pixels per metre
const FACE = { w: 1.7 * 800 / 730, h: 1.7 };    // the tracing, the art's 800 x 730: between the bunk and the window
// The critical spots, as fractions of the art (0,0 its top left), checked
// against the line art (800 x 730), drawn over it
export const SPOTS = [
  { n: "left eye", u: 0.30, v: 0.33 }, { n: "right eye", u: 0.58, v: 0.31 },
  { n: "left brow", u: 0.27, v: 0.22 }, { n: "right brow", u: 0.62, v: 0.20 },
  { n: "nose", u: 0.47, v: 0.47 }, { n: "mouth, left", u: 0.17, v: 0.48 },
  { n: "mouth, right", u: 0.82, v: 0.44 }, { n: "chin", u: 0.50, v: 0.82 },
];
export const SPOT_R = 0.11;                      // metres: a hit this near a spot's middle counts
export const BREACH = { w: 1.5, h: 2.45 };     // the gap the plug fills, from the ground outside (the cell floor is 0.3 up)

let faceImg = null;
const faceReady = new Promise((r) => {
  const i = new Image();
  i.onload = () => { faceImg = i; r(i); };
  i.onerror = () => r(null);
  i.src = FACE_URL;
});

/* The cell's back wall: `x` its inside face (the lining's), `zc` the cell's
   middle, `top` the tracing's top edge, `win` the barred window in it,
   `breachC` where the weak patch's middle sits along z, `y` the floor.
   `outerX` the wall's outside face; `brick`/`lining` its two materials;
   `cellZ` [z0, z1] the cell's inside, so its soot stays in it. */
export function buildJailWall(api, root, { x, outerX, zc, top = 2.55, win, breachC, y = 0, brick, lining, faceC = zc - 0.15, cellZ = [zc - 1.6, zc + 1.6] }) {
  const zL = faceC - FACE.w / 2, yT = top;
  const breach = { z0: breachC - BREACH.w / 2, z1: breachC + BREACH.w / 2, y0: y, y1: y + BREACH.h };
  // the canvas covers the tracing and, round the weak patch, where the blast's soot goes
  const U = { z0: Math.min(zL, Math.max(cellZ[0] + 0.02, breach.z0 - 0.6)), z1: Math.max(zL + FACE.w, Math.min(cellZ[1] - 0.02, breach.z1 + 0.6)), y0: y, y1: Math.max(yT, y + 3.0) };
  const cw = Math.round((U.z1 - U.z0) * PX), ch = Math.round((U.y1 - U.y0) * PX);
  const fw = Math.round(FACE.w * PX), fh = Math.round(FACE.h * PX);
  const canvas = document.createElement("canvas");
  canvas.width = cw; canvas.height = ch;
  const g = canvas.getContext("2d");
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.95,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const mural = new THREE.Mesh(new THREE.PlaneGeometry(U.z1 - U.z0, U.y1 - U.y0), mat);
  mural.position.set(x - 0.012, (U.y0 + U.y1) / 2, (U.z0 + U.z1) / 2);
  mural.rotation.y = -Math.PI / 2;               // facing into the cell; the art's right is +z
  mural.renderOrder = 2;
  root.add(mural);

  // wall point (z, y) <-> canvas pixel
  const toPx = (z, yy) => [(z - U.z0) * PX, (U.y1 - yy) * PX];
  const spotAt = (s) => ({ z: zL + s.u * FACE.w, y: yT - s.v * FACE.h });
  const spots = SPOTS.map((s) => ({ ...s, ...spotAt(s), hit: false }));
  const holes = [];
  let state = "whole";                           // "whole" | "lost" (missed) | "broken"
  let ragged = null;                             // the blown hole's edge, [z, y] (set below)

  function cut(g2) {
    // the window shows through, and the breach once it's open
    const [wx, wy] = toPx(win.z - win.w / 2, win.y1);
    g2.clearRect(wx, wy, win.w * PX, (win.y1 - win.y0) * PX);
    if (state === "broken" && ragged) {
      g2.save();
      g2.globalCompositeOperation = "destination-out";
      g2.beginPath();
      ragged.forEach(([hz, hy], k) => { const [px, py] = toPx(hz, hy); if (k) g2.lineTo(px, py); else g2.moveTo(px, py); });
      g2.closePath(); g2.fill();
      g2.restore();
    }
  }
  function chalkSpot(s) {
    const [px, py] = toPx(s.z, s.y), r = SPOT_R * PX;
    g.save();
    g.lineCap = "round";
    if (s.hit) {
      g.fillStyle = "rgba(196, 44, 32, 0.85)";
      g.beginPath(); g.arc(px, py, r * 0.95, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = state === "lost" ? "rgba(140, 132, 118, 0.6)" : "rgba(255, 246, 222, 0.95)";
    g.lineWidth = 3.2;
    g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.stroke();
    if (!s.hit) {
      const k = r * 0.5;
      g.beginPath(); g.moveTo(px - k, py - k); g.lineTo(px + k, py + k); g.moveTo(px + k, py - k); g.lineTo(px - k, py + k); g.stroke();
    }
    g.restore();
  }
  function hole(h) {
    const [px, py] = toPx(h.z, h.y);
    const gr = g.createRadialGradient(px, py, 0, px, py, 9);
    gr.addColorStop(0, "rgba(14, 10, 8, 0.95)"); gr.addColorStop(0.45, "rgba(30, 22, 18, 0.85)");
    gr.addColorStop(0.7, "rgba(210, 190, 160, 0.35)"); gr.addColorStop(1, "rgba(210, 190, 160, 0)");
    g.fillStyle = gr;
    g.beginPath(); g.arc(px, py, 9, 0, Math.PI * 2); g.fill();
  }
  /* Blown: soot fading out from the hole's edge, and cracks running off it. */
  function sootInside() {
    let sd = Math.round(breachC * 777) | 1;
    const rn = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 10; k++) {
      const [cx, cy] = toPx(HOLE.c + (rn() - 0.5) * 0.6, HOLE.cy + (rn() - 0.4) * 0.9), rr = (0.8 + rn() * 0.6) * PX;
      const gr = g.createRadialGradient(cx, cy, rr * 0.3, cx, cy, rr);
      gr.addColorStop(0, "rgba(10, 7, 5, 0.8)"); gr.addColorStop(0.6, "rgba(14, 10, 8, 0.35)"); gr.addColorStop(1, "rgba(16, 12, 10, 0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, cw, ch);
    }
    g.strokeStyle = "rgba(8, 6, 4, 0.85)"; g.lineCap = "round"; g.lineWidth = 4;
    for (let k = 0; k < 9; k++) {
      const [hz, hy] = ragged[Math.floor(rn() * ragged.length)];
      let a = Math.atan2(hy - HOLE.cy, hz - HOLE.c), [pz, py] = toPx(hz, hy);
      g.beginPath(); g.moveTo(pz, py);
      for (let j = 0; j < 4; j++) {
        a += (rn() - 0.5) * 0.9;
        pz += Math.cos(a) * (12 + rn() * 22); py -= Math.sin(a) * (12 + rn() * 22);
        g.lineTo(pz, py);
      }
      g.stroke();
    }
  }
  function redraw() {
    g.clearRect(0, 0, cw, ch);
    if (state === "broken" && ragged) sootInside();
    if (faceImg) {
      // the line art as chalk: its dark strokes only, a little uneven
      const t = document.createElement("canvas");
      t.width = fw; t.height = fh;
      const tg = t.getContext("2d");
      tg.drawImage(faceImg, 0, 0, fw, fh);
      const d = tg.getImageData(0, 0, fw, fh), p = d.data;
      let seed = 7;
      for (let i = 0; i < p.length; i += 4) {
        const line = p[i + 3] > 128 && p[i] + p[i + 1] + p[i + 2] < 240;
        seed = (seed * 16807) % 2147483647;
        const a = line ? (0.62 + 0.3 * (seed / 2147483647)) * (state === "lost" ? 0.45 : 1) : 0;
        p[i] = 240; p[i + 1] = 234; p[i + 2] = 218; p[i + 3] = a * 255;
      }
      tg.putImageData(d, 0, 0);
      const [fx, fy] = toPx(zL, yT);
      g.drawImage(t, fx, fy);
    }
    for (const s of spots) chalkSpot(s);
    for (const h of holes) hole(h);
    cut(g);
    tex.needsUpdate = true;
  }
  faceReady.then(redraw);
  redraw();

  // The weak patch: a brick plug in the gap wall() left for it, both faces
  // UV'd in world metres as the wall's own pieces are, so it doesn't show.
  const plug = new THREE.Group();
  const face = (m, fx, ry) => {
    const geo = new THREE.PlaneGeometry(BREACH.w, BREACH.h);
    const tile = m.userData.tile || 2, pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let k = 0; k < pos.count; k++) {
      const wz = breachC + pos.getX(k) * (ry > 0 ? -1 : 1), wy = breach.y0 + BREACH.h / 2 + pos.getY(k);
      uv.setXY(k, wz / tile, wy / tile);
    }
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(fx, breach.y0 + BREACH.h / 2, breachC);
    mesh.rotation.y = ry;
    mesh.receiveShadow = true;
    plug.add(mesh);
  };
  face(brick, outerX + 0.001, Math.PI / 2);      // out to the desert
  face(lining, x - 0.001, -Math.PI / 2);         // in to the cell
  root.add(plug);

  // Blown: what's left of the patch is a ragged ring of brick round a hole
  // blasted through (no door shape: user, 2026-10-22), the full wall thick,
  // scorched on both faces. The hole's floor is the cell's (y + 0.3).
  let seed = Math.round(breachC * 1000) | 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const floorY = y + 0.3;
  const HOLE = { c: breachC, cy: y + 1.3, rz: 0.7, ry: 0.92 };
  ragged = [];
  for (let k = 0; k < 34; k++) {
    // deep bites round the sides, shallower over the top (head room), every
    // other point pulled in for the broken-brick teeth
    const a = (k / 34) * Math.PI * 2, top = Math.sin(a) > 0.45;
    const f = top ? 0.86 + rnd() * 0.14 : (k % 2 ? 0.62 + rnd() * 0.2 : 0.84 + rnd() * 0.16);
    const hz = Math.max(breach.z0 + 0.05, Math.min(breach.z1 - 0.05, HOLE.c + Math.cos(a) * HOLE.rz * f));
    const hy = Math.max(floorY, Math.min(breach.y1 - 0.08, HOLE.cy + Math.sin(a) * HOLE.ry * f));
    ragged.push([hz, hy]);
  }
  const holeShape = () => {
    const s = new THREE.Shape();
    s.moveTo(breach.z0, breach.y0); s.lineTo(breach.z1, breach.y0); s.lineTo(breach.z1, breach.y1); s.lineTo(breach.z0, breach.y1); s.closePath();
    const h = new THREE.Path();
    ragged.forEach(([hz, hy], k) => (k ? h.lineTo(hz, hy) : h.moveTo(hz, hy)));
    h.closePath();
    s.holes.push(h);
    return s;
  };
  const metres = (geo, tile) => {
    const uv = geo.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) / tile, uv.getY(k) / tile);
  };
  const blown = new THREE.Group();
  {
    // shape x = world z, shape y = world y; turned -90 degrees, the extrusion
    // runs from the outside face in toward the cell
    const geo = new THREE.ExtrudeGeometry(holeShape(), { depth: outerX - x - 0.004, bevelEnabled: false });
    metres(geo, brick.userData.tile || 2);
    const ringMesh = new THREE.Mesh(geo, brick);
    ringMesh.rotation.y = -Math.PI / 2;
    ringMesh.position.x = outerX - 0.002;
    ringMesh.castShadow = ringMesh.receiveShadow = true;
    blown.add(ringMesh);
    const lgeo = new THREE.ShapeGeometry(holeShape());
    metres(lgeo, lining.userData.tile || 2);
    const lin = new THREE.Mesh(lgeo, lining);
    lin.rotation.y = -Math.PI / 2;
    lin.position.x = x - 0.001;
    blown.add(lin);
  }
  // the scorch outside: soot fading out from the hole's edge, the hole itself clear
  const SC = { z0: breach.z0 - 0.7, z1: breach.z1 + 0.7, y0: y, y1: y + 3.0 };
  const scW = 256, scH = Math.round(scW * (SC.y1 - SC.y0) / (SC.z1 - SC.z0));
  const sc = document.createElement("canvas");
  sc.width = scW; sc.height = scH;
  {
    const s = sc.getContext("2d");
    const sx = (z) => (z - SC.z0) / (SC.z1 - SC.z0) * scW, sy = (yy) => (SC.y1 - yy) / (SC.y1 - SC.y0) * scH;
    for (let k = 0; k < 10; k++) {
      const cz = HOLE.c + (rnd() - 0.5) * 0.6, cy = HOLE.cy + (rnd() - 0.4) * 0.9, r = (0.8 + rnd() * 0.6) / (SC.z1 - SC.z0) * scW;
      const gr = s.createRadialGradient(sx(cz), sy(cy), r * 0.3, sx(cz), sy(cy), r);
      gr.addColorStop(0, "rgba(10, 7, 5, 0.8)"); gr.addColorStop(0.6, "rgba(14, 10, 8, 0.35)"); gr.addColorStop(1, "rgba(16, 12, 10, 0)");
      s.fillStyle = gr;
      s.fillRect(0, 0, scW, scH);
    }
    // cracks running off the hole's edge
    s.strokeStyle = "rgba(8, 6, 4, 0.85)"; s.lineCap = "round";
    for (let k = 0; k < 9; k++) {
      const [hz, hy] = ragged[Math.floor(rnd() * ragged.length)];
      let a = Math.atan2(hy - HOLE.cy, hz - HOLE.c), pz = sx(hz), py = sy(hy);
      s.lineWidth = 2.6;
      s.beginPath(); s.moveTo(pz, py);
      for (let j = 0; j < 4; j++) {
        a += (rnd() - 0.5) * 0.9;
        pz += Math.cos(a) * (8 + rnd() * 14); py -= Math.sin(a) * (8 + rnd() * 14);
        s.lineTo(pz, py);
      }
      s.stroke();
    }
    s.globalCompositeOperation = "destination-out";
    s.beginPath();
    ragged.forEach(([hz, hy], k) => (k ? s.lineTo(sx(hz), sy(hy)) : s.moveTo(sx(hz), sy(hy))));
    s.closePath(); s.fill();
  }
  const scTex = new THREE.CanvasTexture(sc);
  scTex.colorSpace = THREE.SRGBColorSpace;
  const soot = (fx, ry, flip) => {
    const t = scTex.clone();   // each face its own (the shared one drew blank inside)
    if (flip) { t.repeat.x = -1; t.offset.x = 1; }
    t.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(SC.z1 - SC.z0, SC.y1 - SC.y0),
      new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    m.position.set(fx, (SC.y0 + SC.y1) / 2, (SC.z0 + SC.z1) / 2);
    m.rotation.y = ry;
    m.renderOrder = 2;
    blown.add(m);
  };
  soot(outerX + 0.004, Math.PI / 2, true);       // outside: its +x faces the desert, the canvas mirrored to match
  // (inside, the soot is painted on the chalk's own canvas: sootInside)
  blown.visible = false;
  root.add(blown);

  // the blast's bricks: thrown out mostly onto the sand, some back into the
  // cell; where they come to rest is the rubble (a late joiner sees it there)
  const bricks = [];
  for (let k = 0; k < 24; k++) {
    const outside = k < 17, w = 0.1 + rnd() * 0.16;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07 + rnd() * 0.05, w * (0.5 + rnd() * 0.5)), k % 3 ? brick : lining);
    m.castShadow = true;
    const rest = new THREE.Vector3(outside ? outerX + 0.2 + rnd() * 2.4 : x - 0.15 - rnd() * 0.8, (outside ? 0 : floorY) + 0.04, HOLE.c + (rnd() - 0.5) * (outside ? 2.8 : 1.0));
    const restRot = new THREE.Euler((rnd() - 0.5) * 0.6, rnd() * 3, (rnd() - 0.5) * 0.6);
    bricks.push({ m, outside, rest, restRot, v: new THREE.Vector3(), spin: new THREE.Vector3(), flying: false });
  }
  const debris = new THREE.Group();
  for (const b of bricks) debris.add(b.m);
  debris.visible = false;
  root.add(debris);
  // and its dust, rolling out of the hole
  let dust = null, dustT = 0;
  const DUST_SECS = 2.8;
  function makeDust() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const d = c.getContext("2d"), gr = d.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, "rgba(200, 182, 156, 1)"); gr.addColorStop(1, "rgba(200, 182, 156, 0)");
    d.fillStyle = gr; d.fillRect(0, 0, 64, 64);
    const tx = new THREE.CanvasTexture(c);
    dust = [];
    for (let k = 0; k < 9; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false, opacity: 0 }));
      s.visible = false;
      root.add(s);
      dust.push({ s, v: new THREE.Vector3(), out: k < 7 });
    }
  }
  function blast() {
    debris.visible = true;
    for (const b of bricks) {
      b.flying = true;
      b.m.position.set(x + (outerX - x) * rnd(), floorY + 0.2 + rnd() * 1.8, HOLE.c + (rnd() - 0.5) * 0.9);
      const dir = b.outside ? 1 : -1;
      b.v.set(dir * (b.outside ? 2.5 + rnd() * 4.5 : 1 + rnd() * 1.8), 1 + rnd() * 3, (rnd() - 0.5) * 3);
      b.spin.set((rnd() - 0.5) * 14, (rnd() - 0.5) * 14, (rnd() - 0.5) * 14);
    }
    if (!dust) makeDust();
    dustT = DUST_SECS;
    for (const p of dust) {
      p.s.visible = true;
      p.s.position.set(x + (p.out ? 0.5 : -0.3), HOLE.cy + (rnd() - 0.5) * 1.2, HOLE.c + (rnd() - 0.5) * 0.8);
      p.v.set((p.out ? 1 : -0.5) * (0.6 + rnd() * 1.4), 0.2 + rnd() * 0.5, (rnd() - 0.5) * 0.8);
    }
  }
  function settle() {
    for (const b of bricks) { b.flying = false; b.m.position.copy(b.rest); b.m.rotation.copy(b.restRot); }
  }

  const col = api.ghostBox((x + outerX) / 2, breachC, outerX - x + 0.02, BREACH.w, BREACH.h, { y: breach.y0, pen: 8 });
  const solid = { min: col.min.clone(), max: col.max.clone() };
  // blown, the ring still stops you: either side of the hole, over it, and
  // the step up into the cell under it (a 0.84 m way through)
  const clear = { z0: HOLE.c - 0.42, z1: HOLE.c + 0.42, top: HOLE.cy + 0.8 };   // inside the deepest bite at the sides and over the top
  const TH = outerX - x + 0.02, xm = (x + outerX) / 2;
  const ring = [
    api.ghostBox(xm, (breach.z0 + clear.z0) / 2, TH, clear.z0 - breach.z0, BREACH.h, { y: breach.y0, pen: 8 }),
    api.ghostBox(xm, (clear.z1 + breach.z1) / 2, TH, breach.z1 - clear.z1, BREACH.h, { y: breach.y0, pen: 8 }),
    api.ghostBox(xm, HOLE.c, TH, clear.z1 - clear.z0, breach.y1 - clear.top, { y: clear.top, pen: 8 }),
    api.ghostBox(xm, HOLE.c, TH, clear.z1 - clear.z0, floorY - breach.y0, { y: breach.y0, pen: 8 }),
  ].map((c) => ({ c, min: c.min.clone(), max: c.max.clone() }));
  const park = (c) => { c.min.y = -60; c.max.y = -59; };
  for (const r of ring) park(r.c);

  return {
    spots, rect: { x, z0: zL, z1: zL + FACE.w, y0: yT - FACE.h, y1: yT }, breach, hole: ragged,
    get state() { return state; },
    /* Where a round from `from` along `dir` meets the wall, or null. */
    hitPoint(from, dir) {
      if (dir.x <= 1e-4) return null;
      const t = (x - from.x) / dir.x;
      if (t <= 0) return null;
      return { z: from.z + dir.z * t, y: from.y + dir.y * t, dist: t };
    },
    /* The spot (index) a hit at (z, y) lands on, or -1. */
    spotIndex(z, yy) {
      let best = -1, bd = SPOT_R;
      spots.forEach((s, i) => { const d = Math.hypot(z - s.z, yy - s.y); if (d < bd) { bd = d; best = i; } });
      return best;
    },
    /* A round lands on the wall at (z, y): a hole, and the spot it took. */
    mark(z, yy, spot = -1) {
      if (state === "broken") return;
      holes.push({ z, y: yy });
      if (spot >= 0) spots[spot].hit = true;
      redraw();
    },
    lose() { state = "lost"; redraw(); },
    /* `blast`: it goes now, bricks and dust flying (else it's simply open, as
       for someone who joined after). */
    setBroken(on, { blast: boom = false } = {}) {
      state = on ? "broken" : "whole";
      plug.visible = !on;
      blown.visible = on;
      col.min.copy(solid.min); col.max.copy(solid.max);
      if (on) park(col);
      for (const r of ring) { r.c.min.copy(r.min); r.c.max.copy(r.max); if (!on) park(r.c); }
      if (on && boom) blast();
      else if (on) { debris.visible = true; settle(); }
      else { debris.visible = false; dustT = 0; if (dust) for (const p of dust) p.s.visible = false; }
      redraw();
    },
    /* Each frame: the flying bricks and the dust. */
    tick(dt) {
      for (const b of bricks) {
        if (!b.flying) continue;
        b.v.y -= 9.8 * dt;
        b.m.position.addScaledVector(b.v, dt);
        b.m.rotation.x += b.spin.x * dt; b.m.rotation.y += b.spin.y * dt; b.m.rotation.z += b.spin.z * dt;
        const ground = (b.m.position.x > outerX ? 0 : floorY) + 0.04;
        if (b.m.position.y < ground) {
          b.m.position.y = ground;
          if (Math.abs(b.v.y) < 1.2) { b.flying = false; b.rest.copy(b.m.position); b.restRot.copy(b.m.rotation); continue; }
          b.v.y *= -0.3; b.v.x *= 0.5; b.v.z *= 0.5; b.spin.multiplyScalar(0.5);
        }
      }
      if (dustT > 0 && dust) {
        dustT = Math.max(0, dustT - dt);
        const k = 1 - dustT / DUST_SECS;
        for (const p of dust) {
          p.s.position.addScaledVector(p.v, dt);
          p.s.scale.setScalar(0.8 + k * 3.2);
          p.s.material.opacity = 0.75 * (1 - k) * Math.min(1, k * 8);
          if (dustT <= 0) p.s.visible = false;
        }
      }
    },
    /* Fresh for the next prisoner: the chalk back, the holes filled. */
    reset() {
      holes.length = 0;
      for (const s of spots) s.hit = false;
      this.setBroken(false);
    },
  };
}
