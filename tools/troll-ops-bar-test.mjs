// Troll Forces Socialize: the Troll City saloon bar and townsfolk.
//
// Two tabs in one headless browser share the QSOC room on Troll City over
// BroadcastChannel (Supabase blocked):
//   1. The townsfolk are there, walk their rounds, and their name tags show
//      only up close.
//   2. A holds X at the rack for a mug, fills it at a tap, sips it down
//      (fire), gets tipsy. B sees the mug in A's hand.
//   3. A puts on the apron (bartender), B sees the role. A pours a whiskey
//      and hands it to B; B takes it.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-bar-test.mjs

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/* Headless pages only draw (and so only send state and tick clocks) when
   something asks for a frame: screenshots ask, for `ms`. */
async function pump(page, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) await page.screenshot({ type: "jpeg", quality: 10 }).catch(() => {});
}
async function pumpBoth(a, b, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    await a.screenshot({ type: "jpeg", quality: 10 }).catch(() => {});
    await b.screenshot({ type: "jpeg", quality: 10 }).catch(() => {});
  }
}

// The GPU, not SwiftShader: held-X timers and walkers run on frame time.
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
await ctx.route(/supabase/, (r) => r.abort());
const errors = [];

async function open(label, username) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await page.addInitScript((name) => {
    const fake = { getCachedProfile: () => ({ username: name, tags: [] }) };
    Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => fake, set: () => {} });
  }, username);
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 420000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 420000 });
  await page.evaluate(() => window.__trollOps.setLoadWaitMax(8));
  return page;
}
async function join(page) {
  await page.evaluate(async () => {
    const T = window.__trollOps;
    T.setMode("social");
    T.loadout.mapId = "trollcity";
    await T.startGame();
  });
  await page.waitForFunction(() => !window.__trollOps.loadState().open, null, { timeout: 420000 });
  await page.evaluate(() => { window.__trollOps.els.pause.hidden = true; });
}
const at = (page, x, z, yaw = 0) => page.evaluate(({ x, z, yaw }) => {
  const T = window.__trollOps;
  const B = T.builtMap().map.rp.bar;
  T.move.reset(x, z, B.floorY || 0); T.look.yaw = yaw;
}, { x, z, yaw });
const spot = (page, key) => page.evaluate((key) => {
  const B = window.__trollOps.builtMap().map.rp.bar;
  return key === "tap" ? B.taps[0] : B[key];
}, key);
const bar = (page) => page.evaluate(() => window.__trollOps.bar());
/* Hold X until `done` holds (pumping frames), then let go. */
async function holdX(page, done, ms = 20000) {
  await page.keyboard.down("x");
  const t0 = Date.now();
  let s = await bar(page);
  while (Date.now() - t0 < ms && !done(s)) { await pump(page, 250); s = await bar(page); }
  await page.keyboard.up("x");
  await pump(page, 100);
  return bar(page);
}

const A = await open("A", "troll_runner");
const B = await open("B", "someone_else");
await join(A);
await join(B);
await pumpBoth(A, B, 3000);
const ids = await Promise.all([A, B].map((p) => p.evaluate(() => window.__trollOps.net.id)));

// ── 1. Townsfolk ──────────────────────────────────────────────────────────
const npcs0 = await A.evaluate(() => window.__trollOps.townNpcs()?.list.map((n) => ({ name: n.c.name, act: n.c.act, x: n.x, z: n.z })) || []);
check("Troll City's Socialize is full of townsfolk", npcs0.length >= 20, `${npcs0.length}`);
await at(A, -30, -1.2, -Math.PI / 2);
await pump(A, 4000);
const npcs1 = await A.evaluate(() => window.__trollOps.townNpcs().list.map((n) => ({ name: n.c.name, act: n.c.act, x: n.x, z: n.z, tag: n.tag ? n.tag.visible : null, role: n.c.role, vis: n.rig.root.visible, d: Math.hypot(n.x + 30, n.z + 1.2) })));
const walkers = npcs1.filter((n) => n.act === "walk");
// Some stop to look about, so most, not all.
const moved = walkers.filter((n) => { const o = npcs0.find((m) => m.name === n.name); return Math.hypot(n.x - o.x, n.z - o.z) > 0.2; });
check("the strollers walk their rounds", moved.length >= walkers.length * 0.6, `${moved.length}/${walkers.length}`);
check("several are out on Main Street", walkers.filter((n) => Math.abs(n.z) < 4 && n.x > -42 && n.x < 32).length >= 5);
const EXTRAS = ["Townsfolk", "Drifter", "Barfly", "Regular", "Gambler"];
const jobs = npcs1.filter((n) => !EXTRAS.includes(n.role));
check("background extras wear no name tag", npcs1.filter((n) => EXTRAS.includes(n.role)).every((n) => n.tag === null));
check("roleplay jobs wear one, shown only up close", jobs.length >= 10 && jobs.every((n) => n.tag === (n.d < 12)), jobs.filter((n) => n.tag !== (n.d < 12)).map((n) => n.name).join(",") || `${jobs.length} jobs`);
check("far townsfolk are hidden", npcs1.every((n) => n.vis === (n.d <= 85)));

