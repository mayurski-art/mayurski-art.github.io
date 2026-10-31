// Troll Forces arsenal v2: the Howl Ballista (DESIGN-ARSENAL.md Phase 1 step
// 5, gun 3; models/build_ballista.blender.py): Black Ops 2's Ballista with
// its own scope. Checks the real gun in its own slot: the baked GLB on one
// shared kit material with its maps; the nodes and extras agreed with the
// MTAR session, whose runtime drives the bolt (HB_Bolt with tf_lift and
// tf_travel, the knob and eject points, HB_Round with tf_round, the
// trigger and folded bipod); the gun's own scope is the 8x (the sight,
// scope key "scope8", the 8x's ADS numbers), aimed in its line sits on the
// screen centre and the scope overlay takes over; an ACOG hides it and
// sits on the rail; third person carries the LOD1 (one node, about 6k
// tris, no parts, no second scope). The bolt cycle, the round and the
// brass are the MTAR branch's tests. Writes OUT/ballista-*.png.
// Offline: Supabase blocked, no bots, never a public room.
//
// Usage: NODE_PATH=<main checkout>/node_modules OUT=<dir> node tools/troll-ops-ballista-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.OUT || "";
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
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (page, name) => { if (OUT) await page.screenshot({ path: path.join(OUT, name) }); };
// the same module URL the game loads (read from game.js, so the merge's ?v=
// cascade can't leave the test on a second copy of the module)
const TF = path.join(ROOT, "assets/games/troll-ops");
const urlOf = (importer, mod) => {
  const src = fs.readFileSync(path.join(TF, importer), "utf8");
  const i = src.indexOf(`/${mod}?v=`);
  if (i < 0) throw new Error(`${importer} doesn't import ${mod}`);
  const start = Math.max(src.lastIndexOf('"', i), src.lastIndexOf("'", i)) + 1;
  const spec = src.slice(start, src.indexOf(src[start - 1], i));
  return new URL(spec, `http://x/assets/games/troll-ops/${importer}`).href.slice("http://x".length);
};
const WM = urlOf("game.js", "weapon-model.js");
const settle = (page) => page.evaluate(async () => {
  const m = window.__trollOps.activeWeaponMesh();
  let last = null;
  for (let i = 0; i < 400; i++) {
    await new Promise((r) => requestAnimationFrame(r));
    const p = m.position.toArray().join();
    if (p === last && i > 30) return true;
    last = p;
  }
  return false;
});

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route(/supabase/, (r) => r.abort());
// troll-ops.html loads these from the live site; serve this checkout's
await page.route(/^https:\/\/mayurski-art\.github\.io\/assets\/js\//, (r) => {
  const f = path.join(ROOT, "assets/js", path.basename(new URL(r.request().url()).pathname));
  return fs.existsSync(f) ? r.fulfill({ path: f, contentType: "text/javascript" }) : r.abort();
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 60000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.loadout.weaponId = "howl";
  T.loadout.attachmentsFor("howl").optic = "scope8";
  T.loadout.attachmentsFor("howl").skin = null;
  T.loadout.mapId = "trollcity";
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 180000 });
await sleep(4500);
await page.evaluate(() => {
  const T = window.__trollOps;
  if (T.isStaging()) T.endStaging();
  T.player.maxHp = T.player.hp = 1e9;
  T.look.pitch = 0.04;
  T.switchWeapon("primary");
  T.setActiveWeaponMesh(T.currentWeapon().def);
  const d = T.currentWeapon().def;
  d.swayAmp = 0; d.bobAmp = 0;
});
await sleep(1500);

