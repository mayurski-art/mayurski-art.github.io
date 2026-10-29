// Troll Royale: Two Worlds, phase 3: the flip's small island wears the two
// real faces, shot straight down from the game. Writes
// assets/games/troll-ops/ui/flip/trollface.webp (Trollface Island, the top)
// and hollowgrin.webp (Hollowgrin Island, the underside), each the coast's
// bounding box (models/hollowgrin-island.json, in the island's own frame)
// north up, for modes/royale-flip.js. Re-run after either side changes.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-flip-faces.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
const OUT = path.join(ROOT, "assets/games/troll-ops/ui/flip");
fs.mkdirSync(OUT, { recursive: true });

const S = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/models/hollowgrin-island.json"), "utf8"));
const xs = S.coast.map((p) => p[0] - S.offset[0]), zs = S.coast.map((p) => p[1] - S.offset[1]);
const BOX = { x0: Math.min(...xs) - 2, x1: Math.max(...xs) + 2, z0: Math.min(...zs) - 2, z1: Math.max(...zs) + 2 };   // the island's frame
const W = 1600, H = Math.round(W * (BOX.z1 - BOX.z0) / (BOX.x1 - BOX.x0));

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
for (const [side, mode, off] of [["trollface", "royale", [0, 0]], ["hollowgrin", "royale_hollowgrin", S.offset]]) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.route(/supabase/, (r) => r.abort());
  page.on("pageerror", (e) => console.log(side, "ERR", e.message));
  await page.addInitScript((s) => { window.__royaleSide = s; }, side);
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 120000 });
  await page.evaluate(async (mode) => {
    const T = window.__trollOps;
    T.DROP.enabled = false;
    T.els.noBots.checked = true;
    T.setMode(mode);
    T.els.room.value = "FF" + Math.random().toString(36).slice(2, 6).toUpperCase();
    T.els.room.dispatchEvent(new Event("input"));
    await T.startGame();
  }, mode);
  await page.waitForFunction(() => window.__trollOps.state() === "playing" && !!window.__trollOps.royale(), null, { timeout: 180000 });
  await new Promise((r) => setTimeout(r, 25000));   // the models and the island stream in
  const url = await page.evaluate(async ([box, off, W, H]) => {
    const THREE = await import("three");
    const { sky } = await import("./assets/games/troll-ops/view/sky.js?v=sr1-ss1-ss2-ss3-tfm2");
    const T = window.__trollOps, r = T.renderer, sc = T.scene;
    const cx = (box.x0 + box.x1) / 2 + off[0], cz = (box.z0 + box.z1) / 2 + off[1];
    const cam = new THREE.OrthographicCamera(-(box.x1 - box.x0) / 2, (box.x1 - box.x0) / 2, (box.z1 - box.z0) / 2, -(box.z1 - box.z0) / 2, 1, 200);
    cam.position.set(cx, 125, cz);
    cam.up.set(0, 0, -1);
    cam.lookAt(cx, 0, cz);
    cam.updateMatrixWorld();
    const keep = { fog: sc.fog?.density, sky: sky.visible, zone: T.royale().visual.group.visible, rig: T.localRig?.root.visible };
    if (sc.fog) sc.fog.density = 0;
    sky.visible = false;
    T.royale().visual.group.visible = false;
    if (T.localRig) T.localRig.root.visible = false;
    r.setSize(W, H, false);
    r.setClearColor(0x05060c, 1);
    r.render(sc, cam);
    const data = r.domElement.toDataURL("image/webp", 0.9);
    if (sc.fog) sc.fog.density = keep.fog;
    sky.visible = keep.sky;
    T.royale().visual.group.visible = keep.zone;
    return data;
  }, [BOX, off, W, H]);
  fs.writeFileSync(path.join(OUT, `${side}.webp`), Buffer.from(url.split(",")[1], "base64"));
  console.log(`wrote ui/flip/${side}.webp (${W} x ${H})`);
  await page.close();
}
await browser.close();
server.close();
fs.writeFileSync(path.join(OUT, "box.json"), JSON.stringify(BOX) + "\n");
