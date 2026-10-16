// Troll Forces invites (menu/invites.js; user, 2026-10-16: "users should be
// able to click on another user or guest's name and there should be a
// button to invite them"). Offline: Supabase is blocked and window.supabase
// is a fake whose presence channel holds the roster the test sets and
// records broadcasts (window.__sent), and the test delivers messages in.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-invite-test.mjs
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
const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  localStorage.setItem("trollrunner_viewer_id_v1", "me-1");
  const P = { state: {}, onSync: null, bc: [] };
  window.__sent = [];
  window.__presence = {
    set(list) { P.state = Object.fromEntries(list.map((e) => [e.viewerId, [e]])); },
    sync() { P.onSync?.(); },
    deliver(payload) { for (const cb of P.bc) cb({ payload }); },
  };
  const channel = {
    on(type, filter, cb) {
      if (type === "presence" && filter.event === "sync") P.onSync = cb;
      if (type === "broadcast" && filter.event === "msg") P.bc.push(cb);
      return channel;
    },
    subscribe(cb) { setTimeout(() => cb?.("SUBSCRIBED"), 0); return channel; },
    presenceState: () => P.state,
    send: async (m) => { if (m?.event === "msg") window.__sent.push(m.payload); return "ok"; },
    track: async () => {}, untrack: async () => {},
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
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__toBo2 && !!document.querySelector(".to-bo2-party-others"), null, { timeout: 90000 });
await page.waitForTimeout(1500);

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const uuid = (i) => `00000000-0000-4000-8000-${String(100 + i).padStart(12, "0")}`;
const member = (i) => ({ viewerId: `v-${i}`, userId: uuid(i), username: `player_${i}`, level: 3 + i, trackedAt: "2026-10-16T00:00:00Z", onlineAt: "2026-10-16T00:00:00Z" });
const guest = (i) => ({ viewerId: `g-${i}`, userId: null, username: null, trackedAt: "2026-10-16T00:00:00Z", onlineAt: `2026-10-16T00:00:0${i}Z` });
const me = { viewerId: "me-1", userId: null, username: null, trackedAt: "2026-10-16T00:00:00Z", onlineAt: "2026-10-16T00:00:00Z" };
await page.evaluate((list) => { window.__presence.set(list); window.__presence.sync(); }, [me, member(1), member(2), guest(1)]);
await page.waitForTimeout(400);
const card = () => page.evaluate(() => {
  const c = document.querySelector(".to-invite");
  return { shown: !!c && !c.hidden, text: c?.querySelector(".to-invite-text")?.textContent || "" };
});
const deliver = (from, d) => page.evaluate(([from, d]) => window.__presence.deliver({ k: "invite", from, d }), [from, d]);

// 1. An invite to us from someone online: the card, with their name
await deliver("v-1", { to: "me-1", room: "ABCDE", mode: "tdm", map: null });
await page.waitForTimeout(200);
let c = await card();
check(c.shown && c.text.includes("player_1") && c.text.includes("Team Deathmatch"), "an invite shows the card with who and what", JSON.stringify(c));
await page.click('.to-invite [data-act="no"]');
c = await card();
check(!c.shown, "Not now puts it away");
// someone else's invite, a sender who isn't online, a bad room: nothing
await deliver("v-2", { to: "someone-else", room: "ABCDE", mode: "tdm" });
await deliver("ghost-9", { to: "me-1", room: "ABCDE", mode: "tdm" });
await deliver("v-2", { to: "me-1", room: "<b>x", mode: "tdm" });
await page.waitForTimeout(200);
check(!(await card()).shown, "not for us, an unknown sender, or a bad room: no card");

// 2. The guest's name in the party list: their card, with Invite
const rows = await page.$$eval(".to-bo2-party-others .to-bo2-party-row", (rs) => rs.map((r) => ({ tag: r.tagName, text: r.textContent })));
check(rows.length === 3 && rows.every((r) => r.tag === "BUTTON"), "every party row is a button, guests too", JSON.stringify(rows));
await page.evaluate(() => [...document.querySelectorAll(".to-bo2-party-others .to-bo2-party-row")].find((r) => r.textContent.includes("Guest")).click());
await page.waitForTimeout(300);
const gc = await page.evaluate(() => {
  const o = document.querySelector(".tf-card-overlay");
  return { shown: !!o && !o.hidden, invite: !o?.querySelector('[data-act="invite"]').hidden, full: !o?.querySelector('[data-act="full"]').hidden, name: o?.querySelector(".tf-card-name")?.textContent };
});
check(gc.shown && gc.invite && !gc.full && /Guest/.test(gc.name || ""), "a guest's card: their name and Invite, no Full profile", JSON.stringify(gc));
// Invite from the menu: the invite goes out and we start our private match on that code
await page.click('.tf-card-overlay [data-act="invite"]');
await page.waitForTimeout(300);
const sent1 = await page.evaluate(() => ({ sent: window.__sent.filter((m) => m.k === "invite"), status: document.querySelector(".tf-card-status")?.textContent }));
const inv = sent1.sent[0]?.d;
check(inv && inv.to === "g-1" && /^[A-Z0-9]{5}$/.test(inv.room) && inv.mode, "Invite sends the guest an invite to a fresh private code", JSON.stringify(sent1));
check(/Invite sent/.test(sent1.status || ""), "the card says it went", sent1.status);
await page.click('.tf-card-overlay [data-act="close"]').catch(() => {});
await page.waitForFunction(() => ["playing", "paused"].includes(window.__trollOps.state()), null, { timeout: 60000 }).catch(() => {});
const st = await page.evaluate(() => ({ state: window.__trollOps.state(), room: window.__trollOps.els.room.value }));
check(["playing", "paused"].includes(st.state) && st.room === inv?.room, "and we're in a match on that code", JSON.stringify(st));
// (online.js at the tag the menu imports it with: one module, one publicRuns)
const ONLINE = "/assets/games/troll-ops/menu/" + fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/menu/menu-bo2.js"), "utf8").match(/online\.js\?v=[^"]+/)[0];
const listed = await page.evaluate(async ([room, url]) => (await import(url)).isPublicRoom(room), [inv?.room, ONLINE]);
check(!listed, "an invite's room is never listed as a public server");

// 3. In a match, an invite from someone: Join leaves this match and goes to theirs
await deliver("v-2", { to: "me-1", room: "QRSTU", mode: "tdm", map: null });
await page.waitForTimeout(200);
check((await card()).shown, "an invite reaches us mid-match");
// (the mouse is the game's mid-match: J takes it)
await page.keyboard.press("KeyJ");
await page.waitForFunction(() => window.__trollOps.els.room.value === "QRSTU" && window.__trollOps.state() !== "menu", null, { timeout: 60000 }).catch(() => {});
const j = await page.evaluate(() => ({ state: window.__trollOps.state(), room: window.__trollOps.els.room.value }));
check(j.room === "QRSTU" && j.state !== "menu", "Join takes us into their room", JSON.stringify(j));

// phone: the invite card fits the screen
await page.setViewportSize({ width: 375, height: 667 });
await deliver("v-1", { to: "me-1", room: "VWXYZ", mode: "koth", map: null });
await page.waitForTimeout(300);
const box = await page.evaluate(() => { const r = document.querySelector(".to-invite").getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; });
check(box.l >= 0 && box.r <= 375 && box.b < 667, "phone: the invite card fits", JSON.stringify(box));

check(errors.length === 0, "no page errors", errors.join(" | "));
console.log(fails ? `${fails} FAILED` : "ALL PASS");
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
