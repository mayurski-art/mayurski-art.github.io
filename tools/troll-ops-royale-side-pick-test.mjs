// Troll Royale: you pick the side you start on, the default Trollface
// Island or Halloween Hollowgrin (modes/royale-side.js; user, 2026-10-28).
//   1. With Royale picked, Public Match's screen has an Island row, on the
//      default to start with; selecting it turns it to Hollowgrin (Halloween).
//   2. The pick is kept, and the Play page's card names it, with its
//      picture; tapping the card switches the side too.
//   3. A match (a private room, no bots) starts on Hollowgrin.
//   4. After a reload it's still Hollowgrin; selecting it again goes back.
// Supabase is blocked; nothing joins the public room.
//
// SHOTS=<dir> saves the screen with the row on Hollowgrin, and the Play card.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-royale-side-pick-test.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${what}${extra ? `  (${extra})` : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const SHOTS = process.env.SHOTS;
const shot = async (name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + ".png") }); } };

const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
async function load() {
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps && !!window.__toBo2?.fn, null, { timeout: 180000 });
  await sleep(600);
}
// Royale on, Public Match's screen open; the Island row's text
const islandRow = () => page.evaluate(async () => {
  document.querySelector('#to-lo-mode [data-mode="royale"]')?.click();
  window.__toBo2.menu.go("public");
  await new Promise((r) => setTimeout(r, 300));
  const row = [...document.querySelectorAll(".to-bo2-menu *")].find((e) => e.children.length < 6 && /^\s*Island/.test(e.textContent) && /\((Default|Halloween)\)/.test(e.textContent));
  return row ? row.textContent.replace(/\s+/g, " ").trim() : null;
});
const pickRow = () => page.evaluate(() => {
  const els = [...document.querySelectorAll(".to-bo2-menu button, .to-bo2-menu [role=button], .to-bo2-menu li, .to-bo2-menu [data-id]")];
  const row = els.find((e) => /Island/.test(e.textContent) && /\((Default|Halloween)\)/.test(e.textContent));
  row?.click();
  return !!row;
});
const playCard = () => page.evaluate(async () => {
  document.querySelector('.to-fn-tab[data-tab="play"]')?.click();
  await new Promise((r) => setTimeout(r, 300));
  const m = document.querySelector(".to-fn-map");
  return { name: m?.querySelector("strong")?.textContent, sub: m?.querySelector("span")?.textContent, shot: m?.querySelector("img")?.dataset.map };
});

await load();
// ---- 1
const r0 = await islandRow();
check(!!r0 && /Trollface Island \(Default\)/.test(r0), "Public Match has an Island row, on the default island", r0);
check(await pickRow(), "the row can be selected");
await sleep(300);
const r1 = await islandRow();
check(/Hollowgrin \(Halloween\)/.test(r1 || ""), "selecting it turns it to Hollowgrin (Halloween)", r1);
await shot("side-row");
// ---- 2
check(await page.evaluate(() => localStorage.getItem("trollops:royaleSide")) === "hollowgrin", "the pick is kept");
const card = await playCard();
await sleep(800);
await shot("side-card");
// tapping the card switches the side too
await page.click(".to-fn-map.is-side");
await sleep(300);
const tapped = await page.evaluate(() => [document.querySelector(".to-fn-map strong")?.textContent, localStorage.getItem("trollops:royaleSide")]);
await page.click(".to-fn-map.is-side");
await sleep(300);
const back = await page.evaluate(() => [document.querySelector(".to-fn-map strong")?.textContent, localStorage.getItem("trollops:royaleSide")]);
check(tapped[0] === "Trollface Island" && tapped[1] === "trollface" && back[0] === "Hollowgrin" && back[1] === "hollowgrin", "tapping the card switches the side, and back", JSON.stringify([tapped, back]));
check(card.name === "Hollowgrin" && /Halloween/.test(card.sub) && card.shot === "hollowgrin", "the Play card names it, with its picture", JSON.stringify(card));
// ---- 3
await page.evaluate(async (room) => {
  const T = window.__trollOps;
  T.DROP.enabled = false;
  T.setMode("royale");
  T.els.noBots.checked = true;
  T.els.room.value = room;              // never the public room
  T.els.room.dispatchEvent(new Event("input"));
  await T.startGame();
}, "SIDE" + Math.floor(Math.random() * 900 + 100));
await page.waitForFunction(() => window.__trollOps.builtMap()?.map && !window.__trollOps.loadState().open, null, { timeout: 240000 });
const played = await page.evaluate(() => window.__trollOps.loadedMapId?.() ?? window.__trollOps.builtMap().map.name);
check(/hollowgrin/i.test(played), "the match starts on Hollowgrin", played);
// ---- 4
await load();
const r2 = await islandRow();
check(/Hollowgrin \(Halloween\)/.test(r2 || ""), "after a reload it's still Hollowgrin", r2);
await pickRow();
await sleep(300);
const r3 = await islandRow();
check(/Trollface Island \(Default\)/.test(r3 || ""), "selecting it again goes back to the default", r3);
check(errors.length === 0, "no page errors", errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
