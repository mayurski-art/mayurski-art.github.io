// Troll Forces — Kabukigrin's street pieces (doc docs/KABUKIGRIN.md 3.5
// a, e, f; phase 6). Their frames are Studio's (kb-town.glb); what's drawn
// here is what Studio can't hold:
//   the pachinko parlour on A Main's west wall, across the line from the
//   club: the machine floor through its glass (Blender's room, lit from
//   inside, its screens running: lightParlour), the steady red and
//   white sign on its box, the white spill on the pavement; its sound
//   (streetSound), the balls' rattle and the machines' jingles out of the
//   glass, fighting the club's bass across the line.
//   B side's street props: the ramen stall's noren, menu and warm light;
//   a glazed tanuki by the koban's door; a capsule-toy rack beside B
//   Main's vending machine. A band poster on A Main's vending machine.
//   None has a collider (doc 3.5 e: no colliders over 0.6 m), so no route
//   changes.

import * as THREE from "three";
import { place } from "./trollcity-kit.js?v=tc2-wst-tc3-sh1-sr1-pf1-or1-tcs1-tx1-ch1-sp1-kbt1";
import { U, neonMat } from "./trollingloud-kit.js?v=tl3-tc3-sh1-sr1-or1-tcs1-tx1-ch1-sp1-kbt1";

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

/* ------------------------------------------------------------ inside

   In Socialize you walk in (user, 2026-10-24: "the pachinko should be
   playable and npcs and users should be able to enter in and out of its
   building"): the room Blender builds behind the glass (kb_street.py
   PARLOUR, the same numbers), its floor a step up, six islands of eight
   machines, a stool at each. Its colliders replace the layout's edge wall
   and the front's box there; the doorway keeps one (`pachinkoDoor`), so in
   versus and S&D the doors stay shut and A Main plays as it always has.
   modes/social-pachinko.js takes it away, widens the bounds over the room
   (`minX`), slides the doors open and says who's playing which machine. */
export const PARLOUR = { front: -31.72, back: -35.6, z0: -24.15, z1: -6.35, floor: 0.28, door: [-16.87, -13.63], minX: -36.0,
  islands: [-21.85, -19.55, -17.25, -12.65, -10.35, -8.05] };
// each machine: its screen (x, z), which way it faces (s: +-z), its stool's z
export const MACHINES = [];
for (const zi of PARLOUR.islands) for (const s of [-1, 1]) for (let j = 0; j < 4; j++) MACHINES.push({ x: -32.6 - (j + 0.5) * 0.55, z: zi + s * 0.423, s, stool: zi + s * 0.8 });

// the layout's two colliders the room opens: the west edge wall, the front's box
export const parlourWall = ([x, z, w, d, h]) => (x === -32.1 && w === 0.8 && h === 8) || (x === -31.46 && z === -15.25);
export function parlourColliders(api) {
  const P = PARLOUR, [d0, d1] = P.door;
  const box = (x0, x1, z0, z1, h, y = 0, pen = 20) => api.ghostBox((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, h, { y, pen });
  // the edge wall either side of the room, and over it
  box(-32.5, -31.7, -42.5, P.z0 - 0.3, 8);
  box(-32.5, -31.7, P.z1 + 0.3, 42.5, 8);
  box(-32.5, -31.7, P.z0 - 0.3, P.z1 + 0.3, 4.8, 3.2);
  // the front: glass either side of the doors, the header over them, the step in
  box(P.front, -31.2, -24.6, d0, 3.5);
  box(P.front, -31.2, d1, -5.9, 3.5);
  box(P.front, -31.2, d0, d1, 0.92, 2.58);
  box(P.front, -31.2, d0, d1, P.floor);
  // the room: its floor, back and end walls, the islands
  box(P.back, P.front, P.z0, P.z1, P.floor);
  box(P.back - 0.3, P.back, P.z0 - 0.3, P.z1 + 0.3, 3.2);
  box(P.back - 0.3, P.front, P.z0 - 0.3, P.z0, 3.2);
  box(P.back - 0.3, P.front, P.z1, P.z1 + 0.3, 3.2);
  for (const zi of P.islands) box(-34.8, -32.6, zi - 0.45, zi + 0.45, 2.0, P.floor, 4);
  // the doors, shut (Socialize opens them); a fresh build plays nothing
  Object.assign(PLAY, { open: false, mine: -1, onJackpot: null });
  PLAY.others.clear();
  PLAY.jack.clear();
  const door = box(P.front, -31.2, d0, d1, 2.3, P.floor, 6);
  door.pachinkoDoor = true;
  return door;
}

// Who's playing: `open` (the doors), `mine` (our machine), `others` (the
// room's players and the NPCs at machines); `onJackpot` our hit's banner.
// The screens read uPlay: a machine in play spins faster, a hit runs the
// rainbow for 4 s.
export const PLAY = { open: false, mine: -1, others: new Set(), onJackpot: null, jack: new Map() };
const uPlay = { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, -99, 0)) };

