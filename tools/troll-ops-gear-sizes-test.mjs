// The gear pictures follow the screen, and they're on touch too:
//   1. desktop: the gear row's icons grow with the window (1280x720,
//      1366x768, 1920x1080, 2560x1440, 3840x2160) and the row never
//      overlaps the health bar, the ammo, the radio button or the streak
//      column (TDM, with streaks) or, at full carry, Royale's whole row
//   2. touch (phones 375-430 tall landscape, an iPad): the melee and the
//      throwable buttons show the carried item's picture; in Troll Royale
//      the Cope Plate and Hopium buttons show theirs with the count, grow
//      with the screen, cover none of the other controls, and a tap puts a
//      plate on / takes Hopium (royale.act.kind); dimmed when unusable
//   3. no page errors
// Private rooms only, Supabase blocked.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-gear-sizes-test.mjs
// SHOTS=<dir> saves the corner (desktop) or the whole screen (touch) at each size.

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
const SHOTS = process.env.SHOTS;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const royaleUrl = "./assets/games/troll-ops/" + fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/game.js"), "utf8").match(/"\.\/(modes\/royale\.js\?v=[^"]+)"/)[1];

let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });

async function openMatch(ctx, mode, tag) {
  const page = await ctx.newPage();
  await page.route(/supabase/, (r) => r.abort());
  page.on("pageerror", (e) => errors.push(`${tag}: ${e.message}`));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 120000 });
  await page.evaluate(async (mode) => {
    const T = window.__trollOps;
    if (mode === "royale") T.DROP.enabled = false;
    T.setMode(mode);
    T.els.noBots.checked = true;
    // a private room, never the public one
    T.els.room.value = "GS" + Math.random().toString(36).slice(2, 5).toUpperCase();
    T.els.room.dispatchEvent(new Event("input"));
    await T.startGame();
    if (T.isStaging()) T.endStaging();
  }, mode);
  await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 240000 });
  await page.evaluate(() => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); });
  await page.waitForFunction(() => !window.__trollOps.isStaging(), null, { timeout: 30000 });
  await sleep(1500);
  return page;
}
const setLoad = (page, p, h) => page.evaluate(async ([p, h, url]) => {
  const T = window.__trollOps;
  T.player.plates = p; T.player.heals = h; T.royale().act = null;
  (await import(url)).updateRoyaleGear();
}, [p, h, royaleUrl]);
const waitImgs = (page) => page.waitForFunction(() => [...document.querySelectorAll("img.to-gear-icon, img.to-touch-item")].every((i) => i.complete), null, { timeout: 15000 }).catch(() => {});

/* Rects of what's showing, by selector. */
const rects = (page, sels) => page.evaluate((sels) => {
  const out = {};
  for (const [k, s] of Object.entries(sels)) {
    const e = document.querySelector(s);
    if (!e || e.offsetParent === null || getComputedStyle(e).display === "none" || getComputedStyle(e).visibility === "hidden") { out[k] = null; continue; }
    const b = e.getBoundingClientRect();
    out[k] = b.width && b.height ? { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom) } : null;
  }
  return out;
}, sels);
/* ?tohooks=1 mounts the animation debug panel over the right thumb's
   buttons; out of the screenshots. */
const hideDebug = (page) => page.evaluate(() => {
  const all = [...document.querySelectorAll("div, pre")].filter((e) => /weapon:/.test(e.textContent) && /markingStreak:/.test(e.textContent));
  all.sort((a, b) => a.textContent.length - b.textContent.length);
  if (all[0]) all[0].style.display = "none";
});
const hit = (a, b) => a && b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

