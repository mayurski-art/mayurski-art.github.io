// Troll Forces — the setup follows the account (cloud-save.js). Supabase is
// swapped for an in-page fake of troll_game_saves, then:
//   signing in pulls the account's setup into the running game (settings,
//   streaks, loadout), graphics quality staying this device's own;
//   changing something while signed in uploads it;
//   changing something signed out stays on the device;
//   a device booting with a stale setup doesn't overwrite the account's
//   (the game re-saves things at boot; those aren't your changes);
//   a graphics-quality change, or a re-save of the same content, isn't a
//   change worth uploading.
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
const errors = [];
// The fake backend goes in before any page script runs. `seed` runs first
// (localStorage this device already has, a cached sign-in, a slow select).
async function openGame(seed) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await page.route(/supabase/, (r) => r.abort());
  page.on("pageerror", (e) => errors.push(e.message));
  if (seed) await page.addInitScript(seed);
  await page.addInitScript(() => {
    const rows = new Map();   // "user|game" -> { data, updated_at }
    const log = [];
    const boot = window.__cloudBoot || {};
    window.__cloud = { rows, log, selectDelay: boot.selectDelay || 0 };
    for (const [k, v] of Object.entries(boot.rows || {})) rows.set(k, v);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const fake = {
      from(table) {
        const q = { table, filters: {} };
        return {
          select() { return this; },
          eq(col, v) { q.filters[col] = v; return this; },
          async maybeSingle() {
            log.push({ op: "select", ...q.filters });
            if (window.__cloud.selectDelay) await sleep(window.__cloud.selectDelay);
            const r = rows.get(`${q.filters.user_id}|${q.filters.game_id}`);
            return { data: r ? JSON.parse(JSON.stringify(r)) : null, error: null };
          },
          async upsert(row) {
            let melee = null;
            try { melee = JSON.parse(row.data.keys["trollops:loadout"]).meleeId; } catch { /* no loadout in the blob */ }
            log.push({ op: "upsert", user: row.user_id, game: row.game_id, melee });
            rows.set(`${row.user_id}|${row.game_id}`, { data: JSON.parse(JSON.stringify(row.data)), updated_at: row.updated_at });
            return { error: null };
          },
        };
      },
    };
    let real;
    Object.defineProperty(window, "TrollrunnerAccounts", {
      configurable: true,
      get() {
        return real && Object.assign(real, {
          getClient: () => fake, getSession: async () => null,
          getCachedProfile: () => (boot.user ? { id: boot.user } : null),
        });
      },
      set(v) { real = v; },
    });
  });
  await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
  return page;
}
const page = await openGame();

// ---- 1. sign in on a "new device": the account's setup comes down
const before = await page.evaluate(() => ({ sens: window.__trollOps.settings.sens, gfx: window.__trollOps.settings.gfx }));
const signedIn = await page.evaluate(async () => {
  const T = window.__trollOps;
  // This device has a loadout saved; the account's copy has none.
  localStorage.setItem("trollops:loadout", JSON.stringify({ weaponId: "problem416", secondaryId: "sixtynine", meleeId: "keyboard", attachments: {} }));
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
    // The account had no loadout: this device's should join the row, with
    // the account's own values untouched.
    row: (() => {
      const r = window.__cloud.rows.get("u1|troll-forces").data.keys;
      return { sens: JSON.parse(r["trollops:settings"]).sens, streaks: JSON.parse(r["trollops:streaks"]).selected, hasLoadout: r["trollops:loadout"] != null };
    })(),
  };
});
check("signing in brings the account's settings into the running game", signedIn.sens === 40 && signedIn.fov === 95 && String(signedIn.sensUi) === "40", JSON.stringify(signedIn));
check("graphics quality stays this device's own", signedIn.gfx === before.gfx, `${before.gfx} -> ${signedIn.gfx}`);
check("and the scorestreak picks come down too", JSON.stringify(signedIn.streaks) === JSON.stringify(["uav", "k9", "warship"]), JSON.stringify(signedIn.streaks));
check("the keys the account lacked go up once, merged, without touching the account's own",
  signedIn.uploads === 1 && signedIn.row.hasLoadout && signedIn.row.sens === 40 && JSON.stringify(signedIn.row.streaks) === JSON.stringify(["uav", "k9", "warship"]),
  `${signedIn.uploads} uploads, row ${JSON.stringify(signedIn.row)}`);

