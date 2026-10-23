// Troll Forces Socialize, Troll City: the jailbreak (modes/social-jailbreak.js,
// maps/trollcity-jailwall.js). Every cell has its wall; outside a cell there's
// no gun to take; locked up, hold X at the bunk and the revolver's in hand,
// fire is the shot; eight clean hits clear the wall; in a second cell one
// miss loses the try (gun gone, no second take, the face greyed); a cell's
// wall comes back fresh after it empties.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-jailbreak-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, "tools", ".jailbreak-shots");
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

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
await ctx.route(/supabase/, (r) => r.abort());
const errors = [];
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  const fake = { getCachedProfile: () => ({ username: "jailbreak_a", tags: [] }) };
  Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => fake, set: () => {} });
});
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 420000 });
await page.waitForFunction(() => !!window.__trollOps && !!window.__trollSheriff && !!window.__trollJailbreak, null, { timeout: 420000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.setLoadWaitMax(8);
  T.setMode("social");
  T.loadout.mapId = "trollcity";
  await T.startGame();
});
await page.waitForFunction(() => !window.__trollOps.loadState().open, null, { timeout: 420000 });
await page.evaluate(() => { window.__trollOps.els.pause.hidden = true; });
await pump(page, 3000);

const state = () => page.evaluate(() => {
  const T = window.__trollOps, B = window.__trollJailbreak, S = window.__trollSheriff;
  const J = T.builtMap().map.rp.jail();
  return {
    cells: J.cells.length, walls: J.cells.filter((c) => c.wall).length,
    gun: B.jb.gun, taken: !!B.jb.taken, lost: B.jb.lost, cleared: B.jb.cleared,
    jail: S.jailed.me ? S.jailed.me.ci : -1, prompt: T.rp().prompt,
    walls2: J.cells.map((c) => ({ state: c.wall?.state, hit: c.wall?.spots.filter((q) => q.hit).length })),
    under: J.cells.map((_, i) => !!B.under.get(i)?.mesh?.visible),
  };
});
/* Into cell `ci`, beside its bunk, facing the back wall. */
const lockIn = (ci) => page.evaluate((ci) => {
  const T = window.__trollOps, S = window.__trollSheriff;
  const c = T.builtMap().map.rp.jail().cells[ci];
  S.jailed.walk = null;
  S.jailed.me = { ci, left: 55, why: "" };
  T.move.reset(c.cot.x - 0.95, c.cot.z + 0.2, c.y);
  T.look.yaw = -Math.PI / 2; T.look.pitch = 0;
}, ci);
async function holdX(until, ms = 8000) {
  await page.keyboard.down("x");
  const t0 = Date.now();
  while (Date.now() - t0 < ms && !(await until())) await pump(page, 200);
  await page.keyboard.up("x");
  await pump(page, 150);
}
/* Aim the camera at wall point (z, y) of cell ci (or a miss offset), then pull the trigger. */
async function fireAt(ci, target) {
  await page.evaluate(({ ci, target }) => {
    const T = window.__trollOps;
    const c = T.builtMap().map.rp.jail().cells[ci];
    const p = new T.camera.position.constructor();
    T.camera.getWorldPosition(p);
    const dx = c.wall.rect.x - p.x, dy = target.y - p.y, dz = target.z - p.z;
    T.look.yaw = Math.atan2(-dx, -dz);
    T.look.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  }, { ci, target });
  await pump(page, 250);
  // the yaw/pitch reach the camera on the next frame; aim once more from there
  await page.evaluate(({ ci, target }) => {
    const T = window.__trollOps;
    const c = T.builtMap().map.rp.jail().cells[ci];
    const p = new T.camera.position.constructor();
    T.camera.getWorldPosition(p);
    const dx = c.wall.rect.x - p.x, dy = target.y - p.y, dz = target.z - p.z;
    T.look.yaw = Math.atan2(-dx, -dz);
    T.look.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  }, { ci, target });
  await pump(page, 250);
  await page.evaluate(() => window.__trollOps.setTrigger(true));
  await pump(page, 200);
  await page.evaluate(() => window.__trollOps.setTrigger(false));
  await pump(page, 450);
}
const spotsOf = (ci) => page.evaluate((ci) => window.__trollOps.builtMap().map.rp.jail().cells[ci].wall.spots.map((q) => ({ z: q.z, y: q.y })), ci);

