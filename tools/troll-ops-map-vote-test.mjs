// Troll Forces: the pre-match map vote (menu/map-vote.js, menu-bo2.js's
// Public Match lobby; user, 2026-10-22). Offline: Supabase is blocked and
// window.supabase is a fake whose presence channel holds whatever roster the
// test sets (as in troll-ops-party-list-test.mjs) and records what we track.
// Find Match's start button is stubbed, so no match ever starts and no
// public room is ever joined.
//   1. Public Match shows the vote in the middle: three maps, a clock.
//   2. Others' votes count; ours goes on the wire (state "lobby").
//   3. With others in the lobby Find Match readies up; when the round ends
//      we go in on the winner.
//   4. A public room with a match on: no vote, Join Match.
//   5. Alone: Find Match goes straight in on our vote.
//   6. Leaving the screen leaves the lobby.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-map-vote-test.mjs
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
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 } });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  const P = { state: {}, onSync: null, tracked: [] };
  window.__presence = {
    set(list) { P.state = Object.fromEntries(list.map((e) => [e.viewerId, [e]])); },
    sync() { P.onSync?.(); },
    tracked: () => P.tracked,
  };
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
  // a clock the test can wind on, to end a vote round
  const real = Date.now.bind(Date);
  window.__skew = 0;
  Date.now = () => real() + window.__skew;
});
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__toBo2 && !!document.querySelector(".to-bo2-party-others"), null, { timeout: 120000 });
await page.waitForTimeout(1500);

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const roster = (list) => page.evaluate((list) => { window.__presence.set(list); window.__presence.sync(); }, list);
const member = (i, activity) => ({ viewerId: `v-${i}`, userId: `00000000-0000-4000-8000-${String(100 + i).padStart(12, "0")}`, username: `player_${i}`, level: 5, trackedAt: "2026-10-22T00:00:00Z", onlineAt: "2026-10-22T00:00:00Z", activity });
// Find Match's start button, stubbed: what map was picked when it was pressed
await page.evaluate(() => {
  const b = document.getElementById("to-start-btn");
  window.__starts = [];
  b.click = () => window.__starts.push(document.querySelector("#to-lo-maps .to-lo-map.is-active")?.dataset.map || null);
});
const read = () => page.evaluate(() => {
  const v = document.querySelector(".to-bo2-vote");
  return {
    shown: !!v && !v.hidden && !!v.offsetParent,
    head: v?.querySelector("header b")?.textContent || "",
    clock: v?.querySelector(".to-mv-clock")?.textContent || "",
    cards: [...(v?.querySelectorAll(".to-mv-cards li") || [])].map((li) => ({ map: li.dataset.map, text: li.textContent.trim(), mine: li.classList.contains("is-mine") })),
    lobby: v?.querySelector(".to-mv-lobby")?.textContent || "",
    rows: [...document.querySelectorAll(".tr-menu-item")].map((e) => e.textContent.trim().replace(/\s+/g, " ")),
    deploy: document.querySelector('.tr-menu-item[data-id="deploy"]')?.textContent.trim().replace(/\s+/g, " ") || "",
    party: getComputedStyle(document.querySelector(".to-bo2-party")).visibility,
  };
});
const lastTracked = () => page.evaluate(() => window.__presence.tracked().at(-1)?.activity || null);

// ---- 1 (on a fresh round, so the shortlist holds till step 3 winds it on)
await page.evaluate(() => { window.__skew += 30000 - (Date.now() % 30000) + 500; });
await roster([]);
await page.evaluate(() => window.__toBo2.menu.go("public"));
await page.waitForTimeout(800);
let s = await read();
check(s.shown && s.head === "Map vote" && /^0:\d\d$/.test(s.clock) && s.cards.length === 3, "Public Match: the vote in the middle, three maps and a clock", JSON.stringify({ head: s.head, clock: s.clock, n: s.cards.length }));
check(s.party === "visible", "the party column stays beside it");
const cands = s.cards.map((c) => c.map);
const box = await page.evaluate(() => { const r = document.querySelector(".to-bo2-vote").getBoundingClientRect(), m = document.querySelector(".to-bo2-menu").getBoundingClientRect(), p = document.querySelector(".to-bo2-party").getBoundingClientRect(); return { l: r.left, r: r.right, menuR: m.right, partyL: p.left }; });
check(box.l >= box.menuR && box.r <= box.partyL, "between the list and the party column, no overlap", JSON.stringify(box));
await page.screenshot({ path: path.join(SHOTS, "map-vote-1440.png") });

