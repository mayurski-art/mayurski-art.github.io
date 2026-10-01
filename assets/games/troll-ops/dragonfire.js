// Troll Forces — Dragonfire (Black Ops 2 scorestreak).
//
// BO2's Dragonfire is a remote-piloted quadrotor with a light machine gun
// slung under its nose: you fly it yourself, in first person through its
// camera, anywhere on the map (in through windows, round corners), for a
// fixed time or until it's shot down, while your body stands where you
// called it. This file is the airframe (a detailed procedural model read
// off the reference render: four ducted rotors in rings on carbon-fibre
// arms, a two-box body in desert digital camo, the camera and the gun
// under the nose) and its flight: the owner flies it from input, everyone
// else draws an interpolated copy. game.js owns the view, the gun's damage
// and the network messages.

import * as THREE from "three";

export const DF_DURATION = 60;         // seconds of flight
export const DF_HP = 300;              // about ten rifle rounds
// User: it didn't move fast enough. Mostly a bug (see fly(): it never got
// near its top speed); with that fixed it also flies a little quicker.
export const DF_SPEED = 14;            // m/s flat out
export const DF_CLIMB = 7;             // m/s up/down
export const DF_ACCEL = 6;             // how quickly it reaches the stick's speed (1/s)
export const DF_FIRE_INTERVAL = 0.085; // ~700 rpm
// The gun overheats (user: it needs a firing cooldown): each round adds
// heat, about 2.5 s of trigger fills it, and it cools once you let go.
// Run it to the top and it locks until it has cooled right down.
export const DF_HEAT_PER_SHOT = 0.034;
export const DF_COOL_RATE = 0.6;       // heat shed per second off the trigger
export const DF_COOL_DELAY = 0.2;      // seconds after the last round before it sheds
export const DF_HEAT_RESUME = 0.35;    // overheated: locked until it's back under this
export const DF_DAMAGE = 34;           // three to four rounds on a troll
export const DF_RANGE = 90;
export const DF_SPREAD = 0.012;
export const DF_CEILING = 34;          // metres above the ground it can climb
export const DF_RADIUS = 0.55;         // how close it lets itself get to a wall
export const DF_LAUNCH = 1.1;          // seconds climbing out of the operator's hands

/* ---------------------------------------------------------------- textures */

let camoTex = null, carbonTex = null, decalTex = null;

/* Desert digital camo: a sand base with three layers of pixel blotches,
   each blotch a cluster of squares, like the reference's MARPAT-style
   pattern. Tileable (blotches wrap). */
function camoTexture() {
  if (camoTex) return camoTex;
  const N = 512, px = 8, cells = N / px;
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const g = c.getContext("2d");
  g.fillStyle = "#b8a17c";
  g.fillRect(0, 0, N, N);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const layers = [
    { color: "#cdb893", count: 70, size: 5 },
    { color: "#94805f", count: 80, size: 6 },
    { color: "#6f5d45", count: 60, size: 5 },
    { color: "#4e4133", count: 26, size: 3 },
  ];
  for (const L of layers) {
    g.fillStyle = L.color;
    for (let n = 0; n < L.count; n++) {
      let x = Math.floor(rnd() * cells), y = Math.floor(rnd() * cells);
      const steps = L.size + Math.floor(rnd() * L.size * 2);
      for (let s = 0; s < steps; s++) {
        const w = 1 + Math.floor(rnd() * 3), h = 1 + Math.floor(rnd() * 2);
        for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) {
          g.fillRect(((x + i) % cells) * px, ((y + j) % cells) * px, px, px);
        }
        x += Math.floor(rnd() * 3) - 1;
        y += Math.floor(rnd() * 3) - 1;
      }
    }
  }
  // Wear: fine grain and a few scuffs, so the flats don't read as plastic.
  const img = g.getImageData(0, 0, N, N);
  for (let i = 0; i < img.data.length; i += 4) {
    const k = (rnd() - 0.5) * 18;
    img.data[i] += k; img.data[i + 1] += k; img.data[i + 2] += k * 0.8;
  }
  g.putImageData(img, 0, 0);
  camoTex = new THREE.CanvasTexture(c);
  camoTex.colorSpace = THREE.SRGBColorSpace;
  camoTex.wrapS = camoTex.wrapT = THREE.RepeatWrapping;
  camoTex.anisotropy = 4;
  camoTex.repeat.set(4.5, 4.5);   // UVs are metres: ~1 cm camo pixels
  return camoTex;
}

