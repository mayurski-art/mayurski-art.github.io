// Bake the TROLLS head traits: assets/games/troll-ops/traits/src/<id>.svg
// -> traits/<id>.png, in headless Chromium so the type (Impact) becomes
// pixels once, the same on every player's device.
//
//   node tools/troll-ops-bake-traits.mjs              # every svg in src/
//   node tools/troll-ops-bake-traits.mjs --compose <out.png> <id> [<id> ...]
//        also writes the face art with those traits on it (a 2D check)
//
// Needs Playwright (the repo's node_modules).
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "assets/games/troll-ops/traits");
const SRC = join(DIR, "src");
const FACE = join(ROOT, "assets/images/wallpaper/trollface transparent.png");
const W = 1000, H = 1033;   // the head-trait frame (traits/README.md)

const args = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });

async function shoot(html, out, w = W, h = H) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${html}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  writeFileSync(out, await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } }));
  console.log("wrote", out);
}

// Each svg's own size (its viewBox): head traits are the head frame, clothes
// the garment frame (TROLLS-TRAITS.md).
for (const f of readdirSync(SRC).filter((f) => f.endsWith(".svg"))) {
  const svg = readFileSync(join(SRC, f), "utf8");
  const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
  await shoot(svg, join(DIR, f.replace(/\.svg$/, ".png")), vb ? +vb[1] : W, vb ? +vb[2] : H);
}

const ci = args.indexOf("--compose");
if (ci >= 0) {
  const out = args[ci + 1];
  const ids = args.slice(ci + 2);
  const b64 = (p) => `data:image/png;base64,${readFileSync(p).toString("base64")}`;
  // each layer at its own height (a beard's frame runs on below the head's)
  const pngH = (p) => readFileSync(p).readUInt32BE(20);
  const CH = Math.max(H, ...ids.map((id) => pngH(join(DIR, `${id}.png`))));
  const layer = (src) => `<img src="${src}" style="position:absolute;left:0;top:0;width:${W}px;height:auto">`;
  await shoot(
    `<div style="position:relative;width:${W}px;height:${CH}px;background:#7d7d7d">
       <img src="${b64(FACE)}" style="position:absolute;left:100px;top:233.3px;width:800px;height:750px">
       ${ids.map((id) => layer(b64(join(DIR, `${id}.png`)))).join("")}
     </div>`, out, W, CH);
}
await browser.close();
