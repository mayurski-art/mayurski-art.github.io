// Troll Forces: prone (docs/PRONE.md phase 1). Drives core/movement.js's
// MovementController in a blank page with hand-made colliders: a tap of
// crouch crouches and stands, a hold (0.35 s) lies you down from standing,
// crouched or a slide, from prone a tap is a crouch and jump stands; the eye
// eases down and up; the commit (stanceLocked) covers the first 0.25 s;
// standing and crouching up are refused under a low ceiling, lying down
// where a wall crosses the body; noProne (downed) never lies down; the crawl
// speed; the stance's steadiness. The lying pose (character.js prone, on
// the stick rig and a TROLLS body): its hit proxies stay low (a shot a
// metre up passes over, one at the shoulders lands, side-on and head-on),
// the head looks ahead, nothing sinks into the ground, the crawl moves the
// legs. Then in the game, offline (a private
// local match, Supabase blocked, no bots): holding keyboard C, a pad's B
// and the touch crouch button each lie you down, a pad tap only crouches,
// the Ballista's bipod comes down aiming prone and still (the legs swing
// 1.5 rad, kick x0.4, sway x0.1) and folds on the move, off the sights or
// standing, never standing; another player sees you lying down (two tabs in a private room over
// BroadcastChannel, Supabase blocked) and a shot over you misses; and the
// controls diagram's B callout ("Crouch · hold: prone · slide")
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
// the lying pose and its hit proxies, on the stick rig and a TROLLS body (#1718)
const lp = await page.evaluate(async ({ CH, BB }) => {
  const THREE = await import("three");
  const C = await import(CH);
  const B = await import(BB);
  const out = {};
  for (const body of ["stick", "trolls"]) {
    const rig = C.buildHumanoid(new THREE.MeshStandardMaterial());
    if (body === "trolls") await B.wearBlocky(rig, 1718);
    const pose = (prone, moving = false, phase = 0) => {
      for (let i = 0; i < 40; i++) C.poseHumanoid(rig, { phase, moving, lower: prone ? 1 : 0, prone, mps: moving ? 1.14 : 0, speed: 0.3, dt: 1 / 60, hold: "none" });
      rig.root.updateMatrixWorld(true);
    };
    const ray = new THREE.Raycaster();
    // across the body (from its right) and down its line (from ahead), at height y
    const hit = (y, from) => {
      const o = from === "side" ? new THREE.Vector3(5, y, 0.1) : new THREE.Vector3(0, y, -5);
      ray.set(o, from === "side" ? new THREE.Vector3(-1, 0, 0) : new THREE.Vector3(0, 0, 1));
      ray.far = 10;
      return ray.intersectObjects(rig.hitboxMeshes, false).length > 0;
    };
    const span = () => { const b = new THREE.Box3(); for (const m of rig.hitboxMeshes) b.union(new THREE.Box3().setFromObject(m)); return b; };
    // the lowest joint (the hit proxies pad each limb, so they dip a little under it)
    const low = () => { let m = Infinity; const v = new THREE.Vector3(); for (const k of ["elbowL", "elbowR", "wristL", "wristR", "kneeL", "kneeR", "ankleL", "ankleR", "toeL", "toeR", "hips", "chest"]) m = Math.min(m, rig.parts[k].getWorldPosition(v).y); return m; };
    const feet = () => { const a = new THREE.Vector3(), b = new THREE.Vector3(); rig.parts.ankleL.getWorldPosition(a); rig.parts.ankleR.getWorldPosition(b); return [a, b]; };
    const r = {};
    pose(0);
    r.standTop = span().max.y;
    r.standHit = hit(1.1, "side") && hit(1.1, "front");
    pose(1);
    const b = span();
    r.proneTop = b.max.y; r.proneBottom = low(); r.proneBack = b.max.z;
    r.overSide = hit(1.05, "side"); r.overFront = hit(1.05, "front");
    r.lowSide = hit(0.3, "side"); r.lowFront = hit(0.3, "front");
    const head = new THREE.Vector3(); rig.parts.head.getWorldPosition(head);
    r.headY = head.y; r.headZ = head.z;
    // the face looks ahead: the board's normal (its +z, turned PI) points along -z, not down
    const n = new THREE.Vector3(0, 0, 1).transformDirection(rig.parts.head.matrixWorld);
    r.faceDown = n.y;
    const a = feet().map((v) => v.toArray());
    pose(1, true, Math.PI / 2);
    const c = feet().map((v) => v.toArray());
    r.crawlMove = Math.max(Math.hypot(a[0][0] - c[0][0], a[0][2] - c[0][2]), Math.hypot(a[1][0] - c[1][0], a[1][2] - c[1][2]));
    r.crawlBottom = low();
    out[body] = r;
  }
  return out;
}, { CH: urlOf("game.js", "character.js"), BB: urlOf("net/remote-players.js", "blocky-body.js") });
for (const [body, r] of Object.entries(lp)) {
  const f2 = (v) => v.toFixed(2);
  check(`${body}: lying, the hit proxies top out under 1 m (standing ${f2(r.standTop)})`, r.proneTop < 1.0 && r.standTop > 1.4, f2(r.proneTop));
  check(`${body}: a shot at 1.05 m hits standing, passes over lying (side, front)`, r.standHit && !r.overSide && !r.overFront, JSON.stringify([r.standHit, r.overSide, r.overFront]));
  check(`${body}: a shot at 0.3 m lands on the lying body (side, front)`, r.lowSide && r.lowFront, JSON.stringify([r.lowSide, r.lowFront]));
  check(`${body}: lying along the ground behind the eye point`, r.proneBack > 1.0 && Math.abs(r.headZ) < 0.2, `back ${f2(r.proneBack)} head z ${f2(r.headZ)}`);
  check(`${body}: the face looks ahead, not at the ground`, Math.abs(r.faceDown) < 0.45 && r.headY < 0.75, `n.y ${f2(r.faceDown)} head y ${f2(r.headY)}`);
  check(`${body}: no joint goes through the ground (still, crawling)`, r.proneBottom > -0.01 && r.crawlBottom > -0.01, `${f2(r.proneBottom)} ${f2(r.crawlBottom)}`);
  check(`${body}: the crawl moves the legs`, r.crawlMove > 0.08, f2(r.crawlMove));
}

