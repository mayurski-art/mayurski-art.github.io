// The gear chips show pictures, one per item carried, with their keys:
//   1. every melee weapon, lethal and tactical (gear.js MELEE_DEFS,
//      THROWABLE_DEFS), the Cope Plate and the Hopium has a gear-icons PNG
//      that loads (128 x 128), and view/gear-chips.js lists every one
//   2. a TDM match (private room): the melee and throwable chips are
//      pictures (img with alt, chip aria-label / title with the name), as
//      many throwable pictures as carried, the keys V and G; one thrown
//      leaves one; a different throwable swaps the picture
//   3. a pad (stubbed): the keycaps read RS / RB on an Xbox pad, R3 / R1 on
//      a PlayStation one, LB for a tactical; unplugged, back to V / G
//   4. a Royale match: 3 plates and 2 Hopium are 3 and 2 pictures with
//      4 / 5 (↑ / ↓ on a pad); none left is one faded picture
//   5. a phone (touch): the chips stay hidden, the touch buttons stand
//   6. no page errors
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-gear-icons-test.mjs
// SHOTS=<dir> saves the chips' corner in each state, and the whole screen.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

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

let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });
const errors = [];

/* A pad the test can plug in: window.__pad.on, window.__pad.id. */
const padStub = () => {
  const pad = { on: false, id: "Xbox 360 Controller (XInput STANDARD GAMEPAD)" };
  window.__pad = pad;
  const real = navigator.getGamepads?.bind(navigator);
  navigator.getGamepads = () => {
    if (!pad.on) return real ? real() : [];
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
    return [{ id: pad.id, index: 0, connected: true, mapping: "standard", timestamp: performance.now(), axes: [0, 0, 0, 0], buttons }];
  };
};

async function openMatch(ctx, mode) {
  const page = await ctx.newPage();
  await page.route(/supabase/, (r) => r.abort());
  page.on("pageerror", (e) => errors.push(`${mode}: ${e.message}`));
  await page.addInitScript(padStub);
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 120000 });
  await page.evaluate(async (mode) => {
    const T = window.__trollOps;
    if (mode === "royale") T.DROP.enabled = false;
    T.setMode(mode);
    T.els.noBots.checked = true;
    // a private room, never the public one
    T.els.room.value = "GI" + Math.random().toString(36).slice(2, 5).toUpperCase();
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

/* What a chip shows: its pictures (src name, alt, loaded), keycap, label. */
const chip = (page, id) => page.evaluate((id) => {
  const el = document.getElementById(id);
  if (!el) return null;
  const imgs = [...el.querySelectorAll("img.to-gear-icon")];
  const cap = el.querySelector(":scope > b");
  return {
    shown: el.offsetParent !== null && !el.hidden && getComputedStyle(el).display !== "none",
    icons: imgs.map((i) => i.src.match(/gear-icons\/([a-z]+)\.png/)?.[1]),
    ghost: imgs.filter((i) => i.classList.contains("is-ghost")).length,
    loaded: imgs.every((i) => i.complete && i.naturalWidth === 128),
    alt: imgs[0]?.alt || "",
    label: el.getAttribute("aria-label") || "",
    title: el.title,
    cap: cap && !cap.hidden ? cap.textContent : null,
    text: [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(""),
  };
}, id);
const corner = async (page, name) => {
  if (!SHOTS) return;
  const box = await page.evaluate(() => { const r = document.getElementById("to-hud-gear").getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), clip: { x: 0, y: Math.max(0, box.y - 70), width: Math.min(560, box.x + box.w + 160), height: box.h + 120 } });
};
const waitImgs = (page) => page.waitForFunction(() => [...document.querySelectorAll("img.to-gear-icon")].every((i) => i.complete), null, { timeout: 15000 }).catch(() => {});

/* ---- 1 + 2 + 3: TDM -------------------------------------------------- */
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await openMatch(ctx, "tdm");

const files = await page.evaluate(async () => {
  const gear = await import("./assets/games/troll-ops/weapons/gear.js");
  const chips = await import("./assets/games/troll-ops/view/gear-chips.js");
  const want = [...Object.keys(gear.MELEE_DEFS), ...Object.keys(gear.THROWABLE_DEFS), "plate", "heal"];
  const out = {};
  for (const id of want) {
    out[id] = await new Promise((res) => {
      const im = new Image();
      im.onload = () => res(im.naturalWidth === 128 && im.naturalHeight === 128 ? "ok" : `${im.naturalWidth}x${im.naturalHeight}`);
      im.onerror = () => res("missing");
      im.src = chips.gearIconUrl(id);
    });
  }
  return { out, listed: want.filter((id) => !chips.GEAR_ICON_IDS.includes(id)) };
});
const bad = Object.entries(files.out).filter(([, v]) => v !== "ok");
check(`every melee, lethal, tactical, plate and Hopium has a 128 px icon (${Object.keys(files.out).length})`, bad.length === 0, bad.map((b) => b.join(":")).join(", "));
check("gear-chips.js lists every one", files.listed.length === 0, files.listed.join(", "));

await waitImgs(page);
const lo = await page.evaluate(() => { const T = window.__trollOps; return { melee: T.player.melee.def, thr: T.loadout.throwable, kind: T.loadout.throwKind, n: T.player.gear[T.loadout.throwKind] }; });
const slotId = lo.kind === "lethal" ? "to-gear-lethal" : "to-gear-tactical";
let m = await chip(page, "to-gear-melee"), t = await chip(page, slotId);
check("melee chip: its picture, named", m.shown && m.icons.length === 1 && m.icons[0] === lo.melee.id && m.loaded && m.alt === lo.melee.name && m.label === lo.melee.name, JSON.stringify(m));
check("throwable chip: one picture per carried, named", t.shown && t.icons.length === lo.n && t.icons.every((i) => i === lo.thr.id) && t.loaded && t.alt.startsWith(lo.thr.name) && t.title.startsWith(lo.thr.name), JSON.stringify(t));
check("no words left on the chips", !m.text && !t.text);
check("keys: V on melee, G on the throwable", m.cap === "V" && t.cap === "G", `${m.cap} ${t.cap}`);
await corner(page, "tdm-keys");
if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "tdm-full.png") });