// 1. the baked GLB, its kit material and maps
const info = await page.evaluate(async () => {
  const m = window.__trollOps.activeWeaponMesh(), u = m.userData;
  const kit = [];
  m.traverse((o) => { if (o.isMesh && o.material?.name === "HB_Kit") kit.push(o.material); });
  const mat = kit[0];
  for (let i = 0; i < 100 && !(mat?.map?.image && mat.normalMap?.image && mat.roughnessMap?.image); i++) await new Promise((r) => setTimeout(r, 50));
  return {
    parts: Object.keys(u.gunParts ?? {}).sort(), kitMeshes: kit.length, shared: new Set(kit).size === 1 && !!mat?.userData.shared,
    maps: mat ? [mat.map?.image?.width, mat.normalMap?.image?.width, mat.roughnessMap === mat.metalnessMap && mat.aoMap === mat.roughnessMap,
      mat.map?.colorSpace, mat.normalMap?.colorSpace, mat.map?.flipY] : null,
    mag: !!u.magMesh, grip: !!u.gripPos, support: !!u.supportHandPos, lod: u.lod, brass: u.brass,
  };
});
check("the Ballista builds from the baked GLB with its parts",
  info.parts.join() === "BipodL,BipodR,Bolt,Trigger" && info.mag && info.grip && info.support && info.lod === 0 && info.brass === "338", JSON.stringify(info));
check("every baked surface shares one material with 2048 base, ORM and normal maps",
  info.kitMeshes >= 7 && info.shared && info.maps?.[0] === 2048 && info.maps[1] === 2048 && info.maps[2] === true
  && info.maps[3] === "srgb" && info.maps[4] === "" && info.maps[5] === false, JSON.stringify(info));

// 2. the nodes and extras the MTAR runtime reads
const nodes = await page.evaluate(() => {
  const m = window.__trollOps.activeWeaponMesh(), u = m.userData, P = u.gunParts;
  const b = P.Bolt, r = m.getObjectByName("HB_Round"), pt = u.gunPoints;
  const r3 = (v) => v ? v.toArray().map((n) => +n.toFixed(3)) : null;
  return {
    bolt: { kind: b.kind, axis: b.axis, travel: b.travel, lift: b.node.userData.tf_lift, pivot: r3(b.node.position) },
    round: r ? { tf: r.userData.tf_round, at: r3(r.position) } : null, knob: r3(pt.knob), eject: r3(pt.eject),
    bipod: [P.BipodL.kind, P.BipodL.travel, P.BipodR.kind], trigger: [P.Trigger.kind, P.Trigger.axis],
  };
});
check("HB_Bolt slides back along z, pivoted on the bore, with its lift",
  nodes.bolt.kind === "slide" && nodes.bolt.axis === "z" && Math.abs(nodes.bolt.travel - 0.09) < 1e-6 && Math.abs(nodes.bolt.lift - 1.05) < 1e-6
  && Math.abs(nodes.bolt.pivot[0]) < 1e-3 && Math.abs(nodes.bolt.pivot[1]) < 1e-3, JSON.stringify(nodes));
check("the knob and eject points, and HB_Round flagged tf_round ahead of the raked bolt face",
  nodes.knob && nodes.knob[0] > 0.02 && nodes.knob[1] < -0.02 && nodes.eject && nodes.eject[0] > 0.015
  && nodes.round?.tf === 1 && Math.abs(nodes.round.at[2] - (nodes.bolt.pivot[2] + (-0.185 + 0.057) + 0.09 - 0.001)) < 0.002, JSON.stringify(nodes));
check("the trigger hinges and the bipod's legs are folded parts", nodes.trigger.join() === "hinge,x" && nodes.bipod[0] === "hinge" && nodes.bipod[2] === "hinge", JSON.stringify(nodes));
await shot(page, "ballista-0-hip.png");

// 3. its own scope is the 8x
const sc = await page.evaluate(() => {
  const m = window.__trollOps.activeWeaponMesh(), u = m.userData;
  const s = m.getObjectByName("HB_Scope");
  const aim = m.getObjectByName("HB_Aim");
  return { scope: !!s, inSight: !!s && s.parent === u.sight, shown: !!s?.visible, key: u.scopeKey, ads: [u.adsDistance, u.adsWeaponFov],
    aim: u.aimPoint?.toArray().map((n) => +n.toFixed(4)), extraOptic: u.sight?.children.length };
});
check("the gun's own scope is the sight, keyed as the 8x with its ADS numbers",
  sc.scope && sc.inSight && sc.shown && sc.key === "scope8" && sc.ads[0] === 0.19 && sc.ads[1] === 13 && sc.extraOptic === 1
  && Math.abs(sc.aim[0]) < 1e-4 && sc.aim[1] > 0.07, JSON.stringify(sc));

