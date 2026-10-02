// Troll Forces — Hollowgrin: St. Grinsworth's chapel, rebuilt whole.
//
// Was a ruin (a breach in the south wall, half a roof); now it's the
// Gothic-revival chapel of the two reference photos: warm brick, a dark
// hammer-beam roof over red-and-gold painted panels, stained-glass lancets,
// pews either side of a red-carpet aisle, a raised altar on red steps under
// a gold trollface sunburst, and behind it a half-domed apse in blue-green
// and gold mosaic with a text band and a hanging star lantern. The breach
// is a side door now; the rose window moved to the east gable.
//
// Same 10 x 10 m footprint; the apse pokes 2.7 m out of the west wall, up
// against the map's edge (its tiered stone benches cover the line where the
// edge's ghost wall starts, x = -51). One real light, the chapel's old one.
//
// hollowgrin.js hands its helpers in (H) rather than this file importing
// them back: the import tags (?v=) would make a second copy of that module.

import * as THREE from "three";

export const CHAPEL = { x0: -49.5, x1: -39, z0: -3, z1: 7, h: 6.4 };
const T = 0.6;                                      // wall thickness
const CZ = (CHAPEL.z0 + CHAPEL.z1) / 2;             // 2: down the aisle
const IN = { x0: CHAPEL.x0 + T, x1: CHAPEL.x1 - T, z0: CHAPEL.z0 + T, z1: CHAPEL.z1 - T };
const APSE = { x: -49.2, r: 2.5, R: 3.0, spring: 3.4 };
const CHANCEL = { x: -47.9, step: -47.5, y: 0.3 };  // platform west of x, a 0.15 step to `step`
const RAIL_X = -47.35;
const ROOF_RISE = 3.5, ROOF_HALF = (CHAPEL.z1 - CHAPEL.z0) / 2 + 0.4;
const TRUSSES = [-48.2, -45.6, -42.8, -40.1];
// Pew rows (centres). The south side breaks for the cross aisle to the side
// door. Each run of pews is ONE collider, 1.2 m tall (over the 1.1 m jump):
// the 0.5 m gaps between rows were somewhere zombies (who need 1.7 m) could
// never reach you. The front row stands 1.7 m off the rail for the same reason,
// and the apse behind the altar is shut off (see buildChapel).
const PEW_ROWS = { north: [-45.3, -44.25, -43.2, -42.15, -41.1, -40.05], south: [-45.3, -44.25, -41.1, -40.05] };
const PEW = { north: [IN.z0 + 0.1, CZ - 0.9], south: [CZ + 0.9, IN.z1 - 0.1] };
const LANCETS_N = [-47, -44.2, -41.4], LANCETS_S = [-47.2, -40.9];
const LANCET = { w: 1.1, lo: 1.8, hi: 4.6 };
export const CHAPEL_SIDE_DOOR = { c: -42.6, w: 1.8, h: 3.1 };
const EAST_DOOR = { w: 2.2, h: 3.75 };

/* ================================================================ textures */

const TEX = {};
const tex = (name, make) => (TEX[name] ??= make());

function canvasTex(w, h, draw, { repeat = false } = {}) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.userData.g = g;
  return t;
}

/* The trollface artwork, recoloured: its white face and its black ink each
   to a colour (or dropped), alpha kept. Drawn in once the image loads. */
const TROLL_URL = new URL("../../images/wallpaper/trollface%20transparent.png", import.meta.url).href;
let trollImg = null;
function withTroll(t, draw) {
  trollImg ??= new Promise((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = TROLL_URL;
  });
  trollImg.then((img) => {
    if (!img) return;
    draw(t.userData.g, img);
    t.needsUpdate = true;
  });
}
function inkTroll(img, size, face, ink) {
  const k = document.createElement("canvas");
  k.width = k.height = size;
  const g = k.getContext("2d");
  const s = Math.min(size / img.width, size / img.height);
  g.drawImage(img, (size - img.width * s) / 2, (size - img.height * s) / 2, img.width * s, img.height * s);
  const d = g.getImageData(0, 0, size, size), px = d.data;
  const rgb = (c) => { const v = new THREE.Color(c); return [v.r * 255, v.g * 255, v.b * 255].map(Math.round); };
  const F = face && rgb(face), I = ink && rgb(ink);
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 100) { px[i + 3] = 0; continue; }
    const lum = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
    const c = lum < 110 ? I : F;
    if (!c) { px[i + 3] = 0; continue; }
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  return k;
}

