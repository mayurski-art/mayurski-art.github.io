// Troll Forces weapon swap (combat/weapons.js cycleWeapon, updateSwapButton):
// a tap of the touch SWAP button (or X, or the pad's Y) goes primary ->
// secondary (if there is one) -> melee -> primary, skipping an empty slot.
// User, 2026-10-13: on phones the swap did nothing. It only flipped primary
// and secondary, and only inside the PvP loop's pickup prompt, so the range,
// Zombies and the waves never swapped at all. Each mode in its own
// phone-sized touch tab, SOLO (no room code: never a public room), Supabase
// blocked.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-swap-test.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });

let fails = 0;
const check = (what, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };

async function boot(mode) {
  const ctx = await browser.newContext({ ...devices["iPhone 13 landscape"] });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/frame-ancestors|ERR_FAILED|supabase/i.test(m.text())) errors.push(m.text()); });
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
  await page.evaluate(async (mode) => {
    const T = window.__trollOps;
    T.els.room.value = "";
    if (T.els.noBots) T.els.noBots.checked = true;
    T.setMode(mode);
    await T.startGame();
    if (T.isStaging?.()) T.endStaging();
  }, mode);
  await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open && window.__trollOps.player.alive, null, { timeout: 180000 });
  // past the pre-match staging (the match loop holds still in it)
  await page.waitForFunction(() => { const T = window.__trollOps; if (T.isStaging?.()) T.endStaging(); return !T.isStaging?.(); }, null, { timeout: 60000, polling: 250 });
  await page.waitForTimeout(2000);
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, errors, cdp };
}

for (const mode of ["range", "tdm", "zombies"]) {
  const { ctx, page, errors, cdp } = await boot(mode);
  check(`${mode}: the touch layer is up`, await page.evaluate(() => !document.getElementById("to-touch").hidden));
  const sb = await page.locator("#to-touch-swap").boundingBox();
  const tapSwap = async () => {
    const x = sb.x + sb.width / 2, y = sb.y + sb.height / 2;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 5 }] });
    await page.waitForTimeout(90);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(450);
  };
  const slot = () => page.evaluate(() => {
    const T = window.__trollOps, p = T.player;
    if (p.holding !== "gun") return p.holding;
    return p.secondaryId && p.secondaryId !== p.weaponId && T.currentWeapon() === p.weapons[p.secondaryId] ? "secondary" : "primary";
  });
  const run = async (label, want) => {
    const got = [await slot()];
    for (let i = 0; i < want.length - 1; i++) { await tapSwap(); got.push(await slot()); }
    check(`${mode}: ${label}: ${want.join(" -> ")}`, got.join() === want.join(), got.join(" -> "));
  };
  const hasSec = await page.evaluate(() => { const p = window.__trollOps.player; return !!(p.secondaryId && p.weapons[p.secondaryId]); });
  await run("the swap button", hasSec ? ["primary", "secondary", "melee", "primary"] : ["primary", "melee", "primary"]);
  if (hasSec) {
    // no secondary (Gun Game, One in the Chamber): primary <-> melee, not a dead button
    const sec = await page.evaluate(() => { const p = window.__trollOps.player, s = p.secondaryId; p.secondaryId = null; return s; });
    await run("no secondary", ["primary", "melee", "primary"]);
    await page.evaluate((s) => { window.__trollOps.player.secondaryId = s; }, sec);
  }
  if (mode === "range") {
    // a tap of X does the same; the pad's Y calls the same cycle
    const x = await page.evaluate(async () => {
      const T = window.__trollOps, out = [];
      const { game } = await import("/assets/games/troll-ops/core/state.js?v=st1");
      for (let i = 0; i < 3; i++) {
        game.keys.add("KeyX"); await new Promise((r) => setTimeout(r, 80));
        game.keys.delete("KeyX"); await new Promise((r) => setTimeout(r, 300));
        out.push(T.player.holding);
      }
      for (let i = 0; i < 3; i++) { game.cycleWeapon(); await new Promise((r) => setTimeout(r, 300)); out.push(T.player.holding); }
      return out;
    });
    check("range: X then the pad cycle the same way", x.join() === "gun,melee,gun,gun,melee,gun", x.join());
  }
  check(`${mode}: no page errors`, errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close();
server.close();
console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
process.exit(fails ? 1 : 0);