check("no page errors", errors.length === 0, errors.join(" | "));
await page.close();

// ---- in the game: keyboard, pad, touch; the diagram ----------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const game = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
async function match(ctxOpts, withPad, weaponId = null) {
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
  await p.evaluate(async (weaponId) => {
    const T = window.__trollOps;
    T.loadout.mapId = "trollcity";
    if (weaponId) { T.loadout.weaponId = weaponId; T.loadout.attachmentsFor(weaponId).optic = null; T.loadout.attachmentsFor(weaponId).skin = null; }
    T.setMode("tdm");
    if (T.els.noBots) T.els.noBots.checked = true;
    await T.startGame();
  }, weaponId);
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
  // on the game's clock, not the wall's: a slow headless frame rate counts the
  // hold slower (crouchHeldT is game time)
  await down();
  await p.waitForFunction(() => window.__trollOps.move.stance !== "stand", null, { timeout: 3000 }).catch(() => {});
  const early = await p.evaluate(() => window.__trollOps.move.crouchHeldT < 0.3 ? window.__trollOps.move.stance : "late");
  await p.waitForFunction(() => window.__trollOps.move.crouchHeldT >= 0.5 || window.__trollOps.move.stance === "prone", null, { timeout: 5000 }).catch(() => {});
  await sleep(50);
  const late = await p.evaluate(() => window.__trollOps.move.stance);
  const why = await p.evaluate(() => { const m = window.__trollOps.move; return { room: m.bodyRoom(), held: +m.crouchHeldT.toFixed(2), spent: m.crouchSpent, grounded: m.grounded, dive: m.diveT, yaw: +m.yaw.toFixed(2), at: [+m.pos.x.toFixed(1), +m.pos.y.toFixed(2), +m.pos.z.toFixed(1)] }; });
  await up();
  await sleep(250);
  check(`${label}: held, a crouch then prone`, early === "crouch" && late === "prone", `${early} -> ${late}${late === "prone" ? "" : " " + JSON.stringify(why)}`);
}

