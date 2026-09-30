// Bots move like players (user, 2026-09-30): they hop, slide and scope in,
// and throw every kind of throwable, not only frags. Plays a TDM match with
// veteran bots for a minute and watches. SHOT_DIR (optional) gets a close-up
// of one bot at the hip and scoped in (ads-hip.png / ads-in.png).
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-bot-moves-test.mjs

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

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOT = process.env.SHOT_DIR;

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.settings.botSkill = "veteran";
  T.bots.difficulty = "veteran";
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = false;
  T.loadout.mapId = "grinsite";
  await T.startGame();
  if (T.isStaging()) T.endStaging();
  // Out of the fight: the bots only have each other to fight.
  T.player.maxHp = T.player.hp = 1e9;
  T.move.pos.set(0, 60, 0);
  // Count every throwable a bot lets go, by kind.
  window.__botThrows = {};
  const orig = T.grenades.throwGrenade.bind(T.grenades);
  T.grenades.throwGrenade = (def, ...a) => { const g = orig(def, ...a); if (String(a[2]).startsWith("bot-")) window.__botThrows[def.id] = (window.__botThrows[def.id] || 0) + 1; return g; };
  window.__seen = { hop: 0, slide: 0, ads: 0, lethals: new Set(), tacticals: new Set() };
});
const t0 = Date.now();
while (Date.now() - t0 < 60000) {
  await page.evaluate(() => {
    const T = window.__trollOps, s = window.__seen;
    for (const b of T.bots.bots) {
      if (!b.alive) continue;
      if (b.hopY > 0.3) s.hop++;
      if (b.stance === "slide") s.slide++;
      if (b.ads > 0.9) s.ads++;
      s.lethals.add(b.lethalKind); s.tacticals.add(b.tacticalKind);
    }
    T.player.hp = 1e9;
  });
  await sleep(250);
}
const r = await page.evaluate(() => {
  const s = window.__seen;
  const slideWire = [...window.__trollOps.net.peers.values()].some((p) => p.isBot && p.snaps.some((sn) => sn.stance === "slide"));
  return { hop: s.hop, slide: s.slide, ads: s.ads, lethals: [...s.lethals], tacticals: [...s.tacticals], throws: window.__botThrows, slideWire };
});
check("bots hop in fights (and over what pins them)", r.hop > 0, `${r.hop} samples`);
check("bots slide", r.slide > 0, `${r.slide} samples`);
check("a slide shows on the bot's body (stance on the wire)", r.slideWire);
check("bots scope in", r.ads > 0, `${r.ads} samples`);
check("bots carry every kind of throwable", r.lethals.length === 2 && r.tacticals.length === 3, JSON.stringify({ l: r.lethals, t: r.tacticals }));
const kinds = Object.keys(r.throws);
check("bots throw more than frags", kinds.length >= 2 && kinds.some((k) => k !== "frag"), JSON.stringify(r.throws));

if (SHOT) {
  // One bot, frozen, from close: hip, then fully scoped.
  for (const [name, ads] of [["ads-hip", 0], ["ads-in", 1]]) {
    const data = await page.evaluate(async (ads) => {
      const T = window.__trollOps;
      const b = T.bots.bots.find((x) => x.alive);
      const rp = T.remotes.byId.get(b.id);
      b.update = () => {};   // frozen: the AI would scope it back out
      if (!window.__shotSpot) { const sp = T.spawnForTeam(b.team, b.id); window.__shotSpot = { x: sp.x, y: sp.y || 0, z: sp.z }; }
      const sp = window.__shotSpot;
      // Facing the open middle of the map; the camera stands in front of it.
      const cx = -sp.x, cz = -sp.z, cl = Math.hypot(cx, cz) || 1;
      const fx = cx / cl, fz = cz / cl;
      b.pos.set(sp.x, sp.y, sp.z); b.groundY = sp.y; b.hopY = 0; b.yaw = Math.atan2(-fx, -fz);
      b.ads = ads; b.moving = false; b.stance = "stand";
      for (let i = 0; i < 20; i++) { T.net.publishBot(b); await new Promise((r) => requestAnimationFrame(r)); }
      const cam = T.camera.clone();
      cam.position.set(b.pos.x + fx * 2.6 - fz * 1.3, b.pos.y + 1.6, b.pos.z + fz * 2.6 + fx * 1.3);
      cam.lookAt(b.pos.x, b.pos.y + 1.2, b.pos.z);
      cam.fov = 50; cam.aspect = 16 / 9; cam.updateProjectionMatrix();
      return await new Promise((done) => requestAnimationFrame(() => { T.renderer.render(T.scene, cam); done(T.renderer.domElement.toDataURL("image/jpeg", 0.85)); }));
    }, ads);
    fs.writeFileSync(path.join(SHOT, `${name}.jpg`), Buffer.from(data.split(",")[1], "base64"));
  }
}

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
