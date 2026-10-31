// Troll Forces — articulated humanoid characters.
//
// One rig serves every operator/enemy on screen (PvP operators, horde
// grunts, zombies, and the lobby locker viewer): a hub where thin stick
// limbs meet, a head that carries the real trollface artwork, two arms
// and two legs, each on its own pivot so they can be posed and animated.
// The caller supplies the material for the LIMBS (so grunts can drive
// them through their dissolve shader) - the head always uses the real
// trollface texture, never a per-caller material, matching the
// site-wide mascot rule (assets/images/wallpaper/trollface transparent.png,
// the same "Trollge" stick-figure look built for the shared Blender/Godot
// rig in trollface-characters/tools/build_trollface_character.py).
//
// The root sits at the FEET and is rotated by yaw, matching how positions are
// tracked everywhere else in the game.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { addInkRim } from "../view/rim-light.js?v=sr1";
import { buildWatch, buildWristband, wristOf } from "./wristwear.js?v=ww1c2m1-or1";
import { sampleGait, applyClip, GAME_CLIPS, CLIP_HIPS, CLIP_SPINE, CLIP_ARM_L, CLIP_ARM_R } from "./clips.js?v=rc1";

const DARK = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });

/* The body is drawn in flat ink: no lighting, so there is no highlight or
   shading to show where one limb's tube meets another's — the whole figure
   reads as one line drawn without lifting the pen. Shared by every rig.
   Its edges catch a little of the sun (view/rim-light.js). */
const INK = addInkRim(new THREE.MeshBasicMaterial({ color: 0x050505 }));
INK.userData.shared = true;

// Shared by every invisible hit-proxy primitive (see buildHumanoid below).
// Never rendered, just needs to be a real material so raycasting works.
const HIT_PROXY_MAT = new THREE.MeshBasicMaterial({ visible: false });

// One texture load, one material, shared by every head in the game -
// loaded once at module scope rather than per-rig.
const TEXTURE_LOADER = new THREE.TextureLoader();
const TROLLFACE_TEXTURE = TEXTURE_LOADER.load(
  new URL("../../../images/wallpaper/trollface%20transparent.png", import.meta.url).href,
);
TROLLFACE_TEXTURE.colorSpace = THREE.SRGBColorSpace;
// The artwork glows at about half strength on top of the lighting, so the
// face reads white with black ink like the drawing instead of a grey board
// that goes muddy in shade, while still darkening a touch in the shadows.
const TROLLFACE_HEAD_MAT = new THREE.MeshStandardMaterial({
  map: TROLLFACE_TEXTURE,
  emissive: 0xffffff,
  emissiveMap: TROLLFACE_TEXTURE,
  emissiveIntensity: 0.55,
  transparent: true,
  alphaTest: 0.3,
  side: THREE.DoubleSide,
  roughness: 0.7,
});

/* The sad trollface (trolltruths.com's, ui/trollface-sad.png), for the Sad
   trollface emote. It's wider than the head board, so it's letterboxed onto
   a transparent canvas of the board's shape rather than stretched. */
const SAD_CANVAS = document.createElement("canvas");
SAD_CANVAS.width = 512; SAD_CANVAS.height = 480;   // the head board's 0.48 x 0.45
const SAD_TEXTURE = new THREE.CanvasTexture(SAD_CANVAS);
SAD_TEXTURE.colorSpace = THREE.SRGBColorSpace;
{
  const img = new Image();
  img.onload = () => {
    const g = SAD_CANVAS.getContext("2d");
    const w = SAD_CANVAS.width, h = w * img.height / img.width;
    g.drawImage(img, 0, (SAD_CANVAS.height - h) / 2, w, h);
    SAD_TEXTURE.needsUpdate = true;
  };
  img.src = new URL("../ui/trollface-sad.png", import.meta.url).href;
}
const SAD_HEAD_MAT = TROLLFACE_HEAD_MAT.clone();
SAD_HEAD_MAT.map = SAD_TEXTURE;
SAD_HEAD_MAT.emissiveMap = SAD_TEXTURE;

/* TROLLS #989's face (traits/src/face-gum.svg): the user's own drawing,
   squint, forehead lines and a kiss, no grin. The NFT's own face, worn by
   its body (blocky-body.js sets rig.nftFace), in the trollface png's own
   frame. */
const GUM_TEXTURE = TEXTURE_LOADER.load(new URL("../traits/face-gum.png?v=fg3", import.meta.url).href);
GUM_TEXTURE.colorSpace = THREE.SRGBColorSpace;
const GUM_HEAD_MAT = TROLLFACE_HEAD_MAT.clone();
GUM_HEAD_MAT.map = GUM_TEXTURE;
GUM_HEAD_MAT.emissiveMap = GUM_TEXTURE;
/* EYES / Cracked Eyes (#33, traits/src/face-cracked.svg): the trollface with
   its squints swapped for the cracked eyeballs, painted into the face (as a
   card they floated in front of the grin; user, 2026-10-16). */
const CRACKED_TEXTURE = TEXTURE_LOADER.load(new URL("../traits/face-cracked.png?v=fc1", import.meta.url).href);
CRACKED_TEXTURE.colorSpace = THREE.SRGBColorSpace;
const CRACKED_HEAD_MAT = TROLLFACE_HEAD_MAT.clone();
CRACKED_HEAD_MAT.map = CRACKED_TEXTURE;
CRACKED_HEAD_MAT.emissiveMap = CRACKED_TEXTURE;
/* FACIALS / Gold Tooth (#2631, traits/src/face-gold-tooth.svg): one upper
   tooth filled in gold, painted into the face (as a card the grin's
   sculpted bulge hid most of it; user, 2026-10-16). */
const GOLD_TEXTURE = TEXTURE_LOADER.load(new URL("../traits/face-gold-tooth.png?v=gt1", import.meta.url).href);
GOLD_TEXTURE.colorSpace = THREE.SRGBColorSpace;
const GOLD_HEAD_MAT = TROLLFACE_HEAD_MAT.clone();
GOLD_HEAD_MAT.map = GOLD_TEXTURE;
GOLD_HEAD_MAT.emissiveMap = GOLD_TEXTURE;
/* EYES / Eyes Relaxed (#1718, traits/src/face-relaxed.svg): the trollface
   with its squints swapped for the NFT's closed, smug lids. */
const RELAXED_TEXTURE = TEXTURE_LOADER.load(new URL("../traits/face-relaxed.png?v=er2", import.meta.url).href);
RELAXED_TEXTURE.colorSpace = THREE.SRGBColorSpace;
const RELAXED_HEAD_MAT = TROLLFACE_HEAD_MAT.clone();
RELAXED_HEAD_MAT.map = RELAXED_TEXTURE;
RELAXED_HEAD_MAT.emissiveMap = RELAXED_TEXTURE;

/* Faces a rig can wear, by key "expression:og" (cosmetics.js): the
   expression picks the artwork (the grin, or trolltruths' sad one). The
   trollface is always its own white; there are no face colours (user,
   2026-10-08), and the second part of the key is kept as "og" only so old
   keys on the wire and in storage still read. `rig.face` is the rig's own
   pick; the Sad trollface emote swaps the expression for a moment. An NFT
   body with a face of its own sets `rig.nftFace`, worn over the pick. */
const FACE_ART = { grin: TROLLFACE_HEAD_MAT, sad: SAD_HEAD_MAT, gum: GUM_HEAD_MAT, cracked: CRACKED_HEAD_MAT, goldtooth: GOLD_HEAD_MAT, relaxed: RELAXED_HEAD_MAT };
export function faceMaterial(key = "grin:og") {
  // later parts are the face covering and the wrist (cosmetics.js): the
  // material is the same with or without them
  return FACE_ART[String(key).split(":")[0]] || TROLLFACE_HEAD_MAT;
}

/* Face coverings (cosmetics.js): a bandana tied over the lower face, drawn
   in the trollface's own style (user's reference: a flat colour with a
   heavy black outline, knotted at the side, the grin still showing
   through in the middle) on a board the size of the head, laid just in
   front of it and just behind it (the head is a flat double-sided board).
   The third part of the face key ("grin:og:bandana-blue"). */
export const FACE_COVERINGS = {
  "bandana-blue": { fill: "#3a14f0", shade: "#2a0cb0" },
  "bandana-red": { fill: "#c8202a", shade: "#8a1018", paisley: true },
  "bandana-black": { fill: "#1c1c22", shade: "#08080a", paisley: true },
  "bandana-green": { fill: "#2f8a3a", shade: "#1e5a26" },
};
const COVER_TEX = new Map();
export function coveringCanvas(id, art = null) {
  const spec = FACE_COVERINGS[id];
  const c = document.createElement("canvas");
  c.width = 800; c.height = 730;   // the artwork's own size, so it lines up
  const g = c.getContext("2d");
  if (!spec) return c;
  const band = new Path2D();
  band.moveTo(48, 262);
  band.bezierCurveTo(170, 300, 300, 318, 420, 318);
  band.bezierCurveTo(560, 318, 680, 290, 772, 250);
  band.bezierCurveTo(790, 330, 780, 430, 742, 520);
  band.bezierCurveTo(700, 610, 650, 680, 590, 726);
  band.bezierCurveTo(430, 700, 250, 650, 150, 590);
  band.bezierCurveTo(80, 520, 40, 400, 48, 262);
  g.save();
  g.clip(band);
  g.fillStyle = spec.fill;
  g.fillRect(0, 0, 800, 730);
  // a darker fold under the chin
  g.fillStyle = spec.shade;
  g.beginPath();
  g.moveTo(150, 590); g.bezierCurveTo(300, 660, 470, 700, 590, 726); g.lineTo(600, 640);
  g.bezierCurveTo(470, 620, 320, 580, 170, 540); g.fill();
  if (spec.paisley) {
    // the classic paisley teardrops and dots, in white
    g.strokeStyle = "rgba(255,255,255,.8)"; g.fillStyle = "rgba(255,255,255,.8)"; g.lineWidth = 5;
    for (const [x, y, r] of [[120, 420, 22], [210, 560, 18], [700, 360, 22], [660, 520, 20], [520, 640, 16]]) {
      g.beginPath(); g.ellipse(x, y, r, r * 1.5, 0.6, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(x, y, r * 0.35, 0, Math.PI * 2); g.fill();
    }
  }
  // the grin shows through the middle, and the ink over all of it
  const r = g.createRadialGradient(410, 450, 60, 410, 450, 300);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.7, "rgba(255,255,255,1)"); r.addColorStop(0.75, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.save(); g.scale(1, 0.62); g.translate(0, 450 / 0.62 - 450);
  g.fillRect(0, 0, 800, 1200); g.restore();
  if (art) { g.globalCompositeOperation = "multiply"; g.drawImage(art, 0, 0, 800, 730); g.globalCompositeOperation = "source-over"; }
  g.restore();
  g.lineJoin = "round";
  g.strokeStyle = "#0a0a0a"; g.lineWidth = 14;
  g.stroke(band);
  // the knot and its two ears, off the left side
  const knot = (x, y, rx, ry, rot) => {
    g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    g.fillStyle = spec.fill; g.fill(); g.lineWidth = 11; g.stroke();
  };
  knot(34, 178, 30, 60, 0.35);
  knot(6, 268, 26, 54, -1.2);
  knot(40, 250, 30, 30, 0);
  g.lineWidth = 8;
  g.beginPath(); g.moveTo(70, 300); g.lineTo(96, 360); g.moveTo(84, 285); g.lineTo(120, 300); g.stroke();
  return c;
}
function coveringMaterial(id) {
  let m = COVER_TEX.get(id);
  if (m) return m;
  const c = coveringCanvas(id);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  m = new THREE.MeshStandardMaterial({
    map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.55,
    transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.85,
    polygonOffset: true, polygonOffsetFactor: -2,
  });
  // redraw with the ink once the artwork has loaded
  const img = new Image();
  img.onload = () => { const d = coveringCanvas(id, img); c.getContext("2d").clearRect(0, 0, 800, 730); c.getContext("2d").drawImage(d, 0, 0); t.needsUpdate = true; };
  img.src = new URL("../../../images/wallpaper/trollface%20transparent.png", import.meta.url).href;
  COVER_TEX.set(id, m);
  return m;
}
/* Wear (or take off) the covering named in the rig's face key. */
function syncCovering(rig) {
  const head = rig.parts?.head;
  if (!head || !head.userData.trollface) return;
  const id = String(rig.face || "").split(":")[2] || "";
  if (rig.coveringShown === id) return;
  rig.coveringShown = id;
  for (const o of head.userData.covering || []) head.remove(o);
  head.userData.covering = [];
  if (!FACE_COVERINGS[id]) return;
  const mat = coveringMaterial(id);
  for (const z of [0.004, -0.004]) {
    const o = new THREE.Mesh(head.geometry, mat);
    o.position.z = z;
    o.renderOrder = 1;
    head.add(o);
    head.userData.covering.push(o);
  }
}

/* Wear (or take off) the wristwear in the face key's fourth part (a Rolex,
   wristwear.js) on the left forearm, just above the mitt. It hangs off the
   hand joint, not the wrist, so the mitt's twist doesn't spin it. */
const _wwY = new THREE.Vector3(), _wwZ = new THREE.Vector3(), _wwX = new THREE.Vector3(), _wwM = new THREE.Matrix4();
function syncWristwear(rig) {
  const hand = rig.parts?.wristL?.parent;
  if (!hand) return;
  const id = wristOf(rig.face);
  if (rig.wristShown === id) return;
  rig.wristShown = id;
  if (rig.wristMesh) { rig.wristMesh.parent?.remove(rig.wristMesh); rig.wristMesh = null; }
  if (!id) return;
  const s = rig.scale || 1, w = rig.build || 1;
  const limb = 0.032 * s * w;
  const watch = buildWatch(id, limb * 1.18);
  // Up the forearm toward the elbow (the arm's rest line, ARM in buildRig),
  // face turned out, the way the back of the mitt faces.
  _wwZ.set(0.30 * w, 0.62, 0).normalize();
  _wwY.set(-_wwZ.y, _wwZ.x, 0);
  _wwX.crossVectors(_wwY, _wwZ);
  watch.quaternion.setFromRotationMatrix(_wwM.makeBasis(_wwX, _wwY, _wwZ));
  watch.position.copy(_wwZ).multiplyScalar(limb * 2.2);
  hand.add(watch);
  rig.wristMesh = watch;
}

/* Trolling Loud's door wristband (modes/club-entry.js) on the right
   forearm, the mirror of the watch: `rig.band` is the tier (0 none, 1 guest,
   2 owner, 3 VIP), set by whoever drives the rig. */
function syncWristband(rig) {
  const hand = rig.parts?.wristR?.parent;
  const tier = rig.band || 0;
  if (!hand || (rig.bandShown || 0) === tier) return;
  rig.bandShown = tier;
  if (rig.bandMesh) { rig.bandMesh.parent?.remove(rig.bandMesh); rig.bandMesh = null; }
  if (!tier) return;
  const s = rig.scale || 1, w = rig.build || 1;
  const limb = 0.032 * s * w;
  const band = buildWristband(tier, limb * 1.18);
  _wwZ.set(-0.30 * w, 0.62, 0).normalize();
  _wwY.set(_wwZ.y, -_wwZ.x, 0);
  _wwX.crossVectors(_wwY, _wwZ);
  band.quaternion.setFromRotationMatrix(_wwM.makeBasis(_wwX, _wwY, _wwZ));
  band.position.copy(_wwZ).multiplyScalar(limb * 2.0);
  hand.add(band);
  rig.bandMesh = band;
}

/* Put `mood` ("sad") on a rig's face, or with no mood its own pick back.
   Only trollface heads (other faces keep theirs). */
export function setFace(rig, mood = null) {
  const head = rig.parts?.head;
  if (!head || !head.userData.trollface) return;
  const own = rig.nftFace || rig.face || "grin:og";
  const want = faceMaterial(mood || own);
  if (head.material !== want) head.material = want;
}

/* ------------------------------------------------------------ the body line

   The body is ONE mesh: a round tube swept through the joints, like a line
   drawn with a marker. Neck, spine, hips and left leg are a single unbroken
   stroke; the right leg and both arms start inside it, where a sphere closes
   the join. The old rig built every limb as its own capped cylinder on its
   own pivot, so any lean opened a visible break where the torso met the legs.

   The pivots (hips, torso, chest, legs, knees...) still exist and are still
   what every pose rotates. They're invisible now: each frame the stroke reads
   where the joints ended up and rebuilds the tube through them. */

const RADIAL = 8;         // sides per tube ring
const FILLET = 5;         // samples round each bend
const CAP_W = 8, CAP_H = 6;
// The ring's corners, worked out once (every ring of every rig was calling
// cos/sin per vertex: a 100-troll Royale rebuilt thousands a frame).
const RING_COS = Float32Array.from({ length: RADIAL + 1 }, (_, k) => Math.cos((k / RADIAL) * Math.PI * 2));
const RING_SIN = Float32Array.from({ length: RADIAL + 1 }, (_, k) => Math.sin((k / RADIAL) * Math.PI * 2));

/* Straight limbs, rounded corners: each segment is a straight run, and each
   joint is turned with a short quadratic curve, like a marker line bending
   at the knee. A spline through every joint made the limbs read as rubber
   hoses; this keeps them sticks. `r` is how far the rounding reaches. */
function chainSamples(n) { return 2 + (n - 2) * FILLET; }
const _fa = new THREE.Vector3(), _fb = new THREE.Vector3();
function sampleChain(pts, out, r) {
  let o = 0;
  const n = pts.length;
  out[o++].copy(pts[0]);
  for (let i = 1; i < n - 1; i++) {
    const J = pts[i];
    const la = J.distanceTo(pts[i - 1]), lb = J.distanceTo(pts[i + 1]);
    const f = Math.min(r, la * 0.45, lb * 0.45);
    _fa.subVectors(pts[i - 1], J).setLength(Math.max(1e-5, f)).add(J);   // start of the bend
    _fb.subVectors(pts[i + 1], J).setLength(Math.max(1e-5, f)).add(J);   // end of it
    for (let k = 0; k < FILLET; k++) {
      const t = k / (FILLET - 1), u = 1 - t;
      out[o++].set(
        u * u * _fa.x + 2 * u * t * J.x + t * t * _fb.x,
        u * u * _fa.y + 2 * u * t * J.y + t * t * _fb.y,
        u * u * _fa.z + 2 * u * t * J.z + t * t * _fb.z,
      );
    }
  }
  out[o++].copy(pts[n - 1]);
  return o;
}

class BodyStroke {
  /* `chains`: arrays of joint Object3Ds, each drawn as one tube.
     `caps`: joints that get a sphere (chain ends, and where a chain starts
     inside another). */
  constructor(root, chains, caps, radius, material) {
    this.root = root;
    this.chains = chains;
    this.caps = caps;
    this.radius = radius;
    this.joints = [...new Set([...chains.flat(), ...caps])];
    this.local = new Map(this.joints.map((j) => [j, new THREE.Vector3()]));
    this.last = new Float32Array(this.joints.length * 3).fill(NaN);

    this.samples = chains.map((c) => Array.from({ length: chainSamples(c.length) }, () => new THREE.Vector3()));
    this.pts = chains.map((c) => c.map((j) => this.local.get(j)));   // each chain's joint positions, by reference
    const tubeVerts = this.samples.reduce((n, s) => n + s.length * (RADIAL + 1), 0);
    const capVerts = caps.length * (CAP_W + 1) * (CAP_H + 1);
    const total = tubeVerts + capVerts;

    const index = [];
    let base = 0;
    for (const s of this.samples) {
      for (let i = 0; i < s.length - 1; i++) {
        for (let r = 0; r < RADIAL; r++) {
          const a = base + i * (RADIAL + 1) + r, b = a + RADIAL + 1;
          index.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
      base += s.length * (RADIAL + 1);
    }
    // A unit sphere template for the caps.
    this.capBase = base;
    this.capUnit = [];
    const uv = new Float32Array(total * 2);
    for (let c = 0; c < caps.length; c++) {
      for (let y = 0; y <= CAP_H; y++) {
        const th = (y / CAP_H) * Math.PI;
        for (let x = 0; x <= CAP_W; x++) {
          const ph = (x / CAP_W) * Math.PI * 2;
          if (c === 0) this.capUnit.push(new THREE.Vector3(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)));
          const v = base + y * (CAP_W + 1) + x;
          uv[v * 2] = x / CAP_W; uv[v * 2 + 1] = y / CAP_H;
          if (y < CAP_H && x < CAP_W) {
            const a = v, b = v + CAP_W + 1;
            index.push(a, a + 1, b, b, a + 1, b + 1);
          }
        }
      }
      base += (CAP_W + 1) * (CAP_H + 1);
    }

    const geo = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(total * 3), 3);
    this.nrm = new THREE.BufferAttribute(new Float32Array(total * 3), 3);
    this.pos.setUsage(THREE.DynamicDrawUsage);
    this.nrm.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("position", this.pos);
    geo.setAttribute("normal", this.nrm);
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geo.setIndex(index);
    // Fixed bounds round the feet-rooted rig: covers standing, crouched and
    // lying flat in the death pose, so culling never needs recomputing.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 2.4);
    geo.boundingBox = new THREE.Box3(new THREE.Vector3(-2.4, -1.5, -2.4), new THREE.Vector3(2.4, 3.3, 2.4));
    this.uvAttr = geo.getAttribute("uv");

    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.castShadow = true;
    this.mesh.userData.isBodyStroke = true;
    // The pose functions rebuild the line as they finish (see the wrappers
    // by DANCES); this only catches a rig that is drawn without being posed.
    this.mesh.onBeforeRender = () => this.updateOncePerFrame();
    root.add(this.mesh);
    this._inv = new THREE.Matrix4();
    this._t = new THREE.Vector3(); this._n = new THREE.Vector3(); this._b = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
  }

  /* The draw-time safety net. Shadow, SSAO and the frame itself all draw the
     rig, and each pass re-checked every joint: in a 100-troll Royale that
     was the single biggest cost of the frame. Once per animation frame is
     enough (document.timeline.currentTime is fixed inside one); the pose
     functions' own update() calls are never skipped. */
  updateOncePerFrame() {
    const frame = document.timeline?.currentTime;
    if (frame != null && frame === this.checkedAt) return;
    this.checkedAt = frame;
    this.update(true);
  }

  /* `drawn`: called while the renderer draws, which has just brought every
     world matrix up to date, so the rig's needn't be walked again. */
  update(drawn = false) {
    if (!drawn) this.root.updateWorldMatrix(true, true);
    this._inv.copy(this.root.matrixWorld).invert();
    let changed = false;
    this.joints.forEach((j, i) => {
      const v = this.local.get(j).setFromMatrixPosition(j.matrixWorld).applyMatrix4(this._inv);
      if (v.x !== this.last[i * 3] || v.y !== this.last[i * 3 + 1] || v.z !== this.last[i * 3 + 2]) {
        changed = true;
        this.last[i * 3] = v.x; this.last[i * 3 + 1] = v.y; this.last[i * 3 + 2] = v.z;
      }
    });
    // Several passes (shadow, SSAO, the frame itself) can draw a rig in one
    // frame. Only the first one after a pose change does any work.
    if (!changed) return;

    const P = this.pos.array, N = this.nrm.array, UV = this.uvAttr.array;
    const r = this.radius;
    const T = this._t, Nn = this._n, B = this._b;
    let v = 0;
    this.chains.forEach((chain, ci) => {
      const pts = this.pts[ci];
      const s = this.samples[ci];
      const count = sampleChain(pts, s, this.radius * 2.2);
      let along = 0;
      // Rotation-minimising frames: carry the previous ring's normal along,
      // so the tube never twists into a pinch at a bend.
      Nn.set(0, 0, 0);
      for (let i = 0; i < count; i++) {
        const a = s[Math.max(0, i - 1)], b = s[Math.min(count - 1, i + 1)];
        T.subVectors(b, a);
        if (T.lengthSq() < 1e-12) T.set(0, 1, 0);
        T.normalize();
        if (i === 0) {
          Nn.set(Math.abs(T.y) < 0.9 ? 0 : 1, Math.abs(T.y) < 0.9 ? 1 : 0, 0);
        }
        Nn.addScaledVector(T, -Nn.dot(T));
        if (Nn.lengthSq() < 1e-8) Nn.set(1, 0, 0).addScaledVector(T, -T.x);
        Nn.normalize();
        B.crossVectors(T, Nn);
        if (i > 0) along += s[i].distanceTo(s[i - 1]);
        for (let k = 0; k <= RADIAL; k++) {
          const c = RING_COS[k], sn = RING_SIN[k];
          const nx = Nn.x * c + B.x * sn, ny = Nn.y * c + B.y * sn, nz = Nn.z * c + B.z * sn;
          P[v * 3] = s[i].x + nx * r; P[v * 3 + 1] = s[i].y + ny * r; P[v * 3 + 2] = s[i].z + nz * r;
          N[v * 3] = nx; N[v * 3 + 1] = ny; N[v * 3 + 2] = nz;
          UV[v * 2] = along * 2; UV[v * 2 + 1] = k / RADIAL;
          v++;
        }
      }
    });
    for (const j of this.caps) {
      const c = this.local.get(j);
      for (const u of this.capUnit) {
        P[v * 3] = c.x + u.x * r; P[v * 3 + 1] = c.y + u.y * r; P[v * 3 + 2] = c.z + u.z * r;
        N[v * 3] = u.x; N[v * 3 + 1] = u.y; N[v * 3 + 2] = u.z;
        v++;
      }
    }
    this.pos.needsUpdate = true;
    this.nrm.needsUpdate = true;
    this.uvAttr.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------- hands

   Cartoon mitts in the same flat ink: a palm, four fingers and a thumb, cut
   as flat shapes with a slight rounded edge. Each hand carries two shapes —
   open and fist — and setHandPose() picks one, so reloads, throws and the
   like can open and close them. Drawn with the fingers pointing down -Y
   from the wrist at the origin, the thumb to +X (or -X, mirrored). */
const HAND_GEO = new Map();
function roundedRect(x, y, w, h, r) {
  const sh = new THREE.Shape();
  sh.moveTo(x + r, y);
  sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r);
  sh.lineTo(x + w, y + h - r); sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  sh.lineTo(x + r, y + h); sh.quadraticCurveTo(x, y + h, x, y + h - r);
  sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y);
  return sh;
}
function handGeometry(kind, thumb, s) {
  const key = `${kind}:${thumb}:${s.toFixed(3)}`;
  if (HAND_GEO.has(key)) return HAND_GEO.get(key);
  const extrude = (shape, rot = 0, px = 0, py = 0) => {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 0.012 * s, bevelEnabled: true, bevelThickness: 0.005 * s, bevelSize: 0.004 * s, bevelSegments: 2, curveSegments: 5,
    });
    g.translate(0, 0, -0.006 * s);
    if (rot) g.rotateZ(rot);
    g.translate(px, py, 0);
    return g.toNonIndexed();
  };
  const parts = [];
  if (kind === "open") {
    parts.push(extrude(roundedRect(-0.034 * s, -0.075 * s, 0.068 * s, 0.078 * s, 0.022 * s)));
    // Four fingers, the middle two a touch longer, fanned very slightly.
    [[-0.026, 0.045, 0.05], [-0.009, 0.055, 0.015], [0.009, 0.054, -0.015], [0.026, 0.043, -0.05]].forEach(([x, len, fan]) => {
      parts.push(extrude(roundedRect(-0.0085 * s, -len * s, 0.017 * s, len * s + 0.01 * s, 0.0085 * s), fan, x * s * -thumb, -0.068 * s));
    });
    parts.push(extrude(roundedRect(-0.009 * s, -0.05 * s, 0.018 * s, 0.05 * s, 0.009 * s), thumb * 0.75, thumb * 0.03 * s, -0.022 * s));
  } else {
    // A fist: a rounded block with the thumb laid across it.
    parts.push(extrude(roundedRect(-0.036 * s, -0.082 * s, 0.072 * s, 0.085 * s, 0.028 * s)));
    // The L (the loser emote): the index finger straight out of the
    // knuckles on the thumb's side, the thumb standing out square to it
    if (kind === "L") {
      parts.push(extrude(roundedRect(-0.0095 * s, -0.142 * s, 0.019 * s, 0.075 * s, 0.0095 * s), 0, thumb * 0.024 * s, 0));
      parts.push(extrude(roundedRect(-0.009 * s, -0.06 * s, 0.018 * s, 0.06 * s, 0.009 * s), thumb * Math.PI / 2, thumb * 0.03 * s, -0.022 * s));
    } else parts.push(extrude(roundedRect(-0.009 * s, -0.042 * s, 0.018 * s, 0.042 * s, 0.009 * s), thumb * 1.2, thumb * 0.03 * s, -0.03 * s));
    // The bird: the same fist with the middle finger standing straight out
    // of the knuckles (the middle-fingers emote).
    if (kind === "bird") parts.push(extrude(roundedRect(-0.0095 * s, -0.142 * s, 0.019 * s, 0.075 * s, 0.0095 * s), 0, thumb * -0.004 * s, 0));
  }
  const geo = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  HAND_GEO.set(key, geo);
  return geo;
}

