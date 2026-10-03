// Troll Forces — the Halo Blade: an energy-sword style melee weapon, built
// to the user's reference shots of the Halo energy sword. Two long plasma
// prongs, widest low down and tapering to needle points with a narrow slot
// between them; their roots wrap the ends of a horizontal hilt bar and hook
// down and back past it; a slot window is cut in each prong; lightning veins
// crackle through the plasma. Recoloured to the user's palette: sky blue at
// the hilt running to bubblegum pink at the points, glowing violet.
//
// Same convention as every melee model (gear.js buildMeleeMesh): the grip at
// the origin, the blades running down -Z, the prongs splitting across X.
// It animates itself (userData.halo: ignite / retract, like the Trollsaber)
// and takes `userData.tick(dt, busy)` from game.js for the held weapon
// so a swing flares it. Energy flows up the prongs constantly (a shader).
//
// No lights: a runtime light makes every lit material recompile (see
// light-pool.js). The luminescence is back-face additive shells behind the
// plasma, and the plasma isn't tone mapped, so the bloom pass picks it up.

import * as THREE from "three";

const SKY = new THREE.Color(0x4cc6ff);
const PINK = new THREE.Color(0xff5fb4);
const CORE = new THREE.Color(0xf4ecff);
const VIOLET = 0x9d5cff;

const BLADE_LEN = 0.92;    // hilt bar to point, metres
const BAR_Z = 0.07;        // the hilt bar sits this far ahead of the grip (-Z)
const T = 0.011;           // plasma slab thickness

const std = (color, rough, metal, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...o });

/* One prong's outline in (u along the blade from the hilt bar, v outward
   from the centre line), read off the reference: a hooked foot below the
   bar, an outer edge that stays wide through the lower third then kinks in
   and runs to the point, and an inner edge that runs straight down beside
   the slot before swinging out round the end of the bar. */
const PRONG = [
  [-0.085, 0.124],   // the hook's point, below and outside the bar
  [-0.02, 0.134], [0.08, 0.13], [0.2, 0.118], [0.3, 0.104],
  [0.33, 0.094],     // the kink where the edge steps in
  [0.45, 0.078], [0.62, 0.056], [0.78, 0.036], [BLADE_LEN, 0.016],   // the point
  [0.7, 0.019], [0.45, 0.02], [0.2, 0.022], [0.1, 0.025],            // the inner edge, beside the slot
  [0.055, 0.04], [0.04, 0.07], [0.034, 0.096],                       // round the end of the bar...
  [-0.03, 0.104], [-0.06, 0.108],                                    // ...and under it to the hook
];
/* The window cut in each prong, a third of the way up. */
const WINDOW = [[0.17, 0.044], [0.26, 0.044], [0.26, 0.052], [0.17, 0.052]];

function prongShape(grow = 0) {
  // A glow shell is the same outline pushed outward from the slot.
  const pt = ([u, v]) => new THREE.Vector2(u * (1 + grow * 0.25) - grow * 0.02, v * (1 + grow * 1.6) + grow * 0.01);
  const s = new THREE.Shape(PRONG.map(pt));
  if (!grow) s.holes.push(new THREE.Path(WINDOW.map(pt)));
  return s;
}

/* Extrude a (u, v) outline into a slab and lay it on the blade axes:
   x = side * v, y = thickness, z = -(BAR_Z + u). */
function slab(shape, depth, side) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: depth * 0.3, bevelSize: 0.0025, bevelSegments: 2, curveSegments: 1 });
  geo.rotateX(Math.PI / 2);
  geo.rotateY(Math.PI / 2);
  geo.translate(0, depth / 2, -BAR_Z);
  if (side < 0) { geo.scale(-1, 1, 1); flipWinding(geo); }
  return geo;
}

/* A mirror (negative scale) turns every triangle inside out; swap two
   corners of each so front and back faces are the right way round again
   (the glow draws back faces only). ExtrudeGeometry isn't indexed. */
