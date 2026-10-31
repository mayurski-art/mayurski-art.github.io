// Troll Royale, the jump out of the C-130, phase 1 (modes/royale-exit.js,
// docs/ROYALE-EXIT.md): the show's clock and the body's poses, on the exit
// lab page (labs/exit-lab.html, no game, no network).
//   - the clock: on time to the slow-mo, 0.3x through it, caught up by
//     2.6 s, never running backwards or jumping;
//   - the poses: arms flung wide in the spin, the hands meeting at the
//     middle of the chest in the tuck, the dive tuck in flight, every pose
//     turning about the belly;
//   - a contact sheet: tools/.pose-shots/royale-exit.png.
//
//   NODE_PATH=<main checkout>/node_modules node tools/troll-ops-royale-exit-test.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOTS_DIR || path.join(ROOT, "tools", ".pose-shots");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".glb": "model/gltf-binary" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 720 } });
await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };

await page.goto(`${BASE}/assets/games/troll-ops/labs/exit-lab.html`);
await page.waitForFunction(() => window.exitLab?.ready, null, { timeout: 30000 });
await page.waitForTimeout(800);
check(errors.length === 0, "lab loads without errors", errors.join(" | "));

// The clock.
const clk = await page.evaluate(() => {
  const { clock, EXIT } = window.exitLab, out = [];
  for (let r = 0; r <= 4.5; r += 0.01) out.push([+r.toFixed(2), clock(r)]);
  return { out, EXIT };
});
const at = (r) => clk.out.find((o) => Math.abs(o[0] - r) < 1e-6)[1];
const E = clk.EXIT;
check(Math.abs(at(0.2) - 0.2) < 1e-6, "on time before the slow-mo", at(0.2));
check(Math.abs((at(1.5) - at(0.5)) - E.rate) < 1e-3, "0.3x through the look back", (at(1.5) - at(0.5)).toFixed(3));
check(Math.abs(at(2.6) - 2.6) < 1e-6 && Math.abs(at(3.3) - 3.3) < 1e-6, "caught up by 2.6 s", `${at(2.6)} ${at(3.3)}`);
let mono = true, jump = 0;
for (let i = 1; i < clk.out.length; i++) {
  const d = clk.out[i][1] - clk.out[i - 1][1];
  if (d < -1e-9) mono = false;
  jump = Math.max(jump, d);
}
check(mono, "never runs backwards");
check(jump < 0.04, "never jumps (no step over 4x real time)", jump.toFixed(4));

// The poses (columns: 0.12, 0.3, 1.2, 2.6, 3.3, 3.75, 4.2, dive).
const J = await page.evaluate(() => window.exitLab.joints());
const col = (c) => J.find((j) => j.col === c);
console.log(JSON.stringify(J));
check(col("1.2").wrists > 1.3, "spin: arms flung wide (wrist to wrist)", col("1.2").wrists);
check(col("0.3").wrists > 1.2, "off the lip: arms already out", col("0.3").wrists);
check(col("3.3").wrists < 0.2, "tuck: the hands meet", col("3.3").wrists);
check(col("3.3").handsToChest < 0.32 && col("3.3").handsFront > 0.05, "tuck: at the middle of the chest, in front of it", `${col("3.3").handsToChest} / ${col("3.3").handsFront}`);
check(col("3.75").headY < 0.6, "dive: head down", col("3.75").headY);
check(col("dive").wrists < 0.2 && col("dive").handsFront > 0.05, "dive in flight: hands tucked at the chest", `${col("dive").wrists} / ${col("dive").handsFront}`);
check(J.filter((j) => j.col !== "dive").every((j) => j.belly < 0.02), "turns about the belly", J.map((j) => j.belly).join(" "));

fs.mkdirSync(SHOTS, { recursive: true });
await page.screenshot({ path: path.join(SHOTS, "royale-exit.png") });
console.log("sheet:", path.join(SHOTS, "royale-exit.png"));
check(errors.length === 0, "no page errors", errors.join(" | "));
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
