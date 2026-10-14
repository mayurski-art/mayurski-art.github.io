// Troll Forces: Black Ops 2's Xbox 360 layout on a pad, and the phone's
// first / third person button (user, 2026-10-14).
//
//   1. A pad in TDM: X reloads, Y switches weapon, R3 melees, L3 sprints
//      (latched; a pushed stick alone doesn't), LB throws the tactical and RB
//      the lethal, d-pad down / up scroll the ready scorestreaks both ways,
//      d-pad left tapped inspects and held opens the emote wheel.
//   2. A landscape phone: the camera button is on screen, clear of the other
//      buttons, and a tap goes 1P -> 3P -> 1P.
//
// node tools/troll-ops-bo2pad-test.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });

async function startTdm(page) {
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
  await page.evaluate(async () => {
    const T = window.__trollOps;
    T.setMode("tdm");
    await T.startGame();
    if (T.isStaging?.()) T.endStaging?.();
  });
  for (let t = Date.now(); Date.now() - t < 120000 && await page.evaluate(() => window.__trollOps.isStaging?.() || window.__trollOps.state() !== "playing");) await sleep(400);
}

// ---- 1. the pad ---------------------------------------------------------
{
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  await ctx.route(/supabase/, (r) => r.abort());
  await ctx.addInitScript(() => {
    const btns = () => Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
    const pad = { id: "Xbox 360 Controller (STANDARD GAMEPAD)", index: 0, connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons: btns(), timestamp: 1 };
    window.__pad = pad;
    Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => { pad.timestamp++; return [pad]; } });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await startTdm(page);
  check("a match is running", await page.evaluate(() => window.__trollOps.state() === "playing"));
  await sleep(1500);   // the pad's one-off rest calibration

  const setPad = (o) => page.evaluate((o) => { const p = window.__pad; if (o.axes) p.axes = o.axes; if (o.btn != null) { p.buttons[o.btn].pressed = o.down; p.buttons[o.btn].value = o.down ? 1 : 0; } }, o);
  const tap = async (btn, ms = 120) => { await setPad({ btn, down: true }); await sleep(ms); await setPad({ btn, down: false }); await sleep(150); };
  const heal = () => page.evaluate(() => {
    const T = window.__trollOps;
    if (!document.getElementById("to-pause").hidden) T.closePauseMenu();
    T.player.maxHp = T.player.hp = 1e9;
  });
  await heal();

  // X: reload
  await page.evaluate(() => { const w = window.__trollOps.currentWeapon(); w.ammoInMag = Math.max(1, Math.floor(w.def.mag / 2)); });
  await tap(2);
  const rl = await page.evaluate(() => ({ reloading: !!window.__trollOps.currentWeapon().reloading, ammo: window.__trollOps.currentWeapon().ammoInMag }));
  check("X reloads", rl.reloading, JSON.stringify(rl));
  await sleep(3500); await heal();

  // Y: switch weapon
  const w0 = await page.evaluate(() => window.__trollOps.currentWeapon().def.id);
  await tap(3);
  await sleep(900);
  const w1 = await page.evaluate(() => window.__trollOps.currentWeapon().def.id);
  check("Y switches weapon", w0 !== w1, `${w0} -> ${w1}`);
  await tap(3); await sleep(900);

  // L3: sprint, latched; a full push alone doesn't sprint
  await setPad({ axes: [0, -1, 0, 0] });
  await sleep(700);
  const noL3 = await page.evaluate(() => window.__trollOps.move.sprinting);
  await tap(10);
  await sleep(500);
  const withL3 = await page.evaluate(() => window.__trollOps.move.sprinting);
  await setPad({ axes: [0, 0, 0, 0] });
  await sleep(400);
  await setPad({ axes: [0, -1, 0, 0] });
  await sleep(500);
  const afterStop = await page.evaluate(() => window.__trollOps.move.sprinting);
  await setPad({ axes: [0, 0, 0, 0] });
  check("stick pushed alone: no sprint", noL3 === false, String(noL3));
  check("L3: sprint", withL3 === true, String(withL3));
  check("stopping ends the sprint (L3 again to sprint)", afterStop === false, String(afterStop));
  await heal();

  // R3: melee
  const m0 = await page.evaluate(() => !!window.__trollOps.player.melee?.busy);
  await tap(11);
  await sleep(60);
  const m1 = await page.evaluate(() => !!window.__trollOps.player.melee?.busy);
  check("R3 melees", !m0 && m1, `${m0} -> ${m1}`);
  await sleep(900); await heal();

  // LB tactical, RB lethal
  const cookWith = async (btn, kind) => {
    await page.evaluate((kind) => {
      const T = window.__trollOps;
      T.cancelCook?.();
      T.loadout.throwKind = kind;
      T.player.gear.lethal = kind === "lethal" ? 2 : 0;
      T.player.gear.tactical = kind === "tactical" ? 2 : 0;
    }, kind);
    await setPad({ btn, down: true });
    await sleep(200);
    const c = await page.evaluate(() => { const c = window.__trollOps.cooking; const v = typeof c === "function" ? c() : c; return { slot: v?.slot || null, def: !!v?.def }; });
    await setPad({ btn, down: false });
    await sleep(1200);
    return c;
  };
  const tac = await cookWith(4, "tactical");
  check("LB: tactical", tac.def && tac.slot === "tactical", JSON.stringify(tac));
  const leth = await cookWith(5, "lethal");
  check("RB: lethal", leth.def && leth.slot === "lethal", JSON.stringify(leth));
  const wrong = await cookWith(5, "tactical");
  check("RB with only a tactical: nothing thrown", !wrong.def, JSON.stringify(wrong));
  await heal();

  // D-pad down / up: scroll the ready scorestreaks both ways
  const ids = await page.evaluate(() => {
    const T = window.__trollOps;
    const pick = Object.keys(T.STREAK_DEFS).filter((id) => !T.STREAK_DEFS[id].hidden).slice(0, 3);
    for (const id of pick) T.streaks.grant(id);
    return T.readyStreaksOrdered();
  });
  const sel = () => page.evaluate(() => window.__trollOps.selectedStreak());
  await tap(13); const d1 = await sel();
  await tap(13); const d2 = await sel();
  await tap(12); const u1 = await sel();
  check("three streaks ready", ids.length >= 3, ids.join(","));
  check("d-pad down: next streak", d1 && d2 && d1 !== d2 && ids.indexOf(d2) === (ids.indexOf(d1) + 1) % ids.length, `${d1} -> ${d2}`);
  check("d-pad up: back one", u1 === d1, `${d2} -> ${u1}`);

  // D-pad left: tap inspects, hold opens the emote wheel
  await tap(14, 100);
  await sleep(100);
  const insp = await page.evaluate(() => { const v = window.__trollOps.inspectT?.(); return typeof v === "number" ? v : null; });
  check("d-pad left tapped: inspect", insp != null && insp > 0, String(insp));
  await sleep(2500);
  await setPad({ btn: 14, down: true });
  await sleep(600);
  const wheel = await page.evaluate(() => window.__trollOps.emoteWheel.isOpen);
  await setPad({ btn: 14, down: false });
  await sleep(200);
  check("d-pad left held: emote wheel", wheel === true, String(wheel));
  await page.evaluate(() => window.__trollOps.emoteWheel.close(true));

  check("pad: no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ---- 2. the phone's camera button --------------------------------------
{
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await startTdm(page);
  await sleep(1000);
  const btn = await page.evaluate(() => {
    const b = document.getElementById("to-touch-pov");
    if (!b) return null;
    const r = b.getBoundingClientRect();
    const others = [...document.querySelectorAll("#to-touch .to-touch-btn")].filter((o) => o !== b && o.offsetParent && getComputedStyle(o).display !== "none" && !o.hidden)
      .map((o) => ({ id: o.id, r: o.getBoundingClientRect() }))
      .filter(({ r: q }) => q.width && !(q.right <= r.left || q.left >= r.right || q.bottom <= r.top || q.top >= r.bottom));
    const atCentre = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { shown: !!b.offsetParent && r.width > 20 && r.height > 20, inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
      overlaps: others.map((o) => o.id), onTop: atCentre === b || b.contains(atCentre), text: b.textContent, tp: !!window.__trollOps.settings.thirdPerson };
  });
  check("phone: the camera button is on screen", btn && btn.shown && btn.inView && btn.onTop, JSON.stringify(btn));
  check("phone: clear of the other buttons", btn && btn.overlaps.length === 0, JSON.stringify(btn?.overlaps));
  check("phone: starts in first person, reads 1P", btn && !btn.tp && btn.text === "1P", JSON.stringify(btn));
  const tapPov = () => page.evaluate(() => {
    const el = document.getElementById("to-touch-pov");
    const r = el.getBoundingClientRect();
    const t = new Touch({ identifier: 9, target: el, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
    el.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [t], targetTouches: [t], changedTouches: [t] }));
    el.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [t] }));
    return { tp: !!window.__trollOps.settings.thirdPerson, text: el.textContent, pressed: el.getAttribute("aria-pressed") };
  });
  const s1 = await tapPov();
  check("phone: a tap goes third person, reads 3P", s1.tp && s1.text === "3P" && s1.pressed === "true", JSON.stringify(s1));
  // the hooks' anim-debug panel sits over the right column: out of the shot
  await page.evaluate(() => { for (const el of document.querySelectorAll("body *")) if (el.children.length < 40 && /^s*weapon:/.test(el.textContent || "") && getComputedStyle(el).position === "fixed") el.style.display = "none"; });
  await page.screenshot({ path: path.join(ROOT, ".claude", "run", "bo2pad-phone-3p.png") }).catch(() => {});
  const s2 = await tapPov();
  check("phone: another tap back to first person, reads 1P", !s2.tp && s2.text === "1P" && s2.pressed === "false", JSON.stringify(s2));
  check("phone: no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
