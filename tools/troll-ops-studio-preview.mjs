// Troll Forces: an NFT body as the game builds it, sent into Roblox Studio to
// stand beside its Studio source (user, 2026-10-20: "i want to see the build
// on roblox studio"). Opens tools/nft-lab.html?token=<id> headless, takes
// every visible mesh of the lab's troll (world space, the ink shells left
// out), and serves them on 127.0.0.1 for tools/troll-ops-studio-preview.luau
// to build as MeshParts (EditableMesh + EditableImage: they live while that
// Studio session is open, not saved with the place).
//
//   node tools/troll-ops-studio-preview.mjs <token> [--port 5297] [--studs 0.26]
//
// --studs: metres per stud (the Studio body's own scale, the kit's fit).
// Serves /manifest, /mesh?i=, /tex?i= (base64 raw RGBA, top row first), /done.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args.splice(i, 2)[1]; };
const PORT = +opt("--port", "5297");
const STUDS = +opt("--studs", "0.26");
const TOKEN = args[0];
if (!TOKEN) { console.error("usage: troll-ops-studio-preview.mjs <token> [--port 5297] [--studs 0.26]"); process.exit(2); }
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const require = createRequire(path.join(process.env.NODE_PATH || path.join(ROOT, "node_modules"), "x.js"));
const { chromium } = require("playwright");

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".png": "image/png", ".glb": "model/gltf-binary", ".json": "application/json", ".css": "text/css", ".webp": "image/webp", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };
const site = http.createServer((q, r) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(q.url, "http://x").pathname));
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" }); r.end(d); });
});
await new Promise((r) => site.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
await ctx.route(/supabase|publicnode|pinata/, (r) => r.abort());   // never a live room
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("page error:", e.message));
await page.goto(`http://127.0.0.1:${site.address().port}/tools/nft-lab.html?token=${TOKEN}`);
await page.waitForFunction(() => window.__lab, null, { timeout: 30000 });
await page.waitForTimeout(9000);

