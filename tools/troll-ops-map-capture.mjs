// A Troll Forces map's build, captured piece by piece in headless Chromium,
// for the Studio round trip (docs "Troll City redesign in Roblox Studio",
// "Kabukigrin"): tools/troll-ops-map-to-studio.mjs sends it to Studio, and
// tools/troll-ops-map-from-studio.mjs rebuilds the map from it plus what
// Studio moved. Both capture the same deterministic build, so piece i is
// the same piece on both sides.
//
// The map builds exactly as in the game (maps.js buildMap, ?tcstudio=0
// semantics: the code-built town), with the Kit watched. The served copies
// of the map's builder files (CFG below) get a call marker at the top of
// each builder (function name(K, ...) {) so every piece and collider knows
// which call drew it: one Studio model per building and prop. The files on
// disk are never touched.
//
// A map drawn from Blender GLBs (Grinjuku: mapModel) has no builders. Its
// GLB meshes are cut into pieces by the map's colliders instead: every
// triangle goes to the smallest collider box round its centre (the Blender
// build fits a model to every solid), and each (solid, material) chunk is a
// piece of its own, named by the solid's kind (`layout`); what sits in no
// box is loose, grouped by side. Reference models (the far skyline) stay
// live.
//
//   const cap = await captureMap({ map: "trollcity", geometry: true });
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch {
  try { ({ chromium } = require(path.join(process.execPath, "../../lib/node_modules/playwright"))); }
  catch { ({ chromium } = require(path.join(process.env.LOCALAPPDATA || "", "npm-cache/_npx/361ceb562f3b3235/node_modules/playwright"))); }
}

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png",
  ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif",
  ".luau": "text/plain", ".b64": "text/plain" };
const PAGE = `<!doctype html><meta charset="utf-8"><script type="importmap">
{"imports":{"three":"/assets/vendor/three.module.min.js","three/addons/":"/assets/vendor/addons/"}}</script>`;

/* Each map the round trip knows:
     watched   builder files (under maps/) and the tag their calls carry
     root      the call that builds the whole map (its own pieces are "Town")
     section   a call that is a section of the map (a building, a room):
               the model path starts at it. Default: the outermost watched
               call in the chain
     fold      builders that fold into their caller (pieces of a thing, not
               things you'd move on their own)
     layout    for a GLB-built map: the module whose <fn>() lists the solids
               the colliders were laid from, in order, each { k, side }
     side      for a GLB-built map: which side a loose point is on
     reference models (GLB files) shown live, never exported */
export const CFG = {
  trollcity: {
    watched: { "trollcity.js": "trollcity", "trollcity-kit.js": "kit" },
    root: "trollcity:buildTrollCity",
    section: (n) => /^trollcity:(build[A-Z]\w*|hangPictures|rpFurniture)$/.test(n),
    fold: ["wall", "room", "slabWithHole", "railing", "gableRoof", "signBoard", "wallPic", "api_stairs", "boardwalk", "flat", "seatAt", "benchSeats", "materials"],
  },
  trollingloud: {
    watched: { "trollingloud.js": "club", "trollingloud-kit.js": "neon", "trollingloud-kitchen.js": "kitchen", "trollcity-kit.js": "kit" },
    root: null,
    section: null,
    fold: ["wall", "lining", "deck", "glassRail", "cutRects", "bx", "atlasQuad", "batten", "steelStair", "materials", "seatAt", "sofaSeats", "mergeAll", "prismGeo2", "ringPts"],
  },
  grinjuku: {
    watched: {},
    layout: { module: "grinjuku-layout.js", fn: "grinjukuLayout" },
    side: (x) => (x < -6 ? "A" : x > 6 ? "B" : "mid"),
    reference: ["gj-skyline"],
  },
};
const MAPS_DIR = "assets/games/troll-ops/maps/";
const cfgOf = (map) => CFG[map] || { watched: {} };

/* The served copies: a call marker at the top of every top-level builder
   that takes the Kit, so a piece knows which call drew it. */
function instrument(src, file) {
  return src.replace(/^((?:export )?function (\w+)\(K\b[^\n]*?\)\s*\{)/gm, (m, head, name) => `${head} globalThis.__tcCall && globalThis.__tcCall("${file}:${name}");`);
}

/* A static server for the repo (with the map's watched files instrumented);
   `extra(url, res)` answers first (return true when it did). */
export async function serve(port, extra = () => false, map = "trollcity") {
  const WATCHED = {};
  for (const [f, tag] of Object.entries(cfgOf(map).watched)) WATCHED[MAPS_DIR + f] = tag;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/__export.html") { res.writeHead(200, { "content-type": "text/html" }); return res.end(PAGE); }
    if (extra(url, res, req)) return;
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const p = path.join(ROOT, rel);
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    const key = rel.replace(/\\/g, "/");
    if (WATCHED[key]) { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(instrument(fs.readFileSync(p, "utf8"), WATCHED[key])); }
    res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
    fs.createReadStream(p).pipe(res);
  });
  await new Promise((r) => server.listen(port, "127.0.0.1", r));
  return server;
}

/* Capture the map. `geometry`: also each piece's own geometry (world
   metres: positions, normals, uvs, index), for rebuilding it. */
