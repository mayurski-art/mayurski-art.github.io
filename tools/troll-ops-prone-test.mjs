// Troll Forces: prone (docs/PRONE.md phase 1). Drives core/movement.js's
// MovementController in a blank page with hand-made colliders: a tap of
// crouch crouches and stands, a hold (0.35 s) lies you down from standing,
// crouched or a slide, from prone a tap is a crouch and jump stands; the eye
// eases down and up; the commit (stanceLocked) covers the first 0.25 s;
// standing and crouching up are refused under a low ceiling, lying down
// where a wall crosses the body; noProne (downed) never lies down; the crawl
// speed; the stance's steadiness. Then in the game, offline (a private
// local match, Supabase blocked, no bots): holding keyboard C, a pad's B
// and the touch crouch button each lie you down, a pad tap only crouches,
// and the controls diagram's B callout ("Crouch · hold: prone · slide")
// fits its column. Writes OUT/prone-*.png when OUT is set.
//
// Usage: NODE_PATH=<main checkout>/node_modules OUT=<dir> node tools/troll-ops-prone-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const OUT = process.env.OUT || "";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TF = path.join(ROOT, "assets/games/troll-ops");
const PAGE = `<!doctype html><meta charset="utf-8"><script type="importmap">
{ "imports": { "three": "/assets/vendor/three.module.min.js", "three/addons/": "/assets/vendor/addons/" } }
</script><body>prone test</body>`;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".glb": "model/gltf-binary",
  ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".woff2": "font/woff2", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x").pathname;
  if (u === "/__prone.html") { res.writeHead(200, { "content-type": "text/html" }); return res.end(PAGE); }
  const p = path.join(ROOT, decodeURIComponent(u));
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
// the same module URL the game loads (read from game.js)
const urlOf = (importer, mod) => {
  const src = fs.readFileSync(path.join(TF, importer), "utf8");
  const i = src.indexOf(`/${mod}?v=`);
  if (i < 0) throw new Error(`${importer} doesn't import ${mod}`);
  const start = Math.max(src.lastIndexOf('"', i), src.lastIndexOf("'", i)) + 1;
  const spec = src.slice(start, src.indexOf(src[start - 1], i));
  return new URL(spec, `http://x/assets/games/troll-ops/${importer}`).href.slice("http://x".length);
};
const MOVE = urlOf("game.js", "movement.js");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/__prone.html`);

const r = await page.evaluate(async (MOVE) => {
  const THREE = await import("three");
  const { MovementController, STANCE } = await import(MOVE);
  const box = (x0, y0, z0, x1, y1, z1) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
  const arena = { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };
  const DT = 1 / 60;
  const mk = (colliders = []) => { const m = new MovementController({ colliders, arena }); m.reset(0, 0); return m; };
  const base = { forward: 0, strafe: 0, sprint: false, jump: false, crouch: false, dive: false, yaw: 0, pitch: 0, adsHeld: false };
  const run = (m, s, input = {}) => { for (let t = 0; t < s - 1e-9; t += DT) m.update(DT, { ...base, ...input }); };
  const tap = (m, input = {}) => { run(m, 0.1, { ...input, crouch: true }); run(m, 0.1, input); };
  const out = {};

  // tap: crouch, tap: stand
  let m = mk();
  tap(m); out.tapCrouch = m.stance;
  tap(m); out.tapStand = m.stance;

  // hold from standing: crouch at once, prone at 0.35 s
  m = mk();
  run(m, 0.2, { crouch: true }); out.holdEarly = m.stance;
  run(m, 0.2, { crouch: true }); out.holdLate = m.stance;
  out.lockedAt = m.stanceLocked;
  run(m, 0.3, { crouch: true }); out.lockedAfter = m.stanceLocked;
  run(m, 0.25, { crouch: true }); out.eyeDown = m.eyeHeight;   // ~0.45 s after lying down
  run(m, 1.0, { crouch: true }); out.stillProne = m.stance;    // holding on doesn't stand you up
  run(m, 0.1);

  // crawl speed
  run(m, 1.5, { forward: 1 });
  out.crawl = Math.hypot(m.velocity.x, m.velocity.z);
  run(m, 0.5);

  // from prone: a tap crouches; held, it stays crouched
  run(m, 0.6, { crouch: true }); out.proneHold = m.stance;
  run(m, 0.1);
  // and from crouched, a hold lies you down without standing first
  let stood = false;
  for (let t = 0; t < 0.45; t += DT) { m.update(DT, { ...base, crouch: true }); if (m.stance === STANCE.STAND) stood = true; }
  out.crouchToProne = m.stance; out.stoodOnTheWay = stood;
  run(m, 0.2);
  // jump from prone stands, and the eye comes up in ~0.4 s
  run(m, 0.1, { jump: true }); run(m, 0.05);
  out.jumpStand = m.stance;
  out.lockedUp = m.stanceLocked;
  run(m, 0.3); out.eyeUp = m.eyeHeight;

  // a low ceiling (1.3 m, too thick to vault): prone, then neither jump nor a tap stands you up
  // (starts lying under it: standing inside the box, the wall push shoves you out)
  m = mk([box(-5, 1.3, -5, 5, 3.0, 5)]);
  m.stance = STANCE.PRONE; m.eyeHeight = 0.5;
  run(m, 0.6);
  out.lowProne = m.stance;
  run(m, 0.1, { jump: true }); run(m, 0.3); out.lowJump = m.stance;
  tap(m); out.lowTap = m.stance;              // crouch fits (1.15 m < 1.3)
  tap(m); out.lowTapStand = m.stance;         // standing doesn't
  // lower still (1.0 m): prone stays prone
  m = mk([box(-5, 1.0, -5, 5, 3.0, 5)]);
  m.stance = STANCE.PRONE; m.eyeHeight = 0.5;
  tap(m); out.lowerTap = m.stance;

  // a wall across the body (0.6 m behind, facing -z): no prone
  m = mk([box(-3, 0, 0.6, 3, 2, 0.9)]);
  run(m, 0.6, { crouch: true }); out.wallBehind = m.stance;
  run(m, 0.1);
  // turn to lie along the wall: fits
  run(m, 0.6, { crouch: true, yaw: Math.PI / 2 }); out.wallAlong = m.stance;

  // downed (noProne): held crouch only crouches
  m = mk();
  run(m, 1.0, { crouch: true, noProne: true }); out.downed = m.stance;

  // a slide held into prone
  m = mk();
  run(m, 1.0, { forward: 1, sprint: true });
  run(m, 0.1, { forward: 1, sprint: true, crouch: true }); out.slide = m.stance;
  run(m, 0.3, { forward: 1, sprint: true, crouch: true }); out.slideProne = m.stance;
  return out;
}, MOVE);

// steadiness: the stance table, and the hip cone a WeaponState settles to
const s = await page.evaluate(async ({ MOVE, WPN }) => {
  const { stanceSteady } = await import(MOVE);
  const { WeaponState, WEAPON_DEFS } = await import(WPN);
  const id = Object.keys(WEAPON_DEFS).find((k) => WEAPON_DEFS[k].spreadBase > 0.01);
  const cone = (hipSteady) => {
    const w = new WeaponState(id);
    for (let i = 0; i < 300; i++) w.update(1 / 60, { moving: false, sprinting: false, grounded: true, jumping: false, adsHeld: false, canAds: true, hipSteady });
    return w.spread / w.def.spreadBase;
  };
  return { stand: stanceSteady("stand"), slide: stanceSteady("slide"), crouch: stanceSteady("crouch"), prone: stanceSteady("prone"),
    coneStand: cone(1), coneCrouch: cone(stanceSteady("crouch").spread), coneProne: cone(stanceSteady("prone").spread), id };
}, { MOVE, WPN: urlOf("game.js", "weapons.js") });
const near = (a, b) => Math.abs(a - b) < 0.02;
check("standing and sliding: no steadiness change", s.stand.sway === 1 && s.slide.spread === 1 && s.slide.kick === 1);
check("crouch: sway x0.8, spread x0.85", s.crouch.sway === 0.8 && s.crouch.spread === 0.85 && s.crouch.kick === 1);
check("prone: sway x0.4, kick x0.7, spread x0.6", s.prone.sway === 0.4 && s.prone.kick === 0.7 && s.prone.spread === 0.6);
check("the hip cone settles to the stance's share", near(s.coneStand, 1) && near(s.coneCrouch, 0.85) && near(s.coneProne, 0.6),
  `${s.id}: ${s.coneStand.toFixed(2)} / ${s.coneCrouch.toFixed(2)} / ${s.coneProne.toFixed(2)}`);

check("tap crouch crouches, tap again stands", r.tapCrouch === "crouch" && r.tapStand === "stand", `${r.tapCrouch} -> ${r.tapStand}`);
check("held crouch: crouch at once, prone at 0.35 s", r.holdEarly === "crouch" && r.holdLate === "prone", `${r.holdEarly} -> ${r.holdLate}`);
check("lying down commits 0.25 s (no aim/fire)", r.lockedAt === true && r.lockedAfter === false);
check("the eye eases down to ~0.5 m in about 0.45 s", r.eyeDown < 0.56, r.eyeDown.toFixed(3));
check("holding on stays prone", r.stillProne === "prone");
check("crawl at 22% of the walk", Math.abs(r.crawl - 5.2 * 0.22) < 0.1, r.crawl.toFixed(2));
check("from prone a held crouch is a crouch, not prone again", r.proneHold === "crouch", r.proneHold);
check("from crouched a hold lies down without standing", r.crouchToProne === "prone" && !r.stoodOnTheWay);
check("jump from prone stands, with the commit", r.jumpStand === "stand" && r.lockedUp === true, `${r.jumpStand} ${r.lockedUp}`);
check("the eye comes up to standing in about 0.4 s", r.eyeUp > 1.55, r.eyeUp.toFixed(3));
check("under a 1.3 m ceiling: jump won't stand you", r.lowProne === "prone" && r.lowJump === "prone", `${r.lowProne} ${r.lowJump}`);
check("under a 1.3 m ceiling: a tap crouches, not stands", r.lowTap === "crouch" && r.lowTapStand === "crouch", `${r.lowTap} ${r.lowTapStand}`);
check("under a 1.0 m ceiling prone stays prone", r.lowerTap === "prone", r.lowerTap);
check("a wall across the body refuses prone", r.wallBehind === "crouch", r.wallBehind);
check("lying along the wall fits", r.wallAlong === "prone", r.wallAlong);
check("downed (noProne) only crouches", r.downed === "crouch", r.downed);
check("a slide held lies you down", r.slide === "slide" && r.slideProne === "prone", `${r.slide} -> ${r.slideProne}`);
check("no page errors", errors.length === 0, errors.join(" | "));
await page.close();

// ---- in the game: keyboard, pad, touch; the diagram ----------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const game = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
async function match(ctxOpts, withPad) {
  const ctx = await game.newContext({ viewport: { width: 1280, height: 720 }, ...ctxOpts });
  await ctx.route(/supabase/, (r) => r.abort());
  // troll-ops.html loads these from the live site; serve this checkout's
  await ctx.route(/^https:\/\/mayurski-art\.github\.io\/assets\/js\//, (r) => {
    const f = path.join(ROOT, "assets/js", path.basename(new URL(r.request().url()).pathname));
    return fs.existsSync(f) ? r.fulfill({ path: f, contentType: "text/javascript" }) : r.abort();
  });
  if (withPad) await ctx.addInitScript(() => {
    const btns = () => Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
    const pad = { id: "Xbox 360 Controller (STANDARD GAMEPAD)", index: 0, connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons: btns(), timestamp: 1 };
    window.__pad = pad;
    Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => { pad.timestamp++; return [pad]; } });
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await p.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
  await p.evaluate(async () => {
    const T = window.__trollOps;
    T.loadout.mapId = "trollcity";
    T.setMode("tdm");
    if (T.els.noBots) T.els.noBots.checked = true;
    await T.startGame();
  });
  await p.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 180000 });
  await sleep(3000);
  await p.evaluate(() => {
    const T = window.__trollOps;
    if (T.isStaging()) T.endStaging();
    T.player.maxHp = T.player.hp = 1e9;
    // face somewhere there's room to lie down
    for (let i = 0; i < 16 && !T.move.bodyRoom(T.look.yaw); i++) T.look.yaw += Math.PI / 8;
  });
  await sleep(1500);   // a pad's rest calibration
  return { ctx, p, errs };
}
const setB = (p, down) => p.evaluate((down) => { const b = window.__pad.buttons[1]; b.pressed = b.touched = down; b.value = down ? 1 : 0; }, down);
// stand, hold, read the stance at 0.15 s and 0.65 s, release
async function holdTest(p, label, down, up) {
  await p.evaluate(() => { window.__trollOps.move.stance = "stand"; });
  await sleep(250);
  await down();
  await sleep(150);
  const early = await p.evaluate(() => window.__trollOps.move.stance);
  await sleep(500);
  const late = await p.evaluate(() => window.__trollOps.move.stance);
  await up();
  await sleep(250);
  check(`${label}: held, a crouch then prone`, early === "crouch" && late === "prone", `${early} -> ${late}`);
}

{
  const { ctx, p, errs } = await match({}, true);
  await holdTest(p, "keyboard C", () => p.evaluate(() => window.__trollOps.keys.add("KeyC")), () => p.evaluate(() => window.__trollOps.keys.delete("KeyC")));
  if (OUT) await p.screenshot({ path: path.join(OUT, "prone-keyboard.png") });
  await holdTest(p, "pad B", () => setB(p, true), () => setB(p, false));
  // a tap on the pad still only crouches
  await p.evaluate(() => { window.__trollOps.move.stance = "stand"; });
  await sleep(250);
  await setB(p, true); await sleep(120); await setB(p, false); await sleep(500);
  const tapped = await p.evaluate(() => window.__trollOps.move.stance);
  check("pad B tapped only crouches", tapped === "crouch", tapped);

  // the controls diagram, built at full width: B's callout in its column
  const fit = await p.evaluate(async (CL) => {
    const { ControllerLayout } = await import(CL);
    const host = document.createElement("div");
    host.id = "prone-pad";
    host.style.cssText = "position:fixed;left:0;top:0;width:960px;z-index:99999;background:#111;";
    document.body.appendChild(host);
    const L = new ControllerLayout(host);
    L.setFamily("xbox");
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const svg = host.querySelector("svg").getBoundingClientRect();
    const rects = [...L.callouts].map(([i, c]) => ({ i, text: c.g.querySelector("text").textContent, r: c.g.querySelector("text").getBoundingClientRect() }));
    const b = rects.find((x) => x.i === 1);
    const hit = rects.filter((x) => x !== b && x.r.left < b.r.right && x.r.right > b.r.left && x.r.top < b.r.bottom && x.r.bottom > b.r.top).map((x) => x.text);
    const pad = host.querySelector(".pad-shell").getBoundingClientRect();
    return { text: b.text, inside: b.r.left >= svg.left && b.r.right <= svg.right + 0.5, clearOfPad: b.r.left >= pad.right - 2, hit, w: Math.round(b.r.width) };
  }, urlOf("game.js", "controller-layout.js"));
  check("the diagram's B reads \"Crouch · hold: prone · slide\"", /Crouch · hold: prone · slide/.test(fit.text), fit.text);
  check("B's callout fits its column, clear of the pad and the other labels", fit.inside && fit.clearOfPad && fit.hit.length === 0, JSON.stringify(fit));
  if (OUT) await p.locator("#prone-pad").screenshot({ path: path.join(OUT, "prone-diagram.png") });
  check("no page errors (keyboard, pad)", errs.length === 0, errs.join(" | "));
  await ctx.close();
}
{
  const { ctx, p, errs } = await match({ hasTouch: true });
  const touch = (type) => () => p.evaluate((type) => document.getElementById("to-touch-slide").dispatchEvent(new Event(type, { cancelable: true, bubbles: true })), type);
  await holdTest(p, "touch crouch button", touch("touchstart"), touch("touchend"));
  const aria = await p.evaluate(() => document.getElementById("to-touch-slide").getAttribute("aria-label"));
  check("the touch button says hold to go prone", /hold to go prone/.test(aria), aria);
  check("no page errors (touch)", errs.length === 0, errs.join(" | "));
  await ctx.close();
}
await game.close();

await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
