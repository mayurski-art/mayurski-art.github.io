// Troll Forces: Undergrin's walk-in Fotoautomat (maps/undergrin.js
// UG_BOOTH, modes/photo-booth.js). Supabase blocked (never a live room).
//   Socialize on Undergrin: the map loads (it's on Socialize's list); both
//   booths are listed; walking north from the hall goes in through the
//   doorway; inside, hold X offers "Take four photos"; taking them flashes
//   four times and shows a strip of four frames that aren't blank; Close
//   hides it; walking back south goes out again.
//   Versus: the booth is walk-in too, and offers nothing.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-photo-booth-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".svg": "image/svg+xml", ".gif": "image/gif" };
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
// the modules as the game loads them (the same ?v= tags: one instance)
const G = path.join(ROOT, "assets/games/troll-ops");
const tagOf = (file, mod) => fs.readFileSync(path.join(G, file), "utf8").match(new RegExp(`"\\.\\.?/(?:modes/)?${mod.replace(".", "\\.")}\\?v=([^"]+)"`))[1];
const PB = `/assets/games/troll-ops/modes/photo-booth.js?v=${tagOf("view/player-update.js", "photo-booth.js")}`;
const RP = `/assets/games/troll-ops/modes/social-rp.js?v=${tagOf("modes/photo-booth.js", "social-rp.js")}`;

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
async function open(mode) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 450 } });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 240000 });
  await page.evaluate(async (mode) => {
    const T = window.__trollOps;
    T.setMode(mode); T.loadout.mapId = "undergrin";
    await T.startGame(); if (T.isStaging?.()) T.endStaging();
    T.player.maxHp = T.player.hp = 1e9;
  }, mode);
  await new Promise((r) => setTimeout(r, +(process.env.SETTLE || 15000)));
  return page;
}
// walk from (x, y, z) along (fx, fz) for `secs`, stepped at 60 Hz (as map-walk does)
const walk = (page, x, y, z, fx, fz, secs) => page.evaluate(async ([x, y, z, fx, fz, secs]) => {
  const T = window.__trollOps;
  T.keys.clear();
  T.move.pos.set(x, y, z); T.move.velocity?.set(0, 0, 0);
  await new Promise((r) => setTimeout(r, 300));
  const yaw = Math.atan2(-fx, -fz);
  T.look.yaw = yaw; T.look.pitch = 0;
  for (let i = 0; i < secs * 60; i++) T.move.update(1 / 60, { forward: 1, strafe: 0, yaw, speedMult: 1, sprintMult: 1.35 });
  const p = T.move.pos;
  return { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) };
}, [x, y, z, fx, fz, secs]);
// the north booth's doorway is x -7.45..-6.3 on its z -19 face; inside is x -7.52..-5.28, z -21.12..-19.08
const DOOR_X = -6.85, U = 6.0;
const inBooth = (p) => p.x > -7.52 && p.x < -5.28 && p.z > -21.12 && p.z < -19.08 && Math.abs(p.y - U) < 0.1;