// aimed in: the scope's line on the screen centre, the overlay up, the gun gone
await page.evaluate(() => window.__trollOps.setAds(true));
await sleep(600);
await settle(page);
const ads = await page.evaluate(() => {
  const T = window.__trollOps, m = T.activeWeaponMesh();
  m.updateMatrixWorld(true);
  const V = m.position.constructor;
  const a = m.userData.aimPoint;
  const ang = (z) => { const p = m.localToWorld(new V(0, a.y, z)); return [+(p.x / -p.z).toFixed(4), +(p.y / -p.z).toFixed(4)]; };
  const el = document.querySelector(".to-scope");
  return { rear: ang(a.z + 0.06), front: ang(a.z - 0.2), ads: T.currentWeapon().adsT,
    overlay: el ? [getComputedStyle(el).display, +el.style.opacity] : null, gunShown: m.visible };
});
const off = Math.max(...ads.rear.map(Math.abs), ...ads.front.map(Math.abs));
check("aimed, the scope's line is on the screen centre", ads.ads > 0.99 && off < 0.006, JSON.stringify(ads));
check("aimed, the scope overlay is up and the gun hidden", ads.overlay?.[0] === "block" && ads.overlay[1] > 0.99 && !ads.gunShown, JSON.stringify(ads));
await shot(page, "ballista-1-scoped.png");
await page.evaluate(() => window.__trollOps.setAds(false));
await sleep(600);
await settle(page);

// 4. an ACOG hides the gun's scope and sits on the rail
const acog = await page.evaluate(async (WM) => {
  const { buildWeaponMesh } = await import(WM);
  const def = window.__trollOps.currentWeapon().def;
  const g = buildWeaponMesh({ ...def, attachments: { ...def.attachments, optic: "acog" } });
  const s = g.getObjectByName("HB_Scope");
  return { hidden: !!s && !s.visible, sight: !!g.userData.sight && g.userData.sight !== s?.parent, key: g.userData.scopeKey,
    sightY: +(g.userData.sight?.position.y ?? 0).toFixed(4) };
}, WM);
check("an ACOG hides the gun's scope and sits on the rail", acog.hidden && acog.sight && acog.key === "acog" && acog.sightY > 0.033, JSON.stringify(acog));

// 5. everyone else: the LOD1, one node, no parts, no second scope
const lod = await page.evaluate(async (WM) => {
  const { buildWeaponMesh } = await import(WM);
  const g = buildWeaponMesh(window.__trollOps.currentWeapon().def, { lod: 1 });
  const meshes = [];
  g.traverse((o) => { if (o.isMesh && o.name.startsWith("HB_")) meshes.push(o); });
  let tris = 0, other = 0;
  for (const o of meshes) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
  g.traverse((o) => { if (o.isMesh && !o.name.startsWith("HB_")) { let h = false; for (let p = o; p; p = p.parent) if (p.userData.hand) h = true; if (!h) other++; } });
  return { lod: g.userData.lod, nodes: meshes.length, tris, parts: !!g.userData.gunParts, other, key: g.userData.scopeKey,
    map: meshes[0]?.material?.map?.source?.data?.width ?? null };
}, WM);
check("everyone else gets the LOD1: one node, no moving parts, about 6k tris, no second scope",
  lod.lod === 1 && lod.nodes === 1 && !lod.parts && lod.tris < 8000 && lod.other === 0 && lod.key === "scope8", JSON.stringify(lod));
await page.evaluate(() => window.__trollOps.toggleThirdPerson());
await sleep(1500);
await shot(page, "ballista-2-3p.png");
await page.evaluate(() => window.__trollOps.toggleThirdPerson());

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
