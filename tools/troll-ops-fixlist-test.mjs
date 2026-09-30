// The 2026-09-30 fix list: no select/drag anywhere, emote wheel press-to-open
// + X to play (in a match and on the menu's operator), map vote previews.
// Saves two screenshots (menu wheel, vote cards) to SHOT_DIR if set.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-fixlist-test.mjs

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

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOT = process.env.SHOT_DIR;

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
await sleep(2500);

// ---- nothing selects or drags
const sel = await page.evaluate(() => {
  const img = document.querySelector("img") || document.body.appendChild(Object.assign(document.createElement("img"), { src: "assets/games/troll-ops/ui/maps/grinsite.jpg" }));
  const ev = new DragEvent("dragstart", { bubbles: true, cancelable: true });
  img.dispatchEvent(ev);
  const input = document.querySelector("input[type=text], input:not([type])");
  const selEv = new Event("selectstart", { bubbles: true, cancelable: true });
  document.querySelector(".to-title")?.dispatchEvent(selEv);
  return {
    body: getComputedStyle(document.body).userSelect || getComputedStyle(document.body).webkitUserSelect,
    title: getComputedStyle(document.querySelector(".to-title")).userSelect,
    input: input ? getComputedStyle(input).userSelect : "text",
    drag: ev.defaultPrevented, select: selEv.defaultPrevented,
  };
});
check("nothing selects or drags; typing fields still select", sel.body === "none" && sel.title === "none" && sel.input !== "none" && sel.drag && sel.select, JSON.stringify(sel));

// ---- menu: emote on the operator
await page.click("#to-char-emote");
let m = await page.evaluate(() => ({ open: window.__trollOps.menuEmoteWheel.isOpen }));
check("menu Emote button opens the wheel", m.open);
await page.hover(".to-emote-wheel.is-menu .to-emote-slice[data-slot='3']");
await page.keyboard.press("KeyX");
await sleep(300);
m = await page.evaluate(() => { const T = window.__trollOps; return { open: T.menuEmoteWheel.isOpen, emote: T.charInspector.emote?.code || 0 }; });
check("hover + X plays it on the menu operator", !m.open && m.emote === 4, JSON.stringify(m));
await page.keyboard.press("KeyH");
m = await page.evaluate(() => window.__trollOps.menuEmoteWheel.isOpen);
check("H opens the wheel in the menu", m);
if (SHOT) await page.screenshot({ path: `${SHOT}/menu-wheel.png` });
await page.keyboard.press("KeyH");
m = await page.evaluate(() => window.__trollOps.menuEmoteWheel.isOpen);
check("H again closes it", !m);
await sleep(1500);

// ---- in a match: H toggles, X plays
await page.evaluate(async () => { const T = window.__trollOps; T.setMode("tdm"); if (T.els.noBots) T.els.noBots.checked = true; await T.startGame(); if (T.isStaging()) T.endStaging(); });
await page.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 90000 });
await sleep(1000);
await page.keyboard.press("KeyH");
let g = await page.evaluate(() => window.__trollOps.emoteWheel.isOpen);
check("in a match, a tap of H opens the wheel (no holding)", g);
await page.evaluate(() => window.__trollOps.emoteWheel.aim(0, -1));   // stick up = slot 0
await page.evaluate(() => window.__trollOps.emoteWheel.aim(0, 0));    // stick springs back
g = await page.evaluate(() => window.__trollOps.emoteWheel.pick);
check("the stick's pick survives it springing back", g === 0, `pick ${g}`);
await page.keyboard.press("KeyX");
g = await page.evaluate(() => { const T = window.__trollOps; return { open: T.emoteWheel.isOpen, emote: T.emote()?.idx ?? null }; });
check("X plays the hovered emote", !g.open && g.emote === 0, JSON.stringify(g));
check("normal look sensitivity off the warship", await page.evaluate(() => window.__trollOps.lookSensScale() === 1));

// ---- map vote previews
const v = await page.evaluate(async () => {
  const T = window.__trollOps;
  T.startIntermission();
  const imgs = [...document.querySelectorAll("#to-vote-list .to-vote-img")];
  await Promise.all(imgs.map((i) => i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })));
  return { cards: document.querySelectorAll("#to-vote-list .to-vote-opt").length, loaded: imgs.filter((i) => i.naturalWidth > 0).length };
});
check("vote cards show a real preview of each map", v.cards >= 2 && v.loaded === v.cards, JSON.stringify(v));
if (SHOT) {
  await page.evaluate(() => { const T = window.__trollOps; T.endMatch?.("Preview"); });
  await sleep(800);
  await page.evaluate(() => window.__trollOps.startIntermission());
  await sleep(600);
  await page.screenshot({ path: `${SHOT}/vote.png` });
}

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
