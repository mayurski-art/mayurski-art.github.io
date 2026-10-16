// Troll Forces: the gun never shows through the TROLLS (NFT) body in third
// person (user, 2026-10-13, a repeat report: "i am still able to see weapon
// through the NFT character ... make no mistakes"). Measured, not eyeballed:
// points over the gun's whole surface (about one a square centimetre; corner
// vertices miss a long stock passing through an arm), each tested inside the
// body's real meshes by ray crossings. Before the fix the stock sat 5-6 cm
// inside the chest at the hip and on the aim, the reload's mag 6-9 cm in the
// left thigh. A solo range (no room code: never a public room), Supabase
// blocked, the body worn as troll_runner, third person on. Every gun class
// at the hip, aimed, walking and mid-reload:
//   - nothing in the chest, the hips or the legs (0.5 cm slack);
//   - at most 1.5 cm in an upper arm or shoulder;
//   - the left hand on the handguard (3 cm) at the hip and aimed, for guns
//     of an ordinary length of pull (a long sniper's slides back by design);
// the menu operator's port-arms carry clear of the body and its arms
// (2.5 cm), and the stick troll's hold is left as it was (no gunHold, the
// gun at 1).
// What a fist holds (the grip, the handguard) is the hand holding it, and
// the grip running on out of the fist into the wrist (9 cm) is too.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-nft-hold-test.mjs [gun ...]
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module"; import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
let fails = 0;
const check = (what, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const GUNS = process.argv.slice(2).length ? process.argv.slice(2)
  : ["problem416", "kek", "rofl", "snubgrin", "cope", "bellow", "smug", "deadpan", "coltlmg", "shotgun", "sixtynine", "fhj18"];
const POSES = ["hip", "ads", "walk", "reload"];
const ARM = /^(fore|fist|knuckles|thumb|upper|bicep|tricep|delt)/;
const UPPER = /^(upper|bicep|tricep|delt)/;

// `match` false: stay on the menu (its operator, the char inspector)
async function boot(body, match = true) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript((body) => {
    localStorage.setItem("trollops:cosmetics", JSON.stringify({ face: "grin:og::rolex-gold", body }));
    const profile = { username: "troll_runner" };
    Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => window.__acct, set: (v) => { window.__acct = v; if (v) v.getCachedProfile = () => profile; } });
  }, body);
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
  if (!match) return { ctx, page, errors };
  await page.evaluate(async () => {
    if (!window.TrollrunnerAccounts) window.TrollrunnerAccounts = {};
    const T = window.__trollOps;
    T.els.room.value = "";
    T.setMode("range");
    await T.startGame();
  });
  await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  await page.evaluate(async () => {
    const T = window.__trollOps;
    await T.localRig.blocky?.ready; await T.localRig.blocky?.loaded;
    if (!T.settings.thirdPerson) T.toggleThirdPerson();
    // the game's own weapons.js (its import tag read off the module that loads it)
    const src = await (await fetch("/assets/games/troll-ops/view/player-update.js")).text();
    const W = await import("/assets/games/troll-ops/" + src.match(/\.\.\/(weapons\/weapons\.js\?v=[^"]+)/)[1]);
    const { game } = await import("/assets/games/troll-ops/core/state.js?v=st1");
    window.__hold = (id) => {
      const def = W.WEAPON_DEFS[id], w = new W.WeaponState(def);
      T.player.weapons[def.id] = w; T.player.weaponId = def.id;
      T.switchWeapon("primary"); T.setActiveWeaponMesh(def); T.setHolding("gun");
      return w;
    };
    window.__pose = (pose) => {
      const w = T.currentWeapon();
      T.setAds(pose === "ads");
      if (pose === "walk") game.keys.add("KeyW"); else { game.keys.delete("KeyW"); game.move.pos.set(0, game.move.pos.y, 0); }
      if (pose === "reload") {
        w.reloadWasEmpty = true; w.reloadTime = w.def.reloadTime;
        Object.defineProperty(w, "reloadT", { configurable: true, get: () => w.reloadTime * 0.6, set() {} });
        Object.defineProperty(w, "reloading", { configurable: true, get: () => true, set() {} });
      } else { delete w.reloadT; delete w.reloading; w.reloading = false; w.reloadT = 0; }
    };
  });
  return { ctx, page, errors };
}

// the measure: page helpers used by both bodies
async function addMeasure(page) {
await page.evaluate(async () => {
  const THREE = await import("three");
  // gun surface points, about one per square centimetre (vertex corners miss a long stock passing through an arm)
  const surface = (root) => {
    const pts = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    root.traverse((o) => {
      if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
      let vis = true; for (let x = o; x && x !== root; x = x.parent) if (!x.visible) vis = false;
      if (!vis) return;
      const pa = o.geometry.attributes.position, idx = o.geometry.index;
      const tri = idx ? idx.count / 3 : pa.count / 3;
      for (let t = 0; t < tri; t++) {
        const i0 = idx ? idx.getX(3 * t) : 3 * t, i1 = idx ? idx.getX(3 * t + 1) : 3 * t + 1, i2 = idx ? idx.getX(3 * t + 2) : 3 * t + 2;
        a.fromBufferAttribute(pa, i0).applyMatrix4(o.matrixWorld); b.fromBufferAttribute(pa, i1).applyMatrix4(o.matrixWorld); c.fromBufferAttribute(pa, i2).applyMatrix4(o.matrixWorld);
        const area = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).length() / 2;
        const n = Math.min(60, Math.max(1, Math.round(area / 1e-4)));
        const k = Math.ceil(Math.sqrt(n));
        for (let i = 0; i < k; i++) for (let j = 0; j < k - i; j++) {
          const u = (i + 0.33) / k, v = (j + 0.33) / k;
          if (u + v > 1) continue;
          pts.push(new THREE.Vector3().copy(a).multiplyScalar(1 - u - v).addScaledVector(b, u).addScaledVector(c, v));
        }
      }
    });
    return pts;
  };
  window.__measure = () => {
    const T = window.__trollOps, r = window.__rigOverride || T.localRig;
    r.root.updateMatrixWorld(true);
    const gun = r.held; if (!gun) return { err: "no held" };
    const pieces = [];
    r.root.traverse((o) => {
      if (!o.isMesh || !o.visible || !o.material?.isMeshToonMaterial || !o.name) return;
      for (let x = o; x; x = x.parent) if (x === gun) return;
      let vis = true; for (let x = o; x && x !== r.root; x = x.parent) if (!x.visible) vis = false;
      if (vis) pieces.push(o);
    });
    const pts = surface(gun);
    const box = (m, shrink) => { m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox.clone(); const sz = b.getSize(new THREE.Vector3()); if (shrink) b.expandByVector(sz.multiplyScalar(-shrink)); else b.expandByScalar(0.004); const sc = new THREE.Vector3(); m.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), sc); return { m, b, inv: m.matrixWorld.clone().invert(), k: (sc.x + sc.y + sc.z) / 3 }; };
    const isFist = (m) => /^(fist|knuckles|thumb)$/.test(m.name);
    const fists = pieces.filter(isFist).map((m) => box(m, 0));
    const held = (p) => fists.some(({ b, inv }) => b.containsPoint(p.clone().applyMatrix4(inv)));
    // ...nor the grip running on out of the fist into the wrist (within 9 cm of a hand point)
    const hands = ["L", "R"].map((k) => r.parts["wrist" + k].parent.getWorldPosition(new THREE.Vector3()));
    const loose = pts.filter((p) => !held(p) && hands.every((h) => h.distanceTo(p) > 0.09 * r.scale));
    const side = (m) => { for (let a = m; a; a = a.parent) { const nm = Object.entries(r.parts).find(([, v]) => v === a)?.[0]; if (nm) return /[LR]$/.test(nm) ? nm.slice(-1) : ""; } return ""; };
    const out = {};
    for (const m of pieces) {
      const { b, inv, k } = box(m, window.__inside ? 0 : 0.1);
      let n = 0, depth = 0;
      for (const p of (isFist(m) ? pts : loose)) {
        const l = p.clone().applyMatrix4(inv);
        if (!b.containsPoint(l)) continue;
        const dIn = window.__inside ? window.__inside(m, p) : 0;
        if (window.__inside && !dIn) continue;
        n++;
        depth = Math.max(depth, window.__inside ? dIn : Math.min(l.x - b.min.x, b.max.x - l.x, l.y - b.min.y, b.max.y - l.y, l.z - b.min.z, b.max.z - l.z) * k);
      }
      if (n) out[m.name + side(m)] = { n, cm: +(depth * 100).toFixed(1) };
    }
    // how far each hand is from where it should be (right: the grip; left: under the handguard)
    const u = gun.userData, h = r.gunHold || {}, sc = r.scale;
    const V = pts[0].constructor;
    const sup = u.supportHandPos ? new V().copy(u.supportHandPos) : null;
    if (sup) { sup.y -= (h.under || 0) * sc / (h.scale || 1); gun.localToWorld(sup); }
    const grip = u.gripPos ? gun.localToWorld(new V().copy(u.gripPos)) : null;
    if (grip && h.gripDrop) grip.y -= h.gripDrop * sc;
    const handL = r.parts.wristL.parent.getWorldPosition(new V()), handR = r.parts.wristR.parent.getWorldPosition(new V());
    const gapL = sup ? +(handL.distanceTo(sup) * 100).toFixed(1) : null, gapR = grip ? +(handR.distanceTo(grip) * 100).toFixed(1) : null;
    return { gapL, gapR, pts: pts.length, pieces: pieces.length, names: [...new Set(pieces.map((m) => m.name))].join(","), out };
  };
});
await page.evaluate(async () => {
  const THREE = await import("three");
  const rc = new THREE.Raycaster();
  const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map((d) => new THREE.Vector3(...d));
  // inside a closed mesh: an odd number of crossings along most of six rays; depth = the nearest crossing
  const inside = (m, p) => {
    let odd = 0, near = Infinity;
    for (const d of DIRS) {
      rc.set(p, d); rc.far = 2;
      const hits = rc.intersectObject(m, false);
      if (hits.length % 2 === 1) { odd++; near = Math.min(near, hits[0].distance); }
    }
    return odd >= 4 ? near : 0;
  };
  const prev = window.__measure;
  window.__measure = () => {
    const T = window.__trollOps, r = window.__rigOverride || T.localRig;
    // the box pass finds the candidates; the ray pass keeps only the real ones
    const sides = new Map();
    r.root.traverse((o) => { if (o.isMesh && o.material?.isMeshToonMaterial) { sides.set(o, o.material.side); o.material.side = THREE.DoubleSide; } });
    try {
      const res = prev.call(null, true);
      return res;
    } finally { for (const [o, s] of sides) o.material.side = s; }
  };
  window.__inside = inside;
});
}