/* The ducts' weathered shroud: grey skin, grime streaks running down, the
   rolled bottom edge dark. `v` runs round the lathe profile bottom -> top. */
let ductTex = null;
function ductTexture() {
  if (ductTex) return ductTex;
  const W = 512, H = 128;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, H, 0, 0);
  // The lathe's v crowds the outer wall into the bottom fifth, so the
  // grey runs almost to the bottom; the dark rolled edge is its own torus.
  grad.addColorStop(0, "#3a3c3e");
  grad.addColorStop(0.025, "#8a8d8f");
  grad.addColorStop(0.5, "#969a9b");
  grad.addColorStop(1, "#a7aaab");
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 140; i++) {
    const x = rnd() * W, len = 20 + rnd() * 70, w = 1 + rnd() * 4;
    const sg = g.createLinearGradient(0, H * 0.02, 0, H * 0.02 + len * 0.4);
    sg.addColorStop(0, "rgba(40,38,34,0)");
    sg.addColorStop(0.3, `rgba(40,38,34,${0.08 + rnd() * 0.18})`);
    sg.addColorStop(1, "rgba(40,38,34,0)");
    g.fillStyle = sg;
    g.fillRect(x, H * 0.02, w, len * 0.4);
  }
  for (let i = 0; i < 60; i++) {           // chipped paint
    g.fillStyle = `rgba(200,200,196,${0.1 + rnd() * 0.2})`;
    g.fillRect(rnd() * W, H * (0.3 + rnd() * 0.6), 2 + rnd() * 6, 1 + rnd() * 3);
  }
  ductTex = new THREE.CanvasTexture(c);
  ductTex.colorSpace = THREE.SRGBColorSpace;
  ductTex.wrapS = THREE.RepeatWrapping;
  return ductTex;
}

/* 2x2 twill carbon weave, for the arms. */
function carbonTexture() {
  if (carbonTex) return carbonTex;
  const N = 128, t = 8;
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const g = c.getContext("2d");
  for (let y = 0; y < N; y += t) for (let x = 0; x < N; x += t) {
    const k = ((x / t + y / t) >> 1) & 1;
    const grad = k ? g.createLinearGradient(x, y, x + t, y) : g.createLinearGradient(x, y, x, y + t);
    grad.addColorStop(0, k ? "#3c3f44" : "#2a2c30");
    grad.addColorStop(0.5, k ? "#6a6e75" : "#4b4e54");
    grad.addColorStop(1, k ? "#3c3f44" : "#2a2c30");
    g.fillStyle = grad;
    g.fillRect(x, y, t, t);
  }
  carbonTex = new THREE.CanvasTexture(c);
  carbonTex.colorSpace = THREE.SRGBColorSpace;
  carbonTex.wrapS = carbonTex.wrapT = THREE.RepeatWrapping;
  carbonTex.repeat.set(3, 1);
  return carbonTex;
}

/* Side stencils + the yellow hazard tag, drawn onto a transparent decal. */
function decalTexture() {
  if (decalTex) return decalTex;
  const c = document.createElement("canvas");
  c.width = 512; c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(40,34,28,.85)";
  g.font = "bold 44px 'DM Mono', monospace";
  g.save(); g.transform(1, 0, -0.18, 1, 0, 0);
  g.fillText("DRAGONFIRE", 40, 58);
  g.font = "bold 30px 'DM Mono', monospace";
  g.fillText("TRL-125  UAV/Q", 44, 104);
  g.restore();
  // hazard tag
  g.fillStyle = "#e7c52a"; g.fillRect(430, 14, 64, 40);
  g.strokeStyle = "#1c1a14"; g.lineWidth = 4;
  g.beginPath(); g.arc(462, 34, 12, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#1c1a14"; g.fillRect(459, 24, 6, 14);
  // red status pips
  g.fillStyle = "#b8392f"; g.fillRect(430, 66, 18, 8); g.fillRect(430, 80, 18, 8);
  decalTex = new THREE.CanvasTexture(c);
  decalTex.colorSpace = THREE.SRGBColorSpace;
  return decalTex;
}

/* ---------------------------------------------------------------- geometry */

/* A box with rounded, bevelled edges (extrude of a rounded rectangle with a
   bevel), centred. UVs are in metres, so the camo keeps one scale on every
   part. */
function bevelBox(w, h, d, r = 0.012, seg = 2) {
  const iw = w - 2 * r, ih = h - 2 * r, cr = Math.min(r * 1.5, iw / 2, ih / 2);
  const s = new THREE.Shape();
  const x0 = -iw / 2, y0 = -ih / 2;
  s.moveTo(x0 + cr, y0);
  s.lineTo(x0 + iw - cr, y0); s.quadraticCurveTo(x0 + iw, y0, x0 + iw, y0 + cr);
  s.lineTo(x0 + iw, y0 + ih - cr); s.quadraticCurveTo(x0 + iw, y0 + ih, x0 + iw - cr, y0 + ih);
  s.lineTo(x0 + cr, y0 + ih); s.quadraticCurveTo(x0, y0 + ih, x0, y0 + ih - cr);
  s.lineTo(x0, y0 + cr); s.quadraticCurveTo(x0, y0, x0 + cr, y0);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: seg, curveSegments: 3,
  });
  geo.translate(0, 0, -(d - 2 * r) / 2);
  geo.computeVertexNormals();
  return geo;
}

