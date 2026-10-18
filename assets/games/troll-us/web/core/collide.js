// Troll Us web: the floor plan you bump into. The Skeld is flat (every floor at y 0), so collisions are 2D: the
// bean is a circle on the floor and every solid part that reaches into the bean's height becomes a shape on the
// plan. Upright boxes keep their turn (a rotated rectangle), upright cylinders and balls become circles, and a
// part tipped any other way falls back to the rectangle round its corners.
// the bean's root collider spans y 1.0 to 4.6 (HipHeight 1); its Humanoid steps up onto anything a little above
// that (stools, task pads, vent covers), and anything starting above 4.6 is over its head
export const STEP_HEIGHT = 1.5;
export const BEAN_HEIGHT = 4.6;

// parts low enough to walk over (task pads, vent covers, floors) and parts above your head (door lintels,
// ceilings) are not walls. The door panels are left out until doors can shut (step 5).
function blocks(lo, hi) { return hi > STEP_HEIGHT && lo < BEAN_HEIGHT; }

function axes(q) {
  const [x, y, z, w] = q;
  // columns of the rotation matrix: the part's own X, Y and Z in world space
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y + w * z), 2 * (x * z - w * y)],
    [2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x)],
    [2 * (x * z + w * y), 2 * (y * z - w * x), 1 - 2 * (x * x + y * y)],
  ];
}

const UPRIGHT = 0.985; // an axis this close to world Y counts as standing straight up

function shapeFor(n) {
  const [cx, cy, cz] = n.cf;
  let [sx, sy, sz] = n.size;
  if (n.shape === 'ball') {
    const r = Math.min(sx, sy, sz) / 2;
    return blocks(cy - r, cy + r) ? { kind: 'circle', x: cx, z: cz, r, name: n.name } : null;
  }
  if (n.shape === 'cyl') { const d = Math.min(sy, sz); sy = d; sz = d; }
  const ax = axes(n.cf.slice(3));
  const half = [sx / 2, sy / 2, sz / 2];
  // height range from the part's corners
  const ext = (k) => Math.abs(ax[0][k]) * half[0] + Math.abs(ax[1][k]) * half[1] + Math.abs(ax[2][k]) * half[2];
  const ey = ext(1);
  if (!blocks(cy - ey, cy + ey)) return null;
  const up = ax.findIndex((a) => Math.abs(a[1]) > UPRIGHT);
  if (n.shape === 'cyl' && up === 0) return { kind: 'circle', x: cx, z: cz, r: half[1], name: n.name };
  if (up >= 0) {
    // the two axes that lie flat give the rectangle
    const [i, j] = [0, 1, 2].filter((k) => k !== up);
    const ux = ax[i][0], uz = ax[i][2], ul = Math.hypot(ux, uz) || 1;
    return { kind: 'box', x: cx, z: cz, ux: ux / ul, uz: uz / ul, hu: half[i], hv: half[j], name: n.name };
  }
  return { kind: 'box', x: cx, z: cz, ux: 1, uz: 0, hu: ext(0), hv: ext(2), name: n.name };
}

export function buildColliders(nodes) {
  const shapes = [];
  for (const n of nodes) {
    if (n.kind !== 'part' || !n.collide) continue;
    if (n.folder === 'Rooms' || n.folder === 'Halls' || n.folder === 'Ceiling') continue;
    const s = shapeFor(n);
    if (!s) continue;
    // a bounding radius, so far shapes are skipped cheaply
    s.br = s.kind === 'circle' ? s.r : Math.hypot(s.hu, s.hv);
    shapes.push(s);
  }
  return shapes;
}

// push a circle (x, z, r) out of every shape it overlaps. A few passes settle corners where two walls meet; the
// circle slides along walls because only the overlapping part of each move is undone.
export function resolve(shapes, p, r, passes = 6) {
  for (let pass = 0; pass < passes; pass++) {
    let moved = false;
    for (const s of shapes) {
      const dx = p.x - s.x, dz = p.z - s.z;
      const reach = s.br + r;
      if (dx * dx + dz * dz > reach * reach) continue;
      if (s.kind === 'circle') {
        const d = Math.hypot(dx, dz), min = s.r + r;
        if (d >= min) continue;
        const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0;
        p.x = s.x + nx * min; p.z = s.z + nz * min; moved = true;
        continue;
      }
      // into the box's own frame: u along its first flat axis, v along the other
      const u = dx * s.ux + dz * s.uz, v = -dx * s.uz + dz * s.ux;
      const cu = Math.max(-s.hu, Math.min(s.hu, u)), cv = Math.max(-s.hv, Math.min(s.hv, v));
      let ou = u - cu, ov = v - cv;
      const d2 = ou * ou + ov * ov;
      if (d2 >= r * r) continue;
      let nu, nv, push;
      if (d2 > 1e-10) {
        const d = Math.sqrt(d2); nu = ou / d; nv = ov / d; push = r - d;
      } else {
        // centre inside the box: leave by the nearest side
        const pu = s.hu - Math.abs(u), pv = s.hv - Math.abs(v);
        if (pu < pv) { nu = Math.sign(u) || 1; nv = 0; push = pu + r; } else { nu = 0; nv = Math.sign(v) || 1; push = pv + r; }
      }
      p.x += (nu * s.ux - nv * s.uz) * push;
      p.z += (nu * s.uz + nv * s.ux) * push;
      moved = true;
    }
    if (!moved) break;
  }
  return p;
}
