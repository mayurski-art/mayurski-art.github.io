// Troll Forces — the Tactical Nuke's handheld (TACTICAL-NUKE doc, phase 1).
//
// A rugged military handheld, not a tablet: a chunky olive brick held
// upright in both hands, rubber bumpers, a stub antenna, a small screen up
// top and a flip-up safety cover over the red key below it. Built the
// box()/cyl() way streak-device.js builds the tablet, with the same grip
// anchors ({ right, left }) so view/streak-view.js hangs the arms on it.
//
// The cover and the key move by userData.cover (0 shut .. 1 up) and
// userData.press (0..1); the screen is a canvas redrawn by drawNukeScreen.

import * as THREE from "three";

const W = 0.092, H = 0.168, D = 0.034;
const SCR_W = 0.07, SCR_H = 0.058;
const PX_W = 224, PX_H = 186;

function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }

// The mascot is the real trollface art (never the emoji), etched into the
// shell and shown on the boot screen.
const face = new Image();
face.src = new URL("../../../images/wallpaper/trollface%20transparent.png", import.meta.url).href;

export function buildNukeDevice() {
  const group = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: 0x4b5232, roughness: 0.66, metalness: 0.18 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x141513, roughness: 0.9, metalness: 0.02 });
  const bezel = new THREE.MeshStandardMaterial({ color: 0x0b0c0b, roughness: 0.4, metalness: 0.2 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8a8d86, roughness: 0.35, metalness: 0.8 });
  const red = new THREE.MeshStandardMaterial({ color: 0xc81e14, roughness: 0.45, emissive: 0x3a0402 });
  const amber = new THREE.MeshStandardMaterial({ color: 0xd8a21c, roughness: 0.5, metalness: 0.1 });

  group.add(box(W, H, D, shell));
  // Rubber bumpers on all four corners and a band round the middle.
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const b = box(0.026, 0.03, D + 0.008, rubber);
    b.position.set(sx * (W / 2 - 0.009), sy * (H / 2 - 0.011), 0);
    group.add(b);
  }
  for (const sx of [-1, 1]) {
    const grip = box(0.008, H * 0.42, D + 0.004, rubber);
    grip.position.set(sx * (W / 2 + 0.002), -H * 0.12, 0);
    group.add(grip);
  }
  // Stub antenna, top right, and a knurled channel knob top left.
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.007, 0.05, 8), rubber);
  ant.position.set(W / 2 - 0.018, H / 2 + 0.024, -0.004);
  group.add(ant);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 10), steel);
  knob.position.set(-W / 2 + 0.02, H / 2 + 0.006, -0.002);
  group.add(knob);

  // The screen, inset in its bezel, top half of the face.
  const scrY = H / 2 - 0.022 - SCR_H / 2;
  const frame = box(SCR_W + 0.012, SCR_H + 0.012, 0.004, bezel);
  frame.position.set(0, scrY, D / 2 + 0.001);
  group.add(frame);
  const canvas = document.createElement("canvas");
  canvas.width = PX_W;
  canvas.height = PX_H;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCR_W, SCR_H), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  screen.position.set(0, scrY, D / 2 + 0.0034);
  group.add(screen);

  // The red key under its hinged safety cover, below the screen.
  const keyY = scrY - SCR_H / 2 - 0.034;
  const well = box(0.042, 0.036, 0.004, bezel);
  well.position.set(0, keyY, D / 2 + 0.001);
  group.add(well);
  const key = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.012, 0.008, 16), red);
  key.rotation.x = Math.PI / 2;
  key.position.set(0, keyY, D / 2 + 0.006);
  group.add(key);
  // Hazard stripes either side of the well.
  for (const sx of [-1, 1]) {
    const s = box(0.007, 0.036, 0.002, amber);
    s.position.set(sx * 0.026, keyY, D / 2 + 0.001);
    group.add(s);
  }
  // The cover hinges along its top edge; at 0 it lies flat over the key.
  const hinge = new THREE.Group();
  hinge.position.set(0, keyY + 0.019, D / 2 + 0.01);
  const cover = box(0.04, 0.038, 0.004, new THREE.MeshStandardMaterial({
    color: 0xd4321c, roughness: 0.35, transparent: true, opacity: 0.72,
  }));
  cover.position.set(0, -0.019, 0);
  hinge.add(cover);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.044, 6), steel);
  pin.rotation.z = Math.PI / 2;
  hinge.add(pin);
  group.add(hinge);

  // Three small buttons and the etched trollface on the lower face.
  for (let i = 0; i < 3; i++) {
    const b = box(0.014, 0.008, 0.004, rubber);
    b.position.set(-0.022 + i * 0.022, keyY - 0.03, D / 2 + 0.002);
    group.add(b);
  }
  const etchTex = new THREE.Texture(face);
  etchTex.colorSpace = THREE.SRGBColorSpace;
  const etchUp = () => { etchTex.image = face; etchTex.needsUpdate = true; };
  if (face.complete && face.naturalWidth) etchUp(); else face.addEventListener("load", etchUp, { once: true });
  const etch = new THREE.Mesh(new THREE.PlaneGeometry(0.026, 0.022), new THREE.MeshBasicMaterial({
    map: etchTex, transparent: true, opacity: 0.38, color: 0x9aa07c, depthWrite: false,
  }));
  etch.position.set(W / 2 - 0.022, -H / 2 + 0.024, D / 2 + 0.0012);
  group.add(etch);

  group.userData.anchors = {
    right: gripAnchor(W / 2, -H * 0.12, 0, -1),
    left: gripAnchor(-W / 2, -H * 0.12, 0, 1),
  };
  group.add(group.userData.anchors.right, group.userData.anchors.left);
  group.userData.screen = { canvas, ctx: canvas.getContext("2d"), tex };
  group.userData.hinge = hinge;
  group.userData.key = key;
  group.userData.keyZ = key.position.z;
  group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return group;
}