// ---- 2. change something signed in: it goes up
const pushed = await page.evaluate(async () => {
  const n = window.__cloud.log.filter((l) => l.op === "upsert").length;
  const s = JSON.parse(localStorage.getItem("trollops:settings"));
  s.sens = 64;
  localStorage.setItem("trollops:settings", JSON.stringify(s));
  const lo = JSON.parse(localStorage.getItem("trollops:loadout") || "{}");
  lo.meleeId = "keyboard";
  localStorage.setItem("trollops:loadout", JSON.stringify(lo));
  await new Promise((r) => setTimeout(r, 2500));
  const row = window.__cloud.rows.get("u1|troll-forces");
  return {
    uploads: window.__cloud.log.filter((l) => l.op === "upsert").length - n,
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

// ---- 5. a device with a stale setup signs in while the game is still
// re-saving things at boot: the account's copy must win, not the stale one.
// The phone picked the trollsaber (cloud, a minute ago); this PC still has
// the keyboard, and something writes a synced key 50 ms into a 300 ms pull.
const stale = await page.evaluate(async () => {
  const row = window.__cloud.rows.get("u1|troll-forces");
  const T1 = Date.now() - 60000;
  const cloudKeys = { ...row.data.keys, "trollops:loadout": JSON.stringify({ ...JSON.parse(row.data.keys["trollops:loadout"]), meleeId: "trollsaber" }) };
  window.__cloud.rows.set("u1|troll-forces", { data: { v: 1, keys: cloudKeys }, updated_at: new Date(T1).toISOString() });
  const Y = { ...JSON.parse(row.data.keys["trollops:loadout"]), meleeId: "keyboard" };
  localStorage.setItem("trollops:loadout", JSON.stringify(Y));   // signed out: local only
  window.__cloud.selectDelay = 300;
  const n = window.__cloud.log.length;
  window.dispatchEvent(new CustomEvent("trollrunner:auth-changed", { detail: { userId: "u1" } }));
  await new Promise((r) => setTimeout(r, 50));
  // Boot normalisation: a module re-saves what it loaded, keys in its own order.
  const { meleeId, ...rest } = Y;
  localStorage.setItem("trollops:loadout", JSON.stringify({ meleeId, ...rest }));
  // ...and one that really does change the value during boot.
  localStorage.setItem("trollops:loadout", JSON.stringify({ ...Y, meleeId: "knuckles" }));
  await new Promise((r) => setTimeout(r, 2500));
  window.__cloud.selectDelay = 0;
  const ups = window.__cloud.log.slice(n).filter((l) => l.op === "upsert");
  return {
    device: JSON.parse(localStorage.getItem("trollops:loadout")).meleeId,
    cloud: JSON.parse(window.__cloud.rows.get("u1|troll-forces").data.keys["trollops:loadout"]).meleeId,
    uploads: ups.map((u) => u.melee),
  };
});
check("a stale device booting doesn't overwrite the account's loadout", stale.device === "trollsaber" && stale.cloud === "trollsaber" && stale.uploads.length === 0, JSON.stringify(stale));

// ---- 6. once the first pull is in, a real change goes up; a re-save of the
// same content, or a graphics-quality change, doesn't.
const after = await page.evaluate(async () => {
  const count = () => window.__cloud.log.filter((l) => l.op === "upsert").length;
  const n0 = count();
  const lo = JSON.parse(localStorage.getItem("trollops:loadout"));
  localStorage.setItem("trollops:loadout", JSON.stringify({ ...lo, meleeId: "reaper" }));
  await new Promise((r) => setTimeout(r, 2500));
  const real = { uploads: count() - n0, cloud: JSON.parse(window.__cloud.rows.get("u1|troll-forces").data.keys["trollops:loadout"]).meleeId };
  const n1 = count();
  const { meleeId, ...rest } = JSON.parse(localStorage.getItem("trollops:loadout"));
  localStorage.setItem("trollops:loadout", JSON.stringify({ ...rest, meleeId }));   // same content, new order
  const s = JSON.parse(localStorage.getItem("trollops:settings"));
  localStorage.setItem("trollops:settings", JSON.stringify({ ...s, gfx: s.gfx === "low" ? "high" : "low" }));
  await new Promise((r) => setTimeout(r, 2500));
  return { real, same: count() - n1, dirty: !!JSON.parse(localStorage.getItem("trollops:cloud-stamp")).dirty };
});
check("a real change after boot is saved to the account", after.real.uploads === 1 && after.real.cloud === "reaper", JSON.stringify(after.real));
check("same content re-saved, or graphics quality changed: nothing to upload", after.same === 0 && !after.dirty, `${after.same} uploads, dirty ${after.dirty}`);

// ---- 7. the real boot path: signed in from the start (cached profile), the
// account's row a minute old, this device's loadout in an old shape, and a
// slow pull. Whatever the game re-saves while the pull is out must not go up.
const page2 = await openGame(() => {
  localStorage.setItem("trollops:loadout", JSON.stringify({ weaponId: "problem416", meleeId: "keyboard" }));
  window.__cloudBoot = {
    user: "u2", selectDelay: 1500,
    rows: { "u2|troll-forces": {
      updated_at: new Date(Date.now() - 60000).toISOString(),
      data: { v: 1, keys: { "trollops:loadout": JSON.stringify({ weaponId: "problem416", secondaryId: "sixtynine", meleeId: "trollsaber", attachments: {} }) } },
    } },
  };
});
const booted = await page2.evaluate(async () => {
  await new Promise((r) => setTimeout(r, 4000));
  const mod = await import("/assets/games/troll-ops/cloud-save.js?v=cs1");
  const st = mod.cloudSaveState();
  return {
    bootWrites: st.bootWrites, settled: st.settled,
    device: JSON.parse(localStorage.getItem("trollops:loadout")).meleeId,
    cloud: JSON.parse(window.__cloud.rows.get("u2|troll-forces").data.keys["trollops:loadout"]).meleeId,
    uploads: window.__cloud.log.filter((l) => l.op === "upsert").map((u) => u.melee),
  };
});
console.log(`      boot: ${booted.bootWrites} synced-key write(s) before the first pull came back; uploads ${JSON.stringify(booted.uploads)}`);
check("booting signed in with a stale loadout takes the account's, never the other way", booted.device === "trollsaber" && booted.cloud === "trollsaber" && booted.settled === true, JSON.stringify(booted));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
