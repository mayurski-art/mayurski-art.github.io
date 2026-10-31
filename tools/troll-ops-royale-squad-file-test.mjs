// Troll Royale, the jump out of the C-130, phase 3 (modes/royale-file.js,
// docs/ROYALE-EXIT.md): a squad goes out together. Troll Royale as Trios in
// a PRIVATE room (Supabase blocked; never the public room), us and our two
// bot teammates in one plane, the lobby long enough for the cinematic:
//   - the file: three of us, by seat, one behind the other down the middle
//     at the ramp, 0.9 m apart, the front nearest the door;
//   - the stick-figure squad mate stays home (your squad is your own);
//   - hands held (each pair meets behind the one in front), the run-up and
//     the crouch together;
//   - at the green out in order, front first, a beat apart;
//   - frames: the file from the side, and over your shoulder.
//
//   NODE_PATH=<main checkout>/node_modules node tools/troll-ops-royale-squad-file-test.mjs [outDir]
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2] || path.join(os.tmpdir(), "royale-squad-file");
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
await ctx.route(/supabase/, (r) => r.abort());
let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const errors = [];
const src = (f) => fs.readFileSync(path.join(ROOT, "assets/games/troll-ops", f), "utf8");
const STATE = "/assets/games/troll-ops/core/state.js?v=st1";
const ROY = "/assets/games/troll-ops/" + src("modes/match-start.js").match(/\.\/royale\.js\?v=[\w-]+/)[0].replace("./", "modes/");

const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.DROP.lobbySeconds = 50;
  T.setMode("royale_trio");
  T.els.noBots.checked = false;
  T.els.room.value = "SQF" + Math.floor(Math.random() * 900 + 100);   // a private room: never the public one
  T.els.room.dispatchEvent(new Event("input"));
  T.settings.thirdPerson = true;   // your own body posed (and seen) in the hold
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && window.__trollOps.planes()?.hold?.plane, null, { timeout: 240000 });

// Everything sampled in the page, on the frame each moment comes.
const run = await page.evaluate(async ([u, roy]) => {
  const { game } = await import(u);
  const R = await import(roy);
  const THREE = await import("three");
  const T = window.__trollOps, out = { frames: {}, exits: {} };
  const local = (m, v) => v.clone().applyMatrix4(m.clone().invert());
  const members = () => {
    const r = T.royale(), f = R.royaleFile(), sq = r.drop.squadron, m = sq.planeM[sq.ridden];
    if (!f) return null;
    return f.ids.map((id, k) => {
      const me = k === f.k;
      const rig = me ? game.localRig : game.remotes.byId.get(id)?.rig;
      if (!rig) return { id, k, missing: true };
      rig.root.updateMatrixWorld(true);
      const w = (o) => o.getWorldPosition(new THREE.Vector3());
      const at = local(m, rig.root.getWorldPosition(new THREE.Vector3()));
      return { id, k, me, shown: rig.root.visible, x: at.x, z: at.z, handL: w(rig.parts.handL), handR: w(rig.parts.handR),
        lower: me ? (T.move.stance === "crouch" ? 1 : 0) : game.remotes.byId.get(id).lower, drop: me ? r.me : game.remotes.byId.get(id).drop };
    });
  };
  const grab = (name, side) => {
    const r = T.royale(), sq = r.drop.squadron, m = sq.planeM[sq.ridden];
    let cam = game.camera;
    if (side) {
      // from the starboard wall, looking across at the file
      cam = new THREE.PerspectiveCamera(85, 16 / 9, 0.05, 100);
      cam.position.set(1.4, 1.35, 4.2).applyMatrix4(m);
      cam.up.set(0, 1, 0).applyQuaternion(new THREE.Quaternion().setFromRotationMatrix(m));
      cam.lookAt(new THREE.Vector3(-0.2, 0.9, 3.9).applyMatrix4(m));
    }
    T.renderer.render(T.scene, cam);
    out.frames[name] = T.renderer.domElement.toDataURL("image/png");
  };
  const marks = [
    { at: -12, fn: () => { out.roster = R.royaleFile(); out.mateShown = false; } },
    { at: -8.6, fn: () => { out.formed = members(); grab("file-side.png", true); } },
    { at: -5, fn: () => { out.held = members(); grab("file-hands.png", true); grab("file-shoulder.png", false); } },
    { at: -0.45, fn: () => { out.set = members(); grab("file-set.png", true); } },
  ];
  return await new Promise((done) => {
    const t0 = performance.now();
    const tick = () => {
      const r = T.royale(), t = r?.planeT;
      while (marks.length && t >= marks[0].at) marks.shift().fn();
      if (t > 0) {
        const ms = members() || [];
        for (const m of ms) if (out.exits[m.id] == null && m.drop !== "aboard" && m.drop !== 1) out.exits[m.id] = t;
        if ((ms.length && ms.every((m) => out.exits[m.id] != null)) || t > 4) { out.order = R.royaleFile()?.ids; return done(out); }
      }
      if (performance.now() - t0 > 200000) return done({ ...out, timeout: t });
      requestAnimationFrame(tick);
    };
    tick();
  });
}, [STATE, ROY]);