/* ------------------------------------------------------------ the floor */

// The machine floor behind the glass is Blender's (build_kabukigrin:
// kb_street.py PARLOUR, the "kbpachi" object in kb-props): six islands of
// machines run back from the glass, one behind each mullion. A parlour is
// lit like noon, so its paint (KB_Parlour) carries its own light; every
// machine's screen (KB_PachiScreen) runs through the colours on its own
// clock, the reels rolling, a white flash on a hit.
const PARLOUR_GLOW = 0.6;
export function lightParlour(scene) {
  scene.traverse((o) => {
    const m = o.isMesh && o.material;
    if (!m || m.userData.parlour) return;
    if (m.name === "KB_Parlour") {
      m.userData.parlour = true;
      m.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * ${PARLOUR_GLOW.toFixed(2)};`);
      };
      m.needsUpdate = true;
    } else if (m.name === "KB_PachiScreen") {
      m.userData.parlour = true;
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = U.uTime;
        sh.uniforms.uPlay = uPlay;
        sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vPachi;")
          .replace("#include <project_vertex>", "#include <project_vertex>\n  vPachi = (modelMatrix * vec4(transformed, 1.0)).xyz;");
        // one machine: its slot along the island (0.55 m), its screen's plane
        sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vPachi;\nuniform float uTime;\nuniform vec4 uPlay[8];")
          .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
  float h = fract(sin(dot(vec2(floor((vPachi.x + 32.6) / 0.55), vPachi.z), vec2(12.9898, 78.233))) * 43758.5453);
  float on = 0.0, jt = -99.0;
  for (int i = 0; i < 8; i++) {
    vec4 p = uPlay[i];
    if (p.w > 0.5 && abs(vPachi.x - p.x) < 0.2 && abs(vPachi.z - p.y) < 0.05) { on = 1.0; jt = p.z; }
  }
  float t = uTime * (0.6 + h * 0.8) * (1.0 + on * 3.0) + h * 7.0;
  vec3 hue = 0.5 + 0.5 * cos(6.2832 * (floor(t) / 6.0 + vec3(0.0, 0.33, 0.67)));
  float reel = 0.7 + 0.3 * step(0.4, fract(vPachi.y * 9.0 - t * 2.0));
  vec3 lit = mix(hue * reel, vec3(1.0), step(0.93, sin(t * 3.0))) * (1.1 + on * 0.4);
  float hit = step(jt, uTime) * clamp(1.0 - (uTime - jt) / 4.0, 0.0, 1.0);
  vec3 rainbow = 0.5 + 0.5 * cos(6.2832 * (uTime * 3.0 + vPachi.y * 5.0 + vec3(0.0, 0.33, 0.67)));
  totalEmissiveRadiance = mix(lit, rainbow * 1.8, step(0.01, hit));`);
      };
      m.needsUpdate = true;
    }
  });
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
   counter to 1.02, the noren's rod at z 30.34 (raised to y 2.38 under the
   Blender stall's fascia, its hem over the menu: rule 9), a lantern at each
   end; the tanuki by the koban and the capsule toys by B Main's vending
   machines are Studio's generated props. */
