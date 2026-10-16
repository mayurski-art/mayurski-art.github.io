// Troll Forces public chat (menu/public-chat.js; user, 2026-10-16: "a public
// chat button that guests can also see", "a notification that someone is
// messaging", "a mute/unmute chat symbol"). Offline, on the same fake
// presence channel as troll-ops-invite-test.mjs.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-public-chat-test.mjs   (SHOTS_DIR for phone shots)
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

const read = () => page.evaluate(() => {
  const t = document.querySelector(".to-pchat-toast"), p = document.querySelector(".to-pchat"), b = document.querySelector(".to-bo2-chat .to-pchat-badge");
  return { toast: !!t && !t.hidden ? t.textContent : null, open: !!p && !p.hidden, badge: b && !b.hidden ? b.textContent : null,
    log: p ? [...p.querySelectorAll(".to-pchat-log li")].map((li) => li.textContent) : [], imgs: p ? p.querySelectorAll(".to-pchat-log img").length : 0 };
});
const say = (from, text) => page.evaluate(([from, text]) => window.__presence.deliver({ k: "chat", from, d: { text } }), [from, text]);

// 1. The pill is there for a guest (we are one)
const pill = await page.evaluate(() => { const b = document.querySelector(".to-bo2-chat"); return b && { shown: !!b.offsetParent && !!b.closest(".to-bo2-chatcard"), text: b.textContent.trim() }; });
check(pill?.shown && /Open/.test(pill.text) , "a guest sees the chat card (Open) in the social column", JSON.stringify(pill));
// 2. A message with the chat shut: a notification and an unread count
await say("v-1", "anyone up for TDM?");
await page.waitForTimeout(200);
let s = await read();
check(s.toast?.includes("player_1") && s.toast.includes("anyone up for TDM?") && s.badge === "1", "a message pops a notification, badge 1", JSON.stringify(s));
// a sender who isn't online: nothing; markup stays text
await say("ghost-1", "spoofed");
await say("g-1", "<img src=x onerror=alert(1)>hi");
await page.waitForTimeout(200);
s = await read();
check(s.badge === "2", "an unknown sender is ignored", JSON.stringify(s.badge));
// 3. Open it: both messages, as text, unread cleared
await page.click(".to-bo2-chat");
await page.waitForTimeout(200);
s = await read();
check(s.open && s.badge === null && s.toast === null, "opening the chat clears the badge and the notification", JSON.stringify(s));
check(s.log.length === 2 && s.log[0].includes("player_1") && s.log[1].includes("<img src=x") && s.imgs === 0 && !s.log.some((l) => l.includes("spoofed")), "the messages are listed, markup as text", JSON.stringify(s.log));
// 4. Send one: on the wire, echoed in our log
await page.fill(".to-pchat-form input", "  gg   wp  ");
await page.click(".to-pchat-form button[type=submit]");
await page.waitForTimeout(200);
const sent = await page.evaluate(() => window.__sent.filter((m) => m.k === "chat"));
s = await read();
check(sent.length === 1 && sent[0].d.text === "gg wp" && s.log[2]?.includes("gg wp"), "sending puts it on the wire and in our log", JSON.stringify({ sent, last: s.log[2] }));
// too fast: held back
// (straight after, in one go: the software-rendered page is slow enough that
// two separate clicks can land a second apart)
const burst = await page.evaluate(async () => {
  const f = document.querySelector(".to-pchat-form"), n = () => window.__sent.filter((m) => m.k === "chat").length;
  await new Promise((r) => setTimeout(r, 1300));
  const before = n();
  for (const t of ["one", "two"]) { f.querySelector("input").value = t; f.requestSubmit(); }
  return n() - before;
});
check(burst === 1, "a second message within a second is held back", String(burst));
// 5. Mute: the bell, no notifications, remembered
await page.click(".to-pchat-mute");
const mute = await page.evaluate(() => ({ pressed: document.querySelector(".to-pchat-mute").getAttribute("aria-pressed"), label: document.querySelector(".to-pchat-mute").getAttribute("aria-label"), saved: localStorage.getItem("trollops:chat-muted") }));
check(mute.pressed === "true" && /Unmute/.test(mute.label) && mute.saved === "1", "the bell mutes the chat (labelled, remembered)", JSON.stringify(mute));
await page.keyboard.press("Escape");
await page.waitForTimeout(150);
s = await read();
check(!s.open, "Esc closes the chat");
await say("v-2", "muted ping");
await page.waitForTimeout(200);
s = await read();
check(s.toast === null && s.badge === "1", "muted: no notification, the count still goes up", JSON.stringify(s));
await page.click(".to-bo2-chat");
await page.click(".to-pchat-mute");
await page.keyboard.press("Escape");
await say("v-2", "loud again");
await page.waitForTimeout(200);
check((await read()).toast?.includes("loud again"), "unmuted: notifications back");
// GIFs (user, 2026-10-16): pick one from the grid; it goes as an id, shows as the site's own GIF
await page.click(".to-bo2-chat");
await page.waitForTimeout(1300);
await page.click(".to-pchat-gifbtn");
await page.click('.to-pchat-gifs [data-gif="grin"]');
await page.waitForTimeout(200);
const gifSent = await page.evaluate(() => ({ last: window.__sent.filter((m) => m.k === "chat").at(-1)?.d, imgs: [...document.querySelectorAll(".to-pchat-log img.to-pchat-gif")].map((i) => i.getAttribute("src")), grid: !document.querySelector(".to-pchat-gifs").hidden }));
check(gifSent.last?.gif === "grin" && gifSent.imgs.some((u) => /ui\/gifs\/grin\.gif/.test(u)) && !gifSent.grid, "a GIF from the grid goes out as its id and shows in our log", JSON.stringify(gifSent));
await page.evaluate(() => { window.__presence.deliver({ k: "chat", from: "v-1", d: { text: "", gif: "lel" } }); window.__presence.deliver({ k: "chat", from: "v-2", d: { text: "", gif: "https://evil.example/x.gif" } }); });
await page.waitForTimeout(200);
const gifIn = await page.evaluate(() => [...document.querySelectorAll(".to-pchat-log img.to-pchat-gif")].map((i) => i.getAttribute("src")));
check(gifIn.some((u) => /gifs\/lel\.gif/.test(u)) && !gifIn.some((u) => /evil/.test(u)), "someone's GIF shows; a GIF that isn't ours is dropped", JSON.stringify(gifIn));
await page.keyboard.press("Escape");

