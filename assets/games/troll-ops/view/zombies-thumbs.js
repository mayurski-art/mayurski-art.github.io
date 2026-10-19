// Troll Forces Zombies: pictures for the kiosk cards (view/zombies-kiosk.js).
//
// The guns and the Rookie's deployables, drawn from the models the match
// uses: one small thumbnail WeaponInspector on a canvas parked off screen
// renders each one once, and the picture is kept as a data URL. One at a
// time, in the order asked for; the context is only made when the first
// kiosk opens.

import { WeaponInspector } from "../menu/inspector.js?v=hb1-nf-wst-ig1-sb2-if1-wb1-th2-ar1-ar2-cl1-fj1-zr9-zr10-zp1-sr1-or1-rt1";
import { buildWeaponMesh } from "../weapons/weapon-model.js?v=p5-em1-wst-hf1-wb1-ar1-ar2-fj1-br1-or1-rt1";
import { loadModel } from "../maps/battlefield-props.js?v=sr1-or1";
import { resolveWeapon, defaultLoadoutFor } from "../weapons/attachments.js?v=cg1-wst-sb2-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-or1";

const W = 320, H = 180;
const KIT_MODEL = { turret: "zk-turret", barricade: "zk-spikewall", barrel: "zk-barrel" };

const cache = new Map();   // key -> Promise<dataURL | null>
let insp = null;
let queue = Promise.resolve();

function inspector() {
  if (insp) return insp;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  c.setAttribute("aria-hidden", "true");
  c.style.cssText = `position:fixed;left:-10000px;top:0;width:${W}px;height:${H}px;pointer-events:none`;
  document.body.appendChild(c);
  insp = new WeaponInspector(c, { thumb: true });
  return insp;
}

/* Draw what `make()` returns (a mesh, or a promise of one) and keep it. */
function snap(key, make) {
  if (cache.has(key)) return cache.get(key);
  const p = queue = queue.then(async () => {
    try {
      const i = inspector();
      const mesh = await make();
      i.setMesh(mesh);
      i.tick(0);
      return i.canvas.toDataURL("image/png");
    } catch (e) {
      console.warn("[zombies] thumbnail", key, e);
      return null;
    }
  });
  cache.set(key, p);
  return p;
}

/* A gun's picture, as the match builds it (default attachments). */
export function gunThumb(id) {
  return snap(`gun:${id}`, () => {
    const mesh = buildWeaponMesh(resolveWeapon(id, defaultLoadoutFor(id)));
    // the first-person hands built onto a gun belong to the viewmodel
    mesh.traverse((o) => { if (o.userData.hand) o.visible = false; });
    return mesh;
  });
}

/* A Rookie deployable's picture (its glb). */
export function kitThumb(depId) {
  return snap(`kit:${depId}`, async () => {
    const obj = await loadModel(KIT_MODEL[depId], {});
    // a clone of the cached glb: never dispose its geometry on swap
    obj.traverse((o) => { if (o.geometry) o.geometry.userData.shared = true; if (o.material) for (const m of [].concat(o.material)) m.userData.shared = true; });
    obj.rotation.y = Math.PI * 0.85;
    return obj;
  });
}