export const RAMEN = { x0: 19.05, x1: 22.95, wall: 30.935, rod: { y: 2.38, z: 30.31 }, lanterns: [[18.95, 1.95, 30.4], [23.05, 1.95, 30.4]] };
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
  // the menu tags over the counter (their top under the noren's hem: rule 9)
  root.add(new THREE.Mesh(place(new THREE.PlaneGeometry(2.34, 0.5), { x: cx, y: 1.58, z: R.wall - 0.006, ry: Math.PI }),
    new THREE.MeshStandardMaterial({ map: menuTexture(), transparent: true, alphaTest: 0.5, roughness: 0.9, emissive: 0xffe0b0, emissiveMap: null, emissiveIntensity: 0.12 })));
  // the warm light of the stall: up the boards, over the counter, a pool
  // in front, and each lantern's halo (steady)
  N.quad(M.neonHalo, cx, 1.35, R.wall - 0.01, w + 0.6, 2.2, { ry: Math.PI, color: 0xffb070, k: 0.18, beat: 0 });
  N.quad(M.neonHalo, cx, 0.02, R.wall - 1.3, w + 1.2, 2.6, { rx: -Math.PI / 2, color: 0xffa060, k: 0.16, beat: 0 });
  for (const [x, y, z] of R.lanterns) N.quad(M.neonHalo, x, y, z - 0.18, 0.9, 0.9, { ry: Math.PI, color: 0xff5a30, k: 0.35, beat: 0 });
}

/* ------------------------------------------------------------ the tanuki */

// Grinjuku's koban (grinjuku-layout.js: 4 x 2 at 0, 31.5, its glass door
// on the +z face): the tanuki stands to the door's right, facing the yard
const TANUKI = { x: 1.45, z: 32.95, ry: 0 };
function buildTanuki(root) {
  const g = new THREE.Group();
  const glaze = (c, rough = 0.32) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0 });
  const brown = glaze(0x8a5a32), belly = glaze(0xe0b47a), dark = glaze(0x3a2414), straw = glaze(0xb8925a, 0.85);
  const white = glaze(0xf2ece0, 0.25), black = glaze(0x0c0a08, 0.2), red = glaze(0xa8221a, 0.4);
  const ball = (m, r, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const o = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), m);
    o.position.set(x, y, z); o.scale.set(sx, sy, sz); g.add(o); return o;
  };
  const cyl = (m, r0, r1, h, x, y, z, rx = 0, rz = 0, seg = 14) => {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, seg), m);
    o.position.set(x, y, z); o.rotation.set(rx, 0, rz); g.add(o); return o;
  };
  cyl(dark, 0.32, 0.3, 0.06, 0, 0.03, 0, 0, 0, 20);              // the plinth
  ball(brown, 0.13, -0.13, 0.1, 0.06, 1, 0.6, 1.3);              // feet
  ball(brown, 0.13, 0.13, 0.1, 0.06, 1, 0.6, 1.3);
  ball(brown, 0.27, 0, 0.36, 0, 1.05, 1.0, 0.95);                // the body
  ball(belly, 0.22, 0, 0.33, 0.1, 1, 0.95, 0.75);                // the famous belly
  ball(brown, 0.17, 0, 0.7, 0.02, 1.05, 0.95, 1);                // the head
  ball(belly, 0.085, 0, 0.66, 0.15, 1, 0.75, 1);                 // muzzle
  ball(black, 0.03, 0, 0.68, 0.23);                              // nose
  for (const sx of [-1, 1]) {
    ball(dark, 0.05, sx * 0.075, 0.73, 0.14, 1.2, 0.9, 0.6);     // the mask round each eye
    ball(white, 0.032, sx * 0.07, 0.74, 0.165);
    ball(black, 0.016, sx * 0.068, 0.742, 0.19);
    ball(brown, 0.05, sx * 0.12, 0.84, 0, 1, 1, 0.6);            // ears
  }
  // the straw kasa, pushed back
  straw.side = THREE.DoubleSide;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.12, 20, 1, true), straw);
  hat.position.set(0, 0.86, -0.04); hat.rotation.x = -0.25; g.add(hat);
  cyl(straw, 0.08, 0.06, 0.05, 0, 0.9, -0.05, -0.25);
  // the sake flask in the right hand, the ledger in the left
  cyl(white, 0.065, 0.05, 0.2, 0.25, 0.32, 0.12, 0, -0.2);
  cyl(white, 0.022, 0.022, 0.06, 0.27, 0.45, 0.12, 0, -0.2);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.09), red);
  label.position.set(0.26, 0.32, 0.186); label.rotation.y = 0.1; g.add(label);
  ball(brown, 0.06, 0.22, 0.38, 0.12);                           // its paw round the neck
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.03), straw);
  book.position.set(-0.24, 0.34, 0.13); book.rotation.set(0.1, 0.3, 0.2); g.add(book);
  ball(brown, 0.06, -0.21, 0.36, 0.12);
  ball(brown, 0.07, 0, 0.18, -0.26, 0.8, 0.8, 1.4);              // the tail
  g.position.set(TANUKI.x, 0, TANUKI.z);
  g.rotation.y = TANUKI.ry;
  g.scale.setScalar(1.15);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  root.add(g);
}

