// Troll Royale frame check: frame times with N trolls on Trollface Island,
// dropped straight onto the ground (no sky lobby). Compare counts in one run:
//
//   node tools/troll-ops-royale-fps.mjs 20 100
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));

const counts = process.argv.slice(2).map(Number).filter((n) => n > 0);
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
for (const n of counts.length ? counts : [20, 100]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.route(/supabase/, (r) => r.abort());
  if (process.env.HIDE_RIGS) await page.addInitScript(() => { window.__hideRigs = true; });
  await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 120000 });
  await page.evaluate(async (n) => {
    const { MAPS } = await import("/assets/games/troll-ops/maps.js?v=ti4");
    MAPS.trollface.royale.players = n;
    const T = window.__trollOps; T.DROP.enabled = false; T.setMode("royale"); await T.startGame();
  }, n);
  await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.isStaging(), null, { timeout: 180000 });
  const r = await page.evaluate(async () => {
    const T = window.__trollOps;
    T.player.spawnGuard = 1e9;   // measuring, not fighting
    // Where the frame goes: bot AI, peer rigs, and the draw (all passes).
    const prof = { bots: 0, remotes: 0, render: 0, calls: 0, frames: 0 };
    const wrap = (obj, key, slot) => {
      const fn = obj[key].bind(obj);
      obj[key] = (...a) => { const t = performance.now(); const r = fn(...a); prof[slot] += performance.now() - t; return r; };
    };
    wrap(T.bots, "update", "bots");
    wrap(T.remotes, "update", "remotes");
    wrap(T.renderer, "render", "render");
    await new Promise((res) => setTimeout(res, 3000));
    // HIDE_RIGS=1: every troll's body hidden, to see what the bodies cost.
    if (window.__hideRigs) {
      const orig = T.remotes.update.bind(T.remotes);
      T.remotes.update = (...a) => { orig(...a); for (const rp of T.remotes.byId.values()) { rp.rig.root.visible = false; rp.tag.visible = false; } };
    }
    for (const k in prof) prof[k] = 0;
    T.renderer.info.autoReset = false;
    T.renderer.info.reset();
    const dts = [];
    let last = performance.now();
    await new Promise((res) => { const t0 = last; const tick = (now) => { dts.push(now - last); last = now; if (now - t0 < 6000) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
    dts.sort((a, b) => a - b);
    const avg = dts.reduce((a, b) => a + b, 0) / dts.length;
    const per = (v) => +(v / dts.length).toFixed(1);
    return { trolls: T.royaleAliveList().length, fps: +(1000 / avg).toFixed(1), p50: +dts[dts.length >> 1].toFixed(1), p95: +dts[Math.floor(dts.length * 0.95)].toFixed(1),
      msPerFrame: { bots: per(prof.bots), remotes: per(prof.remotes), render: per(prof.render) },
      drawCalls: Math.round(T.renderer.info.render.calls / dts.length),
      tris: Math.round(T.renderer.info.render.triangles / dts.length),
      programs: T.renderer.info.programs?.length,
      nodes: (() => { let n = 0; T.scene.traverse(() => n++); return n; })(),
      matrixMs: (() => { const t = performance.now(); for (let i = 0; i < 10; i++) T.scene.updateMatrixWorld(true); return +((performance.now() - t) / 10).toFixed(2); })(),
      renderCallsPerFrame: await (() => { let n = 0; const r = T.renderer.render; T.renderer.render = function (...a) { n++; return r.apply(this, a); }; return new Promise((res) => requestAnimationFrame(() => { n = 0; requestAnimationFrame(() => { T.renderer.render = r; res(n); }); })); })(),
      lights: (() => { let n = 0; T.scene.traverse((o) => { if (o.isLight && o.visible) n++; }); return n; })(),
      nearest: (() => { const c = T.camera.position; const d = T.bots.bots.map((b) => Math.hypot(b.pos.x - c.x, b.pos.z - c.z)).sort((a, b) => a - b); return { within70: d.filter((x) => x < 70).length, within150: d.filter((x) => x < 150).length }; })() };
  });
  console.log(`${n} trolls:`, JSON.stringify(r));
  // PROFILE=1: 4 s CPU profile, top functions by self time.
  if (process.env.PROFILE) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
    await cdp.send("Profiler.start");
    await new Promise((res) => setTimeout(res, 4000));
    const { profile } = await cdp.send("Profiler.stop");
    const self = new Map();
    const dt = profile.timeDeltas;
    const byId = new Map(profile.nodes.map((nd) => [nd.id, nd]));
    let total = 0;
    profile.samples.forEach((id, i) => {
      const nd = byId.get(id); const f = nd.callFrame;
      const key = `${f.functionName || "(anon)"} ${f.url.split("/").pop().split("?")[0]}:${f.lineNumber + 1}`;
      self.set(key, (self.get(key) || 0) + (dt[i] || 0)); total += dt[i] || 0;
    });
    const top = [...self].sort((a, b) => b[1] - a[1]).slice(0, 25);
    for (const [k, v] of top) console.log(`  ${(100 * v / total).toFixed(1).padStart(5)}%  ${k}`);
  }
  await page.close();
}
await browser.close();
server.close();
