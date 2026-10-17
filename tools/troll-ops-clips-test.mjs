// Roblox Studio clips (characters/clips.js): the converter's round trip, and
// the clips in the body. The sprint clip leans a free-handed runner without
// touching the legs; the gun sprint carries every long gun with both hands
// still on it (grip and handguard) through the whole stride, and gives the
// gun back the moment it's aimed or fired.
//
// Usage: node tools/troll-ops-clips-test.mjs   (needs Playwright)

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require(path.join(process.execPath, "../../lib/node_modules/playwright"))); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml" };
const PAGE = `<!doctype html><meta charset="utf-8"><script type="importmap">
{"imports":{"three":"/assets/vendor/three.module.min.js","three/addons/":"/assets/vendor/addons/"}}</script>`;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__clips.html") { res.writeHead(200, { "content-type": "text/html" }); return res.end(PAGE); }
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

try {
  execFileSync(process.execPath, [path.join(ROOT, "tools/troll-ops-roblox-anim.mjs"), "selftest"], { stdio: "pipe" });
  check("converter: CFrame rows -> quaternion round trip under 1 degree", true);
} catch (e) {
  check("converter: CFrame rows -> quaternion round trip under 1 degree", false, String(e.stdout || e.message).trim());
}

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/__clips.html`);
const r = await page.evaluate(async () => {
  const THREE = await import("three");
  const C = await import("/assets/games/troll-ops/characters/character.js");
  const CL = await import("/assets/games/troll-ops/characters/clips.js?v=rc1");
  const WM = await import("/assets/games/troll-ops/weapons/weapon-model.js");
  const { WEAPON_DEFS } = await import("/assets/games/troll-ops/weapons/weapons.js");
  try { await WM.preloadWeaponModels(); } catch {}
  const sprint = await CL.loadClip("sprint"), sprintGun = await CL.loadClip("sprint-gun");
  const rate = C.gaitPhaseRate(7.02);
  const run = (rig, extra = {}, frames = 80, each) => {
    let ph = 0;
    for (let i = 0; i < frames; i++) {
      ph += rate * 0.016;
      C.poseHumanoid(rig, { phase: ph, moving: true, speed: 1, mps: 7.02, dt: 0.016, ...extra });
      if (each && i >= 30) { rig.root.updateMatrixWorld(true); each(); }
    }
  };
  const out = {};

  // Free hands: the clip leans the runner; the legs are the gait's own.
  const mk = () => C.buildHumanoid(new THREE.MeshBasicMaterial(), { height: 1.8, gun: false });
  const a = mk(), b = mk();
  CL.setRigClips(a, null);   // every rig gets the game's clips: this one runs without
  CL.setRigClips(b, { sprint });
  run(a, { hold: "none" });
  run(b, { hold: "none" });
  out.leanPlain = a.parts.torso.rotation.x;
  out.leanClip = b.parts.torso.rotation.x;
  out.legSame = ["kneeL", "kneeR"].every((n) => Math.abs(a.parts[n].rotation.x - b.parts[n].rotation.x) < 0.25);

  // Every long gun, both hands on it, the whole stride.
  out.guns = 0; out.worst = 0; out.bad = []; out.off = [];
  for (const id of Object.keys(WEAPON_DEFS)) {
    const rig = mk();
    const mesh = WM.stripLights(WM.buildWeaponMesh(WEAPON_DEFS[id]));
    C.mountHeldWeapon(rig, mesh);
    const u = mesh.userData;
    if (u.pistol || !u.supportHandPos || u.akimbo) continue;
    out.guns++;
    CL.setRigClips(rig, { "sprint-gun": sprintGun });
    let worst = 0, on = true;
    const hr = new THREE.Vector3(), hl = new THREE.Vector3();
    run(rig, { hold: "gun", hasGun: true }, 80, () => {
      on = on && !!rig.clipGun;
      rig.parts.wristR.getWorldPosition(hr); rig.parts.wristL.getWorldPosition(hl);
      worst = Math.max(worst, hr.distanceTo(mesh.localToWorld(u.gripPos.clone())), hl.distanceTo(mesh.localToWorld(u.supportHandPos.clone())));
    });
    if (!on) out.off.push(id);
    out.worst = Math.max(out.worst, worst);
    if (worst > 0.02) out.bad.push(`${id} ${worst.toFixed(3)} m`);
  }

  // Aimed: the gun points on the aim again, as with no clip (the clip's
  // lean still moves the body under it).
  const aim = (withClip, extra) => {
    const rig = mk();
    const mesh = WM.stripLights(WM.buildWeaponMesh(WEAPON_DEFS.lmao));
    C.mountHeldWeapon(rig, mesh);
    CL.setRigClips(rig, withClip ? { "sprint-gun": sprintGun } : null);
    run(rig, { hold: "gun", hasGun: true, ...extra }, 60);
    rig.root.updateMatrixWorld(true);
    return new THREE.Vector3(0, 0, -1).transformDirection(rig.parts.gunMount.matrixWorld);
  };
  // Every game rig wears the game's clips (they load with clips.js).
  for (let i = 0; i < 50 && !(CL.GAME_CLIPS.sprint && CL.GAME_CLIPS["sprint-gun"]); i++) await new Promise((r) => setTimeout(r, 100));
  const g = mk();
  out.gameRig = !!(g.clips?.sprint && g.clips?.["sprint-gun"]);
  // A bot at its 4.2 m/s top speed, told it's sprinting, plays the gun sprint;
  // a player at 5.2 m/s (a run, not a sprint) doesn't.
  const gunRig = () => { const r = mk(); C.mountHeldWeapon(r, WM.stripLights(WM.buildWeaponMesh(WEAPON_DEFS.lmao))); return r; };
  const bot = gunRig(), runner = gunRig();
  for (let i = 0; i < 40; i++) {
    C.poseHumanoid(bot, { phase: i * 0.1, moving: true, speed: 1, mps: 4.2, sprint: 1, dt: 0.016, hold: "gun", hasGun: true });
    C.poseHumanoid(runner, { phase: i * 0.1, moving: true, speed: 1, mps: 5.2, dt: 0.016, hold: "gun", hasGun: true });
  }
  out.botSprints = !!bot.clipGun;
  out.runnerRuns = !runner.clipGun;
  out.adsGap = aim(true, { ads: 1 }).angleTo(aim(false, { ads: 1 }));
  out.carryGap = aim(true, {}).angleTo(aim(false, {}));
  return out;
});

check("sprint clip leans the runner further forward", r.leanClip < r.leanPlain - 0.05, `torso ${r.leanPlain.toFixed(2)} -> ${r.leanClip.toFixed(2)} rad`);
check("sprint clip leaves the legs to the gait", r.legSame);
check(`gun sprint plays on every long gun (${r.guns})`, r.guns > 20 && !r.off.length, r.off.join(", "));
check("both hands stay on the gun through the stride", !r.bad.length, r.bad.length ? r.bad.join(", ") : `worst ${r.worst.toFixed(3)} m`);
check("the sprint carry turns the gun off the aim", r.carryGap > 0.3, `${r.carryGap.toFixed(2)} rad`);
check("aiming puts the gun back on the aim", r.adsGap < 0.04, `${r.adsGap.toFixed(3)} rad`);
check("every game rig wears the sprint clips", r.gameRig);
check("a bot's full run plays the gun sprint", r.botSprints);
check("a player's run (5.2 m/s) doesn't", r.runnerRuns);
check("no page errors", !errors.length, errors.join(" | "));

await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
