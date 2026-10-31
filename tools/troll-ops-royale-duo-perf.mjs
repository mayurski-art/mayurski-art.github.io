// Troll Royale solos vs duos frame cost on Trollface Island (user,
// 2026-10-31: "lots of lag when running duos ... solos was fine"). Each mode
// in its own tab, a private room (Supabase blocked, never the public room),
// dropped straight onto the ground. Prints frame time, CPU per piece, draw
// calls, triangles, troll count and what the net sends per second, then a
// CPU profile's top functions (PROFILE=1).
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-royale-duo-perf.mjs [royale royale_duo]
//   SECS=6 sampling window; DROP=1 measures in the plane instead
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SECS = +process.env.SECS || 6;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg", ".ktx2": "application/octet-stream" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const modes = process.argv.slice(2).length ? process.argv.slice(2) : ["royale", "royale_duo"];
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--disable-gpu-vsync", "--disable-frame-rate-limit", "--autoplay-policy=no-user-gesture-required"] });
const out = {};
for (const mode of modes) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.route(/supabase/, (r) => r.abort());
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 120000 });
  await page.evaluate(async ({ mode, drop }) => {
    const T = window.__trollOps;
    T.DROP.enabled = !!drop;
    T.setMode(mode);
    T.els.room.value = "ZDUOPRF"; T.els.room.dispatchEvent(new Event("input"));   // private, never quick play
    await T.startGame();
  }, { mode, drop: !!process.env.DROP });
  await page.waitForFunction((drop) => window.__trollOps.state() === "playing" && (drop || !window.__trollOps.isStaging()), !!process.env.DROP, { timeout: 180000 });
  await new Promise((r) => setTimeout(r, +process.env.WAIT || 4000));
  const r = await page.evaluate(async (secs) => {
    const T = window.__trollOps;
    const { game } = await import("/assets/games/troll-ops/core/state.js?v=st1");
    T.player.spawnGuard = 1e9; T.settings.invincible = true;
    const prof = { bots: 0, remotes: 0, render: 0 };
    const wrap = (obj, key, slot) => { const fn = obj[key].bind(obj); obj[key] = (...a) => { const t = performance.now(); const v = fn(...a); prof[slot] += performance.now() - t; return v; }; };
    wrap(T.bots, "update", "bots"); wrap(T.remotes, "update", "remotes"); wrap(T.renderer, "render", "render");
    const net = { msgs: 0, bytes: 0, byType: {} };
    const tr = game.net.transport, tsend = tr?.send?.bind(tr);
    if (tsend) tr.send = (m) => { const s = JSON.stringify(m); net.bytes += s.length; net.msgs++; for (const x of m.t === "batch" ? m.m : [m]) net.byType[x.t] = (net.byType[x.t] || 0) + 1; return tsend(m); };
    // Class flips under the lobby's mode list: each one rebuilds the party
    // grid and the stage pads (menu-bo2.js renderSeats, lobby.js renderStage).
    const muts = { n: 0, what: {} };
    const ml = document.getElementById("to-lo-mode");
    const mo = ml && new MutationObserver((rs) => { for (const m of rs) { muts.n++; const k = `${m.target.dataset?.mode || m.target.className}`.slice(0, 40); muts.what[k] = (muts.what[k] || 0) + 1; } });
    mo?.observe(ml, { subtree: true, attributes: true, attributeFilter: ["class"] });
    // Window events by type, and forced style reads (menu fitNames).
    const evs = {}, wd = window.dispatchEvent.bind(window);
    const evMs = {}; window.dispatchEvent = (e) => { evs[e.type] = (evs[e.type] || 0) + 1; const t = performance.now(); const v = wd(e); evMs[e.type] = +((evMs[e.type] || 0) + performance.now() - t).toFixed(1); return v; };
    let gcs = 0; const og = window.getComputedStyle; window.getComputedStyle = function () { gcs++; return og.apply(this, arguments); };
    T.renderer.info.autoReset = false; T.renderer.info.reset();
    const dts = []; let last = performance.now();
    await new Promise((res) => { const t0 = last; const tick = (now) => { dts.push(now - last); last = now; if (now - t0 < secs * 1000) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
    mo?.disconnect(); window.dispatchEvent = wd; window.getComputedStyle = og;
    const n = dts.length; dts.sort((a, b) => a - b);
    const avg = dts.reduce((a, b) => a + b, 0) / n, per = (v) => +(v / n).toFixed(2);
    const teams = {}; for (const b of T.bots.bots) teams[b.team] = (teams[b.team] || 0) + 1;
    return { mode: game.currentMode?.().id, frames: n, fps: +(1000 / avg).toFixed(1), avgMs: +avg.toFixed(1), p50: +dts[n >> 1].toFixed(1), p95: +dts[Math.floor(n * 0.95)].toFixed(1),
      cpuMsPerFrame: { bots: per(prof.bots), remotes: per(prof.remotes), render: per(prof.render) },
      drawCalls: Math.round(T.renderer.info.render.calls / n), tris: Math.round(T.renderer.info.render.triangles / n),
      bots: T.bots.bots.length, remotes: T.remotes.byId.size, alive: T.royaleAliveList().length, teamCount: Object.keys(teams).length,
      max: +dts[n - 1].toFixed(0), over150: dts.filter((d) => d > 150).length,
      programs: T.renderer.info.programs?.length || 0,
      modeListFlipsPerFrame: +(muts.n / n).toFixed(2), modeListFlips: muts.what, events: evs, eventMs: evMs, styleReadsPerFrame: +(gcs / n).toFixed(2),
      nodes: (() => { let k = 0; T.scene.traverse(() => k++); return k; })(),
      // Render passes in one frame, and what each pass drew (by scene).
      passes: await (() => { const list = []; const r = T.renderer.render; T.renderer.render = function (s, c) { list.push(`${s.name || s.type}/${c.name || c.type}`); return r.apply(this, arguments); }; return new Promise((res) => requestAnimationFrame(() => { list.length = 0; requestAnimationFrame(() => { T.renderer.render = r; res(list); }); })); })(),
      // Visible meshes under each direct child of the scene (top 12).
      visible: (() => { const by = {}; for (const ch of T.scene.children) { let k = 0; ch.traverseVisible((o) => { if (o.isMesh || o.isSprite || o.isLine || o.isPoints) k++; }); const key = ch.name || ch.type; by[key] = (by[key] || 0) + k; } return Object.fromEntries(Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 12)); })(),
      netPerSec: { msgs: +(net.msgs / secs).toFixed(1), kB: +(net.bytes / secs / 1024).toFixed(1), byType: net.byType } };
  }, SECS);
  r.errors = errors.slice(0, 5);
  console.log(JSON.stringify(r));
  out[mode] = r;
  if (process.env.PROFILE) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 200 }); await page.evaluate(() => { window.__frames = 0; const f = () => { window.__frames++; requestAnimationFrame(f); }; requestAnimationFrame(f); });
    await cdp.send("Profiler.start");
    await new Promise((res) => setTimeout(res, +process.env.PROFMS || 4000));
    const { profile } = await cdp.send("Profiler.stop");
    const self = new Map(), byId = new Map(profile.nodes.map((nd) => [nd.id, nd])); let total = 0;
    profile.samples.forEach((id, i) => { const f = byId.get(id).callFrame; const key = `${f.functionName || "(anon)"} ${f.url.split("/").pop().split("?")[0]}:${f.lineNumber + 1}`; self.set(key, (self.get(key) || 0) + (profile.timeDeltas[i] || 0)); total += profile.timeDeltas[i] || 0; });
    const fr = await page.evaluate(() => window.__frames || 0);
    if (process.env.PROFOUT) fs.writeFileSync(process.env.PROFOUT + '-' + mode + '.json', JSON.stringify({ total, frames: fr, self: [...self] }));
    for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`  ${(100 * v / total).toFixed(1).padStart(5)}%  ${k}`);
  }
  await page.close();
}
await browser.close(); server.close();
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(out, null, 2));
