// Troll Royale — the iPod, in first person (drop cinematic, the music
// option; user, 2026-10-17): a classic white click-wheel player with the
// wired earbuds' cord out of the top. Its screen shows Troll Radio's track,
// drawn on a canvas each frame while it's up. Built from primitives like
// the streak devices, with grip anchors ({ right, left }).
//
// Local frame: the face toward +Z (the camera), portrait, metres.

import * as THREE from "three";

const W = 0.062, H = 0.104, D = 0.011;
const PX_W = 256, PX_H = 192;
// The front slab's face (its depth plus the bevel): the screen and the
// wheel sit just proud of it.
const FACE = D * 0.22 + D * 0.275 + 0.0015;

let built = null;

export function ipod() {
  if (built) return built;
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f4f1, roughness: 0.18, metalness: 0.05 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xcfd2d6, roughness: 0.12, metalness: 1 });
  const wheel = new THREE.MeshStandardMaterial({ color: 0xe6e6e2, roughness: 0.55 });
  const grey = new THREE.MeshStandardMaterial({ color: 0x9a9a96, roughness: 0.5 });
  const cord = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.6 });

  // Rounded white slab on a chrome back.
  const front = new THREE.Mesh(roundedSlab(W, H, D * 0.55, 0.008), white);
  front.position.z = D * 0.22;
  const back = new THREE.Mesh(roundedSlab(W * 0.995, H * 0.995, D * 0.5, 0.008), chrome);
  back.position.z = -D * 0.25;
  g.add(front, back);

  // The screen, top half.
  const canvas = document.createElement("canvas");
  canvas.width = PX_W;
  canvas.height = PX_H;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const bezel = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.84, H * 0.36), new THREE.MeshBasicMaterial({ color: 0x1a1a1a }));
  bezel.position.set(0, H * 0.24, FACE + 0.0002);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.8, H * 0.32), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  screen.position.set(0, H * 0.24, FACE + 0.0004);
  g.add(bezel, screen);

  // The click wheel and its centre button, lower half.
  const wheelY = -H * 0.2;
  const ring = new THREE.Mesh(new THREE.CircleGeometry(W * 0.36, 40), wheel);
  ring.position.set(0, wheelY, FACE + 0.0002);
  const centre = new THREE.Mesh(new THREE.CircleGeometry(W * 0.13, 32), white);
  centre.position.set(0, wheelY, FACE + 0.0006);
  g.add(ring, centre);
  // The wheel's labels: MENU, the skips, play/pause, as small grey marks.
  const mark = (x, y, w, h) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), grey); m.position.set(x, wheelY + y, FACE + 0.0004); g.add(m); };
  mark(0, W * 0.27, W * 0.14, W * 0.025);
  mark(W * 0.27, 0, W * 0.05, W * 0.05);
  mark(-W * 0.27, 0, W * 0.05, W * 0.05);
  mark(0, -W * 0.27, W * 0.06, W * 0.04);
  g.userData.centre = centre;
  g.userData.centreZ = centre.position.z;

  // The earbuds' cord out of the jack, up under your chin to the Y, and a
  // branch up each side of your jaw to the bud in that ear (or, buds out,
  // to the buds hanging at your chest). Laid each frame by layoutIpodCord,
  // from where the iPod is in your hands to where your ears are.
  const jack = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.01, 10), cord);
  jack.position.set(W * 0.3, H / 2 + 0.004, 0);
  g.add(jack);
  const wires = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.BufferGeometry(), cord); g.add(m); return m; });
  // The Y's slider, and the buds: a round white head and its stem.
  const slider = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.009, 8), cord);
  g.add(slider);
  const buds = [0, 1].map(() => {
    const b = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 14, 10), white);
    head.scale.set(1, 1, 0.75);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0022, 0.016, 8), white);
    stem.position.y = -0.011;
    b.add(head, stem);
    g.add(b);
    return b;
  });
  g.userData.cord = { wires, slider, buds };

  const anchor = (x, inward) => {
    const a = new THREE.Object3D();
    a.position.set(x, -H * 0.22, 0);
    a.userData.inward = inward;
    return a;
  };
  g.userData.anchors = { right: anchor(W / 2, -1), left: anchor(-W / 2, 1) };
  g.userData.grips = { right: g.userData.anchors.right.position.clone(), left: g.userData.anchors.left.position.clone() };
  g.add(g.userData.anchors.right, g.userData.anchors.left);
  g.userData.screen = { canvas, ctx: canvas.getContext("2d"), tex };
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  g.visible = false;
  built = g;
  return g;
}

