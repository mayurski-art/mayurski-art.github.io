// Menu size as a button on the main menu's top right (user, 2026-10-31:
// "that should be a button on the top right of the main menu"; it was
// Options > Menu size). On the user's laptop size, an upright and a sideways
// phone: the button shows the size it's at, each press steps 100 > 90 > 80
// > 70 > 100 (view/ui-scale.js --menu-z, kept per device), it sits in the
// top-right row overlapping nothing, no text overlaps, and Options no
// longer has the row. Supabase blocked, no room.
//
//   node tools/troll-ops-menu-size-btn-test.mjs     SHOTS_DIR=<dir> for shots
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
const PHONE = { hasTouch: true, isMobile: true, deviceScaleFactor: 2 };

const src = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/menu/menu-bo2.js"), "utf8");
check(!/label: "Menu size"/.test(src), "Options has no Menu size row any more");

const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });
for (const [name, vp, more] of [["laptop", { width: 1365, height: 632 }, {}], ["phone", { width: 390, height: 844 }, PHONE], ["phone-side", { width: 844, height: 390 }, PHONE]]) {
  const ctx = await browser.newContext({ viewport: vp, ...more });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1&season=off`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__toBo2?.fn && !!document.querySelector(".to-fn-msz"), null, { timeout: 180000 });
  await sleep(800);
  await page.evaluate(() => document.querySelectorAll(".tf-toast-x").forEach((x) => x.click()));
  await sleep(400);
  const look = () => page.evaluate(() => {
    const b = document.querySelector(".to-fn-msz"), r = b.getBoundingClientRect();
    // the other buttons up there: Friends, level, picture, the radio
    const others = [...document.querySelectorAll(".to-fn-me > *, .to-radio-toggle, .to-fn-tabs")].filter((e) => e !== b && e.getBoundingClientRect().width > 0);
    const hits = others.filter((e) => { const o = e.getBoundingClientRect(); return o.left < r.right - 1 && o.right > r.left + 1 && o.top < r.bottom - 1 && o.bottom > r.top + 1; }).map((e) => e.className.baseVal ?? e.className);
    const hit = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
    return { label: b.textContent.trim(), aria: b.getAttribute("aria-label"), z: getComputedStyle(document.documentElement).getPropertyValue("--menu-z").trim(),
      saved: localStorage.getItem("trollops:menu-scale"), shown: r.width > 30 && r.top >= 0 && r.top < 80 && r.left >= document.querySelector(".to-fn-tabs").getBoundingClientRect().right - 1,   // the top row, right of the tabs
      onTop: !!hit && b.contains(hit), hits, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] };
  });
  const a = await look();
  check(a.shown && a.label === "100%", `${name}: the button is up in the top right, reading 100%`, JSON.stringify(a));
  check(a.onTop && !a.hits.length, `${name}: nothing overlaps it`, JSON.stringify(a.hits));
  await scanText(page, (ok, what, extra) => check(ok, `${name} 100%: ${what}`, extra), `${name} 100`);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `msz-${name}-100.png`) });
  const seen = [];
  for (let i = 0; i < 4; i++) {
    await page.click(".to-fn-msz");
    await sleep(300);
    const s = await look();
    seen.push(`${s.label}/${s.z}/${s.saved}`);
    if (s.label === "70%") {
      check(s.onTop && !s.hits.length, `${name} 70%: nothing overlaps it`, JSON.stringify(s.hits));
      await scanText(page, (ok, what, extra) => check(ok, `${name} 70%: ${what}`, extra), `${name} 70`);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `msz-${name}-70.png`) });
    }
  }
  check(seen.join(" ") === "90%/0.9/0.9 80%/0.8/0.8 70%/0.7/0.7 100%/1/1", `${name}: each press a size smaller, back to 100% after 70%, saved`, seen.join(" "));
  check(!errors.length, `${name}: no page errors`, errors.slice(0, 3).join(" | "));
  await ctx.close();
}
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "MENU SIZE BUTTON GREEN");
process.exit(fails ? 1 : 0);
