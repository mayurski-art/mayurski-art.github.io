// Troll Forces — a guest who signs up keeps what they earned (user,
// 2026-10-31: "if guests play for a while ... they can sign up and their
// stats will be saved instead of reset").
//
// In a bare page (no game, no network: TrollrunnerAccounts is a fake), a
// guest earns XP, plays a PvP match (combat record), finishes a run (the
// leaderboard result), levels a gun and banks Zombies Credits. All of it is
// kept on the device, and survives a reload. Then the guest signs in:
//   - their XP joins the account's queue and is sent (troll_ops_xp);
//   - their match is sent to troll_forces_record_match;
//   - their result is filed through reportGameResult;
//   - once cloud-save says the account's copy has landed
//     (trollforces:cloud-settled), their gun XP and Credits are added to the
//     account's own;
//   - and the guest copies are gone, so a second sign-in files nothing twice.
//
// Usage: node tools/troll-ops-guest-carry-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__blank") { res.writeHead(200, { "content-type": "text/html" }); return res.end("<!doctype html><title>guest carry</title>"); }
  const p = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": p.endsWith(".js") ? "text/javascript" : "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route(/supabase|github\.io/, (r) => r.abort());

// the fake accounts layer, a guest until signIn()
const FAKE = () => {
  const calls = { awardXp: [], report: [], rpc: [] };
  let profile = null;
  window.__calls = calls;
  window.TrollrunnerAccounts = {
    getCachedProfile: () => profile,
    getClient: () => (profile ? {
      rpc: async (fn, args) => { calls.rpc.push({ fn, args }); return { error: null }; },
      // (prestige and the record read their rows: none here)
      from: () => { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: null, error: null }) }; return q; },
    } : null),
    awardXp: async (ev, src, meta) => { calls.awardXp.push({ ev, meta }); return { awarded: meta.xp }; },
    reportGameResult: async (g, score, meta) => { if (!profile) return null; calls.report.push({ g, score, meta }); return {}; },
  };
  window.__signIn = (p) => { profile = p; dispatchEvent(new CustomEvent("trollrunner:auth-changed", { detail: { profile: p } })); };
};
await page.addInitScript(FAKE);

const MODS = {
  prog: "/assets/games/troll-ops/progression/progression.js",
  rec: "/assets/games/troll-ops/progression/record.js",
  rows: "/assets/games/troll-ops/progression/leaderboard-rows.js",
  wxp: "/assets/games/troll-ops/progression/weapon-xp.js",
  z: "/assets/games/troll-ops/modes/zombies/credits.js",
  state: "/assets/games/troll-ops/core/state.js?v=st1",   // (weapon-xp.js imports it under this tag)
};
const load = () => page.evaluate(async (M) => {
  const m = {};
  for (const [k, u] of Object.entries(M)) m[k] = await import(u);
  window.__m = m;
  return Object.keys(m).length;
}, MODS);

// 1. a guest plays
await page.goto(`${BASE}/__blank`);
await page.evaluate(() => localStorage.clear());
await page.reload();
check("modules load in a bare page", (await load()) === Object.keys(MODS).length);
const guest = await page.evaluate(() => {
  const { prog, rec, rows, wxp, z, state } = window.__m;
  prog.addXp(700);
  rec.recordMatch({ won: true, kills: 12, deaths: 3, assists: 2, headshots: 4, bestStreak: 6, score: 1800, seconds: 420, shotsFired: 200, shotsHit: 90, weaponKills: { problem416: 12 } });
  rows.fileResult(120, { mode: "tdm", pvp: true, won: true, kills: 12 });
  state.game.isPvp = () => true;
  wxp.startWeaponMatch();
  wxp.addWeaponXp("problem416", 300);
  z.payRun({ kills: 40, wave: 6, won: false });
  return { xp: prog.getXp(), wxp: wxp.getWeaponXp("problem416"), credits: z.credits(), best: z.zsave().best,
    keys: Object.keys(localStorage).filter((k) => /guest/.test(k)).sort(), calls: window.__calls };
});
check("guest XP counts", guest.xp === 700, `xp ${guest.xp}`);
check("guest gun XP and Credits count", guest.wxp === 300 && guest.credits > 0, `wxp ${guest.wxp}, credits ${guest.credits}`);
check("nothing sent while a guest", !guest.calls.awardXp.length && !guest.calls.report.length && !guest.calls.rpc.length);
check("all five kept on the device", guest.keys.join() === "trollops:guest-xp,trollops:record-guest,trollops:results-guest,trollops:wxp-guest,trollops:zombies-guest", guest.keys.join());