function flipWinding(geo) {
  for (const attr of Object.values(geo.attributes)) {
    const a = attr.array, n = attr.itemSize;
    for (let t = 0; t < attr.count; t += 3) {
      for (let k = 0; k < n; k++) {
        const i1 = (t + 1) * n + k, i2 = (t + 2) * n + k;
        const tmp = a[i1]; a[i1] = a[i2]; a[i2] = tmp;
      }
    }
  }
}

/* Sky blue at the hilt to bubblegum pink at the point, pale and hot along
   the slot side and out at the needle tip, where the reference goes white.
   Colours run a little over 1 so the veins can bloom (see veinTexture). */
function paintPlasma(geo) {
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const u = Math.max(0, Math.min(1, (-pos.getZ(i) - BAR_Z) / BLADE_LEN));
    const v = Math.abs(pos.getX(i));
    c.copy(SKY).lerp(PINK, THREE.MathUtils.smoothstep(u, 0.15, 0.8));
    const slotSide = Math.max(0, 1 - (v - 0.016) / 0.035);
    c.lerp(CORE, Math.min(0.6, slotSide * 0.25 + THREE.MathUtils.smoothstep(u, 0.82, 1) * 0.55));
    c.multiplyScalar(1.3);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return geo;
}

/* Lightning veins: a grey base (so the plasma sits just under full colour)
   with brighter forking cracks drawn over it. The extrude's cap UVs are
   the outline's own (u, v) in metres, so the texture repeats per metre. */
let veinTex = null;
function veinTexture() {
  if (veinTex) return veinTex;
  const W = 512, H = 256;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  g.fillStyle = "#b4b4b4";
  g.fillRect(0, 0, W, H);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const bolt = (x, y, ang, len, width, depth) => {
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < len; s++) {
      ang += (rnd() - 0.5) * 1.1;
      x += Math.cos(ang) * 9; y += Math.sin(ang) * 9;
      g.lineTo(x, y);
      if (depth < 2 && rnd() < 0.12) { g.stroke(); bolt(x, y, ang + (rnd() - 0.5) * 2, len * 0.45, width * 0.6, depth + 1); g.lineWidth = width; g.beginPath(); g.moveTo(x, y); }
    }
    g.stroke();
  };
  g.strokeStyle = "#ffffff";
  g.shadowColor = "#ffffff";
  g.shadowBlur = 6;
  g.lineCap = "round";
  for (let i = 0; i < 14; i++) bolt(rnd() * W, rnd() * H, rnd() * Math.PI * 2, 10 + rnd() * 18, 1.4 + rnd() * 1.6, 0);
  veinTex = new THREE.CanvasTexture(cv);
  veinTex.wrapS = veinTex.wrapT = THREE.RepeatWrapping;
  veinTex.repeat.set(2.4, 4.8);
  veinTex.colorSpace = THREE.SRGBColorSpace;
  return veinTex;
}

