// Troll Forces: do the bots move for someone who isn't the bot host?
//
// Two (or three) tabs play quick-play TDM on Cul-de-Grin. Supabase is
// blocked, so "QTDM" is a BroadcastChannel room inside this one headless
// browser and never the live public room. Tab A starts first and hosts the
// bots; tab B joins. Every scenario measures, from B's side, how far the
// bots B is shown walk (B's peer snapshots), the way the gate's bots step
// measures them on the host.
//
// Usage: node tools/troll-ops-bot-host-test.mjs [scenario ...]
//   scenarios: plain, latejoin, hidden, slowhost, othermap, hostquit
// User report 2026-10-10: every bot frozen from the start of a public TDM
// match on Cul-de-Grin; offline (one tab) every map's bots move.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });

/* A fresh context per scenario: BroadcastChannel is per context, so one
   scenario's room never leaks into the next. */
async function tab(ctx, label, errors, { map = "culdegrin", start = true } = {}) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 120000 });
  await page.evaluate(async ({ map, start }) => {
    const T = window.__trollOps;
    T.composer.render = () => {};   // nothing here looks at pixels
    T.setMode("tdm");
    T.loadout.mapId = map;
    if (T.els.noBots) T.els.noBots.checked = false;
    T.els.room.value = "";          // quick play: the QTDM room (local only, Supabase is blocked)
    T.els.room.dispatchEvent(new Event("input"));
    window.__walk = { path: new Map(), at: new Map() };
    if (start) await T.startGame();
  }, { map, start });
  return page;
}

const startOn = (page) => page.evaluate(() => { window.__trollOps.startGame(); });

/* Slow a tab's CPU by `rate` (1 = normal) and its downloads to match, so its
   map loads the way a heavy map does on the live site. */