export async function captureMap({ map = "trollcity", geometry = false, port = 0 } = {}) {
  const server = await serve(port, undefined, map);
  const kitUrl = fs.readFileSync(path.join(ROOT, MAPS_DIR + "trollcity.js"), "utf8").match(/"\.\/(trollcity-kit\.js\?v=[^"]+)"/)[1];
  const cfg = cfgOf(map);
  // the layout module's url, with its ?v= tag as the map imports it
  let layoutUrl = null;
  if (cfg.layout) {
    const src = fs.readFileSync(path.join(ROOT, MAPS_DIR + map + ".js"), "utf8");
    const m = src.match(new RegExp(`"\\./(${cfg.layout.module.replace(".", "\\.")}\\?v=[^"]+)"`));
    layoutUrl = m ? m[1] : cfg.layout.module;
  }
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // the code-built town, whatever Studio town the repo holds
  await page.goto(`http://127.0.0.1:${server.address().port}/__export.html?tcstudio=0`);
  const data = await page.evaluate(pageCapture, {
    MAP: map, kitUrl, GEOMETRY: geometry,
    CFG: { watched: cfg.watched, root: cfg.root || null, section: cfg.section ? cfg.section.toString() : null, fold: cfg.fold || [],
      layout: cfg.layout ? { url: layoutUrl, fn: cfg.layout.fn } : null, side: cfg.side ? cfg.side.toString() : null, reference: cfg.reference || [] },
  });
  await browser.close();
  server.close();
  if (errors.length) console.log("page errors:\n  " + errors.join("\n  "));
  return data;
}

