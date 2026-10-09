// Troll Forces: Trolling Loud's kitchen (trollingloud-kitchen.js, the
// swing doors in view/swing-doors.js, the staff's acts in town-npcs.js).
//
// Socialize on Trolling Loud as the owner (troll_runner: the owner band lets
// you into the back of house), Supabase blocked:
//   1. The map still makes at most 14 lights, and the count never changes;
//      the backstage light hops into the kitchen while you're in it and back.
//   2. Walking in from the bar through the swing doors opens them (away from
//      you), they spring shut after; the same through the hall's doors.
//   3. A runner walking his path opens the bar's doors by himself.
//   4. The kitchen staff are there (seven), posed with nothing NaN, their
//      tools in hand; the runners move.
//   5. The line, the pass and the dish pit are solid; the doorways, the yard
//      door and the walk to the yard stay open.
//   6. No page errors.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-kitchen-test.mjs

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
const SHOTS = path.join(ROOT, "tools", ".kitchen-shots");
fs.mkdirSync(SHOTS, { recursive: true });

let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };
async function pump(page, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) await page.screenshot({ type: "jpeg", quality: 10 }).catch(() => {});
}

const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
await ctx.route(/supabase/, (r) => r.abort());
const errors = [];
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  const f = { getCachedProfile: () => ({ username: "troll_runner", tags: [] }) };
  Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => f, set: () => {} });
});
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 420000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 420000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.setLoadWaitMax(8);
  T.setMode("social");
  T.loadout.mapId = "trollingloud";
  await T.startGame();
});
await page.waitForFunction(() => !window.__trollOps.loadState().open && window.__trollOps.social().gameState === "playing", null, { timeout: 420000 });
await pump(page, 2500);

const put = (x, z, yaw, pitch = 0) => page.evaluate(({ x, z, yaw, pitch }) => {
  const T = window.__trollOps; T.els.pause.hidden = true; T.move.reset(x, z, 0.3); T.look.yaw = yaw; T.look.pitch = pitch;
}, { x, z, yaw, pitch });
const doors = () => page.evaluate(() => Object.fromEntries(window.__trollOps.builtMap().map.doors().map((d) => [d.id, +d.ang.toFixed(3)])));
const lights = () => page.evaluate(() => { let n = 0; window.__trollOps.scene.traverse((o) => { if (o.isPointLight || o.isSpotLight) n++; }); return n; });
const backLight = () => page.evaluate(() => {
  let best = null;
  window.__trollOps.scene.traverse((o) => { if (o.isPointLight && Math.abs(o.position.y - 3.5) < 0.2 && ((Math.abs(o.position.x) < 0.1 && Math.abs(o.position.z + 19.5) < 0.1) || (Math.abs(o.position.x - 21.5) < 0.1))) best = { x: +o.position.x.toFixed(2), z: +o.position.z.toFixed(2) }; });
  return best;
});

// ── 1. Lights ────────────────────────────────────────────────────────────
const n0 = await lights();
const dbg = await page.evaluate(() => window.__trollOps.builtMap().map.debug().lights);
check("the club makes at most 14 lights", dbg > 0 && dbg <= 14, `${dbg}`);
await put(0, -19.5, 0); await pump(page, 600);
const lb = await backLight();
await put(21, -12.5, 0); await pump(page, 600);
const lk = await backLight();
check("the backstage light hops into the kitchen with you", lb?.x === 0 && lk?.x === 21.5, JSON.stringify({ backstage: lb, kitchen: lk }));
await page.screenshot({ path: path.join(SHOTS, "k-room.png") });

// ── 2. Through the bar's doors, and the hall's ───────────────────────────
// park the runners well away first, so only we open them
await page.evaluate(() => { for (const n of window.__trollOps.townNpcs().list) if (n.c.act === "carry") { n.wait = 999; n.x = 40; n.z = 40; } });
let d = await doors();
for (let i = 0; i < 20 && (d.bar || d.hall); i++) { await pump(page, 300); d = await doors(); }
check("both kitchen doorways have leaves, shut", d.bar === 0 && d.hall === 0, JSON.stringify(d));
await put(22, -5.5, 0);     // in the bar, facing the door (north, -z)
await pump(page, 300);
await page.keyboard.down("w");
let openBar = 0, side = 0;
for (let i = 0; i < 24; i++) {
  await pump(page, 150);
  const a = (await doors()).bar;
  if (Math.abs(a) > Math.abs(openBar)) openBar = a;
  if (i === 6) await page.screenshot({ path: path.join(SHOTS, "k-door-open.png") });
  const z = await page.evaluate(() => window.__trollOps.move.pos.z);
  if (z < -11.5) break;
}
await page.keyboard.up("w");
const zIn = await page.evaluate(() => window.__trollOps.move.pos.z);
check("walking in from the bar: the doors swing open (into the kitchen) and let you through", openBar < -1.2 && zIn < -10, JSON.stringify({ openBar, zIn: +zIn.toFixed(2) }));
await put(18, -16, 0); await pump(page, 3500);
d = await doors();
check("and spring shut behind you", Math.abs(d.bar) < 0.05, JSON.stringify(d));
// out through the hall's doors (west, -x)
await put(16.5, -12, Math.PI / 2);
await pump(page, 300);
await page.keyboard.down("w");
let openHall = 0;
for (let i = 0; i < 24; i++) {
  await pump(page, 150);
  const a = (await doors()).hall;
  if (Math.abs(a) > Math.abs(openHall)) openHall = a;
  const x = await page.evaluate(() => window.__trollOps.move.pos.x);
  if (x < 12) break;
}
await page.keyboard.up("w");
const xOut = await page.evaluate(() => window.__trollOps.move.pos.x);
check("out through the hall's doors: open (away from you, into the hall), through", openHall < -1.2 && xOut < 13, JSON.stringify({ openHall, xOut: +xOut.toFixed(2) }));
await put(4, -12, 0); await pump(page, 3500);
check("and shut again", Math.abs((await doors()).hall) < 0.05);

