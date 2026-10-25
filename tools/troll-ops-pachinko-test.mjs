// Troll Forces: Kabukigrin's pachinko parlour (maps/kabukigrin-street.js,
// modes/social-pachinko.js). Supabase blocked (never a live room).
//   Socialize: the doors' collider is gone and the bounds take in the room;
//   walking west from A Main goes in through the doors and up the step onto
//   the floor (y 0.28); a machine's stool is a seat ("Play pachinko"); sat
//   on it, that machine is ours in play (fast screen, our jackpot banner);
//   up again, walking east goes back out onto A Main; NPCs play machines and
//   one walks in and out of the doors.
//   Versus: the doors stay shut; walking west from A Main stops at the glass.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-pachinko-test.mjs

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
const tagOf = (file, mod) => fs.readFileSync(path.join(G, file), "utf8").match(new RegExp(`"\\./${mod.replace(".", "\\.")}\\?v=([^"]+)"`))[1];
const RP = `/assets/games/troll-ops/modes/social-rp.js?v=${tagOf("modes/social-pachinko.js", "social-rp.js")}`;
const ST = `/assets/games/troll-ops/maps/kabukigrin-street.js?v=${tagOf("maps/kabukigrin.js", "kabukigrin-street.js")}`;

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
    T.setMode(mode); T.loadout.mapId = "kabukigrin";
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
  let maxY = T.move.pos.y;
  for (let i = 0; i < secs * 60; i++) {
    T.move.update(1 / 60, { forward: 1, strafe: 0, yaw, speedMult: 1, sprintMult: 1.35 });
    maxY = Math.max(maxY, T.move.pos.y);
  }
  const p = T.move.pos;
  return { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), maxY: +maxY.toFixed(2) };
}, [x, y, z, fx, fz, secs]);

/* ---- Socialize */
{
  const page = await open("social");
  // out of the club's line (Socialize starts you in it; the door walks you up it)
  await page.evaluate(() => { const C = window.__trollClub; if (C && C.club.phase !== "none") C.leave(); });
  const s = await page.evaluate(() => {
    const T = window.__trollOps;
    return { door: T.move.colliders.some((c) => c.pachinkoDoor), minX: T.move.arena.minX };
  });
  check("social: the doors' collider is gone", !s.door);
  check("social: the bounds take in the room", s.minX <= -35.9, `minX ${s.minX}`);
  const inn = await walk(page, -29.0, 0, -15.25, -1, 0, 3);
  check("social: walk in through the doors onto the floor", inn.x < -32.6 && Math.abs(inn.y - 0.28) < 0.05, JSON.stringify(inn));
  const sat = await page.evaluate(async ([RP, ST]) => {
    const rp = await import(RP), st = await import(ST);
    const seats = rp.rpSeats();
    const i = seats.findIndex((x) => x.kind === "pachinko" && !rp.seatTaken(seats.indexOf(x)));
    const T = window.__trollOps;
    T.move.pos.set(seats[i].x, 0.28, seats[i].z);
    rp.sitDown(i);
    await new Promise((r) => setTimeout(r, 1500));
    const out = { label: seats[i].label, mine: st.PLAY.mine, machine: seats[i].machine, open: st.PLAY.open, others: st.PLAY.others.size,
      seated: rp.seated?.s.kind, npcAtMachines: (T.townNpcs?.()?.sitters() || []).filter((n) => n.x < -32 && n.z > -24.2 && n.z < -6.3).length };
    let banner = 0;
    const prev = st.PLAY.onJackpot;
    st.PLAY.onJackpot = () => { banner++; prev?.(); };
    st.PLAY.jack.delete(out.machine);
    // a hit, forced: the next roll always lands
    const rnd = Math.random;
    Math.random = () => 0;
    await new Promise((r) => setTimeout(r, 500));
    Math.random = rnd;
    out.banner = banner;
    rp.standUp();
    const p = T.move.pos;
    out.stand = [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)];
    return out;
  }, [RP, ST]);
  check("social: a machine's stool reads Play pachinko", sat.label === "Play pachinko");
  check("social: sat at it, the machine is ours in play", sat.seated === "pachinko" && sat.mine === sat.machine, JSON.stringify(sat));
  check("social: a hit shows our jackpot banner", sat.banner >= 1, `banners ${sat.banner}`);
  check("social: NPCs play machines (others in play)", sat.npcAtMachines >= 8 && sat.others >= 8, `npcs ${sat.npcAtMachines}, others ${sat.others}`);
  const back = await page.evaluate(() => window.__trollOps.move.pos.y);
  check("social: up again, on the parlour's floor", Math.abs(back - 0.28) < 0.05, `y ${back}`);
  const out = await walk(page, -32.15, 0.28, -15.25, 1, 0, 3);
  check("social: walk back out onto A Main", out.x > -30.5 && out.y < 0.05, JSON.stringify(out));
  const walkers = await page.evaluate(() => (window.__trollOps.townNpcs?.()?.list || []).filter((n) => n.c.path?.some((p) => p[0] < -32)).length);
  check("social: NPCs walk in and out of the doors", walkers >= 2, `walkers ${walkers}`);
  check("social: no page errors", page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
  await page.context().close();
}

/* ---- versus: shut */
{
  const page = await open("ops");
  const door = await page.evaluate(() => window.__trollOps.move.colliders.some((c) => c.pachinkoDoor));
  check("versus: the doors' collider is there", door);
  const r = await walk(page, -29.0, 0, -15.25, -1, 0, 3);
  check("versus: walking west stops at the doors", r.x > -31.3, JSON.stringify(r));
  const r2 = await walk(page, -29.0, 0, -20.5, -1, 0, 3);
  check("versus: and at the glass", r2.x > -31.3, JSON.stringify(r2));
  check("versus: no page errors", page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
  await page.context().close();
}

await browser.close(); server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