{
  const { ctx, p, errs } = await match({}, true, "howl");
  await holdTest(p, "keyboard C", () => p.evaluate(() => window.__trollOps.keys.add("KeyC")), () => p.evaluate(() => window.__trollOps.keys.delete("KeyC")));
  if (OUT) await p.screenshot({ path: path.join(OUT, "prone-keyboard.png") });
  await holdTest(p, "pad B", () => setB(p, true), () => setB(p, false));
  // a tap on the pad still only crouches
  await p.evaluate(() => { window.__trollOps.move.stance = "stand"; });
  await sleep(250);
  await setB(p, true); await sleep(120); await setB(p, false); await sleep(500);
  const tapped = await p.evaluate(() => window.__trollOps.move.stance);
  check("pad B tapped only crouches", tapped === "crouch", tapped);
  // and the local body lies down with it (third person, the killcam)
  await p.evaluate(() => { window.__trollOps.move.stance = "prone"; });
  await sleep(900);
  const lk = await p.evaluate(() => window.__trollOps.localRig.proneK);
  check("the local body lies down when prone", lk > 0.95, String(lk));
  await p.evaluate(() => { window.__trollOps.move.stance = "stand"; });

  // ---- the Ballista's bipod
  await p.evaluate(() => window.__trollOps.switchWeapon("primary"));
  await sleep(800);
  const bip = async () => p.evaluate(() => {
    const T = window.__trollOps, m = T.activeWeaponMesh(), u = m.userData, L = u.gunParts?.BipodL;
    return { id: T.currentWeapon().def.id, k: u.bipodK ?? 0, turn: L ? L.node.rotation[L.axis] - L.rot[L.axis] : null, travel: L?.travel, kick: T.currentWeapon().kickSteady ?? 1, stance: T.move.stance };
  });
  const lieDown = async () => { await p.evaluate(() => window.__trollOps.keys.add("KeyC")); await sleep(700); await p.evaluate(() => window.__trollOps.keys.delete("KeyC")); await sleep(500); };
  // standing, aimed: the legs stay up
  await p.evaluate(() => { window.__trollOps.move.stance = "stand"; window.__trollOps.setAds(true); });
  await sleep(700);
  const standing = await bip();
  await p.evaluate(() => window.__trollOps.setAds(false));
  await sleep(400);
  check("the Ballista in hand has its bipod legs", standing.id === "howl" && Math.abs(standing.travel) > 1.2, JSON.stringify(standing));
  check("standing and aimed, the bipod stays folded", standing.k < 0.01, JSON.stringify(standing));
  // prone, still, aimed: down within ~0.3 s of the sights coming up
  await lieDown();
  await p.evaluate(() => window.__trollOps.setAds(true));
  await sleep(650);
  const down = await bip();
  check("prone, still and aimed, the legs swing down", down.k > 0.98 && Math.abs(down.turn - down.travel) < 0.05, JSON.stringify(down));
  check("mounted, the kick is x0.4", Math.abs(down.kick - 0.4) < 0.02, String(down.kick));
  // crawl (the pad's stick: with a pad in, the keyboard doesn't walk): folded
  await p.evaluate(() => { window.__pad.axes = [0, -1, 0, 0]; });
  await sleep(450);
  const crawl = await bip();
  await p.evaluate(() => { window.__pad.axes = [0, 0, 0, 0]; });
  check("crawling folds them", crawl.k < 0.02 && crawl.kick > 0.98, JSON.stringify(crawl));
  // still again: down; off the sights: folded
  await sleep(700);
  const again = await bip();
  await p.evaluate(() => window.__trollOps.setAds(false));
  await sleep(600);
  const off = await bip();
  check("still again they come down, off the sights they fold", again.k > 0.98 && off.k < 0.02, JSON.stringify([again.k, off.k]));
  // standing up folds them too
  await p.evaluate(() => window.__trollOps.setAds(true));
  await sleep(650);
  await p.evaluate(() => { window.__trollOps.keys.add("Space"); });
  await sleep(150);
  await p.evaluate(() => { window.__trollOps.keys.delete("Space"); });
  await sleep(500);
  const up = await bip();
  await p.evaluate(() => window.__trollOps.setAds(false));
  check("standing up folds them", up.stance !== "prone" && up.k < 0.02, JSON.stringify(up));
  // a copy of the gun, legs folded and down, from the side: the legs reach down
  const look = await p.evaluate(async (WMU) => {
    const THREE = await import("three");
    const W = await import(WMU);
    const T = window.__trollOps;
    const GA = await import(WMU.replace(/weapons\/weapon-model\.js.*/, "view/gun-action.js"));
    const gun = W.buildWeaponMesh(T.currentWeapon().def, {});
    for (let i = 0; i < 100 && !gun.userData.gunParts?.BipodL; i++) await new Promise((r) => setTimeout(r, 100));
    const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    r.setSize(900, 420);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x9fb4c8);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2.5));
    const sun = new THREE.DirectionalLight(0xffffff, 2); sun.position.set(3, 6, 4); scene.add(sun);
    scene.add(gun);
    const cam = new THREE.PerspectiveCamera(28, 900 / 420, 0.01, 50); cam.position.set(2.2, 0.0, -0.42); cam.lookAt(0, -0.06, -0.42);
    const out = {};
    for (const [n, want] of [["folded", false], ["down", true]]) {
      for (let i = 0; i < 20; i++) GA.updateBipod(gun, want, 1 / 30);
      gun.updateMatrixWorld(true);
      const b = new THREE.Box3(); for (const k of ["BipodL", "BipodR"]) b.union(new THREE.Box3().setFromObject(gun.userData.gunParts[k].node));
      r.render(scene, cam);
      out[n] = { minY: b.min.y, img: r.domElement.toDataURL("image/png") };
    }
    return out;
  }, urlOf("game.js", "weapon-model.js"));
  if (OUT) for (const n of ["folded", "down"]) fs.writeFileSync(path.join(OUT, `prone-bipod-${n}.png`), Buffer.from(look[n].img.split(",")[1], "base64"));
  check("down, the legs reach well below the gun", look.down.minY < look.folded.minY - 0.12, `${look.folded.minY.toFixed(3)} -> ${look.down.minY.toFixed(3)}`);

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