// ── 3. A runner opens them himself ───────────────────────────────────────
await put(30.5, 4, 0);   // out of the way, in the bar
await page.evaluate(() => { const N = window.__trollOps.townNpcs(); const r = N.list.find((n) => n.c.name === "Skillet"); r.wait = 0; r.seg = 1; r.segT = 0; r.dir = 1; r.x = 22; r.z = -10.5; });
let runnerOpen = 0;
for (let i = 0; i < 20; i++) { await pump(page, 150); const a = (await doors()).bar; if (Math.abs(a) > Math.abs(runnerOpen)) runnerOpen = a; }
check("a runner carrying a tray opens the bar's doors by himself (outward)", runnerOpen > 1.2, String(runnerOpen));

// ── 4. The staff ─────────────────────────────────────────────────────────
const staff = await page.evaluate(() => {
  const N = window.__trollOps.townNpcs();
  const acts = new Set(["cook", "chop", "wash", "expo", "carry"]);
  return N.list.filter((n) => acts.has(n.c.act)).map((n) => {
    n.rig.root.updateMatrixWorld(true);
    const v = n.rig.parts.handR.getWorldPosition(n.rig.root.position.clone());
    return { name: n.c.name, act: n.c.act, x: +n.x.toFixed(2), z: +n.z.toFixed(2), hand: [v.x, v.y, v.z].map((q) => +q.toFixed(2)), prop: !!n.prop, ok: [v.x, v.y, v.z, n.x, n.z].every(Number.isFinite) };
  });
});
check("seven kitchen staff: two cooks, a sous, a dishwasher, the expo, two runners", staff.length === 7 && ["cook", "cook", "chop", "wash", "expo", "carry", "carry"].every((a, i, all) => staff.filter((s) => s.act === a).length === all.filter((b) => b === a).length), staff.map((s) => `${s.name}:${s.act}`).join(" "));
check("nothing NaN in their poses", staff.every((s) => s.ok), JSON.stringify(staff.filter((s) => !s.ok)));
check("tools in hand: spatulas, a knife, trays", staff.filter((s) => s.prop).length === 5, staff.filter((s) => s.prop).map((s) => s.name).join(", "));
const cookHand = staff.find((s) => s.name === "Chef Lolz");
check("Chef Lolz's hand is over the range", cookHand && cookHand.hand[2] < -20.4 && cookHand.hand[1] > 1.0 && cookHand.hand[1] < 1.7, JSON.stringify(cookHand));
const r0 = await page.evaluate(() => window.__trollOps.townNpcs().list.filter((n) => n.c.act === "carry").map((n) => { n.wait = 0; return [n.x, n.z]; }));
await put(21, -12.5, 0);
let r1 = r0;
const far = () => r0.every((p, i) => Math.hypot(p[0] - r1[i][0], p[1] - r1[i][1]) > 1);
for (let i = 0; i < 16 && !far(); i++) {   // (one may be standing at the end of his path a moment)
  await pump(page, 500);
  r1 = await page.evaluate(() => window.__trollOps.townNpcs().list.filter((n) => n.c.act === "carry").map((n) => [n.x, n.z]));
}
check("the runners walk their paths", far(), JSON.stringify({ r0, r1 }));
await put(22.5, -12.2, 0.4, -0.15); await pump(page, 800);
await page.screenshot({ path: path.join(SHOTS, "k-staff.png") });

// ── 5. Solid where it should be, open where you walk ─────────────────────
const solid = await page.evaluate(() => {
  const T = window.__trollOps, M = T.move;
  // walk a line with the controller: how far does it get?
  const walk = (x, z, yaw, n) => {
    M.reset(x, z, 0.3); M.velocity.set(0, 0, 0);
    for (let i = 0; i < n; i++) M.update(1 / 60, { forward: 1, strafe: 0, jump: false, crouch: false, dive: false, speedMult: 1, sprintMult: 1.35, yaw, pitch: 0 });
    return [+M.pos.x.toFixed(2), +M.pos.z.toFixed(2)];
  };
  return {
    line: walk(17.6, -19.5, 0, 90),           // north into the range
    pass: walk(25.4, -11.5, Math.PI, 90),     // south into the pass
    dish: walk(16.2, -15.8, Math.PI / 2, 90), // west into the dish pit
    yardLane: walk(22, -17, 0, 200),          // from behind the island, north out the yard door
    hatch: walk(25.2, -7.5, 0, 90),           // from the bar into the hatch
  };
});
check("the line stops you at its front (z > -20.95)", solid.line[1] > -20.95 - 0.05, JSON.stringify(solid.line));
check("the pass stops you (z < -9.85)", solid.pass[1] < -9.85 + 0.05, JSON.stringify(solid.pass));
check("the dish pit stops you (x > 14.9)", solid.dish[0] > 14.9 - 0.05, JSON.stringify(solid.dish));
check("behind the island, the way north out the yard door is clear", solid.yardLane[1] < -22.5, JSON.stringify(solid.yardLane));
check("nobody climbs through the hatch from the bar", solid.hatch[1] > -9.2, JSON.stringify(solid.hatch));
check("the light count never changed", (await lights()) === n0, `${n0}`);

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(failures ? `${failures} failed` : "all passed");
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
