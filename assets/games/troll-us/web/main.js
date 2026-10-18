// Troll Us web: entry point (phase 4). Step 2 builds The Skeld from the Studio export and looks at it; walking,
// beans and bots come in the next steps. A test hook lives on window.TU.
//   ?cam=x,y,z&look=x,y,z&fov=70   put the camera at a spot (used to compare with Studio screenshots)
import * as THREE from 'three';
import { buildMap } from './view/map.js?v=tu-4b1';
import { addLights } from './view/lights.js?v=tu-4b1';

const EXPORT = 'assets/games/troll-us/export/';
const canvas = document.getElementById('tu-canvas');
const status = document.getElementById('tu-status');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
// no tone mapping: Studio shows part colours close to as authored, and ACES greys them out
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(80, 1, 0.1, 400);
camera.position.set(0, 3.6, -18); // the Cafeteria table, at eye height

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function setCam(pos, look, fov) {
  camera.position.set(...pos);
  if (look) camera.lookAt(new THREE.Vector3(...look));
  if (fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
}

function readCamParam() {
  const q = new URLSearchParams(location.search);
  const nums = (k) => q.get(k)?.split(',').map(Number);
  if (q.get('cam')) setCam(nums('cam'), nums('look'), Number(q.get('fov')) || undefined);
  else camera.lookAt(0, 3.6, -40);
}

async function start() {
  status.textContent = 'Loading The Skeld…';
  const json = await fetch(EXPORT + 'map.json?v=tu-4b1').then((r) => r.json());
  const map = buildMap(json);
  scene.add(map.group);
  addLights(scene);
  readCamParam();
  status.textContent = '';
  window.TU = { THREE, scene, camera, renderer, map, setCam, render: () => renderer.render(scene, camera), ready: true };
  renderer.setAnimationLoop(() => renderer.render(scene, camera));
}

start().catch((e) => { status.textContent = 'Could not load The Skeld: ' + e.message; console.error(e); });
