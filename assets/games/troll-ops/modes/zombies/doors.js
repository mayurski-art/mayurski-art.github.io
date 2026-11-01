// Troll Forces Zombies: doors and areas (design doc "Zombies economy", phase
// 5; claude.ai/artifact/CX7UuR3ybkeUvvNrbk9muS). Call of Duty's: the map is
// cut into areas, you start in one, and doors (a gate, a pile of debris)
// open the rest for points. A closed door is solid for players and zombies,
// and a zombie entry point only spawns once its area is open.
//
// Each map's areas, fences and doors are maps/zombie-buys.js. Fences are
// Zombies-only railings that close open ground between areas: built along a
// line, they leave a gap wherever a building's wall already stands in it.
//
// Hooks into the horde (modes/zombies/horde.js, the zombies AI session's
// file, untouched): the director picks spawns from `zdir.windows`, so that
// is set to the open areas' entry points; and it caches flow fields in
// `zdir.fields`, cleared when a door opens so the path through it counts.
//
// Co-op: whoever buys a door opens it and says so; everyone opens it. A
// player who joins late asks the host for everything (coop.js "zq") and gets
// the open doors with it. The wire (run.js routes "zD" here):
//   zD { o: id }       a door was bought: open it
//   zD { all: [ids] }  every door open so far (the host, to a joiner)

import * as THREE from "three";
import { game, match } from "../../core/state.js?v=st1";
import { spend } from "./economy.js?v=zr5-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-zd1-wb1-mt2-sk1-hb4-lu1-mb1-mb2-gc1-bt1-nft33-nfh1-nfh5-mg2-nft2531-nft2531h-tn13-kbc3";
import { ZOMBIE_BUYS } from "../../maps/zombie-buys.js?v=zx2-tn13";

const REACH = 1.8;        // metres from a door's line you can buy it from
const FENCE_H = 2.1;      // a railing's height
const WALL_H = 3.4;       // its collider: taller than a jump off anything beside it
const TALL = 1.8;         // a collider this tall where a fence runs is a wall already (Hollowgrin's graveyard fence: 1.9)
const STEP = 0.25;        // m along a fence line, testing for those walls
const OPEN_TIME = 0.9;    // s, a gate swinging or debris falling apart
const DOORWAY = 1.6;      // m: a boarded span shorter than this is a doorway (planks, no crates)

const st = {
  map: null, areas: [], doors: [], fences: [], open: new Set(),
  allWindows: null, meshes: [], hooks: null, n: 0,
};

/* ------------------------------------------------------------ areas */

/* The area a point stands in: the first whose boxes hold it, else null. */
export function areaOf(x, z) {
  for (const a of st.areas) for (const [x0, z0, x1, z1] of a.boxes) if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return a.id;
  return null;
}

/* Is this point's area open? Outside every area counts as open (the map's
   own paths between them), so data that misses a corner never hides it. */
export function zoneOpen(p) {
  if (!st.areas.length) return true;
  const id = areaOf(p.x, p.z);
  return id == null || st.open.has(id);
}

/* The director spawns only where it's open. */
function applyWindows() {
  const zdir = game.zdir;
  if (!zdir || !st.allWindows) return;
  zdir.windows = st.allWindows.filter((w) => zoneOpen(w));
  zdir.fields?.clear?.();   // a door's gone: the fields have a new way through
}

/* ------------------------------------------------------------ the look */

/* Weathered boards: grain running along a plank, darker knots. `crate`
   draws a crate's face instead: slats inside a frame and a cross brace. */
