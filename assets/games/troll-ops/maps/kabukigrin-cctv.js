// Troll Forces — Kabukigrin's security room and its CCTV (docs/KB-SECURITY-ROOM.md).
// The manager's office over the square (x -14 .. -6.3, z 19.1 .. 23.8, floor
// 3) keeps Studio's desk at the window and Big Boss at it; this adds the
// security side: a wall of ten monitors on the north wall's solid half, a
// desk under it with the $TROLL chart monitor, an office chair, the floor
// clutter, and the ten cameras round the club and the street whose feeds
// the monitors show.
//
// The feeds are live: each camera renders the scene into its own small
// target, one camera a frame, round robin, only while someone's in the room
// (or watching one full screen, modes/social-cctv.js), so nothing costs a
// thing the rest of the time. The NPCs a camera sees are shown and posed
// for its render (their own update hides whoever the local eye can't see).
//
// Rule 9: the monitor wall is flush on its wall with nothing in front of it
// from the chair or the room (the desk kit stays under its lower edge, the
// chart monitor out to the side); every camera hangs in a corner or under a
// fascia, never on or before a screen, a sign, the LED wall, a mirror or a
// doorway. tools/troll-ops-cctv-test.mjs raycasts both.

import * as THREE from "three";

/* ---------------------------------------------------------------- the plan */
export const OFFICE = { x0: -14, x1: -6.3, z0: 19.1, z1: 23.8, floor: 3, top: 7.4 };
// the monitor wall on the north wall (x -11.2 .. -6.3 is solid; the sofa's
// arm stands in the east corner, so the wall stops short of it)
const WALL = { z: 19.11, cols: 5, rows: 2, x0: -10.93, dx: 0.56, y0: 4.72, dy: 0.36, w: 0.54, h: 0.34 };
// the security desk under it, facing the wall; the line is cut on its glass
export const DESK = { x: -9.8, z: 19.78, w: 1.7, d: 0.66, top: 3.75 };
// the chart monitor on the desk's west end, turned to the chair
export const CHART = { x: -10.38, z: 19.62, y: 3.935, w: 0.5, h: 0.28, ry: 0.32 };
// the office chair: its seat, facing the wall (-z)
export const CHAIR = { x: -9.75, z: 20.75, seat: 3.48, yaw: 0 };

/* The cameras: where each hangs (`p`), what it looks at (`at`), how it's
   mounted (`m`: "ceil" a dome under a ceiling, or a wall bullet on an arm
   off the wall whose normal into the room is `n`). */
export const CAMS = [
  { label: "01 SQUARE", p: [-14.16, 6.55, 19.45], at: [-25, 0.4, 7], m: "wall", n: [-1, 0] },
  { label: "02 STAIRS", p: [-24.1, -0.6, 11.2], at: [-26, -1.8, 5], m: "ceil" },
  { label: "03 BALCONY", p: [-13.2, -0.6, 4.9], at: [-26, -3.6, 10], m: "ceil" },
  { label: "04 FLOOR", p: [-12.4, -0.6, 12.4], at: [-21.5, -7.5, 17], m: "ceil", fov: 78 },
  { label: "05 DJ", p: [-26.5, -0.6, 24.6], at: [-29.6, -6.6, 17], m: "ceil" },
  { label: "06 BAR", p: [-6.95, -4.0, 12.6], at: [-11.2, -6.6, 19], m: "ceil" },
  { label: "07 BOOTHS", p: [-6.95, -0.6, 29.55], at: [-19, -5.2, 23], m: "ceil" },
  { label: "08 VIP", p: [-31.3, 2.45, 24.45], at: [-27, 0.3, 27.6], m: "ceil" },
  { label: "09 KITCHEN", p: [-20.38, 2.6, 24.5], at: [-22.8, 0.9, 28], m: "wall", n: [-1, 0] },
  { label: "10 THE LINE", p: [-27.6, 3.0, 4.15], at: [-29.2, 0.4, -4], m: "ceil" },
];
const FEED_W = 256, FEED_H = 144;
const DEAD_SECS = 60;           // a shot camera's down this long
const NPC_REACH = 32;           // a feed shows the NPCs this near its camera

/* ------------------------------------------------------------ textures */