function buildHand(parent, side, s, material, armAngle) {
  // Outer group lines the hand up with the forearm; inner turns the palm
  // to face the thigh with the thumb forward.
  const align = joint(parent);
  align.rotation.z = armAngle;
  const turn = joint(align);
  turn.rotation.y = side * Math.PI / 2;
  const open = new THREE.Mesh(handGeometry("open", side, s), material);
  const fist = new THREE.Mesh(handGeometry("fist", side, s), material);
  const bird = new THREE.Mesh(handGeometry("bird", side, s), material);
  const lsign = new THREE.Mesh(handGeometry("L", side, s), material);
  fist.visible = bird.visible = lsign.visible = false;
  open.castShadow = fist.castShadow = bird.castShadow = lsign.castShadow = true;
  turn.add(open, fist, bird, lsign);
  return { group: align, turn, open, fist, bird, lsign, pose: "open" };
}

/* "open", "fist", "bird" (middle finger up) or "L" (index and thumb out).
   Cheap to call every frame. */
export function setHandPose(rig, side, pose) {
  const h = side < 0 ? rig.hands.L : rig.hands.R;
  if (h.pose === pose) return;
  h.pose = pose;
  h.open.visible = pose !== "fist" && pose !== "bird" && pose !== "L";
  h.fist.visible = pose === "fist";
  h.bird.visible = pose === "bird";
  h.lsign.visible = pose === "L";
}

function joint(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

/* Build a humanoid `height` metres tall. Returns the root plus every part the
   animator needs to pose. The `parts` keys the old rig had are all still
   here with the same meaning, so remote-players.js, enemies.js, zombies.js
   and char-inspector.js need no changes; knees, ankles and elbows are new. */
export function buildHumanoid(material, { height = 1.8, build = 1, gun = true, face = "grin", legs = 1 } = {}) {
  const s = height / 1.8;
  const w = build;

  const root = new THREE.Group();

  // Hip height is exactly the leg chain's reach, so straight legs put the
  // feet on y = 0 and the head crown sits at `height`.
  // `legs`: leg length against the stock 0.9 m (the blocky body: shorter).
  const hipY = 0.9 * s * legs;
  const hips = new THREE.Group();
  hips.position.y = hipY;
  root.add(hips);

  const limbRadius = 0.032 * s * w;

  // --- spine. The torso pivots at the hips and CARRIES the chest, so a lean
  // bends the whole upper body as one; the chest used to hang off the hips
  // on its own, and any lean tore the line apart.
  const torso = joint(hips);
  // Mid-back: the chest hangs off it, so the spine can bend in two places
  // (a hunch over the gun, a counter-twist against the hips) instead of
  // swinging as one stick.
  const torsoMid = joint(torso, 0, 0.24 * s, 0);
  const chest = joint(torsoMid, 0, 0.24 * s, 0);

  const neckLen = 0.09 * s;
  const neckPivot = joint(chest);
  const headPivot = joint(neckPivot, 0, neckLen, 0);
  const neckTop = joint(headPivot, 0, 0.035 * s, 0);

  // --- head: the flat trollface board carrying the real artwork.
  // Big, like the drawing: the face is about as wide as the arms' span.
  const headW = 0.48 * s;
  const headH = 0.45 * s;
  const head = new THREE.Mesh(new THREE.PlaneGeometry(headW, headH), TROLLFACE_HEAD_MAT);
  head.position.y = headH * 0.5 + 0.03 * s;
  // A PlaneGeometry faces +Z; the game's forward is -Z at yaw 0.
  head.rotation.y = Math.PI;
  head.castShadow = true;
  head.userData.isHead = true;
  head.userData.trollface = true;
  headPivot.add(head);

  if (face === "pepe") {
    // Bulging eyes set high and wide, with a broad flat frog mouth.
    const white = new THREE.MeshBasicMaterial({ color: 0xf2f4ee });
    const eyeGeo = new THREE.SphereGeometry(0.062 * s, 10, 10);
    const pupilGeo = new THREE.SphereGeometry(0.026 * s, 8, 8);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, white);
      eye.position.set(side * 0.085 * s, 0.255 * s, 0.115 * s);
      const pupil = new THREE.Mesh(pupilGeo, DARK);
      pupil.position.set(side * 0.095 * s, 0.25 * s, 0.163 * s);
      headPivot.add(eye, pupil);
    }
    const lips = new THREE.Mesh(
      new THREE.TorusGeometry(0.115 * s, 0.019 * s, 6, 18, Math.PI * 0.85),
      DARK,
    );
    lips.rotation.x = Math.PI;
    lips.rotation.z = -Math.PI * 0.075;
    lips.position.set(0, 0.14 * s, 0.125 * s);
    headPivot.add(lips);
    head.visible = false;
  }

  // --- arms: both leave the spine at the same point, the base of the neck —
  // no shoulders, the way the stick figure is drawn. Elbow halfway down;
  // with it at 0 the arm is a straight stick, so every existing pose (and
  // the gun, mounted on armR at the hand) still lines up.
  const ARM = new THREE.Vector3(0.30 * s * w, -0.62 * s, 0);
  // Shoulder: a socket at the neck base that only ever SLIDES (a shrug, a
  // roll forward and back with the arm swing) — the arm pivot under it does
  // all the turning, so every IK below still solves in chest axes. At rest
  // it sits exactly on the chest point and the silhouette is unchanged.
  // Wrist: turns the mitt (and anything the fist holds) against the forearm.
  const mkArm = (side) => {
    const shoulder = joint(chest);
    const pivot = joint(shoulder);
    const elbow = joint(pivot, side * ARM.x * 0.48, ARM.y * 0.48, 0);
    const hand = joint(elbow, side * ARM.x * 0.52, ARM.y * 0.52, 0);
    const wrist = joint(hand);
    return { shoulder, pivot, elbow, hand, wrist };
  };
  const L = mkArm(-1), R = mkArm(1);
  const inkMat = material?.isShaderMaterial ? material : INK;
  const armAngle = Math.atan2(ARM.x, -ARM.y);
  // Big cartoon mitts, the way the figure is drawn — about a third of the
  // head's width across.
  const handScale = 1.55 * s;
  const hands = { L: buildHand(L.wrist, -1, handScale, inkMat, -armAngle), R: buildHand(R.wrist, 1, handScale, inkMat, armAngle) };
  // What the right fist holds that isn't a gun (a melee weapon): a mount at
  // the wrist whose own x rotation is the melee wrist cock.
  const gripR = joint(R.wrist);
  // Two-handed guns ride the chest, not an arm: both hands reach to them
  // (see _gripSupport). One-handed ones (pistols) stay on the right arm.
  const gunMount = joint(chest);

  // --- legs: knee halfway, ankle, and a short toe so the foot reads as a
  // foot. Both legs split from the one point at the bottom of the spine.
  const THIGH = 0.45 * s * legs, SHIN = 0.45 * s * legs - limbRadius;
  // Legs rest splayed a little, so a pose that doesn't place the feet (a
  // dance, the death fall) still draws two legs rather than one line. The
  // foot placement takes the splay back out.
  const mkLeg = (side) => {
    const pivot = joint(hips);
    const splay = joint(pivot);
    splay.rotation.z = side * LEG_SPLAY;
    const knee = joint(splay, 0, -THIGH, 0);
    const ankle = joint(knee, 0, -SHIN, 0);
    // Ball of the foot: the toe flexes up here as the heel peels off.
    const ball = joint(ankle, 0, -0.003 * s, -0.05 * s);
    const toe = joint(ball, 0, -0.002 * s, -0.035 * s);
    return { pivot, knee, ankle, ball, toe };
  };
  const LL = mkLeg(-1), LR = mkLeg(1);

  const body = new BodyStroke(root, [
    // neck → spine → hips → left leg, one stroke
    [neckTop, chest, torsoMid, hips, LL.knee, LL.ankle, LL.ball, LL.toe],
    [hips, LR.knee, LR.ankle, LR.ball, LR.toe],
    // Arms are drawn from the arm pivots, which ride the shoulder sockets,
    // so a shrug lifts the line; a clothed troll's pivots sit out at its
    // shoulders (setShoulders), a bare one's on the socket.
    [L.pivot, L.elbow, L.hand],
    [R.pivot, R.elbow, R.hand],
  ], [neckTop, chest, hips, LL.toe, LR.toe, L.hand, R.hand, L.pivot, R.pivot], limbRadius,
  // The enemy dissolve is a shader of its own; everything else is ink.
  inkMat);

  // --- weapon, carried in the right hand
  let gunMesh = null;
  if (gun) {
    gunMesh = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a2c28, roughness: 0.5, metalness: 0.6 });
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.07 * s, 0.1 * s, 0.44 * s), bodyMat);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016 * s, 0.016 * s, 0.3 * s, 8), bodyMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = -0.34 * s;
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04 * s, 0.15 * s, 0.06 * s), bodyMat);
    mag.position.set(0, -0.11 * s, -0.02 * s);
    gunMesh.add(receiver, barrel, mag);
  }

  // --- hit proxies: invisible, generously-sized primitives used ONLY for
  // bullet raycasts. The visible line is a few cm across — true to the look,
  // but a needle-thin hitbox would be nearly unhittable at range or with a
  // controller. They ride the same pivots, so they follow every pose.
  //
  // 2026-10-02, from the hitbox lab's coverage sweep (hitbox-lab.js): 8-11%
  // of a visible troll took no hit. 73% of that was the mitts (no proxy at
  // all), 16% the forearm (one upright capsule per arm, so a bent arm left
  // it), 6% the feet, 5% the face board's edges. Now every bone has its own
  // capsule laid along it, the mitts and feet have theirs, and the head is
  // sized to the board's corners. `hitPart` names the part for the lab.
  const makeHitProxy = (geo, parent, isHead, part = isHead ? "head" : "limbs") => {
    const m = new THREE.Mesh(geo, HIT_PROXY_MAT);
    m.visible = false;
    m.userData.isHitProxy = true;
    m.userData.hitPart = part;
    if (isHead) m.userData.isHead = true;
    parent.add(m);
    return m;
  };
  // A capsule from `parent`'s origin to the point `to` in its space.
  const boneProxy = (parent, to, r) => {
    const m = makeHitProxy(new THREE.CapsuleGeometry(r, Math.max(0.001, to.length()), 4, 8), parent, false);
    m.position.copy(to).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().normalize());
    return m;
  };

  // The board's corners: 0.24 left about 6% of the face art outside.
  const hitHead = makeHitProxy(new THREE.SphereGeometry(0.255 * s, 20, 14), headPivot, true);
  hitHead.position.y = headH * 0.5 + 0.03 * s;

  const hitTorso = makeHitProxy(new THREE.CapsuleGeometry(0.16 * s * w, 0.42 * s, 4, 8), torso, false, "body");
  hitTorso.position.y = 0.24 * s;

  const hitHips = makeHitProxy(new THREE.SphereGeometry(0.15 * s * w, 8, 6), hips, false, "body");

  // Arms: upper arm and forearm each along their own bone, and the mitt.
  const hitArms = [];
  for (const [arm, hand] of [[L, hands.L], [R, hands.R]]) {
    hitArms.push(boneProxy(arm.pivot, arm.elbow.position, 0.075 * s * w));
    hitArms.push(boneProxy(arm.elbow, arm.hand.position, 0.07 * s * w));
    // a ball round the mitt, centred on the mitt itself (it sits off the
    // wrist joint): measured 10.7 cm to its farthest point
    // (visible meshes only: the group also carries hidden spare hands)
    root.updateMatrixWorld(true);
    const box = new THREE.Box3(), piece = new THREE.Box3();
    hand.group.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      box.union(piece.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
    });
    const mitt = makeHitProxy(new THREE.SphereGeometry(0.1 * s, 10, 8), hand.group, false);
    hand.group.worldToLocal(box.getCenter(mitt.position));
    hitArms.push(mitt);
  }

  // Legs: thigh on the splay joint (the one the knee hangs from, so the
  // splay is followed), the whole shin, and the foot to the toe.
  const hitLegs = [];
  for (const leg of [LL, LR]) {
    hitLegs.push(boneProxy(leg.knee.parent, leg.knee.position, 0.08 * s * w));
    hitLegs.push(boneProxy(leg.knee, leg.ankle.position, 0.07 * s * w));
    hitLegs.push(boneProxy(leg.ankle, leg.toe.position, 0.06 * s));
  }

  const hitboxMeshes = [hitHead, hitTorso, hitHips, ...hitArms, ...hitLegs];

  const rig = {
    root,
    parts: {
      hips, torso, spine: torsoMid, chest, neckPivot, headPivot, neckTop, head,
      shoulderL: L.shoulder, shoulderR: R.shoulder,
      armL: L.pivot, armR: R.pivot, elbowL: L.elbow, elbowR: R.elbow,
      wristL: L.wrist, wristR: R.wrist,
      // The hip sockets are the leg pivots; named both ways.
      legL: LL.pivot, legR: LR.pivot, hipL: LL.pivot, hipR: LR.pivot,
      kneeL: LL.knee, kneeR: LR.knee,
      ankleL: LL.ankle, ankleR: LR.ankle, ballL: LL.ball, ballR: LR.ball,
      toeL: LL.toe, toeR: LR.toe,
      gun: gunMesh, body: body.mesh,
      handL: hands.L.group, handR: hands.R.group, gripR, gunMount,
    },
    hands,
    body,
    hitboxMeshes,
    scale: s,
    hipY,
    legScale: legs,
    thigh: THIGH,
    shin: SHIN,
    limbRadius,
    gait: { blend: 0 },
    build: w,
    // Left arm segment lengths and its rest direction (chest space), for
    // the support-hand reach in _gripSupport.
    upperArm: ARM.length() * 0.48,
    foreArm: ARM.length() * 0.52,
    armRestL: new THREE.Vector3(-ARM.x, ARM.y, 0).normalize(),
    armRestR: new THREE.Vector3(ARM.x, ARM.y, 0).normalize(),
  };
  if (gunMesh) mountHeldWeapon(rig, gunMesh);
  // The Roblox Studio clips (characters/clips.js), shared, filled as they load.
  rig.clips = GAME_CLIPS;
  return rig;
}