// one thrown
await page.evaluate(() => { const T = window.__trollOps; T.player.gear[T.loadout.throwKind] = 1; T.setHolding("melee"); T.setHolding("gun"); });
t = await chip(page, slotId);
check("one thrown: one picture", t.icons.length === 1 && t.ghost === 0, JSON.stringify(t.icons));
await page.evaluate(() => { const T = window.__trollOps; T.player.gear[T.loadout.throwKind] = 0; T.setHolding("melee"); T.setHolding("gun"); });
t = await chip(page, slotId);
check("none left: one faded picture, chip dimmed", t.icons.length === 1 && t.ghost === 1 && (await page.$eval(`#${slotId}`, (e) => e.classList.contains("is-empty"))));

// a different throwable: the smoke as the tactical, then the frag back
await page.evaluate(() => { const T = window.__trollOps; T.loadout.throwKind = "tactical"; T.loadout.tacticalId = "smoke"; T.player.gear.tactical = 2; T.player.gear.lethal = 0; T.setHolding("melee"); T.setHolding("gun"); });
await waitImgs(page);
t = await chip(page, "to-gear-tactical");
const lethalShown = (await chip(page, "to-gear-lethal")).shown;
check("swapped to Smoke: two smoke pictures, the lethal chip gone", t.shown && t.icons.join() === "smoke,smoke" && t.alt.startsWith("Smoke") && !lethalShown, JSON.stringify(t));
check("...its key G", t.cap === "G", t.cap);

// a pad
await page.evaluate(() => { window.__pad.on = true; });
await sleep(700);
m = await chip(page, "to-gear-melee"); t = await chip(page, "to-gear-tactical");
check("Xbox pad: RS on melee, LB on the tactical", m.cap === "RS" && t.cap === "LB", `${m.cap} ${t.cap}`);
await corner(page, "tdm-pad-xbox-tactical");
await page.evaluate(() => { const T = window.__trollOps; T.loadout.throwKind = "lethal"; T.loadout.lethalId = "frag"; T.player.gear.lethal = 2; T.player.gear.tactical = 0; T.setHolding("melee"); T.setHolding("gun"); });
await sleep(300);
t = await chip(page, "to-gear-lethal");
check("...and RB on a lethal (frag x2)", t.cap === "RB" && t.icons.join() === "frag,frag", `${t.cap} ${t.icons}`);
await corner(page, "tdm-pad-xbox");
await page.evaluate(() => { window.__pad.id = "DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)"; });
await sleep(700);
m = await chip(page, "to-gear-melee"); t = await chip(page, "to-gear-lethal");
check("PlayStation pad: R3 / R1", m.cap === "R3" && t.cap === "R1", `${m.cap} ${t.cap}`);
await corner(page, "tdm-pad-ps");
await page.evaluate(() => { window.__pad.on = false; });
await sleep(700);
m = await chip(page, "to-gear-melee"); t = await chip(page, "to-gear-lethal");
check("unplugged: back to V / G", m.cap === "V" && t.cap === "G", `${m.cap} ${t.cap}`);
await page.close();