// 2. it survives a reload
await page.reload();
await load();
const after = await page.evaluate(() => ({ xp: window.__m.prog.getXp(), wxp: window.__m.wxp.getWeaponXp("problem416"), credits: window.__m.z.credits() }));
check("a reload keeps the guest's XP, gun XP and Credits", after.xp === 700 && after.wxp === 300 && after.credits === guest.credits, JSON.stringify(after));

// 3. they sign up: the account already has some of its own (a fresh account
// would have none; this is the harder case)
const signed = await page.evaluate(async (credits) => {
  localStorage.setItem("trollops:wxp", JSON.stringify({ problem416: 100, mtar: 50 }));
  localStorage.setItem("trollops:zombies", JSON.stringify({ credits: 1000, earned: 1000, best: 9, gun: "problem416", guns: {}, kit: "rookie", kits: { rookie: { turret: 2, barricade: 1, barrel: 1 } } }));
  window.__signIn({ id: "u1", userId: "u1", username: "newtroll", xp: 0, level: 1 });
  await new Promise((r) => setTimeout(r, 300));
  const beforeSettle = { wxpGuest: localStorage.getItem("trollops:wxp-guest") != null };
  dispatchEvent(new CustomEvent("trollforces:cloud-settled", { detail: "u1" }));
  await new Promise((r) => setTimeout(r, 300));
  const { wxp, z } = window.__m;
  return {
    beforeSettle,
    calls: window.__calls,
    wxp: wxp.getWeaponXp("problem416"), mtar: wxp.getWeaponXp("mtar"),
    credits: z.credits(), best: z.zsave().best, turret: z.zsave().kits.rookie.turret,
    left: Object.keys(localStorage).filter((k) => /guest/.test(k)),
    expectCredits: 1000 + credits,
  };
}, guest.credits);
const xpSent = signed.calls.awardXp.reduce((n, c) => n + (c.meta?.xp || 0), 0);
check("their XP went to the account (troll_ops_xp)", xpSent === 700 && signed.calls.awardXp.every((c) => c.ev === "troll_ops_xp"), `sent ${xpSent}`);
check("their match went to the combat record", signed.calls.rpc.length === 1 && signed.calls.rpc[0].fn === "troll_forces_record_match" && signed.calls.rpc[0].args.p_match.kills === 12, JSON.stringify(signed.calls.rpc.map((c) => c.fn)));
check("their result was filed to the boards", signed.calls.report.length === 1 && signed.calls.report[0].g === "troll-ops" && signed.calls.report[0].score === 120);
check("gun XP waits for the account's cloud copy", signed.beforeSettle.wxpGuest);
check("then gun XP is added to the account's", signed.wxp === 400 && signed.mtar === 50, `416 ${signed.wxp}, mtar ${signed.mtar}`);
check("Credits added, best wave and kit levels the higher", signed.credits === signed.expectCredits && signed.best === 9 && signed.turret === 2, `credits ${signed.credits}/${signed.expectCredits}, best ${signed.best}, turret ${signed.turret}`);
check("no guest copies left", !signed.left.length, signed.left.join());

// 4. another auth event (a token refresh) files nothing twice
const twice = await page.evaluate(async () => {
  const n = { xp: window.__calls.awardXp.length, rpc: window.__calls.rpc.length, rep: window.__calls.report.length };
  dispatchEvent(new CustomEvent("trollrunner:auth-changed", {}));
  dispatchEvent(new CustomEvent("trollforces:cloud-settled", { detail: "u1" }));
  await new Promise((r) => setTimeout(r, 300));
  return { n, now: { xp: window.__calls.awardXp.length, rpc: window.__calls.rpc.length, rep: window.__calls.report.length }, wxp: window.__m.wxp.getWeaponXp("problem416") };
});
check("a second auth event sends nothing again", twice.now.rpc === twice.n.rpc && twice.now.rep === twice.n.rep && twice.wxp === 400, JSON.stringify(twice));

check("no page errors", !errors.length, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
