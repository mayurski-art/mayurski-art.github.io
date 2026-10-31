// Troll Forces: prone (docs/PRONE.md phase 1). Drives core/movement.js's
// MovementController in a blank page with hand-made colliders: a tap of
// crouch crouches and stands, a hold (0.35 s) lies you down from standing,
// crouched or a slide, from prone a tap is a crouch and jump stands; the eye
// eases down and up; the commit (stanceLocked) covers the first 0.25 s;
// standing and crouching up are refused under a low ceiling, lying down
// where a wall crosses the body; noProne (downed) never lies down; the crawl
// speed. Offline: no game page, no Supabase, no rooms.
//
// Usage: node tools/troll-ops-prone-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TF = path.join(ROOT, "assets/games/troll-ops");
const PAGE = `<!doctype html><meta charset="utf-8"><script type="importmap">
{ "imports": { "three": "/assets/vendor/three.module.min.js", "three/addons/": "/assets/vendor/addons/" } }
</script><body>prone test</body>`;
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x").pathname;
  if (u === "/__prone.html") { res.writeHead(200, { "content-type": "text/html" }); return res.end(PAGE); }
  const p = path.join(ROOT, decodeURIComponent(u));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": p.endsWith(".js") || p.endsWith(".mjs") ? "text/javascript" : "application/octet-stream" });
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

await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
