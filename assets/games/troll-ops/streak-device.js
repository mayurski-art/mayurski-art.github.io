// Troll Forces — first-person streak-call devices (DESIGN-ARMS.md Phase 5).
//
// The rugged tablet you raise to call a UAV or gunship (and hold under the
// Lightning Strike map), and the care package's smoke marker. Built the same
// box()/cyl() way as weapon-model.js so they match the viewmodel's blocky
// low-poly vocabulary.
//
// Neither carries a hand of its own any more. Each exposes grip anchors in
// `userData.anchors` ({ right, left } Object3Ds) and game.js hangs the real
// sleeved arms (the ones the weapon inspect uses) off them every frame, so
// the device always reads as held by the player, whatever it's doing.

import * as THREE from "three";

function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }

const TABLET_W = 0.25, TABLET_H = 0.165, TABLET_D = 0.016;
const SCREEN_PX_W = 320, SCREEN_PX_H = 200;

/* Landscape rugged tablet, screen facing +Z (the camera). Anchors sit on the
   two short edges at mid-height, oriented with the tablet, so a hand posed
   at one grips that edge with its thumb over the bezel. */
export function buildStreakDevice() {
  const group = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: 0x2b2f27, roughness: 0.62, metalness: 0.25 });
  const bumper = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.85, metalness: 0.05 });
  const bezel = new THREE.MeshStandardMaterial({ color: 0x0c0d0c, roughness: 0.4, metalness: 0.2 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x9c8a4a, roughness: 0.5, metalness: 0.5 });

  const body = box(TABLET_W, TABLET_H, TABLET_D, shell);
  group.add(body);
  const face = box(TABLET_W - 0.02, TABLET_H - 0.02, 0.003, bezel);
  face.position.z = TABLET_D / 2;
  group.add(face);
  // Rubber corner bumpers, the "military" read.
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const b = box(0.032, 0.032, TABLET_D + 0.008, bumper);
    b.position.set(sx * (TABLET_W / 2 - 0.012), sy * (TABLET_H / 2 - 0.012), 0);
    group.add(b);
  }
  // Grip ridges on the short edges, where the hands go.
  for (const sx of [-1, 1]) {
    const g = box(0.012, TABLET_H * 0.5, TABLET_D + 0.006, bumper);
    g.position.set(sx * (TABLET_W / 2 + 0.002), 0, 0);
    group.add(g);
  }
  // Antenna stub and a few hard buttons along the bottom bezel.
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.05, 6), bumper);
  ant.position.set(TABLET_W / 2 - 0.03, TABLET_H / 2 + 0.022, -0.002);
  group.add(ant);
  for (let i = 0; i < 3; i++) {
    const btn = box(0.014, 0.006, 0.004, accent);
    btn.position.set(-0.03 + i * 0.03, -TABLET_H / 2 + 0.005, TABLET_D / 2 + 0.002);
    group.add(btn);
  }

  // The screen: a canvas the caller redraws (drawTabletScreen) while held.
  const canvas = document.createElement("canvas");
  canvas.width = SCREEN_PX_W;
  canvas.height = SCREEN_PX_H;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(TABLET_W - 0.034, TABLET_H - 0.034),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
  );
  screen.position.z = TABLET_D / 2 + 0.0025;
  group.add(screen);

  group.userData.anchors = {
    right: gripAnchor(TABLET_W / 2, 0, 0, -1),
    left: gripAnchor(-TABLET_W / 2, 0, 0, 1),
  };
  group.add(group.userData.anchors.right, group.userData.anchors.left);
  group.userData.screen = { canvas, ctx: canvas.getContext("2d"), tex };
  group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return group;
}

/* An anchor at a tablet edge. `inward` (+1/-1) is which way is "into the
   tablet" along X, so one hand builder serves both sides. */
function gripAnchor(x, y, z, inward) {
  const a = new THREE.Object3D();
  a.position.set(x, y, z);
  a.userData.inward = inward;
  return a;
}

