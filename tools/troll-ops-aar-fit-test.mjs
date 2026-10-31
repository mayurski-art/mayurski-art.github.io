// The match summary fits the screen without scrolling (user, 2026-10-31:
// "Users shouldn't have to scroll up and down on the match summary").
// Renders the after-action report for a made-up TDM, at its fullest: four
// gun cards, eight medals, the next-map vote and both buttons, then for
// every screen size and every tab measures that the game-over screen has
// nothing to scroll, the card sits inside the screen and both buttons can be
// clicked, plus the no-overlap text scan. One headless tab per device,
// Supabase blocked, never a room.
//
//   node tools/troll-ops-aar-fit-test.mjs        SHOTS_DIR=<dir> for a shot per size
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
const BASE = `http://localhost:${server.address().port}`;
let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sample = {
  title: "Phantom win", won: true, ffa: false, modeName: "Team Deathmatch", mapName: "Dust Bowl",
  teams: { mine: { name: "Phantom", score: 75, color: "#7fd1e0" }, theirs: { name: "Ghost", score: 62, color: "#f5b82e" } },
  rank: { levelBefore: 12, fracBefore: 0.82, levelAfter: 13, fracAfter: 0.15, prestige: 0, gained: 455, xpText: "4,120 / 5,200 XP", boosted: true },
  weapons: [
    { id: "kek", before: 90, after: 265, gained: 175, kills: 7 },
    { id: "lol", before: 0, after: 60, gained: 60, kills: 2 },
    { id: "problem416", before: 1000, after: 1035, gained: 35, kills: 1 },
    { id: "rofl", before: 400, after: 410, gained: 10, kills: 0 },
  ],
  stats: { score: 2450, kills: 10, deaths: 6, assists: 3, headshots: 2, bestStreak: 5, seconds: 492, shotsFired: 240, shotsHit: 84 },
  boardHtml: `<div class="to-sb-team"><div class="to-sb-head"><span style="color:#7fd1e0">Phantom · 75</span><span>K</span><span>D</span><span>A</span><span>K/D</span></div>`
    + Array.from({ length: 6 }, (_, i) => `<div class="to-sb-row${i ? "" : " is-you"}"><span>${i ? "bot" : "aar_tester (you)"}</span><span>${10 - i}</span><span>6</span><span>3</span><span>1.67</span></div>`).join("") + `</div>`
    + `<div class="to-sb-team"><div class="to-sb-head"><span style="color:#f5b82e">Ghost · 62</span><span>K</span><span>D</span><span>A</span><span>K/D</span></div>`
    + Array.from({ length: 6 }, (_, i) => `<div class="to-sb-row"><span>bot</span><span>${8 - i}</span><span>7</span><span>2</span><span>1.14</span></div>`).join("") + `</div>`,
  counts: { kill: 10, death: 6, assist: 3 },
  events: [{ kind: "kill", x: 0, z: 0, from: { x: -8, z: 5 }, weapon: "kek", head: true, t: 5 }],
  arena: { minX: -40, maxX: 40, minZ: -40, maxZ: 40 },
  colliders: [{ min: { x: -5, y: 0, z: -5 }, max: { x: 5, y: 3, z: 5 } }],
};
const MEDALS = ["Double Kill", "Triple Kill", "Headshot", "Longshot", "Revenge", "Payback", "First Blood", "Bloodthirsty"];

