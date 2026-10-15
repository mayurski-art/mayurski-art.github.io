// Troll Forces Black Ops 2 reloads check (view/ar-reload.js). One headless
// tab per body, a SOLO range (no room code: never a public room), Supabase
// blocked. For each of the nine BO2 rifles, the three SMGs, the three LMGs
// and the two pistols:
//   1. Mid-reload the gun stands up out of the hip pose (muzzle well up),
//      the mag comes out of the well, and the left hand leaves the guard.
//   2. A whole reload played in real time: an empty one ends on the rack or
//      the catch (its sound beat; a pistol's slide dropping), a tactical one
//      doesn't; both fill the mag and end with the gun back at the hip and
//      the mag seated square (a drum keeps its own roll).
//   3. Cut off mid-reload (the trigger cuts a tactical one): it eases back
//      to the hip and the mag is back in the well, square.
// On the TROLLS body (BODY run 2) the block fist rides the hand all the way.
// A carbine (not a BO2 rifle) still runs the old reload.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-arreload-test.mjs [id ...]
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
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
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });

let fails = 0;
const check = (what, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const RIFLES = ["kek", "lol", "lmao", "rofl", "heh", "mald", "coalface", "salt", "ratio"];
const SMGS = ["snicker", "cope", "seethe"];
const LMGS = ["coltlmg", "bellylaugh", "cackle"];
const PISTOLS = ["sixtynine", "true69"];
const only = process.argv.slice(2);
const ids = only.length ? only : [...RIFLES, ...SMGS, ...LMGS, ...PISTOLS];
// the weapons.js tag game.js loads (one copy of the module, its state shared)
const WTAG = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/game.js"), "utf8").match(/weapons\.js\?v=([^"]+)/)[1];

async function boot(body) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/frame-ancestors|ERR_FAILED|supabase/i.test(m.text())) errors.push(m.text()); });
  await page.addInitScript((body) => {
    localStorage.setItem("trollops:cosmetics", JSON.stringify({ face: "grin:og::rolex-gold", body }));
    const profile = { username: "troll_runner" };
    Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => window.__acct, set: (v) => { window.__acct = v; if (v) v.getCachedProfile = () => profile; } });
  }, body);
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
  await page.evaluate(async () => {
    if (!window.TrollrunnerAccounts) window.TrollrunnerAccounts = {};
    const T = window.__trollOps;
    T.els.room.value = "";
    T.setMode("range");
    await T.startGame();
  });
  await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  // helpers in the page: hold a rifle, read the view
  await page.evaluate(async (WTAG) => {
    const T = window.__trollOps;
    const THREE = await import("three");
    const { WeaponState, WEAPON_DEFS } = await import(`/assets/games/troll-ops/weapons.js?v=${WTAG}`);
    window.__beats = [];
    const orig = T.audio.rifleBeat.bind(T.audio);
    T.audio.rifleBeat = (b) => { window.__beats.push(b); orig(b); };
    const origSlide = T.audio.slideRelease.bind(T.audio);
    T.audio.slideRelease = () => { window.__beats.push("slide"); origSlide(); };
    window.__hold = (id) => {
      const def = WEAPON_DEFS[id];
      const w = new WeaponState(def);
      T.player.weapons[def.id] = w;
      T.player.weaponId = def.id;
      T.switchWeapon("primary");
      T.setActiveWeaponMesh(def);
      T.setHolding("gun");
      return w;
    };
    const v = (o, x = 0, y = 0, z = 0) => o.localToWorld(new THREE.Vector3(x, y, z));
    window.__view = () => {
      const m = T.activeWeaponMesh(), mag = m.userData.magMesh;
      const seat = m.localToWorld(m.userData.magazinePoint.clone());
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(m.getWorldQuaternion(new THREE.Quaternion()));
      const rods = T.pfArms.userData.rods;
      const tip = v(rods[1], 0, 1, 0);
      const fists = T.pfArms.children.filter((c) => c.isMesh && c.geometry.type === "BoxGeometry" && Math.abs(c.geometry.parameters.width - 0.082) < 1e-3);
      const fistD = fists.length ? Math.min(...fists.map((f) => f.getWorldPosition(new THREE.Vector3()).distanceTo(tip))) : null;
      return {
        up: fwd.y,
        magOff: mag ? v(mag).distanceTo(seat) : null,
        magSquare: mag ? Math.abs(mag.rotation.y) + Math.abs(mag.rotation.z - (m.userData.magRestRotationZ ?? 0)) : 0,
        tip: [tip.x, tip.y, tip.z],
        fistD, fistOn: fists.some((f) => f.visible),
      };
    };
  }, WTAG);
  return { ctx, page, errors };
}

const freezeAt = (page, t, empty) => page.evaluate(({ t, empty }) => {
  const w = window.__trollOps.currentWeapon();
  w.reloadWasEmpty = empty;
  w.reloadTime = empty ? w.def.reloadTime : (w.def.tacReloadTime ?? w.def.reloadTime * 0.72);
  window.__rlT = t;
  Object.defineProperty(w, "reloadT", { configurable: true, get: () => w.reloadTime * (1 - window.__rlT), set() {} });
  Object.defineProperty(w, "reloading", { configurable: true, get: () => true, set() {} });
}, { t, empty });
const view = (page) => page.evaluate(() => window.__view());
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

