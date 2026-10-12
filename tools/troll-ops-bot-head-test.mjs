// Troll Forces: bot heads hold steady (user, 2026-10-12: "the heads of the
// troll bots seem to be flopping up and down"). A private Royale (never the
// public room), 4 s of every bot's head pitch in the world, frame by frame:
// passes when no head swings more than HEAD_SWING and none of them
// stop-starts its legs on a one-frame `moving` blip.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-bot-head-test.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HEAD_SWING = 0.28;  // radians, top to bottom over the 4 s
const MODE = process.env.MODE || "royale_mini";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`);
page.on("console", (m) => { if (m.type()==="error") errors.push(m.text()); });
try { await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 }); } catch (e) { console.log("no hooks", errors.slice(0,5)); process.exit(1); }
await page.evaluate(async (mode) => {
  const T = window.__trollOps;
  T.setMode(mode);
  T.els.room.value = "QHPB"; T.els.room.dispatchEvent(new Event("input"));
  if (T.els.noBots) T.els.noBots.checked = false;
  await T.startGame();
}, MODE);
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.isStaging(), null, { timeout: 120000 });
await page.evaluate(() => { window.__trollOps.player.spawnGuard = 1e9; });
// wait until bots have landed
await page.waitForTimeout(+(process.env.WAIT || 40000));
const out = await page.evaluate(() => new Promise((resolve) => {
  const T = window.__trollOps;
  const rows = new Map();
  let n = 0;
  const tick = () => {
    for (const [id, r] of T.remotes.byId) {
      if (rows.size >= 12 && !rows.has(id)) continue;
      if (!String(id).startsWith("bot-") || !r.rig.root.visible || !r.alive) continue;
      const p = r.rig.parts, g = r.rig.gait;
      let a = rows.get(id); if (!a) rows.set(id, a = []);
      const _v = new T.THREE.Vector3(0, 0, -1).applyQuaternion(p.headPivot.getWorldQuaternion(new T.THREE.Quaternion()));
      const _c = new T.THREE.Vector3(0, 0, -1).applyQuaternion(p.chest.getWorldQuaternion(new T.THREE.Quaternion()));
      a.push({ cp: Math.asin(Math.max(-1, Math.min(1, _c.y))), ads: r.ads, rl: r.reloadK || 0, fired: r.peer.shotAt ? (performance.now() - r.peer.shotAt) / 1000 : 9, wp: Math.asin(Math.max(-1, Math.min(1, _v.y))), h: p.headPivot.rotation.x, nk: p.neckPivot.rotation.x, pitch: r.pitch, acc: g.acc, hf: g.hf, air: !!r.air, mv: r.bodyPose?.moving, mps: r.bodyPose?.mps, lower: r.lower, y: r.pos.y });
    }
    if (++n < 240) requestAnimationFrame(tick); else resolve([...rows].map(([id, a]) => {
      const d = []; for (let i = 1; i < a.length; i++) d.push(Math.abs(a[i].h - a[i - 1].h));
      const hs = a.map((s) => s.h + s.nk);
      const flips = (k) => { let c = 0; for (let i = 2; i < a.length; i++) { const x = a[i][k] - a[i - 1][k], y = a[i - 1][k] - a[i - 2][k]; if (x * y < 0 && Math.abs(x) > 0.01) c++; } return c; };
      let jerk = 0; for (let i = 2; i < a.length; i++) jerk += Math.abs(a[i].wp - 2 * a[i - 1].wp + a[i - 2].wp);
      return { id, n: a.length, wpMin: Math.min(...a.map((s) => s.wp)).toFixed(3), wpMax: Math.max(...a.map((s) => s.wp)).toFixed(3), jerk: (jerk / a.length).toFixed(4), wpRev: flips("wp"), headMin: Math.min(...hs).toFixed(3), headMax: Math.max(...hs).toFixed(3), maxStep: Math.max(0, ...d).toFixed(3), reversals: flips("h"),
        pitchMin: Math.min(...a.map((s) => s.pitch)).toFixed(3), pitchMax: Math.max(...a.map((s) => s.pitch)).toFixed(3),
        accMin: Math.min(...a.map((s) => s.acc ?? 0)).toFixed(1), accMax: Math.max(...a.map((s) => s.acc ?? 0)).toFixed(1),
        hfMin: Math.min(...a.map((s) => s.hf ?? 0)).toFixed(3), hfMax: Math.max(...a.map((s) => s.hf ?? 0)).toFixed(3),
        air: a.filter((s) => s.air).length, mvFlips: (() => { let c = 0, run = 0; for (let i = 1; i < a.length; i++) { if (!a[i].mv) run++; else { if (run && run < 8) c++; run = 0; } } return c; })(),   // stops under ~8 frames
        sample: a.filter((s, i) => i % 4 === 0).slice(0, 60).map((s) => [s.wp.toFixed(2), s.cp.toFixed(2), (s.h + s.nk).toFixed(2), (s.mps ?? 0).toFixed(1), s.ads.toFixed(1), Math.min(9, s.fired).toFixed(1), s.rl ? 1 : 0].join("/")).join(" ") };
    }));
  };
  requestAnimationFrame(tick);
}));
let fails = 0;
for (const r of out) {
  const swing = r.wpMax - r.wpMin, ok = swing < HEAD_SWING && r.mvFlips === 0;
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"} ${r.id}: head pitch ${r.wpMin}..${r.wpMax} (swing ${swing.toFixed(3)}), leg stop-starts ${r.mvFlips}`);
}
if (!out.length) { fails++; console.log("FAIL no bots seen"); }
const pageErrors = errors.filter((e) => !/Failed to load resource/.test(e));
if (pageErrors.length) { fails++; console.log("FAIL page errors", pageErrors.slice(0, 3)); }
console.log(fails ? `${fails} FAILED` : "ALL PASS");
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