/* ------------------------------------------------------------ the gacha rack */

// B Main's vending machine (grinjuku-layout.js, mirrored: x 23 .. 23.9,
// z -14 .. -12, facing +x): the rack stands south of it, its back to the
// same wall, two tiers of four machines
const GACHA = { x: 23.0, z0: -15.75, z1: -14.1, h: 1.62, d: 0.46 };
const CAPS = ["#ff4a7a", "#4ad2ff", "#ffd84a", "#7ae05a", "#c27aff", "#ff9a3a", "#f4f4f4"];
const TOYS = [["GRIN", "トロル"], ["KEK", "けけ"], ["U MAD", "まど"], ["LULZ", "るるず"], ["DOGE", "ドージ"], ["PEPE", "ぺぺ"], ["RAMEN", "らーめん"], ["NEKO", "ねこ"]];
function gachaTexture() {
  // one machine a column, two tiers: a header card, the capsule window, the
  // coin plate and handle; drawn once, the window lit
  const W = 1024, H = 1024, cw = W / 4, ch = H / 2, r = rng(77);
  const c = canvas(W, H), g = c.getContext("2d");
  for (let tier = 0; tier < 2; tier++) for (let i = 0; i < 4; i++) {
    const x = i * cw, y = tier * ch, [en, jp] = TOYS[tier * 4 + i], hue = CAPS[(tier * 4 + i) % CAPS.length];
    g.fillStyle = "#d8d8dc"; g.fillRect(x + 4, y + 4, cw - 8, ch - 8);
    // the header card
    g.fillStyle = hue; g.fillRect(x + 12, y + 12, cw - 24, ch * 0.24);
    g.fillStyle = "#141418"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `900 ${Math.round(ch * 0.085)}px ${JP}`; g.fillText(en, x + cw / 2, y + 12 + ch * 0.085);
    g.font = `700 ${Math.round(ch * 0.06)}px ${JP}`; g.fillText(jp, x + cw / 2, y + 12 + ch * 0.18);
    // the window full of capsules
    const wx = x + 18, wy = y + ch * 0.29, ww = cw - 36, wh = ch * 0.4;
    g.fillStyle = "#3a4048"; g.fillRect(wx, wy, ww, wh);
    for (let k = 0; k < 26; k++) {
      const cx = wx + 14 + r() * (ww - 28), cy = wy + wh - 12 - Math.pow(r(), 0.6) * (wh - 24), rr = 12 + r() * 4;
      g.fillStyle = CAPS[(r() * CAPS.length) | 0]; g.beginPath(); g.arc(cx, cy, rr, Math.PI, 0); g.fill();
      g.fillStyle = "rgba(255,255,255,.75)"; g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI); g.fill();
    }
    g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(wx + 8, wy + 6, ww * 0.2, wh - 12);
    // the coin plate: price, slot, handle
    g.fillStyle = "#9aa0a8"; g.fillRect(x + 22, y + ch * 0.72, cw - 44, ch * 0.2);
    g.fillStyle = "#c81e2a"; g.font = `900 ${Math.round(ch * 0.06)}px ${JP}`; g.fillText("¥300", x + cw * 0.32, y + ch * 0.78);
    g.fillStyle = "#2a2a30"; g.fillRect(x + cw * 0.62, y + ch * 0.75, 8, 22);
    g.fillStyle = "#e8e8ec"; g.beginPath(); g.arc(x + cw / 2, y + ch * 0.86, 18, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#6a7078"; g.fillRect(x + cw / 2 - 18, y + ch * 0.855, 36, 6);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function buildGacha(root, N, M) {
  const G = GACHA, w = G.z1 - G.z0, cz = (G.z0 + G.z1) / 2;
  const body = new THREE.MeshStandardMaterial({ color: 0x9a1e2a, roughness: 0.5, metalness: 0.2 });
  root.add(new THREE.Mesh(place(new THREE.BoxGeometry(G.d, G.h, w), { x: G.x + G.d / 2, y: G.h / 2, z: cz }), body));
  // the machines' faces, a hair proud of the cabinet, the windows lit a little
  const map = gachaTexture();
  const face = new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 0.18, roughness: 0.35 });
  root.add(new THREE.Mesh(place(new THREE.PlaneGeometry(w - 0.06, G.h - 0.3), { x: G.x + G.d + 0.004, y: (G.h - 0.3) / 2 + 0.04, z: cz, ry: Math.PI / 2 }), face));
  const sign = canvas(512, 96), sg = sign.getContext("2d");
  sg.fillStyle = "#fff4d8"; sg.fillRect(0, 0, 512, 96);
  sg.fillStyle = "#c81e2a"; sg.textAlign = "center"; sg.textBaseline = "middle";
  sg.font = `900 54px ${JP}`; sg.fillText("ガチャガチャ", 256, 50);
  const st = new THREE.CanvasTexture(sign); st.colorSpace = THREE.SRGBColorSpace;
  N.quad(neonMat({ map: st, key: "kb-gacha" }), G.x + G.d + 0.006, G.h - 0.13, cz, w - 0.08, 0.22, { ry: Math.PI / 2, k: 0.9, beat: 0 });
  N.quad(M.neonHalo, G.x + G.d + 0.9, 0.02, cz, 1.6, w + 0.8, { rx: -Math.PI / 2, color: 0xfff0e0, k: 0.1, beat: 0 });
}

