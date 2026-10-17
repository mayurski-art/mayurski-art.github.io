// Troll Forces Domination (user, 2026-10-17). Two tabs in one PRIVATE room
// (Supabase is blocked; never a public room), no bots first:
//   - the mode is listed after Free-for-All; three flags A B C, apart, with
//     a HUD chip each;
//   - standing on A takes it in about ten seconds; the other tab (not the
//     host) sees the same owner; a held flag scores, a kill doesn't;
//   - the score limit ends the match for the side that got there.
// Then a room with bots: the bots take flags on their own.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-dom-test.mjs [outDir]
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2] || null;
if (OUT) fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
await ctx.route(/supabase/, (r) => r.abort());

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const STATE = "/assets/games/troll-ops/core/state.js?v=st1";   // the game's own instance

async function open(room, bots) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
  await page.evaluate(async ({ room, bots }) => {
    const T = window.__trollOps;
    T.setMode("dom");
    T.els.noBots.checked = !bots;
    T.els.room.value = room;
    T.els.room.dispatchEvent(new Event("input"));
    T.loadout.versusMapId = "grinsite";
    await T.startGame();
  }, { room, bots });
  await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 240000 });
  await page.evaluate(() => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); T.settings.invincible = true; });
  return page;
}
const flags = (page) => page.evaluate(async (u) => {
  const { match } = await import(u);
  return (match.dom?.flags || []).map((f) => ({ id: f.id, x: f.x, z: f.z, owner: f.owner, cap: f.cap, capTeam: f.capTeam }));
}, STATE);

// ---- two tabs, no bots
const ROOM = "DM" + String(Math.floor(Math.random() * 900 + 100));
const a = await open(ROOM, false);
const listed = await a.evaluate(() => [...document.querySelectorAll(".to-lo-modebtn")].map((b) => b.dataset.mode));
check(listed.indexOf("dom") === listed.indexOf("ffa") + 1, "Domination is listed after Free-for-All", listed.join(","));
const b = await open(ROOM, false);
await sleep(3000);

const fa = await flags(a);
const fb = await flags(b);
check(fa.map((f) => f.id).join("") === "ABC", "three flags A B C", JSON.stringify(fa));
let minGap = Infinity;
for (let i = 0; i < fa.length; i++) for (let j = i + 1; j < fa.length; j++) minGap = Math.min(minGap, Math.hypot(fa[i].x - fa[j].x, fa[i].z - fa[j].z));
check(minGap >= 12, "flags are at least 12 m apart", `min=${minGap.toFixed(1)}`);
check(JSON.stringify(fa.map((f) => [f.x, f.z])) === JSON.stringify(fb.map((f) => [f.x, f.z])), "both tabs place the flags in the same spots");
const chips = await a.evaluate(() => document.querySelectorAll(".to-dom .to-dom-flag").length);
check(chips === 3, "a HUD chip per flag", `chips=${chips}`);
const gap = await a.evaluate(() => {
  const t = document.getElementById("to-hud-teams").getBoundingClientRect();
  const d = document.querySelector(".to-dom").getBoundingClientRect();
  return Math.round(d.top - t.bottom);
});
check(gap >= 2, "the flag chips sit clear of the score line", `gap=${gap}px`);

const host = await a.evaluate(() => window.__trollOps.net.isBotHost());
const [H, O] = host ? [a, b] : [b, a];
check(true, `tab ${host ? "A" : "B"} hosts the flags`);
// Park the other tab far from A so it can't contest.
const fA = fa[0];
const far = fa[2];
await O.evaluate((p) => window.__trollOps.move.reset(p.x, p.z, 0), far);
const team = await H.evaluate(() => window.__trollOps.net.team);
const scoreBefore = await H.evaluate((t) => window.__trollOps.teamScores[t], team);
await H.evaluate((p) => window.__trollOps.move.reset(p.x, p.z, 0), fA);
if (OUT) { await sleep(4000); await H.screenshot({ path: path.join(OUT, "dom-capturing.png") }); }
const capText = await H.evaluate(() => document.querySelector(".to-dom-cap:not([hidden]) span")?.textContent || "");
check(/Capturing A|Capture A|contested/i.test(capText), "standing on A shows the capture prompt", capText);
let ownedAt = null;
const t0 = Date.now();
for (let i = 0; i < 60; i++) {
  await sleep(500);
  const f = (await flags(H))[0];
  if (f.owner === team) { ownedAt = (Date.now() - t0) / 1000 + (OUT ? 4 : 0); break; }
}
const other = (await flags(O))[0];
check(ownedAt != null && ownedAt >= 7 && ownedAt <= 16, "A is taken in about ten seconds", `t=${ownedAt?.toFixed(1)}s`);
await sleep(1200);
const otherA = (await flags(O))[0];
check(otherA.owner === team, "the other tab sees the same owner", JSON.stringify({ before: other.owner, after: otherA.owner, team }));

// Leave A; it keeps scoring.
await H.evaluate((p) => window.__trollOps.move.reset(p.x + 30, p.z, 0), fA);
await sleep(7000);
const s1 = await H.evaluate((t) => window.__trollOps.teamScores[t], team);
const s1o = await O.evaluate((t) => window.__trollOps.teamScores[t], team);
check(s1 > scoreBefore, "a held flag scores", `${scoreBefore} -> ${s1}`);
check(Math.abs(s1o - s1) <= 1, "the other tab's score follows the host's", `host=${s1} other=${s1o}`);
if (OUT) await H.screenshot({ path: path.join(OUT, "dom-held.png") });

// A kill scores the side nothing here.
const sk = await H.evaluate(async (t) => {
  const T = window.__trollOps;
  const before = T.teamScores[t];
  const victim = [...T.net.peers.values()][0];
  T.registerDeath(victim?.name || "x", T.net.id, "pistol", { victimId: victim?.id || "zz", victimTeam: t === "phantom" ? "ghost" : "phantom" });
  return { before, after: T.teamScores[t] };
}, team);
check(sk.after === sk.before, "a kill adds nothing to the side's score", JSON.stringify(sk));

// The limit ends it.
await H.evaluate((t) => { window.__trollOps.teamScores[t] = 199; }, team);
await sleep(4500);
const end = await H.evaluate(() => ({ state: window.__trollOps.state(), title: document.getElementById("to-go-title")?.textContent || "" }));
check(end.state !== "playing" && / win$/.test(end.title), "200 ends the match", JSON.stringify(end));
await a.close(); await b.close();

// ---- bots take flags
const c = await open("DB" + String(Math.floor(Math.random() * 900 + 100)), true);
let owned = 0;
for (let i = 0; i < 80 && owned < 2; i++) {
  await sleep(1000);
  owned = (await flags(c)).filter((f) => f.owner).length;
}
check(owned >= 2, "bots take flags on their own", `owned=${owned}`);
if (OUT) await c.screenshot({ path: path.join(OUT, "dom-bots.png") });

check(!errors.length, "no page errors", errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
