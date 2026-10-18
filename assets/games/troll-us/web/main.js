// Troll Us web: entry point (phase 4). Step 3 walks you round The Skeld in first person; beans and bots come in
// the next steps. A test hook lives on window.TU.
//   ?cam=x,y,z&look=x,y,z&fov=70   a fixed camera instead of walking (used to compare with Studio screenshots)
//   ?suit=Blue                     the colour of your goggle frame
//   ?at=x,z&yaw=deg                start somewhere other than the spot by the Cafeteria table
import * as THREE from 'three';
import { buildMap } from './view/map.js?v=tu-4b1';
import { addLights } from './view/lights.js?v=tu-4b1';
import { buildColliders } from './core/collide.js?v=tu-4c1';
import { createPlayer, updatePlayer, placeCamera } from './core/player.js?v=tu-4c1';
import { input, initInput, readMove, takeLook } from './input/input.js?v=tu-4c1';

const EXPORT = 'assets/games/troll-us/export/';
const canvas = document.getElementById('tu-canvas');
const status = document.getElementById('tu-status');
const hint = document.getElementById('tu-hint');
const q = new URLSearchParams(location.search);
const nums = (k) => q.get(k)?.split(',').map(Number);

// Studio's vision: black fog from 55% of your sight radius to all of it. Crew see 24 studs.
const VISION = { crew: 24, impostor: 36, lightsOut: 8, vent: 16 };

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
// no tone mapping: Studio shows part colours close to as authored, and ACES greys them out
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(80, 1, 0.1, 400);
camera.position.set(0, 3.6, -18); // the Cafeteria table, at eye height

// Studio's FOV is 80 up and down. On a phone held upright that leaves a sliver of width, so there the view keeps
// the width a square screen would have, up to 100 tall.
const FOV = 80;
let fixedFov = false; // ?fov= pins it
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  if (!fixedFov) camera.fov = camera.aspect >= 1 ? FOV
    : Math.min(100, 2 * Math.atan(Math.tan(FOV * Math.PI / 360) / camera.aspect) * 180 / Math.PI);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function setCam(pos, look, fov) {
  camera.position.set(...pos);
  if (look) camera.lookAt(new THREE.Vector3(...look));
  if (fov) { fixedFov = true; camera.fov = fov; camera.updateProjectionMatrix(); }
}

function setVision(r) {
  if (!r) { scene.fog = null; return; }
  scene.fog = new THREE.Fog(0x000000, r * 0.55, r);
}

function setSuit(name, rules) {
  const hex = rules?.suitColors?.[name] || '#c51111';
  // the frame is your suit a shade darker (Studio: × 0.72)
  const c = new THREE.Color(hex).multiplyScalar(0.72);
  document.body.style.setProperty('--suit', '#' + c.getHexString());
}

function showHint() {
  if (input.touch) hint.textContent = 'Left thumb walks, right side looks';
  else hint.textContent = input.locked ? 'WASD to walk · Esc frees the mouse' : 'Click to look around';
}

async function start() {
  status.textContent = 'Loading The Skeld…';
  const [json, rules] = await Promise.all([
    fetch(EXPORT + 'map.json?v=tu-4b1').then((r) => r.json()),
    fetch(EXPORT + 'rules.json?v=tu-4c1').then((r) => r.json()),
  ]);
  const map = buildMap(json);
  scene.add(map.group);
  addLights(scene);
  const shapes = buildColliders(map.nodes);

  // Studio's first spot on the ring round the emergency table (ringSpot(1, n, 13); the table stands in the middle
  // of the Cafeteria), turned to face the table
  const cafe = map.rooms.find((n) => n.attrs?.Room === 'Cafeteria');
  const table = cafe ? [cafe.cf[0], cafe.cf[2]] : [0, -30];
  const at = nums('at');
  const player = createPlayer({
    x: at ? at[0] : table[0] + 13,
    z: at ? at[1] : table[1],
    yaw: (q.get('yaw') != null ? Number(q.get('yaw')) : 90) * Math.PI / 180,
    speed: rules.walkSpeed || 14,
  });
  setSuit(q.get('suit') || 'Red', rules);

  const fixed = q.get('cam');
  if (fixed) setCam(nums('cam'), nums('look'), Number(q.get('fov')) || undefined);
  else {
    setVision(VISION.crew);
    document.body.classList.add('is-playing');
    initInput(canvas, {
      stick: document.getElementById('tu-stick'),
      nub: document.querySelector('#tu-stick > div'),
      onLock: showHint,
      onTouch: () => { document.body.classList.add('is-touch'); showHint(); },
    });
    if (matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches) {
      input.touch = true; document.body.classList.add('is-touch');
    }
    showHint();
  }
  status.textContent = '';

  const tick = (dt) => {
    if (!fixed) {
      updatePlayer(player, dt, readMove(), takeLook(), shapes);
      placeCamera(player, camera);
    }
    renderer.render(scene, camera);
  };
  let last = performance.now();
  const frame = (now) => { tick(Math.min(0.1, (now - last) / 1000)); last = now; };
  window.TU = { THREE, scene, camera, renderer, map, shapes, player, input, setCam, setVision, VISION,
    render: () => renderer.render(scene, camera), tick, step: (dt, mx, my) => updatePlayer(player, dt, { moveX: mx, moveY: my }, [0, 0], shapes),
    ready: true };
  renderer.setAnimationLoop(frame);
}

start().catch((e) => { status.textContent = 'Could not load The Skeld: ' + e.message; console.error(e); });
