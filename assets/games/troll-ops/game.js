// Troll Ops — main game module.
import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

import { WEAPON_DEFS, WeaponState, computeDamage } from "./weapons.js";
import { ImpactShader, makeMuzzleFlashMaterial, makeTracerMaterial, makeImpactSparkMaterial, makeGroundMaterial } from "./shaders.js";
import { WaveSpawner } from "./enemies.js";

const els = {
  cabinet: document.getElementById("to-cabinet"),
  loading: document.getElementById("to-loading"),
  title: document.getElementById("to-title"),
  startBtn: document.getElementById("to-start-btn"),
  weaponCards: Array.from(document.querySelectorAll(".to-weapon-card")),
  pause: document.getElementById("to-pause"),
  resumeBtn: document.getElementById("to-resume-btn"),
  quitBtn: document.getElementById("to-quit-btn"),
  gameover: document.getElementById("to-gameover"),
  goTitle: document.getElementById("to-go-title"),
  goWave: document.getElementById("to-go-wave"),
  goKills: document.getElementById("to-go-kills"),
  goTime: document.getElementById("to-go-time"),
  retryBtn: document.getElementById("to-retry-btn"),
  hud: document.getElementById("to-hud"),
  hudWave: document.getElementById("hud-wave"),
  hudHostiles: document.getElementById("hud-hostiles"),
  hudKills: document.getElementById("hud-kills"),
  waveBanner: document.getElementById("hud-wave-banner"),
  crosshair: document.getElementById("to-crosshair"),
  hitmarker: document.getElementById("to-hitmarker"),
  hitflash: document.getElementById("to-hitflash"),
  lowhp: document.getElementById("to-lowhp"),
  hpFill: document.getElementById("hud-hp-fill"),
  hpText: document.getElementById("hud-hp-text"),
  ammoCur: document.getElementById("hud-ammo-cur"),
  ammoRes: document.getElementById("hud-ammo-res"),
  reloadTag: document.getElementById("hud-reload-tag"),
  killfeed: document.getElementById("to-killfeed"),
  touch: document.getElementById("to-touch"),
  touchMove: document.getElementById("to-touch-move"),
  touchMoveNub: document.querySelector(".to-touch-stick-nub"),
  touchLook: document.getElementById("to-touch-look"),
  touchFire: document.getElementById("to-touch-fire"),
  touchAds: document.getElementById("to-touch-ads"),
  touchJump: document.getElementById("to-touch-jump"),
  touchReload: document.getElementById("to-touch-reload"),
};

const isTouch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
if (isTouch) { els.touch.hidden = false; }

let selectedWeaponId = null;
els.weaponCards.forEach((card) => {
  card.addEventListener("click", () => {
    els.weaponCards.forEach((c) => c.classList.remove("is-active"));
    card.classList.add("is-active");
    selectedWeaponId = card.dataset.weapon;
    els.startBtn.disabled = false;
  });
});

// -------------------- renderer / scene --------------------

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.5;
els.cabinet.appendChild(renderer.domElement);
renderer.domElement.style.position = "absolute";
renderer.domElement.style.inset = "0";
renderer.domElement.style.zIndex = "1";

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x3a4a38, 0.01);