for (const [n, d] of Object.entries(run.frames || {})) fs.writeFileSync(path.join(OUT, n), Buffer.from(d.split(",")[1], "base64"));
const strip = (ms) => JSON.stringify((ms || []).map((m) => ({ k: m.k, me: m.me, x: +m.x?.toFixed(2), z: +m.z?.toFixed(2), lower: m.lower, drop: m.drop })));
check(run.roster?.n === 3 && run.roster.k >= 0, "a file of three: us and our two bot teammates", JSON.stringify(run.roster));
const f = run.formed || [];
check(f.length === 3 && f.every((m) => !m.missing && m.shown), "all three drawn in the hold", strip(f));
check(f.every((m) => Math.abs(m.x) < 0.2), "down the middle, one behind the other", strip(f));
const gaps = f.slice(1).map((m, i) => f[i].z - m.z);
check(gaps.length === 2 && gaps.every((g) => Math.abs(g - 0.9) < 0.2), "0.9 m apart, the front nearest the door", gaps.map((g) => g.toFixed(2)).join(" "));
check(f[0] && Math.abs(f[0].z - 5.7) < 0.25, "the front at the ramp's hinge", f[0]?.z?.toFixed(2));
const h = run.held || [];
const v = (o) => Math.hypot(o.x, o.y, o.z);
const meet = h.slice(1).map((m, i) => v({ x: h[i].handL.x - m.handR.x, y: h[i].handL.y - m.handR.y, z: h[i].handL.z - m.handR.z }));
check(meet.length === 2 && meet.every((d) => d < 0.2), "hands held: each pair's hands meet", meet.map((d) => d.toFixed(2)).join(" "));
const s = run.set || [];
check(s.length === 3 && s.every((m) => m.lower > 0.5), "set: all three crouched", strip(s));
check(s.length === 3 && s.every((m, i) => Math.abs(m.z - (f[i]?.z - 1.6)) < 0.35), "...after backing up 1.6 m together", strip(s));
const ex = (run.order || []).map((id) => run.exits?.[id]);
check(ex.length === 3 && ex.every((t) => t != null), "at the green all three go out", JSON.stringify(run.exits));
check(ex.length === 3 && ex[0] <= ex[1] && ex[1] <= ex[2], "front first, in order", ex.map((t) => t?.toFixed(2)).join(" "));
check(ex.length === 3 && ex[2] - ex[0] < 1.2, "...a beat apart", (ex[2] - ex[0]).toFixed(2) + " s");
check(!errors.length, "no page errors", errors.slice(0, 3).join(" | "));
console.log("frames:", OUT);
await browser.close(); server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
