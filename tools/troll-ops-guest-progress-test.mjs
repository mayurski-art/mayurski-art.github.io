// Guests keep nothing (user, 2026-10-01: "remove progress being saved for
// guest accounts"): a guest's XP and level last the session and nothing is
// stored or queued for a later sign-in; achievements aren't saved either.
// A signed-in player (a stored session) still queues XP for the account.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-guest-progress-test.mjs

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
const URL0 = `http://localhost:${server.address().port}/troll-ops.html?tohooks=1`;

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext();
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const boot = async () => { await page.goto(URL0); await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 }); };

// An old saved guest total from before this change.
await boot();
await page.evaluate(() => { localStorage.removeItem("trollrunner-accounts-auth"); localStorage.setItem("trollops:xp", "50000"); localStorage.removeItem("trollops:xp-pending"); localStorage.removeItem("trollops:achievements"); });
await boot();
const g1 = await page.evaluate(async () => {
  const p = await import("/assets/games/troll-ops/progression.js?v=gu1");
  const old = localStorage.getItem("trollops:xp");
  const before = p.getXp();
  p.addXp(700);
  return { old, before, after: p.getXp(), rank: p.getRank(), pending: localStorage.getItem("trollops:xp-pending"), stored: localStorage.getItem("trollops:xp"), signed: p.isSignedIn() };
});
check("a guest is a guest", g1.signed === false, JSON.stringify(g1));
check("the old saved guest total is gone", g1.old === null && g1.before === 0, JSON.stringify(g1));
check("a guest levels up for the session", g1.after === 700 && g1.rank > 1, JSON.stringify(g1));
check("nothing of it is stored or queued", g1.stored === null && !(Number(g1.pending) > 0), JSON.stringify(g1));
await boot();
const g2 = await page.evaluate(async () => { const p = await import("/assets/games/troll-ops/progression.js?v=gu1"); return { xp: p.getXp(), rank: p.getRank() }; });
check("reload: back to level 1", g2.xp === 0 && g2.rank === 1, JSON.stringify(g2));
const ach = await page.evaluate(async () => {
  const { Achievements } = await import("/assets/games/troll-ops/achievements.js?v=gu1");
  const a = new Achievements();
  a.award("flawless");
  const keys = Object.keys(localStorage).filter((k) => /achiev/i.test(k));
  return { keys, vals: keys.map((k) => localStorage.getItem(k)) };
});
check("a guest's achievements aren't saved", ach.vals.every((v) => !v || !v.includes("flawless")), JSON.stringify(ach));

// Signed in (a stored session; the profile may still be loading): XP queues.
await page.evaluate(() => localStorage.setItem("trollrunner-accounts-auth", "{\"access_token\":\"x\"}"));
await boot();
const s1 = await page.evaluate(async () => {
  const p = await import("/assets/games/troll-ops/progression.js?v=gu1");
  p.addXp(300);
  return { signed: p.isSignedIn(), pending: Number(localStorage.getItem("trollops:xp-pending")) };
});
check("signed in, XP is queued for the account", s1.signed && s1.pending >= 300, JSON.stringify(s1));
await page.evaluate(() => { localStorage.removeItem("trollrunner-accounts-auth"); localStorage.removeItem("trollops:xp-pending"); });
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
