// Troll Forces Socialize, Troll City: Kek & Sons (TROLL-CITY-RP2.md 2c;
// modes/social-shop.js): the merchant's till, a stetson and a canteen
// handed out (only by a merchant), a swig, the apple barrel.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-shop-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, "tools", ".shop-shots");
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
async function pumpAll(pages, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) for (const p of pages) await p.screenshot({ type: "jpeg", quality: 10 }).catch(() => {});
}
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
await ctx.route(/supabase/, (r) => r.abort());
const errors = [];

async function open(label, username, skewMs = 0) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await page.addInitScript(({ name, skewMs }) => {
    const fake = { getCachedProfile: () => ({ username: name, tags: [] }) };
    Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => fake, set: () => {} });
    const real = Date.now.bind(Date);
    window.__realNow = real;
    if (skewMs) Date.now = () => real() + skewMs;   // this device's clock is off
  }, { name: username, skewMs });
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 420000 });
  await page.waitForFunction(() => !!window.__trollOps && !!window.__trollShop, null, { timeout: 420000 });
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
  await page.evaluate(() => { window.__trollOps.els.pause.hidden = true;  });   // as a click would
}
const rp = (page) => page.evaluate(() => window.__trollOps.rp());
const B_ = (page) => page.evaluate(() => window.__trollBand.state());
async function holdRp(page, others, done, ms = 15000) {
  await page.keyboard.down("x");
  const t0 = Date.now();
  while (Date.now() - t0 < ms && !(await done())) await pumpAll([page, ...others], 250);
  await page.keyboard.up("x");
  await pumpAll([page, ...others], 150);
}
const putAt = (page, x, z, y, yaw = 0) => page.evaluate(({ x, z, y, yaw }) => {
  const T = window.__trollOps;
  T.move.reset(x, z, y); T.look.yaw = yaw;
}, { x, z, y, yaw });
/* The song's beat from room time alone (no listener lag), on this tab. */
const rawBeat = (page) => page.evaluate(() => {
  const S = window.__trollBand.band.song;
  return S ? ((window.__trollConductor.roomNow() - S.at) / 1000) / S.spb : null;
});
const npcVisible = (page, name) => page.evaluate((name) => window.__trollOps.townNpcs().list.find((n) => n.c.name === name)?.rig.root.visible, name);


const A = await open("A", "merchant_a");
const B = await open("B", "customer_b");
await join(A);
await join(B);
await pumpAll([A, B], 5000);
const [idA, idB] = await Promise.all([A, B].map((p) => p.evaluate(() => window.__trollOps.net.id)));
const SH = (page) => page.evaluate(() => window.__trollShop.state());
const S = await A.evaluate(() => window.__trollOps.builtMap().map.rp.shop);

// ── 1. The till ──────────────────────────────────────────────────────────
await putAt(A, S.till.x, S.till.z + 0.9, S.till.floor, 0);
await pumpAll([A], 500);
let s = await rp(A);
check("at the till: mind the store", /mind the store/i.test(s.prompt || ""), s.prompt);
await holdRp(A, [B], async () => (await rp(A)).role === "merchant");
await pumpAll([A, B], 1200);
check("A's the merchant", (await rp(A)).role === "merchant");
const kek = [await npcVisible(A, "Mr. Kek"), await npcVisible(B, "Mr. Kek")];
check("Mr. Kek steps off, on both tabs", kek[0] === false && kek[1] === false, JSON.stringify(kek));

// ── 2. A stetson, then a canteen ─────────────────────────────────────────
await putAt(B, S.till.x + 1.2, S.till.z + 1.0, S.till.floor, Math.PI);
await pumpAll([A, B], 1000);
s = await rp(A);
check("by B: hand them a stetson", /hand customer_b a stetson/i.test(s.prompt || ""), s.prompt);
await holdRp(A, [B], async () => (await SH(B)).stetson);
await pumpAll([A, B], 1200);
check("B wears it", (await SH(B)).hat === "stetson", JSON.stringify(await SH(B)));
check("A sees B's stetson", (await A.evaluate((id) => window.__trollOps.remotes.byId.get(id)?.rig.jobHatKind, idB)) === "stetson");
s = await rp(A);
check("then: hand them a canteen", /hand customer_b a canteen/i.test(s.prompt || ""), s.prompt);
await holdRp(A, [B], async () => (await SH(B)).drink?.kind === "canteen");
await pumpAll([A, B], 900);
check("B has a full canteen", (await SH(B)).drink?.kind === "canteen" && (await SH(B)).drink.sips === 6, JSON.stringify(await SH(B)));
check("A sees it in B's hand", await A.evaluate((id) => window.__trollOps.remotes.byId.get(id)?.drinkKind === "canteen", idB));
await B.mouse.move(480, 300); await B.mouse.down(); await pumpAll([B], 200); await B.mouse.up();
await pumpAll([B], 1700);
const bt = await B.evaluate(() => window.__trollOps.rp().tipsy);
check("a swig: one sip gone, not tipsy", (await SH(B)).drink?.sips === 5 && bt === 0, JSON.stringify({ d: (await SH(B)).drink, bt }));

// ── 3. A forged handout is ignored ───────────────────────────────────────
await A.evaluate(() => window.__trollOps.rp());
await B.evaluate((to) => window.__trollOps.net.publishRp({ k: "shop", e: "give", to, what: "stetson" }), idA);   // B isn't the merchant
await pumpAll([A, B], 600);
check("only the merchant's handouts count", !(await SH(A)).stetson);

// ── 4. The apple barrel ──────────────────────────────────────────────────
await putAt(A, S.apples.x, S.apples.z + 0.8, S.apples.floor, 0);
await pumpAll([A], 600);
s = await rp(A);
check("at the barrel: take an apple", /take an apple/i.test(s.prompt || ""), s.prompt);
await holdRp(A, [B], async () => (await SH(A)).drink?.kind === "apple");
check("A has an apple", (await SH(A)).drink?.kind === "apple" && (await SH(A)).drink.sips === 3);
await pumpAll([A, B], 700);
check("B sees it", await B.evaluate((id) => window.__trollOps.remotes.byId.get(id)?.drinkKind === "apple", idA));
await A.screenshot({ path: path.join(SHOTS, "shop-apple.png") });
await putAt(B, S.till.x + 0.5, S.till.z + 2.2, S.till.floor, Math.PI);
await pumpAll([B], 500);
await B.screenshot({ path: path.join(SHOTS, "shop-counter.png") });

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(failures ? `${failures} failed` : "all passed");
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
