// Troll Forces — the Keyboard Warrior's shield, and what happens when it
// takes one round too many (user, 2026-10-03): "a funny animation where it
// tries to repair the keyboard … include some computer gear for repair,
// before coming back to the default keyboard sword holding stance".
//
// Holding aim with the keyboard raises it flat across the body, keys out.
// A few consecutive hits (game.js kbShield) and it breaks: the keyboard comes down onto your lap and gets a quick flip onto its
// back (user: "a small flip face the backside and then the rest of the
// animation"). The off hand backs the four screws out of the back panel,
// lifts the lid off the circuit board, solders it, plugs a USB cable into
// the edge, and a little tablet reports on the reboot. The lid goes back
// on, it flips over again and comes back up into the stance.
//
// Everything here is first-person viewmodel: the keyboard mesh lives in
// the weapon rig (view space: camera at the origin looking down -Z), its own
// frame has the keys facing +Y and the blade running down -Z from the grip.
// The arms reach for the mesh's hand markers (game.js poseMeleeArms), so
// moving the support hand moves the real left arm, tool and all.

import * as THREE from "three";

export const KB_REPAIR_TIME = 3.8;

// View-space poses. The basis maps the keyboard's own axes (x, y = keys,
// z = back along the blade) into view space.
function poseQuat(x, y, z) {
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(...x).normalize(), new THREE.Vector3(...y).normalize(), new THREE.Vector3(...z).normalize());
  return new THREE.Quaternion().setFromRotationMatrix(m);
}
// Shield: blade straight across the view to the left, keys facing out at
// whoever is shooting, tipped back a little so the RGB edge shows.
// Up across the body, low enough to see over, the lit keys toward you
// (the case takes the rounds).
export const KB_SHIELD = {
  pos: new THREE.Vector3(0.55, -0.27, -0.55),
  quat: poseQuat([0, 0.98, -0.2], [0, 0.2, 0.98], [1, 0, 0]),
};
// Repair: down on the lap, keys up and tilted toward you like a laptop.
export const KB_REPAIR = {
  pos: new THREE.Vector3(0.55, -0.25, -0.7),
  quat: poseQuat([0, 0.8, -0.6], [0, 0.6, 0.8], [1, 0, 0]),
};

const sm = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };

/* ---------------------------------------------------------------- tools */
function mat(color, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1, ...extra }); }
function part(geo, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); return o; }

