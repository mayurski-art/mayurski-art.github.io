// Troll Forces Knuckle Grinners check: equips as a pair with a hand anchor on each fist,
// swings alternate a left jab and a right hook (each fist moves on its own beat),
// the inspect cracks and shows the plates. Screenshots of the guard, both punches
// and the inspect beats go to OUT (the rod arms).
//
// Usage: NODE_PATH=<main checkout>/node_modules OUT=<dir> node tools/troll-ops-knuckles-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.OUT || "";
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
const shot = async (page, name) => { if (OUT) await page.screenshot({ path: path.join(OUT, name) }); };
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`);
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.loadout.meleeId = "knuckles";
  T.loadout.mapId = "trollcity";
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 30000 });
await page.waitForFunction(() => !window.__trollOps.isStaging(), null, { timeout: 30000 });
await page.evaluate(() => {
  const T = window.__trollOps;
  T.breakSpawnGuard();
  T.player.maxHp = T.player.hp = 1e9;
  T.look.pitch = -0.05;
  T.setHolding("melee");
});
await sleep(1500);

const info = await page.evaluate(() => {
  const T = window.__trollOps, m = T.activeMeleeMesh();
  return { id: T.player.melee?.def.id, kind: m?.userData.kind, fists: m?.userData.knuckles?.fists.length, anchors: m?.children.filter((c) => c.userData.hand).length, visible: m?.visible };
});
check("Knuckle Grinners in hand, a fist and an anchor each side", info.id === "knuckles" && info.kind === "knuckles" && info.fists === 2 && info.anchors === 2 && info.visible, JSON.stringify(info));

{
  const tag = "rods";
  await sleep(400);
  await shot(page, `${tag}-0-guard.png`);
  // two punches: which fist goes out on each
  const moved = await page.evaluate(async () => {
    const T = window.__trollOps, m = T.activeMeleeMesh(), K = m.userData.knuckles;
    const out = [];
    for (let s = 0; s < 2; s++) {
      while (T.player.melee.busy) await new Promise((r) => setTimeout(r, 20));
      const rest = K.fists.map((f) => f.position.z);
      T.swingMelee();
      let far = [0, 0];
      for (let i = 0; i < 25; i++) {
        await new Promise((r) => setTimeout(r, 16));
        K.fists.forEach((f, j) => { far[j] = Math.min(far[j], f.position.z - rest[j]); });
      }
      out.push(far.map((v) => +v.toFixed(3)));
    }
    return out;
  });
  check("the first swing is a left jab (left fist goes out)", moved[0][1] < -0.2 && moved[0][0] > -0.08, JSON.stringify(moved));
  check("the second swing is a right hook (right fist goes out)", moved[1][0] < -0.12, JSON.stringify(moved));
  await sleep(600);
  // frozen beats of each punch
  for (const [idx, t, name] of [[0, 0.13, "jab"], [1, 0.22, "hook"]]) {
    await page.evaluate(([idx, t]) => { const M = window.__trollOps.player.melee; M.swingIndex = idx; M.landed = true; M.t = t; }, [idx, t]);
    await sleep(20);
    await page.evaluate(([idx, t]) => { const M = window.__trollOps.player.melee; M.swingIndex = idx; M.t = t; }, [idx, t]);
    await shot(page, `${tag}-1-${name}.png`);
    await sleep(700);
  }
  await page.evaluate(() => window.__trollOps.startInspect());
  await sleep(100);
  for (const [t, name] of [[0.18, "together"], [0.3, "crack"], [0.6, "plates"]]) {
    await page.evaluate((v) => window.__trollOps.setInspectFreeze(v), t);
    await sleep(250);
    await shot(page, `${tag}-2-inspect-${Math.round(t * 100)}-${name}.png`);
  }
  await page.evaluate(() => window.__trollOps.setInspectFreeze(null));
  await sleep(3800);
}
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
