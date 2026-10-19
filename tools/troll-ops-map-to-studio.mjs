// A Troll Forces map, as the game builds it, into Roblox Studio (for now:
// Troll City, the one built by trollcity-kit.js's Kit).
//
// Builds the map in headless Chromium exactly as the game does (maps.js
// buildMap), with the Kit watched: every piece the map draws is recorded
// with the call that drew it (shop, wagon, tableSet ...), so Studio gets
// one Model per building and per prop instead of one mesh per material.
// The served copies of trollcity.js / trollcity-kit.js get a one-line
// call marker at the top of each builder and their materials named; the
// files on disk are never touched.
//
// What Studio gets (tools/troll-ops-map-to-studio.luau builds it):
//   parts    boxes, round cylinders and balls as real Parts (saved with
//            the place, editable like any Part)
//   meshes   everything else (tubes, rings, lathes, signs, posters) as
//            EditableMesh MeshParts, merged per model and material; their
//            data is kept in the place, so TC_Restore rebuilds them after
//            the place is reopened
//   colliders the game's own collision boxes (Colliders folder)
//   markers  spawns, zombie windows, lights and every RP spot (Markers)
// 1 m = 3 studs. Same axes as three.js (y up, -z north).
//
//   node tools/troll-ops-map-to-studio.mjs [--map trollcity] [--port 5299] [--out .claude/roblox-export/trollcity]
//
// Needs Playwright. Writes the export to --out, then serves it on
// 127.0.0.1 until Studio fetches /done (or 30 minutes pass).
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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MAP = arg("--map", "trollcity");
const PORT = +arg("--port", 5299);
const OUT = path.resolve(ROOT, arg("--out", `.claude/roblox-export/${MAP}`));
const NO_SERVE = process.argv.includes("--no-serve");

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png",
  ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif",
  ".luau": "text/plain", ".b64": "text/plain" };
const PAGE = `<!doctype html><meta charset="utf-8"><script type="importmap">
{"imports":{"three":"/assets/vendor/three.module.min.js","three/addons/":"/assets/vendor/addons/"}}</script>`;

/* The served copies: a call marker at the top of every top-level builder
   that takes the Kit (function name(K, ...) {), so a piece knows which call
   drew it, and the materials named after their keys. */
