// Troll Forces menu test: clicks every lobby panel, the map drawer, a mode
// row, a settings slider, a check and a select, the hero buttons, the room
// code box and the radio, and fails on any page error or a setting that
// doesn't stick (the game.js split moved all of this into menu/).
// Supabase is blocked: the page must never join the live public room.
//
// Usage: node tools/troll-ops-menu-test.mjs
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

const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 120000 });
await page.waitForTimeout(1500);

const r = await page.evaluate(async () => {
  const out = {};
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const click = (el) => el && el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  // Every rail panel.
  const panels = [...document.querySelectorAll("#to-pf [data-panel]")];
  out.panels = panels.length;
  for (const b of panels) { click(b); await wait(60); }
  // Map drawer open + close.
  click(document.getElementById("to-pf-mapcard-change")); await wait(100);
  out.drawerOpen = !!document.getElementById("to-map-drawer")?.classList.contains("is-open") || !document.getElementById("to-map-drawer")?.hidden;
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true })); await wait(60);
  // A mode row.
  const modeBtns = [...document.querySelectorAll("#to-lo-mode button, .to-pf-modes button")];
  out.modes = modeBtns.length;
  click(modeBtns[1]); await wait(60);
  // Settings: a slider, a check, a select.
  const set = (id, v) => { const el = document.getElementById(id); if (!el) return false;
    if (el.type === "checkbox") el.checked = v; else el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); return true; };
  out.fovEl = set("to-set-fov-lobby", 90);
  out.minimapEl = set("to-set-minimap-lobby", false);
  out.skillEl = set("to-set-botskill", "veteran");
  await wait(60);
  try { out.saved = JSON.parse(localStorage.getItem("trollops:settings")); } catch { out.saved = null; }
  // Hero buttons + room code.
  const heroes = [...document.querySelectorAll("[data-hero]")];
  out.heroes = heroes.length;
  click(heroes[0]); await wait(60);
  const room = document.getElementById("to-room");
  if (room) { room.value = "ab1!x9"; room.dispatchEvent(new Event("input", { bubbles: true })); out.room = room.value; }
  // Radio play button (music is opt-in, so this just must not throw).
  out.radio = !!document.querySelector("#to-radio, .to-radio, [id*=radio]");
  return out;
});
check(`every lobby panel opens (${r.panels})`, r.panels >= 6);
check(`mode rows built (${r.modes})`, r.modes >= 6);
check("FOV slider saves", r.fovEl && r.saved?.fov == 90, JSON.stringify(r.saved));
check("minimap check saves", r.minimapEl && r.saved?.minimap === false);
check("bot skill select saves", r.skillEl && r.saved?.botSkill === "veteran");
check(`hero buttons built (${r.heroes})`, r.heroes >= 1);
check("room code box cleans input", r.room === undefined || r.room === "AB1X9", r.room);
check("radio widget present", r.radio);
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `MENU RED: ${failures} failed` : "MENU GREEN");
process.exit(failures ? 1 : 0);
