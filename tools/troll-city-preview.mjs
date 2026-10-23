// Troll City's preview (the loading screen and the map vote): a hero shot
// rendered from the game (user, 2026-10-22: "a much more improved version
// ... blend different parts of the map and include various NPCs and workers
// and that 1272 troll NFT character but a more polished version").
//
// Socialize on Troll City (its townsfolk at work), Supabase blocked and a
// private room code (never the public room), #1272 worn as troll_runner and
// stood where PLAYER says. Each plate in PLATES is rendered at 4K through
// the game's own post chain, the way troll-ops-map-previews.mjs does.
//
//   NODE_PATH=<main checkout>/node_modules node tools/troll-city-preview.mjs [scout | plate ...]
//   then tools/troll-city-preview-compose.mjs blends bar + hero + chapel into the preview.
//   scout: print the townsfolk (name, role, act, x, z) and write 1280 drafts of every plate.
//   OUT=<dir> for the plates (default .claude/map-shots-hq/trollcity-preview).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.OUT || path.join(ROOT, ".claude/map-shots-hq/trollcity-preview");
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

// cam [x, y, z, look x, y, z, fov]; player [x, z, facing yaw] or null (hidden);
// eye [x, z]: where the hidden player stands (rooms and townsfolk show by it);
// stage: the cast moved for the shot (see below). PLATES=<json> to try others.
const PLATES = JSON.parse(process.env.PLATES || "null") || {
  // the saloon bar: the backlit bottle shelves, barflies on their stools
  bar: { cam: [-12.6, 1.65, -10.6, -6.8, 1.2, -16.0, 58], player: null, eye: [-12.6, -10.6] },
  // St. Grinsworth's: Reverend Grin at the altar under the sunburst
  chapel: { cam: [96.5, 2.3, 65.0, 104.5, 2.9, 65.0, 50], player: null, eye: [96.5, 65.0], stage: { "Reverend Grin": [102.2, 65.0, 1.57] } },
  // Main Street at golden hour, #1272 low and close, the town hall behind
  hero: { cam: [33.4, 1.0, 0.7, 72, 4.6, 0.9, 44], player: [36.8, 0.55, 0.85], stage: {
    Clementine: [42, 4.8, 48, 4.8], Mudcake: [44, -5.8, 50, -6.2], Dot: [50, 1.2, 44, 0.8], Sully: [55, 6.2, 60, 6.2],
    Pockets: [43, -2.2, 48, -3.4], Jebediah: [58, -6.5, 64, -6.5], Hattie: [62, 2.2, 56, 3], Cletus: [48, 6.6, 43, 6.6],
    "Conductor Choo": [46, -7.0, 1.4, "guard"], "Doc Grin": [53, -7.2, 2.4, "guard"], "Hay Jay": [51, 7.0, -1.2, "guard"],
  } },
};
const args = process.argv.slice(2);
const SCOUT = args[0] === "scout";
const ids = SCOUT || !args.length ? Object.keys(PLATES) : args;
const W = SCOUT ? 1280 : 3840, H = SCOUT ? 720 : 2160;

