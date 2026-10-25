// Trollface Island's build timelapse (user, 2026-10-25: "a timelapse of the
// map being built over time ... you can see in real time progressive
// improvements"). Shoots the island from FIXED cameras (never change VIEWS:
// a moved camera breaks the sequence), one frame set per landed step, with
// the date, time, commit and a label burnt into each frame; --video stitches
// every view's frames into an mp4 plus a 2 x 2 grid of all four.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-island-timelapse.mjs --label "phase 0: builder"
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-island-timelapse.mjs --video [--hold 0.7]
//
// Frames go to <main checkout>/.claude/island-timelapse/<view>/NNN.png (shared
// by every worktree, kept out of git), with index.json listing each frame's
// time, commit and label. Royale mode, no bots, no drop, graphics High, 1080p
// through the game's own post chain (SSAO, bloom, 4x MSAA), the zone and
// loot beams hidden. Never a public room (Supabase is blocked).
// FFMPEG=<path> if ffmpeg isn't on PATH; FONT=<ttf> for the stamp (default Arial).

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const FONT = (process.env.FONT || "C:/Windows/Fonts/arial.ttf").replace(/\\/g, "/");
const W = 1920, H = 1080;

// the main checkout (worktrees share it), so one sequence collects every session's frames
const common = execFileSync("git", ["rev-parse", "--git-common-dir"], { cwd: ROOT, encoding: "utf8" }).trim();
const MAIN = path.resolve(ROOT, common, "..");
const DIR = path.join(MAIN, ".claude/island-timelapse");
const INDEX = path.join(DIR, "index.json");

// [x, y, z, lookX, lookY, lookZ, fov]: FIXED for the life of the timelapse
const VIEWS = {
  aerial: [18, 385, 232, 18, -12, 20, 44],        // the whole island from the south (the load-screen shot)
  "troll-city": [14, 32, -32, -36, 4, -87, 55],   // the city from the lake's north shore
  "troll-peak": [0, 26, -5, 57, 8, -43, 55],       // the Peak over the Cave
  lake: [15, 95, 145, 15, 0, 15, 55],              // the lake, the Boat, the Shop and the Bridge from the south
};

const drawtext = (text) => `drawtext=fontfile='${FONT.replace(/:/g, "\\:")}':text='${text.replace(/\\/g, "\\\\").replace(/'/g, "\u2019").replace(/:/g, "\\:")}':fontcolor=white:fontsize=34:box=1:boxcolor=black@0.55:boxborderw=14:x=28:y=h-th-28`;

function readIndex() { return fs.existsSync(INDEX) ? JSON.parse(fs.readFileSync(INDEX, "utf8")) : { frames: [] }; }

async function shoot(label) {
  const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  const index = readIndex();
  const n = index.frames.length;
  const num = String(n).padStart(3, "0");
  const when = new Date();
  const stamp = `${when.toISOString().slice(0, 10)} ${when.toTimeString().slice(0, 5)}  frame ${num}  ${commit}  ${label}`;
  const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(p).pipe(res);
  });
  await new Promise((r) => server.listen(0, r));
  const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("ERR", e.message));
  await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
  await page.evaluate(async () => {
    const T = window.__trollOps;
    T.DROP.enabled = false; T.settings.gfx = "high"; T.setMode("royale");
    if (T.els.noBots) T.els.noBots.checked = true;
    T.loadout.mapId = "trollface";
    await T.startGame(); if (T.isStaging()) T.endStaging();
  });
  await new Promise((r) => setTimeout(r, +(process.env.WAIT || 16000)));   // models + textures stream in
  const map = await page.evaluate(() => window.__trollOps.loadedMapId());
  if (map !== "trollface") throw new Error(`loaded ${map}, not trollface`);
  for (const [view, v] of Object.entries(VIEWS)) {
    const url = await page.evaluate(async (v) => {
      const T = window.__trollOps, R = T.renderer, C = T.composer, cam = T.camera;
      const W = 1920, H = 1080;
      for (const rt of [C.renderTarget1, C.renderTarget2]) if (rt.samples !== 4) { rt.samples = 4; rt.dispose(); }
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return await new Promise((done) => requestAnimationFrame(() => {
        cam.fov = v[6]; cam.aspect = W / H; cam.near = 0.1; cam.far = 2000;
        cam.position.set(v[0], v[1], v[2]); cam.lookAt(v[3], v[4], v[5]);
        cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
        R.setPixelRatio(1); R.setSize(W, H, false);
        C.setPixelRatio?.(1); C.setSize(W, H);
        for (const p of C.passes) for (const k of ["uHitFlash", "uLowHp", "uAberration", "uSuppress"]) if (p.uniforms?.[k]) p.uniforms[k].value = 0;
        for (const p of C.passes) if (p.constructor.name === "ViewmodelPass") p.enabled = false;
        const roy = T.royale?.();
        if (roy) {
          if (roy.visual?.group) roy.visual.group.visible = false;
          for (const m of [roy.loot?.beams, roy.loot?.rings]) if (m) m.visible = false;
          for (const it of roy.loot?.items?.values?.() || []) if (it.mesh) it.mesh.visible = false;
        }
        C.render(0.016);
        done(R.domElement.toDataURL("image/png"));
      }));
    }, v);
    const dir = path.join(DIR, view);
    fs.mkdirSync(dir, { recursive: true });
    const raw = path.join(dir, `${num}.raw.png`), out = path.join(dir, `${num}.png`);
    fs.writeFileSync(raw, Buffer.from(url.split(",")[1], "base64"));
    execFileSync(FFMPEG, ["-loglevel", "error", "-y", "-i", raw, "-vf", drawtext(stamp), out]);
    fs.unlinkSync(raw);
    console.log("frame", view, out);
  }
  await browser.close(); server.close();
  index.frames.push({ n, time: when.toISOString(), commit, label });
  fs.writeFileSync(INDEX, JSON.stringify(index, null, 1));
  console.log(`frame ${num} (${commit}, ${label}): ${Object.keys(VIEWS).length} views in ${path.relative(MAIN, DIR)}`);
}

function video(hold) {
  const index = readIndex();
  if (!index.frames.length) throw new Error("no frames yet");
  const views = Object.keys(VIEWS);
  const outs = [];
  for (const view of views) {
    const out = path.join(DIR, `${view}.mp4`);
    // every frame held `hold` s (the last one twice), 30 fps H.264 any player opens
    execFileSync(FFMPEG, ["-loglevel", "error", "-y", "-framerate", String(1 / hold), "-i", path.join(DIR, view, "%03d.png"),
      "-vf", `tpad=stop_mode=clone:stop_duration=${hold},fps=30,format=yuv420p`, "-c:v", "libx264", "-crf", "18", out]);
    outs.push(out);
  }
  const grid = path.join(DIR, "island-timelapse.mp4");
  // the four views in a 2 x 2 grid at 1080p
  execFileSync(FFMPEG, ["-loglevel", "error", "-y", ...outs.flatMap((o) => ["-i", o]),
    "-filter_complex", "[0:v]scale=960:540[a];[1:v]scale=960:540[b];[2:v]scale=960:540[c];[3:v]scale=960:540[d];[a][b][c][d]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0,format=yuv420p",
    "-c:v", "libx264", "-crf", "18", grid]);
  console.log(`${index.frames.length} frames -> ${views.map((v) => v + ".mp4").join(", ")} and island-timelapse.mp4 in ${path.relative(MAIN, DIR)} (${(hold * index.frames.length).toFixed(1)} s each)`);
}

if (args.includes("--video")) video(+opt("--hold", 0.7));
else await shoot(opt("--label", "") || "");
