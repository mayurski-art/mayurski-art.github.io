// A TROLLS NFT character, as the game builds it, into Roblox Studio.
//
// Builds the token's blocky body in headless Chromium exactly as the game
// does (characters/blocky-body.js wearBlocky, optionally on a Roblox Studio
// body's pieces like tools/nft-lab.html ?pieces=), then serves, on
// 127.0.0.1 only, the rig's joint tree at rest and every visible mesh baked
// into its joint's frame (positions in metres, normals, UVs, vertex colours,
// textures as raw RGBA). tools/troll-ops-to-studio.luau, run in Studio, pulls
// it and builds TF_<token>: joint parts named like rig.parts on Motor6Ds, so
// the TF_Rig clips (AnimSaves) play on it. Inverted-hull ink outlines and
// hit capsules are left out. Meshes made in Studio from code live only in
// that session (they aren't saved with the place): run this again to re-import.
//
//   node tools/troll-ops-to-studio.mjs [--token 989] [--pieces rbx989] [--port 5298]
//
// Needs Playwright. Serves until Studio fetches /done (or 15 minutes pass).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require(path.join(process.execPath, "../../lib/node_modules/playwright"))); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const TOKEN = +arg("--token", 989);
const PIECES = arg("--pieces", TOKEN === 989 ? "rbx989" : "");
const PORT = +arg("--port", 5298);

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png",
  ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif" };
const PAGE = `<!doctype html><meta charset="utf-8"><script type="importmap">
{"imports":{"three":"/assets/vendor/three.module.min.js","three/addons/":"/assets/vendor/addons/"}}</script>`;

