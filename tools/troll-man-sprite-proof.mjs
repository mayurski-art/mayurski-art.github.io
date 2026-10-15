// Renders tools/troll-man-sprite-proof.html to a PNG for approval.
//   node tools/troll-man-sprite-proof.mjs [out.png]
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2] || path.join(ROOT, "assets/games/troll-man/sprite-proof.png");
const PORT = 5196;

const server = spawn(process.execPath, [path.join(ROOT, "tools/static-serve.mjs"), String(PORT)], { stdio: "ignore" });
await new Promise(r => setTimeout(r, 700));
try {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 1000 }, deviceScaleFactor: 1 });
  page.on("console", m => console.log("[page]", m.text()));
  await page.goto(`http://localhost:${PORT}/tools/troll-man-sprite-proof.html`);
  await page.waitForFunction(() => window.__done, null, { timeout: 15000 });
  const done = await page.evaluate(() => window.__done);
  if (done !== true) throw new Error(String(done));
  await page.locator("#c").screenshot({ path: OUT });
  console.log("wrote", OUT);
  // the 32px sprites themselves, one PNG each
  const sprites = await page.evaluate(() => window.__sprites || {});
  const dir = path.join(ROOT, "assets/games/troll-man/sprites"); fs.mkdirSync(dir, { recursive: true });
  for (const [name, url] of Object.entries(sprites)) {
    fs.writeFileSync(path.join(dir, `${name}-32.png`), Buffer.from(url.split(",")[1], "base64"));
    console.log("wrote sprites/" + name + "-32.png");
  }
  // and an 8x (256px) copy of each, easy to look at or hand to another tool for touch-ups
  const big = await page.evaluate(async () => {
    const out = {};
    for (const [name, url] of Object.entries(window.__sprites)) {
      const img = new Image(); img.src = url; await img.decode();
      const c = document.createElement("canvas"); c.width = c.height = 256;
      const x = c.getContext("2d"); x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, 256, 256);
      out[name] = c.toDataURL("image/png");
    }
    return out;
  });
  for (const [name, url] of Object.entries(big)) {
    fs.writeFileSync(path.join(dir, `${name}-32-x8.png`), Buffer.from(url.split(",")[1], "base64"));
  }
  await browser.close();
} finally { server.kill(); }