async function throttle(page, rate) {
  const cdp = page.__cdp || (page.__cdp = await page.context().newCDPSession(page));
  await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", rate > 1
    ? { offline: false, latency: 100, downloadThroughput: 4e6 / 8, uploadThroughput: 1e6 / 8 }
    : { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
}

/* Who the page thinks hosts, what it's doing, and its bot count. */
const status = (page) => page.evaluate(() => {
  const T = window.__trollOps;
  const N = T.net, now = performance.now();
  const ghosts = [...N.peers.values()].filter((p) => (p.isBot || /^bot-/.test(p.id)) && !T.bots.byId(p.id)).map((p) => ({ id: p.id, age: Math.round(now - p.last), isBot: !!p.isBot, alive: p.alive, snaps: p.snaps?.length }));
  const why = { me: { since: N.since, stateAge: Math.round(now - (N._stateAt || 0)), frameMs: Math.round(N._frameMs ?? 0), conn: N.connected },
    peers: [...N.peers.values()].filter((p) => !(p.isBot || /^bot-/.test(p.id))).map((p) => ({ id: p.id, since: p.since, stateAge: Math.round(now - (p.stateAt || 0)), slow: p.slow })) };
  return { ghosts, why, id: T.net.id, host: T.net.hostId?.(), isHost: T.net.isBotHost(), state: T.state(), staging: !!T.isStaging?.(),
    stageT: +(T.stageT?.() ?? 0).toFixed(1), map: T.loadout.mapId, loaded: T.loadedMapId?.(), room: T.net.room || null,
    bots: T.bots.bots.length, botPeers: [...T.net.peers.values()].filter((p) => p.isBot || /^bot-/.test(p.id)).length };
});

/* From `page`'s side: how far each bot it's shown walks over `secs` (wall
   clock), read from the bot peers' latest snapshots. */
async function measure(page, secs) {
  await page.evaluate(() => { window.__walk = { path: new Map(), at: new Map(), t0: performance.now() }; });
  const end = Date.now() + secs * 1000;
  while (Date.now() < end) {
    await page.evaluate(() => {
      const W = window.__walk;
      for (const p of window.__trollOps.net.peers.values()) {
        if (!(p.isBot || /^bot-/.test(p.id)) || !p.alive) continue;
        const s = p.snaps?.at(-1); if (!s) continue;
        const prev = W.at.get(p.id);
        if (prev) W.path.set(p.id, (W.path.get(p.id) || 0) + Math.hypot(s.x - prev[0], s.z - prev[1]));
        else W.path.set(p.id, 0);
        W.at.set(p.id, [s.x, s.z]);
      }
    });
    await sleep(250);
  }
  return page.evaluate((secs) => {
    const d = [...window.__walk.path.values()];
    return { bots: d.length, avg: d.length ? d.reduce((a, b) => a + b, 0) / d.length / secs : 0, still: d.filter((x) => x / secs < 0.5).length };
  }, secs);
}

const waitPlaying = (page) => page.waitForFunction(() => {
  const T = window.__trollOps; return T.state() === "playing" && !T.isStaging?.();
}, null, { timeout: 180000 });

const SCENARIOS = {
  /* Baseline: A hosts, B joins a beat later, both play out the countdown. */
  async plain(ctx, errors) {
    const A = await tab(ctx, "A", errors);
    await sleep(1500);
    const B = await tab(ctx, "B", errors);
    await Promise.all([waitPlaying(A), waitPlaying(B)]);
    await sleep(2000);
    return { A, B };
  },
  /* B joins once A's match is already running (past the countdown). */
  async latejoin(ctx, errors) {
    const A = await tab(ctx, "A", errors);
    await waitPlaying(A);
    await sleep(3000);
    const B = await tab(ctx, "B", errors);
    await waitPlaying(B);
    await sleep(2000);
    return { A, B };
  },
  /* The host's tab is hidden (switched away): rAF stops, timers run at 1 Hz. */
  async hidden(ctx, errors) {
    const { A, B } = await SCENARIOS.plain(ctx, errors);
    await A.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb) => setTimeout(() => raf(cb), 1000);
    });
    await sleep(20000);   // past LIVE_MS: the role should have moved by now
    return { A, B };
  },
  /* The host is alive but slow: 1 frame a second, still sending state. */
  async slowhost(ctx, errors) {
    const { A, B } = await SCENARIOS.plain(ctx, errors);
    await A.evaluate(() => {
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb) => setTimeout(() => raf(cb), 1000);
    });
    await sleep(20000);
    return { A, B };
  },
  /* A hosts Grin Site; B asked for Cul-de-Grin. */
  async othermap(ctx, errors) {
    const A = await tab(ctx, "A", errors, { map: "grinsite" });
    await sleep(1500);
    const B = await tab(ctx, "B", errors, { map: "culdegrin" });
    await Promise.all([waitPlaying(A), waitPlaying(B)]);
    await sleep(2000);
    return { A, B };
  },
  /* The heavy maps (Cul-de-Grin, Grin Beach, Hollowgrin) take a minute to
     load on the live site, three times the light ones. The host loads
     slowly; B is quick. */
  async slowload(ctx, errors) {
    const A = await tab(ctx, "A", errors, { start: false });
    await throttle(A, 6);
    await startOn(A);
    await sleep(1500);
    const B = await tab(ctx, "B", errors);
    await Promise.all([waitPlaying(A), waitPlaying(B)]);
    await throttle(A, 1);
    await sleep(2000);
    return { A, B };
  },
  /* ...and the other way round: the host is quick, B loads slowly. */
  async slowjoin(ctx, errors) {
    const A = await tab(ctx, "A", errors);
    await sleep(1500);
    const B = await tab(ctx, "B", errors, { start: false });
    await throttle(B, 6);
    await startOn(B);
    await Promise.all([waitPlaying(A), waitPlaying(B)]);
    await throttle(B, 1);
    await sleep(2000);
    return { A, B };
  },
  /* B's main thread stalls for 7 s (a heavy map building, shaders
     compiling), past PEER_TIMEOUT. Each side used to drop the other, then
     re-learn it from a state message with no join time, take it for the
     older one, and leave the bots to it: nobody ran them (2026-10-11). */
  async stall(ctx, errors) {
    const { A, B } = await SCENARIOS.plain(ctx, errors);
    await B.evaluate(() => { const end = performance.now() + 7000; while (performance.now() < end) { /* busy */ } });
    await sleep(3000);
    return { A, B };
  },
  /* The host quits to the menu but its tab stays open. */
  async hostquit(ctx, errors) {
    const { A, B } = await SCENARIOS.plain(ctx, errors);
    await A.evaluate(() => document.querySelector("#to-quit-btn")?.click());
    await sleep(20000);
    return { A, B };
  },
};

const pick = process.argv.slice(2).filter((s) => SCENARIOS[s]);
for (const name of pick.length ? pick : Object.keys(SCENARIOS)) {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 200 } });
  await ctx.route(/supabase/, (r) => r.abort());
  const errors = [];
  try {
    const { A, B } = await SCENARIOS[name](ctx, errors);
    const [sa, sb] = [await status(A), await status(B)];
    const [m, ma] = await Promise.all([measure(B, 12), A.isClosed() ? null : measure(A, 12)]);
    const detail = `B sees ${m.bots} bots, avg ${m.avg.toFixed(2)} m/s, ${m.still} still${ma ? ` | A sees ${ma.bots}, avg ${ma.avg.toFixed(2)}, ${ma.still} still` : ""} | A ${JSON.stringify(sa)} | B ${JSON.stringify(sb)}${errors.length ? ` | ${errors.slice(0, 2).join(" | ")}` : ""}`;
    check(`${name}: the bots move for the player who isn't hosting`, m.bots > 0 && m.still === 0 && m.avg > 1, detail);
    if (!A.isClosed() && name !== "hostquit") {
      const [ha, hb] = [await status(A), await status(B)];
      check(`${name}: both tabs agree who runs the bots`, ha.host === hb.host, `A says ${ha.host}, B says ${hb.host}`);
    }
  } catch (e) {
    check(`${name}: ran`, false, e.message.split("\n")[0]);
  }
  await ctx.close();
}

await browser.close();
server.close();
console.log(failures ? `\n${failures} failed` : "\nALL PASS");
process.exit(failures ? 1 : 0);
