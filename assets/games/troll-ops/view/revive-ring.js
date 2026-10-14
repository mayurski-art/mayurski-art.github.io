// Zombie Rush co-op (P7): a ring on the ground round each downed teammate,
// pulsing red; hold X on one and it fills green round the dial until they're
// up (modes/zombies/coop.js updateRevive drives it).

import * as THREE from "three";
import { game } from "../core/state.js?v=st1";

const SEG = 48;
const IN = 0.82, OUT = 1.0;
const rings = new Map();   // teammate id -> { g, base, fill, k }
let reach = false;   // a downed teammate close enough to hold X on

function make() {
  const g = new THREE.Group();
  const mat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
  const base = new THREE.Mesh(new THREE.RingGeometry(IN, OUT, SEG), mat(0xff3b2b, 0.5));
  const fill = new THREE.Mesh(new THREE.RingGeometry(IN - 0.04, OUT + 0.05, SEG), mat(0x5cff7a, 0.9));
  base.rotation.x = fill.rotation.x = -Math.PI / 2;
  base.renderOrder = 5; fill.renderOrder = 6;
  fill.visible = false;
  g.add(base, fill);
  game.scene.add(g);
  return { g, base, fill, k: 0 };
}

/* `downed`: [{ id, x, y, z }] (feet); `revive`: coop.revive ({ id, t }) or null. */
export function updateReviveRings(downed, revive, reviveTime) {
  reach = !!revive;
  const seen = new Set();
  const pulse = 0.38 + 0.18 * Math.sin(performance.now() / 160);
  for (const p of downed) {
    seen.add(p.id);
    let r = rings.get(p.id);
    if (!r) { r = make(); rings.set(p.id, r); }
    r.g.visible = true;
    r.g.position.set(p.x, p.y + 0.05, p.z);
    r.base.material.opacity = pulse;
    const k = revive && revive.id === p.id ? Math.min(1, revive.t / reviveTime) : 0;
    const q = Math.round(k * 60) / 60;
    if (q !== r.k) {
      r.k = q;
      r.fill.visible = q > 0;
      if (q > 0) {
        r.fill.geometry.dispose();
        // from twelve o'clock round, as seen from above
        r.fill.geometry = new THREE.RingGeometry(IN - 0.04, OUT + 0.05, SEG, 1, Math.PI / 2, -q * Math.PI * 2);
      }
    }
  }
  for (const [id, r] of rings) if (!seen.has(id)) { r.g.visible = false; r.k = -1; }
}

export function clearReviveRings() {
  for (const r of rings.values()) {
    game.scene?.remove(r.g);
    r.base.geometry.dispose(); r.fill.geometry.dispose();
    r.base.material.dispose(); r.fill.material.dispose();
  }
  rings.clear();
  reach = false;
}

/* X (the touch swap button) is the revive while one is in reach: no weapon swap then (combat/weapons.js). */
export const reviveInReach = () => reach;

/* Tests: what's showing. */
export const reviveRingState = () => [...rings].map(([id, r]) => ({ id, visible: r.g.visible, k: r.k }));
