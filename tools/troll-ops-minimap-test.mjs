// The minimap shows in a match: canvas#to-minimap is on screen, visible
// (no hidden attribute, no visibility:hidden from an ancestor class like
// to-intro-on left behind), inside the viewport, and drawn (the map base
// plus our arrow), on several maps and modes and on a phone. The "Show
// minimap" setting hides it and brings it back.
//
// Private rooms only, Supabase blocked.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-minimap-test.mjs
//        CASES=tdm:grinsite,royale:trollface   (default: all four below)

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
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// [mode, map, phone]
const CASES = process.env.CASES
  ? process.env.CASES.split(",").map((c) => { const [m, map, phone] = c.split(":"); return [m, map, phone === "phone"]; })
  : [["tdm", "grinsite", false], ["ffa", "culdegrin", false], ["royale", "trollface", false], ["tdm", "depot", true]];

const browser = await chromium.launch({ args: ["--use-angle=d3d11",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });

async function runCase([mode, mapId, phone]) {
  const label = `${mode} ${mapId}${phone ? " (phone)" : ""}`;
  const ctx = await browser.newContext(phone
    ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1280, height: 720 } });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
  await page.evaluate(async ({ mode, mapId, room }) => {
    const T = window.__trollOps;
    T.setMode(mode);
    if (T.els.noBots) T.els.noBots.checked = true;
    T.els.room.value = room;                       // never the public room
    T.els.room.dispatchEvent(new Event("input"));
    T.loadout.mapId = mapId;
    await T.startGame();
  }, { mode, mapId, room: "MINI" + Math.floor(Math.random() * 900 + 100) });
  const t0 = Date.now();
  while (Date.now() - t0 < 240000 && await page.evaluate(() => window.__trollOps.loadState().open)) await sleep(250);
  // Past the staging clock and the TDM intro (which hides the HUD on purpose).
  const t1 = Date.now();
  while (Date.now() - t1 < 40000 && await page.evaluate(() => window.__trollOps.loadState().staging || document.body.classList.contains("to-intro-on"))) await sleep(500);
  await sleep(1500);

  const read = () => page.evaluate(() => {
    const c = document.getElementById("to-minimap");
    const cs = getComputedStyle(c);
    const r = c.getBoundingClientRect();
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let drawn = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]) drawn++;
    let hiddenBy = null;
    for (let e = c; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (e.hidden || s.display === "none" || +s.opacity === 0) { hiddenBy = `${e.tagName}#${e.id}`; break; }
    }
    return { hidden: c.hidden, vis: cs.visibility, hiddenBy, rect: [r.left, r.top, r.width, r.height].map(Math.round),
      vw: innerWidth, vh: innerHeight, drawn, px: c.width * c.height, body: document.body.className,
      map: window.__trollOps.builtMap()?.map?.name, setting: window.__trollOps.settings.minimap };
  });
  const s = await read();
  check(`${label}: on ${s.map}, the setting defaults on`, s.setting === true, String(s.setting));
  check(`${label}: not hidden`, !s.hidden && !s.hiddenBy && s.vis === "visible", `hidden=${s.hidden} by=${s.hiddenBy} visibility=${s.vis} body="${s.body}"`);
  const [x, y, w, h] = s.rect;
  check(`${label}: on screen`, w >= 60 && h >= 60 && x >= 0 && y >= 0 && x + w <= s.vw && y + h <= s.vh, s.rect.join(","));
  check(`${label}: drawn`, s.drawn > s.px * 0.05, `${s.drawn} of ${s.px} px`);
  if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, `minimap-${mode}-${mapId}${phone ? "-phone" : ""}.png`) });

  // The "Show minimap" checkbox (pause copy) hides it and brings it back.
  const toggled = await page.evaluate(() => {
    const box = document.getElementById("to-set-minimap");
    const c = document.getElementById("to-minimap");
    box.checked = false; box.dispatchEvent(new Event("change"));
    const off = getComputedStyle(c).display === "none";
    box.checked = true; box.dispatchEvent(new Event("change"));
    const on = getComputedStyle(c).display !== "none";
    return { off, on };
  });
  check(`${label}: Show minimap off hides it, on shows it`, toggled.off && toggled.on, JSON.stringify(toggled));
  check(`${label}: no page errors`, errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

for (const c of CASES) await runCase(c);
await browser.close();
server.close();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
