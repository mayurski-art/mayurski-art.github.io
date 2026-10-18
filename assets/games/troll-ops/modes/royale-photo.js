// Troll Royale — the family photo, in first person (drop cinematic, the
// opening beat; user, 2026-10-17): a worn print you pull from your chest
// pocket before the mask, you, her and your baby son at the park. The
// picture is drawn on a canvas from the real trollface art (never the
// emoji); every face is the plain white trollface and they're told apart by
// what they wear (house rule: no face colours).
//
// Local frame: the print faces +Z (the camera), landscape, metres. Anchors
// ({ right, left }) hold its two short edges; userData.thumb slides the
// right one for the caress.

import * as THREE from "three";

const W = 0.118, H = 0.088;
const PX_W = 640, PX_H = 478;

const face = new Image();
face.src = new URL("../../../images/wallpaper/trollface%20transparent.png", import.meta.url).href;

let built = null;

export function familyPhoto() {
  if (built) return built;
  const g = new THREE.Group();
  const canvas = document.createElement("canvas");
  canvas.width = PX_W;
  canvas.height = PX_H;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const draw = () => { drawPrint(canvas.getContext("2d")); tex.needsUpdate = true; };
  draw();
  if (!(face.complete && face.naturalWidth)) face.addEventListener("load", draw, { once: true });

  // A print bends a little in the hand: a shallow curve across its width.
  const geo = new THREE.PlaneGeometry(W, H, 12, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / (W / 2);
    pos.setZ(i, -0.006 * (1 - x * x));
  }
  geo.computeVertexNormals();
  const front = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0 }));
  const back = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xe9e2d2, roughness: 0.9, side: THREE.BackSide }));
  g.add(front, back);

  const anchor = (x, inward) => {
    const a = new THREE.Object3D();
    a.position.set(x, -H * 0.12, -0.002);
    a.userData.inward = inward;
    a.userData.home = a.position.clone();
    return a;
  };
  g.userData.anchors = { right: anchor(W / 2, -1), left: anchor(-W / 2, 1) };
  g.add(g.userData.anchors.right, g.userData.anchors.left);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  g.visible = false;
  built = g;
  return g;
}

/* The thumb across the picture: 0..1 along a slow stroke, the right hand's
   grip sliding in over the print and back. */
export function setPhotoThumb(photo, k) {
  const a = photo.userData.anchors.right;
  const s = Math.sin(k * Math.PI);
  a.position.copy(a.userData.home);
  a.position.x -= s * W * 0.32;
  a.position.y += s * H * 0.22;
  a.position.z += s * 0.004;
}

// ---- the picture