async function pageCapture({ MAP, kitUrl, GEOMETRY, CFG }) {
  Error.stackTraceLimit = 200;
  const THREE = await import("three");
  const kit = await import("/assets/games/troll-ops/maps/" + kitUrl);
  const TAG = {};   // file basename (no .js) -> tag
  for (const [f, tag] of Object.entries(CFG.watched)) TAG[f.replace(/\.js$/, "")] = tag;
  const fileRe = Object.keys(TAG).length ? new RegExp(`at (?:[\\w$]+\\.)?([\\w$]+) \\(.*\\/(${Object.keys(TAG).map((f) => f.replace(/[.-]/g, "\\$&")).join("|")})\\.js`) : null;
  const SECTION = CFG.section ? new Function("return " + CFG.section)() : null;
  const SIDE = CFG.side ? new Function("return " + CFG.side)() : null;

  /* ------------------------------------------------ who drew what */
  // A call is known by its name and stack depth: two calls of one builder
  // at one depth can't be live together, so the newest is the one running.
  const frames = () => new Error().stack.split("\n").slice(1).map((l) => {
    const m = fileRe && l.match(fileRe);
    return m ? `${TAG[m[2]]}:${m[1]}` : null;
  });
  const running = new Map(), calls = [];
  globalThis.__tcCall = (name) => {
    const f = frames();             // f[0] frames, f[1] __tcCall, f[2] the builder
    running.set(name + "@" + (f.length - 2), calls.length);
    calls.push(name);
  };
  const chainNow = () => {
    const f = frames(), out = [];
    for (let i = f.length - 1; i >= 0; i--) {
      if (!f[i]) continue;
      const id = running.get(f[i] + "@" + (f.length - i));
      if (id != null && calls[id] === f[i]) out.push(id);
    }
    return out;                      // outermost first
  };

  const recs = [];
  const add0 = kit.Kit.prototype.add;
  kit.Kit.prototype.add = function (mat, geo, o) {
    const type = geo.type, params = geo.parameters ? { ...geo.parameters } : null;
    const P = geo.attributes.position, N = geo.attributes.normal;
    const pts = [], nrm = [];
    if (type === "BoxGeometry" || type === "CylinderGeometry" || type === "SphereGeometry") {
      for (let i = 0; i < P.count; i++) pts.push([P.getX(i), P.getY(i), P.getZ(i)]);
      if (N && type === "BoxGeometry") for (const i of [0, 8, 16]) nrm.push([N.getX(i), N.getY(i), N.getZ(i)]);
    }
    const src = geo.clone();         // as drawn (indexed); add() strips and flattens its own
    const chain = chainNow();
    const g = add0.call(this, mat, geo, o);
    recs.push({ i: recs.length, type, params, pts, nrm, mat, key: kit.matKey(mat), color: o?.color ?? null,
      shadow: o?.shadow !== false, live: !!o?.live, chain, src, root: this.root });
    return g;
  };
  const flush0 = kit.Kit.prototype.flush;
  kit.Kit.prototype.flush = function (opts) {
    const before = new Set(this.root.children);
    flush0.call(this, opts);
    for (const c of this.root.children) if (!before.has(c)) c.userData.__kit = true;
  };

  const { buildMap, MAPS } = await import("/assets/games/troll-ops/maps/maps.js");
  const map = MAPS[MAP];
  // every collider the town lays, with the call that laid it, as it stood
  // when the town was built (buildMap trims stair ends after)
  const colRecs = [];
  let colSnap = null;
  const propped = [];   // what the map placed whole (mapModel's GLBs), as they land
  const build0 = map.build;
  map.build = (api) => {
    const g0 = api.ghostBox;
    api.ghostBox = function (...a) { const c = g0.apply(this, a); colRecs.push({ c, chain: chainNow() }); return c; };
    // (kept patched: a GLB lands by api.prop after its load, long after build returns)
    const p0 = api.prop;
    api.prop = function (o) { propped.push(o); return p0.call(this, o); };
    try { return build0(api); }
    finally {
      api.ghostBox = g0;
      colSnap = colRecs.map((r) => ({ min: r.c.min.toArray(), max: r.c.max.toArray(), pen: r.c.pen, live: !!r.c.live, chain: r.chain }));
    }
  };
  const colliders = [], arena = {};
  let built;
  try { built = buildMap(MAP, { colliders, arena }); } finally { map.build = build0; }
  // late loads (the gallery's art, a GLB-built map's models): wait until
  // nothing new has landed for a while
  {
    const count = () => { let n = 0; built.root.traverse((o) => { if (o.isMesh) n++; }); return n; };
    const t0 = performance.now();
    let last = count(), quiet = 0;
    while (performance.now() - t0 < 30000) {
      await new Promise((r) => setTimeout(r, 500));
      const n = count();
      if (n === last) { if ((quiet += 500) >= 2500) break; } else { last = n; quiet = 0; }
    }
  }
  built.root.updateMatrixWorld(true);
  const mainRoot = recs[0]?.root ?? built.root;

  const V = (a) => new THREE.Vector3(...a);
  const r4 = (x) => +x.toFixed(4);

  /* ------------------------------------------------ models */
  // Which builders fold into the one that called them (pieces of a
  // building, not things you'd move on their own).
  const tags = [...new Set(Object.values(TAG))];
  const FOLD = new Set((CFG.fold || []).flatMap((n) => tags.map((t) => `${t}:${n}`)));
  const isSection = (n) => n !== CFG.root && (SECTION ? SECTION(n) : true);
  const nice = (n) => n.split(":")[1].replace(/^build/, "").replace(/^kit/, "").replace(/^(.)/, (c) => c.toUpperCase());
  const counts = new Map();
  const modelOf = new Map();          // call id -> model path
  const pathOf = (chain) => {
    // (and a wrapper calling its namesake: trollcity's chair is the kit's chair)
    const kept = chain.filter((id, i) => !FOLD.has(calls[id]) && !(i && nice(calls[chain[i - 1]]) === nice(calls[id])));
    let s = kept.findIndex((id) => isSection(calls[id]));
    const out = [];
    if (s < 0) { out.push("Town"); s = kept.findIndex((id) => calls[id] === CFG.root); }
    else out.push(nice(calls[kept[s]]));
    // the section's own calls, two levels down (a shop, then its furniture)
    for (const id of kept.slice(s + 1, s + 3)) {
      if (!modelOf.has(id)) {
        const n = nice(calls[id]);
        counts.set(n, (counts.get(n) || 0) + 1);
        modelOf.set(id, `${n}_${counts.get(n)}`);
      }
      out.push(modelOf.get(id));
    }
    return out.join("/");
  };

  // a Kit drawing into its own group (the train's cars) is placed by that
  // group (train.js stands the train at the station), and is live
  for (const r of recs) {
    if (r.root !== mainRoot) r.live = true;
    const mw = r.root.matrixWorld;
    if (mw.equals(new THREE.Matrix4())) continue;
    r.src.applyMatrix4(mw);
    r.pts = r.pts.map((q) => V(q).applyMatrix4(mw).toArray());
    r.nrm = r.nrm.map((q) => V(q).transformDirection(mw).toArray());
  }
  for (const r of recs) { r.path = pathOf(r.chain); r.src.computeBoundingBox(); r.bb = r.src.boundingBox; }
  const cols = colSnap.map((c) => ({ ...c, path: pathOf(c.chain), bb: new THREE.Box3(V(c.min), V(c.max)) }));

  /* ------------------------------------------------ GLB-built maps */
  // Every placed GLB (but the reference ones) is cut into pieces by the
  // still colliders: a triangle goes to the smallest box round its centre
  // (grown 0.15 m), and each (box, material) chunk is a piece named by the
  // solid the box came from. The rest is loose, by side. Only a map that
  // IS its GLBs (a layout file, Grinjuku); elsewhere a GLB is a prop the
  // game places by itself (Troll City's church pews) and stays out
  if (CFG.layout) {
    const solids = CFG.layout ? (await import("/assets/games/troll-ops/maps/" + CFG.layout.url))[CFG.layout.fn]().solids : null;
    const still = cols.map((c, i) => ({ i, c, bb: c.bb.clone().expandByScalar(0.15), area: (c.max[0] - c.min[0]) * (c.max[2] - c.min[2]) * (c.max[1] - c.min[1]) }))
      .filter((s) => !s.c.live);
    const boxName = new Map();   // collider i -> model path
    const kindN = new Map();
    const nameFor = (i) => {
      if (boxName.has(i)) return boxName.get(i);
      const s = solids?.[i];
      const kind = s ? s.k.replace(/^_/, "") : "box";
      const side = s?.side || (SIDE ? SIDE((cols[i].min[0] + cols[i].max[0]) / 2, (cols[i].min[2] + cols[i].max[2]) / 2) : "mid");
      const k = `${side}/${kind}`;
      kindN.set(k, (kindN.get(k) || 0) + 1);
      boxName.set(i, `${k}_${kindN.get(k)}`);
      return boxName.get(i);
    };
    const centre = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c3 = new THREE.Vector3();
    // (a triangle in no box joins the nearest box this close: a sign on a
    // shopfront, a lantern off a wall)
    const NEAR = 1.2;
    // in a fixed order: the GLBs load in whatever order the network gives, and
    // the mesh numbers Studio keeps must come out the same every capture
    const byFile = (m) => `${m.userData?.model || ""}|${m.position.toArray().map((v) => v.toFixed(3)).join(",")}`;
    for (const model of [...propped].sort((x, y) => byFile(x) < byFile(y) ? -1 : byFile(x) > byFile(y) ? 1 : 0)) {
      const file = model.userData?.model;
      if (!file || CFG.reference.includes(file)) continue;
      // the GLB's material names, in primitive order: the game's retexture
      // pass makes its own unnamed materials, and the loader keeps the order
      let names = [];
      try {
        const buf = await (await fetch(`/assets/games/troll-ops/models/${file}.glb`)).arrayBuffer();
        const dv = new DataView(buf), jl = dv.getUint32(12, true);
        const j = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jl)));
        names = (j.meshes || []).flatMap((m) => m.primitives.map((p) => j.materials?.[p.material]?.name || "mat"));
      } catch {}
      let prim = 0;
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.userData.__glb = true;
        const matName = (names[prim++] || (Array.isArray(o.material) ? o.material[0] : o.material).name || "mat").replace(/[^\w]+/g, "_");
        const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
        const G = g.index ? g.toNonIndexed() : g;
        const P = G.attributes.position, n = P.count / 3;
        // each triangle's chunk
        const chunkOf = new Map();   // name -> [triangle indices]
        for (let t = 0; t < n; t++) {
          a.fromBufferAttribute(P, t * 3); b.fromBufferAttribute(P, t * 3 + 1); c3.fromBufferAttribute(P, t * 3 + 2);
          centre.copy(a).add(b).add(c3).divideScalar(3);
          let best = null;
          for (const s of still) if (s.bb.containsPoint(centre) && (!best || s.area < best.area)) best = s;
          if (!best) {
            let d0 = NEAR;
            for (const s of still) { const d = s.bb.distanceToPoint(centre); if (d < d0) { d0 = d; best = s; } }
          }
          const name = best ? nameFor(best.i) : `Loose/${SIDE ? SIDE(centre.x, centre.z) + "/" : ""}${file}`;
          if (!chunkOf.has(name)) chunkOf.set(name, []);
          chunkOf.get(name).push(t);
        }
        const mat = Array.isArray(o.material) ? o.material[0] : o.material;
        for (const [name, tris] of chunkOf) {
          const geo = new THREE.BufferGeometry();
          for (const [attr, A] of Object.entries(G.attributes)) {
            const sz = A.itemSize, out = new Float32Array(tris.length * 3 * sz);
            let k = 0;
            for (const t of tris) for (let v = 0; v < 3; v++) for (let q = 0; q < sz; q++) out[k++] = A.array[(t * 3 + v) * sz + q];
            geo.setAttribute(attr, new THREE.BufferAttribute(out, sz));
          }
          // the chunk's own paint, for Studio's colour
          let tint = null;
          const C = geo.attributes.color;
          if (C) {
            const s = [0, 0, 0];
            for (let i = 0; i < C.count; i++) { s[0] += C.getX(i); s[1] += C.getY(i); s[2] += C.getZ(i); }
            tint = new THREE.Color(s[0] / C.count, s[1] / C.count, s[2] / C.count);
          }
          geo.computeBoundingBox();
          recs.push({ i: recs.length, type: "Mesh", params: null, pts: [], nrm: [], mat, key: `glb:${file}:${matName}`, color: tint,
            shadow: o.castShadow !== false, live: false, chain: [], src: geo, root: mainRoot, path: name, bb: geo.boundingBox, glb: true });
        }
        if (G !== g) G.dispose();
        g.dispose();
      });
    }
  }
  // What a section drew itself (the station, the stable, the houses) is
  // split into the clumps that touch: one model a building. Its colliders
  // join the clump they sit in.
  {
    const loose = recs.filter((r) => !r.path.includes("/"));
    const bb = loose.map((r) => r.bb.clone().expandByScalar(0.08));
    const up = loose.map((_, i) => i);
    const find = (i) => { while (up[i] !== i) i = up[i] = up[up[i]]; return i; };
    for (let i = 0; i < loose.length; i++) for (let j = i + 1; j < loose.length; j++) {
      if (loose[i].path !== loose[j].path || !bb[i].intersectsBox(bb[j])) continue;
      // the ground-hugging pieces (track beds, yards) don't glue buildings together
      const flatI = bb[i].max.y < 0.25, flatJ = bb[j].max.y < 0.25;
      if (flatI !== flatJ) continue;
      up[find(i)] = find(j);
    }
    const groups = new Map();
    loose.forEach((r, i) => { const g = find(i); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(i); });
    const n = new Map(), clumps = [];
    for (const idx of groups.values()) {
      const box = new THREE.Box3(); for (const i of idx) box.union(bb[i]);
      const size = box.getSize(new THREE.Vector3());
      const kind = size.y > 2.5 && Math.max(size.x, size.z) > 3 ? "Building" : Math.max(size.x, size.z) > 6 ? "Ground" : "Bits";
      const sec = loose[idx[0]].path;
      const k = sec + "/" + kind;
      n.set(k, (n.get(k) || 0) + 1);
      const p = `${k}_${n.get(k)}`;
      for (const i of idx) loose[i].path = p;
      if (kind !== "Ground") clumps.push({ sec, path: p, box });
    }
    for (const c of cols) {
      if (c.path.includes("/")) continue;
      const centre = c.bb.getCenter(new THREE.Vector3());
      const hit = clumps.filter((k) => k.sec === c.path && k.box.containsPoint(centre))
        .sort((a, b) => a.box.getSize(new THREE.Vector3()).lengthSq() - b.box.getSize(new THREE.Vector3()).lengthSq())[0];
      if (hit) c.path = hit.path;
    }
  }
  // What a section drew beside a building but inside it (a shop's shelves
  // and counter, the courthouse's chairs and stove) goes in that building:
  // drag the building in Studio and its insides come along.
  {
    const top = new Map();
    for (const r of recs) {
      if (r.live && r.root !== mainRoot) continue;
      const p = r.path.split("/").slice(0, 2).join("/");
      if (!p.includes("/")) continue;
      if (!top.has(p)) top.set(p, new THREE.Box3());
      top.get(p).union(r.bb);
    }
    const house = (p, b) => { const s = b.getSize(new THREE.Vector3()); return !/\/Ground_\d+$/.test(p) && s.y > 2.5 && Math.max(s.x, s.z) > 3; };
    const into = new Map();
    for (const [p, b] of top) {
      let best = null, area = Infinity;
      const ab = (b.max.x - b.min.x) * (b.max.z - b.min.z);
      for (const [q, h] of top) {
        if (q === p || q.split("/")[0] !== p.split("/")[0] || !house(q, h)) continue;
        const a = (h.max.x - h.min.x) * (h.max.z - h.min.z);
        if (a <= ab || !h.clone().expandByScalar(0.3).containsBox(b)) continue;
        if (a < area) { area = a; best = q; }
      }
      if (best) into.set(p, best);
    }
    // (shelves in a shop: the shop, however deep)
    const home = (p) => { for (let i = 0; i < 8 && into.has(p); i++) p = into.get(p); return p; };
    const rename = (path) => {
      const parts = path.split("/");
      const p = parts.slice(0, 2).join("/");
      return into.has(p) ? `${home(p)}/${parts.slice(1).join("/")}` : path;
    };
    for (const r of recs) r.path = rename(r.path);
    for (const c of cols) c.path = rename(c.path);
  }
  // each model's box (pieces at any depth below it), for finding the model
  // a marker or a lamp stands in
  const modelBox = new Map();
  for (const r of recs) {
    if (r.live && r.root !== mainRoot) continue;
    const parts = r.path.split("/");
    for (let d = 1; d <= parts.length; d++) {
      const p = parts.slice(0, d).join("/");
      if (!modelBox.has(p)) modelBox.set(p, new THREE.Box3());
      modelBox.get(p).union(r.bb);
    }
  }
  // A seat, a table top or an arm-wrestling table goes with its furniture;
  // anything else (the till, the taps, the badge) with its building.
  const owner = (p, furniture = false) => {
    const q = V(p);
    let best = null, area = Infinity;
    for (const [path, b] of modelBox) {
      if (!path.includes("/") || /\/Ground_\d+$/.test(path)) continue;   // a section or a yard is too broad
      if (!furniture && path.split("/").length > 2) continue;
      if (q.x < b.min.x - 0.25 || q.x > b.max.x + 0.25 || q.z < b.min.z - 0.25 || q.z > b.max.z + 0.25) continue;
      if (q.y < b.min.y - 0.6 || q.y > b.max.y + 0.6) continue;
      const a = (b.max.x - b.min.x) * (b.max.z - b.min.z);
      if (a < area) { area = a; best = path; }
    }
    return best;
  };

  /* ------------------------------------------------ materials */
  const srgb = (c) => { const x = c.clone(); return [x.r, x.g, x.b].map((v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055)); };
  const avgCache = new Map();
  const texAvg = (map) => {
    if (!map?.image) return [1, 1, 1];
    if (avgCache.has(map.uuid)) return avgCache.get(map.uuid);
    let a = [1, 1, 1];
    try {
      const cv = new OffscreenCanvas(16, 16), cx = cv.getContext("2d");
      cx.drawImage(map.image, 0, 0, 16, 16);
      const px = cx.getImageData(0, 0, 16, 16).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 30) { r += px[i]; g += px[i + 1]; b += px[i + 2]; n++; }
      if (n) a = [r / n / 255, g / n / 255, b / n / 255];
    } catch {}
    avgCache.set(map.uuid, a);
    return a;
  };
  const images = [], imageIds = new Map();
  const imageOf = (map) => {
    if (!map?.image) return -1;
    if (imageIds.has(map.uuid)) return imageIds.get(map.uuid);
    const img = map.image;
    const w0 = img.width || img.naturalWidth, h0 = img.height || img.naturalHeight;
    if (!w0 || !h0) return -1;
    const k = Math.min(1, 512 / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
    const cv = new OffscreenCanvas(w, h), cx = cv.getContext("2d");
    cx.drawImage(img, 0, 0, w, h);
    const px = cx.getImageData(0, 0, w, h).data;
    let s = "";
    for (let i = 0; i < px.length; i += 0x8000) s += String.fromCharCode.apply(null, px.subarray(i, i + 0x8000));
    const id = images.length;
    images.push({ w, h, flipY: map.flipY !== false, b64: btoa(s) });
    imageIds.set(map.uuid, id);
    return id;
  };
  // Roblox's look for each of the town's materials, by name
  const rbxOf = (name, m) => {
    const n = name || "";
    if (m.isMeshBasicMaterial || (m.emissive && m.emissive.getHex() > 0x444444 && !m.map)) return "Neon";
    if (m.transparent && m.opacity < 0.6) return "Glass";
    if (/brick/i.test(n)) return "Brick";
    if (/stone|rock|mesa/i.test(n)) return "Slate";
    if (/plaster/i.test(n)) return "Plaster";
    if (/roofTin|tin/i.test(n)) return "CorrugatedSteel";
    if (/shingle|roofDark/i.test(n)) return "RoofShingles";
    if (/iron|metal|steel|rail$/i.test(n) && m.metalness > 0.3) return "Metal";
    if (/gold|brass/i.test(n)) return "Foil";
    if (/sand|dirt|ground/i.test(n)) return "Sand";
    if (/grass/i.test(n)) return "Grass";
    if (/fabric|cloth|curtain|canvas|damask|felt|rug/i.test(n)) return "Fabric";
    if (m.map && m.userData?.tile) return "WoodPlanks";
    if (m.metalness > 0.4) return "Metal";
    return "SmoothPlastic";
  };
  const hex = (c) => (c == null ? "" : new THREE.Color(c).getHexString());
  const mats = [], matIds = new Map();
  // a texture that is a picture (sign, poster, painting) rather than a surface
  const pictured = (m) => !!m.map && !m.userData?.tile;
  // `glb`: a Blender model's material, named by its GLB: a tiled surface
  // with the chunk's paint, never a picture (Studio shows its average)
  const matOf = (m, tint, key = null, glb = null) => {
    const id0 = (glb || m.uuid) + "|" + (tint ?? "");
    if (matIds.has(id0)) return matIds.get(id0);
    const c = (m.color ? m.color.clone() : new THREE.Color(1, 1, 1));
    if (tint != null) c.multiply(new THREE.Color(tint));
    let col = srgb(c);
    const pic = !glb && pictured(m);
    if (m.map && !pic) { const a = texAvg(m.map); col = col.map((v, i) => v * a[i]); }
    const id = mats.length;
    mats.push({
      name: glb || m.name || m.type, key, tint: hex(tint), color: col.map((v) => +Math.min(1, v).toFixed(4)), rbx: rbxOf(glb || m.name, m),
      alpha: m.transparent ? +(m.opacity ?? 1).toFixed(3) : 1, cutout: (m.alphaTest || 0) > 0,
      img: pic ? imageOf(m.map) : -1, both: m.side === THREE.DoubleSide, pictured: pic,
    });
    matIds.set(id0, id);
    return id;
  };

  /* ------------------------------------------------ pieces */
  const parts = [], meshGroups = new Map();
  const toMesh = (path, mid, geo, matrix = null, live = false, piece = null) => {
    const key = path + "|" + mid + "|" + (live ? 1 : 0);
    let grp = meshGroups.get(key);
    if (!grp) meshGroups.set(key, (grp = { path, mat: mid, live, pieces: [], pieceTri: [], v: [], n: [], uv: [], tri: [] }));
    if (piece != null) grp.pieces.push(piece);
    const t0 = grp.tri.length / 3;
    const P = geo.attributes.position, N = geo.attributes.normal, UV = geo.attributes.uv;
    const base = grp.v.length / 3, p = new THREE.Vector3(), nm = matrix ? new THREE.Matrix3().getNormalMatrix(matrix) : null;
    const flat = !N ? geo.clone().toNonIndexed() : null;
    if (flat) { flat.computeVertexNormals(); }
    const G = flat || geo;
    const PP = G.attributes.position, NN = G.attributes.normal, UU = G.attributes.uv;
    for (let i = 0; i < PP.count; i++) {
      p.fromBufferAttribute(PP, i); if (matrix) p.applyMatrix4(matrix);
      grp.v.push(r4(p.x), r4(p.y), r4(p.z));
      p.fromBufferAttribute(NN, i); if (nm) p.applyMatrix3(nm).normalize();
      grp.n.push(+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3));
      grp.uv.push(UU ? r4(UU.getX(i)) : 0, UU ? r4(UU.getY(i)) : 0);
    }
    const flip = matrix && matrix.determinant() < 0;
    const idx = G.index;
    const n = idx ? idx.count : PP.count;
    for (let t = 0; t + 2 < n; t += 3) {
      const a = idx ? idx.getX(t) : t, b = idx ? idx.getX(t + 1) : t + 1, c = idx ? idx.getX(t + 2) : t + 2;
      if (flip) grp.tri.push(base + a, base + c, base + b); else grp.tri.push(base + a, base + b, base + c);
    }
    if (piece != null) grp.pieceTri.push({ piece, t0, t1: grp.tri.length / 3 });
  };
  // Studio's EditableMesh takes some 60k vertices: a bigger group goes to
  // Studio in several MeshParts, cut between pieces (a piece stays whole in
  // one group) or, for a live reference with no pieces, by triangles
  const VLIM = 48000;
  const splitBig = (grp) => {
    if (grp.v.length / 3 <= VLIM) return [grp];
    const out = [], ranges = grp.pieceTri.length ? grp.pieceTri : [{ piece: null, t0: 0, t1: grp.tri.length / 3 }];
    const fresh = () => ({ path: grp.path, mat: grp.mat, live: grp.live, pieces: [], pieceTri: [], v: [], n: [], uv: [], tri: [], remap: new Map() });
    let cur = null;
    for (const r of ranges) {
      const step = r.piece == null ? Math.floor(VLIM / 3) : r.t1 - r.t0;
      for (let t0 = r.t0; t0 < r.t1; t0 += step) {
        const t1 = Math.min(r.t1, t0 + step);
        if (!cur || cur.v.length / 3 + (t1 - t0) * 3 > VLIM) { cur = fresh(); out.push(cur); }
        if (r.piece != null) cur.pieces.push(r.piece);
        for (let t = t0 * 3; t < t1 * 3; t++) {
          const a = grp.tri[t];
          let j = cur.remap.get(a);
          if (j == null) {
            j = cur.v.length / 3; cur.remap.set(a, j);
            cur.v.push(grp.v[a * 3], grp.v[a * 3 + 1], grp.v[a * 3 + 2]);
            cur.n.push(grp.n[a * 3], grp.n[a * 3 + 1], grp.n[a * 3 + 2]);
            cur.uv.push(grp.uv[a * 2], grp.uv[a * 2 + 1]);
          }
          cur.tri.push(j);
        }
      }
    }
    for (const g of out) delete g.remap;
    return out;
  };
  const frame = (X, Y, Z) => [X, Y, Z].flatMap((v) => [r4(v.x), r4(v.y), r4(v.z)]);
  const asBox = (r) => {
    const [ax, ay, az] = r.nrm.map(V);
    if (Math.abs(ax.dot(ay)) > 1e-3 || Math.abs(ax.dot(az)) > 1e-3 || Math.abs(ay.dot(az)) > 1e-3) return null;
    const c = new THREE.Vector3(); for (const q of r.pts) c.add(V(q)); c.divideScalar(r.pts.length);
    const ext = [ax, ay, az].map((a) => { let lo = Infinity, hi = -Infinity; for (const q of r.pts) { const d = V(q).dot(a); lo = Math.min(lo, d); hi = Math.max(hi, d); } return hi - lo; });
    const Z = new THREE.Vector3().crossVectors(ax, ay);    // right-handed, whatever a mirror did
    return { k: "b", p: c.toArray().map(r4), f: frame(ax, ay, Z), s: ext.map(r4) };
  };
  const asCyl = (r) => {
    const { radialSegments: seg, heightSegments: hs = 1, openEnded, thetaLength = Math.PI * 2 } = r.params;
    if (openEnded || seg < 6 || Math.abs(thetaLength - Math.PI * 2) > 1e-3) return null;
    const ring = (row) => r.pts.slice(row * (seg + 1), row * (seg + 1) + seg).map(V);
    const top = ring(0), bot = ring(hs);
    const ct = top.reduce((a, b) => a.add(b), new THREE.Vector3()).divideScalar(seg);
    const cb = bot.reduce((a, b) => a.add(b), new THREE.Vector3()).divideScalar(seg);
    const axis = ct.clone().sub(cb), len = axis.length();
    if (len < 1e-4) return null;
    axis.normalize();
    const rt = top.map((q) => q.distanceTo(ct)), rb = bot.map((q) => q.distanceTo(cb));
    const R = rt[0];
    if ([...rt, ...rb].some((x) => Math.abs(x - R) > Math.max(0.004, R * 0.02))) return null;   // a cone or squashed
    const up = Math.abs(axis.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const Z = new THREE.Vector3().crossVectors(axis, up).normalize();
    const Y = new THREE.Vector3().crossVectors(Z, axis).normalize();
    return { k: "c", p: ct.clone().add(cb).multiplyScalar(0.5).toArray().map(r4), f: frame(axis, Y, Z), s: [r4(len), r4(R * 2), r4(R * 2)] };
  };
  const asBall = (r) => {
    const { widthSegments = 0, phiLength = Math.PI * 2, thetaLength = Math.PI } = r.params;
    if (widthSegments < 8 || Math.abs(phiLength - Math.PI * 2) > 1e-3 || Math.abs(thetaLength - Math.PI) > 1e-3) return null;
    const bb = new THREE.Box3(); for (const q of r.pts) bb.expandByPoint(V(q));
    const c = bb.getCenter(new THREE.Vector3()), d = r.pts.map((q) => V(q).distanceTo(c));
    const R = Math.max(...d);
    if (d.some((x) => Math.abs(x - R) > Math.max(0.004, R * 0.03))) return null;
    return { k: "s", p: c.toArray().map(r4), f: frame(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)), s: [r4(R * 2), r4(R * 2), r4(R * 2)] };
  };
  const stats = { box: 0, cyl: 0, ball: 0, mesh: 0, live: 0 };
  const pieces = [];
  for (const r of recs) {
    const mid = matOf(r.mat, r.color, r.key, r.glb ? r.key.split(":")[2] : null);
    let prim = null;
    if (!mats[mid].pictured) {
      if (r.type === "BoxGeometry" && r.nrm.length === 3) prim = asBox(r);
      else if (r.type === "CylinderGeometry") prim = asCyl(r);
      else if (r.type === "SphereGeometry") prim = asBall(r);
    }
    const piece = { i: r.i, key: r.key, tint: mats[mid].tint, shadow: r.shadow, live: r.live, pictured: mats[mid].pictured, path: r.path, prim: null, g: null };
    if (r.live) stats.live++;
    if (prim) {
      Object.assign(prim, { m: mid, path: r.path, i: r.i, live: r.live || undefined });
      parts.push(prim);
      piece.prim = prim;
      stats[{ b: "box", c: "cyl", s: "ball" }[prim.k]]++;
    } else { toMesh(r.path, mid, r.src, null, r.live, r.i); stats.mesh++; }
    if (GEOMETRY) {
      const g = r.src, P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv;
      piece.geo = {
        p: Array.from(P.array, r4),
        // a box's normals are flat: the Kit makes them again
        n: N && r.type !== "BoxGeometry" ? Array.from(N.array, (x) => +x.toFixed(4)) : null,
        uv: UV && (mats[mid].pictured || r.glb) ? Array.from(UV.array, r4) : null,
        idx: g.index ? Array.from(g.index.array) : null,
      };
      // a GLB chunk keeps its light-map UVs and its vertex paint: its
      // material is the model's, which reads both
      if (r.glb) {
        if (g.attributes.uv1 || g.attributes.uv2) piece.geo.uv2 = Array.from((g.attributes.uv1 || g.attributes.uv2).array, r4);
        if (g.attributes.color) piece.geo.c = Array.from(g.attributes.color.array, (x) => +x.toFixed(4));
      }
    }
    if (r.glb) piece.glb = r.key.split(":")[1];
    pieces.push(piece);
  }
  // the mesh groups, numbered; each piece knows its group
  const grouped = new Set(meshGroups.values());
  const meshes = [...grouped].flatMap(splitBig);
  meshes.forEach((grp, gi) => { for (const i of grp.pieces) pieces[i].g = gi; });

  // what the map drew without the Kit (the sheriff's badge, the posters, the
  // jail doors, the conductor's cap): live, shown in Studio for reference
  let other = 0;
  built.root.traverse((o) => {
    if (!o.isMesh || o.userData.__kit || o.userData.__glb) return;
    for (let q = o; q; q = q.parent) if (q.userData.__kit) return;
    if (!o.visible) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m || m.visible === false || m.colorWrite === false) return;
    const name = (o.name || o.parent?.name || m.name || "piece").replace(/[^\w]+/g, "_").slice(0, 30) || "piece";
    // the dressing pass (map-dressing.js) is scattered at load from the colliders: it follows the layout by itself
    if (/^dress_/.test(name)) return;
    if (o.geometry.type === "PlaneGeometry" && o.parent === built.root && o.geometry.parameters.width > 60) {
      const p = o.geometry.parameters;
      parts.push({ k: "b", p: [r4(o.position.x), -0.5, r4(o.position.z)], f: [1, 0, 0, 0, 1, 0, 0, 0, 1], s: [r4(p.width), 1, r4(p.height)], m: matOf(m), path: "Ground", name: "Ground", live: true });
      Object.assign(mats[parts.at(-1).m], { rbx: "Sand", color: srgb(new THREE.Color(map.ground?.colorA ?? 0xc8a272)).map((v) => +v.toFixed(4)) });
      return;
    }
    const centre = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).toArray();
    toMesh(owner(centre) || "Town", matOf(m), o.geometry, o.matrixWorld, true);
    other++;
  });
  // (groups added for the live objects after numbering)
  const meshesAll = [...meshes, ...[...meshGroups.values()].filter((g) => !grouped.has(g)).flatMap(splitBig)];

  const lights = [];
  built.root.traverse((o) => {
    if (!o.isPointLight && !o.isSpotLight) return;
    const p = o.getWorldPosition(new THREE.Vector3());
    lights.push({ p: p.toArray().map(r4), color: srgb(o.color), power: +o.intensity.toFixed(2), range: +(o.distance || 12).toFixed(2), path: owner(p.toArray()) });
  });

  /* ------------------------------------------------ markers */
  const markers = [];
  const mark = (kind, name, p, extra = {}) => markers.push({ i: markers.length, kind, name, p: p.map(r4), path: kind === "rp" ? owner(p, /^rp\.(seats|surfaces|arm)\./.test(name)) : null, ...extra });
  for (const [i, s] of (map.spawns || []).entries()) mark("spawn", `Spawn_${i + 1}`, [s[0], s[2] ?? 0, s[1]], { team: s[1] < 0 ? "north" : "south" });
  if (map.playerSpawn) mark("spawn", "PlayerSpawn", [map.playerSpawn.x, 0, map.playerSpawn.z]);
  const zl = map.zombieLayout?.();
  for (const [i, w] of (zl?.windows || []).entries()) mark("zombie", `ZombieIn_${i + 1}`, [w.x, w.y ?? 0, w.z]);
  // every { x, z } in the RP spec, named by where it sits in it, and every
  // { x0, x1, z0, z1 } (a zone) as a flat box (the names trollcity-studio.js
  // walkRp gives: a spec entry that's a function is called, nothing below)
  const seen = new Set();
  const walk = (v, name, depth) => {
    if (v == null || depth > 6) return;
    if (typeof v === "function") { if (depth) return; try { v = v(); } catch { return; } }
    if (typeof v !== "object" || seen.has(v)) return;
    if (!Array.isArray(v) && v.constructor && v.constructor !== Object) return;   // live objects (the train)
    seen.add(v);
    const y = typeof v.y === "number" ? v.y : typeof v.floor === "number" ? v.floor : typeof v.floorY === "number" ? v.floorY : 0;
    if (typeof v.x === "number" && typeof v.z === "number") {
      mark("rp", name, [v.x, y, v.z], { yaw: typeof v.yaw === "number" ? +v.yaw.toFixed(4) : null, label: v.name || v.kind || null });
    } else if ([v.x0, v.x1, v.z0, v.z1].every((n) => typeof n === "number")) {
      mark("rp", name, [(v.x0 + v.x1) / 2, y, (v.z0 + v.z1) / 2], { zone: [r4(v.x1 - v.x0), r4(v.z1 - v.z0)] });
    }
    for (const [k, c] of Object.entries(v)) walk(c, name + "." + k, depth + 1);
  };
  for (const [k, v] of Object.entries(map.rp || {})) walk(v, "rp." + k, 0);
  // (after the older kinds, so their numbers M stay what a place keeps)
  // S&D sites, climbing ropes (foot; the top and the side you step off are
  // attributes) and every flight of stairs (foot; its top an attribute)
  for (const s of map.bombSites || []) mark("site", `Site_${s.id}`, [s.x, s.y ?? 0, s.z]);
  for (const [i, r] of (arena.ropes || []).entries()) {
    mark("rope", `Rope_${i + 1}`, [r.x, r.y0, r.z], { top: r4(r.y1), dir: r.dx ? (r.dx > 0 ? "+x" : "-x") : (r.dz > 0 ? "+z" : "-z") });
  }
  for (const [i, s] of (built.stairs || []).filter((s) => !s.rope).entries()) {
    mark("stair", `Stair_${i + 1}`, [s.a.x, s.a.y, s.a.z], { to: [s.b.x, s.b.y, s.b.z].map(r4) });
  }

  const colOut = cols.map((c, i) => ({ i, min: c.min.map(r4), max: c.max.map(r4), pen: c.pen, live: c.live || undefined, path: c.path }));

  // models in the order Studio builds them
  const paths = [...new Set([...parts.map((p) => p.path), ...meshesAll.map((g) => g.path), ...colOut.map((c) => c.path),
    ...markers.map((m) => m.path).filter(Boolean)])].sort();
  return {
    index: {
      map: MAP, name: map.name, bounds: map.bounds, unit: "metre", paths, mats, lights, markers,
      parts: parts.length, meshes: meshesAll.map((g, i) => ({ i, path: g.path, mat: g.mat, live: g.live || undefined, verts: g.v.length / 3, tris: g.tri.length / 3 })),
      images: images.map((im, i) => ({ i, w: im.w, h: im.h, flipY: im.flipY, chars: im.b64.length })),
      colliders: colOut.length, stats: { ...stats, other, calls: calls.length, pieces: recs.length },
    },
    parts, meshes: meshesAll.map(({ pieces: _, pieceTri: __, ...g }) => g), images: images.map((im) => im.b64), colliders: colOut,
    pieces: GEOMETRY ? pieces : pieces.map(({ geo: _, ...p }) => p),
  };
}
