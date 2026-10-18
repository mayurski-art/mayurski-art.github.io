// Troll Royale — the photo, in first person (drop cinematic, the opening
// beat): a worn print you pull from your chest pocket before the mask. The
// picture is the user's trollface pin-up art (2026-10-18,
// textures/royale-photo.jpg), drawn on a canvas inside the print's border.
//
// Local frame: the print faces +Z (the camera), landscape, metres. Anchors
// ({ right, left }) hold its two short edges; userData.thumb slides the
// right one for the caress.

import * as THREE from "three";

const W = 0.118, H = 0.088;
const PX_W = 640, PX_H = 478;

const pic = new Image();
pic.src = new URL("../textures/royale-photo.jpg", import.meta.url).href;

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
  if (!(pic.complete && pic.naturalWidth)) pic.addEventListener("load", draw, { once: true });

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

  // The picture (square) fills the print's width, cropped from just above
  // her head down past the bikini top.
  g.fillStyle = "#fbe3ea";
  g.fillRect(0, 0, iw, ih);
  if (pic.complete && pic.naturalWidth) {
    const s = iw / pic.naturalWidth;
    g.drawImage(pic, 0, -pic.naturalHeight * s * 0.06, iw, pic.naturalHeight * s);
  }
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