/* A chamfered prism: a box whose front-top edge is cut off at `cut`
   (the reference's slanted nose). Extruded along X. */
function chamferBox(w, h, d, cut, r = 0.008) {
  const s = new THREE.Shape();
  s.moveTo(-d / 2, -h / 2);
  s.lineTo(d / 2 - cut * 0.4, -h / 2);
  s.lineTo(d / 2, -h / 2 + cut * 0.6);
  s.lineTo(d / 2, h / 2 - cut);
  s.lineTo(d / 2 - cut, h / 2);
  s.lineTo(-d / 2, h / 2);
  s.lineTo(-d / 2, -h / 2);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: w - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 2, curveSegments: 2,
  });
  geo.translate(0, 0, -(w - 2 * r) / 2);
  geo.rotateY(Math.PI / 2);        // profile's +x (the nose) now runs to -z
  geo.computeVertexNormals();
  return geo;
}

/* The duct: a lathed ring profile - a rounded upper lip, a straight wall, a
   darker rolled lower edge - so it reads as a shroud, not a torus. */
function ductGeometry(R, H) {
  const pts = [];
  const t = 0.007;               // wall
  const lip = 0.011;
  // outer skin bottom -> top, inner skin top -> bottom
  pts.push(new THREE.Vector2(R + t, -H / 2));
  pts.push(new THREE.Vector2(R + t + 0.004, -H / 2 + 0.01));
  pts.push(new THREE.Vector2(R + t + 0.004, H / 2 - lip));
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * Math.PI;
    pts.push(new THREE.Vector2(R + t / 2 + 0.004 + Math.cos(a) * (t / 2 + 0.004), H / 2 - lip + Math.sin(a) * lip));
  }
  pts.push(new THREE.Vector2(R - 0.004, H / 2 - lip - 0.01));
  pts.push(new THREE.Vector2(R, -H / 2 + 0.008));
  pts.push(new THREE.Vector2(R + 0.004, -H / 2));
  pts.push(new THREE.Vector2(R + t, -H / 2));
  const geo = new THREE.LatheGeometry(pts, 48);
  geo.computeVertexNormals();
  return geo;
}

/* Motor pod: the cone-and-can hub in the middle of each ring. */
function hubGeometry() {
  const pts = [
    new THREE.Vector2(0.0, -0.075),
    new THREE.Vector2(0.018, -0.07),
    new THREE.Vector2(0.034, -0.045),
    new THREE.Vector2(0.042, -0.012),
    new THREE.Vector2(0.044, 0.012),
    new THREE.Vector2(0.036, 0.018),
    new THREE.Vector2(0.036, 0.03),
    new THREE.Vector2(0.024, 0.036),
    new THREE.Vector2(0.0, 0.038),
  ];
  const geo = new THREE.LatheGeometry(pts, 20);
  geo.computeVertexNormals();
  return geo;
}

/* One rotor blade: a thin twisted aerofoil-ish strip from hub to tip. */
function bladeGeometry(len) {
  const geo = new THREE.BoxGeometry(len, 0.004, 0.034, 8, 1, 1);
  geo.translate(len / 2 + 0.03, 0, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const k = x / (len + 0.03);
    const twist = 0.45 - k * 0.3;           // steeper at the root
    const chord = 1 - k * 0.35;             // tapers to the tip
    const zz = z * chord;
    p.setY(i, p.getY(i) + Math.sin(twist) * zz);
    p.setZ(i, Math.cos(twist) * zz);
  }
  geo.computeVertexNormals();
  return geo;
}

