// Troll Forces Zombies economy check (design doc "Zombies economy",
// claude.ai/artifact/CX7UuR3ybkeUvvNrbk9muS). Solo, no network, Supabase
// blocked. One section per system; run one with ONLY=<name>:
//   points   a hit pays 10, the first 6 hits a zombie only, a shotgun's
//            pellets once; a kill pays by type (walker 50, headshot 100,
//            melee 130); the HUD shows points with no $; the upgrade column
//            is priced in points.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-zecon-test.mjs [mapId]
//   SHOTS_DIR=<dir>
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOTS_DIR || os.tmpdir();
const ONLY = process.env.ONLY || "";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const map = process.argv[2] || "hollowgrin";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const want = (name) => !ONLY || ONLY === name;

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !/frame-ancestors|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
// solo, no room code: a Zombies run here never touches the network
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
await page.evaluate(async (map) => {
  const T = window.__trollOps;
  T.setMode("zombies");
  T.loadout.poolMapId = map;
  await T.startGame();
  if (T.isStaging?.()) T.endStaging();
  if (!T.els.pause.hidden) T.closePauseMenu();
}, map);
await page.waitForFunction(() => !!window.__trollOps.zdir() && window.__trollOps.zdir().round >= 1, null, { timeout: 120000 });
// no power-ups: a Double Points would double what we measure
await page.evaluate(() => window.__trollOps.zrun().drops.force(null, 0));

const R = (fn, arg) => page.evaluate(fn, arg);
const waitAlive = (n) => page.waitForFunction((n) => window.__trollOps.zdir().zombies.filter((q) => q.alive && !q.dying && !q.type.boss).length >= n, n, { timeout: 120000 }).then(() => true).catch(() => false);
const cash = () => R(() => window.__trollOps.zrun().econ.cash);
/* `n` hits of `dmg` on a fresh zombie, `gap` ms apart; what they paid. */
const hits = (opt) => R(async ({ n, dmg, gap, head, melee }) => {
  const T = window.__trollOps;
  const fresh = () => T.zdir().zombies.find((q) => q.alive && !q.dying && !q.type.boss && !q.paidHits && !(q.riseT > 0));
  for (let t = 0; t < 600 && !fresh(); t++) await new Promise((r) => setTimeout(r, 100));
  const z = fresh();
  if (!z) return null;
  if (melee) T.setHolding("melee");
  const c0 = T.zrun().econ.cash;
  for (let i = 0; i < n; i++) {
    if (melee) T.player.melee.t = 0.1;
    const point = z.mesh.position.clone(); point.y += 1.5;
    T.onBulletActorHit(z, { damage: dmg, isHead: !!head, point, dir: new T.THREE.Vector3(0, 0, -1) });
    if (gap) await new Promise((r) => setTimeout(r, gap));
  }
  if (melee) { T.player.melee.t = 0; T.setHolding("gun"); }
  return { paid: T.zrun().econ.cash - c0, type: z.type.id, dying: z.dying, hp: z.hp };
}, opt);

if (want("points")) {
  await waitAlive(3);
  // eight scratch hits: six paid
  const a = await hits({ n: 8, dmg: 1, gap: 90 });
  check(a && a.paid === 60, "8 hits pay 60 (10 each, first 6 only)", JSON.stringify(a));
  // nine pellets in one shot: one hit
  const b = await hits({ n: 9, dmg: 1, gap: 0 });
  check(b && b.paid === 10, "a shot's pellets pay once", JSON.stringify(b));
  // kills, by type
  const pay = { walker: 50, runner: 60, leaper: 70, spitter: 90, bloater: 90, armoured: 100, brute: 120 };
  const k = await hits({ n: 1, dmg: 1e7, gap: 0 });
  check(k && k.dying && k.paid === pay[k.type], `a ${k?.type} kill pays ${pay[k?.type]}`, JSON.stringify(k));
  await waitAlive(2);
  const h = await hits({ n: 1, dmg: 1e7, gap: 0, head: true });
  check(h && h.dying && h.paid === pay[h.type] + 50, `a ${h?.type} headshot kill pays ${pay[h?.type] + 50}`, JSON.stringify(h));
  await waitAlive(2);
  const m = await hits({ n: 1, dmg: 1e7, gap: 0, melee: true });
  check(m && m.dying && m.paid === pay[m.type] + 80, `a ${m?.type} melee kill pays ${pay[m?.type] + 80}`, JSON.stringify(m));
  await sleep(400);
  const hud = await R(() => ({
    cash: document.querySelector(".zh-cash-n")?.textContent || "",
    feed: document.querySelector(".zh-feed")?.textContent || "",
    prices: [...document.querySelectorAll(".zh-card .zh-price")].map((e) => e.textContent),
    offers: window.__trollOps.zrun().offers().map((o) => `${o.id}:${o.price}`),
    deploy: window.__trollOps.zrun().deployOffers().map((o) => `${o.id}:${o.price}`),
  }));
  check(/^[\d,]+$/.test(hud.cash) && Number(hud.cash.replace(/,/g, "")) === await cash(), "the HUD shows the points, no $", hud.cash);
  check(/MELEE KILL/.test(hud.feed) && !/\$/.test(hud.feed), "the feed reads +N ... KILL, no $", hud.feed);
  check(hud.offers.join() === "hp:1000,gun:1500,melee:500", "upgrades: health 1,000, gun tier 1,500, melee 500", hud.offers.join());
  check(hud.deploy.join() === "turret:1000,barricade:750,barrel:500", "deployables: 1,000 / 750 / 500", hud.deploy.join());
  check(!hud.prices.some((p) => p.includes("$")), "no $ on any card", hud.prices.join(" "));
  await page.screenshot({ path: path.join(SHOTS, "zecon-points.png") });
}

check(errors.length === 0, "no page errors", errors.slice(0, 4).join(" | "));
console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
