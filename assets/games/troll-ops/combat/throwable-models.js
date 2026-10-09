/* The throwables as objects you can see: a frag with its spoon and pin, a
   flashbang, a smoke can, the EMP. User, 2026-10-08: "you should see
   someones hand/arm when throwing a grenade. the pin being pulled too".

   buildThrowable(id, { pin }) gives a model standing up +Y with its base
   at the origin, about a real grenade's size (scaled up a third so it reads
   at game distances), the spoon (lever) down its +X side and, with `pin`,
   the pull ring on the -X side at the top. `userData.body` is the one mesh
   whose material may be tinted per grenade (the fuse blink); every other
   part shares a material. buildPin() / buildSpoon() are the loose pieces
   that come off in the throw. Primitives only (no download). */

import * as THREE from "three";

const S = 1.35;   // a third over life size, like the guns' readability scale
const M = {
  olive: new THREE.MeshStandardMaterial({ color: 0x4b5a32, roughness: 0.7, metalness: 0.15 }),
  oliveDark: new THREE.MeshStandardMaterial({ color: 0x323b22, roughness: 0.75, metalness: 0.15 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x9aa0a4, roughness: 0.35, metalness: 0.3 }),
  darkSteel: new THREE.MeshStandardMaterial({ color: 0x3a3e42, roughness: 0.45, metalness: 0.3 }),
  black: new THREE.MeshStandardMaterial({ color: 0x1c1d1f, roughness: 0.6, metalness: 0.2 }),
  smokeCan: new THREE.MeshStandardMaterial({ color: 0x5c6650, roughness: 0.65, metalness: 0.2 }),
  white: new THREE.MeshStandardMaterial({ color: 0xe8e6dc, roughness: 0.6 }),
  empBlue: new THREE.MeshStandardMaterial({ color: 0x2a3f6a, roughness: 0.45, metalness: 0.25 }),
  empGlow: new THREE.MeshStandardMaterial({ color: 0x8fd8ff, emissive: 0x5ad0ff, emissiveIntensity: 1.4, roughness: 0.3 }),
};
const BAND = { smoke: 0xd8d8d0, flash: 0x1c1d1f, frag: 0xd8b84a, emp: 0x5ad0ff };

/* the body's height (to the top of the fuse) per kind, before S */
const DIMS = {
  frag: { r: 0.032, body: 0.064, fuse: 0.03 },
  flash: { r: 0.024, body: 0.105, fuse: 0.028 },
  smoke: { r: 0.03, body: 0.11, fuse: 0.028 },
  emp: { r: 0.03, body: 0.07, fuse: 0.024 },
};

function mesh(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}

/* The pull ring and its pin, in the frame of the grenade's top: the pin
   runs through the fuse along Z, the ring hangs off the -X side. */
export function buildPin() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.TorusGeometry(0.012 * S, 0.0018 * S, 6, 16), M.steel, -0.016 * S, 0, 0, 0, Math.PI / 2, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.0013 * S, 0.0013 * S, 0.026 * S, 5), M.steel, -0.004 * S, 0, 0, 0, 0, Math.PI / 2));
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}

/* The spoon: a strip down the +X side from the fuse to near the base. */
export function buildSpoon(kind = "frag") {
  const d = DIMS[kind] || DIMS.frag;
  const g = new THREE.Group();
  const len = (d.body * 0.8 + d.fuse * 0.5) * S;
  g.add(mesh(new THREE.BoxGeometry(0.004 * S, len, 0.012 * S), M.oliveDark, 0, -len / 2, 0, 0, 0, 0.12));
  g.add(mesh(new THREE.BoxGeometry(0.012 * S, 0.004 * S, 0.012 * S), M.oliveDark, -0.006 * S, 0, 0));
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}

/* `glow`: the body's own material (cloned per grenade by GrenadeSystem for
   the fuse blink), else the kind's plain one. */
export function buildThrowable(kind = "frag", { pin = false, spoon = true, glow = null } = {}) {
  const id = DIMS[kind] ? kind : "frag";
  const d = DIMS[id];
  const g = new THREE.Group();
  const r = d.r * S, bh = d.body * S, fh = d.fuse * S;
  let body;
  if (id === "frag") {
    // M67: a ball, a thin seam round its middle, the fuse well on top
    body = mesh(new THREE.SphereGeometry(r, 16, 12), glow || M.olive, 0, r, 0);
    g.add(mesh(new THREE.TorusGeometry(r * 1.0, 0.0012 * S, 4, 24), M.oliveDark, 0, r, 0, Math.PI / 2, 0, 0));
  } else if (id === "flash") {
    // M84: a perforated tube, black end caps
    body = mesh(new THREE.CylinderGeometry(r, r, bh, 14), glow || M.darkSteel, 0, bh / 2, 0);
    for (const y of [0.25, 0.5, 0.75]) g.add(mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.02, 0.006 * S, 14, 1, true), M.black, 0, bh * y, 0));
    g.add(mesh(new THREE.CylinderGeometry(r * 1.04, r * 1.04, 0.01 * S, 14), M.black, 0, 0.005 * S, 0));
  } else if (id === "smoke") {
    // M18: a plain can, a coloured band, a white stencil strip
    body = mesh(new THREE.CylinderGeometry(r, r, bh, 14), glow || M.smokeCan, 0, bh / 2, 0);
    g.add(mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.02, 0.014 * S, 14, 1, true), new THREE.MeshStandardMaterial({ color: BAND.smoke, roughness: 0.6 }), 0, bh * 0.82, 0));
    g.add(mesh(new THREE.BoxGeometry(0.002 * S, bh * 0.4, 0.02 * S), M.white, -r - 0.0008 * S, bh * 0.45, 0));
  } else {
    // EMP: a squared canister, a lit ring
    body = mesh(new THREE.BoxGeometry(r * 1.8, bh, r * 1.8), glow || M.empBlue, 0, bh / 2, 0);
    g.add(mesh(new THREE.CylinderGeometry(r * 0.7, r * 0.7, 0.008 * S, 14), M.empGlow, 0, bh + 0.002 * S, 0));
  }
  g.add(body);
  const top = id === "frag" ? r * 1.85 : bh;
  // the fuse (the striker housing) on top
  g.add(mesh(new THREE.CylinderGeometry(0.009 * S, 0.011 * S, fh, 10), M.darkSteel, 0, top + fh / 2, 0));
  if (spoon) {
    const sp = buildSpoon(id);
    sp.position.set((id === "emp" ? r * 0.95 : r) + 0.002 * S, top + fh * 0.8, 0);
    g.add(sp);
    g.userData.spoon = sp;
  }
  if (pin) {
    const p = buildPin();
    p.position.set(-0.004 * S, top + fh * 0.55, 0);
    g.add(p);
    g.userData.pin = p;
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  g.userData.body = body;
  g.userData.height = top + fh;
  g.userData.kind = id;
  return g;
}

/* The kind of model for a throwable def (gear.js THROWABLE_DEFS ids). */
export function modelKind(def) {
  const id = def?.id || "frag";
  return DIMS[id] ? id : def?.emp ? "emp" : def?.smoke ? "smoke" : def?.blind ? "flash" : "frag";
}
