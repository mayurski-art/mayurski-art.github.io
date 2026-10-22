// Troll Forces: a TROLLS body in action, screenshots (user, 2026-10-20: "see
// the built character in action like shooting in third POV and first POV,
// as well as reloading"). A solo range (no room code: never a public room),
// Supabase blocked, the body worn as troll_runner. Third person at the hip,
// aimed, firing and mid-reload, then the same in first person.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-nft-action-shots.mjs
//   BODY=trolls-1718 (default)  GUN=problem416  SHOTS_DIR=<dir>
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";

const require = createRequire(path.join(process.env.NODE_PATH || path.join(process.cwd(), "node_modules"), "x.js"));
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const SHOTS = process.env.SHOTS_DIR || os.tmpdir();
const BODY = process.env.BODY || "trolls-1718", GUN = process.env.GUN || "problem416";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".png": "image/png", ".glb": "model/gltf-binary", ".json": "application/json", ".css": "text/css", ".webp": "image/webp", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav" };
const srv = http.createServer((q, r) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(q.url, "http://x").pathname));
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" }); r.end(d); });
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript((body) => {
  localStorage.setItem("trollops:cosmetics", JSON.stringify({ face: "grin:og::rolex-gold", body }));
  const profile = { username: "troll_runner" };
  Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => window.__acct, set: (v) => { window.__acct = v; if (v) v.getCachedProfile = () => profile; } });
}, BODY);
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
await page.evaluate(async () => {
  if (!window.TrollrunnerAccounts) window.TrollrunnerAccounts = {};
  const T = window.__trollOps;
  T.els.room.value = "";
  T.setMode("range");
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 180000 });
await page.waitForTimeout(1500);
await page.evaluate(async (GUN) => {
  const T = window.__trollOps;
  await T.localRig.blocky?.ready; await T.localRig.blocky?.loaded;
  const src = await (await fetch("/assets/games/troll-ops/view/player-update.js")).text();
  const W = await import("/assets/games/troll-ops/" + src.match(/\.\.\/(weapons\/weapons\.js\?v=[^"]+)/)[1]);
  const def = W.WEAPON_DEFS[GUN], w = new W.WeaponState(def);
  T.player.weapons[def.id] = w; T.player.weaponId = def.id;
  T.switchWeapon("primary"); T.setActiveWeaponMesh(def); T.setHolding("gun");
  window.__w = w;
  // third person: the free look (view/free-look.js) held, the camera swung round to the front three-quarter
  const FL = await import("/assets/games/troll-ops/view/" + src.match(/(free-look\.js\?v=[^"]+)/)[1]);
  window.__orbit = (on) => { FL.freeLook.held = on; if (on) { FL.freeLook.yaw = Math.PI * 0.72; FL.freeLook.pitch = 0.08; } };
  // the ?tohooks=1 debug readout out of the shots
  for (const e of document.querySelectorAll("div, pre")) if (e.children.length === 0 && /^weapon: /.test(e.textContent)) { let p = e; for (let i = 0; i < 3 && p.parentElement && p.parentElement !== document.body; i++) p = p.parentElement; p.style.visibility = "hidden"; break; }
}, GUN);
await page.waitForTimeout(800);
const shot = async (name) => {
  await page.screenshot({ path: path.join(SHOTS, `action-${name}.png`) });
  console.log(`  action-${name}.png`);
};
for (const view of ["3p", "1p"]) {
  await page.evaluate((third) => { const T = window.__trollOps; if (!!T.settings.thirdPerson !== third) T.toggleThirdPerson(); window.__orbit(third); }, view === "3p");
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__trollOps.setAds(false));
  await page.waitForTimeout(500);
  await shot(`${view}-hip`);
  await page.evaluate(() => window.__trollOps.setAds(true));
  await page.waitForTimeout(600);
  await shot(`${view}-ads`);
  // firing: a few rounds, the shot taken on the last one's flash and kick
  await page.evaluate(() => { const T = window.__trollOps; for (let i = 0; i < 3; i++) { window.__w.fireCooldown = 0; T.fireOnce(); } });
  await page.waitForTimeout(40);
  await shot(`${view}-fire`);
  await page.evaluate(() => window.__trollOps.setAds(false));
  await page.waitForTimeout(400);
  // a reload, caught part way through
  await page.evaluate(() => { const T = window.__trollOps; window.__w.ammo = 0; T.tryReload(); });
  await page.waitForTimeout(Math.round((await page.evaluate(() => window.__w.def.reloadTime)) * 1000 * 0.45));
  await shot(`${view}-reload`);
  await page.waitForTimeout(2500);
}
if (errors.length) console.log("page errors:", errors.slice(0, 3).join(" | "));
await browser.close();
srv.close();
