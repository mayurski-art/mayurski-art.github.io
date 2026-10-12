// The TROLLS #1718 body cosmetic (blocky-body.js wearBlocky, cosmetics.js
// "Body") in a real match, offline (Supabase blocked, so no room):
//   - locked when signed out, wearable as troll_runner (the profile stubbed);
//   - your own rig wears it, and takes it off for the stick;
//   - a remote player wears it only with the owner flag (`bk` + `ow`);
//   - a bot running and shooting in it: the torso upright over the legs and
//     the feet passing under the body (user: "why are the legs so angled
//     like that"), shots of it from the side;
//   - its hit capsules follow its shorter limbs; no page errors.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-blocky-ingame.mjs
// Writes .claude/blocky-shots/ingame-*.png.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, ".claude", "blocky-shots");
fs.mkdirSync(OUT, { recursive: true });
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
const BASE = `http://localhost:${server.address().port}`;

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps && !!document.querySelector('#to-cos-body [data-body="trolls-1718"]'), null, { timeout: 90000 });

// --- the lock
const card = '#to-cos-body [data-body="trolls-1718"]';
const lockedOut = await page.$eval(card, (b) => b.getAttribute("aria-disabled"));
check("signed out: TROLLS #1718 is locked", lockedOut === "true");
await page.$eval(card, (b) => b.click());
await wait(300);
check("signed out: picking it does nothing", await page.$eval(card, (b) => b.getAttribute("aria-checked")) === "false");
await page.evaluate(() => {
  const A = (window.TrollrunnerAccounts ||= {});
  A.getCachedProfile = () => ({ username: "troll_runner" });
  window.dispatchEvent(new Event("trollrunner:auth-changed"));
});
await wait(300);
check("troll_runner: unlocked", await page.$eval(card, (b) => b.getAttribute("aria-disabled")) === "false");
await page.$eval(card, (b) => b.click());
await wait(300);
check("troll_runner: picked and saved", await page.evaluate(() => JSON.parse(localStorage.getItem("trollops:cosmetics") || "{}").body) === "trolls-1718");

// --- a match
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.setMode("tdm");
  T.loadout.mapId = "trollingloud";
  await T.startGame();
  if (T.isStaging()) T.endStaging();
});
await page.waitForFunction(() => window.__trollOps.bots.bots.length > 0, null, { timeout: 60000 });
await page.waitForFunction(() => !!window.__trollOps.localRig.blocky, null, { timeout: 20000 }).catch(() => {});
const mine = await page.evaluate(async () => {
  const T = window.__trollOps, r = T.localRig;
  await r.blocky?.ready;
  return { on: !!r.blocky, legs: r.legScale, build: r.build, stickHidden: !r.parts.body.visible };
});
check("your own body wears it in the match", mine.on && mine.legs === 0.67 && mine.build === 0.25 && mine.stickHidden, JSON.stringify(mine));

// --- remote players: only with the owner flag. Bots carry none, so the
// flags are set on their peers the way net.js fills them in from `bk` / `ow`.
await page.evaluate(() => {
  const T = window.__trollOps;
  const bs = T.bots.bots.filter((b) => b.alive).slice(0, 3);
  window.__bk = bs.map((b) => b.id ?? b.netId);
  bs.forEach((b) => { b.hero = null; b.body = null; });
});
await wait(1500);
const remoteState = await page.evaluate(async () => {
  const T = window.__trollOps;
  const rps = [...T.remotes.byId.values()].slice(0, 2);
  // one claims the body without the owner flag, one with it
  const [a, b] = rps;
  const set = () => { a.peer.look = 1; a.peer.owner = false; b.peer.look = 1; b.peer.owner = true; };
  set();
  const iv = setInterval(set, 16);
  await new Promise((r) => setTimeout(r, 1200));
  await b.rig.blocky?.ready;
  clearInterval(iv);
  window.__bkRemote = b.peer.id;
  window.__bkKeep = setInterval(() => { b.peer.look = 1; b.peer.owner = true; }, 16);
  return { notOwner: !!a.rig.blocky, owner: !!b.rig.blocky, id: b.peer.id };
});
check("a remote without the owner flag stays a stick", !remoteState.notOwner);
check("the owner's remote wears it", remoteState.owner);