/* Give a built rig another `build` and `legs` (buildHumanoid's) in place:
   the arm and leg joints, the lengths the poses read, and the bone hit
   capsules laid along the new bones (their thickness kept). For a body
   cosmetic worn on a live rig (blocky-body.js wearBlocky), so the game's
   rig isn't rebuilt. Returns a function that puts it all back. */
export function reshapeRig(rig, { build = 1, legs = 1 } = {}) {
  const p = rig.parts, s = rig.scale;
  const keys = ["build", "legScale", "hipY", "thigh", "shin", "limbRadius", "upperArm", "foreArm"];
  const saved = Object.fromEntries(keys.map((k) => [k, rig[k]]));
  const restL = rig.armRestL.clone(), restR = rig.armRestR.clone();
  const joints = [p.elbowL, p.elbowR, p.wristL.parent, p.wristR.parent, p.kneeL, p.kneeR, p.ankleL, p.ankleR, p.hips];
  const pos = joints.map((j) => j.position.clone());
  const hb = rig.hitboxMeshes;
  const hbSaved = hb.map((m) => [m.position.clone(), m.quaternion.clone(), m.scale.clone()]);

  const ARM = new THREE.Vector3(0.30 * s * build, -0.62 * s, 0);
  for (const side of [-1, 1]) {
    const k = side < 0 ? "L" : "R";
    p[`elbow${k}`].position.set(side * ARM.x * 0.48, ARM.y * 0.48, 0);
    p[`wrist${k}`].parent.position.set(side * ARM.x * 0.52, ARM.y * 0.52, 0);
  }
  rig.limbRadius = 0.032 * s * build;
  rig.hipY = 0.9 * s * legs;
  rig.thigh = 0.45 * s * legs;
  rig.shin = 0.45 * s * legs - rig.limbRadius;
  p.hips.position.y = rig.hipY;
  for (const k of ["L", "R"]) {
    p[`knee${k}`].position.y = -rig.thigh;
    p[`ankle${k}`].position.y = -rig.shin;
  }
  rig.build = build;
  rig.legScale = legs;
  rig.upperArm = ARM.length() * 0.48;
  rig.foreArm = ARM.length() * 0.52;
  rig.armRestL.set(-ARM.x, ARM.y, 0).normalize();
  rig.armRestR.set(ARM.x, ARM.y, 0).normalize();

  // hitboxMeshes: head, torso, hips, then per arm (L, R) upper, fore, mitt,
  // then per leg (L, R) thigh, shin, foot. A bone capsule follows its bone.
  const along = (m, to) => {
    const g = m.geometry.parameters;
    m.position.copy(to).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(_rsUp, _rsDir.copy(to).normalize());
    m.scale.set(1, (to.length() + 2 * g.radius) / (g.length + 2 * g.radius), 1);
  };
  if (hb.length >= 15) {
    along(hb[3], p.elbowL.position); along(hb[4], p.wristL.parent.position);
    along(hb[6], p.elbowR.position); along(hb[7], p.wristR.parent.position);
    along(hb[9], p.kneeL.position); along(hb[10], p.ankleL.position);
    along(hb[12], p.kneeR.position); along(hb[13], p.ankleR.position);
  }
  return () => {
    Object.assign(rig, saved);
    rig.armRestL.copy(restL);
    rig.armRestR.copy(restR);
    joints.forEach((j, i) => j.position.copy(pos[i]));
    hb.forEach((m, i) => { m.position.copy(hbSaved[i][0]); m.quaternion.copy(hbSaved[i][1]); m.scale.copy(hbSaved[i][2]); });
  };
}
const _rsUp = new THREE.Vector3(0, 1, 0), _rsDir = new THREE.Vector3();

/* The finer joints — mid-back, shoulder sockets, wrists, balls of the feet —
   back to rest. Poses that don't drive them (dances, emotes, the death fall)
   call this so a gait's leftovers don't stick. */
export function resetSecondaryJoints(rig) {
  const p = rig.parts;
  p.spine.rotation.set(0, 0, 0);
  p.shoulderL.position.set(0, 0, 0);
  p.shoulderR.position.set(0, 0, 0);
  p.wristL.rotation.set(0, 0, 0);
  p.wristR.rotation.set(0, 0, 0);
  p.ballL.rotation.set(0, 0, 0);
  p.ballR.rotation.set(0, 0, 0);
}

/* A clothed troll's body (TROLLS-TRAITS.md): its arms start `half` metres
   (unscaled) either side of the neck's base, at the garment's armholes,
   instead of both at the one point the bare stick figure has, and the ink
   neck goes (the garment brings a drawn one). Every arm IK (gun hold,
   throws, emotes) measures from the pivots' own positions, so they follow.
   0 puts the bare stick figure back. */
export function setClothed(rig, half = 0) {
  const p = rig.parts, s = rig.scale;
  rig.shoulderHalf = half;
  p.armL.position.x = -half * s;
  p.armR.position.x = half * s;
  // The spine line starts at the chest instead of under the chin (on the
  // chest itself: hung off the head it swung out of the garment).
  (half ? p.chest : p.headPivot).add(p.neckTop);
  p.neckTop.position.set(0, half ? 0 : 0.035 * s, 0);
}

/* Hips for a body that has them (the blocky body): each leg starts `half`
   metres (unscaled) either side of the spine's base, and the feet plant
   under them, instead of both legs leaving the stick figure's one point.
   The leg IK measures from the hip joints' own positions. 0 puts it back. */
export function setHips(rig, half = 0) {
  const p = rig.parts, s = rig.scale;
  rig.hipHalf = half;
  p.legL.position.x = -half * s;
  p.legR.position.x = half * s;
}

/* Every named joint a pose can turn, for tools (the ?joints=1 rig lab). */
export const RIG_JOINTS = [
  "hips", "torso", "spine", "chest", "neckPivot", "headPivot",
  "shoulderL", "armL", "elbowL", "wristL", "shoulderR", "armR", "elbowR", "wristR",
  "hipL", "kneeL", "ankleL", "ballL", "hipR", "kneeR", "ankleR", "ballR",
];

/* Whole-body poses blend into each other: starting or ending an emote, a
   dance, the gait coming back after either, the body moves from where it
   was to the new pose over a fifth of a second instead of snapping. Each
   poser brackets its work with beginPose(rig, kind) / endPose(rig); when
   the kind changes, the joints as they stood (last frame's pose) are kept
   and the new pose is eased in from them. Posers that call other posers
   only count at the outside. A death snaps (it has its own fall), and so
   does a rig nobody posed for a while (it wasn't on screen). Returns true
   from endPose when it moved anything, so the caller rebuilds the body. */
const XFADE = 0.22;
const _xq = new THREE.Quaternion(), _xv = new THREE.Vector3();
function _xfJoints(rig) {
  return rig.xfJoints || (rig.xfJoints = [...new Set(RIG_JOINTS.map((n) => rig.parts[n]).filter(Boolean))]);
}
export function beginPose(rig, kind) {
  rig.poseDepth = (rig.poseDepth || 0) + 1;
  if (rig.poseDepth > 1) return;
  const now = performance.now();
  const stale = now - (rig.poseAt ?? -1e9) > 300;
  rig.poseAt = now;
  if (rig.poseKind === kind) return;
  const from = rig.poseKind;
  rig.poseKind = kind;
  if (!from || from === "death" || stale) { rig.xfade = null; return; }
  const js = _xfJoints(rig);
  rig.xfade = { t0: now, q: js.map((o) => o.quaternion.clone()), p: js.map((o) => o.position.clone()) };
}
export function endPose(rig) {
  rig.poseDepth = Math.max(0, (rig.poseDepth || 1) - 1);
  const x = rig.xfade;
  if (rig.poseDepth > 0 || !x) return false;
  const k = (performance.now() - x.t0) / 1000 / XFADE;
  if (k >= 1) { rig.xfade = null; return false; }
  const w = _smooth(Math.max(0, k));
  _xfJoints(rig).forEach((o, i) => {
    _xq.copy(o.quaternion);
    o.quaternion.slerpQuaternions(x.q[i], _xq, w);
    _xv.copy(o.position);
    o.position.lerpVectors(x.p[i], _xv, w);
  });
  return true;
}

/* Straight knees and elbows, level feet, square hips — the neutral the
   dances and the death pose were written against. Walking leaves them bent. */
function _resetJoints(rig) {
  const p = rig.parts;
  // The gait aims the hip joints in full 3D: clear its twist too.
  p.legL.rotation.set(0, 0, 0);
  p.legR.rotation.set(0, 0, 0);
  p.kneeL.rotation.set(0, 0, 0);
  p.kneeR.rotation.set(0, 0, 0);
  p.ankleL.rotation.set(0, 0, 0);
  p.ankleR.rotation.set(0, 0, 0);
  p.elbowL.rotation.set(0, 0, 0);
  p.elbowR.rotation.set(0, 0, 0);
  p.hips.rotation.y = 0;
  p.chest.rotation.y = 0;
  resetSecondaryJoints(rig);
  setHandPose(rig, -1, "open");
  setHandPose(rig, 1, "open");
}

/* ----------------------------------------------------------------- the gait

   Legs are placed, not swung. Each foot follows a path relative to the hips:
   planted on the ground and sliding back at exactly the body's speed while
   it bears weight (so it doesn't skate), then lifted and carried forward to
   the next footfall. Two-bone IK finds the knee. The stride and cadence
   both come from the real speed, so a walk and a sprint are different gaits
   and the feet stay put under both.

   Step length grows with speed, and the rest of the speed comes from
   cadence, as it does for people: a 1.4 m/s walk is ~0.76 m steps at ~110 a
   minute, the 4.2 m/s bot run ~1.37 m at ~185, the 5.2 m/s player run
   ~1.6 m at ~195, the 7 m/s sprint ~2 m at ~210 (a real runner's numbers;
   the old 0.34 + 0.16 v, capped at 1.45 m, spun the legs at 250-290 a
   minute). Long run steps are mostly flight, so the foot still lands within
   the leg's reach (see the duty factor in _poseHumanoid). `legs` is the
   rig's leg length against the stock one (rig.legScale): shorter legs take
   shorter, quicker steps. */
export function gaitStepLength(mps, legs = 1) {
  return Math.max(0.34, Math.min(2.1, 0.45 + 0.22 * mps)) * legs;
}

/* The gait's inputs from a body's ground velocity (world m/s) and facing
   (the game's yaw): its speed, and its strafe (+ right) and forward (+
   ahead, - backpedal) on its own axes, scaled like the local body's. For
   anything that only knows where it was (a replay, an NPC being walked).
   Smooth the velocity first: position steps are jittery. */
export function gaitFromVelocity(yaw, vx, vz, out = {}) {
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  out.speed = Math.hypot(vx, vz);
  out.strafe = 0; out.forward = 1;
  if (out.speed > 0.05) {
    out.strafe = Math.max(-1, Math.min(1, (vx * cos - vz * sin) * 6));
    out.forward = Math.max(-1, Math.min(1, (-vx * sin - vz * cos) * 6));
  }
  return out;
}

/* Radians of `phase` per second at `mps`: one full cycle is two steps.
   `legs`: rig.legScale, as for gaitStepLength. */
export function gaitPhaseRate(mps, legs = 1) {
  if (!(mps > 0.05)) return 0;
  return Math.PI * mps / gaitStepLength(mps, legs);
}

const _hipJoint = new THREE.Vector3();
const _foot = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

/* Point a hip-knee-ankle chain at `target` (root space). Knees bend toward
   the body's front (-Z). Exact: the thigh is aimed in the plane of the
   hip-to-foot line and the knee's forward direction, and the hip joint
   turned to match (the old pitch-then-roll split drifted off the target
   when the hips twisted and rolled in a run, which slid planted feet). */
const _lF = new THREE.Vector3(), _lN = new THREE.Vector3(), _lT = new THREE.Vector3();
const _lX = new THREE.Vector3(), _lY = new THREE.Vector3(), _lZ = new THREE.Vector3();
const _lM = new THREE.Matrix4(), _lQ = new THREE.Quaternion(), _lS = new THREE.Quaternion(), _lK = new THREE.Quaternion();
const _AX = new THREE.Vector3(1, 0, 0), _AZ = new THREE.Vector3(0, 0, 1);
function _solveLeg(rig, side, pivot, knee, ankle, target, footPitch, footYaw = 0) {
  const p = rig.parts;
  // Hip joint in root space, then the foot in the hips' own frame.
  _hipJoint.copy(pivot.position).applyEuler(p.hips.rotation).add(p.hips.position);
  _foot.subVectors(target, _hipJoint);
  _q.setFromEuler(p.hips.rotation).invert();
  _foot.applyQuaternion(_q);

  const a = rig.thigh, b = rig.shin;
  const len = Math.max(1e-4, _foot.length());
  const d = Math.min(a + b - 1e-4, Math.max(0.05, len));
  const atHip = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
  const atKnee = Math.acos(Math.max(-1, Math.min(1, (a * a + b * b - d * d) / (2 * a * b))));

  // f: toward the foot. n: the knee's way (forward, square to f).
  _lF.copy(_foot).divideScalar(len);
  _lN.set(0, 0, -1).addScaledVector(_lF, _lF.z);
  if (_lN.lengthSq() < 1e-6) _lN.set(0, 1, 0).addScaledVector(_lF, -_lF.y);
  _lN.normalize();
  // The thigh, out of f toward n by the hip angle.
  _lT.copy(_lF).multiplyScalar(Math.cos(atHip)).addScaledVector(_lN, Math.sin(atHip));
  // Its frame: bones run down -Y, the knee hinges on X and folds the shin
  // back (+Z), away from the knee's forward.
  _lY.copy(_lT).negate();
  _lZ.copy(_lN).negate().addScaledVector(_lY, _lN.dot(_lY)).normalize();
  _lX.crossVectors(_lY, _lZ);
  _lQ.setFromRotationMatrix(_lM.makeBasis(_lX, _lY, _lZ));
  // The hip joint carries the rest splay (a fixed child turn): take it out.
  _lS.setFromAxisAngle(_AZ, side * LEG_SPLAY).invert();
  pivot.quaternion.copy(_lQ).multiply(_lS);
  knee.rotation.set(-(Math.PI - atKnee), 0, 0);
  // Keep the foot level with the ground and pointing ahead (or the way a
  // planted foot was put down, `footYaw` off the body), plus whatever pitch
  // the step wants: the wanted turn in the hips' frame, less the thigh's and
  // shin's.
  _lK.setFromEuler(knee.rotation);
  _lS.setFromEuler(_e.set(footPitch, footYaw, 0, "YXZ")).premultiply(_q);
  ankle.quaternion.copy(_lQ).multiply(_lK).invert().multiply(_lS);
}

/* A foot put where a pose wants it (an emote's footwork, emotes.js): the
   sole at `target` in root space (y 0 is standing on the ground, forward
   -z), pitched `footPitch` (+ toe down, heel up; - heel down, toe up) and
   turned `footYaw` off the body. The ankle rides a limb's radius over the
   sole, as the gait plants it. The leg solves itself from wherever the hips
   are, so set the hips first. `side` -1 left, 1 right. */
const _pf = new THREE.Vector3();
export function placeFoot(rig, side, target, footPitch = 0, footYaw = 0) {
  const p = rig.parts;
  _pf.copy(target);
  _pf.y += rig.limbRadius;
  if (side < 0) _solveLeg(rig, -1, p.legL, p.kneeL, p.ankleL, _pf, footPitch, footYaw);
  else _solveLeg(rig, 1, p.legR, p.kneeR, p.ankleR, _pf, footPitch, footYaw);
}

const _smooth = (t) => t * t * (3 - 2 * t);
const LEG_SPLAY = 0.09;

/* Feet stay where they're put. A planted foot is pinned to its spot on the
   ground, and to the way it pointed, in the world: a sudden stop, a cut to
   the side, the body turning over it or a remote player's jittery position
   can't drag it along. On the move it lets go as it lifts, and the swing
   eases the difference out on its way to the next footfall. Standing, a
   foot the body has moved or turned off steps: one foot at a time lifts and
   puts itself back under the hips, pointing the new way. That's the stop
   too: the feet stay where the last stride left them and step in. A foot
   that's suddenly far off (a respawn, a teleport, the 360 swivel) is just
   put back. `feet[i].target` is in the root's frame and becomes the pinned
   spot; `feet[i].yaw` the foot's turn off the body. */
/* Nobody moves quite like anybody else: each troll gets its own arm swing,
   elbow bend, hip twist, stance width, posture, bounce, head carriage and
   fidget, a little either side of the norm, from `rig.styleSeed` (a remote
   player's is their id, so everyone sees them move the same way) or at
   random. Nothing here touches the stride itself, so the feet still plant
   exactly. */
export function gaitStyle(rig) {
  if (rig.style) return rig.style;
  let seed = (Math.floor(rig.styleSeed ?? Math.random() * 2147483646) % 2147483646) + 1;
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 3; i++) r();
  return (rig.style = {
    arm: 0.8 + r() * 0.4, elbow: 0.75 + r() * 0.5, twist: 0.8 + r() * 0.45, width: 0.88 + r() * 0.26,
    lean: (r() - 0.5) * 0.07, bounce: 0.8 + r() * 0.4, head: (r() - 0.5) * 0.1, sway: 0.6 + r() * 0.8, fidget: 0.7 + r() * 0.6,
  });
}

