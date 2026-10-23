// Troll Forces menu: a locked row says what unlocks it, under the list
// (bo2-menu.js item.need; user, 2026-10-22: "if the description is that a
// certain level is needed or something then keep that"), while every other
// description stays off screen. A fresh guest is level 1, so the higher
// perks, weapons, scorestreaks and the prestige calling cards are locked.
// Offline, as in troll-ops-map-vote-sheet-test.mjs (Supabase blocked).
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-menu-need-test.mjs
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

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };

// the fake presence channel and Supabase client (troll-ops-map-vote-test.mjs)
function stub() {
  const P = { state: {}, onSync: null, tracked: [] };
  window.__presence = { tracked: () => P.tracked };
  const channel = {
    on(type, filter, cb) { if (type === "presence" && filter.event === "sync") P.onSync = cb; return channel; },
    subscribe(cb) { setTimeout(() => cb("SUBSCRIBED"), 0); return channel; },
    presenceState: () => P.state,
    track: async (p) => { P.tracked.push(JSON.parse(JSON.stringify(p))); }, untrack: async () => {},
    send: async () => {},
  };
  const query = () => new Proxy(function () {}, {
    get: (t, k) => (k === "then" ? (ok) => ok({ data: null, error: null }) : query),
    apply: () => query(),
  });
  const auth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  };
  window.supabase = { createClient: () => ({ channel: () => channel, from: query, rpc: query, auth, removeChannel() {} }) };
}

async function open(viewport, mobile) {
  const ctx = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(stub);
  await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__toBo2 && !!document.querySelector(".to-bo2-party-others"), null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const b = document.getElementById("to-start-btn");
    window.__starts = [];
    b.click = () => window.__starts.push(document.querySelector("#to-lo-maps .to-lo-map.is-active")?.dataset.map || null);
    // on a fresh round, so the shortlist holds for the whole test
    const real = Date.now.bind(Date), skew = 30000 - (real() % 30000) + 500;
    Date.now = () => real() + skew;
  });
  await page.evaluate(() => window.__toBo2.menu.go("public"));
  await page.waitForTimeout(800);
  return { ctx, page, errors };
}

const shown = (page) => page.evaluate(() => {
  const n = document.querySelector(".to-bo2-menu .tr-menu-need"), r = n.getBoundingClientRect(), d = document.querySelector(".to-bo2-menu .tr-menu-desc").getBoundingClientRect();
  return { need: n.textContent, visible: r.width > 1 && r.height > 1 && getComputedStyle(n).display !== "none", descHidden: d.width <= 1 && d.height <= 1 };
});
// highlight the first locked and the first open row on a screen
async function probe(page, screen, tag) {
  await page.evaluate((s) => { window.__toBo2.menu.backTo?.("main"); window.__toBo2.menu.go(s); }, screen);
  await page.waitForTimeout(400);
  // (a locked calling card stays selectable, so it can be previewed: its tag says Locked)
  const rows = await page.evaluate(() => [...document.querySelectorAll(".tr-menu-item")].map((b) => ({ id: b.dataset.id, locked: b.getAttribute("aria-disabled") === "true" || /\bLocked\b/.test(b.querySelector("small")?.textContent || "") })));
  const lock = rows.find((r) => r.locked && r.id !== "back"), open = rows.find((r) => !r.locked && r.id !== "back");
  check(!!lock, `${tag} ${screen}: has a locked row`, JSON.stringify(rows.slice(0, 4)));
  if (lock) {
    await page.evaluate((id) => window.__toBo2.menu.highlight(id), lock.id);
    const s = await shown(page);
    check(s.visible && /^(Unlocks at|Sign in|For the holder|Off while)/.test(s.need) && s.descHidden, `${tag} ${screen}: a locked row shows what unlocks it`, JSON.stringify(s));
  }
  if (open) {
    await page.evaluate((id) => window.__toBo2.menu.highlight(id), open.id);
    const s = await shown(page);
    check(!s.visible && !s.need && s.descHidden, `${tag} ${screen}: an open row shows nothing under the list`, JSON.stringify(s));
  }
}
for (const [vp, mob, tag] of [[{ width: 1440, height: 860 }, false, "desktop"], [{ width: 390, height: 844 }, true, "phone"]]) {
  const { ctx, page, errors } = await open(vp, mob);
  for (const screen of ["perk-0", "weapons", "streaks", "cards"]) await probe(page, screen, tag);
  await page.evaluate(() => window.__toBo2.menu.backTo?.("main"));
  await page.waitForTimeout(300);
  const top = await shown(page);
  check(!top.visible, `${tag} main menu: nothing under the list`, JSON.stringify(top));
  check(errors.length === 0, `${tag}: no page errors`, errors.join(" | "));
  await ctx.close();
}
console.log(fails ? `${fails} FAILED` : "ALL PASS");
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
