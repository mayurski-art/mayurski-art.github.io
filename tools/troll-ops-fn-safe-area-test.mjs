// Troll Warfare's lobby keeps clear of a phone's notch, rounded corners and
// home bar (user, 2026-10-28: an iPhone 13 Pro turned sideways cut the
// left side off, in Safari's desktop-site mode too). Chromium is given an
// iPhone's safe-area insets (Emulation.setSafeAreaInsetsOverride) at each
// size the phone shows the lobby at, and every visible control on the Play
// page, the Locker and All modes must sit inside them.
//   1. Sideways (844x390, the notch's 47 px both sides, the home bar 21).
//   2. Safari's desktop-site mode on that phone (1688x780, the insets
//      scaled the same way).
//   3. Upright (390x844: 47 top, 34 bottom).
//   4. A desktop with no insets: the 28 px gutter, as before.
// Screenshots: .claude/run/safe-*.png
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-fn-safe-area-test.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, ".claude/run");
fs.mkdirSync(SHOTS, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".webm": "video/webm" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const errors = [];
// what has to stay clear: the lobby's own controls (not the backdrop, not
// the operator's 3D view, which may run under the notch)
const CONTROLS = ".to-fn-top > *, .to-fn-left > *, .to-fn-play, .to-fn-allmodes, .to-bo2-foot .to-bo2-online, .to-bo2-foot .to-char-emote, .to-bo2-foot .to-bo2-chat, .to-bo2-party-row, .to-bo2-menu .tr-menu-item, .to-fn-tile, .to-fn-modes-x, .to-radio-toggle";

const CASES = [
  { name: "sideways", w: 844, h: 390, insets: { top: 0, left: 47, right: 47, bottom: 21 } },
  { name: "desktop-site", w: 1688, h: 780, insets: { top: 0, left: 94, right: 94, bottom: 42 } },
  { name: "upright", w: 390, h: 844, insets: { top: 47, left: 0, right: 0, bottom: 34 } },
  { name: "desktop", w: 1280, h: 720, insets: null },
];
for (const c of CASES) {
  const ctx = await browser.newContext({ viewport: { width: c.w, height: c.h }, hasTouch: c.name !== "desktop" });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${c.name}: ${e.message}`));
  if (c.insets) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: c.insets });
  }
  await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__toBo2?.fn, null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  const env = await page.evaluate(() => {
    const d = document.createElement("div");
    d.style.cssText = "position:fixed;left:env(safe-area-inset-left,0px);top:env(safe-area-inset-top,0px);width:1px;height:1px";
    document.body.appendChild(d);
    const r = d.getBoundingClientRect(); d.remove();
    return { left: r.left, top: r.top };
  });
  if (c.insets) check(Math.abs(env.left - c.insets.left) < 1 && Math.abs(env.top - c.insets.top) < 1, `${c.name}: the insets reach the page`, JSON.stringify(env));
  const ins = c.insets || { top: 0, left: 0, right: 0, bottom: 0 };
  for (const screen of ["main", "modes", "locker"]) {
    if (screen === "modes") await page.evaluate(() => window.__toBo2.fn.openModes(true));
    if (screen === "locker") { await page.evaluate(() => window.__toBo2.fn.openModes(false)); await page.evaluate(() => window.__toBo2.fn.goTab("locker")); }
    await page.waitForTimeout(700);
    const out = await page.evaluate(([sel, ins, W, H]) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent && getComputedStyle(e).visibility !== "hidden" && e.getBoundingClientRect().width > 0)
      .map((e) => {
        // what shows of it: clipped to the list it scrolls in
        const r = e.getBoundingClientRect(), box = e.closest(".to-fn-tiles, .tr-menu-groups")?.getBoundingClientRect();
        const c = box ? { l: Math.max(r.left, box.left), t: Math.max(r.top, box.top), r: Math.min(r.right, box.right), b: Math.min(r.bottom, box.bottom) } : { l: r.left, t: r.top, r: r.right, b: r.bottom };
        return { el: e.className.toString().split(" ")[0] || e.tagName, l: Math.round(c.l), t: Math.round(c.t), r: Math.round(c.r), b: Math.round(c.b) };
      })
      .filter((r) => r.r > r.l && r.b > r.t)
      // (an item scrolled out of its list is the list's business, not the edge's)
      .filter((r) => r.b > 0 && r.t < H)
      .filter((r) => r.l < ins.left - 0.5 || r.r > W - ins.right + 0.5 || r.b > H - ins.bottom + 0.5 || r.t < ins.top - 0.5), [CONTROLS, ins, c.w, c.h]);
    // the menu lists scroll inside their panel: an item below the panel's own bottom isn't on show
    const shown = out.filter((r) => !(screen === "locker" && r.el === "tr-menu-item" && r.b > c.h - ins.bottom));
    check(!shown.length, `${c.name} ${screen}: every control inside the safe area`, JSON.stringify(shown.slice(0, 6)));
    if (screen !== "modes") await page.screenshot({ path: path.join(SHOTS, `safe-${c.name}-${screen}.png`) });
  }
  if (c.name === "desktop") {
    const left = await page.evaluate(() => { window.__toBo2.fn.goTab("play"); return null; });
    await page.waitForTimeout(600);
    const l = await page.evaluate(() => Math.round(document.querySelector(".to-fn-left").getBoundingClientRect().left));
    check(l === 28, "desktop with no insets: the 28 px gutter as before", String(l));
  }
  await ctx.close();
}
check(errors.length === 0, "no page errors", errors.join(" | "));
console.log(fails ? `${fails} FAILED` : "ALL PASS");
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
