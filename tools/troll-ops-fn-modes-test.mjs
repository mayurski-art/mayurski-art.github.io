// Troll Warfare's lobby, phase 3: the mode tiles (menu/lobby-fn.js; the
// design doc "Troll Warfare Lobby Redesign"). Offline: Supabase is blocked
// and window.supabase is a fake whose presence channel holds the roster the
// test sets (as troll-ops-party-list-test), each with what they're playing.
// Nothing here presses PLAY.
//   1. The Play page has All modes; it opens six tiles, each with its map
//      shot, and the lobby behind steps back.
//   2. The counts come from who's online: Royale 1, Public Match 2 (one in
//      its lobby), Zombies 1, Socialize 1; Solo and Private say what they
//      are; someone in the menu counts nowhere.
//   3. A tile sets the mode card: Royale is Public Match with Royale picked;
//      Public Match takes it back to Team Deathmatch; Socialize is Socialize.
//   4. Scroll down on the Play page opens the tiles, scroll up or Esc closes
//      them; away from Play, no All modes.
//   5. Desktop and phones (sideways, upright): All modes overlaps nothing,
//      the tiles stay on screen; no page errors.
// Screenshots: .claude/run/modes-*.png
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-fn-modes-test.mjs
//   (ANGLE=swiftshader to draw on the CPU while a GPU job runs)
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, ".claude/run");
fs.mkdirSync(SHOTS, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".webm": "video/webm" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  const P = { state: {}, onSync: null };
  window.__presence = {
    set(list) { P.state = Object.fromEntries(list.map((e) => [e.viewerId, [e]])); },
    sync() { P.onSync?.(); },
  };
  const channel = {
    on(type, filter, cb) { if (type === "presence" && filter.event === "sync") P.onSync = cb; return channel; },
    subscribe(cb) { setTimeout(() => cb?.("SUBSCRIBED"), 0); return channel; },
    presenceState: () => P.state,
    send: async () => "ok", track: async () => {}, untrack: async () => {},
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
});
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__toBo2?.fn && !!document.querySelector(".to-fn-allmodes"), null, { timeout: 180000 });
await page.waitForTimeout(1500);

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const uuid = (i) => `00000000-0000-4000-8000-${String(100 + i).padStart(12, "0")}`;
const member = (i, activity) => ({ viewerId: `v-${i}`, userId: uuid(i), username: `player_${i}`, level: 3 + i, trackedAt: "2026-10-27T00:00:00Z", onlineAt: "2026-10-27T00:00:00Z", activity });
const tf = (a) => ({ game: "tf", ...a });
await page.evaluate((list) => { window.__presence.set(list); window.__presence.sync(); }, [
  member(1, tf({ state: "match", mode: "royale", modeName: "Troll Royale", room: "QROY", pub: true })),
  member(2, tf({ state: "match", mode: "tdm", modeName: "Team Deathmatch", room: "QTDM", pub: true })),
  member(3, tf({ state: "lobby", mode: "tdm" })),
  member(4, tf({ state: "zombies", mode: "zombies", modeName: "Zombies", room: "ZRUN1", pub: true })),
  member(5, tf({ state: "match", mode: "social", modeName: "Socialize", room: "QSOC", pub: true })),
  member(6, tf({ state: "match", mode: "ops", modeName: "Ops", room: null })),
  member(7, tf({ state: "menu" })),
]);
await page.waitForTimeout(400);

const vis = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && !!e.offsetParent && getComputedStyle(e).visibility !== "hidden"; }, sel);
const box = (sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.offsetParent && getComputedStyle(e).visibility !== "hidden").map((e) => { const r = e.getBoundingClientRect(); return { sel: s, l: r.left, t: r.top, r: r.right, b: r.bottom }; }), sel);
const hit = (a, b) => a.l < b.r - 1 && a.r > b.l + 1 && a.t < b.b - 1 && a.b > b.t + 1;
const tiles = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll(".to-fn-tile")].map((b) => [b.dataset.tile, { n: b.querySelector(".to-fn-tile-n").textContent.trim(), on: b.classList.contains("is-on"), img: !!b.querySelector("img").getAttribute("src") }])));
const card = () => page.evaluate(() => ({ name: document.querySelector(".to-fn-mode-name")?.textContent, sub: document.querySelector(".to-fn-mode-sub")?.textContent, pl: window.__toBo2.fn.playlist(), open: !document.querySelector(".to-fn-modes").hidden }));
const overlaps = async (w, h) => {
  const me = (await box(".to-fn-allmodes"))[0];
  if (!me) return { shown: false };
  const others = (await Promise.all([".to-bo2-online", ".to-char-emote", ".to-bo2-chat", ".to-fn-play", ".to-fn-left", ".to-bo2-party", ".to-stage-tag", ".to-stage-add", ".to-stage-bubble"].map(box))).flat();
  const under = others.filter((o) => hit(me, o)).map((o) => o.sel);
  return { shown: true, under, inside: me.l >= 0 && me.r <= w && me.b <= h };
};