/* ------------------------------------------------------------ the poster */

// A Main's vending machine (x -23.9 .. -23, z -14 .. -12): Trolling Loud
// Tokyo's lineup pasted on its north side, facing the line
function posterTexture() {
  const W = 512, H = 720, c = canvas(W, H), g = c.getContext("2d");
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#2a0638"); bg.addColorStop(0.6, "#7a0a5a"); bg.addColorStop(1, "#ff3a8a");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // a sunburst behind the title
  g.save(); g.translate(W / 2, H * 0.36); g.fillStyle = "rgba(255,210,90,.16)";
  for (let i = 0; i < 18; i++) { g.rotate(Math.PI / 9); g.beginPath(); g.moveTo(0, 0); g.lineTo(-40, -420); g.lineTo(40, -420); g.fill(); }
  g.restore();
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillStyle = "#fff4d0"; g.font = `900 76px ${JP}`; g.fillText("TROLLING", W / 2, 120); g.fillText("LOUD", W / 2, 200);
  g.fillStyle = "#3ff0ff"; g.font = `900 54px ${JP}`; g.fillText("東京", W / 2, 278);
  g.fillStyle = "#fff"; g.font = `700 34px ${JP}`;
  ["DJ LULZ", "KEK MACHINE", "THE U MAD BROS", "GRIN 777"].forEach((n, i) => g.fillText(n, W / 2, 380 + i * 48));
  g.fillStyle = "#ffd23a"; g.font = `900 30px ${JP}`; g.fillText("毎晩 · ALL NIGHT · 歌舞伎グリン", W / 2, 640);
  // pasted on: a couple of creases and a torn corner
  g.strokeStyle = "rgba(0,0,0,.18)"; g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, 300); g.lineTo(W, 330); g.moveTo(180, 0); g.lineTo(200, H); g.stroke();
  g.globalCompositeOperation = "destination-out";
  g.beginPath(); g.moveTo(W, H); g.lineTo(W - 70, H); g.lineTo(W, H - 50); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function buildPoster(root) {
  root.add(new THREE.Mesh(place(new THREE.PlaneGeometry(0.62, 0.87), { x: -23.45, y: 1.05, z: -11.995, rz: 0.03 }),
    new THREE.MeshStandardMaterial({ map: posterTexture(), transparent: true, alphaTest: 0.5, roughness: 0.75 })));
}

