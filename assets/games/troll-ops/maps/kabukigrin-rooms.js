// Troll Forces — Kabukigrin's borrowed rooms (doc docs/KABUKIGRIN.md 3.5
// b, c, d): their walls, tables, desk, stools, lanterns and the cat are
// Studio's (kb-town.glb, the colliders in kabukigrin-layout.js); what's
// drawn here is what Studio can't hold: the shoji paper and the tatami, the
// noren, the lit bar doors and menus, the lanterns' glow, and the three
// things that move: the koi tank (shot: the glass cracks, the fish scatter),
// the office's one-way mirror (a mirror from the hall, glass from inside,
// shot: a frame for a while) and the office's camera monitors.

import * as THREE from "three";
import { place, texMat, glowTexture } from "./trollcity-kit.js?v=tc2-wst-tc3-sh1-sr1-pf1-or1-tcs1";
import { slatTexture } from "./trollingloud-kit.js?v=tl3-tc3-sh1-sr1-or1-tcs1";

const canvas = (w, h, draw) => {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  return c;
};
const canvasTex = (c, { srgb = true, repeat = false } = {}) => {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
};
// a seeded random, so every build draws the same paper and the same fish
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const JP = "'Hiragino Mincho ProN','Yu Mincho','Noto Serif JP','Hiragino Sans','Yu Gothic','Meiryo',serif";

/* ------------------------------------------------------------ textures */

// one tatami square, 1.82 m: two mats side by side, the black cloth border
// (heri) down their long edges, the rush weave across
function tatamiTexture() {
  const r = rng(7);
  return canvasTex(canvas(512, 512, (g) => {
    for (let m = 0; m < 2; m++) {
      const x0 = m * 256;
      g.fillStyle = "#b9b07a";
      g.fillRect(x0, 0, 256, 512);
      for (let y = 0; y < 512; y += 3) {
        g.fillStyle = `rgba(${90 + r() * 40},${86 + r() * 30},${40 + r() * 20},${0.18 + r() * 0.14})`;
        g.fillRect(x0 + 14, y, 228, 1.4);
      }
      g.fillStyle = "#151515";
      g.fillRect(x0, 0, 14, 512);
      g.fillRect(x0 + 242, 0, 14, 512);
      g.fillStyle = "rgba(0,0,0,.25)";
      g.fillRect(x0, 0, 256, 2);
    }
  }), { repeat: true });
}

// a shoji panel 0.9 m square: paper lit from behind, the kumiko lattice
function shojiTexture() {
  const r = rng(11);
  return canvasTex(canvas(256, 256, (g) => {
    const grad = g.createRadialGradient(128, 128, 20, 128, 128, 190);
    grad.addColorStop(0, "#fff4dc");
    grad.addColorStop(1, "#e9d6ae");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 600; i++) {
      g.fillStyle = `rgba(150,120,80,${r() * 0.06})`;
      g.fillRect(r() * 256, r() * 256, 1 + r() * 6, 1);
    }
    g.fillStyle = "#2a1a10";
    for (let i = 0; i <= 4; i++) {
      const p = Math.round(i * 63.75);
      g.fillRect(p - (i % 4 ? 2 : 6), 0, i % 4 ? 4 : 12, 256);
      if (i > 0 && i < 4) g.fillRect(0, p - 2, 256, 4);
    }
    g.fillRect(0, 0, 256, 6);
    g.fillRect(0, 250, 256, 6);
  }), { repeat: true });
}

