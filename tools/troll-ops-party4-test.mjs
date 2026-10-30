// Troll Warfare: a party of four (menu/invites.js PARTY_SIZE; user,
// 2026-10-30: "for troll warfare max players lets increase it to 4"). The
// presence channel is faked (as troll-ops-invite-test.mjs): three join us,
// each on a pad of the stage (char-inspector.js SLOTS), the head says 4/4,
// a fifth invite is refused as full; a joined squad of four stands on all
// four pads. Name tags stay apart and on screen, desktop and phone.
// SHOTS_DIR=<dir> keeps the shots.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-party4-test.mjs
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

const SHOTS = process.env.SHOTS_DIR || path.join(ROOT, ".claude/run");
fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const member = (i) => ({ viewerId: `v-${i}`, userId: null, username: `player_${i}`, level: 3 + i, trackedAt: "2026-10-30T00:00:00Z", onlineAt: "2026-10-30T00:00:00Z" });
const me = { viewerId: "me-1", userId: null, username: null, trackedAt: "2026-10-30T00:00:00Z", onlineAt: "2026-10-30T00:00:00Z" };
await page.evaluate((list) => { window.__presence.set(list); window.__presence.sync(); }, [me, member(1), member(2), member(3), member(4)]);
await page.evaluate(() => { window.__toBo2.menu.backTo("main"); document.body.classList.add("tf-anim-off"); });
await page.waitForTimeout(600);
const INV = "/assets/games/troll-ops/menu/" + fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/menu/menu-bo2.js"), "utf8").match(/invites\.js\?v=[^"]+/)[0];
const invite = (i) => page.evaluate(([url, i]) => import(url).then((m) => m.invitePlayer({ viewerId: `v-${i}`, name: `player_${i}` })), [INV, i]);
const size = await page.evaluate((url) => import(url).then((m) => m.PARTY_SIZE), INV);
check(size === 4, "a party is four", String(size));
for (const i of [1, 2, 3]) {
  const msg = await invite(i);
  check(/^Invite sent/.test(msg), `invite ${i} goes out`, msg);
  await page.evaluate((i) => window.__presence.deliver({ k: "party-join", from: `v-${i}`, d: { to: "me-1", look: { face: "sad:og", body: "" } } }), i);
  await page.waitForTimeout(250);
}
await page.waitForTimeout(800);
const tags = () => page.evaluate(() => [...document.querySelectorAll(".to-stage-tag")].map((t) => { const r = t.getBoundingClientRect(); return { slot: +t.dataset.slot, shown: !t.hidden, name: t.querySelector("b").textContent, l: r.left, r: r.right, t: r.top, b: r.bottom }; }));
const apart = (list) => { const s = list.filter((x) => x.shown); for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) { const a = s[i], b = s[j]; if (a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b) return false; } return true; };
// (a name tag lets the pointer through: asked with it on, for the look)
const covered = () => page.evaluate(() => [...document.querySelectorAll(".to-stage-tag:not([hidden])")].filter((t) => { t.style.pointerEvents = "auto"; for (const c of t.children) c.style.pointerEvents = "auto"; const r = t.getBoundingClientRect(); const hit = [[r.left + 3, r.top + 3], [r.right - 3, r.top + 3], [r.left + 3, r.bottom - 3], [r.right - 3, r.bottom - 3]].some(([x, y]) => !t.contains(document.elementFromPoint(x, y))); t.style.pointerEvents = ""; for (const c of t.children) c.style.pointerEvents = ""; return hit; }).map((t) => t.querySelector("b").textContent));
const onScreen = (list, w, h) => list.filter((x) => x.shown).every((x) => x.l >= 0 && x.r <= w && x.t >= 0 && x.b <= h);
let t = await tags();
console.log(JSON.stringify(t.map(({ slot, shown, name }) => ({ slot, shown, name }))));
check(t.length === 4 && t.every((x) => x.shown && x.name) && new Set(t.map((x) => x.name)).size === 4, "three join: you and them on the four pads", "");
check(apart(t) && onScreen(t, 1280, 720), "their names stay apart and on screen (desktop)", JSON.stringify(t.map((x) => [x.l | 0, x.t | 0, x.r | 0, x.b | 0])));
const cov = await covered();
check(!cov.length, "no name under the columns (desktop)", JSON.stringify(cov));
const pads = await page.evaluate(() => window.__trollOps.charInspector.pads.filter((p) => p.visible).length);
check(pads === 4, "four pads on the stage", String(pads));
const headTxt = await page.evaluate(() => document.querySelector(".to-bo2-party-lbl")?.textContent || "");
check(/4\/4/.test(headTxt), "the party head counts 4/4", headTxt);
const adds = await page.evaluate(() => [...document.querySelectorAll(".to-stage-add")].filter((a) => !a.hidden).length);
check(adds === 0, "a full party: no + on any pad", String(adds));
const full = await invite(4);
check(/full \(4 of 4\)/.test(full), "a fifth invite: the party is full", full);
await page.screenshot({ path: path.join(SHOTS, "party4-desktop.png") });
// one out: their pad opens again, with a +
await page.evaluate(() => window.__presence.deliver({ k: "party-leave", from: "v-3", d: { to: "me-1" } }));
await page.waitForTimeout(800);
check(!(await covered()).length, "three: no name covered (desktop)");
await page.screenshot({ path: path.join(SHOTS, "party3-desktop.png") });
const after = await page.evaluate(() => ({ adds: [...document.querySelectorAll(".to-stage-add")].filter((a) => !a.hidden).map((a) => +a.dataset.slot), head: document.querySelector(".to-bo2-party-lbl")?.textContent }));
check(after.adds.length === 1 && /3\/4/.test(after.head || ""), "one leaves: 3/4, a + on the free pad", JSON.stringify(after));
// a joined squad of four: all four pads theirs
const THEIRS = [1, 2, 3, 4].map((i) => ({ viewer: `s-${i}`, name: `squad_${i}`, look: { face: "sad:og", body: "" } }));
await page.evaluate((t) => window.__toInvites.fakeSquad(t), THEIRS);
await page.waitForTimeout(300);
await page.evaluate(() => document.querySelector(".to-squad-arrow.is-next").click());
await page.waitForTimeout(800);
t = await tags();
check(t.filter((x) => x.shown).length === 4 && THEIRS.every((s) => t.some((x) => x.shown && x.name === s.name)), "a joined squad of four: all four on the pads", JSON.stringify(t.map((x) => x.shown && x.name)));
const party = await page.evaluate(() => window.__trollOps.charInspector.party.length);
check(party === 4, "four operators drawn for them", String(party));
await page.screenshot({ path: path.join(SHOTS, "party4-squad.png") });
await page.evaluate(() => document.querySelector(".to-squad-arrow.is-prev").click());
await invite(3).then(() => page.evaluate(() => window.__presence.deliver({ k: "party-join", from: "v-3", d: { to: "me-1", look: { face: "sad:og", body: "" } } })));
// the phone, upright
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(1200);
t = await tags();
check(t.filter((x) => x.shown).length === 4 && apart(t) && onScreen(t, 390, 844), "names apart and on screen (phone, upright)", JSON.stringify(t.filter((x) => x.shown).map((x) => [x.name, x.l | 0, x.t | 0, x.r | 0, x.b | 0])));
check(!(await covered()).length, "no name covered (phone)");
await page.screenshot({ path: path.join(SHOTS, "party4-phone.png") });
check(errors.length === 0, "no page errors", errors.slice(0, 3).join(" | "));
console.log("shots: " + SHOTS);
await browser.close(); server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
