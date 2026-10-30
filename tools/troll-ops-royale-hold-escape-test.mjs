// Troll Royale: nobody leaves the plane before the green (user, 2026-10-29:
// "its possible to jump out the plane before the cinematic animation even
// starts"). Aboard in the countdown, before the drop cinematic, out of the
// hold any way at all (under it, on its roof, past the shut ramp) puts you
// back in it, still aboard; at the green you go out of the back as before.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-royale-hold-escape-test.mjs

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
await page.evaluate(async () => { const T = window.__trollOps; T.DROP.lobbySeconds = 75; T.setMode("royale"); T.els.noBots.checked = true;
  // a private room, never the public one
  T.els.room.value = "RE" + Math.random().toString(36).slice(2, 5).toUpperCase(); T.els.room.dispatchEvent(new Event("input"));
  await T.startGame(); });
await page.waitForFunction(() => window.__trollOps.state() === "playing" && window.__trollOps.royale()?.drop?.hold, null, { timeout: 180000 });
await new Promise((r) => setTimeout(r, 1500));

// out of the hold, before the cinematic: under it (as after slipping out
// through a gap), then up on its roof
const escapes = await page.evaluate(async () => {
  const T = window.__trollOps, r = T.royale(), o = r.drop.origin, out = [];
  for (const [name, dx, dy, dz] of [["below", 0, -4, 2], ["on the roof", 0, 3.8, 0], ["off the shut ramp", 0, 0.2, 9]]) {
    const t = r.planeT;
    T.move.reset(o.x + dx, o.z + dz, o.y + dy);
    await new Promise((res) => setTimeout(res, 700));
    const p = T.move.pos;
    out.push({ name, t: +t.toFixed(1), me: r.me, phase: r.drop.phase, inHold: r.drop.hold.contains(p), dy: +(p.y - o.y).toFixed(2) });
  }
  return out;
});
for (const e of escapes) check(`before the cinematic, ${e.name}: still aboard, back in the hold`, e.t < -42 && e.phase === "lobby" && e.me === "aboard" && e.inHold, JSON.stringify(e));

// at the green you still go out of the back (the jumpmaster's shove or Space)
await page.waitForFunction(() => window.__trollOps.royale().drop.phase === "run", null, { timeout: 240000 });
await page.evaluate(() => { const T = window.__trollOps; T.keys.add("Space"); });
await page.waitForFunction(() => window.__trollOps.royale().me !== "aboard", null, { timeout: 60000 }).catch(() => {});
const gone = await page.evaluate(() => { const T = window.__trollOps; T.keys.delete("Space"); return { me: T.royale().me, phase: T.royale().drop.phase }; });
check("after the green you go out of the plane as before", gone.me === "fall" || gone.me === "glide" || gone.me === "ground", JSON.stringify(gone));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
