// Troll Forces — big outdoor video screens (doc docs/KABUKIGRIN.md 3.2):
// the kind over Times Square and the Shibuya scramble, playing short
// animated loops one after another with a two-frame white flash between.
//
// Each screen is one canvas texture, redrawn only when its frame changes
// (10 fps) and only while the screen is drawn (onBeforeRender), so it
// costs one small texture upload a tenth of a second and no light. Two
// screens on a map run `offset` seconds apart so they never show the same
// frame. The street's clips draw from the neon sign atlas
// (trollingloud-kit.js) and plain canvas shapes: nothing to download. The
// club's two inside play their own lists: the pole dancer (one cut-out PNG,
// spun in canvas) and @SwishPng's leaping trolls (a small muted MP4, drawn
// into the canvas so the LED rows and the credit sit on it).

import * as THREE from "three";
import { SIGNS, signsTexture } from "./trollingloud-kit.js?v=tl3-tc3-sh1-sr1-or1-tcs1-tx1";

const FPS = 10;
const FLASH = 2 / FPS;   // the white flash between clips
const JP = "'Hiragino Sans','Yu Gothic','Meiryo','Noto Sans JP','Noto Sans CJK JP',sans-serif";
const EN = "'DM Sans','Helvetica Neue',Arial,sans-serif";
const BEAT = 128 / 60;

const ease = (p) => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);
const atlas = () => signsTexture().image;

// the club screens' footage, fetched the first time a screen shows it
const TEX = new URL("../textures/", import.meta.url).href;
let dancer = null, leap = null;
const dancerImg = () => {
  if (!dancer) { dancer = new Image(); dancer.src = `${TEX}screen-pole-dancer.png`; }
  return dancer.complete && dancer.naturalWidth ? dancer : null;
};
const leapVideo = () => {
  if (!leap) {
    leap = Object.assign(document.createElement("video"), { src: `${TEX}screen-swish-leap.mp4`, muted: true, loop: true, playsInline: true, preload: "auto" });
    leap.setAttribute("muted", "");
  }
  if (leap.paused) leap.play().catch(() => {});
  return leap.readyState >= 2 ? leap : null;
};
// the dancer cut-out: where the pole ran through it (px), of its 434 x 296
const DANCER_POLE = 251.5;

/* Blit a sign from the atlas, centred on cx, cy, `h` tall. */
function blit(g, name, cx, cy, h, alpha = 1) {
  const [x0, y0, x1, y1] = SIGNS[name].r;
  const w = h * (x1 - x0) / (y1 - y0);
  g.globalAlpha = alpha;
  g.drawImage(atlas(), x0, y0, x1 - x0, y1 - y0, cx - w / 2, cy - h / 2, w, h);
  g.globalAlpha = 1;
  return w;
}

function glowText(g, text, x, y, size, color, { font = EN, weight = 800, blur = 0.25, align = "center", alpha = 1 } = {}) {
  g.save();
  g.globalAlpha = alpha;
  g.font = `${weight} ${size}px ${font}`;
  g.textAlign = align;
  g.textBaseline = "middle";
  g.shadowColor = color;
  g.shadowBlur = size * blur;
  g.fillStyle = color;
  g.fillText(text, x, y);
  g.shadowBlur = 0;
  g.fillStyle = "rgba(255,255,255,0.85)";
  g.globalAlpha = alpha * 0.55;
  g.fillText(text, x, y);
  g.restore();
}

function bg(g, w, h, top, bottom) {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, top);
  gr.addColorStop(1, bottom);
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
}

