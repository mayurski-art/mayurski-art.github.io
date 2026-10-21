// Troll Forces — "Kabukigrin" (doc docs/KABUKIGRIN.md): Grinjuku with
// Trolling Loud's Tokyo branch in its A side. Laid out in Roblox Studio
// (Kabukigrin (edit).rbxl) and brought back by
// tools/troll-ops-map-from-studio.mjs --map kabukigrin --write as two files:
//   models/kb-town.glb      every still piece, one mesh per material, named
//                           "<key>|<tint>|<shadow>": a Grinjuku chunk's key
//                           is "glb:<its GLB>:<its material>" and it carries
//                           that GLB's material, its light-map UVs and paint
//   kabukigrin-layout.js    the colliders, the markers by name (spawns,
//                           sites, ropes, stairs) and the lights
// So the map is the Studio layout's, the look Grinjuku's: a chunk is lit by
// its own GLB's bake and retextured as that GLB is (map-models.js).
// Kept as kabukigrin_wip (out of the vote pool) until phase 6.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GRINJUKU } from "./grinjuku.js?v=gj1-sr1-or1";
import { KB_LAYOUT } from "./kabukigrin-layout.js?v=kb0";
import { mapModel, RETEXTURE } from "./map-models.js?v=hg6e-sr1-or1";
import { loadBake } from "./battlefield-props.js?v=sr1-or1";
import { applyBakedLightMap, retexture } from "./surface-textures.js?v=hg6e-sr1-or1";

const URL_GLB = new URL("../models/", import.meta.url).href;
const loader = new GLTFLoader();
// the GLBs whose chunks are light-mapped, and how strongly (battlefield-props BAKED)
const BAKED = { "gj-shell": Math.PI, "gj-props": Math.PI, "gj-skyline": Math.PI };

const L = KB_LAYOUT;
const byKind = (kind) => Object.entries(L.markers).filter(([, m]) => m.kind === kind);
// Spawn_1, Spawn_2 ... in number order: the game splits the list in halves by team
const num = (name) => +(name.match(/\d+$/)?.[0] ?? 0);
const SPAWNS = byKind("spawn").filter(([n]) => /^Spawn_\d+$/.test(n)).sort(([a], [b]) => num(a) - num(b)).map(([, m]) => [m.p[0], m.p[2], m.p[1] || undefined].filter((v) => v !== undefined));
const PLAYER = L.markers.PlayerSpawn?.p || SPAWNS[0] && [SPAWNS[0][0], 0, SPAWNS[0][1]];
const SITES = byKind("site").map(([n, m]) => ({ id: n.replace(/^Site_/, ""), x: m.p[0], y: m.p[1] || 0, z: m.p[2] })).sort((a, b) => (a.id < b.id ? -1 : 1));
// every flight's foot and top, for whatever finds its way between floors
// (k9-unit.js, the bots): buildMap finds tall flights in the colliders by
// itself, not a two-step kerb
const STAIRS = byKind("stair").sort(([a], [b]) => num(a) - num(b)).map(([, m]) => ({ a: { x: m.p[0], y: m.p[1], z: m.p[2] }, b: { x: m.to[0], y: m.to[1], z: m.to[2] } }));
const ROPES = byKind("rope").sort(([a], [b]) => num(a) - num(b)).map(([, m]) => ({ x: m.p[0], z: m.p[2], y0: m.p[1], y1: m.top, dir: m.dir || "+z" }));

/* The Studio town: each mesh gets its GLB's material, light map and texture. */
function loadTown(api) {
  loader.load(`${URL_GLB}${L.glb}.glb?v=${L.v}`, (gltf) => {
    const todo = [];
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      let q = o;
      while (q && !q.userData.tc) q = q.parent;
      const [key, , shadow] = (q?.userData.tc || o.name).split("|");
      const [kind, file, name] = key.split(":");
      if (kind !== "glb") return;
      o.material.name = name;   // retexture's rules go by the Blender name
      o.castShadow = shadow !== "0" && file !== "gj-neon";
      o.receiveShadow = true;
      todo.push([o, file]);
    });
    const files = [...new Set(todo.map(([, f]) => f))];
    Promise.all(files.map((f) => (BAKED[f] ? loadBake(f) : Promise.resolve(null)))).then((bakes) => {
      const bakeOf = new Map(files.map((f, i) => [f, bakes[i]]));
      for (const [o, file] of todo) {
        const bake = bakeOf.get(file);
        if (bake) applyBakedLightMap(o, bake, BAKED[file]);
      }
      retexture(gltf.scene, RETEXTURE);
      api.prop(gltf.scene);
    });
  }, undefined, (e) => console.warn("Kabukigrin: the Studio town didn't load", e));
}

function buildKabukigrin(api) {
  for (const [x, z, w, d, h, y, pen] of L.colliders) api.ghostBox(x, z, w, d, h, { y, pen });
  api.stairLinks.push(...STAIRS.map((s) => ({ a: { ...s.a }, b: { ...s.b } })));
  for (const r of ROPES) api.rope(r.x, r.z, r.y0, r.y1, { dir: r.dir, ghost: true });
  loadTown(api);
  // the far city: drawn by the game, not part of the Studio town
  mapModel(api, "gj-skyline", { x: 0, z: 0, castShadow: false });
}

export const KABUKIGRIN = {
  ...GRINJUKU,
  name: "Kabukigrin",
  blurb: "Shinjuku's neon on one side, a nightclub on the other.",
  playerSpawn: { x: PLAYER[0], z: PLAYER[2] },
  build: buildKabukigrin,
  bombSites: SITES,
  spawns: SPAWNS,
  debug: () => ({ ropes: ROPES.map((r) => ({ ...r })), sites: SITES.map((s) => ({ ...s })) }),
};
