// A kill shows Fortnite's callout, ELIMINATED and who, under the crosshair
// (user: "make it look like fornite including changing the text"), and the
// XP it paid is bare text at the lower centre (user: "the xp earned can be
// like i said earlier on the lower center of the screen"). The XP still banks.
//
// One TDM match in a private room (Supabase blocked): a kill and an assist's
// XP, then what's on screen and where.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-elim-callout-test.mjs
// SHOT=<png> saves the screen with both up; BURST=<dir> frames of the XP's burst.

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

const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });
const errors = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route(/supabase/, (r) => r.abort());
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 120000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  // a private room, never the public one
  T.els.room.value = "EL" + Math.random().toString(36).slice(2, 5).toUpperCase();
  T.els.room.dispatchEvent(new Event("input"));
  T.loadout.mapId = "grinsite";
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 240000 });
await page.evaluate(() => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); });
await page.waitForTimeout(4000);   // past the intro, which hides the HUD
const r = await page.evaluate(async () => {
  const T = window.__trollOps, xp0 = T.player.matchXp;
  T.awardKillXp("Sneaky Troll");
  T.addMatchXp(5, "Assist");
  await new Promise((res) => setTimeout(res, 450));
  const box = (el) => { const b = el?.getBoundingClientRect(); return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height } : null; };
  const elim = document.querySelector("#to-xp-pops .to-elim"), gains = [...document.querySelectorAll("#to-xp-gains .to-xp-gain")];
  const cs = elim ? getComputedStyle(elim) : null;
  return { vw: innerWidth, vh: innerHeight, elimText: elim?.textContent, elimBox: box(elim), elimColor: cs?.color, elimCase: cs?.textTransform,
    gains: gains.map((g) => g.textContent), gainBox: box(gains[0]), gainBg: gains[0] ? getComputedStyle(gains[0]).backgroundColor : null,
    oldPop: !!document.querySelector(".to-xp-pop"), banked: T.player.matchXp - xp0 };
});
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
// The burst as an XP gain lands: frames of the lower centre.
if (process.env.BURST) {
  await page.waitForTimeout(2600);
  await page.evaluate(() => window.__trollOps.addMatchXp(10, "Elimination"));
  for (const ms of [60, 140, 260, 450]) {
    await page.waitForTimeout(ms === 60 ? 60 : ms - [60, 140, 260, 450][[60, 140, 260, 450].indexOf(ms) - 1]);
    await page.screenshot({ path: path.join(process.env.BURST, `burst-${ms}.png`), clip: { x: 540, y: 470, width: 200, height: 120 } });
  }
}
check("a kill: ELIMINATED and the name, white, upper case", /Eliminated\s*Sneaky Troll/i.test(r.elimText || "") && r.elimColor === "rgb(255, 255, 255)" && r.elimCase === "uppercase", JSON.stringify({ t: r.elimText, c: r.elimColor }));
check("...centred just under the crosshair", r.elimBox && Math.abs(r.elimBox.x - r.vw / 2) < 4 && r.elimBox.y > r.vh / 2 && r.elimBox.y < r.vh * 0.6, JSON.stringify(r.elimBox));
check("the XP: bare text, +10 XP Elimination and +5 XP Assist", r.gains.some((g) => /\+10 XP\s*Elimination/.test(g)) && r.gains.some((g) => /\+5 XP\s*Assist/.test(g)) && r.gainBg === "rgba(0, 0, 0, 0)", JSON.stringify({ g: r.gains, bg: r.gainBg }));
check("...at the lower centre", r.gainBox && Math.abs(r.gainBox.x - r.vw / 2) < 4 && r.gainBox.y > r.vh * 0.7, JSON.stringify(r.gainBox));
check("no more green '+10 · KILL'", !r.oldPop);
check("the XP still banks", r.banked === 15, String(r.banked));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
