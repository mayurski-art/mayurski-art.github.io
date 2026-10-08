// Troll Forces — wristwear cosmetics: a Rolex on the left wrist.
//
// User, 2026-10-05: "add rolex for cosmetic wear". Picked in Cosmetics, it
// rides the face key as its fourth part ("grin:og::rolex-gold"; the third,
// the face covering, can be empty), so it is saved, sent and cleaned with
// the face and older clients just ignore it. It shows on your own body
// (character.js syncWristwear), everyone else's, and your first-person
// rod arm, a little way back from the tip (game.js placeRodWatch).
//
// buildWatch(id, ringR) makes the watch around a wrist of radius `ringR`:
// the band wraps the local Z axis (Z runs along the forearm) and the face
// sits on top, toward +Y (the back of the hand).

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const WRISTWEAR = {
  "rolex-gold": { name: "Gold Rolex", metal: 0xd9a93c, link: 0xf0c968, bezel: "flute", dial: "champagne" },
  "rolex-iced": { name: "Iced-out Rolex", metal: 0xd6dbe0, link: 0xf4f7fa, bezel: "ice", dial: "ice" },
  "rolex-hulk": { name: "Hulk Submariner", metal: 0xb9bfc4, link: 0xdde2e6, bezel: "green", dial: "green" },
};

/* The wristwear id out of a face key (its fourth part), or "". */
export function wristOf(faceKey) {
  const id = String(faceKey || "").split(":")[3] || "";
  return WRISTWEAR[id] ? id : "";
}

const DIALS = {
  champagne: { bg: ["#f3dfa2", "#c9a85a"], ink: "#5a4310", mark: "#7a5a12" },
  ice: { bg: ["#e6f6ff", "#9fd2ee"], ink: "#1d3a52", mark: "#ffffff" },
  green: { bg: ["#2fa04a", "#0d4a1e"], ink: "#e8f5ea", mark: "#f4f4f0" },
};
const dialTex = new Map();
function dialTexture(kind) {
  if (dialTex.has(kind)) return dialTex.get(kind);
  const d = DIALS[kind];
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(110, 100, 10, 128, 128, 130);
  grad.addColorStop(0, d.bg[0]);
  grad.addColorStop(1, d.bg[1]);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  // Hour markers: batons, a fat one at 12, the date window at 3.
  g.translate(128, 128);
  for (let i = 0; i < 12; i++) {
    g.save();
    g.rotate((i / 12) * Math.PI * 2);
    g.fillStyle = d.mark;
    g.strokeStyle = d.ink;
    g.lineWidth = 2;
    if (i === 3) { g.restore(); continue; }
    const w = i === 0 ? 16 : 9;
    g.fillRect(-w / 2, -112, w, 30);
    g.strokeRect(-w / 2, -112, w, 30);
    g.restore();
  }
  g.fillStyle = "#fff";
  g.fillRect(70, -13, 34, 26);
  g.fillStyle = "#111";
  g.font = "bold 20px Arial";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("31", 87, 1);
  // The crown and the name under 12.
  g.fillStyle = d.ink;
  g.beginPath();
  g.moveTo(-14, -48); g.lineTo(-16, -66); g.lineTo(-8, -56); g.lineTo(0, -70);
  g.lineTo(8, -56); g.lineTo(16, -66); g.lineTo(14, -48); g.closePath();
  g.fill();
  g.font = "bold 17px Arial";
  g.fillText("ROLEX", 0, -32);
  // Hands at ten past ten, the way watches are photographed.
  const hand = (ang, len, w) => {
    g.save(); g.rotate(ang);
    g.fillStyle = d.mark; g.strokeStyle = d.ink; g.lineWidth = 2;
    g.fillRect(-w / 2, -len, w, len + 10); g.strokeRect(-w / 2, -len, w, len + 10);
    g.restore();
  };
  hand(-Math.PI / 3 - 0.1, 62, 11);
  hand(Math.PI / 3 + 0.15, 92, 7);
  g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.fillStyle = d.ink; g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  dialTex.set(kind, t);
  return t;
}