// 6. Phones: the footer pills on screen and apart; the chat fits
for (const [w, h] of [[390, 844], [844, 390]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(400);
  const f = await page.evaluate(() => {
    const els = [...document.querySelectorAll(".to-bo2-foot button, .to-bo2-foot .to-bo2-online")].filter((e) => e.offsetParent);
    const rs = els.map((e) => e.getBoundingClientRect());
    const hit = (a, b) => a.bottom > b.top + 1 && b.bottom > a.top + 1 && a.right > b.left + 1 && b.right > a.left + 1;
    return { n: els.length, right: Math.max(...rs.map((r) => r.right)), left: Math.min(...rs.map((r) => r.left)), overlap: rs.some((a, i) => rs.some((b, j) => j > i && hit(a, b))) };
  });
  check(f.left >= 0 && f.right <= w + 0.5 && !f.overlap, `phone ${w}x${h}: footer pills on screen, none overlapping`, JSON.stringify(f));
  await page.click(".to-bo2-chat");
  await page.waitForTimeout(200);
  const p = await page.evaluate(() => { const r = document.querySelector(".to-pchat").getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; });
  check(p.l >= 0 && p.r <= w + 0.5 && p.t >= 0 && p.b <= h + 0.5, `phone ${w}x${h}: the chat fits`, JSON.stringify(p));
  if (process.env.SHOTS_DIR) await page.screenshot({ path: path.join(process.env.SHOTS_DIR, `chat-${w}x${h}.png`) });
  await page.keyboard.press("Escape");
}

// 7. In a match: the public chat is a channel of the match chatbox (U)
await page.setViewportSize({ width: 1280, height: 720 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.composer && (T.composer.render = () => {});
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  T.els.room.value = "PCHAT";
  T.els.room.dispatchEvent(new Event("input"));
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 60000 });
// past the intro and the countdown (the box can't take focus under them)
await page.waitForFunction(() => !/to-(intro|staging)-on/.test(document.body.className), null, { timeout: 90000 });
await page.waitForTimeout(500);
const box = () => page.evaluate(() => {
  const r = document.querySelector(".to-chat");
  return { shown: !!r && !r.hidden, lines: [...(r?.querySelectorAll(".to-chat-line") || [])].map((l) => l.textContent), chan: r?.querySelector(".to-chat-chan")?.textContent, open: !r?.querySelector(".to-chat-form").hidden };
});
await say("v-2", "gl in there");
await page.waitForTimeout(300);
let b = await box();
s = await read();
check(b.lines.some((l) => l.includes("[PUBLIC]") && l.includes("player_2") && l.includes("gl in there")) && s.toast === null, "mid-match a public message is a [PUBLIC] line in the chatbox, not a card", JSON.stringify({ b, toast: s.toast }));
await page.keyboard.press("KeyU");
await page.waitForTimeout(200);
b = await box();
check(b.open && b.chan === "PUBLIC", "U opens the chatbox on PUBLIC", JSON.stringify(b));
await page.waitForTimeout(1300);
await page.keyboard.type("hello all");
await page.keyboard.press("Enter");
await page.waitForTimeout(200);
const sentPub = await page.evaluate(() => window.__sent.filter((m) => m.k === "chat").map((m) => m.d.text));
b = await box();
check(sentPub.includes("hello all") && b.lines.some((l) => l.includes("[PUBLIC]") && l.includes("(you)") && l.includes("hello all")), "Enter sends it to everyone, shown as yours", JSON.stringify({ sentPub, lines: b.lines }));
// GIFs in the match: a strip over the box on PUBLIC; one in, one out
await page.keyboard.press("KeyU");
await page.waitForTimeout(1300);
const strip = await page.evaluate(() => { const g = document.querySelector(".to-chat-gifs"); return { shown: !!g && !g.hidden, n: g?.querySelectorAll("button").length }; });
check(strip.shown && strip.n === 14, "on PUBLIC the GIF strip shows over the box", JSON.stringify(strip));
await page.dispatchEvent('.to-chat-gifs [data-gif="forward"]', "mousedown");
await page.waitForTimeout(200);
await page.evaluate(() => window.__presence.deliver({ k: "chat", from: "v-2", d: { text: "", gif: "cya" } }));
await page.waitForTimeout(300);
const mg = await page.evaluate(() => ({ last: window.__sent.filter((m) => m.k === "chat").at(-1)?.d, imgs: [...document.querySelectorAll(".to-chat .to-chat-gif")].map((i) => i.getAttribute("src")) }));
check(mg.last?.gif === "forward" && mg.imgs.some((u) => /forward\.gif/.test(u)) && mg.imgs.some((u) => /cya\.gif/.test(u)), "a GIF sent and one received show in the match chatbox", JSON.stringify(mg));
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
check(await page.evaluate(() => document.querySelector(".to-chat-gifs")?.hidden !== false), "the strip goes when the box closes");
// Tab steps through the channels: ALL -> TEAM -> PUBLIC
await page.keyboard.press("Enter");
await page.waitForTimeout(200);
const chans = [(await box()).chan];
for (let i = 0; i < 3; i++) { await page.keyboard.press("Tab"); chans.push((await box()).chan); }
check(chans.join(",") === "ALL,TEAM,PUBLIC,ALL", "Tab steps ALL, TEAM, PUBLIC and round", chans.join(","));
await page.keyboard.press("Escape");
// muted: no public lines in the match either
await page.evaluate(() => localStorage.setItem("trollops:chat-muted", "1"));
const mutedBefore = (await box()).lines.length;
await page.evaluate(() => { const m = document.querySelector(".to-pchat-mute"); if (m && m.getAttribute("aria-pressed") !== "true") m.click(); });
await say("v-1", "should not show");
await page.waitForTimeout(300);
b = await box();
check(!b.lines.some((l) => l.includes("should not show")), "muted: no public lines in the match", JSON.stringify(b.lines.slice(-3)));

check(errors.length === 0, "no page errors", errors.join(" | "));
console.log(fails ? `${fails} FAILED` : "ALL PASS");
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