/* ---------------------------------------------------------------- model */

const _mats = {};
function mats() {
  if (_mats.camo) return _mats;
  const camo = camoTexture();
  _mats.camo = new THREE.MeshStandardMaterial({ map: camo, roughness: 0.78, metalness: 0.05 });
  _mats.camoDark = new THREE.MeshStandardMaterial({ map: camo, color: 0xb7aa98, roughness: 0.8, metalness: 0.05 });
  _mats.duct = new THREE.MeshStandardMaterial({ map: ductTexture(), roughness: 0.62, metalness: 0.35, side: THREE.DoubleSide });
  _mats.strut = new THREE.MeshStandardMaterial({ color: 0x6d7073, roughness: 0.5, metalness: 0.5 });
  _mats.ductEdge = new THREE.MeshStandardMaterial({ color: 0x222325, roughness: 0.6, metalness: 0.3 });
  _mats.hub = new THREE.MeshStandardMaterial({ color: 0x7c8084, roughness: 0.38, metalness: 0.7 });
  _mats.carbon = new THREE.MeshStandardMaterial({ map: carbonTexture(), roughness: 0.42, metalness: 0.35 });
  _mats.black = new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.5, metalness: 0.4 });
  _mats.gun = new THREE.MeshStandardMaterial({ color: 0x1e1f21, roughness: 0.35, metalness: 0.85 });
  _mats.steel = new THREE.MeshStandardMaterial({ color: 0x9a9da1, roughness: 0.3, metalness: 0.9 });
  _mats.glass = new THREE.MeshStandardMaterial({ color: 0x0a0f14, roughness: 0.05, metalness: 0.9, envMapIntensity: 1.5 });
  _mats.lensRing = new THREE.MeshStandardMaterial({ color: 0x2b2d30, roughness: 0.3, metalness: 0.8 });
  _mats.blade = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.45, metalness: 0.2 });
  _mats.blur = new THREE.MeshBasicMaterial({ color: 0x1b1c1e, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  _mats.decal = new THREE.MeshStandardMaterial({ map: decalTexture(), transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 });
  _mats.ledRed = new THREE.MeshBasicMaterial({ color: 0xff3326, toneMapped: false });
  _mats.ledGreen = new THREE.MeshBasicMaterial({ color: 0x5dff64, toneMapped: false });
  _mats.flash = new THREE.MeshBasicMaterial({ color: 0xffc36a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  return _mats;
}

const RING_R = 0.21;         // duct inner radius
const RING_H = 0.095;
const ARM_SPREAD = 0.47;     // hub distance from the centre, on the diagonals

/* The airframe, facing -z, origin at its centre of mass. Returns
   { root, rotors: [group], blurs: [mesh], muzzle: Object3D, lens: Object3D,
   flash: Mesh, leds: [Mesh] }. */
export function buildDragonfireModel() {
  const M = mats();
  const root = new THREE.Group();
  root.name = "Dragonfire";
  // The fuselage parts, scaled as one against the rotor rings.
  const bodyG = new THREE.Group();
  bodyG.scale.setScalar(1.22);
  bodyG.position.y = -0.01;
  root.add(bodyG);
  const add = (geo, mat, x = 0, y = 0, z = 0, parent = bodyG) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };

  // --- body: the front sensor/gun box (slanted nose) and the raised rear
  // battery box, both camo, the seam between them in black.
  const front = add(chamferBox(0.2, 0.17, 0.3, 0.06), M.camo, 0, -0.02, -0.08);
  front.name = "DF_Front";
  const rear = add(bevelBox(0.16, 0.13, 0.32, 0.014), M.camoDark, 0, 0.045, 0.19);
  rear.name = "DF_Rear";
  add(bevelBox(0.13, 0.05, 0.08, 0.008), M.black, 0, -0.005, 0.045);          // neck between the boxes
  // Top hatch on the front box: a raised dark frame with a panel inside.
  add(bevelBox(0.13, 0.012, 0.14, 0.004), M.black, 0, 0.068, -0.08);
  add(bevelBox(0.1, 0.01, 0.11, 0.004), M.camo, 0, 0.073, -0.08);
  add(bevelBox(0.05, 0.006, 0.03, 0.002), M.black, 0.02, 0.079, -0.1);        // little inspection plate
  // Side access panels + vent slots on the rear box.
  for (const sx of [-1, 1]) {
    add(bevelBox(0.006, 0.07, 0.2, 0.002), M.camoDark, sx * 0.082, 0.05, 0.19);
    for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.004, 0.006, 0.05), M.black, sx * 0.086, 0.028 + i * 0.013, 0.26);
    // stencil decal
    const dec = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), M.decal);
    dec.position.set(sx * 0.0815, 0.07, 0.17);
    dec.rotation.y = sx * Math.PI / 2;
    if (sx < 0) dec.scale.x = -1;
    bodyG.add(dec);
    // screws round the front box side
    for (const [y, z] of [[0.04, -0.2], [-0.07, -0.2], [0.04, 0.03], [-0.07, 0.03]]) {
      const sc = add(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 8), M.steel, sx * 0.101, y, z);
      sc.rotation.z = Math.PI / 2;
    }
    // rear box end-cap strip
  }
  add(bevelBox(0.14, 0.02, 0.012, 0.004), M.black, 0, 0.1, 0.35);            // rear handle rail
  // Antenna and status LEDs.
  const ant = add(new THREE.CylinderGeometry(0.0025, 0.0035, 0.05, 6), M.black, -0.05, 0.135, 0.3);
  ant.rotation.x = -0.25;
  const leds = [
    add(new THREE.SphereGeometry(0.008, 10, 8), M.ledRed, -0.07, 0.03, 0.355),
    add(new THREE.SphereGeometry(0.008, 10, 8), M.ledGreen, 0.07, 0.03, 0.355),
  ];

  // --- camera: a round turret on the lower front face with a lens.
  const lens = new THREE.Group();
  lens.position.set(-0.045, -0.06, -0.235);
  bodyG.add(lens);
  const housing = add(new THREE.CylinderGeometry(0.036, 0.04, 0.03, 20), M.lensRing, 0, 0, 0, lens);
  housing.rotation.x = Math.PI / 2;
  const glass = add(new THREE.SphereGeometry(0.028, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), M.glass, 0, 0, -0.012, lens);
  glass.rotation.x = -Math.PI / 2;
  const glint = add(new THREE.RingGeometry(0.018, 0.022, 20), M.steel, 0, 0, -0.016, lens);
  glint.rotation.y = Math.PI;

  // --- gun: receiver, feed tray and ammo can under the right of the nose,
  // a long barrel with a shroud, flash hider and a muzzle point.
  const gun = new THREE.Group();
  gun.position.set(0.045, -0.12, -0.12);
  bodyG.add(gun);
  add(bevelBox(0.05, 0.045, 0.16, 0.006), M.gun, 0, 0, 0, gun);                  // receiver
  add(bevelBox(0.06, 0.05, 0.08, 0.006), M.black, 0.045, 0.01, 0.05, gun);        // ammo can
  add(new THREE.BoxGeometry(0.02, 0.012, 0.05), M.gun, 0.02, 0.028, 0.04, gun);  // feed chute
  const shroud = add(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 12), M.gun, 0, 0.004, -0.13, gun);
  shroud.rotation.x = Math.PI / 2;
  for (let i = 0; i < 5; i++) {                                                     // shroud cooling holes
    const h = add(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 6), M.black, 0, 0.004, -0.09 - i * 0.02, gun);
    h.rotation.z = Math.PI / 2;
  }
  const barrel = add(new THREE.CylinderGeometry(0.007, 0.007, 0.1, 10), M.steel, 0, 0.004, -0.24, gun);
  barrel.rotation.x = Math.PI / 2;
  const hider = add(new THREE.CylinderGeometry(0.01, 0.009, 0.03, 10), M.gun, 0, 0.004, -0.3, gun);
  hider.rotation.x = Math.PI / 2;
  add(bevelBox(0.03, 0.03, 0.03, 0.005), M.black, 0, 0.035, -0.02, gun);          // mount
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.004, -0.325);
  gun.add(muzzle);
  const flash = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.11, 8, 1, true), M.flash);
  flash.rotation.x = -Math.PI / 2;
  flash.position.z = -0.05;
  flash.visible = false;
  muzzle.add(flash);

  // --- arms, ducts, hubs, spokes, rotors on the four diagonals.
  const rotors = [], blurs = [];
  const ductGeo = ductGeometry(RING_R, RING_H);
  const edgeGeo = new THREE.TorusGeometry(RING_R + 0.008, 0.007, 8, 48);
  const hubGeo = hubGeometry();
  const bladeGeo = bladeGeometry(RING_R - 0.045);
  const blurGeo = new THREE.RingGeometry(0.04, RING_R - 0.008, 40);
  const armLen = ARM_SPREAD - RING_R - 0.07;
  let n = 0;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const hx = sx * ARM_SPREAD * 0.74, hz = sz * ARM_SPREAD * 0.68 + 0.05;
    const yaw = Math.atan2(hx, hz);
    const hubY = 0.03;
    // Arm: a carbon box beam from the body side to the duct, with a hinge
    // block at the body and a clamp at the duct.
    const arm = new THREE.Group();
    arm.position.set(sx * 0.09, 0.0, hz * 0.28 + (sz > 0 ? 0.06 : -0.02));
    arm.rotation.y = Math.atan2(hx - arm.position.x, hz - arm.position.z);
    root.add(arm);
    arm.userData.arm = true;
    const armDist = Math.hypot(hx - arm.position.x, hz - arm.position.z);
    const beam = add(bevelBox(0.028, 0.02, armDist - RING_R + 0.01, 0.005), M.carbon, 0, 0.012, (armDist - RING_R) / 2, arm);
    beam.rotation.x = -0.04;
    add(bevelBox(0.04, 0.036, 0.04, 0.006), M.black, 0, 0.01, 0.01, arm);             // hinge block
    const pin = add(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 10), M.steel, 0, 0.01, 0.01, arm);
    pin.rotation.z = Math.PI / 2;
    add(bevelBox(0.034, 0.03, 0.03, 0.005), M.black, 0, 0.018, armDist - RING_R - 0.01, arm); // duct clamp
    void armLen; void yaw;

    const pod = new THREE.Group();
    pod.position.set(hx, hubY, hz);
    root.add(pod);
    const duct = add(ductGeo, M.duct, 0, 0, 0, pod);
    duct.name = `DF_Duct${n}`;
    add(edgeGeo, M.ductEdge, 0, -RING_H / 2 + 0.004, 0, pod).rotation.x = Math.PI / 2;
    // Warning triangles stencilled round the duct.
    for (let k = 0; k < 3; k++) {
      const a = k * (Math.PI * 2 / 3) + 0.4;
      const tri = add(new THREE.CircleGeometry(0.008, 3), M.ductEdge,
        Math.sin(a) * (RING_R + 0.0175), -0.015, Math.cos(a) * (RING_R + 0.0175), pod);
      tri.rotation.y = a;
    }
    // Hub (motor) and three spokes to the duct.
    add(hubGeo, M.hub, 0, 0.0, 0, pod);
    for (let k = 0; k < 3; k++) {
      const a = k * (Math.PI * 2 / 3) + (sx * sz > 0 ? 0 : Math.PI / 3);
      const sp = new THREE.Group();
      sp.rotation.y = a;
      pod.add(sp);
      const strut = add(bevelBox(0.016, 0.012, RING_R - 0.03, 0.003), M.strut, 0, -0.02, (RING_R - 0.03) / 2 + 0.03, sp);
      strut.rotation.x = 0.06;
    }
    // Rotor: two blades and a cap, above the spokes; the blur disc takes
    // over at speed.
    const rotor = new THREE.Group();
    rotor.position.y = 0.022;
    pod.add(rotor);
    for (let k = 0; k < 2; k++) {
      const b = add(bladeGeo, M.blade, 0, 0, 0, rotor);
      b.rotation.y = k * Math.PI;
    }
    add(new THREE.CylinderGeometry(0.012, 0.016, 0.014, 12), M.steel, 0, 0.004, 0, rotor);
    rotor.userData.dir = sx * sz > 0 ? 1 : -1;
    rotors.push(rotor);
    const blur = new THREE.Mesh(blurGeo, M.blur);
    blur.rotation.x = -Math.PI / 2;
    blur.position.y = 0.024;
    blur.renderOrder = 2;
    pod.add(blur);
    blurs.push(blur);
    n++;
  }

  return { root, rotors, blurs, muzzle, lens, flash, leds };
}