const matCache = new Map();
function metalMat(color, envMap, rough = 0.28) {
  const k = `${color}:${rough}:${envMap?.uuid || ""}`;
  if (matCache.has(k)) return matCache.get(k);
  // With no environment to reflect, full metal reads black: keep some
  // diffuse and a faint glow of its own colour so it still reads as gold.
  const m = new THREE.MeshStandardMaterial({
    color, roughness: rough, metalness: envMap ? 0.95 : 0.6,
    emissive: color, emissiveIntensity: envMap ? 0.04 : 0.16, envMap: envMap || null,
  });
  matCache.set(k, m);
  return m;
}

/* The watch, around a wrist of radius `ringR` (elliptical with `ry`). */
export function buildWatch(id, ringR, { ry = ringR, envMap = null } = {}) {
  const spec = WRISTWEAR[id];
  const g = new THREE.Group();
  if (!spec) return g;
  g.userData.wristId = id;
  const R = ringR, sy = ry / ringR;
  const bandW = R * 0.6;                  // along the forearm
  const thick = R * 0.12;

  // Band: a ring of jubilee links, three rows each (the middle one shinier).
  const outer = [], mid = [];
  const N = 22;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const arc = (2 * Math.PI * R) / N * 0.92;
    for (const [z, w, list] of [[-bandW * 0.33, bandW * 0.3, outer], [0, bandW * 0.32, mid], [bandW * 0.33, bandW * 0.3, outer]]) {
      const b = new THREE.BoxGeometry(arc, thick, w);
      b.translate(0, R + thick / 2, z);
      b.rotateZ(a);
      list.push(b);
    }
  }
  const bandOuter = new THREE.Mesh(mergeGeometries(outer), metalMat(spec.metal, envMap, 0.38));
  const bandMid = new THREE.Mesh(mergeGeometries(mid), metalMat(spec.link, envMap, 0.18));
  bandOuter.scale.y = bandMid.scale.y = sy;
  g.add(bandOuter, bandMid);

  // Case on top: a short drum, face up (+Y).
  const caseR = R * 0.5, caseH = R * 0.26;
  const top = ry + thick;
  const caseMesh = new THREE.Mesh(new THREE.CylinderGeometry(caseR, caseR * 0.96, caseH, 32), metalMat(spec.metal, envMap, 0.22));
  caseMesh.position.y = top + caseH / 2;
  g.add(caseMesh);
  // Lugs, two each side, out along the band.
  for (const zs of [-1, 1]) for (const xs of [-1, 1]) {
    const lug = new THREE.Mesh(new THREE.BoxGeometry(caseR * 0.28, caseH * 0.7, caseR * 0.6), metalMat(spec.metal, envMap, 0.22));
    lug.position.set(xs * caseR * 0.55, top + caseH * 0.35, zs * caseR * 0.85);
    g.add(lug);
  }
  // Crown, on the side away from the hand... the +X side.
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(caseR * 0.13, caseR * 0.13, caseR * 0.18, 10), metalMat(spec.metal, envMap, 0.3));
  crown.rotation.z = Math.PI / 2;
  crown.position.set(caseR + caseR * 0.07, top + caseH / 2, 0);
  g.add(crown);

  // Bezel: fluted gold, a ring of stones, or the green Submariner insert.
  const bezelY = top + caseH;
  if (spec.bezel === "flute") {
    const geo = new THREE.CylinderGeometry(caseR * 1.02, caseR * 1.04, caseH * 0.35, 60, 1, true);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const a = Math.atan2(z, x);
      const k = 1 + 0.035 * Math.cos(a * 30);
      p.setXYZ(i, x * k, p.getY(i), z * k);
    }
    geo.computeVertexNormals();
    const b = new THREE.Mesh(geo, metalMat(spec.link, envMap, 0.15));
    b.position.y = bezelY;
    g.add(b);
    const cap = new THREE.Mesh(new THREE.RingGeometry(caseR * 0.8, caseR * 1.04, 48), metalMat(spec.link, envMap, 0.15));
    cap.rotation.x = -Math.PI / 2;
    cap.position.y = bezelY + caseH * 0.175;
    g.add(cap);
  } else if (spec.bezel === "ice") {
    const ring = new THREE.Mesh(new THREE.RingGeometry(caseR * 0.8, caseR * 1.04, 48), metalMat(spec.metal, envMap, 0.2));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = bezelY + 0.0005;
    g.add(ring);
    const stone = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdff4ff, emissiveIntensity: 0.9, roughness: 0.05, metalness: 0.2 });
    const gems = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const s = new THREE.OctahedronGeometry(caseR * 0.085);
      s.translate(Math.cos(a) * caseR * 0.92, bezelY + caseH * 0.05, Math.sin(a) * caseR * 0.92);
      gems.push(s);
    }
    g.add(new THREE.Mesh(mergeGeometries(gems), stone));
  } else {
    const ring = new THREE.Mesh(new THREE.RingGeometry(caseR * 0.8, caseR * 1.04, 48),
      new THREE.MeshStandardMaterial({ color: 0x0f6a2a, roughness: 0.2, metalness: 0.3, emissive: 0x06300f, emissiveIntensity: 0.3 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = bezelY + 0.0005;
    g.add(ring);
  }

  // Dial, just under the bezel, catching a little light of its own.
  const dial = new THREE.Mesh(new THREE.CircleGeometry(caseR * 0.82, 40),
    new THREE.MeshStandardMaterial({ map: dialTexture(spec.dial), roughness: 0.35, metalness: 0.1, emissive: 0xffffff, emissiveMap: dialTexture(spec.dial), emissiveIntensity: 0.25 }));
  dial.rotation.x = -Math.PI / 2;
  dial.rotation.z = Math.PI;   // 12 o'clock toward the elbow (+Z), read from the wearer's side
  dial.position.y = bezelY - 0.0002;
  g.add(dial);

  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}

/* Trolling Loud's door wristbands (modes/club-entry.js; CLUB-ENTRY.md), worn
   on the right wrist: 1 the guest's neon pink "TL" band, 2 the owner's black
   and gold "OWNER" band, 3 VIP. Same frame as the watch: the band wraps the
   local Z axis, the snap sits on top (+Y). `userData.glow(k)` brightens it
   (the snap at the door). */
const BANDS = {
  1: { base: "#ff2fa8", ink: "#7a0848", edge: "#ffd1ec", word: "TROLLING LOUD", tag: "TL", tagBg: "#ffffff", tagInk: "#ff2fa8", glow: 0xff3fb4, k: 0.55 },
  2: { base: "#0b0b0d", ink: "#d9a93c", edge: "#f0c968", word: "OWNER", tag: "OWNER", tagBg: "#d9a93c", tagInk: "#0b0b0d", glow: 0xffc860, k: 0.35 },
  3: { base: "#1b1030", ink: "#d9a93c", edge: "#f0c968", word: "VIP", tag: "VIP", tagBg: "#d9a93c", tagInk: "#1b1030", glow: 0xb48cff, k: 0.4 },
};
const bandTex = new Map();
function bandTexture(tier) {
  if (bandTex.has(tier)) return bandTex.get(tier);
  const b = BANDS[tier];
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = b.base;
  g.fillRect(0, 0, 1024, 128);
  // Tyvek has a faint fibre to it; the owner's is a woven strap.
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(255,255,255,${0.015 + Math.random() * 0.03})`;
    g.fillRect(Math.random() * 1024, Math.random() * 128, 1 + Math.random() * 6, 1);
  }
  g.fillStyle = b.edge;
  g.fillRect(0, 6, 1024, 6);
  g.fillRect(0, 116, 1024, 6);
  g.fillStyle = b.ink;
  g.font = "900 54px Arial Black, Arial, sans-serif";
  g.textBaseline = "middle";
  const text = `${b.word}  ★  `;
  const w = g.measureText(text).width;
  for (let x = 0; x < 1024 + w; x += w) g.fillText(text, x, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  bandTex.set(tier, t);
  return t;
}
const tagTex = new Map();
function tagTexture(tier) {
  if (tagTex.has(tier)) return tagTex.get(tier);
  const b = BANDS[tier];
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = b.tagBg;
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = b.tagInk;
  g.lineWidth = 8;
  g.strokeRect(10, 10, 236, 108);
  g.fillStyle = b.tagInk;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `900 ${b.tag.length > 3 ? 54 : 86}px Arial Black, Arial, sans-serif`;
  g.fillText(b.tag, 128, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  tagTex.set(tier, t);
  return t;
}

export function buildWristband(tier, ringR, { ry = ringR } = {}) {
  const b = BANDS[tier];
  const g = new THREE.Group();
  if (!b) return g;
  g.userData.bandTier = tier;
  const R = ringR, sy = ry / ringR;
  const bandW = R * 0.95;                    // along the forearm
  const tex = bandTexture(tier);
  tex.repeat.set(2, 1);
  const mat = new THREE.MeshStandardMaterial({
    map: tex, emissive: b.glow, emissiveMap: tex, emissiveIntensity: b.k, roughness: tier === 2 ? 0.55 : 0.4, metalness: 0.05,
    side: THREE.DoubleSide,
  });
  // The strap: a short open tube round the wrist (Z), a little loose.
  const strap = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.12, R * 1.12, bandW, 40, 1, true), mat);
  strap.rotation.x = Math.PI / 2;
  strap.scale.z = sy;                        // the tube's local Z is the wrist's Y after the turn
  g.add(strap);
  // The snap on top: a little plate with the mark, the strap's ends tucked
  // under it.
  const top = ry * 1.12;
  const plateW = R * (b.tag.length > 3 ? 1.5 : 1.05), plateL = bandW * 1.05, plateH = R * 0.16;
  const plateMat = new THREE.MeshStandardMaterial({ color: b.tagBg, roughness: 0.3, metalness: tier === 1 ? 0.0 : 0.8, emissive: b.glow, emissiveIntensity: b.k * 0.25 });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(plateW, plateH, plateL), plateMat);
  plate.position.y = top + plateH / 2;
  g.add(plate);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(plateW * 0.94, plateL * 0.94),
    new THREE.MeshStandardMaterial({ map: tagTexture(tier), emissive: 0xffffff, emissiveMap: tagTexture(tier), emissiveIntensity: b.k * 0.6, roughness: 0.35 }));
  face.rotation.x = -Math.PI / 2;            // the mark reads round the wrist (X)
  face.position.y = top + plateH + 0.0004;
  g.add(face);
  const mats = [mat, plateMat, face.material];
  const base = mats.map((m) => m.emissiveIntensity);
  g.userData.glow = (k) => mats.forEach((m, i) => { m.emissiveIntensity = base[i] * (1 + k * 4); });
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}

/* A flat picture of the watch for the Cosmetics card: band, case, bezel,
   the dial itself. Returns a data URL. */
export function watchThumb(id) {
  const spec = WRISTWEAR[id];
  const c = document.createElement("canvas");
  c.width = c.height = 160;
  const g = c.getContext("2d");
  if (!spec) return c.toDataURL();
  const hex = (n) => `#${n.toString(16).padStart(6, "0")}`;
  // Band, top to bottom, in links.
  for (let y = 0; y < 160; y += 12) {
    g.fillStyle = hex(spec.metal); g.fillRect(52, y, 56, 11);
    g.fillStyle = hex(spec.link); g.fillRect(70, y + 1, 20, 9);
  }
  g.fillStyle = hex(spec.metal);
  g.beginPath(); g.arc(80, 80, 50, 0, Math.PI * 2); g.fill();
  g.fillStyle = spec.bezel === "green" ? "#0f6a2a" : hex(spec.link);
  g.beginPath(); g.arc(80, 80, 44, 0, Math.PI * 2); g.fill();
  if (spec.bezel === "ice") {
    g.fillStyle = "#ffffff";
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      g.beginPath(); g.arc(80 + Math.cos(a) * 40, 80 + Math.sin(a) * 40, 3.2, 0, Math.PI * 2); g.fill();
    }
  }
  g.save();
  g.beginPath(); g.arc(80, 80, 35, 0, Math.PI * 2); g.clip();
  g.drawImage(dialTexture(spec.dial).image, 45, 45, 70, 70);
  g.restore();
  g.strokeStyle = "#111"; g.lineWidth = 3;
  g.beginPath(); g.arc(80, 80, 50, 0, Math.PI * 2); g.stroke();
  return c.toDataURL();
}
