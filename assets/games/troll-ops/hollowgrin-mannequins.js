// Troll Forces — Hollowgrin's mannequins: Nuketown-style people frozen mid-
// moment round the map (models/build_mannequins.blender.py -> mq-*.glb).
//
// The chapel: the priest blessing a man begging on his knees at the rail,
// two more in the pews. Trick-or-Treat Lane: a 60s mom with the candy bowl
// on her porch, kids at the gates as a sheet ghost, a witch, a skeleton and
// a pumpkin, dad with the flashlight, a dachshund in a hot-dog bun, a dog
// asleep on a porch, a black cat up on a fence. The fair: a couple on a
// bench by the fountain, a kid with cotton candy, the corn-dog man, the
// Ferris wheel's attendant. The village: the candy shop's owner behind her
// counter, the farmer out in the pumpkin patch.
//
// They don't move and don't fall over; they stop bullets (each person has
// a collider, people-sized, pen 6). Pets are too small to bother.
//
// Placed like the chapel module: hollowgrin.js passes nightFx in (H), so
// this file never imports that module back.

import { loadModel } from "./battlefield-props.js";

const W = -Math.PI / 2, E = Math.PI / 2, N = Math.PI, S = 0;   // facing: west (-x), east (+x), N = -z (toward the manor), S = +z (toward the lane's houses)

// [name, x, y, z, facing, collider [w, d, h] or null, collider centre offset
// [dx, dz] in map axes]. In the chapel the two colliders run on to the
// walls, the apse and the pews: any gap behind a figure narrower than a
// zombie's 1.7 m would be a pocket only players could stand in.
export const MANNEQUINS = [
  // the chapel (hollowgrin-chapel.js): chancel at y 0.3 west of x -47.9, rail at x -47.35
  ["priest", -48.25, 0.3, 5.15, E, [1.65, 1.6, 1.9], [-0.475, 0.45]],
  ["beggar", -46.95, 0, 5.55, W, [1.7, 1.5, 1.35], [0.5, 0.1]],
  ["pew_woman", -44.27, 0, -0.5, W, null],
  ["pew_man", -41.12, 0, 4.4, W, null],
  // Trick-or-Treat Lane: porches at z 38.4..39.8 (deck 0.3), gates at x = mid, fence z 36.95
  ["mom", 16.7, 0.3, 38.95, N, [0.6, 0.6, 1.75]],
  ["kid_ghost", 15.0, 0, 36.25, S, [0.75, 0.75, 1.3]],
  ["kid_witch", 17.05, 0, 36.3, S, [0.5, 0.5, 1.45]],
  ["dad", 13.4, 0, 36.05, Math.atan2(0.6, 1), [0.6, 0.6, 1.85]],
  ["kid_skeleton", -17.0, 0, 36.25, S, [0.5, 0.5, 1.35]],
  ["kid_pumpkin", -14.95, 0, 36.3, S, [0.6, 0.6, 1.2]],
  ["dachshund", -14.1, 0, 35.9, Math.atan2(0.6, 1), null],
  ["porchdog", 26.6, 0.3, 39.2, N, null],
  ["cat", -29.4, 0.86, 36.95, N, null],
  // the fair: a bench on the fountain's north side (plaza centre 63, 2.5, r 7.3)
  ["bench_woman", 62.62, 0, 9.85, N, [0.55, 0.7, 1.3]],
  ["bench_man", 63.38, 0, 9.85, N, [0.55, 0.7, 1.35]],
  ["kid_candy", 68.4, 0, -6.9, S, [0.5, 0.5, 1.45]],
  ["vendor", 71.0, 0, -9.3, S, [0.6, 0.6, 1.8]],
  ["attendant", 75.9, 0, 5.75, W, [0.6, 0.6, 1.85]],
  // the village
  ["shopkeeper", -8.4, 0, 26.1, N, [0.6, 0.6, 1.7]],
  ["farmer", 23.5, 0, 6.3, Math.atan2(-23.5, -5.3), [0.7, 0.7, 1.85]],
];

export function placeMannequins(api, H) {
  const { nightFx } = H;
  for (const [name, x, y, z, ry, box, off = [0, 0]] of MANNEQUINS) {
    if (box) api.ghostBox(x + off[0], z + off[1], box[0], box[1], box[2], { y, pen: 6 });
    loadModel(`mq-${name}`, {}).then((obj) => {
      obj.position.set(x, y, z);
      obj.rotation.y = ry;
      obj.traverse((n) => {
        if (!n.isMesh) return;
        const m = n.material;
        // one baked atlas: hair, brows and lashes cut out of it, the rest opaque
        m.transparent = false;
        m.alphaTest = 0.5;
        m.depthWrite = true;
        if (m.map) m.map.anisotropy = 4;
        nightFx(m);
      });
      api.prop(obj);
    }).catch((e) => console.warn("mannequin", name, e));
  }
}
