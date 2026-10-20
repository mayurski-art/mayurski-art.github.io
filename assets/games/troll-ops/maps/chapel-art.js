// Troll Forces — St. Grinsworth's chapel art: the canvas textures (brick floor,
// red runner, painted hammer-beam panels, frieze, stained-glass lancets, mosaic
// dome and apse wall, trollface sunburst, altar frontal, Controllments boards,
// star lantern) and the shape helpers (arch fill, inside-out, quad, wall band).
//
// Shared by Hollowgrin's chapel (hollowgrin-chapel.js) and Troll City's bigger
// one (trollcity-chapel.js). Each texture is made once and cached.

import * as THREE from "three";

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
const TROLL_URL = new URL("../../../images/wallpaper/trollface%20transparent.png", import.meta.url).href;
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
export function floorTexture() {
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
export function runnerTexture() {
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
export function ceilingTexture() {
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
export function friezeTexture() {
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
export function lancetTexture() {
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
export function domeTexture() {
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
export function apseWallTexture() {
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
export function sunburstTexture() {
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
export function frontalTexture() {
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
/* The Ten Controllments (user, 2026-10-03), five a plaque: a two-line title
   then the commandments. Drawn at 2x so the small lines stay crisp up close. */
export function rulesTexture(lines) {
  return canvasTex(640, 720, (g) => {
    g.scale(2, 2);
    const W = 320, H = 360;
    g.fillStyle = "#14100e"; g.fillRect(0, 0, W, H);
    g.strokeStyle = "#c89a3a"; g.lineWidth = 6; g.strokeRect(12, 12, W - 24, H - 24);
    g.lineWidth = 2; g.strokeRect(22, 22, W - 44, H - 44);
    g.fillStyle = "#e8c868";
    g.textAlign = "center";
    g.font = "bold 18px Georgia, serif";
    g.fillText(lines[0], W / 2, 56, W - 60);
    g.font = "bold 30px Georgia, serif";
    g.fillText(lines[1], W / 2, 90, W - 60);
    g.fillRect(W / 2 - 60, 104, 120, 3);
    g.font = "19px Georgia, serif";
    lines.slice(2).forEach((l, i) => g.fillText(l, W / 2, 148 + i * 42, W - 56));
  });
}

/* The star lantern's panes: red, amber, green, blue in gold lead. */
export function lanternTexture() {
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
export function archFill(K, mat, { axis, at, c, w, top, R, t, y = 0 }) {
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
export function inward(geo) {
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
export function quad(pts, uvs) {
  const p = [pts[0], pts[1], pts[2], pts[0], pts[2], pts[3]].flat();
  const u = [uvs[0], uvs[1], uvs[2], uvs[0], uvs[2], uvs[3]].flat();
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(u, 2));
  g.computeVertexNormals();
  return g;
}

/* A plane along a wall's inner face with its UVs repeated every `rep` m. */
export function band(axis, at, a, b, y0, y1, face, rep) {
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
