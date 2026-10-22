// Troll Forces — Kabukigrin's street pieces (doc docs/KABUKIGRIN.md 3.5
// a, e, f; phase 6). Their frames are Studio's (kb-town.glb); what's drawn
// here is what Studio can't hold:
//   the pachinko parlour on A Main's west wall, across the line from the
//   club: the machine floor through its glass (rows of cabinets, their
//   screens and lamps flickering, the balls falling), the steady red and
//   white sign on its box, the white spill on the pavement; its sound
//   (streetSound), the balls' rattle and the machines' jingles out of the
//   glass, fighting the club's bass across the line.
//   B side's street props: the ramen stall's noren, menu and warm light.

import * as THREE from "three";
import { place } from "./trollcity-kit.js?v=tc2-wst-tc3-sh1-sr1-pf1-or1-tcs1-tx1-ch1";
import { U, neonMat } from "./trollingloud-kit.js?v=tl3-tc3-sh1-sr1-or1-tcs1-tx1-ch1";

const canvas = (w, h) => {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
};
// a seeded random, so every build draws the same floor
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const JP = "'Hiragino Sans','Yu Gothic','Meiryo','Noto Sans JP','Noto Sans CJK JP',sans-serif";

/* The parlour as built in Studio (Kabukigrin_Live.Pachinko): the glass
   between the plinth and the header (its LED ticker), x -31.6, the
   sliding doors at z -15.25, the sign box's face at x -31.02. */
export const PACHINKO = { x: -31.6, z0: -24.15, z1: -6.35, door: -15.25, doorW: 3.24, y0: 0.28, y1: 2.74, ticker: { x: -31.195, y0: 2.82, y1: 3.22 }, sign: { x: -31.015, y0: 3.63, y1: 5.25, z0: -24.5, z1: -6 } };

/* ------------------------------------------------------------ the floor */