// ── 2. A mug, a fill, a sip ───────────────────────────────────────────────
const rack = await spot(A, "rack");
await at(A, rack.x, rack.z + 0.4, 0);
await pump(A, 300);
check("the rack offers a mug", /grab a mug/i.test((await bar(A)).prompt || ""), (await bar(A)).prompt);
let s = await holdX(A, (s) => !!s.drink);
check("holding X at the rack grabs an empty mug", s.drink?.kind === "beer" && s.drink.sips === 0, JSON.stringify(s.drink));
check("the mug is in the first-person hand", s.fp);

const tap = await spot(A, "tap");
await at(A, tap.x, tap.z + 0.5, 0);
await pump(A, 300);
s = await holdX(A, (s) => s.drink?.sips > 0, 30000);
check("holding X at a tap fills it", s.drink?.sips === 4, JSON.stringify(s.drink));

await A.evaluate(() => window.__trollOps.setTrigger(true));
await pump(A, 200);
await A.evaluate(() => window.__trollOps.setTrigger(false));
await pump(A, 3000);
s = await bar(A);
check("fire takes a sip", s.drink?.sips === 3 && s.tipsy > 0, `sips ${s.drink?.sips} tipsy ${s.tipsy?.toFixed(2)}`);

await pumpBoth(A, B, 1500);
const seen = await B.evaluate((id) => { const rp = window.__trollOps.remotes.byId.get(id); return rp ? { kind: rp.drinkKind, mesh: !!rp.drinkMesh?.parent } : null; }, ids[0]);
check("the other tab sees the mug in A's hand", seen?.kind === "beer" && seen.mesh, JSON.stringify(seen));

// Set it down on the counter (user, 2026-10-07: "a spot where i can just
// leave it on the bar table"); B sees it there and picks it up.
const mugs = (page) => page.evaluate(() => [...window.__trollOps.barState.mugs.values()].map((m) => ({ id: m.id, x: m.x, y: m.y, z: m.z, kind: m.kind, sips: m.sips, shown: !!m.mesh.parent })));
await at(A, -6.6, -16.6, Math.PI / 2);
await pump(A, 300);
check("by the counter, A is offered to set the mug down", /set your mug down/i.test((await bar(A)).prompt || ""), (await bar(A)).prompt);
s = await holdX(A, (s) => !s.drink, 6000);
const aMugs = await mugs(A);
check("holding X sets it down on the counter", !s.drink && aMugs.length === 1 && aMugs[0].sips === 3 && Math.abs(aMugs[0].y - 1.47) < 0.05 && aMugs[0].x > -7.85 && aMugs[0].x < -7.05, JSON.stringify(aMugs));
await pumpBoth(A, B, 1000);
const bMugs = await mugs(B);
check("the other tab sees it on the counter", bMugs.length === 1 && bMugs[0].shown && Math.hypot(bMugs[0].x - aMugs[0].x, bMugs[0].z - aMugs[0].z) < 0.01, JSON.stringify(bMugs));
await at(B, -6.6, aMugs[0]?.z ?? -16.6, Math.PI / 2);
await pump(B, 300);
check("B is offered the beer", /pick up the beer/i.test((await bar(B)).prompt || ""), (await bar(B)).prompt);
const bPick = await holdX(B, (s) => !!s.drink, 6000);
await pumpBoth(A, B, 1000);
check("B picks it up, and it's gone from both counters", bPick.drink?.sips === 3 && (await mugs(A)).length === 0 && (await mugs(B)).length === 0, JSON.stringify(bPick.drink));

await B.keyboard.press("g");
await pump(B, 200);
check("G puts it down", !(await bar(B)).drink);

// ── 3. The bartender ──────────────────────────────────────────────────────
const apron = await spot(A, "apron");
await at(A, apron.x, apron.z + 0.4, 0);
await pump(A, 300);
s = await holdX(A, (s) => s.role === "bartender");
check("the apron makes A the bartender", s.role === "bartender");
await pumpBoth(A, B, 1500);
const roleSeen = await B.evaluate((id) => window.__trollOps.net.peers.get(id)?.role, ids[0]);
check("the other tab knows A tends bar", roleSeen === "bartender", String(roleSeen));

const bottles = await spot(A, "bottles");
await at(A, bottles.x - 0.4, bottles.z, 0);
await pump(A, 300);
s = await holdX(A, (s) => !!s.drink);
check("the bartender pours a whiskey at the back-bar", s.drink?.kind === "whiskey", JSON.stringify(s.drink));

// B stands beside A; A holds it out, B takes it.
await at(B, bottles.x - 1.4, bottles.z, 0);
await pumpBoth(A, B, 1500);
s = await holdX(A, (s) => !!s.outgoing, 10000);
check("A holds the whiskey out to B", s.outgoing);
await pumpBoth(A, B, 1000);
const bs = await bar(B);
check("B is offered it", bs.offer && /take/i.test(bs.prompt || ""), bs.prompt);
await B.keyboard.down("x");
await pumpBoth(A, B, 4000);
await B.keyboard.up("x");
await pumpBoth(A, B, 1000);
const [aEnd, bEnd] = [await bar(A), await bar(B)];
check("B now holds the whiskey and A doesn't", bEnd.drink?.kind === "whiskey" && !aEnd.drink, `A ${JSON.stringify(aEnd.drink)} B ${JSON.stringify(bEnd.drink)}`);

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(failures ? `${failures} FAILED` : "all passed");
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
