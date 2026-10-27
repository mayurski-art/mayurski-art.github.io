// The Barracks: Profile Picture (menu/pfp-studio.js) and the owner's card
// (progression/profile-card.js). Supabase is blocked: the page never joins
// the live public room, and nothing presses a go button.
//   1. The Barracks lists Profile Picture first; it opens PFP Studio
//      (pfp.html) in a frame over the menu, which loads the studio.
//   2. Esc closes it, the Barracks is still the screen, and the game's
//      accounts copy refreshes the profile on the way out (and when the
//      studio reports a change).
//   3. The owner's card has no rank column; the Owner badge sits on the name
//      line in front of the clan tag. A levelled card keeps its rank column.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-barracks-pfp-test.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__toBo2?.fn, null, { timeout: 180000 });

// ---- 1
await page.evaluate(() => { window.__toBo2.menu.backTo("main"); window.__toBo2.menu.go("barracks"); });
await sleep(400);
const first = await page.evaluate(() => document.querySelector(".to-bo2-menu .tr-menu-item")?.textContent.replace(/\s+/g, " ").trim());
check(/^Profile Picture/.test(first || ""), "the Barracks lists Profile Picture first", first);
// count the game's profile refreshes
await page.evaluate(() => {
  const A = window.TrollrunnerAccounts;
  window.__refreshes = 0;
  if (A) { const real = A.refreshProfile; A.refreshProfile = (...a) => { window.__refreshes++; return real?.(...a); }; }
});
await page.evaluate(() => document.querySelector(".to-bo2-menu .tr-menu-item")?.click());
await page.waitForSelector(".to-pfp-studio iframe", { timeout: 5000 }).catch(() => {});
const src = await page.evaluate(() => document.querySelector(".to-pfp-studio iframe")?.getAttribute("src"));
check(src === "pfp.html", "it opens PFP Studio over the menu", src);
const studio = await page.frameLocator(".to-pfp-studio iframe").locator("#btn-save").waitFor({ state: "attached", timeout: 60000 }).then(() => true, () => false);
check(studio, "the studio loads in the frame (its Save as my profile picture button)");
await page.waitForFunction(() => document.querySelector(".to-pfp-studio iframe")?.contentDocument?.readyState === "complete", null, { timeout: 60000 }).catch(() => {});
await sleep(300);
const cover = await page.evaluate(() => { const r = document.querySelector(".to-pfp-studio").getBoundingClientRect(); return r.width === innerWidth && r.height === innerHeight; });
check(cover, "and covers the screen");

// ---- 2: the studio reports a save, then Esc
await page.evaluate(() => document.querySelector(".to-pfp-studio iframe").contentWindow.dispatchEvent(new CustomEvent("trollrunner:auth-changed", { detail: null })));
const afterSave = await page.evaluate(() => window.__refreshes);
check(afterSave >= 1, "a change inside the studio refreshes the game's profile", String(afterSave));
await page.keyboard.press("Escape");
await sleep(300);
const closed = await page.evaluate(() => ({ gone: !document.querySelector(".to-pfp-studio"), screen: window.__toBo2.menu.current(), refreshes: window.__refreshes }));
check(closed.gone && closed.screen === "barracks", "Esc closes it and the Barracks stays", JSON.stringify(closed));
check(closed.refreshes > afterSave, "and the profile refreshes on the way out");

// ---- 3: the cards
const cards = await page.evaluate(async () => {
  // the copy the game loaded (its own ?v= tag), not a second one
  const mod = await import([...performance.getEntriesByType("resource")].map((e) => e.name).find((n) => /progression\/profile-card\.js/.test(n)));
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:0;top:0;width:760px;z-index:2147483600";
  document.body.appendChild(host);
  host.innerHTML = mod.renderCard({ name: "troll_runner", clan: "UMAD", card: null, owner: true, guest: false });
  const o = host.querySelector(".tf-card");
  const id = o.querySelector(".tf-card-id");
  const owner = { rank: !!o.querySelector(".tf-card-rank"), badge: id.firstElementChild?.classList.contains("tf-card-owner"), next: id.children[1]?.className,
    cols: getComputedStyle(o.querySelector(".tf-card-top")).gridTemplateColumns.split(" ").length };
  host.innerHTML = mod.renderCard({ name: "grinlord", clan: "LOL", card: null, level: 34, prestige: 2, owner: false, guest: false });
  const p = host.querySelector(".tf-card");
  const player = { rank: !!p.querySelector(".tf-card-rank"), badge: !!p.querySelector(".tf-card-owner"), cols: getComputedStyle(p.querySelector(".tf-card-top")).gridTemplateColumns.split(" ").length };
  host.remove();
  return { owner, player };
});
check(!cards.owner.rank && cards.owner.cols === 2, "the owner's card has no rank column", JSON.stringify(cards.owner));
check(cards.owner.badge && cards.owner.next === "tf-card-clan", "the Owner badge sits in front of the clan tag");
check(cards.player.rank && !cards.player.badge && cards.player.cols === 3, "a levelled card keeps its rank column", JSON.stringify(cards.player));

check(!errors.length, "no page errors", errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