export function buildStreet({ root, N, M }) {
  buildRamen(root, N, M);
  buildTanuki(root);
  buildGacha(root, N, M);
  buildPoster(root);
  const P = PACHINKO;
  // the ticker along the header, scrolling at a walk
  const T = P.ticker, tw = P.z1 - P.z0 + 1.4, th = T.y1 - T.y0, tick = tickerTexture();
  tick.repeat.x = tw / (th * 2048 / 64);
  const tm = new THREE.Mesh(place(new THREE.PlaneGeometry(tw, th), { x: T.x, y: (T.y0 + T.y1) / 2, z: (P.z0 + P.z1) / 2, ry: Math.PI / 2 }), new THREE.MeshBasicMaterial({ map: tick, color: 0xd0d0d0, toneMapped: false }));
  tm.onBeforeRender = () => { tick.offset.x = (performance.now() / 1000 * 0.9 / (th * 2048 / 64)) % 1; };
  root.add(tm);
  // the sign, steady (no beat: the street's neon is calm)
  const S = P.sign, sw = S.z1 - S.z0, sh = S.y1 - S.y0;
  N.quad(neonMat({ map: signTexture(sw, sh), key: "kb-pachinko" }), S.x, (S.y0 + S.y1) / 2, (S.z0 + S.z1) / 2, sw, sh, { ry: Math.PI / 2, k: 1.05, beat: 0 });
  // the automatic doors: two glass leaves in steel frames, shut; in
  // Socialize they slide back behind the glass (PLAY.open: streetSound)
  const [d0, d1] = PARLOUR.door, half = (d1 - d0) / 2;
  const frame = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.35, metalness: 0.6 });
  const pane = new THREE.MeshStandardMaterial({ color: 0x9ab8c8, roughness: 0.05, transparent: true, opacity: 0.22, depthWrite: false });
  DOORS.length = 0;
  for (const [k, z] of [[-1, d0 + half / 2], [1, d1 - half / 2]]) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 2.24, half - 0.06), pane));
    for (const [w, h, y, dz] of [[0.05, 0.06, 1.12, 0], [0.05, 0.06, -1.12, 0], [0.05, 2.3, 0, (half - 0.04) / 2], [0.05, 2.3, 0, -(half - 0.04) / 2]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dz ? 0.04 : half), frame);
      m.position.set(0, y, dz);
      g.add(m);
    }
    g.position.set(-31.66, PARLOUR.floor + 1.15, z);
    root.add(g);
    DOORS.push({ g, z, k, slide: 0 });
  }
  // the white spill on the wet pavement, and a strip of it up the glass
  N.quad(M.neonHalo, -30.4, 0.02, (P.z0 + P.z1) / 2, 2.8, P.z1 - P.z0 + 1, { rx: -Math.PI / 2, color: 0xfff2ea, k: 0.16, beat: 0 });
  N.quad(M.neonHalo, -30.6, 0.025, P.door, 2.2, 3.6, { rx: -Math.PI / 2, color: 0xffe8f0, k: 0.12, beat: 0 });
}

