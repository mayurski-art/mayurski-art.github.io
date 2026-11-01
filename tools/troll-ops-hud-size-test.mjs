// Options > HUD size (user, 2026-10-31: "Add a slider for HUD layout"): a
// 70%..130% slider that scales the HUD's readouts (style.css --hud-z), saved
// with the other settings. At 70, 100 and 130, on a desktop and a sideways
// and upright phone: each readout is that much bigger, still on screen, no
// text overlaps; a piece moved in the layout editor lands on the same spot
// at any size. Supabase blocked, no match, no room.
//
//   node tools/troll-ops-hud-size-test.mjs        SHOTS_DIR=<dir> for shots
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { textClash as scanText } from "./troll-ops-text-scan.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOTS_DIR;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PIECES = ["to-minimap", "to-hud-gear", "hud-health", "hud-ammo"];
const PHONE = { hasTouch: true, isMobile: true, deviceScaleFactor: 2 };

const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });
for (const [name, vp, more] of [["desktop", { width: 1280, height: 720 }, {}], ["phone-side", { width: 844, height: 390 }, PHONE], ["phone", { width: 390, height: 844 }, PHONE]]) {
  const ctx = await browser.newContext({ viewport: vp, ...more });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
  // the HUD up on its own, the menu out of the way (no match needed)
  await page.evaluate(() => {
    const T = window.__trollOps;
    T.els.title.hidden = true;
    document.querySelectorAll(".to-bo2").forEach((m) => { m.style.display = "none"; });
    T.els.hud.hidden = false;
    document.getElementById("to-killfeed").innerHTML = `<div class="to-kf-row"><span>aar_tester</span> <span>MTAR</span> <span>bot</span></div>`;
  });
  const set = (v) => page.evaluate((v) => {
    const el = document.getElementById("to-set-hudsize-lobby");
    el.value = v; el.dispatchEvent(new Event("input", { bubbles: true }));
  }, v);
  const read = (ids) => page.evaluate((ids) => Object.fromEntries(ids.map((id) => {
    const r = document.getElementById(id).getBoundingClientRect();
    return [id, { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, on: r.width > 0 && r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 }];
  })), ids);
  const ids = await page.evaluate((ids) => ids.filter((id) => { const e = document.getElementById(id); return e && e.getBoundingClientRect().width > 0; }), PIECES);
  await set(100); await sleep(200);
  const base = await read(ids);
  for (const v of [70, 130, 100]) {
    await set(v); await sleep(250);
    const now = await read(ids);
    const saved = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("trollops:settings")).hudScale; } catch { return null; } });
    const ratios = ids.map((id) => +(now[id].w / base[id].w).toFixed(2));
    check(saved === v, `${name} ${v}%: saved with the settings`, String(saved));
    check(ratios.every((k) => Math.abs(k - v / 100) < 0.04), `${name} ${v}%: every readout is ${v}% of its size`, ids.map((id, i) => `${id} ${ratios[i]}`).join(", "));
    check(ids.every((id) => now[id].on), `${name} ${v}%: every readout on screen`, JSON.stringify(Object.fromEntries(ids.filter((id) => !now[id].on).map((id) => [id, now[id]]))));
    if (v !== 100) await scanText(page, (ok, what, extra) => check(ok, `${name} ${v}%: ${what}`, extra), `${name} ${v}`);
    if (SHOTS && v !== 100) await page.screenshot({ path: path.join(SHOTS, `hud-${name}-${v}.png`) });
  }
  // the layout editor: a moved minimap lands on the same spot at 100% and 130%
  const moved = await page.evaluate(async () => {
    const L = (await import("/assets/games/troll-ops/core/state.js?v=st1")).game.hudLayout;
    const el = document.getElementById("to-minimap");
    const at = () => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    const set = async (v) => { const s = document.getElementById("to-set-hudsize-lobby"); s.value = v; s.dispatchEvent(new Event("input", { bubbles: true })); await new Promise((r) => setTimeout(r, 150)); };
    const keep = { ...L.offsets };
    await set(100); L.offsets["to-minimap"] = [0, 0]; L.apply(); const a0 = at();
    L.offsets["to-minimap"] = [-0.1, 0.1]; L.apply(); const a1 = at();
    await set(130); L.offsets["to-minimap"] = [0, 0]; L.apply(); const b0 = at();
    L.offsets["to-minimap"] = [-0.1, 0.1]; L.apply(); const b1 = at();
    L.offsets = keep; L.apply(); await set(100);
    return { at100: [a1.x - a0.x, a1.y - a0.y], at130: [b1.x - b0.x, b1.y - b0.y], want: [-0.1 * innerWidth, 0.1 * innerHeight] };
  });
  const near = (p) => Math.abs(p[0] - moved.want[0]) < 3 && Math.abs(p[1] - moved.want[1]) < 3;
  check(near(moved.at100) && near(moved.at130), `${name}: a piece moved in the layout editor moves the same on-screen distance at any HUD size`, JSON.stringify(moved));
  check(!errors.length, `${name}: no page errors`, errors.slice(0, 3).join(" | "));
  await ctx.close();
}
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "HUD SIZE GREEN");
process.exit(fails ? 1 : 0);
