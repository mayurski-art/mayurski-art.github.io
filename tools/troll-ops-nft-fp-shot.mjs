// Troll Forces: first person in the TROLLS NFT body (user, 2026-10-12: the
// arms were the stick troll's rods; 2026-10-13 the emotes' too). Test Range, the owner stood in for by
// a cached profile; screenshots of the rifle at rest and aimed, a pistol,
// and the melee, and a check that the blocky arms draw and the rods don't.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-nft-fp-shot.mjs
//   SHOTS_DIR=<dir>; BODY=0 for the stick troll (to compare)
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOTS_DIR || os.tmpdir();
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const body = process.env.BODY === "0" ? "" : "trolls-1718";
await page.addInitScript((body) => {
  localStorage.setItem("trollops:cosmetics", JSON.stringify({ face: "grin:og::rolex-gold", body }));
  const profile = { username: "troll_runner" };
  Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => window.__acct, set: (v) => { window.__acct = v; if (v) v.getCachedProfile = () => profile; } });
}, body);
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
await page.evaluate(async () => {
  if (!window.TrollrunnerAccounts) window.TrollrunnerAccounts = {};
  const T = window.__trollOps;
  T.setMode("range");
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 120000 });
await page.waitForTimeout(2500);
const tag = body ? "nft" : "stick";
const look = () => page.evaluate(() => {
  const T = window.__trollOps;
  const rods = T.pfArms.userData.rods;
  const blocks = T.pfArms.children.filter((c) => c.isMesh && c.geometry.type === "BoxGeometry");
  return { rodsDraw: rods[0].material.visible, rodsOn: rods.map((r) => r.visible), blocksOn: blocks.filter((b) => b.visible).length };
});
let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
let s = await look();
console.log(JSON.stringify(s));
if (body) {
  check(!s.rodsDraw && s.blocksOn >= 2, "the TROLLS body: block arms drawn, rods not", JSON.stringify(s));
} else {
  check(s.rodsDraw && s.blocksOn === 0, "the stick troll: rods, no block arms", JSON.stringify(s));
}
await page.screenshot({ path: path.join(SHOTS, `fp-${tag}-rifle.png`) });
await page.evaluate(() => window.__trollOps.setAds(true));
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(SHOTS, `fp-${tag}-ads.png`) });
await page.evaluate(() => window.__trollOps.setAds(false));
await page.evaluate(() => window.__trollOps.switchWeapon("secondary"));
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(SHOTS, `fp-${tag}-pistol.png`) });
// Emotes (user, 2026-10-13: the NFT body's emotes showed the stick
// figure's hands): the emote arms get block arms too, no stick hands.
await page.evaluate(() => window.__trollOps.switchWeapon("primary"));
// the first-person ones (emotes.js kind "fp"): laugh, L, gun spin, facepalm, Pour up
for (const idx of [6, 7, 8, 9, 16]) {
  await page.evaluate((i) => window.__trollOps.setEmote(i), idx);
  await page.waitForTimeout(900);
  const e = await page.evaluate(async () => {
    const { game } = await import("/assets/games/troll-ops/core/state.js?v=st1");
    const S = game.streakArms;
    if (!S?.visible) return { fp: false };
    const arms = S.userData.arms;
    // the emote's arms, or the gun's (the gun spin keeps the gun arms)
    const box = (root) => root.children.filter((c) => c.isMesh && c.geometry.type === "BoxGeometry" && c.visible).length;
    const blocks = box(S) + (window.__trollOps.pfArms.visible ? box(window.__trollOps.pfArms) : 0);
    return { fp: true, rodsDraw: arms[0].rod.material.visible, hands: arms.filter((a) => a.hand.visible).length, blocks };
  });
  await page.screenshot({ path: path.join(SHOTS, `fp-${tag}-emote${idx}.png`) });
  if (!e.fp) { console.log(`emote ${idx}: third person or no arms`); continue; }
  if (body) check(!e.rodsDraw && e.hands === 0 && e.blocks >= 1, `emote ${idx}: block arms, no stick hands`, JSON.stringify(e));
  else check(e.rodsDraw && e.blocks === 0, `emote ${idx}: the stick troll keeps its arms`, JSON.stringify(e));
  await page.evaluate(() => window.__trollOps.setEmote(-1));
  await page.waitForTimeout(300);
}
check(errors.length === 0, "no page errors", errors.join(" | "));
console.log(fails ? `${fails} FAILED` : "ALL PASS");
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