/* ------------------------------------------------------------ sound */

// The parlour's din, each frame of a live map: rattles from along the
// glass (more the nearer you are), a jingle every few seconds; each one
// a panned one-shot from the club's own sfx, so it sits in the street
/* The machines in play (PLAY, set by modes/social-pachinko.js): onto the
   screens' uniform, ours first; each hits now and then (about once a
   minute: the rainbow on its screen, and for ours the fanfare and the
   banner); ours rattles with the balls we're firing. */
const JACKPOT = { every: 60, show: 4 };
function playing(sfx, now, dt) {
  const t = U.uTime.value;
  const list = PLAY.mine >= 0 ? [PLAY.mine, ...[...PLAY.others].filter((k) => k !== PLAY.mine)] : [...PLAY.others];
  for (let i = 0; i < uPlay.value.length; i++) {
    const k = list[i], v = uPlay.value[i];
    if (k == null) { v.w = 0; continue; }
    const m = MACHINES[k];
    let jt = PLAY.jack.get(k) ?? -99;
    // a hit, rolled each frame
    if (t - jt > JACKPOT.show && Math.random() < dt / JACKPOT.every) {
      jt = t;
      PLAY.jack.set(k, jt);
      if (k === PLAY.mine) {
        PLAY.onJackpot?.();
        if (sfx) for (let j = 0; j < 4; j++) setTimeout(() => sfx("jingle", { x: m.x, y: 1.6, z: m.z }), j * 260);
      }
    }
    v.set(m.x, m.z, jt, 1);
  }
  if (PLAY.mine >= 0 && sfx) {
    const m = MACHINES[PLAY.mine];
    if (nextMine < now - 0.3) nextMine = now;
    while (nextMine < now) { sfx("balls", { x: m.x, y: 1.4, z: m.z }); nextMine += 0.05 + Math.random() * 0.06; }
  }
}

const HEAR = 24;
const DOORS = [];
let nextBalls = 0, nextJingle = 0, nextMine = 0, lastT = 0;
export function streetSound(sfx, live) {
  if (!live) return;
  const P = PACHINKO, cam = U.uPlayer.value;
  const now = performance.now() / 1000, dt = Math.min(0.1, now - (lastT || now));
  lastT = now;
  // the doors: open in Socialize, sliding a leaf's width back behind the glass
  for (const d of DOORS) {
    d.slide += ((PLAY.open ? 1 : 0) - d.slide) * Math.min(1, dt * 3);
    d.g.position.z = d.z + d.k * d.slide * ((PARLOUR.door[1] - PARLOUR.door[0]) / 2 - 0.05);
    d.g.position.x = -31.66 - d.slide * 0.05;
  }
  playing(sfx, now, dt);
  if (!sfx) return;
  const inside = cam.x < PARLOUR.front;
  const z = Math.min(P.z1, Math.max(P.z0, cam.z)), d = inside ? 0 : Math.hypot(cam.x - P.x, cam.z - z);
  if (d > HEAR) { nextBalls = nextJingle = now; return; }
  // (inside, the din comes from the machines round you; outside, out of the glass)
  const at = inside
    ? () => { const m = MACHINES[Math.floor(Math.random() * MACHINES.length)]; return { x: m.x, y: 1.5, z: m.z }; }
    : () => ({ x: P.x + 0.3, y: 1.1 + Math.random() * 0.8, z: P.z0 + Math.random() * (P.z1 - P.z0) });
  // (a few at most after a stall, never a burst)
  if (nextBalls < now - 0.5) nextBalls = now;
  while (nextBalls < now) { sfx("balls", at()); nextBalls += 0.06 + Math.random() * 0.14; }
  if (nextJingle < now) { sfx("jingle", at()); nextJingle = now + 3 + Math.random() * 5; }
}
