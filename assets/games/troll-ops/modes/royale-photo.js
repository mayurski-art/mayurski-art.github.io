// Troll Royale — the photo, in first person (drop cinematic, the opening
// beat): a worn print you pull from your chest pocket before the mask. The
// picture is the user's trollface pin-up art (2026-10-18,
// textures/royale-photo.jpg), drawn on a canvas inside the print's border.
//
// Local frame: the print faces +Z (the camera), metres: an instant print,
// the square picture whole (it was cropped to fit a landscape print, user
// 2026-10-18) with the wide strip under it. Anchors ({ right, left }) hold
// its two sides; userData.thumb slides the right one for the caress.

import * as THREE from "three";

const W = 0.098, H = 0.116;
const PX_W = 512, PX_H = 606;
const B = 24, B_FOOT = 94;   // the border round the picture, and the strip under it (px)

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
  // Matte and a touch dark: in the hold's lamp light the print glowed (user,
  // 2026-10-18: "too bright").
  const front = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, color: 0xb4ada2, roughness: 0.9, metalness: 0 }));
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
  const iw = PX_W - B * 2, ih = PX_H - B - B_FOOT;   // square
  g.fillStyle = "#d8d1c2";                           // an old print's off-white
  g.fillRect(0, 0, PX_W, PX_H);
  g.save();
  g.beginPath();
  g.rect(B, B, iw, ih);
  g.clip();
  g.translate(B, B);
  // The whole picture, edge to edge.
  g.fillStyle = "#e6cfd4";
  g.fillRect(0, 0, iw, ih);
  if (pic.complete && pic.naturalWidth) g.drawImage(pic, 0, 0, iw, ih);
  g.restore();

  // A print that's been carried: a soft darkening at the edges, grain, a
  // crease, worn corners.
  const vig = g.createRadialGradient(PX_W / 2, B + ih / 2, ih * 0.38, PX_W / 2, B + ih / 2, ih * 0.78);
  vig.addColorStop(0, "rgba(40,24,12,0)");
  vig.addColorStop(1, "rgba(40,24,12,.3)");
  g.fillStyle = vig;
  g.fillRect(B, B, iw, ih);
  const img = g.getImageData(0, 0, PX_W, PX_H), d = img.data;
  let seed = 11;
  for (let i = 0; i < d.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    const n = ((seed / 2147483647) - 0.5) * 12;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  g.strokeStyle = "rgba(255,255,255,.22)";
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(PX_W * 0.62, 0); g.lineTo(PX_W * 0.57, PX_H); g.stroke();
  g.strokeStyle = "rgba(0,0,0,.12)";
  g.beginPath(); g.moveTo(PX_W * 0.623, 0); g.lineTo(PX_W * 0.573, PX_H); g.stroke();
  g.fillStyle = "rgba(90,70,50,.3)";
  for (const [x, y] of [[0, 0], [PX_W, 0], [0, PX_H], [PX_W, PX_H]]) { g.beginPath(); g.arc(x, y, 14, 0, Math.PI * 2); g.fill(); }
  // The date stamp a cheap camera prints, bottom right.
  g.font = "bold 18px monospace";
  g.fillStyle = "rgba(230,120,30,.8)";
  g.fillText("'25 7 04", PX_W - B - 100, B + ih - 14);
}