// ---- the TROLLS body
{
  const { ctx, page, errors } = await boot("trolls-1718");
  await addMeasure(page);
  check("wearing the TROLLS body in third person", await page.evaluate(() => !!window.__trollOps.localRig.blocky && window.__trollOps.settings.thirdPerson));
  for (const id of GUNS) {
    await page.evaluate((id) => window.__hold(id), id);
    await page.waitForTimeout(400);
    const pull = await page.evaluate(() => { const u = window.__trollOps.localRig.held.userData; return u.buttPos ? u.gripPos.distanceTo(u.buttPos) : 0; });
    for (const pose of POSES) {
      await page.evaluate((pose) => window.__pose(pose), pose);
      await page.waitForTimeout(650);
      const m = await page.evaluate(() => window.__measure());
      let body = 0, bodyAt = "", upper = 0, upperAt = "";
      for (const [k, o] of Object.entries(m.out)) {
        if (!ARM.test(k)) { if (o.cm > body) { body = o.cm; bodyAt = k; } }
        else if (UPPER.test(k) && o.cm > upper) { upper = o.cm; upperAt = k; }
      }
      check(`${id} ${pose}: not in the chest, hips or legs`, body <= 0.5, body ? `${body} cm in ${bodyAt}` : "");
      check(`${id} ${pose}: not through an upper arm`, upper <= 1.5, upper ? `${upper} cm in ${upperAt}` : "");
      if ((pose === "hip" || pose === "ads") && pull > 0 && pull <= 0.32 && m.gapL != null) {
        check(`${id} ${pose}: the left hand on the handguard`, m.gapL <= 3, `${m.gapL} cm off`);
      }
    }
  }
  await page.evaluate(() => window.__pose("hip"));
  check("TROLLS body: no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ---- the menu operator: the port-arms carry across the chest (the user's
// screenshot: the rifle through the white forearms, held at the chest)
{
  const { ctx, page, errors } = await boot("trolls-1718", false);
  await addMeasure(page);
  const m = await page.evaluate(async () => {
    const h = window.__trollOps.charInspector.humanoid;
    await h.blocky?.ready; await h.blocky?.loaded;
    await new Promise((r) => setTimeout(r, 2000));
    window.__rigOverride = h;
    return { blocky: !!h.blocky, held: !!h.held, m: window.__measure() };
  });
  check("the menu operator wears the body and holds a gun", m.blocky && m.held);
  let body = 0, arm = 0, at = "";
  for (const [k, o] of Object.entries(m.m.out)) {
    if (!ARM.test(k)) body = Math.max(body, o.cm);
    else if (!/^(fist|knuckles|thumb)/.test(k) && o.cm > arm) { arm = o.cm; at = k; }
  }
  check("menu carry: not in the chest, hips or legs", body <= 0.5, body ? `${body} cm` : "");
  check("menu carry: not through a forearm or upper arm (2.5 cm)", arm <= 2.5, arm ? `${arm} cm in ${at}` : "");
  check("menu: no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ---- the stick troll keeps its hold
{
  const { ctx, page, errors } = await boot("");
  await page.evaluate(() => window.__hold("problem416"));
  await page.waitForTimeout(500);
  const st = await page.evaluate(() => { const r = window.__trollOps.localRig; return { blocky: !!r.blocky, hold: !!r.gunHold, scale: r.held.scale.x }; });
  check("the stick troll: no gunHold, the gun at its own size", !st.blocky && !st.hold && Math.abs(st.scale - 1) < 1e-6, JSON.stringify(st));
  check("stick troll: no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close();
server.close();
console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
process.exit(fails ? 1 : 0);