export function buildHaloBlade({ lit = true } = {}) {
  const g = new THREE.Group();
  g.userData.kind = "halo";

  /* ---- hilt: the grip in the fist, and the sculpted bar across it */
  const silver = std(0xc9c4d8, 0.32, 0.75);
  const dark = std(0x2a2340, 0.5, 0.5);
  const wrap = std(0x161221, 0.85, 0.05);
  const sky = new THREE.MeshBasicMaterial({ color: SKY, toneMapped: false });
  const pink = new THREE.MeshBasicMaterial({ color: PINK, toneMapped: false });

  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.019, 0.13, 10), wrap);
  grip.rotation.x = Math.PI / 2;
  grip.position.z = 0.02;
  g.add(grip);
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), silver);
  pommel.scale.set(1, 0.8, 1.1);
  pommel.position.z = 0.09;
  g.add(pommel);

  // The bar: a ribbed dark core between two bulbous silver ends, and a
  // raised fin in the middle that points up the slot.
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.15, 12), dark);
  bar.rotation.z = Math.PI / 2;
  bar.position.z = -BAR_Z;
  g.add(bar);
  for (let i = -3; i <= 3; i++) {
    if (!i) continue;
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.003, 5, 12), silver);
    rib.rotation.y = Math.PI / 2;
    rib.position.set(i * 0.016, 0, -BAR_Z);
    g.add(rib);
  }
  for (const side of [-1, 1]) {
    const end = new THREE.Mesh(new THREE.SphereGeometry(0.029, 14, 10), silver);
    end.scale.set(1.25, 0.85, 1);
    end.position.set(side * 0.092, 0, -BAR_Z);
    g.add(end);
    // Sky blue on one side, pink on the other, where the plasma is born.
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), side > 0 ? sky : pink);
    gem.position.set(side * 0.092, 0.022, -BAR_Z);
    g.add(gem);
  }
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.07, 4), silver);
  fin.rotation.x = -Math.PI / 2;
  fin.scale.set(1, 0.55, 1);
  fin.position.z = -BAR_Z - 0.035;
  g.add(fin);
  const finGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.008), new THREE.MeshBasicMaterial({ color: VIOLET, toneMapped: false }));
  finGem.position.set(0, 0.012, -BAR_Z - 0.03);
  g.add(finGem);

  /* ---- plasma
     The prongs live in `plasma`, pivoting at the hilt bar: igniting grows
     them out of the bar (z) while they swing apart from the centre line
     (x), the way the sword's blades fold out. */
  const plasma = new THREE.Group();
  plasma.position.z = -BAR_Z;
  g.add(plasma);

  // Energy flowing up the blade, always: two travelling bands of light in
  // the fragment shader, a fast tight one and a slow broad one, plus a surge
  // on ignite and on every swing. `vBladeU` is distance up the blade.
  const flow = { uTime: { value: Math.random() * 10 }, uSurge: { value: 0 } };
  const plasmaMat = new THREE.MeshBasicMaterial({ vertexColors: true, map: veinTexture(), toneMapped: false, side: THREE.DoubleSide });
  plasmaMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = flow.uTime;
    sh.uniforms.uSurge = flow.uSurge;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vBladeU;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>\nvBladeU = -position.z - ${BAR_Z.toFixed(3)};`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vBladeU;\nuniform float uTime;\nuniform float uSurge;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        float fast = pow(0.5 + 0.5 * sin(vBladeU * 34.0 - uTime * 8.0), 10.0);
        float slow = pow(0.5 + 0.5 * sin(vBladeU * 11.0 - uTime * 3.2 + 1.7), 4.0);
        // The surge runs up the blade as a front, not all at once.
        float front = smoothstep(0.0, 0.12, uSurge * 1.1 - vBladeU * 0.9) * uSurge;
        diffuseColor.rgb *= 1.0 + 0.6 * fast + 0.3 * slow + 1.4 * front;`);
  };
  plasmaMat.customProgramCacheKey = () => "halo-plasma-1";

  const glowNear = new THREE.MeshBasicMaterial({
    color: VIOLET, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending,
    depthWrite: false, toneMapped: false, side: THREE.BackSide,
  });
  const glowFar = glowNear.clone();
  glowFar.opacity = 0.18;

  const coreShape = prongShape(0), nearShape = prongShape(0.08), farShape = prongShape(0.2);
  for (const side of [-1, 1]) {
    const core = new THREE.Mesh(paintPlasma(slab(coreShape, T, side)), plasmaMat);
    const near = new THREE.Mesh(slab(nearShape, T * 2.4, side), glowNear);
    const far = new THREE.Mesh(slab(farShape, T * 4.5, side), glowFar);
    near.renderOrder = 2;
    far.renderOrder = 3;
    for (const m of [core, near, far]) { m.position.z = BAR_Z; plasma.add(m); }
  }

  // The emitter: a violet bloom at the bar that flashes as the blades
  // come out and smoulders while they're lit.
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowSprite(), color: 0xc9a2ff, blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false, toneMapped: false, opacity: 0,
  }));
  flash.position.z = -BAR_Z - 0.03;
  flash.scale.setScalar(0.09);   // its resting size, so it doesn't inflate a bounding box
  flash.renderOrder = 6;
  g.add(flash);

  /* ---- power: ignite / retract, self-animating like the Trollsaber's
     (trollsaber.js), so a first-person blade, another player's and a menu
     preview all animate without anyone calling a tick. */
  const power = {
    frac: lit ? 1 : 0, target: lit ? 1 : 0, surge: 0, swing: 0,
    last: performance.now(),
    ignite() { if (this.target < 1) this.surge = 1; this.target = 1; },
    retract() { this.target = 0; },
    snapOff() { this.target = this.frac = 0; },
    flare(amount = 1) { this.surge = Math.max(this.surge, Math.min(1, amount)); },
    get lit() { return this.frac > 0.02; },
  };
  g.userData.halo = power;

  // Driven from the hilt bar's render: it's always drawn, even with the
  // blades fully retracted.
  bar.onBeforeRender = () => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - power.last) / 1000);
    if (dt <= 0) return;
    power.last = now;
    if (power.frac < power.target) power.frac = Math.min(power.target, power.frac + dt / IGNITE_TIME);
    else if (power.frac > power.target) power.frac = Math.max(power.target, power.frac - dt / RETRACT_TIME);
    power.surge = Math.max(0, power.surge - dt * 1.6);
    const f = power.frac;
    // Out with a little overshoot; back in with a quick collapse.
    const grow = power.target > 0 ? easeOutBack(f) : f * f;
    const unfold = power.target > 0 ? THREE.MathUtils.smoothstep(f, 0.15, 0.85) : f;
    plasma.scale.set(0.3 + 0.7 * unfold, 1, Math.max(0.001, grow));
    plasma.visible = f > 0.005;

    flow.uTime.value += dt;
    flow.uSurge.value = Math.max(power.surge, power.swing * 0.5);
    const breathe = 0.5 + 0.5 * Math.sin(flow.uTime.value * 3.1) * Math.sin(flow.uTime.value * 1.7 + 1);
    const flicker = 0.92 + Math.random() * 0.08;
    const on = Math.min(1, f * 1.4);
    glowNear.opacity = (0.36 + breathe * 0.14 + power.swing * 0.3 + power.surge * 0.4) * flicker * on;
    glowFar.opacity = (0.14 + breathe * 0.08 + power.swing * 0.18 + power.surge * 0.25) * flicker * on;
    // The shared vein texture: drifting it moves every blade's veins, which
    // only ever reads as the plasma crawling.
    plasmaMat.map.offset.set(flow.uTime.value * 0.03, flow.uTime.value * 0.05);
    const bloom = Math.sin(Math.PI * Math.min(1, f)) * (power.target > 0 ? 1 : 0.4);
    flash.material.opacity = Math.min(1, 0.22 * on + bloom * 0.9 + power.surge * 0.3);
    flash.scale.setScalar(0.09 + bloom * 0.22 + breathe * 0.015);
    finGem.rotation.z += dt * 1.5;
  };

  // game.js calls this for the held weapon: a swing brightens the blade.
  g.userData.tick = (dt, busy) => {
    power.swing += ((busy ? 1 : 0) - power.swing) * Math.min(1, dt * (busy ? 18 : 5));
  };

  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return g;
}

const IGNITE_TIME = 0.55;
const RETRACT_TIME = 0.22;

function easeOutBack(x) {
  const c1 = 1.4, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/* A soft round glow for the emitter flash. */
let spriteTex = null;
function glowSprite() {
  if (spriteTex) return spriteTex;
  const S = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d");
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  spriteTex = new THREE.CanvasTexture(cv);
  spriteTex.colorSpace = THREE.SRGBColorSpace;
  return spriteTex;
}
