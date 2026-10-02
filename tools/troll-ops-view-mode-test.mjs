// Troll Forces View mode (owner-only setting): the row shows only for
// troll_runner, Deploy opens the lobby's map with no enemies/bots/HUD/gun,
// the camera flies, and quitting puts the lobby's mode back.
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-view-mode-test.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: ["--use-angle=" + (process.env.ANGLE || "d3d11"), "--ignore-gpu-blocklist"] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.context().route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let fails = 0;
const check = (ok, what) => { console.log(`${ok ? "PASS" : "FAIL"}  ${what}`); if (!ok) fails++; };

await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
const as = (name) => page.evaluate((name) => {
  window.TrollrunnerAccounts = window.TrollrunnerAccounts || {};
  window.TrollrunnerAccounts.getCachedProfile = () => (name ? { username: name } : null);
  window.dispatchEvent(new Event("trollrunner:auth-changed"));
}, name);

await as(null);
check(await page.evaluate(() => document.getElementById("to-set-viewmode-row").hidden), "guest: no View mode row");
await as("someone_else");
check(await page.evaluate(() => document.getElementById("to-set-viewmode-row").hidden), "another account: no View mode row");
// the setting on, but not the owner: Deploy plays the normal mode
await page.evaluate(() => { const T = window.__trollOps; T.settings.viewMode = true; });
await as("troll_runner");
check(await page.evaluate(() => !document.getElementById("to-set-viewmode-row").hidden), "troll_runner: View mode row shows");

const r = await page.evaluate(async () => {
  const T = window.__trollOps;
  T.setMode("ops"); T.loadout.mapId = "trollface";
  await T.startGame();
  await new Promise((r) => setTimeout(r, 3000));
  const p0 = T.move.pos.clone();
  T.look.yaw = 0; T.look.pitch = 0;
  T.keys.add("KeyW"); T.keys.add("Space");
  await new Promise((r) => setTimeout(r, 1000));
  T.keys.delete("KeyW"); T.keys.delete("Space");
  const p1 = T.move.pos.clone();
  return {
    mode: T.modeId(), spawner: !!T.spawner(), bots: T.bots.bots.length, hud: T.els.hud.hidden,
    staging: T.isStaging(), dz: p1.z - p0.z, dy: p1.y - p0.y, state: T.state?.() ?? null,
  };
});
check(r.mode === "view", `Deploy with View mode on opens view mode (${r.mode})`);
check(!r.spawner && r.bots === 0, `nobody to fight (spawner ${r.spawner}, bots ${r.bots})`);
check(r.hud === true, "HUD hidden");
check(!r.staging, "no countdown");
check(r.dz < -4 && r.dy > 4, `W + Space flies forward and up (dz ${r.dz.toFixed(1)}, dy ${r.dy.toFixed(1)})`);
const back = await page.evaluate(() => { const T = window.__trollOps; T.els.quitBtn.click(); return T.modeId(); });
check(back === "ops", `quitting puts the lobby's mode back (${back})`);
// owner with the setting off: a normal match
const normal = await page.evaluate(async () => {
  const T = window.__trollOps; T.settings.viewMode = false;
  await T.startGame(); const m = T.modeId(); T.els.quitBtn.click(); return m;
});
check(normal === "ops", `setting off: Deploy plays the picked mode (${normal})`);
check(errors.length === 0, `no page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
await browser.close(); server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
