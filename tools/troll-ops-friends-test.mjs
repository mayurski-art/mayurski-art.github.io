// Troll Forces: the lobby's Friends drawer (menu/friends.js; user,
// 2026-10-28: "add a friends section to the main menu ... the UI should be
// really good for it"). Offline: Supabase is blocked, the presence channel
// is a fake holding whatever roster the test sets (as in the party-list
// test), and TrollrunnerAccounts' friend calls are stubs that record what
// they were asked.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-friends-test.mjs
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

const uuid = (i) => `00000000-0000-4000-8000-${String(100 + i).padStart(12, "0")}`;
await page.addInitScript((ids) => {
  const P = { state: {}, onSync: null };
  window.__presence = {
    set(list) { P.state = Object.fromEntries(list.map((e) => [e.viewerId, [e]])); },
    sync() { P.onSync?.(); },
  };
  const channel = {
    on(type, filter, cb) { if (type === "presence" && filter.event === "sync") P.onSync = cb; return channel; },
    subscribe(cb) { setTimeout(() => cb("SUBSCRIBED"), 0); return channel; },
    presenceState: () => P.state,
    track: async () => {}, untrack: async () => {}, send: async () => {},
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

  // the friends backend, faked: lists the test can change, calls recorded
  const F = window.__friends = {
    signedIn: true, calls: [],
    friends: [
      { id: ids[1], username: "grin_reaper", level: 12, avatar_url: null },
      { id: ids[2], username: "kek_lord", level: 30, avatar_url: null },
      { id: ids[3], username: "sleepy_troll", level: 4, avatar_url: null },
    ],
    incoming: [{ id: ids[4], username: "new_pal", level: 7, avatar_url: null }],
    outgoing: [{ id: ids[5], username: "waiting_on_you", level: 2, avatar_url: null }],
  };
  const profile = { username: "troll_tester", userId: ids[0], id: ids[0], level: 20 };
  const stub = (v) => {
    v.getCachedProfile = () => (F.signedIn ? profile : null);
    v.listFriends = async () => F.friends.slice();
    v.listFriendRequests = async () => ({ incoming: F.incoming.slice(), outgoing: F.outgoing.slice() });
    v.respondFriendRequest = async (id, ok) => {
      F.calls.push(["respond", id, ok]);
      const r = F.incoming.find((x) => x.id === id);
      F.incoming = F.incoming.filter((x) => x.id !== id);
      if (ok && r) F.friends.push(r);
      return ok ? "accepted" : "none";
    };
    v.removeFriend = async (id) => { F.calls.push(["remove", id]); F.friends = F.friends.filter((x) => x.id !== id); F.outgoing = F.outgoing.filter((x) => x.id !== id); return true; };
    v.sendFriendRequest = async (id) => { F.calls.push(["send", id]); F.outgoing.push({ id, username: `someone_${id.slice(-3)}`, level: 1, avatar_url: null }); return "pending_out"; };
    v.searchUsernames = async (q) => { F.calls.push(["search", q]); return [{ id: ids[6], username: `${q}_one`, level: 9, avatar_url: null }, { id: ids[1], username: "grin_reaper", level: 12, avatar_url: null }]; };
  };
  Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => window.__acct, set: (v) => { window.__acct = v; if (v) stub(v); } });
}, Array.from({ length: 8 }, (_, i) => uuid(i)));

await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__toBo2 && !!document.querySelector(".to-fr-btn"), null, { timeout: 90000 });
await page.waitForTimeout(1200);

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const me = await page.evaluate(() => {
  if (!window.TrollrunnerAccounts) window.TrollrunnerAccounts = {};
  window.dispatchEvent(new CustomEvent("trollrunner:auth-changed", { detail: { signedIn: true } }));
  return localStorage.getItem("trollrunner_viewer_id_v1");
});
const T = "2026-10-28T00:00:00Z";
const member = (i, name, activity = null) => ({ viewerId: `v-${i}`, userId: uuid(i), username: name, level: 5 + i, trackedAt: T, onlineAt: T, activity });
const myRow = { viewerId: me, userId: uuid(0), username: "troll_tester", level: 20, trackedAt: T, onlineAt: T };
const pubRoom = await page.evaluate(() => Object.values(window.__toGame?.QUICKPLAY_BASE || {})[0] || null);
// grin_reaper in a public TDM room, kek_lord in the menu, a stranger online
const roster = [
  myRow,
  member(1, "grin_reaper", { game: "tf", state: "match", mode: "tdm", modeName: "Team Deathmatch", map: "hollowgrin", mapName: "Hollowgrin", room: pubRoom || "QTDM", pub: true }),
  member(2, "kek_lord", { game: "tf", state: "menu" }),
  member(7, "random_guy", { game: "tf", state: "menu" }),
];
await page.evaluate((list) => { window.__presence.set(list); window.__presence.sync(); }, roster);
await page.waitForTimeout(500);

