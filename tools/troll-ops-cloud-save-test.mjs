// Troll Forces — the setup follows the account (cloud-save.js). Supabase is
// swapped for an in-page fake of troll_game_saves, then:
//   signing in pulls the account's setup into the running game (settings,
//   streaks, loadout), graphics quality staying this device's own;
//   changing something while signed in uploads it;
//   changing something signed out stays on the device.
//
// Usage: node tools/troll-ops-cloud-save-test.mjs

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
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".gif": "image/gif" };
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
// The fake backend goes in before any page script runs.
await page.addInitScript(() => {
  const rows = new Map();   // "user|game" -> { data, updated_at }
  const log = [];
  window.__cloud = { rows, log };
  const fake = {
    from(table) {
      const q = { table, filters: {} };
      return {
        select() { return this; },
        eq(col, v) { q.filters[col] = v; return this; },
        async maybeSingle() {
          log.push({ op: "select", ...q.filters });
          const r = rows.get(`${q.filters.user_id}|${q.filters.game_id}`);
          return { data: r ? JSON.parse(JSON.stringify(r)) : null, error: null };
        },
        async upsert(row) {
          log.push({ op: "upsert", user: row.user_id, game: row.game_id });
          rows.set(`${row.user_id}|${row.game_id}`, { data: JSON.parse(JSON.stringify(row.data)), updated_at: row.updated_at });
          return { error: null };
        },
      };
    },
  };
  let real;
  Object.defineProperty(window, "TrollrunnerAccounts", {
    configurable: true,
    get() { return real && Object.assign(real, { getClient: () => fake, getSession: async () => null, getCachedProfile: () => null }); },
    set(v) { real = v; },
  });
});
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });

// ---- 1. sign in on a "new device": the account's setup comes down
const before = await page.evaluate(() => ({ sens: window.__trollOps.settings.sens, gfx: window.__trollOps.settings.gfx }));
const signedIn = await page.evaluate(async () => {
  const T = window.__trollOps;
  window.__cloud.rows.set("u1|troll-forces", {
    updated_at: new Date().toISOString(),
    data: { v: 1, keys: {
      "trollops:settings": JSON.stringify({ ...T.settings, sens: 40, fov: 95, gfx: "low" }),
      "trollops:streaks": JSON.stringify({ selected: ["uav", "k9", "warship"] }),
    } },
  });
  window.dispatchEvent(new CustomEvent("trollrunner:auth-changed", { detail: { userId: "u1" } }));
  await new Promise((r) => setTimeout(r, 600));
  return {
    sens: T.settings.sens, fov: T.settings.fov, gfx: T.settings.gfx,
    streaks: JSON.parse(localStorage.getItem("trollops:streaks") || "{}").selected,
    sensUi: document.getElementById("to-set-sens")?.value,
    uploads: window.__cloud.log.filter((l) => l.op === "upsert").length,
  };
});
check("signing in brings the account's settings into the running game", signedIn.sens === 40 && signedIn.fov === 95 && String(signedIn.sensUi) === "40", JSON.stringify(signedIn));
check("graphics quality stays this device's own", signedIn.gfx === before.gfx, `${before.gfx} -> ${signedIn.gfx}`);
check("and the scorestreak picks come down too", JSON.stringify(signedIn.streaks) === JSON.stringify(["uav", "k9", "warship"]), JSON.stringify(signedIn.streaks));
check("pulling the account's copy doesn't bounce it straight back up", signedIn.uploads === 0, `${signedIn.uploads} uploads`);

// ---- 2. change something signed in: it goes up
const pushed = await page.evaluate(async () => {
  const s = JSON.parse(localStorage.getItem("trollops:settings"));
  s.sens = 64;
  localStorage.setItem("trollops:settings", JSON.stringify(s));
  const lo = JSON.parse(localStorage.getItem("trollops:loadout") || "{}");
  lo.meleeId = "keyboard";
  localStorage.setItem("trollops:loadout", JSON.stringify(lo));
  await new Promise((r) => setTimeout(r, 2500));
  const row = window.__cloud.rows.get("u1|troll-forces");
  return {
    uploads: window.__cloud.log.filter((l) => l.op === "upsert").length,
    sens: JSON.parse(row.data.keys["trollops:settings"]).sens,
    melee: JSON.parse(row.data.keys["trollops:loadout"] || "{}").meleeId,
  };
});
check("a change while signed in is saved to the account (once, debounced)", pushed.uploads === 1 && pushed.sens === 64 && pushed.melee === "keyboard", JSON.stringify(pushed));

// ---- 3. another device changed it: coming back to the tab pulls it
const pulled = await page.evaluate(async () => {
  const T = window.__trollOps;
  const row = window.__cloud.rows.get("u1|troll-forces");
  const keys = { ...row.data.keys, "trollops:settings": JSON.stringify({ ...JSON.parse(row.data.keys["trollops:settings"]), sens: 81 }) };
  window.__cloud.rows.set("u1|troll-forces", { data: { v: 1, keys }, updated_at: new Date(Date.now() + 5000).toISOString() });
  // Sign out and back in (a fresh pull), as switching devices would.
  window.dispatchEvent(new CustomEvent("trollrunner:auth-changed", { detail: null }));
  await new Promise((r) => setTimeout(r, 100));
  window.dispatchEvent(new CustomEvent("trollrunner:auth-changed", { detail: { userId: "u1" } }));
  await new Promise((r) => setTimeout(r, 600));
  return { sens: T.settings.sens };
});
check("a change made on another device arrives here", pulled.sens === 81, JSON.stringify(pulled));

// ---- 4. signed out: changes stay local
const guest = await page.evaluate(async () => {
  window.dispatchEvent(new CustomEvent("trollrunner:auth-changed", { detail: null }));
  await new Promise((r) => setTimeout(r, 100));
  const n = window.__cloud.log.filter((l) => l.op === "upsert").length;
  const s = JSON.parse(localStorage.getItem("trollops:settings"));
  s.sens = 12;
  localStorage.setItem("trollops:settings", JSON.stringify(s));
  await new Promise((r) => setTimeout(r, 2500));
  return { more: window.__cloud.log.filter((l) => l.op === "upsert").length - n };
});
check("signed out, nothing is uploaded", guest.more === 0, JSON.stringify(guest));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
