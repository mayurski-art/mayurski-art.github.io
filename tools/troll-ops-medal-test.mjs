// Troll Forces medal check: BO2 splash (badge, title, +points), the streak
// ready banner, medal points paid into the score meter + match XP, and the
// after-action medal grid with the medal bonus. Screenshots go to OUT.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-medal-test.mjs
//   OUT=<dir> for screenshots (default: no screenshots).

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
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 30000 });
await sleep(1500);

const before = await page.evaluate(() => ({ xp: window.__trollOps.player.matchXp, score: window.__trollOps.streaks.score }));
await page.evaluate(() => {
  const K = window.__trollOps.killstreakUi;
  K.onKill({ head: true, streak: 1 });
  K.onKill({ head: false, streak: 2 });
  K.medal("Revenge");
});
await sleep(400);
const pops = await page.evaluate(() => [...document.querySelectorAll("#to-ks-badges .to-medal-pop")].map((e) => ({
  name: e.querySelector(".to-medal-name")?.textContent, pts: e.querySelector(".to-medal-pts")?.textContent || "",
  old: e.classList.contains("is-old"), svg: !!e.querySelector("svg path") || e.querySelector(".to-medal-icon img")?.naturalWidth > 0,
  font: getComputedStyle(e.querySelector(".to-medal-name")).fontFamily,
})));
check("splash stacks newest first", pops[0]?.name === "Revenge" && pops.length === 3, JSON.stringify(pops.map((p) => p.name)));
check("older medals shrink", pops[1]?.old && pops[2]?.old && !pops[0]?.old);
check("+points shown", pops[0]?.pts === "+50");
check("badge drawn (art or svg)", pops.every((p) => p.svg));
check("Oswald font", /Oswald/.test(pops[0]?.font || ""), pops[0]?.font);
const after = await page.evaluate(() => ({ xp: window.__trollOps.player.matchXp, score: window.__trollOps.streaks.score }));
// XP pays medals at a tenth (progression.js XP_SCALE); the meter at full value.
check("medal points paid to XP", after.xp - before.xp === 15,`${before.xp} -> ${after.xp}`);
check("medal points paid to score meter", after.score - before.score === 150, `${before.score} -> ${after.score}`);
await shot(page, "1-splash.png");

await page.evaluate(() => {
  const T = window.__trollOps;
  T.killstreakUi.banner({ title: "UAV ready", sub: "Press 4 to call it in", iconSvg: T.streakIconSvg ? T.streakIconSvg("uav") : "" });
});
await sleep(500);
check("streak banner shows", await page.evaluate(() => !!document.querySelector("#to-ks-banner .to-ks-ready-t1")));
await shot(page, "2-banner.png");

await sleep(2600);
check("splash clears itself", await page.evaluate(() => !document.querySelector("#to-ks-badges .to-medal-pop")));

await page.evaluate(() => {
  const K = window.__trollOps.killstreakUi;
  ["Headshot", "Headshot", "Headshot", "Longshot", "First Blood", "Shutdown", "5 Kill Streak", "Avenger", "Triple Kill"].forEach((l) => K.medal(l));
  document.exitPointerLock?.();
  window.__trollOps.endMatch("Trolls win");
});
await sleep(1200);
const aar = await page.evaluate(() => ({
  rows: [...document.querySelectorAll("#to-go-medals .to-go-medal")].map((li) => li.querySelector(".to-go-medal-name").textContent + li.querySelector("b").textContent),
  icons: [...document.querySelectorAll("#to-go-medals .to-go-medal-icon")].filter((i) => i.querySelector("svg") || i.querySelector("img")?.naturalWidth > 0).length,
  bonus: document.querySelector(".to-go-medal-bonus")?.textContent,
  hidden: document.getElementById("to-go-medals").hidden,
}));
check("after-action lists medals with counts", !aar.hidden && aar.rows[0] === "Headshot×4", aar.rows.join(", "));
check("after-action badges", aar.icons === aar.rows.length && aar.icons > 0);
check("medal bonus total", /\+[\d,]+/.test(aar.bonus || ""), aar.bonus);
await shot(page, "3-after-action.png");

check("no page errors", errors.length === 0, errors.join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
