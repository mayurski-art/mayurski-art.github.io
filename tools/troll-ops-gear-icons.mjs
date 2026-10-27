// Renders the HUD's gear icons (the chips bottom-left: melee, lethal,
// tactical, and Troll Royale's Cope Plates and Hopium) from the game's own
// models: buildMeleeMesh for every melee weapon (the loadout's and Zombie
// Rush's), buildThrowable for every lethal and tactical, and
// royale-loot-models.js for the plate and the Hopium. One headless page
// builds each, poses it (swords and the injector across the diagonal,
// grenades and the plate upright, all at a three-quarter turn), lights it
// like the menu's WeaponInspector, frames it tight in an orthographic
// camera and draws it at 512 px; the picture is scaled down to 128 px with
// a soft dark outline (so it reads over a bright sky as well as a dark
// floor) and saved as assets/games/troll-ops/gear-icons/<id>.png.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-gear-icons.mjs [id ...]
// SHEET=<file.png> also saves a contact sheet (each icon at 128 and at 22 px,
// on dark and light grounds) for looking them over.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "assets/games/troll-ops/gear-icons");
fs.mkdirSync(OUT, { recursive: true });

// How each one is posed. `axis`: the model axis its length runs along
// ("x" | "y" | "z"), `flip`: its tip is at that axis's minus end, `spin`:
// a turn round its own length (radians) to show a face, `diag`: lay the
// length across the frame's diagonal (tip up-right); otherwise it stands up.
// `yaw` / `pitch`: the camera's three-quarter turn.
const POSE = {
  keyboard:   { diag: true, axis: "z", flip: true, spin: 0.5 },
  trollsaber: { diag: true, axis: "z", flip: true, spin: 0.6 },
  reaper:     { diag: true, axis: "z", flip: true, spin: 0.5 },
  chainsaw:   { diag: true, axis: "z", flip: true, spin: 1.2 },
  knuckles:   { yaw: 0.2, pitch: 0.2 },
  halo:       { diag: true, axis: "z", flip: true, spin: 0.5 },
  bat:        { diag: true, axis: "z", flip: true, spin: 0.4 },
  shovel:     { diag: true, axis: "z", flip: true, spin: 0.8 },
  frag:       { yaw: -0.6, pitch: 0.3, tilt: 0.25 },
  flash:      { yaw: -0.6, pitch: 0.3, tilt: 0.25 },
  smoke:      { yaw: -0.6, pitch: 0.3, tilt: 0.25 },
  emp:        { yaw: -0.6, pitch: 0.3, tilt: 0.25 },
  plate:      { yaw: -0.5, pitch: 0.15 },
  heal:       { diag: true, axis: "y", spin: 0.4 },
};

// The builders' modules under the same ?v= tags gear.js imports them with:
// another tag is another copy of the module, and the preloads below would
// fill a copy gear.js never reads.
const GAME = "/assets/games/troll-ops/";
const gearSrc = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/weapons/gear.js"), "utf8");
const tagOf = (src, file) => (src.match(new RegExp(`${file.replace(".", "\\.")}(\\?v=[^"]*)"`)) || [, ""])[1];
const U = {
  throwables: `${GAME}combat/throwable-models.js${tagOf(gearSrc, "throwable-models.js")}`,
  saber: `${GAME}weapons/trollsaber.js${tagOf(gearSrc, "trollsaber.js")}`,
  halloween: `${GAME}weapons/melee-models.js${tagOf(gearSrc, "melee-models.js")}`,
};

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000">
<script type="importmap">{"imports":{"three":"/assets/vendor/r186/three.module.js","three/addons/":"/assets/vendor/r186/addons/"}}</script>
<script type="module">
import * as THREE from "three";
import { MELEE_DEFS, THROWABLE_DEFS, buildMeleeMesh } from "/assets/games/troll-ops/weapons/gear.js";
import { buildThrowable, modelKind } from "${U.throwables}";
import { preloadTrollsaber } from "${U.saber}";
import { preloadHalloweenMelee } from "${U.halloween}";
import { buildCopePlate, buildHopium } from "/assets/games/troll-ops/modes/royale-loot-models.js";

const BIG = 512, SMALL = 128;
const canvas = document.createElement("canvas");
canvas.width = canvas.height = BIG;
document.body.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;   // as the game and the inspector
renderer.toneMappingExposure = 1.7;
const scene = new THREE.Scene();
// The inspector's rig, the rim a touch stronger: a black keyboard has to
// keep its edges at 22 px.
const key = new THREE.DirectionalLight(0xfff2d8, 4.2); key.position.set(1.2, 1.6, 1.4);
const rim = new THREE.DirectionalLight(0x9fd0ff, 2.2); rim.position.set(-1.4, 0.7, -1.2);
const fill = new THREE.DirectionalLight(0xc8ffb8, 0.9); fill.position.set(0, -1, 0.6);
scene.add(key, rim, fill, new THREE.AmbientLight(0xaebccd, 1.5));
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);

const AX = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

function build(id) {
  if (id === "plate") return buildCopePlate();
  if (id === "heal") return buildHopium();
  if (MELEE_DEFS[id]) {
    const m = buildMeleeMesh(MELEE_DEFS[id], false);
    m.traverse((o) => { if (o.userData.hand) o.visible = false; });
    return m;
  }
  if (THROWABLE_DEFS[id]) return buildThrowable(modelKind(THROWABLE_DEFS[id]), { pin: true, spoon: true });
  throw new Error("no model for " + id);
}

