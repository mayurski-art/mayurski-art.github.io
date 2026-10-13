// Troll Royale frame cost, ranked (user, 2026-10-12: "it starts lagging the
// moment the bots spawn ... maybe identify what contributes so much to the
// lag. maybe a tier ranking"). A private Royale (Supabase blocked, never the
// public room), the player kept out of it. In each stage (bots in the box,
// in the air, on the ground) it times the frame and the CPU spent in the
// big pieces (bot AI, posing the remote trolls, the render), counts draw
// calls and triangles, then switches one thing off at a time for a few
// seconds and measures what the frame gains: that gain is the piece's cost.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-royale-perf.mjs
//   GFX=high|medium|low (default high); W/H viewport (default 1366x768)
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GFX = process.env.GFX || "high";
const W = +process.env.W || 1366, H = +process.env.H || 768;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg", ".ktx2": "application/octet-stream" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--disable-gpu-vsync", "--disable-frame-rate-limit"] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
await page.evaluate(async (gfx) => {
  const T = window.__trollOps;
  T.settings.gfx = gfx;
  T.DROP.lobbySeconds = 40;
  T.setMode("royale");
  T.els.room.value = "QPRF"; T.els.room.dispatchEvent(new Event("input"));
  if (T.els.noBots) T.els.noBots.checked = false;
  await T.startGame();
}, GFX);
await page.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 180000 });

