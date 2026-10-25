// Troll Forces on a phone: GPU memory once a map has loaded, counted at the
// WebGL calls (textures, buffers, render buffers per context), with the page
// emulating an iPhone (or an iPad). iOS Safari kills a tab whose GPU memory
// runs past a few hundred MB, which is how Kabukigrin crashed on a phone
// (2026-10-25: ~530 MB of textures + ~70 MB of render buffers).
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-phone-mem-test.mjs [mapId] [--ipad] [--list]
//   SETTLE=ms   how long the map gets to stream in (default 25000)
//   --list      print the 30 biggest textures in the game's context
//
// Checks (FAIL lines, exit 1): textures, and everything, in the game's
// context under the phone budget; no image over 1024 on a side (render
// targets follow the screen); no other
// WebGL context still holding memory or a drawing buffer in the match; the
// player's body built (the NFT body's pieces) when the match goes live;
// the game comes back from a lost context.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const args = process.argv.slice(2);
const MAP = args.find((a) => !a.startsWith("--")) || "kabukigrin";
const IPAD = args.includes("--ipad"), LIST = args.includes("--list");
const BUDGET = { texMB: 220, totalMB: 300, maxSide: 1024 };
const device = IPAD
  ? { viewport: { width: 1366, height: 1024 }, deviceScaleFactor: 2, userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" }
  : { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" };
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ ...device, isMobile: true, hasTouch: true });
// never a live room (CLAUDE.md troll-ops rule 2)
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.addInitScript(() => {
  const ctxs = []; window.__ctxs = ctxs;
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, ...a) {
    const c = gc.call(this, t, ...a);
    if (c && /webgl/.test(t) && !c.__m) {
      c.__m = { tex: new Map(), buf: new Map(), rb: new Map(), bound: {}, id: ctxs.length, from: (new Error().stack || "").split("\n").slice(2, 5).map((l) => l.trim().replace(/^at /, "").replace(/\(?https?:\/\/[^/]+\//, "").replace(/\?v=[^:]*/, "")).join(" < ") };
      ctxs.push(c);
    }
    return c;
  };
  const BPP = { 0x8058: 4, 0x8C43: 4, 0x881A: 8, 0x8814: 16, 0x822F: 4, 0x8230: 8, 0x8229: 1, 0x822B: 2, 0x81A5: 2, 0x81A6: 4, 0x8CAC: 4, 0x88F0: 4, 0x8C3A: 4, 0x8D62: 2, 0x1908: 4, 0x1907: 3, 0x8051: 3 };
  const bpp = (f) => BPP[f] || 4;
  const CUBE = (t) => t >= 0x8515 && t <= 0x851A;
  for (const P of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype]) {
    const wrap = (n, f) => { const o = P[n]; if (!o) return; P[n] = function (...a) { try { if (this.__m) f.call(this, this.__m, a); } catch { /* counting only */ } return o.apply(this, a); }; };
    wrap("bindTexture", (m, [t, tex]) => { m.bound["t" + t] = tex; });
    wrap("bindBuffer", (m, [t, b]) => { m.bound["b" + t] = b; });
    wrap("bindRenderbuffer", (m, [, b]) => { m.bound.rb = b; });
    wrap("texStorage2D", (m, [t, lv, f, w, h]) => {
      let s = 0, W = w, H = h;
      for (let i = 0; i < lv; i++) { s += W * H * bpp(f); W = Math.max(1, W >> 1); H = Math.max(1, H >> 1); }
      m.tex.set(m.bound["t" + t], { s: s * (t === 0x8513 ? 6 : 1), w, h, storage: true });
    });
    wrap("texStorage3D", (m, [t, lv, f, w, h, d]) => { m.tex.set(m.bound["t" + t], { s: w * h * d * bpp(f) * (lv > 1 ? 4 / 3 : 1), w, h, storage: true }); });
    // an image (or canvas, or video) uploaded into a texture, not a render target
    wrap("texSubImage2D", (m, a) => { const e = m.tex.get(m.bound["t" + (CUBE(a[0]) ? 0x8513 : a[0])]); if (e && a.length <= 7) e.img = true; });
    wrap("texImage2D", (m, a) => {
      const t = CUBE(a[0]) ? 0x8513 : a[0];
      if (a[1] !== 0) return;
      const tex = m.bound["t" + t];
      const prev = m.tex.get(tex);
      if (prev?.storage) return;
      let w, h;
      if (a.length >= 8) { w = a[3]; h = a[4]; } else { const s = a[5]; w = s.videoWidth || s.naturalWidth || s.width; h = s.videoHeight || s.naturalHeight || s.height; }
      const e = { s: w * h * 4 * (CUBE(a[0]) ? 6 : 1), w, h, mip: false, img: a.length <= 6 };
      if (prev?.mip) e.s *= 4 / 3, e.mip = true;
      m.tex.set(tex, e);
    });
    wrap("generateMipmap", (m, [t]) => { const e = m.tex.get(m.bound["t" + t]); if (e && !e.storage && !e.mip) { e.s *= 4 / 3; e.mip = true; } });
    wrap("deleteTexture", (m, [t]) => m.tex.delete(t));
    wrap("bufferData", (m, [t, d]) => { m.buf.set(m.bound["b" + t], typeof d === "number" ? d : d.byteLength); });
    wrap("deleteBuffer", (m, [b]) => m.buf.delete(b));
    wrap("renderbufferStorageMultisample", (m, [, s, f, w, h]) => m.rb.set(m.bound.rb, w * h * bpp(f) * Math.max(1, s)));
    wrap("renderbufferStorage", (m, [, f, w, h]) => m.rb.set(m.bound.rb, w * h * bpp(f)));
    wrap("deleteRenderbuffer", (m, [b]) => m.rb.delete(b));
  }
  const sum = (mp) => [...mp.values()].reduce((a, v) => a + (v.s ?? v), 0) / 1e6;
  window.__mem = () => ctxs.map((c) => {
    const lost = c.isContextLost();
    return {
      id: c.__m.id, lost, canvas: `${c.canvas.width}x${c.canvas.height}`, inDom: c.canvas.isConnected, from: c.__m.from.slice(0, 140),
      texMB: lost ? 0 : +sum(c.__m.tex).toFixed(1), nTex: lost ? 0 : c.__m.tex.size, bufMB: lost ? 0 : +sum(c.__m.buf).toFixed(1), rbMB: lost ? 0 : +sum(c.__m.rb).toFixed(1),
      // the drawing buffer itself (colour + depth, antialiased or not)
      fbMB: lost ? 0 : +(c.drawingBufferWidth * c.drawingBufferHeight * 8 * (c.getContextAttributes()?.antialias ? 4 : 1) / 1e6).toFixed(1),
    };
  });
  window.__bigTex = (id, n) => [...ctxs[id].__m.tex.values()].sort((a, b) => b.s - a.s).slice(0, n).map((v) => `${v.w}x${v.h} ${(v.s / 1e6).toFixed(1)}MB`);
});

let fails = 0;
const check = (ok, what) => { console.log(`${ok ? "PASS" : "FAIL"} ${what}`); if (!ok) fails++; };
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 5000));
const menu = await page.evaluate(() => window.__mem());
console.log(`menu: ${menu.length} contexts, ${menu.reduce((a, c) => a + c.texMB + c.bufMB + c.rbMB + c.fbMB, 0).toFixed(0)} MB`);

