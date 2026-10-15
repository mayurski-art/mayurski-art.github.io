// Troll Forces One in the Chamber: the bots play by its rules (user,
// 2026-10-14: bots were firing over and over). On a PRIVATE code with bots
// (Supabase is blocked; never a public room), for a while of fighting:
// no bot ever holds more than one round, reloads, or draws a sidearm; a dry
// bot has its knife out.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-oitc-bots-test.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
await ctx.route(/supabase/, (r) => r.abort());

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROOM = "OB" + String(Math.floor(Math.random() * 900 + 100));
const errors = [];

const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
await page.evaluate(async (room) => {
  const T = window.__trollOps;
  T.setMode("oitc");
  T.els.noBots.checked = false;
  T.els.room.value = room;
  T.els.room.dispatchEvent(new Event("input"));
  T.loadout.versusMapId = "grinsite";
  await T.startGame();
}, ROOM);
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 240000 });
await page.evaluate(() => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); T.settings.invincible = true; });
const seen = { bots: 0, maxAmmo: 0, reloads: 0, sidearms: 0, dryNoKnife: 0 };
for (let i = 0; i < 60; i++) {
  const s = await page.evaluate(() => {
    const T = window.__trollOps;
    const out = { bots: 0, maxAmmo: 0, reloads: 0, sidearms: 0, dryNoKnife: 0 };
    for (const b of T.bots.bots) {
      if (!b.alive) continue;
      out.bots++;
      out.maxAmmo = Math.max(out.maxAmmo, b.ammo);
      if (b.reloadT > 0) out.reloads++;
      if (b.holdingSecondary) out.sidearms++;
      if (b.ammo <= 0 && !b.meleeOnly) out.dryNoKnife++;
    }
    return out;
  });
  seen.bots = Math.max(seen.bots, s.bots);
  seen.maxAmmo = Math.max(seen.maxAmmo, s.maxAmmo);
  seen.reloads += s.reloads; seen.sidearms += s.sidearms; seen.dryNoKnife += s.dryNoKnife;
  await sleep(250);
}
check(seen.bots > 0, "bots are in the match", JSON.stringify(seen));
check(seen.maxAmmo <= 1, "no bot ever holds more than one round", JSON.stringify(seen));
check(!seen.reloads && !seen.sidearms, "no reloads, no sidearms", JSON.stringify(seen));
check(!seen.dryNoKnife, "a dry bot has its knife out", JSON.stringify(seen));
check(!errors.length, "no page errors", errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
