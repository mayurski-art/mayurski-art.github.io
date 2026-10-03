// Renders the loadout picker thumbnail for each finish (skins.js FINISHES):
// the Problem 416 wearing it, from the same angle and size as the baked
// banner skins' thumbs (tools/troll-skin-bake.html), to skins/<id>-thumb.jpg.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-finish-thumbs.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "assets/games/troll-ops/skins");
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

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 800, height: 400 } });
page.on("pageerror", (e) => console.log("ERR", e.message));
// The game page carries the import map for "three".
await page.goto(`${BASE}/troll-ops.html?tohooks=1`);
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
const shots = await page.evaluate(async () => {
  const THREE = await import("three");
  const wm = await import("/assets/games/troll-ops/weapon-model.js?v=p5");
  const { FINISHES } = await import("/assets/games/troll-ops/skins.js?v=p5");
  const { resolveWeapon } = await import("/assets/games/troll-ops/attachments.js?v=cg1");
  const canvas = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(360, 128, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const pm = new THREE.PMREMGenerator(renderer);
  // A little studio for the reflections: a dim room with three light panels.
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0x30343a);
  const panel = (x, y, z, w, h, c) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); studio.add(m); };
  panel(-3, 3, 2, 4, 2, 0xffffff); panel(3, 1, -3, 3, 2, 0xbfd8ff); panel(0, -3, 0, 6, 6, 0x15181c);
  wm.setWeaponEnvMap(pm.fromScene(studio, 0.04).texture);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e1216);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a1d20, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(-2, 3, 2); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc4ff, 1.2); rim.position.set(2, 1, -3); scene.add(rim);
  const cam = new THREE.PerspectiveCamera(24, 360 / 128, 0.01, 10);
  cam.position.set(-0.84, 0.03, -0.14);
  cam.lookAt(0, -0.055, -0.14);
  const out = {};
  for (const f of FINISHES) {
    const def = { ...resolveWeapon("problem416", { optic: "reflex" }) };
    def.attachments = { ...(def.attachments || {}), optic: "reflex", skin: f.id };
    const gun = wm.buildWeaponMesh(def);
    gun.traverse((o) => { if (o.userData.hand) o.visible = false; });
    scene.add(gun);
    renderer.render(scene, cam);
    out[f.id] = canvas.toDataURL("image/jpeg", 0.86);
    scene.remove(gun);
  }
  return out;
});
for (const [id, url] of Object.entries(shots)) {
  fs.writeFileSync(path.join(OUT, `${id}-thumb.jpg`), Buffer.from(url.split(",")[1], "base64"));
  console.log("wrote", `${id}-thumb.jpg`);
}
await browser.close();
server.close();