function noise(g, W, H, n, alpha, R) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(${R() < 0.5 ? "0,0,0" : "255,240,220"},${alpha * R()})`;
    g.fillRect(R() * W, R() * H, 1 + R() * 3, 1 + R() * 3);
  }
}

/* Encaustic floor tiles: cream and terracotta on the diagonal, black dots
   where the corners meet. One repeat = 1.6 m. */
function floorTexture() {
  return tex("floor", () => canvasTex(512, 512, (g, W) => {
    const R = mulberry(41);
    const n = 4, s = W / n;
    g.fillStyle = "#2a1c16";
    g.fillRect(0, 0, W, W);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const x = i * s, y = j * s;
        g.fillStyle = (i + j) % 2 ? "#a8946e" : "#6e3424";
        g.fillRect(x + 2, y + 2, s - 4, s - 4);
        // a diamond inset in the other colour
        g.fillStyle = (i + j) % 2 ? "#8a4a32" : "#9a8460";
        g.beginPath();
        g.moveTo(x + s / 2, y + s * 0.22); g.lineTo(x + s * 0.78, y + s / 2); g.lineTo(x + s / 2, y + s * 0.78); g.lineTo(x + s * 0.22, y + s / 2);
        g.closePath(); g.fill();
        g.fillStyle = "#1c1410";
        g.beginPath(); g.arc(x + s / 2, y + s / 2, s * 0.06, 0, Math.PI * 2); g.fill();
      }
    }
    noise(g, W, W, 2600, 0.12, R);
  }, { repeat: true }));
}

/* The aisle runner: red pile, a gold border down both edges. u runs along
   the aisle (repeating), v across it. */
function runnerTexture() {
  return tex("runner", () => canvasTex(256, 256, (g, W, H) => {
    const R = mulberry(7);
    g.fillStyle = "#7c1218";
    g.fillRect(0, 0, W, H);
    noise(g, W, H, 3000, 0.1, R);
    for (const y of [10, H - 22]) {
      g.fillStyle = "#c89a3a"; g.fillRect(0, y, W, 12);
      g.fillStyle = "#4a0a0e"; g.fillRect(0, y + 4, W, 4);
    }
    g.fillStyle = "rgba(200,150,60,.55)";
    for (let x = 32; x < W; x += 64) {
      g.beginPath(); g.moveTo(x, H / 2 - 22); g.lineTo(x + 14, H / 2); g.lineTo(x, H / 2 + 22); g.lineTo(x - 14, H / 2); g.closePath(); g.fill();
    }
  }, { repeat: true }));
}

/* One bay of the painted ceiling, eave (bottom) to ridge (top): a red band,
   red ground with a gold diaper, a blue roundel with a gold trollface, then
   blue with gold stars to the ridge. The principal rafters hide the seams. */
function ceilingTexture() {
  return tex("ceiling", () => {
    const W = 512, H = 1024;
    const t = canvasTex(W, H, (g) => {
      const R = mulberry(19);
      // stars to the ridge
      g.fillStyle = "#1a2c5a";
      g.fillRect(0, 0, W, H * 0.3);
      g.fillStyle = "#d8b050";
      for (let i = 0; i < 44; i++) star(g, R() * W, R() * H * 0.28, 5 + R() * 5);
      // red with the gold diaper
      g.fillStyle = "#7a1c1c";
      g.fillRect(0, H * 0.3, W, H * 0.7);
      g.strokeStyle = "rgba(216,176,80,.55)";
      g.lineWidth = 3;
      for (let k = -W; k < W * 2; k += 64) {
        g.beginPath(); g.moveTo(k, H * 0.3); g.lineTo(k + H * 0.7, H); g.stroke();
        g.beginPath(); g.moveTo(k, H); g.lineTo(k + H * 0.7, H * 0.3); g.stroke();
      }
      g.fillStyle = "rgba(216,176,80,.8)";
      for (let y = H * 0.3 + 32; y < H; y += 64) {
        for (let x = (Math.round((y - H * 0.3) / 64) % 2) * 32; x < W; x += 64) quatrefoil(g, x, y, 7);
      }
      // the eave band
      g.fillStyle = "#3a0c0c";
      g.fillRect(0, H * 0.9, W, H * 0.1);
      g.fillStyle = "#c89a3a";
      g.fillRect(0, H * 0.9, W, 8);
      for (let x = 24; x < W; x += 48) quatrefoil(g, x, H * 0.95, 12);
      // gold rules between the zones
      g.fillStyle = "#c89a3a";
      g.fillRect(0, H * 0.3 - 6, W, 12);
      // the roundel
      const cx = W / 2, cy = H * 0.52, r = 150;
      g.fillStyle = "#c89a3a";
      g.beginPath(); g.arc(cx, cy, r + 16, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#14244a";
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#7a1c1c"; g.lineWidth = 5;
      g.beginPath(); g.arc(cx, cy, r + 8, 0, Math.PI * 2); g.stroke();
      // the rafters' painted edges either side
      for (const x of [0, W]) {
        g.fillStyle = "#2a1810"; g.fillRect(x - 10, 0, 20, H);
        g.fillStyle = "#c89a3a"; g.fillRect(x - 14, 0, 4, H); g.fillRect(x + 10, 0, 4, H);
      }
      noise(g, W, H, 6000, 0.08, R);
    }, { repeat: true });
    withTroll(t, (g, img) => {
      const k = inkTroll(img, 240, "#e8c868", "#14244a");
      g.drawImage(k, W / 2 - 120, H * 0.52 - 120);
    });
    return t;
  });
}

/* The stencilled band along the top of the walls. */
function friezeTexture() {
  return tex("frieze", () => canvasTex(512, 128, (g, W, H) => {
    g.fillStyle = "#6a1414"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#1a0c0a"; g.fillRect(0, 0, W, 14); g.fillRect(0, H - 14, W, 14);
    g.fillStyle = "#c89a3a"; g.fillRect(0, 14, W, 5); g.fillRect(0, H - 19, W, 5);
    for (let x = 32; x < W; x += 64) {
      g.fillStyle = "#c89a3a"; quatrefoil(g, x, H / 2, 20);
      g.fillStyle = "#6a1414"; quatrefoil(g, x, H / 2, 9);
      g.fillStyle = "#1f3a6a";
      g.beginPath(); g.arc(x + 32, H / 2, 6, 0, Math.PI * 2); g.fill();
    }
  }, { repeat: true }));
}

/* A lancet: a pointed arch of coloured quarries round a standing saint
   with a gold halo and a trollface; transparent outside the arch. */
function lancetTexture() {
  return tex("lancet", () => {
    const W = 256, H = 650, rise = 220;                // the arch: rise/H = 0.95 / 2.8 m
    const t = canvasTex(W, H, (g) => {
      const R = mulberry(77);
      const arch = () => {
        g.beginPath();
        g.moveTo(0, H); g.lineTo(0, rise);
        g.arc(W, rise, W, Math.PI, Math.PI + Math.PI / 3);
        g.arc(0, rise, W, -Math.PI / 3, 0);
        g.lineTo(W, H); g.closePath();
      };
      g.save(); arch(); g.clip();
      const glass = ["#1d3f8a", "#24489a", "#8a1a24", "#1d3f8a", "#a8262e", "#163070", "#2a5aa8"];
      const s = 32;
      for (let y = 0; y < H; y += s) {
        for (let x = 0; x < W; x += s) {
          g.fillStyle = glass[Math.floor(R() * glass.length)];
          g.fillRect(x, y, s, s);
        }
      }
      // the saint: a robe, a mantle, the halo
      g.fillStyle = "#3a1a6a";
      g.beginPath(); g.moveTo(W * 0.5, 250); g.lineTo(W * 0.82, 560); g.lineTo(W * 0.18, 560); g.closePath(); g.fill();
      g.fillStyle = "#1f7a4a";
      g.beginPath(); g.moveTo(W * 0.5, 270); g.quadraticCurveTo(W * 0.85, 330, W * 0.72, 520); g.lineTo(W * 0.5, 470); g.closePath(); g.fill();
      g.fillStyle = "#e0a838";
      g.beginPath(); g.arc(W / 2, 205, 62, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#f0dcb0";
      g.beginPath(); g.arc(W / 2, 210, 44, 0, Math.PI * 2); g.fill();
      // a canopy over the head and a plinth under the feet
      g.fillStyle = "#d8b050";
      g.fillRect(W * 0.2, 120, W * 0.6, 12);
      g.beginPath(); g.moveTo(W * 0.2, 120); g.lineTo(W / 2, 60); g.lineTo(W * 0.8, 120); g.closePath(); g.fill();
      g.fillRect(W * 0.12, 560, W * 0.76, 34);
      g.fillStyle = "#6a1414"; g.fillRect(W * 0.16, 568, W * 0.68, 18);
      // the lead
      g.strokeStyle = "#0b0a0c"; g.lineWidth = 4;
      for (let y = 0; y < H; y += s) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      for (let x = 0; x < W; x += s) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
      g.restore();
      g.lineWidth = 10; g.strokeStyle = "#0b0a0c"; arch(); g.stroke();
      g.lineWidth = 5; g.beginPath(); g.arc(W / 2, 210, 44, 0, Math.PI * 2); g.stroke();
    });
    withTroll(t, (g, img) => {
      const k = inkTroll(img, 84, "#f4e6c8", "#1a1210");
      g.drawImage(k, W / 2 - 42, 210 - 42);
    });
    return t;
  });
}

/* The half dome's mosaic, as the sphere's UVs see it (u round from north to
   south, v from the springing up to the crown): blue-green tesserae, gold
   ribs and stars, a ring of little arched windows, a gold medallion with
   the trollface, and the text band round the bottom. Drawn mirrored: it's
   seen from inside. */
function domeTexture() {
  return tex("dome", () => {
    const W = 2048, H = 768, band = 96;
    const medal = { x: W / 2, y: H * 0.46, rx: 300, ry: 118 };
    const t = canvasTex(W, H, (g) => {
      const R = mulberry(5);
      g.setTransform(-1, 0, 0, 1, W, 0);
      const grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, "#2a6a8a");
      grd.addColorStop(0.6, "#1a5a5a");
      grd.addColorStop(1, "#124a42");
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
      // tesserae
      for (let y = 0; y < H - band; y += 6) {
        for (let x = 0; x < W; x += 6) {
          if (R() < 0.55) continue;
          const v = R();
          g.fillStyle = v < 0.08 ? "rgba(230,190,90,.7)" : v < 0.5 ? "rgba(255,255,255,.07)" : "rgba(0,20,30,.12)";
          g.fillRect(x, y, 5, 5);
        }
      }
      // gold ribs from the windows to the crown
      g.strokeStyle = "#d8b050"; g.lineWidth = 10;
      for (let i = 0; i <= 8; i++) {
        const x = (i / 8) * W;
        g.beginPath(); g.moveTo(x, H - band - 120); g.lineTo(x, 0); g.stroke();
      }
      // vine scrolls between them, gold on green
      g.strokeStyle = "rgba(216,176,80,.6)"; g.lineWidth = 4;
      for (let i = 0; i < 8; i++) {
        const x0 = (i / 8) * W, w = W / 8;
        for (let k = 0; k < 4; k++) {
          const y = 60 + k * 120;
          g.beginPath(); g.arc(x0 + w / 2, y, 34, 0, Math.PI * 1.6); g.stroke();
        }
      }
      // gold stars
      g.fillStyle = "#f0c860";
      for (let i = 0; i < 160; i++) star(g, R() * W, R() * (H - band - 140), 4 + R() * 7);
      // the ring of little arched windows over the band
      const wy = H - band - 112;
      for (let i = 0; i < 16; i++) {
        const x = ((i + 0.5) / 16) * W, w = 56, h = 96;
        g.fillStyle = "#c89a3a";
        archPath(g, x, wy, w + 16, h + 12); g.fill();
        const gl = g.createLinearGradient(0, wy, 0, wy + h);
        gl.addColorStop(0, "#fff2c8"); gl.addColorStop(1, "#e8b860");
        g.fillStyle = gl;
        archPath(g, x, wy + 8, w, h); g.fill();
        g.strokeStyle = "#5a3a10"; g.lineWidth = 3;
        g.beginPath(); g.moveTo(x, wy + 8); g.lineTo(x, wy + h + 8); g.stroke();
      }
      // the band and its text
      g.fillStyle = "#c89a3a"; g.fillRect(0, H - band - 10, W, 10);
      g.fillStyle = "#0e3a2e"; g.fillRect(0, H - band, W, band);
      g.fillStyle = "#c89a3a"; g.fillRect(0, H - 10, W, 10);
      g.fillStyle = "#f0cc6a";
      g.font = "bold 52px Georgia, serif";
      g.textAlign = "center"; g.textBaseline = "middle";
      const words = "UNTIL · THE · DAY · BREAK · AND · THE · SHADOWS · FLEE · AWAY · PROBLEM?";
      g.fillText(words, W / 2, H - band / 2 + 2, W * 0.92);
      // the medallion
      g.fillStyle = "#c89a3a";
      g.beginPath(); g.ellipse(medal.x, medal.y, medal.rx + 22, medal.ry + 14, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#f4e2a0";
      g.beginPath(); g.ellipse(medal.x, medal.y, medal.rx, medal.ry, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#8a1a24"; g.lineWidth = 6;
      g.beginPath(); g.ellipse(medal.x, medal.y, medal.rx + 10, medal.ry + 7, 0, 0, Math.PI * 2); g.stroke();
      // rays out of it
      g.strokeStyle = "rgba(240,200,96,.8)"; g.lineWidth = 6;
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        g.beginPath();
        g.moveTo(medal.x + c * (medal.rx + 28), medal.y + s * (medal.ry + 20));
        g.lineTo(medal.x + c * (medal.rx + 90), medal.y + s * (medal.ry + 58));
        g.stroke();
      }
    });
    withTroll(t, (g, img) => {
      const k = inkTroll(img, 256, "#ffffff", "#1a1410");
      g.setTransform(-1, 0, 0, 1, W, 0);
      g.drawImage(k, medal.x - medal.rx * 0.92, medal.y - medal.ry * 0.92, medal.rx * 1.84, medal.ry * 1.84);
    });
    return t;
  });
}

/* The apse wall under the dome: green marble panels low down, gold mosaic
   above with blind arches in deep blue. */
function apseWallTexture() {
  return tex("apseWall", () => canvasTex(1024, 384, (g, W, H) => {
    const R = mulberry(9);
    g.fillStyle = "#c89a3a"; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H * 0.72; y += 5) {
      for (let x = 0; x < W; x += 5) {
        const v = R();
        g.fillStyle = v < 0.3 ? "rgba(255,240,180,.25)" : v < 0.6 ? "rgba(120,70,10,.18)" : "rgba(0,0,0,0)";
        g.fillRect(x, y, 4, 4);
      }
    }
    for (let i = 0; i < 6; i++) {
      const x = ((i + 0.5) / 6) * W;
      g.fillStyle = "#14244a";
      archPath(g, x, 40, 104, 200); g.fill();
      g.fillStyle = "#e8c868";
      for (let k = 0; k < 6; k++) star(g, x + (R() - 0.5) * 70, 80 + R() * 150, 4 + R() * 4);
      g.strokeStyle = "#8a1a24"; g.lineWidth = 6;
      archPath(g, x, 40, 104, 200); g.stroke();
    }
    // marble dado
    g.fillStyle = "#2a5a4a"; g.fillRect(0, H * 0.72, W, H * 0.28);
    g.strokeStyle = "rgba(220,240,230,.25)"; g.lineWidth = 2;
    for (let i = 0; i < 40; i++) {
      g.beginPath();
      let x = R() * W, y = H * 0.72 + R() * H * 0.28;
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (R() - 0.3) * 40; y += (R() - 0.5) * 20; g.lineTo(x, y); }
      g.stroke();
    }
    g.fillStyle = "#c89a3a";
    g.fillRect(0, H * 0.72 - 6, W, 8);
    for (let i = 0; i <= 8; i++) g.fillRect((i / 8) * W - 3, H * 0.72, 6, H * 0.28);
  }));
}

/* The sunburst over the altar: gold rays, long and short, round a gold
   ring and the trollface on cream. */
function sunburstTexture() {
  return tex("sunburst", () => {
    const S = 512, c = S / 2;
    const t = canvasTex(S, S, (g) => {
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * Math.PI * 2, long = i % 2 === 0;
        const r1 = long ? 250 : 190, w = long ? 0.07 : 0.05;
        const grd = g.createLinearGradient(c, c, c + Math.cos(a) * r1, c + Math.sin(a) * r1);
        grd.addColorStop(0, "#fff0a8"); grd.addColorStop(1, "#b07a1c");
        g.fillStyle = grd;
        g.beginPath();
        g.moveTo(c + Math.cos(a - w) * 110, c + Math.sin(a - w) * 110);
        g.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);
        g.lineTo(c + Math.cos(a + w) * 110, c + Math.sin(a + w) * 110);
        g.closePath(); g.fill();
      }
      g.fillStyle = "#b8862a";
      g.beginPath(); g.arc(c, c, 124, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#ffe08a";
      g.beginPath(); g.arc(c, c, 116, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#fff6e0";
      g.beginPath(); g.arc(c, c, 102, 0, Math.PI * 2); g.fill();
    });
    withTroll(t, (g, img) => g.drawImage(inkTroll(img, 180, null, "#3a2408"), c - 90, c - 90));
    return t;
  });
}

/* The altar frontal: red velvet, gold orphreys, a gold trollface roundel. */
function frontalTexture() {
  return tex("frontal", () => {
    const W = 512, H = 256;
    const t = canvasTex(W, H, (g) => {
      const R = mulberry(3);
      g.fillStyle = "#6a0e14"; g.fillRect(0, 0, W, H);
      noise(g, W, H, 2000, 0.12, R);
      g.fillStyle = "#c89a3a";
      g.fillRect(0, 0, W, 26); g.fillRect(0, H - 14, W, 14);
      for (const x of [70, W - 70]) g.fillRect(x - 14, 26, 28, H - 40);
      g.fillStyle = "#6a0e14";
      for (let x = 12; x < W; x += 24) g.fillRect(x, 26, 12, 12);
      g.fillStyle = "#c89a3a";
      g.beginPath(); g.arc(W / 2, H / 2 + 8, 78, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#f4e2b0";
      g.beginPath(); g.arc(W / 2, H / 2 + 8, 68, 0, Math.PI * 2); g.fill();
    });
    withTroll(t, (g, img) => g.drawImage(inkTroll(img, 120, null, "#5a0a10"), W / 2 - 60, H / 2 + 8 - 60));
    return t;
  });
}

/* The house rules, in gold on black, either side of the apse. */
function rulesTexture(lines) {
  return canvasTex(320, 360, (g, W, H) => {
    g.fillStyle = "#14100e"; g.fillRect(0, 0, W, H);
    g.strokeStyle = "#c89a3a"; g.lineWidth = 6; g.strokeRect(12, 12, W - 24, H - 24);
    g.lineWidth = 2; g.strokeRect(22, 22, W - 44, H - 44);
    g.fillStyle = "#e8c868";
    g.textAlign = "center";
    g.font = "bold 30px Georgia, serif";
    g.fillText(lines[0], W / 2, 66);
    g.fillRect(W / 2 - 60, 80, 120, 3);
    g.font = "22px Georgia, serif";
    lines.slice(1).forEach((l, i) => g.fillText(l, W / 2, 128 + i * 52, W - 60));
  });
}

/* The star lantern's panes: red, amber, green, blue in gold lead. */
function lanternTexture() {
  return tex("lantern", () => canvasTex(128, 128, (g, W, H) => {
    const cols = ["#ff5a3a", "#ffc048", "#4ae08a", "#4a8aff"];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        g.fillStyle = cols[(i + j * 3) % 4];
        g.fillRect(i * 32, j * 32, 32, 32);
      }
    }
    g.strokeStyle = "#c89a3a"; g.lineWidth = 5;
    for (let k = 0; k <= 4; k++) {
      g.beginPath(); g.moveTo(k * 32, 0); g.lineTo(k * 32, H); g.stroke();
      g.beginPath(); g.moveTo(0, k * 32); g.lineTo(W, k * 32); g.stroke();
    }
    g.fillStyle = "#fff4c8";
    for (let i = 0; i < 4; i++) star(g, i * 32 + 16, 64, 7);
  }, { repeat: true }));
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function star(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.42 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath(); g.fill();
}

function quatrefoil(g, x, y, r) {
  g.beginPath();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.moveTo(x + dx * r * 0.5 + r * 0.5, y + dy * r * 0.5); g.arc(x + dx * r * 0.5, y + dy * r * 0.5, r * 0.5, 0, Math.PI * 2); }
  g.fill();
}

/* A round-headed arch outline: centre x, top y, width, height. */
function archPath(g, x, y, w, h) {
  g.beginPath();
  g.moveTo(x - w / 2, y + h);
  g.lineTo(x - w / 2, y + w / 2);
  g.arc(x, y + w / 2, w / 2, Math.PI, 0);
  g.lineTo(x + w / 2, y + h);
  g.closePath();
}

/* ================================================================== shapes */

/* The masonry over a pointed (or round) arch, in the top of a wall's
   rectangular opening: the rectangle from the springing up to the apex,
   minus the arch. Two-centred, radius R (R = w/2: round; R = w: equilateral). */
function archFill(K, mat, { axis, at, c, w, top, R, t, y = 0 }) {
  const half = w / 2;
  const rise = Math.sqrt(R * R - (R - half) * (R - half));
  const spring = top - rise;
  const a = Math.acos((R - half) / R);
  const s = new THREE.Shape();
  s.moveTo(-half, 0);
  s.lineTo(-half, rise);
  s.lineTo(half, rise);
  s.lineTo(half, 0);
  s.absarc(half - R, 0, R, 0, a, false);
  s.absarc(-half + R, 0, R, Math.PI - a, Math.PI, false);
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, y + spring, -t / 2);
  if (axis === "z") g.rotateY(Math.PI / 2);
  g.translate(axis === "x" ? c : at, 0, axis === "x" ? at : c);
  K.add(mat, g);
  return spring;
}

/* Turn a geometry inside out: reversed winding, normals flipped. */
function inward(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  for (const name of ["position", "normal", "uv"]) {
    const at = g.attributes[name];
    if (!at) continue;
    const n = at.itemSize, a = at.array;
    for (let i = 0; i < a.length; i += n * 3) {
      for (let k = 0; k < n; k++) { const tmp = a[i + n + k]; a[i + n + k] = a[i + 2 * n + k]; a[i + 2 * n + k] = tmp; }
    }
  }
  const nrm = g.attributes.normal.array;
  for (let i = 0; i < nrm.length; i++) nrm[i] = -nrm[i];
  return g;
}

/* A quad from four corners (a b c d round), with its own UVs. */
function quad(pts, uvs) {
  const p = [pts[0], pts[1], pts[2], pts[0], pts[2], pts[3]].flat();
  const u = [uvs[0], uvs[1], uvs[2], uvs[0], uvs[2], uvs[3]].flat();
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(u, 2));
  g.computeVertexNormals();
  return g;
}

/* A plane along a wall's inner face with its UVs repeated every `rep` m. */
function band(axis, at, a, b, y0, y1, face, rep) {
  const L = b - a;
  const g = new THREE.PlaneGeometry(L, y1 - y0);
  const uv = g.attributes.uv.array;
  for (let i = 0; i < uv.length; i += 2) uv[i] *= L / rep;
  // PlaneGeometry faces +z; turn it to face into the room
  if (axis === "x") g.rotateY(face > 0 ? 0 : Math.PI);
  else g.rotateY(face > 0 ? Math.PI / 2 : -Math.PI / 2);
  g.translate(axis === "x" ? (a + b) / 2 : at, (y0 + y1) / 2, axis === "x" ? at : (a + b) / 2);
  return g;
}

/* ================================================================== build */

export function buildChapel(api, K, M, SP, root, lights, H) {
  const { place, wall, rodGeo, prismGeo, candle, jack, headstoneGeo, signTexture, surfMat, texMat, flickerMat, rng, ZSPAWNS } = H;
  const C = CHAPEL;
  const R = rng(2027);
  const CM = {
    brick: surfMat("brick", 0xc89a5a, { mix: 0.3, tile: 1.2, bounce: 0.1 }),
    timber: surfMat("wood", 0x3a2216, { mix: 0.12, tile: 1, bounce: 0.06 }),
    oak: surfMat("wood", 0x7a4a28, { mix: 0.3, tile: 1, bounce: 0.3 }),
    marble: surfMat("marble", 0xd8cfc0, { mix: 0.4, tile: 1.2, bounce: 0.14 }),
    floor: texMat(floorTexture(), { tile: 1.6, rough: 0.55 }),
    carpet: new THREE.MeshStandardMaterial({ map: runnerTexture(), roughness: 0.95, emissive: 0x2a0606 }),
    velvet: new THREE.MeshStandardMaterial({ color: 0x7c1218, roughness: 0.95, emissive: 0x1a0404 }),
    linen: new THREE.MeshStandardMaterial({ color: 0xf0ece0, roughness: 0.9, emissive: 0x2a2824 }),
    ceiling: new THREE.MeshStandardMaterial({ map: ceilingTexture(), emissiveMap: ceilingTexture(), emissive: 0x6a5a50, roughness: 0.85, side: THREE.DoubleSide }),
    frieze: new THREE.MeshStandardMaterial({ map: friezeTexture(), emissiveMap: friezeTexture(), emissive: 0x504040, roughness: 0.8 }),
    lancet: new THREE.MeshBasicMaterial({ map: lancetTexture(), alphaTest: 0.5, side: THREE.DoubleSide, color: new THREE.Color(0xffffff).multiplyScalar(1.35) }),
    dome: new THREE.MeshStandardMaterial({ map: domeTexture(), emissiveMap: domeTexture(), emissive: 0xa8a090, roughness: 0.45, metalness: 0.15 }),
    apseWall: new THREE.MeshStandardMaterial({ map: apseWallTexture(), emissiveMap: apseWallTexture(), emissive: 0x8a8070, roughness: 0.5, metalness: 0.15 }),
    domeOut: new THREE.MeshStandardMaterial({ color: 0x4a6a62, roughness: 0.55, metalness: 0.3 }),
    sunburst: new THREE.MeshBasicMaterial({ map: sunburstTexture(), alphaTest: 0.35, color: new THREE.Color(0xffffff).multiplyScalar(0.72) }),
    frontal: new THREE.MeshStandardMaterial({ map: frontalTexture(), emissiveMap: frontalTexture(), emissive: 0x3a3030, roughness: 0.9 }),
    lantern: flickerMat({ map: lanternTexture(), color: new THREE.Color(0xffffff).multiplyScalar(1.5), strength: 0.35, speed: 0.3 }),
    opal: flickerMat({ color: new THREE.Color(0xfff0c8).multiplyScalar(1.3), strength: 0.25, speed: 0.4 }),
  };

  /* ---- floor: tiles, the runner, the chancel */
  K.add(CM.floor, place(new THREE.PlaneGeometry(IN.x1 - IN.x0, IN.z1 - IN.z0), { x: (IN.x0 + IN.x1) / 2, y: 0.016, z: CZ, rx: -Math.PI / 2 }), { shadow: false });
  const runner = (x0, x1, y, w) => {
    const g = new THREE.PlaneGeometry(x1 - x0, w);
    const uv = g.attributes.uv.array;
    for (let i = 0; i < uv.length; i += 2) uv[i] *= (x1 - x0) / 1.2;
    K.add(CM.carpet, place(g, { x: (x0 + x1) / 2, y, z: CZ, rx: -Math.PI / 2 }), { shadow: false });
  };
  runner(CHANCEL.step, IN.x1, 0.022, 1.2);
  // the chancel: a step, then the platform on into the apse
  K.solid((CHANCEL.x + CHANCEL.step) / 2, CZ, CHANCEL.step - CHANCEL.x, IN.z1 - IN.z0, 0.15, { mat: CM.marble, pen: 8 });
  K.solid((IN.x0 + CHANCEL.x) / 2, CZ, CHANCEL.x - IN.x0, IN.z1 - IN.z0, CHANCEL.y, { mat: CM.marble, pen: 8 });
  K.api.ghostBox(APSE.x - APSE.r / 2 + 0.15, CZ, APSE.r + 0.3, APSE.r * 2, CHANCEL.y, { pen: 8 });
  K.add(CM.marble, place(new THREE.CircleGeometry(APSE.r, 28, Math.PI / 2, Math.PI), { x: APSE.x, y: CHANCEL.y + 0.001, z: CZ, rx: -Math.PI / 2 }), { shadow: false });
  runner(CHANCEL.x, CHANCEL.step, 0.152, 1.2);
  K.box(CM.velvet, CHANCEL.step + 0.005, 0.005, CZ, 0.01, 0.14, 1.2, {}, { shadow: false });
  K.add(CM.carpet, place(new THREE.PlaneGeometry(CHANCEL.x - IN.x0 + 1.0, 3.0), { x: (IN.x0 + CHANCEL.x) / 2 - 0.5, y: CHANCEL.y + 0.004, z: CZ, rx: -Math.PI / 2 }), { shadow: false });
  K.box(CM.velvet, CHANCEL.x + 0.005, 0.15, CZ, 0.01, 0.15, 3.0, {}, { shadow: false });

  /* ---- the walls: brick, stone dressings, the lancets, two doors, the apse arch */
  const win = (c) => ({ c, w: LANCET.w, spans: [[LANCET.lo, LANCET.hi]] });
  const D = CHAPEL_SIDE_DOOR;
  wall(K, { axis: "x", at: C.z0 + T / 2, a: C.x0, b: C.x1, h: C.h, t: T, mat: CM.brick, trim: M.stoneDark, out: -1, holes: LANCETS_N.map(win) });
  wall(K, { axis: "x", at: C.z1 - T / 2, a: C.x0, b: C.x1, h: C.h, t: T, mat: CM.brick, trim: M.stoneDark, out: 1,
    holes: [...LANCETS_S.map(win), { c: D.c, w: D.w, spans: [[0, D.h]] }] });
  wall(K, { axis: "z", at: C.x0 + T / 2, a: C.z0 + T, b: C.z1 - T, h: C.h, t: T, mat: CM.brick,
    holes: [{ c: CZ, w: APSE.r * 2, spans: [[0, APSE.spring + APSE.r]] }] });
  wall(K, { axis: "z", at: C.x1 - T / 2, a: C.z0 + T, b: C.z1 - T, h: C.h, t: T, mat: CM.brick, trim: M.stoneDark, out: 1,
    holes: [{ c: CZ, w: EAST_DOOR.w, spans: [[0, EAST_DOOR.h]] }] });
  // the arches in the tops of the openings, and the glass
  for (const [at, list] of [[C.z0 + T / 2, LANCETS_N], [C.z1 - T / 2, LANCETS_S]]) {
    for (const c of list) {
      archFill(K, CM.brick, { axis: "x", at, c, w: LANCET.w, top: LANCET.hi, R: LANCET.w, t: T - 0.02 });
      K.add(CM.lancet, place(new THREE.PlaneGeometry(LANCET.w, LANCET.hi - LANCET.lo), { x: c, y: (LANCET.lo + LANCET.hi) / 2, z: at }), { shadow: false });
    }
  }
  archFill(K, CM.brick, { axis: "x", at: C.z1 - T / 2, c: D.c, w: D.w, top: D.h, R: D.w * 0.75, t: T - 0.02 });
  archFill(K, CM.brick, { axis: "z", at: C.x1 - T / 2, c: CZ, w: EAST_DOOR.w, top: EAST_DOOR.h, R: EAST_DOOR.w * 0.75, t: T - 0.02 });
  archFill(K, CM.brick, { axis: "z", at: C.x0 + T / 2, c: CZ, w: APSE.r * 2, top: APSE.spring + APSE.r, R: APSE.r, t: T - 0.02 });
  // the apse arch's gold moulding, nave side
  K.add(M.gold, place(new THREE.TorusGeometry(APSE.r + 0.05, 0.07, 6, 40, Math.PI), { x: IN.x0 + 0.02, y: APSE.spring, z: CZ, ry: Math.PI / 2 }));
  for (const s of [-1, 1]) K.box(M.gold, IN.x0 + 0.03, 0, CZ + s * (APSE.r + 0.05), 0.08, APSE.spring, 0.14);
  // the doors, swung open against the outside
  const leaf = (x, z, w, h, axis) => {
    K.box(CM.oak, x, 0, z, axis === "x" ? w : 0.07, h, axis === "x" ? 0.07 : w);
    for (const y of [0.5, h - 0.7]) K.box(M.iron, x, y, z, axis === "x" ? w * 0.9 : 0.09, 0.07, axis === "x" ? 0.09 : w * 0.9);
  };
  for (const s of [-1, 1]) {
    leaf(D.c + s * (D.w / 2 + 0.5), C.z1 + 0.06, 0.9, 2.5, "x");
    leaf(C.x1 + 0.06, CZ + s * (EAST_DOOR.w / 2 + 0.58), 1.1, 2.9, "z");
  }
  // wainscot and dado rail round the nave, the stencilled frieze up top
  {
    const runsOf = (a, b, gaps) => {
      const out = [];
      let s = a;
      for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) { if (g0 > s) out.push([s, g0]); s = Math.max(s, g1); }
      if (b > s) out.push([s, b]);
      return out;
    };
    const sides = [
      ["x", IN.z0, 1, IN.x0, IN.x1, []],
      ["x", IN.z1, -1, IN.x0, IN.x1, [[D.c - D.w / 2 - 0.1, D.c + D.w / 2 + 0.1]]],
      ["z", IN.x1, -1, IN.z0, IN.z1, [[CZ - EAST_DOOR.w / 2 - 0.1, CZ + EAST_DOOR.w / 2 + 0.1]]],
    ];
    for (const [axis, at, face, a, b, gaps] of sides) {
      for (const [s, e] of runsOf(a, b, gaps)) {
        const m = (s + e) / 2, L = e - s, off = at + face * 0.025;
        const [x, z] = axis === "x" ? [m, off] : [off, m];
        K.box(CM.oak, x, 0, z, axis === "x" ? L : 0.05, 1.05, axis === "x" ? 0.05 : L, {}, { shadow: false });
        const [rx, rz] = axis === "x" ? [m, at + face * 0.05] : [at + face * 0.05, m];
        K.box(CM.timber, rx, 1.02, rz, axis === "x" ? L : 0.1, 0.08, axis === "x" ? 0.1 : L, {}, { shadow: false });
      }
      if (axis === "x") K.add(CM.frieze, band(axis, at + face * 0.01, IN.x0, IN.x1, 5.85, 6.35, face, 0.5), { shadow: false });
    }
  }

  /* ---- the apse: half cylinder, half dome, tiered stone benches */
  {
    const { x: ax, r, R: Ro, spring } = APSE;
    for (let i = 0; i <= 12; i++) {
      const th = Math.PI / 2 + (i / 12) * Math.PI, rr = (r + Ro) / 2 + 0.05;
      K.api.ghostBox(ax + Math.cos(th) * rr, CZ + Math.sin(th) * rr, 0.62, 0.62, C.h, { pen: 10 });
    }
    // CylinderGeometry: x = r sin(theta), so the west half is theta pi..2pi
    K.add(CM.brick, place(new THREE.CylinderGeometry(Ro, Ro, spring, 28, 1, true, Math.PI, Math.PI), { x: ax, y: spring / 2, z: CZ }));
    K.add(CM.apseWall, place(inward(new THREE.CylinderGeometry(r, r, spring - CHANCEL.y, 28, 1, true, Math.PI, Math.PI)), { x: ax, y: (spring + CHANCEL.y) / 2, z: CZ }), { shadow: false });
    K.add(CM.brick, place(new THREE.RingGeometry(r, Ro, 28, 1, Math.PI / 2, Math.PI), { x: ax, y: spring, z: CZ, rx: -Math.PI / 2 }), { shadow: false });
    // SphereGeometry: x = -r cos(phi) sin(theta), so the west half is phi -pi/2..pi/2
    K.add(CM.dome, place(inward(new THREE.SphereGeometry(r, 40, 14, -Math.PI / 2, Math.PI, 0, Math.PI / 2)), { x: ax, y: spring, z: CZ }), { shadow: false });
    K.add(CM.domeOut, place(new THREE.SphereGeometry(Ro, 28, 10, -Math.PI / 2, Math.PI, 0, Math.PI / 2), { x: ax, y: spring, z: CZ }));
    // the synthronon: two tiers of stone bench round the curve
    const tier = (r0, r1, y0, h) => {
      K.add(CM.marble, place(inward(new THREE.CylinderGeometry(r0, r0, h, 24, 1, true, Math.PI, Math.PI)), { x: ax, y: y0 + h / 2, z: CZ }));
      K.add(CM.marble, place(new THREE.RingGeometry(r0, r1, 24, 1, Math.PI / 2, Math.PI), { x: ax, y: y0 + h, z: CZ, rx: -Math.PI / 2 }), { shadow: false });
    };
    tier(1.8, r, CHANCEL.y, 0.45);
    tier(2.15, r, CHANCEL.y + 0.45, 0.45);
    for (let i = 0; i <= 10; i++) {
      const th = Math.PI / 2 + 0.12 + (i / 10) * (Math.PI - 0.24);
      K.api.ghostBox(ax + Math.cos(th) * 2.2, CZ + Math.sin(th) * 2.2, 0.62, 0.62, CHANCEL.y + 0.45, { pen: 6 });
    }
    // the sunburst, over the altar on the back of the apse
    K.add(CM.sunburst, place(new THREE.PlaneGeometry(2.3, 2.3), { x: ax - 2.13, y: 2.75, z: CZ, ry: Math.PI / 2 }), { shadow: false });
    // the altar: marble block, the frontal, linen, six candles in gold sticks
    const alx = ax - 0.75;
    K.solid(alx, CZ, 0.8, 2.0, 1.0, { y: CHANCEL.y, mat: CM.marble, pen: 8 });
    // nobody goes behind the altar: the apse floor is a pocket zombies can't
    // reach, so it's shut (the altar's front is the line, a little over head
    // height for a jump; bullets go on through)
    K.api.ghostBox((ax - APSE.r + alx + 0.4) / 2, CZ, alx + 0.4 - (ax - APSE.r), APSE.r * 2, 1.25, { y: CHANCEL.y, pen: 0.5 });
    K.add(CM.frontal, place(new THREE.PlaneGeometry(1.9, 0.9), { x: alx + 0.405, y: CHANCEL.y + 0.5, z: CZ, ry: Math.PI / 2 }), { shadow: false });
    K.box(CM.linen, alx, CHANCEL.y + 1.0, CZ, 0.86, 0.02, 2.12);
    for (let i = 0; i < 6; i++) {
      const z = CZ - 0.85 + i * 0.34, hh = 0.18 + (i === 2 || i === 3 ? 0.08 : 0);
      K.cyl(M.gold, alx - 0.2, CHANCEL.y + 1.02, z, 0.06, 0.025, hh, 8);
      candle(K, M, alx - 0.2, CHANCEL.y + 1.02 + hh, z, { seed: 3100 + i, h: 0.2 });
    }
    // two standing candelabra either side
    for (const s of [-1, 1]) {
      const x = alx, z = CZ + s * 1.45;
      K.cyl(M.gold, x, CHANCEL.y, z, 0.18, 0.1, 0.12, 10);
      K.cyl(M.gold, x, CHANCEL.y + 0.12, z, 0.04, 0.035, 1.4, 8);
      K.cyl(M.gold, x, CHANCEL.y + 1.52, z, 0.03, 0.16, 0.06, 10);
      for (const k of [-0.11, 0, 0.11]) candle(K, M, x, CHANCEL.y + 1.58, z + k, { seed: 3120 + s * 10 + k * 100, h: 0.22 });
    }
    // the star lantern on its chain from the arch
    {
      const x = IN.x0 + 0.6, y = 4.4;
      K.add(M.iron, rodGeo([x, y + 0.4, CZ], [x, APSE.spring + APSE.r - 0.05, CZ], 0.012, 4), { shadow: false });
      K.add(CM.lantern, place(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 6), { x, y, z: CZ }), { shadow: false });
      K.add(CM.lantern, place(new THREE.ConeGeometry(0.28, 0.3, 6), { x, y: y + 0.4, z: CZ }), { shadow: false });
      K.add(CM.lantern, place(new THREE.ConeGeometry(0.28, 0.42, 6), { x, y: y - 0.46, z: CZ, rx: Math.PI }), { shadow: false });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        K.add(M.gold, rodGeo([x + Math.cos(a) * 0.29, y - 0.26, CZ + Math.sin(a) * 0.29], [x + Math.cos(a) * 0.29, y + 0.26, CZ + Math.sin(a) * 0.29], 0.015, 4), { shadow: false });
      }
      K.cyl(M.gold, x, y + 0.55, CZ, 0.05, 0.03, 0.1, 8);
      SP.add(x, y, CZ, 0xffb050, { size: 3.2, blink: 0.12 });
    }
  }

  /* ---- the west wall either side of the apse: the house rules */
  for (const [z, lines] of [
    [CZ - APSE.r - 0.95, ["THE RULES", "I · NO RAGE QUITS", "II · FEED NO TROLLS", "III · U MAD? NO."]],
    [CZ + APSE.r + 0.95, ["THE RULES", "IV · PROBLEM? NONE", "V · GG, ALWAYS", "VI · STAY GRINNING"]],
  ]) {
    K.box(CM.timber, IN.x0 + 0.03, CHANCEL.y + 1.2, z, 0.06, 1.95, 1.62);
    K.add(new THREE.MeshStandardMaterial({ map: rulesTexture(lines), emissiveMap: rulesTexture(lines), emissive: 0x6a6050, roughness: 0.6 }),
      place(new THREE.PlaneGeometry(1.44, 1.62), { x: IN.x0 + 0.065, y: CHANCEL.y + 2.175, z, ry: Math.PI / 2 }), { shadow: false });
  }

  /* ---- the chancel: pulpit, lectern, the communion rail */
  {
    const px = -48.4, pz = IN.z0 + 0.95;
    K.api.ghostBox(px, (IN.z0 + pz + 0.5) / 2, 1.0, pz + 0.5 - IN.z0, 1.15, { y: CHANCEL.y, pen: 4 });   // to the wall: no gap behind
    K.cyl(CM.oak, px, CHANCEL.y, pz, 0.32, 0.48, 1.05, 8);
    K.cyl(CM.timber, px, CHANCEL.y + 1.05, pz, 0.52, 0.52, 0.08, 8);
    K.box(M.gold, px + 0.32, CHANCEL.y + 1.12, pz, 0.3, 0.03, 0.42, { rz: 0.35 });
    const lx = -48.35, lz = IN.z1 - 0.9;
    K.api.ghostBox(lx, (lz - 0.25 + IN.z1) / 2, 0.5, IN.z1 - lz + 0.25, 1.3, { y: CHANCEL.y, pen: 1 });
    K.cyl(M.gold, lx, CHANCEL.y, lz, 0.22, 0.14, 0.08, 10);
    K.cyl(M.gold, lx, CHANCEL.y + 0.08, lz, 0.04, 0.04, 1.05, 8);
    K.box(M.gold, lx + 0.06, CHANCEL.y + 1.13, lz, 0.4, 0.04, 0.55, { rz: 0.4 });
    K.add(M.gold, place(new THREE.SphereGeometry(0.1, 10, 8), { x: lx, y: CHANCEL.y + 1.13, z: lz }));
    // the rail, with a gap on the aisle
    for (const [a, b] of [[IN.z0, CZ - 1.0], [CZ + 1.0, IN.z1]]) {
      const zc = (a + b) / 2, L = b - a;
      K.api.ghostBox(RAIL_X, zc, 0.14, L, 0.85, { pen: 0.8 });
      K.box(CM.oak, RAIL_X, 0.78, zc, 0.14, 0.07, L);
      K.box(CM.oak, RAIL_X, 0.05, zc, 0.1, 0.06, L);
      K.box(CM.velvet, RAIL_X + 0.25, 0, zc, 0.3, 0.09, L - 0.1, {}, { shadow: false });
      for (let z = a + 0.15; z < b - 0.05; z += 0.24) K.cyl(M.gold, RAIL_X, 0.11, z, 0.025, 0.025, 0.67, 6, {}, { shadow: false });
    }
  }

  /* ---- the pews, dark oak with carved ends */
  {
    const endShape = new THREE.Shape();
    endShape.moveTo(0, 0);
    endShape.lineTo(0.56, 0);
    endShape.lineTo(0.56, 1.0);
    endShape.lineTo(0.42, 1.0);
    endShape.quadraticCurveTo(0.22, 1.0, 0.14, 0.74);
    endShape.quadraticCurveTo(0.1, 0.62, 0, 0.62);
    endShape.lineTo(0, 0);
    const endGeo = new THREE.ExtrudeGeometry(endShape, { depth: 0.07, bevelEnabled: false, curveSegments: 6 });
    const pew = (x, z0, z1) => {
      const zc = (z0 + z1) / 2, L = z1 - z0;
      K.box(CM.oak, x - 0.03, 0.4, zc, 0.44, 0.05, L - 0.1);
      K.box(CM.oak, x + 0.2, 0.45, zc, 0.04, 0.5, L - 0.1, { rz: -0.1 });
      K.box(CM.oak, x + 0.29, 0.74, zc, 0.12, 0.03, L - 0.1);
      K.box(CM.oak, x - 0.2, 0.07, zc, 0.06, 0.05, L - 0.1);
      for (const ze of [z0, z1 - 0.07]) K.add(CM.oak, endGeo.clone().translate(x - 0.27, 0, ze));
    };
    for (const side of ["north", "south"]) {
      const [z0, z1] = PEW[side], rows = PEW_ROWS[side];
      rows.forEach((x) => pew(x, z0, z1));
      let first = rows[0];
      rows.forEach((x, i) => {
        if (i < rows.length - 1 && rows[i + 1] - x < 1.2) return;
        K.api.ghostBox((first - 0.28 + x + 0.32) / 2, (z0 + z1) / 2, x + 0.32 - first + 0.28, z1 - z0, 1.2, { pen: 1.5 });
        first = rows[i + 1];
      });
    }
    endGeo.dispose();
  }

  /* ---- the roof: brick gables, slates outside, the hammer beams and the
     painted panels inside */
  {
    const rise = ROOF_RISE, half = ROOF_HALF;
    const len = Math.hypot(half, rise), ang = Math.atan2(rise, half);
    const xm = (C.x0 + C.x1) / 2, xl = C.x1 - C.x0;
    for (const s of [-1, 1]) K.box(M.roof, xm, C.h + rise / 2 - 0.12, CZ + s * half / 2, xl + 0.8, 0.2, len, { rx: s * ang });
    for (const gx of [C.x0 + T / 2, C.x1 - T / 2]) {
      K.add(CM.brick, place(prismGeo([[-(C.z1 - C.z0) / 2, 0], [(C.z1 - C.z0) / 2, 0], [0, rise]], T), { x: gx, y: C.h, z: CZ, ry: Math.PI / 2 }));
    }
    K.box(M.stoneDark, xm, C.h + rise - 0.1, CZ, xl + 0.9, 0.18, 0.3);
    // the underside of the slates, d metres out from the ridge line
    const under = (d) => C.h + rise - 0.12 - 0.1 / Math.cos(ang) - (rise / half) * d;
    const span = CZ - IN.z0;                       // 4.4: ridge to the wall's inner face
    const xa = IN.x0, xb = IN.x1, bay = 2.75;
    for (const s of [-1, 1]) {
      const zw = CZ + s * span, yw = under(span) - 0.03, yr = under(0) - 0.03;
      const pts = [[xa, yw, zw], [xb, yw, zw], [xb, yr, CZ], [xa, yr, CZ]];
      const u0 = xa / bay, u1 = xb / bay;
      K.add(CM.ceiling, quad(pts, [[u0, 0], [u1, 0], [u1, 1], [u0, 1]]), { shadow: false });
      // wall plate, purlins, the ridge beam
      K.box(CM.timber, (xa + xb) / 2, C.h - 0.05, zw - s * 0.2, xb - xa, under(span - 0.4) - C.h + 0.05, 0.45);
      for (const d of [1.5, 3.0]) K.box(CM.timber, (xa + xb) / 2, under(d) - 0.2, CZ + s * d, xb - xa, 0.18, 0.2, { rx: s * ang });
    }
    K.box(CM.timber, (xa + xb) / 2, under(0) - 0.3, CZ, xb - xa, 0.26, 0.24);
    // the trusses
    const arc = (pts) => {
      for (let i = 1; i < pts.length; i++) K.add(CM.timber, rodGeo(pts[i - 1], pts[i], 0.085, 6));
    };
    for (const x of TRUSSES) {
      for (const s of [-1, 1]) {
        const Z = (d) => CZ + s * d;
        const dp = span - 0.13, dt = span - 1.0;     // wall post, hammer tip
        // the corbel and the wall post
        K.box(M.stoneDark, x, 3.6, Z(span - 0.16), 0.36, 0.3, 0.32);
        K.box(CM.timber, x, 3.9, Z(dp), 0.22, C.h - 0.15 - 3.9, 0.24);
        // the hammer beam and its post up to the principal rafter
        K.box(CM.timber, x, C.h - 0.15, Z(span - 0.5), 0.24, 0.3, 1.0);
        K.box(CM.timber, x, C.h + 0.15, Z(dt), 0.2, under(dt) - C.h - 0.35, 0.2);
        K.add(M.gold, place(new THREE.SphereGeometry(0.09, 10, 8), { x, y: C.h - 0.2, z: Z(dt) }));
        K.cyl(M.gold, x, C.h - 0.48, Z(dt), 0.02, 0.06, 0.28, 8);
        // the curved brace under the hammer beam
        const lower = [];
        for (let i = 0; i <= 7; i++) {
          const a = (i / 7) * (Math.PI / 2);
          lower.push([x, 4.15 + (C.h - 0.15 - 4.15) * Math.sin(a), Z(dt + (dp - dt) * Math.cos(a))]);
        }
        arc(lower);
        // the great arch from the hammer post up under the collar
        const upper = [];
        const top = under(1.3) - 0.42;
        for (let i = 0; i <= 10; i++) {
          const a = (i / 10) * (Math.PI / 2);
          upper.push([x, C.h + 0.35 + (top - C.h - 0.35) * Math.sin(a), Z(dt * Math.cos(a))]);
        }
        arc(upper);
        // the principal rafter
        const rl = Math.hypot(span, (rise / half) * span);
        K.box(CM.timber, x, (under(span) + under(0)) / 2 - 0.25, Z(span / 2), 0.22, 0.22, rl, { rx: s * ang });
      }
      K.box(CM.timber, x, under(1.3) - 0.42, CZ, 0.22, 0.24, 2.6);
    }
    // two opal lanterns hanging down the nave
    for (const x of [TRUSSES[1], TRUSSES[2]]) {
      K.add(M.iron, rodGeo([x, 6.15, CZ], [x, under(1.3) - 0.42, CZ], 0.012, 4), { shadow: false });
      K.cyl(M.gold, x, 6.05, CZ, 0.06, 0.2, 0.1, 10);
      K.cyl(CM.opal, x, 5.45, CZ, 0.17, 0.17, 0.6, 12, {}, { shadow: false });
      K.cyl(M.gold, x, 5.35, CZ, 0.12, 0.19, 0.1, 10);
      SP.add(x, 5.75, CZ, 0xfff0c8, { size: 1.4, blink: 0.05 });
    }
  }

  /* ---- outside: buttresses, the rose window on the east gable, the sign,
     the bell tower */
  for (const [x, z] of [[-45.6, C.z0 - 0.35], [-42.6, C.z0 - 0.35], [-46.0, C.z1 + 0.35], [-39.9, C.z1 + 0.35]]) {
    K.solid(x, z, 0.7, 0.7, 4.6, { mat: M.stone, pen: 10 });
    K.box(M.stoneDark, x, 4.6, z, 0.8, 0.2, 0.8, { rx: 0.3 });
  }
  for (const [x, ry] of [[IN.x1 - 0.01, -Math.PI / 2], [C.x1 + 0.01, Math.PI / 2]]) {
    K.add(M.rose, place(new THREE.CircleGeometry(0.85, 36), { x, y: 5.45, z: CZ, ry }), { shadow: false });
    K.add(M.stoneDark, place(new THREE.TorusGeometry(0.9, 0.1, 6, 32), { x, y: 5.45, z: CZ, ry }));
  }
  K.add(new THREE.MeshBasicMaterial({ map: signTexture(["ST. GRINSWORTH'S"], { bg: "#141018", fg: "#e8c868", edge: "#5a2a1a" }), color: 0xffffff }),
    place(new THREE.PlaneGeometry(2.6, 0.42), { x: C.x1 + 0.02, y: 4.16, z: CZ, ry: Math.PI / 2 }), { shadow: false });
  {
    // a bellcote astride the east gable: a slab in the gable wall's own
    // thickness (so nothing shows inside), the open bell stage over the ridge
    const tx = C.x1 - T / 2, tz = CZ, ridge = C.h + ROOF_RISE;
    K.box(CM.brick, tx, ridge - 1.6, tz, T, 2.3, 1.8);
    K.box(CM.brick, tx, ridge - 0.3, tz, 1.5, 1.0, 1.2);
    for (const [dx, dz] of [[-0.6, -0.45], [0.6, -0.45], [-0.6, 0.45], [0.6, 0.45]]) K.box(M.stone, tx + dx, ridge + 0.7, tz + dz, 0.24, 1.8, 0.24);
    K.box(M.stoneDark, tx, ridge + 2.5, tz, 1.7, 0.3, 1.4);
    K.add(M.roof, place(new THREE.ConeGeometry(1.1, 2.4, 4), { x: tx, y: ridge + 2.8 + 1.2, z: tz, ry: Math.PI / 4 }));
    K.cyl(M.iron, tx, ridge + 5.2, tz, 0.04, 0.02, 0.8, 4);
    K.box(M.iron, tx, ridge + 5.65, tz, 0.05, 0.05, 0.45);
    K.add(M.gold, place(new THREE.CylinderGeometry(0.16, 0.38, 0.55, 14, 1, true), { x: tx, y: ridge + 1.45, z: tz }));
    K.add(M.iron, place(new THREE.CylinderGeometry(0.035, 0.035, 0.95, 4), { x: tx, y: ridge + 1.8, z: tz, rx: Math.PI / 2 }));
  }

  /* ---- the one light, warm, and dust in it */
  const l = new THREE.PointLight(0xffc890, 12, 18, 2);
  l.position.set(-45.2, 5.4, CZ);
  lights.push(l);
  SP.swarm(8, -44, CZ, 8, 7, 1.2, 5, 0xffe0a0, { size: 0.18, wander: 1.0, blink: 0.3 });

  /* ---- the churchyard, out of the side door */
  for (const [x, z] of [[-47.8, 10.4], [-45.6, 10.2], [-40.4, 10.6], [-48.2, 13.6], [-44.2, 14.2], [-39.8, 13.8]]) {
    const w = 0.6 + R() * 0.2, h = 0.8 + R() * 0.3;
    K.api.ghostBox(x, z, w, 0.3, h, { pen: 3 });
    K.add(R() < 0.5 ? M.stone : M.stoneDark, place(headstoneGeo(w, h, 0.18), { x, z, ry: (R() - 0.5) * 0.2 }));
  }
  for (const [x, z] of [[-46.4, 12.4], [-42.2, 12.0]]) {
    K.box(M.dirt, x, 0, z, 0.8, 0.08, 1.7, {}, { shadow: false });
    K.add(M.dirt, place(new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), { x: x + 0.85, y: 0, z, sx: 0.7, sy: 0.5, sz: 1.6 }));
    ZSPAWNS.push({ x, y: 0, z, rise: true });
  }
  jack(K, M, -44.6, 0, 9.4, { r: 0.26, face: Math.PI, seed: 3200 });
}
