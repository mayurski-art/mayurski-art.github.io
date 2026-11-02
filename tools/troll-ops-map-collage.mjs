// A map shot made of several views blended into one 16:9 frame (Kabukigrin:
// the street up A Main, the dug club from the B1 balcony, the bead curtain
// and lasers), for maps whose look one camera can't hold. Each view renders
// through troll-ops-map-previews.mjs (VIEW + TAG, 4K, the game's post
// chain), the panels are laid side by side with slanted feathered seams and
// a soft vignette in a headless canvas, and the result replaces
// .claude/map-shots-hq/<id>.png and the ui/maps/<id>-<w>.webp ladder.
// Bump the map's SHOT_V in map-load-screen.js after.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-map-collage.mjs [mapId]
// SKIP_RENDER=1 re-blends the masters already in .claude/map-shots-hq.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MASTER = path.join(ROOT, ".claude/map-shots-hq");
const OUT = path.join(ROOT, "assets/games/troll-ops/ui/maps");
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const W = 3840, H = 2160;

// view: [camera x, y, z, look-at x, y, z, fov]; sx = the source column that
// lands on the panel's centre cx; seams = canvas x where each panel hands over
const COLLAGES = {
  kabukigrin: {
    slant: 12, feather: 420, vignette: 0.4, seams: [1350, 2700],
    panels: [
      { tag: "col-street", view: [-27.4, 2.4, -35.5, -28.1, 5.0, 4, 60], cx: 700, sx: 1650 },   // up A Main: the club signs, the wet street
      { tag: "col-club", view: [-13.5, -3.2, 19.5, -30, -5.2, 14.5, 74], cx: 2000, sx: 1900 },   // the B1 balcony: ring, disco ball, DJ arch, floor
      { tag: "col-ring", view: [-17.5, -6.6, 21, -30, -3.6, 14.5, 82], cx: 3300, sx: 3200 },   // the bead curtain and lasers, its DJ arch and ball kept out of frame
    ],
  },
};

const id = process.argv[2] || "kabukigrin";
const L = COLLAGES[id];
if (!L) throw new Error(`no collage for ${id}`);
if (!process.env.SKIP_RENDER) for (const p of L.panels) {
  execFileSync(process.execPath, [path.join(ROOT, "tools/troll-ops-map-previews.mjs"), id],
    { stdio: "inherit", env: { ...process.env, VIEW: p.view.join(","), TAG: p.tag } });
}

const srcs = {};
for (const p of L.panels) srcs[p.tag] = "data:image/png;base64," + fs.readFileSync(path.join(MASTER, `${p.tag}.png`)).toString("base64");
const browser = await chromium.launch();
const page = await browser.newPage();
const png = await page.evaluate(async ({ L, srcs, W, H }) => {
  const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = s; });
  const imgs = {};
  for (const k in srcs) imgs[k] = await load(srcs[k]);
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  const a = L.slant * Math.PI / 180, nx = Math.cos(a), ny = Math.sin(a);
  // keep one side of a slanted seam through (x, H/2), fading across `feather`
  const seam = (ctx, x, keepRight) => {
    const gr = ctx.createLinearGradient(x - nx * L.feather / 2, H / 2 - ny * L.feather / 2, x + nx * L.feather / 2, H / 2 + ny * L.feather / 2);
    gr.addColorStop(0, `rgba(0,0,0,${keepRight ? 0 : 1})`);
    gr.addColorStop(1, `rgba(0,0,0,${keepRight ? 1 : 0})`);
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
  };
  L.panels.forEach((p, i) => {
    const t = document.createElement("canvas"); t.width = W; t.height = H;
    const tc = t.getContext("2d");
    tc.drawImage(imgs[p.tag], p.cx - p.sx, 0, W, H);
    if (i > 0) seam(tc, L.seams[i - 1], true);
    if (i < L.panels.length - 1) seam(tc, L.seams[i], false);
    g.drawImage(t, 0, 0);
  });
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.62);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, `rgba(0,0,0,${L.vignette})`);
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  return c.toDataURL("image/png");
}, { L, srcs, W, H });
await browser.close();

const master = path.join(MASTER, `${id}.png`);
fs.writeFileSync(master, Buffer.from(png.split(",")[1], "base64"));
for (const w of [640, 1280, 1920, 2560, 3840]) {
  execFileSync(FFMPEG, ["-v", "error", "-y", "-i", master, "-vf", `scale=${w}:-2:flags=lanczos+accurate_rnd+full_chroma_int`,
    "-c:v", "libwebp", "-quality", "92", "-compression_level", "6", "-preset", "picture", path.join(OUT, `${id}-${w}.webp`)]);
}
console.log(`${id}: collage master + 5 webp`);