/* Each tool hangs down -Y from where the hand holds it, tip at y = -len. */
const STEEL = () => mat(0xc9ccd2, { metalness: 0.92, roughness: 0.22 });
function screwdriver() {
  const g = new THREE.Group();
  // Handle: a yellow barrel with dark flutes for grip, a domed butt, a black collar.
  g.add(part(new THREE.CylinderGeometry(0.011, 0.013, 0.07, 28), mat(0xf2c21b, { roughness: 0.35 }), 0, -0.02, 0));
  g.add(part(new THREE.SphereGeometry(0.011, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xf2c21b, { roughness: 0.35 }), 0, 0.015, 0));
  const flute = mat(0x7a5c06, { roughness: 0.6 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const f = part(new THREE.BoxGeometry(0.0026, 0.05, 0.0026), flute, Math.cos(a) * 0.0113, -0.018, Math.sin(a) * 0.0113);
    f.rotation.y = -a;
    g.add(f);
  }
  g.add(part(new THREE.CylinderGeometry(0.0125, 0.0125, 0.012, 28), mat(0x161616, { roughness: 0.4 }), 0, -0.058, 0));
  g.add(part(new THREE.CylinderGeometry(0.006, 0.0125, 0.006, 24), mat(0x161616, { roughness: 0.4 }), 0, -0.067, 0));
  g.add(part(new THREE.CylinderGeometry(0.0032, 0.0032, 0.064, 16), STEEL(), 0, -0.098, 0));
  // Phillips tip: a taper and two crossed blades.
  g.add(part(new THREE.CylinderGeometry(0.0012, 0.0032, 0.008, 16), STEEL(), 0, -0.134, 0));
  g.add(part(new THREE.BoxGeometry(0.0055, 0.008, 0.0012), STEEL(), 0, -0.135, 0));
  g.add(part(new THREE.BoxGeometry(0.0012, 0.008, 0.0055), STEEL(), 0, -0.135, 0));
  g.userData.len = 0.14;
  return g;
}
function solderingIron() {
  const g = new THREE.Group();
  g.add(part(new THREE.CylinderGeometry(0.012, 0.012, 0.075, 28), mat(0x1f6fe0, { roughness: 0.35 }), 0, -0.02, 0));
  // Rubber grip rings near the business end, and a cap at the cord end.
  const rubber = mat(0x101216, { roughness: 0.85 });
  for (let i = 0; i < 4; i++) {
    const r = part(new THREE.TorusGeometry(0.0122, 0.0016, 8, 28), rubber, 0, -0.035 - i * 0.007, 0);
    r.rotation.x = Math.PI / 2;
    g.add(r);
  }
  g.add(part(new THREE.CylinderGeometry(0.008, 0.012, 0.01, 24), rubber, 0, 0.022, 0));
  g.add(part(new THREE.CylinderGeometry(0.009, 0.006, 0.03, 24), mat(0x9aa0a8, { metalness: 0.8, roughness: 0.3 }), 0, -0.072, 0));
  // Heat-blued barrel, then the tip.
  g.add(part(new THREE.CylinderGeometry(0.0028, 0.0028, 0.045, 16), mat(0x8a7fa8, { metalness: 0.9, roughness: 0.28 }), 0, -0.108, 0));
  const tip = part(new THREE.ConeGeometry(0.0034, 0.014, 16), new THREE.MeshBasicMaterial({ color: 0xff7a2a }), 0, -0.137, 0);
  tip.rotation.x = Math.PI;
  g.add(tip);
  // The hot glow round the tip (no real light: see light-pool.js).
  g.add(part(new THREE.SphereGeometry(0.0075, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xff8a3a, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }), 0, -0.139, 0));
  // a coil of cord off the back
  const cord = part(new THREE.TorusGeometry(0.02, 0.0025, 10, 32, Math.PI * 1.4), mat(0x202020, { roughness: 0.7 }), 0.012, 0.03, 0);
  cord.rotation.y = Math.PI / 2;
  g.add(cord);
  g.userData.len = 0.145;
  g.userData.tip = tip;
  return g;
}
function usbCable() {
  const g = new THREE.Group();
  // Overmould with grip ridges and the trident on its face.
  const mould = mat(0x2a2a2e, { roughness: 0.55 });
  g.add(part(new THREE.BoxGeometry(0.016, 0.034, 0.008), mould, 0, -0.02, 0));
  for (let i = 0; i < 5; i++) g.add(part(new THREE.BoxGeometry(0.0168, 0.0012, 0.0084), mat(0x18181b), 0, -0.006 - i * 0.0035, 0));
  g.add(part(new THREE.PlaneGeometry(0.009, 0.009), new THREE.MeshBasicMaterial({ map: usbLogoTex(), transparent: true, depthWrite: false }), 0, -0.028, 0.0041));
  // Metal shell, its two latch holes, and the contacts tongue inside.
  g.add(part(new THREE.BoxGeometry(0.012, 0.016, 0.0045), mat(0xd7d9de, { metalness: 0.9, roughness: 0.22 }), 0, -0.045, 0));
  for (const x of [-0.003, 0.003]) g.add(part(new THREE.BoxGeometry(0.002, 0.002, 0.0047), mat(0x111111), x, -0.047, 0));
  g.add(part(new THREE.BoxGeometry(0.0096, 0.0012, 0.0012), mat(0xd4a83a, { metalness: 0.9, roughness: 0.3 }), 0, -0.0529, 0.0008));
  // Strain relief, then the cable trailing up and away out of view.
  g.add(part(new THREE.CylinderGeometry(0.0038, 0.0055, 0.012, 20), mould, 0, 0.002, 0));
  const pts = [];
  for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(new THREE.Vector3(Math.sin(t * 3) * 0.03 + t * 0.05, 0.008 + t * 0.25, -t * 0.04)); }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.0035, 12), mat(0x1a1a1a, { roughness: 0.6 })));
  g.userData.len = 0.053;
  return g;
}

/* Canvases are drawn in their logical size and stored `scale` times bigger,
   so text and traces stay sharp up close. */
