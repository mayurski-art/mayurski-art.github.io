// Third-person gun hold, every gun: each weapon in weapons.js (so any gun
// added later too) is built, mounted on a body and posed at the ready,
// firing, scoped and mid-reload. It must ride the chest mount (two-handed,
// never the old one-handed forearm mount) with the right hand on its grip
// and the left on its handguard (or wrapped round a pistol's grip).
// User, 2026-10-04: "third person shooting should apply to all weapons even
// the ones that will be added".
//
// Usage: node tools/troll-ops-3p-hold-test.mjs   (needs Playwright)

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require(path.join(process.execPath, "../../lib/node_modules/playwright"))); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif" };
const PAGE = `<!doctype html><meta charset="utf-8"><script type="importmap">
{"imports":{"three":"/assets/vendor/three.module.min.js","three/addons/":"/assets/vendor/addons/"}}</script>`;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__hold.html") { res.writeHead(200, { "content-type": "text/html" }); return res.end(PAGE); }
  const p = path.join(ROOT, decodeURIComponent(url.pathname));
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

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/__hold.html`);
const rows = await page.evaluate(async () => {
  const THREE = await import("three");
  const C = await import("/assets/games/troll-ops/character.js");
  const WM = await import("/assets/games/troll-ops/weapon-model.js");
  const { WEAPON_DEFS } = await import("/assets/games/troll-ops/weapons.js");
  try { await WM.preloadWeaponModels(); } catch {}
  const out = [];
  const v = () => new THREE.Vector3();
  for (const id of Object.keys(WEAPON_DEFS)) {
    const rig = C.buildHumanoid(new THREE.MeshBasicMaterial(), { height: 1.8, gun: false });
    const mesh = WM.stripLights(WM.buildWeaponMesh(WEAPON_DEFS[id]));
    C.mountHeldWeapon(rig, mesh);
    const u = mesh.userData;
    const row = { id, mount: mesh.parent === rig.parts.gunMount, worst: 0, worstL: 0, poses: {} };
    const poses = { ready: {}, firing: { fired: 0.1 }, scoped: { ads: 1 }, reload: { reload: 0.05 } };
    for (const [name, extra] of Object.entries(poses)) {
      for (let i = 0; i < 40; i++) C.poseHumanoid(rig, { hold: "gun", hasGun: true, dt: 0.016, pitch: 0, ...extra });
      rig.root.updateMatrixWorld(true);
      const grip = mesh.localToWorld(u.gripPos.clone());
      // A pair (akimbo) puts the left hand on the left gun's own grip.
      const sup = u.akimbo ? mesh.localToWorld(u.gripPosL.clone())
        : u.supportHandPos && !u.pistol ? mesh.localToWorld(u.supportHandPos.clone())
        : mesh.localToWorld(u.gripPos.clone().add(new THREE.Vector3(-0.05, -0.025, 0.005)));
      const hR = rig.parts.handR.getWorldPosition(v()), hL = rig.parts.handL.getWorldPosition(v());
      // Left hand: on the gun, i.e. on the line from the grip to the support
      // point (the arm is short; on a long gun it stops where it can reach).
      const seg = new THREE.Line3(grip, sup), onLine = v();
      seg.closestPointToPoint(hL, true, onLine);
      const dR = hR.distanceTo(grip), dL = hL.distanceTo(onLine);
      row.poses[name] = [+dR.toFixed(3), +dL.toFixed(3)];
      row.worst = Math.max(row.worst, dR);
      if (name !== "reload") row.worstL = Math.max(row.worstL, dL);
    }
    out.push(row);
  }
  // A gun added later with no grip marked at all (a bare model): the body
  // still holds it in both hands (character.js inferGrip).
  {
    const rig = C.buildHumanoid(new THREE.MeshBasicMaterial(), { height: 1.8, gun: false });
    const mesh = new THREE.Group();
    const m = new THREE.MeshBasicMaterial();
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.5), m);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.3, 8), m);
    barrel.rotation.x = Math.PI / 2; barrel.position.z = -0.38;
    mesh.add(receiver, barrel);
    C.mountHeldWeapon(rig, mesh);
    for (let i = 0; i < 40; i++) C.poseHumanoid(rig, { hold: "gun", hasGun: true, dt: 0.016, fired: 0.1 });
    rig.root.updateMatrixWorld(true);
    const grip = mesh.localToWorld(mesh.userData.gripPos.clone());
    out.push({ id: "unmarked future gun", mount: mesh.parent === rig.parts.gunMount,
      worst: rig.parts.handR.getWorldPosition(v()).distanceTo(grip), worstL: 0, poses: {} });
  }
  return out;
});
check("weapons.js has guns to check", rows.length >= 20, `${rows.length} guns`);
for (const r of rows) {
  // Right hand on the grip; left on the gun between grip and handguard.
  check(`${r.id}: two-handed, hands on the gun`, r.mount && r.worst < 0.03 && r.worstL < 0.04,
    `mount ${r.mount ? "chest" : "FOREARM"}  R ${r.worst.toFixed(3)} m  L ${r.worstL.toFixed(3)} m  ${JSON.stringify(r.poses)}`);
}
check("no page errors", errors.length === 0, errors.join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
