// Troll Forces — Troll City's Studio town (doc "Troll City redesign in
// Roblox Studio"). The town is laid out in Roblox Studio
// (studio/trollcity) and comes back as two files, written by
// tools/troll-ops-map-from-studio.mjs:
//   models/tc-town.glb      every still piece, in world metres, one mesh per
//                           material: named "<key>|<tint>|<shadow>", where
//                           key is the Kit's material key (trollcity-kit.js
//                           matKey), tint a vertex colour ("" = none) and
//                           shadow 1 or 0
//   trollcity-layout.js     the still colliders, [x, z, w, d, h, y, pen]
// The town's builders still run (they keep the live pieces and the RP
// spots), so the GLB's meshes go through a Kit with the very materials the
// builders made: same textures, same metre UVs, same batching.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Kit, matsByKey } from "./trollcity-kit.js?v=tc2-wst-tc3-sh1-sr1-pf1-or1-tcs1";
import { TC_LAYOUT } from "./trollcity-layout.js?v=tl1-tcs1";

const URL_GLB = new URL("../models/", import.meta.url).href;
const loader = new GLTFLoader();

/* The layout, unless there is none or the page asks for the code-built town
   (?tcstudio=0, for comparing the two). */
export function studioTown() {
  if (!TC_LAYOUT) return null;
  try { if (new URLSearchParams(location.search).get("tcstudio") === "0") return null; } catch {}
  return TC_LAYOUT;
}

/* Draw the GLB's pieces into `root` once it has loaded (the map preloader
   waits on three's loading manager, so a preloaded town is complete). */
export function loadStudioTown(api, root, studio) {
  const mats = matsByKey();   // read now: the next build resets the keys
  loader.load(`${URL_GLB}${studio.glb}.glb?v=${studio.v}`, (gltf) => {
    const K = new Kit(api, root);
    const missing = [];
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      let q = o;
      while (q && !q.userData.tc) q = q.parent;
      const [key, tint, shadow] = (q?.userData.tc || o.name).split("|");
      const mat = mats.get(key);
      if (!mat) { missing.push(key); return; }
      o.updateWorldMatrix(true, false);
      const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
      K.add(mat, g, { shadow: shadow !== "0", color: tint ? new THREE.Color(+`0x${tint}`) : null });
    });
    K.flush();
    if (missing.length) console.warn(`Troll City: ${missing.length} Studio meshes name a material the town doesn't make: ${missing.join(", ")}`);
  }, undefined, (e) => console.warn("Troll City: the Studio town didn't load", e));
}
