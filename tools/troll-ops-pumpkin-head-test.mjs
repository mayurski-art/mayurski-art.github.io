// Troll Forces — the Pumpkin Head grant (progression/grants.js, cosmetics.js
// HEADS, characters/pumpkin-head.js). Supabase is swapped for an in-page fake
// whose troll_forces_claim_pumpkin_head() does what the SQL does
// (assets/supabase/troll_forces_pumpkin_head.sql), on a SERVER clock the test
// sets apart from the device's:
//   signed in inside the window: granted, a TrollNotis toast, the yellow dot
//     on the Locker tab, the Head row and the item;
//   the Head screen opened: every dot goes, and stays gone after a reload;
//   signed in after 12 November (the device's clock set back to the 1st):
//     no grant, the item stays locked;
//   granted in the window, signed in again after it: still owned, no new
//     toast, no dot;
//   worn: the operator's head is the pumpkin, the trollface board hidden.
// Offline, no match started (nothing joins a public room).
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-pumpkin-head-test.mjs
//   SHOTS=<dir> also saves the lobby, Locker, Head screen and toast

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOTS || "";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp4": "video/mp4", ".webm": "video/webm" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const FROM = Date.parse("2026-10-26T00:00:00-07:00"), UNTIL = Date.parse("2026-11-13T00:00:00-08:00");
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
const errors = [];

/* A fresh device (or `storage` from the last one), signed in as `user`,
   the server's clock at `serverNow`, the device's at `deviceNow`, the
   server's grants table `grants` ({ user: granted_at }). */
async function openGame({ user, serverNow, deviceNow = serverNow, grants = {}, storage = null }) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.route(/supabase/, (r) => r.abort());
  for (const f of ["troll-accounts.js", "troll-notis.js"]) {
    await page.route(`https://mayurski-art.github.io/assets/js/${f}`, (r) => r.fulfill({ path: path.join(ROOT, "assets/js", f), contentType: "text/javascript" }));
  }
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(({ user, serverNow, deviceNow, grants, storage, FROM, UNTIL }) => {
    if (storage && !sessionStorage.getItem("__seeded")) {
      for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v);
      sessionStorage.setItem("__seeded", "1");
    }
    // the device's clock (a player who set it back)
    const shift = deviceNow - Date.now();
    const RealDate = Date;
    class FakeDate extends RealDate {
      constructor(...a) { super(...(a.length ? a : [RealDate.now() + shift])); }
      static now() { return RealDate.now() + shift; }
    }
    window.Date = FakeDate;
    const srv = window.__srv = { now: serverNow, grants: { ...grants }, calls: 0 };
    const fake = {
      async rpc(name) {
        if (name !== "troll_forces_claim_pumpkin_head") return { data: null, error: { message: "no such function" } };
        srv.calls++;
        const open = srv.now >= FROM && srv.now < UNTIL;   // the SQL's window, on the server's clock
        if (open && !srv.grants[user]) srv.grants[user] = new RealDate(srv.now).toISOString();
        return { data: { owned: !!srv.grants[user], granted_at: srv.grants[user] || null, open }, error: null };
      },
      from() {
        const q = { select() { return q; }, eq() { return q; }, order() { return q; }, limit() { return q; },
          async maybeSingle() { return { data: null, error: null }; }, async upsert() { return { error: null }; },
          then(res) { res({ data: [], error: null }); } };
        return q;
      },
      channel() { const c = { on() { return c; }, subscribe() { return c; }, send() {}, unsubscribe() {} }; return c; },
      removeChannel() {},
    };
    let real;
    Object.defineProperty(window, "TrollrunnerAccounts", {
      configurable: true,
      get() {
        return real && Object.assign(real, {
          getClient: () => fake, getSession: async () => null,
          getCachedProfile: () => (user ? { id: user, username: user } : null),
        });
      },
      set(v) { real = v; },
    });
    // every toast the game asks for
    window.__toasts = [];
    const hook = () => {
      const tn = window.TrollNotis;
      if (!tn || tn.__hooked) return;
      const show = tn.show;
      tn.show = (n, t) => { window.__toasts.push({ id: n.id, platform: n.platform, summary: n.summary }); return show(n, t); };
      tn.__hooked = true;
    };
    let tn;
    Object.defineProperty(window, "TrollNotis", { configurable: true, get() { return tn; }, set(v) { tn = v; hook(); } });
  }, { user, serverNow, deviceNow, grants, storage, FROM, UNTIL });
  await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__toBo2?.fn && !!window.__trollOps, null, { timeout: 180000 });
  // sign-in lands after the game is up (the accounts script's own event)
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("trollrunner:auth-changed")));
  await page.waitForTimeout(1500);
  return { ctx, page };
}

