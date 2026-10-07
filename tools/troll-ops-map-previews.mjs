// Renders the map shots (loading screen, map vote, menu preview): one
// establishing shot per versus map, rendered at 4K through the game's own
// post chain (SSAO, bloom, tone mapping, 4x MSAA). The lossless master goes
// to .claude/map-shots-hq/<id>.png (kept out of git, ~10 MB each) and ffmpeg
// encodes the responsive ladder to assets/games/troll-ops/ui/maps/
// <id>-{640,1280,1920,2560,3840}.webp that map-load-screen.js serves as a
// srcset. Re-run after a map's look changes, then bump ?v=hq1 in
// map-load-screen.js. Camera spots are hand-picked in VIEWS below.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-map-previews.mjs [mapId ...]
// FFMPEG=<path> if ffmpeg isn't on PATH; WAIT=<ms> for slow-streaming maps.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "assets/games/troll-ops/ui/maps");
const MASTER = path.join(ROOT, ".claude/map-shots-hq");
const WIDTHS = [640, 1280, 1920, 2560, 3840];
const FFMPEG = process.env.FFMPEG || "ffmpeg";
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(MASTER, { recursive: true });
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
const BASE = `http://localhost:${server.address().port}`;

// [camera x, y, z, look-at x, y, z, fov]
const VIEWS = {
  grinsite:  [30, 16, 30, -4, 0, -4, 55],
  undergrin: [-9, 3.2, 27, 1, 1.4, -18, 70],
  dustbowl:  [33, 18, 33, -2, 0, -2, 55],
  depot:     [-25, 7.5, 19, 6, 1, -6, 68],
  culdegrin: [4, 26, 38, 0, 0, -4, 55],
  grinbeach: [40, 22, 30, -6, 0, -10, 55],
  hollowgrin: [38, 26, 34, 74, 3, -6, 62],   // the Grinmoor Fair: mansion, fountain, Ferris wheel, coaster
  grinleria: [22.5, 6.3, -1.2, -6, 2.0, 2.2, 72],
  trollcity: [-30, 6.2, 0.4, 44, 5.5, 0, 60],   // down Main Street: the saloon, the bank, the courthouse dome
  trollingloud: [0.5, 1.75, 5.5, 0, 3.8, -15, 76],   // the dance floor: the ball, the arches, the crystal wall, the DJ
  grinjuku: [0, 2.6, -37, 0, 3.4, -12, 70],   // up Mid Top through the torii: lantern strings, kanban, the post office
};
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(VIEWS);

// ANGLE=swiftshader on a machine without a d3d11 GPU (Linux containers)
const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());
for (const id of ids) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`${id}: ${e.message}`));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
  await page.evaluate(async (map) => {
    const T = window.__trollOps;
    T.setMode("tdm");
    if (T.els.noBots) T.els.noBots.checked = true;
    T.loadout.mapId = map;
    await T.startGame();
    if (T.isStaging()) T.endStaging();
  }, id);
  await new Promise((r) => setTimeout(r, +(process.env.WAIT || 6000)));   // models + textures stream in
  const data = await page.evaluate(async (v) => {
    const T = window.__trollOps, R = T.renderer, C = T.composer, cam = T.camera;
    const W = 3840, H = 2160;
    for (const rt of [C.renderTarget1, C.renderTarget2]) if (rt.samples !== 4) { rt.samples = 4; rt.dispose(); }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    // Inside one frame callback, after the game's own update: move its camera,
    // grow the canvas + composer to 4K, render, read it straight back.
    return await new Promise((done) => requestAnimationFrame(() => {
      cam.fov = v[6]; cam.aspect = W / H; cam.near = 0.1; cam.far = 2000;
      cam.position.set(v[0], v[1], v[2]);
      cam.lookAt(v[3], v[4], v[5]);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld(true);
      R.setPixelRatio(1); R.setSize(W, H, false);
      C.setPixelRatio?.(1); C.setSize(W, H);
      // A spawn that hurts (Hollowgrin) leaves the low-HP blur on: clear it.
      for (const p of C.passes) for (const k of ["uHitFlash", "uLowHp", "uAberration", "uSuppress"]) if (p.uniforms?.[k]) p.uniforms[k].value = 0;
      C.render(0.016);
      done(R.domElement.toDataURL("image/png"));
    }));
  }, VIEWS[id]);
  const master = path.join(MASTER, `${id}.png`);
  fs.writeFileSync(master, Buffer.from(data.split(",")[1], "base64"));
  for (const w of WIDTHS) {
    execFileSync(FFMPEG, ["-v", "error", "-y", "-i", master, "-vf", `scale=${w}:-2:flags=lanczos+accurate_rnd+full_chroma_int`,
      "-c:v", "libwebp", "-quality", "92", "-compression_level", "6", "-preset", "picture", path.join(OUT, `${id}-${w}.webp`)]);
  }
  console.log(`${id}: master + ${WIDTHS.length} webp`);
  await page.close();
}
await browser.close();
server.close();
