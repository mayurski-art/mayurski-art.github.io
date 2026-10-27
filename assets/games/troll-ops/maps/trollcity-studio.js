// Troll Forces — Troll City's Studio town (doc "Troll City redesign in
// Roblox Studio"). The town is laid out in Roblox Studio
// (studio/trollcity) and comes back as two files, written by
// tools/troll-ops-map-from-studio.mjs:
//   models/tc-town.glb      every still piece, in world metres, one mesh per
//                           material: named "<key>|<tint>|<shadow>", where
//                           key is the Kit's material key (trollcity-kit.js
//                           matKey), tint a vertex colour ("" = none) and
//                           shadow 1 or 0; a prop made in Studio with
//                           generate_mesh is "gen:<hash>", its own
//                           material and JPEG in the GLB ("gen:plain": none,
//                           its tint is its colour)
//   trollcity-layout.js     the still colliders, [x, z, w, d, h, y, pen];
//                           `moves`, the models Studio moved, turned or
//                           left be beside one that moved:
//                           [x0, y0, z0, x1, y1, z1, m] with the model's
//                           box as the code built it and m its move (a 3x4
//                           matrix, rows; 0 = stayed put); and `rp`, the RP
//                           markers moved in Studio, by name (walkRp):
//                           [x, y, z, yaw|null, w|null, d|null]
// The town's builders still run (they keep the live pieces and the RP
// spots), so the GLB's meshes go through a Kit with the very materials the
// builders made: same textures, same metre UVs, same batching. What they
// keep goes where its model went (moveRp, moveLive): the smallest model box
// round a spot, or round the whole of a live prop, decides; a marker moved
// in Studio has the last word on its spot.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Kit, matsByKey } from "./trollcity-kit.js?v=tc2-wst-tc3-sh1-sr1-pf1-or1-tcs1-tx1-ch1-sp1-kbt1-pm1-ss1-ss2-ss3-tfm2-ugb1-ug1";
import { TC_LAYOUT } from "./trollcity-layout.js?v=tl1-tcs1-tcp1-trk1-ch1-sp1";

const URL_GLB = new URL("../models/", import.meta.url).href;
const loader = new GLTFLoader();

/* The layout, unless there is none or the page asks for the code-built town
   (?tcstudio=0, for comparing the two). */
export function studioTown() {
  if (!TC_LAYOUT) return null;
  try { if (new URLSearchParams(location.search).get("tcstudio") === "0") return null; } catch {}
  return TC_LAYOUT;
}

/* ------------------------------------------------ moved models */

let MOVES = [];            // { b: Box3 (the margins added), area, m: Matrix4 | null, yaw }
let OVER = {};             // marker name -> [x, y, z, yaw, w, d]
const _v = new THREE.Vector3(), _b = new THREE.Box3();

/* This build's moves (none for the code-built town). */
export function setMoves(studio) {
  OVER = studio?.rp || {};
  MOVES = (studio?.moves || []).map(([x0, y0, z0, x1, y1, z1, m]) => {
    const M = m ? new THREE.Matrix4().set(...m, 0, 0, 0, 1) : null;
    return {
      b: new THREE.Box3(new THREE.Vector3(x0 - 0.25, y0 - 0.6, z0 - 0.25), new THREE.Vector3(x1 + 0.25, y1 + 0.6, z1 + 0.25)),
      area: (x1 - x0) * (z1 - z0), m: M,
      // the turn about up: yaw and ry both turn by it (0 faces -z, +PI/2 -x)
      yaw: M ? Math.atan2(M.elements[8], M.elements[10]) : 0,
    };
  });
}
const smallest = (ok) => { let best = null; for (const e of MOVES) if (ok(e) && (!best || e.area < best.area)) best = e; return best; };
/* The move of the smallest model round a point, or round a whole box. */
const moveAt = (x, y, z) => (MOVES.length ? smallest((e) => e.b.containsPoint(_v.set(x, y, z))) : null);
const moveFor = (box) => (MOVES.length ? smallest((e) => e.b.containsBox(box)) : null);
const NONE = { m: null, yaw: 0 };

function moveBox(min, max, m) {
  _b.makeEmpty();
  for (let i = 0; i < 8; i++) _b.expandByPoint(_v.set(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z).applyMatrix4(m));
  min.copy(_b.min); max.copy(_b.max);
}

/* Every object in the RP spec, by name ("rp.bar.taps.0"): the names the
   Studio markers carry (tools/troll-ops-map-capture.mjs walks the same).
   A spec entry that's a function is called (the lists rebuilt with the
   map); nothing below it is. */