const state = (page) => page.evaluate(() => {
  const vis = (el) => !!el && !el.hidden && getComputedStyle(el).display !== "none";
  const menu = window.__toBo2.menu;
  return {
    calls: window.__srv.calls,
    grants: window.__srv.grants,
    toasts: window.__toasts.slice(),
    toastShown: !!document.querySelector('.tn-toast[data-platform="reward"]'),
    lockerDot: vis(document.querySelector('.to-fn-tab[data-tab="locker"] .to-fn-dot')),
    screen: menu.current(),
    rowDots: [...document.querySelectorAll(".tr-menu-item > .to-fn-dot.is-row")].map((d) => d.parentElement.dataset.id),
    headCard: (() => { const b = document.querySelector('#to-cos-body [data-head="pumpkin"]'); return b ? { locked: b.getAttribute("aria-disabled") === "true", on: b.getAttribute("aria-checked") === "true" } : null; })(),
    store: Object.fromEntries(["trollops:grants", "trollops:new-items", "trollops:grants-told", "trollops:cosmetics"].map((k) => [k, localStorage.getItem(k)])),
  };
});
const go = (page, ids) => page.evaluate(async (ids) => {
  const m = window.__toBo2.menu;
  for (const id of ids) { m.go(id); await new Promise((r) => setTimeout(r, 400)); }
}, ids);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `pumpkin-${name}.png`) }); };

// ---- 1. inside the window: granted, toast, dots
const IN = Date.parse("2026-10-31T12:00:00-07:00");
let { ctx, page } = await openGame({ user: "alice", serverNow: IN });
let s = await state(page);
check("signed in inside the window: the server grants it", !!s.grants.alice && s.calls >= 1, JSON.stringify(s.grants));
check("a TrollNotis toast goes out once, as a reward", s.toasts.length === 1 && s.toasts[0].platform === "reward" && s.toastShown, JSON.stringify(s.toasts));
check("the Locker tab wears the yellow dot", s.lockerDot);
check("the Pumpkin Head card unlocks", s.headCard && !s.headCard.locked, JSON.stringify(s.headCard));
await shot(page, "1-lobby-toast");
await page.click('.to-fn-tab[data-tab="locker"]');
await page.waitForTimeout(900);
s = await state(page);
check("Locker: the Face tile wears the dot", s.screen === "locker" && s.rowDots.includes("face"), `${s.screen} ${JSON.stringify(s.rowDots)}`);
await shot(page, "2-locker-dot");
await go(page, ["faces"]);
s = await state(page);
check("Face screen: the Pumpkin Head card wears the dot", s.screen === "faces" && s.rowDots.length === 1, JSON.stringify(s.rowDots));
check("and opening it marks it seen: the Locker tab's dot goes", !s.lockerDot && JSON.parse(s.store["trollops:new-items"] || "{}").alice === undefined, s.store["trollops:new-items"]);
await shot(page, "3-faces-dot");
// wear it
await page.evaluate(() => document.querySelector('#to-cos-body [data-head="pumpkin"]').click());
await page.waitForTimeout(600);
await page.evaluate(() => window.__toBo2.menu.backTo("locker"));
await go(page, ["faces"]);
s = await state(page);
check("back on the Face screen: no dot now", s.rowDots.length === 0, JSON.stringify(s.rowDots));
await page.evaluate(() => window.__toBo2.menu.backTo("main"));
await page.click('.to-fn-tab[data-tab="play"]').catch(() => {});
await page.waitForTimeout(1200);
const worn = await page.evaluate(() => {
  const T = window.__trollOps, ci = T.charInspector, h = ci?.humanoid, rig = T.localRig || window.__trollOps.game?.localRig;
  for (let i = 0; i < 3; i++) ci?.tick?.(0.016);   // (the operator poses each frame; a hidden tab may not run frames)
  return { face: h?.face, shown: h?.headwearShown, board: h?.parts.head.visible, mesh: !!h?.headwearMesh, local: rig?.face };
});
check("worn: the face key carries it and the operator's head is the pumpkin", /:pumpkin$/.test(worn.face || "") && worn.shown === "pumpkin" && worn.mesh && worn.board === false, JSON.stringify(worn));
await shot(page, "4-lobby-worn");
const storage = (await state(page)).store;
await ctx.close();