const WATCHED = { "assets/games/troll-ops/maps/trollcity.js": "trollcity", "assets/games/troll-ops/maps/trollcity-kit.js": "kit" };
function instrument(src, file) {
  src = src.replace(/^((?:export )?function (\w+)\(K\b[^\n]*?\)\s*\{)/gm, (m, head, name) => `${head} globalThis.__tcCall && globalThis.__tcCall("${file}:${name}");`);
  if (file === "trollcity") {
    src = src.replace(/(M\.trollGold = [^\n]*\n)(\s*return M;)/, `$1  for (const k in M) { const v = M[k]; if (v?.isMaterial) v.name ||= k; else if (Array.isArray(v)) v.forEach((m, i) => m?.isMaterial && (m.name ||= k + i)); }\n$2`);
    src = src.replace(/(function sign\(text, sub = "", o = \{\}\) \{\n\s*return )(texMat\([^\n]*\));/, `$1Object.assign($2, { name: "sign:" + text });`);
  }
  return src;
}

let exported = false;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const send = (code, type, body) => { res.writeHead(code, { "content-type": type }); res.end(body); };
  if (url.pathname === "/__export.html") return send(200, "text/html", PAGE);
  if (url.pathname === "/done") { send(200, "text/plain", "bye"); console.log("Studio is done: closing"); setTimeout(() => process.exit(0), 200); return; }
  if (url.pathname.startsWith("/x/")) {
    // the export, a slice at a time (?from=&len=): Studio's HttpService answers cap out at a few MB
    if (!exported) return send(503, "text/plain", "not ready");
    const p = path.join(OUT, path.basename(url.pathname));
    if (!fs.existsSync(p)) return send(404, "text/plain", "");
    const t = fs.readFileSync(p, "utf8");
    const from = +(url.searchParams.get("from") || 0), len = +(url.searchParams.get("len") || t.length);
    return send(200, "text/plain", t.slice(from, from + len));
  }
  const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const p = path.join(ROOT, rel);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) return send(404, "text/plain", "");
  const key = rel.replace(/\\/g, "/");
  if (WATCHED[key]) return send(200, "text/javascript", instrument(fs.readFileSync(p, "utf8"), WATCHED[key]));
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

const kitUrl = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/maps/trollcity.js"), "utf8").match(/"\.\/(trollcity-kit\.js\?v=[^"]+)"/)[1];
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://127.0.0.1:${PORT}/__export.html`);

const data = await page.evaluate(async ({ MAP, kitUrl }) => {
  Error.stackTraceLimit = 200;
  const THREE = await import("three");
  const kit = await import("/assets/games/troll-ops/maps/" + kitUrl);

  /* ------------------------------------------------ who drew what */
  // A call is known by its name and stack depth: two calls of one builder
  // at one depth can't be live together, so the newest is the one running.
  const frames = () => new Error().stack.split("\n").slice(1).map((l) => {
    const m = l.match(/at (?:Kit\.)?([\w$]+) \(.*\/(trollcity-kit|trollcity)\.js/);
    return m ? `${m[2] === "trollcity-kit" ? "kit" : "trollcity"}:${m[1]}` : null;
  });
  const live = new Map(), calls = [];
  globalThis.__tcCall = (name) => {
    const f = frames();             // f[0] frames, f[1] __tcCall, f[2] the builder
    const id = calls.length;
    calls.push(name);
    live.set(name + "@" + (f.length - 2), id);
  };
  const chainNow = () => {
    const f = frames(), out = [];
    for (let i = f.length - 1; i >= 0; i--) {
      if (!f[i]) continue;
      const id = live.get(f[i] + "@" + (f.length - i));
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
    const chain = chainNow();
    const g = add0.call(this, mat, geo, o);
    recs.push({ type, params, pts, nrm, mat, color: o?.color ?? null, chain, g, root: this.root });
    return g;
  };
  const flush0 = kit.Kit.prototype.flush;
  kit.Kit.prototype.flush = function () {
    // keep each piece's own geometry: flush() disposes it after merging
    for (const r of recs) if (!r.keep) r.keep = r.g.clone();
    const before = new Set(this.root.children);
    flush0.call(this);
    for (const c of this.root.children) if (!before.has(c)) c.userData.__kit = true;
  };

  const { buildMap, MAPS } = await import("/assets/games/troll-ops/maps/maps.js");
  const colliders = [], arena = {};
  const built = buildMap(MAP, { colliders, arena });
  // late loads (the gallery's art)
  await new Promise((r) => setTimeout(r, 2500));
  built.root.updateMatrixWorld(true);
  const map = MAPS[MAP];

  const V = (a) => new THREE.Vector3(...a);

  /* ------------------------------------------------ models */
  // Which builders fold into the one that called them (pieces of a
  // building, not things you'd move on their own).
  const FOLD = new Set(["wall", "room", "slabWithHole", "railing", "gableRoof", "signBoard", "wallPic", "api_stairs",
    "boardwalk", "flat", "seatAt", "benchSeats", "materials"].flatMap((n) => [`trollcity:${n}`, `kit:${n}`]));
  const SECTION = (n) => /^trollcity:(build[A-Z]\w*|hangPictures|rpFurniture)$/.test(n) && n !== "trollcity:buildTrollCity";
  const nice = (n) => n.split(":")[1].replace(/^build/, "").replace(/^kit/, "").replace(/^(.)/, (c) => c.toUpperCase());
  const counts = new Map();
  const modelOf = new Map();          // call id -> model path
  const pathOf = (chain) => {
    // (and a wrapper calling its namesake: trollcity's chair is the kit's chair)
    const kept = chain.filter((id, i) => !FOLD.has(calls[id]) && !(i && nice(calls[chain[i - 1]]) === nice(calls[id])));
    let s = kept.findIndex((id) => SECTION(calls[id]));
    const out = [];
    if (s < 0) { out.push("Town"); s = kept.findIndex((id) => calls[id] === "trollcity:buildTrollCity"); }
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
  const mats = [], matIds = new Map();
  // a texture that is a picture (sign, poster, painting) rather than a surface
  const pictured = (m) => !!m.map && (m.userData?.decal || !m.userData?.tile) && !/^(damask|roof|stripes)/.test(m.name || "");
  const matOf = (m, tint) => {
    const key = m.uuid + "|" + (tint ?? "");
    if (matIds.has(key)) return matIds.get(key);
    const c = (m.color ? m.color.clone() : new THREE.Color(1, 1, 1));
    if (tint != null) c.multiply(new THREE.Color(tint));
    let col = srgb(c);
    const pic = pictured(m);
    if (m.map && !pic) { const a = texAvg(m.map); col = col.map((v, i) => v * a[i]); }
    const id = mats.length;
    mats.push({
      name: m.name || m.type, color: col.map((v) => +Math.min(1, v).toFixed(4)), rbx: rbxOf(m.name, m),
      alpha: m.transparent ? +(m.opacity ?? 1).toFixed(3) : 1, cutout: (m.alphaTest || 0) > 0,
      img: pic ? imageOf(m.map) : -1, both: m.side === THREE.DoubleSide,
    });
    matIds.set(key, id);
    return id;
  };

  /* ------------------------------------------------ pieces */
  const r4 = (x) => +x.toFixed(4);
  const parts = [], meshGroups = new Map();
  const toMesh = (path, mid, geo, matrix = null) => {
    const key = path + "|" + mid;
    let grp = meshGroups.get(key);
    if (!grp) meshGroups.set(key, (grp = { path, mat: mid, v: [], n: [], uv: [], tri: [] }));
    const P = geo.attributes.position, N = geo.attributes.normal, UV = geo.attributes.uv;
    const base = grp.v.length / 3, p = new THREE.Vector3(), nm = matrix ? new THREE.Matrix3().getNormalMatrix(matrix) : null;
    for (let i = 0; i < P.count; i++) {
      p.fromBufferAttribute(P, i); if (matrix) p.applyMatrix4(matrix);
      grp.v.push(r4(p.x), r4(p.y), r4(p.z));
      if (N) { p.fromBufferAttribute(N, i); if (nm) p.applyMatrix3(nm).normalize(); grp.n.push(+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)); }
      else grp.n.push(0, 1, 0);
      grp.uv.push(UV ? r4(UV.getX(i)) : 0, UV ? r4(UV.getY(i)) : 0);
    }
    const flip = matrix && matrix.determinant() < 0;
    const idx = geo.index;
    const n = idx ? idx.count : P.count;
    for (let t = 0; t + 2 < n; t += 3) {
      const a = idx ? idx.getX(t) : t, b = idx ? idx.getX(t + 1) : t + 1, c = idx ? idx.getX(t + 2) : t + 2;
      if (flip) grp.tri.push(base + a, base + c, base + b); else grp.tri.push(base + a, base + b, base + c);
    }
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
  const stats = { box: 0, cyl: 0, ball: 0, mesh: 0 };
  // What a section drew itself (the station, the stable, the houses) is
  // split into the clumps that touch: one model a building.
  // a Kit drawing into its own group (the train's cars) is placed by that
  // group: train.js stands the train at the station
  for (const r of recs) {
    const mw = r.root.matrixWorld;
    if (mw.equals(new THREE.Matrix4())) continue;
    r.keep.applyMatrix4(mw);
    r.pts = r.pts.map((q) => V(q).applyMatrix4(mw).toArray());
    r.nrm = r.nrm.map((q) => V(q).transformDirection(mw).toArray());
  }
  for (const r of recs) r.path = pathOf(r.chain);
  {
    const loose = recs.filter((r) => !r.path.includes("/"));
    const bb = loose.map((r) => { r.keep.computeBoundingBox(); return r.keep.boundingBox.clone().expandByScalar(0.08); });
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
    const n = new Map();
    for (const idx of groups.values()) {
      const box = new THREE.Box3(); for (const i of idx) box.union(bb[i]);
      const size = box.getSize(new THREE.Vector3());
      const kind = size.y > 2.5 && Math.max(size.x, size.z) > 3 ? "Building" : Math.max(size.x, size.z) > 6 ? "Ground" : "Bits";
      const sec = loose[idx[0]].path;
      const k = sec + "/" + kind;
      n.set(k, (n.get(k) || 0) + 1);
      for (const i of idx) loose[i].path = `${k}_${n.get(k)}`;
    }
  }
  for (const r of recs) {
    const path = r.path;
    const mid = matOf(r.mat, r.color);
    let prim = null;
    if (mats[mid].img < 0) {
      if (r.type === "BoxGeometry" && r.nrm.length === 3) prim = asBox(r);
      else if (r.type === "CylinderGeometry") prim = asCyl(r);
      else if (r.type === "SphereGeometry") prim = asBall(r);
    }
    if (prim) {
      prim.m = mid; prim.path = path;
      parts.push(prim);
      stats[{ b: "box", c: "cyl", s: "ball" }[prim.k]]++;
    } else { toMesh(path, mid, r.keep); stats.mesh++; }
  }

  // what the map drew without the Kit: the ground, the dressing, the train
  let other = 0;
  built.root.traverse((o) => {
    if (!o.isMesh || o.userData.__kit) return;
    for (let q = o; q; q = q.parent) if (q.userData.__kit) return;
    if (!o.visible) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m || m.visible === false || m.colorWrite === false) return;
    const name = (o.name || o.parent?.name || m.name || "piece").replace(/[^\w]+/g, "_").slice(0, 30) || "piece";
    // the dressing pass (map-dressing.js) is scattered at load from the colliders: it follows the layout by itself
    if (/^dress_/.test(name)) return;
    if (o.geometry.type === "PlaneGeometry" && o.parent === built.root && o.geometry.parameters.width > 60) {
      const p = o.geometry.parameters;
      parts.push({ k: "b", p: [r4(o.position.x), -0.5, r4(o.position.z)], f: [1, 0, 0, 0, 1, 0, 0, 0, 1], s: [r4(p.width), 1, r4(p.height)], m: matOf(m), path: "Ground", name: "Ground" });
      Object.assign(mats[parts.at(-1).m], { rbx: "Sand", color: srgb(new THREE.Color(map.ground?.colorA ?? 0xc8a272)).map((v) => +v.toFixed(4)) });
      return;
    }
    const mid = matOf(m);
    if (o.isInstancedMesh) {
      const im = new THREE.Matrix4(), w = new THREE.Matrix4();
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, im); w.multiplyMatrices(o.matrixWorld, im); toMesh("Dressing/" + name, mid, o.geometry, w); }
    } else toMesh("Other/" + name, mid, o.geometry, o.matrixWorld);
    other++;
  });

  const lights = [];
  built.root.traverse((o) => {
    if (!o.isPointLight && !o.isSpotLight) return;
    const p = o.getWorldPosition(new THREE.Vector3());
    lights.push({ p: p.toArray().map(r4), color: srgb(o.color), power: +o.intensity.toFixed(2), range: +(o.distance || 12).toFixed(2) });
  });

  /* ------------------------------------------------ markers */
  const markers = [];
  const mark = (kind, name, p, extra = {}) => markers.push({ kind, name, p: p.map(r4), ...extra });
  for (const [i, s] of (map.spawns || []).entries()) mark("spawn", `Spawn_${i + 1}`, [s[0], s[2] ?? 0, s[1]], { team: s[1] < 0 ? "north" : "south" });
  if (map.playerSpawn) mark("spawn", "PlayerSpawn", [map.playerSpawn.x, 0, map.playerSpawn.z]);
  const zl = map.zombieLayout?.();
  for (const [i, w] of (zl?.windows || []).entries()) mark("zombie", `ZombieIn_${i + 1}`, [w.x, w.y ?? 0, w.z]);
  // every { x, z } in the RP spec, named by where it sits in it
  const seen = new Set();
  const walk = (v, name, depth) => {
    if (v == null || depth > 6) return;
    if (typeof v === "function") { try { v = v(); } catch { return; } }
    if (typeof v !== "object" || seen.has(v)) return;
    if (!Array.isArray(v) && v.constructor && v.constructor !== Object) return;   // live objects (the train)
    seen.add(v);
    if (typeof v.x === "number" && typeof v.z === "number") {
      const y = typeof v.y === "number" ? v.y : typeof v.floor === "number" ? v.floor : typeof v.floorY === "number" ? v.floorY : 0;
      mark("rp", name, [v.x, y, v.z], { yaw: typeof v.yaw === "number" ? +v.yaw.toFixed(4) : null, label: v.name || v.kind || null });
    }
    for (const [k, c] of Object.entries(v)) walk(c, name + "." + k, depth + 1);
  };
  for (const [k, v] of Object.entries(map.rp || {})) walk(v, "rp." + k, 0);

  const cols = colliders.map((c) => ({ min: c.min.toArray().map(r4), max: c.max.toArray().map(r4), pen: c.pen }));

  // models in the order Studio builds them
  const paths = [...new Set([...parts.map((p) => p.path), ...[...meshGroups.values()].map((g) => g.path)])].sort();
  const meshes = [...meshGroups.values()];
  return {
    index: {
      map: MAP, name: map.name, bounds: map.bounds, unit: "metre", paths, mats, lights, markers,
      parts: parts.length, meshes: meshes.map((g, i) => ({ i, path: g.path, mat: g.mat, verts: g.v.length / 3, tris: g.tri.length / 3 })),
      images: images.map((im, i) => ({ i, w: im.w, h: im.h, flipY: im.flipY, chars: im.b64.length })),
      colliders: cols.length, stats: { ...stats, other, calls: calls.length },
    },
    parts, meshes, images: images.map((im) => im.b64), colliders: cols,
  };
}, { MAP, kitUrl });
await browser.close();
if (errors.length) console.log("page errors:\n  " + errors.join("\n  "));

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.rmSync(path.join(OUT, f));
const CHUNK = 1500;
data.index.partChunks = Math.ceil(data.parts.length / CHUNK);
for (let i = 0; i < data.index.partChunks; i++) fs.writeFileSync(path.join(OUT, `parts-${i}.json`), JSON.stringify(data.parts.slice(i * CHUNK, (i + 1) * CHUNK)));
data.meshes.forEach((m, i) => fs.writeFileSync(path.join(OUT, `mesh-${i}.json`), JSON.stringify(m)));
data.images.forEach((b, i) => fs.writeFileSync(path.join(OUT, `img-${i}.b64`), b));
fs.writeFileSync(path.join(OUT, "colliders.json"), JSON.stringify(data.colliders));
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(data.index));
exported = true;
const st = data.index.stats, tris = data.index.meshes.reduce((s, m) => s + m.tris, 0);
console.log(`${data.index.name}: ${data.index.parts} parts (${st.box} boxes, ${st.cyl} cylinders, ${st.ball} balls), ` +
  `${data.index.meshes.length} meshes (${tris} tris), ${data.index.images.length} images, ${data.index.colliders} colliders, ` +
  `${data.index.markers.length} markers, ${data.index.lights.length} lights, ${data.index.paths.length} models -> ${path.relative(ROOT, OUT)}`);
if (NO_SERVE) { server.close(); process.exit(0); }
console.log(`serving on http://127.0.0.1:${PORT}: run tools/troll-ops-map-to-studio.luau in Studio`);
setTimeout(() => { console.log("30 minutes: closing"); process.exit(0); }, 30 * 60 * 1000);