/* ---- 4: Royale ------------------------------------------------------- */
const rp = await openMatch(ctx, "royale");
// updateRoyaleGear from the very module game.js imports (its own ?v= tag)
const royaleUrl = "./assets/games/troll-ops/" + fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/game.js"), "utf8").match(/"\.\/(modes\/royale\.js\?v=[^"]+)"/)[1];
const setLoad = (p, h) => rp.evaluate(async ([p, h, url]) => {
  const T = window.__trollOps;
  T.player.plates = p; T.player.heals = h; T.royale().act = null;
  (await import(url)).updateRoyaleGear();
}, [p, h, royaleUrl]);
const redraw = async () => {};
await setLoad(3, 2); await redraw(); await sleep(300); await waitImgs(rp);
let pl = await chip(rp, "to-gear-plates"), he = await chip(rp, "to-gear-heals");
check("Royale: 3 plates = 3 plate pictures", pl.shown && pl.icons.join() === "plate,plate,plate" && pl.loaded, JSON.stringify(pl));
check("...2 Hopium = 2 injector pictures", he.shown && he.icons.join() === "heal,heal" && he.loaded, JSON.stringify(he));
check("...named for screen readers", /Cope Plate/.test(pl.label) && /3 left/.test(pl.label) && /Hopium/.test(he.label) && pl.alt.startsWith("Cope Plate"), `${pl.label} | ${he.label}`);
check("...keys 4 / 5", pl.cap === "4" && he.cap === "5", `${pl.cap} ${he.cap}`);
// the whole row at full carry stays clear of the health bar and the ammo
const lay = await rp.evaluate(() => {
  const r = (id) => { const e = document.getElementById(id); if (!e || e.offsetParent === null) return null; const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
  return { gear: r("to-hud-gear"), hp: r("hud-health"), ammo: r("hud-ammo"), w: innerWidth };
});
const hit = (a, b) => a && b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
check("full carry: the gear row overlaps neither health nor ammo", lay.gear && !hit(lay.gear, lay.hp) && !hit(lay.gear, lay.ammo), JSON.stringify(lay));
await corner(rp, "royale-keys");
if (SHOTS) await rp.screenshot({ path: path.join(SHOTS, "royale-full.png") });
await rp.evaluate(() => { window.__pad.on = true; });
await sleep(700);
pl = await chip(rp, "to-gear-plates"); he = await chip(rp, "to-gear-heals");
check("Royale pad: ↑ / ↓", pl.cap === "↑" && he.cap === "↓", `${pl.cap} ${he.cap}`);
await corner(rp, "royale-pad");
await rp.evaluate(() => { window.__pad.on = false; });
await setLoad(0, 1); await redraw(); await sleep(300);
pl = await chip(rp, "to-gear-plates"); he = await chip(rp, "to-gear-heals");
check("no plates left: one faded plate; one Hopium: one picture", pl.icons.length === 1 && pl.ghost === 1 && he.icons.length === 1 && he.ghost === 0, `${JSON.stringify(pl.icons)} ${pl.ghost} ${JSON.stringify(he.icons)}`);
// a small laptop window: the row still fits
await rp.setViewportSize({ width: 667, height: 375 });
await setLoad(3, 2); await redraw(); await sleep(500);
const small = await rp.evaluate(() => {
  const g = document.getElementById("to-hud-gear").getBoundingClientRect();
  const a = document.getElementById("hud-ammo")?.getBoundingClientRect();
  return { gr: g.right, gt: g.top, gb: g.bottom, al: a?.left, at: a?.top, ab: a?.bottom, w: innerWidth };
});
check("667 x 375: the row fits on screen, clear of the ammo", small.gr <= small.w && !(small.al != null && small.gr > small.al && small.gt < small.ab && small.at < small.gb), JSON.stringify(small));
if (SHOTS) await rp.screenshot({ path: path.join(SHOTS, "royale-667.png") });
await rp.close();
await ctx.close();

/* ---- 5: a phone ------------------------------------------------------ */
const phone = await browser.newContext({ ...devices["iPhone 13 landscape"] });
const pp = await openMatch(phone, "tdm");
const ph = await pp.evaluate(() => ({
  touch: document.body.classList.contains("to-touch-play"),
  gear: getComputedStyle(document.getElementById("to-hud-gear")).display,
  nade: (() => { const b = document.querySelector("#to-touch-nade:not(.is-uncarried), #to-touch-tac:not(.is-uncarried)"); return b ? b.offsetParent !== null : false; })(),
}));
check("phone: touch layout, the chips hidden, a throw button showing", ph.touch && ph.gear === "none" && ph.nade, JSON.stringify(ph));
if (SHOTS) await pp.screenshot({ path: path.join(SHOTS, "phone.png") });
await phone.close();

check("no page errors", errors.length === 0, errors.slice(0, 4).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
