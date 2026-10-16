// Troll Forces — map edges that aren't rectangles.
//
// Most maps stop at a wall inside a rectangle (map.bounds). Trollface Island
// stops at a coastline: `map.edge` is its outline as [[x, z], ...], and
// everything that walks (you, bots) is kept inside it by clampInsidePolygon
// rather than by hundreds of little collider boxes along the coast, which
// every collision check would then have to scan. `map.wade` works the same
// way for the shallow lake: inside it you wade (slower, no sprint).

/* Even-odd point-in-polygon. */
export function insidePolygon(poly, x, z) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/* Keep a circle of `radius` at `pos` ({x, z}) inside `poly`: out past an
   edge, or closer to it than `radius`, and it's pushed back in along the
   nearest edge's inward normal. Returns true if it moved. */
export function clampInsidePolygon(pos, poly, radius = 0) {
  const inside = insidePolygon(poly, pos.x, pos.z);
  let bestD2 = Infinity, bx = 0, bz = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j], [cx, cz] = poly[i];
    const ex = cx - ax, ez = cz - az;
    const len2 = ex * ex + ez * ez || 1;
    const t = Math.max(0, Math.min(1, ((pos.x - ax) * ex + (pos.z - az) * ez) / len2));
    const px = ax + ex * t, pz = az + ez * t;
    const d2 = (pos.x - px) ** 2 + (pos.z - pz) ** 2;
    if (d2 < bestD2) { bestD2 = d2; bx = px; bz = pz; }
  }
  const d = Math.sqrt(bestD2);
  if (inside && d >= radius) return false;
  // Direction from the edge point back into the polygon.
  let nx = pos.x - bx, nz = pos.z - bz;
  const n = Math.hypot(nx, nz);
  if (n < 1e-6) return false;
  nx /= n; nz /= n;
  if (!inside) { nx = -nx; nz = -nz; }
  pos.x = bx + nx * radius;
  pos.z = bz + nz * radius;
  return true;
}