function woodTexture(crate = false, seed = 5) {
  const c = document.createElement("canvas");
  c.width = 256; c.height = crate ? 256 : 64;
  const g = c.getContext("2d");
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  g.fillStyle = "#9a7148"; g.fillRect(0, 0, c.width, c.height);
  const grain = (x0, y0, w, h) => {
    for (let i = 0; i < h / 3; i++) {
      g.strokeStyle = `rgba(${60 + rnd() * 40 | 0},${38 + rnd() * 20 | 0},${20 + rnd() * 12 | 0},${0.25 + rnd() * 0.35})`;
      g.lineWidth = 1 + rnd() * 1.5;
      g.beginPath();
      const y = y0 + rnd() * h;
      g.moveTo(x0, y);
      g.bezierCurveTo(x0 + w * 0.3, y + (rnd() - 0.5) * 4, x0 + w * 0.7, y + (rnd() - 0.5) * 4, x0 + w, y);
      g.stroke();
    }
  };
  if (!crate) {
    grain(0, 0, c.width, c.height);
    for (let k = 0; k < 2; k++) { g.fillStyle = "rgba(55,32,16,.55)"; g.beginPath(); g.ellipse(30 + rnd() * 200, 16 + rnd() * 32, 5 + rnd() * 4, 3, 0, 0, 7); g.fill(); }
  } else {
    for (let i = 0; i < 4; i++) { grain(0, i * 64, 256, 64); g.fillStyle = "rgba(40,24,12,.7)"; g.fillRect(0, i * 64, 256, 3); }
    g.strokeStyle = "#5e4127"; g.lineWidth = 26; g.strokeRect(13, 13, 230, 230);
    g.lineWidth = 22; g.beginPath(); g.moveTo(24, 232); g.lineTo(232, 24); g.stroke();
    g.fillStyle = "#3a2614";
    for (const [x, y] of [[13, 13], [243, 13], [13, 243], [243, 243]]) { g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const IRON = new THREE.MeshStandardMaterial({ color: 0x1a1b1f, metalness: 0.55, roughness: 0.55 });
IRON.userData.shared = true;
let WOOD = null, WOOD_DARK = null, CRATE = null;
/* The boards' materials, made the first time a barricade goes up. */
function woodMats() {
  if (WOOD) return;
  WOOD = new THREE.MeshStandardMaterial({ map: woodTexture(false, 5), roughness: 0.88 });
  WOOD_DARK = new THREE.MeshStandardMaterial({ map: woodTexture(false, 11), color: 0xc9b8a4, roughness: 0.9 });
  CRATE = new THREE.MeshStandardMaterial({ map: woodTexture(true, 7), roughness: 0.85 });
  for (const m of [WOOD, WOOD_DARK, CRATE]) m.userData.shared = true;
}

/* An iron railing from a to b on floor y: posts, bars, two rails, spear
   tips. One InstancedMesh per part, so a hundred metres is three draws. */
function railing(spans, y) {
  const g = new THREE.Group();
  const bars = [], posts = [], rails = [];
  for (const [ax, az, bx, bz] of spans) {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.05) continue;
    const ux = (bx - ax) / len, uz = (bz - az) / len, yaw = Math.atan2(ux, uz);
    for (let t = 0.07; t < len; t += 0.14) bars.push([ax + ux * t, az + uz * t]);
    for (let t = 0; t <= len + 0.01; t += Math.max(0.5, len / Math.max(1, Math.round(len / 2.4)))) posts.push([ax + ux * Math.min(t, len), az + uz * Math.min(t, len)]);
    for (const h of [0.18, FENCE_H - 0.22]) rails.push({ x: (ax + bx) / 2, z: (az + bz) / 2, h, len, yaw });
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  if (bars.length) {
    const geo = new THREE.CylinderGeometry(0.014, 0.014, FENCE_H - 0.1, 5);
    geo.translate(0, (FENCE_H - 0.1) / 2, 0);
    const tip = new THREE.ConeGeometry(0.03, 0.12, 4);
    tip.translate(0, FENCE_H - 0.02, 0);
    const im = new THREE.InstancedMesh(geo, IRON, bars.length), it = new THREE.InstancedMesh(tip, IRON, bars.length);
    bars.forEach(([x, z], i) => { m4.compose(p.set(x, y, z), q, s); im.setMatrixAt(i, m4); it.setMatrixAt(i, m4); });
    g.add(im, it);
  }
  if (posts.length) {
    const geo = new THREE.BoxGeometry(0.09, FENCE_H + 0.12, 0.09);
    geo.translate(0, (FENCE_H + 0.12) / 2, 0);
    const im = new THREE.InstancedMesh(geo, IRON, posts.length);
    posts.forEach(([x, z], i) => { m4.compose(p.set(x, y, z), q, s); im.setMatrixAt(i, m4); });
    g.add(im);
  }
  for (const r of rails) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.05, r.len), IRON);
    rail.position.set(r.x, y + r.h, r.z);
    rail.rotation.y = r.yaw;
    g.add(rail);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/* A barricade of planks and crates from a to b (Troll City's debris). */
function barricade(ax, az, bx, bz, y, seed = 1) {
  woodMats();
  const g = new THREE.Group();
  const len = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az);
  g.position.set((ax + bx) / 2, y, (az + bz) / 2);
  g.rotation.y = yaw;
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  // crates along the foot
  for (let t = -len / 2 + 0.5; t < len / 2 - 0.3; t += 1.05) {
    const k = 0.85 + rnd() * 0.2;
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.9 * k, 0.9 * k, 0.9 * k), CRATE);
    c.position.set((rnd() - 0.5) * 0.2, 0.45 * k, t);
    c.rotation.y = (rnd() - 0.5) * 0.3;
    g.add(c);
  }
  // planks across, nailed at a slant
  for (let h = 1.1; h < FENCE_H + 0.2; h += 0.34) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, len + 0.3), rnd() < 0.5 ? WOOD : WOOD_DARK);
    p.position.set(0, h, 0);
    p.rotation.x = (rnd() - 0.5) * 0.12;
    g.add(p);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/* Planks nailed across a doorway from a to b, a hand proud of the wall (a
   door the map already has stays where it is, behind them). */
