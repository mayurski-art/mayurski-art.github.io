// Troll Forces Zombies Credits check (Zombie Rush P6). One headless tab,
// Supabase blocked; the run is SOLO (no room code), never a public room.
//   1. A guest: a run's pay lands in memory only, nothing in localStorage.
//   2. Logged in (a stubbed profile): the Weapons kiosk shows its tiers (five while arsenal v2 retires guns),
//      tiers past your best wave locked, the free starter equipped; Buy,
//      Upgrade and Equip spend Credits; Classes levels the turret.
//   3. Reload: all of it is still there (localStorage, which the account syncs).
//   4. A solo run starts with the bought gun at its level and the turret at
//      its kit level; the run's end pays Credits and the results card says so.
//   5. The menu's Zombies screen lists Weapons and Classes.
// Text-overlap scans and screenshots of both screens.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-zcredits-test.mjs
//   SHOTS_DIR=<dir>; PHONE=1 for a landscape phone
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
import { textClash as scanText } from "./troll-ops-text-scan.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOTS_DIR || os.tmpdir();
const TAG = process.env.PHONE ? "-phone" : "";
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
const ctx = await browser.newContext(process.env.PHONE
  ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
  : { viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !/frame-ancestors|ERR_FAILED|supabase/i.test(m.text())) errors.push(m.text()); });
const R = (fn, arg) => page.evaluate(fn, arg);
const until = (fn, arg, ms = 30000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }).then(() => true).catch(() => false);

async function load() {
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps && !!window.__trollHub, null, { timeout: 180000 });
}
/* Pretend to be signed in: credits.js asks the accounts script who you are. */
const logIn = () => R(() => {
  const A = (window.TrollrunnerAccounts ||= {});
  A.getCachedProfile = () => ({ userId: "test-user", username: "zc_tester" });
});

await load();
await R(() => localStorage.removeItem("trollops:zombies"));

// 1. a guest
const guestPay = await R(() => window.__trollHub.zc.payRun({ kills: 10, wave: 3 }));
const guest = await R(() => ({ s: window.__trollHub.zc.zsave(), ls: localStorage.getItem("trollops:zombies") }));
check(guestPay === 60 && guest.s.credits === 60 && guest.ls == null, "guest: a run pays (10 kills + 2 waves = 60), kept in memory only", JSON.stringify(guest));

// 2. logged in: the Weapons kiosk
await logIn();
await R(() => window.__trollHub.zc.setZsave({ credits: 5000, best: 6 }));
await R(() => window.__trollHub.openKiosk("weapons"));
check(await until(() => window.__trollHub.kioskOpen(), null, 3000), "the Weapons kiosk opens");
const tiers = await R(() => [...document.querySelectorAll(".zk-tier")].map((b) => ({ n: b.querySelector(".zk-tier-n").textContent, locked: b.classList.contains("is-locked"), r: b.querySelector(".zk-tier-r").textContent })));
check(tiers.length === 5 && !tiers[0].locked && !tiers[1].locked && tiers[2].locked && tiers[2].r === "Wave 10", "five tiers; best wave 6 opens tiers 1-2 only", JSON.stringify(tiers.map((t) => t.r)));
const sel = await R(() => document.querySelector(".zk-sel")?.innerText.replace(/\s+/g, " "));
check(/Problem 416/.test(sel) && /Equipped/.test(sel), "the free starter is selected and equipped", sel);
check(await until(() => [...document.querySelectorAll(".zk-thumb")].some((i) => i.classList.contains("is-in") && i.src.length > 2000), null, 20000), "gun pictures render");
await sleep(1500);   // the rest of the pictures
await scanText(page, check, "the Weapons kiosk");
await page.screenshot({ path: path.join(SHOTS, `zcredits-weapons${TAG}.png`) });

