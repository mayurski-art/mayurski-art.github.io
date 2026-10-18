// Troll Us web: turning exported Studio parts into three.js meshes. Shared by the map, the beans and the hats.
// Roblox and three.js agree on axes (+Y up, -Z forward, right-handed), so a part's frame [x,y,z,qx,qy,qz,qw]
// goes straight into a Matrix4. Sizes follow Roblox's rules: a cylinder runs along its X with the smaller of Y/Z
// as its diameter, and a ball is always a sphere of the smallest side.
import * as THREE from 'three';

export const GEOMETRY = {
  box: new THREE.BoxGeometry(1, 1, 1),
  // three's cylinder stands on Y; Roblox's lies along X
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 28).rotateZ(-Math.PI / 2),
  ball: new THREE.SphereGeometry(0.5, 18, 12), // most balls are stars and lamp bulbs: keep them light for phones
};

// Roblox draws Neon far brighter than its colour (a teal #28aa8c shows as near-cyan); colours are scaled by this
// in linear space before they reach the unlit material
export const NEON_GLOW = 2.4;

// what a Roblox material looks like here. Neon glows (unlit); Glass is see-through; metals catch a little light.
export function materialKind(part) {
  if (part.material === 'Neon') return 'neon';
  if (part.material === 'Glass' || (part.transparency || 0) > 0.02) return 'clear';
  if (part.material === 'Metal' || part.material === 'DiamondPlate') return 'metal';
  return 'plastic';
}

export function makeMaterial(kind, opts = {}) {
  switch (kind) {
    case 'neon': return new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, ...opts });
    case 'space': return new THREE.MeshBasicMaterial({ color: 0xffffff, ...opts }); // unlit, its own colour
    case 'metal': return new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.25, ...opts });
    case 'clear': return new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0, transparent: true, depthWrite: false, ...opts });
    default: return new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, metalness: 0, ...opts });
  }
}

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

// the part's world matrix, with its size folded in as scale
export function partMatrix(part, out = new THREE.Matrix4()) {
  const [x, y, z, qx, qy, qz, qw] = part.cf;
  const [sx, sy, sz] = part.size;
  _p.set(x, y, z); _q.set(qx, qy, qz, qw);
  if (part.shape === 'ball') { const d = Math.min(sx, sy, sz); _s.set(d, d, d); }
  else if (part.shape === 'cyl') { const d = Math.min(sy, sz); _s.set(sx, d, d); }
  else _s.set(sx, sy, sz);
  return out.compose(_p, _q, _s);
}

// a frame without the size (for children placed on a part, like signs)
export function frameMatrix(cf, out = new THREE.Matrix4()) {
  _p.set(cf[0], cf[1], cf[2]); _q.set(cf[3], cf[4], cf[5], cf[6]); _s.set(1, 1, 1);
  return out.compose(_p, _q, _s);
}

export function geometryFor(part) { return GEOMETRY[part.shape] || GEOMETRY.box; }

// one standalone mesh for a part (doors, see-through parts, bean pieces)
export function partMesh(part, materialCache) {
  const kind = materialKind(part);
  let mat;
  if (kind === 'clear') {
    // Roblox glass at 0.82 is barely there; under this page's strong ambient light the same opacity reads as a
    // grey veil, so glass keeps only 40% of what Studio leaves
    const opacity = 1 - Math.max(part.transparency || 0, part.material === 'Glass' ? 0.6 : 0);
    mat = makeMaterial('clear', { color: new THREE.Color(part.color), opacity: part.material === 'Glass' ? opacity * 0.4 : opacity });
  } else {
    const key = kind + part.color;
    mat = materialCache?.get(key);
    if (!mat) {
      const color = new THREE.Color(part.color);
      if (kind === 'neon') color.multiplyScalar(NEON_GLOW);
      mat = makeMaterial(kind, { color }); materialCache?.set(key, mat);
    }
  }
  const m = new THREE.Mesh(geometryFor(part), mat);
  partMatrix(part, m.matrix);
  m.matrix.decompose(m.position, m.quaternion, m.scale);
  m.name = part.name;
  return m;
}
