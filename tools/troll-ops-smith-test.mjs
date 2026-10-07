// Troll Forces Socialize: Iron Ike works the anvil and the forge (smithy.js).
//
// One tab on Troll City (Socialize, Supabase blocked so no live room):
//   1. Ike is a smith with a hammer, tongs and a billet in the scene.
//   2. Within ~30 s he strikes, walks to the forge, heats the billet (it
//      glows hotter), walks back and strikes again; blows throw sparks.
//   3. The forge light flickers while you're near.
//   4. Every third round he quenches the piece in the barrel (steam).
//   5. The spark pool empties when you walk away.
// Shots: scratch PNGs in tools/.smith-shots (not committed).
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-smith-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, "tools", ".smith-shots");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".svg": "image/svg+xml", ".gif": "image/gif" };
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
async function pump(page, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) await page.screenshot({ type: "jpeg", quality: 10 }).catch(() => {});
}

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
await ctx.route(/supabase/, (r) => r.abort());
const errors = [];
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  const fake = { getCachedProfile: () => ({ username: "troll_runner", tags: [] }) };
  Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => fake, set: () => {} });
});
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 420000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 420000 });
await page.evaluate(() => window.__trollOps.setLoadWaitMax(8));
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.setMode("social");
  T.loadout.mapId = "trollcity";
  await T.startGame();
});
await page.waitForFunction(() => !window.__trollOps.loadState().open, null, { timeout: 420000 });
await page.evaluate(() => { window.__trollOps.els.pause.hidden = true; });

// Stand in the smithy's open front, looking at the anvil and the forge.
const lookAt = (x, z, tx, tz, pitch = -0.25) => page.evaluate(({ x, z, tx, tz, pitch }) => {
  const T = window.__trollOps;
  T.move.reset(x, z, 0);
  T.look.yaw = Math.atan2(-(tx - x), -(tz - z));
  T.look.pitch = pitch;
}, { x, z, tx, tz, pitch });
await lookAt(-44.2, 14.6, -46.2, 18.6);
await pump(page, 1500);

const smith = () => page.evaluate(() => {
  const n = window.__trollOps.townNpcs()?.list.find((n) => n.c.role === "Blacksmith");
  const s = n?.smith;
  if (!s) return null;
  return { state: s.state, stateT: s.stateT, heat: s.heat, gap: s.gap ?? null, live: s.live, log: s.log.slice(), x: n.x, z: n.z,
    tools: s.tools.every((o) => o.parent && o.visible), light: s.smithy?.light?.intensity ?? null };
});

let s = await smith();
check("Iron Ike is a smith", !!s, s?.state);
check("his hammer, tongs and billet are out", !!s?.tools);

// Watch him work: every 250 ms for up to 40 s.
const seen = new Set([s.state]);
let maxSparks = 0, heatInForge = 0, heatAtStrikeEnd = 1, lights = new Set();
const t0 = Date.now();
let shotAnvil = false, shotForge = false;
fs.mkdirSync(SHOTS, { recursive: true });
while (Date.now() - t0 < 40000) {
  await pump(page, 250);
  s = await smith();
  seen.add(s.state);
  maxSparks = Math.max(maxSparks, s.live);
  if (s.light != null) lights.add(s.light.toFixed(2));
  if (s.state === "heat") heatInForge = Math.max(heatInForge, s.heat);
  if (s.state === "strike") heatAtStrikeEnd = s.heat;
  // close side views: a few frames through a blow, then the forge
  if (!shotAnvil && s.state === "strike") {
    shotAnvil = true;
    await lookAt(-43.3, 17.5, -45.4, 17.7, -0.15);
    for (let i = 0; i < 6; i++) { await page.screenshot({ path: path.join(SHOTS, `anvil${i}.png`) }); await pump(page, 180); }
  }
  if (!shotForge && s.state === "heat" && s.heat > 0.8) {
    shotForge = true;
    await lookAt(-45.4, 17.0, -47.5, 19.3, -0.2);
    await pump(page, 200);
    await page.screenshot({ path: path.join(SHOTS, "forge.png") });
  }
  if (["strike", "toForge", "heat", "toAnvil"].every((k) => seen.has(k)) && s.log.lastIndexOf("strike") > s.log.indexOf("heat") && s.log.includes("heat")) break;
}
// a few blows into the next round (3 s of his time), the piece has cooled
for (let i = 0; i < 60; i++) {
  await pump(page, 250);
  s = await smith();
  if (s.state === "strike" && s.stateT >= 3) { heatAtStrikeEnd = s.heat; break; }
}
check("he strikes, walks to the forge, heats, walks back and strikes", ["strike", "toForge", "heat", "toAnvil"].every((k) => seen.has(k)), [...seen].join(","));
check("the hammer comes down on the work", s.gap != null && s.gap < 0.15, s.gap?.toFixed(3));
check("blows throw sparks", maxSparks >= 6, `${maxSparks}`);
check("the billet glows hot in the forge", heatInForge > 0.8, heatInForge.toFixed(2));
check("and cools on the anvil", heatAtStrikeEnd < 0.9, heatAtStrikeEnd.toFixed(2));
check("the forge light flickers", lights.size >= 4, `${lights.size} levels`);

// The third round: force the next one to be the quench.
await page.evaluate(() => {
  const s = window.__trollOps.townNpcs().list.find((n) => n.c.role === "Blacksmith").smith;
  s.round = 2; s.n.x = s.stand.anvil[0]; s.n.z = s.stand.anvil[1];
  s.go("strike"); s.stateT = 5.5; s.blow = 4; s.heat = 0.5;
});
let quenched = false, steam = 0, cold = 1;
const t1 = Date.now();
while (Date.now() - t1 < 15000) {
  await pump(page, 250);
  s = await smith();
  if (s.state === "quench") { quenched = true; steam = Math.max(steam, s.live); cold = Math.min(cold, s.heat); }
  if (quenched && s.state === "toForge") break;
}
check("every third round it's quenched in the barrel", quenched && s.state === "toForge", s.state);
check("in a cloud of steam, and it comes out cold", steam >= 15 && cold < 0.05, `${steam} pts, heat ${cold.toFixed(2)}`);

// Walk away: the sparks are gone.
await lookAt(40, -20, 50, -20, 0);
await pump(page, 1200);
s = await smith();
check("far off, the spark pool is empty", s.live === 0, `${s.live}`);

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(failures ? `${failures} FAILED` : "all passed");
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