/* Where things are in the hands' frame (the viewmodel's: the eye at the
   origin, looking down -z, metres). Your ears, just behind the eye and a
   little under it; the buds hanging at your chest once they're out; the
   cord's Y under your chin (buds in) or at your breastbone (out). [left, right]. */
const EAR = [new THREE.Vector3(-0.074, -0.035, 0.03), new THREE.Vector3(0.074, -0.035, 0.03)];
const JAW = [new THREE.Vector3(-0.062, -0.085, -0.07), new THREE.Vector3(0.062, -0.085, -0.07)];
const HANG = [new THREE.Vector3(-0.03, -0.3, -0.17), new THREE.Vector3(0.035, -0.31, -0.165)];
const Y_IN = new THREE.Vector3(0.0, -0.1, -0.2), Y_OUT = new THREE.Vector3(0.0, -0.22, -0.18);
const _inv = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Vector3(), _y = new THREE.Vector3();
const _bud = [new THREE.Vector3(), new THREE.Vector3()];
const ease = (k) => k * k * (3 - 2 * k);

/* The earbuds and their cord, from the iPod's jack to your ears. `st`:
   { s: [l, r] 0 hanging at your chest .. 1 in that ear, reach: [l, r] 0 the
   hand on the iPod .. 1 at that bud (putting it in, taking it out),
   sway } . Call after the iPod's pose is set (streak-view.js); moves the
   hands' anchors, so before the arms are posed. */
export function layoutIpodCord(dev, st) {
  const c = dev.userData.cord;
  dev.updateMatrix();
  _inv.copy(dev.matrix).invert();   // the hands' frame -> the iPod's
  const sway = st.sway || 0;
  let sIn = 0;
  for (let i = 0; i < 2; i++) {
    const s = ease(Math.min(1, Math.max(0, st.s[i])));
    sIn += s / 2;
    // In the ear, or hanging, swinging a little with the plane; on the way,
    // an arc out from the face (not through your jaw).
    _p.copy(HANG[i]); _p.x += Math.sin(sway * 1.3 + i) * 0.006; _p.z += Math.sin(sway + i * 2) * 0.008;
    _bud[i].lerpVectors(_p, EAR[i], s);
    _bud[i].x += (i ? 1 : -1) * Math.sin(s * Math.PI) * 0.05;
    _bud[i].z -= Math.sin(s * Math.PI) * 0.06;
    const b = c.buds[i];
    b.position.copy(_bud[i]).applyMatrix4(_inv);
    // The stem down along the cord: the bud's up is the iPod-frame up of the hands' frame.
    b.quaternion.copy(dev.quaternion).invert();
    // A hand going for this bud: its grip slides from the iPod to the bud.
    const side = i ? "right" : "left";
    const r = Math.min(1, Math.max(0, st.reach[i]));
    dev.userData.anchors[side].position.lerpVectors(dev.userData.grips[side], _q.copy(_bud[i]).applyMatrix4(_inv), ease(r));
  }
  // The Y under the chin while they're in, lower once they're out.
  _y.lerpVectors(Y_OUT, Y_IN, sIn);
  const yLocal = _y.clone().applyMatrix4(_inv);
  c.slider.position.copy(yLocal);
  c.slider.quaternion.copy(dev.quaternion).invert();
  // The trunk: out of the jack, curling over the iPod's top corner and
  // down its side behind it (not across the screen), then to the Y.
  const jack = new THREE.Vector3(W * 0.3, H / 2 + 0.008, 0);
  const lift = new THREE.Vector3(W * 0.42, H / 2 + 0.022, -0.004);
  const side = new THREE.Vector3(W * 0.68, H * 0.1, -0.014);
  const low = new THREE.Vector3(W * 0.62, -H * 0.42, -0.012);
  setTube(c.wires[0], [jack, lift, side, low, yLocal]);
  // The branches: from the Y past the jaw (while they're in) to each bud.
  for (let i = 0; i < 2; i++) {
    const bud = _bud[i].clone().applyMatrix4(_inv);
    const jaw = _p.lerpVectors(_y, _bud[i], 0.5).lerp(JAW[i], sIn).clone().applyMatrix4(_inv);
    setTube(c.wires[i + 1], [yLocal, jaw, bud]);
  }
}
function setTube(mesh, pts) {
  mesh.geometry.dispose();
  mesh.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.0011, 5, false);
}