for (const body of ["", "trolls-1718"]) {
  const tag = body ? "TROLLS body" : "stick troll";
  const { ctx, page, errors } = await boot(body);
  for (const id of ids) {
    // 1. the held poses
    await page.evaluate((id) => window.__hold(id), id);
    await page.waitForTimeout(500);
    const hip = await view(page);
    await freezeAt(page, 0.25, true);
    await page.waitForTimeout(150);
    const pulled = await view(page);
    await page.evaluate(() => { window.__rlT = 0.36; });
    await page.waitForTimeout(150);
    const swap = await view(page);
    check(`${tag} ${id}: stands up out of the hip pose`, hip.up < 0.35 && swap.up > 0.5, `hip ${hip.up.toFixed(2)} -> ${swap.up.toFixed(2)}`);
    check(`${tag} ${id}: the mag comes out of the well`, pulled.magOff > 0.06, pulled.magOff?.toFixed(3));
    check(`${tag} ${id}: the left hand leaves the guard`, dist(hip.tip, swap.tip) > 0.1, dist(hip.tip, swap.tip).toFixed(3));
    if (body) check(`${tag} ${id}: the block fist rides the hand`, swap.fistOn && swap.fistD != null && swap.fistD < 0.06, `${swap.fistOn} ${swap.fistD?.toFixed(3)}`);
    // 2. whole reloads in real time, empty then tactical
    for (const empty of [true, false]) {
      const r = await page.evaluate(async ({ id, empty }) => {
        const T = window.__trollOps;
        const w = window.__hold(id);
        await new Promise((r) => setTimeout(r, 300));
        w.ammoInMag = empty ? 0 : 3;
        window.__beats = [];
        T.tryReload(true);
        const t0 = performance.now();
        while (w.reloading && performance.now() - t0 < 6000) await new Promise((r) => setTimeout(r, 30));
        await new Promise((r) => setTimeout(r, 200));
        return { beats: window.__beats.slice(), full: w.ammoInMag === w.def.magSize, done: !w.reloading, was: w.reloadWasEmpty, v: window.__view() };
      }, { id, empty });
      const kind = empty ? "empty" : "tactical";
      check(`${tag} ${id}: ${kind} reload fills the mag`, r.full && r.done, JSON.stringify({ full: r.full, done: r.done }));
      const finish = r.beats.includes("rack") || r.beats.includes("slap") || r.beats.includes("slide");
      check(`${tag} ${id}: ${kind} reload's beats`, r.beats[0] === "release" && r.beats.includes("insert") && finish === empty, r.beats.join(","));
      check(`${tag} ${id}: ${kind} ends at the hip, mag seated square`, r.v.up < 0.35 && r.v.magOff < 0.005 && r.v.magSquare < 1e-6, JSON.stringify({ up: +r.v.up.toFixed(2), off: +r.v.magOff.toFixed(4), sq: r.v.magSquare }));
    }
    // 3. cut off mid-reload by a swap
    const cut = await page.evaluate(async (id) => {
      const T = window.__trollOps;
      const w = window.__hold(id);
      await new Promise((r) => setTimeout(r, 300));
      w.ammoInMag = 3;
      T.tryReload(true);
      // into the swap, the mag out and tilted in the hand, then fire cuts it
      // (view/player-update.js: a tactical reload is cut by the trigger)
      await new Promise((r) => setTimeout(r, w.reloadTime * 450));
      const mid = window.__view();
      w.abortReload();
      await new Promise((r) => setTimeout(r, 250));   // (it eases back over 0.14 s)
      return { reloading: w.reloading, mid, v: window.__view() };
    }, id);
    check(`${tag} ${id}: cut off mid-reload, back at the hip with the mag in the well`, cut.mid.magOff > 0.05 && !cut.reloading && cut.v.up < 0.35 && cut.v.magOff < 0.005 && cut.v.magSquare < 1e-6,
      JSON.stringify({ midOff: +cut.mid.magOff.toFixed(3), r: cut.reloading, up: +cut.v.up.toFixed(2), off: +cut.v.magOff.toFixed(4), sq: cut.v.magSquare }));
  }
  // a carbine keeps the old reload (no BO2 beats, its own mag move)
  if (!only.length) {
    await page.evaluate(() => window.__hold("snubgrin"));
    await page.waitForTimeout(400);
    await freezeAt(page, 0.3, true);
    await page.waitForTimeout(150);
    const c = await view(page);
    check(`${tag}: a carbine still runs the old reload`, c.up < 0.5 && c.magOff > 0.02, JSON.stringify({ up: +c.up.toFixed(2), off: +c.magOff.toFixed(3) }));
  }
  check(`${tag}: no page errors`, errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close();
server.close();
console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
process.exit(fails ? 1 : 0);