/* The clips: `s` seconds long, draw(g, w, h, t) with t seconds in. */
const CLIPS = [
  { id: "umad", s: 8, draw(g, w, h, t) {
    bg(g, w, h, "#12052a", "#2a0838");
    // rays turning behind the face
    g.save();
    g.translate(w * 0.3, h * 0.55);
    g.rotate(t * 0.35);
    for (let i = 0; i < 12; i++) {
      g.rotate(Math.PI / 6);
      g.fillStyle = i % 2 ? "rgba(255,63,180,0.16)" : "rgba(63,240,255,0.12)";
      g.beginPath(); g.moveTo(0, 0); g.lineTo(w, -h * 0.18); g.lineTo(w, h * 0.18); g.fill();
    }
    g.restore();
    const pop = ease(t / 0.8) * (1 + 0.05 * Math.sin(t * BEAT * Math.PI * 2));
    blit(g, "trollCyan", w * 0.3, h * 0.55, h * 0.8 * pop);
    const slide = ease((t - 0.9) / 0.6);
    blit(g, "umad", w * (1.2 - 0.5 * slide), h * 0.38, h * 0.3, slide);
    glowText(g, "problem?", w * 0.7, h * 0.74, h * 0.13, "#3fffc0", { alpha: ease((t - 2.2) / 0.5) });
  } },
  { id: "dj", s: 8, draw(g, w, h, t) {
    const kick = Math.exp(-((t * BEAT) % 1) * 4);
    bg(g, w, h, `rgb(${40 + 80 * kick | 0},4,${60 + 40 * kick | 0})`, "#08020e");
    // the equaliser
    const n = 32, bw = w / n;
    for (let i = 0; i < n; i++) {
      const v = 0.25 + 0.55 * Math.abs(Math.sin(i * 1.7 + t * 5.3)) * (0.5 + 0.5 * kick);
      g.fillStyle = i % 2 ? "#ff3fb4" : "#3ff0ff";
      g.globalAlpha = 0.5;
      g.fillRect(i * bw + 2, h * (1 - v * 0.55), bw - 4, h * v * 0.55);
    }
    g.globalAlpha = 1;
    glowText(g, "TONIGHT", w / 2, h * 0.2, h * 0.14, "#ffffff", { alpha: ease(t / 0.4) });
    blit(g, "dj", w / 2, h * 0.47, h * 0.3 * (1 + 0.04 * kick), ease((t - 0.3) / 0.5));
    glowText(g, "TROLLING LOUD 東京", w / 2, h * 0.78, h * 0.1, "#ffb02e", { font: JP, alpha: ease((t - 1) / 0.5) });
  } },
  { id: "stickers", s: 9, draw(g, w, h, t) {
    bg(g, w, h, "#101418", "#1c1c1e");
    g.strokeStyle = "rgba(255,255,255,0.06)";
    g.lineWidth = 1;
    for (let x = 0; x < w; x += h / 10) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y < h; y += h / 10) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    glowText(g, "TROLL RUNNER", w * 0.05, h * 0.16, h * 0.12, "#ffffff", { align: "left", alpha: ease(t / 0.4) });
    glowText(g, "stickers dropped across the Inland Empire", w * 0.05, h * 0.29, h * 0.06, "#c8c8d0", { align: "left", weight: 500, blur: 0.1, alpha: ease((t - 0.3) / 0.4) });
    // the cities, one pin each as the run goes by
    const PINS = [["Fontana", "#5856d6", 0.32, 0.5], ["Rialto", "#ff2d55", 0.44, 0.42], ["Rancho Cucamonga", "#ff9500", 0.22, 0.62], ["Chino Hills", "#007aff", 0.14, 0.82], ["Riverside", "#34c759", 0.56, 0.78]];
    // the route between them
    g.strokeStyle = "rgba(255,255,255,0.35)";
    g.setLineDash([h * 0.02, h * 0.02]);
    g.lineWidth = Math.max(2, h * 0.008);
    g.beginPath();
    PINS.forEach(([, , px, py], i) => { if (t > 1 + i * 1.1) (i ? g.lineTo : g.moveTo).call(g, w * px, h * py); });
    g.stroke();
    g.setLineDash([]);
    PINS.forEach(([name, col, px, py], i) => {
      const p = ease((t - 1 - i * 1.1) / 0.35);
      if (p <= 0) return;
      const x = w * px, y = h * py, r = h * 0.035 * p;
      g.fillStyle = col;
      g.shadowColor = col; g.shadowBlur = h * 0.04;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.shadowBlur = 0;
      glowText(g, name, x + h * 0.06, y, h * 0.055, col, { align: "left", weight: 700, blur: 0.15, alpha: p });
    });
    glowText(g, "u mad you missed one?", w * 0.95, h * 0.9, h * 0.065, "#ffb02e", { align: "right", alpha: ease((t - 6.8) / 0.5) });
  } },
  { id: "ticker", s: 8, draw(g, w, h, t) {
    bg(g, w, h, "#03100a", "#061a10");
    // candles marching left
    const cw = h * 0.05, n = Math.ceil(w / (cw * 1.6)) + 2;
    const off = (t * cw * 1.6 * 2.5) % (cw * 1.6);
    let price = 0.5;
    for (let i = 0; i < n; i++) {
      const k = i + Math.floor(t * 2.5);
      const rnd = (s) => { const v = Math.sin(k * 12.9898 + s * 78.233) * 43758.5453; return v - Math.floor(v); };
      const up = rnd(1) > 0.28;
      const body = (0.04 + rnd(2) * 0.1) * h;
      price += (up ? 1 : -1) * body / h * 0.35;
      const yMid = h * (0.92 - ((price + k * 0.006) % 0.5) * 1.2);
      const x = i * cw * 1.6 - off;
      g.fillStyle = up ? "#3aff7a" : "#ff3a5a";
      g.fillRect(x + cw / 2 - 1, yMid - body * 0.9, 2, body * 1.8);
      g.fillRect(x, yMid - body / 2, cw, body);
    }
    g.fillStyle = "rgba(0,0,0,0.55)";
    g.fillRect(0, 0, w, h * 0.3);
    const pct = (4.2 + 0.7 * Math.sin(t * 1.3)).toFixed(2);
    glowText(g, "$TROLL", w * 0.05, h * 0.15, h * 0.15, "#3aff7a", { align: "left" });
    glowText(g, `▲ ${pct}%`, w * 0.95, h * 0.15, h * 0.13, "#3aff7a", { align: "right" });
    // the crawl along the bottom
    g.fillStyle = "#0a0a0a";
    g.fillRect(0, h * 0.86, w, h * 0.14);
    const crawl = "  $TROLL ▲ green candles only   ·   jeets ▼   ·   trolls ▲   ·   number go up   ·   ";
    g.font = `700 ${h * 0.08}px ${EN}`;
    const cwid = g.measureText(crawl).width;
    g.fillStyle = "#ffd84a";
    g.textBaseline = "middle";
    g.textAlign = "left";
    for (let x = -((t * h * 0.5) % cwid); x < w; x += cwid) g.fillText(crawl, x, h * 0.93);
  } },
  { id: "logo", s: 6, draw(g, w, h, t) {
    g.fillStyle = "#000";
    g.fillRect(0, 0, w, h);
    const kanji = "歌舞伎グリン";
    const n = Math.min(kanji.length, Math.floor(t / 0.22));
    glowText(g, kanji.slice(0, n), w / 2, h * 0.38, h * 0.26, "#ff3fb4", { font: JP, weight: 900 });
    // the name wipes in, split pink and cyan, then settles
    const p = ease((t - 1.6) / 0.5);
    if (p > 0) {
      const jit = (1 - p) * h * 0.05 + (Math.sin(t * 40) > 0.97 ? h * 0.02 : 0);
      g.save();
      g.beginPath(); g.rect(0, 0, w * p, h); g.clip();
      glowText(g, "KABUKIGRIN", w / 2 - jit, h * 0.74, h * 0.17, "#3ff0ff", { weight: 900 });
      glowText(g, "KABUKIGRIN", w / 2 + jit, h * 0.74, h * 0.17, "#ff3fb4", { weight: 900, alpha: 0.6 });
      g.restore();
    }
  } },
  // the club's: a trollface spinning round a green neon pole in space
  // (ref refs/club-screen-pole-dance-ref.webp), a turn every 4 s, behind
  // the pole for half of it
  { id: "pole", s: 12, draw(g, w, h, t) {
    g.fillStyle = "#000";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 150; i++) {
      const r = (k) => { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
      const depth = 0.3 + r(3) * 0.7, s = Math.max(1, h * 0.005 * depth);
      g.globalAlpha = (0.3 + 0.6 * depth) * (0.75 + 0.25 * Math.sin(t * (1 + r(4) * 3) + i));
      g.fillStyle = "#fff";
      g.fillRect((((r(1) - t * 0.015 * depth) % 1) + 1) % 1 * w, r(2) * h, s, s);
    }
    g.globalAlpha = 1;
    const px = w / 2, kick = Math.exp(-((t * BEAT) % 1) * 4);
    const pole = () => {
      g.save();
      g.shadowColor = "#3aff4a";
      g.shadowBlur = h * (0.06 + 0.05 * kick);
      g.fillStyle = "#3aff4a";
      g.fillRect(px - h * 0.022, 0, h * 0.044, h);
      g.shadowBlur = 0;
      g.fillStyle = "#e0ffe0";
      g.fillRect(px - h * 0.007, 0, h * 0.014, h);
      g.restore();
    };
    const img = dancerImg();
    const spin = t * Math.PI / 2, front = Math.sin(spin) >= 0;
    if (front) pole();
    if (img) {
      const dh = h * 0.86, k = dh / img.height;
      g.save();
      g.translate(px, h * (0.5 + 0.02 * Math.sin(spin * 2)));
      // (edge on, still a sliver of it)
      const c = Math.cos(spin);
      g.scale(Math.sign(c || 1) * Math.max(0.12, Math.abs(c)), 1);
      g.globalAlpha = front ? 1 : 0.8;
      g.drawImage(img, -DANCER_POLE * k, -dh / 2, img.width * k, dh);
      g.restore();
    }
    if (!front) pole();
  } },
  // the club's other: @SwishPng's leaping trolls on the beach, as it is
  { id: "swish", s: 22, draw(g, w, h) {
    g.fillStyle = "#000";
    g.fillRect(0, 0, w, h);
    const v = leapVideo();
    if (v) g.drawImage(v, 0, 0, w, h);
    glowText(g, "art @SwishPng", w * 0.97, h * 0.92, h * 0.05, "#ffffff", { align: "right", weight: 700, blur: 0.15, alpha: 0.8 });
  } },
];
// what the street's screens play
const STREET = ["umad", "dj", "stickers", "ticker", "logo"];