/* ---------------------------------------------------------------- entity */

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, "YXZ");
let tracerGeo = null, tracerMat = null;

export class Dragonfire {
  /* `collide(from, dir, maxDist)` -> distance to the first wall along it
     (raycastWorld); `groundAt(x, z, fromY)` -> floor height under a point. */
  constructor({ id, owned, team, x, y, z, yaw = 0, duration = DF_DURATION, botId = null }) {
    this.id = id;
    this.owned = !!owned;
    this.team = team;
    this.botId = botId;
    this.duration = duration;
    this.age = 0;
    this.hp = DF_HP;
    this.heat = 0;            // gun heat 0..1 (tryFire)
    this.overheated = false;
    this.sinceShot = 9;
    this.dead = false;
    this.fireT = 0;
    this.flashT = 0;
    this.yaw = yaw;
    this.pitch = -0.05;
    this.pos = new THREE.Vector3(x, y, z);
    this.vel = new THREE.Vector3();
    this.tilt = new THREE.Vector2();   // pitch/roll the airframe leans by
    this.rounds = [];
    this.snaps = [];                   // remote copy: recent owner positions
    const m = buildDragonfireModel();
    this.model = m;
    this.root = new THREE.Group();
    this.root.rotation.order = "YXZ";
    this.body = m.root;
    this.root.add(this.body);
    // A generous invisible hit volume, for bullets (game.js resolveAir).
    this.hitbox = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
    this.hitbox.userData.air = this;
    this.root.add(this.hitbox);
    this.root.position.copy(this.pos);
    this.root.rotation.y = yaw;
  }