function gripAnchor(x, y, z, inward) {
  const a = new THREE.Object3D();
  a.position.set(x, y, z);
  a.userData.inward = inward;
  return a;
}

/* Cover angle (0 shut .. 1 flipped up) and key travel (0..1). */
export function setNukeControls(device, cover, press) {
  device.userData.hinge.rotation.x = -cover * 1.9;
  device.userData.key.position.z = device.userData.keyZ - press * 0.004;
}

/* Redraw the screen. `t` is seconds since it came up; `armed` once the key
   went down; `left` the countdown's seconds (null before it starts). */
export function drawNukeScreen(device, t, armed, left) {
  const s = device.userData.screen;
  const g = s.ctx;
  g.fillStyle = "#120504";
  g.fillRect(0, 0, PX_W, PX_H);
  if (t < 0.6) {
    // Boot: scan lines and the trollface coming up out of the static.
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(255,90,60,${Math.random() * 0.35})`;
      g.fillRect(Math.random() * PX_W, Math.random() * PX_H, 4 + Math.random() * 14, 1);
    }
    if (face.complete && face.naturalWidth) {
      g.globalAlpha = Math.min(1, t / 0.4) * 0.8;
      const h = 90, w = h * face.naturalWidth / face.naturalHeight;
      g.drawImage(face, (PX_W - w) / 2, (PX_H - h) / 2, w, h);
      g.globalAlpha = 1;
    }
    s.tex.needsUpdate = true;
    return;
  }
  const red = "#ff3b2a", dim = "rgba(255,59,42,.28)";
  g.textBaseline = "top";
  g.fillStyle = red;
  g.font = "bold 18px monospace";
  g.fillText("TACTICAL NUKE", 12, 8);
  g.fillStyle = (t * 2) % 1 < 0.5 ? red : dim;
  g.beginPath(); g.arc(PX_W - 16, 17, 5, 0, Math.PI * 2); g.fill();
  // The map plate: a contour grid and a target ring on its centre.
  const mx = 12, my = 34, mw = PX_W - 24, mh = 96;
  g.strokeStyle = dim;
  g.lineWidth = 1;
  g.strokeRect(mx + 0.5, my + 0.5, mw, mh);
  for (let x = mx + 16; x < mx + mw; x += 16) { g.beginPath(); g.moveTo(x + 0.5, my); g.lineTo(x + 0.5, my + mh); g.stroke(); }
  for (let y = my + 16; y < my + mh; y += 16) { g.beginPath(); g.moveTo(mx, y + 0.5); g.lineTo(mx + mw, y + 0.5); g.stroke(); }
  const cx = mx + mw / 2, cy = my + mh / 2;
  const pulse = (t * 1.6) % 1;
  g.strokeStyle = red;
  g.lineWidth = 2;
  g.beginPath(); g.arc(cx, cy, 10 + pulse * 30, 0, Math.PI * 2); g.globalAlpha = 1 - pulse; g.stroke(); g.globalAlpha = 1;
  g.beginPath(); g.arc(cx, cy, 9, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(cx - 18, cy); g.lineTo(cx + 18, cy); g.moveTo(cx, cy - 18); g.lineTo(cx, cy + 18); g.stroke();
  // The bottom line: ARM?, then ARMED and the count.
  g.font = "bold 24px monospace";
  if (!armed) {
    if ((t * 3) % 1 < 0.65) { g.fillStyle = red; g.fillText("ARM?", PX_W / 2 - 30, 144); }
  } else {
    g.fillStyle = "rgba(255,59,42,.24)";
    g.fillRect(10, 140, PX_W - 20, 34);
    g.fillStyle = red;
    g.fillText(left != null ? `ARMED  ${Math.max(0, Math.ceil(left))}` : "ARMED", 22, 144);
  }
  s.tex.needsUpdate = true;
}
