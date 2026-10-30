// Troll Radio synced to the squad leader (sound/radio-sync.js, menu/radio.js,
// menu/invites.js). Two tabs, a leader and a member, each its own viewer;
// Supabase is blocked and window.supabase is a fake whose presence channel
// the test relays between the tabs (what one sends, the other gets).
//   1. The leader invites, the member joins the party (the real cards).
//   2. The member's radio offers "Sync music"; asking puts the invite-style
//      card up on the leader's screen; Accept.
//   3. The member plays the leader's track from the leader's place, and
//      follows a skip, a seek and a pause; also with the leader in a
//      (private, offline) match.
//   4. The member working its own radio stops following; the leader's told.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-radio-sync-test.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import os from "node:os";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  const type = TYPES[path.extname(p)] || "application/octet-stream", size = fs.statSync(p).size;
  // ranges, so the songs can seek (the sync seeks the member's radio)
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
  if (m) {
    const start = m[1] ? +m[1] : 0, end = m[2] ? Math.min(+m[2], size - 1) : size - 1;
    res.writeHead(206, { "content-type": type, "accept-ranges": "bytes", "content-range": `bytes ${start}-${end}/${size}`, "content-length": end - start + 1 });
    return fs.createReadStream(p, { start, end }).pipe(res);
  }
  res.writeHead(200, { "content-type": type, "accept-ranges": "bytes", "content-length": size });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const ROSTER = [
  { viewerId: "lead-1", userId: "00000000-0000-4000-8000-000000000101", username: "leader_lou", level: 9, trackedAt: "2026-10-29T00:00:00Z", onlineAt: "2026-10-29T00:00:00Z" },
  { viewerId: "mem-2", userId: "00000000-0000-4000-8000-000000000102", username: "member_mo", level: 4, trackedAt: "2026-10-29T00:00:00Z", onlineAt: "2026-10-29T00:00:01Z" },
];

