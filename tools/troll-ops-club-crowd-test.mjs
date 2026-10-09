// Troll Forces: the Trolling Loud crowd (Socialize only).
//
// Hangs out on Trolling Loud and checks the club's townsfolk (trollingloud.js
// clubNpcs, town-npcs.js): a full house with its staff, everyone inside the
// map, the dancers on the club's beat, no crowd shadows, the bouncers' arms
// folded, and the crowd drawn room by room (from the hall the bar shows and
// the roof doesn't; from the roof, the other way round). A TDM match on the
// same map has no crowd.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-club-crowd-test.mjs

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pump(page, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) await page.screenshot({ type: "jpeg", quality: 10 }).catch(() => {});
}

const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--enable-unsafe-swiftshader",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
await ctx.route(/supabase/, (r) => r.abort());
const errors = [];

async function play(label, mode) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 420000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 420000 });
  await page.evaluate(async (mode) => {
    const T = window.__trollOps;
    T.setLoadWaitMax(8);
    T.setMode(mode);
    if (T.els.noBots) T.els.noBots.checked = true;
    T.loadout.mapId = "trollingloud";
    await T.startGame();
  }, mode);
  await page.waitForFunction(() => window.__trollOps.loadState && !window.__trollOps.loadState().open && window.__trollOps.social().gameState === "playing", null, { timeout: 420000 });
  return page;
}

const A = await play("social", "social");
await pump(A, 1500);

// ── the cast ──────────────────────────────────────────────────────────────
const cast = await A.evaluate(() => {
  const N = window.__trollOps.townNpcs();
  if (!N) return null;
  const B = window.__trollOps.mapBounds?.() || { minX: -36, maxX: 36, minZ: -34, maxZ: 34 };
  const roles = {};
  for (const n of N.list) roles[n.c.role] = (roles[n.c.role] || 0) + 1;
  const out = N.list.filter((n) => n.x < B.minX || n.x > B.maxX || n.z < B.minZ || n.z > B.maxZ).map((n) => n.c.name);
  let shadows = 0;
  for (const n of N.list) n.rig.root.traverse((o) => { if (o.isMesh && o.castShadow) shadows++; });
  // no body clothing (user 2026-10-08: "all clothing except head and facial"):
  // only hats and shades on the face board, on guests, never on staff (outfits.js)
  const GUESTS = ["Clubgoer", "Raver", "VIP", "Barfly"];
  const guests = N.list.filter((n) => GUESTS.includes(n.c.role)), staff = N.list.filter((n) => !GUESTS.includes(n.c.role));
  const clothed = N.list.filter((n) => n.rig.outfit?.some((o) => o.isSkinnedMesh || (o.isMesh && !o.material.map))).map((n) => n.c.name);
  const dressed = guests.filter((n) => n.rig.outfit?.length).length;
  const looks = new Set(guests.map((n) => JSON.stringify(n.c.outfit))).size;
  const staffDressed = staff.filter((n) => n.rig.outfit?.length).map((n) => n.c.name);
  const tinted = N.list.filter((n) => n.rig.parts.head.material.color.getHex() !== 0xffffff).map((n) => n.c.name);
  return { n: N.list.length, roles, out, shadows, guests: guests.length, dressed, looks, staffDressed, tinted, clothed };
});
check("Socialize on Trolling Loud has a crowd", !!cast && cast.n >= 80, cast ? `${cast.n} NPCs` : "no townNpcs");
check("the club has its staff", cast && cast.roles.Bouncer >= 3 && cast.roles.Bartender >= 3 && cast.roles["Go-go dancer"] === 1 && cast.roles.Raver >= 12, JSON.stringify(cast?.roles));
check("everyone is inside the map", cast && cast.out.length === 0, cast?.out.join(", "));
check("the crowd casts no shadows", cast && cast.shadows === 0, `${cast?.shadows} shadow casters`);
check("no one wears body clothing", cast && cast.clothed.length === 0, cast?.clothed.slice(0, 5).join(", "));
check("some guests wear a hat or shades", cast && cast.dressed >= 8, `${cast?.dressed}/${cast?.guests}`);
check("the staff don't", cast && cast.staffDressed.length === 0, cast?.staffDressed.join(", "));
check("no tinted faces", cast && cast.tinted.length === 0, cast?.tinted.join(", "));

