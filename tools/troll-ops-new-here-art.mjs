// The pictures in I'M NEW HERE (menu/new-here.js), rendered from the game
// itself (never stock or pre-existing art):
//   ui/new-here/touch-hud-{960,1600}.webp  a Test Range match on a sideways
//                                          phone, its touch buttons up
//   ui/new-here/locker-{960,1600}.webp     the Locker, your troll on the pad
// Offline: Supabase is blocked, the Range is solo (no room, never a public
// one). Bump ART_V in new-here.js after a re-render.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-new-here-art.mjs [touch-hud] [locker]
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "assets/games/troll-ops/ui/new-here");
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".webm": "video/webm", ".ktx2": "image/ktx2", ".hdr": "application/octet-stream" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const URL_ = `http://localhost:${server.address().port}/troll-ops.html?tohooks=1&season=off`;
const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const want = process.argv.slice(2);
const pick = (id) => !want.length || want.includes(id);

/* A PNG screenshot to webp at each width, through the page's own canvas. */
async function save(page, png, name) {
  const out = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const res = {};
    for (const w of [960, 1600]) {
      const c = document.createElement("canvas");
      c.width = w; c.height = Math.round(img.naturalHeight * w / img.naturalWidth);
      const g = c.getContext("2d");
      g.imageSmoothingQuality = "high";
      g.drawImage(img, 0, 0, c.width, c.height);
      res[w] = c.toDataURL("image/webp", 0.86).split(",")[1];
    }
    return res;
  }, png.toString("base64"));
  for (const [w, b] of Object.entries(out)) {
    fs.writeFileSync(path.join(OUT, `${name}-${w}.webp`), Buffer.from(b, "base64"));
    console.log(`wrote ui/new-here/${name}-${w}.webp`);
  }
}
async function open(opts) {
  const ctx = await browser.newContext(opts);
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("page error:", e.message));
  await page.goto(URL_, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__toBo2?.fn && !!window.__trollOps, null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  return { ctx, page };
}

if (pick("touch-hud")) {
  // an iPhone 13 sideways (844 x 390), touch
  const { ctx, page } = await open({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.evaluate(async () => {
    if (!window.TrollrunnerAccounts) window.TrollrunnerAccounts = {};
    window.__trollOps.setMode("range");
    await window.__trollOps.startGame();
  });
  await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 180000 });
  await page.waitForTimeout(6000);   // the intro and the drop-in settle
  const touch = await page.evaluate(() => !!document.getElementById("to-touch-fire")?.offsetParent);
  if (!touch) console.log("WARN the touch buttons aren't showing");
  // (?tohooks=1's animation readout: a test hook, never in a real match)
  await page.addStyleTag({ content: "#to-anim-debug { display: none !important; }" });
  await page.waitForTimeout(300);
  await save(page, await page.screenshot(), "touch-hud");
  await ctx.close();
}

if (pick("locker")) {
  const { ctx, page } = await open({ viewport: { width: 1600, height: 900 } });
  await page.evaluate(() => window.__toBo2.fn.goTab("locker"));
  await page.waitForTimeout(4000);   // the operator steps onto the pad
  await page.mouse.move(2, 2);
  await save(page, await page.screenshot(), "locker");
  await ctx.close();
}

await browser.close();
server.close();
