// Kabukigrin's dance floor in Socialize: the roamers (town-npcs.js `stops`,
// kabukigrin-social.js). A private room, Supabase blocked, no bots: the page
// never joins the live public room.
//   1. Six ravers roam, twelve keep their spot (and the go-go dancer).
//   2. Stepped through four minutes of the crowd: every roamer leaves the
//      floor for the rim and comes back onto it, walks between (moving),
//      and the twelve never move.
//   3. A roamer stands at its stop facing the DJ, doing the stop's act.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-kb-roam-test.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 120000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.setMode("social");
  if (T.els.noBots) T.els.noBots.checked = true;
  T.els.room.value = "PV" + Math.random().toString(36).slice(2, 5).toUpperCase();   // a private room
  T.els.room.dispatchEvent(new Event("input"));
  T.loadout.mapId = "kabukigrin";
  await T.startGame();
  if (T.isStaging()) T.endStaging();
});
await page.waitForFunction(() => !!window.__trollOps.townNpcs?.()?.list?.length, null, { timeout: 240000 });

const res = await page.evaluate(() => {
  const tn = window.__trollOps.townNpcs();
  const floor = { x0: -27, x1: -17, z0: 10, z1: 20 };   // kabukigrin.js DANCE
  const on = (n) => n.x > floor.x0 && n.x < floor.x1 && n.z > floor.z0 && n.z < floor.z1;
  const ravers = tn.list.filter((n) => n.c.role === "Raver");
  const roamers = ravers.filter((n) => n.c.stops);
  const still = ravers.filter((n) => !n.c.stops).map((n) => ({ n, x: n.x, z: n.z }));
  const seen = roamers.map(() => ({ off: false, backOn: false, moved: false }));
  const eye = { x: -22, y: 1.7, z: 15 };
  let facing = null;
  for (let i = 0; i < 4 * 60 * 10; i++) {   // four minutes in 0.1 s steps
    tn.update(0.1, eye);
    roamers.forEach((n, k) => {
      const s = seen[k];
      if (n.moving) s.moved = true;
      if (!on(n) && !n.leg) s.off = true;
      if (s.off && on(n) && !n.leg) s.backOn = true;
      if (!facing && !n.leg && n.c.stops[n.stop].act === "phone") {
        const d = n.c.stops[n.stop];
        facing = { yaw: n.yaw, want: Math.atan2(n.x + 29.6, n.z - 15), act: d.act };
      }
    });
  }
  return {
    ravers: ravers.length, roamers: roamers.length, still: still.length,
    seen, stillMoved: still.filter((s) => Math.hypot(s.n.x - s.x, s.n.z - s.z) > 1e-6).length, facing,
  };
});
check(res.roamers === 6 && res.still === 12, "six ravers roam, twelve keep their spot", `${res.roamers} / ${res.still}`);
check(res.seen.every((s) => s.off && s.backOn), "every roamer steps off the floor and comes back onto it", JSON.stringify(res.seen));
check(res.seen.every((s) => s.moved), "and walks between its stops");
check(res.stillMoved === 0, "the twelve never move", String(res.stillMoved));
check(!!res.facing && Math.abs(Math.atan2(Math.sin(res.facing.yaw - res.facing.want), Math.cos(res.facing.yaw - res.facing.want))) < 0.05,
  "at the rim a roamer faces the DJ with its phone up", JSON.stringify(res.facing));
check(!errors.length, "no page errors", errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