function canvasTexture(w, h, draw, scale = 4) {
  const c = document.createElement("canvas");
  c.width = w * scale; c.height = h * scale;
  const x = c.getContext("2d");
  x.scale(scale, scale);
  draw(x, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
let usbLogo = null;
function usbLogoTex() {
  return usbLogo ||= canvasTexture(64, 64, (x) => {
    x.strokeStyle = x.fillStyle = "#c9ccd2"; x.lineWidth = 3; x.lineCap = "round";
    x.beginPath(); x.moveTo(32, 56); x.lineTo(32, 12); x.stroke();
    x.beginPath(); x.moveTo(32, 6); x.lineTo(26, 16); x.lineTo(38, 16); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(32, 40); x.lineTo(18, 30); x.lineTo(18, 22); x.stroke();
    x.beginPath(); x.arc(18, 20, 4, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.moveTo(32, 46); x.lineTo(46, 34); x.lineTo(46, 26); x.stroke();
    x.fillRect(42, 20, 8, 7);
    x.beginPath(); x.arc(32, 56, 5, 0, Math.PI * 2); x.fill();
  });
}

/* Seeded, so the board is laid out the same every time it's opened. */
function boardRng(seed = 1337) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* The keyboard's back, in its own frame: the case's underside is the plane
   y = -BACK_Y, facing -Y. A lid held on by four screws covers the circuit
   board. */
// The case's underside is at 0.019, but its own recessed back plate
// (gear.js buildKeyboardSword) stands 4 mm proud of that: build on top of it.
const BACK_Y = 0.023;
const PANEL = { w: 0.25, l: 0.5, z: -0.58 };
const SCREWS = [[0.105, -0.36], [-0.105, -0.36], [-0.105, -0.8], [0.105, -0.8]];
function backPanel() {
  const g = new THREE.Group();
  const R = boardRng();
  // The circuit board: solder mask, copper traces routed in straights and
  // 45s, vias, tinned pads, and the white silkscreen.
  const pcbTex = canvasTexture(256, 512, (x, W, H) => {
    const grad = x.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#17773b"); grad.addColorStop(1, "#11582b");
    x.fillStyle = grad; x.fillRect(0, 0, W, H);
    // ground pour, a shade darker, inside a keep-out margin
    x.fillStyle = "rgba(6, 50, 22, 0.35)"; x.fillRect(8, 8, W - 16, H - 16);
    x.strokeStyle = "rgba(230, 196, 104, 0.85)"; x.lineCap = "round"; x.lineJoin = "round";
    for (let i = 0; i < 70; i++) {
      x.lineWidth = R() < 0.25 ? 2.6 : 1.3;
      x.beginPath();
      let px = 12 + R() * (W - 24), py = 12 + R() * (H - 24);
      x.moveTo(px, py);
      for (let j = 0; j < 3 + (R() * 3 | 0); j++) {
        const len = 12 + R() * 60, dir = (R() * 8) | 0;
        const dx = [1, 1, 0, -1, -1, -1, 0, 1][dir], dy = [0, 1, 1, 1, 0, -1, -1, -1][dir];
        px = Math.max(12, Math.min(W - 12, px + dx * len));
        py = Math.max(12, Math.min(H - 12, py + dy * len));
        x.lineTo(px, py);
      }
      x.stroke();
      // a via at the end of most runs
      if (R() < 0.7) {
        x.fillStyle = "#e6c468"; x.beginPath(); x.arc(px, py, 2.6, 0, Math.PI * 2); x.fill();
        x.fillStyle = "#0b2a15"; x.beginPath(); x.arc(px, py, 1.1, 0, Math.PI * 2); x.fill();
      }
    }
    // tinned pads in rows
    x.fillStyle = "#d9d9d2";
    for (let r = 0; r < 14; r++) {
      const px = 20 + R() * (W - 50), py = 20 + R() * (H - 40), n = 3 + (R() * 6 | 0), vert = R() < 0.5;
      for (let k = 0; k < n; k++) x.fillRect(px + (vert ? 0 : k * 5), py + (vert ? k * 5 : 0), vert ? 6 : 3, vert ? 3 : 6);
    }
    // silkscreen: part outlines and designators, the logo, a revision
    x.strokeStyle = "#f2f5f2"; x.fillStyle = "#f2f5f2"; x.lineWidth = 0.9;
    x.font = "bold 7px monospace"; x.textAlign = "left";
    for (const d of ["U1", "U2", "U3", "C4", "C7", "C12", "R3", "R9", "R14", "D1", "Y1", "Q2", "LED1", "J1", "SW1", "F1"]) {
      const px = 16 + R() * (W - 50), py = 16 + R() * (H - 40), w = 10 + R() * 18, h = 6 + R() * 12;
      x.strokeRect(px, py, w, h);
      x.fillText(d, px, py - 2);
    }
    x.textAlign = "center";
    x.save(); x.translate(W / 2, H / 2); x.rotate(-Math.PI / 2);
    // the logo sits on clear board, routing kept out from under it
    x.fillStyle = "#11602f";
    x.fillRect(-120, -88, 240, 26); x.fillRect(-120, 72, 240, 38);
    x.fillStyle = "#f2f5f2";
    x.font = "bold 18px monospace";
    x.fillText("TROLL-KB  REV 1.337", 0, -70);
    x.fillText("U MAD BRO? (tm)", 0, 90);
    x.font = "8px monospace";
    x.fillText("DESIGNED IN GRINLAND  //  DO NOT RAGE QUIT", 0, 104);
    x.restore();
    // mounting holes in the corners
    for (const [hx, hy] of [[10, 10], [W - 10, 10], [10, H - 10], [W - 10, H - 10]]) {
      x.fillStyle = "#e6c468"; x.beginPath(); x.arc(hx, hy, 6, 0, Math.PI * 2); x.fill();
      x.fillStyle = "#050806"; x.beginPath(); x.arc(hx, hy, 3.4, 0, Math.PI * 2); x.fill();
    }
  });
  // A thin slab standing just off the case (a plane on the case's own face
  // lost the depth test to it).
  const pcb = part(new THREE.BoxGeometry(PANEL.w - 0.02, 0.002, PANEL.l - 0.02), new THREE.MeshStandardMaterial({ map: pcbTex, emissiveMap: pcbTex, emissive: 0xffffff, emissiveIntensity: 0.14, roughness: 0.45, metalness: 0.05 }), 0, -BACK_Y - 0.002, PANEL.z);
  g.add(pcb);

  // Components sit on the board's outer face (-Y), all inside the lid's depth.
  const top = -BACK_Y - 0.003;
  const on = (geo, m, cx, cz, h) => { const o = part(geo, m, cx, top - h / 2, cz); g.add(o); return o; };
  const pinMat = mat(0xd8dade, { metalness: 0.9, roughness: 0.25 });
  const chipMat = mat(0x141418, { roughness: 0.55 });
  const label = (text, w, l, cx, cz, h) => {
    const t = canvasTexture(128, Math.round(128 * l / w), (x, W, H) => {
      x.fillStyle = "#d6d8dc"; x.textAlign = "center"; x.font = "bold 18px monospace";
      x.fillText(text, W / 2, H / 2 + 2, W - 8);
      x.font = "11px monospace"; x.fillText("2609-TR", W / 2, H / 2 + 18);
      x.beginPath(); x.arc(12, 12, 5, 0, Math.PI * 2); x.fill();   // pin-1 dot
    });
    const p = part(new THREE.PlaneGeometry(w * 0.92, l * 0.92), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }), cx, top - h - 0.0002, cz);
    p.quaternion.copy(BACK_FACE_Q);
    g.add(p);
  };
  // gull-wing pins down the sides of a chip (`quad`: all four sides)
  const pinGeo = new THREE.BoxGeometry(0.0009, 0.0007, 0.0026);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const pins = (cx, cz, w, l, n, quad) => {
    const sides = quad ? [0, 1, 2, 3] : [0, 1];
    const im = new THREE.InstancedMesh(pinGeo, pinMat, sides.length * n);
    let i = 0;
    for (const side of sides) {
      const alongX = side >= 2;   // pins on the z edges are spread along x
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n - 0.5;
        if (alongX) { v.set(cx + t * w * 0.85, top - 0.0004, cz + (side === 2 ? -1 : 1) * (l / 2 + 0.0011)); q.identity(); }
        else { v.set(cx + (side === 0 ? -1 : 1) * (w / 2 + 0.0011), top - 0.0004, cz + t * l * 0.85); q.setFromAxisAngle(Y, Math.PI / 2); }
        im.setMatrixAt(i++, m4.compose(v, q, one));
      }
    }
    g.add(im);
  };
  const chip = (name, cx, cz, w, l, n, quad, m = chipMat) => {
    on(new THREE.BoxGeometry(w, 0.003, l), m, cx, cz, 0.003);
    pins(cx, cz, w, l, n, quad);
    label(name, w, l, cx, cz, 0.003);
  };
  // the MCU (a QFP), two SOIC chips, the RGB controller
  chip("TROLL-MCU", 0.03, -0.66, 0.045, 0.045, 14, true);
  chip("GRIN-ROM", -0.05, -0.48, 0.03, 0.04, 8, false);
  chip("KEK-232", 0.055, -0.42, 0.022, 0.036, 7, false);
  chip("RGB", -0.04, -0.72, 0.03, 0.03, 9, true, mat(0x3a1060, { roughness: 0.4 }));
  // electrolytic caps: blue cans with a scored silver top
  const can = mat(0x1d3fa0, { roughness: 0.35 }), canTop = mat(0xc9ccd2, { metalness: 0.85, roughness: 0.3 }), score = mat(0x6a6e76);
  for (const [cx, cz] of [[-0.075, -0.6], [-0.062, -0.6], [0.08, -0.55], [0.0, -0.78]]) {
    on(new THREE.CylinderGeometry(0.0045, 0.0045, 0.008, 24), can, cx, cz, 0.008);
    g.add(part(new THREE.CylinderGeometry(0.0041, 0.0041, 0.0004, 24), canTop, cx, top - 0.0082, cz));
    g.add(part(new THREE.BoxGeometry(0.006, 0.0004, 0.0006), score, cx, top - 0.0085, cz));
    g.add(part(new THREE.BoxGeometry(0.0006, 0.0004, 0.006), score, cx, top - 0.0085, cz));
  }
  // crystal, fuse, and a USB-C port on the edge
  on(new THREE.BoxGeometry(0.009, 0.003, 0.004), mat(0xd0d3d8, { metalness: 0.9, roughness: 0.2 }), -0.01, -0.62, 0.003);
  on(new THREE.BoxGeometry(0.004, 0.002, 0.009), mat(0x2e7a4a), 0.07, -0.74, 0.002);
  on(new THREE.BoxGeometry(0.012, 0.0035, 0.008), mat(0xd7d9de, { metalness: 0.92, roughness: 0.2 }), 0, -0.345, 0.0035);
  // a scatter of SMD resistors and caps: dark bodies, tan ceramics
  {
    const n = 46;
    const res = new THREE.InstancedMesh(new THREE.BoxGeometry(0.0034, 0.0014, 0.0017), mat(0x1c1c1c, { roughness: 0.5 }), n);
    const cer = new THREE.InstancedMesh(new THREE.BoxGeometry(0.0034, 0.0015, 0.0017), mat(0xb48a54, { roughness: 0.45 }), n);
    for (let i = 0; i < n; i++) {
      v.set((R() - 0.5) * 0.2, top - 0.0008, PANEL.z + (R() - 0.5) * 0.44);
      q.setFromAxisAngle(Y, R() < 0.5 ? 0 : Math.PI / 2);
      res.setMatrixAt(i, m4.compose(v, q, one));
      v.x += (R() - 0.5) * 0.04; v.z += (R() - 0.5) * 0.04;
      cer.setMatrixAt(i, m4.compose(v, q, one));
    }
    g.add(res, cer);
  }
  // the RGB LED strip down one edge, lit
  for (let i = 0; i < 10; i++) {
    on(new THREE.BoxGeometry(0.004, 0.0014, 0.004), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(i / 10, 1, 0.55) }), 0.1, -0.4 - i * 0.04, 0.0014);
  }

  // The lid: warranty sticker, vent slots, rubber feet, and the four screws.
  const lid = new THREE.Group();
  // Flush with the case and deep enough to hold the board and chips inside it.
  lid.add(part(new THREE.BoxGeometry(PANEL.w, 0.011, PANEL.l), mat(0x1c1c20, { roughness: 0.62 }), 0, 0, 0));
  const vent = mat(0x0a0a0c);
  for (let i = 0; i < 7; i++) lid.add(part(new THREE.BoxGeometry(0.06, 0.0008, 0.0035), vent, -0.06, -0.0057, -0.17 + i * 0.008));
  const foot = mat(0x0e0e10, { roughness: 0.95 });
  for (const [fx, fz] of [[0.1, 0.22], [-0.1, 0.22], [0.1, -0.22], [-0.1, -0.22]]) {
    lid.add(part(new THREE.CylinderGeometry(0.008, 0.009, 0.0025, 20), foot, fx, -0.0065, fz));
  }
  const stickerTex = canvasTexture(256, 128, (x, W, H) => {
    x.fillStyle = "#f1f1ea"; x.fillRect(0, 0, W, H);
    x.strokeStyle = "#c81e1e"; x.lineWidth = 3; x.strokeRect(6, 6, W - 12, H - 12);
    x.fillStyle = "#c81e1e"; x.textAlign = "center";
    x.font = "bold 24px sans-serif"; x.fillText("WARRANTY VOID", W / 2, 46);
    x.fillText("IF REMOVED", W / 2, 74);
    x.fillStyle = "#333"; x.font = "13px sans-serif"; x.fillText("Made in Grinland  ·  S/N TR-000420", W / 2, 104);
  });
  // Sticker on the outer face (-Y), reading up the screen in the lap pose.
  const sticker = part(new THREE.PlaneGeometry(0.11, 0.055), new THREE.MeshStandardMaterial({ map: stickerTex, roughness: 0.6 }), 0, -0.0058, 0.05);
  sticker.quaternion.copy(BACK_FACE_Q);
  lid.add(sticker);
  lid.position.set(0, -BACK_Y - 0.0075, PANEL.z);
  g.add(lid);
  const head = mat(0xb8bcc4, { metalness: 0.88, roughness: 0.25 }), slot = mat(0x2a2a2a);
  const screws = SCREWS.map(([sx, sz]) => {
    const sc = new THREE.Group();
    sc.add(part(new THREE.CylinderGeometry(0.0075, 0.0075, 0.003, 32), head));
    // Phillips cross
    sc.add(part(new THREE.BoxGeometry(0.0105, 0.0012, 0.0018), slot, 0, -0.0016, 0));
    sc.add(part(new THREE.BoxGeometry(0.0018, 0.0012, 0.0105), slot, 0, -0.0016, 0));
    sc.userData.home = new THREE.Vector3(sx, -BACK_Y - 0.0145, sz);
    sc.position.copy(sc.userData.home);
    g.add(sc);
    return sc;
  });
  return { group: g, lid, screws, lidHome: lid.position.clone() };
}