// one tile of the machine floor, TILE m wide: eight cabinets in a row
// facing the street, a dimmer row past them, the ceiling's light strips
// and the red carpet; their screens, top lamps and balls are redrawn live
const TILE = 4.0, PX = 256;   // px a metre
const HUES = ["#ff2a6a", "#3ff0ff", "#ffd23a", "#7aff5a", "#b070ff", "#ff8a2a"];
function machineFloor() {
  const W = TILE * PX, H = Math.round((PACHINKO.y1 - PACHINKO.y0) * PX);
  const r = rng(41);
  const back = canvas(W, H), b = back.getContext("2d");
  // the room: a bright ceiling, mirror-panelled walls, the carpet
  const wall = b.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, "#d8ccd0");
  wall.addColorStop(0.16, "#a89aa4");
  wall.addColorStop(0.55, "#5a3a50");
  wall.addColorStop(1, "#2a0c18");
  b.fillStyle = wall;
  b.fillRect(0, 0, W, H);
  for (let i = 0; i < 6; i++) { b.fillStyle = "rgba(255,250,245,.9)"; b.fillRect(i * W / 6 + 30, 8, W / 6 - 60, 9); }
  b.fillStyle = "rgba(255,240,250,.35)";
  for (let i = 0; i < 9; i++) b.fillRect(i * W / 9 + 18, 46, W / 9 - 36, 6);
  // the far row: small, dim, the same bright tops
  const far = { y: H * 0.2, h: H * 0.28, w: W / 14 };
  for (let i = 0; i < 14; i++) {
    const x = i * far.w;
    b.fillStyle = "#3a2a34"; b.fillRect(x + 4, far.y, far.w - 8, far.h);
    b.fillStyle = HUES[i % HUES.length]; b.globalAlpha = 0.55; b.fillRect(x + 10, far.y + far.h * 0.32, far.w - 20, far.h * 0.3); b.globalAlpha = 1;
    b.fillStyle = "#fff3c0"; b.fillRect(x + 6, far.y, far.w - 12, 7);
  }
  // the carpet: red, a gold diamond
  b.fillStyle = "#6a0c1c"; b.fillRect(0, H * 0.9, W, H * 0.1);
  b.strokeStyle = "rgba(230,180,80,.35)"; b.lineWidth = 2;
  for (let x = -40; x < W + 40; x += 40) { b.beginPath(); b.moveTo(x, H); b.lineTo(x + 20, H * 0.9); b.lineTo(x + 40, H); b.stroke(); }

  // the near row: eight cabinets, chrome and gold, each a ball field over a
  // screen over the tray
  const cab = { w: W / 8, y: H * 0.17, h: H * 0.74 };
  const cabs = [];
  for (let i = 0; i < 8; i++) {
    const x = i * cab.w, hue = HUES[(i * 5) % HUES.length];
    const g = b.createLinearGradient(x, 0, x + cab.w, 0);
    g.addColorStop(0, "#9aa0b0"); g.addColorStop(0.06, "#2a2430"); g.addColorStop(0.5, "#4a3a4a"); g.addColorStop(0.94, "#2a2430"); g.addColorStop(1, "#9aa0b0");
    b.fillStyle = g; b.fillRect(x + 6, cab.y, cab.w - 12, cab.h);
    // the colour trim down both sides and the gold band under the lamp
    b.fillStyle = hue; b.globalAlpha = 0.8;
    b.fillRect(x + 10, cab.y + 8, 6, cab.h * 0.7); b.fillRect(x + cab.w - 16, cab.y + 8, 6, cab.h * 0.7);
    b.globalAlpha = 1;
    b.fillStyle = "#c8a040"; b.fillRect(x + 6, cab.y + cab.h * 0.06, cab.w - 12, 5);
    // the ball field: a round window of pins
    const fx = x + cab.w / 2, fy = cab.y + cab.h * 0.3, fr = cab.w * 0.38;
    b.fillStyle = "#e8f0ff"; b.beginPath(); b.arc(fx, fy, fr + 5, 0, 7); b.fill();
    b.fillStyle = "#1a2a4a"; b.beginPath(); b.arc(fx, fy, fr, 0, 7); b.fill();
    b.fillStyle = "rgba(220,230,255,.8)";
    for (let k = 0; k < 40; k++) { const a = r() * 7, d = Math.sqrt(r()) * fr * 0.9; b.fillRect(fx + Math.cos(a) * d, fy + Math.sin(a) * d, 2, 2); }
    // the tray and the handle
    b.fillStyle = "#2a2a30"; b.fillRect(x + 12, cab.y + cab.h * 0.74, cab.w - 24, cab.h * 0.08);
    b.fillStyle = "#c0c4cc";
    for (let k = 0; k < 14; k++) { b.beginPath(); b.arc(x + 20 + r() * (cab.w - 40), cab.y + cab.h * 0.77, 3, 0, 7); b.fill(); }
    b.fillStyle = "#1a1a1a"; b.beginPath(); b.arc(x + cab.w * 0.8, cab.y + cab.h * 0.88, 9, 0, 7); b.fill();
    cabs.push({ x, fx, fy, fr, hue, ph: r() * 7, sp: 0.6 + r() * 0.8, balls: Array.from({ length: 5 }, () => ({ a: r() * 7, d: r(), v: 0.4 + r() * 0.5 })) });
  }
  // players on their stools: the back of a head and shoulders, here and there
  for (const i of [1, 4, 6]) {
    const x = i * cab.w + cab.w / 2, y = H;
    b.fillStyle = "#120a10";
    b.beginPath(); b.ellipse(x, y, cab.w * 0.44, H * 0.16, 0, Math.PI, 0); b.fill();
    b.fillRect(x - cab.w * 0.07, y - H * 0.2, cab.w * 0.14, H * 0.06);
    b.beginPath(); b.ellipse(x, y - H * 0.25, cab.w * 0.15, cab.w * 0.18, 0, 0, 7); b.fill();
  }
  // the glass: a cool sheen down from the top, two streaks across it
  b.globalCompositeOperation = "lighter";
  const gl = b.createLinearGradient(0, 0, 0, H);
  gl.addColorStop(0, "rgba(120,140,170,.18)"); gl.addColorStop(0.4, "rgba(0,0,0,0)");
  b.fillStyle = gl; b.fillRect(0, 0, W, H);
  b.fillStyle = "rgba(200,220,255,.07)";
  for (const s of [0.18, 0.62]) { b.beginPath(); b.moveTo(W * s, 0); b.lineTo(W * s + 90, 0); b.lineTo(W * s - 60, H); b.lineTo(W * s - 150, H); b.fill(); }
  b.globalCompositeOperation = "source-over";

  const c = canvas(W, H), g = c.getContext("2d");
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  let last = -1;
  function draw(now) {
    if (now - last < 0.125) return;   // 8 fps is plenty through glass
    last = now;
    g.drawImage(back, 0, 0);
    for (const m of cabs) {
      const sy = cab.y + cab.h * 0.5, sw = cab.w - 30, sh = cab.h * 0.2;
      // the screen: a colour that runs round, the reels, a flash now and then
      const t = now * m.sp + m.ph, flash = Math.sin(t * 3) > 0.92;
      g.fillStyle = flash ? "#ffffff" : HUES[Math.floor(t) % HUES.length];
      g.fillRect(m.x + 15, sy, sw, sh);
      g.fillStyle = "rgba(0,0,0,.45)"; g.fillRect(m.x + 15, sy + sh * 0.25, sw, sh * 0.5);
      g.fillStyle = "#fff"; g.font = `900 ${Math.round(sh * 0.42)}px ${JP}`; g.textAlign = "center"; g.textBaseline = "middle";
      const reel = (k) => (Math.floor(t * 4 + k * 1.7) % 9) + 1;
      g.fillText(flash ? "777" : `${reel(0)}${reel(1)}${reel(2)}`, m.x + cab.w / 2, sy + sh / 2);
      // the top lamp
      g.fillStyle = Math.sin(t * 5) > 0 ? m.hue : "#fff3c0";
      g.fillRect(m.x + 10, cab.y - 10, cab.w - 20, 12);
      // the balls, falling through the pins
      g.fillStyle = "#f4f6ff";
      for (const ball of m.balls) {
        const d = (ball.d + now * ball.v) % 1;
        const bx = m.fx + Math.sin(ball.a + d * 9) * m.fr * 0.5, by = m.fy - m.fr * 0.85 + d * m.fr * 1.7;
        g.beginPath(); g.arc(bx, by, 3.5, 0, 7); g.fill();
      }
    }
    tex.needsUpdate = true;
  }
  draw(0);
  return { tex, draw };
}

