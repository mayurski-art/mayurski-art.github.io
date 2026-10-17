// Troll Forces medal splash placement (user, 2026-10-17: "move the game
// badges earned during the game a bit higher that way it doesnt obstruct the
// view of the scorestreaks and this military nuke device"). A solo PRIVATE
// room (Supabase blocked, no bots), on desktop and phone sizes: a burst of
// three medals with the streak banner up and the nuke handheld raised, then
// pixel checks that the medals sit above the crosshair, clear of the streak
// strip, the nuke row, the banner and the score line.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-medal-layout-test.mjs [outDir]
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2] || null;
if (OUT) fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const STATE = "/assets/games/troll-ops/core/state.js?v=st1";
const NUKE = "/assets/games/troll-ops/streaks/nuke.js?v=tn1";

const SIZES = [
  { name: "desktop", w: 960, h: 540, touch: false },
  { name: "desktop-tall", w: 1280, h: 800, touch: false },
  { name: "phone", w: 844, h: 390, touch: true },
  { name: "phone-small", w: 667, h: 375, touch: true },
];

for (const size of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, hasTouch: size.touch, isMobile: size.touch, deviceScaleFactor: size.touch ? 2 : 1 });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${size.name}: ${e.message}`));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
  await page.evaluate(async (room) => {
    const T = window.__trollOps;
    T.setMode("tdm");
    T.els.noBots.checked = true;
    T.els.room.value = room;
    T.els.room.dispatchEvent(new Event("input"));
    T.loadout.versusMapId = "grinsite";
    await T.startGame();
  }, "ML" + String(Math.floor(Math.random() * 900 + 100)));
  await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 240000 });
  await page.evaluate(() => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); T.settings.invincible = true; });
  await sleep(1500);

  // Two quick kills, the second a headshot at 25: Double Kill, Headshot,
  // Nuclear (and First Blood) in one burst, the banner up, then the handheld.
  await page.evaluate(async ({ u, n }) => {
    const { game } = await import(u);
    const T = window.__trollOps;
    const enemy = T.net.team === "phantom" ? "ghost" : "phantom";
    game.player.streak = 23;
    T.registerDeath("Dummy", T.net.id, "pistol", { victimId: "d1", victimTeam: enemy });
    T.registerDeath("Dummy", T.net.id, "pistol", { victimId: "d2", victimTeam: enemy, head: true });
    (await import(n)).callNuke();
  }, { u: STATE, n: NUKE });
  await sleep(900);
  const r = await page.evaluate(() => {
    const rect = (el) => { if (!el || el.hidden) return null; const b = el.getBoundingClientRect(); return b.width && b.height ? { l: b.left, t: b.top, r: b.right, b: b.bottom } : null; };
    // Ink box of what's drawn in the stack: each pop's icon, name and points.
    const ink = [...document.querySelectorAll("#to-ks-badges .to-medal-pop > *")].map(rect).filter(Boolean);
    const box = ink.length ? { l: Math.min(...ink.map((x) => x.l)), t: Math.min(...ink.map((x) => x.t)), r: Math.max(...ink.map((x) => x.r)), b: Math.max(...ink.map((x) => x.b)) } : null;
    const xh = document.getElementById("to-crosshair");
    const xhb = xh.getBoundingClientRect();
    return {
      n: ink.length, box, ink,
      cross: { y: xhb.top + xhb.height / 2 },
      ss: rect(document.getElementById("to-ss-hud")),
      nukeRow: rect(document.querySelector(".to-nuke-ready")),
      banner: rect(document.querySelector("#to-ks-banner .to-ks-ready")),
      teams: rect(document.getElementById("to-hud-teams")),
      buttons: [...document.querySelectorAll(".to-touch-btn")].filter((b) => b.offsetParent).map(rect).filter(Boolean),
    };
  });
  if (OUT) await page.screenshot({ path: path.join(OUT, `medals-${size.name}.png`) });
  const hit = (a, b) => !!a && !!b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
  const anyHit = (b) => r.ink.some((x) => hit(x, b));
  // Short screens show only the newest medal (badge + name; Nuclear pays no points).
  check(r.n >= (size.h > 640 ? 3 : 2) && !!r.box, `${size.name}: the medal burst is on screen`, `ink boxes=${r.n}`);
  if (!r.box) continue;
  check(r.box.b <= r.cross.y - (size.touch ? 8 : 12), `${size.name}: medals sit above the crosshair`, `bottom=${r.box.b.toFixed(0)} crosshair=${r.cross.y.toFixed(0)}`);
  check(r.box.t >= 0, `${size.name}: medals stay on screen`, `top=${r.box.t.toFixed(0)}`);
  check(!anyHit(r.ss), `${size.name}: clear of the scorestreak strip`);
  check(!anyHit(r.nukeRow), `${size.name}: clear of the nuke row`);
  check(!anyHit(r.banner), `${size.name}: clear of the streak banner`, JSON.stringify({ banner: r.banner, top: r.box.t }));
  check(!anyHit(r.teams), `${size.name}: clear of the score line`);
  check(!r.buttons.some(anyHit), `${size.name}: clear of the touch buttons`);
  // The handheld sits low in the view: the medals stay in the top half.
  check(r.box.b <= size.h * 0.5, `${size.name}: medals stay out of the lower half (the held devices)`);
  await ctx.close();
}

check(!errors.length, "no page errors", errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