// --- running and shooting, side on: two bots run parallel lines with
// their guns up, the owner's in the body and a stick beside it (the same
// gait), up and down 16 m at a run (4.2 m/s); the stride is sampled only on
// the straight, away from the turns
await page.evaluate((id) => {
  const T = window.__trollOps;
  T.bots.update = () => {};
  const b = T.bots.bots.find((x) => x.id === id);
  const stick = T.bots.bots.find((x) => x.alive && x.id !== id && !T.remotes.byId.get(x.id)?.rig.blocky);
  window.__pair = [b.id, stick.id];
  // wall-clock, so the speed is real (headless timers run late)
  const t0 = performance.now();
  setInterval(() => {
    const t = (performance.now() - t0) / 1000;
    const L = 16, s = (t * 4.2) % (2 * L), out = s < L, z = -2 - (out ? s : 2 * L - s);
    window.__straight = (out ? s : 2 * L - s) > 3 && (out ? s : 2 * L - s) < L - 3;
    [b, stick].forEach((x, i) => {
      x.pos.set(i * 1.6, 0, z);
      x.yaw = out ? 0 : Math.PI;
      x.pitch = 0; x.ads = 1; x.stance = "stand"; x.moving = true; x.alive = true; x.hp = 100;
      T.net.publishBot(x);
    });
  }, 33);
}, remoteState.id);
await wait(2500);
const rid = remoteState.id;
const sample = () => page.evaluate(async () => {
  const T = window.__trollOps;
  const out = {};
  for (const id of window.__pair) out[id] = [];
  for (let i = 0; i < 120; i++) {
    await new Promise((d) => requestAnimationFrame(d));
    // the straight only, and not while a killcam replays them (our own
    // player standing at spawn can be shot)
    if (!window.__straight || T.killcam.active || !T.player.alive) continue;
    for (const id of window.__pair) {
      const r = T.remotes.byId.get(id), p = r.rig.parts, V = r.rig.root.position.constructor;
      // running frames only (not a death fall or a hit stagger)
      if (r.dying || !r.alive || r.rig.death || !(r.rig.gait.blend > 0.95)) continue;
      const loc = (o) => { const v = o.getWorldPosition(new V()); r.rig.root.worldToLocal(v); return v; };
      const h = loc(p.hips);
      out[id].push({ tx: +p.torso.rotation.x.toFixed(3), sx: +p.spine.rotation.x.toFixed(3), cx: +p.chest.rotation.x.toFixed(3), w: r.weaponId, held: !!r.rig.held, gh: !!r.rig.gunHold, acc: +(r.rig.gait.acc ?? 0).toFixed(2), air: +(r.rig.gait.air ?? 0).toFixed(2), ra: !!r.air, em: r.peer.emote || 0, mel: !!r.melee, hp: r.peer.hp, y: +r.pos.y.toFixed(2), z: +r.pos.z.toFixed(2), pitch: p.torso.rotation.x + p.spine.rotation.x + p.chest.rotation.x, l: loc(p.ankleL).z - h.z, r: loc(p.ankleR).z - h.z, blocky: !!r.rig.blocky, mps: r.gaitMps });
    }
  }
  return out;
});
const runs = await sample();
// (frames where a headless page stalled the bots' updates come out frozen,
// both feet together: left out)
const stats = (s0) => { const s = s0.filter((x) => Math.abs(x.l - x.r) > 0.02); const ps = s.map((x) => Math.abs(x.pitch)).sort((a, b) => a - b); const zs = s.flatMap((x) => [x.l, x.r]); return { median: ps[ps.length >> 1], n: s.length, mean: zs.reduce((a, b) => a + b, 0) / zs.length, min: Math.min(...zs), max: Math.max(...zs), pitch: Math.max(...s.map((x) => Math.abs(x.pitch))), mps: s.reduce((a, x) => a + x.mps, 0) / s.length, blocky: s.every((x) => x.blocky) }; };
const [bs, ss] = await page.evaluate(() => window.__pair).then((ids) => ids.map((id) => stats(runs[id])));
check("still wearing it on the run", bs.blocky && bs.n > 12, `${bs.n} running frames`);
// A run's swing foot kicks up behind, so the ankles sit a little behind the
// hips on average; the body's stride is the stick's, scaled to its legs
// (feet that stayed planted out in front read as a slant)
check("cadence follows the real speed (4.2 m/s)", Math.abs(bs.mps - 4.2) < 0.4 && Math.abs(ss.mps - 4.2) < 0.4, `blocky ${bs.mps.toFixed(2)}, stick ${ss.mps.toFixed(2)}`);
check("feet pass under the body, like the stick's stride scaled to its legs", Math.abs(bs.mean / 0.67 - ss.mean) < 0.06 && Math.abs(bs.mean) < 0.1, `blocky ${bs.mean.toFixed(3)} m (${bs.min.toFixed(2)}..${bs.max.toFixed(2)}), stick ${ss.mean.toFixed(3)} m (${ss.min.toFixed(2)}..${ss.max.toFixed(2)})`);
check("feet go both ahead and behind", bs.min < -0.12 && bs.max > 0.12);
check("torso upright on the run with the gun up (median < 4, peak < 7 degrees)", bs.median < 0.07 && bs.pitch < 0.122,
  `median ${(bs.median * 57.3).toFixed(1)}, peak ${(bs.pitch * 57.3).toFixed(1)} deg; the stick: ${(ss.median * 57.3).toFixed(1)}, ${(ss.pitch * 57.3).toFixed(1)}`);