export function walkRp(rp, visit) {
  const seen = new Set();
  const walk = (v, name, depth, ctx) => {
    if (v == null || depth > 6) return;
    if (typeof v === "function") { if (depth) return; try { v = v(); } catch { return; } }
    if (typeof v !== "object" || seen.has(v)) return;
    if (!Array.isArray(v) && v.constructor && v.constructor !== Object) return;   // live objects (the train)
    seen.add(v);
    const inner = visit(v, name, ctx);
    for (const [k, c] of Object.entries(v)) walk(c, name + "." + k, depth + 1, inner);
  };
  for (const [k, v] of Object.entries(rp)) walk(v, "rp." + k, 0, null);
}

// [x, y, z] (or [x, z]) points kept in arrays, and walking paths [[x, z], ...]
const POINTS = new Set(["anvil", "forge", "quench"]);
const ORIG = new WeakMap();
const keep = (o) => {
  const s = {};
  for (const [k, v] of Object.entries(o)) if (typeof v === "number" || (Array.isArray(v) && (POINTS.has(k) || k === "path"))) s[k] = structuredClone(v);
  return s;
};
const Y = ["y", "floor", "floorY", "top"];

/* Move one spec object where its model went, then by its marker. `ctx` is
   the move of the object it sits in (a seat's stand goes with the seat). */
function moveObj(o, name, ctx) {
  const point = typeof o.x === "number" && typeof o.z === "number";
  const zone = !point && [o.x0, o.x1, o.z0, o.z1].every((n) => typeof n === "number");
  const y = o.y ?? o.floor ?? o.floorY ?? 0;
  let mv = ctx;
  if (!mv && (point || zone)) mv = (point ? moveAt(o.x, y, o.z) : moveAt((o.x0 + o.x1) / 2, y, (o.z0 + o.z1) / 2)) || NONE;
  const m = mv?.m;
  if (m) {
    const dy = m.elements[13];
    if (point) { _v.set(o.x, y, o.z).applyMatrix4(m); o.x = _v.x; o.z = _v.z; }
    if (zone) {
      const lo = new THREE.Vector3(o.x0, y, o.z0), hi = new THREE.Vector3(o.x1, y, o.z1);
      moveBox(lo, hi, m);
      Object.assign(o, { x0: lo.x, x1: hi.x, z0: lo.z, z1: hi.z });
    }
    for (const k of Y) if (typeof o[k] === "number") o[k] += dy;
    for (const k of ["yaw", "ry"]) if (typeof o[k] === "number") o[k] += mv.yaw;
    for (const k of POINTS) {
      const a = o[k];
      if (!Array.isArray(a) || a.some((n) => typeof n !== "number")) continue;
      if (a.length === 3) _v.set(...a).applyMatrix4(m).toArray(a);
      else if (a.length === 2) { _v.set(a[0], 0, a[1]).applyMatrix4(m); a[0] = _v.x; a[1] = _v.z; }
    }
  }
  // a walking path: each corner where its own spot went
  if (Array.isArray(o.path) && MOVES.length) for (const p of o.path) {
    if (!Array.isArray(p) || p.length !== 2) continue;
    const pm = (mv?.m ? mv : moveAt(p[0], o.y ?? 0, p[1]))?.m;
    if (pm) { _v.set(p[0], o.y ?? 0, p[1]).applyMatrix4(pm); p[0] = _v.x; p[1] = _v.z; }
  }
  // its marker, moved in Studio on its own (or with what it stands in)
  const ov = OVER[name];
  if (ov && (point || zone)) {
    const [x, oy, z, yaw, w, d] = ov;
    const dy = oy - y;
    if (point) Object.assign(o, { x, z });
    else {
      const hw = (w ?? o.x1 - o.x0) / 2, hd = (d ?? o.z1 - o.z0) / 2;
      Object.assign(o, { x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd });
    }
    if (Math.abs(dy) > 1e-4) for (const k of Y) if (typeof o[k] === "number") o[k] += dy;
    if (yaw != null && typeof o.yaw === "number") o.yaw = yaw;
  }
  return point || zone ? mv : ctx;
}

/* The RP spec for this build: back to what the code says (the spec's
   constants outlive a build), then moved. Call after the builders. */