const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log(`page: ${e.message}`));
page.on("console", (m) => { if (m.text().startsWith("[[")) console.log(m.text()); });
await page.addInitScript(() => {
  localStorage.setItem("trollops:cosmetics", JSON.stringify({ face: "grin:og", body: "trolls-1272" }));
  const profile = { username: "troll_runner" };
  Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => window.__acct, set: (v) => { window.__acct = v; if (v) v.getCachedProfile = () => profile; } });
});
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
await page.evaluate(async () => {
  if (!window.TrollrunnerAccounts) window.TrollrunnerAccounts = {};
  const T = window.__trollOps;
  T.els.room.value = "PRVW" + Math.floor(Math.random() * 1e6);   // private, and Supabase is blocked anyway
  T.setMode("social");
  T.loadout.mapId = "trollcity";
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 240000 });
await page.waitForTimeout(+(process.env.WAIT || 25000));   // the Studio town, textures, townsfolk
await page.evaluate(async () => {
  const T = window.__trollOps;
  if (!T.settings.thirdPerson) T.toggleThirdPerson();
  await T.localRig.blocky?.ready; await T.localRig.blocky?.loaded;
  // the ?tohooks=1 readout and every HUD layer out of the frame
  for (const e of document.body.children) if (e.tagName !== "CANVAS" && e !== T.renderer.domElement) e.style.visibility = "hidden";
});
// Golden hour: a low warm sun from the west behind the camera, the sky gone
// amber at the horizon, the fill cooler. The game's own sky and sun modules
// (the same instances: game.js's import tags) take it.
await page.evaluate(async (gold) => {
  if (!gold) return;
  const T = window.__trollOps;
  const src = await (await fetch("/assets/games/troll-ops/game.js")).text();
  const mod = (re) => import("/assets/games/troll-ops/" + src.match(re)[1]);
  const SS = await mod(/\.\/(view\/sun-shadow\.js\?v=[^"]+)/), SK = await mod(/\.\/(view\/sky\.js\?v=[^"]+)/);
  const base = (await mod(/\.\/(maps\/maps\.js\?v=[^"]+)/)).MAPS.trollcity;
  const map = { ...base, sun: { pos: gold.sun, color: gold.sunColor, intensity: gold.sunI }, sky: { ...base.sky, ...gold.sky } };
  SS.fitSunShadow(map);
  SK.applySky(map);
  T.scene.traverse((o) => {
    if (o.isHemisphereLight) { o.color.set(gold.hemi[0]); o.groundColor.set(gold.hemi[1]); o.intensity = gold.hemi[2]; }
    if (o.isAmbientLight) { o.color.set(gold.amb[0]); o.intensity = gold.amb[1]; }
  });
  if (T.scene.fog) { T.scene.fog.color.set(gold.fog[0]); if ("density" in T.scene.fog) T.scene.fog.density = gold.fog[1]; }
}, process.env.NOON ? null : {
  sun: [-70, 13, -6], sunColor: 0xffb468, sunI: 2.7,
  sky: { top: 0x3a5a9e, horizon: 0xffc88e, bottom: 0x8a6440, sun: 1.4, sunSize: 0.04, sunColor: 0xffb060, haze: 0.7, clouds: 0.4, cloudColor: 0xffcfa8, cloudShade: 0x8a6a80 },
  hemi: [0xc8bcd8, 0x8a5a3a, 0.75], amb: [0xffd8b4, 0.18], fog: [0xe9bf90, 0.0045],
});
if (SCOUT) {
  const npcs = await page.evaluate(() => window.__trollOps.townNpcs()?.list.map((n) => `${n.c.name} | ${n.c.role} | ${n.c.act} | ${n.x.toFixed(1)}, ${n.z.toFixed(1)}`) || []);
  console.log(npcs.join("\n"));
}

for (const id of ids) {
  const plate = PLATES[id];
  const data = await page.evaluate(async ({ v, pl, eye, stage, W, H, noInk, lightK, lightR }) => {
    const T = window.__trollOps, R = T.renderer, C = T.composer, cam = T.camera;
    for (const rt of [C.renderTarget1, C.renderTarget2]) if (rt.samples !== 4) { rt.samples = 4; rt.dispose(); }
    // stand #1272 there (or, hidden, just stand the eye there: the townsfolk
    // and the rooms show by where the player is): the move state carries
    // the feet, the look the facing
    const at = pl || eye;
    if (at) { T.move.pos?.set?.(at[0], at[3] ?? T.move.pos.y, at[1]); T.look.yaw = at[2] ?? 0; }
    // a warm key from camera left in a tight cone on him (a short reach, so
    // the street round him barely changes), and a cool rim from above behind
    const THREE = T.THREE;
    if (!window.__key) {
      window.__key = new THREE.SpotLight(0xffc690, 0, 9, 0.3, 0.6, 1.4);
      window.__rim = new THREE.SpotLight(0xa8c8ff, 0, 7, 0.22, 0.5, 1.4);
      for (const l of [window.__key, window.__rim]) T.scene.add(l, l.target);
    }
    window.__key.intensity = pl ? +(lightK ?? 26) : 0;
    window.__rim.intensity = pl ? +(lightR ?? 0) : 0;
    if (pl) {
      window.__key.position.set(v[0] + 1.2, 2.6, v[2] - 2.2); window.__key.target.position.set(pl[0], 1.2, pl[1]);
      window.__rim.position.set(pl[0] + 2, 4.5, pl[1] + 1.5); window.__rim.target.position.set(pl[0], 1.6, pl[1]);
    }
    for (const p of T.composer.passes) if (p.constructor.name === "CharInkPass") p.enabled = !noInk;
    // the cast: {name: [x, z, yaw]} stands one there at its own loop;
    // {name: [x, z, x2, z2]} walks a walker from x,z towards x2,z2
    const tn = T.townNpcs();
    for (const [name, s] of Object.entries(stage || {})) {
      const n = tn.list.find((m) => m.c.name === name);
      if (!n) { console.log("no townsfolk " + name); continue; }
      n.zone = tn.view ? tn.view.zoneOf(s[0], n.c.y ?? 0, s[1]) : null; n.off = false; n.home = null;
      if (typeof s[3] === "number") {
        n.c = { ...n.c, act: "walk", pace: true, path: [[s[0], s[1]], [s[2], s[3]]] };
        n.lens = [Math.hypot(s[2] - s[0], s[3] - s[1])]; n.seg = 0; n.segT = 0.3; n.dir = 1; n.wait = 0;
      } else {
        n.c = { ...n.c, path: null, act: s[3] || n.c.act };
        n.x = s[0]; n.z = s[1]; n.yaw = s[2];
      }
    }
    for (let i = 0; i < 20; i++) await new Promise((r) => requestAnimationFrame(r));
    if (stage) console.log(JSON.stringify(Object.keys(stage).map((name) => { const n = tn.list.find((m) => m.c.name === name); return n && [name, +n.x.toFixed(1), +n.z.toFixed(1), n.rig.root.visible, n.zone]; })));
    return await new Promise((done) => requestAnimationFrame(() => {
      cam.fov = v[6]; cam.aspect = W / H; cam.near = 0.1; cam.far = 2000;
      cam.position.set(v[0], v[1], v[2]);
      cam.lookAt(v[3], v[4], v[5]);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld(true);
      R.setPixelRatio(1); R.setSize(W, H, false);
      C.setPixelRatio?.(1); C.setSize(W, H);
      for (const p of C.passes) for (const k of ["uHitFlash", "uLowHp", "uAberration", "uSuppress"]) if (p.uniforms?.[k]) p.uniforms[k].value = 0;
      for (const p of C.passes) if (p.constructor.name === "ViewmodelPass") p.enabled = false;
      // after the game's own frame: its body shown only when it's in the
      // shot, and no name tags (a picture, not the game's HUD)
      T.localRig.root.visible = !!pl;
      for (const n of T.townNpcs().list) if (n.tag) n.tag.visible = false;
      C.render(0.016);
      done(R.domElement.toDataURL("image/png"));
    }));
  }, { v: plate.cam, pl: plate.player, eye: plate.eye, stage: plate.stage, W, H, noInk: !!process.env.NOINK, lightK: process.env.KEY, lightR: process.env.RIM });
  const file = path.join(OUT, `${id}${SCOUT ? "-draft" : ""}.png`);
  fs.writeFileSync(file, Buffer.from(data.split(",")[1], "base64"));
  console.log(`${id}: ${file}`);
}
await browser.close();
server.close();
