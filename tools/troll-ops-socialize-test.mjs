// Troll Forces Socialize: the main-menu hangout room.
//
// Three tabs in one headless browser share the public QSOC room over
// BroadcastChannel (Supabase blocked):
//   1. Socialize sits right under Public Match. A (troll_runner) deploys
//      from the menu, B (another account) joins with a different map picked
//      and lands on A's map. No bots, nobody can be hurt, no gun, emotes
//      reach the other tab.
//   2. The owner's room-mode row shows only for A. A switches the room to
//      TDM: both load into it with bots and on opposite sides. C joins as
//      Socialize mid-match and lands in TDM.
//   3. The match ends: no map vote, everyone is back in the hangout on the
//      old map. Leaving puts the lobby back on Socialize.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-socialize-test.mjs

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/* Headless pages only draw (and so only send state and tick clocks) when
   something asks for a frame: screenshots ask, for `ms`. */
async function pump(page, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) await page.screenshot({ type: "jpeg", quality: 10 }).catch(() => {});
}

const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
await ctx.route(/supabase/, (r) => r.abort());
const errors = [];

async function open(label, username) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  // Signed in as `username` before the game reads the profile.
  await page.addInitScript((name) => {
    const fake = { getCachedProfile: () => ({ username: name, tags: [] }) };
    Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => fake, set: () => {} });
  }, username);
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 420000 });
  await page.waitForFunction(() => !!window.__trollOps && !!window.__toBo2, null, { timeout: 420000 });
  await page.evaluate(() => window.__trollOps.setLoadWaitMax(8));
  return page;
}
const soc = (page) => page.evaluate(() => window.__trollOps.social());
const st = (page) => page.evaluate(() => window.__trollOps.loadState());
async function until(page, fn, ms, read = soc) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const s = await read(page); if (fn(s)) return s; await sleep(300); }
  return read(page);
}
const inHangout = (s) => s.gameState === "playing" && s.mode === "social";
const loaded = async (page, ms = 240000) => until(page, (s) => !s.open, ms, st);
function joinSocial(page, mapId) {
  return page.evaluate(async (mapId) => {
    const T = window.__trollOps;
    T.setMode("social");
    T.loadout.mapId = mapId;
    await T.startGame();
  }, mapId);
}

const A = await open("A", "troll_runner");
const B = await open("B", "someone_else");

// ── 1. The menu entry and the hangout ─────────────────────────────────────
const labels = await A.evaluate(() => [...document.querySelectorAll(".tr-menu-item")].map((b) => b.textContent.trim().toLowerCase()));
const pub = labels.findIndex((l) => l.startsWith("public match"));
check("Socialize sits right under Public Match", pub >= 0 && labels[pub + 1]?.startsWith("socialize"), labels.slice(0, 4).join(" / "));

await A.evaluate(() => { window.__trollOps.loadout.mapId = "grinsite"; window.__toBo2.menu.go("social"); });
await sleep(300);
const socLabels = await A.evaluate(() => [...document.querySelectorAll(".tr-menu-item")].map((b) => b.textContent.trim().toLowerCase()));
check("the Socialize screen has a map row and Hang out", socLabels.some((l) => l.startsWith("map")) && socLabels.some((l) => l.startsWith("hang out")), socLabels.join(" / "));
await A.evaluate(() => window.__toBo2.menu.go("maps"));
await sleep(200);
const socMaps = await A.evaluate(() => [...document.querySelectorAll(".tr-menu-item")].map((b) => b.textContent.trim().toLowerCase()));
check("its map list leaves out the prestige reward maps", !socMaps.some((l) => /pentagrin|trollface island/.test(l)), socMaps.join(" / "));
await A.evaluate(() => window.__toBo2.menu.back());
await sleep(200);
await A.evaluate(() => [...document.querySelectorAll(".tr-menu-item")].find((b) => /^hang out/i.test(b.textContent.trim()))?.click());
await loaded(A);
const a1 = await until(A, inHangout, 30000);
check("Hang out deploys A into the hangout", inHangout(a1) && a1.room, JSON.stringify(a1));
check("it is the public QSOC room", (await A.evaluate(() => window.__trollOps.net.room)) === "QSOC");

