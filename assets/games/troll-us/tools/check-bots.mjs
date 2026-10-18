// Troll Us web: the bots' checks, run in node (no browser, no network).
//   node assets/games/troll-us/tools/check-bots.mjs [seconds=300] [bots=8] [seed=1]
// 1. Path check, as in Studio: from three starts (the table, Electrical, Reactor) a path to every task pad, fix
//    pad and vent that ends within use range of it.
// 2. Walk test: the bots walk between task pads for the given time at 30 steps a second. A bot counts as stuck
//    when it spends STUCK_TIME without a stud of progress; the test fails on any stuck bot, any bot that leaves
//    the floor or ends up inside a wall.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildColliders, BEAN_RADIUS } from '../web/core/collide.js';
import { buildNav, findPath } from '../web/bots/nav.js';
import { createBot, updateBot } from '../web/bots/bots.js';

const dir = fileURLToPath(new URL('../export/', import.meta.url));
const json = JSON.parse(readFileSync(dir + 'map.json', 'utf8'));
const rules = JSON.parse(readFileSync(dir + 'rules.json', 'utf8'));
const [SECONDS = 300, BOTS = 8, SEED = 1] = process.argv.slice(2).map(Number);

// the same tagging buildMap does (view/map.js), without three.js
const nodes = json.nodes;
nodes.forEach((n, i) => { let k = n; while (k.parent != null) k = nodes[k.parent]; n.index = i; n.folder = k.name; });
const parts = nodes.filter((n) => n.kind === 'part');
const map = {
  nodes,
  rooms: parts.filter((n) => n.folder === 'Rooms'),
  halls: parts.filter((n) => n.folder === 'Halls'),
  pads: parts.filter((n) => n.attrs?.Task && n.attrs?.TaskId != null),
  vents: parts.filter((n) => n.folder === 'Vents' && n.attrs?.Group != null),
};
const shapes = buildColliders(nodes);
const nav = buildNav(map, shapes);

function seeded(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const floors = [...map.rooms, ...map.halls].map((n) => [n.cf[0] - n.size[0] / 2, n.cf[0] + n.size[0] / 2, n.cf[2] - n.size[2] / 2, n.cf[2] + n.size[2] / 2]);
const onFloor = (x, z) => floors.some(([x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1);
function depth(x, z) {
  let m = 0;
  for (const s of shapes) {
    const dx = x - s.x, dz = z - s.z;
    let d;
    if (s.kind === 'circle') d = s.r + BEAN_RADIUS - Math.hypot(dx, dz);
    else {
      const u = dx * s.ux + dz * s.uz, v = -dx * s.uz + dz * s.ux;
      const ou = Math.max(0, Math.abs(u) - s.hu), ov = Math.max(0, Math.abs(v) - s.hv);
      d = ou || ov ? BEAN_RADIUS - Math.hypot(ou, ov) : BEAN_RADIUS + Math.min(s.hu - Math.abs(u), s.hv - Math.abs(v));
    }
    if (d > m) m = d;
  }
  return m;
}

let failed = false;
const room = (name) => map.rooms.find((n) => n.attrs?.Room === name).cf;

// ---------- 1. path check ----------
const cafe = room('Cafeteria'), elec = room('Electrical'), reac = room('Reactor');
const starts = { Table: [cafe[0] + 13, cafe[2]], Electrical: [elec[0], elec[2]], Reactor: [reac[0] + 6, reac[2]] };
const targets = [];
for (const p of map.pads) targets.push({ name: `${p.attrs.Task} (${p.attrs.Room || '?'})`, x: p.cf[0], z: p.cf[2], range: rules.useRange });
for (const [kind, list] of Object.entries(rules.fixPads || {})) for (const f of list) targets.push({ name: `fix ${kind} (${f.room})`, x: f.x, z: f.z, range: rules.useRange });
for (const v of map.vents) targets.push({ name: `vent ${v.attrs.Group} (${v.attrs.Room})`, x: v.cf[0], z: v.cf[2], range: rules.ventRange });
let t0 = performance.now(), worst = 0;
const misses = [];
for (const [sn, [sx, sz]] of Object.entries(starts)) {
  for (const t of targets) {
    const path = findPath(nav, sx, sz, t.x, t.z);
    if (!path) { misses.push(`${sn} -> ${t.name}: no path`); continue; }
    const [ex, ez] = path[path.length - 1];
    const d = Math.hypot(ex - t.x, ez - t.z);
    worst = Math.max(worst, d);
    if (d > t.range) misses.push(`${sn} -> ${t.name}: ends ${d.toFixed(1)} away`);
  }
}
console.log(`path check: ${targets.length} targets x 3 starts, ${misses.length} misses, furthest end ${worst.toFixed(2)} studs, ${Math.round(performance.now() - t0)} ms`);
for (const m of misses) console.log('  ' + m);
if (misses.length) failed = true;

// ---------- 2. walk test ----------
const rng = seeded(SEED);
const bots = [];
for (let i = 0; i < BOTS; i++) {
  const a = ((i + 1) / (BOTS + 1)) * Math.PI * 2;
  const b = createBot(nav, { x: cafe[0] + Math.cos(a) * 13, z: cafe[2] + Math.sin(a) * 13, speed: rules.botWalkSpeed, taskTime: rules.botTaskTime, rng });
  b.busy = rng() * 2;
  bots.push(b);
}
const DT = 1 / 30;
let deepest = 0, offFloor = 0, walked = 0;
t0 = performance.now();
for (let step = 0; step < SECONDS / DT; step++) {
  for (const b of bots) {
    const x = b.x, z = b.z;
    updateBot(b, DT, map.pads, shapes);
    walked += Math.hypot(b.x - x, b.z - z);
    deepest = Math.max(deepest, depth(b.x, b.z));
    if (!onFloor(b.x, b.z)) offFloor++;
  }
}
const stucks = bots.reduce((n, b) => n + b.stucks, 0), tasks = bots.reduce((n, b) => n + b.tasksDone, 0);
console.log(`walk test: ${BOTS} bots for ${SECONDS} s, ${tasks} tasks done, ${Math.round(walked)} studs walked, ${stucks} stuck, ` +
  `${offFloor} steps off the floor, deepest into a wall ${deepest.toFixed(3)} studs, ${Math.round(performance.now() - t0)} ms`);
for (const b of bots) if (b.stucks) console.log(`  stuck: bot at ${b.x.toFixed(1)}, ${b.z.toFixed(1)} heading for ${b.goal?.attrs.Task} (${b.goal?.attrs.Room})`);
if (stucks || offFloor || deepest > 0.1) failed = true;

console.log(failed ? 'FAIL' : 'ok');
process.exit(failed ? 1 : 0);
