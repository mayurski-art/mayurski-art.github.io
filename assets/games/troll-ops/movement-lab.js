// Troll Ops — Movement Lab.
//
// An empty test arena for tuning the real player movement/animation rig
// (movement.js + character.js, unmodified) outside the full game. Live
// sliders patch the same tunables movement.js reads off `input`/module
// constants, so what feels right here is what to carry into the live
// game's own values.

import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { MovementController } from "./movement.js";
import { buildHumanoid, poseHumanoid, gaitPhaseRate } from "./character.js";

// ---------- renderer / scene ----------
const stage = document.getElementById("stage");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1c1c1e);
scene.fog = new THREE.Fog(0x1c1c1e, 40, 140);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 500);

const hemi = new THREE.HemisphereLight(0xffffff, 0x2a2a2e, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(30, 40, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
scene.add(sun);

// ---------- empty flat arena ----------
const ARENA_SIZE = 60;
const groundMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3e, roughness: 0.95 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE, 20, 20), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(ARENA_SIZE, 24, 0x555559, 0x2c2c2e);
grid.position.y = 0.01;
scene.add(grid);

// low boundary walls so you can see the arena edge
const wallMat = new THREE.MeshStandardMaterial({ color: 0x2c2c2e, roughness: 0.9 });
const walls = new THREE.Group();
const half = ARENA_SIZE / 2;
const wallH = 2;
[[0, -half, ARENA_SIZE, 0.4], [0, half, ARENA_SIZE, 0.4], [-half, 0, 0.4, ARENA_SIZE], [half, 0, 0.4, ARENA_SIZE]].forEach(([x, z, w, d]) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
  m.position.set(x, wallH / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  walls.add(m);
});
scene.add(walls);

// ---------- optional obstacles (crate + vault ledge), toggleable ----------
const crateMat = new THREE.MeshStandardMaterial({ color: 0xff9500, roughness: 0.7 });
const crate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), crateMat);
crate.position.set(3, 0.6, -4);
crate.castShadow = true;
crate.receiveShadow = true;
scene.add(crate);

const ledgeMat = new THREE.MeshStandardMaterial({ color: 0x34c759, roughness: 0.7 });
const ledge = new THREE.Mesh(new THREE.BoxGeometry(3, 0.9, 1.4), ledgeMat);
ledge.position.set(-4, 0.45, -6);
ledge.castShadow = true;
ledge.receiveShadow = true;
scene.add(ledge);

function collidersFromMesh(mesh) {
  const box = new THREE.Box3().setFromObject(mesh);
  return box;
}
function buildColliders() {
  const list = [];
  if (params.crates) list.push(collidersFromMesh(crate));
  if (params.ledge) list.push(collidersFromMesh(ledge));
  return list;
}

const arenaBounds = { minX: -half + 0.4, maxX: half - 0.4, minZ: -half + 0.4, maxZ: half - 0.4 };

// ---------- character rig ----------
const LIMB_MAT = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.6 });
let rig = null;
let rigGroup = new THREE.Group();
scene.add(rigGroup);

function rebuildRig() {
  rigGroup.clear();
  rig = buildHumanoid(LIMB_MAT, { height: params.height, build: params.build, gun: true, face: params.face });
  rigGroup.add(rig.root);
}

// ---------- movement controller ----------
const params = {
  build: 1, height: 1.8, face: "grin", thirdPerson: true,
  walk: 5.2, sprintMult: 1.35, inertia: 9,
  gravity: 22, jump: 7,
  slideBoost: 1.55, slideTime: 0.85, diveForward: 9.5,
  crates: true, ledge: true,
};

const mover = new MovementController({
  colliders: buildColliders(),
  arena: arenaBounds,
  tuning: tuningFromParams(),
});
mover.reset(0, 0, 0);
rebuildRig();

// Debug hooks for headless inspection (movement-lab only).
window.__lab = { mover, rig: () => rig, rigGroup, camera, scene, renderer, THREE };

function tuningFromParams() {
  return {
    WALK_SPEED: params.walk,
    GRAVITY: params.gravity,
    JUMP_SPEED: params.jump,
    SLIDE_BOOST: params.slideBoost,
    SLIDE_TIME: params.slideTime,
    DIVE_FORWARD: params.diveForward,
  };
}

// ---------- input ----------
const keys = {};
window.addEventListener("keydown", (e) => { keys[e.code] = true; });
window.addEventListener("keyup", (e) => { keys[e.code] = false; });

const controls = new PointerLockControls(camera, renderer.domElement);
const hint = document.getElementById("hint");
renderer.domElement.addEventListener("click", () => controls.lock());
controls.addEventListener("lock", () => hint.classList.add("hidden"));
controls.addEventListener("unlock", () => hint.classList.remove("hidden"));

let yaw = 0, pitch = 0;
document.addEventListener("mousemove", (e) => {
  if (!controls.isLocked) return;
  yaw -= e.movementX * 0.0022;
  pitch -= e.movementY * 0.0022;
  pitch = Math.max(-1.3, Math.min(1.3, pitch));
});

