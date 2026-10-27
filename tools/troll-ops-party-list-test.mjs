// Troll Forces: the title menu's party list (menu-bo2.js renderPartyOthers;
// user, 2026-10-15: "when users are online i should be able to see them
// where i see the whole 1 Player (8 max) ... when there are users who are
// not online then they dont show up there", and no "Everything unlocked").
// Offline: Supabase is blocked and window.supabase is a fake whose presence
// channel holds whatever roster the test sets, synced on demand.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-party-list-test.mjs
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
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  // the presence channel, faked: window.__presence.set([...]) then .sync()
  const P = { state: {}, onSync: null };
  window.__presence = {
    set(list) { P.state = Object.fromEntries(list.map((e) => [e.viewerId, [e]])); },
    sync() { P.onSync?.(); },
  };
  const channel = {
    on(type, filter, cb) { if (type === "presence" && filter.event === "sync") P.onSync = cb; return channel; },
    subscribe(cb) { setTimeout(() => cb("SUBSCRIBED"), 0); return channel; },
    presenceState: () => P.state,
    track: async () => {}, untrack: async () => {},
  };
  // any other query or auth call: nothing there (a builder whose every
  // method chains, awaited to no data)
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
  // signed in as the owner (the old "Everything unlocked" account)
  const profile = { username: "troll_runner", userId: "00000000-0000-4000-8000-000000000001", level: 50 };
  Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => window.__acct, set: (v) => { window.__acct = v; if (v) v.getCachedProfile = () => profile; } });
});
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__toBo2 && !!document.querySelector(".to-bo2-party-others"), null, { timeout: 90000 });
await page.waitForTimeout(1500);

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const uuid = (i) => `00000000-0000-4000-8000-${String(100 + i).padStart(12, "0")}`;
// someone online: an account (name, level, what they're doing) or a guest
const member = (i, activity = null) => ({ viewerId: `v-${i}`, userId: uuid(i), username: `player_${i}`, level: 3 + i, trackedAt: "2026-10-15T00:00:00Z", onlineAt: "2026-10-15T00:00:00Z", activity });
const guest = (i) => ({ viewerId: `g-${i}`, userId: null, username: null, trackedAt: "2026-10-15T00:00:00Z", onlineAt: `2026-10-15T00:00:0${i}Z` });
const me = await page.evaluate(() => {
  if (!window.TrollrunnerAccounts) window.TrollrunnerAccounts = {};
  window.dispatchEvent(new Event("trollrunner:auth-changed"));
  return localStorage.getItem("trollrunner:viewer-id") || Object.keys(localStorage).filter((k) => /viewer/i.test(k)).map((k) => localStorage.getItem(k))[0];
});
const myRow = { viewerId: me, userId: "00000000-0000-4000-8000-000000000001", username: "troll_runner", level: 50, trackedAt: "2026-10-15T00:00:00Z" };
const read = () => page.evaluate(() => ({
  label: document.querySelector(".to-bo2-party-lbl")?.textContent.trim(),
  rows: [...document.querySelectorAll(".to-bo2-party-others .to-bo2-party-row")].map((r) => r.textContent.replace(/\s+/g, " ").trim()),
  more: document.querySelector(".to-bo2-party-more")?.textContent || null,
  xp: (() => { const x = document.querySelector(".to-bo2-xp"); return { text: x?.textContent, hidden: !!x?.hidden }; })(),
  everything: document.body.innerText.includes("Everything unlocked"),
}));
const roster = (list) => page.evaluate((list) => { window.__presence.set(list); window.__presence.sync(); }, list);

// alone
await roster([myRow]);
await page.waitForTimeout(300);
let s = await read();
check(s.label === "1 Player (8 Max)" && s.rows.length === 0, "alone: 1 Player, nobody listed", JSON.stringify(s));
check(!s.everything && (s.xp.hidden || !s.xp.text), "no \"Everything unlocked\" anywhere (owner, no XP line)", JSON.stringify(s.xp));

