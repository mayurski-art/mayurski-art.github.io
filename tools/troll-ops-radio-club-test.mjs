// Troll Forces: the radio's button is the main menu's only; in a match M
// still opens the radio, except in Kabukigrin Socialize, where the radio is
// off (the club's DJ has the music) and comes back once you've left.
// Private (Supabase blocked), no public room.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-radio-club-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".svg": "image/svg+xml" };
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

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 480000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 480000 });
await page.waitForFunction(() => !document.body.classList.contains("tf-booting"), null, { timeout: 60000 }).catch(() => {});
await page.evaluate(() => window.__trollOps.setLoadWaitMax(8));
const pump = async (ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) await page.screenshot({ type: "jpeg", quality: 10 }); };
const shown = () => page.evaluate(() => !!document.getElementById("to-radio-toggle").getClientRects().length);
const panelOpen = () => page.evaluate(() => !document.getElementById("to-radio-panel").hidden);
const closePanel = () => page.evaluate(() => { const p = document.getElementById("to-radio-panel"); if (!p.hidden) document.getElementById("to-radio-toggle").click(); });
async function start(mode, map) {
  await page.evaluate(async ({ mode, map }) => {
    const T = window.__trollOps;
    T.setMode(mode); T.loadout.mapId = map;
    await T.startGame();
    if (T.isStaging?.()) T.endStaging();
  }, { mode, map });
  await page.waitForFunction(() => !window.__trollOps.loadState().open, null, { timeout: 480000 });
  await pump(1500);
  await page.evaluate(() => { window.__trollOps.els.pause.hidden = true; });
}
async function toMenu() {
  await page.evaluate(() => window.__trollOps.els.quitBtn.click());
  await pump(800);
}
// a fake "playing" radio (no audio file needed): the club check reads music.playing
const fakePlay = () => page.evaluate(() => { const m = window.__trollOps.music; m.play = function () { this.playing = true; this._notify?.(); }; m.play(); });

check("the main menu shows the radio button", await shown());

await start("tdm", "kabukigrin");
check("in a match the button's gone", !(await shown()));
await page.keyboard.press("m");
await pump(300);
check("...and M still opens the radio (Kabukigrin, not Socialize)", await panelOpen());
await page.keyboard.press("m");
await pump(300);
await closePanel();
await toMenu();

await start("social", "grinbeach");
await page.keyboard.press("m");
await pump(300);
check("another Socialize map: M opens the radio", await panelOpen());
await closePanel();
await toMenu();
check("back on the menu the button's back", await shown());

await fakePlay();
await start("social", "kabukigrin");
await pump(1200);
check("Kabukigrin Socialize: the radio pauses", !(await page.evaluate(() => window.__trollOps.music.playing)));
await page.keyboard.press("m");
await pump(300);
check("...and M doesn't open it", !(await panelOpen()));
check("...no button either", !(await shown()));
await toMenu();
await pump(1200);
check("out again: it plays on", await page.evaluate(() => window.__trollOps.music.playing));

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