const DEVICES = [
  { name: "desktop", ctx: {}, sizes: [[1920, 1080], [1366, 768], [1280, 720], [1024, 600]] },
  { name: "phone", ctx: { hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, sizes: [[844, 390], [667, 375], [390, 844], [375, 667], [430, 932]] },
];

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
for (const dev of DEVICES) {
  const [w0, h0] = dev.sizes[0];
  const ctx = await browser.newContext({ ...dev.ctx, viewport: { width: w0, height: h0 } });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps && !!window.__trollAar, null, { timeout: 180000 });
  await page.evaluate(async ({ d, medals }) => {
    const { medalSvg } = await import("/assets/games/troll-ops/progression/medals.js?v=to-medals3-or1");
    const T = window.__trollOps;
    T.els.title.hidden = true;
    document.querySelectorAll(".to-bo2").forEach((m) => { m.style.display = "none"; });
    document.getElementById("to-gameover").hidden = false;
    window.__trollAar.renderAfterAction(d);
    // the fullest card: medals and the next-map vote under the report
    const box = document.getElementById("to-go-medals");
    box.hidden = false;
    // as match-end.js renderMatchMedals draws them: the medal, its count on it
    box.querySelector("ul").innerHTML = medals.map((m, i) => `<li class="to-go-medal" title="${m}"><span class="to-go-medal-icon">${medalSvg(m)}</span><b aria-hidden="true">×${i % 3 + 1}</b></li>`).join("");
    const bonus = box.querySelector(".to-go-medal-bonus"); bonus.hidden = false; bonus.textContent = "Medal bonus +850";
    document.getElementById("to-intermission").hidden = false;
    document.getElementById("to-vote-list").innerHTML = ["culdegrin", "grinsite", "dustbowl"].map((id, i) =>
      `<button type="button" class="to-vote-opt${i ? "" : " is-mine"}"><img class="to-vote-img" src="assets/games/troll-ops/ui/maps/culdegrin-1280.webp" alt="">`
      + `<span class="to-vote-row"><span class="to-vote-name">${["Cul-de-Grin", "Grinsite", "Dust Bowl"][i]}</span><span class="to-vote-n">${i ? "" : "1 vote"}</span></span></button>`).join("");
  }, { d: sample, medals: MEDALS });
  await sleep(2800);   // the bars finish moving

  for (const [w, h] of dev.sizes) {
    await page.setViewportSize({ width: w, height: h });
    for (const tab of ["summary", "board", "map"]) {
      await page.evaluate((t) => document.querySelector(`.to-aar-tab[data-tab="${t}"]`).click(), tab);
      await sleep(400);
      const m = await page.evaluate(() => {
        const s = document.getElementById("to-gameover"), inner = s.querySelector(".to-gameover-inner");
        const sr = s.getBoundingClientRect(), ir = inner.getBoundingClientRect();
        const btn = (id) => { const r = document.getElementById(id).getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), on: r.top >= -1 && r.bottom <= innerHeight + 1 && r.height > 20 }; };
        return { scroll: s.scrollHeight - s.clientHeight, top: Math.round(ir.top - sr.top), bottom: Math.round(sr.bottom - ir.bottom),
          right: Math.round(sr.right - ir.right), left: Math.round(ir.left - sr.left),
          fit: getComputedStyle(inner).zoom, retry: btn("to-retry-btn"), home: btn("to-go-home-btn"),
          font: parseFloat(getComputedStyle(document.querySelector(".to-aar-tab")).fontSize) * (+getComputedStyle(inner).zoom || 1) };
      });
      const tag = `${dev.name} ${w}x${h} ${tab}`;
      check(m.scroll <= 1 && m.top >= -1 && m.bottom >= -1 && m.left >= -1 && m.right >= -1, `${tag}: nothing to scroll, the card inside the screen`,
        `scroll ${m.scroll}px, gaps top ${m.top} bottom ${m.bottom} left ${m.left} right ${m.right}, fit ${m.fit}`);
      check(m.retry.on && m.home.on, `${tag}: both buttons on screen`, JSON.stringify([m.retry, m.home]));
      if (tab === "summary") {
        check(m.font >= 9, `${tag}: the tabs stay readable`, `${m.font.toFixed(1)}px`);
        // nothing else on the page (the radio, a corner button) on top of the card
        const over = await page.evaluate(() => {
          const card = document.querySelector("#to-gameover .to-gameover-inner"), r = card.getBoundingClientRect(), hit = new Set();
          for (let y = r.top + 2; y < r.bottom - 1; y += 8) for (let x = r.left + 2; x < r.right - 1; x += 8) {
            const el = document.elementFromPoint(x, y);
            if (el && !el.closest("#to-gameover")) {
              const t = el.closest("[id]") || el;
              hit.add(t.id ? "#" + t.id : t.className || t.tagName);
            }
          }
          return [...hit];
        });
        check(!over.length, `${tag}: nothing else on top of the card`, over.join(", "));
        await scanText(page, (ok, what, extra) => check(ok, `${tag}: ${what}`, extra), tag);
        if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `aar-fit-${dev.name}-${w}x${h}.png`) });
      }
    }
  }
  check(!errors.length, `${dev.name}: no page errors`, errors.slice(0, 3).join(" | "));
  await ctx.close();
}
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "AAR FIT GREEN");
process.exit(fails ? 1 : 0);
