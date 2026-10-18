// Troll Us web: The Skeld, rebuilt from export/map.json.
// Static parts are drawn as instanced meshes, one per shape and look (about a dozen draw calls for ~1,800 parts).
// Parts that move or need their own material stay single meshes: the door panels (they drop from the ceiling)
// and anything see-through. Parts that are fully invisible in Studio (colliders, hidden task pads) are not drawn,
// but stay in the node list for collisions and game logic.
import * as THREE from 'three';
import { GEOMETRY, NEON_GLOW, materialKind, makeMaterial, partMatrix, partMesh } from './parts.js';
import { buildSigns } from './signs.js';

// top-level folder of a node ("Walls", "Decor", ...)
function topFolder(nodes, i) {
  let n = nodes[i];
  while (n.parent != null) { i = n.parent; n = nodes[i]; }
  return n.name;
}

export function buildMap(json) {
  const nodes = json.nodes;
  const group = new THREE.Group();
  group.name = 'Skeld';
  const materialCache = new Map();

  // sort parts into instanced batches (shape + material kind) and standalone meshes
  const batches = new Map();
  const doors = [];
  const standalone = new THREE.Group();
  standalone.name = 'Standalone';
  nodes.forEach((n, i) => {
    n.index = i;
    n.folder = topFolder(nodes, i);
    if (n.kind !== 'part') return;
    if ((n.transparency || 0) >= 0.98) return;
    let kind = materialKind(n);
    // the black behind each window is deep space, not a wall: no room light falls on it
    if (kind === 'plastic' && nodes[n.parent]?.name === 'Window' && new THREE.Color(n.color).getHSL({}).l < 0.05) kind = 'space';
    if (n.attrs?.OpenCF && n.attrs?.ShutCF) {
      const mesh = partMesh(n, materialCache);
      standalone.add(mesh);
      doors.push({ node: n, mesh, open: n.attrs.OpenCF, shut: n.attrs.ShutCF, door: nodes[n.parent] });
      return;
    }
    if (kind === 'clear') { standalone.add(partMesh(n, materialCache)); return; }
    const key = `${n.shape in GEOMETRY ? n.shape : 'box'}:${kind}`;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(n);
  });

  // Studio's room lights shine up into the dark ceilings and turn them mid-grey; with no point lights here the
  // ceiling colour itself is lifted to match (the lighting decision of 2026-10-18)
  const CEILING_LIFT = new THREE.Color('#555a66');
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  for (const [key, parts] of batches) {
    const [shape, kind] = key.split(':');
    const mesh = new THREE.InstancedMesh(GEOMETRY[shape], makeMaterial(kind), parts.length);
    mesh.name = key;
    parts.forEach((p, k) => {
      mesh.setMatrixAt(k, partMatrix(p, m4));
      col.set(p.color);
      if (p.folder === 'Ceiling' && kind !== 'neon') col.lerp(CEILING_LIFT, 0.85);
      if (kind === 'neon') col.multiplyScalar(NEON_GLOW);
      mesh.setColorAt(k, col);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  group.add(standalone);
  group.add(buildSigns(nodes));

  // the tagged points later steps use
  const pads = nodes.filter((n) => n.kind === 'part' && n.attrs?.Task && n.attrs?.TaskId != null);
  const vents = nodes.filter((n) => n.kind === 'part' && n.folder === 'Vents' && n.attrs?.Group != null);
  const rooms = nodes.filter((n) => n.kind === 'part' && n.folder === 'Rooms');
  const halls = nodes.filter((n) => n.kind === 'part' && n.folder === 'Halls');

  return { group, nodes, doors, pads, vents, rooms, halls, batches: batches.size };
}