function planks(ax, az, bx, bz, y, seed = 1, over = 0.25) {
  woodMats();
  const g = new THREE.Group();
  const len = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az);
  g.position.set((ax + bx) / 2, y, (az + bz) / 2);
  g.rotation.y = yaw;
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let h = 0.35; h < FENCE_H + 0.1; h += 0.3) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, len + over), rnd() < 0.5 ? WOOD : WOOD_DARK);
    p.position.set(0, h, 0);
    p.rotation.x = (rnd() - 0.5) * 0.16;
    g.add(p);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/* A gate: two railing leaves between stone pillars; it swings open.
   `pillars: false` hangs the leaves on posts the map already has. */
function gate(ax, az, bx, bz, y, pillars = true) {
  const g = new THREE.Group();
  const len = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az);
  g.position.set(ax, y, az);
  g.rotation.y = yaw;
  const stone = new THREE.MeshStandardMaterial({ color: 0x6f6a63, roughness: 0.95 });
  if (pillars) for (const t of [0, len]) {
    const pil = new THREE.Mesh(new THREE.BoxGeometry(0.42, FENCE_H + 0.5, 0.42), stone);
    pil.position.set(0, (FENCE_H + 0.5) / 2, t);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.52), stone);
    cap.position.set(0, FENCE_H + 0.56, t);
    g.add(pil, cap);
  }
  const leaves = [];
  const inset = pillars ? 0.21 : 0.18;   // (the map's own posts have hinges and finials to clear)
  const half = len / 2 - inset;
  for (const [hinge, dir] of [[inset, 1], [len - inset, -1]]) {
    const leaf = new THREE.Group();
    leaf.position.set(0, 0, hinge);
    const r = railing([[0, 0, 0, dir * half]], 0);
    leaf.add(r);
    leaf.userData.dir = dir;
    leaves.push(leaf);
    g.add(leaf);
  }
  g.userData.leaves = leaves;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/* ------------------------------------------------------------ fences */

/* Spans of a line from a to b that need a railing: everywhere no wall of
   the map's already stands (a tall collider within `pad` of the line). */
function openSpans(ax, az, bx, bz, y) {
  const len = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.ceil(len / STEP));
  const tall = game.colliders.filter((c) => !c.deploy && !c.zdoor && c.min.y < y + 1.0 && c.max.y >= y + TALL
    && Math.max(c.min.x, Math.min(ax, bx) - 0.5) <= Math.min(c.max.x, Math.max(ax, bx) + 0.5)
    && Math.max(c.min.z, Math.min(az, bz) - 0.5) <= Math.min(c.max.z, Math.max(az, bz) + 0.5));
  // a door in the line is its own barrier: no railing through it
  const doorAt = (x, z) => st.doors.some((d) => {
    const dx = x - d.mid.x, dz = z - d.mid.z;
    return Math.abs(dx * d.u.x + dz * d.u.z) <= d.len / 2 + 0.05 && Math.abs(dx * d.u.z - dz * d.u.x) < 0.3;
  });
  const walled = (x, z) => doorAt(x, z) || tall.some((c) => x >= c.min.x - 0.12 && x <= c.max.x + 0.12 && z >= c.min.z - 0.12 && z <= c.max.z + 0.12);
  const spans = [];
  let start = null;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    const w = walled(x, z);
    if (!w && start == null) start = t;
    if ((w || i === n) && start != null) {
      const end = w ? (i - 1) / n : t;
      if (end > start) spans.push([ax + (bx - ax) * start, az + (bz - az) * start, ax + (bx - ax) * end, az + (bz - az) * end]);
      start = null;
    }
  }
  return spans;
}

