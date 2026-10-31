// Trollnite's lobby fixes of 2026-10-31 (user: Find Match below the fold,
// the Quests dot that never went, the online list, friends joining
// mid-match). Supabase is blocked: nothing joins a real room, and nothing
// here presses a go button.
//   1. Public Match: Find Match is the first row and on screen without a
//      scroll (laptop and upright phone); the Play page has no "Map vote" card.
//   2. The Quests dot: up for something unseen, gone once Quests is opened,
//      back when a quest is done.
//   3. Friends drawer: "Online now" (not friends) comes before Offline; a
//      friend in an open private match gets a Join, one in a closed one doesn't.
//   4. Options > Friends can join: on by default, toggles, and off keeps the
//      room code out of what this tab says (describe reads "(private)").
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-live-lobby-test.mjs
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
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const SHOTS = process.env.SHOTS || "";

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];

async function open(viewport) {
  const ctx = await browser.newContext({ viewport });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1&season=off`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps && !!window.__toBo2?.fn, null, { timeout: 180000 });
  await sleep(500);
  return { ctx, page };
}

// ---- 1
for (const [label, vp] of [["laptop", { width: 1280, height: 720 }], ["phone", { width: 390, height: 844 }]]) {
  const { ctx, page } = await open(vp);
  const card = await page.evaluate(() => { window.__toBo2.fn.setPlaylist("public"); window.__toBo2.menu.go("main"); const m = document.querySelector(".to-fn-map"); return { hidden: !m || m.hidden || !m.offsetParent, text: m?.textContent.trim() }; });
  check(card.hidden && !/Map vote/.test(card.text || ""), `${label}: no "Map vote" card on the Play page for Public Match`, JSON.stringify(card));
  await page.evaluate(() => window.__toBo2.menu.go("public"));
  await sleep(400);
  const r = await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".to-bo2-menu [data-id], .to-bo2-menu .to-bo2-item")].filter((e) => e.offsetParent);
    const find = rows.find((e) => /Find Match|Join Match|Cancel/.test(e.textContent));
    if (!find) return { found: false, ids: rows.slice(0, 5).map((e) => e.textContent.trim().slice(0, 30)) };
    const b = find.getBoundingClientRect();
    return { found: true, first: rows[0] === find || rows[0].contains(find) || find.contains(rows[0]), top: b.top, bottom: b.bottom, h: innerHeight };
  });
  check(r.found && r.first, `${label}: Find Match is the first row`, JSON.stringify(r));
  check(r.found && r.top >= 0 && r.bottom <= r.h, `${label}: Find Match is on screen without scrolling`, JSON.stringify(r));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `public-${label}.png`) });
  await ctx.close();
}

// ---- 2, 3, 4 (laptop)
const { ctx, page } = await open({ width: 1280, height: 720 });
const dot = () => page.evaluate(() => !document.querySelector('[data-tab="quests"] .to-fn-dot').hidden);
await page.evaluate(() => { localStorage.removeItem("trollops:quests-seen"); window.dispatchEvent(new Event("trollforces:challenges")); });
await sleep(200);
check(await dot(), "the Quests dot shows for quests not yet looked at");
await page.click('.to-fn-tab[data-tab="quests"]');
await sleep(300);
check(!(await dot()), "opening Quests clears the dot");
await page.click('.to-fn-tab[data-tab="play"]');
await sleep(300);
check(!(await dot()), "the dot stays gone back on the Play page");
// the challenges move on (one done, a new day): what was seen no longer matches
await page.evaluate(() => {
  localStorage.setItem("trollops:quests-seen", localStorage.getItem("trollops:quests-seen") + "|changed");
  window.dispatchEvent(new Event("trollforces:challenges"));
});
await sleep(300);
check(await dot(), "the challenges changing brings the dot back");

// Friends: a signed-in account with two friends online (one in an open
// private match, one in a closed one), one offline, and a stranger online.
await page.evaluate(() => {
  const A = window.TrollrunnerAccounts;
  const me = { id: "00000000-0000-4000-8000-000000000001", userId: "00000000-0000-4000-8000-000000000001", username: "tester" };
  A.getCachedProfile = () => me;
  const F = (n, name) => ({ id: `00000000-0000-4000-8000-00000000000${n}`, username: name, level: 5 });
  A.listFriends = async () => [F(2, "openpal"), F(3, "closedpal"), F(4, "sleepypal")];
  A.listFriendRequests = async () => ({ incoming: [], outgoing: [] });
  const mem = (n, name, activity) => ({ userId: `00000000-0000-4000-8000-00000000000${n}`, viewerId: `v${n}`, username: name, level: 5, activity });
  window.__toBo2.fakeRoster({
    members: [
      mem(2, "openpal", { game: "tf", state: "match", mode: "tdm", modeName: "Team Deathmatch", map: null, room: "PAL123", pub: false, open: true }),
      mem(3, "closedpal", { game: "tf", state: "match", mode: "tdm", modeName: "Team Deathmatch", room: null, pub: false, open: false, priv: true }),
      mem(5, "stranger", { game: "tf", state: "menu" }),
    ],
    guests: [],
  });
  window.dispatchEvent(new Event("trollforces:friends"));
});
await sleep(800);
const fr = await page.evaluate(() => {
  const secs = [...document.querySelectorAll(".to-fr-body > section")].map((s) => s.querySelector("h3 span")?.textContent);
  const rowOf = (name) => [...document.querySelectorAll(".to-fr-row")].find((r) => r.querySelector("b")?.firstChild?.textContent === name);
  const acts = (name) => [...(rowOf(name)?.querySelectorAll(".to-fr-act") || [])].map((b) => b.textContent);
  return { secs, open: acts("openpal"), closed: acts("closedpal"), closedLine: rowOf("closedpal")?.querySelector("small")?.textContent };
});
check(fr.secs.indexOf("Online now") > -1 && fr.secs.indexOf("Online now") < fr.secs.indexOf("Offline"), "Online now comes before Offline", fr.secs.join(" / "));
check(fr.open.includes("Join"), "a friend in an open private match has Join", fr.open.join(","));
check(!fr.closed.includes("Join") && /private/.test(fr.closedLine || ""), "a friend who turned joining off has no Join, reads (private)", `${fr.closed.join(",")} | ${fr.closedLine}`);
if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "friends.png") });
await page.keyboard.press("Escape");

// ---- 4
await page.evaluate(() => { localStorage.removeItem("trollops:friends-join"); window.__toBo2.menu.go("options"); });
await sleep(300);
const rowText = () => page.evaluate(() => [...document.querySelectorAll(".to-bo2-menu .tr-menu-item")].find((e) => /Friends can join/.test(e.textContent))?.textContent.replace(/\s+/g, " ").trim());
const t0 = await rowText();
check(/Friends can join/.test(t0 || "") && /On/.test(t0 || ""), "Options has Friends can join, On by default", t0);
const off = await page.evaluate(async () => {
  const m = await import(new URL("assets/games/troll-ops/menu/online.js", location.href).href);
  m.setFriendsCanJoin(false);
  const stored = localStorage.getItem("trollops:friends-join");
  const line = m.describe({ game: "tf", state: "match", modeName: "Team Deathmatch", room: null, priv: true });
  const can = m.friendsCanJoin();
  m.setFriendsCanJoin(true);
  return { stored, line, can, after: m.friendsCanJoin() };
});
check(off.stored === "off" && !off.can && off.after, "the setting turns off and on", JSON.stringify(off));
check(/\(private\)/.test(off.line), "a closed match reads (private), not (solo)", off.line);

check(!errors.length, "no page errors", errors.slice(0, 3).join(" | "));
await ctx.close();
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
