// Troll Forces exit links test: trollrunner.net/trollnite (trollnite/index.html, and the old /warfare and /tf) lands on
// the game, and trollrunner.net/royale (royale/index.html) on it with Troll Royale picked;
// opened from the arcade (games.html's full-screen frame), the
// game's Arcade link closes the frame instead of loading the arcade inside
// it; the pause menu and game-over buttons go to the game's own home.
// Supabase is blocked: the page must never join the live public room.
//
// Usage: node tools/troll-ops-exit-links-test.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg", ".svg": "image/svg+xml", ".gif": "image/gif", ".avif": "image/avif" };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (p.startsWith(ROOT) && fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };

const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.route(/supabase/, (r) => r.abort());
const errors = [];

// 1. /trollnite/ (and the old /warfare/ and /tf/) bounce to the game.
const old = await ctx.newPage();
await old.goto(`${BASE}/tf/?room=x`, { waitUntil: "domcontentloaded", timeout: 120000 });
await old.waitForURL(/troll-ops\.html/, { timeout: 30000 });
check("old /tf still lands on the game, keeping ?room=", /\/troll-ops\.html\?room=x$/.test(old.url()), old.url());
await old.close();
const oldW = await ctx.newPage();
await oldW.goto(`${BASE}/warfare/?room=w`, { waitUntil: "domcontentloaded", timeout: 120000 });
await oldW.waitForURL(/troll-ops\.html/, { timeout: 30000 });
check("old /warfare still lands on the game, keeping ?room=", /\/troll-ops\.html\?room=w$/.test(oldW.url()), oldW.url());
await oldW.close();
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/trollnite/`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForURL(/troll-ops\.html/, { timeout: 30000 });
await page.waitForFunction(() => !!document.getElementById("to-title"), null, { timeout: 120000 });
check("/trollnite lands on the game", /\/troll-ops\.html$/.test(new URL(page.url()).pathname), page.url());

// 1b. /royale/ lands on the game with Troll Royale picked in the mode list.
const roy = await ctx.newPage();
roy.on("pageerror", (e) => errors.push(e.message));
await roy.goto(`${BASE}/royale/?room=y`, { waitUntil: "domcontentloaded", timeout: 120000 });
await roy.waitForURL(/troll-ops\.html/, { timeout: 30000 });
check("/royale lands on the game with ?mode=royale, keeping ?room=", /\/troll-ops\.html\?mode=royale&room=y$/.test(roy.url()), roy.url());
await roy.waitForFunction(() => !!document.querySelector('#to-lo-mode [data-mode="royale"]'), null, { timeout: 120000 });
const picked = await roy.evaluate(() => ({ on: document.querySelector('#to-lo-mode [data-mode="royale"]').classList.contains("is-active"), start: !document.getElementById("to-start-btn")?.disabled }));
check("/royale starts with Troll Royale picked", picked.on, JSON.stringify(picked));
await roy.close();

// 2. The home buttons.
const homes = await page.evaluate(() => ["to-exit-btn", "to-go-home-btn"].map((id) => {
  const a = document.getElementById(id);
  return a ? [a.getAttribute("href"), a.textContent.trim()] : null;
}));
check("pause menu exit goes to the game's home", homes[0]?.[0] === "troll-ops.html" && /Trollnite home/.test(homes[0][1]), JSON.stringify(homes[0]));
check("game-over button goes to the game's home", homes[1]?.[0] === "troll-ops.html" && /Trollnite home/.test(homes[1][1]), JSON.stringify(homes[1]));
check("no arcade links left in the pause/game-over screens",
  await page.evaluate(() => !document.querySelector('#to-pause a[href="games.html"], #to-gameover a[href="games.html"]')));
await page.close();

// 3. From the arcade: the game's Arcade link closes the full-screen frame.
const arc = await ctx.newPage();
arc.on("pageerror", (e) => errors.push(e.message));
await arc.goto(`${BASE}/games.html`, { waitUntil: "domcontentloaded", timeout: 120000 });
await arc.click('a.hub-card-play[href="troll-ops.html"]');
await arc.waitForFunction(() => location.hash === "#play" && !!document.querySelector("iframe"), null, { timeout: 30000 });
const frame = await (await arc.waitForSelector("iframe")).contentFrame();
await frame.waitForFunction(() => !!document.querySelector(".to-pf-arcade") && !!window.__toBo2, null, { timeout: 120000 });
check("the game in the arcade frame keeps its real address", /troll-ops\.html/.test(frame.url()), frame.url());
await frame.evaluate(() => document.querySelector(".to-pf-arcade").click());
await arc.waitForTimeout(800);
const after = await arc.evaluate(() => ({ iframes: document.querySelectorAll("iframe").length, hash: location.hash, path: location.pathname }));
check("Arcade closes the frame (no arcade inside the game)", after.iframes === 0 && after.hash === "" && after.path.endsWith("/games.html"), JSON.stringify(after));

// The BO2 menu's Arcade row does the same.
await arc.click('a.hub-card-play[href="troll-ops.html"]');
const frame2 = await (await arc.waitForSelector("iframe")).contentFrame();
await frame2.waitForFunction(() => !!window.__toBo2, null, { timeout: 120000 });
await frame2.evaluate(() => { const m = window.__toBo2.menu; m.highlight?.("arcade"); [...document.querySelectorAll(".tr-menu-item")].find((b) => /^Arcade/i.test(b.textContent.trim()))?.click(); });
await arc.waitForTimeout(800);
const after2 = await arc.evaluate(() => ({ iframes: document.querySelectorAll("iframe").length, hash: location.hash }));
check("the menu's Arcade row closes the frame too", after2.iframes === 0 && after2.hash === "", JSON.stringify(after2));
await arc.close();

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `EXIT LINKS RED: ${failures} failed` : "EXIT LINKS GREEN");
process.exit(failures ? 1 : 0);
