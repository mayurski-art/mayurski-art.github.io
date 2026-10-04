// Trolling Loud: can you see a player? For each spot, a player body (the
// same near-black operator material remote players wear) stands there and
// the view is rendered twice, with and without it. The pixels that change
// are the body; the same pixels in the empty render are what is behind it.
// The default player is a black stick figure with a white trollface head, so
// the head (pixels it brightened) and the limbs (pixels it darkened) are
// scored apart, each as brighter / darker mean luma. Target: either >= 1.6.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-trollingloud-luma.mjs
// TIER=low turns SSAO and bloom off. Writes <spot>[-tier].png (with the body)
// to .claude/club-shots/luma/.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, ".claude", "club-shots", "luma");
fs.mkdirSync(OUT, { recursive: true });
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

// [name, body x, feet y, z, camera x, z]: the camera stands at eye height on
// the body's floor and looks at its chest
const SPOTS = [
  ["dance floor (DJ line)", 0, 0, -8, 0, -2],
  ["dance floor", 3, 0, -8, 3, -2],
  ["hall booths", -11, 0.3, 6, -11, -0.5],
  ["bar (site B)", 16, 0.3, 8.3, 16, 2.3],
  ["VIP (site A)", -19.6, 0.3, 8.25, -19.6, 2.3],
  ["green room", -20, 0.3, -18, -20, -11],
  ["lobby", 0, 0.3, 17, 0, 21.5],
  ["mezzanine", -11.7, 4.5, 4.5, -11.7, -1.5],
  ["terrace", 4, 4.5, 19, -2, 19],
  ["roof", 10, 9, -2, 16, -2],
  ["alley", 0, 0, 27.5, -6, 27.5],
  ["alley spawn (scaffold)", 6, 0, 31.4, 0, 31.4],
  ["yard", 0, 0, -30, -6, -30],
];
const TIER = process.env.TIER || null;

const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log(`page error: ${e.message}`));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
await page.evaluate(async (tier) => {
  const T = window.__trollOps;
  if (tier) T.settings.gfx = tier;
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  T.loadout.mapId = "trollingloud";
  await T.startGame();
  if (T.isStaging()) T.endStaging();
}, TIER);
await new Promise((r) => setTimeout(r, 5000));
await page.evaluate(async (tier) => {
  const T = window.__trollOps;
  if (tier) for (const p of T.composer.passes) {
    const n = p.constructor.name;
    if (/SSAO|SAO|GTAO/i.test(n)) p.enabled = tier === "high";
    if (/Bloom/i.test(n)) p.enabled = tier !== "low";
  }
  const THREE = await import("three");   // the page's import map
  const { buildHumanoid } = await import("/assets/games/troll-ops/character.js?v=to-hb4-em1-fc1-wst");
  const mat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.7, metalness: 0.1 });
  const rig = buildHumanoid(mat, { height: 1.8, gun: false });
  window.__lumaBody = rig.root || rig.group || rig;
  T.scene.add(window.__lumaBody);
}, TIER);

let fails = 0;
for (const [name, bx, by, bz, cx, cz] of SPOTS) {
  const r = await page.evaluate(async ({ bx, by, bz, cx, cz }) => {
    const T = window.__trollOps, R = T.renderer, C = T.composer, cam = T.camera, body = window.__lumaBody;
    const W = 1280, H = 720;
    const grab = () => {
      const c = document.createElement("canvas");
      c.width = W; c.height = H;
      const g = c.getContext("2d");
      g.drawImage(R.domElement, 0, 0, W, H);
      return { data: g.getImageData(0, 0, W, H).data, url: c.toDataURL("image/png") };
    };
    const shot = (show) => {
      body.visible = show;
      C.render(0.016);
      C.render(0.016);
      return grab();
    };
    // both in one frame, so the beat-driven lights and lasers match
    const [a, b, box, ma, mb, headY] = await new Promise((done) => requestAnimationFrame(() => {
      cam.fov = 70; cam.aspect = W / H; cam.near = 0.1; cam.far = 2000;
      cam.position.set(cx, by + 1.7, cz);
      cam.lookAt(bx, by + 1.2, bz);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld(true);
      body.position.set(bx, by, bz);
      body.rotation.y = Math.atan2(cx - bx, cz - bz);
      body.updateMatrixWorld(true);
      for (const p of C.passes) for (const k of ["uHitFlash", "uLowHp", "uAberration", "uSuppress"]) if (p.uniforms?.[k]) p.uniforms[k].value = 0;
      // the body's box on screen: only pixels in there count
      const bb = new cam.position.constructor();
      let x0 = W, x1 = 0, y0 = H, y1 = 0;
      for (const dx of [-0.45, 0.45]) for (const dy of [0, 1.85]) for (const dz of [-0.45, 0.45]) {
        bb.set(bx + dx, by + dy, bz + dz).project(cam);
        const px = (bb.x + 1) / 2 * W, py = (1 - bb.y) / 2 * H;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
      // where the head is on screen (the top 0.35 m)
      bb.set(bx, by + 1.5, bz).project(cam);
      const headY = (1 - bb.y) / 2 * H;
      const A = shot(true), Bk = shot(false);
      // the body's own pixels: the same pair with bloom and SSAO off, so a
      // glow or a contact shadow round it isn't counted as the body
      const was = C.passes.map((p) => p.enabled);
      for (const p of C.passes) if (/SSAO|SAO|GTAO|Bloom/i.test(p.constructor.name)) p.enabled = false;
      const MA = shot(true), MB = shot(false);
      C.passes.forEach((p, i) => { p.enabled = was[i]; });
      done([A, Bk, [Math.max(0, x0 | 0), Math.min(W, Math.ceil(x1)), Math.max(0, y0 | 0), Math.min(H, Math.ceil(y1))], MA, MB, headY]);
    }));
    const M = { a: ma.data, b: mb.data, headY };
    const L = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    // the default player is a black stick figure with a white trollface
    // head: the head and the limbs are scored apart
    const S = { head: [0, 0, 0], limbs: [0, 0, 0] };
    let n = 0;
    for (let y = box[2]; y < box[3]; y++) for (let x = box[0]; x < box[1]; x++) {
      const i = (y * W + x) * 4;
      const d = Math.abs(M.a[i] - M.b[i]) + Math.abs(M.a[i + 1] - M.b[i + 1]) + Math.abs(M.a[i + 2] - M.b[i + 2]);
      if (d < 24) continue;
      n++;
      const k = y < M.headY ? "head" : "limbs";
      S[k][0]++; S[k][1] += L(a.data, i); S[k][2] += L(b.data, i);
    }
    const c = ([m, body, behind]) => m ? Math.max(body, behind) / Math.max(1, Math.min(body, behind)) : 0;
    return { n, head: c(S.head), limbs: c(S.limbs), headPx: S.head[0], limbPx: S.limbs[0], url: a.url };
  }, { bx, by, bz, cx, cz });
  // readable if the head pops OR the limbs silhouette; both reported
  const ok = r.n > 150 && (r.head >= 1.6 || r.limbs >= 1.6);
  if (!ok) fails++;
  const file = `${name.replace(/[^a-z]+/gi, "-").replace(/-+$/, "")}${TIER ? "-" + TIER : ""}.png`;
  fs.writeFileSync(path.join(OUT, file), Buffer.from(r.url.split(",")[1], "base64"));
  console.log(`${ok ? "PASS" : "FAIL"} ${name.padEnd(24)} head ${r.head.toFixed(2)} (${r.headPx} px)  limbs ${r.limbs.toFixed(2)} (${r.limbPx} px)  ${file}`);
}
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