export function moveRp(rp) {
  walkRp(rp, (o) => {
    if (!ORIG.has(o)) ORIG.set(o, keep(o));
    else Object.assign(o, structuredClone(ORIG.get(o)));
  });
  if (MOVES.length || Object.keys(OVER).length) walkRp(rp, moveObj);
}
/* A spec list made fresh on every call (the townsfolk: rp[key]), moved the same. */
export function moveFresh(v, key) {
  if (MOVES.length || Object.keys(OVER).length) walkRp({ [key]: v }, moveObj);
  return v;
}
/* A point (a stair link's end) where its model went. */
export function movePoint(p) {
  const m = moveAt(p.x, p.y ?? 0, p.z)?.m;
  if (m) { _v.set(p.x, p.y ?? 0, p.z).applyMatrix4(m); p.x = _v.x; p.z = _v.z; if (typeof p.y === "number") p.y = _v.y; }
  return p;
}

/* What the code still draws, where its model went: the Kit's live pieces
   (pass moveGeo to its flush), what the builders put in `root` themselves
   (the badge, the posters, the cell doors, the cap; not the train, which
   finds its own way: userData.tcFixed), the lamps, the live colliders (a
   shut door keeps its box in `closed`) and the stair links. */
export function moveGeo(g) {
  if (!MOVES.length || g.userData.tcFixed) return;
  g.computeBoundingBox();
  const m = moveFor(g.boundingBox)?.m;
  if (m) g.applyMatrix4(m);
}
export function moveLive({ root, lights, colliders, stairLinks }) {
  if (!MOVES.length) return;
  for (const o of [...root.children]) {
    if (o.userData.tcFixed || o.isLight) continue;
    const m = moveFor(new THREE.Box3().setFromObject(o, true))?.m;
    if (m) o.applyMatrix4(m);
  }
  for (const l of lights) {
    const m = moveAt(l.position.x, l.position.y, l.position.z)?.m;
    if (m) l.position.applyMatrix4(m);
  }
  for (const c of colliders) {
    if (!c.live || c.train) continue;
    const box = c.closed || c;
    const m = moveFor(new THREE.Box3(box.min, box.max))?.m;
    if (!m) continue;
    moveBox(box.min, box.max, m);
    // (a door standing open keeps its collider out of the way, under the map)
    if (c.closed) { const y0 = c.min.y, y1 = c.max.y; c.min.copy(c.closed.min).setY(y0); c.max.copy(c.closed.max).setY(y1); }
  }
  for (const s of stairLinks || []) {
    if (s.rope) continue;
    const m = moveAt((s.a.x + s.b.x) / 2, Math.min(s.a.y, s.b.y), (s.a.z + s.b.z) / 2)?.m;
    if (!m) continue;
    for (const p of [s.a, s.b]) { _v.set(p.x, p.y, p.z).applyMatrix4(m); p.x = _v.x; p.y = _v.y; p.z = _v.z; }
  }
}

/* Draw the GLB's pieces into `root` once it has loaded (the map preloader
   waits on three's loading manager, so a preloaded town is complete). */
export function loadStudioTown(api, root, studio) {
  const mats = matsByKey();   // read now: the next build resets the keys
  loader.load(`${URL_GLB}${studio.glb}.glb?v=${studio.v}`, (gltf) => {
    const K = new Kit(api, root);
    const missing = [];
    const gen = new Map();   // a generated prop's material, made once per key and tint
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      let q = o;
      while (q && !q.userData.tc) q = q.parent;
      const [key, tint, shadow] = (q?.userData.tc || o.name).split("|");
      let mat = mats.get(key);
      if (!mat && key.startsWith("gen:")) {
        const k = key + "|" + tint;
        if (!gen.has(k)) {
          const m = o.material.clone();
          if (!m.map && tint) m.color.set(+`0x${tint}`);
          m.roughness = 0.85; m.metalness = 0;
          gen.set(k, m);
        }
        mat = gen.get(k);
        o.updateWorldMatrix(true, false);
        K.add(mat, o.geometry.clone().applyMatrix4(o.matrixWorld), { shadow: shadow !== "0" });
        return;
      }
      if (!mat) { missing.push(key); return; }
      o.updateWorldMatrix(true, false);
      const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
      K.add(mat, g, { shadow: shadow !== "0", color: tint ? new THREE.Color(+`0x${tint}`) : null });
    });
    K.flush();
    if (missing.length) console.warn(`Troll City: ${missing.length} Studio meshes name a material the town doesn't make: ${missing.join(", ")}`);
  }, undefined, (e) => console.warn("Troll City: the Studio town didn't load", e));
}