// ---- another player sees you lie down: two tabs, a private room ----------
{
  const ctx = await game.newContext({ viewport: { width: 640, height: 360 } });
  await ctx.route(/supabase/, (r) => r.abort());   // BroadcastChannel between the tabs
  await ctx.route(/^https:\/\/mayurski-art\.github\.io\/assets\/js\//, (r) => {
    const f = path.join(ROOT, "assets/js", path.basename(new URL(r.request().url()).pathname));
    return fs.existsSync(f) ? r.fulfill({ path: f, contentType: "text/javascript" }) : r.abort();
  });
  const ROOM = "PRONE" + Math.floor(Math.random() * 90 + 10);
  const errs = [];
  const open = async (label) => {
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errs.push(`${label}: ${e.message}`));
    await p.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await p.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
    await p.evaluate(async (room) => {
      const T = window.__trollOps;
      T.loadout.mapId = "trollcity";
      T.setMode("tdm");
      if (T.els.noBots) T.els.noBots.checked = true;
      T.els.room.value = room;
      T.els.room.dispatchEvent(new Event("input"));
      await T.startGame();
    }, ROOM);
    return p;
  };
  const A = await open("A"), B = await open("B");
  await Promise.all([A, B].map((p) => p.waitForFunction(() => { const T = window.__trollOps; return T.state() === "playing" && T.stageT() <= 0; }, null, { timeout: 180000 })));
  const aId = await A.evaluate(() => window.__trollOps.net.id);
  const linked = await B.waitForFunction((id) => !!window.__trollOps.remotes.byId.get(id), aId, { timeout: 30000 }).then(() => true, () => false);
  check("two tabs in a private room see each other", linked);
  // A lies down where it stands, face somewhere open
  await A.evaluate(() => {
    const T = window.__trollOps;
    T.player.maxHp = T.player.hp = 1e9; T.player.spawnGuard = 999;
    for (let i = 0; i < 16 && !T.move.bodyRoom(T.look.yaw); i++) T.look.yaw += Math.PI / 8;
    T.keys.add("KeyC");
  });
  await sleep(700);
  await A.evaluate(() => window.__trollOps.keys.delete("KeyC"));
  await sleep(1500);
  const seen = await B.evaluate(async (id) => {
    const THREE = await import("three");
    const T = window.__trollOps, rp = T.remotes.byId.get(id);
    rp.rig.root.updateMatrixWorld(true);
    const at = rp.rig.root.position;
    const ray = new THREE.Raycaster();
    const shot = (y) => {
      ray.set(new THREE.Vector3(at.x + 6, at.y + y, at.z), new THREE.Vector3(-1, 0, 0));
      ray.far = 12;
      return ray.intersectObjects(rp.targets, false).length > 0 || (ray.set(new THREE.Vector3(at.x, at.y + y, at.z + 6), new THREE.Vector3(0, 0, -1)), ray.intersectObjects(rp.targets, false).length > 0);
    };
    const b = new THREE.Box3(); for (const m of rp.targets) b.union(new THREE.Box3().setFromObject(m));
    return { stance: rp.stance, prone: rp.prone, k: rp.rig.proneK, top: b.max.y - at.y, over: shot(1.05), low: shot(0.3) };
  }, aId);
  check("the other player sees them lying down", seen.stance === "prone" && seen.prone > 0.9 && seen.k > 0.9, JSON.stringify(seen));
  check("their hit proxies top out under 1 m", seen.top < 1.0, seen.top.toFixed(2));
  check("a shot 1.05 m up passes over them, one at 0.3 m lands", !seen.over && seen.low, JSON.stringify([seen.over, seen.low]));
  if (OUT) {
    await B.evaluate((id) => {
      const T = window.__trollOps, rp = T.remotes.byId.get(id), at = rp.rig.root.position;
      T.move.pos.set(at.x + 3, at.y, at.z + 3);
      T.look.yaw = Math.atan2(3, 3); T.look.pitch = -0.25;
    }, aId);
    await sleep(600);
    await B.screenshot({ path: path.join(OUT, "prone-remote.png") });
  }
  check("no page errors (two tabs)", errs.length === 0, errs.join(" | "));
  await ctx.close();
}
await game.close();

await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
