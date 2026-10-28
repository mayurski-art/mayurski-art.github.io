// Troll Forces: the trollface reticle (view/troll-reticle.js). Locked under
// level 10 (the Locker's Reticle row says so), then picked there and worn
// by every optic: the reflex aimed in shows the troll fist instead of its
// dot, and "get trolled" while an enemy's hit volume is lined up in the
// sights; off again, the dot is back. Troll Royale's sniper rifles wear it
// whatever the level; nothing else in Royale does without it unlocked.
// Private TDM room, no bots.
//
// Usage: node tools/troll-ops-troll-reticle-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

// the game's own copy of troll-reticle.js (its tag from weapon-view.js)
const tag = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/view/weapon-view.js"), "utf8").match(/troll-reticle\.js\?v=([\w-]+)/)[1];

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__trollOps && !!window.__toBo2, null, { timeout: 120000 });

// ---- the rules, and the Locker row, for a guest (level 1)
const rules = await page.evaluate(async (tag) => {
  const R = await import(`/assets/games/troll-ops/view/troll-reticle.js?v=${tag}`);
  const T = window.__trollOps;
  const sniper = { def: { cls: "sniper" } }, ar = { def: { cls: "assault" } };
  localStorage.setItem("trollops:reticle", "troll");
  const out = { guestUnlocked: R.trollReticleUnlocked(), guestAr: R.trollReticleOn(ar, true) };
  window.__toBo2.menu.go("locker");
  await new Promise((r) => setTimeout(r, 200));
  const rowText = () => [...document.querySelectorAll("button")].find((b) => b.offsetParent && b.textContent.trim().startsWith("Reticle"));
  out.lockedRow = rowText()?.textContent.trim();
  out.lockedDisabled = rowText()?.disabled || rowText()?.getAttribute("aria-disabled") === "true" || rowText()?.classList.contains("is-disabled");
  const mode = T.modeId;
  T.setMode("royale");
  out.royaleSniper = R.trollReticleOn(sniper, true);
  out.royaleAr = R.trollReticleOn(ar, true);
  out.royaleIron = R.trollReticleOn(sniper, false);
  T.setMode(mode || "tdm");
  // level 12
  const A = window.TrollrunnerAccounts || (window.TrollrunnerAccounts = {});
  A.getCachedProfile = () => ({ username: "reticle-test", level: 12, xp: 9000 });
  out.l12Unlocked = R.trollReticleUnlocked();
  out.l12Ar = R.trollReticleOn(ar, true);
  window.__toBo2.menu.go("cosmetics"); window.__toBo2.menu.go("locker");
  await new Promise((r) => setTimeout(r, 200));
  out.openRow = rowText()?.textContent.trim();
  localStorage.removeItem("trollops:reticle");
  out.offAr = R.trollReticleOn(ar, true);
  localStorage.setItem("trollops:reticle", "troll");
  return out;
}, tag);
check("a guest (level 1) hasn't unlocked it, even picked", !rules.guestUnlocked && !rules.guestAr, JSON.stringify(rules));
check("Locker: a Reticle row, locked on Classic", /^Reticle\s*Classic/.test(rules.lockedRow || "") && rules.lockedDisabled, rules.lockedRow);
check("Troll Royale: a sniper's scope wears it at any level, an AR doesn't, irons never", rules.royaleSniper && !rules.royaleAr && !rules.royaleIron, JSON.stringify(rules));
check("level 12: unlocked, and picked it's on every optic", rules.l12Unlocked && rules.l12Ar, JSON.stringify(rules));
check("level 12: the Locker row is open and shows it picked", /Reticle/.test(rules.openRow || "") && /Trollface/.test(rules.openRow || ""), rules.openRow);
check("Classic picked: off", rules.offAr === false);

// ---- in a match: an AR with a reflex, aimed in
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.loadout.weaponId = "trollboy";
  T.loadout.attachmentsFor("trollboy").optic = "reflex";
  T.loadout.mapId = "trollcity";
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  T.els.room.value = `TR${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
  T.els.room.dispatchEvent(new Event("input"));
  await T.startGame();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing", null, { timeout: 60000 });
await sleep(4000);
await page.evaluate(() => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); T.player.maxHp = T.player.hp = 1e9; T.switchWeapon("primary"); });
await sleep(800);
const shown = () => page.evaluate(() => {
  const vis = {};
  window.__trollOps.activeWeaponMesh().traverse((o) => { const k = o.userData.reticle; if (k) vis[k === true ? "frame" : k] = (vis[k === true ? "frame" : k] || false) || o.visible; });
  return vis;
});
const hip = await shown();
await page.evaluate(() => window.__trollOps.setAds(true));
await sleep(1200);
const idle = await shown();
await page.evaluate(() => {
  const T = window.__trollOps, THREE = T.THREE, cam = T.camera;
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1));
  box.position.copy(cam.getWorldPosition(new THREE.Vector3())).addScaledVector(cam.getWorldDirection(new THREE.Vector3()), 1.2);   // nearer than any wall in view
  box.updateMatrixWorld(true);
  T.remotes.__hm = T.remotes.hitMeshes;
  T.remotes.hitMeshes = () => [box];
});
await page.waitForFunction(() => {
  let on = false;
  window.__trollOps.activeWeaponMesh().traverse((o) => { if (o.userData.reticle === "troll-hit" && o.visible) on = true; });
  return on;
}, null, { timeout: 5000 }).catch(() => {});
const hit = await shown();
await page.evaluate(() => { const T = window.__trollOps; T.remotes.hitMeshes = T.remotes.__hm; });
await page.waitForFunction(() => {
  let on = false;
  window.__trollOps.activeWeaponMesh().traverse((o) => { if (o.userData.reticle === "troll-idle" && o.visible) on = true; });
  return on;
}, null, { timeout: 5000 }).catch(() => {});
const after = await shown();
await page.evaluate(() => localStorage.removeItem("trollops:reticle"));
await page.waitForFunction(() => {
  let on = false;
  window.__trollOps.activeWeaponMesh().traverse((o) => { if (o.userData.reticle === "classic" && o.visible) on = true; });
  return on;
}, null, { timeout: 5000 }).catch(() => {});
const classic = await shown();
check("from the hip, no reticle shows", !hip.classic && !hip["troll-idle"] && !hip["troll-hit"], JSON.stringify(hip));
check("aimed in: the troll fist, not the dot", idle["troll-idle"] && !idle.classic && !idle["troll-hit"], JSON.stringify(idle));
check("an enemy lined up: get trolled", hit["troll-hit"] && !hit["troll-idle"] && !hit.classic, JSON.stringify(hit));
check("the enemy gone: the fist again", after["troll-idle"] && !after["troll-hit"], JSON.stringify(after));
check("Classic picked: the reflex dot is back", classic.classic && !classic["troll-idle"] && !classic["troll-hit"], JSON.stringify(classic));

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "ALL PASS");
process.exit(failures ? 1 : 0);