const scene = await page.evaluate(async (STUDS) => {
  const { mine } = window.__lab;
  const root = mine.rig.root;
  root.updateMatrixWorld(true);
  const rootInv = root.matrixWorld.clone().invert();
  const shown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return o.layers.mask & 1; };
  const texOf = (m) => m.map || m.uniforms?.uMap?.value || m.uniforms?.map?.value || null;
  const texIds = new Map(), textures = [], meshes = [];
  // a clamped texture whose mesh reads past its edges (the chest print's
  // decal, its margin on the texture's see-through edge) is padded out to
  // the UVs' range, and those UVs squeezed into it: Studio tiles instead
  const texture = (t, range) => {
    const key = range ? `${t.id}:${range.join(",")}` : t;
    if (!texIds.has(key)) {
      const img = t.image, w0 = img.width || img.naturalWidth, h0 = img.height || img.naturalHeight;
      const [u0, v0, u1, v1] = range || [0, 0, 1, 1];
      const k = Math.min(1, 1024 / Math.max(w0 * (u1 - u0), h0 * (v1 - v0)));
      const w = Math.max(1, Math.round(w0 * (u1 - u0) * k)), h = Math.max(1, Math.round(h0 * (v1 - v0) * k));
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const g = c.getContext("2d");
      g.drawImage(img, -u0 * w0 * k, -v0 * h0 * k, w0 * k, h0 * k);
      const px = g.getImageData(0, 0, w, h).data;
      let s = "";
      for (let i = 0; i < px.length; i += 0x8000) s += String.fromCharCode.apply(null, px.subarray(i, i + 0x8000));
      texIds.set(key, textures.length);
      textures.push({ w, h, b64: btoa(s) });
    }
    return texIds.get(key);
  };
  root.traverse((o) => {
    if (!o.isMesh || !shown(o)) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m || m.side === 1) return;   // BackSide: an ink shell
    const geo = o.geometry, pos = geo.attributes.position, uv = geo.attributes.uv;
    if (!pos) return;
    const t = texOf(m);
    const flip = o.matrixWorld.determinant() < 0;   // a mirrored piece (the head): its winding turned back
    const v = [], u = [], f = [];
    const vec = { x: 0, y: 0, z: 0 };
    // in the troll's own frame (the lab may turn it): the body tool's, Studio's too
    const e = o.matrixWorld.clone().premultiply(rootInv).elements;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      // metres -> studs; facing -Z with the right arm on +X, as the Studio export
      const wx = e[0] * x + e[4] * y + e[8] * z + e[12], wy = e[1] * x + e[5] * y + e[9] * z + e[13], wz = e[2] * x + e[6] * y + e[10] * z + e[14];
      v.push(+(wx / STUDS).toFixed(4), +(wy / STUDS).toFixed(4), +(wz / STUDS).toFixed(4));
      if (uv && t) {
        vec.x = uv.getX(i); vec.y = uv.getY(i);
        if (t.matrixAutoUpdate) t.updateMatrix();
        const me = t.matrix.elements;
        let a = me[0] * vec.x + me[3] * vec.y + me[6], b = me[1] * vec.x + me[4] * vec.y + me[7];
        // Studio's UV origin is the image's top left
        if (t.flipY) b = 1 - b;
        u.push(+a.toFixed(5), +b.toFixed(5));
      }
    }
    let range = null;
    if (u.length && t.wrapS === 1001) {   // ClampToEdgeWrapping
      let u0 = 1, v0 = 1, u1 = 0, v1 = 0;
      for (let i = 0; i < u.length; i += 2) { u0 = Math.min(u0, u[i]); u1 = Math.max(u1, u[i]); v0 = Math.min(v0, u[i + 1]); v1 = Math.max(v1, u[i + 1]); }
      if (u0 < -0.001 || v0 < -0.001 || u1 > 1.001 || v1 > 1.001) {
        range = [u0, v0, u1, v1].map((x) => +x.toFixed(4));
        for (let i = 0; i < u.length; i += 2) { u[i] = +((u[i] - u0) / (u1 - u0)).toFixed(5); u[i + 1] = +((u[i + 1] - v0) / (v1 - v0)).toFixed(5); }
      }
    }
    const idx = geo.index ? geo.index.array : Array.from({ length: pos.count }, (_, i) => i);
    for (let i = 0; i + 2 < idx.length; i += 3) f.push(...(flip ? [idx[i], idx[i + 2], idx[i + 1]] : [idx[i], idx[i + 1], idx[i + 2]]));
    const col = m.color ? "#" + m.color.getHexString() : "#ffffff";
    meshes.push({ name: o.name || o.parent?.name || "piece", v, u: u.length ? u : null, f, tex: t ? texture(t, range) : null, color: col,
      alpha: !!(m.transparent || m.alphaTest > 0) });
  });
  return { meshes, textures };
}, STUDS);
await browser.close();
// an EditableMesh holds at most 20k triangles: bigger pieces in parts
const MAX_TRIS = 18000;
scene.meshes = scene.meshes.flatMap((m) => {
  if (m.f.length / 3 <= MAX_TRIS) return [m];
  const out = [];
  for (let i = 0; i < m.f.length; i += MAX_TRIS * 3) out.push({ ...m, f: m.f.slice(i, i + MAX_TRIS * 3) });
  return out;
});
site.close();
const tris = scene.meshes.reduce((n, m) => n + m.f.length / 3, 0);
console.log(`${scene.meshes.length} meshes, ${tris} triangles, ${scene.textures.length} textures`);
for (const m of scene.meshes) console.log(`  ${m.name.padEnd(16)} ${m.f.length / 3} tris${m.tex != null ? `, tex ${m.tex}` : ""}${m.alpha ? ", cut-out" : ""}`);

const server = http.createServer((q, r) => {
  const u = new URL(q.url, "http://x"), i = +u.searchParams.get("i");
  const send = (body) => { r.writeHead(200, { "content-type": "application/json" }); r.end(body); };
  if (u.pathname === "/manifest") return send(JSON.stringify({ token: TOKEN, meshes: scene.meshes.length, textures: scene.textures.map(({ w, h }) => ({ w, h })) }));
  if (u.pathname === "/mesh") return send(JSON.stringify(scene.meshes[i]));
  if (u.pathname === "/tex") return send(scene.textures[i].b64);
  if (u.pathname === "/done") { send("{}"); console.log("done"); server.close(); return; }
  r.writeHead(404); r.end();
});
server.listen(PORT, "127.0.0.1", () => console.log(`serving on 127.0.0.1:${PORT}; run tools/troll-ops-studio-preview.luau in Studio`));
