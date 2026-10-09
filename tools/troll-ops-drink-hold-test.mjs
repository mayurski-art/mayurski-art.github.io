// Troll Forces: how bodies hold a drink (saloon-bar.js poseDrinkArm), on the
// Trolling Loud crowd in Socialize. User, 2026-10-08: the NPCs "are holding
// their cups incorrectly".
//
// For every drinking NPC, held still and then forced mid-sip:
// - the mug is in a closed right fist, the handle in the hand and the glass
//   beside it (the mitt doesn't go through the glass)
// - the hand is in front of the body, not out at arm's length
// - at the bar, the mug is over the counter's top edge, not in its face
// - on a sip the rim reaches the grin and the top tips toward the face
// Same pose code drives players' third-person bodies.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-drink-hold-test.mjs [SHOTS=dir]

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
async function pump(page, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) await page.screenshot({ type: "jpeg", quality: 10 }).catch(() => {});
}

const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--enable-unsafe-swiftshader",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
await ctx.route(/supabase/, (r) => r.abort());
const errors = [];
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 420000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 420000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.setLoadWaitMax(8);
  T.setMode("social");
  if (T.els.noBots) T.els.noBots.checked = true;
  T.loadout.mapId = "trollingloud";
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.loadState && !window.__trollOps.loadState().open && window.__trollOps.social().gameState === "playing", null, { timeout: 420000 });
await pump(page, 1500);

// Freeze every drinker at a phase of its sip cycle (town-npcs.js "drink":
// u < 0.08 lifting, 0.08-0.2 at the mouth, past 0.28 resting), pose them
// all at full rate, and measure.
async function measure(u) {
  return page.evaluate((u) => {
    const T = window.__trollOps;
    const N = T.townNpcs();
    const THREE = T.THREE || null;
    const V = (o) => ({ x: o.x, y: o.y, z: o.z });
    const out = [];
    for (const n of N.list) {
      if (n.c.act !== "drink" || !n.drink) continue;
      const cyc = 6 + n.seed * 3;
      n.t = cyc * (Math.floor(n.t / cyc) + u);
      N.pose(n, 0);
      const rig = n.rig, d = n.drink, p = rig.parts;
      rig.root.updateMatrixWorld(true);
      const sc = d.scale.y, h = d.userData.height, r = d.userData.radius;
      const w = (x, y, z) => d.localToWorld(new d.position.constructor(x, y, z));
      const base = w(0, 0, 0), top = w(0, h, 0), mid = w(0, h / 2, 0), grip = w(r + 0.022, h * 0.52, 0);
      const fist = p.handR.getWorldPosition(new d.position.constructor());
      const elbow = p.elbowR.getWorldPosition(new d.position.constructor());
      const chest = p.chest ? p.chest.getWorldPosition(new d.position.constructor()) : p.torso.getWorldPosition(new d.position.constructor());
      const head = p.head.getWorldPosition(new d.position.constructor());
      const k = rig.scale || 1;
      // the grin: a little below the board's middle
      const mouth = head.clone(); mouth.y -= 0.07 * k;
      // the body's forward (yaw convention: 0 faces -z)
      const fwd = { x: -Math.sin(n.yaw), z: -Math.cos(n.yaw) };
      const rel = (a) => ({ f: (a.x - chest.x) * fwd.x + (a.z - chest.z) * fwd.z, s: (a.x - chest.x) * -fwd.z + (a.z - chest.z) * fwd.x, y: a.y - chest.y });
      const up = top.clone().sub(base).normalize();
      const toFace = mouth.clone().sub(mid).normalize();
      const handFist = rig.hands?.R?.pose;
      // the mitt's middle, out past the wrist along the forearm
      const palm = fist.clone().add(fist.clone().sub(elbow).normalize().multiplyScalar(0.075 * k));
      // distance from the palm to the glass's axis (the glass must be beside the hand, not through it)
      const axis = top.clone().sub(base), t2 = Math.max(0, Math.min(1, palm.clone().sub(base).dot(axis) / axis.lengthSq()));
      const onAxis = base.clone().add(axis.multiplyScalar(t2));
      out.push({
        name: n.c.name, stool: !!n.c.stool, sit: !!n.c.sit, x: n.x, z: n.z, k, sc, r,
        fistPose: handFist, gripToPalm: grip.distanceTo(palm), palmToAxis: palm.distanceTo(onAxis),
        hand: rel(palm), rimToMouth: top.distanceTo(mouth), tipToFace: up.dot(toFace),
        rimOff: (() => { const a = rel(top), b = rel(mouth); return { f: a.f - b.f, s: a.s - b.s, y: a.y - b.y }; })(),
        mugMinY: Math.min(base.y, top.y, grip.y) - r * sc, mugX: mid.x, nan: [base, top, fist].some((v) => !Number.isFinite(v.x + v.y + v.z)),
      });
    }
    return out;
  }, u);
}

