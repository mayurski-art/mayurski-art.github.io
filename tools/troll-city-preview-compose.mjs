// Troll City's preview, the blend: the three 4K plates from
// troll-city-preview.mjs made into one picture. Main Street and #1272 in
// the middle; the saloon bar (left) and St. Grinsworth's with Reverend Grin
// (right) dissolve in from the sides; then one warm grade over all of it, a
// soft glow, a vignette and a little grain, so it reads as one image.
// Writes the master to .claude/map-shots-hq/trollcity.png and the webp
// ladder that map-load-screen.js serves (bump SHOT_V.trollcity after).
//
//   NODE_PATH=<main checkout>/node_modules node tools/troll-city-preview-compose.mjs [--draft]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IN = process.env.IN || path.join(ROOT, ".claude/map-shots-hq/trollcity-preview");
const MASTER = path.join(ROOT, ".claude/map-shots-hq/trollcity.png");
const OUT = path.join(ROOT, "assets/games/troll-ops/ui/maps");
const WIDTHS = [640, 1280, 1920, 2560, 3840];
const DRAFT = process.argv.includes("--draft");
const png = (id) => "data:image/png;base64," + fs.readFileSync(path.join(IN, `${id}.png`)).toString("base64");

// Each side plate: which part of its frame shows (its centre, 0..1 across),
// and where it fades out (fraction of the picture's width from its edge).
const LAYOUT = {
  bar: { centre: +(process.env.BAR_C || 0.62), from: 0.25, to: 0.34 },
  chapel: { centre: +(process.env.CH_C || 0.5), from: 0.25, to: 0.34 },
};

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
const page = await browser.newPage();
const data = await page.evaluate(async ({ srcs, L }) => {
  const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = s; });
  const [hero, bar, chapel] = await Promise.all([load(srcs.hero), load(srcs.bar), load(srcs.chapel)]);
  const W = hero.width, H = hero.height;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.drawImage(hero, 0, 0);

  // a side plate through a soft mask: solid at its edge, gone by `to`
  const side = (img, lay, left) => {
    const t = document.createElement("canvas"); t.width = W; t.height = H;
    const tg = t.getContext("2d");
    const sw = W * lay.to;   // the slice of the plate that shows, at 1:1
    const sx = Math.max(0, Math.min(img.width - sw, img.width * lay.centre - sw / 2));
    tg.drawImage(img, sx, 0, sw, H, left ? 0 : W - sw, 0, sw, H);
    // the mask: across, then faded at the top too, so the street's sunset
    // sky runs over the rooms' ceilings
    const m = document.createElement("canvas"); m.width = W; m.height = H;
    const mg = m.getContext("2d");
    const a = left ? 0 : W, b = left ? W * lay.to : W - W * lay.to;
    const gr = mg.createLinearGradient(a, 0, b, 0);
    const f = lay.from / lay.to;
    gr.addColorStop(0, "rgba(0,0,0,1)");
    gr.addColorStop(f, "rgba(0,0,0,1)");
    gr.addColorStop(f + (1 - f) * 0.5, "rgba(0,0,0,0.42)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    mg.fillStyle = gr; mg.fillRect(0, 0, W, H);
    mg.globalCompositeOperation = "destination-in";
    const up = mg.createLinearGradient(0, 0, 0, H);
    up.addColorStop(0.02, "rgba(0,0,0,0)"); up.addColorStop(0.2, "rgba(0,0,0,1)"); up.addColorStop(1, "rgba(0,0,0,1)");
    mg.fillStyle = up; mg.fillRect(0, 0, W, H);
    tg.globalCompositeOperation = "destination-in";
    tg.drawImage(m, 0, 0);
    g.drawImage(t, 0, 0);
  };
  side(bar, L.bar, true);
  side(chapel, L.chapel, false);
  // a soft smoky seam where each room gives way to the street
  for (const [lay, left] of [[L.bar, true], [L.chapel, false]]) {
    const x0 = left ? W * (lay.from - 0.04) : W * (1 - lay.to - 0.02), x1 = left ? W * (lay.to + 0.02) : W * (1 - lay.from + 0.04);
    const sg = g.createLinearGradient(x0, 0, x1, 0);
    sg.addColorStop(0, "rgba(20,8,14,0)"); sg.addColorStop(0.5, "rgba(20,8,14,0.5)"); sg.addColorStop(1, "rgba(20,8,14,0)");
    g.fillStyle = sg; g.fillRect(x0, 0, x1 - x0, H);
  }

  // the grade: a touch more contrast and warmth, the shadows pulled to a
  // deep plum so the three rooms share one palette
  const graded = document.createElement("canvas"); graded.width = W; graded.height = H;
  const gg = graded.getContext("2d");
  gg.filter = "contrast(1.06) saturate(1.06)";
  gg.drawImage(c, 0, 0);
  gg.filter = "none";
  gg.globalCompositeOperation = "soft-light";
  gg.fillStyle = "rgba(255,170,90,0.14)"; gg.fillRect(0, 0, W, H);
  gg.globalCompositeOperation = "lighten";
  gg.fillStyle = "rgb(12,5,10)"; gg.fillRect(0, 0, W, H);

  // glow: the bright parts blurred and screened back on (the lamps, the
  // bottles, the apse, the sky at the horizon)
  const glow = document.createElement("canvas"); glow.width = W / 4; glow.height = H / 4;
  const gl = glow.getContext("2d");
  gl.filter = "brightness(0.85) contrast(2.2) blur(14px)";
  gl.drawImage(graded, 0, 0, W / 4, H / 4);
  gg.globalCompositeOperation = "screen";
  gg.globalAlpha = 0.16;
  gg.drawImage(glow, 0, 0, W, H);
  gg.globalAlpha = 1;

  // a sun flare low behind the town hall
  gg.globalCompositeOperation = "screen";
  const fl = gg.createRadialGradient(W * 0.5, H * 0.36, 0, W * 0.5, H * 0.36, W * 0.42);
  fl.addColorStop(0, "rgba(255,196,120,0.16)"); fl.addColorStop(0.4, "rgba(255,150,80,0.05)"); fl.addColorStop(1, "rgba(0,0,0,0)");
  gg.fillStyle = fl; gg.fillRect(0, 0, W, H);

  // vignette
  gg.globalCompositeOperation = "multiply";
  const v = gg.createRadialGradient(W / 2, H * 0.52, H * 0.42, W / 2, H * 0.52, W * 0.66);
  v.addColorStop(0, "rgba(255,255,255,1)"); v.addColorStop(1, "rgba(70,40,50,1)");
  gg.fillStyle = v; gg.fillRect(0, 0, W, H);

  // fine grain, so the dissolves never band
  gg.globalCompositeOperation = "overlay";
  const n = document.createElement("canvas"); n.width = 512; n.height = 512;
  const ng = n.getContext("2d"), id = ng.createImageData(512, 512);
  for (let i = 0; i < id.data.length; i += 4) { const k = 128 + (Math.random() - 0.5) * 34; id.data[i] = id.data[i + 1] = id.data[i + 2] = k; id.data[i + 3] = 255; }
  ng.putImageData(id, 0, 0);
  gg.globalAlpha = 0.35;
  gg.fillStyle = gg.createPattern(n, "repeat"); gg.fillRect(0, 0, W, H);
  gg.globalAlpha = 1;
  return graded.toDataURL("image/png");
}, { srcs: { hero: png("hero"), bar: png("bar"), chapel: png("chapel") }, L: LAYOUT });
await browser.close();

const buf = Buffer.from(data.split(",")[1], "base64");
if (DRAFT) {
  const f = path.join(IN, "compose-draft.png");
  fs.writeFileSync(f, buf);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", f, "-vf", "scale=1280:-2:flags=lanczos", path.join(IN, "compose-draft-1280.png")]);
  console.log(path.join(IN, "compose-draft-1280.png"));
} else {
  fs.writeFileSync(MASTER, buf);
  for (const w of WIDTHS) {
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", MASTER, "-vf", `scale=${w}:-2:flags=lanczos+accurate_rnd+full_chroma_int`,
      "-c:v", "libwebp", "-quality", "92", "-compression_level", "6", "-preset", "picture", path.join(OUT, `trollcity-${w}.webp`)]);
  }
  console.log(`master ${MASTER} + ${WIDTHS.length} webp`);
}
