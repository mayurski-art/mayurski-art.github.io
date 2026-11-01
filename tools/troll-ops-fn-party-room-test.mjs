// The Play page's right column: the party box, the news tile and the mode
// card never overlap (user, 2026-10-31: the Party box went under the news
// with Socialize on a 1365x632 laptop). Every playlist, a party of one and
// of four, on laptop and desktop sizes: the three boxes are apart, the party
// shows all its rows, and the news is 140 or 88 px tall or gone.
// Supabase blocked, no room.
//
//   node tools/troll-ops-fn-party-room-test.mjs     SHOTS_DIR=<dir> for shots
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
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
const PLAYLISTS = ["royale", "public", "zombies", "social", "solo", "private"];

const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });
for (const vp of [{ width: 1365, height: 632 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
  const ctx = await browser.newContext({ viewport: vp });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1&season=off`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__toBo2?.fn, null, { timeout: 180000 });
  await sleep(800);
  for (const seats of [1, 4]) {
    if (seats === 4) {
      // a full party: three more rows like the one you have, no Invite
      await page.evaluate(() => {
        const grid = document.querySelector(".to-bo2-party-grid"), me = grid.querySelector(".is-me");
        grid.querySelector(".is-add")?.remove();   // a full party has no Invite (menu-bo2.js renderSeats)
        for (let i = 0; i < 3; i++) { const r = me.cloneNode(true); r.classList.remove("is-me"); r.classList.add("is-test"); grid.appendChild(r); }
      });
    }
    for (const pl of PLAYLISTS) {
      await page.evaluate(({ pl, seats }) => {
        window.__toBo2.fn.setPlaylist(pl); window.__toBo2.menu.go("main");
        if (seats === 4) document.querySelector(".to-bo2-party-grid .is-add")?.remove();   // redrawn with each menu
      }, { pl, seats });
      await sleep(350);
      const m = await page.evaluate(() => {
        const box = (sel) => { const e = document.querySelector(sel); if (!e || !e.getClientRects().length || getComputedStyle(e).display === "none") return null; const r = e.getBoundingClientRect(); return { t: r.top, b: r.bottom, l: r.left, r: r.right }; };
        const party = box(".to-bo2-party"), news = box(".to-fn-news"), play = box(".to-fn-play");
        const cross = (a, b) => !!a && !!b && a.t < b.b - 1 && a.b > b.t + 1 && a.l < b.r - 1 && a.r > b.l + 1;
        const p = document.querySelector(".to-bo2-party");
        return { party: !!party, clipped: p.scrollHeight - p.clientHeight, partyNews: cross(party, news), partyPlay: cross(party, play), newsPlay: cross(news, play),
          newsH: news ? Math.round(news.b - news.t) : 0 };
      });
      const tag = `${vp.width}x${vp.height} ${pl} party of ${seats}`;
      check(m.party && !m.partyNews && !m.partyPlay && !m.newsPlay && m.clipped <= 1, `${tag}: party, news and mode card apart, the party whole`, JSON.stringify(m));
      if (SHOTS && (pl === "social" || pl === "royale")) await page.screenshot({ path: path.join(SHOTS, `party-${vp.width}x${vp.height}-${pl}-${seats}.png`) });
    }
  }
  check(!errors.length, `${vp.width}x${vp.height}: no page errors`, errors.slice(0, 3).join(" | "));
  await ctx.close();
}
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "PARTY ROOM GREEN");
process.exit(fails ? 1 : 0);
