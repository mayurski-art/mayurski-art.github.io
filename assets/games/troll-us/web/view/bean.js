// Troll Us web: a Crewmate, rebuilt from export/rig.json, wearing a hat from export/hats.json, and the waddle
// ported from Studio's client.luau. The joints work the way Roblox Motor6Ds do: part1 sits at
// part0 * C0 * Transform * C1⁻¹, and the waddle writes only the Transform, so the same numbers bend the same way.
import * as THREE from 'three';
import { NEON_GLOW, materialKind, makeMaterial, partMatrix, frameMatrix, geometryFor } from './parts.js?v=tu-4b1';

// the rig was exported in Red: parts in exactly that colour take the suit, the rest keep their own
const RIG_SUIT = '#c51111';
// Studio's waddle (client.luau)
const STEP_HZ = 2.4, LEG_SWING = 0.9, BOB = 0.16, LEAN = 0.08;

const materials = new Map();
function material(kind, hex) {
  const key = kind + hex;
  let m = materials.get(key);
  if (!m) {
    const color = new THREE.Color(hex);
    if (kind === 'neon') color.multiplyScalar(NEON_GLOW);
    m = makeMaterial(kind, { color });
    materials.set(key, m);
  }
  return m;
}

// a part's shape and size around its own origin
function partShape(part, hex) {
  const mesh = new THREE.Mesh(geometryFor(part), material(materialKind(part), hex));
  partMatrix({ ...part, cf: [0, 0, 0, 0, 0, 0, 1] }, mesh.matrix);
  mesh.matrixAutoUpdate = false;
  return mesh;
}

function fixed(obj, m) { obj.matrix.copy(m); obj.matrixAutoUpdate = false; return obj; }

// the trollface decal: Roblox fits it to the round cap (a square the cap's diameter wide), checked against a
// Studio screenshot of the same bean
let faceTex = null;
function faceDecal(face) {
  faceTex ??= new THREE.TextureLoader().load('assets/games/troll-us/web/art/trollface.png?v=tu-4d1', (t) => { t.colorSpace = THREE.SRGBColorSpace; });
  faceTex.colorSpace = THREE.SRGBColorSpace;
  const r = Math.min(face.size[1], face.size[2]) / 2;
  const geo = new THREE.CircleGeometry(r, 40);
  const uv = geo.attributes.uv, pos = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + pos.getX(i) / (2 * r), 0.5 + pos.getY(i) / (2 * r));
  // the circle faces +Z; the cap (Roblox's Right face) is the part's +X end
  geo.rotateY(Math.PI / 2);
  geo.translate(face.size[0] / 2 + 0.01, 0, 0);
  const mat = new THREE.MeshStandardMaterial({ map: faceTex, transparent: true, roughness: 0.72, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2 });
  return new THREE.Mesh(geo, mat);
}

export function suitHex(name, rules) { return rules?.suitColors?.[name] || RIG_SUIT; }

function paint(part, suit) {
  const shade = part.attrs?.SuitShade;
  if (shade === 0) return part.color;
  if (shade) return '#' + new THREE.Color(suit).multiplyScalar(shade).getHexString();
  return part.color.toLowerCase() === RIG_SUIT ? suit : part.color;
}

// rig: export/rig.json; hats: export/hats.json; suit: a hex colour; hat: a name or null
export function buildBean(rig, { suit = RIG_SUIT, hat = null, hats = null } = {}) {
  const group = new THREE.Group();
  group.name = 'Bean';
  const objs = [];
  // joints name their parts by node index (the decal under the face is a node too)
  const byIndex = new Map(rig.nodes.map((n, i) => [i, n]).filter(([, n]) => n.kind === 'part'));
  // the root sits where it is in the rig; its children are placed by the joints
  const root = fixed(new THREE.Object3D(), frameMatrix(byIndex.get(0).cf));
  root.name = 'HumanoidRootPart';
  group.add(root);
  objs[0] = root;
  const joints = {};
  const m4 = new THREE.Matrix4();
  for (const j of rig.joints) {
    const pivot = fixed(new THREE.Object3D(), frameMatrix(j.c0));
    const anim = new THREE.Object3D(); // the Transform: what the waddle moves
    const child = fixed(new THREE.Object3D(), m4.copy(frameMatrix(j.c1)).invert());
    child.name = byIndex.get(j.part1).name;
    objs[j.part0].add(pivot); pivot.add(anim); anim.add(child);
    objs[j.part1] = child;
    joints[j.name] = anim;
  }
  for (const [k, n] of byIndex) {
    if ((n.transparency || 0) >= 0.98) continue;
    objs[k].add(partShape(n, paint(n, suit)));
    if (n.name === 'Face') objs[k].add(faceDecal(n));
  }
  // the hat: each piece placed in the dome's frame
  const def = hat && hats?.hats.find((h) => h.name === hat);
  const dome = objs[[...byIndex].find(([, n]) => n.name === 'Dome')?.[0]];
  if (def && dome) {
    for (const p of def.parts) {
      const holder = fixed(new THREE.Object3D(), frameMatrix(p.cf));
      holder.add(partShape(p, p.color));
      dome.add(holder);
    }
  }
  return { group, joints, waddle: { phase: 0, idle: 0 } };
}

const _q = new THREE.Quaternion(), _e = new THREE.Euler();
function setTransform(obj, x, y, z, rx, ry, rz) {
  if (!obj) return;
  obj.position.set(x, y, z);
  // Roblox CFrame.Angles(rx, ry, rz) turns X, then Y, then Z, applied right to left: three's 'XYZ' order
  _e.set(rx, ry, rz, 'XYZ');
  obj.quaternion.setFromEuler(_e);
}

// speed: 0..1 of walking pace. Returns true on a footfall (for sounds later).
export function waddle(bean, dt, speed) {
  const st = bean.waddle, J = bean.joints;
  if (speed > 0.05) {
    const before = Math.floor(st.phase / Math.PI);
    st.phase += dt * STEP_HZ * Math.PI * 2 * speed;
    const s = Math.sin(st.phase);
    setTransform(J.LegLJoint, 0, 0, 0, s * LEG_SWING, 0, 0);
    setTransform(J.LegRJoint, 0, 0, 0, -s * LEG_SWING, 0, 0);
    // CFrame.new(0, |s| * BOB, 0) * CFrame.Angles(0, 0, s * LEAN)
    setTransform(J.Root, 0, Math.abs(s) * BOB, 0, 0, 0, s * LEAN);
    setTransform(J.PackJoint, 0, 0, 0, -Math.abs(s) * 0.08, 0, 0);
    st.idle = 0;
    return Math.floor(st.phase / Math.PI) !== before && speed > 0.3;
  }
  st.idle += dt;
  const k = Math.min(1, dt * 8);
  for (const name of ['LegLJoint', 'LegRJoint', 'PackJoint']) {
    const o = J[name]; if (!o) continue;
    o.position.lerp(new THREE.Vector3(), k);
    o.quaternion.slerp(_q.identity(), k);
  }
  const r = J.Root;
  if (r) {
    r.position.lerp(new THREE.Vector3(0, 0.04 * Math.sin(st.idle * 2.2), 0), k);
    r.quaternion.slerp(_q.identity(), k);
  }
  return false;
}