// buy the Soul Blazer (tier 1, 400), level it once (150), then equip the starter back and the Soul Blazer again
await page.click(".zk-gun[data-id='soulblazer']");
await page.click(".zk-sel [data-act='buy']");
let s = await R(() => window.__trollHub.zc.zsave());
check(s.credits === 4600 && s.guns.soulblazer === 1 && s.gun === "soulblazer", "Buy: 400 Credits, owned and equipped", JSON.stringify(s));
await page.click(".zk-sel [data-act='upgrade']");
s = await R(() => window.__trollHub.zc.zsave());
check(s.credits === 4450 && s.guns.soulblazer === 2, "Upgrade: 150 Credits, level 2", JSON.stringify(s));
const statsTxt = await R(() => document.querySelector(".zk-stats")?.innerText.replace(/\s+/g, " "));
check(/>/.test(statsTxt), "stats show now > next", statsTxt);
await page.click(".zk-gun[data-id='problem416']");
await page.click(".zk-sel [data-act='equip']");
check((await R(() => window.__trollHub.zc.zsave())).gun === "problem416", "Equip switches the gun");
await page.click(".zk-gun[data-id='soulblazer']");
await page.click(".zk-sel [data-act='equip']");
// a locked tier: its button says so
await page.click(".zk-tier[data-id='4']");
const lockedBtn = await R(() => document.querySelector(".zk-sel .zk-btn")?.textContent);
check(/Wave 15/.test(lockedBtn), "a locked tier's gun can't be bought", lockedBtn);
await page.click(".zk-tier[data-id='2']");
await page.screenshot({ path: path.join(SHOTS, `zcredits-weapons-t2${TAG}.png`) });
await page.keyboard.press("Escape");
check(await until(() => !window.__trollHub.kioskOpen(), null, 3000), "Escape closes it");

// Classes
await R(() => window.__trollHub.openKiosk("classes"));
check(await until(() => document.querySelectorAll(".zk-dep").length === 3, null, 3000), "Classes: the Rookie's three deployables");
await page.click(".zk-dep [data-act='kit-up'][data-id='turret']");
s = await R(() => window.__trollHub.zc.zsave());
check(s.credits === 3850 && s.kits.rookie.turret === 2, "the turret levels up for 600", JSON.stringify(s));
await sleep(1500);
await scanText(page, check, "the Classes kiosk");
await page.screenshot({ path: path.join(SHOTS, `zcredits-classes${TAG}.png`) });
await page.keyboard.press("Escape");

// 3. reload: still there
await load();
await logIn();
s = await R(() => window.__trollHub.zc.zsave());
check(s.credits === 3850 && s.guns.soulblazer === 2 && s.gun === "soulblazer" && s.kits.rookie.turret === 2, "everything survives a reload", JSON.stringify(s));

// 4. a solo run (no room code: never a public room)
await R(async () => {
  const T = window.__trollOps;
  T.els.room.value = "";
  T.setMode("zombies");
  T.loadout.poolMapId = "pentagrin";
  await T.startGame();
  if (T.isStaging?.()) T.endStaging();
});
check(await until(() => !!window.__trollOps.zdir() && window.__trollOps.zdir().round >= 1, null, 120000), "the solo run starts");
const gun = await R(() => {
  const T = window.__trollOps, p = T.player, w = p.weapons[p.weaponId];
  return { id: p.weaponId, lv: w.def.zLevel || 1, dmg: w.def.damage, turret: T.zrun().dep.levels.turret, room: T.els.room.value };
});
const baseDmg = await R(() => window.__trollOps.weaponDefs?.soulblazer?.damage ?? null);
check(gun.id === "soulblazer" && gun.lv === 2 && (baseDmg == null || Math.abs(gun.dmg - baseDmg * 1.06) < 0.01) && !gun.room, "the run's primary is the bought Soul Blazer at level 2", JSON.stringify({ ...gun, baseDmg }));
check(gun.turret === 2, "the turret is at its kit level");
await R(() => { const T = window.__trollOps; T.player.kills = 20; T.player.wave = 4; window.__trollHub.endRun("dead"); });
check(await until(() => window.__trollOps.gameState === "gameover" || window.__trollHub.state() === "gameover", null, 10000), "the run ends");
const xp = await R(() => document.getElementById("to-go-xp")?.textContent || "");
s = await R(() => window.__trollHub.zc.zsave());
check(/\+95 Credits/.test(xp) && s.credits === 3850 + 95 && s.best === 6, "the run pays 20 + 3 waves x 25 = 95 Credits, on the results card", `${xp} ${JSON.stringify(s)}`);

// 5. the menu rows
const menuTxt = await R(() => {
  const m = window.__trollOps.menu || null;
  return m?.screen?.("zombies") ? JSON.stringify(m.screen("zombies")) : null;
});
if (menuTxt != null) check(/Weapons/.test(menuTxt) && /Classes/.test(menuTxt), "the menu's Zombies screen lists Weapons and Classes");

check(!errors.length, "no page errors", errors.slice(0, 4).join(" | "));
await browser.close();
server.close();
console.log(fails ? `${fails} failed` : "all passed");
process.exit(fails ? 1 : 0);
