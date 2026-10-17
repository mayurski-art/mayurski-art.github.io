// Troll Royale's sky lobby holds until the room's countdown hits 0 (user,
// 2026-10-16: "i was able to exit out of the plane before the countdown hit
// 0 ... i wasnt able to see the hanger be lowered"). A player already in a
// match tells a newcomer the room's map in a "stage" note addressed to them,
// at left 0; that note used to end the newcomer's countdown, so the green
// came early. Now only a note to the whole room (the countdown) ends it.
//
// One tab in a private room (Supabase blocked: never a public room), the
// notes fed straight into the net handler.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-royale-stage-note-test.mjs

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
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
const ROOM = "RSN" + Math.floor(Math.random() * 900 + 100);
await page.evaluate(async (room) => {
  const T = window.__trollOps;
  T.DROP.lobbySeconds = 60;
  T.setMode("royale");
  T.els.noBots.checked = true;
  T.els.room.value = room;
  T.els.room.dispatchEvent(new Event("input"));
  await T.startGame();
}, ROOM);
await page.waitForFunction(() => window.__trollOps.state() === "playing" && window.__trollOps.royale()?.drop?.phase === "lobby" && window.__trollOps.isStaging(), null, { timeout: 120000 });
await new Promise((r) => setTimeout(r, 1500));

const state = () => page.evaluate(() => {
  const T = window.__trollOps, d = T.royale().drop;
  return { phase: d.phase, staging: T.isStaging(), left: +T.stageT().toFixed(1), me: T.royale().me };
});
const note = (to) => page.evaluate((to) => {
  const T = window.__trollOps, n = T.net;
  n.h.onStage({ t: "stage", id: "zz-peer", ...(to ? { to: n.id } : {}), map: T.loadedMapId(), mode: T.modeId(), left: 0 });
}, to);

let s = await state();
check("aboard in the sky lobby, the countdown running", s.phase === "lobby" && s.staging && s.left > 20, JSON.stringify(s));
await note(true);
await new Promise((r) => setTimeout(r, 600));
s = await state();
check("a room-map note to us at 0 leaves the ramp shut and the countdown running", s.phase === "lobby" && s.staging && s.left > 15 && s.me === "aboard", JSON.stringify(s));
await note(false);
await new Promise((r) => setTimeout(r, 600));
s = await state();
check("the room's own countdown at 0 still gives the green", s.phase !== "lobby" && !s.staging, JSON.stringify(s));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