// CPU timers around the big pieces, and a frame clock.
await page.evaluate(() => {
  const T = window.__trollOps;
  T.settings.invincible = true;
  T.player.spawnGuard = 1e9;
  const P = window.__perf = { on: {}, ms: {}, frames: [], last: performance.now() };
  const wrap = (obj, fn, key) => {
    const orig = obj[fn].bind(obj);
    obj[fn] = (...a) => {
      if (P.on[key] === false) return undefined;
      const t = performance.now();
      const r = orig(...a);
      P.ms[key] = (P.ms[key] || 0) + performance.now() - t;
      return r;
    };
  };
  wrap(T.bots, "update", "botAI");
  wrap(T.remotes, "update", "posing");
  const comp = T.composer || null;
  if (comp) wrap(comp, "render", "render");
  else wrap(T.renderer, "render", "render");
  const info = T.renderer.info;
  info.autoReset = false;
  P.calls = []; P.tris = [];
  const tick = (now) => { P.frames.push(now - P.last); P.last = now; P.calls.push(info.render.calls); P.tris.push(info.render.triangles); info.reset(); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/* Mean frame time and CPU per piece over `ms`. */
const sample = (ms) => page.evaluate(async (ms) => {
  const P = window.__perf, T = window.__trollOps;
  P.frames = []; P.ms = {}; P.calls = []; P.tris = [];
  await new Promise((r) => setTimeout(r, ms));
  const f = P.frames.slice(2).sort((a, b) => a - b);
  const n = f.length || 1, mean = f.reduce((s, x) => s + x, 0) / n;
  const per = {};
  for (const k in P.ms) per[k] = +(P.ms[k] / n).toFixed(2);
  const i = T.renderer.info;
  return { frame: +mean.toFixed(1), p95: +(f[Math.floor(n * 0.95)] || 0).toFixed(1), fps: +(1000 / mean).toFixed(1), cpu: per,
    calls: Math.round(P.calls.reduce((s, x) => s + x, 0) / (P.calls.length || 1)), tris: Math.round(P.tris.reduce((s, x) => s + x, 0) / (P.tris.length || 1)), programs: i.programs?.length, textures: i.memory.textures, geos: i.memory.geometries };
}, ms);

/* Switches, each undone by the same call with false. */
const toggle = (name, off) => page.evaluate(({ name, off }) => {
  const T = window.__trollOps, P = window.__perf, comp = T.composer;
  const passes = comp?.passes || [];
  const pass = (re) => passes.find((p) => re.test(p.constructor?.name || ""));
  if (name === "ssao") { const p = pass(/SSAO|GTAO/); if (p) p.enabled = off ? false : (p._was ?? true); }
  if (name === "bloom") { const p = pass(/Bloom/); if (p) p.enabled = off ? false : (p._was ?? true); }
  if (name === "shadows") T.scene.traverse((o) => { if (o.isLight && o.shadow) { if (off) { o._cs = o.castShadow; o.castShadow = false; } else if (o._cs !== undefined) o.castShadow = o._cs; } });
  if (name === "botAI") P.on.botAI = !off;
  if (name === "posing") P.on.posing = !off;
  if (name === "trolls") {
    // Every remote troll undrawn (and unposed, so nothing turns them back on).
    P.on.posing = !off;
    for (const rp of T.remotes.byId.values()) { rp.rig.root.visible = !off; if (rp.tag) rp.tag.visible = !off; }
  }
  if (name === "halfres") { if (off) { P._pr = T.renderer.getPixelRatio(); T.renderer.setPixelRatio(P._pr * 0.5); } else T.renderer.setPixelRatio(P._pr); window.dispatchEvent(new Event("resize")); }
}, { name, off });

// Remember which passes were on, so "back on" restores the tier's setting.
await page.evaluate(() => { for (const p of window.__trollOps.composer?.passes || []) p._was = p.enabled; });

async function stage(label, short = false) {
  const base = await sample(short ? 1500 : 3000);
  console.log(`\n== ${label}: ${base.fps} fps (frame ${base.frame} ms, p95 ${base.p95}), draw calls ${base.calls}, triangles ${(base.tris / 1e6).toFixed(2)}M, programs ${base.programs}, textures ${base.textures}, geometries ${base.geos}`);
  console.log(`   CPU per frame: ${Object.entries(base.cpu).map(([k, v]) => `${k} ${v} ms`).join(", ")}`);
  const rows = [];
  for (const t of short ? ["trolls", "botAI", "ssao"] : ["trolls", "posing", "botAI", "shadows", "ssao", "bloom", "halfres"]) {
    await toggle(t, true);
    await sleep(short ? 200 : 400);
    const s = await sample(short ? 1200 : 2500);
    await toggle(t, false);
    await sleep(short ? 200 : 400);
    rows.push({ t, gain: +(base.frame - s.frame).toFixed(1), fps: s.fps, calls: s.calls });
  }
  rows.sort((a, b) => b.gain - a.gain);
  console.log("   switched off one at a time (ms saved a frame, fps with it off):");
  for (const r of rows) console.log(`     ${r.t.padEnd(8)} ${String(r.gain).padStart(6)} ms   ${String(r.fps).padStart(5)} fps   draw calls ${r.calls}`);
  return { label, base, rows };
}

const where = () => page.evaluate(() => {
  const T = window.__trollOps, r = T.royale?.();
  const bots = T.bots.bots;
  return { live: !!r?.live, phase: r?.drop?.phase, t: r?.t, air: bots.filter((b) => b.drop?.state === "fly").length, n: bots.length };
});

const out = [];
// In the box: the lobby before the floor moves.
await sleep(2000);
console.log("box", JSON.stringify(await where()));
if (process.env.AUDIT) {
  // What's drawn: visible meshes under each of the scene's children, biggest first.
  console.log(await page.evaluate(() => {
    const T = window.__trollOps, rows = [];
    for (const top of T.scene.children) {
      let n = 0, tris = 0, inst = 0;
      top.traverseVisible((o) => { if (!o.isMesh && !o.isSprite && !o.isPoints && !o.isLine) return; n++; if (o.isInstancedMesh) inst++; const g = o.geometry; if (g) tris += ((g.index ? g.index.count : g.attributes.position?.count || 0) / 3) * (o.isInstancedMesh ? o.count : 1); });
      if (n) rows.push([n, Math.round(tris), inst, top.name || top.type, top.userData?.remotePlayer ? 'troll' : Object.keys(top.userData || {}).slice(0, 3).join('|'), Math.round(top.position.y), top.children.length, (top.children[0]?.name || top.children[0]?.type || '')]);
    }
    rows.sort((a, b) => b[0] - a[0]);
    const trolls = rows.filter((r) => r[4] === 'troll');
    const rest = rows.filter((r) => r[4] !== 'troll');
    const big = rest.filter((r) => r[0] >= 30), hi = big.filter((r) => r[5] > 200);
    rest.unshift(['groups >=30 meshes:', big.length, 'meshes', big.reduce((s, r) => s + r[0], 0), 'of which up in the sky:', hi.length, hi.reduce((s, r) => s + r[0], 0)]);
    return 'trolls: ' + trolls.length + ' groups, ' + trolls.reduce((s, r) => s + r[0], 0) + ' meshes\n' + rest.slice(0, 25).map((r) => r.join('  ')).join(String.fromCharCode(10));
  }));
  await browser.close(); server.close(); process.exit(0);
}
out.push(await stage("bots in the box"));
for (let i = 0; i < 400; i++) { const w = await where(); if (w.air > 50) break; await sleep(250); }
console.log("air", JSON.stringify(await where()));
out.push(await stage("bots falling", true));
for (let i = 0; i < 120; i++) { const w = await where(); if (w.live && w.air === 0) break; await sleep(500); }
await sleep(5000);
console.log("ground", JSON.stringify(await where()));
out.push(await stage("bots on the ground, fighting"));

console.log(errors.length ? `\npage errors: ${errors.slice(0, 3).join(" | ")}` : "\nno page errors");
await browser.close(); server.close();