function drawPrint(g) {
  const b = 22;                                  // the white border
  const iw = PX_W - b * 2, ih = PX_H - b * 2 - 18;
  g.fillStyle = "#f3eee2";
  g.fillRect(0, 0, PX_W, PX_H);
  g.save();
  g.beginPath();
  g.rect(b, b, iw, ih);
  g.clip();
  g.translate(b, b);

  // Late afternoon at the park: a warm sky, the sun low on the left, a hill.
  const sky = g.createLinearGradient(0, 0, 0, ih);
  sky.addColorStop(0, "#9cc3dc");
  sky.addColorStop(0.55, "#f6cf9e");
  sky.addColorStop(1, "#f2b27a");
  g.fillStyle = sky;
  g.fillRect(0, 0, iw, ih);
  const sun = g.createRadialGradient(iw * 0.16, ih * 0.42, 4, iw * 0.16, ih * 0.42, ih * 0.5);
  sun.addColorStop(0, "rgba(255,244,214,.95)");
  sun.addColorStop(1, "rgba(255,244,214,0)");
  g.fillStyle = sun;
  g.fillRect(0, 0, iw, ih);
  // A tree behind them on the right.
  g.fillStyle = "#5d6b3a";
  for (const [x, y, r] of [[iw * 0.86, ih * 0.38, 70], [iw * 0.78, ih * 0.46, 52], [iw * 0.95, ih * 0.5, 50]]) {
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = "#4a3a28";
  g.fillRect(iw * 0.855, ih * 0.5, 16, ih * 0.3);
  // The grass.
  g.fillStyle = "#7f9a4b";
  g.beginPath();
  g.moveTo(0, ih * 0.74);
  g.quadraticCurveTo(iw * 0.5, ih * 0.64, iw, ih * 0.72);
  g.lineTo(iw, ih); g.lineTo(0, ih); g.closePath(); g.fill();

  // Him (left, navy tee), her (right, red dress, her hair), the baby in
  // her arms in a blue blanket and beanie.
  const headR = 62;
  // Close together, leaning in: him a touch taller.
  person(g, iw * 0.37, ih * 0.36, headR, ih, { shirt: "#2c3e63", collar: "#22314f" });
  person(g, iw * 0.63, ih * 0.41, headR * 0.92, ih, { shirt: "#b8433a", collar: "#9a3530", hair: "#3b2618" });
  // The baby in her arms: a bundle in a soft blue blanket, a little beanie.
  const bx = iw * 0.6, by = ih * 0.76;
  g.save();
  g.beginPath(); g.ellipse(bx, by + 30, 70, 42, -0.18, 0, Math.PI * 2); g.clip();
  g.fillStyle = "#a9c8e8";
  g.fillRect(bx - 80, by - 20, 160, 100);
  g.strokeStyle = "rgba(255,255,255,.5)";
  g.lineWidth = 4;
  for (let i = -2; i <= 3; i++) { g.beginPath(); g.moveTo(bx - 80, by + 30 + i * 13); g.lineTo(bx + 80, by + 16 + i * 13); g.stroke(); }
  g.restore();
  // Her hand round him.
  g.fillStyle = "#b8433a";
  g.beginPath(); g.ellipse(bx + 46, by + 36, 30, 18, -0.5, 0, Math.PI * 2); g.fill();
  drawFace(g, bx - 6, by - 2, 34);
  g.fillStyle = "#5a8fd0";
  g.beginPath(); g.ellipse(bx - 6, by - 18, 33, 20, 0, Math.PI, Math.PI * 2); g.fill();
  g.fillRect(bx - 39, by - 21, 66, 6);
  g.fillStyle = "#e9f1fb";
  g.beginPath(); g.arc(bx - 6, by - 40, 8, 0, Math.PI * 2); g.fill();
  g.restore();

  // A print that's been carried: warm fade, grain, a crease, worn corners.
  g.fillStyle = "rgba(255,196,128,.16)";
  g.fillRect(b, b, iw, ih);
  const vig = g.createRadialGradient(PX_W / 2, PX_H / 2, ih * 0.35, PX_W / 2, PX_H / 2, ih * 0.82);
  vig.addColorStop(0, "rgba(60,30,10,0)");
  vig.addColorStop(1, "rgba(60,30,10,.35)");
  g.fillStyle = vig;
  g.fillRect(b, b, iw, ih);
  const img = g.getImageData(0, 0, PX_W, PX_H), d = img.data;
  let seed = 11;
  for (let i = 0; i < d.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    const n = ((seed / 2147483647) - 0.5) * 18;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  g.strokeStyle = "rgba(255,255,255,.35)";
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(PX_W * 0.62, 0); g.lineTo(PX_W * 0.57, PX_H); g.stroke();
  g.strokeStyle = "rgba(0,0,0,.12)";
  g.beginPath(); g.moveTo(PX_W * 0.623, 0); g.lineTo(PX_W * 0.573, PX_H); g.stroke();
  g.fillStyle = "rgba(120,96,70,.25)";
  for (const [x, y] of [[0, 0], [PX_W, 0], [0, PX_H], [PX_W, PX_H]]) { g.beginPath(); g.arc(x, y, 16, 0, Math.PI * 2); g.fill(); }
  // The date stamp a cheap camera prints, bottom right.
  g.font = "bold 20px monospace";
  g.fillStyle = "rgba(255,140,40,.85)";
  g.fillText("'25 7 04", PX_W - b - 112, PX_H - b - 30);
}

function person(g, x, y, r, bottom, { shirt, collar, hair = null }) {
  // Hair falls behind the head to the shoulders.
  if (hair) {
    g.fillStyle = hair;
    g.beginPath();
    g.moveTo(x - r * 0.95, y - r * 0.2);
    g.quadraticCurveTo(x - r * 1.05, y - r * 1.15, x, y - r * 1.1);
    g.quadraticCurveTo(x + r * 1.05, y - r * 1.15, x + r * 0.98, y - r * 0.2);
    g.lineTo(x + r * 1.1, y + r * 1.3);
    g.quadraticCurveTo(x, y + r * 1.0, x - r * 1.1, y + r * 1.3);
    g.closePath();
    g.fill();
  }
  // Shoulders and body under the head, down out of the picture.
  g.fillStyle = shirt;
  g.beginPath();
  g.moveTo(x - r * 1.25, bottom + 4);
  g.lineTo(x - r * 1.2, y + r * 1.25);
  g.quadraticCurveTo(x - r * 1.05, y + r * 0.78, x, y + r * 0.74);
  g.quadraticCurveTo(x + r * 1.05, y + r * 0.78, x + r * 1.2, y + r * 1.25);
  g.lineTo(x + r * 1.25, bottom + 4);
  g.closePath();
  g.fill();
  g.fillStyle = collar;
  g.beginPath(); g.ellipse(x, y + r * 0.8, r * 0.3, r * 0.11, 0, 0, Math.PI * 2); g.fill();
  drawFace(g, x, y, r);
}

function drawFace(g, x, y, r) {
  if (face.complete && face.naturalWidth) {
    const h = r * 2.1, w = h * face.naturalWidth / face.naturalHeight;
    g.drawImage(face, x - w / 2, y - h / 2, w, h);
  } else {
    g.fillStyle = "#fff";
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
}