/* ------------------------------------------------------------ the sign */

// the box's face: red, lit from inside, white katakana in the middle, the
// hall's name in gold to the left, the slots to the right; steady
function signTexture(w, h) {
  const H = 256, W = Math.round(H * w / h);
  const c = canvas(W, H), g = c.getContext("2d");
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#ff3a3a"); bg.addColorStop(0.5, "#d81424"); bg.addColorStop(1, "#8a0612");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // the panel seams and a white rule top and bottom
  g.fillStyle = "rgba(60,0,8,.45)";
  for (let x = W / 8; x < W; x += W / 8) g.fillRect(x - 2, 0, 4, H);
  g.fillStyle = "#fff4f4"; g.fillRect(0, 14, W, 6); g.fillRect(0, H - 20, W, 6);
  g.textAlign = "center"; g.textBaseline = "middle";
  const glow = (text, x, size, fill, halo) => {
    g.font = `900 ${size}px ${JP}`;
    g.shadowColor = halo; g.shadowBlur = size * 0.25;
    g.fillStyle = fill; g.fillText(text, x, H / 2 + size * 0.04);
    g.shadowBlur = 0;
  };
  glow("パチンコ", W / 2, 168, "#ffffff", "#ffd0d0");
  glow("グリン会館", W * 0.15, 120, "#ffd46a", "#ffb030");
  glow("SLOT 777", W * 0.85, 118, "#ffffff", "#ffd46a");
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

// the header's LED ticker: red dot-matrix text that scrolls left (the
// texture's offset; drawn once)
const TICK = ["新台入替", "本日10時開店", "GRIN GRIN 777", "大当たり連発", "全台フィーバー"];
function tickerTexture() {
  const H = 64, W = 2048;
  const txt = canvas(W, H), t = txt.getContext("2d");
  t.fillStyle = "#000"; t.fillRect(0, 0, W, H);
  t.font = `900 44px ${JP}`; t.textBaseline = "middle"; t.fillStyle = "#fff";
  let x = 30;
  for (const s of TICK) { t.fillText(s, x, H / 2 + 2); x += t.measureText(s).width + 120; }
  // to dots: each 4 px cell lit or not, red, a faint unlit grid between
  const c = canvas(W, H), g = c.getContext("2d");
  g.fillStyle = "#0a0204"; g.fillRect(0, 0, W, H);
  const d = t.getImageData(0, 0, W, H).data;
  for (let y = 0; y < H; y += 4) for (let xx = 0; xx < W; xx += 4) {
    const on = d[((y + 2) * W + xx + 2) * 4] > 100;
    g.fillStyle = on ? "#ff3a2a" : "#2a0608";
    g.beginPath(); g.arc(xx + 2, y + 2, 1.5, 0, 7); g.fill();
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.anisotropy = 4;
  return map;
}

/* ------------------------------------------------------------ build */

/* ------------------------------------------------------------ B side */

/* The ramen stall on the konbini's blank north wall (3.5 e), as built in
   Studio (Kabukigrin_Live.BStreet.Ramen): the boards at z 30.94, the
   counter to 1.02, the noren's rod at y 2.22, z 30.34, a lantern at each
   end; the tanuki by the koban and the capsule toys by B Main's vending
   machines are Studio's generated props. */
export const RAMEN = { x0: 19.05, x1: 22.95, wall: 30.935, rod: { y: 2.2, z: 30.31 }, lanterns: [[18.95, 1.95, 30.4], [23.05, 1.95, 30.4]] };
const SERIF = "'Hiragino Mincho ProN','Yu Mincho','Noto Serif JP',serif";

// indigo cotton in four panels, slit to just under the rod, らーめん in
// white across them, a white band at the hem
function norenTexture(n) {
  const W = 1024, H = 128 * 2.4 | 0;
  const c = canvas(W, H), g = c.getContext("2d");
  g.clearRect(0, 0, W, H);
  const pw = W / n;
  for (let i = 0; i < n; i++) {
    const x = i * pw + 3;
    const cloth = g.createLinearGradient(0, 0, 0, H);
    cloth.addColorStop(0, "#1a2a5a"); cloth.addColorStop(1, "#14224a");
    g.fillStyle = cloth; g.fillRect(x, 0, pw - 6, H);
    // the weave and a fold shadow down each panel
    g.fillStyle = "rgba(0,0,0,.16)"; g.fillRect(x + pw * 0.62, 0, pw * 0.12, H);
    g.fillStyle = "rgba(255,255,255,.85)"; g.fillRect(x, H - 22, pw - 6, 8);
  }
  g.fillStyle = "#f4f0e6"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = `700 ${Math.round(H * 0.46)}px ${SERIF}`;
  ["ら", "ー", "め", "ん"].forEach((ch, i) => {
    if (ch === "ー") { g.fillRect((i + 0.5) * pw - H * 0.17, H * 0.43, H * 0.34, H * 0.06); return; }
    g.fillText(ch, (i + 0.5) * pw, H * 0.45);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// the menu: paper tags pinned in a row on the boards, brushed black
// with the price in red
const MENU = [["醤油", "800"], ["味噌", "850"], ["塩", "800"], ["豚骨", "900"], ["替玉", "150"], ["餃子", "400"], ["ビール", "600"]];
function menuTexture() {
  const W = 1024, H = 256, n = MENU.length, tw = W / n;
  const c = canvas(W, H), g = c.getContext("2d");
  g.clearRect(0, 0, W, H);
  const r = rng(5);
  MENU.forEach(([name, yen], i) => {
    const x = i * tw + 8, tilt = (r() - 0.5) * 0.05;
    g.save(); g.translate(x + tw / 2 - 8, H / 2); g.rotate(tilt);
    g.fillStyle = "#efe6cc"; g.fillRect(-tw / 2 + 8, -H / 2 + 6, tw - 16, H - 12);
    g.fillStyle = "rgba(90,60,20,.14)"; g.fillRect(-tw / 2 + 8, H / 2 - 30, tw - 16, 24);
    g.fillStyle = "#151515"; g.textAlign = "center"; g.textBaseline = "top";
    const chars = [...name], size = Math.min(56, (H - 90) / chars.length);
    g.font = `700 ${size}px ${SERIF}`;
    chars.forEach((ch, k) => g.fillText(ch, 0, -H / 2 + 20 + k * size));
    g.fillStyle = "#b8141c"; g.font = `700 30px ${JP}`; g.textBaseline = "bottom";
    g.fillText(yen, 0, H / 2 - 14);
    g.restore();
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function buildRamen(root, N, M) {
  const R = RAMEN, w = R.x1 - R.x0, cx = (R.x0 + R.x1) / 2;
  // the noren off the rod, facing the plaza (-z), lit from the stall behind
  const nh = 0.48;
  root.add(new THREE.Mesh(place(new THREE.PlaneGeometry(w, nh), { x: cx, y: R.rod.y - nh / 2, z: R.rod.z, ry: Math.PI }),
    new THREE.MeshStandardMaterial({ map: norenTexture(4), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.95, emissive: 0x18203a, emissiveIntensity: 0.6 })));
  // the menu tags over the counter
  root.add(new THREE.Mesh(place(new THREE.PlaneGeometry(2.9, 0.62), { x: cx, y: 1.62, z: R.wall - 0.006, ry: Math.PI }),
    new THREE.MeshStandardMaterial({ map: menuTexture(), transparent: true, alphaTest: 0.5, roughness: 0.9, emissive: 0xffe0b0, emissiveMap: null, emissiveIntensity: 0.12 })));
  // the warm light of the stall: up the boards, over the counter, a pool
  // in front, and each lantern's halo (steady)
  N.quad(M.neonHalo, cx, 1.35, R.wall - 0.01, w + 0.6, 2.2, { ry: Math.PI, color: 0xffb070, k: 0.18, beat: 0 });
  N.quad(M.neonHalo, cx, 0.02, R.wall - 1.3, w + 1.2, 2.6, { rx: -Math.PI / 2, color: 0xffa060, k: 0.16, beat: 0 });
  for (const [x, y, z] of R.lanterns) N.quad(M.neonHalo, x, y, z - 0.18, 0.9, 0.9, { ry: Math.PI, color: 0xff5a30, k: 0.35, beat: 0 });
}

export function buildStreet({ root, N, M }) {
  buildRamen(root, N, M);
  const P = PACHINKO;
  // the floor through the glass, either side of the doors, and through the
  // doors' own glass; each run picks up the tile where the last left off
  const floor = machineFloor();
  const glass = new THREE.MeshBasicMaterial({ map: floor.tex, color: 0xb4b0b0, toneMapped: false });
  const runs = [[P.z0, P.door - P.doorW / 2], [P.door - P.doorW / 2 + 0.17, P.door + P.doorW / 2 - 0.17], [P.door + P.doorW / 2, P.z1]];
  for (const [z0, z1] of runs) {
    const w = z1 - z0, geo = new THREE.PlaneGeometry(w, P.y1 - P.y0);
    // (turned to face the street, the plane's u runs from z1 towards z0)
    const uv = geo.attributes.uv, u0 = (P.z1 - z1) / TILE;
    for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + uv.getX(i) * w / TILE);
    const m = new THREE.Mesh(place(geo, { x: P.x + 0.012, y: (P.y0 + P.y1) / 2, z: (z0 + z1) / 2, ry: Math.PI / 2 }), glass);
    m.onBeforeRender = () => floor.draw(performance.now() / 1000);
    root.add(m);
  }
  // the ticker along the header, scrolling at a walk
  const T = P.ticker, tw = P.z1 - P.z0 + 1.4, th = T.y1 - T.y0, tick = tickerTexture();
  tick.repeat.x = tw / (th * 2048 / 64);
  const tm = new THREE.Mesh(place(new THREE.PlaneGeometry(tw, th), { x: T.x, y: (T.y0 + T.y1) / 2, z: (P.z0 + P.z1) / 2, ry: Math.PI / 2 }), new THREE.MeshBasicMaterial({ map: tick, color: 0xd0d0d0, toneMapped: false }));
  tm.onBeforeRender = () => { tick.offset.x = (performance.now() / 1000 * 0.9 / (th * 2048 / 64)) % 1; };
  root.add(tm);
  // the sign, steady (no beat: the street's neon is calm)
  const S = P.sign, sw = S.z1 - S.z0, sh = S.y1 - S.y0;
  N.quad(neonMat({ map: signTexture(sw, sh), key: "kb-pachinko" }), S.x, (S.y0 + S.y1) / 2, (S.z0 + S.z1) / 2, sw, sh, { ry: Math.PI / 2, k: 1.05, beat: 0 });
  // the white spill on the wet pavement, and a strip of it up the glass
  N.quad(M.neonHalo, -30.4, 0.02, (P.z0 + P.z1) / 2, 2.8, P.z1 - P.z0 + 1, { rx: -Math.PI / 2, color: 0xfff2ea, k: 0.16, beat: 0 });
  N.quad(M.neonHalo, -30.6, 0.025, P.door, 2.2, 3.6, { rx: -Math.PI / 2, color: 0xffe8f0, k: 0.12, beat: 0 });
}

/* ------------------------------------------------------------ sound */

// The parlour's din, each frame of a live map: rattles from along the
// glass (more the nearer you are), a jingle every few seconds; each one
// a panned one-shot from the club's own sfx, so it sits in the street
const HEAR = 24;
let nextBalls = 0, nextJingle = 0;
export function streetSound(sfx, live) {
  if (!live || !sfx) return;
  const P = PACHINKO, cam = U.uPlayer.value;
  const z = Math.min(P.z1, Math.max(P.z0, cam.z)), d = Math.hypot(cam.x - P.x, cam.z - z);
  const now = performance.now() / 1000;
  if (d > HEAR) { nextBalls = nextJingle = now; return; }
  const at = () => ({ x: P.x + 0.3, y: 1.1 + Math.random() * 0.8, z: P.z0 + Math.random() * (P.z1 - P.z0) });
  // (a few at most after a stall, never a burst)
  if (nextBalls < now - 0.5) nextBalls = now;
  while (nextBalls < now) { sfx("balls", at()); nextBalls += 0.06 + Math.random() * 0.14; }
  if (nextJingle < now) { sfx("jingle", at()); nextJingle = now + 3 + Math.random() * 5; }
}
