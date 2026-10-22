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
export const BREACH = { w: 1.0, h: 2.3 };      // from the ground outside (the cell floor is 0.3 up)

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
   `outerX` the wall's outside face; `brick`/`lining` its two materials. */
export function buildJailWall(api, root, { x, outerX, zc, top = 2.55, win, breachC, y = 0, brick, lining, faceC = zc - 0.15 }) {
  const zL = faceC - FACE.w / 2, yT = top;
  const cw = Math.round(FACE.w * PX), ch = Math.round(FACE.h * PX);
  const canvas = document.createElement("canvas");
  canvas.width = cw; canvas.height = ch;
  const g = canvas.getContext("2d");
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.95,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const mural = new THREE.Mesh(new THREE.PlaneGeometry(FACE.w, FACE.h), mat);
  mural.position.set(x - 0.012, yT - FACE.h / 2, faceC);
  mural.rotation.y = -Math.PI / 2;               // facing into the cell; the art's right is +z
  mural.renderOrder = 2;
  root.add(mural);

  // wall point (z, y) <-> canvas pixel
  const toPx = (z, yy) => [(z - zL) * PX, (yT - yy) * PX];
  const spotAt = (s) => ({ z: zL + s.u * FACE.w, y: yT - s.v * FACE.h });
  const spots = SPOTS.map((s) => ({ ...s, ...spotAt(s), hit: false }));
  const breach = { z0: breachC - BREACH.w / 2, z1: breachC + BREACH.w / 2, y0: y, y1: y + BREACH.h };
  const holes = [];
  let state = "whole";                           // "whole" | "lost" (missed) | "broken"

  function cut(g2) {
    // the window shows through, and the breach once it's open
    const [wx, wy] = toPx(win.z - win.w / 2, win.y1);
    g2.clearRect(wx, wy, win.w * PX, (win.y1 - win.y0) * PX);
    if (state === "broken") {
      const [bx, by] = toPx(breach.z0, breach.y1);
      g2.clearRect(bx, by, BREACH.w * PX, BREACH.h * PX);
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
  function redraw() {
    g.clearRect(0, 0, cw, ch);
    if (faceImg) {
      // the line art as chalk: its dark strokes only, a little uneven
      const t = document.createElement("canvas");
      t.width = cw; t.height = ch;
      const tg = t.getContext("2d");
      tg.drawImage(faceImg, 0, 0, cw, ch);
      const d = tg.getImageData(0, 0, cw, ch), p = d.data;
      let seed = 7;
      for (let i = 0; i < p.length; i += 4) {
        const line = p[i + 3] > 128 && p[i] + p[i + 1] + p[i + 2] < 240;
        seed = (seed * 16807) % 2147483647;
        const a = line ? (0.62 + 0.3 * (seed / 2147483647)) * (state === "lost" ? 0.45 : 1) : 0;
        p[i] = 240; p[i + 1] = 234; p[i + 2] = 218; p[i + 3] = a * 255;
      }
      tg.putImageData(d, 0, 0);
      g.drawImage(t, 0, 0);
    }
    for (const s of spots) chalkSpot(s);
    for (const h of holes) hole(h);
    cut(g);
    tex.needsUpdate = true;
  }
  faceReady.then(redraw);
  redraw();

  // The weak patch: a brick plug in the hole wall() left for it, both faces
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
  const col = api.ghostBox((x + outerX) / 2, breachC, outerX - x + 0.02, BREACH.w, BREACH.h, { y: breach.y0, pen: 8 });
  const solid = { min: col.min.clone(), max: col.max.clone() };

  return {
    spots, rect: { x, z0: zL, z1: zL + FACE.w, y0: yT - FACE.h, y1: yT }, breach,
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
    setBroken(on) {
      state = on ? "broken" : "whole";
      plug.visible = !on;
      col.min.copy(solid.min); col.max.copy(solid.max);
      if (on) { col.min.y = -60; col.max.y = -59; }
      redraw();
    },
    /* Fresh for the next prisoner: the chalk back, the holes filled. */
    reset() {
      holes.length = 0;
      for (const s of spots) s.hit = false;
      this.setBroken(false);
    },
  };
}