let data = null;   // { index, meshes: [json], textures: [base64 RGBA] }
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const send = (code, type, body) => { res.writeHead(code, { "content-type": type }); res.end(body); };
  if (url.pathname === "/__export.html") return send(200, "text/html", PAGE);
  if (url.pathname === "/index.json") return data ? send(200, "application/json", JSON.stringify(data.index)) : send(503, "text/plain", "not ready");
  let m;
  if ((m = url.pathname.match(/^\/mesh\/(\d+)\.json$/)) && data?.meshes[+m[1]]) return send(200, "application/json", JSON.stringify(data.meshes[+m[1]]));
  if ((m = url.pathname.match(/^\/tex\/(\d+)\.b64$/)) && data?.textures[+m[1]] != null) {
    // a slice at a time (?from=&len=): Studio's HttpService answers cap out at a few MB
    const t = data.textures[+m[1]];
    const from = +(url.searchParams.get("from") || 0), len = +(url.searchParams.get("len") || t.length);
    return send(200, "text/plain", t.slice(from, from + len));
  }
  if (url.pathname === "/done") { send(200, "text/plain", "bye"); console.log("Studio is done: closing"); setTimeout(() => process.exit(0), 200); return; }
  const p = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) return send(404, "text/plain", "");
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://127.0.0.1:${PORT}/__export.html`);
data = await page.evaluate(async ({ TOKEN, PIECES }) => {
  const THREE = await import("three");
  const C = await import("/assets/games/troll-ops/characters/character.js");
  const { DESIGN, wearBlocky } = await import("/assets/games/troll-ops/characters/blocky-body.js");
  // A Roblox Studio body's pieces on the token's garment (nft-lab.html setPieces).
  const garment = DESIGN.TRAIT_ART[DESIGN.TOKENS[TOKEN]?.clothes];
  if (PIECES && DESIGN.KITS[garment]) {
    const k = DESIGN.KITS[garment];
    k.legs = `legs-${PIECES}.glb`; k.torso = `torso-${PIECES}.glb`;
    k.plainArms = true; k.headLift = 0.03;
    DESIGN.flush();
  }
  const rig = C.buildHumanoid(new THREE.MeshStandardMaterial({ color: 0x222222 }), { height: 1.8, gun: false });
  await wearBlocky(rig, TOKEN);
  // let late loads (textures, GLB pieces) land
  await new Promise((r) => setTimeout(r, 1500));
  rig.root.updateMatrixWorld(true);

  // The joints, in the order a mesh claims its nearest one.
  const NAMES = ["hips", "torso", "spine", "chest", "neckPivot", "headPivot", "shoulderL", "armL", "elbowL", "wristL",
    "shoulderR", "armR", "elbowR", "wristR", "hipL", "kneeL", "ankleL", "ballL", "hipR", "kneeR", "ankleR", "ballR", "gunMount"];
  const byObj = new Map();
  for (const n of NAMES) if (rig.parts[n] && !byObj.has(rig.parts[n])) byObj.set(rig.parts[n], n);
  const jointOf = (o) => { for (let q = o.parent; q; q = q.parent) { if (byObj.has(q)) return byObj.get(q); if (q === rig.root) return "root"; } return "root"; };
  const inv = new THREE.Matrix4(), rel = new THREE.Matrix4(), pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
  const rootInv = new THREE.Matrix4().copy(rig.root.matrixWorld).invert();
  const worldOf = (n) => (n === "root" ? rig.root.matrixWorld : rig.parts[n].matrixWorld);
  const joints = [];
  for (const [obj, n] of byObj) {
    const parent = jointOf(obj);
    rel.copy(inv.copy(worldOf(parent)).invert()).multiply(obj.matrixWorld);
    rel.decompose(pos, quat, scl);
    joints.push({ name: n, parent, p: pos.toArray(), q: quat.toArray() });
  }

  // Textures: raw RGBA, at most 1024 px a side, shared by uuid.
  const texIds = new Map(), textures = [], texSize = [];
  const texOf = (map) => {
    if (!map?.image) return -1;
    if (texIds.has(map.uuid)) return texIds.get(map.uuid);
    const img = map.image;
    const w0 = img.width || img.naturalWidth, h0 = img.height || img.naturalHeight;
    if (!w0 || !h0) return -1;
    const k = Math.min(1, 1024 / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
    const cv = new OffscreenCanvas(w, h), cx = cv.getContext("2d");
    // three flips image textures on upload (flipY); the raw pixels are top row first, as Roblox wants
    cx.drawImage(img, 0, 0, w, h);
    const px = cx.getImageData(0, 0, w, h).data;
    let s = "";
    for (let i = 0; i < px.length; i += 0x8000) s += String.fromCharCode.apply(null, px.subarray(i, i + 0x8000));
    const id = textures.length;
    textures.push(btoa(s));
    texSize.push([w, h, map.flipY !== false]);
    texIds.set(map.uuid, id);
    return id;
  };

  const meshes = [];
  const visibleChain = (o) => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
  rig.root.traverse((o) => {
    // (the blocky body hides the stick troll's mitts by their layers, not visibility)
    if (!o.isMesh || !o.geometry || o.userData.isHitProxy || !visibleChain(o) || o.layers.mask === 0) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const g = o.geometry.index ? o.geometry : o.geometry; // indexed or not, handled below
    const joint = jointOf(o);
    rel.copy(inv.copy(worldOf(joint)).invert()).multiply(o.matrixWorld);
    const nrm = new THREE.Matrix3().getNormalMatrix(rel);
    const P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv, COL = g.attributes.color;
    const groups = g.groups?.length ? g.groups : [{ start: 0, count: g.index ? g.index.count : P.count, materialIndex: 0 }];
    for (const grp of groups) {
      const mat = mats[grp.materialIndex ?? 0] || mats[0];
      if (!mat || mat.visible === false || mat.side === THREE.BackSide || mat.colorWrite === false) continue;
      if (mat.opacity === 0) continue;
      const remap = new Map(), v = [], n = [], uv = [], col = [], tri = [];
      const take = (i) => {
        if (remap.has(i)) return remap.get(i);
        const k = remap.size;
        remap.set(i, k);
        pos.fromBufferAttribute(P, i).applyMatrix4(rel);
        v.push(+pos.x.toFixed(5), +pos.y.toFixed(5), +pos.z.toFixed(5));
        if (N) { scl.fromBufferAttribute(N, i).applyMatrix3(nrm).normalize(); n.push(+scl.x.toFixed(4), +scl.y.toFixed(4), +scl.z.toFixed(4)); }
        if (UV) uv.push(+UV.getX(i).toFixed(5), +UV.getY(i).toFixed(5));
        if (COL) col.push(+COL.getX(i).toFixed(3), +COL.getY(i).toFixed(3), +COL.getZ(i).toFixed(3));
        return k;
      };
      const flip = rel.determinant() < 0;
      for (let t = grp.start; t + 2 < grp.start + grp.count; t += 3) {
        const a = g.index ? g.index.getX(t) : t, b = g.index ? g.index.getX(t + 1) : t + 1, c = g.index ? g.index.getX(t + 2) : t + 2;
        const ia = take(a), ib = take(b), ic = take(c);
        if (flip) tri.push(ia, ic, ib); else tri.push(ia, ib, ic);
      }
      if (!tri.length) continue;
      const c = mat.color ? mat.color.clone() : new THREE.Color(1, 1, 1);
      meshes.push({
        name: (o.name || o.parent?.name || "piece").slice(0, 40), joint,
        color: [c.r, c.g, c.b].map((x) => +x.toFixed(4)),   // linear
        tex: texOf(mat.map), transparent: !!mat.transparent || mat.alphaTest > 0, opacity: mat.opacity ?? 1,
        doubleSided: mat.side === THREE.DoubleSide,
        v, n: n.length ? n : null, uv: uv.length ? uv : null, col: col.length ? col : null, tri,
      });
    }
  });
  const index = {
    token: TOKEN, pieces: PIECES || null, garment: garment || null,
    joints, meshes: meshes.map((m, i) => ({ i, name: m.name, joint: m.joint, verts: m.v.length / 3, tris: m.tri.length / 3, tex: m.tex })),
    textures: texSize.map(([w, h, flipY], i) => ({ i, w, h, flipY, chars: textures[i].length })),
  };
  return { index, meshes, textures };
}, { TOKEN, PIECES });
await browser.close();
if (errors.length) console.log("page errors:\n  " + errors.join("\n  "));
const tris = data.index.meshes.reduce((s, m) => s + m.tris, 0);
console.log(`TROLLS #${TOKEN}${PIECES ? ` on ${PIECES}` : ""}: ${data.index.joints.length} joints, ${data.index.meshes.length} meshes (${tris} triangles), ${data.index.textures.length} textures`);
for (const m of data.index.meshes) console.log(`  ${String(m.i).padStart(2)} ${m.joint.padEnd(10)} ${String(m.tris).padStart(6)} tris  tex ${m.tex}  ${m.name}`);
console.log(`serving on http://127.0.0.1:${PORT}/index.json: run tools/troll-ops-to-studio.luau in Studio`);
setTimeout(() => { console.log("timed out"); process.exit(0); }, 15 * 60 * 1000);