const STEP_TIME = 0.26;
const _lkM = new THREE.Matrix4(), _lkI = new THREE.Matrix4(), _lkV = new THREE.Vector3();
function _footLock(rig, feet, dt, { walking, s, weight, off }) {
  const g = rig.gait;
  const L = g.lock || (g.lock = feet.map(() => ({ on: false, x: 0, y: 0, z: 0, yaw: 0, ox: 0, oz: 0, oyaw: 0, step: -1, sx: 0, sz: 0, syaw: 0 })));
  if (off) {
    for (const k of L) { k.on = false; k.step = -1; k.ox = k.oz = k.oyaw = 0; }
    return;
  }
  // The root's frame in the world (its parent may move it: a grunt's mesh).
  const root = rig.root;
  _lkM.compose(root.position, root.quaternion, root.scale);
  if (root.parent) _lkM.premultiply(root.parent.matrixWorld);
  _lkI.copy(_lkM).invert();
  const e = _lkM.elements;
  const yaw = Math.atan2(e[8], e[10]);
  const toWorld = (k, x, z) => { _lkV.set(x, 0, z).applyMatrix4(_lkM); k.x = _lkV.x; k.y = _lkV.y; k.z = _lkV.z; };
  const toRoot = (x, y, z) => _lkV.set(x, y, z).applyMatrix4(_lkI);
  const lockAt = (k, x, z, footYaw) => { toWorld(k, x, z); k.yaw = footYaw; k.on = true; k.ox = k.oz = k.oyaw = 0; };
  const decay = Math.exp(-dt * 9);
  const errs = [0, 0];
  feet.forEach((f, i) => {
    const k = L[i];
    // The pinned spot is where the heel or ball meets the ground; the ankle
    // rolling forward over the ball as the heel peels is the stride's own.
    const bx = f.target.x - f.rollX, bz = f.target.z - f.rollZ;
    if (k.step >= 0 && walking) {
      // Moving off mid-step: the stride takes the foot from where it is.
      toRoot(k.sx, k.y, k.sz);
      const w = _smooth(k.step);
      k.ox = (_lkV.x - bx) * (1 - w); k.oz = (_lkV.z - bz) * (1 - w); k.oyaw = wrapAngle(k.syaw - yaw) * (1 - w);
      k.step = -1;
    }
    if (k.step >= 0) {
      // A standing step: up, across to the foot's place under the hips, down.
      k.step = Math.min(1, k.step + dt / STEP_TIME);
      const w = _smooth(k.step), arc = Math.sin(Math.PI * k.step);
      toRoot(k.sx, k.y, k.sz);
      f.target.x = _lkV.x + (bx - _lkV.x) * w + f.rollX;
      f.target.z = _lkV.z + (bz - _lkV.z) * w + f.rollZ;
      f.target.y += arc * 0.055 * s;
      f.pitch += arc * 0.25;
      f.yaw = wrapAngle(k.syaw - yaw) * (1 - w);
      f.hold = 1 - arc;
      if (k.step >= 1) { k.step = -1; lockAt(k, bx, bz, yaw); }
      return;
    }
    if (walking && !f.planted) {
      // In the swing: let go, and fade out where it was pinned.
      if (k.on) {
        toRoot(k.x, k.y, k.z);
        k.ox = _lkV.x - bx; k.oz = _lkV.z - bz; k.oyaw = wrapAngle(k.yaw - yaw);
        k.on = false;
      }
      k.ox *= decay; k.oz *= decay; k.oyaw *= decay;
      f.target.x += k.ox; f.target.z += k.oz; f.yaw = k.oyaw;
      return;
    }
    if (!k.on) lockAt(k, bx + k.ox, bz + k.oz, yaw + k.oyaw);
    toRoot(k.x, k.y, k.z);
    let ex = _lkV.x - bx, ez = _lkV.z - bz;
    const eyaw = wrapAngle(k.yaw - yaw);
    const dist = Math.hypot(ex, ez);
    if (dist > 0.75 * s || Math.abs(eyaw) > 1.4) { lockAt(k, bx, bz, yaw); return; }
    const hx = _lkV.x - rig.parts.hips.position.x, hz = _lkV.z - rig.parts.hips.position.z;
    const out = Math.hypot(hx, hz), reach = 0.55 * s;
    if (walking && out > reach) {
      // Run off from its foot (a hard cut at speed): it slides rather than
      // tear the leg out of the hip.
      const c = reach / out;
      ex = hx * c + rig.parts.hips.position.x - bx; ez = hz * c + rig.parts.hips.position.z - bz;
      toWorld(k, bx + ex, bz + ez);
    } else if (!walking && weight * f.side < -0.3 && dist < 0.06 * s) {
      // Standing, the foot without the weight on it shuffles the last bit
      // to its place.
      const c = Math.max(0, 1 - dt * 0.12 * s / Math.max(1e-4, dist));
      ex *= c; ez *= c;
      toWorld(k, bx + ex, bz + ez);
    }
    f.target.x = bx + ex + f.rollX;
    f.target.z = bz + ez + f.rollZ;
    f.yaw = eyaw;
    if (!walking) errs[i] = Math.max(Math.hypot(ex, ez) / (0.11 * s), Math.abs(eyaw) / 0.5);
  });
  // Standing: the foot furthest off its place steps, one at a time.
  if (!walking && L.every((k) => k.step < 0)) {
    const i = errs[0] >= errs[1] ? 0 : 1;
    if (errs[i] > 1) {
      const k = L[i];
      k.step = 0; k.sx = k.x; k.sz = k.z; k.syaw = k.yaw; k.on = false;
    }
  }
}

/* Melee arm, as keyframes of [t, arm raise (x), arm out/across (z), elbow,
   wrist, chest twist]. The blade leaves the fist square to the forearm, so
   a bent elbow holds it upright and a turned wrist lays it along the arm
   for the thrust. MeleeState alternates the two, like the first-person one. */
const MELEE_CARRY = [0.45, -0.25, 1.25, 0, 0];
const MELEE_KEYS = {
  swing: [
    [0, ...MELEE_CARRY],
    [0.28, 2.7, -0.45, 1.5, 0, 0.35],     // wind up overhead, blade back
    [0.5, 0.9, 0.35, 0.2, 0, -0.45],      // cut down and across
    [0.7, 0.5, 0.45, 0.4, 0, -0.35],      // follow through
    [1, ...MELEE_CARRY],
  ],
  thrust: [
    [0, ...MELEE_CARRY],
    [0.3, 0.9, -0.2, 2.2, -1.2, 0.25],    // draw the fist back to the chest
    [0.55, 1.55, -0.05, 0.05, -1.45, -0.2], // punch the blade straight out
    [0.75, 1.5, -0.05, 0.1, -1.4, -0.15],
    [1, ...MELEE_CARRY],
  ],
};
function meleeArm(kind, t) {
  const keys = MELEE_KEYS[kind] || MELEE_KEYS.swing;
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const a = keys[i], b = keys[i + 1];
  const k = _smooth(Math.max(0, Math.min(1, (t - a[0]) / Math.max(1e-4, b[0] - a[0]))));
  return a.slice(1).map((v, j) => v + (b[j + 1] - v) * k);
}

/* The gun arm's forward raise, and where a held weapon sits on that arm:
   at the hand, turned back by the same angle so it comes out level and
   pointing ahead when the arm is at the carry. */
export const GUN_CARRY = 1.35;
export function mountHeldWeapon(rig, mesh) {
  // The first-person hands built onto the gun are for the viewmodel; a body
  // holds it in its own mitts.
  // Every gun, now and any added later, is held in both hands and shot from
  // the shoulder (user: "third person shooting should apply to all weapons
  // even the ones that will be added"). A model that doesn't mark its grip
  // gets one worked out (inferGrip) instead of the old one-handed forearm
  // mount; tools/troll-ops-3p-hold-test.mjs checks every gun in weapons.js.
  if (!mesh.userData.gripPos) mesh.userData.gripPos = inferGrip(mesh);
  mesh.traverse((o) => { if (o.userData.hand) o.visible = false; });
  rig.held = mesh;
  // Placed every frame by _gripSupport.
  mesh.position.set(0, 0, 0);
  mesh.rotation.set(0, 0, 0);
  rig.parts.gunMount.add(mesh);
}
/* Where the trigger hand goes on a gun that doesn't say: its first-person
   grip hand if it has one, else under the receiver a third of the way
   forward from the back (gun space: barrel down -Z). */
function inferGrip(mesh) {
  let hand = null;
  for (const c of mesh.children) if (!hand && c.userData.hand) hand = c;
  if (hand) return hand.position.clone();
  mesh.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
  const box = new THREE.Box3(), piece = new THREE.Box3(), m = new THREE.Matrix4();
  mesh.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    box.union(piece.copy(o.geometry.boundingBox).applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld)));
  });
  if (box.isEmpty()) return new THREE.Vector3(0, -0.06, 0.05);
  return new THREE.Vector3(0, box.min.y + (box.max.y - box.min.y) * 0.25, box.max.z - (box.max.z - box.min.z) * 0.3);
}

/* Pose the rig. `phase` advances with movement (use gaitPhaseRate); `lower`
   is 0..1 how far the body is crouched (1 = prone). `strafe` is -1..1, the
   mover's local sideways velocity; `forward` is -1..1 fore/aft (negative =
   backpedal). `speed` is 0..1 of a 4.2 m/s run; `mps`, when the caller knows
   it, is the real speed and sizes the stride so the feet plant exactly. */
/* `hold`: "gun" (default), "melee" or "none". `swing`: { t: 0..1, kind:
   "swing" | "thrust" } while a melee attack plays. `recoil`: 0..1, the gun's
   current kick. `block`: 0..1 into the saber guard (melee hold, no swing).
   `ads`: 0..1 aiming down sights — the gun comes up to the eye, on the aim. */
/* `air`: off the ground; `vy`: vertical speed (m/s, + up); `land`: 0..1, a
   landing's force on the frame it lands (0.5 for a jump's, 1 for a big drop).
   `sprint`: 0..1 how far into the sprint clip, for a body whose top speed
   isn't a sprint's (a bot); left out, it follows the speed. */
/* `prone`: 0..1 lying down (docs/PRONE.md), eased by the caller: the body
   flat behind the eye point, propped on the elbows, the legs out behind;
   on the move, the crawl. */