// a noren: three panels of cloth hanging from a rod, split from the hem,
// a word in white across them
function norenTexture(bg, text, fg = "#f4efe6") {
  return canvasTex(canvas(384, 160, (g, W, H) => {
    g.fillStyle = bg;
    for (let i = 0; i < 3; i++) g.fillRect(i * 128 + 3, 0, 122, H);
    g.fillStyle = "rgba(0,0,0,.25)";
    g.fillRect(0, 0, W, 10);
    g.fillStyle = fg;
    const chars = [...text];
    g.font = `700 ${Math.min(70, Math.round((W / chars.length) * 0.78))}px ${JP}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    chars.forEach((ch, i) => g.fillText(ch, (W / chars.length) * (i + 0.5), 92));
  }));
}

// a bar's sliding doors: frosted glass with the bar's warm light behind it,
// a grid of wooden bars, two shadows at the counter
function barDoorTexture(seed, tint) {
  const r = rng(seed);
  return canvasTex(canvas(256, 192, (g, W, H) => {
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, tint);
    grad.addColorStop(1, "#5a2a12");
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(30,12,6,.45)";
    for (let k = 0; k < 2; k++) {
      const x = 40 + r() * 170, s = 0.8 + r() * 0.3;
      g.beginPath(); g.ellipse(x, 70 * s + 20, 16 * s, 19 * s, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(x, 140, 30 * s, 44, 0, 0, 7); g.fill();
    }
    g.fillStyle = "#2a160c";
    for (let x = 0; x <= W; x += W / 4) g.fillRect(x - 4, 0, 8, H);
    for (let y = 0; y <= H; y += H / 3) g.fillRect(0, y - 3, W, 6);
  }));
}

// a hand-painted menu: brown paper, prices brushed in columns
function menuTexture(items) {
  return canvasTex(canvas(160, 256, (g, W, H) => {
    g.fillStyle = "#e8dcbc";
    g.fillRect(0, 0, W, H);
    g.strokeStyle = "#7a1e12";
    g.lineWidth = 4;
    g.strokeRect(6, 6, W - 12, H - 12);
    g.fillStyle = "#1a1208";
    g.font = `700 22px ${JP}`;
    g.textAlign = "center";
    items.forEach((it, i) => {
      const x = W - 26 - i * 34;
      [...it].forEach((ch, j) => g.fillText(ch, x, 34 + j * 24));
    });
  }));
}

// the mirror's sheen: the club's colours smeared on dark glass
function mirrorTexture() {
  return canvasTex(canvas(512, 128, (g, W, H) => {
    g.fillStyle = "#151821";
    g.fillRect(0, 0, W, H);
    const blobs = [["255,42,180", 60], ["63,240,255", 190], ["160,96,255", 330], ["255,42,180", 450]];
    for (const [c, x] of blobs) {
      const r = g.createRadialGradient(x, H * 0.45, 4, x, H * 0.45, 90);
      r.addColorStop(0, `rgba(${c},.55)`);
      r.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = r;
      g.fillRect(0, 0, W, H);
    }
    g.fillStyle = "rgba(255,255,255,.07)";
    for (const x of [80, 140, 300, 420]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 40, 0); g.lineTo(x - 20, H); g.lineTo(x - 60, H); g.fill(); }
  }), { repeat: true });
}

// a pane shot out: jagged shards round the frame, the middle gone
function shardsTexture() {
  const r = rng(5);
  return canvasTex(canvas(512, 160, (g, W, H) => {
    g.fillStyle = "rgba(200,215,230,.55)";
    const edge = (pts) => { g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); g.closePath(); g.fill(); };
    for (let x = 0; x < W; x += 24) {
      edge([[x, 0], [x + 24, 0], [x + 12, 10 + r() * 40]]);
      edge([[x, H], [x + 24, H], [x + 12, H - 10 - r() * 40]]);
    }
    for (let y = 0; y < H; y += 20) {
      edge([[0, y], [0, y + 20], [10 + r() * 50, y + 10]]);
      edge([[W, y], [W, y + 20], [W - 10 - r() * 50, y + 10]]);
    }
  }));
}

/* ------------------------------------------------------------ the koi tank

   A 2D tank drawn into a canvas, ~15 fps while it's on screen: deep water,
   moving caustics, weed, gravel, seven koi on slow loops. A shot puts a
   star of cracks where it hit and sends the fish darting away from it. */
function koiTank(w, h) {
  const W = 640, H = Math.round(W * h / w);
  const c = canvas(W, H, () => {});
  const g = c.getContext("2d");
  const tex = canvasTex(c);
  const r = rng(23);
  const COATS = [["#ff7a1a", "#fff4ea"], ["#fff4ea", "#e22a1a"], ["#ff9a2a", "#ff9a2a"], ["#fff4ea", "#151515"], ["#e83a1a", "#fff4ea"], ["#ffd23a", "#ffd23a"], ["#fff4ea", "#ff6a1a"]];
  const fish = COATS.map(([a, b], i) => ({ a, b, cx: W * (0.15 + r() * 0.7), cy: H * (0.3 + r() * 0.45), rx: W * (0.12 + r() * 0.2), ry: H * (0.08 + r() * 0.12), sp: (0.12 + r() * 0.1) * (i % 2 ? 1 : -1), ph: r() * 7, len: 34 + r() * 16, dx: 0, dy: 0 }));
  const weed = Array.from({ length: 9 }, () => ({ x: r() * W, h: H * (0.35 + r() * 0.4), ph: r() * 7 }));
  const gravel = canvas(W, 40, (gg) => { for (let i = 0; i < 900; i++) { const v = 60 + r() * 90; gg.fillStyle = `rgb(${v},${v * 0.9},${v * 0.75})`; gg.beginPath(); gg.ellipse(r() * W, 14 + r() * 26, 2 + r() * 4, 1.5 + r() * 2.5, 0, 0, 7); gg.fill(); } });
  const cracks = [];
  let scare = null, last = 0;

  function draw(now) {
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#2a8a9a");
    bg.addColorStop(0.6, "#0d4656");
    bg.addColorStop(1, "#06222c");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    // the light through the surface
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 7; i++) {
      const x = ((i * 113 + now * 18) % (W + 200)) - 100;
      g.fillStyle = "rgba(140,255,240,.06)";
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 50, 0); g.lineTo(x + 140, H); g.lineTo(x + 60, H); g.fill();
    }
    g.globalCompositeOperation = "source-over";
    for (const k of weed) {
      g.strokeStyle = "#1f6a3a"; g.lineWidth = 5; g.beginPath(); g.moveTo(k.x, H);
      for (let s = 1; s <= 6; s++) g.lineTo(k.x + Math.sin(now * 1.2 + k.ph + s * 0.6) * s * 2.2, H - (k.h * s) / 6);
      g.stroke();
    }
    g.drawImage(gravel, 0, H - 40);
    const sc = scare && now < scare.until ? scare : null;
    for (const f of fish) {
      const t = now * f.sp + f.ph;
      let x = f.cx + Math.cos(t) * f.rx, y = f.cy + Math.sin(t * 1.3) * f.ry;
      if (sc) {
        // dart away from the hit, then drift back
        const k = (sc.until - now) / 3, ax = x - sc.x, ay = y - sc.y, d = Math.hypot(ax, ay) || 1;
        f.dx += ((ax / d) * 90 * k - f.dx) * 0.2; f.dy += ((ay / d) * 50 * k - f.dy) * 0.2;
      } else { f.dx *= 0.95; f.dy *= 0.95; }
      x = Math.min(W - 20, Math.max(20, x + f.dx)); y = Math.min(H - 46, Math.max(14, y + f.dy));
      const ang = Math.atan2(Math.cos(t * 1.3) * f.ry * 1.3, -Math.sin(t) * f.rx) + (f.sp < 0 ? Math.PI : 0);
      const wig = Math.sin(now * (sc ? 22 : 7) + f.ph) * 0.35;
      g.save(); g.translate(x, y); g.rotate(f.sp < 0 ? ang : ang);
      g.fillStyle = "rgba(0,0,0,.18)"; g.beginPath(); g.ellipse(4, 6, f.len * 0.5, f.len * 0.17, 0, 0, 7); g.fill();
      g.save(); g.translate(-f.len * 0.42, 0); g.rotate(wig);
      g.fillStyle = f.a; g.globalAlpha = 0.85; g.beginPath(); g.moveTo(0, 0); g.lineTo(-f.len * 0.32, -f.len * 0.2); g.lineTo(-f.len * 0.28, f.len * 0.2); g.fill();
      g.restore(); g.globalAlpha = 1;
      g.fillStyle = f.a; g.beginPath(); g.ellipse(0, 0, f.len * 0.5, f.len * 0.17, 0, 0, 7); g.fill();
      g.fillStyle = f.b; g.beginPath(); g.ellipse(f.len * 0.08, -f.len * 0.02, f.len * 0.22, f.len * 0.1, 0.2, 0, 7); g.fill();
      g.restore();
    }
    // the glass: a sheen, and any cracks
    g.fillStyle = "rgba(255,255,255,.05)";
    g.fillRect(0, 0, W, 10);
    g.strokeStyle = "rgba(235,250,255,.85)";
    g.lineWidth = 1.6;
    for (const k of cracks) for (const ln of k) { g.beginPath(); g.moveTo(...ln[0]); for (const p of ln.slice(1)) g.lineTo(...p); g.stroke(); }
    tex.needsUpdate = true;
  }
  draw(0);

  return {
    tex,
    tick(now) { if (now - last > 1 / 15) { last = now; draw(now); } },
    // u, v: 0..1 across the glass, v up
    hit(u, v, now) {
      const x = u * W, y = (1 - v) * H, rr = rng(Math.round(now * 1000));
      const star = [];
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + rr() * 0.4, len = 30 + rr() * 70, pts = [[x, y]];
        for (let s = 1; s <= 4; s++) pts.push([x + Math.cos(a + (rr() - 0.5) * 0.3) * (len * s) / 4, y + Math.sin(a + (rr() - 0.5) * 0.3) * (len * s) / 4]);
        star.push(pts);
      }
      for (let ring = 1; ring <= 2; ring++) {
        const pts = [];
        for (let i = 0; i <= 9; i++) { const a = (i / 9) * Math.PI * 2; pts.push([x + Math.cos(a) * ring * 16, y + Math.sin(a) * ring * 13]); }
        star.push(pts);
      }
      cracks.push(star);
      if (cracks.length > 6) cracks.shift();
      scare = { x, y, until: now + 3 };
    },
    mend() { cracks.length = 0; },
    cracked: () => cracks.length,
  };
}

/* The camera monitors on the manager's desk: four grainy feeds of the
   floor, a timestamp, the REC dot. One canvas, a few frames a second. */
function camFeeds() {
  const W = 256, H = 160;
  const c = canvas(W, H, () => {});
  const g = c.getContext("2d");
  const tex = canvasTex(c);
  const r = rng(3);
  let last = 0;
  function draw(now) {
    for (let q = 0; q < 4; q++) {
      const x0 = (q % 2) * 128, y0 = Math.floor(q / 2) * 80;
      g.fillStyle = "#1a1f22"; g.fillRect(x0, y0, 128, 80);
      for (let i = 0; i < 9; i++) {
        const bx = x0 + 10 + ((i * 37 + now * (8 + q * 3) * (i % 2 ? 1 : -1)) % 108 + 108) % 108, by = y0 + 40 + Math.sin(now * 2 + i) * 6 + (i % 3) * 8;
        g.fillStyle = `rgba(${140 + q * 20},${150},${160},.7)`; g.beginPath(); g.ellipse(bx, by, 4, 9, 0, 0, 7); g.fill();
      }
      for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.12})`; g.fillRect(x0 + r() * 128, y0 + r() * 80, 1, 1); }
      g.fillStyle = "#cfe"; g.font = "9px monospace"; g.fillText(`CAM ${q + 1}`, x0 + 4, y0 + 11);
      if (q === 0 && Math.floor(now * 2) % 2) { g.fillStyle = "#f22"; g.beginPath(); g.arc(x0 + 118, y0 + 8, 3, 0, 7); g.fill(); }
      g.strokeStyle = "#000"; g.lineWidth = 2; g.strokeRect(x0, y0, 128, 80);
    }
    tex.needsUpdate = true;
  }
  draw(0);
  return { tex, tick(now) { if (now - last > 0.2) { last = now; draw(now); } } };
}