/* Colliders for a line (axis-aligned boxes along it, so a slanted one is a
   staircase of thin boxes). */
function lineColliders(ax, az, bx, bz, y, extra = {}) {
  const out = [];
  const len = Math.hypot(bx - ax, bz - az);
  const axisX = Math.abs(bz - az) < 0.01, axisZ = Math.abs(bx - ax) < 0.01;
  const T = 0.16;
  if (axisX || axisZ) {
    out.push({
      min: new THREE.Vector3(Math.min(ax, bx) - (axisZ ? T : 0), y, Math.min(az, bz) - (axisX ? T : 0)),
      max: new THREE.Vector3(Math.max(ax, bx) + (axisZ ? T : 0), y + WALL_H, Math.max(az, bz) + (axisX ? T : 0)),
      pen: 1, ...extra,
    });
    return out;
  }
  const n = Math.ceil(len / 0.3);
  for (let i = 0; i < n; i++) {
    const x = ax + (bx - ax) * (i + 0.5) / n, z = az + (bz - az) * (i + 0.5) / n;
    out.push({ min: new THREE.Vector3(x - 0.2, y, z - 0.2), max: new THREE.Vector3(x + 0.2, y + WALL_H, z + 0.2), pen: 1, ...extra });
  }
  return out;
}

function addColliders(list) { for (const c of list) game.colliders.push(c); }
function dropColliders(list) {
  for (const c of list) { const i = game.colliders.indexOf(c); if (i >= 0) game.colliders.splice(i, 1); }
}

/* ------------------------------------------------------------ doors */

function buildDoor(d, i) {
  const [ax, az] = d.a, [bx, bz] = d.b, y = d.y ?? 0;
  const mesh = d.kind === "gate" ? gate(ax, az, bx, bz, y, d.pillars !== false)
    : d.kind === "planks" ? planks(ax, az, bx, bz, y, 7 + i * 13)
    : barricade(ax, az, bx, bz, y, 7 + i * 13);
  mesh.name = `zdoor-${d.id}`;
  game.scene.add(mesh);
  const cols = lineColliders(ax, az, bx, bz, y, { zdoor: d.id });
  addColliders(cols);
  const len = Math.hypot(bx - ax, bz - az);
  return {
    ...d, y, mesh, cols, open: false, t: 0,
    mid: new THREE.Vector3((ax + bx) / 2, y, (az + bz) / 2),
    u: new THREE.Vector3((bx - ax) / len, 0, (bz - az) / len), len,
  };
}

/* Open door `id` here (bought here, or said on the wire). */
export function openDoor(id, quiet = false) {
  const d = st.doors.find((q) => q.id === id);
  if (!d || d.open) return false;
  d.open = true;
  d.t = 0;
  dropColliders(d.cols);
  const fresh = (d.between || []).filter((a) => !st.open.has(a));
  for (const a of d.between || []) st.open.add(a);
  applyWindows();
  if (!quiet) {
    game.audio.zombieBuy?.(true);
    const names = fresh.map((a) => st.areas.find((q) => q.id === a)?.name).filter(Boolean);
    if (names.length) st.hooks?.banner?.(`New area: ${names.join(", ")}`);
  }
  return true;
}

/* Every frame: gates swing, debris falls apart. */
export function updateDoors(dt) {
  for (const d of st.doors) {
    if (!d.open || d.t >= 1) continue;
    d.t = Math.min(1, d.t + dt / OPEN_TIME);
    const e = 1 - Math.pow(1 - d.t, 3);
    if (d.kind === "gate") {
      for (const leaf of d.mesh.userData.leaves || []) leaf.rotation.y = leaf.userData.dir * e * 1.75;
    } else {
      d.mesh.children.forEach((c, i) => {
        c.position.y -= dt * (1.5 + (i % 3)) * e;
        c.rotation.z += dt * ((i % 2) - 0.5) * 2;
      });
      d.mesh.scale.y = Math.max(0.01, 1 - e);
      if (d.t >= 1) d.mesh.visible = false;
    }
  }
}

/* The closed door you're standing at, on its open side. */
export function nearDoor() {
  const p = game.player, feet = game.move?.pos;
  if (!feet || !p?.alive || p.downed) return null;
  let best = null, bestD = REACH;
  for (const d of st.doors) {
    if (d.open || Math.abs(feet.y - d.y) > 1.4) continue;
    const dx = feet.x - d.mid.x, dz = feet.z - d.mid.z;
    const along = dx * d.u.x + dz * d.u.z;
    if (Math.abs(along) > d.len / 2 + 0.4) continue;
    const off = Math.abs(dx * d.u.z - dz * d.u.x);
    if (off < bestD) { bestD = off; best = d; }
  }
  return best;
}