  get alive() { return !this.dead && this.hp > 0 && this.age < this.duration; }
  get launched() { return this.age >= DF_LAUNCH; }

  hitMeshes() { return this.alive ? [this.hitbox] : []; }

  /* The pilot's eye: the nose camera, turned by the pilot's look pitch. */
  cameraPose(pos, quat) {
    this.model.lens.getWorldPosition(pos);
    pos.y += 0.02;
    _e.set(this.pitch, this.yaw, 0);
    quat.setFromEuler(_e);
    return pos;
  }

  muzzleWorld(out = new THREE.Vector3()) { return this.model.muzzle.getWorldPosition(out); }

  /* Owner: fly from input. `input` { fwd, strafe, up (-1..1), yaw, pitch }. */
  fly(dt, input, collide, groundAt) {
    this.yaw = input.yaw;
    this.pitch = Math.max(-1.3, Math.min(0.9, input.pitch));
    if (!this.launched) {
      // Up out of the hands and a little forward before the pilot has it.
      this.vel.set(-Math.sin(this.yaw) * 1.2, 3.2, -Math.cos(this.yaw) * 1.2);
    } else {
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
      const tx = (-s * input.fwd + c * input.strafe) * DF_SPEED;
      const tz = (-c * input.fwd - s * input.strafe) * DF_SPEED;
      const ty = input.up * DF_CLIMB;
      const k = Math.min(1, dt * DF_ACCEL);
      this.vel.x += (tx - this.vel.x) * k;
      this.vel.z += (tz - this.vel.z) * k;
      this.vel.y += (ty - this.vel.y) * Math.min(1, dt * DF_ACCEL * 1.4);
    }
    // Move axis by axis, stopping short of walls, floors and ceilings.
    for (const axis of ["x", "z", "y"]) {
      const d = this.vel[axis] * dt;
      if (Math.abs(d) < 1e-6) continue;
      _v.set(0, 0, 0);
      _v[axis] = Math.sign(d);
      const reach = Math.abs(d) + DF_RADIUS;
      const free = collide ? collide(this.pos, _v, reach) : Infinity;
      // raycastWorld returns the full length when nothing's there: only a
      // shorter answer is a wall. This was `<=`, so a clear path counted as
      // a hit every frame on every axis and the drone bounced its own
      // velocity backwards, crawling along at about a third of DF_SPEED.
      if (free < reach - 1e-4) {
        this.pos[axis] += Math.sign(d) * Math.max(0, free - DF_RADIUS);
        this.vel[axis] *= -0.15;          // a soft bump off it
      } else this.pos[axis] += d;
    }
    const floor = groundAt ? groundAt(this.pos.x, this.pos.z, this.pos.y + 0.5) : 0;
    const minY = (floor ?? 0) + 0.45;
    if (this.pos.y < minY) { this.pos.y = minY; this.vel.y = Math.max(0, this.vel.y); }
    if (this.pos.y > (floor ?? 0) + DF_CEILING) { this.pos.y = (floor ?? 0) + DF_CEILING; this.vel.y = Math.min(0, this.vel.y); }
  }