// 1. All modes on the Play page
await page.evaluate(() => window.__toBo2.fn.setPlaylist("public"));
check(await vis(".to-fn-allmodes"), "the Play page has All modes");
let o = await overlaps(1280, 720);
check(o.shown && o.inside && !o.under.length, "desktop: All modes overlaps nothing", JSON.stringify(o));
await page.screenshot({ path: path.join(SHOTS, "modes-desktop-lobby.png") });
await page.click(".to-fn-allmodes");
await page.waitForTimeout(800);
let t = await tiles();
check(Object.keys(t).join() === "royale,public,zombies,social,solo,private", "six tiles", Object.keys(t).join());
check(Object.values(t).every((x) => x.img), "each with its map shot");
check(!(await vis(".to-fn-play")) && !(await vis(".to-fn-left")), "the lobby behind steps back");

// 2. counts
check(t.royale.n === "1 playing" && t.public.n === "2 playing" && t.zombies.n === "1 playing" && t.social.n === "1 playing", "counts from who's online", JSON.stringify(t));
check(t.solo.n === "Just you" && t.private.n === "Room code", "Solo and Private say what they are");
check(t.public.on && !t.royale.on, "Public Match is the one picked");
const tb = await box(".to-fn-tile"), nb = await box(".to-fn-tile-n");
check(tb.length === 6 && tb.every((b) => b.l >= 0 && b.r <= 1280) && nb.every((b) => b.b <= 720 - 8), "desktop: every tile and its count on screen, no scrolling", JSON.stringify(nb.map((b) => Math.round(b.b))));
await page.screenshot({ path: path.join(SHOTS, "modes-desktop-tiles.png") });

// 3. a tile sets the mode card
await page.click('.to-fn-tile[data-tile="royale"]');
await page.waitForTimeout(400);
let c = await card();
check(!c.open && c.pl === "public" && /Royale/i.test(c.sub || ""), "Royale: the tiles close, Public Match with Royale", JSON.stringify(c));
await page.click(".to-fn-allmodes");
await page.waitForTimeout(400);
t = await tiles();
check(t.royale.on && !t.public.on, "and the Royale tile is the one picked");
await page.click('.to-fn-tile[data-tile="public"]');
await page.waitForTimeout(400);
c = await card();
check(c.pl === "public" && /Team Deathmatch/.test(c.sub || ""), "Public Match takes it back to Team Deathmatch", JSON.stringify(c));
await page.click(".to-fn-allmodes");
await page.waitForTimeout(400);
await page.click('.to-fn-tile[data-tile="social"]');
await page.waitForTimeout(400);
c = await card();
check(c.pl === "social" && c.name === "Socialize", "Socialize sets Socialize", JSON.stringify(c));
check(await page.evaluate(() => window.__trollOps.state()) === "menu", "and nothing starts");

// 4. scroll and Esc
await page.mouse.move(640, 400);
await page.mouse.wheel(0, 300);
await page.waitForTimeout(400);
check((await card()).open, "scroll down opens the tiles");
await page.mouse.move(640, 650);
await page.mouse.wheel(0, -300);
await page.waitForTimeout(400);
check(!(await card()).open, "scroll up closes them");
await page.click(".to-fn-allmodes");
await page.waitForTimeout(300);
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
check(!(await card()).open && (await page.evaluate(() => window.__toBo2.menu.current())) === "main", "Esc closes them, still on Play");
await page.click('.to-fn-tab[data-tab="locker"]');
await page.waitForTimeout(500);
check(!(await vis(".to-fn-allmodes")), "away from Play: no All modes");
await page.mouse.wheel(0, 300);
await page.waitForTimeout(300);
check(!(await card()).open, "and scrolling there doesn't open the tiles");
await page.click('.to-fn-tab[data-tab="play"]');
await page.waitForTimeout(500);

// 5. phones
for (const [w, h, name] of [[844, 390, "land"], [390, 844, "up"]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(700);
  o = await overlaps(w, h);
  check(o.shown && o.inside && !o.under.length, `phone ${w}x${h}: All modes overlaps nothing`, JSON.stringify(o));
  await page.screenshot({ path: path.join(SHOTS, `modes-phone-${name}-lobby.png`) });
  await page.click(".to-fn-allmodes");
  await page.waitForTimeout(600);
  const sheet = (await box(".to-fn-modes"))[0];
  // (the row opens scrolled to the picked tile)
  const picked = (await box(".to-fn-tile.is-on"))[0];
  check(!!sheet && sheet.l >= 0 && sheet.r <= w + 0.5 && sheet.b <= h + 0.5 && picked && picked.l >= 0 && picked.r <= w && picked.b <= h, `phone ${w}x${h}: the tiles on screen, the picked one in view`, JSON.stringify({ sheet, picked }));
  await page.screenshot({ path: path.join(SHOTS, `modes-phone-${name}-tiles.png`) });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}

check(errors.length === 0, "no page errors", errors.join(" | "));
console.log(fails ? `${fails} FAILED` : "ALL PASS");
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
