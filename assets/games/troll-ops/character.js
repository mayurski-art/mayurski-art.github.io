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

const DARK = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });

/* The body is drawn in flat ink: no lighting, so there is no highlight or
   shading to show where one limb's tube meets another's — the whole figure
   reads as one line drawn without lifting the pen. Shared by every rig. */
const INK = new THREE.MeshBasicMaterial({ color: 0x050505 });
INK.userData.shared = true;

// Shared by every invisible hit-proxy primitive (see buildHumanoid below).
// Never rendered, just needs to be a real material so raycasting works.
const HIT_PROXY_MAT = new THREE.MeshBasicMaterial({ visible: false });

// One texture load, one material, shared by every head in the game -
// loaded once at module scope rather than per-rig.
const TEXTURE_LOADER = new THREE.TextureLoader();
const TROLLFACE_TEXTURE = TEXTURE_LOADER.load(
  new URL("../../images/wallpaper/trollface%20transparent.png", import.meta.url).href,
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
    this.mesh.onBeforeRender = () => this.update();
    root.add(this.mesh);
    this._inv = new THREE.Matrix4();
    this._t = new THREE.Vector3(); this._n = new THREE.Vector3(); this._b = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
  }

  update() {
    this.root.updateWorldMatrix(true, true);
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
      const pts = chain.map((j) => this.local.get(j));
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
          const ang = (k / RADIAL) * Math.PI * 2;
          const c = Math.cos(ang), sn = Math.sin(ang);
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
    parts.push(extrude(roundedRect(-0.009 * s, -0.042 * s, 0.018 * s, 0.042 * s, 0.009 * s), thumb * 1.2, thumb * 0.03 * s, -0.03 * s));
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
  fist.visible = false;
  open.castShadow = fist.castShadow = true;
  turn.add(open, fist);
  return { group: align, turn, open, fist, pose: "open" };
}

