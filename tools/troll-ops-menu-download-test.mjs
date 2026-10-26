// Troll Forces: the menu's background downloads (maps/map-preload.js). Sits on
// the menu and checks: every gear and map file in prefetch-manifest.json is
// fetched, all the gear before any map's; the menu's frames are no worse
// while it downloads; and a match started afterwards loads faster than one on
// a cold cache. The asset service worker is on (?sw=1), as on the live site;
// MBPS caps the network (default 20, a phone's), Supabase is blocked (never a
// live room).
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-menu-download-test.mjs [mapId] [--iphone]
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const args = process.argv.slice(2);
const MAP = args.find((a) => !a.startsWith("--")) || "kabukigrin";
const IPHONE = args.includes("--iphone");
const MBPS = +(process.env.MBPS || 20);
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/prefetch-manifest.json"), "utf8"));
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const device = IPHONE
  ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" }
  : { viewport: { width: 1280, height: 720 } };
let fails = 0;
const check = (ok, what) => { console.log(`${ok ? "PASS" : "FAIL"} ${what}`); if (!ok) fails++; };

async function open({ noDownloads = false } = {}) {
  const ctx = await browser.newContext(device);
  await ctx.route(/supabase/, (r) => r.abort());   // never a live room (CLAUDE.md troll-ops rule 2)
  if (noDownloads) await ctx.route(/prefetch-manifest.json/, (r) => r.abort());   // (the control: no menu downloads)
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 40, downloadThroughput: MBPS * 125000, uploadThroughput: 1250000 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const asked = [];   // site-relative URLs in the order the page asked for them
  ctx.on("request", (r) => { const u = new URL(r.url()); if (u.origin === BASE) asked.push(u.pathname.slice(1) + u.search); });
  await page.goto(`${BASE}/troll-ops.html?tohooks=1&sw=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
  return { ctx, page, errors, asked };
}
// frame times on the menu over `ms`: the 95th percentile, in ms
const frames = (page, ms) => page.evaluate((ms) => new Promise((res) => {
  const d = []; let last = performance.now(); const t0 = last;
  const f = (t) => { d.push(t - last); last = t; if (t - t0 < ms) requestAnimationFrame(f); else { d.sort((a, b) => a - b); res(+d[Math.floor(d.length * 0.95)].toFixed(1)); } };
  requestAnimationFrame(f);
}), ms);
// a match on MAP from the menu: seconds until the loading screen comes down
const matchLoad = (page) => page.evaluate(async (map) => {
  const T = window.__trollOps;
  T.setMode("ops"); T.loadout.mapId = map;
  const t0 = performance.now();
  T.startGame();
  await new Promise((r) => setTimeout(r, 300));
  while (T.loadState().open && performance.now() - t0 < 300000) await new Promise((r) => setTimeout(r, 100));
  return +((performance.now() - t0) / 1000).toFixed(1);
}, MAP);

// 0. the control: the menu with no downloads, its frames over the same window
const C = await open({ noDownloads: true });
await new Promise((r) => setTimeout(r, 8000));
const control = [await frames(C.page, 3000), await frames(C.page, 3000), await frames(C.page, 3000)];
await C.ctx.close();
// 1. the menu downloads everything, gear first, without slowing the menu
const A = await open();
const quiet = await frames(A.page, 3000);   // (before the downloads start: they wait ~4 s after load)
const t0 = Date.now();
const busy = [];
while (!(await A.page.evaluate(() => window.__trollPreload.downloaded)) && Date.now() - t0 < 600000) {
  if (busy.length < 3 && Date.now() - t0 > 8000) busy.push(await frames(A.page, 3000));   // mid-download
  await new Promise((r) => setTimeout(r, 1000));
}
const took = ((Date.now() - t0) / 1000).toFixed(0);
const done = await A.page.evaluate(() => window.__trollPreload.downloaded);
const want = ["gear", ...Object.keys(manifest).filter((k) => k !== "lobby" && k !== "gear")].flatMap((k) => manifest[k]);
const got = new Set(A.asked);
const missing = want.filter((u) => !got.has(u));
const firstMap = Math.min(...Object.keys(manifest).filter((k) => k !== "lobby" && k !== "gear").flatMap((k) => manifest[k].filter((u) => !manifest.gear.includes(u) && !manifest.lobby.includes(u)).map((u) => A.asked.indexOf(u))).filter((i) => i >= 0));
const lastGear = Math.max(...manifest.gear.map((u) => A.asked.indexOf(u)));
console.log(`menu downloads: ${done ? "done" : "NOT done"} in ${took} s at ${MBPS} Mbps; menu frames p95 ${busy.join(" / ")} ms while downloading, ${control.join(" / ")} ms with no downloads`);
check(done, "the menu downloaded everything");
check(!missing.length, `every gear and map file fetched${missing.length ? ` (${missing.length} missing, e.g. ${missing.slice(0, 3).join(", ")})` : ""}`);
check(lastGear < firstMap, `all the gear before any map (last gear #${lastGear}, first map file #${firstMap})`);
const med = (a) => [...a].sort((x, y) => x - y)[1];
check(med(busy) <= Math.max(med(control) * 1.25, med(control) + 8), `the menu's frames hold while downloading (p95 median ${med(control)} -> ${med(busy)} ms)`);
// 2. a match afterwards, against one from a cold cache
const warm = await matchLoad(A.page);
check(!A.errors.length, `no page errors${A.errors.length ? ": " + A.errors.slice(0, 2).join(" | ") : ""}`);
await A.ctx.close();
const B = await open();
const cold = await matchLoad(B.page);   // (straight from the menu: its downloads barely started)
await B.ctx.close();
console.log(`${MAP}: loading screen ${warm} s after the menu's downloads, ${cold} s from a cold cache`);
check(warm < cold, `a match loads faster after the menu's downloads (${warm} s vs ${cold} s)`);
console.log(fails ? `${fails} FAIL` : "all PASS");
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