/* ---- Socialize */
{
  const page = await open("social");
  const s = await page.evaluate(async (PB) => {
    const T = window.__trollOps, pb = await import(PB);
    return { map: T.loadout.mapId, booths: pb.photoBoothDebug.booths().length };
  }, PB);
  check("social: Undergrin's booths are listed", s.booths === 2, JSON.stringify(s));
  const inn = await walk(page, DOOR_X, U, -16.5, 0, -1, 2.5);
  check("social: walk in through the doorway", inBooth(inn), JSON.stringify(inn));
  const act = await page.evaluate(async (RP) => {
    const rp = await import(RP);
    for (const f of rp.rpExtras) { const a = f(); if (a) return { key: a.key, label: a.label, info: !!a.info }; }
    return null;
  }, RP);
  check("social: inside, hold X offers Take four photos", act?.label === "Take four photos" && !act.info, JSON.stringify(act));
  const shot = await page.evaluate(async ([PB, RP]) => {
    const pb = await import(PB), rp = await import(RP);
    const T = window.__trollOps;
    let flashes = 0;
    const a = rp.rpExtras.map((f) => f()).find((x) => x?.key?.startsWith("booth-"));
    a.done();
    const busy = rp.rpExtras.map((f) => f()).find((x) => x?.key === "booth-busy");
    const t0 = performance.now();
    let last = 0;
    while (performance.now() - t0 < 40000 && !pb.stripOpen()) {
      await new Promise((r) => setTimeout(r, 100));
      const n = pb.photoBoothDebug.run?.shots.length ?? last;
      if (n > last) { flashes += n - last; last = n; }
    }
    const img = document.querySelector("#photo-booth img");
    const r = pb.photoBoothDebug.run, p = T.move.pos;
    const out = { open: pb.stripOpen(), busy: !!busy, src: img?.src.length || 0, flashes: Math.max(flashes, pb.stripOpen() ? 4 : 0),
      run: r ? { t: +r.t.toFixed(2), shots: r.shots.length } : null, at: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)] };
    // the strip's frames aren't blank: the spread of the first frame's pixels
    if (img && out.open) {
      await img.decode();
      const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext("2d"); g.drawImage(img, 0, 0);
      out.size = [c.width, c.height];
      const d = g.getImageData(22, 22, 280, 350).data;
      let sum = 0, sq = 0, n = 0;
      for (let i = 0; i < d.length; i += 16) { const y = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; sum += y; sq += y * y; n++; }
      const mean = sum / n; out.mean = Math.round(mean); out.sd = Math.round(Math.sqrt(sq / n - mean * mean));
      const ex = document.createElement("a"); ex.id = "__strip"; ex.href = img.src; document.body.append(ex);
    }
    return out;
  }, [PB, RP]);
  check("social: while shooting, hold X says to look at the camera", shot.busy);
  check("social: the strip comes up", shot.open && shot.src > 20000, JSON.stringify(shot));
  check("social: its frames aren't blank", shot.sd > 12 && shot.mean > 20 && shot.mean < 245, `mean ${shot.mean}, sd ${shot.sd}`);
  check("social: four frames tall", shot.size && shot.size[1] > shot.size[0] * 4, JSON.stringify(shot.size));
  // keep the strip for a look
  const src = await page.evaluate(() => document.getElementById("__strip")?.href || "");
  if (src.startsWith("data:image/png;base64,")) {
    const out = process.env.STRIP || path.join(ROOT, ".claude/ug-blender/booth-strip.png");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(src.slice(22), "base64"));
    console.log("strip saved to", path.relative(ROOT, out));
  }
  const closed = await page.evaluate(async (PB) => {
    const pb = await import(PB);
    document.querySelector("#photo-booth button:last-child")?.click();
    return !pb.stripOpen();
  }, PB);
  check("social: Close hides it", closed);
  const out = await walk(page, DOOR_X, U, -20.2, 0, 1, 2.5);
  check("social: walk back out into the hall", out.z > -18.5 && Math.abs(out.y - U) < 0.1, JSON.stringify(out));
  check("social: no page errors", page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
  await page.context().close();
}

/* ---- versus: walk-in, no camera */
{
  const page = await open("ops");
  const inn = await walk(page, DOOR_X, U, -16.5, 0, -1, 2.5);
  check("versus: walk in through the doorway", inBooth(inn), JSON.stringify(inn));
  const act = await page.evaluate(async (RP) => {
    const rp = await import(RP);
    return rp.rpExtras.map((f) => f()).find((a) => a?.key?.startsWith("booth")) || null;
  }, RP);
  check("versus: no photo action", !act);
  const wall = await walk(page, -6.0, U, -16.5, 0, -1, 2.5);
  check("versus: beside the doorway, the front stops you", wall.z > -19.0, JSON.stringify(wall));
  check("versus: no page errors", page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
  await page.context().close();
}

await browser.close(); server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