function pose(obj, p) {
  const holder = new THREE.Group();
  holder.add(obj);
  // centre it
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj, true);
  const c = box.getCenter(new THREE.Vector3());
  obj.position.sub(c);
  const q = new THREE.Quaternion();
  if (p.diag) {
    // the length onto +y (tip up), turned on itself, then laid across the diagonal
    const from = AX[p.axis || "y"].clone().multiplyScalar(p.flip ? -1 : 1);
    q.setFromUnitVectors(from, AX.y);
    q.premultiply(new THREE.Quaternion().setFromAxisAngle(AX.y, p.spin || 0));
    q.premultiply(new THREE.Quaternion().setFromAxisAngle(AX.z, -Math.PI / 4));
  } else if (p.tilt) {
    q.setFromAxisAngle(AX.z, -p.tilt);
  }
  holder.quaternion.copy(q);
  return holder;
}

function frame(root, p) {
  const yaw = p.diag ? 0 : (p.yaw ?? 0), pitch = p.diag ? 0.12 : (p.pitch ?? 0);
  const dist = 10;
  camera.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  root.updateMatrixWorld(true);
  // Tight fit: every visible vertex in camera space.
  const inv = camera.matrixWorldInverse, v = new THREE.Vector3();
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes.position) return;
    let vis = true; for (let a = o; a; a = a.parent) if (!a.visible) vis = false;
    if (!vis) return;
    const pos = o.geometry.attributes.position;
    const im = o.isInstancedMesh ? o : null;
    const m = new THREE.Matrix4(), mi = new THREE.Matrix4();
    const n = im ? im.count : 1;
    for (let k = 0; k < n; k++) {
      m.copy(o.matrixWorld);
      if (im) { im.getMatrixAt(k, mi); m.multiply(mi); }
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m).applyMatrix4(inv);
        x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
      }
    }
  });
  const half = Math.max(x1 - x0, y1 - y0) / 2 * 1.08, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  camera.left = cx - half; camera.right = cx + half; camera.top = cy + half; camera.bottom = cy - half;
  camera.near = 0.01; camera.far = 100;
  camera.updateProjectionMatrix();
}

/* 512 -> 128 in halves, then a soft dark outline under it. */
function shrink() {
  let src = canvas, s = BIG;
  while (s > SMALL) {
    const c = document.createElement("canvas");
    c.width = c.height = s / 2;
    const g = c.getContext("2d");
    g.imageSmoothingQuality = "high";
    g.drawImage(src, 0, 0, s / 2, s / 2);
    src = c; s /= 2;
  }
  const sil = document.createElement("canvas");
  sil.width = sil.height = SMALL;
  const sg = sil.getContext("2d");
  sg.drawImage(src, 0, 0);
  sg.globalCompositeOperation = "source-in";
  sg.fillStyle = "rgba(0,0,0,0.75)";
  sg.fillRect(0, 0, SMALL, SMALL);
  const out = document.createElement("canvas");
  out.width = out.height = SMALL;
  const g = out.getContext("2d");
  for (let a = 0; a < 16; a++) {
    const r = 2.2;
    g.drawImage(sil, Math.cos(a / 16 * Math.PI * 2) * r, Math.sin(a / 16 * Math.PI * 2) * r);
  }
  g.drawImage(src, 0, 0);
  return out.toDataURL("image/png");
}

window.renderIcons = async (ids, poses) => {
  await Promise.all([preloadTrollsaber(), preloadHalloweenMelee()].map((p) => p.catch(() => {})));
  const built = ids.map((id) => [id, build(id)]);
  // textures (the keyboard's keycaps and grin, the knuckles' plates) arrive late
  await new Promise((r) => setTimeout(r, 2500));
  const out = {};
  for (const [id, obj] of built) {
    const root = pose(obj, poses[id] || {});
    scene.add(root);
    frame(root, poses[id] || {});
    renderer.render(scene, camera);
    out[id] = shrink();
    scene.remove(root);
  }
  return out;
};
window.ALL_IDS = [...Object.keys(MELEE_DEFS), ...Object.keys(THROWABLE_DEFS), "plate", "heal"];
window.ready = true;
</script>`;

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (pathname === "/__gear-icons.html") { res.writeHead(200, { "content-type": "text/html" }); return res.end(PAGE); }
  const p = path.join(ROOT, pathname);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`] });
const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
await page.route(/supabase/, (r) => r.abort());
page.on("pageerror", (e) => console.log("page error:", e.message));
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log(`[${m.type()}]`, m.text()); });
await page.goto(`${BASE}/__gear-icons.html`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.ready, null, { timeout: 60000 });
const all = await page.evaluate(() => window.ALL_IDS);
const ids = process.argv.slice(2).length ? process.argv.slice(2) : all;
const missing = all.filter((id) => !POSE[id]);
if (missing.length) console.log("no pose for:", missing.join(", "), "(drawn with the default)");
const pics = await page.evaluate(([ids, poses]) => window.renderIcons(ids, poses), [ids, POSE]);
for (const [id, url] of Object.entries(pics)) {
  fs.writeFileSync(path.join(OUT, `${id}.png`), Buffer.from(url.split(",")[1], "base64"));
  console.log("wrote", `gear-icons/${id}.png`);
}

if (process.env.SHEET) {
  const html = `<body style="margin:0;font:11px sans-serif;color:#ccc">${["#111", "#9ab"].map((bg) => `
    <div style="display:flex;flex-wrap:wrap;gap:6px;padding:8px;background:${bg}">${Object.keys(pics).map((id) => `
      <div style="text-align:center;width:140px"><img src="${pics[id]}" width="128" height="128"><br>
      <img src="${pics[id]}" height="22"> <img src="${pics[id]}" height="22"> ${id}</div>`).join("")}</div>`).join("")}</body>`;
  await page.setContent(html);
  await page.setViewportSize({ width: 1180, height: 900 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: process.env.SHEET, fullPage: true });
  console.log("sheet:", process.env.SHEET);
}

await browser.close();
server.close();
