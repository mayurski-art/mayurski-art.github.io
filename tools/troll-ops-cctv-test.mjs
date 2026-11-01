// Troll Forces Socialize: Kabukigrin's security room and its CCTV
// (docs/KB-SECURITY-ROOM.md; maps/kabukigrin-cctv.js, modes/social-cctv.js).
// One tab, a private room, Supabase blocked (never a live room).
//   1. Ten cameras, ten monitors; out of the office nothing renders.
//   2. In the office the feeds render, one a frame; a feed's picture
//      changes from one render to the next (the club moves).
//   3. Rule 9 in the room: from a grid of eye points (standing, crouched,
//      the chair's seated eye) nothing of the room's (desk, kit, chart
//      monitor, chair, clutter) stands between the eye and the monitor wall,
//      the window or the doors. (The club-wide check for the cameras is
//      tools/troll-ops-obstruction-test.mjs: they're registered with it.)
//   4. Look at the wall, hold X: watching a camera full screen; A flips,
//      Space stands you back up.
//   5. A shot camera: NO SIGNAL, back after its timer.
//   Screenshots in tools/.cctv-shots: the wall head-on and from two angles,
//   watching three cameras, three cameras' models.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-cctv-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, "tools", ".cctv-shots");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 480000 });
await page.waitForFunction(() => !!window.__trollOps && !!window.__trollCctv, null, { timeout: 480000 });
await page.evaluate(() => window.__trollOps.setLoadWaitMax(8));
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.setMode("social"); T.loadout.mapId = "kabukigrin";
  await T.startGame();
  if (T.isStaging?.()) T.endStaging();
  T.player.maxHp = T.player.hp = 1e9;
});
await page.waitForFunction(() => !window.__trollOps.loadState().open, null, { timeout: 480000 });
const pump = async (ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) await page.screenshot({ type: "jpeg", quality: 10 }); };
await pump(2500);
// out of the club's line, the owner's band (the office is back of house)
await page.evaluate(() => {
  const C = window.__trollClub; if (C && C.club.phase !== "none") C.leave();
  C.club.band = C.BAND.owner; C.club.room = window.__trollOps.net?.room ?? "solo";
  window.__trollOps.els.pause.hidden = true;
});
const putAt = (x, z, y, yaw = 0, pitch = 0) => page.evaluate(({ x, z, y, yaw, pitch }) => {
  const T = window.__trollOps; T.move.reset(x, z, y); T.look.yaw = yaw; T.look.pitch = pitch;
}, { x, z, y, yaw, pitch });
const S = () => page.evaluate(() => window.__trollCctv.state());
const shot = (name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });

// ── 1. The kit; nothing renders out of the room ─────────────────────────
const kit = await page.evaluate(() => { const A = window.__trollCctv.api(); return { cams: A.cams.length, screens: A.screens.length, labels: A.cams.map((c) => c.label) }; });
check("ten cameras, ten monitors", kit.cams === 10 && kit.screens === 10, JSON.stringify(kit));
await putAt(-26, -2, 0, 0, 0);
await pump(600);
let s0 = await S();
await pump(800);
let s1 = await S();
check("out of the office: no feed renders", !s1.active && s1.renders === s0.renders, JSON.stringify({ s0, s1 }));

// ── 2. In the office the feeds run ──────────────────────────────────────
await putAt(-9.6, 22.6, 3, 0, 0.05);
await pump(500);
s0 = await S();
const f0 = await page.evaluate(() => window.__trollCctv.feed(3));
await pump(1500);
s1 = await S();
const f1 = await page.evaluate(() => window.__trollCctv.feed(3));
check("in the office: the feeds render, about one a frame", s1.active && s1.inRoom && s1.renders - s0.renders >= 10, JSON.stringify({ s0: s0.renders, s1: s1.renders }));
check("the floor camera's picture is lit and moving", f1.lit > f1.n * 0.3 && f1.sum !== f0.sum, JSON.stringify({ f0, f1 }));
await shot("01-wall-head-on");
await putAt(-11.9, 22.9, 3, -0.55, 0.0);
await pump(700);
await shot("02-wall-left");
await putAt(-7.4, 23.3, 3, 0.6, 0.0);
await pump(700);
await shot("03-wall-right");