function _poseHumanoid(rig, { sprint = null, phase = 0, moving = false, pitch = 0, lower = 0, strafe = 0, forward = 1, speed = 1, mps = null, dt = 0.016, zombie = false, hasGun = false, hold = "gun", swing = null, recoil = 0, block = 0, ads = 0, air = false, vy = 0, land = 0, prone = 0 }) {
  const p = rig.parts;
  const s = rig.scale;
  const str = Math.max(-1, Math.min(1, strafe));
  const fwd = Math.max(-1, Math.min(1, forward));
  const spd = moving ? Math.max(0.28, Math.min(1, speed)) : 0;
  const v = moving ? (mps ?? (zombie ? 1.3 : spd * 4.2)) : 0;

  // 0 = walk, 1 = run: duty factor, bounce, knee lift and lean all follow it.
  const run = Math.max(0, Math.min(1, (v - 1.8) / 2.8));

  // Ease in and out of the cycle, so starting and stopping blend rather
  // than snapping the legs between the gait and the stand.
  const g = rig.gait;
  const st = gaitStyle(rig);
  g.blend += ((moving ? 1 : 0) - g.blend) * Math.min(1, dt * 9);
  const blend = g.blend;
  // Acceleration, smoothed: a take-off pitches the body forward, a stop sits
  // it back against the brakes (the lean below), on top of the speed lean.
  if (dt > 0) {
    const acc = Math.max(-40, Math.min(40, (v - (g.v ?? v)) / Math.max(dt, 1e-3)));
    g.acc = (g.acc ?? 0) + (acc - (g.acc ?? 0)) * Math.min(1, dt * 6);
    g.v = v;
  }

  p.hips.rotation.set(0, 0, 0);
  p.hips.position.x = 0;
  p.hips.position.z = 0;

  const crouch = Math.max(0, Math.min(1, lower));
  const legK = rig.legScale ?? 1;
  const stepLen = gaitStepLength(v || 1, legK) * (zombie ? 0.55 : 1);
  // Share of the cycle a foot is down: 62% at a walk (both feet down between
  // steps), about a third at a jog, less the faster the run (both feet up in
  // between), so a planted foot never lands further than the leg reaches:
  // ~0.42 m ahead of the hips.
  const runDuty = Math.min(0.34, 0.34 * s * legK / Math.max(0.1, stepLen));
  const duty = zombie ? 0.66 : 0.62 + (runDuty - 0.62) * run;
  const lift = (zombie ? 0.05 : 0.09 + run * 0.13) * s * legK;

  // Standing still, the weight rests on one leg at a time: that hip rides
  // up and over it, the other drops and its knee goes slack, and every few
  // seconds the weight moves across; a slow sway on top. Gone on the move.
  if (dt > 0) {
    g.wT = (g.wT ?? 1.5 + Math.random() * 3) - dt;
    if (g.wSide == null) g.wSide = Math.random() < 0.5 ? -1 : 1;
    if (g.wT <= 0) { g.wSide = -g.wSide; g.wT = (3.5 + Math.random() * 4.5) / st.fidget; }
    g.w = (g.w ?? 0) + (g.wSide - (g.w ?? 0)) * Math.min(1, dt * 1.4);
    g.swayT = (g.swayT ?? Math.random() * 20) + dt;
  }
  const idleK = zombie ? 0 : (1 - blend) * (1 - crouch);
  const weight = (g.w ?? 0) * idleK;   // +1: on the right leg

  // Direction of travel in the rig's local ground plane (+x right, -z ahead).
  let tx = str, tz = -fwd;
  const tl = Math.hypot(tx, tz) || 1;
  tx /= tl; tz /= tl;
  // Side-steps are shorter: legs can't scissor past each other sideways.
  const sideways = Math.abs(tx);
  const stride = stepLen * (1 - sideways * 0.45);

  const cyc = phase;
  const standY = rig.hipY * (0.985 - crouch * 0.52);
  // Hips twist with the stride and roll over the standing leg.
  p.hips.rotation.y = Math.sin(cyc) * (0.07 + run * 0.08) * st.twist * blend * -tz * (1 - sideways);
  p.hips.rotation.z = Math.cos(cyc) * 0.035 * st.twist * blend + weight * 0.05;
  p.hips.position.x = weight * 0.026 * s;
  p.hips.position.z = Math.sin(g.swayT * 0.7) * 0.006 * st.sway * s * idleK;

  // A sprint clip made in Roblox Studio (rig.clips, characters/clips.js)
  // takes over the body above the legs as a straight-ahead run reaches
  // sprint speed (or as far as `sprint` says, 0..1: a bot's full run).
  // The legs stay on the foot placement below. With a gun in
  // hand it's the gun sprint (Phantom Forces': the gun drops across the
  // chest), which also carries the gun: _gripSupport reads rig.clipGun.
  const gunClip = hold === "gun" && hasGun ? rig.clips?.["sprint-gun"] : null;
  const clip = zombie ? null : gunClip || rig.clips?.sprint;
  // Aiming or shooting ends a sprint, as in PF: the clip fades while the gun
  // is up (rig.fireK: _gripSupport's last frame).
  const gunUp = gunClip ? Math.max(Math.min(1, ads), rig.fireK ?? 0) : 0;
  const sprintK = sprint ?? _smooth(Math.max(0, Math.min(1, (v - 5.4) / 1.2)));
  const clipW = clip ? sprintK * blend * (1 - crouch) * Math.max(0, fwd) * (1 - sideways) * (1 - gunUp) : 0;
  const clipS = clipW > 0 ? sampleGait(clip, cyc / (Math.PI * 2), rig.clipSample || (rig.clipSample = {})) : null;
  rig.clipGun = clipS && clip === gunClip ? { w: clipW, s: clipS } : null;
  if (clipS) applyClip(rig, clipS, clipW, CLIP_HIPS);

  // A walking stance starts a little nearer the hips than it ends: the heel
  // lands just ahead, the toe pushes off well behind (with the heel up).
  const back = 0.075 * (1 - run);
  const feet = [];
  for (const [side, legPhase] of [[-1, cyc], [1, cyc + Math.PI]]) {
    let u = (legPhase / (Math.PI * 2)) % 1;
    if (u < 0) u += 1;
    let along, up, pitchFoot, flex = 0, rollOn = 0;
    if (u < duty) {
      // Planted: slides from ahead to behind at the body's own speed. Late
      // in the stance the heel peels up (lifting the ankle) and the toe
      // bends at the ball.
      const t = u / duty;
      along = (0.5 - t - back) * duty * 2 * stride;
      // The heel rises about the ball (5 cm ahead of the ankle), which stays
      // on the ground: the foot tips toe-down by the angle that takes, and the
      // toe bends back the same so it stays flat.
      const peel = t > 0.62 ? Math.pow((t - 0.62) / 0.38, 1.5) * 0.8 : 0;
      up = Math.sin(peel) * 0.05 * s;
      rollOn = (1 - Math.cos(peel)) * 0.05 * s;   // the ankle rolls over the ball
      along += rollOn;
      flex = peel / 0.8;
      pitchFoot = -peel;
    } else {
      // Swing: peel off behind, arc forward, reach for the next footfall.
      // The foot leaves and meets the ground moving back under the body at
      // its speed (still, to the ground), not stopped under the hips (which
      // skidded it in at full speed): a Hermite curve with the stance's own
      // slope at both ends, so it kicks up behind and reaches out and paws
      // back before landing. A little gentler in a long run step.
      const t = (u - duty) / (1 - duty);
      const p0 = (-0.5 - back) * duty * 2 * stride, p1 = (0.5 - back) * duty * 2 * stride;
      const m = -2 * stride * (1 - duty);
      const t2 = t * t, t3 = t2 * t;
      along = (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m + (3 * t2 - 2 * t3) * p1 + (t3 - t2) * m;
      // ...picking up from the push-off: heel up, foot tipped, toe bent,
      // which all ease out as the foot clears the ground.
      const off = t < 0.3 ? 1 - t / 0.3 : 0;
      rollOn = off * (1 - Math.cos(0.8)) * 0.05 * s;
      along += rollOn;
      up = Math.max(Math.sin(Math.PI * Math.pow(t, 0.8)) * lift, off * Math.sin(0.8) * 0.05 * s);
      pitchFoot = -Math.sin(Math.PI * t) * 0.22 + (t > 0.8 ? (t - 0.8) * 1.2 : 0) - off * 0.8;
      flex = off;
    }
    flex *= 0.8 * blend;
    along *= blend;
    up *= blend;
    pitchFoot *= blend;
    // Feet sit a hand's width apart; a crouch spreads them a little.
    // ...or, on a body with hips (setHips), right under its own hip.
    const baseX = side * (Math.max(0.085 * st.width, rig.hipHalf || 0) + crouch * 0.06) * s;
    _foot.set(baseX + tx * along, rig.limbRadius + up, tz * along);
    // Crouched feet land a touch behind the hips, prone ones further.
    _foot.z += crouch * 0.12 * s;
    // Standing: the resting foot steps a little forward and out.
    if (weight * side < 0) { _foot.z -= Math.abs(weight) * 0.05 * s; _foot.x += side * Math.abs(weight) * 0.015 * s; }
    // How much this foot holds the hips down: a planted one fully, the
    // swinging one only as it comes in to land (so the hips meet it there
    // rather than dropping on contact), not while it's out in the air.
    const hold = u < duty ? 1 : _smooth(Math.max(0, ((u - duty) / (1 - duty) - 0.75) / 0.25));
    feet.push({ side, along, target: _foot.clone(), pitch: pitchFoot, flex, hold, planted: u < duty, rollX: tx * rollOn * blend, rollZ: tz * rollOn * blend, yaw: 0 });
  }
  _footLock(rig, feet, dt, { walking: blend > 0.5, s, weight, off: zombie || !(dt > 0) || (g.air || 0) > 0.3 });

  // Pelvis height. A walk vaults over a straight leg: the hips are as high
  // as the planted feet let them be, lowest as one foot lands with the other
  // still behind, highest over the standing leg. A run is a spring: the
  // hips sink into each footfall, rise off it and fly until the next one,
  // and sit a little lower on bent, ready knees.
  const legR = (rig.thigh + rig.shin) * 0.995;
  let reach = Infinity;
  for (const f of feet) {
    const dx = f.target.x - p.hips.position.x - f.side * (rig.hipHalf || 0) * s, dz = f.target.z - p.hips.position.z;
    const h2 = legR * legR - dx * dx - dz * dz;
    reach = Math.min(reach, (h2 > 0 ? Math.sqrt(h2) : 0) + f.target.y + (1 - f.hold) * 0.2 * s);
  }
  const stepU = ((cyc / Math.PI) % 1 + 1) % 1;            // through each step
  const sf = Math.min(0.999, 2 * duty);                   // ...the share with a foot down
  const spring = stepU < sf ? -Math.sin(Math.PI * stepU / sf) * 0.034 : Math.sin(Math.PI * (stepU - sf) / (1 - sf)) * 0.03;
  // (in proportion to the legs: the same centimetres sank a short-legged
  // body (the blocky one, legs 0.67) into a lunge)
  const level = standY - (run * 0.06 * s + (zombie ? 0.06 * s : 0) - spring * st.bounce * s * run) * blend * legK - Math.abs(weight) * 0.006 * s;
  p.hips.position.y = Math.max(level - 0.07 * s * legK, Math.min(level, reach));

  // In the air: knees tuck on the way up and the legs reach for the ground
  // on the way down, the free arm lifts out for balance. Only for a real
  // jump or a drop of more than a tenth of a second, so running down stairs
  // doesn't flicker into it. Landing: the knees take it (the hips drop over
  // the planted feet, more for a harder landing) and spring back.
  if (dt > 0) {
    g.airT = air ? (g.airT || 0) + dt : 0;
    const inAir = air && (g.airT > 0.1 || vy > 2);
    g.air = (g.air || 0) + ((inAir ? 1 : 0) - (g.air || 0)) * Math.min(1, dt * (inAir ? 12 : 18));
    // A landing kicks a spring (under-damped: down, a small rebound, settled
    // in ~0.4 s); `land` 1 sinks it about the full squash.
    if (land > 0) g.landV = Math.max(g.landV || 0, land * 20);
    // Stepped in slices of 1/60 s or less: a crowd's far trolls are posed
    // with up to 0.1 s at a time, and in one step that long this spring
    // gains instead of settling, so a bot that landed hard from the Royale
    // drop sank through the island, further every pose, out to kilometres
    // (user, 2026-10-18: bots "in the ground", blinking).
    const lw = 13, lz = 0.55;
    const n = Math.min(12, Math.ceil(dt * 60)), h = dt / n;
    for (let i = 0; i < n; i++) {
      g.landV = (g.landV || 0) + (-lw * lw * (g.landX || 0) - 2 * lz * lw * (g.landV || 0)) * h;
      g.landX = (g.landX || 0) + g.landV * h;
    }
    if (!(Math.abs(g.landX) < 3)) g.landX = g.landV = 0;   // a hard landing peaks ~1.5: past that it has run away
  }
  const airK = g.air || 0, squash = Math.max(0, g.landX || 0);
  if (airK > 0.001) {
    const ext = Math.max(0, Math.min(1, -vy / 6));          // 0 rising .. 1 falling fast
    const L = rig.thigh + rig.shin;
    const hipAir = standY - 0.02 * s;
    for (const f of feet) {
      const lead = f.side < 0 ? 1 : -1;                     // the left knee comes up first
      const ay = hipAir - L * (0.66 + 0.28 * ext) + (lead > 0 ? 0.05 * s * (1 - ext) : 0);
      const az = (lead > 0 ? -0.16 : 0.08) * s * (1 - ext * 0.6);
      f.target.set(f.target.x + (f.side * 0.1 * s - f.target.x) * airK, f.target.y + (ay - f.target.y) * airK, f.target.z + (az - f.target.z) * airK);
      f.pitch += (0.35 * (1 - ext) - f.pitch) * airK;
      f.flex *= 1 - airK;
    }
    p.hips.position.y += (hipAir - p.hips.position.y) * airK;
  }
  p.hips.position.y -= squash * 0.17 * s;

  // Follow-through: the head is carried, not bolted on. It hangs back on a
  // take-off, carries on into a stop and a landing (a nod forward), and
  // settles with a little overshoot.
  // Hit: the round shoves the body too (flinchRig), not just the head: the
  // torso rocks away from it, the hips give that way and the knees dip,
  // then it all springs back.
  const F = headState(rig).flinch;
  if (dt > 0) {
    const step = Math.min(0.05, dt);
    const want = Math.max(-0.12, Math.min(0.14, -(g.acc ?? 0) * 0.009)) + squash * 0.35;
    const hw = 9, hz = 0.45;
    g.hfV = (g.hfV || 0) + (-hw * hw * ((g.hf || 0) - want) - 2 * hz * hw * (g.hfV || 0)) * step;
    g.hf = (g.hf || 0) + g.hfV * step;
    const bw = 10, bz = 0.5;
    F.bvp += (-bw * bw * F.bp - 2 * bz * bw * F.bvp) * step;
    F.bvr += (-bw * bw * F.br - 2 * bz * bw * F.bvr) * step;
    F.bvd += (-bw * bw * F.bd - 2 * bz * bw * F.bvd) * step;
    F.bp += F.bvp * step; F.br += F.bvr * step; F.bd += F.bvd * step;
  }
  p.hips.position.x -= F.br * 0.06 * s;
  p.hips.position.z += F.bp * 0.06 * s;
  p.hips.position.y -= Math.max(0, F.bd) * 0.08 * s;
  const bob = p.hips.position.y - standY;
  const lie = Math.max(0, Math.min(1, prone));
  rig.proneK = lie;
  if (lie > 0) _proneLegs(rig, feet, lie, cyc, blend);
  p.ballL.rotation.set(feet[0].flex, 0, 0);
  p.ballR.rotation.set(feet[1].flex, 0, 0);
  _solveLeg(rig, -1, p.legL, p.kneeL, p.ankleL, feet[0].target, feet[0].pitch, feet[0].yaw * (1 - airK));
  _solveLeg(rig, 1, p.legR, p.kneeR, p.ankleR, feet[1].target, feet[1].pitch, feet[1].yaw * (1 - airK));
  // -1 = that foot trails behind, 1 = it's out ahead: drives the arms.
  const legSwingL = (feet[0].along / Math.max(1e-3, duty * stride)) * Math.sign(-tz || 1);

  // Lean: into a run, back when backpedalling, banked into a strafe. The
  // chest rides the mid-back, which rides the torso, so the upper body's
  // share is split over two joints and the back curves instead of kinking;
  // the counter-twist against the hips runs up the spine the same way.
  // The leans below are written + forward; an upright joint tips forward
  // on -x (+x tipped the back of the body over: the run and the crouch used
  // to lean backwards), hence the minus signs.
  const accLean = Math.max(-0.14, Math.min(0.16, (g.acc ?? 0) * 0.012)) * (fwd < 0 ? -1 : 1) * (1 - sideways * 0.7);
  // A body with its own gun hold (rig.gunHold, blocky-body.js) runs upright
  // behind the gun: the lean on its big block torso read as a hard slant
  // (user: "too slanted").
  const upright = rig.gunHold && hasGun && hold === "gun" ? rig.gunHold.lean ?? 1 : 1;
  const moveLean = ((0.04 + run * 0.16 + st.lean) * blend * (fwd < 0 ? -0.6 : 1) * (1 - sideways * 0.7) + accLean + (zombie ? 0 : st.lean * 0.4 * (1 - blend))) * upright;
  p.torso.rotation.set(-(crouch * 0.25 + moveLean * 0.7 + squash * 0.3 + airK * 0.06) + F.bp, 0, str * -0.1 * blend - weight * 0.04 + F.br);
  p.spine.rotation.set(-(crouch * 0.05 + moveLean * 0.15), -p.hips.rotation.y * 0.55, str * -0.03 * blend);
  p.chest.rotation.set(-(crouch * 0.07 + moveLean * 0.15), -p.hips.rotation.y * 0.85, str * -0.03 * blend);
  // (a body with its own gun hold runs upright behind the gun: rig.gunHold.lean)
  if (clipS) applyClip(rig, clipS, clipW * (gunClip ? rig.gunHold?.lean ?? 1 : 1), CLIP_SPINE);
  if (lie > 0) _proneTorso(rig, lie, cyc, blend);
  const lean =p.torso.rotation.x + p.spine.rotation.x + p.chest.rotation.x;

  if (zombie) {
    // Both arms out front, with a lopsided shamble.
    p.armL.rotation.set(1.5 - lean + Math.sin(phase * 0.5) * 0.12, 0, 0.12);
    p.armR.rotation.set(1.42 - lean + Math.cos(phase * 0.5) * 0.12, 0, -0.18);
    p.elbowL.rotation.set(0.25, 0, 0);
    p.elbowR.rotation.set(0.35, 0, 0);
    setHandPose(rig, -1, "open");
    setHandPose(rig, 1, "open");
    p.torso.rotation.x -= 0.12;
    // Hunched: shoulders up and forward, limp wrists.
    p.spine.rotation.x -= 0.08;
    p.shoulderL.position.set(0, 0.008 * s, -0.022 * s);
    p.shoulderR.position.set(0, 0.012 * s, -0.018 * s);
    p.wristL.rotation.set(0.6 + Math.sin(phase * 0.5) * 0.12, 0, 0);
    p.wristR.rotation.set(0.7 + Math.cos(phase * 0.5) * 0.12, 0, 0);
    _poseNeckAndHead(rig, { pitch: 0.16, sway: Math.sin(phase * 0.5) * 0.09, dt, lead: 0, lean, bob, run, phase, moving: blend > 0.5 });
    return;
  }

  // Gun arm: raised forward in a level ready carry, independent of the
  // body's lean (the chest carries the shoulder, so the lean is taken back
  // out). Positive x is forward: the old carry used -1.35, which held the
  // gun behind the body with the barrel at the ground. The elbow stays
  // straight — GUN_MOUNT sits at the straight arm's hand.
  const carrySwing = Math.sin(phase) * 0.04 * spd * blend;
  const kick = Math.max(0, Math.min(1, recoil));
  const gunInHands = hold === "gun";
  if (gunInHands) {
    // Scoped, a one-handed gun comes up level with the eye (0.6 rad: 0.2
    // read as no change at all from across the map; user) and in toward
    // the centre line, and follows the aim (two-handed: _gripSupport).
    const a = Math.max(0, Math.min(1, ads));
    p.armR.rotation.set(GUN_CARRY + a * 0.6 + pitch * (0.32 + a * 0.6) + carrySwing * (1 - a) + kick * 0.18 - lean, 0, -0.15 + a * 0.32);
    p.elbowR.rotation.set(0, 0, 0);
    p.torso.rotation.x += kick * 0.05;   // the kick rocks the shoulders back
  } else if (hold === "melee") {
    const [ax, az, el, wr, twist] = swing ? meleeArm(swing.kind, swing.t) : MELEE_CARRY;
    p.armR.rotation.set(ax + carrySwing - lean, 0, az);
    p.elbowR.rotation.set(el, 0, 0);
    p.gripR.rotation.set(wr, 0, 0);
    p.chest.rotation.y += twist ?? 0;
  } else if (hold === "none") {
    // Empty hands (Socialize): the right arm swings too, against the left,
    // the same way the free left arm does below.
    const swingAmp = (0.35 + run * 0.55) * st.arm * blend;
    p.armR.rotation.set(legSwingL * swingAmp - lean * 0.8 - 0.05 - run * 0.25 * blend, 0, -0.06 - run * 0.04);
    p.elbowR.rotation.set(0.2 * st.elbow + (run * 1.1 * st.elbow + Math.max(0, -legSwingL) * 0.25) * blend, 0, 0);
  } else {
    p.armR.rotation.set(0, 0, -0.06);
    p.elbowR.rotation.set(0.2, 0, 0);
  }
  setHandPose(rig, 1, hold === "none" ? "open" : "fist");
  setHandPose(rig, -1, gunInHands && hasGun ? "fist" : "open");

  if (gunInHands && hasGun) {
    // Support hand on the handguard.
    const aL = gunInHands ? Math.max(0, Math.min(1, ads)) : 0;
    p.armL.rotation.set(GUN_CARRY - 0.07 + aL * 0.55 + pitch * 0.28 + carrySwing * 0.6 + kick * 0.15 - lean, 0, 0.18 - aL * 0.08);
    p.elbowL.rotation.set(0, 0, 0);
  } else {
    // Free arm: swings against its own leg, from the shoulder, with an elbow
    // that bends more the faster you go — hanging loose at a walk, pumping
    // at ninety degrees in a sprint.
    const swingAmp = (0.35 + run * 0.55) * st.arm * blend;
    p.armL.rotation.set(-legSwingL * swingAmp - lean * 0.8 - 0.05 - run * 0.25 * blend, 0, 0.06 + run * 0.04);
    p.elbowL.rotation.set(0.2 * st.elbow + (run * 1.1 * st.elbow + Math.max(0, legSwingL) * 0.25) * blend, 0, 0);
    // Balance in the air: the free arm lifts out and a little forward.
    p.armL.rotation.x += 0.35 * airK;
    p.armL.rotation.z += 0.55 * airK;
    p.elbowL.rotation.x += 0.4 * airK;
  }
  if (hold === "none" && airK > 0.001) {
    p.armR.rotation.x += 0.35 * airK;
    p.armR.rotation.z -= 0.55 * airK;
    p.elbowR.rotation.x += 0.4 * airK;
  }

  // Shoulder sockets: each rolls forward with its own arm's swing, both
  // rise a touch on every breath and in a sprint, and the trigger side
  // shrugs back into the recoil. They only slide (see buildHumanoid).
  const gripped = gunInHands && hasGun;
  rig.breathT = (rig.breathT || 0) + dt;
  const breath = Math.sin(rig.breathT * 2.1) * 0.005 * s * (1 - blend * 0.7);
  const shoulderLift = breath + run * 0.007 * s * blend;
  const roll = legSwingL * (0.012 + run * 0.01) * s * blend;
  p.shoulderL.position.set(0, shoulderLift, gripped ? 0 : roll);
  p.shoulderR.position.set(0, shoulderLift + kick * 0.014 * s, gripped ? kick * 0.012 * s : -roll * 0.5);
  // Wrists: a held weapon owns the hand, so they stay straight; a free hand
  // flicks a little past each end of its swing.
  p.wristL.rotation.set(gripped ? 0 : -legSwingL * 0.2 * blend, 0, 0);
  p.wristR.rotation.set(hold === "none" ? legSwingL * 0.15 * blend : 0, 0, 0);
  // The clip's arms only where a hand is free (a gun's hands are on the gun).
  if (clipS && !gripped) applyClip(rig, clipS, clipW, CLIP_ARM_L);
  if (clipS && hold === "none") applyClip(rig, clipS, clipW, CLIP_ARM_R);
  // Lying down, a hand that isn't on a gun reaches out ahead along the
  // ground on its forearm (hanging, it went through the floor).
  if (lie > 0) {
    if (!gripped) { p.armL.rotation.x += (1.25 - lean - p.armL.rotation.x) * lie; p.elbowL.rotation.x += (0.5 - p.elbowL.rotation.x) * lie; }
    if (!(hold === "gun" && hasGun)) { p.armR.rotation.x += (1.25 - lean - p.armR.rotation.x) * lie; p.elbowR.rotation.x += (0.5 - p.elbowR.rotation.x) * lie; }
  }

  // _poseNeckAndHead's `pitch` is + head down (the zombie's hang, the
  // dances' nods); the aim's is + up. Passed straight through, an aim up
  // tipped the head down (and an NPC reading looked at the sky).
  _poseNeckAndHead(rig, { pitch: -pitch, sway: 0, dt, lead: str * blend, lean, bob, run, phase, moving: blend > 0.3, busy: kick > 0.02 || !!swing, follow: g.hf || 0 });
  // Lying down, the head comes up the rest of the way to look ahead (it
  // takes back only about half the lean on its own).
  if (lie > 0) {
    p.neckPivot.rotation.x += PRONE_TIP * lie * 0.45 * 0.4;
    p.headPivot.rotation.x += PRONE_TIP * lie * 0.45 * 0.6;
  }
}

/* Prone (docs/PRONE.md). The torso tips forward from the hips by
   PRONE_TIP, short of flat: the shoulders ride up on the elbows, so the
   gun (levelled against the lean, _gripSupport) sits about a forearm off
   the ground. The hips drop to the ground and move back, so the head ends
   over the body's origin (the eye point; the legs run back from it, as
   core/movement.js's bodyRoom has them), and the feet go out behind, toes
   down, knees toward the ground. Crawling, the legs draw up in turn and
   the shoulders roll with them. */
const PRONE_TIP = Math.PI / 2 - 0.42;   // the torso's tip forward, lying
const PRONE_HIP_Y = 0.15;               // hips off the ground (scaled)
const PRONE_HIP_Z = 0.46;               // and back from the origin
function _proneLegs(rig, feet, lie, cyc, blend) {
  const p = rig.parts, s = rig.scale;
  p.hips.position.y += (PRONE_HIP_Y * s - p.hips.position.y) * lie;
  p.hips.position.z += (PRONE_HIP_Z * s - p.hips.position.z) * lie;
  p.hips.position.x *= 1 - lie;
  p.hips.rotation.x *= 1 - lie;
  p.hips.rotation.z *= 1 - lie;
  // the crawl's hip swing, side to side with the strokes
  p.hips.rotation.y = p.hips.rotation.y * (1 - lie) + Math.sin(cyc) * 0.1 * blend * lie;
  const reach = (rig.thigh + rig.shin) * 0.97;
  for (const f of feet) {
    // one leg draws up and out each stroke, the other pushes straight
    const draw = Math.max(0, Math.sin(cyc + (f.side < 0 ? 0 : Math.PI))) * blend;
    const back = reach * (1 - draw * 0.32);
    const x = f.side * ((rig.hipHalf || 0.085) * s + 0.06 * s + draw * 0.18 * s);
    const y = rig.limbRadius + 0.02 * s;
    f.target.x += (x - f.target.x) * lie;
    f.target.y += (y - f.target.y) * lie;
    f.target.z += (p.hips.position.z + Math.sqrt(Math.max(0, back * back - (p.hips.position.y - y) ** 2 - (x - f.side * (rig.hipHalf || 0) * s) ** 2)) - f.target.z) * lie;
    f.pitch += (1.35 - f.pitch) * lie;   // toes down, the sole up
    f.flex *= 1 - lie;
    f.yaw *= 1 - lie;
  }
}
function _proneTorso(rig, lie, cyc, blend) {
  const p = rig.parts;
  p.torso.rotation.x += (-PRONE_TIP - p.torso.rotation.x) * lie;
  p.torso.rotation.z = p.torso.rotation.z * (1 - lie) + Math.sin(cyc) * 0.07 * blend * lie;
  p.spine.rotation.x *= 1 - lie;
  p.chest.rotation.x *= 1 - lie;
  // the shoulders roll against the hips as the elbows pull
  p.chest.rotation.y += -Math.sin(cyc) * 0.08 * blend * lie;
}

/* Arm angles: positive x raises an arm FORWARD (see GUN_CARRY). These dances
   were first written the other way round and reached behind the body. */

/* A looping victory/idle dance - the locker screen's answer to Fortnite's
   emote preview. `t` is seconds elapsed, runs forever (no start/end, just
   feed a growing clock). Built from a handful of layered sine waves at
   different rates rather than one single beat, so the loop doesn't read
   as a metronome: hips carry the main beat (bounce + side-to-side sway),
   shoulders/arms pump on the same beat with a bigger swing than any real
   footstep gait would use (a dance reads as looser and bigger than a
   walk), the head bobs slightly out of phase with the hips (a real
   dancer's head lags the hip snap by a beat), and the knees bend on the
   downbeat so the bounce comes from the whole body, not just the hips
   sliding up and down on rails. */
function _poseDance(rig, t) {
  const p = rig.parts;
  _resetJoints(rig);
  const s = rig.scale;
  const beat = t * Math.PI * 2 * 1.8; // ~1.8 bounces/second

  const bounce = Math.abs(Math.sin(beat)); // 0..1, snaps down on every beat
  const sway = Math.sin(beat * 0.5); // one full side-to-side per two bounces

  p.hips.position.y = rig.hipY - bounce * 0.09 * s;
  p.hips.rotation.z = sway * 0.16;
  p.hips.rotation.y = Math.sin(beat * 0.5 + Math.PI / 2) * 0.12;

  p.torso.rotation.z = sway * -0.12;
  p.torso.rotation.x = 0.06 + bounce * 0.04;
  p.chest.rotation.z = sway * -0.08;
  p.chest.rotation.x = 0.05 + bounce * 0.03;

  // Knees bend on the downbeat (both together, not alternating like a
  // walk cycle) so the bounce visibly comes from the legs, not just the
  // hips sliding vertically.
  const kneeBend = bounce * 0.5;
  p.legL.rotation.x = kneeBend;
  p.legR.rotation.x = kneeBend;
  p.legL.rotation.z = sway * 0.10;
  p.legR.rotation.z = sway * 0.10;

  // Arms swing big and opposite the hip sway, elbows-out disco-pump
  // rather than the tight, low running counter-swing poseHumanoid uses.
  const armSwing = Math.sin(beat * 0.5 + Math.PI);
  p.armL.rotation.x = 0.9 - armSwing * 0.5;
  p.armR.rotation.x = 0.9 + armSwing * 0.5;
  p.armL.rotation.z = 0.35 + bounce * 0.15;
  p.armR.rotation.z = -0.35 - bounce * 0.15;

  // Head bob trails the hip beat slightly (a fixed phase offset rather
  // than perfect lockstep) so the head reads as following the body's
  // motion instead of everything moving as one rigid block.
  const headBob = Math.sin(beat - 0.35);
  _poseNeckAndHead(rig, { pitch: -headBob * 0.12, sway: sway * 0.15, dt: 0, lead: sway * 0.3 });
}

/* Floss: hips swing one way, both arms swing the opposite way and cross in
   front on the offbeat — the actual shape of the dance, just built from the
   same single-segment arm bones as the rest of the rig instead of a real
   elbow. Faster than the disco bounce above; almost no vertical bob, all
   the motion is lateral. */
function _poseDanceFloss(rig, t) {
  const p = rig.parts;
  _resetJoints(rig);
  const beat = t * Math.PI * 2 * 2.2;
  const hipSway = Math.sin(beat);
  const armSway = Math.sin(beat + Math.PI); // opposite phase to the hips

  p.hips.rotation.z = hipSway * 0.22;
  p.hips.rotation.y = Math.sin(beat * 2) * 0.05;
  p.hips.position.y = rig.hipY - Math.abs(Math.sin(beat * 2)) * 0.02 * rig.scale;

  p.torso.rotation.z = hipSway * -0.14;
  p.chest.rotation.z = hipSway * -0.10;

  // Both arms swing together, low and wide, crossing the body — the
  // "floss" itself — rather than the opposite-arm-swing a walk cycle uses.
  p.armL.rotation.x = 0.3;
  p.armR.rotation.x = 0.3;
  p.armL.rotation.z = 0.5 + armSway * 0.55;
  p.armR.rotation.z = -0.5 + armSway * 0.55;

  p.legL.rotation.z = hipSway * 0.06;
  p.legR.rotation.z = hipSway * 0.06;

  _poseNeckAndHead(rig, { pitch: 0.04, sway: hipSway * 0.22, dt: 0, lead: hipSway * 0.2 });
}

/* Headbang: almost all the motion is the head and chest, hips barely move —
   the opposite weighting from the floss/disco moves above, so cycling
   between them reads as different dances rather than the same skeleton
   playing back faster or slower. */
function _poseDanceHeadbang(rig, t) {
  const p = rig.parts;
  _resetJoints(rig);
  const beat = t * Math.PI * 2 * 2.6;
  const nod = Math.max(0, Math.sin(beat)); // snaps down, eases up

  p.hips.position.y = rig.hipY - nod * 0.03 * rig.scale;
  p.torso.rotation.x = 0.1 + nod * 0.22;
  p.chest.rotation.x = 0.08 + nod * 0.3;

  const armPump = Math.sin(beat * 0.5);
  p.armL.rotation.x = 0.6 - armPump * 0.3;
  p.armR.rotation.x = 0.6 + armPump * 0.3;
  p.armL.rotation.z = 0.2;
  p.armR.rotation.z = -0.2;

  p.legL.rotation.x = nod * 0.12;
  p.legR.rotation.x = nod * 0.12;

  _poseNeckAndHead(rig, { pitch: -nod * 0.5, sway: Math.sin(beat * 0.5) * 0.08, dt: 0, lead: 0 });
}

/* Arm-wave: one arm raised and circling overhead while the hips sway low
   and slow underneath — reads as a completely different silhouette from
   the other three (raised arm) rather than another variation on a bounce. */
function _poseDanceWave(rig, t) {
  const p = rig.parts;
  _resetJoints(rig);
  const beat = t * Math.PI * 2 * 1.1;
  const sway = Math.sin(beat * 0.6);
  const circle = beat * 1.4;

  p.hips.position.y = rig.hipY - Math.abs(Math.sin(beat * 1.2)) * 0.03 * rig.scale;
  p.hips.rotation.z = sway * 0.1;
  p.torso.rotation.z = sway * -0.08;
  p.chest.rotation.z = sway * -0.06;

  // Raised arm sweeps a small circle overhead — capped near straight-up
  // (-PI/2) rather than past vertical, so the hand stays within the
  // character's own silhouette instead of pushing the reach higher than
  // the head and widening the frame the hero shot has to fit.
  p.armR.rotation.x = 1.7 - Math.sin(circle) * 0.3;
  p.armR.rotation.z = -0.3 + Math.cos(circle) * 0.3;
  // Other arm keeps a loose, low sway so it doesn't read as frozen.
  p.armL.rotation.x = 0.35 - sway * 0.15;
  p.armL.rotation.z = 0.3;

  p.legL.rotation.z = sway * 0.07;
  p.legR.rotation.z = sway * 0.07;

  _poseNeckAndHead(rig, { pitch: -0.05, sway: sway * 0.18, dt: 0, lead: sway * 0.15 });
}

/* Every available locker emote, in the order the inspector cycles them. */
/* Every pose rebuilds the body line straight after it lands, before the
   frame is drawn: three.js uploads geometry before an object's render hook
   runs, so rebuilding there would draw the line a frame behind the hands
   and head, and it would visibly slip off them in fast motion. */
export function poseHumanoid(rig, arg) {
  if (rig.parts.head.userData.trollface && rig.parts.head.material !== faceMaterial(rig.nftFace || rig.face)) setFace(rig);
  syncCovering(rig);
  syncWristwear(rig);
  syncWristband(rig);
  rig.emoteProps?.hide();   // an emote's props (lean-cup.js), once it's over
  for (const o of rig.emoteBits || []) o.visible = false;   // and the bubble, the crutches (emotes.js)
  beginPose(rig, "gait");
  _poseHumanoid(rig, arg);
  if ((arg.hold ?? "gun") === "gun" && !arg.zombie) _gripSupport(rig, arg);
  if (arg.hold === "melee") _meleeSupport(rig);
  if (arg.hold === "melee" && arg.block > 0 && !arg.swing) _saberGuard(rig, Math.min(1, arg.block), arg.parry);
  // A body whose torso is one rigid block (rig.rigidTorso, blocky-body.js):
  // the spine's and chest's turn against the swinging hips goes to the whole
  // torso instead, so its two halves turn as one (they slid against each
  // other; user: "lower torso seems to be shifting off while running").
  if (rig.rigidTorso) {
    const p = rig.parts;
    p.torso.rotation.y += p.spine.rotation.y + p.chest.rotation.y;
    p.spine.rotation.y = 0;
    p.chest.rotation.y = 0;
  }
  endPose(rig);
  rig.body.update();
}

/* Two hands on the gun. A two-handed gun rides a mount on the chest, held
   level at the aim a little below and in front of the neck (where a stock
   meets the shoulder), and both arms reach to it: the right hand to the
   pistol grip, the left forward along the gun toward the handguard point
   the model marks for its first-person support hand. The arms are short
   and share one shoulder point, so the left hand takes the farthest point
   on that line it can actually reach. Two-bone IK in chest space, elbows
   bending down and out. One-handed guns keep the fixed arm pose. */
const _gT = new THREE.Vector3(), _gDir = new THREE.Vector3(), _gPole = new THREE.Vector3();
const _gO = new THREE.Vector3(), _gP = new THREE.Vector3(), _gE = new THREE.Vector3();
const _gF = new THREE.Vector3(), _gQ = new THREE.Quaternion(), _gGrip = new THREE.Vector3();
const _gSh = new THREE.Vector3(), _gButt = new THREE.Vector3();
const _gPoleL = new THREE.Vector3(-1, -1, 0.2), _gPoleR = new THREE.Vector3(1, -1, 0.2);
function _reachArm(rig, pivot, elbow, rest, target, pole) {
  const a = rig.upperArm, b = rig.foreArm;
  const d = Math.min(a + b - 1e-4, Math.max(0.05, target.length()));
  _gDir.copy(target).normalize();
  const cosA = Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d)));
  _gPole.copy(pole).addScaledVector(_gDir, -pole.dot(_gDir)).normalize();
  _gE.copy(_gDir).multiplyScalar(a * cosA).addScaledVector(_gPole, a * Math.sqrt(1 - cosA * cosA));
  _gF.copy(_gDir).multiplyScalar(d).sub(_gE).normalize();
  pivot.quaternion.setFromUnitVectors(rest, _gE.normalize());
  _gQ.copy(pivot.quaternion).invert();
  elbow.quaternion.setFromUnitVectors(rest, _gF.applyQuaternion(_gQ));
}
/* Put a hand at `target` (chest space) with the elbow bent toward `pole`:
   the same two-bone IK as the gun hold, for emotes. `side` -1 left, +1 right. */
