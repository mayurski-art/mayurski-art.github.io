// Troll Forces — Undergrin's signs in real German (doc "Troll Forces:
// Undergrin in Blender", decision 8: Ausgang, Zu den Zügen, Gleis 1 und 2,
// Fahrkarten, Notruf ...; the troll names stay proper nouns). The Blender
// build draws each sign's backing and writes where its words go
// (undergrin-sign-data.js: the text plane's centre, right and up, the box
// the lines fit in, the ink); here they are lettered on one canvas atlas in
// a DIN stack, so there are real umlauts and lower case and nothing to
// download. Two draws in all: the lit words (brighter than white, for the
// bloom, as the EXIT tubes) and the printed ones. The board's LED rows keep
// the build's 5 x 7 pixel lettering, where it is right.

import * as THREE from "three";
import { UG_SIGNS } from "./undergrin-sign-data.js?v=ugs1-ug1-ug2-ug3-ugm1";

// Bahnschrift is Windows' DIN; Apple's DIN Alternate; then condensed sans
const DIN = "Bahnschrift, 'DIN Alternate', 'DIN Condensed', 'D-DIN', 'Roboto Condensed', 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif";
const PPM = 220;      // atlas px a metre of sign
const MAX_W = 1400;   // a long sign lettered at fewer px a metre
const PAD = 3;        // px round each cell (no bleed between cells)
const W = 2048;

const hex = (c) => `#${c.toString(16).padStart(6, "0")}`;

export function buildUndergrinSigns(signs = UG_SIGNS) {
  const cells = signs.map((s) => {
    const ppm = Math.min(PPM, MAX_W / s.w);
    return { s, ppm, w: Math.ceil(s.w * ppm) + 2 * PAD, h: Math.ceil(s.h * ppm) + 2 * PAD };
  });
  // shelf-pack, tallest first
  const order = [...cells].sort((a, b) => b.h - a.h);
  let x = 0, y = 0, shelf = 0;
  for (const c of order) {
    if (x + c.w > W) { x = 0; y += shelf; shelf = 0; }
    c.x = x; c.y = y;
    x += c.w; shelf = Math.max(shelf, c.h);
  }
  const H = Math.max(4, Math.ceil((y + shelf) / 4) * 4);
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  g.textBaseline = "middle";
  for (const c of cells) {
    const { s } = c;
    const iw = c.w - 2 * PAD, ih = c.h - 2 * PAD, n = s.lines.length;
    const lh = ih / n;
    let px = lh * 0.86;
    g.font = `${s.weight} ${px}px ${DIN}`;
    // the widest line fits the box: squeezed to 72% at most, then smaller
    const widest = Math.max(1, ...s.lines.map((l) => g.measureText(l).width));
    let sx = Math.min(1, iw / widest);
    if (sx < 0.72) { px *= sx / 0.72; sx = 0.72; g.font = `${s.weight} ${px}px ${DIN}`; }
    g.fillStyle = hex(s.fg);
    s.lines.forEach((line, k) => {
      const wl = g.measureText(line).width * sx;
      const left = s.align === "l" ? 0 : s.align === "r" ? iw - wl : (iw - wl) / 2;
      g.save();
      g.translate(c.x + PAD + left, c.y + PAD + (k + 0.5) * lh + px * 0.04);
      g.scale(sx, 1);
      g.fillText(line, 0, 0);
      g.restore();
    });
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  // a quad per sign on its text plane, the cell's pad included
  const geo = { lit: [], ink: [] };
  for (const c of cells) {
    const { s } = c;
    const hw = (c.w / c.ppm) / 2, hh = (c.h / c.ppm) / 2;
    const u0 = c.x / W, u1 = (c.x + c.w) / W, v1 = 1 - c.y / H, v0 = 1 - (c.y + c.h) / H;
    const at = (a, b) => [0, 1, 2].map((i) => s.c[i] + s.u[i] * a * hw + s.v[i] * b * hh);
    const q = [[-1, -1, u0, v0], [1, -1, u1, v0], [1, 1, u1, v1], [-1, 1, u0, v1]];
    const out = s.lit ? geo.lit : geo.ink;
    for (const t of [0, 1, 2, 0, 2, 3]) out.push([...at(q[t][0], q[t][1]), q[t][2], q[t][3]]);
  }
  const group = new THREE.Group();
  group.name = "ug-signs";
  const mats = {
    lit: new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.8, 1.8, 1.8), alphaTest: 0.4 }),
    ink: new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.4 }),
  };
  for (const [name, verts] of Object.entries(geo)) {
    if (!verts.length) continue;
    const b = new THREE.BufferGeometry();
    b.setAttribute("position", new THREE.Float32BufferAttribute(verts.flatMap((v) => v.slice(0, 3)), 3));
    b.setAttribute("uv", new THREE.Float32BufferAttribute(verts.flatMap((v) => v.slice(3)), 2));
    b.computeBoundingSphere();
    const m = new THREE.Mesh(b, mats[name]);
    m.name = `ug-signs-${name}`;
    m.renderOrder = 2;
    m.castShadow = false;
    group.add(m);
  }
  return group;
}
