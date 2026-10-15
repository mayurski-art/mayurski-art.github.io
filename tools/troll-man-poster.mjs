// Renders the Troll Man poster (1200x1700) and share banner (1200x630) from
// tools/troll-man-poster.html, using the game's own icons and a live maze shot.
//   node tools/troll-man-poster.mjs
// writes assets/games/troll-man/ui/troll-man-poster.jpg and troll-man-banner.jpg
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 5206;
const UI = path.join(ROOT, "assets/games/troll-man/ui");

const server = spawn(process.execPath, [path.join(ROOT, "tools/static-serve.mjs"), String(PORT)], { stdio: "ignore" });
await new Promise(r => setTimeout(r, 900));
const browser = await chromium.launch();
try {
  // 1. borrow the icons and a few seconds of the attract demo from the game itself
  const game = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await game.goto(`http://localhost:${PORT}/troll-man.html?debug`);
  await game.waitForFunction(() => window.__tm);
  await game.evaluate(() => document.fonts.ready);
  await game.evaluate(() => { window.__tm.setTimeScale(3); window.__tm.startDemo(); });
  await game.waitForTimeout(2600);
  await game.waitForFunction(() => Math.floor(window.__tm.stateTime / 0.5) % 2 === 0);   // PRESS START showing
  const ART = await game.evaluate(() => {
    const t = window.__tm, icons = {};
    for (const k of ["pump", "stonks", "fomo", "aster", "coin"]) icons[k] = t.iconFor(k).toDataURL();
    return { icons, maze: t.canvas.toDataURL() };
  });
  await game.close();

  // 2. lay out each piece and screenshot it
  for (const [layout, w, h, file] of [["poster", 1200, 1700, "troll-man-poster.jpg"], ["banner", 1200, 630, "troll-man-banner.jpg"]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.addInitScript(a => { window.ART = a; }, ART);
    await page.goto(`http://localhost:${PORT}/tools/troll-man-poster.html?layout=${layout}`);
    await page.waitForFunction(() => window.READY, null, { timeout: 15000 });
    await page.locator("#art").screenshot({ path: path.join(UI, file), type: "jpeg", quality: 90 });
    console.log(`wrote ${file} (${w}x${h})`);
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