// ── 3. Rule 9 in the room ───────────────────────────────────────────────
const boxes = await page.evaluate(() => window.__trollCctv.api().boxes());
function segHitsBox(a, b, B) {
  let t0 = 0, t1 = 1;
  for (let i = 0; i < 3; i++) {
    const d = b[i] - a[i], lo = B[i], hi = B[i + 3];
    if (Math.abs(d) < 1e-9) { if (a[i] < lo || a[i] > hi) return false; continue; }
    let u0 = (lo - a[i]) / d, u1 = (hi - a[i]) / d;
    if (u0 > u1) [u0, u1] = [u1, u0];
    t0 = Math.max(t0, u0); t1 = Math.min(t1, u1);
    if (t0 > t1) return false;
  }
  return true;
}
const inBox = (p, B, pad = 0.05) => p[0] > B[0] - pad && p[0] < B[3] + pad && p[2] > B[2] - pad && p[2] < B[5] + pad && p[1] > B[1] - pad && p[1] < B[4] + pad;
// the boxes that stand in the room (the wall's own bezels and bracket are the face)
const room = boxes.filter((B) => B[2] > 19.25 && B[1] >= 2.9 && B[4] < 6 && B[0] > -14 && B[3] < -6.3);
const eyes = [];
for (let x = -13.6; x <= -6.7; x += 0.35) for (let z = 19.9; z <= 23.5; z += 0.35) for (const h of [1.0, 1.6]) {
  const e = [x, 3 + h, z];
  if (room.some((B) => inBox([x, 3.2, z], B, 0.15))) continue;   // nobody stands in the desk or the chair
  if (x > -8.45 && z < 22.45) continue;                          // ... or in the sofa
  eyes.push(e);
}
eyes.push([-9.75, 3.48 + 0.74, 20.8]);                            // sat in the chair
// each face with its frontal box (its rectangle pushed 3 m out along its
// normal, as tools/troll-ops-obstruction-test.mjs counts it): a piece only
// blocks a face from inside that box, not from across the room beside it
const FACES = [
  { name: "wall", pts: (u, v) => [-11.17 + 2.68 * u, 4.56 + 0.68 * v, 19.2], front: [-11.2, 4.5, 19.2, -8.4, 5.3, 22.2] },
  { name: "window", pts: (u, v) => [-13.6, 4.05 + 1.1 * v, 19.85 + 3.5 * u], front: [-13.6, 4.0, 19.8, -10.6, 5.2, 23.4] },
  { name: "north door", pts: (u, v) => [-12.7 + 1.4 * u, 3.15 + 2.1 * v, 19.12], front: [-12.8, 3.0, 19.12, -11.2, 5.4, 22.12] },
  { name: "stair door", pts: (u, v) => [-10.95 + 1.3 * u, 3.15 + 2.3 * v, 23.75], front: [-11.0, 3.0, 20.75, -9.6, 5.6, 23.75] },
];
const clip = (B, F) => { const o = [Math.max(B[0], F[0]), Math.max(B[1], F[1]), Math.max(B[2], F[2]), Math.min(B[3], F[3]), Math.min(B[4], F[4]), Math.min(B[5], F[5])]; return o[0] < o[3] && o[1] < o[4] && o[2] < o[5] ? o : null; };
let blocked = 0, rays = 0, sample = null;
for (const F of FACES) {
  const inFront = room.map((B) => clip(B, F.front)).filter(Boolean);
  for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) {
    const f = F.pts(i / 6, j / 6);
    for (const e of eyes) {
      rays++;
      for (const B of inFront) if (segHitsBox(e, f, B)) { blocked++; sample ??= { face: F.name, e, f, B }; break; }
    }
  }
}
check("rule 9: nothing in the room between any eye and the wall, the window or the doors", blocked === 0, `${blocked} of ${rays} rays, e.g. ${JSON.stringify(sample)}`);