// the button: in the top bar, badged with the one request
const btn = await page.evaluate(() => {
  const b = document.querySelector(".to-fr-btn");
  const r = b.getBoundingClientRect();
  return { inBar: !!b.closest(".to-fn-me"), w: r.width, badge: b.querySelector(".to-fr-badge").hidden ? null : b.querySelector(".to-fr-badge").textContent, label: b.getAttribute("aria-label") };
});
check(btn.inBar && btn.w > 30, "Friends button sits in the lobby's top bar", JSON.stringify(btn));
check(btn.badge === "1" && /1 request/.test(btn.label), "its badge counts the request waiting", JSON.stringify(btn));

await page.click(".to-fr-btn");
await page.waitForTimeout(600);
const read = () => page.evaluate(() => {
  const d = document.querySelector(".to-fr");
  const secs = Object.fromEntries([...d.querySelectorAll(".to-fr-sec")].map((s) => [s.querySelector("h3 span").textContent,
    [...s.querySelectorAll(".to-fr-row")].map((r) => ({ name: r.querySelector(".to-fr-txt b").firstChild.textContent, line: r.querySelector(".to-fr-txt small").textContent, acts: [...r.querySelectorAll(".to-fr-act")].map((a) => a.textContent || a.getAttribute("aria-label")) }))]));
  return { open: !d.hidden, sum: d.querySelector(".to-fr-sum").textContent, focus: document.activeElement?.getAttribute("aria-label"), secs, note: d.querySelector(".to-fr-note").hidden ? "" : d.querySelector(".to-fr-note").textContent };
});
let s = await read();
check(s.open && s.focus === "Find a player by username", "opens with the search box focused", JSON.stringify({ open: s.open, focus: s.focus }));
check(/2 online · 3 friends/.test(s.sum), "the header sums it up: 2 online, 3 friends", s.sum);
check(s.secs.Requests?.[0]?.name === "new_pal" && s.secs.Requests[0].acts.join() === "Accept,Decline", "Requests: new_pal with Accept and Decline", JSON.stringify(s.secs.Requests));
const on = s.secs.Online || [];
check(on[0]?.name === "grin_reaper" && on[0].acts.includes("Join") && on[0].acts.includes("Invite") && /Team Deathmatch/.test(on[0].line), "Online: a friend in a public match first, with what they're playing, Join and Invite", JSON.stringify(on[0]));
check(on[1]?.name === "kek_lord" && !on[1].acts.includes("Join") && on[1].acts.includes("Invite"), "Online: a friend in the menu can be invited, not joined", JSON.stringify(on[1]));
check(s.secs.Offline?.length === 1 && s.secs.Offline[0].name === "sleepy_troll", "Offline: the one who isn't on", JSON.stringify(s.secs.Offline));
check(s.secs.Sent?.[0]?.name === "waiting_on_you" && s.secs.Sent[0].acts.includes("Cancel"), "Sent: the request out, with Cancel", JSON.stringify(s.secs.Sent));
const others = s.secs["Online now"] || [];
check(others.length === 1 && others[0].name === "random_guy" && others[0].acts.includes("Add") && others[0].acts.includes("Invite"), "Online now: a stranger with Add and Invite, never you or a friend", JSON.stringify(others));
await page.screenshot({ path: path.join(SHOTS, "friends-open.png") });

// accept the request
await page.click('.to-fr-sec.is-req .to-fr-act.is-go');
await page.waitForTimeout(500);
s = await read();
let calls = await page.evaluate(() => window.__friends.calls);
check(calls.some((c) => c[0] === "respond" && c[2] === true) && !s.secs.Requests && (s.secs.Offline || []).some((r) => r.name === "new_pal"), "Accept: the request goes, they're a friend", JSON.stringify({ calls, note: s.note }));
check(/friends/.test(s.note), "and it says so", s.note);

// remove a friend: asks first, then goes
await page.hover('.to-fr-row[data-id="' + (await page.evaluate(() => window.__friends.friends.find((f) => f.username === "sleepy_troll").id)) + '"]');
await page.click('[aria-label="Remove sleepy_troll"]');
await page.waitForTimeout(200);
s = await read();
const asking = (s.secs.Offline || []).find((r) => r.name === "sleepy_troll");
check(/Remove sleepy_troll/.test(asking?.line || "") && asking.acts.join() === "Remove,Keep", "Remove asks first", JSON.stringify(asking));
await page.click('[aria-label="Yes, remove sleepy_troll"]');
await page.waitForTimeout(500);
s = await read();
calls = await page.evaluate(() => window.__friends.calls);
check(calls.some((c) => c[0] === "remove") && !(s.secs.Offline || []).some((r) => r.name === "sleepy_troll"), "then removes them", JSON.stringify(s.secs.Offline));