await joinSocial(B, "dustbowl");
await loaded(B);
const b1 = await until(B, inHangout, 30000);
check("B lands in the hangout", inHangout(b1), JSON.stringify(b1));
check("B lands on A's map, not its own pick", b1.map === a1.map, `${b1.map} vs ${a1.map}`);
check("everyone is on one side", a1.team === "phantom" && b1.team === "phantom", `${a1.team} / ${b1.team}`);
await sleep(1500);

const calm = await A.evaluate(async () => {
  const T = window.__trollOps;
  const hp0 = T.player.hp;
  T.damagePlayer(500, "someone", "problem416");
  T.swingMelee();
  T.startCook("lethal");
  T.switchWeapon("secondary");
  return {
    hp0, hp1: T.player.hp, alive: T.player.alive, bots: T.bots.bots.length, staging: T.isStaging(),
    holding: T.player.holding, meleeBusy: !!T.player.melee?.busy,
    crosshair: getComputedStyle(document.getElementById("to-crosshair")).display,
    ammo: getComputedStyle(document.querySelector(".to-hud-bottom")).display,
    hud: T.els.hud.hidden, social: T.isSocial(),
  };
});
check("no damage lands in the hangout", calm.hp1 === calm.hp0 && calm.alive, `${calm.hp0} -> ${calm.hp1}`);
check("no bots, no countdown", calm.bots === 0 && !calm.staging, JSON.stringify(calm));
check("melee and weapon swaps do nothing", !calm.meleeBusy && calm.holding !== "secondary", `holding ${calm.holding}`);
check("the combat HUD is gone but the HUD (emote wheel) stays", calm.crosshair === "none" && calm.ammo === "none" && !calm.hud, JSON.stringify(calm));
await pump(A, 1500);
const aSeen = await until(B, (v) => v && v.state, 8000, (p) => p.evaluate(() => {
  const peer = [...window.__trollOps.net.peers.values()].find((x) => !String(x.id).startsWith("bot-"));
  return peer ? { state: peer.snaps.length > 0, weapon: peer.weapon ?? null } : null;
}));
check("other players see empty hands", !!aSeen?.state && aSeen.weapon == null, JSON.stringify(aSeen));

await A.evaluate(() => window.__trollOps.setEmote(4));
await pump(A, 1200);
const emoteSeen = await until(B, (v) => v > 0, 5000, (p) => p.evaluate(() => [...window.__trollOps.net.peers.values()].reduce((m, p) => Math.max(m, p.emote | 0), 0)));
check("an emote reaches the other player", emoteSeen > 0, String(emoteSeen));
await A.evaluate(() => window.__trollOps.setEmote(-1));

// First person: no gun, the free hands swing with your stride.
const still = await A.evaluate(() => { const T = window.__trollOps; T.settings.thirdPerson = false; T.keys.add("KeyW"); T.keys.add("ShiftLeft"); return T.socialArms(); });
await pump(A, 1500);
const armsA = await A.evaluate(() => window.__trollOps.socialArms());
await pump(A, 400);
const arms = await A.evaluate((x) => { const T = window.__trollOps; T.keys.delete("KeyW"); T.keys.delete("ShiftLeft"); return { ...x, b: T.socialArms(), gun: T.fpWeaponDrawn() }; }, { still, a: armsA });
check("first person shows free hands, not a gun", arms.a.on && arms.gun === false, JSON.stringify(arms));
check("the hands swing in with the stride", arms.a.k > 0.6 && arms.b.phase > arms.a.phase, JSON.stringify(arms));

// ── 2. The owner's switch ─────────────────────────────────────────────────
const rowB = await B.evaluate(() => { window.__trollOps.renderRoomModeRow(); return document.getElementById("to-set-roommode-row").hidden; });
const rowA = await A.evaluate(() => { window.__trollOps.renderRoomModeRow(); return document.getElementById("to-set-roommode-row").hidden; });
check("the room-mode row is hidden for other accounts", rowB === true);
check("the room-mode row shows for troll_runner", rowA === false);
// A non-owner forging the call does nothing.
await B.evaluate(() => window.__trollOps.ownerSwitchRoomMode("tdm"));
await sleep(800);
check("a non-owner can't switch the room", (await soc(A)).mode === "social" && (await soc(B)).mode === "social");