const _rhT = new THREE.Vector3();
export function reachHand(rig, side, target, pole) {
  const p = rig.parts;
  const pivot = side < 0 ? p.armL : p.armR, shoulder = side < 0 ? p.shoulderL : p.shoulderR;
  _rhT.copy(target).sub(pivot.position).sub(shoulder.position);
  _reachArm(rig, pivot, side < 0 ? p.elbowL : p.elbowR, side < 0 ? rig.armRestL : rig.armRestR, _rhT, pole);
}
/* Third-person shooting and reloading (user: "it seems like the gun is only
   being held with one hand and shot with one hand. we also need reloading
   animation for third person"). The gun is placed by its stock: the butt
   sits in the right shoulder pocket and the gun turns about it, so it reads
   as shouldered from behind; both elbows come out where the camera sees
   them. At rest it's a low ready (muzzle dipped); a shot brings it up on the
   aim for a beat (`fired`: seconds since the last shot). `reload` 0..1 plays
   the mag change: the gun cants and drops, the left hand pulls the mag down
   to the belt, brings a fresh one up and seats it. Pistols are held in both
   hands the same way, the left wrapped round the right. */
const _gM = new THREE.Matrix4(), _gM2 = new THREE.Matrix4(), _gS = new THREE.Vector3();
const _gW = new THREE.Vector3(), _gB = new THREE.Vector3(), _gSup = new THREE.Vector3(), _gH = new THREE.Vector3();
const _gPoleL2 = new THREE.Vector3(), _gPoleR2 = new THREE.Vector3(), _gEu = new THREE.Euler(), _gQi = new THREE.Quaternion();
const _gPistolWrap = new THREE.Vector3(-0.05, -0.025, 0.005), _gPort = new THREE.Vector3(0, 0.03, -0.1), _gPt = new THREE.Vector3();
function _gunFrame(mesh) {
  const u = mesh.userData;
  if (u.buttPos) return u;
  // The back of the stock at the bore's height (the support point sits on
  // the handguard's top, the grip below the bore).
  mesh.updateMatrixWorld(true);
  _gM.copy(mesh.matrixWorld).invert();
  const box = new THREE.Box3(), piece = new THREE.Box3();
  mesh.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    for (let q = o; q && q !== mesh; q = q.parent) if (q.userData.hand) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    box.union(piece.copy(o.geometry.boundingBox).applyMatrix4(_gM2.multiplyMatrices(_gM, o.matrixWorld)));
  });
  const boreY = u.supportHandPos ? u.supportHandPos.y - 0.02 : u.gripPos.y + 0.07;
  u.buttPos = new THREE.Vector3(0, boreY, box.isEmpty() ? u.gripPos.z + 0.22 : box.max.z - 0.01);
  return u;
}
/* How far into the reload pose (0..1): up fast, held, back at the end. */
const reloadEnv = (k) => (k <= 0 || k >= 1 ? 0 : Math.min(_smooth(Math.min(1, k / 0.1)), _smooth(Math.min(1, (1 - k) / 0.14))));
const _lerp3 = (out, a, b, t) => out.lerpVectors(a, b, _smooth(Math.max(0, Math.min(1, t))));
function _gripSupport(rig, { pitch = 0, recoil = 0, ads = 0, fired = Infinity, reload = 0, dt = 0.016, carryYaw = 0, carryRoll = 0, moving = false } = {}) {
  const mesh = rig.held;
  const p = rig.parts;
  if (!mesh || !mesh.visible || mesh.parent !== p.gunMount) return;
  const u = mesh.userData;
  const pistol = !!u.pistol || !u.supportHandPos;
  // The menu's port-arms carry turns the gun across the body: old placement.
  if (carryYaw || carryRoll) return _gripSupportCarry(rig, { pitch, recoil, ads, carryYaw, carryRoll });
  _gunFrame(mesh);
  const s = rig.scale, w = rig.build;
  // A body can say where its shoulder pocket is and how big it draws the
  // gun (rig.gunHold, the blocky body: blocky-body.js). The gun's own points
  // (grip, stock, handguard, mag) are in its model's space, so they scale
  // with it (gs).
  const hold = rig.gunHold, gs = hold?.scale ?? 1;
  if (hold) mesh.scale.setScalar(gs);   // (a stick troll's gun is never touched)
  const pt = (v) => _gPt.copy(v).multiplyScalar(gs);
  const kick = Math.max(0, Math.min(1, recoil));
  const lean = p.torso.rotation.x + p.spine.rotation.x + p.chest.rotation.x;
  const a = Math.max(0, Math.min(1, ads));
  // Shooting brings it up fast and it stays up a beat after the last shot.
  const wantUp = fired < 0.9 ? 1 : 0;
  rig.fireK = (rig.fireK ?? 0) + (wantUp - (rig.fireK ?? 0)) * Math.min(1, dt * (wantUp ? 18 : 3.5));
  const rk = reload > 0 && reload < 1 ? reload : 0;
  const rl = reloadEnv(rk);
  // Lying down (rig.proneK) the gun is always on the aim: no low ready on the ground.
  const up = Math.max(a, rig.fireK, rig.proneK || 0) * (1 - rl);
  // A broad body blades into the gun (hold.blade, radians): the upper body
  // turns right-side back, half at the hips and half in the chest, and the
  // left shoulder rolls forward, so the left hand reaches the handguard from
  // a shoulder that's out at the body's side; the gun and the head turn back
  // onto the aim.
  // Only standing: on the move the body runs square to the aim (user:
  // "running while shooting the body should be not angled like this"),
  // easing between the two, and the gun comes in toward the middle of the
  // chest (hold.runX) so the left hand still reaches the handguard.
  let st = 1;
  if (hold) {
    rig.standK = (rig.standK ?? 1) + ((moving ? 0 : 1) - (rig.standK ?? 1)) * Math.min(1, dt * 6);
    st = rig.standK;
  }
  const bl = hold?.blade ? hold.blade * (1 - rl * 0.5) * st : 0;
  if (bl) {
    p.torso.rotation.y -= bl * 0.5;
    p.chest.rotation.y -= bl * 0.5;
    p.headPivot.rotation.y += bl;
  }
  if (hold?.roll) p.shoulderL.position.z -= hold.roll * s;   // standing or running: the left shoulder reaches
  p.gunMount.rotation.order = bl ? "YXZ" : "XYZ";

  // Muzzle on the aim when up, dipped into a low ready when not; a reload
  // tips it up, swings it in and cants the mag well toward the left hand.
  // A pair (the Peacemakers) tips both muzzles up to dump the brass
  // instead of canting a mag well over.
  const pair = !!u.akimbo;
  p.gunMount.rotation.set(
    pitch * (0.5 + up * 0.5) - (1 - up) * (1 - rl) * (hold?.ready ?? 0.3) + kick * 0.12 - lean + rl * (pair ? 0.9 : 0.3),
    (pair ? 0 : rl * 0.3 * (hold?.swing ?? 1)) + bl,
    pair ? 0 : -rl * 0.55 * (hold?.swing ?? 1),
  );
  if (pair) {
    // A gun in each fist, both arms out, the pair centred on the chest.
    _gS.set(0, (-0.24 + up * 0.32 - rl * 0.02) * s, (-0.36 - up * 0.16 + rl * 0.1 + kick * 0.03) * s);
    _gP.copy(pt(u.gripPos)).add(pt(u.gripPosL)).multiplyScalar(0.5).applyEuler(p.gunMount.rotation);
  } else if (pistol) {
    // Both arms out, the gun at the eye line when it's up.
    _gS.set((0.06 - up * 0.055) * s * w, (-0.25 + up * 0.33 - rl * 0.05) * s, (-0.32 - up * 0.2 + rl * 0.08 + kick * 0.03) * s);
    if (hold) _gS.z += (hold.pistolZ ?? hold.z) * s;   // out past a broad chest
    _gP.copy(pt(u.gripPos)).applyEuler(p.gunMount.rotation);
  } else {
    // The butt in the right shoulder pocket; scoped, up and in to the cheek.
    if (hold) _gS.set((hold.x + ((hold.runX ?? hold.x) - hold.x) * (1 - st) - a * 0.04 - rl * 0.03) * s, (hold.y + up * 0.09 + a * 0.05 - rl * 0.08 * (hold.reloadDrop ?? 1)) * s, (hold.z + kick * 0.035) * s);
    else _gS.set((0.085 - a * 0.04 - rl * 0.03) * s * w, (-0.12 + up * 0.09 + a * 0.05 - rl * 0.08) * s, (-0.04 + kick * 0.035) * s);
    _gP.copy(pt(u.buttPos)).applyEuler(p.gunMount.rotation);
  }
  p.gunMount.position.copy(_gS).sub(_gP);
  // A gun sprint clip (Studio) carries a long gun its own way: its gunMount
  // pose is the gun's turn in the chest and where the butt sits, off the
  // shoulder pocket. Shooting, aiming or reloading takes the gun back.
  const gc = rig.clipGun, gcs = gc?.s.gunMount;
  if (gcs && !pistol && !pair) {
    const k = gc.w * (1 - up) * (1 - rl);
    if (k > 0) {
      p.gunMount.quaternion.slerp(gcs.q, k);
      if (gcs.p) _gS.addScaledVector(gcs.p, k * s);
      _gP.copy(pt(u.buttPos)).applyQuaternion(p.gunMount.quaternion);
      p.gunMount.position.copy(_gS).sub(_gP);
      // A long handguard across the chest can end past the left hand's
      // reach: slide the gun back toward that shoulder until it doesn't.
      _gSup.copy(pt(u.supportHandPos)).applyQuaternion(p.gunMount.quaternion).add(p.gunMount.position);
      _gT.copy(_gSup).sub(p.armL.position).sub(p.shoulderL.position);
      const over = _gT.length() - (rig.upperArm + rig.foreArm) * 0.95;
      if (over > 0) p.gunMount.position.addScaledVector(_gT.normalize(), -over);
    }
  }
  // Trigger hand to the grip; the elbow winged out, more when shouldered.
  _gGrip.copy(pt(u.gripPos)).applyEuler(p.gunMount.rotation).add(p.gunMount.position);
  // A short arm on a long stock (hold.reachR, of the arm's length): past
  // that the hand takes the stock's wrist, back from the grip toward the
  // butt, so the arm bends and the elbow comes out. At full stretch it lay
  // straight down the stock, through it (the TROLLS body on the snipers).
  if (hold?.reachR && !pistol && !pair && u.buttPos) {
    const lim = (rig.upperArm + rig.foreArm) * hold.reachR;
    _gSh.copy(p.armR.position).add(p.shoulderR.position);
    if (_gGrip.distanceTo(_gSh) > lim) {
      _gButt.copy(pt(u.buttPos)).applyEuler(p.gunMount.rotation).add(p.gunMount.position);
      let lo = 0, hi = 1;
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        if (_gP.lerpVectors(_gGrip, _gButt, mid).distanceTo(_gSh) > lim) lo = mid; else hi = mid;
      }
      _gGrip.lerp(_gButt, Math.min(hi, 0.5));
    }
  }
  _gT.copy(_gGrip).sub(p.armR.position).sub(p.shoulderR.position);
  _gPoleR2.set(1, pistol ? -1 : -0.55 + up * 0.35, 0.25);
  if (pair) _gPoleR2.set(1, -1.2, 0.1);
  _reachArm(rig, p.armR, p.elbowR, rig.armRestR, _gT, _gPoleR2);

  // Support hand: the handguard (wrapped round the grip on a pistol), or
  // the reload's path.
  if (pair) _gSup.copy(pt(u.gripPosL));
  else if (pistol) _gSup.copy(pt(u.gripPos)).add(_gPistolWrap);
  else {
    _gSup.copy(pt(u.supportHandPos));
    // A big fist on the handguard's top stands up into the sight line:
    // such a body holds it from underneath (hold.under, metres below)
    if (hold?.under) _gSup.y -= hold.under * s;
  }
  _gSup.applyEuler(p.gunMount.rotation).add(p.gunMount.position);
  let magOut = 0;
  const mag = u.magMesh && u.magMesh.parent === mesh ? u.magMesh : null;
  if (rk && !pair) {
    _gB.set(-0.07 * s * w, -0.5 * s, -0.1 * s);   // the belt pouch
    if (hold?.pouch) _gB.set(hold.pouch[0] * s, hold.pouch[1] * s, hold.pouch[2] * s);   // out past a broad body's thigh
    if (mag) {
      _gW.copy(pt(u.magazinePoint)).applyEuler(p.gunMount.rotation).add(p.gunMount.position);
      if (rk < 0.12) _lerp3(_gH, _gSup, _gW, rk / 0.12);
      else if (rk < 0.32) { _lerp3(_gH, _gW, _gB, (rk - 0.12) / 0.2); magOut = 1; }
      else if (rk < 0.42) { _gH.copy(_gB); _gH.y -= Math.sin(((rk - 0.32) / 0.1) * Math.PI) * 0.04 * s; magOut = 1; }
      else if (rk < 0.62) { _lerp3(_gH, _gB, _gW, (rk - 0.42) / 0.2); magOut = 1 - _smooth(Math.max(0, (rk - 0.56) / 0.06)); }
      else if (rk < 0.7) { _gH.copy(_gW); _gH.y += Math.sin(((rk - 0.62) / 0.08) * Math.PI) * 0.035 * s; }   // slap it home
      else _lerp3(_gH, _gW, _gSup, (rk - 0.7) / 0.15);
    } else {
      // Shell by shell: pouch to the loading port, again and again.
      _gW.copy(pt(u.gripPos)).add(_gPort).applyEuler(p.gunMount.rotation).add(p.gunMount.position);
      const loop = 0.5 - 0.5 * Math.cos(Math.max(0, Math.min(1, (rk - 0.08) / 0.8)) * Math.PI * 2 * 4);
      _lerp3(_gH, _gW, _gB, loop);
      if (rk < 0.08) _lerp3(_gH, _gSup, _gW, rk / 0.08);
      else if (rk > 0.88) _lerp3(_gH, _gW, _gSup, (rk - 0.88) / 0.1);
    }
    _gT.copy(_gH).sub(p.armL.position).sub(p.shoulderL.position);
  } else {
    _gO.copy(_gGrip).sub(p.armL.position).sub(p.shoulderL.position);
    _gT.copy(_gSup).sub(p.armL.position).sub(p.shoulderL.position);
    const reach = (rig.upperArm + rig.foreArm) * 0.97;
    if (_gT.length() > reach) {
      let lo = 0, hi = 1;
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        if (_gP.lerpVectors(_gO, _gT, mid).length() <= reach) lo = mid; else hi = mid;
      }
      _gT.lerpVectors(_gO, _gT, lo);
    }
  }
  // Left elbow down and out to the left, where a camera behind can see it.
  _gPoleL2.set(-1, -0.7, 0.1);
  _reachArm(rig, p.armL, p.elbowL, rig.armRestL, _gT, _gPoleL2);
  setHandPose(rig, -1, "fist");
  setHandPose(rig, 1, "fist");

  // The mag rides the left hand out and back (gun space, under the palm).
  if (mag) {
    if (magOut > 0) {
      _gQi.setFromEuler(p.gunMount.rotation).invert();
      _gH.sub(p.gunMount.position).applyQuaternion(_gQi).divideScalar(gs);
      _gH.y -= 0.05;
      mag.position.lerpVectors(u.magazinePoint, _gH, magOut);
      u.magMoved = true;
    } else if (u.magMoved) {
      mag.position.copy(u.magazinePoint);
      u.magMoved = false;
    }
  }
  // Cheek on the stock when scoped: the head dips and leans onto the gun.
  // (+x tips the head BACK. The stick troll had +0.16 here, its face thrown
  // back 9 degrees every time it aimed; bots aim in and out all fight, so
  // their heads nodded up and down: "flopping", user 2026-10-12.)
  if (!pistol && a > 0) {
    p.headPivot.rotation.x -= 0.08 * a;
    p.headPivot.rotation.z -= 0.14 * a;
  }
}
/* The old placement, kept for the menu's port-arms carry (gun turned across
   the body) and anything without the stock data. */