// add the stranger from Online now
await page.click('[aria-label="Add random_guy as a friend"]');
await page.waitForTimeout(500);
calls = await page.evaluate(() => window.__friends.calls);
check(calls.some((c) => c[0] === "send"), "Add sends a friend request", JSON.stringify(calls.at(-1)));

// search
await page.fill(".to-fr-search input", "zz");
await page.waitForTimeout(700);
const found = await page.evaluate(() => [...document.querySelectorAll(".to-fr-results .to-fr-row")].map((r) => r.textContent.replace(/\s+/g, " ").trim()));
check(found.length === 2 && /zz_one.*Add/.test(found[0]) && /grin_reaper.*Friends/.test(found[1]), "search: matches, Add for a stranger, \"Friends\" for a friend", JSON.stringify(found));
await page.screenshot({ path: path.join(SHOTS, "friends-search.png") });

// Esc: first the results, then the drawer; the menu stays where it was
await page.keyboard.press("Escape");
await page.waitForTimeout(150);
const st1 = await page.evaluate(() => ({ results: !document.querySelector(".to-fr-results").hidden, open: !document.querySelector(".to-fr").hidden }));
await page.keyboard.press("Escape");
await page.waitForTimeout(250);
const st2 = await page.evaluate(() => ({ open: !document.querySelector(".to-fr").hidden, screen: window.__toBo2.menu.current(), focus: document.activeElement?.classList.contains("to-fr-btn") }));
check(!st1.results && st1.open && !st2.open && st2.screen === "main" && st2.focus, "Esc clears the search, then closes; the lobby stays put, focus back on the button", JSON.stringify({ st1, st2 }));

// an empty "+" pad beside your operator opens it too
const pad = await page.evaluate(() => { const b = [...document.querySelectorAll(".to-stage-add")].find((x) => !x.hidden && x.offsetParent); b?.click(); return !!b; });
await page.waitForTimeout(300);
const padOpen = await page.evaluate(() => !document.querySelector(".to-fr").hidden);
check(!pad || padOpen, "a \"+\" pad opens the drawer", JSON.stringify({ pad, padOpen }));
if (padOpen) await page.keyboard.press("Escape");

// on screen, nothing over it, at every size
for (const [w, h] of [[1280, 720], [390, 844], [844, 390]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(400);
  await page.evaluate(() => { const d = document.querySelector(".to-fr"); if (d.hidden) document.querySelector(".to-fr-btn").click(); });
  await page.waitForTimeout(500);
  const box = await page.evaluate(() => {
    const d = document.querySelector(".to-fr"), r = d.getBoundingClientRect();
    const b = document.querySelector(".to-fr-btn"), br = b.getBoundingClientRect();
    // what's drawn on the drawer's own points (corners, the close button)
    const pts = [[r.left + 20, r.top + 20], [r.right - 20, r.top + 20], [r.left + 20, r.bottom - 20], [r.right - 20, r.bottom - 20]];
    const x = d.querySelector(".to-fr-x").getBoundingClientRect();
    pts.push([x.left + x.width / 2, x.top + x.height / 2]);
    const covered = pts.filter(([px, py]) => !d.contains(document.elementFromPoint(px, py)));
    return { r: [r.left, r.top, r.right, r.bottom].map(Math.round), btnShown: !!b.offsetParent && br.width > 0, covered: covered.length };
  });
  check(box.r[0] >= 0 && box.r[1] >= 0 && box.r[2] <= w && box.r[3] <= h && box.covered === 0 && box.btnShown, `${w}x${h}: drawer on screen, nothing over it, button showing`, JSON.stringify(box));
  await page.screenshot({ path: path.join(SHOTS, `friends-${w}x${h}.png`) });
  await page.keyboard.press("Escape");
}

// signed out: the drawer offers sign-in, still lists who's on
await page.setViewportSize({ width: 1280, height: 720 });
await page.evaluate(() => { window.__friends.signedIn = false; window.dispatchEvent(new CustomEvent("trollrunner:auth-changed", { detail: null })); });
await page.click(".to-fr-btn");
await page.waitForTimeout(400);
const guest = await page.evaluate(() => ({
  hero: document.querySelector(".to-fr-empty.is-guest")?.textContent.replace(/\s+/g, " ").trim(),
  search: !document.querySelector(".to-fr-add").hidden,
  badge: !document.querySelector(".to-fr-badge").hidden,
  others: [...document.querySelectorAll(".to-fr-sec.is-others .to-fr-row")].length,
  add: !!document.querySelector(".to-fr-sec.is-others .is-add"),
}));
check(/Sign in/.test(guest.hero || "") && !guest.search && !guest.badge && guest.others >= 1 && !guest.add, "signed out: Sign in, no search or Add, who's on still listed", JSON.stringify(guest));
await page.screenshot({ path: path.join(SHOTS, "friends-guest.png") });

check(!errors.length, "no page errors", errors.join(" | "));
await browser.close();
server.close();
console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
process.exit(fails ? 1 : 0);
