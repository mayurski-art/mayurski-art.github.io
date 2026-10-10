// Troll Forces perks test: BO2's perks, one per tier in each class. The
// active class's three are carried from each spawn (a class change lands
// on the respawn), the spawn card shows them, the ones other players need
// go out on the wire, and each perk does its thing.
// Supabase is blocked: the page must never join the live public room.
//
// Usage: node tools/troll-ops-perks-test.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg", ".svg": "image/svg+xml", ".gif": "image/gif" };
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
// The game's own copy of perks.js (its ?v= tag as combat/perk-carry.js
// imports it): any other tag is a second module instance.
const PERKS_TAG = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/combat/perk-carry.js"), "utf8").match(/perks\.js\?v=([\w-]+)/)[1];

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.route(/supabase/, (r) => r.abort());
const errors = [];
async function open(label) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await page.addInitScript(() => {
    const fake = { getCachedProfile: () => ({ username: "troll_runner", tags: [] }) };
    Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => fake, set: () => {} });
  });
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 300000 });
  await page.evaluate(() => window.__trollOps.setLoadWaitMax(8));
  return page;
}
// fn runs in the page with P = the game's perks module, T = its hooks.
const perks = async (page, fn, arg) => {
  await page.evaluate(async (tag) => { window.__P ||= await import(`/assets/games/troll-ops/perks.js?v=${tag}`); }, PERKS_TAG);
  return page.evaluate(fn, arg);
};

const A = await open("A");
// Class 1 gets one perk per tier; Class 2 gets three others.
await A.evaluate(() => {
  const L = window.__trollOps.loadout;
  L.setActiveClass(1);
  ["ghost", "toughness", "deadsilence"].forEach((id, t) => L.setClassPerk(t, id));
  L.setActiveClass(0);
  ["lightweight", "hardwired", "dexterity"].forEach((id, t) => L.setClassPerk(t, id));
});
await A.evaluate(async () => { const T = window.__trollOps; T.setMode("ops"); await T.startGame(); });
await A.waitForFunction(() => !window.__trollOps.loadState().open, null, { timeout: 300000 });
await A.evaluate(() => window.__trollOps.endStaging?.());
await A.waitForTimeout(700);

// 1. Carried from the spawn, shown on the card, not on the wire (none of these three are wire perks).
const s1 = await perks(A, () => { const P = window.__P, T = window.__trollOps; return ({
  carried: P.carriedPerks(), light: P.hasPerk("lightweight"), ghost: P.hasPerk("ghost"),
  card: document.querySelector(".to-perk-card")?.classList.contains("is-visible"),
  cardText: document.querySelector(".to-perk-card")?.textContent || "", wire: T.net.perks | 0,
  dbg: [T.state(), T.isStaging?.(), T.stageT(), document.querySelector(".to-perk-card")?.outerHTML.slice(0, 80)].join("/"),
}); });
check("the class's three perks are carried from the spawn", s1.carried.join(",") === "lightweight,hardwired,dexterity" && s1.light && !s1.ghost, s1.carried.join(","));
check("the spawn card shows the class and its perks", s1.card && /Class 1/.test(s1.cardText) && /Lightweight/.test(s1.cardText) && /Dexterity/.test(s1.cardText), s1.cardText);
check("perks nobody else needs stay off the wire", s1.wire === 0, String(s1.wire));
await A.screenshot({ path: path.join(ROOT, ".claude/run/perk-card.png") });

// 2. Change class from the pause menu: nothing changes until the respawn.
const s2 = await perks(A, () => { const P = window.__P, T = window.__trollOps; return (() => {
  T.openPauseMenu();
  document.querySelectorAll("#to-pause-classes button")[1].click();
  const mid = P.carriedPerks().join(",");
  T.respawnPlayer();
  return { mid, after: P.carriedPerks().join(","), wire: T.net.perks | 0, ghostBit: P.WIRE_PERKS.ghost, dsBit: P.WIRE_PERKS.deadsilence };
})(); });
check("a class change waits for the respawn", s2.mid === "lightweight,hardwired,dexterity", s2.mid);
check("and then carries the new class's perks", s2.after === "ghost,toughness,deadsilence", s2.after);
check("Ghost and Dead Silence go out on the wire", s2.wire === (s2.ghostBit | s2.dsBit), `${s2.wire}`);

// 3. Locked perks can't be carried; Royale carries none.
const s3 = await perks(A, () => { const P = window.__P; return ({ valid: P.validPerks(["ghost", "lightweight", "nope"]), tiers: [0, 1, 2].map((t) => P.perksInTier(t).length) }); });
check("each slot only takes its own tier's perk", s3.valid[0] === "ghost" && s3.valid[1] === null && s3.valid[2] === null, JSON.stringify(s3.valid));
check("BO2's sixteen perks: 5, 5 and 6 a tier", s3.tiers.join(",") === "5,5,6", s3.tiers.join(","));

// PERK EFFECTS (appended per system)

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `PERKS RED: ${failures} failed` : "PERKS GREEN");
process.exit(failures ? 1 : 0);
