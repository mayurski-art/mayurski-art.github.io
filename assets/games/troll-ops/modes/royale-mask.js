// Troll Royale — the jumpmaster's oxygen mask, in first person (drop
// cinematic doc, phase 1). A military pilot's mask: a grey-green rubber cup
// with a black valve at the chin, a ribbed hose curling down out of view,
// and the head straps running back past the cheeks. Built from primitives
// like the streak devices, with grip anchors ({ right, left }) where the
// hands hold it, so view/streak-view.js hangs the arms on it.
//
// Local frame: the cup's open side faces +Z (the wearer's face, the
// camera); up is +Y; units are metres.

import * as THREE from "three";

let built = null;

export function oxygenMask() {
  if (built) return built;
  const g = new THREE.Group();
  const rubber = new THREE.MeshStandardMaterial({ color: 0x55604a, roughness: 0.82, metalness: 0.02 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x17191a, roughness: 0.6, metalness: 0.25 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x9a9c96, roughness: 0.35, metalness: 0.85 });
  const strap = new THREE.MeshStandardMaterial({ color: 0x2c2f27, roughness: 0.9 });

  // The cup: half an ellipsoid, open toward the face, a lip round its rim.
  const cupGeo = new THREE.SphereGeometry(1, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2);
  cupGeo.rotateX(-Math.PI / 2);          // the dome now bulges to -Z, open to +Z
  const cup = new THREE.Mesh(cupGeo, rubber);
  cup.scale.set(0.058, 0.07, 0.05);
  g.add(cup);
  // Its inside, near black: on the face, that's what you see of it, a dark
  // shape under your eyes with the olive rim round it.
  const inner = new THREE.Mesh(cupGeo, new THREE.MeshBasicMaterial({ color: 0x0a0b09, side: THREE.BackSide }));
  inner.scale.set(0.056, 0.068, 0.048);
  g.add(inner);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(1, 0.09, 8, 32), rubber);
  lip.scale.set(0.058, 0.07, 0.058);
  g.add(lip);
  // A moulded ridge down the nose, so the cup doesn't read as a bowl.
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.07, 0.02), rubber);
  ridge.position.set(0, 0.012, -0.061);   // on the outside of the dome, not through it
  ridge.rotation.x = 0.35;
  g.add(ridge);

  // The valve at the chin: a black puck with a steel ring.
  const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.026, 18), dark);
  valve.rotation.x = Math.PI / 2;
  valve.position.set(0, -0.026, -0.062);   // clear of the inside: it showed through on the face
  g.add(valve);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.023, 0.003, 6, 20), steel);
  ring.position.set(0, -0.026, -0.076);
  g.add(ring);

  // The hose: ribbed segments curling down and off to the left.
  const seg = new THREE.TorusGeometry(0.015, 0.0045, 6, 14);
  for (let i = 0; i < 14; i++) {
    const k = i / 13;
    const s = new THREE.Mesh(seg, dark);
    s.position.set(-0.03 * k * k, -0.04 - 0.16 * k, -0.07 - 0.03 * Math.sin(k * Math.PI));
    s.rotation.set(Math.PI / 2 - 1.1 * k, 0, 0.3 * k);
    g.add(s);
  }

  // Head straps back past the cheeks, and the bayonet clips they hook into.
  for (const sx of [-1, 1]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.016, 0.12), strap);
    band.position.set(sx * 0.06, 0.02, 0.05);
    band.rotation.y = sx * 0.25;
    g.add(band);
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.022, 0.016), steel);
    clip.position.set(sx * 0.058, 0.0, -0.004);
    g.add(clip);
  }

  // Where the hands hold it: the right on the cup's side, the left on the
  // other side, both a touch below the middle.
  const anchor = (x, inward) => {
    const a = new THREE.Object3D();
    a.position.set(x, -0.012, -0.012);
    a.userData.inward = inward;
    return a;
  };
  g.userData.anchors = { right: anchor(0.062, -1), left: anchor(-0.062, 1) };
  g.add(g.userData.anchors.right, g.userData.anchors.left);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  g.visible = false;
  built = g;
  return g;
}
