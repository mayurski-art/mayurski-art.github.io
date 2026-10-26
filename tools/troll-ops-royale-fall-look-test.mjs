// Out of the plane, the fall's opening show hands the camera back looking
// down at Trollface Island, north up (user: "the final orientation actually
// faces the opposite direction basically seeing space"). A look you line up
// yourself during the show stays yours.
//
// Two Royale matches in private rooms (Supabase blocked), each: green light,
// Space, then read the look when the show (FALL_SHOW, 6 s) ends.
//   1. hands off: yaw north, pitched down, and the camera's line through you
//      lands on the ground inside the island
//   2. turned east during the show: the look is left where you put it
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-royale-fall-look-test.mjs
// SHOT=<png> saves the hands-off view as the show hands it back.

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
const round = (o) => JSON.stringify(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "number" ? +v.toFixed(2) : v])));

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const errors = [];

async function jumpAndRead(turn) {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  await page.route(/supabase/, (r) => r.abort());
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
  await page.evaluate(async () => {
    const T = window.__trollOps;
    T.DROP.lobbySeconds = 14;
    T.setMode("royale");
    T.els.noBots.checked = false;
    // a private room, never the public one
    T.els.room.value = "FL" + Math.random().toString(36).slice(2, 5).toUpperCase();
    T.els.room.dispatchEvent(new Event("input"));
    await T.startGame();
  });
  await page.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 120000 });
  await page.waitForFunction(() => window.__trollOps.royale().drop.phase === "run", null, { timeout: 180000 });
  const out = await page.evaluate(async (turn) => {
    const T = window.__trollOps, r = T.royale();
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    let t0 = r.planeT;
    while (r.me === "aboard" && r.planeT - t0 < 10) { T.keys.add("Space"); await wait(120); T.keys.delete("Space"); await wait(120); }
    if (r.me !== "fall") return { me: r.me };
    t0 = r.planeT;
    if (turn) { await wait(1500); T.look.yaw = -Math.PI / 2; T.look.pitch = -0.2; }   // east, nearly level
    while (r.planeT - t0 < 6.4 && r.me === "fall") await wait(50);
    const p = T.move.pos, c = r.drop.centre, yaw = T.look.yaw, pitch = T.look.pitch, cp = Math.cos(pitch);
    const dir = { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp };
    const k = dir.y < 0 ? p.y / -dir.y : 1e6;
    return { me: r.me, showT: r.planeT - t0, yaw: Math.atan2(Math.sin(yaw), Math.cos(yaw)), pitch, alt: p.y,
      ahead: p.z - c.z, fromMiddle: Math.hypot(p.x + dir.x * k - c.x, p.z + dir.z * k - c.z) };
  }, turn);
  if (process.env.SHOT && !turn) { await page.waitForTimeout(400); await page.screenshot({ path: process.env.SHOT }); }
  await page.close();
  return out;
}

const a = await jumpAndRead(false);
check("out of the plane and through the show", a.me === "fall" && a.showT >= 6, round(a));
check("hands off: the look comes back facing north", Math.abs(a.yaw) < 0.05, round(a));
check("...pitched down, the camera's line landing inside the island", a.pitch < -0.55 && a.fromMiddle < 200, round(a));
const b = await jumpAndRead(true);
check("turned east during the show: the look stays yours", b.me === "fall" && Math.abs(b.yaw + Math.PI / 2) < 0.05 && Math.abs(b.pitch + 0.2) < 0.05, round(b));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