// the match, as Find Match runs it (enterMatch: the load screen, then live)
const gameCtx = await page.evaluate(async (map) => {
  const T = window.__trollOps;
  T.setMode("ops"); T.loadout.mapId = map;
  await T.startGame();
  if (T.isStaging()) T.endStaging();
  return window.__ctxs.findIndex((c) => c.canvas === T.renderer.domElement);
}, MAP);
await new Promise((r) => setTimeout(r, +(process.env.SETTLE || 25000)));
const m = await page.evaluate(() => window.__mem());
const g = m[gameCtx];
const gfx = await page.evaluate(() => window.__trollOps.gfx());
console.log(`${IPAD ? "iPad" : "iPhone"} on ${MAP}: tier ${gfx.tier}, pixel ratio ${gfx.pixelRatio}, shadow ${gfx.shadow}, canvas ${g.canvas}`);
console.log(`game context: textures ${g.texMB} MB (${g.nTex}), buffers ${g.bufMB} MB, render buffers ${g.rbMB} MB, drawing buffer ${g.fbMB} MB`);
for (const c of m) if (c.id !== gameCtx) console.log(`  other context ${c.id}: ${c.lost ? "released" : `${c.canvas}${c.inDom ? "" : " (detached)"} ${(c.texMB + c.bufMB + c.rbMB + c.fbMB).toFixed(1)} MB`}  ${c.from}`);
const big = await page.evaluate(([id, n]) => window.__bigTex(id, n), [gameCtx, LIST ? 30 : 5]);
console.log(`biggest textures: ${big.join(", ")}`);

check(g.texMB <= BUDGET.texMB, `textures ${g.texMB} MB <= ${BUDGET.texMB} MB`);
const total = g.texMB + g.bufMB + g.rbMB + g.fbMB;
check(total <= BUDGET.totalMB, `everything in the game's context ${total.toFixed(0)} MB <= ${BUDGET.totalMB} MB`);
const maxSide = await page.evaluate((id) => Math.max(0, ...[...window.__ctxs[id].__m.tex.values()].filter((v) => v.img).map((v) => Math.max(v.w, v.h))), gameCtx);
check(maxSide <= BUDGET.maxSide, `largest image side ${maxSide} <= ${BUDGET.maxSide}`);
const others = m.filter((c) => c.id !== gameCtx && !c.lost && (c.texMB + c.bufMB + c.rbMB > 0.5 || c.fbMB > 0.5));
check(others.length === 0, `no other WebGL context holding memory in the match (${others.length})`);
const body = await page.evaluate(() => window.__trollOps.bodyState?.() ?? null);
check(body?.ready === true, `the player's body built when the match went live (${JSON.stringify(body)})`);

// a lost context (iOS drops it under memory pressure): the game must come back drawing
const lost = await page.evaluate(async () => {
  const T = window.__trollOps, gl = T.renderer.getContext(), ext = gl.getExtension("WEBGL_lose_context");
  if (!ext) return { skipped: true };
  ext.loseContext();
  await new Promise((r) => setTimeout(r, 800));
  ext.restoreContext();
  await new Promise((r) => setTimeout(r, 4000));
  let frames = 0; const t0 = performance.now();
  await new Promise((done) => { const f = () => { frames++; if (performance.now() - t0 < 1500) requestAnimationFrame(f); else done(); }; requestAnimationFrame(f); });
  return { lost: gl.isContextLost(), state: T.state?.() ?? null, tier: T.gfx().tier, frames, restored: T.contextRestores?.() ?? 0 };
});
check(lost.skipped || (!lost.lost && lost.restored > 0 && lost.frames > 3), `back from a lost context (${JSON.stringify(lost)})`);
check(errors.length === 0, `no page errors${errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""}`);

await browser.close(); server.close();
console.log(fails ? `${fails} FAIL` : "all PASS");
process.exit(fails ? 1 : 0);