/* "open" or "fist". Cheap to call every frame. */
export function setHandPose(rig, side, pose) {
  const h = side < 0 ? rig.hands.L : rig.hands.R;
  if (h.pose === pose) return;
  h.pose = pose;
  h.open.visible = pose !== "fist";
  h.fist.visible = pose === "fist";
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
export function buildHumanoid(material, { height = 1.8, build = 1, gun = true, face = "grin" } = {}) {
  const s = height / 1.8;
  const w = build;

  const root = new THREE.Group();

  // Hip height is exactly the leg chain's reach, so straight legs put the
  // feet on y = 0 and the head crown sits at `height`.
  const hipY = 0.9 * s;
  const hips = new THREE.Group();
  hips.position.y = hipY;
  root.add(hips);

  const limbRadius = 0.032 * s * w;

  // --- spine. The torso pivots at the hips and CARRIES the chest, so a lean
  // bends the whole upper body as one; the chest used to hang off the hips
  // on its own, and any lean tore the line apart.
  const torso = joint(hips);
  const torsoMid = joint(torso, 0, 0.24 * s, 0);
  const chest = joint(torso, 0, 0.48 * s, 0);

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
  const mkArm = (side) => {
    const pivot = joint(chest);
    const elbow = joint(pivot, side * ARM.x * 0.48, ARM.y * 0.48, 0);
    const hand = joint(elbow, side * ARM.x * 0.52, ARM.y * 0.52, 0);
    return { pivot, elbow, hand };
  };
  const L = mkArm(-1), R = mkArm(1);
  const inkMat = material?.isShaderMaterial ? material : INK;
  const armAngle = Math.atan2(ARM.x, -ARM.y);
  // Big cartoon mitts, the way the figure is drawn — about a third of the
  // head's width across.
  const handScale = 1.55 * s;
  const hands = { L: buildHand(L.hand, -1, handScale, inkMat, -armAngle), R: buildHand(R.hand, 1, handScale, inkMat, armAngle) };
  // What the right fist holds that isn't a gun (a melee weapon): a mount at
  // the hand whose x rotation is the wrist.
  const gripR = joint(R.hand);
  // Two-handed guns ride the chest, not an arm: both hands reach to them
  // (see _gripSupport). One-handed ones (pistols) stay on the right arm.
  const gunMount = joint(chest);

  // --- legs: knee halfway, ankle, and a short toe so the foot reads as a
  // foot. Both legs split from the one point at the bottom of the spine.
  const THIGH = 0.45 * s, SHIN = 0.45 * s - limbRadius;
  // Legs rest splayed a little, so a pose that doesn't place the feet (a
  // dance, the death fall) still draws two legs rather than one line. The
  // foot placement takes the splay back out.
  const mkLeg = (side) => {
    const pivot = joint(hips);
    const splay = joint(pivot);
    splay.rotation.z = side * LEG_SPLAY;
    const knee = joint(splay, 0, -THIGH, 0);
    const ankle = joint(knee, 0, -SHIN, 0);
    const toe = joint(ankle, 0, -0.005 * s, -0.085 * s);
    return { pivot, knee, ankle, toe };
  };
  const LL = mkLeg(-1), LR = mkLeg(1);

  const body = new BodyStroke(root, [
    // neck → spine → hips → left leg, one stroke
    [neckTop, chest, torsoMid, hips, LL.knee, LL.ankle, LL.toe],
    [hips, LR.knee, LR.ankle, LR.toe],
    [chest, L.elbow, L.hand],
    [chest, R.elbow, R.hand],
  ], [neckTop, chest, hips, LL.toe, LR.toe, L.hand, R.hand], limbRadius,
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
  const makeHitProxy = (geo, parent, isHead) => {
    const m = new THREE.Mesh(geo, HIT_PROXY_MAT);
    m.visible = false;
    m.userData.isHitProxy = true;
    if (isHead) m.userData.isHead = true;
    parent.add(m);
    return m;
  };

  // Sized to the board, so a shot that visibly lands on the face is a headshot.
  const hitHead = makeHitProxy(new THREE.SphereGeometry(0.24 * s, 8, 6), headPivot, true);
  hitHead.position.y = headH * 0.5 + 0.03 * s;

  const hitTorso = makeHitProxy(new THREE.CapsuleGeometry(0.16 * s * w, 0.42 * s, 4, 8), torso, false);
  hitTorso.position.y = 0.24 * s;

  const hitHips = makeHitProxy(new THREE.SphereGeometry(0.15 * s * w, 8, 6), hips, false);

  const hitArmL = makeHitProxy(new THREE.CapsuleGeometry(0.075 * s * w, 0.5 * s, 4, 6), L.pivot, false);
  hitArmL.position.set(-0.15 * s * w, -0.31 * s, 0);
  const hitArmR = makeHitProxy(new THREE.CapsuleGeometry(0.075 * s * w, 0.5 * s, 4, 6), R.pivot, false);
  hitArmR.position.set(0.15 * s * w, -0.31 * s, 0);

  // Thigh proxies on the hip pivot, shin proxies on the knee, so a bent leg
  // is still covered where it actually is.
  const hitLegs = [];
  for (const leg of [LL, LR]) {
    const thigh = makeHitProxy(new THREE.CapsuleGeometry(0.08 * s * w, THIGH * 0.8, 4, 6), leg.pivot, false);
    thigh.position.y = -THIGH / 2;
    const shin = makeHitProxy(new THREE.CapsuleGeometry(0.07 * s * w, SHIN * 0.8, 4, 6), leg.knee, false);
    shin.position.y = -SHIN / 2;
    hitLegs.push(thigh, shin);
  }

  const hitboxMeshes = [hitHead, hitTorso, hitHips, hitArmL, hitArmR, ...hitLegs];

  const rig = {
    root,
    parts: {
      hips, torso, chest, neckPivot, headPivot, head,
      armL: L.pivot, armR: R.pivot, elbowL: L.elbow, elbowR: R.elbow,
      legL: LL.pivot, legR: LR.pivot, kneeL: LL.knee, kneeR: LR.knee,
      ankleL: LL.ankle, ankleR: LR.ankle,
      gun: gunMesh, body: body.mesh,
      handL: hands.L.group, handR: hands.R.group, gripR, gunMount,
    },
    hands,
    body,
    hitboxMeshes,
    scale: s,
    hipY,
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
  return rig;
}

/* Straight knees and elbows, level feet, square hips — the neutral the
   dances and the death pose were written against. Walking leaves them bent. */
function _resetJoints(rig) {
  const p = rig.parts;
  p.kneeL.rotation.set(0, 0, 0);
  p.kneeR.rotation.set(0, 0, 0);
  p.ankleL.rotation.set(0, 0, 0);
  p.ankleR.rotation.set(0, 0, 0);
  p.elbowL.rotation.set(0, 0, 0);
  p.elbowR.rotation.set(0, 0, 0);
  p.hips.rotation.y = 0;
  p.chest.rotation.y = 0;
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

   Step length grows with speed and is capped by what the legs can reach;
   the rest of the speed comes from cadence, as it does for people. */
export function gaitStepLength(mps) {
  return Math.max(0.34, Math.min(1.45, 0.34 + 0.16 * mps));
}

/* Radians of `phase` per second at `mps`: one full cycle is two steps. */
export function gaitPhaseRate(mps) {
  if (!(mps > 0.05)) return 0;
  return Math.PI * mps / gaitStepLength(mps);
}

const _hipJoint = new THREE.Vector3();
const _foot = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

/* Point a hip-knee-ankle chain at `target` (root space). Knees bend toward
   the body's front (-Z). */
function _solveLeg(rig, side, pivot, knee, ankle, target, footPitch) {
  const p = rig.parts;
  // Hip joint in root space. Hips only yaw/roll a little while walking.
  _hipJoint.copy(pivot.position).applyEuler(p.hips.rotation).add(p.hips.position);
  _foot.subVectors(target, _hipJoint);
  _q.setFromEuler(p.hips.rotation).invert();
  _foot.applyQuaternion(_q);

  const a = rig.thigh, b = rig.shin;
  const d = Math.min(a + b - 1e-4, Math.max(0.05, _foot.length()));
  const lateral = Math.asin(Math.max(-1, Math.min(1, _foot.x / Math.max(1e-4, _foot.length()))));
  const reach = Math.atan2(-_foot.z, -_foot.y);            // + swings the foot forward
  const atHip = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
  const atKnee = Math.acos(Math.max(-1, Math.min(1, (a * a + b * b - d * d) / (2 * a * b))));

  // The rest splay (a child rotation about the same axis) adds to `lateral`.
  pivot.rotation.set(reach + atHip, 0, lateral - side * LEG_SPLAY);
  knee.rotation.set(-(Math.PI - atKnee), 0, 0);
  // Keep the foot level with the ground, plus whatever pitch the step wants.
  ankle.rotation.set(-(pivot.rotation.x + knee.rotation.x) + footPitch - p.hips.rotation.x, 0, 0);
}

const _smooth = (t) => t * t * (3 - 2 * t);
const LEG_SPLAY = 0.09;

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
  const s = rig.scale;
  // The first-person hands built onto the gun are for the viewmodel; a body
  // holds it in its own mitts.
  mesh.traverse((o) => { if (o.userData.hand) o.visible = false; });
  rig.held = mesh;
  if (mesh.userData.supportHandPos && mesh.userData.gripPos) {
    // Two-handed: placed every frame by _gripSupport.
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);
    rig.parts.gunMount.add(mesh);
    return;
  }
  mesh.position.set(0.30 * s * rig.build, -0.62 * s, 0).addScaledVector(new THREE.Vector3(0, Math.sin(GUN_CARRY), Math.cos(GUN_CARRY)), 0.05 * s);
  mesh.rotation.set(-GUN_CARRY, 0, 0.15);
  rig.parts.armR.add(mesh);
}

/* Pose the rig. `phase` advances with movement (use gaitPhaseRate); `lower`
   is 0..1 how far the body is crouched (1 = prone). `strafe` is -1..1, the
   mover's local sideways velocity; `forward` is -1..1 fore/aft (negative =
   backpedal). `speed` is 0..1 of a 4.2 m/s run; `mps`, when the caller knows
   it, is the real speed and sizes the stride so the feet plant exactly. */
/* `hold`: "gun" (default), "melee" or "none". `swing`: { t: 0..1, kind:
   "swing" | "thrust" } while a melee attack plays. `recoil`: 0..1, the gun's
   current kick. */
function _poseHumanoid(rig, { phase = 0, moving = false, pitch = 0, lower = 0, strafe = 0, forward = 1, speed = 1, mps = null, dt = 0.016, zombie = false, hasGun = false, hold = "gun", swing = null, recoil = 0 }) {
  const p = rig.parts;
  const s = rig.scale;
  const str = Math.max(-1, Math.min(1, strafe));
  const fwd = Math.max(-1, Math.min(1, forward));
  const spd = moving ? Math.max(0.28, Math.min(1, speed)) : 0;
  const v = moving ? (mps ?? (zombie ? 1.3 : spd * 4.2)) : 0;

  // 0 = walk, 1 = run: duty factor, bob, knee lift and lean all follow it.
  const run = Math.max(0, Math.min(1, (v - 1.8) / 2.8));

  // Ease in and out of the cycle, so starting and stopping blend rather
  // than snapping the legs between the gait and the stand.
  const g = rig.gait;
  g.blend += ((moving ? 1 : 0) - g.blend) * Math.min(1, dt * 9);
  const blend = g.blend;

  p.hips.rotation.set(0, 0, 0);
  p.hips.position.x = 0;
  p.hips.position.z = 0;

  const crouch = Math.max(0, Math.min(1, lower));
  const stepLen = gaitStepLength(v || 1) * (zombie ? 0.55 : 1);
  const duty = zombie ? 0.66 : 0.62 - run * 0.28;   // share of the cycle a foot is down
  const lift = (zombie ? 0.05 : 0.09 + run * 0.13) * s;

  // Direction of travel in the rig's local ground plane (+x right, -z ahead).
  let tx = str, tz = -fwd;
  const tl = Math.hypot(tx, tz) || 1;
  tx /= tl; tz /= tl;
  // Side-steps are shorter: legs can't scissor past each other sideways.
  const sideways = Math.abs(tx);
  const stride = stepLen * (1 - sideways * 0.45);

  // Pelvis: sits a little lower the faster you go (bent, springy knees),
  // bobs twice per cycle — low as a foot lands, high over the planted one.
  const cyc = phase;
  const bob = (0.012 + run * 0.02) * s * -Math.cos(2 * cyc) * blend;
  const standY = rig.hipY * (0.985 - crouch * 0.52);
  p.hips.position.y = standY - (run * 0.085 * s + (zombie ? 0.06 * s : 0)) * blend + bob;
  // Hips twist with the stride and roll over the standing leg.
  p.hips.rotation.y = Math.sin(cyc) * (0.07 + run * 0.08) * blend * -tz * (1 - sideways);
  p.hips.rotation.z = Math.cos(cyc) * 0.035 * blend;

  const feet = [];
  for (const [side, legPhase] of [[-1, cyc], [1, cyc + Math.PI]]) {
    let u = (legPhase / (Math.PI * 2)) % 1;
    if (u < 0) u += 1;
    let along, up, pitchFoot;
    if (u < duty) {
      // Planted: slides from ahead to behind at the body's own speed.
      const t = u / duty;
      along = (0.5 - t) * duty * 2 * stride;
      up = 0;
      pitchFoot = 0;
    } else {
      // Swing: peel off behind, arc forward, reach for the next footfall.
      const t = (u - duty) / (1 - duty);
      along = (-0.5 + _smooth(t)) * duty * 2 * stride;
      up = Math.sin(Math.PI * Math.pow(t, 0.8)) * lift;
      pitchFoot = -Math.sin(Math.PI * t) * 0.22 + (t > 0.8 ? (t - 0.8) * 1.2 : 0);
    }
    along *= blend;
    up *= blend;
    pitchFoot *= blend;
    // Feet sit a hand's width apart; a crouch spreads them a little.
    const baseX = side * (0.085 + crouch * 0.06) * s;
    _foot.set(baseX + tx * along, rig.limbRadius + up, tz * along);
    // Crouched feet land a touch behind the hips, prone ones further.
    _foot.z += crouch * 0.12 * s;
    feet.push({ side, along, target: _foot.clone(), pitch: pitchFoot });
  }
  _solveLeg(rig, -1, p.legL, p.kneeL, p.ankleL, feet[0].target, feet[0].pitch);
  _solveLeg(rig, 1, p.legR, p.kneeR, p.ankleR, feet[1].target, feet[1].pitch);
  // -1 = that foot trails behind, 1 = it's out ahead: drives the arms.
  const legSwingL = (feet[0].along / Math.max(1e-3, duty * stride)) * Math.sign(-tz || 1);

  // Lean: into a run, back when backpedalling, banked into a strafe. The
  // chest rides the torso now, so its share adds on top.
  const moveLean = (0.04 + run * 0.16) * blend * (fwd < 0 ? -0.6 : 1) * (1 - sideways * 0.7);
  p.torso.rotation.set(crouch * 0.25 + moveLean * 0.7, 0, str * -0.1 * blend);
  p.chest.rotation.set(crouch * 0.12 + moveLean * 0.3, -p.hips.rotation.y * 1.4, str * -0.06 * blend);
  const lean = p.torso.rotation.x + p.chest.rotation.x;

  if (zombie) {
    // Both arms out front, with a lopsided shamble.
    p.armL.rotation.set(1.5 - lean + Math.sin(phase * 0.5) * 0.12, 0, 0.12);
    p.armR.rotation.set(1.42 - lean + Math.cos(phase * 0.5) * 0.12, 0, -0.18);
    p.elbowL.rotation.set(0.25, 0, 0);
    p.elbowR.rotation.set(0.35, 0, 0);
    setHandPose(rig, -1, "open");
    setHandPose(rig, 1, "open");
    p.torso.rotation.x += 0.12;
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
    p.armR.rotation.set(GUN_CARRY + pitch * 0.32 + carrySwing + kick * 0.18 - lean, 0, -0.15);
    p.elbowR.rotation.set(0, 0, 0);
    p.torso.rotation.x -= kick * 0.05;
  } else if (hold === "melee") {
    const [ax, az, el, wr, twist] = swing ? meleeArm(swing.kind, swing.t) : MELEE_CARRY;
    p.armR.rotation.set(ax + carrySwing - lean, 0, az);
    p.elbowR.rotation.set(el, 0, 0);
    p.gripR.rotation.set(wr, 0, 0);
    p.chest.rotation.y += twist ?? 0;
  } else {
    p.armR.rotation.set(0, 0, -0.06);
    p.elbowR.rotation.set(0.2, 0, 0);
  }
  setHandPose(rig, 1, hold === "none" ? "open" : "fist");
  setHandPose(rig, -1, gunInHands && hasGun ? "fist" : "open");

  if (gunInHands && hasGun) {
    // Support hand on the handguard.
    p.armL.rotation.set(GUN_CARRY - 0.07 + pitch * 0.28 + carrySwing * 0.6 + kick * 0.15 - lean, 0, 0.18);
    p.elbowL.rotation.set(0, 0, 0);
  } else {
    // Free arm: swings against its own leg, from the shoulder, with an elbow
    // that bends more the faster you go — hanging loose at a walk, pumping
    // at ninety degrees in a sprint.
    const swingAmp = (0.35 + run * 0.55) * blend;
    p.armL.rotation.set(-legSwingL * swingAmp - lean * 0.8 - 0.05 - run * 0.25 * blend, 0, 0.06 + run * 0.04);
    p.elbowL.rotation.set(0.2 + (run * 1.1 + Math.max(0, legSwingL) * 0.25) * blend, 0, 0);
  }

  _poseNeckAndHead(rig, { pitch, sway: 0, dt, lead: str * blend, lean, bob, run, phase, moving: blend > 0.3, busy: kick > 0.02 || !!swing });
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
  _poseHumanoid(rig, arg);
  if ((arg.hold ?? "gun") === "gun" && !arg.zombie) _gripSupport(rig, arg);
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
function _gripSupport(rig, { pitch = 0, recoil = 0 } = {}) {
  const mesh = rig.held;
  const p = rig.parts;
  if (!mesh || !mesh.visible || mesh.parent !== p.gunMount) return;
  const s = rig.scale, w = rig.build;
  const kick = Math.max(0, Math.min(1, recoil));
  // Level at the aim, independent of the body's lean (the chest carries it).
  const lean = p.torso.rotation.x + p.chest.rotation.x;
  p.gunMount.rotation.set(pitch * 0.32 + kick * 0.18 - lean, 0, 0);
  // Trigger hand: right of centre, below the neck, forward of the chest.
  _gGrip.set(0.12 * s * w, -0.24 * s, (-0.30 + kick * 0.03) * s);
  _gP.copy(mesh.userData.gripPos).applyEuler(p.gunMount.rotation);
  p.gunMount.position.copy(_gGrip).sub(_gP);

  _gT.copy(_gGrip).sub(p.armR.position);
  _reachArm(rig, p.armR, p.elbowR, rig.armRestR, _gT, _gPoleR);

  // Support hand: along grip → handguard, as far as the left arm reaches.
  _gO.copy(_gGrip).sub(p.armL.position);
  _gT.copy(mesh.userData.supportHandPos).applyEuler(p.gunMount.rotation).add(p.gunMount.position).sub(p.armL.position);
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
export function poseDance(rig, arg) { _poseDance(rig, arg); rig.body.update(); }
export function poseDanceFloss(rig, arg) { _poseDanceFloss(rig, arg); rig.body.update(); }
export function poseDanceHeadbang(rig, arg) { _poseDanceHeadbang(rig, arg); rig.body.update(); }
export function poseDanceWave(rig, arg) { _poseDanceWave(rig, arg); rig.body.update(); }
export function poseDeath(rig, arg) { _poseDeath(rig, arg); rig.body.update(); }

export const DANCES = [poseDance, poseDanceFloss, poseDanceHeadbang, poseDanceWave];

/* Collapse the rig into a fallen heap. `t` is 0 (moment of death) to 1
   (fully down); callers drive it up over ~0.5-0.6s then hide the rig. Tips
   the whole body over sideways onto the ground and folds the limbs rather
   than just freezing the last standing pose or popping out of existence —
   a body that stays upright or vanishes instantly reads as a UI toggle,
   not a kill. */
function _poseDeath(rig, t) {
  const p = rig.parts;
  _resetJoints(rig);
  const k = Math.max(0, Math.min(1, t));
  const ease = 1 - Math.pow(1 - k, 3);

  p.hips.rotation.x = ease * (Math.PI / 2);
  p.hips.rotation.z = 0.35 * ease;
  p.hips.position.y = rig.hipY * (1 - ease * 0.92);

  p.torso.rotation.x = ease * 0.3;
  p.chest.rotation.x = ease * 0.2;

  p.legL.rotation.x = ease * 0.5;
  p.legR.rotation.x = -ease * 0.3;
  p.legL.rotation.z = ease * 0.2;
  p.legR.rotation.z = -ease * 0.15;

  p.armL.rotation.x = 0.2 + ease * 0.9;
  p.armR.rotation.x = 0.2 + ease * 0.7;
  p.armL.rotation.z = ease * 0.4;
  p.armR.rotation.z = -ease * 0.3;

  p.neckPivot.rotation.x = ease * 0.6;
  p.headPivot.rotation.x = ease * 0.4;
  p.headPivot.rotation.z = ease * 0.5;
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
    flinch: { yaw: 0, roll: 0, pitch: 0, vy: 0, vr: 0, vp: 0 },
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
}

/* The same, from a round's world-space travel direction. */
export function flinchRigFrom(rig, dir, strength = 0.6) {
  const yaw = rig.root.rotation.y;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  // Rig right is (cos, 0, -sin), rig back (+z) is (sin, 0, cos).
  flinchRig(rig, dir.x * c - dir.z * s, dir.x * s + dir.z * c, strength);
}

function _poseNeckAndHead(rig, { pitch, sway, dt, lead, lean = 0, bob = 0, run = 0, phase = 0, moving = false, busy = false }) {
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
  const idleOk = !moving && !busy && h.still > 1.2 && useState;
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
  p.neckPivot.rotation.set(
    -pitch * 0.25 + sway * 0.4 - lean * stab * 0.4 + nod * 0.4 + fp * 0.4 + idlePitch * 0.4,
    ny + idleYaw * 0.4 + fy * 0.4,
    lead * 0.10 - rollBelow * 0.35 + fr * 0.4,
  );
  p.headPivot.rotation.set(
    -pitch * 0.6 + sway - lean * stab * 0.6 + nod * 0.6 + fp * 0.6 + idlePitch * 0.6,
    hy + idleYaw * 0.6 + fy * 0.6,
    lead * 0.05 - rollBelow * 0.45 + fr * 0.6,
  );
}
