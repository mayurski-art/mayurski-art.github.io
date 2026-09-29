// Troll Forces: Troll Royale (battle royale) phase 1 check. One tab, bots
// on: the mode loads Grin Beach with floor loot and a zone, you land with
// only a pistol, guns/plates/Hopium/ammo pick up, plates soak damage but not
// the Cringe, the Cringe hurts, dying is final (gear drops, you spectate),
// and the match ends when one troll is left. Screenshots go to OUT.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-royale-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.OUT || "";
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
const BASE = `http://localhost:${server.address().port}`;

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (page, name) => { if (OUT) await page.screenshot({ path: path.join(OUT, name) }); };

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`);
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });

async function startRoyale() {
  await page.evaluate(async () => {
    const T = window.__trollOps;
    T.setMode("royale");
    if (T.els.noBots) T.els.noBots.checked = false;
    await T.startGame();
  });
  await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.isStaging(), null, { timeout: 60000 });
  await sleep(800);
}
await startRoyale();

// ---- setup ---------------------------------------------------------------
let info = await page.evaluate(() => {
  const T = window.__trollOps, r = T.royale();
  const kinds = {};
  for (const it of r.loot.items.values()) kinds[it.k] = (kinds[it.k] || 0) + 1;
  return {
    map: T.loadedMapId(), items: r.loot.items.size, kinds, live: r.live,
    primary: T.player.weaponId, secondary: T.player.secondaryId,
    hud: !T.els.royale.hidden, teams: !T.els.hudTeams.hidden, text: T.els.royale.textContent.replace(/\s+/g, " ").trim(),
    alive: T.royaleAliveList().length, bots: T.bots.count,
  };
});
check("Royale loads Grin Beach", info.map === "grinbeach", info.map);
check("floor loot is spread over the map", info.items >= 30 && info.items <= 120 && info.kinds.gun > 5 && info.kinds.plate > 0 && info.kinds.heal > 0 && info.kinds.ammo > 0, JSON.stringify({ n: info.items, ...info.kinds }));
check("you land with only a pistol", info.primary === "pocketgrin" && !info.secondary, `${info.primary} / ${info.secondary}`);
check("zone HUD up, team score hidden", info.hud && !info.teams && /Zone 1/.test(info.text) && /left/.test(info.text), info.text);
check("room padded to 10 trolls with bots", info.alive === 10 && info.bots === 9, `${info.alive} alive, ${info.bots} bots`);
check("the zone clock runs once the match is live", info.live);

// Same seed, same loot: a rebuild with the room's seed makes the same items.
const same = await page.evaluate(() => {
  const T = window.__trollOps, r = T.royale();
  const sig = () => [...T.royale().loot.items.values()].slice(0, 12).map((it) => `${it.k}:${it.w || ""}:${it.x.toFixed(1)}`).join("|");
  const a = sig(), seed = r.seed;
  const zoneA = JSON.stringify(r.zone.circles);
  T.setupRoyale(seed);
  T.royale().live = true;
  return { same: a === sig(), zone: zoneA === JSON.stringify(T.royale().zone.circles) };
});
check("one seed gives the same loot and zone on every client", same.same && same.zone, JSON.stringify(same));

// Zone phases: shrinking circle, damage once phase 1 closes.
const zs = await page.evaluate(() => {
  const z = window.__trollOps.royale().zone;
  return [0, 50, 60, 76, 400].map((t) => { const s = z.state(t); return { t, stage: s.stage, phase: s.phase, r: +s.r.toFixed(1), dps: s.dps }; });
});
check("the circle shrinks phase by phase", zs[0].stage === "wait" && zs[1].stage === "closing" && zs[1].r < zs[0].r && zs[3].r < zs[1].r && zs[4].stage === "final", JSON.stringify(zs));

// ---- loot ------------------------------------------------------------------
// Bots stand still from here (they stay in the match): their fire would muddy
// every health and armour number below.
await page.evaluate(() => { const T = window.__trollOps; T.__botUpdate = T.bots.update; T.bots.update = () => {}; });
async function teleportTo(kind) {
  return page.evaluate((kind) => {
    const T = window.__trollOps;
    const it = [...T.royale().loot.items.values()].find((x) => x.k === kind && (kind !== "gun" || x.w !== T.player.weaponId));
    if (!it) return null;
    T.move.pos.x = it.x; T.move.pos.z = it.z; T.player.pos.x = it.x; T.player.pos.z = it.z;
    T.player.spawnGuard = 0;
    return { id: it.id, w: it.w, r: it.r };
  }, kind);
}
await page.evaluate(() => { window.__trollOps.player.spawnGuard = 0; });
let g = await teleportTo("gun");
let pick = await page.evaluate((id) => {
  const T = window.__trollOps, r = T.royale();
  const it = r.loot.items.get(id);
  const n0 = r.loot.items.size;
  T.royalePickupGun(it);
  return { secondary: T.player.secondaryId, n0, n1: r.loot.items.size, gone: !r.loot.items.has(id), held: T.currentWeapon()?.def.id };
}, g.id);
check("a gun off the floor fills the empty slot", pick.secondary === g.w && pick.gone && pick.held === g.w && pick.n1 === pick.n0 - 1, JSON.stringify(pick));
await sleep(300);
await shot(page, "royale-loot.png");
g = await teleportTo("gun");
pick = await page.evaluate(({ id, was }) => {
  const T = window.__trollOps, r = T.royale();
  const n0 = r.loot.items.size;
  T.royalePickupGun(r.loot.items.get(id));
  const dropped = [...r.loot.items.values()].some((it) => it.k === "gun" && it.w === was && it.id.includes("."));
  return { n0, n1: r.loot.items.size, dropped, primary: T.player.weaponId, secondary: T.player.secondaryId };
}, { id: g.id, was: pick.secondary });
check("a second gun swaps with the one in your hands, which drops", pick.n1 === pick.n0 && pick.dropped, JSON.stringify(pick));

for (const kind of ["plate", "heal"]) {
  const before = await page.evaluate(() => ({ p: window.__trollOps.player.plates, h: window.__trollOps.player.heals }));
  await teleportTo(kind);
  await sleep(300);
  const after = await page.evaluate(() => ({ p: window.__trollOps.player.plates, h: window.__trollOps.player.heals }));
  check(`walking over a ${kind === "plate" ? "Cope Plate" : "Hopium"} pockets it`, kind === "plate" ? after.p === before.p + 1 : after.h === before.h + 1, JSON.stringify({ before, after }));
}

// Plating up.
await page.evaluate(() => window.__trollOps.startRoyaleAct("plate"));
await sleep(400);
const midAct = await page.evaluate(() => !window.__trollOps.els.royaleAct.hidden);
await sleep(1100);
let st = await page.evaluate(() => { const P = window.__trollOps.player; return { armor: P.armor, plates: P.plates, seg: getComputedStyle(window.__trollOps.els.armor.children[0]).getPropertyValue("--p").trim() }; });
check("4 plates up: the bar shows, armour +50", midAct && st.armor === 50 && st.seg === "1.000", JSON.stringify({ midAct, ...st }));
await shot(page, "royale-armor.png");
let hit = await page.evaluate(() => {
  const T = window.__trollOps, P = T.player;
  P.spawnGuard = 0;
  const hp0 = P.hp;
  T.damagePlayer(30, null, "problem416", false);
  return { hp0, hp: P.hp, armor: P.armor };
});
check("armour soaks a hit before health", hit.armor === 20 && hit.hp === hit.hp0, JSON.stringify(hit));

// Hopium.
await page.evaluate(() => { const T = window.__trollOps; T.player.armor = 0; T.damagePlayer(40, null, "problem416", false); T.startRoyaleAct("heal"); });
await sleep(3000);
st = await page.evaluate(() => ({ hp: window.__trollOps.player.hp, heals: window.__trollOps.player.heals }));
check("Hopium brings you back to 100", st.hp === 100 && st.heals === 0, JSON.stringify(st));

// The Cringe: outside the circle in phase 2, it burns through armour-free health.
const burn = await page.evaluate(async () => {
  const T = window.__trollOps, r = T.royale();
  r.t = 95;   // phase 2 closing
  const s = r.zone.state(r.t);
  const b = T.builtMap().map.bounds;
  // The corner farthest from the circle.
  const corners = [[b.minX + 1, b.minZ + 1], [b.maxX - 1, b.minZ + 1], [b.minX + 1, b.maxZ - 1], [b.maxX - 1, b.maxZ - 1]];
  corners.sort((a, c) => Math.hypot(c[0] - s.x, c[1] - s.z) - Math.hypot(a[0] - s.x, a[1] - s.z));
  const [x, z] = corners[0];
  T.move.pos.x = x; T.move.pos.z = z; T.player.pos.x = x; T.player.pos.z = z;
  T.player.armor = 50;
  const hp0 = T.player.hp;
  await new Promise((res) => setTimeout(res, 2500));
  return { hp0, hp: T.player.hp, armor: T.player.armor, haze: T.els.cringe.classList.contains("is-on"), stage: s.stage, dps: s.dps };
});
check("the Cringe hurts outside the circle, through armour", burn.haze && burn.hp < burn.hp0 && burn.armor === 50, JSON.stringify(burn));
await shot(page, "royale-cringe.png");

// ---- the end (alive) -----------------------------------------------------------
await page.evaluate(() => {
  const T = window.__trollOps;
  T.player.hp = 100;
  T.bots.update = T.__botUpdate;
  for (const b of T.bots.bots) T.bots.applyHit(b.id, 9999);
});
await sleep(2500);
info = await page.evaluate(() => ({ state: window.__trollOps.state(), royale: !!window.__trollOps.royale(), xp: window.__trollOps.player.matchXp,
  title: document.querySelector("#to-gameover h2, #to-gameover .to-go-title, #to-gameover")?.textContent.replace(/\s+/g, " ").slice(0, 120) }));
check("last troll standing ends the match as a win", info.state !== "playing" && !info.royale && /You win/.test(info.title || ""), JSON.stringify(info));
check("the win pays placement XP", info.xp >= 400, `${info.xp} XP`);

// ---- dying is final ----------------------------------------------------------
await startRoyale();
const out = await page.evaluate(async () => {
  const T = window.__trollOps, r = T.royale();
  T.player.spawnGuard = 0;
  const n0 = r.loot.items.size;
  const killer = T.bots.bots[0];
  T.damagePlayer(999, killer.id, "problem416", false, killer.pos);
  await new Promise((res) => setTimeout(res, 7000));   // past the killcam
  return {
    alive: T.player.alive, n0, n1: T.royale()?.loot.items.size, mine: [...(T.royale()?.loot.items.keys() || [])].filter((k) => k.startsWith(T.net.id + ".")).length, text: T.els.respawnText.textContent,
    spectating: !!T.royale()?.spectate, place: T.royale()?.place,
  };
});
check("dying is final: no respawn", !out.alive && /Eliminated/.test(out.text), out.text);
check("your gear drops where you fell", out.mine >= 1, JSON.stringify(out));
check("you spectate a troll still standing", out.spectating && /watching/.test(out.text), out.text);
await shot(page, "royale-spectate.png");

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