// ---- 2. a reload on that device: seen stays seen, still owned, no second toast
({ ctx, page } = await openGame({ user: "alice", serverNow: IN, grants: { alice: new Date(IN).toISOString() }, storage }));
s = await state(page);
check("reloaded: no second toast, no dot, still worn", s.toasts.length === 0 && !s.lockerDot && s.headCard?.on, JSON.stringify({ t: s.toasts.length, dot: s.lockerDot, card: s.headCard }));
await ctx.close();

// ---- 3. after the window, the device's clock set back into it: nothing
const AFTER = Date.parse("2026-11-14T10:00:00-08:00");
({ ctx, page } = await openGame({ user: "bob", serverNow: AFTER, deviceNow: Date.parse("2026-11-01T10:00:00-07:00") }));
s = await state(page);
check("after 12 Nov (device clock set back to 1 Nov): no grant", !s.grants.bob && s.calls >= 1, JSON.stringify(s.grants));
check("no toast, no dot, the card stays locked", s.toasts.length === 0 && !s.lockerDot && s.headCard?.locked, JSON.stringify({ t: s.toasts, dot: s.lockerDot, card: s.headCard }));
// a face key that claims it anyway doesn't put it on
const forced = await page.evaluate(async () => {
  localStorage.setItem("trollops:cosmetics", JSON.stringify({ face: "grin:og:::pumpkin", body: "" }));
  document.querySelector('#to-cos-body [data-head="pumpkin"]').click();
  await new Promise((r) => setTimeout(r, 300));
  const h = window.__trollOps.charInspector?.humanoid;
  return { face: h?.face, shown: h?.headwearShown || "" };
});
check("and clicking the locked card doesn't put it on", !/pumpkin/.test(forced.face || "") && !forced.shown, JSON.stringify(forced));
await ctx.close();

// ---- 4. granted in the window (the backfill, 28 Oct), signed in after it: kept
({ ctx, page } = await openGame({ user: "carol", serverNow: Date.parse("2026-12-01T10:00:00-08:00"), grants: { carol: "2026-10-28T19:00:00Z" } }));
s = await state(page);
check("granted in the window, signing in after 12 Nov: still owned", s.headCard && !s.headCard.locked, JSON.stringify(s.headCard));
check("first time on this device: one toast and the dot (nobody told them yet)", s.toasts.length === 1 && s.lockerDot, JSON.stringify({ t: s.toasts.length, dot: s.lockerDot }));
await ctx.close();

// ---- 5. signed out: nothing asked, nothing owned
({ ctx, page } = await openGame({ user: null, serverNow: IN }));
s = await state(page);
check("a guest: no claim sent, the card locked", s.calls === 0 && s.headCard?.locked, JSON.stringify({ calls: s.calls, card: s.headCard }));
await ctx.close();

const real = errors.filter((e) => !/supabase|Failed to fetch|NetworkError|ERR_FAILED/i.test(e));
check("no page errors", !real.length, real.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
