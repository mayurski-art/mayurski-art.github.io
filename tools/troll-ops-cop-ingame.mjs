// Cops and Robbers, phase 0: the officer body (cop-bodies.js) on real bots in
// a real match on Trolling Loud. Every bot wears it (bot.body = "patrol"),
// then: they're posed by the game (remote-players.js syncBody), no page
// errors, their hitboxes sit on the real limbs, a few close-up shots of bots
// in action, and the frame time against the same match with stick figures.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-cop-ingame.mjs
// Writes .claude/cop-shots/ingame-*.png.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, ".claude", "cop-shots");
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

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
};

const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.setMode("tdm");
  T.loadout.mapId = "trollingloud";
  await T.startGame();
  if (T.isStaging()) T.endStaging();
});
await page.waitForFunction(() => window.__trollOps.bots.bots.length > 0, null, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 3000));

// frame time over `ms`, from requestAnimationFrame
const frameTime = () => page.evaluate(() => new Promise((done) => {
  const ts = [];
  const tick = (t) => { ts.push(t); if (ts.length < 150) requestAnimationFrame(tick); else done((ts[ts.length - 1] - ts[0]) / (ts.length - 1)); };
  requestAnimationFrame(tick);
}));
const stick = await frameTime();

const n = await page.evaluate(async () => {
  const T = window.__trollOps;
  for (const b of T.bots.bots) { b.hero = null; b.body = "patrol"; }
  const { preloadCopBodies } = await import("/assets/games/troll-ops/cop-bodies.js?v=cb1");
  await preloadCopBodies(["patrol"]);
  return T.bots.bots.length;
});
await page.waitForFunction(() => {
  const T = window.__trollOps;
  return [...T.remotes.byId.values()].filter((rp) => rp.rig.cop).length >= T.bots.bots.length;
}, null, { timeout: 30000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 2000));
const state = await page.evaluate(() => {
  const T = window.__trollOps;
  const rps = [...T.remotes.byId.values()];
  const withBody = rps.filter((rp) => rp.rig.cop);
  // the head hitbox: on the officer's head, not the old face board
  let headOk = 0;
  for (const rp of withBody) {
    const h = rp.rig.hitboxMeshes[0].getWorldPosition(new rp.rig.root.position.constructor());
    const b = rp.rig.cop.bones.head.getWorldPosition(new rp.rig.root.position.constructor());
    if (h.distanceTo(b) < 0.2) headOk++;
  }
  return { bodies: withBody.length, remotes: rps.length, headOk, stickVisible: withBody.filter((rp) => rp.rig.parts.body.visible).length };
});
check(`every bot wears the body (${state.bodies}/${n})`, state.bodies >= n);
check("stick figure hidden on all of them", state.stickVisible === 0);
check("head hitbox on the real head", state.headOk === state.bodies, `${state.headOk}/${state.bodies}`);
const cops = await frameTime();
check(`frame time with ${state.bodies} officers within 25% of stick figures`, cops < stick * 1.25 + 1, `${stick.toFixed(1)} ms -> ${cops.toFixed(1)} ms`);

// Close-ups. The bots' brains are paused and four are stood on the lit
// dance floor, published every frame like the host does: one aiming, one
// at the low ready, one crouched, one walking a line; the camera on open
// floor in front of them.
await page.evaluate(() => {
  const T = window.__trollOps;
  T.bots.update = () => {};
  const bs = T.bots.bots.filter((b) => b.alive).slice(0, 4);
  const spots = [[-1.6, -7, 0.3, 1, "stand"], [0, -8, -0.2, 0, "stand"], [1.6, -7, -0.5, 0, "crouch"], [3.2, -8.5, 0, 0, "stand"]];
  let t = 0;
  setInterval(() => {
    t += 1 / 30;
    bs.forEach((b, i) => {
      const [x, z, yaw, ads, st] = spots[i];
      b.pos.set(i === 3 ? x + Math.sin(t * 0.7) * 1.5 : x, 0, z);
      b.yaw = i === 3 ? (Math.cos(t * 0.7) > 0 ? -Math.PI / 2 : Math.PI / 2) : yaw;
      b.pitch = 0; b.ads = ads; b.stance = st; b.moving = i === 3; b.alive = true; b.hp = 100;
      T.net.publishBot(b);
    });
  }, 33);
});
await new Promise((r) => setTimeout(r, 2500));
const VIEWS = [[0.5, 1.5, -3.6, 0.3, 1.1, -7.4], [-3.6, 1.4, -4.6, -0.6, 1.0, -7.6], [3.8, 1.2, -4.8, 1.8, 0.8, -7.4], [0, 1.6, -5.2, 0, 1.2, -8.2]];
for (let i = 0; i < VIEWS.length; i++) {
  await new Promise((r) => setTimeout(r, 700));
  const url = await page.evaluate((v) => new Promise((done) => requestAnimationFrame(() => {
    const T = window.__trollOps, cam = T.camera;
    cam.position.set(v[0], v[1], v[2]);
    cam.lookAt(v[3], v[4], v[5]);
    cam.updateMatrixWorld(true);
    T.composer.render(0.016);
    done(T.renderer.domElement.toDataURL("image/png"));
  })), VIEWS[i]);
  fs.writeFileSync(path.join(OUT, `ingame-${i}.png`), Buffer.from(url.split(",")[1], "base64"));
}
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
