// Troll Man phase 6 test: the poster loading screen, the weekly board, OG tags, the hub card.
// Supabase is blocked, so nothing here touches the live leaderboard.
//   node tools/troll-man-p6-test.mjs [--shots]
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 5207;
const SHOTS = process.argv.includes("--shots");
const OUT = path.join(ROOT, ".claude/run");
const fails = [];
const check = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) fails.push(msg); };

// image size straight from the file header (jpeg SOF / png IHDR)
function imageSize(file) {
  const b = fs.readFileSync(file);
  if (b[0] === 0x89) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xc2) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

const server = spawn(process.execPath, [path.join(ROOT, "tools/static-serve.mjs"), String(PORT)], { stdio: "ignore" });
await new Promise(r => setTimeout(r, 900));
const browser = await chromium.launch();
const errors = [];

async function open(query, { touch = false, viewport = { width: 1280, height: 900 } } = {}) {
  const ctx = await browser.newContext({ viewport, isMobile: touch, hasTouch: touch, deviceScaleFactor: touch ? 2 : 1 });
  await ctx.route(/supabase\.co/, r => r.abort());
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && /Content Security Policy/i.test(m.text())) errors.push("CSP: " + m.text()); });
  await page.goto(`http://localhost:${PORT}/troll-man${query}`);
  await page.waitForFunction(() => window.__tm || document.readyState === "complete");
  return { page, ctx };
}
const shown = (page, sel) => page.evaluate(s => { const el = document.querySelector(s); return !!el && !el.hidden && el.getBoundingClientRect().height > 0; }, sel);
const tm = (page, fn) => page.evaluate(fn);