// ── 4. Watching a camera ────────────────────────────────────────────────
await putAt(-11.0, 21.2, 3, 0.25, 0.1);
await pump(500);
const prompt = await page.evaluate(() => window.__trollOps.rp().prompt);
check("at the wall, looking at it: Watch the cameras", /watch the cameras/i.test(prompt || ""), prompt);
await page.keyboard.down("x");
await pump(700);
await page.keyboard.up("x");
await pump(300);
let s = await S();
check("hold X: watching camera 1 full screen", s.on && s.idx === 0, JSON.stringify(s));
const camAt = await page.evaluate(() => { const T = window.__trollOps, c = window.__trollCctv.api().cams[window.__trollCctv.P.idx].cam.position; return T.camera.position.distanceTo(c); });
check("...the view is that camera's", camAt < 0.05, camAt.toFixed(3));
for (const k of [3, 4, 5]) {
  await page.evaluate((k) => window.__trollCctv.flip(k - window.__trollCctv.P.idx), k);
  await pump(600);
  await shot(`0${k}-watch-${k + 1}`);
}
await page.evaluate(() => { window.__trollCctv.P.idx = 0; });
await page.keyboard.down("d");
await pump(200);
await page.keyboard.up("d");
await pump(200);
s = await S();
check("D flips to the next camera", s.idx === 1, JSON.stringify(s));
const pos = await page.evaluate(() => window.__trollOps.move.pos.toArray());
check("...and you don't walk anywhere meanwhile", Math.abs(pos[0] + 11.0) < 0.05 && Math.abs(pos[2] - 21.2) < 0.05, JSON.stringify(pos));
await page.keyboard.press("Space");
await pump(300);
s = await S();
check("Space stands you back up", !s.on && s.peek === -1, JSON.stringify(s));

// ── 5. Shoot a camera ───────────────────────────────────────────────────
const hit = await page.evaluate(() => {
  const A = window.__trollCctv.api(), p = A.cams[3].pos;
  const answered = window.__trollOps.builtMap().map.onShot({ x: p.x, y: p.y - 0.03, z: p.z });
  return { answered, dead: !!A.cams[3].dead };
});
check("a shot camera goes down (NO SIGNAL)", hit.dead, JSON.stringify(hit));
await putAt(-9.6, 22.6, 3, 0, 0.05);
await pump(600);
const uDead = await page.evaluate(() => window.__trollCctv.api().screens[3].material.uniforms.uDead.value);
check("...its monitor shows it", uDead === 1, String(uDead));
await shot("09-no-signal");
await page.evaluate(() => { window.__trollCctv.api().cams[3].dead = performance.now() / 1000 - 1; });
await pump(400);
s = await S();
check("...and it's fixed after its minute", !s.dead[3], JSON.stringify(s.dead));

// three cameras' models, close up (dome over the floor, the bar's, the square's bullet)
// (a free camera off screen: the models hang where no player stands)
for (const [name, k, off] of [["10-cam-floor", 3, [0.5, -0.3, 0.5]], ["11-cam-bar", 5, [-0.5, -0.25, 0.4]], ["12-cam-square", 0, [-0.55, -0.2, -0.45]], ["13-cam-line", 9, [0.5, -0.3, -0.5]], ["14-cam-vip", 7, [0.6, -0.3, 0.5]]]) {
  const url = await page.evaluate(async ({ k, off }) => {
    const THREE = await import("three");
    const T = window.__trollOps, A = window.__trollCctv.api(), p = A.cams[k].pos, r = T.renderer;
    const W = 960, H = 540, rt = new THREE.WebGLRenderTarget(W, H);
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    const cam = new THREE.PerspectiveCamera(40, W / H, 0.02, 60);
    cam.position.set(p.x + off[0], p.y + off[1], p.z + off[2]);
    cam.lookAt(p);
    const prev = r.getRenderTarget();
    r.setRenderTarget(rt); r.clear(); r.render(T.scene, cam);
    const px = new Uint8Array(W * H * 4);
    r.readRenderTargetPixels(rt, 0, 0, W, H, px);
    r.setRenderTarget(prev); rt.dispose();
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const g = cv.getContext("2d"), img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W * 4; x++) img.data[y * W * 4 + x] = Math.min(255, Math.pow(px[(H - 1 - y) * W * 4 + x] / 255, 1 / 2.2) * 255 * ((x & 3) === 3 ? 0 : 1.6) + ((x & 3) === 3 ? 255 : 0));
    g.putImageData(img, 0, 0);
    return cv.toDataURL("image/png");
  }, { k, off });
  fs.writeFileSync(path.join(SHOTS, `${name}.png`), Buffer.from(url.split(",")[1], "base64"));
}

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
