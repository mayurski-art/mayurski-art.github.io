// Troll Forces: the map vote on a phone is a sheet over the lobby (menu-bo2.js
// voteSheet; user, 2026-10-22: "for the map preview and voting system on
// mobile devices we should have a popup screen", "not needed for desktop",
// "clicking on the map previews itself would be nice"). Offline, as in
// troll-ops-map-vote-test.mjs: Supabase blocked, a fake presence channel,
// Find Match's start button stubbed, so no public room is ever joined.
//   Phone, upright and sideways:
//   1. Public Match opens the sheet over the whole lobby: ×, three maps, the
//      clock, Find Match at the foot; no vote rows in the list.
//   2. A tap on a map is our vote.
//   3. × closes it: the small panel stays by the list, nothing covered.
//   4. A tap on the small panel opens the sheet again.
//   5. Find Match on the sheet goes in on our vote.
//   Desktop: no sheet, the vote rows in the list, the panel in the middle.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-map-vote-sheet-test.mjs
//   SHOTS_DIR=<dir> for the screenshots
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
const read = (page) => page.evaluate(() => {
  const v = document.querySelector(".to-bo2-vote"), r = v.getBoundingClientRect(), m = document.querySelector(".to-bo2-menu").getBoundingClientRect();
  return {
    shown: !v.hidden && !!v.offsetParent, sheet: v.classList.contains("is-sheet"), tap: v.classList.contains("is-tap"),
    box: { l: r.left, t: r.top, r: r.right, b: r.bottom }, menuB: m.bottom, menuR: m.right,
    close: !!v.querySelector(".to-mv-close"), go: v.querySelector(".to-mv-go")?.textContent.trim() || "",
    clock: v.querySelector(".to-mv-clock")?.textContent || "",
    cards: [...v.querySelectorAll(".to-mv-cards li")].map((li) => ({ map: li.dataset.map, mine: li.classList.contains("is-mine") })),
    voteRows: document.querySelectorAll('.tr-menu-item[data-id^="vote-"]').length,
    big: (() => { const i = v.querySelector(".to-mv-big img"); return i && i.offsetParent ? Math.round(i.getBoundingClientRect().height) : 0; })(),
  };
});
// a real tap at the element's middle, so anything drawn over it would take it
const tap = (page, sel) => page.tap(sel);

for (const [w, h] of [[390, 844], [844, 390]]) {
  const tag = `phone ${w}x${h}`;
  const { ctx, page, errors } = await open({ width: w, height: h }, true);
  let s = await read(page);
  // 1
  check(s.shown && s.sheet && s.close && /^Find Match/i.test(s.go) && s.cards.length === 3 && /^0:\d\d$/.test(s.clock), `${tag}: Public Match opens the sheet`, JSON.stringify({ sheet: s.sheet, go: s.go, n: s.cards.length, clock: s.clock }));
  check(s.box.l <= 1 && s.box.t <= 1 && s.box.r >= w - 1 && s.box.b >= h - 1, `${tag}: the sheet covers the lobby`, JSON.stringify(s.box));
  check(s.big > 80, `${tag}: the preview shows big`, `${s.big}px`);
  check(s.voteRows === 0, `${tag}: no vote rows in the list`);
  const radio = await page.evaluate(() => getComputedStyle(document.querySelector(".to-radio")).visibility);
  check(radio === "hidden", `${tag}: the radio's button is off the sheet's ×`, radio);
  await page.screenshot({ path: path.join(SHOTS, `vote-sheet-${w}x${h}.png`) });
  // 2
  const pick = s.cards[1].map;
  await tap(page, `.to-mv-cards li[data-map="${pick}"]`);
  await page.waitForTimeout(300);
  s = await read(page);
  const act = await page.evaluate(() => window.__presence.tracked().at(-1)?.activity || null);
  check(s.sheet && s.cards[1].mine && act?.map === pick, `${tag}: a tap on a map is our vote`, JSON.stringify({ mine: s.cards[1].mine, act: act?.map }));
  // 3
  await tap(page, ".to-mv-close");
  await page.waitForTimeout(300);
  s = await read(page);
  const clear = s.box.t >= s.menuB - 1 || s.box.l >= s.menuR - 1;
  check(s.shown && !s.sheet && s.tap && clear, `${tag}: × closes it, the small panel stays by the list`, JSON.stringify({ sheet: s.sheet, tap: s.tap, box: s.box, menuB: s.menuB, menuR: s.menuR }));
  const desc = await page.evaluate(() => getComputedStyle(document.querySelector(".to-bo2-menu .tr-menu-desc")).display);
  check(desc === "none", `${tag}: no description line under the list`, desc);
  const radioBack = await page.evaluate(() => getComputedStyle(document.querySelector(".to-radio")).visibility);
  check(radioBack === "visible", `${tag}: the radio comes back`, radioBack);
  await page.screenshot({ path: path.join(SHOTS, `vote-panel-${w}x${h}.png`) });
  // 4
  await tap(page, ".to-bo2-vote");
  await page.waitForTimeout(300);
  s = await read(page);
  check(s.sheet && s.cards[1].mine, `${tag}: a tap on the small panel opens the sheet again`);
  // 5
  await tap(page, ".to-mv-go");
  await page.waitForTimeout(300);
  const starts = await page.evaluate(() => window.__starts);
  check(starts.length === 1 && starts[0] === pick, `${tag}: Find Match on the sheet goes in on our vote`, JSON.stringify({ starts, pick }));
  check(errors.length === 0, `${tag}: no page errors`, errors.join(" | "));
  await ctx.close();
}

{
  const { ctx, page, errors } = await open({ width: 1440, height: 860 }, false);
  const s = await read(page);
  check(s.shown && !s.sheet && !s.tap && !s.close && !s.go && s.voteRows === 3, "desktop: no sheet, the vote rows in the list", JSON.stringify({ sheet: s.sheet, tap: s.tap, rows: s.voteRows }));
  check(s.box.l >= s.menuR, "desktop: the panel in the middle, beside the list", JSON.stringify(s.box));
  const desc = await page.evaluate(() => getComputedStyle(document.querySelector(".to-bo2-menu .tr-menu-desc")).display);
  check(desc === "none", "desktop: no description line under the list either", desc);
  const pics = await page.waitForFunction(() => [...document.querySelectorAll(".to-bo2-vote img")].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 }).then(() => true, () => false);
  check(pics, "desktop: the map pictures load");
  await page.screenshot({ path: path.join(SHOTS, "vote-desktop-1440.png") });
  check(errors.length === 0, "desktop: no page errors", errors.join(" | "));
  await ctx.close();
}

console.log(fails ? `${fails} FAILED` : "ALL PASS");
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
