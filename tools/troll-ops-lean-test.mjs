// Two-client check for the Pour up emote (lean-cup.js): the props on the
// other player's copy of your body. Setup shared with troll-ops-emote-test.mjs.
//
// Two tabs in one headless browser join the same private room over
// BroadcastChannel (Supabase blocked), like troll-ops-sync-test.mjs.
//
// Usage: node tools/troll-ops-lean-test.mjs
//   Needs Playwright (npm i -g playwright, or run from a checkout that has it).

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require(path.join(process.execPath, "../../lib/node_modules/playwright"))); }

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
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/* Hold X on `page` until `done()` (run in the page) is true or `ms` pass:
   under SwiftShader the game clock runs well behind the wall clock, so a
   fixed-length hold can come up short of DUO_HOLD. */
async function holdX(page, done, ms = 10000) {
  await page.evaluate(() => window.__trollOps.keys.add("KeyX"));
  const t0 = Date.now();
  while (Date.now() - t0 < ms && !(await page.evaluate(done))) await sleep(150);
  await page.evaluate(() => window.__trollOps.keys.delete("KeyX"));
}

const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 640, height: 400 } });
await ctx.route(/supabase/, (r) => r.abort());
// Both wear the gold Rolex (cosmetics.js face key, fourth part).
await ctx.addInitScript(() => { try { localStorage.setItem("trollops:cosmetics", JSON.stringify({ face: "grin:og::rolex-gold" })); } catch {} });
const ROOM = "LEAN" + Math.floor(Math.random() * 90 + 10);
const errors = [];

async function open(label) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`);
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
  await page.evaluate(async (room) => {
    const T = window.__trollOps;
    T.composer && (T.composer.render = () => {});
    T.setMode("tdm");
    if (T.els.noBots) T.els.noBots.checked = true;
    T.els.room.value = room;
    T.els.room.dispatchEvent(new Event("input"));
    await T.startGame();
  }, ROOM);
  return page;
}

const A = await open("A");
const B = await open("B");
await Promise.all([A, B].map((p) => p.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 30000 })));
await sleep(1500);

// Put both on A's team, alive, 4 m apart on open ground, A facing B.
const teamA = await A.evaluate(() => window.__trollOps.net.team);
await B.evaluate((t) => window.__trollOps.net.setTeam(t), teamA);
async function place(page, x, z, yaw) {
  await page.evaluate(({ x, z, yaw }) => {
    const T = window.__trollOps;
    T.move.pos.x = x; T.move.pos.z = z; T.player.pos.x = x; T.player.pos.z = z;
    if (T.move.velocity) T.move.velocity.set(0, 0, 0);
    T.player.spawnGuard = 999; T.player.hp = T.player.maxHp || 100;
    T.look.yaw = yaw; T.look.pitch = 0;
  }, { x, z, yaw });
}
// A at z=+2 looking toward -z (yaw 0), B at z=-2.
const spot = await A.evaluate(() => { const p = window.__trollOps.move.pos; return { x: p.x, z: p.z }; });
// Start 8 m apart: too far to send or accept.
await place(A, spot.x, spot.z + 4, 0);
await place(B, spot.x, spot.z - 4, Math.PI);
await sleep(1500);   // let positions reach the other tab


// Pour up (lean-cup.js) is a first-person emote: A sees it in their own
// hands; B sees A's body do it, cup and bottle and all, off the `em` code.
const LEAN = await A.evaluate(() => window.__trollOps.emoteWheel.slices.findIndex((b) => b.textContent.includes("Pour up")));
check("Pour up is on the emote wheel", LEAN >= 0, `index ${LEAN}`);
await A.evaluate((i) => { const T = window.__trollOps; T.emoteWheel.open(); T.emoteWheel.pick = i; T.emoteWheel.close(); }, LEAN);
const aId = await A.evaluate(() => window.__trollOps.net.id);
const own = await A.evaluate(() => { const T = window.__trollOps; return { emote: T.emote()?.idx, rigVisible: T.localRig.root.visible }; });
check("A plays it in first person", own.emote === LEAN && own.rigVisible === false, JSON.stringify(own));
// Wait for the pour itself on B's copy of A: the bottle out and tipped.
let seen = null;
const t0 = Date.now();
while (Date.now() - t0 < 20000) {
  seen = await B.evaluate((id) => {
    const r = window.__trollOps.remotes.byId.get(id);
    const k = r?.rig?.emoteProps;
    return { em: window.__trollOps.net.peers.get(id)?.emote, cup: !!k?.cup.visible, bottle: !!k?.bottle.visible, tilt: k ? +Math.abs(k.bottle.rotation.z).toFixed(2) : 0 };
  }, aId);
  if (seen.cup && seen.bottle && seen.tilt > 1) break;
  await sleep(200);
}
check("B sees the cup in A's hand", seen?.cup, JSON.stringify(seen));
check("B sees the bottle tipped over it", seen?.bottle && seen.tilt > 1, JSON.stringify(seen));
check("the emote rides the wire as index+1", seen?.em === LEAN + 1, `em ${seen?.em}`);
// Moving ends it; B's copy puts the props away.
await A.evaluate(() => window.__trollOps.keys.add("KeyW"));
await sleep(800);
await A.evaluate(() => window.__trollOps.keys.delete("KeyW"));
let gone = null;
const t1 = Date.now();
while (Date.now() - t1 < 8000) {
  gone = await B.evaluate((id) => { const k = window.__trollOps.remotes.byId.get(id)?.rig?.emoteProps; return { cup: !!k?.cup.visible, bottle: !!k?.bottle.visible }; }, aId);
  if (!gone.cup && !gone.bottle) break;
  await sleep(200);
}
check("when A moves, B's copy of the props goes away", !gone.cup && !gone.bottle, JSON.stringify(gone));
const wrist = await B.evaluate((id) => { const r = window.__trollOps.remotes.byId.get(id); return { face: r?.rig?.face, watch: r?.rig?.wristMesh?.userData.wristId || null }; }, aId);
check("B sees the Rolex on A's wrist", wrist.watch === "rolex-gold", JSON.stringify(wrist));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(failures ? `${failures} failed` : "all passed");
await browser.close(); server.close();
process.exit(failures ? 1 : 0);