/* The diagnostic tablet: a black tablet floating in the view (user,
   2026-10-03: keep the black tablet, have it float like a messenger). The
   screen is a canvas redrawn when its text changes, stored 2x for sharp text. */
function screen() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 320;   // drawn at 256 x 160
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const g = new THREE.Group();
  // Black body with a rounded-off bezel edge, a camera dot, a home button.
  const body = mat(0x111114, { roughness: 0.35, metalness: 0.2 });
  g.add(part(new THREE.BoxGeometry(0.17, 0.112, 0.008), body));
  g.add(part(new THREE.BoxGeometry(0.166, 0.108, 0.0004), mat(0x1c1c22, { roughness: 0.2, metalness: 0.3 }), 0, 0, 0.0041));
  g.add(part(new THREE.CylinderGeometry(0.0016, 0.0016, 0.0006, 12), mat(0x050507), 0, 0.0515, 0.0042).rotateX(Math.PI / 2));
  g.add(part(new THREE.BoxGeometry(0.03, 0.002, 0.003), mat(0x222228), 0.04, 0.057, 0));   // power button on top
  const face = part(new THREE.PlaneGeometry(0.156, 0.098), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), 0, 0, 0.0046);
  g.add(face);
  let last = "";
  g.userData.draw = (title, pct, blue) => {
    const key = `${title}|${Math.round(pct * 100)}|${blue}`;
    if (key === last) return;
    last = key;
    const x = c.getContext("2d");
    x.setTransform(2, 0, 0, 2, 0, 0);
    x.fillStyle = blue ? "#1546c8" : "#0b0d10";
    x.fillRect(0, 0, 256, 160);
    // a status bar along the top
    x.fillStyle = "rgba(255, 255, 255, 0.55)";
    x.font = '9px "DM Mono", monospace';
    x.textAlign = "left"; x.fillText("TROLL-OS", 8, 12);
    x.textAlign = "right"; x.fillText("100%", 230, 12);
    x.strokeStyle = "rgba(255, 255, 255, 0.55)"; x.lineWidth = 1;
    x.strokeRect(234, 5, 14, 8); x.fillRect(236, 7, 10, 4);
    x.fillStyle = "#f2f4f8";
    x.textAlign = "center";
    const lines = title.split("\n");
    x.font = `bold ${blue ? 22 : 20}px "DM Mono", monospace`;
    lines.forEach((l, i) => x.fillText(l, 128, 50 + i * 26, 240));
    if (pct >= 0) {
      x.strokeStyle = "#f2f4f8"; x.lineWidth = 2; x.strokeRect(28, 116, 200, 16);
      x.fillStyle = "#7fe066"; x.fillRect(31, 119, 194 * pct, 10);
    }
    tex.needsUpdate = true;
  };
  return g;
}