/* ============================================================== the rooms */

export function buildRooms({ root, K, N, M, S, jpSign, sfx }) {
  const R = { koi: null, mirror: null };
  const shoji = texMat(shojiTexture(), { tile: 0.9, rough: 0.9, bounce: 0.55 });
  const tatami = texMat(tatamiTexture(), { tile: 1.82, rough: 0.85 });
  const darkWood = texMat(slatTexture(), { color: 0x6a4630, tile: 1.2, rough: 0.55 });
  const lacquer = new THREE.MeshStandardMaterial({ color: 0x5a0d12, roughness: 0.35 });
  const quad = (mat, x, y, z, w, h, ry, o = {}) => K.add(mat, place(new THREE.PlaneGeometry(w, h), { x, y, z, ry, ...o }), { shadow: false });
  const live = (mesh, tick) => {
    mesh.onBeforeRender = () => { const now = performance.now() / 1000; ACTIVE = R; tick(now); };
    root.add(mesh);
    return mesh;
  };

  /* ---- the tatami VIP room (3.5 c): x -31.7 .. -24.15, z 24.2 .. 29.85 */
  quad(tatami, -27.925, 0.302, 27.025, 7.55, 5.65, 0, { rx: -Math.PI / 2 });
  // shoji to the beam (2.3), a black beam, lacquer red above (from the door
  // heads, `top`, over the doorways), a dark ceiling
  const SH = [0.3, 2.3];
  const wallBand = (x, z, len, ry, holes = [], top = 2.45) => {
    // holes: [a0, a1, y0, y1] along the wall's length from its start
    const segs = [[0, len]];
    for (const [a0, a1] of holes.filter((hh) => hh[2] <= SH[0])) {
      for (let i = segs.length - 1; i >= 0; i--) {
        const [s0, s1] = segs[i];
        if (a1 <= s0 || a0 >= s1) continue;
        segs.splice(i, 1, ...[[s0, a0], [a1, s1]].filter(([p, q]) => q - p > 0.05));
      }
    }
    const ax = Math.cos(ry), az = -Math.sin(ry);   // along the wall
    for (const [s0, s1] of segs) {
      const m = (s0 + s1) / 2, wx = x + ax * (m - len / 2), wz = z + az * (m - len / 2);
      const win = holes.find((hh) => hh[2] > SH[0] && hh[0] < s1 && hh[1] > s0);
      if (win) {
        // shoji under the window, the beam's lacquer over it
        quad(shoji, wx, (SH[0] + win[2]) / 2, wz, s1 - s0, win[2] - SH[0], ry);
        quad(lacquer, wx, (win[3] + top) / 2, wz, s1 - s0, top - win[3], ry);
        continue;
      }
      quad(shoji, wx, (SH[0] + SH[1]) / 2, wz, s1 - s0, SH[1] - SH[0], ry);
      quad(M.blackGloss, wx, 2.375, wz, s1 - s0, 0.15, ry);
      if (top > 2.46) quad(lacquer, wx, (2.45 + top) / 2, wz, s1 - s0, top - 2.45, ry);
    }
    quad(lacquer, x, (top + 6) / 2, z, len, 6 - top, ry);
  };
  // the east wall (facing -x), the south wall (facing -z, its door), the
  // hall's wall (facing +z, the door and the window); holes run along each
  // wall from its start (the east wall from z 24.2, the south from x -24.15
  // going west, the hall's from x -31.7)
  wallBand(-24.16, 27.025, 5.65, -Math.PI / 2);
  wallBand(-27.925, 29.84, 7.55, Math.PI, [[1.65, 4.05, 0, 2.6]], 2.6);
  wallBand(-27.925, 24.21, 7.55, 0, [[3.5, 5.9, 0, 2.8], [0, 3.5, 1.5, 2.5]], 2.8);
  // the west wall above the tank: out at the tank's face, in front of the
  // backs' paint, lightboxes and windows on the edge wall (they run on past
  // the room, so they can't be cleared)
  const WX = -31.4;
  quad(lacquer, WX, 4.2, 27.025, 5.65, 3.6, Math.PI / 2);
  quad(M.blackGloss, WX, 2.375, 27.025, 5.65, 0.15, Math.PI / 2);
  for (const [z0, z1] of [[24.2, 24.62], [29.58, 29.85]]) quad(shoji, WX, 1.3, (z0 + z1) / 2, z1 - z0, 2, Math.PI / 2);
  K.add(new THREE.MeshStandardMaterial({ color: 0x1a0f0a, roughness: 0.7 }), place(new THREE.PlaneGeometry(7.55, 5.65), { x: -27.925, y: 5.97, z: 27.025, rx: Math.PI / 2 }), { shadow: false });
  // the window onto the hall: a kumiko lattice, both faces
  const lattice = texMat(canvasTex(canvas(256, 72, (g, W, H) => {
    g.fillStyle = "#2a160c";
    for (let x = 0; x <= W; x += W / 8) g.fillRect(x - 3, 0, 6, H);
    g.fillRect(0, 0, W, 6); g.fillRect(0, H - 6, W, 6); g.fillRect(0, H / 2 - 2, W, 4);
  })), { alphaTest: 0.5, side: THREE.DoubleSide, rough: 0.6 });
  lattice.map.premultiplyAlpha = false;
  quad(lattice, -29.95, 2.0, 24.0, 3.5, 1.0, 0);
  // the noren over the staff door, the VIP's name on it
  const noren = texMat(norenTexture("#1c2a5a", "特別室"), { alphaTest: 0.4, side: THREE.DoubleSide, rough: 0.9, bounce: 0.3 });
  quad(noren, -27, 2.25, 29.78, 2.4, 0.7, Math.PI);
  // the room's neon: a sakura tube along the hall wall's beam
  N.tube(M.neon, [[-31.6, 2.46, 24.25], [-28.3, 2.46, 24.25]], { r: 0.02, smooth: false, color: 0xff9ad0, k: 1.6, beat: 0.12 });
  N.tube(M.neon, [[-25.7, 2.46, 24.25], [-24.25, 2.46, 24.25]], { r: 0.02, smooth: false, color: 0xff9ad0, k: 1.6, beat: 0.12 });

  // the koi tank: the water, unlit (it's lit from inside), the glass over it
  const KOI = { x: -31.235, y: 1.55, z: 27.1, w: 4.8, h: 1.5 };
  const koi = koiTank(KOI.w, KOI.h);
  R.koi = { ...KOI, tank: koi, until: 0 };
  const water = new THREE.Mesh(place(new THREE.PlaneGeometry(KOI.w, KOI.h), { x: KOI.x, y: KOI.y, z: KOI.z, ry: Math.PI / 2 }), new THREE.MeshBasicMaterial({ map: koi.tex, toneMapped: false, color: 0xcfdde0 }));
  live(water, (now) => { koi.tick(now); if (R.koi.until && now > R.koi.until) { koi.mend(); R.koi.until = 0; } });
  const glass = new THREE.MeshStandardMaterial({ color: 0xbfe8ff, roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.1, depthWrite: false });
  root.add(new THREE.Mesh(place(new THREE.PlaneGeometry(KOI.w, KOI.h), { x: KOI.x + 0.03, y: KOI.y, z: KOI.z, ry: Math.PI / 2 }), glass));
  // its glow on the tatami in front
  N.quad(M.neonHalo, KOI.x + 0.9, 0.31, KOI.z, 1.8, KOI.w + 0.6, { rx: -Math.PI / 2, ry: Math.PI / 2, color: 0x3ad8e0, k: 0.22, beat: 0 });

  /* ---- the manager's office (3.5 d): x -14 .. -6.3, z 19.1 .. 23.8, deck 3 */
  const panel = (x, z, w, y0, y1, ry) => quad(darkWood, x, (y0 + y1) / 2, z, w, y1 - y0, ry);
  panel(-13.4 + 0.15, 19.11, 0.9, 3, 7.4, 0);            // its north wall, inside
  panel(-8.75, 19.11, 4.9, 3, 7.4, 0);
  panel(-12, 19.11, 1.6, 5.4, 7.4, 0);
  panel(-6.31, 21.45, 4.7, 3, 7.4, -Math.PI / 2);         // the Heaven wall
  panel(-10, 23.79, 7.4, 5.6, 7.4, Math.PI);              // the back wall over the stair door
  panel(-12.05, 23.79, 2.1, 3, 5.6, Math.PI);
  panel(-7.95, 23.79, 3.3, 3, 5.6, Math.PI);
  panel(-13.69, 19.45, 0.7, 3, 7.4, Math.PI / 2);         // either side of the window
  panel(-13.69, 23.6, 0.4, 3, 7.4, Math.PI / 2);
  panel(-13.69, 22.3 - 0.7, 3.6, 5.2, 7.4, Math.PI / 2);
  panel(-13.69, 21.6, 3.6, 3, 4.0, Math.PI / 2);
  // ... and the club's slats on its outside: the north wall over the mezzanine, the west over the hall
  const slatsOut = texMat(slatTexture(), { color: 0xb08080, tile: 1.2, rough: 0.6, bounce: 0.08 });
  for (const [x, w, y0, y1] of [[-13.4, 1.2, 3, 7.4], [-8.75, 4.9, 3, 7.4], [-12, 1.6, 5.4, 7.4]]) quad(slatsOut, x, (y0 + y1) / 2, 18.89, w, y1 - y0, Math.PI);
  for (const [z, w, y0, y1] of [[19.45, 0.7, 4, 7.4], [23.6, 0.4, 4, 7.4], [21.6, 3.6, 5.2, 7.4]]) quad(slatsOut, -14.01, (y0 + y1) / 2, z, w, y1 - y0, -Math.PI / 2);

  // the one-way mirror: a mirror from the hall (facing -x), smoked glass from inside
  const MIR = { x: -13.85, y: 4.6, z: 21.6, w: 3.6, h: 1.2 };
  const mirMat = new THREE.MeshBasicMaterial({ map: mirrorTexture(), color: 0xc0c8d8 });
  const mirror = new THREE.Mesh(place(new THREE.PlaneGeometry(MIR.w, MIR.h), { x: MIR.x - 0.16, y: MIR.y, z: MIR.z, ry: -Math.PI / 2 }), mirMat);
  // the sheen slides as you walk past it
  live(mirror, () => { mirMat.map.offset.x = (ACTIVE_CAM.z - MIR.z) * 0.04 + ACTIVE_CAM.x * 0.01; if (R.mirror.until && performance.now() / 1000 > R.mirror.until) mend(); });
  mirror.onBeforeRender = ((f) => (r, s, cam) => { ACTIVE_CAM.copy(cam.position); f(); })(mirror.onBeforeRender);
  const smoked = new THREE.Mesh(place(new THREE.PlaneGeometry(MIR.w, MIR.h), { x: MIR.x + 0.14, y: MIR.y, z: MIR.z, ry: Math.PI / 2 }),
    new THREE.MeshStandardMaterial({ color: 0x20242c, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.28, depthWrite: false }));
  root.add(smoked);
  const shards = new THREE.Mesh(place(new THREE.PlaneGeometry(MIR.w, MIR.h), { x: MIR.x, y: MIR.y, z: MIR.z, ry: Math.PI / 2 }),
    new THREE.MeshBasicMaterial({ map: shardsTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  shards.visible = false;
  root.add(shards);
  R.mirror = { ...MIR, until: 0 };
  const mend = () => { mirror.visible = smoked.visible = true; shards.visible = false; R.mirror.until = 0; };
  R.mirror.smash = (now) => { mirror.visible = smoked.visible = false; shards.visible = true; R.mirror.until = now + 90; };

  // the camera monitors on the desk, facing the chair
  const cams = camFeeds();
  const screens = new THREE.Group();
  for (const z of [20.95, 21.6, 22.25]) {
    K.box(M.blackMetal, -13.42, 3.78, z, 0.05, 0.4, 0.58, {}, { shadow: false });
    screens.add(new THREE.Mesh(place(new THREE.PlaneGeometry(0.54, 0.34), { x: -13.39, y: 4.0, z, ry: Math.PI / 2 }), new THREE.MeshBasicMaterial({ map: cams.tex, toneMapped: false })));
  }
  screens.children.forEach((m) => live(m, (now) => cams.tick(now)));

  /* ---- the yokocho in the Vents (3.5 b): six bar fronts, x 7 .. 23, z -4 .. -2 */
  const BARS = [
    [9.0, 1, "居酒屋", "#7a1418", "#ffcf8a"], [11.5, -1, "焼鳥", "#1c2a5a", "#ffb870"], [14.0, 1, "スナック", "#2a1a3a", "#ff9ad0"],
    [16.5, -1, "おでん", "#5a3a12", "#ffd9a0"], [19.0, 1, "酒場", "#101010", "#ffc070"], [21.3, -1, "立飲", "#6a1a10", "#ffb060"],
  ];
  const MENUS = [["生ビール五百円", "焼鳥三本", "枝豆"], ["日本酒", "ハイボール", "冷奴"], ["おでん盛合せ", "熱燗", "唐揚げ"]];
  BARS.forEach(([x, side, name, cloth, warm], i) => {
    const face = side > 0 ? -3.88 : -2.12, ry = side > 0 ? 0 : Math.PI, out = side;
    // the lit doors between the posts
    const door = texMat(barDoorTexture(31 + i, warm), { rough: 0.3, emissive: 0xffffff, emissiveMap: null });
    door.emissiveMap = door.map;
    door.emissiveIntensity = 0.9;
    quad(door, x, 1.2, face - out * 0.06, 2.06, 1.5, ry);
    // the noren from the beam, the bar's name on the beam
    const nm = texMat(norenTexture(cloth, name), { alphaTest: 0.4, side: THREE.DoubleSide, rough: 0.9, bounce: 0.3 });
    quad(nm, x, 1.67, face + out * 0.03, 1.9, 0.56, ry);
    const s = jpSign(name, { color: warm, size: 96 });
    // each bar's sign is its own shootable group (5 .. 10): a round shorts just that one
    N.quad(s.mat, x, 2.1, face + out * 0.015, 0.24 * s.aspect, 0.24, { ry, k: 1.1, beat: 0, group: 5 + i });
    S.signs.push({ group: 5 + i, x, y: 2.1, z: face + out * 0.015, w: 0.24 * s.aspect, h: 0.24, ry });
    // a menu on the other wall, opposite
    const menu = texMat(menuTexture(MENUS[i % 3]), { rough: 0.9, bounce: 0.12, decal: true });
    quad(menu, x, 1.45, side > 0 ? -2.01 : -3.99, 0.42, 0.68, side > 0 ? Math.PI : 0);
  });
  // the lanterns' glow: one sprite each, one draw call
  const pts = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(Array.from({ length: 8 }, (_, i) => [8 + i * 2, 2.04, -3]).flat(), 3));
  const glow = new THREE.Points(pts, new THREE.PointsMaterial({ map: glowTexture(), color: 0xff5a2a, size: 1.1, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  glow.renderOrder = 2;
  root.add(glow);

  /* ---- shots: the tank's glass and the mirror; true = answered */
  R.onShot = (p, now) => {
    const k = R.koi;
    if (Math.abs(p.x - k.x) < 0.2 && Math.abs(p.y - k.y) < k.h / 2 && Math.abs(p.z - k.z) < k.w / 2) {
      // u runs with -z (the plane faces +x)
      k.tank.hit(0.5 - (p.z - k.z) / k.w, 0.5 + (p.y - k.y) / k.h, now);
      k.until = now + 40;
      sfx?.("shatter", p);
      return true;
    }
    const m = R.mirror;
    if (Math.abs(p.x - m.x) < 0.25 && Math.abs(p.y - m.y) < m.h / 2 + 0.05 && Math.abs(p.z - m.z) < m.w / 2 + 0.05) {
      if (!m.until) { m.smash(now); sfx?.("shatter", p); }
      return true;
    }
    return false;
  };
  ACTIVE = R;
  return R;
}

let ACTIVE = null;
const ACTIVE_CAM = new THREE.Vector3();

/* The map's onShot asks here first. */
export function roomsShot(p) {
  return !!ACTIVE?.onShot(p, performance.now() / 1000);
}

/* For the tests: where the shootable things are and how they stand. */
export function roomsDebug() {
  const R = ACTIVE;
  return R && { koi: { x: R.koi.x, y: R.koi.y, z: R.koi.z, cracked: R.koi.tank.cracked() }, mirror: { x: R.mirror.x, y: R.mirror.y, z: R.mirror.z, broken: !!R.mirror.until } };
}