// ---------- panel wiring ----------
function bindRange(id, key, label, decimals = 2) {
  const el = document.getElementById(id);
  const valEl = document.getElementById("v-" + id.slice(2));
  el.addEventListener("input", () => {
    params[key] = parseFloat(el.value);
    valEl.textContent = params[key].toFixed(decimals);
    Object.assign(mover.tuning, tuningFromParams());
    onParamsChanged(key);
  });
}
bindRange("p-build", "build", "build");
bindRange("p-height", "height", "height");
bindRange("p-walk", "walk", "walk", 1);
bindRange("p-sprint", "sprintMult", "sprintMult");
bindRange("p-inertia", "inertia", "inertia", 1);
bindRange("p-gravity", "gravity", "gravity", 1);
bindRange("p-jump", "jump", "jump", 1);
bindRange("p-slideboost", "slideBoost", "slideBoost");
bindRange("p-slidetime", "slideTime", "slideTime");
bindRange("p-diveforward", "diveForward", "diveForward", 1);

document.getElementById("p-face").addEventListener("change", (e) => {
  params.face = e.target.value;
  rebuildRig();
});
document.getElementById("p-thirdperson").addEventListener("change", (e) => {
  params.thirdPerson = e.target.checked;
});
document.getElementById("p-crates").addEventListener("change", (e) => {
  params.crates = e.target.checked;
  crate.visible = params.crates;
  mover.colliders = buildColliders();
});
document.getElementById("p-ledge").addEventListener("change", (e) => {
  params.ledge = e.target.checked;
  ledge.visible = params.ledge;
  mover.colliders = buildColliders();
});

document.getElementById("btn-reset-pos").addEventListener("click", () => {
  mover.reset(0, 0, 0);
  yaw = 0; pitch = 0;
});
document.getElementById("btn-reset-vals").addEventListener("click", () => window.location.reload());

function onParamsChanged(key) {
  if (key === "build" || key === "height") rebuildRig();
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- gait state (mirrors game.js's per-frame phase driver) ----------
let gaitPhase = 0;

// ---------- main loop ----------
const clock = new THREE.Clock();
const hudPos = document.getElementById("hud-pos");
const hudStance = document.getElementById("hud-stance");
const hudSpeed = document.getElementById("hud-speed");

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());

  const forward = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const strafe = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);

  const input = {
    forward, strafe,
    sprint: !!keys.ShiftLeft || !!keys.ShiftRight,
    jump: !!keys.Space,
    crouch: !!keys.ControlLeft || !!keys.ControlRight,
    dive: !!keys.KeyV,
    yaw,
    adsHeld: false,
    sprintMult: params.sprintMult,
    inertia: params.inertia,
    speedMult: 1,
  };

  mover.update(dt, input);

  rigGroup.position.copy(mover.pos);
  rigGroup.rotation.y = yaw;

  const planarSpeed = Math.hypot(mover.velocity.x, mover.velocity.z);
  const moving = mover.moving;
  if (moving) gaitPhase += dt * gaitPhaseRate(planarSpeed);

  const localForward = -( -Math.sin(yaw) * (mover.velocity.x) + -Math.cos(yaw) * (mover.velocity.z) ) / (planarSpeed || 1);
  const localStrafe = ( Math.cos(yaw) * mover.velocity.x + -Math.sin(yaw) * mover.velocity.z ) / (planarSpeed || 1);

  poseHumanoid(rig, {
    phase: gaitPhase,
    moving,
    pitch,
    lower: mover.crouched ? (mover.stance === "prone" ? 1 : 0.6) : 0,
    strafe: moving ? localStrafe : 0,
    forward: moving ? localForward : 1,
    speed: Math.min(1, planarSpeed / (params.walk * params.sprintMult)),
    mps: planarSpeed,
    dt,
  });

  // camera
  if (window.__labFreezeCamera) {
    // debug inspection mode — skip automatic camera placement
  } else if (params.thirdPerson) {
    const eye = mover.eyePosition();
    const camDist = 4.2, camHeight = 1.4;
    const behind = new THREE.Vector3(Math.sin(yaw) * camDist, camHeight, Math.cos(yaw) * camDist);
    camera.position.copy(mover.pos).add(behind);
    camera.lookAt(eye.x, eye.y, eye.z);
  } else {
    mover.eyePosition(camera.position);
    camera.rotation.set(0, 0, 0);
    camera.rotateY(yaw);
    camera.rotateX(pitch);
  }

  hudPos.textContent = `${mover.pos.x.toFixed(1)}, ${mover.pos.y.toFixed(1)}, ${mover.pos.z.toFixed(1)}`;
  hudStance.textContent = mover.stance;
  hudSpeed.textContent = planarSpeed.toFixed(1);

  renderer.render(scene, camera);
}

frame();