await A.evaluate(() => window.__trollOps.ownerSwitchRoomMode("tdm"));
const a2 = await until(A, (s) => s.mode === "tdm" && s.gameState === "playing", 60000);
const b2 = await until(B, (s) => s.mode === "tdm" && s.gameState === "playing", 60000);
check("A's room switches to TDM", a2.mode === "tdm", JSON.stringify(a2));
check("B follows into TDM", b2.mode === "tdm", JSON.stringify(b2));
check("both on the same map", a2.map === b2.map && a2.map === a1.map, `${a2.map} / ${b2.map}`);
check("split onto opposite sides", a2.team && b2.team && a2.team !== b2.team, `${a2.team} / ${b2.team}`);
await loaded(A); await loaded(B);
const tdm = await until(A, (v) => v.bots > 0, 30000, (p) => p.evaluate(() => ({ bots: window.__trollOps.bots.bots.length + [...window.__trollOps.net.peers.values()].filter((x) => String(x.id).startsWith("bot-")).length })));
check("the match has bots", tdm.bots > 0, JSON.stringify(tdm));
// B's countdown only ticks with frames.
for (let i = 0; i < 60 && await B.evaluate(() => window.__trollOps.isStaging()); i++) await pump(B, 500);
const hurt = await B.evaluate(async () => {
  const T = window.__trollOps;
  T.player.spawnGuard = 0;
  const hp0 = T.player.hp; T.damagePlayer(10, "someone", "problem416"); return [hp0, T.player.hp, T.isSocial()];
});
check("in TDM damage counts again", hurt[1] < hurt[0] && !hurt[2], JSON.stringify(hurt));

const C = await open("C", "third_troll");
await joinSocial(C, "depot");
const c2 = await until(C, (s) => s.mode === "tdm" && s.gameState === "playing", 90000);
await loaded(C);
check("a latecomer picking Socialize lands in the room's TDM", c2.mode === "tdm" && c2.seq === a2.seq, JSON.stringify(c2));
check("on the room's map", c2.map === a2.map, `${c2.map} vs ${a2.map}`);

// ── 3. The match ends: back to the hangout ────────────────────────────────
await Promise.all([A, B, C].map((p) => p.evaluate(() => window.__trollOps.endMatch("Trolls win"))));
const voteShown = await A.evaluate(() => !document.getElementById("to-intermission").hidden);
check("no map vote in a Socialize room", !voteShown);
const back = await Promise.all([A, B, C].map((p) => until(p, inHangout, 60000)));
check("everyone is back in the hangout", back.every(inHangout), back.map((s) => s.mode).join(" / "));
check("on the hangout's old map", back.every((s) => s.map === a1.map), back.map((s) => s.map).join(" / "));
check("everyone agrees on the room's mode count", new Set(back.map((s) => s.seq)).size === 1, back.map((s) => s.seq).join(" / "));
await Promise.all([A, B, C].map((p) => loaded(p)));
await sleep(2500);
const botsLeft = await A.evaluate(() => window.__trollOps.bots.bots.length + [...window.__trollOps.net.peers.values()].filter((x) => String(x.id).startsWith("bot-")).length);
check("the bots are gone", botsLeft === 0, String(botsLeft));

// The owner can end a match early.
await A.evaluate(() => window.__trollOps.ownerSwitchRoomMode("koth"));
await until(B, (s) => s.mode === "koth", 60000);
await A.evaluate(() => window.__trollOps.ownerSwitchRoomMode("social"));
const early = await until(B, inHangout, 60000);
check("the owner can send the room back early", inHangout(early), JSON.stringify(early));

const left = await B.evaluate(() => { const T = window.__trollOps; T.els.quitBtn.click(); return T.social(); });
check("leaving puts the lobby back on Socialize", left.mode === "social" && !left.room, JSON.stringify(left));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