/* Which of `list`'s clips, and how far in, `t` seconds into the loop; null
   in a flash (a one-clip list just loops, no flash). */
function clipAt(list, t) {
  const gap = list.length > 1 ? FLASH : 0;
  const loop = list.reduce((n, c) => n + c.s + gap, 0);
  let u = ((t % loop) + loop) % loop;
  for (const c of list) {
    if (u < c.s) return { c, t: u };
    u -= c.s;
    if (u < gap) return null;
    u -= gap;
  }
  return null;
}

/* A screen `w` x `h` metres at x, y, z (its centre), facing `ry`, drawn
   at `px` [width, height] pixels, `offset` seconds into the loop. With a
   black bezel `frame` metres deep behind it (or, set into a wall, a flat
   black surround `inset` metres wide), playing the `clips` (ids; the
   street's list by default) at `fps`. Returns the group. */
export function videoScreen({ w, h, px, x, y, z, ry = 0, offset = 0, frame = 0.25, inset = 0, clips = STREET, fps = FPS }) {
  const list = clips.map((id) => CLIPS.find((c) => c.id === id));
  const c = document.createElement("canvas");
  [c.width, c.height] = px;
  const g = c.getContext("2d");
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map, toneMapped: false, color: 0xe8e8e8 }));
  screen.name = "video-screen";
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = ry;
  group.add(screen);
  if (frame) {
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, h + 0.3, frame), new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.4, metalness: 0.6 }));
    bezel.position.z = -frame / 2 - 0.01;
    bezel.castShadow = false;
    group.add(bezel);
  }
  if (inset) {
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(w + inset * 2, h + inset * 2), new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.5, metalness: 0.3 }));
    edge.position.z = -0.01;
    group.add(edge);
  }
  let shown = -1;
  const draw = (t) => {
    const at = clipAt(list, t);
    if (!at) { g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); return; }
    g.save();
    at.c.draw(g, c.width, c.height, at.t);
    g.restore();
    // the LED grid: faint dark rows
    g.fillStyle = "rgba(0,0,0,0.18)";
    for (let yy = 0; yy < c.height; yy += 3) g.fillRect(0, yy, c.width, 1);
  };
  screen.onBeforeRender = () => {
    const t = performance.now() / 1000 + offset;
    const f = Math.floor(t * fps);
    if (f === shown) return;
    shown = f;
    draw(f / fps);
    map.needsUpdate = true;
  };
  draw(offset);
  return group;
}

// for the clip review page and tests
export const VIDEO_CLIPS = CLIPS.map((c) => ({ id: c.id, s: c.s }));
export function drawClipFrame(g, w, h, id, t) { CLIPS.find((c) => c.id === id).draw(g, w, h, t); }