/* ---- 1: desktop sizes ------------------------------------------------- */
const SIZES = [[1280, 720], [1366, 768], [1920, 1080], [2560, 1440], [3840, 2160]];
const DESK = { gear: "#to-hud-gear", hp: "#hud-health", ammo: "#hud-ammo", radio: "#to-radio-toggle", streaks: "#to-ss-hud" };
const dctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
for (const mode of ["tdm", "royale"]) {
  const page = await openMatch(dctx, mode, `desk-${mode}`);
  if (mode === "royale") await setLoad(page, 3, 2);
  let prev = 0;
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h });
    await sleep(500);
    await waitImgs(page);
    const px = await page.evaluate(() => document.querySelector("#to-gear-lethal img.to-gear-icon, #to-gear-tactical img.to-gear-icon")?.getBoundingClientRect().height || 0);
    const r = await rects(page, DESK);
    const bad = ["hp", "ammo", "radio", "streaks"].filter((k) => hit(r.gear, r[k]));
    check(`${mode} ${w}x${h}: icons ${px.toFixed(1)} px, the row clear of ${Object.keys(r).filter((k) => k !== "gear" && r[k]).join(", ")}`,
      r.gear && px >= prev - 0.01 && px >= 19 && px <= 44.5 && !bad.length && r.gear.r < w, `overlaps: ${bad.join(",") || "none"}; ${JSON.stringify(r)}`);
    prev = px;
    if (SHOTS && r.gear) {
      const y = Math.max(0, Math.min(r.gear.t, r.streaks?.t ?? r.gear.t) - 20);
      await page.screenshot({ path: path.join(SHOTS, `desk-${mode}-${w}x${h}.png`), clip: { x: 0, y, width: Math.min(w, Math.max(r.gear.r, r.hp?.r || 0) + 60), height: h - y } });
    }
  }
  check(`${mode}: icons grew from 720p to 4K`, prev > 40, `${prev.toFixed(1)} px at 4K`);
  await page.close();
}
await dctx.close();

