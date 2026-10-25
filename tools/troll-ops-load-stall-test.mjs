// Troll Forces: a download that never finishes must not hold the loading
// screen. A phone under memory or network pressure can leave a fetch hanging;
// the warm-up after the map (match-start.js warmShaders: the streak models,
// the guns) waited on its downloads with no limit, and the screen sat at
// 88 % "Warming up" for good (Kabukigrin on a phone, 2026-10-25).
//
// Emulates an iPhone, starts a solo match (Supabase blocked: never a live
// room) with one download left hanging, and checks the loading screen comes
// down anyway.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-load-stall-test.mjs [mapId] [--stall=<url regex>]
//   (default: helicopter.glb, one of the warm-up's models)
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
const args = process.argv.slice(2);
const MAP = args.find((a) => !a.startsWith("--")) || "kabukigrin";
const STALL = new RegExp(args.find((a) => a.startsWith("--stall="))?.slice(8) || "/models/helicopter\\.glb");
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({
  viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
});
await ctx.route(/supabase/, (r) => r.abort());   // never a live room (CLAUDE.md troll-ops rule 2)
let stalled = 0;
await ctx.route(STALL, () => { stalled++; /* never answered */ });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let fails = 0;
const check = (ok, what) => { console.log(`${ok ? "PASS" : "FAIL"} ${what}`); if (!ok) fails++; };

await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 4000));
const out = await page.evaluate(async (map) => {
  const T = window.__trollOps;
  T.setMode("ops"); T.loadout.mapId = map;
  const t0 = performance.now();
  T.startGame();
  await new Promise((r) => setTimeout(r, 300));
  while (T.loadState().open && performance.now() - t0 < 90000) await new Promise((r) => setTimeout(r, 200));
  const st = T.loadState();
  return { open: st.open, status: st.status, pct: document.querySelector(".to-mapload-pct")?.textContent, s: +((performance.now() - t0) / 1000).toFixed(1) };
}, MAP);
console.log(`${MAP}: ${stalled} request(s) left hanging (${STALL.source}); ${out.open ? `still open at ${out.pct} "${out.status}" after ${out.s} s` : `screen down after ${out.s} s`}`);
check(stalled > 0, "the stalled download was asked for");
check(!out.open, "the loading screen comes down with a download hanging");
check(!errors.length, `no page errors${errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""}`);
console.log(fails ? `${fails} FAIL` : "all PASS");
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