export function doorOffer(d) {
  return { kind: "door", name: d.label, price: d.price };
}

/* Hold X done at door `d`. */
export function buyDoor(d) {
  if (!d || d.open || !game.player.alive || game.player.downed) return false;
  if (!spend(d.price)) { game.audio.zombieBuy?.(false); return false; }
  st.n++;
  openDoor(d.id);
  send({ o: d.id });
  return true;
}

/* ------------------------------------------------------------ the wire */

function send(m) {
  const net = game.net;
  if (!net?.connected) return;
  m.t = "zD";
  m.id = net.id;
  net.send(m);
}

/* net.js -> run.js: a "zD" message, or a joiner's "zq" (the host answers
   with every open door). */
export function onDoorMessage(p, m) {
  if (m.t === "zq") {
    const net = game.net;
    if (net?.connected && net.hostId() === net.id) {
      const all = st.doors.filter((d) => d.open).map((d) => d.id);
      if (all.length) send({ all });
    }
    return;
  }
  if (m.o != null) openDoor(String(m.o));
  else if (Array.isArray(m.all)) for (const id of m.all) openDoor(String(id), true);
}

/* ------------------------------------------------------------ the run */

/* `hooks`: { banner(text) }. */
export function startDoors(hooks = {}) {
  clearDoors();
  st.hooks = hooks;
  const name = game.builtMap?.map?.name;
  st.map = name;
  const data = ZOMBIE_BUYS[name] || {};
  st.areas = (data.areas || []).map((a) => ({ ...a }));
  for (const a of st.areas) if (a.start) st.open.add(a.id);
  st.doors = (data.doors || []).map(buildDoor);   // first: the fences leave their gaps
  for (const f of data.fences || []) {
    const y = f.y ?? 0;
    const spans = openSpans(f.a[0], f.a[1], f.b[0], f.b[1], y);
    const cols = spans.flatMap(([ax, az, bx, bz]) => lineColliders(ax, az, bx, bz, y, { zfence: true }));
    addColliders(cols);
    // "boards": planks across a doorway (a span under DOORWAY: the line's
    // gap is the frame's inside less a margin, so they reach over it), crates
    // and planks across open ground; "invisible": a window shut with no
    // pane drawn (nothing in front of it, CLAUDE.md rule 9); else iron
    const mesh = f.kind === "boards"
      ? (() => {
        const g = new THREE.Group();
        spans.forEach((s, i) => {
          const len = Math.hypot(s[2] - s[0], s[3] - s[1]);
          g.add(len < DOORWAY ? planks(...s, y, 3 + i, 0.75) : barricade(...s, y, 3 + i));
        });
        return g;
      })()
      : f.kind === "invisible" ? new THREE.Group() : railing(spans, y);
    mesh.name = "zfence";
    game.scene.add(mesh);
    st.fences.push({ ...f, spans, cols, mesh });
  }
  if (game.zdir && st.areas.length) {
    // the map's own entry points, plus any the areas need (a start with no
    // edge to come in over: zombies rise out of the ground there)
    st.baseWindows = game.zdir.windows;
    st.allWindows = [...st.baseWindows, ...(data.spawns || []).map(([x, z]) => ({ x, y: 0, z, rise: true }))];
    applyWindows();
  }
  match.zombieDoors = { near: nearDoor, buy: buyDoor, offer: doorOffer };
}

export function clearDoors() {
  for (const d of st.doors) { dropColliders(d.cols); dispose(d.mesh); }
  for (const f of st.fences) { dropColliders(f.cols); dispose(f.mesh); }
  if (st.baseWindows && game.zdir) { game.zdir.windows = st.baseWindows; game.zdir.fields?.clear?.(); }
  st.doors = []; st.fences = []; st.areas = []; st.open.clear(); st.allWindows = st.baseWindows = null;
  match.zombieDoors = null;
}

function dispose(root) {
  root.parent?.remove(root);
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material && !o.material.userData?.shared) o.material.dispose?.();
  });
}

/* Tests (__trollOps.zrun().doors). */
export function doorsDebug() {
  return { st, areaOf, zoneOpen, openDoor, nearDoor, buyDoor, doorOffer };
}
