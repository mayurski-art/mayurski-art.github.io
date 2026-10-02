// Troll Forces zombies check: the MakeHuman zombie bodies spawn and animate,
// a head shot lands on the head hitbox (and a chest shot doesn't), a kill
// plays the death clip and the body is gone after it sinks, plus up-close
// screenshots on each zombies map.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-zombie-test.mjs [mapId ...]
//   SHOTS_DIR=<dir> for the screenshots (default: the OS temp dir)
//   FPS=1 instead: round 10 (a full horde of 12), fps + draws per frame for
//   5 s; ROOT_DIR=<another checkout> measures an older build the same way
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = process.env.ROOT_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOTS_DIR || os.tmpdir();
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const maps = process.argv.slice(2).length ? process.argv.slice(2) : ["hollowgrin", "pentagrin"];

for (const map of maps) {
  console.log(`--- ${map}`);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" || /zombie model failed/.test(m.text())) errors.push(m.text()); });
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
  await page.evaluate(async (map) => {
    const T = window.__trollOps;
    T.setMode("zombies");
    T.loadout.poolMapId = map;
    await T.startGame();
    if (T.isStaging?.()) T.endStaging();
    T.player.maxHp = T.player.hp = 1e9;
  }, map);

  if (process.env.FPS) {
    const r =await page.evaluate(async () => {
      const T = window.__trollOps;
      const gl = T.renderer.getContext();
      let draws = 0;
      for (const fn of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced"]) {
        const f = gl[fn].bind(gl);
        gl[fn] = (...a) => { draws++; return f(...a); };
      }
      const zd = T.zdir();
      zd.clear();
      zd.startRound(10);
      const t0 = performance.now();
      while (zd.zombies.filter((z) => z.alive && !z.dying).length < 12 && performance.now() - t0 < 90000) await new Promise((r) => setTimeout(r, 250));
      await new Promise((r) => setTimeout(r, 1500));
      draws = 0;
      let n = 0; const s = performance.now();
      await new Promise((done) => { const f = () => { n++; if (performance.now() - s < 5000) requestAnimationFrame(f); else done(); }; requestAnimationFrame(f); });
      return { alive: zd.zombies.filter((z) => z.alive && !z.dying).length, fps: +(n / 5).toFixed(1), drawsPerFrame: Math.round(draws / n) };
    });
    console.log("FPS", map, JSON.stringify(r));
    await page.close();
    continue;
  }

  // wait for a few of the horde (the sim is slow headless)
  const spawned = await page.waitForFunction(() => {
    const z = window.__trollOps.zdir();
    return z && z.zombies.filter((q) => q.alive && !q.dying).length >= 3;
  }, null, { timeout: 120000 }).then(() => true).catch(() => false);
  check(spawned, "zombies spawn");
  if (!spawned) { console.log(errors.join("\n")); await page.close(); continue; }
  await new Promise((r) => setTimeout(r, 4000));

  const info = await page.evaluate(() => {
    const zd = window.__trollOps.zdir();
    const zs = zd.zombies.filter((z) => z.alive && !z.dying);
    return {
      n: zs.length,
      bodies: zs.filter((z) => !!z.body).length,
      clips: zs.map((z) => z.animName),
      types: zs.map((z) => z.type.id),
      looks: zs.map((z) => z.look),
      hitboxes: zs.map((z) => z.hitboxMeshes.length),
    };
  });
  check(info.bodies === info.n, "every zombie is a model body", `${info.bodies}/${info.n}`);
  check(info.clips.every((c) => ["walk", "run", "idle", "attack", "rise"].includes(c)), "zombies play clips", info.clips.join(","));
  console.log("looks", info.looks.join(","));
  check(info.hitboxes.every((h) => h === 11), "11 hitboxes each", info.hitboxes.join(","));

  // shots: from 3 m in front of one zombie, at its head proxy, then its chest
  const shots = await page.evaluate(() => {
    const T = window.__trollOps;
    const zd = T.zdir();
    const z = zd.zombies.find((q) => q.alive && !q.dying && q.body);
    z.stun(5);                                 // hold still while we aim
    z.mesh.updateMatrixWorld(true);
    const headBox = z.hitboxMeshes.find((h) => h.userData.isHead);
    const chestBox = z.hitboxMeshes[1];
    const head = headBox.getWorldPosition(headBox.position.clone());
    const chest = chestBox.getWorldPosition(chestBox.position.clone());
    const fwd = head.clone().set(-Math.sin(z.mesh.rotation.y), 0, -Math.cos(z.mesh.rotation.y));
    const out = {};
    for (const [name, tgt] of [["head", head], ["chest", chest]]) {
      const from = tgt.clone().addScaledVector(fwd, 3);
      const dir = tgt.clone().sub(from).normalize();
      out[name] = { from: from.toArray(), dir: dir.toArray() };
    }
    out.id = z.id;
    return out;
  });
  const hitRes = await page.evaluate(async ({ id, head, chest }) => {
    const THREE = await import("three");
    const T = window.__trollOps;
    const zd = T.zdir();
    const z = zd.zombies.find((q) => q.id === id);
    const meshes = zd.hitMeshes();
    const ray = new THREE.Raycaster();
    const res = {};
    for (const [name, s] of [["head", head], ["chest", chest]]) {
      ray.set(new THREE.Vector3(...s.from), new THREE.Vector3(...s.dir));
      const h = ray.intersectObjects(meshes, false)[0];
      res[name] = h ? { isHead: !!h.object.userData.isHead, resolves: zd.resolve(h.object) === z } : null;
    }
    return res;
  }, { id: shots.id, head: shots.head, chest: shots.chest });
  check(hitRes.head?.isHead && hitRes.head.resolves, "head shot lands on the head", JSON.stringify(hitRes.head));
  check(hitRes.chest && !hitRes.chest.isHead && hitRes.chest.resolves, "chest shot is a body hit", JSON.stringify(hitRes.chest));

  // a close-up: stand 2.6 m in front of a zombie and look at its face
  await page.evaluate((id) => {
    const T = window.__trollOps;
    const z = T.zdir().zombies.find((q) => q.id === id);
    const p = z.mesh.position;
    const fy = z.mesh.rotation.y;
    const fx = -Math.sin(fy), fz = -Math.cos(fy);
    T.move.pos.set(p.x + fx * 2.6, T.move.pos.y, p.z + fz * 2.6);
    T.look.yaw = Math.atan2(fx, fz);
    T.look.pitch = 0.0;
    z.stunT = 0; z.staggerT = 0;
  }, shots.id);
  await new Promise((r) => setTimeout(r, 2500));
  const shot = path.join(SHOTS, `zombie-${map}.png`);
  await page.screenshot({ path: shot });
  console.log("shot", shot);

  // kill it: death clip, then gone once it has sunk
  const killed = await page.evaluate(async (id) => {
    const T = window.__trollOps;
    const zd = T.zdir();
    const z = zd.zombies.find((q) => q.id === id);
    z.takeDamage(1e9, true);
    await new Promise((r) => setTimeout(r, 600));
    const clip = z.animName;
    const t0 = performance.now();
    while (zd.zombies.includes(z) && performance.now() - t0 < 30000) await new Promise((r) => setTimeout(r, 250));
    return { clip, gone: !zd.zombies.includes(z), secs: Math.round((performance.now() - t0) / 1000) };
  }, shots.id);
  check(killed.clip === "die", "a kill plays the death clip", killed.clip);
  check(killed.gone, "the body is removed after sinking", `${killed.secs}s`);

  // the rare trollface-mask zombie: force its odds to 1 and look at one
  const mask = await page.evaluate(async () => {
    const T = window.__trollOps;
    const zm = await import("/assets/games/troll-ops/zombie-models.js?v=zr3");
    zm.RARE_LOOKS.trollmask = 1;
    const zd = T.zdir();
    zd.clear();
    zd.startRound(2);
    const t0 = performance.now();
    let z = null;
    while (!z && performance.now() - t0 < 60000) {
      await new Promise((r) => setTimeout(r, 250));
      z = zd.zombies.find((q) => q.alive && !q.dying && q.body && q.riseT <= 0);
    }
    zm.RARE_LOOKS.trollmask = 1 / 40;
    if (!z) return null;
    let maskTex = false;
    z.mesh.traverse((o) => { if (o.isMesh && /mask/.test(o.material.name) && o.material.map?.image) maskTex = true; });
    const p = z.mesh.position, fy = z.mesh.rotation.y;
    const fx = -Math.sin(fy), fz = -Math.cos(fy);
    T.move.pos.set(p.x + fx * 1.6, T.move.pos.y, p.z + fz * 1.6);
    T.look.yaw = Math.atan2(fx, fz);
    T.look.pitch = 0.05;
    return { look: z.look, maskTex };
  });
  check(mask?.look === "trollmask" && mask.maskTex, "the trollface-mask zombie spawns with its mask", JSON.stringify(mask));
  await new Promise((r) => setTimeout(r, 1500));
  const mshot = path.join(SHOTS, `zombie-mask-${map}.png`);
  await page.screenshot({ path: mshot });
  console.log("shot", mshot);

  // the leaper: force one, stand it 5.5 m off on a clear line, and watch it
  // crouch (with a shriek), fly and land a hit
  const leap = await page.evaluate(async () => {
    const T = window.__trollOps;
    const { lineClear } = await import("/assets/games/troll-ops/zombies.js?v=zr3");
    const zd = T.zdir();
    zd.clear();
    zd.forceType = "leaper";
    zd.startRound(9);
    const t0 = performance.now();
    let z = null;
    while (!z && performance.now() - t0 < 60000) {
      await new Promise((r) => setTimeout(r, 250));
      z = zd.zombies.find((q) => q.alive && !q.dying && q.body && q.riseT <= 0);
    }
    zd.forceType = null;
    if (!z) return null;
    zd.toSpawn = 0;
    for (const q of zd.zombies) if (q !== z) q.alive = false;
    const out = { look: z.look, clips: Object.keys(z.body.actions).sort().join(","), hitboxes: z.hitboxMeshes.length };
    const feet = T.move.pos;
    let spot = null;
    for (let i = 0; i < 16 && !spot; i++) {
      const a = (i / 16) * Math.PI * 2;
      const s = { x: feet.x + Math.sin(a) * 5.5, z: feet.z + Math.cos(a) * 5.5 };
      if (lineClear(zd.colliders, s, feet, feet.y)) spot = s;
    }
    if (!spot) return { ...out, err: "no clear spot" };
    const shrieks = [];
    const push = zd.events.push.bind(zd.events);
    zd.events.push = (e) => { if (e.type === "shriek") shrieks.push(e); return push(e); };
    z.mesh.position.set(spot.x, feet.y, spot.z);
    z.groundY = feet.y;
    z.leapCdT = 0;
    T.look.yaw = Math.atan2(-(spot.x - feet.x), -(spot.z - feet.z));
    T.look.pitch = 0.1;
    const st = window.__leapTest = { z, out, shrieks, push, hp0: T.player.hp, phases: new Set(), maxUp: 0, feetY: feet.y };
    const t1 = performance.now();
    // hand back mid-air for a screenshot
    while (performance.now() - t1 < 15000 && !(z.leap?.phase === "air" && z.leap.k > 0.35)) {
      await new Promise((r) => requestAnimationFrame(r));
      if (z.leap) { st.phases.add(z.leap.phase); st.phases.add(z.animName); }
    }
    // the arc's peak can pass during the screenshot: record the height here
    st.maxUp = z.mesh.position.y - st.feetY;
    return { ok: true };
  });
  if (leap?.ok) {
    const lshot = path.join(SHOTS, `zombie-leap-${map}.png`);
    await page.screenshot({ path: lshot });
    console.log("shot", lshot);
    Object.assign(leap, await page.evaluate(async () => {
      const T = window.__trollOps;
      const st = window.__leapTest;
      const { z } = st;
      const t1 = performance.now();
      while (performance.now() - t1 < 15000) {
        await new Promise((r) => setTimeout(r, 30));
        if (z.leap) { st.phases.add(z.leap.phase); st.phases.add(z.animName); }
        st.maxUp = Math.max(st.maxUp, z.mesh.position.y - st.feetY);
        if (st.phases.has("land") && T.player.hp < st.hp0) break;
      }
      T.zdir().events.push = st.push;
      return { ...st.out, phases: [...st.phases].join(","), maxUp: +st.maxUp.toFixed(2), shrieks: st.shrieks.length, hurt: T.player.hp < st.hp0 };
    }));
  }
  check(leap?.look === "leaper" && /crouch/.test(leap.clips) && /leap/.test(leap.clips) && /lope/.test(leap.clips) && leap.hitboxes === 11,
    "the leaper spawns in its own body", JSON.stringify(leap && { look: leap.look, clips: leap.clips, hitboxes: leap.hitboxes }));
  check(leap && /windup/.test(leap.phases) && /air/.test(leap.phases) && /land/.test(leap.phases) && leap.maxUp > 0.8,
    "it crouches, leaps and lands", JSON.stringify(leap && { phases: leap.phases, maxUp: leap.maxUp, err: leap.err }));
  check(leap?.shrieks >= 1, "the wind-up shrieks", String(leap?.shrieks));
  check(!!leap?.hurt, "the landing hits");

  // frame-ancestors in a <meta> CSP is a standing, harmless warning
  const errs = errors.filter((e) => !/favicon|net::ERR|supabase|404|frame-ancestors/i.test(e));
  // the textures must really be on the GPU (a CSP block leaves them blank)
  const tex = await page.evaluate(() => {
    const z = window.__trollOps.zdir().zombies.find((q) => q.body);
    let n = 0, ok = 0;
    z?.mesh.traverse((o) => { if (o.isMesh && o.material.map) { n++; if (o.material.map.image) ok++; } });
    return { n, ok };
  });
  check(tex.n > 0 && tex.ok === tex.n, "zombie textures loaded", `${tex.ok}/${tex.n}`);
  check(errs.length === 0, "no page errors", errs.slice(0, 5).join(" | "));
  await page.close();
}
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