const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
const ctex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const two = (n) => String(n).padStart(2, "0");
export function stamp(d = new Date()) {
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
}

/* A monitor's overlay: the camera's label, the date and the clock, REC on
   the live ones, NO SIGNAL on a dead one. Redrawn once a second. */
function overlay(label) {
  const c = canvas(256, 144), g = c.getContext("2d"), tex = ctex(c);
  let last = "";
  return {
    tex,
    draw(dead, blink) {
      const key = `${stamp()}|${dead}|${blink}`;
      if (key === last) return;
      last = key;
      g.clearRect(0, 0, 256, 144);
      g.font = "600 13px 'DM Mono', monospace";
      g.textBaseline = "top";
      g.fillStyle = "rgba(0,0,0,0.45)"; g.fillRect(4, 4, g.measureText(label).width + 8, 17);
      g.fillStyle = "#e8fff0"; g.fillText(label, 8, 6);
      const s = stamp();
      g.font = "500 11px 'DM Mono', monospace";
      const w = g.measureText(s).width;
      g.fillStyle = "rgba(0,0,0,0.45)"; g.fillRect(252 - w - 8, 124, w + 8, 16);
      g.fillStyle = "#e8fff0"; g.fillText(s, 248 - w, 127);
      if (dead) {
        g.fillStyle = "rgba(10,10,14,0.55)"; g.fillRect(0, 50, 256, 44);
        g.font = "700 20px 'DM Mono', monospace"; g.textAlign = "center";
        g.fillStyle = "#ff5a5a"; g.fillText("NO SIGNAL", 128, 61);
        g.textAlign = "left";
      } else if (blink) {
        g.fillStyle = "#ff3030"; g.beginPath(); g.arc(214, 13, 4, 0, 7); g.fill();
        g.fillStyle = "#ffdede"; g.font = "600 11px 'DM Mono', monospace"; g.fillText("REC", 222, 7);
      }
      tex.needsUpdate = true;
    },
  };
}

/* The chart monitor: $TROLL's candles stepping up, the newest (the tall
   green one he reaches in for) glowing on the right. `taken`: it's gone
   from the screen for a moment (out in his hand). */
function chartScreen() {
  const c = canvas(512, 300), g = c.getContext("2d"), tex = ctex(c);
  const N = 22, seq = [];
  let v = 40, seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 400; i++) { const o = v; v += (rnd() - 0.42) * 9; seq.push([o, v, Math.max(o, v) + rnd() * 4, Math.min(o, v) - rnd() * 4]); }
  let last = -1;
  return {
    tex,
    draw(now, taken = 0) {
      const step = Math.floor(now * 1.5);
      const key = `${step}|${taken > 0.5}`;
      if (key === last) return;
      last = key;
      g.fillStyle = "#04120a"; g.fillRect(0, 0, 512, 300);
      g.strokeStyle = "rgba(60,140,90,0.25)"; g.lineWidth = 1;
      for (let y = 40; y < 300; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
      const at = step % (seq.length - N);
      const win = seq.slice(at, at + N);
      // the last one always prints big and green: the one you take
      win[N - 1] = [win[N - 2][1], win[N - 2][1] + 22, win[N - 2][1] + 25, win[N - 2][1] - 2];
      const lo = Math.min(...win.map((k) => k[3])), hi = Math.max(...win.map((k) => k[2]));
      const Y = (p) => 270 - ((p - lo) / (hi - lo || 1)) * 210;
      win.forEach(([o, cl, h, l], i) => {
        if (i === N - 1 && taken > 0.5) return;
        const x = 18 + i * 22, up = cl >= o;
        g.strokeStyle = g.fillStyle = up ? "#1fd35a" : "#ff3b3b";
        g.beginPath(); g.moveTo(x + 6, Y(h)); g.lineTo(x + 6, Y(l)); g.stroke();
        const y0 = Y(Math.max(o, cl)), y1 = Y(Math.min(o, cl));
        if (i === N - 1) { g.shadowColor = "#5dff9a"; g.shadowBlur = 18; }
        g.fillRect(x, y0, 12, Math.max(3, y1 - y0));
        g.shadowBlur = 0;
      });
      g.font = "700 26px Oswald, 'DM Sans', sans-serif"; g.fillStyle = "#c9ffd9";
      g.fillText("$TROLL", 16, 34);
      g.font = "600 18px 'DM Mono', monospace"; g.fillStyle = "#1fd35a";
      g.fillText(`+${(420.69 + (step % 50) * 1.3).toFixed(2)}%`, 120, 32);
      tex.needsUpdate = true;
    },
  };
}