const rest = await measure(0.5);
const sip = await measure(0.14);
check("there are drinkers", rest.length >= 40, `${rest.length}`);
check("no NaN poses", !rest.some((m) => m.nan) && !sip.some((m) => m.nan));
check("every drinker's right hand is a fist", rest.every((m) => m.fistPose === "fist"), `${rest.filter((m) => m.fistPose !== "fist").map((m) => m.name).join(", ")}`);
const badGrip = rest.filter((m) => m.gripToPalm > 0.05 * m.k);
check("the handle is in the hand", !badGrip.length, badGrip.length ? `${badGrip[0].name} ${badGrip[0].gripToPalm.toFixed(3)} m` : `max ${Math.max(...rest.map((m) => m.gripToPalm)).toFixed(3)} m`);
const through = rest.filter((m) => m.palmToAxis < m.r * m.sc * 0.95);
check("the hand isn't through the glass", !through.length, through.length ? `${through[0].name} ${through[0].palmToAxis.toFixed(3)} < ${(through[0].r * through[0].sc).toFixed(3)}` : "");
const far = rest.filter((m) => m.hand.f < 0.12 || m.hand.f > 0.45 || Math.abs(m.hand.s) > 0.26 * m.k);
check("the mug is held in front of the body, not out to the side", !far.length,
  far.length ? `${far[0].name}: forward ${far[0].hand.f.toFixed(2)} side ${far[0].hand.s.toFixed(2)}` : `forward ${Math.min(...rest.map((m) => m.hand.f)).toFixed(2)}-${Math.max(...rest.map((m) => m.hand.f)).toFixed(2)} m`);
// the main bar's barflies: counter top FL + 1.1 = 1.4, its front edge x ≈ 25.45
const bar = rest.filter((m) => m.stool && Math.abs(m.x - 24.95) < 0.1);
const inBar = bar.filter((m) => m.mugX > 25.4 && m.mugMinY < 1.4);
check("barflies' mugs clear the counter", bar.length > 0 && !inBar.length, inBar.length ? `${inBar[0].name} y ${inBar[0].mugMinY.toFixed(2)} x ${inBar[0].mugX.toFixed(2)}` : `${bar.length} barflies`);
const notMouth = sip.filter((m) => m.rimToMouth > 0.07 * m.k);
check("a sip brings the rim to the grin", !notMouth.length, notMouth.length ? `${notMouth[0].name} ${notMouth[0].rimToMouth.toFixed(3)} m (${notMouth.length})` : `max ${Math.max(...sip.map((m) => m.rimToMouth)).toFixed(3)} m`);
const tipAway = sip.filter((m) => m.tipToFace < 0.15);
check("a sip tips the top toward the face", !tipAway.length, tipAway.length ? `${tipAway[0].name} ${tipAway[0].tipToFace.toFixed(2)}` : "");
check("no page errors", !errors.length, errors.slice(0, 3).join(" | "));

// SHOTS=<dir>: the bar's barflies at rest and mid-sip, side on and from the
// bartender's side, every drinker frozen at the same point of the sip
if (process.env.SHOTS) {
  fs.mkdirSync(process.env.SHOTS, { recursive: true });
  const views = { side: [24.2, 1.6, -6.6, 24.95, 1.45, -4.55, 40], front: [26.9, 1.75, -3.2, 24.95, 1.5, -4.0, 45], booth: [-9.5, 1.6, -7, -13, 1.1, -7, 50] };
  for (const [vn, v] of Object.entries(views)) {
    for (const [un, u] of [["rest", 0.5], ["sip", 0.14]]) {
      const url = await page.evaluate(({ v, u }) => new Promise((done) => requestAnimationFrame(() => {
        const T = window.__trollOps, N = T.townNpcs(), cam = T.camera, C = T.composer;
        for (const n of N.list) if (n.c.act === "drink") { const cyc = 6 + n.seed * 3; n.t = cyc * (Math.floor(n.t / cyc) + u); }
        cam.fov = v[6]; cam.aspect = 1280 / 720; cam.position.set(v[0], v[1], v[2]); cam.lookAt(v[3], v[4], v[5]);
        cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
        N.update(0, cam.position);
        for (const n of N.list) if (n.c.act === "drink") N.pose(n, 0);
        C.render(0.016);
        done(T.renderer.domElement.toDataURL("image/png"));
      })), { v, u });
      fs.writeFileSync(path.join(process.env.SHOTS, `drink-${vn}-${un}.png`), Buffer.from(url.split(",")[1], "base64"));
    }
  }
  console.log(`shots in ${process.env.SHOTS}`);
}
if (process.env.DEBUG) {
  const f = (o) => `f ${o.f.toFixed(2)} s ${o.s.toFixed(2)} y ${o.y.toFixed(2)}`;
  for (const m of [...sip.filter((m) => m.stool).slice(0, 2), ...sip.filter((m) => !m.stool).slice(0, 2)]) console.log(`  sip ${m.name}${m.stool ? " (stool)" : ""}: rim-mouth ${f(m.rimOff)}, hand ${f(m.hand)}`);
  for (const m of rest.slice(0, 2)) console.log(`  rest ${m.name}: hand ${f(m.hand)}`);
  for (const m of sip.filter((m) => m.rimToMouth > 0.07 * m.k)) console.log(`  far ${m.name} k ${m.k.toFixed(2)} sit ${m.sit} stool ${m.stool}: rim-mouth ${f(m.rimOff)}`);
}
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