try {
  // ---- assets + OG tags ----------------------------------------------------------------
  {
    const ui = path.join(ROOT, "assets/games/troll-man/ui");
    const poster = imageSize(path.join(ui, "troll-man-poster.jpg")), banner = imageSize(path.join(ui, "troll-man-banner.jpg"));
    check(poster && poster.w === 1200 && poster.h === 1700, `poster is 1200x1700 (${JSON.stringify(poster)})`);
    check(banner && banner.w === 1200 && banner.h === 630, `banner is 1200x630 (${JSON.stringify(banner)})`);
    const html = fs.readFileSync(path.join(ROOT, "troll-man.html"), "utf8");
    const meta = p => (html.match(new RegExp(`(?:property|name)="${p}" content="([^"]+)"`)) || [])[1];
    check(meta("og:title") && meta("og:description") && meta("og:url") === "https://trollrunner.net/troll-man", "og:title, og:description, og:url");
    check(/^https:\/\/trollrunner\.net\/assets\/games\/troll-man\/ui\/troll-man-banner\.jpg(\?v=[\w-]+)?$/.test(meta("og:image") || "") && meta("twitter:card") === "summary_large_image", "og:image is the banner, absolute; large twitter card");
    check(!/\u{1F9CC}/u.test(html + fs.readFileSync(path.join(ROOT, "assets/games/troll-man/game.js"), "utf8")), "no troll emoji anywhere");
  }

  // ---- loading screen ----------------------------------------------------------------------
  {
    const { page, ctx } = await open("");
    check(await shown(page, "#tm-splash"), "the poster shows on a normal visit");
    await page.waitForFunction(() => document.getElementById("tm-splash").classList.contains("is-ready"), null, { timeout: 8000 });
    check(true, "it switches from LOADING to PRESS ANY KEY once loaded");
    const f = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, w: innerWidth, h: innerHeight, img: document.querySelector(".tm-splash img").getBoundingClientRect().toJSON() }));
    check(f.sw <= f.w && f.sh <= f.h && f.img.bottom <= f.h && f.img.height > 500, `desktop: poster fits, no scrolling (${Math.round(f.img.width)}x${Math.round(f.img.height)})`);
    if (SHOTS) await page.screenshot({ path: path.join(OUT, "tm-p6-splash.png") });
    await ctx.close();
  }
  {
    const { page, ctx } = await open("?debug");
    check(!(await shown(page, "#tm-splash")) && await tm(page, () => !window.__tm.splashOpen), "?debug skips the poster (older tests)");
    await ctx.close();
  }
  {
    const { page, ctx } = await open("?debug&splash");
    await page.waitForFunction(() => window.__tm.splashReady, null, { timeout: 8000 });
    // the corner buttons still work above it
    await page.click("#tm-mute");
    check(await tm(page, () => window.TMSound.muted) && await tm(page, () => window.__tm.splashOpen), "mute works while the poster is up");
    await page.click("#tm-mute");
    await page.waitForTimeout(20000 / 8);
    await page.keyboard.press("ArrowDown");
    let s = await tm(page, () => ({ open: window.__tm.splashOpen, state: window.__tm.state, sel: window.__tm.menuSel, audio: window.TMSound.running }));
    check(!s.open && s.state === "title" && s.sel === 0, `the first key only closes the poster (${JSON.stringify(s)})`);
    check(s.audio, "and switches the sound on");
    await page.waitForTimeout(300);
    check(!(await shown(page, "#tm-splash")), "the poster fades away");
    await page.keyboard.press("Enter");
    check(await tm(page, () => window.__tm.state) === "ready", "then Enter starts a game as usual");
    await ctx.close();
  }
  {
    // the demo waits for the poster: the title clock doesn't run behind it
    const { page, ctx } = await open("?debug&splash");
    await tm(page, () => window.__tm.setTimeScale(8));
    await page.waitForTimeout(2500);                                   // 20 game seconds
    check(await tm(page, () => !window.__tm.demo && window.__tm.state === "title"), "no attract demo behind the poster");
    await ctx.close();
  }
  {
    // phone: tap anywhere on the poster
    const { page, ctx } = await open("?debug&splash", { touch: true, viewport: { width: 390, height: 844 } });
    await page.waitForFunction(() => window.__tm.splashReady, null, { timeout: 8000 });
    const f = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, h: innerHeight, img: document.querySelector(".tm-splash img").getBoundingClientRect().toJSON(), tap: getComputedStyle(document.querySelector(".tm-cta-tap")).display }));
    check(f.img.bottom <= f.h && f.img.width <= 390 && f.img.width >= 340 && f.sh <= f.h, `phone: poster fits the width (${Math.round(f.img.width)}x${Math.round(f.img.height)})`);
    check(f.tap !== "none", "phone says TAP TO PLAY");
    if (SHOTS) await page.screenshot({ path: path.join(OUT, "tm-p6-splash-phone.png") });
    await page.tap(".tm-splash img");
    check(await tm(page, () => !window.__tm.splashOpen && window.__tm.state === "title"), "a tap closes it");
    await ctx.close();
  }

  // ---- the weekly board ----------------------------------------------------------------------
  {
    const { page, ctx } = await open("?debug");
    await page.waitForFunction(() => window.TrollLeaderboard);
    await page.evaluate(() => {
      window.__records = [];
      const orig = window.TrollLeaderboard.record;
      window.TrollLeaderboard.record = (id, ev) => { window.__records.push([id, ev]); return orig(id, ev); };
    });
    await page.click("#tm-board-btn");
    check(await shown(page, "#tm-board"), "the trophy opens the board");
    // the board in the game's own look (game.js renderBoardPanel), not the engine's table
    await page.waitForFunction(() => document.querySelector("#lb-root .tm-hi-week"), null, { timeout: 8000 }).catch(() => {});
    const panel = await page.evaluate(() => ({ week: !!document.querySelector("#lb-root .tm-hi-week"), table: !!document.querySelector("#lb-root table"), text: document.querySelector("#lb-root").textContent }));
    check(panel.week && !panel.table && /RESETS IN/.test(panel.text), `it shows the Troll Man high scores (${panel.text.slice(0, 80)})`);
    if (SHOTS) await page.screenshot({ path: path.join(OUT, "tm-p6-board.png") });
    await page.keyboard.press("Enter");                               // focus is on the close button
    check(!(await shown(page, "#tm-board")) && await tm(page, () => window.__tm.state) === "title", "Enter on the x closes it, without starting a game");
    // mid-game it pauses; Esc closes
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.__tm.state === "play");
    await page.click("#tm-board-btn");
    check(await tm(page, () => window.__tm.paused), "opening it mid-game pauses");
    await page.keyboard.press("Escape");
    check(!(await shown(page, "#tm-board")), "Esc closes it");
    // a 1-player game over reports the score
    await tm(page, () => { window.__tm.setLives(1); });
    await page.keyboard.press("p");                                   // unpause
    await tm(page, () => { const t = window.__tm, p = t.player, g = t.CHASERS.find(c => c.name === "gigachad"); Object.assign(g, { mode: "out", fright: false, frozen: 0, x: p.x, y: p.y }); });
    await page.waitForFunction(() => window.__tm.state === "over", null, { timeout: 8000 });
    const rec = await page.evaluate(() => ({ r: window.__records, score: window.__tm.score }));
    check(rec.r.length === 1 && rec.r[0][0] === "troll-man" && rec.r[0][1].score === rec.score && rec.r[0][1].level === 1, `1-player game over goes to the board (${JSON.stringify(rec.r)})`);
    // (the backend is blocked, so the engine falls back to this device's cache once the fetch fails)
    const rowsText = () => page.evaluate(() => [...document.querySelectorAll("#lb-root li")].map(t => t.textContent.replace(/\s+/g, " ").trim()).join(" | "));
    await page.waitForFunction(s => document.querySelector("#lb-root").textContent.includes("YOU") && document.querySelector("#lb-root").textContent.includes(s), String(rec.score), { timeout: 10000 }).catch(() => {});
    const you = await rowsText();
    check(you.includes(String(rec.score)), `the score shows on this device's board (${you.slice(0, 120)})`);
    // back on the title, the attract loop's HIGH SCORES page carries it too
    await page.waitForFunction(() => window.__tm.state === "title" && window.__tm.stateTime >= 9, null, { timeout: 30000 }).catch(() => {});
    const hi = await tm(page, () => ({ st: window.__tm.state, t: window.__tm.stateTime, rows: (window.__tm.hiScores?.entries || []).map(e => [e.rank, e.score, !!e.you]) }));
    check(hi.st === "title" && hi.t >= 8 && hi.rows.some(r => r[1] === rec.score && r[2]), `the title's HIGH SCORES page has it (${JSON.stringify(hi)})`);
    if (SHOTS) await page.screenshot({ path: path.join(OUT, "tm-hi-attract.png") });
    await page.click("#tm-board-btn");
    if (SHOTS) await page.screenshot({ path: path.join(OUT, "tm-hi-panel.png") });
    await ctx.close();
  }
  {
    // 2 players: not reported
    const { page, ctx } = await open("?debug");
    await page.waitForFunction(() => window.TrollLeaderboard);
    await page.evaluate(() => { window.__records = []; window.TrollLeaderboard.record = (id, ev) => window.__records.push([id, ev]); });
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    for (let i = 0; i < 2; i++) {
      await page.waitForFunction(() => window.__tm.state === "play", null, { timeout: 8000 });
      await tm(page, () => { window.__tm.setLives(1); const t = window.__tm, p = t.player, g = t.CHASERS.find(c => c.name === "gigachad"); Object.assign(g, { mode: "out", fright: false, frozen: 0, x: p.x, y: p.y }); });
      await page.waitForFunction(() => ["ready", "turnover", "over"].includes(window.__tm.state) && window.__tm.state !== "play", null, { timeout: 8000 });
      if (await tm(page, () => window.__tm.state === "turnover")) await page.waitForFunction(() => window.__tm.state === "ready", null, { timeout: 6000 });
    }
    await page.waitForFunction(() => window.__tm.state === "over", null, { timeout: 8000 });
    check(await page.evaluate(() => window.__records.length) === 0, "2-player hot-seat games stay off the board");
    await ctx.close();
  }

  // ---- hub card + home menu --------------------------------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.route(/supabase\.co/, r => r.abort());
    const page = await ctx.newPage();
    page.on("pageerror", e => errors.push("games.html: " + String(e)));
    await page.goto(`http://localhost:${PORT}/games.html`);
    await page.waitForTimeout(800);
    const card = await page.evaluate(() => {
      const a = document.querySelector('.hub-card a[href="troll-man"]');
      const c = a && a.closest(".hub-card"), img = c && c.querySelector(".hub-card-art img");
      return c && { title: c.querySelector("h3").textContent, meta: c.querySelector(".hub-card-meta").textContent, img: img.getAttribute("src"), tag: c.querySelector(".hub-card-tag").textContent, hidden: c.hidden };
    });
    check(card && card.title === "Troll Man" && !card.hidden && card.tag === "Arcade" && /1-2 players/.test(card.meta), `games.html has the Troll Man card (${JSON.stringify(card)})`);
    await page.evaluate(() => document.querySelector('.hub-card a[href="troll-man"]').closest(".hub-card").scrollIntoView({ block: "center", inline: "center" }));
    await page.waitForFunction(() => { const i = document.querySelector('.hub-card a[href="troll-man"]').closest(".hub-card").querySelector("img"); return i.complete && i.naturalWidth === 1200; }, null, { timeout: 8000 }).then(() => check(true, "its art loads"), () => check(false, "its art loads"));
    if (SHOTS) {
      const c = page.locator('.hub-card:has(a[href="troll-man"])');
      await c.screenshot({ path: path.join(OUT, "tm-p6-hub-card.png") });
    }
    const idx = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
    check(/label: 'Troll Man'[^}]*href: 'troll-man'/.test(idx), "the home page Arcade menu lists Troll Man");
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}
if (errors.length) { console.log("page errors:\n" + errors.join("\n")); fails.push("page errors"); }
console.log(fails.length ? "FAIL" : "PASS");
process.exit(fails.length ? 1 : 0);