// two accounts and a guest come online
await roster([myRow, member(1, { kind: "match", mode: "tdm", map: "trollingloud" }), member(2), guest(1)]);
await page.waitForTimeout(300);
s = await read();
check(s.label === "4 Players (8 Max)" && s.rows.length === 3, "three others online: listed, 4 Players", JSON.stringify(s));
check(s.rows.some((r) => r.includes("player_1") && r.includes("LV 4")) && s.rows.some((r) => r.includes("Guest")), "accounts with their level, the guest as Guest", JSON.stringify(s.rows));
check(!s.rows.some((r) => r.includes("troll_runner")), "you aren't listed twice");
await page.screenshot({ path: path.join(SHOTS, "party-3-online.png") });

// one goes offline: gone from the list
await roster([myRow, member(1), guest(1)]);
await page.waitForTimeout(300);
s = await read();
check(s.label === "3 Players (8 Max)" && !s.rows.some((r) => r.includes("player_2")), "someone goes offline: they drop off", JSON.stringify(s));

// ten others: up to seven beside you, as many as fit above the Play page's
// mode card (the Fortnite lobby, phase 1), the rest a "+N more online" line
await roster([myRow, ...Array.from({ length: 8 }, (_, i) => member(i + 1)), guest(1), guest(2)]);
await page.waitForTimeout(300);
s = await read();
const moreN = +(/\+(\d+) more/.exec(s.more || "")?.[1] || 0);
check(s.label === "8 Players (8 Max)" && s.rows.length >= 3 && s.rows.length <= 7 && s.rows.length + moreN === 10, "ten others: 8 Players, the rows that fit, the rest in +N more online", JSON.stringify({ rows: s.rows.length, more: s.more }));
const clear = await page.evaluate(() => {
  const card = document.querySelector(".to-fn-play")?.getBoundingClientRect();
  const last = [...document.querySelectorAll(".to-bo2-party-others > *")].pop()?.getBoundingClientRect();
  return { card: card?.top ?? null, last: last?.bottom ?? null };
});
check(clear.card == null || (clear.last != null && clear.last <= clear.card), "the list stops above the mode card", JSON.stringify(clear));
await page.screenshot({ path: path.join(SHOTS, "party-full.png") });
// on a phone: the rows stay on screen and don't overlap each other
for (const [w, h] of [[390, 844], [844, 390]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(500);
  const box = await page.evaluate(() => {
    const els = [...document.querySelectorAll(".to-bo2-party-others > *")].filter((e) => e.offsetParent);
    const rs = els.map((e) => e.getBoundingClientRect());
    const hit = (a, b) => a.bottom > b.top + 1 && b.bottom > a.top + 1 && a.right > b.left + 1 && b.right > a.left + 1;
    const overlap = rs.some((a, i) => rs.some((b, j) => j > i && hit(a, b)));
    // nor the controls below it (online count, Animations, Emote)
    const below = [".to-bo2-online", ".to-bo2-quick", "#to-char-emote"].map((q) => document.querySelector(q)).filter((e) => e?.offsetParent).map((e) => e.getBoundingClientRect());
    const covered = rs.some((a) => below.some((b) => hit(a, b)));
    const bottom = Math.max(0, ...rs.map((r) => r.bottom));
    return { shown: els.length, right: Math.max(0, ...rs.map((r) => r.right)), bottom, overlap, covered, more: document.querySelector(".to-bo2-party-more")?.textContent };
  });
  check(box.right <= w + 0.5 && box.bottom <= h && !box.overlap && !box.covered, `phone ${w}x${h}: party rows on screen, no overlap`, JSON.stringify(box));
  await page.screenshot({ path: path.join(SHOTS, `party-phone-${w}x${h}.png`) });
}
await page.setViewportSize({ width: 1280, height: 720 });
await page.waitForTimeout(300);
// the more line opens Who's Online
await page.click(".to-bo2-party-more");
await page.waitForTimeout(400);
check(await page.evaluate(() => window.__toBo2.menu.current()) === "online", "+N more opens Who's Online");

check(errors.length === 0, "no page errors", errors.join(" | "));
console.log(fails ? `${fails} FAILED` : "ALL PASS");
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
