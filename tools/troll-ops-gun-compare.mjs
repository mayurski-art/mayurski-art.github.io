// Troll Forces — a traced gun side by side with its reference: builds a
// weapon-traced.js spec in a headless page, renders it side-on with an
// orthographic camera at the reference's own pixel scale, and writes the
// reference, the render and the two laid over each other, stacked, so
// proportions can be checked by eye before a gun ships.
//
// Usage:
//   NODE_PATH=<main checkout>/node_modules node tools/troll-ops-gun-compare.mjs <id> <ref.png> <out.png>
//     [--module assets/games/troll-ops/weapon-ars.js] [--export AR_SPECS] [--optic iron]
// <ref.png> is the prepared reference troll-ops-trace.mjs wrote (the
// spec's pixels are its pixels). Needs no game, no room and no network.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const pos = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
const flag = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const [id, refPath, outPath] = pos;
if (!id || !refPath || !outPath) { console.error("usage: troll-ops-gun-compare.mjs <id> <ref.png> <out.png> [--module m] [--export E] [--optic o]"); process.exit(2); }
const mod = flag("module", "assets/games/troll-ops/weapon-ars.js");
const exp = flag("export", "AR_SPECS");
const optic = flag("optic", "iron");

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".png": "image/png" };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__compare.html") {
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(`<!doctype html><html><head><script type="importmap">{"imports":{"three":"/assets/vendor/three.module.min.js","three/addons/":"/assets/vendor/addons/"}}</script></head><body></body></html>`);
  }
  const p = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream", "cache-control": "no-store" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(`${BASE}/__compare.html`);
const refUrl = `data:image/png;base64,${fs.readFileSync(refPath).toString("base64")}`;

const png = await page.evaluate(async ({ mod, exp, id, optic, refUrl, bust }) => {
  const THREE = await import("three");
  const { buildTraced } = await import("/assets/games/troll-ops/weapon-traced.js?v=" + bust);
  const specs = (await import(`/${mod}?v=${bust}`))[exp];
  const spec = specs[id];
  if (!spec) throw new Error(`no spec ${id} in ${mod} ${exp}`);
  const ref = new Image(); ref.src = refUrl; await ref.decode();
  const W = ref.naturalWidth, H = ref.naturalHeight;

  const gun = buildTraced({ id, attachments: { optic, barrel: "none", underbarrel: "none" } }, spec, null);
  gun.traverse((o) => { if (o.userData.hand) o.visible = false; });

  // camera x in the image runs with px: cam_x = dir*0.02 + (px - gx)*s
  const s = spec.lengthM / (spec.pxLen[1] - spec.pxLen[0]);
  const [gx] = spec.gripAt;
  const left = spec.dir * 0.02 - gx * s, right = spec.dir * 0.02 + (W - gx) * s;
  const top = spec.boreY * s, bottom = -(H - spec.boreY) * s;
  const cam = new THREE.OrthographicCamera(left, right, top, bottom, 0.01, 50);
  cam.position.set(spec.dir === 1 ? -10 : 10, 0, 0);
  cam.up.set(0, 1, 0);
  cam.lookAt(0, 0, 0);

  const scene = new THREE.Scene();
  scene.add(gun);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(spec.dir === 1 ? -4 : 4, 6, 2);
  scene.add(sun);

  const k = Math.max(1, Math.round(1400 / W));
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W * k, H * k);
  renderer.setClearColor(0x000000, 0);
  renderer.render(scene, cam);

  // three rows: reference, render, render over reference (red tint, half)
  const c = document.createElement("canvas");
  c.width = W * k; c.height = H * k * 3 + 8;
  const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(ref, 0, 0, W * k, H * k);
  g.fillStyle = "#e9e9ee"; g.fillRect(0, H * k + 4, c.width, H * k);
  g.drawImage(renderer.domElement, 0, H * k + 4);
  const y3 = H * k * 2 + 8;
  g.globalAlpha = 0.55; g.drawImage(ref, 0, y3, W * k, H * k); g.globalAlpha = 1;
  const tint = document.createElement("canvas"); tint.width = W * k; tint.height = H * k;
  const tg = tint.getContext("2d");
  tg.drawImage(renderer.domElement, 0, 0);
  tg.globalCompositeOperation = "source-in"; tg.fillStyle = "rgba(255,45,85,0.55)"; tg.fillRect(0, 0, W * k, H * k);
  g.drawImage(tint, 0, y3);
  g.font = "13px monospace"; g.fillStyle = "#0057d9";
  g.fillText(`${id}: reference / render / overlay  (${spec.lengthM} m over ${spec.pxLen.join("-")} px)`, 6, 14);
  return c.toDataURL("image/png");
}, { mod, exp, id, optic, refUrl, bust: Date.now() });

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, Buffer.from(png.split(",")[1], "base64"));
await browser.close();
server.close();
if (errors.length) console.log("page errors:", errors.join(" | "));
console.log(`${outPath} written`);