let s = await state();
check("four cells, each with its jailbreak wall", s.cells === 4 && s.walls === 4, `${s.walls}/${s.cells}`);
check("a revolver under every bunk", s.under.every(Boolean), JSON.stringify(s.under));

// free, at a bunk (through the bars is too far; stood in the open cell): no gun to take
await page.evaluate(() => {
  const T = window.__trollOps, c = T.builtMap().map.rp.jail().cells[0];
  T.move.reset(c.cot.x - 0.95, c.cot.z + 0.2, c.y);
});
await pump(page, 600);
s = await state();
check("not locked up: no reach under the bunk", s.prompt !== "Reach under the bunk", String(s.prompt));

// locked in cell 0: the prompt, hold X, the gun
await lockIn(0);
await pump(page, 600);
s = await state();
check("locked up at the bunk: Reach under the bunk", s.prompt === "Reach under the bunk", String(s.prompt));
await holdX(async () => (await state()).gun);
s = await state();
check("hold X: the revolver's in hand", s.gun && s.taken);
check("the one under that bunk is gone", !s.under[0] && s.under[1]);

// eight clean hits
const spots0 = await spotsOf(0);
for (const [k, q] of spots0.entries()) {
  await fireAt(0, q);
  if (k === 4) {   // a look: the gun up, the holes in the chalk
    await page.evaluate(() => { const T = window.__trollOps; T.look.yaw = -Math.PI / 2; T.look.pitch = 0.12; });
    await pump(page, 400);
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, "cell0-five-hits.jpg"), type: "jpeg", quality: 85 });
  }
}
s = await state();
check("eight clean hits: every spot hit", s.walls2[0].hit === 8, JSON.stringify(s.walls2[0]));
check("...the try cleared, the gun put away, nothing lost", s.cleared && !s.gun && !s.lost);

// cell 1: one hit, then a miss on the bare brick in the tracing's top corner
await page.evaluate(() => { window.__trollSheriff.jailed.me = null; });
await pump(page, 300);
await lockIn(1);
await pump(page, 600);
await holdX(async () => (await state()).gun);
const spots1 = await spotsOf(1);
await fireAt(1, spots1[0]);
s = await state();
check("cell 1: the first hit lands", s.walls2[1].hit === 1 && s.gun, JSON.stringify(s.walls2[1]));
const rect1 = await page.evaluate(() => window.__trollOps.builtMap().map.rp.jail().cells[1].wall.rect);
await fireAt(1, { z: rect1.z0 + 0.12, y: rect1.y1 - 0.12 });
s = await state();
check("a miss: the try is lost, the gun gone", s.lost && !s.gun, JSON.stringify(s));
check("...the face greyed", s.walls2[1].state === "lost");
await pump(page, 400);
s = await state();
check("...and no second reach under the bunk", s.prompt !== "Reach under the bunk", String(s.prompt));
check("...the sentence still running", s.jail === 1);

// a re-hit of a spot also counts as a miss
await page.evaluate(() => { window.__trollSheriff.jailed.me = null; });
await pump(page, 300);
await lockIn(2);
await pump(page, 600);
await holdX(async () => (await state()).gun);
const spots2 = await spotsOf(2);
await fireAt(2, spots2[3]);
await fireAt(2, spots2[3]);
s = await state();
check("hitting the same X twice is a miss", s.lost && s.walls2[2].hit === 1, JSON.stringify(s.walls2[2]));

// out, and a minute later the walls come back
await page.evaluate(() => { window.__trollSheriff.jailed.me = null; window.__trollJailbreak.JB.resetSecs = 1; });
await pump(page, 2500);
s = await state();
check("empty cells' walls come back fresh", s.walls2.every((w) => w.state === "whole" && w.hit === 0) && s.under.every(Boolean), JSON.stringify(s.walls2));

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close(); server.close();
console.log(failures ? `${failures} FAILED` : "all passed");
process.exit(failures ? 1 : 0);
