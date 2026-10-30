// Troll Us web: entry point (phase 4). You walk The Skeld in first person while bot Crewmates waddle between
// task pads; the round itself (roles, tasks, kills, meetings) is phase 5. A test hook lives on window.TU.
//   ?cam=x,y,z&look=x,y,z&fov=70   a fixed camera instead of walking (used to compare with Studio screenshots)
//   ?suit=Blue                     the colour of your goggle frame
//   ?bots=7                        how many bots (Studio fills to botFillTo players, you included)
//   ?seed=1                        repeatable bot choices (tests)
//   ?at=x,z&yaw=deg                start somewhere other than the spot by the Cafeteria table
import * as THREE from 'three';
import { buildMap } from './view/map.js?v=tu-4b1';
import { addLights } from './view/lights.js?v=tu-4b1';
import { buildColliders } from './core/collide.js?v=tu-4d1';
import { createPlayer, updatePlayer, placeCamera } from './core/player.js?v=tu-4d1';
import { input, initInput, readMove, takeLook } from './input/input.js?v=tu-4c1';
import { buildBean, waddle, suitHex } from './view/bean.js?v=tu-4d1';
import { buildNav, findPath } from './bots/nav.js?v=tu-4d1';
import { createBot, updateBot } from './bots/bots.js?v=tu-4d1';

// a small seeded random (mulberry32) so a test can replay the same bots
function seeded(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

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
  const get = (f) => fetch(EXPORT + f + '?v=tu-4d1').then((r) => r.json());
  const [json, rules, rig, hats] = await Promise.all([get('map.json'), get('rules.json'), get('rig.json'), get('hats.json')]);
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
  const mySuit = q.get('suit') || 'Red';
  setSuit(mySuit, rules);

  // the bots: the other suits in lobby order, a random hat each, standing round the table like Studio's ring
  const nav = buildNav(map, shapes);
  const rng = q.get('seed') ? seeded(Number(q.get('seed'))) : Math.random;
  const botCount = Math.max(0, Math.min(11, q.get('bots') != null ? Number(q.get('bots')) : (rules.botFillTo || 8) - 1));
  const suits = (rules.suits || []).filter((s) => s !== mySuit);
  const hatNames = hats.list || ['None'];
  const pads = map.pads;
  const bots = [];
  for (let i = 0; i < botCount; i++) {
    const a = ((i + 1) / (botCount + 1)) * Math.PI * 2;
    const bot = createBot(nav, { x: table[0] + Math.cos(a) * 13, z: table[1] + Math.sin(a) * 13,
      speed: rules.botWalkSpeed || 12, taskTime: rules.botTaskTime || 6, rng, name: 'bot' });
    bot.yaw = Math.atan2(Math.cos(a), Math.sin(a)); // facing the table
    bot.busy = 0.5 + rng() * 2; // don't all set off on the same frame
    const hat = hatNames[Math.floor(rng() * hatNames.length)];
    bot.bean = buildBean(rig, { suit: suitHex(suits[i % suits.length], rules), hat: hat === 'None' ? null : hat, hats });
    bot.suit = suits[i % suits.length]; bot.hat = hat;
    scene.add(bot.bean.group);
    bots.push(bot);
  }
  const placeBean = (bot) => { bot.bean.group.position.set(bot.x, 0, bot.z); bot.bean.group.rotation.y = bot.yaw; };
  bots.forEach(placeBean);
  // runs the bots without drawing (the walk test calls this thousands of times)
  const stepBots = (dt) => { for (const b of bots) { updateBot(b, dt, pads, shapes); placeBean(b); waddle(b.bean, dt, b.moving ? 1 : 0); } };

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
    stepBots(dt);
    if (!fixed) {
      updatePlayer(player, dt, readMove(), takeLook(), shapes);
      placeCamera(player, camera);
    }
    renderer.render(scene, camera);
  };
  let last = performance.now();
  const frame = (now) => { tick(Math.min(0.1, (now - last) / 1000)); last = now; };
  window.TU = { THREE, scene, camera, renderer, map, shapes, player, input, setCam, setVision, VISION, rules, rig, hats,
    nav, findPath, bots, stepBots, buildBean, waddle,
    render: () => renderer.render(scene, camera), tick, step: (dt, mx, my) => updatePlayer(player, dt, { moveX: mx, moveY: my }, [0, 0], shapes),
    ready: true };
  renderer.setAnimationLoop(frame);
}

start().catch((e) => { status.textContent = 'Could not load The Skeld: ' + e.message; console.error(e); });