/* ---- 2: touch ---------------------------------------------------------- */
const TOUCH = [["phone-667x375", 667, 375], ["phone-844x390", 844, 390], ["phone-932x430", 932, 430], ["ipad-1180x820", 1180, 820]];
const OTHER = ".to-touch-btn:not(.to-touch-plate):not(.to-touch-heal), #to-touch-move, .to-hud-bottom, canvas.to-minimap, #to-ss-hud";
let prevW = 0;
for (const [name, w, h] of TOUCH) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await openMatch(ctx, "royale", name);
  await setLoad(page, 2, 2);
  await page.evaluate(() => { const P = window.__trollOps.player; P.armor = 0; P.hp = Math.min(P.hp, 40); });
  await sleep(400);
  await waitImgs(page);
  const st = await page.evaluate(() => {
    const q = (id) => document.getElementById(id);
    const item = (b) => (b && b.classList.contains("has-item") ? b.querySelector("img.to-touch-item")?.src.match(/gear-icons\/([a-z]+)\.png/)?.[1] : null);
    const thr = [q("to-touch-nade"), q("to-touch-tac")].find((b) => b && !b.classList.contains("is-uncarried"));
    const T = window.__trollOps;
    return {
      touch: document.body.classList.contains("to-touch-play"),
      melee: item(q("to-touch-melee")), meleeWant: T.player.melee.def.id,
      thr: item(thr), thrWant: T.loadout.throwable.id,
      plate: item(q("to-touch-plate")), heal: item(q("to-touch-heal")),
      plateN: q("to-touch-plate")?.dataset.n, healN: q("to-touch-heal")?.dataset.n,
      plateW: q("to-touch-plate")?.getBoundingClientRect().width || 0,
      loaded: [...document.querySelectorAll("img.to-touch-item")].filter((i) => i.offsetParent).every((i) => i.naturalWidth === 128),
      label: q("to-touch-plate")?.getAttribute("aria-label"),
    };
  });
  check(`${name}: melee and throwable buttons show their pictures`, st.touch && st.melee === st.meleeWant && st.thr === st.thrWant && st.loaded, JSON.stringify(st));
  check(`${name}: plate and Hopium buttons with pictures and counts (${st.plateW.toFixed(0)} px)`, st.plate === "plate" && st.heal === "heal" && st.plateN === "2" && st.healN === "2" && /2 left/.test(st.label || "") && st.plateW >= prevW - 0.5 && st.plateW >= 40, JSON.stringify(st));
  prevW = st.plateW;
  const mine = await rects(page, { plate: "#to-touch-plate", heal: "#to-touch-heal" });
  const others = await page.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null && getComputedStyle(e).display !== "none" && getComputedStyle(e).visibility !== "hidden" && !e.hidden)
    .map((e) => { const b = e.getBoundingClientRect(); return { id: e.id || e.className.split(" ")[0], l: b.left, r: b.right, t: b.top, b: b.bottom }; }).filter((b) => b.r > b.l), OTHER);
  const covered = others.filter((o) => hit(mine.plate, o) || hit(mine.heal, o)).map((o) => o.id);
  check(`${name}: the plate and Hopium buttons cover no other control`, mine.plate && mine.heal && !covered.length && mine.plate.l >= 0 && mine.heal.r <= w, covered.join(", ") || JSON.stringify(mine));
  if (SHOTS) { await hideDebug(page); await page.screenshot({ path: path.join(SHOTS, `touch-${name}.png`) }); }
  await page.tap("#to-touch-plate");
  await sleep(150);
  const a1 = await page.evaluate(() => window.__trollOps.royale().act?.kind || null);
  check(`${name}: tap the plate button -> plating up`, a1 === "plate", a1);
  const dim = await page.evaluate(() => document.getElementById("to-touch-heal").classList.contains("is-unusable"));
  check(`${name}: ...Hopium dimmed while busy`, dim);
  await page.evaluate(() => { window.__trollOps.royale().act = null; });
  await sleep(100);
  await page.tap("#to-touch-heal");
  await sleep(150);
  const a2 = await page.evaluate(() => window.__trollOps.royale().act?.kind || null);
  check(`${name}: tap the Hopium button -> Hopium`, a2 === "heal", a2);
  await page.evaluate(() => { window.__trollOps.royale().act = null; });
  await setLoad(page, 0, 1);
  await page.evaluate(() => { window.__trollOps.player.hp = window.__trollOps.player.maxHp; });
  await sleep(300);
  const d = await page.evaluate(() => ({ p: document.getElementById("to-touch-plate").classList.contains("is-empty"), h: document.getElementById("to-touch-heal").classList.contains("is-unusable") }));
  check(`${name}: no plates = dimmed; full health = Hopium dimmed`, d.p && d.h, JSON.stringify(d));
  await ctx.close();
}

// TDM on a phone: the pictures on melee and the throwable, no Royale buttons
{
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await openMatch(ctx, "tdm", "phone-tdm");
  await waitImgs(page);
  const st = await page.evaluate(() => {
    const T = window.__trollOps;
    const b = document.getElementById(T.loadout.throwKind === "lethal" ? "to-touch-nade" : "to-touch-tac");
    return { melee: document.getElementById("to-touch-melee").dataset.item, thr: b.dataset.item, want: T.loadout.throwable.id, n: b.dataset.n,
      royaleBtns: ["to-touch-plate", "to-touch-heal"].some((id) => document.getElementById(id).offsetParent !== null) };
  });
  check("phone TDM: melee and throwable pictures, count kept, no plate / Hopium buttons", st.melee && st.thr === st.want && st.n === "2" && !st.royaleBtns, JSON.stringify(st));
  // a different throwable swaps the button's picture
  await page.evaluate(() => { const T = window.__trollOps; T.loadout.throwKind = "tactical"; T.loadout.tacticalId = "smoke"; T.player.gear.tactical = 2; T.setHolding("melee"); T.setHolding("gun"); });
  const sw = await page.evaluate(() => document.getElementById("to-touch-tac").dataset.item);
  check("phone TDM: swapped to Smoke, the tactical button shows the smoke", sw === "smoke", sw);
  if (SHOTS) { await hideDebug(page); await page.screenshot({ path: path.join(SHOTS, "touch-phone-tdm.png") }); }
  await ctx.close();
}

check("no page errors", errors.length === 0, errors.slice(0, 4).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