// the door's plate: 警備室, the security room
function plateTexture() {
  const c = canvas(256, 96), g = c.getContext("2d");
  g.fillStyle = "#1a2240"; g.fillRect(0, 0, 256, 96);
  g.strokeStyle = "#c9d4ff"; g.lineWidth = 4; g.strokeRect(6, 6, 244, 84);
  g.fillStyle = "#f2f5ff"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = "700 46px 'Hiragino Sans','Yu Gothic','Meiryo','Noto Sans JP',sans-serif";
  g.fillText("警備室", 128, 46);
  return ctex(c);
}

/* ------------------------------------------------------------ the feed look

   The feed's target holds the scene's linear light; this grades it to CCTV:
   exposure and a soft rolloff, mostly grey with a green cast, scanlines,
   grain that crawls, a dark edge, and the overlay on top. */
const FEED_VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FEED_FS = /* glsl */ `
uniform sampler2D map;
uniform sampler2D over;
uniform float uTime;
uniform float uDead;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 c = texture2D(map, vUv).rgb * 3.6;
  c = c / (1.0 + c);
  float l = dot(c, vec3(0.3, 0.59, 0.11));
  c = mix(vec3(l), c, 0.45) * vec3(0.86, 1.0, 0.9);
  c *= 0.88 + 0.12 * sin(vUv.y * 144.0 * 3.14159);
  float n = hash(floor(vUv * vec2(256.0, 144.0)) + floor(uTime * 24.0));
  c += (n - 0.5) * 0.06;
  c = mix(c, vec3(n * 0.55), uDead);
  vec2 q = vUv - 0.5;
  c *= 1.0 - dot(q, q) * 1.1;
  vec4 o = texture2D(over, vUv);
  c = mix(c, o.rgb, o.a);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

/* ------------------------------------------------------------ the models */

function mats() {
  return {
    white: new THREE.MeshStandardMaterial({ color: 0xe9eaec, roughness: 0.4, metalness: 0.05 }),
    lens: new THREE.MeshStandardMaterial({ color: 0x07080b, roughness: 0.05, metalness: 0.7 }),
    smoke: new THREE.MeshStandardMaterial({ color: 0x0c0d12, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.85 }),
    led: new THREE.MeshBasicMaterial({ color: 0xff2a2a, toneMapped: false }),
    bezel: new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.45, metalness: 0.3 }),
    bracket: new THREE.MeshStandardMaterial({ color: 0x1c1d22, roughness: 0.6, metalness: 0.5 }),
    lam: new THREE.MeshStandardMaterial({ color: 0x3a3c45, roughness: 0.5, metalness: 0.1 }),
    // (satin, not a mirror: from the chair a mirror top read as a hole)
    glass: new THREE.MeshStandardMaterial({ color: 0x23262f, roughness: 0.18, metalness: 0.3, emissive: 0x0c1220 }),
    mesh: new THREE.MeshStandardMaterial({ color: 0x1a1b20, roughness: 0.8 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.25, metalness: 0.9 }),
    keys: new THREE.MeshStandardMaterial({ color: 0x222329, roughness: 0.7 }),
    radio: new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.5 }),
    cup: new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.7 }),
    bottle: new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.8 }),
    label: new THREE.MeshStandardMaterial({ color: 0xe9dcb0, roughness: 0.8 }),
    tissue: new THREE.MeshStandardMaterial({ color: 0xf7f7f2, roughness: 0.95 }),
    lotion: new THREE.MeshStandardMaterial({ color: 0xe8f0ff, roughness: 0.4 }),
    cap: new THREE.MeshStandardMaterial({ color: 0x3a6fd8, roughness: 0.4 }),
    pizza: new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.9 }),
    puddle: new THREE.MeshStandardMaterial({ color: 0x2a1508, roughness: 0.03, metalness: 0.3, transparent: true, opacity: 0.75, depthWrite: false }),
  };
}

/* A dome: a white base ring under the ceiling, the smoked bubble below. */
function dome(M) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.025, 20), M.white);
  base.position.y = -0.0125;
  const bub = new THREE.Mesh(new THREE.SphereGeometry(0.055, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.smoke);
  bub.position.y = -0.025;
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), M.lens);
  eye.position.y = -0.05;
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.005, 6, 4), M.led);
  led.position.set(0.062, -0.02, 0);
  g.add(base, bub, eye, led);
  g.userData.box = [0.08, 0.085, 0.08];   // half sizes, down from the mount
  return { g, droop: eye, led };
}

/* A bullet camera: a wall plate, a short arm out, the body with its
   sunshade, aimed down at `at` (its local -z is the lens). */
function bullet(M) {
  const g = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.015, 16), M.white);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.13, 8), M.white);
  const head = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.19, 18), M.white);
  body.rotation.x = Math.PI / 2;
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.22, 18, 1, true, -Math.PI / 2, Math.PI), M.white);
  hood.rotation.x = Math.PI / 2;
  hood.rotation.y = Math.PI;
  hood.position.set(0, 0.006, -0.015);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.026, 16), M.lens);
  lens.position.z = -0.096;
  lens.rotation.y = Math.PI;
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.005, 6, 4), M.led);
  led.position.set(0.02, -0.022, -0.09);
  head.add(body, hood, lens, led);
  g.add(plate, arm, head);
  return { g, plate, arm, head, led };
}

/* Rule 9's registry (tools/troll-ops-obstruction-test.mjs, through the map's
   facesMore): the monitor wall and the chart monitor are faces; every
   camera, the desk and its kit, the chair and the clutter are props. The
   office's floor is an eye region. */
export function cctvFaces() {
  const f = (id, owner, c, n, w, h) => ({ id, owner, c, n, u: [n[2] || 0, 0, -(n[0] || 0)], w, h });
  const wx = WALL.x0 + (WALL.cols - 1) * WALL.dx / 2, wy = WALL.y0 + (WALL.rows - 1) * WALL.dy / 2;
  const cs = Math.cos(CHART.ry), sn = Math.sin(CHART.ry);
  const props = CAMS.map((C, k) => {
    const [x, y, z] = C.p;
    if (C.m === "ceil") return { id: `cctv-cam-${k + 1}`, on: null, lo: [x - 0.08, y - 0.09, z - 0.08], hi: [x + 0.08, y + 0.01, z + 0.08] };
    const bx = x - C.n[0] * 0.16, bz = z - C.n[1] * 0.16;
    return { id: `cctv-cam-${k + 1}`, on: null, lo: [Math.min(x, bx) - 0.12, y - 0.1, Math.min(z, bz) - 0.12], hi: [Math.max(x, bx) + 0.12, y + 0.08, Math.max(z, bz) + 0.12] };
  });
  const fl = OFFICE.floor;
  props.push(
    { id: "cctv-wall-bracket", on: "cctv-wall", lo: [wx - 1.45, wy - 0.42, WALL.z], hi: [wx + 1.45, wy + 0.42, WALL.z + 0.08] },
    { id: "cctv-desk", on: null, lo: [DESK.x - DESK.w / 2, fl, DESK.z - DESK.d / 2], hi: [DESK.x + DESK.w / 2, DESK.top + 0.01, DESK.z + DESK.d / 2] },
    { id: "cctv-chart", on: null, lo: [CHART.x - 0.3, DESK.top, CHART.z - 0.15], hi: [CHART.x + 0.3, CHART.y + CHART.h / 2 + 0.02, CHART.z + 0.15] },
    { id: "cctv-kit", on: null, lo: [-9.86, DESK.top, 19.5], hi: [-9.0, DESK.top + 0.29, 20.0] },
    { id: "cctv-chair", on: null, lo: [CHAIR.x - 0.32, fl, CHAIR.z - 0.32], hi: [CHAIR.x + 0.32, CHAIR.seat + 0.62, CHAIR.z + 0.32] },
    { id: "cctv-clutter", on: null, lo: [-11.06, fl, 19.5], hi: [-9.2, fl + 0.2, 20.85] },
  );
  return {
    faces: [
      f("cctv-wall", "cctv-wall", [wx, wy, WALL.z + 0.06], [0, 0, 1], WALL.cols * WALL.dx, WALL.rows * WALL.dy),
      { id: "cctv-chart", owner: "cctv-chart", c: [CHART.x, CHART.y, CHART.z + 0.017], n: [sn, 0, cs], u: [cs, 0, -sn], w: CHART.w, h: CHART.h },
    ],
    props,
    eyes: [{ rect: [OFFICE.x0 + 0.2, OFFICE.x1 - 0.2, OFFICE.z0 + 0.2, OFFICE.z1 - 0.2], y: OFFICE.floor }],
  };
}

/* ------------------------------------------------------------ build */

export function buildCctv({ root }) {
  const M = mats();
  const live = [];          // everything whose look moves: posed in tick()
  const boxes = [];         // rule 9: [x0,y0,z0,x1,y1,z1] of every piece
  const addBox = (o) => { o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o); boxes.push([b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z]); };
  const group = new THREE.Group();
  group.name = "kb-security";
  root.add(group);

  /* ---- the cameras */
  const cams = CAMS.map((C, i) => {
    const p = new THREE.Vector3(...C.p), at = new THREE.Vector3(...C.at);
    let model;
    if (C.m === "ceil") {
      model = dome(M);
      model.g.position.copy(p);
      // the eye inside looks where the feed looks
      model.droop.lookAt(at);
    } else {
      model = bullet(M);
      const n = new THREE.Vector3(C.n[0], 0, C.n[1]);
      const wall = p.clone().addScaledVector(n, -0.15);
      model.plate.position.copy(wall);
      model.plate.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      model.arm.position.copy(wall).addScaledVector(n, 0.075);
      model.arm.quaternion.copy(model.plate.quaternion);
      model.head.position.copy(p);
      model.head.lookAt(at);
      model.head.rotateY(Math.PI);   // lookAt points +z at the target; the lens is -z
    }
    model.g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    group.add(model.g);
    addBox(model.g);
    const cam = new THREE.PerspectiveCamera(C.fov || 70, FEED_W / FEED_H, 0.08, 40);
    // the feed sits a hair in front of the lens, looking at its target
    const fwd = at.clone().sub(p).normalize();
    cam.position.copy(p).addScaledVector(fwd, 0.12);
    if (C.m === "ceil") cam.position.y -= 0.06;
    cam.lookAt(at);
    cam.updateMatrixWorld(true);
    const rt = new THREE.WebGLRenderTarget(FEED_W, FEED_H, { depthBuffer: true, type: THREE.HalfFloatType });
    return { i, ...C, pos: p, at, model, cam, rt, ov: overlay(C.label), dead: 0, zone: null, rest: model.head ? model.head.quaternion.clone() : model.droop.quaternion.clone() };
  });

  /* ---- the monitor wall: a bracket plate, ten bezels, ten screens */
  const wallW = WALL.cols * WALL.dx, wallH = WALL.rows * WALL.dy;
  // (y0 is the bottom row's middle; the rows stack up from it)
  const wx = WALL.x0 + (WALL.cols - 1) * WALL.dx / 2, wy = WALL.y0 + (WALL.rows - 1) * WALL.dy / 2;
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(wallW + 0.06, wallH + 0.06, 0.02), M.bracket);
  bracket.position.set(wx, wy, WALL.z + 0.01);
  group.add(bracket);
  addBox(bracket);
  const screens = [];
  for (let r = 0; r < WALL.rows; r++) for (let c = 0; c < WALL.cols; c++) {
    const k = r * WALL.cols + c;
    const x = WALL.x0 + c * WALL.dx, y = WALL.y0 + (WALL.rows - 1 - r) * WALL.dy;
    const bez = new THREE.Mesh(new THREE.BoxGeometry(WALL.w, WALL.h, 0.035), M.bezel);
    bez.position.set(x, y, WALL.z + 0.0375);
    group.add(bez);
    addBox(bez);
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: cams[k].rt.texture }, over: { value: cams[k].ov.tex }, uTime: { value: 0 }, uDead: { value: 0 } },
      vertexShader: FEED_VS, fragmentShader: FEED_FS, toneMapped: false,
    });
    const s = new THREE.Mesh(new THREE.PlaneGeometry(WALL.w - 0.03, WALL.h - 0.03), mat);
    s.position.set(x, y, WALL.z + 0.0565);
    group.add(s);
    screens.push(s);
  }
  // the wall's glow on the desk and the floor in front of it (no runtime
  // light: a light here would recompile every shader on the map)
  const glowC = canvas(128, 128), gg = glowC.getContext("2d");
  const rg = gg.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, "rgba(140,190,255,0.55)"); rg.addColorStop(1, "rgba(140,190,255,0)");
  gg.fillStyle = rg; gg.fillRect(0, 0, 128, 128);
  const glowMat = new THREE.MeshBasicMaterial({ map: ctex(glowC), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0.6 });
  const floorGlow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.2).rotateX(-Math.PI / 2), glowMat);
  floorGlow.position.set(wx, OFFICE.floor + 0.012, WALL.z + 1.1);
  floorGlow.renderOrder = 2;
  group.add(floorGlow);

  /* ---- the desk: a black top on two side panels, a glass top over it */
  const desk = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(DESK.w, 0.035, DESK.d), M.lam);
  top.position.y = DESK.top - 0.0175;
  const glass = new THREE.Mesh(new THREE.BoxGeometry(DESK.w - 0.04, 0.006, DESK.d - 0.04), M.glass);
  glass.position.y = DESK.top + 0.003;
  // the monitor wall's light on the glass (additive, no runtime light)
  const deskGlow = new THREE.Mesh(new THREE.PlaneGeometry(DESK.w - 0.06, DESK.d - 0.06).rotateX(-Math.PI / 2), glowMat.clone());
  deskGlow.material.opacity = 0.32;
  deskGlow.position.y = DESK.top + 0.0075;
  deskGlow.renderOrder = 2;
  desk.add(top, glass, deskGlow);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.035, DESK.top - OFFICE.floor - 0.035, DESK.d - 0.04), M.lam);
    side.position.set(sx * (DESK.w / 2 - 0.04), (DESK.top - OFFICE.floor - 0.035) / 2 + OFFICE.floor, 0);
    desk.add(side);
  }
  const modesty = new THREE.Mesh(new THREE.BoxGeometry(DESK.w - 0.1, 0.4, 0.02), M.lam);
  modesty.position.set(0, DESK.top - 0.25, -DESK.d / 2 + 0.03);
  desk.add(modesty);
  desk.position.set(DESK.x, 0, DESK.z);
  group.add(desk);
  addBox(desk);
  const glassTop = DESK.top + 0.006;

  /* ---- the chart monitor on a low stand */
  const chart = chartScreen();
  const cm = new THREE.Group();
  const cBez = new THREE.Mesh(new THREE.BoxGeometry(CHART.w + 0.03, CHART.h + 0.03, 0.03), M.bezel);
  const cScr = new THREE.Mesh(new THREE.PlaneGeometry(CHART.w, CHART.h), new THREE.MeshBasicMaterial({ map: chart.tex, toneMapped: false }));
  cScr.position.z = 0.0155;
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.03), M.bezel);
  neck.position.set(0, -CHART.h / 2 - 0.05, -0.03);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.012, 0.16), M.bezel);
  foot.position.set(0, -(CHART.y - glassTop) + 0.006, -0.03);
  cm.add(cBez, cScr, neck, foot);
  cm.position.set(CHART.x, CHART.y, CHART.z);
  cm.rotation.y = CHART.ry;
  group.add(cm);
  addBox(cm);

  /* ---- the desk kit: keyboard, mouse, radio, cup, the bottle */
  const kit = new THREE.Group();
  const kb = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.022, 0.14), M.keys);
  kb.position.set(-9.62, glassTop + 0.011, 19.6);
  const mouse = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8).scale(1, 0.45, 1.5), M.keys);
  mouse.position.set(-9.28, glassTop + 0.012, 19.64);
  const radio = new THREE.Group();
  const rb = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.13, 0.035), M.radio);
  rb.position.y = 0.065 + 0.03;
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.07, 6), M.radio);
  ant.position.set(0.018, 0.195, 0);
  const dock = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.07), M.bezel);
  dock.position.y = 0.015;
  radio.add(dock, rb, ant);
  radio.position.set(-9.12, glassTop, 19.56);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.11, 14), M.cup);
  cup.position.set(-9.3, glassTop + 0.055, 19.92);
  kit.add(kb, mouse, radio, cup);
  group.add(kit);
  addBox(kit);
  // the bottle: stands at the desk's east end; the line rolls it (social-lines.js)
  const bottle = new THREE.Group();
  const bBody = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.19, 16), M.bottle);
  bBody.position.y = 0.095;
  const bNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.034, 0.08, 14), M.bottle);
  bNeck.position.y = 0.23;
  const bLabel = new THREE.Mesh(new THREE.CylinderGeometry(0.0385, 0.0385, 0.07, 16, 1, true), M.label);
  bLabel.position.y = 0.09;
  bottle.add(bBody, bNeck, bLabel);
  bottle.position.set(-9.08, glassTop, 19.86);
  bottle.userData.rest = bottle.position.clone();
  group.add(bottle);
  addBox(bottle);

  /* ---- the office chair: five-star base and column, the seat and back
     turn on it (the launch spins it) */
  const chair = new THREE.Group();
  const base = new THREE.Group();
  for (let k = 0; k < 5; k++) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.025, 0.3), M.chrome);
    const a = (k / 5) * Math.PI * 2;
    leg.position.set(Math.sin(a) * 0.15, 0.06, Math.cos(a) * 0.15);
    leg.rotation.y = a;
    const wheel = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), M.bezel);
    wheel.position.set(Math.sin(a) * 0.29, 0.025, Math.cos(a) * 0.29);
    base.add(leg, wheel);
  }
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.33, 10), M.chrome);
  column.position.y = 0.225;
  base.add(column);
  const spin = new THREE.Group();
  spin.position.y = CHAIR.seat - OFFICE.floor - 0.05;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.48), M.mesh);
  seat.geometry.translate(0, 0.015, 0);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.56, 0.05), M.mesh);
  back.position.set(0, 0.36, 0.25);
  back.rotation.x = -0.12;
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.03), M.chrome);
  post.position.set(0, 0.1, 0.25);
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, 0.26), M.bezel);
    arm.position.set(sx * 0.27, 0.22, 0.04);
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.2, 0.025), M.chrome);
    strut.position.set(sx * 0.27, 0.12, 0.08);
    spin.add(arm, strut);
  }
  spin.add(seat, back, post);
  chair.add(base, spin);
  chair.position.set(CHAIR.x, OFFICE.floor, CHAIR.z);
  chair.rotation.y = CHAIR.yaw;
  group.add(chair);

  /* ---- the clutter under and beside the desk (the concept video's floor) */
  const clutter = new THREE.Group();
  const floorY = OFFICE.floor;
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20).scale(1.4, 1, 1).rotateX(-Math.PI / 2), M.puddle);
  puddle.position.set(-10.78, floorY + 0.004, 20.55);
  puddle.renderOrder = 1;
  const spilt = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.11, 14), M.cup);
  spilt.rotation.set(0, 0.6, Math.PI / 2);
  spilt.position.set(-10.92, floorY + 0.04, 20.45);
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.1, 16), M.tissue);
  roll.position.set(-9.25, floorY + 0.05, 19.62);
  const lotion = new THREE.Group();
  const lb = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.15, 12), M.lotion);
  lb.position.y = 0.075;
  const lc = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.04, 10), M.cap);
  lc.position.y = 0.17;
  lotion.add(lb, lc);
  lotion.position.set(-10.6, floorY, 19.7);
  const pizza = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.36), M.pizza);
  pizza.position.set(-10.15, floorY + 0.02, 19.72);
  pizza.rotation.y = 0.3;
  clutter.add(puddle, spilt, roll, lotion, pizza);
  for (let k = 0; k < 6; k++) {
    // crumpled tissues: squashed lumps
    const t = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 1).scale(1, 0.6, 1.1), M.tissue);
    t.position.set(-9.55 + Math.sin(k * 2.1) * 0.22, floorY + 0.02, 19.75 + Math.cos(k * 1.7) * 0.15);
    t.rotation.set(k, k * 2, k * 0.5);
    clutter.add(t);
  }
  group.add(clutter);
  addBox(clutter);

  /* ---- the door's plate, over the stair door, outside */
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.18), new THREE.MeshStandardMaterial({ map: plateTexture(), roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.25, emissiveMap: null }));
  plate.material.emissiveMap = plate.material.map;
  plate.position.set(-10.3, 5.85, OFFICE.z1 + 0.235);
  group.add(plate);

  group.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = o === top; } });

  /* ------------------------------------------------------------ live */

  let next = 0;
  const _v = new THREE.Vector3();
  const api = {
    cams, screens, chair: { group: chair, spin, ...CHAIR }, bottle, chart: { mesh: cm, screen: cScr, ...CHART, glassTop }, desk: { ...DESK, glassTop },
    group, boxes: () => boxes.slice(),
    active: false,     // someone's in the room or watching (social-cctv.js sets it)
    peek: -1,          // the camera being watched full screen (its feed's the screen: skip it)
    taken: 0,          // the chart's tall candle is out (the line has it)
    stats: { renders: 0 },
    /* Every frame (Socialize, social-cctv.js), outside the render: the
       overlays, the chart, and one feed rendered. `view` zones the NPCs. */
    tick(renderer, scene, { npcs = null, view = null, rig = null, now = performance.now() / 1000 } = {}) {
      for (const c of cams) {
        const dead = c.dead && now < c.dead;
        if (c.dead && !dead) mend(c);
        c.model.led.visible = !dead && Math.floor(now * 1.2 + c.i) % 2 === 0;
      }
      if (!api.active) return;
      chart.draw(now, api.taken);
      screens.forEach((s, k) => {
        const c = cams[k], dead = !!c.dead;
        s.material.uniforms.uTime.value = now;
        s.material.uniforms.uDead.value = dead ? 1 : 0;
        c.ov.draw(dead, Math.floor(now) % 2 === 0);
      });
      // one feed this frame: the next live camera that isn't the one on screen
      let c = null;
      for (let n = 0; n < cams.length; n++) {
        const k = (next + n) % cams.length;
        if (!cams[k].dead && k !== api.peek) { c = cams[k]; next = k + 1; break; }
      }
      if (!c || !renderer || !scene) return;
      renderFeed(renderer, scene, c, { npcs, view, rig });
    },
    /* A shot near a camera breaks it for a minute; true = answered. */
    onShot(p, now = performance.now() / 1000) {
      for (const c of cams) {
        if (c.pos.distanceTo(_v.set(p.x, p.y, p.z)) < 0.17) {
          if (!c.dead) kill(c, now);
          return true;
        }
      }
      return false;
    },
  };

  function kill(c, now) {
    c.dead = now + DEAD_SECS;
    const o = c.model.head || c.model.droop;
    o.rotateX(c.model.head ? -0.7 : 0.9);   // drooped on its mount
  }
  function mend(c) {
    c.dead = 0;
    const o = c.model.head || c.model.droop;
    o.quaternion.copy(c.rest);
  }

  /* One camera's view into its target. The first-person arms ride the main
     camera (off), our own body's on (we show up on the monitors), the wall's
     screens off (no target reads itself), shadows reused, and the NPCs this
     camera can see shown and posed. */
  function renderFeed(r, scene, c, { npcs, view, rig }) {
    c.zone ??= view ? view.zoneOf(c.pos.x, c.pos.y, c.pos.z) : null;
    const shown = [];
    if (npcs?.list) {
      for (const n of npcs.list) {
        if (n.off || n.rig.root.visible) continue;
        if (Math.hypot(n.x - c.pos.x, n.z - c.pos.z) > NPC_REACH) continue;
        if (view && c.zone && !view.sees(c.zone, n.zone)) continue;
        n.rig.root.visible = true;
        try { if (n.override) npcs.poseOverride(n, 0.016); else npcs.pose(n, 0.016); } catch { /* a half-built one */ }
        shown.push(n);
      }
    }
    const rigVis = rig?.visible;
    if (rig) rig.visible = true;
    group.visible = false;
    const shadow = r.shadowMap.autoUpdate;
    r.shadowMap.autoUpdate = false;
    const prev = r.getRenderTarget();
    try {
      r.setRenderTarget(c.rt);
      r.clear();
      r.render(scene, c.cam);
      api.stats.renders++;
    } finally {
      r.setRenderTarget(prev);
      r.shadowMap.autoUpdate = shadow;
      group.visible = true;
      if (rig) rig.visible = rigVis;
      for (const n of shown) n.rig.root.visible = false;
    }
  }

  return api;
}
