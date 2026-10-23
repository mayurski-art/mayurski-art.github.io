// Troll Forces Socialize, Troll Beach 5d: the court games. One tab (two for
// the wire checks), Supabase blocked, so no public room is ever touched.
//   gear: the hoop nets, the cart, the hopper and the three scoreboards are
//         placed; the slates are written; rp.courts() lists the spots; the
//         balls and the racket load. Shots in tools/.courts-shots.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-courts-test.mjs [gear]

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, "tools", ".courts-shots");
const ONLY = process.argv.slice(2);
const want = (k) => !ONLY.length || ONLY.includes(k);
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

async function open(label, username) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await page.addInitScript(({ name }) => {
    const fake = { getCachedProfile: () => ({ username: name, tags: [] }) };
    Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => fake, set: () => {} });
  }, { name: username });
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 420000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 420000 });
  await page.evaluate(() => window.__trollOps.setLoadWaitMax(8));
  return page;
}
async function join(page) {
  await page.evaluate(async () => {
    const T = window.__trollOps;
    T.setMode("social");
    T.loadout.mapId = "grinbeach";
    await T.startGame();
  });
  await page.waitForFunction(() => !window.__trollOps.loadState().open, null, { timeout: 420000 });
  await page.evaluate(() => {
    window.__trollOps.els.pause.hidden = true;
    // a scratch camera after the game's own, for the shots
    const cam = window.__trollOps.camera;
    const orig = cam.updateMatrixWorld.bind(cam);
    cam.updateMatrixWorld = (f) => {
      const c = window.__courtCam;
      if (c) { cam.position.set(...c.from); cam.lookAt(...c.at); }
      return orig(f);
    };
  });
}
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
const camShot = async (page, name, from, at) => {
  await page.evaluate(({ from, at }) => { window.__courtCam = { from, at }; }, { from, at });
  await pumpAll([page], 500);
  await shot(page, name);
  await page.evaluate(() => { window.__courtCam = null; });
};
// the module URLs the game itself imports (same tags, so the same instances)
const modUrl = (page, file) => page.evaluate((file) => {
  const all = performance.getEntriesByType("resource").map((e) => e.name);
  return all.find((u) => u.includes(`/${file}?`)) || null;
}, file);

const A = await open("A", "baller_a");
await join(A);
await pumpAll([A], 5000);

if (want("gear")) {
  const url = await modUrl(A, "maps/grinbeach-courts.js");
  check("the court gear module is loaded", !!url, url || "");
  const g = await A.evaluate(async (url) => {
    const m = await import(url);
    const T = window.__trollOps;
    const spots = T.builtMap().map.rp.courts?.();
    return {
      nets: m.HOOP_NETS.map((n) => !!n.obj?.parent),
      boards: [...m.BOARDS.keys()].map((k) => [k, !!m.BOARDS.get(k).mesh.parent]),
      spots: spots ? Object.keys(spots) : null,
    };
  }, url);
  check("both hoops have their nets", g.nets.length === 2 && g.nets.every(Boolean), JSON.stringify(g.nets));
  check("three scoreboards stand with their slates", g.boards.length === 3 && g.boards.every(([, on]) => on), JSON.stringify(g.boards));
  check("rp.courts() lists hoops, tennis and volleyball", ["hoops", "tennis", "vball"].every((k) => g.spots?.includes(k)), JSON.stringify(g.spots));
  // the balls and the racket load
  const props = await A.evaluate(async () => {
    const all = performance.getEntriesByType("resource").map((e) => e.name);
    const url = all.find((u) => u.includes("/maps/battlefield-props.js?"));
    const { loadModel } = await import(url);
    const T = window.__trollOps;
    const out = {};
    const at = [[47.2, 1.2, -9.2], [47.6, 1.2, -9.2], [48.0, 1.2, -9.2], [48.5, 0.95, -9.2]];
    let i = 0;
    for (const n of ["gb-basketball", "gb-tennisball", "gb-volleyball", "gb-racket"]) {
      try {
        const o = await loadModel(n);
        o.position.set(...at[i++]);
        if (n === "gb-racket") o.rotation.set(0, 0.5, 0.3);
        T.scene.add(o);
        const box = new (o.position.constructor)();
        let r = 0;
        o.traverse((m) => { if (m.isMesh) { m.geometry.computeBoundingSphere(); r = Math.max(r, m.geometry.boundingSphere.radius); } });
        out[n] = +r.toFixed(3);
      } catch (e) { out[n] = String(e.message || e); }
    }
    return out;
  });
  check("the basketball is regulation size", Math.abs(props["gb-basketball"] - 0.12) < 0.01, JSON.stringify(props));
  check("the tennis ball and volleyball load at size", Math.abs(props["gb-tennisball"] - 0.0335) < 0.005 && Math.abs(props["gb-volleyball"] - 0.105) < 0.01);
  check("the racket loads", typeof props["gb-racket"] === "number");
  await camShot(A, "gear-balls", [47.9, 1.45, -8.2], [47.85, 1.1, -9.2]);
  await camShot(A, "gear-hoop", [48.6, 2.6, -14.2], [48, 2.9, -17.4]);
  await camShot(A, "gear-cart-board", [51.5, 1.7, -9.5], [55.6, 1.0, -10]);
  await camShot(A, "gear-tennis", [62, 1.8, 3.5], [60, 0.8, 0]);
  await camShot(A, "gear-tennis-board", [67, 1.8, -1.5], [71.4, 1.3, -1.6]);
  await camShot(A, "gear-vball", [4.5, 1.8, -13.5], [9, 1.0, -15]);
}

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