// hit capsules: the thigh capsule's top sits at the hip, its length the short thigh
const hb = await page.evaluate((id) => {
  const r = window.__trollOps.remotes.byId.get(id).rig;
  const m = r.hitboxMeshes[9], g = m.geometry.parameters;
  return { len: (g.length + 2 * g.radius) * m.scale.y - 2 * g.radius, thigh: r.thigh };
}, rid);
check("thigh hit capsule follows the shorter thigh", Math.abs(hb.len - hb.thigh) < 0.01, JSON.stringify(hb));

// shots: side on, and a front three-quarter, over the stride
const shoot = async (name, side) => {
  const url = await page.evaluate(({ id, side }) => new Promise((done) => requestAnimationFrame(() => {
    const T = window.__trollOps, r = T.remotes.byId.get(id), cam = T.camera;
    const c = r.rig.root.position;
    if (side === "side") cam.position.set(c.x - 3.4, 1.2, c.z);   // (the stick runs on its other side)
    else cam.position.set(c.x - 2.2, 1.4, c.z - 2.6 * Math.cos(r.rig.root.rotation.y));
    cam.lookAt(c.x, 0.85, c.z);
    cam.updateMatrixWorld(true);
    T.composer.render(0.016);
    done(T.renderer.domElement.toDataURL("image/png"));
  })), { id: rid, side });
  fs.writeFileSync(path.join(OUT, `ingame-${name}.png`), Buffer.from(url.split(",")[1], "base64"));
};
for (let i = 0; i < 4; i++) { await shoot(`side-${i}`, "side"); await wait(110); }
await shoot("front", "front");

// --- taking it off: the stick is back, with its own proportions
await page.evaluate(() => document.querySelector('#to-cos-body [data-body=""]').click());
await wait(600);
const off = await page.evaluate(() => {
  const r = window.__trollOps.localRig;
  return { on: !!r.blocky, legs: r.legScale, build: r.build, stick: r.parts.body.visible, skull: !!r.skull };
});
check("back to the stick: proportions and line restored", !off.on && off.legs === 1 && off.build === 1 && off.stick && !off.skull, JSON.stringify(off));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
