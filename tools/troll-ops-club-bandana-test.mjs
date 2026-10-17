// Troll Forces Socialize: a PLAYER in a bandana at Trolling Loud's door
// (modes/club-entry.js, phase "bandana").
//
// Two tabs share a private room over BroadcastChannel (Supabase blocked,
// never a live room); tab A wears a red bandana, tab B is a plain guest.
//   1. A reaches the bouncer: "Bandana off?" (1 / 2, Off it comes / Keep it
//      on); B sees A at the lane with the bandana still on.
//   2. Yes: the bandana's off on A and on B's copy of A, A's saved face
//      isn't touched, and the normal 18+ question follows.
//   3. No (a fresh pair of tabs): A gets the kick-out, B watches it.
//   4. Ignoring him (solo tab, a short timer): the same kick-out.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-club-bandana-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

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
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const BAND_FACE = "grin:og:bandana-red";
const errors = [];

/* A fresh room (a new context) with A in a bandana and (optionally) B. */
async function room(withB) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
  await ctx.route(/supabase/, (r) => r.abort());
  const pages = [];
  const pump = async (ms) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) for (const p of pages) await p.screenshot({ type: "jpeg", quality: 10 }).catch(() => {});
  };
  async function open(label, bandana) {
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
    await page.addInitScript((bandana) => {
      const fake = { getCachedProfile: () => null };
      Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => fake, set: () => {} });
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
      if (bandana) localStorage.setItem("trollops:cosmetics", JSON.stringify({ face: bandana, body: "" }));
    }, bandana);
    await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 420000 });
    await page.waitForFunction(() => !!window.__trollOps && !!window.__trollClub, null, { timeout: 420000 });
    await page.evaluate(() => {
      window.__trollOps.setLoadWaitMax(8);
      Object.assign(window.__trollClub.T, { checkSecs: 0.6, idSecs: 1, bandSecs: 1, lockSecs: 2, afkSecs: 600, minAhead: 3, bandanaEvery: 1e9, bandanaAskSecs: 120 });
    });
    await page.evaluate(async () => {
      const T = window.__trollOps;
      T.setMode("social");
      T.loadout.mapId = "trollingloud";
      await T.startGame();
    });
    await page.waitForFunction(() => !window.__trollOps.loadState().open, null, { timeout: 420000 });
    await page.evaluate(() => { window.__trollOps.els.pause.hidden = true; });
    pages.push(page);
    await pump(500);
    return page;
  }
  const A = await open("A", BAND_FACE);
  const B = withB ? await open("B", null) : null;
  const st = (p) => p.evaluate(() => {
    const C = window.__trollClub, c = C.club, T = window.__trollOps, r = C.room();
    return { phase: c.phase, face: T.localRig.face, saved: localStorage.getItem("trollops:cosmetics"),
      q: document.querySelector(".club-ask:not([hidden]) #club-ask-q")?.textContent || "",
      btns: [...document.querySelectorAll(".club-ask:not([hidden]) button")].map((b) => b.textContent.trim()),
      id: r.me, wire: { ...r.wire }, remotes: r.remotes };
  });
  async function until(page, pred, ms) {
    const t0 = Date.now();
    let s = await st(page);
    while (Date.now() - t0 < ms && !pred(s)) { await pump(200); s = await st(page); }
    return s;
  }
  return { A, B, st, until, pump, close: () => ctx.close() };
}

// 1 + 2. Yes
let R = await room(true);
let a = await R.until(R.A, (s) => s.phase === "bandana", 120000);
check("A gets the bandana question at the bouncer", a.phase === "bandana" && a.q === "Bandana off?", JSON.stringify({ phase: a.phase, q: a.q }));
check("with two choices", a.btns.length === 2 && /Off it comes/.test(a.btns[0]) && /Keep it on/.test(a.btns[1]), a.btns.join("|"));
await R.pump(600);
let b = await R.st(R.B);
const aOnB = () => b.remotes.find((r) => r.id === a.id);
check("B sees A at the lane, bandana still on", /bandana-red/.test(aOnB()?.face || "") && aOnB()?.ph === "ask", JSON.stringify(aOnB()));
await R.A.keyboard.press("Digit1");
a = await R.until(R.A, (s) => s.phase !== "bandana", 5000);
check("Yes (key 1): the bandana's off on A", !/bandana/.test(a.face), a.face);
check("A's saved cosmetic isn't touched", /bandana-red/.test(a.saved || ""), a.saved);
b = await R.until(R.B, (s) => { const r = s.remotes.find((x) => x.id === a.id); return r && !/bandana/.test(r.face); }, 8000);
check("B's copy of A has no bandana", !/bandana/.test(aOnB()?.face ?? "bandana"), JSON.stringify(aOnB()));
a = await R.until(R.A, (s) => s.q.includes("18"), 10000);
check("then the normal 18+ question", a.q.includes("18"), a.q);
await R.A.evaluate(() => window.__trollClub.answer(true));
a = await R.until(R.A, (s) => s.phase === "in", 15000);
check("and A walks in, bandana-less", a.phase === "in" && !/bandana/.test(a.face), JSON.stringify({ phase: a.phase, face: a.face }));
await R.close();

// 3. No
R = await room(true);
a = await R.until(R.A, (s) => s.phase === "bandana", 120000);
await R.pump(500);
await R.A.keyboard.press("Digit2");
a = await R.until(R.A, (s) => s.phase === "kick", 5000);
check("No (key 2): A is thrown out", a.phase === "kick", a.phase);
b = await R.until(R.B, (s) => s.remotes.find((r) => r.id === a.id)?.kick > 0.5, 8000);
check("B watches A's kick-out", b.remotes.find((r) => r.id === a.id)?.ph === "kick", JSON.stringify(b.remotes));
a = await R.until(R.A, (s) => s.phase === "lockout", 15000);
check("A ends on the curb, locked out, bandana still on", a.phase === "lockout" && /bandana-red/.test(a.face), JSON.stringify({ phase: a.phase, face: a.face }));
await R.close();

// 4. Ignored
R = await room(false);
await R.A.evaluate(() => { window.__trollClub.T.bandanaAskSecs = 1.5; });
a = await R.until(R.A, (s) => s.phase === "bandana", 120000);
a = await R.until(R.A, (s) => s.phase === "kick", 8000);
check("ignoring the bouncer is a no: thrown out", a.phase === "kick", a.phase);
await R.close();

check("no page errors", errors.length === 0, errors.slice(0, 4).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASSED");
process.exit(failures ? 1 : 0);