const CARRY_CLEAR = 0.08;   // metres further out a broad body carries the gun
function _gripSupportCarry(rig, { pitch = 0, recoil = 0, ads = 0, carryYaw = 0, carryRoll = 0 } = {}) {
  const mesh = rig.held;
  const p = rig.parts;
  if (!mesh.userData.supportHandPos) return;
  const s = rig.scale, w = rig.build;
  // A broad body (rig.gunHold: blocky-body.js) draws the gun bigger, holds
  // it further out from its chest and takes the handguard from underneath,
  // as the match does: on top, its block forearm swallowed the barrel
  // (user, 2026-10-12: "the weapon seems to penetrate through the arm").
  const hold = rig.gunHold, gs = hold?.scale ?? 1;
  mesh.scale.setScalar(gs);
  const pt = (v) => _gPt.copy(v).multiplyScalar(gs);
  const kick = Math.max(0, Math.min(1, recoil));
  // Level at the aim, independent of the body's lean (the chest carries it).
  const lean = p.torso.rotation.x + p.spine.rotation.x + p.chest.rotation.x;
  // Scoped: the stock comes up into the shoulder and the sights to the eye,
  // and the barrel follows the aim all the way instead of a third of it.
  const a = Math.max(0, Math.min(1, ads));
  // `carryYaw`/`carryRoll` turn the gun across the body (the menu's port-arms
  // carry); the hands follow it through the IK below.
  p.gunMount.rotation.set(pitch * (0.32 + a * 0.6) + kick * 0.18 - lean, carryYaw, carryRoll);
  // Trigger hand: right of centre, below the neck, forward of the chest.
  // Scoped it rises to the chin and in to the centre line, so the sights
  // sit in front of the face and a scoped troll reads as scoped from across
  // the map (user: bots never looked like they aimed in; it was 13 cm, now 40).
  _gGrip.set((0.12 - a * 0.09) * s * w, (-0.24 + a * 0.4) * s, (-0.30 - a * 0.1 + kick * 0.03) * s);
  if (hold) _gGrip.z -= CARRY_CLEAR * s;
  _gP.copy(pt(mesh.userData.gripPos)).applyEuler(p.gunMount.rotation);
  p.gunMount.position.copy(_gGrip).sub(_gP);

  _gT.copy(_gGrip).sub(p.armR.position).sub(p.shoulderR.position);
  // A broad body's elbow rides up and out (hold.carryPoleR): hung down, its
  // thick forearm lay level across the chest with the stock inside it
  // (user, 2026-10-13: the rifle showed through the TROLLS forearm).
  _reachArm(rig, p.armR, p.elbowR, rig.armRestR, _gT, hold?.carryPoleR ? _gPoleR2.set(...hold.carryPoleR) : _gPoleR);

  // Support hand: along grip → handguard, as far as the left arm reaches.
  _gO.copy(_gGrip).sub(p.armL.position).sub(p.shoulderL.position);
  _gT.copy(pt(mesh.userData.supportHandPos));
  if (hold?.under) _gT.y -= hold.under * s;
  _gT.applyEuler(p.gunMount.rotation).add(p.gunMount.position).sub(p.armL.position).sub(p.shoulderL.position);
  const reach = (rig.upperArm + rig.foreArm) * 0.97;
  if (_gT.length() > reach) {
    let lo = 0, hi = 1;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      if (_gP.lerpVectors(_gO, _gT, mid).length() <= reach) lo = mid; else hi = mid;
    }
    _gT.lerpVectors(_gO, _gT, lo);
  }
  _reachArm(rig, p.armL, p.elbowL, rig.armRestL, _gT, _gPoleL);
  setHandPose(rig, -1, "fist");
}

/* Two-handed melee in third person, the way first person holds them: the
   left fist goes on the weapon too, carry and swings alike (user: the saber
   was one-handed in third person). Points are in the melee mesh's own frame
   (gear.js: grip at the origin, blade down -Z), so the hand rides the swing.
   The saber guard lays over this. Reaper's Grin stays one-handed. */
const MELEE_SUPPORT = {
  trollsaber: new THREE.Vector3(0, 0, 0.1),        // below the right fist, toward the pommel
  keyboard: new THREE.Vector3(0, 0, 0.11),         // choked up behind the grip (gear.js SUPPORT_ANCHOR)
  chainsaw: new THREE.Vector3(0, 0.175, -0.268),   // the hoop over the powerhead
};
function _meleeSupport(rig) {
  const p = rig.parts;
  const held = p.gripR.children.find((c) => c.visible && MELEE_SUPPORT[c.userData.meleeId]);
  if (!held) return;
  held.updateWorldMatrix(true, false);
  _gT.copy(MELEE_SUPPORT[held.userData.meleeId]);
  held.localToWorld(_gT);
  p.armL.parent.worldToLocal(_gT).sub(p.armL.position);
  _reachArm(rig, p.armL, p.elbowL, rig.armRestL, _gT, _gPoleL);
  setHandPose(rig, -1, "fist");
}

/* Trollsaber guard, blended in by `k` over the melee carry: both fists on
   the hilt in front of the chest (right at the emitter end, left below it), and the blade
   turned to run up and across to the left, the way the first-person guard
   holds it. Arms by the same IK as the gun; the blade by turning the right
   hand until the held weapon's -Z lies along SABER_GUARD_DIR. */
const SABER_GUARD_DIR = new THREE.Vector3(-0.62, 0.74, -0.25).normalize(); // chest space
const SABER_GUARD_GRIP = new THREE.Vector3(0.12, -0.26, -0.34);              // x s·build, y/z x s
const SABER_HAND_GAP = 0.11;                                                 // along the hilt, x s
const _sgFk = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()];
const _sgQ = new THREE.Quaternion(), _sgQ2 = new THREE.Quaternion(), _sgId = new THREE.Quaternion();
const _sgR = new THREE.Vector3(), _sgL = new THREE.Vector3(), _sgB = new THREE.Vector3(), _sgD = new THREE.Vector3();
const _sgDir = new THREE.Vector3();

/* Deflect parries (user: the saber should bat rounds away with a few
   animations by where they come from, the way Luke Skywalker's blade meets
   every bolt in The Mandalorian). Four poses frame the directions: from the
   left, the blade sweeps out left, upright; from the right it swings across
   to the right; from above it goes flat overhead; from below it drops
   point-down. A round's parry is a blend of them aimed at where it came
   from (ParryState), not one fixed pose, so the blade goes to meet each
   round. `dir` is the blade in chest space, `grip` where the fists go
   (same units as SABER_GUARD_GRIP). */
export const PARRY_ZONES = ["left", "right", "high", "low"];
const PARRY = {
  left:  { dir: new THREE.Vector3(-0.35, 0.9, -0.28).normalize(), grip: new THREE.Vector3(-0.1, -0.2, -0.4) },
  right: { dir: new THREE.Vector3(0.3, 0.92, -0.25).normalize(), grip: new THREE.Vector3(0.26, -0.22, -0.38) },
  high:  { dir: new THREE.Vector3(-0.96, 0.18, -0.2).normalize(), grip: new THREE.Vector3(0.16, 0.02, -0.34) },
  low:   { dir: new THREE.Vector3(-0.3, -0.62, -0.72).normalize(), grip: new THREE.Vector3(0.1, -0.3, -0.42) },
};
/* How much of each zone's pose an aim (x: -1 left..+1 right, y: -1 below..
   +1 above) takes. Sums to 1. */
export function parryWeights(x, y, out = {}) {
  out.left = Math.max(0, -x); out.right = Math.max(0, x);
  out.high = Math.max(0, y); out.low = Math.max(0, -y);
  const sum = out.left + out.right + out.high + out.low || 1;
  for (const z of PARRY_ZONES) out[z] /= sum;
  return out;
}
/* The strongest zone for an aim: the old one-pose answer, kept for anything
   that only wants a label. */
export function parryZone(side, up) {
  const w = parryWeights(side, up);
  return PARRY_ZONES.reduce((a, b) => (w[b] > w[a] ? b : a));
}

/* One blocker's parries. Beats, from the round's arrival (t = 0):
     0 - 0.05 s   the blade whips from wherever it is to meet the round
     0.05 - 0.16  a wrist flick bats it away: the blade carries on past
                  the intercept the way it was moving (rounds landing on
                  one side in quick succession alternate it forehand/
                  backhand, so a burst reads as the blade flowing, not
                  the same snap)
     0.16 - 0.46  eased back to the guard
   A round that lands mid-parry starts from the blade's current aim, so a
   burst chains instead of popping back to the guard between rounds. */
const PARRY_SNAP = 0.05, PARRY_FLICK = 0.16, PARRY_END = 0.46;
const _ps = { x: 0, y: 0, k: 0, flick: 0 };
export class ParryState {
  constructor() {
    this.x = 0; this.y = 0;     // aim of the current parry
    this.px = 0; this.py = 0;   // aim it started from
    this.pk = 0;                // how far out the blade already was
    this.flip = 1;
    this.side = 1;
    this.t = 9;
  }

  /* A round met the blade from (side, up): the direction to the shooter in
     the blocker's view, unit-ish. */
  start(side, up) {
    const cur = this.sample();
    this.px = cur.x; this.py = cur.y; this.pk = cur.k;
    const chained = this.t < PARRY_END;
    // Spread the view direction out (rounds from the front cluster near
    // the middle), a dead-centre round goes to whichever side the blade
    // isn't on, and every parry wanders a little so a burst from one
    // shooter never lands the same pose twice.
    let x = Math.max(-1, Math.min(1, side * 2.6));
    const y = Math.max(-1, Math.min(1, up * 3));
    if (Math.abs(x) < 0.35 && Math.abs(y) < 0.35) x = chained && this.x !== 0 ? -Math.sign(this.x) * 0.6 : (Math.random() < 0.5 ? -0.6 : 0.6);
    this.x = Math.max(-1, Math.min(1, x + (Math.random() - 0.5) * 0.35));
    this.y = Math.max(-1, Math.min(1, y + (Math.random() - 0.5) * 0.3));
    // Rounds landing on the same side in quick succession alternate the
    // flick forehand/backhand.
    const out = this.x < 0 ? 1 : -1;
    this.flip = chained && out === this.side ? -this.flip : 1;
    this.side = out;
    this.t = 0;
  }

  update(dt) { this.t += dt; }

  /* The pose to show now: aim (x, y), k 0..1 toward the parry pose, and
     flick, -1..1: +1 carries the blade on past the intercept the way it
     moved from the guard, -1 whips it back (the backhand). The returned
     object is shared: copy what you keep. */
  sample() {
    const t = this.t;
    if (!(t >= 0) || t >= PARRY_END) { _ps.x = this.x; _ps.y = this.y; _ps.k = 0; _ps.flick = 0; return _ps; }
    const m = t < PARRY_SNAP ? 1 - (1 - t / PARRY_SNAP) ** 2 : 1;
    _ps.x = this.px + (this.x - this.px) * m;
    _ps.y = this.py + (this.y - this.py) * m;
    const b = t < PARRY_FLICK ? 0 : (t - PARRY_FLICK) / (PARRY_END - PARRY_FLICK);
    _ps.k = (this.pk + (1 - this.pk) * m) * (1 - b * b * (3 - 2 * b));
    let f = 0;
    if (t >= PARRY_SNAP) {
      const up = Math.min(1, (t - PARRY_SNAP) / 0.04);
      const down = t > PARRY_FLICK ? Math.max(0, 1 - (t - PARRY_FLICK) / 0.2) : 1;
      f = up * down * down;
    }
    _ps.flick = f * this.flip;
    return _ps;
  }
}

/* Kept for anything still weighting a parry by time alone. */
export function parryWeight(t) {
  if (!(t >= 0) || t >= PARRY_END) return 0;
  if (t < PARRY_SNAP) return t / PARRY_SNAP;
  if (t < PARRY_FLICK) return 1;
  const k = (t - PARRY_FLICK) / (PARRY_END - PARRY_FLICK);
  return 1 - k * k * (3 - 2 * k);
}
const _pw = {};
const _pGrip = new THREE.Vector3(), _pDir = new THREE.Vector3();
const _chestFwd = new THREE.Vector3(0, 0, 1);
function _saberGuard(rig, k, parry = null) {
  const p = rig.parts, s = rig.scale, w = rig.build;
  const joints = [p.armR, p.elbowR, p.armL, p.elbowL];
  joints.forEach((j, i) => _sgFk[i].copy(j.quaternion));
  // A parry (ParryState.sample(): `{ x, y, k, flick }`) pulls the fists and
  // the blade toward its aimed pose by k, then the flick turns the blade
  // outward about the chest's forward axis.
  const pk = parry ? Math.max(0, Math.min(1, parry.k || 0)) : 0;
  _sgR.copy(SABER_GUARD_GRIP);
  _sgDir.copy(SABER_GUARD_DIR);
  if (pk > 0) {
    parryWeights(parry.x, parry.y, _pw);
    _pGrip.set(0, 0, 0); _pDir.set(0, 0, 0);
    for (const z of PARRY_ZONES) {
      _pGrip.addScaledVector(PARRY[z].grip, _pw[z]);
      _pDir.addScaledVector(PARRY[z].dir, _pw[z]);
    }
    _sgR.lerp(_pGrip, pk);
    _sgDir.lerp(_pDir.normalize(), pk).normalize();
  }
  if (parry?.flick && pk > 0) {
    // Carry on the way the blade turned from the guard (its turn about the
    // chest's forward axis).
    const turn = Math.sign(SABER_GUARD_DIR.x * _pDir.y - SABER_GUARD_DIR.y * _pDir.x) || 1;
    _sgDir.applyAxisAngle(_chestFwd, parry.flick * turn * 0.6).normalize();
  }
  _sgR.set(_sgR.x * s * w, _sgR.y * s, _sgR.z * s);
  _sgL.copy(_sgR).addScaledVector(_sgDir, -SABER_HAND_GAP * s);   // below it, toward the pommel
  _reachArm(rig, p.armR, p.elbowR, rig.armRestR, _gT.copy(_sgR).sub(p.armR.position).sub(p.shoulderR.position), _gPoleR);
  _reachArm(rig, p.armL, p.elbowL, rig.armRestL, _gT.copy(_sgL).sub(p.armL.position).sub(p.shoulderL.position), _gPoleL);
  joints.forEach((j, i) => { _sgQ.copy(j.quaternion); j.quaternion.copy(_sgFk[i]).slerp(_sgQ, k); });
  setHandPose(rig, -1, "fist");

  // The blade: whatever the fist holds (the melee mesh on gripR).
  const held = p.gripR.children.find((c) => c.visible && c.userData.meleeId);
  if (!held) return;
  p.chest.updateWorldMatrix(true, true);
  held.getWorldQuaternion(_sgQ);
  _sgB.set(0, 0, -1).applyQuaternion(_sgQ);
  p.chest.getWorldQuaternion(_sgQ);
  _sgD.copy(_sgDir).applyQuaternion(_sgQ);
  _sgQ2.setFromUnitVectors(_sgB, _sgD);             // world-space turn
  _sgQ2.copy(_sgId).slerp(_sgQ2, k);
  // gripR.local' = parent⁻¹ · turn · parent · gripR.local
  p.gripR.parent.getWorldQuaternion(_sgQ);
  p.gripR.quaternion.premultiply(_sgQ).premultiply(_sgQ2).premultiply(_sgQ.invert());
}

