// Bots are always Veteran (user, 2026-10-31: "Difficulty needs to be Veteran
// at baseline. There should not be any bot skill option"). A device that
// saved Recruit under the old Bot skill picker loads, the picker and its
// note are gone, the saved key is dropped on the next save, and a TDM
// match's bots are all built Veteran with the +10% XP boost.
// Supabase is blocked: the page never joins the live public room.
//
// Usage: node tools/troll-ops-bot-veteran-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };

const src = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/menu/menu-bo2.js"), "utf8");
check("Options has no Bot skill row", !/Bot skill/.test(src));

const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.route(/supabase/, (r) => r.abort());
await page.addInitScript(() => {
  if (!sessionStorage.getItem("bv-seeded")) {
    sessionStorage.setItem("bv-seeded", "1");
    localStorage.setItem("trollops:settings", JSON.stringify({ botSkill: "recruit", fov: 80 }));
  }
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 120000 });

const lobby = await page.evaluate(async () => {
  const T = window.__trollOps;
  const fov = document.getElementById("to-set-fov-lobby");   // any change saves the settings
  fov.value = 80; fov.dispatchEvent(new Event("input", { bubbles: true })); fov.dispatchEvent(new Event("change", { bubbles: true }));
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem("trollops:settings")); } catch { /* */ }
  return { setting: T.settings.botSkill, difficulty: T.bots.difficulty, picker: !!document.getElementById("to-set-botskill"),
    note: !!document.getElementById("to-set-botskill-note"), savedSkill: saved?.botSkill, savedFov: saved?.fov,
    text: /Bot skill/.test(document.body.innerHTML) };
});
check("an old saved Recruit is dropped, the other settings kept", lobby.setting === undefined && lobby.savedSkill === undefined && lobby.savedFov === 80, JSON.stringify(lobby));
check("no Bot skill picker or note in the page", !lobby.picker && !lobby.note && !lobby.text);
check("the bot manager starts Veteran", lobby.difficulty === "veteran", lobby.difficulty);

await page.evaluate(async () => {
  const T = window.__trollOps;
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = false;
  T.loadout.mapId = "grinsite";
  await T.startGame();
  if (T.isStaging()) T.endStaging();
});
await page.waitForFunction(() => window.__trollOps.state() === "playing" && window.__trollOps.bots.bots.length > 0, null, { timeout: 120000 });
await page.waitForTimeout(3000);
const match = await page.evaluate(() => {
  const T = window.__trollOps;
  return { skills: T.bots.bots.map((b) => b.skill), room: T.roomBotSkill(), hit: T.bots.bots[0]?.diff?.hit, net: !!T.net?.active };
});
check(`every bot in a TDM match is Veteran (${match.skills.length})`, match.skills.length > 0 && match.skills.every((s) => s === "veteran"), match.skills.join(","));
check("the room reads Veteran (the +10% XP boost's tier)", match.room === "veteran", match.room);
check("Veteran's numbers (hit 0.55)", match.hit === 0.55, match.hit);
check("no page errors", !errors.length, errors.slice(0, 3).join(" | "));

await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "BOT VETERAN GREEN");
process.exit(failures ? 1 : 0);