// ── the beat ──────────────────────────────────────────────────────────────
const b0 = await A.evaluate(() => ({ beat: window.__trollOps.townNpcs().beat(), t: performance.now() }));
await pump(A, 2000);
const b1 = await A.evaluate(() => ({ beat: window.__trollOps.townNpcs().beat(), t: performance.now() }));
const bps = (b1.beat - b0.beat) / ((b1.t - b0.t) / 1000);
check("the dancers have the club's clock to move on", bps > 0.5 && bps < 4, `${bps.toFixed(2)} beats/s`);

// ── the bouncers' folded arms: both hands in front of the chest, close in ─
const arms = await A.evaluate(() => {
  const T = window.__trollOps, N = T.townNpcs();
  const n = N.list.find((x) => x.c.name === "Big Lulz");
  N.update(0, { x: n.x, y: 1.9, z: n.z + 3 });
  const V = T.camera.position.constructor;
  n.rig.root.updateMatrixWorld(true);
  const chest = n.rig.parts.chest.getWorldPosition(new V());
  const L = n.rig.parts.wristL.getWorldPosition(new V()), R = n.rig.parts.wristR.getWorldPosition(new V());
  // he faces +z (yaw PI): "in front" is +z of the chest
  return { dyL: chest.y - L.y, dyR: chest.y - R.y, fwdL: L.z - chest.z, fwdR: R.z - chest.z, wide: Math.abs(L.x - R.x), headTop: n.rig.parts.head.getWorldPosition(new V()).y };
});
check("the bouncers fold their arms (hands at the chest, in front, close)", arms.dyL > -0.15 && arms.dyL < 0.5 && arms.dyR > -0.15 && arms.dyR < 0.5 && arms.fwdL > 0.05 && arms.fwdR > 0.05 && arms.wide < 0.5, JSON.stringify(arms));

// ── drawn room by room ────────────────────────────────────────────────────
const seen = (eye) => A.evaluate((eye) => {
  const N = window.__trollOps.townNpcs();
  N.update(0, eye);
  const vis = (pred) => N.list.filter(pred).map((n) => n.rig.root.visible);
  const all = (a) => a.length > 0 && a.every(Boolean), none = (a) => a.length > 0 && !a.some(Boolean);
  return {
    dancers: all(vis((n) => n.c.role === "Raver")), dancersHidden: none(vis((n) => n.c.role === "Raver")),
    bar: all(vis((n) => n.c.name === "Shots McGee")), barHidden: none(vis((n) => n.c.name === "Shots McGee")),
    skyBar: all(vis((n) => n.c.name === "Skye")), skyBarHidden: none(vis((n) => n.c.name === "Skye")),
    line: all(vis((n) => n.c.y === 0 && n.z > 22)), lineHidden: none(vis((n) => n.c.y === 0 && n.z > 22)),
    sky: all(vis((n) => n.c.zone === "sky")),
    shown: N.list.filter((n) => n.rig.root.visible).length,
  };
}, eye);
const hall = await seen({ x: 0, y: 1.9, z: 2 });
check("from the dance floor: the dancers, the bar and the roof's strollers show", hall.dancers && hall.bar && hall.sky, JSON.stringify(hall));
check("from the dance floor: the Sky Bar and the line outside don't", hall.skyBarHidden && hall.lineHidden, JSON.stringify(hall));
const roof = await seen({ x: 0, y: 10.6, z: -12 });
check("from the roof: the Sky Bar shows, the dance floor and the main bar don't", roof.skyBar && roof.dancersHidden && roof.barHidden, JSON.stringify(roof));
const street = await seen({ x: 0, y: 1.6, z: 28 });
check("from the street: the line shows, the hall doesn't", street.line && street.dancersHidden, JSON.stringify(street));
check("fewer are drawn than stand in the club", hall.shown < cast.n && roof.shown < cast.n && street.shown < cast.n, `${hall.shown} / ${roof.shown} / ${street.shown} of ${cast.n}`);

// ── TDM on the same map: no crowd ─────────────────────────────────────────
const B = await play("tdm", "tdm");
const tdm = await B.evaluate(() => window.__trollOps.townNpcs());
check("a TDM match on Trolling Loud has no crowd", tdm == null);

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
