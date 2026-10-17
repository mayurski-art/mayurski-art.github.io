// Grin Sabers key art, rendered from the game itself: two trollfaces in a
// blade lock under the temple gate at sunset, grinning at the viewer, with
// the title laid over. Writes
//   assets/games/grin-sabers/ui/grin-sabers-banner.jpg  1200x630 (OG image, arcade card)
//   assets/games/grin-sabers/ui/grin-sabers-poster.jpg  1200x1700 (loading screen)
//   node tools/grin-sabers-poster.mjs
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 5235;
const OUT = path.join(ROOT, "assets/games/grin-sabers/ui");
fs.mkdirSync(OUT, { recursive: true });

const server = spawn(process.execPath, [path.join(ROOT, "tools/static-serve.mjs"), String(PORT)], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 700));

const SHOTS = [
  { file: "grin-sabers-banner.jpg", w: 1200, h: 630, cam: { camDist: 4.6, camY: 0.5, lookY: 1.25, fov: 40, shift: 1.25 }, layout: "banner" },
  { file: "grin-sabers-poster.jpg", w: 1200, h: 1700, cam: { camDist: 5.0, camY: 0.35, lookY: 1.55, fov: 52, shift: 0 }, layout: "poster" },
];

try {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  for (const s of SHOTS) {
    const page = await browser.newPage({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1 });
    page.on("pageerror", (e) => console.log("page error", String(e)));
    await page.addInitScript(() => { window.__gsHeadless = true; });
    await page.goto(`http://localhost:${PORT}/sabers.html?debug`);
    await page.waitForFunction(() => window.__gs && window.__gs.duel, null, { timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    const info = await page.evaluate(({ cam, layout }) => {
      const g = window.__gs;
      for (const id of ["gs-menu", "gs-mute", "gs-hud", "gs-loading"]) document.getElementById(id).hidden = true;
      g.manual(true);
      g.startDemo();
      g.skipIntro();
      g.step(0.6);
      const du = g.duel, a = du.a, b = du.b;
      du.bots.length = 0;
      a.showTag = b.showTag = false;
      a.saber.setColour("#3fa9ff"); a.trail.setColour("#3fa9ff");
      b.saber.setColour("#ff2a1a"); b.trail.setColour("#ff2a1a");
      // Side by side across the view, the gate behind them.
      const theta = -2.2, gap = 1.7, headTurn = -1.1;
      const vx = Math.cos(theta), vz = Math.sin(theta), px = -vz, pz = vx;
      a.pos.set(-px * gap / 2, 0, -pz * gap / 2); b.pos.set(px * gap / 2, 0, pz * gap / 2);
      a.yaw = Math.atan2(-px, -pz); b.yaw = Math.atan2(px, pz);
      for (const f of [a, b]) { f.state = "clash"; f.frozen = true; }
      g.step(0.5);
      // Blades forward and up, crossing high between them.
      for (const [f, o] of [[a, b], [b, a]]) {
        f.pose.g.set(0.12, -0.05, -0.42);
        f.pose.d.set(-0.15, 0.62, -0.77).normalize();
        f.pose.twist = 0.1; f.pose.lean = 0.25;
        f.state = "poster";
        f.saber.power = 1.5;
        f.applyPose(0, g.now, o);
      }
      // Both grin at the viewer.
      a.rig.parts.headPivot.rotation.y += headTurn;
      b.rig.parts.headPivot.rotation.y -= headTurn;
      a.rig.body.update(); b.rig.body.update();
      let best = 9, at = null;
      for (let i = 0; i <= 30; i++) for (let j = 0; j <= 30; j++) {
        const p = a.root1.clone().lerp(a.tip1, i / 30), q = b.root1.clone().lerp(b.tip1, j / 30);
        const d = p.distanceTo(q);
        if (d < best) { best = d; at = p.clone().lerp(q, 0.5); }
      }
      g.sparks.p.length = 0;
      for (let k = 0; k < 14; k++) g.sparks.burst(at, k % 2 ? "#9fd4ff" : "#ffb0a0", 14, 2.4);
      g.sparks.update(0.07);
      // shift: aim left of the pair, so they sit right of centre (the banner's title takes the left)
      g.holdCamera([-vx * cam.camDist, cam.camY, -vz * cam.camDist], [-px * cam.shift, cam.lookY, -pz * cam.shift], cam.fov);

      // The title.
      const t = document.createElement("div");
      t.id = "gs-key-title";
      const banner = layout === "banner";
      t.innerHTML = `
        <div class="k-logo">Grin${banner ? "<br>" : " "}<span>Sabers</span></div>
        <div class="k-tag">${banner ? "Saber duels for trollfaces.<br>Problem?" : "Read the swing. Block it. Bonk them."}</div>
        ${banner ? "" : `<div class="k-foot">trollrunner.net arcade</div>`}`;
      const st = document.createElement("style");
      st.textContent = `
        #gs-key-title { position: fixed; inset: 0; pointer-events: none; z-index: 99; font-family: "DM Sans", sans-serif; color: #fff;
          display: flex; flex-direction: column; align-items: ${banner ? "flex-start" : "center"}; justify-content: ${banner ? "center" : "flex-start"};
          padding: ${banner ? "0 0 0 64px" : "120px 0 0"}; }
        #gs-key-title::before { content: ""; position: absolute; left: 0; right: 0; ${banner ? "top: 0; bottom: 0; right: auto; width: 58%;" : "top: 0; height: 34%;"}
          background: linear-gradient(${banner ? "to right" : "to bottom"}, rgba(14,8,24,0.82), rgba(14,8,24,0)); }
        .k-logo { position: relative; font-weight: 800; font-size: ${banner ? 110 : 168}px; letter-spacing: -0.02em; line-height: 0.95;
          text-shadow: 0 0 30px rgba(255,60,40,0.65), 0 4px 0 rgba(0,0,0,0.35); }
        .k-logo span { color: #bfe3ff; text-shadow: 0 0 6px #fff, 0 0 26px #3fa9ff, 0 0 60px #3fa9ff; }
        .k-tag { position: relative; margin-top: ${banner ? 10 : 18}px; font-weight: 700; font-size: ${banner ? 28 : 40}px; color: rgba(255,240,230,0.92);
          letter-spacing: 0.01em; text-shadow: 0 2px 10px rgba(0,0,0,0.8); }
        .k-foot { position: absolute; bottom: 70px; font: 500 30px "DM Mono", monospace; letter-spacing: 0.22em; text-transform: uppercase;
          color: rgba(255,240,230,0.8); text-shadow: 0 2px 10px rgba(0,0,0,0.9); }
        ${banner ? "" : `#gs-key-title::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 18%; background: linear-gradient(to top, rgba(14,8,24,0.8), rgba(14,8,24,0)); }`}`;
      document.head.appendChild(st);
      document.body.appendChild(t);
      return { best };
    }, { cam: s.cam, layout: s.layout });
    // let a few frames render (the headless GPU is slow)
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT, s.file), type: "jpeg", quality: 88 });
    console.log(`wrote ${s.file} (blades cross within ${info.best.toFixed(3)} m)`);
    await page.close();
  }
  await browser.close();
} finally {
  server.kill();
}