// ---- 2
const lobbyAct = (map, ready = false) => ({ game: "tf", state: "lobby", mode: "tdm", modeName: "Team Deathmatch", map, ready });
await roster([member(1, lobbyAct(cands[1])), member(2, lobbyAct(cands[1], true)), member(3, { game: "tf", state: "menu" })]);
await page.waitForTimeout(400);
s = await read();
check(/2 votes/.test(s.cards[1].text) && /0 votes/.test(s.cards[0].text), "others' votes count", JSON.stringify(s.cards.map((c) => c.text)));
// no "In the lobby: ..." line under the vote (user, 2026-10-22)
check(!s.lobby && !/In the lobby/.test(await page.evaluate(() => document.querySelector(".to-bo2-vote").textContent)), "no lobby sentence under the vote", s.lobby);
await page.evaluate((id) => document.querySelector(`.to-mv-cards li[data-map="${id}"]`).click(), cands[0]);
await page.waitForTimeout(300);
s = await read();
let act = await lastTracked();
check(s.cards[0].mine && /1 vote/.test(s.cards[0].text), "a card click is our vote", JSON.stringify(s.cards[0]));
check(act?.state === "lobby" && act.mode === "tdm" && act.map === cands[0] && !act.ready, "our vote goes on the wire", JSON.stringify(act));

// ---- 3
check(/^Find Match/.test(s.deploy) && /1 ready/.test(s.deploy), "Find Match shows who's ready", s.deploy);
await page.evaluate(() => document.querySelector('.tr-menu-item[data-id="deploy"]').click());
await page.waitForTimeout(300);
s = await read();
act = await lastTracked();
check(/^Cancel/.test(s.deploy) && act?.ready === true && !(await page.evaluate(() => window.__starts.length)), "with others in, Find Match readies up (no start yet)", JSON.stringify({ d: s.deploy, act }));
// wind the clock to the round's end
await page.evaluate(() => { window.__skew += 30000; });
await page.waitForTimeout(600);
let starts = await page.evaluate(() => window.__starts);
check(starts.length === 1 && starts[0] === cands[1], "round over: in we go on the winner (2 votes to 1)", JSON.stringify({ starts, want: cands[1] }));

// ---- 4
await page.evaluate(() => { window.__starts.length = 0; window.__toBo2.menu.backTo("main"); window.__toBo2.menu.go("public"); });
await roster([member(4, { game: "tf", state: "match", mode: "tdm", modeName: "Team Deathmatch", map: cands[2], mapName: "Somewhere", room: "QTDM", pub: true })]);
await page.waitForTimeout(400);
s = await read();
check(s.head === "Match in progress" && /^Join Match/.test(s.deploy) && !s.cards.length, "a match on: no vote, Join Match", JSON.stringify({ head: s.head, d: s.deploy }));

// ---- 5
await roster([]);
await page.waitForTimeout(400);
await page.evaluate((id) => document.querySelector(`.tr-menu-item[data-id="vote-${id}"]`).click(), (await read()).cards[2].map);
const pick = (await read()).cards[2].map;
await page.evaluate(() => document.querySelector('.tr-menu-item[data-id="deploy"]').click());
await page.waitForTimeout(300);
starts = await page.evaluate(() => window.__starts);
check(starts.length === 1 && starts[0] === pick, "alone: Find Match goes straight in on our vote", JSON.stringify({ starts, pick }));

// ---- 6
await page.evaluate(() => { window.__toBo2.menu.backTo("main"); window.__toBo2.menu.go("public"); });
await page.waitForTimeout(300);
await page.evaluate(() => window.__toBo2.menu.backTo("main"));
await page.waitForTimeout(300);
act = await lastTracked();
s = await read();
check(act?.state === "menu" && !s.shown, "back to the main menu: out of the lobby, panel gone", JSON.stringify(act));

// phones: on screen, nothing overlapping the list
for (const [w, h] of [[390, 844], [844, 390]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.evaluate(() => window.__toBo2.menu.go("public"));
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => { const v = document.querySelector(".to-bo2-vote").getBoundingClientRect(); return { l: v.left, r: v.right, t: v.top, b: v.bottom }; });
  check(r.l >= 0 && r.r <= w + 1 && r.t >= 0 && r.b <= h + 1, `phone ${w}x${h}: the vote fits`, JSON.stringify(r));
  await page.screenshot({ path: path.join(SHOTS, `map-vote-${w}x${h}.png`) });
  await page.evaluate(() => window.__toBo2.menu.backTo("main"));
}

check(errors.length === 0, "no page errors", errors.join(" | "));
console.log(fails ? `${fails} FAILED` : "ALL PASS");
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
