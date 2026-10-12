// Troll Forces zombies run check (Zombie Rush P1): kills pay cash with a
// feed line and a floating "+$N", reserve ammo reads ∞, the upgrade column
// buys max health / a gun tier / a melee tier and refuses what you can't
// afford, the break between waves can be skipped, going down is a last
// stand (three kills to get up) that bleeds out to game over, and clearing
// the final wave wins. Solo, no network. Screenshots for a look.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-zrun-test.mjs [mapId]
//   SHOTS_DIR=<dir> for the screenshots (default: the OS temp dir)
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOTS_DIR || os.tmpdir();
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
// PHONE=1: a landscape phone with touch, for the layout against the touch buttons
const ctx = await browser.newContext(process.env.PHONE
  ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
  : { viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const map = process.argv[2] || "hollowgrin";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
// (Supabase is blocked on purpose, and the CSP meta warns about frame-ancestors)
page.on("console", (m) => { if (m.type() === "error" && !/frame-ancestors|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
await page.evaluate(async (map) => {
  const T = window.__trollOps;
  T.setMode("zombies");
  T.loadout.poolMapId = map;
  await T.startGame();
  if (T.isStaging?.()) T.endStaging();
}, map);
await page.waitForFunction(() => !!window.__trollOps.zdir() && window.__trollOps.zdir().round >= 1, null, { timeout: 120000 });

/* A zombie on its feet, killed by the local player. */
const killOne = (isHead = false) => page.evaluate((isHead) => {
  const T = window.__trollOps;
  const z = T.zdir().zombies.find((q) => q.alive && !q.dying);
  if (!z) return null;
  const point = z.mesh.position.clone(); point.y += 1.5;
  T.onBulletActorHit(z, { damage: 1e7, isHead, point, dir: new T.THREE.Vector3(0, 0, -1) });
  return z.type.id;
}, isHead);
const waitAlive = (n) => page.waitForFunction((n) => window.__trollOps.zdir().zombies.filter((q) => q.alive && !q.dying).length >= n, n, { timeout: 120000 }).then(() => true).catch(() => false);

/* No text on top of other text, an icon or a touch control, and none cut
   short with "…". Measures the glyph boxes of every visible text node on
   screen (Range rects, not the containers), so a long label spilling out
   of its box counts. The test hooks' debug readout is left out. */
async function textClash(when) {
  await sleep(700); // let the banner / feed entrances settle
  const res = await page.evaluate(() => {
    const W = innerWidth, H = innerHeight;
    const seen = (el) => {
      for (let e = el; e && e !== document.body; e = e.parentElement) {
        if (e.id === "to-anim-debug") return false;
        const cs = getComputedStyle(e);
        if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.05) return false;
      }
      return true;
    };
    const label = (e) => {
      const name = e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\s+/)[0] : e.tagName.toLowerCase();
      return e.id ? `#${e.id}` : name;
    };
    // The ink, not the line box: Oswald's line box runs half an em past its
    // capitals, so two stacked labels' boxes cross while their letters don't.
    const ctx = document.createElement("canvas").getContext("2d");
    const ink = (el, text, r) => {
      const cs = getComputedStyle(el);
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const m = ctx.measureText(text);
      const box = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent;
      const k = box > 0 ? r.height / box : 1; // a scaled (animating) label
      const base = r.top + m.fontBoundingBoxAscent * k;
      return { left: r.left, right: r.right, top: base - m.actualBoundingBoxAscent * k, bottom: base + m.actualBoundingBoxDescent * k };
    };
    const items = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim() || !seen(n.parentElement)) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      const r = rg.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.right < 0 || r.bottom < 0 || r.left > W || r.top > H) continue;
      items.push({ el: n.parentElement, what: `"${n.textContent.trim().slice(0, 18)}" ${label(n.parentElement)}`, r: ink(n.parentElement, n.textContent, r), text: true, world: !!n.parentElement.closest(".to-dmg-num") });
    }
    for (const el of document.querySelectorAll(".zh-icon svg, .to-touch-btn, .to-touch-stick, canvas.to-minimap")) {
      if (!seen(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      items.push({ el, what: label(el), r, text: false });
    }
    const hits = [];
    const P = 2; // the text stroke can kiss
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      if (!a.text && !b.text) continue;
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      // floating numbers live in the world and drift past the HUD; only
      // two of them on top of each other counts
      if (a.world !== b.world) continue;
      if (a.r.left < b.r.right - P && b.r.left < a.r.right - P && a.r.top < b.r.bottom - P && b.r.top < a.r.bottom - P) hits.push(`${a.what} x ${b.what}`);
    }
    const cut = [];
    for (const it of items) {
      if (!it.text) continue;
      const cs = getComputedStyle(it.el);
      if (cs.textOverflow === "ellipsis" && it.el.scrollWidth > it.el.clientWidth + 1) cut.push(it.what);
      // a card clips what spills out of it
      const card = it.el.closest(".zh-card")?.getBoundingClientRect();
      if (card && (it.r.top < card.top + 1 || it.r.bottom > card.bottom - 1 || it.r.left < card.left || it.r.right > card.right)) cut.push(it.what + " (out of its card)");
    }
    return { hits: [...new Set(hits)], cut: [...new Set(cut)], n: items.length };
  });
  check(res.hits.length === 0, `${when}: no text overlaps (${res.n} measured)`, res.hits.slice(0, 6).join(" | "));
  check(res.cut.length === 0, `${when}: no text cut short`, res.cut.join(" | "));
}

// ---- the HUD
const hud = await page.evaluate(() => {
  const zh = document.getElementById("to-zh");
  return {
    shown: !!zh && !zh.hidden,
    wave: zh?.querySelector(".zh-wave")?.textContent,
    left: zh?.querySelector(".zh-left")?.textContent,
    cash: zh?.querySelector(".zh-cash-n")?.textContent,
    cards: [...(zh?.querySelectorAll(".zh-card") || [])].length,
    res: document.getElementById("hud-ammo-res")?.textContent,
    stock: getComputedStyle(document.querySelector(".to-hud-score")).visibility,
  };
});
check(hud.shown, "the zombies HUD is up");
check(hud.wave === "Wave 1", "wave reads Wave 1", hud.wave);
check(/in 29 waves/.test(hud.left || ""), "29 waves to go", hud.left);
check(hud.cash === "$0", "cash starts at $0", hud.cash);
check(hud.cards === 3, "three upgrade cards", String(hud.cards));
check(hud.res === "∞", "reserve ammo reads ∞", hud.res);
check(hud.stock === "hidden", "the stock points box is hidden", hud.stock);

// ---- a kill pays
check(await waitAlive(1), "a zombie spawns");
const before = await page.evaluate(() => window.__trollOps.zrun().econ.cash);
const type = await killOne(false);
await sleep(300);
const pay = await page.evaluate(() => ({
  cash: window.__trollOps.zrun().econ.cash,
  feed: document.querySelector(".zh-feed")?.textContent || "",
  floats: [...document.querySelectorAll(".to-dmg-num.is-word")].map((e) => e.textContent),
  kills: window.__trollOps.player.kills,
}));
const want = { walker: 15, runner: 22, leaper: 30 }[type];
check(pay.cash - before === want, `a ${type} kill pays $${want}`, `${before} -> ${pay.cash}`);
check(/\+\$\d+ ZOMBIE KILL/.test(pay.feed), "the feed reads +$N ZOMBIE KILL", pay.feed);
check(pay.floats.some((t) => /^\+\$\d+$/.test(t)), "+$N floats over the kill", pay.floats.join(","));
check(pay.kills >= 1, "the kill counts");
await page.screenshot({ path: path.join(SHOTS, `zrun-hud${process.env.PHONE ? "-phone" : ""}.png`) });

await textClash("playing, after a kill");

// ---- every gun's name fits the gun card (the run only shows the one you
// hold), through the HUD's own fit: shrunk a touch, or on two lines
const fit = await page.evaluate(async () => {
  const src = await (await fetch("/assets/games/troll-ops/modes/zombies/run.js")).text();
  const hudUrl = "/assets/games/troll-ops/view/" + src.match(/view\/(zombies-hud\.js\?v=[^"]+)/)[1];
  const { fitLabel } = await import(hudUrl);
  const { WEAPON_DEFS } = await import("/assets/games/troll-ops/weapons.js");
  const t = document.querySelector(".zh-card-gun .zh-title");
  const cut = [], wrapped = [];
  let longest = "";
  for (const d of Object.values(WEAPON_DEFS)) {
    if (!d?.name) continue;
    fitLabel(t, d.name);
    const rg = document.createRange(); rg.selectNodeContents(t);
    const lines = new Set([...rg.getClientRects()].map((r) => Math.round(r.top))).size;
    if (t.classList.contains("is-wrap") ? lines > 2 : t.scrollWidth > t.clientWidth + 1) cut.push(d.name);
    if (t.classList.contains("is-wrap")) wrapped.push(d.name);
    if (d.name.length > longest.length) longest = d.name;
  }
  fitLabel(t, longest);
  return { cut, wrapped, longest };
});
check(fit.cut.length === 0, "every gun's name fits its card", fit.cut.join(", "));
console.log("on two lines:", fit.wrapped.join(", ") || "none");
await textClash(`the longest name on the card (${fit.longest})`);
await page.screenshot({ path: path.join(SHOTS, `zrun-longname${process.env.PHONE ? "-phone" : ""}.png`) });

// ---- the upgrade column
const buys = await page.evaluate(() => {
  const T = window.__trollOps;
  const R = T.zrun();
  R.econ.cash = 0;
  const poor = R.buy("hp");
  R.giveCash(10000);
  const base = T.currentWeapon().def.damage;
  const hp = R.buy("hp");
  const gun = R.buy("gun");
  const w = T.currentWeapon();
  const melee = R.buy("melee");
  return {
    poor, hp, gun, melee,
    maxHp: T.player.maxHp,
    dmgK: w.def.damage / base,
    reserve: w.ammoReserve,
    meleeId: T.player.melee.def.id,
    cash: R.econ.cash,
    offers: R.offers().map((o) => `${o.id}:${o.sub}:${o.price}`),
  };
});
check(buys.poor === false, "no cash, no buy");
check(buys.hp && buys.maxHp === 125, "max health +25", String(buys.maxHp));
check(buys.gun && Math.abs(buys.dmgK - 1.25) < 1e-6, "tier 1 hits 1.25x", buys.dmgK.toFixed(3));
check(buys.reserve === Infinity, "the tiered gun keeps infinite reserve");
check(buys.melee && buys.meleeId === "bat", "melee tier 1 is the bat", buys.meleeId);
check(buys.cash === 10000 - 100 - 250 - 75, "the three buys cost $425", String(buys.cash));
console.log("offers", buys.offers.join(" | "));
await textClash("after three buys");
await page.evaluate(() => { window.__trollOps.player.hp = 1e9; }); // tough, without a silly max on the card

// ---- the break, and skipping it
await page.evaluate(() => {
  const zd = window.__trollOps.zdir();
  for (const z of zd.zombies) if (z.alive && !z.dying) z.takeDamage(1e9, false);
  zd.toSpawn = 0;
  zd.state = "fighting";
});
const between = await page.waitForFunction(() => window.__trollOps.zdir().state === "between", null, { timeout: 30000 }).then(() => true).catch(() => false);
check(between, "the wave clears into a break");
const brk = await page.evaluate(() => ({
  skip: !document.querySelector(".zh-skip").hidden,
  text: document.querySelector(".zh-skip").textContent,
  breakT: window.__trollOps.zdir().breakT,
  bonus: /WAVE 1 CLEARED/.test(document.querySelector(".zh-feed").textContent),
}));
check(brk.skip, "the skip button shows", brk.text);
check(brk.breakT > 10, "the break is ~15 s", brk.breakT.toFixed(1));
check(brk.bonus, "the cleared wave pays a bonus");
await textClash("the break");
await page.screenshot({ path: path.join(SHOTS, "zrun-break.png") });
await page.keyboard.press("KeyK");
const wave2 = await page.waitForFunction(() => window.__trollOps.zdir().round === 2, null, { timeout: 10000 }).then(() => true).catch(() => false);
check(wave2, "K skips to wave 2");
await textClash("the Wave 2 banner");

// ---- down: the last stand
await page.evaluate(() => { const T = window.__trollOps; T.player.maxHp = 100; T.player.hp = 100; T.damagePlayer(500, null, null, false, null); });
await sleep(300);
const down = await page.evaluate(() => ({ downed: !!window.__trollOps.player.downed, alive: window.__trollOps.player.alive, ui: !document.querySelector(".zh-down").hidden }));
check(down.downed && down.alive, "0 HP is down, not dead");
check(down.ui, "the bleed-out bar shows");
await textClash("downed");
await page.screenshot({ path: path.join(SHOTS, "zrun-downed.png") });
check(await waitAlive(3), "three zombies to take down");
for (let i = 0; i < 3; i++) { await killOne(); await sleep(50); }
const up = await page.evaluate(() => ({ downed: !!window.__trollOps.player.downed, hp: window.__trollOps.player.hp }));
check(!up.downed && up.hp === 50, "three kills while down: back up at half health", JSON.stringify(up));
await textClash("back on your feet");

await page.evaluate(() => { const T = window.__trollOps; T.damagePlayer(500, null, null, false, null); T.zrun().run.bleedT = 0.05; });
const over = await page.waitForFunction(() => window.__trollOps.state() === "gameover", null, { timeout: 10000 }).then(() => true).catch(() => false);
check(over, "bleeding out ends the run");
check(await page.evaluate(() => document.getElementById("to-zh").hidden), "the zombies HUD goes with it");

// ---- the final wave wins
await page.evaluate(async (map) => {
  const T = window.__trollOps;
  T.setMode("zombies");
  T.loadout.poolMapId = map;
  await T.startGame();
  if (T.isStaging?.()) T.endStaging();
}, map);
await page.waitForFunction(() => !!window.__trollOps.zdir() && window.__trollOps.zdir().round >= 1, null, { timeout: 120000 });
await page.evaluate(() => {
  const T = window.__trollOps;
  T.player.hp = 1e9;
  T.zrun().forceWave(30);
  const zd = T.zdir();
  zd.toSpawn = 0;
  zd.state = "fighting";
});
const won = await page.waitForFunction(() => window.__trollOps.state() === "gameover", null, { timeout: 30000 }).then(() => true).catch(() => false);
const title = await page.evaluate(() => document.getElementById("to-go-title")?.textContent || document.querySelector(".to-gameover h2, .to-go-title")?.textContent);
check(won && /survived/i.test(title || ""), "clearing wave 30 wins", title);
await page.screenshot({ path: path.join(SHOTS, "zrun-won.png") });

check(errors.length === 0, "no page errors", errors.slice(0, 3).join(" | "));
console.log(fails ? `${fails} FAILED` : "ALL PASS", "· shots in", SHOTS);
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