const TOOL_SCALE = 1.5;
// Keyboard frame, flipped onto its back: -X is up the screen, -Y toward you.
const TOOL_LEAN = new THREE.Vector3(-0.55, -0.7, 0.45).normalize();
const FLIP_AXIS = new THREE.Vector3(0, 0, 1);
const _flipQ = new THREE.Quaternion();
const _toolQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
const _negZ = new THREE.Vector3(0, 0, -1), _dir = new THREE.Vector3(), _hand = new THREE.Vector3();
// Face out of the back (-Y), text up the screen (-X).
const TABLET_Q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
  new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, -1, 0)));
const BACK_FACE_Q = TABLET_Q;
// The tablet in view space: camera at the origin looking down -Z.
// Up and to the left, so you look up at it (KB_GLANCE) rather than down.
const TABLET_VIEW_POS = new THREE.Vector3(-0.1, 0.075, -0.46);
const TABLET_VIEW_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.16, 0.2, 0.03));
// Midway through (user: "as if your head is looking up to see that message
// WHILE you are repairing"): the head tips up and left onto the tablet,
// reads it, and goes back down to the work. game.js turns both cameras.
export const KB_GLANCE = { pitch: 0.16, yaw: 0.2, from: 0.56, to: 0.72 };

/* ------------------------------------------------------------- the act */
export function createKeyboardRepair({ audio } = {}) {
  let built = null;
  const st = { t: 0, active: false, cued: new Set() };

  function build() {
    const tools = { screw: screwdriver(), iron: solderingIron(), usb: usbCable() };
    const sparks = [];
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffb04a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 8; i++) sparks.push({ mesh: new THREE.Mesh(new THREE.SphereGeometry(0.0022, 4, 4), sparkMat), v: new THREE.Vector3(), life: 0 });
    built = { tools, sparks, monitor: screen(), back: backPanel() };
  }

  /* Pull everything off whatever it was attached to. */
  function stow() {
    if (!built) return;
    for (const t of Object.values(built.tools)) t.parent?.remove(t);
    for (const s of built.sparks) s.mesh.parent?.remove(s.mesh);
    built.monitor.parent?.remove(built.monitor);
    built.back.group.parent?.remove(built.back.group);
  }

  function cue(name, at) {
    if (st.cued.has(name) || st.t < at) return;
    st.cued.add(name);
    audio?.kbRepairCue?.(name);
  }

  return {
    get active() { return st.active; },
    get t() { return st.t; },
    /* 0..1: how far the head is turned up onto the tablet. */
    get glance() {
      if (!st.active) return 0;
      const k = st.t / KB_REPAIR_TIME, G = KB_GLANCE;
      return sm(G.from, G.from + 0.04, k) * (1 - sm(G.to - 0.04, G.to, k));
    },
    start() {
      if (!built) build();
      st.t = 0; st.active = true; st.cued.clear();
    },
    stop() { st.active = false; st.t = 0; stow(); },
    seek(t) { st.t = t; },   // tests and screenshots

    /* Pose the keyboard (`mesh`, already at its normal pose this frame)
       and its support hand. `hands` is game.js meleeHands(mesh). Returns
       false once the act is over. */
    update(dt, mesh, hands) {
      if (!st.active) return false;
      st.t += dt;
      const T = KB_REPAIR_TIME;
      const k = st.t / T;
      if (k >= 1) { this.stop(); return false; }
      const { tools, sparks, monitor } = built;
      const support = hands?.[1]?.obj;

      // Down onto the lap, a quick flip onto its back, the work, a flip
      // back over and up into the stance.
      const into = sm(0, 0.08, k), outOf = sm(0.9, 1, k);
      const w = into * (1 - outOf);
      const flip = sm(0.07, 0.15, k) - sm(0.84, 0.91, k);       // 0 keys up, 1 on its back
      const flipping = Math.sin(Math.PI * Math.min(1, Math.max(0, k < 0.5 ? (k - 0.07) / 0.08 : (k - 0.84) / 0.07)));
      const restPos = mesh.position.clone(), restQuat = mesh.quaternion.clone();
      mesh.position.lerpVectors(restPos, KB_REPAIR.pos, w);
      mesh.position.y += flipping * 0.07;                         // tossed up a little to turn it
      mesh.quaternion.slerpQuaternions(restQuat, KB_REPAIR.quat, w);
      mesh.quaternion.multiply(_flipQ.setFromAxisAngle(FLIP_AXIS, flip * Math.PI));
      // the shot-up shudder at the start, the satisfied twirl at the end
      const shudder = (1 - sm(0, 0.06, k)) * 0.03;
      mesh.position.x += Math.sin(st.t * 70) * shudder;
      mesh.rotateZ(Math.sin(st.t * 55) * shudder * 4 + Math.sin(outOf * Math.PI) * 0.6);
      if (flip > 0.02 && flip < 0.98 && !st.cued.has(k < 0.5 ? "flip" : "flip2")) cue(k < 0.5 ? "flip" : "flip2", 0);

      // The break itself: no keycaps flying off (user, 2026-10-03), just the clatter.
      cue("clatter", 0);

      // The back panel: on the board for the whole act.
      const { back } = built;
      if (back.group.parent !== mesh) mesh.add(back.group);
      // Screws come out one by one under the screwdriver (0.15-0.37) and go
      // back in a blink when the lid does (0.84).
      const SCREW0 = 0.15, SCREW_STEP = 0.055;
      back.screws.forEach((sc, i) => {
        const a = SCREW0 + i * SCREW_STEP;
        const out = k < 0.84 ? sm(a + 0.02, a + SCREW_STEP, k) : 0;
        sc.visible = out < 0.999;
        sc.position.copy(sc.userData.home);
        sc.position.y -= out * 0.03;
        sc.position.x -= out * out * 0.12;            // flicked away up the screen
        sc.rotation.y = out * 25;
      });
      // The lid lifts off and away (0.37-0.43), and back on (0.82-0.86).
      const lidOff = sm(0.37, 0.43, k) - sm(0.8, 0.85, k);
      back.lid.position.copy(back.lidHome);
      back.lid.position.y -= lidOff * 0.06;
      back.lid.position.x -= lidOff * 0.32;
      back.lid.rotation.z = lidOff * 0.5;
      back.lid.visible = lidOff < 0.98;
      if (lidOff > 0.05 && k < 0.5) cue("lid", 0);

      // The off hand's job, in the keyboard's own frame: which tool, and
      // where its tip is working.
      let tool = null;
      const spot = new THREE.Vector3();
      if (k >= SCREW0 && k < SCREW0 + SCREW_STEP * 4) {
        tool = tools.screw;
        const i = Math.min(3, Math.floor((k - SCREW0) / SCREW_STEP));
        cue("screw" + i, 0);
        const [sx, sz] = SCREWS[i];
        const a = st.t * 9;
        spot.set(sx + Math.cos(a) * 0.004, -BACK_Y - 0.016, sz + Math.sin(a) * 0.004);
      } else if (k >= 0.44 && k < 0.64) {
        tool = tools.iron;
        cue("solder", T * 0.45); cue("solder2", T * 0.55);
        // two dabs on the board, a little lift between
        const dab = Math.abs(Math.sin(st.t * 6));
        spot.set(k < 0.54 ? 0.03 : -0.05, -BACK_Y - 0.008 - dab * 0.03, k < 0.54 ? -0.66 : -0.48);
      } else if (k >= 0.64 && k < 0.8) {
        tool = tools.usb;
        cue("plug", T * 0.68);
        // into the port on the edge nearest you (the arm stays clear of the
        // tablet at the far end)
        const p = sm(0.64, 0.7, k);
        spot.set(0.15 + (1 - p) * 0.06, -0.005, -0.36);
      }
      for (const t of Object.values(tools)) if (t !== tool) t.parent?.remove(t);
      if (support) {
        if (tool) {
          // On the keyboard, not the hand marker: game.js hides the marker
          // every frame (the rod reaches there instead), children and all.
          if (tool.parent !== mesh) mesh.add(tool);
          tool.scale.setScalar(TOOL_SCALE);
          const len = tool.userData.len * TOOL_SCALE;
          // The tool leans out of the work toward the top right of the view,
          // so it reads beside the fist instead of hiding behind it: the
          // hand sits up that lean, its grip axis (-Z, game.js
          // _meleeAxisDefault) pointing down the tool to the tip.
          support.position.lerp(_hand.copy(spot).addScaledVector(TOOL_LEAN, len), 1 - Math.exp(-dt * 18));
          support.quaternion.setFromUnitVectors(_negZ, _dir.copy(TOOL_LEAN).negate());
          // Same place and lean as the hand: its -Y (the tip) down the grip axis.
          tool.position.copy(support.position);
          tool.quaternion.copy(support.quaternion).multiply(_toolQ);
          if (tool === tools.screw) tool.rotateY(st.t * 14);   // twisting
        } else if (k > 0.12 && k < 0.84) {
          // between tools: hovering over the open back
          support.position.lerp(_hand.set(-0.12, -0.14, -0.5), 1 - Math.exp(-dt * 8));
        }
      }

      // Solder sparks off the iron's tip, out of the back toward you.
      if (tool === tools.iron && tools.iron.userData.tip) {
        const tipW = new THREE.Vector3();
        tools.iron.userData.tip.getWorldPosition(tipW);
        mesh.worldToLocal(tipW);
        for (const sp of sparks) {
          if (sp.life <= 0 && Math.random() < 0.35) {
            if (!sp.mesh.parent) mesh.add(sp.mesh);
            sp.mesh.position.copy(tipW);
            sp.v.set((Math.random() - 0.7) * 0.6, -0.3 - Math.random() * 0.5, (Math.random() - 0.5) * 0.6);
            sp.life = 0.2 + Math.random() * 0.2;
          }
          if (sp.life > 0) {
            sp.life -= dt;
            sp.v.x += 2.5 * dt;                         // down the screen
            sp.mesh.position.addScaledVector(sp.v, dt);
            sp.mesh.visible = sp.life > 0;
          }
        }
      } else for (const sp of sparks) { sp.life = 0; sp.mesh.parent?.remove(sp.mesh); }

      // The diagnostic tablet: floating in the view, facing you, above the
      // keyboard and left of centre (user, 2026-10-03: flat on the back
      // panel it sat in the corner under the HUD and couldn't be read). It
      // hangs off the view rig, not the keyboard, so the flip and shudder
      // don't swing it about.
      if (k > 0.14 && k < 0.88 && mesh.parent) {
        if (monitor.parent !== mesh.parent) mesh.parent.add(monitor);
        // Floating (user: "it can honestly just be floating"): a slow hover.
        monitor.position.copy(TABLET_VIEW_POS);
        monitor.position.y += Math.sin(st.t * 2.4) * 0.006;
        monitor.quaternion.copy(TABLET_VIEW_Q);
        monitor.rotateZ(Math.sin(st.t * 1.7) * 0.025);
        const popIn = Math.min(1, Math.max(0, (k - 0.14) / 0.05));
        const pop = popIn < 1 ? 1 + 1.7 * Math.pow(popIn - 1, 3) + 0.7 * Math.pow(popIn - 1, 2) : 1;   // overshoots, settles
        monitor.scale.setScalar(pop * (1 - sm(0.84, 0.88, k)) || 0.001);
        if (k < 0.43) monitor.userData.draw("keyboard.exe\nhas stopped\nworking", -1, true);
        else if (k < 0.64) monitor.userData.draw("Updating drivers\n(do not rage quit)", sm(0.43, 0.64, k) * 0.6, false);
        else if (k < 0.78) monitor.userData.draw("Installing\nRGB.dll", 0.6 + sm(0.64, 0.78, k) * 0.4, false);
        else { monitor.userData.draw("Problem?\nFixed.", -1, false); cue("chime", T * 0.78); }
      } else monitor.parent?.remove(monitor);
      return true;
    },
  };
}
