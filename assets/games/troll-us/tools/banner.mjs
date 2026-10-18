// Troll Us: renders the arcade card and share banner (1200x630) from the web build itself: six Crewmates posed
// round the emergency table. The share banner carries the wordmark; the arcade card's copy doesn't, because the
// card puts its category tag in that corner and its own title underneath.
//   node assets/games/troll-us/tools/banner.mjs      writes assets/games/troll-us/ui/troll-us-{banner,card}.jpg
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const PORT = 5207;
const OUT = path.join(ROOT, 'assets/games/troll-us/ui/troll-us-banner.jpg');
const CARD = path.join(ROOT, 'assets/games/troll-us/ui/troll-us-card.jpg');
mkdirSync(path.dirname(OUT), { recursive: true });

const server = spawn(process.execPath, [path.join(ROOT, 'tools/static-serve.mjs'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.route(/supabase\.co/, (r) => r.abort()); // never touch the live backend from a test page
  await page.goto(`http://localhost:${PORT}/trollus.html?bots=0&cam=0,5,-40&look=0,3,-30&fov=50`);
  await page.waitForFunction(() => window.TU?.ready, null, { timeout: 30000 });
  await page.evaluate(() => {
    const T = window.TU;
    const cam = [1.5, 5.6, -46.5], tgt = [-0.5, 2.9, -29.5];
    // a spot `along` studs down the view and `right` studs to its right
    let dx = tgt[0] - cam[0], dz = tgt[2] - cam[2];
    const l = Math.hypot(dx, dz); dx /= l; dz /= l;
    const at = (along, right) => ({ x: cam[0] + dx * along - dz * right, z: cam[2] + dz * along + dx * right });
    const away = Math.atan2(-dx, -dz) * 180 / Math.PI; // the yaw that faces down the view
    const beans = [
      { suit: 'Red', hat: 'Top Hat', ...at(9, 3.2), turn: -18 },
      { suit: 'Blue', hat: 'Wizard Hat', ...at(12.5, -4.4), yaw: away - 130, s: 0.9 },
      { suit: 'Lime', hat: 'Crown', ...at(22.5, -1.6), turn: 6 },
      { suit: 'Yellow', hat: 'Cowboy Hat', ...at(21.5, 3.6), turn: -12 },
      { suit: 'Pink', hat: 'Beanie', ...at(17.5, -8.8), turn: -5, s: -0.6 },
      { suit: 'Orange', hat: 'Bandana', ...at(15, 9.2), yaw: away + 140, s: 0.7 },
    ];
    for (const b of beans) {
      const bean = T.buildBean(T.rig, { suit: T.rules.suitColors[b.suit], hat: b.hat, hats: T.hats });
      // facing the camera, turned by `turn`, unless a yaw is given
      const yaw = b.yaw != null ? b.yaw * Math.PI / 180 : Math.atan2(-(cam[0] - b.x), -(cam[2] - b.z)) + (b.turn || 0) * Math.PI / 180;
      bean.group.position.set(b.x, 0, b.z);
      bean.group.rotation.y = yaw;
      if (b.s) { const dt = 0.001; bean.waddle.phase = Math.asin(b.s) - dt * 2.4 * Math.PI * 2; T.waddle(bean, dt, 1); }
      T.scene.add(bean.group);
    }
    T.setCam(cam, tgt, 50);
    T.scene.fog = null;
    // the wordmark
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = 'https://fonts.googleapis.com/css2?family=Luckiest+Guy&display=block';
    document.head.append(link);
    const mark = document.createElement('div');
    mark.id = 'mark';
    mark.textContent = 'TROLL US';
    mark.style.cssText = 'position:fixed;left:40px;top:26px;font:72px/1 "Luckiest Guy",Impact,sans-serif;color:#fff;letter-spacing:2px;' +
      '-webkit-text-stroke:3px #1b1c22;paint-order:stroke fill;text-shadow:0 6px 0 #1b1c22,0 10px 18px rgba(0,0,0,.45);z-index:9';
    document.body.append(mark);
  });
  // the stylesheet has to arrive before the font can be asked for
  await page.waitForFunction(() => [...document.styleSheets].some((x) => x.href?.includes('Luckiest')), null, { timeout: 15000 });
  await page.evaluate(async () => { await document.fonts.load('72px "Luckiest Guy"'); await document.fonts.ready; });
  if (!(await page.evaluate(() => document.fonts.check('72px "Luckiest Guy"')))) throw new Error('Luckiest Guy did not load');
  await page.waitForTimeout(1500); // the trollface texture
  await page.evaluate(() => window.TU.render());
  await page.screenshot({ path: OUT, type: 'jpeg', quality: 88 });
  console.log('wrote ' + path.relative(ROOT, OUT));
  await page.evaluate(() => { document.getElementById('mark').remove(); window.TU.render(); });
  await page.screenshot({ path: CARD, type: 'jpeg', quality: 88 });
  console.log('wrote ' + path.relative(ROOT, CARD));
} finally {
  await browser.close();
  server.kill();
}