  /* Remote copy: a position the owner published. */
  applySnapshot(x, y, z, yaw, pitch) {
    this.snaps.push({ t: performance.now(), x, y, z, yaw, pitch });
    if (this.snaps.length > 8) this.snaps.shift();
  }

  tryFire() {
    if (!this.launched || this.fireT > 0 || !this.alive || this.overheated) return false;
    this.fireT = DF_FIRE_INTERVAL;
    this.heat = Math.min(1, this.heat + DF_HEAT_PER_SHOT);
    this.sinceShot = 0;
    if (this.heat >= 1) this.overheated = true;
    return true;
  }

  /* A round from the muzzle to `to` (everyone draws it). */
  shoot(to) {
    if (!tracerGeo) {
      tracerGeo = new THREE.BoxGeometry(0.02, 0.02, 1.4);
      tracerMat = new THREE.MeshBasicMaterial({ color: 0xffd28a, toneMapped: false });
    }
    const from = this.muzzleWorld();
    const mesh = new THREE.Mesh(tracerGeo, tracerMat);
    mesh.position.copy(from);
    mesh.lookAt(to);
    mesh.frustumCulled = false;
    this.root.parent?.add(mesh);
    this.rounds.push({ from, to: to.clone(), t: 0, dur: Math.max(0.02, from.distanceTo(to) / 320), mesh });
    this.flashT = 0.05;
  }

