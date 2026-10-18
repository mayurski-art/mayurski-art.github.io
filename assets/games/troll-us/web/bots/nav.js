// Troll Us web: the bots' map. Studio walks bots with Roblox pathfinding; here it is a grid over the floors
// (1 stud cells), each cell open when a bean padded to the bot's agent radius fits there, and A* on it. Paths are
// pulled tight afterwards so bots walk straight lines across rooms instead of stair-stepping between cells.
import { BEAN_RADIUS } from '../core/collide.js?v=tu-4d1';

const CELL = 1;
export const AGENT_RADIUS = 1.6; // a little more room than the bean's 1.3, like Studio's AgentRadius padding

function clearOf(shapes, x, z, r) {
  for (const s of shapes) {
    const dx = x - s.x, dz = z - s.z;
    const reach = s.br + r;
    if (dx * dx + dz * dz > reach * reach) continue;
    if (s.kind === 'circle') { if (Math.hypot(dx, dz) < s.r + r) return false; continue; }
    const u = dx * s.ux + dz * s.uz, v = -dx * s.uz + dz * s.ux;
    const ou = Math.max(0, Math.abs(u) - s.hu), ov = Math.max(0, Math.abs(v) - s.hv);
    if (ou * ou + ov * ov < r * r) return false;
  }
  return true;
}

export function buildNav(map, shapes) {
  const floors = [...map.rooms, ...map.halls].map((n) => ({
    x0: n.cf[0] - n.size[0] / 2, x1: n.cf[0] + n.size[0] / 2, z0: n.cf[2] - n.size[2] / 2, z1: n.cf[2] + n.size[2] / 2,
  }));
  const x0 = Math.floor(Math.min(...floors.map((f) => f.x0))), x1 = Math.ceil(Math.max(...floors.map((f) => f.x1)));
  const z0 = Math.floor(Math.min(...floors.map((f) => f.z0))), z1 = Math.ceil(Math.max(...floors.map((f) => f.z1)));
  const w = Math.round((x1 - x0) / CELL), h = Math.round((z1 - z0) / CELL);
  const open = new Uint8Array(w * h); // 2 = roomy (agent radius), 1 = a bean just fits, 0 = shut
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = x0 + (i + 0.5) * CELL, z = z0 + (j + 0.5) * CELL;
    if (!floors.some((f) => x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1)) continue;
    if (clearOf(shapes, x, z, AGENT_RADIUS)) open[j * w + i] = 2;
    else if (clearOf(shapes, x, z, BEAN_RADIUS + 0.05)) open[j * w + i] = 1;
  }
  return { x0, z0, w, h, open, shapes };
}

const cellOf = (nav, x, z) => [Math.floor((x - nav.x0) / CELL), Math.floor((z - nav.z0) / CELL)];
const centre = (nav, i, j) => [nav.x0 + (i + 0.5) * CELL, nav.z0 + (j + 0.5) * CELL];
const isOpen = (nav, i, j) => i >= 0 && j >= 0 && i < nav.w && j < nav.h && nav.open[j * nav.w + i] > 0;

// the open cell nearest a point (task pads sit against consoles, so the pad itself is often shut)
export function nearestOpen(nav, x, z, maxR = 6) {
  const [ci, cj] = cellOf(nav, x, z);
  let best = null, bd = Infinity;
  for (let r = 0; r <= maxR; r++) {
    for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
      if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r || !isOpen(nav, i, j)) continue;
      const [cx, cz] = centre(nav, i, j);
      // prefer roomy cells: a tight one costs a little extra
      const d = Math.hypot(cx - x, cz - z) + (nav.open[j * nav.w + i] === 1 ? 0.75 : 0);
      if (d < bd) { bd = d; best = [i, j]; }
    }
    if (best && r >= 1) break;
  }
  return best;
}

// straight walk from a to b stays on open cells (sampled every quarter cell, padded by the bean's own width)
export function lineOpen(nav, ax, az, bx, bz) {
  const d = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(d / (CELL * 0.25)));
  for (let k = 0; k <= n; k++) {
    const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    const [i, j] = cellOf(nav, x, z);
    if (!isOpen(nav, i, j)) return false;
  }
  return true;
}

// A* from (fx, fz) to (tx, tz): a list of [x, z] waypoints, or null
export function findPath(nav, fx, fz, tx, tz) {
  const s = nearestOpen(nav, fx, fz), g = nearestOpen(nav, tx, tz);
  if (!s || !g) return null;
  const { w, h, open } = nav;
  const N = w * h, start = s[1] * w + s[0], goal = g[1] * w + g[0];
  const gs = new Float64Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const heap = []; // [f, index]
  const push = (f, i) => { heap.push([f, i]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
  const gx = g[0], gz = g[1];
  const hfn = (i, j) => { const dx = Math.abs(i - gx), dz = Math.abs(j - gz); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  gs[start] = 0; push(hfn(s[0], s[1]), start);
  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  while (heap.length) {
    const [, cur] = pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const ci = cur % w, cj = (cur / w) | 0;
    for (const [di, dj, cost] of DIRS) {
      const ni = ci + di, nj = cj + dj;
      if (!isOpen(nav, ni, nj) || closed[nj * w + ni]) continue;
      if (di && dj && (!isOpen(nav, ci + di, cj) || !isOpen(nav, ci, cj + dj))) continue; // no cutting corners
      const n = nj * w + ni;
      // tight cells cost more, so bots keep to the middle of halls like Studio's padded agents
      const ng = gs[cur] + cost * (open[n] === 1 ? 3 : 1);
      if (ng < gs[n]) { gs[n] = ng; came[n] = cur; push(ng + hfn(ni, nj), n); }
    }
  }
  if (came[goal] < 0 && goal !== start) return null;
  const cells = [];
  for (let c = goal; c >= 0 && cells.length <= N; c = came[c]) { cells.push(centre(nav, c % w, (c / w) | 0)); if (c === start) break; }
  cells.reverse();
  // pull it tight: skip every waypoint the bot can see past
  const out = [[fx, fz]];
  let k = 0;
  while (k < cells.length - 1) {
    let far = k + 1;
    const [ax, az] = out[out.length - 1];
    while (far + 1 < cells.length && lineOpen(nav, ax, az, cells[far + 1][0], cells[far + 1][1])) far++;
    out.push(cells[far]); k = far;
  }
  if (out.length > 1 || cells.length) out.shift(); // the bot is already where it starts
  return out.length ? out : [cells[cells.length - 1]];
}