/* Redraw the tablet screen. `mode` is what's being called: "uav",
   "gunship", "strike", or anything else for the idle feed. `t` is seconds
   since it came up, `press` 0..1 is the confirm press, `confirmed` flips
   the page once the thumb has gone down. */
export function drawTabletScreen(device, mode, t, confirmed) {
  const s = device.userData.screen;
  if (!s) return;
  const g = s.ctx, W = SCREEN_PX_W, H = SCREEN_PX_H;
  g.fillStyle = "#07120a";
  g.fillRect(0, 0, W, H);
  // Faint grid, shared by every page.
  g.strokeStyle = "rgba(78,230,47,.13)";
  g.lineWidth = 1;
  for (let x = 0; x <= W; x += 20) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); g.stroke(); }
  for (let y = 0; y <= H; y += 20) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke(); }

  const green = "#6dff4a";
  g.fillStyle = green;
  g.font = "bold 15px monospace";
  g.textBaseline = "top";
  const TITLES = { uav: "UAV // RECON", gunship: "GUNSHIP // AIR SUPPORT", strike: "LIGHTNING STRIKE",
    k9: "K9 UNIT // RELEASE", warship: "VTOL WARSHIP // GUNNER", swarm: "SWARM // HK DRONES" };
  const title = TITLES[mode] || "STREAK LINK";
  g.fillText(title, 24, 10);
  // Blinking link light, top right.
  g.fillStyle = (t * 2) % 1 < 0.5 ? green : "rgba(109,255,74,.25)";
  g.beginPath(); g.arc(W - 26, 18, 5, 0, Math.PI * 2); g.fill();

  const cx = W / 2, cy = H / 2 + 12;
  if (mode === "uav") {
    // Radar sweep with a couple of pings.
    g.strokeStyle = "rgba(109,255,74,.5)";
    for (const r of [22, 44, 66]) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); }
    const a = t * 3.2;
    const grad = g.createLinearGradient(cx, cy, cx + Math.cos(a) * 70, cy + Math.sin(a) * 70);
    grad.addColorStop(0, "rgba(109,255,74,.9)");
    grad.addColorStop(1, "rgba(109,255,74,0)");
    g.strokeStyle = grad;
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 70, cy + Math.sin(a) * 70); g.stroke();
    g.fillStyle = "#ff4a3a";
    for (const [bx, by, ph] of [[-30, -18, 0.2], [38, 10, 1.1], [12, 40, 2.3]]) {
      if ((t + ph) % 1.4 < 0.9) { g.beginPath(); g.arc(cx + bx, cy + by, 4, 0, Math.PI * 2); g.fill(); }
    }
  } else if (mode === "gunship") {
    // Helicopter silhouette, then CONFIRMED + an inbound bar.
    g.save();
    g.translate(cx, cy - 14);
    g.fillStyle = green;
    g.beginPath(); g.ellipse(0, 0, 38, 14, 0, 0, Math.PI * 2); g.fill();
    g.fillRect(30, -4, 50, 7);
    g.fillRect(74, -14, 6, 20);
    g.fillRect(-6, -24, 6, 12);
    const blade = Math.sin(t * 40) * 60;
    g.fillRect(-3 - blade, -27, blade * 2 + 6, 3);
    g.fillRect(-26, 16, 44, 3);
    g.restore();
  } else if (mode === "k9") {
    // A paw print, pads pulsing.
    g.fillStyle = green;
    const pulse = 1 + Math.sin(t * 8) * 0.06;
    g.beginPath(); g.ellipse(cx, cy + 8, 22 * pulse, 18 * pulse, 0, 0, Math.PI * 2); g.fill();
    for (const [dx, dy] of [[-26, -16], [-9, -30], [9, -30], [26, -16]]) {
      g.beginPath(); g.ellipse(cx + dx, cy + dy, 8, 10, dx * 0.012, 0, Math.PI * 2); g.fill();
    }
  } else if (mode === "warship") {
    // Top-down tilt-rotor circling a target ring.
    g.strokeStyle = "rgba(109,255,74,.5)";
    g.beginPath(); g.arc(cx, cy, 44, 0, Math.PI * 2); g.stroke();
    const a = -t * 1.4;
    g.save();
    g.translate(cx + Math.cos(a) * 44, cy + Math.sin(a) * 44);
    g.rotate(a);
    g.fillStyle = green;
    g.fillRect(-3, -14, 6, 28);
    g.fillRect(-18, -3, 36, 5);
    g.beginPath(); g.arc(-18, 0, 6, 0, Math.PI * 2); g.arc(18, 0, 6, 0, Math.PI * 2); g.fill();
    g.restore();
    g.strokeStyle = "#ff5a3a";
    g.beginPath(); g.moveTo(cx - 8, cy); g.lineTo(cx + 8, cy); g.moveTo(cx, cy - 8); g.lineTo(cx, cy + 8); g.stroke();
  } else if (mode === "swarm") {
    // A cloud of drones drifting in.
    g.fillStyle = green;
    for (let i = 0; i < 14; i++) {
      const x = cx - 80 + ((i * 37 + t * 60) % 160), y = cy - 36 + ((i * 23) % 72) + Math.sin(t * 3 + i) * 3;
      g.fillRect(x - 4, y - 4, 8, 8);
      g.fillRect(x - 7, y - 1, 14, 2);
    }
  } else if (mode === "strike") {
    g.strokeStyle = "#ff5a3a";
    g.lineWidth = 2;
    const r = 18 + Math.sin(t * 5) * 3;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(cx - 34, cy); g.lineTo(cx + 34, cy); g.moveTo(cx, cy - 34); g.lineTo(cx, cy + 34); g.stroke();
  }

  // Footer: the call's state.
  g.font = "bold 16px monospace";
  const CONFIRMED = { uav: "UAV ONLINE", gunship: "CONFIRMED — INBOUND", k9: "DOGS RELEASED", warship: "CONFIRMED — BOARDING", swarm: "SWARM INBOUND" };
  if (CONFIRMED[mode]) {
    if (confirmed) {
      g.fillStyle = "rgba(109,255,74,.22)";
      g.fillRect(22, H - 38, W - 44, 26);
      g.fillStyle = green;
      g.fillText(CONFIRMED[mode], 30, H - 33);
    } else {
      g.strokeStyle = green;
      g.lineWidth = 2;
      g.strokeRect(22.5, H - 37.5, W - 45, 25);
      g.fillStyle = green;
      g.fillText("[ CONFIRM ]", W / 2 - 50, H - 33);
    }
  } else if (mode === "strike") {
    g.fillStyle = green;
    g.fillText("MARK 3 TARGETS", 30, H - 33);
  }
  s.tex.needsUpdate = true;
}

/* The care package's smoke marker, held up ready to throw (BO2 calls a care
   package by throwing one). A stubby olive canister with a red cap and a
   strobe that blinks while it's in the hand. The right hand wraps the can. */
export function buildMarkerDevice() {
  const group = new THREE.Group();
  const can = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.13, 12),
    new THREE.MeshStandardMaterial({ color: 0x3b4034, roughness: 0.6, metalness: 0.2 }),
  );
  can.position.set(0, 0.03, -0.02);
  group.add(can);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.033, 0.033, 0.03, 12),
    new THREE.MeshStandardMaterial({ color: 0xc8321f, roughness: 0.5, emissive: 0x3a0804 }),
  );
  cap.position.set(0, 0.11, -0.02);
  group.add(cap);
  const strobe = new THREE.Mesh(
    new THREE.SphereGeometry(0.012, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff3322 }),
  );
  strobe.position.set(0, 0.13, -0.02);
  group.add(strobe);
  group.userData.strobe = strobe;

  const right = new THREE.Object3D();
  right.position.set(0, 0.0, -0.02);
  group.add(right);
  group.userData.anchors = { right, left: null };
  group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return group;
}