const skyMat = new THREE.ShaderMaterial({
  uniforms: {
    uTop: { value: new THREE.Color(0x1a2e4a) },
    uHorizon: { value: new THREE.Color(0x6b8a5e) },
    uBottom: { value: new THREE.Color(0x2a3324) },
  },
  vertexShader: /* glsl */`
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform vec3 uTop;
    uniform vec3 uHorizon;
    uniform vec3 uBottom;
    varying vec3 vDir;
    void main() {
      float h = vDir.y;
      vec3 color = h > 0.0
        ? mix(uHorizon, uTop, smoothstep(0.0, 0.6, h))
        : mix(uHorizon, uBottom, smoothstep(0.0, -0.3, h));
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  side: THREE.BackSide,
  fog: false,
  depthWrite: false,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(250, 24, 16), skyMat);
scene.add(sky);

const camera = new THREE.PerspectiveCamera(78, 16 / 9, 0.05, 300);
const baseFov = 78;

// Lighting
const hemi = new THREE.HemisphereLight(0xb9d4ff, 0x39432c, 1.1);
scene.add(hemi);
const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
sun.position.set(30, 45, -20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
sun.shadow.camera.far = 120;
sun.shadow.bias = -0.0015;
scene.add(sun);
scene.add(sun.target);

// -------------------- arena --------------------

const ARENA = { minX: -30, maxX: 30, minZ: -30, maxZ: 30 };

const ground = new THREE.Mesh(new THREE.PlaneGeometry(64, 64, 1, 1), makeGroundMaterial());
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const colliders = []; // { min: Vector3, max: Vector3 }

function addCrate(x, z, w, d, h, color = 0x5c6b4a) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  colliders.push({
    min: new THREE.Vector3(x - w / 2, 0, z - d / 2),
    max: new THREE.Vector3(x + w / 2, h, z + d / 2),
  });
}

function addWallRing() {
  const t = 1.2, h = 5, s = 30;
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a4530, roughness: 0.9 });
  const walls = [
    [0, s, s * 2 + t * 2, t],
    [0, -s, s * 2 + t * 2, t],
    [s, 0, t, s * 2],
    [-s, 0, t, s * 2],
  ];
  for (const [x, z, w, d] of walls) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    mesh.position.set(x, h / 2, z);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    scene.add(mesh);
    colliders.push({
      min: new THREE.Vector3(x - w / 2, 0, z - d / 2),
      max: new THREE.Vector3(x + w / 2, h, z + d / 2),
    });
  }
}
addWallRing();

// scattered cover crates
const crateLayout = [
  [10, 6, 3, 3, 1.6], [-8, -10, 4, 2.5, 1.4], [4, -14, 2.5, 2.5, 2.2],
  [-14, 4, 3, 3, 1.4], [16, -8, 2.5, 4, 1.8], [-4, 16, 4, 2.5, 1.6],
  [6, -3, 3, 3, 1.2], [-18, -18, 3, 3, 2.0], [18, 16, 3.5, 3, 1.5],
];
for (const [x, z, w, d, h] of crateLayout) addCrate(x, z, w, d, h);

// floodlight poles around the arena perimeter for a lit night-arena feel
function addFloodlight(x, z) {
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2e26, roughness: 0.6, metalness: 0.4 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 9, 8), poleMat);
  pole.position.set(x, 4.5, z);
  pole.castShadow = true;
  pole.userData.noBulletCollide = true;
  scene.add(pole);

  const headMat = new THREE.MeshStandardMaterial({ color: 0x15170f, roughness: 0.5, metalness: 0.5 });
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.6), headMat);
  head.position.set(x, 9, z);
  head.lookAt(0, 0, 0);
  head.userData.noBulletCollide = true;
  scene.add(head);

  const lensMat = new THREE.MeshBasicMaterial({ color: 0xfff0c0 });
  const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.35), lensMat);
  lens.position.copy(head.position);
  const toCenter = new THREE.Vector3(0, 0, 0).sub(head.position).normalize();
  lens.position.addScaledVector(toCenter, 0.32);
  lens.lookAt(0, 3, 0);
  lens.userData.noBulletCollide = true;
  scene.add(lens);

  const spot = new THREE.SpotLight(0xfff0c0, 60, 45, Math.PI / 5, 0.5, 1.2);
  spot.position.copy(head.position);
  spot.target.position.set(0, 0, 0);
  scene.add(spot, spot.target);
}
addFloodlight(-26, -26);
addFloodlight(26, -26);
addFloodlight(-26, 26);
addFloodlight(26, 26);

const spawnPoints = [
  new THREE.Vector3(-27, 0, -27), new THREE.Vector3(27, 0, -27),
  new THREE.Vector3(-27, 0, 27), new THREE.Vector3(27, 0, 27),
  new THREE.Vector3(0, 0, -27), new THREE.Vector3(0, 0, 27),
  new THREE.Vector3(-27, 0, 0), new THREE.Vector3(27, 0, 0),
];

// -------------------- postprocessing --------------------

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.5, 0.82);
composer.addPass(bloom);
const impactPass = new ShaderPass(ImpactShader);
composer.addPass(impactPass);
composer.addPass(new OutputPass());

// -------------------- weapon view models --------------------
// Rendered in a separate scene/camera overlay so the tiny gun mesh never
// suffers near-plane distortion or scale mismatch with the world FOV.

const weaponScene = new THREE.Scene();
const weaponCamera = new THREE.PerspectiveCamera(58, 16 / 9, 0.01, 10);
const weaponRig = new THREE.Group();
weaponScene.add(weaponRig);

const weaponKeyLight = new THREE.DirectionalLight(0xfff2d8, 3.2);
weaponKeyLight.position.set(0.5, 1.2, 1);
weaponScene.add(weaponKeyLight);
const weaponRimLight = new THREE.DirectionalLight(0x8fb0ff, 1.8);
weaponRimLight.position.set(-0.6, 0.4, -1);
weaponScene.add(weaponRimLight);
const weaponFillLight = new THREE.AmbientLight(0xaab8ff, 1.1);
weaponScene.add(weaponFillLight);

scene.add(camera);

function buildWeaponMesh(def) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a4f48, roughness: 0.4, metalness: 0.7 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a2c28, roughness: 0.55, metalness: 0.5 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x6b7a5e, roughness: 0.4, metalness: 0.6 });

  let bodyLen = 0.5, bodyH = 0.07, bodyW = 0.06;
  if (def.id === "shotgun") { bodyLen = 0.62; bodyH = 0.08; bodyW = 0.07; }
  if (def.id === "marksman") { bodyLen = 0.78; bodyH = 0.065; bodyW = 0.055; }

  // receiver (main body), sits roughly centered in view
  const body = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, bodyLen * 0.55), bodyMat);
  body.position.z = -bodyLen * 0.12;
  group.add(body);

  // barrel shroud extends forward
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, bodyLen * 0.5, 10), darkMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, bodyH * 0.1, -bodyLen * 0.62);
  group.add(barrel);

  // stock extends backward
  const stock = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.7, bodyH * 0.75, bodyLen * 0.32), darkMat);
  stock.position.set(0, -bodyH * 0.05, bodyLen * 0.28);
  group.add(stock);

  // pistol grip, hangs below receiver
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.15, 0.055), darkMat);
  grip.position.set(0, -bodyH * 1.3, bodyLen * 0.02);
  grip.rotation.x = 0.32;
  group.add(grip);

  // magazine, hangs below receiver forward of grip
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.19, 0.06), darkMat);
  mag.position.set(0, -bodyH * 1.6, -bodyLen * 0.14);
  mag.rotation.x = -0.12;
  group.add(mag);

  // handguard accent strip
  const handguard = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 1.05, bodyH * 0.55, bodyLen * 0.32), accentMat);
  handguard.position.set(0, -bodyH * 0.05, -bodyLen * 0.4);
  group.add(handguard);

  // sight
  let sight;
  if (def.sight === "reddot") {
    sight = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 6, 16), darkMat);
    const mount = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.03), darkMat);
    mount.position.y = -0.015;
    sight.add(ring, mount);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xff2222, side: THREE.DoubleSide, depthTest: false });
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.005, 10), dotMat);
    dot.position.z = 0.003;
    dot.renderOrder = 10;
    sight.add(dot);
    sight.position.set(0, bodyH * 0.75, -bodyLen * 0.35);
    group.userData.aimPoint = new THREE.Vector3(0, bodyH * 0.75, -bodyLen * 0.35);
  } else {
    sight = new THREE.Group();
    const rear = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.02, 0.01), darkMat);
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.022, 0.006), darkMat);
    rear.position.set(0, bodyH * 0.7, -bodyLen * 0.15);
    front.position.set(0, bodyH * 0.7, -bodyLen * 0.85);
    sight.add(rear, front);
    group.userData.aimPoint = new THREE.Vector3(0, bodyH * 0.7, -bodyLen * 0.15);
  }
  group.add(sight);
  group.userData.sight = sight;

  group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return group;
}

const weaponMeshes = {};
for (const id of Object.keys(WEAPON_DEFS)) {
  const m = buildWeaponMesh(WEAPON_DEFS[id]);
  m.visible = false;
  weaponRig.add(m);
  weaponMeshes[id] = m;
}

// muzzle flash sprite
const muzzleMat = makeMuzzleFlashMaterial();
const muzzleFlash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), muzzleMat);
muzzleFlash.rotation.z = Math.random() * Math.PI;
weaponRig.add(muzzleFlash);
let muzzleFlashT = 0;

// muzzle point light for dynamic illumination on each shot
const muzzleLight = new THREE.PointLight(0xffcf8a, 0, 4, 2);
weaponRig.add(muzzleLight);

// -------------------- tracers / impact sparks pools --------------------

const tracerPool = [];
function spawnTracer(from, to, color) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  const geo = new THREE.PlaneGeometry(0.02, len);
  const mat = makeTracerMaterial(color);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(from).addScaledVector(dir, 0.5);
  mesh.lookAt(to);
  mesh.rotateX(Math.PI / 2);
  scene.add(mesh);
  tracerPool.push({ mesh, life: 0.06, maxLife: 0.06 });
}

function updateTracers(dt) {
  for (let i = tracerPool.length - 1; i >= 0; i--) {
    const t = tracerPool[i];
    t.life -= dt;
    t.mesh.material.uniforms.uOpacity.value = Math.max(0, t.life / t.maxLife);
    if (t.life <= 0) {
      scene.remove(t.mesh);
      t.mesh.geometry.dispose();
      t.mesh.material.dispose();
      tracerPool.splice(i, 1);
    }
  }
}

const sparkGeo = new THREE.BufferGeometry();
const SPARK_MAX = 400;
const sparkPositions = new Float32Array(SPARK_MAX * 3);
const sparkLife = new Float32Array(SPARK_MAX);
sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
sparkGeo.setAttribute("aLife", new THREE.BufferAttribute(sparkLife, 1));
const sparkMat = makeImpactSparkMaterial();
const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
sparkPoints.frustumCulled = false;
scene.add(sparkPoints);

const sparks = []; // {idx, vel, life, maxLife}
let sparkCursor = 0;
function spawnImpactBurst(pos, color, count = 10) {
  sparkMat.uniforms.uColor.value.set(color);
  for (let i = 0; i < count; i++) {
    const idx = sparkCursor % SPARK_MAX;
    sparkCursor++;
    const vel = new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3 + 1, (Math.random() - 0.5) * 4);
    sparks[idx] = { pos: pos.clone(), vel, life: 0.4, maxLife: 0.4 };
  }
}

function updateSparks(dt) {
  for (let i = 0; i < SPARK_MAX; i++) {
    const s = sparks[i];
    if (!s) { sparkPositions[i * 3 + 1] = -1000; sparkLife[i] = 0; continue; }
    s.life -= dt;
    if (s.life <= 0) { sparks[i] = null; sparkPositions[i * 3 + 1] = -1000; sparkLife[i] = 0; continue; }
    s.vel.y -= 9.8 * dt;
    s.pos.addScaledVector(s.vel, dt);
    sparkPositions[i * 3] = s.pos.x;
    sparkPositions[i * 3 + 1] = s.pos.y;
    sparkPositions[i * 3 + 2] = s.pos.z;
    sparkLife[i] = s.life / s.maxLife;
  }
  sparkGeo.attributes.position.needsUpdate = true;
  sparkGeo.attributes.aLife.needsUpdate = true;
}

// -------------------- player state --------------------

const player = {
  pos: new THREE.Vector3(0, 1.7, 8),
  velocity: new THREE.Vector3(),
  hp: 100,
  maxHp: 100,
  grounded: true,
  jumping: false,
  sprinting: false,
  weaponId: "smg",
  weapons: {},
  kills: 0,
  wave: 0,
  startTime: 0,
  alive: true,
};
for (const id of Object.keys(WEAPON_DEFS)) player.weapons[id] = new WeaponState(id);

const EYE_HEIGHT = 1.7;
const CROUCH_HEIGHT = 1.1;
const PLAYER_RADIUS = 0.35;
const GRAVITY = 22;
const JUMP_SPEED = 7.2;
const WALK_SPEED = 5.2;

const controls = new PointerLockControls(camera, renderer.domElement);
camera.position.copy(player.pos);

let spawner = null;

const keys = new Set();
window.addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (e.code === "KeyR") tryReload();
  if (e.code === "Escape") { /* handled by pointerlock change */ }
});
window.addEventListener("keyup", (e) => keys.delete(e.code));

let mouseDown = false, adsHeld = false;
renderer.domElement.addEventListener("mousedown", (e) => {
  if (!controls.isLocked) return;
  if (e.button === 0) mouseDown = true;
  if (e.button === 2) adsHeld = true;
});
window.addEventListener("mouseup", (e) => {
  if (e.button === 0) mouseDown = false;
  if (e.button === 2) adsHeld = false;
});
renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());

// -------------------- touch controls --------------------

const touchState = { moveX: 0, moveY: 0, lookDX: 0, lookDY: 0, firing: false, ads: false, jump: false };

function bindStick(el, nub) {
  let active = false, startX = 0, startY = 0, id = null;
  el.addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0];
    active = true; id = t.identifier; startX = t.clientX; startY = t.clientY;
  }, { passive: true });
  el.addEventListener("touchmove", (e) => {
    if (!active) return;
    for (const t of e.changedTouches) {
      if (t.identifier !== id) continue;
      let dx = t.clientX - startX, dy = t.clientY - startY;
      const max = 40;
      dx = Math.max(-max, Math.min(max, dx));
      dy = Math.max(-max, Math.min(max, dy));
      touchState.moveX = dx / max;
      touchState.moveY = dy / max;
      if (nub) nub.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }
  }, { passive: true });
  const end = (e) => {
    for (const t of e.changedTouches) if (t.identifier === id) { active = false; touchState.moveX = 0; touchState.moveY = 0; if (nub) nub.style.transform = "translate(-50%,-50%)"; }
  };
  el.addEventListener("touchend", end);
  el.addEventListener("touchcancel", end);
}
bindStick(els.touchMove, els.touchMoveNub);

(function bindLook() {
  let id = null, lastX = 0, lastY = 0;
  els.touchLook.addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0];
    id = t.identifier; lastX = t.clientX; lastY = t.clientY;
  }, { passive: true });
  els.touchLook.addEventListener("touchmove", (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== id) continue;
      touchState.lookDX += (t.clientX - lastX) * 0.0028;
      touchState.lookDY += (t.clientY - lastY) * 0.0028;
      lastX = t.clientX; lastY = t.clientY;
    }
  }, { passive: true });
  const end = (e) => { for (const t of e.changedTouches) if (t.identifier === id) id = null; };
  els.touchLook.addEventListener("touchend", end);
  els.touchLook.addEventListener("touchcancel", end);
})();

function bindHold(el, onDown, onUp) {
  el.addEventListener("touchstart", (e) => { e.preventDefault(); onDown(); }, { passive: false });
  el.addEventListener("touchend", (e) => { e.preventDefault(); onUp(); });
  el.addEventListener("touchcancel", () => onUp());
}
bindHold(els.touchFire, () => touchState.firing = true, () => touchState.firing = false);
bindHold(els.touchAds, () => touchState.ads = true, () => touchState.ads = false);
bindHold(els.touchJump, () => touchState.jump = true, () => touchState.jump = false);
els.touchReload.addEventListener("touchstart", (e) => { e.preventDefault(); tryReload(); });

// -------------------- HUD helpers --------------------

function pushKillfeed(text) {
  const div = document.createElement("div");
  div.className = "to-kf-item";
  div.textContent = text;
  els.killfeed.appendChild(div);
  setTimeout(() => div.remove(), 2700);
}

function showHitmarker(isCrit) {
  els.hitmarker.classList.remove("pop");
  els.hitmarker.classList.toggle("is-crit", isCrit);
  void els.hitmarker.offsetWidth;
  els.hitmarker.classList.add("pop");
}

let hitFlashT = 0;
function flashHit() {
  hitFlashT = 1;
}

function showWaveBanner(text, ms = 1800) {
  els.waveBanner.textContent = text;
  els.waveBanner.classList.add("is-visible");
  clearTimeout(showWaveBanner._t);
  showWaveBanner._t = setTimeout(() => els.waveBanner.classList.remove("is-visible"), ms);
}

// -------------------- weapon actions --------------------

function currentWeapon() { return player.weapons[player.weaponId]; }

function tryReload() {
  if (!controls.isLocked && !isTouch) return;
  currentWeapon().startReload();
}

function fireOnce() {
  const w = currentWeapon();
  const def = w.def;
  if (!w.canFire()) {
    if (w.ammoInMag <= 0 && !w.reloading) tryReload();
    return;
  }
  w.fire();
  muzzleFlashT = 0.045;
  muzzleLight.intensity = 3.2;

  const pellets = def.pellets || 1;
  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);

  for (let i = 0; i < pellets; i++) {
    const spread = def.pelletSpread ? def.pelletSpread : w.spread;
    const dir = forward.clone();
    const spreadAngleX = (Math.random() - 0.5) * spread;
    const spreadAngleY = (Math.random() - 0.5) * spread;
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), spreadAngleX);
    dir.applyAxisAngle(new THREE.Vector3(1, 0, 0), spreadAngleY);

    const raycaster = new THREE.Raycaster(origin, dir, 0.1, 120);
    const hittable = [];
    for (const g of spawner.grunts) if (g.alive && !g.dying) hittable.push(g.mesh);
    const worldHits = raycaster.intersectObjects([...hittable, ...sceneColliderMeshes], true);

    let endPoint = origin.clone().addScaledVector(dir, 80);
    if (worldHits.length) {
      const hit = worldHits[0];
      endPoint = hit.point;
      const grunt = findGruntFromObject(hit.object);
      if (grunt) {
        const isHead = !!hit.object.userData.isHead || hit.object.parent?.userData?.isHead;
        const dist = origin.distanceTo(hit.point);
        const dmg = computeDamage(def, dist, isHead);
        const knockDir = dir.clone(); knockDir.y = 0; knockDir.normalize();
        const result = grunt.takeDamage(dmg, isHead, knockDir);
        showHitmarker(isHead);
        spawnImpactBurst(hit.point, isHead ? 0xffe27a : 0xff8a5a, isHead ? 16 : 8);
        if (result.killed) {
          player.kills++;
          els.hudKills.textContent = String(player.kills);
          pushKillfeed(`${isHead ? "Headshot — " : ""}Grunt down`);
        }
      } else {
        spawnImpactBurst(hit.point, 0xbfc4b8, 6);
      }
    }
    if (i < 3) spawnTracer(origin.clone().addScaledVector(forward, 0.3), endPoint, 0xfff2c0);
  }
}

function findGruntFromObject(obj) {
  let o = obj;
  while (o) {
    if (o.userData && o.userData.dissolveMat) {
      const grunt = spawner.grunts.find((g) => g.mesh === o);
      if (grunt) return grunt;
    }
    o = o.parent;
  }
  return null;
}

let sceneColliderMeshes = [];
function isPartOfGrunt(o) {
  let cur = o;
  while (cur) {
    if (cur.userData?.dissolveMat) return true;
    cur = cur.parent;
  }
  return false;
}

function rebuildColliderMeshCache() {
  sceneColliderMeshes = [];
  scene.traverse((o) => {
    if (!o.isMesh || o === ground || o === sky || o.userData.noBulletCollide) return;
    if (isPartOfGrunt(o)) return;
    sceneColliderMeshes.push(o);
  });
}

// -------------------- collision helpers --------------------

function resolveCollisions(pos, radius) {
  for (const c of colliders) {
    const closestX = Math.max(c.min.x, Math.min(pos.x, c.max.x));
    const closestZ = Math.max(c.min.z, Math.min(pos.z, c.max.z));
    const dx = pos.x - closestX, dz = pos.z - closestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius && distSq > 1e-6) {
      const dist = Math.sqrt(distSq);
      const push = (radius - dist);
      pos.x += (dx / dist) * push;
      pos.z += (dz / dist) * push;
    } else if (distSq <= 1e-6) {
      pos.x += radius;
    }
  }
  pos.x = Math.max(ARENA.minX + radius, Math.min(ARENA.maxX - radius, pos.x));
  pos.z = Math.max(ARENA.minZ + radius, Math.min(ARENA.maxZ - radius, pos.z));
}

// -------------------- game flow --------------------

let gameState = "menu"; // menu | playing | paused | gameover
let elapsedRun = 0;

function startGame() {
  player.hp = player.maxHp;
  player.kills = 0;
  player.wave = 0;
  player.pos.set(0, EYE_HEIGHT, 8);
  player.velocity.set(0, 0, 0);
  player.alive = true;
  elapsedRun = 0;
  for (const id of Object.keys(WEAPON_DEFS)) player.weapons[id] = new WeaponState(id);
  player.weaponId = selectedWeaponId || "smg";

  if (spawner) {
    for (const g of spawner.grunts) g.dispose(scene);
  }
  spawner = new WaveSpawner(scene, ARENA, spawnPoints);
  rebuildColliderMeshCache();

  for (const id of Object.keys(weaponMeshes)) weaponMeshes[id].visible = id === player.weaponId;

  els.title.hidden = true;
  els.gameover.hidden = true;
  els.pause.hidden = true;
  els.hud.hidden = false;
  gameState = "playing";

  nextWave();

  if (!isTouch) controls.lock();
}

function nextWave() {
  player.wave++;
  els.hudWave.textContent = String(player.wave);
  showWaveBanner(`WAVE ${player.wave}`);
  spawner.startWave(player.wave);
}

function endGame(reason) {
  gameState = "gameover";
  player.alive = false;
  if (controls.isLocked) controls.unlock();
  els.hud.hidden = true;
  els.gameover.hidden = false;
  els.goTitle.textContent = reason === "quit" ? "Extracted" : "You went down";
  els.goWave.textContent = String(player.wave);
  els.goKills.textContent = String(player.kills);
  const mins = Math.floor(elapsedRun / 60), secs = Math.floor(elapsedRun % 60);
  els.goTime.textContent = `${mins}:${String(secs).padStart(2, "0")}`;

  const score = player.wave * 10000 + player.kills * 10;
  window.TrollLeaderboard?.report?.("troll-ops", { score, wave: player.wave, kills: player.kills });
}

els.startBtn.addEventListener("click", startGame);
els.retryBtn.addEventListener("click", startGame);
els.resumeBtn.addEventListener("click", () => { if (!isTouch) controls.lock(); });
els.quitBtn.addEventListener("click", () => { gameState = "menu"; els.pause.hidden = true; els.hud.hidden = true; els.title.hidden = false; });

controls.addEventListener("lock", () => { if (gameState === "paused") gameState = "playing"; els.pause.hidden = true; });
controls.addEventListener("unlock", () => {
  if (gameState === "playing") { gameState = "paused"; els.pause.hidden = false; }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && gameState === "playing") { gameState = "paused"; els.pause.hidden = false; }
});

// -------------------- damage to player --------------------

function damagePlayer(amount) {
  if (!player.alive) return;
  player.hp = Math.max(0, player.hp - amount);
  flashHit();
  if (player.hp <= 0) endGame("dead");
}

function onGruntAttack(grunt, dmg, ranged) {
  if (ranged) {
    const dist = grunt.mesh.position.distanceTo(player.pos);
    if (dist < 14) damagePlayer(dmg * 0.8);
  } else {
    damagePlayer(dmg);
  }
}

// -------------------- main loop --------------------

const clock = new THREE.Clock();

function resize() {
  const w = els.cabinet.clientWidth, h = els.cabinet.clientHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  weaponCamera.aspect = w / h;
  weaponCamera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;

  if (gameState === "playing") {
    elapsedRun += dt;
    updatePlayer(dt);
    updateWeaponView(dt);

    spawner.update(dt, player.pos, onGruntAttack);
    els.hudHostiles.textContent = String(spawner.aliveCount + spawner.toSpawn);

    if (spawner.isWaveClear()) nextWave();

    updateTracers(dt);
    updateSparks(dt);

    // HUD updates
    const w = currentWeapon();
    els.hpFill.style.width = `${(player.hp / player.maxHp) * 100}%`;
    els.hpFill.classList.toggle("is-low", player.hp < 30);
    els.hpText.textContent = Math.ceil(player.hp);
    els.ammoCur.textContent = w.ammoInMag;
    els.ammoRes.textContent = w.ammoReserve;
    els.reloadTag.hidden = !w.reloading;
    els.crosshair.classList.toggle("is-ads", w.ads);
    els.lowhp.classList.toggle("is-low", player.hp < 25);

    hitFlashT = Math.max(0, hitFlashT - dt * 4);
    els.hitflash.classList.toggle("is-hit", hitFlashT > 0.05);
    impactPass.uniforms.uHitFlash.value = hitFlashT;
    impactPass.uniforms.uLowHp.value = player.hp < 25 ? 1 : 0;
    impactPass.uniforms.uAberration.value = Math.min(1, w.viewKickKnockback * 6);
    impactPass.uniforms.uTime.value = t;

    // fov kick based on sprint/ads
    const def = w.def;
    let targetFov = baseFov;
    if (w.ads) targetFov = baseFov * def.adsFovMult;
    if (player.sprinting && !w.ads) targetFov = baseFov * 1.06;
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 10);
    camera.updateProjectionMatrix();

    const targetWeaponFov = 58 - w.adsT * 8;
    weaponCamera.fov += (targetWeaponFov - weaponCamera.fov) * Math.min(1, dt * 10);
    weaponCamera.updateProjectionMatrix();
  }

  composer.render();

  if (gameState === "playing") {
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(weaponScene, weaponCamera);
    renderer.autoClear = true;
  }
}

function updatePlayer(dt) {
  const w = currentWeapon();

  // rotation from touch look
  if (isTouch && (touchState.lookDX || touchState.lookDY)) {
    camera.rotation.y -= touchState.lookDX;
    camera.rotation.x -= touchState.lookDY;
    camera.rotation.x = Math.max(-1.4, Math.min(1.4, camera.rotation.x));
    camera.rotation.order = "YXZ";
    touchState.lookDX = 0; touchState.lookDY = 0;
  }

  // input
  let ix = 0, iz = 0;
  if (isTouch) {
    ix = touchState.moveX; iz = touchState.moveY;
  } else {
    if (keys.has("KeyW")) iz -= 1;
    if (keys.has("KeyS")) iz += 1;
    if (keys.has("KeyA")) ix -= 1;
    if (keys.has("KeyD")) ix += 1;
  }
  const inputLen = Math.hypot(ix, iz);
  const moving = inputLen > 0.05;
  player.sprinting = moving && (isTouch ? false : keys.has("ShiftLeft")) && !w.ads;

  const speedMult = w.moveSpeedMult * (player.sprinting ? w.def.sprintMult : 1);
  const speed = WALK_SPEED * speedMult;

  if (moving) {
    const nx = ix / (inputLen || 1), nz = iz / (inputLen || 1);
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).negate();
    const moveDir = new THREE.Vector3()
      .addScaledVector(forward, -nz)
      .addScaledVector(right, nx);
    if (moveDir.lengthSq() > 0) moveDir.normalize();
    player.velocity.x += (moveDir.x * speed - player.velocity.x) * Math.min(1, dt * w.def.inertia);
    player.velocity.z += (moveDir.z * speed - player.velocity.z) * Math.min(1, dt * w.def.inertia);
  } else {
    player.velocity.x += (0 - player.velocity.x) * Math.min(1, dt * w.def.inertia);
    player.velocity.z += (0 - player.velocity.z) * Math.min(1, dt * w.def.inertia);
  }

  const wantJump = isTouch ? touchState.jump : keys.has("Space");
  if (wantJump && player.grounded) {
    player.velocity.y = JUMP_SPEED;
    player.grounded = false;
    player.jumping = true;
  }
  player.velocity.y -= GRAVITY * dt;

  player.pos.x += player.velocity.x * dt;
  player.pos.z += player.velocity.z * dt;
  player.pos.y += player.velocity.y * dt;

  if (player.pos.y <= EYE_HEIGHT) {
    player.pos.y = EYE_HEIGHT;
    player.velocity.y = 0;
    player.grounded = true;
    player.jumping = false;
  }

  resolveCollisions(player.pos, PLAYER_RADIUS);
  camera.position.copy(player.pos);

  // fire input
  const wantAds = isTouch ? touchState.ads : adsHeld;
  const wantFire = isTouch ? touchState.firing : mouseDown;

  w.update(dt, { moving, sprinting: player.sprinting, grounded: player.grounded, jumping: player.jumping, adsHeld: wantAds, canAds: true });

  if (wantFire) {
    if (w.def.fireMode === "auto") {
      if (w.canFire()) fireOnce();
    } else {
      if (fireEdgeTrigger && w.canFire()) fireOnce();
    }
  }

  // apply recoil to camera
  camera.rotation.x -= w.recoilPitch * dt * 6;
  camera.rotation.y += w.recoilYaw * dt * 6;
}

let fireEdgeTrigger = false;
window.addEventListener("mousedown", (e) => {
  if (e.button === 0) { fireEdgeTrigger = true; setTimeout(() => fireEdgeTrigger = false, 16); }
});
els.touchFire.addEventListener("touchstart", () => { fireEdgeTrigger = true; setTimeout(() => fireEdgeTrigger = false, 16); });

function updateWeaponView(dt) {
  const w = currentWeapon();
  const mesh = weaponMeshes[player.weaponId];
  if (!mesh) return;
  for (const id of Object.keys(weaponMeshes)) weaponMeshes[id].visible = id === player.weaponId;

  const bobX = Math.sin(w.bobPhase) * w.def.bobAmp * 0.5;
  const bobY = Math.abs(Math.cos(w.bobPhase)) * w.def.bobAmp;
  const swayX = Math.sin(clock.elapsedTime * w.def.swaySpeed) * w.def.swayAmp;
  const swayY = Math.cos(clock.elapsedTime * w.def.swaySpeed * 0.8) * w.def.swayAmp * 0.6;

  const adsOffset = w.adsT;
  const hipPos = new THREE.Vector3(0.22, -0.2, -0.55);
  const aimPoint = mesh.userData.aimPoint || new THREE.Vector3(0, 0, -0.4);
  const adsViewDistance = -0.46; // where the sight should sit in front of the weapon camera
  const adsPos = new THREE.Vector3(-aimPoint.x, -aimPoint.y, adsViewDistance - aimPoint.z);
  const basePos = hipPos.clone().lerp(adsPos, adsOffset);

  mesh.position.set(
    basePos.x + bobX + swayX - w.viewKickKnockback * 0.4,
    basePos.y + bobY + swayY,
    basePos.z + w.viewKickKnockback * 0.6
  );
  mesh.rotation.set(
    -w.viewKickPitch * 0.8,
    w.viewKickYaw * 0.6 + (1 - adsOffset) * 0.05,
    (1 - adsOffset) * 0.08
  );

  if (mesh.userData.sight) mesh.userData.sight.visible = true;

  if (muzzleFlashT > 0) {
    muzzleFlashT -= dt;
    muzzleMat.uniforms.uIntensity.value = Math.max(0, muzzleFlashT / 0.045) * w.def.muzzleFlashScale;
    muzzleFlash.rotation.z += 20 * dt;
  } else {
    muzzleMat.uniforms.uIntensity.value = 0;
  }
  muzzleLight.intensity *= Math.max(0, 1 - dt * 30);
  const barrelTipLocal = new THREE.Vector3(0, 0.02, -0.62);
  muzzleFlash.position.copy(basePos).add(barrelTipLocal.multiplyScalar(1));
  muzzleLight.position.copy(muzzleFlash.position);
}

// -------------------- boot --------------------

resize();
els.loading.hidden = true;
animate();

