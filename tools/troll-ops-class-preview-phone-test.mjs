// Troll Forces Create a Class on phones (user, 2026-10-17: "I can't see the
// preview images on mobile"): on every screen that shows the gun stage, the
// gun preview canvas is on screen, a real size, and clear of the detail pane,
// sideways and upright.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-class-preview-phone-test.mjs [outDir]
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2] || null;
if (OUT) fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });
const sizes = (process.env.SIZES || "844x390,667x375,390x844,360x780").split(",");
let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };

// The gun canvas's box, and whether it overlaps the open detail pane.
const gunBox = (page) => page.evaluate(() => {
  const v = document.getElementById("to-gun-view");
  const r = v?.getBoundingClientRect();
  const d = [...document.querySelectorAll(".to-bo2-detail")].find((e) => getComputedStyle(e).display !== "none");
  const dr = d?.getBoundingClientRect();
  const cs = v ? getComputedStyle(v) : null;
  const overlap = r && dr && !d.contains(v) ? Math.max(0, Math.min(r.bottom, dr.bottom) - Math.max(r.top, dr.top)) * Math.max(0, Math.min(r.right, dr.right) - Math.max(r.left, dr.left)) : 0;
  return {
    shown: !!v && cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0,
    w: Math.round(r?.width || 0), h: Math.round(r?.height || 0), top: Math.round(r?.top || 0), bottom: Math.round(r?.bottom || 0),
    inView: !!r && r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1,
    overlap: Math.round(overlap),
  };
});

const clickItem = async (page, label) => {
  // On a phone a row opens on its second tap (the first highlights it).
  const el = page.locator(".to-bo2-menu .tr-menu-item", { hasText: label }).first();
  await el.tap(); await page.waitForTimeout(150); await el.tap();
  await page.waitForTimeout(900);
};

for (const sz of sizes) {
  const [w, h] = sz.split("x").map(Number);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
  await page.waitForTimeout(2500);
  await clickItem(page, "Create a Class");
  let b = await gunBox(page);
  if (OUT) await page.screenshot({ path: path.join(OUT, `classlist-${sz}.png`) });
  check(b.shown && b.w >= 120 && b.h >= 90 && b.inView, `${sz} class list: gun preview on screen`, JSON.stringify(b));
  check(b.overlap === 0, `${sz} class list: preview clear of the detail pane`, JSON.stringify(b));
  // Into the first class: the class screen also stages the gun.
  const first = page.locator(".to-bo2-menu .tr-menu-item").first();
  await first.tap(); await page.waitForTimeout(150); await first.tap();
  await page.waitForTimeout(900);
  b = await gunBox(page);
  const title = await page.locator(".to-bo2-menu .tr-menu-title").first().textContent();
  if (OUT) await page.screenshot({ path: path.join(OUT, `class-${sz}.png`) });
  check(/class/i.test(title || ""), `${sz} reached a class screen`, title);
  check(b.shown && b.w >= 120 && b.h >= 90 && b.inView, `${sz} class: gun preview on screen`, JSON.stringify(b));
  check(b.overlap === 0, `${sz} class: preview clear of the detail pane`, JSON.stringify(b));
  await ctx.close();
}
console.log(fails ? `${fails} FAILED` : "ALL PASS");
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
