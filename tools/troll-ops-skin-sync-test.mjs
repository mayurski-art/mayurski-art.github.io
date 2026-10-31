// Troll Forces: a gun's finish reaches everyone else (user, 2026-10-14:
// "I have Dark Matter on The Beast, my friend only sees factory"). Tabs in
// one headless browser share a PRIVATE room code over BroadcastChannel
// (Supabase is blocked; never a public room). A holds a finished gun; B's
// copy of A is drawn in the same finish. (The live gun always was: the gap
// was the killcam's close-up, combat/killcam-present.js.)
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-skin-sync-test.mjs
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
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
await ctx.route(/supabase/, (r) => r.abort());

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROOM = "SK" + String(Math.floor(Math.random() * 900 + 100));
const errors = [];

async function open(label) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
  return page;
}
async function start(page, gun, skin) {
  await page.evaluate(async ({ room, gun, skin }) => {
    const T = window.__trollOps;
    T.setMode("tdm");
    T.els.noBots.checked = true;
    T.els.room.value = room;
    T.els.room.dispatchEvent(new Event("input"));
    T.loadout.versusMapId = "grinsite";
    // a prestige finish needs its prestige: the owner account has them all
    if (gun) window.TrollrunnerAccounts = { ...(window.TrollrunnerAccounts || {}), getCachedProfile: () => ({ username: "troll_runner" }) };
    if (gun) { T.loadout.weaponId = gun; T.loadout.attachmentsFor(gun).skin = skin; }
    await T.startGame();
  }, { room: ROOM, gun, skin });
}
async function loaded(page, ms = 240000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms && await page.evaluate(() => window.__trollOps.loadState().open)) await sleep(250);
}
const R = (page, fn, arg) => page.evaluate(fn, arg);

const a = await open("A");
await start(a, process.env.GUN || "kek", process.env.SKIN || "darkmatter");
await loaded(a);
await R(a, () => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); });
const b = await open("B");
await start(b, null, null);
await loaded(b);
await R(b, () => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); });
await sleep(3000);
const mine = await R(a, () => { const T = window.__trollOps; const w = T.currentWeapon(); return { id: w.def.id, skin: w.def.attachments?.skin || null, mesh: T.activeWeaponMesh()?.userData.finish || null, holding: T.player.holding }; });
const seen = await R(b, () => { const T = window.__trollOps; const r = [...T.remotes.byId.values()].map((x) => ({ weapon: x.weaponId, skin: x.skin, finish: x.weaponMesh?.userData.finish || null, peerSkin: x.peer?.skin || null, mats: (() => { const c = {}; x.weaponMesh?.traverse((o) => { if (o.isMesh) { const k = (o.material.color?.getHexString?.() || "?") + (o.visible ? "" : "(hidden)"); c[k] = (c[k] || 0) + 1; } }); return c; })() })); return r; });
console.log("A", JSON.stringify(mine), "B sees", JSON.stringify(seen));
check(!!mine.skin && seen.some((s) => s.weapon === mine.id && s.finish === mine.skin), "B sees A's gun in A's finish", JSON.stringify({ mine, seen }));
check(!errors.length, "no page errors", errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