async function tab(me) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.route(/supabase/, (r) => r.abort());
  await ctx.route(/^https:\/\/mayurski-art\.github\.io\/assets\/js\//, (r) => {
    const f = path.join(ROOT, "assets/js", path.basename(new URL(r.request().url()).pathname));
    return fs.existsSync(f) ? r.fulfill({ path: f, contentType: "text/javascript" }) : r.abort();
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${me}: ${e.message}`));
  await page.addInitScript((me) => {
    localStorage.setItem("trollrunner_viewer_id_v1", me);
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
    const query = () => new Proxy(function () {}, { get: (t, k) => (k === "then" ? (ok) => ok({ data: null, error: null }) : query), apply: () => query() });
    const auth = {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    };
    window.supabase = { createClient: () => ({ channel: () => channel, from: query, rpc: query, auth, removeChannel() {} }) };
  }, me);
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps && !!window.__toBo2 && !!document.querySelector(".to-bo2-party-others"), null, { timeout: 180000 });
  await sleep(1200);
  await page.evaluate((list) => { window.__presence.set(list); window.__presence.sync(); }, ROSTER);
  return page;
}
const lead = await tab("lead-1");
const mem = await tab("mem-2");

// the channel between the tabs: what one sends, the other hears
let relayOn = true, relayed = [];
(async () => {
  while (relayOn) {
    for (const [from, to] of [[lead, mem], [mem, lead]]) {
      const out = await from.evaluate(() => window.__sent.splice(0)).catch(() => []);
      for (const m of out) { relayed.push(m.k); await to.evaluate((m) => window.__presence.deliver(m), m).catch(() => {}); }
    }
    await sleep(60);
  }
})();

const card = (p) => p.evaluate(() => {
  const c = document.querySelector(".to-invite");
  return { shown: !!c && !c.hidden, text: c?.querySelector(".to-invite-text")?.textContent || "", yes: c?.querySelector('[data-act="join"]')?.textContent || "", key: c?.querySelector(".to-invite-key")?.textContent || "" };
});
const radio = (p) => p.evaluate(() => {
  const m = window.__trollOps.music, s = document.querySelector(".to-radio-sync");
  return { i: m.order[m.pos], t: Math.round(m.time * 10) / 10, playing: m.playing, title: m.current?.title,
    sync: s && !s.hidden ? { text: s.firstChild.textContent, btn: s.lastChild.textContent, off: s.lastChild.disabled } : null };
});

// ---- 1. the party: the leader invites, the member joins
const INVITES = "/assets/games/troll-ops/menu/" + fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/menu/menu-bo2.js"), "utf8").match(/invites\.js\?v=[^"]+/)[0];
const line = await lead.evaluate(async (url) => (await import(url)).invitePlayer({ viewerId: "mem-2", name: "member_mo" }), INVITES);
await mem.waitForFunction(() => document.querySelector(".to-invite")?.hidden === false, null, { timeout: 10000 }).catch(() => {});
let c = await card(mem);
check(/Invite sent/.test(line) && c.shown && /leader_lou/.test(c.text), "the member gets the leader's party invite", JSON.stringify({ line, c }));
await mem.click('.to-invite [data-act="join"]');
await sleep(1200);
const party = await lead.evaluate(() => window.__toInvites.view().people.map((p) => p.name));
check(party.includes("member_mo"), "the member's in the leader's party", JSON.stringify(party));

// ---- 2. the member asks
await mem.keyboard.press("m");
await sleep(400);
// (opening the radio reads every track's length: 22 requests, which hold
// a local HTTP/1.1 server's six connections till they're done; the live
// site is HTTP/2)
await mem.waitForFunction(() => [...document.querySelectorAll("#to-radio-list time, #to-radio-list small")].every((t) => t.tagName === "SMALL" || t.textContent !== "--:--"), null, { timeout: 60000 }).catch(() => {});
await sleep(1500);
let r = await radio(mem);
check(r.sync && /leader_lou/.test(r.sync.text) && r.sync.btn === "Sync music", "the member's radio offers to sync with the leader", JSON.stringify(r.sync));
check((await radio(lead)).sync === null, "the leader's radio shows no strip before anyone follows");
await lead.evaluate(() => { const m = window.__trollOps.music; m.playIndex(3); });
await sleep(2500);
await mem.click(".to-radio-sync button");
await sleep(800);
r = await radio(mem);
check(r.sync?.off && /Asked/.test(r.sync.text), "asking: the strip says so and waits", JSON.stringify(r.sync));
c = await card(lead);
check(c.shown && /member_mo/.test(c.text) && /sync their music/.test(c.text) && c.yes === "Accept" && /to accept/.test(c.key),
  "the leader gets the invite-style card: who, sync, Accept", JSON.stringify(c));
await lead.screenshot({ path: path.join(process.env.SHOTS || os.tmpdir(), "radio-sync-leader-card.png") }).catch(() => {});
await lead.click('.to-invite [data-act="join"]');
await sleep(1500);

// ---- 3. following
// (the first follow loads the track and seeks into it; the 4 s position
// beat pulls it in if that landed off)
let L;
for (let k = 0; k < 12; k++) {
  L = await radio(lead); r = await radio(mem);
  if (r.playing && r.i === L.i && Math.abs(r.t - L.t) < 1.6) break;
  await sleep(500);
}
check(r.playing && r.i === L.i && Math.abs(r.t - L.t) < 1.6, "the member plays the leader's track from the leader's place", JSON.stringify({ L, r }));
check(/In sync with leader_lou/.test(r.sync?.text || "") && r.sync.btn === "Stop syncing", "the member's strip: in sync, Stop syncing", JSON.stringify(r.sync));
const Ls = await radio(lead);
check(/In sync with you: member_mo/.test(Ls.sync?.text || ""), "the leader's strip: who's in sync", JSON.stringify(Ls.sync));
await mem.screenshot({ path: path.join(process.env.SHOTS || os.tmpdir(), "radio-sync-member.png") }).catch(() => {});
// a skip
await lead.evaluate(() => window.__trollOps.music.next());
await sleep(2200);
let a = await radio(lead), b = await radio(mem);
check(b.i === a.i && b.playing && Math.abs(b.t - a.t) < 1.6, "a skip: the member follows to the next track", JSON.stringify({ a, b }));
// a seek
await lead.evaluate(() => window.__trollOps.music.seek(60));
await sleep(2000);
a = await radio(lead); b = await radio(mem);
check(a.t > 59 && Math.abs(b.t - a.t) < 1.6, "a seek: the member jumps with it", JSON.stringify({ a, b }));
// a pause, then play
await lead.evaluate(() => window.__trollOps.music.pause());
await mem.waitForFunction(() => !window.__trollOps.music.playing, null, { timeout: 5000 }).catch(() => {});
b = await radio(mem);
check(!b.playing, "a pause: the member's radio pauses", JSON.stringify(b));
await lead.evaluate(() => window.__trollOps.music.play());
await mem.waitForFunction(() => window.__trollOps.music.playing, null, { timeout: 5000 }).catch(() => {});
b = await radio(mem);
check(b.playing, "and plays again with it", JSON.stringify(b));
// the leader in a match (private: no network, Supabase is blocked)
await lead.evaluate(async () => {
  const T = window.__trollOps;
  T.loadout.mapId = "trollcity";
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  await T.startGame();
});
await lead.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 180000 });
// (the party follows the leader in: the member's tab loads the match too)
await lead.evaluate(() => window.__trollOps.music.playIndex(7));
await mem.waitForFunction(() => { const m = window.__trollOps.music; return m.order[m.pos] === 7 && m.playing && m.time > 1; }, null, { timeout: 60000 }).catch(() => {});
// (as in 3: the leader's tab is busy with its match, so its state can
// reach the member late; the 4 s position beat pulls a late one in)
for (let k = 0; k < 12; k++) {
  a = await radio(lead); b = await radio(mem);
  if (b.i === 7 && a.i === 7 && b.playing && Math.abs(b.t - a.t) < 1.6) break;
  await sleep(500);
}
check(b.i === 7 && a.i === 7 && b.playing && Math.abs(b.t - a.t) < 1.6, "the leader mid-match picks a song: the member follows", JSON.stringify({ a, b }));

// ---- 4. the member takes the wheel
await mem.evaluate(() => document.getElementById("to-radio-next").click());
await sleep(1500);
b = await radio(mem);
a = await radio(lead);
check(b.sync?.btn === "Sync music" && b.i !== a.i, "the member skipping stops following", JSON.stringify(b));
check(a.sync === null || !/member_mo/.test(a.sync.text), "and the leader's told", JSON.stringify(a.sync));
check(relayed.includes("radio-sync-stop"), "(a radio-sync-stop went over the channel)");

relayOn = false;
await sleep(200);
check(!errors.length, "no page errors", errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