  /* Per frame for every copy. Returns "expire" when it's over. */
  update(dt) {
    this.age += dt;
    this.fireT = Math.max(0, this.fireT - dt);
    this.sinceShot += dt;
    if (this.sinceShot > DF_COOL_DELAY) this.heat = Math.max(0, this.heat - DF_COOL_RATE * dt);
    if (this.overheated && this.heat <= DF_HEAT_RESUME) this.overheated = false;
    if (!this.owned && this.snaps.length) {
      // Draw 120 ms in the past, between the two snapshots around then.
      const t = performance.now() - 120;
      let a = this.snaps[0], b = this.snaps[this.snaps.length - 1];
      for (let i = this.snaps.length - 1; i > 0; i--) {
        if (this.snaps[i - 1].t <= t) { a = this.snaps[i - 1]; b = this.snaps[i]; break; }
      }
      const k = b.t > a.t ? Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t))) : 1;
      const px = this.pos.x;
      const pz = this.pos.z;
      this.pos.set(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k);
      let dy = b.yaw - a.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.yaw = a.yaw + dy * k;
      this.pitch = a.pitch + (b.pitch - a.pitch) * k;
      if (dt > 0) this.vel.set((this.pos.x - px) / dt, 0, (this.pos.z - pz) / dt);
    }
    // Lean into the move like a real quad: nose down going forward, rolled
    // into a strafe.
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const fwd = -(this.vel.x * s + this.vel.z * c), side = this.vel.x * c - this.vel.z * s;
    this.tilt.x += (-fwd / DF_SPEED * 0.32 - this.tilt.x) * Math.min(1, dt * 6);
    this.tilt.y += (-side / DF_SPEED * 0.32 - this.tilt.y) * Math.min(1, dt * 6);
    this.root.position.copy(this.pos);
    // Idle hover bob.
    this.root.position.y += Math.sin(this.age * 2.3) * 0.02;
    this.root.rotation.set(this.tilt.x, this.yaw, this.tilt.y);
    // Rotors: blades visible spinning slowly on launch, the blur takes over.
    const spin = Math.min(1, this.age / 0.6);
    for (const r of this.model.rotors) r.rotation.y += dt * Math.PI * 2 * (4 + spin * 60) * r.userData.dir;
    for (const b of this.model.blurs) b.material.opacity = 0.08 + spin * 0.18;
    const blink = Math.sin(this.age * 9) > 0.2;
    this.model.leds[0].visible = blink;
    this.model.leds[1].visible = !blink;
    this.flashT = Math.max(0, this.flashT - dt);
    this.model.flash.visible = this.flashT > 0;
    if (this.model.flash.visible) this.model.flash.rotation.y = Math.random() * Math.PI;
    for (let i = this.rounds.length - 1; i >= 0; i--) {
      const r = this.rounds[i];
      r.t += dt;
      const k = Math.min(1, r.t / r.dur);
      r.mesh.position.lerpVectors(r.from, r.to, k);
      if (k >= 1) { r.mesh.parent?.remove(r.mesh); this.rounds.splice(i, 1); }
    }
    if (this.dead || this.hp <= 0 || this.age >= this.duration) return "expire";
    return null;
  }

  dispose() {
    this.dead = true;
    for (const r of this.rounds) r.mesh.parent?.remove(r.mesh);
    this.rounds.length = 0;
    this.root.parent?.remove(this.root);
  }
}

void _q;