/* Throwing a grenade, laid over whatever pose the rig already has: the free
   (left) arm comes up behind the head and whips over and forward. `t` runs
   0..1 across THROW_TIME seconds. */
export const THROW_TIME = 0.5;
export function poseThrowArm(rig, t) {
  const p = rig.parts;
  const wind = Math.min(1, t / 0.35), whip = Math.max(0, (t - 0.35) / 0.65);
  const raise = 2.9 * wind - 1.9 * whip * (2 - whip);
  const fade = t > 0.8 ? (1 - t) / 0.2 : 1;
  p.armL.rotation.set(p.armL.rotation.x + (raise - p.armL.rotation.x) * fade, 0, 0.25 * fade);
  p.elbowL.rotation.set(0.9 * wind * (1 - whip) * fade, 0, 0);
  rig.body.update();
}
export function poseDance(rig, arg) { beginPose(rig, "dance"); _poseDance(rig, arg); endPose(rig); rig.body.update(); }
export function poseDanceFloss(rig, arg) { beginPose(rig, "floss"); _poseDanceFloss(rig, arg); endPose(rig); rig.body.update(); }
export function poseDanceHeadbang(rig, arg) { beginPose(rig, "headbang"); _poseDanceHeadbang(rig, arg); endPose(rig); rig.body.update(); }
export function poseDanceWave(rig, arg) { beginPose(rig, "wave"); _poseDanceWave(rig, arg); endPose(rig); rig.body.update(); }
export function poseDeath(rig, arg) { rig.poseKind = "death"; rig.xfade = null; _poseDeath(rig, arg); rig.body.update(); }

export const DANCES = [poseDance, poseDanceFloss, poseDanceHeadbang, poseDanceWave];

/* ------------------------------------------------------------ death fall

   Shot dead, a body doesn't pivot flat about the hips — it goes down in
   stages, each driven by gravity rather than a tween:
     1. the hit: the round jerks the torso and whips the head, arms fling;
     2. the buckle: the legs stop holding, knees fold, the hips drop;
     3. the fall: the rest tips over, accelerating (ease-in, like a real
        drop), backward onto the seat and then the back, or forward onto the
        knees and then the chest;
     4. the impact: a small bounce and the limbs settle, the head lolls.
   `t` is 0 (the shot) to 1 (settled, DEATH_TIME seconds later); hold it at
   1 to leave the body lying there. Which way it goes is `rig.deathHint`
   ({ dir: 1 backward | -1 forward }) if the caller knows (shot from the
   front, or running into it), else mostly backward so the face shows. */
export const DEATH_TIME = 1.25;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (v) => { v = clamp01(v); return v * v * (3 - 2 * v); };
const lerp = (a, b, k) => a + (b - a) * k;

function deathState(rig, u) {
  const d = rig.death;
  // A fresh fall: first call, or t went backwards (a new death on this rig).
  if (!d || u < d.u - 0.05) {
    const hint = rig.deathHint;
    rig.deathHint = null;
    rig.death = {
      u,
      dir: hint?.dir ?? (Math.random() < 0.7 ? 1 : -1),
      side: Math.random() < 0.5 ? -1 : 1,
      seed: Math.random(),
    };
    return rig.death;
  }
  d.u = u;
  return d;
}

function _poseDeath(rig, t) {
  const p = rig.parts;
  _resetJoints(rig);
  const u = clamp01(t);
  const st = deathState(rig, u);
  const { dir, side } = st;
  const T = rig.thigh, S = rig.shin, s = rig.scale;
  const lieY = rig.limbRadius * 1.9;

  // Phase weights.
  const hitUp = smooth(u / 0.1);
  const hit = hitUp * (1 - smooth((u - 0.1) / 0.3));            // spike, then gone
  const buckle = smooth((u - 0.05) / 0.33);                      // 0.05 → 0.38
  const fk = clamp01((u - 0.32) / 0.4);                          // 0.32 → 0.72
  const fall = fk * fk;                                          // gravity: slow start, fast end
  const sk = clamp01((u - 0.72) / 0.28);                         // the landing
  const bounce = sk > 0 ? Math.sin(sk * Math.PI * 2.4) * Math.pow(1 - sk, 2) : 0;
  const landed = sk > 0 ? 1 : 0;

  if (dir > 0) {
    // ---- backward: crumple, sit back, then flat on the back.
    // Thighs come up to horizontal as the seat drops; knees fold, then
    // mostly straighten once lying — one stays up a little.
    // Lying, the left leg goes flat and the right stays knee-up with the
    // foot on the ground (thigh past horizontal, shin back down to the floor).
    const aL = buckle * 1.05 + fall * (Math.PI / 2 - 0.04 - 1.05);
    const aR = buckle * 1.0 + fall * (1.95 - 1.0);
    const bL = buckle * 1.8 - fall * 1.7;
    const bR = buckle * 1.6 - fall * 0.45;
    const standY = T * Math.cos(buckle * 1.05) + S * Math.cos(buckle * 1.05 - buckle * 1.8);
    p.hips.position.y = lerp(Math.min(rig.hipY, standY), lieY, fall) + bounce * 0.035 * s;
    p.hips.position.z = (buckle * 0.14 + fall * 0.08) * s;          // the seat lands behind the feet
    p.hips.rotation.x = 0;
    p.hips.rotation.y = side * 0.35 * fall;
    p.hips.rotation.z = side * 0.06 * fall;

    // Jerked back by the round, slumps forward as the legs go, then falls
    // back flat — the last part fastest, then a small rebound off the ground.
    p.torso.rotation.x = hit * 0.4 - buckle * 0.3 * (1 - fall) + fall * (Math.PI / 2 - 0.02) - bounce * 0.1;
    p.torso.rotation.z = side * 0.1 * fall;
    p.chest.rotation.x = hit * 0.2 - buckle * 0.12 * (1 - fall) + bounce * 0.1;

    p.legL.rotation.x = aL;
    p.legR.rotation.x = aR;
    p.legL.rotation.z = -0.28 * fall;
    p.legR.rotation.z = 0.22 * fall;
    p.kneeL.rotation.x = -Math.max(0.1, bL);
    p.kneeR.rotation.x = -Math.max(0.3, bR);
    p.ankleL.rotation.x = 0.6 * fall;
    p.ankleR.rotation.x = -0.25 * fall;

    // Arms fling out with the hit and end splayed on the ground by the head.
    const outL = 0.5 * hit + buckle * 0.35 + fall * 0.95;
    const outR = 0.45 * hit + buckle * 0.3 + fall * 1.15;
    p.armL.rotation.z = -outL;
    p.armR.rotation.z = outR;
    p.armL.rotation.x = -0.35 * hit + fall * 0.35 + bounce * 0.2;
    p.armR.rotation.x = -0.25 * hit + fall * 0.55 - bounce * 0.15;
    p.elbowL.rotation.x = 0.5 * buckle * (1 - fall) + 0.35 * fall + bounce * 0.25;
    p.elbowR.rotation.x = 0.7 * buckle * (1 - fall) + 0.6 * fall - bounce * 0.2;

    // Head whips back on the hit, drops chin-to-chest in the buckle, and
    // rolls to one side once lying.
    p.neckPivot.rotation.x = hit * 0.55 - buckle * 0.35 * (1 - fall) + fall * 0.2 + bounce * 0.35;
    p.headPivot.rotation.x = hit * 0.3 + bounce * 0.2;
    p.headPivot.rotation.z = side * (0.15 * buckle + 0.55 * fall * landed + 0.25 * fall);
  } else {
    // ---- forward: knees buckle to the ground, then the body pitches over
    // them onto the chest, arms trailing.
    const kneelA = buckle * 0.22;
    const kneelB = buckle * 1.7;
    const kneelY = T * Math.cos(kneelA) + S * Math.cos(kneelA - kneelB);
    // Pitch forward about the knees: the hips swing down and ahead of them.
    const phi = fall * (Math.PI / 2);
    const pivotY = lerp(rig.hipY, Math.max(kneelY, T * 0.98), buckle);
    p.hips.position.y = lerp(pivotY, lieY + T * 0.02, fall) + bounce * 0.03 * s;
    p.hips.position.z = -T * Math.sin(phi) * 0.85 + hit * 0.04 * s;
    p.hips.rotation.x = -phi;
    // No yaw twist here: hips rotate X-then-Y-then-Z in their own frame, so
    // once pitched flat a "twist" is really a roll onto one side, which
    // lifted one arm into the air and sank the other into the ground.
    p.hips.rotation.y = 0;
    p.hips.rotation.z = side * 0.03 * fall;

    // The round rocks them back first, then they fold forward and land flat.
    p.torso.rotation.x = hit * 0.3 - buckle * 0.45 * (1 - fall) - fall * 0.05 + bounce * 0.08;
    p.chest.rotation.x = -buckle * 0.2 * (1 - fall) + bounce * 0.08;
    p.torso.rotation.z = side * 0.08 * fall;

    p.legL.rotation.x = kneelA * (1 - fall) + fall * 0.05;
    p.legR.rotation.x = kneelA * 0.8 * (1 - fall) + fall * 0.18;
    p.legL.rotation.z = -0.15 * fall;
    p.legR.rotation.z = 0.2 * fall;
    p.kneeL.rotation.x = -(kneelB * (1 - fall) + fall * 0.15);
    p.kneeR.rotation.x = -(kneelB * 0.9 * (1 - fall) + fall * 0.55);
    p.ankleL.rotation.x = -0.4 * fall;
    p.ankleR.rotation.x = -0.3 * fall;

    // Arms go limp: flung by the hit, dropping as the body tips, then lying
    // along the sides, one bent up by the head.
    // Face down, "forward" (+x) is into the ground: the left arm ends along
    // the side, a touch behind; the right out past the head.
    p.armL.rotation.z = -(0.45 * hit + 0.15 * buckle + 0.3 * fall);
    p.armR.rotation.z = 0.4 * hit + 0.1 * buckle + 0.3 * fall;
    p.armL.rotation.x = -0.3 * hit + buckle * 0.25 * (1 - fall) - fall * 0.08 - bounce * 0.12;
    // Right arm swings on past the ground line to lie out beyond the head
    // (π is straight overhead, along the ground when face down).
    p.armR.rotation.x = -0.2 * hit + buckle * 0.2 + fall * 3.02 + bounce * 0.1;
    p.elbowL.rotation.x = 0.3 * buckle * (1 - fall) + 0.1 * fall + bounce * 0.15;
    p.elbowR.rotation.x = 0.4 * buckle * (1 - fall) + 0.08 * fall - bounce * 0.15;

    p.neckPivot.rotation.x = hit * 0.4 - buckle * 0.3 + fall * 0.55 + bounce * 0.3;
    p.headPivot.rotation.x = hit * 0.2 + fall * 0.25;
    p.headPivot.rotation.z = side * (0.2 * buckle + 0.35 * fall);
  }
}

/* ------------------------------------------------------------ head and neck

   The head is the part people read a figure by, so it gets the most care:
   - it LEADS a turn. aimRig() lets the body follow the aim a beat late while
     the chest, neck and head take up the difference between them — the
     neck first and fastest, the head a moment after — so a turn starts in
     the neck, the eyes get there first, and the shoulders come round after;
   - it looks where the aim is: pitch is shared between neck and head, and a
     remote player's head follows their sent aim, so you can see where
     they're looking;
   - it stays level while the body works under it: the run's forward lean,
     the hip roll and a little of the pelvis bob are taken back out, the way
     a runner's head holds steady over a bouncing body;
   - standing still with nothing to do, it glances around a little and
     settles, instead of staring like a mannequin;
   - hit, it flinches away from the round and springs back (flinchRig).

   All of it is kept subtle, and the idle glances vanish the moment the
   player moves or aims. */

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function headState(rig) {
  return rig.headState || (rig.headState = {
    bodyYaw: null, aimYaw: null,
    neckYaw: 0, headYaw: 0, chestYaw: 0,
    still: 0,                 // seconds the aim has held still
    idle: { yaw: 0, pitch: 0, vy: 0, vp: 0, ty: 0, tp: 0, next: 1 + Math.random() * 2, w: 0 },
    flinch: { yaw: 0, roll: 0, pitch: 0, vy: 0, vr: 0, vp: 0, bp: 0, br: 0, bd: 0, bvp: 0, bvr: 0, bvd: 0 },
  });
}

/* Face the rig toward `aimYaw` (world radians, the game's yaw convention),
   with the body following a little behind the head. Call before
   poseHumanoid in place of setting root.rotation.y. `snap` jumps straight
   there (spawns, teleports). */
const BODY_LAG_MAX = 0.55;    // radians the aim may run ahead of the body
export function aimRig(rig, aimYaw, dt = 0.016, { snap = false, moving = false } = {}) {
  const h = headState(rig);
  if (!Number.isFinite(aimYaw)) return;
  dt = Math.max(0, dt);
  if (h.bodyYaw == null || snap || Math.abs(wrapAngle(aimYaw - (h.aimYaw ?? aimYaw))) > 1.6) {
    h.bodyYaw = aimYaw;
    h.aimYaw = aimYaw;
    h.neckYaw = h.headYaw = h.chestYaw = 0;
  }
  // How long the aim has held still, for the idle glances.
  const turned = Math.abs(wrapAngle(aimYaw - h.aimYaw));
  h.still = turned > 0.002 ? 0 : h.still + dt;
  h.aimYaw = aimYaw;
  // The body swings round after the head; faster on the move, when the hips
  // are already turning with the stride.
  let off = wrapAngle(aimYaw - h.bodyYaw);
  h.bodyYaw += off * Math.min(1, dt * (moving ? 13 : 8));
  off = wrapAngle(aimYaw - h.bodyYaw);
  if (Math.abs(off) > BODY_LAG_MAX) h.bodyYaw = aimYaw - Math.sign(off) * BODY_LAG_MAX;
  rig.root.rotation.y = h.bodyYaw;
}

/* Kick the head (and a little of the chest) away from a round. `dirX`/`dirZ`
   are the round's travel in the rig's own frame (+x its right, -z ahead);
   `strength` 0..1, about 0.5 for a body shot and 1 for a headshot. */
export function flinchRig(rig, dirX, dirZ, strength = 0.6) {
  const f = headState(rig).flinch;
  const k = Math.max(0, Math.min(1.2, strength));
  // Pushed right, the head turns and tips to its right (negative y and z);
  // struck from the front it snaps back, and every hit nods it a little.
  f.vy += -dirX * 7 * k;
  f.vr += -dirX * 5 * k;
  f.vp += (dirZ * 6 - 2.5) * k;
  // ...and the body rocks with it: back from a round in the front, over to
  // the side it's pushed, the knees giving a little.
  f.bvp += dirZ * 3.2 * k;   // + tips an upright joint back
  f.bvr += -dirX * 2.6 * k;
  f.bvd += 4 * k;
}

/* The same, from a round's world-space travel direction. */
export function flinchRigFrom(rig, dir, strength = 0.6) {
  const yaw = rig.root.rotation.y;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  // Rig right is (cos, 0, -sin), rig back (+z) is (sin, 0, cos).
  flinchRig(rig, dir.x * c - dir.z * s, dir.x * s + dir.z * c, strength);
}

function _poseNeckAndHead(rig, { pitch, sway, dt, lead, lean = 0, bob = 0, run = 0, phase = 0, moving = false, busy = false, follow = 0 }) {
  const p = rig.parts;
  const h = headState(rig);
  const step = Math.max(0, Math.min(0.05, dt || 0));

  // --- yaw: the part of the aim the body hasn't caught up to yet, shared
  // down the chain. The neck takes its share fastest, the head slightly
  // after, the chest (which carries the gun) last.
  const off = h.aimYaw == null ? 0 : wrapAngle(h.aimYaw - h.bodyYaw);
  if (step > 0) {
    h.neckYaw += (off * 0.25 - h.neckYaw) * Math.min(1, step * 24);
    h.headYaw += (off * 0.35 - h.headYaw) * Math.min(1, step * 15);
    h.chestYaw += (off * 0.40 - h.chestYaw) * Math.min(1, step * 11);
  }
  // Dances and the like pose without time or aim: no state for them.
  const useState = step > 0;

  // --- idle glances: only once the rig has stood still with its aim held
  // for a moment, and gone the instant either changes.
  const I = h.idle;
  const idleOk = !moving && !busy && !rig.noIdleGlance && h.still > 1.2 && useState;
  if (useState) {
    I.w += ((idleOk ? 1 : 0) - I.w) * Math.min(1, step * (idleOk ? 1.5 : 10));
    I.next -= step;
    if (I.next <= 0) {
      // Mostly small looks either side, sometimes back to centre; a longer
      // hold after a bigger look, like someone actually checking a corner.
      const back = Math.random() < 0.3;
      I.ty = back ? 0 : (Math.random() * 2 - 1) * 0.38;
      I.tp = back ? 0 : (Math.random() * 2 - 1) * 0.1 + 0.02;
      I.next = 1.6 + Math.random() * 2.8 + Math.abs(I.ty) * 3;
    }
    // Slightly under-damped, so each look lands and settles.
    const w = 7, z = 0.62;
    I.vy += (-w * w * (I.yaw - I.ty) - 2 * z * w * I.vy) * step;
    I.vp += (-w * w * (I.pitch - I.tp) - 2 * z * w * I.vp) * step;
    I.yaw += I.vy * step;
    I.pitch += I.vp * step;
  }
  const idleYaw = useState ? I.yaw * I.w : 0, idlePitch = useState ? I.pitch * I.w : 0;

  // --- flinch spring
  const F = h.flinch;
  if (useState) {
    const w = 17, z = 0.42;
    F.vy += (-w * w * F.yaw - 2 * z * w * F.vy) * step;
    F.vr += (-w * w * F.roll - 2 * z * w * F.vr) * step;
    F.vp += (-w * w * F.pitch - 2 * z * w * F.vp) * step;
    F.yaw += F.vy * step; F.roll += F.vr * step; F.pitch += F.vp * step;
  }
  const fy = useState ? F.yaw : 0, fr = useState ? F.roll : 0, fp = useState ? F.pitch : 0;
  const ny = useState ? h.neckYaw : 0, hy = useState ? h.headYaw : 0, cy = useState ? h.chestYaw : 0;

  // --- level head: take back most of the lean, hip roll and bob beneath it.
  const stab = 0.55 + run * 0.3;
  const rollBelow = p.hips.rotation.z + p.torso.rotation.z + p.chest.rotation.z;
  // A small nod against the stride, a quarter-cycle behind the bob, reads
  // as the neck absorbing each footfall.
  const nod = moving ? Math.sin(2 * phase - 0.9) * (0.012 + run * 0.02) : 0;

  p.chest.rotation.y += cy + fy * 0.15;
  p.neckPivot.position.y = -bob * 0.45;
  // How this troll carries its head (gaitStyle), on the move or standing.
  // `follow` is + nodding down (the head is tipped down on -x).
  const carry = useState ? (rig.style?.head || 0) - follow * 0.4 : 0;
  p.neckPivot.rotation.set(
    -pitch * 0.25 + sway * 0.4 - lean * stab * 0.4 + nod * 0.4 + fp * 0.4 + idlePitch * 0.4 + carry,
    ny + idleYaw * 0.4 + fy * 0.4,
    lead * 0.10 - rollBelow * 0.35 + fr * 0.4,
  );
  p.headPivot.rotation.set(
    -pitch * 0.6 + sway - lean * stab * 0.6 + nod * 0.6 + fp * 0.6 + idlePitch * 0.6 - (useState ? follow * 0.6 : 0),
    hy + idleYaw * 0.6 + fy * 0.6,
    lead * 0.05 - rollBelow * 0.45 + fr * 0.6,
  );
}
