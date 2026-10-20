// Troll Forces Socialize, Troll City: the town hall's three Troll-o-Graphs
// (modes/social-computers.js): the prompt in front of each, hold X, the
// screen (trolltruths framed, the CSP letting it in; OpenSea and trollface.io
// a new-tab link), Esc / Close, the pause menu left shut, a real new tab.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-computers-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, "tools", ".computers-shots");
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
// the framed site, stubbed: no real request leaves the test
await ctx.route(/trolltruths\.com/, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>stub</title><h1>TrollTruths stub</h1>" }));
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
  await page.waitForFunction(() => !!window.__trollOps && !!window.__trollComputers, null, { timeout: 420000 });
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


const A = await open("A", "computer_a");
await join(A);
await pumpAll([A], 4000);
const C = await A.evaluate(() => window.__trollOps.builtMap().map.rp.computers);
const CS = () => A.evaluate(() => window.__trollComputers.state());
check("three Troll-o-Graphs in the town hall", Array.isArray(C) && C.length === 3, JSON.stringify(C));

// away from them: no prompt
await putAt(A, 86, -11, 0.3, Math.PI);
await pumpAll([A], 500);
let s = await rp(A);
check("away from them, no Troll-o-Graph prompt", !/troll-o-graph/i.test(s.prompt || ""), s.prompt);

for (const [i, c] of C.entries()) {
  await putAt(A, c.x, c.z, c.floor, Math.PI);
  await pumpAll([A], 600);
  s = await rp(A);
  check(`at ${c.name}: the prompt`, (s.prompt || "").includes(`Troll-o-Graph: ${c.name}`), s.prompt);
  await holdRp(A, [], async () => (await CS()).open, 6000);
  let st = await CS();
  check(`${c.name}: the screen opens`, st.open && st.at === c.key, JSON.stringify({ open: st.open, at: st.at }));
  if (c.frame) check(`${c.name}: framed in the game`, st.html.includes("<iframe") && st.html.includes(c.url));
  else check(`${c.name}: a new-tab link, no frame`, !st.html.includes("<iframe") && st.html.includes('target="_blank"') && st.html.includes(c.url));
  check(`${c.name}: the pause menu stays shut`, await A.evaluate(() => window.__trollOps.els.pause.hidden));
  await A.screenshot({ path: path.join(SHOTS, `computer-${c.key}.png`) });
  if (i === 0) {
    // the framed (stubbed) page actually loaded: the CSP let it in
    const f = A.frames().find((fr) => /trolltruths/.test(fr.url()));
    const framed = f ? await f.evaluate(() => document.body.textContent).catch(() => null) : null;
    check("the framed site loads (CSP frame-src)", /TrollTruths stub/.test(framed || ""), framed);
    await A.keyboard.press("Escape");
  } else {
    await A.click(".troll-o-graph [data-close]");
  }
  await pumpAll([A], 300);
  st = await CS();
  check(`${c.name}: ${i === 0 ? "Esc" : "Close"} puts it away`, !st.open && st.html === "");
}

// the new-tab link opens a tab (a real click) and the screen goes
await putAt(A, C[1].x, C[1].z, C[1].floor, Math.PI);
await pumpAll([A], 500);
await holdRp(A, [], async () => (await CS()).open, 6000);
await ctx.route(/opensea\.io/, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>stub</title>" }));
const [tab] = await Promise.all([ctx.waitForEvent("page", { timeout: 8000 }).catch(() => null), A.click(".troll-o-graph a[data-out]")]);
check("OpenSea opens in a new tab", !!tab && /opensea\.io\/collection\/trollsoneth/.test(tab.url()), tab && tab.url());
await pumpAll([A], 300);
check("and the screen goes away", !(await CS()).open);
if (tab) await tab.close();

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(failures ? `${failures} failed` : "all passed");
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
