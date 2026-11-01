// One pick for the mode (user, 2026-10-31: "choosing game mode and map
// voting its pretty redundantly built here. its almost like i have to
// choose twice?"). Change mode lists the playlists and, under the one
// you're on, its modes; PLAY with Public Match is Find Match: alone, straight
// in on the round's map; with others queued, the Finding match screen, you
// readied up, its map vote the one place a map is picked. Solo, Private and
// Finding match have no mode list; U Mad Bro's hero is on the mode card;
// Record my match is in Options. Laptop and phones, text overlap scan on
// the open picker. Supabase blocked; the start button is caught, so no match
// starts and no room is joined.
//
//   node tools/troll-ops-fn-one-pick-test.mjs     SHOTS_DIR=<dir> for shots
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

const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });
for (const [name, vp, more] of [["laptop", { width: 1365, height: 632 }, {}], ["phone", { width: 390, height: 844 }, PHONE], ["phone-side", { width: 844, height: 390 }, PHONE]]) {
  const ctx = await browser.newContext({ viewport: vp, ...more });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1&season=off`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__toBo2?.fn, null, { timeout: 180000 });
  await sleep(800);
  await page.evaluate(() => {
    document.querySelectorAll(".tf-toast-x").forEach((x) => x.click());
    // the start button is caught: count presses, start nothing
    window.__starts = 0;
    document.getElementById("to-start-btn").addEventListener("click", (e) => { window.__starts++; e.stopImmediatePropagation(); e.preventDefault(); }, true);
    window.__toBo2.fn.setPlaylist("public");
    window.__toBo2.menu.backTo("main");
  });
  await sleep(300);
  const card = () => page.evaluate(() => ({ name: document.querySelector(".to-fn-mode-name")?.textContent, sub: document.querySelector(".to-fn-mode-sub")?.textContent,
    pl: window.__toBo2.fn.playlist(), open: !document.querySelector(".to-fn-picker").hidden, screen: window.__toBo2.menu.current() }));

  // 1. Change mode: the playlists, Public Match's modes under it
  await page.click(".to-fn-mode");
  await sleep(250);
  const pick = await page.evaluate(() => ({
    pls: [...document.querySelectorAll(".to-fn-picker > [data-pl]")].map((b) => b.dataset.pl),
    modes: [...document.querySelectorAll(".to-fn-pick-modes [data-mode]")].map((b) => b.dataset.mode),
  }));
  check(pick.pls.length === 5 && pick.modes.includes("tdm") && pick.modes.includes("ffa") && pick.modes.includes("royale"),
    `${name}: Change mode lists the playlists, Public Match's modes under it`, JSON.stringify(pick));
  // the whole list on screen, nothing to scroll
  const fit = await page.evaluate(() => { const p = document.querySelector(".to-fn-picker"), r = p.getBoundingClientRect(); return { scroll: p.scrollHeight - p.clientHeight, top: Math.round(r.top), bottom: Math.round(r.bottom), h: innerHeight }; });
  check(fit.scroll <= 1 && fit.top >= 0 && fit.bottom <= fit.h, `${name}: the picker fits, nothing to scroll`, JSON.stringify(fit));
  // (the party box and the mode card are under the opaque picker: out of the scan)
  await page.evaluate(() => document.querySelectorAll(".to-bo2-party, .to-fn-play, .to-stage-add").forEach((e) => { e.style.visibility = "hidden"; }));
  await scanText(page, (ok, what, extra) => check(ok, `${name} picker: ${what}`, extra), `${name} picker`);
  await page.evaluate(() => document.querySelectorAll(".to-bo2-party, .to-fn-play, .to-stage-add").forEach((e) => { e.style.visibility = ""; }));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `pick-${name}.png`) });
  await page.click('.to-fn-pick-modes [data-mode="ffa"]');
  await sleep(250);
  let c = await card();
  check(!c.open && c.pl === "public" && /Free-for-All/i.test(c.sub), `${name}: picking Free-for-All closes it, the card says Public Match · Free-for-All`, JSON.stringify(c));

  // 2. Solo Play: its own modes open under it, then one is picked
  await page.click(".to-fn-mode"); await sleep(200);
  await page.click('.to-fn-picker [data-pl="solo"]'); await sleep(250);
  const solo = await page.evaluate(() => ({ open: !document.querySelector(".to-fn-picker").hidden, modes: [...document.querySelectorAll(".to-fn-pick-modes [data-mode]")].map((b) => b.dataset.mode) }));
  check(solo.open && solo.modes.includes("ops"), `${name}: Solo Play opens its modes in the picker`, JSON.stringify(solo));
  await page.click('.to-fn-pick-modes [data-mode="ops"]'); await sleep(250);
  c = await card();
  check(!c.open && c.pl === "solo", `${name}: a Solo mode picked, the card is Solo Play`, JSON.stringify(c));

  // 3. the screens PLAY opens ask no mode again
  const screens = await page.evaluate(async () => {
    const out = {};
    for (const id of ["solo", "private", "public"]) {
      window.__toBo2.menu.go(id);
      await new Promise((r) => setTimeout(r, 250));
      out[id] = [...document.querySelectorAll(".to-bo2-menu .tr-menu-item")].filter((e) => e.offsetParent).map((e) => e.dataset.id);
      window.__toBo2.menu.backTo("main");
      await new Promise((r) => setTimeout(r, 150));
    }
    return out;
  });
  const noModes = (ids) => !ids.some((id) => /^mode-/.test(id));
  check(noModes(screens.solo) && noModes(screens.private) && noModes(screens.public), `${name}: Solo, Private and Finding match list no modes`, JSON.stringify(screens));
  check(screens.public[0] === "deploy", `${name}: Finding match's first row is Find Match`, JSON.stringify(screens.public));

  // 4. PLAY, alone: the map preview and vote, Drop in now first; it goes in
  await page.evaluate(() => { window.__toBo2.fn.setPlaylist("public"); document.querySelector('#to-lo-mode [data-mode="tdm"]').click(); window.__toBo2.menu.backTo("main"); window.__starts = 0; });
  await sleep(250);
  await page.click(".to-fn-go");
  await sleep(500);
  const alone = await page.evaluate(() => ({ screen: window.__toBo2.menu.current(), starts: window.__starts,
    first: document.querySelector(".to-bo2-menu .tr-menu-item")?.textContent.trim(), go: document.querySelector(".to-mv-go")?.textContent.trim(),
    vote: !document.querySelector(".to-bo2-vote").hidden, big: !!document.querySelector(".to-bo2-vote .to-mv-big img"), cards: document.querySelectorAll(".to-bo2-vote [data-map]").length }));
  check(alone.screen === "public" && alone.starts === 0 && alone.vote && alone.big && alone.cards === 3 && /Drop in now/.test(alone.first || alone.go || ""),
    `${name}: PLAY alone shows the map preview and vote, Drop in now`, JSON.stringify(alone));
  // the three map cards whole inside the panel (or its sheet), under the big shot
  const cardsIn = await page.evaluate(() => { const p = document.querySelector(".to-bo2-vote").getBoundingClientRect();
    return [...document.querySelectorAll(".to-bo2-vote li[data-map]")].map((li) => { const r = li.getBoundingClientRect(); return r.top >= p.top - 1 && r.bottom <= p.bottom + 1 && r.bottom <= innerHeight + 1; }); });
  check(cardsIn.length === 3 && cardsIn.every(Boolean), `${name}: the three map cards are whole, not cut off`, JSON.stringify(cardsIn));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `alone-${name}.png`) });
  await page.evaluate(() => (document.querySelector(".to-mv-go") || document.querySelector('.to-bo2-menu .tr-menu-item[data-id="deploy"]')).click());
  await sleep(300);
  const went = await page.evaluate(() => ({ starts: window.__starts, map: document.querySelector("#to-lo-maps .to-lo-map.is-active")?.dataset.map }));
  // (1, or 2 when the round's clock ran out first: readied up, that drops you in too)
  check(went.starts >= 1, `${name}: Drop in now goes in on the round's map`, JSON.stringify(went));
  await page.evaluate(() => window.__toBo2.menu.backTo("main"));
  await sleep(200);

  // 5. PLAY with someone queued: Finding match, readied up, the vote
  await page.evaluate(() => {
    window.__starts = 0;
    window.__toBo2.fakeRoster({ members: [{ userId: "00000000-0000-4000-8000-000000000009", viewerId: "v9", username: "queued", level: 5,
      activity: { game: "tf", state: "lobby", mode: "tdm", modeName: "Team Deathmatch", map: null, ready: true } }], guests: [] });
  });
  await sleep(300);
  await page.click(".to-fn-go");
  await sleep(500);
  const queued = await page.evaluate(() => ({ screen: window.__toBo2.menu.current(), starts: window.__starts,
    first: document.querySelector(".to-bo2-menu .tr-menu-item")?.textContent.trim(),
    vote: !document.querySelector(".to-bo2-vote").hidden, sheet: document.querySelector(".to-bo2-vote").classList.contains("is-sheet"),
    cards: document.querySelectorAll(".to-bo2-vote [data-map]").length }));
  const touch = name !== "laptop";
  check(queued.screen === "public" && queued.starts === 0 && /Cancel/.test(queued.first || "") && queued.vote && queued.cards === 3 && queued.sheet === touch,
    `${name}: PLAY with others queued: Finding match, readied up (Cancel), the three-map vote${touch ? " on its sheet" : ""}`, JSON.stringify(queued));
  // (on a phone the sheet is opaque over the whole lobby: what's under it is out of the scan)
  if (touch) await page.evaluate(() => document.querySelectorAll(".to-bo2-menu, .to-bo2-foot").forEach((e) => { e.style.visibility = "hidden"; }));
  await scanText(page, (ok, what, extra) => check(ok, `${name} finding match: ${what}`, extra), `${name} finding`);
  await page.evaluate(() => document.querySelectorAll(".to-bo2-menu, .to-bo2-foot").forEach((e) => { e.style.visibility = ""; }));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `finding-${name}.png`) });
  await page.evaluate(() => { window.__toBo2.fakeRoster({ members: [], guests: [] }); window.__toBo2.menu.backTo("main"); });
  await sleep(300);

  // 6. U Mad Bro?: the hero on the card, the card opens the heroes
  await page.click(".to-fn-mode"); await sleep(200);
  const umb = await page.$('.to-fn-pick-modes [data-mode="umb"]:not(:disabled)');
  if (umb) {
    await umb.click(); await sleep(250);
    const h = await page.evaluate(() => ({ name: document.querySelector(".to-fn-map strong")?.textContent, sub: document.querySelector(".to-fn-map span")?.textContent, hero: document.querySelector(".to-fn-map").classList.contains("is-hero") }));
    check(h.hero && !!h.name && /hero/i.test(h.sub), `${name}: U Mad Bro? puts your hero on the mode card`, JSON.stringify(h));
    await page.click(".to-fn-map"); await sleep(300);
    check(await page.evaluate(() => window.__toBo2.menu.current()) === "heroes", `${name}: the hero card opens the heroes`);
    await page.evaluate(() => window.__toBo2.menu.backTo("main"));
  } else console.log(`INFO ${name}: U Mad Bro? is locked for a guest; hero card not checked`);

  // 7. Record my match: in Options where the browser can record
  const rec = await page.evaluate(async () => {
    window.__toBo2.menu.go("options"); await new Promise((r) => setTimeout(r, 250));
    const has = !!document.querySelector('.to-bo2-menu .tr-menu-item[data-id="royale-record"]');
    window.__toBo2.menu.backTo("main");
    return { has, can: typeof MediaRecorder !== "undefined" };
  });
  check(rec.has || !rec.can, `${name}: Record Royale matches is in Options`, JSON.stringify(rec));
  check(!errors.length, `${name}: no page errors`, errors.slice(0, 3).join(" | "));
  await ctx.close();
}
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ONE PICK GREEN");
process.exit(fails ? 1 : 0);
