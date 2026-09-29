// Troll Royale over the network: two tabs in one private room (Supabase
// blocked, BroadcastChannel carries it). Both build the same zone and loot
// from the stage owner's seed, a gun one picks up vanishes for the other,
// a death's gear shows up for both, and the lobby lists the mode.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-royale-mp-test.mjs

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
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 640, height: 400 } });
await ctx.route(/supabase/, (r) => r.abort());
const ROOM = "ROY" + Math.floor(Math.random() * 90 + 10);
const errors = [];

async function open(label, matchesPlayed) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`);
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
  const listed = await page.evaluate(() => document.body.textContent.includes("Troll Royale"));
  await page.evaluate(async (room) => {
    const T = window.__trollOps;
    T.composer && (T.composer.render = () => {});
    T.setMode("royale_mini");
    if (T.els.noBots) T.els.noBots.checked = true;
    T.els.room.value = room;
    T.els.room.dispatchEvent(new Event("input"));
    await T.startGame();
  }, ROOM);
  return { page, listed };
}
const a = await open("A");
check("the lobby lists Troll Royale", a.listed);
await sleep(1500);   // A owns the stage clock (and the seed) before B shows up
const b = await open("B");
const A = a.page, B = b.page;
await Promise.all([A, B].map((p) => p.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.isStaging(), null, { timeout: 60000 })));
await sleep(1500);

const sig = (p) => p.evaluate(() => {
  const r = window.__trollOps.royale();
  return { seed: r.seed, n: r.loot.items.size, first: [...r.loot.items.values()].slice(0, 8).map((it) => `${it.id}:${it.k}:${it.w || ""}`).join(","), zone: JSON.stringify(r.zone.circles) };
});
const sa = await sig(A), sb = await sig(B);
check("both clients build the same loot and zone", sa.seed === sb.seed && sa.first === sb.first && sa.zone === sb.zone && sa.n === sb.n, JSON.stringify({ a: sa.seed, b: sb.seed, na: sa.n, nb: sb.n }));
const alive = await B.evaluate(() => window.__trollOps.royaleAliveList().length);
check("each sees two trolls standing", alive === 2, `${alive}`);

// A picks up a gun: it vanishes on B.
const gunId = await A.evaluate(() => {
  const T = window.__trollOps, r = T.royale();
  const it = [...r.loot.items.values()].find((x) => x.k === "gun");
  T.royalePickupGun(it);
  return it.id;
});
await sleep(800);
const gone = await B.evaluate((id) => !window.__trollOps.royale().loot.items.has(id), gunId);
check("a gun A picks up is gone on B's screen", gone, gunId);

// A dies: its gear appears on B, B is the last one standing and wins.
const aId = await A.evaluate(() => window.__trollOps.net.id);
const before = await B.evaluate(() => window.__trollOps.royale().loot.items.size);
await A.evaluate(() => { const T = window.__trollOps; T.player.spawnGuard = 0; T.damagePlayer(999, null, "zone"); });
await sleep(1000);
const after = await B.evaluate((aId) => {
  const T = window.__trollOps, r = T.royale();
  return { n: r ? r.loot.items.size : -1, drops: r ? [...r.loot.items.keys()].filter((k) => k.startsWith(aId + ".")).length : -1 };
}, aId);
check("A's gear lands on B's screen", after.drops >= 2 && after.n >= before + 2, JSON.stringify({ before, ...after }));
await sleep(2500);
const end = await B.evaluate(() => ({ state: window.__trollOps.state(), title: document.getElementById("to-gameover")?.textContent.replace(/\s+/g, " ").slice(0, 80) }));
check("B, the last troll standing, wins", /You win/.test(end.title || ""), JSON.stringify(end));

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