/* The thumb on the centre button: 0..1. */
export function pressIpod(dev, k) {
  dev.userData.centre.position.z = dev.userData.centreZ - k * 0.0003;
}

/* The screen. `mode` "list" (picking: the tracks round `index`) or
   "playing" (now playing, with the elapsed bar); `t` seconds into it. */
export function drawIpod(dev, { mode, tracks, index, t = 0, length = 180 }) {
  const s = dev.userData.screen, g = s.ctx;
  g.fillStyle = "#e9eef3";
  g.fillRect(0, 0, PX_W, PX_H);
  // The title bar.
  const bar = g.createLinearGradient(0, 0, 0, 26);
  bar.addColorStop(0, "#f8fafc");
  bar.addColorStop(1, "#c9d2dc");
  g.fillStyle = bar;
  g.fillRect(0, 0, PX_W, 26);
  g.fillStyle = "#1d2630";
  g.font = "bold 15px sans-serif";
  g.textBaseline = "middle";
  g.textAlign = "center";
  g.fillText(mode === "list" ? "Troll Radio" : "Now Playing", PX_W / 2, 13);
  // The battery, top right.
  g.strokeStyle = "#1d2630"; g.lineWidth = 1.5;
  g.strokeRect(PX_W - 34, 7, 22, 12);
  g.fillStyle = "#3fae4a"; g.fillRect(PX_W - 32, 9, 15, 8);
  g.textAlign = "left";
  const tr = tracks[index] || { title: "—", artist: "" };
  if (mode === "list") {
    const rows = 6, rh = 27;
    const first = Math.max(0, Math.min(tracks.length - rows, index - 2));
    for (let i = 0; i < rows && first + i < tracks.length; i++) {
      const y = 28 + i * rh;
      const sel = first + i === index;
      if (sel) {
        const hl = g.createLinearGradient(0, y, 0, y + rh);
        hl.addColorStop(0, "#5fa4ee");
        hl.addColorStop(1, "#2a6fc9");
        g.fillStyle = hl;
        g.fillRect(0, y, PX_W, rh);
      }
      g.fillStyle = sel ? "#fff" : "#1d2630";
      g.font = `${sel ? "bold " : ""}15px sans-serif`;
      g.fillText(clip(g, tracks[first + i].title, PX_W - 30), 8, y + rh / 2);
      if (sel) g.fillText("›", PX_W - 16, y + rh / 2);
    }
  } else {
    // Album art: the trollface on a gradient square, then the track.
    const art = g.createLinearGradient(10, 36, 90, 116);
    art.addColorStop(0, "#2a2f45");
    art.addColorStop(1, "#7a3b62");
    g.fillStyle = art;
    g.fillRect(10, 36, 84, 84);
    g.fillStyle = "#fff";
    g.font = "bold 13px sans-serif";
    g.fillText("TROLL", 26, 70);
    g.fillText("RADIO", 26, 88);
    g.fillStyle = "#1d2630";
    g.font = "bold 16px sans-serif";
    g.fillText(clip(g, tr.title, PX_W - 112), 104, 52);
    g.font = "14px sans-serif";
    g.fillStyle = "#4a5562";
    g.fillText(clip(g, tr.artist, PX_W - 112), 104, 76);
    g.fillText(`${index + 1} of ${tracks.length}`, 104, 100);
    // The elapsed bar.
    const k = Math.min(1, t / length);
    g.fillStyle = "#c7cfd8"; g.fillRect(12, 150, PX_W - 24, 9);
    g.fillStyle = "#2a6fc9"; g.fillRect(12, 150, (PX_W - 24) * k, 9);
    g.fillStyle = "#1d2630";
    g.font = "12px sans-serif";
    g.fillText(clock(t), 12, 174);
    g.textAlign = "right";
    g.fillText(`-${clock(Math.max(0, length - t))}`, PX_W - 12, 174);
  }
  s.tex.needsUpdate = true;
}

function clip(g, text, w) {
  if (g.measureText(text).width <= w) return text;
  let s = text;
  while (s.length > 1 && g.measureText(s + "…").width > w) s = s.slice(0, -1);
  return s + "…";
}
const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

function roundedSlab(w, h, d, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 2 });
  geo.translate(0, 0, -d / 2);
  return geo;
}
