// Troll Forces: a pose lab. Plays clips from tools/troll-ops-hoops-poses.mjs
// (or any clip JSON) on our own third-person rig at Troll Beach's court and
// shoots it from the side and front, so poses can be judged before they go
// to Studio. One tab, Supabase blocked.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-pose-lab.mjs <clip>[@t1,t2] ...
//   each <clip> a name in troll-ops-hoops-poses.mjs ("probe": the axis
//   probe); without @, every keyframe. One sheet per clip:
//   tools/.pose-shots/<clip>.png, a row per time (side, front, back 3/4).

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { CLIPS, toClipJson } from "./troll-ops-hoops-poses.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, "tools", ".pose-shots");
const JOBS = (process.argv.slice(2).length ? process.argv.slice(2) : ["probe"]).map((a) => {
  const [name, ts] = a.split("@");
  const clip = toClipJson(name, CLIPS[name]);
  return { name, clip, times: ts ? ts.split(",").map(Number) : clip.times };
});
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
fs.mkdirSync(SHOTS, { recursive: true });


const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const ctx = await browser.newContext({ viewport: { width: 720, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  const fake = { getCachedProfile: () => ({ username: "pose_lab", tags: [] }) };
  Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => fake, set: () => {} });
});
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 420000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 420000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.setLoadWaitMax(8);
  T.setMode("social");
  T.loadout.mapId = "grinbeach";
  await T.startGame();
});
await page.waitForFunction(() => !window.__trollOps.loadState().open, null, { timeout: 420000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.els.pause.hidden = true;
  T.toggleThirdPerson?.();
  T.move.reset(48, -2, 0.05);
  T.look.yaw = 0;
  const all = performance.getEntriesByType("resource").map((e) => e.name);
  const tp = await import(all.find((u) => u.includes("/view/third-person.js?")));
  const cl = await import(all.find((u) => u.includes("/characters/clips.js?")));
  const out = {};
  window.__poseT = 0;
  window.__setClip = (json) => { window.__labClip = cl.prepareClip(json); };
  tp.localPosers.push((rig) => {
    if (!window.__labClip) return;
    const s = cl.sampleClip(window.__labClip, window.__poseT, out);
    const p = rig.parts, k = rig.scale || 1;
    for (const n in s) {
      const o = p[n];
      if (!o) continue;
      o.quaternion.copy(s[n].q);
      if (n === "hips") o.position.set(s[n].p ? s[n].p.x * k : 0, (rig.hipY ?? 0.6 * k) + (s[n].p ? s[n].p.y * k : 0), s[n].p ? s[n].p.z * k : 0);
    }
    rig.root.updateMatrixWorld(true);
    rig.body?.update?.();
  });
  const cam = T.camera;
  const orig = cam.updateMatrixWorld.bind(cam);
  cam.updateMatrixWorld = (f) => {
    const c = window.__labCam;
    if (c) { cam.position.set(...c.from); cam.lookAt(...c.at); }
    return orig(f);
  };
});
const pump = async (ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) await page.screenshot({ type: "jpeg", quality: 10 }); };
await pump(2500);
const sheetPage = await ctx.newPage();
for (const { name, clip, times } of JOBS) {
  await page.evaluate((json) => window.__setClip(json), clip);
  const cells = [];
  for (const t of times) {
    await page.evaluate((t) => { window.__poseT = t; }, t);
    // facing -z (yaw 0): its right is +x. Side view from +x, front from -z.
    for (const from of [[50.6, 1.1, -2], [48, 1.1, -4.6], [49.8, 1.5, 0.0]]) {
      await page.evaluate(({ from }) => { window.__labCam = { from, at: [48, 0.95, -2] }; }, { from });
      await pump(250);
      cells.push(await page.screenshot({ clip: { x: 210, y: 160, width: 300, height: 420 } }));
    }
  }
  // the sheet: a row per time, three views across, the time on each row
  const rows = times.map((t, r) => `<div style="display:flex;position:relative">${cells.slice(r * 3, r * 3 + 3).map((b) => `<img src="data:image/png;base64,${b.toString("base64")}" width="300" height="420">`).join("")}<b style="position:absolute;left:6px;top:4px;font:700 22px sans-serif;color:#fff;text-shadow:0 0 4px #000">${name} t=${t}</b></div>`).join("");
  await sheetPage.setViewportSize({ width: 900, height: 420 * times.length });
  await sheetPage.setContent(`<body style="margin:0;background:#000">${rows}</body>`);
  await sheetPage.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
}
console.log(errors.length ? `errors: ${errors.slice(0, 3).join(" | ")}` : "shots in tools/.pose-shots");
await browser.close();
server.close();
